"""Height maps of the A320 panels, so the 3D cockpit can give the flat panel pictures their real depth (glareshield overhang,
recessed screens, knobs and guards standing out).  usage: python3 depth.py <A320-family>/Models/FlightDeck/res <out.bin>
For each view the sheet was rendered from (same centre, view direction, up and size as in the README), an orthographic ray per
grid point is cast along the view direction from 0.4 m in front of the panel plane into the model (FlightGear A320-family flight
deck, GPL-2.0; same objects as build.py, glass left out). The height is how far the first surface hit stands out of the panel
plane, towards the viewer (metres; negative = behind it). Missed rays get the plane (0).
Output: little-endian uint32 header length, JSON header {views:{k:{nx,ny,off}}, scale}, then int16 heights (1/10 mm) row by row,
top row first (the picture's top)."""
import sys, os, re, json, struct, collections, numpy as np, trimesh
def ped_flat(h):
    """The pedestal view looks straight down on a face that is steep at the front (the MCDUs) and stepped further aft, so the
    ray-cast heights there are large walls (up to 9 cm) that stretched the picture into slanted slabs around the MCDUs. Keep
    only the local relief (knobs, keys, bezels): the height minus its 21-sample median, limited to -6 .. +12 mm."""
    from scipy.ndimage import median_filter
    return np.clip(h - median_filter(h, size=21, mode='nearest'), -0.006, 0.012)
sys.path.insert(0, os.path.dirname(__file__)); import ac3d
RES, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
mats, objs = ac3d.load(RES + 'fd_complete.ac')
HIDE = {'autoland_light.plug', 'autoland_light_on.plug', 'hud', 'hud_box', 'hud_brt', 'hud_brt.axis', 'hud_brt.mark', 'hud_norm_sw', 'hud_declutter_btn', 'hud_ceiling', 'fcu_hud.plug',
        'Eng1N1Btn', 'Eng1N1Btn2O', 'Eng1N1Prot', 'Eng2N1Btn', 'Eng2N1Btn2O', 'Eng2N1Prot', 'glare_ovh_eng_iae.plug', 'ovh_eng_iae.plug'}
def build(skip=()):
    V, F = [], []
    for oi, o in enumerate(objs):
        if oi in skip or set(o['path']) & HIDE or o['name'].startswith('hud_') or o['name'].startswith('fcu_labels_hud'): continue
        base = sum(len(v) for v in V); added = False
        for mi, idx, uvs, flags in o['faces']:
            if len(set(idx)) < 3: continue
            if mats[mi].get('trans', 0) > 0.3: continue          # glass
            for i in range(1, len(idx) - 1): F.append([base + idx[0], base + idx[i], base + idx[i + 1]]); added = True
        V.append(np.asarray(o['v'], float))
    M = trimesh.Trimesh(np.concatenate(V), np.array(F), process=False); return trimesh.ray.ray_pyembree.RayMeshIntersector(M)
VIEWS = {'ovh': ((0.385, 1.10, 0), (-0.362, 0.932, 0), (0.932, 0.362, 0), 0.66, 1.30),
         'front': ((-0.478, 0.229, 0), (-0.955, -0.297, 0), (0, 1, 0), 1.64, 0.54),
         'ped': ((-0.02289, -0.07831, 0), (-0.13, -0.99, 0), (-1, 0, 0), 0.58, 0.886),
         'sideL': ((-0.22, 0.08, 0.95), (0, -0.62, 0.78), (-1, 0, 0), 0.44, 0.40),
         'sideR': ((-0.22, 0.08, -0.95), (0, -0.62, -0.78), (-1, 0, 0), 0.44, 0.40)}
# Parts that stand proud of the panel face (rotary knobs, selectors, toggle switches, guards): a height field turns them into
# cones with the panel picture smeared down their sides. They are left out of the height field (the face stays flat, with the
# part's picture on it) and drawn as real geometry instead (parts.py -> models/a320-parts.bin, which hides that picture).
def frame(c, n, up):
    c, n, up = (np.array(v, float) for v in (c, n, up)); n /= np.linalg.norm(n); up = up - up.dot(n) * n; up /= np.linalg.norm(up); return c, n, up, np.cross(up, -n)
o_name = lambda i: objs[i]['name']
SMALL = {}
for oi, o in enumerate(objs):
    v = np.asarray(o['v'], float)
    if len(v) < 3 or set(o['path']) & HIDE or o['name'].startswith('hud_'): continue
    if np.linalg.norm(v.max(0) - v.min(0)) < 0.14: SMALL[oi] = v
R0 = build(skip=set(SMALL)); PROUD = {}
for k, (c, n, up, W, H) in VIEWS.items():
    if k not in ('ovh', 'front', 'ped'): continue
    c, n, up, x = frame(c, n, up); lim = 0.32 if k == 'front' else 0.14
    for oi, v in SMALL.items():
        d = v - c; hgt = -(d @ n); u = d @ x; t = d @ up
        if abs(u.mean()) > W / 2 or abs(t.mean()) > H / 2 or hgt.max() > lim or hgt.min() < -0.25: continue
        ru, rt = (u.max() - u.min()) / 2 + 0.004, (t.max() - t.min()) / 2 + 0.004; ang = np.linspace(0, 2 * np.pi, 12, endpoint=False)
        o0 = c[None] + (u.mean() + ru * np.cos(ang))[:, None] * x + (t.mean() + rt * np.sin(ang))[:, None] * up - n * 0.8
        loc, ri, ti = R0.intersects_location(o0, np.repeat(n[None], 12, 0), multiple_hits=False)
        base = float(np.median(0.8 - (loc - o0[ri]) @ n)) if len(ri) else 0.0   # the face around the part (median of a ring of rays just outside its outline)
        if hgt.max() - base > 0.0065 and hgt.max() - base < 0.09 and not re.match(r'ddrmi|.*screen', o_name(oi)): PROUD[oi] = k
