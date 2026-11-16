"""Our own drawings of what the A320 displays show (the 3D model has blank screens: the simulator paints them at run time).
Writes scr/<name>.svg; shots.py turns them into PNG for compose.py. State: on the ground at the gate, engines at idle."""
import math
G, C, A, W, M, Y, R = '#1FE04A', '#27D8F0', '#F5A21B', '#F2F5F8', '#E85CE0', '#F2E21B', '#F0342A'
F = 'font-family="DejaVu Sans Mono" font-weight="bold"'
def T(x, y, s, t, c=W, a='middle', extra=''): return f'<text x="{x}" y="{y}" font-size="{s}" fill="{c}" text-anchor="{a}" {F} {extra}>{t}</text>'
def L(x1, y1, x2, y2, c=W, w=2, extra=''): return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{w}" stroke-linecap="round" {extra}/>'
def svg(w, h, body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><rect width="{w}" height="{h}" fill="#04060A"/>{body}</svg>'
def pol(cx, cy, r, deg): a = math.radians(deg); return cx + r * math.sin(a), cy - r * math.cos(a)

def pfd():
    o = ['<defs><clipPath id="att"><path d="M150 150 H360 Q395 150 395 185 V355 Q395 390 360 390 H150 Q115 390 115 355 V185 Q115 150 150 150Z"/></clipPath><clipPath id="spd"><rect x="28" y="150" width="62" height="240"/></clipPath><clipPath id="alt"><rect x="418" y="150" width="58" height="240"/></clipPath><clipPath id="hdg"><rect x="125" y="428" width="260" height="42"/></clipPath></defs>']
    cy = 270
    o.append(f'<g clip-path="url(#att)"><rect x="100" y="100" width="320" height="{cy - 100}" fill="#1E8CE6"/><rect x="100" y="{cy}" width="320" height="200" fill="#7B4A1E"/>{L(100, cy, 420, cy, W, 2.5)}')
    for d, hw in ((2.5, 8), (5, 18), (7.5, 8), (10, 34), (12.5, 8), (15, 18), (20, 34)):
        for sg in (1, -1):
            y = cy - sg * d * 6.4; o.append(L(255 - hw, y, 255 + hw, y, W, 2))
            if d in (10, 20): o.append(T(255 - hw - 14, y + 6, 15, int(d))); o.append(T(255 + hw + 14, y + 6, 15, int(d)))
    o.append('</g>')
    for a in (-45, -30, -20, -10, 10, 20, 30, 45):
        x1, y1 = pol(255, cy, 126, a); x2, y2 = pol(255, cy, 138 if abs(a) in (30, 45) else 133, a); o.append(L(x1, y1, x2, y2, W, 2.2))
    o.append(f'<path d="M255 {cy - 124} l-9 -14 h18z" fill="none" stroke="{Y}" stroke-width="2.5"/><path d="M255 {cy - 121} l-8 12 h16z" fill="none" stroke="{Y}" stroke-width="2.5"/>')
    o.append(f'<path d="M165 {cy - 5} h58 v20 h-10 v-10 h-48z M345 {cy - 5} h-58 v20 h10 v-10 h48z" fill="#0A0A0A" stroke="{Y}" stroke-width="2.2"/><rect x="250" y="{cy - 5}" width="10" height="10" fill="#0A0A0A" stroke="{Y}" stroke-width="2.2"/>')
    o.append(L(255, cy - 60, 255, cy + 60, G, 2.4) + L(150, cy, 360, cy, G, 2.4))          # flight director bars
    # speed tape
    o.append(f'<rect x="28" y="150" width="62" height="240" fill="#585D66"/><g clip-path="url(#spd)">')
    for v in range(40, 121, 10):
        y = cy + 74 - (v - 40) * 3.6; o.append(L(78, y, 90, y, W, 2))
        if v % 20 == 0: o.append(T(72, y + 7, 19, f'{v:03d}', W, 'end'))
    o.append('</g>' + L(90, 150, 90, 390, W, 2) + L(20, cy, 100, cy, Y, 3) + f'<path d="M100 {cy} l12 -7 v14z" fill="{Y}"/>' + f'<rect x="88" y="{cy + 74}" width="8" height="46" fill="{R}"/>')
    o.append(T(60, 142, 19, '153', C))
    # altitude tape
    o.append(f'<rect x="418" y="150" width="58" height="240" fill="#585D66"/><g clip-path="url(#alt)">')
    for i, v in enumerate((2, 4, 6, 8, 10, 12)):
        y = cy + 60 - (v - 6) * 22; o.append(L(418, y, 428, y, W, 2)); o.append(T(470, y + 7, 18, f'{v:03d}', W, 'end') if abs(y - cy) > 26 else '')
    o.append('</g>' + L(476, 150, 476, 390, W, 2))
    o.append(f'<rect x="410" y="{cy - 17}" width="84" height="34" fill="#04060A" stroke="{Y}" stroke-width="2.2"/>' + T(456, cy + 9, 24, '006', G, 'end') + T(490, cy + 7, 17, '80', G, 'end'))
    o.append(T(447, 142, 19, '5000', C))
    # vertical speed
    o.append(f'<path d="M496 180 h18 l18 40 v100 l-18 40 h-18z" fill="#585D66"/>')
    for v, y in ((2, 205), (1, 237), (0, cy), (1, 303), (2, 335)): o.append(L(498, y, 506, y, W, 2)); o.append(T(494, y + 5, 12, v, W, 'end') if v else '')
    o.append(L(498, cy, 540, cy, G, 3))
    # heading tape
    o.append(f'<rect x="125" y="430" width="260" height="38" fill="#585D66"/><g clip-path="url(#hdg)">')
    for i in range(-6, 7):
        h = 264 + i * 5 - 4; x = 255 + (h - 264) * 5.2; big = h % 10 == 0; o.append(L(x, 430, x, 442 if big else 437, W, 2))
        if big: o.append(T(x, 462, 19, h // 10))
    o.append('</g>' + L(125, 430, 385, 430, W, 2) + L(255, 418, 255, 444, Y, 4))
    # FMA
    for x in (112, 214, 316, 418): o.append(L(x, 22, x, 96, '#AEB6BF', 1.6))
    o.append(T(163, 70, 19, 'CLB', C) + T(265, 70, 19, 'NAV', C) + T(480, 70, 19, '1FD2', W))
    o.append(T(430, 440, 17, 'QNH', W, 'start') + T(480, 440, 19, '1013', C, 'start'))
    return svg(545, 524, ''.join(o))

def nd():
    cx, cy, r = 272, 452, 330; o = []
    o.append(T(14, 30, 17, 'GS', W, 'start') + T(46, 30, 20, '0', G, 'start') + T(86, 30, 17, 'TAS', W, 'start') + T(126, 30, 20, '---', G, 'start') + T(14, 56, 18, '---/---', G, 'start'))
    o.append(T(531, 30, 19, 'OKSAT', W, 'end') + T(531, 54, 19, '251°', G, 'end') + T(488, 78, 19, '4.6', G, 'end') + T(531, 78, 14, 'NM', C, 'end') + T(531, 102, 19, '10:47', G, 'end'))
    o.append(f'<clipPath id="arc"><rect x="0" y="100" width="545" height="424"/></clipPath><g clip-path="url(#arc)">')
    o.append(f'<path d="M{pol(cx, cy, r, -52)[0]:.1f} {pol(cx, cy, r, -52)[1]:.1f} A{r} {r} 0 0 1 {pol(cx, cy, r, 52)[0]:.1f} {pol(cx, cy, r, 52)[1]:.1f}" fill="none" stroke="{W}" stroke-width="2.4"/>')
    for d in range(215, 316, 5):
        a = d - 264
        if abs(a) > 52: continue
        big = d % 10 == 0; x1, y1 = pol(cx, cy, r, a); x2, y2 = pol(cx, cy, r + (16 if big else 9), a); o.append(L(x1, y1, x2, y2, W, 2.2))
        if big: x, y = pol(cx, cy, r + 32, a); o.append(f'<g transform="rotate({a} {x:.1f} {y:.1f})">' + T(round(x, 1), round(y + (8 if d % 30 == 0 else 5), 1), 24 if d % 30 == 0 else 15, d // 10) + '</g>')
    for rr, lab in ((r * 0.25, ''), (r * 0.5, '10'), (r * 0.75, '')):
        a0, a1 = pol(cx, cy, rr, -58), pol(cx, cy, rr, 58); o.append(f'<path d="M{a0[0]:.1f} {a0[1]:.1f} A{rr:.1f} {rr:.1f} 0 0 1 {a1[0]:.1f} {a1[1]:.1f}" fill="none" stroke="{W}" stroke-width="1.6" stroke-dasharray="9 9"/>')
        if lab: x, y = pol(cx, cy, rr, -47); o.append(T(round(x - 14), round(y + 6), 16, lab, C)); x, y = pol(cx, cy, rr, 47); o.append(T(round(x + 14), round(y + 6), 16, lab, C))
    P = [(cx, cy), pol(cx, cy, 76, -13), pol(cx, cy, 196, -13), pol(cx, cy, 300, 9)]
    o.append('<polyline points="' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in P) + f'" fill="none" stroke="{G}" stroke-width="2.6"/>')
    for (x, y), nm in zip(P[1:], ('OKSAT', 'BBD01', 'TUVIT')): o.append(f'<path d="M{x:.1f} {y - 8:.1f} l8 8 l-8 8 l-8 -8z" fill="none" stroke="{G if nm != "OKSAT" else W}" stroke-width="2.2"/>' + T(round(x + 14), round(y + 6), 16, nm, W if nm == 'OKSAT' else G, 'start'))
    o.append('</g>' + L(cx, cy - r - 22, cx, cy - r + 14, Y, 4))
    o.append(L(cx, cy - 26, cx, cy + 30, Y, 3.4) + L(cx - 26, cy - 6, cx + 26, cy - 6, Y, 3.4) + L(cx - 11, cy + 22, cx + 11, cy + 22, Y, 3.4))
    o.append(T(14, 492, 16, 'VOR1', W, 'start') + T(14, 512, 16, 'TRO', W, 'start') + T(531, 492, 16, 'VOR2', W, 'end') + T(531, 512, 16, 'GRM', W, 'end'))
    return svg(545, 524, ''.join(o))

def gauge(cx, cy, r, frac, val, red=True):
    a0, a1 = -135, 90; o = []
    p0, p1 = pol(cx, cy, r, a0), pol(cx, cy, r, a1); o.append(f'<path d="M{p0[0]:.1f} {p0[1]:.1f} A{r} {r} 0 1 1 {p1[0]:.1f} {p1[1]:.1f}" fill="none" stroke="{W}" stroke-width="2.6"/>')
    if red: q0, q1 = pol(cx, cy, r, 62), pol(cx, cy, r, 90); o.append(f'<path d="M{q0[0]:.1f} {q0[1]:.1f} A{r} {r} 0 0 1 {q1[0]:.1f} {q1[1]:.1f}" fill="none" stroke="{R}" stroke-width="5"/>')
    a = a0 + (a1 - a0) * frac; x, y = pol(cx, cy, r + 5, a); o.append(L(cx, cy, x, y, G, 3.2))
    o.append(f'<rect x="{cx + 2}" y="{cy + 4}" width="{r + 12}" height="26" fill="#04060A" stroke="#AEB6BF" stroke-width="1.6"/>' + T(cx + r + 10, cy + 25, 21, val, G, 'end'))
    return ''.join(o)
def ewd():
    o = []
    for cx in (150, 372):
        o.append(gauge(cx, 92, 52, 0.19, '19.5')); o.append(gauge(cx, 212, 40, 0.42, '430', False))
        for d, lab in ((0.42, '5'), (0.86, '10')): x, y = pol(cx, 92, 38, -135 + 225 * d); o.append(T(round(x), round(y + 6), 14, lab))
    o.append(T(261, 82, 17, 'N1') + T(261, 100, 14, '%', C) + T(261, 206, 17, 'EGT') + T(261, 224, 14, '°C', C))
    o.append(T(261, 286, 17, 'N2') + T(261, 304, 14, '%', C) + T(261, 328, 17, 'FF') + T(261, 346, 14, 'KG/H', C))
    for cx in (150, 372): o.append(T(cx + 34, 298, 21, '58.4', G, 'end') + T(cx + 34, 340, 21, '300', G, 'end')); o.append((L(194, 290, 222, 284, '#AEB6BF', 1.4) + L(194, 332, 228, 326, '#AEB6BF', 1.4)) if cx < 261 else (L(300, 284, 336, 290, '#AEB6BF', 1.4) + L(294, 326, 336, 332, '#AEB6BF', 1.4)))
    o.append(T(470, 40, 18, 'TOGA', C, 'start') + T(470, 66, 21, '89.6', G, 'start') + T(530, 66, 14, '%', C, 'start'))
    o.append(T(440, 300, 17, 'FOB :', W, 'start') + T(440, 326, 21, '6200', G, 'start') + T(500, 326, 14, 'KG', C, 'start'))
    o.append(T(470, 150, 16, 'FLAP', W) + T(432, 150, 16, 'S', W) + T(508, 150, 16, 'F', W) + f'<path d="M448 170 h44 l10 8 h-64z" fill="#8A929B"/>' + T(470, 206, 19, '0', G))
    o.append(L(8, 372, 350, 372, W, 2) + L(372, 372, 550, 372, W, 2) + L(361, 384, 361, 516, W, 2))
    o.append(T(16, 404, 19, 'SEAT BELTS', G, 'start') + T(16, 430, 19, 'NO SMOKING', G, 'start') + T(374, 404, 19, 'PARK BRK', G, 'start'))
    return svg(558, 526, ''.join(o))

def sd():
    o = [T(16, 34, 21, 'DOOR/OXY', W, 'start') + L(16, 40, 122, 40, W, 2) + T(360, 34, 17, 'OXY', W, 'start') + T(404, 34, 21, '1850', G, 'start') + T(462, 34, 14, 'PSI', C, 'start')]
    o.append(f'<path d="M279 60 C250 78 244 120 244 150 V372 C244 396 262 416 279 426 C296 416 314 396 314 372 V150 C314 120 308 78 279 60Z" fill="none" stroke="#AEB6BF" stroke-width="2.2"/>')
    o.append(f'<path d="M244 212 L150 262 V280 L244 258 M314 212 L408 262 V280 L314 258" fill="none" stroke="#AEB6BF" stroke-width="2.2"/>')
    for y in (112, 384):
        for x in (246, 300): o.append(f'<rect x="{x}" y="{y}" width="12" height="20" fill="none" stroke="{G}" stroke-width="2.2"/>')
    for y in (196, 276): o.append(f'<rect x="248" y="{y}" width="9" height="12" fill="none" stroke="{G}" stroke-width="2"/><rect x="301" y="{y}" width="9" height="12" fill="none" stroke="{G}" stroke-width="2"/>')
    o.append(f'<rect x="296" y="160" width="14" height="16" fill="none" stroke="{G}" stroke-width="2"/><rect x="296" y="318" width="14" height="16" fill="none" stroke="{G}" stroke-width="2"/><rect x="273" y="72" width="12" height="9" fill="none" stroke="{G}" stroke-width="2"/>')
    o.append(L(8, 452, 550, 452, W, 2) + L(190, 460, 190, 518, W, 2) + L(368, 460, 368, 518, W, 2))
    o.append(T(16, 482, 17, 'TAT', W, 'start') + T(118, 482, 19, '+15', G, 'end') + T(124, 482, 14, '°C', C, 'start') + T(16, 508, 17, 'SAT', W, 'start') + T(118, 508, 19, '+15', G, 'end') + T(124, 508, 14, '°C', C, 'start'))
    o.append(T(258, 508, 21, '10', G, 'end') + T(264, 508, 14, 'H', C, 'start') + T(280, 508, 21, '42', G, 'start'))
    o.append(T(380, 482, 17, 'GW', W, 'start') + T(486, 482, 19, '62400', G, 'end') + T(492, 482, 14, 'KG', C, 'start'))
    return svg(558, 526, ''.join(o))

def mcdu():
    o = []; X0, X1 = 10, 576; rows = [('CO RTE', 'BBDENGMBR1', C, 'FROM/TO', 'ENGM/ENBR', C), ('ALTN/CO RTE', 'ENZV', C, '', '', C), ('FLT NBR', 'BBD123', C, '', '', C),
                                    ('', '', C, 'WIND/TEMP&gt;', '', W), ('COST INDEX', '25', C, 'TROPO', '36090', C), ('CRZ FL/TEMP', 'FL240/-33°', C, 'GND TEMP', '+15°', C)]
    o.append(T(293, 44, 34, 'INIT') + T(566, 44, 30, '←→', W, 'end'))
    for i, (ll, lv, lc, rl, rv, rc) in enumerate(rows):
        y = 96 + i * 76
        o.append(T(X0 + 14, y, 22, ll, W, 'start') + T(X0, y + 36, 33, lv, lc, 'start'))
        if rl.endswith('&gt;'): o.append(T(X1, y + 36, 33, rl, W, 'end'))
        else: o.append(T(X1 - 14, y, 22, rl, W, 'end') + T(X1, y + 36, 33, rv, rc, 'end'))
    return svg(586, 550, ''.join(o))

def isis():
    cy = 80; o = ['<defs><clipPath id="i"><rect x="44" y="22" width="100" height="116"/></clipPath></defs>']
    o.append(f'<g clip-path="url(#i)"><rect x="40" y="0" width="110" height="{cy}" fill="#1E8CE6"/><rect x="40" y="{cy}" width="110" height="100" fill="#7B4A1E"/>{L(40, cy, 150, cy, W, 2)}')
    for d, hw in ((5, 8), (10, 16)):
        for sg in (1, -1): o.append(L(94 - hw, cy - sg * d * 3.2, 94 + hw, cy - sg * d * 3.2, W, 1.5))
    o.append('</g>' + f'<path d="M62 {cy} h20 v6 M126 {cy} h-20 v6" fill="none" stroke="{Y}" stroke-width="2.6"/><rect x="92" y="{cy - 2}" width="4" height="4" fill="{Y}"/>')
    o.append(f'<rect x="6" y="22" width="36" height="116" fill="#585D66"/><rect x="146" y="22" width="38" height="116" fill="#585D66"/>')
    for i, v in enumerate((40, 60, 80)): o.append(T(38, 118 - i * 30, 11, v, W, 'end'))
    o.append(f'<rect x="140" y="{cy - 9}" width="46" height="18" fill="#04060A" stroke="{Y}" stroke-width="1.4"/>' + T(184, cy + 5, 12, '680', G, 'end'))
    o.append(T(94, 164, 13, '1013', C) + L(2, cy, 44, cy, Y, 2))
    return svg(188, 176, ''.join(o))

import os
for n, f in (('pfd', pfd), ('nd', nd), ('ewd', ewd), ('sd', sd), ('mcdu', mcdu), ('isis', isis)): open(f'/home/claude/rend/scr/{n}.svg', 'w').write(f())
print('ok')
