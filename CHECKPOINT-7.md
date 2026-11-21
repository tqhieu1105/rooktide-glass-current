# Checkpoint 7 — HUD and menus

Milestone 5 builds on verified `a8ada18` on `main` (milestone 4). The street
simulation, six jobs, fixed-tick capture entry points and offline package
are intact.

## Player-facing changes

- The live city sits behind the title. New Game starts at Kiln Market and
  asks for confirmation if a save exists. Continue restores cash and campaign
  progress, placing Neri on foot at a safe road node beside a usable car.
  An unfinished job can be started again at its contact.
- Escape pauses the simulation. Resume, Checkpoint Retry, Save Progress,
  Controls, Audio & Quality, Quit to Title and the latest crew transmission
  are available when relevant. Replay unlocks after the campaign. The
  completion card shows the payout and reputation; the failure card names
  the job and offers a checkpoint retry or a ride back to Ilex’s yard.
- The street HUD uses the bundled Anton and Barlow fonts. Cash and five SVG
  stars have distinct shapes and colors. The map has outlined routes and
  distinct target/police icons; **M** expands it. Speed, reverse, bodywork,
  health, weapon and ammo readouts reflect the live player state. Crew
  dialogue stays separate from the station and track display. **V** tunes
  three original offline synth stations or turns the radio off. Audio and
  quality preferences save in the same browser.

## Verification

- `node tools/smoke.mjs`: **43 passing checks**; zero browser errors, warnings
  or external requests. Real keyboard and mouse input covered the title,
  controls, audio/quality, save and Continue after reload, destructive New Game
  confirmation, both mission retry paths, and car radio tuning. The Seawall
  Dividend capture resumed into both gates, driving **1,114 m** in 60 seconds
  and finishing with **83.5%** bodywork. SwiftShader timing was **33.4 ms
  median / 66.7 ms p95**.
- `node tools/drive-loop.mjs`: **12/12 keyboard waypoints across all six
  districts**, **4,432 m in 261 s**, including the bridge crossing and return.
  The building collision check passed, with no recovery teleports or browser
  errors in the loop. Minimum bodywork was **85.4%**.
- `node tools/mission-check.mjs`: **29 checks** passed across all six jobs.
  Fixed-step police and controller checks passed. Both traffic presets reseeded
  correctly after a title reset. Local save checks covered
  corrupt or blocked storage and a valid milestone 4 save. A separate staged
  Chromium check ran Borrowed Voltage through the real mission code: its
  $700 / 100 RP result paused the city, and dismissal resumed it.
- `node tools/verify-package.mjs`: two byte-identical outputs, **42 game files /
  1,013,301 bytes**. The kit and Three.js hashes are unchanged. Three JPEGs
  meet the size and dimension caps.

## Captures versus milestone 4

`node tools/capture-shots.mjs` produced the native 1280×720 JPEGs (quality 84,
seed 20261121, tick 91). All three were viewed against `a8ada18` at native size
(the first visual pass) and at 300 pixels wide (the final set). The cover was also checked at 768 pixels wide: the
mission objective, wanted stars, cash and speed stayed distinct, and the
crew line fits on one line at 1280. No menu is part of the packaged set.

| Capture | Milestone 4 | Milestone 5 | Visible change |
| --- | ---: | ---: | --- |
| `01-cover-chase.jpg` | 146,220 B | 155,887 B | Same live Seawall Dividend pursuit and checkpoint, with two visible patrol cars, KITE-1 and its spotlight. Cash, three SVG stars, dispatch, route, speed/bodywork and the station sit outside the action. |
| `02-kiln-streets.jpg` | 127,347 B | 132,062 B | Same street and amber Ilex marker. Neri has an equipment panel on foot, with health, the map and the nearby car prompt separated. |
| `03-glasshook-bridge.jpg` | 120,229 B | 129,383 B | Same bridge approach and gantry, with a clearer map route, quiet RCP status and a dedicated driving and radio panel. |

Reports: `verification/smoke.json`, `verification/browser-loop.json`,
`verification/captures.json`, `verification/package.json`.

## Recorder

Recorder PID `21255` was alive before edits. The existing witness for
`01a1fbdd-ebaa-75cf-9e45-503ede4bff45` grew from 2,422,210 to 2,424,046 B.
The recorder was left running. No submission was made.
