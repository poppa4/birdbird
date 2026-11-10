"""My Workspace in a real browser (signed out, plain static server: /api is absent and must be handled quietly).
    python3 tests/workspace_e2e.py [base-url] [shots-dir]
Flows: add aircraft, edit speeds, new note + edits (versions), import a PDF and a text document, link them,
search (names and inside documents), trash + restore, export -> wipe -> import backup -> everything back,
Norwegian, and every size from 1920 to 390 with no console errors and no horizontal overflow."""
import os, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:9200'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else '/tmp/wsshots'
FIX = '/tmp/wsfix'
os.makedirs(SHOTS, exist_ok=True)
URL = BASE + '/workspace.html'
results = []
def check(name, cond, info=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name + (('  ' + str(info)[:300]) if info and not cond else ''))

SIZES = [(1920, 1080), (1470, 956), (1440, 900), (1280, 800), (820, 1180), (390, 844)]

with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = br.new_context(viewport={'width': 1470, 'height': 956}, accept_downloads=True)
    errors = []
    def watch(pg):
        pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' and '/api/' not in m.text and '404' not in m.text else None)
    pg = ctx.new_page(); watch(pg)
    pg.goto(URL); pg.wait_for_selector('.ovs')
    check('home renders signed out', 'Not signed in' in pg.inner_text('#wsStatus'))
    pg.screenshot(path=SHOTS + '/00-empty-1470.png', full_page=True)

    # add aircraft
    pg.click('.ovs [data-act="ac-new"]'); pg.wait_for_selector('#acForm')
    pg.select_option('#acTypeKey', 'da42'); pg.fill('#acReg', 'ln-abc'); pg.fill('#acCs', 'Birdie 12'); pg.click('#acForm button[type=submit]')
    pg.wait_for_selector('.achead'); check('aircraft page opens', 'LN-ABC' in pg.inner_text('.achead'))
    pg.fill('#spBody tr:nth-child(1) .v', '68'); pg.fill('#spBody tr:nth-child(2) .v', '75')
    pg.fill('#acNotes', 'G1000 NXi. Tow bar in the left nose locker.')
    pg.click('.ac2 [data-act="sp-add"]'); pg.keyboard.type('Max crosswind'); pg.keyboard.press('Tab'); pg.keyboard.type('25'); pg.keyboard.press('Tab'); pg.keyboard.press('Control+a'); pg.keyboard.type('kt')
    # second aircraft from the list
    pg.goto(URL + '#/aircraft'); pg.click('.ws-h [data-act="ac-new"]'); pg.wait_for_selector('#acForm'); pg.select_option('#acTypeKey', 'c172'); pg.fill('#acReg', 'LN-NFT'); pg.click('#acForm button[type=submit]'); pg.wait_for_selector('.achead')

    # documents: PDF and text
    pg.goto(URL + '#/documents'); pg.wait_for_selector('.drop')
    with pg.expect_file_chooser() as fc: pg.click('.drop [data-act="doc-add"]')
    fc.value.set_files([FIX + '/DA42 NG AFM.pdf', FIX + '/Company SOP.txt'])
    pg.wait_for_function("document.querySelectorAll('#dList .rows>li').length===2", timeout=20000)
    txt = pg.inner_text('#dList'); check('two documents listed with categories', 'DA42 NG AFM' in txt and 'Company SOP' in txt and 'AFM / POH' in txt and 'SOP' in txt, txt)
    # open the PDF, link to the DA42, tag it
    pg.click('#dList a.n:has-text("DA42 NG AFM")'); pg.wait_for_selector('#docView .pg canvas', timeout=20000)
    check('PDF renders in the browser', pg.locator('#docView .pg').count() == 2)
    pg.check('#dAcs input >> nth=0'); pg.fill('#dTags', 'rev 9, g1000'); pg.press('#dTags', 'Tab'); pg.fill('#dRev', 'Rev. 9'); pg.press('#dRev', 'Tab')
    pg.wait_for_timeout(300)
    pg.click('[data-vm="text"]'); pg.wait_for_selector('#docView .txt'); check('extracted text view', 'crosswind' in pg.inner_text('#docView'))
    pg.click('[data-vm="file"]'); pg.wait_for_selector('#docView .pg canvas', timeout=20000)
    pg.screenshot(path=SHOTS + '/03-document-1470.png')
    # text doc: rename + link
    pg.goto(URL + '#/documents'); pg.click('#dList a.n:has-text("Company SOP")'); pg.wait_for_selector('#docView .txt')
    check('text document shows its text', 'Stabilised approach' in pg.inner_text('#docView'))
    pg.fill('#dName', 'Company SOP – Part B'); pg.press('#dName', 'Tab'); pg.select_option('#dCat2', 'company'); pg.check('#dAcs input >> nth=0'); pg.wait_for_timeout(300)
    # documents shared with Flight Intelligence
    fi = pg.evaluate("""() => new Promise(r => { const q = indexedDB.open('naeroson-fi'); q.onsuccess = () => { const g = q.result.transaction('docs').objectStore('docs').getAll(); g.onsuccess = () => r(g.result.map(d => [d.name, d.ac, d.kind, d.rev||''])); }; })""")
    check('same documents in the Flight Intelligence store, renamed and linked', any(n == 'Company SOP – Part B' and a != 'gen' for n, a, k, rv in fi) and any(n == 'DA42 NG AFM' and rv == 'Rev. 9' for n, a, k, rv in fi), fi)

    # notes with versions
    pg.goto(URL + '#/notes'); pg.click('.ws-h [data-act="note-new"]'); pg.wait_for_selector('#nBody')
    pg.fill('#nTitle', 'Engine failure after take-off'); pg.click('#nBody'); pg.keyboard.type('Maintain directional control. Identify, verify, feather.')
    pg.evaluate("""() => { const W = window.WSCORE, S = window.WS.state; const n = Object.values(S.items).find(x => x.kind === 'note'); n.versions = []; n.vAt = 0; n.updatedAt -= 10*60e3; }""")  # pretend the first burst was 10 min ago
    pg.click('#nBody'); pg.keyboard.press('End'); pg.keyboard.type(' Then the checklist.')
    pg.wait_for_timeout(200)
    check('note version taken after a pause', pg.locator('.vers li').count() == 1, pg.inner_text('#nSide'))
    pg.select_option('#nLink', label='Diamond DA42 · LN-ABC'); pg.wait_for_timeout(100)
    pg.select_option('#nLink', label='DA42 NG AFM'); pg.fill('#nTags', 'oei, checkride'); pg.press('#nTags', 'Tab'); pg.check('#nPin')
    # format: bold
    pg.click('#nBody'); pg.keyboard.press('Control+End'); pg.keyboard.press('Enter'); pg.click('.tb [data-cmd="formatBlock"][data-arg="h3"]'); pg.keyboard.type('After landing')
    pg.wait_for_timeout(200); pg.screenshot(path=SHOTS + '/05-note-1470.png')
    # view and restore version
    pg.click('.vers [data-ver]'); pg.wait_for_selector('#wsDlgOk'); pg.click('#wsDlgOk'); pg.wait_for_timeout(300)
    body = pg.inner_text('#nBody'); check('version restored, current kept as a version', 'Then the checklist' not in body and pg.locator('.vers li').count() == 2, body)
    pg.reload(); pg.wait_for_selector('#nBody'); check('note survives reload', 'Identify, verify' in pg.inner_text('#nBody') and 'Engine failure' in pg.input_value('#nTitle'))
    pg.goto(URL + '#/notes'); pg.wait_for_selector('.nt'); pg.screenshot(path=SHOTS + '/05b-notes-1470.png', full_page=True)

    # aircraft page gathers docs + notes
    pg.goto(URL + '#/aircraft'); pg.click('.acc:has-text("LN-ABC")'); pg.wait_for_selector('.achead')
    t = pg.inner_text('.ac2'); check('aircraft page gathers documents and notes', 'DA42 NG AFM' in t and 'Company SOP – Part B' in t and 'Engine failure' in t, t[:400])
    check('trainer link for DA42', pg.locator('.achead a[href="cockpit.html"]').count() == 1)
    check('speeds persisted', pg.input_value('#spBody tr:nth-child(1) .v') == '68' and 'Max crosswind' in [pg.input_value(x) for x in ['#spBody tr:last-child .k']])
    pg.screenshot(path=SHOTS + '/02-aircraft-1470.png', full_page=True)

    # a briefing pack and a route in the shared stores
    pg.evaluate("""() => { localStorage.setItem('naeroson-store-prep', JSON.stringify({p1:{id:'p1',title:'',created:Date.now()-864e5*3,updated:Date.now()-864e5*3,f:{depapt:'ENTO',destapt:'ENBR',date:'2026-11-12',type:'DA42',reg:'LN-ABC',rules:'IFR'}}, p2:{id:'p2',title:'Local VFR',created:Date.now()-864e5*40,updated:Date.now()-864e5*40,f:{depapt:'ENTO',destapt:'ENTO',reg:'LN-NFT',type:'C172',rules:'VFR',date:'2026-09-30'}}}));
      localStorage.setItem('naeroson-store-route', JSON.stringify({r1:{id:'r1',pts:[{t:'rwy',n:'ENTO'},{t:'fix',n:'TOR'},{t:'rwy',n:'ENBR'}],s:{cr:'6000'},updated:Date.now()-3600e3}})); }""")
    pg.goto(URL + '#/packs'); pg.reload(); pg.wait_for_selector('#pList .rows')
    check('packs listed', pg.locator('#pList .rows>li').count() == 2)
    pg.select_option('#pAc', label='Cessna 172 · LN-NFT'); check('filter packs by aircraft', pg.locator('#pList .rows>li').count() == 1 and 'Local VFR' in pg.inner_text('#pList'))
    pg.select_option('#pAc', value=''); pg.click('[data-act="pack-pin"][data-id="p2"]'); pg.wait_for_timeout(200)
    check('pinned pack first', 'Local VFR' in pg.inner_text('#pList .rows>li:first-child'))
    pg.click('[data-act="pack-dup"][data-id="p1"]'); pg.wait_for_timeout(500)
    check('duplicate pack', pg.locator('#pList .rows>li').count() == 3)
    pg.screenshot(path=SHOTS + '/04-packs-1470.png', full_page=True)

    # search
    pg.fill('#wsQ', 'feather'); pg.wait_for_timeout(400)
    t = pg.inner_text('#wsMain'); check('search finds note by text', 'Engine failure' in t, t[:300])
    pg.fill('#wsQ', 'crosswind'); pg.wait_for_timeout(400)
    t = pg.inner_text('#wsMain'); check('search inside documents with page', 'Inside your documents' in t and 'page 1' in t and 'LN-ABC' in t, t[:400])
    pg.screenshot(path=SHOTS + '/06-search-1470.png', full_page=True)
    pg.click('a.n:has-text("page 1")'); pg.wait_for_selector('#docView .pg', timeout=15000); check('search hit opens document', 'documents/' in pg.url)
    pg.fill('#wsQ', 'ENBR'); pg.wait_for_timeout(400); t = pg.inner_text('#wsMain'); check('search finds packs and routes', 'Briefing packs' in t and 'Routes' in t, t[:300])
    pg.fill('#wsQ', ''); pg.wait_for_timeout(400)

    # trash + restore
    pg.goto(URL + '#/documents'); pg.click('#dList a.n:has-text("Company SOP")'); pg.wait_for_selector('#dName')
    pg.click('.docmeta [data-act="trash"]'); pg.wait_for_selector('#dList')
    check('document moved to trash', pg.locator('#dList .rows>li').count() == 1)
    fi = pg.evaluate("""() => new Promise(r => { const q = indexedDB.open('naeroson-fi'); q.onsuccess = () => { const g = q.result.transaction('docs').objectStore('docs').getAll(); g.onsuccess = () => r(g.result.map(d => d.name)); }; })""")
    check('trashed document leaves Flight Intelligence', 'Company SOP – Part B' not in fi, fi)
    pg.goto(URL + '#/trash'); pg.wait_for_selector('.rows'); check('trash shows days left', '30 days' in pg.inner_text('#wsMain'))
    pg.screenshot(path=SHOTS + '/07-trash-1470.png')
    pg.click('[data-act="restore"]'); pg.wait_for_timeout(400)
    pg.goto(URL + '#/documents'); pg.wait_for_selector('#dList'); check('document restored', pg.locator('#dList .rows>li').count() == 2)
    pg.click('#dList a.n:has-text("Company SOP")'); pg.wait_for_selector('#docView .txt'); check('restored document keeps its text and links', 'Stabilised' in pg.inner_text('#docView') and pg.is_checked('#dAcs input >> nth=0'))

    # home + storage screenshots at the main size
    pg.goto(URL + '#/'); pg.wait_for_selector('.ovs'); pg.wait_for_timeout(200)
    check('backup reminder shown for device-only files', pg.locator('.ws-remind').count() == 1)
    pg.screenshot(path=SHOTS + '/01-home-1470.png', full_page=True)
    pg.screenshot(path=SHOTS + '/01-home-1470-fold.png')
    pg.goto(URL + '#/storage'); pg.wait_for_selector('.kepttable'); pg.screenshot(path=SHOTS + '/08-storage-1470.png', full_page=True)

    # snapshot of what we have, then export -> wipe -> import
    def snap():
        return pg.evaluate("""() => { const S = window.WS.state, W = window.WSCORE; return { ac: W.live(S.items,'aircraft').map(a=>a.reg+'|'+a.notes+'|'+a.speeds.filter(r=>r.v).length).sort(), notes: W.live(S.items,'note').map(n=>n.title+'|'+n.versions.length+'|'+n.links.length+'|'+n.pinned).sort(), docs: W.live(S.items,'doc').map(d=>d.name+'|'+d.cat+'|'+d.acIds.length+'|'+d.tags.join(',')).sort(), files: Object.keys(S.docs).length, blobs: S.blobs.size, packs: S.packs.length, routes: S.routes.length }; }""")
    before = snap()
    pg.click('[data-act="export"]')
    with pg.expect_download() as dl: pass
    path = SHOTS + '/backup.zip'; dl.value.save_as(path)
    check('backup file downloaded', os.path.getsize(path) > 3000, os.path.getsize(path))
    pg.wait_for_timeout(300); pg.goto(URL + '#/'); pg.wait_for_selector('.ovs'); check('reminder gone after backup', pg.locator('.ws-remind').count() == 0)
    pg.goto(URL + '#/storage'); pg.wait_for_selector('[data-act="wipe"]'); pg.click('[data-act="wipe"]'); pg.check('#wipeCk'); pg.click('#wsDlgOk'); pg.wait_for_timeout(600)
    pg.evaluate("() => { localStorage.removeItem('naeroson-store-prep'); localStorage.removeItem('naeroson-store-route'); }")
    pg.reload(); pg.wait_for_selector('.ovs')
    wiped = snap(); check('wipe removed everything', wiped['ac'] == [] and wiped['notes'] == [] and wiped['docs'] == [] and wiped['files'] == 0 and wiped['packs'] == 0, wiped)
    pg.goto(URL + '#/storage'); pg.wait_for_selector('[data-act="import"]')
    with pg.expect_file_chooser() as fc: pg.click('[data-act="import"]')
    fc.value.set_files(path); pg.wait_for_function("document.getElementById('bkNote') && /imported|importert/.test(document.getElementById('bkNote').textContent)", timeout=20000)
    pg.goto(URL + '#/'); pg.reload(); pg.wait_for_selector('.ovs'); after = snap()
    check('import brings everything back', after == before, {'before': before, 'after': after})
    pg.goto(URL + '#/documents'); pg.click('#dList a.n:has-text("DA42 NG AFM")'); pg.wait_for_selector('#docView .pg canvas', timeout=20000); check('PDF opens after import', True)
    # a not-a-backup file is refused without changes
    open('/tmp/wsfix/not-a-backup.zip', 'wb').write(b'PK nonsense ' * 20)
    pg.goto(URL + '#/storage'); pg.wait_for_selector('[data-act="import"]')
    with pg.expect_file_chooser() as fc: pg.click('[data-act="import"]')
    fc.value.set_files('/tmp/wsfix/not-a-backup.zip'); pg.wait_for_timeout(800)
    check('wrong file refused clearly', 'not a Birdbird backup' in pg.inner_text('#bkNote') and snap() == before, pg.inner_text('#bkNote'))

    # index entry without its file (as on a new device): honest label
    pg.evaluate("""() => new Promise(r => { const q = indexedDB.open('naeroson-fi'); q.onsuccess = () => { const tx = q.result.transaction(['docs','blobs'],'readwrite'); tx.objectStore('docs').getAll().onsuccess = e => { const d = e.target.result.find(x => /SOP/.test(x.name)); tx.objectStore('docs').delete(d.id); tx.objectStore('blobs').delete(d.id); }; tx.oncomplete = () => r(); }; })""")
    pg.goto(URL + '#/documents'); pg.reload(); pg.wait_for_selector('#dList')
    t = pg.inner_text('#wsMain'); check('missing file labelled and re-add offered', 'File not on this device' in t and 'listed but the file is not on this device' in t, t[:500])

    # keyboard: "/" focuses search, rail reachable
    pg.goto(URL + '#/'); pg.wait_for_selector('.ovs'); pg.keyboard.press('/'); check('slash focuses search', pg.evaluate("document.activeElement.id") == 'wsQ')

    # Norwegian
    pg.click('.langseg button[data-v="no"]'); pg.wait_for_timeout(200)
    t = pg.inner_text('body'); check('Norwegian', 'Mitt arbeidsområde' in t and 'Mine fly' in t and 'Lagret på denne enheten' in t)
    pg.screenshot(path=SHOTS + '/09-home-no-1470.png', full_page=True)
    pg.click('.langseg button[data-v="en"]'); pg.wait_for_timeout(200)

    # every size, every view: no overflow
    views = ['', 'aircraft', 'documents', 'packs', 'notes', 'routes', 'trash', 'storage', 'search?q=da42']
    ac_id = pg.evaluate("Object.values(WS.state.items).find(x=>x.kind==='aircraft'&&x.reg==='LN-ABC').id")
    note_id = pg.evaluate("Object.values(WS.state.items).find(x=>x.kind==='note').id")
    doc_id = pg.evaluate("Object.values(WS.state.items).find(x=>x.kind==='doc'&&/AFM/.test(x.name)).id")
    views += ['aircraft/' + ac_id, 'notes/' + note_id, 'documents/' + doc_id]
    for w, h in SIZES:
        pg.set_viewport_size({'width': w, 'height': h})
        bad = []
        for v in views:
            pg.goto(URL + '#/' + v); pg.wait_for_timeout(250)
            ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            wide = pg.evaluate("""() => [...document.querySelectorAll('.ws *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 1 && !e.closest('.ws-rail,.recent,.pages'); }).slice(0,3).map(e => e.className || e.tagName)""")
            if ov > 0 or wide: bad.append((v, ov, wide))
        check(f'no overflow at {w}x{h}', not bad, bad)
        pg.goto(URL + '#/'); pg.wait_for_timeout(250); pg.screenshot(path=f'{SHOTS}/10-home-{w}.png', full_page=True)
        if w in (820, 390):
            for v, nm in [('aircraft/' + ac_id, 'aircraft'), ('documents/' + doc_id, 'document'), ('notes/' + note_id, 'note'), ('documents', 'library'), ('notes', 'notes'), ('storage', 'storage')]:
                pg.goto(URL + '#/' + v); pg.wait_for_timeout(900 if 'documents/' in v else 300); pg.screenshot(path=f'{SHOTS}/11-{nm}-{w}.png', full_page=(nm not in ('document',)))
    pg.set_viewport_size({'width': 1470, 'height': 956}); pg.goto(URL + '#/documents'); pg.wait_for_timeout(300); pg.screenshot(path=SHOTS + '/03b-library-1470.png', full_page=True)
    check('no console errors', not errors, errors[:6])
    br.close()

fails = [n for n, ok in results if not ok]
print(f'\n{len(results) - len(fails)}/{len(results)} passed' + ('' if not fails else '; FAILED: ' + ', '.join(fails)))
sys.exit(1 if fails else 0)
