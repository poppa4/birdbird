"""Quick ray-cast preview of cockpit geometry from the page's seats (no browser).
usage: rc.py out.png seat(L|R) yaw pitch fov  src [src ...]   src = file.npz (v,f[,ob]) or shell .bin; prefix 'm:' mirrors x
Shading: headlight lambert + per-part tint; background magenta."""
import sys, numpy as np, trimesh
from PIL import Image
sys.path.insert(0, __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '..')); import shellbin
def load(src):
    mir = src.startswith('m:'); src = src[2:] if mir else src
    if src.endswith('.npz'):
        d = np.load(src, allow_pickle=True); V = d['v'].astype(float).copy(); F = d['f']; ob = d['ob'] if 'ob' in d.files else np.zeros(len(F), int)
    else:
        h, g = shellbin.read(src); V = shellbin.metres(h, g[0]); F = g[0]['I']; ob = np.zeros(len(F), int)
    if mir: V[:, 0] *= -1
    import os
    if os.environ.get('SEL') and src.endswith('.npz'):
        keep = np.isin(ob, [int(x) for x in os.environ['SEL'].split(',')]); F = F[keep]; ob = ob[keep]
    return V, F, ob
def render(out, seat, yaw, pitch, fov, srcs, W=760, H=600, tint=True):
    Vs, Fs, Os, k, ko = [], [], [], 0, 0
    for i, s in enumerate(srcs):
        V, F, ob = load(s); Vs.append(V); Fs.append(F + k); Os.append(ob + ko); k += len(V); ko += ob.max() + 1
    V = np.vstack(Vs); F = np.vstack(Fs); O = np.concatenate(Os)
    M = trimesh.Trimesh(V, F, process=False); R = trimesh.ray.ray_pyembree.RayMeshIntersector(M)
    eye = np.array([0.53 if seat == 'R' else -0.53, 0.63, 0.31]); y, p = np.radians(yaw), np.radians(pitch)
    fw = np.array([-np.sin(y) * np.cos(p), np.sin(p), -np.cos(y) * np.cos(p)]); rt = np.cross(fw, [0, 1, 0]); rt /= np.linalg.norm(rt); up = np.cross(rt, fw)
    t = np.tan(np.radians(fov) / 2); a = W / H
    u, v = np.meshgrid((np.arange(W) + .5) / W * 2 - 1, 1 - (np.arange(H) + .5) / H * 2)
    D = fw[None, None] + u[..., None] * t * a * rt + v[..., None] * t * up; D = D.reshape(-1, 3); D /= np.linalg.norm(D, axis=1)[:, None]
    tri = R.intersects_first(np.tile(eye, (len(D), 1)), D)
    img = np.zeros((H * W, 3)); img[:] = [255, 0, 255]; hit = tri >= 0
    n = M.face_normals[tri[hit]]; l = np.abs((n * D[hit]).sum(1)); sh = 0.25 + 0.75 * l
    base = np.full((hit.sum(), 3), 185.)
    if tint:
        rng = np.random.RandomState(3); pal = 150 + rng.rand(O.max() + 1, 3) * 70; base = pal[O[tri[hit]]]
    img[hit] = base * sh[:, None]
    # edges: where the part id or the depth-normal changes
    idm = np.where(hit, O[np.clip(tri, 0, None)], -1).reshape(H, W); e = np.zeros((H, W), bool)
    e[:, 1:] |= idm[:, 1:] != idm[:, :-1]; e[1:] |= idm[1:] != idm[:-1]
    img = img.reshape(H, W, 3); img[e & (idm >= 0)] *= 0.55
    Image.fromarray(img.clip(0, 255).astype('uint8')).save(out)
if __name__ == '__main__':
    render(sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), sys.argv[6:])
