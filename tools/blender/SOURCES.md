# 3D cockpit models: build scripts and sources

Generic training cockpits drawn from scratch by script. No manufacturer drawings, images, logos, brand names or
registrations are used or shown. Shapes are approximations from the public overall dimensions below and from the
panel drawings already on the site.

## Build

```
pip install --break-system-packages bpy          # Blender 5.x as a Python module
npm i --prefix /tmp/dl/gp gltfpack@0.21          # meshopt compression (or set GLTFPACK=/path/to/gltfpack)
python3 tools/blender/textures.py /tmp/blender3d/tex 512          # tiling detail maps (fabric, leather, carpet, plastic, metal, headliner)
python3 tools/blender/c172.py  models  [--no-render]              # → models/c172-cockpit.glb + .json, /tmp/gltfshots/c172-left-seat.png
python3 tools/blender/b200.py  models  [--no-render]
python3 tools/blender/da42.py  models  [--no-render]
python3 tools/blender/check_glb.py c172 b200 da42                  # loads each .glb in models/test.html (three r128), headless
```

Environment: `COCKPIT_TEX` (texture dir, default /tmp/blender3d/tex), `COCKPIT_SHOTS` (preview dir, default
/tmp/gltfshots), `AO_SAMPLES` (AO bake samples, default 48), `PREVIEW_SAMPLES` (Cycles preview, default 40),
`PANEL_IMG_C172|B200|DA42` (a picture of the whole panel drawing, only used to dress the preview render).

- `cocklib.py`: modelling kit (parametric sheets, rounded boxes with deformers, swept tubes, lathes, prisms),
  PBR materials, box-projected UV0 for the detail maps, shared UV1 atlas + Cycles AO bake, glTF export, gltfpack, preview.
- `parts.py`: crew seats, control wheels, rudder pedals, sub-panel planes (identical maths to cockpit3d.js `subs`).
- `c172.py`, `b200.py`, `da42.py`: one cockpit each. `textures.py`: procedural tiling maps (numpy).

## Frame and placement

Same frame as `cockpit3d.js`: metres, x right, y up, z aft (forward −z), origin on the centre line at the cabin
reference height. glTF is +Y up, so the file loads straight into that frame. The eye points, the panel plane and every
sub-panel plane are copied from `c172-3d.js`, `b200-3d.js` and `da42-3d.js` (so the live DOM panel can still be overlaid
exactly, or the `*_face` meshes can carry the panel as a texture).

## Public dimensions used

| Aircraft | Used | Source |
|---|---|---|
| C172 | cabin width 3 ft 4 in (≈1.0 m) at the front seats; wingspan 36 ft 1 in; length 27 ft 2 in | AOPA aircraft fact sheet, Cessna 172 (aopa.org/go-fly/aircraft-and-ownership/aircraft-fact-sheets/cessna-172) |
| C172 | wing section NACA 2412, dihedral ≈1.7°, strut-braced high wing, one-piece windshield, door + rear side windows | Wikipedia "Cessna 172" (general description) |
| B200 | cabin width 54 in (1.37 m), cabin height 57 in (1.45 m) (same fuselage cross-section across the 200 series) | Textron Aviation King Air 260 specifications page (beechcraft.txtav.com/king-air-260); Epic Flight Academy King Air B200 page (cabin width 54 in, span 54 ft 6 in, length 43 ft 10 in) |
| B200 | two-piece windshield with centre post, power / propeller / condition levers on the pedestal (black / blue / red knobs), wheel-shaped gear handle, fuel panel on the left sidewall console, circuit breakers on the right | Wikipedia "Beechcraft Super King Air" (general description); the site's own b200panel.js layout |
| DA42 | cabin width ≈1.20 m, cabin height ≈1.20 m, cabin length ≈2.6 m; span 14.55 m, length 9.19 m | aerocorner.com "Diamond DA42 Twin Star"; Diamond Aircraft DA42 tech specs page (diamondaircraft.com) |
| DA42 | one-piece forward-hinged canopy with a roll-over bow, centre sticks, engine-control console below the panel centre | Wikipedia "Diamond DA42" (general description); the site's own da42panel.js layout |

Control travels in the JSON sidecars (wheel rotation ±45°, column ±7.5–8 cm, pedals ±16°, sticks)
are generic training-device values, not certified figures; the app may tune them.
