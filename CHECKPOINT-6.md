# Checkpoint 6 — Undertow Relay missions

Milestone 4 starts from verified milestone 3 commit `70948d8` on `main`.
Build: `/data/home/makefun/gta6-01/entry-rooktide`, 2026-11-21.

## Campaign

Start at Ilex’s amber marker near the Kiln Market plaza. Free roam is open
immediately. Six jobs share one fixed-step mission system and have four
stages each. The HUD shows the active goal, next stage, distance, gate or
transfer status, and the contact’s radio line. The map routes through the
same street graph used by traffic and police. Use **E** to talk or collect,
**F** to attack during an encounter, **1/2** to select fists or the unlocked
pistol, and **Q** to use Sava’s unlocked patrol scan.

| Job | Encounter and reward |
| --- | --- |
| Borrowed Voltage | Take a marked compact, escape one star, and deliver to Ilex Auto: $700 / 100 RP and paid repair access. |
| The Quiet Ledger | Clear two quay guards, load the case, and deliver after losing two stars: $1,100 / 150 RP, pistol, and Sava’s scan. |
| Split Invoice | Stop a moving courier with impacts or shots, take the fragment on foot, and reach Sava’s drop: $1,400 / 200 RP. |
| Seawall Dividend | Pass two boulevard gates in a Driftline under three-star pursuit, lose KITE-1, and deliver: $1,800 / 250 RP. |
| Dead Channel | Defend a 30-second mast upload against three guards and bring the uplink to the bridge after losing four stars: $2,200 / 300 RP. |
| Glass Current | Collect the key, drive through a real bridge blockade, stop at two relays, and return to Ilex Auto after losing RCP: $3,000 / 400 RP. |

Mission alerts use the existing RCP dispatcher and line-of-sight search.
Wrecks, busts, defeats, and a missed courier have checkpoint recovery; the
player can also return to the yard or abandon a job. The broadcast ends the
story and opens replay. Browser storage preserves cleared jobs and cash.
Replays pay no duplicate rewards. The recommended route spans about 10 km
with contact approaches. The 25–35 minute first-run target is a design
estimate; no uninterrupted timed campaign was measured.

## Verification

- `node tools/mission-check.mjs`: **29 passing assertions** across all six
  missions, including real courier impacts, the car through the bridge gap,
  the upload and relay timers, the 10/15/20/25-second police windows, payout,
  persisted progress, ending, and replay. It runs the real fixed-step
  systems with fixture positions between encounters.
- `node tools/smoke.mjs`: **33 checks**, with 0 errors, 0 warnings, and 0 external requests. Real keyboard input started and retried Borrowed Voltage, then took the compact and earned one star. The cover resumed through both seawall gates and drove **1,132 m** in 60 seconds, finishing at **76.5%** bodywork. SwiftShader timing was **33.4 ms median / 66.7 ms p95**.
- `node tools/drive-loop.mjs`: **12/12 keyboard waypoints across six districts**,
  **4,433 m in 262 s**, including the Glasshook crossing and return. The
  deliberate collision check passed; no recovery teleports or browser errors.
  The loop finished at **96.5%** bodywork.
- `node tools/police-check.mjs` and `node tools/simulation-checks.mjs` passed.
  `node tools/population-check.mjs` passed both traffic presets and the
  two-minute live market check (64 crossings). The player took a second
  car with ordinary controls; the original Driftline remained parked.
- `node tools/verify-package.mjs`: byte-identical output on two runs, with
  **40 game files / 993,407 bytes**. All three JPEGs meet the count, byte, and
  dimension limits. The kit and Three.js hashes match milestone 3.

## Captures versus milestone 3

`node tools/capture-shots.mjs` took three native 1280×720 JPEGs, quality 84,
frozen at tick 91. All were visually compared with the corresponding
`70948d8` captures. Ordinary inputs resume the real simulation.

| Capture | Milestone 3 | Milestone 4 | Visible change |
| --- | ---: | ---: | --- |
| `01-cover-chase.jpg` | 138,491 B | 146,220 B | Seawall Dividend stage 2/4, a mint gate 65 m ahead, the route, and Ilex’s radio line. Two patrol cars, KITE-1, its spotlight, and three live stars remain visible. |
| `02-kiln-streets.jpg` | 126,196 B | 127,347 B | Ilex now stands by the plaza under an amber contact marker. The walking camera, street population, and parked coupe remain visible. |
| `03-glasshook-bridge.jpg` | 120,368 B | 120,229 B | Keeps the bridge approach, gantry, traffic, and quiet RCP status; the minimap points back to Ilex in free roam. |

Reports: `verification/missions.json`, `verification/smoke.json`,
`verification/browser-loop.json`, `verification/police.json`,
`verification/population.json`, `verification/captures.json`, and
`verification/package.json`.

## Recorder

PID `21255` was alive before source changes. The witness for recording
`01a1fbdd-ebaa-75cf-9e45-503ede4bff45` grew from 2,247,238 to 2,250,908 bytes
during the initial check. The existing recorder was left running. No
submission was made.
