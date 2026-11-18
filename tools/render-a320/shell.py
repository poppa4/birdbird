"""Build the 3D cockpit shell for the A320 3D page (a320-3d.html) from the FlightGear A320-family flight deck model
(github.com/legoboyvdlp/A320-family, GPL-2.0; Models/FlightDeck/res/fd_complete.ac and its textures).
Everything that sits on one of the panel planes is left out (the page draws those panels from the rendered pictures, with
the live lights and screens); what is kept is the structure around them: glareshield, windshield and window frames, side
walls, pedestal and console bodies, sidesticks, tillers, seats, floor and ceiling.
Output (a derived work, GPL-2.0 as well): models/a320-shell.bin and models/a320-shell-<texture>.jpg.
Binary: 4-byte header length + JSON header, then per group: Int16 positions (x,y,z / S), Uint16 uv (normalised to the
group's uv box), Int8 normals (x,y,z,0), Uint16 or Uint32 indices. Frame: three.js (x right, y up, z aft) = (-z, y, x) of the model.
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
        for bi, (c, n, up, x, W, H) in enumerate(B):
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
hdr = {'S': 16000, 'groups': []}; blob = b''
for t, g in G.items():
    if not g['I']: continue
    P = np.array(g['P'], np.int16); UV = np.array(g['UV'], np.float64); N = np.array(g['N'], np.int8); I = np.array(g['I'])
    lo, hi = UV.min(0), UV.max(0); span = np.maximum(hi - lo, 1e-9); Q = np.round((UV - lo) / span * 65535).astype(np.uint16)
    big = len(P) > 65535; I = I.astype(np.uint32 if big else np.uint16)
    N4 = np.zeros((len(N), 4), np.int8); N4[:, :3] = N
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
h = json.dumps(hdr).encode(); h += b' ' * ((-len(h)) % 4)
open(os.path.join(OUT, 'a320-shell.bin'), 'wb').write(struct.pack('<I', len(h)) + h + blob)
print('bytes', 4 + len(h) + len(blob))
