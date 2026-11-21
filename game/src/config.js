export const STEP = 1 / 60;
export const WORLD_LIMITS = { minX: -550, maxX: 608, minZ: -450, maxZ: 450, shoreX: 449 };
export const AVENUES = [-420, -252, -84, 84, 252, 420];
export const STREETS = [-360, -240, -120, 0, 120, 240, 360];
export const GLASSHOOK_GANTRY = { x: 565, z: -240, halfSpan: 25 };
export const PLAYER_TUNING = { walk: 4.2, sprint: 7.8, radius: 0.38, enterDistance: 4.5 };

// Original tuning data retained from our archived prototype; the simulation is new.
export const VEHICLE_TUNING = {
  sports: { name: 'Driftline GT', max: 155 / 3.6, acceleration: 12.4, grip: 7, mass: 1.1 },
  saloon: { name: 'Morrow Four', max: 125 / 3.6, acceleration: 9.8, grip: 8, mass: 1.4 },
  compact: { name: 'Nacre Sprint', max: 115 / 3.6, acceleration: 10.5, grip: 9, mass: 0.9 },
  van: { name: 'Rivet Panel', max: 95 / 3.6, acceleration: 6.9, grip: 6, mass: 2.1 },
  pickup: { name: 'Cask Utility', max: 105 / 3.6, acceleration: 8.2, grip: 7, mass: 1.8 },
};
export const DISTRICTS = [
  { id: 'strand', name: 'Saffron Strand', subtitle: 'THE CITY MEETS THE CURRENT', x: 420, z: 32, color: '#e9af68' },
  { id: 'market', name: 'Kiln Market', subtitle: 'CLAY / COFFEE / SMALL FAVOURS', x: 84, z: 28, color: '#d98265' },
  { id: 'quay', name: 'Relay Quay', subtitle: 'ROOKTIDE WORKING WATERFRONT', x: 252, z: 300, color: '#7ab4ba' },
  { id: 'cinder', name: 'Cinderbank', subtitle: 'REPAIR. REPEAT.', x: -420, z: 235, color: '#c3b37f' },
  { id: 'heights', name: 'Switchback Heights', subtitle: 'A LITTLE ABOVE THE NOISE', x: -420, z: -326, color: '#a8b8a2' },
  { id: 'glasshook', name: 'Glasshook', subtitle: 'TIDAL RELAY 06', x: 560, z: -240, color: '#9bd5cf' },
];
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
