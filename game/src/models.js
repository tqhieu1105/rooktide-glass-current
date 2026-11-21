import * as THREE from '../vendor/three.module.min.js';
import { ART_DIRECTION as A } from './art-direction.js';

const cube = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(0.42, 0.42, 0.25, 10);
const materials = new Map();
function material(color, metal = false) {
  const key = `${color}:${metal}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.36 : 0.8,
    metalness: metal ? 0.28 : 0, flatShading: true }));
  return materials.get(key);
}
function box(parent, x, y, z, w, h, d, color, metal = false) {
  const mesh = new THREE.Mesh(cube, material(color, metal));
  mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function contactShadow(parent, width, length) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16),
    new THREE.MeshBasicMaterial({ color: 0x16383c, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(width, length, 1); shadow.position.y = 0.045;
  parent.add(shadow);
}

export function createVehicleModel() {
  const root = new THREE.Group(); root.name = 'Driftline GT — procedural coupe';
  contactShadow(root, 1.35, 2.6);
  const chassis = new THREE.Group(); root.add(chassis);
  const paint = 0xc65f54, dark = 0x203a42;
  box(chassis, 0, 0.56, 0, 1.96, 0.47, 4.5, paint, true);
  box(chassis, 0, 0.78, -1.43, 1.88, 0.19, 1.52, paint, true);
  box(chassis, 0, 0.76, 1.63, 1.87, 0.2, 1.08, paint, true);
  const cabin = new THREE.BufferGeometry();
  cabin.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.85,0.79,-0.95, 0.85,0.79,-0.95, 0.85,0.79,1.15, -0.85,0.79,1.15,
    -0.67,1.43,-0.40, 0.67,1.43,-0.40, 0.67,1.43,0.64, -0.67,1.43,0.64,
  ], 3));
  cabin.setIndex([0,4,5,0,5,1, 1,5,6,1,6,2, 2,6,7,2,7,3, 3,7,4,3,4,0, 4,7,6,4,6,5]);
  cabin.computeVertexNormals();
  const windows = new THREE.Mesh(cabin, material(0x356c79, true)); windows.castShadow = true; chassis.add(windows);
  box(chassis, 0, 1.46, 0.12, 1.42, 0.10, 1.12, paint, true);
  for (const side of [-1, 1]) {
    box(chassis, side * 0.82, 1.09, 0.3, 0.08, 0.65, 0.12, paint);
    box(chassis, side * 1.05, 0.93, -0.48, 0.28, 0.14, 0.22, paint, true);
    box(chassis, side * 0.55, 0.69, -2.27, 0.57, 0.16, 0.04, 0xffe5b0);
    box(chassis, side * 0.6, 0.65, 2.27, 0.55, 0.17, 0.04, 0xa3312e);
    box(chassis, side * 0.58, 0.92, -1.5, 0.10, 0.015, 1.1, A.cream);
    box(chassis, side * 0.58, 0.91, 1.65, 0.10, 0.015, 0.8, A.cream);
  }
  box(chassis, 0, 0.46, -2.28, 1.72, 0.12, 0.10, dark);
  box(chassis, 0, 0.49, 2.27, 1.78, 0.13, 0.10, dark);
  box(chassis, 0, 0.6, 2.34, 0.4, 0.14, 0.02, A.cream);
  box(chassis, 0, 0.87, 1.95, 1.74, 0.09, 0.28, dark);
  const wheels = [];
  for (const x of [-1.0, 1.0]) for (const z of [-1.4, 1.4]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.43, z); root.add(pivot);
    const tyre = new THREE.Mesh(cylinder, material(0x253337)); tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true; pivot.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 6), material(A.cream, true));
    hub.rotation.z = Math.PI / 2; pivot.add(hub);
    wheels.push({ pivot, tyre, hub, front: z < 0 });
  }
  const brake = new THREE.Group(); chassis.add(brake);
  for (const side of [-1, 1]) box(brake, side * 0.6, 0.65, 2.30, 0.52, 0.13, 0.03, 0xff7c54);
  brake.visible = false;
  const driver = new THREE.Group(); chassis.add(driver);
  box(driver, -0.4, 1.10, 0.17, 0.23, 0.26, 0.2, 0xe0ab7f);
  box(driver, -0.4, 0.94, 0.20, 0.35, 0.26, 0.25, A.mustard);
  driver.visible = false;
  const paintMaterials = [material(paint, true), material(paint)];
  return { root, chassis, wheels, brake, driver, paintMaterials, paint };
}

export function createPlayerModel() {
  const root = new THREE.Group(); root.name = 'Neri Voss — articulated courier';
  contactShadow(root, 0.43, 0.55);
  box(root, 0, 1.13, 0, 0.44, 0.53, 0.28, A.mustard);
  box(root, 0, 0.88, 0, 0.39, 0.17, 0.26, 0x294c58);
  box(root, 0, 1.59, 0, 0.28, 0.31, 0.27, 0xcf9976);
  box(root, 0, 1.75, 0.025, 0.30, 0.10, 0.29, 0x3e4240);
  box(root, 0, 1.69, 0.11, 0.29, 0.16, 0.09, 0x3e4240);
  box(root, 0.21, 1.05, 0.18, 0.25, 0.33, 0.15, A.terracotta);
  const strap = box(root, 0, 1.22, 0.16, 0.065, 0.56, 0.04, A.ink); strap.rotation.z = -0.5;
  const limbs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.31, 1.34, 0); root.add(arm);
    box(arm, 0, -0.12, 0, 0.17, 0.28, 0.20, A.mustard);
    box(arm, 0, -0.37, 0, 0.13, 0.25, 0.14, 0xcf9976);
    const leg = new THREE.Group(); leg.position.set(side * 0.12, 0.84, 0); root.add(leg);
    box(leg, 0, -0.34, 0, 0.17, 0.66, 0.2, 0x294c58);
    box(leg, 0, -0.73, -0.07, 0.19, 0.14, 0.31, A.cream);
    limbs.push({ arm, leg, side });
  }
  return { root, limbs };
}

export function updateActorModels(player, car, visuals, alpha) {
  const pv = visuals.player, cv = visuals.car;
  pv.root.visible = !player.inVehicle;
  pv.root.position.set(player.previousX + (player.x - player.previousX) * alpha, 0.13, player.previousZ + (player.z - player.previousZ) * alpha);
  pv.root.rotation.y = -player.heading;
  const stride = Math.sin(player.walkPhase) * Math.min(0.8, player.speed * 0.12);
  for (const { arm, leg, side } of pv.limbs) { arm.rotation.x = stride * side; leg.rotation.x = -stride * side; }
  pv.root.position.y += Math.abs(Math.sin(player.walkPhase * 2)) * Math.min(0.045, player.speed * 0.008);
  cv.root.visible = car.type === 'sports';
  cv.root.position.set(car.previousX + (car.x - car.previousX) * alpha, 0.10 + car.bounce, car.previousZ + (car.z - car.previousZ) * alpha);
  cv.root.rotation.y = -car.heading;
  cv.chassis.rotation.z = car.roll; cv.chassis.rotation.x = car.pitch;
  for (const w of cv.wheels) {
    w.pivot.rotation.y = w.front ? -car.steer * 0.45 : 0;
    w.tyre.rotation.x = car.wheelSpin; w.hub.rotation.x = car.wheelSpin;
  }
  const paint = car.paint || 0xc65f54;
  if (paint !== cv.paint) {
    for (const mat of cv.paintMaterials) mat.color.setHex(paint);
    cv.paint = paint;
  }
  cv.brake.visible = car.braking;
  cv.driver.visible = player.inVehicle;
}
