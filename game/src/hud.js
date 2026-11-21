import { VEHICLE_TUNING } from './config.js';

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const digits = Array.from({ length: 361 }, (_, n) => String(n).padStart(3, '0'));
const bearings = digits.map((value, n) => `${DIRECTIONS[Math.round(n / 45) % 8]}  /  ${value}°`);
const exploration = Array.from({ length: 7 }, (_, n) => `0${n} / 06`);
const conditionWidths = Array.from({ length: 101 }, (_, n) => `${n}%`);
const objectives = ['Six districts. One continuous city.', 'Your next bad idea has four wheels.', 'Find your own way through the city.'];
const prompts = Object.fromEntries(Object.entries(VEHICLE_TUNING).map(([key, tuning]) => [key, `<kbd>E</kbd> Take the ${tuning.name}`]));
const walking = '<kbd>SHIFT</kbd> Sprint <span>·</span> Drag to look';
const drivingPrompt = '<kbd>E</kbd> Step out <span>·</span> <kbd>SPACE</kbd> Handbrake';

export function createStreetHUD(world, minimap) {
  const $ = id => document.getElementById(id);
  const elements = Object.fromEntries(['district', 'district-subtitle', 'explored', 'objective', 'prompt',
    'speed', 'speed-unit', 'mode', 'condition', 'condition-row', 'toast', 'compass', 'status', 'map-label',
    'wanted-level', 'wanted-stars', 'dispatch-readout', 'heat-meter', 'dispatch-units'].map(id => [id, $(id)]));
  const stars = [...elements['wanted-stars'].children];
  const rows = [...elements['dispatch-units'].children];
  const cache = {};
  function text(id, value) {
    if (cache[id] !== value) { cache[id] = value; elements[id].textContent = value; }
  }
  let timer = 1, prompt = -1, bodywork = -1;
  function updateStreetHUD(player, car, rig, dt, expanded, target, police, cash) {
    timer += dt;
    const mapChanged = cache.expanded !== expanded;
    if (timer < 0.08 && !mapChanged) return;
    timer = 0; cache.expanded = expanded;
    const driving = player.inVehicle;
    const near = !!target;
    const mode = driving ? 2 : near ? 1 : 0;
    const promptHTML = driving ? drivingPrompt : near ? prompts[target.type] : walking;
    if (promptHTML !== prompt || cache.district !== world.district.name) {
      elements.prompt.innerHTML = promptHTML;
      text('status', `${world.district.name}. ${driving ? 'Driving' : 'On foot'}. ${near ? 'Press E to enter car.' : ''}`);
      prompt = promptHTML;
    }
    text('district', world.district.name);
    text('district-subtitle', world.district.subtitle);
    text('explored', exploration[world.visited.size]);
    text('objective', objectives[mode]);
    text('speed', driving ? digits[Math.round(car.speed * 3.6)] : 'NERI');
    text('speed-unit', driving ? 'KM / H' : 'VOSS');
    text('mode', driving ? VEHICLE_TUNING[car.type].name : 'UNDERTOW COURIER');
    const condition = Math.round(car.condition);
    if (driving && condition !== bodywork) {
      bodywork = condition; elements.condition.style.width = conditionWidths[condition];
    }
    if (elements['condition-row'].hidden === driving) elements['condition-row'].hidden = !driving;
    const toast = world.messageTime > 0 ? world.message : '';
    if (toast !== cache.toast) {
      text('toast', toast); elements.toast.classList.toggle('visible', !!toast);
    }
    const degrees = Math.round(((rig.heading * 180 / Math.PI) % 360 + 360) % 360) % 360;
    text('compass', bearings[degrees]);
    text('map-label', expanded ? 'CITY OVERVIEW · M TO CLOSE' : 'M · CITY OVERVIEW');
    const law = police.snapshot(), level = law.level;
    text('wanted-level', level ? `LEVEL ${level} / ${law.state.toUpperCase()}` : 'ROUTINE');
    const heat = `${law.heat}%`;
    if (cache.heat !== heat) { cache.heat = heat; elements['heat-meter'].style.width = heat; }
    const starLabel = `Wanted level: ${level} ${level === 1 ? 'star' : 'stars'}`;
    if (cache.starLabel !== starLabel || cache.wantedState !== law.state) {
      cache.starLabel = starLabel; cache.wantedState = law.state;
      elements['wanted-stars'].setAttribute('aria-label', starLabel);
      elements['wanted-stars'].classList.toggle('searching', law.state === 'search');
      stars.forEach((star, i) => star.classList.toggle('lit', i < level));
    }
    const dispatch = level
      ? law.state === 'search' ? `${Math.max(1, Math.ceil(law.escapeSeconds - law.unseen))} S TO CLEAR / STAY OUT OF SIGHT`
        : `${law.units.length} PATROL${law.units.length === 1 ? '' : 'S'}${law.helicopter ? ' + AIR SUPPORT' : ''}`
      : `AREA QUIET  /  $${cash}`;
    text('dispatch-readout', dispatch);
    const entries = level ? law.units.sort((a, b) => a.distance - b.distance) : [];
    const priority = [];
    if (law.helicopter) priority.push([law.helicopter, 'SPOTLIGHT']);
    if (law.roadblocks.length) priority.push([law.roadblocks[0], 'ROADBLOCK']);
    const lineup = entries.slice(0, rows.length - priority.length).map(unit => [unit, unit.ramTell ? 'RAM WARNING' : unit.mode.toUpperCase()]).concat(priority);
    elements['dispatch-units'].hidden = !lineup.length;
    rows.forEach((row, index) => {
      const entry = lineup[index]; row.hidden = !entry;
      if (!entry) return;
      const [unit, tactic] = entry;
      const label = `${unit.id || 'RCP'}  /  ${tactic}  /  ${Math.round(unit.distance)} M`;
      if (row.textContent !== label) row.textContent = label;
    });
    minimap.drawRotatingMinimap(player, car, rig.heading, expanded, police);
  }
  return { updateStreetHUD };
}
