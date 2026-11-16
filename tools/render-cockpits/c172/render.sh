#!/bin/bash
cd /home/claude/rend; export BLEND=/home/claude/rend/c172/c172.blend OUT=/home/claude/rend/c172/out WORLD=1.1 KEY=560
F="front -0.36 -0.16 0 -1 0 0 0 1 0 1.24 0.92 2800 24 0.3 0.6 2 2"
for rc in "0 0" "1 0" "0 1" "1 1"; do python3 tile.py $F $rc; done
python3 render.py -- fuel -0.21 -0.64 0 0 -1 0 -1 0 0 0.24 0.24 672 24 0.25 0.1
echo ALLDONE
