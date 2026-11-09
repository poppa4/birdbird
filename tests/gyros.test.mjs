// Node tests for gyrocore.js (run: node tests/gyros.test.mjs). Expected values from the EASA 022 textbook rules or hand-computed.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','gyrocore.js'),'utf8'),ctx); const Y=ctx.GYC;
let pass=0, fail=0; const fails=[];
function eq(name,got,exp,tol){ const ok=Math.abs(got-exp)<=(tol??1e-6); if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }

/* dip */
eq('dip at the equator = 0',Y.dip(0),0,1e-9);
eq('dip at 60° N ≈ 73.9° (dipole)',Y.dip(60),73.9,0.1);
eq('tan dip = 2 tan lat at 45°',Math.tan(Y.dip(45)*Y.R),2,1e-9);
ok('dip negative in the south',Y.dip(-60)<0);
/* true, magnetic, compass */
eq('T 100, var 6 E → M 094',Y.magFromTrue(100,6),94,1e-9);
eq('M 094, dev 2 W → C 096',Y.compFromMag(94,-2),96,1e-9);
eq('back: C 096, dev 2 W, var 6 E → T 100',Y.trueFromComp(96,-2,6),100,1e-9);
eq('T 005, var 10 E → M 355 (wraps)',Y.magFromTrue(5,10),355,1e-9);
eq('deviation B sin: 3° E on 090',Y.deviation(90,3,0),3,1e-9);
/* acceleration errors: ANDS (northern hemisphere) */
const acc={man:'acc',lat:60,ktps:2}, dec={man:'dec',lat:60,ktps:2};
{ const e=Y.compassErr(90,acc); ok('heading 090, accelerate: shows a turn towards north (reads less) '+e.toFixed(1),e<-1); }
{ const e=Y.compassErr(270,acc); ok('heading 270, accelerate: shows a turn towards north (reads more) '+e.toFixed(1),e>1); }
{ const e=Y.compassErr(90,dec); ok('heading 090, decelerate: towards south (reads more) '+e.toFixed(1),e>1); }
eq('heading 360, accelerate: no error',Y.compassErr(0,acc),0,1e-9);
eq('heading 180, accelerate: no error',Y.compassErr(180,acc),0,1e-9);
ok('largest on east/west',Math.abs(Y.compassErr(90,acc))>Math.abs(Y.compassErr(45,acc)));
eq('equator: no acceleration error',Y.compassErr(90,{man:'acc',lat:0,ktps:2}),0,1e-9);
{ const e=Y.compassErr(90,{man:'acc',lat:-60,ktps:2}); ok('southern hemisphere reverses: towards south '+e.toFixed(1),e>1); }
/* turning errors: UNOS (northern hemisphere), coordinated 15° bank */
const tr={man:'tr',lat:60,bank:15,kmax:0.9}, tl={man:'tl',lat:60,bank:15,kmax:0.9};
{ const e=Y.compassErr(0,tr); ok('right turn through north: compass lags (reads less than the heading) '+e.toFixed(1),e<-5); }
{ const e=Y.compassErr(0,tl); ok('left turn through north: lags (reads more) '+e.toFixed(1),e>5); }
{ const e=Y.compassErr(180,tr); ok('right turn through south: leads (reads more) '+e.toFixed(1),e>5); }
eq('turning through east: no error',Y.compassErr(90,tr),0,1e-9);
eq('turning through west: no error',Y.compassErr(270,tl),0,1e-9);
ok('turning error larger in the far north',Math.abs(Y.compassErr(0,{...tr,lat:70}))>Math.abs(Y.compassErr(0,{...tr,lat:50})));
eq('swing formula: small k ≈ k sin β (rad)',Y.swing(0.01,90)*Y.R,0.01,1e-4);
/* turns */
eq('rate one at 100 kt ≈ 15.4° bank',Y.rateOneBank(100),15.4,0.1);
eq('rule of thumb at 100 kt = 17°',Y.rateOneThumb(100),17,1e-9);
eq('turn rate round trip',Y.turnRate(140,Y.bankFor(140,3)),3,1e-9);
eq('rate one: 360° in 2 min',360/3/60,2,1e-9);
/* gyroscopes */
{ const H1=Y.angMom(1e-4,12000), H2=Y.angMom(1e-4,24000); eq('double the rpm → double the rigidity',H2/H1,2,1e-9); eq('… half the precession rate',Y.precRate(0.01,H2)/Y.precRate(0.01,H1),0.5,1e-9); }
eq('push at the top (0°), counter-clockwise spin → acts at 90° on',Y.effectAt(0,1),90,1e-9);
eq('clockwise spin → acts 90° the other way',Y.effectAt(0,-1),270,1e-9);
{ /* 3-D: spin axis +z (spin from x towards y), push at rim point +x along −z: the axis tilts towards +y (90° further round) */
  const n=Y.precess([0,0,1],[1,0,0],[0,0,-1],1,0.01); ok('3-D precession: axis tilts towards the point 90° on',n[1]>0.009&&Math.abs(n[0])<1e-9); }
/* directional gyro drift */
eq('earth rate at 60° N ≈ 13.0 °/h',Y.earthRate(60),13.03,0.01);
eq('earth rate at the pole ≈ 15.04 °/h',Y.earthRate(90),15.041,1e-6);
eq('earth rate at the equator = 0',Y.earthRate(0),0,1e-9);
eq('transport wander, 450 kt east at 60° N ≈ 13 °/h',Y.transportWander(450,60),12.99,0.01);
ok('northern hemisphere, parked: the reading decreases',Y.diDrift(60,0,null)<0);
eq('latitude nut set for 60° N cancels the earth rate there',Y.diDrift(60,0,60),0,1e-9);
ok('nut set for 60° N, flown at 70° N: still drifts',Math.abs(Y.diDrift(70,0,60))>0.5);
ok('flying west reduces the drift (transport wander against earth rate)',Math.abs(Y.diDrift(60,-300,null))<Math.abs(Y.diDrift(60,0,null)));
ok('southern hemisphere: the reading increases',Y.diDrift(-45,0,null)>0);
/* inertial */
eq('horizontal earth rate at 60° ≈ 7.5 °/h',Y.earthRateH(60),7.52,0.01);
eq('latitude from the two components',Y.latFromRates(Y.earthRate(52),Y.earthRateH(52)),52,1e-9);
eq('Schuler period ≈ 84.4 min',Y.schulerMin(),84.4,0.1);
ok('alignment longer at high latitude',Y.alignMin(70)>Y.alignMin(45)&&Y.alignMin(45)>Y.alignMin(0));
ok('alignment ≈ 9–10 min at mid latitudes',Y.alignMin(45)>9&&Y.alignMin(45)<11);
ok('no alignment beyond the limit',Y.alignMin(80)===Infinity);
eq('inertial error at one Schuler period = rate × time',Y.inertialErr(Y.schulerMin()/60,1.5),1.5*Y.schulerMin()/60,1e-9);

console.log(`gyros: ${pass} passed, ${fail} failed`); if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
