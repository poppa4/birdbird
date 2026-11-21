/* NORDAP – anonymous visit counting and the admin overview (admin.html).

   POST /api/ping { p: path, v: 1 }   a page view (v: 1) or a heartbeat while the page is open (v: 0)
   GET  /api/admin/stats              -> { ok, online, today:{visitors, views}, days:[{day, visitors, views}], pages:{today, week}, members:{...} }

   No cookies and nothing stored on the device. A visitor is counted as a hash of the day, the IP address, the browser's
   user agent and a secret word (STATS_SALT): the IP itself is never stored, and the hash changes every day, so nobody
   can be followed from one day to the next. Bots (by user agent) are not counted.
   "Online now" = pages that sent a heartbeat in the last 2 minutes.

   Admin: a signed-in account whose id is listed in ADMIN_USER_IDS, or whose verified e-mail is listed in ADMIN_EMAILS
   (Pages environment variables, comma-separated). Everyone else gets 403 with their own account id, so the owner can copy
   it into ADMIN_USER_IDS.

   Storage (D1, binding DB; made here on first use, also in migrations/0008_stats.sql):
     stat_day(day, vid, first_at, views)   one row per visitor per day (UTC)
     stat_page(day, path, views)           page views per path per day
     stat_live(vid, at, path)              last heartbeat per visitor (cleared after 10 minutes) */
import { json, getSession, requireSession, fail, ipOf } from './api.js';

const LIVE_MS = 120000, DAY_MS = 86400000, KEEP_DAYS = 400;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|curl|wget|python|httpclient|monitor/i;
const day = t => new Date(t).toISOString().slice(0, 10);
const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

const ready = new WeakMap();
export function statsSchema(db) {
  if (ready.has(db)) return ready.get(db);
  const p = db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS stat_day (day TEXT NOT NULL, vid TEXT NOT NULL, first_at INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, vid))'),
    db.prepare('CREATE TABLE IF NOT EXISTS stat_page (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path))'),
    db.prepare('CREATE TABLE IF NOT EXISTS stat_live (vid TEXT PRIMARY KEY, at INTEGER NOT NULL, path TEXT NOT NULL DEFAULT \'\')'),
    db.prepare('CREATE INDEX IF NOT EXISTS stat_live_at ON stat_live (at)')
  ]).catch(e => { ready.delete(db); throw e; });
  ready.set(db, p); return p;
}

