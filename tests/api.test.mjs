/* Unit tests for the account Functions: node --test tests/
   Real WebAuthn bytes from a software authenticator (WebCrypto ES256/RS256), D1 mocked on node:sqlite. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeD1 } from './lib/d1mock.mjs';
import { SoftAuthenticator, b64u } from './lib/softauthn.mjs';
import { endpoint, handlers as H, rpFor, COOKIE, normaliseRecovery, _test as T } from '../functions/_lib/api.js';
import { createHash, createHmac } from 'node:crypto';
import { cborDecode, derToRaw, parseAuthData } from '../functions/_lib/webauthn.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://birdbird.eu';
const ROUTES = {
  '/api/auth/register/options': { POST: H.registerOptions }, '/api/auth/register/verify': { POST: H.registerVerify },
  '/api/auth/login/options': { POST: H.loginOptions }, '/api/auth/login/verify': { POST: H.loginVerify },
  '/api/auth/recovery': { POST: H.recovery }, '/api/auth/logout': { POST: H.logout },
  '/api/me': { GET: H.meGet, PATCH: H.mePatch, DELETE: H.meDelete }, '/api/me/export': { GET: H.meExport }, '/api/me/recovery': { POST: H.newRecovery },
  '/api/me/credentials': { DELETE: H.credDelete }, '/api/sync': { GET: H.syncGet, PUT: H.syncPut }
};

function world(opts) {
  opts = opts || {};
  const clock = { t: Date.UTC(2026, 10, 8, 12, 0, 0) };
  const env = Object.assign(opts.noDb ? {} : { DB: makeD1(join(ROOT, 'migrations')) }, opts.env || {});
  const deps = { now: () => clock.t, random: () => 0.99 };
  /* a browser: cookie jar + fetch-like call into the Functions */
  function browser(origin, ip) {
    origin = origin || ORIGIN;
    const jar = {};
    async function call(method, path, body, o) {
      o = o || {};
      const url = new URL(path, origin);
      const h = new Headers({ 'user-agent': o.ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', 'cf-connecting-ip': ip || '203.0.113.7' });
      if (o.origin !== null && method !== 'GET') h.set('origin', o.origin || origin);
      if (body !== undefined) h.set('content-type', o.ct || 'application/json');
      const ck = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.set('cookie', ck);
      const req = new Request(url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
      const fn = endpoint(ROUTES[url.pathname], deps);
      const res = await fn({ request: req, env, waitUntil: () => {} });
      const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const line of sc) { const [kv] = line.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0/.test(line) || !v) delete jar[k]; else jar[k] = v; }
      const j = await res.json();
      return { status: res.status, body: j, setCookie: sc, headers: res.headers };
    }
    return { jar, call, origin };
  }
  return { clock, env, db: env.DB, browser };
}

async function signup(w, br, auth, name) {
  const o = await br.call('POST', '/api/auth/register/options', { name });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const cred = await auth.create(o.body.options, br.origin);
  const v = await br.call('POST', '/api/auth/register/verify', { credential: cred });
  return { o, v, cred };
}
async function login(br, auth, tweak) {
  const o = await br.call('POST', '/api/auth/login/options', {});
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const cred = await auth.get(o.body.options, br.origin, tweak);
  const v = await br.call('POST', '/api/auth/login/verify', { credential: cred });
  return { o, v, cred };
}

