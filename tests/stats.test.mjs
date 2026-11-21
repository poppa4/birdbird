/* Anonymous visit counting and the admin overview (functions/_lib/stats.js): node --test tests/stats.test.mjs
   D1 mocked on node:sqlite. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeD1 } from './lib/d1mock.mjs';
import { endpoint, handlers as H } from '../functions/_lib/api.js';
import { ping, adminStats, cleanPath } from '../functions/_lib/stats.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://nordap.eu';
const ROUTES = { '/api/ping': { POST: ping }, '/api/admin/stats': { GET: adminStats }, '/api/auth/signup': { POST: H.pwSignup }, '/api/me': { GET: H.meGet } };
const SAFARI = 'Mozilla/5.0 (Macintosh) Safari/605';
function world(env) {
  const clock = { t: Date.UTC(2026, 10, 21, 12, 0, 0) };
  const E = Object.assign({ DB: makeD1(join(ROOT, 'migrations')) }, env || {});
  const deps = { now: () => clock.t, random: () => 0.99 };
  function browser(ip, ua) {
    const jar = {};
    async function call(method, path, body) {
      const url = new URL(path, ORIGIN), h = new Headers({ 'user-agent': ua || SAFARI, 'cf-connecting-ip': ip || '203.0.113.7' });
      if (method !== 'GET') h.set('origin', ORIGIN); if (body !== undefined) h.set('content-type', 'application/json');
      const ck = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.set('cookie', ck);
      const res = await endpoint(ROUTES[url.pathname], deps)({ request: new Request(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env: E, waitUntil: () => {} });
      for (const line of res.headers.getSetCookie()) { const [kv] = line.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0/.test(line) || !v) delete jar[k]; else jar[k] = v; }
      const txt = await res.text(); return { status: res.status, body: txt ? JSON.parse(txt) : null };
    }
    return { call };
  }
  return { clock, env: E, browser };
}

test('paths are counted without query, hash or .html', () => {
  assert.equal(cleanPath('/flows.html?x=1#app'), '/flows'); assert.equal(cleanPath('/index.html'), '/'); assert.equal(cleanPath('workspace.html'), '/workspace'); assert.equal(cleanPath(''), '/');
});

test('visits: one visitor per day however many pages; bots not counted; no IP stored; the owner sees the numbers, others get 403 with their id', async () => {
  const w = world();
  const a = w.browser('198.51.100.1'), b = w.browser('198.51.100.2'), bot = w.browser('198.51.100.3', 'Googlebot/2.1');
  assert.equal((await a.call('POST', '/api/ping', { p: '/index.html', v: 1 })).status, 204);
  await a.call('POST', '/api/ping', { p: '/flows.html', v: 1 }); await a.call('POST', '/api/ping', { p: '/flows.html', v: 0 });
  await b.call('POST', '/api/ping', { p: '/flows.html', v: 1 }); await bot.call('POST', '/api/ping', { p: '/', v: 1 });
  const raw = w.env.DB.raw;
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM stat_day').get().n, 2, 'two visitors, the bot left out');
  assert.equal(raw.prepare("SELECT views FROM stat_page WHERE path = '/flows'").get().views, 2);
  const dump = JSON.stringify(raw.prepare('SELECT * FROM stat_day').all()) + JSON.stringify(raw.prepare('SELECT * FROM stat_live').all());
  assert.ok(!dump.includes('198.51.100'), 'no IP address stored');

  const me = w.browser('203.0.113.9');
  assert.equal((await me.call('GET', '/api/admin/stats')).status, 401, 'signed out');
  const su = await me.call('POST', '/api/auth/signup', { email: 'owner@example.com', password: 'correct horse', name: 'Daniel' });
  assert.equal(su.status, 200, JSON.stringify(su.body));
  const no = await me.call('GET', '/api/admin/stats');
  assert.equal(no.status, 403); const id = su.body.user.id; assert.ok(no.body.message.includes(id), 'the message names the account id');
  assert.equal((await me.call('GET', '/api/me')).body.user.admin, false);
  /* an unverified e-mail never makes an admin */
  w.env.ADMIN_EMAILS = 'owner@example.com'; assert.equal((await me.call('GET', '/api/admin/stats')).status, 403);
  w.env.ADMIN_USER_IDS = 'someone-else, ' + id;
  assert.equal((await me.call('GET', '/api/me')).body.user.admin, true);
  const s = await me.call('GET', '/api/admin/stats');
  assert.equal(s.status, 200); assert.equal(s.body.online, 2); assert.equal(s.body.today.visitors, 2); assert.equal(s.body.today.views, 3);
  assert.equal(s.body.days.length, 14); assert.equal(s.body.members.total, 1); assert.equal(s.body.pages.today[0].path, '/flows');
  w.clock.t += 5 * 60000; assert.equal((await me.call('GET', '/api/admin/stats')).body.online, 0, 'nobody online after 5 minutes without a heartbeat');
  w.clock.t += 86400000; await a.call('POST', '/api/ping', { p: '/', v: 1 });
  const d2 = (await me.call('GET', '/api/admin/stats')).body; assert.equal(d2.today.visitors, 1); assert.equal(d2.week.visitors, 3, 'a new day, a new count');
});
