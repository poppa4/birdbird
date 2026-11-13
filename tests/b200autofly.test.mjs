// B200 auto-fly ILS: flies a stabilised approach to touchdown and rollout (run: node --test tests/b200autofly.test.mjs).
// Regression: with Auto-fly on and gear / flaps left untouched, the B200 went around at minimums ("not in landing
// configuration"). b200-app.js now sets gear down and flaps approach itself at 6.5 NM (afConfig) when the student has not.
// Headless and in sim time: fdm.js with the B200 type block and afConfig() read from b200-app.js, so the test follows the page.
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), src=f=>fs.readFileSync(path.join(here,'..',f),'utf8');
const NM=1852, APP=src('b200-app.js');
function rng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

function fly(o){ o=o||{};
  const ctx={Math,console}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
  vm.runInContext(src('fdm.js'),ctx); ctx.F=ctx.FDM;
  const ty=APP.match(/Object\.assign\(F\.AC,\{name:'B200'[\s\S]*?\}\}\);/); assert.ok(ty,'B200 type block in b200-app.js'); vm.runInContext(ty[0],ctx);
  vm.runInContext(src('airproc.js'),ctx);
  const F=ctx.FDM, A=ctx.AIRPROC, S=F.create(), D=A.def('ils','B200',{}), st=D.start; F.WORLD.gsOut=false;
  F.place(S,{N:st.N,E:st.E,alt:st.alt,ias:st.ias,hdg:st.hdg,gear:0,flap:0});
  S.env.wdir=o.wdir||0; S.env.wspd=o.wspd||0; S.env.turb=o.turb||0; S.rng=rng(o.seed||1);
  const said=[];
  const AF=A.autofly({type:'B200',S,F,AP:null,power:{get:()=>S.eng[0].thr,set:v=>S.eng.forEach(e=>e.thr=v)},say:m=>said.push(m),cfg:()=>({gear:S.ctl.gear,flap:S.ctl.flap})});
  AF.setProc('ils',{}); assert.ok(AF.engage(),'engages in the air');
  // the page's own afConfig(), with the page's gear and flap controls stubbed
  const fn=APP.match(/\nfunction afConfig\(\)\{[\s\S]*?\}\n(?=function toggleAuto)/); assert.ok(fn,'afConfig() in b200-app.js');
  const SYS={gearH:0}; Object.assign(ctx,{S,AF,SYS,L:x=>x.en,tr2:(en,no)=>({en,no}),pill:()=>{},flash:m=>said.push(m),
    toggleGear:()=>{ SYS.gearH=SYS.gearH?0:1; S.ctl.gear=SYS.gearH; },setFlap:n=>{ S.ctl.flap=n; }});
  vm.runInContext(fn[0],ctx); const afConfig=o.student?()=>{}:ctx.afConfig;
  const dt=0.05, N=12, h=dt/N; let t=0, at1000=null, td=null, maxE=0, cfgAt=null;
  while(t<900&&AF.on&&!S.crash){
    AF.tick(dt); afConfig();
    if(cfgAt==null&&S.ctl.gear>=1) cfgAt=-S.N/NM;
    for(let i=0;i<N;i++){ const r=F.readouts(S); AF.sub(r,h); const g0=S.ground; F.step(S,h);
      if(!g0&&S.ground&&!td){ td={ias:r.ias,E:S.E,N:S.N,vs:r.vs,hdg:r.hdg}; } }
    const r=F.readouts(S); t+=dt;
    if(!at1000&&AF.segs[AF.si]&&AF.segs[AF.si].t==='final'&&r.agl<1000) at1000={ias:r.ias,vs:r.vs,gear:S.ctl.gearPos,flap:S.ctl.flapPos,gs:F.nav(S,'LOC',360).gs,loc:F.nav(S,'LOC',360).dev};
    if(S.ground) maxE=Math.max(maxE,Math.abs(S.E));
  }
  return {AF,S,F,t,at1000,td,maxE,cfgAt,said,T:A.TY&&A.TY.B200}; }

