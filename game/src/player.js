import { PLAYER_TUNING as P, angleDelta, damp } from './config.js';
import { isSpaceClear, moveBodyWithCollisions } from './collision.js';
import { findSafeSpawn, isDryLand, showWorldMessage } from './world.js';

export function createOnFootPlayer() {
  return { x: 95.5, z: 29, previousX: 95.5, previousZ: 29, heading: 0, speed: 0, vx: 0, vz: 0,
    inVehicle: false, walkPhase: 0, health: 100 };
}

export function updateOnFootPlayer(player, actions, cameraHeading, world, car, dt) {
  player.previousX = player.x; player.previousZ = player.z;
  if (player.inVehicle) {
    player.x = car.x; player.z = car.z; player.heading = car.heading; player.speed = 0;
    return;
  }
  let x = Math.sin(cameraHeading) * actions.forward + Math.cos(cameraHeading) * actions.right;
  let z = -Math.cos(cameraHeading) * actions.forward + Math.sin(cameraHeading) * actions.right;
  const length = Math.hypot(x, z);
  const speed = actions.sprint ? P.sprint : P.walk;
  if (length) { x = x / length * speed; z = z / length * speed; }
  player.vx = damp(player.vx, x, 14, dt); player.vz = damp(player.vz, z, 14, dt);
  player.speed = Math.hypot(player.vx, player.vz);
  moveBodyWithCollisions(world.grid, player, player.vx * dt, player.vz * dt, P.radius);
  // The same parked/abandoned car stays solid to the walking player.
  const dx = player.x - car.x, dz = player.z - car.z;
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  let lx = dx * c + dz * s, lz = -dx * s + dz * c;
  const qx = Math.max(-1.05, Math.min(1.05, lx)), qz = Math.max(-2.3, Math.min(2.3, lz));
  const d = Math.hypot(lx - qx, lz - qz);
  if (d < P.radius) {
    if (d > 0.001) { lx += (lx - qx) * (P.radius - d) / d; lz += (lz - qz) * (P.radius - d) / d; }
    else lx = Math.sign(lx || 1) * (1.05 + P.radius);
    player.x = car.x + lx * c - lz * s; player.z = car.z + lx * s + lz * c;
  }
  if (player.speed > 0.2) player.heading += angleDelta(player.heading, Math.atan2(player.vx, -player.vz)) * (1 - Math.exp(-14 * dt));
  player.walkPhase += player.speed * dt * 2.4;
  if (!isDryLand(player.x, player.z)) {
    Object.assign(player, findSafeSpawn(world, player.x, player.z));
    player.previousX = player.x; player.previousZ = player.z;
    showWorldMessage(world, 'Deep water. Back to the nearest street.');
  }
}

export function enterOrStealVehicle(player, car, world) {
  if (Math.hypot(player.x - car.x, player.z - car.z) > P.enterDistance) {
    showWorldMessage(world, 'Move closer to the Driftline to get in.'); return false;
  }
  player.inVehicle = true; player.vx = 0; player.vz = 0;
  player.x = car.x; player.z = car.z; player.previousX = car.x; player.previousZ = car.z;
  showWorldMessage(world, 'Driftline GT. W to go. Space to let the rear end argue.', 4);
  return true;
}

export function exitVehicleSafely(player, car, world) {
  if (car.speed > 3) { showWorldMessage(world, 'Slow below 11 km/h to step out.'); return false; }
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  for (const side of [-1, 1]) {
    const x = car.x + c * side * 2.05, z = car.z + s * side * 2.05;
    if (isDryLand(x, z) && isSpaceClear(world.grid, x, z, P.radius + 0.1)) {
      Object.assign(player, { inVehicle: false, x, z, previousX: x, previousZ: z, heading: car.heading, vx: 0, vz: 0 });
      showWorldMessage(world, 'On foot. Your car stays where you leave it.'); return true;
    }
  }
  showWorldMessage(world, 'Both doors are blocked. Move the car into the open.'); return false;
}
