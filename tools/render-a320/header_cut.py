"""Leaves the loose rails, fins and mounts over the side windows out of models/a320-shell.bin (whole parts, not single faces);
a320-3d.js draws a clean lining, sun visors, rods and hinges there instead.
Run: python3 header_cut.py <shell as built by shell.py> ../../models/a320-shell.bin 0.4"""
import sys,numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
sys.path.insert(0,__import__('os').path.dirname(__file__)); import shellbin
h,g=shellbin.read(sys.argv[1]); G=g[0]; Pq=G['P']; P=Pq/h['S']; I=G['I']; c=P[I].mean(1); ax=np.abs(c[:,0])
# weld vertices by quantised position so pieces split only where geometry really separates
_,vid=np.unique(Pq,axis=0,return_inverse=True); vid=vid.ravel(); J=vid[I]
nf=len(I); rows=np.repeat(np.arange(nf),3); A=coo_matrix((np.ones(3*nf),(rows,J.ravel())),shape=(nf,vid.max()+1)).tocsr()
F=(A@A.T); ncomp,lab=connected_components(F,directed=False)
inb=np.zeros(nf,bool)
for x0,y0,z0,z1 in [(0.42,0.86,-0.10,1.15),(0.58,0.845,-0.10,0.75)]:
    inb|=(ax>x0)&(c[:,1]>y0)&(c[:,2]>z0)&(c[:,2]<z1)
frac=np.bincount(lab,inb,ncomp)/np.bincount(lab,minlength=ncomp)
m=frac[lab]>=float(sys.argv[3]) if len(sys.argv)>3 else frac[lab]>=0.5
# small loose fittings left near the overhead's outer edge (mounts of the rails taken out above)
lo=np.full((ncomp,3),9.);hi=np.full((ncomp,3),-9.)
np.minimum.at(lo,lab,c);np.maximum.at(hi,lab,c);cen=(lo+hi)/2;diag=np.linalg.norm(hi-lo,axis=1)
small=(diag<0.09)&(np.abs(cen[:,0])>0.33)&(cen[:,1]>0.86)&(cen[:,2]>-0.30)&(cen[:,2]<0.75)
big=(lo[:,0]<-0.3)&(hi[:,0]>0.3)   # pieces that run across the cockpit (the roof over the windshield, the ceiling): trimmed only
print('big parts',np.round(np.c_[lo[big&(frac>=0.4)],hi[big&(frac>=0.4)]],2).tolist())
m&=~big[lab]; m|=big[lab]&inb   # a large lining piece is only trimmed, never taken out whole
print('small parts',small.sum(),np.round(cen[small],2).tolist()); m|=small[lab]
print('components',ncomp,'cut faces',m.sum(),'centroid-cut',inb.sum())
G['I']=I[~m]; G['meta']['ni']=G['I'].size; shellbin.write(sys.argv[2],h,g)
np.save('cutmask.npy',m)
