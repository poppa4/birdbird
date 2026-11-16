#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/e190/e190.blend OUT=/home/claude/rend/e190/out WORLD=0.12 KEY=130; mkdir -p $OUT
V="main -12.5 1.03 0 -1 0 0 0 1 0 1.9 0.52 2800 24 0.3 0.3 3 1"
for rc in "0 0" "1 0" "2 0"; do python3 tile.py $V $rc; done
V="ovh -12.125 1.74 0 -0.522 0.852 0 0.852 0.522 0 1.0 0.58 2800 24 0.3 0.25 2 1"
for rc in "0 0" "1 0"; do python3 tile.py $V $rc; done
V="ped -11.95 0.7 0 0 -1 0 -1 0 0 0.5 1.25 2800 24 0.3 0.25 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
echo ALLDONE
