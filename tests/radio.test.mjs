// Node tests for the radio trainer engine (radiocore.js + radioscen.js). Run: node --test tests/radio.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['radiocore.js','radioscen.js']) vm.runInContext(fs.readFileSync(path.join(here,'..',f),'utf8'),ctx);
const R=ctx.RADIOCORE, S=ctx.RADIOSCEN;
const T=s=>R.norm(s).toks.join(' ');
const V0=()=>Object.assign(S.vars(7),{cs:R.parseCallsign('LN-NAE')});
const step=(els,o)=>Object.assign({rb:1,els},o);
const st=(g,k)=>g.res.find(r=>r.k===k).st;

test('numbers: digit by digit, decimal, thousand/hundred, ICAO words', ()=>{
  assert.equal(T('one two one decimal seven five'),'121.75');
  assert.equal(T('one one eight decimal three zero zero'),'118.3');
  assert.equal(T('121 decimal 700'),'121.7');
  assert.equal(T('121,7'),'121.7');                       // Norwegian decimal comma
  assert.equal(T('tree tousand fife hundred feet'),'3500 feet');
  assert.equal(T('one zero thousand'),'10000');
  assert.equal(T('fifteen hundred'),'1500');
  assert.equal(T('3,000 ft'),'3000 feet');
  assert.equal(T('niner tree'),'93');
  assert.equal(T('heading zero five zero'),'heading 050');
  assert.equal(T('squawk four five two one'),'squawk 4521');
  assert.equal(T('Q N H one zero one three'),'qnh 1013');
  assert.equal(T('climb to 3000'),'climb to 3000');      // "to" is not "two"
  assert.equal(T('heading 360, 2 persons'),'heading 360 2 persons'); // a comma ends a number
});
test('levels and phonetics', ()=>{
  assert.equal(T('Climb flight level eight zero'),'climb flight level 80');
  assert.equal(T('FL080'),'flight level 080');
  assert.equal(T('fl 95'),'flight level 95');
  assert.equal(T('Lima November November Alfa Echo'),'l n n a e');
  assert.equal(T('LN-NAE'),'lnnae');
  assert.equal(T('information bravo'),'information b');
  assert.equal(T('holding point alfa one'),'holding point a 1'); // "point" is a word here, not a decimal
  assert.equal(T('ready for take-off'),'ready for takeoff');
});
test('spoken form for the controller voice', ()=>{
  const s=R.spoken('LN-NAE, climb flight level 90, squawk 4521, contact Approach 119.250, QNH 1013, holding point A1, climb altitude 3500 feet, OSVIK 1N departure');
  assert.match(s,/^Lima November November Alfa Echo/);
  assert.match(s,/flight level niner zero/); assert.match(s,/squawk four fife two one/);
  assert.match(s,/one one niner decimal two fife zero/); assert.match(s,/Alfa one/);
  assert.match(s,/tree thousand fife hundred feet/); assert.match(s,/Osvik one November/);
  assert.equal(R.freqWords('121.700'),'one two one decimal seven');
});
test('callsign: full, spoken, abbreviated only after ATC', ()=>{
  const V=V0(), s=step([R.parseCallsign&&{k:'cs'}]);
  assert.equal(st(R.grade(s,'LN-NAE',{V}),'cs'),'ok');
  assert.equal(st(R.grade(s,'lima november november alpha echo',{V}),'cs'),'ok');
  assert.equal(st(R.grade(s,'L-AE',{V,abbrOK:true}),'cs'),'ok');
  assert.equal(st(R.grade(s,'L-AE',{V,abbrOK:false}),'cs'),'warn');
  assert.equal(st(R.grade(s,'roger',{V}),'cs'),'miss');
  const cs=R.parseCallsign('G-ABCD'); assert.equal(cs.abbr,'G-CD');
  assert.equal(R.parseCallsign('Birdie 21').abbr,null);
});

