import { ART_DIRECTION as A } from './art-direction.js';
import { addPalm, districtSign, meshLettering, neonBoard } from './geometry.js';
import { getDistrictAt } from './world.js';
import { AVENUES, STREETS, GLASSHOOK_GANTRY } from './config.js';
import { createRandom } from './random.js';

export const CITY_CHUNK_SIZE = 192;

export function createCityChunks(world) {
  const chunks = new Map();
  const chunkFor = (district, x, z) => {
    const cx = Math.floor(x / CITY_CHUNK_SIZE), cz = Math.floor(z / CITY_CHUNK_SIZE);
    const id = `${district}:${cx}:${cz}`;
    if (!chunks.has(id)) chunks.set(id, { id, district, cx, cz,
      x: (cx + 0.5) * CITY_CHUNK_SIZE, z: (cz + 0.5) * CITY_CHUNK_SIZE,
      buildings: [], palms: [], lamps: [], signs: [], landmarks: [] });
    return chunks.get(id);
  };
  for (const building of world.buildings) chunkFor(building.district, building.x, building.z).buildings.push(building);
  for (const palm of world.palms) chunkFor(getDistrictAt(palm.x, palm.z).id, palm.x, palm.z).palms.push(palm);
  for (const lamp of world.lamps) chunkFor(getDistrictAt(lamp.x, lamp.z).id, lamp.x, lamp.z).lamps.push(lamp);
  for (const sign of world.signs) chunkFor(getDistrictAt(sign.x, sign.z).id, sign.x, sign.z).signs.push(sign);
  for (const [id, district, x, z] of [
    ['kiln', 'market', 150, 55], ['cinder', 'cinder', -354, 300],
    ['tower', 'heights', -377, -315], ['mast', 'heights', -486, -397],
    ['crane', 'quay', 317, 304], ['containers', 'quay', 306, 390],
    ['glasshook', 'glasshook', GLASSHOOK_GANTRY.x, GLASSHOOK_GANTRY.z],
  ]) chunkFor(district, x, z).landmarks.push(id);
  return [...chunks.values()];
}

