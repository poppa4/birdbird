"""models/a320-shell.bin = the FlightGear structure below, the owner's Blender upper shell above (see warp.py).
Light for the new parts: same quantities as the FlightGear bake (sky seen through the windows, contact shade), with the
weights fitted to the colours the FlightGear lining had in the same place, so both halves look lit by the same light."""
import sys, os, json, numpy as np, trimesh
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import shellbin, warp, hyb, light
OUT = sys.argv[1]; OCC = np.load(sys.argv[2])
h, g, V, Ff, lab, rm, big = hyb.fg_keep(); W, F, ob, t, names = hyb.blender_upper(hyb.fg_tracer(V, Ff, rm)); G = g[0]; N8 = G['N'].astype(np.uint8)
for nm, P, f in hyb.reading_lights(V, Ff, lab):      # reading-light bezel, dimmer knob and switch on the corner posts
    names.append(nm); F = np.vstack([F, f + len(W)]); W = np.vstack([W, P]); ob = np.concatenate([ob, np.full(len(f), len(names) - 1)]); t = np.concatenate([t, np.ones(len(P))])
occV = OCC.reshape(-1, 3); occF = np.arange(len(occV)).reshape(-1, 3)
def tracer(parts):
    Vs, Fs, k = [], [], 0
    for v, f in parts: Vs.append(v); Fs.append(f + k); k += len(v)
    return trimesh.ray.ray_pyembree.RayMeshIntersector(trimesh.Trimesh(np.vstack(Vs), np.vstack(Fs), process=False))
# ---- the lining paint at full light, from the FlightGear window posts (their brightest faces)
import fgcomp
posts = np.isin(lab, [1584, 1585, 1586, 1587, 1588]); Cp = N8[Ff[posts]][:, :, :3].astype(float).mean(1); Yp = Cp.mean(1)
FULL = np.percentile(Yp, 92); tint = (Cp / Yp[:, None]).mean(0) * FULL; print('lining paint at full light', tint.round(1))
# ---- new parts: split at creases, light in the new geometry
fn = np.cross(W[F[:, 1]] - W[F[:, 0]], W[F[:, 2]] - W[F[:, 0]]); fa = np.linalg.norm(fn, axis=1); good = fa > 1e-10; F, ob, fn, fa = F[good], ob[good], fn[good], fa[good]; fu = fn / fa[:, None]
nv = len(W); inc = [[] for _ in range(nv)]
for fi, tri in enumerate(F):
    for v in tri: inc[v].append(fi)
CS = np.cos(np.radians(38)); cornN = np.zeros((len(F), 3, 3))
for v in range(nv):
    fl = inc[v]
    if not fl: continue
    U = fu[fl]; Wt = fn[fl]; S = (U @ U.T) > CS
    for j, fi in enumerate(fl): cornN[fi, list(F[fi]).index(v)] = Wt[S[j]].sum(0)
cornN /= np.maximum(np.linalg.norm(cornN, axis=2, keepdims=True), 1e-12)
key = np.c_[np.repeat(F.reshape(-1), 1), np.round(cornN.reshape(-1, 3) * 20).astype(int)]
uq, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel(); Fn = inv.reshape(-1, 3); Pn = W[uq[:, 0]]
Nn = np.zeros((len(uq), 3)); np.add.at(Nn, inv, cornN.reshape(-1, 3)); Nn /= np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-12); Nn = light.orient(Pn, Nn)
vob = np.zeros(len(uq), int); vob[Fn.reshape(-1)] = np.repeat(ob, 3)
# ---- straight cuts in the FlightGear structure (a cut by whole faces leaves a saw-tooth edge):
#      round the side windows everything ends level at the ring's underside; the slanted wall pieces beyond the aft window go
zone, ycut = hyb.ZONE; Praw = G['P'].astype(np.int64); Nraw = G['N'].astype(np.int64) % 256; UVraw = G['UV'].astype(np.int64); S = h['S']
def clip(poly, ax, val, keep_low):          # Sutherland-Hodgman; poly = list of (pos, attr)
    out = []; n_ = len(poly)
    for k in range(n_):
        (pa, na), (pb, nb) = poly[k], poly[(k + 1) % n_]; ia = (pa[ax] <= val) == keep_low; ib = (pb[ax] <= val) == keep_low
        if ia: out.append((pa, na))
        if ia != ib:
            s_ = (val - pa[ax]) / (pb[ax] - pa[ax]); out.append((pa + s_ * (pb - pa), na + s_ * (nb - na)))
    return out
addP, addN, addF, addL = [], [], [], []; base = len(Praw); drop = np.zeros(len(Ff), bool); CUR = [0]
def emit(poly, mat):
    if len(poly) < 3: return
    ids = []
    for p_, n_ in poly: ids.append(base + len(addP)); addP.append(np.round(p_ * S)); n2 = np.round(n_); n2[3] = mat; addN.append(n2)
    for k in range(1, len(ids) - 1): addF.append([ids[0], ids[k], ids[k + 1]]); addL.append(CUR[0])
face_poly = lambda fi: [(V[v].copy(), Nraw[v].astype(float)) for v in Ff[fi]]
for fi in np.nonzero(zone)[0]:
    if not (V[Ff[fi], 1] > ycut[fi]).any(): continue
    drop[fi] = True; CUR[0] = lab[fi]; emit(clip(face_poly(fi), 1, ycut[fi], True), Nraw[Ff[fi][0], 3])
