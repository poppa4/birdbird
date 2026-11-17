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