test('signup with an ES256 passkey: session cookie, recovery code, account shows the passkey', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  const { o, v } = await signup(w, br, a, 'Daniel');
  const op = o.body.options;
  assert.equal(op.rp.id, 'birdbird.eu');
  assert.equal(op.attestation, 'none');
  assert.equal(op.authenticatorSelection.residentKey, 'required');
  assert.deepEqual(op.pubKeyCredParams.map(x => x.alg), [-7, -257]);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal(v.body.created, true);
  assert.match(v.body.recoveryCode, /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
  const line = v.setCookie.find(x => x.startsWith(COOKIE + '='));
  assert.ok(line, 'session cookie set');
  for (const f of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=5184000']) assert.ok(line.includes(f), f + ' in ' + line);
  assert.ok(!/Domain=/i.test(line), '__Host- cookie has no Domain');
  const me = await br.call('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'Daniel');
  assert.equal(me.body.credentials.length, 1);
  assert.equal(me.body.credentials[0].name, 'iPhone · Safari');
  assert.equal(me.body.credentials[0].synced, true);
  assert.ok(me.body.recovery.created);
});

test('only hashes are stored: no session id or recovery code in the database', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  const { v } = await signup(w, br, a);
  const tok = br.jar[COOKIE], code = v.body.recoveryCode;
  const dump = JSON.stringify(['users', 'sessions', 'credentials', 'challenges', 'rate_limits', 'user_data'].map(t => w.db.raw.prepare('SELECT * FROM ' + t).all()));
  assert.ok(!dump.includes(tok), 'session token not stored');
  assert.ok(!dump.includes(code) && !dump.includes(normaliseRecovery(code)), 'recovery code not stored');
  assert.ok(!dump.includes('203.0.113.7'), 'raw IP not stored');
  const cr = w.db.raw.prepare('SELECT public_key, alg FROM credentials').get();
  const jwk = JSON.parse(cr.public_key);
  assert.equal(jwk.kty, 'EC'); assert.equal(jwk.d, undefined, 'no private key');
});

test('logout deletes the session; passkey sign-in makes a new one and rotates the id', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a);
  const first = br.jar[COOKIE];
  const lo = await br.call('POST', '/api/auth/logout', {});
  assert.equal(lo.status, 200);
  assert.ok(lo.setCookie[0].includes('Max-Age=0'));
  assert.equal(w.db.raw.prepare('SELECT COUNT(*) n FROM sessions').get().n, 0);
  assert.equal((await br.call('GET', '/api/me')).body.user, null);
  const { v } = await login(br, a);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.notEqual(br.jar[COOKIE], first);
  assert.equal((await br.call('GET', '/api/me')).status, 200);
  // signing in again while signed in replaces the session instead of adding one
  const before = br.jar[COOKIE];
  await login(br, a);
  assert.notEqual(br.jar[COOKIE], before);
  assert.equal(w.db.raw.prepare('SELECT COUNT(*) n FROM sessions').get().n, 1);
});

test('RS256 passkeys register and sign in', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator({ alg: -257 });
  const { v } = await signup(w, br, a);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  await br.call('POST', '/api/auth/logout', {});
  const l = await login(br, a);
  assert.equal(l.v.status, 200, JSON.stringify(l.v.body));
});

test('assertions are rejected when anything is off', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a);
  await br.call('POST', '/api/auth/logout', {});
  const cases = [
    [{ origin: 'https://evil.example' }, 'bad_origin'],
    [{ rpId: 'evil.example' }, 'bad_rpid'],
    [{ corruptSig: true }, 'bad_signature'],
    [{ flags: 0x01 }, 'no_verification'],
    [{ flags: 0x04 }, 'no_presence'],
    [{ type: 'webauthn.create' }, 'bad_client_data'],
    [{ userHandle: b64u(new Uint8Array(16)) }, 'unknown_passkey']
  ];
  for (const [tw, code] of cases) {
    const { v } = await login(br, a, tw);
    assert.equal(v.status, 400, code);
    assert.equal(v.body.error, code, JSON.stringify(v.body));
    assert.ok(v.body.message.length > 10);
    assert.equal(br.jar[COOKIE], undefined);
  }
});

test('challenges are single use, expire after 5 minutes, and cannot cross ceremonies', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a);
  await br.call('POST', '/api/auth/logout', {});
  const o = await br.call('POST', '/api/auth/login/options', {});
  const cred = await a.get(o.body.options, ORIGIN);
  assert.equal((await br.call('POST', '/api/auth/login/verify', { credential: cred })).status, 200);
  await br.call('POST', '/api/auth/logout', {});
  const replay = await br.call('POST', '/api/auth/login/verify', { credential: cred });
  assert.equal(replay.body.error, 'expired');
  const o2 = await br.call('POST', '/api/auth/login/options', {});
  w.clock.t += 5 * 60e3 + 1;
  const late = await br.call('POST', '/api/auth/login/verify', { credential: await a.get(o2.body.options, ORIGIN) });
  assert.equal(late.body.error, 'expired');
  // a registration challenge cannot be used to sign in
  const ro = await br.call('POST', '/api/auth/register/options', {});
  const cross = await br.call('POST', '/api/auth/login/verify', { credential: await a.get({ rpId: 'birdbird.eu', challenge: ro.body.options.challenge }, ORIGIN) });
  assert.equal(cross.body.error, 'expired');
});