fmin = V[Ff].min(1); fmax = V[Ff].max(1)
for (bx, by, bz) in hyb.BOXES:
    cand = np.nonzero(~rm & ~drop & (fmax[:, 0] > bx[0]) & (fmin[:, 0] < bx[1]) & (fmax[:, 1] > by[0]) & (fmin[:, 1] < by[1]) & (fmax[:, 2] > bz[0]) & (fmin[:, 2] < bz[1]))[0]
    for fi in cand:
        cur = face_poly(fi); mat = Nraw[Ff[fi][0], 3]; drop[fi] = True; CUR[0] = lab[fi]
        for ax, (lo_, hi_) in ((0, bx), (1, by), (2, bz)):
            emit(clip(cur, ax, lo_, True), mat); cur = clip(cur, ax, lo_, False)       # the part below the box's low side stays
            if len(cur) < 3: break
            emit(clip(cur, ax, hi_, False), mat); cur = clip(cur, ax, hi_, True)       # the part above its high side stays
            if len(cur) < 3: break
print('faces cut straight', int(drop.sum()), 'new faces', len(addF))
if addP:
    G['P'] = np.vstack([Praw, np.array(addP, np.int64)]); G['N'] = np.vstack([G['N'], np.array(addN).astype(np.uint8).astype(np.int8)]); G['UV'] = np.vstack([UVraw, np.zeros((len(addP), 2), np.int64)])
    V = np.vstack([V, np.array(addP) / S])
keepF = np.vstack([Ff[~rm & ~drop], np.array(addF, np.int64).reshape(-1, 3)])
R1 = tracer([(V, keepF), (W, F), (occV, occF)]); sky, con, mid = light.features(R1, Pn, Nn, 160)
Yn = light.level(sky, con, mid)
# smooth the light a little along each smooth surface (same split vertices), keeps creases crisp
import scipy.sparse as sp
E = np.vstack([Fn[:, [0, 1]], Fn[:, [1, 2]], Fn[:, [2, 0]]]); Adj = sp.coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(len(uq),) * 2).tocsr(); Adj = Adj + Adj.T; Adj.data[:] = 1
deg = np.asarray(Adj.sum(1)).ravel()
for _ in range(2): Yn = 0.5 * Yn + 0.5 * (Adj @ Yn) / np.maximum(deg, 1)
PAINT = {'lining': tint, 'dark': tint * np.array([0.24, 0.24, 0.25]), 'plate': tint * 0.94, 'visor': tint * np.array([0.36, 0.38, 0.39]), 'rlplate': tint * np.array([0.42, 0.43, 0.45])}
kind = {i: 'lining' for i in set(ob)}
for i in set(ob):
    n = names[i]
    if n.startswith('Cylinder') or n.startswith('BezierCurve'): kind[i] = 'dark'
    if n.startswith('cockpit light'): kind[i] = 'plate'
    if n in ('rl_knob', 'rl_switch'): kind[i] = 'dark'
    if n == 'rl_plate': kind[i] = 'rlplate'
    if n == 'Plane.109': kind[i] = 'visor'      # the stowed sun visor on its arm (smoked plastic)
kv = np.array([kind[o] for o in vob]); Lv = Yn.copy()
Lv[kv == 'visor'] = 0.55 + 0.45 * Lv[kv == 'visor']; Lv[kv == 'rlplate'] = 0.5 + 0.5 * Lv[kv == 'rlplate']; Lv[kv == 'dark'] = 0.45 + 0.55 * Lv[kv == 'dark']     # dark plastics keep some form
Lv[np.array([names[o] == 'closing' for o in vob])] = 0.16      # the closing wall behind the lining: seen only through a joint, as shadow
col = np.array([PAINT[k] for k in kv]) * Lv[:, None]
col = np.clip(np.round(col), 2, 255)
print('new verts', len(uq), 'faces', len(Fn))
for i in sorted(set(ob)): m = vob == i; print('  %-22s L mean %.2f  5%%..95%% %.2f..%.2f  sky %.3f con %.2f mid %.2f' % (names[i], Yn[m].mean(), *np.percentile(Yn[m], [5, 95]), sky[m].mean(), con[m].mean(), mid[m].mean()))
# ---- write
S = h['S']; P0 = G['P']; nfg = len(P0)
G['P'] = np.vstack([P0, np.round(Pn * S).astype(np.int64)]); G['UV'] = np.vstack([G['UV'], np.zeros((len(Pn), 2), np.int64)])
G['N'] = np.vstack([G['N'], np.c_[col, np.zeros(len(col))].astype(np.uint8).astype(np.int8)]); G['I'] = np.vstack([keepF, Fn + nfg])
shellbin.write(OUT, h, g); print('written', OUT, 'faces', len(G['I']), os.path.getsize(OUT))
if os.environ.get('DUMP'):   # tagged copy for the picker: src 0 FlightGear, 1 FlightGear cut, 2 Blender; id = component / object
    kf = ~rm & ~drop
    np.savez(os.environ['DUMP'], v=np.vstack([V, Pn]), f=G['I'], src=np.concatenate([np.zeros(kf.sum(), int), np.ones(len(addF), int), np.full(len(Fn), 2)]),
             id=np.concatenate([lab[kf], np.array(addL, int), ob]), names=np.array(names))
