import numpy as np, json
from scipy.optimize import least_squares
m=np.load('m.npy'); H,W=m.shape
def runs(y,x0,x1,minw=3):
    r=m[y,x0:x1].astype(int); d=np.diff(np.concatenate([[0],r,[0]])); s=np.where(d==1)[0]; e=np.where(d==-1)[0]
    return [(a+x0,b+x0) for a,b in zip(s,e) if b-a>=minw]
def colruns(x,y0=0,y1=None):
    y1=y1 or H; r=m[y0:y1,x].astype(int); d=np.diff(np.concatenate([[0],r,[0]])); s=np.where(d==1)[0]; e=np.where(d==-1)[0]; return [(a+y0,b+y0) for a,b in zip(s,e)]
def line(pts):
    a=np.array(pts,float); k,c=np.polyfit(a[:,0],a[:,1],1); res=a[:,1]-(k*a[:,0]+c); return [float(k),float(c)], float(np.sqrt(np.mean(res**2)))
for name,(x0,x1) in {'N':(3553,4840),'O':(4972,6286),'R':(6427,7629),'DA':(7745,10443),'P':(10524,11698)}.items():
    tops=[];bots=[]
    for x in range(x0+5,x1-5,7):
        c=colruns(x)
        if c: tops.append(c[0][0]); bots.append(c[-1][1])
    print(name,'top min/med',min(tops),int(np.median(tops)),'bot max/med',max(bots),int(np.median(bots)))
for y in (300,500,800,1100,1300,1360):
    print(y,[r for r in runs(y,3500,11700)])
