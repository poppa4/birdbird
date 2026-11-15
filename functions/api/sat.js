/* Birdbird – Cloudflare Pages Function: GET /api/sat?bbox=minx,miny,maxx,maxy (EPSG:3857)&t=YYYY-MM-DDTHH:00:00Z
   Meteosat infrared (10.8 µm) cloud image from EUMETSAT's EUMETView WMS, one 256 px map tile, for the full hour t.
   Hourly EUMETSAT imagery is free of licensing (EUMETSAT data policy); shown with "© EUMETSAT". Proxied because the WMS
   sends no CORS headers (the map needs them for WebGL), and cached for everyone. The first layer that answers is used:
   MTG (Meteosat Third Generation) if available, else MSG. */
const WMS = 'https://view.eumetsat.int/geoserver/wms';
export const LAYERS = ['mtg_fd:ir105_hrfi', 'msg_fes:ir108']; // names checked against EUMETView GetCapabilities (Nov 2026)
const UA = 'Birdbird/1.0 (+https://birdbird.eu)';
const err = (s, m) => new Response(JSON.stringify({ ok: false, message: m }), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export function getMapUrl(layer, bbox, t, size) {
  const q = { service: 'WMS', version: '1.3.0', request: 'GetMap', layers: layer, styles: '', format: 'image/png', transparent: 'true', crs: 'EPSG:3857', width: size, height: size, bbox: bbox.join(',') };
  if (t) q.time = t;
  return WMS + '?' + Object.entries(q).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}
export async function handleSat(request, env, deps) {
  deps = deps || {};
  const fetchFn = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const url = new URL(request.url);
  const bbox = String(url.searchParams.get('bbox') || '').split(',').map(Number);
  const t = url.searchParams.get('t') || '';
  if (bbox.length !== 4 || bbox.some(v => !Number.isFinite(v) || Math.abs(v) > 2.1e7)) return err(400, 'Give bbox=minx,miny,maxx,maxy in EPSG:3857.');
  if (t && !/^\d{4}-\d{2}-\d{2}T\d{2}:00:00(\.000)?Z$/.test(t)) return err(400, 'Give t as a full hour, e.g. 2026-11-15T14:00:00Z.');
  const key = new Request(url.origin + '/api/sat?bbox=' + bbox.join(',') + '&t=' + t, { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) {} }
  for (const layer of LAYERS) {
    try {
      const r = await fetchFn(getMapUrl(layer, bbox, t, 256), { headers: { 'user-agent': UA, accept: 'image/png' }, cf: { cacheTtl: 3600, cacheEverything: true } });
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !/^image\//.test(ct)) continue; // GeoServer answers XML (ServiceException) for an unknown layer or time
      const res = new Response(r.body, { status: 200, headers: { 'content-type': ct, 'cache-control': 'public, max-age=3600', 'x-layer': layer, 'x-source': '© EUMETSAT' } });
      if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); if (deps.waitUntil) deps.waitUntil(put); else await put; }
      return res;
    } catch (e) {}
  }
  return err(502, 'The satellite image could not be fetched.');
}
export async function onRequestGet(ctx) { return handleSat(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null }); }
