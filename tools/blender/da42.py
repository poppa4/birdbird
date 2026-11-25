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

PS, TILT = 0.000685, 10          # one panel unit is 0.685 mm: the panel face is 1.00 m wide and 0.39 m high, as in the aircraft
ZF, ZR, YS, YF, WW = -1.15, 1.65, -0.33, -1.05, 0.62
EYE_L, EYE_R = (-0.27, 0.09, 0.0), (0.27, 0.09, 0.0)
_PO = v3(-0.548, 0.01944, -0.70659)   # panel unit (0,0): the bottom edge of the face is 0.59 m below and 0.62 m ahead of the eye
_EX = v3(PS, 0, 0); _EY = v3(0, -PS * math.cos(TILT * D2R), PS * math.sin(TILT * D2R))


def _cubic(p0, p1, p2, p3, t):
    a = (1 - t) ** 3; b = 3 * (1 - t) ** 2 * t; c = 3 * (1 - t) * t * t; d = t ** 3
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])


def _outline(x0, vb, v1, c, n=16):
    """da42panel.js FACE / RIM path sampled from the bottom-left corner over the arch to the bottom-right corner"""
    left = [(x0, vb + (v1 - vb) * i / 6) for i in range(6)]
    left += [_cubic((x0, v1), c[0], c[1], c[2], i / n) for i in range(n)]
    left += [_cubic(c[2], c[3], c[4], c[5], i / n) for i in range(n + 1)]
    return left + [(1600 - u, v) for (u, v) in left[-2::-1]]


FACE_P = _outline(69, 770, 530, [(69, 360), (190, 262), (350, 217), (500, 196), (680, 194), (800, 194)])
RIM_P = _outline(16, 778, 530, [(16, 330), (160, 215), (345, 168), (500, 146), (680, 144), (800, 144)])


def topv(u):
    """top of the padded surround (panel units) above u"""
    pts = [q for i, q in enumerate(RIM_P) if 5 <= i <= len(RIM_P) - 6]
    return float(np.interp(u, [q[0] for q in pts], [q[1] for q in pts], left=778, right=778))


def rect_center(r):
    return _PO + _EX * (r[0] + r[2] / 2) + _EY * (r[1] + r[3] / 2)


R_MAIN = [16, 144, 1568, 634]
MAIN = SubPlane(R_MAIN, PS, list(rect_center(R_MAIN)), pitch=-TILT)
# The engine-control console, as in the aircraft: a small console sloping down and aft from the bottom edge of the panel (rudder
# trim, parking brake, cabin heat and defrost), then the large console between the seats (power levers, fuel selectors, elevator
# trim wheel, auxiliary pump switches). The drawing lays these out flat; each group is its own plane here (da42-3d.js subs).
P1, P2 = 35, 82                        # the two console faces lean back 35° and 82° from the vertical
E1 = v3(0, -math.cos(P1 * D2R), math.sin(P1 * D2R)); E2 = v3(0, -math.cos(P2 * D2R), math.sin(P2 * D2R))
A0 = v3(0, -0.505, -0.612); L1 = 0.25; A1 = A0 + E1 * L1; L2 = 0.50; A2 = A1 + E2 * L2
HW1, HW2 = 0.0625, 0.070               # half width of the small and the large console
LEV_D = 0.10                           # power-lever pivot below the console face
SUBS = {}


def _sub(sid, rect, ps, pos, pitch):
    SUBS[sid] = SubPlane(rect, ps, list(pos), pitch=-pitch); SUBS[sid].sid = sid


_sub('rt', [696, 746, 208, 64], 0.000553, A0 + E1 * 0.035, P1)
_sub('sl', [572, 772, 112, 180], 0.00098, A0 + E1 * 0.153, P1)
_sub('pw', [664, 778, 190, 152], 0.000605, A1 + E2 * 0.066, P2)
_sub('fs', [660, 900, 242, 78], 0.00054, A1 + E2 * 0.149, P2)
_sub('tw', [906, 740, 86, 232], 0.00095, A1 + E2 * 0.294, P2)
_sub('ax', [980, 874, 80, 90], 0.0008, A1 + E2 * 0.452, P2)
_sub('emg', [526, 772, 68, 62], 0.0008, v3(-0.108, -0.532, -0.605), TILT)
_sub('alt', [1026, 772, 68, 62], 0.0008, v3(0.108, -0.532, -0.605), TILT)


def pp(u, v, o=0.0):
    return MAIN.p(u, v, o)


