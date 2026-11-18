/* Data and retrieval tests for the theory library, theory.js: node --test tests/theory.test.mjs
   The library explains theory only. Rules come from easa.js alone, so no entry may contain U.S. regulatory wording,
   U.S. weather categories or U.S. units. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TH = require('../theory.js');

test('every entry is complete and points at a real source and lab', () => {
  const ids = new Set();
  assert.ok(TH.items.length >= 80);
  for (const k of ['081', '050', '022', '021', '040', '061', '062', '031', '032', '033', '070', '090']) assert.ok(TH.items.some(x => x.subj === k), 'subject ' + k);
  for (const x of TH.items) {
    assert.ok(!ids.has(x.id), 'duplicate ' + x.id); ids.add(x.id);
    assert.ok(TH.subjects[x.subj], x.id + ' subject');
    assert.ok(TH.sources[x.src] && (/^https:\/\/www\.faa\.gov\//.test(TH.sources[x.src].u) || (x.src === 'own' && x.lab)), x.id + ' source');
    assert.ok(x.title.en && x.title.no, x.id + ' title');
    assert.ok(x.en.length > 200 && x.en.length < 1400, x.id + ' text length ' + x.en.length);
    assert.ok(x.kw.split(' ').length >= 6, x.id + ' keywords');
    if (x.sky) assert.match(x.sky, /^[a-z0-9-]+$/, x.id + ' skybrary slug');
    if (x.lab) assert.ok(existsSync(join(ROOT, x.lab.split('#')[0])), x.id + ' lab ' + x.lab);
  }
});

test('no rules, no U.S. regulation, no U.S. units in the theory library', () => {
  const bad = [/\b14 CFR\b/i, /\bCFR\b/, /\bFAR\b/, /\bAIM\b/, /\bpart 91\b/i, /\bFAA (requires|rule|regulation)/i, /°F|\bfahrenheit\b/i, /\binHg\b|inches of mercury/i,
    /\bClass [BCDE] airspace\b/i, /\b(LIFR|MVFR)\b/, /\bmiles?\b(?! per)/i, /\bstatute\b/i, /\bis required\b|\bare required\b|\bmust be carried\b|\bregulations? (say|require)/i];
  for (const x of TH.items) for (const re of bad) assert.ok(!re.test(x.en + ' ' + x.title.en), `${x.id} matches ${re}`);
  assert.match(TH.promptBlock([TH.items[0]]), /NEVER a source for rules/);
  assert.match(TH.promptBlock([TH.get('040-hypoxia')]), /skybrary\.aero\/articles\/hypoxia \(Source: www\.skybrary\.aero\)/);
});

test('search finds the right entry in English and Norwegian', () => {
  const first = q => (TH.search(q, 3)[0] || {}).id;
  assert.ok(TH.search('What causes induced drag?', 2).some(x => x.id === '081-vortices'));
  assert.equal(first('Hva er en tordenbyge?'), '050-thunderstorms');
  // a rule question may bring theory, but only an entry that sends the amounts to the EASA rules [E]
  TH.search('what is the minimum fuel reserve for VFR', 3).forEach(x => assert.match(x.en, /EASA rules \[E\]/, x.id));
  assert.equal(first('Hvorfor steiler en vinge?'), '081-stall');
  assert.equal(first('what is density altitude'), '081-density');
  assert.equal(first('Forklar UNOS og ANDS på magnetkompasset'), '022-compass-errors');
  assert.equal(first('blocked static port, what happens to the altimeter'), '022-blockage');
  assert.equal(first('hvordan dannes strålingståke'), '050-fog');
  assert.equal(first('What is a microburst?'), '050-windshear');
  assert.equal(first('what is the coffin corner'), '081-coffin');
  assert.equal(first('Hva er forskjellen på rimis og klaris?'), '050-icing');
  assert.equal(first('what is dutch roll'), '081-lateral');
  assert.deepEqual(TH.search('hello', 3), []);
  assert.equal(first('what is hypoxia'), '040-hypoxia');
  assert.equal(first('hva er somatogravisk illusjon'), '040-spatial');
  assert.equal(first('black hole approach'), '040-visual-illusions');
  assert.equal(first('hva er forgasserising'), '021-carb-ice');
  assert.equal(first('how does DME slant range work'), '062-dme');
  assert.equal(first('hva er en falsk glidebane'), '062-ils');
  assert.equal(first('1 in 60 rule'), '061-one-in-sixty');
  assert.equal(first('what is zero fuel mass'), '031-mass-terms');
  assert.equal(first('hvordan regner jeg ut tyngdepunktsforskyvning når jeg flytter bagasje'), '031-cg-shift');
  assert.equal(first('point of equal time formula'), '033-pet-psr');
  assert.equal(first('what affects take-off distance'), '032-takeoff-factors');
  assert.equal(first('hva er holdover time ved avising'), '070-deicing');
  assert.equal(first('how far can I reach on VHF at 1000 ft'), '090-vhf-range');
  assert.ok(TH.search('what is lift', 3).some(x => x.id === '081-bernoulli'));
});

test('cite turns [T1] into a link and drops unknown numbers', () => {
  const l = [TH.get('081-stall')];
  const h = TH.cite('A wing stalls [T1]. Odd [T7].', l);
  assert.match(h, /class="tcite" href="tunnel\.html"/); assert.doesNotMatch(h, /\[T/);
});
