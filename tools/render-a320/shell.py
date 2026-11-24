"""Build the 3D cockpit shell for the A320 3D page (a320-3d.html) from the FlightGear A320-family flight deck model
(github.com/legoboyvdlp/A320-family, GPL-2.0; Models/FlightDeck/res/fd_complete.ac and its textures).
Everything that sits on one of the panel planes is left out (the page draws those panels from the rendered pictures, with
the live lights and screens); what is kept is the structure around them: glareshield, windshield and window frames, side
walls, pedestal and console bodies, sidesticks, tillers, seats, floor and ceiling.
Output (a derived work, GPL-2.0 as well): models/a320-shell.bin and models/a320-shell-<texture>.jpg.
Binary: 4-byte header length + JSON header, then per group: Int16 positions (x,y,z / S), Uint16 uv (normalised to the
group's uv box), Uint8 baked light (r,g,b,0), Uint16 or Uint32 indices. Lighting is baked (embree, 96 rays a vertex): the share of
sky each vertex sees through the windows, a contact shade from what lies within 25 cm (corners, gaps, under lips) and the
sun through the windows with its shadows; faces are cut where the light changes across them (down to 8 cm) and normals are smoothed within 38°, and the
bake is smoothed over the mesh, so the light runs across the surfaces instead of changing face by face. The header also carries the same bake on a grid over each rendered panel (hdr.panels). Frame: three.js (x right, y up, z aft) = (-z, y, x) of the model.
Run: python3 shell.py /path/to/A320-family/Models/FlightDeck/res /path/to/birdbird/models"""
import sys, re, json, struct, os, numpy as np, collections
sys.path.insert(0, os.path.dirname(__file__)); import ac3d
from PIL import Image
RES, OUT = sys.argv[1], sys.argv[2]
MINA = float(sys.argv[3]) if len(sys.argv) > 3 else 6e-5  # m²
m, O = ac3d.load(os.path.join(RES, 'fd_complete.ac'))
V = {'ovh': ((0.385, 1.10, 0), (-0.362, 0.932, 0), (0.932, 0.362, 0), 0.66, 1.30), 'front': ((-0.478, 0.229, 0), (-0.955, -0.297, 0), (0, 1, 0), 1.64, 0.54),
     'ped': ((-0.02289, -0.07831, 0), (-0.13, -0.99, 0), (-1, 0, 0), 0.58, 0.886), 'sideL': ((-0.22, 0.08, 0.95), (0, -0.62, 0.78), (-1, 0, 0), 0.44, 0.40), 'sideR': ((-0.22, 0.08, -0.95), (0, -0.62, -0.78), (-1, 0, 0), 0.44, 0.40)}
B = []
for k, (c, n, up, W, H) in V.items():
    c, n, up = map(lambda v: np.array(v, float), (c, n, up)); n /= np.linalg.norm(n); up = up - up.dot(n) * n; up /= np.linalg.norm(up); B.append((c, n, up, np.cross(up, -n), W, H))
TEX = {'fd_main.png': 2048, 'fd_other.png': 2048, 'fd_leather.png': 1024, 'fabric2.png': 64, 'carpet2.png': 512}  # fd_glare = window glass: left out
SKIP = re.compile(r'(?i)hud|efb|headset|screw|plug|extinguisher|checklist|torch|cable|_lt\b|knb|btn|breaker')
import trimesh
OV, OF = [], []
for o in O:
    if o['tex'] == 'fd_glare.png' or re.search(r'(?i)glass|^sfl', o['name']): continue
    b = sum(len(x) for x in OV)
    for mat, idx, uvs, flags in o['faces']:
        for j in range(1, len(idx) - 1): OF.append([b + idx[0], b + idx[j], b + idx[j + 1]])
    OV.append(o['v'])
