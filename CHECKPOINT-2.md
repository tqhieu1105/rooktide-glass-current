# Checkpoint 2 — milestone 1 blocked at browser verification

Date: 21 November 2026 (UTC). Branch: `main`.
Recording: `01a1fbdd-ebaa-75cf-9e45-503ede4bff45`.

**Milestone 1 is NOT complete. No real 3D screenshot exists. The game has
not been observed running in a browser, and zero console errors has NOT
been established. Implementation stopped at the requested verification
blocker; there is no 2D fallback.**

## What was written

- `RESEARCH-ARCH.md`: local architecture study of leonida and gta7, adopted
  boundaries, rejected systems, custom arcade physics/size verdict and
  browser smoke-test approach. No research implementation or assets copied.
- Procedural Three.js scene code for the continuous coastal city: 30 main
  blocks, six named districts, buildings with real heights/window bands,
  roads/crosswalks, sea, beach, palms, lamps, physical sign lettering,
  market canopy, repair canopy, crane, water tower, mast, tidal gantry,
  connected Glasshook bridge and pier.
- Articulated courier and a box/prism coupe model. Authored fixed-step
  on-foot and arcade-car controllers, E enter/exit ownership, safe-side
  exit checks, shared static spatial collision grid/substeps, handbrake,
  bounded crash rebound, recovery, third-person orbit/chase cameras.
- Initial DOM HUD, a 2D minimap overlay (the only 2D drawing context),
  controls/pause panel, quality switch and truthful milestone-only views.
  No traffic, wanted/patrols, missions, combat, saves or audio are claimed.
- `main.ts` now has authored required-input checks, output overlap guards
  and cleanup of only the generated game/screenshots subtrees. The kit
  dossier options are preserved.
- `serve.ts`: standard-library static development server.
- `tools/browser.mjs`: initial standard-library Chromium/CDP helper; it is
  **untested**, and its debugging-port approach will also need localhost
  binding permission. A complete smoke/capture runner is not yet written.

These are **implemented code paths, not verified working features**.
`node --check` passed for `game/src/main.js`, `game/src/render.js` and
`tools/browser.mjs`; those syntax checks do not prove shaders or gameplay work.

## Exact verification blocker

Attempt to start the static server:

```sh
node serve.ts
```

Result: exit 1 before serving a page:

```text
Error: listen EPERM: operation not permitted 127.0.0.1:8080
```

Then tried the installed headless browser directly against local static
files, without an HTTP server or an external network request:

```sh
/usr/bin/chromium --headless=new --no-sandbox --disable-dev-shm-usage \
  --disable-crash-reporter --disable-breakpad --allow-file-access-from-files \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --user-data-dir=/tmp/rooktide-first-browser \
  --screenshot=/data/home/makefun/gta6-01/entry-rooktide/verification/first-render.png \
  --window-size=1280,720 --timeout=15000 \
  file:///data/home/makefun/gta6-01/entry-rooktide/game/index.html
```

Result: exit 133 before a page/render could be inspected:

```text
ERROR:third_party/crashpad/crashpad/util/linux/socket.cc:45
setsockopt: Operation not permitted (1)
```

The command sandbox denies operations needed by the server and browser.
No approval escalation is available in this session. The desktop app list
showed a terminal and desktop processes, with no running browser. No
attempt was made to alter sandbox restrictions or operate the terminal UI.

Screenshot proof path: **none**. The attempted
`verification/first-render.png` does **not** exist.
Visual verdict: **UNVERIFIED / FAIL — browser could not start**.
No claim about actual perspective, height, sky rendering or console
cleanliness can be made until a real capture is viewed.

## Dependency and delivery status

- The operator-provided Three.js r160 is imported locally and was not
  downloaded or modified by this session. It is third-party vendored code,
  not agent-authored work. Size: **670,681 bytes**. SHA-256:
  `3e690ac7d180b0aadf0891bea39eec643e29e2d3e75c99b18689518665f69ba6`.
- `vendor/makefun-game.ts` is byte-identical to the kit starter. SHA-256:
  `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`.
- Required package command is still
  `MAKEFUN_OUTPUT_DIR=out node main.ts`. **It was not run after the mandatory
  renderer-verification stop. Valid output and determinism remain unverified.**
- `screenshots/` still contains the three **starter 2D images**. They are
  not proof of this game and must be replaced with actual 3D browser captures
  before any valid milestone/release claim. `shots.json` is also still the
  starter manifest; align it with the real milestone views after rendering works.
- No git write command, submit command, recorder-start or recorder-stop
  command was run. The operator must commit/push when ready. README remains
  session 2's document; do not mistake its old dependency-blocker text for
  the current blocker above.

## Recorder health and next task

Recording still alive: **yes** at the final check. PID **21255** was present.
The known recording witness file grew from **253,996** to **306,562 bytes**
during this session. Its path is
`/data/home/.makefun/recording-01a1fbdd-ebaa-75cf-9e45-503ede4bff45.leaves.jsonl`.
It was left running, as instructed.

Next task: supply an execution context that permits installed Chromium to
start and permits a localhost static server (or provide a supported browser
automation capability). Resume **milestone 1**, not milestone 2. First
run and inspect a genuine 3D screenshot, repair any runtime/shader/layout
defects, test keyboard walking/enter/drive/brake/exit/collision and the
district loop, measure actual draw calls/performance, replace starter
screenshots and manifest, run deterministic packaging checks, then write
the successful milestone handover. No further game systems should be added
until this verification gate passes.
