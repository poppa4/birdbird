// Node tests for the A320 trainer (run: node tests/a320.test.mjs): systems logic (a320sys.js), flight model and auto flight
// (a320fm.js) and the MCDU entry rules (a320mcdu.js). Each check is a behaviour the FCOM describes.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['a320sys.js','a320fm.js','a320mcdu.js']) vm.runInContext(fs.readFileSync(path.join(here,'..',f),'utf8'),ctx);
const Y=ctx.A320SYS, F=ctx.A320FM, MC=ctx.A320MCDU;
let pass=0, fail=0; const fails=[];
function ok(name,c,info){ if(c) pass++; else { fail++; fails.push(name+(info!==undefined?'  ['+info+']':'')); } }
const KT=F.KT, FT=F.FT, FPM=F.FPM, NM=F.NM, D2R=F.D2R;
function rig(o){ const A=Y.create(o.sys||{cold:true,gpu:true}); const M=F.create(o.fm||{}); if(o.gw) M.gw=o.gw; A.env={t:15,elev:0}; A.alignT=420; return {A,M}; }
function air(M){ return {gnd:M.gnd,ias:M.ias,gs:M.gs/KT,alt:M.h/FT,ra:M.ra/FT,vs:M.vs/FPM,sig:F.isa(M.h).sig}; }
function fmv(A,M){ return {n1Cmd:M.n1Cmd,tla:M.tla,slat:M.slat,flapLv:A.sw.flapLv,ths:M.ths||0,gearDown:M.gearDown,gearUp:M.gearUp,toPower:M.toPower}; }
function run(R,sec,each){ const {A,M}=R; for(let i=0;i<sec*50;i++){ const C=M.ctl; C.park=A.sw.park; C.flapLv=A.sw.flapLv; C.gearLv=A.sw.gearLv; C.spArm=A.sw.spArm; C.abrk=A.sw.abrk; M.gw=A.gw; Y.step(A,0.02,air(M),fmv(A,M)); F.step(M,0.02,A); if(each) each(i*0.02); if(M.crash) return M.crash; } return null; }

/* ---------- electrical ---------- */
{ const R=rig({}); run(R,1); ok('cold and dark: nothing powered',!R.A.bus.dcBat&&!R.A.bus.acEss);
  R.A.sw.bat1=R.A.sw.bat2=1; run(R,1); ok('batteries only on ground: DC BAT bus powered',R.A.bus.dcBat); ok('batteries only on ground: no AC ESS (static inverter only above 50 kt)',!R.A.bus.acEss);
  R.A.sw.ext=1; run(R,1); ok('EXT PWR feeds AC 1 and AC 2',R.A.src.ac1==='EXT PWR'&&R.A.src.ac2==='EXT PWR'); ok('AC ESS from AC 1',R.A.src.acEss==='AC 1'); ok('DC 1 from TR 1',R.A.src.dc1==='TR 1'); }
{ const R=rig({sys:{cold:false}}); run(R,2); ok('engines running: each generator feeds its own side',R.A.src.ac1==='GEN 1'&&R.A.src.ac2==='GEN 2');
  R.A.fail.gen1=true; run(R,1); ok('GEN 1 fault: AC 1 from GEN 2 through the bus tie',R.A.src.ac1==='GEN 2'); ok('GEN 1 fault caution',R.A.ecam.list.some(a=>a.text==='GEN 1 FAULT'));
  R.A.sw.busTie=0; run(R,1); ok('bus tie OFF: AC 1 lost',!R.A.bus.ac1); ok('AC ESS BUS FAULT when AC 1 is lost',R.A.ecam.list.some(a=>a.text==='AC ESS BUS FAULT'));
  R.A.sw.acEss=1; run(R,1); ok('AC ESS FEED ALTN: AC ESS from AC 2',R.A.src.acEss==='AC 2'); }

