import asyncio,sys
from playwright.async_api import async_playwright
SHOTS=[('cruise','day','Panel'),('short','day','Panel'),('final','day','Panel'),('rwyTO','day','Panel'),('appr','day','Panel'),('climb','day','Panel')]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg=await b.new_page(viewport={'width':1600,'height':1000})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8811/da42-3d.html',wait_until='load')
        await pg.wait_for_function("!document.body.innerText.includes('Simulator loading')",timeout=170000); await pg.wait_for_timeout(4000)
        for i,(k,tod,view) in enumerate(SHOTS):
            await pg.evaluate(f"(()=>{{ window.__own.procSet('{k}'); }})()")
            for _ in range(3):
                lab=await pg.evaluate("(document.getElementById('bTod')||{}).textContent||''")
                if tod.lower() in lab.lower(): break
                await pg.click('#bTod'); await pg.wait_for_timeout(300)
            await pg.get_by_role('button',name=view,exact=True).first.click()
            await pg.wait_for_timeout(2500)
            await pg.mouse.move(800,620); await pg.mouse.down(); await pg.mouse.move(800,760,steps=12); await pg.mouse.up()
            await pg.wait_for_timeout(3500)
            await pg.evaluate("(()=>{ document.querySelectorAll('body *').forEach(e=>e.style.visibility='hidden'); document.querySelectorAll('canvas').forEach(c=>c.style.visibility='visible'); })()")
            await pg.wait_for_timeout(600)
            await pg.screenshot(path=f'/tmp/claude-0/radiohero/sim_{i}.png')
            await pg.evaluate("(()=>{ document.querySelectorAll('body *').forEach(e=>e.style.visibility=''); })()")
        print(errs[:5]); await b.close()
asyncio.run(main())
