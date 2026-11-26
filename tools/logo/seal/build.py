#!/usr/bin/env python3
"""NORDAP logo (26 Nov 2026): the seal (ring, globe and bird) and the NORDAP wordmark, from the owner's logo image.

The seal's circles are exact (radii measured from the image); the bird, the globe lines and the letters were traced
from the image (potrace) and are stored here as path data: seal_contents.d, word.d, seal_r.json (units: seal radius 100,
seal centre at 0,0). Everything cut out of the seal is transparent, so the same file works on any background.

    python3 tools/logo/seal/build.py          writes img/brand/*.svg, favicon.svg, favicon-32.png, favicon.ico,
                                              apple-touch-icon.png and img/og-nordap.jpg (needs rsvg-convert, Pillow)
"""
import json, os, subprocess
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..', '..')
NAVY, WHITE = '#0B2545', '#FFFFFF'          # NAVY = site.css --navy
R = json.load(open(os.path.join(HERE, 'seal_r.json'))); SEAL = open(os.path.join(HERE, 'seal_contents.d')).read(); WORD = open(os.path.join(HERE, 'word.d')).read()
WX0, WX1, WY0, WY1 = 115.4, 695.7, -37.9, 27.3        # the wordmark's box in seal units
circ = lambda r: f'M{r:.3f} 0A{r:.3f} {r:.3f} 0 1 0 {-r:.3f} 0A{r:.3f} {r:.3f} 0 1 0 {r:.3f} 0Z'

def seal(fill, mid):
    return (f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="-101" y="-101" width="202" height="202"><rect x="-101" y="-101" width="202" height="202" fill="#fff"/>'
            f'<path fill="#000" fill-rule="evenodd" d="{circ(R["r2"])} {circ(R["r1"])}"/><path fill="#000" d="{SEAL}"/></mask>',
            f'<path fill="{fill}" mask="url(#{mid})" d="{circ(100)}"/>')

def svg(vb, defs, body, w=None):
    x, y, ww, hh = vb
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.2f} {y:.2f} {ww:.2f} {hh:.2f}" width="{(w or ww):.0f}" height="{(w or ww) * hh / ww:.0f}">'
            f'<title>NORDAP · Nordic Aviation Platform</title>' + (f'<defs>{defs}</defs>' if defs else '') + body + '</svg>')

def files():
    out = {}
    for name, col in [('navy', NAVY), ('white', WHITE)]:
        m, g = seal(col, 's')
        out[f'img/brand/nordap-logo-{name}.svg'] = svg((-100, -100, WX1 + 100 + 1, 200), m, g + f'<path fill="{col}" d="{WORD}"/>', 796)
        out[f'img/brand/nordap-seal-{name}.svg'] = svg((-100, -100, 200, 200), m, g, 200)
        out[f'img/brand/nordap-word-{name}.svg'] = svg((WX0 - 0.5, WY0 - 0.5, WX1 - WX0 + 1, WY1 - WY0 + 1), '', f'<path fill="{col}" d="{WORD}"/>', 580)
    m, g = seal(NAVY, 's')
    # favicon: a thin white rim under the seal, so it also stands out on dark tab bars
    out['favicon.svg'] = svg((-108, -108, 216, 216), m, f'<circle r="107" fill="{WHITE}"/>' + g, 32)
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
    # apple touch icon: square, white, the seal with a margin (iOS rounds the corners itself)
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
    ti = Image.open('/tmp/_ogt.png').convert('RGBA'); og.paste(ti, (80, 380), ti)
    og.save(os.path.join(ROOT, 'img', 'og-nordap.jpg'), quality=90)
    print('written:', ', '.join(list(F) + ['favicon-32.png', 'favicon.ico', 'apple-touch-icon.png', 'img/og-nordap.jpg']))
