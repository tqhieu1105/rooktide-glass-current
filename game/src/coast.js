import { ART_DIRECTION as A } from './art-direction.js';
import { AVENUES, STREETS } from './config.js';

export function createBeachAndHarbour(world, b) {
  b.box(-20, -1.5, 0, 1020, 3, 880, A.grass, 0, 'ground');
  b.box(463, -0.13, 0, 54, 0.25, 880, A.sand, 0, 'ground');
  b.box(445, 0.02, 0, 17, 0.08, 880, A.sidewalk, 0, 'ground');
  for (const x of AVENUES) {
    const w = x === 420 ? 28 : 22;
    b.box(x, 0.025, 0, w + 9, 0.05, 842, A.sidewalk, 0, 'ground');
    b.box(x, 0.07, 0, w, 0.06, 842, A.asphalt, 0, 'ground');
    for (const side of [-1, 1]) b.box(x + side * (w / 2 + 0.1), 0.12, 0, 0.25, 0.24, 842, A.curb, 0, 'ground');
    for (let z = -414; z < 419; z += 10) {
      if (STREETS.some(v => Math.abs(v - z) < 16)) continue;
      b.box(x - 0.17, 0.109, z, 0.12, 0.012, 5, A.mustard, 0, 'ground');
      b.box(x + 0.17, 0.109, z, 0.12, 0.012, 5, A.mustard, 0, 'ground');
      if (x === 420) for (const side of [-1, 1]) b.box(x + side * 7, 0.11, z, 0.12, 0.01, 3.5, A.roadLine, 0, 'ground');
    }
  }
  for (const z of STREETS) {
    b.box(-18, 0.03, z, 952, 0.06, 31, A.sidewalk, 0, 'ground');
    b.box(-18, 0.072, z, 952, 0.06, 22, A.asphalt, 0, 'ground');
    for (let x = -482; x < 440; x += 10) {
      if (AVENUES.some(v => Math.abs(v - x) < 18)) continue;
      b.box(x, 0.112, z, 5, 0.012, 0.18, A.roadLine, 0, 'ground');
    }
    for (const x of AVENUES) {
      // Clear intersections are asphalt, with zebra crossings on every approach.
      b.box(x, 0.106, z, x === 420 ? 28 : 22, 0.012, 22, A.asphalt, 0, 'ground');
      for (const side of [-1, 1]) for (let stripe = -8; stripe <= 8; stripe += 2.4) {
        b.box(x + stripe, 0.12, z + side * 15.2, 1.1, 0.018, 3, A.roadLine, 0, 'ground');
        b.box(x + side * (x === 420 ? 18 : 14.7), 0.12, z + stripe, 3, 0.018, 1.1, A.roadLine, 0, 'ground');
      }
    }
  }
  for (const box of world.colliders.filter(c => c.kind === 'seawall' || c.kind === 'boundary')) {
    b.box((box.minX + box.maxX) / 2, box.kind === 'seawall' ? 0.35 : 0.6,
      (box.minZ + box.maxZ) / 2, box.maxX - box.minX, box.kind === 'seawall' ? 0.7 : 1.2,
      box.maxZ - box.minZ, A.cream);
  }
  // Pier and working quay apron are physical geometry over the water.
  b.box(520, -0.12, 240, 122, 0.28, 20, A.trunk, 0, 'ground');
  for (let x = 471; x < 580; x += 6) b.box(x, 0.04, 240, 0.12, 0.035, 20, A.cream, 0, 'ground');
  for (const x of [480, 516, 552, 578]) for (const z of [232, 248]) b.box(x, -2.5, z, 0.6, 5, 0.6, A.ink);
  createGlasshookBridge(b);
}

export function createGlasshookBridge(b) {
  b.box(568, -1.2, -240, 86, 2.4, 132, A.sand, 0, 'ground');
  b.box(495, -0.12, -240, 142, 0.25, 22, A.sidewalk, 0, 'ground');
  b.box(495, 0.065, -240, 142, 0.08, 18, A.asphalt, 0, 'ground');
  for (let x = 441; x < 605; x += 9) b.box(x, 0.12, -240, 4.5, 0.02, 0.18, A.mustard, 0, 'ground');
  for (const z of [-251, -229]) {
    b.box(500, 0.7, z, 126, 0.18, 0.3, A.cream);
    b.box(500, 1.3, z, 126, 0.15, 0.25, A.metal);
    for (let x = 446; x < 564; x += 5) b.box(x, 0.65, z, 0.18, 1.3, 0.18, A.metal);
  }
  for (const x of [466, 506, 545]) for (const z of [-247, -233]) b.box(x, -3, z, 1.4, 6, 1.4, A.cream);
}
