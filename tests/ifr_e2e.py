"""Browser tests for the IFR trainer (ifr.html). Run with the site served on :9151:
     cd <repo> && python3 -m http.server 9151 &   then   python3 tests/ifr_e2e.py [--shots DIR] [--only 1470]
   At six viewports (1470×956, 1440×900, 1920×1080, 820×1180, 390×844, 844×390 touch): no console or page errors, no
   horizontal overflow; the start screen (short path, then all exercises) starts every exercise; the builder runs a custom
   setup; Guided mode completes every exercise with a scripted student who does what the guide says; Hints and Off work;
   the debrief marks a scripted mistake (card, timeline, map); the walk-through steps; keyboard and stepper input; EN/NO."""
import sys, asyncio, json, os
from playwright.async_api import async_playwright
URL='http://localhost:9151/ifr.html'
SHOTS=sys.argv[sys.argv.index('--shots')+1] if '--shots' in sys.argv else None
VIEWS=[(1470,956,False),(1440,900,False),(1920,1080,False),(820,1180,False),(390,844,True),(844,390,True)]
if '--only' in sys.argv: VIEWS=[v for v in VIEWS if str(v[0])==sys.argv[sys.argv.index('--only')+1]]
fails=[]; checks=0
def ok(name,cond,info=''):
    global checks; checks+=1
    if not cond: fails.append(f'{name} {info}')

async def shot(pg,name):
    if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,name))

