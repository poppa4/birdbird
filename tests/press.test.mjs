// Node tests for presscore.js (run: node tests/press.test.mjs). ISA values from ICAO Doc 7488; rules from EASA Air OPS.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','presscore.js'),'utf8'),ctx); const P=ctx.PRC;
let pass=0, fail=0; const fails=[];
function eq(name,got,exp,tol){ const ok=Math.abs(got-exp)<=(tol??1e-6); if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }

/* ISA */
eq('p(0) = 1013.25 hPa',P.pressAt(0),1013.25,1e-9);
eq('p(8 000 ft) = 752.6 hPa',P.pressAt(8000),752.6,0.2);
eq('p(10 000 ft) = 696.8 hPa',P.pressAt(10000),696.82,0.05);
eq('p(18 000 ft) ≈ half of sea level',P.pressAt(18000)/1013.25,0.5,0.005);
eq('p(39 000 ft) = 196.8 hPa',P.pressAt(39000),196.8,0.2);
eq('pressAlt inverts pressAt (FL410)',P.pressAlt(P.pressAt(41000)),41000,1e-6);
eq('sea level = 14.70 psi',P.psi(P.pressAt(0)),14.696,0.002);
/* differential pressure */
eq('cabin 8 000 ft at FL390: ΔP ≈ 8.06 psi',P.dP(8000,39000),8.06,0.03);
eq('cabinFor inverts dP',P.dP(P.cabinFor(37000,8.3),37000),8.3,1e-9);
{ const c=P.cabinFor(41000,P.CLS.jet.dpMax); ok('jet at its ceiling keeps the cabin at or below 8 000 ft ('+c.toFixed(0)+')',c<=8000&&c>7000); }
{ const c=P.cabinFor(30000,P.CLS.tp.dpMax); ok('turboprop at its ceiling: cabin 8 000–10 000 ft ('+c.toFixed(0)+')',c>8000&&c<10000); }
eq('same ΔP, same altitude: cabin = aircraft when ΔP = 0',P.cabinFor(12000,0),12000,1e-6);
/* the controller schedule */
{ const s=P.schedule({cls:'jet',H:37000,dep:0,dest:2000}); const mx=Math.max(...s.pts.map(p=>p.dp)), mn=Math.min(...s.pts.map(p=>p.dp));
  ok('jet schedule: ΔP never above the safety valve',mx<=P.CLS.jet.dpSafe+1e-9); ok('… and reaches max ΔP in cruise',Math.abs(mx-P.CLS.jet.dpMax)<0.01);
  ok('… never below the negative relief',mn>=P.CLS.jet.dpNeg-1e-9);
  const up=Math.max(...s.pts.filter(p=>p.ph==='climb').map(p=>p.vs)), dn=-Math.min(...s.pts.filter(p=>p.ph==='descent').map(p=>p.vs));
  ok('… cabin climb rate a few hundred ft/min ('+up.toFixed(0)+')',up>150&&up<700); ok('… cabin descent rate a few hundred ft/min ('+dn.toFixed(0)+')',dn>100&&dn<500);
  const td=s.pts.find(p=>p.ph==='ground'); ok('… slightly pressurised at touchdown',td.dp>0&&td.dp<0.15); }
{ const s=P.schedule({cls:'pist',H:9500,dep:0,dest:0}); ok('unpressurised: cabin = aircraft, ΔP 0',s.pts.every(p=>Math.abs(p.cab-p.h)<1e-6&&Math.abs(p.dp)<1e-9)); }
{ const s=P.schedule({cls:'jet',H:37000,dep:0,dest:5000,ldg:0}); const td=s.pts.find(p=>p.ph==='ground'); ok('LDG ELEV 5 000 ft too low: lands pressurised ('+td.dp.toFixed(2)+' psi)',td.dp>2); }
{ const s=P.schedule({cls:'jet',H:37000,dep:0,dest:0,ldg:6000}); ok('LDG ELEV too high: negative relief opens',s.pts.some(p=>p.relief==='neg')); }
/* flow and decompression */
{ const a=P.orifice(75000,20000,0.01), b=P.orifice(75000,30000,0.01); ok('choked flow: independent of the downstream pressure',Math.abs(a-b)<1e-9); ok('flow positive outwards',a>0); eq('orifice antisymmetric',P.orifice(20000,75000,0.01),-a,1e-12); }
ok('the packs hold a seal-sized leak (hold area > 10 cm²)',P.holdArea('jet',37000)>0.001);
{ const r=P.decompress({cls:'jet',H:37000,A:0.0005,react:15,packs:true}); ok('tiny leak: cabin held',r.kind==='held'); }
{ const r=P.decompress({cls:'jet',H:37000,A:0.2,react:15,packs:true}); ok('window-sized hole in a jet: rapid ('+r.teq?.toFixed(1)+' s)',r.kind==='rapid'); ok('… cabin warning within seconds',r.t10!==null&&r.t10<10); ok('… masks drop',r.t14!==null); ok('… air cools far below 0 °C (fog)',r.Tmin<-20); ok('… descent reaches 10 000 ft',r.tEnd!==null); }
{ const r=P.decompress({cls:'tp',H:25000,A:1.0,react:10,packs:true}); ok('door in a small cabin: explosive ('+r.teq?.toFixed(2)+' s)',r.kind==='explosive'); }
{ const r=P.decompress({cls:'jet',H:37000,A:0.015,react:60,packs:true,tmax:1200}); ok('small crack: slow ('+(r.teq??-1).toFixed(0)+' s)',r.kind==='slow'); }
ok('bigger hole, faster decompression',P.decompTau(330,0.05)>P.decompTau(330,0.5)); ok('smaller cabin, faster decompression',P.decompTau(30,0.2)<P.decompTau(330,0.2));
/* hypoxia */
{ const s=P.pao2(0); ok('sea level on air: PAO2 ≈ 100 mmHg ('+s.toFixed(0)+')',s>95&&s<108); ok('… saturation ≈ 97–98 %',P.sat(s)>96.5&&P.sat(s)<99); }
ok('21 % at every altitude: PIO2 falls only with pressure',Math.abs(P.pio2(30000,0.2095)/P.pio2(0,0.2095)-(P.pb(30000)-47)/(P.pb(0)-47))<1e-12);
{ const e=P.eqAir(P.pao2(33700,1)); ok('100 % O2 at ~34 000 ft ≈ air at sea level ('+e.toFixed(0)+')',Math.abs(e)<2000); }
{ const e=P.eqAir(P.pao2(40000,1)); ok('100 % O2 at 40 000 ft ≈ air at about 10 000 ft ('+e.toFixed(0)+')',e>8500&&e<13000); }
ok('saturation below 90 % above about 10–12 000 ft on air',P.sat(P.pao2(12000))<91&&P.sat(P.pao2(8000))>92);
eq('diluter: 21 % at sea level',P.diluter(0),0.2095,1e-3);
{ let h=0; while(P.diluter(h)<0.999) h+=100; ok('diluter reaches 100 % around 33–35 000 ft ('+h+')',h>32000&&h<36000); }
eq('TUC FL350 ≈ 45 s',P.tuc(35000),45,1); eq('TUC halved after rapid decompression',P.tuc(35000,true),22.5,0.5); ok('TUC not limiting low',P.tuc(9000)===null);
ok('TUC falls with altitude',P.tuc(25000)>P.tuc(30000)&&P.tuc(30000)>P.tuc(40000));
ok('stages',P.stage(8000)==='ind'&&P.stage(12000)==='comp'&&P.stage(17000)==='dist'&&P.stage(25000)==='crit');
/* EASA */
{ const r=P.o2Rule('catnp',11000,20); ok('CAT non-pressurised 11 000 ft: flight crew yes, passengers none in the first 30 min',r.crew&&r.pax===0); }
{ const r=P.o2Rule('catnp',11000,40); ok('… after 30 min: 10 % of passengers',r.pax===10); }
{ const r=P.o2Rule('catnp',13500,0); ok('… above 13 000 ft: all passengers',r.pax===100); }
{ const r=P.o2Rule('catp',14500,0); ok('CAT pressurised 14 500 ft: 30 % of passengers',r.pax===30&&r.crew); }
{ const r=P.o2Rule('catp',15500,0); ok('… above 15 000 ft: all passengers',r.pax===100); }
{ const r=P.o2Rule('catp',11000,10); ok('… 11 000 ft, first 30 min: nobody yet',!r.crew&&r.pax===0); }
{ const r=P.o2Rule('nco',12000,20), s=P.o2Rule('nco',12000,45), u=P.o2Rule('nco',13500,0); ok('NCO: 10–13 000 ft crew only after 30 min',!r.crew&&s.crew&&s.pax===0); ok('NCO: above 13 000 ft everyone',u.crew&&u.pax===100); }

console.log(`press: ${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