test('registration is rejected for a wrong origin, rp id or missing user verification', async () => {
  const w = world(), br = w.browser();
  for (const [tw, code, auth] of [[{ origin: 'https://birdbird.eu.evil.example' }, 'bad_origin'], [{ rpId: 'example.com' }, 'bad_rpid'], [{}, 'no_verification', new SoftAuthenticator({ uv: false })]]) {
    const a = auth || new SoftAuthenticator();
    const o = await br.call('POST', '/api/auth/register/options', {});
    const v = await br.call('POST', '/api/auth/register/verify', { credential: await a.create(o.body.options, ORIGIN, tw) });
    assert.equal(v.body.error, code, JSON.stringify(v.body));
  }
  assert.equal(w.db.raw.prepare('SELECT COUNT(*) n FROM users').get().n, 0);
});

test('a counting authenticator whose counter goes backwards is refused', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator({ counting: true, synced: false });
  await signup(w, br, a);
  assert.equal((await login(br, a)).v.status, 200); // count 1
  assert.equal((await login(br, a)).v.status, 200); // count 2
  const back = await login(br, a, { count: 1 });
  assert.equal(back.v.body.error, 'counter');
});

test('CSRF: state-changing requests need our Origin and a JSON body', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a);
  assert.equal((await br.call('PUT', '/api/sync', { ns: 'progress', data: {} }, { origin: null })).status, 403);
  assert.equal((await br.call('PUT', '/api/sync', { ns: 'progress', data: {} }, { origin: 'https://evil.example' })).body.error, 'bad_origin');
  assert.equal((await br.call('DELETE', '/api/me', { confirm: 'delete' }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await br.call('POST', '/api/auth/logout', 'a=1', { ct: 'application/x-www-form-urlencoded' })).status, 415);
  assert.equal((await br.call('GET', '/api/me')).status, 200, 'still signed in');
});

test('recovery code signs in once, is replaced, and normalises typing', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  const { v } = await signup(w, br, a, 'Kari');
  const code = v.body.recoveryCode;
  await br.call('POST', '/api/auth/logout', {});
  const phone = w.browser(ORIGIN, '198.51.100.2');
  const typed = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
  const r = await phone.call('POST', '/api/auth/recovery', { code: typed });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.name, 'Kari');
  assert.equal(r.body.passkeys, 1);
  assert.notEqual(r.body.recoveryCode, code);
  assert.equal((await phone.call('GET', '/api/me')).body.user.signedInWith, 'recovery');
  const again = await w.browser(ORIGIN, '198.51.100.3').call('POST', '/api/auth/recovery', { code });
  assert.equal(again.body.error, 'bad_code');
  assert.equal((await w.browser(ORIGIN, '198.51.100.4').call('POST', '/api/auth/recovery', { code: 'short' })).body.error, 'bad_code');
  // after recovery, add a passkey on the new device
  const b = new SoftAuthenticator();
  const o = await phone.call('POST', '/api/auth/register/options', {});
  assert.equal(o.body.mode, 'add');
  assert.equal(o.body.options.excludeCredentials.length, 1);
  const add = await phone.call('POST', '/api/auth/register/verify', { credential: await b.create(o.body.options, ORIGIN) });
  assert.equal(add.status, 200, JSON.stringify(add.body));
  assert.equal(add.body.created, false);
  assert.equal(add.body.recoveryCode, null);
  // and a new recovery code on request
  const nr = await phone.call('POST', '/api/me/recovery', {});
  const old = r.body.recoveryCode;
  assert.notEqual(nr.body.recoveryCode, old);
  assert.equal((await w.browser(ORIGIN, '198.51.100.5').call('POST', '/api/auth/recovery', { code: old })).body.error, 'bad_code');
});

