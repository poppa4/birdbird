# ENTO airport: pavement/centreline SDF texture, buildings (chart footprints + lidar houses), lights (AIP AD 2.14 + ADC notes).
import numpy as np, json, math
from PIL import Image, ImageDraw
from scipy import ndimage as nd
from shapely.geometry import Polygon, LineString, MultiPolygon
from shapely.ops import unary_union
import cv2
from chart import drawings, key, polys, to_local
from geo import dms, ll_to_local
OUT='/home/claude/birdbird/world/ento'
FT=0.3048
# --- runway (AIP AD 2.12): THR35 = origin, THR17 ---
T35=np.array([0.0,0.0]); T17=np.array(ll_to_local(dms(10,15,30.13),dms(59,11,51.69)))
U=(T17-T35)/np.linalg.norm(T17-T35); V=np.array([U[1],-U[0]])           # V = right of RWY 35 direction (east-ish)
LTHR=float(np.linalg.norm(T17-T35))                                      # 2449.5 m between thresholds
S0=-220.6; S1=LTHR+140.0; WID=45.0                                       # paved: 221 m south of THR35, 140 m north of THR17
dtm=np.load('loc_near_dtm.npy',mmap_mode='r'); dom=np.load('loc_near_dom.npy',mmap_mode='r')
NE0,NN1,NR=-4000.0,7000.0,2.0
def hat(E,N):
    c=(np.asarray(E)-NE0)/NR; r=(NN1-np.asarray(N))/NR
    return nd.map_coordinates(np.asarray(dtm),[np.atleast_1d(r),np.atleast_1d(c)],order=1)
def pt(s,t): return T35+U*s+V*t
# --- chart layers ---
dr=drawings()
def layer(keys,legend=True):
    out=[]
    for dd in dr:
        if key(dd) not in keys: continue
        if legend and dd['rect'].x0>680 and dd['rect'].y0>975: continue
        for pl in polys(dd):
            if len(pl)>=3:
                p=Polygon(to_local(pl)).buffer(0)
                if p.area>1: out.append(p)
    return out
TWY=layer([('f',(0.61,0.61,0.61),0),('f',(0.75,0.75,0.75),0)])
TWC=layer([('f',(0.61,0.61,0.61),0)])
APR=layer([('f',(0.88,0.88,0.88),0)])
BLD=layer([('f',(0.43,0.64,0.71),0)])
rwy=Polygon([pt(S0,-WID/2),pt(S1,-WID/2),pt(S1,WID/2),pt(S0,WID/2)])
pave=unary_union(TWY+APR).difference(rwy.buffer(0.5))
apron=unary_union(APR)
# --- SDF texture over the airport box ---
AE0,AE1,AN0,AN1,AR=-760.0,560.0,-480.0,2840.0,1.0
W=int((AE1-AE0)/AR); H=int((AN1-AN0)/AR)
def raster(geom,width=0):
    im=Image.new('L',(W,H),0); g=ImageDraw.Draw(im)
    gs=geom.geoms if hasattr(geom,'geoms') else [geom]
    for p in gs:
        if p.is_empty: continue
        if p.geom_type=='Polygon':
            g.polygon([((x-AE0)/AR,(AN1-y)/AR) for x,y in p.exterior.coords],fill=255)
            for h in p.interiors: g.polygon([((x-AE0)/AR,(AN1-y)/AR) for x,y in h.coords],fill=0)
        else:
            g.line([((x-AE0)/AR,(AN1-y)/AR) for x,y in p.coords],fill=255,width=max(1,int(width/AR)))
    return np.asarray(im)>127
def sdf(mask,scale):   # signed distance in metres (positive inside), encoded 128 + d*scale
    di=nd.distance_transform_edt(mask)*AR; do=nd.distance_transform_edt(~mask)*AR
    d=np.where(mask,di-0.5*AR,-(do-0.5*AR))
    return np.clip(np.round(128+d*scale),0,255).astype(np.uint8)
pm=raster(pave)
# taxiway centrelines: skeleton of taxiway pavement (not aprons), cleaned
tw=raster(unary_union(TWC).difference(rwy.buffer(1)))
sk=cv2.ximgproc.thinning((nd.binary_opening(tw,iterations=3)*255).astype(np.uint8)) if hasattr(cv2,'ximgproc') else None
if sk is None:
    from skimage.morphology import skeletonize
    sk=skeletonize(nd.binary_opening(tw,iterations=3))
