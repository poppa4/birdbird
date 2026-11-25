import sys,os,numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
sys.path.insert(0,__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'..')); import shellbin
def comps(path=None):
    path=path or os.environ['FG_SHELL']
    h,g=shellbin.read(path); G=g[0]; Pq=G['P']; V=Pq/h['S']; F=G['I']
    _,vid=np.unique(Pq,axis=0,return_inverse=True); vid=vid.ravel(); J=vid[F]; nf=len(F)
    A=coo_matrix((np.ones(3*nf),(np.repeat(np.arange(nf),3),J.ravel())),shape=(nf,vid.max()+1)).tocsr()
    n,lab=connected_components(A@A.T,directed=False)
    return h,g,V,F,lab,n
if __name__=='__main__':
    h,g,V,F,lab,n=comps(); c=V[F].mean(1)
    np.savez('fg_comp.npz',v=V,f=F,ob=lab)
    lo=np.full((n,3),9.);hi=np.full((n,3),-9.); np.minimum.at(lo,lab,V[F].min(1)); np.maximum.at(hi,lab,V[F].max(1)); cnt=np.bincount(lab,minlength=n)
    N=g[0]['N']; col=N[F[:,0]][:,:3].astype(np.uint8)
    cs=np.zeros((n,3)); np.add.at(cs,lab,col); cs/=cnt[:,None]
    idx=[i for i in range(n) if hi[i,1]>0.80 and cnt[i]>=6]
    for i in sorted(idx,key=lambda i:-cnt[i])[:70]:
        print(f'{i:5d} n={cnt[i]:5d} x[{lo[i,0]:+.2f},{hi[i,0]:+.2f}] y[{lo[i,1]:.2f},{hi[i,1]:.2f}] z[{lo[i,2]:+.2f},{hi[i,2]:+.2f}] col={cs[i].round().astype(int)}')
    print(len(idx),'components reach above 0.80; total',n)
