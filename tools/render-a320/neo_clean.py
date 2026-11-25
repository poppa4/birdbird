"""Clean models/a320-shell-test.bin (the trial structure from the owner's model) in place of a rebuild:
 1. the side cheeks of the overhead (thin plates at |x| = 0.31-0.335 m) are triangulated as long fans from their lowest front
    corner; that corner hangs 7 cm below the overhead's front edge, so the fan shows as a blade under the overhead.
    Faces of those plates that reach below y = 0.86 m in front of z = -0.10 m are dropped.
 2. a broken fitting at each windshield corner of the roof (|x| 0.76-0.86, y 0.87-0.95, z 0-0.16): some twenty pieces of one to
    nine faces each, left over from the dissolve, that read as a loose wedge. Components lying wholly inside that box are
    replaced by their convex hull: one solid, clean block of the same size and colour that still closes the roof there.
 3. flat plates (every face of the component within 8 degrees of one plane, at least 0.01 m2) take one even colour: the
    baked light on their long dissolved triangles showed as diagonal streaks across visors and roof panels.
 4. the baked light on the remaining large curved parts is smoothed (vertex colours averaged with their neighbours, same
    material only, 12 passes): a long dissolved triangle took its light from three far-apart corners and showed as a fan.
 5. the new model's centre-console side plates (|x| 0.24-0.27 m, from the main panel 40 cm aft, up to 25 cm above the
    pedestal) stood in front of the ECAM-side buttons and the MCDU line keys as grey fins, and its own pedestal top lies a few
    cm above the FlightGear pedestal that the panel picture is on: both go (everything over the pedestal more than 12 mm
    above its face, plane fitted to the pedestal's controls: y = -0.1219 - 0.1551 z - 0.0024 x).
usage: neo_clean.py <in.bin> <out.bin>   (needs numpy, trimesh, scipy; shellbin.py beside it; OCC=occ.npy from export_occ.py)"""
import sys
import numpy as np, trimesh
import shellbin

h, G = shellbin.read(sys.argv[1]); g = G[0]
V = shellbin.metres(h, g); F = g['I']; T = V[F]
L = np.max([np.linalg.norm(T[:, 1] - T[:, 0], axis=1), np.linalg.norm(T[:, 2] - T[:, 1], axis=1),
            np.linalg.norm(T[:, 0] - T[:, 2], axis=1)], 0)
drop = np.zeros(len(F), bool)

ax = np.abs(T[:, :, 0])
plate = (ax.min(1) > 0.305) & (ax.max(1) < 0.336)
tip = ((T[:, :, 1] < 0.86) & (T[:, :, 2] < -0.10)).any(1)
d1 = plate & tip
drop |= d1

M = trimesh.Trimesh(V, F, process=False)
lab = trimesh.graph.connected_component_labels(M.face_adjacency, node_count=len(F))
lo = np.array([0.755, 0.865, -0.01]); hi = np.array([0.865, 0.95, 0.16])
d2 = np.zeros(len(F), bool)
for side in (-1, 1):
    P = T.copy(); P[:, :, 0] *= side
    inside = ((P >= lo) & (P <= hi)).all(2).all(1)
    for c in np.unique(lab[inside]):
        f = lab == c
        if f.sum() <= 12 and inside[f].all(): d2 |= f
drop |= d2
# 6. the corner where the glareshield's outboard end meets the side wall: some ninety slivers converging to a point (dissolve
#    left-overs) read as dark shards; parts lying (95 %) inside that corner are left out (a hull there would cover the lateral lighting panels)
lo6 = np.array([0.70, 0.15, -0.62]); hi6 = np.array([0.98, 0.52, -0.18])
d6s = []
for side in (-1, 1):
    P6 = T.copy(); P6[:, :, 0] *= side
    ins = ((P6 >= lo6) & (P6 <= hi6)).all(2).all(1); f6 = np.zeros(len(F), bool)
    for c in np.unique(lab[ins]):
        ff = lab == c
        if ins[ff].mean() > 0.95: f6 |= ff
    d6s.append(f6)
d6 = d6s[0] | d6s[1]
drop |= d6
print('glareshield-end shard faces', d6.sum())
# 7. loose strips: small parts (at most 30 faces) that are thin flat ribbons - under 12 mm wide and over 10 cm long; left over
#    from the dissolve, they read as rods and stray lines across the lining
d7 = np.zeros(len(F), bool)
order7 = np.argsort(lab); b7 = np.r_[0, np.nonzero(np.diff(lab[order7]))[0] + 1, len(order7)]
for s7, e7 in zip(b7[:-1], b7[1:]):
    f = order7[s7:e7]
    if len(f) > 30: continue
    Pq7 = T[f].reshape(-1, 3); Q7 = Pq7 - Pq7.mean(0)
    _, _, vt7 = np.linalg.svd(Q7, full_matrices=False); ext7 = np.ptp(Q7 @ vt7.T, 0)
    if ext7[0] > 0.10 and ext7[1] < 0.012: d7[f] = True