test('recovery attempts are rate limited per IP', async () => {
  const w = world(), br = w.browser(ORIGIN, '192.0.2.50');
  let last;
  for (let i = 0; i < 7; i++) last = await br.call('POST', '/api/auth/recovery', { code: 'AAAAA-BBBBB-CCCCC-DDDDD' });
  assert.equal(last.status, 429);
  assert.equal(last.body.error, 'rate_limited');
  assert.match(last.body.message, /Wait \d+ minutes/);
  assert.ok(+last.headers.get('retry-after') > 0);
  w.clock.t += 15 * 60e3 + 1;
  assert.equal((await br.call('POST', '/api/auth/recovery', { code: 'AAAAA-BBBBB-CCCCC-DDDDD' })).body.error, 'bad_code');
});

test('passkey list: add, remove, but never the last one', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator(), b = new SoftAuthenticator();
  const { cred } = await signup(w, br, a);
  const lastTry = await br.call('DELETE', '/api/me/credentials?id=' + cred.id, {});
  assert.equal(lastTry.body.error, 'last_passkey');
  const o = await br.call('POST', '/api/auth/register/options', {});
  // the same authenticator again is excluded by the browser; the server refuses a duplicate id as well
  const dup = await br.call('POST', '/api/auth/register/verify', { credential: await b.create(o.body.options, ORIGIN) });
  assert.equal(dup.status, 200);
  assert.equal((await br.call('GET', '/api/me')).body.credentials.length, 2);
  assert.equal((await br.call('DELETE', '/api/me/credentials?id=nope', {})).status, 404);
  assert.equal((await br.call('DELETE', '/api/me/credentials?id=' + cred.id, {})).status, 200);
  assert.equal((await br.call('GET', '/api/me')).body.credentials.length, 1);
  // the removed passkey can no longer sign in
  await br.call('POST', '/api/auth/logout', {});
  assert.equal((await login(br, a)).v.body.error, 'unknown_passkey');
  assert.equal((await login(br, b, { credId: [...b.creds.keys()][0] })).v.status, 200);
});

test('sync: versions, conflict, force, validation, isolation between users', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a);
  assert.deepEqual((await br.call('GET', '/api/sync')).body.ns, {});
  const p1 = await br.call('PUT', '/api/sync', { ns: 'progress', data: { 'naeroson-prog': '{"quiz:holding":80}' }, baseVersion: 0, updatedAt: w.clock.t });
  assert.equal(p1.status, 200); assert.equal(p1.body.version, 1);
  const p2 = await br.call('PUT', '/api/sync', { ns: 'progress', data: { 'naeroson-prog': '{"quiz:holding":90}' }, baseVersion: 1, updatedAt: w.clock.t + 1 });
  assert.equal(p2.body.version, 2);
  const stale = await br.call('PUT', '/api/sync', { ns: 'progress', data: { x: '1' }, baseVersion: 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.current.version, 2);
  assert.equal(stale.body.current.data['naeroson-prog'], '{"quiz:holding":90}');
  const dup0 = await br.call('PUT', '/api/sync', { ns: 'progress', data: { x: '1' }, baseVersion: 0 });
  assert.equal(dup0.status, 409, 'base 0 does not overwrite existing data');
  const f = await br.call('PUT', '/api/sync', { ns: 'progress', data: { x: '2' }, baseVersion: 1, force: true, updatedAt: w.clock.t + 9e9 });
  assert.equal(f.body.version, 3);
  assert.ok(f.body.updatedAt <= w.clock.t + 5 * 60e3, 'future timestamps are clamped');
  assert.equal((await br.call('PUT', '/api/sync', { ns: 'secrets', data: {} })).body.error, 'bad_ns');
  assert.equal((await br.call('PUT', '/api/sync', { ns: 'packs', data: [] })).status, 400);
  const big = await br.call('PUT', '/api/sync', { ns: 'packs', data: { k: 'x'.repeat(1500001) } });
  assert.equal(big.status, 413);
  const all = (await br.call('GET', '/api/sync')).body.ns;
  assert.deepEqual(Object.keys(all), ['progress']);
  assert.deepEqual(all.progress.data, { x: '2' });
  // another user sees nothing of it
  const br2 = w.browser(ORIGIN, '198.51.100.9');
  await signup(w, br2, new SoftAuthenticator());
  assert.deepEqual((await br2.call('GET', '/api/sync')).body.ns, {});
  assert.equal((await w.browser().call('GET', '/api/sync')).status, 401);
});

