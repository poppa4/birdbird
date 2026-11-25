import sys,os,json,urllib.request,urllib.parse,numpy as np,tifffile,io,time
from geo import local_to_utm
SVC={'dtm':'NHM_DTM_25833','dom':'NHM_DOM_25833'}
def export(svc,x0,y0,x1,y1,w,h,out):
    if os.path.exists(out): return np.load(out)
    q=dict(bbox=f'{x0},{y0},{x1},{y1}',bboxSR=25833,imageSR=25833,size=f'{w},{h}',format='tiff',pixelType='F32',
           noData='-9999',interpolation='RSP_BilinearInterpolation',compression='LZ77',f='image')
    url=f'https://hoydedata.no/arcgis/rest/services/{SVC[svc]}/ImageServer/exportImage?'+urllib.parse.urlencode(q)
    for a in range(4):
        try:
            b=urllib.request.urlopen(url,timeout=600).read(); a_=tifffile.imread(io.BytesIO(b)).astype(np.float32); break
        except Exception as e: print('retry',e,file=sys.stderr); time.sleep(5)
    else: raise SystemExit('fail '+url)
    np.save(out,a_); return a_
def grab(svc,name,E0,N0,E1,N1,res,margin=None):
    # UTM bbox covering the local rectangle (frames differ by ~4 deg)
    import numpy as np
    m=margin if margin is not None else 0.06*max(E1-E0,N1-N0)
    xs,ys=local_to_utm(np.array([E0-m,E1+m,E0-m,E1+m]),np.array([N0-m,N0-m,N1+m,N1+m]))
    x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
    W=int(np.ceil((x1-x0)/res)); H=int(np.ceil((y1-y0)/res)); x1=x0+W*res; y1=y0+H*res
    T=4000; nx=-(-W//T); ny=-(-H//T); tw=-(-W//nx); th=-(-H//ny)
    full=np.full((H,W),-9999,np.float32)
    for j in range(ny):
        for i in range(nx):
            cw=min(tw,W-i*tw); chh=min(th,H-j*th)
            tx0=x0+i*tw*res; ty1=y1-j*th*res
            a=export(svc,tx0,ty1-chh*res,tx0+cw*res,ty1,cw,chh,f'raw/{name}_{svc}_{j}_{i}.npy')
            full[j*th:j*th+chh, i*tw:i*tw+cw]=a
            print(name,svc,j,i,a.shape,float(np.nanmax(a)),flush=True)
    meta=dict(x0=x0,y1=y1,res=res,W=W,H=H)
    np.save(f'raw/{name}_{svc}.npy',full); json.dump(meta,open(f'raw/{name}_{svc}.json','w'))
if __name__=='__main__':
    which=sys.argv[1]
    if which=='test': print(export('dtm',229000,6569000,229100,6569100,50,50,'raw/test.npy')[::10,::10])
    if which=='near':
        for s in ('dtm','dom'): grab(s,'near',-4000,-4500,4000,7000,2.0,margin=300)
    if which=='mid':
        for s in ('dtm','dom'): grab(s,'mid',-20000,-20000,20000,20000,8.0,margin=800)
    if which=='far': grab('dtm','far',-80000,-80000,80000,80000,40.0,margin=3000)
