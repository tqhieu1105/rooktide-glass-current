import * as THREE from '../vendor/three.module.min.js';
import { ART_DIRECTION as A } from './art-direction.js';

// Static boxes/prisms share instance batches. There are no world textures or canvas facades.
export function createGeometryBuilder(scene) {
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    cone: new THREE.ConeGeometry(0.5, 1, 6),
    ring: new THREE.TorusGeometry(1, 0.075, 4, 32, Math.PI * 1.72),
    leaf: makePalmFrond(),
    surface: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  };
  const materials = {
    solid: new THREE.MeshLambertMaterial({ flatShading: true }),
    ground: new THREE.MeshLambertMaterial({ flatShading: true }),
    light: new THREE.MeshBasicMaterial(),
  };
  const buckets = new Map();
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  // Cull distant/behind-camera static props, including the sun's shadow pass.
  // Large ground slabs remain global so their centers never hide their bounds.
  const bucketKey = (shape, material, x, z, large = false) => large
    ? `${shape}:${material}` : `${shape}:${material}:${Math.floor(x / 160)}:${Math.floor(z / 160)}`;
  function add(shape, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0, material = 'solid') {
    const key = bucketKey(shape, material, x, z, material === 'ground' && Math.max(sx, sz) > 50);
    if (!buckets.has(key)) buckets.set(key, []);
    transform.position.set(x, y, z); transform.scale.set(sx, sy, sz);
    transform.rotation.set(rx, ry, rz); transform.updateMatrix();
    buckets.get(key).push({ matrix: transform.matrix.clone(), color });
  }
  function box(x, y, z, sx, sy, sz, color, yaw = 0, material = 'solid') {
    if (material === 'ground' && sy <= 0.08) {
      add('surface', x, y + sy / 2, z, sx, 1, sz, color, 0, yaw, 0, material);
    } else add('box', x, y, z, sx, sy, sz, color, 0, yaw, 0, material);
  }
  function beam(x1, y1, z1, x2, y2, z2, thickness, color) {
    const length = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    transform.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    transform.scale.set(thickness, length, thickness);
    transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1).normalize());
    transform.updateMatrix();
    const key = bucketKey('box', 'solid', (x1 + x2) / 2, (z1 + z2) / 2);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ matrix: transform.matrix.clone(), color });
  }
  function finish() {
    let instances = 0;
    const meshes = [];
    for (const [key, entries] of buckets) {
      const [shape, material] = key.split(':');
      const mesh = new THREE.InstancedMesh(geometries[shape], materials[material], entries.length);
      mesh.name = `city-${key}`;
      entries.forEach((e, i) => { mesh.setMatrixAt(i, e.matrix); mesh.setColorAt(i, tint.setHex(e.color)); });
      mesh.castShadow = material === 'solid'; mesh.receiveShadow = material !== 'light';
      mesh.computeBoundingSphere(); scene.add(mesh); meshes.push(mesh); instances += entries.length;
    }
    return { batches: buckets.size, instances, updateDrawDistance(camera, distance) {
      for (const mesh of meshes) {
        const sphere = mesh.boundingSphere;
        mesh.visible = Math.hypot(sphere.center.x - camera.position.x, sphere.center.z - camera.position.z) - sphere.radius < distance;
      }
    } };
  }
  return { add, box, beam, finish };
}

export function addPalm(builder, palm) {
  const { x, z, height: h, turn } = palm;
  const leanX = Math.sin(turn) * 1.1, leanZ = Math.cos(turn) * 1.1;
  builder.beam(x, 0, z, x + leanX * 0.4, h * 0.55, z + leanZ * 0.4, 0.34, A.trunk);
  builder.beam(x + leanX * 0.4, h * 0.55, z + leanZ * 0.4, x + leanX, h, z + leanZ, 0.27, A.trunk);
  for (let i = 0; i < 7; i++) {
    builder.add('leaf', x + leanX, h, z + leanZ, 1.3, 1.4, 4.5 + i % 2,
      i % 2 ? A.palmLight : A.palm, 0, turn + i * Math.PI * 2 / 7, 0);
  }
}

