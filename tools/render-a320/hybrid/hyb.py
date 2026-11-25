import sys,os,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0,os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'))
import shellbin, warp, fgcomp
OCCF=os.environ.get('OCC','occ.npy')
STRUCT=[139,70,94,193,60,61,7,140]          # lining, header ring, knobs+rods, bracket, ceiling lights, windshield top frame
def clip_tris(W,F,ob,t,sel,f):
    """keeps the part of the selected triangles where f(point)<=0 (f linear over each triangle); returns new W,F,ob,t"""
    W=list(map(np.array,W)); t=list(t); keepF=[F[i] for i in range(len(F)) if not sel[i]]; keepO=[ob[i] for i in range(len(F)) if not sel[i]]
    for i in np.nonzero(sel)[0]:
        ids=list(F[i]); val=[f(W[j]) for j in ids]
        if max(val)<=0: keepF.append(F[i]); keepO.append(ob[i]); continue
        if min(val)>0: continue
        out=[]
        for k in range(3):
            a,b=ids[k],ids[(k+1)%3]; va,vb=val[k],val[(k+1)%3]
            if va<=0: out.append(a)
            if (va<=0)!=(vb<=0):
                u=va/(va-vb); W.append(W[a]+u*(W[b]-W[a])); t.append(t[a]+u*(t[b]-t[a])); out.append(len(W)-1)
        for k in range(1,len(out)-1): keepF.append([out[0],out[k],out[k+1]]); keepO.append(ob[i])
    return np.array(W),np.array(keepF),np.array(keepO),np.array(t)
def ring_fit(W,F,ob,t):
    """The header ring's side beams are straight boxes from the windshield corner to the rear wall. Their aft ends stopped
    short of the page's rear wall with a slanted end (a pointed tip from the seats): run them 2-6 cm on, into the wall.
    Returns the lines of each beam's bottom face (for the reveal that joins it to the window tops)."""
    W=W.copy(); SIDE={}
    rv=np.unique(F[ob==70])
    for sg in (-1,1):
        m=rv[sg*W[rv,0]>0]; end=m[W[m,2]>1.2]; fr=m[(W[m,2]>0.03)&(W[m,2]<0.075)&(np.abs(W[m,0])>0.74)&(np.abs(W[m,0])<0.81)]
        u=W[end].mean(0)-W[fr].mean(0); u/=u[2]
        W[end]=W[end]+u[None]*(ZEND-W[end,2])[:,None]
        lowf=fr[W[fr,1]<W[fr,1].min()+0.006]; lowe=end[W[end,1]<W[end,1].min()+0.006]
        A=W[lowf[np.argmax(np.abs(W[lowf,0]))]]; C=W[lowf[np.argmin(np.abs(W[lowf,0]))]]; B=W[lowe[np.argmax(np.abs(W[lowe,0]))]]; D=W[lowe[np.argmin(np.abs(W[lowe,0]))]]
        SIDE[sg]=(A,B,C,D)
    # the windshield's top reveal (aeroplane shell.011) ran on past the corner post and ended ragged beside it: it ends where
    # the side beam's reveal takes over
    PHC=65.5; a=np.radians(PHC)             # on the corner post (it stands at 60..71 deg): the joint is hidden between the ring's corner block and the post top
    f=lambda p: abs(p[0])*np.cos(a)+(p[2]-warp.CZ)*np.sin(a)
    W,F,ob,t=clip_tris(W,F,ob,t,ob==7,f)
    SIDE['phc']=PHC
    return W,F,ob,t,SIDE
