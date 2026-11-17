/* Unit tests for e-mail + password accounts (functions/_lib/api.js): node --test tests/password.test.mjs
   D1 mocked on node:sqlite; the Resend API mocked with a fetch stand-in. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeD1 } from './lib/d1mock.mjs';
import { endpoint, handlers as H } from '../functions/_lib/api.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://nordap.eu';
const ROUTES = {
  '/api/auth/signup': { POST: H.pwSignup }, '/api/auth/password': { POST: H.pwLogin }, '/api/auth/forgot': { POST: H.pwForgot },
  '/api/auth/reset': { POST: H.pwReset }, '/api/me/password': { POST: H.mePassword }, '/api/auth/logout': { POST: H.logout },
  '/api/me': { GET: H.meGet }, '/api/me/credentials': { DELETE: H.credDelete }
};
function world(opts) {
  opts = opts || {};
  const clock = { t: Date.UTC(2026, 10, 17, 12, 0, 0) };
  const env = Object.assign({ DB: makeD1(opts.noMigration ? null : join(ROOT, 'migrations')) }, opts.env || {});
  if (opts.noMigration) env.DB.raw.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, email_verified_at INTEGER, recovery_hash TEXT UNIQUE, recovery_created_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL); CREATE TABLE sessions (id_hash TEXT PRIMARY KEY, user_id TEXT, created_at INTEGER, expires_at INTEGER, last_seen_at INTEGER, via TEXT, device TEXT); CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL); CREATE TABLE challenges (challenge TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id TEXT, data TEXT, expires_at INTEGER NOT NULL); CREATE TABLE credentials (id TEXT PRIMARY KEY, user_id TEXT, public_key TEXT, alg INTEGER, sign_count INTEGER, transports TEXT, name TEXT, aaguid TEXT, backup_eligible INTEGER, backed_up INTEGER, created_at INTEGER, last_used_at INTEGER); CREATE TABLE user_data (user_id TEXT, ns TEXT, data TEXT, version INTEGER, updated_at INTEGER, stored_at INTEGER, PRIMARY KEY (user_id, ns));");
  const mails = [];
  const deps = { now: () => clock.t, random: () => 0.99, fetch: async (url, init) => { mails.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization }); return new Response('{"id":"m1"}', { status: 200 }); } };
  function browser(ip) {
    const jar = {};
    async function call(method, path, body) {
      const url = new URL(path, ORIGIN);
      const h = new Headers({ 'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605', 'cf-connecting-ip': ip || '203.0.113.7' });
      if (method !== 'GET') h.set('origin', ORIGIN);
      if (body !== undefined) h.set('content-type', 'application/json');
      const ck = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.set('cookie', ck);
      const res = await endpoint(ROUTES[url.pathname], deps)({ request: new Request(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, waitUntil: () => {} });
      for (const line of res.headers.getSetCookie()) { const [kv] = line.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0/.test(line) || !v) delete jar[k]; else jar[k] = v; }
      return { status: res.status, body: await res.json() };
    }
    return { call, jar };
  }
  return { clock, env, mails, browser };
}
const MAIL = { RESEND_API_KEY: 're_test_123', MAIL_FROM: 'NORDAP <noreply@nordap.eu>' };

test('sign up with e-mail and password, sign out, sign in again; the password is stored only as a PBKDF2 hash', async () => {
  const w = world(), b = w.browser();
  const s = await b.call('POST', '/api/auth/signup', { email: ' Pilot@Example.com ', password: 'correct horse', name: 'Daniel' });
  assert.equal(s.status, 200, JSON.stringify(s.body)); assert.match(s.body.recoveryCode, /^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);
  const me = await b.call('GET', '/api/me');
  assert.equal(me.body.user.email, 'pilot@example.com'); assert.equal(me.body.user.hasPassword, true); assert.equal(me.body.mail, false);
  const row = w.env.DB.raw.prepare('SELECT password_hash FROM users').get();
  assert.match(row.password_hash, /^pbkdf2-sha256\$100000\$/); assert.ok(!row.password_hash.includes('correct horse'));
  await b.call('POST', '/api/auth/logout', {});
  assert.equal((await b.call('GET', '/api/me')).body.user, null);
  const bad = await b.call('POST', '/api/auth/password', { email: 'pilot@example.com', password: 'wrong horse' });
  assert.equal(bad.status, 400); assert.equal(bad.body.error, 'bad_login');
  const none = await b.call('POST', '/api/auth/password', { email: 'nobody@example.com', password: 'correct horse' });
  assert.equal(none.body.error, 'bad_login'); assert.equal(none.body.message, bad.body.message); // same answer: no account enumeration
  const ok = await b.call('POST', '/api/auth/password', { email: 'PILOT@example.com', password: 'correct horse' });
  assert.equal(ok.status, 200); assert.equal(ok.body.user.name, 'Daniel');
  assert.equal((await b.call('GET', '/api/me')).body.user.email, 'pilot@example.com');
});

test('signup rejects bad e-mails, short passwords and a taken address', async () => {
  const w = world(), b = w.browser();
  assert.equal((await b.call('POST', '/api/auth/signup', { email: 'no-at-sign', password: 'longenough' })).body.error, 'bad_email');
  assert.equal((await b.call('POST', '/api/auth/signup', { email: 'a@b.no', password: 'short' })).body.error, 'weak_password');
  assert.equal((await b.call('POST', '/api/auth/signup', { email: 'a@b.no', password: 'a@b.no' })).body.error, 'weak_password');
  assert.equal((await b.call('POST', '/api/auth/signup', { email: 'a@b.no', password: 'longenough' })).status, 200);
  const again = await w.browser('198.51.100.2').call('POST', '/api/auth/signup', { email: 'A@B.no', password: 'longenough' });
  assert.equal(again.status, 409); assert.equal(again.body.error, 'email_taken');
});

test('password guessing is rate limited per address', async () => {
  const w = world();
  await w.browser().call('POST', '/api/auth/signup', { email: 'x@y.no', password: 'longenough' });
  let last;
  for (let i = 0; i < 12; i++) last = await w.browser('192.0.2.' + (i + 1)).call('POST', '/api/auth/password', { email: 'x@y.no', password: 'guess' + i });
  assert.equal(last.status, 429); assert.equal(last.body.error, 'rate_limited');
});

test('forgot password: without a mail service it says so; with Resend it mails a one-time link that resets and signs in', async () => {
  const off = world(); await off.browser().call('POST', '/api/auth/signup', { email: 'p@q.no', password: 'longenough' });
  const r0 = await off.browser().call('POST', '/api/auth/forgot', { email: 'p@q.no' });
  assert.equal(r0.status, 503); assert.equal(r0.body.error, 'no_mail');

  const w = world({ env: MAIL }), a = w.browser();
  await a.call('POST', '/api/auth/signup', { email: 'p@q.no', password: 'longenough' });
  const other = w.browser('198.51.100.3');
  const unknown = await other.call('POST', '/api/auth/forgot', { email: 'ghost@q.no' });
  assert.equal(unknown.status, 200); assert.equal(w.mails.length, 0); // same answer, no mail
  const f = await other.call('POST', '/api/auth/forgot', { email: 'P@q.no' });
  assert.equal(f.status, 200); assert.equal(w.mails.length, 1);
  const m = w.mails[0]; assert.equal(m.url, 'https://api.resend.com/emails'); assert.deepEqual(m.body.to, ['p@q.no']); assert.equal(m.auth, 'Bearer re_test_123');
  const token = /#reset=([A-Za-z0-9_-]{43})/.exec(m.body.text)[1];
  assert.ok(!JSON.stringify(w.env.DB.raw.prepare('SELECT * FROM challenges').all()).includes(token)); // only a hash is stored
  assert.equal((await other.call('POST', '/api/auth/reset', { token, password: 'short' })).body.error, 'weak_password');
  const r = await other.call('POST', '/api/auth/reset', { token, password: 'brand new pw' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await a.call('GET', '/api/me')).body.user, null);            // the old session is signed out
  assert.equal((await other.call('GET', '/api/me')).body.user.email, 'p@q.no');
  assert.equal((await other.call('POST', '/api/auth/reset', { token, password: 'again new pw' })).body.error, 'expired'); // one use
  assert.equal((await w.browser('192.0.2.9').call('POST', '/api/auth/password', { email: 'p@q.no', password: 'brand new pw' })).status, 200);
  // expired link
  await other.call('POST', '/api/auth/forgot', { email: 'p@q.no' });
  const t2 = /#reset=([A-Za-z0-9_-]{43})/.exec(w.mails[1].body.text)[1];
  w.clock.t += 61 * 60e3;
  assert.equal((await other.call('POST', '/api/auth/reset', { token: t2, password: 'another pw 1' })).body.error, 'expired');
});

test('change password needs the current one; a passkey-only account can add e-mail and password; columns are added on the fly', async () => {
  const w = world({ noMigration: true }), b = w.browser();
  // a passkey-only account (made before passwords existed)
  w.env.DB.raw.prepare('INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('U1', 'Old', w.clock.t, w.clock.t);
  const { handlers } = await import('../functions/_lib/api.js'); void handlers;
  const s = await b.call('POST', '/api/auth/signup', { email: 'new@x.no', password: 'longenough' }); // adds the columns
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.equal((await b.call('POST', '/api/me/password', { current: 'wrong', password: 'next password' })).body.error, 'bad_current');
  assert.equal((await b.call('POST', '/api/me/password', { current: 'longenough', password: 'next password' })).status, 200);
  await b.call('POST', '/api/auth/logout', {});
  assert.equal((await b.call('POST', '/api/auth/password', { email: 'new@x.no', password: 'next password' })).status, 200);
});
