// Node tests for navcore.js (run: node tests/navcore.test.mjs). Expected values are hand-computed.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','navcore.js'),'utf8'),ctx);
const N=ctx.NAVCORE;
let pass=0, fail=0; const fails=[];
const near=(a,b,t)=>a===b||Math.abs(a-b)<=(t??1e-6);
function eq(name,got,exp,tol){ const ok= typeof exp==='number'? near(got,exp,tol) : got===exp; if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
const S={x:0,y:0,var:0,elev:0};
const at=(brg,d)=>({x:Math.sin(brg*Math.PI/180)*d,y:Math.cos(brg*Math.PI/180)*d});

/* angles and wrap */
eq('norm -10',N.norm(-10),350); eq('norm 360',N.norm(360),0); eq('norm 725',N.norm(725),5); eq('norm -360',N.norm(-360),0);
eq('d3 0 → 360',N.d3(0),'360'); eq('d3 5',N.d3(5),'005'); eq('d3 359.6 → 360',N.d3(359.6),'360'); eq('d3 90',N.d3(90),'090');
eq('diff 10-350',N.diff(10,350),20); eq('diff 350-10',N.diff(350,10),-20); eq('diff 180',N.diff(180,0),180); eq('diff -180 → 180',N.diff(0,180),180);
eq('bearing east',N.bearing(1,0),90); eq('bearing south',N.bearing(0,-1),180); eq('bearing NW',N.bearing(-1,1),315); eq('bearing north',N.bearing(0,1),0);
eq('toMag 10 var 5E',N.toMag(10,5),5); eq('toMag 2 var 5E wraps',N.toMag(2,5),357); eq('toTrue 357 var 5E',N.toTrue(357,5),2); eq('toMag var 3W',N.toMag(100,-3),103);

/* radials and QDM */
eq('radial east',N.radial(S,{x:10,y:0}),90); eq('qdm east',N.qdm(S,{x:10,y:0}),270);
eq('radial south',N.radial(S,{x:0,y:-5}),180); eq('qdm south → 360 as 0',N.qdm(S,{x:0,y:-5}),0);
eq('radial with 5E variation',N.radial({x:0,y:0,var:5},{x:10,y:0}),85);
eq('radial just west of north wraps',N.radial(S,at(359.5,10)),359.5,1e-9);

/* VOR TO/FROM and deviation */
let v=N.vor(S,at(90,20),90); eq('on R090, OBS 090: FROM',v.flag,'FROM'); eq('on R090, OBS 090: centred',v.dev,0,1e-9);
v=N.vor(S,at(90,20),270); eq('on R090, OBS 270: TO',v.flag,'TO'); eq('OBS 270 centred',v.dev,0,1e-9);
v=N.vor(S,at(80,20),90); eq('R080, OBS 090 FROM: needle right 10°',v.dev,10,1e-9); eq('5 dots',v.dots,5,1e-9); eq('full scale',v.fs,true);
v=N.vor(S,at(95,20),90); eq('R095, OBS 090: needle left 5°',v.dev,-5,1e-9); eq('-2.5 dots',v.dots,-2.5,1e-9);
v=N.vor(S,at(280,20),90); eq('R280 (QDM 100), OBS 090 TO',v.flag,'TO'); eq('needle right 10',v.dev,10,1e-9);
v=N.vor(S,at(260,20),90); eq('R260, OBS 090 TO: needle left',v.dev,-10,1e-9);
v=N.vor(S,at(185,20),360); eq('R185 OBS 360 TO: QDM 005 needle right 5',v.dev,5,1e-9);
v=N.vor(S,at(175,20),360); eq('R175 OBS 360 TO: needle left 5 (wrap)',v.dev,-5,1e-9);
v=N.vor(S,at(0,20),180); eq('reciprocal: on R360 with OBS 180 → TO',v.flag,'TO'); eq('reciprocal centred',v.dev,0,1e-9);
v=N.vor(S,at(0,20),360); eq('on R360 OBS 360 → FROM',v.flag,'FROM');
v=N.vor(S,at(0,20),90); eq('abeam: R360, OBS 090 → OFF',v.flag,'OFF'); eq('abeam reason',v.why,'abeam');
v=N.vor(S,at(0,20),93); eq('3° past abeam → FROM? (QDM 180, OBS 093 → 87° → TO)',v.flag,'TO');
v=N.vor(S,at(0,20),88); eq('2° from abeam boundary → OFF',v.flag,'OFF');
v=N.vor(S,{x:0,y:0},90,{alt:5000}); eq('overhead → OFF',v.flag,'OFF'); eq('overhead reason cone',v.why,'cone');
v=N.vor(S,at(90,0.5),90,{alt:6000}); eq('0.5 NM at 6000 ft inside 45° cone → OFF',v.flag,'OFF');
v=N.vor(S,at(90,2),90,{alt:6000}); eq('2 NM at 6000 ft outside the cone → FROM',v.flag,'FROM');
v=N.vor(S,at(90,150),90,{alt:3000,los:true}); eq('150 NM at 3000 ft beyond LOS → OFF',v.flag,'OFF'); eq('range reason',v.why,'range');
eq('LOS 10000 ft ≈ 123 NM',N.losRange(10000,0),123,1e-9);

/* DME slant range */
let d=N.dme(S,at(0,0),6076.12); eq('overhead at 6076 ft → 1 NM slant',d.slant,1,1e-9);
d=N.dme(S,at(0,3),0); eq('on the ground 3 NM',d.slant,3,1e-9);
d=N.dme(S,at(0,4),18228.36); eq('4 NM ground at 3 NM height → 5 NM',d.slant,5,1e-9);
d=N.dme({x:0,y:0,elev:1000},at(0,0),7076.12); eq('station elevation counts',d.slant,1,1e-9);
eq('DME rate flying straight in at 120 kt',N.dmeRate(S,at(90,10),-120,0,0),120,1e-9);
eq('DME rate abeam ≈ 0',N.dmeRate(S,at(90,10),0,120,0),0,1e-9);

/* ADF / RMI */
eq('RB station ahead',N.adf(S,{x:0,y:-10},0),0,1e-9);
eq('RB station on the right',N.adf(S,{x:-10,y:0},0),90,1e-9);
eq('RB heading 090, station north',N.adf(S,{x:0,y:-10},90),270,1e-9);
eq('MB = MH + RB: 060 + 330 = 030',N.mbFrom(60,330),30); eq('MB 300 + 100 = 040',N.mbFrom(300,100),40);
eq('relBearing wrap',N.relBearing(10,350),20);
const h=N.hsi(350,10,{dev:-4,dots:-2,flag:'TO'}); eq('HSI course 20° right of lubber',h.crsRel,20);

/* wind triangle */
let w=N.windTriangle(100,360,90,20); eq('hdg 360, wind 090/20: track 348.69',w.trk,348.690,1e-3); eq('GS 101.98',w.gs,101.980,1e-3); eq('drift left 11.31',w.drift,-11.310,1e-3);
w=N.windTriangle(120,90,90,30); eq('pure headwind: GS 90',w.gs,90,1e-9); eq('no drift',w.drift,0,1e-9);
w=N.windTriangle(120,90,270,30); eq('pure tailwind: GS 150',w.gs,150,1e-9);
let hf=N.headingFor(100,360,90,20); eq('track 360 wind 090/20: hdg 011.54',hf.hdg,11.537,1e-3); eq('GS 97.98',hf.gs,97.980,1e-3); eq('WCA +11.54',hf.wca,11.537,1e-3);
hf=N.headingFor(120,180,250,30); eq('TAS120 wind 250/30 trk 180: hdg 193.6',hf.hdg,193.6,0.05); eq('GS 106.38 (120·cos13.59° − 30·cos70°)',hf.gs,106.38,0.01);
hf=N.headingFor(120,360,270,25); eq('trk 360 wind 270/25: hdg 348.0',hf.hdg,348.0,0.05);
hf=N.headingFor(100,0,90,120); eq('crosswind stronger than TAS → not possible',hf.ok,false);
hf=N.headingFor(60,0,0,70); eq('headwind > TAS → not possible',hf.ok,false);
const c=N.windComp(170,220,20); eq('crosswind 220/20 on 170: 15.32 from right',c.cross,15.321,1e-3); eq('headwind 12.86',c.head,12.856,1e-3);
/* round trip: heading from headingFor flies the track */
hf=N.headingFor(140,47,313,38); w=N.windTriangle(140,hf.hdg,313,38); eq('round trip track',w.trk,47,1e-9); eq('round trip GS',w.gs,hf.gs,1e-9);

/* timing and 1 in 60 */
eq('24 NM at 160 kt = 9 min',N.timeTo(24,160),9,1e-9); eq('0 GS → infinity',N.timeTo(5,0),Infinity);
eq('10° in 120 s → 12 min',N.tsBearing(120,10),12,1e-9); eq('1 in 60: 2 NM off after 30 NM → 4°',N.oneIn60(2,30),4,1e-9);

/* holding entries, right turns, inbound 360 (outbound 180) */
const E=(i,dr,hd)=>N.holdEntry(i,dr,hd).entry;
eq('R hold 360, hdg 360 → direct',E(360,1,360),'direct'); eq('hdg 090 → direct',E(360,1,90),'direct');
eq('hdg 150 → teardrop',E(360,1,150),'teardrop'); eq('hdg 180 → teardrop (boundary 0)',E(360,1,180),'teardrop');
eq('hdg 210 → parallel',E(360,1,210),'parallel'); eq('hdg 270 → parallel',E(360,1,270),'parallel');
eq('hdg 289 → parallel',E(360,1,289),'parallel'); eq('hdg 291 → direct',E(360,1,291),'direct');
eq('hdg 111 → teardrop',E(360,1,111),'teardrop'); eq('hdg 110 → direct (70° line)',E(360,1,110),'direct');
eq('rel at 110 is 70',N.holdEntry(360,1,110).rel,70); eq('near flag at 70° line',N.holdEntry(360,1,112).near,true);
/* left turns mirror */
eq('L hold 360, hdg 210 → teardrop',E(360,-1,210),'teardrop'); eq('L hold, hdg 150 → parallel',E(360,-1,150),'parallel'); eq('L hold hdg 270 → direct',E(360,-1,270),'direct');
/* other inbound course: inbound 090 right turns, heading 300 → outbound 270, rel = 270-300 = 330 → parallel */
eq('R hold 090, hdg 300 → parallel',E(90,1,300),'parallel'); eq('R hold 090, hdg 240 → teardrop',E(90,1,240),'teardrop');
eq('turn rate 120 kt = 3°/s',N.turnRate(120),3); eq('turn rate 250 kt ≈ 2.03°/s',N.turnRate(250),2.0350,1e-3);

/* ILS: localiser at the north end, inbound course 360, approach from the south */
const ILS={x:0,y:0,crs:360,gp:{x:0,y:-1.5},gpa:3,elev:0};
let l=N.loc(ILS,{x:0,y:-10}); eq('LOC centred',l.dev,0,1e-9); eq('front',l.back,false);
l=N.loc(ILS,at(185,10)); eq('5.0° west of centreline → needle right 5 (full scale)',l.dev,5,1e-9); eq('LOC dots clamp',l.dots,5,1e-9);
l=N.loc(ILS,at(179,10)); eq('1° east → needle left 1°',l.dev,-1,1e-9); eq('LOC dots -2',l.dots,-2,1e-9);
l=N.loc(ILS,at(5,10)); eq('back course: east of extended centreline',l.back,true); eq('back course needle left (reverse sensing for a southbound aircraft)',l.dev,-5,1e-9);
eq('LOC 4× VOR sensitivity: 1° = 2 dots vs 0.5 dot',N.loc(ILS,at(181,10)).dots/ N.vor(S,at(181,10),360).dots,4,1e-9);
let g=N.gs(ILS,{x:0,y:-1.5-3},3*6076.12*Math.tan(3*Math.PI/180)); eq('on the glide path',g.dev,0,1e-9); eq('GS centred',g.dots,0,1e-9);
g=N.gs(ILS,{x:0,y:-4.5},1000); eq('3 NM from GP antenna at 1000 ft: 3.14° → above',g.dev>0,true); eq('above → needle down',g.dots<0,true);
g=N.gs(ILS,{x:0,y:-4.5},600); eq('600 ft at 3 NM → below (1.89°)',g.angle,1.886,1e-3); eq('below full scale needle up 5',g.dots,5,1e-9);
eq('3° path height at 3 NM ≈ 955 ft',N.gs(ILS,{x:0,y:-4.5},0).pathFt,955.3,0.1);

/* projection */
const p=N.proj(61,6,60,6); eq('1° lat = 60 NM',p.y,60,1e-9); eq('lon unchanged → x 0',p.x,0,1e-9);
eq('1° lon at 60°N = 30 NM',N.proj(60,7,60,6).x,30,1e-9);

console.log(`${pass} passed, ${fail} failed (${pass+fail} checks)`);
if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
