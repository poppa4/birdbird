import asyncio,sys,json,struct,numpy as np,trimesh
from playwright.async_api import async_playwright
GL=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
async def pts():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=GL); pg=await b.new_page(viewport={"width":1440,"height":900})
        await pg.goto("http://localhost:8765/a320-3d.html",wait_until="load"); await pg.wait_for_timeout(20000)
        r=await pg.evaluate("""()=>__a320.X.CT.filter(c=>c.r).map(c=>{const p=A3D.toP(c.r[0]+c.r[2]/2,c.r[1]+c.r[3]/2,0.002);return p?[c.id,p.x,p.y,p.z]:null}).filter(x=>x)""")
        await b.close(); return r
C=asyncio.run(pts())
b=open('/home/claude/birdbird/models/a320-shell.bin','rb').read(); hl=struct.unpack('<I',b[:4])[0]; h=json.loads(b[4:4+hl]); base=4+hl; g=h['groups'][0]
P=np.frombuffer(b,'<i2',g['nv']*3,base+g['off']).reshape(-1,3)/h['S']; o=base+g['off']+g['sizes'][0]+g['sizes'][1]+g['sizes'][2]
I=np.frombuffer(b,'<u4' if g['i32'] else '<u2',g['ni'],o).reshape(-1,3)
M=trimesh.Trimesh(P,I,process=False); R=trimesh.ray.ray_pyembree.RayMeshIntersector(M)
bad={}
for vn,e in {'kaptein':(-0.53,0.63,0.31),'styrmann':(0.53,0.63,0.31),'midt':(0,0.75,0.95)}.items():
    e=np.array(e); T=np.array([c[1:] for c in C]); d=T-e; L=np.linalg.norm(d,axis=1); d/=L[:,None]
    loc,ri,ti=R.intersects_location(np.repeat(e[None],len(T),0),d,multiple_hits=False)
    hd=np.full(len(T),np.inf); hd[ri]=np.linalg.norm(loc-e,axis=1)
    for i in np.nonzero(hd<L-0.004)[0]: bad.setdefault(C[i][0],[]).append(f'{vn}:{(L[i]-hd[i])*1000:.0f}mm')
print(len(C),'controls;',len(bad),'with structure in front')
json.dump({'C':C,'bad':bad},open('/home/claude/occ.json','w'))
for k,v in sorted(bad.items()): print(k,v)
