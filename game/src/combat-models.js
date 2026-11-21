import * as THREE from '../vendor/three.module.min.js';

export function createCombatModels(scene, combat) {
  const smoke = pool(scene, new THREE.SphereGeometry(.5, 7, 5), 54, 0x65746f, .40);
  const flame = pool(scene, new THREE.ConeGeometry(.34, 1, 6), 24, 0xff9e45, .86);
  const debris = pool(scene, new THREE.BoxGeometry(1, 1, 1), 36, 0x38464a, 1);
  const blast = pool(scene, new THREE.SphereGeometry(1, 10, 7), 6, 0xffb44f, .52);
  const ringGeometry = new THREE.RingGeometry(.82, 1, 24);
  const rings = pool(scene, ringGeometry, 6, 0xffca6e, .80);
  const tracerGeometry = new THREE.BufferGeometry();
  const tracerPositions = new Float32Array(8 * 6);
  tracerGeometry.setAttribute('position', new THREE.BufferAttribute(tracerPositions, 3));
  tracerGeometry.setDrawRange(0, 0);
  const tracerLines = new THREE.LineSegments(tracerGeometry, new THREE.LineBasicMaterial({ color: 0xffe1a1, transparent: true, opacity: .9 }));
  tracerLines.frustumCulled = false; scene.add(tracerLines);
  const object = new THREE.Object3D(), tint = new THREE.Color();

  return function updateCombatModels() {
    let index = 0;
    for (const particle of combat.smoke) {
      if (particle.life <= 0) continue;
      place(smoke, index++, particle.x, particle.y, particle.z, particle.size, particle.life, 0x65746f);
    }
    smoke.mesh.count = index; smoke.mesh.instanceMatrix.needsUpdate = true;
    index = 0;
    for (const particle of combat.flames) {
      if (particle.life <= 0) continue;
      place(flame, index++, particle.x, particle.y, particle.z, particle.size, particle.life, particle.color);
    }
    flame.mesh.count = index; flame.mesh.instanceMatrix.needsUpdate = true;
    let blastIndex = 0, ringIndex = 0;
    for (const effect of combat.explosions) {
      const t = effect.age / effect.life, radius = effect.size * (.45 + t * 1.75);
      place(blast, blastIndex++, effect.x, 1.6 + t * 1.1, effect.z, radius, 1 - t, 0xffb44f);
      place(rings, ringIndex++, effect.x, .17 + t * .10, effect.z, effect.size * (.4 + t * 2.1), 1 - t, 0xffe08b);
    }
    blast.mesh.count = blastIndex; blast.mesh.instanceMatrix.needsUpdate = true;
    rings.mesh.count = ringIndex; rings.mesh.instanceMatrix.needsUpdate = true;
    index = 0;
    for (const piece of combat.debris) {
      if (piece.life <= 0) continue;
      object.position.set(piece.x, piece.y, piece.z);
      object.rotation.set(piece.spinX, piece.spinY, piece.spinZ);
      object.scale.set(piece.size, piece.size * .7, piece.size * 1.5); object.updateMatrix();
      debris.mesh.setMatrixAt(index, object.matrix); debris.mesh.setColorAt(index++, tint.setHex(piece.color));
    }
    debris.mesh.count = index; debris.mesh.instanceMatrix.needsUpdate = true;
    if (debris.mesh.instanceColor) debris.mesh.instanceColor.needsUpdate = true;
    tracerPositions.fill(0);
    const shots = combat.tracers.slice(-8);
    shots.forEach((shot, i) => {
      const offset = i * 6, alpha = Math.max(0, 1 - shot.age / shot.life);
      tracerPositions[offset] = shot.x1; tracerPositions[offset + 1] = 1.18;
      tracerPositions[offset + 2] = shot.z1; tracerPositions[offset + 3] = shot.x2;
      tracerPositions[offset + 4] = 1.18 + alpha * .08; tracerPositions[offset + 5] = shot.z2;
    });
    tracerGeometry.attributes.position.needsUpdate = true;
    tracerGeometry.setDrawRange(0, shots.length * 2);
  };

  function pool(parent, geometry, count, color, opacity) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false,
      side: geometry.type === 'RingGeometry' ? THREE.DoubleSide : THREE.FrontSide, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false; mesh.count = 0; parent.add(mesh);
    return { mesh };
  }
  function place(group, index, x, y, z, size, life, color) {
    object.position.set(x, y, z); object.rotation.set(group === rings ? -Math.PI / 2 : 0, 0, 0);
    object.scale.set(size, size * (group === flame ? 1.65 : 1), size); object.updateMatrix();
    group.mesh.setMatrixAt(index, object.matrix);
    group.mesh.setColorAt(index, tint.setHex(color).multiplyScalar(.48 + .52 * life));
  }
}
