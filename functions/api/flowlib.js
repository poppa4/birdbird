/* NORDAP – Cloudflare Pages Function: the shared flow library (flow trainer, flows.js).
   Pilots publish a flow drawn on one of NORDAP's own cockpits so others can open a copy. No account needed.
   Only flows on NORDAP cockpits can be published: a flow on a private photo is of no use without the photo, and photos are never shared.
   Nothing here is checked by NORDAP; the page says so. Texts with links are refused. Anyone can report a flow; a flow reported
   from three different connections is hidden. The publisher gets a key to delete their flow; ADMIN_KEY (a Pages secret) deletes any.

   GET    /api/flowlib?ac=a320&phase=bst      -> { ok, flows:[{ id, name, ac, phase, by, n, roles, t, uses }] }   (newest 200; both filters optional)
   GET    /api/flowlib?id=…                   -> { ok, flow }                 counts one use
   POST   /api/flowlib  { flow, by?, rights:true }   -> { ok, id, key }       5 a day per connection
   POST   /api/flowlib  { report:id }         -> { ok }
   DELETE /api/flowlib?id=…&key=…             -> { ok }                       key: the publisher's key, or ADMIN_KEY
   errors { ok:false, error, message }: 400 bad_request · 403 bad_origin/forbidden · 404 not_found · 413 too_large · 429 rate_limited · 503 no_db

   Storage (D1, binding DB; made here on first use, also in migrations/0006_flowlib.sql):
     flow_lib(id, t, ac, phase, name, by, n, roles, body, ipk, keyh, uses, reports, hidden)
     flow_lib_reports(id, ipk)      one report per connection per flow; ipk is a SHA-256 of the IP and a fixed word */
import { json, checkOrigin } from '../_lib/api.js';

export const PHASES = ['pre', 'bst', 'ast', 'taxi', 'bto', 'clb', 'crz', 'des', 'app', 'ldg', 'aldg', 'shut', 'abn'];
const MAX_BODY = 80000, PER_DAY = 5, HIDE_AT = 3, ROLESETS = { pfpm: ['PF', 'PM'], cm: ['CM1', 'CM2'], one: ['P'] };
const schemaOk = new WeakMap();
async function schema(db) {
  if (schemaOk.has(db)) return schemaOk.get(db);
  const p = db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS flow_lib (id TEXT PRIMARY KEY, t INTEGER NOT NULL, ac TEXT NOT NULL, phase TEXT NOT NULL DEFAULT \'\', name TEXT NOT NULL, by TEXT NOT NULL DEFAULT \'\', n INTEGER NOT NULL, roles TEXT NOT NULL, body TEXT NOT NULL, ipk TEXT NOT NULL, keyh TEXT NOT NULL, uses INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS flow_lib_ac ON flow_lib (hidden, ac, t)'),
    db.prepare('CREATE INDEX IF NOT EXISTS flow_lib_ipk ON flow_lib (ipk, t)'),
    db.prepare('CREATE TABLE IF NOT EXISTS flow_lib_reports (id TEXT NOT NULL, ipk TEXT NOT NULL, PRIMARY KEY (id, ipk))')
  ]).catch(e => { schemaOk.delete(db); throw e; });
  schemaOk.set(db, p); return p;
}
class Err extends Error { constructor(s, c, m) { super(m); this.s = s; this.c = c; } }
const bad = (s, c, m) => { throw new Err(s, c, m); };
const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');
const LINK = /https?:|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|cn|xyz|top|info|biz|shop|link)\b/i;
function txt(v, n) { const s = String(v == null ? '' : v).replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); if (LINK.test(s)) bad(400, 'bad_request', 'Links are not allowed in a shared flow. Remove them and try again.'); return s; }
const num = v => Number.isFinite(+v) && Math.abs(+v) < 20000 ? Math.round(+v * 10) / 10 : null;
const sid = v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);

