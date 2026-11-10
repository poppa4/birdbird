// Node tests for c172core.js (run: node tests/c172core.test.mjs): engine start, carburettor ice and heat,
// magneto check, mixture and EGT, fixed-pitch propeller rpm, electrics, vacuum gyros, compass errors, fuel —
// plus the Cessna 172 type on the shared flight model (fdm.js), checked against typical POH-style numbers.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={Math,console}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['fdm.js','c172core.js']) vm.runInContext(fs.readFileSync(path.join(here,'..',f),'utf8'),ctx);
const C=ctx.C172C, F=ctx.FDM;
let pass=0, fail=0; const fails=[];
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }
function near(name,got,exp,tol){ ok(`${name}: got ${(+got).toFixed(2)}, expected ${exp} ± ${tol}`,Math.abs(got-exp)<=tol); }
const base={thr:0,mix:1,heat:0,mags:3,starter:false,fuel:true,ias:0,alt:0,oat:15,rh:0.3,rnd:0.5};
const run=(e,o,t,dt=0.02)=>{ for(let s=0;s<t;s+=dt) C.engStep(e,Object.assign({},base,o),dt); return e; };

/* ---------- starting ---------- */
{ const e=C.engInit(false,10); run(e,{thr:0.1,mags:4,starter:true},6); ok('cold engine without prime does not start',!e.run); }
{ const e=C.engInit(false,10); C.prime(e); C.prime(e); run(e,{thr:0.1,mags:4,starter:true},5); ok('cold engine with 2 primer strokes starts',e.run);
  run(e,{thr:0.1,mags:3},10); ok('runs on BOTH after the key is released',e.run); ok('oil pressure in 10 s',e.oilP>25); }
{ const e=C.engInit(false,10); for(let i=0;i<7;i++) C.prime(e); run(e,{thr:0.1,mags:4,starter:true},6); ok('over-primed (7 strokes) engine is flooded and does not start',!e.run);
  let fired=false; for(let t=0;t<8&&!fired;t+=0.02){ C.engStep(e,Object.assign({},base,{thr:1,mix:0,mags:4,starter:true}),0.02); fired=e.run; }
  ok('flooded start: throttle full, mixture cut-off, crank — it fires',fired); run(e,{thr:0.15,mix:1,mags:3},10); ok('…then mixture rich, throttle back: it keeps running',e.run); }
{ const e=C.engInit(false,10); C.prime(e); C.prime(e); run(e,{thr:0.1,mags:0,starter:true},5); ok('no start with the magnetos OFF',!e.run); }
{ const e=C.engInit(false,10); C.prime(e); C.prime(e); run(e,{thr:0.1,mags:4,starter:true,fuel:false},5); run(e,{thr:0.1,mags:3,fuel:false},180); ok('fuel selector OFF: may fire on the prime but then stops (carburettor bowl empties)',!e.run); }
{ const e=C.engInit(false,10); C.prime(e); C.prime(e); run(e,{thr:0.1,mags:4,starter:true,mix:0},5); run(e,{thr:0.1,mags:3,mix:0},5); ok('mixture in idle cut-off: no sustained running',!e.run); }
/* ---------- idle, static and run-up rpm ---------- */
{ const e=C.engInit(true,15); run(e,{thr:0},20); near('idle rpm (typical 600–700)',e.rpm,650,60);
  run(e,{thr:1},20); near('full-throttle static rpm (fixed pitch, typical ~2,300)',e.rpm,2300,100); }