const TAXI=V=>step([{k:'hp',v:'A1'},{k:'rwy',v:'36'},{k:'qnh',v:1013},{k:'cs'}]);
test('readback: correct, any order, spoken numbers', ()=>{
  const V=V0();
  let g=R.grade(TAXI(V),'Holding point A1 runway 36, QNH 1013, L-AE',{V,abbrOK:true}); assert.ok(g.pass);
  g=R.grade(TAXI(V),'QNH 1013, runway 36, holding point A1, L-AE',{V,abbrOK:true}); assert.ok(g.pass,'order is free');
  g=R.grade(TAXI(V),'holding point alfa one runway tree six Q N H wun zero wun tree lima alfa echo',{V,abbrOK:true}); assert.ok(g.pass,'spoken');
});
test('readback: missing element and wrong value', ()=>{
  const V=V0();
  let g=R.grade(TAXI(V),'Holding point A1 runway 36, L-AE',{V,abbrOK:true}); assert.ok(!g.pass); assert.equal(st(g,'qnh'),'miss');
  g=R.grade(TAXI(V),'Holding point A1 runway 36, QNH 1031, L-AE',{V,abbrOK:true}); assert.equal(st(g,'qnh'),'wrong'); assert.match(g.res.find(r=>r.k==='qnh').got,/1031/);
  g=R.grade(TAXI(V),'Holding point A1 runway 18, QNH 1013, L-AE',{V,abbrOK:true}); assert.equal(st(g,'rwy'),'wrong');
  g=R.grade(TAXI(V),'Holding point B1 runway 36, QNH 1013, L-AE',{V,abbrOK:true}); assert.equal(st(g,'hp'),'wrong');
  g=R.grade(TAXI(V),'Holding point A1 runway 36, QNH 1013',{V}); assert.equal(st(g,'cs'),'miss');
});
test('altitude vs flight level reference', ()=>{
  const V=V0(), A=step([{k:'alt',v:3000},{k:'cs'}]), F=step([{k:'fl',v:90},{k:'cs'}]);
  assert.ok(R.grade(A,'climb altitude 3000 feet LN-NAE',{V}).pass);
  assert.ok(R.grade(A,'climb three thousand feet LN-NAE',{V}).pass);
  let g=R.grade(A,'climb flight level 30 LN-NAE',{V}); assert.equal(st(g,'alt'),'wrong'); assert.match(g.res[0].why.en,/never “flight level”/);
  g=R.grade(A,'climb altitude 4000 feet LN-NAE',{V}); assert.equal(st(g,'alt'),'wrong');
  assert.ok(R.grade(F,'climb flight level niner zero LN-NAE',{V}).pass);
  g=R.grade(F,'climb 9000 feet LN-NAE',{V}); assert.equal(st(g,'fl'),'wrong');
  g=R.grade(F,'climb 90 LN-NAE',{V}); assert.equal(st(g,'fl'),'warn');                 // missing "flight level"
  assert.ok(!R.grade(F,'climb 90 LN-NAE',{V,level:'check'}).pass,'check-ready is strict');
  g=R.grade(F,'flight level 100 LN-NAE',{V}); assert.equal(st(g,'fl'),'wrong');
});
test('heading, turn, squawk, frequency, hold short, conditional', ()=>{
  const V=V0();
  let g=R.grade(step([{k:'turn',v:'left'},{k:'hdg',v:'050'},{k:'cs'}]),'left heading zero five zero LN-NAE',{V}); assert.ok(g.pass);
  g=R.grade(step([{k:'turn',v:'left'},{k:'hdg',v:'050'},{k:'cs'}]),'right heading 050 LN-NAE',{V}); assert.equal(st(g,'turn'),'wrong');
  g=R.grade(step([{k:'sq',v:'4521'},{k:'cs'}]),'squawk 4512 LN-NAE',{V}); assert.equal(st(g,'sq'),'wrong');
  g=R.grade(step([{k:'freq',v:'121.700'},{k:'cs'}]),'one two one decimal seven LN-NAE',{V}); assert.ok(g.pass);
  g=R.grade(step([{k:'freq',v:'121.700'},{k:'cs'}]),'121.75 LN-NAE',{V}); assert.equal(st(g,'freq'),'wrong');
  g=R.grade(step([{k:'hs',v:'07'},{k:'cs'}]),'holding short runway zero seven, LN-NAE',{V}); assert.ok(g.pass);
  g=R.grade(step([{k:'hs',v:'07'},{k:'cs'}]),'taxi via bravo, LN-NAE',{V}); assert.equal(st(g,'hs'),'miss');
  const cond=S.SEG.vline(V)[1];
  assert.ok(R.grade(cond,'Behind the landing DA40, line up runway 36 and wait, behind, L-AE',{V,abbrOK:true}).pass);
  g=R.grade(cond,'Line up runway 36 and wait, L-AE',{V,abbrOK:true}); assert.ok(!g.pass,'condition missing');
});
test('phraseology flags', ()=>{
  const V=V0(); const k=t=>R.grade(step([{k:'cs'}]),t,{V}).flags.map(f=>f.k);
  assert.ok(k('LN-NAE ready for take-off').includes('takeoff'));
  assert.ok(k('LN-NAE repeat').includes('repeat'));
  assert.ok(k('affirmative LN-NAE').includes('affirmative'));
  assert.ok(k('roger LN-NAE').includes('roger'));
  assert.ok(k('yes LN-NAE').includes('yes'));
  assert.ok(k('over and out').includes('overout'));
});
test('drills: phonetic spelling and numbers the radio way', ()=>{
  const V=V0();
  assert.ok(R.grade({els:[{k:'spell',v:'OSVIK'}]},'Oscar Sierra Victor India Kilo',{V}).pass);
  assert.ok(!R.grade({els:[{k:'spell',v:'OSVIK'}]},'O S V I K',{V}).pass);
  const w=R.freqWords('118.300');
  assert.ok(R.grade({els:[{k:'say',v:'118.300',w}]},'one one eight decimal three',{V}).pass);
  assert.ok(R.grade({els:[{k:'say',v:'118.300',w}]},'one one eight decimal tree zero zero',{V}).pass);
  assert.ok(!R.grade({els:[{k:'say',v:'118.300',w}]},'one one eight point three',{V}).pass);
  assert.ok(!R.grade({els:[{k:'say',v:'118.300',w}]},'118.3',{V}).pass);
  assert.ok(R.grade({els:[{k:'abbr',v:'G-CD'}]},'G-CD',{V}).pass);
  assert.ok(R.grade({els:[{k:'abbr',v:null,full:'BIRDIE 421'}]},'none',{V}).pass);
});

