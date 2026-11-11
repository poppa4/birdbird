"""King Air B200-class two-crew flight deck → models/b200-cockpit.glb

Run:  python3 tools/blender/b200.py [outdir] [--no-render]
Cockpit frame (same as b200-3d.js / cockpit3d.js): metres, x right, y up, z aft; origin on the centre line at the cabin
reference height, 12 cm below the left-seat design eye. Proportions: see SOURCES.md.
Live panel drawing: b200panel.js (2000 × 1780 units). The main panel and the four sub-planes (upper panel, pedestal, fuel
panel on the left console, circuit breakers on the right console) are placed exactly where b200-3d.js puts them.
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
PANEL_IMG = os.environ.get('PANEL_IMG_B200', '/tmp/blender3d/b200_full.png')

YF, YR, YS, XW = -1.12, 0.36, -0.20, 0.68
ZWB, ZWT, ZB, ZR = -1.24, -0.80, 0.18, 0.80
EYE_L, EYE_R = (-0.37, 0.12, 0.0), (0.37, 0.12, 0.0)
PS, TILT, PV = 0.00058, 10, 1266
YK = [(323, 1047), (1657, 1026)]
# glareshield top edge of the panel drawing (path.glare in b200panel.js, sampled from the live page)
GL = [(20, 371.8), (69, 357.1), (118, 344.8), (167, 333.4), (216, 323.6), (265, 314.8), (314, 307.1), (363, 300), (412, 293.4), (461, 287.5), (510, 282.1),
      (559, 277.2), (608, 272.9), (657, 238.1), (706, 218.1), (1294, 218.1), (1343, 264.6), (1392, 268.9), (1441, 273.4), (1490, 278.3), (1539, 282.5),
      (1588, 286.4), (1637, 292.3), (1686, 298.8), (1735, 306.7), (1784, 315.1), (1833, 324.1), (1882, 336), (1931, 349), (1980, 364.9)]
GLu = np.array([p[0] for p in GL]); GLv = np.array([p[1] for p in GL])


def topv(u):
    return float(np.interp(u, GLu, GLv))


# main panel as a plane: v down the panel leans aft by the tilt
_EX = v3(PS, 0, 0); _EY = v3(0, -PS * math.cos(TILT * D2R), PS * math.sin(TILT * D2R))
_PO = v3(0, -0.27, -0.93) - _EX * 1000 - _EY * 600
MAIN = SubPlane([0, 218, 2000, PV - 218], PS, list(_PO + _EX * 1000 + _EY * (218 + (PV - 218) / 2)), pitch=-TILT)
UPPER = SubPlane([814, 0, 366, 242], 0.0008, [0, 0.27, -0.74], pitch=35)
PED = SubPlane([664, 1246, 660, 534], 0.0005, [0, -0.7125, -0.7435], pitch=-60)
FUEL = SubPlane([4, 1246, 520, 374], 0.0005, [-0.632, -0.50, -0.66], yaw=90, pitch=-30)
CB = SubPlane([1522, 1246, 476, 534], 0.0005, [0.632, -0.50, -0.62], yaw=-90, pitch=-30)


def pp(u, v, o=0.0):
    return MAIN.p(u, v, o)


def ws(a, t):
    """two-piece windshield: a across (−1 … 1), t base (0) → top (1)"""
    b = v3(a * 0.60, -0.035 + 0.02 * a * a, ZWB + 0.16 * a * a)
    p = v3(a * 0.64, YR - 0.06 + 0.02 * (1 - a * a), ZWT + 0.07 * a * a)
    q = b + (p - b) * t; q[2] -= 0.03 * math.sin(math.pi * t); return q


def zFront(y):
    return ZWB + 0.16 if y < -0.015 else ZWB + 0.16 + (ZWT + 0.07 - (ZWB + 0.16)) * min(1, (y + 0.015) / (YR - 0.04 + 0.015))


MATS = {
    'trim':      dict(color=(0.66, 0.65, 0.62), rough=0.7, tex='plastic', tile=0.15, nstr=0.6),
    'trim_dark': dict(color=(0.46, 0.46, 0.45), rough=0.72, tex='plastic', tile=0.15, nstr=0.6),
    'headliner': dict(color=(0.80, 0.79, 0.76), rough=0.85, tex='headliner', tile=0.10, nstr=0.5),
    'frame':     dict(color=(0.62, 0.62, 0.60), rough=0.6, tex='plastic', tile=0.15, nstr=0.4),
    'glareshield': dict(color=(0.05, 0.05, 0.052), rough=0.85, tex='leather', tile=0.18, nstr=0.8),
    'panel_body': dict(color=(0.09, 0.09, 0.095), rough=0.55, tex='plastic', tile=0.15, nstr=0.35),
    'console':   dict(color=(0.13, 0.13, 0.14), rough=0.6, tex='plastic', tile=0.15, nstr=0.4),
    'carpet':    dict(color=(0.17, 0.18, 0.21), rough=0.97, tex='carpet', tile=0.25, nstr=1.0),
    'firewall':  dict(color=(0.11, 0.11, 0.12), rough=0.9, tex='carpet', tile=0.25, nstr=0.6),
    'leather':   dict(color=(0.30, 0.29, 0.28), rough=0.5, tex='leather', tile=0.12, nstr=0.55),
    'leather_dark': dict(color=(0.14, 0.14, 0.14), rough=0.55, tex='leather', tile=0.12, nstr=0.5),
    'alu':       dict(color=(0.62, 0.63, 0.65), rough=0.42, metal=0.55, tex='metal', tile=0.2, nstr=0),
    'chrome':    dict(color=(0.78, 0.78, 0.80), rough=0.22, metal=0.6),
    'steel_dark': dict(color=(0.22, 0.23, 0.24), rough=0.5, metal=0.5),
    'black':     dict(color=(0.035, 0.035, 0.04), rough=0.42),
    'black_matte': dict(color=(0.045, 0.045, 0.05), rough=0.8, tex='plastic', tile=0.1, nstr=0.4),
    'rubber':    dict(color=(0.03, 0.03, 0.03), rough=0.92),
    'knob_black': dict(color=(0.03, 0.03, 0.033), rough=0.35),
    'knob_blue': dict(color=(0.08, 0.24, 0.62), rough=0.35),
    'knob_red':  dict(color=(0.66, 0.07, 0.05), rough=0.35),
    'white':     dict(color=(0.88, 0.88, 0.86), rough=0.35),
    'gear_knob': dict(color=(0.90, 0.90, 0.88), rough=0.3),
    'pedal':     dict(color=(0.16, 0.17, 0.18), rough=0.5, metal=0.4),
    'yoke':      dict(color=(0.05, 0.05, 0.055), rough=0.4),
    'yoke_hub':  dict(color=(0.16, 0.16, 0.17), rough=0.45),
    'strap':     dict(color=(0.20, 0.21, 0.23), rough=0.9, tex='fabric', tile=0.12, nstr=0.8),
    'skin':      dict(color=(0.93, 0.93, 0.91), rough=0.32, ao=False),
    'skin_under': dict(color=(0.82, 0.82, 0.80), rough=0.45, ao=False),
    'stripe':    dict(color=(0.55, 0.12, 0.10), rough=0.35, ao=False),
    'prop':      dict(color=(0.04, 0.04, 0.045), rough=0.5, ao=False),
    'prop_tip':  dict(color=(0.85, 0.80, 0.20), rough=0.4, ao=False),
    'spinner':   dict(color=(0.75, 0.76, 0.78), rough=0.25, metal=0.6, ao=False),
    'exhaust':   dict(color=(0.20, 0.18, 0.17), rough=0.6, ao=False),
    'panel_face': dict(color=(1, 1, 1), rough=0.6, ao=False, tex='panelph', nstr=0),
    'glass':     dict(color=(0.80, 0.86, 0.90), rough=0.05, alpha=0.10, double=True, ao=False),
}
SEATM = dict(cover='leather', side='leather_dark', shell='console', metal='steel_dark')
SEAT_Z = -0.02


def shell():
    g = Geo(); cab = v3(0, -0.3, 0.1)
    def floor(u, v):
        z = -1.24 + v * (ZR + 1.24)
        return (-XW - 0.02 + u * 2 * (XW + 0.02), YF + 0.12 * min(1, max(0, (-1.0 - z) / 0.2)), z)
    grid(g, 12, 24, floor, 'carpet', toward=cab)
    grid(g, 12, 6, lambda u, v: (-XW - 0.02 + u * 2 * (XW + 0.02), YF + 0.12 + v * (-0.62 - YF - 0.12), -1.24 - 0.03 * v), 'firewall', toward=cab)
    for sd in (-1, 1):
        grid(g, 26, 8, lambda u, v: (sd * (XW + 0.012 * math.sin(math.pi * v)), YF + v * (YS - YF), -1.26 + u * (ZR + 1.26)), 'trim', toward=cab)
        grid(g, 26, 1, lambda u, v: (sd * (XW - 0.05 * (1 - v)), YS + 0.002, -1.26 + u * (ZR + 1.26)), 'trim_dark', toward=v3(0, 0.4, 0))
        rbox(g, (0.07, 0.05, 0.44), (0.02, 0.02, 0.03), 'leather_dark', m=T(sd * (XW - 0.05), -0.36, 0.14), seg=3, flat=(2, 1, 4))
        grid(g, 4, 4, lambda u, v: (sd * XW, YS + v * (-0.015 - YS), -1.26 + u * 0.17), 'trim', toward=cab)
        # A post, side-window divider post, B post, upper and sill rails (rounded), window seals
        ap = [ws(sd, i / 12) + v3(sd * 0.010, 0, 0.004) for i in range(13)]
        tube(g, ap, 0.04, 'frame', sides=10, ry=0.026, up=v3(sd, 0, 0.35))
        for zc, wz in ((-0.30, 0.07), (ZB, 0.07)):
            rbox(g, (0.045, YR - 0.04 - YS + 0.02, wz), 0.012, 'frame', m=T(sd * (XW + 0.004), (YS + YR - 0.04) / 2, zc), seg=2, flat=(1, 3, 1))
        rbox(g, (0.05, 0.05, ZR - ZWT + 0.02), 0.012, 'frame', m=T(sd * (XW + 0.002), YR - 0.055, (ZWT + ZR) / 2), seg=2, flat=(1, 1, 6))
        rbox(g, (0.04, 0.03, ZR - ZWT + 0.4), 0.01, 'frame', m=T(sd * (XW + 0.002), YS + 0.012, (ZWT + ZR) / 2 - 0.1), seg=2, flat=(1, 1, 6))
        # side console (left: fuel panel; right: circuit breakers) – the live sub-panel sits on its sloped top
        P = [(-0.70, YF), (-0.70, -0.387), (-0.574, -0.604), (-0.574, YF)]
        if sd > 0:
            P = [(-x, y) for x, y in P][::-1]
        prism(g, P, 0.50, 'console', m=T(0, 0, -0.65))
        tube(g, [v3(sd * 0.70, -0.387, -0.90), v3(sd * 0.70, -0.387, -0.40)], 0.008, 'trim_dark', sides=6)
        # wall pocket for charts behind the console
        rbox(g, (0.03, 0.22, 0.34), 0.01, 'trim_dark', m=T(sd * (XW - 0.012), -0.68, -0.12), seg=2, flat=1)
        # fresh-air eyeball outlet on the sidewall near the windshield, map light
        lathe(g, [(0, 0), (0.03, 0), (0.03, 0.01), (0.022, 0.018), (0, 0.018)], 'black', seg=16, m=M(T(sd * (XW - 0.02), -0.06, -1.02), RZ(sd * math.pi / 2)))
        lathe(g, [(0, 0), (0.016, 0), (0.016, 0.03), (0, 0.03)], 'black', seg=12, m=M(T(sd * (XW - 0.035), YR - 0.12, -0.20), RZ(sd * 0.9)))
        # sun visor on the header rail
        vc = v3(sd * 0.36, YR - 0.07, ZWT + 0.10)
        rbox(g, (0.36, 0.014, 0.15), (0.02, 0.006, 0.02), 'trim', m=M(T(*vc), RX(0.15)), seg=2, flat=(4, 1, 2))
        tube(g, [vc + v3(sd * 0.18, 0, -0.07), vc + v3(-sd * 0.18, 0, -0.07)], 0.005, 'alu', sides=8)
        # harness from the seat-back top
        x0 = sd * 0.37
        Pt.harness(g, v3(x0 + sd * 0.11, -0.18 + 0.62, SEAT_Z + 0.44), v3(x0 + sd * 0.11, 0.05, SEAT_Z + 0.32), v3(x0 + sd * 0.02, -0.40, SEAT_Z + 0.16),
                   v3(x0 - sd * 0.10, -0.66, SEAT_Z + 0.05), 'strap', 'alu')
    # headliner, windshield header, centre post
    grid(g, 14, 18, lambda u, v: (-XW + u * 2 * XW, YR - 0.06 + 0.06 * (1 - ((-XW + u * 2 * XW) / XW) ** 2), ZWT + 0.03 + v * (ZR - ZWT - 0.03)), 'headliner', toward=cab)
    hdr = [ws(-1 + i / 8, 1) + v3(0, -0.012, 0.016) for i in range(17)]
    tube(g, hdr, 0.04, 'frame', sides=8, ry=0.024, up=v3(0, 0.3, 1))
    cp = [ws(0, i / 8) + v3(0, 0, 0.012) for i in range(9)]
    tube(g, cp, 0.032, 'frame', sides=8, ry=0.02, up=v3(0, 0, 1))
    # upper panel housing (the live upper panel on its face) and its mount to the roof
    um = UPPER.frame(UPPER.rect[0] + UPPER.rect[2] / 2, UPPER.rect[1] + UPPER.rect[3] / 2)
    rbox(g, (0.33, 0.07, 0.215), (0.012, 0.012, 0.012), 'console', m=M(um, T(0, -0.037, 0)), seg=2, flat=(2, 1, 2))
    rbox(g, (0.24, 0.10, 0.12), 0.015, 'console', m=T(0, YR - 0.06, -0.82), seg=2, flat=1)
    # magnetic compass on the centre post (standby)
    rbox(g, (0.075, 0.06, 0.06), 0.015, 'black', m=T(0, 0.12, -0.95), seg=3, flat=1)
    # cockpit divider behind the seats with the door opening
    for sd in (-1, 1):
        grid(g, 4, 8, lambda u, v: (sd * (0.26 + u * (XW - 0.26)), YF + v * (YR - YF), ZR), 'trim_dark', toward=cab)
    grid(g, 4, 2, lambda u, v: (-0.26 + u * 0.52, 0.1 + v * (YR - 0.1), ZR), 'trim_dark', toward=cab)
    tube(g, [v3(-0.26, YF, ZR - 0.01), v3(-0.26, 0.1, ZR - 0.01), v3(0.26, 0.1, ZR - 0.01), v3(0.26, YF, ZR - 0.01)], 0.012, 'trim', sides=6)
    panel_body(g)
    pedestal(g)
    for xc in (-0.37, 0.37):
        Pt.seat(g, xc, SEAT_Z, YF, SEATM, cush_y=-0.75, w=0.50, back_h=0.68, recline=13, armrests=True)
    return g


def panel_body(g):
    cab = v3(0, -0.3, 0.1)
    for sd in (-1, 1):
        u0 = 20 if sd < 0 else 1980; v0 = topv(u0)
        def cap(a, b):
            p = pp(u0, v0 + b * (PV - v0), 0.002)
            return (sd * (abs(p[0]) + a * (XW - abs(p[0]))), p[1], p[2] + a * 0.02)
        grid(g, 1, 8, cap, 'panel_body', toward=cab)
    grid(g, 30, 1, lambda a, b: pp(20 + a * 1960, topv(20 + a * 1960) + b * (PV - topv(20 + a * 1960)), 0.008), 'panel_body', toward=cab)
    # lower lip & knee area
    tube(g, [pp(u, PV + 6, -0.012) for u in np.linspace(20, 1980, 21)], 0.02, 'leather_dark', sides=10, ry=0.015, up=-MAIN.pn)
    grid(g, 16, 3, lambda a, b: pp(20 + a * 1960, PV + 14, 0.0) + v3(0, 0.03 * b, -0.32 * b), 'black_matte', toward=v3(0, -1.0, 0.2))
    # glareshield: padded lip along the top edge, then the shroud to the windshield base
    us = np.linspace(20, 1980, 41)
    tube(g, [pp(u, topv(u) - 3, -0.007) for u in us], 0.024, 'glareshield', sides=12, ry=0.017, up=v3(0, 1, 0.2))
    L3 = [pp(u, topv(u) - 14, 0.004) + v3(0, 0.014, 0) for u in us]
    F3 = [ws(max(-1, min(1, (u - 1000) / 980)), 0) + v3(0, -0.004, 0) for u in us]
    n = len(us) - 1
    def shroud(a, b):
        f = a * n; i = min(n - 1, int(f)); t = f - i
        A = L3[i] + (L3[i + 1] - L3[i]) * t; Bq = F3[i] + (F3[i + 1] - F3[i]) * t
        p = A + (Bq - A) * b; p[1] += math.sin(b * math.pi) * 0.012; return p
    grid(g, n, 7, shroud, 'glareshield', toward=v3(-0.37, 0.6, 0))
    # column boots
    for (u, v) in YK:
        p = pp(u, v, -0.002); out = -MAIN.pn
        lathe(g, [(0, 0), (0.04, 0), (0.038, 0.012), (0.019, 0.026), (0.016, 0.034), (0, 0.034)], 'rubber', seg=20, m=basis(p, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out)))
    # gear handle gate
    gm = MAIN.frame(706, 952, -0.001)
    rbox(g, (0.016, 0.004, 0.045), 0.005, 'black', m=gm, seg=2, flat=1)


def pedestal(g):
    P = [(-0.90, -0.64), (-0.862, -0.648), (-0.628, -0.783), (-0.30, -0.80), (-0.30, YF), (-0.90, YF)]
    prism(g, P, 0.36, 'console', m=basis(v3(0, 0, 0), v3(0, 0, 1), v3(0, 1, 0), v3(1, 0, 0)))
    for sd in (-1, 1):
        tube(g, [v3(sd * 0.181, y, z) for (z, y) in P[:4]], 0.005, 'trim_dark', sides=6)
    # lever slots on the quadrant face
    for u in (798, 838, 912, 946, 1022, 1056):
        rbox(g, (0.010, 0.003, 0.058), 0.003, 'rubber', m=PED.frame(u, 1330, -0.0005), seg=1, flat=1)
    rbox(g, (0.012, 0.003, 0.040), 0.003, 'rubber', m=PED.frame(1162, 1320, -0.0005), seg=1, flat=1)
    rbox(g, (0.018, 0.003, 0.064), 0.004, 'rubber', m=PED.frame(722, 1336, -0.0005), seg=1, flat=1)
    # friction knobs on the quadrant sides
    for sd in (-1, 1):
        lathe(g, [(0, 0), (0.014, 0), (0.014, 0.016), (0, 0.016)], 'knob_black', seg=14, m=M(T(sd * 0.18, -0.70, -0.74), RZ(-sd * math.pi / 2)))


def exterior():
    g = Geo()
    def nose(u, v):
        a = -1 + 2 * u; z = ZWB - 0.02 - v * 2.1; w = 0.62 * (1 - 0.55 * v * v)
        return (a * w, -0.05 - 0.10 * v - 0.16 * a * a * (1 + v) - 0.25 * v * v, z)
    grid(g, 14, 10, nose, 'skin', toward=v3(0, 2, 0))
    for sd in (-1, 1):
        nx, ny = sd * 2.45, -0.95
        lathe(g, [(0.0, -2.35), (0.17, -2.30), (0.30, -2.1), (0.40, -1.7), (0.43, -1.0), (0.42, 0.4), (0.30, 1.4), (0.0, 1.7)], 'skin', seg=20,
              m=M(T(nx, ny, -0.2), RX(-math.pi / 2)))
        lathe(g, [(0.0, -2.75), (0.08, -2.70), (0.15, -2.55), (0.17, -2.40), (0.0, -2.40)], 'spinner', seg=16, m=M(T(nx, ny, -0.2), RX(-math.pi / 2)))
        for k in range(4):   # four-blade propeller (static, feathered look)
            a = k * math.pi / 2 + 0.4
            d = v3(math.cos(a), math.sin(a), 0)
            path = [v3(nx, ny, -2.62) + d * r for r in np.linspace(0.12, 1.20, 6)]
            tube(g, path, [0.11, 0.12, 0.11, 0.10, 0.08, 0.05], 'prop', sides=6, ry=0.015, up=np.cross(d, v3(0, 0, 1)) * 0.95 + v3(0, 0, 0.3))
        # wing
        def wing(u, v, top):
            x = sd * (0.75 + u * 7.6); ch = 2.3 - 1.2 * u; le = 0.35 + 0.5 * u
            t = v * v * (3 - 2 * v)
            th = 0.12 * ch * 0.6 * (0.2969 * math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4) * 5
            return (x, -1.28 + u * 7.6 * 0.05 + (th if top else -th * 0.4), le + t * ch)
        grid(g, 16, 10, lambda u, v: wing(u, v, True), 'skin', toward=v3(sd * 2, 3, 0))
        grid(g, 16, 10, lambda u, v: wing(u, v, False), 'skin_under', toward=v3(sd * 2, -3, 0))
        grid(g, 10, 3, lambda u, v: (sd * (XW + 0.08), YS - 0.02 - v * 0.9, -1.3 + u * 2.4), 'skin', toward=v3(sd * 2, 0, 0))
        grid(g, 10, 1, lambda u, v: (sd * (XW + 0.082), YS - 0.12 - v * 0.05, -1.3 + u * 2.4), 'stripe', toward=v3(sd * 2, 0, 0))
        # exhaust stack
        tube(g, [v3(nx + sd * 0.40, ny + 0.05, -1.2), v3(nx + sd * 0.48, ny + 0.08, -0.85)], 0.09, 'exhaust', sides=10)
    grid(g, 8, 6, lambda u, v: (-0.72 + u * 1.44, YR + 0.06, ZWT - 0.05 + v * 1.7), 'skin_under', toward=v3(0, -1, 0))
    return g


def lever(name, u, kind, parent, depth=0.10, height=0.095, vc=1330):
    """power-quadrant lever: pivot under the pedestal face at the slot centre, rotates about +x"""
    piv = PED.p(u, vc, depth)                # 'depth' into the pedestal
    out = -PED.pn
    m = basis(piv, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out))
    g = Geo()
    L = depth + height
    tube(g, [piv, piv + out * (L - 0.012)], 0.0045, 'chrome', sides=8)
    top = M(m, T(0, L, 0))
    if kind == 'power':      # wide paddle knob, slightly hooked aft
        def hook(q, n):
            x, y, z = q; return (x, y, z + 0.25 * y * y * 20)
        rbox(g, (0.044, 0.032, 0.060), (0.01, 0.012, 0.014), 'knob_black', m=M(top, T(0, 0.004, 0.004)), seg=3, flat=(2, 1, 2), deform=hook)
    elif kind == 'prop':     # ribbed blue knob
        gear = [((0.016 if k % 2 == 0 else 0.014) * math.cos(2 * math.pi * k / 28), (0.0135 if k % 2 == 0 else 0.0118) * math.sin(2 * math.pi * k / 28)) for k in range(28)]
        prism(g, gear, 0.03, 'knob_blue', m=M(top, T(0, 0.004, 0), RY(math.pi / 2)))
    else:                    # condition: round red disc knob
        lathe(g, [(0, -0.002), (0.014, -0.002), (0.02, 0.005), (0.02, 0.015), (0.014, 0.022), (0, 0.022)], 'knob_red', seg=20, m=M(top, T(0, -0.002, 0), RZ(math.pi / 2)))
    return C.to_object(name, g, pivot=piv, parent=parent), piv


def build():
    C.reset(); C.material_specs(MATS, TEX)
    root = C.empty('b200_cockpit'); objs = {}; ctrl = {}
    objs['shell'] = C.to_object('shell', shell(), parent=root)
    objs['exterior'] = C.to_object('exterior', exterior(), parent=root, ao=False)
    objs['panel_face'] = MAIN.face('panel_face', root, nu=30, nv=8, outline=topv)
    objs['pedestal_face'] = PED.face('pedestal_face', root, nu=6, nv=6)
    objs['upper_panel_face'] = UPPER.face('upper_panel_face', root, nu=4, nv=4)
    objs['fuel_panel_face'] = FUEL.face('fuel_panel_face', root, nu=6, nv=4)
    objs['cb_panel_face'] = CB.face('cb_panel_face', root, nu=6, nv=6)
    g = Geo()
    for sd in (-1, 1):
        grid(g, 12, 12, lambda a, b: ws(sd * (0.012 + a * 0.988), 0.01 + b * 0.98), 'glass', toward=v3(0, 0, 0))
    objs['glass'] = C.to_object('glass', g, parent=root, ao=False)
    g = Geo()
    for sd in (-1, 1):
        def w1(a, b):
            y = YS + 0.02 + b * (YR - 0.08 - YS); zf = zFront(y) + 0.02
            return (sd * (XW + 0.014), y, zf + a * (-0.335 - zf))
        grid(g, 4, 4, w1, 'glass', toward=v3(0, 0, 0))
        grid(g, 3, 2, lambda a, b: (sd * (XW + 0.014), YS + 0.02 + b * (YR - 0.08 - YS), -0.265 + a * (ZB - 0.035 + 0.265)), 'glass', toward=v3(0, 0, 0))
    objs['glass_side'] = C.to_object('glass_side', g, parent=root, ao=False)
    ym = dict(column='chrome', hub='yoke_hub', plate='trim_dark', grip='yoke', red='knob_red', switch='black')
    for nm, (u, v) in zip(('yoke_L', 'yoke_R'), YK):
        hub = pp(u, v, -0.004) + v3(0, 0, 0.20)
        objs[nm] = Pt.yoke(nm, hub, root, ym, width=0.36, horn_r=0.05, col_len=0.48, col_r=0.014, grip=0.019)
        ctrl[nm] = dict(pivot=hub, translate=dict(axis=[0, 0, 1], min=-0.08, max=0.08, note='+ = pull (aft); 0 = neutral'),
                        rotate=dict(axis=[0, 0, 1], min=-45, max=45, unit='deg', note='angle = −roll command × 45° (right roll turns the wheel clockwise as seen by the pilot)'))
    def ang(v, vc=1330, depth=0.10, ps=0.0005):
        return round(-math.degrees(math.atan((vc - v) * ps / depth)), 2)
    def slot_v(val, lo, hi, y0=1280, L=100):
        return y0 + (hi - val) / (hi - lo) * L
    lev = {'power': ('power', [('MAX', 1), ('IDLE', 0), ('BETA', -0.12), ('REV', -0.4)], (-0.4, 1)),
           'prop': ('prop', [('2000', 1), ('1600', 0.12), ('FTHR', 0)], (0, 1)),
           'condition': ('cond', [('HI IDLE', 1), ('LO IDLE', 0.5), ('CUTOFF', 0)], (0, 1))}
    for base, us in (('power', (798, 838)), ('prop', (912, 946)), ('condition', (1022, 1056))):
        kind, marks, (lo, hi) = lev[base]
        for side, u in zip('LR', us):
            nm = f'{base}_{side}'
            o, piv = lever(nm, u, kind, root); objs[nm] = o
            ctrl[nm] = dict(pivot=piv, rotate=dict(axis=[1, 0, 0], unit='deg', positions={k: ang(slot_v(v, lo, hi)) for k, v in marks},
                            value_to_angle=f'angle = −atan((1330 − v)·0.0005 / 0.10) with v = 1280 + ({hi} − value)/({hi} − {lo})·100 (panel slot units); − = knob forward',
                            note='modelled at the slot centre (0°)'))
    # flap lever: airfoil-shaped white knob, slot UP/APPROACH/DOWN
    piv = PED.p(1162, 1320, 0.06); out = -PED.pn
    m = basis(piv, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out))
    g = Geo(); tube(g, [piv, piv + out * 0.10], 0.004, 'chrome', sides=8)
    def foil(q, n):
        x, y, z = q; t = (z + 0.02) / 0.04
        return (x, y * (1.0 - 0.6 * t), z)
    rbox(g, (0.05, 0.016, 0.04), (0.006, 0.006, 0.01), 'white', m=M(m, T(0, 0.105, 0)), seg=3, flat=(3, 1, 3), deform=foil)
    objs['flap_lever'] = C.to_object('flap_lever', g, pivot=piv, parent=root)
    ctrl['flap_lever'] = dict(pivot=piv, rotate=dict(axis=[1, 0, 0], unit='deg', positions={'UP': ang(1290, 1320, 0.06), 'APPROACH': 0.0, 'DOWN': ang(1350, 1320, 0.06)}))
    # gear handle: wheel-shaped knob on an arm out of the panel; UP/DOWN swing in the gate
    gp = pp(706, 952, 0.01); out = -MAIN.pn
    m = basis(gp, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out))
    g = Geo(); tube(g, [gp, gp + out * 0.075], 0.005, 'chrome', sides=10)
    lathe(g, [(0.0, -0.009), (0.012, -0.009), (0.018, -0.008), (0.021, -0.004), (0.021, 0.004), (0.018, 0.008), (0.012, 0.009), (0, 0.009)], 'gear_knob', seg=24,
          m=M(m, T(0, 0.085, 0), RZ(math.pi / 2)))
    for k in range(8):   # tread ribs
        a = k * math.pi / 4
        rbox(g, (0.020, 0.003, 0.004), 0.001, 'gear_knob', m=M(m, T(0, 0.085, 0), RX(a), T(0, 0.021, 0)), seg=1, flat=1)
    objs['gear_handle'] = C.to_object('gear_handle', g, pivot=gp, parent=root)
    ctrl['gear_handle'] = dict(pivot=gp, rotate=dict(axis=[1, 0, 0], unit='deg', positions={'UP': -14, 'DOWN': 14}, note='+ = knob down; modelled mid-gate'))
    # elevator trim wheel on the left of the quadrant
    wc = PED.p(722, 1336, 0.032)
    g = Geo()
    gear = [((0.052 if k % 2 == 0 else 0.049) * math.cos(2 * math.pi * k / 72), (0.052 if k % 2 == 0 else 0.049) * math.sin(2 * math.pi * k / 72)) for k in range(72)]
    prism(g, gear, 0.016, 'black', m=M(T(*wc), RY(math.pi / 2)))
    rbox(g, (0.018, 0.006, 0.01), 0.002, 'white', m=M(T(*wc), RX(0.3), T(0, 0.05, 0)), seg=1, flat=1)
    objs['trim_wheel'] = C.to_object('trim_wheel', g, pivot=wc, parent=root)
    ctrl['trim_wheel'] = dict(pivot=wc, rotate=dict(axis=[1, 0, 0], unit='deg', min=-540, max=540, note='+ = top of wheel moves aft (nose up)'))
    # rudder pedals: one node, four pedals hinged at the floor
    pv = v3(0, -1.06, -1.13)
    parent = C.empty('rudder_pedals', pivot=pv, parent=root); objs['rudder_pedals'] = parent
    pm = dict(arm='steel_dark', pad='pedal', rubber='rubber')
    kids = {}
    for side, xc in (('L', -0.37), ('R', 0.37)):
        for lr, dx in (('l', -0.09), ('r', 0.09)):
            hp = v3(xc + dx, -1.06, -1.13)
            nm = f'pedal_{side}_{lr}'
            objs[nm] = Pt.pedal(nm, hp, parent, pm, tilt=0.5, arm=(0.07, 0.06)); kids[nm] = dict(pivot=list(hp), axis=[1, 0, 0])
    ctrl['rudder_pedals'] = dict(pivot=pv, children=kids, rotate=dict(axis=[1, 0, 0], unit='deg', min=-16, max=16, note='per pedal; left rudder: pedal_*_l −θ (top forward), pedal_*_r +θ'))
    return root, objs, ctrl


def main():
    root, objs, ctrl = build()
    meshes = [o for o in objs.values() if o.type == 'MESH']
    tris = C.tri_count(meshes)
    print('triangles', tris, {o.name: C.tri_count([o]) for o in meshes})
    os.makedirs(OUT, exist_ok=True); os.makedirs(SHOTS, exist_ok=True)
    C.bake_ao([o for o in meshes if o.get('ao')], [objs['glass'], objs['glass_side']], '/tmp/blender3d/b200_ao.jpg', size=1024, samples=int(os.environ.get('AO_SAMPLES', 48)))
    raw = '/tmp/blender3d/b200-raw.glb'
    C.export_glb(raw, [root] + list(objs.values()))
    print(C.gltfpack(raw, os.path.join(OUT, 'b200-cockpit.glb')))
    faces = {'panel_face': MAIN, 'pedestal_face': PED, 'upper_panel_face': UPPER, 'fuel_panel_face': FUEL, 'cb_panel_face': CB}
    side = dict(
        aircraft='B200', file='b200-cockpit.glb', units='metres', frame='x right, y up, z aft (forward = −z); same frame as b200-3d.js/cockpit3d.js',
        origin='aircraft centre line at the cabin reference height (12 cm below the left-seat design eye)',
        eye=dict(left=list(EYE_L), right=list(EYE_R)), triangles=tris,
        nodes=sorted([o.name for o in objs.values()] + ['b200_cockpit']),
        faces={k: dict(p.json(), drawing='b200panel.js 2000×1780', drawing_size=[2000, 1780], uv='u = (x − rect.x)/rect.w, v = (y − rect.y)/rect.h (glTF UV, v down: texture.flipY = false)',
                       **({'top_edge': 'follows path.glare of the drawing; UV still spans the whole rect'} if k == 'panel_face' else {})) for k, p in faces.items()},
        controls={k: {kk: (list(np.round(vv, 5)) if isinstance(vv, np.ndarray) else vv) for kk, vv in d.items()} for k, d in ctrl.items()},
        materials_note='PBR (metal/rough) with tiling detail maps on TEXCOORD_0 and a baked AO atlas as occlusionTexture on TEXCOORD_1 (three r128: aoMap via uv2).',
        compression='EXT_meshopt_compression + KHR_mesh_quantization (gltfpack -c); needs GLTFLoader.setMeshoptDecoder(MeshoptDecoder)')
    with open(os.path.join(OUT, 'b200-cockpit.json'), 'w') as f:
        json.dump(side, f, indent=1, default=lambda x: x.tolist() if hasattr(x, 'tolist') else float(x))
    if RENDER:
        from PIL import Image
        im = Image.open(PANEL_IMG)
        crops = {}
        for k, p in faces.items():
            r = p.rect; path = f'/tmp/blender3d/b200_{k}.png'; im.crop((r[0], r[1], r[0] + r[2], r[1] + r[3])).save(path); crops[k] = path
        C.set_panel_preview(crops)
        C.preview(os.path.join(SHOTS, 'b200-left-seat.png'), EYE_L, 13, -19, hfov=84, samples=int(os.environ.get('PREVIEW_SAMPLES', 40)))


if __name__ == '__main__':
    main()
