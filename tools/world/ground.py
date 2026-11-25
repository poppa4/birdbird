# Builds ground data for one level: classes, albedo, heights. All inputs in the local frame (rows north->south).
import numpy as np
from scipy import ndimage as nd
R=np.random.default_rng(7)
def vnoise(shape,cell,seed):
    r=np.random.default_rng(seed); gh=shape[0]//cell+3; gw=shape[1]//cell+3
    g=r.random((gh,gw)).astype(np.float32)
    y=np.arange(shape[0])/cell; x=np.arange(shape[1])/cell
    out=np.empty(shape,np.float32)
    for r0 in range(0,shape[0],1000):
        Y,X=np.meshgrid(y[r0:r0+1000],x,indexing='ij'); out[r0:r0+1000]=nd.map_coordinates(g,[Y,X],order=3,mode='reflect')
    return out
def fbm(shape,cell,seed,oct=4):
    s=np.zeros(shape,np.float32); a=1; t=0
    for i in range(oct):
        c=max(1,int(cell/2**i)); s+=a*vnoise(shape,c,seed+i); t+=a; a*=0.5
    return s/t
def lakes(h,dom,res):
    gy,gx=np.gradient(h,res); s=np.hypot(gx,gy); lap=np.abs(nd.laplace(h))*(8.0/res)**0   # planar facets
    k=max(1,int(round(24/res)))
    cand=(nd.maximum_filter(lap,3)<0.02*(res/8.0)**0.5)&(nd.maximum_filter(s,3)<0.01)&(h>0.5)&(np.abs(dom-h)<0.3)
    cand=nd.binary_closing(cand,iterations=2); cand=nd.binary_opening(cand,iterations=1)
    lab,n=nd.label(cand)
    if n==0: return cand
    sz=nd.sum(cand,lab,range(1,n+1)); keep=np.zeros(n+1,bool); keep[1:]=sz*res*res>30000
    return nd.binary_fill_holes(keep[lab])
def sea_mask(h):
    s=h<=0.4; lab,n=nd.label(s)
    if n==0: return s
    sz=nd.sum(s,lab,range(1,n+1)); keep=np.zeros(n+1,bool); keep[1:]=sz>2000
    return keep[lab]
def _h(a,b,c=0):
    h=(a*73856093)^(b*19349663)^(c*83492791); h=(h^(h>>13))*1274126177; return (h^(h>>16))&0xffffffff
def parcels(shape,res,E0,N1,seed,rows=500):
    # farmland: straight-edged blocks. Each 1.2 km region has its own orientation and block size, so field edges are
    # straight within a region; the region border is jittered so it does not read as a grid. World-anchored.
    RC=1200.0; out=np.zeros(shape,np.int64); xs=E0+np.arange(shape[1])*res
    for r0 in range(0,shape[0],rows):
        ys=N1-np.arange(r0,min(shape[0],r0+rows))*res; X,Y=np.meshgrid(xs,ys)
        jx=X+90*np.sin(Y/310.0)+60*np.sin(Y/97.0); jy=Y+90*np.sin(X/290.0)+60*np.sin(X/113.0)
        ri=np.floor(jx/RC).astype(np.int64); rj=np.floor(jy/RC).astype(np.int64); rh=_h(ri,rj,seed)
        ang=(rh&0x3ff)/1023.0*np.pi; w=60+((rh>>10)&0xff)/255.0*110; l=w*(1.6+((rh>>18)&0x3f)/63.0*1.8)
        u=X*np.cos(ang)+Y*np.sin(ang); v=-X*np.sin(ang)+Y*np.cos(ang)
        bi=np.floor(u/w).astype(np.int64); bj=np.floor((v+ (bi%3)*l*0.37)/l).astype(np.int64)
        out[r0:r0+rows]=_h(bi,bj,rh)
    return out
FIELD=np.array([(92,114,56),(102,120,60),(86,106,52),(110,124,64),(98,118,58),(124,126,74),(134,130,86),(108,100,72),(94,112,60),(116,122,68)],np.float32)
ROOF=np.array([(74,74,76),(96,62,52),(120,120,118),(62,64,68),(108,78,64)],np.float32)
S2K=np.array([0.787,1.13,0.64],np.float32); S2G=np.array([0.574,0.736,0.575],np.float32)
def s2grade(s2):   # Sentinel-2 TCI -> NORDAP albedo (fitted on forest and fields around Torp)
    return 255.0*S2K*np.power(np.clip(s2.astype(np.float32),0.5,255)/255.0,S2G)
