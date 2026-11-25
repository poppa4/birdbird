"""Picture of the rear right circuit-breaker panels (120VU: upper and lower panel) for the A320 3D page, drawn from the layout
of the owner's Blender flight deck (cbscan.py): Airbus blue-grey plates with their cut corners, rows of black push-pull
breakers (the second kind with a green collar: monitored), engraved white row letters, column numbers and label marks,
quarter-turn fasteners. Light on the wall baked from the cockpit geometry when a shell and occluders are given.
usage: cbwall.py cb_layout.json out.jpg out.json [shell.bin occ.npy]"""
import sys, os, json, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
L = json.load(open(sys.argv[1])); OUT, OUTJ = sys.argv[2], sys.argv[3]
X = lambda xb: 0.115 + (xb - 0.204) * 0.903; Y = lambda yb: 0.578 + (yb - 0.491) * 0.95        # Blender wall -> the page's wall (metres)
X0, X1, Y0, Y1 = 0.115, 1.000, 0.578, 1.346; PPM = 4000; W, H = int((X1 - X0) * PPM), int((Y1 - Y0) * PPM)
px = lambda x, y: ((X1 - x) * PPM, (Y1 - y) * PPM)       # seen looking aft: +x is on the left
rng = np.random.RandomState(7)
im = Image.new('RGB', (W, H), (28, 31, 36)); d = ImageDraw.Draw(im)
PLATE = (84, 99, 122)
polys = [[(X(x), Y(y)) for x, y in p] for p in L['panels']]
for P in polys:
    pp = [px(*q) for q in P]; d.polygon(pp, fill=PLATE)
    d.line(pp + [pp[0]], fill=(40, 47, 58), width=14); d.line(pp + [pp[0]], fill=(118, 132, 154), width=4)
# fine grain on the plates
g = (rng.rand(H // 4, W // 4) - 0.5) * 10; g = np.asarray(Image.fromarray(g).resize((W, H), Image.BILINEAR)); a = np.asarray(im).astype(float)
plate = (np.abs(a - np.array(PLATE)).sum(2) < 6); a[plate] += g[plate][:, None]; im = Image.fromarray(a.clip(0, 255).astype('uint8')); d = ImageDraw.Draw(im)
F1 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30); F2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 24); F3 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
B = [(X(b[0]), Y(b[1]), b[2]) for b in L['breakers']]
ys = np.array([b[1] for b in B]); xsb = np.array([b[0] for b in B])
# rows: cluster by height
order = np.argsort(-ys); rows = []; 
for i in order:
    if rows and abs(ys[rows[-1][0]] - ys[i]) < 0.012: rows[-1].append(i)
    else: rows.append([i])
LET = ['K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA']
white = (226, 230, 236)
pitch = np.median(np.diff(np.sort(xsb[rows[0]]))) if len(rows[0]) > 3 else 0.02
for ri, r in enumerate(rows):
    y = np.mean(ys[r]); xl, xr = xsb[r].max(), xsb[r].min(); lt = LET[ri % len(LET)]
    for xx in (xl + 0.022, xr - 0.022):
        cx, cy = px(xx, y); d.text((cx, cy), lt, font=F1, fill=white, anchor='mm')
    for i in r:
        x, yb, kind = B[i]; cx, cy = px(x, yb); R = 0.0062 * PPM
        # engraved label: two short lines of micro text above the breaker
        for k in range(2):
            wl = rng.randint(22, 46); yy = cy - R - 30 + k * 12; d.line([(cx - wl / 2, yy), (cx + wl / 2, yy)], fill=(200, 206, 216), width=4)
            for _ in range(2): gx = cx - wl / 2 + rng.randint(4, wl - 4); d.line([(gx, yy - 2), (gx + 3, yy - 2)], fill=PLATE, width=6)
        # column number under it
        col = int(round((xl - x) / pitch)) + 1; d.text((cx, cy + R + 16), str(col), font=F2, fill=(190, 197, 208), anchor='mm')
        d.ellipse([cx - R - 7 + 5, cy - R - 7 + 9, cx + R + 7 + 5, cy + R + 7 + 9], fill=(52, 62, 78))                 # shadow on the plate
        d.ellipse([cx - R - 7, cy - R - 7, cx + R + 7, cy + R + 7], fill=(58, 150, 92) if kind == 'B' else (150, 156, 166))   # collar
        d.ellipse([cx - R - 2, cy - R - 2, cx + R + 2, cy + R + 2], fill=(14, 14, 16))
        d.ellipse([cx - R + 3, cy - R + 3, cx + R - 3, cy + R - 3], fill=(30, 31, 35))
        d.ellipse([cx - R * 0.55, cy - R * 0.62, cx + R * 0.25, cy - R * 0.05], fill=(58, 60, 66))                       # sheen on the cap
        d.text((cx, cy + 1), str(rng.choice([3, 3, 5, 5, 5, 7, 10, 15])), font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18), fill=(205, 208, 214), anchor='mm')
