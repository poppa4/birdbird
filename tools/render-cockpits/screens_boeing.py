"""Our own drawings of 737NG-style displays (on the ground, engines at idle). Writes scr/b_*.svg."""
import math
G, C, W, M, Y, R, GY = '#27E052', '#27D8F0', '#F2F5F8', '#EE6CE8', '#F2E21B', '#F0342A', '#AEB6BF'
F = 'font-family="DejaVu Sans" font-weight="bold"'
def T(x, y, s, t, c=W, a='middle'): return f'<text x="{x}" y="{y}" font-size="{s}" fill="{c}" text-anchor="{a}" {F}>{t}</text>'
def L(x1, y1, x2, y2, c=W, w=2): return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{w}" stroke-linecap="round"/>'
def B(x, y, w, h, f='#000', s=None, sw=1.5, rx=0): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{f}"' + (f' stroke="{s}" stroke-width="{sw}"' if s else '') + '/>'
def pol(cx, cy, r, deg): a = math.radians(deg); return cx + r * math.sin(a), cy - r * math.cos(a)
def svg(w, h, body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><rect width="{w}" height="{h}" fill="#020305"/>{body}</svg>'
def pfd():
    cx, cy = 290, 300; o = '<defs><clipPath id="a"><rect x="150" y="150" width="280" height="300" rx="34"/></clipPath><clipPath id="s"><rect x="40" y="130" width="84" height="340"/></clipPath><clipPath id="al"><rect x="462" y="130" width="92" height="340"/></clipPath></defs>'
    o += f'<g clip-path="url(#a)">{B(100, 100, 400, cy - 100, "#1D7FDD")}{B(100, cy, 400, 300, "#7A4E1C")}{L(100, cy, 500, cy, W, 2.5)}'
    for d, hw in ((2.5, 12), (5, 24), (7.5, 12), (10, 46), (12.5, 12), (15, 24), (20, 46)):
        for sg in (1, -1):
            y = cy - sg * d * 7.2; o += L(cx - hw, y, cx + hw, y, W, 2.2)
            if d in (10, 20): o += T(cx - hw - 18, y + 6, 16, int(d)) + T(cx + hw + 18, y + 6, 16, int(d))
    o += '</g>'
    for a in (-45, -30, -20, -10, 10, 20, 30, 45): x1, y1 = pol(cx, cy, 152, a); x2, y2 = pol(cx, cy, 166 if abs(a) in (30, 45) else 160, a); o += L(x1, y1, x2, y2, W, 2.4)
    o += f'<path d="M{cx} {cy - 150} l-10 -16 h20z" fill="{W}"/><path d="M{cx} {cy - 147} l-9 14 h18z" fill="none" stroke="{W}" stroke-width="2.2"/>'
    o += f'<path d="M{cx - 110} {cy - 5} h64 v20 h-10 v-10 h-54z M{cx + 110} {cy - 5} h-64 v20 h10 v-10 h54z" fill="#000" stroke="{W}" stroke-width="2"/>' + B(cx - 5, cy - 5, 10, 10, '#000', W, 2)
    o += L(cx, cy - 70, cx, cy + 70, M, 3) + L(cx - 90, cy, cx + 90, cy, M, 3)
    o += B(150, 40, 280, 62, '#000', GY, 1.5) + L(243, 40, 243, 102, GY, 1.5) + L(337, 40, 337, 102, GY, 1.5) + T(196, 66, 18, 'ARM', W) + T(290, 66, 18, 'LNAV', W) + T(384, 66, 18, 'VNAV', W) + T(290, 128, 22, 'FD', G)
    o += B(40, 130, 84, 340, '#3A3F47') + '<g clip-path="url(#s)">'
    for v in range(40, 131, 10):
        y = cy + 110 - (v - 40) * 4.4; o += L(110, y, 124, y, W, 2.2)
        if v % 20 == 0 and abs(y - cy) > 26: o += T(102, y + 7, 20, v, W, 'end')
    o += '</g>' + f'<path d="M36 {cy - 22} h66 l16 22 l-16 22 h-66z" fill="#000" stroke="{W}" stroke-width="2"/>' + T(96, cy + 9, 24, '45', W, 'end') + T(82, 122, 20, '153', M) + B(124, cy + 66, 8, 100, R)
    o += B(462, 130, 92, 340, '#3A3F47') + '<g clip-path="url(#al)">'
    for i in range(-3, 4):
        v = 700 + i * 100; y = cy - i * 50; o += L(462, y, 476, y, W, 2.2)
        if abs(y - cy) > 28: o += T(548, y + 7, 19, v, W, 'end')
    o += '</g>' + f'<path d="M560 {cy - 22} h-78 l-16 22 l16 22 h78z" fill="#000" stroke="{W}" stroke-width="2"/>' + T(530, cy + 9, 24, '6', W, 'end') + T(556, cy + 8, 18, '80', W, 'end') + T(508, 122, 20, '5000', M) + T(508, 496, 18, '1013 HPA', G)
    o += f'<path d="M568 170 h18 l20 50 v160 l-20 50 h-18z" fill="#3A3F47"/>' + L(574, cy, 604, cy, W, 3)
    for v, y in ((2, 200), (1, 250), (1, 350), (2, 400)): o += L(570, y, 580, y, W, 2) + T(584, y + 5, 13, v, W, 'start')
    hx, hy, r = cx, 716, 220; o += f'<circle cx="{hx}" cy="{hy}" r="{r}" fill="#3A3F47"/>'
    for d in range(215, 316, 5):
        a = d - 264; big = d % 10 == 0; x1, y1 = pol(hx, hy, r, a); x2, y2 = pol(hx, hy, r - (16 if big else 9), a); o += L(x1, y1, x2, y2, W, 2)
        if big: x, y = pol(hx, hy, r - 32, a); o += f'<g transform="rotate({a} {x:.1f} {y:.1f})">' + T(round(x, 1), round(y + 7, 1), 19, d // 10) + '</g>'
    o += f'<path d="M{hx} {hy - r + 2} l-9 -14 h18z" fill="none" stroke="{W}" stroke-width="2.2"/>' + T(112, 560, 18, '264', M, 'end') + T(118, 560, 14, 'H', M, 'start') + T(470, 560, 16, 'MAG', G, 'start')
    return svg(620, 600, o)
def nd():
    cx, cy, r = 310, 520, 400; o = T(14, 28, 16, 'GS', W, 'start') + T(46, 28, 20, '0', W, 'start') + T(84, 28, 16, 'TAS', W, 'start') + T(126, 28, 20, '---', W, 'start')
    o += T(606, 28, 19, 'OKSAT', M, 'end') + T(606, 52, 19, '1047.2z', W, 'end') + T(606, 76, 19, '4.6 NM', W, 'end')
    o += B(cx - 42, 44, 84, 34, '#000', W, 2) + T(cx, 70, 24, '264') + T(cx - 52, 68, 15, 'TRK', G, 'end') + T(cx + 52, 68, 15, 'MAG', G, 'start')
    a0, a1 = pol(cx, cy, r, -48), pol(cx, cy, r, 48); o += f'<clipPath id="n"><rect x="0" y="80" width="620" height="520"/></clipPath><g clip-path="url(#n)"><path d="M{a0[0]:.1f} {a0[1]:.1f} A{r} {r} 0 0 1 {a1[0]:.1f} {a1[1]:.1f}" fill="none" stroke="{W}" stroke-width="2.4"/>'
    for d in range(220, 311, 5):
        a = d - 264
        if abs(a) > 48: continue
        big = d % 10 == 0; x1, y1 = pol(cx, cy, r, a); x2, y2 = pol(cx, cy, r - (18 if big else 10), a); o += L(x1, y1, x2, y2, W, 2.2)
        if big: x, y = pol(cx, cy, r - 36, a); o += f'<g transform="rotate({a} {x:.1f} {y:.1f})">' + T(round(x, 1), round(y + 7, 1), 20, d // 10) + '</g>'
    b0, b1 = pol(cx, cy, r / 2, -60), pol(cx, cy, r / 2, 60); o += f'<path d="M{b0[0]:.1f} {b0[1]:.1f} A{r / 2} {r / 2} 0 0 1 {b1[0]:.1f} {b1[1]:.1f}" fill="none" stroke="{W}" stroke-width="1.6"/>' + T(cx - 12, cy - r / 2 - 6, 16, '10', W, 'end')
    P = [(cx, cy), pol(cx, cy, 92, -13), pol(cx, cy, 240, -13), pol(cx, cy, 350, 9)]
    o += '<polyline points="' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in P) + f'" fill="none" stroke="{M}" stroke-width="3"/>'
    for i, ((x, y), nm) in enumerate(zip(P[1:], ('OKSAT', 'BBD01', 'TUVIT'))): c = M if i == 0 else W; o += f'<path d="M{x:.1f} {y - 10:.1f} l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="none" stroke="{c}" stroke-width="2"/>' + T(round(x + 14), round(y + 6), 16, nm, c, 'start')
    o += L(cx, cy - r, cx, cy - 30, W, 1.6) + '</g>' + f'<path d="M{cx} {cy - 26} l-16 40 h32z" fill="none" stroke="{W}" stroke-width="2.6"/>'
    o += T(14, 560, 16, 'VOR 1', G, 'start') + T(14, 582, 16, 'TRO', G, 'start') + T(606, 560, 16, 'VOR 2', G, 'end') + T(606, 582, 16, 'GRM', G, 'end')
    return svg(620, 600, o)
def dial(cx, cy, r, frac, val, red=True):
    a0, a1 = 0, 210; o = ''
    p0, p1 = pol(cx, cy, r, 90 + a0), pol(cx, cy, r, 90 + a1); o += f'<path d="M{p0[0]:.1f} {p0[1]:.1f} A{r} {r} 0 1 1 {p1[0]:.1f} {p1[1]:.1f}" fill="none" stroke="{W}" stroke-width="2.6"/>'
    if red: x, y = pol(cx, cy, r + 9, 90 + a1); x2, y2 = pol(cx, cy, r - 2, 90 + a1); o += L(x, y, x2, y2, R, 4)
    x, y = pol(cx, cy, r - 2, 90 + a1 * frac); o += L(cx, cy, x, y, W, 3) + B(cx + 6, cy - 40, r + 16, 30, '#000', W, 1.8) + T(cx + r + 16, cy - 17, 22, val, W, 'end')
    return o
def eicas():
    o = T(34, 34, 17, 'TAT', C, 'start') + T(84, 34, 20, '+15c', W, 'start') + T(310, 34, 20, 'TO', G) + T(180, 34, 18, '26K', G)
    for cx in (150, 390): o += T(cx + 40, 64, 19, '96.4', G, 'end') + dial(cx, 140, 62, 0.21, '21.4') + dial(cx, 300, 50, 0.42, '465', False)
    o += T(270, 150, 17, 'N1', C) + T(270, 306, 17, 'EGT', C) + T(120, 410, 16, 'ENG 1', W) + T(360, 410, 16, 'ENG 2', W)
    o += T(540, 120, 15, 'FF', C) + T(540, 146, 20, '0.31', W) + T(540, 170, 20, '0.31', W)
    for x, y, lab, v in ((330, 500, '1', '3.10'), (430, 450, 'CTR', '0.00'), (530, 500, '2', '3.10')): o += f'<circle cx="{x}" cy="{y}" r="38" fill="none" stroke="{W}" stroke-width="2"/>' + T(x, y - 44, 15, lab, C) + T(x, y + 8, 21, v, W)
    o += T(430, 566, 16, 'FUEL KG X 1000', C) + B(20, 440, 250, 140, '#000', GY, 1.2) + T(30, 466, 17, 'PARKING BRAKE', W, 'start')
    return svg(620, 600, o)
def lower():
    o = ''
    for cx in (150, 390): o += dial(cx, 110, 56, 0.62, '59.8') + T(cx + 46, 220, 21, '0.31', W, 'end') + T(cx + 46, 290, 21, '42', W, 'end') + T(cx + 46, 350, 21, '88', W, 'end') + T(cx + 46, 410, 21, '74', W, 'end') + T(cx + 46, 470, 21, '0.6', W, 'end')
    for y, lab in ((116, 'N2'), (214, 'FF'), (284, 'OIL PRESS'), (344, 'OIL TEMP'), (404, 'OIL QTY %'), (464, 'VIB')): o += T(270, y, 16, lab, C)
    o += T(540, 110, 15, 'HYD P', C) + T(520, 140, 19, 'A  2980', W) + T(520, 166, 19, 'B  2990', W) + T(540, 220, 15, 'HYD Q %', C) + T(520, 250, 19, 'A  92', W) + T(520, 276, 19, 'B  94', W)
    return svg(620, 600, o)
def cdu():
    F2 = 'font-family="DejaVu Sans Mono" font-weight="bold"'; t = lambda x, y, s, tx, c=W, a='start': f'<text x="{x}" y="{y}" font-size="{s}" fill="{c}" text-anchor="{a}" {F2}>{tx}</text>'
    o = t(300, 46, 34, 'IDENT', W, 'middle') + t(590, 46, 22, '1/2', W, 'end')
    for i, (ll, lv, rl, rv) in enumerate((('MODEL', '737-800W', 'ENG RATING', '26K'), ('NAV DATA', 'BBD1261101', 'ACTIVE', 'NOV12DEC09/26'), ('', '', '', 'DEC10JAN06/27'), ('OP PROGRAM', '549849-015', '', ''), ('', '', 'SUPP DATA', 'NOV16/26'), ('', '&lt;INDEX', '', 'POS INIT&gt;'))):
        y = 100 + i * 74; o += t(24, y, 20, ll) + t(10, y + 34, 30, lv) + t(576, y, 20, rl, W, 'end') + t(590, y + 34, 30, rv, W, 'end')

    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 560" width="600" height="560"><rect width="600" height="560" fill="#020305"/>{o}</svg>'
for n, f in (('b_pfd', pfd), ('b_nd', nd), ('b_eicas', eicas), ('b_lower', lower), ('b_cdu', cdu)): open(f'/home/claude/rend/scr/{n}.svg', 'w').write(f())
print('ok')
