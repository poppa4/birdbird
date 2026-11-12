"""Cessna 172-class (high wing, four seats, carburetted 172P-style panel) cockpit interior → models/c172-cockpit.glb

Run:  python3 tools/blender/c172.py [outdir] [--no-render]
Cockpit frame (same as c172-3d.js / cockpit3d.js): metres, x right, y up, z aft; origin on the centre line at the cabin
reference height, 9 cm below the left-seat design eye. All proportions: see SOURCES.md.
Panel: the live 2D panel drawing (c172panel.js, 2000 × 1320 units, 1/1900 m per unit, top leaning 6° away) is placed exactly
where c172-3d.js puts it, so `panel_face` can carry the live panel texture, or the DOM panel can keep being overlaid.
"""
import sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import cocklib as C
from cocklib import Geo, grid, rbox, box, tube, lathe, prism, disc, T, RX, RY, RZ, S, M, basis, xf, v3, nrm, D2R

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.path.join(os.path.dirname(__file__), '../../models')
RENDER = '--no-render' not in sys.argv
TEX = os.environ.get('COCKPIT_TEX', '/tmp/blender3d/tex')
SHOTS = os.environ.get('COCKPIT_SHOTS', '/tmp/gltfshots')
PANEL_IMG = os.environ.get('PANEL_IMG_C172', '/tmp/blender3d/c172_full.png')

# ------------------------------------------------------------------ dimensions (cockpit frame), as in c172-3d.js
YF, YR, YS = -1.0, 0.31, -0.21          # floor, headliner, window sill
ZWB, ZWT, ZB, ZR, XW = -1.06, -0.60, 0.40, 1.25, 0.545   # windshield base/top, door (B) post, rear bulkhead, half width
EYE_L, EYE_R = (-0.26, 0.09, 0.0), (0.26, 0.09, 0.0)
PS, TILT, PT, LB, COLY, YKX, SUBY = 1 / 1900, 6 * D2R, 296, 1080, 812, (480, 1528), 962
EXv = v3(PS, 0, 0); EYv = v3(0, -PS * math.cos(TILT), PS * math.sin(TILT)); PN = nrm(np.cross(EXv, EYv))   # PN: into the panel
PO = v3(0, -0.12, -0.80) - EXv * 1000 - EYv * PT


def pp(u, v, o=0.0):
    return PO + EXv * u + EYv * v + PN * o


def ws(a, t):
    """windshield surface: a across (−1 left … 1 right), t from the base (0) to the roof (1)"""
    b = v3(a * 0.50, -0.098 + 0.02 * a * a, ZWB + 0.10 * a * a)
    p = v3(a * 0.535, YR - 0.004, ZWT + 0.04 * a * a)
    q = b + (p - b) * t
    q[2] -= 0.035 * math.sin(math.pi * t) * (1 - 0.5 * a * a)
    return q


def zFront(y):
    return -0.96 if y < -0.078 else -0.96 + 0.395 * min(1, (y + 0.078) / 0.385)


def lipV(u):
    t = max(0, min(1, (u - 30) / 1940)); return PT - 14 - 92 * t * (1 - t)


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ materials (sRGB colours; tile = metres per texture repeat)
MATS = {
    'trim':      dict(color=(0.62, 0.60, 0.56), rough=0.72, tex='plastic', tile=0.15, nstr=0.6),
    'trim_dark': dict(color=(0.44, 0.43, 0.40), rough=0.75, tex='plastic', tile=0.15, nstr=0.6),
    'headliner': dict(color=(0.78, 0.77, 0.73), rough=0.85, tex='headliner', tile=0.10, nstr=0.5),
    'frame':     dict(color=(0.66, 0.65, 0.61), rough=0.6, tex='plastic', tile=0.15, nstr=0.4),
    'glareshield': dict(color=(0.055, 0.055, 0.058), rough=0.82, tex='leather', tile=0.18, nstr=0.8),
    'panel_body': dict(color=(0.10, 0.10, 0.105), rough=0.55, tex='plastic', tile=0.15, nstr=0.35),
    'carpet':    dict(color=(0.21, 0.20, 0.19), rough=0.97, tex='carpet', tile=0.25, nstr=1.0),
    'firewall':  dict(color=(0.13, 0.13, 0.13), rough=0.9, tex='carpet', tile=0.25, nstr=0.6),
    'fabric':    dict(color=(0.27, 0.29, 0.33), rough=0.92, tex='fabric', tile=0.12, nstr=1.0),
    'vinyl':     dict(color=(0.14, 0.135, 0.13), rough=0.55, tex='leather', tile=0.12, nstr=0.5),
    'alu':       dict(color=(0.62, 0.63, 0.65), rough=0.42, metal=0.55, tex='metal', tile=0.2, nstr=0),
    'chrome':    dict(color=(0.78, 0.78, 0.80), rough=0.22, metal=0.6),
    'steel_dark': dict(color=(0.22, 0.23, 0.24), rough=0.5, metal=0.5),
    'black':     dict(color=(0.035, 0.035, 0.04), rough=0.42),
    'black_matte': dict(color=(0.045, 0.045, 0.05), rough=0.8, tex='plastic', tile=0.1, nstr=0.4),
    'rubber':    dict(color=(0.03, 0.03, 0.03), rough=0.92),
    'red_knob':  dict(color=(0.62, 0.06, 0.04), rough=0.35),
    'white':     dict(color=(0.86, 0.86, 0.84), rough=0.4),
    'pedal':     dict(color=(0.16, 0.17, 0.18), rough=0.5, metal=0.4),
    'yoke':      dict(color=(0.05, 0.05, 0.055), rough=0.4),
    'yoke_hub':  dict(color=(0.13, 0.135, 0.14), rough=0.5),
    'placard':   dict(color=(0.80, 0.79, 0.76), rough=0.5),
    # exterior (no AO atlas)
    'skin':      dict(color=(0.93, 0.93, 0.91), rough=0.32, ao=False),
    'skin_under': dict(color=(0.80, 0.80, 0.78), rough=0.45, ao=False),
    'stripe':    dict(color=(0.20, 0.30, 0.46), rough=0.35, ao=False),
    'tyre':      dict(color=(0.05, 0.05, 0.05), rough=0.9, ao=False),
    # live surfaces & glazing
    'panel_face': dict(color=(1, 1, 1), rough=0.6, ao=False, tex='panelph', nstr=0),
    'glass':     dict(color=(0.80, 0.86, 0.90), rough=0.05, alpha=0.10, double=True, ao=False),
}

