import { isSpaceClear } from './collision.js';

export function buildTrafficLanes(roads) {
  const outgoing = roads.nodes.map(() => []), lanes = [];
  for (const edge of roads.edges) {
    for (const from of [edge.a, edge.b]) {
      const to = from === edge.a ? edge.b : edge.a;
      const a = roads.nodes[from], b = roads.nodes[to];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const fx = (b.x - a.x) / length, fz = (b.z - a.z) / length;
      const side = edge.width === 18 ? 4 : 5.6;
      const start = a.links.length === 1 ? 9 : 13;
      const end = b.links.length === 1 ? 9 : 13;
      const lane = { from, to, fx, fz, length: length - start - end, heading: Math.atan2(fx, -fz),
        sx: a.x + fx * start - fz * side, sz: a.z + fz * start + fx * side,
        ex: b.x - fx * end - fz * side, ez: b.z - fz * end + fx * side, turns: [] };
      lanes.push(lane); outgoing[from].push(lane);
    }
  }
  for (const lane of lanes) for (const next of outgoing[lane.to]) {
    if (next.to === lane.from && outgoing[lane.to].length > 1) continue;
    const reach = next.to === lane.from ? 12 : 10;
    lane.turns.push({ next, ax: lane.ex + lane.fx * reach, az: lane.ez + lane.fz * reach,
      bx: next.sx - next.fx * reach, bz: next.sz - next.fz * reach,
      length: Math.max(18, Math.hypot(next.sx - lane.ex, next.sz - lane.ez) * 1.15) });
  }
  return lanes;
}

export function buildSidewalkLinks(world) {
  const { avenues, streets } = world.roads;
  const nodes = [], links = [];
  function corner(a, s, right, bottom) {
    const x = avenues[a] + (right ? 1 : -1) * (a === 5 ? 18 : 14.7);
    const z = streets[s] + (bottom ? 1 : -1) * 15.2;
    return { x, z, links: [] };
  }
  function connect(a, b, crossing = false) {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    for (let t = 0; t <= length; t += 3) {
      if (!isSpaceClear(world.grid, a.x + (b.x - a.x) * t / length, a.z + (b.z - a.z) * t / length, 0.65)) return;
    }
    const link = { a, b, length, crossing };
    a.links.push(link); b.links.push(link); links.push(link);
  }
  for (let a = 0; a < avenues.length; a++) {
    nodes[a] = [];
    for (let s = 0; s < streets.length; s++) {
      const nw = corner(a, s, false, false), ne = corner(a, s, true, false);
      const sw = corner(a, s, false, true), se = corner(a, s, true, true);
      nodes[a][s] = { nw, ne, sw, se };
      // These endpoints line up with the four painted crossings.
      if (!(a === 3 && s === 3)) connect(nw, ne, true); // keep the initial car approach clear
      connect(sw, se, true); connect(nw, sw, true); connect(ne, se, true);
      if (s) { connect(nodes[a][s - 1].sw, nw); connect(nodes[a][s - 1].se, ne); }
      if (a) { connect(nodes[a - 1][s].ne, nw); connect(nodes[a - 1][s].se, sw); }
    }
  }
  return links;
}
