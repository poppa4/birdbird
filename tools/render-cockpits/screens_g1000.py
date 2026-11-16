"""Our own drawings of a G1000-style PFD and MFD (on the ground, engines running), for the DA42. Writes scr/g_pfd.svg, scr/g_mfd.svg."""
import math
G, C, W, M, Y, R, GY = '#22E04C', '#27D8F0', '#F2F5F8', '#E85CE0', '#F2E21B', '#F0342A', '#B8C0C8'
F = 'font-family="DejaVu Sans" font-weight="bold"'
def T(x, y, s, t, c=W, a='middle', extra=''): return f'<text x="{x}" y="{y}" font-size="{s}" fill="{c}" text-anchor="{a}" {F} {extra}>{t}</text>'
def L(x1, y1, x2, y2, c=W, w=2): return f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{w}" stroke-linecap="round"/>'
def B(x, y, w, h, f='#000', s=None, sw=1.5, rx=0, op=1): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{f}" fill-opacity="{op}"' + (f' stroke="{s}" stroke-width="{sw}"' if s else '') + '/>'
def pol(cx, cy, r, deg): a = math.radians(deg); return cx + r * math.sin(a), cy - r * math.cos(a)
def svg(body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768"><rect width="1024" height="768" fill="#000"/>{body}</svg>'
def topbar(mid):
    o = B(0, 0, 1024, 56, '#0B0E12') + L(0, 56, 1024, 56, GY, 1.5) + L(250, 0, 250, 56, GY, 1.5) + L(774, 0, 774, 56, GY, 1.5)
    o += T(10, 24, 17, 'NAV1', W, 'start') + T(70, 24, 19, '113.80', W, 'start') + T(170, 24, 19, '110.30', C, 'start') + T(10, 48, 17, 'NAV2', W, 'start') + T(70, 48, 19, '116.00', W, 'start') + T(170, 48, 19, '115.95', W, 'start')
    o += T(780, 24, 17, '118.100', G, 'start') + T(868, 24, 17, '121.800', C, 'start') + T(1018, 23, 13, 'COM1', W, 'end') + T(780, 48, 17, '119.000', W, 'start') + T(868, 48, 17, '120.450', W, 'start') + T(1018, 47, 13, 'COM2', W, 'end')
    return o + mid
def softkeys(labels):
    o = B(0, 738, 1024, 30, '#0B0E12') + L(0, 738, 1024, 738, GY, 1.5)
    for i, t in enumerate(labels):
        x = 1024 / 12 * (i + .5)
        if t: o += T(round(x), 760, 15, t)
        if i: o += L(1024 / 12 * i, 742, 1024 / 12 * i, 766, '#5A626B', 1)
    return o
def pfd():
    hy = 300; o = B(0, 0, 1024, hy, '#2E7FDB') + B(0, hy, 1024, 468, '#6B4A1E') + L(0, hy, 1024, hy, W, 3)
    cx = 512
    for d, hw in ((2.5, 18), (5, 34), (7.5, 18), (10, 62), (15, 34), (20, 62)):
        for sg in (1, -1):
            y = hy - sg * d * 11; o += L(cx - hw, y, cx + hw, y, W, 2.5)
            if d in (10, 20): o += T(cx - hw - 22, y + 7, 19, int(d)) + T(cx + hw + 22, y + 7, 19, int(d))
    for a in (-60, -45, -30, -20, -10, 10, 20, 30, 45, 60):
        x1, y1 = pol(cx, hy, 205, a); x2, y2 = pol(cx, hy, 228 if abs(a) in (30, 60) else 217, a); o += L(x1, y1, x2, y2, W, 3)
    o += f'<path d="M{cx} {hy - 205} l-12 -20 h24z" fill="{W}"/><path d="M{cx} {hy - 203} l-11 18 h22z" fill="{W}"/>'
    o += f'<path d="M{cx} {hy} l-120 42 h60z M{cx} {hy} l120 42 h-60z" fill="{Y}" stroke="#000" stroke-width="1.5"/>' + B(cx - 280, hy - 5, 70, 10, Y, '#000') + B(cx + 210, hy - 5, 70, 10, Y, '#000')
    o += topbar(B(250, 0, 524, 56, '#0B0E12') + L(250, 28, 774, 28, GY, 1) + T(262, 22, 17, 'ENGM', M, 'start') + T(330, 22, 17, '→ OKSAT', M, 'start') + T(520, 22, 17, 'DIS', W, 'start') + T(562, 22, 17, '4.6NM', M, 'start') + T(660, 22, 17, 'BRG', W, 'start') + T(706, 22, 17, '251°', M, 'start') + T(300, 49, 17, 'GPS', M) + T(512, 49, 17, 'ROL', G) + T(680, 49, 17, 'PIT', G))
    # airspeed tape
    o += B(150, 120, 96, 360, '#2A2F36', GY, 1.5, 0, .78)
    for v in range(20, 101, 10):
        y = hy + 150 - (v - 20) * 3.6; o += L(232, y, 246, y, W, 2.5)
        if v % 20 == 0 and abs(y - hy) > 30: o += T(222, y + 8, 22, v, W, 'end')
    o += B(240, hy + 60, 8, 120, R) + f'<path d="M150 {hy - 24} h70 l14 24 l-14 24 h-70z" fill="#000" stroke="{GY}" stroke-width="1.5"/>' + T(214, hy + 11, 30, '---', W, 'end') + B(150, 480, 96, 30, '#000', GY) + T(160, 502, 17, 'TAS', W, 'start') + T(240, 502, 19, '0KT', W, 'end')
    # altitude tape
    o += B(770, 120, 110, 360, '#2A2F36', GY, 1.5, 0, .78) + B(770, 90, 110, 30, '#000', GY) + T(872, 112, 21, '5000', C, 'end')
    for i in range(-3, 4):
        v = 700 + i * 100; y = hy - i * 52; o += L(770, y, 786, y, W, 2.5)
        if abs(y - hy) > 32: o += T(870, y + 8, 21, v, W, 'end')
    o += f'<path d="M880 {hy - 24} h-84 l-14 24 l14 24 h84z" fill="#000" stroke="{GY}" stroke-width="1.5"/>' + T(848, hy + 11, 28, '6', W, 'end') + T(876, hy + 9, 21, '80', W, 'end') + B(770, 480, 110, 30, '#000', GY) + T(872, 502, 19, '1013 HPA', C, 'end')
    o += f'<path d="M888 150 h28 l22 60 v180 l-22 60 h-28z" fill="#2A2F36" fill-opacity=".78" stroke="{GY}" stroke-width="1.5"/>' + f'<path d="M896 {hy} l14 -12 h40 v24 h-40z" fill="#000" stroke="{GY}" stroke-width="1.2"/>'
    for v, y in ((2, 190), (1, 245), (1, 355), (2, 410)): o += L(890, y, 904, y, W, 2) + T(908, y + 6, 15, v, W, 'start')
    # HSI
    hx, hyy, r = 512, 590, 150; o += f'<circle cx="{hx}" cy="{hyy}" r="{r}" fill="#20262C" fill-opacity=".85"/>'
    for d in range(0, 360, 5):
        a = d - 264; big = d % 10 == 0; x1, y1 = pol(hx, hyy, r, a); x2, y2 = pol(hx, hyy, r - (16 if big else 9), a); o += L(x1, y1, x2, y2, W, 2)
        if d % 30 == 0: x, y = pol(hx, hyy, r - 34, a); lab = {0: 'N', 90: 'E', 180: 'S', 270: 'W'}.get(d, d // 10); o += f'<g transform="rotate({a} {x:.1f} {y:.1f})">' + T(round(x, 1), round(y + 8, 1), 22, lab) + '</g>'
    o += B(hx - 34, hyy - r - 40, 68, 32, '#000', GY) + T(hx, hyy - r - 16, 22, '264°') + f'<path d="M{hx} {hyy - r + 2} l-9 -12 h18z" fill="{W}"/>'
    o += f'<g transform="rotate(-13 {hx} {hyy})">' + L(hx, hyy - r + 24, hx, hyy - 58, M, 5) + L(hx, hyy + 58, hx, hyy + r - 24, M, 5) + L(hx + 10, hyy - 50, hx + 10, hyy + 50, M, 5) + f'<path d="M{hx} {hyy - r + 20} l-11 20 h22z" fill="{M}"/>' + '</g>'
    o += L(hx, hyy - 22, hx, hyy + 24, W, 4) + L(hx - 22, hyy - 4, hx + 22, hyy - 4, W, 4) + L(hx - 9, hyy + 18, hx + 9, hyy + 18, W, 4)
    o += B(330, 438, 100, 28, '#000', GY) + T(338, 459, 16, 'HDG', W, 'start') + T(424, 459, 19, '264°', C, 'end') + B(594, 438, 100, 28, '#000', GY) + T(602, 459, 16, 'CRS', W, 'start') + T(688, 459, 19, '251°', M, 'end')
    o += B(4, 690, 200, 44, '#000', GY) + T(12, 710, 16, 'OAT', W, 'start') + T(60, 710, 18, '15°C', W, 'start') + B(780, 690, 240, 44, '#000', GY) + T(790, 718, 17, 'XPDR', W, 'start') + T(856, 718, 20, '7000', G, 'start') + T(912, 718, 15, 'ALT', G, 'start') + T(1014, 718, 14, '10:42', W, 'end')
    o += softkeys(['', 'INSET', '', 'PFD', 'OBS', 'CDI', 'DME', 'XPDR', 'IDENT', 'TMR/REF', 'NRST', 'ALERTS'])
    return svg(o)
def bar(x, y, w, frac, lab, val, unit=''):
    o = T(x, y - 6, 15, lab, W, 'start') + T(x + w, y - 6, 17, val + unit, W, 'end') + B(x, y, w, 9, 'none', GY, 1.2) + B(x + w * .12, y + 1.5, w * .7, 6, G)
    return o + f'<path d="M{x + w * frac:.1f} {y + 11} l-7 12 h14z" fill="{W}"/>'
def mfd():
    o = B(0, 56, 1024, 682, '#16324A')
    o += f'<path d="M150 56 H1024 V330 C900 300 860 380 760 370 C680 362 650 300 560 320 C470 340 440 430 330 420 C250 412 200 360 150 370Z" fill="#3E6B3A"/><path d="M150 560 C260 540 330 600 450 590 C560 580 600 520 720 540 C840 560 900 640 1024 620 V738 H150Z" fill="#4A7541"/>'
    o += f'<path d="M150 470 C300 450 420 520 600 470 S900 430 1024 470" fill="none" stroke="#7FB4E0" stroke-width="5"/>'
    mx, my = 590, 430
    o += f'<circle cx="{mx}" cy="{my}" r="150" fill="none" stroke="{W}" stroke-width="1.5" stroke-dasharray="6 6"/>' + T(mx + 112, my - 104, 15, '5NM', C, 'start')
    P = [(mx, my), pol(mx, my, 110, -40), pol(mx, my, 260, -20), pol(mx, my, 360, 25)]
    o += '<polyline points="' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in P) + f'" fill="none" stroke="{M}" stroke-width="5"/>'
    for (x, y), nm in zip(P[1:], ('OKSAT', 'BBD01', 'TUVIT')): o += f'<path d="M{x:.1f} {y - 9:.1f} l9 9 l-9 9 l-9 -9z" fill="#000" stroke="{W}" stroke-width="2"/>' + T(round(x + 15), round(y + 6), 16, nm, W, 'start')
    o += f'<g transform="rotate(-40 {mx} {my})">' + L(mx, my - 20, mx, my + 20, W, 4) + L(mx - 18, my - 2, mx + 18, my - 2, W, 4) + L(mx - 8, my + 16, mx + 8, my + 16, W, 4) + '</g>'
    o += B(940, 70, 70, 34, '#000', GY) + T(975, 94, 17, 'NORTH UP') if False else T(990, 92, 18, 'N') + f'<path d="M990 62 l-7 14 h14z" fill="{W}"/>'
    o += B(160, 66, 300, 26, '#000', GY, 1, 0, .7) + T(170, 85, 16, 'MAP - NAVIGATION MAP', W, 'start')
    # engine strip (two engines)
    o += B(0, 56, 150, 682, '#0B0E12') + L(150, 56, 150, 738, GY, 1.5)
    y = 96
    for lab, val, fr in (('LOAD %', '8', .1), ('RPM', '890', .25), ('FUEL FLOW GPH', '0.6', .1), ('OIL TEMP', '82', .5), ('OIL PRES', '4.1', .55), ('COOLANT', '78', .5), ('GEARBOX', '64', .4)):
        o += T(75, y - 24, 13, lab, GY); o += bar(8, y + 6, 62, fr, 'L', val) + bar(80, y + 6, 62, fr, 'R', val); y += 74
    o += T(75, y - 24, 13, 'FUEL QTY GAL', GY) + bar(8, y + 6, 62, .6, 'L', '18') + bar(80, y + 6, 62, .6, 'R', '18') + T(75, y + 70, 14, 'VOLTS', GY) + T(40, y + 92, 18, '28.1') + T(112, y + 92, 18, '28.1')
    o += topbar(B(250, 0, 524, 56, '#0B0E12') + L(250, 28, 774, 28, GY, 1) + T(262, 22, 17, 'GS', W, 'start') + T(296, 22, 17, '0KT', M, 'start') + T(390, 22, 17, 'DTK', W, 'start') + T(436, 22, 17, '251°', M, 'start') + T(530, 22, 17, 'TRK', W, 'start') + T(576, 22, 17, '264°', M, 'start') + T(660, 22, 17, 'ETE', W, 'start') + T(706, 22, 17, '__:__', M, 'start') + T(512, 49, 17, 'ENGM → ENBR', W))
    o += softkeys(['ENGINE', '', 'MAP', '', '', '', '', '', '', 'DCLTR', 'SHW CHRT', 'CHKLIST'])
    return svg(o)
open('/home/claude/rend/scr/g_pfd.svg', 'w').write(pfd()); open('/home/claude/rend/scr/g_mfd.svg', 'w').write(mfd()); print('ok')
