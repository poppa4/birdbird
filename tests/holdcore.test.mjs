// Node tests for holdcore.js (run: node tests/holdcore.test.mjs). Expected values are hand-computed.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['navcore.js','holdcore.js']) vm.runInContext(fs.readFileSync(path.join(here,'..',f),'utf8'),ctx);
const H=ctx.HOLDCORE, N=ctx.NAVCORE;
let pass=0, fail=0; const fails=[];
const near=(a,b,t)=>a===b||Math.abs(a-b)<=(t??1e-6);
function eq(name,got,exp,tol){ const ok= typeof exp==='number'? near(got,exp,tol) : got===exp; if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }

/* timing and speeds (PANS-OPS) */
eq('1 min at 14 000 ft',H.legSec(14000),60); eq('1.5 min at 14 100 ft',H.legSec(14100),90); eq('1 min at 5000 ft',H.legSec(5000),60);
eq('230 kt up to 14 000 ft',H.holdSpeed(14000).kt,230); eq('170 kt Cat A/B only',H.holdSpeed(8000,{catAB:true}).kt,170);
eq('240 kt FL140–200',H.holdSpeed(18000).kt,240); eq('265 kt FL200–340',H.holdSpeed(30000).kt,265); eq('M0.83 above FL340',H.holdSpeed(36000).mach,0.83);
eq('turbulence 280 kt low',H.holdSpeed(10000,{turb:true}).kt,280); eq('turbulence FL300: 280 kt',H.holdSpeed(30000,{turb:true}).kt,280); eq('… or M0.8',H.holdSpeed(30000,{turb:true}).mach,0.8);

/* entry sectors, right turns, inbound 360 (outbound 180): direct 290→110, offset 110→180, parallel 180→290 */
const E=(i,d,h)=>H.entry(i,d,h);
eq('hdg 360 → direct',E(360,1,360).entry,'direct'); eq('hdg 150 → teardrop',E(360,1,150).entry,'teardrop'); eq('hdg 230 → parallel',E(360,1,230).entry,'parallel');
eq('hdg 110 on the 70° line: direct',E(360,1,110).entry,'direct'); eq('… teardrop also allowed (5°)',E(360,1,110).alt,'teardrop');
eq('hdg 114: teardrop, direct allowed',E(360,1,114).alt,'direct'); eq('hdg 120: no flexibility',E(360,1,120).alt,null);
eq('hdg 290 boundary: parallel or direct',E(360,1,288).alt,'direct'); eq('hdg 183: parallel, teardrop also allowed',E(360,1,183).entry,'parallel'); eq('… alt teardrop',E(360,1,183).alt,'teardrop');
eq('hdg 186: parallel, no choice',E(360,1,186).alt,null);
eq('left hold mirrors: hdg 210 → teardrop',E(360,-1,210).entry,'teardrop'); eq('left hold hdg 150 → parallel',E(360,-1,150).entry,'parallel');
eq('entryFrom: arriving from the south (bearing 180) → heading 360 → direct',H.entryFrom(360,1,180).entry,'direct');
/* a worked example used on the page: inbound 174, right, heading 300 → outbound 354, rel 54 → teardrop */
eq('174 R, hdg 300 → teardrop',E(174,1,300).entry,'teardrop'); eq('rel 54',E(174,1,300).rel,54);
eq('090 L, hdg 180 → parallel',E(90,-1,180).entry,'parallel');

/* wind correction: inbound 360, TAS 120, wind 090/20 → WCA +9.59°, outbound heading 180 − 28.8 = 151.2 */
let w=H.holdWind(360,120,90,20,60); eq('inbound WCA asin(20/120)',w.wca,Math.asin(20/120)*180/Math.PI,1e-9); eq('inbound heading 009.6',w.hdgIn,9.594,1e-3);
eq('outbound heading = outbound − 3 × WCA',w.hdgOut,180-3*9.594,1e-3);
w=H.holdWind(360,120,0,0,60); eq('still air: outbound 60 s',w.tOut,60,1e-9); eq('still air: outbound heading 180',w.hdgOut,180,1e-9);
/* headwind inbound 20 kt, TAS 120: GS in 100, out 140, turns 60 s each → (100·60 − 20·60 − 20·60)/140 = 25.7 s */
w=H.holdWind(360,120,0,20,60); eq('headwind inbound: outbound shorter (25.7 s)',w.tOut,3600/140,1e-6); eq('rule of thumb 1 s/kt: 40 s',w.tRule,40,1e-9);
/* tailwind inbound 20 kt: GS in 140, out 100; clock starts abeam: (140·60 + 0 + 20·60)/100 = 96 s */
w=H.holdWind(360,120,180,20,60); eq('tailwind inbound: outbound longer (96 s)',w.tOut,96,1e-6); eq('rule of thumb: 80 s',w.tRule,80,1e-9);
eq('1.5-min leg rule: 1.5 s per kt',H.holdWind(360,120,180,20,90).tRule,120,1e-9);
eq('racetrack radius at 120 kt (rate one)',H.racetrack(120,60).R,120/3600/(3*Math.PI/180),1e-9); eq('leg 2 NM at 120 kt',H.racetrack(120,60).leg,2,1e-9);

