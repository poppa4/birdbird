"""Shared parametric parts for the cockpit builders: crew seats, control wheels, rudder pedals, sub-panel planes."""
import math
import numpy as np
import cocklib as C
from cocklib import Geo, grid, rbox, box, tube, lathe, prism, T, RX, RY, RZ, M, basis, xf, v3, nrm, D2R


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def euler_yxz(pitch, yaw, roll=0.0):
    """three.js Euler(pitch, yaw, roll, 'YXZ') rotation matrix (3×3), angles in degrees"""
    return (RY(yaw * D2R) @ RX(pitch * D2R) @ RZ(roll * D2R))[:3, :3]


class SubPlane:
    """a cockpit3d.js sub-plane: drawing rect r = [x, y, w, h] (panel units) placed at pos with pitch/yaw, ps metres/unit.
    point(u, v) = O + ex·u + ey·v (exactly as cockpit3d.js computes it)"""
    def __init__(self, rect, ps, pos, pitch=0, yaw=0, roll=0):
        Q = euler_yxz(pitch, yaw, roll)
        self.ex = Q @ v3(1, 0, 0) * ps; self.ey = Q @ v3(0, -1, 0) * ps
        self.pn = nrm(np.cross(self.ex, self.ey)); self.ps = ps; self.rect = list(rect)
        cu, cv = rect[0] + rect[2] / 2, rect[1] + rect[3] / 2
        self.O = v3(*pos) - self.ex * cu - self.ey * cv
        self.pos = v3(*pos); self.pitch, self.yaw, self.roll = pitch, yaw, roll

    def p(self, u, v, o=0.0):
        return self.O + self.ex * u + self.ey * v + self.pn * o

    def frame(self, u, v, o=0.0):
        """matrix at drawing point (u, v): local x = right along the plane, y = out of the plane (toward the crew), z = down the plane"""
        ex = nrm(self.ex); ey = nrm(self.ey); out = -self.pn
        return basis(self.p(u, v, o), ex, out, ey)

    def face(self, name, parent, mat='panel_face', nu=8, nv=8, off=-0.0006, outline=None):
        """flat mesh over the rect with UV 0..1 = rect (glTF v down); outline(u)->(v_top) optional top edge"""
        r = self.rect; g = Geo()
        def fn(a, b):
            u = r[0] + a * r[2]
            v0 = outline(u) if outline else r[1]
            return self.p(u, v0 + b * (r[1] + r[3] - v0), off)
        grid(g, nu, nv, fn, mat, toward=self.p(r[0] + r[2] / 2, r[1] + r[3] / 2, -1.0))
        def uvp(pt):
            d = np.asarray(pt) - self.O
            u = np.dot(d, self.ex) / (self.ps * self.ps); v = np.dot(d, self.ey) / (self.ps * self.ps)
            return ((u - r[0]) / r[2], 1 - (v - r[1]) / r[3])
        return C.to_object(name, g, parent=parent, ao=False, uv_override=uvp)

    def json(self):
        return dict(rect=self.rect, uv_rect=self.rect, origin=list(np.round(self.O, 6)), ex=list(np.round(self.ex, 9)), ey=list(np.round(self.ey, 9)),
                    pos=list(np.round(self.pos, 6)), pitch=self.pitch, yaw=self.yaw, ps=self.ps)


