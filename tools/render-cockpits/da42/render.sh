#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/da42/da42.blend OUT=/home/claude/rend/da42/out WORLD=0.12 KEY=130
F="front -1.96 0.19 0 -1 0 0 0 1 0 1.10 0.62 2800 24 0.35 0.6 2 1"
for rc in "0 0" "1 0"; do python3 tile.py $F $rc; done
P="ped -1.58 -0.05 0 0 -1 0 -1 0 0 0.34 0.80 2800 24 0.2 0.4 1 1"
python3 tile.py $P 0 0
echo ALLDONE
