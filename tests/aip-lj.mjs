/* Weekly: Slovenia's chart pages (a fixed list in functions/_lib/aipres.js) must still exist, and its AD 2 index must not
   list an aerodrome we lack. Slovenia's certificate chain is incomplete, so this one check runs without verifying it
   (it only reads; nothing is sent). Run by .github/workflows/aip-links.yml with NODE_TLS_REJECT_UNAUTHORIZED=0. */
import { resolve } from '../functions/_lib/aipres.js';
const UA = 'Mozilla/5.0 (compatible; Birdbird/1.0; +https://birdbird.eu)';
const get = async u => { const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(90000) }); return { ok: r.ok, status: r.status, t: await r.text() }; };
const bad = [];
const portal = await get('https://aim.sloveniacontrol.si/aim/products/aip/');
console.log((portal.ok ? 'ok   ' : 'FAIL ') + 'portal ' + portal.status);
if (!portal.ok) bad.push('Slovenia portal (' + portal.status + ')');
const idx = await get('https://aim.sloveniacontrol.si/aim/products/aip/part-3-aerodromes-ad/ad-2-aerodromes/');
const listed = [...new Set([...idx.t.matchAll(/\/charts\/aerodromes\/(lj[a-z]{2})-/g)].map(m => m[1].toUpperCase()))];
console.log('Slovenia lists', listed.join(' ') || '(none)');
if (!listed.length) bad.push('Slovenia: AD 2 index lists no aerodromes (' + idx.status + ')');
for (const icao of new Set(listed.concat(['LJLJ', 'LJMB', 'LJPZ', 'LJCE']))) {
  const r = await resolve(icao, { cache: null, fetch: null });
  const c = r.ok ? await get(r.url) : { ok: false, status: 'not in our list' };
  console.log((r.ok && c.ok ? 'ok   ' : 'FAIL ') + icao + '  ' + (r.url || '') + '  ' + c.status);
  if (!(r.ok && c.ok)) bad.push('Slovenia ' + icao + ': ' + (r.url || '') + ' (' + c.status + ')');
}
if (bad.length) { console.error('\n' + bad.join('\n')); process.exit(1); }
