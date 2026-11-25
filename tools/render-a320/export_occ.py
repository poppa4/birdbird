import asyncio, sys, json
import numpy as np
from playwright.async_api import async_playwright

# Exports, in world space, every visible mesh of the A320 3D page except the structure itself (panels, levers, screens,
# the page's lining behind the structure): the occluders for baking the structure's light. Writes an .npy of triangles.
GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
JS = """()=>{const C=__a320.CK,out=[];C.scene.updateMatrixWorld(true);
 C.scene.traverse(o=>{ if(!o.isMesh) return; let v=true,p=o; while(p){ if(!p.visible){v=false;break} p=p.parent } if(!v) return;
  if(o.geometry.attributes.aMat||o.isInstancedMesh||o.material.type==='ShaderMaterial'||(o.material.color&&o.material.color.getHexString()==='1e2125')) return; const g=o.geometry, pos=g.attributes.position, idx=g.index, m=o.matrixWorld, t=new THREE.Vector3();
  const n=idx?idx.count:pos.count; const P=[]; for(let i=0;i<n;i++){ const k=idx?idx.getX(i):i; t.fromBufferAttribute(pos,k).applyMatrix4(m); P.push(+t.x.toFixed(4),+t.y.toFixed(4),+t.z.toFixed(4)); }
  out.push({P,info:[o.name||'',o.type,o.material.type,o.material.transparent?1:0,(o.material.opacity??1),o.material.colorWrite===false?0:1,o.material.visible===false?0:1,n/3|0]}); });
 return out}"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=GL)
        pg = await b.new_page(viewport={"width": 1280, "height": 800})
        await pg.goto("http://localhost:8765/a320-3d.html", wait_until="load"); await pg.wait_for_timeout(16000)
        r = await pg.evaluate(JS)
        import json
        keep=[]; tags=[]; tags_names=[]
        for a in r:
            if not len(a['P']): continue
            t=np.array(a['P'],np.float32).reshape(-1,3,3); c=t.reshape(-1,3).mean(0); ext=np.ptp(t.reshape(-1,3),0)
            print(a['info'], c.round(2).tolist(), ext.round(2).tolist())
            if a['info'][5]==0 or a['info'][6]==0 or (a['info'][3] and a['info'][4]<0.05): continue
            keep.append(t); tags.extend([len(tags_names)]*len(t)); tags_names.append(str(a['info'])+str(c.round(2).tolist()))
        T = np.concatenate(keep)
        np.save(sys.argv[1], T); np.save(sys.argv[1]+'.tags.npy', np.array(tags)); json.dump(tags_names, open(sys.argv[1]+'.names.json','w')); print('meshes', len(r), 'triangles', len(T))
        await b.close()

asyncio.run(main())
