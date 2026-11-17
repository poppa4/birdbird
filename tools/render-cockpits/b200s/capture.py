import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1500,'height':1500}, device_scale_factor=2.2)
        await pg.goto('http://localhost:8790/b200.html'); await pg.wait_for_timeout(3500)
        info = await pg.evaluate("""(() => { const st=document.getElementById('stage'); st.classList.remove('otwlive'); st.style.background='#0E1114';
          ['otwSky','otw','pill'].forEach(i => { const e=document.getElementById(i); if (e) e.style.display='none'; });
          st.querySelectorAll('[class*=yoke],[id*=yoke]').forEach(e => { e.style.display='none'; });
          const r=st.getBoundingClientRect(), out=[];
          st.querySelectorAll('g.ctl').forEach(g => { const q=g.getBoundingClientRect(); out.push([g.dataset.id, g.getAttribute('aria-label')||'', +(q.left-r.left).toFixed(1), +(q.top-r.top).toFixed(1), +q.width.toFixed(1), +q.height.toFixed(1)]); });
          const R={}; const svg=st.querySelector('svg[viewBox="0 0 2000 1780"]'), sr=svg.getBoundingClientRect(); return {out, w:r.width, h:r.height, svg:[sr.left-r.left, sr.top-r.top, sr.width, sr.height], reg:B200P.REG}; })()""")
        json.dump(info, open('/tmp/b200x.json','w')); print(len(info['out']), info['w'], info['h'], info['svg']); await pg.wait_for_timeout(600); await pg.locator('#stage').screenshot(path='/tmp/b200_stage.png'); await b.close()
asyncio.run(main())
