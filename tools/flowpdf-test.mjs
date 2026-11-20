// node tools/flowpdf-test.mjs — checks that flowpdf.js finds flows in manual-like pages and places steps on NORDAP's cockpits
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const P = require('../flowpdf.js'), A = require('../flowsac.js'); let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
const it = (s, x, y, h = 10) => ({ s, x, y, w: s.length * h * 0.5, h });
const page = rows => ({ w: 595, h: 842, items: rows.flat() });
const doc = { pages: [
  page([[it('A320 FLIGHT CREW TRAINING MANUAL', 40, 20, 7)], [it('NO-020 COCKPIT PREPARATION', 50, 70, 14)], [it('PF', 50, 100)],
    [it('BAT 1 & 2', 60, 115), it('..............', 120, 115), it('ON', 520, 115)], [it('EXT PWR', 60, 129), it('..............', 120, 129), it('ON', 520, 129)],
    [it('APU MASTER SW', 60, 143), it('..........', 160, 143), it('ON', 520, 143)], [it('PM', 50, 165)], [it('WEATHER RADAR', 60, 180), it('.......', 160, 180), it('OFF', 520, 180)]]),
  page([[it('A320 FLIGHT CREW TRAINING MANUAL', 40, 20, 7)], [it('NO-030 BEFORE START', 50, 70, 14)], [it('PF', 60, 100), it('PM', 320, 100)],
    [it('BEACON .......... ON', 60, 115), it('FUEL PUMPS ........ ON', 320, 115)], [it('THRUST LEVERS ..... IDLE', 60, 129), it('TRANSPONDER ....... AUTO', 320, 129)],
    [it('PARKING BRAKE .... SET', 60, 143), it('ATC CLEARANCE ..... OBTAIN', 320, 143)], [it('BEFORE START CHECKLIST', 60, 170)]]),
  page([[it('A320 FLIGHT CREW TRAINING MANUAL', 40, 20, 7)], [it('The crew should not rush this phase as errors made here may propagate.', 50, 100)]]),
  page([[it('A320 FLIGHT CREW TRAINING MANUAL', 40, 20, 7)], [it('SPEED LIMITATIONS', 50, 70, 14)], [it('VMO', 60, 100), it('350 KT', 300, 100)], [it('VLE', 60, 114), it('280 KT', 300, 114)], [it('FLAPS 1', 60, 128), it('230 KT', 300, 128)]])] };
const F = P.find(doc); ok(P.guessAc(doc) === 'a320', 'aircraft is the A320');
ok(F.length === 2, 'two flows, the limitations table left out: ' + F.map(f => f.name).join(' | '));
ok(F[0] && F[0].name === 'Cockpit Preparation' && F[0].phase === 'pre', 'first flow named and phased: ' + (F[0] && F[0].name));
ok(F[0] && F[0].steps.find(s => /WEATHER/.test(s.t)).r === 'PM', 'PM heading gives the PM layer');
ok(F[1] && F[1].steps.filter(s => s.r === 'PM').length === 3 && F[1].steps.some(s => s.k === 'call'), 'PF and PM side by side, checklist call');
const T = A.targets(A.get('a320')), m = n => (P.match(n, T) || {}).id || '';
ok(m('BAT 1 & 2 – ON') === 'ELEC|BAT 1', 'BAT 1 & 2 → BAT 1'); ok(m('BAT 2 – ON') === 'ELEC|BAT 2', 'BAT 2 is never BAT 1');
ok(m('AUTO BRK – MAX') === 'LDG GEAR / BRAKES|AUTO BRK MAX', 'the state picks the MAX button'); ok(m('FUEL PUMPS – ON') === 'FUEL|L TK PUMP 1', 'fuel pumps'); ok(!m('LIGHTS – ON'), 'a bare generic word is not placed');
const B = A.targets(A.get('b738')), b = n => (P.match(n, B) || {}).id || '';
ok(b('IRS mode selectors – NAV') === 'NAVIGATION / DISPLAYS|IRS', '737 IRS'); ok(b('Landing lights – ON') === 'EXT LIGHTS|LANDING RETRACT L', '737 landing lights');
console.log(bad ? bad + ' failed' : 'all good'); process.exit(bad ? 1 : 0);
