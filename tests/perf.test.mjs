// Node tests for perfcore.js (run: node tests/perf.test.mjs). Regulatory numbers (CS-25, Part-CAT) and physical trends.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','perfcore.js'),'utf8'),ctx); const P=ctx.PFC;
let pass=0, fail=0; const fails=[];
function eq(name,got,exp,tol){ const ok=Math.abs(got-exp)<=(tol??1e-6); if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }

/* atmosphere and wind factoring */
eq('ISA at 0 ft',P.isaT(0),15,1e-9); eq('ISA at 5 000 ft',P.isaT(5000),5.1,1e-9);
eq('σ at SL ISA = 1',P.atm(0,15).sig,1,0.002); ok('hot and high: lower density',P.atm(5000,35).sig<0.8);
eq('50 % of a 20 kt headwind',P.windF(20),10,1e-9); eq('150 % of a 10 kt tailwind',P.windF(-10),-15,1e-9);
/* flat rating */
ok('jet: thrust flat up to ISA+15',Math.abs(P.flatCurve(P.TYPES.jet,0,30)-P.flatCurve(P.TYPES.jet,0,0))<1e-9);
ok('jet: thrust falls above the flat-rating temperature',P.flatCurve(P.TYPES.jet,0,40)<P.flatCurve(P.TYPES.jet,0,30)-0.05);
ok('piston: power falls with temperature (no flat rating)',P.lapse(P.TYPES.sep,P.atm(0,30))<P.lapse(P.TYPES.sep,P.atm(0,0)));
ok('prop thrust falls with speed faster than jet thrust',(()=>{ const a=P.atm(0,15), t=P.TYPES.tp, j=P.TYPES.jet; return P.thrust(t,a,75,2)/P.thrust(t,a,0,2)<P.thrust(j,a,75,2)/P.thrust(j,a,0,2); })());
/* speeds (CS-25.107) */
{ const a=P.atm(0,15); for(const m of [55000,70000,78000]){ const s=P.speeds(P.TYPES.jet,m,1,a);
  ok(`jet ${m}: V2 ≥ 1.13 VSR`,s.v2>=1.13*s.vsr-1e-9); ok(`jet ${m}: V2 ≥ 1.10 VMCA`,s.v2>=1.10*s.vmca-1e-9); ok(`jet ${m}: VR ≥ 1.05 VMCA`,s.vr>=1.05*s.vmca-1e-9); ok(`jet ${m}: VR < V2`,s.vr<s.v2); } }
{ const s=P.speeds(P.TYPES.sep,1100,1,P.atm(0,15)); eq('Class B: V at 50 ft = 1.2 VS',s.v2/s.vsr,1.2,1e-9); }
ok('heavier: higher stall speed',P.vs(P.TYPES.jet,78000,2.25)>P.vs(P.TYPES.jet,60000,2.25));
eq('stall speed ∝ √mass',P.vs(P.TYPES.jet,80000,2)/P.vs(P.TYPES.jet,20000,2),2,1e-9);
/* take-off: the V1 trade-off */
const base={type:'jet',m:70000,flap:1,pa:0,oat:15}, rw={tora:2500};
{ const T=P.takeoff(base,rw), a=T.arr, lo=a[0], hi=a[a.length-1];
  ok('higher V1: longer accelerate-stop',hi.stop>lo.stop); ok('higher V1: shorter accelerate-go',hi.go<lo.go);
  ok('balanced V1 lies between VMCG and VR',T.bal.v1>=T.sp.vmcg-1&&T.bal.v1<=T.sp.vr);
  ok('jet 70 t, 2 500 m, SL ISA: legal with a V1 window',T.ok&&!!T.win);
  ok('the V1 window respects VMCG ≤ V1 ≤ VR',T.win[0]>=T.sp.vmcg-1e-9&&T.win[1]<=T.sp.vr+1e-9);
  ok('AEO distance ×1.15 is checked',Math.abs(T.aeoReq-1.15*T.aeo.dist)<1e-6);
  ok('typical balanced field 1 700–2 100 m ('+Math.round(T.bal.go)+')',T.bal.go>1700&&T.bal.go<2100); }
{ const h=P.takeoff(Object.assign({},base,{oat:35,pa:3000}),rw), c=P.takeoff(base,rw); ok('hot and high: longer take-off',h.aeo.dist>c.aeo.dist*1.2); }
{ const w=P.takeoff(Object.assign({},base,{wind:20}),rw), t=P.takeoff(Object.assign({},base,{wind:-10}),rw), c=P.takeoff(base,rw);
  ok('headwind shortens, tailwind lengthens',w.aeo.dist<c.aeo.dist&&t.aeo.dist>c.aeo.dist); ok('10 kt tail costs more than 20 kt head gains',t.aeo.dist-c.aeo.dist>c.aeo.dist-w.aeo.dist); }
{ const u=P.takeoff(Object.assign({},base,{slope:1}),rw), c=P.takeoff(base,rw); ok('uphill: longer',u.aeo.dist>c.aeo.dist); }
{ const h=P.takeoff(Object.assign({},base,{m:78000}),rw), c=P.takeoff(base,rw); ok('heavier: longer (≈ m²)',h.aeo.dist/c.aeo.dist>1.2); }
{ const f1=P.takeoff(Object.assign({},base,{flap:0}),rw), f3=P.takeoff(Object.assign({},base,{flap:2}),rw); ok('more flap: shorter field',f3.aeo.dist<f1.aeo.dist);
  ok('more flap: poorer climb',P.grad2(Object.assign({},base,{flap:2}))<P.grad2(Object.assign({},base,{flap:0}))); }
{ const w=P.takeoff(Object.assign({},base,{surf:'wet'}),rw), d=P.takeoff(base,rw); ok('wet: longer accelerate-stop at the same V1',P.atV1(w,120).stop>P.atV1(d,120).stop); }
{ const c=P.takeoff({tora:2000,cwy:300,swy:100}&&base,{tora:2000,cwy:1500,swy:100}); eq('clearway credit capped at half the TORA',c.toda,3000,1e-9); eq('ASDA = TORA + stopway',c.asda,2100,1e-9); }
/* climb gradients */
{ const g=P.grads(base); ok('2nd segment > 2.4 % at 70 t ISA',g.s2>0.024); ok('first segment below second (gear drag)',g.s1<g.s2); eq('twin net margin 0.8 %',g.net,0.008,1e-12); }
ok('hot day: poorer second segment',P.grad2(Object.assign({},base,{oat:40}))<P.grad2(base));
eq('obstacle 150 ft at 3 000 m needs 1.52 % net',P.obsNeed(150,3000)*100,1.524,0.001);
/* mass limits and flex */
{ const L=P.limits(base,rw,{h:0}); ok('governing limit is the lowest',Object.values(L.L).every(v=>v>=L.max-1e-9)); }
{ const L=P.limits(Object.assign({},base,{oat:40,pa:4000}),rw,{h:0}), c=P.limits(base,rw,{h:0}); ok('hot and high lowers the max mass',L.max<c.max-3000); }
{ const f=P.assumed(Object.assign({},base,{m:62000}),{tora:3000}); ok('light jet, long runway: an assumed temperature exists',!!f&&f.t>30); ok('reduction capped at 25 %',f.red<=0.25+1e-9); }
ok('no assumed temperature on a contaminated runway',P.assumed(Object.assign({},base,{surf:'cont',m:60000}),{tora:3000})===null);
/* Class B */
{ const f=P.classBTOF({surf:'grass',slope:2}); eq('Class B: 1.25 × 1.2 grass × 1.10 slope',f.total,1.25*1.2*1.1,1e-9); }
{ const T=P.takeoff({type:'sep',m:1100,flap:1,pa:0,oat:15},{tora:800}); ok('light single to 50 ft: 350–600 m ('+Math.round(T.aeo.dist)+')',T.aeo.dist>350&&T.aeo.dist<600); }
/* landing */
{ const L=P.landReq({type:'jet',m:64000,pa:0,oat:15,surf:'dry'}); eq('jet dry: ÷ 0.6',L.req/L.cert.ld,1/0.6,1e-9); eq('VREF = 1.23 VSR0',L.cert.vref/L.cert.vsr0,1.23,1e-9); }
{ const L=P.landReq({type:'tp',m:21000,pa:0,oat:15,surf:'dry'}); eq('turboprop dry: ÷ 0.7',L.req/L.cert.ld,1/0.7,1e-9); }
{ const d=P.landReq({type:'jet',m:64000,surf:'dry'}), w=P.landReq({type:'jet',m:64000,surf:'wet'}); eq('wet: +15 %',w.req/d.req,1.15,1e-9); }
{ const c=P.landReq({type:'jet',m:64000,surf:'cont'}), w=P.landReq({type:'jet',m:64000,surf:'wet'}); ok('contaminated: at least the wet requirement',c.req>=w.req-1e-9); }
{ const L=P.landReq({type:'sep',m:1100,surf:'grass'}); eq('Class B grass: ÷0.7 × 1.15',L.req/L.cert.ld,1.15/0.7,1e-9); eq('Class B VREF 1.3 VS0',L.cert.vref/L.cert.vsr0,1.3,1e-9); }
{ const d=P.landing({type:'jet',m:64000,surf:'dry'}), h=P.landing({type:'jet',m:64000,wind:-10}); ok('tailwind landing: longer',h.ld>d.ld); }
{ const a=P.landing({type:'jet',m:60000}), b=P.landing({type:'jet',m:66000}); ok('heavier landing: longer',b.ld>a.ld); }
{ const c=P.landClimb({type:'jet',m:64000}); ok('landing climb above 3.2 %',c.landing>0.032); ok('approach climb (OEI) above 2.1 %',c.approach>0.021); }
{ const t=P.landTA({type:'jet',m:64000,surf:'wet',rev:true}); eq('time of arrival check: +15 %',t.req/t.ld,1.15,1e-9); }

console.log(`perf: ${pass} passed, ${fail} failed`); if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
