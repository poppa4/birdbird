/* Birdbird – Cloudflare Pages Function: GET /api/winds?tile=55,5[&t=2026-11-15T12:00Z]
   Upper winds, temperature and height on 12 pressure levels (1000–150 hPa) for one 5° × 5° tile, from NOAA's GFS model
   (0.25°, hourly to 120 h; public domain), subset by the NOMADS grib filter and decoded here (functions/_lib/grib2.js).
   Global coverage. The newest finished model run is used; if it is not on NOMADS yet, the one before.
   One upstream call per tile and hour for everyone: answers are cached at the edge for 2 h.

   Response 200: { ok:true, model:'GFS 0.25°', run, fh, valid, la0 (north edge), lo0 (west edge), d:0.25, nx, ny,
                   lev:[hPa…], u:[[kt…]…], v:[[…]…], t:[[°C…]…], z:[[ft…]…] }   (rows north → south, columns west → east)
   For training and planning practice: the page tells the user to check the official forecast. */

import { readGrib2 } from '../_lib/grib2.js';

const NOMADS = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl';
const UA = 'Birdbird/1.0 (+https://birdbird.eu)';
export const LEVELS = [1000, 925, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150];
const TILE = 5;
const TTL = 7200;
const TIMEOUT = 12000;
const H = 3600e3;
const KT = 1.9438445, FT = 3.28084;

const json = (body, status, cache) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache || 'no-store', 'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*' }
});

export function parseTile(q) {
  const m = String(q || '').match(/^(-?\d{1,2}),(-?\d{1,3})$/); if (!m) return null;
  const la = +m[1], lo = +m[2];
  if (la % TILE || lo % TILE || la < -90 || la > 90 - TILE || lo < -180 || lo > 180 - TILE) return null;
  return { la, lo };
}

/* newest cycles first: GFS 0.25° reaches NOMADS about 3.5–5 h after the cycle time */
export function cycles(now) {
  const t = now.getTime() - 3.5 * H, c0 = Math.floor(t / (6 * H)) * 6 * H;
  return [c0, c0 - 6 * H, c0 - 12 * H].map(x => new Date(x));
}
export function forecastHour(run, target) {
  let fh = Math.round((target.getTime() - run.getTime()) / H);
  if (fh < 0) fh = 0;
  if (fh > 120) fh = Math.min(384, Math.round(fh / 3) * 3);
  return fh;
}
const p2 = n => String(n).padStart(2, '0');
export function nomadsUrl(run, fh, tile) {
  const ymd = run.getUTCFullYear() + p2(run.getUTCMonth() + 1) + p2(run.getUTCDate()), hh = p2(run.getUTCHours());
  const w = tile.lo < 0 ? tile.lo + 360 : tile.lo, e = w + TILE;
  const q = ['dir=' + encodeURIComponent('/gfs.' + ymd + '/' + hh + '/atmos'), 'file=gfs.t' + hh + 'z.pgrb2.0p25.f' + String(fh).padStart(3, '0'),
    'var_HGT=on', 'var_TMP=on', 'var_UGRD=on', 'var_VGRD=on'].concat(LEVELS.map(l => 'lev_' + l + '_mb=on'))
    .concat(['subregion=', 'toplat=' + (tile.la + TILE), 'bottomlat=' + tile.la, 'leftlon=' + w, 'rightlon=' + e]);
  return NOMADS + '?' + q.join('&');
}

