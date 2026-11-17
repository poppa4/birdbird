#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/pa28/pa28.blend OUT=/home/claude/rend/pa28/out WORLD=0.2 KEY=160; mkdir -p $OUT
V="main -1.73 0.16 0 -1 0 0 0 1 0 1.12 0.66 2800 24 0.42 0.5 2 1"
for rc in "0 0" "1 0"; do python3 tile.py $V $rc; done
python3 tile.py floor -1.52 -0.37 0 0 -1 0 -1 0 0 0.3 0.5 2800 24 0.35 0.25 1 1 0 0
python3 tile.py fuel -1.72 -0.23 0.53 0 0 1 0 1 0 0.18 0.18 2800 24 0.3 0.1 1 1 0 0
echo ALLDONE
