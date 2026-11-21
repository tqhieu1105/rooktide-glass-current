import { angleDelta } from './config.js';
import { hasPoliceSight } from './police.js';
import { recoverVehicle } from './vehicles.js';
import { showWorldMessage } from './world.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const bearing = (a, b) => Math.atan2(b.x - a.x, a.z - b.z);

export function createCombatSystem({ world, player, police, population, missions, getCar }) {
  let weapon = 1, rounds = 12, reserve = 36, reload = 0, cooldown = 0, flash = 0;
  let epoch = missions.combatEpoch;
  const tracers = [], explosions = [];
  const smoke = Array.from({ length: 54 }, () => ({ life: 0 }));
  const flames = Array.from({ length: 24 }, () => ({ life: 0 }));
  const debris = Array.from({ length: 36 }, () => ({ life: 0 }));
  let smokeCursor = 0, flameCursor = 0, debrisCursor = 0, seed = (world.seed ^ 0x7ac391) >>> 0;

  function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

  function reset() { weapon = 1; rounds = 12; reserve = 36; reload = cooldown = flash = 0; }
  function beginReload() {
    if (player.inVehicle || weapon !== 2) return false;
    if (reload > 0) return true;
    if (rounds === 12 || reserve <= 0) return false;
    reload = 1.25;
    showWorldMessage(world, `Pistol reload · ${reserve} in reserve.`);
    return true;
  }
  function candidates(ranged) {
    const active = missions.snapshot();
    const list = missions.guards.filter(guard => guard.hp > 0);
    if (active.kind === 'disableVehicle' && missions.combatVehicle && !list.includes(missions.combatVehicle)) list.push(missions.combatVehicle);
    if (ranged) for (const car of population.vehicles) {
      if (car.active && car !== getCar() && car.condition > 0 && !car.destroyed && (!car.missionTarget || car === missions.combatVehicle) && !list.includes(car)) list.push(car);
    }
    if (ranged) for (const unit of police.units) if (unit.active && unit.condition > 0) list.push(unit);
    return list;
  }
  function blockedByCar(from, to, target) {
    const dx = to.x - from.x, dz = to.z - from.z, lengthSq = dx * dx + dz * dz;
    if (lengthSq < 1) return false;
    for (const car of population.vehicles) {
      if (!car.active || car === target || car === getCar()) continue;
      const t = ((car.x - from.x) * dx + (car.z - from.z) * dz) / lengthSq;
      if (t <= .06 || t >= .94) continue;
      const x = from.x + dx * t, z = from.z + dz * t;
      if ((car.x - x) ** 2 + (car.z - z) ** 2 < 2.05 ** 2) return true;
    }
    return false;
  }
  function selectTarget(ranged, aimHeading) {
    let best = Infinity, chosen = null;
    for (const target of candidates(ranged)) {
      const range = distance(player, target);
      const cone = ranged ? .13 : .94;
      const heading = ranged ? aimHeading : player.heading;
      if (range >= (ranged ? 48 : 3.5) || Math.abs(angleDelta(heading, bearing(player, target))) > cone
        || !hasPoliceSight(world, player, target, 1.5) || ranged && blockedByCar(player, target, target)) continue;
      const priority = target.hp !== undefined ? 0 : target.missionTarget ? 1 : police.units.includes(target) ? 2 : 3;
      const score = priority * 100 + range;
      if (score < best) { best = score; chosen = target; }
    }
    return chosen;
  }
  function tracer(target, heading) {
    const end = target || { x: player.x + Math.sin(heading) * 28, z: player.z - Math.cos(heading) * 28 };
    tracers.push({ x1: player.x, z1: player.z, x2: end.x, z2: end.z, age: 0, life: .12 });
    if (tracers.length > 8) tracers.shift();
  }
  function fire(aimHeading) {
    const ranged = weapon === 2;
    if (ranged && rounds <= 0) { beginReload(); return; }
    cooldown = ranged ? .31 : .38;
    flash = ranged ? .08 : .13;
    const target = selectTarget(ranged, ranged ? aimHeading : player.heading);
    if (ranged) {
      const heading = aimHeading;
      const muzzle = flames[flameCursor]; flameCursor = (flameCursor + 1) % flames.length;
      Object.assign(muzzle, { x: player.x + Math.sin(heading) * .65, y: 1.25, z: player.z - Math.cos(heading) * .65,
        vy: .2, size: .12, color: 0xfff0b2, life: .07 });
      population.alarmAt(player.x, player.z, 38);
      police.reportCrime('gunfire', player.x, player.z, true);
    }
    if (ranged) {
      rounds--;
      tracer(target, aimHeading);
      population.throwSparks(target?.x ?? player.x + Math.sin(aimHeading) * 15,
        target?.z ?? player.z - Math.cos(aimHeading) * 15, 5);
      if (target) {
        if (target.hp !== undefined) missions.hitTarget(target, 2);
        else if (target.missionTarget) target.missionTarget(9);
        else {
          target.condition = Math.max(0, target.condition - 17);
          target.bounce = Math.max(target.bounce || 0, .20);
          target.bounceVelocity = Math.max(target.bounceVelocity || 0, 2.5);
          target.roll = (target.roll || 0) + .08;
        }
        if (police.units.includes(target)) police.reportMissionAlert(Math.min(5, Math.max(2, police.wanted.level + 1)), 'RCP unit attacked');
      }
    } else if (target) {
      missions.hitTarget(target, 1);
      player.heading = bearing(player, target);
    }
  }
  function spawnExplosion(car) {
    car.destroyed = true; car.destroying = true; car.condition = 0;
    car.combatSmoke = false; car.combatFire = false; car.damageFuse = 0;
    car.explosionTimer = 1.25; car.explosionSpin = (car.x * .7 + car.z) % 2 < 1 ? 5.5 : -5.5;
    car.airHeight = 0; car.airVelocity = 16 + (Math.abs(car.x) % 4);
    car.bounce = Math.max(car.bounce || 0, .55); car.roll = (car.roll || 0) + .45;
    const effect = { x: car.x, z: car.z, age: 0, life: 1.25, size: 3.9 };
    explosions.push(effect); if (explosions.length > 6) explosions.shift();
    car.knock = Math.max(car.knock || 0, .9); car.spin = (car.spin || 0) + car.explosionSpin;
    for (let i = 0; i < 12; i++) {
      const piece = debris[debrisCursor]; debrisCursor = (debrisCursor + 1) % debris.length;
      const angle = random() * Math.PI * 2, speed = 5 + random() * 10;
      Object.assign(piece, { x: car.x, y: .7 + random() * .6, z: car.z,
        vx: Math.cos(angle) * speed, vy: 4 + random() * 8, vz: Math.sin(angle) * speed,
        spinX: random() * 9, spinY: random() * 9, spinZ: random() * 9,
        size: .16 + random() * .3, color: [0xf3ba68, 0x526c70, 0x28383d][i % 3], life: .7 + random() * 1.25 });
    }
    population.throwSparks(car.x, car.z, 17);
    for (const other of population.vehicles) {
      if (other === car || !other.active || other.missionTarget || missions.protectedVehicles?.includes(other) || missions.active && other === getCar()) continue;
      const dx = other.x - car.x, dz = other.z - car.z, range = Math.hypot(dx, dz);
      if (range > 12) continue;
      const falloff = 1 - range / 14;
      other.condition = Math.max(0, other.condition - (45 + falloff * 55));
      other.vx = (other.vx || 0) + dx / (range || 1) * falloff * 10;
      other.vz = (other.vz || 0) + dz / (range || 1) * falloff * 10;
      other.knock = Math.max(other.knock || 0, .8 + falloff * .5);
      other.spin = (other.spin || 0) + (dx - dz >= 0 ? 1 : -1) * (2.8 + falloff * 3.8);
      other.bounce = Math.max(other.bounce || 0, .3 + falloff * .35);
      other.bounceVelocity = Math.max(other.bounceVelocity || 0, 5 + falloff * 8);
      if (falloff > .45) other.airVelocity = Math.max(other.airVelocity || 0, 5 + falloff * 6);
    }
    if (!player.inVehicle && distance(player, car) < 11) {
      if ((player.damageCooldown || 0) <= 0) player.health = Math.max(0, player.health - Math.round(20 * (1 - distance(player, car) / 13)));
      player.damageCooldown = Math.max(player.damageCooldown || 0, .6);
      police.reportCrime('explosion', car.x, car.z, true);
      showWorldMessage(world, 'That one had opinions. Keep your distance from the next one.');
    }
    if (car === getCar() && missions.active) missions.fail('The vehicle was wrecked in a cartoon-sized blast. Retry from the checkpoint.');
  }
  function updateVehicles(dt) {
    for (const car of population.vehicles) {
      if (!car.active || car.missionTarget) continue;
      if (car.destroyed) {
        car.explosionTimer = Math.max(0, car.explosionTimer - dt);
        if (car !== getCar() || !player.inVehicle) {
          if (car !== getCar()) {
            car.heading += (car.explosionSpin || 0) * dt;
            car.bounceVelocity -= (car.bounce * 42 + car.bounceVelocity * 6) * dt;
            car.bounce = Math.max(0, car.bounce + car.bounceVelocity * dt);
            car.airHeight = Math.max(0, (car.airHeight || 0) + (car.airVelocity || 0) * dt);
            car.airVelocity = (car.airVelocity || 0) - 20 * dt;
            if (!car.airHeight && car.airVelocity < 0) car.airVelocity = 0;
          }
        }
        if (!car.explosionTimer) {
          if (car === getCar()) recoverVehicle(car, world);
          else { car.destroying = false; car.wrecked = true; car.speed = 0; car.vx = car.vz = 0; }
        }
        continue;
      }
      car.combatSmoke = car.condition < 68;
      car.combatFire = car.condition < 36;
      if (car.combatSmoke && (car.combatSmokeClock = (car.combatSmokeClock || 0) - dt) <= 0) {
        car.combatSmokeClock = .13;
        const puff = smoke[smokeCursor]; smokeCursor = (smokeCursor + 1) % smoke.length;
        Object.assign(puff, { x: car.x, y: .9 + random() * .5, z: car.z, vx: (random() - .5) * 1.2,
          vy: 1.1 + random() * 1.3, vz: (random() - .5) * 1.2, size: .42 + random() * .38, life: 1.4 + random() * .8 });
      }
      if (car.combatFire && (car.combatFireClock = (car.combatFireClock || 0) - dt) <= 0) {
        car.combatFireClock = .07;
        const flame = flames[flameCursor]; flameCursor = (flameCursor + 1) % flames.length;
        Object.assign(flame, { x: car.x + (random() - .5) * 1.2, y: .75, z: car.z + (random() - .5) * 1.6,
          vy: 1.8 + random() * 2, size: .20 + random() * .23, color: random() < .5 ? 0xff8a3d : 0xffd367, life: .28 + random() * .22 });
      }
      if (car.combatFire) car.damageFuse = (car.damageFuse || 0) + dt;
      else car.damageFuse = 0;
      if (car.condition <= 0 || car.damageFuse >= 3.2) spawnExplosion(car);
    }
  }
  function updateEffects(dt) {
    for (const particle of smoke) if (particle.life > 0) {
      particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.z += particle.vz * dt;
      particle.size += dt * .36; particle.vy *= .99;
    }
    for (const particle of flames) if (particle.life > 0) {
      particle.life -= dt; particle.y += particle.vy * dt; particle.size *= 1 - dt * 1.2;
    }
    for (const piece of debris) if (piece.life > 0) {
      piece.life -= dt; piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.z += piece.vz * dt;
      piece.vy -= 17 * dt; piece.spinX += dt * 9; piece.spinY += dt * 12; piece.spinZ += dt * 8;
      if (piece.y < .12) { piece.y = .12; piece.vy = Math.abs(piece.vy) * .36; piece.vx *= .72; piece.vz *= .72; }
    }
  }
  function step(dt, actions, aimHeading) {
    if (epoch !== missions.combatEpoch) { epoch = missions.combatEpoch; reset(); }
    cooldown = Math.max(0, cooldown - dt); flash = Math.max(0, flash - dt);
    player.damageCooldown = Math.max(0, (player.damageCooldown || 0) - dt);
    if (actions.weapon === 1 || actions.weapon === 2) weapon = actions.weapon;
    if (reload > 0) {
      reload = Math.max(0, reload - dt);
      if (!reload) { const count = Math.min(12 - rounds, reserve); rounds += count; reserve -= count; }
    }
    if (!player.inVehicle && actions.attack && cooldown <= 0 && !reload) fire(aimHeading);
    for (const effect of tracers) effect.age += dt;
    while (tracers.length && tracers[0].age >= tracers[0].life) tracers.shift();
    for (const effect of explosions) effect.age += dt;
    while (explosions.length && explosions[0].age >= explosions[0].life) explosions.shift();
    updateVehicles(dt);
    updateEffects(dt);
  }
  return { step, beginReload, reset, snapshot: () => ({ weapon, rounds, reserve, reload: reload > 0,
    muzzleFlash: flash > 0, activeExplosions: explosions.length }),
    get tracers() { return tracers; }, get explosions() { return explosions; },
    get smoke() { return smoke; }, get flames() { return flames; }, get debris() { return debris; } };
}
