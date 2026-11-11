"""Browser test for the radio trainer (radio-drills.html). Serve the site first:
     cd <repo> && python3 -m http.server 8985 &   then   python3 tests/radio_e2e.py [--port 8985] [--shots DIR]
   Speech cannot be tested headless, so every call is typed (the typing path is the same engine as voice).
   1470x956: start screen, VFR scenario with one wrong readback (graded red, controller corrects, retry passes), debrief,
   IFR gate to gate typed to the end, NO language. 390x844 (touch): quick drill and a basics drill. No console errors
   (a 404 from /api is expected where the AI service is not set up), no horizontal overflow."""
import sys, asyncio, os
from playwright.async_api import async_playwright
PORT=sys.argv[sys.argv.index('--port')+1] if '--port' in sys.argv else '8985'
URL=f'http://127.0.0.1:{PORT}/radio-drills.html'
SHOTS=sys.argv[sys.argv.index('--shots')+1] if '--shots' in sys.argv else None
fails=[]; checks=0
def ok(name,cond,info=''):
    global checks; checks+=1
    if not cond: fails.append(f'{name} {info}')
async def shot(pg,name,full=False):
    if SHOTS: await pg.screenshot(path=os.path.join(SHOTS,name),full_page=full)
async def idle(pg): await pg.evaluate('window.__radio.idle()'); await pg.wait_for_timeout(60)
async def say(pg,text):
    await pg.fill('#say',text); await pg.click('#btnTx'); await idle(pg)
async def fly(pg,maxn=80):
    n=0
    while n<maxn and await pg.evaluate('!!(window.__radio.ses&&!window.__radio.ses.done)'):
        await say(pg,await pg.evaluate('window.__radio.model()')); n+=1
    await pg.wait_for_timeout(900); return n

