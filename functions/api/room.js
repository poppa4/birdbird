/* Birdbird – Cloudflare Pages Function: live rooms for the flow trainer (flows.html, flowsroom.js). No account needed.
   Two pilots on two devices practise one flow together: the host opens a room with the flow (never a photo), the partner joins
   with the room code or link, each picks a role (PF/PM, CM1/CM2). Their taps and checklist calls are relayed through here,
   or straight between the browsers (WebRTC) once they have found each other through the 'sig' messages below.

   POST /api/room  { op:'create', flow, name, role }          -> { ok, code, me, seq:0 }
                   { op:'join', code, name, role }             -> { ok, code, me, flow, members, seq }
                   { op:'send', code, me, ev:{ t, … } }        -> { ok, seq }
                   { op:'leave', code, me }                    -> { ok }
   GET  /api/room?c=CODE&me=ID&since=N                         -> { ok, seq, ev:[{ seq, from, … }], members:[{ id, name, role, on }] }
   errors { ok:false, error, message }: 400 bad_request · 403 bad_origin / not_member · 404 no_room · 409 full · 413 too_large
                                        429 rate_limited · 503 no_db

   Storage (D1, binding DB; tables made here on first use, also in migrations/0004_rooms.sql):
     rooms(code, flow, created, touched, seq, members)   members: JSON [{ id, name, role, seen }]; id is a 128-bit secret
     room_events(code, seq, sender, body, t)
   A room and its messages are deleted 6 hours after the last message. Message bodies are limited to 4 kB, flows to 200 kB.
   Writes are kept low for the free plan: polling reads only; a member's "seen" time is written at most every 20 s. */
import { json, checkOrigin } from '../_lib/api.js';

