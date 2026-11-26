#!/usr/bin/env python3
"""NORDAP logo (26 Nov 2026): the bird on the globe and the NORDAP wordmark (A with its crossbar).

Clean geometry, one path per part, no SVG masks (sharp in Safari at every size); cut-outs are transparent,
so one file works on any background:
  - mark.d: a solid globe (exact circle) with the bird from the earlier seal and two tapered latitude swooshes cut out
    (centre 0,0, radius 100; made by src/mark.py)
  - word.d: the NORDAP letters of the earlier N-logo, rebuilt from measurements: straight edges as fitted lines, O and
    the bowls as superellipses, the A made symmetric, small rounded corners (cap height 107.1, top at y 0;
    made by src/word-a/)

    python3 tools/logo/seal/build.py          writes img/brand/*.svg, favicon.svg, favicon-32.png, favicon.ico,
                                              apple-touch-icon.png and img/og-nordap.jpg (needs rsvg-convert, Pillow)
"""
import os, subprocess
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..', '..')
NAVY, WHITE = '#0B2545', '#FFFFFF'          # NAVY = site.css --navy
MARK = open(os.path.join(HERE, 'mark.d')).read(); WORD = open(os.path.join(HERE, 'word.d')).read()
WX0, WX1, WY0, WY1 = 0.0, 814.45, -1.60, 108.95      # the wordmark's box (O overshoots the cap line 0..107.1)
CAP = 107.1
# lock-up: globe diameter = 1.8 x cap height, gap = 0.42 x cap height, letters centred on the globe
S = 200 / 1.8 / CAP; GX = 100 + 0.42 * CAP * S; GY = -CAP * S / 2
LX1 = GX + WX1 * S

def svg(vb, body, w=None):
    x, y, ww, hh = vb
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.2f} {y:.2f} {ww:.2f} {hh:.2f}" width="{(w or ww):.0f}" height="{(w or ww) * hh / ww:.0f}">'
            f'<title>NORDAP · Nordic Aviation Platform</title>' + body + '</svg>')

def files():
    out = {}
    for name, col in [('navy', NAVY), ('white', WHITE)]:
        m = f'<path fill="{col}" d="{MARK}"/>'
        w = f'<path fill="{col}" d="{WORD}"/>'
        out[f'img/brand/nordap-logo-{name}.svg'] = svg((-101, -101, LX1 + 102, 202), m + f'<g transform="translate({GX:.3f} {GY:.3f}) scale({S:.5f})">{w}</g>', 800)
        out[f'img/brand/nordap-seal-{name}.svg'] = svg((-100.5, -100.5, 201, 201), m, 200)
        out[f'img/brand/nordap-word-{name}.svg'] = svg((WX0 - 1, WY0 - 1, WX1 - WX0 + 2, WY1 - WY0 + 2), w, 580)
    # favicon: a thin white rim under the globe, so it also stands out on dark tab bars
    out['favicon.svg'] = svg((-108, -108, 216, 216), f'<circle r="107" fill="{WHITE}"/><path fill="{NAVY}" d="{MARK}"/>', 32)
    return out

def png(svgtext, w, bg=None):
    p = '/tmp/_nordap.svg'; open(p, 'w').write(svgtext); q = '/tmp/_nordap.png'
    subprocess.run(['rsvg-convert', '-w', str(w)] + (['-b', bg] if bg else []) + [p, '-o', q], check=True)
    return Image.open(q).convert('RGBA')

if __name__ == '__main__':
    F = files()
    for k, v in F.items(): open(os.path.join(ROOT, k), 'w').write(v)
    fav = F['favicon.svg']
    png(fav, 32).save(os.path.join(ROOT, 'favicon-32.png'))
    big = png(fav, 256); big.save(os.path.join(ROOT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    # apple touch icon: square, white, the globe with a margin (iOS rounds the corners itself)
    t = Image.new('RGBA', (180, 180), (255, 255, 255, 255)); s = png(fav, 152); t.alpha_composite(s, (14, 14)); t.convert('RGB').save(os.path.join(ROOT, 'apple-touch-icon.png'))
    # social preview 1200 x 630: navy, the reversed logo and the site's own line
    from PIL import ImageDraw
    og = Image.new('RGB', (1200, 630), NAVY); d = ImageDraw.Draw(og)
    for y in range(630):   # a quiet top-to-bottom shade
        c = tuple(int(a + (b - a) * y / 629) for a, b in zip((14, 44, 80), (8, 28, 52))); d.line([(0, y), (1200, y)], fill=c)
    lg = png(F['img/brand/nordap-logo-white.svg'], 640); og.paste(lg, (80, 150), lg)
    txt = ('<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="200"><style>text{font-family:Inter,"Public Sans",sans-serif}</style>'
           '<text x="0" y="62" font-size="58" font-weight="700" fill="#fff">The Nordic Aviation Platform</text>'
           '<text x="0" y="122" font-size="27" font-weight="400" fill="#C9D6E3">From aviation theory and regulations to interactive</text>'
           '<text x="0" y="160" font-size="27" font-weight="400" fill="#C9D6E3">training and flight preparation.</text></svg>')
    tp = '/tmp/_ogt.svg'; open(tp, 'w').write(txt); subprocess.run(['rsvg-convert', tp, '-o', '/tmp/_ogt.png'], check=True)
    ti = Image.open('/tmp/_ogt.png').convert('RGBA'); og.paste(ti, (80, 380 + 0), ti)
    og.save(os.path.join(ROOT, 'img', 'og-nordap.jpg'), quality=90)
    print('written:', ', '.join(list(F) + ['favicon-32.png', 'favicon.ico', 'apple-touch-icon.png', 'img/og-nordap.jpg']))
