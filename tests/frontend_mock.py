"""Front-end test of accounts with /api/* mocked in Playwright (no backend needed):
    python3 tests/frontend_mock.py [static-server-url]
The site is served from this folder under https://birdbird.eu (so passkeys get a secure origin and the real RP id),
Chrome's virtual authenticator answers navigator.credentials, and a small in-memory backend answers /api/*.
Covers: signup, recovery code, logout, login, sync roundtrip, conflict prompt, delete, NO/EN, 1440 and 390 px,
no page errors, no horizontal overflow, and the no-backend states (404 / no database / plain static server)."""
import base64, json, mimetypes, os, secrets, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGIN = 'https://birdbird.eu'
STATIC = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8902'
SHOTS = '/tmp/acshots'; os.makedirs(SHOTS, exist_ok=True)
b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=').decode()
results = []
def check(name, cond, info=''):
    results.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name + (('  ' + str(info)[:300]) if info and not cond else ''))

class Server:
    """In-memory stand-in for functions/_lib/api.js (same JSON shapes)."""
    def __init__(self, mode='ok'):
        self.mode = mode; self.user = None; self.creds = []; self.code = None; self.data = {}; self.calls = []
    def handle(self, sess, method, path, body):
        self.calls.append((method, path))
        if self.mode == '404': return 404, 'text/html', '<h1>Not found</h1>'
        if self.mode == 'nodb': return 503, 'application/json', json.dumps({'ok': False, 'error': 'no_db', 'message': 'Accounts are not switched on for this site yet.'})
        J = lambda st, o: (st, 'application/json', json.dumps(o))
        signed = sess.get('in') and self.user
        if path == '/api/auth/register/options':
            uid = self.user['id'] if signed else b64u(secrets.token_bytes(16))
            sess['pending'] = uid
            return J(200, {'ok': True, 'mode': 'add' if signed else 'new', 'options': {'challenge': b64u(secrets.token_bytes(32)), 'rp': {'id': 'birdbird.eu', 'name': 'Birdbird'},
                'user': {'id': uid, 'name': 'pilot', 'displayName': (body or {}).get('name') or 'Birdbird pilot'}, 'pubKeyCredParams': [{'type': 'public-key', 'alg': -7}, {'type': 'public-key', 'alg': -257}],
                'timeout': 300000, 'attestation': 'none', 'authenticatorSelection': {'residentKey': 'required', 'requireResidentKey': True, 'userVerification': 'required'},
                'excludeCredentials': [{'type': 'public-key', 'id': c['id']} for c in self.creds] if signed else []}})
        if path == '/api/auth/register/verify':
            cr = body['credential']; assert cr['response']['attestationObject'] and cr['response']['clientDataJSON']
            cd = json.loads(base64.urlsafe_b64decode(cr['response']['clientDataJSON'] + '=='))
            assert cd['type'] == 'webauthn.create' and cd['origin'] == ORIGIN, cd
            created = not signed
            if created:
                self.user = {'id': sess['pending'], 'name': None}; self.code = 'ABCDE-12345-FGHJK-67890'; self.data = {}; self.creds = []
            self.creds.append({'id': cr['id'], 'name': 'Mac · Chrome', 'created': int(time.time() * 1000), 'lastUsed': None, 'synced': True})
            sess['in'] = True
            return J(200, {'ok': True, 'created': created, 'user': self.user, 'credential': {'id': cr['id']}, 'recoveryCode': self.code if created else None})
        if path == '/api/auth/login/options':
            return J(200, {'ok': True, 'options': {'challenge': b64u(secrets.token_bytes(32)), 'rpId': 'birdbird.eu', 'timeout': 300000, 'userVerification': 'required', 'allowCredentials': []}})
        if path == '/api/auth/login/verify':
            cr = body['credential']; assert cr['response']['signature'] and cr['response']['authenticatorData']
            if not any(c['id'] == cr['id'] for c in self.creds): return J(400, {'ok': False, 'error': 'unknown_passkey', 'message': 'This passkey is not linked to a Birdbird account any more.'})
            sess['in'] = True; return J(200, {'ok': True, 'user': self.user})
        if path == '/api/auth/recovery':
            if not self.user or body.get('code', '').upper().replace(' ', '-') != self.code: return J(400, {'ok': False, 'error': 'bad_code', 'message': 'That recovery code does not match an account.'})
            self.code = 'ZZZZZ-99999-YYYYY-88888'; sess['in'] = True
            return J(200, {'ok': True, 'user': self.user, 'recoveryCode': self.code, 'passkeys': len(self.creds)})
        if path == '/api/auth/logout': sess['in'] = False; return J(200, {'ok': True})
        if path == '/api/me' and method == 'GET':
            if not signed: return J(200, {'ok': True, 'user': None})
            return J(200, {'ok': True, 'user': dict(self.user, created=1, signedInWith='passkey'), 'recovery': {'created': int(time.time() * 1000)}, 'credentials': self.creds,
                           'data': [{'ns': k, 'version': v['version'], 'updatedAt': v['updatedAt'], 'bytes': 10} for k, v in self.data.items()]})
        if not signed: return J(401, {'ok': False, 'error': 'signed_out', 'message': 'You are signed out.'})
        if path == '/api/me' and method == 'DELETE':
            self.user = None; self.creds = []; self.data = {}; sess['in'] = False; return J(200, {'ok': True, 'deleted': True})
        if path == '/api/me/recovery': self.code = 'NEWNE-11111-WWWWW-22222'; return J(200, {'ok': True, 'recoveryCode': self.code, 'created': 1})
        if path.startswith('/api/me/credentials'):
            if len(self.creds) < 2: return J(409, {'ok': False, 'error': 'last_passkey', 'message': 'This is your only passkey.'})
            cid = path.split('id=')[1]; self.creds = [c for c in self.creds if c['id'] != cid]; return J(200, {'ok': True})
        if path == '/api/sync' and method == 'GET': return J(200, {'ok': True, 'ns': self.data})
        if path == '/api/sync' and method == 'PUT':
            ns, cur = body['ns'], self.data.get(body['ns'])
            base = body.get('baseVersion') or 0
            if not body.get('force') and (cur['version'] if cur else 0) != base:
                return J(409, {'ok': False, 'error': 'conflict', 'message': 'conflict', 'current': cur or {'data': {}, 'version': 0, 'updatedAt': 0}})
            self.data[ns] = {'data': body['data'], 'version': (cur['version'] if cur else 0) + 1, 'updatedAt': body.get('updatedAt') or 0}
            return J(200, {'ok': True, 'ns': ns, 'version': self.data[ns]['version'], 'updatedAt': self.data[ns]['updatedAt']})
        return J(404, {'ok': False, 'error': 'nf', 'message': path})

