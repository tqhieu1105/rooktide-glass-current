import { VEHICLE_TUNING } from './config.js';
import { CONTACTS } from './mission-data.js';
import { STATIONS } from './radio.js';

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const digits = Array.from({ length: 361 }, (_, n) => String(n).padStart(3, '0'));
const bearings = digits.map((value, n) => `${DIRECTIONS[Math.round(n / 45) % 8]}  /  ${value}°`);
const exploration = Array.from({ length: 7 }, (_, n) => `0${n} / 06`);
const rankThresholds = [0, 150, 400, 800, 1400];
const rankNames = ['Runner', 'Wheelhand', 'Link', 'Fixer', 'Current'];
const conditionWidths = Array.from({ length: 101 }, (_, n) => `${n}%`);
const objectives = ['Six districts. One continuous city.', 'Your next bad idea has four wheels.', 'Find your own way through the city.'];
const prompts = Object.fromEntries(Object.entries(VEHICLE_TUNING).map(([key, tuning]) => [key, `<kbd>E</kbd> Take the ${tuning.name}`]));
const walking = '<kbd>SHIFT</kbd> Sprint <span>·</span> Drag to look';
const drivingPrompt = '<kbd>E</kbd> Step out <span>·</span> <kbd>SPACE</kbd> Handbrake';

