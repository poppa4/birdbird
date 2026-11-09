// Node tests for hfcore.js (run: node tests/hf.test.mjs). Teaching models: the tests check the behaviour each lab teaches.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ctx={}; ctx.globalThis=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here,'..','hfcore.js'),'utf8'),ctx); const H=ctx.HFC;
let pass=0, fail=0; const fails=[];
function eq(name,got,exp,tol){ const ok=Math.abs(got-exp)<=(tol??1e-6); if(ok) pass++; else { fail++; fails.push(`${name}: got ${got}, expected ${exp}`); } }
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }
const mn=(a,k)=>Math.min(...a.map(r=>r[k])), mx=(a,k)=>Math.max(...a.map(r=>r[k]));

/* the canal: a constant rotation fades */
{ let c=H.canalStep(0,10,0); for(let t=0;t<20;t+=0.05) c=H.canalStep(c,0,0.05); ok('canal signal of a steady 10 °/s turn has faded after 20 s ('+c.toFixed(2)+')',c<0.5); }
eq('below the threshold nothing is felt',H.felt(1.9),0); eq('above it the rotation is felt',H.felt(5),5);
/* the leans */
{ const s=H.simulate('leans',{rate:1,bank:20}); const roll=s.rows.filter(r=>r.t<=s.tIn);
  eq('a 1 °/s roll to 20° is not felt',mx(roll,'felt'),0,0.01);
  eq('the aircraft did bank 20°',roll.at(-1).real,20,0.2);
  const after=s.rows.filter(r=>r.t>s.tFix+3&&r.t<s.tFix+6);
  ok('after rolling level briskly you feel banked the other way ('+mn(after,'felt').toFixed(1)+'°)',mn(after,'felt')<-8&&Math.abs(after[0].real)<0.5);
  ok('the false sensation fades slowly',s.rows.at(-1).felt>mn(after,'felt')); }
{ const s=H.simulate('leans',{rate:5,bank:20}); ok('a 5 °/s roll is felt',mx(s.rows.filter(r=>r.t<=s.tIn+1),'felt')>8); }
/* the graveyard spiral */
{ const a=H.simulate('spiral',{by:'inst'}), b=H.simulate('spiral',{by:'feel'});
  const tr=a.rows.filter(r=>r.t>a.rollIn+20&&r.t<a.tOut);
  ok('in a long steady turn the turn is no longer felt',Math.abs(tr.at(-1).turnFelt)<0.01&&tr.at(-1).turn>3);
  ok('rolling out you feel a turn the other way',mn(a.rows.filter(r=>r.t>a.tOut),'felt')<-5);
  ok('flying by instruments holds height',Math.abs(a.rows.at(-1).alt-4000)<50);
  ok('flying by feel: back into the bank and down ('+b.rows.at(-1).alt.toFixed(0)+' ft)',b.rows.at(-1).alt<3500&&b.rows.at(-1).real>20); }
/* somatogravic */
eq('0.2 g forward feels like 11.3° nose-up',H.somaAngle(0.2),11.31,0.02);
eq('1 g forward would feel like 45°',H.somaAngle(1),45,1e-9);
{ const a=H.simulate('soma',{by:'inst',acc:0.3}), b=H.simulate('soma',{by:'feel',acc:0.3});
  ok('instruments: holds 15° pitch and climbs',Math.abs(a.rows.at(-1).real-15)<0.5&&a.rows.at(-1).h>2000);
  ok('felt pitch is higher than the real pitch while accelerating',a.rows[200].felt>a.rows[200].real+3);
  ok('by feel the nose goes down and the aircraft hits the ground',b.rows.some(r=>r.crashed)&&mn(b.rows,'real')<0); }
/* runway picture */
eq('flat 45 m runway: the eye flies 3°',H.eyeAngle(0,45),3,1e-9);
ok('narrow runway: the eye flies lower',H.eyeAngle(0,30)<2.2);
ok('wide runway: the eye flies higher',H.eyeAngle(0,60)>3.8);
eq('upslope 2 % (1.15°): the eye flies about 1.85°',H.eyeAngle(H.pct2deg(2),45),1.854,0.01);
ok('downslope: the eye flies higher',H.eyeAngle(H.pct2deg(-2),45)>4);
ok('black hole: the path sags well below 3° several miles out',H.blackHoleH(4.5)<0.5*4.5*1852*Math.tan(3*H.D2R)/0.3048);
eq('PAPI on 3°: two white, two red',H.papi(3).filter(Boolean).length,2);
eq('PAPI at 2.0°: all red',H.papi(2).filter(Boolean).length,0);
eq('PAPI at 3.6°: all white',H.papi(3.6).filter(Boolean).length,4);
/* fatigue */
eq('17 h awake ≈ 0.05 % BAC',H.bacEq(17),0.05,1e-9); eq('24 h awake ≈ 0.10 % BAC',H.bacEq(24),0.10,1e-9);
ok('body clock lowest in the early morning',H.circ(5)<H.circ(10)&&H.circ(5)<H.circ(2)+0.02&&H.circ(16.8)>H.circ(12));
{ const d=H.day({bed:23,sleep:8,report:8,len:9}); ok('rested day duty stays in the green ('+d.minA.toFixed(2)+')',H.zone(d.minA)==='ok'&&d.wocl===0); }
{ const d=H.day({bed:23,sleep:5,debt:2,report:22,len:10}); ok('night duty after short sleep reaches the red zone',H.zone(d.minA)==='high'&&d.wocl>=3.5); ok('awake 28 h at the end',Math.abs(d.awakeEnd-28)<1e-9); }
{ const a=H.day({bed:23,sleep:8,report:8,len:10}), b=H.day({bed:23,sleep:5,debt:3,report:8,len:10}); ok('sleep debt lowers alertness',b.minA<a.minA-0.05); }
/* workload */
{ const n=H.workload({}), p=H.workload({wx:'poor'}), pb=H.workload({wx:'poor',brief:true}), f=H.workload({fatigue:2}), s=H.workload({startle:true});
  ok('a normal flight fits the capacity',n.over===0);
  ok('poor weather overloads the approach',p.over>0);
  ok('briefing early brings it back',pb.over===0);
  ok('fatigue lowers capacity: overload',f.over>0);
  ok('startle: a short overload',s.over>0&&s.over<6);
  ok('cruise is underload',n.under>15); }
eq('inverted U peaks at medium arousal',H.yd(0.55),1,1e-9);
console.log(`hf: ${pass} passed, ${fail} failed`); if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
