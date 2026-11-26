import numpy as np, json
from scipy.optimize import least_squares
m=np.load('wmask.npy'); H,W=m.shape
def runs(y,x0,x1):
    r=m[y,x0:x1].astype(int); d=np.diff(np.concatenate([[0],r,[0]])); s=np.where(d==1)[0]; e=np.where(d==-1)[0]; return [(a+x0,b+x0) for a,b in zip(s,e)]
def colruns(x,y0=0,y1=None):
    y1=y1 or H; r=m[y0:y1,x].astype(int); d=np.diff(np.concatenate([[0],r,[0]])); s=np.where(d==1)[0]; e=np.where(d==-1)[0]; return [(a+y0,b+y0) for a,b in zip(s,e)]
def line(pts):  # x = k*y + c
    a=np.array(pts,float); k,c=np.polyfit(a[:,0],a[:,1],1); return float(k),float(c)
TOP,BOT=120.5,854.0
G={'TOP':TOP,'BOT':BOT}
# vertical stems (left/right edges) from rows 300..800 where present
def vedge(x0,x1,which,ys):
    v=[]
    for y in ys:
        r=runs(y,x0,x1)
        if r: v.append(r[0][0] if which=='L' else r[0][1])
    return float(np.median(v))
# ---- N
N={}
N['sL']=vedge(40,300,'L',range(300,820,5)); N['sR']=vedge(40,300,'R',range(420,820,5))
N['rL']=vedge(860,1090,'L',range(140,560,5)); N['rR']=vedge(860,1090,'R',range(140,820,5))
up=[];lo=[]
for y in range(380,570,2):
    r=[q for q in runs(y,280,860) if q[1]-q[0]>150]
    if r: lo.append((y,r[0][0])); up.append((y,r[0][1]))
for y in range(160,360,2):
    r=runs(y,40,860); up.append((y,r[0][1]))
N['up']=line(up); N['lo']=line(lo); G['N']=N
# ---- O (superellipse, both walls)
def fit_se(pts,init):
    a=np.array(pts,float)
    def res(p):
        cx,cy,ax,by,n=p; y=a[:,0]; x=a[:,1]; t=np.clip(np.abs((y-cy)/by),0,0.9999)
        return np.abs(x-cx)-ax*(1-t**n)**(1/n)
    s=least_squares(res,init); return [float(v) for v in s.x], float(np.sqrt(np.mean(s.fun**2)))
oo=[];oi=[]
for y in range(112,870,3):
    r=runs(y,1180,2300)
    if not r: continue
    oo+= [(y,r[0][0]),(y,r[-1][1]-1)]
    if len(r)==2: oi+=[(y,r[0][1]),(y,r[1][0])]
for x in range(1250,2240,6):
    c=colruns(x,90,890)
    if c: oo+=[]  # top/bottom handled by rows
G['Oo'],e1=fit_se(oo,[1740,491,548,385,2.1]); G['Oi'],e2=fit_se(oi,[1740,491,350,230,2.1]); print('O fit rms',e1,e2,G['Oo'],G['Oi'])
# ---- bowls: right side of D (outer, inner), R, P
def bowl_right(x0,x1,ylo,yhi,which,maxstart=None):  # which: 'out' = last run end, 'in' = start of second run
    p=[]
    for y in range(int(ylo),int(yhi)):
        r=[q for q in runs(y,x0,x1) if q[0]<(maxstart or x1-60)]
        if not r: continue
        if which=='out': p.append((y,r[-1][1]-1))
        elif len(r)>=2: p.append((y,r[1][0]))
    return p
def fit_half(p,ytop,ybot,init):
    a=np.array(p,float); cy=(ytop+ybot)/2; by=(ybot-ytop)/2
    def res(q):
        cx,ax,n=q; t=np.clip(np.abs((a[:,0]-cy)/by),0,0.9999); return a[:,1]-(cx+ax*(1-t**n)**(1/n))
    s=least_squares(res,init); return [float(v) for v in s.x]+[cy,by], float(np.sqrt(np.mean(s.fun**2)))
def vspan(x,y0,y1):  # dark runs in a column
    return colruns(x,y0,y1)
# D
dcol=vspan(3900,100,880); print('D col',dcol)
Dit,Dib=dcol[0][1],dcol[1][0]
G['Do'],e=fit_half([q for q in bowl_right(3470,4560,TOP+2,BOT-2,'out',4400) if q[1]>3950],TOP,BOT,[3900,590,2.6]); print('D out',e,G['Do'])
G['Di'],e=fit_half([q for q in bowl_right(3470,4560,Dit+2,Dib-2,'in',4400) if q[1]>3950],Dit,Dib,[3900,390,2.3]); print('D in',e,G['Di'],Dit,Dib)
G['Dstem']=(vedge(3470,3700,'L',range(300,800,5)),vedge(3470,3700,'R',range(300,700,5)))
# R
rcol=vspan(2700,100,880); print('R col',rcol)
Rit,Rib,Rbb=rcol[0][1],rcol[1][0],rcol[1][1]
G['Ro'],e=fit_half([q for q in bowl_right(2390,3400,TOP+2,Rbb-30,'out') if q[1]>2950 and q[0]<Rbb-60],TOP,Rbb,[2950,380,2.3]); print('R out',e,G['Ro'],Rbb)
G['Ri'],e=fit_half([q for q in bowl_right(2390,3400,Rit+2,Rib-2,'in') if q[1]>2900],Rit,Rib,[2950,180,2.3]); print('R in',e,G['Ri'],Rit,Rib)
G['Rstem']=(vedge(2390,2620,'L',range(300,800,5)),vedge(2390,2620,'R',range(620,800,5)))
ll=[];lr=[]
for y in range(620,835,2):
    r=[q for q in runs(y,2700,3420)]
    if r: ll.append((y,r[0][0])); lr.append((y,r[0][1]))
G['Rleg']=(line(ll),line(lr))
# P
pcol=vspan(6200,100,880); print('P col',pcol)
Pit,Pib,Pbb=pcol[0][1],pcol[1][0],pcol[1][1]
G['Po'],e=fit_half([q for q in bowl_right(5720,6700,TOP+2,Pbb-2,'out') if q[1]>6300],TOP,Pbb,[6300,380,2.3]); print('P out',e,G['Po'],Pbb)
G['Pi'],e=fit_half([q for q in bowl_right(5720,6700,Pit+2,Pib-2,'in') if q[1]>6250],Pit,Pib,[6250,220,2.3]); print('P in',e,G['Pi'],Pit,Pib)
G['Pstem']=(vedge(5720,5950,'L',range(300,800,5)),vedge(5720,5950,'R',range(660,800,5)))
G['bars']={'D':(Dit,Dib),'R':(Rit,Rib,Rbb),'P':(Pit,Pib,Pbb)}
# Λ: four straight edges
oL=[];iL=[];iR=[];oR=[]
for y in range(330,835,3):
    r=[q for q in runs(y,4520,5720) if q[1]-q[0]>120]
    if len(r)==2: oL.append((y,r[0][0])); iL.append((y,r[0][1])); iR.append((y,r[1][0])); oR.append((y,r[1][1]))
for y in range(150,300,3):
    r=runs(y,4700,5400); oL.append((y,r[0][0])); oR.append((y,r[0][1]))
G['A']={'oL':line(oL),'iL':line(iL),'iR':line(iR),'oR':line(oR)}
print(json.dumps(G['N']),json.dumps(G['A']))
json.dump(G,open('wgeo.json','w'),default=float)
