import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, pickEdition, findAd2, airacOf, STATES } from '../functions/_lib/aipres.js';
import { handleAip } from '../functions/api/aip.js';

const site = pages => async (u) => { for (const [k, v] of Object.entries(pages)) if (u === k) return v === 404 ? new Response('', { status: 404 }) : new Response(v); return new Response('', { status: 404 }); };

test('picks the newest edition already in force', () => {
  const t = '<a href="2026-09-03-AIRAC/html/index-en-GB.html"></a><a href="2026-11-26-AIRAC/html/index-en-GB.html"></a><a href="2026-06-11-AIRAC/html/index-en-GB.html"></a>';
  assert.equal(pickEdition(t, STATES.EN.rx, '2026-11-16').eff, '2026-09-03');
  assert.equal(pickEdition(t, STATES.EN.rx, '2026-11-26').eff, '2026-11-26');
});
test('AIRAC dates', () => { assert.equal(airacOf('2026-11-16'), '2026-10-29'); assert.equal(airacOf('2026-11-26'), '2026-11-26'); });
test('finds the AD 2 page in a table of contents, English first', () => {
  const toc = `<a href="ES-AD 2 ESSA STOCKHOLM 1-sv-SE.html#x">.</a><a href="ES-AD 2 ESSA STOCKHOLM 1-en-GB.html#AD">.</a><a href="ES-ENR 2 ESSA.html">.</a>`;
  assert.equal(findAd2(toc, 'ESSA'), 'ES-AD 2 ESSA STOCKHOLM 1-en-GB.html');
  assert.equal(findAd2(toc, 'ESGG'), null);
});
test('Norway: AD 2 page of the edition in force, portal when the aerodrome is not in the AIP', async () => {
  const f = site({ 'https://aim-prod.avinor.no/no/AIP/': '<a href="2026-09-03-AIRAC/html/index-no-NO.html">', 'https://aim-prod.avinor.no/no/AIP/2026-09-03-AIRAC/html/eAIP/EN-AD-2.ENTO-en-GB.html': '<h1>ENTO SANDEFJORD</h1>' });
  const r = await resolve('ento', { fetch: f, cache: null, today: '2026-11-16' });
  assert.equal(r.ok, true); assert.equal(r.kind, 'ad2'); assert.match(r.url, /2026-09-03-AIRAC\/html\/eAIP\/EN-AD-2\.ENTO-en-GB\.html$/);
  const x = await resolve('ENZZ', { fetch: f, cache: null, today: '2026-11-16' });
  assert.equal(x.ok, false); assert.equal(x.kind, 'portal');
});
test('a state whose site fails still gives its portal; other states get EAD or the directory', async () => {
  const r = await resolve('EGLL', { fetch: async () => { throw new Error('down'); }, cache: null, today: '2026-11-16' });
  assert.equal(r.kind, 'portal'); assert.equal(r.lookupFailed, true);
  assert.match((await resolve('EDDF', { fetch: null, cache: null })).url, /^https:\/\/aip\.dfs\.de\/BasicIFR\/pages\/C[0-9A-F]+\.html$/);
  assert.equal((await resolve('LIRF', { fetch: null, cache: null })).kind, 'portal');
  assert.equal((await resolve('LXGB', { fetch: null, cache: null })).kind, 'ead');
  assert.equal((await resolve('KJFK', { fetch: null, cache: null })).kind, 'dir');
});
test('/api/aip redirects with go=1 and rejects bad codes', async () => {
  const f = site({ 'https://aim-prod.avinor.no/no/AIP/': '<a href="2026-09-03-AIRAC/html/index-no-NO.html">', 'https://aim-prod.avinor.no/no/AIP/2026-09-03-AIRAC/html/eAIP/EN-AD-2.ENTO-en-GB.html': '<h1>ENTO SANDEFJORD</h1>' });
  const r = await handleAip(new Request('https://nordap.eu/api/aip?icao=ENTO&go=1'), {}, { fetch: f, cache: null, today: '2026-11-16' });
  assert.equal(r.status, 302); assert.match(r.headers.get('location'), /EN-AD-2\.ENTO/);
  assert.equal((await handleAip(new Request('https://nordap.eu/api/aip?icao=x'), {}, { cache: null })).status, 400);
});

test('Belgium: blocked check, direct link only for aerodromes known to be in the AIP', async () => {
  const f = async () => new Response('', { status: 403 });
  assert.equal((await resolve('EBBR', { fetch: f, cache: null })).kind, 'ad2');
  assert.equal((await resolve('EBZW', { fetch: f, cache: null })).kind, 'portal');
});

test('a page that answers 200 but does not name the aerodrome is not taken', async () => {
  const f = site({ 'https://aim-prod.avinor.no/no/AIP/': '<a href="2026-09-03-AIRAC/html/index-no-NO.html">', 'https://aim-prod.avinor.no/no/AIP/2026-09-03-AIRAC/html/eAIP/EN-AD-2.ENXX-en-GB.html': '<html>empty</html>' });
  assert.equal((await resolve('ENXX', { fetch: f, cache: null, today: '2026-11-16' })).kind, 'portal');
});

test('the page script (aip.js) names the same portals and deep-link states as the server', async () => {
  const { readFileSync } = await import('node:fs');
  const { PORTAL } = await import('../functions/_lib/aipres.js');
  const w = {}; new Function('window', readFileSync(new URL('../aip.js', import.meta.url), 'utf8'))(w);
  for (const [k, v] of Object.entries(PORTAL)) assert.equal(w.BBAIP.ALL[k] && w.BBAIP.ALL[k].name, v.name, k);
  for (const k of Object.keys(STATES)) if (k !== 'EH') assert.equal(w.BBAIP.deep(k + 'AA'), true, k);
});
