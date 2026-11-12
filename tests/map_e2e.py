"""My Workspace map in a real browser. Empty workspace: a small example (at most 25 dots, three aircraft regions) inside a
calm brain silhouette; hover explains a dot, click offers the real action. A few items of your own (3 and 12): only your
items inside the brain, by aircraft region (named regions, Unsorted for loose items), no example or dust nodes, aircraft
always labelled, documents when there is room; own dots open on the desk; desk home and sidebar mini maps show your dots
without labels (aircraft regions named on the desk home) and without pulses. No aircraft: one Unsorted region with a hint.
A seeded workspace (3 aircraft, 15 documents, 40 notes, 5 packs, 6 routes): legend filter, search, open on the desk, no
animation frames once still apart from rare pulses along real links, none with reduced motion, phone size, Norwegian.
    python3 tests/map_e2e.py [base-url] [shots-dir] [brain-shots-dir]"""
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:9005'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/tmp/mapshots'
BRAIN = sys.argv[3] if len(sys.argv) > 3 else '/tmp/brain3shots'
os.makedirs(BRAIN, exist_ok=True)
os.makedirs(SHOTS, exist_ok=True)
URL = BASE + '/workspace.html'
res = []
def check(n, c, info=''):
    res.append((n, bool(c))); print(('ok   ' if c else 'FAIL ') + n + (('  ' + str(info)[:300]) if info and not c else ''))

RAF = """(() => { const r = window.requestAnimationFrame.bind(window); window.__raf = 0; window.__rafRun = 0; window.requestAnimationFrame = f => { window.__raf++; return r(ts => { window.__rafRun++; f(ts); }); }; })();"""
SEED = """async () => {
  const W = window.WSCORE, A = window.WS.api, D = window.DESKCORE, now = Date.now(), list = [];
  const ac = [W.newAircraft({ typeKey: 'da42', reg: 'LN-ABC' }), W.newAircraft({ typeKey: 'c172', reg: 'LN-XYZ' }), W.newAircraft({ typeKey: 'b200', reg: 'LN-KAB' })];
  list.push(...ac);
  const names = ['AFM', 'Checklist', 'SOP', 'Limitations', 'QRH'];
  const docs = [];
  for (let i = 0; i < 15; i++) { const a = i < 12 ? ac[i % 3] : null; docs.push(W.newDocEntry({ id: 'fd' + i, name: names[i % 5] + ' ' + (a ? a.reg : 'EASA Part ' + i), cat: ['afm', 'chk', 'sop', 'afm', 'chk'][i % 5], acIds: a ? [a.id] : [], pages: 40 })); }
  list.push(...docs);
  const topics = ['VMCA', 'Engine failure', 'Crosswind', 'Icing', 'Fuel', 'Go-around', 'Holding', 'Night', 'Radio failure', 'Stall'];
  for (let i = 0; i < 40; i++) {
    const d = docs[(i * 7) % 15], d2 = docs[(i * 3 + 1) % 15];
    const body = '<div>' + `<cite data-doc="${d.id}" data-p="${1 + (i % 9)}">${d.name} p. ${1 + (i % 9)}</cite>` + (i % 3 ? '' : ` and <cite data-doc="${d2.id}" data-p="${2 + (i % 5)}">${d2.name}</cite>`) + '</div>';
    list.push(W.newNote({ title: topics[i % 10] + ' ' + (i + 1), body, links: i % 4 === 0 ? [{ t: 'aircraft', id: ac[i % 3].id }] : [] }));
  }
  list.push({ id: 'ink:fd0', kind: 'ink', doc: 'fd0', pages: { 3: ['p|1b2430|18|1|AAAA'] }, createdAt: now, updatedAt: now });
  let L = D.newLayout(); L = D.open(L, 'doc', 'fd1').L; L = D.open(L, 'note', list[20].id).L;
  list.push(D.newDesk({ id: 'dk-main', name: 'My desk' }), D.newDesk({ name: 'Type rating', L }));
  await A.commit(list);
  const packs = {}, routes = {};
  for (let i = 0; i < 5; i++) packs['p' + i] = { id: 'p' + i, title: '', created: now - i * 864e5, updated: now - i * 864e5, routeId: 'r' + i, f: { depapt: 'ENTO', destapt: ['ENBR', 'ENGM', 'ENZV', 'ENVA', 'ENCN'][i], date: '2026-11-1' + i, reg: ac[i % 3].reg, type: ac[i % 3].type, rules: 'IFR' } };
  for (let i = 0; i < 6; i++) routes['r' + i] = { id: 'r' + i, packId: i < 5 ? 'p' + i : undefined, pts: [{ t: 'rwy', n: 'ENTO' }, { t: 'fix', n: 'TOR' }, { t: 'rwy', n: ['ENBR', 'ENGM', 'ENZV', 'ENVA', 'ENCN', 'ENKR'][i] }], updated: now - i * 3600e3 };
  localStorage.setItem('naeroson-store-prep', JSON.stringify(packs));
  localStorage.setItem('naeroson-store-route', JSON.stringify(routes));
}"""