OVa = np.concatenate(OV); OCC = trimesh.Trimesh(vertices=np.stack([-OVa[:, 2], OVa[:, 1], OVa[:, 0]], 1), faces=np.array(OF), process=False)
RAY = trimesh.ray.ray_pyembree.RayMeshIntersector(OCC)
rng = np.random.default_rng(7); NS = 96
SUN = np.array([-0.50, 0.62, -0.60]); SUN /= np.linalg.norm(SUN)  # sun ahead and to the left, 38° up (three frame)
def bake(P, N, sun=1.0):
    # ambient: cosine-weighted hemisphere around N, the share of rays that leave the deck (reach the windows) within 3 m;
    # contact shade: the share of rays that hit something within 25 cm (corners, gaps, under lips); sun: a shadow ray
    amb = np.zeros(len(P)); con = np.zeros(len(P)); dr = np.zeros(len(P))
    for s0 in range(0, len(P), 3000):
        p = P[s0:s0 + 3000]; n = N[s0:s0 + 3000]; k = len(p)
        u1 = rng.random((k, NS)); u2 = rng.random((k, NS)); r = np.sqrt(u1); th = 2 * np.pi * u2
        a = np.where(np.abs(n[:, :1]) < 0.9, np.array([[1, 0, 0]]), np.array([[0, 1, 0]]))
        t1 = np.cross(n, a); t1 /= np.linalg.norm(t1, axis=1, keepdims=True); t2 = np.cross(n, t1)
        d = (t1[:, None] * (r * np.cos(th))[..., None] + t2[:, None] * (r * np.sin(th))[..., None] + n[:, None] * np.sqrt(1 - u1)[..., None]).reshape(-1, 3)
        o = np.repeat(p + n * 0.003, NS, axis=0)
        dist = np.full(len(o), np.inf); loc, ri, ti = RAY.intersects_location(o, d, multiple_hits=False)
        if len(ri): dist[ri] = np.linalg.norm(loc - o[ri], axis=1)
        dist = dist.reshape(k, NS)
        sky = (dist >= 3.0).mean(1); near = (dist < 0.25).mean(1)
        up = np.clip(n[:, 1], -1, 1); amb[s0:s0 + k] = sky * (0.9 + 0.1 * up); con[s0:s0 + k] = near
        if sun:
            ns = n @ SUN; lit = ns > 0.02; sd = np.zeros(k)
            if lit.any():
                oo = p[lit] + n[lit] * 0.004; hit = RAY.intersects_any(oo, np.repeat(SUN[None], len(oo), 0)); sd[lit] = np.where(hit, 0, ns[lit])
            dr[s0:s0 + k] = sd
    return amb, con, dr
LMAX = 2.4
def shade(b, sun=1.0):
    amb, con, dr = b
    # the FlightGear textures are dark (made for a strong scene light): lifted here so the lining reads as the light
    # blue-grey of the real flight deck, with the windows' light, the contact shade and the sun on top
    A = (0.97 + 0.80 * amb ** 0.5) * (1 - 0.25 * con)
    S = 0.35 * dr * sun
    col = np.stack([A * 1.03 + S * 1.10, A * 1.00 + S * 1.00, A * 0.95 + S * 0.86], 1)
    return np.clip(col, 0, 1.6)  # no more than 1.6x the texture: light texels would burn out to white
TXP = {t: Image.open(os.path.join(RES, t)).convert('RGB').resize((512, 512)) for t in TEX}
G = collections.defaultdict(lambda: {'F': []})
EMAX = 0.30  # m: faces are first cut to 30 cm; refine() then cuts further only where the baked light changes across them
def split(tri, n, d=0):
    e = [np.linalg.norm(tri[(i + 1) % 3][0] - tri[i][0]) for i in range(3)]; i = int(np.argmax(e))
    if e[i] <= EMAX or d > 9: return [(tri, n)]
    a, b, c = tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3]
    m = ((a[0] + b[0]) / 2, ((a[1][0] + b[1][0]) / 2, (a[1][1] + b[1][1]) / 2))
    return split([a, m, c], n, d + 1) + split([m, b, c], n, d + 1)
def refine(F, emin=0.08, tol=0.10, levels=5):
    # cut a face at the middle of its longest edge while the light there differs from the mean of the edge's ends by more
    # than tol, or its corners differ by more than 3*tol (light value: the green channel of shade()); keeps the triangle count
    # low where the light is even (most of the lining) and fine where it changes (corners, sun patches, shadow edges)
    cache = {}
    def L(pts):
        ks = [(tuple((p * 4000).round().astype(int)), tuple((n * 50).round().astype(int))) for p, n in pts]
        new = [i for i, k in enumerate(ks) if k not in cache]
        if new:
            P_ = np.array([pts[i][0] for i in new]); N_ = np.array([pts[i][1] for i in new])
            v = shade(bake(P_, N_))[:, 1]
            for i, x in zip(new, v): cache[ks[i]] = x
        return np.array([cache[k] for k in ks])
    for lev in range(levels):
        cand = []
        for fi, (tri, n) in enumerate(F):
            e = [np.linalg.norm(tri[(i + 1) % 3][0] - tri[i][0]) for i in range(3)]; i = int(np.argmax(e))
            if e[i] > emin: cand.append((fi, i))
        if not cand: break
        pts = []
        for fi, i in cand:
            tri, n = F[fi]; a, b = tri[i][0], tri[(i + 1) % 3][0]
            pts += [(tri[0][0], n), (tri[1][0], n), (tri[2][0], n), ((a + b) / 2, n)]
        v = L(pts).reshape(-1, 4); out = []; cs = dict(cand); ci = {fi: j for j, (fi, _) in enumerate(cand)}
        for fi, (tri, n) in enumerate(F):
            if fi not in cs: out.append((tri, n)); continue
            i = cs[fi]; w = v[ci[fi]]; a, b, c = tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3]
            if abs(w[3] - (w[i] + w[(i + 1) % 3]) / 2) > tol or w[:3].max() - w[:3].min() > 3 * tol:
                m = ((a[0] + b[0]) / 2, ((a[1][0] + b[1][0]) / 2, (a[1][1] + b[1][1]) / 2))
                out += [([a, m, c], n), ([m, b, c], n)]
            else: out.append((tri, n))
        print('  refine', lev, len(F), '->', len(out)); F = out
    return F