test('delete account removes the user and all their rows, and nothing of other users', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a);
  await br.call('PUT', '/api/sync', { ns: 'packs', data: { a: '1' }, baseVersion: 0 });
  const other = w.browser(ORIGIN, '198.51.100.20');
  await signup(w, other, new SoftAuthenticator());
  await other.call('PUT', '/api/sync', { ns: 'packs', data: { b: '1' }, baseVersion: 0 });
  assert.equal((await br.call('DELETE', '/api/me', {})).body.error, 'confirm');
  const d = await br.call('DELETE', '/api/me', { confirm: 'delete' });
  assert.equal(d.status, 200);
  assert.ok(d.setCookie[0].includes('Max-Age=0'));
  const n = t => w.db.raw.prepare('SELECT COUNT(*) n FROM ' + t).get().n;
  assert.equal(n('users'), 1); assert.equal(n('credentials'), 1); assert.equal(n('sessions'), 1); assert.equal(n('user_data'), 1);
  assert.equal((await br.call('GET', '/api/me')).body.user, null);
  assert.equal((await login(br, a)).v.body.error, 'unknown_passkey');
  assert.equal((await other.call('GET', '/api/sync')).body.ns.packs.data.b, '1');
});

test('sessions expire after 60 days and slide when used', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a);
  w.clock.t += 2 * 864e5;
  const me = await br.call('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.ok(me.setCookie.some(x => x.startsWith(COOKIE + '=') && x.includes('Max-Age=5184000')), 'renewed');
  w.clock.t += 59 * 864e5;
  assert.equal((await br.call('GET', '/api/me')).status, 200, 'still valid thanks to the renewal');
  w.clock.t += 61 * 864e5;
  assert.equal((await br.call('GET', '/api/me')).body.user, null);
});

test('no D1 binding: 503 no_db with a clear message; wrong method: 405', async () => {
  const w = world({ noDb: true }), br = w.browser();
  const r = await br.call('GET', '/api/sync');
  assert.equal(r.status, 503); assert.equal(r.body.error, 'no_db');
  const w2 = world(), br2 = w2.browser();
  const m = await br2.call('GET', '/api/auth/logout');
  assert.equal(m.status, 405);
});

test('relying party id per host', () => {
  const rp = u => rpFor(new URL(u), {});
  assert.equal(rp('https://birdbird.eu/x').rpId, 'birdbird.eu');
  assert.equal(rp('https://www.birdbird.eu/x').rpId, 'birdbird.eu');
  assert.equal(rp('https://www.birdbird.eu/x').origin, 'https://www.birdbird.eu');
  assert.equal(rp('https://3f2a1b.birdbird.pages.dev/').rpId, '3f2a1b.birdbird.pages.dev');
  assert.equal(rp('http://localhost:8788/').rpId, 'localhost');
  assert.throws(() => rp('http://birdbird.eu/'), /secure/);
  assert.throws(() => rp('https://127.0.0.1:8788/'), /IP address/);
  assert.throws(() => rp('http://127.0.0.1:8788/'), /secure/);
  assert.equal(rpFor(new URL('https://train.example.no/'), { RP_ID: 'example.no' }).rpId, 'example.no');
});

test('webauthn helpers: CBOR, DER and authenticator data edge cases', async () => {
  assert.throws(() => cborDecode(new Uint8Array([0x5f])), /Indefinite/);
  assert.throws(() => cborDecode(new Uint8Array([0x58, 10, 1])), /cut short/);
  assert.throws(() => derToRaw(new Uint8Array([0x31, 0])), /DER/);
  assert.throws(() => parseAuthData(new Uint8Array(10)), /too short/);
  const der = new Uint8Array([0x30, 8, 2, 2, 0, 0x80, 2, 2, 0x01, 0x02]);
  const raw = derToRaw(der);
  assert.equal(raw.length, 64); assert.equal(raw[31], 0x80); assert.equal(raw[63], 0x02);
});

