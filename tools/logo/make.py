#!/usr/bin/env python3
"""NORDAP logo: the seal, the small mark and the horizontal lock-up.

    python3 tools/logo/make.py [out_dir]

Writes logo-seal.svg, logo-mark.svg and favicon.svg to the site root, and the lock-ups (SVG) to out_dir
(default /tmp/logo/out). All lettering is drawn as outlines from Inter (SIL Open Font License), so the
logo looks the same on every device and in every program, with no font needed.
PNG:  rsvg-convert -w 3840 file.svg -o file.png
"""
import math, os, re, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/logo/out'
FONTS = '/usr/share/fonts/opentype/inter/'
NAVY, GOLD, GOLD2, PAPER, BLUE, WHITE = '#0B2545', '#C9A24A', '#A8842F', '#FFFFFF', '#34588A', '#FFFFFF'   # navy, sheet white and gold are the site's own tokens (site.css)
ACCENT, ACCENT2 = '#9A1E68', '#82165A'   # the site accent (site.css --accent, --accent-hover): the north point
NAME, FULL = 'NORDAP', 'NORDIC AVIATION PLATFORM'

_fonts = {}
def font(w):
    if w not in _fonts:
        f = TTFont(FONTS + 'Inter-%s.otf' % w); _fonts[w] = (f, f.getGlyphSet(), f.getBestCmap(), f['head'].unitsPerEm)
    return _fonts[w]

def glyphs(text, w, size, track):
    """[(path d in font units, advance in user units)], scale"""
    f, gs, cmap, upm = font(w); s = size / upm; out = []
    for ch in text:
        g = gs[cmap[ord(ch)]]; pen = SVGPathPen(gs); g.draw(pen)
        out.append((pen.getCommands(), g.width * s + track))
    return out, s

def arc_text(text, w, size, track, r, fill, bottom=False, cx=100, cy=100):
    gl, s = glyphs(text, w, size, track); total = sum(a for _, a in gl) - track; x = 0; o = []
    for d, adv in gl:
        mid = x + (adv - track) / 2; a = (mid - total / 2) / r; x += adv
        if not d: continue
        if bottom: px, py, rot = cx + r * math.sin(a), cy + r * math.cos(a), -math.degrees(a)
        else:      px, py, rot = cx + r * math.sin(a), cy - r * math.cos(a), math.degrees(a)
        o.append('<path transform="translate(%.3f %.3f) rotate(%.3f) translate(%.3f 0) scale(%.5f %.5f)" d="%s" fill="%s"/>'
                 % (px, py, rot, -(adv - track) / 2, s, -s, d, fill))
    return ''.join(o)

def line_text(text, w, size, track, x, y, fill, anchor='start'):
    gl, s = glyphs(text, w, size, track); total = sum(a for _, a in gl) - track
    if anchor == 'middle': x -= total / 2
    o = []
    for d, adv in gl:
        if d: o.append('<path transform="translate(%.3f %.3f) scale(%.5f %.5f)" d="%s" fill="%s"/>' % (x, y, s, -s, d, fill))
        x += adv
    return ''.join(o), total

def star(cx, cy, R=6.5, r=2.4, fill=GOLD):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; q = R if i % 2 == 0 else r
        pts.append('%.2f %.2f' % (cx + q * math.cos(a), cy + q * math.sin(a)))
    return '<path d="M%sZ" fill="%s"/>' % ('L'.join(pts), fill)

def rose(cx, cy, long, short, wl, ws):
    """Eight-point compass rose. The north point carries the site accent: Nord."""
    o = []
    for i in range(4):                                   # intercardinal points first (they sit under the main ones)
        a = math.radians(45 + 90 * i); tip = (cx + short * math.sin(a), cy - short * math.cos(a))
        for sgn, col in ((-1, '#7D8C99'), (1, '#A7B3BD')):
            b = a + sgn * math.pi / 4; base = (cx + ws * math.sin(b), cy - ws * math.cos(b))
            o.append('<path d="M%.2f %.2fL%.2f %.2fL%.2f %.2fZ" fill="%s"/>' % (cx, cy, base[0], base[1], tip[0], tip[1], col))
    for i in range(4):
        a = math.radians(90 * i); tip = (cx + long * math.sin(a), cy - long * math.cos(a))
        for sgn, col in ((-1, ACCENT if i == 0 else NAVY), (1, ACCENT2 if i == 0 else BLUE)):
            b = a + sgn * math.pi / 4; base = (cx + wl * math.sin(b), cy - wl * math.cos(b))
            o.append('<path d="M%.2f %.2fL%.2f %.2fL%.2f %.2fZ" fill="%s"/>' % (cx, cy, base[0], base[1], tip[0], tip[1], col))
    return ''.join(o)

