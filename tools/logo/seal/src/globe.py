import numpy as np, json, math, pathops
from scipy import ndimage as ndi
X0,Y0,R0,r1,r2,r3=map(float,open('seal_geo2.txt').read().split()); U=100/R0
S=np.load('globe_skel.npy'); dt=np.load('globe_dt.npy')
# skeleton points with their local width (units)
xs=(S[:,0]/U+X0).astype(int); ys=(S[:,1]/U+Y0).astype(int); WID=dt[ys,xs]*2*U
rr=np.hypot(S[:,0],S[:,1]); keep=rr<80.5; S=S[keep]; WID=WID[keep]   # drops the slivers of the ring
GUIDES={'UP':[(-46,-65),(-25,-61),(0,-57),(25,-55.5),(54,-56)],'UL':[(-36,-47),(-24,-64),(-10,-79)],'UC':[(-1,-38),(3,-60),(7,-84)],'UR':[(24,-77),(36,-60),(43,-38)],
        'LP':[(-26,55),(0,56),(25,56.5),(54,57)],'LL':[(-30,62),(-22,70),(-14,77)],'LC':[(0,43),(3,63),(7,84)],'LR':[(44,32),(37,57),(25,76)]}
def nearest_param(P,guide):
    g=np.array(guide,float); seg=np.diff(g,axis=0); L=np.r_[0,np.cumsum(np.hypot(*seg.T))]
    best=np.full(len(P),1e9); par=np.zeros(len(P))
    for i,(a,s) in enumerate(zip(g[:-1],seg)):
        t=np.clip(((P-a)@s)/(s@s),0,1); q=a+t[:,None]*s; d=np.hypot(*(P-q).T); m=d<best; best[m]=d[m]; par[m]=L[i]+t[m]*np.hypot(*s)
    return best,par/L[-1]
def fit_cubic(P,t):
    # least-squares cubic Bezier through ordered points with parameters t (endpoints free)
    B=np.c_[(1-t)**3,3*t*(1-t)**2,3*t**2*(1-t),t**3]; C,*_=np.linalg.lstsq(B,P,rcond=None); return C
def bez(C,t): t=np.asarray(t)[:,None]; return (1-t)**3*C[0]+3*t*(1-t)**2*C[1]+3*t**2*(1-t)*C[2]+t**3*C[3]
def dbez(C,t): t=np.asarray(t)[:,None]; return 3*(1-t)**2*(C[1]-C[0])+6*(1-t)*t*(C[2]-C[1])+3*t**2*(C[3]-C[2])
out={}
for k,g in GUIDES.items():
    d,par=nearest_param(S,g); sel=d<3.0; P=S[sel]; t=par[sel]; w=WID[sel]
    o=np.argsort(t); P,t,w=P[o],t[o],w[o]
    # re-parameterise by arc length along the points, then fit
    # (chord length of the sorted points, smoothed)
    C=fit_cubic(P,(t-t.min())/(t.max()-t.min()))
    for _ in range(3):   # refine parameters: project points onto the curve
        tt=np.linspace(0,1,400); Q=bez(C,tt); t=np.array([tt[np.argmin(np.hypot(*(Q-p).T))] for p in P]); C=fit_cubic(P,t)
    for _ in range(2):   # robust: drop points far from the curve (spurs at the crossings), refit
        Q=bez(C,np.linspace(0,1,800)); dd=np.min(np.hypot(*(Q[:,None,:]-P[None,:,:]).transpose(2,0,1)),axis=0); ok=dd<max(0.6,np.percentile(dd,80))
        P,w=P[ok],w[ok]; tt=np.linspace(0,1,400); Qt=bez(C,tt); t=np.array([tt[np.argmin(np.hypot(*(Qt-p).T))] for p in P]); C=fit_cubic(P,t)
    res=np.sqrt(np.mean(np.min(np.hypot(*(bez(C,np.linspace(0,1,600))[:,None,:]-P[None,:,:]).transpose(2,0,1)),axis=0)**2))
    wmax=float(np.percentile(w,85))
    out[k]={'C':C.tolist(),'w':wmax}
    print(k,'pts',len(P),'rms',round(float(res),3),'width',round(wmax,2))
json.dump(out,open('globe_fit.json','w'))
