import assert from 'node:assert/strict';
import { createRooktideCity, getDistrictAt, isDryLand } from '../game/src/world.js';
import { createOnFootPlayer, updateOnFootPlayer, enterOrStealVehicle, exitVehicleSafely } from '../game/src/player.js';
import { createVehicle, stepArcadeDriving } from '../game/src/vehicles.js';
import { buildCollisionGrid, isSpaceClear } from '../game/src/collision.js';
import { STEP, angleDelta, clamp } from '../game/src/config.js';

export const blank = { forward: 0, right: 0, sprint: false, handbrake: false };

export function runSimulationChecks() {
  const world = createRooktideCity();
  const car = createVehicle(), player = createOnFootPlayer();
  assert.equal(world.buildings.length, 172);
  const connected = new Set([0]), queue = [0];
  while (queue.length) for (const id of world.roads.nodes[queue.shift()].links) {
    if (!connected.has(id)) { connected.add(id); queue.push(id); }
  }
  assert.equal(connected.size, world.roads.nodes.length, 'Road graph includes the connected island');
  const before = player.z;
  for (let i = 0; i < 60; i++) updateOnFootPlayer(player, { ...blank, forward: 1 }, 0, world, car, STEP);
  const walked = before - player.z;
  for (let i = 0; i < 60; i++) updateOnFootPlayer(player, { ...blank, forward: -1 }, 0, world, car, STEP);
  assert.ok(walked > 3.5, 'Walk moves the articulated player');
  assert.ok(enterOrStealVehicle(player, car, world), 'The original nearby car is enterable');
  for (let i = 0; i < 120; i++) stepArcadeDriving(car, { ...blank, forward: 1 }, world, STEP, true);
  const accelerated = car.speed;
  assert.ok(accelerated > 20);
  assert.equal(exitVehicleSafely(player, car, world), false, 'Moving exits are refused');
  for (let i = 0; i < 65; i++) stepArcadeDriving(car, { ...blank, forward: -1 }, world, STEP, true);
  assert.ok(car.speed < 2, 'Service brake stops the car');
  assert.ok(exitVehicleSafely(player, car, world));
  assert.equal(car.id, 'driftline-01', 'Entry/exit preserves vehicle identity');
  assert.ok(!player.inVehicle && Math.hypot(player.x - car.x, player.z - car.z) > 1.7);

  const blocked = { ...world, grid: buildCollisionGrid([-1, 1].map(side => ({
    minX: car.x + side * 2.05 - 0.6, maxX: car.x + side * 2.05 + 0.6,
    minZ: car.z - 1, maxZ: car.z + 1, height: 3,
  }))) };
  player.inVehicle = true; car.speed = 0;
  assert.equal(exitVehicleSafely(player, car, blocked), false, 'Two obstructed doors refuse exit');

  const brakingCars = [createVehicle(420, 60), createVehicle(420, 60)];
  for (const c of brakingCars) { c.vz = -20; c.speed = 20; }
  for (let i = 0; i < 45; i++) {
    stepArcadeDriving(brakingCars[0], blank, world, STEP, true);
    stepArcadeDriving(brakingCars[1], { ...blank, handbrake: true }, world, STEP, true);
  }
  assert.ok(brakingCars[1].speed < brakingCars[0].speed - 5, 'Handbrake changes real velocity');

  const impact = createVehicle(252, 34.5); impact.heading = Math.PI / 2;
  let impactTick = 0;
  while (impact.condition === 100 && impactTick++ < 300) stepArcadeDriving(impact, { ...blank, forward: 1 }, world, STEP, true);
  assert.ok(impact.condition < 100 && impact.x < 290, 'High-speed building collision does not tunnel');
  const impactReport = { tick: impactTick, x: impact.x, condition: impact.condition, reboundSpeed: impact.speed };

  // A continuous drive with the production controller, no teleports or collision bypass.
  const route = [[91.5, 0], [420, 0], [420, 360], [-420, 360], [-420, -360],
    [420, -360], [420, -240], [560, -240], [420, -240], [84, -240], [84, 0], [420, 0]];
  function driveLoop() {
    const w = createRooktideCity(), c = createVehicle(), p = createOnFootPlayer();
    assert.ok(enterOrStealVehicle(p, c, w));
    const visited = new Set([getDistrictAt(c.x, c.z).id]);
    let index = 0, tick = 0, distance = 0, minCondition = 100;
    while (index < route.length && tick++ < 120000) {
      const [x, z] = route[index], dx = x - c.x, dz = z - c.z, range = Math.hypot(dx, dz);
      if (range < 6) { index++; continue; }
      const error = angleDelta(c.heading, Math.atan2(dx, -dz));
      const target = Math.abs(error) > 0.25 || range < 30 ? 6 : 23;
      const forward = c.vx * Math.sin(c.heading) - c.vz * Math.cos(c.heading);
      const oldX = c.x, oldZ = c.z;
      stepArcadeDriving(c, { ...blank, forward: clamp((target - forward) * 0.8, -1, 1), right: clamp(error * 2.8, -1, 1) }, w, STEP, true);
      updateOnFootPlayer(p, blank, c.heading, w, c, STEP);
      const travel = Math.hypot(c.x - oldX, c.z - oldZ);
      assert.ok(travel < 1, 'No recovery teleport conceals a blocked route');
      distance += travel;
      minCondition = Math.min(minCondition, c.condition);
      visited.add(getDistrictAt(c.x, c.z).id);
      assert.ok(isDryLand(c.x, c.z), 'Loop stays on connected drivable land');
      assert.ok(isSpaceClear(w.grid, c.x, c.z, 0.91), 'Loop stays outside static walls');
    }
    assert.equal(index, route.length, 'Drive completes all boulevard/market/quay/yard/heights/bridge waypoints');
    assert.equal(visited.size, 6, 'Drive discovers all six districts');
    assert.ok(minCondition > 90, 'Loop completes with at most a minor turnaround scrape');
    return { ticks: tick, seconds: tick / 60, metres: Math.round(distance), visited: [...visited], minCondition, x: c.x, z: c.z };
  }
  const loop = driveLoop();
  assert.deepEqual(driveLoop(), loop, 'Seeded fixed-step drive is deterministic');
  return { walkMetres: walked, accelerationKmh: accelerated * 3.6,
    handbrakeSpeed: brakingCars[1].speed, coastingSpeed: brakingCars[0].speed, impact: impactReport, loop };
}

if (process.argv[1]?.endsWith('simulation-checks.mjs')) console.log(JSON.stringify(runSimulationChecks(), null, 2));
