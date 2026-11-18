"""Build the 3D cockpit shell for the A320 3D page (a320-3d.html) from the FlightGear A320-family flight deck model
(github.com/legoboyvdlp/A320-family, GPL-2.0; Models/FlightDeck/res/fd_complete.ac and its textures).
Everything that sits on one of the panel planes is left out (the page draws those panels from the rendered pictures, with
the live lights and screens); what is kept is the structure around them: glareshield, windshield and window frames, side
walls, pedestal and console bodies, sidesticks, tillers, seats, floor and ceiling.
Output (a derived work, GPL-2.0 as well): models/a320-shell.bin and models/a320-shell-<texture>.jpg.
Binary: 4-byte header length + JSON header, then per group: Int16 positions (x,y,z / S), Uint16 uv (normalised to the
group's uv box), Uint8 baked light (r,g,b,0), Uint16 or Uint32 indices. Lighting is baked: each vertex gets the share of
sky it sees through the windows (32 rays against the whole deck, embree), so corners, the footwell and the underside of the
glareshield are darker. The header also carries the same bake on a grid over each rendered panel (hdr.panels). Frame: three.js (x right, y up, z aft) = (-z, y, x) of the model.
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
rng = np.random.default_rng(7); NS = 32
def bake(P, N):
    # cosine-weighted hemisphere around N; light = share of rays that leave the deck (reach the windows) within 3 m
    out = np.zeros(len(P))
    for s0 in range(0, len(P), 4000):
        p = P[s0:s0 + 4000]; n = N[s0:s0 + 4000]; k = len(p)
        u1 = rng.random((k, NS)); u2 = rng.random((k, NS)); r = np.sqrt(u1); th = 2 * np.pi * u2
        a = np.where(np.abs(n[:, :1]) < 0.9, np.array([[1, 0, 0]]), np.array([[0, 1, 0]]))
        t1 = np.cross(n, a); t1 /= np.linalg.norm(t1, axis=1, keepdims=True); t2 = np.cross(n, t1)
        d = (t1[:, None] * (r * np.cos(th))[..., None] + t2[:, None] * (r * np.sin(th))[..., None] + n[:, None] * np.sqrt(1 - u1)[..., None]).reshape(-1, 3)
        o = np.repeat(p + n * 0.003, NS, axis=0)
        hit = np.zeros(len(o), bool); loc, ri, ti = RAY.intersects_location(o, d, multiple_hits=False)
        if len(ri): dist = np.linalg.norm(loc - o[ri], axis=1); hit[ri[dist < 3.0]] = True
        sky = 1 - hit.reshape(k, NS).mean(1)
        # light from above counts a little more (the windshield and the overhead light), the floor a little less
        up = np.clip(n[:, 1], -1, 1); out[s0:s0 + 4000] = sky * (0.9 + 0.1 * up)
    return out
def shade(v): return np.clip(0.52 + 0.95 * v ** 0.55, 0, 1.12)
TXP = {t: Image.open(os.path.join(RES, t)).convert('RGB').resize((512, 512)) for t in TEX}
G = collections.defaultdict(lambda: {'key': {}, 'P': [], 'UV': [], 'N': [], 'I': []})
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
        nq = tuple((nT * 127).round().astype(int))
        ids = []
        for j in range(len(idx)):
            uv = (uvs[j][0] * rep[0] + off[0], 1 - (uvs[j][1] * rep[1] + off[1]))
            key = (tuple((T[j] * 16000).round().astype(int)), (round(uv[0], 5), round(uv[1], 5)), nq)
            if key not in g['key']: g['key'][key] = len(g['P']); g['P'].append(key[0]); g['UV'].append(uv); g['N'].append(nq)
            ids.append(g['key'][key])
        for j in range(1, len(ids) - 1): g['I'] += [ids[0], ids[j], ids[j + 1]]
hdr = {'S': 16000, 'groups': [], 'lmax': 1.12}; blob = b''
for t, g in G.items():
    if not g['I']: continue
    P = np.array(g['P'], np.int16); UV = np.array(g['UV'], np.float64); N = np.array(g['N'], np.int8); I = np.array(g['I'])
    Pf = P.astype(np.float64) / 16000; Nf = N.astype(np.float64); Nf /= np.maximum(1e-6, np.linalg.norm(Nf, axis=1, keepdims=True))
    L = shade(bake(Pf, Nf)); col = np.stack([L * 0.98, L * 1.0, L * 1.04], 1)  # a slightly cool sky
    N4 = np.zeros((len(P), 4), np.uint8); N4[:, :3] = np.clip(col / 1.12 * 255, 0, 255).round()
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
    Lp = shade(bake(np.array(pts), np.array(nrm)))
    hdr['panels'][k] = {'nx': nx, 'ny': ny, 'v': [round(float(min(1.0, x * 1.02)), 3) for x in Lp]}
h = json.dumps(hdr).encode(); h += b' ' * ((-len(h)) % 4)
open(os.path.join(OUT, 'a320-shell.bin'), 'wb').write(struct.pack('<I', len(h)) + h + blob)
print('bytes', 4 + len(h) + len(blob))
