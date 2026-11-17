/* NORDAP – Cloudflare Pages Function: GET /api/aip?icao=ENTO[&go=1]
   The aerodrome's page (AD 2, with its charts) in the national eAIP edition that is in force today, found afresh from the
   state's own index (see functions/_lib/aipres.js). With go=1 the browser is sent straight there (302); when the state's eAIP
   is not open or the aerodrome is not in it, to the state's AIP portal instead. Without go: JSON { ok, icao, url, kind, name, eff }. */
import { resolve } from '../_lib/aipres.js';

export async function handleAip(request, env, deps) {
  deps = deps || {};
  const url = new URL(request.url);
  const icao = String(url.searchParams.get('icao') || '').toUpperCase().trim();
  const r = await resolve(icao, { fetch: deps.fetch || ((u, o) => fetch(u, o)), cache: deps.cache, waitUntil: deps.waitUntil, today: deps.today, log: m => console.log('aip ' + m) });
  if (r.error) return new Response(JSON.stringify({ ok: false, message: 'Use a four-letter ICAO code, e.g. ?icao=ENTO.' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  const age = r.lookupFailed ? 300 : 1800;
  if (url.searchParams.get('go')) return new Response(null, { status: 302, headers: { location: r.url, 'cache-control': 'public, max-age=' + age, 'x-aip': r.kind } });
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + age } });
}
export async function onRequestGet(ctx) { return handleAip(ctx.request, ctx.env, { waitUntil: ctx.waitUntil ? p => ctx.waitUntil(p) : null }); }
