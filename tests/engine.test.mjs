// Node tests for enginecore.js (run: node tests/engine.test.mjs). Checks the physics trends and the typical numbers the lab quotes.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','enginecore.js'),'utf8'),ctx); const E=ctx.ENGC;
let pass=0, fail=0; const fails=[];
function eq(name,got,exp,tol){ const ok=Math.abs(got-exp)<=(tol??1e-6); if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }

/* ISA */
eq('ISA SL pressure',E.isa(0,0).p,1013.25,1e-9); eq('ISA 10 000 ft pressure',E.isa(10000,0).p,696.8,0.3);
eq('ISA 10 000 ft density ratio',E.isa(10000,0).sigma,0.7385,0.003); eq('ISA 36 089 ft −56.5 °C',E.isa(36089,0).Tc,-56.5,0.05);
ok('hot day lowers density',E.isa(0,30).sigma<0.92);
/* piston */
const pSL=E.piston({alt:0,dT:0,tas:0,thr:1,rpm:2700,mix:1});
eq('piston rated power at SL',pSL.hp,180,4); eq('piston full-throttle MAP ≈ 29 inHg',pSL.map,29,0.6);
ok('full rich at SL is rich of peak (λ 1.2–1.35)',pSL.lam>1.2&&pSL.lam<1.35);
eq('piston BSFC full rich ≈ 300 g/kWh',pSL.bsfc,300,25);
const p8=E.piston({alt:8000,dT:0,tas:110,thr:1,rpm:2500,mix:1});
ok('normally aspirated: power falls with altitude',p8.hp<0.75*pSL.hp);
ok('full rich at 8 000 ft is richer than at SL',p8.lam>pSL.lam);
const pk=E.peakMix({alt:8000,dT:0,tas:110,thr:1,rpm:2500}), pP=E.piston({alt:8000,dT:0,tas:110,thr:1,rpm:2500,mix:pk});
eq('peak EGT is at stoichiometric (λ ≈ 1)',pP.lam,1,0.06); ok('leaning to peak saves fuel',pP.ffkg<p8.ffkg*0.85);
const pT=E.piston({alt:12000,dT:0,tas:120,thr:1,rpm:2700,mix:E.bestMix(12000,0,120,true),turbo:true});
ok('turbo-normalised keeps ~sea-level MAP at 12 000 ft',pT.map>28.5);
const pi=E.piston({alt:3000,dT:0,tas:100,thr:0.8,rpm:2400,mix:1,ice:true}); const pn=E.piston({alt:3000,dT:0,tas:100,thr:0.8,rpm:2400,mix:1});
ok('carb ice drops MAP',pi.map<pn.map-2); const ph=E.piston({alt:3000,dT:0,tas:100,thr:0.8,rpm:2400,mix:1,heat:true}); ok('carb heat costs some power',ph.hp<pn.hp);
/* turboprop */
const cap0=E.tpCap(E.isa(0,0),E.ram(E.isa(0,0),0)); ok('turboprop: thermodynamic capacity > torque rating at SL ISA (flat rated)',cap0>E.TP.shp*1.1);
const capHot=E.tpCap(E.isa(0,30),E.ram(E.isa(0,30),0)); ok('turboprop: ISA+30 at SL is ITT-limited',capHot<E.TP.shp);
const capHi=E.tpCap(E.isa(20000,0),E.ram(E.isa(20000,0),0)); ok('turboprop: ITT-limited at 20 000 ft',capHi<E.TP.shp);
eq('ITT at the capacity is the limit',E.ittOf(cap0,E.ram(E.isa(0,0),0)),800,0.5);
const tI=E.tprop({alt:0,dT:0,tas:0,pl:0,np:2000,cond:'lo'}); eq('low idle Ng ≈ 52 %',tI.ng,52,1);
const tF=E.tprop({alt:0,dT:0,tas:0,pl:1,np:2000,cond:'lo'}); ok('full lever at SL ISA over-torques (pilot sets power by the gauges)',tF.over.tq);
const tq=E.tprop({alt:0,dT:0,tas:0,pl:0.86,np:2000,cond:'lo'}); ok('torque % = shp/rating × 2000/Np',Math.abs(tq.tq-tq.shp/850*100)<0.01);
ok('turboprop static thrust ~ 11–17 kN',tF.thrust>11000&&tF.thrust<18000);
ok('feathered: no thrust, Np 0',E.tprop({alt:5000,dT:0,tas:150,pl:0.3,np:0,cond:'lo'}).thrust<=0);
ok('reverse gives negative thrust',E.tprop({alt:0,dT:0,tas:60,pl:-0.3,np:2000,cond:'lo'}).thrust<0);
/* jets */
const f0=E.fan({alt:0,dT:0,tas:0,tl:1}); eq('fan rated thrust',f0.thrust/1000,120,0.5); eq('fan TO TSFC ≈ 0.36 lb/lbf/h',f0.tsfc,0.37,0.03);
ok('fan TO EGT below 950 °C limit at ISA',f0.egt<950);
const fH=E.fan({alt:0,dT:15,tas:0,tl:1}), fH2=E.fan({alt:0,dT:30,tas:0,tl:1}); eq('flat rated to ISA+15',fH.thrust/1000,120,0.5); ok('above the corner thrust falls',fH2.thrust<fH.thrust*0.93);
const fc=E.fan({alt:35000,dT:0,tas:450,tl:1}); ok('fan max thrust at FL350 M0.78 ~ 20–28 % of SL static',fc.thrust/120000>0.19&&fc.thrust/120000<0.28);
ok('fan cruise TSFC ~ 0.55–0.62',fc.tsfc>0.53&&fc.tsfc<0.63); ok('fan cruise overall efficiency ~ 0.3–0.37',fc.eta0>0.29&&fc.eta0<0.38);
ok('fan loses thrust with speed faster than a turbojet',E.lapseM(0.4,'fan')<E.lapseM(0.4,'jet'));
ok('turbojet TSFC higher than turbofan',E.tjet({alt:0,dT:0,tas:0,tl:1}).tsfc>2*f0.tsfc);
/* efficiency envelope */
const at25=E.isa(25000,0), M=v=>E.machOf(v,at25.T);
ok('propeller beats fan at 250 kt',E.propEta(250,M(250),75)>E.jetEta(250,'fan'));
ok('fan beats propeller at 480 kt',E.jetEta(480,'fan')>E.propEta(480,M(480),75));
ok('fan beats turbojet at cruise',E.jetEta(450,'fan')>E.jetEta(450,'jet'));
ok('prop thrust falls faster with speed than fan thrust',E.thrustVsSpeed('tp',150)<E.thrustVsSpeed('fan',150));
/* ratings */
const fx=E.flex(0,20,50); ok('FLEX 50 °C on a 20 °C day is allowed',fx.ok&&fx.used<1); ok('FLEX below the corner is not',!E.flex(0,20,25).ok); ok('FLEX reduction capped at 25 %',E.flex(0,10,70).red<=0.2501);
/* starts */
function run(type,fault,auto,fuelAt){ let s=E.startInit(15); s=E.startAct(s,'start',type); for(let i=0;i<900;i++){ if(fuelAt&&s.ph==='crank'&&!s.fuel&&s.ng>=fuelAt) s=E.startAct(s,'fuel',type); s=E.startStep(s,0.1,type,fault,auto); } return s; }
ok('fan normal auto start reaches idle 58 % N2',run('fan','none',true).ph==='run'&&Math.abs(run('fan','none',true).ng-58)<1);
ok('fan normal start peak EGT below the 725 °C start limit',run('fan','none',true).peak<725);
for(const f of ['hot','hung','wet']) ok('FADEC aborts a '+f+' start',run('fan',f,true).msg===f);
ok('turboprop normal manual start reaches idle',run('tp','none',false,13).ph==='run');
ok('turboprop hot start unprotected: exceeds 1000 °C',run('tp','hot',false,13).peak>1000);
ok('piston start runs',run('pist','none',false).ph==='run');

console.log(`${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
