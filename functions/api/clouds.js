/* NORDAP – Cloudflare Pages Function: GET /api/clouds?tile=55,5[&t=2026-11-15T12:00Z]
   Forecast cloud layers for one 5° × 5° tile from NOAA's GFS model (0.25°, hourly to 120 h; public domain), the same model and
   tiles as /api/winds: low, middle and high cloud (cover, base and top), the cloud ceiling, the freezing level, the ground
   height and CAPE (energy for convection). Weather radar shows precipitation, not cloud; this is what answers "where are the
   layers?" between the airports that report a METAR.

   Response 200: { ok:true, model, run, fh, valid, la0 (north edge), lo0 (west edge), d:0.25, nx, ny,
     lc, mc, hc, tc    cover of the low / middle / high cloud layer and of all cloud, % (time average over the last hour or few)
     lb, lt, mb, mt, hb, ht   base and top of each layer, ft pressure altitude (≈ FL × 100); null where there is no layer
     ceil              cloud ceiling, ft above mean sea level; null where there is none
     frz               freezing level (0 °C), ft above mean sea level
     sfc               model ground height, ft
     cape              CAPE at the surface, J/kg }      (each an array, rows north → south, columns west → east)
   For understanding and planning practice: the page always points to the official forecast and the METAR/TAF. */

import { readGrib2 } from '../_lib/grib2.js';
import { parseTile, cycles, forecastHour } from './winds.js';

const NOMADS = 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl';
const UA = 'NORDAP/1.0 (+https://nordap.eu)';
const TILE = 5, TTL = 7200, TIMEOUT = 15000, H = 3600e3, FT = 3.28084;
const json = (body, status, cache) => new Response(JSON.stringify(body), {
  status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache || 'no-store', 'x-content-type-options': 'nosniff' }
});
const p2 = n => String(n).padStart(2, '0');

/* pressure (Pa) → ISA pressure altitude (ft) */
export const pressAlt = p => 145366.45 * (1 - Math.pow(p / 101325, 0.190284));

export function nomadsUrl(run, fh, tile) {
  const ymd = run.getUTCFullYear() + p2(run.getUTCMonth() + 1) + p2(run.getUTCDate()), hh = p2(run.getUTCHours());
  const w = tile.lo < 0 ? tile.lo + 360 : tile.lo, e = w + TILE;
  const lev = ['low_cloud_layer', 'middle_cloud_layer', 'high_cloud_layer', 'low_cloud_bottom_level', 'low_cloud_top_level', 'middle_cloud_bottom_level',
    'middle_cloud_top_level', 'high_cloud_bottom_level', 'high_cloud_top_level', 'cloud_ceiling', '0C_isotherm', 'surface', 'entire_atmosphere'];
  const q = ['dir=' + encodeURIComponent('/gfs.' + ymd + '/' + hh + '/atmos'), 'file=gfs.t' + hh + 'z.pgrb2.0p25.f' + String(fh).padStart(3, '0'),
    'var_LCDC=on', 'var_MCDC=on', 'var_HCDC=on', 'var_TCDC=on', 'var_PRES=on', 'var_HGT=on', 'var_CAPE=on'].concat(lev.map(l => 'lev_' + l + '=on'))
    .concat(['subregion=', 'toplat=' + (tile.la + TILE), 'bottomlat=' + tile.la, 'leftlon=' + w, 'rightlon=' + e]);
  return NOMADS + '?' + q.join('&');
}

/* which field is which: discipline 0, category/number, level type */
const FIELDS = {
  lc: ['6/3', 214], mc: ['6/4', 224], hc: ['6/5', 234], tc: ['6/1', 10],
  lb: ['3/0', 212], lt: ['3/0', 213], mb: ['3/0', 222], mt: ['3/0', 223], hb: ['3/0', 232], ht: ['3/0', 233],
  ceil: ['3/5', 215], frz: ['3/5', 4], sfc: ['3/5', 1], cape: ['7/6', 1]
};
const ok = v => v != null && isFinite(v);
const CONV = {
  lc: v => Math.round(v), mc: v => Math.round(v), hc: v => Math.round(v), tc: v => Math.round(v),
  lb: v => Math.round(pressAlt(v) / 100) * 100, lt: v => Math.round(pressAlt(v) / 100) * 100, mb: v => Math.round(pressAlt(v) / 100) * 100,
  mt: v => Math.round(pressAlt(v) / 100) * 100, hb: v => Math.round(pressAlt(v) / 100) * 100, ht: v => Math.round(pressAlt(v) / 100) * 100,
  ceil: v => v > 0 && v < 30000 ? Math.round(v * FT / 100) * 100 : null, frz: v => Math.round(v * FT / 100) * 100, sfc: v => Math.round(v * FT), cape: v => Math.round(v)
};

