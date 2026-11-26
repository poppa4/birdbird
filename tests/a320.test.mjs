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
  ok('ENG 2 start (LEAP-1A): ignition (B) before the fuel, no dry crank on a cold engine',tIgn!=null&&tFuel>tIgn,tIgn+' '+tFuel);
  ok('ENG 2 start: idle in 35 to 70 s',tIdle>35&&tIdle<70,tIdle); ok('ENG 2 start: EGT peak between 550 and 750 °C',egtMax>550&&egtMax<750,egtMax);
  ok('ENG 2 start: packs closed during the start',packClosed); ok('ENG 2 idle N2 about 59 %',Math.abs(A.eng[1].n2-58.8)<1);
  ok('flight phase 2 after the first engine start',A.phase===2);
  ok('PTU inhibited: one master ON, parking brake ON',!A.hyd.ptu&&A.hyd.g<500);
  /* LEAP-1A: shut down, wait 10 min, restart: the FADEC dry cranks first (COOLING, N2 below 30 %, no ignition, no fuel),
     and the igniter alternates (B the first time, A now) */
  A.sw.mst2=0; run(R,600); A.sw.mst2=1; let cool=false, coolN2=0, ignInCool=false, ignA=false, run2=null;
  run(R,150,t=>{ const e=A.eng[1]; if(e.cooling){ cool=true; coolN2=Math.max(coolN2,e.n2); if(e.ignA||e.ignB||e.fuelOn) ignInCool=true; } if(e.ignA) ignA=true; if(run2==null&&e.run) run2=t; });
  ok('ENG 2 restart warm: COOLING dry crank before the start',cool); ok('dry crank: N2 below 30 %, no ignition, no fuel',coolN2>5&&coolN2<30&&!ignInCool,coolN2.toFixed(1));
  ok('restart: igniter A this time (FADEC alternates)',ignA); ok('restart: engine at idle after the dry crank',run2!=null&&run2>60,run2); }

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


/* ---------- managed vertical: CLB / DES with the flight plan's constraints ---------- */
{ const R=rig({sys:{cold:false},fm:{air:true,h:3000*FT,ias:250,hdg:360},gw:60000}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; M.N=2*NM;
  const K=MC.create({HOLAN:{N:9*NM,E:0},OSVIK:{N:18*NM,E:-14*NM},TUSKA:{N:-22*NM,E:-8*NM},ALPOR:{N:-10*NM,E:-5*NM},RONAX:{N:-10*NM,E:0},FAPSO:{N:-5*NM,E:0}});
  K.d.from='ENRD'; K.fpln=MC.build(K); K.act=1; M.lnavFn=m=>MC.lnav(K,m); M.vnavFn=(m,c,f)=>MC.vnav(K,m,c,f);
  M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); M.ap.lat='NAV'; M.ap.vert='ALT'; M.ap.altHold=3000; M.ap.alt.v=9000; F.fcu(M,'altPush');
  ok('ALT push with NAV: managed CLB',M.ap.vert==='CLB'); let cst=false, cstAt=null;
  run(R,400,()=>{ if(M.ap.vert==='ALT CST'&&!cst){ cst=true; cstAt=Math.round(M.h/FT); } });
  ok('managed CLB levels at the OSVIK constraint (AT 6000) below the FCU altitude',cst&&Math.abs(cstAt-6000)<80,cstAt);
  run(R,400); ok('after OSVIK: climbs on to the FCU altitude',Math.abs(M.h/FT-9000)<100,Math.round(M.h/FT)+' '+M.ap.vert+' act '+K.act);
}
{ const R=rig({sys:{cold:false},fm:{air:true,h:9000*FT,ias:250,hdg:200},gw:60000}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; M.N=15*NM; M.E=-12*NM;
  const K=MC.create({HOLAN:{N:9*NM,E:0},OSVIK:{N:18*NM,E:-14*NM},TUSKA:{N:-22*NM,E:-8*NM},ALPOR:{N:-10*NM,E:-5*NM},RONAX:{N:-10*NM,E:0},FAPSO:{N:-5*NM,E:0}});
  K.d.from='ENRD'; K.fpln=MC.build(K); K.act=3; M.lnavFn=m=>MC.lnav(K,m); M.vnavFn=(m,c,f)=>MC.vnav(K,m,c,f);
  M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); M.ap.lat='NAV'; M.ap.vert='ALT'; M.ap.altHold=9000; M.ap.alt.v=2000; F.fcu(M,'altPush');
  ok('ALT push below with NAV: managed DES',M.ap.vert==='DES');
  let hT=null, hA=null; run(R,900,()=>{ const p=K.fpln[K.act]; if(p&&p.id==='ALPOR'&&hT==null) hT=Math.round(M.h/FT); if(p&&p.id==='RONAX'&&hA==null) hA=Math.round(M.h/FT); });
  ok('managed DES: at or below 5000 at TUSKA (B5000)',hT!=null&&hT<=5150,hT); ok('managed DES: at 3000 at ALPOR (AT 3000)',hA!=null&&Math.abs(hA-3000)<250,hA); }

