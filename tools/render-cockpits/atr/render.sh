#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/atr/atr.blend OUT=/home/claude/rend/atr/out WORLD=0.3 KEY=250
V="ovh -10.675 1.425 0 -0.361 0.932 0 0.932 0.361 0 1.0 0.96 2600 24 0.4 0.4 1 3"
for rc in "0 0" "0 1" "0 2"; do python3 tile.py $V $rc; done
V="front -11.29 0.66 0 -0.985 -0.173 0 0 1 0 1.9 0.74 2600 24 0.3 0.6 4 1"
for rc in "0 0" "1 0" "2 0" "3 0"; do python3 tile.py $V $rc; done
V="ped -10.72 0.2 0 0 -1 0 -1 0 0 0.56 1.08 2600 24 0.5 0.4 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
echo ALLDONE