/* ---------- magneto check at 1,700 RPM ---------- */
function rpmAt(thr,o,t){ const e=C.engInit(true,15); run(e,Object.assign({thr},o||{}),t||15); return e; }
let thr17=0.3; for(let k=0;k<40;k++){ const r=rpmAt(thr17).rpm; thr17+=(1700-r)*0.0002; }
{ const b=rpmAt(thr17).rpm, r=rpmAt(thr17,{mags:1}).rpm, l=rpmAt(thr17,{mags:2}).rpm; near('run-up throttle gives 1,700 RPM',b,1700,15);
  const j=C.magJudge(b,r,l); ok(`normal magneto drops within 125 RPM and 50 RPM difference (R ${j.dR}, L ${j.dL})`,j.ok&&j.dR>=40&&j.dL>=40);
  const e=C.engInit(true,15); e.plug=1; run(e,{thr:thr17,mags:1},15); const j2=C.magJudge(b,e.rpm,l); ok(`fouled plug on the right magneto exceeds the limit (R drop ${j2.dR})`,!j2.ok&&j2.dR>125);
  const e2=C.engInit(true,15); e2.magFault='L'; run(e2,{thr:thr17,mags:2},15); ok('dead left magneto: engine stops on L alone',!e2.run);
  const e3=C.engInit(true,15); e3.magFault='L'; run(e3,{thr:thr17,mags:3},15); ok('dead left magneto: runs on BOTH with a drop',e3.run&&e3.rpm<b-30);
  const h=rpmAt(thr17,{heat:1},15).rpm; ok(`carb heat drop at run-up is a modest 50–200 RPM (${Math.round(b-h)})`,b-h>50&&b-h<200);
  ok('magJudge flags "no drop" (possible ungrounded magneto)',C.magJudge(1700,1698,1650).none); }
/* ---------- carburettor ice ---------- */
ok('icing risk high at +10 °C, 95 % RH, cruise power',C.icingRisk(10,0.95,0.6)>0.6);
ok('icing risk higher at descent power than at full power',C.icingRisk(10,0.95,0.1)>C.icingRisk(10,0.95,1));
ok('little icing risk in dry air',C.icingRisk(10,0.3,0.6)<0.05);
ok('little icing risk at +35 °C',C.icingRisk(35,0.95,0.6)<0.05);
{ const e=C.engInit(true,8); const o={thr:0.62,ias:100,alt:4500,oat:8,rh:0.95}; run(e,o,10); const r0=e.rpm; run(e,o,120);
  ok(`ice builds in humid air: RPM falls (${Math.round(r0)} → ${Math.round(e.rpm)})`,e.ice>0.4&&e.rpm<r0-100);
  const before=e.rpm; let minR=1e9, minT=0; for(let t=0;t<8;t+=0.02){ C.engStep(e,Object.assign({},base,o,{heat:1}),0.02); if(e.rpm<minR){ minR=e.rpm; minT=t; } }
  ok(`carb heat on an iced engine: further RPM drop first (${Math.round(before)} → min ${Math.round(minR)})`,minR<before-30);
  ok('…and rough running while the ice melts',e.water>0.05||e.rough>0.1);
  run(e,Object.assign({},o,{heat:1}),60); ok('ice clears with carb heat',e.ice<0.02);
  run(e,o,20); ok(`RPM recovers after carb heat off (${Math.round(e.rpm)})`,e.rpm>r0-40); }
{ const e=C.engInit(true,8); run(e,{thr:0.62,ias:100,alt:4500,oat:8,rh:0.95,icing:4},200); ok('unchecked heavy icing stops the engine',!e.run&&e.dead==='carburettor ice'); }
/* ---------- mixture, EGT and fuel flow ---------- */
{ const o={thr:0.7,ias:105,alt:6000,oat:3}; let best={egt:0}; let rich=null;
  for(let m=1;m>=0.2;m-=0.02){ const e=C.engInit(true,3); run(e,Object.assign({},o,{mix:m}),40); if(m===1) rich=e; if(e.run&&e.egt>best.egt) best={egt:e.egt,m,ff:e.ff,phi:e.phi}; }
  near('peak EGT is at about stoichiometric (φ ≈ 1)',best.phi,1.0,0.08);
  ok(`leaning to peak saves fuel (${rich.ff.toFixed(1)} → ${best.ff.toFixed(1)} gal/h)`,best.ff<rich.ff*0.85);
  ok('full rich at 6,000 ft is well rich of peak',rich.egt<best.egt-80);
  const e=C.engInit(true,3); run(e,Object.assign({},o,{mix:0.1}),30); ok('far too lean: the engine quits or runs rough',!e.run||e.rough>0.3); }
