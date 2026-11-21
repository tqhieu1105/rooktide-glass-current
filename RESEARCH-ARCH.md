# Architecture research — milestone 1

Studied locally on 21 November 2026. These are design observations, not code
imports. No implementation, geometry, art, or binary from either research
repository was copied into Rooktide.

## Material read

- `research-repos/leonida`: README, `docs/PROGRESS.md`, package manifest, and
  the `src/core`, `world`, `gfx`, `entities`, `systems`, `physics`, `ui`, and
  `missions` layout. No root CLAUDE.md was present. The progress report is
  valuable because it distinguishes implemented features from browser-tested
  features and names integration failures, including actor visibility and
  dependent initialization arriving before road generation.
- `research-repos/gta7`: README, CLAUDE.md, package manifest, and the
  `src/core`, `world`, `render`, `vehicles`, `systems`, `entities`, and `ui`
  layout. No root PROGRESS.md was present. The documented split between pure
  simulation and rendering and the keyboard-driven browser checks fit this
  small static deliverable.
- Our own `archive/2d-attempt` was read with `git show` for mission stages,
  dialogue, original vehicle tuning, and the four scenario intentions. Its
  renderer is not reused. Full missions and their screenshot scenarios belong
  to later milestones; milestone 1 will not display invented pursuit state.

## Patterns adopted and mapped to this repository

| Observation | Rooktide implementation boundary |
| --- | --- |
| Fixed-step simulation, render once per animation frame | `game/src/main.js`, 60 Hz, bounded accumulator |
| Deterministic world data independent of meshes | `world.js`, `roads.js`, `random.js` |
| Single authoritative actor state | `player.js`, `vehicles.js`; enter/exit changes ownership of the same car |
| Shared spatial broad phase | `collision.js`; static AABBs indexed once, movement substeps |
| Rendering factories and a shared palette | `geometry.js`, `buildings.js`, `coast.js`, `render.js`, `art-direction.js` |
| Damped third-person camera | `camera.js`; normal orbit and chase presets, obstacle shortening |
| Input edge detection and blur clearing | `input.js`; E cannot trigger every held frame |
| Truthful HUD separated from the world | `hud.js`, `minimap.js`, `game/styles.css` |
| Browser proof beyond source inspection | `tools/smoke.mjs`; Chromium CDP, actual WebGL, keyboard interactions, console and screenshot evidence |

Coordinates are our own explicit convention: X east, Z south, Y up;
heading zero faces north (negative Z). Forward is `(sin(h), -cos(h))` in
the ground plane. All actor, vehicle, camera, and minimap code shares it.

## Rejected or deferred

- Vite/TypeScript compilation and package installation: runtime must already
  be plain static ES modules and packaging must use only Node's standard library.
- Giant system registries and silent disabling after an exception: direct
  initialization is easier to inspect; a renderer failure produces a visible
  error and fails the smoke test. There is no 2D fallback.
- Imported assets, CDN radio, remote modules, streamed chunks, interiors,
  casino, six weapons, companions, and day/night: outside this milestone or
  incompatible with the original, offline, compact game.
- Per-lamp shadow lights and individual meshes for every window: static
  geometry is instanced by shape/material; one directional shadow light.
- Procedural canvas facade textures: the session's stricter rule permits a
  2D canvas only for HUD/minimap. Even world sign lettering is mesh geometry.

## Physics and dependency verdict

Use an authored kinematic arcade model, no external physics dependency.
Forward/lateral velocity, grip reduction under handbrake, a bicycle-like yaw
response, bounded rebound, and visual suspension provide predictable driving.
Static collision uses a spatial grid plus substeps; the car uses multiple
footprint probes rather than a point. A full rigid-body engine's WASM/loading
and stability work does not help milestone 1 and cannot be newly downloaded
in this sandbox.

The operator supplied authentic Three.js r160 (0.160.0),
`game/vendor/three.module.min.js`, 670,681 bytes, plus MIT license. It is a
third-party renderer, not agent-authored code. It is imported by a local relative
ES-module path, unmodified. No additional engine/example modules are needed.
This leaves substantial room below the 48 MiB game cap.

## Verification approach

Run one installed headless Chromium via the Chrome DevTools Protocol, served
by our standard-library static server. No browser package download is needed.
Record console exceptions, failed HTTP requests, non-local requests, WebGL
renderer/version, draw calls/triangles, and real browser screenshots. Verify
normal no-query boot, walking, E enter/exit, W acceleration, braking, steering,
pause, collision, camera switching, and the connected district road loop.
Screenshot presets use the same world, actors, controllers, and camera as
normal play; they claim only the systems implemented in this milestone.
Inspect the PNG/JPEG visually for actual height, perspective and sky. Package
twice and compare bytes and the unchanged kit dossier library before handover.