function makePalmFrond() {
  const geometry = new THREE.BufferGeometry();
  // A ridged, drooping three-dimensional frond, viewed from either side.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -0.55, -0.05, 0.45, 0, 0.25, 0.45,
    0, 0, 0, 0, 0.25, 0.45, 0.55, -0.05, 0.45,
    -0.55, -0.05, 0.45, 0, -0.6, 1, 0, 0.25, 0.45,
    0, 0.25, 0.45, 0, -0.6, 1, 0.55, -0.05, 0.45,
    0, 0.25, 0.45, -0.55, -0.05, 0.45, 0, 0, 0,
    0.55, -0.05, 0.45, 0, 0.25, 0.45, 0, 0, 0,
    0, 0.25, 0.45, 0, -0.6, 1, -0.55, -0.05, 0.45,
    0.55, -0.05, 0.45, 0, -0.6, 1, 0, 0.25, 0.45,
  ], 3));
  geometry.computeVertexNormals(); return geometry;
}

// Compact original block lettering: physical cubes, not a canvas billboard.
const LETTERS = {
  A: ['010','101','111','101','101'], B: ['110','101','110','101','110'], C: ['011','100','100','100','011'],
  D: ['110','101','101','101','110'], E: ['111','100','110','100','111'], F: ['111','100','110','100','100'],
  G: ['011','100','101','101','011'], H: ['101','101','111','101','101'], I: ['111','010','010','010','111'],
  J: ['001','001','001','101','010'], K: ['101','101','110','101','101'], L: ['100','100','100','100','111'],
  M: ['101','111','111','101','101'], N: ['101','111','111','111','101'], O: ['010','101','101','101','010'],
  P: ['110','101','110','100','100'], Q: ['010','101','101','111','011'], R: ['110','101','110','101','101'],
  S: ['011','100','010','001','110'], T: ['111','010','010','010','010'], U: ['101','101','101','101','111'],
  V: ['101','101','101','101','010'], W: ['101','101','111','111','101'], X: ['101','101','010','101','101'],
  Y: ['101','101','010','010','010'], Z: ['111','001','010','100','111'], '0': ['111','101','101','101','111'],
  '1': ['010','110','010','010','111'], '2': ['110','001','010','100','111'], '6': ['011','100','111','101','111'],
};
export function meshLettering(builder, text, x, y, z, size, yaw = 0, color = A.white) {
  const width = (text.length * 4 - 1) * size;
  for (let c = 0; c < text.length; c++) {
    const glyph = LETTERS[text[c]];
    if (!glyph) continue;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) if (glyph[row][col] === '1') {
      const lx = c * 4 * size + col * size - width / 2 + size / 2;
      builder.box(x + Math.cos(yaw) * lx, y + (2 - row) * size, z - Math.sin(yaw) * lx,
        size * 0.82, size * 0.82, size * 0.28, color, yaw);
    }
  }
}

export function districtSign(builder, sign) {
  const width = sign.text.length * 0.71 + 2;
  const { x, z, yaw, color, text } = sign;
  for (const side of [-1, 1]) builder.box(x + Math.cos(yaw) * width * side * 0.43, 2.6,
    z - Math.sin(yaw) * width * side * 0.43, 0.22, 5.2, 0.25, A.ink, yaw);
  builder.box(x, 5.1, z, width, 2.1, 0.3, color, yaw);
  builder.box(x, 4.05, z, width + 0.2, 0.14, 0.5, A.white, yaw);
  for (const side of [-1, 1]) meshLettering(builder, text, x + Math.sin(yaw) * side * 0.18, 5.1,
    z + Math.cos(yaw) * side * 0.18, 0.17, yaw + (side < 0 ? Math.PI : 0));
}
