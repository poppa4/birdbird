# Rendered cockpits

The cockpit pictures `img/cockpits/<aircraft>-deck-*.webp` are rendered from free 3D aircraft models. Each picture is a derived
work of its model and is distributed under the model's licence, without warranty. The models are the source; these scripts are
everything else needed to make the pictures again. What the displays show is NORDAP's own drawing.

| Aircraft | Model | Licence |
|---|---|---|
| Airbus A320 | FlightGear A320-family, https://github.com/legoboyvdlp/A320-family (see ../render-a320) | GPL-2.0 |
| Cessna 172 | FlightGear Cessna 172P, https://github.com/c172p-team/c172p | GPL-2.0 |
| Diamond DA42 | FlightGear Diamond DA42, https://github.com/FGMEMBERS/Diamond-DA42 | GPL-2.0 |
| Boeing 737-800 | FlightGear 737-800YV, https://github.com/FGMEMBERS/737-800YV | GPL-2.0 |
| Beechcraft King Air | FlightGear Beechcraft Super King Air, https://github.com/FGMEMBERS/Beechcraft-King-Air | GPL-2.0 |
| Airbus A350-900 | FlightGear A350 XWB, https://github.com/FGMEMBERS/A350XWB (overhead: own drawing, a359/ovh.py) | GPL-2.0 |
| Boeing 737 MAX 8 | FlightGear 737 MAX, https://github.com/REXO-77/737-MAX | GPL-2.0 |
| Boeing 787-8 | FlightGear 787 family, https://github.com/IskenderWang/787-family | GPL-2.0 |
| Diamond DA40 NG | FlightGear DA40 NG, https://github.com/sryu1/DA40 (G1000 bezels: FGData) | GPL-2.0 |
| Piper PA-34 Seneca II | FlightGear SenecaII, https://github.com/FGMEMBERS/SenecaII (shared instruments: FGData) | GPL-2.0 |
| Piper PA-28 Warrior | FlightGear PA28 Warrior, https://github.com/FGMEMBERS/PA28-Warrior | GPL-2.0 |
| Embraer E190 | FlightGear E-Jet family, https://github.com/YV3399/E-jet-family-YV | GPL-2.0 |
| ATR 72-500 | FlightGear ATR 72-500 (ATR 72-500/C project), https://github.com/FGMEMBERS/ATR72 | GPL-3.0 |

Steps for one aircraft (folder `<a>` with `cfg.py`, `spec.py`, `render.sh`):

1. `python3 build2.py <a>/cfg.py` follows the model's XML files (`fgmodel.py`), places every .ac file (`ac3d.py`) and writes a .blend.
2. `<a>/render.sh` renders each view square-on with an orthographic camera (`tile.py`, `render.py`).
3. `python3 screens_g1000.py && python3 screens_boeing.py && python3 shots.py` draws display contents where the model has blank screens.
4. `python3 make.py <a>` stitches the views (`sheet.py`), computes the rectangle of every named control from the model's
   geometry and writes the webp files; `python3 integrate.py <a>` puts the table into `flowsac.js`.

Needs Python 3 with `bpy`, `numpy`, `Pillow`, `lxml`, `playwright` and Chrome. Paths in the scripts point at a work folder.
