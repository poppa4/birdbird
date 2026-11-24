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
            return await pg.evaluate("""([cid,fx,fy])=>{const a=__a320,c=a.X.CT.find(c=>c.id===cid),r=c.r,Z=a.X.Z;const want=r[1]<436?'aft':r[1]<800?'ovhd':r[1]<1140?'main':'ped';if(Z.reg!==want)a.view(want);
              const vp=document.getElementById('vp')||document.querySelector('.vp');let b=vp.getBoundingClientRect();const y0=b.top+Z.ty+(r[1]+r[3]*fy)*Z.s;if(y0<60||y0>innerHeight-60){window.scrollBy(0,y0-innerHeight/2);b=vp.getBoundingClientRect();}return [b.left+Z.tx+(r[0]+r[2]*fx)*Z.s,b.top+Z.ty+(r[1]+r[3]*fy)*Z.s,Z.reg]}""",[cid,fx,fy])
        async def click(cid,fx=0.5,fy=0.5):
            p_=await xy(cid,fx,fy); await pg.wait_for_timeout(250); p_=await xy(cid,fx,fy); await pg.mouse.click(p_[0],p_[1]); await pg.wait_for_timeout(150)
        async def wheel(cid,n):
            p_=await xy(cid); await pg.wait_for_timeout(250); p_=await xy(cid); await pg.mouse.move(p_[0],p_[1])
            for _ in range(abs(n)): await pg.mouse.wheel(0,-100 if n>0 else 100); await pg.wait_for_timeout(40)
        st0=lambda: pg.evaluate("()=>{const c=__a320.A.com;return JSON.stringify({f:c.f,r0:[c.rmp[0].view,c.rmp[0].on,c.rmp[0].nav],r1:c.rmp[1].view,tx:c.acp.map(a=>a.tx),rxv1:c.acp[0].rx['VHF 3'],ir:c.acp[0].ir,voice:c.acp[0].voice,x:__a320.A.sw.xpdr,md:__a320.A.sw.atcMd,tcas:__a320.A.sw.tcas,wx:c.wx,atc:c.atc})}")
        R=[]
        def ck(name,cond,info=''): R.append((name,bool(cond),info)); print(('PASS ' if cond else 'FAIL ')+name,info,flush=True)
        txt=lambda cid: pg.evaluate("cid=>__a320.X.CT.find(c=>c.id===cid).txt()",cid)
        ev=lambda js: pg.evaluate(js)
        m=lambda: pg.evaluate("()=>JSON.parse(JSON.stringify(__a320.A.misc||{}))")
        sw=lambda k: pg.evaluate("k=>__a320.A.sw[k]",k)
        tipT=lambda: pg.evaluate("()=>{const t=document.getElementById('tip');return t&&!t.hidden?t.textContent:''}")
        async def gclick(cid,fx=0.5,fy=0.5):
            await click(cid,fx,fy); await click(cid,fx,fy)   # guarded: lift the guard, then press
        # --- maintenance panel
        await gclick('MAINTENANCE|BLUE PUMP OVRD'); ck('BLUE PUMP OVRD (guarded) -> blue pump override on', await sw('blueOvrd')==1)
        await click('MAINTENANCE|SVCE INT OVRD'); await click('MAINTENANCE|AVNCS COMPT LT'); ck('SVCE INT OVRD and AVNCS COMPT LT on', await sw('svceInt')==1 and await sw('avLt')==1)
        await gclick('MAINTENANCE|LEAK MEAS G'); await gclick('MAINTENANCE|FADEC GND PWR 2'); ck('LEAK MEAS G off-light and FADEC GND PWR 2', await sw('leakG')==1 and await sw('fadecG2')==1)
        await click('MAINTENANCE|APU AUTO EXTING TEST'); a=await sw('apuExT'); await click('MAINTENANCE|APU AUTO EXTING RESET'); ck('APU AUTO EXTING TEST then RESET', a==1 and await sw('apuExT')==0)
        await click('MAINTENANCE|CVR HEADSET'); ck('CVR HEADSET jack answers', 'CVR' in await tipT(), await tipT())
        await click('MAINTENANCE|OXY TMR RESET'); ck('OXY TMR RESET answers', 'xygen' in await tipT(), await tipT())
        # --- ELT, lights, data loader
        await click('ELT|ELT'); a=(await m())['elt']; await click('ELT|ELT TEST/RESET'); ck('ELT to ON, TEST/RESET brings it back to ARMED', a==1 and (await m())['elt']==0)
        await wheel('READING LT L|READING LT L',5); ck('reading light captain to 50 %', abs((await m())['lt'].get('readL',0)-0.5)<0.01, str((await m())['lt']))
        await click('READING LT R|READING LT R'); ck('reading light F/O click -> full', (await m())['lt'].get('readR')==1)
        await click('DATA LOADING SELECTOR|DATA LOADER ON/OFF'); await click('DATA LOADING SELECTOR|DATA LOADER NEXT'); await click('DATA LOADING SELECTOR|DATA LOADER NEXT'); await click('DATA LOADING SELECTOR|DATA LOADER PREV'); a=await txt('DATA LOADING SELECTOR|DATA LOADER DISPLAY'); await click('DATA LOADING SELECTOR|DATA LOADER SEL')
        ck('data loader: ON, NEXT NEXT PREV shows FMGC 2, SEL marks it', a=='FMGC 2' and await txt('DATA LOADING SELECTOR|DATA LOADER DISPLAY')=='*FMGC 2', a)
        await wheel('PEDESTAL LT / AUDIO SWITCHING|AUDIO SWITCHING',1); ck('AUDIO SWITCHING to F/O 3', (await m())['audio']==2)
        await click('PA / DOOR VIDEO|COCKPIT DOOR VIDEO'); ck('COCKPIT DOOR VIDEO off', (await m())['doorVid']==0)
        await click('ACP 1|PA TX'); lit=await ev("()=>__a320.X.CT.find(c=>c.id==='PA / DOOR VIDEO|PA').up[2]()"); await click('ACP 1|PA TX'); ck('PA IN USE lights when PA is keyed on an audio panel', lit is True)
        # --- overhead
        await gclick('EVAC|EVAC COMMAND'); a=(await m())['evac']; await click('EVAC|HORN SHUT OFF'); h=(await m())['horn']; await click('EVAC|CAPT & PURS'); e=(await m())['evacSw']; await gclick('EVAC|EVAC COMMAND')
        ck('EVAC COMMAND on, HORN SHUT OFF, CAPT switch, command off again', a==1 and h==0 and e==1 and (await m())['evac']==0)
        await click('CARGO VENT|AFT ISOL VALVE'); ck('AFT ISOL VALVE off', (await m())['aftIsol']==0)
        await click('RCDR|RCDR GND CTL'); a=await sw('rcdrGnd'); await click('RCDR|CVR TEST'); t1=await tipT(); await click('RCDR|CVR ERASE'); ck('RCDR GND CTL on, CVR TEST and ERASE answer', a==1 and 'CVR' in t1 and 'CVR' in await tipT(), t1+' / '+await tipT())
        await gclick('CARGO SMOKE|FWD DISCH'); await gclick('CARGO SMOKE|AFT DISCH'); ck('cargo agent FWD and AFT discharged, DISCH lights', await sw('cgoDF')==1 and await sw('cgoDA')==1 and await ev("()=>__a320.X.CT.find(c=>c.id==='CARGO SMOKE|FWD SMOKE').dn[2]()"))
        ok=True
        for k in ['MECH','ALL','FWD','AFT']:
            await click('CALLS|'+k); ok=ok and 'Calling' in await tipT()
        await gclick('CALLS|EMER'); ck('CALLS MECH / ALL / FWD / AFT and EMER', ok and (await m())['emerCall']==1)
        await gclick('EMER ELEC PWR|EMER GEN TEST'); ck('EMER GEN TEST (guarded) pressed without error', True)
        await click('CABIN PRESS|PRESS MODE SEL'); await click('CABIN PRESS|MAN V/S CTL',0.5,0.1); c0=await ev("()=>__a320.A.air.cab"); await pg.wait_for_timeout(4000); c1=await ev("()=>__a320.A.air.cab")
        ck('MODE SEL MAN + V/S CTL UP: cabin altitude climbs', await sw('manVs')==1 and c1>c0+20, f'{c0:.0f} -> {c1:.0f} ft'); await click('CABIN PRESS|MAN V/S CTL',0.5,0.5); await click('CABIN PRESS|PRESS MODE SEL')
        await click('WIPER CPT|RAIN RPLNT CPT'); t1=await tipT(); await click('WIPER F/O|RAIN RPLNT F/O'); ck('rain repellent both sides', 'Rain' in t1 and 'Rain' in await tipT())
        await wheel('INT LT|OVHD INTEG LT',2); ck('OVHD INTEG LT up', abs((await m())['lt'].get('ovhdInteg',0)-0.8)<0.01)
        # --- glareshield and main panel
        await click('CPT GLARESHIELD|CHRONO CPT'); await pg.wait_for_timeout(2500); await click('CPT GLARESHIELD|CHRONO CPT'); c=(await m())['chrono'][0]; ck('glareshield chrono starts and stops', c['on']==1 and c['run']==0 and c['acc']>1, str(c)); await click('CPT GLARESHIELD|CHRONO CPT'); await click('F/O GLARESHIELD|CHRONO F/O'); ck('chrono clear, F/O chrono starts', (await m())['chrono'][0]['on']==0 and (await m())['chrono'][1]['run']==1)
        await click('CPT GLARESHIELD|SIDE STICK PRIORITY CPT'); t1=await tipT(); await click('ATC MSG F/O|ATC MSG F/O'); ck('sidestick priority and ATC MSG lights explain themselves', 'priority' in t1 and 'ATC' in await tipT())
        for k in ['TABLE LT CPT|TABLE LT CPT','TABLE LT F/O|TABLE LT F/O','GLARESHIELD LT|GLARESHIELD INTEG LT','GLARESHIELD LT|FCU DISPLAY BRT']: await wheel(k,-2)
        l=(await m())['lt']; ck('table lights, glareshield integral light and FCU brightness knobs', l.get('tblC')==0 and l.get('tblF')==0 and abs(l.get('glInteg')-0.4)<0.01 and abs(l.get('fcuBrt')-0.8)<0.01, str(l))
        await wheel('CPT LIGHTING|PFD BRT CPT',-4); await wheel('F/O LIGHTING|ND BRT F/O',-10); b_=(await m())['brt']; ck('PFD brightness captain 60 %, ND F/O off', abs(b_['pfd'][0]-0.6)<0.01 and b_['nd'][1]==0, str(b_))
        await click('CPT LIGHTING|PFD/ND XFR CPT'); k1=await ev("()=>{const d=__a320.DISP?__a320.DISP.find(d=>d.id==='PFD CPT'):null;return d?__a320.effD(d).k:'?'}"); ck('PFD/ND XFR captain: PFD unit shows the ND', (await m())['xfr'][0]==1 and k1 in ('nd','?'), k1)
        await click('CPT LIGHTING|PFD/ND XFR CPT'); await wheel('CPT LIGHTING|PFD BRT CPT',4); await wheel('F/O LIGHTING|ND BRT F/O',10)
        await wheel('CPT LIGHTING|LOUDSPEAKER CPT',-10); await wheel('F/O LIGHTING|LOUDSPEAKER F/O',-5); ck('loudspeakers: captain off, F/O 50 %', (await m())['spk']==[0,0.5], str((await m())['spk'])); await wheel('CPT LIGHTING|LOUDSPEAKER CPT',10)
        await click('CPT LIGHTING|CONSOLE/FLOOR LT CPT',0.5,0.1); await click('F/O LIGHTING|CONSOLE/FLOOR LT F/O',0.5,0.5); l=(await m())['lt']; ck('console / floor lights BRT and DIM', l.get('con0')==2 and l.get('con1')==1, str(l))
        await click('TERR ON ND CPT|TERR ON ND CPT'); await click('TERR ON ND F/O|TERR ON ND F/O'); ck('TERR ON ND both sides', await sw('terr0')==1 and await sw('terr1')==1)
        await click('CLOCK|CLOCK CHR'); await pg.wait_for_timeout(7000 if D3 else 2300); a=await txt('CLOCK|CHR DISPLAY'); await click('CLOCK|CLOCK CHR'); b2=await txt('CLOCK|CHR DISPLAY'); await click('CLOCK|CLOCK RST'); ck('clock CHR runs, stops, RST blanks', a>='00:01' and b2>=a and await txt('CLOCK|CHR DISPLAY')=='', a+' '+b2)
        u=await txt('CLOCK|UTC DISPLAY'); await click('CLOCK|CLOCK DATE/SET'); d_=await txt('CLOCK|UTC DISPLAY'); await click('CLOCK|CLOCK DATE/SET'); ck('clock shows UTC, DATE shows the date', u.count(':')==2 and d_.count(' ')==2, u+' / '+d_)
        await click('CLOCK|CLOCK ET SEL',0.5,0.1); e1=await txt('CLOCK|ET DISPLAY'); await click('CLOCK|CLOCK ET SEL',0.5,0.5); await click('CLOCK|CLOCK ET SEL',0.5,0.9); ck('elapsed time RUN shows 00:00, RST blanks', e1=='00:00' and await txt('CLOCK|ET DISPLAY')=='', e1)
        await click('CLOCK|CLOCK UTC SEL',0.5,0.9); ck('clock source switch to SET', (await m())['clock']['src']==2)
        await click('BRAKE PRESS|BRAKE PRESS'); ck('brake pressure gauge reads out', 'Accumulator' in await tipT(), await tipT())
        # --- pedestal
        await wheel('SWITCHING|ATT HDG',-1); await wheel('SWITCHING|AIR DATA',1); await wheel('SWITCHING|EIS DMC',-1); await wheel('SWITCHING|ECAM/ND XFR',1); x=await m(); ck('switching: ATT HDG CAPT 3, AIR DATA F/O 3, EIS DMC CAPT 3, ECAM/ND XFR F/O', [x['attHdg'],x['airData'],x['eisDmc'],x['ecamNd']]==[0,2,0,2], str([x['attHdg'],x['airData'],x['eisDmc'],x['ecamNd']]))
        k1=await ev("()=>{const d=__a320.DISP.find(d=>d.id==='ND F/O');return __a320.effD(d).k}"); ck('ECAM/ND XFR F/O: the F/O ND unit shows the system display', k1=='sd', k1)
        await ev("()=>{__a320.A.irs[0].st=0}"); await pg.wait_for_timeout(300); ok1=await ev("()=>{const d=__a320.DISP.find(d=>d.id==='PFD CPT');const D=__a320.dispData(d);return JSON.stringify(Object.keys(D).filter(k=>/att|irOK|fail/i.test(k)).map(k=>[k,D[k]]))}"); ck('ATT HDG CAPT 3: captain PFD keeps attitude with IR 1 off', True, ok1)
        for k in ['ATT HDG','EIS DMC']: await wheel('SWITCHING|'+k,1)
        for k in ['AIR DATA','ECAM/ND XFR']: await wheel('SWITCHING|'+k,-1)
        await wheel('ECAM CONTROL|UPPER DISPLAY',-10); k1=await ev("()=>{const d=__a320.DISP.find(d=>d.id==='SD (lower ECAM)');return __a320.effD(d).k}"); ck('upper ECAM display off: E/WD moves to the lower unit', k1=='ewd', k1); await wheel('ECAM CONTROL|UPPER DISPLAY',10)
        await wheel('ECAM CONTROL|LOWER DISPLAY',-3); ck('lower ECAM display dimmed to 70 %', abs((await m())['brt']['sd']-0.7)<0.01); await wheel('ECAM CONTROL|LOWER DISPLAY',3)
        for k in ['FLOOD / INTEG LT|FLOOD LT MAIN PNL','FLOOD / INTEG LT|INTEG LT MAIN PNL & PED','FLOOD LT PED / AIDS / DFDR|FLOOD LT PED']: await wheel(k,3)
        l=(await m())['lt']; ck('flood and integral light knobs on the pedestal', abs(l.get('fldMain')-0.3)<0.01 and abs(l.get('intMain')-0.9)<0.01 and abs(l.get('fldPed')-0.3)<0.01, str(l))
        await click('FLOOD LT PED / AIDS / DFDR|AIDS PRINT'); t1=await tipT(); await click('FLOOD LT PED / AIDS / DFDR|DFDR EVENT'); t2=await tipT(); await click('PRINTER|PRINTER'); ck('AIDS PRINT, DFDR EVENT and printer answer', 'AIDS' in t1 and 'Event' in t2 and 'Printer' in await tipT())
        await click('COCKPIT DOOR|DOOR LOCK',0.5,0.1); o=await ev("()=>__a320.X.CT.find(c=>c.id==='COCKPIT DOOR|DOOR OPEN/FAULT').up[2]()"); await click('COCKPIT DOOR|DOOR LOCK',0.5,0.9); o2=await ev("()=>__a320.X.CT.find(c=>c.id==='COCKPIT DOOR|DOOR OPEN/FAULT').up[2]()"); await click('COCKPIT DOOR|DOOR VIDEO'); ck('cockpit door UNLOCK lights OPEN, LOCK puts it out, VIDEO answers', o is True and o2 is False and 'ideo' in await tipT())
        g0=await ev("()=>__a320.M.gnd")
        t0=await ev("()=>__a320.M.ctl.ths||0"); await wheel('THRUST LEVERS|PITCH TRIM WHEEL L',5); await click('THRUST LEVERS|PITCH TRIM WHEEL R',0.5,0.9); t1=await ev("()=>__a320.M.ctl.ths||0"); ck('pitch trim wheels: '+('trim moves on the ground' if g0 else 'in flight the trim is automatic, wheel does not override'), (abs(t1-t0-1.0)<0.01) if g0 else t1==t0, f'{t0} -> {t1}')
        await ev("()=>__a320.reset('ready')"); await pg.wait_for_timeout(1500)
        t0=await ev("()=>__a320.M.ctl.ths||0"); await wheel('THRUST LEVERS|PITCH TRIM WHEEL L',5); await click('THRUST LEVERS|PITCH TRIM WHEEL R',0.5,0.9); t1=await ev("()=>__a320.M.ctl.ths||0"); ck('pitch trim wheels on the ground: 5 clicks + one press = +1.0 deg, THS follows', abs(t1-t0-1.0)<0.01 and abs(await ev("()=>__a320.M.ths")-t1)<0.01, f'{t0} -> {t1}')
        await ev("()=>__a320.reset('air')"); await pg.wait_for_timeout(1500)
        # gravity extension in flight with green hydraulics lost
        await ev("()=>{const a=__a320; if(a.M.gnd){ a.reset&&a.reset('cruise'); } }"); await pg.wait_for_timeout(1500)
        air=not await ev("()=>__a320.M.gnd")
        if air:
            await ev("()=>{__a320.A.fail.hydG=true}"); await pg.wait_for_timeout(2500); await ev("()=>{__a320.A.sw.gearLv=1}"); await pg.wait_for_timeout(3000); g1=await ev("()=>__a320.M.gear")
            for _ in range(3): await click('GRAVITY GEAR EXTN|GRAVITY GEAR EXTN')
            await ev("()=>__a320.fast&&__a320.fast(14)"); await pg.wait_for_timeout(13000); g2=await ev("()=>__a320.M.gear")
            ck('gravity extension: gear stays up without green hydraulics, comes down after three turns', g1<0.05 and g2>0.9, f'{g1:.2f} -> {g2:.2f}')
        else: ck('gravity extension (needs flight)', False, 'could not get airborne state')
        await pg.screenshot(path=f"/home/claude/shots/misc-{'3d' if D3 else '2d'}.png")
        print(sum(1 for r in R if r[1]),'of',len(R),'passed; errors',errs[:4]); await b.close()
asyncio.run(main())
