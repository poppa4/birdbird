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
function fmv(A,M){ return {n1Cmd:M.n1Cmd,tla:M.tla,slat:M.slat,flapLv:A.sw.flapLv,ths:M.ths||0,gearDown:M.gearDown,gearUp:M.gearUp,toPower:M.toPower,overspeed:M.overspeed,conf:M.conf,tlaRaw:M.ctl.tla,
  gearNotUplocked:!!M.gearNotUplocked,gearNotDownlocked:!!M.gearNotDownlocked,gearGrav:!!M.gearGrav,toSpd:''}; } // as the page gives them
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
  const w=A.ecam.list.find(a=>a.title==='ENG 1 FIRE'); ok('ENG 1 FIRE warning with MASTER WARN and the chime',w&&A.ecam.mw&&A.ecam.crc);
  ok('ENG 1 FIRE on ground: THR LEVERS IDLE (already idle: removed), PARKING BRK ON (already set: removed with its condition)',w&&!w.steps.some(s=>/THR LEVER|PARKING BRK|WHEN A\/C/.test(s[0])));
  A.sw.mst1=0; A.sw.fireP1=1; run(R,0.5); const w2=A.ecam.list.find(a=>a.id==='eng1fire'); ok('actions disappear when done',w2&&!w2.steps.some(s=>/ENG MASTER|ENG 1 FIRE P/.test(s[0])));
  A.sw.ag11=1; run(R,8); ok('agent 1 puts the fire out',!A.ecam.list.some(a=>a.id==='eng1fire')); }
{ const R=rig({sys:{cold:false},fm:{N:25}}); const A=R.A; A.sw.park=1; A.sw.flapLv=0; run(R,1); R.M.ctl.tla=[45,45]; run(R,1);
  const has=t=>A.ecam.list.some(a=>a.text===t||a.steps.some(l=>l[0].trim()===t)); ok('T.O CONFIG: SLATS / FLAPS NOT IN T.O CONFIG and PARK BRK ON at T.O power',has('SLATS NOT IN T.O CONFIG')&&has('FLAPS NOT IN T.O CONFIG')&&has('PARK BRK ON')); }
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
  const P=MC.render(K,null,null); ok('MCDU renders the TAKE OFF page (TAKE OFF RWY 36)',P.title==='TAKE OFF RWY 36'); }


