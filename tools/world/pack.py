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
def airport_paint(col,can,cls,E0,N1,res,real=False):
    m=chart_masks(E0,N1,res,col.shape[:2])
    S=col.shape[:2]
    apt=nd.binary_fill_holes(m['apt']|m['twy']|m['apron']|m['rwy'])
    n=ground.fbm(S,max(2,int(60/res)),5)-0.5
    ys=N1-np.arange(S[0])*res; mow=np.empty(S,np.float32)
    for r0 in range(0,S[0],800):
        X,_=np.meshgrid(E0+np.arange(S[1])*res,ys[r0:r0+800]); mow[r0:r0+800]=1+0.05*np.sign(np.sin(X*np.pi/9.0))
    grass=np.array([74,90,50],np.float32)*((1+0.10*n)*mow)[...,None]
    sel=apt&~cls['water']
    if not real: col[sel]=grass[sel]
    else:
        pv_=m['twy']|m['apron']|m['rwy']
        dpv=nd.distance_transform_edt(~pv_)*res
        k=np.clip(1.0-(dpv-4.0)/22.0,0,1)[...,None]*(~cls["water"])[...,None]   # within ~25 m of pavement: mown grass, no satellite concrete ghosts
        col[:]=col*(1-k)+grass*k
    can[sel]=0; cls['forest']&=~sel
    pav=m['twy']|m['apron']|m['rwy']
    asph=np.array([66,68,70],np.float32)*(1+0.06*n)[...,None]; conc=np.array([118,118,114],np.float32)*(1+0.05*n)[...,None]
    if res>2.5:
        col[m['twy']]=asph[m['twy']]; col[m['apron']]=conc[m['apron']]
        col[m['rwy']]=np.array([52,54,56],np.float32)
    else:
        # near level: the shader draws pavement from the distance field; the colour map gets a neutral grey
        # under it so a mip/edge never shows grass colour through the edge
        pv=nd.binary_erosion(m['twy']|m['apron']|m['rwy'],iterations=2); col[pv]=np.array([92,94,94],np.float32)
    b=m['bld']
    if not real: col[b]=np.array([150,152,150],np.float32)
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
    s2=np.load(f'loc_{name}_s2.npy').astype(np.float32) if os.path.exists(f'loc_{name}_s2.npy') else None
    col,can,cls=ground.build(dtm,dom,res,E0,N1,seed=1,near=near,nanmask=nanmask,s2=s2)
    h=np.where(np.isnan(dtm),0,dtm).astype(np.float32)
    if nanmask is not None: h=np.where(nanmask,dtm,h)
    h[cls['sea']]=0.0
    pav=None
    if apt:
        pav=airport_paint(col,can,cls,E0,N1,res,real=s2 is not None)
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

# ---------------------------------------------------------------------------------------------------------------
# Near level along both finals: E -3500..3500, N -11500..14000; built in chunks (memory) and stitched.
def near_long(E0=-3500.0,E1=3500.0,NS=-11500.0,NN=14000.0,res=2.0,hres=10.0,ares=6.25,chunk=8500.0,margin=250.0):
    import resample, s2build, rasterio, gc
    Wd=int(round((E1-E0)/res))+1
    Hh_g=int(round((NN-NS)/hres))+1; Wh_g=int(round((E1-E0)/hres))+1
    Ha_g=int(round((NN-NS)/ares))+1; Wa_g=int(round((E1-E0)/ares))+1
    HG=np.zeros((Hh_g,Wh_g),np.float32); CG=np.zeros_like(HG)
    AG=np.zeros((Ha_g,Wa_g,3),np.float32); WG=np.zeros((Ha_g,Wa_g,3),np.float32)
    top=NN
    while top>NS+1:
        bot=max(NS,top-chunk); ct=min(NN,top+margin); cb=max(NS,bot-margin)
        print('chunk',top,bot,flush=True)
        dtm=resample.to_local('near2','dtm',E0,cb,E1,ct,res); dom=resample.to_local('near2','dom',E0,cb,E1,ct,res)
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
            s2,_=s2build.composite(E0,ct,res,dtm.shape[1],dtm.shape[0],10)
        col,can,cls=ground.build(dtm,dom,res,E0,ct,seed=1,near=True,s2=s2)
        del s2; gc.collect()
        h=np.where(np.isnan(dtm),0,dtm).astype(np.float32); h[cls['sea']]=0.0
        airport_paint(col,can,cls,E0,ct,res,real=True)
        pv_=chart_masks(E0,ct,res,h.shape); pm_=pv_['twy']|pv_['apron']|pv_['rwy']
        if pm_.any():
            dd=nd.distance_transform_edt(~pm_)*res; w_=np.clip(1.0-(dd-2.0)/40.0,0,1)*(dd>0)
            h=h*(1-w_)+nd.gaussian_filter(h,9.0/res)*w_; h=np.where(pm_,nd.gaussian_filter(h,4.0/res),h)
        can=np.where(cls['forest'],can,0)*0.92
        fi=int(round(hres/res)); hs=nd.gaussian_filter(h,fi*0.42)
        H=hs[::fi,::fi]; r=fi//2; pad=np.pad(can,r,mode='edge'); Hc,Wc=H.shape
        win=np.lib.stride_tricks.sliding_window_view(pad,(fi,fi))[::fi,::fi][:Hc,:Wc]
        C=np.percentile(win.reshape(Hc,Wc,-1),60,axis=2).astype(np.float32)
        sea_c=cls['sea'][::fi,::fi]; H[sea_c]=0
        # place the core rows (top..bot) of this chunk into the global grids
        def put(G,A,step):
            r0=int(round((ct-top)/step)); r1=int(round((ct-bot)/step))+1; g0=int(round((NN-top)/step))
            n=min(r1-r0,G.shape[0]-g0); G[g0:g0+n]=A[r0:r0+n,:G.shape[1]]
        put(HG,H,hres); put(CG,C,hres)
        A=down(col,ares/res); Wm=down(np.dstack([cls['water'],cls['forest'],cls.get('paved',np.zeros_like(cls['water']))]).astype(np.float32)*255,ares/res)
        put(AG,A,ares); put(WG,Wm,ares)
        del dtm,dom,col,can,cls,h,hs,pad,win; gc.collect()
        top=bot
    Image.fromarray(enc_h(HG,CG)).save(f'{OUT}/near_h.png',optimize=True)
    Image.fromarray(np.clip(AG,0,255).astype(np.uint8)).save(f'{OUT}/near_a.jpg',quality=86,optimize=True,progressive=True)
    Image.fromarray(np.clip(WG,0,255).astype(np.uint8)).save(f'{OUT}/near_w.png',optimize=True)
    np.save('dtm_near.npy',HG)
    info=dict(E0=E0,N1=NN,hres=hres,hw=Wh_g,hh=Hh_g,ares=ares,aw=Wa_g,ah=Ha_g)
    meta=json.load(open(f'{OUT}/meta.json')); meta['near']=info; json.dump(meta,open(f'{OUT}/meta.json','w'),indent=1)
    print('near_long',info)
