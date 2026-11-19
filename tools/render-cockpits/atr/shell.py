"""Build the 3D cockpit shell for the ATR 72 3D page (atr72-3d.html) from the FlightGear ATR 72-500 model
(github.com/FGMEMBERS/ATR72, GPL-3.0), assembled from Models/FlightDeck/flightdeck.xml with fgmodel.assemble.
Same method as b738/shell.py: what sits on the three rendered panel planes (overhead, main panel with the glareshield,
pedestal) is left out, the structure around them is kept with baked sky light, one draw call, no texture.
Output (a derived work, GPL-3.0 as well): models/atr72-shell.bin (+ models/atr72-shell-flat.jpg).
Run: python3 shell.py /path/to/ATR72 /path/to/birdbird/models"""
import sys, re, json, struct, os, numpy as np
HERE = os.path.dirname(__file__); sys.path.insert(0, os.path.join(HERE, '..')); import fgmodel
from PIL import Image
ROOT, OUT = sys.argv[1], sys.argv[2]
O = fgmodel.assemble(ROOT, 'Models/FlightDeck/flightdeck.xml', skip=lambda p, i, c: bool(re.search(r'pilots', p + i, re.I)))
for o in O: o['key'] = '/'.join(o['inst']) + ':' + o['name']
# the four orthographic views of the sheet (tools/render-cockpits/b738/spec.py), cropped as on the sheet
V = {'ovh': ((-10.675, 1.425, 0), (-0.361, 0.932, 0), (0.932, 0.361, 0), 1.0, 0.96, 0.12), 'front': ((-11.29, 0.66, 0), (-0.985, -0.173, 0), (0, 1, 0), 1.9, 0.74, 0.30),
     'ped': ((-10.72, 0.2, 0), (0, -1, 0), (-1, 0, 0), 0.56, 1.08, 0.40)}
B = []
for k, (c, n, up, W, H, dep) in V.items():
    c, n, up = map(lambda v: np.array(v, float), (c, n, up)); n /= np.linalg.norm(n); up = up - up.dot(n) * n; up /= np.linalg.norm(up); B.append((k, c, n, up, np.cross(up, -n), W, H, dep))
HIDE = re.compile(r'(?i)pilots|yokepitch|glass|window|screen|canopy')
TINT = [(r'(?i).*seat.*', (0.17, 0.17, 0.18)), (r'(?i).*(yoke|column).*', (0.13, 0.13, 0.14))]
TXC = {}
def texim(path):
    if path not in TXC:
        try: TXC[path] = np.asarray(Image.open(path).convert('RGB').resize((128, 128), Image.BILINEAR), np.float64) / 255
        except Exception: TXC[path] = None
    return TXC[path]
import trimesh, mapbox_earcut
def tris(P):
    n = len(P)
    if n == 3: return [(0, 1, 2)]
    N = np.zeros(3)
    for i in range(n): a, b = P[i], P[(i + 1) % n]; N += [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]
    ax = int(np.argmax(np.abs(N))); Q = np.delete(P, ax, axis=1).astype(np.float64)
    try: t = mapbox_earcut.triangulate_float64(Q, np.array([n], np.uint32)).reshape(-1, 3)
    except Exception: t = np.zeros((0, 3), int)
    return [tuple(x) for x in t] if len(t) else [(0, j, j + 1) for j in range(1, n - 1)]
