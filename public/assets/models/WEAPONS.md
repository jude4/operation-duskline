# Original weapon viewmodels

`vxr7.glb` contains the fictional **VXR–7** rifle, **Kestrel** sidearm and operator glove/jacket meshes. These original models were authored for Operation Duskline using Blender, via `scripts/create-weapon.py`. They contain no third-party designs, textures, audio or downloaded assets. They are supplied under the same project licence as this source code; no external attribution is required.

The firearm shapes use authored, bevelled profiles, separate metal/polymer/rubber PBR surfaces, detailed optics, hardware, rails and vented handguards. Hands contain glove palms, individual fingers, reinforcement and jacket sleeves. A glTF bolt animation is included. Static pieces are merged by material; the full asset uses 26 mesh batches, with only one weapon assembly displayed at a time. The GLB is uncompressed because Blender's bundled Draco library is unavailable; no external decoder is required.

Rebuild with Blender 4.3 or later:

```sh
blender -b --python scripts/create-weapon.py
```

The controller adds procedural ADS, weapon bob, sprint, reload, inspection and switching transitions. Pooled camera-space muzzle flashes, smoke and shell casings provide immediate presentation feedback. The game engine owns ammunition and hit detection.
