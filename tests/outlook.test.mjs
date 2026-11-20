/* Forecast outlook (functions/_lib/outlook.js, functions/api/outlook.js, outlook.js): node --test tests/outlook.test.mjs
   Weather models mocked: a stratus deck over ENTO, one model without per-level cloud, ECMWF under its second model name. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { handleOutlook, parseReq } from '../functions/api/outlook.js';
import { layersFromProfile, amount, sera, median } from '../functions/_lib/outlook.js';
import { mockFetch } from './lib/outlookmock.mjs';
const OUT = createRequire(import.meta.url)('../outlook.js');
const NOW = Date.UTC(2026, 10, 20, 12, 2), TZ = 'Europe/Oslo';

test('amount, SERA and median', () => {
  assert.equal(amount(5), null); assert.equal(amount(20), 'FEW'); assert.equal(amount(45), 'SCT'); assert.equal(amount(70), 'BKN'); assert.equal(amount(97), 'OVC');
  assert.equal(sera(2000, 8000), 'vfr'); assert.equal(sera(1200, 8000), 'svfr'); assert.equal(sera(500, 8000), 'ifr'); assert.equal(sera(null, 3000), 'svfr');
  assert.equal(median([3, null, 1, 2]), 2); assert.equal(median([Infinity, 1000, Infinity]), Infinity);
});

test('layers from a humidity profile, with the base between the levels', () => {
  const L = layersFromProfile([{ z: 300, t: 4, rh: 93, cc: null, sfc: true }, { z: 1000, t: 3, rh: 96, cc: null }, { z: 1800, t: 1, rh: 97, cc: null }, { z: 3000, t: -1, rh: 70, cc: null }, { z: 6000, t: -6, rh: 95, cc: null }, { z: 9000, t: -12, rh: 60, cc: null }]);
  assert.equal(L.length, 2);
  assert.ok(L[0].base > 300 && L[0].base < 1000, 'base above the ground, below the first wet level: ' + L[0].base);
  assert.ok(L[0].top > 1800 && L[0].top < 3000);
  assert.ok(L[1].base > 3000 && L[1].base < 6000);
});

test('the endpoint: stratus deck, IFR, icing above the freezing level, sources listed', async () => {
  const r = await handleOutlook(new Request('https://nordap.eu/api/outlook?icao=ENTO&lat=59.1867&lon=10.2586&el=286&t=2026-11-23T09:00Z'), {}, { fetch: mockFetch('2026-11-23T09:00:00.000Z'), now: () => NOW });
  assert.equal(r.status, 200); const j = await r.json();
  assert.equal(j.hours.length, 13); assert.equal(j.t, '2026-11-23T09:00Z');
  const c = j.hours[j.tIdx].cons;
  assert.ok(c.ceil >= 300 && c.ceil <= 800, 'ceiling ' + c.ceil); assert.equal(c.sera, 'ifr');
  assert.equal(c.frz, 3300); assert.ok(c.icing && c.icing.from === 3300);
  assert.equal(c.wind.dir, 220); assert.equal(c.wind.gust, 24); assert.equal(c.ptype, 'rain');
  assert.ok(j.sources.find(s => s.id === 'ecmwf').ok, 'ECMWF read under its second name');
  assert.ok(j.members.find(m => m.id === 'gfs').native, 'GFS layers from its own base/top');
  assert.equal(j.taf.covers, false);
  const w = OUT.words(c, o => o.no, { elevFt: 286 });
  assert.equal(w.status, 'Kun IFR'); assert.match(w.lines.join(' '), /Frysenivå rundt 3 300 ft/);
});

test('the endpoint refuses what it cannot answer', async () => {
  const u = (q) => new URL('https://nordap.eu/api/outlook?' + q);
  assert.equal(parseReq(u('lat=59&lon=10&el=0&t=2026-12-10T09:00Z'), NOW).err, 'too_far'); assert.equal(parseReq(u('lat=59&lon=10&el=0&t=2026-12-01T09:00Z'), NOW).err, undefined);
  assert.equal(parseReq(u('lat=59&lon=10&el=0&t=2026-11-19T09:00Z'), NOW).err, 'too_far');
  assert.equal(parseReq(u('lat=x&lon=10&t=2026-11-21T09:00Z'), NOW).err, 'bad_request');
  assert.equal(parseReq(u('lat=59&lon=10&el=286&t=2026-11-21T09:40'), NOW).t, '2026-11-21T10:00:00.000Z');
});

test('"ENTO mandag kl 10" and friends', () => {
  const isAp = c => ['ENTO', 'ENGM', 'ENBR'].includes(c), tzOf = () => TZ;
  const at = q => { const r = OUT.query(q, isAp, NOW, tzOf); return r && [r.icao, new Date(r.when.ms).toISOString().slice(0, 16)]; };
  assert.deepEqual(at('hvordan blir været på ENTO mandag kl 10?'), ['ENTO', '2026-11-23T09:00']);
  assert.deepEqual(at('ento mandag 10'), ['ENTO', '2026-11-23T09:00']);
  assert.deepEqual(at('ENGM tomorrow 14z'), ['ENGM', '2026-11-21T14:00']);
  assert.deepEqual(at('ENGM i morgen 0800'), ['ENGM', '2026-11-21T07:00']);
  assert.deepEqual(at('ENBR 23.11 10:00'), ['ENBR', '2026-11-23T09:00']);
  assert.deepEqual(at('ENTO 27. nov 9'), ['ENTO', '2026-11-27T08:00']);
  assert.deepEqual(at('ENTO fredag 12'), ['ENTO', '2026-11-27T11:00'], 'Friday noon has passed: next Friday');
  assert.deepEqual(at('weather ENGM sunday 3pm'), ['ENGM', '2026-11-22T14:00']);
  assert.deepEqual(at('ENTO om 3 timer'), ['ENTO', '2026-11-20T15:00']);
  assert.equal(at('ENTO'), null); assert.equal(at('hva er en okklusjon?'), null); assert.equal(at('crosswind 270/15 rwy 24'), null);
  assert.equal(OUT.query('hvordan blir været på mandag kl 10?', isAp, NOW, tzOf).icao, null, 'no aerodrome: the search bar uses the last one');
  /* summer time: 10 local in July is 08Z */
  assert.equal(new Date(OUT.parseWhen('15.07.2027 10', NOW, TZ).ms).toISOString().slice(0, 16), '2027-07-15T08:00');
});

test('the area: 17 points around the aerodrome from one call', async () => {
  const { handleArea } = await import('../functions/api/outlook-area.js');
  const r = await handleArea(new Request('https://nordap.eu/api/outlook-area?lat=59.1867&lon=10.2586&el=286&t=2026-11-23T09:00Z&r=50'), {}, { fetch: mockFetch('2026-11-23T09:00:00.000Z'), now: () => NOW });
  assert.equal(r.status, 200); const j = await r.json();
  assert.equal(j.model, 'ICON (DWD)'); const pts = j.hours[j.tIdx].pts;
  assert.equal(pts.length, 17); assert.equal(pts[0].d, 0); assert.equal(pts[16].d, 50); assert.equal(pts[16].brg, 315);
  assert.ok(pts.every(p => p && p.sera));
  assert.ok(Math.abs(pts[9].lat - (59.1867 + 50 / 60)) < 1e-3, 'north point 50 NM away');
});
