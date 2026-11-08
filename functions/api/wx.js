/* Birdbird – Cloudflare Pages Function: GET /api/wx?ids=ENGM,ENBR,ENZV
   Proxies the aviationweather.gov Data API (NOAA Aviation Weather Center) so the briefing pack can show the latest
   METAR and TAF. The browser cannot call aviationweather.gov directly (no CORS), and going through one edge cache keeps
   us far below the API's limit (100 requests per minute) however many people open the page.

   Response 200: { ok:true, source, fetched, stations:{ ENGM:{ icao, name, metar:{raw,obsTime}|null, taf:{raw,issueTime,validFrom,validTo}|null } }, missing:[…] }
   Errors:       { ok:false, error:'bad_ids'|'upstream'|'timeout', message } with status 400 / 502 / 504.
   GET /api/wx?ping=1 answers { ok:true } without calling upstream.
   For training: data can be late or incomplete; the page tells the user to check the official briefing. */

const UPSTREAM = 'https://aviationweather.gov/api/data';
const UA = 'Birdbird/1.0 (+https://birdbird.eu)';
const MAX_IDS = 8;
const TTL = 300; // seconds: METARs are issued every 30 or 60 minutes, TAFs every 3 to 6 hours
const TIMEOUT = 8000;

const json = (body, status, cache) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cache || 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

export function parseIds(q) {
  const raw = String(q || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
  const ids = [...new Set(raw)];
  const bad = ids.filter(x => !/^[A-Z]{4}$/.test(x));
  return { ids, bad };
}

const iso = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  const d = new Date(String(v).replace(' ', 'T').replace(/(T\d\d:\d\d:\d\d)$/, '$1Z'));
  return isNaN(d) ? null : d.toISOString();
};

async function getJson(fetchFn, url, signal) {
  const r = await fetchFn(url, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal,
    cf: { cacheTtl: TTL, cacheEverything: true }
  });
  if (r.status === 204) return [];
  if (!r.ok) { const e = new Error('upstream ' + r.status); e.status = r.status; throw e; }
  const t = await r.text();
  if (!t.trim()) return [];
  const j = JSON.parse(t);
  return Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : []);
}

export function combine(ids, metars, tafs, now) {
  const st = {};
  ids.forEach(id => { st[id] = { icao: id, name: null, metar: null, taf: null }; });
  // the API can return more than one report per station: keep the newest
  (metars || []).forEach(m => {
    const id = String(m.icaoId || m.stationId || '').toUpperCase(); if (!st[id]) return;
    const raw = m.rawOb || m.raw_text || m.rawText; if (!raw) return;
    const obs = iso(m.obsTime) || iso(m.reportTime);
    const cur = st[id].metar;
    if (!cur || (obs && (!cur.obsTime || obs > cur.obsTime))) st[id].metar = { raw: String(raw).trim(), obsTime: obs };
    if (m.name && !st[id].name) st[id].name = String(m.name);
  });
  (tafs || []).forEach(t => {
    const id = String(t.icaoId || t.stationId || '').toUpperCase(); if (!st[id]) return;
    const raw = t.rawTAF || t.rawTaf || t.raw_text; if (!raw) return;
    const it = iso(t.issueTime) || iso(t.bulletinTime);
    const cur = st[id].taf;
    if (!cur || (it && (!cur.issueTime || it > cur.issueTime))) st[id].taf = { raw: String(raw).trim().replace(/^(?!TAF\b)/, 'TAF '), issueTime: it, validFrom: iso(t.validTimeFrom), validTo: iso(t.validTimeTo) };
    if (t.name && !st[id].name) st[id].name = String(t.name);
  });
  const missing = ids.filter(id => !st[id].metar && !st[id].taf);
  return { ok: true, source: 'aviationweather.gov (NOAA Aviation Weather Center)', fetched: (now || new Date()).toISOString(), stations: st, missing };
}

export async function handleWx(request, env, deps) {
  deps = deps || {};
  const fetchFn = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'method', message: 'Use GET.' }, 405);
  if (url.searchParams.get('ping')) return json({ ok: true, service: 'wx' }, 200, 'no-store');

  const { ids, bad } = parseIds(url.searchParams.get('ids'));
  if (!ids.length) return json({ ok: false, error: 'bad_ids', message: 'Give one or more ICAO codes, e.g. ?ids=ENGM,ENBR.' }, 400);
  if (bad.length) return json({ ok: false, error: 'bad_ids', message: 'Not an ICAO code: ' + bad.slice(0, 3).join(', ') + '. Use four letters, e.g. ENGM.' }, 400);
  if (ids.length > MAX_IDS) return json({ ok: false, error: 'bad_ids', message: 'At most ' + MAX_IDS + ' aerodromes per request.' }, 400);

  // one cache entry per sorted id list
  const key = new Request(url.origin + '/api/wx?ids=' + [...ids].sort().join(','), { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) {} }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  const q = 'ids=' + encodeURIComponent(ids.join(',')) + '&format=json';
  let metars, tafs;
  try {
    [metars, tafs] = await Promise.all([
      getJson(fetchFn, UPSTREAM + '/metar?' + q, ctl.signal),
      getJson(fetchFn, UPSTREAM + '/taf?' + q, ctl.signal)
    ]);
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') return json({ ok: false, error: 'timeout', message: 'The weather service did not answer in time.' }, 504, 'no-store');
    const s = e && e.status;
    return json({ ok: false, error: 'upstream', status: s || null, message: s === 429 ? 'The weather service is busy (rate limit). Try again in a minute.' : 'Could not reach the weather service' + (s ? ' (HTTP ' + s + ')' : '') + '.' }, 502, 'no-store');
  }
  clearTimeout(timer);

  const body = combine(ids, metars, tafs);
  const res = json(body, 200, 'public, max-age=60, s-maxage=' + TTL);
  if (cache) {
    const put = cache.put(key, res.clone()).catch(() => {});
    if (deps.waitUntil) deps.waitUntil(put); else await put;
  }
  return res;
}

export async function onRequestGet(ctx) {
  return handleWx(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null });
}
