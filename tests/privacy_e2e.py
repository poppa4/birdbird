"""Browser test of the privacy tools and the learning-only notes (static server, /api/* mocked in Playwright):
    python3 tests/privacy_e2e.py [static-server-url]     (default http://127.0.0.1:9101)
Covers: privacy.html "Clear Birdbird data" empties every Birdbird localStorage/sessionStorage key and IndexedDB database
(seeded first) and keeps the language and other sites' keys; My page "Download all my data" (signed out, and signed in with
the server export); account deletion with "Also delete everything stored on this device" (on by default); the learning-only
line on printed briefing-pack and kneeboard sheets; the note under the title on six pages at 390 and 1470 px in EN and NO."""
import json, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:9101').rstrip('/') + '/'
TRAIN = {'en': 'Training material only. Always follow the AIP, the flight manual and your operator’s procedures.',
         'no': 'Kun opplæringsmateriell. Følg alltid AIP, flyhåndboken og operatørens prosedyrer.'}
results = []
def check(name, cond, info=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name + (('  ' + str(info)[:400]) if info and not cond else ''))

LS = {'bb-track': 'ppl', 'bb-ws-items': '{}', 'bb-openaip-key': 'k', 'bb-ifr-v2': '{}', 'naeroson-prog': '{"quiz:holding":80}', 'naeroson-store-prep': '{"p1":{"id":"p1","updated":1}}',
      'aeroson-quiz-holding': '80', 'aeroson-fpl': '{}', 'vlab-done-forces': '1', 'vlab-depth': 'short', 'fi-imp-ck': '1', 'birdbird-navsim-snap': '{}', 'bb-debrief': '[]'}
SS = {'fi-view': 'docs', 'bb-ai-api': '1', 'bb-ai-off': '1', 'bb-map-weak': 'lost'}
SEED = """async ([ls, ss]) => {
  for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
  for (const [k, v] of Object.entries(ss)) sessionStorage.setItem(k, v);
  localStorage.setItem('other-site', 'keep'); sessionStorage.setItem('other-session', 'keep');
  const mk = (name, up, fill) => new Promise(res => { const r = indexedDB.open(name, 1); r.onupgradeneeded = () => up(r.result);
    r.onsuccess = () => { const db = r.result; const tx = fill(db); tx.oncomplete = () => { db.close(); res(); }; }; r.onerror = () => res(); });
  await mk('birdbird-workspace', db => { db.createObjectStore('items', { keyPath: 'id' }); db.createObjectStore('kv'); db.createObjectStore('trashdocs', { keyPath: 'id' }); },
    db => { const tx = db.transaction(['items', 'kv'], 'readwrite'); tx.objectStore('items').put({ id: 'n1', kind: 'note', title: 'My note', text: 'Remember the QNH' }); tx.objectStore('kv').put({ on: true }, 'settings'); return tx; });
  await mk('naeroson-fi', db => { db.createObjectStore('docs', { keyPath: 'id' }); db.createObjectStore('blobs', { keyPath: 'id' }); },
    db => { const tx = db.transaction(['docs', 'blobs'], 'readwrite'); tx.objectStore('docs').put({ id: 'd1', name: 'AFM.pdf', kind: 'afm', chunks: [{ p: 1, text: 'Vne 188 KIAS' }] });
      tx.objectStore('blobs').put({ id: 'd1', blob: new Blob(['%PDF-1.7 binary'], { type: 'application/pdf' }) }); return tx; });
  await mk('naeroson-docs', db => db.createObjectStore('docs', { keyPath: 'id' }), db => { const tx = db.transaction('docs', 'readwrite'); tx.objectStore('docs').put({ id: 'old', name: 'Old.pdf' }); return tx; });
  await mk('naeroson-att', db => db.createObjectStore('img'), db => { const tx = db.transaction('img', 'readwrite'); tx.objectStore('img').put(new Blob([new Uint8Array(20)], { type: 'image/jpeg' }), 'a1'); return tx; });
}"""
STATE = """async () => ({ ls: Object.keys(localStorage).sort(), ss: Object.keys(sessionStorage).sort(), dbs: (await indexedDB.databases()).map(d => d.name).sort() })"""