def build(h,dom,res,E0,N1,seed=1,near=False,nanmask=None,s2=None):
    h=np.where(np.isnan(h),0,h).astype(np.float32)
    dom=np.where(np.isnan(dom),h,dom).astype(np.float32)
    c=np.clip(dom-h,0,45)
    sea=sea_mask(h); lake=lakes(h,dom,res)&~sea; water=sea|lake
    gy,gx=np.gradient(h,res); slope=np.hypot(gx,gy)
    # forest
    if res<=3:
        fr=nd.uniform_filter((c>3).astype(np.float32),int(7/res)|1)
        forest=(fr>0.35)
    else:
        forest=c>(2.0 if res<=10 else 1.4)
    forest&=~water
    # buildings (fine levels only): tall but planar
    bld=np.zeros_like(forest)
    if res<=3:
        rough=nd.generic_filter(dom,np.std,size=3) if False else np.sqrt(np.maximum(nd.uniform_filter(dom*dom,3)-nd.uniform_filter(dom,3)**2,0))
        lapd=np.abs(nd.laplace(dom))
        cand=(c>2.4)&(nd.uniform_filter(lapd,3)<0.35)&~water
        cand=nd.binary_opening(cand,iterations=1)
        lab,n=nd.label(cand)
        if n:
            sz=nd.sum(cand,lab,range(1,n+1))*res*res; keep=np.zeros(n+1,bool); keep[1:]=(sz>40)&(sz<25000)
            bld=keep[lab]
        forest&=~nd.binary_dilation(bld,iterations=1)
        bid=lab
    open_=~forest&~water&~bld
    # rock: steep, or rough coastal outcrops
    hr=h-nd.gaussian_filter(h,max(1,6/res))
    rough_t=np.sqrt(np.maximum(0,nd.uniform_filter(hr*hr,max(3,int(12/res)|1))))
    nearsea=nd.distance_transform_edt(~sea)*res<180 if sea.any() else np.zeros_like(sea)
    rock=open_&((slope>0.55)|(nearsea&(rough_t>0.35))|((rough_t>0.9)&(c<0.5)))
    rock=nd.binary_opening(rock,iterations=1)&~nd.binary_dilation(forest,iterations=max(1,int(6/res)))
    field=open_&~rock&(slope<0.14)&(h<260)
    grass=open_&~rock&~field
    S=h.shape; col=np.zeros(S+(3,),np.float32)
    n1=fbm(S,max(2,int(400/res)),seed+11)-0.5; n2=fbm(S,max(2,int(40/res)),seed+12)-0.5; n3=R.random(S,dtype=np.float32)-0.5
    # forest: conifer base, deciduous patches, crown micro-relief
    dec=np.clip((fbm(S,max(2,int(600/res)),seed+13)-0.52)*6,0,1)
    fcol=np.array([34,48,30],np.float32)[None,None]*(1-dec[...,None])+np.array([56,72,38],np.float32)[None,None]*dec[...,None]
    crown=np.clip(1+0.10*(dom-nd.gaussian_filter(dom,max(0.7,2.5/res))),0.65,1.25) if res<=10 else 1.0
    fshade=(1+0.18*n1+0.10*n2+0.10*n3)*crown
    col[forest]=(fcol*fshade[...,None])[forest]
    # fields
    pid=parcels(S,res,E0,N1,seed+20)
    fc=FIELD[(pid>>3)%len(FIELD)]*(0.96+0.08*((pid>>11)&0xff)/255.0)[...,None]
    if near:
        # tractor rows: thin stripes along each parcel's direction
        stripe=np.empty(S,np.float32); xs=E0+np.arange(S[1])*res
        for r0 in range(0,S[0],500):
            ys=N1-np.arange(r0,min(S[0],r0+500))*res; X,Y=np.meshgrid(xs,ys); ang=((pid[r0:r0+500]>>7)&0x3ff)/1023.0*np.pi
            stripe[r0:r0+500]=0.94+0.06*np.sin((X*np.cos(ang)+Y*np.sin(ang))*2*np.pi/3.0)
        fc=fc*stripe[...,None]
    col[field]=(fc*(1+0.08*n1+0.06*n2+0.05*n3)[...,None])[field]
    col[grass]=(np.array([84,98,56],np.float32)*(1+0.14*n1+0.10*n2+0.06*n3)[...,None])[grass]
    rc=np.array([104,102,96],np.float32)*(1+0.10*n1+0.16*np.clip(hr,-1,1)+0.08*n3)[...,None]
    col[rock]=rc[rock]
    if res<=3 and bld.any():
        rcol=ROOF[(bid*7919)%len(ROOF)]
        edge=bld&~nd.binary_erosion(bld,iterations=1)
        rr=rcol*(1+0.05*n3)[...,None]; rr[edge]*=0.7
        col[bld]=rr[bld]
    # water base (the shader draws water; this is what it blends with at grazing angles / far mips)
    wd=np.clip(-h/25,0,1) if sea.any() else 0
    col[water]=(np.array([22,46,58],np.float32)*(1-0.3*wd)[...,None] if sea.any() else np.array([22,46,58],np.float32))[water] if sea.any() else np.array([22,46,58],np.float32)
    col[lake]=np.array([20,40,46],np.float32)
    # soft contact darkening at forest edges (open ground hugging a forest wall)
    fd=nd.gaussian_filter(forest.astype(np.float32),max(0.7,6/res))
    col[open_]*=(1-0.10*fd[open_])[...,None]
    # shoreline: thin lighter band (rock/sand) along water
    shore=nd.binary_dilation(water,iterations=max(1,int(3/res)))&~water&~forest
    col[shore]=col[shore]*0.6+np.array([132,126,110],np.float32)*0.4
    if nanmask is not None and nanmask.any():
        # outside Kartverket coverage (Sweden): no canopy data -> forest/field mix from noise
        fm=(fbm(S,max(2,int(1500/res)),seed+30)>0.47)&~water
        alt=np.where(fm[...,None],np.array([36,50,31],np.float32),np.array([98,108,62],np.float32))*(1+0.12*n1)[...,None]
        col[nanmask&~water]=alt[nanmask&~water]
        forest=np.where(nanmask,fm,forest)
    if s2 is not None:
        # real colours from the satellite; the lidar adds what 10 m pixels cannot show: tree crowns and roof edges
        g=s2grade(s2)
        det=np.ones(S,np.float32)
        if res<=10:
            cr=np.clip(1+0.11*(dom-nd.gaussian_filter(dom,max(0.7,2.5/res))),0.7,1.28)
            det=np.where(forest,cr,det)
        if res<=3 and bld.any():
            edge=bld&~nd.binary_erosion(bld,iterations=1); det[edge]*=0.72
        col=g*det[...,None]
    cls=dict(water=water,sea=sea,lake=lake,forest=forest,bld=bld,rock=rock,field=field)
    return np.clip(col,0,255),c*(forest|bld if False else forest),cls