function landedOk(r,name,lim){
  assert.equal(r.S.crash||null,null,name+': no crash');
  assert.equal(r.AF.rec.decision,'land',name+': lands at minimums, no go-around');
  assert.ok(r.td,name+': touchdown');
  assert.ok(r.td.N>0&&r.td.N<900,`${name}: touchdown in the first 900 m of the runway (${r.td.N.toFixed(0)} m)`);
  assert.ok(Math.abs(r.td.E)<lim.E,`${name}: touchdown within ${lim.E} m of the centreline (${r.td.E.toFixed(1)} m)`);
  assert.ok(r.td.vs>-lim.vs,`${name}: sink rate at touchdown under ${lim.vs} ft/min (${r.td.vs.toFixed(0)})`);
  assert.ok(r.td.ias>85&&r.td.ias<125,`${name}: touchdown speed 85–125 KIAS (${r.td.ias.toFixed(0)})`);
  assert.ok(r.maxE<15,`${name}: rollout stays on the 30 m runway (${r.maxE.toFixed(1)} m from the centreline)`);
  assert.ok(r.S.N<1500&&Math.abs(r.S.Vg)<3,`${name}: stops on the runway (${r.S.N.toFixed(0)} m)`);
  assert.equal(r.AF.on,false,name+': auto-fly hands back after the rollout');
}

test('B200 auto-fly ILS, calm, gear and flaps untouched: auto-fly configures, stabilised at 1000 ft, lands and stops', ()=>{
  const r=fly({});
  assert.ok(r.cfgAt>5&&r.cfgAt<=6.6,`gear and flaps set by auto-fly before the final approach fix (${r.cfgAt&&r.cfgAt.toFixed(1)} NM)`);
  assert.ok(r.said.some(m=>/Auto-fly: gear down, flaps approach/.test(m)),'says what it did');
  assert.ok(r.S.ctl.gear===1&&r.S.ctl.flap>=1,'landing configuration');
  const s=r.at1000; assert.ok(s,'passes 1000 ft on final');
  assert.ok(s.gear>0.99&&s.flap>=0.99,'1000 ft: gear down and flaps set');
  assert.ok(Math.abs(s.ias-108)<=10,`1000 ft: on speed (${s.ias.toFixed(0)} KIAS, target 108)`);
  assert.ok(s.vs<-300&&s.vs>-1000,`1000 ft: sink rate ${s.vs.toFixed(0)} ft/min`);
  assert.ok(Math.abs(s.loc)<0.25&&s.gs&&Math.abs(s.gs.dev)<0.5,'1000 ft: on the localizer and glide slope');
  const m=r.AF.rec.mins; assert.ok(Math.abs(m.locDots)<0.3&&Math.abs(m.gsDots)<0.5&&Math.abs(m.ias-108)<8,'on the ILS and on speed at DA');
  landedOk(r,'calm',{E:3,vs:300});
});

/* moderate setting: 10 kt across, 30 % turbulence, fixed gust seeds (the page uses Math.random). The landing itself (flare, crab,
   rollout) is the shared airproc.js logic; in rougher air (15 kt, 50 %) a few per cent of landings on every type end in a wingtip
   strike or off the runway edge, so the limits here are for the moderate case. */
for(const [name,wdir,seed] of [['from the right',90,7],['from the left',270,11],['from the right, other gusts',90,23]])
  test(`B200 auto-fly ILS, 10 kt crosswind ${name} and 30 % turbulence: lands on the runway`, ()=>{
    const r=fly({wdir,wspd:10,turb:0.3,seed});
    landedOk(r,name,{E:10,vs:450});
  });

test('B200 auto-fly ILS: gear and flaps the student already set are left alone (no message)', ()=>{
  const ctx={}; const said=[]; let gear=0, flap=0;
  const fn=APP.match(/\nfunction afConfig\(\)\{[\s\S]*?\}\n(?=function toggleAuto)/)[0];
  Object.assign(ctx,{S:{ground:false,N:-6*NM,ctl:{flap:2}},AF:{on:true,ph:'',said:{},segs:[{t:'final'}],si:0},SYS:{gearH:1},F:{NM},L:x=>x.en,tr2:(en,no)=>({en,no}),
    pill:()=>{},flash:m=>said.push(m),toggleGear:()=>{ gear++; },setFlap:()=>{ flap++; }});
  vm.createContext(ctx); vm.runInContext(fn,ctx); ctx.afConfig();
  assert.deepEqual([gear,flap,said.length],[0,0,0]);
  ctx.AF.said={}; ctx.SYS.gearH=0; ctx.S.N=-8*NM; ctx.afConfig(); assert.equal(gear,0,'not before 6.5 NM');
  ctx.S.N=-6*NM; ctx.afConfig(); ctx.afConfig(); assert.deepEqual([gear,flap,said.length],[1,0,1],'gear only, once');
});

test('b200-app.js runs afConfig() right after the auto-fly tick, and both B200 pages load the same app version', ()=>{
  assert.match(APP,/AF\.tick\(dt\); afConfig\(\);/);
  const v=f=>(src(f).match(/b200-app\.js\?v=(\d+)/)||[])[1];
  assert.ok(v('b200.html')&&v('b200.html')===v('b200-3d.html'));
});
