import numpy as np, potrace, json
from scipy import ndimage as ndi
from shapely.geometry import Polygon
from shapely.ops import unary_union
X0,Y0,R0,r1,r2,r3=map(float,open('/home/claude/birdbird/tools/logo/seal/src/seal_geo2.txt').read().split()); U=100/R0
bird=np.load('/home/claude/logo/birdmask2.npy')
bird=ndi.binary_opening(bird,iterations=1)
sm=ndi.gaussian_filter(bird.astype(float),9)>0.5
path=potrace.Bitmap(~sm).trace(turdsize=200,turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,alphamax=1.3,opticurve=True,opttolerance=1.2)
def cub(p0,p1,p2,p3,n=24):
    t=np.linspace(0,1,n)[1:,None]; p0,p1,p2,p3=map(np.array,(p0,p1,p2,p3))
    return list((1-t)**3*p0+3*t*(1-t)**2*p1+3*t**2*(1-t)*p2+t**3*p3)
polys=[]
for c in path:
    pts=[np.array([c.start_point.x,c.start_point.y])]
    for s in c.segments:
        if s.is_corner: pts+= [np.array([s.c.x,s.c.y]),np.array([s.end_point.x,s.end_point.y])]
        else: pts+=cub(pts[-1],(s.c1.x,s.c1.y),(s.c2.x,s.c2.y),(s.end_point.x,s.end_point.y))
    P=[((x-X0)*U,(y-Y0)*U) for x,y in pts]
    polys.append(Polygon(P).buffer(0))
# potrace of ~sm: outer frame + bird holes; keep polygons that are the bird (not huge frame)
polys=[p for p in polys if p.area<20000]
g=unary_union(polys)
print(g.geom_type, g.bounds, g.area, len(polys), 'R1',r1*U)
import pickle; pickle.dump(g,open('bird.pkl','wb'))