def ticks(cx, cy, r_out):
    o = []
    for i in range(72):
        a = math.radians(5 * i); major = i % 6 == 0; r_in = r_out - (9 if major else 3.2)
        o.append('<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="%s" stroke-width="%s" stroke-linecap="round"/>'
                 % (cx + r_out * math.sin(a), cy - r_out * math.cos(a), cx + r_in * math.sin(a), cy - r_in * math.cos(a), NAVY, 1.6 if major else 0.9))
    return ''.join(o)

def seal_body():
    return ('<circle cx="100" cy="100" r="98" fill="%s"/>' % NAVY
            + '<circle cx="100" cy="100" r="94.5" fill="none" stroke="%s" stroke-width="1.6"/>' % GOLD
            + '<circle cx="100" cy="100" r="66.5" fill="none" stroke="%s" stroke-width="1.6"/>' % GOLD
            + arc_text(NAME, 'ExtraBold', 21, 6.2, 73.2, WHITE)
            + arc_text(FULL, 'SemiBold', 9.6, 2.5, 85.6, WHITE, bottom=True)
            + star(22, 100) + star(178, 100)
            + '<circle cx="100" cy="100" r="64.5" fill="%s"/>' % PAPER
            + ticks(100, 100, 63.5) + rose(100, 100, 52, 30, 7.5, 7.1))

def svg(w, h, body, bg=None):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g">' % (w, h)
            + ('<rect width="%g" height="%g" fill="%s"/>' % (w, h, bg) if bg else '') + body + '</svg>')

def mark():
    return svg(32, 32, '<circle cx="16" cy="16" r="15.5" fill="%s"/><circle cx="16" cy="16" r="12.6" fill="%s"/>' % (NAVY, PAPER)
               + rose(16, 16, 11.3, 0, 1.9, 0).replace('fill="#7D8C99"', 'fill="none"').replace('fill="#A7B3BD"', 'fill="none"'))

def lockup(ink, rule, bg=None, W=1920, H=1080):
    """Seal, the name, a rule, and the full name on three lines."""
    S = 2.6                                                    # drawn at a natural size around y = 0, then fitted to the canvas
    body = '<g transform="translate(0 %g) scale(%g)">%s</g>' % (-100 * S, S, seal_body())
    x0 = 200 * S + 90; name, wn = line_text(NAME, 'ExtraBold', 190, 14, x0, 68, ink)
    body += name
    xr = x0 + wn + 60; wd = 0
    body += '<rect x="%g" y="-105" width="5" height="210" fill="%s"/>' % (xr, rule)
    for i, word in enumerate(('Nordic', 'Aviation', 'Platform')):
        t, w1 = line_text(word, 'Medium', 58, 1.5, xr + 50, -44 + i * 70, ink); body += t; wd = max(wd, w1)
    total = xr + 50 + wd; k = min((W - 2 * 170) / total, (H - 2 * 170) / (200 * S))
    body = '<g transform="translate(%.2f %.2f) scale(%.5f)">%s</g>' % ((W - total * k) / 2, H / 2, k, body)
    return svg(W, H, body, bg)

def write(path, s):
    os.makedirs(os.path.dirname(path), exist_ok=True); open(path, 'w').write(s); print(os.path.relpath(path), len(s))

if __name__ == '__main__':
    seal = svg(200, 200, seal_body())
    write(os.path.join(ROOT, 'logo-seal.svg'), seal)
    m = mark(); write(os.path.join(ROOT, 'logo-mark.svg'), m); write(os.path.join(ROOT, 'favicon.svg'), m)
    write(os.path.join(OUT, 'nordap-seal.svg'), seal)
    write(os.path.join(OUT, 'nordap-logo-dark.svg'), lockup(WHITE, GOLD, NAVY))
    write(os.path.join(OUT, 'nordap-logo-light.svg'), lockup(NAVY, GOLD, WHITE))
    write(os.path.join(OUT, 'nordap-logo-transparent.svg'), lockup(NAVY, GOLD))
