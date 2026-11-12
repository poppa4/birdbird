"""My Workspace map in a real browser. Empty workspace: a small example cloud (at most 25 dots, three aircraft groups);
hover explains a dot, click offers the real action. A few items of your own (3 and 12): only your items, each aircraft a
soft blob of its own and Unsorted for loose items, no example nodes; every group named with its count, the names never
over a dot, another name or an overlay and never off the plate (desktop and phone); dot names only on hover or in a
focused group; a group name focuses the group (its items listed in the card), a tap outside goes back; own dots open on
the desk (on a phone: tap for the card, then open); desk home and sidebar mini maps show the same cloud with group names
and without pulses. No aircraft: one Unsorted group.
A seeded workspace (3 aircraft, 15 documents, 40 notes, 5 packs, 6 routes): legend filter, search, open on the desk, no
animation frames once still apart from rare pulses along real links, none with reduced motion, phone size, Norwegian.
These 2D checks run with the map set to 2D. The 3D map (wsmap3d.js, SwiftShader): lazy-loaded, the example and your own
items as soft balls of points (one per group), hover/tap card, fly-to, search lights up, group names with counts (never
colliding, on the plate), a group name flies to the group and lists it, a tap outside goes back, open on the desk,
palettes, 2D/3D switch remembered, keyboard, no frames once grown and the sway is over, reduced
motion, the weak-device fallback to 2D, frame times.
    python3 tests/map_e2e.py [base-url] [shots-dir] [brain-shots-dir] [3d-shots-dir] [--only3d]"""
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:9005'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/tmp/mapshots'
BRAIN = sys.argv[3] if len(sys.argv) > 3 else '/tmp/brain3shots'
SHOTS3 = sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4].startswith('--') else '/tmp/brain3dshots'
ONLY3 = '--only3d' in sys.argv
os.makedirs(BRAIN, exist_ok=True); os.makedirs(SHOTS3, exist_ok=True)
os.makedirs(SHOTS, exist_ok=True)
URL = BASE + '/workspace.html'
res = []
def check(n, c, info=''):
    res.append((n, bool(c))); print(('ok   ' if c else 'FAIL ') + n + (('  ' + str(info)[:300]) if info and not c else ''))

RAF0 = """(() => { const r = window.requestAnimationFrame.bind(window); window.__raf = 0; window.__rafRun = 0; window.requestAnimationFrame = f => { window.__raf++; return r(ts => { window.__rafRun++; f(ts); }); }; })();"""
RAF = RAF0 + "localStorage.setItem('bb-map-view', '2d');"
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

STATE = """(() => { const m = window.WS.map, g = m.graph, L = m.layout;
  return { own: g.own, n: g.nodes.length, cloud: !!L.cloud, ex: g.nodes.filter(x => x.ghost || x.id.startsWith('ex:')).length,
    inside: !!L.cloud && g.nodes.every((x, i) => { const q = L.groups[L.gi[i]]; return q && Math.hypot(L.x[i] - q.cx, L.y[i] - q.cy) <= q.r + 0.01 && (q.ac >= 0 ? g.nodes[q.ac].id === x.ac : !x.ac); }),
    regions: m.debug.regions, labels: m.debug.labels, acs: g.nodes.filter(x => x.k === 'aircraft').map(x => x.id), docs: g.nodes.filter(x => x.k === 'doc').map(x => x.id) }; })()"""
MINI = """(sel) => { const h = document.querySelector(sel); const m = h && h.wsmap; return m ? { n: m.graph.nodes.length, labels: m.debug.labels, pulses: m.debug.pulses, regions: m.debug.regions, names: m.debug.groupLabels.map(a => a.text) } : null; }"""
# the group names on a map: each with a count; none clipped, none over another name, a dot or an overlay on the plate
LBL = """(sel) => { const h = document.querySelector(sel), m = h.wsmap, c = h.querySelector('canvas').getBoundingClientRect(), gl = m.debug.groupLabels, bad = [];
  const pl = h.closest('.wsm-plate'), ov = pl ? [...pl.querySelectorAll('.wsm-tag, .wsm-cta, .wsm-card, .wsm-top > *')].filter(e => !e.hidden && e.getBoundingClientRect().width).map(e => { const r = e.getBoundingClientRect(); return [r.left - c.left, r.top - c.top, r.right - c.left, r.bottom - c.top, e.className]; }) : [];
  gl.forEach((a, i) => { if (a.x0 < 0 || a.y0 < 0 || a.x1 > c.width || a.y1 > c.height) bad.push('clip ' + a.text); if (!/ · \\d+$/.test(a.text)) bad.push('count ' + a.text);
    gl.forEach((b, j) => { if (j > i && a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) bad.push('overlap ' + a.text + ' / ' + b.text); });
    ov.forEach(r => { if (a.x0 < r[2] && a.x1 > r[0] && a.y0 < r[3] && a.y1 > r[1]) bad.push('under ' + r[4] + ': ' + a.text); });
    m.graph.nodes.forEach((n, k) => { const p = m.screenOf(k); if (p[0] > a.x0 + 1 && p[0] < a.x1 - 1 && p[1] > a.y0 + 1 && p[1] < a.y1 - 1) bad.push('dot under ' + a.text); }); });
  return { n: gl.length, names: gl.map(a => a.text), bad }; }"""
