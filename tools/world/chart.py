import pymupdf as fitz, numpy as np
from geo import page_to_local
def bez(p0,p1,p2,p3,n=8):
    t=np.linspace(0,1,n+1)[1:,None]; P=[np.array([q.x,q.y]) for q in (p0,p1,p2,p3)]
    return list((1-t)**3*P[0]+3*(1-t)**2*t*P[1]+3*(1-t)*t**2*P[2]+t**3*P[3])
def polys(dd):
    out=[];cur=[]
    for it in dd['items']:
        k=it[0]
        if k=='l':
            a,b=it[1],it[2]
            if cur and np.hypot(cur[-1][0]-a.x,cur[-1][1]-a.y)>0.05: out.append(cur); cur=[]
            if not cur: cur=[np.array([a.x,a.y])]
            cur.append(np.array([b.x,b.y]))
        elif k=='c':
            a=it[1]
            if cur and np.hypot(cur[-1][0]-a.x,cur[-1][1]-a.y)>0.05: out.append(cur); cur=[]
            if not cur: cur=[np.array([a.x,a.y])]
            cur+=bez(*it[1:5])
        elif k=='re':
            if cur: out.append(cur); cur=[]
            r=it[1]; out.append([np.array(v) for v in ((r.x0,r.y0),(r.x1,r.y0),(r.x1,r.y1),(r.x0,r.y1))])
        elif k=='qu':
            if cur: out.append(cur); cur=[]
            q=it[1]; out.append([np.array([v.x,v.y]) for v in (q.ul,q.ur,q.lr,q.ll)])
    if cur: out.append(cur)
    return out
def drawings():
    import warnings; warnings.filterwarnings('ignore')
    return fitz.open('633116.pdf')[0].get_drawings()
def key(dd):
    c=dd.get('fill') if dd['type']=='f' else dd.get('color')
    return (dd['type'],tuple(round(x,2) for x in c) if c else None, round(dd.get('width') or 0,2))
def to_local(poly): return np.array([page_to_local(x,y) for x,y in poly])