async def run(p,W,H,touch):
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':W,'height':H},has_touch=touch,is_mobile=touch)
    await ctx.add_init_script("localStorage.setItem('naeroson-radio-prefs',JSON.stringify({voice:false,fx:false,level:'beginner'}))")
    pg=await ctx.new_page(); errs=[]
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and '404' not in m.text and '/api/' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append('pageerror: '+str(e)))
    await pg.goto(URL,wait_until='networkidle'); await pg.wait_for_timeout(400)
    tag=f'{W}x{H}'
    ov=lambda: pg.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
    ok(f'{tag} five goals',await pg.evaluate("document.querySelectorAll('#goals .goal').length")==5)
    ok(f'{tag} level selector',await pg.evaluate("document.querySelectorAll('#lvlSeg button').length")==3)
    ok(f'{tag} home no overflow',await ov()<=0)
    await shot(pg,f'{tag}-1-home.png')
    if W>1000:
        await pg.click('#goals .goal[data-g=vfr]'); await pg.wait_for_selector('#v-pick:not([hidden])')
        n=await pg.evaluate("document.querySelectorAll('#pickL .sc').length"); ok('vfr list',n>=8,str(n))
        await shot(pg,f'{tag}-2-vfr-list.png')
        await pg.click('#pickL .sc[data-k=vfrdep]'); await idle(pg)
        ok('session visible',await pg.is_visible('#v-sess'))
        ok('frequency tuned',(await pg.text_content('#fq')).strip()=='121.700')
        ok('beginner shows items',await pg.evaluate("document.querySelectorAll('#turn .ichip').length")>=4)
        await say(pg,await pg.evaluate('window.__radio.model()'))
        # wrong QNH in the taxi readback
        V=await pg.evaluate('({q:window.__radio.ses.V.qnh,a:window.__radio.ses.V.a})')
        await say(pg,f"Holding point A1 runway 36, QNH {V['q']+3}, {V['a']}")
        ok('wrong element marked red',await pg.evaluate("!!document.querySelector('#fbBox .els li.wrong')"))
        ok('correct readback shown',await pg.evaluate("document.querySelector('#fbBox .model .mono').textContent.includes('QNH')"))
        last=await pg.evaluate("[...document.querySelectorAll('#log .msg.atc')].pop().textContent")
        ok('controller corrects',f"negative, I say again, QNH {V['q']}" in last,last)
        await shot(pg,f'{tag}-3-vfr-wrong-readback.png')
        await say(pg,f"QNH {V['q']}, {V['a']}")
        ok('retry passes',await pg.evaluate("document.querySelector('#fbBox .fbh').classList.contains('good')"))
        # conditional clearance
        await say(pg,await pg.evaluate('window.__radio.model()'))
        await shot(pg,f'{tag}-4-vfr-session.png')
        await fly(pg)
        ok('debrief shown',await pg.is_visible('#v-deb'))
        sc=await pg.evaluate("parseInt(document.querySelector('#debBody .big').textContent)"); ok('debrief score',70<=sc<100,str(sc))
        ok('element table',await pg.evaluate("document.querySelectorAll('#debBody .ktab tr').length")>=5)
        ok('best saved',await pg.evaluate("+localStorage.getItem('naeroson-radio-vfrdep')")==sc)
        ok('srs saved','vtaxi:1' in (await pg.evaluate("localStorage.getItem('naeroson-radio-srs')") or ''))
        await shot(pg,f'{tag}-5-debrief.png',True)
        # IFR gate to gate at intermediate
        await pg.click('#debHome'); await pg.click('#lvlSeg button[data-v=intermediate]')
        await pg.click('#goals .goal[data-g=ifr]'); await pg.click('#pickL .sc[data-k=ifrfull]'); await idle(pg)
        ok('intermediate hides item list',await pg.evaluate("document.querySelectorAll('#turn .ichip').length")==0)
        await say(pg,await pg.evaluate('window.__radio.model()'))
        await shot(pg,f'{tag}-6-ifr-clearance.png')
        n=await fly(pg,60); ok('IFR flown to the end',await pg.is_visible('#v-deb'),str(n))
        ok('IFR 100 %',await pg.evaluate("parseInt(document.querySelector('#debBody .big').textContent)")==100)
        await shot(pg,f'{tag}-7-ifr-debrief.png')
        # Norwegian
        await pg.click('#debHome')
        nob=await pg.query_selector('button:text-is("NO")')
        if nob:
            await nob.click(); await pg.wait_for_timeout(300)
            ok('NO heading',await pg.text_content('.rt-q')=='Hva vil du øve på?',await pg.text_content('.rt-q'))
            ok('NO goals',(await pg.text_content('#goals .goal[data-g=emerg] b'))=='Nødsituasjoner')
            await shot(pg,f'{tag}-8-home-no.png')
            await pg.click('#goals .goal[data-g=emerg]'); await pg.click('#pickL .sc[data-k=mayday]'); await idle(pg)
            await say(pg,'mayday mayday mayday engine failure')
            ok('NO why text',await pg.evaluate("document.querySelector('#fbBox').textContent.includes('Hvorfor')"))
            await shot(pg,f'{tag}-9-mayday-no.png')
            eb=await pg.query_selector('button:text-is("EN")')
            if eb: await eb.click()
    else:
        await pg.click('#goals .goal[data-g=quick]'); await idle(pg)
        ok('quick drill 6 calls',await pg.evaluate('window.__radio.ses.steps.length')==6)
        ok('mobile ptt big',await pg.evaluate("document.querySelector('#ptt').getBoundingClientRect().height")>=70)
        ok('mobile session no overflow',await ov()<=0)
        await say(pg,'roger')
        await shot(pg,f'{tag}-2-quick.png')
        await fly(pg); ok('quick debrief',await pg.is_visible('#v-deb'))
        ok('mobile debrief no overflow',await ov()<=0)
        await shot(pg,f'{tag}-3-quick-debrief.png',True)
        await pg.click('#btnWeak'); await idle(pg); ok('practise weak items',await pg.evaluate('window.__radio.ses.steps.length')>=1)
        await fly(pg)
        await pg.click('#debHome'); await pg.click('#goals .goal[data-g=basic]'); await pg.click('#pickL .sc[data-k=b-num]'); await idle(pg)
        await say(pg,await pg.evaluate('window.__radio.model()'))
        await say(pg,'1013')
        await shot(pg,f'{tag}-4-basics.png')
        await fly(pg); ok('basics debrief',await pg.is_visible('#v-deb'))
    ok(f'{tag} no console errors',not errs,' | '.join(errs[:5]))
    await b.close()

async def main():
    async with async_playwright() as p:
        await run(p,1470,956,False); await run(p,390,844,True)
    print(f'{checks-len(fails)}/{checks} checks passed')
    for f in fails: print('  FAIL',f)
    sys.exit(1 if fails else 0)
asyncio.run(main())
