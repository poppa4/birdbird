"""Panorama of what the first hit is from a seat: shell (grey, shaded), sky (white), backstop quads (colours by quad), other page parts (light blue).
pano.py out.png seat [tagnpz]"""
import sys, os, json, numpy as np, trimesh
from PIL import Image, ImageDraw
import importlib
def run(out, seat, tagf=os.environ.get('TAG','tag.npz'), occf=os.environ.get('OCC','occ.npy'), eye=None, W=1800, H=700, pr=(-50, 65)):
    T = np.load(tagf, allow_pickle=True); occ = np.load(occf); otag = np.load(occf + '.tags.npy'); onm = json.load(open(occf + '.names.json'))
    oV = occ.reshape(-1, 3); oF = np.arange(len(oV)).reshape(-1, 3)
    V = np.vstack([T['v'], oV]); F = np.vstack([T['f'], oF + len(T['v'])]); nS = len(T['f'])
    M = trimesh.Trimesh(V, F, process=False); R = trimesh.ray.ray_pyembree.RayMeshIntersector(M)
    back = np.array(['6d7a8a' in onm[t] and ", 20," in onm[t] or "'6d7a8a'" in onm[t] for t in otag]); bidx = np.cumsum(back) - 1   # index of the face within the backstop mesh
    if eye is None: eye = np.array([0.53 if seat == 'R' else (-0.53 if seat == 'L' else 0.0), 0.63 if seat != 'J' else 0.75, 0.31 if seat != 'J' else 0.95])
    yaw = np.radians(np.linspace(180, -180, W)); pit = np.radians(np.linspace(pr[1], pr[0], H)); Y, P = np.meshgrid(yaw, pit)
    D = np.c_[(-np.sin(Y) * np.cos(P)).ravel(), np.sin(P).ravel(), (-np.cos(Y) * np.cos(P)).ravel()]
    tri = R.intersects_first(np.tile(eye, (len(D), 1)), D); hit = tri >= 0; img = np.full((len(D), 3), 255.)
    n = M.face_normals[np.clip(tri, 0, None)]; sh = 0.35 + 0.65 * np.abs((n * D).sum(1))
    sh_ = hit & (tri < nS); img[sh_] = (150 * sh[sh_])[:, None]
    oc = hit & (tri >= nS); img[oc] = np.array([150, 190, 230]) * sh[oc][:, None]
    bk = np.zeros(len(D), bool); bk[oc] = back[tri[oc] - nS]; q = np.zeros(len(D), int); q[bk] = bidx[tri[bk] - nS] // 2
    pal = np.array([[255, 0, 0], [255, 140, 0], [200, 0, 200], [0, 170, 0], [0, 0, 255], [0, 200, 200], [150, 100, 0], [255, 0, 140], [100, 0, 255], [0, 120, 120], [90, 90, 0], [0, 0, 0]])
    img[bk] = pal[q[bk] % len(pal)]
    im = Image.fromarray(img.reshape(H, W, 3).clip(0, 255).astype('uint8')); d = ImageDraw.Draw(im)
    for a in range(-150, 181, 30): x = (180 - a) / 360 * W; d.line([(x, 0), (x, 8)], fill=(0, 0, 0)); d.text((x + 2, 0), str(a), fill=(0, 0, 0))
    for p in range(-40, 61, 20): y = (pr[1] - p) / (pr[1] - pr[0]) * H; d.line([(0, y), (8, y)], fill=(0, 0, 0)); d.text((10, y - 5), str(p), fill=(0, 0, 0))
    im.save(out); ids, cnt = np.unique(q[bk], return_counts=True); print(seat, 'backstop pixels by quad', dict(zip(ids.tolist(), cnt.tolist())), 'sky', int((~hit).sum()))
if __name__ == '__main__': run(sys.argv[1], sys.argv[2], *(sys.argv[3:]))