def cw(z):
    """half width of the cabin at the canopy sill: widest at the seats, narrowing to the nose and to the tail"""
    if z > 1.0:
        return WW - 0.1 * sstep(0, 1, (z - 1.0) / 0.65)
    return WW if z > -0.25 else WW - (WW - 0.50) * sstep(0, 1, (-0.25 - z) / 0.90)


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
    'leather_cream': dict(color=(0.62, 0.57, 0.47), rough=0.6, tex='leather', tile=0.12, nstr=0.5),
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
    'rocker_white': dict(color=(0.80, 0.80, 0.78), rough=0.42),
    'rocker_red': dict(color=(0.72, 0.14, 0.09), rough=0.42),
    'white':     dict(color=(0.88, 0.88, 0.86), rough=0.35),
    'pedal':     dict(color=(0.16, 0.17, 0.18), rough=0.5, metal=0.4),
    'strap':     dict(color=(0.30, 0.32, 0.36), rough=0.9, tex='fabric', tile=0.12, nstr=0.8),
    'skin':      dict(color=(0.95, 0.95, 0.94), rough=0.3, ao=False),
    'skin_under': dict(color=(0.84, 0.84, 0.83), rough=0.45, ao=False),
    'prop':      dict(color=(0.05, 0.05, 0.05), rough=0.5, ao=False),
    'prop_tip':  dict(color=(0.90, 0.90, 0.88), rough=0.45, ao=False),
    'tks':       dict(color=(0.56, 0.57, 0.60), rough=0.35, metal=0.5, ao=False),      # porous de-icing panel on the leading edge
    'seam':      dict(color=(0.60, 0.61, 0.62), rough=0.4, ao=False),                 # panel joint in the white skin
    'gap':       dict(color=(0.13, 0.13, 0.14), rough=0.7, ao=False),                 # open gap: control surface, cowling
    'walk':      dict(color=(0.10, 0.10, 0.11), rough=0.95, ao=False),                # anti-skid walkway at the wing root
    'intake':    dict(color=(0.025, 0.025, 0.03), rough=0.9, ao=False),
    'cap':       dict(color=(0.50, 0.51, 0.53), rough=0.35, metal=0.6, ao=False),
    'cap_red':   dict(color=(0.72, 0.13, 0.09), rough=0.5, ao=False),
    'lens_red':  dict(color=(0.85, 0.10, 0.08), rough=0.15, ao=False),
    'lens_green': dict(color=(0.08, 0.70, 0.30), rough=0.15, ao=False),
    'lens_clear': dict(color=(0.86, 0.90, 0.94), rough=0.1, ao=False),
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
    """under the two console faces, then on between the seats with an armrest pad"""
    n1 = SUBS['rt'].pn; n2 = SUBS['pw'].pn; off = 0.0016
    B0 = A0 + n1 * off; B1 = A1 + (n1 + n2) * off * 0.5; B2 = A2 + n2 * off
    st = [(B0[2] - 0.20 * E1[2], B0[1] - 0.20 * E1[1], HW1), (B0[2], B0[1], HW1), (B1[2] - 0.02, B1[1] + 0.02 * E1[1] / E1[2], HW1), (B1[2] + 0.03, B1[1] + 0.03 * E2[1] / E2[2], HW2),
          (B2[2], B2[1], HW2), (0.52, B2[1], HW2), (0.575, B2[1] - 0.018, HW2), (0.60, -0.85, HW2), (0.612, YF - 0.02, HW2)]
    zz = [q[0] for q in st]; yy = [q[1] for q in st]; ww = [q[2] for q in st]
    samp = sorted(set(zz + list(np.linspace(zz[1], zz[2], 6)) + list(np.linspace(zz[3], zz[4], 8)) + list(np.linspace(zz[4], zz[5], 5))))
    secs = []
    for z in samp:
        y = float(np.interp(z, zz, yy)); hw = float(np.interp(z, zz, ww)); r = 0.012
        sec = [v3(-hw, YF, z), v3(-hw, (YF + y) / 2, z), v3(-hw, y - r, z)]
        sec += [v3(-hw + r - r * math.cos(t), y - r + r * math.sin(t), z) for t in np.linspace(0, math.pi / 2, 6)[1:]]
        sec += [v3(0, y, z)]
        sec += [v3(hw - r + r * math.sin(t), y - r + r * math.cos(t), z) for t in np.linspace(0, math.pi / 2, 6)[:-1]]
        sec += [v3(hw, y - r, z), v3(hw, (YF + y) / 2, z), v3(hw, YF, z)]
        secs.append(sec)
    # black top with rounded shoulders; padded leather down both sides
    loft(g, [q[2:-2] for q in secs], 'black_matte', toward=v3(0, 2.0, 0.2))
    loft(g, [q[:3] for q in secs], 'leather_cream', toward=v3(-2.0, -0.6, 0.0))
    loft(g, [q[-3:] for q in secs], 'leather_cream', toward=v3(2.0, -0.6, 0.0))
    rbox(g, (0.118, 0.026, 0.36), (0.014, 0.011, 0.03), 'leather_dark', m=T(0, B2[1] + 0.009, 0.31), seg=4, flat=(2, 1, 5))
    # lever and trim-wheel slots; a body behind the two small panels beside the console (emergency gear, alternate air)
    pw = SUBS['pw']; tw = SUBS['tw']
    for u in (720, 790):
        rbox(g, (0.009, 0.004, 104 * pw.ps), 0.004, 'rubber', m=pw.frame(u, 854, -0.0012), seg=1, flat=1)
    rbox(g, (0.024, 0.004, 116 * tw.ps), 0.005, 'rubber', m=tw.frame(942, 858, -0.0012), seg=1, flat=1)
    for sid in ('emg', 'alt'):
        sp = SUBS[sid]; r = sp.rect
        rbox(g, (r[2] * sp.ps + 0.004, 0.022, r[3] * sp.ps + 0.004), 0.004, 'panel_body', m=sp.frame(r[0] + r[2] / 2, r[1] + r[3] / 2, 0.0118), seg=2, flat=1)
        tube(g, [sp.p(r[0] + r[2] / 2, r[1] + 4, 0.012), sp.p(r[0] + r[2] / 2, r[1] - 30, 0.03)], 0.012, 'panel_body', sides=8)


def lip_frames():
    """the panel's outline in the cockpit: face edge and outer edge of the padded surround, sample by sample"""
    return [(MAIN.p(a[0], a[1], 0.0), MAIN.p(b[0], b[1], 0.0)) for a, b in zip(FACE_P, RIM_P)]


LIP_H = 0.030           # how far the padded surround stands out from the panel


