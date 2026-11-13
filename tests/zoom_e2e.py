"""Zoom on the 2D cockpit trainers (C172, DA42, King Air B200), end to end in Chromium against a static server:
    python3 tests/zoom_e2e.py http://localhost:9008 [screenshot dir] [chrome path]
At rest the whole panel fits the stage (aspect fit, centred, nothing cut off). Tapping a bare spot of an area zooms to it; a
control inside it still works and does not zoom; ← Back, Esc and a double tap return to the whole panel; a two-finger pinch
(CDP touch events) zooms the panel, not the browser page, and presses no control.
King Air B200: a tap on the EADI or the EHSI zooms to one area with the whole EFIS and its controls (the EFIS control strip on the
pedestal, the course and heading knobs), all on screen and usable, with the same ← Back / Esc / double tap as every other area."""
import json, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:9008'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
CHROME = sys.argv[3] if len(sys.argv) > 3 else None
AC = {'c172.html': ('aFlight', [214, 286, 532, 620]), 'cockpit.html': ('aLower', [230, 632, 1150, 348]), 'b200.html': ('aCentre', [797, 412, 564, 579])}
OV = {'c172.html': [0, 0, 2000, 1320], 'cockpit.html': [10, 92, 1580, 888], 'b200.html': [0, 0, 2000, 1780]}  # REG.overview
SIZES = [(1470, 956), (1280, 720), (932, 430), (1024, 1366), (390, 844)]
ok = []
def check(name, cond, info=''):
    ok.append(bool(cond)); print(('ok   ' if cond else 'FAIL ') + name + (('  ' + str(info)) if info and not cond else ''), flush=True)

# a bare (non-control) screen point inside a world rectangle, or null
FIND = """([r,want])=>{ const st=document.getElementById('stage'), m=window.__zoom.svg.getScreenCTM(), sb=st.getBoundingClientRect();
  const BAD='g.ctl,.hit,.gdu,.zback,.pill,.tip,.afban,.afnow,.more,.efx,button,select,input,a,.d3v,.tring';
  const boxes=[...st.querySelectorAll('g.ctl,.hit,.gdu')].map(e=>e.getBoundingClientRect()).filter(b=>b.width>0);
  const gap=(x,y)=>{ let d=1e9; for(const b of boxes){ const dx=Math.max(b.left-x,0,x-b.right), dy=Math.max(b.top-y,0,y-b.bottom); d=Math.min(d,Math.hypot(dx,dy)); } return d; };
  let best=null, bd=-1;  // the bare spot farthest from any control (a touch is snapped to a nearby control)
  for(let j=1;j<20;j++) for(let i=1;i<20;i++){ const wx=r[0]+r[2]*i/20, wy=r[1]+r[3]*j/20, x=m.a*wx+m.c*wy+m.e, y=m.b*wx+m.d*wy+m.f;
    if(x<sb.left+60||y<sb.top+60||x>sb.right-8||y>sb.bottom-50) continue;
    const t=document.elementFromPoint(x,y); if(!t||!st.contains(t)||t.closest(BAD)) continue; const d=gap(x,y); if(d>bd){ bd=d; best=[x,y]; } }
  return bd>=12?best:null; }"""
OVR = """(r)=>{ const s=document.getElementById('stage').getBoundingClientRect(), m=window.__zoom.svg.getScreenCTM();
  const L=m.a*r[0]+m.e, T=m.d*r[1]+m.f, R=m.a*(r[0]+r[2])+m.e, B=m.d*(r[1]+r[3])+m.f;
  return {l:L-s.left, r:s.right-R, t:T-s.top, b:s.bottom-B, cx:Math.abs((L+R)/2-(s.left+s.right)/2)}; }"""
