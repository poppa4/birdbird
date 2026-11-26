"""The bird on the globe (26 Nov 2026): the bird from the earlier seal on a solid globe with two latitude swooshes.
Writes ../mark.d (centre 0,0, radius 100). Needs bird.pkl from bird.py (the bird traced from the seal image)."""
import pickle, numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely import affinity
from geo import disc, bez
def lens(P, wmax, n=240, p=0.75, wmin=0.4):
    t = np.linspace(0, 1, n); C = bez(P, t); D = np.gradient(C, axis=0); D /= np.hypot(*D.T)[:, None]; N = np.c_[-D[:, 1], D[:, 0]]
    w = (wmin + (wmax - wmin) * np.sin(np.pi * t) ** p) / 2
    return Polygon(list(map(tuple, C + N * w[:, None])) + list(map(tuple, (C - N * w[:, None])[::-1]))).buffer(0)
b = pickle.load(open('bird.pkl', 'rb')); s = 46 / 87.614; b = affinity.translate(affinity.scale(b, s, s, origin=(0, 0)), 50, 50)
top = lens([(30, 14.5), (48, 8.5), (70, 10), (86, 22)], 4.4)
bot = lens([(30, 89), (50, 94), (70, 92), (86, 80)], 4.4)
g = disc((50, 50), 46).difference(unary_union([b, top, bot]).buffer(0))
g = affinity.translate(affinity.scale(g, 100 / 46, 100 / 46, origin=(50, 50)), -50, -50)
out = []
for ring in [g.exterior, *g.interiors]:
    c = list(ring.simplify(0.008).coords)[:-1]; out.append('M' + ' '.join(f'{x:.2f} {y:.2f}' for x, y in c) + 'Z')
open('../mark.d', 'w').write(''.join(out))
