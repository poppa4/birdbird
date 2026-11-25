"""Reads the circuit-breaker wall of the owner's Blender flight deck (rear right, 120VU): the outline of its two panels and
the place of every breaker (two kinds, as modelled). Straight-on ray casting; writes cb_layout.json (metres, Blender true frame:
x to the right of the aircraft, y up)."""
import sys,os,json,numpy as np,trimesh
from scipy import ndimage
from scipy.spatial import ConvexHull
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import rc
os.environ['SEL']='52,53,54,55,86'; V,F,ob=rc.load('m:'+sys.argv[1]); M=trimesh.Trimesh(V,F,process=False); R=trimesh.ray.ray_pyembree.RayMeshIntersector(M)
ppm=2500; x0,x1,y0,y1=0.15,1.22,0.45,1.33; W=int((x1-x0)*ppm); H=int((y1-y0)*ppm)
xs=x1-(np.arange(W)+.5)/ppm; ys=y1-(np.arange(H)+.5)/ppm; X,Y=np.meshgrid(xs,ys); O=np.c_[X.ravel(),Y.ravel(),np.full(X.size,0.6)]
tri=R.intersects_first(O,np.tile([0,0,1.],(len(O),1))); idm=np.where(tri>=0,ob[np.clip(tri,0,None)],-1).reshape(H,W)
out={'panels':[],'breakers':[]}
lab,n=ndimage.label(idm>=0)
for k in range(1,n+1):
    yy,xx=np.nonzero(lab==k)
    if len(yy)<5000: continue
    pts=np.c_[xs[xx],ys[yy]]; hull=pts[ConvexHull(pts).vertices]
    # simplify: drop hull points that barely turn
    keep=[]; m=len(hull)
    for i in range(m):
        a,b,c=hull[i-1],hull[i],hull[(i+1)%m]; u=(b-a)/np.linalg.norm(b-a); v=(c-b)/np.linalg.norm(c-b)
        if abs(u[0]*v[1]-u[1]*v[0])>0.08: keep.append(b)
    out['panels'].append(np.round(keep,4).tolist()); print('panel',len(keep),'corners',np.round(keep,3).tolist())
for kind,ids in (('A',(52,53)),('B',(54,55))):
    lb,nn=ndimage.label(np.isin(idm,ids)); cm=ndimage.center_of_mass(np.ones_like(lb),lb,range(1,nn+1)); sz=ndimage.sum(np.ones_like(lb),lb,range(1,nn+1))
    for (cy,cx),s in zip(cm,sz):
        if s<60: continue
        out['breakers'].append([round(float(x1-(cx+.5)/ppm),4),round(float(y1-(cy+.5)/ppm),4),kind,round(float(np.sqrt(s/np.pi)/ppm),4)])
print('breakers',len(out['breakers']),'A',sum(b[2]=='A' for b in out['breakers']),'radius median',np.median([b[3] for b in out['breakers']]))
json.dump(out,open(sys.argv[2],'w'))
