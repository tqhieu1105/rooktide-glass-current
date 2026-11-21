import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { openChromium, delay } from './browser.mjs';

const browser = await openChromium();
const errors = [], held = new Set();
browser.on('Runtime.exceptionThrown', e => errors.push(e.exceptionDetails));
browser.on('Runtime.consoleAPICalled', e => { if (e.type === 'error') errors.push(e.args); });
const snapshot = () => browser.evaluate('window.__rooktide.snapshot()');
async function keys(wanted) {
  for (const code of held) if (!wanted.includes(code)) { await browser.key(code, false); held.delete(code); }
  for (const code of wanted) if (!held.has(code)) { await browser.key(code); held.add(code); }
}
async function fresh() {
  await keys([]);
  await browser.send('Page.navigate', { url: 'http://127.0.0.1:8080/' });
  await browser.waitFor('window.__gameReady || window.__renderFailed');
  assert.ok(!await browser.evaluate('!!window.__renderFailed'));
  await browser.tap('KeyE');
  assert.ok((await snapshot()).player.inVehicle);
}
function steer(state, point, cornerSpeed = 6) {
  const c = state.car, [x, z] = point;
  const distance = Math.hypot(x - c.x, z - c.z);
  const wanted = Math.atan2(x - c.x, -(z - c.z));
  const error = Math.atan2(Math.sin(wanted - c.heading), Math.cos(wanted - c.heading));
  const target = Math.abs(error) > 0.18 || distance < 32 ? cornerSpeed : 22;
  const result = [];
  if (c.speed < target - 0.6) result.push('KeyW');
  if (c.speed > target + 1) result.push('KeyS');
  if (error > 0.035) result.push('KeyD');
  if (error < -0.035) result.push('KeyA');
  return { distance, result };
}
try {
  await fresh();
  const impactStart = performance.now();
  let impact;
  while (performance.now() - impactStart < 30000) {
    impact = await snapshot();
    if (impact.staticImpacts > 0) break;
    await keys(steer(impact, [125, -34.5], 10).result);
    await delay(100);
  }
  await keys([]);
  assert.ok(impact.staticImpacts > 0 && impact.car.condition < 100 && impact.car.x < 145, 'A real keyboard-driven building impact rebounds without tunneling');
  await browser.screenshot('verification/building-impact.jpg', 'jpeg');
  console.log(`Building impact passed: x=${impact.car.x.toFixed(1)}, z=${impact.car.z.toFixed(1)}, condition=${impact.car.condition.toFixed(1)}`);

  await fresh();
  const route = [[91.5, 0], [420, 0], [420, 360], [-420, 360], [-420, -360],
    [420, -360], [420, -240], [560, -240], [420, -240], [84, -240], [84, 0], [420, 0]];
  const samples = [], start = performance.now();
  let index = 0, previous = await snapshot(), previousTime = start;
  let travelled = 0, minimumCondition = 100;
  while (index < route.length && performance.now() - start < 600000) {
    const state = await snapshot(), now = performance.now();
    assert.ok(!state.paused && state.player.inVehicle, 'Loop remains controlled in normal play');
    const distance = Math.hypot(state.car.x - previous.car.x, state.car.z - previous.car.z);
    assert.ok(distance < 44 * (now - previousTime) / 1000 + 5, 'No recovery teleport');
    assert.ok(state.car.condition <= previous.car.condition, 'No hidden wreck/water recovery');
    travelled += distance; minimumCondition = Math.min(minimumCondition, state.car.condition);
    const control = steer(state, route[index]);
    samples.push({ seconds: Math.round((now - start) / 1000), waypoint: index,
      x: Math.round(state.car.x * 10) / 10, z: Math.round(state.car.z * 10) / 10,
      district: state.district, condition: state.car.condition });
    if (control.distance < 7) {
      console.log(`Waypoint ${index + 1}/${route.length}: ${state.district}, ${state.visited.length}/6 discovered, bodywork ${state.car.condition.toFixed(1)}`);
      index++;
    } else await keys(control.result);
    previous = state; previousTime = now;
    await delay(120);
  }
  await keys(['Space']); await delay(1400); await keys([]);
  const end = await snapshot();
  const report = { complete: index === route.length, seconds: Math.round((performance.now() - start) / 1000),
    travelledMetres: Math.round(travelled), minimumCondition, errors, impact: impact.car,
    final: end, route, samples };
  await writeFile('verification/browser-loop.json', JSON.stringify(report, null, 2) + '\n');
  await browser.screenshot('verification/loop-complete.jpg', 'jpeg');
  assert.equal(index, route.length, 'All twelve live browser waypoints complete');
  assert.equal(end.visited.length, 6, 'All six districts visited through normal keyboard controls');
  assert.ok(minimumCondition > 70, 'No repeated collision trap on the connected route');
  assert.equal(errors.length, 0, 'Zero browser errors during the complete loop');
  console.log(JSON.stringify({ complete: report.complete, seconds: report.seconds, travelledMetres: report.travelledMetres,
    visited: end.visited, minimumCondition, errors }, null, 2));
} finally { await browser.close(); }
