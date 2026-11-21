import { angleDelta, clamp, damp } from './config.js';
import { isSpaceClear, moveBodyWithCollisions } from './collision.js';
import { findStreetRoute, nearestRoadNode } from './roads.js';
import { isDryLand, showWorldMessage } from './world.js';

const ESCAPE_SECONDS = [0, 10, 15, 20, 25, 30];
const CRIMES = {
  vehicle_theft: [100, 'Stolen car'], reckless_driving: [55, 'Reckless driving'],
  assault: [100, 'Pedestrian collision'], patrol_impact: [120, 'Patrol car hit'], mission_theft: [200, 'Marked vehicle stolen'],
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const deltaHeading = (from, to) => Math.atan2(to.x - from.x, from.z - to.z);

// Height-aware segment test. A helicopter can see over a low roof, but not through it.
export function hasPoliceSight(world, from, to, height) {
  const dx = to.x - from.x, dz = to.z - from.z;
  for (const box of world.grid.query((from.x + to.x) / 2, (from.z + to.z) / 2, Math.max(Math.abs(dx), Math.abs(dz)) / 2)) {
    if (box.kind !== 'building' && box.kind !== 'relay hall') continue;
    let near = 0, far = 1;
    for (let axis = 0; axis < 3; axis++) {
      const origin = axis === 0 ? from.x : axis === 1 ? from.z : height;
      const delta = axis === 0 ? dx : axis === 1 ? dz : 1.15 - height;
      const min = axis === 0 ? box.minX : axis === 1 ? box.minZ : 0;
      const max = axis === 0 ? box.maxX : axis === 1 ? box.maxZ : box.height;
      if (Math.abs(delta) < 1e-6) {
        if (origin < min || origin > max) { near = 2; break; }
      } else {
        const a = (min - origin) / delta, b = (max - origin) / delta;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      }
    }
    if (near <= far) return false;
  }
  return true;
}

export function createPoliceSystem(world, player, getCar, effects = {}) {
  const units = Array.from({ length: 5 }, (_, index) => ({ id: `RCP-0${index + 1}`, index,
    active: false, x: 0, z: 0, previousX: 0, previousZ: 0, heading: 0, vx: 0, vz: 0,
    speed: 0, condition: 100, route: [], routeIndex: 0, routeTimer: 0, mode: 'patrol',
    ramTell: 0, ramTime: 0, cooldown: 0, wobble: 0, bounce: 0, stuck: 0, sight: false }));
  const wanted = { level: 0, heat: 0, state: 'none', seen: false, unseen: 0, lastSeen: { x: 0, z: 0 },
    searchRadius: 0, incident: '', arrest: 0, outcome: '', checkpoint: null };
  const helicopter = { active: false, x: 0, y: 29, z: 0, heading: 0, bank: 0, orbit: 0,
    seen: false, target: { x: 0, z: 0 }, beamScale: 1 };
  const roadblocks = [];
  const lastCrime = new Map();
  let nextDispatch = 0, nextBlock = 0;
  const actor = () => player.inVehicle ? getCar() : player;
  const locate = () => ({ x: actor().x, z: actor().z, heading: actor().heading });

  function clear(message) {
    wanted.level = wanted.heat = wanted.unseen = wanted.searchRadius = wanted.arrest = 0;
    wanted.seen = false; wanted.state = 'none'; wanted.incident = '';
    helicopter.active = false;
    while (roadblocks.length) removeRoadblock(roadblocks.pop());
    for (const unit of units) if (unit.active) { unit.mode = 'disengage'; unit.routeTimer = 0; }
    if (message) showWorldMessage(world, message, 4);
  }

  function reportCrime(kind, x = actor().x, z = actor().z, witnessed = true) {
    const crime = CRIMES[kind];
    const cooldown = kind === 'vehicle_theft' ? 0.35 : 2.5;
    if (!crime || wanted.outcome || world.clock - (lastCrime.get(kind) ?? -Infinity) < cooldown) return false;
    if (!witnessed && !units.some(unit => unit.active && dist(unit, { x, z }) < 36 && hasPoliceSight(world, unit, { x, z }, 1.6))) return false;
    lastCrime.set(kind, world.clock);
    raiseHeat(wanted.level * 100 + wanted.heat + crime[0], crime[1], x, z);
    return true;
  }

  function reportMissionAlert(level, incident) {
    const p = actor();
    const total = wanted.level * 100 + wanted.heat;
    if (!wanted.outcome) raiseHeat(Math.max(total, level * 100), incident, p.x, p.z);
  }

  function raiseHeat(total, incident, x, z) {
    const previous = wanted.level;
    if (!previous) wanted.checkpoint = locate();
    wanted.level = Math.min(5, Math.floor(total / 100));
    wanted.heat = total >= 500 ? 99 : total % 100;
    wanted.incident = incident;
    if (wanted.level) {
      Object.assign(wanted.lastSeen, { x, z }); wanted.unseen = 0;
      if (!wanted.seen) wanted.state = 'responding';
      if (wanted.level > previous) { nextDispatch = world.clock; dispatch(); }
    }
    showWorldMessage(world, `RCP DISPATCH / ${incident} reported.`, 3);
  }

  function placeUnit(unit, x, z, heading, speed = 0) {
    Object.assign(unit, { active: true, x, z, previousX: x, previousZ: z, heading, speed,
      vx: Math.sin(heading) * speed, vz: -Math.cos(heading) * speed, condition: 100, route: [],
      routeIndex: 0, routeTimer: 0, mode: 'dispatch', ramTell: 0, ramTime: 0, cooldown: 0,
      bounce: 0, stuck: 0, sight: false });
  }

  // A scenario restores the same live pursuit actors and heat as a normal incident.
  function restorePursuit(level, patrolPositions = [], airPosition = null) {
    clear(); wanted.outcome = '';
    wanted.level = clamp(level, 1, 5); wanted.heat = 0; wanted.checkpoint = locate();
    wanted.state = 'responding'; wanted.incident = 'Vehicle theft'; Object.assign(wanted.lastSeen, locate());
    for (let i = 0; i < Math.min(level, patrolPositions.length); i++) placeUnit(units[i], ...patrolPositions[i]);
    if (airPosition && level >= 3) {
      const [x, y, z] = airPosition;
      Object.assign(helicopter, { active: true, x, y, z, orbit: Math.atan2(x - actor().x, z - actor().z) });
    }
    nextDispatch = world.clock; dispatch();
  }

  function dispatchPoint(unit) {
    const p = actor(), camera = effects.camera?.(), cx = camera?.position.x ?? p.x, cz = camera?.position.z ?? p.z;
    const matrix = camera?.matrixWorld.elements;
    const fx = Math.sin(p.heading), fz = -Math.cos(p.heading);
    let best = null, bestScore = Infinity;
    for (const edge of world.roads.edges) for (const t of [0.15, 0.5, 0.85]) {
      const x = edge.x1 + (edge.x2 - edge.x1) * t, z = edge.z1 + (edge.z2 - edge.z1) * t;
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < 100 || d > 180 || !isDryLand(x, z) || !isSpaceClear(world.grid, x, z, 2.4)) continue;
      if (units.some(other => other.active && Math.hypot(other.x - x, other.z - z) < 22)) continue;
      if (world.population?.vehicles.some(other => other.active && Math.hypot(other.x - x, other.z - z) < 9)) continue;
      // A new unit starts behind the camera or behind a building.
      const depth = matrix ? -(x - cx) * matrix[8] - (z - cz) * matrix[10] : (x - cx) * fx + (z - cz) * fz;
      if (depth > Math.hypot(x - cx, z - cz) * 0.72 && hasPoliceSight(world, { x: cx, z: cz }, { x, z }, camera?.position.y ?? 1.6)) continue;
      const approach = ((x - p.x) * fx + (z - p.z) * fz) / d;
      const score = Math.abs(d - 135) + Math.abs(approach - (unit.index % 2 ? 0.6 : -0.6)) * 16;
      if (score < bestScore) { best = { x, z, edge }; bestScore = score; }
    }
    return best;
  }

  function dispatch() {
    if (!wanted.level) return;
    for (const unit of units.slice(0, wanted.level)) {
      if (unit.active && unit.mode !== 'disengage') continue;
      if (unit.active) { unit.mode = 'dispatch'; unit.routeTimer = 0; continue; }
      const start = dispatchPoint(unit);
      if (!start) continue;
      const a = world.roads.nodes[start.edge.a], b = world.roads.nodes[start.edge.b];
      const next = dist(a, wanted.lastSeen) < dist(b, wanted.lastSeen) ? a : b;
      placeUnit(unit, start.x, start.z, deltaHeading(start, next), 8);
    }
    if (wanted.level >= 3 && !helicopter.active) {
      const p = actor();
      helicopter.active = true; helicopter.orbit = p.heading;
      helicopter.x = p.x - Math.sin(p.heading) * 145;
      helicopter.z = p.z + Math.cos(p.heading) * 145; helicopter.y = 31;
      helicopter.target.x = p.x; helicopter.target.z = p.z;
    }
    nextDispatch = world.clock + 1.2;
  }

  function roadblocksTick(p) {
    const cap = Math.max(0, wanted.level - 3);
    for (let i = roadblocks.length - 1; i >= 0; i--) {
      if (dist(roadblocks[i], p) > 205) removeRoadblock(roadblocks.splice(i, 1)[0]);
    }
    if (!cap || roadblocks.length >= cap || world.clock < nextBlock || !wanted.seen) return;
    nextBlock = world.clock + 1;
    const fx = Math.sin(p.heading), fz = -Math.cos(p.heading);
    const preferred = 78 + 43 * roadblocks.length;
    let best, bestScore = Infinity;
    for (const node of world.roads.nodes) for (const id of node.links) {
      const to = world.roads.nodes[id], d = dist(node, to);
      if (node.links.length < 3 || to.x > 480) continue;
      const ux = (to.x - node.x) / d, uz = (to.z - node.z) / d;
      if (ux * fx + uz * fz < 0.76) continue;
      const x = node.x - 19 * ux, z = node.z - 19 * uz;
      if (!world.roads.nodes[node.id].links.some(other => {
        const previous = world.roads.nodes[other];
        return (node.x - previous.x) * ux + (node.z - previous.z) * uz > 30;
      })) continue;
      const dx = x - p.x, dz = z - p.z, advance = dx * fx + dz * fz;
      const lateral = Math.abs(dx * fz - dz * fx);
      if (advance < 46 || advance > 155 || lateral > 32 || !isDryLand(x, z)) continue;
      if (roadblocks.some(block => dist(block, { x, z }) < 58)) continue;
      if (world.population?.vehicles.some(vehicle => vehicle.active && dist(vehicle, { x, z }) < 11)) continue;
      if (units.some(unit => unit.active && dist(unit, { x, z }) < 12)) continue;
      const score = Math.abs(advance - preferred) + lateral * 2;
      if (score < bestScore) { best = { x, z, ux, uz }; bestScore = score; }
    }
    if (!best) return;
    addRoadblock(best);
    showWorldMessage(world, 'RCP ROADBLOCK / Leave the gap. Those cones are union.', 4);
  }

  function placeBridgeRoadblock() {
    while (roadblocks.length) removeRoadblock(roadblocks.pop());
    addRoadblock({ x: 499, z: -240, ux: -1, uz: 0 });
  }

  function addRoadblock(site) {
    const block = { ...site, nx: -site.uz, nz: site.ux, warning: 0, segments: [] };
    // Leave a full 5.6 m gap on the right side of the direction of travel.
    for (const [left, right] of [[-10.6, 2.8], [8.4, 10.6]]) {
      const center = (left + right) / 2, length = right - left;
      const x = block.x + block.nx * center, z = block.z + block.nz * center;
      const horizontal = site.ux === 0, xSize = horizontal ? length / 2 : 0.8, zSize = horizontal ? 0.8 : length / 2;
      const box = world.grid.add({ minX: x - xSize, maxX: x + xSize, minZ: z - zSize, maxZ: z + zSize, height: 1.4, kind: 'roadblock' });
      block.segments.push({ x, z, length, horizontal, box });
    }
    roadblocks.push(block);
  }

  function removeRoadblock(block) { for (const segment of block.segments) world.grid.remove(segment.box); }

  function steerUnit(unit, p, dt) {
    unit.previousX = unit.x; unit.previousZ = unit.z;
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    unit.bounce = Math.max(0, unit.bounce - dt * 1.5);
    unit.routeTimer -= dt;
    const distance = dist(unit, p), response = wanted.level > 0 && unit.mode !== 'disengage';
    const sight = response && unit.sight;
    const predicted = sight ? { x: p.x + p.vx * (1 + unit.index * 0.38), z: p.z + p.vz * (1 + unit.index * 0.38) } : wanted.lastSeen;
    let goal = predicted;
    if (!response || !sight || distance > 50) {
      if (unit.routeTimer <= 0 || !unit.route.length) {
        const start = nearestRoadNode(world.roads, unit.x, unit.z);
        let target = response ? nearestRoadNode(world.roads, predicted.x, predicted.z)
          : world.roads.nodes[start.links[(unit.index + 1) % start.links.length]];
        if (response && wanted.state === 'search' && target === start && dist(unit, target) < 25) {
          target = world.roads.nodes[target.links[(unit.index + Math.floor(world.clock / 5)) % target.links.length]];
        }
        unit.route = findStreetRoute(world.roads, start, target);
        unit.routeIndex = 0;
        const next = unit.route[1];
        if (next && ((unit.x - start.x) * (next.x - start.x) + (unit.z - start.z) * (next.z - start.z) > 0 || dist(unit, start) < 7)) unit.routeIndex = 1;
        unit.routeTimer = 1.1 + unit.index * 0.19;
      }
      while (unit.routeIndex < unit.route.length - 1 && dist(unit, unit.route[unit.routeIndex]) < 7) unit.routeIndex++;
      goal = unit.route[unit.routeIndex] || predicted;
      if (response && dist(unit, goal) < 7 && hasPoliceSight(world, unit, predicted, 1.55)) goal = predicted;
    }
    if (response) unit.mode = sight ? 'pursuit' : wanted.state === 'search' ? 'search' : 'dispatch';
    const alignment = Math.cos(angleDelta(unit.heading, deltaHeading(unit, p)));
    if (wanted.level >= 2 && sight && player.inVehicle && distance > 7 && distance < 21 && alignment > 0.76 && unit.speed > 8 && !unit.cooldown) {
      unit.ramTell = 0.65; unit.ramTime = 1.55; unit.cooldown = 4.8;
    }
    unit.ramTell = Math.max(0, unit.ramTell - dt); unit.ramTime = Math.max(0, unit.ramTime - dt);
    if (unit.ramTime && sight) unit.mode = 'ramming';
    const error = angleDelta(unit.heading, deltaHeading(unit, goal));
    let pace = response ? (unit.mode === 'ramming' && !unit.ramTell ? 25 : 17 + wanted.level * 1.1) : 10;
    if (Math.abs(error) > 0.6) pace = Math.min(pace, 8.5);
    if (sight && distance < 8 && unit.mode !== 'ramming') pace = Math.min(pace, p.speed + 1.3);
    if (unit.condition < 25) pace = Math.min(pace, 10);
    unit.speed = damp(unit.speed, pace, 2.4, dt);
    unit.heading += clamp(error * 2.3, -1.95, 1.95) * dt;
    unit.wobble = Math.sin(world.clock * 3.2 + unit.index) * 0.034 + error * Math.min(0.07, unit.speed * 0.003);
    unit.vx = Math.sin(unit.heading) * unit.speed; unit.vz = -Math.cos(unit.heading) * unit.speed;
    const collision = moveBodyWithCollisions(world.grid, unit, unit.vx * dt, unit.vz * dt, 0.98, unit.heading, 1.27);
    if (collision.hit) {
      if (unit.speed > 6) { unit.condition = Math.max(15, unit.condition - 2); unit.bounce = 0.22; }
      unit.speed *= 0.62;
      unit.heading += Math.sign(collision.nx * Math.cos(unit.heading) + collision.nz * Math.sin(unit.heading) || 1) * 0.19;
    }
    if (!isDryLand(unit.x, unit.z)) { unit.x = unit.previousX; unit.z = unit.previousZ; unit.speed = 0; unit.heading += 0.22; }
    unit.stuck = unit.speed < 2 ? unit.stuck + dt : 0;
    if (unit.stuck > 1.2) { unit.heading += 0.6; unit.routeTimer = 0; unit.stuck = 0; }
    if (response && player.inVehicle) patrolContact(unit, p);
    if (!response && (dist(unit, p) > 120 || !hasPoliceSight(world, unit, p, 1.55) && dist(unit, p) > 35)) unit.active = false;
  }

  function patrolContact(unit, car) {
    const dx = car.x - unit.x, dz = car.z - unit.z, d = Math.hypot(dx, dz);
    if (d > 5 || d < 0.01) return;
    const nx = dx / d, nz = dz / d;
    const reach = 1.9 + 1.25 * (Math.abs(nx * Math.sin(unit.heading) - nz * Math.cos(unit.heading))
      + Math.abs(nx * Math.sin(car.heading) - nz * Math.cos(car.heading)));
    if (d >= reach) return;
    const copApproach = unit.vx * nx + unit.vz * nz;
    const closing = copApproach - car.vx * nx - car.vz * nz;
    if (closing <= 0) return;
    unit.speed *= 0.72;
    car.vx += nx * closing * 0.40; car.vz += nz * closing * 0.40;
    car.speed = Math.hypot(car.vx, car.vz);
    if (closing < 5 || car.impactCooldown > 0) return;
    const rammed = unit.ramTime > 0 && !unit.ramTell && copApproach > 6;
    car.impactCooldown = 0.8;
    car.condition = Math.max(1, car.condition - (rammed ? 7 : 2.5));
    car.bounceVelocity = Math.min(4, closing * 0.24);
    unit.bounce = 0.36; unit.condition = Math.max(15, unit.condition - (rammed ? 8 : 13)); unit.ramTime = 0;
    effects.sparks?.((unit.x + car.x) / 2, (unit.z + car.z) / 2, 18);
    if (!rammed && -car.vx * nx - car.vz * nz > 4) reportCrime('patrol_impact', car.x, car.z);
    if (rammed) showWorldMessage(world, 'RCP RAMMING / Their bumper has filed a complaint.', 2.5);
  }

  function stepAir(p, dt) {
    const h = helicopter;
    const target = wanted.lastSeen;
    h.orbit += dt * 0.25;
    const radius = wanted.state === 'search' ? 41 : 56;
    const x = target.x + Math.sin(h.orbit) * radius, z = target.z + Math.cos(h.orbit) * radius;
    const dx = x - h.x, dz = z - h.z, pace = Math.min(22, Math.hypot(dx, dz) * 0.43);
    const angle = Math.atan2(dx, dz);
    h.x += Math.sin(angle) * pace * dt; h.z += Math.cos(angle) * pace * dt;
    h.y = damp(h.y, 29 + Math.sin(world.clock * 1.8) * 1.35, 1.3, dt);
    const headingError = angleDelta(h.heading, deltaHeading(h, target));
    h.heading += headingError * Math.min(1, dt * 2.4);
    h.bank = Math.sin(h.orbit) * 0.15 + Math.sin(world.clock * 3.8) * 0.046;
    const radiusFromPlayer = dist(h, p);
    const onTarget = dist(p, target) < 37;
    h.seen = radiusFromPlayer < 111 && onTarget && hasPoliceSight(world, h, p, h.y);
    h.target.x = target.x; h.target.z = target.z;
    h.beamScale = h.seen ? 1 : 0.76 + Math.sin(world.clock * 3) * 0.11;
  }

  function step(dt, actions = {}) {
    const p = actor();
    if (wanted.outcome) return;
    if (player.health <= 0) { wanted.outcome = 'defeated'; return; }
    if (!wanted.level) {
      for (const unit of units) if (unit.active) steerUnit(unit, p, dt);
      if (world.clock - (lastCrime.get('reckless_driving') ?? -Infinity) > 6) wanted.heat = Math.max(0, wanted.heat - 4 * dt);
      return;
    }
    if (world.clock >= nextDispatch) dispatch();
    let visible = false, close = false;
    for (const unit of units) if (unit.active) {
      const distance = dist(unit, p);
      unit.sight = distance < 84 && hasPoliceSight(world, unit, p, 1.65);
      if (unit.sight) {
        visible = true; close ||= distance < 8;
        if (distance < 24) effects.alarm?.(unit.x, unit.z);
      }
    }
    if (helicopter.active) { stepAir(p, dt); visible ||= helicopter.seen; }
    wanted.seen = visible;
    if (visible) {
      wanted.unseen = 0; wanted.state = 'pursuit';
      wanted.lastSeen.x = p.x; wanted.lastSeen.z = p.z;
    } else {
      wanted.unseen += dt;
      wanted.state = wanted.unseen >= 1.6 ? 'search' : 'responding';
      if (wanted.unseen >= ESCAPE_SECONDS[wanted.level]) {
        clear('RCP DISENGAGE / No visual. Clean getaway.'); return;
      }
    }
    wanted.searchRadius = Math.min(126, 20 + wanted.level * 12 + wanted.unseen * 1.5);
    const surrender = actions.handbrake && !actions.forward && !actions.right;
    const immobilized = player.inVehicle && p.condition < 20;
    wanted.arrest = close && p.speed < 1.2 && (surrender || immobilized) ? wanted.arrest + dt : 0;
    if (wanted.arrest > 1.8) wanted.outcome = 'busted';
    if (wanted.outcome) return;
    roadblocksTick(p);
    for (const block of roadblocks) block.warning = world.clock * 8;
    for (const unit of units) if (unit.active) steerUnit(unit, p, dt);
  }

  function reset(despawn = false) {
    clear(); wanted.outcome = ''; wanted.checkpoint = null; lastCrime.clear();
    if (despawn) for (const unit of units) unit.active = false;
  }
  function snapshot() {
    const p = actor();
    return { ...wanted, heat: Math.round(wanted.heat), lastSeen: { ...wanted.lastSeen }, escapeSeconds: ESCAPE_SECONDS[wanted.level],
      units: units.filter(unit => unit.active).map(({ id, x, z, speed, mode, condition, ramTell }) => ({
        id, x, z, speed, mode, condition: Math.round(condition), ramTell, distance: dist({ x, z }, p) })),
      helicopter: helicopter.active ? { id: 'KITE-1', x: helicopter.x, y: helicopter.y, z: helicopter.z,
        seen: helicopter.seen, distance: dist(helicopter, p) } : null,
      roadblocks: roadblocks.map(block => ({ x: block.x, z: block.z, distance: dist(block, p) })) };
  }
  return { units, wanted, helicopter, roadblocks, reportCrime, reportMissionAlert, placeBridgeRoadblock, restorePursuit, reset, step, snapshot };
}
