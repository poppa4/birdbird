import math, numpy as np
from shapely.geometry import Point, Polygon, LineString, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity
Q=128
def disc(c,r): return Point(c).buffer(r,quad_segs=Q)
def bez(P,t):
    P=np.array(P,float); t=np.asarray(t)[:,None]
    return (1-t)**3*P[0]+3*t*(1-t)**2*P[1]+3*t**2*(1-t)*P[2]+t**3*P[3]
def taper(P,w0,w1,n=200,ease=None,cap=True):
    t=np.linspace(0,1,n); C=bez(P,t); D=np.gradient(C,axis=0); D/=np.hypot(*D.T)[:,None]; N=np.c_[-D[:,1],D[:,0]]
    f=t if ease is None else ease(t); w=(w0+(w1-w0)*f)/2
    L=C+N*w[:,None]; R=C-N*w[:,None]
    g=Polygon(list(map(tuple,L))+list(map(tuple,R[::-1]))).buffer(0)
    if cap: g=unary_union([g,Point(C[0]).buffer(w[0],quad_segs=32),Point(C[-1]).buffer(w[-1],quad_segs=32)])
    return g
def earc(c,rx,ry,rot,w,a0=0,a1=360,n=720):
    t=np.radians(np.linspace(a0,a1,n)); x=rx*np.cos(t); y=ry*np.sin(t); r=math.radians(rot)
    pts=np.c_[c[0]+x*math.cos(r)-y*math.sin(r), c[1]+x*math.sin(r)+y*math.cos(r)]
    return LineString(pts).buffer(w/2,quad_segs=32,cap_style='round')
def switch(base,shape,gap):
    """shape is shown in negative inside base and positive outside, with a clean gap at the crossing"""
    return unary_union([base.difference(shape.buffer(gap,quad_segs=32)), shape.difference(base.buffer(gap,quad_segs=32))])
def to_d(g,nd=2):
    polys=[g] if g.geom_type=='Polygon' else list(g.geoms)
    out=[]
    for p in polys:
        for ring in [p.exterior,*p.interiors]:
            c=list(ring.coords)[:-1]
            out.append('M'+' '.join(f'{x:.{nd}f} {y:.{nd}f}' for x,y in c)+'Z')
    return ''.join(out)
def plane_local():
    """plan-view jet, nose up, origin at centre, ~100 long; swept wings echo the Λ"""
    fus=LineString([(0,-44),(0,42)]).buffer(5.2,quad_segs=32)
    nose=Polygon([(-5.2,-44),(0,-53),(5.2,-44)]).buffer(0)
    wl=Polygon([(0,-16),(-47,16),(-47,24),(0,8)]); wr=affinity.scale(wl,-1,1,origin=(0,0))
    tl=Polygon([(0,28),(-19,42),(-19,48),(0,42)]); tr=affinity.scale(tl,-1,1,origin=(0,0))
    return unary_union([fus,wl,wr,tl,tr]).buffer(0.8,quad_segs=16).buffer(-0.8,quad_segs=16)
def place(g,ang,s,c): return affinity.translate(affinity.rotate(affinity.scale(g,s,s,origin=(0,0)),ang,origin=(0,0)),c[0],c[1])
