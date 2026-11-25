# Parked cars from the lidar: 0.45-2.2 m high objects on open paved ground. Rows of cars that merge into one blob
# are split every 2.6 m (side by side). Kept only on grey (paved) Sentinel-2 pixels and in clusters (car parks).
import numpy as np, json
from scipy import ndimage as nd
from scipy.spatial import cKDTree
from PIL import Image
dtm=np.load('loc_near_dtm.npy',mmap_mode='r'); dom=np.load('loc_near_dom.npy',mmap_mode='r'); NE0,NN1,NR=-4000.0,7000.0,2.0
S2=np.load('loc_near_s2.npy',mmap_mode='r')
OUT='/home/claude/birdbird/world/ento'
A=json.load(open(f'{OUT}/airport.json')); sdf=A['rwy']['sdf']; apt=np.asarray(Image.open(f'{OUT}/apt.png'))
E0,E1,N0,N1=-2600,1600,-1600,3600
c0=int((E0-NE0)/NR); c1=int((E1-NE0)/NR); r0=int((NN1-N1)/NR); r1=int((NN1-N0)/NR)
h=np.array(dom[r0:r1,c0:c1])-np.array(dtm[r0:r1,c0:c1])
m=(h>0.45)&(h<2.2)
lab,n=nd.label(m); objs=nd.find_objects(lab)
tall=nd.maximum_filter(h,size=7)
def paved(E,N):
    r=int((NN1-N)/NR); c=int((E-NE0)/NR); px=np.asarray(S2[r-2:r+3,c-2:c+3],np.float32).reshape(-1,3).mean(0)
    return (px.max()-px.min())<42 and px[1]<=px[0]+16 and px.mean()>58
def airside(E,N):
    u=int(E-sdf['E0']); v=int(sdf['N1']-N)
    return 0<=u<apt.shape[1] and 0<=v<apt.shape[0] and apt[v,u,0]>120
C=[]   # E,N,heading or None
for k,sl in enumerate(objs):
    mk=lab[sl]==k+1; a=mk.sum()
    if a>60: continue
    ys,xs=np.nonzero(mk); E=E0+(sl[1].start+xs+0.5)*NR; N=N1-(sl[0].start+ys+0.5)*NR
    if tall[sl][mk].max()>3.0: continue                       # next to a tree or a building
    ri,ci=sl[0].start+int(ys.mean()),sl[1].start+int(xs.mean())
    win=h[max(0,ri-5):ri+6,max(0,ci-5):ci+6]
    if (win<0.3).mean()<0.35: continue
    P=np.stack([E,N],1); cen=P.mean(0)
    if a<=3: C.append((cen[0],cen[1],None)); continue
    q=P-cen; w,v=np.linalg.eigh(q.T@q); ax=v[:,1]; t=q@ax; s_=q@v[:,0]
    L=t.max()-t.min()+NR; Wd=s_.max()-s_.min()+NR
    if Wd>6.5: continue
    nc=max(1,int(round(L/2.6)))
    hd=float(np.arctan2(ax[1],ax[0]))+(np.pi/2 if nc>1 else 0.0)
    for i in range(nc):
        tt=t.min()-NR/2+(i+0.5)*L/nc; p=cen+ax*tt; C.append((p[0],p[1],hd))
C=[c for c in C if paved(c[0],c[1]) and not airside(c[0],c[1])]
P=np.array([c[:2] for c in C]); tr=cKDTree(P); cnt=np.array([len(tr.query_ball_point(p,18)) for p in P])
C=[c for c,k in zip(C,cnt) if k>=6]
keep=[]; tk=None
for c in C:                                        # no two cars closer than 2.3 m
    if keep and min((c[0]-k[0])**2+(c[1]-k[1])**2 for k in keep[-40:])<2.3**2: continue
    keep.append(c)
C=keep; P=np.array([c[:2] for c in C]); tr=cKDTree(P)
rng=np.random.default_rng(3); cars=[]
for (E,N,hd) in C:
    if hd is None:
        nb=P[tr.query_ball_point((E,N),12)]
        if len(nb)>=3: q=nb-nb.mean(0); w,v=np.linalg.eigh(q.T@q); hd=float(np.arctan2(v[1,1],v[0,1]))+np.pi/2
        else: hd=0.0
    gz=float(np.asarray(dtm[int((NN1-N)/NR),int((E-NE0)/NR)]))
    cars.append([round(float(E),1),round(float(N),1),round(gz,2),round(hd+(np.pi if rng.random()<0.5 else 0.0),2),int(rng.integers(0,8))])
A['cars']=cars; json.dump(A,open(f'{OUT}/airport.json','w'),separators=(',',':'))
print('cars',len(cars))
