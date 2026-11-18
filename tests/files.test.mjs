/* /api/files: document files in R2 for the signed-in user (functions/api/files/[[path]].js): node --test tests/files.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeD1 } from './lib/d1mock.mjs';
import { onRequest } from '../functions/api/files/[[path]].js';
import { COOKIE, _test as AT, handlers as H, endpoint } from '../functions/_lib/api.js';
import { QUOTA, MAX_FILE, deleteAllFiles } from '../functions/_lib/files.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://nordap.eu';
const TOKEN = n => String(n).padStart(43, 'A');

/* a minimal R2 bucket: put/get/delete/list with prefix, cursor and custom metadata */
function fakeR2() {
  const m = new Map();
  return { m,
    async put(k, body, o) { const u8 = new Uint8Array(body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer()); m.set(k, { u8, meta: (o && o.customMetadata) || {}, uploaded: new Date() }); },
    async get(k) { const o = m.get(k); if (!o) return null; return { body: new Blob([o.u8]).stream(), size: o.u8.byteLength, customMetadata: o.meta }; },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach(x => m.delete(x)); },
    async list(o) { const keys = [...m.keys()].filter(k => k.startsWith(o.prefix)).sort(); const start = o.cursor ? +o.cursor : 0, page = keys.slice(start, start + 2);
      return { objects: page.map(k => ({ key: k, size: m.get(k).u8.byteLength, uploaded: m.get(k).uploaded, customMetadata: m.get(k).meta })), truncated: start + 2 < keys.length, cursor: String(start + 2) }; } };
}
function world(withBucket) {
  const env = { DB: makeD1(join(ROOT, 'migrations')) }; if (withBucket !== false) env.FILES = fakeR2();
  const t = Date.UTC(2026, 10, 18, 12);
  async function user(id, n) {
    env.DB.raw.prepare('INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, 'P', t, t);
    env.DB.raw.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at, last_seen_at, via, device) VALUES (?, ?, ?, ?, ?, ?, ?)').run(await AT.hashToken(TOKEN(n)), id, t, t + 864e5 * 60, t, 'password', 'test');
    return COOKIE + '=' + TOKEN(n);
  }
  async function call(method, path, o) {
    o = o || {}; const h = new Headers(); if (method !== 'GET') h.set('origin', ORIGIN); if (o.cookie) h.set('cookie', o.cookie);
    for (const [k, v] of Object.entries(o.headers || {})) h.set(k, v);
    const res = await onRequest({ request: new Request(ORIGIN + '/api/files' + path, { method, headers: h, body: o.body }), env, waitUntil: () => {} });
    const ct = res.headers.get('content-type') || ''; const body = ct.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer());
    return { status: res.status, body, headers: res.headers };
  }
  return { env, user, call };
}

test('not switched on: the list says enabled:false, uploads get a clear 503', async () => {
  const w = world(false); const c = await w.user('u1', 1);
  assert.deepEqual((await w.call('GET', '', { cookie: c })).body, { ok: true, enabled: false });
  const r = await w.call('PUT', '/fd1', { cookie: c, body: new Uint8Array([1, 2, 3]) }); assert.equal(r.status, 503); assert.equal(r.body.error, 'no_files');
});
test('signed out is refused; ids are checked', async () => {
  const w = world(); assert.equal((await w.call('GET', '')).status, 401);
  const c = await w.user('u1', 1); assert.equal((await w.call('PUT', '/..%2Fx', { cookie: c, body: new Uint8Array([1]) })).status, 400);
});
test('upload, list, download and delete; each user sees only their own files', async () => {
  const w = world(); const a = await w.user('u1', 1), b = await w.user('u2', 2);
  const up = await w.call('PUT', '/fdabc', { cookie: a, body: new Uint8Array([37, 80, 68, 70]), headers: { 'content-type': 'application/pdf', 'x-file-name': encodeURIComponent('DA42 AFM æøå.pdf') } });
  assert.equal(up.status, 200); assert.equal(up.body.size, 4);
  await w.call('PUT', '/fd2', { cookie: a, body: new Uint8Array([1]) }); await w.call('PUT', '/fd3', { cookie: a, body: new Uint8Array([1, 2]) }); // more than one list page
  const l = await w.call('GET', '', { cookie: a }); assert.equal(l.body.enabled, true); assert.equal(l.body.files.length, 3); assert.equal(l.body.used, 7);
  assert.equal(l.body.files.find(f => f.id === 'fdabc').name, 'DA42 AFM æøå.pdf');
  const d = await w.call('GET', '/fdabc', { cookie: a }); assert.equal(d.status, 200); assert.deepEqual([...d.body], [37, 80, 68, 70]); assert.equal(d.headers.get('content-type'), 'application/pdf');
  assert.match(d.headers.get('cache-control'), /private/);
  assert.equal((await w.call('GET', '/fdabc', { cookie: b })).status, 404); // another user cannot read it
  assert.equal((await w.call('GET', '', { cookie: b })).body.files.length, 0);
  assert.equal((await w.call('DELETE', '/fdabc', { cookie: a })).status, 200);
  assert.equal((await w.call('GET', '/fdabc', { cookie: a })).status, 404);
});
test('size and quota limits', async () => {
  const w = world(); const a = await w.user('u1', 1);
  const big = await w.call('PUT', '/fdbig', { cookie: a, body: new Uint8Array(MAX_FILE + 1) }); assert.equal(big.status, 413);
  w.env.FILES.m.set('f/u1/filler', { u8: { byteLength: QUOTA - 10 }, meta: {}, uploaded: new Date() });
  const q = await w.call('PUT', '/fdq', { cookie: a, body: new Uint8Array(20) }); assert.equal(q.status, 507); assert.equal(q.body.error, 'quota');
});
test('deleting the account deletes the user\'s files', async () => {
  const w = world(); const a = await w.user('u1', 1); await w.user('u2', 2);
  await w.call('PUT', '/fd1', { cookie: a, body: new Uint8Array([1]) });
  w.env.FILES.m.set('f/u2/keep', { u8: new Uint8Array([1]), meta: {}, uploaded: new Date() });
  const del = endpoint({ DELETE: H.meDelete });
  const h = new Headers({ origin: ORIGIN, cookie: a, 'content-type': 'application/json' });
  const r = await del({ request: new Request(ORIGIN + '/api/me', { method: 'DELETE', headers: h, body: JSON.stringify({ confirm: 'delete' }) }), env: w.env, waitUntil: () => {} });
  assert.equal(r.status, 200); assert.deepEqual([...w.env.FILES.m.keys()], ['f/u2/keep']);
  assert.equal(await deleteAllFiles({}, 'u1'), 0);
});
