# Checkpoint 4 — populated streets and golden-hour presentation

Completed 2026-11-21. Work directory: `/data/home/makefun/gta6-01/entry-rooktide`.
Branch: `main`. This checkpoint is the final milestone-2 handoff; no submission
was made.

## Delivery

Milestone-2 work was committed and pushed in these steps:

- `06b4127` — Add populated streets and golden-hour presentation
- `1dd8273` — Record performance and population verification
- `65b4336` — Verify populated six-district drive loop
- `932b567` — Refresh golden-hour capture evidence
- `9b8faa7` — Record final package gate

`origin/main` matched `9b8faa7` before this checkpoint was added. This note is
committed as the final milestone-2 commit. The source tree was clean at the
start of checkpoint preparation.

## Milestone-2 changes

- Added pooled civilian traffic and pedestrians, with lower-quality and
  higher-quality populations, parked car targets, traffic lane turns and
  intersection waits, sidewalk links, pedestrian crossing pauses and flight
  reactions, vehicle bumps, and recycled actors. E can take a nearby parked
  or stopped civilian car; the abandoned player car remains in the world.
- Kept the existing walking/driving controllers, collision response, camera,
  and frozen screenshot scenes. Added reusable local atlas textures for
  building facades, roads, sidewalks and sand, plus a golden-hour sky, warmer
  palette, and original neon signs.
- Vendored Anton and Barlow Latin WOFF2 subsets with SIL Open Font Licenses.
  The HUD, logo, district names, and speed display use the local fonts. The
  browser capture report records five loaded local font faces and no external
  requests.
- Reduced allocation and rendering work, enabled low-quality rendering by
  default on SwiftShader, and kept high quality available for capture and
  hardware-capable systems. The capture output stays 1280×720 and deterministic
  at tick 91.

## Verification

`node tools/smoke.mjs` passed all 24 live checks: boot, on-foot and vehicle
controls, safe entry/exit, collision, camera, map, pause, quality switching,
recovery, and a 60-second drive. It reported zero browser errors, warnings,
or remote game requests. The smoke run measured 33.3 ms median and 83.3 ms p95.

`node tools/timing-probe.mjs verification/timing.json --profile` measured the
SwiftShader software renderer at a 1280×720 viewport:

- Low-quality stationary market: **33.4 ms median**, **83.3 ms p95** across
  187 samples, 576×324 internal resolution, 95 calls and 14,616 triangles.
- Low-quality drive: **33.4 ms median**, **50.1 ms p95** across 222 samples,
  576×324 internal resolution, 53 calls and 4,058 triangles.
- High-quality market: **100.1 ms median**, **200.0 ms p95** across 56 samples,
  1120×630 internal resolution, with shadows enabled.

The low-quality median is about 30 fps on this VM. High quality is too slow for
real-time SwiftShader play and remains available as an option and for the still
captures. Hardware performance was not measured. The CPU profile showed the
browser idle for 97.81% of sampled CPU time, so the current limit is rendering.

`node tools/population-check.mjs` passed. Low quality held **14 cars, 4 parked
cars, and 24 pedestrians**; high quality held **26 cars, 8 parked cars, and 48
pedestrians**. In each two-minute simulation it recorded 64 and 117 completed
intersection crossings respectively. Traffic first appeared within 0.44 seconds
on low and immediately on high. A two-minute live market view stayed active,
recorded 64 crossings, and allowed a second civilian car to be taken while the
original Driftline remained present. The theft in that specific setup was not
witnessed; witness notification depends on a pedestrian being close enough.

`node tools/drive-loop.mjs` completed the full real-keyboard route in **260
seconds** and **4,434 m**. It visited all six districts, crossed to Glasshook
and returned, completed all 12 waypoints, and finished with **96.5% bodywork**.
A separate real keyboard impact check confirmed rebound without tunneling.
There were zero browser errors and no recovery teleports.

`node tools/capture-shots.mjs` regenerated all three native browser images at
1280×720, quality 84, frozen at tick 91:

- `screenshots/01-cover-chase.jpg` — 135,191 bytes; Saffron Strand, coast,
  moving traffic, palms, coupe, and HUD.
- `screenshots/02-kiln-streets.jpg` — 124,496 bytes; on-foot courier, parked
  car, pedestrians, market street, and HUD.
- `screenshots/03-glasshook-bridge.jpg` — 117,207 bytes; bridge approach,
  traffic, sea, gantry, and HUD. The approach remains in Saffron Strand, as
  reflected in the district label.

The side-by-side review against milestone-1 shots found warmer amber light,
more varied textured facades, road detail, clearer display typography, and
visible street activity. The composition and truthful scene labels remain
intact.

`node tools/verify-package.mjs` passed two deterministic package runs in 99 ms
and 92 ms. The game contains **35 files / 910,304 bytes**, below the 48 MiB /
993-file caps. The three screenshots are each below 256 KiB and meet the
1280×720 dimension limits. The unchanged kit library and Three.js r160 hashes
match the milestone-1 values.

Evidence is in `verification/smoke.json`, `verification/timing.json`,
`verification/population.json`, `verification/browser-loop.json`,
`verification/captures.json`, and `verification/package.json`.

## Recorder and local run

The existing recorder was left untouched. PID `21255` was alive at the final
health check; its witness file grew from 1,741,922 to 1,744,119 bytes during the
required initial check. No recorder start, stop, or seal action was used.

The development server was running at `http://127.0.0.1:8080` for the final
checks. If it is no longer available, start it from this repository with
`node serve.ts`. Browser test tools use the installed Chromium and do not need
network installs.

No secrets were printed or committed. No submission was made.