def names_ok(pg, tag, sel, want):
    r = pg.evaluate(LBL, sel)
    check(tag + ': every group named with its count, no collisions, on the plate', (r['n'] == want if isinstance(want, int) else want in ' '.join(r['names'])) and not r['bad'], r)

def partial(br, vw, vh, tag):
    """own = 3 and 12: only your items in the cloud, each in a fresh context"""
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
        check(f'{tag} own={n}: laid out as a cloud, every dot in its own group', st['cloud'] and st['inside'], st)
        want = ['DA42'] if n < 6 else ['DA42', 'C172', 'Unsorted']
        check(f'{tag} own={n}: groups named', st['regions'] == want, st['regions'])
        names_ok(pg, f'{tag} own={n}', '#wsMapHost', len(want))
        check(f'{tag} own={n}: no dot names until hover', not st['labels'], st['labels'])
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
                check('desktop own=12: hover shows the note label and its card', pg.evaluate(f'window.WS.map.graph.nodes[{ni}].id') in lb and 'Own note' in pg.inner_text('.wsm-card'), lb)
                pg.screenshot(path=f'{BRAIN}/desktop-own12-hover.png')
                pg.mouse.move(2, 2); pg.wait_for_timeout(100)
            pg.fill('.wsm-qi', 'Own doc 0'); pg.wait_for_selector('.wsm-sug li[data-i]')
            check(f'{tag} own=12: search finds your items', all('Own' in t for t in pg.locator('.wsm-sug li[data-i] span').all_inner_texts()))
            pg.fill('.wsm-qi', 'B200'); pg.wait_for_timeout(100)
            check(f'{tag} own=12: nothing from the example is on the map', pg.locator('.wsm-sug li[data-i]').count() == 0)
            pg.fill('.wsm-qi', ''); pg.keyboard.press('Escape')
            pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(700)
            # a group name focuses the group: the camera moves to it, its items are named and listed; outside goes back
            gl = pg.evaluate("window.WS.map.debug.groupLabels.find(a => a.name === 'DA42')")
            k0 = pg.evaluate('window.WS.map.camera.k')
            gx, gy = box['x'] + (gl['x0'] + gl['x1']) / 2, box['y'] + (gl['y0'] + gl['y1']) / 2
            if tag == 'desktop': pg.mouse.click(gx, gy)
            else: pg.touchscreen.tap(gx, gy)
            pg.wait_for_timeout(800)
            gm = pg.evaluate("(() => { const m = window.WS.map, q = m.layout.groups[m.debug.gsel]; return { gsel: m.debug.gsel, m: q ? q.m.map(i => m.graph.nodes[i].id) : [], labels: m.debug.labels, k: m.camera.k }; })()")
            items = pg.locator('.wsm-card.grp .gl [data-i]').count()
            gp = pg.evaluate("(() => { const m = window.WS.map, q = m.layout.groups[0], c = document.querySelector('.wsm-card').getBoundingClientRect(), h = document.querySelector('#wsMapHost canvas').getBoundingClientRect(); return [(q.cx - m.camera.x) * m.camera.k + h.width / 2, (q.cy - m.camera.y) * m.camera.k + h.height / 2, c.left - h.left, c.top - h.top, c.right - h.left, c.bottom - h.top, h.width, h.height]; })()")
            beside = gp[0] > gp[4] if tag == 'desktop' else gp[1] < gp[3]
            check(f'{tag} own=12: a group name focuses its group, items listed, the group clear of the card', gm['gsel'] == 0 and items == len(gm['m']) and gm['k'] >= k0 * 0.99 and 'DA42' in pg.inner_text('.wsm-card') and beside and 0 < gp[0] < gp[6] and 0 < gp[1] < gp[7], (gm, items, k0, gp))
            check(f'{tag} own=12: every item of the focused group is named', all(i in gm['labels'] for i in gm['m']), gm)
            pg.screenshot(path=f'{BRAIN}/{tag}-own12-group.png')
            names_ok(pg, f'{tag} own=12 focused', '#wsMapHost', 'DA42 · ')
            if tag == 'desktop': pg.mouse.click(box['x'] + box['width'] - 30, box['y'] + box['height'] / 2)
            else: pg.touchscreen.tap(box['x'] + box['width'] - 12, box['y'] + box['height'] / 2)
            pg.wait_for_timeout(800)
            check(f'{tag} own=12: a tap outside goes back to the whole cloud', pg.evaluate('window.WS.map.debug.gsel') == -1 and not pg.is_visible('.wsm-card') and abs(pg.evaluate('window.WS.map.camera.k') - k0) / k0 < 0.02)
            oi = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.id === 'doc:od0')")
            x, y = pg.evaluate(f'window.WS.map.screenOf({oi})')
            if tag == 'desktop': pg.mouse.click(box['x'] + x, box['y'] + y)
            else:
                pg.touchscreen.tap(box['x'] + x, box['y'] + y); pg.wait_for_timeout(200)
                check('phone own=12: a tap shows the card first', 'Own doc 0' in pg.inner_text('.wsm-card'))
                pg.tap('.wsm-card [data-o="here"]')
            pg.wait_for_selector('.dk-tab.on', timeout=5000)
            check(f'{tag} own=12: an own dot opens on the desk', 'Own doc 0' in pg.inner_text('.dk-tab.on'), pg.inner_text('.dk-tab.on'))
        if tag == 'desktop':
            pg.goto(URL + '#/library'); pg.wait_for_selector('#wsRailMap canvas'); pg.wait_for_timeout(1200)
            mi = pg.evaluate(MINI, '#wsRailMap .h')
            check(f'desktop own={n}: sidebar mini map: your dots, group names only', pg.locator('#wsRailMap.sample').count() == 0 and ('YOUR MAP · ' + str(n)) in pg.inner_text('#wsRailMap').upper() and mi and mi['n'] == n and not mi['labels'] and mi['names'], (pg.inner_text('#wsRailMap'), mi))
            r = pg.evaluate(LBL, '#wsRailMap .h'); check(f'desktop own={n}: sidebar names never collide or clip', not r['bad'], r)
            pg.locator('#wsRailMap').screenshot(path=f'{BRAIN}/desktop-own{n}-sidebar.png')
        if tag == 'desktop' and n == 3:  # (at 12 a document is open on the desk, so the desk home is not shown)
            pg.goto(URL + '#/'); pg.wait_for_selector('.dk-empty .mm canvas'); pg.wait_for_timeout(1500)
            mi = pg.evaluate(MINI, '.dk-empty .mmh')
            check(f'desktop own={n}: desk home mini map: your dots, every group named with its count', mi and mi['n'] == n and not mi['labels'] and mi['names'] == ['DA42 · 2'], mi)
            r = pg.evaluate(LBL, '.dk-empty .mmh'); check(f'desktop own={n}: desk home names never collide or clip', not r['bad'], r)
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
    check('no aircraft: one Unsorted group with your items inside', st['regions'] == ['Unsorted'] and st['n'] == 5 and st['inside'], st)
    names_ok(pg, 'no aircraft', '#wsMapHost', 1)
    pg.screenshot(path=f'{BRAIN}/desktop-own5-noaircraft.png')
    pg.click('.langseg button[data-v="no"]'); pg.wait_for_timeout(500); settle(pg)
    check('no aircraft: Norwegian region name', pg.evaluate('window.WS.map.debug.regions') == ['Uten fly'], pg.evaluate('window.WS.map.debug.regions'))
    pg.click('.langseg button[data-v="en"]'); pg.wait_for_timeout(300)
    ctx.close()


