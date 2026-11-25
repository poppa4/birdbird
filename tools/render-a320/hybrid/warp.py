"""Fits the upper shell of the owner's Blender flight deck (lining, header ring, ceiling lights, visor knobs) onto the
FlightGear structure of the page. The two models differ by several centimetres (the Blender deck is wider and shorter and its
window tops lie lower), so the Blender parts are carried over by a smooth map between two plan curves seen from a vertical axis
between the seats: the border of the overhead panel (same in both) and the line of the window tops (measured in both models).
Heights are shifted so the lining meets the overhead plane and the header ring sits on the window tops."""
import numpy as np
CZ = 0.30
def _poly(pts):  # half polyline (x>=0) -> rho(phi) for phi 0..180 by ray casting
    pts = np.array(pts, float); phis = np.radians(np.arange(0, 180.01, 0.5)); out = np.zeros(len(phis))
    for i, a in enumerate(phis):
        d = np.array([np.sin(a), -np.cos(a)]); best = np.inf
        for p, q in zip(pts[:-1], pts[1:]):
            p0 = np.array([p[0], p[1] - CZ]); e = np.array([q[0] - p[0], q[1] - p[1]]); den = d[0] * e[1] - d[1] * e[0]
            if abs(den) < 1e-9: continue
            t = (p0[0] * e[1] - p0[1] * e[0]) / den; u = (p0[0] * d[1] - p0[1] * d[0]) / den
            if t > 0 and -1e-6 <= u <= 1 + 1e-6: best = min(best, t)
        out[i] = best
    return out
OUT_B = _poly([(0, -0.55), (0.68, -0.27), (0.78, -0.15), (0.82, -0.08), (0.89, -0.02), (0.98, 0.04), (1.03, 0.12), (1.10, 0.20), (1.12, 0.40),
               (1.16, 0.50), (1.20, 0.62), (1.26, 0.80), (1.33, 1.00), (1.33, 1.10), (0, 1.10)])
OUT_F = _poly([(0, -0.54), (0.71, -0.114), (0.76, -0.04), (0.80, 0.02), (0.85, 0.07), (0.90, 0.14), (0.93, 0.22), (0.98, 0.30), (1.01, 0.48),
               (1.05, 0.58), (1.10, 0.70), (1.10, 1.26), (0, 1.26)])
RECT_B = (0.33, -0.25, 0.91); RECT_F = (0.33, -0.241, 0.97)
def _rect(r):
    xo, z0, z1 = r; return _poly([(0, z0), (xo, z0), (xo, z1), (0, z1)])
IN_B = _rect(RECT_B); IN_F = _rect(RECT_F)
GB = np.array([0, 31.0, 55.1, 89.0, 121.0, 151.6, 180]); GF = np.array([0, 31.4, 63.4, 93.5, 131.1, 153.8, 180])
PH = np.arange(0, 180.01, 0.5)
def _smooth(o, sig=4.0, lo=58.0, hi=126.0):   # the measured window line is a polyline with kinks: the edges built on it take a smoothed copy
    from scipy.ndimage import gaussian_filter1d
    sm = gaussian_filter1d(o, sig / 0.5, mode='nearest'); w = np.clip((PH - lo) / 6.0, 0, 1) * np.clip((hi - PH) / 4.0, 0, 1); return o + w * (sm - o)
OUT_S = _smooth(OUT_F)
def ovh_y_B(z): return 0.94 + 0.40 * z
def ovh_y_F(z): return 0.9565 + 0.388 * z
def top_F(phi):   # FlightGear window-top height by azimuth (deg): windshield .815, sides .84
    return np.interp(phi, [0, 50, 70, 180], [0.815, 0.825, 0.84, 0.84])
def top_B(phi): return np.interp(phi, [0, 50, 70, 180], [0.76, 0.76, 0.765, 0.765])
def warp(P, sink=0.015):
    P = np.asarray(P, float); x = P[:, 0]; sg = np.where(x < 0, -1.0, 1.0); ax = np.abs(x); dz = P[:, 2] - CZ
    rho = np.hypot(ax, dz); phi = np.degrees(np.arctan2(ax, -dz))
    phi2 = np.interp(phi, GB, GF)
    ib = np.interp(phi, PH, IN_B); ob = np.interp(phi, PH, OUT_B); i_f = np.interp(phi2, PH, IN_F); of = np.interp(phi2, PH, OUT_F)
    t = (rho - ib) / np.maximum(ob - ib, 1e-6)
    rho2 = np.where(t < 0, rho * i_f / np.maximum(ib, 1e-6), np.where(t > 1, of + (rho - ob), i_f + t * (of - i_f)))
    a2 = np.radians(phi2); x2 = sg * rho2 * np.sin(a2); z2 = CZ - rho2 * np.cos(a2)
    # heights: at the overhead border the lining follows the overhead plane of the page; at the window line the ring sits on the window tops
    zb = CZ - ib * np.cos(np.radians(phi)); zf = CZ - i_f * np.cos(a2)
    dy_in = ovh_y_F(zf) - ovh_y_B(zb); dy_out = (top_F(phi2) - sink) - top_B(phi)
    # under the overhead's front edge the header's upright face ends on the panel plates (2 cm below the lining's edge in the
    # Blender model): lifted that much more, so it closes against the front edge of the page's overhead panel
    dy_in = dy_in + 0.024 * np.clip((36.0 - phi) / 8.0, 0, 1)
    tc = np.clip(t, 0, 1); s = tc * tc * (3 - 2 * tc)
    y2 = P[:, 1] + dy_in + (dy_out - dy_in) * s
    return np.c_[x2, y2, z2], t