def device(b, srv, w, h, auth=True):
    c = b.new_context(viewport={'width': w, 'height': h})
    sess = {}
    def route(r):
        u = r.request.url; path = u[len(ORIGIN):].split('#')[0]
        if path.startswith('/api/'):
            body = None
            if r.request.post_data:
                try: body = json.loads(r.request.post_data)
                except Exception: body = None
            if r.request.method != 'GET': assert r.request.headers.get('origin') == ORIGIN, 'Origin header missing'
            st, ct, txt = srv.handle(sess, r.request.method, path, body)
            return r.fulfill(status=st, content_type=ct, body=txt)
        f = os.path.join(ROOT, (path.split('?')[0].lstrip('/') or 'index.html'))
        if not os.path.isfile(f): return r.fulfill(status=404, body='nf')
        r.fulfill(status=200, content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream', body=open(f, 'rb').read())
    c.route(ORIGIN + '/**', route)
    c.route(lambda u: not u.startswith(ORIGIN) and not u.startswith('data:') and not u.startswith('blob:'), lambda r: r.abort())
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    cdp = None
    if auth:
        cdp = c.new_cdp_session(pg); cdp.send('WebAuthn.enable')
        aid = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}})['authenticatorId']
        cdp.aid = aid
    return c, pg, errs, sess, cdp

