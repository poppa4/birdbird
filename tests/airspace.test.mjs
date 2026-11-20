/* The airspace lab model (airspacecore.js) against SERA: the class at a point, Appendix 4, Table S5-1, the CTR and special VFR rules.
   Run: node --test tests/airspace.test.mjs */
import test from 'node:test'; import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const A = createRequire(import.meta.url)('../airspacecore.js');
const wx = (vis, base) => ({ vis, base, thick: 2500 });
const J = o => A.judge(Object.assign({ x: 0, y: 0, alt: 1000, fr: 'VFR', night: false, rActive: false, wx: wx(10, null) }, o));

test('class at a point: CTR, stepped TMA, class G under the steps, class E, upper airspace', () => {
  const c = (x, alt) => A.at(x, 0, alt);
  assert.equal(c(0, 1000).k, 'ctr'); assert.equal(c(0, 1000).c, 'D');
  assert.equal(c(5, 2500).k, 'tma'); assert.equal(c(5, 2500).c, 'C');
  assert.equal(c(12, 3400).c, 'G'); assert.equal(c(12, 3500).c, 'C');
  assert.equal(c(20, 4400).c, 'G'); assert.equal(c(20, 4500).c, 'C');
  assert.equal(c(-38, 9400).c, 'G'); assert.equal(c(-38, 9500).c, 'E');
  assert.equal(c(0, 20000).k, 'up');
  assert.ok(c(33, 1500).rmz); assert.ok(!c(33, 2500).rmz);
  assert.ok(c(-31, 3000).r); assert.ok(!c(-31, 7000).r);
  assert.equal(c(20, 4500).lims, '4500 ft – FL195'); assert.equal(c(0, 1000).lims, 'SFC – 2500 ft');
});
test('Appendix 4: VFR in E needs no clearance and no radio, in D both, and gets no separation', () => {
  assert.equal(A.TAB.E.VFR.clr.en, 'No'); assert.equal(A.TAB.E.VFR.radio.en, 'No');
  assert.equal(A.TAB.D.VFR.clr.en, 'Yes'); assert.match(A.TAB.D.VFR.sep.en, /None/);
  assert.match(A.TAB.C.VFR.sep.en, /IFR/); assert.equal(A.TAB.A.VFR, null);
  assert.match(A.TAB.C.IFR.spd.en, /None/); assert.match(A.TAB.D.IFR.spd.en, /250/);
});
test('Table S5-1 bands', () => {
  assert.deepEqual([A.band(12000, 'E').vis, A.band(12000, 'E').v], [8, 1000]);
  assert.equal(A.band(4000, 'G').clear, false);
  assert.equal(A.band(2000, 'G').clear, true); assert.equal(A.band(2000, 'D').clear, false);
});
test('VFR checks: cloud distance, visibility, in cloud, FL195', () => {
  assert.ok(J({ x: 12, alt: 3000, wx: wx(10, 5000) }).ok);
  assert.ok(!J({ x: 20, alt: 4200, wx: wx(10, 5000) }).ok, '800 ft below cloud above 3000 ft');
  assert.ok(J({ x: 20, alt: 2000, wx: wx(6, 2300) }).ok, 'class G low: clear of cloud is enough');
  assert.ok(!J({ x: 20, alt: 2000, wx: wx(4, null) }).ok, '5 km needed');
  assert.ok(!J({ x: -38, alt: 12000, wx: wx(6, null) }).ok, '8 km above FL100');
  assert.ok(!J({ x: 0, alt: 21000 }).ok);
  assert.ok(!J({ x: 20, alt: 3000, wx: wx(10, 2000) }).ok, 'in cloud');
});
test('CTR: below 1500 ft / 5 km you need special VFR; below 600 ft / 1500 m it is not possible; not at night', () => {
  assert.equal(J({ wx: wx(10, 4000) }).clr, 'yes');
  const s = J({ alt: 700, wx: wx(3, 1200) }); assert.equal(s.clr, 'svfr'); assert.ok(s.ok);
  assert.ok(!J({ alt: 400, wx: wx(3, 500) }).ok);
  assert.ok(!J({ alt: 400, wx: wx(1, 2000) }).ok);
  assert.ok(!J({ alt: 700, wx: wx(3, 1200), night: true }).ok);
});
test('IFR needs a clearance in controlled airspace only; restricted area blocks both', () => {
  assert.equal(J({ fr: 'IFR', x: 30, alt: 3000 }).clr, 'no');
  assert.equal(J({ fr: 'IFR', x: 0, alt: 6000 }).clr, 'yes');
  assert.ok(!J({ x: -31, alt: 3000, rActive: true }).ok);
  assert.ok(J({ x: -31, alt: 3000, rActive: false }).ok);
});