def glare_lip():
    """padded surround of the panel: a thick black roll from the face edge to the outer edge, all the way round the arch and
    down both sides (drawn over the live panel)"""
    g = Geo(); secs = []; F = -MAIN.pn
    for (Pin, Pout) in lip_frames():
        O = Pout - Pin; w = float(np.linalg.norm(O)); O = O / w
        Cc = Pin + O * (w * 0.5) + F * 0.008
        sec = [Pin - O * 0.004 + F * 0.0012]
        sec += [Cc - O * math.cos(t) * (w * 0.5 + 0.003) + F * math.sin(t) * LIP_H for t in np.linspace(0.10, math.pi, 13)]
        sec += [Pout - O * 0.001]
        secs.append(sec)
    loft(g, secs, 'glareshield', toward=v3(-0.27, 0.6, 0.6))
    for sec in (secs[0], secs[-1]):                                  # close both ends
        c = np.mean(sec, 0); g.add(np.array([c] + sec), [[0, k + 1, k + 2] for k in range(len(sec) - 1)], 'glareshield', toward=c + v3(0, -1, 0))
    return g


def panel_body(g, cab):
    # backing behind the face and its surround
    R3 = [MAIN.p(u, v, 0.012) for (u, v) in RIM_P]; c = MAIN.p(800, 520, 0.012)
    g.add(np.array([c] + R3), [[0, k + 1, k + 2] for k in range(len(R3) - 1)], 'panel_body', toward=cab)
    # the small panel below the left end (alternate static valve, oxygen control): a body behind it
    rbox(g, (112 * PS, 0.022, 50 * PS), 0.004, 'panel_body', m=MAIN.frame(130, 797, 0.0118), seg=2, flat=1)
    # under the panel, running forward
    grid(g, 14, 3, lambda a, b: pp(16 + a * 1568, 778, 0.0) + v3(0, 0.05 * b, -0.34 * b), 'black_matte', toward=v3(0, -1, 0.2))
    # glareshield: from the outer edge of the surround forward to the base of the windshield, and down both sides
    fr = lip_frames(); n = len(fr) - 1
    L3 = [Pout - nrm(Pout - Pin) * 0.006 + MAIN.pn * 0.0006 for (Pin, Pout) in fr]
    F3 = [canopy(ZF + 0.012, max(-0.97, min(0.97, Pout[0] / 0.548 * 0.97))) + v3(0, -0.004, 0) for (Pin, Pout) in fr]
    def shroud(a, b):
        i = int(round(a * n)); A = L3[i]; Bq = F3[i]
        p = A + (Bq - A) * b; p[1] += math.sin(b * math.pi) * 0.012 * max(0.0, 1 - abs(A[0]) / 0.56); return p
    grid(g, 8, n, lambda b, a: shroud(a, b), 'glareshield', toward=v3(0, 5.0, -0.9))    # (the sheet's middle face is on top)
    # gear and flap gates on the panel
    for (u, v, h) in ((712, 713, 72), (1120, 708, 72)):
        rbox(g, (0.014, 0.004, h * PS), 0.005, 'black', m=MAIN.frame(u, v, -0.001), seg=2, flat=1)


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
    grid(g, 12, 8, lambda u, v: ((-1 + 2 * u) * (cw(ZF) + 0.004), YF + v * (YS - YF), ZF), 'well', toward=cab)
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
    # roof behind the roll bar: the solid centre the rear door hinges from, with a liner; the glass goes on at each side of it
    RA = 0.40
    def roof(u, v):
        z = 0.47 + v * (zb - 0.47 + 0.004); p = canopy(z, RA * (-1 + 2 * u)); return (p[0] * 0.992, p[1] - 0.006, z)
    grid(g, 14, 10, roof, 'trim', toward=cab)
    for sd in (-1, 1):   # its edge, a rounded frame where the door window starts
        tube(g, [v3(*canopy(0.47 + i / 12 * (zb - 0.47), sd * RA)) * 1.0 + v3(-sd * 0.004, -0.008, 0) for i in range(13)], 0.014, 'frame', sides=8)
    # storm window in each side of the canopy: a rubber-edged frame on the glass with its latch
    for sd in (-1, 1):
        z0, z1, a0, a1 = -0.24, -0.07, 0.70, 0.83
        def onc(z, a, d=0.004):
            p = v3(*canopy(z, sd * a)); n = v3(p[0], p[1] - YS, 0); n = n / (math.sqrt(float(n[0] * n[0] + n[1] * n[1])) or 1); return p - n * d
        ring_ = [onc(z0 + (z1 - z0) * i / 6, a0) for i in range(7)] + [onc(z1, a0 + (a1 - a0) * i / 4) for i in range(1, 5)] \
            + [onc(z1 - (z1 - z0) * i / 6, a1) for i in range(1, 7)] + [onc(z0, a1 - (a1 - a0) * i / 4) for i in range(1, 5)]
        tube(g, ring_ + ring_[:1], 0.0042, 'rubber', sides=6)
        q = onc((z0 + z1) / 2, a1 - 0.012, 0.010)
        rbox(g, (0.009, 0.009, 0.034), 0.003, 'black', m=T(q[0], q[1], q[2]), seg=2, flat=1)
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


def wpatch(g, sd, s0, s1, c0, c1, mat, n=(10, 2), off=0.0016):
    """a patch lying on the upper wing surface (s span 0..1, c chord 0..1), just proud of the skin"""
    grid(g, n[0], n[1], lambda u, v: wing_pt(sd, s0 + (s1 - s0) * u, c0 + (c1 - c0) * v, True) + v3(0, off, 0), mat, toward=v3(sd * 3, 30, 0))