for o in O:
    if o['tex'] not in TEX: continue
    v = o['v']; diag = np.linalg.norm(v.max(0) - v.min(0))
    if diag < 0.10 and len(o['faces']) < 400: continue
    if SKIP.search(o['name']) and diag < 0.6: continue
    if re.search(r'(?i)^(hud|efb|headset|sfl)|glass', o['name']): continue  # HUD, EFBs, headsets, sun blinds, glass
    rep, off = o['rep'], o['off']; g = G[o['tex']]
    for mat, idx, uvs, flags in o['faces']:
        P = v[idx]; ctr = P.mean(0); inside = False
        # faces whose texture is the bright green of the lamp / marking areas show as stray lime lines on the consoles: skip
        tu = np.mean([uvs[j][0] * rep[0] + off[0] for j in range(len(idx))]) % 1; tv = 1 - (np.mean([uvs[j][1] * rep[1] + off[1] for j in range(len(idx))]) % 1)
        px = TXP[o['tex']].getpixel((min(TXP[o['tex']].width - 1, int(tu * TXP[o['tex']].width)), min(TXP[o['tex']].height - 1, int(tv * TXP[o['tex']].height))))
        if px[1] > 150 and px[1] > px[0] + 60 and px[1] > px[2] + 40: continue
        for bi, (c, n, up, x, W, H) in enumerate(B[:3]):  # side consoles: the model's own geometry is kept
            d = ctr - c; dn = d @ (-n)
            if abs(d @ x) < W / 2 + 0.01 and abs(d @ up) < H / 2 + 0.01 and -0.03 < dn < (0.32 if bi == 1 else 0.12): inside = True; break  # the glareshield stands well proud of the main panel
        if inside: continue
        nrm = np.cross(P[1] - P[0], P[2] - P[0]); ln = np.linalg.norm(nrm)
        if ln < 1e-12: continue
        area = sum(np.linalg.norm(np.cross(P[j] - P[0], P[j + 1] - P[0])) for j in range(1, len(P) - 1)) / 2
        if area < MINA and np.linalg.norm(P.max(0) - P.min(0)) < 0.03: continue  # tiny detail (bolts, edges of small parts): invisible at cockpit distance
        nrm /= ln; T = np.stack([-P[:, 2], P[:, 1], P[:, 0]], 1); nT = np.array([-nrm[2], nrm[1], nrm[0]])
        UVs = [(uvs[j][0] * rep[0] + off[0], 1 - (uvs[j][1] * rep[1] + off[1])) for j in range(len(idx))]
        for j in range(1, len(idx) - 1):
            g['F'] += split([(T[0], UVs[0]), (T[j], UVs[j]), (T[j + 1], UVs[j + 1])], nT)