export function createDistrictBuildings(chunk, b, far = false) {
  const palette = [A.cream, A.sage, A.coral, A.blue, A.mustard];
  for (const house of chunk.buildings) {
    const { x, z, width: w, depth: d, height: h, floors, variant, district } = house;
    const color = district === 'strand' ? [A.cream, A.cream, A.coral, A.sage, A.cream][house.color] : palette[house.color];
    const style = far ? [1 + variant, Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(d / 14)), Math.max(1, Math.round(floors / 2))]
      : [1 + variant, Math.round(w / 7), Math.round(d / 7), floors];
    b.box(x, h / 2, z, w, h, d, color, 0, 'facade', style);
    if (far) continue;
    b.box(x, h + 0.25, z, w + 1, 0.5, d + 1, A.cream);
    if (variant % 2 === 0) b.box(x + w * 0.18, h + 0.9, z, w * 0.38, 1.3, d * 0.36, A.metal);
    const front = z + d / 2 + 0.34, side = x + w / 2 + 0.32;
    for (const edge of [-1, 1]) {
      b.box(x + edge * (w / 2 - 0.42), h / 2, front, 0.24, h, 0.22, district === 'strand' ? A.cream : A.sidewalk);
      b.box(x + edge * (w / 2 - 0.12), h / 2, side, 0.22, h, 0.24, A.sidewalk);
      b.add('cylinder', x + edge * (w / 2 - 0.42), 1.15, front + 0.14, 0.11, 0.09, 0.11, A.metal);
    }
    b.box(x, Math.min(h - 0.3, 3.45), front, w * 0.9, 0.13, 0.18, A.metal);
    if (variant % 3 !== 1 && h > 13) {
      const units = 1 + (variant % 2);
      for (let i = 0; i < units; i++) {
        const acX = x + (i - (units - 1) / 2) * Math.min(w * 0.42, 7.5);
        const acY = 4.2 + i * 3.3;
        b.box(acX, acY, front + 0.18, 1.25, 0.85, 0.5, A.sidewalk);
        b.box(acX, acY, front + 0.45, 0.85, 0.58, 0.07, A.ink);
        for (let slat = -1; slat <= 1; slat++) b.box(acX + slat * 0.2, acY, front + 0.5, 0.035, 0.42, 0.018, A.metal);
        for (const boltX of [-0.48, 0.48]) b.add('cylinder', acX + boltX, acY - 0.27, front + 0.52,
          0.045, 0.045, 0.045, A.cream);
      }
      const pipeX = x - w / 2 + 0.72;
      b.box(pipeX, h * 0.48, front + 0.18, 0.085, h * 0.92, 0.09, A.metal);
      for (let floor = 1; floor < floors; floor += 3) b.box(pipeX + 0.08, floor * 3.3, front + 0.12, 0.22, 0.09, 0.14, A.ink);
    }
    for (let vent = -1; vent <= 1; vent++) {
      b.box(x + vent * 0.21, h + 0.55, z, 0.09, 0.28, d * 0.46, A.metal);
    }
    if (district === 'market') {
      for (let i = -1; i <= 1; i++) {
        b.box(x + i * w * 0.3, 2.7, z + d / 2 + 1.3, w * 0.28, 0.23, 2.7,
          i === 0 ? A.cream : A.terracotta);
        b.box(x + i * w * 0.3, 1.3, z + d / 2 + 2.5, 0.15, 2.6, 0.15, A.ink);
      }
    }
    if (district === 'strand' && variant === 1) {
      for (const offset of [-0.37, 0, 0.37]) b.box(x + w * offset, h / 2 + 1, z + d / 2 + 0.9, 0.75, h + 3, 1.8, A.terracotta);
    }
  }
  if (far) return;
  const random = createRandom(hashChunk(chunk.id));
  for (let i = 0; i < 54; i++) {
    const x = chunk.cx * CITY_CHUNK_SIZE + 5 + (i % 10) * 18.1 + random() * 7;
    const z = chunk.cz * CITY_CHUNK_SIZE + 5 + Math.floor(i / 10) * 18.1 + random() * 7;
    if (x < -520 || x > 432 || Math.abs(z) > 420) continue;
    if (AVENUES.some(axis => Math.abs(axis - x) < 18) || STREETS.some(axis => Math.abs(axis - z) < 18)) continue;
    if (chunk.buildings.some(house => Math.abs(house.x - x) < house.width / 2 + 2 && Math.abs(house.z - z) < house.depth / 2 + 2)) continue;
    const tint = [0x789258, 0x8da05a, 0xa3a463][Math.floor(random() * 3)];
    b.addGrass(x, z, 0.45 + random() * 0.3, tint, random() * Math.PI);
    if (i % 4 === 0) b.addStone(x + random() * 1.6 - 0.8, z + random() * 1.6 - 0.8,
      0.16 + random() * 0.22, [0x867b71, 0x9b8c79, 0x756f6b][Math.floor(random() * 3)], random() * Math.PI);
  }
  for (const palm of chunk.palms) addPalm(b, palm);
  for (const lamp of chunk.lamps) {
    b.box(lamp.x, 3.3, lamp.z, 0.17, 6.6, 0.17, A.metal);
    b.box(lamp.x + 0.8, 6.5, lamp.z, 1.8, 0.18, 0.25, A.metal);
    b.box(lamp.x + 1.3, 6.4, lamp.z, 0.8, 0.12, 0.4, A.white, 0, 'light');
    b.add('cylinder', lamp.x, 0.2, lamp.z, 0.4, 0.35, 0.4, A.ink);
    b.box(lamp.x + 1.3, 6.24, lamp.z, 0.92, 0.08, 0.5, A.metal);
    b.box(lamp.x + 1.3, 6.31, lamp.z, 0.62, 0.07, 0.28, A.white, 0, 'light');
  }
  for (const sign of chunk.signs) districtSign(b, sign);
  instanceCityLandmarks(b, chunk.landmarks);
  if (chunk.landmarks.includes('kiln')) {
    neonBoard(b, 'HOT CLAY', 145, 6.2, 30.9, .39, Math.PI, A.neonPink, A.neonOrange);
    neonBoard(b, 'HOT CLAY', 145, 6.2, 79, .39, 0, A.neonPink, A.neonOrange);
  }
  if (chunk.landmarks.includes('crane')) {
    neonBoard(b, 'FISH DISCO', 316, 19.5, 306, .42, 0, A.neonMagenta, A.neonPink);
    neonBoard(b, 'FISH DISCO', 316, 19.5, 302, .42, Math.PI, A.neonMagenta, A.neonPink);
  }
}

