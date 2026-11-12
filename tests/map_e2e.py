"""My Workspace map in a real browser: example map when empty (laid out as a brain; hover explains a dot, click offers the
real action); a few items of your own (3 and 12): the complete brain with your dots inside it and the example as faint
ghosts that thin out as you add more (legend counts only yours, ghosts explained, own dots open on the desk, desk home and
sidebar mini maps show the brain too); 45 items: your own force layout with the brain glow; a seeded workspace (3 aircraft, 15 documents, 40 notes with
page references, 5 packs, 6 routes), legend filter, search, open on the desk, the mini map on the desk home, no animation
frames once the layout has settled apart from the rare faint pulses, none with reduced motion, phone size.
    python3 tests/map_e2e.py [base-url] [shots-dir]"""
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:9002'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/tmp/mapshots'
BRAIN = sys.argv[3] if len(sys.argv) > 3 else '/tmp/brain2shots'
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

def partial(br, vw, vh, tag):
    """own = 3, 12 (merged brain) and 45 (own layout), each in a fresh context"""
    ghosts = {}
    for n in (3, 12, 45):
        ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2 if tag == 'phone' else 1, has_touch=tag == 'phone', is_mobile=tag == 'phone')
        ctx.add_init_script(RAF)
        errs = []; pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and '/api/' not in m.text and '404' not in m.text else None)
        pg.goto(URL + '#/library'); pg.wait_for_function('() => window.WS && window.WS.api')
        pg.evaluate(SEEDN, n); pg.goto(URL + '#/map'); pg.reload(); pg.wait_for_selector('#wsMapHost .wsm-c'); settle(pg, 15000)
        st = pg.evaluate("""(() => { const m = window.WS.map, g = m.graph, L = m.layout, G = window.WSGRAPH;
          return { own: g.own, merged: !!g.merged, brain: !!L.brain, ghosts: m.debug.ghosts, glow: m.debug.glow,
            ownN: g.nodes.filter(x => !x.ghost).length, inside: !L.brain || g.nodes.every((x, i) => G.inBrain(L.x[i] / L.S, L.y[i] / L.S, 0.005)) }; })()""")
        leg = pg.inner_text('.wsm-leg').replace('\n', ' ')
        check(f'{tag} own={n}: own item count', st['own'] == n, st)
        if n < 40:
            ghosts[n] = st['ghosts']
            check(f'{tag} own={n}: complete brain with your dots inside it', st['merged'] and st['brain'] and st['inside'] and st['ghosts'] > 0, st)
            check(f'{tag} own={n}: legend counts only yours, with the fade hint', ('Aircraft ' + str(1 if n < 6 else 2)) in leg and 'Example dots fade' in leg, leg)
            check(f'{tag} own={n}: no example tag or call to action', pg.locator('.wsm-tag').count() == 0 and pg.locator('.wsm-cta').count() == 0)
            n_idle, n_pulse = idle_frames(pg, 1500)
            check(f'{tag} own={n}: idle merged map requests no frames but pulse frames', n_idle == 0, (n_idle, n_pulse))
        else:
            check(f'{tag} own={n}: full enough: your own layout with the brain glow, no ghosts', not st['merged'] and not st['brain'] and st['ghosts'] == 0 and st['glow'] is True, st)
            check(f'{tag} own={n}: no fade hint', 'Example dots fade' not in leg, leg)
        if tag == 'desktop': pg.mouse.move(2, 2)
        else: pg.evaluate("document.getElementById('wsMapPlate').scrollIntoView({ block: 'end' })")
        pg.wait_for_timeout(300)
        pg.screenshot(path=f'{BRAIN}/{tag}-own{n}.png')
        if tag == 'phone': pg.evaluate('window.scrollTo(0, 0)'); pg.wait_for_timeout(100)
        if n == 12:
            box = pg.locator('#wsMapHost canvas').bounding_box()
            gi = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.ghost && n.k === 'note')")
            x, y = pg.evaluate(f'window.WS.map.screenOf({gi})')
            if tag == 'desktop':
                pg.mouse.move(box['x'] + x, box['y'] + y); pg.wait_for_timeout(150)
                card = pg.inner_text('.wsm-card') if pg.is_visible('.wsm-card') else ''
                check('desktop own=12: hover a ghost explains it', 'this is where a note would go' in card, card)
                pg.screenshot(path=f'{BRAIN}/desktop-own12-ghost-hover.png')
                pg.mouse.click(box['x'] + x, box['y'] + y); pg.wait_for_timeout(120)
            else:
                pg.touchscreen.tap(box['x'] + x, box['y'] + y); pg.wait_for_timeout(150)
            check(f'{tag} own=12: a ghost offers the real action', pg.locator('.wsm-card [data-act="map-note"]').count() == 1, pg.inner_text('.wsm-card') if pg.is_visible('.wsm-card') else '')
            pg.screenshot(path=f'{BRAIN}/{tag}-own12-ghost-selected.png')
            pg.fill('.wsm-qi', 'Own doc 0'); pg.wait_for_selector('.wsm-sug li[data-i]')
            check(f'{tag} own=12: search finds only your own items', all('Own' in t for t in pg.locator('.wsm-sug li[data-i] span').all_inner_texts()))
            pg.fill('.wsm-qi', 'B200'); pg.wait_for_timeout(100)
            check(f'{tag} own=12: ghosts are not searchable', pg.locator('.wsm-sug li[data-i]').count() == 0)
            pg.fill('.wsm-qi', ''); pg.keyboard.press('Escape')
            pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(700)
            oi = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.id === 'doc:od0')")
            x, y = pg.evaluate(f'window.WS.map.screenOf({oi})')
            if tag == 'desktop': pg.mouse.click(box['x'] + x, box['y'] + y)
            else: pg.touchscreen.tap(box['x'] + x, box['y'] + y)
            pg.wait_for_selector('.dk-tab.on', timeout=5000)
            check(f'{tag} own=12: an own dot opens on the desk', 'Own doc 0' in pg.inner_text('.dk-tab.on'), pg.inner_text('.dk-tab.on'))
        if tag == 'desktop' and n in (3, 12):
            pg.goto(URL + '#/library'); pg.wait_for_selector('#wsRailMap canvas'); pg.wait_for_timeout(1500)
            check(f'desktop own={n}: sidebar mini map is yours (not the example)', pg.locator('#wsRailMap.sample').count() == 0 and ('YOUR MAP · ' + str(n)) in pg.inner_text('#wsRailMap').upper(), pg.inner_text('#wsRailMap'))
            pg.locator('#wsRailMap').screenshot(path=f'{BRAIN}/desktop-own{n}-sidebar.png')
        check(f'{tag} own={n}: no console errors', not errs, errs)
        ctx.close()
    check(f'{tag}: ghosts thin out as you add items', ghosts.get(3, 0) > ghosts.get(12, 0) > 0, ghosts)