export function toTile(msgs) {
  const by = {};
  for (const m of msgs) {
    if (m.disc !== 0) continue;
    const k = Object.keys(FIELDS).find(f => FIELDS[f][0] === m.cat + '/' + m.num && FIELDS[f][1] === m.level.type);
    if (k && !by[k]) by[k] = m;
  }
  const g = by.lc || by.frz || Object.values(by)[0];
  if (!g) throw new Error('no fields');
  const nx = g.ni, ny = g.nj, south = (g.scan & 0x40) !== 0;
  const la0 = south ? g.la1 + (ny - 1) * g.dj : g.la1;
  let lo0 = g.lo1; if (lo0 > 180) lo0 -= 360;
  const out = { la0, lo0, d: g.dj, nx, ny, run: g.ref ? g.ref.toISOString() : null, fh: g.fhr };
  for (const k of Object.keys(FIELDS)) {
    const m = by[k];
    if (!m || m.ni !== nx || m.nj !== ny) { out[k] = null; continue; }
    const a = new Array(nx * ny);
    for (let j = 0; j < ny; j++) { const jj = south ? ny - 1 - j : j; for (let i = 0; i < nx; i++) { const v = m.values[jj * nx + i]; a[j * nx + i] = ok(v) ? CONV[k](v) : null; } }
    out[k] = a;
  }
  return out;
}

export async function handleClouds(request, env, deps) {
  deps = deps || {};
  const fetchFn = deps.fetch || ((u, o) => fetch(u, o));
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const now = deps.now ? new Date(deps.now()) : new Date();
  const url = new URL(request.url);
  const tile = parseTile(url.searchParams.get('tile'));
  if (!tile) return json({ ok: false, error: 'bad_tile', message: 'Give the south-west corner of a 5° tile, e.g. ?tile=55,5.' }, 400);
  let target = url.searchParams.get('t') ? new Date(url.searchParams.get('t')) : now;
  if (isNaN(target)) return json({ ok: false, error: 'bad_time', message: 'Give the time as ISO 8601, e.g. 2026-11-15T12:00Z.' }, 400);
  if (target < now - 6 * H) target = new Date(now - 6 * H);
  if (target > now + 5 * 24 * H) return json({ ok: false, error: 'bad_time', message: 'The forecast goes 5 days ahead.' }, 400);
  target = new Date(Math.round(target.getTime() / H) * H);
  const C = cycles(now);
  const key = new Request(url.origin + '/api/clouds?tile=' + tile.la + ',' + tile.lo + '&t=' + target.toISOString() + '&c=' + C[0].toISOString(), { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) {} }
  let last = null;
  for (const run of C) {
    const fh = Math.max(1, forecastHour(run, target)); // the cloud layers are averages: there are none at hour 0
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const r = await fetchFn(nomadsUrl(run, fh, tile), { headers: { 'user-agent': UA }, signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) { last = 'HTTP ' + r.status; continue; }
      const b = new Uint8Array(await r.arrayBuffer());
      if (!(b[0] === 0x47 && b[1] === 0x52 && b[2] === 0x49 && b[3] === 0x42)) { last = 'not on the server yet'; continue; }
      const t = toTile(readGrib2(b));
      t.run = run.toISOString(); t.fh = fh; t.valid = new Date(run.getTime() + fh * H).toISOString();
      const res = json(Object.assign({ ok: true, model: 'GFS 0.25°', source: 'NOAA NCEP GFS via NOMADS' }, t), 200, 'public, max-age=1800, s-maxage=' + TTL);
      if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); if (deps.waitUntil) deps.waitUntil(put); else await put; }
      return res;
    } catch (e) {
      clearTimeout(timer);
      last = e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'error';
    }
  }
  return json({ ok: false, error: 'upstream', message: 'The forecast model could not be fetched right now (' + last + '). Try again in a few minutes.' }, 502);
}
export async function onRequestGet(ctx) { return handleClouds(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null }); }
