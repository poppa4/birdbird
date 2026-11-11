// Node tests for da42procs.js (run: node --test tests/da42procs.test.mjs): data integrity of the DA42 flows, the emergency and
// abnormal checklists and the failure scenarios; every auto-ticked item points to a real panel control and a working predicate;
// EN/NO text everywhere; the AFM speeds that the flight model and the checklists use agree.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), src=f=>fs.readFileSync(path.join(here,'..',f),'utf8');
function load(){ const ctx={Math,console}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
  for(const f of ['fdm.js','da42panel.js','da42procs.js']) vm.runInContext(src(f),ctx); return ctx; }
const C=load(), D=C.DA42PROCS, F=C.FDM;
const CTL=new Set(C.DA42P.CTLS.map(c=>c.id)); ['bzP','bzM'].forEach(x=>CTL.add(x)); // the two display bezels are page elements
const page=src('cockpit.html'), page3=src('da42-3d.html');
const txt=t=>t&&typeof t.en==='string'&&t.en.length>0&&typeof t.no==='string'&&t.no.length>0;
const allProcs=[...D.FLOWS,...D.EMER];

test('every procedure has a unique id, a group, an AFM reference and EN/NO titles',()=>{
  const ids=new Set();
  for(const p of [...allProcs,...D.SCENS]){ assert.ok(!ids.has(p.id),'duplicate '+p.id); ids.add(p.id); assert.ok(txt(p.t),p.id+' title'); }
  for(const p of allProcs){ assert.match(p.ref,/AFM|SOP/,p.id+' ref'); assert.ok(p.items.length>0,p.id+' items'); }
  for(const p of D.EMER) assert.ok(D.GROUPS.some(g=>g[0]===p.g),p.id+' group');
  for(const p of D.FLOWS){ assert.ok(['gnd','flt'].includes(p.g),p.id); assert.ok(txt(p.brief),p.id+' brief'); }
});

test('every item has EN/NO challenge and response; callouts, sections and notes are EN/NO',()=>{
  for(const p of allProcs){ for(const it of p.items){ const w=p.id+': '+it.c.en;
    assert.ok(txt(it.c),w+' challenge'); assert.ok(txt(it.r),w+' response');
    if(it.call) assert.ok(txt(it.call),w+' call'); if(it.sec) assert.ok(txt(it.sec),w+' section'); }
    if(p.note) assert.ok(txt(p.note),p.id+' note'); }
  for(const s of D.SCENS) assert.ok(txt(s.brief),s.id+' brief');
  for(const r of D.SPEEDS){ assert.ok(txt(r[1]),r[0]); assert.ok(typeof r[2]==='string'||txt(r[2]),r[0]+' value'); }
  for(const x of D.LIMITS) assert.ok(txt(x)); assert.ok(txt(D.DISC));
});

test('every auto-tick key exists, and its control is a real panel control (L and R for engine-side items)',()=>{
  for(const p of allProcs) for(const it of p.items){ if(!it.k) continue; const ck=D.CK[it.k]; assert.ok(ck,`${p.id}: unknown key ${it.k}`);
    assert.equal(typeof ck.f,'function'); }
  for(const [k,ck] of Object.entries(D.CK)){ for(const s of ['L','R']){ const id=ck.ctl.replace('*',s).replace('~',s==='L'?'R':'L'); assert.ok(CTL.has(id),`${k}: control ${id} is not on the panel`); } }
  // engine-side items only in checklists that offer an engine choice
  for(const p of D.EMER){ const sided=p.items.some(it=>it.k&&/[*~]/.test(D.CK[it.k].ctl))||p.items.some(it=>/\{[EO]\}/.test(it.c.en+it.r.en)); if(sided) assert.ok(p.side,p.id+' needs side:1'); }
  // every key is used
  const used=new Set(allProcs.flatMap(p=>p.items.map(i=>i.k)).filter(Boolean)); for(const k of Object.keys(D.CK)) assert.ok(used.has(k),'unused key '+k);
});

test('predicates run against a sim-shaped context without throwing and react to the controls they name',()=>{
  const S=F.create(); F.place(S,{N:0,E:0,alt:3000,ias:120,hdg:360,gear:0,flap:0}); F.readouts(S);
  const SYS={elec:1,avio:1,engL:1,engR:1,altL:1,altR:1,voterL:1,voterR:1,pumpL:0,pumpR:0,fselL:0,fselR:0,park:0,pitot:1,strobe:1,nav:1,taxi:0,land:0,emer:0,elt:0,altAir:0,gearEmer:0,fireTest:0,heat:0.3,defrost:0.3,rudTrim:0,start:0,ack:1,glow:[0,0],ecuDone:[0,0],backup:0,cb:{}};
  const c={S,SYS,o:S.o,AP:{on:false},i:0,dt:0.1,cb:()=>true,cbAll:()=>true};
  for(const [k,ck] of Object.entries(D.CK)) assert.doesNotThrow(()=>ck.f(c,{}),k);
  assert.equal(D.CK.engAffOff.f(c,{}),false); SYS.engL=0; assert.equal(D.CK.engAffOff.f(c,{}),true); c.i=1; assert.equal(D.CK.engAffOff.f(c,{}),false);
  assert.equal(D.CK.fselAffOff.f(c,{}),false); SYS.fselR=2; assert.equal(D.CK.fselAffOff.f(c,{}),true);
  const m={}; SYS.voterR=0; for(let t=0;t<4.9;t+=0.1) assert.equal(D.CK.voterAffA5.f(c,m),false); D.CK.voterAffA5.f(c,m); assert.equal(D.CK.voterAffA5.f(c,m),true);
  const g={}; assert.equal(D.CK.gearRecycle.f(c,g),false); S.ctl.gear=1; assert.equal(D.CK.gearRecycle.f(c,g),true);
});

