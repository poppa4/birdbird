/* Birdbird – Cloudflare Pages Function: GET /api/sigmet[?fir=EN,ES]
   Valid international SIGMETs for Europe from aviationweather.gov (NOAA Aviation Weather Center, /api/data/isigmet),
   which relays the SIGMETs the European meteorological watch offices issue. One edge-cached upstream call every 5 min.

   Response 200: { ok:true, source, fetched, items:[{ id, fir, firName, mwo, series, hazard, qual, label, cat, from, to,
                   base, top, dir, spd, raw, poly:[[lon,lat],…]|null }] }
   ?fir=EN,ES keeps the FIRs whose id starts with one of the given two- or four-letter codes (ENOR, ENOB for EN).
   For training: the page tells the user to check the official briefing. */

const UPSTREAM = 'https://aviationweather.gov/api/data/isigmet?format=json';
const UA = 'Birdbird/1.0 (+https://birdbird.eu)';
const TTL = 300;
const TIMEOUT = 8000;
const EUROPE = /^(E|L|BI|BG|UK|GC)/; // European FIRs: EU/EFTA/UK/Balkans (E*, L*), Iceland, Greenland, Ukraine, Canary Islands

const json = (body, status, cache) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache || 'no-store', 'x-content-type-options': 'nosniff' }
});
const iso = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  const d = new Date(String(v).replace(' ', 'T').replace(/(T\d\d:\d\d(:\d\d)?)$/, '$1Z'));
  return isNaN(d) ? null : d.toISOString();
};
const num = v => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);

/* Hazard → { cat, label }. cat drives the map colour: ts, turb, ice, mtw, va, other. */
export function hazardOf(hazard, qual, raw) {
  const H = String(hazard || '').toUpperCase(), Q = String(qual || '').toUpperCase().trim(), R = ' ' + String(raw || '').toUpperCase().replace(/\s+/g, ' ') + ' ';
  const has = re => re.test(R);
  if (/VA/.test(H) || has(/ VA (CLD|ERUPTION)| VA /)) return { cat: 'va', label: 'Volcanic ash' };
  if (/TC/.test(H) || has(/ TC [A-Z]/)) return { cat: 'other', label: 'Tropical cyclone' };
  if (/RDOACT/.test(H) || has(/ RDOACT CLD /)) return { cat: 'other', label: 'Radioactive cloud' };
  if (/MTW/.test(H) || has(/ SEV MTW /)) return { cat: 'mtw', label: 'Severe mountain wave' };
  if (/ICE/.test(H) || has(/ SEV ICE /)) return { cat: 'ice', label: has(/FZRA/) ? 'Severe icing (freezing rain)' : 'Severe icing' };
  if (/TURB/.test(H) || has(/ SEV TURB /)) return { cat: 'turb', label: 'Severe turbulence' };
  if (/DS|SS/.test(H) || has(/ HVY (DS|SS) /)) return { cat: 'other', label: has(/ HVY SS /) ? 'Heavy sandstorm' : 'Heavy duststorm' };
  if (/TS/.test(H) || has(/ (OBSC|EMBD|FRQ|SQL) TS/)) {
    const q = Q || ((R.match(/ (OBSC|EMBD|FRQ|SQL) TS/) || [])[1] || '');
    const w = { OBSC: 'Obscured', EMBD: 'Embedded', FRQ: 'Frequent', SQL: 'Squall line' }[q] || '';
    return { cat: 'ts', label: (w ? w + ' t' : 'T') + 'hunderstorms' + (has(/TSGR/) ? ' with hail' : '') };
  }
  return { cat: 'other', label: H ? (Q ? Q + ' ' : '') + H : 'SIGMET' };
}

function poly(s) {
  const c = s && s.coords;
  if (!Array.isArray(c) || c.length < 3) return null;
  const pts = c.map(p => Array.isArray(p) ? [num(p[0]), num(p[1])] : [num(p.lon != null ? p.lon : p.lng), num(p.lat)])
    .filter(p => p[0] != null && p[1] != null && Math.abs(p[1]) <= 90 && Math.abs(p[0]) <= 180);
  if (pts.length < 3) return null;
  const a = pts[0], z = pts[pts.length - 1];
  if (a[0] !== z[0] || a[1] !== z[1]) pts.push([a[0], a[1]]);
  return pts;
}

