"""NORDAP wordmark rebuilt as exact geometry from the measurements in wgeo.json (px8 = original image px x 8)."""
import json, math, numpy as np, pathops
from fontTools.pens.svgPathPen import SVGPathPen
G=json.load(open('wgeo.json')); TOP,BOT=G['TOP'],G['BOT']
X0,Y0,R0=map(float,open('seal_geo2.txt').read().split()[:3]); S=8; box=(385,1352)
CX=55+X0/S; CY=1255+Y0/S; U=100.0/(R0/S)
T=lambda x,y:((box[0]+x/S-CX)*U,(box[1]+y/S-CY)*U); K=U/S   # px8 -> seal units (scale K)
def poly_path(pts, radii=None, default=16):
    """closed polygon (px8) with rounded corners (radius per vertex, px8) -> pathops.Path in seal units"""
    n=len(pts); radii=radii or {}; p=pathops.Path(); pen=p.getPen(); first=True
    for i in range(n):
        p0,p1,p2=np.array(pts[i-1],float),np.array(pts[i],float),np.array(pts[(i+1)%n],float)
        r=radii.get(i,default)
        v1=p0-p1; v2=p2-p1; l1=np.hypot(*v1); l2=np.hypot(*v2)
        turn=abs(math.atan2(v1[0]*v2[1]-v1[1]*v2[0], v1@v2))
        if r<=0 or l1<1e-6 or l2<1e-6 or turn>math.radians(178) : # straight (or tiny) -> plain vertex
            a=b=p1
        else:
            rr=min(r,l1*0.45,l2*0.45); a=p1+v1/l1*rr; b=p1+v2/l2*rr
        A=T(*a); B=T(*b); C=T(*p1)
        if first: pen.moveTo(A); first=False
        else: pen.lineTo(A)
        if not np.allclose(a,b): pen.qCurveTo(C,B)
    pen.closePath(); return p
def se_right(cx,ax,n,cy,by,steps=160,down=True):
    """the right half of a superellipse, from top (cx, cy-by) round to bottom (cx, cy+by)"""
    out=[]
    for i in range(steps+1):
        th=-math.pi/2+math.pi*i/steps; c,s=math.cos(th),math.sin(th)
        x=cx+ax*np.sign(c)*abs(c)**(2/n); y=cy+by*np.sign(s)*abs(s)**(2/n); out.append((x,y))
    return out
def se_full(cx,cy,ax,by,n,steps=480):
    return [(cx+ax*np.sign(math.cos(t))*abs(math.cos(t))**(2/n), cy+by*np.sign(math.sin(t))*abs(math.sin(t))**(2/n)) for t in np.linspace(0,2*math.pi,steps,endpoint=False)]
def bowl(left,top,bot,cx,ax,n):
    cy,by=(top+bot)/2,(bot-top)/2
    return [(left,bot),(left,top)]+se_right(cx,ax,n,cy,by)[0:]+[]
