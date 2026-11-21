import { AVENUES, STREETS } from './config.js';

export function buildRoadGraph() {
  const nodes = [], edges = [];
  for (const x of AVENUES) for (const z of STREETS) nodes.push({ id: nodes.length, x, z, links: [] });
  const connect = (a, b, width = 22) => {
    edges.push({ a, b, width, x1: nodes[a].x, z1: nodes[a].z, x2: nodes[b].x, z2: nodes[b].z });
    nodes[a].links.push(b); nodes[b].links.push(a);
  };
  for (let a = 0; a < AVENUES.length; a++) for (let s = 0; s < STREETS.length; s++) {
    const n = a * STREETS.length + s;
    if (s < STREETS.length - 1) connect(n, n + 1, a === 5 ? 28 : 22);
    if (a < AVENUES.length - 1) connect(n, n + STREETS.length);
  }
  nodes.push({ id: nodes.length, x: 560, z: -240, links: [] });
  connect(5 * STREETS.length + 1, nodes.length - 1, 18);
  return { nodes, edges, avenues: AVENUES, streets: STREETS };
}
export function nearestRoadNode(graph, x, z) {
  let best = graph.nodes[0], distance = Infinity;
  for (const node of graph.nodes) {
    const d = Math.hypot(node.x - x, node.z - z);
    if (d < distance) { best = node; distance = d; }
  }
  return best;
}
export function findStreetRoute(graph, from, to) {
  const start = nearestRoadNode(graph, from.x, from.z).id;
  const end = nearestRoadNode(graph, to.x, to.z).id;
  const costs = graph.nodes.map(() => Infinity), previous = graph.nodes.map(() => -1);
  const open = new Set(graph.nodes.map(n => n.id));
  costs[start] = 0;
  while (open.size) {
    let current = -1;
    for (const id of open) if (current < 0 || costs[id] < costs[current]) current = id;
    if (current === end || costs[current] === Infinity) break;
    open.delete(current);
    const p = graph.nodes[current];
    for (const id of p.links) {
      const q = graph.nodes[id], cost = costs[current] + Math.hypot(p.x - q.x, p.z - q.z);
      if (cost < costs[id]) { costs[id] = cost; previous[id] = current; }
    }
  }
  const route = [];
  for (let id = end; id >= 0; id = previous[id]) { route.unshift(graph.nodes[id]); if (id === start) break; }
  return route;
}

// Snap both ends to street segments. A marker halfway up an avenue should
// route straight up the avenue, rather than back to the nearest intersection.
export function findWaypointRoute(graph, from, to) {
  function project(point) {
    let nearest;
    for (const edge of graph.edges) {
      const dx = edge.x2 - edge.x1, dz = edge.z2 - edge.z1;
      const t = Math.max(0, Math.min(1, ((point.x - edge.x1) * dx + (point.z - edge.z1) * dz) / (dx * dx + dz * dz)));
      const x = edge.x1 + dx * t, z = edge.z1 + dz * t;
      const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (!nearest || distance < nearest.distance) nearest = { edge, x, z, distance };
    }
    return nearest;
  }
  const start = project(from), end = project(to);
  if (start.edge === end.edge) return [start, end];
  const length = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  let shortest, shortestLength = Infinity;
  for (const a of [start.edge.a, start.edge.b]) for (const b of [end.edge.a, end.edge.b]) {
    const route = findStreetRoute(graph, graph.nodes[a], graph.nodes[b]);
    const score = length(start, route[0]) + length(end, route.at(-1))
      + route.slice(1).reduce((total, node, i) => total + length(route[i], node), 0);
    if (score < shortestLength) { shortestLength = score; shortest = route; }
  }
  return [start, ...shortest, end];
}
