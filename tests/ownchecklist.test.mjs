// Node tests for ownck.js (run: node --test tests/ownchecklist.test.mjs): the "use my own checklist" parser on several
// synthetic checklist formats, the keyword mapping to trainer controls, the emergency-section matching, and that every
// dictionary key has a predicate on its page. All checklists here are made up for the test.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), src=f=>fs.readFileSync(path.join(here,'..',f),'utf8');
const ctx={Math,console}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['fdm.js','da42panel.js','da42procs.js','ownck.js']) vm.runInContext(src(f),ctx);
const O=ctx.OWNCK, CK=ctx.DA42PROCS.CK;
const items=P=>P.sections.flatMap(s=>s.items.map(i=>[s.t,i.c,i.r]));
const plain=x=>JSON.parse(JSON.stringify(x));

test('dotted leaders, caps headings and memory items',()=>{
  const P=O.parse(`BEFORE START
Parking brake ............ SET
Fuel pumps ............... OFF
ELECT. MASTER ............ ON

ENGINE START
Engine master L .......... ON
* Oil pressure ........... CHECK`);
  assert.deepEqual(plain(P.sections.map(s=>s.t)),['BEFORE START','ENGINE START']);
  assert.deepEqual(plain(items(P)[0]),['BEFORE START','Parking brake','SET']);
  assert.equal(P.n,5); assert.ok(P.sections[1].items[1].mem,'starred line is a memory item');
});

test('dashes, numbered and bulleted lists, colon headings',()=>{
  const P=O.parse(`After start:
1. Avionics master — ON
2) Strobe lights - ON
• Landing light – OFF
- Flaps: UP
a) Transponder    STBY`);
  assert.equal(P.sections.length,1); assert.equal(P.sections[0].t,'After start');
  assert.deepEqual(plain(P.sections[0].items.map(i=>[i.c,i.r])),[['Avionics master','ON'],['Strobe lights','ON'],['Landing light','OFF'],['Flaps','UP'],['Transponder','STBY']]);
});

test('caps item lines without a separator, and PDF table text with the response on its own line',()=>{
  const P=O.parse(`LINE UP
AVIONICS MASTER OFF
LANDING LIGHT ON
Pitot heat
ON
3
Fuel selector .........
ON`);
  assert.equal(P.sections[0].t,'LINE UP');
  assert.deepEqual(plain(P.sections[0].items.map(i=>[i.c,i.r])),[['AVIONICS MASTER','OFF'],['LANDING LIGHT','ON'],['Pitot heat','ON'],['Fuel selector','ON']]);
});

test('emergency group headings mark the following sections; normal resets',()=>{
  const P=O.parse(`NORMAL PROCEDURES
TAXI
Brakes ..... CHECK
EMERGENCY PROCEDURES
ENGINE FAILURE AFTER TAKE-OFF
Power ..... MAX
LANDING WITH ONE ENGINE INOPERATIVE
Gear ..... DOWN
ENGINE FIRE IN FLIGHT
Cabin heat ..... OFF
NORMAL CHECKLISTS
SHUT-DOWN
Engine masters ..... OFF`);
  assert.deepEqual(plain(P.sections.map(s=>[s.t,s.emer])),[['TAXI',false],['ENGINE FAILURE AFTER TAKE-OFF',true],['LANDING WITH ONE ENGINE INOPERATIVE',true],['ENGINE FIRE IN FLIGHT',true],['SHUT-DOWN',false]]);
  assert.equal(O.matchSection(P.sections,'efato'),1);
  assert.equal(O.matchSection(P.sections,'fire_air'),3);
  assert.equal(O.matchSection(P.sections,'gear'),-1,'no gear failure section: falls back to the AFM');
});

test('emergency matching: specific first, then the general engine-failure section, Norwegian headings',()=>{
  const P=O.parse(`MOTORSTANS ETTER AVGANG
Effekthendler ..... MAX
MOTORBRANN PÅ BAKKEN
Engine masters ..... OFF`);
  assert.ok(P.sections.every(s=>s.emer));
  assert.equal(O.matchSection(P.sections,'efato'),0); assert.equal(O.matchSection(P.sections,'fire_gnd'),1);
  const G=O.parse(`ENGINE FAILURE
Identify ..... DEAD FOOT`);
  assert.equal(O.matchSection(G.sections,'efato'),0,'general engine failure section for an EFATO');
  assert.equal(O.matchSection(G.sections,'efflt'),0);
});

