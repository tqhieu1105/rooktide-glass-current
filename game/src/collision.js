export function buildCollisionGrid(colliders, cellSize = 32) {
  const cells = new Map();
  for (const box of colliders) {
    for (let x = Math.floor(box.minX / cellSize); x <= Math.floor(box.maxX / cellSize); x++) {
      for (let z = Math.floor(box.minZ / cellSize); z <= Math.floor(box.maxZ / cellSize); z++) {
        const key = `${x},${z}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(box);
      }
    }
  }
  function query(x, z, radius) {
    const result = new Set();
    for (let a = Math.floor((x - radius) / cellSize); a <= Math.floor((x + radius) / cellSize); a++) {
      for (let b = Math.floor((z - radius) / cellSize); b <= Math.floor((z + radius) / cellSize); b++) {
        for (const box of cells.get(`${a},${b}`) || []) result.add(box);
      }
    }
    return result;
  }
  return { query, colliders, cellSize };
}
export function resolveCircle(grid, x, z, radius) {
  let hit = false;
  for (let pass = 0; pass < 3; pass++) for (const box of grid.query(x, z, radius + 0.1)) {
    const qx = Math.max(box.minX, Math.min(box.maxX, x));
    const qz = Math.max(box.minZ, Math.min(box.maxZ, z));
    const dx = x - qx, dz = z - qz, distance = Math.hypot(dx, dz);
    if (distance >= radius) continue;
    hit = true;
    if (distance > 0.00001) {
      const push = (radius - distance) / distance;
      x += dx * push; z += dz * push;
    } else {
      const distances = [x - box.minX, box.maxX - x, z - box.minZ, box.maxZ - z];
      const side = distances.indexOf(Math.min(...distances));
      if (side === 0) x = box.minX - radius;
      if (side === 1) x = box.maxX + radius;
      if (side === 2) z = box.minZ - radius;
      if (side === 3) z = box.maxZ + radius;
    }
  }
  return { x, z, hit };
}
export function moveBodyWithCollisions(grid, body, dx, dz, radius, heading = 0, halfWheelbase = 0) {
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.55));
  let hit = false, normalX = 0, normalZ = 0;
  const fx = Math.sin(heading), fz = -Math.cos(heading);
  for (let n = 0; n < count; n++) {
    let x = body.x + dx / count, z = body.z + dz / count;
    for (const offset of halfWheelbase ? [-halfWheelbase, 0, halfWheelbase] : [0]) {
      const result = resolveCircle(grid, x + fx * offset, z + fz * offset, radius);
      if (result.hit) {
        const pushX = result.x - (x + fx * offset), pushZ = result.z - (z + fz * offset);
        x += pushX; z += pushZ; normalX += pushX; normalZ += pushZ; hit = true;
      }
    }
    body.x = x; body.z = z;
  }
  const length = Math.hypot(normalX, normalZ) || 1;
  return { hit, nx: normalX / length, nz: normalZ / length };
}
export function isSpaceClear(grid, x, z, radius) {
  return !resolveCircle(grid, x, z, radius).hit;
}
