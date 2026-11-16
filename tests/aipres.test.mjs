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
  const f = site({ 'https://aim-prod.avinor.no/no/AIP/': '<a href="2026-09-03-AIRAC/html/index-no-NO.html">', 'https://aim-prod.avinor.no/no/AIP/2026-09-03-AIRAC/html/eAIP/EN-AD-2.ENTO-en-GB.html': 'ok' });
  const r = await resolve('ento', { fetch: f, cache: null, today: '2026-11-16' });
  assert.equal(r.ok, true); assert.equal(r.kind, 'ad2'); assert.match(r.url, /2026-09-03-AIRAC\/html\/eAIP\/EN-AD-2\.ENTO-en-GB\.html$/);
  const x = await resolve('ENZZ', { fetch: f, cache: null, today: '2026-11-16' });
  assert.equal(x.ok, false); assert.equal(x.kind, 'portal');
});
test('a state whose site fails still gives its portal; other states get EAD or the directory', async () => {
  const r = await resolve('EGLL', { fetch: async () => { throw new Error('down'); }, cache: null, today: '2026-11-16' });
  assert.equal(r.kind, 'portal'); assert.equal(r.lookupFailed, true);
  assert.equal((await resolve('EDDF', { fetch: null, cache: null })).kind, 'portal');
  assert.equal((await resolve('LIRF', { fetch: null, cache: null })).kind, 'portal');
  assert.equal((await resolve('UKBB', { fetch: null, cache: null })).kind, 'ead');
  assert.equal((await resolve('KJFK', { fetch: null, cache: null })).kind, 'dir');
});
test('/api/aip redirects with go=1 and rejects bad codes', async () => {
  const f = site({ 'https://aim-prod.avinor.no/no/AIP/': '<a href="2026-09-03-AIRAC/html/index-no-NO.html">', 'https://aim-prod.avinor.no/no/AIP/2026-09-03-AIRAC/html/eAIP/EN-AD-2.ENTO-en-GB.html': 'ok' });
  const r = await handleAip(new Request('https://birdbird.eu/api/aip?icao=ENTO&go=1'), {}, { fetch: f, cache: null, today: '2026-11-16' });
  assert.equal(r.status, 302); assert.match(r.headers.get('location'), /EN-AD-2\.ENTO/);
  assert.equal((await handleAip(new Request('https://birdbird.eu/api/aip?icao=x'), {}, { cache: null })).status, 400);
});