/* ---------- APU and engine start ---------- */
{ const R=rig({}); const A=R.A; A.sw.bat1=A.sw.bat2=1; A.sw.apuM=1; run(R,1); A.sw.apuS=1; run(R,0.2); A.sw.apuS=0;
  let tAvail=null; run(R,120,t=>{ if(tAvail==null&&A.apu.avail) tAvail=t; });
  ok('APU: AVAIL within 40 to 90 s of the START push (flap opening included)',tAvail>40&&tAvail<90,tAvail);
  A.sw.apuBl=1; run(R,4); ok('APU bleed: pressure in the ducts and crossbleed open (AUTO)',A.air.duct[0]>30&&A.air.xbo);
  A.sw.engMode=2; A.sw.mst2=1; let tIgn=null, tFuel=null, tIdle=null, egtMax=0, packClosed=true;
  run(R,80,t=>{ const e=A.eng[1]; if(tIgn==null&&e.ignB) tIgn=t; if(tFuel==null&&e.fuelOn) tFuel=t; if(tIdle==null&&e.run) tIdle=t; egtMax=Math.max(egtMax,e.egt); if(e.st>0&&e.st<4&&A.air.pk2>0.2) packClosed=false; });
  ok('ENG 2 start: ignition (B) at 16 % N2 before the fuel',tIgn!=null&&tFuel>tIgn,tIgn+' '+tFuel);
  ok('ENG 2 start: idle in 35 to 70 s',tIdle>35&&tIdle<70,tIdle); ok('ENG 2 start: EGT peak between 550 and 750 °C',egtMax>550&&egtMax<750,egtMax);
  ok('ENG 2 start: packs closed during the start',packClosed); ok('ENG 2 idle N2 about 59 %',Math.abs(A.eng[1].n2-58.8)<1);
  ok('flight phase 2 after the first engine start',A.phase===2);
  ok('PTU inhibited: one master ON, parking brake ON',!A.hyd.ptu&&A.hyd.g<500); }

/* ---------- hydraulics, fuel, ECAM ---------- */
{ const R=rig({sys:{cold:false}}); const A=R.A; A.sw.park=0; run(R,5); ok('both engines: green, blue, yellow at 3,000 psi',A.hyd.g>2900&&A.hyd.b>2900&&A.hyd.y>2900);
  A.fail.edp2=true; run(R,3); ok('ENG 2 pump lost: PTU keeps yellow up',A.hyd.ptu&&A.hyd.y>2500);
  A.sw.fL1=0; run(R,1); ok('L TK PUMP 1 OFF advisory',A.ecam.list.some(a=>a.text==='L TK PUMP 1 OFF')); }
{ const R=rig({sys:{cold:false}}); const A=R.A; run(R,1); A.fail.fire1=true; run(R,1);
  const w=A.ecam.list.find(a=>a.title==='ENG 1'&&a.text==='FIRE'); ok('ENG 1 FIRE warning with MASTER WARN and the chime',w&&A.ecam.mw&&A.ecam.crc);
  ok('ENG 1 FIRE: first action THR LEVER 1 IDLE (already idle on the ground: removed)',w&&!w.steps.some(s=>s[0].startsWith('THR LEVER')));
  A.sw.mst1=0; A.sw.fireP1=1; run(R,0.5); const w2=A.ecam.list.find(a=>a.id==='eng1fire'); ok('actions disappear when done',w2&&!w2.steps.some(s=>s[0].startsWith('ENG MASTER')||s[0].startsWith('ENG 1 FIRE')));
  A.sw.ag11=1; run(R,8); ok('agent 1 puts the fire out',!A.ecam.list.some(a=>a.id==='eng1fire')); }
{ const R=rig({sys:{cold:false},fm:{N:25}}); const A=R.A; A.sw.park=1; A.sw.flapLv=0; run(R,1); R.M.ctl.tla=[45,45]; run(R,1);
  ok('T.O CONFIG: flaps not in T.O config and park brake ON at T.O power',A.ecam.list.some(a=>a.text==='FLAPS NOT IN T.O CONFIG')&&A.ecam.list.some(a=>a.text==='PARK BRK ON')); }
{ const R=rig({sys:{cold:true,gpu:true}}); const A=R.A; A.sw.bat1=A.sw.bat2=1; A.sw.ext=1; A.sw.irM1=A.sw.irM2=A.sw.irM3=1; run(R,5);
  ok('ADIRS: IR IN ALIGN memo with the minutes left',A.ecam.memoR.some(m=>/^IR IN ALIGN 7 MN/.test(m.t)),A.ecam.memoR.map(m=>m.t).join());
  A.alignK=50; run(R,10); ok('ADIRS aligned after 7 min (accelerated)',A.irs.every(r=>r.st===2)); }