/* decoded messages → compact tile (north → south rows) */
export function toTile(msgs, tile) {
  const F = { '0/0': 't', '2/2': 'u', '2/3': 'v', '3/5': 'z' };
  const out = { lev: LEVELS.slice(), u: [], v: [], t: [], z: [] };
  let g = null, ref = null, fh = null;
  const by = {};
  msgs.forEach(m => {
    if (m.disc !== 0 || m.level.type !== 100) return;
    const k = F[m.cat + '/' + m.num]; if (!k) return;
    const hpa = Math.round(m.level.value / 100); if (!LEVELS.includes(hpa)) return;
    by[k + hpa] = m; if (!g) { g = m; ref = m.ref; fh = m.fhr; }
  });
  if (!g) throw new Error('no fields');
  const nx = g.ni, ny = g.nj, south = (g.scan & 0x40) !== 0;
  const la0 = south ? g.la1 + (ny - 1) * g.dj : g.la1;
  let lo0 = g.lo1; if (lo0 > 180) lo0 -= 360;
  const conv = { u: v => Math.round(v * KT * 10) / 10, v: v => Math.round(v * KT * 10) / 10, t: v => Math.round((v - 273.15) * 10) / 10, z: v => Math.round(v * FT / 10) * 10 };
  ['u', 'v', 't', 'z'].forEach(k => LEVELS.forEach(l => {
    const m = by[k + l];
    if (!m || m.ni !== nx || m.nj !== ny) { out[k].push(null); return; }
    const a = new Array(nx * ny);
    for (let j = 0; j < ny; j++) { const jj = south ? ny - 1 - j : j; for (let i = 0; i < nx; i++) a[j * nx + i] = conv[k](m.values[jj * nx + i]); }
    out[k].push(a);
  }));
  return Object.assign({ la0, lo0, d: g.dj, nx, ny, run: ref ? ref.toISOString() : null, fh, valid: ref ? new Date(ref.getTime() + fh * H).toISOString() : null }, out);
}

export async function handleWinds(request, env, deps) {
  deps = deps || {};
  const fetchFn = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const now = deps.now ? new Date(deps.now()) : new Date();
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'method', message: 'Use GET.' }, 405);
  const tile = parseTile(url.searchParams.get('tile'));
  if (!tile) return json({ ok: false, error: 'bad_tile', message: 'Give the south-west corner of a 5° tile, e.g. ?tile=55,5.' }, 400);
  let target = url.searchParams.get('t') ? new Date(url.searchParams.get('t')) : now;
  if (isNaN(target)) return json({ ok: false, error: 'bad_time', message: 'Give the time as ISO 8601, e.g. 2026-11-15T12:00Z.' }, 400);
  if (target < now - 6 * H) target = new Date(now - 6 * H);
  if (target > now + 5 * 24 * H) return json({ ok: false, error: 'bad_time', message: 'The forecast goes 5 days ahead.' }, 400);
  target = new Date(Math.round(target.getTime() / H) * H);

  const C = cycles(now);
  const key = new Request(url.origin + '/api/winds?tile=' + tile.la + ',' + tile.lo + '&t=' + target.toISOString() + '&c=' + C[0].toISOString(), { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) {} }

  let last = null;
  for (const run of C) {
    const fh = forecastHour(run, target);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetchFn(nomadsUrl(run, fh, tile), { headers: { 'user-agent': UA }, signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) { last = 'HTTP ' + r.status; continue; }
      const b = new Uint8Array(await r.arrayBuffer());
      if (!(b[0] === 0x47 && b[1] === 0x52 && b[2] === 0x49 && b[3] === 0x42)) { last = 'not on the server yet'; continue; } // NOMADS answers 200 + HTML when a file is missing
      const t = toTile(readGrib2(b), tile);
      const body = Object.assign({ ok: true, model: 'GFS 0.25°', source: 'NOAA NCEP GFS via NOMADS' }, t);
      const res = json(body, 200, 'public, max-age=1800, s-maxage=' + TTL);
      if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); if (deps.waitUntil) deps.waitUntil(put); else await put; }
      return res;
    } catch (e) {
      clearTimeout(timer);
      last = e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'error';
    }
  }
  return json({ ok: false, error: 'upstream', message: 'The forecast model could not be fetched right now (' + last + '). Try again in a few minutes.' }, 502);
}

export async function onRequestGet(ctx) {
  return handleWinds(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null });
}