/* ---------- privacy hardening: keyed IP hash, scheduled cleanup, no AAGUID, export ---------- */
const rlRows = w => w.db.raw.prepare('SELECT key FROM rate_limits ORDER BY key').all().map(r => r.key);
const fakeC = (w, env, t) => ({ db: w.db, env: env || {}, now: t || w.clock.t });

test('rate-limit keys: HMAC with RL_SECRET, not a plain SHA-256 of the IP', async () => {
  const w = world({ env: { RL_SECRET: 'test-secret-1' } }), ip = '192.0.2.77';
  await w.browser(ORIGIN, ip).call('POST', '/api/auth/recovery', { code: 'AAAAA-BBBBB-CCCCC-DDDDD' });
  const plain = 'recovery:' + createHash('sha256').update('recovery|' + ip).digest('hex').slice(0, 32);
  const want = 'recovery:' + createHmac('sha256', Buffer.from('bb-rl:test-secret-1')).update('recovery|' + ip).digest('hex').slice(0, 32);
  assert.deepEqual(rlRows(w), [want]);
  assert.ok(!rlRows(w).includes(plain), 'old unsalted form is gone');
  assert.equal(want.length, 'recovery:'.length + 32, 'keys stay short');
  // another secret gives another key; the same secret the same key on another day (no daily rotation with a secret)
  assert.notEqual(await T.rateKey(fakeC(w, { RL_SECRET: 'other' }), 'recovery', ip), want);
  assert.equal(await T.rateKey(fakeC(w, { RL_SECRET: 'test-secret-1' }, w.clock.t + 3 * 864e5), 'recovery', ip), want);
});

test('rate-limit keys without RL_SECRET: random key kept once in meta, a new derived key every UTC day', async () => {
  const w = world(), ip = '192.0.2.78';
  assert.equal(w.db.raw.prepare("SELECT COUNT(*) n FROM meta WHERE key = 'rl_key'").get().n, 0);
  const k1 = await T.rateKey(fakeC(w), 'login', ip);
  const row = w.db.raw.prepare("SELECT value FROM meta WHERE key = 'rl_key'").get();
  assert.ok(row && Buffer.from(row.value, 'base64url').length === 32, 'a 32-byte random key is stored');
  assert.equal(await T.rateKey(fakeC(w), 'login', ip), k1, 'stable within the day');
  assert.notEqual(await T.rateKey(fakeC(w), 'login', '192.0.2.79'), k1);
  assert.notEqual(k1, 'login:' + createHash('sha256').update('login|' + ip).digest('hex').slice(0, 32));
  // the derivation is HMAC(HMAC(stored key, 'bb-rl-day:' + day), bucket|ip)
  const day = new Date(w.clock.t).toISOString().slice(0, 10);
  const dk = createHmac('sha256', Buffer.from(row.value, 'base64url')).update('bb-rl-day:' + day).digest();
  assert.equal(k1, 'login:' + createHmac('sha256', dk).update('login|' + ip).digest('hex').slice(0, 32));
  const next = await T.rateKey(fakeC(w, {}, w.clock.t + 864e5), 'login', ip);
  assert.notEqual(next, k1, 'next day, other key');
  assert.equal(w.db.raw.prepare("SELECT value FROM meta WHERE key = 'rl_key'").get().value, row.value, 'the stored key is made only once');
  // a second database gets its own key
  const w2 = world();
  assert.notEqual(await T.rateKey(fakeC(w2), 'login', ip), k1);
  // limits still count across requests
  const br = w.browser(ORIGIN, '192.0.2.80');
  let last; for (let i = 0; i < 7; i++) last = await br.call('POST', '/api/auth/recovery', { code: 'AAAAA-BBBBB-CCCCC-DDDDD' });
  assert.equal(last.status, 429);
});

test('rate-limit keys without RL_SECRET and without the meta table still hash with a random key', async () => {
  const w = world(); w.db.raw.exec('DROP TABLE meta');
  const k = await T.rateKey(fakeC(w), 'login', '192.0.2.81');
  assert.match(k, /^login:[0-9a-f]{32}$/);
  assert.notEqual(k, 'login:' + createHash('sha256').update('login|192.0.2.81').digest('hex').slice(0, 32));
  const br = w.browser(ORIGIN, '192.0.2.81');
  assert.equal((await br.call('POST', '/api/auth/login/options', {})).status, 200, 'requests still work');
});

