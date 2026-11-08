/* Birdbird – accounts and sync for Cloudflare Pages Functions (D1 binding: DB).

   Endpoints (each file in functions/api/… re-exports one handler from here):
     POST   /api/auth/register/options   new account (no session) or add a passkey (signed in)
     POST   /api/auth/register/verify    -> creates the account / passkey; new accounts get a one-time recovery code
     POST   /api/auth/login/options      discoverable passkey sign-in (no user name needed)
     POST   /api/auth/login/verify       -> session cookie
     POST   /api/auth/recovery           { code } -> session cookie and a NEW recovery code (the old one is used up)
     POST   /api/auth/logout
     GET    /api/me                      account, passkeys, synced namespaces ({ ok:true, user:null } when signed out)
     PATCH  /api/me                      { name }
     DELETE /api/me                      { confirm:'delete' } deletes the account and all its data
     POST   /api/me/recovery             new recovery code (old one stops working)
     DELETE /api/me/credentials?id=…     remove a passkey (not the last one)
     GET    /api/sync                    all namespaces
     PUT    /api/sync                    { ns, data, baseVersion, updatedAt, force? } last writer wins, with a version check

   Security:
   - Session: random 32-byte id in an HttpOnly, Secure, SameSite=Lax __Host- cookie; only its SHA-256 is stored.
     60 days, renewed when used (at most once a day); a new id on every sign-in; logout deletes it server-side.
   - CSRF: every state-changing request must carry an Origin header equal to this site's origin and a JSON body.
   - Rate limits per hashed IP (auth) and per user (sync), counted in D1.
   - WebAuthn challenges are single use (deleted when read) and expire after 5 minutes.
   - Responses: application/json, no-store, nosniff. Error bodies: { ok:false, error, message } where message says what to do. */

import { b64u, unb64u, randomBytes, sha256, peekChallenge, verifyRegistration, verifyAuthentication, WAError, COSE_ES256, COSE_RS256 } from './webauthn.js';

export const COOKIE = '__Host-bb_session';
const DAY = 864e5;
const SESSION_MS = 60 * DAY;
const CHALLENGE_MS = 5 * 60e3;
const NAMESPACES = ['progress', 'packs', 'routes', 'settings'];
const MAX_NS_BYTES = 1500000;          // D1 rows can hold 2 MB; keep a margin
const MAX_BODY = 1600000;
const LIMITS = {
  reg: [20, 3600],                     // new-account / add-passkey requests (options + verify) per IP per hour
  login: [30, 600],                    // sign-in ceremonies per IP per 10 minutes
  recovery: [6, 900],                  // recovery code attempts per IP per 15 minutes
  write: [60, 60],                     // account changes per user per minute
  sync: [120, 60]                      // sync requests per user per minute
};

/* ---------- http ---------- */
class HttpError extends Error { constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; } }
const fail = (status, code, message, extra) => { throw new HttpError(status, code, message, extra); };

export function json(body, status, headers) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' });
  if (headers) for (const [k, v] of Object.entries(headers)) { if (Array.isArray(v)) v.forEach(x => h.append(k, x)); else if (v != null) h.set(k, v); }
  return new Response(JSON.stringify(body), { status: status || 200, headers: h });
}

function cookieHeader(value, maxAgeSec) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}
function readCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  for (const part of c.split(/;\s*/)) { const i = part.indexOf('='); if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1); }
  return null;
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export function checkOrigin(request) {
  if (!STATE_CHANGING.has(request.method)) return;
  const url = new URL(request.url);
  const o = request.headers.get('origin');
  if (!o || o !== url.origin) fail(403, 'bad_origin', 'This request did not come from Birdbird itself. Reload the page and try again.');
}

