/* /api/sigmet: European international SIGMETs from aviationweather.gov. node --test tests/ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSigmet, normalise, hazardOf, parseTac, tacPoly, combineAll } from '../functions/api/sigmet.js';

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

test('normalise: worldwide, valid only, polygons closed, FIR filter', () => {
  const all = normalise(UP, new Date(NOW));
  assert.deepEqual(all.map(x => x.fir), ['ENOR', 'ESAA', 'KZNY', 'LFFF']);
  const en = all[0]; assert.equal(en.type, 'SIGMET'); assert.equal(en.source, 'aviationweather.gov');
  assert.equal(en.label, 'Severe turbulence'); assert.equal(en.cat, 'turb');
  assert.deepEqual(en.poly[0], en.poly[en.poly.length - 1]);
  assert.deepEqual(en.poly[0], [5, 60]);
  assert.equal(all[3].poly, null); // entire FIR: listed, not drawn
  assert.deepEqual(normalise(UP, new Date(NOW), ['EN']).map(x => x.fir), ['ENOR']);
  assert.deepEqual(normalise(UP, new Date(NOW), ['ESAA', 'LF']).map(x => x.fir), ['ESAA', 'LFFF']);
});

test('handler: one upstream call, filter, bad input', async () => {
  let calls = 0;
  const deps = { cache: null, now: () => NOW, fetch: async () => { calls++; return Response.json(UP); } };
  const j = await (await handleSigmet(new Request('https://nordap.eu/api/sigmet?fir=ES'), {}, deps)).json();
  assert.equal(j.ok, true); assert.equal(j.items.length, 1); assert.equal(calls, 3); // isigmet, US airsigmet, MET Norway
  const bad = await handleSigmet(new Request('https://nordap.eu/api/sigmet?fir=E1'), {}, deps);
  assert.equal(bad.status, 400);
  const down = await handleSigmet(new Request('https://nordap.eu/api/sigmet'), {}, { cache: null, fetch: async () => new Response('', { status: 503 }) });
  assert.equal(down.status, 502);
});

const TAC = `WSNO31 ENMI 151055
ENOR SIGMET A3 VALID 151100/151400 ENMI- ENOR POLARIS FIR SEV TURB FCST WI N6000 E00500 - N6200 E00800 - N6100 E01000 - N6000 E00500 FL020/180 MOV NE 10KT NC=
WANO31 ENMI 151000
ENOR AIRMET B1 VALID 151000/151400 ENMI- ENOR POLARIS FIR MOD ICE FCST WI N6830 E01500 - N6900 E01800 - N6800 E01900 - N6830 E01500 FL050/100 STNR NC=
ENOR AIRMET B2 VALID 151000/151400 ENMI- ENOR POLARIS FIR BKN CLD 300/1500FT OBS WI N5900 E00600 - N5930 E00700 - N5900 E00800 STNR NC=
ENOR SIGMET A1 VALID 150500/150900 ENMI- ENOR POLARIS FIR SEV ICE FCST ENTIRE FIR FL050/150 STNR NC=
ENOR SIGMET A2 VALID 151000/151400 ENMI- ENOR POLARIS FIR EMBD TS OBS WI N5800 E00500 - N5900 E00600 - N5800 E00700 TOP FL300 STNR NC=
ENOR SIGMET A4 VALID 151105/151400 ENMI- ENOR POLARIS FIR CNL SIGMET A2 151000/151400=
`;

test('MET Norway TAC: SIGMET and AIRMET, polygons, levels, cancellations', () => {
  const now = new Date(NOW);
  const L = parseTac(TAC, now);
  const k = L.map(x => x.type + ' ' + x.series);
  assert.deepEqual(k, ['SIGMET A3', 'AIRMET B1', 'AIRMET B2', 'SIGMET A1']); // A2 cancelled by A4
  const a3 = L[0];
  assert.equal(a3.fir, 'ENOR'); assert.equal(a3.firName, 'POLARIS'); assert.equal(a3.label, 'Severe turbulence');
  assert.equal(a3.base, 2000); assert.equal(a3.top, 18000); assert.equal(a3.dir, 'NE'); assert.equal(a3.spd, 10);
  assert.equal(a3.from, '2026-11-15T11:00:00.000Z'); assert.equal(a3.to, '2026-11-15T14:00:00.000Z');
  assert.deepEqual(a3.poly[0], [5, 60]); assert.deepEqual(a3.poly[1], [8, 62]);
  assert.equal(L[1].label, 'Moderate icing'); assert.equal(L[1].dir, 'STNR');
  assert.deepEqual(L[1].poly[0], [15, 68.5]);
  assert.equal(L[2].label, 'Low cloud'); assert.equal(L[2].cat, 'vis');
  assert.equal(L[3].poly, null);
  assert.equal(parseTac('<html>err</html>', now).length, 0);
  assert.equal(parseTac('', now).length, 0);
  assert.equal(tacPoly(' WI S3330 W07040 - S3400 W07000 - S3330 W06900 ')[0][0], -70.6667);
});

test('combine: MET Norway first for Norway, expired dropped, NOAA kept when MET did not answer', () => {
  const now = new Date(NOW);
  const met = parseTac(TAC, now);
  const all = combineAll(met, UP, [], now);
  const en = all.filter(x => x.fir === 'ENOR');
  assert.ok(en.every(x => x.source === 'MET Norway'));
  assert.deepEqual(en.map(x => x.type + ' ' + x.series), ['AIRMET B1', 'AIRMET B2', 'SIGMET A3']); // A1 expired
  const noMet = combineAll(null, UP, [], now).filter(x => x.fir === 'ENOR');
  assert.equal(noMet.length, 1); assert.equal(noMet[0].source, 'aviationweather.gov');
  const blank = combineAll([], UP, [], now).filter(x => x.fir === 'ENOR');
  assert.equal(blank.length, 0, 'MET answered with no warnings: NOAA copies are not added');
});

test('handler with MET Norway', async () => {
  const deps = { cache: null, now: () => NOW, fetch: async u => /api\.met\.no/.test(u) ? new Response(TAC) : /airsigmet/.test(u) ? Response.json([]) : Response.json(UP) };
  const j = await (await handleSigmet(new Request('https://nordap.eu/api/sigmet?fir=EN'), {}, deps)).json();
  assert.equal(j.metOk, true);
  assert.deepEqual(j.items.map(x => x.type + ' ' + x.series), ['AIRMET B1', 'AIRMET B2', 'SIGMET A3']);
  const deps2 = Object.assign({}, deps, { fetch: async u => /api\.met\.no/.test(u) ? new Response('', { status: 503 }) : /airsigmet/.test(u) ? Response.json([]) : Response.json(UP) });
  const j2 = await (await handleSigmet(new Request('https://nordap.eu/api/sigmet?fir=EN'), {}, deps2)).json();
  assert.equal(j2.metOk, false); assert.equal(j2.items[0].source, 'aviationweather.gov');
});

test('NOAA SIGMET without coordinates: polygon from the text, or a 20 NM circle for a single position', async () => {
  const { fromIsigmet } = await import('../functions/api/sigmet.js');
  const o = fromIsigmet([
    { firId: 'LFMM', icaoId: 'LFPW', geom: 'AREA', coords: [], hazard: 'ICE', qualifier: 'SEV', rawSigmet: 'LFMM SIGMET I01 VALID 151700/151900 LFPW- LFMM MARSEILLE FIR/UIR SEV ICE OBS WI N4515 E00600 - N4530 E00430 - N4630 E00415 - N4630 E00615 - N4515 E00600 FL150/200 MOV ESE 20KT NC=' },
    { firId: 'RJJJ', icaoId: 'RJTD', geom: 'POINT', hazard: 'TURB', qualifier: 'SEV', rawSigmet: 'RJJJ SIGMET C01 VALID 151539/151739 RJTD- RJJJ FUKUOKA FIR SEV TURB OBS AT 1525Z N3442E14103 FL350 MOV ENE 20KT NC=' }]);
  assert.equal(o[0].poly.length, 5); assert.deepEqual(o[0].poly[0], [6, 45.25]);
  assert.equal(o[1].poly.length, 17); assert.ok(Math.abs(o[1].poly[0][1] - (34.7 + 1 / 3)) < 0.01);
});
