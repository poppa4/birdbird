#!/bin/bash
cd /home/claude/rend
P=4000; S=16
V="ovh 0.385 1.10 0 -0.362 0.932 0 0.932 0.362 0 0.66 1.30 $P $S 0.4 0.6 1 3"
for r in 0 1 2; do python3 tile_c.py $V 0 $r; done
V="front -0.478 0.229 0 -0.955 -0.297 0 0 1 0 1.64 0.54 $P $S 0.4 0.6 3 1"
for c in 0 1 2; do python3 tile_c.py $V $c 0; done
V="ped -0.02289 -0.07831 0 -0.13 -0.99 0 -1 0 0 0.58 0.886 $P $S 0.30 0.5 1 2"
for r in 0 1; do python3 tile_c.py $V 0 $r; done
echo ALLDONE
