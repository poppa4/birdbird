/* Weekly check that every AIP link in aip.js still answers (run by .github/workflows/aip-links.yml, or by hand:
   node tests/aip-links.mjs). Exit 1 lists the dead ones, so the workflow fails and GitHub e-mails the owner.
   Not part of `node --test`: it needs the network. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const window = {}; new Function('window', readFileSync(join(ROOT, 'aip.js'), 'utf8'))(window);
const B = window.BBAIP;
const urls = new Map();
Object.values(B.ALL).concat([B.EAD, B.DIR]).forEach(x => urls.set(x.url, x.name));
const UA = 'Birdbird link check (+https://birdbird.eu)';
async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (r.status < 400) return { ok: true, status: r.status, final: r.url };
      if (method === 'GET') return { ok: false, status: r.status };
    } catch (e) { if (method === 'GET') return { ok: false, status: String(e && e.name || e) }; }
  }
}
const bad = [];
for (const [url, name] of urls) {
  const r = await check(url);
  console.log((r.ok ? 'ok   ' : 'DEAD ') + String(r.status).padEnd(5) + name + '  ' + url + (r.final && r.final !== url ? '  → ' + r.final : ''));
  if (!r.ok) bad.push(name + ': ' + url + ' (' + r.status + ')');
}
/* every state with a deep link: the AD 2 page of one aerodrome must be found in the edition in force, and must answer */
const { resolve } = await import('../functions/_lib/aipres.js');
const SAMPLE = { EN: 'ENTO', ES: 'ESSA', EF: 'EFHK', BI: 'BIRK', EG: 'EGLL', EB: 'EBBR', EP: 'EPWA', EE: 'EETN', EV: 'EVRA', LH: 'LHBP', LP: 'LPPT', LZ: 'LZIB', LK: 'LKPR', LE: 'LEMD', LF: 'LFPG' };
const tf = (u, o) => fetch(u, Object.assign({ signal: AbortSignal.timeout(40000) }, o));
for (const [st, icao] of Object.entries(SAMPLE)) {
  const r = await resolve(icao, { fetch: tf, cache: null, log: m => console.log('  ' + m) });
  const c = r.ok ? await check(r.url) : { ok: false, status: r.kind };
  const blocked = c.status === 403 && st === 'EB';   // skeyes refuses data-centre addresses; it opens fine in a browser
  console.log((r.ok && (c.ok || blocked) ? 'ok   ' : 'FAIL ') + 'AD 2 ' + icao + '  ' + (r.url || '') + (r.eff ? '  (in force ' + r.eff + ')' : ''));
  if (!r.ok || !(c.ok || blocked)) bad.push('AD 2 lookup ' + st + ' (' + icao + '): ' + (r.url || '') + ' (' + c.status + ')');
}
if (bad.length) { console.error('\nDead AIP links:\n' + bad.join('\n')); process.exit(1); }
console.log('\nAll ' + urls.size + ' AIP portals answer, and every state finds its AD 2 pages.');
