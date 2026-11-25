"""Window seals for the A320 trial structure: finds the window openings by casting rays from the seats, and returns for
each opening a loop of points on the frame right at its edge plus a point ~W further onto the frame (the seal's inner
and outer edge). usage: seals.py <shell.bin> <out.json> [debug.png]"""
import sys, json
import numpy as np, trimesh
from skimage import measure
import shellbin

W = 0.022          # seal width on the frame (m)
STEP = 0.15        # degrees per ray
h, G = shellbin.read(sys.argv[1]); g = G[0]
V = shellbin.metres(h, g); F = g['I']
M = trimesh.Trimesh(V, F, process=False); R = trimesh.ray.ray_pyembree.RayMeshIntersector(M)

def cast(eye, yaw0, yaw1, p0, p1):
    ys = np.radians(np.arange(yaw0, yaw1, STEP)); ps = np.radians(np.arange(p1, p0, -STEP))
    Y, P = np.meshgrid(ys, ps)
    d = np.stack([-np.sin(Y) * np.cos(P), np.sin(P), -np.cos(Y) * np.cos(P)], -1).reshape(-1, 3)
    o = np.repeat(np.array(eye)[None], len(d), 0)
    loc, ri, ti = R.intersects_location(o, d, multiple_hits=False)
    hit = np.full((len(d), 3), np.nan); hit[ri] = loc
    return d.reshape(Y.shape + (3,)), hit.reshape(Y.shape + (3,))

loops = []
dbg = []
for eye, yaw0, yaw1, side in [((-0.53, 0.63, 0.31), -40, 140, -1), ((0.53, 0.63, 0.31), -140, 40, 1)]:
    D, H = cast(eye, yaw0, yaw1, -25, 60)
    esc = np.isnan(H[..., 0])
    # the openings the panels and the page's lining close are not windows: keep openings whose rays at 1.5 m are above the sill
    # and below the roof, and outboard or forward
    E = np.array(eye) + 1.5 * D
    win = esc & (E[..., 1] > 0.38) & (D[..., 1] < 0.55)
    lab = measure.label(win, connectivity=1)
    for r in measure.regionprops(lab):
        if r.area < 1500: continue
        m = lab == r.label
        cy, cx = np.array(r.centroid).astype(int)
        dc = D[cy, cx]
        if dc[1] > 0.4: continue   # the opening round the overhead (closed by the panel), not a window
        # this seat takes the windows on its own side and the windshield half on its side
        if np.sign(-dc[0] if abs(dc[0]) > 0.2 else 0) not in (0, -side) and False: pass
        for c in measure.find_contours(m.astype(float), 0.5):
            if len(c) < 60: continue
            pts_in, pts_out = [], []
            n = len(c)
            for i in range(0, n, 2):
                a, b = c[(i - 3) % n], c[(i + 3) % n]
                t = b - a; nn = np.array([t[1], -t[0]]); nn /= np.linalg.norm(nn) + 1e-9
                # the normal must point away from the opening
                q = c[i] + nn * 2
                if 0 <= int(round(q[0])) < m.shape[0] and 0 <= int(round(q[1])) < m.shape[1] and m[int(round(q[0])), int(round(q[1]))]: nn = -nn
                p0 = None
                for k in np.arange(1.0, 60.0, 0.5):
                    q = np.round(c[i] + nn * k).astype(int)
                    if not (0 <= q[0] < m.shape[0] and 0 <= q[1] < m.shape[1]): break
                    hp = H[q[0], q[1]]
                    if np.isnan(hp[0]): continue
                    if p0 is None: p0 = hp; continue
                    if np.linalg.norm(hp - p0) > 0.03: break       # a step in depth: the frame ends here
                    if np.linalg.norm(hp - p0) >= W:
                        if p0[1] >= 0.42: pts_in.append(p0); pts_out.append(hp)
                        else: pts_in.append(None); pts_out.append(None)   # below the sill: the glareshield and panels end the window there
                        break
            # split into runs at gaps (no point, or more than 4 cm between neighbours)
            run_a, run_b = [], []
            def flush():
                if len(run_a) >= 4: loops.append({'eye': side, 'a': np.round(run_a, 4).tolist(), 'b': np.round(run_b, 4).tolist()})
                run_a.clear(); run_b.clear()
            for a_, b_ in zip(pts_in, pts_out):
                if a_ is None or (run_a and np.linalg.norm(a_ - run_a[-1]) > 0.04): flush()
                if a_ is not None: run_a.append(a_); run_b.append(b_)
            flush()
    dbg.append(win)
print('runs', len(loops), [len(l['a']) for l in loops])
json.dump(loops, open(sys.argv[2], 'w'))
if len(sys.argv) > 3:
    from PIL import Image
    Image.fromarray(np.uint8(np.vstack(dbg) * 255)).save(sys.argv[3])

def smooth(a, k=3):
    a = np.array(a); out = a.copy()
    for i in range(len(a)):
        lo, hi = max(0, i - k), min(len(a), i + k + 1); out[i] = a[lo:hi].mean(0)
    return out

if len(sys.argv) > 4:   # write the seals into the shell's header
    for l in loops:
        a = smooth(l['a'], 4); b = np.array(l['b'])
        d = smooth(b - np.array(l['a']), 8); d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
        eye = np.array((0.53 * l['eye'], 0.63, 0.31))
        lift = eye - a; lift /= np.linalg.norm(lift, axis=1, keepdims=True)          # 3 mm towards the seat: never inside the frame
        a = a + 0.003 * lift; b = a + W * d
        l['a'] = a.round(4).tolist(); l['b'] = b.round(4).tolist()
    h['seals'] = [{'a': sum(l['a'], []), 'b': sum(l['b'], [])} for l in loops]
    shellbin.write(sys.argv[4], h, G)
    print('written', sys.argv[4])
