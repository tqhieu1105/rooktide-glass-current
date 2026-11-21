import * as THREE from '../vendor/three.module.min.js';

const TYRES = 0x253337, GLASS = 0x315761, TROUSERS = 0x2b485c;
const BODIES = { sports: [1.96, 4.5, .58], compact: [1.79, 3.65, .71], saloon: [1.95, 4.45, .72],
  van: [2.04, 4.45, 1.05], pickup: [2, 4.49, .86] };

export function createPopulationModels(scene, population) {
  const parts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 720);
  parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parts.frustumCulled = false; parts.count = 0; parts.name = 'Instanced street population';
  const sparkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), population.sparks.length);
  sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparkMesh.frustumCulled = false; sparkMesh.count = 0;
  for (let i = 0; i < population.sparks.length; i++) sparkMesh.setColorAt(i, new THREE.Color(i % 3 ? 0xffba40 : 0xffedbb));
  scene.add(parts, sparkMesh);
  const root = new THREE.Object3D(), piece = new THREE.Object3D(), matrix = new THREE.Matrix4();
  const tint = new THREE.Color();
  let index = 0;
  function part(x, y, z, w, h, d, color, rx = 0, rz = 0) {
    piece.position.set(x, y, z); piece.scale.set(w, h, d); piece.rotation.set(rx, 0, rz); piece.updateMatrix();
    matrix.multiplyMatrices(root.matrix, piece.matrix);
    parts.setMatrixAt(index, matrix); parts.setColorAt(index++, tint.setHex(color));
  }
  function place(actor, alpha, y, lean = 0) {
    root.position.set(actor.previousX + (actor.x - actor.previousX) * alpha, y, actor.previousZ + (actor.z - actor.previousZ) * alpha);
    root.rotation.set(0, -actor.heading, lean); root.updateMatrix();
  }
  function carBody(car, alpha, detailed) {
    const [width, length, height] = BODIES[car.type];
    const paint = car.paint || 0xc65f54;
    const distance = car.claimed || car.distance == null ? car.wheelSpin * .42 : car.distance;
    const sway = Math.sin(distance * .24) * Math.min(.055, car.speed * .006);
    place(car, alpha, car.bounce + (car.airHeight || 0) + .10 + Math.abs(sway) * .65, car.knock > 0 ? Math.sin(car.knock * 15) * .21 : sway);
    part(0, .52, 0, width, .48, length, paint);
    part(0, .74 + height * .44, car.type === 'pickup' ? -.43 : .05, width * .81, height * .92, length * .50, GLASS);
    part(0, .74 + height * .86, car.type === 'pickup' ? -.43 : .05, width * .86, .10, length * .49, paint);
    for (let side = -1; side < 2; side += 2) {
      for (let end = -1; end < 2; end += 2) part(side * width * .46, .34, end * length * .31, .22, .54, .60, TYRES);
      if (detailed) {
        part(side * width * .31, .56, -length * .506, .38, .13, .03, 0xffe6ae);
        part(side * width * .31, .57, length * .508, .39, .16, .03, car.braking ? 0xff7152 : 0xac393b);
      }
    }
  }
  function walker(p, alpha, detailed) {
    const stride = Math.sin(p.phase) * (p.panic ? 1 : p.pause > 0 ? .11 : .48);
    const tumble = p.tumble ? Math.sin(p.tumble * 9.7) * 1.29 : 0;
    place(p, alpha, .13 + (p.tumble ? Math.sin(p.tumble * 4.8) * .64 : Math.abs(stride) * .035), tumble);
    part(0, 1.18, 0, .41, .53, .25, p.paint);
    part(0, 1.57, 0, .26, .29, .24, p.skin);
    for (let side = -1; side < 2; side += 2) {
      part(side * .105, .45, stride * side * .22, .16, .76, .17, TROUSERS, stride * side);
      if (detailed) part(side * .266, 1.05 + (p.panic ? .26 : 0), -stride * side * .17, .13, .55, .17, p.skin,
        -stride * side, p.panic ? side * 1.25 : side * .10);
    }
    if (p.fish && detailed) {
      part(.39, 1.08, -.22, .18, .24, .76, 0x92c4bd, .16);
      part(.39, 1.13, .19, .12, .42, .17, 0x64a1ab, .20);
      part(.49, 1.135, -.48, .035, .055, .055, 0x253337);
    }
  }
  function visible(actor, camera, range) {
    const x = actor.x - camera.position.x, z = actor.z - camera.position.z;
    const distance = x * x + z * z, m = camera.matrixWorld.elements;
    return distance < range * range && (distance < 20 ** 2 || -x * m[8] - z * m[10] > .44 * Math.sqrt(distance));
  }
  return function updatePopulationModels(camera, chosen, alpha, low) {
    index = 0;
    const range = low ? 135 : 215;
    for (const car of population.vehicles) if (car.active && (car !== chosen || car.type !== 'sports') && visible(car, camera, range)) carBody(car, alpha, !low);
    for (const p of population.people) if (p.active && visible(p, camera, range)) walker(p, alpha, !low || (p.x - camera.position.x) ** 2 + (p.z - camera.position.z) ** 2 < 47 ** 2);
    parts.count = index; parts.instanceMatrix.needsUpdate = parts.instanceColor !== null;
    if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
    let count = 0;
    for (const s of population.sparks) if (s.life > 0 && s.y > .05) {
      piece.position.set(s.x, s.y, s.z); piece.rotation.set(s.life * 7, 0, s.life * 8); piece.scale.set(.095, .34, .096);
      piece.updateMatrix(); sparkMesh.setMatrixAt(count++, piece.matrix);
    }
    sparkMesh.count = count;
    if (count) sparkMesh.instanceMatrix.needsUpdate = true;
  };
}