U_=pathops.PathOp.UNION; D_=pathops.PathOp.DIFFERENCE
def op(a,b,o): return pathops.op(a,b,o)
L={}
# N
N=G['N']; up=lambda y:N['up'][0]*y+N['up'][1]; lo=lambda y:N['lo'][0]*y+N['lo'][1]
ya=(N['rL']-N['up'][1])/N['up'][0]; yb=(N['sR']-N['lo'][1])/N['lo'][0]
pts=[(N['sL'],BOT),(N['sL'],TOP),(up(TOP),TOP),(N['rL'],ya),(N['rL'],TOP),(N['rR'],TOP),(N['rR'],BOT),(lo(BOT),BOT),(N['sR'],yb),(N['sR'],BOT)]
L['N']=poly_path(pts,{1:60,2:36,3:6,6:32,7:34,8:6})
# O (one centre, one exponent for both contours)
oo,oi=G['Oo'],G['Oi']; ocx=(oo[0]+oi[0])/2; ocy=(oo[1]+oi[1])/2; on=(oo[4]+oi[4])/2
L['O']=op(poly_path(se_full(ocx,ocy,oo[2],oo[3],on),default=0),poly_path(se_full(ocx,ocy,oi[2],oi[3],on),default=0),D_)
# D
do,di=G['Do'],G['Di']; ds=G['Dstem']
outer=[(ds[0],BOT),(ds[0],TOP)]+se_right(do[0],do[1],do[2],do[3],do[4])
inner=[(ds[1],di[3]+di[4]),(ds[1],di[3]-di[4])]+se_right(di[0],di[1],di[2],di[3],di[4])
L['D']=op(poly_path(outer,{0:16,1:16},default=0),poly_path(inner,{0:6,1:6},default=0),D_)
# P and R: stem, bowl, (leg), minus the counter
def stem(x0,x1): return poly_path([(x0,BOT),(x0,TOP),(x1,TOP),(x1,BOT)],{0:16,1:16,2:0,3:16})
def bowl_out(left,top,bot,o): return poly_path([(left,bot),(left,top)]+se_right(o[0],o[1],o[2],(top+bot)/2,(bot-top)/2),{0:0,1:16},default=0)
def bowl_in(left,top,bot,o): return poly_path([(left,bot),(left,top)]+se_right(o[0],o[1],o[2],(top+bot)/2,(bot-top)/2),{0:5,1:5},default=0)
ps=G['Pstem']; pit,pib,pbb=G['bars']['P']
L['P']=op(op(stem(*ps),bowl_out(ps[0],TOP,pbb,G['Po']),U_),bowl_in(ps[1],pit,pib,G['Pi']),D_)
rs=G['Rstem']; rit,rib,rbb=G['bars']['R']; (kl,cl),(kr,cr)=G['Rleg']
ly0=rbb-150   # the leg starts inside the bowl's lower bar
leg=poly_path([(kl*ly0+cl,ly0),(kr*ly0+cr,ly0),(kr*BOT+cr,BOT),(kl*BOT+cl,BOT)],{0:0,1:0,2:14,3:22})
L['R']=op(op(op(stem(*rs),bowl_out(rs[0],TOP,rbb,G['Ro']),U_),leg,U_),bowl_in(rs[1],rit,rib,G['Ri']),D_)
# Λ, made symmetric about its own centre line
A=G['A']; xc=((A['oL'][0]*TOP+A['oL'][1])+(A['oR'][0]*TOP+A['oR'][1]))/2
so=(abs(A['oL'][0])+abs(A['oR'][0]))/2; si=(abs(A['iL'][0])+abs(A['iR'][0]))/2
htop=((A['oR'][0]*TOP+A['oR'][1])-(A['oL'][0]*TOP+A['oL'][1]))/2
yi=( (A['iL'][0]*TOP+A['iL'][1]) - (A['iR'][0]*TOP+A['iR'][1]) )   # unused, recomputed below
# inner apex: where the inner edges meet, on the centre line
xi_top=((A['iL'][1]+A['iR'][1])/2)   # not used
yap=( ( (A['iL'][0]*400+A['iL'][1]) + (A['iR'][0]*400+A['iR'][1]) )/2 )
iy=400-((A['iR'][0]*400+A['iR'][1])-(A['iL'][0]*400+A['iL'][1]))/(2*si)   # inner edges are xc +- si*(y-iy)
oxL=lambda y:xc-htop-so*(y-TOP); oxR=lambda y:xc+htop+so*(y-TOP); ixL=lambda y:xc-si*(y-iy); ixR=lambda y:xc+si*(y-iy)
pts=[(oxL(BOT),BOT),(oxL(TOP),TOP),(oxR(TOP),TOP),(oxR(BOT),BOT),(ixR(BOT),BOT),(xc,iy),(ixL(BOT),BOT)]
L['A']=poly_path(pts,{1:44,2:44,0:14,3:14,4:18,6:18,5:6})
def svgd(p):
    pen=SVGPathPen(None,ntos=lambda v:('%.2f'%v).rstrip('0').rstrip('.')); p.draw(pen); return pen.getCommands()
all_=pathops.Path()
for k in 'NODRAP':
    pass
order=['N','O','R','D','A','P']; d=' '.join(svgd(L[k]) for k in order)
open('word2.d','w').write(d)
xs=[T(G['N']['sL'],0)[0],T(G['Pstem'][0]+0,0)[0]]
print('ok',len(d), 'x from',round(T(G['N']['sL'],0)[0],2),'to',round(T(G['Po'][0]+G['Po'][1],0)[0],2),'y',round(T(0,TOP)[1],2),round(T(0,BOT)[1],2))
