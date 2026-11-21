import * as THREE from '../vendor/three.module.min.js';
import { useCityAtlas } from './atlas.js';
import { ART_DIRECTION as A } from './art-direction.js';
import { applyGroundTexture, createChunkRoughness, createGroundTextures } from './surface-textures.js';

// Static primitives share spatial instance batches.
export function createGeometryBuilder(scene, atlas, seed = 0, options = {}) {
  const ownedResources = new Set();
  const own = resource => { if (resource?.dispose) ownedResources.add(resource); return resource; };
  const roughness = own(createChunkRoughness(seed));
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
    cone: new THREE.ConeGeometry(0.5, 1, 6),
    ring: new THREE.TorusGeometry(1, 0.075, 4, 32, Math.PI * 1.72),
    leaf: makePalmFrond(),
    stone: new THREE.IcosahedronGeometry(1, 0),
    surface: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    grass: makeGrassTuft(),
  };
  const materials = {
    solid: new THREE.MeshLambertMaterial(),
    facadeLow: new THREE.MeshLambertMaterial(),
    facadeHigh: new THREE.MeshStandardMaterial({ roughness: 1 }),
    surfaceLow: new THREE.MeshLambertMaterial(),
    surfaceHigh: new THREE.MeshStandardMaterial({ roughness: 1 }),
    ground: new THREE.MeshLambertMaterial({ flatShading: true }),
    terrainLow: new THREE.MeshLambertMaterial(),
    terrainHigh: new THREE.MeshStandardMaterial({ roughness: 1 }),
    stoneLow: new THREE.MeshLambertMaterial({ flatShading: true, vertexColors: true }),
    stoneHigh: new THREE.MeshStandardMaterial({ roughness: 0.94, flatShading: true, vertexColors: true }),
    light: new THREE.MeshBasicMaterial(),
  };
  useCityAtlas(materials.facadeHigh, atlas, roughness, true);
  useCityAtlas(materials.facadeLow, atlas, roughness, true);
  useCityAtlas(materials.surfaceHigh, atlas, roughness, false);
  useCityAtlas(materials.surfaceLow, atlas, roughness, false);
  if (options.terrain) {
    const ground = createGroundTextures(seed);
    own(ground.color); own(ground.roughness);
    applyGroundTexture(materials.terrainHigh, ground);
    applyGroundTexture(materials.terrainLow, ground);
  }
  const buckets = new Map();
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  const grass = [];
  const stones = [];
  // Cull distant/behind-camera static props, including the sun's shadow pass.
  // Large ground slabs remain global so their centers never hide their bounds.
  const bucketKey = (shape, material, x, z, large = false) => large
    ? `${shape}:${material}` : `${shape}:${material}:${Math.floor(x / 128)}:${Math.floor(z / 128)}`;
  function add(shape, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0, material = 'solid', style) {
    const key = bucketKey(shape, material, x, z, (material === 'ground' || material === 'surface' || material === 'terrain') && Math.max(sx, sz) > 50);
    if (!buckets.has(key)) buckets.set(key, []);
    transform.position.set(x, y, z); transform.scale.set(sx, sy, sz);
    transform.rotation.set(rx, ry, rz); transform.updateMatrix();
    buckets.get(key).push({ matrix: transform.matrix.clone(), color, style });
  }
  function box(x, y, z, sx, sy, sz, color, yaw = 0, material = 'solid', style) {
    if (material === 'surface' || material === 'ground' && sy <= 0.08) {
      add('surface', x, y + sy / 2, z, sx, 1, sz, color, 0, yaw, 0, material, style);
    } else add('box', x, y, z, sx, sy, sz, color, 0, yaw, 0, material, style);
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
  function addGrass(x, z, height, color = 0x91aa64, yaw = 0) {
    transform.position.set(x, 0.018, z); transform.scale.set(1, height, 1);
    transform.rotation.set(0, yaw, 0); transform.updateMatrix();
    grass.push({ matrix: transform.matrix.clone(), color });
  }
  function addStone(x, z, size, color = 0x9a9181, yaw = 0) {
    transform.position.set(x, size * 0.45, z); transform.scale.set(size, size * 0.62, size * 0.82);
    transform.rotation.set(yaw * 0.15, yaw, yaw * 0.08); transform.updateMatrix();
    stones.push({ matrix: transform.matrix.clone(), color });
  }
  function finish() {
    let instances = 0;
    const meshes = [];
    for (const [key, entries] of buckets) {
      const [shape, material] = key.split(':');
      let geometry = geometries[shape];
      if (material === 'facade' || material === 'surface') {
        geometry = geometry.clone();
        geometry.setAttribute('atlasStyle', new THREE.InstancedBufferAttribute(new Float32Array(entries.flatMap(e => e.style)), 4));
      }
      const highOnly = ['facade', 'surface', 'terrain'].includes(material);
      const mesh = new THREE.InstancedMesh(geometry, highOnly ? materials[`${material}Low`] : materials[material], entries.length);
      mesh.name = `city-${key}`;
      mesh.userData.materialRole = highOnly ? material : null;
      entries.forEach((e, i) => { mesh.setMatrixAt(i, e.matrix); mesh.setColorAt(i, tint.setHex(e.color)); });
      mesh.castShadow = (material === 'solid' && shape !== 'leaf') || material === 'facade'; mesh.receiveShadow = material !== 'light';
      mesh.computeBoundingSphere(); scene.add(mesh); meshes.push(mesh); instances += entries.length;
    }
    let grassMesh;
    if (grass.length) {
      const grassMaterial = new THREE.MeshStandardMaterial({ color: 0xb9cf88, roughness: 0.96, vertexColors: true, side: THREE.DoubleSide });
      grassMaterial.onBeforeCompile = shader => {
        grassMaterial.userData.shader = shader;
        shader.uniforms.uGrassTime = { value: 0 };
        shader.vertexShader = `uniform float uGrassTime;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          float bladeHeight = clamp(position.y, 0.0, 1.0);
          float bladePhase = instanceMatrix[3].x * .17 + instanceMatrix[3].z * .13;
          float gust = .7 + .3 * sin(uGrassTime * .54 - bladePhase * .19);
          float tipBend = bladeHeight * bladeHeight * gust;
          transformed.x += sin(uGrassTime * 1.65 + bladePhase + bladeHeight * 1.3) * .10 * tipBend;
          transformed.z += cos(uGrassTime * 1.22 + bladePhase + bladeHeight) * .06 * tipBend;
        `);
      };
      grassMaterial.customProgramCacheKey = () => 'rooktide-instanced-grass-wind-v1';
      grassMesh = new THREE.InstancedMesh(geometries.grass, grassMaterial, grass.length);
      grassMesh.name = 'chunk-owned seeded grass tufts';
      grass.forEach((entry, i) => { grassMesh.setMatrixAt(i, entry.matrix); grassMesh.setColorAt(i, tint.setHex(entry.color)); });
      grassMesh.castShadow = false; grassMesh.receiveShadow = true; grassMesh.computeBoundingSphere();
      scene.add(grassMesh); meshes.push(grassMesh); instances += grass.length;
    }
    let stoneMesh;
    if (stones.length) {
      stoneMesh = new THREE.InstancedMesh(geometries.stone, materials.stoneLow, stones.length);
      stoneMesh.name = 'chunk-owned instanced coastal stones';
      stones.forEach((entry, i) => { stoneMesh.setMatrixAt(i, entry.matrix); stoneMesh.setColorAt(i, tint.setHex(entry.color)); });
      stoneMesh.castShadow = false; stoneMesh.receiveShadow = true; stoneMesh.computeBoundingSphere();
      scene.add(stoneMesh); meshes.push(stoneMesh); instances += stones.length;
      stoneMesh.userData.materialRole = 'stone';
    }
    let disposed = false;
    let highQuality = false;
    return { batches: buckets.size + (grassMesh ? 1 : 0) + (stoneMesh ? 1 : 0), instances, meshes, setTime(time) {
      if (grassMesh?.material.userData.shader) grassMesh.material.userData.shader.uniforms.uGrassTime.value = time;
    }, setQuality(high) {
      high = !!high;
      if (high === highQuality) return;
      highQuality = high;
      for (const mesh of meshes) if (mesh.userData.materialRole) {
        mesh.material = materials[`${mesh.userData.materialRole}${high ? 'High' : 'Low'}`];
      }
    }, updateDrawDistance(camera, distance) {
      for (const mesh of meshes) {
        const sphere = mesh.boundingSphere;
        const dx = sphere.center.x - camera.position.x, dz = sphere.center.z - camera.position.z;
        const reach = distance + sphere.radius;
        mesh.visible = dx * dx + dz * dz < reach * reach;
      }
    }, dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set();
      for (const mesh of meshes) {
        scene.remove(mesh); mesh.dispose(); geometries.add(mesh.geometry);
      }
      for (const geometry of geometries) geometry.dispose();
      for (const material of new Set(Object.values(materials).concat(grassMesh?.material || []))) material.dispose();
      for (const resource of ownedResources) resource.dispose();
    } };
  }
  return { add, box, beam, addGrass, addStone, own, finish };
}