hdr = {'S': 16000, 'groups': [], 'lmax': LMAX}; blob = b''
COS = np.cos(np.radians(38))
for t, g in G.items():
    if not g['F']: continue
    g['F'] = refine(g['F'])
    # smooth normals: at each position, the area-weighted mean of the face normals within 38° of this face's normal
    at = collections.defaultdict(list)
    for tri, n in g['F']:
        ar = np.linalg.norm(np.cross(tri[1][0] - tri[0][0], tri[2][0] - tri[0][0])) / 2 + 1e-9
        for p, uv in tri: at[tuple((p * 16000).round().astype(int))].append((n, ar))
    key, Pl, UVl, Nl, I = {}, [], [], [], []
    for tri, n in g['F']:
        for p, uv in tri:
            pk = tuple((p * 16000).round().astype(int)); sn = sum(a * m for m, a in at[pk] if m @ n > COS); sn = sn / max(1e-9, np.linalg.norm(sn))
            nq = tuple((sn * 127).round().astype(int)); k = (pk, (round(uv[0], 5), round(uv[1], 5)), nq)
            if k not in key: key[k] = len(Pl); Pl.append(pk); UVl.append(uv); Nl.append(nq)
            I.append(key[k])
    P = np.array(Pl, np.int16); UV = np.array(UVl, np.float64); N = np.array(Nl, np.int8); I = np.array(I)
    Pf = P.astype(np.float64) / 16000; Nf = N.astype(np.float64); Nf /= np.maximum(1e-6, np.linalg.norm(Nf, axis=1, keepdims=True))
    b = list(bake(Pf, Nf))
    # smooth the bake over the mesh (neighbours through the triangles): less ray noise, no blotches across cut-up faces
    tri = I.reshape(-1, 3); nb = len(P)
    for it in range(3):
        for q in range(3):
            acc = np.zeros(nb); cnt = np.zeros(nb)
            for a_, c_ in ((0, 1), (1, 2), (2, 0), (1, 0), (2, 1), (0, 2)):
                np.add.at(acc, tri[:, a_], b[q][tri[:, c_]]); np.add.at(cnt, tri[:, a_], 1)
            b[q] = np.where(cnt > 0, 0.5 * b[q] + 0.5 * acc / np.maximum(cnt, 1), b[q])
    col = shade(b)
    N4 = np.zeros((len(P), 4), np.uint8); N4[:, :3] = np.clip(col / LMAX * 255, 0, 255).round()
    lo, hi = UV.min(0), UV.max(0); span = np.maximum(hi - lo, 1e-9); Q = np.round((UV - lo) / span * 65535).astype(np.uint16)
    big = len(P) > 65535; I = I.astype(np.uint32 if big else np.uint16)
    name = os.path.splitext(t)[0]
    parts = [P.tobytes(), Q.tobytes(), N4.tobytes(), I.tobytes()]
    def pad(b): return b + b'\0' * ((-len(b)) % 4)
    off = len(blob); blob += b''.join(pad(p) for p in parts)
    hdr['groups'].append({'tex': name, 'nv': int(len(P)), 'ni': int(len(I)), 'i32': bool(big), 'uv': [float(lo[0]), float(lo[1]), float(span[0]), float(span[1])], 'off': off,
                          'sizes': [len(pad(p)) for p in parts]})
    im = Image.open(os.path.join(RES, t)).convert('RGB'); s = TEX[t]
    if im.width > s: im = im.resize((s, s), Image.LANCZOS)
    if t == 'fd_other.png':  # an airline emblem on the captain's window post in the source texture: painted out with the post's colour
        from PIL import ImageDraw; k = im.width / 2048; ImageDraw.Draw(im).ellipse(tuple(v * k for v in (1368, 19, 1402, 53)), fill=(73, 86, 105))
    im.save(os.path.join(OUT, f'a320-shell-{name}.jpg'), quality=82, optimize=True)
    print(t, 'verts', len(P), 'tris', len(I) // 3)
# the same bake on a grid over each rendered panel (the page multiplies the panel picture by it)
hdr['panels'] = {}
for (k, (c, n, up, W, H)), (c_, n_, up_, x_, W_, H_) in zip(V.items(), B):
    nx, ny = (24, 10) if k == 'front' else (12, 24) if k == 'ovh' else (12, 18) if k == 'ped' else (6, 6)
    pts, nrm = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            q = c_ + (i / nx - 0.5) * W * x_ + (0.5 - j / ny) * H * up_ + (-n_) * 0.004
            pts.append([-q[2], q[1], q[0]]); nn = -n_; nrm.append([-nn[2], nn[1], nn[0]])
    Lp = np.clip(0.52 + 0.95 * bake(np.array(pts), np.array(nrm), 0)[0] ** 0.55, 0, 1.12)
    hdr['panels'][k] = {'nx': nx, 'ny': ny, 'v': [round(float(min(1.0, x * 1.02)), 3) for x in Lp]}
h = json.dumps(hdr).encode(); h += b' ' * ((-len(h)) % 4)
open(os.path.join(OUT, 'a320-shell.bin'), 'wb').write(struct.pack('<I', len(h)) + h + blob)
print('bytes', 4 + len(h) + len(blob))
