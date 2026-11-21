import * as THREE from '../vendor/three.module.min.js';

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const body = 0xf2e9d5, navy = 0x1f3e50, glass = 0x4d777c, tyre = 0x253337;

export function createPoliceModels(scene, police, world) {
  const parts = new THREE.InstancedMesh(boxGeometry, new THREE.MeshLambertMaterial(), 160);
  parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parts.frustumCulled = false;
  parts.count = 0; parts.name = 'Rooktide Civic Patrol fleet';
  scene.add(parts);
  const transform = new THREE.Object3D(), part = new THREE.Object3D(), matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  const helicopter = new THREE.Group(); helicopter.name = 'RCP search helicopter';
  const shell = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.4), new THREE.MeshLambertMaterial({ color: body }));
  shell.position.y = 0.1; helicopter.add(shell);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.82, 1.7), new THREE.MeshLambertMaterial({ color: glass }));
  cockpit.position.set(0, 0.45, -1.03); helicopter.add(cockpit);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.3, 1.85), new THREE.MeshLambertMaterial({ color: navy }));
  stripe.position.set(0, 0.08, 0.13); helicopter.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 6), new THREE.MeshLambertMaterial({ color: body }));
  tail.position.set(0, 0.08, 4.25); helicopter.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.7), new THREE.MeshLambertMaterial({ color: navy }));
  fin.position.set(0, 0.57, 6.65); helicopter.add(fin);
  const skidMaterial = new THREE.MeshLambertMaterial({ color: navy });
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 5.3), skidMaterial);
    skid.position.set(side * 1.1, -0.85, 0.25); helicopter.add(skid);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.85, 0.13), skidMaterial);
    strut.position.set(side * 0.85, -0.45, 0.2); helicopter.add(strut);
  }
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), skidMaterial);
  mast.position.y = 1; helicopter.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 1.5; helicopter.add(rotor);
  const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0x24363b });
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 10.5), bladeMaterial);
    blade.rotation.y = i * Math.PI / 2; rotor.add(blade);
  }
  const tailRotor = new THREE.Group(); tailRotor.position.set(0, 0.2, 7.05); helicopter.add(tailRotor);
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.12), bladeMaterial);
    blade.rotation.z = i * Math.PI / 2; tailRotor.add(blade);
  }
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe7a1, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
  beam.visible = false; scene.add(beam);
  scene.add(helicopter);

  function add(x, y, z, width, height, length, hex) {
    part.position.set(x, y, z); part.scale.set(width, height, length); part.rotation.set(0, 0, 0);
    part.updateMatrix(); matrix.multiplyMatrices(transform.matrix, part.matrix);
    parts.setMatrixAt(parts.count, matrix); parts.setColorAt(parts.count++, color.setHex(hex));
  }

  const start = new THREE.Vector3(), end = new THREE.Vector3(), axis = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffeaac, transparent: true, opacity: 0.19, depthWrite: false }));
  scene.add(pool);
  return function paintPolice(alpha) {
    parts.count = 0;
    for (const unit of police.units) if (unit.active) {
      transform.position.set(THREE.MathUtils.lerp(unit.previousX, unit.x, alpha), 0.1 + unit.bounce * Math.sin(unit.bounce * 8),
        THREE.MathUtils.lerp(unit.previousZ, unit.z, alpha));
      transform.rotation.set(0, -unit.heading, unit.wobble); transform.updateMatrix();
      add(0, 0.43, 0, 1.98, 0.45, 4.35, body);
      add(0, 0.71, -0.9, 1.88, 0.18, 1.62, navy);
      add(0, 0.82, 0.74, 1.92, 0.18, 0.92, body);
      add(0, 0.91, -0.18, 1.46, 0.74, 1.88, glass);
      add(0, 1.04, 0.16, 1.28, 0.13, 1.44, navy);
      for (const side of [-1, 1]) {
        for (const end of [-1, 1]) add(side * 0.93, 0.31, end * 1.38, 0.22, 0.48, 0.63, tyre);
        add(side * 0.66, 0.65, -2.19, 0.45, 0.12, 0.035, 0xfff2ca);
        add(side * 0.66, 0.66, 2.19, 0.46, 0.14, 0.035, 0xb33c38);
      }
      const flash = Math.sin(world.clock * (unit.ramTell ? 23 : 13) + unit.index) > 0;
      add(-0.35, 1.25, -0.26, 0.65, 0.22, 0.32, flash ? 0xff262c : 0xb53136);
      add(0.35, 1.25, -0.26, 0.65, 0.22, 0.32, flash ? 0x2190be : 0x47e6ff);
      add(0, 0.79, -2.12, 0.8, 0.12, 0.035, 0x4e6660);
    }
    updateRoadblocks(police.roadblocks);
    if (parts.count) { parts.instanceColor.needsUpdate = true; parts.instanceMatrix.needsUpdate = true; }

    helicopter.visible = police.helicopter.active;
    beam.visible = pool.visible = police.helicopter.active;
    if (police.helicopter.active) {
      const h = police.helicopter;
      helicopter.position.set(h.x, h.y, h.z); helicopter.rotation.set(h.bank, -h.heading, h.bank * 0.45);
      rotor.rotation.y = world.clock * 26; tailRotor.rotation.z = world.clock * 75;
      start.set(h.x, h.y - 1, h.z); end.set(h.target.x, 0.28, h.target.z);
      const length = start.distanceTo(end), radius = 8 * h.beamScale;
      axis.subVectors(start, end).normalize();
      beam.position.copy(start).lerp(end, 0.5);
      beam.quaternion.setFromUnitVectors(up, axis);
      beam.scale.set(radius, length, radius);
      pool.position.copy(end); pool.scale.set(radius, 1, radius);
    }
  };

  function updateRoadblocks(blocks) {
    const barrierParts = [];
    for (const block of blocks) if (block) for (const segment of block.segments) {
      barrierParts.push({ x: segment.x, z: segment.z, length: segment.length, horizontal: segment.horizontal, phase: block.warning });
    }
    // Static collision remains axis aligned, while each barricade uses alternating bright panels.
    for (const barrier of barrierParts) {
      const flash = Math.sin(barrier.phase) > 0;
      transform.position.set(barrier.x, 0, barrier.z); transform.rotation.set(0, 0, 0); transform.updateMatrix();
      const stripes = Math.max(3, Math.floor(barrier.length / 1.5));
      for (let i = 0; i < stripes; i++) {
        const offset = (i + 0.5) / stripes * barrier.length - barrier.length / 2;
        const x = barrier.horizontal ? offset : 0, z = barrier.horizontal ? 0 : offset;
        add(x, 0.76, z, barrier.horizontal ? barrier.length / stripes : 0.7, 1.25,
          barrier.horizontal ? 0.7 : barrier.length / stripes, (i % 2 === 0) === flash ? 0xffcc42 : 0x263d4b);
        add(x, 1.48, z, 0.34, 0.22, 0.34, flash ? 0xff5943 : 0x44ccd0);
      }
    }
  }
};
