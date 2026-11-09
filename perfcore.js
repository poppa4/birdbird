/* Birdbird – perfcore.js: the pure maths behind the Take-off and landing lab (performance.html).
   No DOM, no state. Loaded in the page as window.PFC and in Node (tests/perf.test.mjs) through vm.
   Three GENERIC teaching aircraft with typical, rounded values (not AFM data):
     sep  light single piston, performance Class B   (≈1 100 kg)
     tp   twin turboprop regional, Class A           (≈23 t)
     jet  twin jet narrow-body, Class A              (≈78 t)
   Take-off: a time-step ground run (thrust, drag, rolling friction, slope, wind), rotation, an energy-based
   airborne segment to the screen height; accelerate-go and accelerate-stop as functions of V1 (CS-25.107/109/113).
   Landing: 50 ft at VREF, air distance on the approach path, a free roll and a braked ground roll.
   Regulatory factors from CS-25 and Part-CAT (CAT.POL.A.205/210/230/235, 305, 330 and their AMC).
   Units inside: SI (m, kg, m/s, N). Speeds in and out: kt (CAS ≈ EAS at these speeds); distances in m. */
(function(root){
'use strict';
const G=9.80665, KT=0.514444, FT=0.3048, R=287.053, RHO0=1.225;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ---------- atmosphere: pressure altitude (ft) and outside air temperature (°C) ---------- */
const isaT=pa=>15-1.98*pa/1000;
function atm(pa,oat){ const d=Math.pow(1-6.8756e-6*pa,5.2559), p=101325*d, T=oat+273.15, rho=p/(R*T);
  return {pa,oat,delta:d,rho,sig:rho/RHO0,isa:isaT(pa),dev:oat-isaT(pa)}; }

/* ---------- the three generic aircraft ---------- */
const TYPES={
 sep:{k:'sep',cls:'B',n:1,prop:true,mtom:1110,mlm:1110,S:16.2,P0:134e3,eta:0.62,Ts:2.6e3,
   flaps:[{n:'0°',cl:1.45,cd:0.075,ld:9.5},{n:'10°',cl:1.6,cd:0.085,ld:9},{n:'25°',cl:1.8,cd:0.11,ld:7.5}],flapL:{cl:2.0,cd:0.14,ld:6.5},
   clg:0.4,mu:0.02,mub:0.3,rot:1,screen:50/3.281,tapp:5,free:1,vRat:1.1,v50Rat:1.2,vrefRat:1.3,tyre:Infinity,vmbe:Infinity},
 tp:{k:'tp',cls:'A',n:2,prop:true,mtom:23000,mlm:22350,S:61,P0:1.9e6,eta:0.8,Ts:40e3,flat:15,kT:0.010,
   flaps:[{n:'0',cl:1.75,cd:0.06,ld:14},{n:'15',cl:2.15,cd:0.075,ld:13},{n:'25',cl:2.4,cd:0.09,ld:11.5}],flapL:{cl:2.75,cd:0.13,ld:8.5},
   clg:0.5,mu:0.02,mub:0.3,rot:2,vmcg:88,vmca:92,tyre:165,vmbeRef:150,mref:23000,rev:0.3,tapp:3,free:1.5,gearLD:0.8},
 jet:{k:'jet',cls:'A',n:2,prop:false,mtom:78000,mlm:66000,S:122.6,T0:118e3,kv:0.0016,flat:15,kT:0.009,
   flaps:[{n:'1+F',cl:2.0,cd:0.075,ld:12.4},{n:'2',cl:2.25,cd:0.085,ld:11.4},{n:'3',cl:2.45,cd:0.095,ld:10.4}],flapL:{cl:2.9,cd:0.14,ld:8.2},
   clg:0.6,mu:0.02,mub:0.3,rot:3,vmcg:108,vmca:112,tyre:195,vmbeRef:168,mref:78000,rev:0.25,tapp:3,free:2,gearLD:1.0}};

/* thrust/power lapse with altitude and temperature. tAss: assumed (flex) temperature for the thrust only */
function lapse(ty,a,tAss){ if(ty.k==='sep') return Math.max(0,1.132*a.sig-0.132);           // Gagg–Ferrar: piston power ∝ density
  const tEff=Math.max(a.oat,tAss??-99), kink=a.isa+ty.flat, base=ty.prop?Math.pow(a.delta,0.8):Math.pow(a.delta,0.9);
  return base*(1-ty.kT*Math.max(0,tEff-kink)); }                                               // flat rated to ISA+15, then falls
/* total thrust of nEng engines at true airspeed V (m/s) */
function thrust(ty,a,V,nEng,tAss){ const f=lapse(ty,a,tAss), v=Math.max(0,V);
  if(ty.prop){ const P=ty.P0*f, Ts=ty.Ts*f; const Tp=ty.eta*P/Math.max(v,1); return nEng*Math.pow(Math.pow(Ts,-4)+Math.pow(Tp,-4),-0.25); }   // static thrust, smoothly capped by ηP/V
  return nEng*ty.T0*f*(1-ty.kv*v/KT); }
/* flat rating: take-off thrust (fraction of sea-level ISA) against OAT */
const flatCurve=(ty,pa,oat)=>lapse(ty,atm(pa,oat));

/* ---------- speeds (kt CAS) ---------- */
function vs(ty,m,cl){ return Math.sqrt(2*m*G/(RHO0*ty.S*cl))/KT; }
function speeds(ty,m,flap,a){ const fl=ty.flaps[flap], vsr=vs(ty,m,fl.cl);
  if(ty.cls==='B'){ const vr=ty.vRat*vsr; return {vsr,vr,vlof:vr,v2:ty.v50Rat*vsr,vmcg:0,vmca:0}; }
  const f=Math.sqrt(lapse(ty,a)), vmcg=ty.vmcg*f, vmca=ty.vmca*f;                          // VMC falls with TOGA thrust available
  const v2=Math.max(1.13*vsr,1.10*vmca), vr=Math.max(1.05*vmca,v2-(ty.k==='jet'?8:6)), vlof=vr+(ty.k==='jet'?5:4);
  return {vsr,vr,vlof,v2,vmcg,vmca}; }

/* ---------- surfaces ---------- */
const SURF={dry:{mub:1,rev:false,screen:35,cc:6},wet:{mub:0.55,rev:true,screen:15,cc:5},cont:{mub:0.33,rev:true,screen:15,cc:3}};
/* wind factoring (CAT.POL.A.205 / CS-25.105): not more than 50 % of a headwind, not less than 150 % of a tailwind */
const windF=w=>w>=0?0.5*w:1.5*w;

/* ---------- the ground run ----------
   o: {ty, m, flap, a, hw (factored headwind kt, − tail), sl (% uphill +), surf, tAss}
   phases: accelerate (nAEO engines) to vef, then (n−1) to vend. Returns distance (ground) and time. */
function accel(o,v0,v1,nEng,s0){ const ty=o.ty, fl=ty.flaps[o.flap], a=o.a, W=o.m*G, hw=o.hw*KT, dt=0.05;
  let V=Math.max(v0*KT/Math.sqrt(a.sig),0), s=s0||0, t=0; const vEnd=v1*KT/Math.sqrt(a.sig);   // TAS
  if(V<hw) V=Math.max(V,0);
  let gs=V-hw; if(v0<=0){ gs=0; V=hw; }
  while(V<vEnd&&t<200){ const q=0.5*a.rho*V*Math.abs(V)*ty.S, L=q*ty.clg, D=q*fl.cd*0.6+q*0.02;
    const F=thrust(ty,a,V,nEng,o.tAss)-D-ty.mu*Math.max(0,W-L)-W*o.sl/100, acc=F/o.m;
    if(acc<=0.02) return {s:Infinity,t:Infinity};
    gs+=acc*dt; V=gs+hw; s+=Math.max(0,gs)*dt; t+=dt; }
  return {s,t,gs}; }
/* stopping from v (CAS) with the brakes: idle, spoilers, reverse credit only where allowed (wet / contaminated) */
function stop(o,v,nRun){ const ty=o.ty, a=o.a, W=o.m*G, hw=o.hw*KT, sf=SURF[o.surf], dt=0.05; let V=v*KT/Math.sqrt(a.sig), gs=V-hw, s=0;
  const mub=(ty.mub)*sf.mub, rev=sf.rev&&ty.rev?ty.rev*thrust(ty,atm(0,15),0,nRun):0;
  while(gs>0){ const q=0.5*a.rho*V*Math.abs(V)*ty.S, D=q*0.11, dec=(mub*W+D+rev*Math.min(1,V/(40*KT))+W*o.sl/100)/o.m;
    gs-=dec*dt; V=gs+hw; s+=Math.max(0,gs)*dt; }
  return s; }
/* airborne: lift-off to the screen height (energy method). h in m. */
function airborne(o,vlof,vScreen,nEng,h){ const ty=o.ty, a=o.a, W=o.m*G, hw=o.hw*KT, ld=ty.flaps[o.flap].ld*(ty.gearLD?0.92:1);
  const V1=vlof*KT/Math.sqrt(a.sig), V2=vScreen*KT/Math.sqrt(a.sig), Vm=(V1+V2)/2, gam=thrust(ty,a,Vm,nEng,o.tAss)/W-1/ld;
  if(gam<=0.003) return Infinity; const E=h+(V2*V2-V1*V1)/(2*G); return E/gam*(Vm-hw)/Vm; }

/* ---------- take-off: one case ---------- */
function setup(p){ const ty=TYPES[p.type], a=atm(p.pa||0,p.oat??15); return {ty,m:p.m,flap:p.flap??1,a,hw:windF(p.wind||0),sl:p.slope||0,surf:p.surf||'dry',tAss:p.tAss,sp:speeds(ty,p.m,p.flap??1,a)}; }
/* all engines to the screen: run, distance (unfactored) */
function aeo(o){ const ty=o.ty, sp=o.sp, scr=ty.cls==='B'?ty.screen:SURF[o.surf].screen*FT, n=ty.n;
  const g=accel(o,0,sp.vlof,n); const air=airborne(o,sp.vlof,ty.cls==='B'?sp.v2:sp.v2+10,n,scr);
  return {run:g.s+air/2,dist:g.s+air,ground:g.s,air}; }
/* engine failure: recognised at V1 (VEF one second earlier). go → OEI to the screen; stop → 2 s at V1, then braking */
function goStop(o,v1){ const ty=o.ty, sp=o.sp, n=ty.n;
  const aA=accel(o,0,v1,n); const vef=Math.max(0,v1-(aA.t>0?(v1/aA.t):0)*1.0);                // speed one second before V1
  const g0=accel(o,0,vef,n), r1=accel(o,vef,v1,n-1,g0.s);
  const gr=v1<sp.vlof?accel(o,v1,sp.vlof,n-1,r1.s):{s:r1.s};
  const scr=SURF[o.surf].screen*FT, air=airborne(o,Math.max(sp.vlof,v1),sp.v2,n-1,scr);
  const go=gr.s+air, run=gr.s+air/2;
  const gsV1=(v1*KT/Math.sqrt(o.a.sig)-o.hw*KT);
  const st=r1.s+2*gsV1+stop(o,v1,n-1);
  return {v1,vef,go,run,air,dv1:r1.s,stop:st,gsV1:gsV1/KT}; }
/* VMBE (kt CAS): highest V1 the brakes can absorb, from a ground-speed energy limit scaled with mass */
function vmbe(o){ const ty=o.ty; if(!isFinite(ty.vmbeRef)) return Infinity; const gs=ty.vmbeRef*Math.sqrt(ty.mref/o.m)*(1+0.02*o.sl); return (gs+o.hw)*Math.sqrt(o.a.sig); }
/* the full take-off picture against a runway {tora, cwy, swy} (m) */
function takeoff(p,rw){ const o=setup(p), ty=o.ty, sp=o.sp, A=aeo(o);
  const tora=rw.tora, toda=tora+Math.min(rw.cwy||0,tora/2), asda=tora+(rw.swy||0);
  if(ty.cls==='B'){ const f=classBTOF(p), req=A.dist*f.total; return {o,sp,cls:'B',aeo:A,req,f,tora,toda,asda,ok:req<=tora,margin:tora-req}; }
  const aeoReq=1.15*A.dist, aeoRun=1.15*A.run, vb=vmbe(o), tyreOK=(sp.vlof*KT/Math.sqrt(o.a.sig)-o.hw*KT)/KT<=ty.tyre;
  const lo=Math.max(60,Math.round(sp.vmcg-12)), hi=Math.round(sp.vr), arr=[];
  for(let v=lo;v<=hi;v+=1) arr.push(goStop(o,v));
  const okV=x=>x.v1>=sp.vmcg-1e-9&&x.v1<=sp.vr+1e-9&&x.v1<=vb&&x.go<=toda&&x.run<=tora&&x.stop<=asda;
  const win=arr.filter(okV), fieldOK=win.length>0&&aeoReq<=toda&&aeoRun<=tora;
  let bal=arr[0]; for(const x of arr) if(Math.abs(x.go-x.stop)<Math.abs(bal.go-bal.stop)) bal=x;
  return {o,sp,cls:'A',aeo:A,aeoReq,aeoRun,arr,vmbe:vb,tyreOK,tora,toda,asda,win:win.length?[win[0].v1,win[win.length-1].v1]:null,bal,ok:fieldOK&&tyreOK}; }
/* one V1 against the runway */
function atV1(T,v1){ const a=T.arr; let b=a[0]; for(const x of a) if(Math.abs(x.v1-v1)<Math.abs(b.v1-v1)) b=x; return b; }

/* Class B take-off factors (AMC to CAT.POL.A.305): ×1.25 against TORA, dry grass ×1.2, wet grass ×1.3, +5 % per 1 % upslope */
function classBTOF(p){ const surf=p.surf==='grass'?1.2:p.surf==='wetgrass'?1.3:1, sl=1+0.05*Math.max(0,p.slope||0); return {reg:1.25,surf,sl,total:1.25*surf*sl}; }

/* ---------- climb after take-off (Class A, one engine out; Class B, all engines) ---------- */
/* gross gradient (fraction) at V2 with take-off flap, gear up: second segment */
function grad2(p){ const o=setup(p), ty=o.ty, sp=o.sp, V=sp.v2*KT/Math.sqrt(o.a.sig), n=ty.cls==='B'?ty.n:ty.n-1;
  return thrust(ty,o.a,V,n,o.tAss)/(o.m*G)-1/ty.flaps[o.flap].ld; }
/* first segment (gear down) and final segment (clean, max continuous ≈ 0.9 TO thrust, 1.25 VSR clean) */
function grads(p){ const o=setup(p), ty=o.ty, sp=o.sp, n=ty.cls==='B'?ty.n:ty.n-1, s2=grad2(p);
  const s1=s2-(ty.gearLD?0.012*ty.gearLD+0.004:0.012);
  const vc=1.25*vs(ty,o.m,ty.flaps[0].cl)*1.18, V=vc*KT/Math.sqrt(o.a.sig), cleanLD=ty.flaps[0].ld*1.32;
  const s4=0.9*thrust(ty,o.a,V,n,o.tAss)/(o.m*G)-1/cleanLD;
  return {s1,s2,s4,min:ty.cls==='B'?null:[0,0.024,0.012],net:ty.cls==='B'?0:0.008}; }
/* net gradient needed to clear an obstacle h (ft above the runway end) at d (m from the end of the TOD) by 35 ft */
const obsNeed=(h,d)=>d>0?Math.max(0,h*FT)/d:0;

/* ---------- maximum take-off mass today: the lowest limit ---------- */
function bis(ok,lo,hi){ if(!ok(lo)) return lo; if(ok(hi)) return hi; for(let i=0;i<14;i++){ const m=(lo+hi)/2; ok(m)?lo=m:hi=m; } return lo; }
function limits(p,rw,obs){ const ty=TYPES[p.type], lo=ty.mtom*0.5, hi=ty.mtom*1.15, q=m=>Object.assign({},p,{m});
  const L={struct:ty.mtom};
  L.field=bis(m=>{ const T=takeoff(q(m),rw); return ty.cls==='B'?T.ok:!!T.win&&T.aeoReq<=T.toda&&T.aeoRun<=T.tora; },lo,hi);
  if(ty.cls==='A'){ L.climb=bis(m=>grad2(q(m))>=0.024,lo,hi);
    if(obs&&obs.h>0) L.obst=bis(m=>grad2(q(m))-0.008>=obsNeed(obs.h,obs.d),lo,hi);
    L.tyre=bis(m=>{ const o=setup(q(m)); return (o.sp.vlof*KT/Math.sqrt(o.a.sig)-o.hw*KT)/KT<=ty.tyre; },lo,hi);
    L.brake=bis(m=>{ const T=takeoff(q(m),rw); const g=T.arr.find(x=>x.v1>=T.sp.vmcg&&x.go<=T.toda&&x.run<=T.tora); return !g||g.v1<=T.vmbe; },lo,hi); }
  let k='struct'; for(const x in L) if(L[x]<L[k]) k=x; return {L,gov:k,max:L[k]}; }
/* highest assumed temperature that still allows this mass (max 25 % thrust reduction; not on contaminated runways) */
function assumed(p,rw,obs){ const ty=TYPES[p.type]; if(ty.cls==='B'||p.surf==='cont') return null; const a=atm(p.pa||0,p.oat??15), full=lapse(ty,a);
  let best=null; for(let t=Math.max(Math.ceil(a.oat)+1,Math.ceil(a.isa+ty.flat));t<=a.isa+ty.flat+60;t+=1){ const red=1-lapse(ty,a,t)/full; if(red>0.25) break;
    const q=Object.assign({},p,{tAss:t}); const T=takeoff(q,rw); const g=grad2(q);
    if(T.ok&&T.win&&g>=0.024&&(!obs||!obs.h||g-0.008>=obsNeed(obs.h,obs.d))) best={t,red}; else break; }
  return best; }

/* ---------- landing ---------- */
/* landing distance from 50 ft to a stop. p: {type,m,pa,oat,wind,slope,surf,flapL:'full'|'red',rev:bool,actual:bool}
   certified (actual false): dry, max manual braking, no reverse. actual true: the surface's braking and reverse if selected */
function landing(p){ const ty=TYPES[p.type], a=atm(p.pa||0,p.oat??15), fl=p.red?{cl:ty.flapL.cl*0.9,cd:ty.flapL.cd*0.85}:ty.flapL;
  const vsr0=vs(ty,p.m,fl.cl), vref=(ty.cls==='B'?1.3:1.23)*vsr0, hw=windF(p.wind||0)*KT, sig=a.sig;
  const Vt=vref*KT/Math.sqrt(sig), gs=Vt-hw, gam=ty.tapp*Math.PI/180, air=(50*FT/Math.tan(gam)+Vt*1.5)*gs/Vt;  // approach path to touchdown plus a short flare
  const vtd=0.95*Vt, free=vtd-hw>0?(vtd-hw)*ty.free:0, sf=SURF[p.actual?(p.surf==='grass'||p.surf==='wetgrass'?'dry':p.surf):'dry'];
  const W=p.m*G, mub=ty.mub*sf.mub*(ty.cls==='B'?1.1:1), rev=p.actual&&p.rev&&ty.rev?ty.rev*thrust(ty,atm(0,15),0,ty.n):0, sl=-(p.slope||0)/100; // downhill landing: + slope
  let V=vtd, g2=vtd-hw, s=0; const dt=0.05;
  while(g2>0){ const q=0.5*a.rho*V*Math.abs(V)*ty.S, dec=(mub*W+q*fl.cd*1.4+rev*Math.min(1,V/(40*KT))+W*sl)/p.m; g2-=dec*dt; V=g2+hw; s+=Math.max(0,g2)*dt; }
  const ld=air+free+s; return {vsr0,vref,air,free,ground:s,ld}; }
/* required landing distance at dispatch (CAT.POL.A.230/235; Class B CAT.POL.A.330 and AMC) */
function landReq(p){ const ty=TYPES[p.type], cert=landing(Object.assign({},p,{actual:false}));
  const reg=ty.k==='jet'?1/0.6:1/0.7; let f=[['reg',reg]], req=cert.ld*reg;
  if(ty.cls==='B'){ if(p.surf==='grass'||p.surf==='wetgrass'){ f.push(['grass',1.15]); req*=1.15; } if(p.surf==='wet'||p.surf==='wetgrass'){ f.push(['wet',1.15]); req*=1.15; }
    const s=1+0.05*Math.max(0,-(p.slope||0)); if(s>1){ f.push(['slope',s]); req*=s; } return {cert,req,f}; }
  if(p.surf==='wet'||p.surf==='cont'){ f.push(['wet',1.15]); req*=1.15; }
  let cont=null; if(p.surf==='cont'){ cont=landing(Object.assign({},p,{actual:true,rev:true})); if(1.15*cont.ld>req){ req=1.15*cont.ld; f=[['cont',1.15]]; } }
  return {cert,req,f,cont}; }
/* landing distance at the time of arrival (in flight, actual conditions) with the usual 15 % margin */
function landTA(p){ const r=landing(Object.assign({},p,{actual:true})); return {ld:r.ld,req:1.15*r.ld,r}; }
/* go-around capability: approach climb (one engine out, approach flap) and landing climb (all engines, landing flap) */
function landClimb(p){ const ty=TYPES[p.type], a=atm(p.pa||0,p.oat??15), W=p.m*G, vsr0=vs(ty,p.m,ty.flapL.cl);
  const V=1.23*vsr0*KT/Math.sqrt(a.sig), lc=thrust(ty,a,V,ty.n)/W-1/ty.flapL.ld;
  const va=1.4*vs(ty,p.m,ty.flaps[1].cl)*KT/Math.sqrt(a.sig), ac=ty.n>1?thrust(ty,a,va,ty.n-1)/W-1/ty.flaps[1].ld:null;
  return {landing:lc,approach:ac,minL:ty.cls==='A'?0.032:null,minA:ty.cls==='A'?0.021:null}; }

root.PFC={G,KT,FT,TYPES,SURF,accel,stop,airborne,atm,isaT,lapse,thrust,flatCurve,speeds,vs,windF,setup,aeo,goStop,takeoff,atV1,vmbe,classBTOF,grad2,grads,obsNeed,limits,assumed,landing,landReq,landTA,landClimb,clamp};
})(typeof window!=='undefined'?window:globalThis);