SEAT_Z = -0.04  # front seat cushion centre (seat adjusted so the design eye is ~0.25 m ahead of the backrest)


# ------------------------------------------------------------------ cabin shell
def shell():
    g = Geo(); cab = v3(0, -0.3, 0.2)
    # floor: carpet; rises over the last 14 cm into the toe board, then the firewall
    def floor(u, v):
        z = -1.12 + v * (ZR + 1.12)
        y = YF + 0.11 * min(1, max(0, (-0.98 - z) / 0.14))
        return (-XW - 0.02 + u * 2 * (XW + 0.02), y, z)
    grid(g, 12, 30, floor, 'carpet', toward=cab)
    grid(g, 10, 6, lambda u, v: (-XW - 0.02 + u * 2 * (XW + 0.02), YF + 0.11 + v * (-0.50 - YF - 0.11), -1.12 - 0.04 * v), 'firewall', toward=cab)
    for sd in (-1, 1):
        # lower side wall / door panel (from floor to sill), slight outward bow
        def wall(u, v):
            z = -1.12 + u * (ZR + 1.12)
            return (sd * (XW + 0.012 * math.sin(math.pi * v)), YF + v * (YS - YF), z)
        grid(g, 28, 8, wall, 'trim', toward=cab)
        # sill ledge
        grid(g, 28, 1, lambda u, v: (sd * (XW - 0.035 * (1 - v)), YS + 0.002, -1.12 + u * (ZR + 1.12)), 'trim_dark', toward=v3(0, 0.4, 0))
        # door: armrest with a pull cup, door handle, pocket, seam around the door
        rbox(g, (0.06, 0.05, 0.36), (0.02, 0.02, 0.03), 'vinyl', m=T(sd * (XW - 0.035), -0.42, 0.02), seg=3, flat=(2, 1, 4))
        rbox(g, (0.03, 0.012, 0.11), 0.005, 'black', m=T(sd * (XW - 0.07), -0.40, -0.10), seg=2, flat=1)
        tube(g, [(sd * (XW - 0.006), -0.27, -0.21), (sd * (XW - 0.03), -0.27, -0.19), (sd * (XW - 0.03), -0.27, -0.09), (sd * (XW - 0.006), -0.27, -0.07)], 0.007, 'alu', sides=8)
        rbox(g, (0.025, 0.16, 0.30), 0.01, 'trim_dark', m=T(sd * (XW - 0.005), -0.80, -0.20), seg=2, flat=1)
        # upholstered door insert (raised, with a horizontal seam)
        def ins(q, n):
            x, y, z = q
            if x * -sd > 0:
                x -= sd * 0.004 * math.exp(-((y - 0.02) / 0.006) ** 2)
            return (x, y, z)
        rbox(g, (0.02, 0.36, 0.95), (0.008, 0.02, 0.02), 'fabric', m=T(sd * (XW - 0.002), -0.60, -0.36), seg=2, flat=(1, 8, 2), deform=ins)
        door = [(sd * (XW + 0.0005), YS - 0.004, ZB - 0.035), (sd * (XW + 0.0005), YF + 0.07, ZB - 0.035), (sd * (XW + 0.0005), YF + 0.07, -0.93),
                (sd * (XW + 0.0005), -0.40, -0.98), (sd * (XW + 0.0005), YS - 0.004, -0.98)]
        tube(g, door, 0.0035, 'rubber', sides=5, caps=False)
        # window frames: B post, rear post, upper rail, sill rail; door seal around the window opening
        rbox(g, (0.045, YR - YS + 0.02, 0.07), 0.012, 'frame', m=T(sd * (XW + 0.004), (YS + YR) / 2, ZB), seg=2, flat=(1, 3, 1))
        rbox(g, (0.045, YR - YS + 0.02, 0.08), 0.012, 'frame', m=T(sd * (XW + 0.004), (YS + YR) / 2, ZR - 0.08), seg=2, flat=(1, 3, 1))
        rbox(g, (0.05, 0.045, ZR - ZWT + 0.02), 0.012, 'frame', m=T(sd * (XW + 0.002), YR - 0.02, (ZWT + ZR) / 2), seg=2, flat=(1, 1, 6))
        rbox(g, (0.04, 0.03, ZR + 1.0), 0.01, 'frame', m=T(sd * (XW + 0.002), YS + 0.012, (ZR - 1.0) / 2), seg=2, flat=(1, 1, 6))
        # A post along the windshield edge: elliptical tube
        ap = [ws(sd, i / 12) + v3(sd * 0.010, 0, 0.004) for i in range(13)]
        tube(g, ap, 0.034, 'frame', sides=10, ry=0.022, up=v3(sd, 0, 0.35), caps=True)
        # kick panel ahead of the door, up to the windshield corner
        grid(g, 4, 6, lambda u, v: (sd * XW, YS + v * (-0.078 - YS), -1.12 + u * 0.16), 'trim', toward=cab)
        grid(g, 4, 6, lambda u, v: (sd * XW, YF + v * (YS - YF), -1.12 + u * 0.16), 'trim_dark', toward=cab)
        # fresh-air vent at the wing root (upper front corner): tube from the roof with a nozzle
        vb = v3(sd * (XW - 0.07), YR - 0.03, -0.50)
        tube(g, [vb + v3(0, 0.03, 0), vb, vb + v3(-sd * 0.01, -0.035, 0.02)], [0.03, 0.028, 0.024], 'trim_dark', sides=14)
        lathe(g, [(0.0, 0.0), (0.02, 0.0), (0.022, -0.006), (0.016, -0.03), (0.0, -0.03)], 'black', seg=16,
              m=M(T(*(vb + v3(-sd * 0.01, -0.04, 0.022))), RX(-0.5)))
        # sun visor folded up against the headliner, on its hinge rod
        vc = v3(sd * 0.27, YR - 0.025, ZWT + 0.12)
        rbox(g, (0.33, 0.016, 0.14), (0.02, 0.006, 0.02), 'trim', m=M(T(*vc), RX(0.12)), seg=2, flat=(4, 1, 2))
        tube(g, [vc + v3(sd * 0.17, 0.0, -0.065), vc + v3(-sd * 0.17, 0.0, -0.065)], 0.005, 'alu', sides=8)
        rbox(g, (0.03, 0.02, 0.03), 0.006, 'black', m=T(*(vc + v3(sd * 0.185, 0.008, -0.065))), seg=1, flat=1)
        # shoulder harness: strap from the upper wall behind the seat down to the inboard buckle, inertia reel cover
        sx = sd * 0.27
        strap = [v3(sd * (XW - 0.02), YR - 0.06, ZB + 0.10), v3(sx + sd * 0.12, 0.05, SEAT_Z + 0.33), v3(sx + sd * 0.02, -0.25, SEAT_Z + 0.22),
                 v3(sx - sd * 0.08, -0.52, SEAT_Z + 0.10), v3(sx - sd * 0.18, -0.68, SEAT_Z + 0.02)]
        pts = [strap[0]]
        for i in range(len(strap) - 1):
            for k in range(1, 5):
                pts.append(strap[i] + (strap[i + 1] - strap[i]) * k / 4)
        tube(g, pts, 0.024, 'fabric', sides=4, ry=0.0025, up=v3(0, 0, 1), caps=True)
        rbox(g, (0.05, 0.09, 0.05), 0.01, 'trim_dark', m=T(sd * (XW - 0.03), YR - 0.06, ZB + 0.10), seg=2, flat=1)
        rbox(g, (0.05, 0.016, 0.035), 0.004, 'alu', m=M(T(*(strap[-1] + v3(0, 0.0, 0.0))), RZ(sd * 0.6)), seg=1, flat=1)
    # headliner with a shallow dome, ribs every 0.35 m
    def head(u, v):
        x = -XW + u * 2 * XW; z = ZWT + 0.02 + v * (ZR - ZWT - 0.02)
        return (x, YR + 0.03 * (1 - (x * x) / (XW * XW)), z)
    grid(g, 14, 22, head, 'headliner', toward=cab)
    for zr in (-0.10, 0.40, 0.85):
        tube(g, [(x, YR + 0.03 * (1 - x * x / (XW * XW)) - 0.006, zr) for x in np.linspace(-XW + 0.03, XW - 0.03, 9)], 0.009, 'headliner', sides=5)
    # windshield header (top frame) and the centre strip carrying the compass
    hdr = [ws(-1 + i / 8, 1) + v3(0, -0.012, 0.016) for i in range(17)]
    tube(g, hdr, 0.035, 'frame', sides=8, ry=0.022, up=v3(0, 0.3, 1))
    # overhead console: dome light and the cabin-air knob
    rbox(g, (0.20, 0.03, 0.30), 0.012, 'trim', m=T(0, YR + 0.02, -0.18), seg=3, flat=(3, 1, 3))
    rbox(g, (0.08, 0.008, 0.05), 0.003, 'white', m=T(0, YR + 0.004, -0.10), seg=1, flat=1)
    # compass on the centre strip at the top of the windshield (the live compass card sits on its face)
    cp = v3(0, YR - 0.115, -0.675)
    rbox(g, (0.085, 0.062, 0.06), 0.016, 'black', m=T(*(cp + v3(0, 0, -0.03))), seg=3, flat=1)
    rbox(g, (0.03, 0.08, 0.02), 0.006, 'black', m=T(*(cp + v3(0, 0.055, -0.045))), seg=2, flat=1)
    # OAT gauge on the windshield (left of centre): the probe goes out through the glass, a nut clamps it on the inside and
    # the gauge body sits right against it (local +Y points into the cabin; the glass is at about h = −0.0075). The live dial
    # (c172-3d.js, sub-plane 'oat') lies on the body's face at h = 0.024
    op = ws(-0.62, 0.66) + v3(0, 0, 0.012)
    om = M(T(*op), RX(math.pi / 2 + 0.6))
    lathe(g, [(0, -0.075), (0.0028, -0.075), (0.0028, -0.009), (0.010, -0.009), (0.010, -0.003), (0.0065, -0.003), (0.0065, 0.004), (0, 0.004)], 'chrome', seg=12, m=om)
    lathe(g, [(0, 0.003), (0.0155, 0.003), (0.0162, 0.006), (0.0162, 0.024), (0, 0.024)], 'black', seg=20, m=om)
    # rear baggage bulkhead
    grid(g, 8, 8, lambda u, v: (-XW + u * 2 * XW, YF + v * (YR + 0.02 - YF), ZR), 'trim_dark', toward=cab)
    panel_body(g)
    pedestal(g)
    for xc in (-0.27, 0.27):
        seat_front(g, xc)
    seat_rear(g)
    return g


