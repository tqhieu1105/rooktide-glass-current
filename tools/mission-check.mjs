import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { STEP } from '../game/src/config.js';
import { createRooktideCity, isDryLand } from '../game/src/world.js';
import { isSpaceClear } from '../game/src/collision.js';
import { createVehicle, recoverVehicle, stepArcadeDriving } from '../game/src/vehicles.js';
import { createOnFootPlayer, updateOnFootPlayer } from '../game/src/player.js';
import { createPoliceSystem } from '../game/src/police.js';
import { createPopulation } from '../game/src/population.js';
import { createMissionSystem } from '../game/src/missions.js';
import { createCombatSystem } from '../game/src/combat.js';
import { GARAGE, MISSIONS } from '../game/src/mission-data.js';
import { findWaypointRoute } from '../game/src/roads.js';

// Use fixed-step fixtures between encounters. Each encounter still uses the
// same controls and actors as the page, including real collision and police timers.
const world = createRooktideCity(), player = createOnFootPlayer(), firstCar = createVehicle();
let car = firstCar, aim = 0;
const storage = new Map();
const police = createPoliceSystem(world, player, () => car);
const population = createPopulation(world, firstCar);
world.population = population; world.police = police;
let missions, combat;
function createCampaign() {
  missions = createMissionSystem({ world, player, police, population, getCar: () => car,
    setCar: vehicle => { car = vehicle; }, storage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } });
  combat = createCombatSystem({ world, player, police, population, missions, getCar: () => car });
  missions.attachCombat(combat);
  return missions;
}
createCampaign();
const state = () => missions.snapshot();
const tested = [], pursuits = [];
const check = (name, condition) => { assert.ok(condition, name); tested.push(name); };
const place = (body, x, z, heading = 0) => Object.assign(body, { x, z, previousX: x, previousZ: z, heading, vx: 0, vz: 0, speed: 0 });
function foot(x, z, heading = 0) { place(player, x, z, heading); player.inVehicle = false; }
function driving(x, z, heading = 0) { place(player, x, z, heading); place(car, x, z, heading); player.inVehicle = true; }
function tick(count = 1, input = {}) {
  const actions = { forward: 0, right: 0, ...input };
  for (let i = 0; i < count; i++) {
    stepArcadeDriving(car, actions, world, STEP, player.inVehicle);
    updateOnFootPlayer(player, actions, aim, world, car, STEP);
    world.clock += STEP; world.tick++;
    population.step(player, car, { heading: aim }, STEP);
    police.step(STEP, actions);
    combat.step(STEP, actions, aim);
    missions.step(STEP, actions, aim);
  }
}
function start(job) {
  foot(job.giver.x, job.giver.z);
  assert.ok(missions.interact());
  assert.equal(state().id, job.id);
  assert.equal(state().index, 0);
}
function enterMarked() {
  const target = missions.vehicle;
  foot(target.x + 2, target.z);
  assert.ok(missions.interact());
  assert.equal(car, target);
}
function escape(level, x, z) {
  assert.equal(police.wanted.level, level);
  const expected = police.snapshot().escapeSeconds;
  const elapsedBefore = police.wanted.unseen;
  driving(x, z);
  let ticks = 0;
  while (police.wanted.level && ticks < expected * 60 + 6) { tick(); ticks++; }
  check(`Mission heat ${level} clears only after its ${expected}s RCP window`, Math.abs(elapsedBefore + ticks / 60 - expected) < .07 && !police.wanted.level);
  pursuits.push({ level, seconds: Math.round((elapsedBefore + ticks / 60) * 100) / 100 });
}
function deliver() {
  const index = state().index;
  for (let limit = 0; limit < 7 && state().active && state().index === index; limit++) {
    const { point, seconds } = state();
    driving(point.x, point.z);
    tick(Math.ceil(seconds * 60) + 1);
  }
  assert.ok(!state().active || state().index !== index);
}
function collect() {
  const { point } = state(); foot(point.x, point.z);
  assert.ok(missions.interact());
}

for (const job of MISSIONS) {
  const points = [job.giver, job.vehicle, job.courier, ...(job.courierRoute || []), ...job.stages.flatMap(stage =>
    [stage.point, ...(stage.route || []), ...(stage.drops || []), ...(stage.guards || []).map(([x, z]) => ({ x, z }))])];
  assert.ok(points.filter(p => typeof p?.x === 'number').every(p => isDryLand(p.x, p.z) && isSpaceClear(world.grid, p.x, p.z, 2.2)), job.title);
}
check('All static contacts, stage points, route gates, cars and guards sit on clear ground', true);
check('Minimap routes across the bridge using the street graph', findWaypointRoute(world.roads, { x: 559, z: -272 }, { x: 250, z: -240 })
  .some(point => point.x === 420 && point.z === -240));

start(MISSIONS[0]);
foot(missions.vehicle.x + 2, missions.vehicle.z);
check('A locked job car cannot skip the on-foot lot stage', !missions.interact() && state().index === 0);
foot(state().point.x, state().point.z); tick();
enterMarked();
assert.equal(police.wanted.level, 1);
recoverVehicle(car, world); tick();
check('A wreck fails the job and retry restores the pre-theft checkpoint', state().failed.includes('wrecked') && missions.retry()
  && state().index === 1 && !player.inVehicle && missions.vehicle.condition === 100 && police.wanted.level === 0);