def seat(g, xc, z0, floor, mats, cush_y, w=0.47, back_h=0.62, recline=14, armrests=False, headrest=True, pleats=4, frame='pedestal'):
    """crew seat: puffed cushion with sewn channels, bucket backrest with bolsters, headrest, shell; mats: dict(cover, side, shell, metal)"""
    hx = w / 2
    cover, side, shell, metal = mats['cover'], mats['side'], mats['shell'], mats['metal']
    # structure under the cushion
    if frame == 'pedestal':
        rbox(g, (w * 0.8, cush_y - 0.05 - floor, 0.40), 0.02, shell, m=T(xc, (cush_y - 0.05 + floor) / 2, z0 + 0.02), seg=2, flat=1)
    else:
        for dx in (-0.16, 0.16):
            rbox(g, (0.03, 0.02, 0.9), 0.004, metal, m=T(xc + dx, floor + 0.01, z0 - 0.1), seg=1, flat=(1, 1, 5))
            tube(g, [v3(xc + dx, floor + 0.02, z0 - 0.17), v3(xc + dx, cush_y - 0.08, z0 - 0.15), v3(xc + dx, cush_y - 0.08, z0 + 0.18), v3(xc + dx, floor + 0.02, z0 + 0.20)], 0.011, metal, sides=8)
    rbox(g, (w - 0.02, 0.04, 0.44), 0.012, shell, m=M(T(xc, cush_y - 0.065, z0), RX(6 * D2R)), seg=2, flat=(2, 1, 2))
    chan = np.linspace(-0.13, 0.13, pleats) * (w / 0.47)
    def cush(p, n):
        x, y, z = p
        if y > 0:
            ax, az = x / hx, z / 0.235
            y = y + 0.016 * max(0, 1 - ax * ax) * max(0, 1 - az ** 4) + 0.024 * sstep(0.62, 0.86, abs(ax))
            y -= sum(0.008 * math.exp(-((x - c) / 0.008) ** 2) for c in chan) * max(0, 1 - az ** 6)
            y += 0.006 * sstep(0.7, 0.95, -az)
        return (x, y, z)
    rbox(g, (w, 0.085, 0.47), (0.035, 0.03, 0.04), cover, m=M(T(xc, cush_y, z0), RX(6 * D2R)), seg=3, flat=(16, 1, 7), deform=cush)
    hinge = v3(xc, cush_y + 0.015, z0 + 0.22)
    bm = M(T(*hinge), RX(recline * D2R))   # + = leaning back (aft)
    hy = back_h / 2
    def back(p, n):
        x, y, z = p
        ax = x / hx; ay = (y - hy) / hy
        if z < 0:
            z = z - 0.014 * max(0, 1 - ax * ax) * max(0, 1 - ay ** 4) - 0.045 * sstep(0.55, 0.9, abs(ax)) * max(0, 1 - max(0, ay) ** 2)
            z += sum(0.007 * math.exp(-((x - c) / 0.008) ** 2) for c in chan) * max(0, 1 - ay ** 6)
            z -= 0.012 * math.exp(-((y - 0.14) / 0.10) ** 2)
        return (x, y, z - 0.05 * ax * ax)
    rbox(g, (w, back_h, 0.09), (0.04, 0.04, 0.035), cover, m=M(bm, T(0, hy, 0.0)), seg=3, flat=(16, 9, 1), deform=back)
    def shellf(p, n):
        x, y, z = p; return (x, y, z - 0.05 * (x / hx) ** 2)
    rbox(g, (w + 0.01, back_h - 0.02, 0.03), (0.02, 0.03, 0.012), shell, m=M(bm, T(0, hy - 0.01, 0.055)), seg=2, flat=(6, 4, 1), deform=shellf)
    if headrest:
        for sx in (-0.07, 0.07):
            tube(g, [xf(bm, [(sx, back_h - 0.04, 0.02)])[0], xf(bm, [(sx, back_h + 0.08, 0.02)])[0]], 0.006, metal, sides=8)
        def hr(p, n):
            x, y, z = p; return (x, y, z - (0.012 * max(0, 1 - (x / 0.13) ** 2) if z < 0 else 0))
        rbox(g, (0.26, 0.15, 0.085), (0.035, 0.035, 0.03), cover, m=M(bm, T(0, back_h + 0.13, 0.01)), seg=3, flat=(5, 2, 1), deform=hr)
    if armrests:
        for s in (-1, 1):
            a = xf(bm, [(s * (hx + 0.04), 0.20, 0.02)])[0]
            rbox(g, (0.06, 0.05, 0.30), (0.02, 0.02, 0.03), side, m=T(a[0], cush_y + 0.17, z0 - 0.02), seg=2, flat=(1, 1, 3))
            tube(g, [v3(a[0], cush_y + 0.15, z0 + 0.10), v3(a[0], cush_y + 0.02, z0 + 0.14)], 0.012, shell, sides=8)
    return g


