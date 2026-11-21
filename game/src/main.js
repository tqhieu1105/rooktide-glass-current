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
import { STEP } from './config.js';

export function bootOpenWorldCrimeGame() {
  const query = new URLSearchParams(location.search);
  const seed = Number(query.get('seed')) || 20261121;
  const canvas = document.getElementById('game');
  const world = createRooktideCity(seed);
  const view = createCityRenderer(canvas, world);
  const player = createOnFootPlayer();
  const car = createVehicle();
  const visuals = { player: createPlayerModel(), car: createVehicleModel() };
  view.scene.add(visuals.player.root, visuals.car.root);
  const rig = createThirdPersonCamera(view.camera);
  const input = createInput(canvas);
  const minimap = createMinimap(document.getElementById('minimap'), world);
  const hud = createStreetHUD(world, minimap);
  const blank = { forward: 0, right: 0, sprint: false, handbrake: false, interact: false, camera: false,
    pause: false, recover: false, map: false, orbitX: 0, orbitY: 0, zoom: 0 };
  let paused = false, expanded = false, lowQuality = view.diagnostics().quality === 'low';
  document.getElementById('quality-button').textContent = lowQuality ? 'QUALITY: LOW' : 'QUALITY: HIGH';
  let last = performance.now(), accumulator = 0, frames = 0;
  const frameTimes = [];
  const game = { player, car, world, rig, frozen: false, advanceFixedStep, renderFrame };

  function advanceFixedStep(actions) {
    stepArcadeDriving(car, actions, world, STEP, player.inVehicle);
    updateOnFootPlayer(player, actions, rig.heading, world, car, STEP);
    world.clock += STEP; world.tick++;
    world.messageTime = Math.max(0, world.messageTime - STEP);
    const next = getDistrictAt(player.x, player.z);
    if (next.id !== world.district.id) { world.district = next; showWorldMessage(world, next.name.toUpperCase() + ' / ' + next.subtitle, 4); }
    world.visited.add(next.id);
  }

  function renderFrame(alpha, dt, actions = blank) {
    updateActorModels(player, car, visuals, alpha);
    updateChaseCamera(rig, player, car, actions, world, dt);
    view.renderWorldFrame(player.inVehicle ? car : player);
    hud.updateStreetHUD(player, car, rig, Math.max(dt, 0.1), paused, expanded);
  }

  function setPaused(value) {
    paused = value; accumulator = 0; input.clearHeldInputs();
    document.getElementById('pause').hidden = !paused;
    if (!paused) canvas.focus({ preventScroll: true });
  }
  document.getElementById('help-button').addEventListener('click', () => setPaused(true));
  document.getElementById('resume-button').addEventListener('click', () => setPaused(false));
  document.getElementById('quality-button').addEventListener('click', e => {
    lowQuality = !lowQuality; view.setRenderQuality(lowQuality ? 'low' : 'high');
    e.currentTarget.textContent = lowQuality ? 'QUALITY: LOW' : 'QUALITY: HIGH';
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !game.frozen) setPaused(true); });

  function frame(now) {
    try {
      const frameMs = Math.max(0, now - last); last = now;
      const elapsed = Math.min(0.1, frameMs / 1000);
      if (frames > 20 && !paused && !game.frozen) {
        frameTimes.push(frameMs); if (frameTimes.length > 3600) frameTimes.shift();
      }
      const actions = input.readPlayerActions();
      if (actions.pause) setPaused(!paused);
      const activeInput = actions.forward || actions.right || actions.interact || actions.recover || actions.sprint
        || actions.handbrake || actions.camera || actions.map || actions.orbitX || actions.orbitY || actions.zoom;
      if (game.frozen && activeInput) { game.frozen = false; accumulator = 0; }
      if (!paused && !game.frozen) {
        if (actions.interact) {
          if (player.inVehicle) exitVehicleSafely(player, car, world);
          else enterOrStealVehicle(player, car, world);
          rig.orbitHold = 0;
        }
        if (actions.recover) {
          if (player.inVehicle) recoverVehicle(car, world);
          else { Object.assign(player, findSafeSpawn(world, player.x, player.z)); player.previousX = player.x; player.previousZ = player.z; }
          showWorldMessage(world, 'Back on the road. No paperwork.');
        }
        if (actions.map) expanded = !expanded;
        accumulator += elapsed;
        let steps = 0;
        while (accumulator >= STEP && steps < 5) { advanceFixedStep(actions); accumulator -= STEP; steps++; }
        if (steps === 5) accumulator = 0;
      } else accumulator = 0;
      renderFrame(game.frozen ? 1 : accumulator / STEP, game.frozen ? 0 : elapsed || STEP, paused ? blank : actions);
      frames++;
      if (frames === 3) { window.__gameReady = true; signalShotReady(); }
      requestAnimationFrame(frame);
    } catch (error) { showFatalError(error); }
  }

  window.__rooktide = {
    snapshot: () => ({ player: { ...player }, car: { ...car }, tick: world.tick, district: world.district.name,
      visited: [...world.visited], paused, frozen: game.frozen, camera: { heading: rig.heading, preset: rig.preset,
        type: view.camera.type, position: view.camera.position.toArray() }, renderer: view.diagnostics(),
      world: { buildings: world.buildings.length, palms: world.palms.length, districts: 6, roadNodes: world.roads.nodes.length },
      performance: { samples: frameTimes.length, medianMs: percentile(frameTimes, 0.5), p95Ms: percentile(frameTimes, 0.95) } }),
  };
  advanceFixedStep(blank);
  if (query.has('shot')) stagePlayableScreenshot(query.get('shot'), game);
  requestAnimationFrame(frame);
}

function percentile(values, part) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor((sorted.length - 1) * part)] * 100) / 100;
}

function showFatalError(error) {
  console.error(error);
  document.getElementById('fatal').hidden = false;
  document.getElementById('fatal-message').textContent = error.message || String(error);
  window.__renderFailed = true;
}

try { bootOpenWorldCrimeGame(); } catch (error) { showFatalError(error); }