enterMarked(); escape(1, -497, 414); deliver();
check('Borrowed Voltage pays once and unlocks working repairs', state().done === 1 && state().cash === 950 && state().rp === 100);
driving(GARAGE.x, GARAGE.z); car.condition = 58;
assert.ok(missions.interact());
assert.equal(car.condition, 100); assert.equal(state().cash, 800);

start(MISSIONS[1]);
foot(state().point.x, state().point.z); tick();
foot(state().point.x, state().point.z);
check('The ledger stays guarded until the actual fight is won', state().guardCount === 2 && !missions.interact());
for (const guard of missions.guards) {
  foot(guard.x, guard.z + 2.2); tick(60, { attack: true });
}
check('Fists clear the warehouse guards through the combat controller', state().guardCount === 0);
collect(); enterMarked();
check('The hot van cannot finish delivery while wanted', state().index === 3 && police.wanted.level === 2);
escape(2, -498, -426); deliver();
assert.equal(state().done, 2);
tick(1, { scan: true });
check('The Quiet Ledger grants its payout, pistol and timed patrol scan', state().cash === 1900 && state().rp === 250 && state().scan === 10);

start(MISSIONS[2]); deliver();
const courierStart = state().point;
driving(-493, 403); tick(29 * 60);
check('The courier drives its own route and the range timer leaves time to catch up', state().lost > 28 && !state().failed
  && Math.hypot(state().point.x - courierStart.x, state().point.z - courierStart.z) > 70);
tick(65);
check('Missing the courier for 30 seconds fails and resets its route at retry', !!state().failed && missions.retry()
  && state().index === 1 && Math.hypot(state().point.x - courierStart.x, state().point.z - courierStart.z) < .1);
const target = population.vehicles.find(vehicle => vehicle.id === 'split-invoice-courier');
for (let i = 0; i < 2 && state().index === 1; i++) {
  driving(target.x, target.z + 4.8, 0); car.vz = -27; car.speed = 27; car.impactCooldown = 0;
  tick(10, { forward: 1 });
}
check('Real controlled car contacts disable the courier and expose its fragment', state().index === 2 && target.condition === 0 && population.snapshot().impacts > 0);
collect(); deliver();
check('Split Invoice uses a concrete changing drop and pays its reward', state().done === 3 && state().cash === 3300 && state().rp === 450);

start(MISSIONS[3]); enterMarked();
check('Seawall Dividend summons the existing helicopter system at three stars', police.wanted.level === 3 && police.helicopter.active);
deliver(); escape(3, -496, 419); deliver();
assert.equal(state().done, 4);

start(MISSIONS[4]); foot(state().point.x, state().point.z); tick();
const upload = state().point;
for (const guard of missions.guards) {
  foot(guard.x, guard.z + 8); aim = 0; tick(26, { attack: true, weapon: 2 });
}
check('Unlocked pistol can stop the upload guards and consumes rounds', state().guardCount === 0 && state().rounds < 12);
foot(upload.x + 30, upload.z); tick(60);
const held = state().held;
foot(upload.x, upload.z); tick(Math.floor((29.8 - held) * 60));
check('Dead Channel requires 30 seconds inside the live upload zone', state().index === 1 && state().held >= 29 && state().held < 30);
tick(20); enterMarked(); escape(4, 444, 402); deliver();
assert.equal(state().done, 5);

start(MISSIONS[5]); collect();
check('The finale places a real RCP blockade on the bridge', police.wanted.level === 4
  && police.roadblocks.some(block => block.x === 499 && block.segments.every(segment => segment.box.kind === 'roadblock')));
enterMarked();
driving(541, -245.6, -Math.PI / 2);
const bridgeCondition = car.condition;
for (let i = 0; i < 900 && state().index === 1; i++) tick(1, { forward: car.speed < 12 ? 1 : 0 });
check('Driving the bridge gap clears both gates without recovery or collision damage', state().index === 2 && car.condition === bridgeCondition && car.recoveries === 0);
driving(state().point.x, state().point.z); tick(260);
assert.equal(state().gate, 0);
car.vx = 5; tick(30);
check('Driving interrupts the five-second transfer', state().held < 1 && state().gate === 0);
deliver();
assert.equal(state().index, 3);
deliverUntilLast();
check('Final delivery blocks while RCP still has heat', state().active && state().index === 3 && police.wanted.level > 0);
escape(4, -498, 413); deliver();
check('The ending pays the sixth mission and opens free roam', state().ending && !state().active && state().done === 6
  && state().cash === 10300 && state().rp === 1400 && state().rank === 'Current');
missions.dismissEnding();
check('Campaign progress and cash survive recreating the runtime', createCampaign().snapshot().done === 6 && createCampaign().snapshot().cash === 10300);
assert.ok(missions.chooseReplay(MISSIONS[0].id));
start(MISSIONS[0]); foot(state().point.x, state().point.z); tick(); enterMarked(); escape(1, -497, 414); deliver();
check('A full replay does not mint a second payout or re-lock free roam', state().payout.cash === 0 && state().cash === 10300 && !state().active && !state().ending);

function deliverUntilLast() {
  for (let i = 0; i < 3; i++) {
    const { point, seconds } = state(); driving(point.x, point.z); tick(Math.ceil(seconds * 60) + 1);
  }
}

const result = { checks: tested, pursuits, final: { done: state().done, cash: state().cash, rp: state().rp },
  method: 'Fixed-step coverage with encounter positions staged between segments. Not a timed uninterrupted playthrough.' };
await writeFile('verification/missions.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
