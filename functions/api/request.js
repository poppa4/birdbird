/* Birdbird – Cloudflare Pages Function: "Request your aircraft" (reqplane.js; the simulators and the flow trainer).
   No account needed. A visitor says which aircraft they want, with links and up to three small pictures they have the right
   to share. The request is kept in D1 and sent on by e-mail to the address in REQUEST_TO.

   POST /api/request  { kind:'sim'|'flows', aircraft, variant?, want?, links?, name?, reply?, rights:true, images?:[{ name, data }] }
        -> { ok:true, mailed:true|false }      images: base64 JPEG, each at most 400 kB, three at most
   errors { ok:false, error, message }: 400 bad_request · 403 bad_origin · 413 too_large · 429 rate_limited · 503 no_db

   Settings (Cloudflare Pages → Settings → Variables and secrets); the address is never in the code or sent to the browser:
     REQUEST_TO       where requests are mailed
     RESEND_API_KEY   key for resend.com (free plan: 100 mails a day). With the sender 'onboarding@resend.dev' Resend only
                      delivers to the address the Resend account itself is registered with, so no domain set-up is needed.
     REQUEST_FROM     optional sender, once a domain is verified with Resend, e.g. 'Birdbird <requests@birdbird.eu>'
   Without them the request is still stored; stored requests are mailed as soon as the settings are there (five at a time).

   Storage (D1, binding DB; table made here on first use, also in migrations/0005_requests.sql):
     plane_requests(id, t, kind, body, images, ipk, sent)   body and images: JSON; ipk: SHA-256 of the IP and the day
   At most 5 requests per IP per day. Rows are deleted 90 days after they were mailed. */
import { json, checkOrigin } from '../_lib/api.js';

const MAX_BODY = 1500000, MAX_IMG = 400000 * 4 / 3 + 8, MAX_IMGS = 3, PER_DAY = 5, KEEP_SENT = 90 * 864e5, RESEND = 'https://api.resend.com/emails';
const schemaOk = new WeakMap();
async function schema(db) {
  if (schemaOk.has(db)) return schemaOk.get(db);
  const p = db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS plane_requests (id TEXT PRIMARY KEY, t INTEGER NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, images TEXT NOT NULL DEFAULT \'[]\', ipk TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS plane_requests_ipk ON plane_requests (ipk, t)'),
    db.prepare('CREATE INDEX IF NOT EXISTS plane_requests_sent ON plane_requests (sent, t)')
  ]).catch(e => { schemaOk.delete(db); throw e; });
  schemaOk.set(db, p); return p;
}
class Err extends Error { constructor(s, c, m) { super(m); this.s = s; this.c = c; } }
const bad = (s, c, m) => { throw new Err(s, c, m); };
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);
const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

