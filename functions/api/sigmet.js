/* Birdbird – Cloudflare Pages Function: GET /api/sigmet[?fir=EN,ES]
   Valid SIGMETs and AIRMETs, worldwide, best source first:
   - Norway (ENOR, ENOB): MET Norway, the meteorological watch office that issues them (api.met.no sigmets 2.0, TAC text,
     CC BY 4.0): SIGMETs and AIRMETs.
   - Every other FIR: international SIGMETs from aviationweather.gov (NOAA AWC /api/data/isigmet), plus US domestic
     SIGMETs (/api/data/airsigmet). Outside Norway AIRMETs are not openly published (in the US they are G-AIRMETs).
   One edge-cached upstream round every 5 min for everyone; if MET Norway does not answer, NOAA's Norwegian SIGMETs are kept.

   Response 200: { ok:true, sources, fetched, items:[{ id, type:'SIGMET'|'AIRMET', source, fir, firName, mwo, series,
                   hazard, qual, label, cat, sev, from, to, base, top, dir, spd, raw, poly:[[lon,lat],…]|null }] }
   ?fir=EN,ES keeps the FIRs whose id starts with one of the given two- or four-letter codes.
   For training: the page tells the user to check the official briefing. */

const UPSTREAM = 'https://aviationweather.gov/api/data/isigmet?format=json';
const UPSTREAM_US = 'https://aviationweather.gov/api/data/airsigmet?format=json';
const MET = 'https://api.met.no/weatherapi/sigmets/2.0/';
const SRC_MET = 'MET Norway', SRC_AWC = 'aviationweather.gov';
const MET_TIMEOUT = 3500;
const UA = 'Birdbird/1.0 (+https://birdbird.eu)';
const TTL = 300;
const TIMEOUT = 8000;
const NORWAY = /^EN/;

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
  if (has(/ MOD ICE /)) return { cat: 'ice', label: 'Moderate icing' };
  if (has(/ MOD TURB /)) return { cat: 'turb', label: 'Moderate turbulence' };
  if (has(/ MOD MTW /)) return { cat: 'mtw', label: 'Moderate mountain wave' };
  if (has(/ (ISOL|OCNL) TS/)) return { cat: 'ts', label: (has(/ OCNL TS/) ? 'Occasional' : 'Isolated') + ' thunderstorms' + (has(/TSGR/) ? ' with hail' : '') };
  if (has(/ (ISOL|OCNL|FRQ) CB /)) return { cat: 'ts', label: 'Cumulonimbus' };
  if (has(/ MT OBSC /)) return { cat: 'vis', label: 'Mountains obscured' };
  if (has(/ (BKN|OVC) CLD /)) return { cat: 'vis', label: 'Low cloud' };
  if (has(/ SFC VIS /)) return { cat: 'vis', label: 'Reduced surface visibility' };
  if (has(/ SFC WIND /)) return { cat: 'other', label: 'Strong surface wind' };
  if (/TS/.test(H) || has(/ (OBSC|EMBD|FRQ|SQL) TS/)) {
    const q = Q || ((R.match(/ (OBSC|EMBD|FRQ|SQL) TS/) || [])[1] || '');
    const w = { OBSC: 'Obscured', EMBD: 'Embedded', FRQ: 'Frequent', SQL: 'Squall line' }[q] || '';
    return { cat: 'ts', label: (w ? w + ' t' : 'T') + 'hunderstorms' + (has(/TSGR/) ? ' with hail' : '') };
  }
  return { cat: 'other', label: H ? (Q ? Q + ' ' : '') + H : 'SIGMET' };
}

function poly(s) {
  let c = s && s.coords;
  if (!Array.isArray(c) && s && s.geometry && Array.isArray(s.geometry.coordinates)) c = s.geometry.type === 'Polygon' ? s.geometry.coordinates[0] : null;
  if (!Array.isArray(c) || c.length < 3) return null;
  const pts = c.map(p => Array.isArray(p) ? [num(p[0]), num(p[1])] : [num(p.lon != null ? p.lon : p.lng), num(p.lat)])
    .filter(p => p[0] != null && p[1] != null && Math.abs(p[1]) <= 90 && Math.abs(p[0]) <= 180);
  return close(pts);
}
function close(pts) {
  if (!pts || pts.length < 3) return null;
  const a = pts[0], z = pts[pts.length - 1];
  if (a[0] !== z[0] || a[1] !== z[1]) pts.push([a[0], a[1]]);
  return pts;
}

