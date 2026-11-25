# Packs ENTO world data for the browser: heights (RGB PNG: R,G = (h+100)*10, B = canopy*5), albedo JPEG, water/forest/paved PNG.
import numpy as np, json, os, sys
from PIL import Image
from scipy import ndimage as nd
import ground
from chart import drawings, key, polys, to_local
OUT='/home/claude/birdbird/world/ento'; os.makedirs(OUT,exist_ok=True)
from PIL import ImageDraw
def chart_masks(E0,N1,res,shape):
    # rasterise chart layers (local coords) at this level's grid
    dr=drawings(); layers={}
    spec={'apt':[('f',(0.66,0.8,0.73),0)],'twy':[('f',(0.61,0.61,0.61),0),('f',(0.75,0.75,0.75),0),('f',(0.92,0.92,0.92),0)],
          'apron':[('f',(0.88,0.88,0.88),0)],'rwy':[('f',(0.41,0.41,0.41),0)],'bld':[('f',(0.43,0.64,0.71),0)]}
    for name,keys in spec.items():
        im=Image.new('L',(shape[1],shape[0]),0); g=ImageDraw.Draw(im)
        for dd in dr:
            if key(dd) not in keys: continue
            if dd['rect'].x0>680 and dd['rect'].y0>975: continue           # legend box
            for pl in polys(dd):
                if len(pl)<3: continue
                L=to_local(pl); g.polygon([((e-E0)/res,(N1-n)/res) for e,n in L],fill=255)
        layers[name]=np.asarray(im)>127
    return layers
def airport_paint(col,can,cls,E0,N1,res):
    m=chart_masks(E0,N1,res,col.shape[:2])
    S=col.shape[:2]
    apt=nd.binary_fill_holes(m['apt']|m['twy']|m['apron']|m['rwy'])
    n=ground.fbm(S,max(2,int(60/res)),5)-0.5
    ys=N1-np.arange(S[0])*res; mow=np.empty(S,np.float32)
    for r0 in range(0,S[0],800):
        X,_=np.meshgrid(E0+np.arange(S[1])*res,ys[r0:r0+800]); mow[r0:r0+800]=1+0.05*np.sign(np.sin(X*np.pi/9.0))
    grass=np.array([80,100,52],np.float32)*((1+0.10*n)*mow)[...,None]
    sel=apt&~cls['water']; col[sel]=grass[sel]; can[sel]=0; cls['forest']&=~sel
    pav=m['twy']|m['apron']|m['rwy']
    asph=np.array([66,68,70],np.float32)*(1+0.06*n)[...,None]; conc=np.array([118,118,114],np.float32)*(1+0.05*n)[...,None]
    col[m['twy']]=asph[m['twy']]; col[m['apron']]=conc[m['apron']]
    col[m['rwy']]=np.array([52,54,56],np.float32)
    b=m['bld']; col[b]=np.array([150,152,150],np.float32)
    cls['paved']=pav; cls['apt']=apt
    return pav
def enc_h(h,can):
    v=np.clip(np.round((h+100)*10),0,65535).astype(np.uint16)
    return np.dstack([(v>>8).astype(np.uint8),(v&255).astype(np.uint8),np.clip(np.round(can*5),0,255).astype(np.uint8)])
def down(a,f):   # area-average downsample by float factor via PIL BOX
    h,w=a.shape[:2]; W=int(round((w-1)/f))+1; H=int(round((h-1)/f))+1
    if a.ndim==2: return np.asarray(Image.fromarray(a.astype(np.float32),'F').resize((W,H),Image.BOX))
    return np.dstack([np.asarray(Image.fromarray(a[...,i].astype(np.float32),'F').resize((W,H),Image.BOX)) for i in range(a.shape[2])])
def level(name,dtm,dom,res,E0,N1,hres,ares,nanmask=None,near=False,apt=False):
    col,can,cls=ground.build(dtm,dom,res,E0,N1,seed=1,near=near,nanmask=nanmask)
    h=np.where(np.isnan(dtm),0,dtm).astype(np.float32)
    if nanmask is not None: h=np.where(nanmask,dtm,h)
    h[cls['sea']]=0.0
    pav=None
    if apt:
        pav=airport_paint(col,can,cls,E0,N1,res)
    can=np.where(cls['forest'],can,0)*0.92
    # heights grid (point samples at hres, smoothed first so it is not aliased)
    f=hres/res; fi=int(round(f)); hs=nd.gaussian_filter(h,f*0.42) if f>1.5 else h
    idx=lambda a: a[::fi,::fi]
    H=idx(hs)
    if near:
        # forest as a block with steep edges: 60th percentile of the canopy in each cell (no blur), so the
        # canopy wall lines up with the forest edge in the colour map
        r=fi//2; pad=np.pad(can,r,mode='edge'); Hh,Ww=H.shape
        win=np.lib.stride_tricks.sliding_window_view(pad,(fi,fi))[::fi,::fi][:Hh,:Ww]
        C=np.percentile(win.reshape(Hh,Ww,-1),60,axis=2).astype(np.float32)
    else:
        C=idx(nd.gaussian_filter(can,f*0.5))*0.6
    sea_c=idx(cls['sea'].astype(np.float32))>0.5; H[sea_c]=0
    Image.fromarray(enc_h(H,C)).save(f'{OUT}/{name}_h.png',optimize=True)
    fa=ares/res
    A=down(col,fa); Image.fromarray(np.clip(A,0,255).astype(np.uint8)).save(f'{OUT}/{name}_a.jpg',quality=86,optimize=True,progressive=True)
    w=np.dstack([cls['water'],cls['forest'],cls.get('paved',np.zeros_like(cls['water']))]).astype(np.float32)*255
    Wd=down(w,fa)
    if near: Image.fromarray(np.clip(Wd,0,255).astype(np.uint8)).save(f'{OUT}/{name}_w.png',optimize=True)
    else: Image.fromarray((np.clip(Wd[...,0],0,255)/17).round().astype(np.uint8)*17,'L').save(f'{OUT}/{name}_w.png',optimize=True)
    info=dict(E0=E0,N1=N1,hres=hres,hw=H.shape[1],hh=H.shape[0],ares=ares,aw=A.shape[1],ah=A.shape[0])
    # ground (DTM) heights for physics at hres, not smoothed beyond the grid
    np.save(f'dtm_{name}.npy',H)
    print(name,info,flush=True); return info
if __name__=='__main__':
    meta=json.load(open(f'{OUT}/meta.json')) if os.path.exists(f'{OUT}/meta.json') else {}
    for which in sys.argv[1:]:
        if which=='far':
            h=np.load('loc_far_dtmf.npy'); d=np.load('loc_far_dom.npy'); nm=np.load('loc_far_nanmask.npy')
            d=np.where(nm,h,d)
            meta['far']=level('far',h,d,40.0,-80000,80000,200.0,100.0,nanmask=nm)
        if which=='mid':
            meta['mid']=level('mid',np.load('loc_mid_dtm.npy'),np.load('loc_mid_dom.npy'),8.0,-20000,20000,40.0,20.0,apt=True)
        if which=='near':
            meta['near']=level('near',np.load('loc_near_dtm.npy'),np.load('loc_near_dom.npy'),2.0,-4000,7000,10.0,4.0,near=True,apt=True)
    json.dump(meta,open(f'{OUT}/meta.json','w'),indent=1)
