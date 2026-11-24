import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":1440,"height":1000}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:160]))
        await pg.goto("http://localhost:8765/a320.html",wait_until="load"); await pg.wait_for_timeout(8000)
        await pg.evaluate("()=>{const c=__a320.X.CT.find(c=>c.t==='mkey'&&c.side===0); (window.openMcdu||(()=>{}))(); }")
        # open by clicking an MCDU key on the panel
        q=await pg.evaluate("""()=>{const a=__a320,c=a.X.CT.find(c=>c.id==='MCDU 1|A'),r=c.r,Z=a.X.Z;a.view('ped');const b=document.getElementById('vp').getBoundingClientRect();return [b.left+Z.tx+(r[0]+r[2]/2)*Z.s,b.top+Z.ty+(r[1]+r[3]/2)*Z.s]}"""); await pg.wait_for_timeout(600)
        q=await pg.evaluate("""()=>{const a=__a320,c=a.X.CT.find(c=>c.id==='MCDU 1|A'),r=c.r,Z=a.X.Z;const b=document.getElementById('vp').getBoundingClientRect();return [b.left+Z.tx+(r[0]+r[2]/2)*Z.s,b.top+Z.ty+(r[1]+r[3]/2)*Z.s]}""")
        await pg.mouse.click(q[0],q[1]); await pg.wait_for_timeout(1200)
        keys=await pg.evaluate("()=>[...document.querySelectorAll('.mcduov .mpane[data-p=live] button[data-k]')].map(b=>b.dataset.k)")
        print('overlay open:',await pg.evaluate("()=>!!document.querySelector('.mcduov')"),'keys in overlay',len(keys))
        sp=lambda: pg.evaluate("()=>JSON.stringify([__a320.K.sp,__a320.K.page,__a320.K.changed])")
        dead=[]; res={}
        for k in keys:
            a=await sp(); await pg.click(f'.mcduov .mpane[data-p=live] button[data-k="{k}"]',force=True); await pg.wait_for_timeout(60); c=await sp()
            if a==c: dead.append(k)
        print('no reaction:',dead); print('final',await sp(),errs[:3]); await b.close()
asyncio.run(main())
