// Node tests for afcore.js (run: node tests/afcore.test.mjs). TCAS values from the FAA "Introduction to TCAS II Version 7.1" (2011), table 3, or hand-computed.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','afcore.js'),'utf8'),ctx); const A=ctx.AFC;
let pass=0, fail=0; const fails=[];
function eq(name,got,exp,tol){ const ok=Math.abs(got-exp)<=(tol??1e-6); if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }

/* ---- TCAS sensitivity levels (v7.1 table) ---- */
ok('SL2 below 1000 ft, TA only',A.sens(800).sl===2&&A.sens(800).tauRA===null&&A.sens(800).tauTA===20);
ok('SL3 1000–2350 ft: 25/15 s, ALIM 300',A.sens(1500).sl===3&&A.sens(1500).tauTA===25&&A.sens(1500).tauRA===15&&A.sens(1500).alim===300);
ok('SL4 2350–5000 ft: 30/20 s',A.sens(3000).sl===4&&A.sens(3000).tauTA===30&&A.sens(3000).tauRA===20);
ok('SL5 5000–10 000 ft: 40/25 s, DMOD 0.75/0.55',A.sens(8000).sl===5&&A.sens(8000).tauTA===40&&A.sens(8000).tauRA===25&&A.sens(8000).dTA===0.75&&A.sens(8000).dRA===0.55);
ok('SL6 10 000–20 000 ft: 45/30 s, ALIM 400',A.sens(15000).sl===6&&A.sens(15000).tauTA===45&&A.sens(15000).tauRA===30&&A.sens(15000).alim===400);
ok('SL7 20 000–42 000 ft: 48/35 s, ZTHR RA 700, ALIM 600',A.sens(35000).sl===7&&A.sens(35000).tauTA===48&&A.sens(35000).tauRA===35&&A.sens(35000).zRA===700&&A.sens(35000).alim===600);
ok('above FL420: ZTHR 1200/800, ALIM 700',A.sens(43000).zTA===1200&&A.sens(43000).zRA===800&&A.sens(43000).alim===700);
ok('boundary 10 000 ft is SL6',A.sens(10000).sl===6);

/* ---- tau ---- */
eq('tau 5 NM at 420 kt = 42.86 s',A.tau(5,420),42.857,0.01);
eq('tau 3 NM at 600 kt = 18 s',A.tau(3,600),18,1e-9);
ok('tau infinite when opening',A.tau(3,-100)===Infinity);
eq('modified tau 3 NM, 420 kt, DMOD 0.8',A.tauMod(3,420,0.8),(9-0.64)/(3*420)*3600,1e-9);
ok('modified tau shorter than tau',A.tauMod(3,420,0.8)<A.tau(3,420));
ok('modified tau 0 inside DMOD',A.tauMod(0.5,200,0.8)===0);
eq('vertical tau 600 ft closing at 1200 fpm = 30 s',A.vTau(600,-1200),30,1e-9);
ok('vertical tau infinite when diverging',A.vTau(600,600)===Infinity);
/* doubling the closure rate doubles the alert range for the same tau */
eq('same tau at twice the range when closure doubles',A.tau(6,600),A.tau(3,300),1e-9);

/* ---- TA/RA tests ---- */
ok('TA test: inside tau and ZTHR',A.test(3,420,500,0,40,0.75,850,false));
ok('TA test fails outside ZTHR with no vertical closure',!A.test(3,420,1500,0,40,0.75,850,false));
ok('TA test passes on vertical tau',A.test(3,420,1500,-3000,40,0.75,850,false));
ok('slow intruder inside DMOD triggers on range',A.test(0.5,30,200,0,25,0.55,600,false));
ok('no-altitude (Mode A) intruder: range test only',A.test(3,420,5000,0,40,0.75,850,true));

