"""DA42-class (four-seat composite twin: centre sticks, one-piece bubble canopy) cockpit → models/da42-cockpit.glb

Run:  python3 tools/blender/da42.py [outdir] [--no-render]
Cockpit frame (same as da42-3d.js / cockpit3d.js): metres, x right, y up, z aft; origin on the centre line at the cabin
reference height, 9 cm below the left-seat design eye. Proportions: see SOURCES.md.
Live panel drawing: da42panel.js (1600 × 980 units, 0.00074 m per unit, top leaning 10° away), placed as da42-3d.js does;
the engine-control console (drawing rect 560,760 480×220) is its own plane, sloping down and aft between the seats
from the bottom edge of the panel (sub-plane 'ped' in da42-3d.js).
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import cocklib as C
import parts as Pt
from cocklib import Geo, grid, rbox, box, tube, lathe, prism, T, RX, RY, RZ, S, M, basis, xf, v3, nrm, D2R
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
# the engine-control console: its own plane, sloping down and aft between the seats from the bottom edge of the panel
PSP, PEDP = 0.00063, 58
LEV_D = 0.14            # power-lever pivot below the console face
_PEY = v3(0, -math.cos(PEDP * D2R), math.sin(PEDP * D2R))
_PTOP = MAIN.p(800, 772, -0.004)
PED = SubPlane(R_PED, PSP, list(_PTOP + _PEY * (R_PED[3] * PSP / 2)), pitch=-PEDP)


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
    'glareshield': dict(color=(0.022, 0.024, 0.027), rough=0.95, tex='leather', tile=0.18, nstr=0.8),
    'panel_body': dict(color=(0.13, 0.14, 0.15), rough=0.55, tex='plastic', tile=0.15, nstr=0.35),
    'console':   dict(color=(0.15, 0.16, 0.18), rough=0.9, tex='plastic', tile=0.15, nstr=0.4),
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
    'knob_black': dict(color=(0.060, 0.062, 0.066), rough=0.38),
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


def loft(g, secs, mat, toward=None, closed_u=False):
    """sheet through sections (each the same number of points), sections along v"""
    nu = len(secs[0]) - (0 if closed_u else 1); nv = len(secs) - 1
    grid(g, nu, nv, lambda u, v: secs[int(round(v * nv))][int(round(u * nu)) % len(secs[0])], mat, toward=toward, closed_u=closed_u)


def lerp(a, b, t):
    return a + (b - a) * t


def a_at(z, h):
    """canopy parameter (0..1 from the top) at height h above the sill"""
    t = ct(z) - YS
    c = min(1.0, max(0.0, h / max(t, 1e-6))) ** (1 / 0.75)
    return math.acos(c) / (math.pi / 2)


WALL = [(0.590, YF), (0.600, -0.92), (0.606, -0.78), (0.606, -0.66), (0.600, -0.54), (0.592, -0.42), (0.592, YS)]
FRAME_H = 0.070          # canopy frame band above the sill
ZS = [ZF + 0.02 + i / 40 * (ZR - ZF - 0.04) for i in range(41)]


def fz(z):
    return cw(z) / WW


def side_walls(g, cab):
    for sd in (-1, 1):
        low = [[v3(sd * WALL[k][0] * fz(z), WALL[k][1], z) for k in range(0, 4)] for z in ZS]
        up = [[v3(sd * WALL[k][0] * fz(z), WALL[k][1], z) for k in range(3, 7)] for z in ZS]
        loft(g, low, 'carpet', toward=cab); loft(g, up, 'trim', toward=cab)
        # canopy frame: flush with the wall, up the inside of the glass, back to the glass
        fr = []
        for z in ZS:
            w = cw(z); top = canopy(z, sd * a_at(z, FRAME_H))
            fr.append([v3(sd * (w - 0.028), YS, z), v3(sd * (w - 0.028), YS + 0.022, z), v3(sd * (w - 0.028), YS + 0.046, z),
                       v3(sd * (w - 0.0255), YS + 0.058, z), v3(sd * (w - 0.018), YS + 0.066, z), v3(top[0] - sd * 0.006, YS + FRAME_H, z), v3(top[0], YS + FRAME_H, z)])
        loft(g, fr, 'frame', toward=cab)
        # armrest on the wall beside each front seat, and a slim map pocket below it
        rbox(g, (0.070, 0.036, 0.58), (0.014, 0.014, 0.05), 'leather_dark', m=T(sd * 0.571, -0.452, 0.10), seg=4, flat=(2, 1, 6))
        prism(g, [(0, 0), (0.0, -0.018), (-0.040, -0.075), (-0.040, -0.018)], 0.50, 'trim_dark', m=M(T(sd * 0.606, -0.452, 0.10), S(sd, 1, 1)))
    # canopy lock lever on the left frame
    rbox(g, (0.008, 0.034, 0.15), 0.003, 'black', m=T(-0.588, YS + 0.030, -0.12), seg=2, flat=1)
    rbox(g, (0.016, 0.024, 0.105), (0.006, 0.008, 0.012), 'red', m=T(-0.578, YS + 0.032, -0.135), seg=3, flat=(1, 1, 3))


def console_body(g, cab):
    """between the seats: under the sloping engine-control face, then a slim console with an armrest pad"""
    top0 = PED.p(800, R_PED[1] - 4, 0.0015); bot0 = PED.p(800, R_PED[1] + R_PED[3] + 4, 0.0015)
    hw0 = R_PED[2] / 2 * PSP + 0.001
    st = [(top0[2] - 0.22, top0[1], hw0), (top0[2], top0[1], hw0), (bot0[2], bot0[1], hw0), (bot0[2] + 0.05, bot0[1] - 0.022, hw0 - 0.012),
          (-0.44, -0.692, 0.105), (-0.36, -0.702, 0.074), (-0.30, -0.705, 0.066), (0.52, -0.705, 0.066), (0.575, -0.722, 0.066), (0.60, -0.78, 0.066), (0.612, YF - 0.02, 0.066)]
    zz = [s[0] for s in st]; yy = [s[1] for s in st]; ww = [s[2] for s in st]
    samp = sorted(set(zz + list(np.linspace(zz[2], zz[6], 14)) + list(np.linspace(zz[6], zz[7], 6))))
    secs = []
    for z in samp:
        y = float(np.interp(z, zz, yy)); hw = float(np.interp(z, zz, ww)); r = 0.016
        sec = [v3(-hw, YF, z), v3(-hw, (YF + y) / 2, z), v3(-hw, y - r, z)]
        sec += [v3(-hw + r - r * math.cos(t), y - r + r * math.sin(t), z) for t in np.linspace(0, math.pi / 2, 6)[1:]]
        sec += [v3(0, y, z)]
        sec += [v3(hw - r + r * math.sin(t), y - r + r * math.cos(t), z) for t in np.linspace(0, math.pi / 2, 6)[:-1]]
        sec += [v3(hw, y - r, z), v3(hw, (YF + y) / 2, z), v3(hw, YF, z)]
        secs.append(sec)
    loft(g, secs, 'console', toward=v3(0, 2.0, 0.2))
    rbox(g, (0.112, 0.026, 0.44), (0.014, 0.011, 0.03), 'leather_dark', m=T(0, -0.696, 0.27), seg=4, flat=(2, 1, 5))


def lip_frames():
    """panel outline samples: point on the panel plane, in-plane outward normal, toward the crew"""
    L = [qb((18, 250), (18, 140), (130, 118), i / 8) for i in range(9)] + [qb((130, 118), (800, 46), (1470, 118), i / 36) for i in range(1, 37)] + \
        [qb((1470, 118), (1582, 140), (1582, 250), i / 8) for i in range(1, 9)]
    exn = nrm(MAIN.ex); eyn = nrm(MAIN.ey); F = -MAIN.pn; out = []
    for i, (u, v) in enumerate(L):
        a = L[max(0, i - 1)]; b = L[min(len(L) - 1, i + 1)]
        tu, tv = b[0] - a[0], b[1] - a[1]; k = math.hypot(tu, tv); tu /= k; tv /= k
        out.append((u, MAIN.p(u, v, 0.0), exn * tv - eyn * tu, F))
    return out


LIP_R, LIP_F = 0.012, 0.040


def glare_lip():
    """padded edge of the glareshield, standing out over the top of the panel (drawn over the live panel)"""
    g = Geo(); secs = []
    for (u, P, O, F) in lip_frames():
        Cc = P + O * 0.009 + F * LIP_F
        sec = [P - O * 0.006 + F * 0.0012, P - O * 0.0045 + F * (LIP_F * 0.5), P - O * 0.003 + F * LIP_F]
        sec += [Cc + (F * math.cos(t) + O * math.sin(t)) * LIP_R for t in np.linspace(-math.pi / 2, math.pi / 2, 9)[1:]]
        sec += [P + O * 0.024 + F * (LIP_F * 0.5), P + O * 0.026]
        secs.append(sec)
    loft(g, secs, 'glareshield', toward=v3(-0.27, 0.6, 0.4))
    for sec in (secs[0], secs[-1]):                                  # close both ends
        c = np.mean(sec, 0); g.add(np.array([c] + sec), [[0, k + 1, k + 2] for k in range(len(sec) - 1)], 'glareshield', toward=c + v3(0, -1, 0))
    return g


def panel_body(g, cab):
    # backing behind the face, and the strip from the face edge out to the wall on both sides
    grid(g, 30, 1, lambda a, b: pp(18 + a * 1564, topv(18 + a * 1564) + b * (770 - topv(18 + a * 1564)), 0.012), 'panel_body', toward=cab)
    for sd, u0 in ((-1, 18), (1, 1582)):
        def cheek(a, b):
            p = pp(u0, 236 + b * (772 - 236), 0.0004); xw = sd * (cw(p[2]) - 0.028)
            return v3(lerp(p[0], xw, a), p[1], p[2])
        grid(g, 2, 8, cheek, 'glareshield', toward=cab)
    # the two small panels hanging below the panel beside the console (emergency gear, alternate air): a body behind each
    for u0 in (520, 1020):
        rbox(g, (80 * PS, 0.030, 74 * PS), 0.004, 'panel_body', m=MAIN.frame(u0 + 40, 805, 0.0158), seg=2, flat=1)
    # under the panel: padded lower edge left and right of the console, and the underside running forward
    grid(g, 14, 3, lambda a, b: pp(18 + a * 1564, 772, 0.0) + v3(0, 0.05 * b, -0.34 * b), 'black_matte', toward=v3(0, -1, 0.2))
    hw0 = R_PED[2] / 2 * PSP + 0.001
    for sd in (-1, 1):
        x0 = sd * 0.205; x1 = sd * (WW - 0.028)
        tube(g, [v3(lerp(x0, x1, t), pp(800, 774, 0)[1], pp(800, 774, -0.006)[2]) for t in np.linspace(0, 1, 9)], 0.017, 'leather_dark', sides=12, ry=0.013, up=-MAIN.pn)
    # glareshield: from behind the padded edge forward to the base of the windshield, and down both sides to the canopy frame
    fr = lip_frames(); n = len(fr) - 1
    L3 = [P + O * 0.026 for (u, P, O, F) in fr]
    F3 = [canopy(ZF + 0.01, ((u - 800) / 782) * 0.985) + v3(0, -0.004, 0) for (u, P, O, F) in fr]
    def shroud(a, b):
        f = a * n; i = min(n - 1, int(f)); t = f - i
        A = L3[i] + (L3[i + 1] - L3[i]) * t; Bq = F3[i] + (F3[i + 1] - F3[i]) * t
        p = A + (Bq - A) * b; p[1] += math.sin(b * math.pi) * 0.010; return p
    grid(g, n, 8, shroud, 'glareshield', toward=v3(-0.27, 0.6, 0))
    for sd, i in ((-1, 0), (1, n)):
        def skirt(a, b):
            top = lerp(L3[i], F3[i], a); z = top[2]
            return v3(lerp(top[0], sd * (cw(z) - 0.028), b), lerp(top[1], YS + 0.046, b), z)
        grid(g, 8, 4, skirt, 'glareshield', toward=cab)
    # gear and flap gates on the panel; lever and trim slots on the console
    for (u, v, h) in ((690, 700, 72), (880, 700, 72)):
        rbox(g, (0.014, 0.004, h * PS), 0.005, 'black', m=MAIN.frame(u, v, -0.001), seg=2, flat=1)
    for u in (720, 790):
        rbox(g, (0.010, 0.004, 104 * PSP), 0.004, 'rubber', m=PED.frame(u, 854, -0.0012), seg=1, flat=1)
    rbox(g, (0.022, 0.004, 116 * PSP), 0.005, 'rubber', m=PED.frame(942, 858, -0.0012), seg=1, flat=1)


def belt(g, xc, z0, cush_y, recline):
    """stowed three-point belt: the strap hangs down the outboard edge of the backrest from the guide at the shoulder to the anchor
    at the hip, with its latch plate; the buckle stands at the inboard edge of the cushion"""
    sd = 1 if xc > 0 else -1
    bm = M(T(xc, cush_y + 0.015, z0 + 0.22), RX(recline * D2R))
    pts = [(sd * 0.158, 0.615, -0.100), (sd * 0.160, 0.56, -0.112), (sd * 0.162, 0.46, -0.128), (sd * 0.163, 0.34, -0.138), (sd * 0.164, 0.20, -0.140), (sd * 0.166, 0.10, -0.136), (sd * 0.178, 0.03, -0.118), (sd * 0.205, -0.02, -0.07)]
    P = xf(bm, pts)
    tube(g, P, 0.023, 'strap', sides=8, ry=0.0022, up=v3(1, 0, 0))
    rbox(g, (0.062, 0.020, 0.018), 0.005, 'steel_dark', m=M(bm, T(sd * 0.158, 0.628, -0.094)), seg=2, flat=1)              # guide at the shoulder
    rbox(g, (0.050, 0.060, 0.006), (0.006, 0.010, 0.002), 'alu', m=M(bm, T(sd * 0.163, 0.30, -0.1425)), seg=2, flat=1)    # latch plate
    bx = xc - sd * 0.176
    rbox(g, (0.012, 0.085, 0.030), 0.004, 'steel_dark', m=M(T(bx, cush_y + 0.035, z0 + 0.13), RX(-0.25)), seg=2, flat=1)
    rbox(g, (0.022, 0.050, 0.046), 0.006, 'black', m=M(T(bx, cush_y + 0.090, z0 + 0.118), RX(-0.25)), seg=3, flat=1)
    rbox(g, (0.0235, 0.012, 0.030), 0.003, 'red', m=M(T(bx, cush_y + 0.108, z0 + 0.1135), RX(-0.25)), seg=2, flat=1)


def shell():
    g = Geo(); cab = v3(0, -0.35, 0.2)
    grid(g, 12, 28, lambda u, v: (-0.6 + u * 1.2, YF, ZF + v * (ZR - ZF)), 'carpet', toward=cab)
    grid(g, 12, 8, lambda u, v: (-0.6 + u * 1.2, YF + v * (YS - YF + 0.05), ZF), 'well', toward=cab)
    side_walls(g, cab)
    # roll-over bow behind the front seats and the rear bow, both running down into the canopy frame
    for z, w, d in ((0.47, 0.050, 0.026), (1.60, 0.036, 0.022)):
        a0 = a_at(z, FRAME_H * 0.5)
        pts = [canopy(z, a0 * (-1 + i / 20)) for i in range(41)]
        pts = [p - nrm(v3(p[0], p[1] - YS + 0.25, 0)) * (d * 0.96) for p in pts]
        tube(g, pts, w, 'frame', sides=14, ry=d, up=v3(0, 0, 1), caps=False)
    tube(g, [canopy(ZF + 0.015, -1 + i / 12) for i in range(25)], 0.016, 'black', sides=8)
    top = canopy(0.47, 0)
    rbox(g, (0.15, 0.020, 0.026), 0.008, 'black', m=T(0, top[1] - 0.085, 0.40), seg=3, flat=1)
    for sx in (-0.058, 0.058):
        rbox(g, (0.018, 0.034, 0.018), 0.006, 'black', m=T(sx, top[1] - 0.064, 0.415), seg=2, flat=1)
    # rear bulkhead: up to the sill between the walls, then the arch under the canopy (a little past the glass, so no slit)
    zb = ZR - 0.02; xw = cw(zb) + 0.004
    grid(g, 12, 4, lambda u, v: (-xw + 2 * xw * u, YF + v * (YS - YF), zb), 'trim_dark', toward=cab)
    def arch(u, v):
        p = canopy(zb, -1 + 2 * u); return (p[0] * 1.006, YS + v * (p[1] + 0.004 - YS), zb)
    grid(g, 28, 4, arch, 'trim_dark', toward=cab)
    console_body(g, cab)
    # stick boots: leather bellows on the floor
    for xc in (-0.27, 0.27):
        lathe(g, [(0, 0), (0.078, 0), (0.078, 0.006), (0.066, 0.016), (0.070, 0.024), (0.054, 0.036), (0.058, 0.044), (0.040, 0.058), (0.043, 0.066), (0.024, 0.082), (0.016, 0.094), (0, 0.094)],
              'rubber', seg=24, m=T(xc, YF, -0.42))
    panel_body(g, cab)
    for xc in (-0.27, 0.27):
        Pt.seat(g, xc, SEAT_Z, YF, SEATM, cush_y=-0.80, w=0.40, back_h=0.66, recline=18, headrest=True)
        belt(g, xc, SEAT_Z, -0.80, 18)
    for xc in (-0.27, 0.27):
        Pt.seat(g, xc, 0.98, YF, SEATM, cush_y=-0.85, w=0.40, back_h=0.60, recline=20, headrest=False, pleats=3)
    return g


# ---- outside: what the crew sees of their own aircraft --------------------------------------------------------------
NAC_X, NAC_Y, PROP_Z, PROP_R = 1.68, -0.90, -1.22, 0.94
WING_Y, WING_X0, WING_X1 = -1.04, 0.60, 6.74


def wing_pt(sd, s, c, top):
    """s: 0 root … 1 tip, c: 0 leading edge … 1 trailing edge"""
    x = WING_X0 + s * (WING_X1 - WING_X0); ch = 1.74 - 0.84 * s ** 1.15; le = -0.04 + 0.40 * s
    th = 0.15 * ch * 5 * (0.2969 * math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1015 * c ** 4)
    cam = 0.02 * ch * 4 * c * (1 - c)
    return v3(sd * x, WING_Y + (x - WING_X0) * 0.095 + cam + (th if top else -th), le + c * ch)


def exterior():
    g = Geo(); cs = [(1 - math.cos(math.pi * k / 16)) / 2 for k in range(17)]
    # nose: from the base of the windshield forward
    def nose(u, v):
        a = (-1 + 2 * u) * 0.999; z = ZF - 0.01 - v * 1.75; k = (1 - v ** 2.2) ** 0.55
        w = cw(ZF) * 1.03 * k; yt = -0.055 - 0.50 * v ** 1.7; yb = YS - 0.03 - 0.36 * v ** 1.3
        th = a * math.pi / 2
        return v3(w * spw(math.sin(th), 0.8), yb + (yt - yb) * abs(math.cos(th)) ** 0.8, z)
    grid(g, 24, 14, nose, 'skin', toward=v3(0, 3, -2))
    for sd in (-1, 1):
        grid(g, 22, 16, lambda u, v: wing_pt(sd, u, cs[int(round(v * 16))], True), 'skin', toward=v3(sd * 3, 30, 0))
        grid(g, 22, 16, lambda u, v: wing_pt(sd, u, cs[int(round(v * 16))], False), 'skin_under', toward=v3(sd * 3, -30, 0))
        # winglet: up and slightly out from the tip, swept back
        tip_le = wing_pt(sd, 1, 0.0, True); tip_te = wing_pt(sd, 1, 1.0, True); tch = tip_te[2] - tip_le[2]
        for face in (-1, 1):
            def wl(u, v):
                h = 0.92 * u; cant = sd * (0.05 * u + 0.16 * u * u); c = cs[int(round(v * 16))]
                ch = tch * (1 - 0.62 * u); le = tip_le[2] + 0.50 * u * tch + 0.10 * u * u
                t = 0.11 * ch * 5 * (0.2969 * math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c ** 3 - 0.1015 * c ** 4) * (1 - 0.35 * u)
                return v3(tip_le[0] + cant + sd * face * t, tip_le[1] - 0.01 + h, le + c * ch)
            grid(g, 10, 16, wl, 'skin', toward=v3(sd * (WING_X1 + face * 30), tip_le[1] + 0.5, 0.6))
        # engine nacelle: spinner, cowling, fairing back over the wing
        nx = sd * NAC_X
        lathe(g, [(0.0, -0.315), (0.016, -0.311), (0.040, -0.292), (0.072, -0.250), (0.104, -0.195), (0.132, -0.130), (0.152, -0.065), (0.163, -0.015), (0.166, 0.010), (0.166, 0.024), (0.0, 0.024)],
              'skin', seg=28, m=M(T(nx, NAC_Y, PROP_Z + 0.012), RX(math.pi / 2)))
        stn = [(0.030, 0.150, 0.150, 0.0), (0.031, 0.168, 0.168, 0.0), (0.060, 0.180, 0.184, -0.003), (0.13, 0.205, 0.218, -0.010), (0.26, 0.236, 0.262, -0.020), (0.45, 0.258, 0.296, -0.030), (0.70, 0.270, 0.312, -0.036),
               (1.00, 0.268, 0.306, -0.034), (1.30, 0.246, 0.268, -0.022), (1.60, 0.205, 0.210, -0.004), (1.95, 0.140, 0.135, 0.020), (2.25, 0.070, 0.066, 0.042), (2.45, 0.0, 0.0, 0.055)]
        secs = []
        for (dz, a, b, dy) in stn:
            secs.append([v3(nx + max(a, 1e-4) * spw(math.cos(t), 0.86), NAC_Y + dy + max(b, 1e-4) * spw(math.sin(t), 0.86), PROP_Z + dz) for t in np.linspace(0, 2 * math.pi, 37)[:-1]])
        loft(g, secs, 'skin', closed_u=True, toward=v3(nx + 10, NAC_Y, PROP_Z + 1))
        # fuselage side below the canopy sill
        grid(g, 24, 4, lambda u, v: (sd * (cw(ZF + u * 4.6) + 0.012 + 0.02 * math.sin(v * math.pi / 2)), YS - 0.004 - v * 0.8, ZF + u * 4.6), 'skin', toward=v3(sd * 3, 0, 0))
    return g


def propeller(sd):
    """three-blade propeller of one side: its own mesh, so the app turns it about its own hub (and hides it once it turns fast)"""
    g = Geo(); nx = sd * NAC_X
    hub = v3(nx, NAC_Y, PROP_Z)
    for k in range(3):
        ang = math.pi / 2 + k * 2 * math.pi / 3; d = v3(math.cos(ang), math.sin(ang), 0); e = np.cross(v3(0, 0, 1), d)
        rs = np.linspace(0.13, PROP_R, 12); path = []; wd = []; tk = []
        for r in rs:
            q = (r - 0.13) / (PROP_R - 0.13)
            path.append(hub + d * r + v3(0, 0, -0.01)); wd.append(0.030 + 0.070 * math.sin(math.pi * min(1, q * 1.15) ** 0.8) * (1 - 0.25 * q) + 0.004); tk.append(0.016 - 0.012 * q)
        tw = v3(0, 0, 1) * 0.55 + e * 0.83
        tube(g, path, wd, 'prop', sides=10, ry=tk, up=tw)
    tiny = 0.0008                                   # four specks on the tip circle, so the unit's box is centred on the hub
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c = hub + v3(dx * PROP_R, dy * PROP_R, -0.01)
        g.add(np.array([c, c + v3(tiny, 0, 0), c + v3(0, tiny, 0)]), [[0, 1, 2]], 'prop')
    return g


def build():
    C.reset(); C.material_specs(MATS, TEX)
    root = C.empty('da42_cockpit'); objs = {}; ctrl = {}
    objs['shell'] = C.to_object('shell', shell(), parent=root)
    objs['exterior'] = C.to_object('exterior', exterior(), parent=root, ao=False)
    for nm, sd in (('prop_L', -1), ('prop_R', 1)):
        objs[nm] = C.to_object(nm, propeller(sd), parent=root, ao=False)
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
        tube(g, [pv + v3(0, h, 0.018 * math.sin(h / 0.36 * math.pi) * 0.0) for h in np.linspace(0, 0.37, 6)], [0.0125, 0.0122, 0.0118, 0.0114, 0.011, 0.0105], 'steel_dark', sides=14)
        gm = M(T(*(pv + v3(0, 0.425, 0.006))), RX(0.14))
        def grip(q, n):
            x, y, z = q; t = y / 0.068
            return (x * (1 + 0.10 * t), y, z - 0.010 * t * t + 0.004 * t)
        rbox(g, (0.040, 0.136, 0.046), (0.017, 0.030, 0.019), 'black', m=gm, seg=5, flat=(1, 5, 1), deform=grip)
        rbox(g, (0.030, 0.012, 0.034), 0.005, 'steel_dark', m=M(gm, T(0, -0.066, 0)), seg=2, flat=1)                    # collar
        rbox(g, (0.013, 0.007, 0.013), 0.003, 'red', m=M(gm, T(-0.010, 0.069, -0.006)), seg=2, flat=1)                 # autopilot disconnect
        lathe(g, [(0, 0), (0.0062, 0), (0.0062, 0.004), (0.004, 0.007), (0, 0.007)], 'steel_dark', seg=12, m=M(gm, T(0.009, 0.068, 0.004)))   # trim switch
        rbox(g, (0.012, 0.022, 0.008), 0.003, 'steel_dark', m=M(gm, T(0, 0.022, -0.026)), seg=2, flat=1)               # push-to-talk
        objs[nm] = C.to_object(nm, g, pivot=pv, parent=root)
        ctrl[nm] = dict(pivot=pv, rotate_pitch=dict(axis=[1, 0, 0], unit='deg', min=-18, max=18, note='+ = top aft (pull)'),
                        rotate_roll=dict(axis=[0, 0, -1], unit='deg', min=-17, max=17, note='+ = top right; apply pitch then roll (Euler XZ, as da42-3d.js)'))
    # padded glareshield edge: static, but in front of the live panel, so its own unit (foreground pass in the app)
    lp = MAIN.p(800, 82, -LIP_F)
    objs['glare_lip'] = C.to_object('glare_lip', glare_lip(), pivot=lp, parent=root)
    ctrl['glare_lip'] = dict(pivot=lp, translate=dict(axis=[0, 1, 0], positions={'FIXED': 0}), note='does not move')
    # power levers on the engine-control console (pivot behind the face at the slot centre)
    for nm, u in (('power_L', 720), ('power_R', 790)):
        piv = PED.p(u, 854, LEV_D); out = -PED.pn
        m = basis(piv, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out))
        g = Geo(); rbox(g, (0.007, LEV_D + 0.034, 0.016), 0.003, 'alu', m=M(m, T(0, (LEV_D + 0.034) / 2, 0)), seg=2, flat=1)
        def knob(q, n):
            x, y, z = q; return (x, y + 0.004 * (1 - (z / 0.026) ** 2), z)
        rbox(g, (0.031, 0.034, 0.052), (0.011, 0.013, 0.018), 'knob_black', m=M(m, T(0, LEV_D + 0.044, 0)), seg=5, flat=(1, 1, 3), deform=knob)
        objs[nm] = C.to_object(nm, g, pivot=piv, parent=root)
        ang = lambda v: round(-math.degrees(math.atan((854 - v) * PSP / LEV_D)), 2)
        ctrl[nm] = dict(pivot=piv, rotate=dict(axis=[1, 0, 0], unit='deg', positions={'MAX': ang(802), 'IDLE': ang(906)}, value_to_angle='angle = −atan((854 − v)·%g/%g), v = 906 − 104·power (panel units); − = knob up/forward' % (PSP, LEV_D), note='modelled at mid travel (0°)'))
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
    C.bake_ao([o for o in meshes if o.get('ao')], [objs['glass'], objs['glass_side']], '/tmp/blender3d/da42_ao.jpg', size=int(os.environ.get('AO_SIZE', 2048)), samples=int(os.environ.get('AO_SAMPLES', 48)))
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
                       **({'top_edge': 'follows the panel outline of da42-3d.js; UV spans the whole rect'} if k == 'panel_face' else {'note': 'its own plane (da42-3d.js subs: ped), sloping down and aft from the bottom edge of the panel'})) for k, p in faces.items()},
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
