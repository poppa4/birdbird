"""Browser tests for the IFR trainer (ifr.html). Run with the site served on :9150:
     cd <repo> && python3 -m http.server 9150 &   then   python3 tests/ifr_e2e.py [--shots DIR]
   Checks, at six viewports (1470×956, 1440×900, 1920×1080, 820×1180, 390×844, 844×390 touch):
   no console or page errors, no horizontal overflow, every step renders, the flight deck fits one screen on desktop,
   every exercise flown by the scripted good pilot to a pass, every exercise flown with its typical mistake and the
   debrief marking that mistake (card, timeline, map), keyboard / stepper / knob-drag input, EN/NO switch."""
import sys, asyncio, json, os
from playwright.async_api import async_playwright
URL='http://localhost:9150/ifr.html'
SHOTS=sys.argv[sys.argv.index('--shots')+1] if '--shots' in sys.argv else None
EXES=['orient','trackIn','trackOut','intIn','intOut','ndb','dme','holdEntry','hold','pt','base','vordme','ils']
MIS={'orient':'orient.recip','trackIn':'reverse','trackOut':'away','intIn':'int.away','intOut':'int.overshoot','ndb':'ndb.homing','dme':'arc.out','holdEntry':'hold.wrongentry','hold':'hold.wrongturn','pt':'pt.wrong180','base':'base.wrongturn','vordme':'app.early','ils':'app.early'}
VIEWS=[(1470,956,False),(1440,900,False),(1920,1080,False),(820,1180,False),(390,844,True),(844,390,True)]
if '--only' in sys.argv: VIEWS=[v for v in VIEWS if str(v[0])==sys.argv[sys.argv.index('--only')+1]]
fails=[]; checks=0
def ok(name,cond,info=''):
    global checks; checks+=1
    if not cond: fails.append(f'{name} {info}')

async def fly(pg,ex,lv,area,seed,mistake):
    return await pg.evaluate(f"""(()=>{{const F=__IFR; F.S.area='{area}'; F.S.lv={lv}; F.newExercise('{ex}'); F.setup({seed}); F.go('fly'); F.start(true,{'true' if mistake else 'false'});
      F.advance(1300); const R=F.S.res; return {{step:F.S.step, g:R&&R.g, first:R&&R.first&&R.first.code, card:(document.getElementById('mistCard')||{{}}).textContent||'', instead:!!document.querySelector('#mistCard p.do'), log:F.S.log.length}}; }})()""")

