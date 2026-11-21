# Checkpoint 11 — texture and polygon upgrade

Milestone 9 builds on the verified Milestone 8 commit `1cb785b`. The 49 district-owned
192 m chunks keep their existing streaming schedule and eviction rules. The art
pass adds detail within the existing residency budgets and leaves world collision,
city layout, and the three screenshot compositions in place.

## What changed

- Ground color and roughness come from periodic, seeded samples. A shallow
  virtual relief gives greener hollows and drier ridges while the physical ground
  remains level. Detailed chunks scatter seeded grass tufts and low, faceted
  stones. Grass tapers toward the tip and bends with gusts in the vertex shader.
- The shared city atlas still supplies masonry, asphalt, paving, sand and water
  color. High quality combines it with seeded, repeating 128×128 roughness maps
  and per-surface response: polished patches interrupt the asphalt aggregate,
  while sand and masonry stay matte. Teal water layers broad swells, atlas
  highlights and shore foam over the near-to-deep color transition.
- Neri has a shaped head, courier jacket and pack, and articulated limbs. The
  pistol slot uses an original fictional prop attached to the animated hand. The
  Driftline GT has a sculpted coupe shell, glass canopy, panel gaps, rear lights,
  grilles and wheel hardware. Civilian traffic has shared sculpted body shells
  and instanced wheels. Detailed chunks add palm leaflets and trunk bands, lamp
  fittings, window ledges, vents, pipes and fasteners.
- Chunk eviction releases the new roughness maps along with chunk geometry and
  materials. Far chunks retain simplified scenery. Software mode uses Lambert
  lighting for broad surfaces; an earlier all-PBR trial put the SwiftShader
  median near 50 ms. High quality enables roughness sampling on those surfaces.
  All new art is generated in code at runtime.

## Before and after

Raw CDP, Chromium 154 with ANGLE SwiftShader, 1280×720 viewport. The software
tier renders the world at 576×324. Timing and load probes ran with no other
game browser job active. Load values are medians from five cache-disabled
navigations; readiness includes initialization and the first three frames.

| Measurement | M8 / before | M9 / after |
| --- | ---: | ---: |
| Market timing probe, median / p95 | 33.3 / 50.1 ms | 33.4 / 66.7 ms |
| Live drive timing probe, median / p95 | 33.3 / 66.7 ms | 33.4 / 83.3 ms |
| Startup ready | 3,357.0 ms | 3,913.8 ms |
| Response end to ready | 3,354.0 ms | 3,911.5 ms |
| Smoke pursuit, median / p95 | 33.3 / 66.7 ms | 33.4 / 66.7 ms |
| Full keyboard loop | 12/12; 260 s; 4,436 m | 12/12; 259 s; 4,430 m |
| Full loop frame median / p95 | 33.3 / 50.1 ms | 33.3 / 66.6 ms |
| Full loop minimum bodywork | 88.1% | 96.5% |
| Full loop cumulative CPU chunk build time | 72.4 ms | 451.1 ms |
| Game files / bytes | 45 / 1,050,144 | 46 / 1,078,821 |

The short driving median holds near 33 ms. The p95 is about one 60 Hz refresh
interval slower in both short probes, and startup readiness is 0.56 s slower
(16.6%). The software tier reports two uploaded textures in the timing probes.
The high-quality captures settled at 18 resident chunks, with nine or ten
detailed chunks and five to twelve uploaded textures, depending on the view.
The full software loop built 102 chunks and evicted 94; it peaked at eight
residents and ended with four detailed and four simplified. Chunk build time
counts CPU work only and excludes GPU upload. Full loop frame statistics cover
the final 3,600 frames.

## Captures

The final JPEGs are 1280×720, under 256 KiB each. I viewed the Milestone 8 and
Milestone 9 frames side by side at 320×180. The unchanged framing preserves the
chase, on-foot market view and bridge approach. The coupe shape and street wear
read at thumbnail size; the finest hardware and vegetation are full-size detail.

| Screenshot | Exact bytes | Draw calls, M8 → M9 | Triangles, M8 → M9 |
| --- | ---: | ---: | ---: |
| `01-cover-chase.jpg` | 165,439 | 101 → 113 | 11,354 → 31,788 |
| `02-kiln-streets.jpg` | 134,620 | 137 → 170 | 12,652 → 39,542 |
| `03-glasshook-bridge.jpg` | 135,701 | 55 → 52 | 6,776 → 16,894 |

## Verification

- `node tools/smoke.mjs`: **57/57**. Zero browser errors or warnings and zero
  remote requests. The 60-second pursuit finished with **77.8%** bodywork.
  It observed live chunk eviction and reached eight residents, four detailed.
  Quick weapon picks now stay queued until the simulation handles them, and
  smoke waits for published game and UI state before checking those controls.
- `node tools/drive-loop.mjs`: **12/12 waypoints**, all six districts, zero
  recovery teleports or browser errors. The independent building collision
  check passed. Details are in `verification/browser-loop.json`.
- `node tools/timing-probe.mjs verification/timing-after-m9.json` and
  `node tools/load-probe.mjs verification/load-after-m9.json`: raw before/after
  records are in `verification/` (`*-before-m9.json`, `*-after-m9.json`).
- `node tools/capture-shots.mjs`: three final views from unchanged `shots.json`;
  hashes, browser state and game tree hash are in `verification/captures.json`.
  All 88 instanced detail transforms across Neri and the Driftline GT also
  passed a finite, positive dimension check below 5 m.
- `node tools/verify-package.mjs`: two byte-identical output trees. The package
  is **46 files / 1,078,821 B**, within the **993-file / 48 MiB** gate. The kit and
  Three.js vendor hashes match the originals. The three packaged JPEGs match
  the captures; `verification/package.json` records their dimensions and hashes.

The capture review used the graphics builder's 0–3 scale for the active scenes.
This is a focused art pass; the remaining sparse lots are most visible in Kiln.

| Category | M8 → M9 | Evidence |
| --- | ---: | --- |
| Art direction | 2 → 2 | Sunset palette, original place names and type remain coherent. |
| Hero | 1 → 2 | Neri and the coupe have distinct forms and visible trim in Kiln. |
| Obstacles | 2 → 2 | Patrol lights and road markings still distinguish the chase traffic and road edge. |
| Interactables | 2 → 2 | The live mission gates and Ilex marker retain their silhouettes and feedback. |
| World | 1 → 1.5 | Palms and street fittings add foreground detail; some parcels still read as empty. |
| Materials | 1 → 2 | Road wear, body paint, glass and terrain separate in the same light. |
| Lighting | 2 → 2 | Sunset still establishes depth; gloss and matte surfaces now respond differently. |
| Motion and effects | 2 → 2 | Pursuit cues remain clear; vegetation and water gain motion. |
| HUD | 2 → 2 | Route, district and wanted state remain readable across the three views. |
| Performance evidence | 3 → 3 | Both milestones have probe, drive, residency and package reports. |

Mean review score: **1.8 → 2.05**. No make.fun submission was made.
