# Barrel-roofed hangars: find chart footprints whose lidar roof profile is an arch; store eave height (e) and rise (a).
import json, numpy as np
dom=np.load('loc_near_dom.npy',mmap_mode='r'); NE0,NN1,NR=-4000.0,7000.0,2.0
P='/home/claude/birdbird/world/ento/airport.json'; A=json.load(open(P))
for b in A['buildings']:
    if b.get('k')!=1 or len(b['p'])!=4: continue
    p=np.array(b['p']); L01=np.linalg.norm(p[1]-p[0]); L12=np.linalg.norm(p[2]-p[1])
    if min(L01,L12)<14 or L01*L12<1400: continue
    q=[0,1,2,3] if L01>=L12 else [1,2,3,0]; Aa,Bb,Cc,Dd=[p[k] for k in q]
    prof=[]
    for t in np.linspace(0.04,0.96,13):
        v=[dom[int((NN1-(Aa+(Bb-Aa)*s+(Dd-Aa)*t)[1])/NR),int(((Aa+(Bb-Aa)*s+(Dd-Aa)*t)[0]-NE0)/NR)] for s in np.linspace(0.2,0.8,7)]
        prof.append(float(np.median(v)))
    prof=np.array(prof); edge=(prof[0]+prof[-1])/2; top=prof[5:8].max(); qtr=(prof[3]+prof[9])/2
    if top-edge>2.0 and edge+0.3*(top-edge)<qtr<top+0.5:
        b['e']=round(edge,2); b['r']=round(edge,2); b['a']=round(min(11.0,top-edge),1); print('arch',b['p'][0],b['a'])
json.dump(A,open(P,'w'),separators=(',',':'))
