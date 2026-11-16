#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/b738/b738.blend OUT=/home/claude/rend/b738/out WORLD=0.3 KEY=250
V="ovh 0.895 1.53 0.025 -0.396 0.918 0 0.918 0.396 0 0.74 0.76 3000 24 0.4 0.4 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
V="front 0.44 0.94 0 -0.96 -0.278 0 0 1 0 1.56 0.52 3000 24 0.2 0.6 3 1"
for rc in "0 0" "1 0" "2 0"; do python3 tile.py $V $rc; done
V="cdu 0.585 0.65 0.02 -0.49 -0.872 0 -0.872 0.49 0 0.58 0.30 3000 24 0.12 0.3 1 1"
python3 tile.py $V 0 0
V="ped 1.08 0.6 0.02 0 -1 0 -1 0 0 0.5 0.86 3000 24 0.35 0.4 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
echo ALLDONE