def wing_detail(g, sd):
    """what the crew sees on the upper wing: de-icing panel, control surfaces, panel joints, filler cap, walkway, tip lights"""
    def dc(s, m): return m / (1.74 - 0.84 * s ** 1.15)            # metres → chord fraction at span s
    SN = (NAC_X - WING_X0) / (WING_X1 - WING_X0); nw = 0.33 / (WING_X1 - WING_X0)   # nacelle centre and half width in span
    HL = 0.74                                                       # hinge line of flaps and aileron
    wpatch(g, sd, SN + nw, 0.975, 0.0, 0.034, 'tks', n=(16, 5)); wpatch(g, sd, 0.02, SN - nw, 0.0, 0.030, 'tks', n=(4, 5))
    for s0, s1 in ((0.012, SN - nw), (SN + nw, 0.985)):             # hinge gap: one dark line along the span
        grid(g, 14, 1, lambda u, v: wing_pt(sd, s0 + (s1 - s0) * u, HL + (v - 0.5) * dc(s0 + (s1 - s0) * u, 0.012), True) + v3(0, 0.0016, 0), 'gap', toward=v3(sd * 3, 30, 0))
    for sc in (SN + nw + 0.004, 0.565, 0.985):                      # chordwise cuts: flap ends, flap to aileron, aileron tip
        w = 0.010 / (WING_X1 - WING_X0); wpatch(g, sd, sc - w / 2, sc + w / 2, HL, 1.0, 'gap', n=(1, 6), off=0.0018)
    for cc in (0.30, 0.52):                                         # spanwise skin joints
        for s0, s1 in ((0.075, SN - nw), (SN + nw, 0.975)):
            grid(g, 12, 1, lambda u, v: wing_pt(sd, s0 + (s1 - s0) * u, cc + (v - 0.5) * dc(s0 + (s1 - s0) * u, 0.0045), True) + v3(0, 0.0016, 0), 'seam', toward=v3(sd * 3, 30, 0))
    for sc in (0.36, 0.60, 0.80):                                   # chordwise skin joints
        w = 0.0045 / (WING_X1 - WING_X0); wpatch(g, sd, sc - w / 2, sc + w / 2, 0.034, HL, 'seam', n=(1, 10), off=0.0018)
    wpatch(g, sd, 0.0, 0.070, 0.22, 0.97, 'walk', n=(2, 10), off=0.0020)        # walkway beside the cabin
    for (sc, cc) in ((0.285, 0.20), (0.44, 0.20)):                  # fuel filler caps, flush, with a red ring
        q = wing_pt(sd, sc, cc, True)
        lathe(g, [(0, 0.0034), (0.036, 0.0034), (0.040, 0.0022)], 'cap', seg=20, m=T(q[0], q[1], q[2]))
        lathe(g, [(0.040, 0.0022), (0.052, 0.0020), (0.054, 0.0)], 'cap_red', seg=20, m=T(q[0], q[1], q[2]))
    q = wing_pt(sd, 0.992, 0.035, True)                              # position light and strobe in the tip, ahead of the winglet
    rbox(g, (0.030, 0.026, 0.085), 0.011, 'lens_red' if sd < 0 else 'lens_green', m=T(q[0] + sd * 0.012, q[1] + 0.006, q[2] + 0.02), seg=3)
    rbox(g, (0.026, 0.022, 0.050), 0.009, 'lens_clear', m=T(q[0] + sd * 0.012, q[1] + 0.006, q[2] + 0.10), seg=3)
    for sc in (0.66, 0.74, 0.82, 0.90):                             # static wicks on the aileron trailing edge
        q = wing_pt(sd, sc, 1.0, True); tube(g, [v3(*q) + v3(0, 0.002, -0.01), v3(*q) + v3(0, 0.004, 0.11)], 0.0022, 'gap', sides=5)


def nacelle_detail(g, sd, stn):
    """cowling joints, hatch, air inlets and the gap behind the spinner"""
    nx = sd * NAC_X
    def st(dz):
        for i in range(len(stn) - 1):
            if stn[i][0] <= dz <= stn[i + 1][0]:
                k = (dz - stn[i][0]) / (stn[i + 1][0] - stn[i][0]); return [stn[i][j] + (stn[i + 1][j] - stn[i][j]) * k for j in (1, 2, 3)]
        return list(stn[-1][1:])
    def npt(dz, t, off=0.0035):
        a, b, dy = st(dz); return v3(nx + (a + off) * spw(math.cos(t), 0.86), NAC_Y + dy + (b + off) * spw(math.sin(t), 0.86), PROP_Z + dz)
    out = v3(nx, NAC_Y, PROP_Z + 0.8)
    def npatch(z0, z1, t0, t1, mat, n=(8, 2), off=0.0035):
        mid = npt((z0 + z1) / 2, (t0 + t1) / 2, 0.6)
        grid(g, n[0], n[1], lambda u, v: npt(z0 + (z1 - z0) * u, t0 + (t1 - t0) * v, off), mat, toward=mid + (mid - out) * 5)
    for t in (0.0, math.pi):                                        # split line between upper and lower cowling, both sides
        npatch(0.05, 1.55, t - 0.014, t + 0.014, 'gap', n=(16, 1))
    for z in (0.034, 0.74):                                         # behind the spinner, and the firewall joint
        for k in range(4):
            npatch(z, z + (0.014 if z < 0.1 else 0.007), k * math.pi / 2, (k + 1) * math.pi / 2, 'gap' if z < 0.1 else 'seam', n=(1, 9))
    T0, T1 = math.pi / 2 - 0.40, math.pi / 2 + 0.40                 # oil-check hatch on top
    for (z0, z1, t0, t1) in ((0.36, 0.60, T0, T0 + 0.022), (0.36, 0.60, T1 - 0.022, T1), (0.36, 0.366, T0, T1), (0.594, 0.60, T0, T1)):
        npatch(z0, z1, t0, t1, 'seam', n=(4, 6), off=0.004)
    for tc in (0.0, math.pi):                                       # air inlet low on each side, and the two cooling inlets under the spinner
        e = lambda u, v, tc=tc: npt(0.44 + v * 0.105 * math.cos(2 * math.pi * u), tc - 0.30 + v * 0.115 * math.sin(2 * math.pi * u), 0.004)
        mid = npt(0.44, tc - 0.30, 0.6); grid(g, 18, 2, e, 'intake', toward=mid + (mid - out) * 5)
    for tc in (-math.pi / 2 - 0.62, -math.pi / 2 + 0.62):
        e = lambda u, v, tc=tc: npt(0.078 + v * 0.036 * math.cos(2 * math.pi * u), tc + v * 0.36 * math.sin(2 * math.pi * u), 0.004)
        mid = npt(0.078, tc, 0.6); grid(g, 16, 2, e, 'intake', toward=mid + (mid - out) * 5)
    tube(g, [v3(nx - sd * 0.10, NAC_Y - 0.275, PROP_Z + 0.86), v3(nx - sd * 0.10, NAC_Y - 0.34, PROP_Z + 0.99)], 0.026, 'steel_dark', sides=10)   # exhaust stub