/* ---------- TAC (MET Norway): "ENOR SIGMET A3 VALID 151100/151400 ENMI- ENOR POLARIS FIR SEV TURB FCST WI N6000 E00500 - … FL020/180 MOV NE 10KT NC=" */
const dd = (d, h, m, now) => { const n = now || new Date(); let t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), d, h, m); if (t - n.getTime() > 2 * 864e5) t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, d, h, m); return t; };
const deg = (h, v, w) => { // N6000 / E00500 / N60 / E005
  const n = +v.slice(0, w), m = v.length > w ? +v.slice(w, w + 2) : 0; const x = n + m / 60; return /[SW]/.test(h) ? -x : x; };
export function tacPoly(T) {
  const m = T.match(/\bWI ((?:[NS]\d{2,4} [EW]\d{3,5}(?: - |\s*-\s*| )?)+)/); if (!m) return null;
  const pts = []; const re = /([NS])(\d{2,4}) ([EW])(\d{3,5})/g; let x;
  while ((x = re.exec(m[1]))) pts.push([+deg(x[3], x[4], 3).toFixed(4), +deg(x[1], x[2], 2).toFixed(4)]);
  return close(pts);
}
function tacLevels(T) {
  const fl = v => +v * 100;
  let m = T.match(/\b(SFC|\d{3,5}FT|\d{3,4}M|FL\d{3})\/(FL)?(\d{3}|\d{3,5}FT)\b/);
  if (m) { const b = m[1] === 'SFC' ? 0 : /FT$/.test(m[1]) ? +m[1].replace('FT', '') : /M$/.test(m[1]) ? Math.round(+m[1].replace('M', '') * 3.28084) : fl(m[1].slice(2));
    const t = /FT$/.test(m[3]) ? +m[3].replace('FT', '') : fl(m[3]); return { base: b, top: t }; }
  if ((m = T.match(/\bTOP (?:ABV )?FL(\d{3})\b/))) return { base: null, top: fl(m[1]) };
  if ((m = T.match(/\bABV FL(\d{3})\b/))) return { base: fl(m[1]), top: null };
  if ((m = T.match(/\bFL(\d{3})\b/))) return { base: fl(m[1]), top: fl(m[1]) };
  return { base: null, top: null };
}
export function parseTac(txt, now) {
  const all = String(txt || '');
  if (/<\s*(html|\?xml)/i.test(all)) return [];
  const msgs = all.split('=').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [], cnl = [];
  msgs.forEach(raw => {
    const T = ' ' + raw.toUpperCase() + ' ';
    const h = T.match(/ ([A-Z]{4}) (SIGMET|AIRMET) ([A-Z]?\d{1,2}|[A-Z]\d?) VALID (\d{2})(\d{2})(\d{2})\/(\d{2})(\d{2})(\d{2}) ([A-Z]{4})-?/);
    if (!h) return;
    const [, fir, type, series] = h;
    const from = dd(+h[4], +h[5], +h[6], now), to = dd(+h[7], +h[8], +h[9], now);
    const c = T.match(/ CNL (SIGMET|AIRMET) ([A-Z]?\d{1,2}) /);
    if (c) { cnl.push(fir + ':' + c[1] + ':' + c[2]); return; }
    const nm = T.match(new RegExp(' ' + fir + ' ([A-Z ]+?) (?:FIR|UIR|FIR/UIR|CTA)\\b'));
    const lv = tacLevels(T), mv = T.match(/ MOV ([NSEW]{1,3}) (\d{1,3})KT/);
    const clean = raw.replace(/^[A-Z]{4}\d{2} [A-Z]{4} \d{6}( [A-Z]{3})? /, ''); // WMO heading, if any
    const hz = hazardOf('', '', raw);
    out.push({ key: fir + ':' + type + ':' + series, type, fir, firName: nm ? nm[1].trim() : null, mwo: h[10], series, hazard: null, qual: null,
      label: hz.label, cat: hz.cat, from: new Date(from).toISOString(), to: new Date(to).toISOString(), base: lv.base, top: lv.top,
      dir: mv ? mv[1] : (/ STNR /.test(T) ? 'STNR' : null), spd: mv ? +mv[2] : null, raw: clean, poly: / ENTIRE FIR/.test(T) ? null : tacPoly(T) });
  });
  return out.filter(x => !cnl.includes(x.key));
}

