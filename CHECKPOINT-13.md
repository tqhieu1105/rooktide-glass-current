# Checkpoint 13 — Final polish

The last build milestone for the Tuesday, 24 November freeze starts from
verified M10 `388460f`. The style authority was **rooktide-style-bible**
(`/data/home/.codex/skills/rooktide-style-bible/SKILL.md`). Its cream to amber
wordmark, outlined white cash digits and teal glass take precedence over the
older pink wordmark, green money and unboxed dialogue in the early handoff.
The recorder was left untouched. No submission was made.

## Presentation

- The RCP dispatch floats in cream with a dark text shadow. The apparent
  red backing in M10 was also a real roadside sign directly behind the rows;
  the sign was moved clear of that sightline and given a teal face.
- The mission card, Crew Radio, weapon wheel and menus share the same 56%
  deep teal fill, subtle border, type scale and accent rules. In play the grid
  places the mission top left, vitals and wanted status top right, circular map
  and mirrored vitals bottom left, dialogue above the floating waypoint text
  at center, and the speed, bodywork and radio at bottom right. Backdrop blur
  is limited to the paused menus. All fonts are the existing local OFL files.
- No new mesh shapes or gameplay systems. The cover camera is slightly closer
  and the existing spotlight is less opaque. The Driftline keeps its sculpted
  body, with stronger separation between glass, paint and rear lights; Neri
  keeps the original articulated model with a warmer jacket. The existing
  Glasshook gantry faces the bridge approach and the market sign is visible
  from the sidewalk. Added only small collision footprints for the relocated
  Strand sign posts and the rotated gantry feet; the travel lanes stay clear.
- M8 streaming and M9 procedural surfaces are intact. Sparse lots are still
  visible in Kiln; world density was outside this milestone.

## Captures

The same three playable compositions, queries, seed `20261121` and tick 91
were used. At both 768 px and 320×180, the cover reads **Seawall Dividend**,
**$250**, **64**, and **three lit stars**. The mission card leaves the chase
silhouettes clear. Kiln retains Neri and the coupe as the foreground pair;
Glasshook now reads as a triangle and broken ring over the bridge.

| Capture | M10 bytes | Final bytes |
| --- | ---: | ---: |
| Cover chase | 167,063 | 168,890 |
| Kiln streets | 137,114 | 139,831 |
| Glasshook bridge | 137,327 | 147,421 |

All three 1280×720 JPEGs are direct Chromium captures below 256 KiB, with
zero external game requests or capture errors. A second capture matched each
JPEG byte for byte. `node tools/compare-shots.mjs 388460f` regenerates the two
side-by-side comparison PNGs as review evidence outside the game package.

## Performance and gates

| SwiftShader timing at 1280×720 | Market median / p95 | Live drive median / p95 |
| --- | ---: | ---: |
| M9 recorded | 33.4 / 66.7 ms | 33.4 / 83.3 ms |
| M10 recorded | 49.9 / 83.3 ms | 49.9 / 66.8 ms |
| Untouched M10 initial isolated recheck | 33.5 / 83.3 ms | 33.4 / 83.3 ms |
| Final repeat 1 | 33.4 / 66.7 ms | 33.4 / 99.9 ms |
| Final repeat 2 | 33.4 / 83.3 ms | 33.3 / 83.3 ms |

Alternating unchanged M10 and pre-optimization polish sessions still put
both builds near 50 ms in the market. This rules out the UI polish as the
sole cause; the VM showed substantial run-to-run variance. A main-thread
profile was 93% idle. The renderer had submitted the background before the
opaque city, shading sky and water that would later be covered. Drawing the
city first lets depth reject those fragments. Both follow-up medians reached
33.4 ms at the same 576×324 software render size; tail latency still varies.
All runs are recorded in `verification/timing-comparison-m11.json`.

- `node tools/load-probe.mjs verification/load-after-m11.json`: five runs,
  median **1,518.4 ms ready / 1,515.3 ms initialization**; 172 buildings,
  49 city chunks, 4–5 resident on readiness with four detailed. The previous
  M10 median was 3,499.0 ms ready; VM variation limits that comparison.
- `node tools/verify-package.mjs`: two byte-identical output trees,
  **46 game files / 1,092,711 B**, below the **993-file / 48 MiB** gate.
  The kit and Three.js hashes match; three final JPEGs are packaged.
- Fixed-step simulation and six-mission checks passed. The browser layout
  review verified matching glass fill, transparent dispatch, circular map,
  mirrored vitals, three SVG wanted stars and percentage bodywork.
- `node tools/smoke.mjs`: **57/57**, zero browser errors, warnings or
  external requests. The 60-second pursuit passed both gates with 88% bodywork.
  Its sampled median was 66.6 ms and p95 was 133.4 ms; the repeatable short
  probe numbers above do not imply a constant frame rate throughout a chase.
- `node tools/drive-loop.mjs`: **12/12 waypoints across all six districts**,
  **4,436 m in 263 s**, **93.7%** minimum bodywork, no recovery teleports or
  browser errors. The final 3,600-frame window measured **33.3 ms median /
  66.7 ms p95**. Residency stayed at or below eight chunks with four detailed.