def harness(g, a, b, c, d, strap, buckle):
    """shoulder strap a→b→c→d (cockpit points) with a buckle at d"""
    pts = []
    S_ = [a, b, c, d]
    for i in range(3):
        for k in range(4):
            pts.append(S_[i] + (S_[i + 1] - S_[i]) * k / 4)
    pts.append(d)
    tube(g, pts, 0.024, strap, sides=4, ry=0.0025, up=v3(0, 0, 1), caps=True)
    rbox(g, (0.05, 0.016, 0.035), 0.004, buckle, m=T(*d), seg=1, flat=1)


def yoke(name, hub, parent, mats, width=0.30, horn_r=0.045, col_len=0.45, col_r=0.0115, grip=0.016, switches=True):
    """ram's-horn control wheel on its column (column along +z), pivot = hub centre"""
    g = Geo()
    tube(g, [hub + v3(0, 0, -col_len), hub + v3(0, 0, -0.01)], col_r, mats['column'], sides=14)
    rbox(g, (0.25 * width + 0.0, 0.055 * width / 0.3, 0.05), (0.02, 0.02, 0.015), mats['hub'], m=T(*(hub + v3(0, 0, 0.006))), seg=3, flat=1)
    rbox(g, (0.16 * width, 0.09 * width, 0.004), 0.004, mats['plate'], m=T(*(hub + v3(0, 0.004, 0.032))), seg=1, flat=1)
    hw = width * 0.35; pts = []
    for i in range(41):
        s = -1 + i / 20; a = abs(s)
        if a < 0.55:
            x = s * hw / 0.55; y = -0.012 + 0.012 * (a / 0.55) ** 2
        else:
            t = (a - 0.55) / 0.45; ang = t * 100 * D2R
            x = math.copysign(hw + horn_r * math.sin(ang) + 0.012 * t, s); y = horn_r * (1 - math.cos(ang)) + 0.06 * max(0, t - 0.75) / 0.25
        pts.append(hub + v3(x, y, 0.012))
    rad = [grip * 0.6 + grip * 0.42 * sstep(0.55, 0.85, abs(-1 + i / 20)) for i in range(41)]
    tube(g, pts, rad, mats['grip'], sides=12, ry=[r * 0.85 for r in rad], up=v3(0, 0, 1))
    for e in (pts[0], pts[-1]):
        lathe(g, [(0, 0), (grip * 1.05, 0), (grip * 0.85, 0.006), (0, 0.008)], mats['grip'], seg=12, m=T(*e))
    if switches:
        rbox(g, (0.012, 0.008, 0.014), 0.003, mats['red'], m=T(*(pts[3] + v3(0, 0, grip + 0.002))), seg=1, flat=1)
        rbox(g, (0.014, 0.010, 0.010), 0.003, mats['switch'], m=T(*(pts[2] + v3(0.0, -0.01, grip + 0.0))), seg=1, flat=1)
        rbox(g, (0.012, 0.008, 0.012), 0.003, mats['switch'], m=T(*(pts[-4] + v3(0, 0, grip + 0.002))), seg=1, flat=1)
    return C.to_object(name, g, pivot=hub, parent=parent)


def pedal(name, hp, parent, mats, tilt=0.55, arm=(0.07, 0.07)):
    g = Geo()
    tube(g, [hp, hp + v3(0, arm[0], arm[1])], 0.009, mats['arm'], sides=8)
    pm = M(T(*(hp + v3(0, arm[0] + 0.025, arm[1] + 0.015))), RX(-tilt))
    def ribs(q, n):
        x, y, z = q
        if z < 0:
            z -= 0.0015 * (math.sin(y * 260) > 0.3)
        return (x, y, z)
    rbox(g, (0.075, 0.14, 0.02), (0.008, 0.008, 0.006), mats['pad'], m=pm, seg=2, flat=(2, 12, 1), deform=ribs)
    rbox(g, (0.08, 0.03, 0.014), 0.005, mats['rubber'], m=M(pm, T(0, 0.075, -0.004)), seg=2, flat=1)
    tube(g, [hp + v3(-0.02, 0, 0), hp + v3(0.02, 0, 0)], 0.012, mats['arm'], sides=10)
    return C.to_object(name, g, pivot=hp, parent=parent)
