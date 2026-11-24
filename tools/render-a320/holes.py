"""Find the gaps in the A320 3D cockpit (models/a320-shell.bin plus the rendered panel planes) as seen from the pilot's eye, and
write patches that close them: models/a320-holes.json, used by a320-3d.js.
Method: rays from a few eye positions (the captain's eye and small head movements) over the whole sphere. A direction that
leaves the cockpit without hitting anything is either a window or a gap. Directions are put on an azimuth x elevation grid,
the escaping cells are grouped into connected regions, and the big regions are the windows (kept open); every small region is
a gap. Each gap (grown by one cell) becomes a patch on a sphere 2.6 m from the eye, coloured like the structure around it.
The page draws the patches behind everything else in the cockpit pass, so they only show where there was nothing.
Run: python3 holes.py /path/to/birdbird"""
import sys, os, json, struct, numpy as np, trimesh
from scipy import ndimage
ROOT = sys.argv[1]
b = open(os.path.join(ROOT, 'models/a320-shell.bin'), 'rb').read(); hl = struct.unpack('<I', b[:4])[0]; hdr = json.loads(b[4:4 + hl]); base = 4 + hl
V, F, C = [], [], []
for g in hdr['groups']:
    o = base + g['off']; sp, su, sn, si = g['sizes']
    P = np.frombuffer(b, np.int16, g['nv'] * 3, o).reshape(-1, 3).astype(float) / hdr['S']; o += sp + su
    L = np.frombuffer(b, np.uint8, g['nv'] * 4, o).reshape(-1, 4)[:, 0].astype(float) / 255; o += sn
    I = np.frombuffer(b, np.uint32 if g.get('i32') else np.uint16, g['ni'], o).reshape(-1, 3).astype(np.int64)
    F.append(I + sum(len(v) for v in V)); V.append(P); C.append(L)
# the panel planes (same numbers as VIEWS in a320-3d.js; model frame -> three: (x,y,z) -> (-z, y, x))
T = lambda v: np.array([-v[2], v[1], v[0]], float)
VIEWS = {'ovh': ((0.385, 1.10, 0), (-0.362, 0.932, 0), (0.932, 0.362, 0), 0.66, 1.30), 'front': ((-0.478, 0.229, 0), (-0.955, -0.297, 0), (0, 1, 0), 1.64, 0.50),
         'ped': ((-0.02289, -0.07831, 0), (-0.13, -0.99, 0), (-1, 0, 0), 0.58, 0.886)}