def exterior():
    g = Geo(); cs = [(1 - math.cos(math.pi * k / 16)) / 2 for k in range(17)]
    # nose: from the base of the windshield forward
    def nose(u, v):
        a = (-1 + 2 * u) * 0.999; z = ZF - 0.01 - v * 1.75; k = (1 - v ** 2.2) ** 0.55
        w = cw(ZF) * 1.03 * k; yt = -0.068 - 0.28 * v - 0.30 * v * v; yb = YS - 0.03 - 0.40 * v ** 1.3
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
        wing_detail(g, sd); nacelle_detail(g, sd, stn)
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
        tube(g, path[:10], wd[:10], 'prop', sides=10, ry=tk[:10], up=tw, caps=False); tube(g, path[9:], wd[9:], 'prop_tip', sides=10, ry=tk[9:], up=tw)
    tiny = 0.0008                                   # four specks on the tip circle, so the unit's box is centred on the hub
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c = hub + v3(dx * PROP_R, dy * PROP_R, -0.01)
        g.add(np.array([c, c + v3(tiny, 0, 0), c + v3(0, tiny, 0)]), [[0, 1, 2]], 'prop')
    return g


# ---- panel hardware: every switch, knob and bezel as its own piece standing on the panel ----------------------------------
HW = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'da42_controls.json')))   # da42panel.js controls + display-unit knobs
SUB_OF = {'rudTrim': 'rt', 'park': 'sl', 'heat': 'sl', 'defrost': 'sl', 'pwr': 'pw', 'fselL': 'fs', 'fselR': 'fs', 'trim': 'tw',
          'auxPumpL': 'ax', 'auxPumpR': 'ax', 'gearEmer': 'emg', 'altAir': 'alt'}
SEL_ANG = {'voterL': [-50, 0, 50], 'voterR': [-50, 0, 50], 'deice': [-60, -20, 20, 60], 'fselL': [-80, 0, 80], 'fselR': [-80, 0, 80]}


def ring(g, pl, pts_uv, half_w, height, mat, sides=8):
    """a raised rim along a closed path of drawing points (a bezel): half_w drawing units wide each side, height metres"""
    P = [pl.p(u, v, -height * 0.45) for (u, v) in pts_uv]
    tube(g, P + [P[0], P[1]], height * 0.55, mat, sides=sides, ry=half_w * pl.ps, up=-pl.pn)


def rrect(x, y, w, h, r, n=5):
    out = []
    for (cx, cy, a0) in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        out += [(cx + r * math.cos((a0 + 90 * i / n) * D2R), cy + r * math.sin((a0 + 90 * i / n) * D2R)) for i in range(n + 1)]
    return out