test('memory items: the engine failures, fires on the ground, autopilot runaway and spin start with memory items',()=>{
  for(const id of ['efrun','efato','efclb','efflt','firegnd','elfiregnd','apfail','spin']){ const p=D.find(id); assert.ok(p.items[0].mem,id); }
  for(const p of D.FLOWS) if(p.id!=='ga') assert.ok(!p.items.some(i=>i.mem),p.id+' normal flows have no memory items (except go-around)');
});

test('failure scenarios point to existing checklists and simulated failure kinds; the failure menu too',()=>{
  const kinds=['eng','fire','alt','ecuA','gear','pfd'];
  for(const s of D.SCENS){ assert.ok(D.find(s.proc),s.id); assert.ok(kinds.includes(s.fail.kind),s.id); assert.ok(s.fail.at!=null||s.fail.ias!=null||s.fail.onGear,s.id+' trigger'); assert.ok(s.set,s.id+' set'); }
  for(const f of D.FAILS){ assert.ok(kinds.includes(f.kind)); for(const id of typeof f.proc==='string'?[f.proc]:Object.values(f.proc)) assert.ok(D.find(id),f.kind+' '+id); }
  // every set-up kind used by a flow or scenario is handled by both pages
  const sets=new Set([...D.FLOWS.map(p=>p.set),...D.SCENS.map(s=>s.set)]);
  for(const k of sets) for(const pg of [page,page3]) assert.ok(pg.includes(`kind==='${k}'`),'procSet handles '+k);
});

test('build(): steps carry labels with the affected engine, controls resolve per side, manual items have no control',()=>{
  let side=1; const c={S:F.create(),SYS:{engR:1},o:{},AP:{},i:1,dt:0,cb:()=>true,cbAll:()=>true};
  const P=D.build({ctx:()=>c,side:()=>side}); const ef=P.find(p=>p.k==='efflt');
  const st=ef.steps.find(s=>s.k==='engAffOff'); assert.match(st.t.en,/ENGINE MASTER R — OFF/); assert.equal(typeof st.ctl,'function'); assert.equal(st.ctl(),'engR');
  side=0; assert.equal(st.ctl(),'engL'); assert.match(st.t.no,/ENGINE MASTER L/);
  assert.ok(P.every(p=>p.steps.every(s=>s.manual===!s.ctl)));
  assert.ok(P.filter(p=>p.kind==='flow').length===D.FLOWS.length&&P.filter(p=>p.kind==='scen').length===D.SCENS.length);
  // flows cover the whole flight in order
  const ids=D.FLOWS.map(p=>p.id); ['preflight','bse','start','after','taxi','bto','lineup','takeoff','aftto','climb','cruise','descent','appr','bldg','ga','aftldg','shut'].forEach(k=>assert.ok(ids.includes(k),k));
});

test('search finds checklists in English and Norwegian',()=>{
  const hit=(q,id)=>assert.ok(D.search(q).some(p=>p.id===id),q+' → '+id);
  hit('fire','fireflt'); hit('brann','firegnd'); hit('ecu a','ecua'); hit('alternator','altn1'); hit('generator','altn1'); hit('gear unsafe','gearunsafe');
  hit('understell','gearunsafe'); hit('reversionary','pfdfail'); hit('feather','secure'); hit('restart','restart'); hit('door','doors');
  assert.equal(D.search('zzzz').length,0); assert.equal(D.search('').length,D.EMER.length);
});

test('AFM speeds: flight model, PFD markings, checklists and panel agree (DA42 NG / DA42-VI with MÄM 42-678)',()=>{
  const V=F.AC.V; assert.equal(V.mc,71); assert.equal(V.yse,85); assert.equal(V.r,76); assert.equal(V.y,90); assert.equal(V.fe1,133); assert.equal(V.fe2,113);
  assert.equal(V.lo,152); assert.equal(V.loe,188); assert.equal(V.le,188); assert.equal(V.no,151); assert.equal(V.ne,188); assert.equal(V.s0,64); assert.equal(V.s1,72);
  const sp=k=>D.SPEEDS.filter(r=>r[0]===k).map(r=>typeof r[2]==='string'?r[2]:r[2].en).join(' | ');
  assert.match(sp('VMCA'),/^71 · 68$/); assert.match(sp('VYSE'),/^85$/); assert.match(sp('VNE'),/188/); assert.match(sp('VFE'),/133.*113/); assert.match(sp('VLO'),/188.*152/);
  assert.match(sp('VR'),/min\. 76/); assert.match(sp('VX'),/77/); assert.match(sp('VO'),/112.*119.*122/);
  assert.ok(!/VMCA 76/.test(src('da42panel.js'))&&!/Vmca 76/.test(src('avx.js')));
  for(const pg of [page,page3]){ assert.ok(!/Vmca \(76 KIAS\)/.test(pg)); assert.ok(!/rotate at 80 KIAS/.test(pg)); assert.ok(pg.includes('da42procs.js?v=')); }
});

test('no operator, school or registration names in the procedure data',()=>{
  const s=src('da42procs.js'); for(const bad of [/LN-[A-Z]{3}/,/flight ?academy/i,/flightsafety/i,/\bOFA\b/,/osloflight/i]) assert.ok(!bad.test(s),String(bad));
});
