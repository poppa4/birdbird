#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/a359/a359.blend OUT=/home/claude/rend/a359/out WORLD=0.14 KEY=150; mkdir -p $OUT
V="main 2.45 1.88 0 -1 0 0 0 1 0 2.2 0.8 2800 24 0.5 0.4 3 1"
for rc in "0 0" "1 0" "2 0"; do python3 tile.py $V $rc; done
export KEY=260
V="ped 2.67 1.6 0 0 -1 0 -1 0 0 0.62 1.6 2800 24 0.3 0.5 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
echo ALLDONE