# ---------------- the 3D map ----------------
IDLE3 = "() => [window.__rafRun, window.WSMAP3D ? window.WSMAP3D.stats.pulseFrames : 0]"
def idle3(pg, ms):
    a = pg.evaluate(IDLE3); pg.wait_for_timeout(ms); b = pg.evaluate(IDLE3)
    return (b[0] - a[0]) - (b[1] - a[1]), b[1] - a[1]
def ready3(pg, ms=30000):
    pg.wait_for_function("() => window.WS && window.WS.map && window.WS.map.is3d && window.WS.map.debug.settled", timeout=ms)
def still3(pg, ms=15000):
    pg.wait_for_function("() => { const d = window.WS.map.debug; return d.settled && !d.rotating && !d.running; }", timeout=ms)
ST3 = """(() => { const m = window.WS.map, g = m.graph, L = m.layout;
  return { n: g.nodes.length, own: g.own, regions: m.debug.regions, labels: m.debug.labels,
    inside: g.nodes.every((x, i) => { const c = L.clusters[L.gi[i]]; return Math.hypot(L.P[i * 3] - c.c[0], L.P[i * 3 + 1] - c.c[1], L.P[i * 3 + 2] - c.c[2]) <= c.r + 0.01; }),
    acs: g.nodes.filter(x => x.k === 'aircraft').map(x => x.id), cpu: m.debug.cpu, dpr: m.debug.dpr, frames: m.debug.frames }; })()"""
