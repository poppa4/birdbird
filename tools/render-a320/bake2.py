"""Bakes daylight into the A320 structure (after neo_clean.py), with the light sampled where it comes from:
 - window light: sample points are laid in every window opening (found by casting rays from both seats); each point of the
   structure sends rays to a random subset of them; an unblocked ray adds sky (brighter for directions above the horizon)
   weighted by the angle at the surface, the angle at the window and the distance - soft, noise-free daylight,
 - ambient occlusion: short cosine rays (0.35 m); corners, joints and the space under panels darken,
 - large triangles are split first (no edge longer than SPLIT) so the light has points to live on,
 - colour = the part's colour (neo_look.BASE) x the light, through a soft tone curve.
The panels, levers, screens and the page's own lining (export_occ.py) block light but are not baked.
usage: bake2.py <in.bin> <occluders.npy> <out.bin>"""
import sys, time, os
import numpy as np, trimesh
import shellbin, classify
from neo_look import BASE, MATID

SPLIT = float(os.environ.get('SPLIT', 0.12)); NWIN = int(os.environ.get('NWIN', 96)); NAO = int(os.environ.get('NAO', 24))
t0 = time.time()
h, G = shellbin.read(sys.argv[1]); g = G[0]
cls, lab, C, n, A = classify.classify(h, g)
V = shellbin.metres(h, g); F = g['I']; T = V[F]
# ---- split long triangles
L = np.max([np.linalg.norm(T[:, 1] - T[:, 0], axis=1), np.linalg.norm(T[:, 2] - T[:, 1], axis=1), np.linalg.norm(T[:, 0] - T[:, 2], axis=1)], 0)
K = np.clip(np.ceil(L / SPLIT).astype(int), 1, 24)
P_out, F_out, C_out, N_out = [], [], [], []; base = 0
for k in np.unique(K):
    ii, jj = np.meshgrid(np.arange(k + 1), np.arange(k + 1), indexing='ij'); m = ii + jj <= k
    bc = np.stack([k - ii[m] - jj[m], ii[m], jj[m]], 1) / k
    idx = -np.ones((k + 1, k + 1), int); idx[m] = np.arange(m.sum()); tri = []
    for i in range(k):
        for j in range(k - i):
            tri.append((idx[i, j], idx[i + 1, j], idx[i, j + 1]))
            if i + j < k - 1: tri.append((idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]))
    tri = np.array(tri); f = np.nonzero(K == k)[0]
    P = np.einsum('gc,fcd->fgd', bc, T[f]); nf, ng = P.shape[:2]
    P_out.append(P.reshape(-1, 3)); F_out.append((tri[None] + (base + np.arange(nf) * ng)[:, None, None]).reshape(-1, 3))
    C_out.append(np.repeat(cls[f], len(tri))); N_out.append(np.repeat(n[f], len(tri), 0)); base += nf * ng
Pv = np.concatenate(P_out); Fv = np.concatenate(F_out); fcls = np.concatenate(C_out); fn = np.concatenate(N_out)
pcls = np.zeros(len(Pv), int); pn = np.zeros((len(Pv), 3))
pcls[Fv.ravel()] = np.repeat(fcls, 3); pn[Fv.ravel()] = np.repeat(fn, 3, 0)
bad = ~np.isfinite(pn).all(1) | (np.linalg.norm(pn, axis=1) < 0.5); pn[bad] = [0.0, 1.0, 0.0]
cen = np.array([0.0, 0.45, 0.35]); flip = np.einsum('ij,ij->i', pn, cen - Pv) < 0; pn[flip] *= -1
print(f'split {len(F)} -> {len(Fv)} faces, {len(Pv)} points ({time.time()-t0:.0f}s)', flush=True)

occ = np.load(sys.argv[2]).reshape(-1, 3, 3).astype(np.float64)
allV = np.vstack([Pv, occ.reshape(-1, 3)]); allF = np.vstack([Fv, len(Pv) + np.arange(len(occ) * 3).reshape(-1, 3)])
M = trimesh.Trimesh(allV, allF, process=False); R = trimesh.ray.ray_pyembree.RayMeshIntersector(M)