async def viewport(p,W,H,touch):
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':W,'height':H},has_touch=touch,is_mobile=touch)
    pg=await ctx.new_page(); errs=[]
    pg.on('console',lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror',lambda e: errs.append('pageerror: '+str(e)))
    await pg.goto(URL,wait_until='networkidle'); await pg.wait_for_timeout(600)
    tag=f'{W}x{H}'
    ov=lambda: pg.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
    ok(f'{tag} loads without horizontal overflow',await ov()<=0)
    desktop=W>=980 and H>=620
    # every step of every exercise renders
    for ex in EXES:
        for step in ['understand','think','fly']:
            await pg.evaluate(f"(()=>{{const F=__IFR; F.S.area='practice'; F.S.lv=1; F.newExercise('{ex}'); F.go('{step}'); document.getElementById('trainer').scrollIntoView();}})()")
            await pg.wait_for_timeout(120)
            o=await ov(); ok(f'{tag} {ex} {step} no overflow',o<=0,str(o))
            if desktop:
                fit=await pg.evaluate("""(()=>{const st=document.getElementById('trainer'), r=st.getBoundingClientRect(), p=st.querySelector('.pnl');
                  const tb=document.getElementById('tbar').getBoundingClientRect(); return {h:r.height, vh:innerHeight, pnl:p.scrollHeight-p.clientHeight, tb:tb.bottom}})()""")
                ok(f'{tag} {ex} {step} deck fits one screen',fit['h']<=fit['vh']+1 and fit['tb']<=fit['vh']+1,json.dumps(fit))
                ok(f'{tag} {ex} {step} panel not clipped',fit['pnl']<=2,json.dumps(fit))
    # fly: the good pilot passes, the typical mistake is marked
    full = W in (1470,390)
    for ex in (EXES if full else ['trackIn','holdEntry','ils']):
        for area in (['practice','bergen'] if full else ['practice']):
            r=await fly(pg,ex,2 if full else 1,area,7,False)
            ok(f'{tag} {ex} {area} good pilot reaches the debrief',r['step']=='debrief',json.dumps(r)[:300])
            ok(f'{tag} {ex} {area} good pilot passes',bool(r['g'] and r['g']['pass'] and r['g']['errs']==0),json.dumps(r)[:300])
        r=await fly(pg,ex,2,'practice',5 if ex!='holdEntry' else 4,True)
        ok(f'{tag} {ex} mistake is the first thing marked',r['first']==MIS[ex],json.dumps(r)[:300])
        ok(f'{tag} {ex} mistake card explains it and says what to do instead',len(r['card'])>40 and r['instead'],r['card'][:120])
        await pg.wait_for_timeout(350)
        tl=0
        for _ in range(8):   # the timeline is drawn by the frame loop: poll for the red mistake marker
            tl=await pg.evaluate("(()=>{const c=document.getElementById('tl'); const g=c.getContext('2d',{willReadFrequently:true}); const d=g.getImageData(0,0,c.width,c.height).data; let red=0; for(let i=0;i<d.length;i+=4){ if(d[i]>200&&d[i+1]<130&&d[i+2]<110) red++; } return red; })()")
            if tl>20: break
            await pg.wait_for_timeout(250)
        ok(f'{tag} {ex} timeline marks the mistake',tl>20,str(tl))
        o=await ov(); ok(f'{tag} {ex} debrief no overflow',o<=0,str(o))
        if SHOTS and ex=='holdEntry' and W==1470: await pg.screenshot(path=os.path.join(SHOTS,f'e2e-debrief-{tag}.png'))
    # input: keyboard, steppers and knob drag
    await pg.evaluate("(()=>{const F=__IFR; F.S.area='practice'; F.S.lv=1; F.newExercise('trackIn'); F.act('fly'); F.start(false); document.getElementById('trainer').scrollIntoView();})()")
    await pg.wait_for_timeout(200)
    h0=await pg.evaluate('__IFR.S.sim.sel.hdg')
    if not touch:
        await pg.mouse.click(5,5); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('Shift+ArrowRight')
        h1=await pg.evaluate('__IFR.S.sim.sel.hdg'); ok(f'{tag} arrow keys move the heading bug',round((h1-h0)%360)==11,f'{h0}->{h1}')
        a0=await pg.evaluate('__IFR.S.sim.sel.alt'); await pg.keyboard.press('ArrowUp'); a1=await pg.evaluate('__IFR.S.sim.sel.alt'); ok(f'{tag} arrow up raises the selected altitude',a1-a0==100,f'{a0}->{a1}')
        box=await pg.evaluate("(()=>{const c=document.querySelector('[data-g=\"cdi\"] canvas').getBoundingClientRect(); return {x:c.left,y:c.top,w:c.width,h:c.height}})()")
        o0=await pg.evaluate('__IFR.S.X.obs'); kx,ky=box['x']+box['w']*0.135,box['y']+box['h']*0.865
        await pg.mouse.move(kx,ky); await pg.mouse.down(); await pg.mouse.move(kx+30,ky,steps=6); await pg.mouse.up()
        o1=await pg.evaluate('__IFR.S.X.obs'); ok(f'{tag} dragging the OBS knob turns the course',o1!=o0,f'{o0}->{o1}')
    btn=pg.locator('#ctl [data-k="hdg"] button[data-d="10"]')
    hb=await pg.evaluate('__IFR.S.sim.sel.hdg')
    if touch: await btn.tap()
    else: await btn.click()
    ha=await pg.evaluate('__IFR.S.sim.sel.hdg'); ok(f'{tag} HDG +10 stepper',round((ha-hb)%360)==10,f'{hb}->{ha}')
    if not desktop:
        mb=pg.locator('#mapBtn')
        if await mb.is_visible():
            if touch: await mb.tap()
            else: await mb.click()
            await pg.wait_for_timeout(200); vis=await pg.evaluate("getComputedStyle(document.getElementById('mapw')).display")
            ok(f'{tag} the map toggle shows the map',vis!='none',vis)
    # Understand: drag the aircraft and turn it by its handle (mouse or touch)
    await pg.evaluate("(()=>{const F=__IFR; F.newExercise('holdEntry'); F.go('understand'); document.getElementById('map').scrollIntoView({block:'center'});})()")
    await pg.wait_for_timeout(400)
    q=await pg.evaluate("(()=>{const F=__IFR, u=F.S.u, r=document.getElementById('map').getBoundingClientRect(); F.map.P(u.x,u.y); const a=F.map.sa(u.hdg); return {x:r.left+F.map.sx,y:r.top+F.map.sy,hx:r.left+F.map.sx+Math.sin(a)*34,hy:r.top+F.map.sy-Math.cos(a)*34,u:{x:u.x,h:u.hdg},vis:r.width>50}})()")
    if q['vis'] and not touch:
        await pg.mouse.move(q['x'],q['y']); await pg.mouse.down(); await pg.mouse.move(q['x']-60,q['y']+20,steps=5); await pg.mouse.up()
        x1=await pg.evaluate('__IFR.S.u.x'); ok(f'{tag} Understand: drag moves the aircraft',abs(x1-q['u']['x'])>0.05,f"{q['u']['x']}->{x1}")
        q=await pg.evaluate("(()=>{const F=__IFR, u=F.S.u, r=document.getElementById('map').getBoundingClientRect(); F.map.P(u.x,u.y); const a=F.map.sa(u.hdg); return {x:r.left+F.map.sx,y:r.top+F.map.sy,hx:r.left+F.map.sx+Math.sin(a)*34,hy:r.top+F.map.sy-Math.cos(a)*34,h:u.hdg}})()")
        await pg.mouse.move(q['hx'],q['hy']); await pg.mouse.down(); await pg.mouse.move(q['x']+50,q['y']+40,steps=5); await pg.mouse.up()
        h1=await pg.evaluate('__IFR.S.u.hdg'); ok(f'{tag} Understand: the handle turns the aircraft',abs(((h1-q['h'])+540)%360-180)>20,f"{q['h']}->{h1}")
        live=await pg.evaluate("document.getElementById('uLive').textContent"); ok(f'{tag} Understand: live entry readout',('entry' not in live) and len(live)>10,live)
    # language switch
    await pg.evaluate("(()=>{const b=[...document.querySelectorAll('.langseg button')].find(x=>x.dataset.v==='no'); if(b) b.click();})()"); await pg.wait_for_timeout(300)
    t=await pg.evaluate("document.getElementById('exName').textContent")
    ok(f'{tag} Norwegian switch',t in ('Følge kurs inn','Inngang til holding'),t)
    await pg.evaluate("(()=>{const b=[...document.querySelectorAll('.langseg button')].find(x=>x.dataset.v==='en'); if(b) b.click();})()"); await pg.wait_for_timeout(200)
    ok(f'{tag} no console or page errors',not errs,' | '.join(errs[:5]))
    await b.close()

async def main():
    async with async_playwright() as p:
        for W,H,t in VIEWS:
            await viewport(p,W,H,t)
            print(f'{W}x{H}: done, {len(fails)} failures so far',flush=True)
    print(f'{checks-len(fails)} passed, {len(fails)} failed ({checks} checks)')
    for f in fails: print('  x '+f)
    sys.exit(1 if fails else 0)
asyncio.run(main())