#    ... but a strip that closes a slit stays: seen from a seat through the strip, with the strip gone, the ray would leave the
#    flight deck (sky or ground showing through). Tested against the rest of the structure and the page's panels (occ.npy).
import os
occp = os.environ.get('OCC', 'occ.npy')
if os.path.exists(occp) and d7.any():
    occ7 = np.load(occp).reshape(-1, 3, 3).astype(np.float64)
    rest = ~d7 & ~drop
    allV7 = np.vstack([V[F[rest]].reshape(-1, 3), occ7.reshape(-1, 3)])
    M7 = trimesh.Trimesh(allV7, np.arange(len(allV7)).reshape(-1, 3), process=False); R7 = trimesh.ray.ray_pyembree.RayMeshIntersector(M7)
    MS = trimesh.Trimesh(V, F[d7], process=False); RS = trimesh.ray.ray_pyembree.RayMeshIntersector(MS)
    labs7 = lab[d7]; keepc = set()
    cen7 = T[d7].mean(1)
    for eye in ((-0.53, 0.63, 0.31), (0.53, 0.63, 0.31), (0.0, 0.75, 0.95)):
        e = np.array(eye); d = cen7 - e; d /= np.linalg.norm(d, axis=1, keepdims=True)
        o = np.repeat(e[None], len(d), 0)
        first = RS.intersects_first(o, d)                    # the strip seen first among strips?
        _, ri, _ = R7.intersects_location(o, d, multiple_hits=False)
        esc = np.ones(len(d), bool); esc[ri] = False
        # visible: no other surface nearer than the strip
        locS, riS, _ = RS.intersects_location(o, d, multiple_hits=False)
        locR, riR, _ = R7.intersects_location(o, d, multiple_hits=False)
        dS = np.full(len(d), np.inf); dS[riS] = np.linalg.norm(locS - o[riS], axis=1)
        dR = np.full(len(d), np.inf); dR[riR] = np.linalg.norm(locR - o[riR], axis=1)
        slit = (dS < dR) & (dR > dS + 0.25)                    # behind the strip: nothing for 25 cm (outside, or far)
        for c in np.unique(labs7[slit]): keepc.add(c)
    k7 = np.isin(lab, list(keepc)) & d7
    d7 &= ~k7
    print('strips kept because they close a slit:', k7.sum(), 'faces')
drop |= d7
print('loose strips', d7.sum(), 'faces')
# 5. centre-console side plates
cr0 = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); n0 = cr0 / np.maximum(np.linalg.norm(cr0, axis=1), 1e-12)[:, None]
d5 = np.zeros(len(F), bool)
for c in np.unique(lab):
    pass
cand = (np.abs(n0[:, 0]) > 0.95) & (np.abs(T[:, :, 0]).min(1) > 0.238) & (np.abs(T[:, :, 0]).max(1) < 0.268) \
       & (T[:, :, 2].min(1) > -0.83) & (T[:, :, 2].max(1) < -0.37) & (T[:, :, 1].min(1) > -0.06) & (T[:, :, 1].max(1) < 0.41)
for c in np.unique(lab[cand]):
    f = lab == c
    if cand[f].all(): d5 |= f
drop |= d5
# 5b. anything of the structure standing above the pedestal face (the new model has its own pedestal top a few cm above the
#     FlightGear one that the panel picture is on)
ysT = -0.1219 - 0.1551 * T[:, :, 2] - 0.0024 * T[:, :, 0]
above = (np.abs(T[:, :, 0]).max(1) < 0.29) & (T[:, :, 2].min(1) > -0.86) & (T[:, :, 2].max(1) < 0.36) \
        & (T[:, :, 1].mean(1) > ysT.mean(1) + 0.012) & (T[:, :, 1].max(1) < 0.20)
d5 |= above; drop |= above
print('console side plates and pedestal top', d5.sum(), 'faces')
hulls = []
for side in (-1, 1):
    f = d2 & (np.sign(T[:, :, 0].mean(1)) == side)
    if not f.any(): continue
    vi = np.unique(F[f].ravel())
    hull = trimesh.convex.convex_hull(V[vi])
    col = np.median(g['N'][vi], 0).round().astype(np.int64)
    hulls.append((hull, col))