/* ---------- the C172 on the shared flight model ---------- */
F.useType('C172');
ok('type loaded: one engine, flaps 0/10/20/30',F.AC.nEng===1&&F.AC.flaps.length===4);
function fly(o){ const S=F.create(); F.place(S,o.place); const e=C.engInit(true,15); let I=0; const dt=1/120;
  for(let t=0;t<o.T;t+=dt){ const r=F.readouts(S); C.engStep(e,Object.assign({},base,{thr:o.thr,mix:o.mix??1,ias:r.ias,alt:r.alt,oat:15-r.alt*0.00198}),dt);
    const pa=Math.min(1,F.isa(S.h,0).sig/0.74); S.eng[0].thr=(o.dead?0:(e.run?C.propThr(e,r.ias):0))/pa; S.eng[0].off=!!o.dead;
    if(o.ias){ const err=r.ias-o.ias; I+=err*dt; const th=Math.max(-15,Math.min(15,0.6*err+0.05*I)); S.ctl.ele=Math.max(-1,Math.min(1,0.08*(th-r.pitch)-1.5*S.q)); S.ctl.trim+=S.ctl.ele*dt*0.5; }
    S.ctl.ail=0.05*(0-r.roll)-0.5*S.p; F.step(S,dt); }
  return {o:F.readouts(S),e,S}; }
{ const r=fly({place:{N:0,E:0,alt:1000,ias:76,hdg:360},thr:1,ias:76,T:60}); near('climb at Vy, full throttle, low level (typical ~700 ft/min)',r.o.vs,700,150); ok(`climb RPM below the red line (${Math.round(r.e.rpm)})`,r.e.rpm<2650); }
{ const r=fly({place:{N:0,E:0,alt:4500,ias:100,hdg:360},thr:0.7,T:150}); ok(`cruise ~2,450 RPM gives ~105 KTAS (${r.o.tas.toFixed(0)} kt, ${Math.round(r.e.rpm)} RPM)`,r.o.tas>100&&r.o.tas<115&&Math.abs(r.o.vs)<250); ok(`cruise fuel flow full rich 8–11 gal/h (${r.e.ff.toFixed(1)})`,r.e.ff>8&&r.e.ff<11); }
{ const r=fly({place:{N:0,E:0,alt:4000,ias:65,hdg:360},thr:0,ias:65,T:60,dead:true}); const ratio=r.o.tas*101.27/-r.o.vs; ok(`engine-out glide ratio about 8–11:1 at 65 KIAS (${ratio.toFixed(1)})`,ratio>8&&ratio<11.5); }
for(const [fl,lo,hi] of [[0,44,52],[3,39,47]]){ const S=F.create(); F.place(S,{N:0,E:0,alt:3000,ias:70,hdg:360,flap:fl}); let st=null, th=null;
  for(let t=0;t<80&&!st;t+=1/120){ const r=F.readouts(S); S.eng[0].thr=0; if(th===null) th=r.pitch; th+=(-r.vs)*0.00006; S.ctl.ele=Math.max(-1,Math.min(1,0.1*(th-r.pitch)-1.5*S.q)); S.ctl.ail=0.05*(0-r.roll)-0.5*S.p; F.step(S,1/120); if(S.stall>0.3) st=r.ias; }
  ok(`stall CAS flaps ${fl?'30':'up'} in ${lo}–${hi} kt (${st&&st.toFixed(1)})`,st>lo&&st<hi); }
{ const S=F.create(); F.place(S,{N:1500,E:0,alt:300,ias:65,hdg:360}); let landed=false; const dt=1/120;
  for(let t=0;t<120&&!S.ground&&!S.crash;t+=dt){ const r=F.readouts(S); S.eng[0].thr=0; S.eng[0].off=true; const tgt=r.agl>25?65:58; const vsT=r.agl>25?null:-150; let th=r.pitch+0.6*(r.ias-tgt)*dt*10; if(vsT!==null) th=r.pitch+0.004*(vsT-r.vs); S.ctl.ele=Math.max(-1,Math.min(1,0.08*(Math.max(-10,Math.min(14,th))-r.pitch)-1.5*S.q)); S.ctl.ail=0.05*(0-r.roll)-0.5*S.p; F.step(S,dt); }
  ok(`forced landing in the field beyond the runway is allowed for the C172 (${S.crash||'landed'})`,S.ground&&!S.crash&&S.landed&&S.landed.field); }
