# Checkpoint 10 — district streaming and loading optimisation

Milestone 8 builds on verified milestone-7 commit `6ba0412`. The renderer now
builds district scenery only around the player and releases distant GPU assets.
The city remains a continuous, playable six-district map.

## Streaming and LOD

- The 172 building descriptions, collision grid, road graph and mission state
  remain lightweight simulation data. Buildings, palms, streetlights, signs and
  landmarks are partitioned into **49 district-owned, 192 m chunks**. A district
  with no selected chunks has no resident scenery meshes.
- Software mode keeps **at most eight chunks**, with **four detailed chunks**.
  High quality allows **18 chunks**, with **ten detailed**. Distance is measured
  from the player to chunk bounds, so district boundaries do not abruptly turn
  off a street. Hysteresis favors existing detail and reduces rebuilding near
  boundaries. The selection plan refreshes every eight frames, with at most one
  build or unload per frame.
- Detailed chunks contain textured facades, roof trim, awnings, palms and local
  landmarks. Far chunks use one simple facade volume per building, with coarser
  window repetition. Only one detail level is resident for each chunk. This
  uses replacement LOD rather than retaining both levels in `THREE.LOD` objects.
- Unloading removes meshes and disposes their instance buffers, geometries and
  materials. The builder's `own(resource)` hook also releases future chunk-owned
  textures or buffers. The small shared city atlas remains resident. This leaves
  a clear resource lifetime for heavier textures and denser local geometry.
- Shared road, shore, bridge and sea infrastructure remains available everywhere.
  Existing fog and spatial distance culling remain active (245 m software / 420 m
  high quality), along with Three.js frustum culling. Source records and collision
  data do not disappear when scenery unloads.
- The capture tool now waits for the normal streaming queue to settle after
  selecting high quality. Capture scenes use the same bounded streamer as play.

## Before and after

All browser measurements use headless Chromium 154 with ANGLE SwiftShader at a
1280×720 viewport. Software mode renders the 3D view at 576×324.

| Measurement | M7 / before | M8 / after |
| --- | ---: | ---: |
| Full keyboard drive loop | 12/12; 262 s; 4,440 m | 12/12; 260 s; 4,436 m |
| Loop frame median / p95 | 33.3 / 66.7 ms | 33.3 / 50.1 ms |
| Loop minimum bodywork | 95.7% | 88.1% |
| Smoke frame median / p95 | 33.4 / 100 ms | 33.3 / 66.7 ms |
| Startup-ready median, five cache-disabled navigations | 3,805.0 ms | 3,326.7 ms |
| Response-end to readiness median | 3,798.6 ms | 3,322.8 ms |
| First load-probe run, ready time | 1,959.6 ms | 1,606.4 ms |
| Render geometries at startup readiness | 39 | 38 |
| Render calls / triangles at startup readiness | 108 / 12,956 | 99 / 8,216 |
| Render geometries at loop end | 102 | 79 |
| Game files / bytes | 44 / 1,042,235 | 45 / 1,050,144 |

The before drive numbers come from the already-verified M7 report at `6ba0412`;
the new load probe was run against M7 before implementation and repeated after
the change. Startup-ready time includes shader compilation and the first three
rendered frames, then readiness polling; it is not a network-only timer. The
five-run median improves by **12.6%**, with variable SwiftShader launch overhead.
Timing probes were run in isolation for the retained comparison; simultaneous
browser runs caused CPU contention and were discarded.

At the end of the full loop, **8/49 chunks** were resident across **two districts**:
four detailed and four simplified, with 433 scenery instances in 46 batches.
The loop built **103 chunks** and unloaded **95**, with **72.4 ms cumulative CPU
build time**. This excludes shader upload/GPU execution. The recorded rolling
frame sample covers the most recent 3,600 frames. The initial ready page had
four or five chunks across one or two districts, rather than the complete city.

The shared atlas remains one texture. This milestone establishes bounded scenery
residency and disposal; it does not claim a measured byte budget for texture or
polygon upgrades that have not been built yet. Those upgrades must keep the
software chunk/detail limits and rerun the drive and package gates.

## Verification

- `node tools/smoke.mjs`: **57 checks pass**, including startup residency, live
  unloading, detailed and simplified chunk residency, original menu/save/mission
  controls, the weapon wheel, pistol/reload and the 60-second pursuit. Zero
  browser errors, warnings or external game requests. The pursuit's damage
  threshold varied between runs, as did the wheel's short timing check on one
  attempt; the retained full run passes without weakening any existing threshold.
- `node tools/drive-loop.mjs`: **12/12 waypoints**, all **six districts**, **4,436 m
  in 260 s**, **88.1% minimum bodywork**, zero browser errors and no recovery
  teleports. The normal keyboard-driven building collision check also passed.
- `node tools/timing-probe.mjs verification/timing-after-final.json`: isolated
  market **33.3 ms median / 50.1 ms p95**; live drive **33.3 / 66.6 ms**.
- `node tools/load-probe.mjs`: five cache-disabled navigations before and after,
  with full records in `load-probe-before.json` and `load-probe-after-final.json`.
- `node tools/capture-shots.mjs`: three refreshed **1280×720** JPEGs: cover
  **156,695 B**, Kiln Market **132,913 B**, Glasshook Bridge **125,700 B**. Each is
  below **256 KiB**. They were viewed and compared with M7; the chase, floating
  HUD, sunset colors and bridge composition remain intact. Distant city dressing
  follows the streaming radius and LOD.
- `node tools/verify-package.mjs`: two byte-identical builds, **45 game files /
  1,050,144 B**, below **993 files / 48 MiB**. Vendor Three.js and kit hashes remain
  unchanged.

Reports are in `verification/`, including the retained before/after load probes,
`streaming-comparison.json`, `smoke.json`, `browser-loop.json`,
`timing-after-final.json`, `captures.json` and `package.json`.

## Recorder and follow-up

Recorder PID **21255** remained running and was never started, stopped or sealed.
The witness reached **4,481,785 bytes** during verification; the final handoff
records the later size and exact session usage at its last read. No submission
was made, and the repository's git author was not changed.

Next: planned texture and polygon upgrades can use chunk-owned resources; then
progression and final polish, with fresh software driving and package checks.
