#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/b788/b788.blend OUT=/home/claude/rend/b788/out WORLD=0.12 KEY=130; mkdir -p $OUT
V="main -23.7 1.68 0 -1 0 0 0 1 0 2.0 0.76 2800 24 0.35 0.6 3 1"
for rc in "0 0" "1 0" "2 0"; do python3 tile.py $V $rc; done
V="ovh -23.141 2.566 0 -0.349 0.937 0 0.937 0.349 0 0.86 1.0 2800 24 0.35 0.3 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
export KEY=200
V="ped -23.15 1.6 0 0 -1 0 -1 0 0 0.62 1.3 2800 24 0.3 0.45 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
echo ALLDONE
