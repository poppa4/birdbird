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
const UA = 'NORDAP link check (+https://birdbird.eu)';
async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (r.status < 400) return { ok: true, status: r.status, final: r.url };
      if (r.status === 403 && method === 'GET') return { ok: true, status: '403 (site refuses data-centre addresses; answers in a browser)' };
      if (method === 'GET') return { ok: false, status: r.status };
    } catch (e) { if (method === 'GET') return { ok: false, status: String(e && e.name || e) }; }
  }
}
const bad = [];
for (const [url, name] of urls) {
  if (/sloveniacontrol\.si/.test(url)) continue;   // checked by tests/aip-lj.mjs (incomplete certificate chain)
  const r = await check(url);
  console.log((r.ok ? 'ok   ' : 'DEAD ') + String(r.status).padEnd(5) + name + '  ' + url + (r.final && r.final !== url ? '  → ' + r.final : ''));
  if (!r.ok) bad.push(name + ': ' + url + ' (' + r.status + ')');
}
/* every state with a deep link: the AD 2 page of one aerodrome must be found in the edition in force, and must answer */
const { resolve } = await import('../functions/_lib/aipres.js');
/* two or three aerodromes per state (a big one and a small one), and a code that is in no AIP: it must fall back to the portal */
const SAMPLE = { EN: ['ENTO', 'ENGM', 'ENSB'], ES: ['ESSA', 'ESSB'], EF: ['EFHK', 'EFRO'], BI: ['BIRK', 'BIEG'], EG: ['EGLL', 'EGPH'], EB: ['EBBR'],
  EP: ['EPWA', 'EPGD'], EE: ['EETN'], EV: ['EVRA'], LH: ['LHBP'], LP: ['LPPT', 'LPFR'], LZ: ['LZIB'], LK: ['LKPR', 'LKTB'], LE: ['LEMD', 'GCLP'],
  LF: ['LFPG', 'LFMN'], ED: ['EDDF', 'EDFE', 'ETNL'], EK: ['EKCH', 'EKRK', 'EKVG', 'BGSF'], LO: ['LOWW', 'LOAG'], LY: ['LYBE', 'LYPG'], LA: ['LATI'], LQ: ['LQSA'], LR: ['LROP', 'LRCL'], BK: ['BKPR'] };
const tf = (u, o) => fetch(u, Object.assign({ signal: AbortSignal.timeout(40000) }, o));
for (const [st, list] of Object.entries(SAMPLE)) for (const icao of list.concat([st + '9Z'])) {
  const none = icao.endsWith('9Z');
  const r = await resolve(icao, { fetch: tf, cache: null, log: m => console.log('  ' + m) });
  const c = await check(r.url);
  const blocked = c.status && String(c.status).startsWith('403');
  const good = none ? !r.ok && c.ok : r.ok && c.ok;
  console.log((good ? 'ok   ' : 'FAIL ') + (none ? 'no AD ' : 'AD 2 ') + icao + '  ' + r.kind + '  ' + (r.url || '') + (r.eff ? '  (in force ' + r.eff + ')' : '') + (blocked ? '  [site refuses checks]' : ''));
  if (!good) bad.push((none ? 'fallback ' : 'AD 2 lookup ') + st + ' (' + icao + '): ' + r.kind + ' ' + (r.url || '') + ' (' + c.status + ')' + (r.why ? ' – ' + r.why : ''));
}
if (bad.length) { console.error('\nDead AIP links:\n' + bad.join('\n')); process.exit(1); }
console.log('\nAll ' + urls.size + ' AIP portals answer, and every state finds its AD 2 pages.');
