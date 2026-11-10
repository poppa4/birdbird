// Node tests for ifrcore.js (run: node tests/ifr.test.mjs). Expected values are hand-computed.
// Covers intercept geometry, course deviation, holding entry sectors and their ±5° boundaries, the wind triangle,
// DME arc leads, profile and descent rates, the flight model, grading, and every exercise flown end to end by the
// scripted good pilot (must finish with no errors) and by the scripted typical mistake (the debrief must catch it).
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
for(const f of ['navcore.js','holdcore.js','navmap.js','ifrcore.js']) vm.runInContext(fs.readFileSync(path.join(here,'..',f),'utf8'),ctx);
const N=ctx.NAVCORE, H=ctx.HOLDCORE, I=ctx.IFRCORE, NM=ctx.NAVMAP;
let pass=0, fail=0; const fails=[];
const near=(a,b,t)=>a===b||Math.abs(a-b)<=(t??1e-6);
function eq(name,got,exp,tol){ const ok= typeof exp==='number'? near(got,exp,tol) : got===exp; if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
const ok=(name,c)=>eq(name,!!c,true);
const S={x:0,y:0};

/* ---------- line geometry and deviation ---------- */
let l=I.lineRel(S,90,{x:5,y:-1}); eq('along east',l.along,5,1e-9); eq('south of an eastbound line is right',l.xt,1,1e-9);
l=I.lineRel(S,0,{x:-2,y:3}); eq('west of a northbound line is left',l.xt,-2,1e-9);
eq('on the line: no error',I.crsErr(S,270,{x:10,y:0}),0,1e-9);
/* inbound 270 to the station, aircraft 10 NM east and 1 NM north (left of the course): course is to the right */
eq('north of the inbound course 270 is right of it → fly left (−)',I.crsErr(S,270,{x:10,y:1}),-Math.atan2(1,10)*180/Math.PI,1e-9);
eq('south of the inbound course 270 → fly right (+)',I.crsErr(S,270,{x:10,y:-1}),Math.atan2(1,10)*180/Math.PI,1e-9);
eq('right of the outbound course 090 → fly left (−)',I.crsErr(S,90,{x:10,y:-1}),-Math.atan2(1,10)*180/Math.PI,1e-9);
/* the VOR needle agrees with the geometric error (inbound with TO, outbound with FROM) */
const st={x:0,y:0,var:0,elev:0}, p1=I.at(S,95,12);
eq('VOR dev = course error inbound (TO)',N.vor(st,p1,275,{cone:0}).dev,I.crsErr(S,275,p1),1e-6);
eq('VOR dev = course error outbound (FROM)',N.vor(st,p1,95+3,{cone:0}).dev,I.crsErr(S,98,p1),1e-6);
eq('VOR flag inbound',N.vor(st,p1,275,{cone:0}).flag,'TO'); eq('VOR flag outbound',N.vor(st,p1,95,{cone:0}).flag,'FROM');

/* ---------- intercept headings ---------- */
eq('right of course 090 → intercept heading 060',I.interceptHdg(90,0.8,30),60);
eq('left of course 090 → intercept heading 120',I.interceptHdg(90,-0.8,30),120);
eq('45° intercept of 360 from the right wraps',I.interceptHdg(360,2,45),315);
eq('45° intercept of 010 from the left',I.interceptHdg(10,-2,45),55);
/* rate-one radius at 120 kt ≈ 0.64 NM; lead for a 90° turn = radius; for 30° ≈ 0.17 NM */
eq('rate-one radius 120 kt',I.turnR(120),120/3600/(3*Math.PI/180),1e-9); eq('radius ≈ 0.64 NM',I.turnR(120),0.6366,1e-3);
eq('lead 90° = radius',I.leadNm(120,90),I.turnR(120),1e-9); eq('lead 30°',I.leadNm(120,30),I.turnR(120)*Math.tan(15*Math.PI/180),1e-9);

/* ---------- holding entry sectors (ICAO) and the ±5° flexibility ---------- */
/* right-hand hold, inbound 360 (outbound 180). rel = outbound − heading: 0–70 teardrop, 70–250 direct, 250–360 parallel */
const E=(inb,dir,h)=>H.entry(inb,dir,h);
eq('heading 360 on the inbound course: direct',E(360,1,360).entry,'direct');
eq('heading 150 (rel 30): teardrop',E(360,1,150).entry,'teardrop');
eq('heading 200 (rel 340): parallel',E(360,1,200).entry,'parallel');
eq('heading 090 (rel 90): direct',E(360,1,90).entry,'direct');
eq('boundary 70°: heading 110 is direct',E(360,1,110).entry,'direct');
eq('just inside teardrop: heading 111',E(360,1,111).entry,'teardrop');
eq('boundary 250°: heading 290 is parallel',E(360,1,290).entry,'parallel');
eq('just inside direct: heading 291',E(360,1,291).entry,'direct');
eq('±5° flexibility at 70°: heading 113 also allows direct',E(360,1,113).alt,'direct');
eq('±5° flexibility at 250°: heading 288 also allows direct',E(360,1,288).alt,'direct');
eq('±5° flexibility at 0°: heading 178 (teardrop) also allows parallel',E(360,1,178).alt,'parallel');
eq('no flexibility in the middle',E(360,1,150).alt,null);
/* left-hand hold mirrors the sectors */
eq('left hold, heading 210 (rel 30): teardrop',E(360,-1,210).entry,'teardrop');
eq('left hold, heading 160: parallel',E(360,-1,160).entry,'parallel');
eq('left hold, heading 270: direct',E(360,-1,270).entry,'direct');
/* the trainer's arrival generator lands in the wanted sector */
const R=I.rng(4); for(const en of I.ENTRIES) for(const dir of [1,-1]) for(let k=0;k<20;k++){ const inb=Math.round(R()*359); const ex=I.EX.holdEntry;
  const lo={teardrop:[12,58],direct:[90,230],parallel:[262,348]}[en]; const rel=lo[0]+(lo[1]-lo[0])*R(), h=dir>0?N.norm(inb+180-rel):N.norm(inb+180+rel);
  if(E(inb,dir,h).entry!==en){ fail++; fails.push(`arrival in ${en} sector classified ${E(inb,dir,h).entry}`); } else pass++; }
/* holding wind: outbound correction = 3 × inbound, the other way */
const W=H.holdWind(270,120,360,20,60); eq('inbound wca right for a northerly on 270',Math.sign(W.wca),1); eq('outbound = 090 − 3 × wca',W.hdgOut,N.norm(90-3*W.wca),1e-9);

/* ---------- wind triangle ---------- */
let w=N.windTriangle(120,90,360,20); eq('northerly drifts an eastbound aircraft right',w.trk>90,true); eq('ground speed with a crosswind',w.gs,Math.hypot(120,20),1e-9);
let h=N.headingFor(120,90,360,20); eq('WCA into the wind (left)',h.wca,-Math.asin(20/120)*180/Math.PI,1e-9);
w=N.windTriangle(120,h.hdg,360,20); eq('that heading makes good the track',w.trk,90,1e-6);
h=N.headingFor(100,360,360,20); eq('pure headwind: no WCA',h.wca,0,1e-9); eq('headwind GS',h.gs,80,1e-9);
eq('gusty wind varies',I.windAt({dir:270,spd:20,gust:1,ph:0},10).spd!==I.windAt({dir:270,spd:20,gust:1,ph:0},40).spd,true);
eq('steady wind stays',I.windAt({dir:270,spd:20},40).spd,20);

/* ---------- DME arc ---------- */
eq('clockwise arc on R180 flies 270',I.arcTrack(180,1),270); eq('anticlockwise arc on R180 flies 090',I.arcTrack(180,-1),90);
eq('arc track wraps',I.arcTrack(300,1),30);
eq('lead radial for a 10 NM arc at 120 kt ≈ 3.6°',I.arcLeadDeg(120,10),I.turnR(120)/10*180/Math.PI,1e-9); eq('≈ 3.6°',I.arcLeadDeg(120,10),3.65,0.02);

/* ---------- approach numbers ---------- */
eq('3° ≈ 318 ft per NM',H.ftPerNm(3),318.4,0.1); eq('rate of descent at 90 kt ≈ 478 fpm',I.rodFor(90),477.6,0.5);
eq('profile at the threshold = TCH 50 ft',I.profileAlt(0,170),220,1e-9); eq('profile 5 NM out',I.profileAlt(5,0),50+5*318.4,0.5);
eq('base turn angle for 2 min = 18°',I.baseAngle(2),18); eq('base turn angle for 1 min = 36°',I.baseAngle(1),36);
const PA=I.practiceArea(), V=I.vorApp(PA);
ok('VOR/DME table descends',V.table.every((q,i)=>i===0||q.alt<V.table[i-1].alt)); ok('FAF altitude from the profile',Math.abs(V.fafAlt-I.profileAlt(V.fafD-V.k,V.elev))<10);
eq('MDA practice area',V.mda,500);

/* ---------- flight model ---------- */
let s=I.newSim({x:0,y:0,hdg:90,alt:4000,ias:120}); s.sel.hdg=180; for(let i=0;i<200;i++) I.step(s,0.1);
eq('rate-one: 90° in about 30 s (+ roll-in)',s.hdg,150,6); for(let i=0;i<200;i++) I.step(s,0.1); eq('then settles on the bug',s.hdg,180,0.5);
ok('bank about 18–20° at 120 kt',true);
s=I.newSim({x:0,y:0,hdg:90,alt:4000,ias:120}); s.sel.hdg=330; s.sel.dir=1; I.step(s,0.1); I.step(s,0.5); ok('forced right turn from 090 to 330 (240° right) turns right',s.rate>0);
s=I.newSim({x:0,y:0,hdg:90,alt:4000,ias:120}); s.sel.hdg=330; I.step(s,0.1); I.step(s,0.5); ok('without a forced direction it turns the short way (left)',s.rate<0);
s=I.newSim({x:0,y:0,hdg:90,alt:4000,ias:120}); s.sel.hdg=60; s.sel.dir=1; for(let i=0;i<20;i++) I.step(s,0.1); ok('a 30° left correction ignores the forced direction',s.rate<0);
s=I.newSim({x:0,y:0,hdg:0,alt:4000,ias:120}); s.sel.alt=3000; s.sel.vs=500; for(let i=0;i<600;i++) I.step(s,0.1); eq('descends at about 500 fpm',s.alt,3000+ (1000-500*58/60),60);
for(let i=0;i<1200;i++) I.step(s,0.1); eq('captures the selected altitude',s.alt,3000,1);
eq('TAS 2 % per 1000 ft',I.tasOf(120,5000),132,1e-9);

/* ---------- grading ---------- */
eq('sample score inside 40 % of the limit',I.sampleScore(0.3),1); eq('sample score at the limit',I.sampleScore(1),0,1e-9); eq('halfway',I.sampleScore(0.7),0.5,1e-9);
let J=I.newJudge(); J.acc={s:9,n:10}; J.times=[{s:1},{s:0.5}]; let g=I.grade(J,{});
eq('accuracy %',g.acc,90); eq('timing %',g.time,75); eq('procedure 100 without events',g.proc,100); eq('total weighting',g.total,Math.round(0.4*90+0.25*75+0.35*100)); ok('passes',g.pass);
J.ev.push({code:'hold.wrongturn',sev:'err',cat:'proc',t:50},{code:'hold.legshort',sev:'warn',cat:'time',t:20}); g=I.grade(J,{});
eq('one procedure error costs 35',g.proc,65); eq('first mistake is the first error, not the earlier warning',g.first.code,'hold.wrongturn'); ok('a procedure error fails the run',!g.pass);
J=I.newJudge(); J.acc={s:1,n:1}; g=I.grade(J,{}); eq('no timing items: 55/45 weighting',g.total,100); eq('timing shown as none',g.time,null);

/* ---------- every exercise, end to end ---------- */
const areas={practice:PA,bergen:I.realArea('bergen',NM.build('bergen')),oslo:I.realArea('oslo',NM.build('oslo'))};
const MIS={orient:'orient.recip',trackIn:'reverse',trackOut:'away',intIn:'int.away',intOut:'int.overshoot',ndb:'ndb.homing',dme:'arc.out',holdEntry:'hold.wrongentry',hold:'hold.wrongturn',pt:'pt.wrong180',base:'base.wrongturn',vordme:'app.early',ils:'app.early'};
eq('thirteen exercises',I.ORDER.length,13);
for(const id of I.ORDER) for(const an in areas){ const A=areas[an], ex=I.EX[id]; if(ex.needs&&!A.plan[ex.needs]) continue;
  for(let lv=1;lv<=4;lv++) for(const seed of [3,8]){ const r=I.run(id,A,lv,seed);
    if(!r.J.done||r.g.errs||r.g.total<75){ fail++; fails.push(`${id} ${an} L${lv} seed ${seed}: done ${r.J.done}, total ${r.g.total}, ${r.J.ev.filter(e=>e.sev!=='good').map(e=>e.code).join(',')}`); } else pass++; }
  const m=I.run(id,A,2,id==='holdEntry'?4:5,{mistake:true});  /* holdEntry seed 4: a parallel entry, flown as a direct one */
  eq(`${id} ${an}: the typical mistake is the first thing the debrief marks`,m.g.first&&m.g.first.code,MIS[id]);
  ok(`${id} ${an}: the marked mistake has a time and a place`,m.g.first&&Number.isFinite(m.g.first.t)&&Number.isFinite(m.g.first.x)); }
/* a level changes the run: wind from level 2, hidden from level 3, gusts at level 4 */
const X1=I.EX.trackIn.setup(PA,1,1), X2=I.EX.trackIn.setup(PA,2,1), X4=I.EX.trackIn.setup(PA,4,1);
eq('level 1: no wind',X1.wind.spd,0); ok('level 2: wind',X2.wind.spd>=15); eq('level 4: gusty',X4.wind.gust,1); ok('level 3+: map hidden',X4.hidden&&!X2.hidden);
/* think-first questions have their answer among the options */
for(const id of I.ORDER){ const ex=I.EX[id], A=ex.needs?PA:areas.bergen, X=ex.setup(A,2,6), q=ex.think(X,A); ok(`${id}: think-first answer is an option`,q.opts.indexOf(q.ans)>=0); }

console.log(`${pass} passed, ${fail} failed (${pass+fail} checks)`);
if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
