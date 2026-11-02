# Validation

Validated on 2 November 2026 with Node 24.19.0 and Chromium 154.0.8037.57 in the cloud environment. Browser automation used software WebGL; these results establish functionality, not hardware GPU frame-rate targets.

## Passed checks

- **Clean installation:** `npm ci --no-audit --no-fund` completed from the lockfile.
- **Production build:** `npm run build` passed TypeScript and Vite bundling. Local models, sounds, fonts and licence notices are included in `dist/`.
- **Unit/system tests:** `npm test` passed **21 tests**: mission ordering/reset/idempotence; actual Rapier grounding, speed modes, wall collisions, jumping, crouch clearance and crate impulses; enemy detection, wall occlusion, damage/defeat/reset; interaction range, visibility ancestry, occlusion and activation.
- **Desktop browser mission:** start screen and settings, pointer lock, keyboard walking/crouching/jumping, locked-door collision, pause freezing time and enemy transforms, access-card collection, door opening/traversal, ADS, firing, ammunition, reload accounting, sidearm switching, raycast defeat of a drone, control-room data recovery, exit door, extraction, replay and reset all passed.
- **Interactive props:** auxiliary lights toggled off/on; field storage granted ammunition once; an equipment crate moved under a genuine interaction impulse; selected glass broke after raycast firing.
- **Touch browser:** coarse-pointer layout, real emulated touch joystick movement, look dragging, held firing, crouch toggle and pause passed without requiring pointer lock.
- **Final perimeter/resupply test:** both added side fences blocked actual keyboard movement. The yard stopped at `z=-9.5048`; reverse extraction travel stopped at `z=-78.4950`. Ammunition increased from 150 to 210 reserve; medical supplies restored 55 health to 100.
- **Audio runtime:** all 18 local WAV assets decoded; two ambience loops were created and the AudioContext ran after user-gesture startup. Automated playback used zero master volume.
- **Restart resource check:** Three.js geometry/texture counts stayed at 261/28 before and after the tested mission reset. This is a bounded regression check, not a long-session memory profile.
- **Production browser smoke:** the live rendered menu, Low/Medium/High selection, mission startup, pointer lock, pause and packaged asset requests passed with no page or HTTP errors. Development diagnostics were absent from the production page even with `?test=1`.

All three Playwright cases passed. Desktop and touch ran together; the perimeter/resupply case ran after the final fence additions. The development-only diagnostics position the player between independent checks; actual movement, collisions, E interactions, firing and mission transitions execute through the engine.

## Reproduce

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Playwright starts or reuses the Vite server. Its default Chromium executable is `/usr/bin/chromium`; override `CHROMIUM_PATH` if needed. Software rendering is substantially slower than hardware acceleration, and browser test timeouts accommodate it.

For the additional production smoke test, first run `npm run preview -- --port 4173`, then run `node scripts/verify-production.mjs` in another terminal. Screenshots are saved in the ignored `artifacts/` directory.

Physical mobile devices, physical gamepads, long-session memory use and hardware GPU performance were not tested. Optional VR is not implemented. Other rendering and asset limitations are documented in README.md.
