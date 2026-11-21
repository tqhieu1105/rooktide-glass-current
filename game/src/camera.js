import * as THREE from '../vendor/three.module.min.js';
import { angleDelta, clamp, damp } from './config.js';

export function createThirdPersonCamera(camera) {
  return { camera, heading: 0, pitch: 0, orbitHold: 0, preset: 0, zoom: 0, initialized: false,
    look: new THREE.Vector3(), desired: new THREE.Vector3(), target: new THREE.Vector3() };
}

export function updateChaseCamera(rig, player, car, actions, world, dt) {
  const driving = player.inVehicle;
  const actor = driving ? car : player;
  if (actions.camera) rig.preset = (rig.preset + 1) % 2;
  rig.zoom = clamp(rig.zoom + actions.zoom * 0.6, -1.5, 5);
  if (actions.orbitX || actions.orbitY) {
    rig.heading -= actions.orbitX * 0.005;
    rig.pitch = clamp(rig.pitch + actions.orbitY * 0.003, -0.12, 0.65);
    rig.orbitHold = 2.5;
  }
  rig.orbitHold = Math.max(0, rig.orbitHold - dt);
  if (driving && rig.orbitHold === 0) rig.heading += angleDelta(rig.heading, car.heading) * (1 - Math.exp(-2.7 * dt));
  const distance = (driving ? rig.preset ? 13.5 : 8.8 : rig.preset ? 8 : 5.9) + rig.zoom + (driving ? car.speed * 0.065 : 0);
  const height = driving ? rig.preset ? 6.4 : 3.7 : rig.preset ? 4.4 : 2.8;
  rig.target.set(actor.x, driving ? 1 : 1.23, actor.z);
  rig.desired.set(actor.x - Math.sin(rig.heading) * distance,
    height + rig.pitch * distance, actor.z + Math.cos(rig.heading) * distance);
  avoidCameraOcclusion(rig.target, rig.desired, world.grid);
  const factor = rig.initialized ? 1 - Math.exp(-8 * dt) : 1;
  rig.camera.position.lerp(rig.desired, factor);
  rig.look.copy(rig.target);
  if (driving) { rig.look.x += Math.sin(car.heading) * 2; rig.look.z -= Math.cos(car.heading) * 2; }
  rig.camera.lookAt(rig.look);
  const fov = damp(rig.camera.fov, driving ? 60 + car.speed * 0.12 : 58, 3, dt);
  if (Math.abs(fov - rig.camera.fov) > 0.01) { rig.camera.fov = fov; rig.camera.updateProjectionMatrix(); }
  rig.initialized = true;
}

export function avoidCameraOcclusion(from, to, grid) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  let limit = 1;
  for (const box of grid.query(from.x, from.z, Math.hypot(dx, dz) + 1)) {
    let near = 0, far = 1;
    for (let axis = 0; axis < 3; axis++) {
      const origin = axis === 0 ? from.x : axis === 1 ? from.z : from.y;
      const delta = axis === 0 ? dx : axis === 1 ? dz : dy;
      const low = axis === 0 ? box.minX - 0.35 : axis === 1 ? box.minZ - 0.35 : 0;
      const high = axis === 0 ? box.maxX + 0.35 : axis === 1 ? box.maxZ + 0.35 : box.height + 0.4;
      if (Math.abs(delta) < 0.00001) {
        if (origin < low || origin > high) { near = 2; break; }
      } else {
        const a = (low - origin) / delta, b = (high - origin) / delta;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      }
    }
    if (near <= far && near > 0) limit = Math.min(limit, Math.max(0.12, near - 0.07));
  }
  to.set(from.x + dx * limit, Math.max(0.6, from.y + dy * limit), from.z + dz * limit);
}