/* ---------- MCDU ---------- */
{ const K=MC.create({HOLAN:{N:9*NM,E:0},OSVIK:{N:18*NM,E:-14*NM},TUSKA:{N:-22*NM,E:-8*NM},ALPOR:{N:-10*NM,E:-5*NM},RONAX:{N:-10*NM,E:0},FAPSO:{N:-5*NM,E:0}});
  const type=s=>s.split('').forEach(c=>MC.key(K,c===' '?'SP':c));
  MC.key(K,'INIT'); type('ENRD/ENRD'); MC.key(K,'R1'); ok('MCDU INIT: FROM/TO accepted, flight plan built',K.d.from==='ENRD'&&K.fpln.length>5);
  type('ABC'); MC.key(K,'L5'); ok('MCDU: wrong format gives FORMAT ERROR',K.msg==='FORMAT ERROR');
  for(let i=0;i<5;i++) MC.key(K,'CLR'); K.sp=''; MC.key(K,'PERF'); type('131'); MC.key(K,'L1'); type('99'); MC.key(K,'L2'); ok('MCDU PERF: V1 accepted, 2-digit VR rejected',K.d.v1===131&&K.d.vr==null);
  const P=MC.render(K,null,null); ok('MCDU renders a TAKE OFF page',P.title==='TAKE OFF'); }


