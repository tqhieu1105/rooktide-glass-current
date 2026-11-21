import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { openChromium, delay } from './browser.mjs';
import { runSimulationChecks } from './simulation-checks.mjs';

const base = process.env.GAME_URL || 'http://127.0.0.1:8080';
const browser = await openChromium();
const errors = [], warnings = [], requests = [], checks = [];
const snapshot = () => browser.evaluate('window.__rooktide.snapshot()');
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
browser.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails));
browser.on('Runtime.consoleAPICalled', e => {
  if (e.type === 'error') errors.push(e.args);
  if (e.type === 'warning') warnings.push(e.args);
});
browser.on('Network.loadingFailed', e => errors.push({ network: e.errorText }));
browser.on('Network.responseReceived', e => { if (e.response.status >= 400) errors.push({ status: e.response.status, url: e.response.url }); });
browser.on('Network.requestWillBeSent', e => { if (/^https?:/.test(e.request.url)) requests.push(e.request.url); });
async function navigate(query = '') {
  await browser.send('Page.navigate', { url: base + '/' + query });
  await browser.waitFor('window.__gameReady || window.__renderFailed');
  check('WebGL boot ' + (query || '(fresh game)'), !await browser.evaluate('!!window.__renderFailed'));
}
async function hold(code, ms) {
  await browser.key(code); await delay(ms); await browser.key(code, false); await delay(220);
}

