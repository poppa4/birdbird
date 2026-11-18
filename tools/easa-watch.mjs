/* NORDAP – weekly EASA check (run by .github/workflows/easa-watch.yml).
   For each Easy Access Rules publication easa.js is built from (EASA.sources), reads the revision EASA's page names today
   (its og:title, e.g. "Revision 24, March 2026") and compares it with the revision the library was checked against
   (sources.*.watch). A difference means EASA has published a new revision: the run fails, which e-mails the repository
   owner, and the summary says which publication changed. Then the entries from that source are re-checked against the new
   text, and watch/rev in easa.js are updated.
   Exit 0: all match. Exit 1: a new revision. Exit 2: a page could not be read (EASA down or changed its page). */
import { createRequire } from 'node:module';
const EASA = createRequire(import.meta.url)('../easa.js');
const UA = 'NORDAP/1.0 (+https://nordap.eu; weekly EASA revision check)';
export function revisionOf(html) {
  const t = (/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i.exec(html) || /<title>([^<]+)<\/title>/i.exec(html) || [])[1] || '';
  const m = /(Revision[^—|]*?\d{4})/i.exec(t.replace(/&amp;/g, '&')); return m ? m[1].trim() : null;
}
async function page(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.text(); }
    catch (e) { /* retry */ }
    await new Promise(f => setTimeout(f, 3000 * (i + 1)));
  }
  return null;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  let changed = 0, broken = 0; const lines = [];
  for (const [k, s] of Object.entries(EASA.sources)) {
    const html = await page(s.ear), now = html && revisionOf(html);
    if (!now) { broken++; lines.push(`?  ${s.name}: could not read the revision from ${s.ear}`); continue; }
    if (now.toLowerCase() === String(s.watch).toLowerCase()) lines.push(`OK ${s.name}: ${now}`);
    else { changed++; lines.push(`NEW ${s.name}: EASA now publishes "${now}", the library was checked against "${s.watch}". Re-check the ${k} entries in easa.js.`); }
  }
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) { const fs = await import('node:fs'); fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### EASA Easy Access Rules\n\n' + lines.map(l => '- ' + l).join('\n') + '\n'); }
  process.exit(changed ? 1 : broken ? 2 : 0);
}
