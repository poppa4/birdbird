// Node tests for gennavcore.js (run: node tests/gennav.test.mjs). Expected values are hand-computed or independent checks.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
function load(withNavcore){ const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
  if(withNavcore) vm.runInContext(fs.readFileSync(path.join(here,'..','navcore.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(here,'..','gennavcore.js'),'utf8'),ctx); return ctx.GNAV; }
let pass=0, fail=0; const fails=[];
const near=(a,b,t)=>a===b||Math.abs(a-b)<=(t??1e-6);
function eq(name,got,exp,tol){ const ok= typeof exp==='number'? near(got,exp,tol) : got===exp; if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
const D2R=Math.PI/180;

for(const nc of [true,false]){ const G=load(nc), tag=nc?' [navcore]':' [own]';
  /* true / magnetic / compass: variation east, magnetic least */
  eq('T 030 var 6E → M 024'+tag,G.toMag(30,6),24); eq('T 030 var 6W → M 036'+tag,G.toMag(30,-6),36);
  eq('T 002 var 5E → M 357'+tag,G.toMag(2,5),357); eq('M 357 var 5E → T 002'+tag,G.toTrue(357,5),2);
  eq('M 100 dev 2E → C 098'+tag,G.toCompass(100,2),98); eq('C 098 dev 2E → M 100'+tag,G.fromCompass(98,2),100);
  /* wind triangle: heading for a track */
  let h=G.headingFor(100,360,90,20); eq('trk 360 W/V 090/20 TAS 100: hdg 011.54'+tag,h.hdg,11.537,1e-3); eq('GS 97.98'+tag,h.gs,97.980,1e-3);
  eq('WCA +11.54 (nose right)'+tag,h.wca,11.537,1e-3); eq('drift −11.54 (left)'+tag,h.drift,-11.537,1e-3); eq('cross 20 from right'+tag,h.cross,20,1e-9);
  h=G.headingFor(300,90,360,30); eq('TAS 300 trk 090 W/V 360/30: hdg 084.3'+tag,h.hdg,84.26,0.01); eq('GS 298.5'+tag,h.gs,298.496,1e-3);
  h=G.headingFor(120,270,330,25); eq('TAS 120 trk 270 W/V 330/25: hdg 280.4'+tag,h.hdg,280.39,0.01); eq('GS 105.5'+tag,h.gs,105.53,0.01);
  h=G.headingFor(100,0,90,120); eq('crosswind > TAS → impossible'+tag,h.ok,false);
  /* track from a heading, and round trip */
  let t=G.trackFrom(100,360,90,20); eq('hdg 360 W/V 090/20: trk 348.69'+tag,t.trk,348.690,1e-3); eq('GS 101.98'+tag,t.gs,101.980,1e-3); eq('drift −11.31'+tag,t.drift,-11.310,1e-3);
  t=G.trackFrom(120,90,270,30); eq('pure tailwind GS 150'+tag,t.gs,150,1e-9); eq('no drift'+tag,t.drift,0,1e-9);
  for(const [tas,trk,wd,ws] of [[450,60,310,110],[140,47,313,38],[95,200,20,40],[480,355,10,140]]){
    h=G.headingFor(tas,trk,wd,ws); t=G.trackFrom(tas,h.hdg,wd,ws); eq(`round trip trk ${trk}`+tag,G.diff(t.trk,trk),0,1e-9); eq(`round trip GS ${trk}`+tag,t.gs,h.gs,1e-9); }
  /* law of cosines check: GS² = TAS² + W² − 2·TAS·W·cos(angle between heading and wind-from) */
  h=G.headingFor(450,60,310,110); eq('GS by law of cosines'+tag,h.gs,Math.sqrt(450**2+110**2-2*450*110*Math.cos((310-h.hdg)*D2R)),1e-9);
}
const G=load(true);
eq('quick WCA 20 kt / 120 kt = 10°',G.wcaQuick(20,120),10,1e-12);
/* leg */
eq('180 NM at 150 kt = 72 min',G.legTime(180,150),72,1e-12); eq('72 min at 40 kg/h = 48 kg',G.legFuel(72,40),48,1e-12); eq('GS 0 → no time',G.legTime(10,0),Infinity);
/* 1 in 60 */
let o=G.offTrack(5,50,100); eq('TE 6° (5 off after 50)',o.te60,6,1e-12); eq('CA 3° (5 off, 100 to go)',o.ca60,3,1e-12); eq('turn 9°',o.turn60,9,1e-12);
eq('exact TE atan(5/50)=5.711°',o.te,5.7106,1e-4); eq('exact CA atan(5/100)=2.862°',o.ca,2.8624,1e-4);
o=G.offTrack(-4,40,80); eq('4 left after 40: TE −6°',o.te60,-6,1e-12); eq('turn −9° (right)',o.turn60,-9,1e-12);
let a=G.offAfter(3,120); eq('3° over 120 NM: 6 NM by rule',a.rule,6,1e-12); eq('exact 6.28 NM',a.exact,120*Math.sin(3*D2R),1e-12);
eq('rule within 5 % of exact up to 20°',[5,10,15,20].every(d=>Math.abs(G.offAfter(d,60).rule/G.offAfter(d,60).exact-1)<0.05),true);
/* sphere */
eq('1° of a meridian = 60 NM',G.gcDist(0,0,1,0),60,1e-9); eq('equator 90° = 5400 NM',G.gcDist(0,0,0,90),5400,1e-9);
eq('track north',G.gcTrack(10,10,20,10),0,1e-9); eq('track along equator east',G.gcTrack(0,0,0,30),90,1e-9);
eq('track 0,0 → 0,−30 is west',G.gcTrack(0,0,0,-30),270,1e-9);
/* ENGM → ENTC (60.19N 11.10E → 69.68N 18.92E) */
let R=G.route(60.19,11.10,69.68,18.92);
eq('ENGM–ENTC GC ≈ 602 NM (√(569² + 198²))',R.gc,602,2); eq('rhumb longer than GC',R.rl>R.gc,true);
eq('GC track change = exact convergency',R.change,R.conv,1e-9);
eq('convergency approx dlong·sin(mean lat)',R.convApprox,7.82*Math.sin(64.935*D2R),1e-9);
eq('approx within 0.2° of exact here',Math.abs(R.conv-R.convApprox)<0.2,true);
eq('conversion angle ≈ angle GC↔RL at A (within 0.3°)',Math.abs(R.caA-R.conversion)<0.3,true);
eq('rhumb track between GC initial and final',G.diff(R.rlTrk,R.ini)>0&&G.diff(R.fin,R.rlTrk)>0,true);
/* long route: exact convergency still equals the GC track change (Oslo–New York) */
R=G.route(60.19,11.10,40.64,-73.78); eq('ENGM–KJFK track change = exact convergency',R.change,R.conv,1e-9);
eq('ENGM–KJFK GC ≈ 3200 NM',R.gc,3200,40); eq('westbound N hemisphere: GC track decreases',R.change<0,true);
/* along a parallel: rhumb = departure */
eq('rhumb along 60N for 10° = 300 NM',G.rhumb(60,0,60,10).dist,300,1e-9); eq('departure 10° at 60N = 300 NM',G.departure(10,60),300,1e-9);
eq('rhumb along a parallel is 090',G.rhumb(60,0,60,10).trk,90,1e-9);
/* GC points stay on the circle: every point's distance sum equals the total */
let P=G.gcPoints(60.19,11.10,40.64,-73.78,50); let s=0; for(let i=1;i<P.length;i++) s+=G.gcDist(P[i-1][0],P[i-1][1],P[i][0],P[i][1]);
eq('sum of GC segments = GC distance',s,G.gcDist(60.19,11.10,40.64,-73.78),1e-6);
P=G.rhumbPoints(60.19,11.10,40.64,-73.78,40); eq('rhumb points: constant track',G.rhumb(P[10][0],P[10][1],P[11][0],P[11][1]).trk,G.rhumb(60.19,11.10,40.64,-73.78).trk,1e-6);
/* projections */
let M=G.projection('merc',{lon0:0}); eq('Mercator scale at 60° = 2',M.k(60),2,1e-12); eq('Mercator chart convergency 0',M.chartConv(20),0);
let PS=G.projection('polar',{lon0:0}); eq('polar stereo scale 1 at the pole',PS.k(90),1,1e-12); eq('polar chart convergency = dlong',PS.chartConv(20),20);
let LC=G.projection('lcc',{lon0:0,s1:60,s2:60}); eq('tangent Lambert: n = sin(parallel of origin)',LC.n,Math.sin(60*D2R),1e-9); eq('scale 1 on the parallel',LC.k(60),1,1e-9);
LC=G.projection('lcc',{lon0:0,s1:62,s2:68}); eq('secant Lambert: scale 1 on both standard parallels',LC.k(62),1,1e-9); eq('…and at s2',LC.k(68),1,1e-9);
eq('scale < 1 between the parallels',LC.k(65)<1,true); eq('n between sin 62 and sin 68',LC.n>Math.sin(62*D2R)&&LC.n<Math.sin(68*D2R),true);
/* PET and PNR */
let p=G.pet(600,400,500,450); eq('PET 600·500/900 = 333.3 NM',p.dist,333.333,1e-3); eq('from PET home = on (equal time)',p.dist/500,(600-p.dist)/400,1e-12);
p=G.pet(400,180,220,200); eq('PET 220 NM',p.dist,220,1e-9);
let n=G.pnr(4,400,500); eq('PNR time 4·500/900 h = 133.3 min',n.t,133.333,1e-3); eq('PNR dist 888.9 NM',n.dist,888.889,1e-3);
eq('PNR: out + back time = endurance',n.dist/400+n.dist/500,4,1e-12);
eq('still air PNR = half endurance × TAS',G.pnr(4,450,450).dist,900,1e-9);
eq('any wind brings the PNR closer',G.pnr(4,500,400).dist<900&&G.pnr(4,400,500).dist<900,true);
/* Mach and time */
eq('ISA at FL370 = −56.5',G.isaTemp(37000),-56.5); eq('ISA at 0 = 15',G.isaTemp(0),15); eq('a at 15 °C = 661.5 kt',G.speedOfSound(15),661.47,0.05);
eq('M0.78 at −56.5 °C ≈ 447 kt',G.machToTas(0.78,-56.5),447.4,0.3);
eq('10° E = 40 min',G.arcToTime(10),40); eq('1200 UTC at 10°E = 1240 LMT',G.lmtFromUtc(12,10),12+40/60,1e-12);

console.log(`gennav: ${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