try {
  await mkdir('verification', { recursive: true });
  const version = await browser.send('Browser.getVersion');
  await navigate();
  const titleTick = (await snapshot()).tick;
  await hold('KeyW', 260);
  check('Fresh title has no Continue and blocks movement', (await snapshot()).menu === 'title'
    && (await snapshot()).tick === titleTick && await browser.evaluate('document.getElementById("continue-button").hidden'));
  await browser.click('#title-screen [data-view=controls]');
  check('Title opens the controls guide', (await snapshot()).menu === 'controls');
  await browser.tap('Escape');
  check('Escape returns from controls to title', (await snapshot()).menu === 'title');
  await browser.startNewGame();
  const initial = await snapshot();
  check('Perspective camera and authentic WebGL2 renderer', initial.camera.type === 'PerspectiveCamera' && initial.renderer.context.includes('WebGL'));
  check('172 real buildings and six-district graph', initial.world.buildings === 172 && initial.world.districts === 6 && initial.world.roadNodes === 43);
  check('District streaming starts from a bounded set of full-detail chunks', initial.streaming.totalChunks === 49
    && initial.streaming.loadedChunks < initial.streaming.totalChunks && initial.streaming.loadedChunks <= 8
    && initial.streaming.detailedChunks > 0);
  await hold('KeyW', 550);
  const walked = await snapshot();
  check('Real W key walks', walked.player.z < initial.player.z - 0.7 && !walked.player.inVehicle);
  await hold('KeyS', 550);
  await browser.tap('KeyE');
  const entered = await snapshot();
  check('Real E key enters the existing car', entered.player.inVehicle && entered.car.id === initial.car.id);
  await browser.tap('KeyV');
  check('V tunes the next station in a car', (await snapshot()).station === 1
    && await browser.evaluate('document.getElementById("station-name").textContent === "Lowwater 91.6"'));
  await hold('KeyE', 850);
  check('One E press exits once', !(await snapshot()).player.inVehicle);
  await hold('KeyE', 850);
  check('Held E enters once without bouncing between modes', (await snapshot()).player.inVehicle);
  await hold('KeyW', 1800);
  const driven = await snapshot();
  check('W accelerates and drives', driven.car.speed > 8 && driven.car.z < entered.car.z - 6);
  await browser.tap('KeyE');
  check('Unsafe moving exit is refused', (await snapshot()).player.inVehicle);
  await hold('Space', 750);
  const handbraked = await snapshot();
  check('Space handbrake changes speed and brake state', handbraked.car.speed < driven.car.speed - 3);
  await browser.key('KeyS');
  await browser.waitFor('window.__rooktide.snapshot().car.speed < 1.4', 10000);
  await browser.key('KeyS', false);
  await browser.tap('KeyE');
  const exited = await snapshot();
  check('Safe E exit preserves parked vehicle', !exited.player.inVehicle && exited.car.id === initial.car.id);
  const sprintStart = await snapshot();
  await browser.key('ShiftLeft'); await hold('KeyW', 450); await browser.key('ShiftLeft', false);
  const sprinted = await snapshot();
  check('Sprint continues on foot after exit', Math.hypot(sprinted.player.x - sprintStart.player.x, sprinted.player.z - sprintStart.player.z) > 2.2);
  await browser.tap('KeyC');
  check('C cycles the ordinary camera', (await snapshot()).camera.preset === 1);
  const orbitStart = (await snapshot()).camera.heading;
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 350, button: 'left', clickCount: 1 });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 780, y: 350, button: 'left', buttons: 1 });
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 780, y: 350, button: 'left', clickCount: 1 });
  await delay(250);
  check('Mouse drag orbits without pointer lock', Math.abs((await snapshot()).camera.heading - orbitStart) > 0.1);
  await browser.tap('KeyM');
  check('M expands the live city map', await browser.evaluate('document.querySelector(".map-wrap.expanded .map-ring")?.offsetWidth >= 300'));
  await browser.tap('KeyM');
  await browser.tap('Escape');
  const paused = await snapshot(); await delay(350);
  check('Escape pauses simulation', paused.paused && (await snapshot()).tick === paused.tick);
  await browser.click('#pause [data-view=settings]');
  await browser.click('#quality-button');
  check('Quality setting changes the actual renderer', (await snapshot()).renderer.quality !== initial.renderer.quality);
  await browser.click('#quality-button');
  const muted = await browser.evaluate('document.getElementById("mute-audio").checked');
  await browser.click('#mute-audio');
  check('Audio preferences persist station and mute state', await browser.evaluate(`(() => {
    const settings = JSON.parse(localStorage.getItem('rooktide-preferences-1'));
    return settings.station === 1 && settings.muted === ${!muted}; })()`));
  await browser.tap('Escape');
  await browser.tap('Escape');
  await browser.tap('KeyR');
  check('R safely recovers the on-foot player', !(await snapshot()).paused && !(await snapshot()).player.inVehicle);
  await browser.screenshot('verification/on-foot-tested.jpg', 'jpeg');

  // Save, quit, continue, reload, then confirm a new game through the normal title.
  await browser.tap('Escape');
  await browser.click('#save-button');
  check('Save records a validated street checkpoint', await browser.evaluate(`Number.isInteger(JSON.parse(localStorage.getItem('rooktide-campaign-1')).checkpoint)
    && document.getElementById('save-note').textContent.startsWith('Progress saved')`));
  await browser.click('#quit-button');
  check('Quit to Title offers Continue', (await snapshot()).menu === 'title'
    && await browser.evaluate('!document.getElementById("continue-button").hidden'));
  await navigate();
  await browser.click('#continue-button');
  check('Continue after reload is on foot beside a usable car at the saved street', !(await snapshot()).paused
    && !(await snapshot()).player.inVehicle && await browser.evaluate(`(() => { const { player, car } = window.__rooktide.snapshot();
      return Math.hypot(player.x - car.x, player.z - car.z) === 4; })()`));
  await browser.tap('Escape');
  await browser.click('#quit-button');
  await browser.click('#new-game');
  if ((await snapshot()).menu !== 'confirm') await browser.waitFor('window.__rooktide.snapshot().menu === "confirm"');
  check('Starting over requires confirmation when a save exists', (await snapshot()).menu === 'confirm');
  await browser.click('#confirm-new');

  // Start and retry the first job with ordinary keyboard controls.
  check('Fresh free roam shows Ilex and leaves the campaign inactive', (await snapshot()).mission.point.style === 'contact' && !(await snapshot()).mission.active);
  await browser.key('KeyW');
  await browser.waitFor('window.__rooktide.snapshot().player.z < 9', 15000);
  await browser.key('KeyW', false);
  await browser.key('KeyD');
  await browser.waitFor('document.getElementById("prompt").textContent.includes("Speak to Ilex")', 5000);
  await browser.key('KeyD', false);
  await browser.tap('KeyE');
  const firstJob = await snapshot();
  check('A single E at Ilex starts Borrowed Voltage without entering a car', firstJob.mission.active && firstJob.mission.index === 0
    && firstJob.mission.id === 'borrowed-voltage' && !firstJob.player.inVehicle
    && await browser.evaluate('!document.getElementById("mission-card").hidden'));
  await browser.tap('Escape');
  check('Pause offers checkpoint retry and the last crew transmission', await browser.evaluate(`!document.getElementById('pause-retry').hidden
    && document.getElementById('last-radio').textContent.startsWith('Ilex Renn:')`));
  await browser.click('#pause-retry');
  await browser.tap('KeyR');
  check('Manual mission recovery opens the checkpoint dialog', !!(await snapshot()).mission.failed
    && await browser.evaluate('!document.getElementById("chase-outcome").hidden'));
  await browser.evaluate('document.getElementById("retry-chase").click()');
  check('Retry restores the same job stage and clears the dialog', !(await snapshot()).mission.failed && (await snapshot()).mission.index === 0
    && await browser.evaluate('document.getElementById("chase-outcome").hidden'));

  // Jog through the lot marker, then approach the compact from the sidewalk.
  async function jogTo(x, z, tolerance) {
    const held = new Set();
    const deadline = performance.now() + 20000;
    try {
      await browser.key('ShiftLeft');
      while (performance.now() < deadline) {
        const { player } = await snapshot();
        const dx = x - player.x, dz = z - player.z;
        if (Math.hypot(dx, dz) < tolerance) return;
        const wanted = [];
        if (Math.abs(dx) > .65) wanted.push(dx < 0 ? 'KeyA' : 'KeyD');
        if (Math.abs(dz) > .65) wanted.push(dz < 0 ? 'KeyW' : 'KeyS');
        for (const code of held) if (!wanted.includes(code)) { await browser.key(code, false); held.delete(code); }
        for (const code of wanted) if (!held.has(code)) { await browser.key(code); held.add(code); }
        await delay(90);
      }
      throw new Error(`Could not jog to (${x}, ${z}): ${JSON.stringify((await snapshot()).player)}`);
    } finally {
      for (const code of held) await browser.key(code, false);
      await browser.key('ShiftLeft', false);
    }
  }
  await jogTo(99, -46, 2.0);
  await jogTo(97.3, -70, 1.1);
  await browser.waitFor('document.getElementById("prompt").textContent.includes("Take the marked vehicle")', 5000);
  await browser.tap('KeyE');
  const marked = await snapshot();
  check('Entering the marked compact advances the mission and calls a one-star patrol', marked.player.inVehicle
    && marked.car.type === 'compact' && marked.mission.kind === 'escapeWanted' && marked.police.level === 1);

  // Sixty real wall-clock seconds of keyboard-controlled driving on normal roads.
  await navigate('?shot=chase&seed=20261121');
  const chaseStart = await snapshot();
  check('Cover starts in a live three-star pursuit with three patrols and a helicopter', chaseStart.frozen
    && chaseStart.police.level === 3 && chaseStart.police.units.length === 3 && chaseStart.police.helicopter);
  check('Cover shows the live Seawall Dividend gate and mission card', chaseStart.mission.id === 'seawall-dividend'
    && chaseStart.mission.index === 1 && chaseStart.mission.point.label === 'Seawall checkpoint'
    && await browser.evaluate('!document.getElementById("waypoint-label").hidden && !document.getElementById("mission-card").hidden'));
  check('Wanted stars and air dispatch are visible', await browser.evaluate(`document.querySelectorAll('#wanted-stars .lit').length === 3
    && [...document.querySelectorAll('#dispatch-units li')].some(row => !row.hidden && row.textContent.includes('SPOTLIGHT'))`));
  const waypoints = [[426, -360], [252, -360], [252, 360], [420, 360], [420, 0]];
  const held = new Set();
  async function keys(wanted) {
    for (const code of held) if (!wanted.includes(code)) { await browser.key(code, false); held.delete(code); }
    for (const code of wanted) if (!held.has(code)) { await browser.key(code); held.add(code); }
  }
  let waypoint = 0, samples = [], travelled = 0, previous = await snapshot();
  const start = performance.now();
  while (performance.now() - start < 60000) {
    const state = await snapshot(), c = state.car;
    travelled += Math.hypot(c.x - previous.car.x, c.z - previous.car.z); previous = state;
    const [x, z] = waypoints[waypoint % waypoints.length];
    const distance = Math.hypot(x - c.x, z - c.z);
    if (distance < 7) waypoint++;
    const wantedHeading = Math.atan2(x - c.x, -(z - c.z));
    const error = Math.atan2(Math.sin(wantedHeading - c.heading), Math.cos(wantedHeading - c.heading));
    const target = Math.abs(error) > 0.18 || distance < 32 ? 6 : 22;
    const wanted = [];
    if (c.speed < target - 0.6) wanted.push('KeyW');
    if (c.speed > target + 1) wanted.push('KeyS');
    if (error > 0.035) wanted.push('KeyD');
    if (error < -0.035) wanted.push('KeyA');
    // Throttle also unfreezes the reachable screenshot checkpoint.
    if (state.frozen) wanted.push('KeyW');
    await keys([...new Set(wanted)]);
    samples.push({ ms: Math.round(performance.now() - start), calls: state.renderer.calls,
      triangles: state.renderer.triangles, speed: c.speed, condition: c.condition });
    await delay(120);
  }
  await keys([]);
  const performanceState = await snapshot();
  await browser.screenshot('verification/drive-60s.jpg', 'jpeg');
  if (performanceState.car.condition <= 70) console.log('Drive damage trace:', JSON.stringify({
    car: { x: performanceState.car.x, z: performanceState.car.z, speed: performanceState.car.speed,
      recoveries: performanceState.car.recoveries, condition: performanceState.car.condition },
    streaming: performanceState.streaming,
    damage: samples.filter((sample, index) => index === 0 || sample.condition < samples[index - 1].condition)
      .slice(-12).map(({ ms, speed, condition }) => ({ seconds: +(ms / 1000).toFixed(1), speed, condition })),
  }));
  check('Screenshot mission resumes and advances through both gates under normal keys', !performanceState.frozen && performanceState.tick > 91
    && performanceState.mission.index >= 2);
  check('60-second drive has no stalls trapping input', travelled > 350 && performanceState.performance.samples > 60);
  check(`60-second drive stays intact (bodywork ${performanceState.car.condition.toFixed(1)}%)`, performanceState.car.condition > 70);
  check('District streaming unloads visited chunks and stays within its residency budget', performanceState.streaming.unloads > 0
    && performanceState.streaming.loadedChunks <= 8 && performanceState.streaming.maxLoadedChunks <= 8
    && performanceState.streaming.detailedChunks > 0 && performanceState.streaming.lowDetailChunks > 0);
  await navigate();
  await browser.startNewGame();
  await browser.tap('Digit2');
  await browser.waitFor('window.__rooktide.snapshot().combat.weapon === 2 && !document.getElementById("aim-reticle").hidden');
  check('Weapon 2 selects the live pistol and its aiming reticle', (await snapshot()).combat.weapon === 2
    && await browser.evaluate('!document.getElementById("aim-reticle").hidden && !document.getElementById("pistol-slot").hidden'));
  const wheelTick = (await snapshot()).tick;
  await browser.key('Tab'); await delay(220);
  await browser.waitFor('!document.getElementById("weapon-wheel").hidden');
  check('Holding Tab opens the radial wheel and pauses the street', await browser.evaluate('!document.getElementById("weapon-wheel").hidden')
    && (await snapshot()).tick === wheelTick);
  await browser.key('Digit1'); await delay(120);
  await browser.waitFor('document.querySelector("#weapon-wheel [data-weapon=\\"1\\"]").classList.contains("selected")');
  check('Number keys pick a wheel slot while Tab is held', await browser.evaluate('document.querySelectorAll("#weapon-wheel [data-weapon]")[0].classList.contains("selected")'));
  await browser.key('Digit1', false); await browser.key('Tab', false); await delay(180);
  await browser.waitFor('window.__rooktide.snapshot().combat.weapon === 1 && document.getElementById("weapon-wheel").hidden');
  check('Releasing Tab confirms the keyboard-picked fists slot', (await snapshot()).combat.weapon === 1
    && await browser.evaluate('document.getElementById("weapon-wheel").hidden'));
  await browser.tap('Digit2');
  await browser.key('Tab'); await delay(80);
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 170 }); await delay(150);
  await browser.waitFor('document.querySelector("#weapon-wheel [data-weapon=\\"1\\"]").classList.contains("selected")');
  check('Mouse direction highlights the upper radial slot', await browser.evaluate('document.querySelectorAll("#weapon-wheel [data-weapon]")[0].classList.contains("selected")'));
  await browser.key('Tab', false); await delay(180);
  await browser.waitFor('window.__rooktide.snapshot().combat.weapon === 1 && document.getElementById("weapon-wheel").hidden');
  check('Mouse-picked weapon is confirmed on Tab release', (await snapshot()).combat.weapon === 1);
  await browser.tap('Digit1');
  check('Digit1 still quick-selects fists after using the wheel', (await snapshot()).combat.weapon === 1);
  await browser.tap('Digit2');
  check('Digit2 still quick-selects the pistol after using the wheel', (await snapshot()).combat.weapon === 2);
  await hold('KeyF', 420);
  const firing = await snapshot();
  check('F fires from the on-foot pistol and raises wanted heat', firing.combat.rounds < 12 && firing.police.level === 1);
  await browser.tap('KeyR');
  await browser.waitFor('window.__rooktide.snapshot().combat.rounds === 12', 7000);
  check('R reloads from reserve and restores magazine capacity', (await snapshot()).combat.reserve < 36);
  await browser.tap('Digit1');
  check('Weapon 1 returns to fists without changing pistol ammunition', (await snapshot()).combat.weapon === 1);
  const simulation = runSimulationChecks();
  const external = requests.filter(url => new URL(url).origin !== new URL(base).origin);
  check('No remote game requests', external.length === 0);
  check('Zero console, shader, runtime or HTTP errors', errors.length === 0);
  const report = { browser: version.product, checks, errors, warnings, external,
    simulation, performance: { durationMs: Math.round(performance.now() - start), travelledMetres: Math.round(travelled),
      state: performanceState, samples } };
  await writeFile('verification/smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ checks, simulation, errors, warnings,
    performance: { ...performanceState.performance, renderer: performanceState.renderer, travelledMetres: Math.round(travelled) } }, null, 2));
} finally { await browser.close(); }