def hardware(root, objs, ctrl):
    stat = {}                                # static pieces, one mesh per plane (each is cut off behind its own plane in the app)
    def st(pl):
        key = getattr(pl, 'sid', 'main'); return stat.setdefault(key, (Geo(), pl))[0]
    def unit(name, g, pivot, **spec):
        objs[name] = C.to_object(name, g, pivot=pivot, parent=root); ctrl[name] = dict(pivot=pivot, fg=1, **spec)
    for c in HW['ctl']:
        cid, t, x, y = c['id'], c['t'], c['x'], c['y']
        pl = SUBS[SUB_OF[cid]] if cid in SUB_OF else MAIN
        k = pl.ps; mm = 0.001 * k / PS; F = pl.frame(x, y, 0.0); S_ = st(pl)
        axn = [round(float(v), 6) for v in pl.pn]; down = [round(float(v), 6) for v in nrm(pl.ey)]
        if t in ('tog', 'tog3', 'guard'):
            lathe(S_, [(0, 0), (8.6 * k, 0), (8.6 * k, 2.4 * mm), (6.0 * k, 3.0 * mm), (5.2 * k, 3.0 * mm), (4.6 * k, 6.0 * mm), (0, 6.0 * mm)], 'alu', seg=6, m=F)
            g = Geo(); piv = pl.p(x, y, -3 * mm)
            lathe(g, [(0, 0), (2.3 * mm, 0), (2.6 * mm, 8 * mm), (3.3 * mm, 13.5 * mm), (3.2 * mm, 15.5 * mm), (2.0 * mm, 16.8 * mm), (0, 16.8 * mm)], 'chrome', seg=12, m=pl.frame(x, y, -3 * mm))
            unit('sw_' + cid, g, piv, rotate=dict(axis=[1, 0, 0], unit='deg', min=-24, max=24), io=dict(id=cid, k='tog3' if t == 'tog3' else 'tog'))
            if t == 'guard':                # red cover over the emergency switch, hinged at its top edge
                g = Geo(); piv = pl.p(x, y - 32, -2 * mm)
                rbox(g, (28 * k, 15 * mm, 46 * k), (2.5 * mm, 3 * mm, 2.5 * mm), 'red', m=M(pl.frame(x, y - 9, 0.0), T(0, 12 * mm, 0)), seg=3, flat=1)
                unit('gd_' + cid, g, piv, rotate=dict(axis=[1, 0, 0], unit='deg', min=-100, max=0), io=dict(id=cid, k='guard'))
        elif t == 'rocker':
            w, h = (24, 40) if c['big'] else (20, 34)
            rbox(S_, ((w + 6) * k, 2.4 * mm, (h + 6) * k), 1.2 * mm, 'black', m=M(F, T(0, 1.2 * mm, 0)), seg=2, flat=1)
            g = Geo(); L = h * k
            def dish(q, n, L=L, mm=mm):
                px, py, pz = q; return (px, py + (1.5 * mm * (2 * pz / L) ** 2 if py > 0 else 0), pz)
            rbox(g, (w * k, 5 * mm, L), (1.4 * mm, 1.8 * mm, 1.4 * mm), 'rocker_red' if c['red'] else 'rocker_white', m=M(F, T(0, 3.2 * mm, 0)), seg=3, flat=(1, 1, 6), deform=dish)
            unit('sw_' + cid, g, pl.p(x, y, -1.6 * mm), rotate=dict(axis=[1, 0, 0], unit='deg', min=-11, max=11), io=dict(id=cid, k='rocker'))
        elif t in ('rot', 'rotsel') and cid != 'audVol':
            r = (c['r'] or 13) * k
            prof = [(0, 0), (r + 3 * k, 0), (r + 3 * k, 1.2 * mm), (r, 2.0 * mm), (r * 0.93, 11 * mm), (r * 0.78, 12.5 * mm), (0, 12.5 * mm)]
            if cid == 'oxy':
                lathe(S_, prof, 'knob_black', seg=20, m=F); continue
            g = Geo(); lathe(g, prof, 'knob_black', seg=24, m=F)
            if t == 'rot':
                rbox(g, (1.5 * mm, 0.9 * mm, r * 0.62), 0.3 * mm, 'white', m=M(F, T(0, 12.6 * mm, -r * 0.5)), seg=1, flat=1)
                unit('kn_' + cid, g, pl.p(x, y, 0.0), rotate=dict(axis=axn, unit='deg', min=-135, max=135), io=dict(id=cid, k='rot'))
            else:
                rbox(g, (2.4 * mm, 3.0 * mm, r * 1.86), 0.8 * mm, 'white', m=M(F, T(0, 12.4 * mm, 0)), seg=2, flat=1)
                rbox(g, (2.6 * mm, 3.2 * mm, r * 0.5), 0.8 * mm, 'knob_black', m=M(F, T(0, 12.4 * mm, r * 0.7)), seg=2, flat=1)
                a = SEL_ANG[cid]; unit('kn_' + cid, g, pl.p(x, y, 0.0), rotate=dict(axis=axn, unit='deg', min=min(a), max=max(a)), io=dict(id=cid, k='sel', ang=a))
        elif t == 'push':
            r = (c['r'] or 10) * k
            lathe(S_, [(0, 0), (r + 3 * k, 0), (r + 3 * k, 1.6 * mm), (r, 2.2 * mm), (r, 3.6 * mm), (r * 0.8, 4.6 * mm), (0, 4.8 * mm)], 'knob_black', seg=18, m=F)
        elif t == 'key':
            lathe(S_, [(0, 0), (15 * k, 0), (15 * k, 1.6 * mm), (12 * k, 2.6 * mm), (12 * k, 4.2 * mm), (0, 4.2 * mm)], 'alu', seg=22, m=F)
            g = Geo(); rbox(g, (6 * k, 12 * mm, 30 * k), (1.6 * mm, 3 * mm, 3 * mm), 'black', m=M(F, T(0, 10 * mm, 0)), seg=3, flat=1)
            unit('kn_' + cid, g, pl.p(x, y, 0.0), rotate=dict(axis=axn, unit='deg', min=-45, max=45), io=dict(id=cid, k='key'))
        elif t == 'cb':
            lathe(S_, [(0, 0), (6.4 * k, 0), (6.4 * k, 1.5 * mm), (5.0 * k, 2.0 * mm), (5.0 * k, 5.0 * mm), (4.3 * k, 5.8 * mm), (0, 5.8 * mm)], 'black', seg=12, m=F)
        elif t == 'pull' and not c['lever']:
            lathe(S_, [(0, 0), (4 * k, 0), (4 * k, 6 * mm), (8.5 * k, 7 * mm), (8.5 * k, 11 * mm), (7 * k, 12.5 * mm), (0, 12.5 * mm)], 'knob_black', seg=18, m=F)
        elif t == 'pull':
            rbox(S_, (8 * k, 8 * mm, 6 * k), 1 * mm, 'alu', m=M(F, T(0, 4 * mm, 0)), seg=1, flat=1)
            rbox(S_, (40 * k, 9 * mm, 12 * k), 3 * mm, 'red' if c['red'] else 'knob_black', m=M(F, T(0, 11 * mm, 0)), seg=3, flat=(3, 1, 1))
        elif t == 'slide':
            g = Geo(); rbox(g, (4 * k, 6 * mm, 4 * k), 0.8 * mm, 'alu', m=M(F, T(0, 3 * mm, 0)), seg=1, flat=1)
            rbox(g, (22 * k, 7 * mm, 12 * k), 2.2 * mm, 'knob_black', m=M(F, T(0, 8 * mm, 0)), seg=3, flat=1)
            unit('sl_' + cid, g, pl.p(x, y, 0.0), translate=dict(axis=down, min=-22 * k, max=22 * k), io=dict(id=cid, k='slide', s=44 * k))
        elif t == 'park':
            g = Geo(); Fk = pl.frame(x, y - 23.5, 0.0)
            rbox(g, (5 * k, 8 * mm, 5 * k), 0.8 * mm, 'alu', m=M(Fk, T(0, 4 * mm, 0)), seg=1, flat=1)
            rbox(g, (32 * k, 10 * mm, 13 * k), 3 * mm, 'red', m=M(Fk, T(0, 11 * mm, 0)), seg=3, flat=(3, 1, 1))
            unit('sl_' + cid, g, pl.p(x, y - 23.5, 0.0), translate=dict(axis=down, positions={'REL': 0, 'SET': 47 * k}), io=dict(id=cid, k='park', s=47 * k))
        elif t == 'fsel':
            lathe(S_, [(0, 0), (20 * k, 0), (20 * k, 1.2 * mm), (18 * k, 1.8 * mm), (0, 1.8 * mm)], 'black', seg=24, m=F)
            g = Geo(); lathe(g, [(0, 0), (6 * k, 0), (6 * k, 5 * mm), (4.5 * k, 6 * mm), (0, 6 * mm)], 'steel_dark', seg=14, m=F)
            rbox(g, (8 * k, 5 * mm, 30 * k), (1.5 * mm, 1.5 * mm, 2 * mm), 'steel_dark', m=M(F, T(0, 4.4 * mm, -3 * k)), seg=2, flat=1)
            rbox(g, (9 * k, 5.6 * mm, 8 * k), 1.4 * mm, 'red', m=M(F, T(0, 4.6 * mm, -14 * k)), seg=2, flat=1)
            a = SEL_ANG[cid]; unit('kn_' + cid, g, pl.p(x, y, 0.0), rotate=dict(axis=axn, unit='deg', min=-80, max=80), io=dict(id=cid, k='sel', ang=a))
        elif t == 'vent':
            r = c['r'] * k
            lathe(S_, [(0, 0.8 * mm), (r * 0.99, 0.8 * mm), (r, 4.0 * mm), (r + 1.5 * k, 5.4 * mm), (r + 6 * k, 3.4 * mm), (r + 6 * k, 0), (0, 0)], 'black', seg=36, m=F)
            lathe(S_, [(0, 0.8 * mm), (r * 0.94, 0.8 * mm), (r * 0.90, 3.4 * mm), (r * 0.62, 6.4 * mm), (r * 0.24, 7.4 * mm), (r * 0.20, 9.4 * mm), (0, 9.6 * mm)], 'knob_black', seg=28, m=F)
            for i in range(6):
                rbox(S_, (r * 0.62, 2.0 * mm, 1.4 * mm), 0.5 * mm, 'steel_dark', m=M(F, RY(i * math.pi / 3 + 0.3), T(r * 0.56, 5.4 * mm, 0), RZ(-0.42)), seg=1, flat=1)
    # backup instruments: raised bezel rings; compass housing
    for (x, y) in ((673, 296), (803, 296), (933, 296)):
        ring(st(MAIN), MAIN, [(x + 53 * math.cos(2 * math.pi * i / 40), y + 53 * math.sin(2 * math.pi * i / 40)) for i in range(40)], 3.6, 0.0045, 'black', sides=8)
    lathe(st(MAIN), [(0, 0), (6 * PS, 0), (6 * PS, 6e-3), (4.6 * PS, 7e-3), (0, 7e-3)], 'knob_black', seg=14, m=MAIN.frame(933 - 40, 296 + 40, 0.0))      # altimeter setting knob
    lathe(st(MAIN), [(0, 0), (5 * PS, 0), (5 * PS, 5e-3), (3.8 * PS, 6e-3), (0, 6e-3)], 'knob_black', seg=14, m=MAIN.frame(803 + 40, 296 + 40, 0.0))      # attitude: caging / pitch knob
    ring(st(MAIN), MAIN, rrect(1054 - 46, 296 - 30, 92, 64, 14), 3.4, 0.0075, 'black', sides=8)
    # display units and the audio panel: raised rim round the unit, a step round the screen, the bezel knobs
    for gid in ('bzP', 'bzM'):
        d = HW['gdu'][gid]; r = d['rect']; sc = d['screen']
        ring(st(MAIN), MAIN, rrect(r[0] + 3, r[1] + 3, r[2] - 6, r[3] - 6, 9), 3.0, 0.0042, 'black', sides=8)
        ring(st(MAIN), MAIN, rrect(sc[0] - 2.5, sc[1] - 2.5, sc[2] + 5, sc[3] + 5, 3), 2.2, 0.0022, 'black', sides=6)
        for kn in d['knobs']:
            b = kn['r']; cx, cy, rr = b[0] + b[2] / 2, b[1] + b[3] / 2, b[2] / 2 * PS
            lathe(st(MAIN), [(0, 0), (rr, 0), (rr, 6.5e-3), (rr * 0.9, 8e-3), (rr * 0.66, 8e-3), (rr * 0.66, 13e-3), (rr * 0.56, 14.5e-3), (0, 14.5e-3)], 'knob_black', seg=22, m=MAIN.frame(cx, cy, 0.0))
    ring(st(MAIN), MAIN, rrect(686 + 2.5, 383 + 2.5, 74 - 5, 287 - 5, 5), 2.4, 0.0036, 'black', sides=8)
    for key, (g, pl) in stat.items():
        if g.n:
            r = pl.rect; piv = pl.p(r[0] + r[2] / 2, r[1] + r[3] / 2, -0.004)
            unit('hw_' + key, g, piv, translate=dict(axis=[0, 1, 0], positions={'FIXED': 0}), note='does not move')


