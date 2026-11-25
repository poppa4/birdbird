"""Small patches of sky or backstop seen from a seat: holes.py seat [tag.npz] -> list (yaw, pitch, size in px at 0.1 deg)"""
import sys, os, json, numpy as np, trimesh
from scipy import ndimage
def run(seat, tagf=os.environ.get('TAG','tag.npz'), occf=os.environ.get('OCC','occ.npy'), res=0.1, pr=(-60, 75), eye=None, maxpx=4000):
    T = np.load(tagf, allow_pickle=True); occ = np.load(occf); otag = np.load(occf + '.tags.npy'); onm = json.load(open(occf + '.names.json'))
    oV = occ.reshape(-1, 3); oF = np.arange(len(oV)).reshape(-1, 3); V = np.vstack([T['v'], oV]); F = np.vstack([T['f'], oF + len(T['v'])]); nS = len(T['f'])
    R = trimesh.ray.ray_pyembree.RayMeshIntersector(trimesh.Trimesh(V, F, process=False))
    back = np.array(["'6d7a8a'" in onm[t] or "'2f3742'" in onm[t] for t in otag])
    if eye is None: eye = np.array([0.53 if seat == 'R' else (-0.53 if seat == 'L' else 0.0), 0.63 if seat != 'J' else 0.75, 0.31 if seat != 'J' else 0.95])
    yaw = np.arange(180, -180, -res); pit = np.arange(pr[1], pr[0], -res); W, H = len(yaw), len(pit); out = np.zeros((H, W), np.uint8)
    for j0 in range(0, H, 200):
        Y, P = np.meshgrid(np.radians(yaw), np.radians(pit[j0:j0 + 200])); D = np.c_[(-np.sin(Y) * np.cos(P)).ravel(), np.sin(P).ravel(), (-np.cos(Y) * np.cos(P)).ravel()]
        tri = R.intersects_first(np.tile(eye, (len(D), 1)), D); k = np.zeros(len(D), np.uint8); k[tri < 0] = 1; oc = tri >= nS; k[oc] = np.where(back[tri[oc] - nS], 2, 0); out[j0:j0 + 200] = k.reshape(-1, W)
    res_ = []
    for kind, nm in ((1, 'sky'), (2, 'backstop')):
        lab, n = ndimage.label(out == kind)
        if n == 0: continue
        sz = ndimage.sum(out == kind, lab, range(1, n + 1)); com = ndimage.center_of_mass(out == kind, lab, range(1, n + 1))
        for s, c in zip(sz, com):
            if s <= maxpx: res_.append((nm, round(float(yaw[int(c[1])]), 1), round(float(pit[int(c[0])]), 1), int(s)))
    return sorted(res_, key=lambda r: -r[3]), out
if __name__ == '__main__':
    r, out = run(sys.argv[1], *(sys.argv[2:3]))
    print(sys.argv[1], len(r), 'small patches'); [print('  ', x) for x in r[:60]]
