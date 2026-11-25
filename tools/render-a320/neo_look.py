"""Colours per part for the A320 trial structure (after neo_clean.py): every part class gets the colour it has on the
aircraft, and keeps the light baked into it (light factor = the vertex's brightness over its class median).
Rendered colour is about 3.4 x the stored value under the page's lighting; targets below are the stored values.
usage: neo_look.py <in.bin> <out.bin>"""
import sys
import numpy as np
import shellbin, classify

# stored base colour per class (rendered ~3.4x): A320 flight deck
BASE = {
    'lining':   (40, 42, 44),   # light neutral grey lining, roof, posts
    'frame':    (40, 42, 44),
    'visor':    (22, 25, 25),   # smoked sun visors
    'seat':     (17, 20, 25),   # dark blue-grey seat covers
    'seatdark': (11, 12, 13),   # seat frames, rails, hand controls
    'console':  (19, 20, 22),   # side consoles, footwells: dark grey
    'carpet':   (14, 15, 17),   # dark grey carpet
    'leather':  (11, 12, 13),   # glareshield
    'rear':     (40, 42, 44),   # rear wall lining
    'panel':    (32, 37, 43),   # painted panels: Airbus blue-grey
    'header':   (27, 29, 31),   # windshield header and visor rails: mid grey
    'lower':    (21, 23, 26),   # lower walls and footwells: dark grey
}
MATID = {'seat': 1, 'carpet': 2, 'leather': 3}   # surface grain in the page: 0 plastic, 1 fabric, 2 carpet, 3 leather

if __name__ == '__main__':
    h, G = shellbin.read(sys.argv[1]); g = G[0]
    cls, lab, C, n, A = classify.classify(h, g)
    F = g['I']; N = g['N'].astype(float)
    lum = N[:, :3].sum(1)
    vcls = np.full(len(N), -1); w = np.zeros(len(N))
    # per vertex: the class of its largest face
    for k in range(len(classify.NAMES)):
        f = cls == k
        if not f.any(): continue
        vi = F[f].ravel(); a = np.repeat(A[f], 3)
        better = a > w[vi]
        vcls[vi[better]] = k; w[vi[better]] = a[better]
    # light factor per vertex, smoothed over neighbours of the same class (24 passes): the long triangles of the curved lining
    # took their light from far-apart corners and showed as bright and dark spikes in the rear corners
    import scipy.sparse as sp
    V = shellbin.metres(h, g)
    q = np.round(V * 4000).astype(np.int64)
    _, wid = np.unique(np.c_[q, vcls], axis=0, return_inverse=True); wid = wid.ravel(); nw = wid.max() + 1
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    Adj = sp.coo_matrix((np.ones(len(E) * 2), (np.r_[wid[E[:, 0]], wid[E[:, 1]]], np.r_[wid[E[:, 1]], wid[E[:, 0]]])), shape=(nw, nw)).tocsr()
    Adj.data[:] = 1; Adj = Adj + sp.identity(nw, format='csr'); deg = np.asarray(Adj.sum(1)).ravel()
    lw = np.bincount(wid, weights=lum, minlength=nw) / np.maximum(np.bincount(wid, minlength=nw), 1)
    smooth_cls = np.isin(vcls, [classify.NAMES.index(c) for c in ('rear',)])
    sw = np.zeros(nw, bool); sw[wid[smooth_cls]] = True
    for _ in range(24):
        nl = (Adj @ lw) / deg; lw[sw] = nl[sw]
    lum = np.where(smooth_cls, lw[wid], lum)
    out = N.copy()
    for k, name in enumerate(classify.NAMES):
        v = vcls == k
        if not v.any(): continue
        med = np.median(lum[v])
        light = np.clip(lum[v] / max(med, 1), 0.45, 1.4) ** 1.35   # a little more contrast: the form reads
        out[v, :3] = np.array(BASE[name])[None] * light[:, None]
        out[v, 3] = MATID.get(name, 0)
        print(f'{name:9s} verts {v.sum():6d}  median {med:.0f} -> {sum(BASE[name])}')
    g['N'] = np.clip(np.round(out), 0, 127).astype(np.int64)
    shellbin.write(sys.argv[2], h, G)