def panel_body(g):
    """the instrument panel structure around panel_face, the padded glareshield and lip, the lower trim and knee area"""
    cab = v3(0, -0.3, 0.2)
    # backing slab just behind the face (fills any alpha in the live panel texture), to the side walls
    top = [(u, lipV(u)) for u in np.linspace(34, 1966, 25)]
    for sd in (-1, 1):
        u0 = 34 if sd < 0 else 1966
        # end caps from the panel edge to the wall
        def cap(a, b):
            p = pp(u0, lipV(u0) + b * (LB - lipV(u0)), 0.002)
            return (sd * (abs(p[0]) + a * (XW - abs(p[0]))), p[1], p[2] + a * 0.02)
        grid(g, 1, 8, cap, 'panel_body', toward=cab)
    back = Geo()
    grid(back, 24, 1, lambda a, b: pp(34 + a * 1932, lipV(34 + a * 1932) + b * (LB - lipV(34 + a * 1932)), 0.006), 'panel_body', toward=cab)
    g.merge(back)
    # panel rim: thin raised frame around the face (bottom and sides), rounded
    rim = [pp(36, lipV(36) + 6, -0.002), pp(36, LB - 2, -0.002), pp(1964, LB - 2, -0.002), pp(1964, lipV(1964) + 6, -0.002)]
    tube(g, rim, 0.006, 'panel_body', sides=6, caps=True)
    # bottom roll under the panel (padded) and the under-panel surface back to the firewall
    bot = [pp(u, LB + 6, -0.012) for u in np.linspace(34, 1966, 21)]
    tube(g, bot, 0.018, 'vinyl', sides=10, ry=0.014, up=-PN)
    grid(g, 16, 3, lambda a, b: pp(34 + a * 1932, LB + 14, 0.0) + v3(0, 0.03 * b, -0.30 * b), 'black_matte', toward=v3(0, -1.0, 0.2))
    # glareshield: padded lip roll along the panel top, then the shroud to the windshield base
    lip = [pp(u, lipV(u) - 3, -0.006) for u in np.linspace(30, 1970, 33)]
    tube(g, lip, 0.022, 'glareshield', sides=12, ry=0.016, up=v3(0, 1, 0.2), caps=True)
    n = 32
    L3 = [pp(u, lipV(u) - 14, 0.004) + v3(0, 0.012, 0) for u in np.linspace(30, 1970, n + 1)]
    F3 = [ws((u - 1000) / 970, 0) + v3(0, -0.004, 0) for u in np.linspace(30, 1970, n + 1)]
    def shroud(a, b):
        f = a * n; i = min(n - 1, int(f)); t = f - i
        A = L3[i] + (L3[i + 1] - L3[i]) * t; Bq = F3[i] + (F3[i + 1] - F3[i]) * t
        p = A + (Bq - A) * b; p[1] += math.sin(b * math.pi) * 0.01
        return p
    grid(g, n, 7, shroud, 'glareshield', toward=v3(-0.25, 0.6, 0))
    # defroster grilles at the windshield base
    for sd in (-1, 1):
        c = ws(sd * 0.35, 0) + v3(0, 0.002, 0.05)
        rbox(g, (0.20, 0.004, 0.025), 0.002, 'black', m=T(*c), seg=1, flat=(3, 1, 1))
    # control-column boots, push-pull bushings, ignition bezel on the face (static parts of the controls)
    for u in YKX:
        p = pp(u, COLY, -0.002)
        lathe(g, [(0, 0), (0.036, 0), (0.034, 0.010), (0.016, 0.022), (0.013, 0.03), (0, 0.03)], 'rubber', seg=20, m=M(basis(p, v3(1, 0, 0), -PN, np.cross(v3(1, 0, 0), -PN))))
    for (u, v, r) in ((926, SUBY + 2, 0.010), (1000, SUBY - 6, 0.013), (1082, SUBY - 6, 0.013)):
        p = pp(u, v, -0.001)
        lathe(g, [(0, 0), (r, 0), (r, 0.006), (r * 0.6, 0.008), (0, 0.008)], 'chrome', seg=16, m=basis(p, v3(1, 0, 0), -PN, np.cross(v3(1, 0, 0), -PN)))
    p = pp(172, SUBY + 4, -0.001)
    lathe(g, [(0, 0), (0.019, 0), (0.019, 0.005), (0.015, 0.008), (0.0, 0.008)], 'chrome', seg=20, m=basis(p, v3(1, 0, 0), -PN, np.cross(v3(1, 0, 0), -PN)))
    # flap lever slot
    p = pp(1370, 760, -0.0008)
    rbox(g, (0.014, 0.065, 0.002), 0.004, 'black', m=basis(p, v3(1, 0, 0), -nrm(EYv), PN * -1), seg=2, flat=1)