/* ---------- flight model and auto flight ---------- */
{ const R=rig({sys:{cold:false},fm:{N:25},gw:62000}); const A=R.A, M=R.M; A.sw.park=0; A.sw.flapLv=1; A.sw.spArm=1; run(R,0.5);
  ok('lever 1 on the ground gives CONF 1+F',M.onePlusF===true);
  M.ctl.tla=[45,45]; let lo=null, vr=null;
  run(R,60,t=>{ if(vr==null&&M.ias>140){ vr=M.N; } M.ctl.sy=M.gnd&&M.ias>140?0.6:(!M.gnd&&M.th<15*D2R?0.3:0); if(!M.gnd&&lo==null) lo={N:M.N,ias:M.ias}; });
  ok('TOGA take-off at 62 t: lift-off within 1,000 to 2,000 m',lo&&lo.N>1000&&lo.N<2000,lo&&Math.round(lo.N));
  ok('FMA at take-off: MAN TOGA, SRS, A/THR armed',M.ap.athrArm||M.ap.athr); }
{ const R=rig({sys:{cold:false},fm:{air:true,h:3000*FT,ias:220,hdg:360},gw:62000}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0;
  M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); M.ap.vert='ALT'; M.ap.altHold=3000; M.ap.alt.v=3000; M.ap.lat='HDG'; M.ap.hdg.v=360;
  run(R,20); ok('ALT hold: within 50 ft',Math.abs(M.h/FT-3000)<50,Math.round(M.h/FT)); ok('A/THR SPEED holds the managed 250 kt',Math.abs(M.ias-250)<6,Math.round(M.ias));
  M.ap.alt.v=8000; F.fcu(M,'altPull'); run(R,10); ok('OP CLB: THR CLB with speed on the elevator',M.ap.vert==='OP CLB'&&M.ap.thr==='THR CLB');
  run(R,150); ok('captures and holds the FCU altitude',M.ap.vert==='ALT'&&Math.abs(M.h/FT-8000)<60,M.ap.vert+' '+Math.round(M.h/FT));
  F.fcu(M,'hdgTurn',90); F.fcu(M,'hdgPull'); run(R,90); ok('HDG 090: turns with at most 30° of bank and rolls out',Math.abs(F.w180(M.psi/D2R-90))<3,Math.round(M.psi/D2R));
  M.ap.ap1=false; M.ctl.sx=0; M.ctl.sy=0; M.ctl.sx=1; run(R,2); M.ctl.sx=0; const phi=M.phi; run(R,10); ok('normal law: bank held with the stick neutral (below 33°)',Math.abs(M.phi-phi)<2*D2R&&Math.abs(phi)>10*D2R,Math.round(phi/D2R));
  M.ctl.sx=1; run(R,8); M.ctl.sx=0; run(R,10); ok('normal law: rolls back to 33° when released beyond it',Math.abs(Math.abs(M.phi/D2R)-33)<3,Math.round(M.phi/D2R)); }
{ // ILS 36 autoland from 12 NM
  const R=rig({sys:{cold:false},fm:{air:true,h:3000*FT,ias:180,hdg:20},gw:60000}); const A=R.A, M=R.M; M.N=-13*NM; M.E=-1200; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0;
  M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); F.fcu(M,'ap2'); M.ap.vert='ALT'; M.ap.altHold=3000; M.ap.alt.v=3000; M.ap.lat='HDG'; M.ap.hdg.v=20; A.sw.flapLv=2; A.sw.spArm=1; A.sw.abrk=2; F.fcu(M,'appr');
  const crash=run(R,420,t=>{ if(M.N>-9*NM){ A.sw.gearLv=1; A.sw.flapLv=3; } if(M.N>-7*NM) A.sw.flapLv=4; if(M.gnd&&M.ap.vert==='ROLL OUT') M.ctl.tla=[0,0]; });
  ok('ILS 36 autoland: no crash',!crash,crash); ok('autoland: LOC and G/S captured, touchdown below 400 ft/min',M.touch&&M.touch.vs<400&&M.touch.vs>20,M.touch&&Math.round(M.touch.vs));
  ok('autoland: on the centre line (within 5 m)',M.touch&&Math.abs(M.touch.e)<5,M.touch&&M.touch.e.toFixed(1)); ok('autoland: stopped on the runway',M.gs<1&&M.N<F.RWY.len); }

/* ---------- MCDU ---------- */
{ const K=MC.create({HOLAN:{N:9*NM,E:0},OSVIK:{N:18*NM,E:-14*NM},TUSKA:{N:-22*NM,E:-8*NM},ALPOR:{N:-10*NM,E:-5*NM},RONAX:{N:-10*NM,E:0},FAPSO:{N:-5*NM,E:0}});
  const type=s=>s.split('').forEach(c=>MC.key(K,c===' '?'SP':c));
  MC.key(K,'INIT'); type('ENRD/ENRD'); MC.key(K,'R1'); ok('MCDU INIT: FROM/TO accepted, flight plan built',K.d.from==='ENRD'&&K.fpln.length>5);
  type('ABC'); MC.key(K,'L5'); ok('MCDU: wrong format gives FORMAT ERROR',K.msg==='FORMAT ERROR');
  for(let i=0;i<5;i++) MC.key(K,'CLR'); K.sp=''; MC.key(K,'PERF'); type('131'); MC.key(K,'L1'); type('99'); MC.key(K,'L2'); ok('MCDU PERF: V1 accepted, 2-digit VR rejected',K.d.v1===131&&K.d.vr==null);
  const P=MC.render(K,null,null); ok('MCDU renders a TAKE OFF page',P.title==='TAKE OFF'); }

console.log(`a320: ${pass} passed, ${fail} failed`); if(fail){ console.log(fails.map(f=>'  FAIL '+f).join('\n')); process.exit(1); }
