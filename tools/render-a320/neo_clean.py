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
usage: neo_clean.py <in.bin> <out.bin>   (needs numpy, trimesh, scipy; shellbin.py beside it)"""
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