def mock_api(ctx, server):
    def handle(route):
        req = route.request; path = req.url.split('://', 1)[1].split('/', 1)[1].split('?')[0]; path = '/' + path
        server['calls'].append((req.method, path))
        body = None
        if path == '/api/me' and req.method == 'GET':
            body = {'ok': True, 'user': server['user'], 'recovery': {'created': 1}, 'credentials': [{'id': 'c1', 'name': 'Mac · Chrome', 'created': 1, 'lastUsed': 2, 'synced': True}], 'data': []} if server['user'] else {'ok': True, 'user': None}
        elif path == '/api/me' and req.method == 'DELETE':
            server['user'] = None; body = {'ok': True, 'deleted': True}
        elif path == '/api/me/export':
            body = {'ok': True, 'exported': '2026-11-14T10:00:00.000Z', 'user': {'id': 'u1', 'name': 'Pilot'}, 'passkeys': [{'device': 'Mac · Chrome'}], 'sessions': [{'device': 'Mac · Chrome', 'thisDevice': True}],
                    'syncedData': {'progress': {'version': 3, 'data': {'naeroson-prog': '{"quiz:holding":80}'}}}, 'aiUsage': [{'day': '2026-11-13', 'requests': 2, 'tokens': 900}], 'notes': 'x'}
        elif path == '/api/sync' and req.method == 'GET':
            body = {'ok': True, 'ns': {}, 'serverTime': 0}
        elif path == '/api/sync':
            body = {'ok': True, 'version': 1, 'updatedAt': 0}
        elif path == '/api/atc':
            body = {'ok': False, 'reason': 'signed_out'}
        else:
            body = {'ok': True}
        route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
    ctx.route('**/api/**', handle)

