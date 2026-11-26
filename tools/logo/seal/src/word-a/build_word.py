import json, numpy as np
from scipy.optimize import least_squares
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely import affinity
G=json.load(open('oldgeo.json')); TOP,BOT=G['TOP'],G['BOT']; SW=300.0
m=np.load('m.npy')
# refit O inner with its measured extent
def runs(y,x0,x1):
    r=m[y,x0:x1].astype(int); d=np.diff(np.concatenate([[0],r,[0]])); s=np.where(d==1)[0]; e=np.where(d==-1)[0]; return [(a+x0,b+x0) for a,b in zip(s,e) if b-a>=3]
oi=[]
for y in range(508,1137,2):
    r=runs(y,4960,6300)
    if len(r)==2: oi+=[(y,r[0][1]),(y,r[1][0])]
a=np.array(oi,float); cy=(506+1138)/2; by=(1138-506)/2
def res(p):
    cx,ax,n,mm=p; t=np.clip(np.abs((a[:,0]-cy)/by),0,0.99999); return np.abs(a[:,1]-cx)-ax*(1-t**mm)**(1/n)
s=least_squares(res,[5627,355,2.5,2.5],bounds=([0,1,1.2,1.2],[1e5,1e4,12,12])); G['Oi']=[s.x[0],cy,s.x[1],by,s.x[2],s.x[3]]; print('O inner',G['Oi'],np.sqrt(np.mean(s.fun**2)))
def se(cx,cy,ax,by,n,mm,side=0,k=900):
    t=np.linspace(-np.pi/2,np.pi/2,k)
    yy=cy+by*np.sin(t); u=np.abs(np.sin(t)); xx=ax*(1-np.clip(u,0,1)**mm)**(1/n)
    R=list(zip(cx+xx,yy))
    if side==1: return R
    return R+list(zip(cx-xx[::-1],yy[::-1]))
def bowl(xl,cx,ax,n,mm,cy,by):
    half=se(cx,cy,ax,by,n,mm,side=1)
    return unary_union([box(xl,cy-by,cx,cy+by),Polygon(half+[(cx,cy+by),(cx,cy-by)]).buffer(0)])
L={}
# N
N=G['N']; sL0=N['sL'][0]; rR1=N['rS'][1]
lo=lambda y:N['lo'][0]*y+N['lo'][1]; up=lambda y:N['up'][0]*y+N['up'][1]
diag=Polygon([(lo(TOP-200),TOP-200),(up(TOP-200),TOP-200),(up(BOT+200),BOT+200),(lo(BOT+200),BOT+200)]).intersection(box(sL0,TOP,rR1,BOT))
L['N']=unary_union([box(sL0,TOP,sL0+SW,BOT),box(rR1-SW,TOP,rR1,BOT),diag])
# O
L['O']=Polygon(se(*G['Oo'])).difference(Polygon(se(*G['Oi'])))
# R
x0=G['Rstem'][0]; it,ib,bb=G['Rbars']; cx,ax,n,mm,cyo,byo=G['Ro']; ci,ai,ni,mi,cyi,byi=G['Ri']
outer=bowl(x0,cx,ax,n,mm,cyo,byo); inner=bowl(x0+SW,ci,ai,ni,mi,cyi,byi)
k1,c1=G['Rleg'][0]; k2,c2=G['Rleg'][1]
leg=Polygon([(k1*820+c1,820),(k2*820+c2,820),(k2*BOT+c2,BOT),(k1*BOT+c1,BOT)])
L['R']=unary_union([box(x0,TOP,x0+SW,BOT),outer.difference(inner),leg.difference(inner)])
# D
x0=G['Dstem'][0]; it,ib=G['Dbars']; L['D']=bowl(x0,*G['Do']).difference(bowl(x0+SW,*G['Di']))
L['D']=unary_union([L['D'],box(x0,TOP,x0+SW,BOT)])
# P
x0=G['Pstem'][0]; L['P']=unary_union([box(x0,TOP,x0+SW,BOT),bowl(x0,*G['Po']).difference(bowl(x0+SW,*G['Pi']))])
# A, made symmetric
A=G['A']
yo=-(A['oR'][1]-A['oL'][1])/(A['oR'][0]-A['oL'][0]); xo=A['oL'][0]*yo+A['oL'][1]
yi=-(A['iR'][1]-A['iL'][1])/(A['iR'][0]-A['iL'][0]); xi=A['iL'][0]*yi+A['iL'][1]
xc=(xo+xi)/2; ko=(abs(A['oL'][0])+abs(A['oR'][0]))/2; ki=(abs(A['iL'][0])+abs(A['iR'][0]))/2
# keep the stroke (horizontal) the measured average at y=1000
wo=((A['iL'][0]*1000+A['iL'][1])-(A['oL'][0]*1000+A['oL'][1]) + (A['oR'][0]*1000+A['oR'][1])-(A['iR'][0]*1000+A['iR'][1]))/2
ox=lambda y,s: xc+s*(ko*(y-yo))
yo_s=yo; yi_s=None
outerA=Polygon([(ox(TOP,-1),TOP),(ox(TOP,1),TOP),(ox(BOT,1),BOT),(ox(BOT,-1),BOT)])
# inner edges: parallel-ish lines giving stroke wo at y=1000
iL1000=ox(1000,-1)+wo; iR1000=ox(1000,1)-wo
yi_s=1000-(iR1000-xc)/ki
ix=lambda y,s: xc+s*ki*(y-yi_s)
cnt=Polygon([(xc,yi_s),(ix(A['bar'][0],1),A['bar'][0]),(ix(A['bar'][0],-1),A['bar'][0])])
legs=Polygon([(ix(A['bar'][1],-1),A['bar'][1]),(ix(A['bar'][1],1),A['bar'][1]),(ix(BOT+5,1),BOT+5),(ix(BOT+5,-1),BOT+5)])
L['A']=outerA.difference(cnt).difference(legs).intersection(box(0,TOP,20000,BOT))
print('A apex', xo, yo, 'counter apex', yi_s, 'xc', xc, 'stroke', wo)
# round corners slightly
R=7
for k in L: L[k]=L[k].buffer(R,join_style='round',quad_segs=16).buffer(-2*R,join_style='round',quad_segs=16).buffer(R,join_style='round',quad_segs=16)
W=unary_union(list(L.values()))
W=affinity.translate(affinity.scale(W,0.1,0.1,origin=(0,0)),-355.3,-TOP*0.1)
import pickle; pickle.dump(W,open('word.pkl','wb'))
print('bounds',W.bounds)
def to_d(g):
    out=[]
    for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]):
        for ring in [p.exterior,*p.interiors]:
            c=list(ring.simplify(0.004).coords)[:-1]; out.append('M'+' '.join(f'{x:.2f} {y:.2f}' for x,y in c)+'Z')
    return ''.join(out)
d=to_d(W); open('word_old.d','w').write(d); print(len(d))
x0,y0,x1,y1=W.bounds
open('word_old.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0-4} {y0-4} {x1-x0+8} {y1-y0+8}" width="{(x1-x0+8)*4:.0f}"><rect x="{x0-4}" y="{y0-4}" width="100%" height="100%" fill="#fff"/><path fill="#0B2545" fill-rule="evenodd" d="{d}"/></svg>')