P_, C_, I_ = [], [], []
OV, OF = [], []
UVS, GRP = [], []   # the model's own textures (baked shading, panel lines) are kept: one group per texture
nskip = 0
for o in O:
    key = o['file'] + ':' + o['name']
    if HIDE.search(key) or HIDE.search(o['key']): continue
    mats = o['mats']; v = o['v']; tint = next((c for p, c in TINT if re.fullmatch(p, key)), None)
    if tint is None and o['tex'] and re.search(r'seat_|fabric|carpet', o['tex']): tint = (0.19, 0.21, 0.26)   # seat cushions: the texture is a pale photo
    tx = texim(o['tex']) if o['tex'] else None; rep, off = o['rep'], o['off']
    for mat, idx, uvs, flags in o['faces']:
        md = mats[mat] if mat < len(mats) else {}
        if md.get('trans', 0) > 0.5: continue                    # glass and transparent parts
        P = v[idx]; ctr = P.mean(0); inside = False
        for k, c, n, up, x, W, H, dep in B:
            d = ctr - c; dn = d @ (-n)
            if abs(d @ x) < W / 2 + 0.01 and abs(d @ up) < H / 2 + 0.01 and -0.03 < dn < dep: inside = True; break
        if inside: nskip += 1; continue
        nrm = np.cross(P[1] - P[0], P[2] - P[0]); ln = np.linalg.norm(nrm)
        if ln < 1e-12: continue
        area = sum(np.linalg.norm(np.cross(P[j] - P[0], P[j + 1] - P[0])) for j in range(1, len(P) - 1)) / 2
        if area < 4e-5 and np.linalg.norm(P.max(0) - P.min(0)) < 0.025: continue
        base = np.array(md.get('rgb', (0.8, 0.8, 0.8)))
        if tint is not None: base = np.array(tint)
        b0 = len(OV)
        textured = tx is not None and tint is None
        for j in range(len(idx)):
            col = base.copy()
            T = np.array([-P[j][2], P[j][1], P[j][0]]); OV.append(T); C_.append(col)
            UVS.append((uvs[j][0] * rep[0] + off[0], 1 - (uvs[j][1] * rep[1] + off[1])) if textured else (0.0, 0.0)); GRP.append(o['tex'] if textured else 'flat')
        for t in tris(P): OF.append([b0 + t[0], b0 + t[1], b0 + t[2]])
