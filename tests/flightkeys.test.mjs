// Node tests for flightkeys.js (run: node tests/flightkeys.test.mjs): the keyboard ramp model (W/S/A/D), the mouse and
// touch drag curves, the release spring, and that a key-flown C172 / DA42 / B200 on the shared flight model responds gently.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const load=(...files)=>{ const ctx={Math,console}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx); for(const f of files) vm.runInContext(fs.readFileSync(path.join(here,'..',f),'utf8'),ctx); return ctx; };
const {FK}=load('flightkeys.js');
let pass=0, fail=0; const fails=[];
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } }
function near(name,got,exp,tol){ ok(`${name}: got ${(+got).toFixed(3)}, expected ${exp} ± ${tol}`,Math.abs(got-exp)<=tol); }
const DT=1/60;
const hold=(v,dir,t,fast)=>{ for(let i=0;i<Math.round(t/DT);i++) v=FK.step(v,dir,DT,fast); return v; };

/* ---------- ramp ---------- */
near('held 0.6 s → half travel',hold(0,1,0.6),0.5,0.02);
near('held 1.5 s → full travel',hold(0,1,1.5),1,0.02);
near('held 3 s stays at full',hold(0,-1,3),-1,1e-9);
ok('a 0.1 s tap is a small input (< 0.1)',Math.abs(hold(0,1,0.1))<0.1&&hold(0,1,0.1)>0.05);
{ let v=0, prev=0, mono=true; for(let i=0;i<90;i++){ v=FK.step(v,1,DT); if(v<prev) mono=false; prev=v; } ok('ramp is monotonic',mono); }
{ const a=hold(0,1,0.3), b=hold(0,1,0.3,2); ok('Shift ramps twice as fast',Math.abs(b-hold(0,1,0.6))<0.02&&b>a); }
ok('frame-rate independent (30 vs 120 fps within 0.02)',(()=>{ let a=0,b=0; for(let i=0;i<30;i++) a=FK.step(a,1,1/30); for(let i=0;i<120;i++) b=FK.step(b,1,1/120); return Math.abs(a-b)<0.02; })());
/* release: smooth return to centre (the elevator works on top of the trim, so centre is the trimmed position) */
{ let v=hold(0,1,0.6), t=0, prev=v, smooth=true; while(v>0&&t<2){ v=FK.step(v,0,DT); if(v>prev||prev-v>0.06) smooth=false; prev=v; t+=DT; }
  ok(`released from half travel → centre in under 0.8 s (took ${t.toFixed(2)} s)`,v===0&&t<0.8); ok('release is smooth (no step bigger than 0.06 per frame)',smooth);
  near('…and not instantly: still above 0.2 after 0.1 s',hold(0.5,0,0.1),0.27,0.07); }
ok('pushing the other way unwinds through centre',(()=>{ const v=hold(0.8,-1,0.5); return v<0; })());
ok('no key, centred: stays exactly 0',FK.step(0,0,DT)===0);

/* ---------- key sets ---------- */
{ const d=FK.dirs(new Set(['w'])); ok('W = push (nose down, y −1)',d.y===-1&&d.x===0); }
{ const d=FK.dirs(new Set(['s'])); ok('S = pull (nose up, y +1)',d.y===1); }
{ const d=FK.dirs(new Set(['a','ArrowRight'])); ok('A and → cancel',d.x===0); }
{ const d=FK.dirs(new Set(['ArrowDown','d'])); ok('arrows work like WASD',d.y===1&&d.x===1); }
{ ok('Home = trim nose down, End = nose up',FK.dirs(new Set(['Home'])).trim===-1&&FK.dirs(new Set(['End'])).trim===1&&FK.dirs(new Set([']'])).trim===1); }
{ const c=FK.create('C172'), K=new Set(['s']); for(let i=0;i<300;i++) c.tick(K,DT); near('C172: a held key gives the pitch authority (no Shift)',c.y,FK.AUTH.C172.y,0.001); ok('held flag',c.held);
  K.clear(); for(let i=0;i<60;i++) c.tick(K,DT); ok('…and back to 0 a second after release',c.y===0&&!c.held);
  K.add('d'); K.add('Shift'); for(let i=0;i<300;i++) c.tick(K,DT); near('Shift + D → full aileron',c.x,1,0.001); }