REV_Y=0.828                                 # height of the reveal = the level the structure is cut off at (window tops - 12 mm)
ZEND=1.275                                  # the beams end inside the rear wall
def roof_y(z): return 0.98+0.367*(z+0.29)+0.03   # just above the page's roof backstop (a320-3d.js: cy)
def blender_upper(fgR=None):
    d=np.load(os.environ['NEO_NPZ'],allow_pickle=True); V=d['v'].astype(float).copy(); V[:,0]*=-1; F=d['f']; ob=d['ob']; names=[str(n) for n in d['names']]
    extra=[i for i,n in enumerate(names) if n in ('BezierCurve.015','Cube.144')]
    m=np.isin(ob,STRUCT+extra); F=F[m]; ob=ob[m]
    used=np.unique(F); re=-np.ones(len(V),int); re[used]=np.arange(len(used)); V=V[used]; F=re[F]
    W,t=warp.warp(V)
    W,F,ob,t,SIDE=ring_fit(W,F,ob,t)
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
    # ---- between the beam and the window tops: the reveal (in the owner's model the outer shell does this: a level strip
    # from the beam's underside out to the window frame). The beam is straight and the page's window line bows out, so the
    # strip is up to 14 cm wide. Behind the aft window it runs on to the side wall. It lies exactly at the level the structure
    # is cut off at, so post tops and wall tops end in it without a joint; at the beam it steps up 5 mm into the beam.
    names.append('reveal'); REV=len(names)-1
    for sg in (-1,1):
        A,B,C,D=SIDE[sg]; n=161; s_=np.linspace(0,1,n)[:,None]
        Pin=(A+0.3*(C-A)+[0,0.002,0])[None]+s_*((B+0.3*(D-B))-(A+0.3*(C-A)))[None]       # 1 cm inside the beam's bottom face
        e=B-A; nrm=np.array([e[2],0,-e[0]]); nrm/=np.linalg.norm(nrm); nrm*=np.sign(nrm[0]*sg)   # outboard, level
        Ped=A[None]+s_*e[None]+0.004*nrm[None]                                           # just outside its outer bottom edge
        ax=np.abs(Ped[:,0]); ph=np.degrees(np.arctan2(ax,-(Ped[:,2]-warp.CZ))); rin=np.hypot(ax,Ped[:,2]-warp.CZ)
        # the corner block (in front of the straight beam, back to the joint on the corner post): rows from inside the block
        axi=np.abs(Pin[:,0]); rpi=np.hypot(axi,Pin[:,2]-warp.CZ); n0=len(np.arange(SIDE['phc'],ph[0]-0.2,0.5))
        ph0=np.arange(SIDE['phc'],ph[0]-0.2,0.5); d0=np.interp(SIDE['phc'],warp.PH,warp.OUT_F)-0.105    # under the middle of the block's bottom face (measured)
        r0=np.interp(ph0,[SIDE['phc'],ph[0]],[d0,rpi[0]]); a0=np.radians(ph0); w0=rin[0]-rpi[0]         # same two edges as along the beam, so the strip runs on without a fold
        Pi0=np.c_[sg*r0*np.sin(a0),np.zeros(n0),warp.CZ-r0*np.cos(a0)]; Pe0=np.c_[sg*(r0+w0)*np.sin(a0),np.zeros(n0),warp.CZ-(r0+w0)*np.cos(a0)]
        Ped=np.vstack([Pe0,Ped]); Pin=np.vstack([Pi0,Pin]); ph=np.concatenate([ph0,ph]); rin=np.concatenate([r0+w0,rin]); n=len(ph)
        yc=warp.top_F(ph)-0.012; Ped[:,1]=yc; Pin[:n0,1]=yc[:n0]+0.004
        ro=np.interp(ph,warp.PH,warp.OUT_S)+0.006; a=np.radians(ph); rad=np.c_[sg*np.sin(a),np.zeros(n),-np.cos(a)]
        if fgR is not None:      # where the structure stands at reveal height (rear frame of the aft window, the wall behind it): out to it
            o=np.c_[sg*(rin+0.02)*np.sin(a),yc-0.006,warp.CZ-(rin+0.02)*np.cos(a)]
            loc,ri,ti=fgR.intersects_location(o,rad,multiple_hits=True); hr=np.hypot(loc[:,0],loc[:,2]-warp.CZ); ok=hr<ro[ri]+0.30
            hit=np.zeros(n); np.maximum.at(hit,ri[ok],hr[ok])        # the farthest wall within reach (the left side has a stowage recess: its back wall)
            wall=(hit>0)&(Ped[:,2]>0.70); ro=np.where(wall,np.maximum(ro,hit+0.012),ro)
        ro=np.maximum(ro,rin+0.004); Pout=np.c_[sg*ro*np.sin(a),yc,warp.CZ-ro*np.cos(a)]
        base=len(W); q=[]
        for i in range(n-1): q+=[[i,i+1,n+i+1],[i,n+i+1,n+i],[n+i,n+i+1,2*n+i+1],[n+i,2*n+i+1,2*n+i]]
        W=np.vstack([W,Pin,Ped,Pout]); F=np.vstack([F,np.array(q)+base]); ob=np.concatenate([ob,np.full(len(q),REV)]); t=np.concatenate([t,np.ones(3*n)])
    # ---- on the window line, from the window tops up to the page's roof backstop: a closing wall behind the beam and the
    # lining. Nothing inside looks at it except through a joint between two lining parts, and there it shows dark lining.
    # (It stands exactly over the window tops, so no line of sight through a window can reach it.)
    names.append('closing'); CLO=len(names)-1
    ph=np.arange(52.0,131.01,0.5); ro=np.interp(ph,warp.PH,warp.OUT_S)+0.006; a=np.radians(ph); bx=ro*np.sin(a); bz=warp.CZ-ro*np.cos(a)
    yb=warp.top_F(ph)-0.012; nb=len(ph)
    for sg in (-1,1):
        base=len(W); Pb=np.vstack([np.c_[sg*bx,yb,bz],np.c_[sg*bx,roof_y(bz),bz]]); q=[]
        for i in range(nb-1): q+=[[i,i+1,nb+i+1],[i,nb+i+1,nb+i]]
        W=np.vstack([W,Pb]); F=np.vstack([F,np.array(q)+base]); ob=np.concatenate([ob,np.full(len(q),CLO)]); t=np.concatenate([t,np.ones(len(Pb))])
    used=np.unique(F); re=-np.ones(len(W),int); re[used]=np.arange(len(used)); W=W[used]; t=t[used]; F=re[F]
    return W,F,ob,t,names