export function addPalm(builder, palm) {
  const { x, z, height: h, turn } = palm;
  const leanX = Math.sin(turn) * 1.1, leanZ = Math.cos(turn) * 1.1;
  builder.beam(x, 0, z, x + leanX * 0.4, h * 0.55, z + leanZ * 0.4, 0.34, A.trunk);
  builder.beam(x + leanX * 0.4, h * 0.55, z + leanZ * 0.4, x + leanX, h, z + leanZ, 0.27, A.trunk);
  for (let i = 1; i <= 5; i++) {
    const t = i / 6, px = x + leanX * t, pz = z + leanZ * t;
    builder.add('cylinder', px, h * t, pz, 0.35 - t * 0.12, 0.055, 0.35 - t * 0.12, 0x72563f);
  }
  for (let i = 0; i < 6; i++) {
    builder.add('leaf', x + leanX, h, z + leanZ, 1.3, 1.4, 4.5 + i % 2,
      i % 2 ? A.palmLight : A.palm, 0, turn + i * Math.PI / 3, 0);
  }
}

function makePalmFrond() {
  const geometry = new THREE.BufferGeometry();
  const points = [], indices = [];
  const quad = (a, b, c, d) => {
    const start = points.length / 3;
    points.push(...a, ...b, ...c, ...d);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    const back = points.length / 3;
    points.push(...d, ...c, ...b, ...a);
    indices.push(back, back + 1, back + 2, back, back + 2, back + 3);
  };
  // Narrow raised rachis and tapered leaflets make the crown read as layered foliage.
  for (let i = 0; i < 7; i++) {
    const z0 = i / 7, z1 = (i + 1) / 7;
    const sag0 = -0.08 - z0 * z0 * 0.42, sag1 = -0.08 - z1 * z1 * 0.42;
    quad([-0.018, sag0, z0], [0.018, sag0, z0], [0.014, sag1, z1], [-0.014, sag1, z1]);
  }
  for (let i = 0; i < 9; i++) {
    const t = 0.08 + i * 0.092, y = -0.08 - t * t * 0.42;
    const reach = 0.13 + Math.sin(Math.PI * t) * 0.27;
    const tipY = y - 0.10 - t * 0.10, tipZ = Math.min(1.08, t + 0.18);
    quad([0, y + 0.012, t], [-reach, tipY, tipZ], [0, tipY - 0.014, tipZ + 0.035], [reach, tipY, tipZ]);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); return geometry;
}