async function readJson(request, required) {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  const text = await request.text();
  if (!text) { if (required) fail(400, 'bad_request', 'The request was empty. Reload the page and try again.'); return {}; }
  if (!ct.includes('application/json')) fail(415, 'bad_request', 'Send JSON (content-type: application/json).');
  if (text.length > MAX_BODY) fail(413, 'too_large', 'That is too much data to save in one go (over 1.5 MB).');
  try { const o = JSON.parse(text); if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0; return o; }
  catch (e) { fail(400, 'bad_request', 'The request was not valid JSON. Reload the page and try again.'); }
}

/* Relying party: birdbird.eu in production (also for www.), the exact host on pages.dev previews and on localhost */
export function rpFor(url, env) {
  const host = url.hostname.toLowerCase();
  const fixed = (env && env.RP_ID ? String(env.RP_ID) : 'birdbird.eu').toLowerCase();
  const local = host === 'localhost' || host.endsWith('.localhost');
  if (url.protocol !== 'https:' && !local) fail(400, 'insecure', 'Passkeys need a secure (https) connection. Open Birdbird at https://birdbird.eu.');
  if (/^[\d.]+$/.test(host) || host.includes(':')) fail(400, 'bad_host', 'Passkeys do not work on an IP address. Use http://localhost or https://birdbird.eu.');
  const rpId = (host === fixed || host.endsWith('.' + fixed)) ? fixed : host;
  return { rpId, origin: url.origin, rpName: 'Birdbird' };
}

function deviceLabel(ua) {
  ua = String(ua || '');
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) || /CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? os + ' · ' + br : os;
}

const hex = u => [...u].map(b => b.toString(16).padStart(2, '0')).join('');
const hashToken = async t => hex(await sha256('bb-session:' + t));

