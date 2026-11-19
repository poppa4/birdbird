#!/bin/bash
cd /home/claude/rend2; P=4000; S=16
export WORLD=0.3 KEY=250
export BLEND=/home/claude/rend/b738/b738.blend OUT=/home/claude/rend/b738/hi; mkdir -p $OUT
python3 hitile.py /home/claude/rend2 front 0.44 0.94 0 -0.96 -0.278 0 0 1 0 1.56 0.52 0 0 1.56 0.4767 $P $S 0.2 0.6
python3 hitile.py /home/claude/rend2 ovh 0.895 1.53 0.025 -0.396 0.918 0 0.918 0.396 0 0.74 0.76 0 0 0.74 0.76 $P $S 0.4 0.4
python3 hitile.py /home/claude/rend2 ped 1.08 0.6 0.02 0 -1 0 -1 0 0 0.5 0.86 0 0.03167 0.5 0.86 $P $S 0.35 0.4
python3 hitile.py /home/claude/rend2 cdu 0.585 0.65 0.02 -0.49 -0.872 0 -0.872 0.49 0 0.58 0.30 0 0 0.58 0.26667 $P $S 0.12 0.3
export BLEND=/home/claude/rend/atr/atr.blend OUT=/home/claude/rend/atr/hi; mkdir -p $OUT
python3 hitile.py /home/claude/rend2 front -11.29 0.66 0 -0.985 -0.173 0 0 1 0 1.9 0.74 0 0 1.9 0.73077 $P $S 0.3 0.6
python3 hitile.py /home/claude/rend2 ovh -10.675 1.425 0 -0.361 0.932 0 0.932 0.361 0 1.0 0.96 0.11538 0.33077 0.88462 0.93846 $P $S 0.4 0.4
python3 hitile.py /home/claude/rend2 ped -10.72 0.2 0 0 -1 0 -1 0 0 0.56 1.08 0 0.04231 0.56 1.07923 $P $S 0.5 0.4
echo ALLDONE
