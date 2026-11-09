// Node tests for airdatacore.js (run: node tests/airdata.test.mjs). Expected values from the ICAO standard atmosphere tables (Doc 7488) or hand-computed.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','airdatacore.js'),'utf8'),ctx); const A=ctx.ADC;
let pass=0, fail=0; const fails=[];
function eq(name,got,exp,tol){ const ok=Math.abs(got-exp)<=(tol??1e-6); if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }

/* ISA (Doc 7488 table values) */
eq('p(0)=1013.25',A.pressAt(0),1013.25,1e-9);
eq('p(5000 ft)=843.1',A.pressAt(5000),843.07,0.05);
eq('p(10000 ft)=696.8',A.pressAt(10000),696.82,0.05);
eq('p(18000 ft)=505.9',A.pressAt(18000),505.98,0.1);
eq('p(30000 ft)=300.9',A.pressAt(30000),300.9,0.1);
eq('p(39000 ft)=196.8 (above the tropopause)',A.pressAt(39000),196.8,0.2);
eq('PA(500 hPa)≈18 289 ft',A.pressAlt(500),18289,5);
eq('pressAlt inverts pressAt at 7 300 ft',A.pressAlt(A.pressAt(7300)),7300,1e-6);
eq('pressAlt inverts pressAt at 41 000 ft',A.pressAlt(A.pressAt(41000)),41000,1e-6);
eq('ISA temp 0 ft',A.isaTemp(0),15,1e-9); eq('ISA temp 10 000 ft ≈ −4.8 °C',A.isaTemp(10000),-4.81,0.01); eq('ISA temp 40 000 ft = −56.5',A.isaTemp(40000),-56.5,1e-9);
/* the altimeter */
eq('QNH set, ISA: reads the true altitude',A.indicated(A.pressAt(4000),1013.25),4000,1e-6);
eq('about 27 ft per hPa near sea level',A.ftPerHpa(1013),27.3,0.3);
eq('about 36 ft per hPa at 10 000 ft',A.ftPerHpa(697),36.4,0.6);
{ const qnh=1003, p=A.pAtTrue(3000,qnh,0), ind=A.indicated(p,1013);  // forgot to set QNH: high to low
  ok('1013 set with QNH 1003: over-reads ≈ 275 ft',ind-3000>265&&ind-3000<285); }
{ const qnh=1020, p=A.pAtTrue(800,qnh,0); eq('QFE: reads zero at the aerodrome',A.indicated(p,A.qfe(800,qnh,0)),0,1e-6); }
/* temperature error: hypsometric */
eq('ISA: true = ISA height',A.trueFromP(A.pressAt(5000),1013.25,0),5000,1e-6);
{ const t=A.trueFromP(A.pressAt(5000),1013.25,-20); ok('ISA−20: ~7 % low at 5 000 ft ('+t.toFixed(0)+')',t>4620&&t<4680); }
{ const t=A.trueFromP(A.pressAt(5000),1013.25,+20); ok('ISA+20: higher than indicated',t>5320&&t<5380); }
eq('pAtTrue inverts trueFromP (cold, low QNH)',A.trueFromP(A.pAtTrue(6200,995,-15),995,-15),6200,1e-4);
eq('rule of thumb 4 %/10 °C: 5 000 ft, −20 → 400 ft',A.coldRule(5000,-20),-400,1e-9);
eq('ICAO cold correction: 1 000 ft above a sea-level aerodrome at −30 °C ≈ 180 ft',A.icaoCold(1000,-30,0),180,8);
eq('ICAO cold correction: 0 when warmer than ISA',A.icaoCold(1000,20,0),0,0);
/* speeds */
eq('CAS→qc→CAS round trip 250 kt',A.casFromQc(A.qcFromCas(250)),250,1e-9);
{ const s=A.speeds(150,0,0); eq('sea level ISA: TAS = CAS',s.tas,150,0.01); eq('sea level: EAS = CAS',s.eas,150,0.01); }
{ const s=A.speeds(120,8000,0); ok('120 kt at 8 000 ft: TAS ≈ 135–136 kt ('+s.tas.toFixed(1)+')',s.tas>134.5&&s.tas<136.5); }
{ const s=A.speeds(250,30000,0); ok('250 kt CAS at FL300: M ≈ 0.67 ('+s.M.toFixed(3)+')',s.M>0.66&&s.M<0.675); ok('… TAS ≈ 394 kt ('+s.tas.toFixed(0)+')',s.tas>388&&s.tas<400); ok('… EAS below CAS (compressibility) ('+s.comp.toFixed(1)+')',s.comp>5&&s.comp<12); }
eq('speed of sound at 15 °C = 661.5 kt',A.sos(15),661.48,0.05); eq('speed of sound at −56.5 °C ≈ 573.6 kt',A.sos(-56.5),573.6,0.2);
{ const ps=A.pressAt(35000); eq('Mach round trip at FL350',A.machFromQc(A.qcFromMach(0.78,ps),ps),0.78,1e-9); }
{ const s=A.speeds(120,8000,-20), w=A.speeds(120,8000,20); ok('colder air: lower TAS at the same CAS',s.tas<w.tas); }
eq('rule of thumb +2 %/1000 ft',A.tasThumb(100,5000),110,1e-9);
eq('density altitude ISA sea level = 0',A.densityAlt(1013.25,15),0,0.5);
{ const da=A.densityAlt(A.pressAt(2000),30); ok('2 000 ft PA at +30 °C → DA ≈ 4 300 ft ('+da.toFixed(0)+')',da>4100&&da<4500); }
/* the pitot-static system */
{ const ps=A.pressAt(3000), qc=A.qcFromCas(100), pt=ps+qc, trap={ps,pt};
  let s=A.sensed({ps,pt,fault:'none',trap}); eq('healthy: qc',s.qc,qc,1e-9);
  s=A.sensed({ps,pt,fault:'pitot',trap}); eq('pitot blocked, drain open: ASI to zero',s.qc,0,1e-9);
  const ps2=A.pressAt(5000), pt2=ps2+qc;
  s=A.sensed({ps:ps2,pt:pt2,fault:'pitotDrain',trap}); ok('pitot and drain blocked, climb: ASI over-reads',A.casFromQc(s.qc)>100);
  s=A.sensed({ps:ps2,pt:pt2,fault:'static',trap}); ok('static blocked, climb: ASI under-reads',A.casFromQc(s.qc)<100); eq('static blocked: altimeter frozen',A.indicated(s.ps,1013.25),3000,1e-6);
  const ps1=A.pressAt(1000), pt1=ps1+qc;
  s=A.sensed({ps:ps1,pt:pt1,fault:'static',trap}); ok('static blocked, descent: ASI over-reads',A.casFromQc(s.qc)>100);
  s=A.sensed({ps:ps1,pt:pt1,fault:'both',trap}); eq('both blocked: ASI frozen',A.casFromQc(s.qc),100,1e-9);
  s=A.sensed({ps,pt,fault:'static',trap,alt:true}); ok('alternate static: altimeter reads slightly high',A.indicated(s.ps,1013.25)>3020&&A.indicated(s.ps,1013.25)<3080); ok('alternate static: ASI reads slightly high',A.casFromQc(s.qc)>101&&A.casFromQc(s.qc)<108); }
/* the VSI lag */
{ let lag=0, alt=0; for(let t=0;t<60;t+=0.01){ alt+=1000/60*0.01; lag=A.vsiStep(lag,alt,0.01,3); } eq('VSI settles on the climb rate',A.vsiRead(lag,alt,3),1000,3); }
{ let lag=0, alt=0, t=0, r=0; for(;t<3;t+=0.1){ alt+=1000/60*0.1; lag=A.vsiStep(lag,alt,0.1,3); } r=A.vsiRead(lag,alt,3); ok('VSI after 3 s shows the trend but under-reads ('+r.toFixed(0)+')',r>500&&r<700); }

console.log(`airdata: ${pass} passed, ${fail} failed`); if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