# n items of your own: aircraft first (1, 2 from 6 items, 3 from 30), then documents (every fourth without an aircraft)
# and notes that cite a page of the last document
SEEDN = """async (n) => {
  const W = window.WSCORE, A = window.WS.api, list = [], regs = ['LN-ONE', 'LN-TWO', 'LN-THR'], types = ['da42', 'c172', 'b200'];
  const na = n >= 30 ? 3 : n >= 6 ? 2 : 1, ac = [];
  for (let i = 0; i < Math.min(na, n); i++) { const a = W.newAircraft({ typeKey: types[i], reg: regs[i] }); ac.push(a); list.push(a); }
  let d = null, k = 0;
  while (list.length < n) {
    if (k % 3 === 0) { const a = (k / 3) % 4 === 3 ? null : ac[(k / 3) % ac.length]; d = W.newDocEntry({ id: 'od' + k, name: 'Own doc ' + k, cat: 'afm', acIds: a ? [a.id] : [], pages: 30 }); list.push(d); }
    else list.push(W.newNote({ title: 'Own note ' + k, body: k % 2 ? `<cite data-doc="${d.id}" data-p="${k}">p. ${k}</cite>` : '<div>plain</div>', links: k % 4 === 1 ? [{ t: 'aircraft', id: ac[k % ac.length].id }] : [] }));
    k++;
  }
  await A.commit(list);
}"""

IDLE = "() => [window.__rafRun, window.WSMAP.stats.pulseFrames]"
def idle_frames(pg, ms):
    """animation frames that ran during ms and were not pulse frames"""
    a = pg.evaluate(IDLE); pg.wait_for_timeout(ms); b = pg.evaluate(IDLE)
    return (b[0] - a[0]) - (b[1] - a[1]), b[1] - a[1]

def settle(pg, ms=9000):
    pg.wait_for_function("() => window.WS && window.WS.map && window.WS.map.debug.settled && !window.WS.map.debug.running", timeout=ms)

STATE = """(() => { const m = window.WS.map, g = m.graph, L = m.layout, G = window.WSGRAPH;
  return { own: g.own, n: g.nodes.length, brain: !!L.brain, ex: g.nodes.filter(x => x.ghost || x.id.startsWith('ex:')).length,
    inside: !!L.brain && g.nodes.every((x, i) => G.inBrain(L.x[i] / L.S, L.y[i] / L.S, 0.005)),
    regions: m.debug.regions, labels: m.debug.labels, acs: g.nodes.filter(x => x.k === 'aircraft').map(x => x.id), docs: g.nodes.filter(x => x.k === 'doc').map(x => x.id) }; })()"""
MINI = """(sel) => { const h = document.querySelector(sel); const m = h && h.wsmap; return m ? { n: m.graph.nodes.length, labels: m.debug.labels, pulses: m.debug.pulses, regions: m.debug.regions } : null; }"""

