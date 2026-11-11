// Fidelity and calibration tests for the shared flight model (fdm.js) with the three cockpit trainer types
// (run: node tests/calib.test.mjs). Headless: fdm.js in a vm, the C172 engine from c172core.js, the B200 type block
// read from b200-app.js so the test follows the page. Reference figures are public POH/AFM values; tolerances are
// teaching-grade, not certification-grade:
//   C172 (172P-like):   stall 51 / 46 KCAS (flaps 0 / 30) and climb about 700 ft/min at 2,400 lb, sea level ISA, Vy 76 KIAS
//   DA42 NG:            Vmca 76 KIAS (5° bank into the live engine, take-off power, critical engine windmilling)
//   King Air B200:      Vmca 86 KIAS (same conditions)
// plus turbulence: the 0–100 % slider gives light to moderate turbulence, independent of the step size.
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)), src=f=>fs.readFileSync(path.join(here,'..',f),'utf8');
let pass=0, fail=0; const fails=[];
function ok(name,c){ if(c) pass++; else { fail++; fails.push(name); } console.log((c?'ok   ':'FAIL ')+name); }
const within=(name,got,exp,tol)=>ok(`${name}: ${(+got).toFixed(1)} (expected ${exp} ± ${tol})`,Math.abs(got-exp)<=tol);
const between=(name,got,lo,hi,d=1)=>ok(`${name}: ${(+got).toFixed(d)} (expected ${lo}–${hi})`,got>=lo&&got<=hi);

function load(type){
  const ctx={Math,console}; ctx.window=ctx; ctx.globalThis=ctx; vm.createContext(ctx);
  vm.runInContext(src('fdm.js'),ctx);
  if(type==='C172'){ vm.runInContext(src('c172core.js'),ctx); ctx.FDM.useType('C172'); }
  if(type==='B200'){ const m=src('b200-app.js').match(/Object\.assign\(F\.AC,\{name:'B200'[\s\S]*?\}\}\);/); if(!m) throw new Error('B200 type block not found'); ctx.F=ctx.FDM; vm.runInContext(m[0],ctx); }
  return ctx;
}
function rng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

/* a simple test pilot: pitch holds IAS (PI), aileron holds bank (PI), rudder centres the sideslip or holds the heading */
function fly(type,o){
  const c=load(type), F=c.FDM, S=F.create(), CC=c.C172C; if(o.mass) F.AC.m=o.mass;
  F.place(S,{N:-20000,E:0,alt:o.alt??0,ias:o.ias,hdg:360,flap:o.flap??0,gear:o.gear??0,gam:o.gam||0,thr:o.thr});
  const eng=CC?CC.engInit(true,15):null;
  if(o.fail) o.fail.forEach((f,i)=>{ if(f){ S.eng[i].fail=true; S.eng[i].feather=!!o.feather; } });
  const dt=1/240, n=Math.round(o.T/dt); let thI=S.th*F.R2D, aI=0, rI=0, vs=0, k=0, rud=0, beta=0;
  for(let i=0;i<n;i++){ const r=F.readouts(S);
    if(eng){ CC.engStep(eng,{thr:1,mix:1,heat:0,mags:3,starter:false,fuel:true,ias:r.ias,alt:r.altTrue,oat:15-0.0019812*r.altTrue,rh:0.2,rnd:0.5},dt); S.eng[0].thr=CC.propThr(eng,r.ias)/Math.min(1,F.isa(S.h,0).sig/0.74); }
    else S.eng.forEach(e=>{ if(!e.fail) e.thr=o.thr; });
    thI=F.clamp(thI+0.25*(r.ias-o.ias)*dt,-15,25); const e=F.clamp(0.11*(thI+0.8*(r.ias-o.ias)-r.pitch)-1.6*S.q,-1,1); S.ctl.ele=e; S.ctl.trim=F.clamp(S.ctl.trim+e*0.9*dt,-1,1);
    aI=F.clamp(aI+0.03*((o.bank||0)-r.roll)*dt,-0.5,0.5); S.ctl.ail=F.clamp(0.06*((o.bank||0)-r.roll)+aI-0.9*S.p,-1,1);
    if(o.hdg){ const d=F.wrap180(S.psi*F.R2D)*F.D2R; rI=F.clamp(rI-d*dt*2,-1.5,1.5); S.ctl.rud=F.clamp(-4*d-3*S.r+rI,-1,1); }
    else { const b=S.beta||0; rI=F.clamp(rI+b*dt*3,-1,1); S.ctl.rud=F.clamp(3*b+rI-0.5*S.r,-1,1); }
    F.step(S,dt); if(S.crash) break;
    if(i>n-20/dt){ vs+=r.vs; rud+=S.ctl.rud; beta+=(S.beta||0)*F.R2D; k++; } }
  return {vs:vs/k,rud:rud/k,beta:beta/k,ias:F.readouts(S).ias,crash:S.crash};
}

