import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { isSpaceClear } from '../game/src/collision.js';
import { STEP } from '../game/src/config.js';
import { createPoliceSystem, hasPoliceSight } from '../game/src/police.js';
import { createPopulation } from '../game/src/population.js';
import { createOnFootPlayer, enterOrStealVehicle } from '../game/src/player.js';
import { createVehicle, stepArcadeDriving } from '../game/src/vehicles.js';
import { createRooktideCity, isDryLand } from '../game/src/world.js';

const world = createRooktideCity();
const player = createOnFootPlayer();
let car = createVehicle();
const police = createPoliceSystem(world, player, () => car);
const dash = { forward: 1, right: 0, handbrake: false };
function tick(seconds, actions = {}) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) { world.clock += STEP; police.step(STEP, actions); }
}
function park(x, z) {
  Object.assign(car, { x, z, heading: 0, vx: 0, vz: 0 });
  Object.assign(player, { x: x + 3, z, inVehicle: false });
  assert.ok(enterOrStealVehicle(player, car, world));
}

const population = createPopulation(world, car, (...incident) => police.reportCrime(...incident));
const target = population.cars[0], witness = population.people[0];
Object.assign(target, { x: 89, z: 64, active: true });
Object.assign(player, { x: 92, z: 64 });
assert.equal(population.findEnterable(player), target);
assert.ok(enterOrStealVehicle(player, target, world));
car = target;
population.claim(car);
assert.equal(police.wanted.level, 0, 'Unwitnessed theft gives no stars');
const second = population.cars[1];
Object.assign(second, { x: 90, z: 90, active: true });
Object.assign(witness, { x: 96, z: 92, active: true });
Object.assign(player, { x: 93, z: 90, inVehicle: false });
assert.equal(population.findEnterable(player), second);
assert.ok(enterOrStealVehicle(player, second, world));
car = second;
population.claim(car);
assert.equal(police.wanted.level, 1, 'Population witness reports stolen vehicle');
const dispatched = police.snapshot().units[0];
assert.ok(dispatched.distance >= 100 && dispatched.distance <= 180 && isDryLand(dispatched.x, dispatched.z));
assert.ok(population.vehicles[0].active, 'Original car stays in the city');
const states = new Set();
for (let i = 0; i < 600 && !states.has('pursuit'); i++) { tick(STEP); states.add(police.wanted.state); }
assert.ok(states.has('pursuit'), 'The dispatched patrol actually reaches sight range');

// Move to an adjoining back street with a warehouse between the player and patrol.
park(252, 320);
const warehouse = world.buildings.filter(h => h.district === 'quay').sort((a, b) => b.height - a.height)[0];
const roofWest = { x: warehouse.x - warehouse.width / 2 - 3, z: warehouse.z };
const roofEast = { x: warehouse.x + warehouse.width / 2 + 3, z: warehouse.z };
assert.ok(!hasPoliceSight(world, roofWest, roofEast, 1.6), 'Warehouse blocks the ground patrol');
assert.ok(!hasPoliceSight(world, roofWest, roofEast, 23), 'The warehouse also blocks a low aerial sightline');
tick(2);
assert.equal(police.wanted.state, 'search');
assert.ok(police.wanted.searchRadius > 30);
assert.ok(!police.wanted.seen);
tick(8.1);
assert.equal(police.wanted.level, 0, 'Ten seconds out of sight clears one star');
police.reset();

park(426, 96);
const levels = [];
for (let level = 1; level <= 5; level++) {
  assert.ok(police.reportCrime('vehicle_theft'));
  tick(0.4);
  assert.equal(police.wanted.level, level);
  assert.equal(police.helicopter.active, level >= 3);
  assert.ok(police.snapshot().units.length <= level);
  levels.push({ level, patrols: police.snapshot().units.length, helicopter: police.helicopter.active });
}
police.reset();
police.restorePursuit(2, [[426, 109, 0, 15], [415, 165, 0, 12]]);
let warned = false, damaged = false;
for (let i = 0; i < 140; i++) {
  tick(STEP);
  warned ||= police.units[0].ramTell > 0;
  damaged ||= police.units[0].condition < 100 && car.condition < 100;
}
assert.ok(warned && damaged, 'A ramming tell precedes a collision that damages both cars');

police.reset();
park(426, 96);
police.restorePursuit(4, [[426, 119, 0, 13]]);
tick(0.1);
assert.equal(police.roadblocks.length, 1);
const block = police.roadblocks[0], barrier = block.segments[0];
assert.ok(!isSpaceClear(world.grid, barrier.x, barrier.z, 0.9));
const gapX = block.x + block.nx * 5.6, gapZ = block.z + block.nz * 5.6;
assert.ok(isSpaceClear(world.grid, gapX, gapZ, 1.1));
let blocked = false;
for (const [x, z, shouldHit] of [[barrier.x, barrier.z, true], [gapX, gapZ, false]]) {
  const vehicle = createVehicle(x - block.ux * 14, z - block.uz * 14);
  vehicle.heading = Math.atan2(block.ux, -block.uz);
  const previousImpacts = world.staticImpacts;
  for (let i = 0; i < 125; i++) stepArcadeDriving(vehicle, dash, world, STEP, true);
  const hit = world.staticImpacts > previousImpacts;
  assert.equal(hit, shouldHit, 'Normal controller sees solid barricades and a drivable gap');
  if (!shouldHit) assert.ok((vehicle.x - x) * block.ux + (vehicle.z - z) * block.uz > 4);
  else blocked = hit;
}
police.reset();
assert.ok(isSpaceClear(world.grid, barrier.x, barrier.z, 0.9), 'Disengaging removes the collider');

park(426, 96);
Object.assign(car, { condition: 100, speed: 24 });
police.restorePursuit(1, [[426, 99, 0, 20]]);
tick(2.2, dash);
assert.equal(police.wanted.outcome, '', 'Proximity cannot bust a driver at speed');
car.speed = 0;
Object.assign(police.units[0], { x: 426, z: 100, speed: 0, heading: 0 });
tick(2.2, { handbrake: true });
assert.equal(police.wanted.outcome, 'busted');
police.reset();
assert.equal(police.wanted.outcome, '');
assert.equal(police.wanted.level, 0);
const report = { witnessedTheft: true, dispatchedMetres: Math.round(dispatched.distance), responded: true,
  lineOfSightOccluded: true, oneStarEscapeSeconds: 10, levels, rammingWarningAndContact: warned && damaged,
  barricadeCollides: blocked, gapDrivable: true, barricadeRemoved: true, surrenderAndReset: true };
writeFileSync('verification/police.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