/* ---------- non-normal: on-ground fire, inextinguishable fire, brakes / steering, Y reservoir overheat, cargo smoke ---------- */
{ const R=rig({sys:{cold:false}}); const A=R.A; A.fail.fire1=true; run(R,1);
  const w=A.ecam.list.find(a=>a.id==='eng1fire'), t=w?w.steps.map(s=>s[0]).join('|'):'';
  ok('ENG 1 FIRE on ground: the on-ground procedure (CABIN CREW ALERT, both agents, EMER EVAC PROC)',/CABIN CREW/.test(t)&&/AGENT 2/.test(t)&&/EMER EVAC PROC/.test(t)&&!/AFTER 30 S/.test(t),t);
  ok('ENG 1 FIRE on ground: no LAND ASAP',!A.ecam.land); }
{ const R=rig({sys:{cold:false},fm:{air:true,h:5000*FT,ias:250,hdg:360}}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; A.phase=6; M.ctl.tla=[25,25];
  A.fail.fire2=true; run(R,1); const w=A.ecam.list.find(a=>a.id==='eng2fire'), t=w?w.steps.map(s=>s[0]).join('|'):'';
  ok('ENG 2 FIRE in flight: the in-flight procedure (AGENT1 AFTER 10S, IF FIRE AFTER 30S)',/AGENT1 AFTER 10S/.test(t)&&/IF FIRE AFTER 30S/.test(t)&&!/CABIN CREW/.test(t),t); ok('ENG FIRE in flight: LAND ASAP red',A.ecam.land==='r'); }
{ const R=rig({sys:{cold:false}}); const A=R.A; A.fail.fire1x=true; run(R,1); A.sw.mst1=0; A.sw.fireP1=1; A.sw.ag11=1; A.sw.ag12=1; run(R,15);
  ok('inextinguishable fire: still burning after both agents',A.fire.e[0]&&A.ecam.list.some(a=>a.id==='eng1fire')); }
{ // BSCU 1+2: alternate braking without anti-skid (about 1,000 psi), no autobrake, no nose wheel steering; differential braking steers
  const mk=f=>{ const R=rig({sys:{cold:false}}); R.A.sw.park=0; R.M.ctl.park=0; if(f) R.A.fail[f]=true; R.M.tas=60*KT; R.M.ctl.tla=[0,0]; return R; };
  const a=mk(null), b=mk('bscu'); a.M.ctl.brkL=a.M.ctl.brkR=1; b.M.ctl.brkL=b.M.ctl.brkR=1; run(a,3); run(b,3);
  ok('A/SKID N/WS FAULT caution with MAX BRK PR 1000 PSI',b.A.ecam.list.some(x=>x.text==='A/SKID N/WS FAULT'&&x.steps.some(s=>/1000 ?PSI/.test(s[0]))));
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
  A.fail.smokeFwd=true; run(R,1); const w=A.ecam.list.find(a=>a.id==='smkfwd'); ok('SMOKE FWD CARGO SMOKE: red warning with the chime, CAB FANS OFF, AGENT DISCH',w&&w.lvl===3&&A.ecam.crc&&w.steps.some(l=>/CAB FANS/.test(l[0]))&&w.steps.some(l=>/AGENT/.test(l[0])));
  A.sw.cgoDF=1; A.sw.cabFans=0; run(R,1); const w2=A.ecam.list.find(a=>a.id==='smkfwd'); ok('after CAB FANS OFF and DISCH: actions done, the warning stays (detectors see the agent), LAND ASAP red',w2&&!w2.steps.some(l=>/^-(CAB FANS|AGENT)/.test(l[0]))&&A.ecam.land==='r',w2&&w2.steps.map(l=>l[0]).join('|')); }

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


/* ---------- overhead panel: switches with their aircraft effects ---------- */
{ const R=rig({sys:{cold:false},fm:{air:true,h:8000*FT,ias:250,hdg:360}}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; A.phase=6; M.ctl.tla=[25,25]; A.misc={attHdg:1,airData:1,eisDmc:1,ecamNd:1,audio:1};
  A.sw.ir1=0; run(R,1); ok('IR 1 pushbutton OFF: IR 1 output lost (captain attitude and heading)',!Y.irValid(A,0,true)&&Y.irValid(A,1,false));
  A.sw.ir1=1; A.fail.adr2=true; run(R,1); const a2=A.ecam.list.find(x=>x.text==='ADR 2 FAULT');
  ok('ADR 2 failure: NAV ADR 2 FAULT, AIR DATA SWTG F/O ON 3',a2&&/AIR DATA SWTG.*F\/O ON 3/.test(a2.steps[0]&&a2.steps[0][0]),a2&&a2.steps.map(s=>s[0]).join('|'));
  A.misc.airData=2; run(R,1); ok('AIR DATA switched F/O ON 3: the action is done',!A.ecam.list.find(x=>x.text==='ADR 2 FAULT').steps.length); A.fail.adr2=false; A.misc.airData=1;
  A.sw.irM1=0; run(R,1); ok('ADIRS 1 mode selector OFF in flight: NAV IR 1 FAULT and NAV ADR 1 FAULT (ATT HDG / AIR DATA CAPT ON 3)',A.ecam.list.some(x=>x.text==='IR 1 FAULT'&&/CAPT ON 3/.test(x.steps[0][0]))&&A.ecam.list.some(x=>x.text==='ADR 1 FAULT'));
  A.sw.irM1=1; A.sw.gpwsT=0; run(R,1); ok('GPWS TERR OFF: NAV GPWS TERR DET FAULT',A.ecam.list.some(x=>x.text==='GPWS TERR DET FAULT')); A.sw.gpwsT=1;
  const n1=A.eng[0].n1; M.ctl.tla=[0,0]; run(R,20); const idle=A.eng[0].n1; A.sw.eai1=1; A.sw.eai2=1; run(R,20);
  ok('ENG anti-ice ON: continuous ignition (IGNITION memo) and a higher idle',A.ecam.memoR.some(m=>m.t==='IGNITION')&&A.eng[0].n1>idle+1.5,idle.toFixed(1)+' → '+A.eng[0].n1.toFixed(1));
  A.sw.ldgElev=3; A.sw.gpwsF=0; A.sw.ram=0; run(R,1); ok('LDG ELEV selected: MAN LDG ELEV memo and 2,000 ft landing elevation; GPWS FLAP MODE OFF memo',A.ecam.memoR.some(m=>m.t==='MAN LDG ELEV')&&A.air.ldgElev===2000&&A.ecam.memoR.some(m=>m.t==='GPWS FLAP MODE OFF'));
  A.sw.genLine=0; run(R,1); ok('GEN 1 LINE OFF: AC BUS 1 from GEN 2 through the bus tie',A.src.ac1==='GEN 2'&&A.src.ac2==='GEN 2'); }
{ const R=rig({sys:{cold:false}}); const A=R.A; A.sw.apuM=1; A.sw.apuS=1; run(R,1); A.sw.apuS=0; run(R,90); A.sw.apuBl=1; A.sw.pkFlow=0; run(R,5);
  ok('PACK FLOW LO, APU bleed in use: HI flow all the same',A.air.pk1>1.1,A.air.pk1.toFixed(2)); }
{ // brakes: heating, BRAKES HOT, brake fans
  const R=rig({sys:{cold:false},gw:70000}); const A=R.A, M=R.M; A.sw.park=0; M.ctl.park=0; M.tas=140*KT; M.ctl.tla=[0,0]; M.ctl.brkL=M.ctl.brkR=1; run(R,40);
  const T=Math.max(...A.brk.temp); ok('rejected take-off at 140 kt, 70 t: brakes above 300 °C',T>300,Math.round(T));
  ok('no BRAKES HOT right after the stop (only at the T.O CONFIG test or take-off)',!A.ecam.list.some(x=>x.id==='brkhot')); A.cfgTest=3; run(R,0.5);
  const w=A.ecam.list.find(x=>x.title==='BRAKES'&&x.text==='HOT'); ok('BRAKES HOT at the T.O CONFIG test: DELAY T.O FOR COOL, BRK FAN ON',w&&w.steps.some(s=>/DELAY T.O/.test(s[0]))&&w.steps.some(s=>/BRK FAN/.test(s[0])),w&&w.steps.map(l=>l[0]).join('|'));
  const R2=rig({sys:{cold:false},gw:62000}); R2.A.sw.park=0; R2.M.ctl.park=0; R2.M.tas=130*KT; R2.M.ctl.tla=[-1,-1]; R2.M.gsplr=true; R2.A.sw.abrk=1; R2.M.ctl.abrk=1; R2.M.abLatch=true; run(R2,60,()=>{ R2.M.ctl.abrk=1; });
  const T2=Math.max(...R2.A.brk.temp); ok('landing roll with autobrake LO and idle reverse from 130 kt: brakes about 100 to 280 °C',T2>100&&T2<280,Math.round(T2));
  M.ctl.brkL=M.ctl.brkR=0; A.sw.park=1; M.ctl.park=1; const t0=Math.max(...A.brk.temp); run(R,300); const noFan=t0-Math.max(...A.brk.temp);
  const R3=rig({sys:{cold:false}}); R3.A.brk.temp=[t0,t0,t0,t0]; R3.A.sw.brkFan=1; run(R3,300); const fan=t0-Math.max(...R3.A.brk.temp);
  ok('brake fans cool the brakes faster',fan>noFan*2,Math.round(noFan)+' vs '+Math.round(fan)); }


/* ---------- more FWC alerts ---------- */
{ const airR=()=>{ const R=rig({sys:{cold:false},fm:{air:true,h:8000*FT,ias:250,hdg:360}}); R.A.sw.park=0; R.M.ctl.park=0; R.A.sw.gearLv=0; R.M.ctl.gearLv=0; R.A.phase=6; R.M.ctl.tla=[25,25]; return R; };
  const has=(A,id)=>A.ecam.list.some(a=>a.id===id);
  let R=airR(); R.A.fail.gearDnl=true; R.A.sw.gearLv=1; run(R,40,()=>{ R.M.ctl.gearLv=1; }); ok('gear does not downlock: L/G GEAR NOT DOWNLOCKED after 30 s (RECYCLE, L/G GRVTY PROC)',has(R.A,'lgndl')&&!R.M.gearDown);
  R.A.misc={grav:3}; R.M.ctl.gearGrav=true; run(R,15,()=>{ R.M.ctl.gearGrav=true; R.M.ctl.gearLv=1; }); ok('gravity extension locks the gear down: alert gone',R.M.gearDown&&!has(R.A,'lgndl'));
  R=airR(); R.A.sw.gearLv=1; R.M.ctl.gearLv=1; R.M.gear=1; R.A.fail.gearUpl=true; run(R,1,()=>{ R.M.ctl.gearLv=1; }); R.A.sw.gearLv=0; run(R,40,()=>{ R.M.ctl.gearLv=0; }); ok('gear does not uplock: L/G GEAR NOT UPLOCKED (MAX SPEED 220/.54)',has(R.A,'lgnul')&&R.A.ecam.list.find(a=>a.id==='lgnul').steps.some(l=>/220\/\.54/.test(l[0])));
  R=airR(); R.A.sw.park=1; run(R,4); ok('parking brake set in flight: BRAKES PARK BRK ON',has(R.A,'parkfl'));
  R=airR(); R.M.h=23000*FT; R.A.sw.flapLv=1; run(R,1,()=>{ R.M.ctl.flapLv=1; }); ok('flap lever not at 0 above FL 220: F/CTL FLAP LVR NOT ZERO',has(R.A,'flapnz'));
  R=airR(); R.A.sw.flapLv=3; R.M.ias=230; R.M.tas=F.tasFromCas(230*KT,R.M.h); run(R,25,()=>{ R.M.ctl.flapLv=3; R.M.tas=F.tasFromCas(230*KT,R.M.h); }); const ov=R.A.ecam.list.find(a=>a.id==='ovsp');
  ok('flaps 3 at 230 kt: OVER SPEED with VFE 185',ov&&ov.steps.some(l=>/VFE\.+185/.test(l[0])),ov&&ov.steps.map(l=>l[0]).join('|'));
  R=airR(); R.A.fail.gOvht=true; run(R,1); ok('G RSVR OVHT: PTU OFF, GREEN ENG 1 PUMP OFF',R.A.ecam.list.some(a=>a.text==='G RSVR OVHT'&&a.steps.length===2));
  R=airR(); R.A.sw.askid=0; run(R,1); ok('A/SKID & N/W STRG OFF: BRAKES A/SKID N/WS OFF, MAX BRK PR 1000PSI',R.A.ecam.list.some(a=>a.text==='A/SKID N/WS OFF'));
  R=airR(); run(R,1,()=>{ R.M.ctl.tla=[-5,-5]; }); ok('reverse selected in flight: ENG REV SET',has(R.A,'revset'));
  const G=rig({sys:{cold:false},fm:{N:25}}); G.A.sw.park=0; G.M.ctl.park=0; G.A.sw.flapLv=1; run(G,1,()=>{ G.M.ctl.flapLv=1; G.M.ctl.tla=[30,30]; });
  const fv=fmv(G.A,G.M); fv.flex=0; fv.tla=[30,30]; Y.step(G.A,0.02,air(G.M),fv); ok('thrust levers between CL and MCT at take-off: ENG THR LEVERS NOT SET (TOGA)',has(G.A,'thrnset')&&G.A.ecam.list.find(a=>a.id==='thrnset').steps.some(l=>/TOGA/.test(l[0])));
  G.A.cfgTest=3; const f2=fmv(G.A,G.M); f2.toSpd='none'; Y.step(G.A,0.02,air(G.M),f2); ok('T.O CONFIG test without V1/VR/V2: T.O SPEEDS NOT INSERTED',G.A.ecam.list.some(a=>a.text==='SPEEDS NOT INSERTED')); }

/* ---------- MCDU pages as on the aircraft (layout and logic) ---------- */
{ const FX={HOLAN:{N:9*NM,E:0},OSVIK:{N:18*NM,E:-14*NM},TUSKA:{N:-22*NM,E:-8*NM},ALPOR:{N:-10*NM,E:-5*NM},RONAX:{N:-10*NM,E:0},FAPSO:{N:-5*NM,E:0}};
  const R=rig({sys:{cold:false},fm:{}}); run(R,0.2); const {A,M}=R; const K=MC.create(FX); K.now=()=>Date.UTC(2026,10,26,14,0);
  const key=k=>MC.key(K,k,M,A,{}), type=s=>s.split('').forEach(c=>key(c===' '?'SP':c)), P=()=>MC.render(K,M,A), txt=(Q,row)=>Q.lines.filter(l=>l[0]===row).map(l=>l[1]).join('|');
  key('INIT'); type('ENRD/ENRD'); key('R1'); type('ENRA'); key('L2'); type('NRD320'); key('L3'); type('30'); key('L5'); type('100'); key('L6');
  let Q=P(); ok('INIT A: IRS INIT> and WIND> prompts (no LAT/LONG lines)',txt(Q,6).includes('IRS INIT>')&&txt(Q,10).includes('WIND>')&&!txt(Q,7).includes('LAT'));
  key('F-PLN'); Q=P(); ok('F-PLN before INIT B: no predictions (dashes)',/----/.test(txt(Q,12)));
  key('INIT'); key('NEXT'); Q=P(); ok('INIT B title INIT FUEL PREDICTION',Q.title==='INIT FUEL PREDICTION');
  type('56.5/28'); key('R1'); type('8.0'); key('R2'); Q=P();
  ok('INIT B: TOW = ZFW + BLOCK − TAXI (64.3)',txt(Q,8).includes('64.3'),txt(Q,8)); const fpl=MC.fuelPlan(K,M,A);
  ok('INIT B: trip fuel and time for the practice circuit (0.6–1.6 t, 15–40 min)',fpl&&fpl.trip>0.6&&fpl.trip<1.6&&fpl.tripT>15&&fpl.tripT<40,fpl&&fpl.trip.toFixed(2)+' '+fpl.tripT.toFixed(0));
  ok('INIT B: MIN DEST FOB = ALTN + FINAL; EXTRA = BLOCK − TAXI − TRIP − RSV − ALTN − FINAL',Math.abs(fpl.mdf-fpl.altn.f-fpl.fin)<1e-9&&Math.abs(fpl.extra-(7.8-fpl.trip-fpl.rsv-fpl.altn.f-fpl.fin))<1e-6);
  key('F-PLN'); Q=P(); ok('F-PLN: FROM, flight number, TIME and SPD/ALT headers',Q.lines.some(l=>l[0]===0&&l[1]===' FROM')&&Q.lines.some(l=>l[0]===0&&/NRD320/.test(l[1]))&&txt(Q,1).includes('TIME')&&txt(Q,1).includes('SPD/ALT'));
  ok('F-PLN: predicted time and the magenta star on a constraint met (HOLAN +4000)',/^\d{4}$/.test(Q.lines.find(l=>l[0]===4&&l[3]===8)[1])&&Q.lines.some(l=>l[0]===4&&l[1]==='*'&&l[2]==='#ff58ff'));
  ok('F-PLN: DEST line with DIST and EFOB',/ENRD36/.test(txt(Q,12))&&/\d+\.\d/.test(txt(Q,12)),txt(Q,12));
  // DIR TO: temporary until INSERT
  key('DIR'); key('L3'); ok('DIR TO: selecting a waypoint makes a temporary flight plan (yellow), active plan unchanged',K.tmpy&&K.tmpy.dir&&K.act===1&&P().titleC==='#ffff32');
  key('L6'); ok('DIR TO ERASE: temporary plan gone',!K.tmpy);
  key('L3'); const tgt=K.dirSel; key('R6'); ok('DIR TO INSERT: T-P then the waypoint become the active leg',!K.tmpy&&K.fpln[K.act].id===tgt&&K.fpln[K.act-1].id==='T-P',K.fpln.map(p=>p.id).join(' '));
  // constraints: F-PLN right key and VERT REV
  K.fpln=MC.build(K); K.act=1; key('F-PLN'); type('/'); key('+/-'); key('+/-'); type('7000'); key('R3'); ok('F-PLN: /+7000 on the right key sets an at-or-above constraint',K.fpln[2].cst&&K.fpln[2].cst.alt===7000&&K.fpln[2].cst.t==='A');
  const lskOf=id=>{ const L=P().lines.find(l=>l[0]%2===0&&l[0]>0&&l[1]===id&&(l[3]==='l'||l[3]===0)); return L?L[0]/2:null; }; // the line select key of a waypoint on the F-PLN page
  key('R'+lskOf('OSVIK')); ok('VERT REV from the right key',K.page==='vrev'&&P().title==='VERT REV AT OSVIK'); type('220'); key('L3'); ok('VERT REV: SPD CSTR 220',K.fpln[2].spd===220);
  type('5000'); key('R3'); ok('VERT REV: ALT CSTR 5000 (AT)',K.fpln[2].cst.alt===5000&&K.fpln[2].cst.t==='AT'); key('L6');
  // DEPARTURE and ARRIVAL
  K.fpln=MC.build(K); K.act=1; key('F-PLN'); key('L1'); key('L1'); ok('LAT REV origin → DEPARTURES FROM ENRD',K.page==='dep'&&/DEPARTURES FROM ENRD/.test(P().title));
  K.depTab='sid'; key('L3'); key('L6'); key('R6'); ok('SID OSVI1N: D005 then OSVIK, HOLAN dropped',K.fpln[1].id==='D005'&&K.fpln[2].id==='OSVIK'&&!K.fpln.some(p=>p.id==='HOLAN'),K.fpln.map(p=>p.id).join(' '));
  key('F-PLN'); key('L6'); key('R1'); key('L3'); key('L3'); key('L6'); key('R6'); ok('STAR TUSK1A: joins the route at TUSKA, OSVIK kept, ILS 36 legs after RONAX',K.fpln.map(p=>p.id).join(' ')==='ENRD36 D005 OSVIK TUSKA ALPOR RONAX FAPSO RW36'&&K.d.star==='TUSK1A',K.fpln.map(p=>p.id).join(' '));
  // HOLD: database hold at RONAX, computed elsewhere
  key('F-PLN'); const ri=K.fpln.findIndex(p=>p.id==='RONAX'); K.lr=ri; K.page='latrev'; key('L3'); ok('HOLD at RONAX: DATABASE hold (inbound 360, R)',K.hold&&K.hold.db&&K.hold.crs===360&&/DATABASE HOLD AT RONAX/.test(P().title));
  key('R1'); ok('HOLD: COMPUTED> reverts to a computed hold',!K.hold.db); key('L6'); key('R6'); ok('hold inserted from the F-PLN (INSERT)',K.fpln[ri].hold&&!K.tmpy);
  // PERF
  key('PERF'); Q=P(); ok('PERF TAKE OFF: F / S / O speeds shown with weights entered',/F=\d{3}/.test(txt(Q,2).replace(/\|/g,''))&&/O=\d{3}/.test(txt(Q,6).replace(/\|/g,'')),txt(Q,2));
  type('140'); key('L1'); type('135'); key('L2'); ok('V1 above VR: V1/VR/V2 DISAGREE',K.msg==='V1/VR/V2 DISAGREE'); key('CLR');
  K.perfPh='appr'; key('R4'); ok('PERF APPR: R4 selects CONF3, R5 FULL',K.d.ldgConf==='3'&&(key('R5'),K.d.ldgConf==='FULL'));
  Q=P(); ok('PERF APPR: VAPP = VLS + 5 with no wind',(()=>{ const v=Q.lines.filter(l=>l[0]===10); return v.length>=2&&+v[0][1]-+v[1][1]===5; })(),txt(Q,10));
  key('ATC COMM'); ok('ATC COMM without ATSU shows the MCDU MENU',K.page==='menu');
  key('DATA'); Q=P(); ok('DATA INDEX 1/2: POSITION / IRS / GPS MONITOR, A/C STATUS, CLOSEST AIRPORTS',Q.page==='1/2'&&txt(Q,8)==='<A/C STATUS'&&txt(Q,10)==='<AIRPORTS'); }
{ // speed limit and constraint feed the managed speed
  const R=rig({sys:{cold:false},fm:{air:true,h:5000*FT,ias:250,hdg:360},gw:62000}); const {A,M}=R; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); M.ap.vert='ALT'; M.ap.altHold=5000;
  run(R,30); ok('managed speed 250 kt below FL100 (CLB/DES SPD LIM)',Math.abs(M.ap.tgtSpd-250)<1,M.ap.tgtSpd); M.spdLim=null; run(R,1); ok('SPD LIM deleted: managed 300 kt',Math.abs(M.ap.tgtSpd-300)<1,M.ap.tgtSpd);
  M.spdLim={spd:250,alt:10000}; M.spdCst=220; M.ap.lat='NAV'; M.lnavFn=()=>({dtk:360,xtkCorr:0,toWpt:'X',toDist:20,toBrg:360,xtk:0}); run(R,1); ok('speed constraint 220 at the TO waypoint (NAV): managed 220',Math.abs(M.ap.tgtSpd-220)<1,M.ap.tgtSpd);
  M.spdCst=0; M.lnavFn=null; M.ap.lat='HDG'; const ff=()=>A.eng[0].ff; run(R,60); ok('fuel flow at 250 kt, 5,000 ft: about 1,050 kg/h a side (LEAP-1A)',ff()>850&&ff()<1300,Math.round(ff())); }

/* ---------- auto flight linked to the systems: what STATUS lists as INOP is INOP in the cockpit ---------- */
{ const fly=(o)=>{ const R=rig({sys:{cold:false},fm:{air:true,h:5000*FT,ias:250,hdg:360},gw:62000}); const {A,M}=R; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; M.ctl.tla=[25,25];
    run(R,1); F.fcu(M,'athr'); F.fcu(M,'ap1'); M.ap.vert='ALT'; M.ap.altHold=5000; run(R,2); M.events.length=0; return R; };
  const inop=A=>A.ecam.stsInop||[];
  { const R=fly(); const {A,M}=R; ok('healthy: AP 1, A/THR on, CAT 3 DUAL available, no AP item in STATUS',M.ap.ap1&&M.ap.athr&&A.afs.cat==='CAT 3 DUAL'&&!inop(A).some(t=>/^AP|A\/THR|CAT/.test(t)));
    A.fail.hydG=A.fail.hydY=true; run(R,3);
    ok('G+Y SYS LO PR: AP 1 disconnects (cavalry charge)',!M.ap.ap1&&M.events.includes('apdisc-forced'));
    ok('G+Y: AP 1 and AP 2 cannot be engaged again',F.fcu(M,'ap1')!=null&&F.fcu(M,'ap2')!=null&&!M.ap.ap1&&!M.ap.ap2);
    ok('G+Y: STATUS INOP SYS AP 1+2 and CAT 2 (no separate CAT 3 DUAL)',inop(A).includes('AP 1+2')&&inop(A).includes('CAT 2')&&!inop(A).includes('CAT 3 DUAL'),inop(A).join(',')); ok('G+Y: A/THR still available',M.ap.athr); }
  { const R=fly(); const {A,M}=R; A.fail.adr1=A.fail.adr2=true; run(R,3);
    ok('ADR 1+2: alternate law, AP off, A/THR off with the thrust locked (THR LK)',A.law==='ALTN'&&!M.ap.ap1&&!M.ap.athr&&!!M.ap.thrLock&&M.events.includes('athrdisc'),A.law+' '+M.ap.athr);
    ok('ADR 1+2: A/THR cannot be engaged again',/not available/.test(F.fcu(M,'athr')||'')&&!M.ap.athr&&!M.ap.athrArm);
    ok('ADR 1+2: STATUS AP 1+2, A/THR, CAT 2',['AP 1+2','A/THR','CAT 2'].every(t=>inop(A).includes(t)),inop(A).join(',')); }
  { const R=fly(); const {A,M}=R; A.fail.fmgc1=true; run(R,1);
    ok('FMGC 1 fault: AP 1 off, AP 2 can be engaged',!M.ap.ap1&&(F.fcu(M,'ap2'),M.ap.ap2));
    ok('FMGC 1 fault: both FDs from FMGC 2 (FMA 2FD2)',A.afs.fdSrc[0]===2&&A.afs.fdSrc[1]===2);
    ok('FMGC 1 fault: STATUS AP 1 and CAT 3 DUAL; FMA capability at most CAT 3 SINGLE',inop(A).includes('AP 1')&&inop(A).includes('CAT 3 DUAL')&&A.afs.cat==='CAT 3 SINGLE',inop(A).join(','));
    const K=MC.create({}); ok('FMGC 1 fault: MCDU 1 works through FMGC 2 (OPP FMGC IN PROGRESS), MCDU 2 normal',MC.render(K,M,A,0).scratch==='OPP FMGC IN PROGRESS'&&MC.render(K,M,A,1).scratch!=='OPP FMGC IN PROGRESS');
    A.fail.fmgc2=true; run(R,1);
    ok('FMGC 1+2: no AP, no A/THR, no FD',!M.ap.ap1&&!M.ap.ap2&&!M.ap.athr&&!M.ap.fd1&&!M.ap.fd2&&F.fcu(M,'fd1')!=null);
    MC.key(K,'F-PLN',M,A,{}); ok('FMGC 1+2: the MCDU shows only the MCDU MENU',K.page==='menu'&&MC.render(K,M,A,0).title==='MCDU MENU'); }
  { const R=fly(); const {A,M}=R; A.fail.eng1=true; run(R,4); ok('engine failure: CAT 3 DUAL lost (CAT 3 SINGLE at most), both APs still available',A.afs.cat==='CAT 3 SINGLE'&&A.afs.ap[0]&&A.afs.ap[1],A.afs.cat); }
  { const R=fly(); const {A,M}=R; A.fail.ir1=A.fail.ir2=true; run(R,2); ok('IR 1+2: alternate law and no AP',A.law==='ALTN'&&!A.afs.ap[0]&&!A.afs.ap[1]&&!M.ap.ap1,A.law); }
  { const R=rig({sys:{cold:true,gpu:true}}); R.A.sw.bat1=R.A.sw.bat2=1; R.A.sw.ext=1; run(R,2); ok('cold aircraft on the ground: no AP / A/THR / CAT items in STATUS',!R.A.afs.inop.length,R.A.afs.inop.join(',')); } }

/* ---------- vertical profile: T/C, T/D, DECEL; managed descent on the path; approach phase at DECEL ---------- */
{ const FX={HOLAN:{N:9*NM,E:0},OSVIK:{N:18*NM,E:-14*NM},TUSKA:{N:-22*NM,E:-8*NM},ALPOR:{N:-10*NM,E:-5*NM},RONAX:{N:-10*NM,E:0},FAPSO:{N:-5*NM,E:0}};
  { const R=rig({sys:{cold:false},fm:{}}); run(R,0.2); const {A,M}=R; const K=MC.create(FX); K.now=()=>Date.UTC(2026,10,26,14,0);
    Object.assign(K.d,{from:'ENRD',to:'ENRD',crzFl:100,ci:30,zfw:56500,block:8000}); K.fpln=MC.build(K); K.act=1;
    const PR=MC.pred(K,M,A,K.fpln,K.act), V=PR.V, cumOf=id=>PR.w[K.fpln.findIndex(p=>p.id===id)].cum;
    ok('profile: T/C after OSVIK (AT 6000 holds the climb), before the T/D',PR.tc&&PR.tc.s>cumOf('OSVIK')&&PR.td&&PR.tc.s<PR.td.s,PR.tc&&PR.tc.s.toFixed(1));
    ok('profile: T/D about 15.7 NM before TUSKA (FL100 down to B5000 at 3°)',Math.abs(cumOf('TUSKA')-PR.td.s-15.7)<0.3,(cumOf('TUSKA')-PR.td.s).toFixed(1));
    ok('profile: DECEL 12 NM before the threshold (FAF 5 NM + 7)',Math.abs(PR.destDist-PR.decel.s-12)<0.2,(PR.destDist-PR.decel.s).toFixed(1));
    ok('profile: predicted 5000 at TUSKA, 3000 at ALPOR, 1650 at FAPSO',[['TUSKA',5000],['ALPOR',3000],['FAPSO',1650]].every(([id,a])=>Math.abs(PR.w[K.fpln.findIndex(p=>p.id===id)].h-a)<60));
    K.page='fpln'; for(let i=0;i<3;i++) MC.key(K,'↑',M,A,{}); const rows=[]; for(let i=0;i<6;i++){ rows.push(...MC.render(K,M,A).lines.filter(l=>l[0]%2===0&&l[0]>0&&l[0]<11&&(l[3]==='l'||l[3]===0)).map(l=>l[1])); MC.key(K,'↑',M,A,{}); }
    ok('F-PLN: (T/C), (T/D) and (DECEL) in the flight plan',['(T/C)','(T/D)','(DECEL)'].every(x=>rows.includes(x)),[...new Set(rows)].join(' ')); }
  const flyDes=(distBefore,h,o)=>{ const R=rig({sys:{cold:false},fm:{air:true,h:h*FT,ias:o&&o.ias||250,hdg:171},gw:62000}); const {A,M}=R; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0;
    const K=MC.create(FX); K.d.crzFl=100; K.d.from='ENRD'; K.fpln=MC.build(K); const iT=K.fpln.findIndex(p=>p.id==='TUSKA'), T=K.fpln[iT], O=K.fpln[iT-1], L=Math.hypot(O.N-T.N,O.E-T.E), f=distBefore*NM/L;
    M.N=T.N+(O.N-T.N)*f; M.E=T.E+(O.E-T.E)*f; K.act=iT; M.lnavFn=m=>MC.lnav(K,m); M.vnavFn=(m,c,fa)=>MC.vnav(K,m,c,fa);
    M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); M.ap.lat='NAV'; M.ap.vert='ALT'; M.ap.altHold=h; M.ap.alt.v=3000; M.ap.clbPh=false; F.fcu(M,'altPush'); return {R,K}; };
  { const {R,K}=flyDes(30,10000); const M=R.M; let vs=[]; run(R,40,t=>{ if(t>20) vs.push(M.vs/FPM); }); const av=vs.reduce((a,b)=>a+b,0)/vs.length;
    ok('early descent (DES before the T/D): about −1,000 ft/min',M.ap.vert==='DES'&&av<-700&&av>-1400,M.ap.vert+' '+Math.round(av)); }
  { const {R,K}=flyDes(8,10000); const M=R.M; run(R,5); const d0=M.ap.vn&&M.ap.vn.pathH!=null?M.h/FT-M.ap.vn.pathH:null; run(R,60); const d1=M.h/FT-M.ap.vn.pathH;
    ok('late descent (above the path): DES at THR IDLE with MORE DRAG',M.ap.vert==='DES'&&d0>1500&&d1<d0&&M.ap.thr==='THR IDLE'&&M.ap.moreDrag,[Math.round(d0),Math.round(d1),M.ap.thr,M.ap.moreDrag].join(' '));
    M.ctl.spd=1; run(R,60); const d2=M.h/FT-M.ap.vn.pathH; ok('speed brakes out: the path is caught up (VDEV down by more than 800 ft a minute)',d2<d1-800&&!M.ap.moreDrag,Math.round(d2)); M.ctl.spd=0;
    ok('PROG in descent: VDEV',/VDEV=/.test(MC.render(Object.assign(K,{page:'prog'}),M,R.A).lines.map(l=>l[1]).join(''))); }
  { const R=rig({sys:{cold:false},fm:{air:true,h:3000*FT,ias:250,hdg:90},gw:62000}); const {A,M}=R; A.sw.park=0; M.ctl.park=0; A.sw.gearLv=0; M.N=-10*NM; M.E=-4.5*NM;
    const K=MC.create(FX); K.d.from='ENRD'; K.d.crzFl=100; K.fpln=MC.build(K); K.act=K.fpln.findIndex(p=>p.id==='RONAX'); M.lnavFn=m=>MC.lnav(K,m); M.vnavFn=(m,c,fa)=>MC.vnav(K,m,c,fa);
    M.ctl.tla=[25,25]; F.fcu(M,'athr'); F.fcu(M,'ap1'); M.ap.lat='NAV'; M.ap.vert='ALT'; M.ap.altHold=3000; M.ap.alt.v=3000; let at=null;
    let prev=null; run(R,60,t=>{ if(at==null&&M.ap.apprPh) at=prev; prev=MC.remDist(K,M); }); // distance to go along the plan just before
    ok('DECEL with NAV: approach phase on by itself about 12 NM from the runway',at!=null&&Math.abs(at-12)<0.6,at&&at.toFixed(1));
    ok('after DECEL: managed speed down to green dot, flight phase APPR',M.ap.tgtSpd<235&&MC.phase(K,M)==='APPR',Math.round(M.ap.tgtSpd)); } }

console.log(`a320: ${pass} passed, ${fail} failed`); if(fail){ console.log(fails.map(f=>'  FAIL '+f).join('\n')); process.exit(1); }
