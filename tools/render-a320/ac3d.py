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