export function normalise(list, now, firs) {
  const t = (now || new Date()).getTime();
  const want = (firs || []).map(f => String(f).toUpperCase()).filter(f => /^[A-Z]{2}([A-Z]{2})?$/.test(f));
  const out = [], seen = {};
  (Array.isArray(list) ? list : []).forEach(s => {
    const fir = String(s.firId || s.icaoId || '').toUpperCase();
    if (!EUROPE.test(fir)) return;
    if (want.length && !want.some(w => fir.startsWith(w))) return;
    const to = iso(s.validTimeTo); if (to && new Date(to).getTime() <= t) return; // expired
    const raw = String(s.rawSigmet || s.rawText || '').replace(/\s+/g, ' ').trim();
    const g = (String(s.geom || '').toUpperCase() === 'LINE' || String(s.geom || '').toUpperCase() === 'POINT') ? null : poly(s);
    const hz = hazardOf(s.hazard, s.qualifier, raw);
    const from = iso(s.validTimeFrom);
    const id = fir + ':' + (s.seriesId || '') + ':' + (from || '');
    if (seen[id]) return; seen[id] = 1;
    out.push({ id, fir, firName: s.firName || null, mwo: s.icaoId || null, series: s.seriesId != null ? String(s.seriesId) : null,
      hazard: s.hazard || null, qual: s.qualifier || null, label: hz.label, cat: hz.cat, from, to,
      base: num(s.base), top: num(s.top), dir: s.dir != null ? String(s.dir) : null, spd: num(s.spd), raw, poly: g });
  });
  out.sort((a, b) => a.fir.localeCompare(b.fir) || String(a.from).localeCompare(String(b.from)));
  return out;
}

export async function handleSigmet(request, env, deps) {
  deps = deps || {};
  const fetchFn = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'method', message: 'Use GET.' }, 405);
  const firs = String(url.searchParams.get('fir') || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
  if (firs.some(f => !/^[A-Z]{2}([A-Z]{2})?$/.test(f)) || firs.length > 12) return json({ ok: false, error: 'bad_fir', message: 'Use two- or four-letter FIR or country codes, e.g. ?fir=EN,ES.' }, 400);

  // one upstream answer for all of Europe, cached; the FIR filter runs on the cached list
  const key = new Request(url.origin + '/api/sigmet?all', { method: 'GET' });
  let list = null;
  if (cache) { try { const hit = await cache.match(key); if (hit) list = await hit.json(); } catch (e) {} }
  if (!list) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetchFn(UPSTREAM, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: ctl.signal, cf: { cacheTtl: TTL, cacheEverything: true } });
      if (r.status === 204) list = [];
      else if (!r.ok) { const e = new Error('upstream'); e.status = r.status; throw e; }
      else { const t = await r.text(); const j = t.trim() ? JSON.parse(t) : []; list = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : []); }
    } catch (e) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') return json({ ok: false, error: 'timeout', message: 'The weather service did not answer in time.' }, 504);
      return json({ ok: false, error: 'upstream', message: 'Could not reach the weather service' + (e && e.status ? ' (HTTP ' + e.status + ')' : '') + '.' }, 502);
    }
    clearTimeout(timer);
    list = list.filter(s => EUROPE.test(String(s.firId || s.icaoId || '').toUpperCase()));
    if (cache) { const put = cache.put(key, json(list, 200, 'public, max-age=' + TTL)).catch(() => {}); if (deps.waitUntil) deps.waitUntil(put); else await put; }
  }
  const items = normalise(list, deps.now ? new Date(deps.now()) : null, firs);
  return json({ ok: true, source: 'aviationweather.gov (NOAA Aviation Weather Center)', fetched: new Date(deps.now ? deps.now() : Date.now()).toISOString(), items }, 200, 'public, max-age=60, s-maxage=' + TTL);
}

export async function onRequestGet(ctx) {
  return handleSigmet(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null });
}