function seedOld(w, t) {
  const r = w.db.raw;
  r.prepare('INSERT OR IGNORE INTO users (id, created_at, updated_at) VALUES (?, ?, ?)').run('u-old', t, t);
  r.prepare('INSERT OR REPLACE INTO challenges (challenge, kind, expires_at) VALUES (?, ?, ?), (?, ?, ?)').run('c-old', 'auth', t - 1, 'c-new', 'auth', t + 60e3);
  r.prepare('INSERT OR REPLACE INTO sessions (id_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)').run('s-old', 'u-old', t - 1e10, t - 1, t - 1e10, 's-new', 'u-old', t, t + 1e9, t);
  r.prepare('INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, 1), (?, ?, 1)').run('r-old', t - 864e5 - 1, 'r-new', t - 3600e3);
  const day = d => new Date(t - d * 864e5).toISOString().slice(0, 10);
  r.prepare('INSERT OR REPLACE INTO ai_usage (user_id, day, requests, tokens) VALUES (?, ?, 1, 1), (?, ?, 1, 1)').run('u-old', day(36), 'u-old', day(34));
}
const ids = (w, t, col) => w.db.raw.prepare(`SELECT ${col} AS v FROM ${t} ORDER BY 1`).all().map(x => x.v);

test('cleanup is deterministic: first request after an hour deletes old rows, once, in waitUntil', async () => {
  const w = world(), t = w.clock.t;
  seedOld(w, t);
  const waits = [];
  const fn = endpoint({ GET: H.meGet }, { now: () => w.clock.t, random: () => 0.99 });   // random() never triggers it
  const res = await fn({ request: new Request(ORIGIN + '/api/me'), env: w.env, waitUntil: p => waits.push(p) });
  assert.equal(res.status, 200);
  assert.equal(waits.length, 1, 'cleanup handed to waitUntil');
  await Promise.all(waits);
  assert.deepEqual(ids(w, 'challenges', 'challenge'), ['c-new']);
  assert.deepEqual(ids(w, 'sessions', 'id_hash'), ['s-new']);
  assert.deepEqual(ids(w, 'rate_limits', 'key'), ['r-new']);
  assert.equal(ids(w, 'ai_usage', 'day').length, 1, 'AI counters older than 35 days deleted');
  assert.equal(+w.db.raw.prepare("SELECT value FROM meta WHERE key = 'last_cleanup'").get().value, t);
  // within the hour: no second run, whichever instance asks
  seedOld(w, t + 10 * 60e3);   // fresh "old" rows would be deleted if it ran
  assert.equal(await T.maybeCleanup(w.db, t + 10 * 60e3), 'skip');
  assert.ok(ids(w, 'challenges', 'challenge').includes('c-old'));
  // after an hour it runs again
  assert.equal(await T.maybeCleanup(w.db, t + T.CLEANUP_EVERY + 1), 'ran');
  assert.ok(!ids(w, 'challenges', 'challenge').includes('c-old'));
});

test('cleanup: concurrent requests on several instances run it only once', async () => {
  const w = world(), t = w.clock.t;
  const inst = () => Object.assign(Object.create(w.db), {});   // a separate binding object per Worker instance, same database
  const runs = await Promise.all([1, 2, 3, 4].map(() => T.maybeCleanup(inst(), t)));
  assert.equal(runs.filter(r => r === 'ran').length, 1, runs.join());
  const later = await Promise.all([1, 2, 3].map(() => T.maybeCleanup(inst(), t + T.CLEANUP_EVERY + 5)));
  assert.equal(later.filter(r => r === 'ran').length, 1, later.join());
});

test('cleanup without the meta table falls back to the old occasional run, and never breaks a request', async () => {
  const w = world(); w.db.raw.exec('DROP TABLE meta');
  assert.equal(await T.maybeCleanup(w.db, w.clock.t), 'no_meta');
  const t = w.clock.t; seedOld(w, t);
  const waits = [];
  const fn = endpoint({ GET: H.meGet }, { now: () => t, random: () => 0.01 });
  assert.equal((await fn({ request: new Request(ORIGIN + '/api/me'), env: w.env, waitUntil: p => waits.push(p) })).status, 200);
  await Promise.all(waits);
  assert.deepEqual(ids(w, 'challenges', 'challenge'), ['c-new']);
});