test('keyword mapping to DA42 controls, with sides and responses',()=>{
  const m=(c,r)=>{ const x=O.mapItem('DA42',{c,r}); return x&&x.key; };
  assert.equal(m('Fuel pumps','OFF'),'pumpsOff'); assert.equal(m('Fuel pumps','BOTH ON'),'pumpsOn');
  assert.equal(m('Engine master L','ON'),'engLOn'); assert.equal(m('Engine master (affected)','OFF'),'engAffOff');
  assert.equal(m('Fuel selector (failed engine)','OFF'),'fselAffOff'); assert.equal(m('Fuel selectors','CROSSFEED'),'fselsX');
  assert.equal(m('Landing gear','DOWN, 3 GREEN'),'gear3'); assert.equal(m('Flaps','APP'),'flapsApp'); assert.equal(m('Flaps','LDG'),'flapsLdg');
  assert.equal(m('Power levers','IDLE'),'idle'); assert.equal(m('Parking brake','RELEASED'),'parkOff'); assert.equal(m('Parking brake','SET'),'park');
  assert.equal(m('Pitot heat','CHECKED, then OFF'),'pitotCycle'); assert.equal(m('Strobe / beacon','ON'),'strobeOn');
  assert.equal(m('Avionics master','OFF'),'avioOff'); assert.equal(m('ELECT. MASTER','ON'),'elecOn');
  assert.deepEqual(plain(m('ECU test','PERFORMED')),['ecuL','ecuR']);
  assert.equal(m('Passenger briefing','COMPLETE'),null,'items with no control are ticked by hand');
  assert.equal(m('Altimeters','SET'),null);
});

test('keyword mapping for the C172 and B200',()=>{
  const c=(c,r)=>{ const x=O.mapItem('C172',{c,r}); return x&&x.key; }, b=(c,r)=>{ const x=O.mapItem('B200',{c,r}); return x&&x.key; };
  assert.equal(c('Mixture','RICH'),'mixRich'); assert.equal(c('Mixture','IDLE CUT-OFF'),'mixCut'); assert.equal(c('Carb heat','HOT'),'carbOn');
  assert.equal(c('Fuel selector','BOTH'),'fuelBoth'); assert.equal(c('Magnetos','BOTH'),'magBoth'); assert.equal(c('Beacon','ON'),'bcnOn');
  assert.equal(c('Throttle','OPEN 1/4 INCH'),'thrCrack'); assert.equal(c('Altimeter','SET QNH'),'baroSet'); assert.equal(c('Flaps','10°'),'flap1');
  assert.equal(b('Condition lever (failed engine)','FUEL CUTOFF'),'condAffCut'); assert.equal(b('Prop lever (failed)','FEATHER'),'propAffFeather');
  assert.equal(b('Autofeather','ARM'),'afArm'); assert.equal(b('Yaw damper','ON'),'ydOn'); assert.equal(b('Firewall valve (affected)','CLOSED'),'fwAffClosed');
  assert.equal(b('Fire extinguisher','ACTUATE'),'extAff'); assert.equal(b('Oxygen masks','ON, 100 %'),'maskOn');
});

test('every dictionary key has a predicate on its page',()=>{
  const flat=k=>k==null?[]:Array.isArray(k)?k:typeof k==='object'?Object.values(k).flatMap(flat):[k];
  const keys=t=>new Set(O.DICT[t].flatMap(e=>[...(e.st||[]).flatMap(x=>flat(x[1])),...flat(e.any)]));
  for(const k of keys('DA42')) assert.ok(CK[k],'DA42 '+k);
  for(const [t,f] of [['C172','c172-app.js'],['B200','b200-app.js']]){ const s=src(f), m=s.match(/const OWNP=\{([\s\S]*?)\};\n/); assert.ok(m,f+' OWNP');
    for(const k of keys(t)) assert.match(m[1],new RegExp('\\b'+k+':\\(\\)=>'),t+' '+k); }
});

test('DA42 scenarios name outcome keys and an own-checklist section kind; nothing parses to junk',()=>{
  for(const s of ctx.DA42PROCS.SCENS){ assert.ok(Array.isArray(s.crit)&&s.crit.length,s.id); for(const k of s.crit) assert.ok(CK[k],s.id+' '+k); assert.ok(s.own,s.id+' own');
    for(const k of [].concat(s.own)) assert.ok(O.FK[k],s.id+' kind '+k); }
  assert.equal(O.parse('').n,0); assert.equal(O.parse('\n\n12\nPage 3 of 9\n').n,0);
  const big=O.parse(Array.from({length:3000},(_,i)=>'Item '+i+' ..... ON').join('\n')); assert.ok(big.n<=2000,'item cap');
});

test('generic flows are off by default and the label says they are not the school SOP',()=>{
  assert.equal(O.gen('DA42'),false); assert.match(O.GEN.en,/not your school/); assert.match(ctx.DA42PROCS.DISC.en,/Always follow your school's approved checklists/);
});
