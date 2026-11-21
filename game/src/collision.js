const cellKey = (x, z) => x * 65536 + z;

export function buildCollisionGrid(colliders, cellSize = 32) {
  const cells = new Map();
  const memberships = new Map();
  function add(box) {
    const keys = [];
    for (let x = Math.floor(box.minX / cellSize); x <= Math.floor(box.maxX / cellSize); x++) {
      for (let z = Math.floor(box.minZ / cellSize); z <= Math.floor(box.maxZ / cellSize); z++) {
        const key = cellKey(x, z);
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(box);
        keys.push(key);
      }
    }
    memberships.set(box, keys);
    if (!colliders.includes(box)) colliders.push(box);
    return box;
  }
  function remove(box) {
    const keys = memberships.get(box);
    if (!keys) return false;
    for (const key of keys) {
      const cell = cells.get(key), index = cell.indexOf(box);
      if (index >= 0) cell.splice(index, 1);
      if (!cell.length) cells.delete(key);
    }
    memberships.delete(box);
    const index = colliders.indexOf(box);
    if (index >= 0) colliders.splice(index, 1);
    return true;
  }
  for (const box of [...colliders]) add(box);
  // Callers consume this scratch array before making another query.
  const result = [];
  function query(x, z, radius) {
    result.length = 0;
    const maxX = Math.floor((x + radius) / cellSize), maxZ = Math.floor((z + radius) / cellSize);
    const minZ = Math.floor((z - radius) / cellSize);
    for (let a = Math.floor((x - radius) / cellSize); a <= maxX; a++) {
      for (let b = minZ; b <= maxZ; b++) {
        const cell = cells.get(cellKey(a, b));
        if (cell) for (const box of cell) if (!result.includes(box)) result.push(box);
      }
    }
    return result;
  }
  return { query, add, remove, colliders, cellSize, circle: { x: 0, z: 0, hit: false }, motion: { hit: false, nx: 0, nz: 0 } };
}
export function resolveCircle(grid, x, z, radius) {
  let hit = false;
  for (let pass = 0; pass < 3; pass++) {
    let pushed = false;
    for (const box of grid.query(x, z, radius + 0.1)) {
      const qx = Math.max(box.minX, Math.min(box.maxX, x));
      const qz = Math.max(box.minZ, Math.min(box.maxZ, z));
      const dx = x - qx, dz = z - qz, squared = dx * dx + dz * dz;
      if (squared >= radius * radius) continue;
      hit = pushed = true;
      if (squared > 1e-10) {
        const push = radius / Math.sqrt(squared) - 1;
        x += dx * push; z += dz * push;
      } else {
        const left = x - box.minX, right = box.maxX - x, top = z - box.minZ, bottom = box.maxZ - z;
        const min = Math.min(left, right, top, bottom);
        if (min === left) x = box.minX - radius;
        else if (min === right) x = box.maxX + radius;
        else if (min === top) z = box.minZ - radius;
        else z = box.maxZ + radius;
      }
    }
    if (!pushed) break;
  }
  const result = grid.circle;
  result.x = x; result.z = z; result.hit = hit;
  return result;
}
export function moveBodyWithCollisions(grid, body, dx, dz, radius, heading = 0, halfWheelbase = 0) {
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.55));
  let hit = false, normalX = 0, normalZ = 0;
  const wx = Math.sin(heading) * halfWheelbase, wz = -Math.cos(heading) * halfWheelbase;
  const extent = halfWheelbase ? 1 : 0;
  for (let n = 0; n < count; n++) {
    let x = body.x + dx / count, z = body.z + dz / count;
    for (let offset = -extent; offset <= extent; offset++) {
      const cx = x + wx * offset, cz = z + wz * offset;
      const result = resolveCircle(grid, cx, cz, radius);
      if (result.hit) {
        const pushX = result.x - cx, pushZ = result.z - cz;
        x += pushX; z += pushZ; normalX += pushX; normalZ += pushZ; hit = true;
      }
    }
    body.x = x; body.z = z;
  }
  const length = Math.hypot(normalX, normalZ) || 1;
  const result = grid.motion;
  result.hit = hit; result.nx = normalX / length; result.nz = normalZ / length;
  return result;
}
export function isSpaceClear(grid, x, z, radius) {
  return !resolveCircle(grid, x, z, radius).hit;
}