def partial(br, vw, vh, tag):
    """own = 3 and 12: only your items in the brain, each in a fresh context"""
    for n in (3, 12):
        ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2 if tag == 'phone' else 1, has_touch=tag == 'phone', is_mobile=tag == 'phone')
        ctx.add_init_script(RAF)
        errs = []; pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and '/api/' not in m.text and '404' not in m.text else None)
        pg.goto(URL + '#/library'); pg.wait_for_function('() => window.WS && window.WS.api')
        pg.evaluate(SEEDN, n); pg.goto(URL + '#/map'); pg.reload(); pg.wait_for_selector('#wsMapHost .wsm-c'); settle(pg, 15000)
        if tag == 'desktop': pg.mouse.move(2, 2); pg.wait_for_timeout(100)
        st = pg.evaluate(STATE)
        leg = pg.inner_text('.wsm-leg').replace('\n', ' ')
        check(f'{tag} own={n}: own item count', st['own'] == n, st)
        check(f'{tag} own={n}: only your own nodes, no example or dust nodes', st['n'] == n and st['ex'] == 0, st)
        check(f'{tag} own={n}: laid out inside the brain silhouette', st['brain'] and st['inside'], st)
        want = ['DA42'] if n < 6 else ['DA42', 'C172', 'UNSORTED']
        check(f'{tag} own={n}: aircraft regions named', all(w in st['regions'] or w.title() in st['regions'] or w == 'UNSORTED' and 'Unsorted' in st['regions'] for w in want), st['regions'])
        check(f'{tag} own={n}: aircraft always labelled', all(a in st['labels'] for a in st['acs']), st['labels'])
        if tag == 'desktop': check(f'{tag} own={n}: documents labelled when there is room', any(d in st['labels'] for d in st['docs']), st['labels'])
        check(f'{tag} own={n}: notes are not labelled until hover', not any(l.startswith('note:') for l in st['labels']), st['labels'])
        check(f'{tag} own={n}: legend counts only yours, no fade hint', ('Aircraft ' + str(1 if n < 6 else 2)) in leg and 'fade' not in leg, leg)
        check(f'{tag} own={n}: no example tag or call to action', pg.locator('.wsm-tag').count() == 0 and pg.locator('.wsm-cta').count() == 0)
        n_idle, n_pulse = idle_frames(pg, 1500)
        check(f'{tag} own={n}: idle map requests no frames', n_idle == 0, (n_idle, n_pulse))
        if tag == 'phone': pg.evaluate("document.getElementById('wsMapPlate').scrollIntoView({ block: 'end' })")
        pg.wait_for_timeout(200)
        pg.screenshot(path=f'{BRAIN}/{tag}-own{n}.png')
        if tag == 'phone': pg.evaluate('window.scrollTo(0, 0)'); pg.wait_for_timeout(100)
        if n == 12:
            box = pg.locator('#wsMapHost canvas').bounding_box()
            ni = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.k === 'note')")
            x, y = pg.evaluate(f'window.WS.map.screenOf({ni})')
            if tag == 'desktop':
                pg.mouse.move(box['x'] + x, box['y'] + y); pg.wait_for_timeout(150)
                lb = pg.evaluate('window.WS.map.debug.labels')
                check('desktop own=12: hover shows the note label', pg.evaluate(f'window.WS.map.graph.nodes[{ni}].id') in lb, lb)
                pg.screenshot(path=f'{BRAIN}/desktop-own12-hover.png')
                pg.mouse.move(2, 2); pg.wait_for_timeout(100)
            pg.fill('.wsm-qi', 'Own doc 0'); pg.wait_for_selector('.wsm-sug li[data-i]')
            check(f'{tag} own=12: search finds your items', all('Own' in t for t in pg.locator('.wsm-sug li[data-i] span').all_inner_texts()))
            pg.fill('.wsm-qi', 'B200'); pg.wait_for_timeout(100)
            check(f'{tag} own=12: nothing from the example is on the map', pg.locator('.wsm-sug li[data-i]').count() == 0)
            pg.fill('.wsm-qi', ''); pg.keyboard.press('Escape')
            pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(700)
            oi = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.id === 'doc:od0')")
            x, y = pg.evaluate(f'window.WS.map.screenOf({oi})')
            if tag == 'desktop': pg.mouse.click(box['x'] + x, box['y'] + y)
            else: pg.touchscreen.tap(box['x'] + x, box['y'] + y)
            pg.wait_for_selector('.dk-tab.on', timeout=5000)
            check(f'{tag} own=12: an own dot opens on the desk', 'Own doc 0' in pg.inner_text('.dk-tab.on'), pg.inner_text('.dk-tab.on'))
        if tag == 'desktop':
            pg.goto(URL + '#/library'); pg.wait_for_selector('#wsRailMap canvas'); pg.wait_for_timeout(1200)
            mi = pg.evaluate(MINI, '#wsRailMap .h')
            check(f'desktop own={n}: sidebar mini map: your dots, no labels', pg.locator('#wsRailMap.sample').count() == 0 and ('YOUR MAP · ' + str(n)) in pg.inner_text('#wsRailMap').upper() and mi and mi['n'] == n and not mi['labels'], (pg.inner_text('#wsRailMap'), mi))
            pg.locator('#wsRailMap').screenshot(path=f'{BRAIN}/desktop-own{n}-sidebar.png')
        if tag == 'desktop' and n == 3:  # (at 12 a document is open on the desk, so the desk home is not shown)
            pg.goto(URL + '#/'); pg.wait_for_selector('.dk-empty .mm canvas'); pg.wait_for_timeout(1500)
            mi = pg.evaluate(MINI, '.dk-empty .mmh')
            check(f'desktop own={n}: desk home mini map: your dots, only aircraft regions named', mi and mi['n'] == n and mi['labels'] and all(l.startswith('region:') for l in mi['labels']) and 'region:UNSORTED' not in mi['labels'], mi)
            n_idle, n_pulse = idle_frames(pg, 1500)
            check(f'desktop own={n}: idle mini maps: no frames, no pulses', n_idle == 0 and n_pulse == 0, (n_idle, n_pulse))
            pg.screenshot(path=f'{BRAIN}/desktop-own{n}-home.png')
        check(f'{tag} own={n}: no console errors', not errs, errs)
        ctx.close()