# name plates and fasteners
for P, nm in zip(polys, ['121VU', '122VU'] if np.mean([q[1] for q in polys[0]]) > np.mean([q[1] for q in polys[1]]) else ['122VU', '121VU']):
    xs_ = [q[0] for q in P]; ys_ = [q[1] for q in P]; cx, cy = px(min(xs_) + 0.045, max(ys_) - 0.016)
    d.rectangle([cx - 84, cy - 26, cx + 84, cy + 26], fill=(18, 20, 23)); d.text((cx, cy), nm, font=F3, fill=white, anchor='mm')
    n = len(P)
    for i in range(n):
        a_, b_ = np.array(P[i]), np.array(P[(i + 1) % n]); ln = np.linalg.norm(b_ - a_)
        if ln < 0.08: continue
        cen = np.mean(P, 0)
        for s in np.linspace(0.04 / ln, 1 - 0.04 / ln, max(2, int(ln / 0.16) + 1)):
            q = a_ + s * (b_ - a_); q = q + (cen - q) / np.linalg.norm(cen - q) * 0.011; cx, cy = px(*q)
            d.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=(46, 52, 62)); d.ellipse([cx - 13, cy - 13, cx + 13, cy + 13], fill=(138, 146, 158)); d.line([(cx - 9, cy + 5), (cx + 9, cy - 5)], fill=(60, 66, 76), width=5)
im = im.resize((W // 2, H // 2), Image.LANCZOS)
# ---- light on the wall, from the cockpit geometry
if len(sys.argv) > 5:
    import trimesh
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); import shellbin, light
    h, g = shellbin.read(sys.argv[4]); V = shellbin.metres(h, g[0]); Fs = g[0]['I']; occ = np.load(sys.argv[5]); oV = occ.reshape(-1, 3)
    c = occ.mean(1); keep = ~((np.abs(c[:, 2] - 1.258) < 0.004) & (c[:, 0] > 0.1) & (c[:, 0] < 1.1))       # not the old drawn wall itself
    oV = occ[keep].reshape(-1, 3)
    M = trimesh.Trimesh(np.vstack([V, oV]), np.vstack([Fs, np.arange(len(oV)).reshape(-1, 3) + len(V)]), process=False); R = trimesh.ray.ray_pyembree.RayMeshIntersector(M)
    gx = np.linspace(X1, X0, 60); gy = np.linspace(Y1, Y0, 52); GX, GY = np.meshgrid(gx, gy); P = np.c_[GX.ravel(), GY.ravel(), np.full(GX.size, 1.254)]
    N = np.tile([0, 0, -1.], (len(P), 1)); sky, con, mid = light.features(R, P, N, 256, eps=0.002); Lg = light.level(sky, con, mid).reshape(GX.shape)
    from scipy import ndimage; Lg = ndimage.gaussian_filter(Lg, 1.2)
    print('wall light min/mean/max', Lg.min().round(2), Lg.mean().round(2), Lg.max().round(2))
    k = np.asarray(Image.fromarray((Lg / np.percentile(Lg, 85)).astype(np.float32)).resize(im.size, Image.BILINEAR)); k = np.clip(k, 0.45, 1.12)
    im = Image.fromarray((np.asarray(im).astype(float) * k[:, :, None]).clip(0, 255).astype('uint8'))
im.save(OUT, quality=80, optimize=True)
uv = lambda x, y: [round((X1 - x) / (X1 - X0), 5), round((y - Y0) / (Y1 - Y0), 5)]
json.dump({'z': 1.258, 'polys': [[[round(x, 4), round(y, 4)] + uv(x, y) for x, y in P] for P in polys]}, open(OUTJ, 'w'))
print('written', OUT, im.size, os.path.getsize(OUT), 'bytes; rows', len(rows), [len(r) for r in rows])
