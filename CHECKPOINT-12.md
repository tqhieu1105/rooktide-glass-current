# Checkpoint 12 — progression, crew services, and garage

Milestone 10 builds on the verified Milestone 9 commit `2147f5b`. The implementation is committed and pushed as `c48123a` (with the main feature in `a37dd09`). The recorder was not touched and no submission was made.

## What changed

- Progression is authoritative in the mission/save system: Runner, Wheelhand, Link, Fixer, and Current use cumulative RP thresholds of 0, 150, 400, 800, and 1400. The HUD shows the current rank, cumulative RP, an accessible progress meter, and live service status.
- Ilex repair access unlocks after the first clear and repairs the current or stored vehicle for exactly $150. Sava's Q scan unlocks after the second clear, lasts ten seconds, has a 60-second cooldown, and reveals active patrol and search positions on the minimap. Daro contacts add a 10% cash delivery bonus to their completed jobs.
- A versioned save record (`rooktide-campaign-1`, version 2) now validates and stores RP, derived crew services, one garage vehicle, condition, paint, and stored/active state. Legacy records remain loadable and migrate on the next save; invalid records fall back to a new session.
- Ilex Auto is a real garage screen opened with G at the yard. It stores one owned vehicle, leaves an accessible compact replacement, recalls the stored vehicle, repairs unlocked bodywork, and offers Copper Bloom, Saffron Alloy, and Quay Ceramic original palettes. Repair and failure fees clamp at zero cash, and mission completion/replay payout remains single-award.
- The existing mission and police authorities remain in charge of rewards, scan state, car condition, wanted positions, and save checkpoints. Basic walking, theft, police, and free roam remain available at every rank. M8 chunk streaming and M9 generated textures/polygon detail were not changed.

## Verification

The specified tools passed after the implementation:

- `node tools/smoke.mjs`: **57/57**, zero browser/runtime/network errors; the real W/E drive loop, pursuit, save/continue, weapon loop, streaming, and capture mission all remained live.
- `node tools/drive-loop.mjs`: **12/12** waypoints across all six districts, zero recovery teleports or browser errors; minimum bodywork **88.5%** in the final run.
- `node tools/timing-probe.mjs verification/timing-after-m10.json`: market **49.9 ms median / 83.3 ms p95**; live drive **49.9 ms median / 66.8 ms p95**. The verified M9 record was market **33.4 / 66.7 ms** and drive **33.4 / 83.3 ms**; timing varies with the SwiftShader VM load.
- `node tools/load-probe.mjs verification/load-after-m10.json`: median ready **3,499.0 ms**, initialization **3,495.6 ms**, 172 buildings, 49 chunks, four detailed resident chunks in the settled baseline. M9 was **3,913.8 / 3,911.5 ms**.
- `node tools/capture-shots.mjs` using the unchanged three entries in `shots.json`: all three 1280×720 JPEGs captured directly from the settled WebGL scenes, at **167,063 B**, **137,114 B**, and **137,327 B**.
- `node tools/verify-package.mjs`: two deterministic package runs; **46 game files / 1,094,492 B**, three screenshots, unchanged kit and Three.js hashes, within the **993-file / 48 MiB** gate.

Additional fixed-step checks passed for the six missions, five-star police, combat, population, simulation, save migration, Daro bonuses, Sava scan, and garage store/recall/paint behavior. The mission fixture ends at **6 jobs, $10,630, 1,400 RP**, and confirms replay does not mint another reward.

The final tree is pushed to `origin/main`. Stop here; nothing was submitted.