def pedestal(g):
    """centre pedestal under the panel: sloped trim face, step with the fuel selector, the trim wheel slot"""
    P = [(-0.80, -0.53), (-0.748, -0.538), (-0.588, -0.735), (-0.588, -0.838), (-0.385, -0.892), (-0.385, YF), (-0.80, YF)]
    # local x → cockpit z, local y → y, extrusion along x
    m = basis(v3(0, 0, 0), v3(0, 0, 1), v3(0, 1, 0), v3(1, 0, 0))
    prism(g, P, 0.15, 'black_matte', m=m)
    # side trim strips and a lighter cover plate on the sloped face
    for sd in (-1, 1):
        tube(g, [v3(sd * 0.076, y, z) for (z, y) in P[:5]], 0.004, 'trim_dark', sides=6)
    # trim wheel slot cover (dark) on the sloped face
    tp = v3(0, -0.635, -0.666); ang = -39 * D2R
    rbox(g, (0.04, 0.004, 0.13), 0.003, 'rubber', m=M(T(*tp), RX(-(math.pi / 2 + ang))), seg=1, flat=1)
    # fuel selector base plate (the live placard sits on its face)
    fp = v3(0, -0.884, -0.487)
    lathe(g, [(0, 0), (0.07, 0), (0.07, 0.004), (0.0, 0.004)], 'black', seg=24, m=M(T(*fp), RX(-(15 * D2R))))


