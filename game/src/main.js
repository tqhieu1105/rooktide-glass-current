import { createRooktideCity, getDistrictAt, findSafeSpawn, showWorldMessage } from './world.js';
import { createCityRenderer } from './render.js';
import { createOnFootPlayer, updateOnFootPlayer, enterOrStealVehicle, exitVehicleSafely } from './player.js';
import { createVehicle, stepArcadeDriving, recoverVehicle } from './vehicles.js';
import { createPlayerModel, createVehicleModel, updateActorModels } from './models.js';
import { createThirdPersonCamera, updateChaseCamera } from './camera.js';
import { createInput } from './input.js';
import { createMinimap } from './minimap.js';
import { createStreetHUD } from './hud.js';
import { stagePlayableScreenshot, signalShotReady } from './shots.js';
import { createPopulation } from './population.js';
import { createPopulationModels } from './population-models.js';
import { createPoliceSystem } from './police.js';
import { createPoliceModels } from './police-models.js';
import { STEP } from './config.js';
import { createMissionSystem } from './missions.js';
import { createMissionModels } from './mission-models.js';
import { MISSIONS } from './mission-data.js';

export function bootOpenWorldCrimeGame() {
  const query = new URLSearchParams(location.search);
  const seed = Number(query.get('seed')) || 20261121;
  const canvas = document.getElementById('game');
  const world = createRooktideCity(seed);
  const view = createCityRenderer(canvas, world);
  const player = createOnFootPlayer();
  const firstCar = createVehicle();
  let car = firstCar;
  const police = createPoliceSystem(world, player, () => car, {
    camera: () => view.camera,
    alarm: (x, z) => population.alarmAt(x, z),
    sparks: (x, z, strength) => population.throwSparks(x, z, strength),
  });
  const population = createPopulation(world, firstCar, (kind, x, z, witnessed) => police.reportCrime(kind, x, z, witnessed));
  world.population = population;
  world.police = police;
  let storage;
  if (!query.has('shot')) { try { storage = window.localStorage; } catch {} }
  const missions = createMissionSystem({ world, player, police, population, storage, getCar: () => car, setCar: target => { car = target; } });
  const paintMissions = createMissionModels(view.scene, missions, world);
  const paintPopulation = createPopulationModels(view.scene, population);
  const paintPolice = createPoliceModels(view.scene, police, world);
  const visuals = { player: createPlayerModel(), car: createVehicleModel() };
  view.scene.add(visuals.player.root, visuals.car.root);
  const rig = createThirdPersonCamera(view.camera);
  const input = createInput(canvas);
  const minimap = createMinimap(document.getElementById('minimap'), world);
  const hud = createStreetHUD(world, minimap);
  const blank = { forward: 0, right: 0, sprint: false, handbrake: false, interact: false, camera: false,
    pause: false, recover: false, map: false, attack: false, weapon: 0, scan: false, orbitX: 0, orbitY: 0, zoom: 0 };
  let paused = false, expanded = false, lowQuality = view.diagnostics().quality === 'low';
  population.setQuality(lowQuality ? 'low' : 'high');
  document.getElementById('quality-button').textContent = lowQuality ? 'QUALITY: LOW' : 'QUALITY: HIGH';
  let last = performance.now(), accumulator = 0, frames = 0;
  const frameTimes = new Float64Array(3600);
  let frameSample = 0, frameSamples = 0;
  const game = { player, get car() { return car; }, world, rig, population, police, missions, frozen: false, advanceFixedStep, renderFrame };
  const outcome = document.getElementById('chase-outcome');
  const ending = document.getElementById('campaign-ending');
  const replay = document.getElementById('mission-replay');
  const abandon = document.getElementById('abandon-mission');
  for (const job of MISSIONS) replay.add(new Option(job.title, job.id));

  function advanceFixedStep(actions) {
    stepArcadeDriving(car, actions, world, STEP, player.inVehicle);
    updateOnFootPlayer(player, actions, rig.heading, world, car, STEP);
    world.clock += STEP; world.tick++;
    population.step(player, car, rig, STEP);
    police.step(STEP, actions);
    missions.step(STEP, actions, rig.heading);
    if ((police.wanted.outcome || missions.failed) && outcome.hidden) {
      document.getElementById('outcome-title').textContent = police.wanted.outcome === 'busted' ? 'Busted.'
        : missions.failed ? 'Job interrupted.' : 'Down for the count.';
      const penalty = police.wanted.outcome && !missions.failed ? missions.payFee(50) : 0;
      document.getElementById('outcome-detail').textContent = missions.failed || `$${penalty} in fees. Ilex can get you moving again.`;
      input.clearHeldInputs(); outcome.hidden = false;
      document.getElementById('retry-chase').focus();
    }
    if (missions.ending && ending.hidden) {
      const progress = missions.snapshot();
      document.getElementById('ending-detail').textContent = `All six jobs complete · $${progress.payout.cash.toLocaleString()} + ${progress.payout.rp} RP`;
      input.clearHeldInputs(); ending.hidden = false;
      document.getElementById('dismiss-ending').focus();
    }
    world.messageTime = Math.max(0, world.messageTime - STEP);
    const next = getDistrictAt(player.x, player.z);
    if (next.id !== world.district.id) { world.district = next; showWorldMessage(world, next.name.toUpperCase() + ' / ' + next.subtitle, 4); }
    if (!world.visited.has(next.id)) world.visited.add(next.id);
  }

  function renderFrame(alpha, dt, actions = blank) {
    updateActorModels(player, car, visuals, alpha);
    updateChaseCamera(rig, player, car, actions, world, dt);
    rig.camera.updateMatrixWorld();
    paintPopulation(rig.camera, car, alpha, lowQuality);
    paintPolice(alpha);
    paintMissions(rig.camera, alpha);
    view.renderWorldFrame(player.inVehicle ? car : player);
    hud.updateStreetHUD(player, car, rig, dt, expanded, player.inVehicle ? null : population.findEnterable(player), police, missions);
  }

  function setPaused(value) {
    paused = value; accumulator = 0; input.clearHeldInputs();
    document.getElementById('pause').hidden = !paused;
    if (paused) {
      const status = missions.snapshot();
      abandon.hidden = !status.active;
      replay.parentElement.hidden = status.active || status.done < MISSIONS.length;
      document.getElementById('last-radio').textContent = missions.lastLine()?.line || '';
    }
    if (!paused) canvas.focus({ preventScroll: true });
  }
  document.getElementById('help-button').addEventListener('click', () => setPaused(true));
  document.getElementById('resume-button').addEventListener('click', () => setPaused(false));
  abandon.addEventListener('click', () => { missions.abandon(); setPaused(false); });
  replay.addEventListener('change', () => {
    if (missions.chooseReplay(replay.value)) setPaused(false);
    replay.selectedIndex = 0;
  });
  document.getElementById('dismiss-ending').addEventListener('click', () => {
    missions.dismissEnding(); ending.hidden = true; setPaused(false);
  });
  function continueFrom(safehouse) {
    if (!safehouse && missions.retry()) {
      rig.initialized = false; rig.orbitHold = 0;
      outcome.hidden = true; setPaused(false);
      showWorldMessage(world, 'Checkpoint restored. Give it another go.');
      return;
    }
    if (safehouse) missions.abandon();
    const checkpoint = police.wanted.checkpoint || player;
    const safe = safehouse ? { x: -354, z: 301, heading: 0 } : findSafeSpawn(world, checkpoint.x, checkpoint.z);
    police.reset();
    Object.assign(car, safe, { previousX: safe.x, previousZ: safe.z, vx: 0, vz: 0, speed: 0,
      condition: 100, impactCooldown: 0, roll: 0, pitch: 0, bounce: 0, bounceVelocity: 0 });
    const onFoot = safehouse || !player.inVehicle;
    Object.assign(player, { ...safe, x: safe.x + (onFoot ? 3 : 0), previousX: safe.x + (onFoot ? 3 : 0),
      previousZ: safe.z, inVehicle: !onFoot, vx: 0, vz: 0, speed: 0, health: 100 });
    rig.initialized = false; rig.orbitHold = 0;
    outcome.hidden = true; setPaused(false);
    showWorldMessage(world, safehouse ? 'Ilex / The yard is clear.' : 'Ilex / Your checkpoint is clear. Try again.', 4);
  }
  document.getElementById('retry-chase').addEventListener('click', () => continueFrom(false));
  document.getElementById('return-yard').addEventListener('click', () => continueFrom(true));
  document.getElementById('quality-button').addEventListener('click', e => {
    lowQuality = !lowQuality; view.setRenderQuality(lowQuality ? 'low' : 'high');
    population.setQuality(lowQuality ? 'low' : 'high');
    e.currentTarget.textContent = lowQuality ? 'QUALITY: LOW' : 'QUALITY: HIGH';
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !game.frozen) setPaused(true); });

  function frame(now) {
    try {
      const frameMs = Math.max(0, now - last); last = now;
      const elapsed = Math.min(0.1, frameMs / 1000);
      if (frames > 20 && !paused && !game.frozen) {
        frameTimes[frameSample] = frameMs;
        frameSample = (frameSample + 1) % frameTimes.length;
        frameSamples = Math.min(frameSamples + 1, frameTimes.length);
      }
      const actions = input.readPlayerActions();
      const canPlay = outcome.hidden && ending.hidden;
      if (actions.pause && canPlay) setPaused(!paused);
      const activeInput = actions.forward || actions.right || actions.interact || actions.recover || actions.sprint
        || actions.attack || actions.handbrake || actions.camera || actions.map || actions.orbitX || actions.orbitY || actions.zoom;
      if (game.frozen && activeInput) { game.frozen = false; accumulator = 0; }
      if (!paused && !game.frozen && canPlay) {
        if (actions.interact && !missions.interact()) {
          if (player.inVehicle) exitVehicleSafely(player, car, world);
          else {
            const target = population.findEnterable(player);
            if (target && enterOrStealVehicle(player, target, world)) { car = target; population.claim(car); }
            else showWorldMessage(world, 'Get close to a parked or stopped car.');
          }
          rig.orbitHold = 0;
        }
        if (actions.recover && missions.active) missions.fail('Roadside recovery requested. Retry the job from its checkpoint.');
        else if (actions.recover) {
          if (player.inVehicle) recoverVehicle(car, world);
          else { Object.assign(player, findSafeSpawn(world, player.x, player.z)); player.previousX = player.x; player.previousZ = player.z; }
          showWorldMessage(world, 'Back on the road. No paperwork.');
        }
        if (actions.map) expanded = !expanded;
        accumulator += elapsed;
        let steps = 0;
        while (accumulator >= STEP && steps < 5 && outcome.hidden && ending.hidden) { advanceFixedStep(actions); accumulator -= STEP; steps++; }
        if (steps === 5) accumulator = 0;
      } else accumulator = 0;
      renderFrame(game.frozen ? 1 : accumulator / STEP, game.frozen ? 0 : elapsed || STEP, paused ? blank : actions);
      frames++;
      if (frames === 3) { window.__gameReady = true; signalShotReady(); }
      requestAnimationFrame(frame);
    } catch (error) { showFatalError(error); }
  }

  window.__rooktide = {
    snapshot: () => {
      const sorted = frameTimes.slice(0, frameSamples).sort();
      // Route and turn pointers are internal and form a cyclic graph.
      const { lane, turn, ...carState } = car;
      const mission = missions.snapshot();
      return {
        player: { ...player }, car: carState, tick: world.tick, district: world.district.name,
        staticImpacts: world.staticImpacts, paused, frozen: game.frozen, cash: mission.cash, mission, visited: [...world.visited],
        camera: { heading: rig.heading, preset: rig.preset, type: view.camera.type, position: view.camera.position.toArray() },
        renderer: view.diagnostics(), population: population.snapshot(), police: police.snapshot(),
        world: { buildings: world.buildings.length, palms: world.palms.length, districts: 6, roadNodes: world.roads.nodes.length },
        performance: { samples: frameSamples, medianMs: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95) },
      };
    },
  };
  advanceFixedStep(blank);
  if (query.has('shot')) stagePlayableScreenshot(query.get('shot'), game);
  else population.seedNear(player);
  requestAnimationFrame(frame);
}

function percentile(values, part) {
  if (!values.length) return 0;
  return Math.round(values[Math.floor((values.length - 1) * part)] * 100) / 100;
}

function showFatalError(error) {
  console.error(error);
  document.getElementById('fatal').hidden = false;
  document.getElementById('fatal-message').textContent = error.message || String(error);
  window.__renderFailed = true;
}

try { bootOpenWorldCrimeGame(); } catch (error) { showFatalError(error); }
