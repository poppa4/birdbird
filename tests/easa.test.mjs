/* Retrieval tests for the EASA rules library, easa.js: node --test tests/easa.test.mjs
   Basic questions pilots actually ask, phrased the way they ask them (shorthand, Norwegian, loose wording).
   Each must find the right library entry, so Flight Intelligence answers from the library and not from a guess.
   When a real question gets a poor answer, add it here with the entry it should have found. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const EASA = require('../easa.js');

const CASES = [
  ['how do u convert vis to rvr', 'CMV conversion'],
  ['hvordan konverterer man sikt til rvr', 'CMV conversion'],
  ['what is CMV', 'CMV conversion'],
  ['no RVR reported, only visibility 1200 m at night with HIALS, can I use that?', 'CMV conversion'],
  ['what is the approach ban for a private IFR flight', 'NCO.OP.210'],
  ['approach ban airline', 'CAT.OP.MPA.305'],
  ['planning minima for alternate NCO', 'NCO.OP.143'],
  ['final reserve fuel VFR day PPL', 'NCO.OP.125'],
  ['do I need a destination alternate IFR private', 'NCO.OP.140'],
  ['special VFR minima in a CTR', 'SERA.5010'],
  ['VMC minima class G', 'SERA.5001'],
  ['minimum IFR altitude over mountains', 'SERA.5015'],
  ['when do I need oxygen in a private aircraft', 'NCO.OP.190'],
  ['circling minima category B', 'NCO.OP.112'],
  ['what is the difference between type A and type B approach', 'Annex I (approach operations)'],
];

for (const [q, id] of CASES) {
  test(`"${q}" finds ${id}`, () => {
    assert.ok(EASA.isRules(q), 'not recognised as a rules question');
    const ids = EASA.search(q, 4).map(x => x.id);
    assert.ok(ids.includes(id), `got ${JSON.stringify(ids)}`);
  });
}

test('the CMV entry carries the conversion table and its limits', () => {
  const x = EASA.get('CMV conversion');
  for (const s of ['1.5', '2.0', 'take-off', '800 m', 'RVR is reported']) assert.ok(x.en.includes(s), s);
  for (const s of ['1,5', '2,0', 'avgangsminima', '800 m']) assert.ok(x.no.includes(s), s);
});

test('prompts tell the AI to read pilot shorthand and to answer when the library has no match', () => {
  assert.match(EASA.noMatch(), /shorthand/);
  assert.match(EASA.noMatch(), /Still answer it/);
  assert.doesNotMatch(EASA.noMatch(), /Do not state any rule ID/);
  assert.match(EASA.promptBlock([EASA.items[0]]), /shorthand/);
});
