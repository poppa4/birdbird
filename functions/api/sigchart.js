/* NORDAP – Cloudflare Pages Function: GET /api/sigchart?area=nordic|norway&offset=0..3
   Low-level significant weather charts (PNG) from MET Norway (api.met.no sigcharts 2.0, CC BY 4.0): the Nordic and
   Baltic area (Iceland excluded) or Norway, Svalbard and the Norwegian Sea. Proxied so MET Norway sees our User-Agent,
   and cached 15 min at the edge. offset picks the chart in the series (0 = the first one MET Norway lists). */
const MET = 'https://api.met.no/weatherapi/sigcharts/2.0/';
const UA = 'NORDAP/1.0 (+https://nordap.eu)';
const TTL = 900;
const AREAS = ['nordic', 'norway'];
const err = (status, message) => new Response(JSON.stringify({ ok: false, message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function handleSigchart(request, env, deps) {
  deps = deps || {};
  const fetchFn = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const url = new URL(request.url);
  const area = String(url.searchParams.get('area') || 'nordic').toLowerCase();
  const offset = String(url.searchParams.get('offset') || '0');
  if (!AREAS.includes(area) || !/^[0-3]$/.test(offset)) return err(400, 'Use area=nordic or norway and offset=0–3.');
  const key = new Request(url.origin + '/api/sigchart?area=' + area + '&offset=' + offset, { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) {} }
  let r;
  try { r = await fetchFn(MET + '?area=' + area + '&offset=' + offset, { headers: { 'user-agent': UA, accept: 'image/png' }, cf: { cacheTtl: TTL, cacheEverything: true } }); }
  catch (e) { return err(502, 'MET Norway did not answer.'); }
  const ct = r.headers.get('content-type') || '';
  if (r.status === 404 || r.status === 204) return err(404, 'No chart for this time.');
  if (!r.ok || !/^image\//.test(ct)) return err(502, 'MET Norway did not return a chart' + (r.ok ? '' : ' (HTTP ' + r.status + ')') + '.');
  const res = new Response(r.body, { status: 200, headers: { 'content-type': ct, 'cache-control': 'public, max-age=600, s-maxage=' + TTL, 'x-source': 'MET Norway (CC BY 4.0)' } });
  if (cache) { const put = cache.put(key, res.clone()).catch(() => {}); if (deps.waitUntil) deps.waitUntil(put); else await put; }
  return res;
}
export async function onRequestGet(ctx) { return handleSigchart(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null }); }
