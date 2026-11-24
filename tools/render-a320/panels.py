"""The A320 panels as real geometry for the 3D cockpit.  usage: python3 panels.py <A320-family>/Models/FlightDeck/res <models dir>

The panel pictures (overhead, glareshield + main panel, pedestal) are square-on renders of the FlightGear A320-family flight deck
(GPL-2.0). This puts each picture back on the surfaces it was rendered from: for every view, rays are cast along the view
direction from the render's near plane, and every model face a ray reaches first is written out as it is in the model, with the
picture projected onto it (uv = where the face sits in the picture). Edges, corners and joints are therefore the model's own
edges, not steps in a height grid.
  - Parts that stand proud of a panel (knobs, selectors, switches, guards: proud.json) are left out of the ray cast, so their
    picture lies flat on the face behind them, as before. The 3D levers are left out too (the page draws them itself).
  - A face seen at more than 65 degrees from a view is not in that picture in any useful way. For a structural object (larger
    than 25 cm) it stays in the shell with the model's own texture (shell.py reads taken.json and leaves out exactly the faces
    written here). For a small part it is written with one flat colour, taken from the picture where the rays hit it.
  - A face reached from two views goes to the one it faces most.
Output models/a320-panels.bin: uint32 header length, JSON header, then per view the heights of the first surface (int16,
1/10 mm, row by row from the picture's top; for placing screens, levers and clicks) and the mesh: int16 positions in the view's
frame (x right, y up, z out of the panel, 1/20 mm), uint16 uv, uint32 indices."""
import sys, os, re, json, struct, collections, numpy as np, trimesh
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
from scipy.ndimage import median_filter
sys.path.insert(0, os.path.dirname(__file__)); import ac3d
RES, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
mats, objs = ac3d.load(RES + 'fd_complete.ac')
HIDE = {'autoland_light.plug', 'autoland_light_on.plug', 'hud', 'hud_box', 'hud_brt', 'hud_brt.axis', 'hud_brt.mark', 'hud_norm_sw', 'hud_declutter_btn', 'hud_ceiling', 'fcu_hud.plug',
        'Eng1N1Btn', 'Eng1N1Btn2O', 'Eng1N1Prot', 'Eng2N1Btn', 'Eng2N1Btn2O', 'Eng2N1Prot', 'glare_ovh_eng_iae.plug', 'ovh_eng_iae.plug'}
LEVER = {'rev_l', 'thr_l_body', 'thr_l_button', 'rev_r', 'thr_r_body', 'thr_r_button', 'FlapsLever', 'FlapsLever_low', 'SpdBrk', 'gear_lever'}
hidden = lambda o: bool(set(o['path']) & HIDE) or o['name'].startswith('hud_') or o['name'].startswith('fcu_labels_hud')
# view: centre, direction (into the panel), up, width, height, render near plane, lowest surface that still belongs to the panel
VIEWS = {'ovh': ((0.385, 1.10, 0), (-0.362, 0.932, 0), (0.932, 0.362, 0), 0.66, 1.30, 0.40, -0.10),
         'front': ((-0.478, 0.229, 0), (-0.955, -0.297, 0), (0, 1, 0), 1.64, 0.54, 0.40, -0.16),
         'ped': ((-0.02289, -0.07831, 0), (-0.13, -0.99, 0), (-1, 0, 0), 0.58, 0.886, 0.30, -0.16)}
def frame(c, n, up):
    c, n, up = (np.array(v, float) for v in (c, n, up)); n /= np.linalg.norm(n); up = up - up.dot(n) * n; up /= np.linalg.norm(up); return c, n, up, np.cross(up, -n)
def build(skip=()):
    V, F, src = [], [], []
    for oi, o in enumerate(objs):
        base = sum(len(v) for v in V); V.append(np.asarray(o['v'], float).reshape(-1, 3))
        if oi in skip or hidden(o) or o['name'] in LEVER: continue
        for fi, (mi, idx, uvs, flags) in enumerate(o['faces']):
            if len(set(idx)) < 3 or mats[mi].get('trans', 0) > 0.3: continue
            for i in range(1, len(idx) - 1): F.append([base + idx[0], base + idx[i], base + idx[i + 1]]); src.append((oi, fi))
    M = trimesh.Trimesh(np.concatenate(V), np.array(F), process=False)
    return M, trimesh.ray.ray_pyembree.RayMeshIntersector(M), np.array(src)
