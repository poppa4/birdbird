"""Height maps of the A320 panels, so the 3D cockpit can give the flat panel pictures their real depth (glareshield overhang,
recessed screens, knobs and guards standing out).  usage: python3 depth.py <A320-family>/Models/FlightDeck/res <out.bin>
For each view the sheet was rendered from (same centre, view direction, up and size as in the README), an orthographic ray per
grid point is cast along the view direction from 0.4 m in front of the panel plane into the model (FlightGear A320-family flight
deck, GPL-2.0; same objects as build.py, glass left out). The height is how far the first surface hit stands out of the panel
plane, towards the viewer (metres; negative = behind it). Missed rays get the plane (0).
Output: little-endian uint32 header length, JSON header {views:{k:{nx,ny,off}}, scale}, then int16 heights (1/10 mm) row by row,
top row first (the picture's top)."""
import sys, os, json, struct, numpy as np, trimesh
sys.path.insert(0, os.path.dirname(__file__)); import ac3d
RES, OUT = sys.argv[1].rstrip('/') + '/', sys.argv[2]
mats, objs = ac3d.load(RES + 'fd_complete.ac')
HIDE = {'autoland_light.plug', 'autoland_light_on.plug', 'hud', 'hud_box', 'hud_brt', 'hud_brt.axis', 'hud_brt.mark', 'hud_norm_sw', 'hud_declutter_btn', 'hud_ceiling', 'fcu_hud.plug',
        'Eng1N1Btn', 'Eng1N1Btn2O', 'Eng1N1Prot', 'Eng2N1Btn', 'Eng2N1Btn2O', 'Eng2N1Prot', 'glare_ovh_eng_iae.plug', 'ovh_eng_iae.plug'}
V, F = [], []
for o in objs:
    if set(o['path']) & HIDE or o['name'].startswith('hud_') or o['name'].startswith('fcu_labels_hud'): continue
    base = sum(len(v) for v in V); added = False
    for mi, idx, uvs, flags in o['faces']:
        if len(set(idx)) < 3: continue
        if mats[mi].get('trans', 0) > 0.3: continue          # glass
        for i in range(1, len(idx) - 1): F.append([base + idx[0], base + idx[i], base + idx[i + 1]]); added = True
    V.append(np.asarray(o['v'], float))
Vs = np.concatenate(V); Fs = np.array(F)
M = trimesh.Trimesh(Vs, Fs, process=False); R = trimesh.ray.ray_pyembree.RayMeshIntersector(M)
VIEWS = {'ovh': ((0.385, 1.10, 0), (-0.362, 0.932, 0), (0.932, 0.362, 0), 0.66, 1.30),
         'front': ((-0.478, 0.229, 0), (-0.955, -0.297, 0), (0, 1, 0), 1.64, 0.54),
         'ped': ((-0.02289, -0.07831, 0), (-0.13, -0.99, 0), (-1, 0, 0), 0.58, 0.886),
         'sideL': ((-0.22, 0.08, 0.95), (0, -0.62, 0.78), (-1, 0, 0), 0.44, 0.40),
         'sideR': ((-0.22, 0.08, -0.95), (0, -0.62, -0.78), (-1, 0, 0), 0.44, 0.40)}
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
    h = np.clip(h, -0.50, 0.75).reshape(ny, nx)
    # the panels' faces are flat: tiny plates and screw heads give a centimetre of noise that would show as streaks, so a
    # median filter keeps the real steps (glareshield, bezels, knobs) and drops the noise
    from scipy.ndimage import median_filter
    h = median_filter(h, size=5, mode='nearest')
    if k == 'front':  # the outermost strips are the window posts seen end-on: carry the panel's edge out to them instead
        e = int(nx * 0.03); h[:, :e] = h[:, e:e + 1]; h[:, -e:] = h[:, -e - 1:-e]
        lo = int(ny * 0.40); h[lo:] = np.clip(h[lo:], -0.085, 0.0)   # below the glareshield nothing comes forward (the pedestal top seen from the front has its own panel)
    h = h.reshape(-1)
    hdr['views'][k] = {'nx': nx, 'ny': ny, 'off': off}; q = np.round(h * hdr['scale']).astype('<i2'); blobs.append(q.tobytes()); off += q.nbytes
    print(k, nx, ny, 'hits', len(ri), 'of', len(O), 'height range', round(h.min(), 3), round(h.max(), 3))
hj = json.dumps(hdr, separators=(',', ':')).encode(); hj += b' ' * ((-len(hj)) % 4)
open(OUT, 'wb').write(struct.pack('<I', len(hj)) + hj + b''.join(blobs))
print('wrote', OUT, os.path.getsize(OUT))
