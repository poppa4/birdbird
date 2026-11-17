/* /api/radar (OPERA composite pass-through) and /api/sat (EUMETView WMS tile proxy). node --test tests/ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRadar, candidates, keyOf } from '../functions/api/radar.js';
import { handleSat, getMapUrl, LAYERS } from '../functions/api/sat.js';

test('radar: newest composite found by 1-byte probes, file passed through', async () => {
  const now = Date.UTC(2026, 10, 15, 16, 12);
  assert.deepEqual(candidates(new Date(now)).slice(0, 2), ['20261115T1600', '20261115T1545']);
  assert.equal(keyOf('20261115T1545'), '2026/11/15/OPERA/COMP/OPERA@20261115T1545@0@RATE.h5');
  const seen = [];
  const fetch = async (u, o) => { const rg = o && o.headers && o.headers.range; seen.push((rg ? 'RANGE' : 'GET') + ' ' + u); if (/T1600/.test(u)) return new Response('', { status: 404 }); return rg ? new Response(new Uint8Array([0x89]), { status: 206 }) : new Response(new Uint8Array([0x89, 0x48, 0x44, 0x46]), { status: 200 }); };
  const j = await (await handleRadar(new Request('https://nordap.eu/api/radar'), {}, { fetch, cache: null, now: () => now })).json();
  assert.equal(j.ok, true); assert.equal(j.t, '20261115T1545'); assert.equal(j.url, '/api/radar?t=20261115T1545');
  assert.match(seen[0], /^RANGE https:\/\/s3\.waw3-1\.cloudferro\.com\/openradar-24h\/2026\/11\/15\/OPERA\/COMP\/OPERA@20261115T1600@0@RATE\.h5$/);
  const f = await handleRadar(new Request('https://nordap.eu/api/radar?t=20261115T1545'), {}, { fetch, cache: null });
  assert.equal(f.status, 200); assert.equal(f.headers.get('content-type'), 'application/x-hdf5'); assert.equal((await f.arrayBuffer()).byteLength, 4);
  assert.equal((await handleRadar(new Request('https://nordap.eu/api/radar?t=x'), {}, { fetch, cache: null })).status, 400);
});

test('sat: first layer that answers with an image; XML errors skipped', async () => {
  const bbox = [0, 6e6, 1e6, 7e6];
  assert.match(getMapUrl('msg_fes:ir108', bbox, '2026-11-15T14:00:00Z', 256), /layers=msg_fes%3Air108.*crs=EPSG%3A3857.*bbox=0%2C6000000%2C1000000%2C7000000.*time=2026-11-15T14%3A00%3A00Z/);
  const seen = [];
  const fetch = async u => { seen.push(u); return /msg_fes/.test(u) ? new Response(new Uint8Array([0x89, 0x50]), { headers: { 'content-type': 'image/png' } }) : new Response('<ServiceExceptionReport/>', { headers: { 'content-type': 'application/vnd.ogc.se_xml' } }); };
  const r = await handleSat(new Request('https://nordap.eu/api/sat?bbox=' + bbox.join(',') + '&t=2026-11-15T14:00:00Z'), {}, { fetch, cache: null });
  assert.equal(r.status, 200); assert.equal(r.headers.get('x-layer'), 'msg_fes:ir108'); assert.equal(seen.length, LAYERS.indexOf('msg_fes:ir108') + 1);
  assert.equal((await handleSat(new Request('https://nordap.eu/api/sat?bbox=1,2'), {}, { fetch, cache: null })).status, 400);
  assert.equal((await handleSat(new Request('https://nordap.eu/api/sat?bbox=0,0,1,1&t=2026-11-15T14:30:00Z'), {}, { fetch, cache: null })).status, 400);
});
