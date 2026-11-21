import { angleDelta, clamp } from './config.js';
import { moveBodyWithCollisions } from './collision.js';
import { hasPoliceSight } from './police.js';
import { enterOrStealVehicle } from './player.js';
import { createVehicle, stepArcadeDriving } from './vehicles.js';
import { GARAGE, MISSIONS } from './mission-data.js';
import { showWorldMessage } from './world.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const headingTo = (a, b) => Math.atan2(b.x - a.x, a.z - b.z);
const isPickup = stage => stage?.kind === 'collect' || (stage?.kind === 'defeatGuards' && stage.collect);
const STORE = 'rooktide-campaign-1';
const RANKS = [[1400, 'Current'], [800, 'Fixer'], [400, 'Link'], [150, 'Wheelhand'], [0, 'Runner']];

export function createMissionSystem({ world, player, police, population, getCar, setCar, storage, checkpointForSave }) {
  const { progress, status } = loadProgress(storage, world.roads.nodes.length);
  const guards = [];
  let run = null, radio = null, payout = null, ending = false, replay = null, attempts = 0;
  let scan = 0, scanCooldown = 0, combatEpoch = 0;
  let combat = null;

  const nextJob = () => replay || MISSIONS[progress.done];
  const activeStage = () => run?.job.stages[run.index];
  const rank = () => RANKS.find(([minimum]) => progress.rp >= minimum)[1];

  function save(checkpoint = checkpointForSave?.()) {
    if (checkpoint !== undefined) progress.checkpoint = checkpoint;
    status.valid = true; status.invalid = false;
    try {
      if (!storage) return false;
      storage.setItem(STORE, JSON.stringify({ done: progress.done, cash: progress.cash, checkpoint: progress.checkpoint }));
      status.blocked = false;
      return true;
    } catch { status.blocked = true; return false; }
  }

  function resetProgress() {
    clearSession();
    Object.assign(progress, { done: 0, cash: 250, rp: 0, checkpoint: null });
    save(null);
  }

  function clearSession() {
    cleanUp(); radio = payout = replay = null; ending = false; attempts = 0;
    scan = scanCooldown = 0; combatEpoch++;
  }

  function say(contact, line, seconds = 9) {
    radio = { contact, line, until: world.clock + seconds };
  }

  function addCar(spec, id) {
    if (!spec) return null;
    const car = Object.assign(createVehicle(spec.x, spec.z), spec, { id, active: true, claimed: true });
    population.vehicles.push(car);
    return car;
  }

  function cleanUp() {
    if (!run) return;
    for (const car of [run.vehicle, run.courier]) {
      if (!car) continue;
      delete car.missionTarget;
      if (car === getCar()) { car.locked = false; car.id = `${car.id}-${attempts}`; }
      else population.vehicles.splice(population.vehicles.indexOf(car), 1);
    }
    guards.length = 0;
    run = null;
  }

  function start(id, { capture = false } = {}) {
    const job = nextJob();
    const selected = capture ? MISSIONS.find(mission => mission.id === id) : job;
    if (run || selected?.id !== id) return false;
    const seed = (world.seed >>> 0) + attempts++;
    const deliveryId = `${id}-car`;
    const oldCar = population.vehicles.find(car => car.id.startsWith(`${deliveryId}-`) && car !== getCar());
    if (oldCar) population.vehicles.splice(population.vehicles.indexOf(oldCar), 1);
    run = { job: selected, index: 0, gate: 0, held: 0, lost: 0, failed: '', capture,
      seed, replay: replay === selected, vehicle: addCar(selected.vehicle, deliveryId), courier: null, checkpoint: null };
    combatEpoch++;
    if (run.vehicle) run.vehicle.locked = true;
    replay = null;
    payout = null;
    player.health = 100;
    beginStage(0);
    return true;
  }

  function beginStage(index, retrying = false) {
    const stage = run.job.stages[index];
    run.index = index; run.gate = 0; run.held = 0; run.lost = 0;
    guards.length = 0;
    if (stage.guards) for (const [i, [x, z]] of stage.guards.entries()) {
      guards.push({ x, z, previousX: x, previousZ: z, heading: 0, hp: 2, attack: 1 + i * .4, phase: 0, flash: 0, hit: 0,
        mode: 'idle', aim: 0, reposition: 0, side: i % 2 ? -1 : 1 });
    }
    if (stage.kind === 'enterVehicle' && run.vehicle) run.vehicle.locked = false;
    if (run.job.id === 'glass-current' && run.vehicle) run.vehicle.locked = false;
    if (stage.kind === 'disableVehicle') {
      run.courier = addCar(run.job.courier, 'split-invoice-courier');
      run.courier.locked = true;
      run.courier.condition = 65;
      run.courier.missionTarget = impact => { if (activeStage()?.kind === 'disableVehicle') damageCourier(impact * 2.55); };
    }
    if (!retrying && (!index || stage.checkpoint)) {
      const car = getCar();
      run.checkpoint = { index, player: { ...player }, car, carState: { ...car },
        vehicleState: run.vehicle && { ...run.vehicle }, heat: police.wanted.level };
    }
    if (stage.heat && stage.kind !== 'enterVehicle') raiseHeat(stage);
    if (stage.bridgeBlock) police.placeBridgeRoadblock();
    say(run.job.contact, stage.line);
  }

  function raiseHeat(stage) {
    police.reportMissionAlert(stage.heat, run.job.id === 'glass-current' ? 'Unauthorized relay access' : 'Marked vehicle reported');
  }

  function targetPoint() {
    const stage = activeStage();
    if (!stage) return nextJob()?.giver;
    if (stage.kind === 'enterVehicle') return run.vehicle;
    if (stage.kind === 'disableVehicle' || stage.point === 'courier') return run.courier;
    if (stage.route) return stage.route[run.gate] || stage.drops?.[run.seed % stage.drops.length];
    return stage.point;
  }

  function advance() {
    const index = run.index + 1;
    if (index < run.job.stages.length) { beginStage(index); return; }
    const { job, capture, replay: isReplay } = run;
    const firstClear = !capture && !isReplay && job === MISSIONS[progress.done];
    if (firstClear) {
      progress.done++;
      progress.cash += job.cash; progress.rp += job.rp;
      save();
    }
    payout = { title: job.title, cash: firstClear ? job.cash : 0, rp: firstClear ? job.rp : 0, until: world.clock + 9 };
    ending = firstClear && progress.done === MISSIONS.length;
    say(job.contact, job.finish, 11);
    cleanUp();
  }

  function takeMissionCar(car) {
    if (!car || car.locked || !enterOrStealVehicle(player, car, world)) return false;
    setCar(car);
    const stage = activeStage();
    if (stage.kind === 'enterVehicle' && car === run.vehicle) {
      if (stage.heat) raiseHeat(stage);
      advance();
    }
    return true;
  }

  function prompt() {
    if (!run) {
      const job = nextJob();
      if (!player.inVehicle && job && distance(player, job.giver) <= job.giver.radius) return `Speak to ${job.contact === 'Crew' ? 'the crew' : job.contact}`;
      if (progress.done >= 1 && progress.cash >= 150 && !police.wanted.level && player.inVehicle && getCar().speed < 1 && distance(player, GARAGE) <= GARAGE.radius && getCar().condition < 99) return 'Repair bodywork · $150';
      return '';
    }
    if (player.inVehicle) return '';
    const stage = activeStage(), point = targetPoint();
    if (isPickup(stage) && distance(player, point) <= (point.radius || 4) && guards.every(guard => !guard.hp)) return 'Pick up evidence';
    if (run.vehicle && !run.vehicle.locked && getCar() !== run.vehicle && distance(player, run.vehicle) < 4.5) return 'Take the marked vehicle';
    return '';
  }

  function interact() {
    if (!prompt()) return false;
    if (!run) {
      if (player.inVehicle) {
        payFee(150);
        getCar().condition = 100;
        showWorldMessage(world, 'Ilex / Good as new from at least one angle.');
      } else start(nextJob().id);
    } else if (isPickup(activeStage()) && distance(player, targetPoint()) <= (targetPoint().radius || 4)
      && guards.every(guard => !guard.hp)) advance();
    else takeMissionCar(run.vehicle);
    return true;
  }

  function damageCourier(amount) {
    const courier = run.courier;
    courier.condition = Math.max(0, courier.condition - amount);
    courier.bounce = .28;
    if (courier.condition === 0) {
      courier.vx = courier.vz = courier.speed = 0;
      courier.braking = true;
      population.throwSparks(courier.x, courier.z, 16);
      advance();
    }
  }

  function hitTarget(target, damage) {
    if (!target || !run || run.failed || !player.health) return false;
    if (target === run.courier && activeStage()?.kind === 'disableVehicle') {
      damageCourier(damage);
      return true;
    }
    if (!guards.includes(target) || !target.hp) return false;
    target.hp = Math.max(0, target.hp - damage);
    target.hit = .44; target.attack = .85; target.mode = 'reposition'; target.reposition = .48;
    return true;
  }

  function driveCourier(dt) {
    const courier = run.courier, route = run.job.courierRoute;
    if (distance(courier, route[run.gate]) < 7) run.gate = (run.gate + 1) % route.length;
    const target = route[run.gate];
    const turn = angleDelta(courier.heading, headingTo(courier, target));
    const pace = Math.abs(turn) > .22 || distance(courier, target) < 14 ? 6 : 10;
    stepArcadeDriving(courier, { forward: clamp((pace - courier.speed) / 3, -.7, 1), right: clamp(turn * 2.4, -1, 1) }, world, dt, true);
    run.lost = distance(player, courier) > 180 ? run.lost + dt : 0;
    if (run.lost >= 30) fail('The courier got away. Stay within 180 metres on your next run.');
  }

  function updateHostileGuards(dt) {
    for (const guard of guards) {
      guard.hit = Math.max(0, guard.hit - dt);
      if (!guard.hp) continue;
      guard.previousX = guard.x; guard.previousZ = guard.z;
      guard.flash = Math.max(0, guard.flash - dt);
      guard.reposition = Math.max(0, guard.reposition - dt);
      const range = distance(guard, player);
      const distant = activeStage().kind === 'holdPosition';
      guard.attack = Math.max(0, guard.attack - dt);
      if (range > 40 || player.inVehicle || !hasPoliceSight(world, guard, player, 1.45)) { guard.mode = 'idle'; guard.aim = 0; continue; }
      guard.heading = headingTo(guard, player);
      if (guard.reposition > 0 && range > 4) {
        guard.mode = 'reposition';
        moveBodyWithCollisions(world.grid, guard, Math.cos(guard.heading) * guard.side * 1.1 * dt,
          Math.sin(guard.heading) * guard.side * 1.1 * dt, .38);
        continue;
      }
      const fireRange = distant ? 15 : 9;
      if (range > fireRange && guard.hit === 0) {
        guard.mode = 'investigate'; guard.aim = 0;
        moveBodyWithCollisions(world.grid, guard, Math.sin(guard.heading) * 2.3 * dt, -Math.cos(guard.heading) * 2.3 * dt, .38);
        guard.phase += 6 * dt;
      } else if (range > 2.5) {
        guard.mode = 'aim'; guard.aim += dt;
        if (guard.aim >= .58 && guard.attack === 0) {
          guard.mode = 'fire'; guard.attack = distant ? 2.15 : 2.5; guard.flash = .24; guard.aim = 0;
          if (!player.damageCooldown) player.health = Math.max(0, player.health - (distant ? 5 : 7));
          player.damageCooldown = .58;
          guard.reposition = .52;
        }
      } else {
        guard.mode = 'fire'; guard.aim = 0;
        if (guard.attack === 0) {
          guard.attack = 1.25; guard.flash = .2;
          if (!player.damageCooldown) player.health = Math.max(0, player.health - 8);
          player.damageCooldown = .58;
        }
      }
    }
  }

  function step(dt, actions, aimHeading) {
    scan = Math.max(0, scan - dt); scanCooldown = Math.max(0, scanCooldown - dt);
    if (actions.scan && progress.done >= 2 && !scanCooldown) {
      scan = 10; scanCooldown = 60;
      showWorldMessage(world, 'Sava / Patrol bearings on your map for ten seconds.', 4);
    }
    if (!run || run.failed) return;
    if (police.wanted.outcome) { fail(police.wanted.outcome === 'busted' ? 'RCP took you off the street.' : 'You ran out of health.'); return; }
    if ((getCar() === run.checkpoint.car && getCar().recoveries !== run.checkpoint.carState.recoveries)
      || (run.vehicle && (run.vehicle.recoveries || run.vehicle.condition <= 0))) {
      fail('The job car was wrecked or went into the water.'); return;
    }
    const stage = activeStage();
    updateHostileGuards(dt);
    if (stage !== activeStage() || !player.health) return;
    if (stage.kind === 'disableVehicle') { driveCourier(dt); return; }
    if (stage.kind === 'defeatGuards' && !stage.collect && guards.every(guard => !guard.hp)) { advance(); return; }
    if (stage.kind === 'escapeWanted') { if (!police.wanted.level) advance(); return; }
    if (!['reach', 'holdPosition', 'deliver'].includes(stage.kind)) return;
    const point = targetPoint(), car = getCar();
    const modeOK = stage.vehicle ? player.inVehicle && car === run.vehicle
      : stage.mode === 'car' ? player.inVehicle : stage.mode === 'foot' || stage.kind === 'holdPosition' ? !player.inVehicle : true;
    const arrived = modeOK && distance(player, point) <= point.radius;
    const stopped = !player.inVehicle || car.speed < 1.5;
    const last = !stage.route || run.gate === stage.route.length - (stage.drops ? 0 : 1);
    const canProgress = arrived && (!stage.clear || !last || !police.wanted.level);
    if (point.seconds) {
      if (canProgress && stopped) run.held += dt;
      else if (stage.mode === 'car' || stage.kind !== 'holdPosition') run.held = 0;
    }
    if (canProgress && run.held + 1e-6 >= point.seconds) {
      run.held = 0;
      if (last) advance();
      else { run.gate++; showWorldMessage(world, `${point.label} confirmed.`, 2); }
    }
  }

  function fail(reason) { if (run && !run.failed) run.failed = reason; }

  function retry() {
    if (!run?.checkpoint) return false;
    const cp = run.checkpoint;
    if (run.courier) {
      population.vehicles.splice(population.vehicles.indexOf(run.courier), 1);
      run.courier = null;
    }
    Object.assign(cp.car, cp.carState, { vx: 0, vz: 0, speed: 0, previousX: cp.carState.x, previousZ: cp.carState.z });
    if (cp.vehicleState && run.vehicle !== cp.car) Object.assign(run.vehicle, cp.vehicleState);
    setCar(cp.car);
    Object.assign(player, cp.player, { health: 100, vx: 0, vz: 0, speed: 0, previousX: cp.player.x, previousZ: cp.player.z });
    run.failed = '';
    combatEpoch++;
    police.reset(true);
    if (cp.heat) police.reportMissionAlert(cp.heat, 'Checkpoint pursuit');
    beginStage(cp.index, true);
    return true;
  }

  function abandon() { cleanUp(); radio = null; }
  function payFee(amount) { const fee = Math.min(progress.cash, amount); progress.cash -= fee; save(); return fee; }
  function chooseReplay(id) {
    if (run || progress.done < MISSIONS.length) return false;
    replay = MISSIONS.find(job => job.id === id) || null;
    return !!replay;
  }

  function marker() {
    if (run?.failed) return null;
    const point = targetPoint();
    if (!point) return null;
    const stage = activeStage();
    const style = !run ? 'contact' : stage.kind === 'disableVehicle' ? 'target' : stage.kind === 'enterVehicle' ? 'car' : 'waypoint';
    const label = point.label || (style === 'target' ? 'Courier car' : stage.kind === 'collect' ? 'Ledger fragment' : 'Marked vehicle');
    return { x: point.x, z: point.z, radius: point.radius || 3, label, style };
  }

  function presentation() {
    const current = marker(), stage = activeStage();
    return { marker: current, metres: current ? Math.round(distance(player, current)) : 0,
      gate: !!stage?.route && stage.kind !== 'holdPosition', collect: isPickup(stage) && stage.point !== 'courier',
      contact: (run?.job || nextJob())?.contact };
  }

  function snapshot() {
    const stage = activeStage(), point = marker(), job = run?.job || nextJob();
    const loadout = combat?.snapshot() || { weapon: 1, rounds: 12, reserve: 36, reload: false };
    return { id: job?.id, title: job?.title, contact: job?.contact, chapter: job?.chapter, active: !!run,
      index: run?.index, total: run?.job.stages.length, kind: stage?.kind, gate: run?.gate, held: run?.held,
      seconds: targetPoint()?.seconds || 0, lost: run?.lost || 0, failed: run?.failed || '',
      text: stage?.text, next: run?.job.stages[run.index + 1]?.text, point, distance: point ? Math.round(distance(player, point)) : null,
      guardCount: guards.filter(guard => guard.hp).length, targetCondition: stage?.kind === 'disableVehicle' ? Math.ceil(run.courier.condition) : null,
      cash: progress.cash, rp: progress.rp, rank: rank(), done: progress.done, replay: !!(run?.replay || replay), ending,
      scan, scanCooldown, weapon: loadout.weapon, rounds: loadout.rounds, reserve: loadout.reserve, reload: loadout.reload, combatEpoch,
      radio: radio?.until > world.clock ? radio : null, payout: payout?.until > world.clock ? payout : null };
  }

  return { guards, step, start, interact, prompt, takeMissionCar, fail, retry, abandon, payFee, presentation, snapshot, chooseReplay, hitTarget,
    attachCombat(system) { combat = system; },
    get combatEpoch() { return combatEpoch; },
    get combatVehicle() { return run?.courier; },
    get protectedVehicles() { return run ? [run.vehicle, run.courier].filter(Boolean) : []; },
    save, resetProgress, clearSession, latestPayout: () => payout, saveStatus: () => ({ ...status, checkpoint: progress.checkpoint }),
    get vehicle() { return run?.vehicle; }, get active() { return !!run; }, get failed() { return run?.failed; },
    get scan() { return scan; }, get ending() { return ending; }, dismissEnding() { ending = false; }, lastLine: () => radio };
}

function loadProgress(storage, nodeCount) {
  const status = { valid: false, invalid: false, blocked: !storage };
  let raw, saved;
  try { raw = storage?.getItem(STORE); } catch { status.blocked = true; }
  if (raw != null) {
    try { saved = JSON.parse(raw); } catch {}
    status.invalid = true;
  }
  const validDone = Number.isInteger(saved?.done) && saved.done >= 0 && saved.done <= MISSIONS.length;
  const earned = MISSIONS.slice(0, validDone ? saved.done : 0);
  const maxCash = earned.reduce((total, job) => total + job.cash, 250);
  if (validDone && Number.isInteger(saved.cash) && saved.cash >= 0 && saved.cash <= maxCash) {
    status.valid = true; status.invalid = false;
    const index = saved.checkpoint;
    const checkpoint = Number.isInteger(index) && index >= 0 && index < nodeCount ? index : null;
    return { status, progress: { done: saved.done, cash: saved.cash, rp: earned.reduce((total, job) => total + job.rp, 0), checkpoint } };
  }
  return { status, progress: { done: 0, cash: 250, rp: 0, checkpoint: null } };
}