def seat_front(g, xc):
    z0 = SEAT_Z
    # floor rails and the tubular frame
    for dx in (-0.16, 0.16):
        rbox(g, (0.03, 0.02, 0.95), 0.004, 'steel_dark', m=T(xc + dx, YF + 0.01, 0.05), seg=1, flat=(1, 1, 6))
        tube(g, [v3(xc + dx, YF + 0.02, z0 - 0.17), v3(xc + dx, -0.82, z0 - 0.15), v3(xc + dx, -0.82, z0 + 0.18), v3(xc + dx, YF + 0.02, z0 + 0.20)], 0.011, 'steel_dark', sides=8)
    tube(g, [v3(xc - 0.21, -0.82, z0 - 0.17), v3(xc + 0.21, -0.82, z0 - 0.17)], 0.010, 'steel_dark', sides=8)
    # seat pan
    rbox(g, (0.44, 0.04, 0.44), 0.012, 'black_matte', m=M(T(xc, -0.80, z0), RX(6 * D2R)), seg=2, flat=(2, 1, 2))
    # height/fore-aft handle under the front edge
    tube(g, [v3(xc - 0.05, -0.83, z0 - 0.21), v3(xc - 0.05, -0.85, z0 - 0.26), v3(xc + 0.05, -0.85, z0 - 0.26), v3(xc + 0.05, -0.83, z0 - 0.21)], 0.006, 'black', sides=8)
    # cushion: puffed top, three sewn channels, raised side bolsters
    hx, hz = 0.235, 0.235
    def cush(p, n):
        x, y, z = p
        if y > 0:
            ax, az = x / hx, z / hz
            puff = 0.016 * max(0, 1 - ax * ax) * max(0, 1 - az ** 4)
            bol = 0.022 * sstep(0.62, 0.86, abs(ax))
            groove = sum(0.008 * math.exp(-((x - c) / 0.008) ** 2) for c in (-0.13, -0.045, 0.045, 0.13)) * max(0, 1 - az ** 6)
            y = y + puff + bol - groove
            # front roll
            y += 0.006 * sstep(0.7, 0.95, -az)
        return (x, y, z)
    cm = M(T(xc, -0.735, z0), RX(6 * D2R))
    rbox(g, (0.47, 0.085, 0.47), (0.035, 0.03, 0.04), 'fabric', m=cm, seg=3, flat=(18, 1, 8), deform=cush)
    # backrest: shell, padded front with channels and bolsters, headrest on posts
    hinge = v3(xc, -0.72, z0 + 0.22)
    bm = M(T(*hinge), RX(14 * D2R))   # leaning back 14°
    def back(p, n):
        x, y, z = p
        ax = x / 0.235; ay = (y - 0.30) / 0.31
        if z < 0:   # front (toward the pilot is −z in the seat's frame)
            puff = 0.014 * max(0, 1 - ax * ax) * max(0, 1 - ay ** 4)
            bol = 0.04 * sstep(0.55, 0.9, abs(ax)) * max(0, 1 - max(0, ay) ** 2)
            groove = sum(0.007 * math.exp(-((x - c) / 0.008) ** 2) for c in (-0.12, -0.04, 0.04, 0.12)) * max(0, 1 - ay ** 6)
            lumbar = 0.012 * math.exp(-((y - 0.14) / 0.10) ** 2)
            z = z - puff - bol + groove - lumbar
        z = z - 0.05 * ax * ax   # bucket curve
        return (x, y, z)
    rbox(g, (0.47, 0.62, 0.09), (0.04, 0.04, 0.035), 'fabric', m=M(bm, T(0, 0.31, 0.0)), seg=3, flat=(18, 10, 1), deform=back)
    def shellf(p, n):
        x, y, z = p; return (x, y, z - 0.05 * (x / 0.24) ** 2)
    rbox(g, (0.48, 0.60, 0.03), (0.02, 0.03, 0.012), 'vinyl', m=M(bm, T(0, 0.30, 0.055)), seg=2, flat=(8, 6, 1), deform=shellf)
    for sx in (-0.08, 0.08):
        tube(g, [xf(bm, [(sx, 0.58, 0.02)])[0], xf(bm, [(sx, 0.70, 0.02)])[0]], 0.006, 'chrome', sides=8)
    def hr(p, n):
        x, y, z = p; return (x, y, z - (0.012 * max(0, 1 - (x / 0.13) ** 2) if z < 0 else 0))
    rbox(g, (0.26, 0.15, 0.085), (0.035, 0.035, 0.03), 'fabric', m=M(bm, T(0, 0.75, 0.01)), seg=3, flat=(6, 3, 1), deform=hr)
    # recline lever on the outboard side
    sd = -1 if xc < 0 else 1
    tube(g, [v3(xc + sd * 0.24, -0.74, z0 + 0.18), v3(xc + sd * 0.25, -0.70, z0 + 0.06)], 0.007, 'black', sides=8)


def seat_rear(g):
    z0 = 1.02
    def cush(p, n):
        x, y, z = p
        if y > 0:
            y += 0.014 * max(0, 1 - (z / 0.2) ** 4) * (0.6 + 0.4 * abs(math.cos(math.pi * x / 0.5)))
            y -= 0.008 * math.exp(-(x / 0.01) ** 2)
        return (x, y, z)
    rbox(g, (1.02, 0.10, 0.42), (0.04, 0.035, 0.04), 'fabric', m=M(T(0, -0.74, z0), RX(6 * D2R)), seg=2, flat=(12, 1, 5), deform=cush)
    rbox(g, (1.0, 0.18, 0.40), 0.02, 'black_matte', m=T(0, -0.88, z0), seg=1, flat=1)
    def back(p, n):
        x, y, z = p
        if z < 0:
            z -= 0.012 * max(0, 1 - ((y - 0.27) / 0.28) ** 4) * (0.6 + 0.4 * abs(math.cos(math.pi * x / 0.5)))
            z += 0.008 * math.exp(-(x / 0.01) ** 2)
        return (x, y, z)
    rbox(g, (1.02, 0.56, 0.10), (0.04, 0.04, 0.035), 'fabric', m=M(T(0, -0.70, z0 + 0.17), RX(12 * D2R), T(0, 0.28, 0)), seg=2, flat=(12, 6, 1), deform=back)


# ------------------------------------------------------------------ outside: wings, strut, cowling, fuselage sides
def exterior():
    g = Geo()
    yr = YR + 0.075; dih = 1.7 * D2R
    for sd in (-1, 1):
        span = 5.0
        def chord(u):
            return 1.62 - 0.45 * max(0, (u * span - 2.6) / 2.8)
        def le(u):
            return -0.80 + 0.06 * max(0, (u * span - 2.6) / 2.8)
        def af(t):   # NACA-2412-ish half thickness distribution (fraction of chord)
            return 0.6 * (0.2969 * math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4)
        def low(u, v):
            t = v * v * (3 - 2 * v)
            x = sd * (0.50 + u * span); c = chord(u)
            return (x, yr + u * span * math.tan(dih) - af(t) * c * 0.5 + 0.02 * c * math.sin(math.pi * t), le(u) + t * c)
        def up(u, v):
            t = v * v * (3 - 2 * v)
            x = sd * (0.50 + u * span); c = chord(u)
            return (x, yr + u * span * math.tan(dih) + af(t) * c + 0.02 * c * math.sin(math.pi * t), le(u) + t * c)
        grid(g, 18, 12, low, 'skin_under', toward=v3(sd * 2, -3, 0))
        grid(g, 18, 12, up, 'skin', toward=v3(sd * 2, 3, 0))
        # strut (streamlined section), fuselage skin below and behind the windows, accent stripe
        a = v3(sd * 0.62, -0.92, -0.02); b = v3(sd * 2.55, yr + 2.05 * math.tan(dih) - 0.06, -0.24)
        tube(g, [a, b], 0.045, 'skin', sides=10, ry=0.017, up=v3(0, 0, 1))
        grid(g, 12, 4, lambda u, v: (sd * (XW + 0.07), YS - 0.02 - v * 0.9, -1.15 + u * 2.6), 'skin', toward=v3(sd * 2, 0, 0))
        grid(g, 12, 1, lambda u, v: (sd * (XW + 0.072), YS - 0.10 - v * 0.06, -1.15 + u * 2.6), 'stripe', toward=v3(sd * 2, 0, 0))
        # main wheel fairing hint below the door
        rbox(g, (0.16, 0.30, 0.55), 0.08, 'skin', m=T(sd * 1.15, -1.75, 0.55), seg=3, flat=1)
        lathe(g, [(0.0, -0.07), (0.20, -0.07), (0.25, -0.04), (0.25, 0.04), (0.20, 0.07), (0, 0.07)], 'tyre', seg=20, m=M(T(sd * 1.15, -1.8, 0.55), RZ(math.pi / 2)))
    # cabin roof under the wing centre section, cowling ahead of the windshield (with a slight crown), nose
    grid(g, 8, 8, lambda u, v: (-0.62 + u * 1.24, YR + 0.07, -0.75 + v * 1.6), 'skin_under', toward=v3(0, -1, 0))
    def cowl(u, v):
        a = -1 + 2 * u; z = ZWB - 0.03 - v * 1.25
        w = 0.50 * (1 - 0.30 * v * v)
        return (a * w, -0.09 - 0.05 * v - 0.12 * a * a * (1 + v) - 0.10 * v ** 3, z)
    grid(g, 16, 10, cowl, 'skin', toward=v3(0, 2, 0))
    # spinner
    lathe(g, [(0, 0), (0.17, 0), (0.14, 0.12), (0.07, 0.22), (0, 0.26)], 'skin', seg=18, m=M(T(0, -0.42, ZWB - 1.30), RX(-math.pi / 2)))
    return g


