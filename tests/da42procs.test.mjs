// Node tests for da42procs.js (run: node --test tests/da42procs.test.mjs): data integrity of what the DA42 trainer keeps —
// the control predicates (own-checklist auto-ticks and scenario outcomes), the failure scenarios, the failure menu and the key
// speeds. No procedure text is shipped: schools have their own checklists.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), src=f=>fs.readFileSync(path.join(here,'..',f),'utf8');
function load(){ const ctx={Math,console}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
  for(const f of ['fdm.js','da42panel.js','da42procs.js']) vm.runInContext(src(f),ctx); return ctx; }
const C=load(), D=C.DA42PROCS, F=C.FDM;
const CTL=new Set(C.DA42P.CTLS.map(c=>c.id)); ['bzP','bzM'].forEach(x=>CTL.add(x)); // the two display bezels are page elements
const page=src('cockpit.html'), page3=src('da42-3d.html');
const txt=t=>t&&typeof t.en==='string'&&t.en.length>0&&typeof t.no==='string'&&t.no.length>0;

test('no procedure content: only predicates, scenarios, failures and speeds',()=>{
  assert.deepEqual(Object.keys(D).sort(),['CK','FAILS','SCENS','SPEEDS']);
  const s=src('da42procs.js'); for(const bad of [/IDENTIFY — VERIFY/,/\bmem:1\b/,/items:\[/,/AFM 3\.\d/]) assert.ok(!bad.test(s),String(bad));
});

test('scenarios: unique ids, EN/NO title and a one-line description, a simulated failure, a set-up the pages handle',()=>{
  const ids=new Set(), kinds=['eng','fire','alt','ecuA','gear','pfd'];
  for(const s of D.SCENS){ assert.ok(!ids.has(s.id),'duplicate '+s.id); ids.add(s.id); assert.ok(txt(s.t),s.id+' title');
    assert.ok(txt(s.d)&&s.d.en.length<=80&&s.d.no.length<=90,s.id+' one-line description');
    assert.ok(kinds.includes(s.fail.kind),s.id); assert.ok(s.fail.at!=null||s.fail.ias!=null||s.fail.onGear,s.id+' trigger');
    for(const pg of [page,page3]) assert.ok(pg.includes(`kind==='${s.set}'`),'procSet handles '+s.set); }
  for(const f of D.FAILS){ assert.ok(kinds.includes(f.kind)); assert.ok(txt(f.t)); assert.equal(f.proc,undefined,f.kind+': no checklist to open'); }
});

test('scenario outcomes: keys exist, EN/NO text, limits',()=>{
  for(const s of D.SCENS){ assert.ok(Array.isArray(s.crit)&&s.crit.length,s.id); for(const k of s.crit) assert.ok(D.CK[k],s.id+' '+k);
    assert.ok(txt(s.critTxt),s.id+' critTxt'); assert.ok(s.critLim[0]<s.critLim[1],s.id+' limits'); }
});

test('every predicate names a real panel control (L and R for engine-side ones)',()=>{
  for(const [k,ck] of Object.entries(D.CK)){ assert.equal(typeof ck.f,'function',k);
    for(const s of ['L','R']){ const id=ck.ctl.replace('*',s).replace('~',s==='L'?'R':'L'); assert.ok(CTL.has(id),`${k}: control ${id} is not on the panel`); } }
});

test('predicates run against a sim-shaped context without throwing and react to the controls they name',()=>{
  const S=F.create(); F.place(S,{N:0,E:0,alt:3000,ias:120,hdg:360,gear:0,flap:0}); F.readouts(S);
  const SYS={elec:1,avio:1,engL:1,engR:1,altL:1,altR:1,voterL:1,voterR:1,pumpL:0,pumpR:0,fselL:0,fselR:0,park:0,pitot:1,strobe:1,nav:1,taxi:0,land:0,emer:0,elt:0,altAir:0,gearEmer:0,fireTest:0,heat:0.3,defrost:0.3,rudTrim:0,start:0,ack:1,glow:[0,0],ecuDone:[0,0],backup:0,cb:{}};
  const c={S,SYS,o:S.o,AP:{on:false},i:0,dt:0.1,cb:()=>true,cbAll:()=>true};
  for(const [k,ck] of Object.entries(D.CK)) assert.doesNotThrow(()=>ck.f(c,{}),k);
  assert.equal(D.CK.engAffOff.f(c,{}),false); SYS.engL=0; assert.equal(D.CK.engAffOff.f(c,{}),true); c.i=1; assert.equal(D.CK.engAffOff.f(c,{}),false);
  assert.equal(D.CK.fselAffOff.f(c,{}),false); SYS.fselR=2; assert.equal(D.CK.fselAffOff.f(c,{}),true);
  const m={}; assert.equal(D.CK.pitotCycle.f(c,m),false); SYS.pitot=0; assert.equal(D.CK.pitotCycle.f(c,m),true);
});

test('key speeds: flight model, PFD markings and the Speeds tab agree (DA42 NG / DA42-VI with MÄM 42-678)',()=>{
  const V=F.AC.V; assert.equal(V.mc,71); assert.equal(V.yse,85); assert.equal(V.r,76); assert.equal(V.y,90); assert.equal(V.fe1,133); assert.equal(V.fe2,113);
  assert.equal(V.lo,152); assert.equal(V.loe,188); assert.equal(V.le,188); assert.equal(V.no,151); assert.equal(V.ne,188);
  for(const r of D.SPEEDS){ assert.ok(txt(r[1]),r[0]); assert.equal(typeof r[2],'string',r[0]); }
  const sp=k=>D.SPEEDS.filter(r=>r[0]===k).map(r=>r[2]).join(' | ');
  assert.equal(sp('VMCA'),'71 · 68'); assert.equal(sp('VYSE'),'85'); assert.match(sp('VNE'),/188/); assert.match(sp('VFE'),/133.*113/); assert.match(sp('VLO'),/188.*152/); assert.match(sp('VR'),/min\. 76/);
  assert.ok(D.SPEEDS.length<=12,'compact');
  assert.ok(!/VMCA 76/.test(src('da42panel.js'))&&!/Vmca 76/.test(src('avx.js')));
  for(const pg of [page,page3]){ assert.ok(!/Vmca \(76 KIAS\)/.test(pg)); assert.ok(!/rotate at 80 KIAS/.test(pg)); assert.ok(pg.includes('da42procs.js?v=')); }
});

test('no operator, school or registration names in the data',()=>{
  const s=src('da42procs.js'); for(const bad of [/LN-[A-Z]{3}/,/flight ?academy/i,/flightsafety/i,/\bOFA\b/,/osloflight/i]) assert.ok(!bad.test(s),String(bad));
});