def build():
    C.reset(); C.material_specs(MATS, TEX)
    root = C.empty('da42_cockpit'); objs = {}; ctrl = {}
    objs['shell'] = C.to_object('shell', shell(), parent=root)
    objs['exterior'] = C.to_object('exterior', exterior(), parent=root, ao=False)
    for nm, sd in (('prop_L', -1), ('prop_R', 1)):
        objs[nm] = C.to_object(nm, propeller(sd), parent=root, ao=False)
    objs['panel_face'] = MAIN.face('panel_face', root, nu=56, nv=8, outline=topv)
    for sid, sp in SUBS.items():
        objs[sid + '_face'] = sp.face(sid + '_face', root, nu=2, nv=2, off=-0.0008)
    g = Geo(); grid(g, 44, 30, lambda a, b: canopy(ZF + 0.005 + b * (0.47 - ZF - 0.01), -1 + 2 * a), 'glass', toward=v3(0, -0.2, 0))
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
    lp = MAIN.p(800, 144, -LIP_H)
    objs['glare_lip'] = C.to_object('glare_lip', glare_lip(), pivot=lp, parent=root)
    ctrl['glare_lip'] = dict(pivot=lp, fg=1, translate=dict(axis=[0, 1, 0], positions={'FIXED': 0}), note='does not move')
    hardware(root, objs, ctrl)
    # power levers on the engine-control console (pivot behind the face at the slot centre)
    pw = SUBS['pw']
    for nm, u, sd in (('power_L', 720, -1), ('power_R', 790, 1)):
        piv = pw.p(u, 854, LEV_D); out = -pw.pn
        m = basis(piv, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out))
        g = Geo(); rbox(g, (0.007, LEV_D + 0.078, 0.018), 0.003, 'alu', m=M(m, T(0, (LEV_D + 0.078) / 2, 0)), seg=2, flat=1)
        # the handle: a black bar across the top of the lever, reaching outward
        rbox(g, (0.058, 0.030, 0.034), (0.012, 0.013, 0.014), 'knob_black', m=M(m, T(sd * 0.016, LEV_D + 0.088, 0)), seg=5, flat=(3, 1, 1))
        objs[nm] = C.to_object(nm, g, pivot=piv, parent=root)
        ang = lambda v: round(-math.degrees(math.atan((854 - v) * pw.ps / LEV_D)), 2)
        ctrl[nm] = dict(pivot=piv, rotate=dict(axis=[1, 0, 0], unit='deg', positions={'MAX': ang(802), 'IDLE': ang(906)}, value_to_angle='angle = −atan((854 − v)·%g/%g), v = 906 − 104·power (panel units); − = knob up/forward' % (pw.ps, LEV_D), note='modelled at mid travel (0°)'))
    # flap switch: flap-shaped tab in its gate, translates down the panel UP / APP / LDG
    p = pp(1120, 678, -0.002); dn = nrm(MAIN.ey)
    fm = basis(p, v3(1, 0, 0), -MAIN.pn, dn)
    g = Geo()
    rbox(g, (0.006, 0.02, 0.006), 0.002, 'chrome', m=M(fm, T(0, 0.01, 0)), seg=1, flat=1)
    rbox(g, (0.04, 0.012, 0.02), 0.004, 'white', m=M(fm, T(0, 0.024, 0)), seg=2, flat=(3, 1, 1))
    objs['flap_switch'] = C.to_object('flap_switch', g, pivot=p, parent=root)
    ctrl['flap_switch'] = dict(pivot=p, translate=dict(axis=list(np.round(dn, 6)), positions={'UP': 0, 'APP': 30 * PS, 'LDG': 60 * PS}))
    # gear handle: round wheel knob on a rod, translates down the gate (UP modelled)
    p = pp(712, 683, -0.002)
    g = Geo()
    tube(g, [p, p - MAIN.pn * 0.045], 0.004, 'chrome', sides=8)
    gm = M(basis(p - MAIN.pn * 0.05, v3(1, 0, 0), -MAIN.pn, dn), RZ(math.pi / 2))
    lathe(g, [(0.0, -0.008), (0.010, -0.008), (0.015, -0.006), (0.017, 0), (0.015, 0.006), (0.010, 0.008), (0, 0.008)], 'white', seg=22, m=gm)
    objs['gear_handle'] = C.to_object('gear_handle', g, pivot=p, parent=root)
    ctrl['gear_handle'] = dict(pivot=p, translate=dict(axis=list(np.round(dn, 6)), positions={'UP': 0, 'DOWN': 60 * PS}))
    # elevator trim wheel (vertical in the console)
    wc = SUBS['tw'].p(942, 858, 0.034)
    g = Geo()
    gear = [((0.056 if k % 2 == 0 else 0.053) * math.cos(2 * math.pi * k / 72), (0.056 if k % 2 == 0 else 0.053) * math.sin(2 * math.pi * k / 72)) for k in range(72)]
    prism(g, gear, 0.016, 'black', m=M(T(*wc), RY(math.pi / 2)))
    rbox(g, (0.020, 0.006, 0.01), 0.002, 'white', m=M(T(*wc), RX(0.3), T(0, 0.054, 0)), seg=1, flat=1)
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
    faces = {'panel_face': MAIN, **{sid + '_face': sp for sid, sp in SUBS.items()}}
    side = dict(
        aircraft='DA42', file='da42-cockpit.glb', units='metres', frame='x right, y up, z aft (forward = −z); same frame as da42-3d.js/cockpit3d.js',
        origin='aircraft centre line at the cabin reference height (9 cm below the left-seat design eye)',
        eye=dict(left=list(EYE_L), right=list(EYE_R)), triangles=tris,
        nodes=sorted([o.name for o in objs.values()] + ['da42_cockpit']),
        faces={k: dict(p.json(), drawing='da42panel.js 1600×980', drawing_size=[1600, 980], uv='u = (x − rect.x)/rect.w, v = (y − rect.y)/rect.h (glTF UV, v down: texture.flipY = false)',
                       **({'top_edge': 'follows the padded surround of the panel (da42panel.js RIM); UV spans the whole rect'} if k == 'panel_face' else {'note': 'a console group on its own plane (da42-3d.js subs)'})) for k, p in faces.items()},
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
