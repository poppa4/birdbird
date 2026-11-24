import asyncio,sys,json
from playwright.async_api import async_playwright
GL=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
PAGE=sys.argv[1]; D3='3d' in PAGE
SNAP="""()=>{const a=__a320,M=a.M,A=a.A,U=a.UI,K=a.K;const ap={};for(const k in M.ap){const v=M.ap[k];ap[k]=(v&&typeof v==='object')?JSON.stringify(v):(typeof v==='number'?Math.round(v):v)}
  return JSON.stringify({sw:A.sw,ap,ui:{ls:U.ls,fd:U.fd,efis:U.efis,efis2:U.efis2,ann:U.annTest,tla:U.tla,fk:U.fcuKey},ctl:[M.ctl.tla,M.ctl.park,M.ctl.gearLv,M.ctl.flapLv,M.ctl.spArm,M.ctl.spd],sd:A.ecam&&[A.ecam.page,A.ecam.sdPage,A.ecam.user,A.ecam.sts,A.ecam.all,A.ecam.rcl,A.ecam.clr,A.ecam.toc],k:[K.page,K.sp],rud:[A.rudTrim,M.rudTrim,M.ctl.rudTrim],x:[A.xpdr,A.tcas,A.baro,M.baro,U.inp]})}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=GL); pg=await b.new_page(viewport={"width":1440,"height":900}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:200]))
        await pg.goto("http://localhost:8765/"+PAGE,wait_until="load"); await pg.wait_for_timeout(18000 if D3 else 9000)
        if D3: await pg.evaluate("()=>{[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0].scrollIntoView({block:'start'})}"); await pg.wait_for_timeout(500)
        ids=await pg.evaluate("()=>__a320.X.CT.map((c,i)=>[i,c.t,c.id,!!c.r,!!c.guard])")
        dead=[]; ok=0; skipped=[]
        for i,t,cid,hasr,guard in ids:
            if not hasr or t in ('seg','fcu','gearInd','thr','lever','mkey','stick','tiller'): skipped.append((t,cid)); continue
            if D3:
                pos=await pg.evaluate("""i=>{const a=__a320,c=a.X.CT[i],r=c.r,ck=a.CK,h=ck.head,wx=r[0]+r[2]*0.72,wy=r[1]+r[3]*0.72,p=A3D.toP(r[0]+r[2]/2,r[1]+r[3]/2);if(!p)return null;
                  const dv=p.clone().sub(h.eye).normalize();h.tYaw=h.yaw=Math.atan2(-dv.x,-dv.z);h.tPitch=h.pitch=Math.asin(dv.y);h.tFov=h.fov=24;return [wx,wy]}""",i)
                if not pos: skipped.append((t,cid,'not on a panel')); continue
                await pg.wait_for_timeout(480)
                xy=await pg.evaluate("""([wx,wy])=>{const q=__a320.CK.proj(wx,wy);if(!q)return null;const cv=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0].getBoundingClientRect();return [cv.left+(q[0]+1)/2*cv.width,cv.top+(1-q[1])/2*cv.height]}""",pos)
            else:
                xy=await pg.evaluate("""i=>{const c=__a320.X.CT[i];if(!c.el)return null;c.el.scrollIntoView({block:'center',inline:'center'});const r=c.el.getBoundingClientRect();return [r.left+r.width*0.72,r.top+r.height*0.72]}""",i)
            if not xy or not(0<xy[0]<1440 and 0<xy[1]<900): skipped.append((t,cid,'off screen')); continue
            def flat(j):
                d=json.loads(j); o={}
                for k,v in d.items():
                    if isinstance(v,dict):
                        for k2,v2 in v.items(): o[k+'.'+k2]=json.dumps(v2)
                    else: o[k]=json.dumps(v)
                return o
            a0=flat(await pg.evaluate(SNAP)); await pg.wait_for_timeout(90); a1=flat(await pg.evaluate(SNAP)); stable=[k for k in a0 if a0[k]==a1.get(k)]
            async def changed():
                n=flat(await pg.evaluate(SNAP)); return any(n.get(k)!=a0[k] for k in stable)
            ch=False
            for n in range(3 if guard else 2):
                await pg.mouse.click(xy[0],xy[1]); await pg.wait_for_timeout(70)
                if await changed(): ch=True; break
                if t in('sel','selF','cont','tog','knob'):
                    await pg.mouse.move(xy[0],xy[1]); await pg.mouse.wheel(0,-120); await pg.wait_for_timeout(70)
                    if await changed(): ch=True; break
            if ch: ok+=1
            else: dead.append((t,cid)); print('DEAD',t,cid,[round(v) for v in xy],flush=True)
        print(PAGE,'controls',len(ids),'responded',ok,'no state change',len(dead),'skipped',len(skipped))
        print('NO CHANGE:',json.dumps(dead)); print('SKIPPED:',json.dumps(skipped)[:1500]); print('errors',errs[:5]); await b.close()
asyncio.run(main())
