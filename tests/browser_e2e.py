"""Real end to end in Chromium against a running backend (wrangler pages dev + local D1), with Chrome's
virtual WebAuthn authenticator (a real passkey ceremony, real signatures, real cookies):
    python3 tests/browser_e2e.py http://localhost:8788
Two "devices" (1440 px desktop, 390 px phone) share one passkey, the way iCloud Keychain would sync it."""
import json, sys, time
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8788'
ok = []
def check(name, cond, info=''):
    ok.append((name, bool(cond)))
    print(('ok   ' if cond else 'FAIL ') + name + (('  ' + str(info)) if info and not cond else ''))

def device(b, w, h):
    c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
    pg = c.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    cdp = c.new_cdp_session(pg)
    cdp.send('WebAuthn.enable')
    auth = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}})['authenticatorId']
    return c, pg, errs, cdp, auth

def seed(pg, items):
    pg.goto(BASE + '/privacy.html'); pg.wait_for_load_state('load')
    pg.evaluate("o=>{ for(const k in o) localStorage.setItem(k,o[k]); }", items)

def server(pg):
    return pg.evaluate("fetch('/api/sync').then(r=>r.json())")

def overflow(pg):
    return pg.evaluate("document.documentElement.scrollWidth>innerWidth+1")

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- device A: desktop, signs up ----------
    cA, A, errA, cdpA, authA = device(b, 1440, 900)
    seed(A, {'naeroson-prog': json.dumps({'quiz:holding': 80}), 'aeroson-quiz-holding': '80',
             'naeroson-store-prep': json.dumps({'p1': {'id': 'p1', 'updated': 1000, 'title': 'ENGM – ENBR', 'f': {'depapt': 'ENGM', 'destapt': 'ENBR'}}}),
             'vlab-lang': 'en', 'bb-openaip-key': 'secret-key-must-not-sync'})
    A.goto(BASE + '/profile.html#account'); A.wait_for_selector('#acNew')
    check('A: signed-out view offers create + sign in', A.locator('#acIn').is_visible() and A.locator('#acNew').is_visible())
    A.fill('#acName', 'Daniel'); A.click('#acNew')
    A.wait_for_selector('.acc-code .rc', timeout=15000)
    code = A.locator('#acRc').inner_text().strip()
    check('A: recovery code shown once', len(code) == 23 and code.count('-') == 3, code)
    check('A: Done disabled until saved', A.locator('#acDone').is_disabled())
    A.check('#acSaved'); A.click('#acDone')
    A.wait_for_selector('#acOut')
    check('A: header shows account state', A.locator('.site .mytr').get_attribute('data-acct') in ('on', 'sync'))
    cookies = cA.cookies()
    sc = [x for x in cookies if x['name'] == '__Host-bb_session']
    check('A: session cookie HttpOnly + Secure + Lax', sc and sc[0]['httpOnly'] and sc[0]['secure'] and sc[0]['sameSite'] == 'Lax', sc)
    A.wait_for_timeout(1500)
    s = server(A)
    check('A: progress uploaded at signup', 'quiz:holding' in s['ns'].get('progress', {}).get('data', {}).get('naeroson-prog', ''), s)
    check('A: briefing pack uploaded', 'p1' in s['ns'].get('packs', {}).get('data', {}).get('naeroson-store-prep', ''))
    check('A: API keys are not synced', 'secret-key' not in json.dumps(s))
    # a quiz result on another page syncs by itself (debounced, max every 5 s)
    A.goto(BASE + '/holding.html'); A.wait_for_load_state('load'); A.wait_for_timeout(800)
    A.evaluate("localStorage.setItem('aeroson-quiz-fronts','70')")
    t0 = time.time(); got = False
    while time.time() - t0 < 12:
        A.wait_for_timeout(700)
        if server(A)['ns']['progress']['data'].get('aeroson-quiz-fronts') == '70': got = True; break
    check('A: change on another page reaches the server within ~6 s', got, round(time.time() - t0, 1))
    A.goto(BASE + '/profile.html#account'); A.wait_for_selector('#acOut')
    check('A: passkey listed', A.locator('.acc-keys li').count() == 1)
    A.click('#acOut'); A.wait_for_selector('#acIn')
    check('A: signed out', A.evaluate("fetch('/api/me').then(r=>r.json()).then(j=>j.user)") is None)

    # ---------- device B: phone, same synced passkey, its own data -> conflict prompt ----------
    cB, Bp, errB, cdpB, authB = device(b, 390, 844)
    for cr in cdpA.send('WebAuthn.getCredentials', {'authenticatorId': authA})['credentials']:
        cdpB.send('WebAuthn.addCredential', {'authenticatorId': authB, 'credential': cr})
    seed(Bp, {'naeroson-prog': json.dumps({'quiz:holding': 95, 'quiz:clouds': 60}), 'aeroson-quiz-holding': '95',
              'naeroson-store-prep': json.dumps({'p2': {'id': 'p2', 'updated': 2000, 'title': 'ENZV – ENGM', 'f': {}}})})
    Bp.goto(BASE + '/profile.html#account'); Bp.wait_for_selector('#acIn')
    check('B: no overflow at 390 (signed out)', not overflow(Bp))
    Bp.click('#acIn')
    Bp.wait_for_selector('dialog.bbacct-dlg[open]', timeout=15000)
    check('B: first sign-in asks what to do with this device’s data', Bp.locator('dialog.bbacct-dlg [data-c]').count() == 3)
    check('B: no overflow with the dialog open', not overflow(Bp))
    Bp.click('dialog.bbacct-dlg [data-c=combine]')
    Bp.wait_for_selector('#acOut', timeout=15000); Bp.wait_for_timeout(1200)
    prog = json.loads(Bp.evaluate("localStorage.getItem('naeroson-prog')"))
    packs = json.loads(Bp.evaluate("localStorage.getItem('naeroson-store-prep')"))
    check('B: combine keeps best scores', prog.get('quiz:holding') == 95 and prog.get('quiz:clouds') == 60, prog)
    check('B: combine brings A’s quiz', Bp.evaluate("localStorage.getItem('aeroson-quiz-fronts')") == '70')
    check('B: combine keeps both packs', 'p1' in packs and 'p2' in packs, list(packs))
    s = server(Bp)
    check('B: server has the combined data', 'p2' in s['ns']['packs']['data']['naeroson-store-prep'] and 'quiz:clouds' in s['ns']['progress']['data']['naeroson-prog'])
    check('B: planning list shows both packs', Bp.locator('#packs .pi').count() == 2, Bp.locator('#packs').inner_text()[:200])
    check('B: no overflow at 390 (signed in)', not overflow(Bp))
    Bp.locator('.langseg button[data-v=no]').first.click(); Bp.wait_for_timeout(300)
    check('B: Norwegian account section', 'Logg ut' in Bp.locator('#account').inner_text() and 'Hva som synkroniseres' in Bp.locator('#account').inner_text())
    Bp.screenshot(path='/tmp/acshots/e2e_B_390_no.png', full_page=False)
    Bp.locator('#account').screenshot(path='/tmp/acshots/e2e_B_390_account.png')
    Bp.locator('.langseg button[data-v=en]').first.click(); Bp.wait_for_timeout(200)

    # ---------- device C: no passkey, signs in with the recovery code ----------
    cC = b.new_context(viewport={'width': 390, 'height': 844}); C = cC.new_page(); errC = []
    C.on('pageerror', lambda e: errC.append(str(e)[:200]))
    C.goto(BASE + '/profile.html#account'); C.wait_for_selector('#acIn')
    C.locator('#acRec summary').click()
    C.fill('#acCode', code.lower().replace('-', ' '))
    C.click('#acRecGo')
    C.wait_for_selector('.acc-code .rc', timeout=15000)
    code2 = C.locator('#acRc').inner_text().strip()
    check('C: recovery sign-in shows a new code', code2 != code and len(code2) == 23)
    check('C: suggests adding a passkey on this device', C.locator('#acAdd2').count() == 1)
    C.check('#acSaved'); C.click('#acDone')
    check('C: data arrived via recovery sign-in', C.evaluate("localStorage.getItem('aeroson-quiz-fronts')") == '70')
    old = C.evaluate("c=>fetch('/api/auth/recovery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:c})}).then(r=>r.json())", code)
    check('C: the used code no longer works', old.get('error') == 'bad_code', old)
    C.locator('#account').screenshot(path='/tmp/acshots/e2e_C_390_signedin.png')
    # clearing this browser on the privacy page signs out first and leaves the account's copy alone
    C.goto(BASE + '/privacy.html#clear'); C.wait_for_selector('#clr'); C.wait_for_timeout(500)
    C.click('#clr'); C.click('#clr'); C.wait_for_function("document.getElementById('res').textContent.length>0", timeout=10000)
    check('C: privacy clear signs out', C.evaluate("fetch('/api/me').then(r=>r.json()).then(j=>j.user)") is None and 'signed out' in C.locator('#res').inner_text())
    check('C: privacy clear empties this browser', C.evaluate("localStorage.getItem('aeroson-quiz-fronts')") is None)

    # ---------- back on A: sign in again, gets the combined data without a prompt ----------
    # Chrome's virtual authenticators count signatures (real synced passkeys send 0): copy B's state back, as a sync would
    for cr in cdpB.send('WebAuthn.getCredentials', {'authenticatorId': authB})['credentials']:
        cdpA.send('WebAuthn.removeCredential', {'authenticatorId': authA, 'credentialId': cr['credentialId']})
        cdpA.send('WebAuthn.addCredential', {'authenticatorId': authA, 'credential': cr})
    A.click('#acIn')
    try: A.wait_for_selector('#acOut', timeout=15000)
    except Exception: print('A sign-in message:', A.locator('#acMsg').inner_text())
    A.wait_for_timeout(1200)
    check('A: no prompt on a known device', A.locator('dialog.bbacct-dlg[open]').count() == 0)
    check('A: pulled B’s data', 'quiz:clouds' in A.evaluate("localStorage.getItem('naeroson-prog')"))
    A.locator('#account').screenshot(path='/tmp/acshots/e2e_A_1440_signedin.png')
    check('A: no overflow at 1440', not overflow(A))
    # add + remove a passkey: second virtual authenticator on A
    cdpA.send('WebAuthn.removeVirtualAuthenticator', {'authenticatorId': authA})
    authA2 = cdpA.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}})['authenticatorId']
    A.click('#acAdd'); A.wait_for_function("document.querySelectorAll('.acc-keys li').length===2", timeout=15000)
    check('A: second passkey added', A.locator('.acc-keys li').count() == 2)
    rm = A.locator('[data-rm]').first
    rm.click(); A.locator('[data-rm]').first.click()
    A.wait_for_function("document.querySelectorAll('.acc-keys li').length===1", timeout=15000)
    check('A: passkey removed (two clicks)', A.locator('.acc-keys li').count() == 1)

    # ---------- delete the account from A ----------
    A.click('#acDel'); A.wait_for_selector('#acDelDlg[open]')
    A.check('#acDelLocal'); A.click('#acDelYes')
    A.wait_for_selector('#acNew', timeout=15000)
    me = A.evaluate("fetch('/api/me').then(r=>r.json())")
    check('A: account deleted, signed out', me.get('user') is None)
    check('A: local data wiped when asked', A.evaluate("localStorage.getItem('naeroson-prog')") is None and A.evaluate("localStorage.getItem('bb-openaip-key')") == 'secret-key-must-not-sync')
    s = Bp.evaluate("fetch('/api/sync').then(r=>r.status)")
    check('B: session gone after account deletion', s == 401, s)

    for n, e in (('A', errA), ('B', errB), ('C', errC)):
        check(n + ': no page errors', not e, e[:3])
    b.close()

bad = [n for n, v in ok if not v]
print(f'\n{len(ok) - len(bad)}/{len(ok)} checks passed' + (' – FAILED: ' + ', '.join(bad) if bad else ''))
sys.exit(1 if bad else 0)
