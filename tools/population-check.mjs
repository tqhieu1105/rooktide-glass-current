import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openChromium, delay } from './browser.mjs';
import { createPopulation } from '../game/src/population.js';
import { createRooktideCity, isDryLand } from '../game/src/world.js';
import { createVehicle } from '../game/src/vehicles.js';
import { createOnFootPlayer } from '../game/src/player.js';
import { isSpaceClear } from '../game/src/collision.js';
import { STEP } from '../game/src/config.js';

function checkStationarySimulation(quality, seconds) {
  const world = createRooktideCity(), car = createVehicle(), player = createOnFootPlayer();
  const population = createPopulation(world, car), camera = { heading: 0 };
  population.setQuality(quality);
  population.seedNear(player);
  let firstTraffic = null;
  for (let i = 0; i < seconds * 60; i++) {
    world.clock += STEP; world.tick++;
    population.step(player, car, camera, STEP);
    for (const p of population.people) if (p.active) {
      assert.ok(isDryLand(p.x, p.z) && isSpaceClear(world.grid, p.x, p.z, .10), 'Walker stays out of water and walls');
    }
    for (const c of population.cars) if (c.active) {
      assert.ok(isDryLand(c.x, c.z) && isSpaceClear(world.grid, c.x, c.z, .5), 'Traffic stays on dry, clear routes');
      if (!c.parked && c.speed > 1 && c.z < player.z && Math.hypot(c.x - player.x, c.z - player.z) < 70) firstTraffic ??= i * STEP;
    }
  }
  const { cars, parked, walkers, crossings } = population.snapshot();
  assert.deepEqual([cars, parked, walkers], quality === 'low' ? [14, 4, 24] : [26, 8, 48]);
  assert.ok(crossings > 8 && firstTraffic !== null && firstTraffic < 10, 'Traffic arrives and continues through intersections');
  return { seconds, cars, parked, walkers, crossings, firstTraffic };
}

const low = checkStationarySimulation('low', 120);
const high = checkStationarySimulation('high', 120);
const browser = await openChromium();
const snapshot = () => browser.evaluate('window.__rooktide.snapshot()');
const held = new Set(), errors = [];
browser.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails));
browser.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') errors.push(e.args); });
async function keys(wanted) {
  for (const code of held) if (!wanted.includes(code)) { await browser.key(code, false); held.delete(code); }
  for (const code of wanted) if (!held.has(code)) { await browser.key(code); held.add(code); }
}
async function walkTo(x, z, tolerance = 1.6) {
  const until = Date.now() + 18000;
  while (Date.now() < until) {
    const { player } = await snapshot();
    const dx = x - player.x, dz = z - player.z;
    if (Math.hypot(dx, dz) < tolerance) { await keys([]); return; }
    const wanted = ['ShiftLeft'];
    if (Math.abs(dx) > .75) wanted.push(dx < 0 ? 'KeyA' : 'KeyD');
    if (Math.abs(dz) > .75) wanted.push(dz < 0 ? 'KeyW' : 'KeyS');
    await keys(wanted); await delay(90);
  }
  throw new Error(`Could not walk to (${x}, ${z}) on ordinary controls`);
}
try {
  await browser.send('Page.navigate', { url: 'http://127.0.0.1:8080/?seed=20261121' });
  await browser.waitFor('window.__gameReady || window.__renderFailed');
  assert.ok(!await browser.evaluate('!!window.__renderFailed'));
  await browser.startNewGame();
  const initial = await snapshot();
  assert.ok(initial.population.cars === 14 && initial.population.walkers === 24);
  const stationaryStart = Date.now();
  await delay(120000);
  const stationary = await snapshot();
  assert.ok(stationary.population.crossings > 10 && stationary.population.walkers >= 20, 'Traffic and walkers remain active after two real minutes');
  const stationarySeconds = (Date.now() - stationaryStart) / 1000;
  await browser.tap('KeyE');
  assert.ok((await snapshot()).player.inVehicle);
  await browser.tap('KeyE');
  assert.ok(!(await snapshot()).player.inVehicle);
  const target = stationary.population.vehicles.find(v => v.id === 'civilian-1' && v.parked && !v.claimed);
  assert.ok(target, 'Market curb has a parked theft target');
  await walkTo(91, target.z);
  await walkTo(target.x, target.z, 3.3);
  await browser.tap('KeyE');
  const stolen = await snapshot();
  assert.ok(stolen.player.inVehicle && stolen.car.id === target.id, 'Walk and E take a second car');
  assert.ok(stolen.population.vehicles.some(v => v.id === initial.car.id && Math.hypot(v.x - initial.car.x, v.z - initial.car.z) < 1),
    'Abandoned first vehicle remains at its original spot');
  assert.equal(stolen.population.thefts, 1);
  assert.equal(errors.length, 0);
  const report = { low, high, live: { stationarySeconds, crossings: stationary.population.crossings,
    carStolen: stolen.car.id, firstCarStillPresent: initial.car.id, witnessed: stolen.population.lastWitness, errors } };
  await writeFile('verification/population.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
