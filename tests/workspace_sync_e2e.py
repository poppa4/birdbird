"""My Workspace sync in the browser against an in-memory /api/sync with the same version check as functions/_lib/api.js.
    python3 tests/workspace_sync_e2e.py [base-url]
Two devices (browser contexts) on one account: aircraft and notes sync, a concurrent note edit keeps both texts,
document files never leave the device (only the index entry), and the second device is told which files to re-add."""
import json, sys, time
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:9200'
URL = BASE + '/workspace.html'
DB = {}; PUTS = []
res = []
def check(n, c, i=''):
    res.append((n, bool(c))); print(('ok   ' if c else 'FAIL ') + n + (('  ' + str(i)[:300]) if i and not c else ''))
def api(route):
    req = route.request; path = req.url.split('/api', 1)[1].split('?')[0]
    J = lambda st, o: route.fulfill(status=st, content_type='application/json', body=json.dumps(o))
    if path == '/me': return J(200, {'ok': True, 'user': {'id': 'u1', 'name': 'Pilot'}, 'credentials': [], 'data': []})
    if path == '/sync' and req.method == 'GET': return J(200, {'ok': True, 'ns': DB, 'serverTime': int(time.time() * 1000)})
    if path == '/sync' and req.method == 'PUT':
        b = json.loads(req.post_data); PUTS.append(b); ns = b['ns']; cur = DB.get(ns)
        if len(json.dumps(b['data'])) > 1500000: return J(413, {'ok': False, 'error': 'too_large', 'message': 'too large'})
        base = b.get('baseVersion') or 0
        if (cur and base != cur['version']) or (not cur and base != 0): return J(409, {'ok': False, 'error': 'conflict', 'current': cur or {'data': {}, 'version': 0, 'updatedAt': 0}})
        DB[ns] = {'data': b['data'], 'version': (cur['version'] if cur else 0) + 1, 'updatedAt': b.get('updatedAt') or 0}
        return J(200, {'ok': True, 'ns': ns, 'version': DB[ns]['version'], 'updatedAt': DB[ns]['updatedAt']})
    return J(404, {'ok': False, 'error': 'not_found', 'message': ''})
META = "localStorage.setItem('birdbird-account', JSON.stringify({uid:'u1',signedIn:true,user:{id:'u1',name:'Pilot'},ns:{},last:0}))"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    errs = []
    def device():
        c = br.new_context(viewport={'width': 1280, 'height': 900}); c.route('**/api/**', api); c.add_init_script(META)
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.goto(URL); pg.wait_for_selector('.ovs'); return pg
    A = device()
    A.wait_for_function("WS.meta.sync.last > 0", timeout=10000)
    check('signed in: status says synced', 'Synced to your account' in A.inner_text('#wsStatus'), A.inner_text('#wsStatus'))
    A.evaluate("document.querySelector('.ovs [data-act=\"ac-new\"]').click()"); A.wait_for_selector('#acForm'); A.select_option('#acTypeKey', 'b200'); A.fill('#acReg', 'LN-KAB'); A.click('#acForm button[type=submit]'); A.wait_for_selector('.achead')
    A.goto(URL + '#/documents'); A.wait_for_selector('.drop')
    with A.expect_file_chooser() as fc: A.click('.drop [data-act="doc-add"]')
    fc.value.set_files('/tmp/wsfix/DA42 NG AFM.pdf'); A.wait_for_selector('#dList .rows>li', timeout=20000)
    A.goto(URL + '#/notes'); A.click('.ws-h [data-act="note-new"]'); A.wait_for_selector('#nBody'); A.fill('#nTitle', 'Shared note'); A.click('#nBody'); A.keyboard.type('Typed on device A.')
    A.wait_for_function("WS.sync.state==='idle' && !!JSON.stringify(WS.state.items) && (()=>{ return true })()", timeout=10000); A.wait_for_timeout(9000)
    body = json.dumps(PUTS)
    check('aircraft, document index and notes were pushed', 'LN-KAB' in body and 'DA42 NG AFM' in body and 'Typed on device A' in body)
    check('no document file or text left the device', '%PDF' not in body and 'crosswind' not in body and 'chunks' not in body)
    check('two namespaces used', set(x['ns'] for x in PUTS) == {'workspace', 'notes'}, set(x['ns'] for x in PUTS))
    B = device(); B.wait_for_function("Object.values(WS.state.items).some(x=>x.kind==='note')", timeout=10000)
    B.goto(URL + '#/documents'); B.wait_for_selector('#dList')
    t = B.inner_text('#wsMain'); check('device B: library structure arrived, file flagged for re-adding', 'DA42 NG AFM' in t and 'File not on this device' in t and 'listed but the file is not on this device' in t, t[:300])
    B.goto(URL + '#/aircraft'); B.wait_for_selector('.acc'); check('device B: aircraft arrived', 'LN-KAB' in B.inner_text('.acgrid'))
    nid = B.evaluate("Object.values(WS.state.items).find(x=>x.kind==='note').id")
    # concurrent edits: both offline-ish (edits before either sync)
    B.goto(URL + '#/notes/' + nid); B.wait_for_selector('#nBody'); A.goto(URL + '#/notes/' + nid); A.wait_for_selector('#nBody')
    A.click('#nBody'); A.keyboard.press('Control+End'); A.keyboard.type(' A again.')
    B.click('#nBody'); B.keyboard.press('Control+End'); B.keyboard.type(' B edit.')
    A.wait_for_timeout(9000); B.evaluate("WS.syncNow(true)"); B.wait_for_timeout(3000); A.evaluate("WS.syncNow(true)"); A.wait_for_timeout(3000)
    na = A.evaluate(f"(()=>{{const n=WS.state.items['{nid}']; return [n.body, n.versions.map(v=>v.body)]}})()")
    nb = B.evaluate(f"(()=>{{const n=WS.state.items['{nid}']; return [n.body, n.versions.map(v=>v.body)]}})()")
    allt = json.dumps(na)
    check('concurrent edit: both texts kept, devices agree', 'A again' in allt and 'B edit' in allt and na[0] == nb[0], {'A': na, 'B': nb})
    # trash on B reaches A as trash (restorable)
    B.goto(URL + '#/notes/' + nid); B.wait_for_selector('#nSide'); B.click('#nSide [data-act="trash"]'); B.wait_for_timeout(8000); A.evaluate("WS.syncNow(true)"); A.wait_for_timeout(2500)
    check('trash syncs as trash, not as deletion', A.evaluate(f"!!WS.state.items['{nid}'].deletedAt && !WS.state.items['{nid}'].gone"))
    check('no page errors', not errs, errs)
    br.close()
f = [n for n, ok in res if not ok]; print(f'\n{len(res)-len(f)}/{len(res)} passed'); sys.exit(1 if f else 0)
