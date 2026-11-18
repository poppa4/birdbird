/* icaobrief.js: the SERA status light read from a METAR, and the SIGMET area test: node --test tests/icaobrief.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const I = createRequire(import.meta.url)('../icaobrief.js');

test('SERA status from the METAR (control zone: 5 km and 1500 ft; special VFR 1500 m and 600 ft)', () => {
  const st = m => { const s = I.status(m); return s && s.cls + (s.svfr ? '+svfr' : ''); };
  assert.equal(st('ENTO 180820Z 18012KT 9999 FEW030 BKN045 05/02 Q1003'), 'ok');
  assert.equal(st('ENGM 180820Z 01005KT CAVOK 02/M03 Q1020 NOSIG'), 'ok');
  assert.equal(st('ENTO 180820Z 18012KT 6000 -RA BKN018 05/02 Q1003'), 'ok'); // SERA minima only: no 'near' category
  assert.equal(st('ENTO 180820Z 18012KT 9999 BKN014 05/02 Q1003'), 'no+svfr');
  assert.equal(st('ENTO 180820Z 18012KT 4000 BR OVC008 05/04 Q1003'), 'no+svfr');
  assert.equal(st('ENBR 180820Z 13015G25KT 0800 FG VV002 05/05 Q1003'), 'no');
  assert.equal(st('ENZV 180820Z 18012KT 9999 FEW030 05/02 Q1003 TEMPO 2000 SHRA BKN008'), 'ok'); // the trend is not the current weather
  assert.equal(st('ENTO 180820Z 18012KT 9999 FEW005 SCT010 05/02 Q1003'), 'ok'); // FEW and SCT are not a ceiling
  assert.equal(I.status('KJFK 181251Z 18012KT 10SM FEW250 20/10 A3001'), null); // statute miles: not judged
  assert.equal(I.status(''), null);
});
test('a point inside or outside a SIGMET area', () => {
  const sq = [[9, 58], [11, 58], [11, 60], [9, 60]];
  assert.equal(I.inPoly(10, 59, sq), true); assert.equal(I.inPoly(12, 59, sq), false);
});
test('the METAR badge uses EASA/SERA wording, never the U.S. categories', () => {
  const L = o => o.en;
  assert.match(I.badge('ENTO 180820Z 18012KT 9999 BKN045 05/02 Q1003', L), /class="icb-badge ok"[^>]*>VFR</);
  assert.match(I.badge('ENTO 180820Z 18012KT 5000 BKN015 05/02 Q1003', L), />VFR</); // exactly on the minima is VFR
  assert.match(I.badge('ENTO 180820Z 18012KT 4000 BR OVC008 05/04 Q1003', L), /svfr[^>]*>Special VFR only</);
  assert.match(I.badge('ENBR 180820Z 13015KT 0800 FG VV002 05/05 Q1003', L), />Below VFR</);
  for (const m of ['ENTO 180820Z 18012KT 4000 BR OVC008 05/04 Q1003', 'ENBR 180820Z 13015KT 0800 FG VV002 05/05 Q1003']) assert.doesNotMatch(I.badge(m, L), />(MVFR|IFR|LIFR)</);
  assert.equal(I.badge('KJFK 181251Z 18012KT 10SM FEW250 20/10 A3001', L), '');
});
test('IFR box: approach ban from the RVR (NCO.OP.210), else compare with the approach minima; never a made-up category', () => {
  const L = o => o.en;
  const b = m => I.ifrBadge(m, L);
  assert.match(b('ENGM 180820Z 01005KT 0300 R01L/0450 R19R/0600 FG VV001 02/02 Q1020'), /class="icb-badge no"[^>]*>IFR · approach ban \(RWY 01L RVR 450 m\)</);
  assert.match(b('ENGM 180820Z 01005KT 0200 R01L/M0050 FG VV001 02/02 Q1020'), /RVR &lt;50 m/);
  assert.doesNotMatch(b('ENGM 180820Z 01005KT 1500 R01L/P2000 BR OVC003 02/02 Q1020'), /approach ban/);
  assert.match(b('ENGM 180820Z 01005KT 1500 R01L/P2000 BR OVC003 02/02 Q1020'), /class="icb-badge ifr"[^>]*>IFR · RVR 01L &gt;2000 m · compare with approach minima</);
  assert.match(b('ENTO 180820Z 18012KT 9999 BKN045 05/02 Q1003'), />IFR · compare with approach minima</);
  assert.match(b('ENGM 180820Z 01005KT 0400 R01L/1500FT FG 02/02 Q1020'), /RVR 457 m/); // feet are converted
  assert.equal(I.ifr('ENGM 180820Z 01005KT 0300 R01L/0450V0700 FG 02/02 Q1020').low[0].m, 450); // the lower value counts
  for (const m of ['ENGM 180820Z 01005KT 0300 R01L/0450 FG VV001 02/02 Q1020', 'ENTO 180820Z 18012KT 9999 BKN045 05/02 Q1003']) assert.doesNotMatch(b(m), /MVFR|LIFR|IFR ·.*(green|red)/);
});
