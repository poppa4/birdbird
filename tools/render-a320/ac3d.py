"""Minimal AC3D (.ac) reader: returns materials and a flat list of mesh objects in world coordinates."""
import numpy as np
def load(path):
    L = open(path, encoding='latin-1').read().split('\n'); i = 0; mats = []; objs = []
    def tok(s):
        out = []; cur = ''; q = False
        for ch in s:
            if ch == '"': q = not q
            elif ch.isspace() and not q:
                if cur: out.append(cur); cur = ''
            else: cur += ch
        if cur: out.append(cur)
        return out
    while i < len(L) and not L[i].startswith('OBJECT'):
        if L[i].startswith('MATERIAL'):
            t = tok(L[i]); d = {'name': t[1]}; j = 2
            while j < len(t):
                k = t[j]
                if k in ('rgb', 'amb', 'emis', 'spec'): d[k] = tuple(map(float, t[j + 1:j + 4])); j += 4
                elif k in ('shi', 'trans'): d[k] = float(t[j + 1]); j += 2
                else: j += 1
            mats.append(d)
        i += 1
    def obj(R, T, path):
        nonlocal i
        kind = L[i].split()[1]; i += 1
        o = {'kind': kind, 'name': '', 'tex': None, 'rep': (1, 1), 'off': (0, 0), 'crease': 30.0, 'v': None, 'faces': []}
        r = np.eye(3); t = np.zeros(3); kids = 0
        while i < len(L):
            s = L[i]; p = s.split()
            if not p: i += 1; continue
            k = p[0]
            if k == 'name': o['name'] = tok(s)[1]; i += 1
            elif k == 'data': n = int(p[1]); i += 1; got = 0
            elif k == 'texture': o['tex'] = tok(s)[1]; i += 1
            elif k == 'texrep': o['rep'] = (float(p[1]), float(p[2])); i += 1
            elif k == 'texoff': o['off'] = (float(p[1]), float(p[2])); i += 1
            elif k == 'rot': r = np.array(list(map(float, p[1:10]))).reshape(3, 3); i += 1
            elif k == 'loc': t = np.array(list(map(float, p[1:4]))); i += 1
            elif k == 'crease': o['crease'] = float(p[1]); i += 1
            elif k == 'numvert':
                n = int(p[1]); o['v'] = np.array([list(map(float, L[i + 1 + j].split()[:3])) for j in range(n)]).reshape(n, 3); i += 1 + n
            elif k == 'numsurf':
                n = int(p[1]); i += 1
                for _ in range(n):
                    flags = int(L[i].split()[1], 16); i += 1; mat = 0
                    if L[i].startswith('mat'): mat = int(L[i].split()[1]); i += 1
                    nr = int(L[i].split()[1]); i += 1
                    refs = [L[i + j].split() for j in range(nr)]; i += nr
                    if flags & 0xF == 0 and nr >= 3: o['faces'].append((mat, [int(a[0]) for a in refs], [(float(a[1]), float(a[2])) for a in refs], flags))
            elif k == 'kids': kids = int(p[1]); i += 1; break
            else: i += 1
        # AC3D: child = parent * local; vertex world = R_parent * (r * v + t) + T_parent  (rot is rarely used)
        Rw = R @ r.T; Tw = R @ t + T
        o['path'] = path + [o['name']]
        if o['v'] is not None and len(o['faces']): o['v'] = o['v'] @ Rw.T + Tw; objs.append(o)
        for _ in range(kids): obj(Rw, Tw, o['path'])
    obj(np.eye(3), np.zeros(3), [])
    return mats, objs
if __name__ == '__main__':
    import sys
    m, o = load(sys.argv[1]); print(len(m), 'materials', len(o), 'meshes')
    V = np.concatenate([x['v'] for x in o]); print('bbox', V.min(0).round(3), V.max(0).round(3))
    print('faces', sum(len(x['faces']) for x in o))


def tris(P):
    """Triangles of a polygon as triples of corner numbers. A fan from the first corner is only right for convex polygons; the
    model has several hundred concave ones (L and wedge shaped plates), and a fan there makes triangles that stick out of the
    polygon as fins and cover what lies beside it. Ear clipping in the polygon's own plane (Newell normal) is right for both."""
    P = np.asarray(P, float); n = len(P)
    if n < 3: return []
    if n == 3: return [(0, 1, 2)]
    nrm = np.zeros(3)
    for j in range(n): nrm += np.cross(P[j], P[(j + 1) % n])
    ln = np.linalg.norm(nrm)
    if ln < 1e-14: return [(0, j, j + 1) for j in range(1, n - 1)]
    nrm /= ln; a = np.array([1.0, 0, 0]) if abs(nrm[0]) < 0.9 else np.array([0, 1.0, 0]); ex = np.cross(nrm, a); ex /= np.linalg.norm(ex); ey = np.cross(nrm, ex)
    Q = np.stack([P @ ex, P @ ey], 1); cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    if all(cr(Q[0], Q[j], Q[j + 1]) >= -1e-12 for j in range(1, n - 1)): return [(0, j, j + 1) for j in range(1, n - 1)]
    idx = list(range(n)); out = []; guard = 0
    while len(idx) > 3 and guard < 4 * n * n:
        guard += 1; done = False
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            if cr(Q[i0], Q[i1], Q[i2]) <= 1e-14: continue                      # reflex or flat corner: not an ear
            if any(j not in (i0, i1, i2) and cr(Q[i0], Q[i1], Q[j]) > 1e-12 and cr(Q[i1], Q[i2], Q[j]) > 1e-12 and cr(Q[i2], Q[i0], Q[j]) > 1e-12 for j in idx): continue
            out.append((i0, i1, i2)); idx.pop(k); done = True; break
        if not done: idx.pop(int(np.argmin([abs(cr(Q[idx[k - 1]], Q[idx[k]], Q[idx[(k + 1) % len(idx)]])) for k in range(len(idx))])))   # degenerate: drop the flattest corner
    if len(idx) == 3: out.append(tuple(idx))
    return out