export function clean(b) {
  const kind = b.kind === 'sim' ? 'sim' : b.kind === 'flows' ? 'flows' : bad(400, 'bad_request', 'Say whether the request is for a simulator or for the flow trainer.');
  const o = { kind, aircraft: str(b.aircraft, 80), variant: str(b.variant, 80), want: str(b.want, 1500), links: str(b.links, 1000), name: str(b.name, 80), reply: str(b.reply, 120) };
  if (o.aircraft.length < 2) bad(400, 'bad_request', 'Write which aircraft you want.');
  if (o.reply && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.reply)) bad(400, 'bad_request', 'That e-mail address does not look right. Correct it or leave it empty.');
  const imgs = Array.isArray(b.images) ? b.images : [];
  if (imgs.length > MAX_IMGS) bad(413, 'too_large', 'Send at most three pictures.');
  if (imgs.length && b.rights !== true) bad(400, 'bad_request', 'Tick the box that says you have the right to share the pictures.');
  const images = imgs.map((im, i) => { const data = String((im && im.data) || '').replace(/^data:image\/jpeg;base64,/, '');
    if (!data || data.length > MAX_IMG || !/^[A-Za-z0-9+/]+=*$/.test(data) || !data.startsWith('/9j/')) bad(413, 'too_large', 'A picture is too large or is not a JPEG. Try a smaller one.');
    return { name: (str(im.name, 60).replace(/[^\w.\- ]/g, '_').replace(/\.[^.]*$/, '') || 'picture-' + (i + 1)) + '.jpg', data }; });
  return { o, images };
}
export function mailText(o, t) {
  const L = [`Request for ${o.kind === 'sim' ? 'a simulator' : 'the flow trainer'}`, '', `Aircraft: ${o.aircraft}`];
  if (o.variant) L.push(`Variant: ${o.variant}`);
  if (o.want) L.push('', 'What they want:', o.want);
  if (o.links) L.push('', 'Links (model, pictures, licence):', o.links);
  L.push('', `From: ${o.name || 'no name given'}${o.reply ? ' <' + o.reply + '>' : ''}`, `Sent: ${new Date(t).toISOString()}`);
  return L.join('\n');
}
/* returns true when the mail went out */
export async function send(env, o, images, t, fetcher) {
  if (!env.REQUEST_TO || !env.RESEND_API_KEY) return false;
  const body = { from: env.REQUEST_FROM || 'Birdbird <onboarding@resend.dev>', to: [env.REQUEST_TO], subject: `Birdbird request: ${o.aircraft}${o.variant ? ' ' + o.variant : ''} (${o.kind === 'sim' ? 'simulator' : 'flow trainer'})`.slice(0, 150), text: mailText(o, t) };
  if (o.reply) body.reply_to = o.reply;
  if (images.length) body.attachments = images.map(im => ({ filename: im.name, content: im.data }));
  try { const r = await (fetcher || fetch)(RESEND, { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) console.error('request mail refused', r.status, (await r.text()).slice(0, 300)); return r.ok; }
  catch (e) { console.error('request mail failed', e && e.message); return false; }
}
export async function handleRequest(request, env, deps) {
  const now = (deps && deps.now) ? deps.now() : Date.now(), fetcher = deps && deps.fetch;
  try {
    if (request.method !== 'POST') bad(405, 'bad_request', 'Use POST.');
    checkOrigin(request);
    const db = env && env.DB; if (!db) bad(503, 'no_db', 'Requests cannot be received right now. Try again later.');
    if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) bad(400, 'bad_request', 'Send JSON.');
    const text = await request.text(); if (text.length > MAX_BODY) bad(413, 'too_large', 'That is too much to send in one go. Use fewer or smaller pictures.');
    let b; try { b = JSON.parse(text); } catch (e) { bad(400, 'bad_request', 'The request was not valid. Reload the page and try again.'); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) bad(400, 'bad_request', 'The request was not valid. Reload the page and try again.');
    if (b.website) return json({ ok: true, mailed: false });                       // a field people never see: only robots fill it in
    const { o, images } = clean(b);
    await schema(db);
    const ipk = await hex('bb-req:' + (request.headers.get('cf-connecting-ip') || 'local') + ':' + new Date(now).toISOString().slice(0, 10));
    const n = await db.prepare('SELECT COUNT(*) AS n FROM plane_requests WHERE ipk = ?1').bind(ipk).first();
    if (n && n.n >= PER_DAY) bad(429, 'rate_limited', 'You have sent several requests today. Try again tomorrow.');
    const id = [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, '0')).join('');
    await db.prepare('INSERT INTO plane_requests (id, t, kind, body, images, ipk, sent) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)').bind(id, now, o.kind, JSON.stringify(o), JSON.stringify(images), ipk).run();
    // this request and any earlier ones that could not be mailed yet
    const rows = await db.prepare('SELECT id, t, body, images FROM plane_requests WHERE sent = 0 ORDER BY t DESC LIMIT 5').all(); let mailed = false;
    for (const r of (rows.results || [])) {
      const ok = await send(env, JSON.parse(r.body), JSON.parse(r.images), r.t, fetcher); if (!ok) break;
      await db.prepare('UPDATE plane_requests SET sent = ?2, images = \'[]\' WHERE id = ?1').bind(r.id, now).run(); if (r.id === id) mailed = true;
    }
    await db.prepare('DELETE FROM plane_requests WHERE sent > 0 AND sent < ?1').bind(now - KEEP_SENT).run();
    return json({ ok: true, mailed });
  } catch (e) {
    if (e instanceof Err) return json({ ok: false, error: e.c, message: e.message }, e.s);
    if (e && e.status && e.code) return json({ ok: false, error: e.code, message: e.message }, e.status);
    console.error('request error', e && e.stack || e);
    return json({ ok: false, error: 'server', message: 'Something went wrong on our side. Try again in a moment.' }, 500);
  }
}
export const onRequest = ctx => handleRequest(ctx.request, ctx.env, null);