# ---- proud parts (as before): small objects that stand 6.5 to 90 mm above the face around them ----
SMALL = {oi: np.asarray(o['v'], float) for oi, o in enumerate(objs) if len(o['v']) >= 3 and not hidden(o) and np.linalg.norm(np.ptp(np.asarray(o['v'], float), 0)) < 0.14}
_, R0, _ = build(skip=set(SMALL)); PROUD = {}
for k, (c, n, up, W, H, near, low) in VIEWS.items():
    c, n, up, x = frame(c, n, up); lim = 0.32 if k == 'front' else 0.14
    for oi, v in SMALL.items():
        d = v - c; hgt = -(d @ n); u = d @ x; t = d @ up
        if abs(u.mean()) > W / 2 or abs(t.mean()) > H / 2 or hgt.max() > lim or hgt.min() < -0.25: continue
        ru, rt = np.ptp(u) / 2 + 0.004, np.ptp(t) / 2 + 0.004; ang = np.linspace(0, 2 * np.pi, 12, endpoint=False)
        o0 = c[None] + (u.mean() + ru * np.cos(ang))[:, None] * x + (t.mean() + rt * np.sin(ang))[:, None] * up - n * 0.8
        loc, ri, ti = R0.intersects_location(o0, np.repeat(n[None], 12, 0), multiple_hits=False)
        base = float(np.median(0.8 - (loc - o0[ri]) @ n)) if len(ri) else 0.0
        if 0.0065 < hgt.max() - base < 0.09 and not re.match(r'ddrmi|.*screen', objs[oi]['name']): PROUD[oi] = k
for oi, o in enumerate(objs):
    if o['name'] in ('alt-sel', 'qnh_cpt_knb', 'qnh_fo_knb'): PROUD[oi] = 'front'
json.dump({'proud': sorted([[oi, objs[oi]['name'], k] for oi, k in PROUD.items()])}, open(os.path.join(HERE, 'proud.json'), 'w'))
print('proud parts', len(PROUD))
M, R, SRC = build(skip=set(PROUD)); TV = M.vertices; TF = M.faces
DIAG = np.array([np.linalg.norm(np.ptp(np.asarray(o['v'], float).reshape(-1, 3), 0)) if len(o['v']) else 0 for o in objs])
FN = np.cross(TV[TF[:, 1]] - TV[TF[:, 0]], TV[TF[:, 2]] - TV[TF[:, 0]]); FL = np.linalg.norm(FN, axis=1); FN /= np.maximum(FL, 1e-15)[:, None]
def cast(k, ppm):
    c, n, up, W, H, near, low = VIEWS[k]; c, n, up, x = frame(c, n, up)
    nx, ny = int(round(W * ppm)) + 1, int(round(H * ppm)) + 1
    U, T = np.meshgrid(np.linspace(-W / 2, W / 2, nx), np.linspace(H / 2, -H / 2, ny))
    O = (c[None, None] + U[..., None] * x + T[..., None] * up - n * near).reshape(-1, 3)
    loc, ri, ti = R.intersects_location(O, np.repeat(n[None], len(O), 0), multiple_hits=False)
    return nx, ny, ri, ti, near - (loc - O[ri]) @ n, loc
# ---- which view takes which face ----
FINE = 900; best = {}   # triangle -> (facing, view)
hits = {}
for k in VIEWS:
    c, n, up, W, H, near, low = VIEWS[k]; nv = frame(c, n, up)[1]
    nx, ny, ri, ti, hg, loc = cast(k, FINE)
    cnt = np.bincount(ti, minlength=len(TF)); hs = np.bincount(ti, weights=hg, minlength=len(TF)); ls = np.stack([np.bincount(ti, weights=loc[:, a], minlength=len(TF)) for a in range(3)], 1)
    tri = np.nonzero(cnt)[0]; mh = hs[tri] / cnt[tri]; face = np.abs(FN[tri] @ nv)
    hits[k] = {int(t): ls[t] / cnt[t] for t in tri}
    for t, h, f in zip(tri, mh, face):
        oi = SRC[t][0]; big = DIAG[oi] >= 0.25
        if h < low or FL[t] < 1e-14: continue
        if big and f < 0.42: continue            # structure seen edge-on: stays in the shell
        if t not in best or f > best[t][0]: best[int(t)] = (float(f), k)
    print(k, 'rays', nx * ny, 'triangles reached', len(tri))
