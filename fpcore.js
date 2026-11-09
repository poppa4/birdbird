/* Birdbird – fpcore.js: the pure maths behind the Climb, cruise and fuel lab (flightplanning.html).
   No DOM, no state. Loaded in the page as window.FPC and in Node (tests/fp.test.mjs) through vm.
   Three GENERIC teaching aircraft with typical, rounded values (not AFM/FCOM data): sep light single piston,
   tp twin turboprop, jet twin jet. Parabolic drag polar CD = CD0 + k·CL² (plus a wave-drag rise for the jet),
   thrust available from power (props) or nearly constant thrust (jet), fuel flow from BSFC × power or TSFC × thrust.
   Fuel: the EASA basic fuel scheme (CAT.OP.MPA.181 and AMC1, Reg. (EU) 2021/1296) and the Part-NCO final reserve.
   Units: speeds kt, altitudes ft, masses and fuel kg, distances NM, time h unless stated. */
(function(root){
'use strict';
const G=9.80665, KT=0.514444, FT=0.3048, RHO0=1.225, A0=661.47;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ISA (troposphere and lower stratosphere) */
function isa(h){ const m=h*FT; let T,p; if(m<=11000){ T=288.15-0.0065*m; p=101325*Math.pow(T/288.15,5.25588); } else { T=216.65; p=22632.06*Math.exp(-(m-11000)/6341.62); }
  const rho=p/(287.053*T); return {T,p,rho,sig:rho/RHO0,delta:p/101325,a:A0*Math.sqrt(T/288.15)}; }

const AC={
 sep:{k:'sep',prop:true,n:1,m:1100,mMin:800,mMax:1110,S:16.2,cd0:0.032,K:0.058,P0:134e3,eta:0.80,Ts:2.6e3,bsfc:0.30,vmin:50,vmax:150,ceil:14000,
   tas:110,ff:27,hold:21,climb:2,taxi:3,tank:137,dens:0.72},
 tp:{k:'tp',prop:true,n:2,m:21000,mMin:15000,mMax:23000,S:61,cd0:0.027,K:0.033,P0:1.9e6,eta:0.85,Ts:40e3,bsfc:0.28,vmin:105,vmax:290,ceil:25000,
   tas:270,ff:720,hold:520,climb:120,taxi:50,tank:5000},
 jet:{k:'jet',prop:false,n:2,m:66000,mMin:48000,mMax:78000,S:122.6,cd0:0.022,K:0.042,T0:118e3,kv:0.0016,tsfc:0.061,mcr:0.745,vmin:140,vmax:500,ceil:39800,mmo:0.82,
   tas:450,ff:2400,hold:2300,climb:700,taxi:200,tank:18700}};

/* thrust available at TAS (kt), climb rating; props: power (Gagg–Ferrar for the piston, flat-ish turboprop) × η / V */
function tAvail(ac,h,tas){ const a=isa(h), v=Math.max(tas,1)*KT;
  if(ac.prop){ const f=ac.k==='sep'?Math.max(0,1.132*a.sig-0.132)*0.85:Math.min(1,Math.pow(a.delta,0.7)*1.12)*0.9, P=ac.P0*f, Ts=ac.Ts*f*ac.n, Tp=ac.n*ac.eta*P/v;
    return Math.pow(Math.pow(Ts,-4)+Math.pow(Tp,-4),-0.25); }
  const M=tas/a.a; return ac.n*ac.T0*0.92*Math.pow(a.delta,0.9)*(1-0.25*M); }
/* drag (N) at TAS (kt), mass m (kg), pressure altitude h (ft) */
function drag(ac,m,h,tas){ const a=isa(h), v=tas*KT, q=0.5*a.rho*v*v, cl=m*G/(q*ac.S); let cd=ac.cd0+ac.K*cl*cl;
  if(!ac.prop){ const M=tas/a.a, mc=ac.mcr-0.1*Math.max(0,cl-0.5); if(M>mc) cd+=20*Math.pow(M-mc,4); }
  return q*ac.S*cd; }
const tasOf=(eas,h)=>eas/Math.sqrt(isa(h).sig), easOf=(tas,h)=>tas*Math.sqrt(isa(h).sig);
/* minimum drag speed (EAS, incompressible): CL = √(CD0/k) */
function vmd(ac,m){ const cl=Math.sqrt(ac.cd0/ac.K); return Math.sqrt(2*m*G/(RHO0*ac.S*cl))/KT; }
const ldMax=ac=>1/(2*Math.sqrt(ac.cd0*ac.K));
/* fuel flow (kg/h) to fly level at TAS */
function ff(ac,m,h,tas){ const D=drag(ac,m,h,tas); if(ac.prop) return ac.bsfc*D*tas*KT/ac.eta/1000; const M=tas/isa(h).a; return ac.tsfc*(1+0.3*(M-0.5))*D; }

/* sweep against EAS (the pilot's speed). Returns points with TAS, drag, thrust, gradient, rate of climb, fuel flow */
function sweep(ac,m,h,n){ const out=[], lo=ac.vmin*0.85, hi=ac.vmax; n=n||160;
  for(let i=0;i<=n;i++){ const eas=lo+(hi-lo)*i/n, tas=tasOf(eas,h), D=drag(ac,m,h,tas), T=tAvail(ac,h,tas), W=m*G;
    if(!ac.prop&&tas/isa(h).a>ac.mmo+0.02) break;
    out.push({eas,tas,D,T,Preq:D*tas*KT,Pav:T*tas*KT,grad:(T-D)/W,roc:(T-D)/W*tas*KT/FT*60,ff:ff(ac,m,h,tas)}); }
  return out; }
/* best climb speeds: Vx = max gradient (excess thrust), Vy = max rate (excess power) */
function climbSpeeds(ac,m,h){ const s=sweep(ac,m,h,400); let x=s[0], y=s[0]; for(const p of s){ if(p.grad>x.grad) x=p; if(p.roc>y.roc) y=p; } return {vx:x,vy:y,pts:s}; }
/* ceilings: absolute (rate 0), service (100 ft/min), and for a jet the thrust-limited max altitude (300 ft/min residual) */
function ceilings(ac,m){ let abs=null, svc=null, r300=null; for(let h=0;h<=45000;h+=250){ const r=climbSpeeds(ac,m,h).vy.roc;
    if(svc===null&&r<100) svc=h; if(r300===null&&r<300) r300=h; if(r<=0){ abs=h; break; } }
  return {abs:abs??45000,svc:svc??45000,r300:r300??45000}; }
/* cruise: best range (max TAS per fuel flow, i.e. the tangent from the origin; with wind, from the wind point) and best endurance (min fuel flow) */
function cruise(ac,m,h,wind){ const s=sweep(ac,m,h,400); wind=wind||0; let r=null, e=s[0];
  for(const p of s){ const gs=p.tas+wind; if(gs>5){ p.sr=gs/p.ff; if(!r||p.sr>r.sr) r=p; } if(p.ff<e.ff) e=p; }
  /* long-range cruise: the faster speed that keeps 99 % of the best still-air range */
  let lrc=r; for(const p of s) if(p.tas>r.tas&&(p.tas+wind)/p.ff>=0.99*r.sr) lrc=p;
  return {range:r,endur:e,lrc,pts:s}; }
/* cost index (kg/min): minimise fuel + CI × time per NM */
function econ(ac,m,h,wind,ci){ const s=sweep(ac,m,h,400); let b=null; for(const p of s){ const gs=p.tas+(wind||0); if(gs<=5) continue; const c=p.ff/gs+ci*60/gs; if(!b||c<b.c) b=Object.assign({c},p); } return b; }
/* fuel per 100 NM at the best range speed, still air */
const per100=(ac,m,h)=>{ const r=cruise(ac,m,h,0).range; return 100/r.sr; };
/* optimum altitude for range at this mass (jet): the altitude with the most NM per kg, limited by 300 ft/min residual climb and MMO */
function optAlt(ac,m){ let best=null; const cap=Math.min(ac.ceil,ceilings(ac,m).r300); for(let h=10000;h<=cap;h+=500){ const r=cruise(ac,m,h,0).range; if(r&&(!best||r.sr>best.sr)) best={h,sr:r.sr}; } return best; }

/* ---------- fuel planning ----------
   o: {type, rules:'cat'|'nco', ncoFlt:'day'|'night', dist, wind (kt, − head), alt:'one'|'none'|'iso', altDist, cont:'5'|'3'|'20', extra (min), disc (kg)} */
function fuelPlan(o){ const ac=AC[o.type], gs=Math.max(40,ac.tas+(o.wind||0)), time=o.dist/gs, trip=ac.ff*time+ac.climb;
  const turbine=ac.k!=='sep', nco=o.rules==='nco'&&!turbine, hold=m=>ac.hold*m/60;
  const P={taxi:ac.taxi,trip,time};
  if(nco){ P.cont=0; P.altn=o.ncoFlt==='night'&&o.alt==='one'?ac.ff*o.altDist/ac.tas+ac.climb:0; P.frf=hold(o.ncoFlt==='night'?45:30); P.add=0; }
  else { const c5=Math.max(0.05*trip,hold(5)), c3=Math.max(0.03*trip,hold(5)), c20=trip/time*20/60;
    P.cont=o.cont==='3'?c3:o.cont==='20'?c20:c5;
    P.frf=hold(turbine?30:45);
    P.altn=o.alt==='one'?ac.ff*o.altDist/ac.tas+ac.climb*0.7:0;
    if(o.alt==='none') P.add=hold(15);                                                     // no destination alternate: 15 min at 1 500 ft
    else if(o.alt==='iso'){ const cruiseH=Math.max(0,time-0.3), need=turbine?ac.ff*2:Math.min(ac.ff*(0.75+0.15*cruiseH),ac.ff*2); P.add=Math.max(0,need-P.frf); }  // isolated: 2 h (turbine) incl. FRF
    else P.add=0; }
  P.extra=hold(o.extra||0); P.disc=o.disc||0;
  P.min=P.taxi+P.trip+P.cont+P.altn+P.frf+P.add+P.extra;   // minimum required block fuel (without discretionary)
  P.block=P.min+P.disc; P.tank=ac.tank; P.fits=P.block<=ac.tank; P.landing=P.block-P.taxi-P.trip;   // planned fuel at landing
  return P; }
/* critical point (equal time point) and point of no return. d NM, gsOn/gsHome kt, E h of safe endurance */
const etp=(d,gsOn,gsHome)=>d*gsHome/(gsOn+gsHome);
const pnr=(E,gsOut,gsHome)=>E*gsOut*gsHome/(gsOut+gsHome);

root.FPC={G,KT,FT,AC,isa,tAvail,drag,ff,tasOf,easOf,vmd,ldMax,sweep,climbSpeeds,ceilings,cruise,econ,per100,optAlt,fuelPlan,etp,pnr,clamp};
})(typeof window!=='undefined'?window:globalThis);
