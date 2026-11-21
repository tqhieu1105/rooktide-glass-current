import { enterOrStealVehicle } from './player.js';

// Seeded playable scenes use the same actors, simulation and renderer as free roam.
export function stagePlayableScreenshot(name, game) {
  const { player, car, rig, world } = game;
  if (!['strand', 'chase', 'market', 'bridge', 'quay'].includes(name)) throw new Error(`Unknown milestone view: ${name}`);
  if (name === 'strand' || name === 'chase') {
    Object.assign(car, { x: 426, z: 74, heading: 0 });
    Object.assign(player, { x: 429, z: 74 });
    enterOrStealVehicle(player, car, world);
    rig.heading = name === 'chase' ? 0.50 : 0.32; rig.orbitHold = 4;
    if (name === 'chase') {
      rig.preset = 1; rig.zoom = 3; rig.pitch = -0.12;
      game.police.restorePursuit(3, [[411, 84, -0.18, 8], [414, 28, Math.PI, 5], [426, 175, 0, 12]], [482, 26, -59]);
    }
  } else if (name === 'bridge') {
    Object.assign(car, { x: 430, z: -240, heading: Math.PI / 2 });
    Object.assign(player, { x: 430, z: -237 });
    enterOrStealVehicle(player, car, world);
    rig.heading = Math.PI / 2 - 0.30; rig.orbitHold = 4;
    rig.pitch = -0.12; rig.zoom = 3;
  } else if (name === 'market') {
    rig.heading = -0.30;
  } else if (name === 'quay') {
    Object.assign(player, { x: 267, z: 328, heading: 0 });
    Object.assign(car, { x: 259, z: 328, heading: 0 });
    rig.heading = 0.25;
  }
  car.previousX = car.x; car.previousZ = car.z;
  player.previousX = player.x; player.previousZ = player.z;
  const warm = { forward: player.inVehicle ? 1 : 0, right: 0, sprint: false, handbrake: false,
    interact: false, camera: false, pause: false, recover: false, map: false, orbitX: 0, orbitY: 0, zoom: 0 };
  game.population.seedNear(player);
  for (let i = 0; i < 90; i++) game.advanceFixedStep(warm);
  world.messageTime = 0;
  rig.initialized = false;
  rig.camera.fov = player.inVehicle ? 60 + car.speed * 0.12 : 58;
  rig.camera.updateProjectionMatrix();
  game.renderFrame(1, 1 / 60, warm);
  game.frozen = true;
}

export function signalShotReady() { window.__shotReady = true; }
