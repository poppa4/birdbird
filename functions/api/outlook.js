/* NORDAP – Cloudflare Pages Function: GET /api/outlook?icao=ENTO&lat=59.1867&lon=10.2586&el=286&t=2026-11-23T09:00Z
   Forecast outlook for one aerodrome at one whole hour (UTC), up to 7 days ahead: several weather models boiled down to cloud
   layers, ceiling, visibility, wind, freezing level, icing, convection and an estimated SERA status (functions/_lib/outlook.js).
   lat/lon/el (ft) come from the site's aerodrome list; icao is used for the TAF/METAR check only.

   Response 200: { ok:true, icao, t, leadH, hours:[{ t, cons }], tIdx, members, sources, taf, metar, generated }
   Errors: { ok:false, error:'bad_request'|'too_far'|'upstream', message } with 400 / 502.
   A model estimate for planning practice, not an official forecast. */

import { buildOutlook } from '../_lib/outlook.js';

const json = (body, status, cache) => new Response(JSON.stringify(body), {
  status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache || 'no-store', 'x-content-type-options': 'nosniff' }
});
const H = 36e5, MAX_H = 7 * 24;

export function parseReq(url, now) {
  const q = url.searchParams, lat = +q.get('lat'), lon = +q.get('lon'), el = q.get('el') == null || q.get('el') === '' ? 0 : +q.get('el');
  const icao = String(q.get('icao') || '').toUpperCase();
  let ts = String(q.get('t') || ''); if (ts && !/(Z|[+-]\d\d:?\d\d)$/.test(ts)) ts += 'Z';
  const t = Date.parse(ts);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180 || !isFinite(el) || el < -1500 || el > 15000) return { err: 'bad_request', msg: 'Give lat, lon and el (ft) of the aerodrome.' };
  if (icao && !/^[A-Z0-9]{4}$/.test(icao)) return { err: 'bad_request', msg: 'icao must be a 4-letter code.' };
  if (!isFinite(t)) return { err: 'bad_request', msg: 'Give t as an ISO time in UTC, e.g. 2026-11-23T09:00Z.' };
  const th = Math.round(t / H) * H;
  if (th < now - 2 * H) return { err: 'too_far', msg: 'That time has passed: the METAR tells what happened.' };
  if (th > now + MAX_H * H) return { err: 'too_far', msg: 'More than 7 days ahead: the models are too uncertain to estimate cloud heights.' };
  return { lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, elevFt: Math.round(el), t: new Date(th).toISOString(), icao: icao || null };
}

export async function handleOutlook(request, env, deps) {
  deps = deps || {};
  const now = deps.now ? deps.now() : Date.now();
  const url = new URL(request.url);
  if (url.searchParams.get('ping')) return json({ ok: true });
  const p = parseReq(url, now);
  if (p.err) return json({ ok: false, error: p.err, message: p.msg }, 400);
  try {
    const out = await buildOutlook({ ...p, origin: url.origin }, { fetch: deps.fetch || fetch, now: () => now });
    if (!out.hours[out.tIdx].cons) return json({ ok: false, error: 'upstream', message: 'No weather model answered. Try again in a minute.', sources: out.sources }, 502);
    return json(out, 200, 'public, max-age=600');
  } catch (e) {
    return json({ ok: false, error: 'upstream', message: 'The weather models could not be read right now. Try again in a minute.' }, 502);
  }
}

export async function onRequestGet(ctx) { return handleOutlook(ctx.request, ctx.env, {}); }
