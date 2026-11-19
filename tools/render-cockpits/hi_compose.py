"""Stitch the 4000 px/m renders of each panel into one picture per panel for the 3D cockpit, matched to the 2D sheet: wherever the
sheet differs from the render (captions and digits painted onto the sheet, display pictures), the sheet's own pixels are used.
usage: hi_compose.py ac tiledir sheet.webp 'k:x,y,w,h;...' (sheet units, 1000 across) [gamma-keys]"""
import sys, glob, re, numpy as np
from PIL import Image, ImageFilter
ac, td, sheetp, spec = sys.argv[1:5]; gam = set(sys.argv[5].split(',')) if len(sys.argv) > 5 else set()
S = Image.open(sheetp).convert('RGB'); u = S.width / 1000
for part in spec.split(';'):
    k, r = part.split(':'); r = [float(v) for v in r.split(',')]
    fs = glob.glob(f'{td}/{k}_*_*.png'); idx = sorted({tuple(map(int, re.findall(r'_(\d+)_(\d+)\.png$', f)[0])) for f in fs})
    R = max(i[0] for i in idx) + 1; C = max(i[1] for i in idx) + 1
    T = [[Image.open(f'{td}/{k}_{i}_{j}.png').convert('RGBA') for j in range(C)] for i in range(R)]
    im = Image.new('RGBA', (sum(t.width for t in T[0]), sum(row[0].height for row in T))); y = 0
    for row in T:
        x = 0
        for t in row: im.paste(t, (x, y)); x += t.width
        y += row[0].height
    if k in gam: a = im.getchannel('A'); rgb = im.convert('RGB').point(lambda v: int(255 * (v / 255) ** 0.62)); rgb.putalpha(a); im = rgb
    bg = Image.new('RGBA', im.size, (17, 20, 24, 255)); bg.alpha_composite(im); hi = bg.convert('RGB')
    box = (round(r[0] * u), round(r[1] * u), round((r[0] + r[2]) * u), round((r[1] + r[3]) * u)); sh = S.crop(box)
    lo = hi.resize(sh.size, Image.LANCZOS)
    a = np.asarray(lo.filter(ImageFilter.GaussianBlur(1)), np.int16); b = np.asarray(sh.filter(ImageFilter.GaussianBlur(1)), np.int16)
    d = np.abs(a - b).max(2); m = Image.fromarray(((d > 34) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    print(k, 'hi', hi.size, 'sheet', sh.size, 'mean diff', round(float(d.mean()), 1), 'replaced', round(float((d > 34).mean()) * 100, 1), '%')
    M = m.resize(hi.size, Image.BILINEAR); out = Image.composite(sh.resize(hi.size, Image.LANCZOS), hi, M)
    out.save(f'/home/claude/birdbird/img/cockpits/{ac}-3d-{k}.webp', quality=80, method=6)
    Image.fromarray(np.asarray(M)).save(f'/tmp/shots/mask_{ac}_{k}.png')