/* ---------- rate limits ---------- */
async function limit(c, bucket, who) {
  const [max, win] = LIMITS[bucket];
  const key = bucket + ':' + hex(await sha256(bucket + '|' + who)).slice(0, 32);
  const now = c.now;
  const row = await c.db.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start <= ?3 THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start <= ?3 THEN ?2 ELSE rate_limits.window_start END
     RETURNING count, window_start`).bind(key, now, now - win * 1000).first();
  if (row && row.count > max) {
    const wait = Math.max(1, Math.ceil((row.window_start + win * 1000 - now) / 1000));
    fail(429, 'rate_limited', `Too many attempts. Wait ${wait > 90 ? Math.ceil(wait / 60) + ' minutes' : wait + ' seconds'} and try again.`, { retryAfter: wait });
  }
}
const ipOf = req => req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'local';

function housekeeping(c) {
  if (c.deps.random() > 0.05) return;
  const now = c.now;
  const p = c.db.batch([
    c.db.prepare('DELETE FROM challenges WHERE expires_at < ?1').bind(now),
    c.db.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(now),
    c.db.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - DAY)
  ]).catch(() => {});
  if (c.waitUntil) c.waitUntil(p);
}

/* ---------- sessions ---------- */
async function getSession(c) {
  if (c._session !== undefined) return c._session;
  const tok = readCookie(c.request, COOKIE);
  c._session = null;
  if (!tok || !/^[A-Za-z0-9_-]{43}$/.test(tok)) return null;
  const h = await hashToken(tok);
  const row = await c.db.prepare(
    `SELECT s.id_hash, s.user_id, s.expires_at, s.last_seen_at, s.via, u.name, u.created_at AS user_created, u.recovery_created_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?1 AND s.expires_at > ?2`).bind(h, c.now).first();
  if (!row) return null;
  if (c.now - row.last_seen_at > DAY) {
    await c.db.prepare('UPDATE sessions SET last_seen_at = ?1, expires_at = ?2 WHERE id_hash = ?3').bind(c.now, c.now + SESSION_MS, h).run();
    c.setCookie = cookieHeader(tok, SESSION_MS / 1000);
  }
  c._session = row;
  return row;
}
async function requireSession(c) {
  const s = await getSession(c);
  if (!s) fail(401, 'signed_out', 'You are signed out. Sign in with your passkey and try again.');
  return s;
}
/* new session id on every sign-in; the old one (if any) is deleted */
async function newSessionStmts(c, userId, via) {
  const tok = b64u(randomBytes(32));
  const h = await hashToken(tok);
  const stmts = [c.db.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at, last_seen_at, via, device) VALUES (?1, ?2, ?3, ?4, ?3, ?5, ?6)')
    .bind(h, userId, c.now, c.now + SESSION_MS, via, deviceLabel(c.request.headers.get('user-agent')))];
  const old = readCookie(c.request, COOKIE);
  if (old && /^[A-Za-z0-9_-]{43}$/.test(old)) stmts.push(c.db.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await hashToken(old)));
  c.setCookie = cookieHeader(tok, SESSION_MS / 1000);
  return stmts;
}

/* ---------- recovery code ---------- */
const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function makeRecoveryCode() {
  const r = randomBytes(20); // 20 symbols x 5 bits = 100 bits
  let s = '';
  for (let i = 0; i < 20; i++) s += CROCK[r[i] & 31];
  return s.match(/.{5}/g).join('-');
}
export function normaliseRecovery(code) {
  return String(code || '').toUpperCase().replace(/[\s_-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}
export async function hashRecovery(code) { return hex(await sha256('bb-recovery:' + normaliseRecovery(code))); }

/* ---------- WebAuthn ceremonies ---------- */
async function newChallenge(c, kind, userId, data) {
  const ch = b64u(randomBytes(32));
  await c.db.prepare('INSERT INTO challenges (challenge, kind, user_id, data, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(ch, kind, userId || null, data ? JSON.stringify(data) : null, c.now + CHALLENGE_MS).run();
  return ch;
}
async function takeChallenge(c, cred, kind) {
  const ch = cred && cred.response ? peekChallenge(cred.response.clientDataJSON) : null;
  if (!ch) fail(400, 'bad_request', 'The passkey response was incomplete. Try again.');
  const row = await c.db.prepare('DELETE FROM challenges WHERE challenge = ?1 AND kind = ?2 RETURNING user_id, data, expires_at').bind(ch, kind).first();
  if (!row || row.expires_at < c.now) fail(400, 'expired', 'That passkey request has expired or was already used. Start again.');
  return { challenge: ch, userId: row.user_id, data: row.data ? JSON.parse(row.data) : {} };
}
const credJson = x => x && typeof x === 'object' ? x : null;
const cleanName = n => { const s = String(n == null ? '' : n).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 60); return s || null; };

async function registerOptions(c) {
  const body = await readJson(c.request, false);
  const rp = rpFor(c.url, c.env);
  await limit(c, 'reg', ipOf(c.request));
  const s = await getSession(c);
  let userId, userName, display, exclude = [];
  if (s) { // add a passkey to the signed-in account
    userId = s.user_id;
    display = s.name || 'Birdbird pilot';
    const r = await c.db.prepare('SELECT id, transports FROM credentials WHERE user_id = ?1').bind(userId).all();
    exclude = (r.results || []).map(x => ({ type: 'public-key', id: x.id, transports: x.transports ? JSON.parse(x.transports) : undefined }));
  } else {
    userId = b64u(randomBytes(16));
    display = cleanName(body.name) || 'Birdbird pilot';
  }
  userName = display + ' · Birdbird';
  const challenge = await newChallenge(c, 'reg', userId, s ? { addTo: userId } : { newUser: true, name: cleanName(body.name) });
  housekeeping(c);
  return json({
    ok: true, mode: s ? 'add' : 'new',
    options: {
      challenge, rp: { id: rp.rpId, name: rp.rpName },
      user: { id: userId, name: userName, displayName: display },
      pubKeyCredParams: [{ type: 'public-key', alg: COSE_ES256 }, { type: 'public-key', alg: COSE_RS256 }],
      timeout: CHALLENGE_MS, attestation: 'none',
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      excludeCredentials: exclude,
      hints: ['client-device', 'hybrid']
    }
  }, 200, { 'set-cookie': c.setCookie });
}

async function registerVerify(c) {
  const body = await readJson(c.request, true);
  const cred = credJson(body.credential);
  const rp = rpFor(c.url, c.env);
  await limit(c, 'reg', ipOf(c.request));
  const ch = await takeChallenge(c, cred, 'reg');
  const s = await getSession(c);
  if (ch.data.addTo && (!s || s.user_id !== ch.data.addTo)) fail(401, 'signed_out', 'You were signed out while adding the passkey. Sign in and try again.');
  const v = await verifyRegistration(cred, { challenge: ch.challenge, origin: rp.origin, rpId: rp.rpId, requireUV: true });
  const exists = await c.db.prepare('SELECT user_id FROM credentials WHERE id = ?1').bind(v.credentialId).first();
  if (exists) fail(409, 'exists', 'This passkey is already linked to a Birdbird account. Use “Sign in” instead.');
  const userId = ch.userId;
  const label = deviceLabel(c.request.headers.get('user-agent'));
  const stmts = [];
  let recoveryCode = null;
  if (ch.data.newUser) {
    recoveryCode = makeRecoveryCode();
    stmts.push(c.db.prepare('INSERT INTO users (id, name, recovery_hash, recovery_created_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4, ?4)')
      .bind(userId, ch.data.name || null, await hashRecovery(recoveryCode), c.now));
  }
  stmts.push(c.db.prepare(`INSERT INTO credentials (id, user_id, public_key, alg, sign_count, transports, name, aaguid, backup_eligible, backed_up, created_at, last_used_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`)
    .bind(v.credentialId, userId, JSON.stringify(v.jwk), v.alg, v.signCount, JSON.stringify(v.transports), label, v.aaguid, v.backupEligible ? 1 : 0, v.backedUp ? 1 : 0, c.now));
  if (ch.data.newUser) stmts.push(...await newSessionStmts(c, userId, 'signup'));
  await c.db.batch(stmts);
  return json({ ok: true, created: !!ch.data.newUser, user: { id: userId, name: ch.data.name || (s && s.name) || null }, credential: { id: v.credentialId, name: label, synced: v.backupEligible }, recoveryCode },
    200, { 'set-cookie': c.setCookie });
}

async function loginOptions(c) {
  await readJson(c.request, false);
  const rp = rpFor(c.url, c.env);
  await limit(c, 'login', ipOf(c.request));
  const challenge = await newChallenge(c, 'auth', null, null);
  housekeeping(c);
  return json({ ok: true, options: { challenge, rpId: rp.rpId, timeout: CHALLENGE_MS, userVerification: 'required', allowCredentials: [], hints: ['client-device', 'hybrid'] } });
}

async function loginVerify(c) {
  const body = await readJson(c.request, true);
  const cred = credJson(body.credential);
  const rp = rpFor(c.url, c.env);
  await limit(c, 'login', ipOf(c.request));
  const ch = await takeChallenge(c, cred, 'auth');
  const id = cred && typeof cred.id === 'string' ? cred.id : '';
  const row = id ? await c.db.prepare('SELECT c.id, c.user_id, c.public_key, c.alg, c.sign_count, u.name FROM credentials c JOIN users u ON u.id = c.user_id WHERE c.id = ?1').bind(id).first() : null;
  if (!row) fail(400, 'unknown_passkey', 'This passkey is not linked to a Birdbird account any more. Sign in with your recovery code, or create a new account. You can delete the old passkey in your device’s password settings.');
  if (cred.response.userHandle && cred.response.userHandle !== row.user_id) fail(400, 'unknown_passkey', 'This passkey belongs to a different account. Try again and pick the right passkey.');
  const v = await verifyAuthentication(cred, { challenge: ch.challenge, origin: rp.origin, rpId: rp.rpId, requireUV: true }, { jwk: JSON.parse(row.public_key), alg: row.alg, signCount: row.sign_count });
  await c.db.batch([
    c.db.prepare('UPDATE credentials SET sign_count = ?1, last_used_at = ?2, backed_up = ?3 WHERE id = ?4').bind(v.signCount, c.now, v.backedUp ? 1 : 0, row.id),
    ...await newSessionStmts(c, row.user_id, 'passkey')
  ]);
  return json({ ok: true, user: { id: row.user_id, name: row.name || null } }, 200, { 'set-cookie': c.setCookie });
}

async function recovery(c) {
  const body = await readJson(c.request, true);
  await limit(c, 'recovery', ipOf(c.request));
  const norm = normaliseRecovery(body.code);
  if (!/^[0-9A-Z]{20}$/.test(norm)) fail(400, 'bad_code', 'A recovery code has 20 letters and digits, like ABCDE-12345-FGHJK-67890. Check it and try again.');
  const u = await c.db.prepare('SELECT id, name FROM users WHERE recovery_hash = ?1').bind(await hashRecovery(norm)).first();
  if (!u) fail(400, 'bad_code', 'That recovery code does not match an account. Check for typos, or use the newest code if you have made a new one.');
  const fresh = makeRecoveryCode();
  const n = await c.db.prepare('SELECT COUNT(*) AS n FROM credentials WHERE user_id = ?1').bind(u.id).first();
  await c.db.batch([
    c.db.prepare('UPDATE users SET recovery_hash = ?1, recovery_created_at = ?2, updated_at = ?2 WHERE id = ?3').bind(await hashRecovery(fresh), c.now, u.id),
    ...await newSessionStmts(c, u.id, 'recovery')
  ]);
  return json({ ok: true, user: { id: u.id, name: u.name || null }, recoveryCode: fresh, passkeys: n ? n.n : 0 }, 200, { 'set-cookie': c.setCookie });
}

async function logout(c) {
  await readJson(c.request, false);
  const tok = readCookie(c.request, COOKIE);
  if (tok && /^[A-Za-z0-9_-]{43}$/.test(tok)) await c.db.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await hashToken(tok)).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });
}

/* ---------- account ---------- */
async function meGet(c) {
  const s = await getSession(c);
  if (!s) return json({ ok: true, user: null }); // signed out is a normal answer here (no 401 noise in the console)
  const [creds, data] = await Promise.all([
    c.db.prepare('SELECT id, name, created_at, last_used_at, backup_eligible, transports FROM credentials WHERE user_id = ?1 ORDER BY created_at').bind(s.user_id).all(),
    c.db.prepare('SELECT ns, version, updated_at, LENGTH(data) AS bytes FROM user_data WHERE user_id = ?1').bind(s.user_id).all()
  ]);
  return json({
    ok: true,
    user: { id: s.user_id, name: s.name || null, created: s.user_created, signedInWith: s.via || null },
    recovery: { created: s.recovery_created_at || null },
    credentials: (creds.results || []).map(x => ({ id: x.id, name: x.name, created: x.created_at, lastUsed: x.last_used_at, synced: !!x.backup_eligible })),
    data: (data.results || []).map(x => ({ ns: x.ns, version: x.version, updatedAt: x.updated_at, bytes: x.bytes }))
  }, 200, { 'set-cookie': c.setCookie });
}
async function mePatch(c) {
  const s = await requireSession(c);
  await limit(c, 'write', s.user_id);
  const body = await readJson(c.request, true);
  const name = cleanName(body.name);
  await c.db.prepare('UPDATE users SET name = ?1, updated_at = ?2 WHERE id = ?3').bind(name, c.now, s.user_id).run();
  return json({ ok: true, user: { id: s.user_id, name } }, 200, { 'set-cookie': c.setCookie });
}
async function meDelete(c) {
  const s = await requireSession(c);
  const body = await readJson(c.request, true);
  if (body.confirm !== 'delete') fail(400, 'confirm', 'Confirm that you want to delete the account.');
  const id = s.user_id;
  await c.db.batch([
    c.db.prepare('DELETE FROM user_data WHERE user_id = ?1').bind(id),
    c.db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(id),
    c.db.prepare('DELETE FROM credentials WHERE user_id = ?1').bind(id),
    c.db.prepare('DELETE FROM challenges WHERE user_id = ?1').bind(id),
    c.db.prepare('DELETE FROM users WHERE id = ?1').bind(id)
  ]);
  return json({ ok: true, deleted: true }, 200, { 'set-cookie': cookieHeader('', 0) });
}
async function newRecovery(c) {
  const s = await requireSession(c);
  await limit(c, 'write', s.user_id);
  await readJson(c.request, false);
  const code = makeRecoveryCode();
  await c.db.prepare('UPDATE users SET recovery_hash = ?1, recovery_created_at = ?2, updated_at = ?2 WHERE id = ?3').bind(await hashRecovery(code), c.now, s.user_id).run();
  return json({ ok: true, recoveryCode: code, created: c.now }, 200, { 'set-cookie': c.setCookie });
}
async function credDelete(c) {
  const s = await requireSession(c);
  await limit(c, 'write', s.user_id);
  const id = c.url.searchParams.get('id') || '';
  const all = await c.db.prepare('SELECT id FROM credentials WHERE user_id = ?1').bind(s.user_id).all();
  const list = (all.results || []).map(x => x.id);
  if (!list.includes(id)) fail(404, 'not_found', 'That passkey is not on your account. Reload the page to see the current list.');
  if (list.length < 2) fail(409, 'last_passkey', 'This is your only passkey. Add a passkey on another device first, then remove this one.');
  await c.db.prepare('DELETE FROM credentials WHERE id = ?1 AND user_id = ?2').bind(id, s.user_id).run();
  return json({ ok: true, removed: id }, 200, { 'set-cookie': c.setCookie });
}

/* ---------- sync ---------- */
async function syncGet(c) {
  const s = await requireSession(c);
  await limit(c, 'sync', s.user_id);
  const r = await c.db.prepare('SELECT ns, data, version, updated_at FROM user_data WHERE user_id = ?1').bind(s.user_id).all();
  const ns = {};
  for (const x of r.results || []) { let d = {}; try { d = JSON.parse(x.data); } catch (e) {} ns[x.ns] = { data: d, version: x.version, updatedAt: x.updated_at }; }
  return json({ ok: true, ns, serverTime: c.now }, 200, { 'set-cookie': c.setCookie });
}
async function syncPut(c) {
  const s = await requireSession(c);
  await limit(c, 'sync', s.user_id);
  const body = await readJson(c.request, true);
  const ns = body.ns;
  if (!NAMESPACES.includes(ns)) fail(400, 'bad_ns', 'Unknown data group. Reload the page to get the latest Birdbird.');
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) fail(400, 'bad_request', 'Nothing to save.');
  const text = JSON.stringify(body.data);
  if (new TextEncoder().encode(text).length > MAX_NS_BYTES) fail(413, 'too_large', 'This data is over 1.5 MB, too large to sync. Delete old briefing packs or routes, then try again.');
  const base = Number.isInteger(body.baseVersion) ? body.baseVersion : 0;
  let at = Number(body.updatedAt) || c.now;
  at = Math.min(at, c.now + 5 * 60e3); // a fast device clock cannot win every conflict forever
  let res;
  if (body.force === true) {
    res = await c.db.prepare(`INSERT INTO user_data (user_id, ns, data, version, updated_at, stored_at) VALUES (?1, ?2, ?3, 1, ?4, ?5)
       ON CONFLICT(user_id, ns) DO UPDATE SET data = excluded.data, version = user_data.version + 1, updated_at = excluded.updated_at, stored_at = excluded.stored_at
       RETURNING version, updated_at`).bind(s.user_id, ns, text, at, c.now).first();
  } else if (base === 0) {
    res = await c.db.prepare(`INSERT INTO user_data (user_id, ns, data, version, updated_at, stored_at) VALUES (?1, ?2, ?3, 1, ?4, ?5)
       ON CONFLICT(user_id, ns) DO NOTHING RETURNING version, updated_at`).bind(s.user_id, ns, text, at, c.now).first();
  } else {
    res = await c.db.prepare(`UPDATE user_data SET data = ?1, version = version + 1, updated_at = ?2, stored_at = ?3
       WHERE user_id = ?4 AND ns = ?5 AND version = ?6 RETURNING version, updated_at`).bind(text, at, c.now, s.user_id, ns, base).first();
  }
  if (!res) {
    const cur = await c.db.prepare('SELECT data, version, updated_at FROM user_data WHERE user_id = ?1 AND ns = ?2').bind(s.user_id, ns).first();
    let d = {}; try { d = cur ? JSON.parse(cur.data) : {}; } catch (e) {}
    return json({ ok: false, error: 'conflict', message: 'Another device saved newer data. Birdbird will merge and try again.', current: cur ? { data: d, version: cur.version, updatedAt: cur.updated_at } : { data: {}, version: 0, updatedAt: 0 } }, 409, { 'set-cookie': c.setCookie });
  }
  return json({ ok: true, ns, version: res.version, updatedAt: res.updated_at }, 200, { 'set-cookie': c.setCookie });
}

/* ---------- endpoint wrapper ---------- */
export function endpoint(methods, deps) {
  return async function onRequest(ctx) {
    const request = ctx.request, env = ctx.env || {};
    const d = Object.assign({ now: () => Date.now(), random: Math.random }, deps || {});
    try {
      const h = methods[request.method];
      if (!h) return json({ ok: false, error: 'method', message: 'Use ' + Object.keys(methods).join(' or ') + '.' }, 405, { allow: Object.keys(methods).join(', ') });
      if (!env.DB) return json({ ok: false, error: 'no_db', message: 'Accounts are not switched on for this site yet. Everything still works and is saved in this browser.' }, 503);
      checkOrigin(request);
      const c = { request, env, db: env.DB, url: new URL(request.url), now: d.now(), deps: d, waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null, setCookie: null };
      return await h(c);
    } catch (e) {
      if (e instanceof HttpError) {
        const extra = e.extra || {};
        return json(Object.assign({ ok: false, error: e.code, message: e.message }, extra), e.status, extra.retryAfter ? { 'retry-after': String(extra.retryAfter) } : null);
      }
      if (e instanceof WAError) return json({ ok: false, error: e.code, message: e.message + ' Try again, or use another passkey.' }, 400);
      console.error('birdbird api error', e && e.stack || e);
      return json({ ok: false, error: 'server', message: 'Something went wrong on our side. Your data is still saved in this browser. Try again in a minute.' }, 500);
    }
  };
}

export const handlers = { registerOptions, registerVerify, loginOptions, loginVerify, recovery, logout, meGet, mePatch, meDelete, newRecovery, credDelete, syncGet, syncPut };
export const onRegisterOptions = endpoint({ POST: registerOptions });
export const onRegisterVerify = endpoint({ POST: registerVerify });
export const onLoginOptions = endpoint({ POST: loginOptions });
export const onLoginVerify = endpoint({ POST: loginVerify });
export const onRecovery = endpoint({ POST: recovery });
export const onLogout = endpoint({ POST: logout });
export const onMe = endpoint({ GET: meGet, PATCH: mePatch, DELETE: meDelete });
export const onMeRecovery = endpoint({ POST: newRecovery });
export const onMeCredentials = endpoint({ DELETE: credDelete });
export const onSync = endpoint({ GET: syncGet, PUT: syncPut });
export const _test = { deviceLabel, hashToken, LIMITS, NAMESPACES, unb64u };