def no_aircraft(br):
    """documents and notes but no aircraft: one region, Unsorted, with a hint"""
    ctx = br.new_context(viewport={'width': 1470, 'height': 956}); ctx.add_init_script(RAF); pg = ctx.new_page()
    pg.goto(URL + '#/library'); pg.wait_for_function('() => window.WS && window.WS.api')
    pg.evaluate("""async () => { const W = window.WSCORE, A = window.WS.api, l = [W.newDocEntry({ id: 'u1', name: 'Loose AFM', pages: 10 })];
      for (let i = 0; i < 4; i++) l.push(W.newNote({ title: 'Loose ' + i, body: i % 2 ? '<cite data-doc="u1" data-p="2">p</cite>' : '<div>x</div>' })); await A.commit(l); }""")
    pg.goto(URL + '#/map'); pg.reload(); pg.wait_for_selector('#wsMapHost .wsm-c'); settle(pg); pg.mouse.move(2, 2); pg.wait_for_timeout(100)
    st = pg.evaluate(STATE)
    check('no aircraft: one Unsorted region with your items inside', st['regions'] == ['Unsorted'] and st['n'] == 5 and st['inside'], st)
    pg.screenshot(path=f'{BRAIN}/desktop-own5-noaircraft.png')
    pg.click('.langseg button[data-v="no"]'); pg.wait_for_timeout(500); settle(pg)
    check('no aircraft: Norwegian region name', pg.evaluate('window.WS.map.debug.regions') == ['Uten fly'], pg.evaluate('window.WS.map.debug.regions'))
    pg.click('.langseg button[data-v="en"]'); pg.wait_for_timeout(300)
    ctx.close()

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for (vw, vh, tag) in [(1470, 956, 'desktop'), (390, 844, 'phone')]:
        partial(br, vw, vh, tag)
    no_aircraft(br)
    for (vw, vh, tag) in [(1470, 956, 'desktop'), (390, 844, 'phone')]:
        ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2 if tag == 'phone' else 1, has_touch=tag == 'phone', is_mobile=tag == 'phone')
        ctx.add_init_script(RAF)
        errs = []
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and '/api/' not in m.text and '404' not in m.text else None)
        pg.goto(URL + '#/map'); pg.wait_for_selector('.wsm-c')
        settle(pg)
        check(tag + ': empty workspace shows the example map', pg.is_visible('.wsm-tag') and 'Add a document or note' in pg.inner_text('.wsm-cta'))
        st = pg.evaluate(STATE)
        check(tag + ': the example is small: at most 25 dots, three named aircraft regions', 20 <= st['n'] <= 25 and st['regions'] == ['DA42', 'B200', 'C172'], st)
        if tag == 'desktop': pg.mouse.move(2, 2)
        else: pg.evaluate("document.getElementById('wsMapPlate').scrollIntoView({ block: 'end' })")
        pg.wait_for_timeout(300)
        pg.screenshot(path=f'{BRAIN}/{tag}-own0.png')
        if tag == 'phone': pg.evaluate('window.scrollTo(0, 0)'); pg.wait_for_timeout(100)
        check(tag + ': Map is in the workspace navigation', pg.locator('#wsRail a[href="#/map"].on').count() == 1)
        pg.screenshot(path=f'{SHOTS}/{tag}-map-example.png')
        inside = pg.evaluate("(() => { const m = window.WS.map, L = m.layout, G = window.WSGRAPH; return L.brain && m.graph.nodes.every((n, i) => G.inBrain(L.x[i] / L.S, L.y[i] / L.S, 0.005)); })()")
        check(tag + ': example laid out inside the brain', inside)
        # hover (or tap) a note: card explains it, neighbours light up, a pulse runs and then stops
        i = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.k === 'note' && n.deg >= 1)")
        x, y = pg.evaluate(f'window.WS.map.screenOf({i})'); box = pg.locator('#wsMapHost canvas').bounding_box()
        if tag == 'desktop':
            pg.mouse.move(box['x'] + x, box['y'] + y); pg.wait_for_timeout(120)
            card = pg.inner_text('.wsm-card') if pg.is_visible('.wsm-card') else ''
            check('desktop: hover an example dot explains it', 'EXAMPLE' in card.upper() and 'cites a page in' in card and 'this is where a note would go' in card, card)
            check('desktop: hover starts a pulse along its links', pg.evaluate('window.WS.map.debug.pulses') > 0)
            pg.screenshot(path=f'{SHOTS}/desktop-example-hover.png')
            pg.mouse.click(box['x'] + x, box['y'] + y); pg.wait_for_timeout(100)
        else:
            pg.touchscreen.tap(box['x'] + x, box['y'] + y); pg.wait_for_timeout(150)
        check(tag + ': click offers the real action', pg.locator('.wsm-card [data-act="map-note"]').count() == 1, pg.inner_text('.wsm-card'))
        pg.wait_for_function("() => window.WS.map.debug.pulses === 0", timeout=4000)
        pg.screenshot(path=f'{SHOTS}/{tag}-example-selected.png')
        # search and legend work on the example
        pg.fill('.wsm-qi', 'LN-EXB'); pg.wait_for_selector('.wsm-sug li[data-i]'); pg.press('.wsm-qi', 'Enter'); pg.wait_for_timeout(700)
        check(tag + ': search finds an example aircraft', 'B200' in pg.inner_text('.wsm-card') and pg.locator('.wsm-card [data-act="ac-new"]').count() == 1, pg.inner_text('.wsm-card'))
        pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(600)
        pg.click('.wsm-leg [data-g="note"]'); pg.wait_for_timeout(150)
        check(tag + ': legend filters the example', pg.get_attribute('.wsm-leg [data-g="note"]', 'aria-pressed') == 'false')
        pg.click('.wsm-leg [data-g="note"]'); pg.wait_for_timeout(100)
        if tag == 'desktop':
            pg.click('.wsm-card [data-act="ac-new"]'); pg.wait_for_selector('#wsDlg[open]', timeout=4000)
            check('desktop: the action is the real one (add aircraft dialog)', pg.is_visible('#wsDlg'))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
            pg.goto(URL + '#/library'); pg.wait_for_timeout(300)
            mi = pg.evaluate(MINI, '#wsRailMap .h')
            check('desktop: sidebar shows the simple example, no labels', pg.locator('#wsRailMap.sample canvas').count() == 1 and mi and mi['n'] <= 25 and not mi['labels'], mi)
            pg.locator('#wsRailMap').screenshot(path=f'{SHOTS}/desktop-sidebar-example.png')
        if tag == 'desktop':
            pg.goto(URL + '#/'); pg.wait_for_selector('.dk-empty .big3'); pg.wait_for_timeout(300)
            check('new user: desk home shows the example map', pg.locator('.dk-empty .mm').count() == 1)
            pg.wait_for_timeout(1200); pg.screenshot(path=f'{BRAIN}/desktop-own0-home.png')
            pg.evaluate(SEED); pg.reload(); pg.wait_for_selector('.dk-empty .big3')
            pg.wait_for_selector('.dk-empty .mm canvas')
            pg.wait_for_function("() => { const c = document.querySelector('.dk-empty .mm canvas'); return c && c.width > 0; }")
            pg.wait_for_timeout(4500)
            check('desk home: mini map replaces the drawing', pg.locator('.dk-empty .mm').count() == 1 and pg.locator('.dk-empty .sk svg').count() == 0)
            n_idle, n_pulse = idle_frames(pg, 1500)
            check('desk home: idle mini map requests no frames but pulse frames', n_idle == 0, (n_idle, n_pulse))
            pg.screenshot(path=f'{SHOTS}/desktop-home-minimap.png')
            pg.click('.dk-empty .mm'); pg.wait_for_selector('#wsMapHost .wsm-c')
        else:
            pg.evaluate(SEED); pg.reload(); pg.wait_for_selector('#wsMapHost .wsm-c')
        settle(pg, 15000)
        leg = pg.inner_text('.wsm-leg')
        check(tag + ': legend counts', all(x in leg.replace('\n', ' ') for x in ['Aircraft 3', 'Documents 15', 'Notes 40', 'Packs 5', 'Routes 6']), leg)
        check(tag + ': no example on a real workspace', pg.locator('.wsm-tag').count() == 0)
        n = pg.evaluate('window.WS.map.graph.nodes.length'); l = pg.evaluate('window.WS.map.graph.links.length')
        check(tag + ': nodes and links (only yours: no pages, desks or example dots)', n == 69 and l > 60, (n, l))
        n_idle, n_pulse = idle_frames(pg, 1500)
        check(tag + ': settled map requests no animation frames but pulse frames', n_idle == 0, (n_idle, n_pulse))
        st = pg.evaluate(STATE)
        check(tag + ': own map: your items in the brain by region', st['brain'] and st['inside'] and st['ex'] == 0 and all(r in st['regions'] for r in ['DA42', 'C172', 'B200', 'Unsorted']), st['regions'])
        if tag == 'desktop':
            # life: now and then a faint pulse, at a small frame budget (pointer off the map, so no hover)
            pg.mouse.move(2, 2); pg.wait_for_timeout(200)
            n_idle, n_pulse = idle_frames(pg, 6000)
            check('desktop: pulses are rare (none in 6 s of idle)', n_idle == 0 and n_pulse <= 80, (n_idle, n_pulse))
            pg.evaluate('window.WS.map.pulseNow()')
            n_idle, n_pulse = idle_frames(pg, 3000)
            check('desktop: a pulse runs along a real link, at a small frame budget, then stops', n_idle == 0 and 0 < n_pulse <= 90 and pg.evaluate('window.WS.map.debug.pulses') == 0, (n_idle, n_pulse))
        pg.screenshot(path=f'{SHOTS}/{tag}-map.png')
        dpr = pg.evaluate("(() => { const c = document.querySelector('#wsMapHost canvas'); return c.width / c.getBoundingClientRect().width; })()")
        check(tag + ': canvas uses the device pixel ratio', abs(dpr - (2 if tag == 'phone' else 1)) < 0.02, dpr)
        # legend filter
        pg.click('.wsm-leg [data-g="note"]'); pg.wait_for_timeout(150)
        check(tag + ': legend hides notes', pg.get_attribute('.wsm-leg [data-g="note"]', 'aria-pressed') == 'false')
        pg.screenshot(path=f'{SHOTS}/{tag}-map-no-notes.png')
        pg.click('.wsm-leg [data-g="note"]'); pg.wait_for_timeout(100)
        # search -> zoom to an aircraft, card
        pg.fill('.wsm-qi', 'LN-KAB'); pg.wait_for_selector('.wsm-sug li[data-i]')
        kb = pg.evaluate('window.WS.map.camera.k'); pg.press('.wsm-qi', 'Enter'); pg.wait_for_timeout(900)
        check(tag + ': search selects and zooms', pg.is_visible('.wsm-card') and 'LN-KAB' in pg.inner_text('.wsm-card') and pg.evaluate('window.WS.map.camera.k') > 1.5 * kb, pg.inner_text('.wsm-card') if pg.is_visible('.wsm-card') else '')
        pg.screenshot(path=f'{SHOTS}/{tag}-map-search.png')
        if tag == 'desktop':
            # hover a document: label and neighbours
            pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(700)
            i = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.id === 'doc:fd0')")
            x, y = pg.evaluate(f'window.WS.map.screenOf({i})'); box = pg.locator('#wsMapHost canvas').bounding_box()
            pg.mouse.move(box['x'] + x, box['y'] + y); pg.wait_for_timeout(200)
            pg.screenshot(path=f'{SHOTS}/desktop-map-hover.png')
            # wheel zoom
            k0 = pg.evaluate('window.WS.map.camera.k'); pg.mouse.wheel(0, -240); pg.wait_for_timeout(200); k1 = pg.evaluate('window.WS.map.camera.k')
            check('desktop: wheel zooms in', k1 > k0 * 1.2, (k0, k1)); pg.screenshot(path=f'{SHOTS}/desktop-map-zoomed.png')
            pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(700)
            x, y = pg.evaluate(f'window.WS.map.screenOf({i})')
            pg.mouse.click(box['x'] + x, box['y'] + y); pg.wait_for_selector('.dk-tab.on')
            check('desktop: click opens the document on the desk', 'AFM LN-ABC' in pg.inner_text('.dk-tab.on'), pg.inner_text('.dk-tab.on'))
            # open a cited page beside from the map card
            pg.goto(URL + '#/map'); settle(pg)
            pg.fill('.wsm-qi', 'VMCA 1'); pg.wait_for_selector('.wsm-sug li[data-i]'); pg.press('.wsm-qi', 'Enter'); pg.wait_for_timeout(600)
            pg.click('.wsm-card [data-o="beside"]'); pg.wait_for_selector('.dk-tab.on')
            check('desktop: open beside from the card', pg.locator('.dk-pane').count() >= 2 and any('VMCA 1' in t for t in pg.locator('.dk-tab').all_inner_texts()), pg.locator('.dk-tab').all_inner_texts())
        else:
            # tap a node opens it on the desk
            pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(700)
            i = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.id.startsWith('aircraft:'))")
            x, y = pg.evaluate(f'window.WS.map.screenOf({i})'); box = pg.locator('#wsMapHost canvas').bounding_box()
            pg.touchscreen.tap(box['x'] + x, box['y'] + y); pg.wait_for_selector('.dk-tab, .av-h', timeout=5000)
            check('phone: tap opens the aircraft on the desk', pg.locator('.av-h').count() >= 1)
            pg.goto(URL + '#/'); pg.wait_for_timeout(300)
        pg.goto(URL + '#/library'); pg.wait_for_timeout(200)
        check(tag + ': leaving the map stops it', pg.evaluate('!window.WS.map'))
        # reduced motion: drawn once, no frames afterwards
        pg.emulate_media(reduced_motion='reduce'); pg.goto(URL + '#/map'); pg.wait_for_selector('#wsMapHost canvas'); pg.wait_for_timeout(300)
        r0 = pg.evaluate('window.__raf'); pg.wait_for_timeout(800); r1 = pg.evaluate('window.__raf')
        check(tag + ': reduced motion: settled at once, no frames', pg.evaluate('window.WS.map.debug.settled') and r1 == r0, (r0, r1))
        if tag == 'desktop':
            i = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.deg >= 2)"); x, y = pg.evaluate(f'window.WS.map.screenOf({i})'); box = pg.locator('#wsMapHost canvas').bounding_box()
            pg.mouse.move(box['x'] + x, box['y'] + y); pg.wait_for_timeout(100)
            n_idle, n_pulse = idle_frames(pg, 6000)
            check('desktop: reduced motion: no pulses', n_pulse == 0 and pg.evaluate('window.WS.map.debug.pulses') == 0, (n_idle, n_pulse))
        pg.emulate_media(reduced_motion='no-preference')
        if tag == 'desktop':
            pg.click('.langseg button[data-v="no"]'); pg.wait_for_timeout(500)
            check('desktop: Norwegian strings', 'Dokumenter 15' in pg.inner_text('.wsm-leg').replace('\n', ' ') and pg.get_attribute('.wsm-qi', 'placeholder') == 'Finn på kartet', pg.inner_text('.wsm-leg'))
            settle(pg)
            pg.screenshot(path=f'{SHOTS}/desktop-map-no.png')
        check(tag + ': no console errors', not errs, errs)
        ctx.close()
    br.close()
bad = [n for n, c in res if not c]
print(f'{len(res) - len(bad)}/{len(res)} passed')
sys.exit(1 if bad else 0)