taken = collections.defaultdict(list)
for t, (f, k) in best.items(): taken[k].append(t)
json.dump({'taken': sorted({(int(SRC[t][0]), int(SRC[t][1])) for t in best})}, open(os.path.join(HERE, 'taken.json'), 'w'))
# ---- write ----
def clip(poly, uvw):
    """clip a triangle (list of (u, t, h, flatflag...)) to the picture's rectangle"""
    for ax, lim, sgn in ((0, uvw[0] / 2, 1), (0, -uvw[0] / 2, -1), (1, uvw[1] / 2, 1), (1, -uvw[1] / 2, -1)):
        out = []
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]; ia, ib = sgn * a[ax] <= sgn * lim, sgn * b[ax] <= sgn * lim
            if ia: out.append(a)
            if ia != ib: s = (lim - a[ax]) / (b[ax] - a[ax]); out.append(a + s * (b - a))
        poly = out
        if len(poly) < 3: return []
    return poly
hdr = {'hs': 10000, 'ps': 20000, 'views': {}}; blob = b''
pad = lambda b: b + b'\0' * ((-len(b)) % 4)
for k, (c, n, up, W, H, near, low) in VIEWS.items():
    c, n, up, x = frame(c, n, up)
    nx, ny, ri, ti, hg, loc = cast(k, 260)
    h = np.full(nx * ny, low - 0.05); h[ri] = hg; h = np.clip(h, low - 0.05, near).reshape(ny, nx); h = median_filter(h, size=3, mode='nearest')
    q = np.round(h * hdr['hs']).astype('<i2').tobytes()
    key, P, UV, I = {}, [], [], []
    def vert(p, uv, tag):
        kk = (tuple(np.round(p * hdr['ps']).astype(int)), tag if tag is not None else tuple(np.round(uv * 65535).astype(int)))
        if kk not in key: key[kk] = len(P); P.append(kk[0]); UV.append(uv)
        return key[kk]
    nflat = 0; PIC = np.asarray(Image.open(os.path.join(OUT, '..', 'img', 'cockpits', 'a320-3d-%s.webp' % k)).convert('RGB')).astype(int)
    for t in taken[k]:
        d = TV[TF[t]] - c; L = np.stack([d @ x, d @ up, -(d @ n)], 1)
        flat = abs(FN[t] @ n) < 0.42
        if flat: m = hits[k][t] - c; fuv = np.clip(np.array([(m @ x) / W + 0.5, (m @ up) / H + 0.5]), 0.001, 0.999); nflat += 1
        if flat:
            px = PIC[min(PIC.shape[0] - 1, int((1 - fuv[1]) * PIC.shape[0])), min(PIC.shape[1] - 1, int(fuv[0] * PIC.shape[1]))]
            if px[1] > 120 and px[1] > px[0] + 40 and px[1] > px[2] + 30: continue   # a lime marking area of the model's texture
        poly = clip(list(L), (W, H))
        if len(poly) < 3: continue
        ids = [vert(p, fuv if flat else np.clip(np.array([p[0] / W + 0.5, p[1] / H + 0.5]), 0, 1), None) for p in poly]
        for i in range(1, len(ids) - 1):
            if len({ids[0], ids[i], ids[i + 1]}) == 3: I += [ids[0], ids[i], ids[i + 1]]
    Pa = np.array(P, '<i2'); Ua = np.round(np.array(UV) * 65535).astype('<u2'); Ia = np.array(I, '<u4')
    parts = [q, Pa.tobytes(), Ua.tobytes(), Ia.tobytes()]; off = len(blob); blob += b''.join(pad(p) for p in parts)
    hdr['views'][k] = {'nx': nx, 'ny': ny, 'off': off, 'nv': len(Pa), 'ni': len(Ia), 'sizes': [len(pad(p)) for p in parts], 'hr': [round(low - 0.05, 3), near]}
    print(k, 'heights', nx, ny, 'mesh verts', len(Pa), 'tris', len(Ia) // 3, 'flat', nflat)
hj = json.dumps(hdr, separators=(',', ':')).encode(); hj += b' ' * ((-len(hj)) % 4)
open(os.path.join(OUT, 'a320-panels.bin'), 'wb').write(struct.pack('<I', len(hj)) + hj + blob)
print('wrote', len(blob) + len(hj) + 4)