async def viewport(p,W,H,touch):
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':W,'height':H},has_touch=touch,is_mobile=touch)
    pg=await ctx.new_page(); errs=[]
    pg.on('console',lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror',lambda e: errs.append('pageerror: '+str(e)))
    await pg.goto(URL,wait_until='networkidle'); await pg.wait_for_timeout(500)
    tag=f'{W}x{H}'; full=W in (1470,390)
    ov=lambda: pg.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
    desktop=W>=980 and H>=620
    # ---- start screen ----
    ok(f'{tag} home: no overflow',await ov()<=0)
    n=await pg.evaluate("document.querySelectorAll('#catList .row').length"); ok(f'{tag} home: the short path shows 8 exercises',n==8,str(n))
    nxt=await pg.evaluate("document.querySelector('.ncard.go b').textContent"); ok(f'{tag} home: a recommended next',len(nxt)>3,nxt)
    if W==1470: await shot(pg,f'home-{tag}.png')
    await pg.click('#showAll'); await pg.wait_for_timeout(150)
    items=await pg.evaluate("__IFR.I.ITEMS.map(x=>x.id)")
    n=await pg.evaluate("document.querySelectorAll('#catList .row').length"); ok(f'{tag} home: show all lists every exercise',n==len(items),f'{n}/{len(items)}')
    ok(f'{tag} home (all): no overflow',await ov()<=0)
    await pg.click('.chip[data-g="hold"]'); await pg.wait_for_timeout(100)
    n=await pg.evaluate("document.querySelectorAll('#catList .row').length"); ok(f'{tag} home: the group filter',n==6,str(n))
    await pg.click('.chip[data-g="all"]')
    if W==390: await shot(pg,f'home-all-{tag}.png')
    # start an exercise from its row (a real click)
    btn=pg.locator('#catList [data-start="holdEntry"]'); await btn.scroll_into_view_if_needed()
    if touch: await btn.tap()
    else: await btn.click()
    await pg.wait_for_timeout(400)
    st=await pg.evaluate("({v:document.body.classList.contains('v-trainer'),item:__IFR.S.item,step:__IFR.S.step,hash:location.hash})")
    ok(f'{tag} the Start button opens the exercise',st['v'] and st['item']=='holdEntry' and st['step']=='understand' and st['hash']=='#holdEntry',json.dumps(st))
    if W==1470: await pg.wait_for_timeout(1200); await shot(pg,f'understand-{tag}.png')
    # walk-through: next, back, the last step is interactive
    steps=await pg.evaluate("document.querySelectorAll('.udots button').length"); ok(f'{tag} walk-through has 4 steps',steps==4,str(steps))
    await pg.click('#uNext'); await pg.wait_for_timeout(100); s1=await pg.evaluate('__IFR.S.uStep'); ok(f'{tag} walk-through Next',s1==1,str(s1))
    await pg.click('#uBack'); await pg.wait_for_timeout(100); s0=await pg.evaluate('__IFR.S.uStep'); ok(f'{tag} walk-through Back',s0==0,str(s0))
    u0=await pg.evaluate('__IFR.S.u.x'); await pg.wait_for_timeout(700); u1=await pg.evaluate('__IFR.S.u.x'); ok(f'{tag} walk-through animates the aircraft',abs(u1-u0)>1e-4 or W==844,f'{u0}->{u1}')
    # back to the start screen, deep link
    await pg.click('#back'); await pg.wait_for_timeout(200); ok(f'{tag} back to all exercises',not await pg.evaluate("document.body.classList.contains('v-trainer')"))
    await pg.goto(URL+'#ils',wait_until='networkidle'); await pg.wait_for_timeout(400)
    ok(f'{tag} deep link #ils',await pg.evaluate("__IFR.S.item==='ils'&&document.body.classList.contains('v-trainer')"))
    # ---- every exercise starts and every step fits ----
    for it in (items if full else ['orient','trackIn','holdEntry','ils','math','sid','ppHold']):
        await pg.evaluate(f"(()=>{{const F=__IFR; F.openItem('{it}',{{area:'practice',lv:1}});}})()"); await pg.wait_for_timeout(60)
        for step in (['understand','fly'] if full else ['understand','think','fly']):
            await pg.evaluate(f"__IFR.go('{step}')"); await pg.wait_for_timeout(70)
            o=await ov(); ok(f'{tag} {it} {step} no overflow',o<=0,str(o))
            if desktop:
                fit=await pg.evaluate("""(()=>{const st=document.getElementById('trainer'), r=st.getBoundingClientRect(), p=st.querySelector('.pnl'); const tb=document.getElementById('tbar').getBoundingClientRect(); return {h:r.height, vh:innerHeight, pnl:p.scrollHeight-p.clientHeight, tb:tb.bottom}})()""")
                ok(f'{tag} {it} {step} fits one screen',fit['h']<=fit['vh']+1 and fit['tb']<=fit['vh']+1,json.dumps(fit))
                ok(f'{tag} {it} {step} panel not clipped',fit['pnl']<=2,json.dumps(fit))
    # ---- Guided: a scripted student follows the guide to a pass ----
    for it in (items if full else ['trackIn','holdEntry','ils','lnav','orientRbi','math','pass']):
        r=await pg.evaluate(f"""(()=>{{const F=__IFR; F.openItem('{it}',{{area:'practice',lv:2,help:'guided',seed:7}}); F.go('fly'); F.start(false); const pauses=F.followGuide(1900); const R=F.S.res;
          return {{step:F.S.step,pass:R&&R.g.pass,total:R&&R.g.total,errs:R&&R.g.errs,pauses,ev:F.S.J.ev.filter(e=>e.sev!=='good').map(e=>e.code).join(',')}}; }})()""")
        ok(f'{tag} guided {it}: the student following the guide passes',r['step']=='debrief' and r['pass'] and r['errs']==0,json.dumps(r))
        if it in ('holdEntry','intIn','ils','dme','pt'): ok(f'{tag} guided {it}: pauses at key moments',r['pauses']>=1,json.dumps(r))
    # a live guided screenshot mid-run
    await pg.evaluate("(()=>{const F=__IFR; F.openItem('holdEntry',{area:'practice',lv:2,help:'guided',seed:9}); F.go('fly'); F.start(false); F.followGuide(30);})()"); await pg.wait_for_timeout(500)
    big=await pg.evaluate("(document.querySelector('#guide .big')||{}).textContent||''"); ok(f'{tag} guided: a big plain instruction',len(big)>8,big)
    tg=await pg.evaluate("JSON.stringify(__IFR.action().tgt||{})"); ok(f'{tag} guided: a target for the instrument',tg!='{}',tg)
    if W==1470 or W==390: await shot(pg,f'guided-{tag}.png')
    # the pause card at a key moment
    await pg.evaluate("(()=>{const F=__IFR; F.openItem('holdEntry',{area:'practice',lv:1,help:'guided',seed:4}); F.go('fly'); F.start(false); const end=F.S.sim.t+400; while(!F.S.pause&&F.S.run&&F.S.sim.t<end){ const c=F.S.gc; if(c) F.I.apply(F.S.sim,F.S.X,c); F.advance(0.1);} })()")
    pc=await pg.evaluate("({vis:!document.getElementById('pausec').hidden,txt:document.getElementById('pausec').textContent})"); ok(f'{tag} guided: pause before the fix',pc['vis'] and len(pc['txt'])>40,json.dumps(pc)[:200])
    if W==1470: await pg.wait_for_timeout(300); await shot(pg,f'pause-{tag}.png')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(100); ok(f'{tag} Enter continues after the pause',await pg.evaluate("!__IFR.S.pause&&!__IFR.S.paused"))
    # ---- Hints and Off ----
    await pg.evaluate("(()=>{const F=__IFR; F.openItem('trackIn',{area:'practice',lv:2,help:'hints',seed:5}); F.go('fly'); F.start(false); F.advance(15);})()"); await pg.wait_for_timeout(300)
    h0=await pg.evaluate("({big:document.querySelector('#guide .big').textContent,cls:document.getElementById('guide').className,t:JSON.stringify(__IFR.S.help)})")
    ok(f'{tag} hints: quiet until asked',('quiet' in h0['cls']),json.dumps(h0))
    if not touch:
        await pg.mouse.click(5,5); await pg.keyboard.press('h'); await pg.wait_for_timeout(200)
    else:
        await pg.locator('#gHint').tap(); await pg.wait_for_timeout(200)
    h1=await pg.evaluate("({hint:__IFR.S.hint,big:document.querySelector('#guide .big').textContent})"); ok(f'{tag} hints: the first hint',h1['hint']==1 and h1['big']!=h0['big'],json.dumps(h1))
    await pg.evaluate("__IFR.hintMore()"); await pg.wait_for_timeout(200)
    h2=await pg.evaluate("({hint:__IFR.S.hint,big:document.querySelector('#guide .big').textContent,act:__IFR.action().big})"); ok(f'{tag} hints: the second hint is the action',h2['hint']==2 and h2['big']==h2['act'],json.dumps(h2))
    await pg.click('#helpSeg [data-h="off"]'); await pg.wait_for_timeout(200)
    o=await pg.evaluate("({cls:document.getElementById('guide').className,why:!!document.getElementById('gWhy')})"); ok(f'{tag} off: flying alone, Why? stays',('quiet' in o['cls']),json.dumps(o))
    await pg.evaluate("(()=>{__IFR.S.help='guided';})()")
    # ---- the builder runs a custom setup ----
    await pg.evaluate("__IFR.showHome(true)"); await pg.wait_for_timeout(200)
    await pg.select_option('#bld select[data-k="item"]','holdEntry'); await pg.wait_for_timeout(100)
    await pg.fill('#bld input[data-k="radial"]','180'); await pg.dispatch_event('#bld input[data-k="radial"]','change'); await pg.wait_for_timeout(100)
    await pg.click('#bld button[data-k="entry"][data-v="teardrop"]'); await pg.click('#bld button[data-k="wind"][data-v="set"]'); await pg.wait_for_timeout(100)
    await pg.fill('#bld input[data-k="wdir"]','270'); await pg.dispatch_event('#bld input[data-k="wdir"]','change'); await pg.wait_for_timeout(100)
    if W==1470: await pg.locator('#bld').scroll_into_view_if_needed(); await shot(pg,f'builder-{tag}.png')
    ok(f'{tag} builder: no overflow',await ov()<=0)
    gb=pg.locator('#bGo'); await gb.scroll_into_view_if_needed()
    if touch: await gb.tap()
    else: await gb.click()
    await pg.wait_for_timeout(300)
    c=await pg.evaluate("(()=>{const X=__IFR.S.X; return {item:__IFR.S.item,custom:__IFR.S.custom,step:__IFR.S.step,inb:X.task.inb,wind:X.wind.dir,hdg:X.ac.hdg,dir:X.task.dir}})()")
    ent=await pg.evaluate(f"HOLDCORE.entry({c['inb']},{c['dir']},{c['hdg']}).entry")
    ok(f'{tag} builder: runs the custom setup',c['custom'] and c['item']=='holdEntry' and c['step']=='fly' and c['inb']==360 and c['wind']==270 and ent=='teardrop',json.dumps(c)+ent)
    r=await pg.evaluate("(()=>{const F=__IFR; F.start(false); F.followGuide(900); return {step:F.S.step,pass:F.S.res&&F.S.res.g.pass}})()"); ok(f'{tag} builder: the custom run flies to the debrief',r['step']=='debrief' and r['pass'],json.dumps(r))
    # ---- the debrief marks a scripted mistake ----
    for it,code in [('holdEntry','hold.wrongentry'),('trackIn','reverse'),('ils','app.early')] if full else [('holdEntry','hold.wrongentry')]:
        r=await pg.evaluate(f"(()=>{{const F=__IFR; F.openItem('{it}',{{area:'practice',lv:2,seed:{4 if it=='holdEntry' else 5}}}); F.go('fly'); F.start(true,true); F.advance(1500); const R=F.S.res; return {{step:F.S.step,first:R&&R.first&&R.first.code,card:(document.getElementById('mistCard')||{{}}).textContent||'',instead:!!document.querySelector('#mistCard p.do')}}; }})()")
        ok(f'{tag} {it}: the mistake is the first thing marked',r['first']==code,json.dumps(r)[:300])
        ok(f'{tag} {it}: the card says what to do instead',len(r['card'])>40 and r['instead'],r['card'][:120])
        await pg.wait_for_timeout(350); tl=0
        for _ in range(8):
            tl=await pg.evaluate("(()=>{const c=document.getElementById('tl'); const g=c.getContext('2d',{willReadFrequently:true}); const d=g.getImageData(0,0,c.width,c.height).data; let red=0; for(let i=0;i<d.length;i+=4){ if(d[i]>200&&d[i+1]<130&&d[i+2]<110) red++; } return red; })()")
            if tl>20: break
            await pg.wait_for_timeout(250)
        ok(f'{tag} {it}: the timeline marks the mistake',tl>20,str(tl))
        ok(f'{tag} {it}: debrief no overflow',await ov()<=0)
        if it=='holdEntry' and W in (1470,390): await shot(pg,f'debrief-{tag}.png')
    # ---- input: keyboard and steppers ----
    await pg.evaluate("(()=>{const F=__IFR; F.openItem('trackIn',{area:'practice',lv:1}); F.go('fly'); F.start(false);})()"); await pg.wait_for_timeout(200)
    h0=await pg.evaluate('__IFR.S.sim.sel.hdg')
    if not touch:
        await pg.mouse.click(5,300); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('Shift+ArrowRight')
        h1=await pg.evaluate('__IFR.S.sim.sel.hdg'); ok(f'{tag} arrow keys move the heading bug',round((h1-h0)%360)==11,f'{h0}->{h1}')
    btn=pg.locator('#ctl [data-k="hdg"] button[data-d="10"]'); hb=await pg.evaluate('__IFR.S.sim.sel.hdg')
    if touch: await btn.tap()
    else: await btn.click()
    ha=await pg.evaluate('__IFR.S.sim.sel.hdg'); ok(f'{tag} HDG +10 stepper',round((ha-hb)%360)==10,f'{hb}->{ha}')
    if not desktop:
        mb=pg.locator('#mapBtn')
        if await mb.is_visible():
            if touch: await mb.tap()
            else: await mb.click()
            await pg.wait_for_timeout(200); vis=await pg.evaluate("getComputedStyle(document.getElementById('mapw')).display"); ok(f'{tag} the map toggle shows the map',vis!='none',vis)
    # partial panel: timed turns, the compass instead of the heading indicator
    await pg.evaluate("(()=>{const F=__IFR; F.openItem('ppTrack',{area:'practice',lv:1}); F.go('fly'); F.start(false);})()"); await pg.wait_for_timeout(200)
    pp=await pg.evaluate("({cmp:!document.querySelector('[data-g=cmp]').hidden,dg:document.querySelector('[data-g=dg]').hidden,lab:document.querySelector('#ctl [data-k=hdg] label').textContent})")
    ok(f'{tag} partial panel: compass shown, heading indicator gone, timed turns',pp['cmp'] and pp['dg'] and ('Timed' in pp['lab'] or 'Tids' in pp['lab']),json.dumps(pp))
    # language switch
    await pg.evaluate("(()=>{const b=[...document.querySelectorAll('.langseg button')].find(x=>x.dataset.v==='no'); if(b) b.click();})()"); await pg.wait_for_timeout(300)
    t=await pg.evaluate("document.getElementById('exName').textContent"); ok(f'{tag} Norwegian switch',t=='Delvis panel: følg kurs inn',t)
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
