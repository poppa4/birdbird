# NORDAP world data – ENTO Sandefjord Torp

Builds `world/ento/` for `world.js`. Run from a working folder (raw downloads are large and not kept in the repo).

1. `fetch.py near|mid|far` – heights from Kartverket (hoydedata.no ImageServer, NHM DTM/DOM, CC BY 4.0) in UTM33.
2. `resample.py near|mid|far` – into the local frame (origin THR 35, true north; `geo.py`).
3. `mapzen.py` – fills areas outside Norway in the far level (Mapzen Terrain Tiles).
4. `pack.py far mid near` – classes (water, forest, fields, rock, buildings) from the lidar surface model, colour maps, height PNGs.
5. `airport.py` – runway, lights and PAPI from AIP Norway AD 2 ENTO (AD 2.12, 2.14 and the aerodrome chart, vector PDF
   `633116.pdf`, georeferenced on the runway pavement ends), taxiway/apron distance field, buildings.

After changing anything in `world/ento/`, bump `DATA_V` in `world.js` and the `world.js?v=` on the pages that load it.