CPU = []
def ctx3(br, vw=1470, vh=956, phone=False, pref='3d', extra=''):
    ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=3 if phone else 1, has_touch=phone, is_mobile=phone)
    ctx.add_init_script(RAF0 + (f"localStorage.setItem('bb-map-view', '{pref}');" if pref else '') + "window.__wsm3dRotate = 3;" + extra)
    errs = []; pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and '/api/' not in m.text and '404' not in m.text else None)
    return ctx, pg, errs
def at3(pg, i):
    x, y = pg.evaluate(f'window.WS.map.screenOf({i})'); box = pg.locator('#wsMapHost canvas').bounding_box(); return box['x'] + x, box['y'] + y

def map3d(br):
    # the example, desktop
    ctx, pg, errs = ctx3(br)
    pg.goto(URL + '#/library'); pg.wait_for_function('() => window.WS && window.WS.api')
    check('3d: three.js is not loaded until the map opens', pg.evaluate('!window.THREE && !window.WSMAP3D'))
    pg.goto(URL + '#/map'); ready3(pg)
    check('3d: the 3D map loads (lazy three.js, WebGL)', pg.evaluate('!!window.THREE && window.WS.mapView') == '3d' and pg.locator('#wsMapHost canvas').count() == 1)
    st = pg.evaluate(ST3)
    check('3d example: about 22 points, each in its group, three named groups', 20 <= st['n'] <= 25 and st['inside'] and st['regions'] == ['DA42', 'B200', 'C172'], st)
    check('3d example: group names with counts', [' '.join(t.split()) for t in pg.locator('.wsm3-reg').all_inner_texts()] == ['DA42 · 7', 'B200 · 6', 'C172 · 6'], pg.locator('.wsm3-reg').all_inner_texts())
    check('3d: sways for a while after the grow-in', pg.evaluate('window.WS.map.debug.rotating') or pg.evaluate('window.WS.map.debug.running'))
    pg.mouse.move(2, 2); still3(pg)
    names_ok(pg, '3d example', '#wsMapHost', 3)
    n_idle, n_pulse = idle3(pg, 1500)
    check('3d: no frames once grown and the auto-rotation is over', n_idle == 0, (n_idle, n_pulse))
    pg.screenshot(path=f'{SHOTS3}/desktop-example.png')
    # hover a note: card explains it
    i = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.k === 'note' && n.deg >= 1)")
    x, y = at3(pg, i); pg.mouse.move(x, y); pg.wait_for_timeout(250)
    card = pg.inner_text('.wsm-card') if pg.is_visible('.wsm-card') else ''
    check('3d example: hover explains a point', 'EXAMPLE' in card.upper() and 'this is where a note would go' in card, card)
    check('3d example: hover lights its links and labels the point', pg.evaluate('window.WS.map.debug.labels').count(pg.evaluate(f'window.WS.map.graph.nodes[{i}].id')) == 1)
    pg.screenshot(path=f'{SHOTS3}/desktop-example-hover.png')
    pg.mouse.click(x, y); pg.wait_for_timeout(150)
    check('3d example: click pins the card with the real action', pg.locator('.wsm-card [data-act="map-note"]').count() == 1, pg.inner_text('.wsm-card'))
    # double-click an aircraft: fly to it
    a = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.k === 'aircraft')"); c0 = pg.evaluate('window.WS.map.camera')
    x, y = at3(pg, a); pg.mouse.dblclick(x, y); pg.wait_for_timeout(1300)
    c1 = pg.evaluate('window.WS.map.camera'); p = pg.evaluate(f'Array.from(window.WS.map.layout.P.slice({a} * 3, {a} * 3 + 3))')
    check('3d: double-click flies to the point', abs(c1['tx'] - p[0]) < 0.5 and abs(c1['tz'] - p[2]) < 0.5 and c1['d'] < c0['d'] * 0.8, (c0, c1, p))
    # reset view, region label flies to the region
    pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(1000)
    h = pg.evaluate('window.WS.map.home'); c2 = pg.evaluate('window.WS.map.camera')
    check('3d: Reset view returns home', abs(c2['d'] - h['d']) < 0.5 and abs(c2['tx'] - h['tx']) < 0.1, (c2, h))
    pg.click('.wsm3-reg >> nth=1'); pg.wait_for_timeout(1200)
    c3 = pg.evaluate('window.WS.map.camera'); p = pg.evaluate('window.WS.map.screenOf(window.WS.map.layout.clusters[1].ac)'); cr = pg.evaluate("(() => { const c = document.querySelector('.wsm-card').getBoundingClientRect(), h = document.querySelector('#wsMapHost canvas').getBoundingClientRect(); return [c.right - h.left, h.width, h.height]; })()")
    check('3d: a group name flies to its group (beside the card)', c3['d'] < h['d'] * 0.9 and cr[0] < p[0] < cr[1] and 0 < p[1] < cr[2], (c3, p, cr))
    gm = pg.evaluate("(() => { const m = window.WS.map; return { gsel: m.debug.gsel, labels: m.debug.labels, m: m.layout.clusters[1].m.map(i => m.graph.nodes[i].id) }; })()")
    check('3d: the focused group is listed in the card and every item named', gm['gsel'] == 1 and pg.locator('.wsm-card.grp .gl [data-i]').count() == len(gm['m']) and set(gm['m']) <= set(gm['labels']), gm)
    pg.wait_for_timeout(300); pg.screenshot(path=f'{SHOTS3}/desktop-example-group.png')
    box = pg.locator('#wsMapHost canvas').bounding_box(); pg.mouse.click(box['x'] + box['width'] - 20, box['y'] + box['height'] - 90); pg.wait_for_timeout(1100)
    c4 = pg.evaluate('window.WS.map.camera')
    check('3d: a click outside goes back to the whole cloud', pg.evaluate('window.WS.map.debug.gsel') == -1 and not pg.is_visible('.wsm-card') and abs(c4['d'] - h['d']) < 0.5, (c4, h))
    # search lights up the matches, Enter flies to the best one
    pg.fill('.wsm-qi', 'LN-EX'); pg.wait_for_timeout(150)
    check('3d: search lights up every match', pg.evaluate('window.WS.map.debug.lit') == 3, pg.evaluate('window.WS.map.debug.lit'))
    pg.screenshot(path=f'{SHOTS3}/desktop-example-search.png')
    pg.fill('.wsm-qi', 'LN-EXB'); pg.wait_for_selector('.wsm-sug li[data-i]'); pg.press('.wsm-qi', 'Enter'); pg.wait_for_timeout(1100)
    b = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.label === 'LN-EXB')"); p = pg.evaluate(f'Array.from(window.WS.map.layout.P.slice({b} * 3, {b} * 3 + 3))'); c4 = pg.evaluate('window.WS.map.camera')
    check('3d: search flies to the result and shows its card', 'B200' in pg.inner_text('.wsm-card') and abs(c4['tx'] - p[0]) < 0.5, pg.inner_text('.wsm-card'))
    pg.fill('.wsm-qi', ''); pg.press('.wsm-qi', 'Escape'); pg.press('.wsm-qi', 'Escape')
    # legend dims a type
    pg.click('.wsm-leg [data-g="note"]'); pg.wait_for_timeout(100)
    check('3d: colour key switches notes off', pg.get_attribute('.wsm-leg [data-g="note"]', 'aria-pressed') == 'false')
    pg.click('.wsm-leg [data-g="note"]')
    # palettes
    pg.click('.wsm-pal [data-pal="ember"]'); pg.wait_for_timeout(200)
    check('3d: palette Ember, remembered', pg.get_attribute('#wsMapHost', 'data-pal') == 'ember' and pg.evaluate("localStorage.getItem('bb-map-palette')") == 'ember')
    pg.click('.wsm-zm [data-z="fit"]'); pg.wait_for_timeout(900); pg.mouse.move(2, 2); pg.screenshot(path=f'{SHOTS3}/desktop-example-ember.png')
    pg.click('.wsm-pal [data-pal="mono"]'); pg.wait_for_timeout(200); pg.screenshot(path=f'{SHOTS3}/desktop-example-mono.png')
    pg.click('.wsm-pal [data-pal="ice"]')
    # keyboard
    pg.focus('#wsMapHost canvas'); c5 = pg.evaluate('window.WS.map.camera'); pg.keyboard.press('ArrowLeft'); pg.keyboard.press('+'); pg.wait_for_timeout(400); c6 = pg.evaluate('window.WS.map.camera')
    check('3d: keyboard turns and zooms', c6['th'] != c5['th'] and c6['d'] < c5['d'], (c5, c6))
    # pulses run along a real link and stop
    still3(pg, 20000); pg.evaluate('window.WS.map.pulseNow()')
    n_idle, n_pulse = idle3(pg, 2500)
    check('3d: a pulse runs, then frames stop', n_idle == 0 and 0 < n_pulse <= 120 and pg.evaluate('window.WS.map.debug.pulses') == 0, (n_idle, n_pulse))
    # 2D / 3D switch
    pg.click('.wsm-vw [data-view="2d"]'); pg.wait_for_selector('#wsMapHost .wsm-c'); pg.wait_for_timeout(300)
    check('3d: switch to 2D, remembered', pg.evaluate("!window.WS.map.is3d && window.WS.mapView === '2d' && localStorage.getItem('bb-map-view') === '2d'"))
    pg.click('.wsm-vw [data-view="3d"]'); ready3(pg)
    check('3d: switch back to 3D', pg.evaluate("window.WS.map.is3d && localStorage.getItem('bb-map-view') === '3d'"))
    st = pg.evaluate(ST3); CPU.append(('desktop example', st['cpu'], st['frames']))
    # your own 12 items: open on the desk
    pg.goto(URL + '#/library'); pg.evaluate(SEEDN, 12); pg.goto(URL + '#/map'); pg.reload(); ready3(pg)
    st = pg.evaluate(ST3)
    check('3d own=12: only your items, each in its group', st['n'] == 12 and st['own'] == 12 and st['inside'], st)
    check('3d own=12: groups per aircraft and Unsorted', st['regions'] == ['DA42', 'C172', 'Unsorted'], st['regions'])
    check('3d own=12: no example tag', pg.locator('.wsm-tag').count() == 0)
    pg.mouse.move(2, 2); still3(pg); pg.wait_for_timeout(150)
    names_ok(pg, '3d own=12', '#wsMapHost', 3)
    n_idle, n_pulse = idle3(pg, 1500)
    check('3d own=12: idle, no frames', n_idle == 0, (n_idle, n_pulse))
    pg.screenshot(path=f'{SHOTS3}/desktop-own12.png')
    st = pg.evaluate(ST3); CPU.append(('desktop own 12', st['cpu'], st['frames']))
    oi = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.id === 'doc:od0')")
    x, y = at3(pg, oi); pg.mouse.move(x, y); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{SHOTS3}/desktop-own12-hover.png')
    pg.mouse.click(x, y); pg.wait_for_timeout(150)
    check('3d own=12: click shows the card with Open on the desk', 'Own doc 0' in pg.inner_text('.wsm-card') and pg.locator('.wsm-card [data-o="here"]').count() == 1, pg.inner_text('.wsm-card'))
    pg.click('.wsm-card [data-o="here"]'); pg.wait_for_selector('.dk-tab.on', timeout=5000)
    check('3d own=12: opens on the desk', 'Own doc 0' in pg.inner_text('.dk-tab.on'))
    check('3d: leaving the map stops it', pg.evaluate('!window.WS.map'))
    # reduced motion: no grow-in, no rotation, no frames, no pulses
    pg.emulate_media(reduced_motion='reduce'); pg.goto(URL + '#/map'); ready3(pg); pg.wait_for_timeout(300)
    r0 = pg.evaluate('window.__raf'); pg.wait_for_timeout(1000); r1 = pg.evaluate('window.__raf')
    check('3d reduced motion: drawn at once, no sway, no frames', pg.evaluate('!window.WS.map.debug.rotating') and r1 == r0, (r0, r1))
    pg.evaluate('window.WS.map.pulseNow()'); pg.wait_for_timeout(300)
    check('3d reduced motion: no pulses', pg.evaluate('window.WS.map.debug.pulses') == 0)
    pg.emulate_media(reduced_motion='no-preference')
    # Norwegian
    pg.click('.langseg button[data-v="no"]'); ready3(pg)
    check('3d: Norwegian', pg.evaluate('window.WS.map.debug.regions')[-1] == 'Uten fly' and pg.get_attribute('.wsm-qi', 'placeholder') == 'Finn på kartet' and 'Tilbakestill' in pg.inner_text('.wsm-zm'), pg.evaluate('window.WS.map.debug.regions'))
    pg.click('.langseg button[data-v="en"]')
    check('3d desktop: no console errors', not errs, errs); ctx.close()

    # a weak device (the frame probe fails): the 2D map, no error
    ctx, pg, errs = ctx3(br, pref='', extra='window.__wsm3dProbeMs = 0.001;')
    pg.goto(URL + '#/map'); pg.wait_for_function("() => window.WS && window.WS.mapView === '2d' && window.WS.map && !window.WS.map.is3d", timeout=30000)
    check('3d: a weak device falls back to the 2D map', pg.evaluate("sessionStorage.getItem('bb-map-weak') === 'slow'") and pg.locator('.wsm-vw [data-view="3d"]').count() == 1)
    check('3d fallback: no console errors', not errs, errs); ctx.close()

    # phone
    ctx, pg, errs = ctx3(br, 390, 844, phone=True)
    pg.goto(URL + '#/library'); pg.wait_for_function('() => window.WS && window.WS.api'); pg.evaluate(SEEDN, 12)
    pg.goto(URL + '#/map'); pg.reload(); ready3(pg); still3(pg)
    st = pg.evaluate(ST3)
    check('3d phone: pixel ratio capped at 1.25', abs(st['dpr'] - 1.25) < 0.01, st['dpr'])
    pg.evaluate("document.getElementById('wsMapPlate').scrollIntoView({ block: 'end' })"); pg.wait_for_timeout(300)
    names_ok(pg, '3d phone own=12', '#wsMapHost', 3)
    pg.screenshot(path=f'{SHOTS3}/phone-own12.png')
    oi = pg.evaluate("window.WS.map.graph.nodes.findIndex(n => n.id === 'doc:od0')"); x, y = at3(pg, oi)
    pg.touchscreen.tap(x, y); pg.wait_for_timeout(250)
    check('3d phone: tap shows the card', pg.is_visible('.wsm-card') and 'Own doc 0' in pg.inner_text('.wsm-card'))
    pg.screenshot(path=f'{SHOTS3}/phone-own12-card.png')
    st = pg.evaluate(ST3); CPU.append(('phone own 12', st['cpu'], st['frames']))
    check('3d phone: no console errors', not errs, errs); ctx.close()
    for name, c, f in CPU: print(f'  frame CPU {name}: avg {c["avg"]:.2f} ms, p95 {c["p95"]:.2f} ms, max {c["max"]:.1f} ms over {c["n"]} frames ({f} frames in all)')

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    map3d(br)
    if ONLY3: br.close(); bad = [n for n, c in res if not c]; print(f'{len(res) - len(bad)}/{len(res)} passed'); sys.exit(1 if bad else 0)
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
        check(tag + ': example laid out as a cloud, every dot in its group', st['cloud'] and st['inside'], st)
        names_ok(pg, tag + ' example', '#wsMapHost', 3)
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
        check(tag + ': own map: your items in the cloud by group', st['cloud'] and st['inside'] and st['ex'] == 0 and st['regions'] == ['DA42', 'C172', 'B200', 'Unsorted'], st['regions'])
        names_ok(pg, tag + ' seeded', '#wsMapHost', 4)
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
            pg.touchscreen.tap(box['x'] + x, box['y'] + y); pg.wait_for_timeout(200)
            check('phone: tap shows the aircraft card', pg.is_visible('.wsm-card [data-o="here"]'))
            pg.tap('.wsm-card [data-o="here"]'); pg.wait_for_selector('.dk-tab, .av-h', timeout=5000)
            check('phone: Open on the desk opens the aircraft', pg.locator('.av-h').count() >= 1)
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