/* ---------- electrics ---------- */
{ const b=C.elInit(); C.elStep(b,{bat:true,alt:true,rpm:0,load:4},1); ok('master on, engine stopped: LOW VOLTAGE on, discharge',b.low&&b.amps<0);
  C.elStep(b,{bat:true,alt:true,rpm:0,load:4,starter:true},1); ok('starter load sags the voltage',b.volts<23.5);
  C.elStep(b,{bat:true,alt:true,rpm:1200,load:6},1); ok('alternator on line: ~28 V, LOW VOLTAGE out, charging',!b.low&&b.volts>27.5&&b.amps>0);
  b.trip=true; C.elStep(b,{bat:true,alt:true,rpm:2400,load:12},1); ok('alternator tripped: LOW VOLTAGE on, discharge equals the load',b.low&&Math.abs(b.amps+12)<0.5);
  ok('cycling the master resets the alternator control unit',C.elReset(b)&&!b.trip);
  b.fail=true; ok('a failed alternator does not reset',!C.elReset(b)||b.fail);
  const soc=b.soc; for(let t=0;t<600;t++) C.elStep(b,{bat:true,alt:true,rpm:2400,load:15},1); ok('battery drains on its own (~15 A for 10 min)',b.soc<soc-0.15); }
/* ---------- vacuum and gyros ---------- */
{ near('suction at 2,400 RPM in the green',C.suctionOf(true,2400),4.9,0.4); ok('suction low at idle',C.suctionOf(true,650)<4.5); ok('no suction with a failed pump',C.suctionOf(false,2400)===0);
  const v=C.vacInit(true); let a; for(let t=0;t<30;t+=0.05) a=C.vacStep(v,{rpm:2400,roll:0,pitch:0,turn:0,rnd:0.5},0.05); ok('pump working: attitude indicator correct',Math.abs(a.roll)<0.5&&Math.abs(a.pitch)<0.5);
  v.pump=false; let i=0; const seq=[0.9,0.1,0.8,0.7,0.95,0.2]; for(let t=0;t<300;t+=0.05) a=C.vacStep(v,{rpm:2400,roll:0,pitch:0,turn:0,rnd:seq[i++%6]},0.05);
  ok(`pump failed: after 5 min the attitude indicator shows a false bank (${a.roll.toFixed(1)}°)`,Math.abs(a.roll)>5);
  v.drift=0; const h0=v.hdg; for(let t=0;t<30;t+=0.05) C.vacStep(v,{rpm:2400,roll:20,pitch:0,turn:3,rnd:0.5},0.05); ok('…and the heading indicator no longer follows a turn',Math.abs(C.wrap180(v.hdg-h0))<45); }
/* ---------- magnetic compass ---------- */
{ const m=C.cmpInit(0); for(let t=0;t<20;t+=0.05) C.cmpStep(m,{hdg:0,bank:0,accel:0},0.05); near('compass settles on north, wings level',C.wrap180(m.c),1,2.5);
  const m2=C.cmpInit(0); for(let t=0;t<6;t+=0.05) C.cmpStep(m2,{hdg:10,bank:20,accel:0},0.05); ok('turning right off north: the compass lags (reads less than 10°)',C.wrap180(m2.c)<5);
  const m3=C.cmpInit(180); for(let t=0;t<6;t+=0.05) C.cmpStep(m3,{hdg:190,bank:20,accel:0},0.05); ok('turning right off south: the compass leads (reads more than 190°)',m3.c>195);
  const m4=C.cmpInit(90); for(let t=0;t<4;t+=0.05) C.cmpStep(m4,{hdg:90,bank:0,accel:2},0.05); ok('accelerating on east: shows a turn towards north',m4.c<85); }
/* ---------- fuel ---------- */
{ const f={L:20,R:20}; C.fuelStep(f,1,10,360); near('BOTH draws evenly',f.L-f.R,0,0.01); near('10 gal/h for 6 min uses 1 gal',40-f.L-f.R,1,0.01);
  C.fuelStep(f,0,10,360); ok('LEFT draws from the left tank only',f.L<f.R); ok('OFF feeds nothing',!C.fuelFeeds(f,3)); ok('an empty selected tank does not feed',!C.fuelFeeds({L:0,R:10},0)&&C.fuelFeeds({L:0,R:10},1)); }

console.log(`${pass} passed, ${fail} failed`); if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