/* ---------- mouse and touch ---------- */
{ const m=d=>FK.shapeDrag(0,d,'mouse').y;
  ok('mouse: 3 px is inside the dead zone',m(3)===0);
  ok(`mouse: 20 px is a small input (${m(20).toFixed(3)} < 0.06)`,m(20)>0&&m(20)<0.06);
  ok(`mouse: 70 px about a quarter (${m(70).toFixed(2)})`,m(70)>0.15&&m(70)<0.35);
  near('mouse: 140 px is full travel',m(140),1,1e-9); near('mouse: beyond is capped',m(400),1,1e-9);
  ok('mouse: monotonic and odd',[5,10,30,60,100,139].every((d,i,a)=>!i||m(d)>m(a[i-1]))&&FK.shapeDrag(-50,-50,'mouse').x===-FK.shapeDrag(50,50,'mouse').x); }
{ const t=FK.shapeDrag(0,400,'touch'); near('touch: capped at 0.8 (as tuned before)',t.y,0.8,1e-9); ok('touch: 10 % dead zone',FK.shapeDrag(0,8,'touch').y===0); }
{ near('yoke pad: centre stays 0',FK.shapePad(0),0,1e-12); near('yoke pad: edge is full',FK.shapePad(1),1,1e-12); ok('yoke pad: a quarter out is gentle (< 0.1)',FK.shapePad(0.25)<0.1); }
{ const inp={stick:{x:0.6,y:-0.4}}; FK.spring(inp,DT); inp.stick=null; const a=FK.spring(inp,DT); ok('drag release springs back, not snaps',a&&a.x>0.5);
  let t=0, s=a; while(s&&t<2){ s=FK.spring(inp,DT); t+=DT; } ok(`…reaching centre in ${t.toFixed(2)} s (< 0.8 s)`,!s&&t<0.8); }

/* ---------- flown on the shared flight model: hold S for 1 s on an ILS, then let go ---------- */
function fly(type,ias,key,t1){
  const ctx=load('fdm.js','flightkeys.js'), F=ctx.FDM;
  if(type==='C172') F.useType('C172');
  if(type==='B200') Object.assign(F.AC,{m:5300,S:28.15,b:16.61,c:1.98,Ixx:26000,Iyy:30000,Izz:50000,CL0:0.25,CLa:5.2,CLmax:1.30,flaps:[{n:'UP',dCL:0,dCLmax:0,dCD:0,dCm:0},{n:'APPR',dCL:0.22,dCLmax:0.30,dCD:0.012,dCm:-0.03},{n:'DN',dCL:0.50,dCLmax:0.80,dCD:0.055,dCm:-0.06}]});
  const S=F.create(); F.place(S,{alt:1500,ias,hdg:360,flap:1,gear:1,thr:0.45,gam:-3}); S.autotrim=false;
  const c=ctx.FK.create(type), K=new Set(); const p0=F.readouts(S).pitch; let nzMax=1, dp1=0, roll=0;
  for(let t=0;t<3;t+=1/120){ if(t<t1) K.add(key); else K.delete(key); c.tick(K,1/120); S.ctl.ele=c.y; S.ctl.ail=c.x; F.step(S,1/240); F.step(S,1/240);
    const o=F.readouts(S); nzMax=Math.max(nzMax,o.nz); if(Math.abs(t-1.5)<1/240) dp1=o.pitch-p0; roll=o.roll; }
  return {nzMax,dp1,roll}; }
for(const [ty,ias] of [['C172',90],['DA42',120],['B200',140]]){
  const r=fly(ty,ias,'s',1);
  ok(`${ty} ${ias} kt: hold S 1 s → nose up 2–7° (${r.dp1.toFixed(1)}°)`,r.dp1>2&&r.dp1<7);
  ok(`${ty}: …gently, peak load under 1.7 g (${r.nzMax.toFixed(2)} g)`,r.nzMax<1.7);
  const t=fly(ty,ias,'s',0.15); ok(`${ty}: a 0.15 s tap of S moves the nose less than 1° (${t.dp1.toFixed(2)}°)`,Math.abs(t.dp1)<1&&t.dp1>0);
  const b=fly(ty,ias,'d',1); ok(`${ty}: hold D 1 s → 8–25° right bank (${b.roll.toFixed(1)}°)`,b.roll>8&&b.roll<25);
}

console.log(`${pass} passed, ${fail} failed`); if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
