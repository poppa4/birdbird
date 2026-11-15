/* Birdbird – Cloudflare Pages Function: GET /api/wx?ids=ENGM,ENBR,ENZV
   Latest METAR and TAF for the briefing pack, Route Explorer and the weather page.
   Sources, best first:
   - Norwegian aerodromes (EN**): MET Norway, the regulated MET service that issues them (api.met.no tafmetar, CC BY 4.0).
   - Everything else, and any EN** station MET Norway does not answer for: aviationweather.gov (NOAA Aviation Weather
     Center), which relays the worldwide OPMET exchange.
   The browser cannot call these directly (no CORS, User-Agent rules), and one edge cache keeps both far below their limits.

   Response 200: { ok:true, source, fetched, stations:{ ENGM:{ icao, name, source, metar:{raw,obsTime}|null, taf:{raw,issueTime,validFrom,validTo}|null } }, missing:[…] }
   Errors:       { ok:false, error:'bad_ids'|'upstream'|'timeout', message } with status 400 / 502 / 504.
   GET /api/wx?ping=1 answers { ok:true } without calling upstream.
   For training: data can be late or incomplete; the page tells the user to check the official briefing. */

const UPSTREAM = 'https://aviationweather.gov/api/data';
const MET = 'https://api.met.no/weatherapi/tafmetar/1.0';
const SRC_MET = 'MET Norway', SRC_AWC = 'aviationweather.gov';
const UA = 'Birdbird/1.0 (+https://birdbird.eu)'; // MET Norway requires an identifying User-Agent
const MAX_IDS = 8;
const TTL = 300; // seconds: METARs are issued every 30 or 60 minutes, TAFs every 3 to 6 hours
const TIMEOUT = 8000;
const MET_TIMEOUT = 3500; // then the EN** stations go to aviationweather.gov instead

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
  ids.forEach(id => { st[id] = { icao: id, name: null, source: SRC_AWC, metar: null, taf: null }; });
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
  return { ok: true, source: SRC_AWC + ' (NOAA Aviation Weather Center)', fetched: (now || new Date()).toISOString(), stations: st, missing };
}

/* ---------- MET Norway (tafmetar text) ---------- */
/* Time of a DDHHMM(Z) group relative to now: a day far ahead of today belongs to the previous month. */
export function dayTime(d, h, mi, now) {
  const n = now || new Date();
  let t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), d, h, mi);
  if (t - n.getTime() > 2 * 864e5) t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, d, h, mi);
  return t;
}
/* Newest report in a tafmetar .txt answer (last 24 h; messages end with '='). Returns null when nothing is readable,
   so the caller falls back to aviationweather.gov. */
export function metLatest(txt, kind, now) {
  const all = String(txt || '');
  if (/<\s*(html|\?xml)/i.test(all)) return null;
  const parts = (/=/.test(all) ? all.split('=') : all.split('\n')).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let best = null, bt = -Infinity;
  for (let x of parts) {
    x = x.replace(/^(METAR|SPECI|TAF)\s+(?:(?:AMD|COR|AUTO)\s+)*(?=[A-Z]{4}\b)/, m => kind === 'taf' ? m : (/^SPECI/.test(m) ? m : ''));
    const g = x.match(/^(?:(?:TAF|SPECI)\s+(?:(?:AMD|COR)\s+)*)?([A-Z]{4})\s+(?:COR\s+)?(\d{2})(\d{2})(\d{2})Z\b/);
    if (!g) continue;
    const t = dayTime(+g[2], +g[3], +g[4], now);
    if (t >= bt) { best = x; bt = t; }
  }
  if (!best) return null;
  if (kind === 'metar') return { raw: best, obsTime: new Date(bt).toISOString() };
  const raw = /^TAF\b/.test(best) ? best : 'TAF ' + best;
  const v = raw.match(/\b(\d{2})(\d{2})\/(\d{2})(\d{2})\b/);
  const vt = (d, h) => new Date(dayTime(d, 0, 0, now) + h * 36e5).toISOString(); // 24 = end of day
  const out = { raw, issueTime: new Date(bt).toISOString(), validFrom: v ? vt(+v[1], +v[2]) : null, validTo: v ? vt(+v[3], +v[4]) : null };
  // short TAFs (e.g. ENNO, daytime only): MET returns the last 24 h, so an expired one is dropped, as aviationweather.gov does
  if (out.validTo && new Date(out.validTo).getTime() <= (now || new Date()).getTime()) return null;
  return out;
}
async function metGet(fetchFn, kind, id, signal, now) {
  const r = await fetchFn(MET + '/' + kind + '.txt?icao=' + id, { headers: { 'user-agent': UA }, signal, cf: { cacheTtl: TTL, cacheEverything: true } });
  if (!r.ok) return null;
  return metLatest(await r.text(), kind, now);
}
/* { ENGM:{metar,taf} } for the Norwegian ids MET Norway answered; errors and empty answers are left out. */
export async function fromMet(fetchFn, ids, signal, now) {
  const out = {};
  await Promise.all(ids.filter(id => /^EN/.test(id)).map(async id => {
    try {
      const [metar, taf] = await Promise.all([metGet(fetchFn, 'metar', id, signal, now), metGet(fetchFn, 'taf', id, signal, now)]);
      if (metar || taf) out[id] = { metar, taf };
    } catch (e) { if (e && e.name === 'AbortError') throw e; }
  }));
  return out;
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
  let met = {}, metars = [], tafs = [];
  try {
    // MET Norway first for EN**; one slow or broken answer only sends that station to aviationweather.gov
    const mctl = new AbortController(), mt = setTimeout(() => mctl.abort(), MET_TIMEOUT);
    try { met = await fromMet(fetchFn, ids, mctl.signal, deps.now ? new Date(deps.now()) : null); } catch (e) { met = {}; }
    clearTimeout(mt);
    const rest = ids.filter(id => !met[id]);
    if (rest.length) {
      const q = 'ids=' + encodeURIComponent(rest.join(',')) + '&format=json';
      [metars, tafs] = await Promise.all([
        getJson(fetchFn, UPSTREAM + '/metar?' + q, ctl.signal),
        getJson(fetchFn, UPSTREAM + '/taf?' + q, ctl.signal)
      ]);
    }
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') return json({ ok: false, error: 'timeout', message: 'The weather service did not answer in time.' }, 504, 'no-store');
    const s = e && e.status;
    return json({ ok: false, error: 'upstream', status: s || null, message: s === 429 ? 'The weather service is busy (rate limit). Try again in a minute.' : 'Could not reach the weather service' + (s ? ' (HTTP ' + s + ')' : '') + '.' }, 502, 'no-store');
  }
  clearTimeout(timer);

  const body = combine(ids, metars, tafs);
  const used = new Set();
  ids.forEach(id => {
    const m = met[id], s = body.stations[id];
    if (m) { s.source = SRC_MET; s.metar = m.metar; s.taf = m.taf; }
    if (s.metar || s.taf) used.add(s.source);
  });
  body.missing = ids.filter(id => !body.stations[id].metar && !body.stations[id].taf);
  body.source = used.size ? [...used].sort((a, b) => (a === SRC_MET ? -1 : b === SRC_MET ? 1 : 0)).join(' and ') : SRC_AWC;
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