/* ---- projection with 5 s delay and 0.25 g ---- */
eq('proj: level for 5 s',A.proj(0,1500,5,A.A25,5),0,1e-9);
eq('proj: ramp to 1500 fpm then hold',A.proj(0,1500,5,A.A25,30),(1500/2*(1500/A.A25)/60)+1500*(25-1500/A.A25)/60,1e-6);
eq('0.25 g ≈ 483 fpm per second',A.A25,482.6,0.2);

/* ---- encounters (FL120, SL6, 420 kt closure, collision course from 8 NM) ---- */
const base={alt:12000,r0:8,clo:420,vo:0,dt:0.25};
let E=A.encounter(Object.assign({},base,{dz0:-1000,vi:1000,eq:'tcas',resp:'ra'}));
eq('TA at modified tau 45 s (r ≈ 5.43 NM → t ≈ 22 s)',E.taT,22,0.3);
eq('RA at modified tau 30 s (r ≈ 3.67 NM → t ≈ 37 s)',E.raT,37.1,0.3);
eq('CPA at 68.6 s',E.tCPA,68.57,0.05);
ok('intruder below and climbing: CLIMB RA (non-crossing)',E.ra0.sense===1&&E.ra0.kind==='cd'&&!E.ra0.cross);
ok('coordinated: the intruder gets the complementary sense',E.ira&&E.ira.sense===-1);
ok('flown miss at least ALIM when both follow',Math.abs(E.missFlown)>=400);
eq('no-response miss = dz0 + (vi − vo)·t',E.missNone,-1000+1000*E.tCPA/60,1e-6);
const Eatc=A.encounter(Object.assign({},base,{dz0:-1000,vi:1000,eq:'tcas',resp:'atc'}));
ok('manoeuvring opposite to the RA makes the miss smaller than following it',Math.abs(Eatc.missFlown)<Math.abs(E.missFlown));
ok('manoeuvring opposite leads to a strengthened RA',Eatc.strT!=null&&Eatc.ra.kind==='inc');
const Ec=A.encounter(Object.assign({},base,{dz0:-1000,vi:1000,eq:'modec',resp:'ra'}));
ok('Mode C intruder: RA but no coordination',Ec.raT!=null&&Ec.ira===null);
const Ea=A.encounter(Object.assign({},base,{dz0:-1000,vi:1000,eq:'modea',resp:'ra'}));
ok('Mode A intruder (no altitude): TA only',Ea.taT!=null&&Ea.raT===null);
const Elow=A.encounter({alt:800,r0:4,clo:250,dz0:200,vi:0,vo:0,eq:'tcas',resp:'ra'});
ok('below 1000 ft: TA but no RA (SL2)',Elow.taT!=null&&Elow.raT===null);
const Epass=A.encounter({alt:6000,r0:8,clo:300,dz0:-800,vi:1500,vo:-1000,eq:'tcas',resp:'ra'});
ok('vertical paths cross long before CPA: no alert at all',Epass.taT===null&&Epass.raT===null);
const Eclear=A.encounter(Object.assign({},base,{dz0:2500,vi:0,eq:'tcas',resp:'ra'}));
ok('2 500 ft above and level: no TA',Eclear.taT===null);
ok('CLEAR OF CONFLICT after CPA',E.cocT!=null&&E.cocT>=E.tCPA);
/* RA choice */
let R=A.chooseRA({dz:300,vo:0,vi:0,tc:30,alim:400,agl:12000}); ok('intruder 300 ft above, level: DESCEND',R.sense===-1&&R.kind==='cd');
R=A.chooseRA({dz:300,vo:0,vi:0,tc:30,alim:400,agl:1000}); ok('descend inhibited below 1100 ft: CLIMB',R.sense===1);
R=A.chooseRA({dz:-700,vo:0,vi:0,tc:30,alim:400,agl:12000}); ok('700 ft below, level, ALIM 400: preventive MONITOR VERTICAL SPEED',R.kind==='mon'&&R.sense===1);
R=A.chooseRA({dz:-300,vo:-1500,vi:0,tc:30,alim:400,agl:12000}); ok('descending onto a level intruder below: LEVEL OFF or CLIMB',R.sense===1&&(R.kind==='lvl'||R.kind==='cd'));
ok('RA texts',A.raText({sense:1,kind:'cd',cross:false})==='CLIMB, CLIMB'&&A.raText({sense:-1,kind:'inc'})==='INCREASE DESCENT, INCREASE DESCENT'&&A.raText({sense:1,kind:'lvl'})==='LEVEL OFF, LEVEL OFF');

