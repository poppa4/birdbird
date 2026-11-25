import numpy as np, math, os, urllib.request, io
from PIL import Image
from geo import local_to_ll
Z=10
def tile(x,y):
    p=f'raw/tz{Z}_{x}_{y}.png'
    if not os.path.exists(p): open(p,'wb').write(urllib.request.urlopen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png',timeout=60).read())
    a=np.asarray(Image.open(p).convert('RGB')).astype(np.float32); return a[...,0]*256+a[...,1]+a[...,2]/256-32768
def sample(E,N):
    lon,lat=local_to_ll(E,N); lon=np.asarray(lon); lat=np.asarray(lat)
    n=2**Z; xf=(lon+180)/360*n; yf=(1-np.log(np.tan(np.radians(lat))+1/np.cos(np.radians(lat)))/math.pi)/2*n
    out=np.zeros(E.shape,np.float32); tx=np.floor(xf).astype(int); ty=np.floor(yf).astype(int)
    for (x,y) in set(zip(tx.ravel().tolist(),ty.ravel().tolist())):
        m=(tx==x)&(ty==y); a=tile(x,y)
        px=np.clip((xf[m]-x)*256-0.5,0,255); py=np.clip((yf[m]-y)*256-0.5,0,255)
        x0=np.floor(px).astype(int); y0=np.floor(py).astype(int); x1=np.minimum(x0+1,255); y1=np.minimum(y0+1,255); fx=px-x0; fy=py-y0
        out[m]=(a[y0,x0]*(1-fx)*(1-fy)+a[y0,x1]*fx*(1-fy)+a[y1,x0]*(1-fx)*fy+a[y1,x1]*fx*fy)
    return out
