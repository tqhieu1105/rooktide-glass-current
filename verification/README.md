# Milestone 1 — verified 21 November 2026 (UTC)

This is the city/walking/driving prototype. Traffic, civilian pedestrians,
police/wanted, missions, combat, saves and audio are not implemented or claimed.
These are development checks, not a competition submission.

## Browser and real visual evidence

Installed **Chrome/154.0.8037.57**, headless, using WebGL2 / Three.js r160 and
ANGLE SwiftShader. `node serve.ts` actually listens at `127.0.0.1:8080`.
The game requests only local static files. The main world uses WebGL; only
the minimap uses a 2D canvas.

The three starter 2D images were removed. All replacements are direct,
full-viewport Chromium JPEG captures at **1280×720**, quality 84, with the
ordinary high-quality renderer. They were inspected individually: real
building height and perspective, sky, sea, visible player/coupe, bridge,
and readable HUD. No capture was resized, composited, painted over or enhanced.

| Capture | District at capture | Bytes | Draw calls | Triangles |
| --- | --- | ---: | ---: | ---: |
| `screenshots/01-cover-chase.jpg` | Saffron Strand | 115,342 | 73 | 34,816 |
| `screenshots/02-kiln-streets.jpg` | Kiln Market | 116,950 | 117 | 51,722 |
| `screenshots/03-glasshook-bridge.jpg` | Saffron Strand | 108,587 | 50 | 12,954 |

Each image is below 262,144 bytes. `captures.json` records URLs, seed,
tick, browser version, viewport, quality, SHA-256, source tree digest and
actual state. The third scene shows the **approach to Glasshook**; its honest
current district label is Saffron Strand. No scene claims a pursuit or mission.
The simulation freezes at tick 91 after 90 real fixed-step warm-up ticks and
one initial tick. Controls resume it. Camera presets/zoom and graphics quality
are ordinary gameplay settings. Frozen cameras no longer drift between frames.

## Gameplay checks

`smoke.json`: **24 passing browser checks**, no exceptions,
console errors, shader errors, warnings, HTTP failures or external requests.
Fresh no-query boot, W walking, Shift sprint, E entry/exit and held-key edge
detection, acceleration, moving-exit refusal, handbrake, service brake, safe
exit, persistent vehicle identity, C camera, mouse drag orbit, M map, Escape
pause, quality selection, R recovery and resuming screenshot state were tested
through real CDP keyboard/mouse events. The 60-second drive covered 926 metres.

`browser-loop.json`: a separate **real keyboard-driven browser run** first
hit a building deliberately (condition 91.0%,
x=113.3, z=-13.9) and observed a rebound.
It then restarted normally, entered with E, and drove all twelve route waypoints:
**4,429 metres in 292 seconds**, all six
districts, including the bridge to Glasshook and the return. Minimum bodywork
was **95.2%** after a minor bridge turnaround scrape.
No teleport, water/wreck recovery, pause, entity replacement or browser error
was used to complete the route. The final real HUD displayed **06 / 06**.

`simulation-checks.mjs` separately exercises the production controllers at
1/60 second: walk, enter, 83.7 km/h acceleration after two seconds, moving-exit
refusal, service brake, safe/blocked exits, handbrake deceleration and a
high-speed building impact without tunneling. Its seeded **4,421 m / 14,492
tick** loop visits every district with minimum condition 95.9% and no recovery
teleports. Running the full deterministic loop twice returns identical state.

Additional direct captures remain locally in `verification/on-foot-tested.jpg`,
`drive-60s.jpg`, `building-impact.jpg` and `loop-complete.jpg`. They are ignored
by Git; the runners regenerate them. The three canonical captures above are
committed and packaged. JSON evidence is committed.

## Performance and limitations

The 60-second measurement uses actual animation-frame intervals, before the
simulation's catch-up clamp. At low quality (960×540 internal 3D resolution,
1280×720 HTML HUD), median was **66.7 ms (~15 fps)** and p95 **133.4 ms** over
776 samples. Calls ranged **46–96**, triangles **8,400–61,716**. This VM uses
software rendering. **The 30 fps target is not met**; a hardware GPU was not
available for comparison. Inputs remained responsive enough to complete both
browser drives. This is a known performance limitation, not a 30 fps pass.

Static props are grouped in spatial instance batches, thin road surfaces use
two triangles instead of boxes, and low quality limits distant props behind
fog and uses contact shadows. High quality retains the wider city draw range
and directional shadows. The captured scenes remain below 150 draw calls and
100,000 triangles. Profile software rendering before adding population load
in the next milestone.

## Repairs made at the verification gate

- Removed literal patch markers that passed the earlier Node syntax check
  but caused a browser module `SyntaxError` and blank world.
- Corrected model/wheel yaw so east/west steering matches the controller,
  camera and collision coordinates.
- Lowered the default camera tilt and adjusted the ordinary bridge view to
  keep the skyline/landmark in frame.
- Improved HUD contrast over sand/sky and froze settled capture camera/FOV.
- Added bounded spatial rendering/low-quality settings and truthful frame
  interval measurement. No new gameplay systems were added.
- Fixed the packaging overlap guard's filesystem-root edge case.

## Deterministic package

`tools/verify-package.mjs` ran exactly `MAKEFUN_OUTPUT_DIR=out node main.ts`
twice consecutively. Final runs: **99 ms** and
**95 ms**. All output paths, byte sizes and file
hashes matched. `package.json` here is the evidence report, not an npm manifest.

The game contains **23 files / 747,851 bytes**.
All three screenshot sizes/dimensions passed. The dossier is exactly the
**bytes** returned by the unchanged kit's `buildDossier` (a `Uint8Array`), and
has schema `makefun/dossier/v1`. Full file inventory and hashes are in
`verification/package.json`.

`game/vendor/three.module.min.js` is unmodified third-party **Three.js r160**,
provided by the operator, with its original MIT license/copyright. It is not
agent-authored code. Both its expected SHA-256 and the unchanged
`vendor/makefun-game.ts` hash are asserted by the package verifier.

## Reproduce

From the repository root, leave `node serve.ts` running. In another shell:

```sh
node tools/simulation-checks.mjs
node tools/smoke.mjs
node tools/drive-loop.mjs
node tools/capture-shots.mjs
node tools/verify-package.mjs
```

Use one browser runner at a time so performance measurements remain meaningful.
The full keyboard loop takes about five minutes on this VM. Tools use Node
standard libraries and installed Chromium; the game needs no install/CDN.
Milestone 2 belongs to a fresh operator-started session.