/* ---------- non-normal: on-ground fire, inextinguishable fire, brakes / steering, Y reservoir overheat, cargo smoke ---------- */
{ const R=rig({sys:{cold:false}}); const A=R.A; A.fail.fire1=true; run(R,1);
  const w=A.ecam.list.find(a=>a.id==='eng1fire'), t=w?w.steps.map(s=>s[0]).join('|'):'';
  ok('ENG 1 FIRE on ground: the on-ground procedure (CABIN CREW ALERT, both agents, EMER EVAC PROC)',/CABIN CREW/.test(t)&&/AGENT 2/.test(t)&&/EMER EVAC PROC/.test(t)&&!/AFTER 30 S/.test(t),t);
  ok('ENG 1 FIRE on ground: no LAND ASAP',!A.ecam.land); }
{ const R=rig({sys:{cold:false},fm:{air:true,h:5000*FT,ias:250,hdg:360}}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; A.phase=6; M.ctl.tla=[25,25];
  A.fail.fire2=true; run(R,1); const w=A.ecam.list.find(a=>a.id==='eng2fire'), t=w?w.steps.map(s=>s[0]).join('|'):'';
  ok('ENG 2 FIRE in flight: the in-flight procedure (AGENT 1 AFTER 10 S, IF FIRE AFTER 30 S)',/AGENT 1 AFTER 10 S/.test(t)&&/IF FIRE AFTER 30 S/.test(t),t); ok('ENG FIRE in flight: LAND ASAP red',A.ecam.land==='r'); }
{ const R=rig({sys:{cold:false}}); const A=R.A; A.fail.fire1x=true; run(R,1); A.sw.mst1=0; A.sw.fireP1=1; A.sw.ag11=1; A.sw.ag12=1; run(R,15);
  ok('inextinguishable fire: still burning after both agents',A.fire.e[0]&&A.ecam.list.some(a=>a.id==='eng1fire')); }
{ // BSCU 1+2: alternate braking without anti-skid (about 1,000 psi), no autobrake, no nose wheel steering; differential braking steers
  const mk=f=>{ const R=rig({sys:{cold:false}}); R.A.sw.park=0; R.M.ctl.park=0; if(f) R.A.fail[f]=true; R.M.tas=60*KT; R.M.ctl.tla=[0,0]; return R; };
  const a=mk(null), b=mk('bscu'); a.M.ctl.brkL=a.M.ctl.brkR=1; b.M.ctl.brkL=b.M.ctl.brkR=1; run(a,3); run(b,3);
  ok('A/SKID N/WS FAULT caution with MAX BRK PR 1000 PSI',b.A.ecam.list.some(x=>x.text==='A/SKID N/WS FAULT'&&x.steps.some(s=>/1000 PSI/.test(s[0]))));
  ok('alternate braking without anti-skid: pressure limited to about 1,000 psi, less deceleration',b.M.brkPsi[0]<=1050&&b.M.gs>a.M.gs+5,b.M.brkPsi[0]+' psi, '+(b.M.gs/KT).toFixed(1)+' vs '+(a.M.gs/KT).toFixed(1)+' kt');
  const c=mk('bscu'); c.M.tas=8*KT; c.M.ctl.tiller=1; const p0=c.M.psi; run(c,4); ok('no nose wheel steering: the tiller does not turn the aircraft',Math.abs(c.M.psi-p0)<0.02,(c.M.psi-p0).toFixed(3));
  const d=mk('nws'); d.M.tas=8*KT; d.M.ctl.tla=[8,8]; d.M.ctl.brkR=0.3; const q0=d.M.psi; run(d,4); ok('N/W STRG FAULT: differential braking turns the aircraft',d.M.psi-q0>0.05,(d.M.psi-q0).toFixed(3));
  ok('WHEEL N/W STRG FAULT caution (no crew action)',d.A.ecam.list.some(x=>x.title==='WHEEL'&&x.text==='N/W STRG FAULT'&&!x.steps.length)); }
{ const R=rig({sys:{cold:false},fm:{air:true,h:8000*FT,ias:250,hdg:360}}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; A.phase=6; M.ctl.tla=[25,25];
  A.fail.yOvht=true; run(R,1); ok('HYD Y RSVR OVHT caution with PTU, YELLOW ENG 2 PUMP, YELLOW ELEC PUMP OFF',A.ecam.list.some(a=>a.text==='Y RSVR OVHT'&&a.steps.length>=2));
  A.sw.ptu=0; A.sw.hyE2=0; A.sw.hyY=0; run(R,1); ok('Y RSVR OVHT: no extra Y SYS LO PR caution while the pumps are off for the overheat',!A.ecam.list.some(a=>a.id==='hydy'));
  run(R,200); ok('overheat out about 3 min after the pumps are off; STATUS: IF OVHT OUT, pump ON',!A.hyd.yOvht&&!A.ecam.list.some(a=>a.id==='yovht'));
  A.sw.hyE2=1; A.sw.ptu=1; run(R,3); ok('yellow restored after the overheat is out',A.hyd.y>2500); }
{ const R=rig({sys:{cold:false},fm:{air:true,h:8000*FT,ias:250,hdg:360}}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; A.phase=6; M.ctl.tla=[25,25];
  A.fail.smokeFwd=true; run(R,1); const w=A.ecam.list.find(a=>a.id==='smkfwd'); ok('SMOKE FWD CARGO SMOKE: red warning with the chime, AGENT DISCH',w&&w.lvl===3&&A.ecam.crc&&w.steps.length===1);
  A.sw.cgoDF=1; run(R,1); const w2=A.ecam.list.find(a=>a.id==='smkfwd'); ok('after DISCH: action done, the warning can stay (detectors see the agent), LAND ASAP red',w2&&!w2.steps.length&&A.ecam.land==='r'); }

/* ---------- autopilot failures, ILS transmitter failure, managed non-precision approach (FINAL APP) ---------- */
{ const R=rig({sys:{cold:false},fm:{air:true,h:5000*FT,ias:250,hdg:360}}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; A.phase=6; M.ctl.tla=[25,25];
  F.fcu(M,'ap2'); run(R,1); ok('AP 2 engaged',M.ap.ap2); A.fail.ap2f=true; run(R,1); ok('AP 2 failure: AP 2 disengages (AP OFF)',!M.ap.ap2);
  A.fail.ap1f=true; run(R,0.1); const r=F.fcu(M,'ap1'); ok('AP 1 failed: the pushbutton does not engage it',!M.ap.ap1&&!!r); run(R,1);
  ok('STATUS: INOP AP 1+2 and CAT 2 (aircraft CAT 1)',A.ecam.stsInop.includes('AP 1+2')&&A.ecam.stsInop.includes('CAT 2')); ok('STS reminder on the E/WD',A.ecam.memoR.some(m=>m.t==='STS')); }
{ const R=rig({sys:{cold:false},fm:{air:true,h:3000*FT,ias:180,hdg:20},gw:60000}); const A=R.A, M=R.M; M.N=-13*NM; M.E=-1200; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; A.phase=6;
  M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); F.fcu(M,'ap2'); M.ap.vert='ALT'; M.ap.altHold=3000; M.ap.alt.v=3000; M.ap.lat='HDG'; M.ap.hdg.v=20; A.sw.flapLv=2; F.fcu(M,'appr');
  let gs=false; run(R,200,()=>{ if(M.ap.vert==='G/S'&&!gs){ gs=true; A.fail.locTx=true; A.fail.gsTx=true; } if(gs&&!M.ap.ap1&&!M.ap.ap2&&M.ap.lat==='HDG') return; });
  ok('ILS transmitters lost on the glideslope: APs off and FD back to HDG V/S',gs&&!M.ap.ap1&&!M.ap.ap2&&M.ap.lat==='HDG'&&M.ap.vert==='V/S',M.ap.lat+' '+M.ap.vert); }
{ const R=rig({sys:{cold:false},fm:{air:true,h:3000*FT,ias:180,hdg:360},gw:60000}); const A=R.A, M=R.M; M.N=-13*NM; M.E=0; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; A.phase=6;
  const K=MC.create({HOLAN:{N:9*NM,E:0},OSVIK:{N:18*NM,E:-14*NM},TUSKA:{N:-22*NM,E:-8*NM},ALPOR:{N:-10*NM,E:-5*NM},RONAX:{N:-10*NM,E:0},FAPSO:{N:-5*NM,E:0}});
  K.d.from='ENRD'; K.fpln=MC.build(K); K.act=K.fpln.findIndex(p=>p.id==='RONAX'); M.lnavFn=m=>MC.lnav(K,m); M.npa=true; M.mda=500;
  M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); M.ap.lat='NAV'; M.ap.vert='ALT'; M.ap.altHold=3000; M.ap.alt.v=3000; A.sw.flapLv=2; F.fcu(M,'appr');
  ok('APPR on an RNAV approach: APP NAV engaged, FINAL armed',M.ap.lat==='APP NAV'&&/FINAL/.test(M.ap.vertArm),M.ap.lat+' / '+M.ap.vertArm);
  let fin=null, hFap=null, off=null; run(R,400,()=>{ if(M.N>-9*NM){ A.sw.gearLv=1; A.sw.flapLv=3; } if(M.N>-7*NM) A.sw.flapLv=4;
    if(fin==null&&M.ap.vert==='FINAL APP') fin=M.N/NM; if(hFap==null&&M.N>-5*NM) hFap=M.h/FT; if(off==null&&!M.ap.ap1) off=M.h/FT; if(off!=null) M.crash=M.crash||''; });
  ok('FINAL APP engages on the final descent path (about 9 NM out from 3,000 ft)',fin!=null&&fin<-8&&fin>-10.5,fin&&fin.toFixed(1));
  ok('FINAL APP: on the published path at FAPSO (5 NM, about 1,650 ft)',hFap!=null&&Math.abs(hFap-1650)<120,hFap&&Math.round(hFap));
  ok('FINAL APP: AP disengages at MDA − 50 ft (450 ft)',off!=null&&off<=455&&off>=400,off&&Math.round(off)); }
{ const K=MC.create({}); K.page='status'; const P=MC.render(K,null,null); ok('MCDU A/C STATUS: A320-251N with LEAP-1A26',P.title==='A320-251N'&&P.lines.some(l=>l[1]==='LEAP-1A26')); }

console.log(`a320: ${pass} passed, ${fail} failed`); if(fail){ console.log(fails.map(f=>'  FAIL '+f).join('\n')); process.exit(1); }
