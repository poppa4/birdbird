import numpy as np, json, sys
from scipy.ndimage import map_coordinates
from geo import local_to_utm
def load(name,svc):
    a=np.load(f'raw/{name}_{svc}.npy'); m=json.load(open(f'raw/{name}_{svc}.json')); return a,m
def to_local(name,svc,E0,N0,E1,N1,res,order=1):
    a,m=load(name,svc)
    E=np.arange(E0,E1+res/2,res); N=np.arange(N1,N0-res/2,-res)      # rows north->south
    EE,NN=np.meshgrid(E,N)
    out=np.empty(EE.shape,np.float32)
    step=max(1,int(4e6//EE.shape[1]))
    for r in range(0,EE.shape[0],step):
        x,y=local_to_utm(EE[r:r+step].ravel(),NN[r:r+step].ravel())
        col=(np.asarray(x)-m['x0'])/m['res']-0.5; row=(m['y1']-np.asarray(y))/m['res']-0.5
        v=map_coordinates(a,[row,col],order=order,mode='nearest',cval=-9999)
        nd=map_coordinates((a<-1000).astype(np.float32),[row,col],order=1,mode='nearest')
        v[nd>0.01]=np.nan
        out[r:r+step]=v.reshape(-1,EE.shape[1])
    return out
if __name__=='__main__':
    which=sys.argv[1]
    if which=='near':
        for s in ('dtm','dom'): np.save(f'loc_near_{s}.npy',to_local('near',s,-4000,-4500,4000,7000,2.0))
    if which=='mid':
        for s in ('dtm','dom'): np.save(f'loc_mid_{s}.npy',to_local('mid',s,-20000,-20000,20000,20000,8.0))
    if which=='far': np.save('loc_far_dtm.npy',to_local('far','dtm',-80000,-80000,80000,80000,40.0))