# ------------------------------------------------------------------ controls
def yoke(name, u, parent):
    p0 = pp(u, COLY, -0.004); hub = p0 + v3(0, 0, 0.17)
    g = Geo()
    # column tube (long enough to stay in the bushing at full pull)
    tube(g, [hub + v3(0, 0, -0.42), hub + v3(0, 0, -0.01)], 0.0115, 'chrome', sides=14)
    # hub
    rbox(g, (0.075, 0.055, 0.05), (0.02, 0.02, 0.015), 'yoke_hub', m=T(*(hub + v3(0, 0, 0.006))), seg=3, flat=1)
    rbox(g, (0.046, 0.026, 0.004), 0.004, 'trim_dark', m=T(*(hub + v3(0, 0.004, 0.032))), seg=1, flat=1)
    # ram's horn: one continuous swept handle
    pts = []
    for i in range(41):
        s = -1 + i / 20
        a = abs(s)
        if a < 0.55:
            x = s * 0.105 / 0.55; y = -0.012 + 0.012 * (a / 0.55) ** 2
        else:
            t = (a - 0.55) / 0.45     # the horn: curve up and slightly out
            ang = t * 100 * D2R
            r0 = 0.045
            x = math.copysign(0.105 + r0 * math.sin(ang) + 0.012 * t, s); y = 0.0 + r0 * (1 - math.cos(ang)) + 0.06 * max(0, t - 0.75) / 0.25
        pts.append(hub + v3(x, y, 0.012))
    rad = [0.0095 + 0.007 * sstep(0.55, 0.85, abs(-1 + i / 20)) for i in range(41)]
    tube(g, pts, rad, 'yoke', sides=12, ry=[r * 0.85 for r in rad], up=v3(0, 0, 1))
    # grip end caps, push-to-talk on the left horn, map-light rheostat under the hub
    for s in (-1, 1):
        lathe(g, [(0, 0), (0.017, 0), (0.014, 0.006), (0, 0.008)], 'yoke', seg=12, m=T(*(pts[0 if s < 0 else -1])))
    rbox(g, (0.012, 0.008, 0.014), 0.003, 'red_knob', m=T(*(pts[3] + v3(0.0, 0.0, 0.016))), seg=1, flat=1)
    lathe(g, [(0, 0), (0.008, 0), (0.008, 0.008), (0, 0.008)], 'black', seg=12, m=M(T(*(hub + v3(0, -0.03, 0.01))), RX(math.pi)))
    return C.to_object(name, g, pivot=hub, parent=parent), hub


def push_pull(name, u, v, knob, parent):
    """knob on a plunger, pivot on the panel face (fully in); travels out along −PN"""
    p = pp(u, v, -0.001); out = -PN
    m = basis(p, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out))
    g = Geo()
    lathe(g, [(0, -0.12), (0.0045, -0.12), (0.0045, 0.012), (0, 0.012)], 'chrome', seg=12, m=m)
    if knob == 'throttle':     # large black knob, knurled rim, slightly domed
        gear = [((0.019 if k % 2 == 0 else 0.0175) * math.cos(2 * math.pi * k / 48), (0.019 if k % 2 == 0 else 0.0175) * math.sin(2 * math.pi * k / 48)) for k in range(48)]
        prism(g, gear, 0.016, 'black', m=M(m, T(0, 0.020, 0), RX(math.pi / 2)))
        lathe(g, [(0, 0.028), (0.016, 0.028), (0.0185, 0.026), (0.0185, 0.012), (0.008, 0.010), (0, 0.010)], 'black', seg=24, m=m)
    elif knob == 'mixture':    # red, ribbed, with the vernier lock button
        gear = [((0.0165 if k % 2 == 0 else 0.015) * math.cos(2 * math.pi * k / 40), (0.0165 if k % 2 == 0 else 0.015) * math.sin(2 * math.pi * k / 40)) for k in range(40)]
        prism(g, gear, 0.016, 'red_knob', m=M(m, T(0, 0.020, 0), RX(math.pi / 2)))
        lathe(g, [(0, 0.028), (0.014, 0.028), (0.016, 0.026), (0.016, 0.012), (0.008, 0.010), (0, 0.010)], 'red_knob', seg=24, m=m)
        lathe(g, [(0, 0.0275), (0.006, 0.0275), (0.006, 0.031), (0, 0.031)], 'black', seg=12, m=m)
    else:                      # carb heat: black knob with a flat grip
        lathe(g, [(0, 0.010), (0.007, 0.010), (0.013, 0.014), (0.013, 0.026), (0, 0.026)], 'black', seg=20, m=m)
        rbox(g, (0.034, 0.024, 0.012), 0.004, 'black', m=M(m, T(0, 0.036, 0), RX(math.pi / 2)), seg=2, flat=1)
    return C.to_object(name, g, pivot=p, parent=parent), p