function makeGrassTuft() {
  const geometry = new THREE.BufferGeometry();
  const positions = [], colors = [], indices = [];
  const blades = [0, Math.PI / 3, Math.PI * 2 / 3];
  const levels = [0, 0.34, 0.68, 1];
  for (const angle of blades) {
    const tangentX = Math.cos(angle), tangentZ = Math.sin(angle);
    const bendX = -tangentZ, bendZ = tangentX;
    const first = positions.length / 3;
    for (const t of levels) {
      const centerX = bendX * t * t * 0.18, centerZ = bendZ * t * t * 0.18;
      const halfWidth = 0.075 * (1 - t) + 0.003;
      const tint = 0.5 + t * 0.48;
      for (const side of [-1, 1]) {
        positions.push(centerX + tangentX * halfWidth * side, t, centerZ + tangentZ * halfWidth * side);
        colors.push(0.72 * tint, tint, 0.49 * tint);
      }
    }
    for (let row = 0; row < levels.length - 1; row++) {
      const a = first + row * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
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
export function meshLettering(builder, text, x, y, z, size, yaw = 0, color = A.white, material = 'solid') {
  const width = (text.length * 4 - 1) * size;
  for (let c = 0; c < text.length; c++) {
    const glyph = LETTERS[text[c]];
    if (!glyph) continue;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) if (glyph[row][col] === '1') {
      const lx = c * 4 * size + col * size - width / 2 + size / 2;
      builder.box(x + Math.cos(yaw) * lx, y + (2 - row) * size, z - Math.sin(yaw) * lx,
        size * 0.82, size * 0.82, size * 0.28, color, yaw, material);
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
  const neon = text === 'KILN MARKET' ? A.neonPink : text === 'RELAY QUAY' ? A.neonMagenta : 0;
  for (const side of [-1, 1]) meshLettering(builder, text, x + Math.sin(yaw) * side * 0.18, 5.1,
    z + Math.cos(yaw) * side * 0.18, 0.17, yaw + (side < 0 ? Math.PI : 0), neon || A.white, neon ? 'light' : 'solid');
}

export function neonBoard(builder, text, x, y, z, size, yaw, color, trim) {
  const width = text.length * size * 4 + 1.4;
  const height = size * 5 + 1.15;
  builder.box(x, y, z, width, height, .28, A.ink, yaw);
  builder.box(x, y + height * .49, z, width, .085, .36, trim, yaw, 'light');
  builder.box(x, y - height * .49, z, width, .085, .36, trim, yaw, 'light');
  meshLettering(builder, text, x + Math.sin(yaw) * .16, y, z + Math.cos(yaw) * .16, size, yaw, color, 'light');
}
