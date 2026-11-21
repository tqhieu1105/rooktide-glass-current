import { ART_DIRECTION as A } from './art-direction.js';
import { addPalm, districtSign, meshLettering } from './geometry.js';

export function createDistrictBuildings(world, b) {
  const palette = [A.cream, A.sage, A.coral, A.blue, A.mustard];
  for (const house of world.buildings) {
    const { x, z, width: w, depth: d, height: h, floors, variant, district } = house;
    const color = district === 'strand' ? [A.cream, A.cream, A.coral, A.sage, A.cream][house.color] : palette[house.color];
    b.box(x, h / 2, z, w, h, d, color);
    b.box(x, 1.55, z, w + 0.12, 3.1, d + 0.12, variant % 2 ? A.terracotta : A.ink);
    b.box(x, h + 0.25, z, w + 1, 0.5, d + 1, A.cream);
    b.box(x + w * 0.18, h + 0.9, z, w * 0.38, 1.3, d * 0.36, A.metal);
    for (let floor = 1; floor < floors; floor++) {
      const y = floor * 3.3 + 1.45;
      b.box(x, y, z + d / 2 + 0.08, w - 2.8, 1.5, 0.14, A.glass);
      b.box(x, y, z - d / 2 - 0.08, w - 2.8, 1.5, 0.14, A.darkGlass);
      b.box(x + w / 2 + 0.08, y, z, 0.14, 1.5, d - 2.8, A.glass);
      b.box(x - w / 2 - 0.08, y, z, 0.14, 1.5, d - 2.8, A.darkGlass);
      if (district === 'strand' || floor % 2 === 0) {
        b.box(x, y - 0.95, z + d / 2 + 0.35, w + 0.5, 0.17, 0.85, color);
        b.box(x + w / 2 + 0.35, y - 0.95, z, 0.85, 0.17, d + 0.5, color);
      }
    }
    for (let i = -1; i <= 1; i++) {
      b.box(x + i * w * 0.28, 1.5, z + d / 2 + 0.14, 3.4, 2.4, 0.18, A.glass);
      if (variant === 0) b.box(x + i * w * 0.28, h / 2, z + d / 2 + 0.35, 0.3, h, 0.65, A.terracotta);
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
  for (const palm of world.palms) addPalm(b, palm);
  for (const lamp of world.lamps) {
    b.box(lamp.x, 3.3, lamp.z, 0.17, 6.6, 0.17, A.metal);
    b.box(lamp.x + 0.8, 6.5, lamp.z, 1.8, 0.18, 0.25, A.metal);
    b.box(lamp.x + 1.3, 6.4, lamp.z, 0.8, 0.12, 0.4, A.white, 0, 'light');
  }
  for (const sign of world.signs) districtSign(b, sign);
  instanceCityLandmarks(b);
}

export function instanceCityLandmarks(b) {
  // Kiln plaza: glazed canopy, ceramic plinths and the broken floodgate motif.
  b.box(150, 0.12, 55, 76, 0.24, 66, A.cream, 0, 'ground');
  for (const x of [121, 145, 169]) {
    for (const z of [34, 76]) b.box(x, 3.6, z, 0.5, 7.2, 0.5, A.terracotta);
    b.box(x, 7.2, 55, 21, 0.4, 47, x === 145 ? A.terracotta : A.mustard);
  }
  b.add('ring', 184, 5, 62, 5, 5, 3, A.terracotta, 0, 0.4, 0.3);
  b.box(184, 0.8, 62, 11, 1.6, 6, A.ink);
  meshLettering(b, 'KILN', 145, 6, 79, 0.7);
  // Cinderbank: an open workshop canopy and service bays.
  b.box(-354, 5.5, 300, 62, 0.8, 29, A.terracotta);
  for (const x of [-382, -326]) for (const z of [289, 311]) b.box(x, 2.7, z, 0.7, 5.4, 0.7, A.ink);
  b.box(-354, 0.12, 300, 68, 0.24, 35, A.sidewalk, 0, 'ground');
  meshLettering(b, 'ILEX AUTO', -354, 5.5, 315, 0.38);
  // Heights: a faceted water tower and triangular radio mast.
  for (const x of [-381, -373]) for (const z of [-319, -311]) b.box(x, 13, z, 0.5, 26, 0.5, A.metal);
  b.add('cylinder', -377, 29, -315, 12, 8, 12, A.cream);
  b.add('cone', -377, 34, -315, 13, 3, 13, A.terracotta);
  for (const [x, z] of [[-491, -400], [-481, -400], [-486, -391]]) b.beam(x, 0, z, -486, 46, -397, 0.5, A.terracotta);
  for (let y = 7; y < 45; y += 7) b.box(-486, y, -397, 9 * (1 - y / 50), 0.3, 2, A.white);
  // Quay cargo crane, distinct from the hotel skyline.
  for (const x of [294, 300]) b.box(x, 18, 304, 0.8, 36, 0.8, A.mustard);
  b.box(317, 35, 304, 50, 1.6, 3, A.mustard);
  b.beam(297, 44, 304, 341, 35, 304, 0.32, A.ink);
  b.beam(297, 44, 304, 293, 35, 304, 0.32, A.ink);
  b.box(337, 25, 304, 0.12, 20, 0.12, A.ink);
  b.box(337, 15, 304, 2.4, 0.7, 1.1, A.ink);
  for (let i = 0; i < 12; i++) {
    const x = 282 + (i % 4) * 16, z = 377 + Math.floor(i / 4) * 13;
    b.box(x, 2.2 + (i % 3 === 0 ? 4.4 : 0), z, 13, 4.3, 8, [A.terracotta, A.blue, A.sage][i % 3]);
    for (let j = -5; j <= 5; j += 2) b.box(x + j, 2.2, z + 4.1, 0.12, 4.2, 0.15, A.metal);
  }
  // Glasshook's original open triangular tidal gantry, visible from the Strand.
  b.box(564, 8, -290, 46, 16, 10, A.cream);
  for (const x of [540, 590]) b.beam(x, 0, -249, 565, 56, -249, 2.2, A.terracotta);
  b.box(565, 17, -249, 42, 1.4, 2, A.terracotta);
  b.add('ring', 565, 29, -248.5, 13, 13, 8, A.cream, 0, 0, -0.45);
  b.box(565, 55, -249, 17, 0.7, 1.2, A.ink);
  b.box(565, 59, -249, 0.5, 9, 0.5, A.ink);
  meshLettering(b, 'TIDAL RELAY', 564, 11, -284.8, 0.63, 0);
}