def home_merged(br):
    """the desk home with 3 items: the mini map is the complete brain with your dots in it"""
    ctx = br.new_context(viewport={'width': 1470, 'height': 956}); ctx.add_init_script(RAF); pg = ctx.new_page()
    pg.goto(URL + '#/library'); pg.wait_for_function('() => window.WS && window.WS.api')
    pg.evaluate(SEEDN, 3); pg.goto(URL + '#/'); pg.reload(); pg.wait_for_selector('.dk-empty .mm canvas'); pg.wait_for_timeout(2500)
    check('desk home own=3: mini map shows your items in the brain', pg.locator('.dk-empty .mm').count() == 1 and 'Your workspace' in pg.inner_text('.dk-empty .mm') and '3' in pg.inner_text('.dk-empty .mm'), pg.inner_text('.dk-empty .mm'))
    n_idle, n_pulse = idle_frames(pg, 1500)
    check('desk home own=3: idle mini map requests no frames but pulse frames', n_idle == 0, (n_idle, n_pulse))
    pg.screenshot(path=f'{BRAIN}/desktop-own3-home.png')
    ctx.close()

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for (vw, vh, tag) in [(1470, 956, 'desktop'), (390, 844, 'phone')]:
        partial(br, vw, vh, tag)
    home_merged(br)
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
        check(tag + ': the example comes through the merged path, drawn in full', pg.evaluate('window.WS.map.graph.merged === true && window.WS.map.graph.own === 0 && window.WS.map.debug.ghosts === 0'))
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
        i = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.k === 'note' && n.deg >= 2)")
        x, y = pg.evaluate(f'window.WS.map.screenOf({i})'); box = pg.locator('#wsMapHost canvas').bounding_box()
        if tag == 'desktop':
            pg.mouse.move(box['x'] + x, box['y'] + y); pg.wait_for_timeout(120)
            card = pg.inner_text('.wsm-card') if pg.is_visible('.wsm-card') else ''
            check('desktop: hover an example dot explains it', 'EXAMPLE' in card.upper() and 'cites' in card and 'this is where a note would go' in card, card)
            check('desktop: hover starts a pulse along its links', pg.evaluate('window.WS.map.debug.pulses') > 0)
            pg.screenshot(path=f'{SHOTS}/desktop-example-hover.png')
            pg.mouse.click(box['x'] + x, box['y'] + y); pg.wait_for_timeout(100)
        else:
            pg.touchscreen.tap(box['x'] + x, box['y'] + y); pg.wait_for_timeout(150)
        check(tag + ': click offers the real action', pg.locator('.wsm-card [data-act="map-note"]').count() == 1, pg.inner_text('.wsm-card'))
        pg.wait_for_function("() => window.WS.map.debug.pulses === 0", timeout=4000)
        pg.screenshot(path=f'{SHOTS}/{tag}-example-selected.png')
        # search and legend work on the example
        pg.fill('.wsm-qi', 'B200'); pg.wait_for_selector('.wsm-sug li[data-i]'); pg.press('.wsm-qi', 'Enter'); pg.wait_for_timeout(700)
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
            check('desktop: sidebar shows the example brain', pg.locator('#wsRailMap.sample canvas').count() == 1)
            pg.locator('#wsRailMap').screenshot(path=f'{SHOTS}/desktop-sidebar-example.png')
        if tag == 'desktop':
            pg.goto(URL + '#/'); pg.wait_for_selector('.dk-empty .big3'); pg.wait_for_timeout(300)
            check('new user: desk home shows the example map', pg.locator('.dk-empty .mm').count() == 1)
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
        check(tag + ': nodes and links', n > 69 and l > 60, (n, l))
        n_idle, n_pulse = idle_frames(pg, 1500)
        check(tag + ': settled map requests no animation frames but pulse frames', n_idle == 0, (n_idle, n_pulse))
        check(tag + ': own map has the brain glow behind it', pg.evaluate('window.WS.map.debug.glow') is True)
        if tag == 'desktop':
            # life: now and then a faint pulse, at a small frame budget (pointer off the map, so no hover)
            pg.mouse.move(2, 2); pg.wait_for_timeout(200)
            n_idle, n_pulse = idle_frames(pg, 9000)
            check('desktop: an occasional pulse, few frames', n_idle == 0 and 0 < n_pulse <= 9 * 16, (n_idle, n_pulse))
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