/* power-off stall: 1 kt/s deceleration, wings level; the speed (CAS) where the wing is clearly stalled */
function stallSpeed(type,{flap=0,mass,v0}){
  const c=load(type), F=c.FDM, S=F.create(); if(mass) F.AC.m=mass;
  F.place(S,{N:-20000,E:0,alt:3000,ias:v0,hdg:360,flap,gear:flap?1:0,thr:0.3}); S.eng.forEach(e=>{ e.thr=0; });
  const dt=1/240; let thI=S.th*F.R2D, tgt=v0;
  for(let t=0;t<200;t+=dt){ const r=F.readouts(S); if(t>5) tgt=v0-(t-5);
    thI+=0.25*(r.ias-tgt)*dt; const e=F.clamp(0.11*(thI+0.8*(r.ias-tgt)-r.pitch)-1.6*S.q,-1,1); S.ctl.ele=e; S.ctl.trim=F.clamp(S.ctl.trim+e*0.5*dt,-1,1);
    S.ctl.ail=F.clamp(-0.06*r.roll-0.9*S.p,-1,1); F.step(S,dt); if(S.stall>0.3) return r.ias; }
  return NaN;
}

/* static Vmca: the lowest speed where full rudder still holds a straight, steady flight path with the critical engine
   windmilling (or feathered), the other at take-off power, and the given bank into the live engine. Solves the
   lateral-directional balance (side force, roll and yaw moments) for sideslip, aileron and rudder. */
function vmca(type,{bank=5,feather=false}={}){
  const c=load(type), F=c.FDM, A=F.AC;
  const rudAt=Vk=>{ const S=F.create(); F.place(S,{N:-20000,E:0,alt:0,ias:Vk,hdg:360,flap:0,gear:0,thr:1});
    S.eng[0].fail=true; S.eng[0].feather=feather; S.eng[0].load=0; S.eng[1].thr=S.eng[1].load=1; F.step(S,1e-6);
    const q=0.5*1.225*(Vk*F.KT)**2, W=A.m*9.80665, M=[[q*A.S*A.CYb,0,-q*A.S*A.CYR],[A.Clb,A.ClA,A.ClR],[q*A.S*A.b*A.Cnb,q*A.S*A.b*A.CnA,q*A.S*A.b*A.CnR]];
    const rhs=[-W*Math.sin(bank*F.D2R),0,-(S.eng[0].T-S.eng[1].T)*A.yEng];
    const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    return det(M.map((row,i)=>row.map((v,j)=>j===2?rhs[i]:v)))/det(M); };
  let lo=30, hi=200; for(let i=0;i<40;i++){ const m=(lo+hi)/2; if(Math.abs(rudAt(m))>1) lo=m; else hi=m; } return hi;
}

/* dynamic check of the same: decelerate 1 kt/s holding heading with rudder, 5° bank; Vmc = where the rudder runs out */
function vmcaFlown(type,{v0,flap=0}){
  const c=load(type), F=c.FDM, S=F.create();
  F.place(S,{N:-20000,E:0,alt:3000,ias:v0,hdg:360,flap,gear:0,thr:1}); S.eng[0].fail=true;
  const dt=1/240; let thI=S.th*F.R2D, aI=0, rI=0, sat=0, tgt=v0;
  for(let t=0;t<120;t+=dt){ const r=F.readouts(S); if(t>8) tgt=v0-(t-8); S.eng[1].thr=1;
    thI=F.clamp(thI+0.25*(r.ias-tgt)*dt,-15,25); const e=F.clamp(0.11*(thI+0.8*(r.ias-tgt)-r.pitch)-1.6*S.q,-1,1); S.ctl.ele=e; S.ctl.trim=F.clamp(S.ctl.trim+e*0.9*dt,-1,1);
    aI=F.clamp(aI+0.03*(5-r.roll)*dt,-0.5,0.5); S.ctl.ail=F.clamp(0.06*(5-r.roll)+aI-0.9*S.p,-1,1);
    const d=F.wrap180(S.psi*F.R2D)*F.D2R; rI=F.clamp(rI-d*dt*2,-1.5,1.5); S.ctl.rud=F.clamp(-4*d-3*S.r+rI,-1,1);
    F.step(S,dt); if(S.crash) return {v:NaN};
    if(S.stall>0.3) return {v:r.ias,stall:true};
    sat=Math.abs(S.ctl.rud)>=0.999?sat+dt:0; if(sat>1) return {v:r.ias}; }
  return {v:NaN};
}

/* ---------- stall speeds (CAS; the C172 page adds its ASI position error on top) ---------- */
within('C172 stall, flaps 0, 2,400 lb (POH about 51 KCAS)',stallSpeed('C172',{mass:1089,v0:80}),51,3);
within('C172 stall, flaps 30, 2,400 lb (POH about 46 KCAS)',stallSpeed('C172',{mass:1089,flap:3,v0:70}),46,3);
within('DA42 stall, flaps UP (model 62; AFM 66 KIAS at 1,785 kg)',stallSpeed('DA42',{v0:100}),63,4);
within('DA42 stall, flaps LDG (model 56; AFM 62 KIAS at 1,785 kg)',stallSpeed('DA42',{flap:2,v0:90}),57,4);
// B200: the model sits below the published clean figure (about 99 KIAS at MTOW); kept as a regression band until weight is selectable
within('B200 stall, flaps UP (model regression band)',stallSpeed('B200',{v0:130}),91,3);
within('B200 stall, flaps DOWN (model 72; published about 75 KIAS)',stallSpeed('B200',{flap:2,v0:110}),73,3);