with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []
    def new_ctx(w=1470, lang='en', **kw):
        c = b.new_context(viewport={'width': w, 'height': 900}, accept_downloads=True, **kw)
        c.add_init_script(f"try{{ if(!localStorage.getItem('vlab-lang')) localStorage.setItem('vlab-lang','{lang}'); }}catch(e){{}}")
        return c

    # ---------- privacy.html: clear everything ----------
    ctx = new_ctx(lang='no'); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(('privacy', str(e))))
    pg.goto(BASE + 'privacy.html'); pg.evaluate(SEED, [LS, SS]); pg.reload(); pg.wait_for_timeout(600)
    before = pg.evaluate(STATE)
    check('privacy: seeded keys and four databases', len(before['ls']) >= len(LS) + 2 and before['dbs'] == ['birdbird-workspace', 'naeroson-att', 'naeroson-docs', 'naeroson-fi'], before)
    n_items = len([k for k in before['ls'] if k not in ('vlab-lang', 'other-site')]) + len(SS)
    check('privacy: count includes session keys', pg.inner_text('#cnt').startswith(str(n_items) + ' '), (n_items, pg.inner_text('#cnt')))
    pg.click('#clr'); pg.click('#clr'); pg.wait_for_function("document.querySelector('#res').textContent.length>0")
    after = pg.evaluate(STATE)
    check('privacy: only the language and other sites\' keys are left', after['ls'] == ['other-site', 'vlab-lang'], after)
    check('privacy: sessionStorage Birdbird keys gone', after['ss'] == ['other-session'], after)
    check('privacy: all Birdbird databases deleted', after['dbs'] == [], after)
    check('privacy: result message in Norwegian', 'Ferdig.' in pg.inner_text('#res'), pg.inner_text('#res'))
    ctx.close()

    # ---------- profile.html: download all my data (signed out) ----------
    ctx = new_ctx(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(('profile', str(e))))
    pg.goto(BASE + 'profile.html'); pg.evaluate(SEED, [LS, SS]); pg.reload(); pg.wait_for_timeout(800)
    check('profile: button label EN', pg.inner_text('#exp').strip() == 'Download all my data', pg.inner_text('#exp'))
    with pg.expect_download() as dl: pg.click('#exp')
    d = dl.value; data = json.loads(open(d.path()).read())
    check('export: file name', d.suggested_filename.startswith('birdbird-data-') and d.suggested_filename.endswith('.json'), d.suggested_filename)
    check('export: import-compatible header', data.get('app') == 'birdbird' and isinstance(data.get('keys'), dict), list(data))
    check('export: every Birdbird localStorage key', all(k in data['keys'] for k in LS) and 'other-site' not in data['keys'], list(data['keys']))
    check('export: sessionStorage', data['sessionStorage'] == SS, data['sessionStorage'])
    idb = data['indexedDB']
    check('export: four databases', sorted(idb) == ['birdbird-workspace', 'naeroson-att', 'naeroson-docs', 'naeroson-fi'], sorted(idb))
    check('export: workspace notes and settings', idb['birdbird-workspace']['items'][0]['text'] == 'Remember the QNH' and idb['birdbird-workspace']['kv'][0]['key'] == 'settings', idb['birdbird-workspace'])
    check('export: document metadata and extracted text kept', idb['naeroson-fi']['docs'][0]['chunks'][0]['text'] == 'Vne 188 KIAS')
    blob = idb['naeroson-fi']['blobs'][0]['blob']
    check('export: document file not included, described', blob.get('$file') == 'not included' and blob.get('type') == 'application/pdf' and blob.get('bytes') == 15, blob)
    check('export: image attachment described, not included', idb['naeroson-att']['img'][0]['value'].get('$file') == 'not included')
    check('export: note says files are left out (EN+NO)', 'not included' in data['notes']['en'] and 'ikke med' in data['notes']['no'])
    check('export: signed out = no account part', data['account'] is None)
    check('export: status message', 'Downloaded' in pg.inner_text('#expMsg'), pg.inner_text('#expMsg'))
    check('export: no database was created by reading', pg.evaluate(STATE)['dbs'] == ['birdbird-workspace', 'naeroson-att', 'naeroson-docs', 'naeroson-fi'])
    # the file imports back (the "keys" part)
    pg.evaluate("()=>{ localStorage.removeItem('aeroson-quiz-holding'); }")
    pg.set_input_files('#impFile', files=[{'name': 'x.json', 'mimeType': 'application/json', 'buffer': json.dumps(data).encode()}])
    pg.wait_for_function("document.querySelector('#impMsg').textContent.length>0")
    check('import reads the new file', pg.evaluate("localStorage.getItem('aeroson-quiz-holding')") == '80', pg.inner_text('#impMsg'))
    ctx.close()

    # ---------- profile.html signed in: server export included, then delete account + this device ----------
    server = {'user': {'id': 'u1', 'name': 'Pilot'}, 'calls': []}
    ctx = new_ctx(lang='no'); mock_api(ctx, server); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(('profile-in', str(e))))
    pg.goto(BASE + 'profile.html'); pg.evaluate(SEED, [LS, SS])
    pg.evaluate("()=>localStorage.setItem('birdbird-account', JSON.stringify({uid:'u1',signedIn:true,user:{id:'u1',name:'Pilot'},ns:{},last:0}))")
    pg.reload(); pg.wait_for_function("window.BBACCOUNT&&BBACCOUNT.user&&BBACCOUNT.user.id==='u1'"); pg.wait_for_timeout(600)
    check('profile: button label NO', pg.inner_text('#exp').strip() == 'Last ned alle dataene mine', pg.inner_text('#exp'))
    with pg.expect_download() as dl: pg.click('#exp')
    data = json.loads(open(dl.value.path()).read())
    check('export signed in: server part included', data['account'] and data['account']['user']['id'] == 'u1' and data['account']['aiUsage'][0]['tokens'] == 900 and 'ok' not in data['account'], data.get('account'))
    check('export signed in: local part too', 'naeroson-prog' in data['keys'] and 'naeroson-fi' in data['indexedDB'])
    check('export signed in: GET /api/me/export called', ('GET', '/api/me/export') in server['calls'])
    pg.wait_for_selector('#acDel'); pg.click('#acDel')
    check('delete dialog: device checkbox on by default', pg.is_checked('#acDelLocal'))
    check('delete dialog: label', pg.inner_text('#acDelLocalT') == 'Slett også alt som er lagret på denne enheten', pg.inner_text('#acDelLocalT'))
    n_calls = len(server['calls'])
    pg.click('#acDelYes'); pg.wait_for_function("!(window.BBACCOUNT&&BBACCOUNT.user)"); pg.wait_for_timeout(800)
    st = pg.evaluate(STATE)
    check('delete account: server delete called', ('DELETE', '/api/me') in server['calls'])
    check('delete account: this device cleared', st['ls'] == ['other-site', 'vlab-lang'] and st['ss'] == ['other-session'] and st['dbs'] == [], st)
    pg.wait_for_timeout(1500)
    check('delete account: no sync push after the wipe', not any(m == 'PUT' for m, pth in server['calls'][n_calls:]), server['calls'][n_calls:])
    ctx.close()

    # ---------- printed sheets carry the learning-only line ----------
    for lang in ['en', 'no']:
        ctx = new_ctx(lang=lang); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(('print', str(e))))
        pg.goto(BASE + 'prep.html'); pg.wait_for_timeout(1200); pg.emulate_media(media='print')
        r = pg.evaluate("()=>[...document.querySelectorAll('.sheet')].filter(s=>getComputedStyle(s).display!=='none').map(s=>getComputedStyle(s,'::after').content)")
        check(f'print prep {lang}: every printed sheet ends with the line', r and all(TRAIN[lang] in c for c in r), r[:2])
        check(f'print prep {lang}: the on-screen note is not printed', pg.evaluate("()=>{ const n=document.querySelector('p.bbtrain'); return !n||n.offsetParent===null; }"))
        pg.goto(BASE + 'sheets.html'); pg.wait_for_timeout(800); pg.emulate_media(media='print')
        r = pg.evaluate("()=>[...document.querySelectorAll('.a5')].filter(s=>getComputedStyle(s).display!=='none').map(s=>getComputedStyle(s,'::after').content)")
        check(f'print sheets {lang}: every kneeboard sheet ends with the line', len(r) == 3 and all(TRAIN[lang] in c for c in r), r)
        pdf = pg.pdf(format='A5', print_background=True)
        check(f'print sheets {lang}: PDF made', len(pdf) > 1000)
        ctx.close()

    # ---------- the note under the title ----------
    for lang in ['en', 'no']:
        for w in [390, 1470]:
            ctx = new_ctx(w=w, lang=lang); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(('note', str(e))))
            for u in ['prep.html', 'sheets.html', 'essentials.html', 'radio.html', 'checkride.html', 'wxreports.html']:
                pg.goto(BASE + u); pg.wait_for_timeout(700)
                n = pg.evaluate("()=>{ const n=document.querySelectorAll('p.bbtrain'); if(n.length!==1) return {count:n.length}; const r=n[0].getBoundingClientRect(), h=document.querySelector('header.lhead').getBoundingClientRect();"
                                " return {count:1,text:n[0].textContent,vis:r.height>0&&r.width>0,inHead:r.top>=h.top&&r.bottom<=h.bottom+1,size:getComputedStyle(n[0]).fontSize,over:document.documentElement.scrollWidth>innerWidth+1}; }")
                check(f'note {lang} {w} {u}', n.get('count') == 1 and n['text'] == TRAIN[lang] and n['vis'] and n['inHead'] and n['size'] == '13px' and not n['over'], n)
            ctx.close()
    # a page outside the list gets no note
    ctx = new_ctx(); pg = ctx.new_page(); pg.goto(BASE + 'weather.html'); pg.wait_for_timeout(500)
    check('no extra note on weather.html (has its own)', pg.evaluate("document.querySelectorAll('p.bbtrain').length") == 0); ctx.close()
    check('no page errors', not errs, errs[:5])
    b.close()

bad = [n for n, ok in results if not ok]
print(f'\n{len(results) - len(bad)}/{len(results)} passed')
sys.exit(1 if bad else 0)
