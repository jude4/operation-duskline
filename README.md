# OPERATION: DUSKLINE

An original, single-player, real-time browser FPS. Infiltrate **Blacksite 07**, recover a classified data module, and reach extraction. The loading yard, warehouse, service corridor, research control room, and extraction yard are one continuous 3D level.

## Run locally

Requires Node.js **22.12+** (validated with Node 24) and a modern WebGL2 browser. No API keys, database, backend, or external asset service is needed.

```sh
npm ci
npm run dev
```

Open the development server in Chrome, Edge, Firefox, or Safari on a capable desktop. Click **Start Mission** to allow mouse capture and sound. Press **Escape** or **P** to pause and release the pointer. Pointer lock requires a secure origin (HTTPS or localhost); embedded browser frames must permit pointer lock. All models, fonts, and sounds are served from `public/`.

```sh
npm run build       # TypeScript + production bundle in dist/
npm run preview     # serve the production build
npm test            # mission, enemy AI and real Rapier physics tests
npm run test:e2e    # Chromium integration test; starts/reuses the dev server
```

The browser tests default to `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installed Chromium executable. If needed, install Playwright Chromium using `npx playwright install chromium` and set its executable path. Tests use the development-only `?test=1` diagnostics to position the player between checks; interactions, raycast hits, keyboard movement, pointer lock, collisions and mission progression still run through the real engine. The diagnostics are excluded from production builds.

See [TESTING.md](TESTING.md) for executed checks, results and device limitations.

## Mission walkthrough

1. Walk into the loading yard. Turn left toward the marked **ACCESS CREDENTIALS** in the alley between the western containers. Approach, look at the card, and press **E**.
2. Approach the large **07 / ACCESS CONTROL** warehouse door, look at it and press **E**. Enter the warehouse; security drones can detect and engage you. Use the shelves as cover.
3. Continue north through the warehouse and service corridor. Open the research door with **E**. A medical pickup and auxiliary lighting switch are in the corridor.
4. In the control room, approach the glowing research terminal on the right, look at it, and press **E** to recover the data module.
5. Open the northern service exit and enter the illuminated extraction circle. The mission ends with a results screen; **Replay Operation** resets it.

Optional resupply is available near the warehouse's western crates and in the eastern field-storage chest. Selected equipment crates can be pushed physically or with **E**. A control-room glass partition can be broken by shooting. Security units are non-human fictional drones; there is no gore.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Shift | Sprint while moving forward |
| Ctrl / C | Crouch (hold) |
| Space | Jump |
| Left mouse | Fire |
| Right mouse | Aim down sights (hold) |
| R | Reload |
| E | Interact with the object in your sights |
| F | Inspect weapon |
| 1 / 2 | VXR–7 rifle / Kestrel sidearm |
| L | Toggle weapon light |
| Escape / P | Pause |

Touch devices have a left movement joystick, right-side look surface, and shoot/aim/interact/reload/jump/crouch buttons. Landscape is recommended. Basic standard-mapped gamepads support sticks, triggers, A jump, X reload and Y interact; keyboard/mouse is the primary tested input. Mouse sensitivity, sound levels, graphics quality, FOV, camera motion and crosshair preferences persist in local storage.

## Implementation

- **Vite, React, TypeScript:** React owns menus/HUD; the game engine runs independently of React's render loop and publishes HUD snapshots at 10 Hz.
- **Three.js / WebGL:** PBR materials, local GLB loading with `GLTFLoader`, environment reflections, controlled shadows, procedural texture maps, rain, fog, flicker, particles, animated ventilation and muzzle effects. Two-pass viewmodel rendering keeps the weapon internally depth-correct and prevents walls clipping through it.
- **Rapier:** fixed 60 Hz stepping, capsule-based kinematic character controller, gravity, grounded jumping, slope/stair support, crouch clearance, static collision hulls, rotating kinematic doors, and dynamic equipment crates.
- **Gameplay:** reusable occlusion-aware interaction raycasts, two independent weapon magazines, reload timing, ADS, hit registration, pooled impact marks/sparks, five six-state line-of-sight drone opponents, health, gated objectives, extraction and complete restart.
- **Animation:** Blender bolt clip via `AnimationMixer`, procedural weapon reload/inspection/sway/recoil, camera movement and GSAP interface transitions.
- **Audio:** 18 original local WAVs, Web Audio distance attenuation, indoor/outdoor ambience crossfade, surface footsteps, gain controls and pause/resume.

`src/game/engine/GameEngine.ts` coordinates the scene. Separate systems live under `environment/`, `physics/`, `missions/`, `weapons/`, `enemies/`, `audio/` and `effects/`. `src/App.tsx` and `src/styles/` contain the interface. `src/types.ts` is the engine/UI contract.

## Original assets and licensing

The environment and first-person rifle, sidearm, gloves and sleeves were modelled in Blender specifically for this project. The binary assets are checked in; Blender is **not** needed to play or build the application. Security drones and interactive props use original detailed runtime geometry. Sounds are generated original fictional effects, with no third-party samples.

Regenerate original assets from the repository root (Blender 4.3+, Python 3):

```sh
blender -b -t 2 --python scripts/create-environment.py
blender -b -t 2 --python scripts/create-weapon.py
python3 scripts/create-audio.py
```

Asset provenance and technical limitations are recorded in `public/assets/ENVIRONMENT-LICENSE.md`, the weapon documentation under `public/assets/models/`, and `public/assets/audio/README.md`. Locally bundled Barlow and Barlow Condensed fonts use the SIL Open Font License 1.1, retained in `public/assets/fonts/Barlow-OFL.txt` and `public/assets/fonts/BarlowCondensed-OFL.txt`. Runtime library notices are retained in `public/THIRD-PARTY-NOTICES.txt`. No external asset URL is used at runtime. No proprietary game assets or branding are included.

## Performance and scope

This is a compact playable vertical slice with a deliberately stylised industrial aesthetic, rather than scanned photorealistic scenery. The environment is batched by zone/material (~69k triangles, ~4 MB GLB); both original viewmodels share a ~1 MB GLB. Physics hulls are much simpler than display geometry. Rain and impacts use bounded buffers/pools. Draw distance, shadow cost and pixel ratio are controlled; **Low** disables shadows and caps pixel ratio at 1, **Medium** caps at 1.25, and **High** caps at 1.65. The heavy engine loads separately so the loading interface can appear first.

Prefer a hardware-accelerated desktop browser. Headless software WebGL is used for functional validation, not a claim of measured performance on a gaming GPU. Geometry and textures are disposed on teardown, and repeated mission resets reuse scene resources. Puddles approximate reflections using local environment lighting; fog is depth fog, not raymarched volumetrics. No VR/WebXR, multiplayer, advanced pathfinding, scanned textures, Draco/KTX compression or screen-space ambient occlusion is included. The small local GLBs do not require a decoder download. The opponent drones use bounded room patrols rather than full navigation meshes. Synthesised audio is intentionally stylised. Real mobile hardware and physical gamepad compatibility require device testing.

## Deploy

The production application is static. Upload **all of `dist/`**, including `assets/models`, `assets/audio`, and `assets/fonts`, to an HTTPS host. Vite copies the local public assets into the build; never deploy the source directory by itself. No environment variables are required.

- **Vercel:** import this repository, use the Vite preset, build with `npm run build`, publish `dist`. `vercel.json` is included.
- **Netlify:** import the repository; `netlify.toml` specifies the same build and publish directory.
- For a subdirectory deployment, set Vite's `base` to the deployment prefix before building; runtime model/audio URLs respect `import.meta.env.BASE_URL`.

Use HTTPS, leave WebAssembly/WebGL enabled, and do not add headers that disable pointer lock. Deployment preparation does not publish the app or create a live hosted service.
