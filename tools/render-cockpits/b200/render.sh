#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/b200/b200.blend OUT=/home/claude/rend/b200/out WORLD=0.12 KEY=130
python3 tile.py ovh -4.16 0.32 0 -0.423 0.906 0 0.906 0.423 0 0.56 0.40 2800 24 0.3 0.3 1 1 0 0
V="main -4.585 -0.24 0 -1 0 0 0 1 0 1.42 0.62 2800 24 0.3 0.4 3 1"
for rc in "0 0" "1 0" "2 0"; do python3 tile.py $V $rc; done
V="sub -4.5 -0.44 0.1 -0.62 -0.78 0 -0.78 0.62 0 1.4 0.26 2800 24 0.2 0.3 2 1"
for rc in "0 0" "1 0"; do python3 tile.py $V $rc; done
V="ped -4.25 -0.62 0 -0.3 -0.95 0 -0.95 0.3 0 0.36 1.1 2800 24 0.4 0.4 1 2"
for rc in "0 0" "0 1"; do python3 tile.py $V $rc; done
python3 tile.py left -4.3 -0.5 0.7 0 0 1 0 1 0 0.42 0.26 2800 24 0.3 0.2 1 1 0 0
python3 tile.py right -4.23 -0.5 -0.7 0 0 -1 0 1 0 0.56 0.34 2800 24 0.3 0.2 1 1 0 0
echo ALLDONE