overflow = lambda pg: pg.evaluate("document.documentElement.scrollWidth>innerWidth+1")
def both_langs(pg, tag, needle_en, needle_no):
    pg.locator('.langseg button[data-v=no]').first.click(); pg.wait_for_timeout(250)
    no_txt = pg.locator('#account').inner_text()
    check(tag + ': Norwegian', needle_no in no_txt, no_txt[:200])
    check(tag + ': no overflow (NO)', not overflow(pg))
    pg.locator('.langseg button[data-v=en]').first.click(); pg.wait_for_timeout(200)
    check(tag + ': English', needle_en in pg.locator('#account').inner_text())

with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H in ((1440, 900), (390, 844)):
        tag = str(W)
        srv = Server()
        c, pg, errs, sess, cdp = device(b, srv, W, H)
        pg.goto(ORIGIN + '/privacy.html'); pg.evaluate("""()=>{ localStorage.setItem('naeroson-prog',JSON.stringify({'quiz:holding':80})); localStorage.setItem('aeroson-quiz-holding','80');
            localStorage.setItem('naeroson-store-prep',JSON.stringify({p1:{id:'p1',updated:1000,title:'ENGM – ENBR',f:{depapt:'ENGM',destapt:'ENBR'}}})); localStorage.setItem('naeroson-store-route',JSON.stringify({r1:{id:'r1',updated:5,pts:[{t:'rwy',n:'ENGM'}]}})); localStorage.setItem('vlab-lang','en'); }""")
        pg.goto(ORIGIN + '/profile.html#account'); pg.wait_for_selector('#acNew')
        check(tag + ' signed out: create + sign in + recovery', pg.locator('#acNew').is_visible() and pg.locator('#acIn').is_visible() and pg.locator('#acRec').count() == 1)
        check(tag + ' signed out: no overflow', not overflow(pg))
        both_langs(pg, tag + ' signed out', 'Create account with a passkey', 'Lag konto med passnøkkel')
        pg.locator('#account').screenshot(path=f'{SHOTS}/mock_{tag}_signedout.png')
        # focus is visible on the primary button
        pg.focus('#acNew'); pg.keyboard.press('Shift+Tab'); pg.keyboard.press('Tab')
        ow = pg.evaluate("getComputedStyle(document.activeElement).outlineStyle+' '+getComputedStyle(document.activeElement).outlineWidth")
        check(tag + ' visible keyboard focus', 'solid' in ow and not ow.endswith(' 0px'), ow)
        # ---- signup ----
        pg.fill('#acName', 'Daniel'); pg.click('#acNew'); pg.wait_for_selector('#acRc')
        check(tag + ' signup: recovery code shown', pg.locator('#acRc').inner_text() == 'ABCDE-12345-FGHJK-67890')
        check(tag + ' signup: code panel fits', not overflow(pg))
        pg.locator('#account').screenshot(path=f'{SHOTS}/mock_{tag}_code.png')
        pg.check('#acSaved'); pg.click('#acDone'); pg.wait_for_selector('#acOut')
        check(tag + ' signup: local data uploaded (server was empty)', 'quiz:holding' in srv.data.get('progress', {}).get('data', {}).get('naeroson-prog', '') and 'r1' in srv.data.get('routes', {}).get('data', {}).get('naeroson-store-route', ''))
        check(tag + ' header shows signed-in state', pg.locator('.site .mytr, .site nav a.mob[href^="profile.html"]').first.get_attribute('data-acct') in ('on', 'sync'))
        check(tag + ' data note says synced', 'synced to your account' in pg.locator('#dataNote').inner_text())
        both_langs(pg, tag + ' signed in', 'What is synced', 'Hva som synkroniseres')
        check(tag + ' signed in: no overflow', not overflow(pg))
        pg.locator('#account').screenshot(path=f'{SHOTS}/mock_{tag}_signedin.png')
        # ---- sync roundtrip: another device pushes newer progress ----
        srv.data['progress'] = {'data': dict(srv.data['progress']['data'], **{'aeroson-quiz-clouds': '75'}), 'version': srv.data['progress']['version'] + 1, 'updatedAt': int(time.time() * 1000) + 1000}
        pg.click('#acSync'); pg.wait_for_timeout(800)
        check(tag + ' roundtrip: newer server data lands locally', pg.evaluate("localStorage.getItem('aeroson-quiz-clouds')") == '75')
        pg.evaluate("localStorage.setItem('aeroson-quiz-gnss','90')")
        t0 = time.time()
        while time.time() - t0 < 9 and srv.data['progress']['data'].get('aeroson-quiz-gnss') != '90': pg.wait_for_timeout(300)
        check(tag + ' roundtrip: local change pushed (debounced)', srv.data['progress']['data'].get('aeroson-quiz-gnss') == '90', round(time.time() - t0, 1))
        # on another page, data from elsewhere shows a reload toast
        pg.goto(ORIGIN + '/lab.html'); pg.wait_for_load_state('load')
        srv.data['packs'] = {'data': dict(srv.data['packs']['data'], **{'aeroson-fpl': '{"i7":"LNABC"}'}), 'version': srv.data['packs']['version'] + 1, 'updatedAt': int(time.time() * 1000) + 2000}
        pg.evaluate("localStorage.setItem('birdbird-account',JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('birdbird-account')),{last:0})))")
        pg.reload(); pg.wait_for_selector('.bbacct-toast:not([hidden])', timeout=8000)
        check(tag + ' other page: toast offers reload', 'Reload' in pg.locator('.bbacct-toast').inner_text())
        check(tag + ' other page: no overflow with toast', not overflow(pg))
        # ---- logout / login ----
        pg.goto(ORIGIN + '/profile.html#account'); pg.wait_for_selector('#acOut')
        pg.click('#acOut'); pg.wait_for_selector('#acIn')
        check(tag + ' logout: back to signed-out view', pg.locator('#acNew').is_visible())
        check(tag + ' logout: local data kept', pg.evaluate("localStorage.getItem('aeroson-quiz-gnss')") == '90')
        pg.click('#acIn'); pg.wait_for_selector('#acOut')
        check(tag + ' login: no conflict prompt on the same device', pg.locator('dialog.bbacct-dlg[open]').count() == 0)
        # ---- errors say what to do: cancelled passkey ----
        cdp.send('WebAuthn.setUserVerified', {'authenticatorId': cdp.aid, 'isUserVerified': False})
        pg.click('#acOut'); pg.wait_for_selector('#acIn'); pg.click('#acIn'); pg.wait_for_timeout(1500)
        msg = pg.locator('#acMsg').inner_text()
        check(tag + ' failed passkey: message says what to do', ('Try again' in msg or 'try again' in msg), msg)
        cdp.send('WebAuthn.setUserVerified', {'authenticatorId': cdp.aid, 'isUserVerified': True})
        # ---- second device: conflict prompt ----
        c2, p2, errs2, sess2, cdp2 = device(b, srv, W, H)
        for cr in cdp.send('WebAuthn.getCredentials', {'authenticatorId': cdp.aid})['credentials']:
            cdp2.send('WebAuthn.addCredential', {'authenticatorId': cdp2.aid, 'credential': cr})
        p2.goto(ORIGIN + '/privacy.html'); p2.evaluate("localStorage.setItem('naeroson-prog',JSON.stringify({'quiz:holding':20}))")
        p2.goto(ORIGIN + '/profile.html#account'); p2.wait_for_selector('#acIn'); p2.click('#acIn')
        p2.wait_for_selector('dialog.bbacct-dlg[open]')
        check(tag + ' conflict: dialog with keep / use account / combine', p2.locator('dialog.bbacct-dlg [data-c=device]').count() == 1 and p2.locator('dialog.bbacct-dlg [data-c=account]').count() == 1)
        check(tag + ' conflict: no overflow', not overflow(p2))
        p2.screenshot(path=f'{SHOTS}/mock_{tag}_conflict.png')
        p2.click('dialog.bbacct-dlg [data-c=account]'); p2.wait_for_selector('#acOut'); p2.wait_for_timeout(500)
        check(tag + ' conflict: "use account data" replaces local', json.loads(p2.evaluate("localStorage.getItem('naeroson-prog')")).get('quiz:holding') == 80 and p2.evaluate("localStorage.getItem('aeroson-quiz-gnss')") == '90')
        check(tag + ' conflict: account data not overwritten', '"quiz:holding":80' in srv.data['progress']['data']['naeroson-prog'])
        # ---- recovery code sign-in on a third device without passkeys ----
        c3, p3, errs3, sess3, _ = device(b, srv, W, H, auth=False)
        p3.goto(ORIGIN + '/profile.html#account'); p3.wait_for_selector('#acIn')
        p3.locator('#acRec summary').click(); p3.fill('#acCode', 'abcde 12345 fghjk 67890'); p3.click('#acRecGo')
        p3.wait_for_timeout(800)
        check(tag + ' recovery: typo-tolerant input accepted or explained', p3.locator('#acRc').count() == 1 or 'recovery code' in p3.locator('#acMsg').inner_text())
        if p3.locator('#acRc').count():
            check(tag + ' recovery: new code + add-passkey prompt', p3.locator('#acRc').inner_text() == 'ZZZZZ-99999-YYYYY-88888' and p3.locator('#acAdd2').count() == 1)
        p3.locator('#account').screenshot(path=f'{SHOTS}/mock_{tag}_recovery.png')
        # ---- delete ----
        pg.click('#acIn'); pg.wait_for_selector('#acOut')
        pg.click('#acDel'); pg.wait_for_selector('#acDelDlg[open]')
        check(tag + ' delete: dialog explains and fits', 'cannot be undone' in pg.locator('#acDelDlg').inner_text() and not overflow(pg))
        check(tag + ' delete: "also delete everything stored on this device" is on by default', pg.is_checked('#acDelLocal'))
        pg.uncheck('#acDelLocal')
        pg.click('#acDelYes'); pg.wait_for_selector('#acNew')
        check(tag + ' delete: account gone, local data kept when unticked', srv.user is None and pg.evaluate("localStorage.getItem('aeroson-quiz-gnss')") == '90')
        check(tag + ' delete: confirmation message', 'deleted' in pg.locator('#acMsg').inner_text())
        for n, e in (('device 1', errs), ('device 2', errs2), ('device 3', errs3)): check(f'{tag} {n}: no page errors', not e, e[:3])
        for x in (c, c2, c3): x.close()

    # ---------- no backend ----------
    for mode, needle in (('404', 'Accounts are available on birdbird.eu'), ('nodb', 'Accounts are being switched on')):
        srv = Server(mode)
        c, pg, errs, sess, _ = device(b, srv, 390, 844, auth=False)
        pg.goto(ORIGIN + '/profile.html#account'); pg.wait_for_timeout(1500)
        t = pg.locator('#account').inner_text()
        check(f'fallback {mode}: message', needle in t, t[:200])
        check(f'fallback {mode}: page works (rank, path)', pg.locator('#mods .mod').count() > 0)
        check(f'fallback {mode}: no overflow, no errors', not overflow(pg) and not errs, errs)
        pg.locator('#account').screenshot(path=f'{SHOTS}/mock_fallback_{mode}.png')
        c.close()
    # plain static server (no Functions): no /api request at all
    c = b.new_context(viewport={'width': 1440, 'height': 900}); pg = c.new_page(); errs = []; api = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('request', lambda r: api.append(r.url) if '/api/' in r.url and not any(x in r.url for x in ('/api/atc', '/api/wx')) else None)  # atc/wx: other features
    pg.goto(STATIC + '/profile.html#account'); pg.wait_for_timeout(1500)
    check('static server: "available on birdbird.eu"', 'Accounts are available on birdbird.eu' in pg.locator('#account').inner_text())
    check('static server: no /api requests, no errors', not api and not errs, (api, errs))
    for page in ('index.html', 'prep.html', 'lab.html'):
        pg.goto(STATIC + '/' + page); pg.wait_for_timeout(900)
        check(f'static server: {page} loads account.js without errors', pg.evaluate("!!window.BBACCOUNT") and not errs and not api, (errs, api))
    c.close()
    b.close()

bad = [n for n, v in results if not v]
print(f'\n{len(results) - len(bad)}/{len(results)} checks passed' + (' – FAILED: ' + '; '.join(bad) if bad else ''))
sys.exit(1 if bad else 0)