function hashChunk(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

export function instanceCityLandmarks(b, landmarks) {
  // Kiln plaza: glazed canopy, ceramic plinths and the broken floodgate motif.
  if (landmarks.includes('kiln')) {
    b.box(150, 0.12, 55, 76, 0.24, 66, A.cream, 0, 'ground');
    for (const x of [121, 145, 169]) {
      for (const z of [34, 76]) b.box(x, 3.6, z, 0.5, 7.2, 0.5, A.terracotta);
      b.box(x, 7.2, 55, 21, 0.4, 47, x === 145 ? A.terracotta : A.mustard);
    }
    b.add('ring', 184, 5, 62, 5, 5, 3, A.terracotta, 0, 0.4, 0.3);
    b.box(184, 0.8, 62, 11, 1.6, 6, A.ink);
  }
  // Cinderbank: an open workshop canopy and service bays.
  if (landmarks.includes('cinder')) {
    b.box(-354, 5.5, 300, 62, 0.8, 29, A.terracotta);
    for (const x of [-382, -326]) for (const z of [289, 311]) b.box(x, 2.7, z, 0.7, 5.4, 0.7, A.ink);
    b.box(-354, 0.12, 300, 68, 0.24, 35, A.sidewalk, 0, 'ground');
    meshLettering(b, 'ILEX AUTO', -354, 5.5, 315, 0.38);
  }
  // Heights: a faceted water tower and triangular radio mast.
  if (landmarks.includes('tower')) {
    for (const x of [-381, -373]) for (const z of [-319, -311]) b.box(x, 13, z, 0.5, 26, 0.5, A.metal);
    b.add('cylinder', -377, 29, -315, 12, 8, 12, A.cream);
    b.add('cone', -377, 34, -315, 13, 3, 13, A.terracotta);
  }
  if (landmarks.includes('mast')) {
    for (const [x, z] of [[-491, -400], [-481, -400], [-486, -391]]) b.beam(x, 0, z, -486, 46, -397, 0.5, A.terracotta);
    for (let y = 7; y < 45; y += 7) b.box(-486, y, -397, 9 * (1 - y / 50), 0.3, 2, A.white);
  }
  // Quay cargo crane, distinct from the hotel skyline.
  if (landmarks.includes('crane')) {
    for (const x of [294, 300]) b.box(x, 18, 304, 0.8, 36, 0.8, A.mustard);
    b.box(317, 35, 304, 50, 1.6, 3, A.mustard);
    b.beam(297, 44, 304, 341, 35, 304, 0.32, A.ink);
    b.beam(297, 44, 304, 293, 35, 304, 0.32, A.ink);
    b.box(337, 25, 304, 0.12, 20, 0.12, A.ink);
    b.box(337, 15, 304, 2.4, 0.7, 1.1, A.ink);
  }
  if (landmarks.includes('containers')) {
    for (let i = 0; i < 12; i++) {
      const x = 282 + (i % 4) * 16, z = 377 + Math.floor(i / 4) * 13;
      b.box(x, 2.2 + (i % 3 === 0 ? 4.4 : 0), z, 13, 4.3, 8, [A.terracotta, A.blue, A.sage][i % 3]);
      for (let j = -5; j <= 5; j += 2) b.box(x + j, 2.2, z + 4.1, 0.12, 4.2, 0.15, A.metal);
    }
  }
  // Glasshook's original open triangular tidal gantry, visible from the Strand.
  if (landmarks.includes('glasshook')) {
    const { x, z, halfSpan } = GLASSHOOK_GANTRY, yaw = Math.PI / 2;
    b.box(564, 8, -290, 46, 16, 10, A.cream);
    for (const side of [-1, 1]) b.beam(x, 0, z + side * halfSpan, x, 56, z, 2.2, A.terracotta);
    b.box(x, 17, z, 42, 1.4, 2, A.terracotta, yaw);
    b.add('ring', x - 0.5, 29, z, 13, 13, 8, 0xf5e9c9, 0, yaw, -0.45);
    b.box(x, 55, z, 17, 0.7, 1.2, A.ink, yaw);
    b.box(x, 59, z, 0.5, 9, 0.5, A.ink);
    meshLettering(b, 'TIDAL RELAY', 564, 11, -284.8, 0.63, 0);
  }
}
