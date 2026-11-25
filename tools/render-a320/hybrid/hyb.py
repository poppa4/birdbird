import sys,os,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'))
import shellbin, warp, fgcomp
OCCF=os.environ.get('OCC','occ.npy')
STRUCT=[139,70,94,193,60,61,7,140]          # lining, header ring, knobs+rods, bracket, ceiling lights, windshield top frame
def blender_upper():
    d=np.load(os.environ['NEO_NPZ'],allow_pickle=True); V=d['v'].astype(float).copy(); V[:,0]*=-1; F=d['f']; ob=d['ob']; names=[str(n) for n in d['names']]
    extra=[i for i,n in enumerate(names) if n in ('BezierCurve.015','Cube.144')]
    m=np.isin(ob,STRUCT+extra); F=F[m]; ob=ob[m]
    used=np.unique(F); re=-np.ones(len(V),int); re[used]=np.arange(len(used)); V=V[used]; F=re[F]
    W,t=warp.warp(V)
    # trim panels in the overhead's plane wherever the page's overhead panel does not reach the border the lining was fitted to:
    # its chamfered front corners, the strip in front of its front edge and the notches at its aft corners (the Blender model's
    # own overhead housing closes these; the page's panel has none). Not where the panel is, not where a part of the new shell
    # lies above (the trim would hang in front of it), not beyond the windshield line.
    import trimesh, json
    R=trimesh.ray.ray_pyembree.RayMeshIntersector(trimesh.Trimesh(W,F,process=False))
    occ=np.load(OCCF); tg=np.load(OCCF+'.tags.npy'); nm=json.load(open(OCCF+'.names.json'))
    c=occ.mean(1); pan=(np.abs(c[:,1]-warp.ovh_y_F(c[:,2]))<0.08)&(np.abs(c[:,0])<0.4)&(c[:,2]>-0.3)&(c[:,2]<1.05)
    oV=occ[pan].reshape(-1,3); Ro=trimesh.ray.ray_pyembree.RayMeshIntersector(trimesh.Trimesh(oV,np.arange(len(oV)).reshape(-1,3),process=False))
    xs=np.arange(-0.50,0.501,0.0125); zs=np.arange(-0.36,1.0201,0.0125); X,Z=np.meshgrid(xs,zs); Y=warp.ovh_y_F(Z)+0.006   # just behind the panel pictures: it may run in under the panel
    Pp=np.c_[X.ravel(),Y.ravel(),Z.ravel()]; region=(Pp[:,2]<-0.11)|((Pp[:,2]>0.84)&(np.abs(Pp[:,0])>0.28)&(np.abs(Pp[:,0])<=0.345))
    up=np.tile([0,1.,0],(len(Pp),1))
    loc,ri,ti=R.intersects_location(Pp+[0,0.002,0],up,multiple_hits=False); below=np.zeros(len(Pp),bool); below[ri]=((loc[:,1]-Pp[ri,1])<0.25)&((loc[:,1]-Pp[ri,1])>0.015)
    haspan=np.zeros(len(Pp),bool)
    for dy0,dr in ((-0.06,1.),(0.06,-1.)):
        loc,ri,ti=Ro.intersects_location(Pp+[0,dy0,0],up*dr,multiple_hits=False); haspan[ri]|=np.abs(loc[:,1]-Pp[ri,1])<0.06
    rho=np.hypot(np.abs(Pp[:,0]),Pp[:,2]-warp.CZ); phi=np.degrees(np.arctan2(np.abs(Pp[:,0]),-(Pp[:,2]-warp.CZ))); inside=rho<np.interp(phi,warp.PH,warp.OUT_F)-0.012
    okv=region&(~below)&inside; nx=len(xs); q=[]
    for j in range(len(zs)-1):
        for i in range(nx-1):
            a_=j*nx+i; c4=[a_,a_+1,a_+nx+1,a_+nx]
            if okv[c4].all(): q+=[[c4[0],c4[1],c4[2]],[c4[0],c4[2],c4[3]]]
    q=np.array(q)+len(W); print('trim panel faces',len(q)); W=np.vstack([W,Pp]); F=np.vstack([F,q]); ob=np.concatenate([ob,np.full(len(q),139)]); t=np.concatenate([t,np.zeros(len(Pp))])
    # the wall above the side-window tops, behind the header ring: one clean upright band on the window line (the FlightGear
    # pieces there were cut off by the ring and left a jagged edge); from the windshield corner back to the rear wall
    ph=np.arange(52.0,131.01,1.0); ro=np.interp(ph,warp.PH,warp.OUT_F)+0.006; a=np.radians(ph); bx=ro*np.sin(a); bz=warp.CZ-ro*np.cos(a)
    yb=warp.top_F(ph)-0.012; nb=len(ph)
    for sg in (-1,1):
        base=len(W); Pb=np.vstack([np.c_[sg*bx,yb,bz],np.c_[sg*bx,np.full(nb,0.945),bz]]); q=[]
        for i in range(nb-1): q+=[[i,i+1,nb+i+1],[i,nb+i+1,nb+i]]
        W=np.vstack([W,Pb]); F=np.vstack([F,np.array(q)+base]); ob=np.concatenate([ob,np.full(len(q),70)]); t=np.concatenate([t,np.ones(len(Pb))])
    used=np.unique(F); re=-np.ones(len(W),int); re[used]=np.arange(len(used)); W=W[used]; t=t[used]; F=re[F]
    return W,F,ob,t,names
