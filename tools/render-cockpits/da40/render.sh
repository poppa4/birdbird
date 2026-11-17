#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/da40/da40.blend OUT=/home/claude/rend/da40/out WORLD=0.2 KEY=160; mkdir -p $OUT
V="main -2.19 0.38 0 -1 0 0 0 1 0 1.1 0.46 2800 24 0.4 0.4 2 1"
for rc in "0 0" "1 0"; do python3 tile.py $V $rc; done
python3 tile.py ped -1.88 0.15 0 0 -1 0 -1 0 0 0.2 0.6 2800 24 0.3 0.3 1 1 0 0
echo ALLDONE
