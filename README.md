# Rooktide: Glass Current

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/tqhieu1105/rooktide-glass-current/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/tqhieu1105/rooktide-glass-current/reward.svg)](https://make.fun/c/gta6-01)

Rooktide is an original coastal open-world crime game built for desktop browsers. Neri Voss, a courier who knows the city's service roads, steals a municipal survey car and uncovers the Glass Current ledger: proof that the Promenade Renewal Trust is arranging staged evacuations and private security contracts. Neri and the Undertow Relay crew must recover the remaining records and broadcast them before the next seawall closure, while the Rooktide Civic Patrol closes in.

## The City

The continuous city is made up of six districts, each connected by roads and local routes:

- **Saffron Strand**: beach boulevard, palms, hotels, and seawall stairs.
- **Kiln Market**: ceramic arcades, tiled plaza, and narrow foot alleys.
- **Relay Quay**: working harbour, warehouses, containers, cranes, and pier.
- **Cinderbank**: repair yards, bus depot, fuel canopy, and the crew safehouse.
- **Switchback Heights**: terrace roads, water tower, and a distant radio mast.
- **Glasshook**: a service island reached by bridge, marked by its angular floodgate gantry.

The city, vehicles, people, signs, sound, and story are original and generated for this game. It uses no commercial-game names, maps, characters, art, or music.

## Undertow Relay

Neri works with mechanic **Ilex Renn**, lookout and radio operator **Sava Pell**, and analyst **Daro Venn**. The crew's opponent is the Rooktide Civic Patrol (RCP), directed on the street by Captain Tessa Korr, while developer Merek Senn tries to bury the ledger. Missions move through the same free-roam city as the traffic and police pursuits.

The campaign follows six jobs, from borrowing a service car and recovering a quay ledger to broadcasting the records across Glasshook. Free roaming, car theft, police response, and the city are available from the start. Five original vehicle types share the same driving controls, and three original radio stations are synthesized in the browser.

## Controls

- **W / Up** accelerate; **S / Down** brake or reverse.
- **A / Left** and **D / Right** steer in a vehicle or move on foot.
- **E** enters or exits a vehicle and interacts with nearby mission objects.
- **Shift** sprints on foot; **Space** handbrakes in a vehicle or dodges on foot.
- **Mouse** orbits the camera; **C** cycles camera presets.
- **Left mouse** attacks; **right mouse** aims; **R** reloads.
- **1** selects fists; **2** selects the pistol; **Tab** changes radio station.
- **Escape** pauses. Use the on-screen menu to resume, retry, replay, or save.

## Systems

Drive or walk across the connected six-district map, use the shared road network, meet traffic and pedestrians, and steal or damage vehicles. Crimes raise a five-level wanted response with pursuing patrols, searches, roadblocks, and a helicopter. Story jobs use staged objectives and checkpoints; activities, combat, cash, crew services, rank, and the garage add rewards. The HUD shows the current objective, wanted response, dispatch, route minimap, vehicle condition or on-foot equipment, and crew dialogue. A versioned local save supports continue and checkpoint recovery. Engine, siren, effects, and the three radio loops are synthesized with Web Audio after play begins.

## Run

Serve `game/` as static files and open it in desktop Chrome. From the repository root, the development server can be started with:

```sh
node serve.ts
```

Then visit `http://localhost:8080`. The game uses only files under `game/` and can run offline after those files are available locally. To create the make.fun package with Node.js 22:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

The packager copies `game/` and the gameplay screenshots to `out/` and writes `dossier.json` using the unchanged make.fun kit library.
