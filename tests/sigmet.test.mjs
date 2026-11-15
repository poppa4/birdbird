/* /api/sigmet: European international SIGMETs from aviationweather.gov. node --test tests/ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSigmet, normalise, hazardOf } from '../functions/api/sigmet.js';

const NOW = Date.UTC(2026, 10, 15, 12, 0);
const S = (o) => Object.assign({ icaoId: 'ENMI', firId: 'ENOR', firName: 'POLARIS', seriesId: 'A3', hazard: 'TURB', qualifier: 'SEV',
  validTimeFrom: NOW / 1000 - 3600, validTimeTo: NOW / 1000 + 7200, base: 2000, top: 18000, dir: 'NE', spd: 10, geom: 'POLY',
  rawSigmet: 'ENOR SIGMET A3 VALID 151100/151400 ENMI- ENOR POLARIS FIR SEV TURB FCST WI N6000 E00500 - N6200 E00800 - N6100 E01000 - N6000 E00500 FL020/180 MOV NE 10KT NC=',
  coords: [{ lat: 60, lon: 5 }, { lat: 62, lon: 8 }, { lat: 61, lon: 10 }] }, o);
const UP = [S(), S({ firId: 'ESAA', firName: 'SWEDEN', icaoId: 'ESSA', seriesId: 'B1', hazard: 'TS', qualifier: 'EMBD', rawSigmet: 'ESAA SIGMET B1 ... EMBD TS ...' }),
  S({ firId: 'KZNY', icaoId: 'KKCI', seriesId: 'X' }), S({ firId: 'EGTT', seriesId: 'Z', validTimeTo: NOW / 1000 - 60 }),
  S({ firId: 'LFFF', seriesId: 'C', hazard: 'ICE', coords: [] , rawSigmet: 'LFFF SIGMET C ENTIRE FIR SEV ICE FCST FL050/150' })];

test('hazard labels', () => {
  assert.deepEqual(hazardOf('TS', 'EMBD', ''), { cat: 'ts', label: 'Embedded thunderstorms' });
  assert.equal(hazardOf('', '', 'X SIGMET 1 OBSC TSGR FCST').label, 'Obscured thunderstorms with hail');
  assert.equal(hazardOf('ICE', 'SEV', 'SEV ICE (FZRA)').label, 'Severe icing (freezing rain)');
  assert.equal(hazardOf('MTW', 'SEV', '').cat, 'mtw');
  assert.equal(hazardOf('VA', '', 'VA ERUPTION MT ETNA').cat, 'va');
});

test('normalise: Europe only, valid only, polygons closed, FIR filter', () => {
  const all = normalise(UP, new Date(NOW));
  assert.deepEqual(all.map(x => x.fir), ['ENOR', 'ESAA', 'LFFF']);
  const en = all[0];
  assert.equal(en.label, 'Severe turbulence'); assert.equal(en.cat, 'turb');
  assert.deepEqual(en.poly[0], en.poly[en.poly.length - 1]);
  assert.deepEqual(en.poly[0], [5, 60]);
  assert.equal(all[2].poly, null); // entire FIR: listed, not drawn
  assert.deepEqual(normalise(UP, new Date(NOW), ['EN']).map(x => x.fir), ['ENOR']);
  assert.deepEqual(normalise(UP, new Date(NOW), ['ESAA', 'LF']).map(x => x.fir), ['ESAA', 'LFFF']);
});

test('handler: one upstream call, filter, bad input', async () => {
  let calls = 0;
  const deps = { cache: null, now: () => NOW, fetch: async () => { calls++; return Response.json(UP); } };
  const j = await (await handleSigmet(new Request('https://birdbird.eu/api/sigmet?fir=EN'), {}, deps)).json();
  assert.equal(j.ok, true); assert.equal(j.items.length, 1); assert.equal(calls, 1);
  const bad = await handleSigmet(new Request('https://birdbird.eu/api/sigmet?fir=E1'), {}, deps);
  assert.equal(bad.status, 400);
  const down = await handleSigmet(new Request('https://birdbird.eu/api/sigmet'), {}, { cache: null, fetch: async () => new Response('', { status: 503 }) });
  assert.equal(down.status, 502);
});
