/* End-to-end check against a running server (wrangler pages dev with a local D1, or a preview deployment):
     node tests/e2e-http.mjs http://localhost:8788
   Exercises the real Pages routing, workerd's WebCrypto and D1's SQL with software passkeys. */
import assert from 'node:assert/strict';
import { SoftAuthenticator } from './lib/softauthn.mjs';

const BASE = process.argv[2] || 'http://localhost:8788';
const jar = {};
async function call(method, path, body) {
  const h = { 'content-type': 'application/json' };
  if (method !== 'GET') h.origin = BASE;
  const ck = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.cookie = ck;
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const line of r.headers.getSetCookie()) { const [kv] = line.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0/.test(line) || !v) delete jar[k]; else jar[k] = v; }
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = { raw: t.slice(0, 200) }; }
  return { status: r.status, body: j };
}
const step = (n, r, s) => { console.log((r.status === (s || 200) ? 'ok  ' : 'FAIL') + ' ' + n + ' → ' + r.status + (r.body.error ? ' ' + r.body.error : '')); assert.equal(r.status, s || 200, JSON.stringify(r.body)); return r.body; };

for (const alg of [-7, -257]) {
  const a = new SoftAuthenticator({ alg });
  console.log('--- alg', alg);
  const o = step('register/options', await call('POST', '/api/auth/register/options', { name: 'E2E ' + alg }));
  const v = step('register/verify', await call('POST', '/api/auth/register/verify', { credential: await a.create(o.options, BASE) }));
  assert.ok(v.recoveryCode);
  step('me', await call('GET', '/api/me'));
  step('sync put', await call('PUT', '/api/sync', { ns: 'progress', data: { 'naeroson-prog': '{"quiz:holding":80}' }, baseVersion: 0, updatedAt: Date.now() }));
  step('sync put stale', await call('PUT', '/api/sync', { ns: 'progress', data: {}, baseVersion: 0 }), 409);
  const g = step('sync get', await call('GET', '/api/sync'));
  assert.equal(g.ns.progress.version, 1);
  step('logout', await call('POST', '/api/auth/logout', {}));
  assert.equal(step('me signed out', await call('GET', '/api/me')).user, null);
  const lo = step('login/options', await call('POST', '/api/auth/login/options', {}));
  step('login/verify', await call('POST', '/api/auth/login/verify', { credential: await a.get(lo.options, BASE) }));
  step('recovery wrong', await call('POST', '/api/auth/recovery', { code: 'AAAAA-BBBBB-CCCCC-DDDDD' }), 400);
  step('logout', await call('POST', '/api/auth/logout', {}));
  const rc = step('recovery', await call('POST', '/api/auth/recovery', { code: v.recoveryCode }));
  assert.notEqual(rc.recoveryCode, v.recoveryCode);
  step('delete account', await call('DELETE', '/api/me', { confirm: 'delete' }));
  assert.equal(step('me after delete', await call('GET', '/api/me')).user, null);
}
const bad = await fetch(BASE + '/api/sync', { method: 'PUT', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
console.log((bad.status === 403 ? 'ok  ' : 'FAIL') + ' cross-origin PUT → ' + bad.status);
for (const p of ['/SETUP-ACCOUNTS.md', '/migrations/0001_accounts.sql', '/tests/api.test.mjs']) { const r = await fetch(BASE + p); console.log((r.status === 404 ? 'ok  ' : 'FAIL') + ' ' + p + ' → ' + r.status); }
console.log('e2e done');
