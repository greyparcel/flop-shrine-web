# FLOP Shrine — Blender study 01

Created 2026-09-09 with Blender 5.2.1 LTS. Local visual prototype; not a published site or working wish-selection UI.

Generated `.blend` scenes and study PNGs are deliberately excluded from Git. Keep them locally or in private storage. This repository includes the generators; the website uses the exported `public/models/honden-01.glb`. The following scene and image files can be generated locally and are not included in a fresh clone.

- `shrine-study-01.blend`: editable torii, ema racks, plaques, paving, lights, orthographic camera and compositor.
- `shrine-study-01.png`: 1600 × 1200 render.
- `build_shrine.py`: reproducible scene generator. Run in a separate Blender background process; it clears that process's initial scene.

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python './art/build_shrine.py'
```

The palette now follows the user-specified brand color `#00b4d8`, shared through `../public/theme.json` and `brand_palette.py`. Both generators and their saved Blender scenes have been recolored. Two illuminated plaques in the initial study represent the two recorded wishes; inscription strokes are visual placeholders, not their actual text. Other plaques are empty scenery. Ema display remains outside the current website prototype.

The scene is built with Blender geometry and Python API, with Cycles rendering, compositor glow and a packed scanline texture. No external model, font or image assets were downloaded. The render and model contain no signing keys. Rendering does not post to Technocore.
