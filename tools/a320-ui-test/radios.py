import asyncio,sys,json
from playwright.async_api import async_playwright
GL=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]
PAGE=sys.argv[1]; D3='3d' in PAGE
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=GL); pg=await b.new_page(viewport={"width":1440,"height":900 if D3 else 2000}); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)[:200]))
        dlg=[]; 
        async def ond(d): dlg.append(d.message); await d.accept("127.855")
        pg.on("dialog",lambda d: asyncio.ensure_future(ond(d)))
        await pg.goto("http://localhost:8765/"+PAGE,wait_until="load"); await pg.wait_for_timeout(18000 if D3 else 9000)
        if D3: await pg.evaluate("()=>{[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0].scrollIntoView({block:'start'})}"); await pg.wait_for_timeout(500)
        async def xy(cid,fx=0.5,fy=0.5):
            if D3:
                await pg.evaluate("""cid=>{const a=__a320,c=a.X.CT.find(c=>c.id===cid),r=c.r,h=a.CK.head,p=A3D.toP(r[0]+r[2]/2,r[1]+r[3]/2);const dv=p.clone().sub(h.eye).normalize();h.tYaw=h.yaw=Math.atan2(-dv.x,-dv.z);h.tPitch=h.pitch=Math.asin(dv.y);h.tFov=h.fov=20}""",cid); await pg.wait_for_timeout(550)
                return await pg.evaluate("""([cid,fx,fy])=>{const a=__a320,c=a.X.CT.find(c=>c.id===cid),r=c.r,q=a.CK.proj(r[0]+r[2]*fx,r[1]+r[3]*fy);const cv=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0].getBoundingClientRect();return [cv.left+(q[0]+1)/2*cv.width,cv.top+(1-q[1])/2*cv.height]}""",[cid,fx,fy])
            return await pg.evaluate("""([cid,fx,fy])=>{const a=__a320,c=a.X.CT.find(c=>c.id===cid),r=c.r,Z=a.X.Z;const want=r[1]<800?'ovhd':r[1]<1140?'main':'ped';if(Z.reg!==want)a.view(want);
              const vp=document.getElementById('vp')||document.querySelector('.vp');const b=vp.getBoundingClientRect();return [b.left+Z.tx+(r[0]+r[2]*fx)*Z.s,b.top+Z.ty+(r[1]+r[3]*fy)*Z.s,Z.reg]}""",[cid,fx,fy])
        async def click(cid,fx=0.5,fy=0.5):
            p_=await xy(cid,fx,fy); await pg.wait_for_timeout(250); p_=await xy(cid,fx,fy); await pg.mouse.click(p_[0],p_[1]); await pg.wait_for_timeout(150)
        async def wheel(cid,n):
            p_=await xy(cid); await pg.wait_for_timeout(250); p_=await xy(cid); await pg.mouse.move(p_[0],p_[1])
            for _ in range(abs(n)): await pg.mouse.wheel(0,-100 if n>0 else 100); await pg.wait_for_timeout(40)
        st=lambda: pg.evaluate("()=>{const c=__a320.A.com;return JSON.stringify({f:c.f,r0:[c.rmp[0].view,c.rmp[0].on,c.rmp[0].nav],r1:c.rmp[1].view,tx:c.acp.map(a=>a.tx),rxv1:c.acp[0].rx['VHF 3'],ir:c.acp[0].ir,voice:c.acp[0].voice,x:__a320.A.sw.xpdr,md:__a320.A.sw.atcMd,tcas:__a320.A.sw.tcas,wx:c.wx,atc:c.atc})}")
        R=[]
        def ck(name,cond,info=''): R.append((name,bool(cond),info)); print(('PASS ' if cond else 'FAIL ')+name,info,flush=True)
        txt=lambda cid: pg.evaluate("cid=>__a320.X.CT.find(c=>c.id===cid).txt()",cid)
        ck('RMP 1 shows VHF 1 active 118.700 / standby 121.500', await txt('RMP 1|RMP 1 ACTIVE')=='118.700' and await txt('RMP 1|RMP 1 STBY/CRS')=='121.500', await txt('RMP 1|RMP 1 ACTIVE'))
        await wheel('RMP 1|RMP 1 FREQ',3); ck('knob: 3 small steps up -> 121.515', await txt('RMP 1|RMP 1 STBY/CRS')=='121.515', await txt('RMP 1|RMP 1 STBY/CRS'))
        await wheel('RMP 1|RMP 1 FREQ',1); ck('knob: 8.33 spacing skips .020 -> 121.525', await txt('RMP 1|RMP 1 STBY/CRS')=='121.525', await txt('RMP 1|RMP 1 STBY/CRS'))
        await click('RMP 1|RMP 1 FREQ',0.5,0.2); ck('knob: click top = +1 MHz -> 122.525', await txt('RMP 1|RMP 1 STBY/CRS')=='122.525', await txt('RMP 1|RMP 1 STBY/CRS'))
        await click('RMP 1|XFER'); ck('transfer swaps active and standby', await txt('RMP 1|RMP 1 ACTIVE')=='122.525' and await txt('RMP 1|RMP 1 STBY/CRS')=='118.700', await txt('RMP 1|RMP 1 ACTIVE'))
        await click('RMP 1|TYPE STBY'); await pg.wait_for_timeout(400); ck('typing 127.855 in the standby window -> 127.855', await txt('RMP 1|RMP 1 STBY/CRS')=='127.855', str(dlg[-1:])+' '+await txt('RMP 1|RMP 1 STBY/CRS'))
        await click('RMP 1|VHF 2'); ck('VHF 2 key: windows show VHF 2 (121.500 / 124.350)', await txt('RMP 1|RMP 1 ACTIVE')=='121.500' and await txt('RMP 1|RMP 1 STBY/CRS')=='124.350', await txt('RMP 1|RMP 1 ACTIVE'))
        ck('RMP 2 sees the same VHF 2 frequencies', await txt('RMP 2|RMP 2 ACTIVE')=='121.500')
        await click('RMP 1|VHF 3'); ck('VHF 3 active is DATA', await txt('RMP 1|RMP 1 ACTIVE')=='DATA', await txt('RMP 1|RMP 1 ACTIVE'))
        await click('RMP 1|HF 1'); await click('RMP 1|AM'); s=json.loads(await st()); ck('HF 1 selected and AM on', s['r0'][0]=='HF 1' and await pg.evaluate("()=>__a320.A.com.am['HF 1']")==1, await txt('RMP 1|RMP 1 ACTIVE'))
        await click('RMP 1|VOR'); s=json.loads(await st()); ck('VOR key does nothing while NAV is off', s['r0'][0]=='HF 1')
        await click('RMP 1|NAV'); await click('RMP 1|ILS'); await wheel('RMP 1|RMP 1 FREQ',4); a=await txt('RMP 1|RMP 1 STBY/CRS'); await click('RMP 1|XFER'); ck('NAV on, ILS tuned 110.50 and transferred, window then shows the course', a=='110.50' and await txt('RMP 1|RMP 1 ACTIVE')=='110.50' and (await txt('RMP 1|RMP 1 STBY/CRS')).startswith('C-'), a+' '+await txt('RMP 1|RMP 1 STBY/CRS'))
        await wheel('RMP 1|RMP 1 FREQ',5); ck('course set with the knob: C-005', await txt('RMP 1|RMP 1 STBY/CRS')=='C-005', await txt('RMP 1|RMP 1 STBY/CRS'))
        await click('RMP 1|VHF 1'); await click('RMP 1|RMP 1 ON/OFF'); ck('RMP 1 OFF: windows dark', await txt('RMP 1|RMP 1 ACTIVE')=='' , repr(await txt('RMP 1|RMP 1 ACTIVE'))); await click('RMP 1|RMP 1 ON/OFF'); ck('RMP 1 ON again', await txt('RMP 1|RMP 1 ACTIVE')=='122.525', await txt('RMP 1|RMP 1 ACTIVE'))
        await click('ACP 1|VHF 2 TX'); s=json.loads(await st()); ck('ACP 1: transmit key VHF 2', s['tx'][0]=='VHF 2', str(s['tx']))
        await click('ACP 1|VHF 3 VOL'); s=json.loads(await st()); ck('ACP 1: VHF 3 reception knob pressed -> on', s['rxv1'][0]==1, str(s['rxv1']))
        await wheel('ACP 1|VHF 3 VOL',4); s=json.loads(await st()); ck('ACP 1: VHF 3 volume up to 80 %', abs(s['rxv1'][1]-0.8)<0.01, str(s['rxv1']))
        await click('ACP 1|VOICE'); s=json.loads(await st()); ck('ACP 1: VOICE on', s['voice']==1)
        await click('ACP 1|INT/RAD',0.5,0.9); s=json.loads(await st()); ck('ACP 1: INT/RAD switch to RAD', s['ir']==0, str(s['ir']))
        await click('ACP 2|VHF 1 TX F/O'); await click('ACP 3|HF 1 TX OVHD'); s=json.loads(await st()); ck('ACP 2 and ACP 3 (overhead) transmit keys', s['tx'][1]=='VHF 1' and s['tx'][2]=='HF 1', str(s['tx']))
        for k in '4217': await click('ATC / TCAS|KEY '+k)
        s=json.loads(await st()); ck('squawk 4217 typed on the keypad', s['x']=='4217' and await txt('ATC / TCAS|XPDR CODE')=='4217', s['x'])
        await click('ATC / TCAS|KEY CLR'); await click('ATC / TCAS|KEY 0'); s=json.loads(await st()); ck('CLR removes the last digit, 0 completes 4210', s['x']=='4210', s['x'])
        await wheel('ATC / TCAS|TCAS MODE',3); s=json.loads(await st()); ck('mode knob to TA/RA: TCAS armed', s.get('md')==4 and s['tcas']==2, str(s.get('md')))
        await click('ATC / TCAS|IDENT'); s=json.loads(await st()); ck('IDENT pressed', s['atc']['ident']>0)
        await wheel('WX RADAR|TILT',4); await wheel('WX RADAR|GAIN',-3); await click('WX RADAR|WX SYS',0.1,0.5); s=json.loads(await st()); ck('weather radar: tilt +2°, gain -3, SYS 1', s['wx']['tilt']==2 and s['wx']['gain']==-3 and s['wx']['sys']==1, str(s['wx']))
        if D3:
            await pg.evaluate("""()=>{const a=__a320,h=a.CK.head,p=A3D.toP(389,1330);const dv=p.clone().sub(h.eye).normalize();h.tYaw=h.yaw=Math.atan2(-dv.x,-dv.z);h.tPitch=h.pitch=Math.asin(dv.y);h.tFov=h.fov=17}"""); await pg.wait_for_timeout(1200)
        else:
            await pg.evaluate("()=>{const c=__a320.X.CT.find(c=>c.id==='ACP 1|VOICE');c.el&&c.el.scrollIntoView({block:'center',inline:'center'})}"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=f"/home/claude/shots/rad-{'3d' if D3 else '2d'}.png")
        print(sum(1 for r in R if r[1]),'of',len(R),'passed; errors',errs[:4]); await b.close()
asyncio.run(main())