test('the authenticator AAGUID is not stored, and migration 0003 clears old values', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a, 'A');
  assert.equal(w.db.raw.prepare('SELECT aaguid FROM credentials').get().aaguid, null);
  assert.equal((await br.call('GET', '/api/me')).body.credentials[0].name, 'iPhone · Safari', 'device label unaffected');
  w.db.raw.exec("UPDATE credentials SET aaguid = 'AAAAAAAAAAAAAAAAAAAAAA'");
  const { readFileSync } = await import('node:fs');
  w.db.raw.exec(readFileSync(join(ROOT, 'migrations', '0003_meta.sql'), 'utf8'));   // safe to run again
  assert.equal(w.db.raw.prepare('SELECT COUNT(*) n FROM credentials WHERE aaguid IS NOT NULL').get().n, 0);
});

test('GET /api/me/export: the account, passkeys, sessions, synced data and AI counters, without hashes or keys', async () => {
  const w = world(), br = w.browser(), a = new SoftAuthenticator();
  await signup(w, br, a, 'Exporter');
  assert.equal((await w.browser().call('GET', '/api/me/export')).status, 401, 'signed in only');
  await br.call('PUT', '/api/sync', { ns: 'progress', data: { 'naeroson-prog': '{"x":1}' }, baseVersion: 0, updatedAt: w.clock.t });
  const uid = w.db.raw.prepare('SELECT id FROM users').get().id;
  w.db.raw.prepare('INSERT INTO ai_usage (user_id, day, requests, tokens) VALUES (?, ?, 3, 1200)').run(uid, '2026-11-08');
  w.db.raw.prepare('INSERT INTO ai_usage (user_id, day, requests, tokens) VALUES (?, ?, 9, 9)').run('someone-else', '2026-11-08');
  const other = w.browser(ORIGIN, '198.51.100.44'); await signup(w, other, new SoftAuthenticator(), 'Other');
  const r = await br.call('GET', '/api/me/export');
  assert.equal(r.status, 200);
  const e = r.body;
  assert.deepEqual(Object.keys(e).sort(), ['aiUsage', 'exported', 'notes', 'ok', 'passkeys', 'sessions', 'syncedData', 'user']);
  assert.equal(e.user.id, uid); assert.equal(e.user.name, 'Exporter');
  assert.ok(e.user.created && e.user.recoveryCodeCreated);
  assert.equal(e.passkeys.length, 1);
  assert.deepEqual(Object.keys(e.passkeys[0]).sort(), ['backedUp', 'created', 'device', 'lastUsed', 'synced', 'transports']);
  assert.equal(e.passkeys[0].device, 'iPhone · Safari');
  assert.equal(e.sessions.length, 1); assert.equal(e.sessions[0].thisDevice, true); assert.equal(e.sessions[0].signedInWith, 'signup');
  assert.deepEqual(e.syncedData.progress.data, { 'naeroson-prog': '{"x":1}' });
  assert.equal(e.syncedData.progress.version, 1);
  assert.deepEqual(e.aiUsage, [{ day: '2026-11-08', requests: 3, tokens: 1200 }]);
  const dump = JSON.stringify(e);
  const row = w.db.raw.prepare('SELECT recovery_hash FROM users WHERE id = ?').get(uid);
  const cr = w.db.raw.prepare('SELECT public_key FROM credentials WHERE user_id = ?').get(uid);
  const sh = w.db.raw.prepare('SELECT id_hash FROM sessions WHERE user_id = ?').get(uid);
  for (const secret of [row.recovery_hash, sh.id_hash, JSON.parse(cr.public_key).x, br.jar[COOKIE]]) assert.ok(!dump.includes(secret), 'no hashes or keys in the export');
  assert.ok(!dump.includes('Other') && !dump.includes('someone-else'), 'nothing of other users');
  assert.equal(r.headers.get('cache-control'), 'no-store');
});
