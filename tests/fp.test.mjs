// Node tests for fpcore.js (run: node tests/fp.test.mjs). Classic climb/cruise results and the EASA fuel scheme numbers.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','fpcore.js'),'utf8'),ctx); const F=ctx.FPC;
let pass=0, fail=0; const fails=[];
function eq(name,got,exp,tol){ const ok=Math.abs(got-exp)<=(tol??1e-6); if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }
const {sep,tp,jet}=F.AC;

eq('ISA SL',F.isa(0).p,101325,1e-6); eq('ISA FL350 −54.3 °C',F.isa(35000).T-273.15,-54.3,0.1); eq('σ at 10 000 ft',F.isa(10000).sig,0.7385,0.002);
/* drag curve */
{ const m=60000, v=F.vmd(jet,m), D=x=>F.drag(jet,m,0,x); ok('minimum drag at Vmd (sea level, incompressible)',D(v)<D(v*0.9)&&D(v)<D(v*1.1)); eq('D at Vmd = W / (L/D)max',D(v),m*F.G/F.ldMax(jet),1); }
eq('Vmd ∝ √mass',F.vmd(jet,80000)/F.vmd(jet,20000),2,1e-9);
ok('typical light single best glide 65–80 kt ('+F.vmd(sep,1100).toFixed(0)+')',F.vmd(sep,1100)>65&&F.vmd(sep,1100)<80);
/* climb: Vx below Vy for every type; jets have the bigger gap */
for(const ac of [sep,tp,jet]){ const c=F.climbSpeeds(ac,ac.m,0); ok(ac.k+': Vx < Vy',c.vx.eas<c.vy.eas); ok(ac.k+': best gradient at Vx',c.vx.grad>=c.vy.grad); ok(ac.k+': best rate at Vy',c.vy.roc>=c.vx.roc); }
{ const s=F.climbSpeeds(sep,1100,0), j=F.climbSpeeds(jet,66000,0); ok('jet Vy/Vx ratio larger than piston',j.vy.eas/j.vx.eas>s.vy.eas/s.vx.eas); }
{ const a=F.climbSpeeds(sep,1100,0), b=F.climbSpeeds(sep,1100,10000); ok('piston: Vx and Vy converge with altitude',b.vy.eas-b.vx.eas<a.vy.eas-a.vx.eas); ok('climb rate falls with altitude',b.vy.roc<a.vy.roc); }
{ const c=F.ceilings(sep,1100); ok('service ceiling (100 ft/min) below absolute ceiling',c.svc<c.abs); ok('light single service ceiling 11 000–17 000 ft ('+c.svc+')',c.svc>11000&&c.svc<17000); }
/* cruise */
{ const c=F.cruise(sep,1100,4000,0); ok('prop: best range ≈ Vmd',Math.abs(c.range.eas/F.vmd(sep,1100)-1)<0.06); ok('prop: best endurance ≈ 0.76 Vmd',Math.abs(c.endur.eas/F.vmd(sep,1100)-0.76)<0.06); }
{ const c=F.cruise(jet,60000,10000,0); ok('jet (low, incompressible): best range ≈ 1.32 Vmd ('+(c.range.eas/F.vmd(jet,60000)).toFixed(2)+')',Math.abs(c.range.eas/F.vmd(jet,60000)-1.32)<0.08); ok('jet: best endurance ≈ Vmd',Math.abs(c.endur.eas/F.vmd(jet,60000)-1)<0.06); }
for(const ac of [sep,tp,jet]){ const s=F.cruise(ac,ac.m,8000,0), h=F.cruise(ac,ac.m,8000,-40), t=F.cruise(ac,ac.m,8000,40); ok(ac.k+': headwind → fly faster',h.range.tas>s.range.tas); ok(ac.k+': tailwind → fly slower (or same)',t.range.tas<=s.range.tas); ok(ac.k+': LRC faster than max range',s.lrc.tas>=s.range.tas); }
ok('jet: fuel per NM falls with altitude',F.per100(jet,66000,35000)<0.75*F.per100(jet,66000,10000));
ok('piston: fuel per NM nearly independent of altitude',Math.abs(F.per100(sep,1100,9000)/F.per100(sep,1100,1000)-1)<0.05);
{ const a=F.econ(jet,66000,35000,0,0), b=F.econ(jet,66000,35000,0,80); ok('higher cost index → faster',b.tas>a.tas); }
{ const h=F.optAlt(jet,74000).h, l=F.optAlt(jet,60000).h; ok('optimum altitude rises as mass falls ('+h+' → '+l+')',l>h); ok('optimum altitude in the 30s at 74 t',h>=30000&&h<=38000); }
/* fuel scheme */
const base={type:'jet',rules:'cat',dist:800,wind:0,alt:'one',altDist:100,cont:'5'};
{ const P=F.fuelPlan(base); eq('contingency 5 % of trip (above the 5 min floor)',P.cont,0.05*P.trip,1e-9); eq('jet FRF = 30 min holding',P.frf,jet.hold/2,1e-9);
  eq('block = sum of the parts',P.block,P.taxi+P.trip+P.cont+P.altn+P.frf+P.add+P.extra+P.disc,1e-6); eq('landing fuel = contingency + alternate + reserve',P.landing,P.cont+P.altn+P.frf+P.add+P.extra+P.disc,1e-6); }
{ const P=F.fuelPlan(Object.assign({},base,{dist:30})); eq('short trip: contingency floor = 5 min holding',P.cont,jet.hold*5/60,1e-9); }
{ const P=F.fuelPlan(Object.assign({},base,{cont:'3'})); eq('3 % with a fuel ERA',P.cont,Math.max(0.03*P.trip,jet.hold*5/60),1e-9); }
{ const P=F.fuelPlan(Object.assign({},base,{cont:'20'})); eq('20 min at trip consumption',P.cont,(P.trip/P.time)*20/60,1e-9); }
{ const P=F.fuelPlan(Object.assign({},base,{alt:'none'})); eq('no alternate: 15 min holding as additional fuel',P.add,jet.hold/4,1e-9); eq('no alternate fuel',P.altn,0,0); }
{ const P=F.fuelPlan(Object.assign({},base,{alt:'iso'})); eq('isolated (turbine): 2 h at cruise including FRF',P.add+P.frf,2*jet.ff,1e-6); }
{ const P=F.fuelPlan({type:'sep',rules:'cat',dist:150,alt:'one',altDist:40,cont:'5'}); eq('piston (CAT): FRF 45 min',P.frf,sep.hold*0.75,1e-9); }
{ const d=F.fuelPlan({type:'sep',rules:'nco',ncoFlt:'day',dist:150,alt:'none'}), n=F.fuelPlan({type:'sep',rules:'nco',ncoFlt:'night',dist:150,alt:'none'}); eq('NCO VFR day: 30 min',d.frf,sep.hold/2,1e-9); eq('NCO night/IFR: 45 min',n.frf,sep.hold*0.75,1e-9); }
{ const P=F.fuelPlan(Object.assign({},base,{wind:-60})), Q=F.fuelPlan(base); ok('headwind: more trip fuel',P.trip>Q.trip); }
/* critical point and PNR */
eq('ETP: still air at half way',F.etp(600,400,400),300,1e-9); ok('ETP moves into the wind (headwind outbound → beyond half way)',F.etp(600,350,450)>300);
eq('PNR: 4 h, 400/400 kt → 800 NM',F.pnr(4,400,400),800,1e-9); ok('wind always reduces the PNR distance',F.pnr(4,350,450)<800);

console.log(`fp: ${pass} passed, ${fail} failed`); if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