function finish(list, now, firs) {
  const t = (now || new Date()).getTime();
  const want = (firs || []).map(f => String(f).toUpperCase()).filter(f => /^[A-Z]{2}([A-Z]{2})?$/.test(f));
  const out = [], seen = {};
  list.forEach(x => {
    if (want.length && !want.some(w => x.fir.startsWith(w))) return;
    if (x.to && new Date(x.to).getTime() <= t) return; // expired
    const id = x.fir + ':' + x.type + ':' + (x.series || '') + ':' + (x.from || '');
    if (seen[id]) return; seen[id] = 1;
    const o = Object.assign({ id }, x); delete o.key; out.push(o);
  });
  out.sort((a, b) => a.fir.localeCompare(b.fir) || a.type.localeCompare(b.type) || String(a.from).localeCompare(String(b.from)));
  return out;
}

/* NOAA international SIGMETs → items (no time or FIR filter yet) */
export function fromIsigmet(list) {
  return (Array.isArray(list) ? list : []).map(s => {
    const fir = String(s.firId || s.icaoId || '').toUpperCase(); if (!/^[A-Z]{4}$/.test(fir)) return null;
    const raw = String(s.rawSigmet || s.rawText || '').replace(/\s+/g, ' ').trim();
    const G = String(s.geom || '').toUpperCase(); const hz = hazardOf(s.hazard, s.qualifier, raw);
    return { type: 'SIGMET', source: SRC_AWC, fir, firName: s.firName || null, mwo: s.icaoId || null, series: s.seriesId != null ? String(s.seriesId) : null,
      hazard: s.hazard || null, qual: s.qualifier || null, label: hz.label, cat: hz.cat, from: iso(s.validTimeFrom), to: iso(s.validTimeTo),
      base: num(s.base), top: num(s.top), dir: s.dir != null ? String(s.dir) : null, spd: num(s.spd), raw, poly: (G === 'LINE' || G === 'POINT') ? null : poly(s) };
  }).filter(Boolean);
}
/* NOAA US domestic SIGMETs (convective and non-convective); AIRMETs there are G-AIRMETs and not included */
export function fromAirsigmet(list) {
  return (Array.isArray(list) ? list : []).map(s => {
    const kind = String(s.airSigmetType || s.type || 'SIGMET').toUpperCase(); if (/AIRMET/.test(kind)) return null;
    const raw = String(s.rawAirSigmet || s.rawText || '').replace(/\s+/g, ' ').trim();
    const hz = hazardOf(s.hazard, s.severity, raw);
    const icao = String(s.icaoId || 'KKCI').toUpperCase();
    const fir = /^P/.test(icao) ? icao : 'KUS' + (/CONVECTIVE/.test(String(s.hazard || '').toUpperCase()) ? 'C' : 'N'); // US domestic area
    return { type: 'SIGMET', source: SRC_AWC, fir, firName: 'United States (domestic)', mwo: icao, series: s.alphaChar || s.seriesId || null,
      hazard: s.hazard || null, qual: s.severity != null ? String(s.severity) : null, label: /CONVECTIVE/i.test(String(s.hazard || '')) ? 'Convective SIGMET (thunderstorms)' : hz.label,
      cat: /CONVECTIVE/i.test(String(s.hazard || '')) ? 'ts' : hz.cat, from: iso(s.validTimeFrom), to: iso(s.validTimeTo),
      base: num(s.altitudeLow1 != null ? s.altitudeLow1 : s.base), top: num(s.altitudeHi1 != null ? s.altitudeHi1 : s.top),
      dir: s.movementDir != null ? String(s.movementDir) : null, spd: num(s.movementSpd), raw, poly: poly(s) };
  }).filter(Boolean);
}

