"""Compose one aircraft's sheet, compute its targets, write overlay, webp and meta. usage: make.py <dir>"""
import sys, os, json, runpy; sys.path.insert(0, '/home/claude/rend')
from sheet import Sheet
d = sys.argv[1]; S = runpy.run_path(os.path.join(d, 'spec.py')); sh = Sheet(d, S['VIEWS'], S.get('PLACE'), S.get('GAP', 40), crop=S.get('CROP')); sh.compose(S.get('post'))
if S.get('paint'): S['paint'](sh)
T, miss = sh.targets(S['CTL'](sh) if callable(S['CTL']) else S['CTL'])
for m in miss: print('  NO OBJECT', m)
json.dump(T, open(os.path.join(d, 'out', 'targets.json'), 'w')); table, h = sh.emit(T, S['CONST']); json.dump({'table': table, 'h': h, 'W': sh.Wpx, 'H': sh.Hpx, 'pos': sh.pos}, open(os.path.join(d, 'out', 'meta.json'), 'w'))
sh.save(S['NAME'] + '-deck'); sh.overlay(T, os.path.join(d, 'out', 'overlay.jpg'), scale=min(1, 2400 / sh.Wpx)); sh.flat().resize((1200, round(sh.Hpx * 1200 / sh.Wpx))).save(os.path.join(d, 'out', 'small.jpg'), quality=86)
print('sheet', sh.Wpx, sh.Hpx, 'targets', len(T), 'missing', len(miss), {k: v for k, v in sh.pos.items()})
