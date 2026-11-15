/* /api/wx: MET Norway for EN**, aviationweather.gov for the rest and as fallback. node --test tests/ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWx, metLatest, dayTime } from '../functions/api/wx.js';

const NOW = Date.UTC(2026, 10, 15, 11, 10);
const MET_METAR = `ENGM 150950Z 01008KT 9999 FEW012 05/02 Q1012 NOSIG=
ENGM 151020Z 01009KT 9999 FEW012 05/02 Q1012 NOSIG=
ENGM 151050Z 36010KT 9999 BKN015 05/02 Q1011 NOSIG=
`;
const MET_TAF = `TAF ENGM 150500Z 1506/1612 22010KT 9999 SCT020
      BECMG 1512/1514 BKN012=
TAF ENGM 150800Z 1509/1615 22012KT 9999 SCT025
      TEMPO 1512/1518 4000 -RA BKN010=
`;
function upstream(opts) {
  opts = opts || {};
  const calls = [];
  const fetch = async url => {
    calls.push(url); const u = new URL(url);
    if (u.host === 'api.met.no') {
      if (opts.metDown) return new Response('', { status: 503 });
      const id = u.searchParams.get('icao');
      if (id !== 'ENGM') return new Response('', { status: 200 });
      return new Response(u.pathname.endsWith('/metar.txt') ? MET_METAR : MET_TAF, { status: 200 });
    }
    const ids = u.searchParams.get('ids').split(',');
    if (u.pathname.endsWith('/metar')) return Response.json(ids.filter(i => i !== 'XXXX').map(i => ({ icaoId: i, rawOb: i + ' 151050Z 27005KT CAVOK 04/01 Q1015', obsTime: NOW / 1000 - 1200, name: i + ' name' })));
    return Response.json(ids.filter(i => i !== 'XXXX').map(i => ({ icaoId: i, rawTAF: 'TAF ' + i + ' 151100Z 1512/1612 27005KT CAVOK', issueTime: '2026-11-15 11:00:00' })));
  };
  return { fetch, calls };
}
const get = (ids, up) => handleWx(new Request('https://birdbird.eu/api/wx?ids=' + ids), {}, { fetch: up.fetch, cache: null, now: () => NOW }).then(r => r.json());

test('metLatest picks the newest METAR and TAF and reads the validity', () => {
  const m = metLatest(MET_METAR, 'metar', new Date(NOW));
  assert.equal(m.raw, 'ENGM 151050Z 36010KT 9999 BKN015 05/02 Q1011 NOSIG');
  assert.equal(m.obsTime, '2026-11-15T10:50:00.000Z');
  const t = metLatest(MET_TAF, 'taf', new Date(NOW));
  assert.equal(t.raw, 'TAF ENGM 150800Z 1509/1615 22012KT 9999 SCT025 TEMPO 1512/1518 4000 -RA BKN010');
  assert.equal(t.validFrom, '2026-11-15T09:00:00.000Z');
  assert.equal(t.validTo, '2026-11-16T15:00:00.000Z');
  assert.equal(metLatest('', 'metar'), null);
  assert.equal(metLatest('<html>error</html>', 'metar'), null);
  assert.equal(metLatest('METAR ENGM 151050Z 36010KT=', 'metar', new Date(NOW)).raw, 'ENGM 151050Z 36010KT');
});

test('an expired short TAF is dropped (falls back to aviationweather.gov)', () => {
  const evening = new Date(Date.UTC(2026, 10, 15, 19, 0));
  assert.equal(metLatest('TAF ENNO 150800Z 1509/1518 31005KT CAVOK=', 'taf', evening), null);
  assert.ok(metLatest('TAF ENNO 150800Z 1509/1518 31005KT CAVOK=', 'taf', new Date(NOW)));
  assert.ok(metLatest('ENNO 151850Z VRB02KT CAVOK 01/M03 Q1020=', 'metar', evening), 'METAR still shown');
});

test('day groups across a month change', () => {
  assert.equal(new Date(dayTime(30, 23, 50, new Date(Date.UTC(2026, 11, 1, 0, 10)))).toISOString(), '2026-11-30T23:50:00.000Z');
});

test('EN** from MET Norway, others from aviationweather.gov, EN** without MET data falls back', async () => {
  const up = upstream();
  const j = await get('ENGM,ESSA,ENZV', up);
  assert.equal(j.ok, true);
  assert.equal(j.stations.ENGM.source, 'MET Norway');
  assert.match(j.stations.ENGM.metar.raw, /^ENGM 151050Z 36010KT/);
  assert.match(j.stations.ENGM.taf.raw, /^TAF ENGM 150800Z/);
  assert.equal(j.stations.ESSA.source, 'aviationweather.gov');
  assert.equal(j.stations.ENZV.source, 'aviationweather.gov'); // MET answered empty
  assert.equal(j.source, 'MET Norway and aviationweather.gov');
  assert.deepEqual(j.missing, []);
  const awc = up.calls.filter(u => u.includes('aviationweather.gov'));
  assert.ok(awc.every(u => !u.includes('ENGM')), 'ENGM is not asked of NOAA');
});

test('MET Norway down: everything from aviationweather.gov', async () => {
  const j = await get('ENGM', upstream({ metDown: true }));
  assert.equal(j.stations.ENGM.source, 'aviationweather.gov');
  assert.equal(j.source, 'aviationweather.gov');
});

test('only MET Norway needed: no call to aviationweather.gov', async () => {
  const up = upstream();
  const j = await get('ENGM', up);
  assert.equal(j.source, 'MET Norway');
  assert.equal(up.calls.filter(u => u.includes('aviationweather.gov')).length, 0);
});

test('missing station is reported', async () => {
  const j = await get('XXXX', upstream());
  assert.deepEqual(j.missing, ['XXXX']);
});

test('one slow MET Norway station does not throw away the others', async () => {
  const up = upstream(); const base = up.fetch;
  const fetch = (url, o) => { const u = new URL(url); if (u.host === 'api.met.no' && u.searchParams.get('icao') === 'ENKJ') return new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))); return base(url, o); };
  const t0 = Date.now(); const j = await get('ENGM,ENKJ', { fetch });
  assert.equal(j.stations.ENGM.source, 'MET Norway');
  assert.equal(j.stations.ENKJ.source, 'aviationweather.gov');
  assert.ok(Date.now() - t0 < 5000);
});
