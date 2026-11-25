# Lidar houses along both finals (outside the airport's 3.5 km zone), appended to airport.json as k=0 buildings.
import numpy as np, json, cv2, gc, sys
from scipy import ndimage as nd
import resample, ground
OUT='/home/claude/birdbird/world/ento/airport.json'
A=json.load(open(OUT)); B=A['buildings']
B[:]=[b for b in B if not b.get('x')]          # drop an earlier run of this script
E0,E1,res=-1800.0,1800.0,2.0
add=0
for NS,NN in [(-11500.0,-3650.0),(6080.0,14000.0)]:
    top=NN
    while top>NS+1:
        bot=max(NS,top-3000.0); ct=top+60; cb=bot-60
        dtm=resample.to_local('near2','dtm',E0,cb,E1,ct,res); dom=resample.to_local('near2','dom',E0,cb,E1,ct,res)
        d=np.where(np.isnan(dtm),0,dtm).astype(np.float32)
        col,cn,cls=ground.build(dtm,dom,res,E0,ct,seed=1,near=True)
        lab,n=nd.label(cls['bld']); objs=nd.find_objects(lab)
        for i,sl in enumerate(objs):
            m=lab[sl]==i+1; area=m.sum()*res*res
            if area<30: continue
            ys,xs=np.nonzero(m); E=E0+(sl[1].start+xs)*res+res/2; N=ct-(sl[0].start+ys)*res-res/2
            if not (bot<=N.mean()<top): continue
            cc=cn[sl][m]; gg=d[sl][m]; base=float(np.min(gg))
            box=cv2.boxPoints(cv2.minAreaRect(np.stack([E,N],1).astype(np.float32)))
            if area>900:
                top_=float(np.clip(np.percentile(cc,70),3,25)); e=r=base+top_
            else:
                ridge=float(np.clip(np.percentile(cc,95),2.5,20)); e=base+ridge*0.66; r=base+ridge
            B.append(dict(p=[[round(float(x),2),round(float(y),2)] for x,y in box],b=round(base-0.3,2),e=round(e,2),r=round(r,2),k=0,x=1)); add+=1
        print('chunk',top,bot,'total added',add,flush=True)
        del dtm,dom,d,col,cn,cls,lab; gc.collect()
        top=bot
json.dump(A,open(OUT,'w'),separators=(',',':'))
print('houses added',add,'buildings',len(B))
