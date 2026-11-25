# NVDB roads (NLOD, Statens vegvesen) -> signed distance fields in near_w.png: B = gravel roads, A = paved roads.
# Encoding 128 + d*10 (d metres, positive inside the road), so edges stay sharp below the 6.25 m texel.
import json, sys, numpy as np, cv2, gc
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0,'/home/claude/ento')
from geo import ll_to_local
OUT='/home/claude/birdbird/world/ento'
meta=json.load(open(f'{OUT}/meta.json'))['near']; E0,N1,ar,aw,ah=meta['E0'],meta['N1'],meta['ares'],meta['aw'],meta['ah']
sx=ar*(aw-1)/aw; sy=ar*(ah-1)/ah          # texel pitch as the shader samples it
L=json.load(open('/home/claude/ento/nvdb/links.json'))
lines=[]
for o in L:
    if o['topo']!='Vegtrase' or o['t'] not in ('HOVED','KONNEKTERING'): continue
    if o['typ'] in ('gangfelt','trapp','sti','gågate','fortau'): continue      # sidewalks merge with the road at this texel size
    k=o['kat']; nl=len(o['felt'])
    if o['tg']=='G' or o['typ'] in ('gangOgSykkelveg','gangveg','sykkelveg'): w=3.4; grav=False
    elif o['typ']=='fortau': w=2.0; grav=False
    elif k=='E': w=max(nl,2)*3.5+4.0; grav=False
    elif k in ('R','F'): w=max(nl,2)*3.25+1.5; grav=False
    elif k=='K': w=max(nl,2)*3.0+0.8; grav=False
    elif k=='P': w=5.0 if nl>=2 else 4.0; grav=nl<2
    elif k=='S': w=4.0; grav=True
    else: w=3.6; grav=False
    if o['typ']=='rampe': w=max(w,6.0)
    pts=o['wkt'][o['wkt'].index('(')+1:-1].split(',')
    la=np.array([float(p.split()[0]) for p in pts]); lo=np.array([float(p.split()[1]) for p in pts])
    E,N=ll_to_local(lo,la); lines.append((np.array(E),np.array(N),w,grav))
print('road links',len(lines),'gravel',sum(l[3] for l in lines))
im=np.asarray(Image.open('/home/claude/ento/near_w_orig.png').convert('RGB')).copy()
G=np.zeros((ah,aw),np.uint8); A=np.zeros((ah,aw),np.uint8)
R=1.0; M=20.0; step=300                                   # 300 texel rows per chunk, 1 m raster
for r0 in range(0,ah,step):
    r1=min(ah,r0+step)
    ntop=N1-r0*sy+M; nbot=N1-(r1-1)*sy-M; e0=E0-M; e1=E0+(aw-1)*sx+M
    H=int((ntop-nbot)/R)+1; W=int((e1-e0)/R)+1
    for gi,dst in ((True,G),(False,A)):
        m=np.zeros((H,W),np.uint8)
        for E,N,w,g in lines:
            if g!=gi or E.max()<e0 or E.min()>e1 or N.max()<nbot or N.min()>ntop: continue
            p=np.stack([(E-e0)/R,(ntop-N)/R],1)
            cv2.polylines(m,[np.round(p*4).astype(np.int32)],False,1,thickness=max(1,int(round(w/R))),lineType=cv2.LINE_8,shift=2)
        if not m.any(): continue
        b=m>0; sd=(nd.distance_transform_edt(b)-nd.distance_transform_edt(~b))*R
        sd=np.where(b,sd-0.5*R,sd+0.5*R)                    # pixel centres -> edge
        cc=np.arange(aw); rr=np.arange(r0,r1)
        X=((E0+(cc+0.5)*sx)-e0)/R; Y=(ntop-(N1-(rr+0.5)*sy))/R
        v=nd.map_coordinates(sd.astype(np.float32),[np.repeat(Y,aw),np.tile(X,len(rr))],order=1).reshape(len(rr),aw)
        dst[r0:r1]=np.clip(np.round(128+v*10),0,255).astype(np.uint8)
    del m; gc.collect()
    print('rows',r0,flush=True) if r0%1500==0 else None
out=np.dstack([im[...,0],im[...,1],G,A])
Image.fromarray(out,'RGBA').save(f'{OUT}/near_w.png',optimize=True)
print('done', (A>128).mean(), (G>128).mean())
