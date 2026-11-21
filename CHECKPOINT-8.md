# Checkpoint 8 — combat and explosions

Milestone 6 builds on the verified milestone-5 main commit `a0f8501`. Combat
implementation is committed in `76866af`; this checkpoint records the final
captures and browser/package gates.

## Player combat

- On foot, **1** selects fists and **2** selects the pistol. **F** attacks with
  the selected weapon. The pistol has a 12-round magazine, 36 reserve rounds,
  camera-yaw-aligned hitscan, a small keyboard aim-assist cone, hit tracers,
  muzzle feedback, impact sparks and building/car line-of-sight checks. **R**
  reloads a low pistol magazine; otherwise it requests roadside recovery (or
  the existing mission retry path). Gunfire calls the existing RCP wanted
  system and makes nearby pedestrians scatter.
- Guards in The Quiet Ledger and Dead Channel use idle, investigate, aim, fire
  and reposition states. They react to hits, damage Neri with a short
  invulnerability window, and remain owned by their current mission stage so
  checkpoint retry recreates them safely.
- Shots damage civilian, mission-target and RCP vehicles. Bodywork below 68%
  emits smoke; below 36% it catches fire, and sustained flames or zero bodywork
  trigger an explosive launch with sparks, a smoke ring, bouncing traffic and
  tumbling debris. Mission-owned vehicles do not take chain damage. Destroying
  an active job vehicle fails that job into the existing checkpoint-retry
  flow.

## Verification

- `node tools/combat-check.mjs`: **7 checks pass** for pistol damage, wanted
  response, magazine/reserve reload, smoke/fire staging, and rendered debris
  after a vehicle blast.
- `node tools/mission-check.mjs`: **29 checks pass** across all six missions,
  including both guard encounters, retry, pursuit windows, deliveries and
  one-time rewards. Controller simulation, police checks and both population
  presets pass.
- `node tools/smoke.mjs`: **48 checks pass**. Real Chromium input selected the
  pistol and fists, fired with F, raised RCP heat, and reloaded with R. The
  Seawall Dividend chase drove through both gates. There were zero browser
  errors, warnings or external requests. SwiftShader timing was **33.3 ms
  median / 66.8 ms p95**.
- `node tools/drive-loop.mjs`: **12/12 live keyboard waypoints** across all six
  districts, **4,425 m in 258 s**, minimum bodywork **88.3%**, with no recovery
  teleports or browser errors.
- `node tools/capture-shots.mjs`: three fresh deterministic 1280×720 JPEGs at
  tick 91 and seed 20261121: cover **156,527 B**, Kiln Market **134,589 B**,
  Glasshook bridge **129,866 B**. Each is below 256 KiB. They were compared
  with milestone-5 captures at native resolution; the cover retains the clean
  Seawall Dividend pursuit and polished HUD. No combat effect obscures it.
- `node tools/verify-package.mjs`: two byte-identical outputs, **44 game files
  / 1,032,464 B**; three compliant screenshots, unchanged kit and Three.js
  hashes. The package is far below the 48 MiB / 993-file game limits.

Reports: `verification/combat.json`, `verification/smoke.json`,
`verification/missions.json`, `verification/browser-loop.json`,
`verification/captures.json`, `verification/package.json`.

## Recorder

Recorder PID `21255` for `01a1fbdd-ebaa-75cf-9e45-503ede4bff45` remained
running. Before edits, its witness file grew from 2,573,070 to 2,575,268 B;
it later grew to 3,034,333 B. The recorder was not started, stopped or sealed.
No submission was made.
