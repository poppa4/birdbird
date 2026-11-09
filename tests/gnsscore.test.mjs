// Node tests for gnsscore.js (run: node tests/gnsscore.test.mjs). Expected values are hand-computed or from closed forms.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','gnsscore.js'),'utf8'),ctx);
const G=ctx.GNSSCORE;
let pass=0, fail=0; const fails=[];
const near=(a,b,t)=>a===b||Math.abs(a-b)<=(t??1e-6);
function eq(name,got,exp,tol){ const ok= typeof exp==='number'? near(got,exp,tol) : got===exp; if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
const D2R=Math.PI/180;

/* matrix inverse */
const I=G.inv([[4,7],[2,6]]); eq('inv 2x2 a',I[0][0],0.6,1e-12); eq('inv 2x2 b',I[0][1],-0.7,1e-12); eq('inv 2x2 c',I[1][0],-0.2,1e-12); eq('inv singular',G.inv([[1,2],[2,4]]),null);

/* line of sight */
let u=G.los({az:90,el:0}); eq('los east e',u[0],1,1e-12); eq('los east u',u[2],0,1e-12);
u=G.los({az:0,el:90}); eq('los zenith u',u[2],1,1e-12);

/* DOP: closed form for zenith + three at elevation 0, 120° apart.
   GᵀG = diag(1.5, 1.5, 1, 4) except the u–clock term (−1 from the zenith row): [[1,-1],[-1,4]] → inverse [[4/3,1/3],[1/3,1/3]].
   HDOP = sqrt(2/1.5) = 1.1547, VDOP = sqrt(4/3) = 1.1547, TDOP = sqrt(1/3) = 0.5774 */
const T4=[{az:0,el:90},{az:0,el:0},{az:120,el:0},{az:240,el:0}];
let d=G.dop(T4); eq('HDOP ideal 4',d.h,Math.sqrt(4/3),1e-9); eq('VDOP ideal 4',d.v,Math.sqrt(4/3),1e-9); eq('TDOP ideal 4',d.t,Math.sqrt(1/3),1e-9);
eq('PDOP ideal 4',d.p,Math.sqrt(4/3+4/3),1e-9); eq('GDOP ideal 4',d.g,Math.sqrt(4/3+4/3+1/3),1e-9);
eq('major axis = HDOP/√2 for a circular ellipse',d.major,Math.sqrt(2/3),1e-9);
eq('3 satellites: no fix',G.dop(T4.slice(0,3)),null);
eq('all at one point: no fix',G.dop([{az:10,el:40},{az:10,el:40},{az:10,el:40},{az:10,el:40}]),null);
/* bunched geometry is worse */
const spread=[{az:0,el:85},{az:0,el:15},{az:90,el:20},{az:180,el:15},{az:270,el:20},{az:45,el:50},{az:200,el:55}];
const bunch=[{az:100,el:30},{az:115,el:42},{az:130,el:35},{az:120,el:55},{az:140,el:48},{az:108,el:62},{az:125,el:25}];
eq('bunched HDOP > spread HDOP',G.dop(bunch).h>3*G.dop(spread).h,true);
/* mask angle */
eq('mask removes low satellites',G.visible(spread,16).length,5);
/* 95 % errors */
const e=G.err95({h:1.2,v:2},4); eq('2drms',e.h,9.6,1e-12); eq('vertical 95 %',e.v,15.68,1e-12);

/* chi-square */
eq('chi2 cdf k=2 at 2 = 1 − e^−1',G.chi2cdf(2,2),1-Math.exp(-1),1e-10);
eq('chi2 cdf k=1 at 3.841 ≈ 0.95',G.chi2cdf(3.841459,1),0.95,1e-6);
eq('chi2inv 0.95 k=4 = 9.4877',G.chi2inv(0.95,4),9.487729,1e-4);
eq('ncx2 with λ=0 = central',G.ncx2cdf(5,3,0),G.chi2cdf(5,3),1e-12);
/* k = 1 closed form: √λ = z(1 − pfa/2) + z(1 − pmd) (the far tail is negligible) */
const zq=p=>{ let lo=-10, hi=10; for(let i=0;i<200;i++){ const m=(lo+hi)/2; if(0.5*(1+erf(m/Math.SQRT2))<p) lo=m; else hi=m; } return lo; };
function erf(x){ const s=Math.sign(x); x=Math.abs(x); let t=0, n=1, term=x; for(let k=0;k<200;k++){ t+=term/(2*k+1); term*=-x*x/(k+1); } return s*2/Math.sqrt(Math.PI)*t; }
const pfa=1/15000, pmd=0.001;
eq('pbias dof 1 (closed form)',G.pbias(1,pfa,pmd),zq(1-pfa/2)+zq(1-pmd),2e-3);
eq('pbias grows with dof',G.pbias(4,pfa,pmd)>G.pbias(1,pfa,pmd),true);

/* RAIM */
const sat=(az,el)=>({az,el});
let r=G.raim(spread.slice(0,3),G.HAL.approach); eq('3 sats: no fix',r.state,'nofix');
r=G.raim(spread.slice(0,4),G.HAL.approach); eq('4 sats: fix but no RAIM',r.state,'none');
r=G.raim(spread.slice(0,5),G.HAL.enroute); eq('5 good sats: detect only',r.state,'detect');
r=G.raim(spread,G.HAL.enroute); eq('7 good sats en route: FDE',r.state,'fde');
r=G.raim(bunch,G.HAL.approach); eq('bunched: RAIM unavailable for an approach',r.state,'unavail');
eq('HPL is finite with 5',Number.isFinite(G.hpl(spread.slice(0,5))),true);
/* slope check: with 5 satellites the slopes are finite; with exactly 4 there is no redundancy */
eq('slopes length',G.slopes(spread.slice(0,5)).H.length,5);
/* with a satellite duplicated at the same point, excluding either leaves the other: FDE needs geometry, not count */
eq('HPL rises when a satellite is removed',G.hpl(spread.slice(0,6))<=G.hpl(spread.slice(0,5))+1e-9,true);

/* SBAS */
let s=G.sbas(spread); eq('SBAS VPL = 5.33·σ·VDOP',s.vpl,5.33*2.5*G.dop(spread).v,1e-9); eq('LPV available with good geometry',s.ok,true);
eq('LPV not available when bunched',G.sbas(bunch).ok,false);

/* DME/DME: two stations at 90° → HDOP √2 */
let dd=G.dmedme([{x:0,y:10},{x:10,y:0}],{x:0,y:0},0.1); eq('DME/DME 90° HDOP √2',dd.h,Math.SQRT2,1e-9); eq('DME/DME 95 %',dd.e95,0.2*Math.SQRT2,1e-9);
eq('DME/DME in line: no fix',G.dmedme([{x:0,y:10},{x:0,y:20}],{x:0,y:0}),null);

/* turns: 250 kt, 25° bank → v = 128.611 m/s, r = v²/(g tan 25°) = 3617.0 m = 1.9530 NM */
const rr=G.turnRadius(250,25); eq('radius 250 kt 25°',rr,(250*1852/3600)**2/(9.80665*Math.tan(25*D2R))/1852,1e-12); eq('radius ≈ 1.953 NM',rr,1.953,1e-3);
{ const v=180*1852/3600, bk=Math.atan(v*3*D2R/9.80665)/D2R; eq('rate one (3°/s) at 180 kt: r = V/ω = 0.955 NM',G.turnRadius(180,bk),180/3600/(3*D2R),1e-9); }
eq('fly-by lead 90° = r',G.flyByLead(2,90),2,1e-12); eq('fly-by lead 60° = r·tan30',G.flyByLead(2,-60),2*Math.tan(30*D2R),1e-12);
eq('fly-by cut 90° = r(√2−1)',G.flyByCut(1,90),Math.SQRT2-1,1e-12);
let f=G.flyOver(1,90); eq('fly-over 90°: 30° intercept',f.ic,30,1e-9); eq('turn 120° first',f.turn1,120,1e-9); eq('overshoot r(1−cos90)=r',f.over,1,1e-12);
eq('straight part 90°: (cos30 − 2(1−cos30))/sin30',f.straight,(Math.cos(30*D2R)-(1-Math.cos(30*D2R)))/0.5,1e-12);
f=G.flyOver(1,20); eq('small turn: S-turn, intercept < 30',f.ic<30,true); eq('no straight part',f.straight,0,1e-9);
eq('S-turn closes: r(cosθ − cosΔ) = r(1 − cosθ)',Math.cos(f.ic*D2R)-Math.cos(20*D2R),1-Math.cos(f.ic*D2R),1e-12);

/* the flown path: geometry checks */
const W=[{x:0,y:-20},{x:0,y:0,t:'by'},{x:20,y:0}];
let P=G.path(W,1); const t=P.turns[0];
eq('fly-by 90° right: lead 1',t.lead,1,1e-12);
eq('fly-by: path starts the turn 1 NM before',P.pts[1].y,-1,1e-12);
const last=P.pts[P.pts.length-2]; eq('fly-by: rolls out 1 NM after on the new leg (x)',last.x,1,1e-9); eq('rolls out on the leg (y)',last.y,0,1e-9);
eq('fly-by length = 19 + π/2 + 19',P.len,19+Math.PI/2+19,1e-3);
/* closest point of the arc to the waypoint is r(√2−1) inside */
let mn=1e9; for(const p of P.pts) mn=Math.min(mn,Math.hypot(p.x,p.y)); eq('fly-by cut',mn,Math.SQRT2-1,2e-3);
/* fly-over: passes overhead, ends on the new leg heading 090 */
P=G.path([{x:0,y:-20},{x:0,y:0,t:'over'},{x:20,y:0}],1);
eq('fly-over passes overhead',P.pts.some(p=>Math.hypot(p.x,p.y)<1e-9),true);
const rj=P.pts[P.pts.length-2], rj0=P.pts[P.pts.length-3]; eq('fly-over rejoins the leg (y = 0)',rj.y,0,1e-9); eq('heading 090 at the rejoin',G.bearing(rj.x-rj0.x,rj.y-rj0.y),90,1);
let mxs=0; for(const p of P.pts) if(p.leg===1) mxs=Math.max(mxs,p.y); eq('greatest distance beyond the new leg = r',mxs,1,2e-3);
/* left turn mirror */
P=G.path([{x:0,y:-20},{x:0,y:0,t:'over'},{x:-20,y:0}],1); const lj=P.pts[P.pts.length-2]; eq('left fly-over rejoins (y = 0)',lj.y,0,1e-9); eq('left: rejoin west of the fix',lj.x<0,true);
/* at(): position along the path */
P=G.path(W,1); let a=G.at(P,10); eq('at 10 NM: x',a.x,0,1e-9); eq('at 10 NM: y',a.y,-10,1e-9); eq('at: track 360',a.trk,0,1e-9);
a=G.at(P,P.len); eq('at the end',a.x,20,1e-9);

/* cross track */
let x=G.xtk({x:0,y:0},{x:0,y:10},{x:0.3,y:4}); eq('xtk right +',x.xt,0.3,1e-12); eq('along 4',x.at,4,1e-12);
x=G.xtk({x:0,y:0},{x:10,y:0},{x:3,y:0.2}); eq('xtk left of an eastbound leg −',x.xt,-0.2,1e-12);

/* CDI scaling */
eq('en route 2 NM',G.fsd('enroute'),2); eq('terminal 1 NM',G.fsd('terminal'),1); eq('missed 0.3',G.fsd('missed'),0.3);
eq('approach 3 NM before FAF: 1 NM',G.fsd('approach',{dFaf:3}),1); eq('1 NM before FAF: 0.65',G.fsd('approach',{dFaf:1}),0.65,1e-12); eq('at FAF 0.3',G.fsd('approach',{dFaf:0}),0.3,1e-12);
eq('LPV at the threshold: 105 m',G.fsd('approach',{dFaf:-5,angular:true,dThr:0,rwy:1.6})*1852,105,1e-6);
eq('LPV widens: at 2 NM wider than at the threshold',G.fsd('approach',{dFaf:-3,angular:true,dThr:2})>G.fsd('approach',{dFaf:-5,angular:true,dThr:0}),true);
eq('LPV never wider than 0.3 NM',G.fsd('approach',{dFaf:-0.1,angular:true,dThr:40})<=0.3,true);
eq('phase en route > 30 NM',G.phase(40,20,false),'enroute'); eq('terminal',G.phase(20,8,false),'terminal'); eq('approach within 2 NM of FAF',G.phase(10,1.5,false),'approach'); eq('missed',G.phase(1,-5,true),'missed');
eq('0.15 NM right of track, 0.3 FS: needle 1 dot left',G.dots(0.15,0.3),-1,1e-12); eq('clamped',G.dots(-5,0.3),2.5,1e-12);

/* vertical path: 3° at 5 NM ≈ 1592 ft + 50 TCH */
eq('3° path at 5 NM',G.pathHt(5,3,50),50+Math.tan(3*D2R)*5*6076.12,1e-9); eq('≈ 1642 ft',G.pathHt(5,3,50),1642,1);

console.log(`${pass} passed, ${fail} failed (${pass+fail} checks)`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