def build():
    sc = C.reset()
    C.material_specs(MATS, TEX)
    root = C.empty('c172_cockpit')
    objs = {}
    sh = shell(); objs['shell'] = C.to_object('shell', sh, parent=root)
    ex = exterior(); objs['exterior'] = C.to_object('exterior', ex, parent=root, ao=False)
    # panel face: flat, in the panel plane, top edge along the glareshield lip; UV = panel drawing rect
    R = (34, 259, 1932, 821)     # x, y, w, h in panel drawing units → UV 0..1
    g = Geo()
    grid(g, 24, 6, lambda a, b: pp(34 + a * 1932, lipV(34 + a * 1932) + b * (LB - lipV(34 + a * 1932)), -0.0005), 'panel_face', toward=v3(-0.26, 0.09, 0))
    def uvp(p):
        d = np.asarray(p) - PO
        u = np.dot(d, EXv) / (PS * PS); v = np.dot(d, EYv) / (PS * PS)
        return ((u - R[0]) / R[2], 1 - (v - R[1]) / R[3])   # Blender UV origin bottom-left; glTF export flips to top-left
    objs['panel_face'] = C.to_object('panel_face', g, parent=root, ao=False, uv_override=uvp)
    # glazing
    g = Geo(); grid(g, 24, 12, lambda a, b: ws(-1 + 2 * a, 0.01 + b * 0.98), 'glass', toward=v3(0, 0, 0))
    objs['glass'] = C.to_object('glass', g, parent=root, ao=False)
    g = Geo()
    for sd in (-1, 1):
        def door_win(a, b):
            y = YS + 0.02 + b * (YR - YS - 0.04); zf = zFront(y) + 0.02
            return (sd * (XW + 0.014), y, zf + a * (ZB - 0.035 - zf))
        grid(g, 4, 6, door_win, 'glass', toward=v3(0, 0, 0))
        grid(g, 4, 2, lambda a, b: (sd * (XW + 0.014), YS + 0.02 + b * (YR - YS - 0.04), ZB + 0.035 + a * (ZR - ZB - 0.16)), 'glass', toward=v3(0, 0, 0))
    objs['glass_side'] = C.to_object('glass_side', g, parent=root, ao=False)
    # controls
    ctrl = {}
    for nm, u in (('yoke_L', YKX[0]), ('yoke_R', YKX[1])):
        o, hub = yoke(nm, u, root); objs[nm] = o
        ctrl[nm] = dict(pivot=hub, translate=dict(axis=[0, 0, 1], min=-0.075, max=0.075, note='+ = pull (aft); 0 = neutral'),
                        rotate=dict(axis=[0, 0, 1], min=-45, max=45, unit='deg', note='+ = roll right (wheel turned clockwise as seen by the pilot is a rotation about −z; apply angle = −roll)'))
    for nm, u, v, kind, travel in (('throttle', 1000, SUBY - 6, 'throttle', 0.065), ('mixture', 1082, SUBY - 6, 'mixture', 0.065), ('carb_heat', 926, SUBY + 2, 'carb', 0.06)):
        o, p = push_pull(nm, u, v, kind, root); objs[nm] = o
        notes = {'throttle': '0 = in (full open), max = out (idle)', 'mixture': '0 = in (full rich), max = out (idle cut-off)', 'carb_heat': '0 = in (cold), max = out (hot)'}
        ctrl[nm] = dict(pivot=p, translate=dict(axis=list(np.round(-PN, 6)), min=0, max=travel, note=notes[nm]))
    # flap lever (modelled at UP), moves down the slot
    p = pp(1370, 715, -0.001); dn = nrm(EYv)
    g = Geo()
    fm = basis(p, v3(1, 0, 0), -dn, -PN)
    rbox(g, (0.006, 0.006, 0.018), 0.002, 'chrome', m=M(fm, T(0, 0, 0.009)), seg=1, flat=1)
    def flap_tab(q, n):
        x, y, z = q
        return (x, y * (1 - 0.5 * (x + 0.022) / 0.044), z)
    rbox(g, (0.044, 0.016, 0.010), (0.004, 0.004, 0.004), 'white', m=M(fm, T(0, 0, 0.022)), seg=2, flat=(4, 1, 1), deform=flap_tab)
    objs['flap_lever'] = C.to_object('flap_lever', g, pivot=p, parent=root)
    ctrl['flap_lever'] = dict(pivot=p, translate=dict(axis=list(np.round(dn, 6)), positions={'UP': 0, '10': 30 * PS, '20': 60 * PS, 'FULL': 90 * PS}))
    # ignition key (0° = L; OFF −80°, R −40°, L 0°, BOTH +40°, START +80°; + = clockwise as seen by the pilot)
    p = pp(172, SUBY + 4, -0.008); out = -PN
    km = basis(p, v3(1, 0, 0), out, np.cross(v3(1, 0, 0), out))
    g = Geo()
    lathe(g, [(0, 0), (0.008, 0), (0.008, 0.010), (0, 0.010)], 'chrome', seg=14, m=km)
    rbox(g, (0.006, 0.03, 0.026), (0.002, 0.008, 0.008), 'black', m=M(km, T(0, 0.028, 0), RY(0)), seg=2, flat=1)
    objs['magneto_key'] = C.to_object('magneto_key', g, pivot=p, parent=root)
    ctrl['magneto_key'] = dict(pivot=p, rotate=dict(axis=list(np.round(PN, 6)), unit='deg', positions={'OFF': -80, 'R': -40, 'L': 0, 'BOTH': 40, 'START': 80}, note='+ = clockwise as seen by the pilot; START springs back to BOTH'))
    # elevator trim wheel (vertical, in the pedestal slot)
    tp = v3(0, -0.635, -0.666); n_face = v3(0, math.cos(-39 * D2R + math.pi / 2), 0)
    wc = tp + v3(0, 0.012, 0.012)      # wheel centre just inside the sloped face
    g = Geo()
    gear = [((0.056 if k % 2 == 0 else 0.0525) * math.cos(2 * math.pi * k / 72), (0.056 if k % 2 == 0 else 0.0525) * math.sin(2 * math.pi * k / 72)) for k in range(72)]
    prism(g, gear, 0.020, 'black', m=M(T(*wc), RY(math.pi / 2)))
    rbox(g, (0.022, 0.006, 0.012), 0.002, 'white', m=M(T(*wc), RX(0.3), T(0, 0.054, 0)), seg=1, flat=1)
    objs['trim_wheel'] = C.to_object('trim_wheel', g, pivot=wc, parent=root)
    ctrl['trim_wheel'] = dict(pivot=wc, rotate=dict(axis=[1, 0, 0], unit='deg', min=-360 * 1.5, max=360 * 1.5, note='+ = top of wheel moves aft = nose up; ≈ ±1.5 turns stop to stop'))
    # fuel selector handle (BOTH = 0°, pointing forward)
    fp = v3(0, -0.884, -0.487); fm = M(T(*fp), RX(-15 * D2R))
    fax = xf(fm, [(0, 1, 0)])[0] - fp
    g = Geo()
    def handle(q, n):
        x, y, z = q; w = 1 - 0.55 * max(0, -z) / 0.06
        return (x * w, y, z)
    rbox(g, (0.035, 0.03, 0.13), (0.008, 0.01, 0.015), 'black', m=M(fm, T(0, 0.02, -0.01)), seg=3, flat=(1, 1, 4), deform=handle)
    rbox(g, (0.004, 0.002, 0.05), 0.001, 'white', m=M(fm, T(0, 0.0355, -0.045)), seg=1, flat=1)
    lathe(g, [(0, 0), (0.022, 0), (0.022, 0.008), (0, 0.008)], 'chrome', seg=18, m=fm)
    objs['fuel_selector'] = C.to_object('fuel_selector', g, pivot=fp, parent=root)
    ctrl['fuel_selector'] = dict(pivot=fp, rotate=dict(axis=list(np.round(nrm(fax), 6)), unit='deg', positions={'LEFT': 90, 'BOTH': 0, 'RIGHT': -90, 'OFF': 180}, note='right-hand rule about the axis (pointing up out of the floor step): + = turn to the left'))
    # rudder pedals: one node per seat, each pedal its own child hinged at the bottom of its arm
    for side, xc in (('L', -0.27), ('R', 0.27)):
        pv = v3(xc, -0.93, -1.06)
        parent = C.empty('rudder_pedals_' + side, pivot=pv, parent=root); objs['rudder_pedals_' + side] = parent
        for lr, dx in (('l', -0.085), ('r', 0.085)):
            hp = v3(xc + dx, -0.93, -1.06)
            g = Geo()
            tube(g, [hp, hp + v3(0, 0.07, 0.07)], 0.009, 'steel_dark', sides=8)
            pm = M(T(*(hp + v3(0, 0.095, 0.085))), RX(-0.55))
            def ribs(q, n):
                x, y, z = q
                if z < 0:
                    z -= 0.0015 * (math.sin(y * 260) > 0.3)
                return (x, y, z)
            rbox(g, (0.075, 0.14, 0.02), (0.008, 0.008, 0.006), 'pedal', m=pm, seg=2, flat=(2, 12, 1), deform=ribs)
            rbox(g, (0.08, 0.03, 0.014), 0.005, 'rubber', m=M(pm, T(0, 0.075, -0.004)), seg=2, flat=1)
            tube(g, [hp + v3(-0.02, 0, 0), hp + v3(0.02, 0, 0)], 0.012, 'steel_dark', sides=10)
            objs[f'pedal_{side}_{lr}'] = C.to_object(f'pedal_{side}_{lr}', g, pivot=hp, parent=parent)
        # torque tube across the pedal pair (static with the parent)
        g = Geo(); tube(g, [pv + v3(-0.13, 0, 0), pv + v3(0.13, 0, 0)], 0.010, 'steel_dark', sides=10)
        objs[f'pedal_tube_{side}'] = C.to_object(f'pedal_tube_{side}', g, pivot=pv, parent=parent)
        ctrl['rudder_pedals_' + side] = dict(pivot=pv, children={f'pedal_{side}_l': dict(axis=[1, 0, 0]), f'pedal_{side}_r': dict(axis=[1, 0, 0])},
                                             rotate=dict(axis=[1, 0, 0], unit='deg', min=-16, max=16, note='per pedal; left rudder: pedal_*_l −θ (top forward), pedal_*_r +θ'))
    return root, objs, ctrl, R