/* flown holds: the entry flown, back at the fix, inbound legs about 1 min */
const fly=(i,d,h,wd,ws,tas)=>H.flyHold({fix:{x:0,y:0},inb:i,dir:d,tas:tas||140,wdir:wd||0,wspd:ws||0,legS:60,arrive:{hdg:h,dist:3},laps:2});
for(const [h,en] of [[360,'direct'],[150,'teardrop'],[230,'parallel']]){ const r=fly(360,1,h);
  eq(`still air hdg ${h}: entry`,r.entry,en); eq(`still air hdg ${h}: finishes`,H.PH[r.ph[r.n-1]],'done');
  eq(`still air hdg ${h}: inbound ≈ 60 s`,r.legIn[r.legIn.length-1],60,3); }
for(const [wd] of [[270],[90],[0],[180]]){ const r=fly(360,1,360,wd,30); eq(`wind ${wd}/30: inbound leg about 1 min (±10 s)`,r.legIn[r.legIn.length-1],60,10); }
/* the pattern stays on the holding side: right hold inbound 360 → the outbound leg lies east (x > 0) */
{ const r=fly(360,1,360); let mx=-1e9, mn=1e9; for(let i=0;i<r.n;i++){ if(H.PH[r.ph[i]]==='outbound'){ mx=Math.max(mx,r.x[i]); mn=Math.min(mn,r.x[i]); } } eq('outbound leg on the holding side (east)',mn>0.5,true); }
{ const r=fly(360,-1,360); let mx=-1e9; for(let i=0;i<r.n;i++) if(H.PH[r.ph[i]]==='outbound') mx=Math.max(mx,r.x[i]); eq('left hold: outbound leg west',mx<-0.5,true); }
/* parallel entry: the outbound entry leg is on the non-holding side (west for a right hold) */
{ const r=fly(360,1,230); let mx=-1e9; for(let i=0;i<r.n;i++) if(H.PH[r.ph[i]]==='e_out'&&r.t[i]>30) mx=Math.max(mx,r.x[i]); eq('parallel: entry leg on the non-holding side',mx<0.3,true); }
/* offset entry: 30° towards the holding side → east */
{ const r=fly(360,1,150); let mx=-1e9; for(let i=0;i<r.n;i++) if(H.PH[r.ph[i]]==='e_out') mx=Math.max(mx,r.x[i]); eq('offset: entry leg ends on the holding side',mx>0.5,true); }

/* from a start point (missed approach): the entry is decided by the heading at the fix, not at the start */
{ const r=H.flyHold({fix:{x:0,y:0},inb:354,dir:-1,tas:140,wdir:0,wspd:0,legS:60,start:{x:0,y:-3,hdg:174},turnDir:1,laps:1});
  eq('missed approach back to the fix from the south: direct entry',r.entry,'direct'); let mx=1e9; for(let i=0;i<r.n;i++) if(H.PH[r.ph[i]]==='outbound') mx=Math.min(mx,r.x[i]); eq('left hold inbound 354: outbound leg west',mx<-0.5,true); }

/* approach: 3° path, rate of descent and climb */
eq('3°: 318 ft per NM',H.ftPerNm(3),318.4,0.1); eq('ROD at 140 kt: 743 ft/min',H.rod(140,3),743,0.5); eq('×5 rule at 140 kt: 700',H.rodRule(140),700);
eq('ROD at 120 kt ≈ 637',H.rod(120),636.8,0.5); eq('ROD scales with GS: 2× GS → 2× ROD',H.rod(160)/H.rod(80),2,1e-9);
eq('2.5 % = 152 ft per NM',H.climbFtNm(2.5),151.9,0.1); eq('2.5 % at 140 kt ≈ 354 ft/min',H.climbFpm(140,2.5),354.5,0.5);
eq('path altitude at 5 NM, elev 170 (GP 0.16 NM)',H.pathAlt(5,170),170+Math.tan(3*Math.PI/180)*5.16*6076.12,1e-6);
eq('pathDist inverse',H.pathDist(H.pathAlt(5.6,170),170),5.6,1e-9);
eq('path agrees with NAVCORE.gs',H.pathAlt(1.5,0,3,1.5),N.gs({x:0,y:0,crs:360,gp:{x:0,y:-1.5},gpa:3,elev:0},{x:0,y:-4.5},0).pathFt,1e-6);
/* classification (ICAO Annex 6) */
eq('ILS DH 200: 3D',H.classify(200,true).dim,'3D'); eq('ILS DH 200: Type B',H.classify(200,true).type,'B');
eq('LNAV MDH 400: 2D',H.classify(400,false).dim,'2D'); eq('MDH 400: Type A',H.classify(400,false).type,'A');
eq('LNAV/VNAV DH 250: Type A',H.classify(250,true).type,'A'); eq('DH 249: Type B',H.classify(249,true).type,'B');
eq('DH 200 → CAT I',H.ilsCat(200),'CAT I'); eq('DH 100 → CAT II',H.ilsCat(100),'CAT II'); eq('DH 50 → CAT III',H.ilsCat(50),'CAT III');
eq('DDA = MDA + add-on',H.dda(650,50),700); eq('DDA without add-on',H.dda(650),650);

console.log(`${pass} passed, ${fail} failed (${pass+fail} checks)`);
if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
