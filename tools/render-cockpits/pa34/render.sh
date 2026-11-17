#!/bin/bash
# main is rendered from cfg_main.py (side switch panel and quadrant levers left out so they do not cover the panel)
cd /home/claude/rend
python3 tile.py side -0.835 1.28 0.5 0 0 1 0 1 0 0.32 0.24 2800 24 0.3 0.15 1 1 0 0
python3 tile.py floor -0.74 1.0 0.02 0 -1 0 -1 0 0 0.3 0.74 2800 24 0.205 0.25 1 1 0 0
python3 tile.py cowl -1.04 1.0 0 -0.62 -0.78 0 -1 1 0 0.22 0.22 2800 24 0.2 0.3 1 1 0 0
BLEND=/home/claude/rend/pa34/pa34.blend python3 tile.py quad -1.0 1.3 0.01 0 -1 0 -1 0 0 0.2 0.2 2800 24 0.15 0.2 1 1 0 0
export BLEND=/home/claude/rend/pa34/m/pa34m.blend
V="main -1.08 1.40 0 -1 0 0 0 1 0 1.3 0.5 2800 24 0.45 0.3 2 1"
for rc in "0 0" "1 0"; do python3 tile.py $V $rc; done
