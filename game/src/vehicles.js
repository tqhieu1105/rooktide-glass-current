import { VEHICLE_TUNING, clamp, damp } from './config.js';
import { moveBodyWithCollisions } from './collision.js';
import { findSafeSpawn, isDryLand, showWorldMessage } from './world.js';

export function createVehicle(x = 91.5, z = 29) {
  return { id: 'driftline-01', type: 'sports', x, z, previousX: x, previousZ: z,
    heading: 0, vx: 0, vz: 0, speed: 0, steer: 0, wheelSpin: 0,
    condition: 100, recoveries: 0, impactCooldown: 0, roll: 0, pitch: 0, bounce: 0, bounceVelocity: 0, braking: false,
    destroying: false, destroyed: false, damageFuse: 0, explosionTimer: 0, explosionSpin: 0, combatSmoke: false, combatFire: false };
}

export function stepArcadeDriving(car, actions, world, dt, controlled) {
  const tuning = VEHICLE_TUNING[car.type];
  car.previousX = car.x; car.previousZ = car.z;
  car.impactCooldown = Math.max(0, car.impactCooldown - dt);
  if (car.destroyed && car.explosionTimer > 0) car.heading += car.explosionSpin * dt;
  const fx = Math.sin(car.heading), fz = -Math.cos(car.heading);
  const rx = Math.cos(car.heading), rz = Math.sin(car.heading);
  let forward = car.vx * fx + car.vz * fz;
  let lateral = car.vx * rx + car.vz * rz;
  const throttle = controlled ? actions.forward : 0;
  const handbrake = controlled && !car.destroyed && actions.handbrake;
  const braking = throttle < 0 && forward > 0.8 || throttle > 0 && forward < -0.8;
  const acceleration = braking ? 23 : tuning.acceleration;
  forward += (car.destroyed ? 0 : throttle) * acceleration * dt;
  const drag = (throttle ? 0.20 : 0.85) + 0.003 * forward * forward + (handbrake ? 8.5 : 0);
  forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
  if (!controlled) forward *= Math.exp(-1.8 * dt);
  forward = clamp(forward, -11, tuning.max);
  lateral *= Math.exp(-(handbrake ? 1.4 : tuning.grip) * dt);
  const desiredSteer = controlled && !car.destroyed ? actions.right : 0;
  car.steer = damp(car.steer, desiredSteer, 7, dt);
  const steeringAngle = car.steer * (0.55 / (1 + Math.abs(forward) * 0.042));
  const yawRate = Math.tan(steeringAngle) * forward / 3.1;
  car.heading += yawRate * dt * (handbrake ? 1.55 : 1);
  if (car.destroyed) car.heading += (car.explosionSpin || 0) * dt;
  // World momentum survives turning; lower grip makes a controllable, visible slide.
  const nfx = Math.sin(car.heading), nfz = -Math.cos(car.heading);
  const nrx = Math.cos(car.heading), nrz = Math.sin(car.heading);
  const retain = handbrake ? 0.84 : 0.22;
  car.vx = (nfx * forward + nrx * lateral) * (1 - retain) + (fx * forward + rx * lateral) * retain;
  car.vz = (nfz * forward + nrz * lateral) * (1 - retain) + (fz * forward + rz * lateral) * retain;
  const impactSpeed = Math.hypot(car.vx, car.vz);
  const collision = moveBodyWithCollisions(world.grid, car, car.vx * dt, car.vz * dt, 0.92, car.heading, 1.20);
  if (collision.hit) {
    const normalSpeed = car.vx * collision.nx + car.vz * collision.nz;
    if (normalSpeed < 0) {
      car.vx -= collision.nx * normalSpeed * 1.32;
      car.vz -= collision.nz * normalSpeed * 1.32;
    }
    if (impactSpeed > 5 && car.impactCooldown === 0) {
      car.condition = Math.max(0, car.condition - (impactSpeed - 4) * 1.3);
      car.bounceVelocity = Math.min(2.6, impactSpeed * 0.12);
      car.impactCooldown = 0.7;
      if (controlled) world.staticImpacts++;
      showWorldMessage(world, impactSpeed > 15 ? 'That was load-bearing. R recovers the car.' : 'A little character in the bodywork.');
    }
  }
  car.speed = Math.hypot(car.vx, car.vz);
  car.wheelSpin += forward * dt / 0.42;
  car.roll = damp(car.roll, -yawRate * Math.abs(forward) * 0.0025, 5, dt);
  car.pitch = damp(car.pitch, throttle * -0.026, 6, dt);
  car.bounceVelocity -= (car.bounce * 42 + car.bounceVelocity * 6) * dt;
  car.bounce = Math.max(0, car.bounce + car.bounceVelocity * dt);
  car.airHeight = Math.max(0, (car.airHeight || 0) + (car.airVelocity || 0) * dt);
  car.airVelocity = (car.airVelocity || 0) - 20 * dt;
  if (!car.airHeight && car.airVelocity < 0) car.airVelocity = 0;
  car.braking = braking || handbrake;
  if (!isDryLand(car.x, car.z) || car.condition === 0 && !car.destroying && !car.destroyed && !car.missionTarget) {
    recoverVehicle(car, world);
    showWorldMessage(world, 'Ilex pulled you back to the road. Try to keep all four wheels dry.', 5);
  }
}

export function recoverVehicle(car, world) {
  car.recoveries++;
  const safe = findSafeSpawn(world, car.x, car.z);
  Object.assign(car, safe, { vx: 0, vz: 0, speed: 0, condition: 100, bounce: 0, bounceVelocity: 0, roll: 0, pitch: 0,
    airHeight: 0, airVelocity: 0, destroying: false, destroyed: false, explosionTimer: 0, damageFuse: 0,
    combatSmoke: false, combatFire: false, knock: 0, spin: 0, explosionSpin: 0 });
  car.previousX = car.x; car.previousZ = car.z;
}