ZONE=[None,None]
BOXES=[]   # (was: the rear frames of the aft windows cut away; they are the model's own, properly shaped frames and stay)
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
    zone=(rho>of-0.12)&(c[:,2]<1.20)&(phi>52)&~rm                 # round the side windows everything is cut off level at the
    ZONE[:]=[zone, warp.top_F(phi)-0.012]                          # reveal (build.py clips the faces there); also what stands further
                                                                   # out: seen through a window it showed above the window top
    thin=(hi[:,2]-lo[:,2]<0.012)&(lo[:,2]>1.255)&(hi[:,2]<1.285)&(lo[:,0]>0.08)&(hi[:,0]<1.12)&(lo[:,1]>0.5)&(hi[:,1]<1.37)&(hi[:,1]-lo[:,1]<0.06)
    print('breaker-wall strips removed',int(thin.sum())); rm|=thin[lab]
    return h,g,V,F,lab,rm,big
def fg_tracer(V,Ff,rm):
    import trimesh
    return trimesh.ray.ray_pyembree.RayMeshIntersector(trimesh.Trimesh(V,Ff[~rm],process=False))
if __name__=='__main__':
    h,g,V,Ff,lab,rm,big=fg_keep(); W,F,ob,t,names=blender_upper(fg_tracer(V,Ff,rm))
    print('blender upper faces',len(F),'verts',len(W),'FG faces removed',rm.sum(),'of',len(Ff),'ceiling comp',big)
    np.savez('pre_bl.npz',v=W,f=F,ob=ob); np.savez('pre_fg.npz',v=V,f=Ff[~rm],ob=np.zeros((~rm).sum(),int))
