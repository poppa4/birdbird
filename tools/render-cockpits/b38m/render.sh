#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/b38m/b38m.blend OUT=/home/claude/rend/b38m/out WORLD=0.12 KEY=130; mkdir -p $OUT
V="main -0.7 -0.08 0 -1 0 0 0 1 0 1.56 0.68 2800 24 0.45 0.5 3 1"
for rc in "0 0" "1 0" "2 0"; do python3 tile.py $V $rc; done
export KEY=240
V="ovh 0.015 0.7 0 -0.410 0.912 0 0.912 0.410 0 0.74 1.12 2800 24 0.35 0.3 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
export KEY=200
V="ped -0.2 -0.35 0 0 -1 0 -1 0 0 0.6 1.15 2800 24 0.4 0.3 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
echo ALLDONE
