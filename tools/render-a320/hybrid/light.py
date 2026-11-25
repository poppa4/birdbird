import numpy as np, trimesh
def fib(n):
    i = np.arange(n) + 0.5; phi = np.pi * (1 + 5 ** 0.5) * i; ct = np.sqrt(1 - i / n)   # cosine-weighted hemisphere
    st = np.sqrt(1 - ct * ct); return np.c_[st * np.cos(phi), st * np.sin(phi), ct]
def frames(N):
    a = np.where(np.abs(N[:, [1]]) < 0.9, [[0, 1, 0]], [[1, 0, 0]]); T = np.cross(a, N); T /= np.linalg.norm(T, axis=1)[:, None]; B = np.cross(N, T); return T, B
def features(R, P, N, nray=128, eps=0.004, chunk=4000):
    """sky = share of the cosine-weighted hemisphere that leaves through a window; con = contact shade (hits within 25 cm);
       mid = hits within 1 m (near surfaces: the shade under beams and in corners)"""
    H = fib(nray); T, B = frames(N); sky = np.zeros(len(P)); con = np.zeros(len(P)); mid = np.zeros(len(P))
    for s in range(0, len(P), chunk):
        p = P[s:s + chunk]; n = N[s:s + chunk]; t = T[s:s + chunk]; b = B[s:s + chunk]; k = len(p)
        D = (H[None, :, 0, None] * t[:, None] + H[None, :, 1, None] * b[:, None] + H[None, :, 2, None] * n[:, None]).reshape(-1, 3)
        O = np.repeat(p + n * eps, nray, 0)
        loc, ri, ti = R.intersects_location(O, D, multiple_hits=False)
        d = np.full(len(O), np.inf); d[ri] = np.linalg.norm(loc - O[ri], axis=1); d = d.reshape(k, nray)
        esc = np.isinf(d); up = D[:, 1].reshape(k, nray) > 0.03
        sky[s:s + k] = (esc & up).mean(1) + 0.45 * (esc & ~up).mean(1)      # the ground outside is less bright than the sky
        con[s:s + k] = np.clip(1 - d / 0.25, 0, 1).mean(1); mid[s:s + k] = np.clip(1 - d / 1.0, 0, 1).mean(1)
    return sky, con, mid
def level(sky, con, mid):
    """light level 0..1 of a painted surface in the daylit flight deck: daylight through the windows, the room's own bounce
       where the surface is open to the room, a contact shade in corners and under lips"""
    return np.clip(0.30 + 2.3 * sky + 0.36 * (1 - mid) - 0.55 * con, 0.16, 1.0)
def orient(P, N, E=np.array([0, 0.55, 0.35])):
    s = np.sign(((E - P) * N).sum(1)); s[s == 0] = 1; return N * s[:, None]
