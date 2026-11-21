import * as THREE from '../vendor/three.module.min.js';
import { CONTACTS } from './mission-data.js';

// A single set of meshes follows the actual objective and contact for every job.
export function createMissionModels(scene, missions, world) {
  const amber = 0xffc66e, mint = 0x9cf9cd, coral = 0xff846c;
  const color = new THREE.MeshBasicMaterial({ color: mint, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 48),
    new THREE.MeshBasicMaterial({ color: mint, side: THREE.DoubleSide, transparent: true, opacity: .72, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2;
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.68), color);
  diamond.scale.y = 1.35;
  const core = new THREE.Mesh(new THREE.BoxGeometry(.65, .42, .42), new THREE.MeshLambertMaterial({ color: 0xf1bf63 }));
  const gate = new THREE.Group();
  const columnMaterial = new THREE.MeshBasicMaterial({ color: mint, transparent: true, opacity: .5, toneMapped: false });
  const markerColumn = new THREE.Mesh(new THREE.CylinderGeometry(.42, .72, 5.6, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: mint, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  markerColumn.position.y = 2.8;
  markerColumn.renderOrder = 1;
  for (const x of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.25, 4.8, .25), columnMaterial);
    post.position.set(x * 5.2, 2.4, 0); gate.add(post);
  }
  const contact = actorModel();
  const guards = Array.from({ length: 3 }, actorModel);
  const temp = new THREE.Vector3();
  const markerLabel = document.getElementById('waypoint-label');
  const markerName = document.getElementById('waypoint-name');
  scene.add(ring, diamond, core, gate, markerColumn, contact.root, ...guards.map(model => model.root));
  let oldLabel = '';

  function actorModel() {
    const root = new THREE.Group();
    const torso = new THREE.MeshLambertMaterial({ color: coral });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd99b6d });
    const edge = new THREE.MeshLambertMaterial({ color: 0x273b4b });
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const part = (material, x, y, z, width, height, depth) => {
      const mesh = new THREE.Mesh(cube, material);
      mesh.position.set(x, y, z); mesh.scale.set(width, height, depth); root.add(mesh);
      return mesh;
    };
    part(torso, 0, 1.13, 0, .46, .59, .28);
    part(skin, 0, 1.59, 0, .28, .31, .26);
    part(edge, 0, 1.76, 0, .31, .085, .28);
    part(edge, 0, 1.36, -.15, .29, .10, .04);
    const arms = [-1, 1].map(side => part(skin, side * .29, 1.07, 0, .14, .52, .16));
    const legs = [-1, 1].map(side => part(edge, side * .12, .44, 0, .17, .8, .18));
    root.visible = false;
    return { root, torso, skin, arms, legs };
  }

  return function paint(camera, alpha) {
    const stage = missions.presentation();
    const marker = stage.marker;
    ring.visible = diamond.visible = !!marker;
    markerColumn.visible = !!marker && marker.style !== 'contact';
    contact.root.visible = marker?.style === 'contact';
    gate.visible = stage.gate && !!marker;
    core.visible = stage.collect && !!marker;
    markerLabel.hidden = !marker;
    if (marker) {
      const { x, z, radius, label, style } = marker;
      const tint = style === 'contact' ? amber : style === 'target' ? coral : mint;
      color.color.setHex(tint); ring.material.color.setHex(tint);
      ring.position.set(x, .22, z); ring.scale.setScalar(Math.min(8, radius));
      markerColumn.position.x = x; markerColumn.position.z = z; markerColumn.material.color.setHex(tint);
      const height = gate.visible ? 5.3 : style === 'contact' || style === 'car' || style === 'target' ? 3.2 : 2.05;
      diamond.position.set(x, height + .18 * Math.sin(world.clock * 3), z);
      diamond.rotation.y = world.clock * 1.4;
      gate.position.set(x, .12, z);
      // Posts remain vertical as the chase camera tilts.
      gate.rotation.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0);
      core.position.set(x, .42, z); core.rotation.y = .45;
      if (contact.root.visible) {
        const info = CONTACTS[stage.contact];
        contact.torso.color.set(info.coat); contact.skin.color.set(info.skin);
        contact.root.position.set(x, .13, z);
        contact.root.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
      }
      temp.set(x, height + 1.85, z).project(camera);
      const onScreen = temp.z <= 1 && Math.abs(temp.x) < .78 && temp.y < .68 && temp.y > -.52;
      markerLabel.hidden = !onScreen;
      if (onScreen) {
        markerLabel.style.left = `${(temp.x * .5 + .5) * 100}%`;
        markerLabel.style.top = `${(.5 - temp.y * .5) * 100}%`;
        const text = `${label} · ${stage.metres} m`;
        if (text !== oldLabel) { markerName.textContent = text; oldLabel = text; }
      }
    }
    guards.forEach((model, index) => {
      const guard = missions.guards[index];
      model.root.visible = !!guard;
      if (!guard) return;
      model.root.position.set(guard.previousX + (guard.x - guard.previousX) * alpha, guard.hp ? .14 : .28,
        guard.previousZ + (guard.z - guard.previousZ) * alpha);
      model.root.rotation.set(0, -guard.heading, !guard.hp ? 1.51 : guard.hit ? -.21 : 0);
      model.torso.color.setHex(guard.flash > 0 ? 0xffdf87 : !guard.hp ? 0x68696a : 0xdf5b59);
      model.arms.forEach((arm, i) => { arm.rotation.x = guard.flash > 0 ? -1.26 : Math.sin(guard.phase + Math.PI * i) * .34; });
      model.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(guard.phase + Math.PI * i) * -.34; });
    });
  };
}
