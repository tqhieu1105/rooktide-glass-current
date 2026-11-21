import * as THREE from '../vendor/three.module.min.js';
import { ART_DIRECTION as A } from './art-direction.js';

const cube = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(0.42, 0.42, 0.25, 16);
const sphere = new THREE.SphereGeometry(1, 14, 10);
const materials = new Map();
const boxBatches = new WeakMap();
const batchTransforms = new THREE.Object3D(), batchColor = new THREE.Color();
function material(color, metal = false) {
  const key = `${color}:${metal}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.32 : 0.82,
    metalness: metal ? 0.68 : 0.02, flatShading: true }));
  return materials.get(key);
}
function box(parent, x, y, z, w, h, d, color, metal = false, rz = 0) {
  let batches = boxBatches.get(parent);
  if (!batches) { batches = new Map(); boxBatches.set(parent, batches); }
  let mesh = batches.get(metal);
  if (!mesh) {
    mesh = new THREE.InstancedMesh(cube, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: metal ? 0.34 : 0.82,
      metalness: metal ? 0.6 : 0.02, flatShading: true }), 128);
    mesh.name = metal ? 'instanced metal trim' : 'instanced authored box details';
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
    parent.add(mesh); batches.set(metal, mesh);
  }
  const index = mesh.count++;
  batchTransforms.position.set(x, y, z); batchTransforms.scale.set(w, h, d); batchTransforms.rotation.set(0, 0, rz);
  batchTransforms.updateMatrix(); mesh.setMatrixAt(index, batchTransforms.matrix); mesh.setColorAt(index, batchColor.setHex(color));
  mesh.castShadow = true; mesh.receiveShadow = true;
}

function sealBoxBatches(root) {
  root.traverse(object => {
    if (!object.isInstancedMesh || !object.name.startsWith('instanced ')) return;
    object.instanceMatrix.needsUpdate = true;
    if (object.instanceColor) object.instanceColor.needsUpdate = true;
    object.computeBoundingSphere();
  });
}

function oval(parent, x, y, z, sx, sy, sz, color, metal = false) {
  const mesh = new THREE.Mesh(sphere, material(color, metal));
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function paintMaterial(color) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 0.08, roughness: 0.39, clearcoat: 0.64, clearcoatRoughness: 0.28 });
}

function coupeHull() {
  const geometry = new THREE.BufferGeometry();
  const sections = [
    [-1, 0.70, -0.08, 0.76], [-0.88, 0.90, 0.00, 0.92], [-0.60, 0.98, 0.02, 1],
    [-0.12, 1, 0.02, 0.98], [0.48, 0.96, 0.01, 0.93], [0.82, 0.86, -0.01, 0.85], [1, 0.70, -0.03, 0.76],
  ];
  const outline = [[-0.76,-0.5],[0.76,-0.5],[1,-0.25],[1,0.27],[0.80,0.5],[-0.80,0.5],[-1,0.27],[-1,-0.25]];
  const positions = [], indices = [];
  for (const [z, width, centerY, height] of sections) {
    for (const [x, y] of outline) positions.push(x * width, centerY + y * height, z * 2.25);
  }
  for (let ring = 0; ring < sections.length - 1; ring++) for (let p = 0; p < outline.length; p++) {
    const a = ring * outline.length + p, b = ring * outline.length + (p + 1) % outline.length;
    const c = (ring + 1) * outline.length + p, d = (ring + 1) * outline.length + (p + 1) % outline.length;
    indices.push(a, b, c, b, d, c);
  }
  const backStart = positions.length / 3;
  for (let p = 0; p < outline.length; p++) positions.push(outline[p][0] * sections[0][1],
    sections[0][2] + outline[p][1] * sections[0][3], sections[0][0] * 2.25);
  const frontStart = positions.length / 3;
  for (let p = 0; p < outline.length; p++) positions.push(outline[p][0] * sections.at(-1)[1],
    sections.at(-1)[2] + outline[p][1] * sections.at(-1)[3], sections.at(-1)[0] * 2.25);
  for (let p = 1; p < 7; p++) indices.push(backStart, backStart + p + 1, backStart + p,
    frontStart, frontStart + p, frontStart + p + 1);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

const coupeGeometry = coupeHull();

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
  const bodyPaint = paintMaterial(paint);
  const hull = new THREE.Mesh(coupeGeometry, bodyPaint);
  hull.position.y = 0.56; hull.scale.set(0.98, 0.47, 1);
  hull.castShadow = hull.receiveShadow = true; hull.name = 'sculpted coupe body shell'; chassis.add(hull);
  box(chassis, 0, 0.78, -1.43, 1.88, 0.19, 1.52, paint, true);
  box(chassis, 0, 0.76, 1.63, 1.87, 0.2, 1.08, paint, true);
  const cabin = new THREE.BufferGeometry();
  cabin.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.85,0.79,-0.95, 0.85,0.79,-0.95, 0.85,0.79,1.15, -0.85,0.79,1.15,
    -0.67,1.43,-0.40, 0.67,1.43,-0.40, 0.67,1.43,0.64, -0.67,1.43,0.64,
  ], 3));
  cabin.setIndex([0,4,5,0,5,1, 1,5,6,1,6,2, 2,6,7,2,7,3, 3,7,4,3,4,0, 4,7,6,4,6,5]);
  cabin.computeVertexNormals();
  const windowMaterial = new THREE.MeshPhysicalMaterial({ color: 0x3a7178, metalness: 0.04, roughness: 0.19,
    clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.84, side: THREE.DoubleSide });
  const windows = new THREE.Mesh(cabin, windowMaterial); windows.castShadow = true; windows.name = 'teal glass canopy'; chassis.add(windows);
  box(chassis, 0, 1.46, 0.12, 1.42, 0.10, 1.12, paint, true);
  for (const side of [-1, 1]) {
    box(chassis, side * 0.82, 1.09, 0.3, 0.08, 0.65, 0.12, paint);
    box(chassis, side * 1.04, 0.89, -0.48, 0.24, 0.13, 0.2, paint, true);
    box(chassis, side * 0.55, 0.66, -2.26, 0.55, 0.18, 0.045, 0xffe5b0);
    box(chassis, side * 0.60, 0.65, 2.26, 0.55, 0.17, 0.045, 0xa3312e);
    box(chassis, side * 0.58, 0.86, -1.52, 0.10, 0.018, 1.08, A.cream);
    box(chassis, side * 0.58, 0.84, 1.61, 0.10, 0.018, 0.78, A.cream);
    box(chassis, side * 0.986, 0.59, -0.42, 0.025, 0.30, 0.018, 0x8b403a);
    box(chassis, side * 0.986, 0.59, 0.72, 0.025, 0.30, 0.018, 0x8b403a);
    box(chassis, side * 1.012, 0.80, 0.24, 0.025, 0.045, 0.22, A.cream, true);
    box(chassis, side * 1.03, 1.08, 0.14, 0.07, 0.08, 0.15, dark);
    box(chassis, side * 1.07, 1.16, 0.14, 0.18, 0.12, 0.26, paint, true);
    for (let vent = 0; vent < 4; vent++) box(chassis, side * 0.42, 0.63, -1.92 + vent * 0.13,
      0.21, 0.025, 0.035, dark);
  }
  box(chassis, 0, 0.46, -2.28, 1.72, 0.12, 0.10, dark);
  box(chassis, 0, 0.49, 2.27, 1.78, 0.13, 0.10, dark);
  box(chassis, 0, 0.6, 2.34, 0.4, 0.14, 0.02, A.cream);
  box(chassis, 0, 0.87, 1.95, 1.74, 0.09, 0.28, dark);
  for (let grille = -3; grille <= 3; grille++) box(chassis, grille * 0.13, 0.59, -2.335, 0.035, 0.11, 0.025, A.metal);
  for (const x of [-0.74, 0.74]) {
    box(chassis, x, 0.52, -2.30, 0.20, 0.11, 0.08, A.cream);
    box(chassis, x, 0.50, 2.31, 0.22, 0.08, 0.065, 0xff795b);
  }
  box(chassis, 0, 1.52, 0.48, 0.12, 0.06, 0.18, dark, true);
  box(chassis, 0, 1.60, 0.50, 0.035, 0.12, 0.06, A.metal, true);
  const wheels = [];
  for (const x of [-1.0, 1.0]) for (const z of [-1.4, 1.4]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.43, z); root.add(pivot);
    const assembly = new THREE.Group(); pivot.add(assembly);
    const tyre = new THREE.Mesh(cylinder, material(0x253337)); tyre.rotation.z = Math.PI / 2; tyre.scale.set(1.08, 1, 1.08);
    tyre.castShadow = true; assembly.add(tyre);
    const rotorGeometry = new THREE.CylinderGeometry(0.30, 0.30, 0.06, 18);
    const rimGeometry = new THREE.TorusGeometry(0.235, 0.028, 6, 20);
    const face = x < 0 ? -1 : 1;
    const rotor = new THREE.Mesh(rotorGeometry, material(0xbfc4ae, true)); rotor.rotation.z = Math.PI / 2;
    rotor.position.x = face * 0.145; assembly.add(rotor);
    const rim = new THREE.Mesh(rimGeometry, material(A.cream, true)); rim.rotation.y = Math.PI / 2;
    rim.position.x = face * 0.15; assembly.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.07, 12), material(A.cream, true));
    hub.rotation.z = Math.PI / 2; hub.position.x = face * 0.16; assembly.add(hub);
    wheels.push({ pivot, assembly, tyre, front: z < 0 });
  }
  const brake = new THREE.Group(); chassis.add(brake);
  for (const side of [-1, 1]) box(brake, side * 0.6, 0.65, 2.30, 0.52, 0.13, 0.03, 0xff7c54);
  brake.visible = false;
  const driver = new THREE.Group(); chassis.add(driver);
  box(driver, -0.4, 1.10, 0.17, 0.23, 0.26, 0.2, 0xe0ab7f);
  box(driver, -0.4, 0.94, 0.20, 0.35, 0.26, 0.25, A.mustard);
  driver.visible = false;
  const paintMaterials = [bodyPaint];
  sealBoxBatches(root);
  return { root, chassis, wheels, brake, driver, paintMaterials, paint };
}

export function createPlayerModel() {
  const root = new THREE.Group(); root.name = 'Neri Voss — articulated courier';
  contactShadow(root, 0.43, 0.55);
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.29, 0.58, 12), material(A.mustard));
  jacket.position.set(0, 1.13, 0); jacket.castShadow = true; jacket.receiveShadow = true; root.add(jacket);
  box(root, 0, 0.88, 0, 0.39, 0.17, 0.27, 0x294c58);
  box(root, 0, 1.18, 0.17, 0.26, 0.36, 0x315360);
  box(root, 0, 1.18, 0.193, 0.025, 0.34, A.cream, true);
  box(root, 0, 0.96, 0.17, 0.31, 0.08, A.ink, true);
  box(root, 0, 0.96, 0.221, 0.065, 0.07, 0xc9b987, true);
  for (const side of [-1, 1]) {
    box(root, side * 0.17, 1.15, 0.145, 0.018, 0.37, 0.025, A.terracotta, false, -side * 0.1);
  }
  const head = oval(root, 0, 1.58, 0.015, 0.143, 0.175, 0.142, 0xcf9976);
  head.name = 'Neri head';
  for (const side of [-1, 1]) {
    oval(root, side * 0.145, 1.57, 0.015, 0.035, 0.055, 0.045, 0xcf9976);
    oval(root, side * 0.052, 1.62, 0.144, 0.018, 0.025, 0.013, 0x263439);
  }
  oval(root, 0, 1.61, 0.158, 0.031, 0.045, 0.035, 0xb77a5d);
  oval(root, 0, 1.72, -0.01, 0.16, 0.09, 0.16, 0x343c3a);
  box(root, 0, 1.69, 0.105, 0.27, 0.075, 0.10, 0x343c3a);
  box(root, 0, 1.64, -0.11, 0.15, 0.07, 0x343c3a);
  box(root, 0.17, 1.17, -0.20, 0.36, 0.46, 0.16, A.terracotta);
  box(root, 0.17, 1.39, -0.19, 0.34, 0.12, 0xb65a46);
  box(root, 0.17, 1.13, -0.292, 0.26, 0.14, 0x294c58);
  box(root, 0.17, 1.14, -0.316, 0.07, 0.035, A.cream, true);
  box(root, 0.17, 1.18, -0.06, 0.055, 0.49, A.ink);
  box(root, 0.055, 1.20, 0.171, 0.063, 0.53, 0.028, A.ink, false, -0.49);
  box(root, -0.23, 0.86, -0.015, 0.16, 0.23, 0.17, A.ink);
  box(root, -0.23, 0.91, 0.035, 0.10, 0.14, 0.07, A.terracotta);
  const limbs = [];
  let pistolArm, pistol;
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.31, 1.34, 0); root.add(arm);
    oval(arm, 0, -0.03, 0, 0.12, 0.12, 0.13, A.terracotta);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.075, 0.31, 9), material(A.mustard));
    sleeve.position.y = -0.16; sleeve.castShadow = true; arm.add(sleeve);
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.059, 0.26, 9), material(0xcf9976));
    forearm.position.y = -0.42; forearm.castShadow = true; arm.add(forearm);
    box(arm, 0, -0.305, 0, 0.145, 0.055, 0.15, 0x315360);
    const leg = new THREE.Group(); leg.position.set(side * 0.12, 0.84, 0); root.add(leg);
    const trouser = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.104, 0.65, 9), material(0x294c58));
    trouser.position.y = -0.34; trouser.castShadow = true; leg.add(trouser);
    box(leg, 0, -0.40, 0.104, 0.15, 0.22, 0.055, 0x315360);
    box(leg, 0, -0.73, -0.04, 0.20, 0.16, 0.32, A.cream);
    box(leg, 0, -0.76, 0.055, 0.19, 0.045, 0.24, 0x294c58);
    if (side > 0) {
      pistolArm = arm;
      const hand = oval(arm, 0, -0.55, 0.04, 0.075, 0.065, 0.08, 0xcf9976);
      hand.name = 'pistol grip hand';
      pistol = new THREE.Group(); pistol.name = 'original courier pistol'; pistol.visible = false; arm.add(pistol);
      pistol.position.set(0, -0.55, 0.04);
      box(pistol, 0, 0.01, 0.19, 0.11, 0.11, 0.37, 0x34464a, true);
      box(pistol, 0, -0.105, 0.06, 0.083, 0.21, 0.12, 0x273538);
      box(pistol, 0, -0.19, 0.035, 0.088, 0.055, 0.14, 0x485955);
      box(pistol, 0, 0.019, 0.39, 0.076, 0.072, 0.10, 0x172326);
      box(pistol, 0, 0.075, 0.12, 0.035, 0.03, 0.20, A.metal, true);
      box(pistol, 0, 0.09, 0.34, 0.044, 0.035, 0.045, 0xe4ba75, true);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 10), material(0x9ca79c, true));
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.015, 0.43); pistol.add(barrel);
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 5, 14), material(0x9ca79c, true));
      guard.rotation.y = Math.PI / 2; guard.position.set(0, -0.04, 0.135); pistol.add(guard);
      for (let notch = 0; notch < 3; notch++) box(pistol, 0.058, 0.027, 0.12 - notch * 0.045,
        0.012, 0.075, 0.017, 0x172326);
      for (let i = 0; i < 2; i++) oval(pistol, 0, 0.075, 0.02 + i * 0.06, 0.018, 0.015, 0.018, A.cream, true);
    }
    limbs.push({ arm, leg, side });
  }
  sealBoxBatches(root);
  return { root, limbs, pistol, pistolArm };
}

export function updateActorModels(player, car, visuals, alpha, weapon = 1) {
  const pv = visuals.player, cv = visuals.car;
  pv.root.visible = !player.inVehicle;
  pv.root.position.set(player.previousX + (player.x - player.previousX) * alpha, 0.13, player.previousZ + (player.z - player.previousZ) * alpha);
  pv.root.rotation.y = -player.heading;
  pv.pistol.visible = !player.inVehicle && weapon === 2;
  const stride = Math.sin(player.walkPhase) * Math.min(0.8, player.speed * 0.12);
  for (const { arm, leg, side } of pv.limbs) {
    arm.rotation.x = pv.pistol.visible && side > 0 ? -0.48 + stride * 0.16 : stride * side;
    leg.rotation.x = -stride * side;
  }
  pv.root.position.y += Math.abs(Math.sin(player.walkPhase * 2)) * Math.min(0.045, player.speed * 0.008);
  cv.root.visible = car.type === 'sports';
  cv.root.position.set(car.previousX + (car.x - car.previousX) * alpha, 0.10 + car.bounce + (car.airHeight || 0), car.previousZ + (car.z - car.previousZ) * alpha);
  cv.root.rotation.y = -car.heading;
  cv.chassis.rotation.z = car.roll; cv.chassis.rotation.x = car.pitch;
  for (const w of cv.wheels) {
    w.pivot.rotation.y = w.front ? -car.steer * 0.45 : 0;
    w.assembly.rotation.x = car.wheelSpin;
  }
  const paint = car.paint || 0xc65f54;
  if (paint !== cv.paint) {
    for (const mat of cv.paintMaterials) mat.color.setHex(paint);
    cv.paint = paint;
  }
  cv.brake.visible = car.braking;
  cv.driver.visible = player.inVehicle;
}