/* Combine: MET Norway for Norwegian FIRs when it answered (null = no answer), NOAA for the rest */
export function combineAll(met, isig, us, now, firs) {
  const list = [];
  if (met) met.forEach(x => list.push(Object.assign({ source: SRC_MET }, x)));
  fromIsigmet(isig).forEach(x => { if (met && NORWAY.test(x.fir)) return; list.push(x); });
  fromAirsigmet(us).forEach(x => list.push(x));
  return finish(list, now, firs);
}
/* back-compat for the tests: NOAA international list only */
export function normalise(list, now, firs) { return finish(fromIsigmet(list), now, firs); }

async function getText(fetchFn, url, signal, accept) {
  const r = await fetchFn(url, { headers: { 'user-agent': UA, accept: accept || 'application/json' }, signal, cf: { cacheTtl: TTL, cacheEverything: true } });
  if (r.status === 204) return '';
  if (!r.ok) { const e = new Error('upstream'); e.status = r.status; throw e; }
  return r.text();
}
const asList = t => { if (!String(t || '').trim()) return []; const j = JSON.parse(t); return Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : []); };

export async function handleSigmet(request, env, deps) {
  deps = deps || {};
  const fetchFn = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const url = new URL(request.url);
  const now = deps.now ? new Date(deps.now()) : new Date();
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'method', message: 'Use GET.' }, 405);
  const firs = String(url.searchParams.get('fir') || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
  if (firs.some(f => !/^[A-Z]{2}([A-Z]{2})?$/.test(f)) || firs.length > 12) return json({ ok: false, error: 'bad_fir', message: 'Use two- or four-letter FIR or country codes, e.g. ?fir=EN,ES.' }, 400);

  // one upstream round for the whole world, cached raw; filters run on the cached copy
  const key = new Request(url.origin + '/api/sigmet?raw=2', { method: 'GET' });
  let raw = null;
  if (cache) { try { const hit = await cache.match(key); if (hit) raw = await hit.json(); } catch (e) {} }
  if (!raw) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT);
    const mctl = new AbortController(), mt = setTimeout(() => mctl.abort(), MET_TIMEOUT);
    try {
      const [isig, us, met] = await Promise.all([
        getText(fetchFn, UPSTREAM, ctl.signal).then(asList),
        getText(fetchFn, UPSTREAM_US, ctl.signal).then(asList).catch(() => []),
        getText(fetchFn, MET, mctl.signal, 'text/plain').then(t => t).catch(() => null)
      ]);
      raw = { isig, us, met };
    } catch (e) {
      clearTimeout(timer); clearTimeout(mt);
      if (e && e.name === 'AbortError') return json({ ok: false, error: 'timeout', message: 'The weather service did not answer in time.' }, 504);
      return json({ ok: false, error: 'upstream', message: 'Could not reach the weather service' + (e && e.status ? ' (HTTP ' + e.status + ')' : '') + '.' }, 502);
    }
    clearTimeout(timer); clearTimeout(mt);
    if (cache) { const put = cache.put(key, json(raw, 200, 'public, max-age=' + TTL)).catch(() => {}); if (deps.waitUntil) deps.waitUntil(put); else await put; }
  }
  const met = raw.met == null ? null : parseTac(raw.met, now);
  const items = combineAll(met, raw.isig, raw.us, now, firs);
  return json({ ok: true, sources: { 'MET Norway': 'api.met.no (CC BY 4.0), Norway: SIGMET and AIRMET', 'aviationweather.gov': 'NOAA Aviation Weather Center: international and US SIGMETs' },
    metOk: raw.met != null, fetched: now.toISOString(), items }, 200, 'public, max-age=60, s-maxage=' + TTL);
}

export async function onRequestGet(ctx) {
  return handleSigmet(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null });
}
