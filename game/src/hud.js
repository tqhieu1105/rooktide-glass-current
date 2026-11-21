import { VEHICLE_TUNING, PLAYER_TUNING } from './config.js';

export function createStreetHUD(world, minimap) {
  const $ = id => document.getElementById(id);
  const elements = Object.fromEntries(['district', 'district-subtitle', 'explored', 'objective', 'prompt',
    'speed', 'speed-unit', 'mode', 'condition', 'condition-row', 'toast', 'compass', 'pause', 'status', 'map-label'].map(id => [id, $(id)]));
  let timer = 0;
  function updateStreetHUD(player, car, rig, dt, paused, expanded) {
    timer += dt;
    if (timer < 0.09) return;
    timer = 0;
    const driving = player.inVehicle;
    const near = Math.hypot(player.x - car.x, player.z - car.z) < PLAYER_TUNING.enterDistance;
    elements.district.textContent = world.district.name;
    elements['district-subtitle'].textContent = world.district.subtitle;
    elements.explored.textContent = `${String(world.visited.size).padStart(2, '0')} / 06`;
    elements.objective.textContent = driving ? 'Find your own way through the city.' : near ? 'Your next bad idea has four wheels.' : 'Six districts. One continuous city.';
    elements.prompt.innerHTML = driving ? '<kbd>E</kbd> Step out <span>·</span> <kbd>SPACE</kbd> Handbrake'
      : near ? '<kbd>E</kbd> Take the Driftline GT' : '<kbd>SHIFT</kbd> Sprint <span>·</span> Drag to look';
    elements.speed.textContent = driving ? String(Math.round(car.speed * 3.6)).padStart(3, '0') : 'NERI';
    elements['speed-unit'].textContent = driving ? 'KM / H' : 'VOSS';
    elements.mode.textContent = driving ? VEHICLE_TUNING[car.type].name : 'UNDERTOW COURIER';
    elements.condition.style.width = `${car.condition}%`;
    elements['condition-row'].hidden = !driving;
    elements.toast.textContent = world.messageTime > 0 ? world.message : '';
    elements.toast.classList.toggle('visible', world.messageTime > 0);
    const degrees = (rig.heading * 180 / Math.PI + 3600) % 360;
    const direction = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
    elements.compass.textContent = `${direction}  /  ${String(Math.round(degrees)).padStart(3, '0')}°`;
    elements.pause.hidden = !paused;
    elements['map-label'].textContent = expanded ? 'CITY OVERVIEW · M TO CLOSE' : 'M · CITY OVERVIEW';
    minimap.drawRotatingMinimap(player, car, rig.heading, expanded);
    elements.status.textContent = `${world.district.name}. ${driving ? 'Driving' : 'On foot'}. ${near && !driving ? 'Press E to enter car.' : ''}`;
  }
  return { updateStreetHUD };
}
