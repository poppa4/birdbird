/* NORDAP – Cloudflare Pages Function: GET /api/outlook-area?lat=59.1867&lon=10.2586&t=2026-11-23T09:00Z&r=50
   The forecast outlook at 17 points within r NM (10–150) of the aerodrome, ±6 hours (functions/_lib/outlook.js, buildArea).
   Response 200: { ok:true, model, rNm, t, tIdx, hours:[{ t, pts:[{ lat, lon, brg, d, el, sera, lowest, ceil, vis, wind, precip, ptype, cb, frz, … }] }] }
   A model estimate for planning practice, not an official forecast. */
import { buildArea } from '../_lib/outlook.js';
import { parseReq } from './outlook.js';

const json = (body, status, cache) => new Response(JSON.stringify(body), {
  status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache || 'no-store', 'x-content-type-options': 'nosniff' }
});
export async function handleArea(request, env, deps) {
  deps = deps || {}; const now = deps.now ? deps.now() : Date.now(); const url = new URL(request.url);
  const p = parseReq(url, now); if (p.err) return json({ ok: false, error: p.err, message: p.msg }, 400);
  const r = Math.round(+url.searchParams.get('r') || 50); if (!(r >= 10 && r <= 150)) return json({ ok: false, error: 'bad_request', message: 'r is the radius in NM, 10 to 150.' }, 400);
  try { const out = await buildArea({ ...p, rNm: r }, { fetch: deps.fetch || fetch, now: () => now }); return json(out, out.ok ? 200 : 502, out.ok ? 'public, max-age=600' : null); }
  catch (e) { return json({ ok: false, error: 'upstream', message: 'The model for the area could not be read right now.' }, 502); }
}
export async function onRequestGet(ctx) { return handleArea(ctx.request, ctx.env, {}); }
