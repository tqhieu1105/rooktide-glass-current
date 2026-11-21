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
  const initial = await snapshot();
  check('Perspective camera and authentic WebGL2 renderer', initial.camera.type === 'PerspectiveCamera' && initial.renderer.context.includes('WebGL'));
  check('172 real buildings and six-district graph', initial.world.buildings === 172 && initial.world.districts === 6 && initial.world.roadNodes === 43);
  await hold('KeyW', 550);
  const walked = await snapshot();
  check('Real W key walks', walked.player.z < initial.player.z - 0.7 && !walked.player.inVehicle);
  await hold('KeyS', 550);
  await browser.tap('KeyE');
  const entered = await snapshot();
  check('Real E key enters the existing car', entered.player.inVehicle && entered.car.id === initial.car.id);
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
  check('M expands the live city map', await browser.evaluate('document.getElementById("map-label").textContent.includes("TO CLOSE")'));
  await browser.tap('KeyM');
  await browser.tap('Escape');
  const paused = await snapshot(); await delay(350);
  check('Escape pauses simulation', paused.paused && (await snapshot()).tick === paused.tick);
  await browser.evaluate('document.getElementById("quality-button").click()');
  check('Quality setting changes the actual renderer', (await snapshot()).renderer.quality !== initial.renderer.quality);
  await browser.evaluate('document.getElementById("quality-button").click()');
  await browser.tap('Escape');
  await browser.tap('KeyR');
  check('R safely recovers the on-foot player', !(await snapshot()).paused && !(await snapshot()).player.inVehicle);
  await browser.screenshot('verification/on-foot-tested.jpg', 'jpeg');

  // Sixty real wall-clock seconds of keyboard-controlled driving on normal roads.
  await navigate('?shot=chase&seed=20261121');
  const chaseStart = await snapshot();
  check('Cover starts in a live three-star pursuit with three patrols and a helicopter', chaseStart.frozen
    && chaseStart.police.level === 3 && chaseStart.police.units.length === 3 && chaseStart.police.helicopter);
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
  check('Screenshot scenario resumes under normal keys', !performanceState.frozen && performanceState.tick > 91);
  check('60-second drive has no stalls trapping input', travelled > 350 && performanceState.performance.samples > 60);
  check('60-second drive stays intact', performanceState.car.condition > 70);
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