for k, (c, n, up, W, H) in VIEWS.items():
    c, n, up = map(lambda v: np.array(v, float), (c, n, up)); n /= np.linalg.norm(n); up = up - up.dot(n) * n; up /= np.linalg.norm(up); x = np.cross(up, -n)
    cc = c - up * (0.02 if k == 'front' else 0)  # the front plane minus its see-through top strip
    q = [cc + x * sx * W / 2 + up * sy * H / 2 for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    q = [T(p) for p in q]; n0 = sum(len(v) for v in V); V.append(np.array(q)); F.append(np.array([[n0, n0 + 1, n0 + 2], [n0, n0 + 2, n0 + 3]])); C.append(np.full(4, 0.8))
Vs, Fs, Cs = np.concatenate(V), np.concatenate(F), np.concatenate(C)
M = trimesh.Trimesh(Vs, Fs, process=False); R = trimesh.ray.ray_pyembree.RayMeshIntersector(M)
EYE = T((0.31, 0.63, 0.53))
eyes = [EYE + d for d in ([0, 0, 0], [0.06, 0, 0], [-0.06, 0, 0], [0, 0.05, 0], [0, -0.05, 0], [0, 0, -0.08], [0, 0, 0.06])]
NA, NE = 960, 480
az = (np.arange(NA) + 0.5) / NA * 2 * np.pi - np.pi; el = (np.arange(NE) + 0.5) / NE * np.pi - np.pi / 2
A, E = np.meshgrid(az, el)  # E rows
D = np.stack([np.cos(E) * np.sin(A), np.sin(E), -np.cos(E) * np.cos(A)], -1).reshape(-1, 3)  # az 0 = forward (-z)
esc = np.zeros(len(D), bool); col = np.zeros(len(D)); cnt = np.zeros(len(D))
for e in eyes:
    o = np.repeat(e[None], len(D), 0); loc, ri, ti = R.intersects_location(o, D, multiple_hits=False)
    hit = np.zeros(len(D), bool); dist = np.linalg.norm(loc - o[ri], axis=1); ok = dist < 4.0; hit[ri[ok]] = True
    esc |= ~hit
    # brightness of what is hit (baked light of the triangle's first vertex)
    col[ri[ok]] += Cs[Fs[ti[ok], 0]]; cnt[ri[ok]] += 1
esc = esc.reshape(NE, NA); col = (col / np.maximum(cnt, 1)).reshape(NE, NA)
lab, n = ndimage.label(esc, structure=np.ones((3, 3)))
# wrap-around in azimuth: join labels across the seam
for r in range(NE):
    a, b2 = lab[r, 0], lab[r, -1]
    if a and b2 and a != b2: lab[lab == b2] = a
sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(lab.max() + 1))
# solid angle of a cell ~ cos(el) * dA * dE
cellsr = np.cos(E) * (2 * np.pi / NA) * (np.pi / NE)
sr = ndimage.sum(cellsr, lab, index=np.arange(lab.max() + 1))
big = {i for i in range(1, len(sr)) if sr[i] > 0.035}
small = np.isin(lab, [i for i in range(1, len(sr)) if sr[i] > 0 and i not in big])
# no window reaches below the glareshield: an escaping direction that leaves the cockpit box (side walls at |x| 1.05 m, nose
# at z -1.1 m) lower than 0.45 m is a gap even when it touches a window region
Dg = D.reshape(NE, NA, 3); tx = np.where(np.abs(Dg[..., 0]) > 1e-6, (1.05 - np.sign(Dg[..., 0]) * EYE[0]) / np.abs(Dg[..., 0]), 1e9)
tz = np.where(Dg[..., 2] < -1e-6, (EYE[2] + 1.1) / -Dg[..., 2], 1e9); t = np.minimum(tx, tz); yx = EYE[1] + t * Dg[..., 1]
zx = EYE[2] + t * Dg[..., 2]
low = esc & (tx < tz) & (yx < 0.40) & (zx > -0.95) & (t < 1e8)  # through the side walls only, well below the side-window sills
print('low escape cells', int(low.sum()))
gap = (ndimage.binary_dilation(small, iterations=2) & ~np.isin(lab, list(big))) | (ndimage.binary_dilation(low, iterations=1) & ~(esc & ~low & ~small))
print('regions', len(sr) - 1, 'windows', len(big), [round(sr[i], 3) for i in big], 'gap cells', int(small.sum()), 'patch cells', int(gap.sum()))
# colour: brightness of the structure around each gap cell
lit = np.where(cnt.reshape(NE, NA) > 0, col, np.nan)
k = np.ones((7, 7)); num = ndimage.convolve(np.nan_to_num(lit), k, mode='wrap'); den = ndimage.convolve((~np.isnan(lit)).astype(float), k, mode='wrap')
br = np.clip(num / np.maximum(den, 1e-6), 0.2, 1.0)
RAD = 2.6; tris = []; cols = []
def P(r, c): e = -np.pi / 2 + r / NE * np.pi; a = -np.pi + c / NA * 2 * np.pi; return EYE + RAD * np.array([np.cos(e) * np.sin(a), np.sin(e), -np.cos(e) * np.cos(a)])
for r in range(NE):
    c = 0
    while c < NA:
        if not gap[r, c]: c += 1; continue
        c0 = c
        while c < NA and gap[r, c] and abs(br[r, c] - br[r, c0]) < 0.08: c += 1
        p00, p01, p11, p10 = P(r, c0), P(r, c), P(r + 1, c), P(r + 1, c0)
        tris += [p00, p01, p11, p00, p11, p10]; cols.append(round(float(br[r, c0:c].mean()), 2))
pos = np.round(np.array(tris).reshape(-1), 3).tolist() if tris else []
json.dump({'note': 'gap patches for the A320 3D cockpit, built by tools/render-a320/holes.py from models/a320-shell.bin (GPL-2.0)', 'eye': EYE.round(3).tolist(), 'p': pos, 'c': cols},
          open(os.path.join(ROOT, 'models/a320-holes.json'), 'w'), separators=(',', ':'))
print('patches', len(cols), 'bytes', os.path.getsize(os.path.join(ROOT, 'models/a320-holes.json')))
