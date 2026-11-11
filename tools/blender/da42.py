"""DA42-class (four-seat composite twin: centre sticks, one-piece bubble canopy) cockpit → models/da42-cockpit.glb

Run:  python3 tools/blender/da42.py [outdir] [--no-render]
Cockpit frame (same as da42-3d.js / cockpit3d.js): metres, x right, y up, z aft; origin on the centre line at the cabin
reference height, 9 cm below the left-seat design eye. Proportions: see SOURCES.md.
Live panel drawing: da42panel.js (1600 × 980 units, 0.00074 m per unit, top leaning 10° away), placed as da42-3d.js does;
the engine-control console (drawing rect 560,760 480×220) lies in the same plane, below the panel, as in the app.
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import cocklib as C
import parts as Pt
from cocklib import Geo, grid, rbox, box, tube, lathe, prism, T, RX, RY, RZ, M, basis, xf, v3, nrm, D2R
from parts import SubPlane, sstep

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(os.path.dirname(__file__), '../../models')
RENDER = '--no-render' not in sys.argv
TEX = os.environ.get('COCKPIT_TEX', '/tmp/blender3d/tex')
SHOTS = os.environ.get('COCKPIT_SHOTS', '/tmp/gltfshots')
PANEL_IMG = os.environ.get('PANEL_IMG_DA42', '/tmp/blender3d/da42_full.png')

PS, TILT = 0.00074, 10
ZF, ZR, YS, YF, WW = -1.15, 1.65, -0.33, -1.05, 0.62
EYE_L, EYE_R = (-0.27, 0.09, 0.0), (0.27, 0.09, 0.0)
_PO = v3(-0.592, -0.010, -0.79)
_EX = v3(PS, 0, 0); _EY = v3(0, -PS * math.cos(TILT * D2R), PS * math.sin(TILT * D2R))


def qb(p0, c, p1, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1])


# panel outline top edge (da42-3d.js panel backing shape), sampled
LIP = [qb((18, 250), (18, 140), (130, 118), i / 6) for i in range(7)] + [qb((130, 118), (800, 46), (1470, 118), i / 24) for i in range(1, 25)] + \
      [qb((1470, 118), (1582, 140), (1582, 250), i / 6) for i in range(1, 7)]


def topv(u):
    us = [p[0] for p in LIP]; vs = [p[1] for p in LIP]
    return float(np.interp(u, us, vs))


def rect_center(r):
    return _PO + _EX * (r[0] + r[2] / 2) + _EY * (r[1] + r[3] / 2)


R_MAIN = [18, 82, 1564, 688]
R_PED = [560, 760, 480, 220]
MAIN = SubPlane(R_MAIN, PS, list(rect_center(R_MAIN)), pitch=-TILT)
PED = SubPlane(R_PED, PS, list(rect_center(R_PED)), pitch=-TILT)


def pp(u, v, o=0.0):
    return MAIN.p(u, v, o)


def cw(z):
    return 0.5 + 0.12 * sstep(0, 1, (z - ZF) / 0.3) if z < -0.85 else (WW - 0.1 * sstep(0, 1, (z - 1.0) / 0.65) if z > 1.0 else WW)


def ct(z):
    if z < -0.2:
        t = max(0, (z - ZF) / 0.95); return -0.06 + 0.34 * (1 - (1 - t) * (1 - t))
    if z < 0.7:
        return 0.28
    return 0.28 - 0.36 * min(1, (z - 0.7) / 0.95) ** 1.7


def spw(w, e):
    return math.copysign(abs(w) ** e, w)


def canopy(z, a):
    th = a * math.pi / 2; w = cw(z); t = ct(z)
    return v3(w * spw(math.sin(th), 0.75), YS + (t - YS) * abs(math.cos(th)) ** 0.75, z)


MATS = {
    'trim':      dict(color=(0.76, 0.74, 0.70), rough=0.65, tex='plastic', tile=0.15, nstr=0.6),
    'trim_dark': dict(color=(0.58, 0.57, 0.54), rough=0.7, tex='plastic', tile=0.15, nstr=0.6),
    'frame':     dict(color=(0.84, 0.83, 0.80), rough=0.5, tex='plastic', tile=0.15, nstr=0.3),
    'glareshield': dict(color=(0.05, 0.055, 0.06), rough=0.85, tex='leather', tile=0.18, nstr=0.8),
    'panel_body': dict(color=(0.13, 0.14, 0.15), rough=0.55, tex='plastic', tile=0.15, nstr=0.35),
    'console':   dict(color=(0.15, 0.16, 0.18), rough=0.6, tex='plastic', tile=0.15, nstr=0.4),
    'carpet':    dict(color=(0.20, 0.20, 0.21), rough=0.97, tex='carpet', tile=0.25, nstr=1.0),
    'well':      dict(color=(0.10, 0.10, 0.11), rough=0.9, tex='carpet', tile=0.25, nstr=0.6),
    'leather':   dict(color=(0.20, 0.22, 0.25), rough=0.5, tex='leather', tile=0.12, nstr=0.55),
    'leather_dark': dict(color=(0.12, 0.12, 0.13), rough=0.55, tex='leather', tile=0.12, nstr=0.5),
    'seat_shell': dict(color=(0.70, 0.69, 0.66), rough=0.45),
    'alu':       dict(color=(0.62, 0.63, 0.65), rough=0.42, metal=0.55, tex='metal', tile=0.2, nstr=0),
    'chrome':    dict(color=(0.78, 0.78, 0.80), rough=0.22, metal=0.6),
    'steel_dark': dict(color=(0.22, 0.23, 0.24), rough=0.5, metal=0.5),
    'black':     dict(color=(0.035, 0.035, 0.04), rough=0.42),
    'black_matte': dict(color=(0.045, 0.045, 0.05), rough=0.8, tex='plastic', tile=0.1, nstr=0.4),
    'rubber':    dict(color=(0.03, 0.03, 0.03), rough=0.92),
    'knob_black': dict(color=(0.03, 0.03, 0.033), rough=0.35),
    'red':       dict(color=(0.70, 0.12, 0.08), rough=0.4),
    'white':     dict(color=(0.88, 0.88, 0.86), rough=0.35),
    'pedal':     dict(color=(0.16, 0.17, 0.18), rough=0.5, metal=0.4),
    'strap':     dict(color=(0.30, 0.32, 0.36), rough=0.9, tex='fabric', tile=0.12, nstr=0.8),
    'skin':      dict(color=(0.95, 0.95, 0.94), rough=0.3, ao=False),
    'skin_under': dict(color=(0.84, 0.84, 0.83), rough=0.45, ao=False),
    'prop':      dict(color=(0.05, 0.05, 0.05), rough=0.5, ao=False),
    'panel_face': dict(color=(1, 1, 1), rough=0.6, ao=False, tex='panelph', nstr=0),
    'glass':     dict(color=(0.80, 0.86, 0.90), rough=0.05, alpha=0.10, double=True, ao=False),
}
SEATM = dict(cover='leather', side='leather_dark', shell='seat_shell', metal='steel_dark')
SEAT_Z = -0.12


def shell():
    g = Geo(); cab = v3(0, -0.35, 0.2)
    grid(g, 12, 28, lambda u, v: (-0.6 + u * 1.2, YF, ZF + v * (ZR - ZF)), 'carpet', toward=cab)
    grid(g, 12, 8, lambda u, v: (-0.6 + u * 1.2, YF + v * (YS - YF + 0.05), ZF), 'well', toward=cab)
    for sd in (-1, 1):
        prof = [(0.60, YF), (0.585, -0.80), (0.565, -0.55), (0.55, -0.40), (0.55, YS)]
        def wall(u, v):
            z = ZF + u * (ZR - ZF); f = v * (len(prof) - 1); i = min(len(prof) - 2, int(f)); t = f - i
            return (sd * (prof[i][0] + (prof[i + 1][0] - prof[i][0]) * t), prof[i][1] + (prof[i + 1][1] - prof[i][1]) * t, z)
        grid(g, 28, 8, wall, 'trim', toward=cab)
        grid(g, 28, 2, lambda u, v: (sd * (min(0.55, cw(ZF + u * (ZR - ZF)) - 0.005) + (0.68 - min(0.55, cw(ZF + u * (ZR - ZF)) - 0.005)) * v), YS, ZF + u * (ZR - ZF)), 'trim_dark', toward=v3(0, 0.4, 0))
        rbox(g, (0.06, 0.05, 0.44), (0.02, 0.02, 0.03), 'leather_dark', m=T(sd * 0.53, -0.40, 0.12), seg=3, flat=(2, 1, 4))
        rbox(g, (0.02, 0.24, 0.42), 0.008, 'trim_dark', m=T(sd * 0.574, -0.74, -0.29), seg=2, flat=1)
        # canopy sill rail
        rail = [canopy(ZF + 0.02 + i / 28 * (ZR - ZF - 0.04), sd) + v3(sd * 0.005, -0.012, 0) for i in range(29)]
        tube(g, rail, 0.028, 'frame', sides=8, ry=0.018, up=v3(0, 1, 0))
        # hood cheeks beside the panel down to the sill
        top = pp(18 if sd < 0 else 1582, 250, -0.003)
        grid(g, 6, 6, lambda u, v: (sd * (0.585 + 0.03 * u), (top[1] + (canopy(ZF + 0.01, sd)[1] - top[1]) * u) * (1 - v) + YS * v, -0.76 - u * 0.39), 'trim', toward=cab)
        # fresh-air outlet
        lathe(g, [(0, 0), (0.028, 0), (0.028, 0.01), (0.02, 0.016), (0, 0.016)], 'black', seg=16, m=M(T(sd * 0.56, -0.30, -0.62), RZ(sd * math.pi / 2)))
        x0 = sd * 0.27
        Pt.harness(g, v3(x0 + sd * 0.10, 0.05, SEAT_Z + 0.55), v3(x0 + sd * 0.10, -0.10, SEAT_Z + 0.40), v3(x0 + sd * 0.02, -0.48, SEAT_Z + 0.18),
                   v3(x0 - sd * 0.08, -0.74, SEAT_Z + 0.06), 'strap', 'alu')
    # canopy bows: roll-over bar and rear bow; windshield base seal; canopy handle; rear bulkhead
    for z, w in ((0.47, 0.045), (1.60, 0.035)):
        tube(g, [canopy(z, -1 + i / 15) + v3(0, -0.01, 0) for i in range(31)], w, 'frame', sides=8, ry=0.03, up=v3(0, 0, 1))
    tube(g, [canopy(ZF + 0.015, -1 + i / 12) for i in range(25)], 0.016, 'black', sides=6)
    top = canopy(0.47, 0)
    rbox(g, (0.16, 0.022, 0.028), 0.006, 'black', m=T(0, top[1] - 0.075, 0.40), seg=2, flat=1)
    for sx in (-0.06, 0.06):
        rbox(g, (0.02, 0.03, 0.02), 0.005, 'black', m=T(sx, top[1] - 0.055, 0.42), seg=1, flat=1)
    rbox(g, (0.022, 0.02, 0.10), 0.005, 'steel_dark', m=T(-0.575, -0.305, -0.02), seg=1, flat=1)
    def bulk(u, v):
        a = -1 + 2 * u; p = canopy(ZR, a); y = YF + v * (p[1] - 0.01 - YF)
        return (p[0] if v > 0.5 else cw(ZR) * a, y, ZR - 0.02)
    grid(g, 12, 6, bulk, 'trim_dark', toward=cab)
    # centre console between the seats (behind the engine-control console)
    w = 0.15
    prism(g, [(-w, YF), (-w, -0.76), (-w + 0.04, -0.72), (w - 0.04, -0.72), (w, -0.76), (w, YF)], 0.98, 'console', m=T(0, 0, -0.18))
    rbox(g, (0.2, 0.012, 0.5), 0.004, 'black_matte', m=T(0, -0.715, -0.05), seg=1, flat=1)
    # stick boots
    for xc in (-0.27, 0.27):
        lathe(g, [(0, 0), (0.075, 0), (0.06, 0.03), (0.03, 0.07), (0.014, 0.085), (0, 0.085)], 'rubber', seg=16, m=T(xc, YF, -0.42))
    panel_body(g)
    for xc in (-0.27, 0.27):
        Pt.seat(g, xc, SEAT_Z, YF, SEATM, cush_y=-0.80, w=0.43, back_h=0.66, recline=18, headrest=True)
    for xc in (-0.27, 0.27):
        Pt.seat(g, xc, 0.98, YF, SEATM, cush_y=-0.85, w=0.42, back_h=0.60, recline=20, headrest=False, pleats=3)
    return g


def panel_body(g):
    cab = v3(0, -0.35, 0.2)
    # backing behind the face
    grid(g, 30, 1, lambda a, b: pp(18 + a * 1564, topv(18 + a * 1564) + b * (770 - topv(18 + a * 1564)), 0.012), 'panel_body', toward=cab)
    grid(g, 4, 1, lambda a, b: pp(560 + a * 480, 760 + b * 220, 0.012), 'console', toward=cab)
    # console sides (box behind the engine-control face down to the floor)
    for sd, u0 in ((-1, 560), (1, 1040)):
        grid(g, 1, 4, lambda a, b: pp(u0, 760 + b * 220, 0.0) + v3(0, 0, -0.30 * a), 'console', toward=cab)
    grid(g, 4, 1, lambda a, b: pp(560 + a * 480, 980, 0.0) + v3(0, -0.33 * b, 0.0), 'console', toward=cab)
    # knee roll / under panel
    grid(g, 14, 2, lambda a, b: pp(18 + a * 1564, 770, 0.0) + v3(0, 0.06 * b, -0.32 * b), 'black_matte', toward=v3(0, -1, 0.2))
    tube(g, [pp(u, 776, -0.01) for u in np.linspace(18, 560, 8)], 0.016, 'leather_dark', sides=8, ry=0.012, up=-MAIN.pn)
    tube(g, [pp(u, 776, -0.01) for u in np.linspace(1040, 1582, 8)], 0.016, 'leather_dark', sides=8, ry=0.012, up=-MAIN.pn)
    # glareshield hood: padded lip along the outline, then to the windshield base
    us = [p[0] for p in LIP]
    tube(g, [pp(u, topv(u) - 3, -0.006) for u in us], 0.022, 'glareshield', sides=10, ry=0.016, up=v3(0, 1, 0.2))
    L3 = [pp(u, topv(u) - 12, 0.004) + v3(0, 0.012, 0) for u in us]
    F3 = [canopy(ZF + 0.01, ((u - 800) / 782) * 0.985) + v3(0, -0.004, 0) for u in us]
    n = len(us) - 1
    def shroud(a, b):
        f = a * n; i = min(n - 1, int(f)); t = f - i
        A = L3[i] + (L3[i + 1] - L3[i]) * t; Bq = F3[i] + (F3[i + 1] - F3[i]) * t
        p = A + (Bq - A) * b; p[1] += math.sin(b * math.pi) * 0.012; return p
    grid(g, n, 6, shroud, 'glareshield', toward=v3(-0.27, 0.6, 0))
    # gear and flap gates
    for (u, v, h) in ((690, 700, 72), (880, 700, 72)):
        rbox(g, (0.014, 0.004, h * PS), 0.005, 'black', m=MAIN.frame(u, v, -0.001), seg=2, flat=1)
    for u in (720, 790):
        rbox(g, (0.010, 0.004, 104 * PS), 0.004, 'rubber', m=PED.frame(u, 854, -0.0012), seg=1, flat=1)
    rbox(g, (0.022, 0.004, 116 * PS), 0.005, 'rubber', m=PED.frame(942, 858, -0.0012), seg=1, flat=1)


def exterior():
    g = Geo()
    def nose(u, v):
        a = -1 + 2 * u; z = ZF - 0.02 - v * 1.6; w = 0.55 * (1 - 0.6 * v * v)
        return (a * w, -0.30 - 0.12 * v - 0.14 * a * a * (1 + v) - 0.18 * v * v, z)
    grid(g, 12, 8, nose, 'skin', toward=v3(0, 2, 0))
    for sd in (-1, 1):
        # wing (low wing, behind the cockpit) and nacelle with a three-blade propeller
        def wing(u, v, top):
            x = sd * (0.55 + u * 6.2); ch = 1.6 - 0.7 * u; le = -0.05 + 0.25 * u
            t = v * v * (3 - 2 * v)
            th = 0.14 * ch * (0.2969 * math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4) * 2.2
            return (x, -1.05 + u * 6.2 * 0.08 + (th if top else -th * 0.4), le + t * ch)
        grid(g, 16, 10, lambda u, v: wing(u, v, True), 'skin', toward=v3(sd * 2, 3, 0))
        grid(g, 16, 10, lambda u, v: wing(u, v, False), 'skin_under', toward=v3(sd * 2, -3, 0))
        nx, ny = sd * 1.65, -0.86
        lathe(g, [(0.0, -1.55), (0.13, -1.50), (0.26, -1.3), (0.33, -0.9), (0.33, 0.3), (0.20, 1.2), (0.0, 1.4)], 'skin', seg=18, m=M(T(nx, ny, 0.0), RX(-math.pi / 2)))
        for k in range(3):
            a = k * 2 * math.pi / 3 + 0.3; d = v3(math.cos(a), math.sin(a), 0)
            tube(g, [v3(nx, ny, -1.58) + d * r for r in np.linspace(0.08, 0.92, 5)], [0.09, 0.10, 0.09, 0.07, 0.04], 'prop', sides=6, ry=0.012, up=np.cross(d, v3(0, 0, 1)) * 0.95 + v3(0, 0, 0.3))
        grid(g, 10, 3, lambda u, v: (sd * 0.63, YS - 0.02 - v * 0.8, ZF + u * 2.6), 'skin', toward=v3(sd * 2, 0, 0))
    return g


def build():
    C.reset(); C.material_specs(MATS, TEX)
    root = C.empty('da42_cockpit'); objs = {}; ctrl = {}
    objs['shell'] = C.to_object('shell', shell(), parent=root)
    objs['exterior'] = C.to_object('exterior', exterior(), parent=root, ao=False)
    objs['panel_face'] = MAIN.face('panel_face', root, nu=30, nv=8, outline=topv)
    objs['pedestal_face'] = PED.face('pedestal_face', root, nu=4, nv=3, off=-0.0008)
    g = Geo(); grid(g, 30, 16, lambda a, b: canopy(ZF + 0.005 + b * (0.47 - ZF - 0.01), -1 + 2 * a), 'glass', toward=v3(0, -0.2, 0))
    objs['glass'] = C.to_object('glass', g, parent=root, ao=False)
    g = Geo(); grid(g, 30, 14, lambda a, b: canopy(0.47 + b * (ZR - 0.47 - 0.005), -1 + 2 * a), 'glass', toward=v3(0, -0.2, 0.5))
    objs['glass_side'] = C.to_object('glass_side', g, parent=root, ao=False)
    # sticks: pivot at the floor, pitch about +x, roll about −z
    for nm, xc in (('stick_L', -0.27), ('stick_R', 0.27)):
        pv = v3(xc, YF + 0.05, -0.42)
        g = Geo()
        tube(g, [pv, pv + v3(0, 0.36, 0)], [0.012, 0.010], 'steel_dark', sides=10)
        def grip(q, n):
            x, y, z = q; return (x, y, z - 0.008 * (y / 0.06) ** 2)
        rbox(g, (0.042, 0.13, 0.05), (0.018, 0.03, 0.02), 'black', m=M(T(*(pv + v3(0, 0.41, 0.004))), RX(0.12)), seg=3, flat=(1, 3, 1), deform=grip)
        rbox(g, (0.012, 0.008, 0.012), 0.003, 'red', m=T(*(pv + v3(-0.012, 0.47, -0.004))), seg=1, flat=1)
        rbox(g, (0.014, 0.006, 0.012), 0.003, 'steel_dark', m=T(*(pv + v3(0.008, 0.475, 0.004))), seg=1, flat=1)
        objs[nm] = C.to_object(nm, g, pivot=pv, parent=root)
        ctrl[nm] = dict(pivot=pv, rotate_pitch=dict(axis=[1, 0, 0], unit='deg', min=-18, max=18, note='+ = top aft (pull)'),
                        rotate_roll=dict(axis=[0, 0, -1], unit='deg', min=-17, max=17, note='+ = top right; apply pitch then roll (Euler XZ, as da42-3d.js)'))
    # power levers on the engine-control console (pivot behind the face at the slot centre)
    for nm, u in (('power_L', 720), ('power_R', 790)):
        piv = PED.p(u, 854, 0.09); out = -PED.pn
        m = basis(piv, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out))
        g = Geo(); tube(g, [piv, piv + out * 0.15], 0.005, 'steel_dark', sides=8)
        rbox(g, (0.030, 0.045, 0.026), (0.01, 0.012, 0.01), 'knob_black', m=M(m, T(0, 0.165, 0)), seg=3, flat=1)
        objs[nm] = C.to_object(nm, g, pivot=piv, parent=root)
        ang = lambda v: round(-math.degrees(math.atan((854 - v) * PS / 0.09)), 2)
        ctrl[nm] = dict(pivot=piv, rotate=dict(axis=[1, 0, 0], unit='deg', positions={'MAX': ang(802), 'IDLE': ang(906)}, value_to_angle='angle = −atan((854 − v)·0.00074/0.09), v = 906 − 104·power (panel units); − = knob up/forward', note='modelled at mid travel (0°)'))
    # flap switch: flap-shaped tab in its gate, translates down the panel UP / APP / LDG
    p = pp(880, 670, -0.002); dn = nrm(MAIN.ey)
    fm = basis(p, v3(1, 0, 0), -MAIN.pn, dn)
    g = Geo()
    rbox(g, (0.006, 0.02, 0.006), 0.002, 'chrome', m=M(fm, T(0, 0.01, 0)), seg=1, flat=1)
    rbox(g, (0.04, 0.012, 0.02), 0.004, 'white', m=M(fm, T(0, 0.024, 0)), seg=2, flat=(3, 1, 1))
    objs['flap_switch'] = C.to_object('flap_switch', g, pivot=p, parent=root)
    ctrl['flap_switch'] = dict(pivot=p, translate=dict(axis=list(np.round(dn, 6)), positions={'UP': 0, 'APP': 30 * PS, 'LDG': 60 * PS}))
    # gear handle: round wheel knob on a rod, translates down the gate (UP modelled)
    p = pp(690, 670, -0.002)
    g = Geo()
    tube(g, [p, p - MAIN.pn * 0.045], 0.004, 'chrome', sides=8)
    gm = M(basis(p - MAIN.pn * 0.05, v3(1, 0, 0), -MAIN.pn, dn), RZ(math.pi / 2))
    lathe(g, [(0.0, -0.008), (0.010, -0.008), (0.015, -0.006), (0.017, 0), (0.015, 0.006), (0.010, 0.008), (0, 0.008)], 'white', seg=22, m=gm)
    objs['gear_handle'] = C.to_object('gear_handle', g, pivot=p, parent=root)
    ctrl['gear_handle'] = dict(pivot=p, translate=dict(axis=list(np.round(dn, 6)), positions={'UP': 0, 'DOWN': 60 * PS}))
    # elevator trim wheel (vertical in the console)
    wc = PED.p(942, 858, 0.028)
    g = Geo()
    gear = [((0.048 if k % 2 == 0 else 0.045) * math.cos(2 * math.pi * k / 64), (0.048 if k % 2 == 0 else 0.045) * math.sin(2 * math.pi * k / 64)) for k in range(64)]
    prism(g, gear, 0.016, 'black', m=M(T(*wc), RY(math.pi / 2)))
    rbox(g, (0.018, 0.006, 0.01), 0.002, 'white', m=M(T(*wc), RX(0.3), T(0, 0.046, 0)), seg=1, flat=1)
    objs['trim_wheel'] = C.to_object('trim_wheel', g, pivot=wc, parent=root)
    ctrl['trim_wheel'] = dict(pivot=wc, rotate=dict(axis=[1, 0, 0], unit='deg', min=-540, max=540, note='+ = top of wheel moves aft (nose up)'))
    # rudder pedals
    pv = v3(0, -1.02, -0.92)
    parent = C.empty('rudder_pedals', pivot=pv, parent=root); objs['rudder_pedals'] = parent
    kids = {}
    for side, xc in (('L', -0.27), ('R', 0.27)):
        for lr, dx in (('l', -0.09), ('r', 0.09)):
            hp = v3(xc + dx, -1.02, -0.92); nm = f'pedal_{side}_{lr}'
            objs[nm] = Pt.pedal(nm, hp, parent, dict(arm='steel_dark', pad='pedal', rubber='rubber'), tilt=0.55, arm=(0.06, 0.06)); kids[nm] = dict(pivot=list(hp), axis=[1, 0, 0])
    ctrl['rudder_pedals'] = dict(pivot=pv, children=kids, rotate=dict(axis=[1, 0, 0], unit='deg', min=-16, max=16, note='per pedal; left rudder: pedal_*_l −θ (top forward), pedal_*_r +θ'))
    return root, objs, ctrl


def main():
    root, objs, ctrl = build()
    meshes = [o for o in objs.values() if o.type == 'MESH']
    tris = C.tri_count(meshes)
    print('triangles', tris, {o.name: C.tri_count([o]) for o in meshes})
    os.makedirs(OUT, exist_ok=True); os.makedirs(SHOTS, exist_ok=True)
    C.bake_ao([o for o in meshes if o.get('ao')], [objs['glass'], objs['glass_side']], '/tmp/blender3d/da42_ao.jpg', size=1024, samples=int(os.environ.get('AO_SAMPLES', 48)))
    raw = '/tmp/blender3d/da42-raw.glb'
    C.export_glb(raw, [root] + list(objs.values()))
    print(C.gltfpack(raw, os.path.join(OUT, 'da42-cockpit.glb')))
    faces = {'panel_face': MAIN, 'pedestal_face': PED}
    side = dict(
        aircraft='DA42', file='da42-cockpit.glb', units='metres', frame='x right, y up, z aft (forward = −z); same frame as da42-3d.js/cockpit3d.js',
        origin='aircraft centre line at the cabin reference height (9 cm below the left-seat design eye)',
        eye=dict(left=list(EYE_L), right=list(EYE_R)), triangles=tris,
        nodes=sorted([o.name for o in objs.values()] + ['da42_cockpit']),
        faces={k: dict(p.json(), drawing='da42panel.js 1600×980', drawing_size=[1600, 980], uv='u = (x − rect.x)/rect.w, v = (y − rect.y)/rect.h (glTF UV, v down: texture.flipY = false)',
                       **({'top_edge': 'follows the panel outline of da42-3d.js; UV spans the whole rect'} if k == 'panel_face' else {'note': 'same plane as the panel (as in the app), 0.8 mm in front'})) for k, p in faces.items()},
        controls={k: {kk: (list(np.round(vv, 5)) if isinstance(vv, np.ndarray) else vv) for kk, vv in d.items()} for k, d in ctrl.items()},
        materials_note='PBR (metal/rough) with tiling detail maps on TEXCOORD_0 and a baked AO atlas as occlusionTexture on TEXCOORD_1 (three r128: aoMap via uv2).',
        compression='EXT_meshopt_compression + KHR_mesh_quantization (gltfpack -c); needs GLTFLoader.setMeshoptDecoder(MeshoptDecoder)')
    with open(os.path.join(OUT, 'da42-cockpit.json'), 'w') as f:
        json.dump(side, f, indent=1, default=lambda x: x.tolist() if hasattr(x, 'tolist') else float(x))
    if RENDER:
        from PIL import Image
        im = Image.open(PANEL_IMG); crops = {}
        for k, p in faces.items():
            r = p.rect; path = f'/tmp/blender3d/da42_{k}.png'; im.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])).save(path); crops[k] = path
        C.set_panel_preview(crops)
        C.preview(os.path.join(SHOTS, 'da42-left-seat.png'), EYE_L, 12, -18, hfov=84, samples=int(os.environ.get('PREVIEW_SAMPLES', 40)))


if __name__ == '__main__':
    main()
