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
  ['Whats the diffrence between type a and type b categorie planning minima for part nco and part cat', 'AMC6 CAT.OP.MPA.182'],
  ['Whats the diffrence between type a and type b categorie planning minima for part nco and part cat', 'NCO.OP.143'],
  ['Whats the difference in type a / b in part nco vs part cat', 'Annex I (approach operations)'],
  ['whats the numbers for plan ing minima', 'AMC6 CAT.OP.MPA.182'],
  ['how long is my SEP rating valid', 'FCL.740'],
  ['hvor lenge er SEP-rettigheten gyldig', 'FCL.740'],
  ['how do I revalidate my SEP by experience', 'FCL.740.A'],
  ['krav for å fornye SEP uten PC', 'FCL.740.A'],
  ['how long is my class 2 medical valid, I am 45', 'MED.A.045'],
  ['hvor lenge gjelder legeattest klasse 2', 'MED.A.045'],
  ['what do I need for a night rating', 'FCL.810'],
  ['krav til natterettighet', 'FCL.810'],
  ['how long is an instrument rating valid', 'FCL.625'],
  ['what can I fly with a LAPL', 'FCL.105.A'],
  ['can I get paid with a PPL', 'FCL.205.A'],
  ['who has right of way when converging', 'SERA.3210'],
  ['hvem har vikeplikt glider og motorfly', 'SERA.3210'],
  ['what does a flashing green light from the tower mean', 'SERA.3215'],
  ['hva betyr fast rødt lyssignal', 'SERA.3215'],
  ['is there a speed limit below FL100 in class E', 'SERA.6001'],
  ['what is the emergency squawk', 'SERA.13005'],
  ['what to do with radio failure in VMC', 'SERA.14083'],
  ['radiosvikt VFR hva gjør jeg', 'SERA.14083'],
  ['what do I do if I am intercepted', 'SERA.11015'],
  ['SEP rating validity and recency for passengers', 'FCL.060'],
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
  for (const s of ['1.5', '2.0', 'take-off', 'flight planning the factor is 1.0', 'LVO', 'RVR is reported']) assert.ok(x.en.includes(s), s);
  for (const s of ['1,5', '2,0', 'avgangsminima', 'faktoren 1,0', 'LVO']) assert.ok(x.no.includes(s), s);
});

test('prompts tell the AI to read pilot shorthand and to answer when the library has no match', () => {
  assert.match(EASA.noMatch(), /shorthand/);
  assert.match(EASA.noMatch(), /Still answer it/);
  assert.doesNotMatch(EASA.noMatch(), /Do not state any rule ID/);
  assert.match(EASA.promptBlock([EASA.items[0]]), /shorthand/);
});

test('theory questions do not pull in rule entries', () => {
  for (const q of ['why does a wing stall', 'hvordan fungerer en propell', 'explain induced drag']) assert.equal(EASA.search(q, 4).length, 0, q);
});
