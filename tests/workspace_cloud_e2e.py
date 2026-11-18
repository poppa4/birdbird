"""My Workspace with cloud storage for document files switched on (/api/files mocked in memory, /api/sync as in
workspace_sync_e2e.py). python3 tests/workspace_cloud_e2e.py [base-url]
Device A adds a PDF: the file is uploaded once, privately. Device B, same account, gets the file back by itself and can
open it. Deleting the document for good removes the cloud copy; putting it in the trash does not."""
import json, sys, time
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:9200'
URL = BASE + '/workspace.html'
DB = {}; FILES = {}; LOG = []
res = []
def check(n, c, i=''):
    res.append((n, bool(c))); print(('ok   ' if c else 'FAIL ') + n + (('  ' + str(i)[:300]) if i and not c else ''))
def api(route):
    req = route.request; path = req.url.split('/api', 1)[1].split('?')[0]
    J = lambda st, o: route.fulfill(status=st, content_type='application/json', body=json.dumps(o))
    if path == '/me': return J(200, {'ok': True, 'user': {'id': 'u1', 'name': 'Pilot'}, 'credentials': [], 'data': []})
    if path == '/sync' and req.method == 'GET': return J(200, {'ok': True, 'ns': DB, 'serverTime': int(time.time() * 1000)})
    if path == '/sync' and req.method == 'PUT':
        b = json.loads(req.post_data); ns = b['ns']; cur = DB.get(ns); base = b.get('baseVersion') or 0
        if (cur and base != cur['version']) or (not cur and base != 0): return J(409, {'ok': False, 'error': 'conflict', 'current': cur or {'data': {}, 'version': 0, 'updatedAt': 0}})
        DB[ns] = {'data': b['data'], 'version': (cur['version'] if cur else 0) + 1, 'updatedAt': b.get('updatedAt') or 0}
        return J(200, {'ok': True, 'ns': ns, 'version': DB[ns]['version'], 'updatedAt': DB[ns]['updatedAt']})
    if path == '/files' and req.method == 'GET':
        return J(200, {'ok': True, 'enabled': True, 'used': sum(len(f['b']) for f in FILES.values()), 'quota': 500 << 20, 'maxFile': 60 << 20,
                       'files': [{'id': k, 'size': len(f['b']), 'name': f['name'], 'type': f['type'], 'uploaded': 0} for k, f in FILES.items()]})
    if path.startswith('/files/'):
        fid = path[len('/files/'):]; LOG.append((req.method, fid))
        if req.method == 'PUT':
            from urllib.parse import unquote
            FILES[fid] = {'b': req.post_data_buffer, 'name': unquote(req.headers.get('x-file-name', '')), 'type': req.headers.get('content-type', '')}
            return J(200, {'ok': True, 'id': fid, 'size': len(FILES[fid]['b']), 'used': 0})
        if req.method == 'GET':
            f = FILES.get(fid)
            if not f: return J(404, {'ok': False, 'error': 'not_found'})
            from urllib.parse import quote
            return route.fulfill(status=200, body=f['b'], headers={'content-type': f['type'] or 'application/octet-stream', 'x-file-name': quote(f['name'])})
        if req.method == 'DELETE': FILES.pop(fid, None); return J(200, {'ok': True})
    return J(404, {'ok': False, 'error': 'not_found', 'message': ''})
META = "localStorage.setItem('birdbird-account', JSON.stringify({uid:'u1',signedIn:true,user:{id:'u1',name:'Pilot'},ns:{},last:0}))"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    errs = []
    def device():
        c = br.new_context(viewport={'width': 1280, 'height': 900}); c.route('**/api/**', api); c.add_init_script(META)
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.goto(URL + '#/library'); pg.wait_for_selector('.ovs'); return pg
    A = device(); A.wait_for_function("WS.meta.sync.last > 0", timeout=10000)
    A.goto(URL + '#/documents'); A.wait_for_selector('.drop')
    with A.expect_file_chooser() as fc: A.click('.drop [data-act="doc-add"]')
    fc.value.set_files('/tmp/wsfix/DA42 NG AFM.pdf'); A.wait_for_selector('#dList .rows>li', timeout=20000); A.wait_for_timeout(2500)
    did = A.evaluate("Object.values(WS.state.items).find(x=>x.kind==='doc').id")
    check('device A: the PDF was uploaded once to the cloud', did in FILES and FILES[did]['b'][:4] == b'%PDF' and [m for m, i in LOG if i == did].count('PUT') == 1, LOG)
    check('device A: the cloud copy keeps the file name', FILES.get(did, {}).get('name') == 'DA42 NG AFM.pdf', FILES.get(did, {}).get('name'))
    A.wait_for_timeout(8000); A.evaluate("WS.syncNow(true)"); A.wait_for_timeout(2500)
    B = device(); B.wait_for_function(f"!!WS.state.items['{did}']", timeout=15000)
    B.wait_for_function(f"!!WS.state.docs['{did}']", timeout=20000)
    check('device B: the file came back from the cloud by itself', ('GET', did) in LOG)
    B.goto(URL + '#/documents/' + did); B.wait_for_selector('.keptbox')
    kb = B.inner_text('.keptbox'); check('device B: the document is on the device, with a cloud copy', 'Kept on this device' in kb and 'cloud' in kb, kb)
    # trash keeps the cloud copy; delete for good removes it
    B.click(f'[data-act="trash"][data-id="{did}"]'); B.wait_for_timeout(1500)
    check('trash keeps the cloud copy (it can still be restored)', did in FILES and ('DELETE', did) not in LOG)
    B.goto(URL + '#/trash'); B.wait_for_selector(f'[data-act="purge"][data-id="{did}"]'); B.click(f'[data-act="purge"][data-id="{did}"]')
    B.click('#wsDlgOk'); B.wait_for_timeout(2000)
    check('delete for good removes the cloud copy', did not in FILES and ('DELETE', did) in LOG, LOG)
    check('no page errors', not errs, errs)
    br.close()
f = [n for n, ok in res if not ok]; print(f'\n{len(res)-len(f)}/{len(res)} passed'); sys.exit(1 if f else 0)
