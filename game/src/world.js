import { AVENUES, STREETS, DISTRICTS } from './config.js';
import { createRandom } from './random.js';
import { buildRoadGraph, nearestRoadNode } from './roads.js';
import { buildCollisionGrid } from './collision.js';

export function createRooktideCity(seed = 20261121) {
  const random = createRandom(seed);
  const roads = buildRoadGraph();
  const buildings = [], colliders = [], palms = [], lamps = [], signs = [];
  const world = { seed, roads, buildings, colliders, palms, lamps, signs, clock: 0, tick: 0,
    district: DISTRICTS[1], visited: new Set(), message: '', messageTime: 0 };
  for (let a = 0; a < AVENUES.length - 1; a++) for (let s = 0; s < STREETS.length - 1; s++) {
    const centerX = (AVENUES[a] + AVENUES[a + 1]) / 2;
    const centerZ = (STREETS[s] + STREETS[s + 1]) / 2;
    const district = getDistrictAt(centerX, centerZ).id;
    const plaza = a === 3 && s === 3;
    const yard = a === 0 && s === 4;
    for (let i = 0; i < 6; i++) {
      if (plaza && i < 4 || yard && i > 1) continue;
      const x = centerX + (i % 3 - 1) * 43;
      const z = centerZ + (Math.floor(i / 3) - 0.5) * 51;
      const width = 26 + random() * 10, depth = 29 + random() * 10;
      const floors = district === 'strand' ? 5 + Math.floor(random() * 9)
        : district === 'market' ? 2 + Math.floor(random() * 3)
          : district === 'quay' ? 2 + Math.floor(random() * 2) : 3 + Math.floor(random() * 6);
      const height = floors * 3.3;
      buildings.push({ x, z, width, depth, height, floors, district, variant: Math.floor(random() * 4), color: Math.floor(random() * 5) });
      addCollider(world, x, z, width + 0.3, depth + 0.3, height, 'building');
    }
  }
  for (const x of AVENUES) for (let z = -400; z <= 400; z += 34) {
    if (STREETS.some(v => Math.abs(v - z) < 16)) continue;
    const setback = x === 420 ? 19 : 16;
    palms.push({ x: x + setback, z, height: 8 + random() * 3.8, turn: random() * 6.28 });
    if (x !== -420) palms.push({ x: x - setback, z: z + 8, height: 7.5 + random() * 4, turn: random() * 6.28 });
    if (Math.floor(z) % 2 === 0) lamps.push({ x: x - setback + 1, z: z - 12 });
  }
  for (let z = -410; z < 420; z += 29) palms.push({ x: 469 + random() * 9, z, height: 9 + random() * 3, turn: random() * 6.28 });
  signs.push(
    { text: 'SAFFRON STRAND', x: 444, z: 65, yaw: 0, color: 0xc9845e },
    { text: 'KILN MARKET', x: 126, z: 19, yaw: 0, color: 0xc17659 },
    { text: 'RELAY QUAY', x: 298, z: 264, yaw: 0, color: 0x547c7b },
    { text: 'CINDERBANK', x: -374, z: 262, yaw: 0, color: 0x807d61 },
    { text: 'SWITCHBACK HEIGHTS', x: -373, z: -322, yaw: 0, color: 0x7c8b6b },
    { text: 'GLASSHOOK', x: 574, z: -267, yaw: Math.PI / 2, color: 0x4b8789 },
  );
  addCollider(world, 564, -290, 46, 10, 17, 'relay hall');
  addCollider(world, -377, -315, 10, 10, 38, 'water tower');
  addCollider(world, 297, 304, 8, 8, 38, 'crane');
  addCollider(world, -527, 0, 6, 900, 5, 'boundary');
  addCollider(world, 0, -445, 1060, 6, 5, 'boundary');
  addCollider(world, 0, 445, 1060, 6, 5, 'boundary');
  for (const [z, depth] of [[-352, 170], [-15, 410], [347, 192]]) addCollider(world, 489, z, 3, depth, 1.1, 'seawall');
  for (const z of [-251, -229]) addCollider(world, 500, z, 126, 1.2, 1.2, 'bridge rail');
  addCollider(world, 612, -240, 2, 132, 1, 'island edge');
  addCollider(world, 568, -305, 86, 2, 1, 'island edge');
  addCollider(world, 568, -175, 86, 2, 1, 'island edge');
  world.grid = buildCollisionGrid(colliders);
  return world;
}
export function addCollider(world, x, z, width, depth, height, kind) {
  world.colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, height, kind });
}
export function getDistrictAt(x, z) {
  if (x > 493 && z < -160) return DISTRICTS[5];
  if (x < -290 && z < -205) return DISTRICTS[4];
  if (x < -290 && z > 80) return DISTRICTS[3];
  if (z > 190) return DISTRICTS[2];
  if (x > 280) return DISTRICTS[0];
  return DISTRICTS[1];
}
export function isDryLand(x, z) {
  return (x > -530 && x < 489 && Math.abs(z) < 440)
    || (x >= 430 && x <= 611 && z > -251 && z < -229)
    || (x > 526 && x < 611 && z > -305 && z < -175)
    || (x > 445 && x < 581 && z > 230 && z < 250);
}
export function findSafeSpawn(world, x, z) {
  const node = nearestRoadNode(world.roads, x, z);
  return { x: node.x, z: node.z, heading: 0 };
}
export function showWorldMessage(world, text, seconds = 3) {
  world.message = text; world.messageTime = seconds;
}
