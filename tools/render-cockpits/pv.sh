#!/bin/bash
# quick look: pv.sh <dir> <blend> name cx cy cz nx ny nz ux uy uz W H near far [ppm]
d=$1; b=$2; shift 2; cd /home/claude/rend; export BLEND=$b OUT=/home/claude/rend/$d/pv WORLD=${WORLD:-0.5} KEY=${KEY:-200}; mkdir -p $OUT
python3 tile.py $1 $2 $3 $4 $5 $6 $7 $8 $9 ${10} ${11} ${12} ${15:-450} 6 ${13} ${14} 1 1 0 0