SYS = "()=>JSON.stringify(window.__SYS,(k,v)=>typeof v==='number'?Math.round(v*1000)/1000:v)"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
    for page, (area, R) in AC.items():
        for (w, h) in SIZES:
            tag = f'{page}@{w}x{h}'
            touch = w < 1100
            c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=touch)
            pg = c.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
            pg.goto(BASE + '/' + page); pg.wait_for_load_state('load'); time.sleep(2.0)
            pg.evaluate("()=>{ const s=document.getElementById('stage'); s.scrollIntoView({block:'end',behavior:'instant'}); window.SIMSHELL&&SIMSHELL.hideCard(); }"); time.sleep(0.4)
            pg.click('#bPause')  # a still panel: state changes come from the pointer only
            if SHOTS: pg.screenshot(path=f'{SHOTS}/zoom_{page[:-5]}_{w}x{h}_rest.png')
            if h > w:  # portrait: the page asks to turn the device; only the fit is checked
                fit = pg.evaluate(OVR, OV[page]); fit = [fit['l'], fit['r']]
                check(tag + ' portrait: panel not wider than the stage', fit[0] > -2 and fit[1] > -2, fit)
                check(tag + ' no page errors', not errs, errs[:3]); c.close(); continue
            fit = pg.evaluate(OVR, OV[page])
            cut = fit['l'] < -2 or fit['r'] < -2 or fit['b'] < -2 or fit['t'] < -2
            check(tag + ' at rest: whole panel fits, centred', not cut and fit['cx'] < 3, fit)
            # tap an area
            pt = pg.evaluate(FIND, [R, 'bare'])
            check(tag + ' a bare spot in ' + area, pt)
            if not pt: c.close(); continue
            (pg.touchscreen.tap if touch else pg.mouse.click)(pt[0], pt[1]); time.sleep(0.6)
            check(tag + ' tap → zoomed to ' + area, pg.evaluate("()=>window.__zoom.reg()") == area, pg.evaluate("()=>window.__zoom.reg()"))
            check(tag + ' Back button shown, 44 px', pg.evaluate("()=>{ const b=document.getElementById('zBack').getBoundingClientRect(); return b.height>=43&&b.width>=44&&b.left<40&&b.top<pageYOffset+document.getElementById('stage').getBoundingClientRect().top+40; }"))
            if SHOTS: pg.screenshot(path=f'{SHOTS}/zoom_{page[:-5]}_{w}x{h}_zoomed.png')
            # a control still works, and does not zoom
            worked = False
            for i in range(14):
                cp = pg.evaluate("""([r,i])=>{ const st=document.getElementById('stage'), sb=st.getBoundingClientRect(); const L=[...st.querySelectorAll('g.ctl')].map(g=>g.getBoundingClientRect())
                  .filter(b=>b.width>14&&b.height>14&&b.left>sb.left+60&&b.top>sb.top+60&&b.right<sb.right-10&&b.bottom<sb.bottom-60);
                  const ok=L.filter(b=>{ const t=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2); return t&&t.closest('g.ctl'); }); const b=ok[i*3%Math.max(1,ok.length)]; return b?[b.left+b.width/2,b.top+b.height/2]:null; }""", [R, i])
                if not cp: break
                s0 = pg.evaluate(SYS); (pg.touchscreen.tap if touch else pg.mouse.click)(cp[0], cp[1]); time.sleep(0.25)
                if pg.evaluate(SYS) != s0: worked = True; break
            check(tag + ' a control works while zoomed', worked)
            check(tag + ' tapping controls did not change the zoom', pg.evaluate("()=>window.__zoom.reg()") == area)
            pg.evaluate("()=>document.getElementById('zBack').click()"); time.sleep(0.5)
            check(tag + ' ← Back → whole panel', pg.evaluate("()=>window.__zoom.reg()") == 'overview')
            # Esc
            pg.evaluate("([a])=>window.__zoom.to(a)", [area]); time.sleep(0.5); pg.keyboard.press('Escape'); time.sleep(0.4)
            check(tag + ' Esc → whole panel', pg.evaluate("()=>window.__zoom.reg()") == 'overview')
            # double tap on a bare spot of the zoomed area
            pg.evaluate("([a])=>window.__zoom.to(a)", [area]); time.sleep(0.9)
            pt = pg.evaluate(FIND, [R, 'bare'])
            if pt:
                if touch: pg.touchscreen.tap(pt[0], pt[1]); time.sleep(0.12); pg.touchscreen.tap(pt[0], pt[1])
                else: pg.mouse.click(pt[0], pt[1]); time.sleep(0.12); pg.mouse.click(pt[0], pt[1])
                time.sleep(0.5)
            check(tag + ' double tap → whole panel', pt and pg.evaluate("()=>window.__zoom.reg()") == 'overview')
            # pinch (CDP touch): zooms the panel, not the page, presses nothing
            if touch:
                time.sleep(0.5); s0 = pg.evaluate("()=>window.__zoom.s()"); y0 = pg.evaluate(SYS)
                pt = pg.evaluate(FIND, [R, 'bare'])
                cdp = c.new_cdp_session(pg); x, y = pt
                def tp(a, d): return [{'x': x - d, 'y': y, 'id': 1}, {'x': x + d, 'y': y, 'id': 2}][:a]
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': tp(1, 0)})
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': tp(2, 20)})
                for k in range(1, 13): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': tp(2, 20 + k * 12)}); time.sleep(0.02)
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); time.sleep(0.5)
                r = pg.evaluate("()=>({s:window.__zoom.s(),reg:window.__zoom.reg(),vv:window.visualViewport?visualViewport.scale:1})")
                check(tag + ' pinch zooms the panel (about the fingers)', r['s'] > s0 * 1.6 and r['reg'] != 'overview', [s0, r])
                check(tag + ' pinch does not zoom the page', abs(r['vv'] - 1) < 1e-3, r)
                check(tag + ' pinch pressed no control', pg.evaluate(SYS) == y0)
                if SHOTS: pg.screenshot(path=f'{SHOTS}/zoom_{page[:-5]}_{w}x{h}_pinch.png')
                pg.evaluate("()=>document.getElementById('zBack').click()"); time.sleep(0.4)
                check(tag + ' Back after pinch → whole panel', pg.evaluate("()=>window.__zoom.reg()") == 'overview')
            check(tag + ' no page errors', not errs, errs[:3])
            c.close()
    # ---- B200: the EFIS area ----
    EF = {'efisL': [235, 495, 860, 1040], 'efisR': [695, 473, 1032, 1062]}  # B200P.REG
    ON = """(ids)=>{ const st=document.getElementById('stage').getBoundingClientRect(); const out={};
      for(const id of ids){ const g=document.querySelector('g.ctl[data-id="'+id+'"]'); if(!g){ out[id]='missing'; continue; } const b=g.getBoundingClientRect();
        const cx=b.left+b.width/2, cy=b.top+b.height/2, t=document.elementFromPoint(cx,cy);
        out[id]=(b.left>=st.left&&b.right<=st.right&&b.top>=st.top&&b.bottom<=st.bottom&&t&&t.closest('g.ctl')===g)?[cx,cy]:'off screen or covered'; }
      return out; }"""
    FACE = """([k,i])=>{ const r=B200P.EFISF[k][i], m=window.__zoom.svg.getScreenCTM(), wx=r[0]+r[2]*0.5, wy=r[1]+r[3]*0.3; return [m.a*wx+m.c*wy+m.e, m.b*wx+m.d*wy+m.f]; }"""
    INST = """([r])=>{ const m=window.__zoom.svg.getScreenCTM(), s=document.getElementById('stage').getBoundingClientRect();
      const L=m.a*r[0]+m.e, T=m.d*r[1]+m.f, R=m.a*(r[0]+r[2])+m.e, B=m.d*(r[1]+r[3])+m.f; return L>=s.left-1&&R<=s.right+1&&T>=s.top-1&&B<=s.bottom+1; }"""
    for (w, h) in [(1470, 956), (932, 430)]:
        touch = w < 1100
        c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=touch)
        pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto(BASE + '/b200.html'); pg.wait_for_load_state('load'); time.sleep(2.0)
        pg.evaluate("()=>{ const s=document.getElementById('stage'); s.scrollIntoView({block:'end',behavior:'instant'}); window.SIMSHELL&&SIMSHELL.hideCard(); }"); time.sleep(0.4)
        pg.click('#bPause')
        tap = pg.touchscreen.tap if touch else pg.mouse.click
        s0 = pg.evaluate("()=>window.__zoom.s()")
        for side, face, ctls in [('efisL', 0, ['efisCrsSel', 'efisBrg1', 'efisBrg2', 'efisFmt', 'efisEt', 'efisDim', 'crsK', 'hdgK']), ('efisL', 1, []), ('efisR', 0, ['efisFmt', 'crs2K', 'hdgK'])]:
            tag = f'b200.html@{w}x{h} {side} ' + ('EADI' if face == 0 else 'EHSI')
            time.sleep(0.8); pt = pg.evaluate(FACE, [side, face]); tap(pt[0], pt[1]); time.sleep(0.8)
            check(tag + ' tap → the EFIS area', pg.evaluate("()=>window.__zoom.reg()") == side, pg.evaluate("()=>window.__zoom.reg()"))
            check(tag + ' both displays on screen', all(pg.evaluate(INST, [pg.evaluate("([k,i])=>B200P.EFISF[k][i]", [side, i])]) for i in (0, 1)))
            check(tag + ' zoomed in (larger than the whole-panel view)', pg.evaluate("()=>window.__zoom.s()") > 1.4 * s0)
            if ctls:
                on = pg.evaluate(ON, ctls)
                check(tag + ' its controls on screen: ' + ', '.join(ctls), all(isinstance(v, list) for v in on.values()), on)
                if SHOTS: pg.screenshot(path=f'{SHOTS}/zoom_b200_{w}x{h}_{side}.png')
                k = on.get('efisFmt')
                if isinstance(k, list):
                    a0 = pg.evaluate("()=>window.__SYS.efisArc"); tap(k[0], k[1]); time.sleep(0.3)
                    check(tag + ' the ARC key works while zoomed', pg.evaluate("()=>window.__SYS.efisArc") != a0)
                    check(tag + ' pressing it did not change the zoom', pg.evaluate("()=>window.__zoom.reg()") == side)
                check(tag + ' Back button shown, no extra EFIS panel or buttons', pg.evaluate("()=>{ const b=document.getElementById('zBack').getBoundingClientRect(); return b.width>=44&&b.height>=43&&!document.querySelector('.efx'); }"))
                pg.keyboard.press('Escape'); time.sleep(0.5)
                check(tag + ' Esc → whole panel', pg.evaluate("()=>window.__zoom.reg()") == 'overview')
                pg.evaluate("([a])=>window.__zoom.to(a)", [side]); time.sleep(0.9)
                pt = pg.evaluate(FIND, [EF[side], 'bare'])
                if pt: tap(pt[0], pt[1]); time.sleep(0.12); tap(pt[0], pt[1]); time.sleep(0.5)
                check(tag + ' double tap → whole panel', pt and pg.evaluate("()=>window.__zoom.reg()") == 'overview')
            else:
                pg.evaluate("()=>document.getElementById('zBack').click()"); time.sleep(0.5)
                check(tag + ' ← Back → whole panel', pg.evaluate("()=>window.__zoom.reg()") == 'overview')
        # the rest of the pilot's panel still zooms to its own area
        time.sleep(0.8); pt = pg.evaluate(FIND, [[30, 520, 190, 380], 'bare'])
        if pt:
            tap(pt[0], pt[1]); time.sleep(0.6)
            check(f'b200.html@{w}x{h} a tap beside the EFIS still zooms to the pilot instruments', pg.evaluate("()=>window.__zoom.reg()") == 'aPilot', pg.evaluate("()=>window.__zoom.reg()"))
        check(f'b200.html@{w}x{h} EFIS area: no page errors', not errs, errs[:3])
        c.close()
    b.close()
print('PASS' if all(ok) else f'FAILURES: {ok.count(False)}')
sys.exit(0 if all(ok) else 1)