else: sk=sk>0
# drop short spurs: keep skeleton pixels far enough from pavement edge (centre of taxiways >= 7 m from edge)
edt=nd.distance_transform_edt(tw)*AR
cl=sk&(edt>4.0)
cl=nd.binary_dilation(cl,iterations=0) if False else cl
lab,n=nd.label(cl,structure=np.ones((3,3)))
sz=nd.sum(cl,lab,range(1,n+1)); keep=np.zeros(n+1,bool); keep[1:]=sz>25; cl=keep[lab]
dcl=nd.distance_transform_edt(~cl)*AR
G=np.clip(np.round(dcl*40),0,255).astype(np.uint8)         # centreline distance 0..6.4 m
img=np.dstack([sdf(pm,16),G,(raster(apron)*255).astype(np.uint8)])
Image.fromarray(img).save(f'{OUT}/apt.png',optimize=True)
print('apt.png',img.shape)
# --- buildings ---
B=[]
def gable(poly_xy,base,eave,ridge):
    P=np.array(poly_xy,np.float32)
    rect=cv2.minAreaRect(P.astype(np.float32)); box=cv2.boxPoints(rect)
    B.append(dict(p=[[round(float(x),2),round(float(y),2)] for x,y in box],b=round(base,2),e=round(eave,2),r=round(ridge,2)))
def flatb(poly,base,top):
    xy=list(poly.exterior.coords)[:-1]
    B.append(dict(p=[[round(x,2),round(y,2)] for x,y in xy],b=round(base,2),e=round(top,2),r=round(top,2)))
can=np.asarray(dom)-np.asarray(dtm)
def stats(poly):
    x0,y0,x1,y1=poly.bounds; c0=int((x0-NE0)/NR); c1=int((x1-NE0)/NR)+1; r0=int((NN1-y1)/NR); r1=int((NN1-y0)/NR)+1
    sub=Image.new('L',(c1-c0,r1-r0),0); ImageDraw.Draw(sub).polygon([((x-NE0)/NR-c0,(NN1-y)/NR-r0) for x,y in poly.exterior.coords],fill=1)
    m=np.asarray(sub)>0
    cc=can[r0:r1,c0:c1][m]; gg=np.asarray(dtm)[r0:r1,c0:c1][m]
    return cc,gg
for p in BLD:
    if p.area<25: continue
    cc,gg=stats(p)
    if len(cc)<3: continue
    top=float(np.clip(np.percentile(cc,80),3,35)); base=float(np.min(gg))
    flatb(p.simplify(0.4),base-0.3,base+top)
chart_b=unary_union(BLD).buffer(3)
# lidar houses within 3.5 km of the runway (not inside the chart footprints)
nb=json.load(open('near_bld_components.json')) if False else None
import ground
r0=int((NN1-(S1+3500))/NR); r1=int((NN1-(S0-3500))/NR); c0=int((-3500-NE0)/NR); c1=int((3500-NE0)/NR)
d=np.asarray(dtm)[r0:r1,c0:c1].copy(); o=np.asarray(dom)[r0:r1,c0:c1].copy()
col,cn,cls=ground.build(d,o,NR,NE0+c0*NR,NN1-r0*NR,seed=1,near=True)
lab,n=nd.label(cls['bld'])
objs=nd.find_objects(lab)
nh=0
for i,sl in enumerate(objs):
    m=lab[sl]==i+1
    if m.sum()*NR*NR<30: continue
    ys,xs=np.nonzero(m); E=NE0+(c0+sl[1].start+xs)*NR+NR/2; N=NN1-(r0+sl[0].start+ys)*NR-NR/2
    if chart_b.contains(Polygon([(E.mean()-1,N.mean()-1),(E.mean()+1,N.mean()-1),(E.mean()+1,N.mean()+1)])): continue
    if pave.buffer(4).contains(Polygon([(E.mean()-1,N.mean()-1),(E.mean()+1,N.mean()-1),(E.mean()+1,N.mean()+1)])): continue
    cc=cn[sl][m]; gg=d[sl][m]
    ridge=float(np.clip(np.percentile(cc,95),2.5,20)); base=float(np.min(gg))
    area=m.sum()*NR*NR
    pts=np.stack([E,N],1)
    hull=cv2.convexHull(pts.astype(np.float32)).reshape(-1,2)
    if area>900:   # large: flat roof (barns, blocks)
        top=float(np.clip(np.percentile(cc,70),3,25)); gable(hull,base-0.3,base+top,base+top)
    else:
        gable(hull,base-0.3,base+ridge*0.66,base+ridge)
    nh+=1
