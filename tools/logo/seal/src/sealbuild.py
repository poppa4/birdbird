import numpy as np, json, math, pathops, potrace
from scipy import ndimage as ndi
from fontTools.pens.svgPathPen import SVGPathPen
X0,Y0,R0,r1,r2,r3=map(float,open('seal_geo2.txt').read().split()); U=100/R0
R1,R2=r1*U,r2*U
GF=json.load(open('globe_fit.json')); WSTROKE=2.6
def bez(C,t): t=np.asarray(t)[:,None]; return (1-t)**3*C[0]+3*t*(1-t)**2*C[1]+3*t**2*(1-t)*C[2]+t**3*C[3]
def dbez(C,t): t=np.asarray(t)[:,None]; return 3*(1-t)**2*(C[1]-C[0])+6*(1-t)*t*(C[2]-C[1])+3*t**2*(C[3]-C[2])
def stroke(C,W,n=220):
    C=np.array(C); t=np.linspace(0,1,n); P=bez(C,t); D=dbez(C,t); D/=np.hypot(*D.T)[:,None]; Nn=np.c_[-D[:,1],D[:,0]]
    e=np.minimum(t,1-t); f=0.2+0.8*np.minimum(1,e/0.26)**0.6; w=W*f/2
    Lft=P+Nn*w[:,None]; Rgt=P-Nn*w[:,None]
    # round caps
    def cap(c,dirv,r,start):
        a0=math.atan2(dirv[1],dirv[0]); out=[]
        for k in range(1,12):
            a=a0+math.pi/2-math.pi*k/12
            out.append(c+r*np.array([math.cos(a),math.sin(a)]))
        return out
    pts=list(Lft)+cap(P[-1],D[-1],w[-1],False)+list(Rgt[::-1])+cap(P[0],-D[0],w[0],False)
    return pts
def poly(pts):
    p=pathops.Path(); pen=p.getPen(); pen.moveTo(tuple(pts[0]))
    for q in pts[1:]: pen.lineTo(tuple(q))
    pen.closePath(); return p
def circle(r,n=720):
    return [(r*math.cos(t),r*math.sin(t)) for t in np.linspace(0,2*math.pi,n,endpoint=False)]
def circle_bez(r):
    # four exact-enough cubic quarter arcs (k = 0.5523)
    k=0.5522847498*r; p=pathops.Path(); pen=p.getPen(); pen.moveTo((r,0))
    pen.curveTo((r,k),(k,r),(0,r)); pen.curveTo((-k,r),(-r,k),(-r,0)); pen.curveTo((-r,-k),(-k,-r),(0,-r)); pen.curveTo((k,-r),(r,-k),(r,0)); pen.closePath(); return p
UN,DIFF=pathops.PathOp.UNION,pathops.PathOp.DIFFERENCE
# the bird: smoothed trace; the streaks carried into the ring so they join it without a seam
a=np.load('seal_a.npy'); H,W=a.shape; Yg,Xg=np.mgrid[0:H,0:W]; rr=np.hypot(Xg-X0,Yg-Y0)
bird=np.load('birdmask2.npy')
# carry the streaks straight out (radially) from just inside the ring into it, where the ring hides the change of direction
th=np.arctan2(Yg-Y0,Xg-X0); ang=np.round((th+np.pi)/(2*np.pi)*20000).astype(int)%20000
tip=bird&(rr>r1-6)&(rr<r1-3); hit=np.zeros(20000,bool); hit[np.unique(ang[tip])]=True; hit=ndi.binary_dilation(hit,iterations=2)
bird=bird|((rr>=r1-5)&(rr<r1+7)&hit[ang])
bird=ndi.binary_opening(bird,iterations=1)
sm=ndi.gaussian_filter(bird.astype(float),9)>0.5
path=potrace.Bitmap(~sm).trace(turdsize=200,turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY,alphamax=1.3,opticurve=True,opttolerance=1.2)
bp=pathops.Path(); pen=bp.getPen(); T=lambda q:((q.x-X0)*U,(q.y-Y0)*U)
for c in path:
    pen.moveTo(T(c.start_point))
    for s in c.segments:
        if s.is_corner: pen.lineTo(T(s.c)); pen.lineTo(T(s.end_point))
        else: pen.curveTo(T(s.c1),T(s.c2),T(s.end_point))
    pen.closePath()
cut=pathops.op(circle_bez(R2),circle_bez(R1),DIFF)      # the white ring
cut=pathops.op(cut,bp,UN)
for k,v in GF.items(): cut=pathops.op(cut,poly(stroke(v['C'],WSTROKE)),UN)
seal=pathops.op(circle_bez(100),cut,DIFF)
pen=SVGPathPen(None,ntos=lambda v:('%.3f'%v).rstrip('0').rstrip('.')); seal.draw(pen); D=pen.getCommands()
open('seal2.d','w').write(D); print('seal path chars',len(D))
