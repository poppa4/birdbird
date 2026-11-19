"""Render the part (x0..x1, y0..y1 metres from the view's top-left) of a view at ppm, as tiles of at most ~2.2 Mpx, lit as the whole view.
usage: hitile.py dir name cx cy cz nx ny nz ax ay az W H x0 y0 x1 y1 ppm spp near far"""
import sys, os, subprocess, math, numpy as np
a = sys.argv[1:]; d = a[0]; name = a[1]; c = np.array(a[2:5], float); n = np.array(a[5:8], float); n /= np.linalg.norm(n); up = np.array(a[8:11], float)
W, H, x0, y0, x1, y1, ppm = map(float, a[11:18]); spp, near, far = a[18], a[19], a[20]
up = up - up.dot(n) * n; up /= np.linalg.norm(up); x = np.cross(up, -n); x /= np.linalg.norm(x)
w, h = x1 - x0, y1 - y0; cols = max(1, math.ceil(w * ppm / 2600)); rows = max(1, math.ceil(h * ppm / 1700)); tw, th = w / cols, h / rows
env = dict(os.environ, LC=','.join(map(str, c)))
for r in range(rows):
    for ci in range(cols):
        out = f"{env.get('OUT', d + '/out')}/{name}_{r}_{ci}.png"
        if os.path.exists(out): continue
        cx = -W / 2 + x0 + tw * (ci + .5); cy = H / 2 - y0 - th * (r + .5); cc = c + x * cx + up * cy
        subprocess.run(['python3', d + '/render.py', '--', f'{name}_{r}_{ci}', *map(str, cc), *map(str, n), *map(str, up), str(tw), str(th), str(round(tw * ppm)), spp, near, far], check=True, env=env, cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print('done', name, r, ci, flush=True)
print('grid', name, rows, cols)