test('every model answer passes its own step (all scenarios, several seeds, both callsign types)', ()=>{
  let n=0;
  for(let seed=1;seed<=12;seed++) for(const sc of S.ALL){
    const ses=new R.Session(sc,{seed,level:seed%2?'check':'beginner',callsign:seed%3?'LN-NAE':'BIRDIE 21'}); ses.start();
    while(!ses.done){ const s=ses.step; const r=ses.submit(s.model); n++; assert.equal(r.kind,'pass',`${sc.k} ${s.id}: "${s.model}"`); }
    assert.equal(ses.summary().score,100,sc.k);
  }
  assert.ok(n>1000);
});
test('session state machine: correction, retry with carry, say again, standby, fail after max tries, undo', ()=>{
  const sc=S.byKey('vfrdep'); const ses=new R.Session(sc,{seed:3,level:'intermediate'}); const V=ses.V;
  let ev=ses.start(); assert.equal(ev[0].t,'tune'); assert.equal(ses.step.id,'vtaxi:0');
  let r=ses.submit(ses.step.model); assert.equal(r.kind,'pass');
  assert.ok(r.ev.some(e=>e.t==='atc'&&/taxi to holding point A1/.test(e.text)),'controller gives the taxi clearance');
  // say again: repeats, not counted as a try
  r=ses.submit('say again'); assert.equal(r.kind,'sayagain'); assert.equal(ses.tries,0); assert.ok(/holding point A1/.test(r.ev[0].text));
  r=ses.submit('standby'); assert.equal(r.kind,'standby');
  // wrong QNH -> "negative, I say again, QNH ..."
  const bad=V.qnh+2;
  r=ses.submit(`Holding point A1 runway 36 via Alpha, QNH ${bad}, ${V.a}`); assert.equal(r.kind,'retry');
  const corr=r.ev.find(e=>e.t==='atc'); assert.match(corr.text,new RegExp(`negative, I say again, QNH ${V.qnh}`));
  // only the corrected part is needed now (carry)
  r=ses.submit(`QNH ${V.qnh}, ${V.a}`); assert.equal(r.kind,'pass');
  assert.equal(ses.results[1].score,0.7);
  // undo a misheard transmission
  const before=ses.i; r=ses.submit('mumble'); assert.equal(r.kind,'retry'); assert.ok(ses.undo()); assert.equal(ses.i,before); assert.equal(ses.tries,0);
  // two failures -> model shown, move on (intermediate: 2 tries)
  r=ses.submit('mumble'); r=ses.submit('mumble'); assert.equal(r.kind,'fail'); assert.ok(r.ev.some(e=>e.t==='model'));
  assert.notEqual(ses.i,before);
  // initial call without callsign -> "Station calling ..., say again your callsign"
  const s2=new R.Session(S.byKey('vatis'),{seed:3}); s2.start(); s2.submit(s2.step.model);
  r=s2.submit('Birdbird Ground at the apron information '+V.info+' request taxi'); assert.equal(r.kind,'retry'); assert.match(r.ev.find(e=>e.t==='atc').text,/say again your callsign/);
});
test('summary, weak items and spaced repetition', ()=>{
  const ses=new R.Session(S.byKey('ifrclr'),{seed:5,level:'beginner'}); ses.start();
  ses.submit(ses.step.model); ses.submit('roger'); ses.submit('roger'); ses.submit('roger');
  while(!ses.done) ses.submit(ses.step.model);
  const sm=ses.summary(); assert.ok(sm.score<100); assert.ok(sm.weak.length>=1); assert.ok(sm.kinds.sq&&sm.kinds.sq.ok===0);
  const db=R.SRS.update({},ses.results,1000); const due=R.SRS.due(db,1000+3600e3);
  assert.ok(due.includes('iclr:1'),'the failed readback is due again soon'); assert.ok(!due.includes('iclr:0'));
  const q=S.quick(S.vars(9),R.rng(9),['iclr:1']); assert.equal(q[0].id,'iclr:1'); assert.equal(q.length,6);
});
test('transition level and variables are deterministic per seed', ()=>{
  assert.equal(S.tl(1013),75); assert.equal(S.tl(1000),80); assert.equal(S.tl(988),85);
  assert.deepEqual(JSON.stringify(S.vars(42)),JSON.stringify(S.vars(42)));
  const V=S.vars(42); assert.ok(V.fl*100>V.tl*100,'cleared flight level is above the transition level');
  assert.ok(/^[1-6][0-7]{2}[1-7]$/.test(V.sq),'squawk is octal and not a special code');
});