/* ---- EGPWS envelopes ---- */
ok('mode 1: 2000 fpm at 1500 ft is fine',A.m1(1500,2000)===null);
ok('mode 1: 4000 fpm at 1000 ft: SINK RATE',A.m1(1000,3000)==='SINK RATE');
ok('mode 1: 5000 fpm at 1000 ft: PULL UP',A.m1(1000,5000)==='PULL UP');
ok('mode 1 inactive above 2450 ft',A.m1(3000,9000)===null);
ok('mode 2: closure 5000 fpm at 600 ft gives an alert',A.m2(600,5000,false,250)!==null);
ok('mode 2B (landing flaps): TERRAIN only',A.m2(400,6000,true,150)==='TERRAIN, TERRAIN');
ok("mode 3: losing 150 ft at 600 ft after take-off: DON'T SINK",A.m3(600,150,750)==="DON'T SINK");
ok('mode 4A: 400 ft, 160 kt, gear up: TOO LOW, GEAR',A.m4(400,160,false,false)==='TOO LOW, GEAR');
ok('mode 4A: 800 ft, 250 kt, gear up: TOO LOW, TERRAIN',A.m4(800,250,false,false)==='TOO LOW, TERRAIN');
ok('mode 4B: 200 ft, 140 kt, gear down, flaps up: TOO LOW, FLAPS',A.m4(200,140,true,false)==='TOO LOW, FLAPS');
ok('mode 4 silent in landing configuration',A.m4(100,140,true,true)===null);
ok('mode 5: 1.5 dots low at 700 ft: GLIDESLOPE',A.m5(700,1.5,true)==='GLIDESLOPE');
ok('mode 5 needs the gear down',A.m5(700,1.5,false)===null);
ok('mode 6: 40° at 500 ft: BANK ANGLE',A.m6bank(500,40)!==null&&A.m6bank(500,30)===null);
ok('mode 6: 15° at 20 ft is already too much',A.m6bank(20,15)!==null);
ok('callout FIVE HUNDRED when passing 500 ft',A.callout(520,490)==='FIVE HUNDRED'&&A.callout(490,480)===null);
/* look-ahead: level at 3000 ft, 240 kt (4 NM/min), 3000 ft ridge 3 NM ahead → 45 s → caution */
const ridge=x=>x>=3?3000:0;
eq('look-ahead hits the floor 45 s out',A.lookAhead(0,3000,0,240,ridge,300),45,0.5);
ok('45 s → caution',A.laLevel(45)==='CAUTION TERRAIN'&&A.laLevel(20)==='TERRAIN AHEAD, PULL UP'&&A.laLevel(null)===null);
ok('nothing ahead within 60 s over flat ground',A.lookAhead(0,1000,0,240,()=>0,300)===null);
ok('terrain display colours',A.tadBand(2500)==='red'&&A.tadBand(1500)==='yel2'&&A.tadBand(0)==='yel1'&&A.tadBand(-700)==='grn2'&&A.tadBand(-300,true)==='grn2'&&A.tadBand(-1500)==='grn1'&&A.tadBand(-3000)==='none');

