import { angleDelta, clamp, damp, PLAYER_TUNING } from './config.js';
import { createRandom } from './random.js';
import { createVehicle, stepArcadeDriving } from './vehicles.js';
import { isDryLand, showWorldMessage } from './world.js';
import { isSpaceClear, moveBodyWithCollisions } from './collision.js';
import { buildSidewalkLinks, buildTrafficLanes } from './population-routes.js';

const TYPES = ['compact', 'saloon', 'van', 'pickup'];
const PAINT = [0xf8ad45, 0xf0809a, 0x59b4ad, 0x7a8ad4, 0xe9d6a8, 0x985c9c, 0x72a974, 0xee7553];
const PARKING_COUNT = 8;
const BRIDGE_ISLAND_X = 560;
const RECYCLING_RANGE = 310;
const distSq = (x, z, a) => (x - a.x) ** 2 + (z - a.z) ** 2;
const blank = { forward: 0, right: 0, handbrake: false };

export function createPopulation(world, firstCar) {
  const random = createRandom(world.seed ^ 0xca921);
  const lanes = buildTrafficLanes(world.roads);
  const walks = buildSidewalkLinks(world);
  const reservations = new Int16Array(world.roads.nodes.length).fill(-1);
  const cars = Array.from({ length: 26 }, (_, i) => Object.assign(createVehicle(0, 0), {
    id: `civilian-${i + 1}`, type: TYPES[i % TYPES.length], paint: PAINT[i % PAINT.length],
    slot: i, parked: i < PARKING_COUNT, wrecked: false, active: false, claimed: false, lane: null, turn: null,
    distance: 0, cruise: 8 + random() * 5, blocked: 0, knock: 0, spin: 0,
  }));
  const vehicles = [firstCar, ...cars];
  firstCar.active = true;
  const people = Array.from({ length: 48 }, (_, i) => ({ x: 0, z: 0, previousX: 0, previousZ: 0,
    heading: 0, active: false, link: null, from: null, distance: 0, pace: 1.1 + random() * 0.85,
    phase: random() * 6, pause: 0, panic: 0, tumble: 0, directionX: 0, directionZ: 0, returning: false,
    paint: PAINT[i % PAINT.length], skin: [0xd29a6c, 0x955d45, 0xe8b987, 0x734d38][i % 4], fish: i % 13 === 0 }));
  const sparks = Array.from({ length: 28 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));
  let low = true, spawnTick = 0, sparkCursor = 0;
  let crossings = 0, stumbles = 0, impacts = 0, thefts = 0;
  let lastWitness = false, lastStaticImpact = 0;
  const pop = { cars, vehicles, people, sparks, step, seedNear, findEnterable, claim, alarmAt, setQuality,
    snapshot: () => ({ cars: cars.filter(car => car.active).length, walkers: people.filter(p => p.active).length,
      parked: cars.filter(car => car.active && car.parked && !car.claimed).length, crossings, stumbles, impacts, thefts,
      lastWitness, vehicles: vehicles.filter(car => car.active).map(car => ({ id: car.id, type: car.type,
        x: car.x, z: car.z, speed: car.speed, heading: car.heading, claimed: !!car.claimed, parked: !!car.parked })) }) };

  function setQuality(value) { low = value === 'low'; }
  function wantedCar(car) { return car.parked ? car.slot < (low ? 4 : 8) : car.slot < (low ? 18 : 26); }
  function hidden(x, z, actor, camera) {
    const dx = x - actor.x, dz = z - actor.z;
    const distance = dx * dx + dz * dz;
    return distance > 450 ** 2 || (distance > 110 ** 2 && dx * Math.sin(camera.heading) - dz * Math.cos(camera.heading) < -15);
  }
  function freeCarSlot(x, z, car) {
    for (const other of vehicles) if (other !== car && other.active && distSq(x, z, other) < 12 ** 2) return false;
    return isDryLand(x, z) && isSpaceClear(world.grid, x, z, 2.4);
  }
  function release(car) {
    if (car.turn && reservations[car.lane.to] === car.slot) reservations[car.lane.to] = -1;
    car.turn = null;
  }
  function spawnCar(car, actor, camera, near = false) {
    const start = Math.floor(random() * lanes.length);
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[(start + i) % lanes.length];
      if (car.parked && (world.roads.nodes[lane.from].x === BRIDGE_ISLAND_X || world.roads.nodes[lane.to].x === BRIDGE_ISLAND_X)) continue;
      const progress = lane.length * (0.14 + random() * 0.72);
      const boulevard = lane.fz !== 0 && world.roads.nodes[lane.from].x === 420;
      const offset = car.parked ? (boulevard ? 5.6 : 3.4) : 0;
      const x = lane.sx + progress * lane.fx - lane.fz * offset;
      const z = lane.sz + progress * lane.fz + lane.fx * offset;
      const range = distSq(x, z, actor);
      const limit = camera ? 305 : near ? 78 : 250;
      if (range > limit ** 2 || range < (near ? 25 : 16) ** 2) continue;
      if (near && (x - actor.x) * Math.sin(actor.heading) - (z - actor.z) * Math.cos(actor.heading) < 8) continue;
      if (camera && !hidden(x, z, actor, camera) || !freeCarSlot(x, z, car)) continue;
      release(car);
      car.lane = lane; car.distance = progress; car.x = car.previousX = x; car.z = car.previousZ = z;
      car.heading = lane.heading; car.speed = car.parked ? 0 : car.cruise * .7;
      car.vx = lane.fx * car.speed; car.vz = lane.fz * car.speed;
      car.braking = false; car.steer = car.blocked = car.knock = car.spin = car.bounce = 0;
      car.wrecked = car.obstacle = false;
      car.active = true;
      return;
    }
  }
  function spawnWalker(p, actor, camera, near = false) {
    const start = Math.floor(random() * walks.length);
    for (let i = 0; i < walks.length; i++) {
      const link = walks[(start + i) % walks.length];
      if (link.crossing) continue;
      const t = 0.1 + random() * 0.8, x = link.a.x + (link.b.x - link.a.x) * t, z = link.a.z + (link.b.z - link.a.z) * t;
      const range = distSq(x, z, actor);
      if (range > (camera ? 290 : near ? 60 : 138) ** 2 || range < 8 ** 2 || camera && !hidden(x, z, actor, camera)) continue;
      if (near && (x - actor.x) * Math.sin(actor.heading) - (z - actor.z) * Math.cos(actor.heading) < 5) continue;
      p.from = link.a; p.link = link; p.distance = link.length * t;
      p.x = p.previousX = x; p.z = p.previousZ = z;
      p.heading = Math.atan2(link.b.x - link.a.x, link.a.z - link.b.z);
      p.active = true; p.pause = random() * 1.6; p.panic = p.tumble = 0; p.returning = false;
      return;
    }
  }
  function seedNear(actor) {
    for (const car of cars) if (wantedCar(car)) {
      if (car.slot === 0 || car.slot === PARKING_COUNT || car.slot === PARKING_COUNT + 1) spawnCar(car, actor, null, true);
      if (!car.active) spawnCar(car, actor, null);
    }
    for (let i = 0; i < (low ? 24 : 48); i++) {
      if (i < 4) spawnWalker(people[i], actor, null, true);
      if (!people[i].active) spawnWalker(people[i], actor, null);
    }
  }
  function recycle(actor, camera) {
    for (const car of cars) {
      if (car.claimed) continue;
      if (car.active && !hidden(car.x, car.z, actor, camera)) continue;
      if (!wantedCar(car)) { release(car); car.active = false; }
      else if (!car.active || distSq(car.x, car.z, actor) > RECYCLING_RANGE ** 2 || car.wrecked || car.blocked > 12) {
        release(car); car.active = false; spawnCar(car, actor, camera);
      }
    }
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p.active && !hidden(p.x, p.z, actor, camera)) continue;
      if (i >= (low ? 24 : 48)) p.active = false;
      else if (!p.active || distSq(p.x, p.z, actor) > RECYCLING_RANGE ** 2) { p.active = false; spawnWalker(p, actor, camera); }
    }
  }
  function findEnterable(player) {
    let closest = null, distance = PLAYER_TUNING.enterDistance ** 2;
    for (const car of vehicles) {
      if (!car.active || car.speed > 5 || car.knock > 0) continue;
      const d = distSq(player.x, player.z, car);
      if (d < distance) { closest = car; distance = d; }
    }
    return closest;
  }
  function claim(car) {
    release(car);
    if (car === firstCar || car.claimed) return;
    car.claimed = true;
    thefts++;
    lastWitness = false;
    for (const p of people) if (p.active && distSq(p.x, p.z, car) < 24 ** 2) { lastWitness = true; break; }
    if (lastWitness) showWorldMessage(world, 'Someone saw that. Probably everyone.', 3);
  }
  function westEastGreen(node) { return (world.clock + node * 1.1) % 13 >= 6.5; }
  function blockedAhead(car, fx, fz, range, side, player) {
    for (const other of vehicles) {
      if (other === car || !other.active) continue;
      const x = other.x - car.x, z = other.z - car.z;
      const forward = x * fx + z * fz;
      if (forward > -1 && forward < range && Math.abs(x * fz - z * fx) < side) return true;
    }
    for (const p of people) {
      if (!p.active) continue;
      const x = p.x - car.x, z = p.z - car.z, forward = x * fx + z * fz;
      if (forward > -0.3 && forward < range && Math.abs(x * fz - z * fx) < side * .7) return true;
    }
    const x = player.x - car.x, z = player.z - car.z;
    const forward = x * fx + z * fz;
    return !player.inVehicle && forward > -0.3 && forward < range && Math.abs(x * fz - z * fx) < side * .7;
  }
  function tickTraffic(car, player, dt, think) {
    const lane = car.lane;
    car.previousX = car.x; car.previousZ = car.z;
    const fx = Math.sin(car.heading), fz = -Math.cos(car.heading);
    if (car.knock > 0) {
      car.knock = Math.max(0, car.knock - dt);
      car.heading += car.spin * dt;
      moveBodyWithCollisions(world.grid, car, car.vx * dt, car.vz * dt, 1.1);
      car.vx *= .956; car.vz *= .956;
      if (!isDryLand(car.x, car.z)) { car.x = car.previousX; car.z = car.previousZ; }
      if (!car.knock) { car.speed = 0; car.wrecked = true; car.blocked = 20; release(car); }
      return;
    }
    if (car.parked || car.wrecked) return;
    const left = lane.length - car.distance;
    const green = westEastGreen(lane.to) === (lane.fx !== 0) && reservations[lane.to] === -1;
    if (think) car.obstacle = blockedAhead(car, fx, fz, 5 + car.speed * .65, 2.35, player);
    let target = car.turn ? Math.min(7, car.cruise) : car.cruise;
    if ((!green || car.obstacle) && !car.turn) target = Math.min(target, left * 1.8);
    if (car.obstacle) target = car.turn ? Math.min(target, 1.8) : 0;
    car.braking = target < car.speed - .2;
    car.speed = damp(car.speed, target, car.braking ? 5.5 : 2.2, dt);
    car.blocked = car.speed < 0.3 ? car.blocked + dt : 0;
    car.distance += car.speed * dt;
    if (car.turn) {
      const turn = car.turn, next = turn.next;
      const t = Math.min(1, car.distance / turn.length), u = 1 - t;
      car.x = u * u * u * lane.ex + 3 * u * u * t * turn.ax + 3 * u * t * t * turn.bx + t * t * t * next.sx;
      car.z = u * u * u * lane.ez + 3 * u * u * t * turn.az + 3 * u * t * t * turn.bz + t * t * t * next.sz;
      if (t >= 1) { release(car); car.lane = next; car.distance = 0; crossings++; }
    } else {
      car.distance = Math.min(car.distance, lane.length);
      car.x = lane.sx + lane.fx * car.distance; car.z = lane.sz + lane.fz * car.distance;
      if (car.distance >= lane.length - .25 && green && !car.obstacle) {
        const first = Math.floor(random() * lane.turns.length);
        for (let i = 0; i < lane.turns.length; i++) {
          const turn = lane.turns[(first + i) % lane.turns.length];
          if (!freeExit(car, turn.next)) continue;
          reservations[lane.to] = car.slot; car.turn = turn; car.distance = 0;
          break;
        }
      }
    }
    car.vx = (car.x - car.previousX) / dt; car.vz = (car.z - car.previousZ) / dt;
    if (Math.abs(car.vx) + Math.abs(car.vz) > .05) car.heading += clamp(angleDelta(car.heading, Math.atan2(car.vx, -car.vz)), -.11, .11);
  }
  function freeExit(car, lane) {
    for (const other of vehicles) {
      if (other !== car && other.active && distSq(lane.sx, lane.sz, other) < 7 ** 2) return false;
    }
    return true;
  }
  function scare(p, x, z, hit) {
    const startsTumble = hit && p.tumble === 0;
    if (startsTumble) { p.tumble = .65; stumbles++; }
    if (!p.panic || startsTumble) {
      const dx = p.x - x, dz = p.z - z, length = Math.hypot(dx, dz) || 1;
      p.directionX = dx / length; p.directionZ = dz / length;
    }
    p.panic = hit ? 1.25 : Math.max(p.panic, .85);
    p.returning = true;
  }
  function alarmAt(x, z, radius = 17) {
    for (const p of people) if (p.active && (p.x - x) ** 2 + (p.z - z) ** 2 < radius * radius) scare(p, x, z, false);
  }
  function crossingClear(next) {
    const x = (next.a.x + next.b.x) / 2, z = (next.a.z + next.b.z) / 2;
    for (const car of vehicles) {
      if (car.active && (distSq(x, z, car) < 8 ** 2 || (x - car.x - car.vx * 1.2) ** 2 + (z - car.z - car.vz * 1.2) ** 2 < 11 ** 2)) return false;
    }
    return true;
  }
  function tickWalker(p, dt, think) {
    p.previousX = p.x; p.previousZ = p.z;
    if (think) for (const car of vehicles) {
      if (!car.active || car.speed < 4) continue;
      const dx = p.x - car.x, dz = p.z - car.z;
      const ahead = (dx * car.vx + dz * car.vz) / (car.speed || 1);
      const side = (dx * car.vz - dz * car.vx) / (car.speed || 1);
      if (Math.abs(ahead) < 2.35 && Math.abs(side) < 1.3 || ahead > 0 && ahead < 4 + car.speed * .55 && Math.abs(side) < 2.2) {
        const sign = side < 0 ? -1 : 1;
        scare(p, p.x - car.vz * sign, p.z + car.vx * sign, Math.abs(ahead) < 2.35 && Math.abs(side) < 1.3); break;
      }
    }
    const { link, from } = p, to = link.a === from ? link.b : link.a;
    const progress = p.distance / link.length;
    const anchorX = from.x + (to.x - from.x) * progress, anchorZ = from.z + (to.z - from.z) * progress;
    if (p.panic > 0 || p.returning) {
      p.panic = Math.max(0, p.panic - dt);
      p.tumble = Math.max(0, p.tumble - dt);
      const dx = p.panic ? p.directionX : anchorX - p.x, dz = p.panic ? p.directionZ : anchorZ - p.z;
      const distance = Math.hypot(dx, dz);
      if (!p.panic && distance < .15) { p.returning = false; return; }
      const speed = p.panic ? p.tumble ? 6 : 3.8 : 2.1;
      const factor = Math.min(1, speed * dt / (distance || 1));
      if (isDryLand(p.x + dx * factor, p.z + dz * factor)) moveBodyWithCollisions(world.grid, p, dx * factor, dz * factor, .32);
      p.heading += angleDelta(p.heading, Math.atan2(dx, -dz)) * .24; p.phase += dt * speed * 6;
      return;
    }
    if (p.pause > 0) { p.pause -= dt; return; }
    p.distance = Math.min(link.length, p.distance + p.pace * (link.crossing ? 1.45 : 1) * dt);
    const t = p.distance / link.length;
    p.x = from.x + (to.x - from.x) * t; p.z = from.z + (to.z - from.z) * t;
    p.heading += angleDelta(p.heading, Math.atan2(to.x - from.x, from.z - to.z)) * .18;
    p.phase += p.pace * dt * 6;
    if (t < 1) return;
    const next = to.links[Math.floor(random() * to.links.length)];
    if (next.crossing && !crossingClear(next)) { p.pause = .6; return; }
    p.link = next; p.from = to; p.distance = 0;
    if (!next.crossing && random() < .65) p.pause = .4 + random() * 2.1;
  }
  function throwSparks(x, z, speed) {
    for (let i = 0; i < 14; i++) {
      const s = sparks[sparkCursor]; sparkCursor = (sparkCursor + 1) % sparks.length;
      s.x = x; s.y = .55 + random() * .5; s.z = z;
      s.vx = (random() - .5) * speed; s.vy = 3 + random() * 5; s.vz = (random() - .5) * speed;
      s.life = .22 + random() * .45;
    }
  }
  function bumpCar(car, other) {
    const sn = Math.sin(car.heading), cs = Math.cos(car.heading);
    const dx = other.x - car.x, dz = other.z - car.z;
    const side = dx * cs + dz * sn, length = dx * sn - dz * cs;
    const relative = other.heading - car.heading;
    if (Math.abs(side) > 2.1 + Math.abs(Math.sin(relative)) * 1.5 || Math.abs(length) > 3.85) return;
    const os = Math.sin(other.heading), oc = Math.cos(other.heading);
    if (Math.abs(dx * oc + dz * os) > 2.1 + Math.abs(Math.sin(relative)) * 1.5) return;
    const distance = Math.hypot(dx, dz) || 1;
    const nx = dx / distance, nz = dz / distance;
    const approach = (car.vx - other.vx) * nx + (car.vz - other.vz) * nz;
    if (approach <= 0 || other.knock > 0) return;
    // Soft rebound preserves the player's steering and lets traffic clear the lane.

    car.vx -= nx * approach * .76; car.vz -= nz * approach * .76;
    car.speed = Math.hypot(car.vx, car.vz);
    if (approach < 4 || car.impactCooldown > 0) return;
    car.impactCooldown = .65; car.bounceVelocity = Math.min(4.8, approach * .27);
    car.condition = Math.max(1, car.condition - Math.min(7, approach * .28));
    if (!other.claimed && other !== firstCar) {
      release(other); other.knock = .92; other.spin = Math.sign(side || 1) * (3.3 + approach * .12);
      other.vx += nx * approach * .54; other.vz += nz * approach * .54;
    }
    impacts++; throwSparks((car.x + other.x) / 2, (car.z + other.z) / 2, 14);
    alarmAt(other.x, other.z);
    showWorldMessage(world, 'That was constructive criticism.', 2);
  }
  function step(player, chosen, camera, dt) {
    const think = world.tick % 3 === 0;
    const previousSparkCursor = sparkCursor;
    for (const car of vehicles) {
      if (!car.active || car === chosen && player.inVehicle) continue;
      if (car.claimed || car === firstCar) {
        if (car !== chosen && car.speed > .02) stepArcadeDriving(car, blank, world, dt, false);
      } else tickTraffic(car, player, dt, think);
      if (player.inVehicle && distSq(car.x, car.z, chosen) < 28) bumpCar(chosen, car);
    }
    for (const p of people) if (p.active) tickWalker(p, dt, think);
    for (const s of sparks) if (s.life > 0) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy -= 18 * dt;
    }
    if (chosen.impactCooldown > .69 && lastStaticImpact <= .69 && sparkCursor === previousSparkCursor) throwSparks(chosen.x, chosen.z, 13);
    lastStaticImpact = chosen.impactCooldown;
    if (++spawnTick >= 42) { spawnTick = 0; recycle(player.inVehicle ? chosen : player, camera); }
  }
  return pop;
}