export function createStreetHUD(world, minimap) {
  const $ = id => document.getElementById(id);
  const elements = Object.fromEntries(['district', 'district-subtitle', 'explored', 'objective', 'prompt',
    'speed', 'drive-gear', 'mode', 'condition', 'condition-value', 'drive-readout', 'weapon-readout', 'pistol-slot', 'weapon-ammo',
    'station-readout', 'station-name', 'station-track', 'toast', 'compass', 'status', 'map-label',
    'city-cash', 'city-rank', 'rank-meter', 'game-time', 'health-value', 'health-bar', 'armour-value', 'armour-bar', 'weapon-name', 'free-roam', 'mission-card', 'mission-chapter', 'mission-title', 'mission-step',
    'mission-stages', 'mission-objective', 'mission-waypoint', 'mission-next', 'mission-radio', 'radio-contact', 'radio-line',
    'wanted-level', 'wanted-stars', 'dispatch-readout', 'heat-row', 'heat-meter', 'dispatch-units', 'aim-reticle', 'unlock-ilex', 'unlock-sava', 'unlock-daro', 'scan-status'].map(id => [id, $(id)]));
  const stars = [...elements['wanted-stars'].children];
  const rows = [...elements['dispatch-units'].children];
  const segments = [...elements['mission-stages'].children];
  const portrait = elements['mission-radio'].querySelector('.portrait');
  const cache = {};
  function text(id, value) {
    if (cache[id] !== value) { cache[id] = value; elements[id].textContent = value; }
  }
  let timer = 1, prompt = -1, bodywork = -1;
  function updateStreetHUD(player, car, rig, dt, expanded, target, police, missions, combat, station = 0) {
    timer += dt;
    const mapChanged = cache.expanded !== expanded;
    if (timer < 0.08 && !mapChanged && cache.station === station) return;
    timer = 0; cache.expanded = expanded; cache.station = station;
    const job = missions.snapshot();
    const action = missions.prompt();
    const driving = player.inVehicle;
    const near = !!target;
    const mode = driving ? 2 : near ? 1 : 0;
    const fighting = combat.weapon === 2 ? `<kbd>F</kbd> Fire <span>·</span> ${combat.reload ? 'Reloading' : `${combat.rounds} / ${combat.reserve}`}` : '<kbd>F</kbd> Swing';
    const promptHTML = action === 'Open Ilex Auto' ? '<kbd>G</kbd> Open Ilex Auto'
      : action ? `<kbd>E</kbd> ${action}` : driving ? drivingPrompt : `${fighting} <span>·</span> ${walking}`;
    if (promptHTML !== prompt || cache.district !== world.district.name) {
      elements.prompt.innerHTML = promptHTML;
      text('status', `${world.district.name}. ${driving ? 'Driving' : 'On foot'}. ${near ? 'Press E to enter car.' : ''}`);
      prompt = promptHTML;
    }
    text('district', world.district.name);
    text('district-subtitle', world.district.subtitle);
    text('explored', exploration[world.visited.size]);
    text('objective', job.point?.style === 'contact' ? `${job.point.label.split(' · ')[0]} is waiting · ${job.distance} m` : objectives[mode]);
    if (cache.cash !== job.cash) {
      cache.cash = job.cash;
      text('city-cash', job.cash.toLocaleString('en-US'));
      elements['city-cash'].setAttribute('aria-label', `Cash: $${cache['city-cash']}`);
    }
    const rankThreshold = rankThresholds.find(value => value > job.rp);
    text('city-rank', `${job.rank.toUpperCase()} · ${job.rp.toLocaleString()} RP`);
    const services = job.services || {};
    for (const [id, key, label] of [['unlock-ilex', 'ilexRepair', 'REPAIRS'], ['unlock-sava', 'savaScan', 'SCAN'], ['unlock-daro', 'daroBonus', '+10%']]) {
      elements[id].textContent = ` ${label} · ${services[key] ? 'READY' : 'LOCKED'}`;
      elements[id].classList.toggle('unlocked', !!services[key]);
    }
    const clockMinutes = 17 * 60 + 40 + Math.floor(world.clock / 60);
    text('game-time', `${String(Math.floor(clockMinutes / 60) % 24).padStart(2, '0')}:${String(clockMinutes % 60).padStart(2, '0')}`);
    if (cache.rp !== job.rp) {
      const nextRank = rankThresholds.findIndex(rp => rp > job.rp);
      const fraction = nextRank < 0 ? 1 : (job.rp - rankThresholds[nextRank - 1]) / (rankThresholds[nextRank] - rankThresholds[nextRank - 1]);
      elements['rank-meter'].style.width = `${fraction * 100}%`;
      const floor = nextRank > 0 ? rankThresholds[nextRank - 1] : 0;
      elements['rank-meter'].parentElement.setAttribute('aria-valuenow', String(job.rp - floor));
      elements['rank-meter'].parentElement.setAttribute('aria-valuemax', String(rankThreshold ? rankThreshold - floor : 1));
      elements['rank-meter'].parentElement.setAttribute('aria-label', rankThreshold
        ? `${job.rp} cumulative RP; ${rankThreshold - job.rp} RP to ${rankNames[nextRank]}`
        : `${job.rp} cumulative RP; maximum rank`);
      cache.rp = job.rp;
    }
    text('health-value', Math.ceil(player.health));
    if (cache.health !== player.health) {
      elements['health-bar'].style.width = `${player.health}%`;
      cache.health = player.health;
    }
    const armour = Math.max(0, Math.min(100, player.armour || 0));
    text('armour-value', Math.ceil(armour));
    if (cache.armour !== armour) { elements['armour-bar'].style.width = `${armour}%`; cache.armour = armour; }
    updateMission(job);
    text('mode', driving ? VEHICLE_TUNING[car.type].name : 'NERI VOSS');
    elements['drive-readout'].hidden = elements['station-readout'].hidden = !driving;
    elements['weapon-readout'].hidden = driving;
    elements['aim-reticle'].hidden = driving || combat.weapon !== 2;
    if (driving) {
      text('speed', Math.round(car.speed * 3.6));
      const forward = car.vx * Math.sin(car.heading) - car.vz * Math.cos(car.heading);
      text('drive-gear', forward < -.6 ? 'R' : 'D');
      const condition = Math.round(car.condition);
      if (condition !== bodywork) {
        bodywork = condition;
        elements.condition.style.width = conditionWidths[condition];
        text('condition-value', condition);
      }
      text('station-name', STATIONS[station].name);
      text('station-track', STATIONS[station].track);
    } else {
      elements['pistol-slot'].hidden = false;
      elements['weapon-ammo'].hidden = combat.weapon !== 2;
      elements['weapon-readout'].classList.toggle('pistol-equipped', combat.weapon === 2);
      text('weapon-name', combat.weapon === 2 ? 'PISTOL' : 'FISTS');
      elements['weapon-readout'].querySelector('.weapon-icon-frame').dataset.weapon = String(combat.weapon);
      const iconPath = elements['weapon-readout'].querySelector('.weapon-icon-frame path');
      iconPath.setAttribute('d', combat.weapon === 2
        ? 'M4 12h16l2 2h5v5h-7l-2-2H4zM10 17h5l1 8h-5zM21 12V8h3v4z'
        : 'M8 18c-2-1-3-3-2-5l2-4 3 1 2 3 2-6 3 1-1 5 2-4 3 1-2 6 2-3 3 2-4 8c-1 3-4 4-7 3l-4-2-4-5c-1-1-1-2 0-3Z');
      text('weapon-ammo', combat.reload ? 'RELOADING' : `${combat.rounds} / ${combat.reserve}`);
    }
    const toast = world.messageTime > 0 ? world.message : '';
    if (toast !== cache.toast) {
      text('toast', toast); elements.toast.classList.toggle('visible', !!toast);
    }
    const degrees = Math.round(((rig.heading * 180 / Math.PI) % 360 + 360) % 360) % 360;
    text('compass', bearings[degrees]);
    text('map-label', expanded ? 'BACK TO STREET MAP' : 'CITY OVERVIEW');
    const law = police.snapshot(), level = law.level;
    text('wanted-level', level ? law.state.toUpperCase() : 'ROUTINE');
    elements['heat-row'].hidden = !level;
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
      : 'AREA QUIET';
    text('dispatch-readout', dispatch);
    const scanText = job.scan > 0 ? `SAVA SCAN · ${Math.ceil(job.scan)}S` : job.scanCooldown > 0 ? `SCAN COOLDOWN · ${Math.ceil(job.scanCooldown)}S` : services.savaScan ? 'Q · ACTIVE SCAN READY' : 'SCAN LOCKED';
    text('scan-status', scanText);
    elements['scan-status'].hidden = !services.savaScan && !level && job.scan <= 0;
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
    minimap.drawRotatingMinimap(player, car, rig.heading, expanded, police, job.point, job.scan > 0);
  }
  function updateMission(job) {
    elements['free-roam'].hidden = job.active;
    elements['mission-card'].hidden = !job.active;
    if (job.active) {
      text('mission-chapter', job.replay ? `${job.chapter} / Replay` : job.chapter);
      text('mission-title', job.title);
      text('mission-step', `${job.index + 1} / ${job.total}`);
      text('mission-objective', job.text);
      text('mission-next', job.next ? `NEXT · ${job.next}` : 'FINAL STAGE');
      let info = job.point ? `${job.point.label} · ${job.distance} m` : 'Break line of sight';
      if (job.seconds) info += ` · ${Math.ceil(Math.max(0, job.seconds - job.held))} s`;
      if (job.guardCount) info += ` · ${job.guardCount} GUARDS`;
      if (job.targetCondition !== null) info += ` · ${job.targetCondition}% BODYWORK`;
      if (job.lost > 0) info = `OUT OF RANGE · ${Math.ceil(30 - job.lost)} s`;
      text('mission-waypoint', info);
      if (cache.stage !== job.index) {
        segments.forEach((segment, i) => { segment.className = i < job.index ? 'done' : i === job.index ? 'current' : ''; });
        cache.stage = job.index;
      }
    }
    elements['mission-radio'].hidden = !job.radio;
    if (job.radio) {
      const contact = CONTACTS[job.radio.contact];
      if (cache.portrait !== contact.name) {
        portrait.style.setProperty('--coat', contact.coat);
        portrait.style.setProperty('--skin', contact.skin);
        portrait.style.setProperty('--hair', contact.hair);
        cache.portrait = contact.name;
      }
      text('radio-contact', contact.name);
      text('radio-line', job.radio.line);
    }
  }
  return { updateStreetHUD };
}
