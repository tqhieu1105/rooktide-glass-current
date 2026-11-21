# Checkpoint 5 — Rooktide Civic Patrol

Completed 2026-11-21 on `main` in `/data/home/makefun/gta6-01/entry-rooktide`.
Milestone 3 starts from milestone 2 commit `54df0a2`. The milestone 3 commits
are on `origin/main`.

## Police and wanted

A witnessed theft earns one star. Further witnessed offences and hits on
patrol cars raise heat. RCP dispatches off camera to clear street positions
100–180 metres away. Its cars route on the shared street graph, then steer
locally when they have sight. A warning precedes ramming and a hit can damage
both cars. At level 3, KITE-1 joins the search with a visible rotor and beam.
At levels 4–5, barricades can appear ahead of a junction with an open 5.6 m
lane. The high response allows up to five moving patrols and two barricades.

Buildings can block ground and aerial sight. When RCP loses visual contact,
the minimap marks the last known location and the stars pulse. The escape
window grows from 10 seconds at level 1 to 30 seconds at level 5. The HUD lists
live unit distances and tactics. Space held while stopped near RCP surrenders.
The recovery menu returns Neri to a nearby checkpoint or to Ilex’s yard with
a fee capped at $50. The cover checkpoint is a playable free-roam chase. The
campaign and garage systems remain later milestones.

## Verification

- `node tools/police-check.mjs` exercised witnessed theft, dispatch from
  132 m, pursuit, building occlusion, the 10-second one-star escape, all five
  response levels, helicopter activation, the ramming warning and contact,
  roadblock collision and removal, the drivable gap, surrender, and reset.
- `node tools/smoke.mjs` passed **26/26** checks, with zero errors, warnings,
  or external game requests. The cover resumed under ordinary input for 60
  seconds and covered **1,098 m**, ending at three stars and finishing
  with **76.5% bodywork**. Isolated SwiftShader timing at the low preset was
  **33.3 ms median** and **83.4 ms p95**.
- `node tools/drive-loop.mjs` completed **12/12 waypoints across six districts**
  and **4,433 m in 276 s**, including the Glasshook crossing and return. It also
  passed the keyboard collision check, with no recovery teleports or browser
  errors. The loop finished with **94.9% bodywork**.
- `node tools/population-check.mjs` matched the milestone 2 counts and
  crossing totals on both presets. The two-minute live market run logged
  64 crossings, and Neri took a second car while the Driftline stayed parked.
  That theft had no witness. The witnessed case was tested separately in
  `tools/police-check.mjs`.
- `node tools/verify-package.mjs` passed two deterministic package runs. The
  game is **37 files and 946,366 bytes**, below the 993-file and 48 MiB caps.
  The three JPEGs meet the 256 KiB and dimension limits. The kit and Three.js
  hashes match milestone 2.

## Captures versus milestone 2

`node tools/capture-shots.mjs` took three native 1280×720 JPEGs at quality 84,
frozen at tick 91. Side-by-side review used the milestone 2 JPEGs from
`54df0a2`.

| Capture | Milestone 2 | Milestone 3 | Change in the frame |
| --- | ---: | ---: | --- |
| `01-cover-chase.jpg` | 135,191 bytes | 138,491 bytes | Saffron Strand now shows two marked RCP cars beside the coupe, the helicopter and beam, three stars, and live dispatch. |
| `02-kiln-streets.jpg` | 124,496 bytes | 126,196 bytes | The same on-foot view, parked coupe, and market frontage now show the routine RCP status. |
| `03-glasshook-bridge.jpg` | 117,207 bytes | 120,368 bytes | The approach keeps the bridge alignment, gantry, and traffic. The routine RCP status reflects the quiet scene. |

Machine-readable evidence is in `verification/police.json`,
`verification/smoke.json`, `verification/browser-loop.json`, `verification/population.json`,
`verification/captures.json`, and `verification/package.json`.

## Recorder

PID `21255` was alive before code changes. The witness file for recording
`01a1fbdd-ebaa-75cf-9e45-503ede4bff45` grew from 2,006,102 to 2,009,385 bytes
during the required initial check. The existing recorder was left running.
No submission was made.
