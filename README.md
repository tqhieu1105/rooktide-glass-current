# Rooktide: Glass Current

[![make.fun competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Repository rank](https://make.fun/badge/gta6-01/tqhieu1105/rooktide-glass-current/rank.svg)](https://make.fun/c/gta6-01)
[![Repository reward](https://make.fun/badge/gta6-01/tqhieu1105/rooktide-glass-current/reward.svg)](https://make.fun/c/gta6-01)

An original coastal crime game built as a static, offline-capable Three.js
WebGL world. The city, courier, coupe and landmarks are procedural 3D
geometry. The main art direction is Saltglass Afternoon: cream towers,
terracotta arcades, amber sunlight and teal water.

## Premise and crew

Courier **Neri Voss** discovers the Glass Current ledger in a stolen municipal
survey vehicle. It connects waterfront redevelopment money to staged
evacuations. The **Undertow Relay** crew plans to collect the remaining
records and broadcast them before the seawall closes. Mechanic **Ilex Renn**,
lookout **Sava Pell**, and analyst **Daro Venn** help Neri evade Captain
**Tessa Korr** and the **Rooktide Civic Patrol**. Developer **Merek Senn**
wants the evidence buried.

## Explore Rooktide

- **Saffron Strand:** palm boulevard, finned hotels, beach and seawall.
- **Kiln Market:** ceramic arcades, striped awnings and a public plaza.
- **Relay Quay:** warehouses, containers, cranes and a working pier.
- **Cinderbank:** repair yards, apartments and an open workshop canopy.
- **Switchback Heights:** apartments, a water tower and a radio mast.
- **Glasshook:** a service island reached by bridge, crowned by a broken-ring
  floodgate gantry.

## Milestone 1 — city, walking and driving

The continuous six-district city now runs in Chromium with a genuine Three.js
r160 WebGL2 perspective renderer. It has 30 primary blocks, 172 buildings,
216 palms, beach and sea, a connected Glasshook bridge, and district landmarks.
Neri can walk, sprint, enter the same **Driftline GT**, drive, brake, handbrake,
collide, exit safely, and continue on foot. The HUD and minimap follow the
shared fixed-step simulation. This is a playable prototype, not the finished
campaign.

Browser verification covers a fresh boot, keyboard controls, safe entry/exit,
pause, camera and map controls, recovery, and a 60-second drive. A deterministic
4.42 km controller route reaches every district without recovery teleports.
A separate real-keyboard Chromium drive completed the 4.43 km loop through
all six districts in 292 seconds, including the connected island bridge.
See `verification/README.md`, `verification/smoke.json`, and the three genuine
browser captures in `screenshots/` for evidence. `shots.json` describes these
milestone views; it makes no claim of a police pursuit or story mission.

Repeated geometry is spatially instanced; road paint uses flat surfaces.
Hardware renderers default to high quality. Software renderers default to
960×540 internal 3D resolution with a sharp HTML HUD and inexpensive contact
shadows; the pause menu can switch to high quality. The recorded software
renderer frame times are documented in the verification report.

Story missions, traffic, pedestrians, responding police, combat, progression,
save data and synthesized radio are later milestones. The archived six-job
story and tuning are reference data for the rebuild; this milestone does
not present those systems as completed gameplay.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot; accelerate, brake/reverse and steer in the car |
| Shift | Sprint on foot |
| E | Enter the nearby car; exit once safely stopped |
| Space | Handbrake while driving |
| Mouse drag | Orbit the camera without pointer lock |
| C / mouse wheel | Cycle camera preset / adjust distance |
| M | Expand / close the city map |
| R | Roadside recovery |
| Escape | Pause / resume |

## Run and package

Use Node.js 22.18 or later. From the repository root:

```sh
node serve.ts
```

Open `http://127.0.0.1:8080` in desktop Chromium/Chrome. ESM files need a
static HTTP server. Every game dependency is served from `game/`; external
network access is unnecessary while playing.

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

The packaging program copies `game/` and the genuine browser captures in
`screenshots/`, then writes the exact dossier returned by the unchanged
kit library in `vendor/makefun-game.ts`. Development evidence and tools
are outside the packaged game. This is a milestone build, not a submission.

To reproduce development checks and the three 1280×720 JPEG captures while
the server is running:

```sh
node tools/simulation-checks.mjs
node tools/smoke.mjs
node tools/drive-loop.mjs
node tools/capture-shots.mjs --base http://127.0.0.1:8080 --quality 84
node tools/verify-package.mjs
```

The tools use installed `/usr/bin/chromium` through Node's built-in WebSocket
and the Chrome DevTools Protocol. They install no packages. Captures use the
ordinary high-quality setting, freeze the real simulation at tick 91, and
resume with normal controls. No image is painted over or enhanced afterward.

The project is MIT licensed. `game/vendor/three.module.min.js` is unmodified
third-party Three.js r160, not authored project code; its MIT license and
copyright notice are included. `vendor/makefun-game.ts` remains the unchanged
competition kit library.