print('overhead cheek fan faces', d1.sum(), '| corner fitting faces', d2.sum(), '| total', drop.sum(), 'of', len(F))
g['I'] = F[~drop]
# 5c. the pedestal's own side walls (vertical planes at |x| = 0.26 m) end 12 mm above the pedestal face instead of 6 cm
Fk0 = g['I']; Pm = g['P'].astype(np.float64) / h['S']; Tk0 = Pm[Fk0]
crk = np.cross(Tk0[:, 1] - Tk0[:, 0], Tk0[:, 2] - Tk0[:, 0]); nk = crk / np.maximum(np.linalg.norm(crk, axis=1), 1e-12)[:, None]
wallf = (np.abs(nk[:, 0]) > 0.95) & (np.abs(Tk0[:, :, 0]).min(1) > 0.255) & (np.abs(Tk0[:, :, 0]).max(1) < 0.27) \
        & (Tk0[:, :, 2].min(1) > -1.0) & (Tk0[:, :, 2].max(1) < 0.36)
wv = np.zeros(len(Pm), bool); wv[Fk0[wallf].ravel()] = True
ys = -0.1219 - 0.1551 * Pm[:, 2] - 0.0024 * Pm[:, 0] + 0.012
low = wv & (Pm[:, 1] > ys) & (Pm[:, 1] < 0.20)
P2 = g['P'].copy(); P2[low, 1] = np.round(ys[low] * h['S']); g['P'] = P2
print('pedestal side-wall vertices lowered', int(low.sum()))
# 3. even colour on flat plates
Fk = g['I']; Vk = shellbin.metres(h, g); Tk = Vk[Fk]
cr = np.cross(Tk[:, 1] - Tk[:, 0], Tk[:, 2] - Tk[:, 0]); ar = 0.5 * np.linalg.norm(cr, axis=1); nr = cr / np.maximum(2 * ar, 1e-12)[:, None]
Mk = trimesh.Trimesh(Vk, Fk, process=False)
labk = trimesh.graph.connected_component_labels(Mk.face_adjacency, node_count=len(Fk))
order = np.argsort(labk); bounds = np.r_[0, np.nonzero(np.diff(labk[order]))[0] + 1, len(order)]
N = g['N'].astype(np.int64); flat = 0
for a, b in zip(bounds[:-1], bounds[1:]):
    f = order[a:b]; A = ar[f]
    if A.sum() < 0.01: continue
    n0 = (nr[f] * A[:, None]).sum(0); n0 /= np.linalg.norm(n0) + 1e-12
    if (np.abs(nr[f] @ n0)[A > 1e-7] < np.cos(np.radians(8))).any(): continue
    vi = np.unique(Fk[f].ravel())
    if len(np.unique(N[vi, 3])) > 1: continue
    w = np.zeros(len(N)); np.add.at(w, Fk[f].ravel(), np.repeat(A, 3))
    c = (N[vi, :3] * w[vi, None]).sum(0) / w[vi].sum()
    N[vi, :3] = np.round(c); flat += 1
import scipy.sparse as sp
q = np.round(Vk * 4000).astype(np.int64)
_, wid = np.unique(np.c_[q, N[:, 3]], axis=0, return_inverse=True); wid = wid.ravel()
E = np.concatenate([Fk[:, [0, 1]], Fk[:, [1, 2]], Fk[:, [2, 0]]])
nw = wid.max() + 1
A = sp.coo_matrix((np.ones(len(E) * 2), (np.r_[wid[E[:, 0]], wid[E[:, 1]]], np.r_[wid[E[:, 1]], wid[E[:, 0]]])), shape=(nw, nw)).tocsr()
A.data[:] = 1; A = A + sp.identity(nw, format='csr')
deg = np.asarray(A.sum(1)).ravel()
cw = np.zeros((nw, 3)); cnt = np.bincount(wid, minlength=nw)
np.add.at(cw, wid, N[:, :3]); cw /= np.maximum(cnt, 1)[:, None]
big = np.zeros(nw, bool)
compA = np.bincount(labk, weights=ar); bigc = compA[labk] > 0.02
big[wid[Fk[bigc].ravel()]] = True
for _ in range(12):
    nc = (A @ cw) / deg[:, None]
    cw[big] = nc[big]
N[:, :3] = np.round(cw[wid])
g['N'] = N
print('flat plates evened', flat, '| vertices smoothed', int(big.sum()))
for hull, col in hulls:   # appended as new vertices (flat colour, uv 0)
    n0 = len(g['P'])
    g['P'] = np.vstack([g['P'], np.round(hull.vertices * h['S']).astype(np.int64)])
    g['UV'] = np.vstack([g['UV'], np.zeros((len(hull.vertices), 2), np.int64)])
    g['N'] = np.vstack([g['N'], np.repeat(col[None], len(hull.vertices), 0)])
    g['I'] = np.vstack([g['I'], hull.faces + n0])
    print('hull', len(hull.faces), 'faces, colour', col.tolist(), 'size', np.ptp(hull.vertices, 0).round(3).tolist())
shellbin.write(sys.argv[2], h, G)
