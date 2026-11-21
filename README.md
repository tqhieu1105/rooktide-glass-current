# Rooktide: Glass Current

[![make.fun competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Repository rank](https://make.fun/badge/gta6-01/tqhieu1105/rooktide-glass-current/rank.svg)](https://make.fun/c/gta6-01)
[![Repository reward](https://make.fun/badge/gta6-01/tqhieu1105/rooktide-glass-current/reward.svg)](https://make.fun/c/gta6-01)

An original coastal crime game built as a static, offline-capable Three.js
WebGL world. The waterfront, landmarks, and street population use procedural 3D geometry.
Rooktide is set at golden hour, with amber haze, teal water, and neon signs.

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

## Street play and Rooktide Civic Patrol

The six districts share one road graph and one continuous city. Neri can walk,
sprint, take an available car, drive across Glasshook Bridge, and leave a car
in place for later. Civilian drivers yield at junctions and crossings, while
people walk the sidewalks and scramble away from fast cars. Free roam includes
five vehicle types, arcade drifting, bouncy collisions, and cartoon sparks.

Steal a car in view of a witness and RCP dispatch sends a patrol. Further
incidents raise heat and can bring ramming patrols, a helicopter, and roadblocks
with a gap. Break line of sight and stay clear until the pulsing stars go dark.
The minimap shows the last place RCP saw you, and dispatch lists the nearest
units and their distances. Hold Space while stopped near a patrol to surrender.
Ilex offers roadside help if you get busted.

Repeated city geometry and civilian models are grouped into instanced draws.
One local atlas supplies the facade, asphalt, sidewalk, sand, and water textures.
The high preset uses one 512×512 sun shadow map. On a 1280×720 viewport the
software preset draws the city at 576×324, with the HUD at viewport resolution.
Use the pause menu to switch presets.

## Undertow Relay campaign

Walk to the amber marker beside the Kiln Market plaza and press **E** to talk to
Ilex. You can explore first. Each job has four stages. Follow the mint route on
the minimap, or press **M** for a wider view. Watch the stage card for the next
stop, guard count, or time remaining. If a job fails, retry from its checkpoint
or head to Ilex Auto. You can also abandon a job from the pause menu.

| Job | What you do | Reward |
| --- | --- | ---: |
| Borrowed Voltage | Take a marked compact and lose a one-star patrol. | $700 / 100 RP |
| The Quiet Ledger | Clear the quay guards, collect the case and lose two stars. | $1,100 / 150 RP |
| Split Invoice | Disable a moving courier, take the fragment, and reach Sava’s drop. | $1,400 / 200 RP |
| Seawall Dividend | Hit two seawall checkpoints under helicopter pursuit. | $1,800 / 250 RP |
| Dead Channel | Hold the mast upload zone and get the uplink to Glasshook. | $2,200 / 300 RP |
| Glass Current | Take the broadcast key through a bridge blockade and stop at two relays. | $3,000 / 400 RP |

The routes, fights and pursuits are designed for roughly 25–35 minutes on a
first run. The first job unlocks paid bodywork at Ilex Auto. The second unlocks
Sava’s patrol scan and a pistol for use in mission encounters. Cash and
completed jobs save locally on the same browser. Once the broadcast goes out,
the pause menu lets you replay any job. Each first completion pays once.

The browser captures show the playable three-star **Seawall Dividend** chase,
Kiln Market on foot, and the Glasshook Bridge approach. See `CHECKPOINT-6.md`
for the campaign, driving, capture comparison and package checks.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot; accelerate, brake/reverse and steer in the car |
| Shift | Sprint on foot |
| E | Talk, collect, repair, or enter or exit a car at low speed |
| F / 1 / 2 | Attack on foot in a mission encounter, select fists or the unlocked pistol |
| Q | Sava’s patrol scan after The Quiet Ledger |
| Space | Handbrake while driving, or hold while stopped to surrender near RCP |
| Mouse drag | Orbit the camera without pointer lock |
| C / mouse wheel | Cycle camera preset / adjust distance |
| M | Expand / close the city map |
| R | Roadside recovery or open the mission retry menu |
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
node tools/population-check.mjs
node tools/police-check.mjs
node tools/mission-check.mjs
node tools/timing-probe.mjs
node tools/capture-shots.mjs --base http://127.0.0.1:8080 --quality 84
node tools/verify-package.mjs
```

The tools use installed `/usr/bin/chromium` through Node's built-in WebSocket
and the Chrome DevTools Protocol. They install no packages. Captures use the
ordinary high-quality setting, freeze the real simulation at tick 91, and
resume with normal controls. No image is painted over or enhanced afterward.

The project is MIT licensed. Anton, Barlow, and Barlow Condensed are shipped as
Latin WOFF2 subsets alongside their SIL Open Font Licenses in `game/vendor/fonts/`. `game/vendor/three.module.min.js` is unmodified
third-party Three.js r160, not authored project code; its MIT license and
copyright notice are included. `vendor/makefun-game.ts` remains the unchanged
competition kit library.
