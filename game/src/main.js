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
import { createMenus, loadPreferences } from './menus.js';
import { createCarAudio } from './radio.js';
import { nearestRoadNode } from './roads.js';

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
  const capture = query.has('shot');
  let storage;
  if (!capture) { try { storage = window.localStorage; } catch {} }
  const missions = createMissionSystem({ world, player, police, population, storage, getCar: () => car,
    setCar: target => { car = target; }, checkpointForSave: () => nearestRoadNode(world.roads, player.x, player.z).id });
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
    pause: false, recover: false, map: false, radio: false, attack: false, weapon: 0, scan: false, orbitX: 0, orbitY: 0, zoom: 0 };
  let expanded = false, seenPayout = null, titleTime = 0;
  const defaultQuality = view.diagnostics().quality;
  const settings = loadPreferences(storage, defaultQuality);
  let lowQuality = settings.quality === 'low';
  function setQuality(quality) {
    lowQuality = quality === 'low';
    view.setRenderQuality(quality); population.setQuality(quality);
  }
  setQuality(settings.quality);
  const audio = createCarAudio(settings);
  function wakeAudio(event) { if (event.isTrusted && navigator.userActivation.hasBeenActive) audio.wake(); }
  window.addEventListener('pointerdown', wakeAudio);
  window.addEventListener('keydown', wakeAudio);
  let last = performance.now(), accumulator = 0, frames = 0;
  const frameTimes = new Float64Array(3600);
  let frameSample = 0, frameSamples = 0;
  const game = { player, get car() { return car; }, world, rig, population, police, missions, frozen: false, advanceFixedStep, renderFrame };
  const menus = createMenus({ canvas, input, missions, settings, storage, capture, actions: {
    freeze: () => { accumulator = 0; audio.update(false, false, 0, 0); },
    quality: setQuality, start: startStreet, quit: quitToTitle, retry: continueFrom,
  } });

  function advanceFixedStep(actions) {
    stepArcadeDriving(car, actions, world, STEP, player.inVehicle);
    updateOnFootPlayer(player, actions, rig.heading, world, car, STEP);
    world.clock += STEP; world.tick++;
    population.step(player, car, rig, STEP);
    police.step(STEP, actions);
    missions.step(STEP, actions, rig.heading);
    if (police.wanted.outcome || missions.failed) {
      const job = missions.snapshot();
      const penalty = police.wanted.outcome && !job.active ? missions.payFee(50) : 0;
      menus.outcome({ heading: police.wanted.outcome === 'busted' ? 'Busted.' : job.active ? 'Job interrupted.' : 'Down for the count.',
        job: job.active ? job.title : '', detail: job.failed || `$${penalty} in fees. Ilex can get you moving again.` });
    } else {
      const payout = missions.latestPayout();
      if (payout && payout !== seenPayout) {
        seenPayout = payout;
        menus.complete(missions.snapshot());
      }
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
    view.renderWorldFrame(player.inVehicle ? car : player, world.clock + (menus.atTitle ? titleTime : 0));
    if (!menus.current) hud.updateStreetHUD(player, car, rig, dt, expanded, player.inVehicle ? null : population.findEnterable(player), police, missions, settings.station);
  }

  function startStreet(fresh) {
    if (fresh) missions.resetProgress();
    const node = world.roads.nodes[missions.saveStatus().checkpoint ?? -1];
    if (node) {
      const next = world.roads.nodes[node.links[0]];
      const length = Math.hypot(next.x - node.x, next.z - node.z);
      const dx = (next.x - node.x) / length, dz = (next.z - node.z) / length;
      Object.assign(player, { x: node.x, previousX: node.x, z: node.z, previousZ: node.z });
      const x = node.x + 4 * dx, z = node.z + 4 * dz;
      Object.assign(car, { x, previousX: x, z, previousZ: z, heading: Math.atan2(dx, -dz) });
      population.resetNear(player);
      world.district = getDistrictAt(player.x, player.z); world.visited.clear(); world.visited.add(world.district.id);
    }
    Object.assign(rig, { heading: 0, pitch: 0, preset: 0, zoom: 0, orbitHold: 0, initialized: false });
    menus.resume();
  }

  function quitToTitle() {
    missions.save(); missions.clearSession(); police.reset(true);
    Object.assign(player, createOnFootPlayer());
    car = Object.assign(firstCar, createVehicle(), { active: true });
    world.clock = 0; world.tick = 0; world.messageTime = 0; world.staticImpacts = 0;
    world.district = getDistrictAt(player.x, player.z); world.visited.clear(); world.visited.add(world.district.id);
    population.resetNear(player);
    expanded = false; seenPayout = null; titleTime = 0; rig.initialized = false;
    menus.title();
  }

  function continueFrom(safehouse) {
    if (!safehouse && missions.retry()) {
      rig.initialized = false; rig.orbitHold = 0;
      menus.resume();
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
    menus.resume();
    showWorldMessage(world, safehouse ? 'Ilex / The yard is clear.' : 'Ilex / Your checkpoint is clear. Try again.', 4);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !game.frozen && !menus.current) menus.pause();
  });

  function frame(now) {
    try {
      const frameMs = Math.max(0, now - last); last = now;
      const elapsed = Math.min(0.1, frameMs / 1000);
      if (frames > 20 && !menus.current && !game.frozen) {
        frameTimes[frameSample] = frameMs;
        frameSample = (frameSample + 1) % frameTimes.length;
        frameSamples = Math.min(frameSamples + 1, frameTimes.length);
      }
      const actions = input.readPlayerActions();
      if (actions.pause && !menus.current) menus.pause();
      const canPlay = !menus.current;
      const activeInput = actions.forward || actions.right || actions.interact || actions.recover || actions.sprint
        || actions.attack || actions.handbrake || actions.camera || actions.map || actions.radio || actions.orbitX || actions.orbitY || actions.zoom;
      if (canPlay && game.frozen && activeInput) { game.frozen = false; accumulator = 0; }
      if (canPlay && !game.frozen) {
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
        if (actions.radio && player.inVehicle) menus.tune();
        accumulator += elapsed;
        let steps = 0;
        while (accumulator >= STEP && steps < 5 && !menus.current) { accumulator -= STEP; advanceFixedStep(actions); steps++; }
        if (steps === 5) accumulator = 0;
      } else accumulator = 0;
      if (menus.atTitle) {
        titleTime += elapsed;
        rig.heading = -.38 + Math.cos(titleTime * .28) * .20; rig.preset = 1; rig.zoom = 1.7; rig.pitch = .13;
      }
      const playing = !menus.current && !game.frozen;
      audio.update(playing, player.inVehicle, car.speed, actions.forward);
      renderFrame(playing ? accumulator / STEP : 1, game.frozen ? 0 : elapsed || STEP, playing ? actions : blank);
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
        staticImpacts: world.staticImpacts, paused: !!menus.current, menu: menus.current, station: settings.station, frozen: game.frozen, cash: mission.cash, mission, visited: [...world.visited],
        camera: { heading: rig.heading, preset: rig.preset, type: view.camera.type, position: view.camera.position.toArray() },
        renderer: view.diagnostics(), population: population.snapshot(), police: police.snapshot(),
        world: { buildings: world.buildings.length, palms: world.palms.length, districts: 6, roadNodes: world.roads.nodes.length },
        performance: { samples: frameSamples, medianMs: percentile(sorted, 0.5), p95Ms: percentile(sorted, 0.95) },
      };
    },
  };
  advanceFixedStep(blank);
  if (capture) stagePlayableScreenshot(query.get('shot'), game);
  else { population.seedNear(player); menus.title(); }
  requestAnimationFrame(frame);
}

function percentile(values, part) {
  if (!values.length) return 0;
  return Math.round(values[Math.floor((values.length - 1) * part)] * 100) / 100;
}

function showFatalError(error) {
  console.error(error);
  document.getElementById('game-menu').close();
  document.getElementById('fatal').hidden = false;
  document.getElementById('fatal-message').textContent = error.message || String(error);
  window.__renderFailed = true;
}

try { bootOpenWorldCrimeGame(); } catch (error) { showFatalError(error); }