/* a flow as it may be stored: only the fields the trainer knows, texts without links (the page escapes all text it shows) */
export function cleanFlow(o) {
  if (!o || typeof o !== 'object') bad(400, 'bad_request', 'There is no flow to share.');
  const ac = String(o.ac || ''); if (!/^[a-z0-9]{2,12}$/.test(ac) || ac === 'img' || ac === 'own') bad(400, 'bad_request', 'Only flows on a NORDAP cockpit can be shared. A flow on your own picture stays with you.');
  const rs = ROLESETS[o.rs] ? o.rs : 'pfpm', roles = Array.isArray(o.roles) && o.roles.length && o.roles.length <= 2 ? o.roles.map(r => String(r).replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'P') : ROLESETS[rs];
  const name = txt(o.name, 80); if (name.length < 3) bad(400, 'bad_request', 'Give the flow a name before you share it.');
  const steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, 300).map(s => { const st = { id: sid(s && s.id) || rnd(5), r: roles.includes(s && s.r) ? s.r : roles[0], k: ['act', 'call', 'event'].includes(s && s.k) ? s.k : 'act', t: txt(s && s.t, 160), x: s && s.x != null ? num(s.x) : null, y: s && s.y != null ? num(s.y) : null };
    if (s && s.b) st.b = txt(s.b, 6); if (s && s.tg) st.tg = String(s.tg).replace(/[\u0000-\u001F<>]/g, '').slice(0, 80); if (s && s.after) st.after = sid(s.after); if (s && s.n) st.n = txt(s.n, 400); return st; });
  if (steps.filter(s => s.k === 'act' && s.x != null && s.y != null).length < 3) bad(400, 'bad_request', 'A shared flow needs at least three steps placed on the cockpit.');
  const notes = (Array.isArray(o.notes) ? o.notes : []).slice(0, 40).map(n => ({ id: sid(n && n.id) || rnd(5), x: num(n && n.x), y: num(n && n.y), t: txt(n && n.t, 400) })).filter(n => n.x != null && n.y != null && n.t);
  const col = {}, C = ['#3CCB7F', '#F2C230']; roles.forEach((r, i) => { const v = o.style && o.style.col && o.style.col[r]; col[r] = /^#[0-9a-f]{6}$/i.test(v || '') ? v : C[i]; });
  const f = { v: 1, name, ac, roles, rs, style: { col, lw: Math.min(8, Math.max(1, +(o.style && o.style.lw) || 3)), ls: Math.min(2, Math.max(0.6, +(o.style && o.style.ls) || 1)) }, steps, notes };
  if (PHASES.includes(o.phase)) f.phase = o.phase;
  return f;
}
const ipKey = req => hex('bb-flowlib:' + (req.headers.get('cf-connecting-ip') || 'local'));

export async function handleFlowlib(request, env, deps) {
  const now = (deps && deps.now) ? deps.now() : Date.now(), url = new URL(request.url), m = request.method;
  try {
    checkOrigin(request);
    const db = env && env.DB; if (!db) bad(503, 'no_db', 'The flow library is not available right now. Try again later.');
    await schema(db);
    if (m === 'GET') {
      const id = url.searchParams.get('id');
      if (id) { const r = await db.prepare('SELECT id, body, by, t FROM flow_lib WHERE id = ?1 AND hidden = 0').bind(sid(id)).first(); if (!r) bad(404, 'not_found', 'That flow is no longer in the library.');
        await db.prepare('UPDATE flow_lib SET uses = uses + 1 WHERE id = ?1').bind(r.id).run(); return json({ ok: true, flow: JSON.parse(r.body), by: r.by, t: r.t }); }
      const ac = url.searchParams.get('ac') || '', ph = url.searchParams.get('phase') || '';
      const rows = await db.prepare('SELECT id, name, ac, phase, by, n, roles, t, uses FROM flow_lib WHERE hidden = 0 ORDER BY t DESC LIMIT 400').all();
      const flows = (rows.results || []).filter(r => (!ac || r.ac === ac) && (!ph || r.phase === ph)).slice(0, 200).map(r => ({ id: r.id, name: r.name, ac: r.ac, phase: r.phase, by: r.by, n: r.n, roles: r.roles, t: r.t, uses: r.uses }));
      return json({ ok: true, flows }, 200, { 'cache-control': 'no-store' });
    }
    if (m === 'DELETE') { const id = sid(url.searchParams.get('id')), key = String(url.searchParams.get('key') || ''); const r = await db.prepare('SELECT keyh FROM flow_lib WHERE id = ?1').bind(id).first(); if (!r) bad(404, 'not_found', 'That flow is no longer in the library.');
      if (!key || !((env.ADMIN_KEY && key === env.ADMIN_KEY) || (await hex('bb-flowkey:' + key)) === r.keyh)) bad(403, 'forbidden', 'Only the one who shared the flow can remove it, from the same device.');
      await db.prepare('DELETE FROM flow_lib WHERE id = ?1').bind(id).run(); await db.prepare('DELETE FROM flow_lib_reports WHERE id = ?1').bind(id).run(); return json({ ok: true }); }
    if (m !== 'POST') bad(405, 'bad_request', 'Use GET, POST or DELETE.');
    const text = await request.text(); if (text.length > MAX_BODY) bad(413, 'too_large', 'The flow is too large to share.');
    let b; try { b = JSON.parse(text); } catch (e) { bad(400, 'bad_request', 'The request was not valid. Reload the page and try again.'); }
    if (!b || typeof b !== 'object') bad(400, 'bad_request', 'The request was not valid. Reload the page and try again.');
    const ipk = await ipKey(request);
    if (b.report) { const id = sid(b.report), r = await db.prepare('SELECT id FROM flow_lib WHERE id = ?1').bind(id).first(); if (!r) return json({ ok: true });
      const had = await db.prepare('SELECT id FROM flow_lib_reports WHERE id = ?1 AND ipk = ?2').bind(id, ipk).first();
      if (!had) { await db.prepare('INSERT INTO flow_lib_reports (id, ipk) VALUES (?1, ?2)').bind(id, ipk).run(); const c = await db.prepare('SELECT COUNT(*) AS n FROM flow_lib_reports WHERE id = ?1').bind(id).first(), n = (c && c.n) || 1;
        await db.prepare('UPDATE flow_lib SET reports = ?2, hidden = ?3 WHERE id = ?1').bind(id, n, n >= HIDE_AT ? 1 : 0).run(); }
      return json({ ok: true }); }
    if (b.rights !== true) bad(400, 'bad_request', 'Tick the box first.');
    const f = cleanFlow(b.flow), by = txt(b.by, 30);
    const c = await db.prepare('SELECT COUNT(*) AS n FROM flow_lib WHERE ipk = ?1 AND t > ?2').bind(ipk, now - 864e5).first(); if (c && c.n >= PER_DAY) bad(429, 'rate_limited', 'You have shared several flows today. Try again tomorrow.');
    const id = rnd(8), key = rnd(16);
    await db.prepare('INSERT INTO flow_lib (id, t, ac, phase, name, by, n, roles, body, ipk, keyh, uses, reports, hidden) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, 0, 0)')
      .bind(id, now, f.ac, f.phase || '', f.name, by, f.steps.length, f.roles.join('/'), JSON.stringify(f), ipk, await hex('bb-flowkey:' + key)).run();
    return json({ ok: true, id, key });
  } catch (e) {
    if (e instanceof Err) return json({ ok: false, error: e.c, message: e.message }, e.s);
    if (e && e.status && e.code) return json({ ok: false, error: e.code, message: e.message }, e.status);
    console.error('flowlib error', e && e.stack || e);
    return json({ ok: false, error: 'server', message: 'Something went wrong on our side. Try again in a moment.' }, 500);
  }
}
export const onRequest = ctx => handleFlowlib(ctx.request, ctx.env, null);
