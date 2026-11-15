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
if (bad.length) { console.error('\nDead AIP links:\n' + bad.join('\n')); process.exit(1); }
console.log('\nAll ' + urls.size + ' AIP links answer.');