/* ---- autopilot logic ---- */
let S=A.apMake({ac:'jet',alt:5000,vm:'VS',selVs:-800,selAlt:6000,x:-60,y:0,hdg:90,selHdg:90,ias:250,selSpd:250});
ok('ALT not armed when the selected altitude is behind you',!A.altArmed(S));
A.apRun(S,60); ok('…so the descent goes on through it',S.vm==='VS'&&S.alt<4500);
S=A.apMake({ac:'jet',alt:5000,vm:'VS',selVs:-800,selAlt:3000,x:-60,y:0,hdg:90,selHdg:90,ias:250,selSpd:250});
ok('ALT armed when the selected altitude is ahead',A.altArmed(S));
A.apRun(S,240); ok('…and it levels at the selected altitude',S.vm==='ALT'&&Math.abs(S.alt-3000)<30);
S=A.apMake({ac:'jet',alt:4000,vm:'VS',selVs:1500,selAlt:5000,x:-60,y:0,hdg:90,selHdg:90,ias:250,selSpd:250});
for(let i=0;i<600&&S.vm!=='CAP';i++) A.apStep(S,0.1); ok('ALT* during the level-off',S.vm==='CAP');
A.setSel(S,'alt',4500); ok('new altitude during ALT* reverts to V/S',S.vm==='VS'&&S.msg==='altstar');
A.apRun(S,60); ok('…and with the new altitude behind, it climbs through the old one',S.alt>5000);
S=A.apMake({ac:'jet',alt:5000,vm:'VS',selVs:3000,selAlt:15000,x:-80,y:0,hdg:90,selHdg:90,ias:250,selSpd:250});
A.apRun(S,150); ok('jet V/S beyond climb thrust: speed decays to the protection',S.prot&&S.ias<=152);
S=A.apMake({ac:'ga',alt:3000,vm:'VS',selVs:1200,selAlt:8000,pwr:1,x:-60,y:0,hdg:90,selHdg:90,ias:100});
A.apRun(S,300); ok('GA V/S beyond the engine: stalls (the autopilot does not watch the speed)',S.stall);
S=A.apMake({ac:'ga',alt:3000,vm:'VS',selVs:500,selAlt:5000,pwr:1,x:-60,y:0,hdg:90,selHdg:90,ias:90});
A.apRun(S,400); ok('GA V/S 500 at full power levels at the selected altitude',S.vm==='ALT'&&Math.abs(S.alt-5000)<30&&!S.stall);
S=A.apMake({ac:'jet',vm:'VS',selVs:-700}); A.press(S,'APR'); A.apRun(S,600);
ok('jet approach: LOC then G/S captured, flown to minimums',S.ev.some(e=>e.txt==='LOC')&&S.ev.some(e=>e.txt==='G/S')&&S.landed&&Math.abs(S.y)<0.05);
S=A.apMake({ac:'jet',vm:'ALT',hold:3000,alt:3000}); A.press(S,'LOC'); A.apRun(S,300);
ok('LOC only: localiser captured, glide slope never, still level at 3000',S.lm==='TRK'&&S.vm==='ALT'&&Math.abs(S.alt-3000)<30&&S.x>-6);
S=A.apMake({ac:'jet',vm:'ALT',hold:3000,alt:3000,ias:250,selSpd:250,x:-80,y:0,hdg:90,selHdg:90,lever:'mid'});
A.apRun(S,120); ok('lever below the climb detent: SPEED cannot hold the speed',S.ias<240);
S=A.apMake({ac:'jet',vm:'ALT',hold:3000,alt:3000,ias:200,selSpd:200,x:-80,y:0,hdg:90,selHdg:90,lever:'toga',vmax:230});
ok('lever in TOGA: manual thrust shown',A.fma(S).thr==='MAN TOGA'&&A.fma(S).athr==='arm');
A.apRun(S,60); ok('…and the speed runs past the flap limit',S.overspd);
S=A.apMake({ac:'jet',vm:'ALT',hold:5000,alt:5000,selAlt:9000,ias:250,selSpd:250,x:-80,y:0,hdg:90,selHdg:90}); A.press(S,'LVL');
ok('level change up: THR CLB',A.fma(S).thr==='THR CLB'&&A.fma(S).vert==='LVL CHG'&&A.fma(S).vArm.includes('ALT'));
A.apRun(S,30); ok('…the elevator holds the speed',Math.abs(S.ias-250)<5&&S.vs>500);

console.log(`afcore: ${pass} passed, ${fail} failed`); if(fail){ console.log(fails.join('\n')); process.exit(1); }