# ---- window sample points: rays from both seats that leave the flight deck pass through a window; the point is laid just
# beyond the nearest frame hit around it (so it sits in the opening), weighted by the area it stands for
STEP = 0.5
ws, wd, wa = [], [], []
for eye in ((-0.53, 0.63, 0.31), (0.53, 0.63, 0.31)):
    ys = np.radians(np.arange(-150, 150, STEP)); ps = np.radians(np.arange(70, -30, -STEP)); Y, Pp = np.meshgrid(ys, ps)
    d = np.stack([-np.sin(Y) * np.cos(Pp), np.sin(Pp), -np.cos(Y) * np.cos(Pp)], -1)
    e = np.array(eye); o = np.repeat(e[None], d.size // 3, 0)
    loc, ri, ti = R.intersects_location(o, d.reshape(-1, 3), multiple_hits=False)
    dist = np.full(d.size // 3, np.nan); dist[ri] = np.linalg.norm(loc - e, axis=1); dist = dist.reshape(Y.shape)
    esc = np.isnan(dist) & (d[..., 1] < 0.6)
    # distance to the opening: the largest frame distance among nearby hit pixels
    from scipy import ndimage
    dd = np.where(np.isnan(dist), 0, dist)
    near = ndimage.maximum_filter(dd, size=9)
    ok = esc & (near > 0.2)
    r = near[ok] + 0.04
    pts = e + d[ok] * r[:, None]
    dOm = np.radians(STEP) ** 2 * np.cos(Pp[ok])
    ws.append(pts); wd.append(d[ok]); wa.append(r ** 2 * dOm)
ws = np.concatenate(ws); wd = np.concatenate(wd); wa = np.concatenate(wa)
# a fixed, even subset (every point uses all of them: no noise from random picks)
sel = np.random.default_rng(1).permutation(len(ws))[:NWIN]
wa = wa * (len(ws) / NWIN); ws, wd, wa = ws[sel], wd[sel], wa[sel]
print(f'window samples {len(ws)}, total opening area {wa.sum()/2:.2f} m2 ({time.time()-t0:.0f}s)', flush=True)

def sky(dv):
    up = dv[:, 1]
    return np.where(up > 0, 1.0 + 0.7 * up, 0.38 + 0.12 * up)

rng = np.random.default_rng(3)
Ewin = np.zeros(len(Pv)); AO = np.zeros(len(Pv))
kk = np.arange(NAO); rr = np.sqrt((kk + 0.5) / NAO); ph = kk * 2.399963
aoloc = np.stack([rr * np.cos(ph), rr * np.sin(ph), np.sqrt(1 - rr ** 2)], 1)
CH = 8000
for s in range(0, len(Pv), CH):
    e_ = min(len(Pv), s + CH); p = Pv[s:e_]; nn = pn[s:e_]; m = len(p)
    o = p + nn * 0.004
    # window light
    pick = np.broadcast_to(np.arange(NWIN), (m, NWIN))
    tgt = ws[pick]; v = tgt - o[:, None]; dist = np.linalg.norm(v, axis=2); w = v / dist[..., None]
    cs = np.einsum('mkd,md->mk', w, nn); cw = np.einsum('mkd,mkd->mk', w, wd[pick])
    use = (cs > 0.01) & (cw > 0.05)
    contrib = np.where(use, cs * cw * wa[pick] / np.maximum(dist, 0.15) ** 2 * sky(w.reshape(-1, 3)).reshape(m, NWIN), 0)
    oo = np.repeat(o, NWIN, 0)[use.ravel()]; dd = w.reshape(-1, 3)[use.ravel()]
    if len(oo):
        loc, ri, ti = R.intersects_location(oo, dd, multiple_hits=False)
        blocked = np.zeros(len(oo), bool)
        hd = np.linalg.norm(loc - oo[ri], axis=1); blocked[ri[hd < dist.ravel()[use.ravel()][ri] - 0.01]] = True
        vis = np.ones(m * NWIN); vis[np.nonzero(use.ravel())[0][blocked]] = 0
        contrib = contrib * vis.reshape(m, NWIN)
    Ewin[s:e_] = contrib.sum(1) / np.pi
    # ambient occlusion
    t1 = np.cross(nn, np.where(np.abs(nn[:, :1]) < 0.9, [[1.0, 0, 0]], [[0, 1.0, 0]])); t1 /= np.linalg.norm(t1, axis=1, keepdims=True); t2 = np.cross(nn, t1)
    d = aoloc[None, :, 0:1] * t1[:, None] + aoloc[None, :, 1:2] * t2[:, None] + aoloc[None, :, 2:3] * nn[:, None]
    oo = np.repeat(o, NAO, 0); dd = d.reshape(-1, 3)
    loc, ri, ti = R.intersects_location(oo, dd, multiple_hits=False)
    occd = np.full(len(oo), np.inf); occd[ri] = np.linalg.norm(loc - oo[ri], axis=1)
    occd[occd < 0.015] = np.inf      # hits right at the start: overlapping duplicate surfaces in the model, not real occlusion
    AO[s:e_] = np.clip(occd.reshape(m, NAO) / 0.35, 0, 1).mean(1)
    if (s // CH) % 10 == 0: print(f'  {e_}/{len(Pv)} ({time.time()-t0:.0f}s)', flush=True)
# points at the same place (neighbouring faces) share their light, then a few passes of smoothing over the faces' edges
import scipy.sparse as sp
q = np.round(Pv * 500).astype(np.int64)
_, wid = np.unique(np.c_[q, pcls], axis=0, return_inverse=True); wid = wid.ravel(); nw = wid.max() + 1
cnt = np.bincount(wid, minlength=nw)
E_ = np.c_[Ewin, AO]
Ew = np.stack([np.bincount(wid, weights=E_[:, i], minlength=nw) for i in range(2)], 1) / cnt[:, None]
Ed = np.concatenate([Fv[:, [0, 1]], Fv[:, [1, 2]], Fv[:, [2, 0]]])
Adj = sp.coo_matrix((np.ones(len(Ed) * 2), (np.r_[wid[Ed[:, 0]], wid[Ed[:, 1]]], np.r_[wid[Ed[:, 1]], wid[Ed[:, 0]]])), shape=(nw, nw)).tocsr()
Adj.data[:] = 1; Adj = Adj + sp.identity(nw, format='csr'); deg = np.asarray(Adj.sum(1)).ravel()
for _ in range(4): Ew = (Adj @ Ew) / deg[:, None]
Ewin, AO = Ew[wid, 0], Ew[wid, 1]
np.savez_compressed(sys.argv[3] + '.light.npz', Ewin=Ewin, AO=AO, pcls=pcls, Pv=Pv, Fv=Fv)

def tone(Ewin, AO):
    lin = pcls == classify.NAMES.index('lining')
    w = Ewin / np.median(Ewin[lin])
    x = (0.55 + 0.45 * np.clip(w, 0, 3) ** 0.7) * (0.40 + 0.60 * AO ** 1.2)
    x = x / np.median(x[lin])
    return np.clip(1.15 * x / (1 + 0.15 * x), 0.25, 1.22)

s_ = tone(Ewin, AO)
col = np.array([BASE[nm] for nm in classify.NAMES], float)
Nn = np.zeros((len(Pv), 4)); Nn[:, :3] = col[pcls] * s_[:, None]
Nn[:, 3] = np.vectorize(lambda c: MATID.get(classify.NAMES[c], 0))(pcls)
Pq = np.round(Pv * h['S']).astype(np.int64)
key = np.c_[Pq, pcls, np.round(Nn[:, :3]).astype(np.int64)]
_, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
g['P'] = Pq[first]; g['UV'] = np.zeros((len(first), 2), np.int64); g['N'] = np.clip(np.round(Nn[first]), 0, 127).astype(np.int64); g['I'] = inv[Fv]
h.pop('seals', None)
shellbin.write(sys.argv[3], h, G)
print(f'written {sys.argv[3]}: {len(first)} points, {len(Fv)} faces ({time.time()-t0:.0f}s)')
