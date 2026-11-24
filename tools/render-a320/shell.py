"""Build the 3D cockpit shell for the A320 3D page (a320-3d.html) from the FlightGear A320-family flight deck model
(github.com/legoboyvdlp/A320-family, GPL-2.0; Models/FlightDeck/res/fd_complete.ac and its textures).
Every face that panels.py put a panel picture on is left out (taken.json; the page draws those from the rendered pictures, with
the live lights and screens), and so are the small parts on the panels; what is kept is the structure around them: glareshield, windshield and window frames, side
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
SKIP = re.compile(r'(?i)hud|efb|headset|screw|plug|extinguisher|checklist|torch|cable|knb|btn|breaker')
WHOLE = re.compile(r'(?i)^(sidestick|tiller)')  # hand controls: finely modelled (the grip is all small faces), kept whole or the grip has holes
import trimesh
OV, OF, OFO = [], [], []
for _oi, o in enumerate(O):
    if o['tex'] == 'fd_glare.png' or re.search(r'(?i)glass|^sfl', o['name']): continue
    b = sum(len(x) for x in OV)
    for mat, idx, uvs, flags in o['faces']:
        for i_, j_, k_ in ac3d.tris(np.asarray(o['v'], float).reshape(-1, 3)[idx]): OF.append([b + idx[i_], b + idx[j_], b + idx[k_]]); OFO.append(_oi)
    OV.append(o['v'])
OVa = np.concatenate(OV); OCC = trimesh.Trimesh(vertices=np.stack([-OVa[:, 2], OVa[:, 1], OVa[:, 0]], 1), faces=np.array(OF), process=False)
RAY = trimesh.ray.ray_pyembree.RayMeshIntersector(OCC)
rng = np.random.default_rng(7); NS = 160
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
TXA = {}
for t, im_ in TXP.items():
    a_ = np.asarray(im_).astype(np.int16)
    bad = ((a_[..., 1] > 140) & (a_[..., 1] > a_[..., 0] + 50) & (a_[..., 1] > a_[..., 2] + 35)) | (a_.min(-1) > 238)   # lime marking areas, white masks
    a_[bad] = (58, 66, 78); TXA[t] = a_
_r = np.random.default_rng(3).random((16, 4)); SAMP = _r ** 1.5
FCOL, FAREA, FOBJ = [], [], []
FTEX = []; FY = []; FXZ = {}; FEDG = []; EDGE = collections.defaultdict(list)
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
            v = shade(bake(P_, N_, 0))[:, 1]
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
PROUDSET = {r[0] for r in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'proud.json')))['proud']}
LEVERS = {'rev_l', 'thr_l_body', 'thr_l_button', 'rev_r', 'thr_r_body', 'thr_r_button', 'FlapsLever', 'FlapsLever_low', 'SpdBrk', 'gear_lever'}
# ---- window posts, rebuilt. The model's posts are a few flat plates meeting at hard angles. Each post is replaced by one clean
# moulded part, as on the aircraft: a straight, slightly tapered loft with a rounded-rectangle section. Its size comes from the
# model itself: the old post is cut at 12 stations along its axis and the new section is the smallest rounded rectangle that
# holds it (5 mm clear), with the sizes smoothed to a straight taper. The old post's faces inside the new one are left out.
PAD = 0.004
def post(p0, p1, R=0.10, NR=28, foot=0.0):
    p0, p1 = np.array(p0, float), np.array(p1, float); a = p1 - p0; Lh = np.linalg.norm(a); a /= Lh; mid = (p0 + p1) / 2
    v = np.array([0.0, 0.70, 0.40]) - mid; v -= (v @ a) * a; v /= np.linalg.norm(v); u = np.cross(a, v)          # v: towards the cockpit, u: across
    ts, ext = [], []
    for t in np.linspace(0.10, 0.90, 12):
        c = p0 + a * Lh * t; sec = OCC.section(plane_origin=c, plane_normal=a)
        if sec is None: continue
        q = np.asarray(sec.vertices) - c; q = q[np.linalg.norm(q, axis=1) < R]
        if len(q) < 6: continue
        ts.append(t); ext.append([np.percentile(q @ u, 10), np.percentile(q @ u, 90), np.percentile(q @ v, 6), np.percentile(q @ v, 94)])
    ts = np.array(ts); ext = np.array(ext); fit = [np.polyfit(ts, np.median(np.stack([ext[:, k], np.roll(ext[:, k], 1), np.roll(ext[:, k], -1)]), 0), 1) for k in range(4)]
    # the foot: below the window the post widens in a smooth curve into the sill (a moulded boot over the model's wedge plates)
    rings = []; tt = np.concatenate([np.linspace(-foot, -0.04, 7)[:-1], np.linspace(-0.04, 1.04, 14)]) if foot else np.linspace(-0.04, 1.04, 14)
    for t in tt:
        fl = 0.035 * ((-0.04 - t) / (foot - 0.04)) ** 2 if foot and t < -0.04 else 0.0
        u0, u1, v0, v1 = (np.polyval(f, t) for f in fit); u0 -= PAD + fl; u1 += PAD + fl; v0 -= PAD + fl; v1 += PAD + fl
        cu, cv, hw, hh = (u0 + u1) / 2, (v0 + v1) / 2, (u1 - u0) / 2, (v1 - v0) / 2; r = 0.42 * min(hw, hh); ring = []
        for k in range(NR):
            th = 2 * np.pi * k / NR; cx, sx = np.cos(th), np.sin(th)
            # rounded rectangle: a circle of radius r pushed out to the corners
            pu = cu + np.sign(cx) * (hw - r) + r * cx; pv = cv + np.sign(sx) * (hh - r) + r * sx; ring.append(p0 + a * Lh * t + u * pu + v * pv)
        rings.append(ring)
    return dict(p0=p0, a=a, L=Lh, u=u, v=v, fit=fit, rings=rings)
POSTS = []
for p0, p1 in (((-0.915, 0.40, -0.41), (-0.77, 0.88, 0.0)), ((-1.30, 0.40, 0.32), (-0.99, 0.88, 0.36))):
    POSTS.append(post(p0, p1, foot=0.20)); POSTS.append(post((-p0[0],) + p0[1:], (-p1[0],) + p1[1:], foot=0.20))
POSTS.append(post((0, 0.45, -0.865), (0, 0.88, -0.41)))
# ---- window headers, rebuilt the same way, part by part. Along the top of each window the model has a frame lip and a padded
# beam, each a box of flat plates. Every part of the model that runs along a header as a beam (cut at 12 stations: present in
# most of them, between 12 mm and 20 cm across) is replaced by one rounded loft of its own size and colour. ----
OFOa = np.array(OFO); DIAGALL = [float(np.linalg.norm(np.ptp(np.asarray(o['v'], float).reshape(-1, 3), 0))) if len(o['v']) else 0.0 for o in O]
def header(p0, p1, R=0.17, NR=24):
    p0, p1 = np.array(p0, float), np.array(p1, float); a = p1 - p0; Lh = np.linalg.norm(a); a /= Lh; mid = (p0 + p1) / 2
    v = np.array([0.0, 0.70, 0.40]) - mid; v -= (v @ a) * a; v /= np.linalg.norm(v); u = np.cross(a, v); per = collections.defaultdict(list)
    for t in np.linspace(0.10, 0.90, 12):
        c = p0 + a * Lh * t; lines, fidx = trimesh.intersections.mesh_plane(OCC, a, c, return_faces=True)
        if not len(lines): continue
        q = lines.reshape(-1, 3) - c; fo = np.repeat(OFOa[fidx], 2); near = np.linalg.norm(q, axis=1) < R
        for oi in np.unique(fo[near]):
            qq = q[near & (fo == oi)]
            if len(qq) >= 4: per[int(oi)].append((t, np.percentile(qq @ u, 8), np.percentile(qq @ u, 92), np.percentile(qq @ v, 8), np.percentile(qq @ v, 92)))
    out = []
    for oi, rows in per.items():
        rows = np.array(rows)
        if len(rows) < 9 or DIAGALL[oi] < 0.30 or O[oi]['tex'] not in TEX or O[oi]['name'].startswith('pedestal_low_glare'): continue
        w_ = np.median(rows[:, 2] - rows[:, 1]); h_ = np.median(rows[:, 4] - rows[:, 3])
        if min(w_, h_) < 0.012 or max(w_, h_) > 0.20: continue                      # a sheet passing by, or a wall: not a beam
        fit = [np.polyfit(rows[:, 0], rows[:, k], 1) for k in range(1, 5)]; rings = []
        for t in np.linspace(-0.05, 1.05, 12):
            u0, u1, v0, v1 = (np.polyval(f, t) for f in fit)   # no padding: a fatter beam covered the lowest row of the overhead panel
            cu, cv, hw, hh = (u0 + u1) / 2, (v0 + v1) / 2, (u1 - u0) / 2, (v1 - v0) / 2; r = min(0.42 * min(hw, hh), 0.016); ring = []
            for k in range(NR):
                th = 2 * np.pi * k / NR; cx, sx = np.cos(th), np.sin(th); ring.append(p0 + a * Lh * t + u * (cu + np.sign(cx) * (hw - r) + r * cx) + v * (cv + np.sign(sx) * (hh - r) + r * sx))
            rings.append(ring)
        b = dict(p0=p0, a=a, L=Lh, u=u, v=v, fit=fit, rings=rings, obj=oi)
        # the part's colour: the median of its texture over the faces that the loft replaces
        o = O[oi]; vv = np.asarray(o['v'], float).reshape(-1, 3); cols = []
        for mat, idx, uvs, flags in o['faces']:
            cm = vv[idx].mean(0); pt = np.array([-cm[2], cm[1], cm[0]]) - p0; t = (pt @ a) / Lh
            if 0 <= t <= 1 and abs(pt @ u - np.polyval(fit[0], t) / 2 - np.polyval(fit[1], t) / 2) < 0.12:
                tu = np.mean([x[0] for x in uvs]) * o['rep'][0] + o['off'][0]; tv = 1 - (np.mean([x[1] for x in uvs]) * o['rep'][1] + o['off'][1])
                cols.append(TXA[o['tex']][min(511, int((tv % 1) * 512)), min(511, int((tu % 1) * 512))])
        b['col'] = np.median(np.array(cols), 0).astype(float) if cols else np.array([71.0, 85.0, 104.0]); b['tex'] = o['tex']
        out.append(b); print('  header part', o['name'], 'size mm', int(w_ * 1000), int(h_ * 1000), 'colour', b['col'].astype(int).tolist())
    return out
HEADS = []
# (not the beam over the windshield: its section is slanted, and the rounded box around it reached over the lowest row of the
# overhead panel; the model's own beam is kept there)
for p0, p1 in (((-0.77, 0.88, 0.0), (-0.99, 0.88, 0.36)), ((-0.99, 0.88, 0.36), (-1.0, 0.88, 0.95))):
    HEADS += header(p0, p1); HEADS += header((-p0[0],) + p0[1:], (-p1[0],) + p1[1:])
def in_post(pt, oi=None):   # pt in the page's frame
    for b in HEADS:
        if b['obj'] != oi: continue
        d = pt - b['p0']; t = (d @ b['a']) / b['L']
        if t < -0.05 or t > 1.05: continue
        u0, u1, v0, v1 = (np.polyval(f, t) for f in b['fit']); pu, pv = d @ b['u'], d @ b['v']
        if u0 - 0.02 < pu < u1 + 0.02 and v0 - 0.02 < pv < v1 + 0.02: return True
    for b in POSTS:
        d = pt - b['p0']; t = (d @ b['a']) / b['L']
        if t < -0.04 or t > 1.04: continue
        u0, u1, v0, v1 = (np.polyval(f, t) for f in b['fit']); pu, pv = d @ b['u'], d @ b['v']
        if u0 - 0.012 < pu < u1 + 0.012 and v0 - 0.012 < pv < v1 + 0.012: return True
    return False
_tj = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'taken.json'))); PARTV = {(a_, b_): k_ for a_, b_, k_ in _tj['part']}
TAKEN = set(map(tuple, _tj['taken']))  # faces the panels carry (panels.py)
for oi, o in enumerate(O):
    if o['tex'] not in TEX: continue
    v = o['v']; diag = np.linalg.norm(v.max(0) - v.min(0))
    # simple small fittings are kept (leaving them out left holes with chipped edges where they sit in the lining); finely
    # modelled small parts and the screws, plugs and breakers are left out
    if diag < 0.10 and 200 < len(o['faces']) < 400: continue
    if SKIP.search(o['name']) and diag < 0.6: continue
    if re.search(r'(?i)^(hud|efb|headset|sfl)|glass', o['name']): continue  # HUD, EFBs, headsets, sun blinds, glass
    rep, off = o['rep'], o['off']; g = G['flat']; tim = TXA[o['tex']]
    # a small fitting on a post (light panel, handle, clip) is kept and moved out onto the new post's surface
    PSH = None
    if diag < 0.30:
        vt_ = np.stack([-v[:, 2], v[:, 1], v[:, 0]], 1); c_ = vt_.mean(0)
        for b in POSTS:
            d_ = c_ - b['p0']; t_ = (d_ @ b['a']) / b['L']
            if not 0 <= t_ <= 1: continue
            u0, u1, v0, v1 = (np.polyval(f, t_) for f in b['fit'])
            if u0 - 0.02 < d_ @ b['u'] < u1 + 0.02 and v0 - 0.03 < d_ @ b['v'] < v1 + 0.03:
                top = ((vt_ - b['p0']) @ b['v']).max(); PSH = b['v'] * max(0.0, v1 + PAD + 0.004 - top); break
    # a part is kept whole or left out whole: dropping only its tiny faces left chips and fragments hanging in the lining
    fine = False
    if len(o['faces']) > 80 and not WHOLE.search(o['name']):
        ar_ = [sum(np.linalg.norm(np.cross(v[i_[j]] - v[i_[0]], v[i_[j + 1]] - v[i_[0]])) for j in range(1, len(i_) - 1)) / 2 for _, i_, _, _ in o['faces']]
        if np.mean(np.array(ar_) < MINA) > 0.5:
            if diag < 0.30: continue
            fine = True   # a large, finely modelled part: its tiny faces are left out as before
    for fi, (mat, idx, uvs, flags) in enumerate(o['faces']):
        TR_ = ac3d.tris(v[idx]); tk_ = [(oi, fi, ti_) in TAKEN for ti_ in range(len(TR_))]
        if TR_ and all(tk_) and (oi, fi) not in PARTV: continue
        P = v[idx]; ctr = P.mean(0); inside = False
        if PSH is None and in_post(np.array([-ctr[2], ctr[1], ctr[0]]), oi): continue
        # (the bright green lamp / marking areas of the textures are painted over in the saved pictures below: skipping those
        # faces left holes to the outside)
        tu = np.mean([uvs[j][0] * rep[0] + off[0] for j in range(len(idx))]) % 1; tv = 1 - (np.mean([uvs[j][1] * rep[1] + off[1] for j in range(len(idx))]) % 1)
        px = TXP[o['tex']].getpixel((min(TXP[o['tex']].width - 1, int(tu * TXP[o['tex']].width)), min(TXP[o['tex']].height - 1, int(tv * TXP[o['tex']].height))))
        for bi, (c, n, up, x, W, H) in enumerate(B[:3]):  # side consoles: the model's own geometry is kept
            d = ctr - c; dn = d @ (-n)
            if abs(d @ x) < W / 2 + 0.01 and abs(d @ up) < H / 2 + 0.01 and -0.03 < dn < (0.32 if bi == 1 else 0.12):
                # only what the panel picture can show: faces turned towards its view. A face seen edge-on from there (the top of
                # the glareshield, the sides of the panel bodies) is not in the picture at all, so it stays in the shell.
                fn = np.cross(P[1] - P[0], P[2] - P[0]); fl = np.linalg.norm(fn)
                # on a panel, only the parts whose picture lies flat on it are left out (the proud knobs, switches and guards of
                # proud.json, and the levers the page draws itself). Every other face that panels.py did not take stays here: leaving
                # all small parts out opened cracks under the glareshield and between the panels and the consoles.
                if fl < 1e-12 or oi in PROUDSET or o['name'] in LEVERS: inside = True; break
        if inside: continue
        nrm = np.cross(P[1] - P[0], P[2] - P[0]); ln = np.linalg.norm(nrm)
        if ln < 1e-12: continue
        area = sum(np.linalg.norm(np.cross(P[j_] - P[i_], P[k_] - P[i_])) for i_, j_, k_ in ac3d.tris(P)) / 2
        if area < 1e-9 or (fine and area < MINA and np.linalg.norm(P.max(0) - P.min(0)) < 0.03): continue  # tiny detail (bolts, edges of small parts): invisible at cockpit distance
        nrm /= ln; T = np.stack([-P[:, 2], P[:, 1], P[:, 0]], 1) + (PSH if PSH is not None else 0); nT = np.array([-nrm[2], nrm[1], nrm[0]])
        UVs = np.array([(uvs[j][0] * rep[0] + off[0], 1 - (uvs[j][1] * rep[1] + off[1])) for j in range(len(idx))])
        # the face's own colour: the median of the texture over the face (16 points), so marks, chips, grain and lettering in the
        # source textures drop out and what is left is the material's colour
        w = SAMP[:, :len(idx)] if len(idx) <= 4 else np.full((1, len(idx)), 1 / len(idx)); w = w / w.sum(1, keepdims=True); q = (w @ UVs) % 1
        px = tim[np.minimum(511, (q[:, 1] * 512).astype(int)), np.minimum(511, (q[:, 0] * 512).astype(int))].astype(float)
        fid = len(FCOL); FCOL.append(np.median(px, 0)); FAREA.append(area); FOBJ.append(oi); FTEX.append(o['tex']); FY.append(float(ctr[1])); FXZ[fid] = (-float(ctr[2]), float(ctr[0])); UVs = [(fid, 0)] * len(idx)
        qk = [tuple(np.round(p_ * 2000).astype(int)) for p_ in P]; ed = []
        for j in range(len(qk)):
            ek = tuple(sorted((qk[j], qk[(j + 1) % len(qk)]))); ed.append((ek, float(np.linalg.norm(P[j] - P[(j + 1) % len(P)])))); EDGE[ek].append(fid)
        FEDG.append(ed)
        for ti_, (i_, j_, k_) in enumerate(TR_):   # not a fan: concave plates would get fins
            if not tk_[ti_]: g['F'] += split([(T[i_], UVs[i_]), (T[j_], UVs[j_]), (T[k_], UVs[k_])], nT); continue
            if (oi, fi) not in PARTV: continue
            # a triangle the panel draws only inside its picture: the part outside the picture is drawn here
            c_, n_, up_, x_, W_, H_ = B[PARTV[(oi, fi)]]; rest = [P[i_], P[j_], P[k_]]
            for ax_, lim_, sg_ in ((x_, W_ / 2, 1), (x_, W_ / 2, -1), (up_, H_ / 2, 1), (up_, H_ / 2, -1)):
                outp, inp = [], []
                for a_ in range(len(rest)):
                    p_, q_ = rest[a_], rest[(a_ + 1) % len(rest)]; dp, dq = sg_ * ((p_ - c_) @ ax_) - lim_, sg_ * ((q_ - c_) @ ax_) - lim_
                    (outp if dp > 0 else inp).append(p_)
                    if (dp > 0) != (dq > 0): m_ = p_ + (q_ - p_) * (dp / (dp - dq)); outp.append(m_); inp.append(m_)
                for b_ in range(1, len(outp) - 1):
                    tt = [np.array([-w_[2], w_[1], w_[0]]) + (PSH if PSH is not None else 0) for w_ in (outp[0], outp[b_], outp[b_ + 1])]
                    if np.linalg.norm(np.cross(tt[1] - tt[0], tt[2] - tt[0])) > 1e-10: g['F'] += split([(tt[0], UVs[0]), (tt[1], UVs[0]), (tt[2], UVs[0])], nT)
                rest = inp
                if len(rest) < 3: break
POST_OI = next(i for i, o in enumerate(O) if o['name'] == 'WindowCpt')
for b in POSTS + HEADS:
    rg = b['rings']; NR = len(rg[0])
    for i in range(len(rg) - 1):
        for k in range(NR):
            q = [rg[i][k], rg[i][(k + 1) % NR], rg[i + 1][(k + 1) % NR], rg[i + 1][k]]; n_ = np.cross(q[1] - q[0], q[2] - q[0]); ln_ = np.linalg.norm(n_)
            if ln_ < 1e-12: continue
            n_ /= ln_; cc = sum(q) / 4 - (b['p0'] + b['a'] * ((sum(q) / 4 - b['p0']) @ b['a']))
            if n_ @ cc < 0: q = q[::-1]; n_ = -n_
            fid = len(FCOL); FCOL.append(b.get('col', np.array([71.0, 85.0, 104.0]))); FAREA.append(ln_); FOBJ.append(POST_OI); FTEX.append(b.get('tex', 'fd_other.png')); FY.append(0.0); FEDG.append([])
            G['flat']['F'] += [([(q[0], (fid, 0)), (q[1], (fid, 0)), (q[2], (fid, 0))], n_), ([(q[0], (fid, 0)), (q[2], (fid, 0)), (q[3], (fid, 0))], n_)]
# the reading-light panel on the two front posts (a part of the old post, so it went with it): a dark plate with rounded corners
# on the face towards the cockpit, with the light's lens and its switch
def _poly(b, t0, pts, lift, col, tex):
    u0, u1, v0, v1 = (np.polyval(f, t0) for f in b['fit']); cu = (u0 + u1) / 2
    P3 = [b['p0'] + b['a'] * (b['L'] * t0 + y_) + b['u'] * (cu + x_) + b['v'] * (v1 + PAD + lift) for x_, y_ in pts]; c3 = sum(P3) / len(P3)
    for k in range(len(P3)):
        q = [c3, P3[k], P3[(k + 1) % len(P3)]]; n_ = np.cross(q[1] - q[0], q[2] - q[0]); ln_ = np.linalg.norm(n_)
        if ln_ < 1e-12: continue
        n_ /= ln_
        if n_ @ b['v'] < 0: q = q[::-1]; n_ = -n_
        fid = len(FCOL); FCOL.append(np.array(col, float)); FAREA.append(ln_); FOBJ.append(POST_OI); FTEX.append(tex); FY.append(0.0); FEDG.append([])
        G['flat']['F'].append(([(q[0], (fid, 0)), (q[1], (fid, 0)), (q[2], (fid, 0))], n_))
def _rr(w, h, r, cx=0.0, cy=0.0, n=6):
    out = []
    for sx, sy, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for k in range(n + 1):
            th = np.radians(a0 + 90 * k / n); out.append((cx + sx * (w / 2 - r) + r * np.cos(th), cy + sy * (h / 2 - r) + r * np.sin(th)))
    return out
for b in POSTS[:2]:
    u0, u1, v0, v1 = (np.polyval(f, 0.74) for f in b['fit']); w = min(0.042, (u1 - u0) * 0.55)
    _poly(b, 0.74, _rr(w, 0.105, 0.008), 0.0012, (30, 33, 37), 'fd_leather.png')
    _poly(b, 0.74, [(0.011 * np.cos(a_), 0.022 + 0.011 * np.sin(a_)) for a_ in np.linspace(0, 2 * np.pi, 20, endpoint=False)], 0.0024, (71, 85, 104), 'fd_other.png')
    _poly(b, 0.74, _rr(0.011, 0.018, 0.002, 0.0, -0.026, 3), 0.0024, (71, 85, 104), 'fd_other.png')
# ---- materials: the face colours fall into a handful of clean ones (k-means, area-weighted); an object that is almost all one
# material is given that material throughout ----
FC = np.array(FCOL); FA = np.array(FAREA); FO = np.array(FOBJ); FT = np.array(FTEX); K = 5
# seat fabric, carpet and the glareshield's leather are each one material (their textures are patterns); the painted parts
# (fd_main, fd_other) fall into K colours
SPEC = ['fabric2.png', 'carpet2.png', 'fd_leather.png']; pm = ~np.isin(FT, SPEC); PC, PA = FC[pm], FA[pm]
cen = [PC[np.argmax(PA)]]
for _ in range(K - 1): cen.append(PC[np.argmax(np.min([np.linalg.norm(PC - c, axis=1) for c in cen], 0) * (PA > np.median(PA)))])
cen = np.array(cen)
for _ in range(30):
    pl = np.argmin(np.linalg.norm(PC[:, None] - cen[None], axis=2), 1)
    for k in range(K):
        m = pl == k
        if m.any(): cen[k] = (PC[m] * PA[m, None]).sum(0) / PA[m].sum()
lab = np.zeros(len(FC), int); lab[pm] = pl
for i_, t_ in enumerate(SPEC):
    m = FT == t_; lab[m] = K + i_; cen = np.vstack([cen, (FC[m] * FA[m, None]).sum(0) / max(1e-9, FA[m].sum()) if m.any() else [60, 60, 60]])
K = len(cen)
# a few faces of a painted part mapped to the fabric or carpet texture (patches on the headrests and posts): the part's own paint
for oi in np.unique(FO):
    m = FO == oi; sh = np.bincount(lab[m], weights=FA[m], minlength=K); tot = sh.sum()
    for k in (K - 3, K - 2):
        if 0 < sh[k] < 0.35 * tot:
            sh2 = sh.copy(); sh2[K - 3:] = 0
            if sh2.sum() > 0: lab[m & (lab == k)] = sh2.argmax()
    # the seats: fabric on the cushions only; patches of it on the seat backs and headrests take the seat's own cover
    hi_ = m & (lab == K - 3) & (np.array(FY) > 0.40)
    if hi_.any():
        sh2 = sh.copy(); sh2[K - 3:] = 0
        if sh2.sum() > 0: lab[hi_] = sh2.argmax()
hi_ = (lab == K - 3) & (np.array(FY) > 0.40)   # straps and patches in fabric above the cushions: the light cover colour
DEAD = hi_.copy()   # they are decals lying on the seat covers: left out
# lettering and placards: the near-white paint is the source textures' label strips and markings (rows of pale dashes on the
# breaker panels, strips on the sills), and large red faces are placards whose text is gone. Both take the paint around them
# (PLAC, resolved with the islands below); small red parts (the sidestick buttons) stay red.
PW = int(np.argmin(np.linalg.norm(cen[:K - 3] - 205, axis=1))); PR = int(np.argmax(cen[:K - 3, 0] - cen[:K - 3, 1]))
DIAGO = {oi: float(np.linalg.norm(np.ptp(O[oi]['v'], 0))) for oi in np.unique(FO)}
LIGHTS = [k for k in range(K - 3) if cen[k].min() > 110]   # pale greys: lettering strips; the baked light lifts them to near white
plac = np.isin(lab, LIGHTS) | ((lab == PR) & (cen[PR][0] > cen[PR][1] + 80) & (FA > 4e-4))
# a small part is one material: its dominant one (corner faces of brackets and clips mapped to another paint showed as chips)
for oi in np.unique(FO):
    m = FO == oi
    if DIAGO[oi] < 0.85:
        thr_ = 0.55 if DIAGO[oi] < 0.30 else 0.75
        sh = np.bincount(lab[m & ~plac], weights=FA[m & ~plac], minlength=K)
        if sh.sum() > 0 and sh.max() >= thr_ * sh.sum(): lab[m & ~plac & (lab != PR)] = sh.argmax()   # small red parts (buttons) keep their red
DARK = int(np.argmin(cen[:K - 3].sum(1)))
for _ in range(40):
    todo = np.nonzero(plac)[0]
    if not len(todo): break
    done = 0
    for f in todo:
        tot = collections.Counter()
        for ek, ln in FEDG[f]:
            for g_ in EDGE[ek]:
                if g_ != f and not plac[g_]: tot[lab[g_]] += ln
        if tot: lab[f] = tot.most_common(1)[0][0]; plac[f] = False; done += 1
    if not done: break
for oi in np.unique(FO[plac]):   # no painted neighbour at all: the part's own dominant paint, else dark
    m = FO == oi; sh = np.bincount(lab[m & ~plac], weights=FA[m & ~plac], minlength=K); lab[m & plac] = sh.argmax() if sh.sum() > 0 else DARK
# islands: a face that is bordered mostly (60 % of its outline) by one other material takes that material; repeated, this
# removes the small patches of a second texture the source model has on seats, lining and posts, and keeps real two-tone parts
for _ in range(6):
    ch = 0
    for f, eds in enumerate(FEDG):
        tot = collections.Counter(); per = 0.0
        for ek, ln in eds:
            per += ln
            for g_ in EDGE[ek]:
                if g_ != f: tot[lab[g_]] += ln
        if not tot: continue
        c, w = tot.most_common(1)[0]
        if c != lab[f] and w >= 0.6 * per: lab[f] = c; ch += 1
    print('  islands', ch)
    if not ch: break
# the dark paint of the consoles, pedestal sides and floor fittings: the source texture has it near black, and whole areas (side
# consoles, sidestick surround, rudder pedals) were a shapeless dark mass. On the aircraft it is a dark slate blue.
# Small black parts (sidestick grips, tiller, belts, handles, knobs) stay black: they get a palette entry of their own.
_dk = int(np.argmin(cen[:K - 3].sum(1))); _small = np.array([DIAGO.get(int(o_), 1.0) < 0.45 for o_ in FO[:len(lab)]]) if len(FO) >= len(lab) else np.zeros(len(lab), bool)
cen = np.vstack([cen, cen[_dk]]); lab[(lab == _dk) & _small[:len(lab)]] = len(cen) - 1; cen[_dk] = np.array([52.0, 60.0, 73.0])
# The seats' shells, backs, headrests and armrests are part of the lining object and had its pale paint, so the seats looked like
# unpainted casts. Inside the two seat volumes that paint becomes the seats' blue-grey cover.
_lt = int(np.argmin(np.linalg.norm(cen[:K - 3] - np.array([71.0, 85.0, 104.0]), axis=1))); cen = np.vstack([cen, [54.0, 67.0, 90.0]])
for f_, (x_, z_) in FXZ.items():
    if f_ < len(lab) and lab[f_] == _lt and 0.24 < abs(x_) < 0.84 and 0.22 < z_ < 1.15 and FY[f_] < 0.80: lab[f_] = len(cen) - 1
PAL = cen / 255.0; print('materials', np.round(cen).astype(int).tolist(), 'area share', np.round(np.bincount(lab, weights=FA, minlength=K) / FA.sum(), 2).tolist())
hdr = {'S': 16000, 'groups': [], 'lmax': LMAX}; blob = b''
COS = np.cos(np.radians(72))
for t, g in G.items():
    if not g['F']: continue
    g['F'] = refine([f_ for f_ in g['F'] if not DEAD[int(round(f_[0][0][1][0]))]])
    # smooth normals: at each position, the area-weighted mean of the face normals within 38° of this face's normal
    at = collections.defaultdict(list)
    for tri, n in g['F']:
        ar = np.linalg.norm(np.cross(tri[1][0] - tri[0][0], tri[2][0] - tri[0][0])) / 2 + 1e-9
        for p, uv in tri: at[tuple((p * 16000).round().astype(int))].append((n, ar))
    key, Pl, UVl, Nl, I = {}, [], [], [], []
    for tri, n in g['F']:
        for p, uv in tri:
            pk = tuple((p * 16000).round().astype(int)); sn = sum(a * m for m, a in at[pk] if m @ n > COS); sn = sn / max(1e-9, np.linalg.norm(sn))
            nq = tuple((sn * 127).round().astype(int)); uv = (int(lab[int(round(uv[0]))]), 0); k = (pk, uv, nq)
            if k not in key: key[k] = len(Pl); Pl.append(pk); UVl.append(uv); Nl.append(nq)
            I.append(key[k])
    P = np.array(Pl, np.int16); UV = np.array(UVl, np.float64); N = np.array(Nl, np.int8); I = np.array(I)
    Pf = P.astype(np.float64) / 16000; Nf = N.astype(np.float64); Nf /= np.maximum(1e-6, np.linalg.norm(Nf, axis=1, keepdims=True))
    b = list(bake(Pf, Nf, 0)); KEY = np.array([0.0, 0.55, -0.83]); b[2] = np.clip(Nf @ KEY, 0, 1) * 0.30 + np.clip(Nf[:, 1], 0, 1) * 0.42 - np.clip(-Nf[:, 1], 0, 1) * 0.10   # tops lighter, undersides darker: form reads where little window light reaches
    # smooth the bake over the mesh (neighbours through the triangles): less ray noise, no blotches across cut-up faces
    tri = I.reshape(-1, 3); nb = len(P)
    for it in range(3):
        for q in range(3):
            acc = np.zeros(nb); cnt = np.zeros(nb)
            for a_, c_ in ((0, 1), (1, 2), (2, 0), (1, 0), (2, 1), (0, 2)):
                np.add.at(acc, tri[:, a_], b[q][tri[:, c_]]); np.add.at(cnt, tri[:, a_], 1)
            b[q] = np.where(cnt > 0, 0.5 * b[q] + 0.5 * acc / np.maximum(cnt, 1), b[q])
    col = shade(b)
    col = col * PAL[UV[:, 0].astype(int)]
    N4 = np.zeros((len(P), 4), np.uint8); N4[:, :3] = np.clip(col / LMAX * 255, 0, 255).round()
    UV = UV * 0.0; lo, hi = UV.min(0), UV.max(0); span = np.maximum(hi - lo, 1e-9); Q = np.round((UV - lo) / span * 65535).astype(np.uint16)
    big = len(P) > 65535; I = I.astype(np.uint32 if big else np.uint16)
    name = 'flat'
    parts = [P.tobytes(), Q.tobytes(), N4.tobytes(), I.tobytes()]
    def pad(b): return b + b'\0' * ((-len(b)) % 4)
    off = len(blob); blob += b''.join(pad(p) for p in parts)
    hdr['groups'].append({'tex': name, 'nv': int(len(P)), 'ni': int(len(I)), 'i32': bool(big), 'uv': [float(lo[0]), float(lo[1]), float(span[0]), float(span[1])], 'off': off,
                          'sizes': [len(pad(p)) for p in parts]})
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