def main():
    root, objs, ctrl, R = build()
    meshes = [o for o in objs.values() if o.type == 'MESH']
    ao_objs = [o for o in meshes if o.get('ao')]
    os.makedirs(OUT, exist_ok=True); os.makedirs(SHOTS, exist_ok=True)
    tris = C.tri_count(meshes)
    print('triangles', tris, {o.name: C.tri_count([o]) for o in meshes})
    C.bake_ao(ao_objs, [objs['glass'], objs['glass_side']], '/tmp/blender3d/c172_ao.jpg', size=1024, samples=int(os.environ.get('AO_SAMPLES', 48)))
    raw = '/tmp/blender3d/c172-raw.glb'
    C.export_glb(raw, [root] + list(objs.values()))
    dst = os.path.join(OUT, 'c172-cockpit.glb')
    print(C.gltfpack(raw, dst))
    side = dict(
        aircraft='C172', file='c172-cockpit.glb', units='metres', frame='x right, y up, z aft (forward = −z); same frame as c172-3d.js/cockpit3d.js',
        origin='aircraft centre line at the cabin reference height (9 cm below the left-seat design eye)',
        eye=dict(left=list(EYE_L), right=list(EYE_R)), triangles=tris,
        nodes=sorted([o.name for o in objs.values()] + ['c172_cockpit']),
        faces={'panel_face': dict(plane=dict(origin=list(np.round(PO, 6)), ex=list(np.round(EXv, 9)), ey=list(np.round(EYv, 9)), note='point = origin + ex·u + ey·v for panel drawing units (u, v); tilt 6°'),
                                  drawing='c172panel.js 2000×1320', drawing_size=[2000, 1320], uv_rect=list(R), uv='u = (x − 34)/1932, v = (y − 259)/821 (glTF UV, v down: use texture.flipY = false)')},
        controls={k: {kk: (list(np.round(vv, 5)) if isinstance(vv, np.ndarray) else vv) for kk, vv in d.items()} for k, d in ctrl.items()},
        materials_note='PBR (metal/rough) with tiling detail maps on TEXCOORD_0 and a baked AO atlas as occlusionTexture on TEXCOORD_1 (three r128 uses it as aoMap via uv2).',
        compression='EXT_meshopt_compression + KHR_mesh_quantization (gltfpack -c); needs GLTFLoader.setMeshoptDecoder(MeshoptDecoder)')
    with open(os.path.join(OUT, 'c172-cockpit.json'), 'w') as f:
        json.dump(side, f, indent=1, default=lambda x: x.tolist() if hasattr(x, 'tolist') else float(x))
    if RENDER:
        from PIL import Image
        Image.open(PANEL_IMG).crop((R[0], R[1], R[0] + R[2], R[1] + R[3])).save('/tmp/blender3d/c172_panel_face.png')
        C.set_panel_preview({'panel_face': '/tmp/blender3d/c172_panel_face.png'})
        C.preview(os.path.join(SHOTS, 'c172-left-seat.png'), EYE_L, 9, -16, hfov=84, samples=int(os.environ.get('PREVIEW_SAMPLES', 40)))


if __name__ == '__main__':
    main()