/* a path as it is counted: the page only, no query or hash, '/' for the front page, at most 80 characters */
export function cleanPath(p) {
  let s = String(p || '/').split(/[?#]/)[0].replace(/\/+/g, '/').replace(/\.html$/, '').replace(/[^\w\-/.]/g, '').slice(0, 80);
  if (!s.startsWith('/')) s = '/' + s; if (s === '/index') s = '/'; return s;
}

export async function ping(c) {
  const ua = c.request.headers.get('user-agent') || '';
  if (!ua || BOT.test(ua)) return new Response(null, { status: 204 });
  let body = {}; try { body = JSON.parse((await c.request.text()).slice(0, 500) || '{}') || {}; } catch (e) {}
  const path = cleanPath(body.p), view = body.v === 1 || body.v === '1', d = day(c.now);
  const vid = (await hex('bb-visit|' + d + '|' + (ipOf(c.request) || '') + '|' + ua + '|' + (c.env.STATS_SALT || 'nordap-stats'))).slice(0, 20);
  await statsSchema(c.db);
  const st = [c.db.prepare('INSERT INTO stat_live (vid, at, path) VALUES (?1, ?2, ?3) ON CONFLICT(vid) DO UPDATE SET at = excluded.at, path = excluded.path').bind(vid, c.now, path)];
  if (view) {
    st.push(c.db.prepare('INSERT INTO stat_day (day, vid, first_at, views) VALUES (?1, ?2, ?3, 1) ON CONFLICT(day, vid) DO UPDATE SET views = views + 1').bind(d, vid, c.now));
    st.push(c.db.prepare('INSERT INTO stat_page (day, path, views) VALUES (?1, ?2, 1) ON CONFLICT(day, path) DO UPDATE SET views = views + 1').bind(d, path));
  }
  /* now and then: old heartbeats and old days go */
  if (Math.random() < 0.02) {
    st.push(c.db.prepare('DELETE FROM stat_live WHERE at < ?1').bind(c.now - 10 * 60000));
    st.push(c.db.prepare('DELETE FROM stat_day WHERE day < ?1').bind(day(c.now - KEEP_DAYS * DAY_MS)));
    st.push(c.db.prepare('DELETE FROM stat_page WHERE day < ?1').bind(day(c.now - KEEP_DAYS * DAY_MS)));
  }
  await c.db.batch(st);
  return new Response(null, { status: 204 });
}

const list = v => String(v || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
/* is this session the site's owner? */
export async function isAdmin(c, s) {
  if (!s) return false;
  const ids = list(c.env.ADMIN_USER_IDS), mails = list(c.env.ADMIN_EMAILS);
  if (ids.includes(String(s.user_id).toLowerCase())) return true;
  if (!mails.length) return false;
  const u = await c.db.prepare('SELECT email, email_verified_at FROM users WHERE id = ?1').bind(s.user_id).first().catch(() => null);
  return !!(u && u.email && u.email_verified_at && mails.includes(String(u.email).toLowerCase()));
}
export async function adminFlag(c) { try { return await isAdmin(c, await getSession(c)); } catch (e) { return false; } }

export async function adminStats(c) {
  const s = await requireSession(c);
  if (!(await isAdmin(c, s))) fail(403, 'not_admin', 'This page is only for the site owner. Your account id is ' + s.user_id + '. To make this account the admin, add the id to ADMIN_USER_IDS in the Cloudflare Pages settings (Settings > Variables and secrets) and deploy again.');
  await statsSchema(c.db);
  const today = day(c.now), from14 = day(c.now - 13 * DAY_MS), from7 = day(c.now - 6 * DAY_MS), from30 = day(c.now - 29 * DAY_MS);
  const q = (sql, ...a) => c.db.prepare(sql).bind(...a);
  const [live, livePages, days, pToday, pWeek, tot30, users, new7, new30, active30] = await Promise.all([
    q('SELECT COUNT(*) AS n FROM stat_live WHERE at > ?1', c.now - LIVE_MS),
    q('SELECT path, COUNT(*) AS n FROM stat_live WHERE at > ?1 GROUP BY path ORDER BY n DESC LIMIT 8', c.now - LIVE_MS),
    q('SELECT day, COUNT(*) AS visitors, SUM(views) AS views FROM stat_day WHERE day >= ?1 GROUP BY day ORDER BY day', from14),
    q('SELECT path, views FROM stat_page WHERE day = ?1 ORDER BY views DESC LIMIT 10', today),
    q('SELECT path, SUM(views) AS views FROM stat_page WHERE day >= ?1 GROUP BY path ORDER BY views DESC LIMIT 10', from7),
    q('SELECT COUNT(*) AS visitors, COALESCE(SUM(views), 0) AS views FROM stat_day WHERE day >= ?1', from30),
    q('SELECT COUNT(*) AS n FROM users'),
    q('SELECT COUNT(*) AS n FROM users WHERE created_at > ?1', c.now - 7 * DAY_MS),
    q('SELECT COUNT(*) AS n FROM users WHERE created_at > ?1', c.now - 30 * DAY_MS),
    q('SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE last_seen_at > ?1', c.now - 30 * DAY_MS)
  ].map(st => st.all()));
  const first = r => (r.results && r.results[0]) || {};
  const byDay = new Map((days.results || []).map(r => [r.day, r]));
  const series = []; for (let k = 13; k >= 0; k--) { const d = day(c.now - k * DAY_MS), r = byDay.get(d) || {}; series.push({ day: d, visitors: r.visitors || 0, views: r.views || 0 }); }
  const t = series[series.length - 1], wk = series.filter(x => x.day >= from7);
  return json({
    ok: true, at: c.now,
    online: first(live).n || 0, onlinePages: livePages.results || [],
    today: { visitors: t.visitors, views: t.views },
    week: { visitors: wk.reduce((a, x) => a + x.visitors, 0), views: wk.reduce((a, x) => a + x.views, 0) },
    month: { visitors: first(tot30).visitors || 0, views: first(tot30).views || 0 },
    days: series,
    pages: { today: pToday.results || [], week: pWeek.results || [] },
    members: { total: first(users).n || 0, new7: first(new7).n || 0, new30: first(new30).n || 0, active30: first(active30).n || 0 }
  }, 200, { 'set-cookie': c.setCookie, 'cache-control': 'no-store' });
}
