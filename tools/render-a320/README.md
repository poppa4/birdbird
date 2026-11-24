# The A320 flight deck picture

`img/cockpits/a320-deck-3000.webp` and `a320-deck-1500.webp` are rendered from the 3D flight deck of the
**FlightGear A320-family** aircraft: https://github.com/legoboyvdlp/A320-family
Copyright (c) 2025 Josh Davidson, Jonathan Redpath, merspieler, Matthew Maring, Thorsten Herrmann, Semir Gebran.
Licensed under the GNU General Public License, version 2 (see `COPYING` in that repository,
https://www.gnu.org/licenses/old-licenses/gpl-2.0.html).

The two pictures are derived works of that model and are distributed under GPL-2.0 as well, without warranty.
The model is the source; these scripts are everything else needed to make the pictures again. What the displays
(PFD, ND, ECAM, MCDU, ISIS) show is NORDAP's own drawing (`screens.py`), as the model's screens are painted by the
simulator at run time and are blank in the files.

Configuration rendered: A320neo, CFM engines, no head-up display.

## Steps

Needs Python 3 with `bpy` (Blender as a module), `numpy`, `Pillow`, `playwright` and Chrome. Paths in the scripts point at
`/home/claude/fg/A320-family` (a checkout of the model, `Models/FlightDeck`) and `/home/claude/rend` (work folder).

1. `python3 build.py` reads `Models/FlightDeck/res/fd_complete.ac` (`ac3d.py`) and writes `fd.blend`.
2. Render each view square-on with an orthographic camera at 3000 px per metre (`tile.py`, which calls `render.py`):
   - overhead: `tile.py ovh 0.385 1.10 0 -0.362 0.932 0 0.932 0.362 0 0.66 1.30 3000 24 0.4 0.6 1 3 0 R` for R = 0, 1, 2
   - glareshield and main panel: `tile.py front -0.478 0.229 0 -0.955 -0.297 0 0 1 0 1.64 0.54 3000 24 0.4 0.6 3 1 C 0` for C = 0, 1, 2
   - pedestal: `tile.py ped -0.02289 -0.07831 0 -0.13 -0.99 0 -1 0 0 0.58 0.886 3000 24 0.30 0.5 1 2 0 R` for R = 0, 1
   - side consoles: `render.py -- sideL -0.22 0.08 0.95 0 -0.62 0.78 -1 0 0 0.44 0.40 1320 24 0.22 0.6`, and `sideR` with z negated
3. `python3 screens.py && python3 shots.py` draws the display contents.
4. `python3 compose.py` puts the views on one sheet and writes the two webp files.
5. `python3 snap.py` computes the rectangle of every named control from the model's geometry (`map.py` projects model
   points to sheet pixels) and writes `a320_targets.json`, which becomes `A320_T` in `flowsac.js` (sheet pixels / 4.92).

## The 3D cockpit shell (a320-3d.html)

`python3 shell.py <A320-family>/Models/FlightDeck/res ../../models` writes `models/a320-shell.bin` and the
`models/a320-shell-*.jpg` textures from the same model: everything that is not on one of the rendered panel planes (glareshield,
windshield and window frames, walls, consoles, sidesticks, tillers, seats, floor), without glass, sun blinds, HUD, EFBs and
details under about 6 cm². A derived work of the model, GPL-2.0 as well.

## Front page picture

`img/front/a320-day-*.webp` (front page laptop, Training hub) is a Cycles render of the same `fd.blend` from the centre of the
flight deck, with NORDAP's display drawings (`scr/*.png`) as emissive screens, the DCDUs and MCDUs lit, glass hidden, a clear blue sky and warm panel flood:
`python dcdu.py` (DCDU display), then `python dusk.py -- 2000 32 out.png 1.05 0.60 0 -0.55 0.30 0 32` (camera x y z, target x y z, lens mm), then cropped to 16:10.
A derived work of the model, GPL-2.0 as well.

## Proud parts and steps (2026-11-24)

`depth.py` now leaves the small parts that stand proud of a panel face (rotary knobs, selectors, toggle switches, guards; listed in
`proud.json`) out of the height fields: a height field turned each into a cone with the panel picture smeared down its sides. The
face under them stays flat with the part's picture on it, and the page draws its own knob and switch geometry there. Rays that
miss the model take the nearest hit's height, so the picture's own outline cuts the top of the glareshield. In `a320-3d.js` a
grid cell that spans a step of more than 16 mm is drawn flat with walls to its neighbours instead of as a slanted face.
`shell.py` keeps the sidesticks and tillers whole, keeps faces that the panel pictures see edge-on, and paints out a white mask
picture in `fd_other.png` that the pedestal's side wall is mapped to.

## Panels as real geometry (2026-11-24)

The height-field surface (`depth.py`, `models/a320-relief.bin`) is gone: a grid of heights cannot hold an edge, so every corner,
lip and joint came out as steps. `panels.py` writes the model's own faces instead, with the panel pictures projected back onto
them (`models/a320-panels.bin`, about 25 000 triangles for the three panels where the grid needed 460 000), and `taken.json`,
the list of faces it took. `shell.py` leaves out exactly those faces, so each face of the model is drawn once: by the panels
(picture) or by the shell (the model's texture). Order: `python3 panels.py <res> ../../models`, then
`python3 shell.py <res> ../../models`. The heights in the same file are only for placing the screens and levers and for clicks.
The page keeps a plain dark tub below the window sills and a lining-coloured roof behind everything, so a gap in the model
never shows the ground or the sky.

## Clean materials for the structure (2026-11-24)

The FlightGear textures (2048 px atlases with painted wear, marks, lettering and grain) looked blurred, chipped and blotchy at
cockpit distance. `shell.py` no longer ships them: each face gets the median colour of its texture area, those colours fall
into a few materials (five paints, seat fabric, carpet, glareshield leather), small islands of a second material are removed,
and the material colour times the baked light is written per vertex (`models/a320-shell.bin`, one draw call, no textures).
The sun patches are gone from the bake (per-vertex shadows read as dents); a soft key from the windshield gives the form.
