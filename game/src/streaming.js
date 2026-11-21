import { createDistrictBuildings } from './buildings.js';
import { createGeometryBuilder } from './geometry.js';

const CHUNK_HALF = 96;

function distanceToChunk(target, chunk) {
  const dx = Math.max(0, Math.abs(target.x - chunk.x) - CHUNK_HALF);
  const dz = Math.max(0, Math.abs(target.z - chunk.z) - CHUNK_HALF);
  return Math.hypot(dx, dz);
}

export function createCityStreamer(scene, atlas, chunks) {
  const loaded = new Map();
  let totalBuilds = 0, totalUnloads = 0, loadMs = 0, maxLoaded = 0;
  let frame = 0, desiredCache = new Map(), lastQuality;

  function build(chunk, far) {
    const started = performance.now();
    const builder = createGeometryBuilder(scene, atlas);
    createDistrictBuildings(chunk, builder, far);
    const resources = builder.finish();
    const elapsed = performance.now() - started;
    loaded.set(chunk.id, { chunk, far, resources, elapsed });
    totalBuilds++;
    loadMs += elapsed;
    maxLoaded = Math.max(maxLoaded, loaded.size);
  }

  function release(id) {
    const entry = loaded.get(id);
    if (!entry) return;
    entry.resources.dispose();
    loaded.delete(id);
    totalUnloads++;
  }

  function plan(target, quality) {
    const nearRadius = quality === 'low' ? 195 : 245;
    const farRadius = quality === 'low' ? 305 : 470;
    const fullBudget = quality === 'low' ? 4 : 10;
    const chunkBudget = quality === 'low' ? 8 : 18;
    const candidates = chunks.map(chunk => {
      const distance = distanceToChunk(target, chunk);
      const resident = loaded.get(chunk.id);
      const detailed = distance <= nearRadius + (resident && !resident.far ? 48 : -24);
      const tier = detailed ? (resident && !resident.far ? 0 : 1) : (resident ? 2 : 3);
      return { chunk, distance, detailed, tier, rank: distance - (resident ? 24 : 0) };
    }).sort((a, b) => a.tier - b.tier || a.rank - b.rank);
    const selected = new Map();
    let full = 0;
    for (const item of candidates) {
      if (selected.size >= chunkBudget) break;
      if (item.distance > farRadius) continue;
      const detailed = item.detailed && full < fullBudget;
      if (detailed) full++;
      selected.set(item.chunk.id, { ...item, far: !detailed });
    }
    return selected;
  }

  function update(target, camera, quality) {
    frame++;
    if (frame % 8 === 0 || desiredCache.size === 0 || lastQuality !== quality) {
      desiredCache = plan(target, quality); lastQuality = quality;
    }
    const desired = desiredCache;
    const stale = [...loaded.values()].filter(({ chunk, far }) => {
      const next = desired.get(chunk.id);
      return !next || next.far !== far;
    }).sort((a, b) => distanceToChunk(target, b.chunk) - distanceToChunk(target, a.chunk));
    if (stale.length) {
      release(stale[0].chunk.id);
    } else {
      const pending = [...desired.values()].filter(({ chunk }) => !loaded.has(chunk.id));
      if (pending.length) {
        const next = pending[0];
        build(next.chunk, next.far);
      }
    }
    const drawDistance = quality === 'low' ? 245 : 420;
    for (const { resources } of loaded.values()) resources.updateDrawDistance(camera, drawDistance);
  }

  function prime(target, quality) {
    const desired = plan(target, quality);
    const pending = [...desired.values()].filter(item => !loaded.has(item.chunk.id));
    const selected = pending.find(item => !item.far) ?? pending[0];
    if (selected) build(selected.chunk, selected.far);
  }

  function diagnostics() {
    const activeDistricts = new Set([...loaded.values()].map(({ chunk }) => chunk.district));
    let detailedChunks = 0, lowDetailChunks = 0, instances = 0, batches = 0;
    for (const entry of loaded.values()) {
      if (entry.far) lowDetailChunks++; else detailedChunks++;
      instances += entry.resources.instances; batches += entry.resources.batches;
    }
    return { totalChunks: chunks.length, loadedChunks: loaded.size, activeDistricts: activeDistricts.size,
      detailedChunks, lowDetailChunks, instances, batches, maxLoadedChunks: maxLoaded,
      settled: desiredCache.size > 0 && loaded.size === desiredCache.size
        && [...desiredCache.values()].every(({ chunk, far }) => loaded.get(chunk.id)?.far === far),
      builds: totalBuilds, unloads: totalUnloads, cumulativeBuildMs: +loadMs.toFixed(2) };
  }

  return { update, prime, diagnostics, dispose() { for (const id of [...loaded.keys()]) release(id); } };
}