print('faces kept', len(OF), 'on panels', nskip)
OVa = np.array(OV); OFa = np.array(OF)
# occluder for the bake: everything kept plus the panel planes (they block light too)
occV = [OVa]; occF = [OFa]; nb = len(OVa)
for k, c, n, up, x, W, H, dep in B:
    cs = [c + sx * W / 2 * x + sy * H / 2 * up for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    cs = [np.array([-p[2], p[1], p[0]]) for p in cs]; occV.append(np.array(cs)); occF.append(np.array([[nb, nb + 1, nb + 2], [nb, nb + 2, nb + 3]])); nb += 4
OCC = trimesh.Trimesh(vertices=np.concatenate(occV), faces=np.concatenate(occF), process=False)
RAY = trimesh.ray.ray_pyembree.RayMeshIntersector(OCC)
rng = np.random.default_rng(7); NS = 64
def bake(P, N):
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
        sky = 1 - hit.reshape(k, NS).mean(1); up = np.clip(n[:, 1], -1, 1); out[s0:s0 + 4000] = sky * (0.9 + 0.1 * up)
    return out
def shade(v): return np.clip(0.52 + 0.95 * v ** 0.55, 0, 1.12)
# face normals per vertex (flat shading: vertices are not shared between faces)
FN = np.zeros_like(OVa)
for f in OFa:
    nn = np.cross(OVa[f[1]] - OVa[f[0]], OVa[f[2]] - OVa[f[0]]); ln = np.linalg.norm(nn); FN[f] = nn / ln if ln > 1e-12 else np.array([0, 1.0, 0])
# faces are seen from both sides in the model: light the side that faces the eye
EYE = np.array([-0.42, 1.12, -10.25])
flip = np.einsum('ij,ij->i', FN, EYE - OVa) < 0; FN[flip] *= -1
# smooth shading: each vertex takes the mean normal of the faces that meet at its position within 50°, so curved parts
# (glareshield, consoles, posts) read as surfaces instead of facets; hard edges stay hard
key = np.round(OVa / 2e-4).astype(np.int64); _, grp = np.unique(key, axis=0, return_inverse=True); grp = grp.reshape(-1)
order = np.argsort(grp); SN = FN.copy(); gs = np.split(order, np.flatnonzero(np.diff(grp[order])) + 1)
for g in gs:
    if len(g) < 2: continue
    n = FN[g]; m = (n @ n.T) > np.cos(np.radians(50)); s_ = m.astype(float) @ n; SN[g] = s_ / np.maximum(1e-9, np.linalg.norm(s_, axis=1, keepdims=True))
# light: baked sky (ambient occlusion) plus a soft key from above, behind and to the left of the captain, for form
KEYD = np.array([-0.45, 0.8, 0.4]); KEYD /= np.linalg.norm(KEYD)
L = shade(bake(OVa, SN)) * (0.8 + 0.32 * np.clip(SN @ KEYD, 0, 1)); col = np.array(C_) * L[:, None] * np.array([0.98, 1.0, 1.04])
# wind every triangle towards the eye (the page then draws front faces only), and order them near to far: less overdraw
for f in OFa:
    nn = np.cross(OVa[f[1]] - OVa[f[0]], OVa[f[2]] - OVa[f[0]])
    if nn @ (EYE - OVa[f[0]]) < 0: f[1], f[2] = f[2], f[1]
OFa = OFa[np.argsort(np.linalg.norm(OVa[OFa].mean(1) - EYE, axis=1))]
ORG = (OVa.min(0) + OVa.max(0)) / 2; S = 9000
print('origin', ORG, 'half size', (OVa.max(0) - OVa.min(0)) / 2)
def pad(b): return b + b'\0' * ((-len(b)) % 4)
GRPa = np.array(GRP, dtype=object); UVa = np.array(UVS, np.float64); hdr = {'o': [round(float(v), 4) for v in ORG], 'S': S, 'lmax': 1.12, 'groups': []}; blob = b''
fg = GRPa[OFa[:, 0]]
for t in sorted(set(fg.tolist()), key=lambda x: (x != 'flat', x)):
    F = OFa[fg == t]; vs, inv = np.unique(F.reshape(-1), return_inverse=True); I = inv.astype(np.int64)
    Pq = np.clip(np.round((OVa[vs] - ORG) * S), -32767, 32767).astype(np.int16); UV = UVa[vs]
    lo, hi = UV.min(0), UV.max(0); span = np.maximum(hi - lo, 1e-9); Q = np.round((UV - lo) / span * 65535).astype(np.uint16)
    N4 = np.zeros((len(Pq), 4), np.uint8); N4[:, :3] = np.clip(col[vs] / 1.12 * 255, 0, 255).round()
    big = len(Pq) > 65535; I = I.astype(np.uint32 if big else np.uint16)
    name = 'flat' if t == 'flat' else re.sub(r'[^a-z0-9]+', '-', os.path.splitext(os.path.basename(t))[0].lower())
    parts = [Pq.tobytes(), Q.tobytes(), N4.tobytes(), I.tobytes()]; offb = len(blob); blob += b''.join(pad(p) for p in parts)
    hdr['groups'].append({'tex': name, 'nv': int(len(Pq)), 'ni': int(len(I)), 'i32': bool(big), 'uv': [float(lo[0]), float(lo[1]), float(span[0]), float(span[1])], 'off': offb, 'sizes': [len(pad(p)) for p in parts]})
    if t != 'flat':
        im = Image.open(t).convert('RGB')
        if im.width > 1024: im = im.resize((1024, round(1024 * im.height / im.width)), Image.LANCZOS)
        im.save(os.path.join(OUT, f'atr72-shell-{name}.jpg'), quality=84, optimize=True)
    print(name, 'verts', len(Pq), 'tris', len(I) // 3)
hdr['panels'] = {}
for k, c, n, up, x, W, H, dep in B:
    nx, ny = (24, 10) if k == 'front' else (16, 16) if k == 'ovh' else (12, 18)
    pts, nrm = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            q = c + (i / nx - 0.5) * W * x + (0.5 - j / ny) * H * up + (-n) * 0.004
            pts.append([-q[2], q[1], q[0]]); nn = -n; nrm.append([-nn[2], nn[1], nn[0]])
    Lp = shade(bake(np.array(pts), np.array(nrm)))
    hdr['panels'][k] = {'nx': nx, 'ny': ny, 'v': [round(float(min(1.0, v * 1.02)), 3) for v in Lp]}
h = json.dumps(hdr).encode(); h += b' ' * ((-len(h)) % 4)
open(os.path.join(OUT, 'atr72-shell.bin'), 'wb').write(struct.pack('<I', len(h)) + h + blob)
print('bytes', 4 + len(h) + len(blob))