/* ---------- Vmca ---------- */
within('B200 Vmca, 5° bank, windmilling (published 86 KIAS)',vmca('B200'),86,3);
within('DA42 Vmca, 5° bank, windmilling (AFM 76 KIAS)',vmca('DA42'),76,3);
ok('B200: bank into the live engine lowers Vmca (wings level is higher)',vmca('B200',{bank:0})>vmca('B200')+5);
ok('B200: a feathered propeller lowers Vmca a little',vmca('B200',{feather:true})<vmca('B200'));
{ const r=vmcaFlown('B200',{v0:115,flap:1}); ok(`B200 flown Vmca (flaps APPROACH, 1 kt/s): rudder runs out or the wing stalls at ${r.v.toFixed(1)} KIAS${r.stall?' (stall first)':''}, at or below 89`,r.v<=89&&r.v>=70); }
{ const r=vmcaFlown('DA42',{v0:100}); ok(`DA42 flown Vmca: ${r.v.toFixed(1)} KIAS${r.stall?' (stall first)':''}, 70–79`,r.v>=70&&r.v<=79); }
/* the sign of the rudder side force: with 3° of bank towards the live engine the sideslip is close to zero (real twins: 2–5°) */
{ const r=fly('B200',{ias:121,T:40,thr:1,fail:[1,0],feather:true,bank:3,hdg:true}); between('B200 OEI at blue line, 3° bank: sideslip near zero (°)',r.beta,-2.5,2.5); }

/* ---------- climb (sea level ISA, take-off / full power) ---------- */
{ const r=fly('C172',{ias:76,T:90,mass:1089,gam:4}); within('C172 climb at Vy, 2,400 lb (POH about 700 ft/min)',r.vs,700,70); }
{ const r=fly('C172',{ias:76,T:90,gam:4}); between('C172 climb at Vy, 2,205 lb (model weight; more than at 2,400 lb)',r.vs,700,880,0); }
// DA42 and B200 climb: the model is above the published figures (no sideslip/rudder drag, light fixed weights); regression bands
{ const r=fly('DA42',{ias:90,T:60,thr:1,gam:4}); between('DA42 AEO climb at Vy 90 (model band)',r.vs,1450,1850,0); }
{ const r=fly('DA42',{ias:85,T:60,thr:1,fail:[1,0],feather:true,bank:3,hdg:true}); between('DA42 OEI climb at Vyse 85, feathered (model band)',r.vs,400,700,0); }
{ const r=fly('B200',{ias:125,T:60,thr:1,gam:5}); between('B200 AEO climb at 125 KIAS (model band; published about 2,450)',r.vs,2600,3300,0); }
{ const r=fly('B200',{ias:121,T:60,thr:1,fail:[1,0],feather:true,bank:3,hdg:true}); between('B200 OEI climb at 121 KIAS, feathered (model band; published about 740)',r.vs,850,1200,0); }

/* ---------- turbulence ---------- */
function turb(type,k,hz,seeds=16){ let R=0,N=0;
  for(let sd=1;sd<=seeds;sd++){ const c=load(type), F=c.FDM, S=F.create(); S.env.turb=k; S.rng=rng(sd);
    F.place(S,{N:-20000,E:0,alt:3000,ias:type==='B200'?160:type==='C172'?95:120,hdg:360});
    let sr=0,n=0,mx=0; for(let t=0;t<30;t+=1/hz){ F.step(S,1/hz); const o=F.readouts(S); sr+=o.roll*o.roll; n++; mx=Math.max(mx,Math.abs(S.nz-1)); }
    R+=Math.sqrt(sr/n); N+=mx; }
  return {roll:R/seeds,nz:N/seeds}; }
for(const ty of ['C172','DA42','B200']){
  const a=turb(ty,0.5,60), b=turb(ty,0.5,240), z=turb(ty,0,240,1), f=turb(ty,1,120,8);
  between(`${ty} turbulence 50 %: RMS roll hands-off over 30 s, 240 Hz (°)`,b.roll,1,3,2);
  ok(`${ty} turbulence 50 %: same at 60 Hz and 240 Hz (${a.roll.toFixed(2)}° vs ${b.roll.toFixed(2)}°, within 20 %)`,Math.abs(a.roll-b.roll)<0.2*b.roll);
  between(`${ty} turbulence 50 %: peak load factor change (g, light)`,b.nz,0.1,0.35,2);
  between(`${ty} turbulence 100 %: peak load factor change (g, moderate)`,f.nz,0.25,0.7,2);
  ok(`${ty} turbulence 0 %: no disturbance (roll ${z.roll.toFixed(3)}°, ${z.nz.toFixed(3)} g)`,z.roll<0.05&&z.nz<0.03);
}

console.log(`${pass} passed, ${fail} failed`); if(fail){ fails.forEach(f=>console.log('  ✗ '+f)); process.exit(1); }
