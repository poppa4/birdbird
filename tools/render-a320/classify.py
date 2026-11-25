"""Part classes for the A320 trial structure (models/a320-shell-test.bin), from geometry alone.
Returns a class per face. Classes:
 0 lining (roof, walls, posts)   1 window frame band   2 sun visor   3 seat cover   4 seat frame / hand controls (dark)
 5 console slate (side consoles, footwells)   6 carpet   7 glareshield leather   8 rear wall lining
 9 painted panels (circuit-breaker panels behind the seats, top of the side consoles): Airbus blue-grey
"""
import numpy as np, trimesh
import shellbin

NAMES = ['lining', 'frame', 'visor', 'seat', 'seatdark', 'console', 'carpet', 'leather', 'rear', 'panel']


def classify(h, g):
    V = shellbin.metres(h, g); F = g['I']; N = g['N'].astype(float)
    T = V[F]; C = T.mean(1)
    cr = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); A = 0.5 * np.linalg.norm(cr, axis=1)
    n = cr / np.maximum(2 * A, 1e-12)[:, None]
    mat = N[F[:, 0], 3].astype(int)
    col = N[F].mean(1)[:, :3]
    lum = col.sum(1)
    hue_b = col[:, 2] / np.maximum(col[:, 0], 1)
    cls = np.zeros(len(F), int)
    cls[mat == 2] = 6
    cls[mat == 3] = 7
    cls[(mat == 0) & (hue_b > 1.6) & (C[:, 2] > 0.0)] = 3                     # seat covers: the blue fabric
    dark = (mat <= 1) & (lum < 52) & (cls == 0)
    cls[dark & (C[:, 1] < 0.35)] = 5                                         # console slate, footwells
    cls[dark & (C[:, 1] >= 0.35)] = 4
    # parts: connected components
    M = trimesh.Trimesh(V, F, process=False)
    lab = trimesh.graph.connected_component_labels(M.face_adjacency, node_count=len(F))
    order = np.argsort(lab); b = np.r_[0, np.nonzero(np.diff(lab[order]))[0] + 1, len(order)]
    for s, e in zip(b[:-1], b[1:]):
        f = order[s:e]
        if (cls[f] != 0).any(): continue
        a = A[f].sum()
        if a < 0.02: continue
        n0 = (n[f] * A[f, None]).sum(0); n0 /= np.linalg.norm(n0) + 1e-12
        flat = (np.abs(n[f] @ n0)[A[f] > 1e-6] > np.cos(np.radians(12))).all()
        bb0, bb1 = T[f].reshape(-1, 3).min(0), T[f].reshape(-1, 3).max(0)
        # sun visors: flat plates up under the roof near the windows, 0.03-0.3 m2
        if flat and 0.025 < a < 0.35 and bb0[1] > 0.78 and (np.abs(C[f, 0]).mean() > 0.25) and bb1[2] < 0.75:
            cls[f] = 2
    cls[(cls == 0) & (C[:, 2] > 1.02)] = 8                                    # rear wall
    cls[np.isin(cls, [0, 8]) & (C[:, 2] > 0.85) & (np.abs(n[:, 2]) > 0.75) & (np.abs(C[:, 0]) < 1.05) & (C[:, 1] > -0.35) & (C[:, 1] < 1.25)] = 9   # breaker panels face forward
    side = (np.abs(C[:, 0]) > 0.55) & (np.abs(C[:, 0]) < 1.05) & (C[:, 1] > -0.15) & (C[:, 1] < 0.25) & (C[:, 2] > -0.45) & (C[:, 2] < 0.75)
    cls[side & (np.abs(n[:, 1]) > 0.8) & np.isin(cls, [0, 5])] = 9                # top of the side consoles
    return cls, lab, C, n, A
