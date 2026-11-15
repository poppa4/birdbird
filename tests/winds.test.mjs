/* GRIB2 decoder (functions/_lib/grib2.js) and /api/winds. node --test tests/
   The fixture was written by ECMWF ecCodes with GFS's packing (template 5.3, spatial differencing order 1 and 2, and 5.0);
   gfs-sample.json holds ecCodes' own decoded values to compare against. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readGrib2, gridLatLon } from '../functions/_lib/grib2.js';
import { handleWinds, parseTile, cycles, forecastHour, nomadsUrl, toTile } from '../functions/api/winds.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const BIN = readFileSync(join(DIR, 'gfs-sample.grib2'));
const REF = JSON.parse(readFileSync(join(DIR, 'gfs-sample.json'), 'utf8'));

test('grib2 decodes exactly like ecCodes (simple and complex packing with spatial differencing)', () => {
  const ms = readGrib2(BIN), keys = Object.keys(REF);
  assert.equal(ms.length, keys.length);
  ms.forEach((m, i) => {
    const r = REF[keys[i]], v = m.values, mean = v.reduce((a, b) => a + b, 0) / v.length;
    [v[0], v[220], v[v.length - 1], mean].forEach((x, j) => assert.ok(Math.abs(x - r[j]) < 1e-6 * Math.max(1, Math.abs(r[j])), keys[i] + ' value ' + j + ': ' + x + ' vs ' + r[j]));
  });
  const m = ms[0];
  assert.equal(m.ni, 21); assert.equal(m.nj, 21); assert.equal(m.la1, 65); assert.equal(m.lo1, 5); assert.equal(m.fhr, 7);
  assert.equal(m.ref.toISOString(), '2026-11-15T06:00:00.000Z');
  assert.deepEqual(gridLatLon(m, 4, 20), [60, 6]);
});

test('tile and time handling', () => {
  assert.deepEqual(parseTile('55,5'), { la: 55, lo: 5 }); assert.deepEqual(parseTile('-35,-60'), { la: -35, lo: -60 });
  assert.equal(parseTile('56,5'), null); assert.equal(parseTile('90,0'), null); assert.equal(parseTile('x'), null);
  const C = cycles(new Date('2026-11-15T13:00:00Z'));
  assert.deepEqual(C.map(d => d.toISOString().slice(11, 13)), ['06', '00', '18']);
  assert.equal(forecastHour(C[0], new Date('2026-11-15T13:30:00Z')), 8);
  assert.equal(forecastHour(C[0], new Date('2026-11-21T07:00:00Z')), 145 - 1); // 145 h → 3-hourly beyond 120: 144
  const u = nomadsUrl(C[0], 8, { la: 55, lo: -5 });
  assert.match(u, /dir=%2Fgfs\.20261115%2F06%2Fatmos/); assert.match(u, /file=gfs\.t06z\.pgrb2\.0p25\.f008/);
  assert.match(u, /leftlon=355&rightlon=360/); assert.match(u, /toplat=60&bottomlat=55/); assert.match(u, /lev_850_mb=on/); assert.match(u, /var_UGRD=on/);
});

test('toTile: north-to-south rows, units kt / °C / ft', () => {
  const t = toTile(readGrib2(BIN), { la: 60, lo: 5 });
  assert.equal(t.la0, 65); assert.equal(t.lo0, 5); assert.equal(t.nx, 21);
  const i850 = t.lev.indexOf(850);
  assert.equal(t.t[i850][0], Math.round((REF['t_850_grid_complex_spatial_differencing'][0] - 273.15) * 10) / 10);
  assert.equal(t.u[i850][0], Math.round(REF['u_850_grid_complex_spatial_differencing'][0] * 1.9438445 * 10) / 10);
  assert.equal(t.z[i850][0], Math.round(REF['gh_850_grid_complex_spatial_differencing'][0] * 3.28084 / 10) * 10);
  assert.equal(t.t[t.lev.indexOf(1000)], null); // not in the fixture
  assert.equal(t.valid, '2026-11-15T13:00:00.000Z');
});

test('handler: newest run not on NOMADS yet → previous run', async () => {
  const calls = [];
  const fetch = async u => { calls.push(u); return calls.length === 1 ? new Response('<html>data file is not present</html>', { status: 200 }) : new Response(BIN); };
  const r = await handleWinds(new Request('https://birdbird.eu/api/winds?tile=60,5&t=2026-11-15T13:10:00Z'), {}, { fetch, cache: null, now: () => Date.parse('2026-11-15T12:00:00Z') });
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(calls.length, 2);
  assert.match(calls[0], /gfs\.20261115%2F06/); assert.match(calls[1], /gfs\.20261115%2F00/);
  assert.equal(j.model, 'GFS 0.25°');
  const bad = await handleWinds(new Request('https://birdbird.eu/api/winds?tile=61,5'), {}, { fetch, cache: null });
  assert.equal(bad.status, 400);
  const down = await handleWinds(new Request('https://birdbird.eu/api/winds?tile=60,5'), {}, { fetch: async () => new Response('', { status: 503 }), cache: null });
  assert.equal(down.status, 502);
});
