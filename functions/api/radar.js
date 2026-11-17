/* NORDAP – Cloudflare Pages Function: GET /api/radar[?t=YYYYMMDDTHHMM]
   The EUMETNET OPERA European radar composite (NIMBUS rain rate, 2 km, every 15 min; CC BY 4.0, © EUMETNET) as ODIM HDF5
   from the Open Radar Data 24-hour cache. Without t: JSON with the newest composite on the store ({ ok, t, url }), found with 1-byte range requests.
   With t: the file itself, passed through (no decoding here; radarworker.js draws it in the browser). Cached at the edge. */
const STORES = ['https://s3.waw3-1.cloudferro.com/openradar-24h', 'https://object-store.os-api.cci1.ecmwf.int/openradar-24h-backup', 'https://s3.waw3-1.cloudferro.com/openradar-archive'];
const UA = 'NORDAP/1.0 (+https://birdbird.eu)';
const STEP = 15 * 60e3;
const json = (b, s, c) => new Response(JSON.stringify(b), { status: s || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': c || 'no-store' } });
const p2 = n => String(n).padStart(2, '0');
export const stamp = d => d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + 'T' + p2(d.getUTCHours()) + p2(d.getUTCMinutes());
export const keyOf = t => t.slice(0, 4) + '/' + t.slice(4, 6) + '/' + t.slice(6, 8) + '/OPERA/COMP/OPERA@' + t + '@0@RATE.h5';
/* newest first: composites appear about 10 min after their time */
export function candidates(now) { const t0 = Math.floor((now.getTime() - 10 * 60e3) / STEP) * STEP; return [0, 1, 2, 3, 4].map(k => stamp(new Date(t0 - k * STEP))); }

export async function handleRadar(request, env, deps) {
  deps = deps || {};
  const fetchFn = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const now = deps.now ? new Date(deps.now()) : new Date();
  const url = new URL(request.url), t = url.searchParams.get('t');
  if (t != null && !/^\d{8}T\d{4}$/.test(t)) return json({ ok: false, error: 'bad_time', message: 'Use t=YYYYMMDDTHHMM.' }, 400);
  const key = new Request(url.origin + '/api/radar?' + (t ? 't=' + t : 'latest=' + candidates(now)[0]), { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) {} }
  if (!t) { // find the newest composite (cheap probes)
    for (const c of candidates(now)) for (const s of STORES) {
      try { const r = await fetchFn(s + '/' + keyOf(c), { headers: { 'user-agent': UA, range: 'bytes=0-0' } }); // 1 byte: works where HEAD is not allowed
        if (r.ok || r.status === 206) { const res = json({ ok: true, t: c, url: '/api/radar?t=' + c, source: 'EUMETNET OPERA (CC BY 4.0)' }, 200, 'public, max-age=120, s-maxage=300');
          if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); if (deps.waitUntil) deps.waitUntil(put); else await put; } return res; } } catch (e) {}
    }
    return json({ ok: false, error: 'upstream', message: 'No recent radar composite found. Try again in a few minutes.' }, 502);
  }
  for (const s of STORES) {
    try { const r = await fetchFn(s + '/' + keyOf(t), { headers: { 'user-agent': UA }, cf: { cacheTtl: 86400, cacheEverything: true } });
      if (!r.ok) continue;
      const res = new Response(r.body, { status: 200, headers: { 'content-type': 'application/x-hdf5', 'cache-control': 'public, max-age=86400, immutable', 'x-source': 'EUMETNET OPERA (CC BY 4.0)' } });
      if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); if (deps.waitUntil) deps.waitUntil(put); else await put; }
      return res; } catch (e) {}
  }
  return json({ ok: false, error: 'not_found', message: 'That radar composite is not available.' }, 404);
}
export async function onRequestGet(ctx) { return handleRadar(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null }); }
