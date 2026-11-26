exec(open('fit.py').read().split("for name")[0])
TOP,BOT=287.0,1358.0
def vedge(x0,x1,which,ys):
    v=[]
    for y in ys:
        r=runs(y,x0,x1)
        if r: v.append(r[0][0] if which=='L' else r[0][1])
    return float(np.median(v))
def se2(pts,init,sym=True):
    a=np.array(pts,float)
    def res(p):
        cx,cy,ax,by,n,mm=p; t=np.clip(np.abs((a[:,0]-cy)/by),0,0.99999)
        return np.abs(a[:,1]-cx)-ax*(1-t**mm)**(1/n)
    s=least_squares(res,init,bounds=([-1e5,-1e5,1,1,1.2,1.2],[1e5,1e5,1e4,1e4,12,12])); return [float(v) for v in s.x], float(np.sqrt(np.mean(s.fun**2)))
def half2(p,ytop,ybot,init):
    a=np.array(p,float); cy=(ytop+ybot)/2; by=(ybot-ytop)/2
    def res(q):
        cx,ax,n,mm=q; t=np.clip(np.abs((a[:,0]-cy)/by),0,0.99999); return a[:,1]-(cx+ax*(1-t**mm)**(1/n))
    s=least_squares(res,init,bounds=([-1e5,1,1.2,1.2],[1e5,1e4,12,12])); return [float(v) for v in s.x]+[cy,by], float(np.sqrt(np.mean(s.fun**2)))
G={'TOP':TOP,'BOT':BOT}
# N
G['N']={'sL':[3553.0,3847.0],'rS':[4547.0,4840.0]}
lo=[];up=[]
for y in range(560,1000,3):
    r=runs(y,3540,4860)
    if len(r)==3: lo.append((y,r[1][0])); up.append((y,r[1][1]))
G['N']['lo'],_=line(lo); G['N']['up'],_=line(up)
# O
oo=[];oi=[]
for y in range(272,1374,2):
    r=runs(y,4960,6300)
    if not r: continue
    oo+=[(y,r[0][0]),(y,r[-1][1])]
    if len(r)==2: oi+=[(y,r[0][1]),(y,r[1][0])]
ys=[q[0] for q in oi]; print('O inner y',min(ys),max(ys))
G['Oo'],e1=se2(oo,[5630,823,657,553,2.2,2.2]); G['Oi'],e2=se2(oi,[5627,823,355,290,2.5,3]); print('O',G['Oo'],e1,G['Oi'],e2)
def bowl_pts(x0,x1f,ylo,yhi,which,xmin):
    p=[]
    for y in range(int(ylo),int(yhi)):
        x1=int(x1f(y)) if callable(x1f) else x1f
        r=runs(y,x0,x1)
        if not r: continue
        if which=='out': v=r[-1][1]
        elif len(r)>=2: v=r[1][0]
        else: continue
        if v>xmin: p.append((y,v))
    return p
# R
G['Rstem']=[6427.0,6720.0]; G['Rbars']=[517,770,994]
G['Ro'],e=half2(bowl_pts(6400,7700,TOP+3,880,'out',7150),TOP,994,[7232,400,2.3,2.3]); print('R out',G['Ro'],e)
G['Ri'],e=half2(bowl_pts(6400,7700,517+2,770-2,'in',7050),517,770,[7116,177,2.3,2.3]); print('R in',G['Ri'],e)
ll=[];lr=[]
for y in range(1060,1340,3):
    r=runs(y,6800,7700)
    if r: ll.append((y,r[0][0])); lr.append((y,r[0][1]))
G['Rleg']=[line(ll)[0],line(lr)[0]]
# D (keep clear of A)
aoL=lambda y:-0.5294*y+9662.7
G['Dstem']=[7745.0,8043.0]; G['Dbars']=[518,1116]
G['Do'],e=half2(bowl_pts(7700,lambda y:aoL(y)-25,TOP+3,BOT-3,'out',8500),TOP,BOT,[8500,550,2.3,2.3]); print('D out',G['Do'],e)
G['Di'],e=half2(bowl_pts(7700,lambda y:aoL(y)-25,518+2,1116-2,'in',8350),518,1116,[8344,345,2.3,2.3]); print('D in',G['Di'],e)
# P
G['Pstem']=[10525.0,10837.0]; G['Pbars']=[517,783,1010]
G['Po'],e=half2(bowl_pts(10500,11700,TOP+3,1008,'out',11150),TOP,1010,[11150,520,2.3,2.3]); print('P out',G['Po'],e)
G['Pi'],e=half2(bowl_pts(10500,11700,517+2,783-2,'in',11050),517,783,[11100,250,2.3,2.3]); print('P in',G['Pi'],e)
# A
oL=[];oR=[];iL=[];iR=[]
for y in range(int(TOP)+2,int(BOT)-2,2):
    r=runs(y,max(9000,int(aoL(y))-40),10460)
    if not r: continue
    if TOP+60<y<BOT-30: oL.append((y,r[0][0])); oR.append((y,r[-1][1]))
    if len(r)==2 and (565<y<905 or 1135<y<1345): iL.append((y,r[0][1])); iR.append((y,r[1][0]))
A={}
A['oL'],e1=line(oL); A['oR'],e2=line(oR); A['iL'],e3=line(iL); A['iR'],e4=line(iR); print('A',A,e1,e2,e3,e4)
A['bar']=[920,1122]; A['ctop']=550
G['A']=A
json.dump(G,open('oldgeo.json','w'),indent=1,default=float)
