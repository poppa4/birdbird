# Sentinel-2 L2A true colour (Copernicus, free incl. commercial use; "Contains modified Copernicus Sentinel data 2025")
# composited per pixel from clear scenes, cloud/shadow masked with SCL, resampled to a level's local grid.
import numpy as np, json, sys, rasterio, os
from rasterio.windows import from_bounds
from scipy.ndimage import map_coordinates
from pyproj import Transformer
from geo import local_to_ll
os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN','EMPTY_DIR'); os.environ.setdefault('CPL_VSIL_CURL_ALLOWED_EXTENSIONS','.tif')
U32=Transformer.from_crs(4326,32632,always_xy=True)
S=json.load(open('s2tiles.json'))
ORDER=['20250725','20250817','20220629','20220624','20250818','20250816','20230609']
def scenes_for(t):
    c=[r for r in S if r[0]==t and r[2]<15]
    return sorted(c,key=lambda r:(ORDER.index(r[1].split('_')[2]) if r[1].split('_')[2] in ORDER else 9, r[3], r[2]))
def url(name,band):
    t=name.split('_')[1]; d=name.split('_')[2]; p=f's2/{name}_{band}.tif'
    if not os.path.exists(p):
        import subprocess
        u=f'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/{t[:2]}/{t[2]}/{t[3:]}/{d[:4]}/{int(d[4:6])}/{name}/{band}.tif'
        subprocess.run(['curl','-s','-f','--retry','3','-o',p+'.part',u],check=True); os.rename(p+'.part',p)
    return p
def tiles_for(x0,y0,x1,y1):
    cols='MNP'; out=[]
    for ci,c in enumerate('MNP'):
        e0=400000+ci*100000
        for ri,r in enumerate('KLM'):
            n0=6400000+ri*100000
            if x1>e0-10000 and x0<e0+109800 and y1>n0-9800 and y0<n0+100000: out.append(c+r)
    return out
def composite(E0,N1,res,W,H,src_res):
    E=E0+np.arange(W)*res; N=N1-np.arange(H)*res
    out=np.zeros((H,W,3),np.float32); have=np.zeros((H,W),bool)
    rows=max(1,int(3e6//W))
    XY=[]
    for r0 in range(0,H,rows):
        EE,NN=np.meshgrid(E,N[r0:r0+rows]); lon,lat=local_to_ll(EE.ravel(),NN.ravel()); x,y=U32.transform(lon,lat)
        XY.append((r0,np.asarray(x).reshape(EE.shape),np.asarray(y).reshape(EE.shape)))
    x0=min(a[1].min() for a in XY); x1=max(a[1].max() for a in XY); y0=min(a[2].min() for a in XY); y1=max(a[2].max() for a in XY)
    for t in tiles_for(x0,y0,x1,y1):
        for sc in scenes_for(t):
            name=sc[1]
            if have.all(): break
            try:
                with rasterio.open(url(name,'TCI')) as ds, rasterio.open(url(name,'SCL')) as sc_:
                    bx0,by0,bx1,by1=max(x0,ds.bounds.left),max(y0,ds.bounds.bottom),min(x1,ds.bounds.right),min(y1,ds.bounds.top)
                    if bx0>=bx1 or by0>=by1: continue
                    win=from_bounds(bx0-50,by0-50,bx1+50,by1+50,ds.transform).round_offsets().round_lengths()
                    f=max(1,int(src_res//10)); oh=max(2,int(win.height//f)); ow=max(2,int(win.width//f))
                    rgb=ds.read(window=win,out_shape=(3,oh,ow),resampling=rasterio.enums.Resampling.average).astype(np.float32)
                    wt=ds.window_transform(win); px=(win.width/ow)*10.0
                    swin=from_bounds(bx0-50,by0-50,bx1+50,by1+50,sc_.transform).round_offsets().round_lengths()
                    scl=sc_.read(1,window=swin); st=sc_.window_transform(swin)
            except Exception as e:
                print('skip',name,e,flush=True); continue
            bad_cls=np.isin(scl,[0,1,3,8,9,10])
            for (r0,X,Y) in XY:
                need=~have[r0:r0+X.shape[0]]
                if not need.any(): continue
                c=(X-wt.c)/px-0.5; r=(wt.f-Y)/px-0.5
                inside=(c>=0)&(r>=0)&(c<ow-1)&(r<oh-1)
                sc_c=((X-st.c)/20.0).astype(int); sc_r=((st.f-Y)/20.0).astype(int)
                okc=(sc_c>=0)&(sc_r>=0)&(sc_c<scl.shape[1])&(sc_r<scl.shape[0])
                bad=np.ones(X.shape,bool); bad[okc]=bad_cls[sc_r[okc],sc_c[okc]]
                vals=np.stack([map_coordinates(rgb[k],[r,c],order=1,mode='nearest') for k in range(3)],-1)
                zero=vals.sum(-1)<3
                use=need&inside&~bad&~zero
                sub=out[r0:r0+X.shape[0]]; sub[use]=vals[use]; have[r0:r0+X.shape[0]]|=use
            print(t,name,'coverage',round(have.mean()*100,2),flush=True)
    # anything still empty (persistent cloud): fill from neighbours
    if not have.all():
        from scipy import ndimage as nd
        idx=nd.distance_transform_edt(~have,return_distances=False,return_indices=True)
        out=out[tuple(idx)]
    return out,have
if __name__=='__main__':
  with rasterio.Env(CURL_CA_BUNDLE='/root/.ccr/ca-bundle.crt',GDAL_HTTP_MAX_RETRY='4',GDAL_HTTP_RETRY_DELAY='2',GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
      lv=sys.argv[1]
      if lv=='near': o,h=composite(-4000,7000,2.0,4001,5751,10)
      if lv=='mid': o,h=composite(-20000,20000,8.0,5001,5001,10)
      if lv=='far': o,h=composite(-80000,80000,40.0,4001,4001,40)
      np.save(f'loc_{lv}_s2.npy',o.astype(np.float16)); print('done',lv,o.shape,o.reshape(-1,3).mean(0))
