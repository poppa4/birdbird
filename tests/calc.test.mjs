/* Unit tests for the Flight Intelligence calculator, functions/_lib/calc.js: node --test tests/calc.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, render, format, CALC_RULES } from '../functions/_lib/calc.js';

test('arithmetic, precedence and power', () => {
  assert.equal(evaluate('(35000 - 3000) / 1000 * 3'), 96);
  assert.equal(evaluate('2 + 3 * 4'), 14);
  assert.equal(evaluate('2 ^ 3 ^ 2'), 512);
  assert.equal(evaluate('-2 ^ 2'), -4);
  assert.equal(evaluate('10 % 3'), 1);
  assert.equal(evaluate('1e3 / 4'), 250);
  assert.equal(evaluate('6 × 7 − 2 ÷ 2'), 41);
});

test('trigonometry in degrees (aviation)', () => {
  // 20 kt wind 30° off the runway: crosswind 10 kt, headwind ≈ 17.32 kt
  assert.ok(Math.abs(evaluate('20 * sin(30)') - 10) < 1e-9);
  assert.ok(Math.abs(evaluate('20 * cos(30)') - 17.3205) < 1e-4);
  assert.ok(Math.abs(evaluate('asin(0.5)') - 30) < 1e-9);
  assert.ok(Math.abs(evaluate('atan2(1, 1)') - 45) < 1e-9);
  // 3° glide path: ≈ 318 ft per NM
  assert.ok(Math.abs(evaluate('tan(3) * 6076.12') - 318.4) < 0.1);
  assert.equal(evaluate('round(2.345, 2)'), 2.35);
  assert.equal(evaluate('max(1, 7, 3) + min(4, 2)'), 9);
  assert.equal(evaluate('sqrt(16) + abs(-2)'), 6);
  assert.ok(Math.abs(evaluate('pi') - Math.PI) < 1e-12);
});

test('rejects anything that is not arithmetic', () => {
  for (const bad of ['process.exit()', 'constructor', 'a.b', '"x"', '1 +', '(1', 'alert(1)', '1 1', '[1]', 'x => 1', '1/0', 'sqrt(-1)', 'sin(1,2)', 'x'.repeat(301)])
    assert.throws(() => evaluate(bad), Error, bad.slice(0, 20));
});

test('render replaces markers, keeps names and decimals', () => {
  const r = render('TOD: {{calc: tod = (35000 - 3000) / 1000 * 3}} NM, half: {{ calc: tod / 2 }} NM, QNH {{calc: 1013.25 - 0.5; 1}} hPa, GS {{calc: 140 * 1.1; 0}} kt.');
  assert.equal(r.text, 'TOD: 96 NM, half: 48 NM, QNH 1012.8 hPa, GS 154 kt.');
  assert.equal(r.count, 4); assert.equal(r.errors, 0);
});

test('a failed marker is shown as not calculated, never as a number', () => {
  const r = render('Fuel {{calc: burn * 2}} kg');
  assert.equal(r.text, 'Fuel (burn * 2 = ?) kg'); assert.equal(r.errors, 1);
  assert.equal(render('pi = {{calc: pi = 3}}').text, 'pi = (pi = 3 = ?)');
});

test('text without markers is returned unchanged; JSON stays JSON', () => {
  const s = 'No maths here [S1].'; assert.equal(render(s).text, s);
  const j = render('{"grade":7,"v":{{calc: 2*3.5}}}').text; assert.deepEqual(JSON.parse(j), { grade: 7, v: 7 });
});

test('default formatting', () => {
  assert.equal(format(96), '96'); assert.equal(format(17.32050807), '17.32'); assert.equal(format(318.43), '318.4');
  assert.equal(format(12345.6), '12346'); assert.equal(format(0.123456), '0.1235'); assert.equal(format(-0.00001), '0');
  assert.equal(format(2, 2), '2.00');
});

test('rules text tells the model about the markers', () => {
  assert.match(CALC_RULES, /\{\{calc: /); assert.match(CALC_RULES, /degrees/);
});

import { delatex } from '../functions/_lib/calc.js';
test('delatex turns the LaTeX the free model writes into plain text', () => {
  assert.equal(delatex('\\[ n = \\frac{1}{\\cos 60°} \\]').trim(), 'n = 1/(cos 60°)');
  assert.equal(delatex('\\(15 °C – 7 °C = 8 °C\\)'), '15 °C – 7 °C = 8 °C');
  assert.equal(delatex('50\\;\\text{kt}\\times\\sqrt{2} = 70.7'), '50 kt×√(2) = 70.7');
  assert.equal(delatex('Plain text [T1], no change {x}.'), 'Plain text [T1], no change {x}.');
  assert.doesNotMatch(delatex('$$ \\dfrac{a+b}{2} \\approx 3 $$'), /\\|\$\$/);
});
