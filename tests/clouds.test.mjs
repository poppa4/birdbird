import test from 'node:test';
import assert from 'node:assert/strict';
import { pressAlt, nomadsUrl, handleClouds } from '../functions/api/clouds.js';

test('pressure altitude (ISA)', () => {
  assert.equal(Math.round(pressAlt(101325)), 0);
  assert.ok(Math.abs(pressAlt(70000) - 9882) < 15);   // 700 hPa ≈ FL100
  assert.ok(Math.abs(pressAlt(50000) - 18289) < 20);  // 500 hPa ≈ FL180
});
test('asks NOMADS for the cloud layers, ceiling, freezing level, ground and CAPE', () => {
  const u = nomadsUrl(new Date('2026-11-16T06:00:00Z'), 5, { la: 55, lo: 5 });
  for (const s of ['var_LCDC=on', 'var_MCDC=on', 'var_HCDC=on', 'var_PRES=on', 'var_HGT=on', 'var_CAPE=on', 'lev_low_cloud_bottom_level=on', 'lev_cloud_ceiling=on', 'lev_0C_isotherm=on', 'f005', 'toplat=60'])
    assert.ok(u.includes(s), s);
});
test('bad tile and an upstream that is down', async () => {
  assert.equal((await handleClouds(new Request('https://x/api/clouds?tile=12,3'), {}, { cache: null })).status, 400);
  const r = await handleClouds(new Request('https://x/api/clouds?tile=55,5'), {}, { cache: null, fetch: async () => new Response('<html>', { status: 200 }) });
  assert.equal(r.status, 502);
});
