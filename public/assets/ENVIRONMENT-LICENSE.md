# Blacksite 07 environment

All environment meshes were designed and modelled specifically for Operation Duskline using Blender 4.3.2. No downloaded assets, external images, trademarked designs, or third-party model licences are required.

Rebuild the binary asset with `blender -b -t 2 --python scripts/create-environment.py` from the repository root. Runtime concrete, metal-grain, signage, and weather textures are deterministically generated locally with Canvas and stored entirely in browser memory; no remote assets are fetched.

The environment contains an original utility truck, forklift, corrugated shipping containers, reinforced cargo crates, rack shelving, steel column/truss architecture, industrial pipework, server cabinets, workstations, lighting fixtures, and perimeter security fencing. Blender-authored geometry is joined by material and mission zone to control draw calls. Collision uses low-cost Rapier hulls supplied separately by the environment module.

Limitations: textures are compact procedural weathering rather than scanned photographic maps; puddles use a reflective PBR approximation rather than screen-space reflections, and the fog is a performance-conscious depth fog rather than raymarched volumetric simulation. No external model compression decoder is needed for the local binary.