for oi, o in enumerate(objs):
    if o['name'] in ('alt-sel', 'qnh_cpt_knb', 'qnh_fo_knb'): PROUD[oi] = 'front'   # several knobs in one object (too wide for the size test)
json.dump({'proud': sorted([[oi, objs[oi]['name'], k] for oi, k in PROUD.items()])}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'proud.json'), 'w'))
print('proud parts', len(PROUD), collections.Counter(PROUD.values()))
R = build(skip=set(PROUD))
PPM, NEAR = 260, 0.8
hdr = {'views': {}, 'scale': 10000}; blobs = []; off = 0
for k, (c, n, up, W, H) in VIEWS.items():
    c, n, up = (np.array(v, float) for v in (c, n, up)); n /= np.linalg.norm(n); up = up - up.dot(n) * n; up /= np.linalg.norm(up)
    x = np.cross(up, -n)  # the picture's right (render.py: x = up x z with z = -n)
    nx, ny = int(round(W * PPM)) + 1, int(round(H * PPM)) + 1
    u = np.linspace(-W / 2, W / 2, nx); t = np.linspace(H / 2, -H / 2, ny)
    U, T = np.meshgrid(u, t)
    O = c[None, None] + U[..., None] * x + T[..., None] * up - n * NEAR
    O = O.reshape(-1, 3); D = np.repeat(n[None], len(O), 0)
    loc, ri, ti = R.intersects_location(O, D, multiple_hits=False)
    h = np.zeros(len(O)); d = np.einsum('ij,j->i', loc - O[ri], n); h[ri] = NEAR - d
    # a ray that hits nothing (the picture's empty background, above the glareshield) takes the height of the nearest ray that
    # did: the outline there is then cut by the picture's own transparency, a smooth line, instead of a step in the surface
    if len(ri) < len(O):
        from scipy.ndimage import distance_transform_edt
        hit = np.zeros(len(O), bool); hit[ri] = True; hit = hit.reshape(len(t), len(u))
        ii = distance_transform_edt(~hit, return_distances=False, return_indices=True); h = h.reshape(len(t), len(u))[ii[0], ii[1]].reshape(-1)
        if k == 'front':
            # the glareshield's top lip: its upper surface is seen almost edge-on from this view, so the rays there return
            # heights that jump by centimetres from one sample to the next, and the outline became a row of little tabs and
            # gaps against the windshield. From the picture's outline down to 2 cm below it, each column takes the height of
            # the glareshield's front face just below (smoothed along the edge); the real top surface is in the shell.
            h2 = h.reshape(len(t), len(u)); K = 5; first = np.where(hit.any(0), hit.argmax(0), 0); src = np.minimum(first + K, len(t) - 1)
            face = h2[src, np.arange(len(u))]
            from scipy.ndimage import median_filter as _mf, uniform_filter1d as _uf
            face = _uf(_mf(face, size=9, mode='nearest'), size=7, mode='nearest')
            for xi in range(len(u)):
                if hit[:, xi].any() and first[xi] < len(t) * 0.45: h2[:src[xi] + 1, xi] = face[xi]
            h = h2.reshape(-1)
    h = np.clip(h, -0.50, 0.75).reshape(ny, nx)
    # the panels' faces are flat: tiny plates and screw heads give a centimetre of noise that would show as streaks, so a
    # median filter keeps the real steps (glareshield, bezels, knobs) and drops the noise
    from scipy.ndimage import median_filter
    h = median_filter(h, size=5, mode='nearest')
    if k == 'front':  # the outermost strips are the window posts seen end-on: carry the panel's edge out to them instead
        e = int(nx * 0.03); h[:, :e] = h[:, e:e + 1]; h[:, -e:] = h[:, -e - 1:-e]
        lo = int(ny * 0.40); h[lo:] = np.clip(h[lo:], -0.085, 0.0)   # below the glareshield nothing comes forward (the pedestal top seen from the front has its own panel)
    if k == 'ped': h = ped_flat(h)
    h = h.reshape(-1)
    hdr['views'][k] = {'nx': nx, 'ny': ny, 'off': off}; q = np.round(h * hdr['scale']).astype('<i2'); blobs.append(q.tobytes()); off += q.nbytes
    print(k, nx, ny, 'hits', len(ri), 'of', len(O), 'height range', round(h.min(), 3), round(h.max(), 3))
hj = json.dumps(hdr, separators=(',', ':')).encode(); hj += b' ' * ((-len(hj)) % 4)
open(OUT, 'wb').write(struct.pack('<I', len(hj)) + hj + b''.join(blobs))
print('wrote', OUT, os.path.getsize(OUT))