print('buildings chart',len(BLD),'lidar',nh,'total',len(B))
# --- lights (AIP AD 2.14 + ADC remarks) ---
L=[]   # E,N,h, r,g,b, dirx,diry (0,0 = omni), spread(deg), size, kind(0 steady,1 flash seq,2 papi), seq/param
WHITE=(1.0,0.96,0.86); YEL=(1.0,0.78,0.30); RED=(1.0,0.12,0.06); GRN=(0.25,1.0,0.45); BLUE=(0.25,0.45,1.0)
def add(p,c,d=(0,0),spread=180,size=1.0,kind=0,par=0.0,dz=0.35):
    p=np.asarray(p,float); h=float(hat(p[0],p[1])[0])+dz
    L.append([round(float(p[0]),2),round(float(p[1]),2),round(h,2),*[round(float(x),3) for x in c],round(float(d[0]),4),round(float(d[1]),4),float(spread),float(size),int(kind),round(float(par),3)])
D35=U; D17=-U                      # direction of travel when landing on 35 / 17 (lights face the approaching aircraft: -travel)
# threshold arrangement for a runway end: landing direction dirv, threshold point thr (s coordinate), pavement end behind
def runway_end(s_thr,dirv,sign):
    # sign=+1 for RWY35 (travel +U); lights shine towards approaching aircraft (opposite travel)
    face=-dirv
    for t in np.arange(-WID/2+1.5,WID/2-1.4,3.0): add(pt(s_thr,t),GRN,face,30,1.0)
    for side in (-1,1):                                   # wing bars: 5 lights each side, outward from the edge
        for k in range(5): add(pt(s_thr,side*(WID/2+3+k*3)),GRN,face,30,1.2)
for s,dirv,sign in ((0.0,D35,1),(LTHR,D17,-1)): runway_end(s,dirv,sign)
# runway end lights (red) at the pavement ends, facing the landing/take-off roll
for t in np.arange(-WID/2+1.5,WID/2-1.4,3.0):
    add(pt(S1,t),RED,-D35,60,1.0)     # seen by aircraft rolling north on RWY 35 (light faces south)
    add(pt(S0,t),RED,-D17,60,1.0)
for side in (-1,1):
    for k in range(4): add(pt(S1,side*(WID/2+3+k*3)),RED,-D35,60,1.0); add(pt(S0,side*(WID/2+3+k*3)),RED,-D17,60,1.0)
# edge lights: 60 m spacing, white, last 600 m yellow (per direction), bidirectional
def along(s_from,s_to,step):
    n=int(np.floor(abs(s_to-s_from)/step+1e-6)); return [s_from+np.sign(s_to-s_from)*k*step for k in range(n+1)]
for s in along(0.0,LTHR,60.0):
    for side in (-1,1):
        p=pt(s,side*(WID/2+1.0))
        add(p,YEL if s>LTHR-600 else WHITE,-D35,90,0.9)   # seen landing 35 (aircraft looks north; light faces south = -D35)
        add(p,YEL if s<600 else WHITE,-D17,90,0.9)
# centreline lights 15 m: white; last 900 m alternate red/white (600 m), last 300 m red
for i,s in enumerate(along(7.5,LTHR-7.5,15.0)):
    p=pt(s,0.0); rem35=LTHR-s; rem17=s
    def cc(rem,i): return RED if rem<300 else ((RED if i%2 else WHITE) if rem<900 else WHITE)
    add(p,cc(rem35,i),-D35,40,0.7,dz=0.08); add(p,cc(rem17,i),-D17,40,0.7,dz=0.08)
# TDZ lights RWY 17: 900 m, barrettes of 3 each side every 60 m starting 60 m past THR
for d in np.arange(60,901,60):
    s=LTHR-d
    for side in (-1,1):
        for k in range(3): add(pt(s,side*(9.0+k*1.5)),WHITE,-D17,40,0.7,dz=0.08)
