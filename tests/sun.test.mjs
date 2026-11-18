/* sun.js against a published almanac (timeanddate.com for Tønsberg, 18 Nov 2026) and the polar cases: node --test tests/sun.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const S = createRequire(import.meta.url)('../sun.js');
const tz = 'Europe/Oslo', f = d => S.hm(d, tz);

test('Tønsberg 18 Nov 2026 matches the almanac to the minute', () => {
  const d = S.day(new Date('2026-11-18T00:00:00Z'), 59.267, 10.408);
  assert.deepEqual([f(d.astro[0]), f(d.nautical[0]), f(d.civil[0]), f(d.rise), f(d.noon), f(d.set), f(d.civil[1]), f(d.nautical[1]), f(d.astro[1])],
    ['05:51', '06:39', '07:30', '08:18', '12:03', '15:47', '16:35', '17:26', '18:15']);
  assert.equal(d.state, 'normal'); assert.equal(S.offset(d.noon, tz), 'UTC+1');
});
test('polar night, midnight sun and white nights', () => {
  const dec = S.day(new Date('2026-12-21T00:00:00Z'), 69.68, 18.92); // Tromsø
  assert.equal(dec.rise, null); assert.ok(dec.civil[0] && dec.civil[1]); assert.equal(dec.state, 'polar-night-twilight');
  const jun = S.day(new Date('2026-06-21T00:00:00Z'), 69.68, 18.92);
  assert.equal(jun.state, 'midnight-sun'); assert.ok(jun.allDayLight.sun);
  const ws = S.day(new Date('2026-06-21T00:00:00Z'), 59.27, 10.41); // Tønsberg: sunrise and sunset, but no astronomical/nautical night
  assert.ok(ws.rise && ws.set); assert.equal(ws.nautical[0], null); assert.ok(ws.allDayLight.nautical);
  const sv = S.day(new Date('2026-12-21T00:00:00Z'), 78.25, 15.5); // Longyearbyen: dark all day
  assert.equal(sv.civil[0], null); assert.equal(sv.allDayLight.civil, false);
});
test('time zones from the ICAO prefix', () => {
  assert.equal(S.tzOf('ENTO'), 'Europe/Oslo'); assert.equal(S.tzOf('EGLL'), 'Europe/London'); assert.equal(S.tzOf('LPPD'), 'Atlantic/Azores');
  assert.equal(S.tzOf('GCLP'), 'Atlantic/Canary'); assert.equal(S.tzOf('KJFK'), null);
});