const ROOM_TTL = 6 * 3600e3, SEEN_EVERY = 20e3, ONLINE = 45e3, MAX_FLOW = 200000, MAX_EV = 4000, KEEP_EV = 400, MAX_MEMBERS = 4;
const W1 = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliett', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu', 'amber', 'cobalt', 'falcon', 'harbor', 'jet', 'nimbus'];
const W2 = ['beacon', 'runway', 'vector', 'pitot', 'aileron', 'rudder', 'flap', 'spoiler', 'compass', 'glide', 'hangar', 'taxiway', 'apron', 'tower', 'radar', 'altimeter', 'heading', 'squawk', 'ridge', 'cirrus', 'stratus', 'cumulus', 'mach', 'throttle', 'mixture', 'prop', 'turbine', 'nacelle', 'wingtip', 'cockpit', 'ramp', 'marker'];
const EV_TYPES = new Set(['hello', 'start', 'tap', 'step', 'call', 'end', 'reset', 'sig', 'role', 'msg']);
const schemaOk = new WeakMap();   // per database binding: made once per isolate
async function schema(db) {
  if (schemaOk.has(db)) return schemaOk.get(db);
  const p = db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, flow TEXT NOT NULL, created INTEGER NOT NULL, touched INTEGER NOT NULL, seq INTEGER NOT NULL DEFAULT 0, members TEXT NOT NULL DEFAULT \'[]\')'),
    db.prepare('CREATE TABLE IF NOT EXISTS room_events (code TEXT NOT NULL, seq INTEGER NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (code, seq))'),
    db.prepare('CREATE INDEX IF NOT EXISTS rooms_touched ON rooms (touched)')
  ]).catch(e => { schemaOk.delete(db); throw e; });
  schemaOk.set(db, p); return p;
}
class Err extends Error { constructor(s, c, m) { super(m); this.s = s; this.c = c; } }
const bad = (s, c, m) => { throw new Err(s, c, m); };
const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
const hexOf = a => [...a].map(b => b.toString(16).padStart(2, '0')).join('');
export function makeCode(bytes) { const b = bytes || rnd(4); return `${W1[b[0] % 32]}-${W2[b[1] % 32]}-${String(((b[2] << 8) | b[3]) % 10000).padStart(4, '0')}`; }
export const normCode = s => String(s || '').toLowerCase().trim().replace(/^.*[#?&](room|c)=/, '').replace(/[^a-z0-9-]/g, '').slice(0, 40);
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || 'Pilot';
const cleanRole = s => String(s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'PF';
async function body(request, max) { const t = await request.text(); if (t.length > max) bad(413, 'too_large', 'That flow is too large to share in a room.');
  try { const o = JSON.parse(t); if (!o || typeof o !== 'object') throw 0; return o; } catch (e) { bad(400, 'bad_request', 'The request was not valid JSON. Reload the page and try again.'); } }
async function room(db, code) { const r = await db.prepare('SELECT code, flow, seq, touched, members FROM rooms WHERE code = ?1').bind(code).first();
  if (!r) bad(404, 'no_room', 'There is no room with that code. Check the code, or ask your partner to open a new room.'); r.m = JSON.parse(r.members || '[]'); return r; }
const pub = (m, now) => m.map(x => ({ id: x.id.slice(0, 8), name: x.name, role: x.role, on: now - x.seen < ONLINE }));
async function cleanup(db, now) { const old = now - ROOM_TTL;
  await db.batch([db.prepare('DELETE FROM room_events WHERE code IN (SELECT code FROM rooms WHERE touched < ?1)').bind(old), db.prepare('DELETE FROM rooms WHERE touched < ?1').bind(old)]); }

export async function handleRoom(request, env, deps) {
  const now = (deps && deps.now) ? deps.now() : Date.now(), random = (deps && deps.random) || rnd;
  try {
    const db = env && env.DB; if (!db) bad(503, 'no_db', 'Live rooms are not switched on for this site yet. You can still practise on your own.');
    await schema(db);
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const code = normCode(url.searchParams.get('c')), me = String(url.searchParams.get('me') || '').slice(0, 64), since = Math.max(0, parseInt(url.searchParams.get('since'), 10) || 0);
      const r = await room(db, code), m = r.m.find(x => x.id === me); if (!m) bad(403, 'not_member', 'You are not in this room any more. Join it again.');
      const ev = r.seq > since ? (await db.prepare('SELECT seq, sender, body FROM room_events WHERE code = ?1 AND seq > ?2 ORDER BY seq LIMIT 200').bind(code, since).all()).results : [];
      if (now - m.seen > SEEN_EVERY) { m.seen = now; await db.prepare('UPDATE rooms SET members = ?2 WHERE code = ?1').bind(code, JSON.stringify(r.m)).run(); }
      const mine = me.slice(0, 8);
      return json({ ok: true, seq: r.seq, members: pub(r.m, now), ev: ev.map(e => Object.assign(JSON.parse(e.body), { seq: e.seq, from: e.sender })).filter(e => e.from !== mine && (!e.to || e.to === mine)) });
    }
    if (request.method !== 'POST') bad(405, 'method', 'Use GET or POST.');
    checkOrigin(request);
    const b = await body(request, MAX_FLOW + 2000);
    if (b.op === 'create') {
      const flow = b.flow; if (!flow || typeof flow !== 'object' || !Array.isArray(flow.steps)) bad(400, 'bad_request', 'No flow to share.');
      const f = JSON.stringify(flow); if (f.length > MAX_FLOW) bad(413, 'too_large', 'That flow is too large to share in a room.');
      if (Math.random() < 0.2) await cleanup(db, now);
      const n = await db.prepare('SELECT COUNT(*) AS n FROM rooms WHERE touched > ?1').bind(now - ROOM_TTL).first('n'); if (n > 5000) bad(429, 'rate_limited', 'Too many rooms are open right now. Try again in a while.');
      const me = hexOf(random(16)); let code = null;
      for (let i = 0; i < 6 && !code; i++) { const c = makeCode(random(4)); const ok = await db.prepare('INSERT OR IGNORE INTO rooms (code, flow, created, touched, seq, members) VALUES (?1, ?2, ?3, ?3, 0, ?4)').bind(c, f, now, JSON.stringify([{ id: me, name: cleanName(b.name), role: cleanRole(b.role), seen: now, host: 1 }])).run(); if (ok.meta.changes) code = c; }
      if (!code) bad(503, 'busy', 'Could not open a room. Try again.');
      return json({ ok: true, code, me, seq: 0 });
    }
    const code = normCode(b.code), r = await room(db, code);
    if (b.op === 'join') {
      let m = b.me && r.m.find(x => x.id === String(b.me)); const me = m ? m.id : hexOf(random(16));
      if (!m) { r.m = r.m.filter(x => now - x.seen < ONLINE * 4 || x.host); if (r.m.length >= MAX_MEMBERS) bad(409, 'full', 'This room is full.'); m = { id: me, name: cleanName(b.name), role: cleanRole(b.role), seen: now }; r.m.push(m); }
      else { m.name = cleanName(b.name || m.name); m.role = cleanRole(b.role || m.role); m.seen = now; }
      await db.prepare('UPDATE rooms SET members = ?2, touched = ?3 WHERE code = ?1').bind(code, JSON.stringify(r.m), now).run();
      return json({ ok: true, code, me, flow: JSON.parse(r.flow), members: pub(r.m, now), seq: r.seq });
    }
    const m = r.m.find(x => x.id === String(b.me || '')); if (!m) bad(403, 'not_member', 'You are not in this room any more. Join it again.');
    if (b.op === 'leave') { r.m = r.m.filter(x => x !== m); await db.prepare('UPDATE rooms SET members = ?2 WHERE code = ?1').bind(code, JSON.stringify(r.m)).run(); return json({ ok: true }); }
    if (b.op === 'send') {
      const ev = b.ev; if (!ev || typeof ev !== 'object' || !EV_TYPES.has(ev.t)) bad(400, 'bad_request', 'Unknown message.');
      const s = JSON.stringify(ev); if (s.length > MAX_EV) bad(413, 'too_large', 'That message is too large.');
      if (ev.t === 'role') { m.role = cleanRole(ev.role); }
      m.seen = now;
      const row = await db.prepare('UPDATE rooms SET seq = seq + 1, touched = ?2, members = ?3 WHERE code = ?1 RETURNING seq').bind(code, now, JSON.stringify(r.m)).first();
      await db.batch([db.prepare('INSERT INTO room_events (code, seq, sender, body, t) VALUES (?1, ?2, ?3, ?4, ?5)').bind(code, row.seq, m.id.slice(0, 8), s, now),
        db.prepare('DELETE FROM room_events WHERE code = ?1 AND seq <= ?2').bind(code, row.seq - KEEP_EV)]);
      return json({ ok: true, seq: row.seq });
    }
    bad(400, 'bad_request', 'Unknown request.');
  } catch (e) {
    if (e instanceof Err) return json({ ok: false, error: e.c, message: e.message }, e.s);
    if (e && e.status && e.code) return json({ ok: false, error: e.code, message: e.message }, e.status);   // checkOrigin
    console.error('room error', e && e.stack || e);
    return json({ ok: false, error: 'server', message: 'Something went wrong on our side. Try again in a moment.' }, 500);
  }
}
export const onRequest = ctx => handleRoom(ctx.request, ctx.env, null);