ZONE=[None,None]
BOXES=[((1.12,9.0),(0.36,0.93),(0.76,1.06)),((-9.0,-1.12),(0.36,0.93),(0.76,1.06))]   # x, y, z ranges cut out of the FlightGear structure
def fg_keep():
    h,g,V,F,lab,n=fgcomp.comps(os.environ['FG_SHELL']); c=V[F].mean(1)
    lo=np.full((n,3),9.);hi=np.full((n,3),-9.); np.minimum.at(lo,lab,V[F].min(1)); np.maximum.at(hi,lab,V[F].max(1))
    ctr=(lo+hi)/2; axmax=np.maximum(np.abs(lo[:,0]),np.abs(hi[:,0]))
    rm_comp=(lo[:,1]>0.775)&(axmax>0.36)&((hi[:,2]<1.24)|(lo[:,2]<1.0))       # header pieces, rails, loose bits above the window tops
    big=np.argmax(np.bincount(lab[(c[:,1]>1.0)&(np.abs(c[:,0])>0.5)&(c[:,2]<1.0)]))   # the ceiling lining
    rm=rm_comp[lab] | ((lab==big)&(c[:,2]<1.27))
    # small parts that hung on the old windshield beam, in front of the overhead's front edge: loose in the air now
    cnt=np.bincount(lab,minlength=n); fl=(lo[:,1]>0.74)&(hi[:,2]<-0.15)&~((lo[:,1]>0.885)&(lo[:,2]>-0.20))
    rm|=fl[lab]
    # tops of the window posts and walls above the window-top line: inside the new header ring (they showed as shards at its corners)
    ax=np.abs(c[:,0]); rho=np.hypot(ax,c[:,2]-warp.CZ); phi=np.degrees(np.arctan2(ax,-(c[:,2]-warp.CZ)))
    of=np.interp(phi,warp.PH,warp.OUT_F)
    # the wall pieces that stand out beyond the rear part of the aft side window (slanted, further out than the window): they
    # showed through the window as fins; the page's own rear frame and wall close that corner
    # (cut out with straight edges in build.py: BOXES)
    zone=(rho>of-0.12)&(rho<of+0.02)&(c[:,2]<1.20)&(phi>52)&~rm   # round the side windows everything is cut off level at the
    ZONE[:]=[zone, warp.top_F(phi)-0.012]                          # ring's underside (build.py clips the faces there)
    thin=(hi[:,2]-lo[:,2]<0.012)&(lo[:,2]>1.255)&(hi[:,2]<1.285)&(lo[:,0]>0.08)&(hi[:,0]<1.12)&(lo[:,1]>0.5)&(hi[:,1]<1.37)&(hi[:,1]-lo[:,1]<0.06)
    print('breaker-wall strips removed',int(thin.sum())); rm|=thin[lab]
    return h,g,V,F,lab,rm,big
if __name__=='__main__':
    W,F,ob,t,names=blender_upper(); h,g,V,Ff,lab,rm,big=fg_keep()
    print('blender upper faces',len(F),'verts',len(W),'FG faces removed',rm.sum(),'of',len(Ff),'ceiling comp',big)
    np.savez('pre_bl.npz',v=W,f=F,ob=ob); np.savez('pre_fg.npz',v=V,f=Ff[~rm],ob=np.zeros((~rm).sum(),int))
