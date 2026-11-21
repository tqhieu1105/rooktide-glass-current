# Checkpoint 9 — floating HUD, sunset palette, weapon wheel

Milestone 7 builds on verified milestone-6 commit `38dc47a`. The implementation
is in commit `7c5002d`; this checkpoint records the final browser, driving,
combat, mission, capture and package checks.

## UI and palette

- HUD elements float over the street: the upper-right cluster shows an in-game
  clock, cyan health and pink armour bars, green cash, the selected weapon icon
  and pistol ammunition, wanted stars and plain RCP dispatch lines. The armour
  meter honestly reads zero because the current game has no armour pickups.
- The circular minimap has only a thin dark outline. Mission and free-roam text,
  dialogue, prompts, cash, wanted indicators and projected labels have no solid
  backing; text shadows keep them legible. Pause and results cards use a dark
  translucent fill and backdrop blur.
- Mission targets add translucent colored columns in the world. The art palette
  moves from deep cobalt through magenta and hot pink to burnt orange, with a
  low sun, warm cream sand, turquoise water, pink/magenta Kiln Market and Relay
  Quay signage, and the original Anton Rooktide wordmark with a black outline
  and pink-to-orange gradient.
- The three capture scenes were compared with the milestone-6 images at native
  resolution. The cover still shows the Seawall Dividend chase. A separate
  768-pixel contact sheet retained the chase, objective, minimap, health, cash
  and wanted-star hierarchy.

## Weapon wheel

- Hold **Tab** to show a radial wheel and pause simulation. Mouse direction or
  the number keys select a slot; releasing Tab confirms. The slot layout is
  evenly spaced from its data list and can grow with the weapon roster.
- **1** and **2** still quick-select fists and pistol. **Q** remains assigned to
  Sava's scan.

## Verification

- `node tools/smoke.mjs`: **55 checks pass**, including the hold/release wheel,
  mouse and number-key picking, both quick-select keys, driving, saving, mission
  flow, combat, and the live Seawall Dividend chase. Zero browser errors,
  warnings or external game requests. SwiftShader: **33.4 ms median / 100 ms
  p95**.
- `node tools/drive-loop.mjs`: **12/12 waypoints** through all six districts,
  **4,440 m in 262 s**, minimum bodywork **95.7%**, and zero browser errors.
- `node tools/combat-check.mjs`: **7 checks pass** for pistol damage, wanted
  escalation, reload, vehicle damage staging and explosion debris.
- `node tools/mission-check.mjs`: **30 checks pass** across all six jobs,
  retries, wanted windows, payouts, guards and the finale.
- `node tools/capture-shots.mjs`: three deterministic 1280×720 JPEGs at tick
  91 and seed 20261121: cover **157,367 B**, Kiln Market **133,215 B**,
  Glasshook bridge **125,672 B**. Each is below 256 KiB.
- `node tools/verify-package.mjs`: two byte-identical builds, **44 game files /
  1,042,235 B**. The game remains far below 48 MiB / 993 files; screenshots
  meet the size and dimension limits.

Reports: `verification/smoke.json`, `verification/browser-loop.json`,
`verification/combat.json`, `verification/missions.json`,
`verification/captures.json` and `verification/package.json`.

## Recorder

Recorder PID `21255` was alive before editing; the existing witness grew by
2,922 bytes during confirmation. It was not started, stopped or sealed. No
submission was made.