# approach lights. RWY 17 (approach from north, beyond THR17 at s>LTHR): CL barrettes every 30 m to 900 m,
# crossbars at 150/300/450/600/750, SFL 900..180, CAT II side rows 60..240 every 60 m (red)
def approach(s_thr,outward,length,sfl_from,sfl_to,catII):
    face=-outward*-1   # lights face the approaching aircraft, which is further out along 'outward'
    face=outward
    n=0
    for d in np.arange(30,length+1,30):
        s=s_thr+outward_s*d
        for k in (-2,-1,0,1,2): add(pt(s,k*1.05),WHITE,face,25,1.1,dz=1.0 if d>180 else 0.2)
        if sfl_to<=d<=sfl_from:
            add(pt(s,0),(1,1,1),face,25,1.8,kind=1,par=d,dz=1.4)
        if d in (150,300,450,600,750):
            half={150:9,300:15,450:18,600:21,750:24}[d]
            for t in np.arange(4.0,half+0.1,1.5): add(pt(s,t),WHITE,face,25,1.0,dz=1.0); add(pt(s,-t),WHITE,face,25,1.0,dz=1.0)
        if catII and 60<=d<=240 and d%60==0:
            for side in (-1,1):
                for k in range(3): add(pt(s,side*(9.0+k*1.5)),RED,face,25,1.0,dz=0.3)
outward_s=+1; approach(LTHR,D35,900,900,180,True)     # RWY 17 approach lights north of THR17, facing north (towards arrivals)
outward_s=-1; approach(0.0,D17,780,780,300,False)     # RWY 35 approach lights south of THR35, facing south
# PAPI: left side, 4 units, 3.0 deg; distance from threshold from MEHT (eye height at lowest on-slope angle 2deg50')
def papi(s_thr,inward_s,meht_ft,face):
    elev_thr=float(hat(*pt(s_thr,0))[0])
    dist=meht_ft*FT/math.tan(math.radians(2+50/60))
    s=s_thr+inward_s*dist
    # left side relative to landing direction: landing 35 (travel +U) left = -V ; landing 17 left = +V
    side=-1 if inward_s>0 else 1
    angs=[3.5,3+10/60,2+50/60,2.5]   # nearest the runway highest
    for k,a in enumerate(angs):
        add(pt(s,side*(WID/2+15+k*9)),(1,1,1),face,30,1.6,kind=2,par=a,dz=0.6)
    return s
p35=papi(0.0,+1,53,-D35); p17=papi(LTHR,-1,51,-D17)
print('papi s',round(p35,1),round(p17,1))
# taxiway edge lights: blue omni along taxiway pavement edges every 30 m (not along aprons)
tpoly=unary_union(TWY).difference(rwy.buffer(3)).difference(apron.buffer(2))
edges=tpoly.boundary
gs=edges.geoms if hasattr(edges,'geoms') else [edges]
nt=0
for g in gs:
    Lg=g.length
    for d in np.arange(0,Lg,30.0):
        q=g.interpolate(d); add((q.x,q.y),BLUE,(0,0),180,0.6,dz=0.3); nt+=1
print('lights',len(L),'taxi',nt)
meta=dict(thr35=[0,0],thr17=[round(float(T17[0]),3),round(float(T17[1]),3)],u=[float(U[0]),float(U[1])],s0=S0,s1=S1,width=WID,lthr=LTHR,
          elev35=round(float(hat(0,0)[0]),2),elev17=round(float(hat(*T17)[0]),2),papi=[round(p35,1),round(p17,1)],
          sdf=dict(E0=AE0,N1=AN1,w=W,h=H,res=AR),aiming=400.0)
# runway centreline profile (for smooth runway surface & aircraft): every 10 m from s0 to s1
ss=np.arange(S0,S1+0.1,10.0); prof=hat(*np.array([pt(s,0) for s in ss]).T)
prof=nd.gaussian_filter1d(prof,1.0)
meta['profile']=dict(s0=S0,step=10.0,h=[round(float(x),2) for x in prof])
json.dump(dict(rwy=meta,buildings=B,lights=L),open(f'{OUT}/airport.json','w'),separators=(',',':'))
print('elev', meta['elev35'], meta['elev17'], 'AIP 255/282 ft =',255*FT,282.1*FT)
