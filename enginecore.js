/* Birdbird – enginecore.js: the pure maths behind the Engines lab (engines.html).
   No DOM, no state. Loaded in the page as window.ENGC and in Node (tests/engine.test.mjs) through vm.
   Scaled representative models of four generic engine types, not data for any real engine:
   piston (normally aspirated, ~180 hp class, constant-speed propeller; optional turbo-normalising),
   free-turbine turboprop (~850 shp class, torque-limited / ITT-limited), single-spool turbojet (~15 kN class)
   and two-spool high-bypass turbofan (~120 kN class, flat rated to ISA+15).
   ICAO standard atmosphere. Units: altitude ft, TAS kt, temperatures °C unless a name ends in K. */
(function(root){
'use strict';
const FT=0.3048, KT=0.514444, T0=288.15, P0=1013.25, LR=0.0065, N=5.25588, LHV=43e6, HP=0.745700;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ---------- atmosphere ---------- */
function isa(hft,dT){ const h=Math.min(hft*FT,20000); const Ti=h<=11000?T0-LR*h:216.65;
  const p=h<=11000?P0*Math.pow(1-LR*h/T0,N):226.32*Math.exp(-9.80665*(h-11000)/(287.05*216.65));
  const T=Ti+(dT||0), delta=p/P0, theta=T/T0, sigma=delta/theta; return {T,Tc:T-273.15,Tisa:Ti-273.15,p,delta,theta,sigma,a:20.0468*Math.sqrt(T)}; }
const machOf=(tas,TK)=>tas*KT/(20.0468*Math.sqrt(TK));
/* total (ram) conditions at the engine face */
function ram(at,M){ const f=1+0.2*M*M; return {T2:at.T*f,theta2:at.theta*f,delta2:at.delta*Math.pow(f,3.5)}; }

/* ---------- propulsive efficiency ---------- */
/* a propeller: about 0.85 at its best; low at very low speed (thrust stays finite: T → η·P/V0), and it falls off
   once the helical tip Mach number gets high (here from about M 0.55) */
function propEta(tas,M,V0){ const v=Math.max(tas,0); const low=1-Math.exp(-v/(V0||70)); const hi=M<0.55?1:Math.max(0,1-Math.pow((M-0.55)/0.32,2)); return 0.85*low*hi; }
/* a jet: η = 2 / (1 + Vjet/V). The effective jet speed above flight speed is large for a turbojet, small for a high-bypass fan */
function jetEta(tas,kind){ const V=Math.max(tas*KT,0.1); const dv=kind==='jet'?620/(1+V/420):260/(1+V/150); return 2/(1+(V+dv)/V); }
/* propeller thrust from shaft power (N), finite at zero speed */
function propThrust(PkW,tas,M,V0){ const v=Math.max(tas,1)*KT; const eta=propEta(Math.max(tas,1),M,V0); const st=0.85*PkW*1000/((V0||70)*KT); return Math.min(st,eta*PkW*1000/v); }

/* ---------- piston ---------- */
const PIS={hp:180,rpm:2700,map0:29.0,idleMap:12,V0:55,crit:16000,stoich:0.067};
/* power factor against mixture: λ = fuel–air ratio / stoichiometric. Best power about λ 1.15, peak EGT at λ 1 */
const mixPow=lam=>lam<0.62||lam>2.0?0:Math.max(0,1-0.9*Math.pow(Math.log(lam/1.15),2));
function piston(o){ const at=isa(o.alt,o.dT), M=machOf(o.tas,at.T), r=ram(at,M);
  const pin=at.p*Math.pow(1+0.2*M*M,3.5)*0.02953;                       // inHg at the intake with ram
  const full=o.turbo&&o.alt<=PIS.crit?Math.min(PIS.map0+0.3,Math.max(pin-0.8,PIS.map0)):pin-0.8;
  const thr=clamp(o.thr,0,1); const mi=Math.min(full,PIS.idleMap*(0.4+0.6*Math.sqrt(at.delta))); let map=mi+(full-mi)*Math.pow(thr,1.15);
  if(o.ice&&!o.heat) map*=0.84;
  const Tch=r.T2+(o.heat?40:0)+(o.turbo?Math.max(0,(PIS.map0/Math.max(pin,5)-1))*35:0);     // charge temperature K
  const rpmSet=clamp(o.rpm||2400,2000,2700); const pfrac0=(map/PIS.map0)*(T0/Tch);           // air mass per stroke vs full SL
  const rpm=pfrac0>0.42?rpmSet:Math.max(700,rpmSet*(0.55+0.45*pfrac0/0.42));                  // below that the prop sits on its fine stop
  const air=pfrac0*(rpm/PIS.rpm);                                                             // air mass flow vs rated
  /* a float carburettor meters fuel ∝ √ρ, the engine takes air ∝ ρ: the mixture richens with altitude unless you lean */
  const rich=0.085/Math.sqrt(Math.max(r.delta2/r.theta2,0.2))*(o.heat?Math.sqrt((r.T2+40)/r.T2):1);   // full rich fuel–air ratio
  const far=rich*(0.55+0.45*clamp(o.mix,0,1)), lam=far/PIS.stoich;
  const fp=mixPow(lam); let hp=Math.max(0,PIS.hp*(1.1*air*fp-0.1*rpm/PIS.rpm)); if(thr<0.02) hp=Math.max(0,hp*0.3);
  const kW=hp*HP, ffkg=far*air*PIS.hp*2.68, frac=hp/PIS.hp;                              // fuel kg/h (full rich, full power ≈ 41 kg/h ≈ 57 L/h)
  const egt=fp>0?(560+200*(1-5.5*Math.pow(Math.log(lam),2))*Math.min(1,0.75+0.35*frac))+(r.T2-T0)*0.3:at.Tc;
  const cht=fp>0?at.Tc+60+150*frac*Math.max(0.3,1-3*Math.pow(Math.log(lam/1.07),2))-0.12*Math.min(o.tas,150):at.Tc;
  const thrust=propThrust(kW,o.tas,M,PIS.V0), etaP=propEta(o.tas,M,PIS.V0);
  return {type:'pist',M,map,mapFull:full,rpm,hp,kW,frac,ffkg,ffl:ffkg/0.72,bsfc:kW>1?ffkg*1000/kW:0,lam,egt,cht,rough:lam<0.8||lam>1.75||fp===0,
    thrust,etaP,eta0:o.tas>5&&ffkg>0.1?thrust*o.tas*KT/(ffkg/3600*LHV):0,stations:pistonSt(at,r,frac,egt)}; }
function pistonSt(at,r,frac,egt){ const Tc=r.T2*Math.pow(8.5,0.33); return [['in',r.T2],['comp',Tc],['burn',Tc+1400*Math.max(0.2,frac)],['exh',egt+273.15]]; }

/* ---------- free-turbine turboprop ---------- */
/* corrected ITT: ITT/θ2 = 820 K + k·Pc^1.2, with Pc = P/(δ2·√θ2). The thermodynamic limit (ITT 800 °C) gives ~1.15× the
   gearbox (torque) rating at sea level ISA, so the engine is flat rated: torque-limited low and cool, ITT-limited high or hot. */
const TP={shp:850,npMax:2000,ittMax:800,ittStart:1000,ngMax:101.5,ngLo:52,ngHi:70,V0:75,k:0.06527,c0:820};
function tpCap(at,r){ const lim=(TP.ittMax+273.15)/r.theta2-TP.c0; return Math.pow(Math.max(lim,0)/TP.k,1/1.2)*r.delta2*Math.sqrt(r.theta2); }
function ittOf(P,r){ const pc=Math.max(P,0)/(r.delta2*Math.sqrt(r.theta2)); return r.theta2*(TP.c0+TP.k*Math.pow(pc,1.2))-273.15; }
function tprop(o){ const at=isa(o.alt,o.dT), M=machOf(o.tas,at.T), r=ram(at,M), cap=tpCap(at,r);
  const cond=o.cond||'lo', pl=clamp(o.pl,-0.3,1), feather=!o.np;
  if(cond==='cut') return {type:'tp',M,cap,shp:0,kW:0,tq:0,itt:at.Tc,ng:0,np:0,ffkg:0,thrust:0,etaP:0,eta0:0,beta:false,feather,limit:null,over:{},stations:tpSt(at,r,0,at.Tc+273.15)};
  const ngIdle=cond==='hi'?TP.ngHi:TP.ngLo;
  const fwd=Math.max(pl,0), rev=Math.max(-pl,0);
  const idleP=cond==='hi'?70:40;                                       // shaft power at idle (shp)
  let shp=idleP*r.delta2+(cap*1.05-idleP*r.delta2)*Math.pow(fwd,1.5)+rev*0.55*cap; // lever is a gas-generator (Ng) demand: full forward overshoots the limits
  const ng=Math.min(104,(ngIdle+(TP.ngMax-ngIdle)*Math.pow(Math.max(0,(shp-idleP*r.delta2)/(cap*1.05-idleP*r.delta2)),0.55))*Math.pow(r.theta2,0.15));
  const npSet=feather?0:clamp(o.np,1600,TP.npMax); const beta=pl<0.08&&o.tas<120&&!feather;
  const np=feather?0:beta?Math.min(npSet,1250+(npSet-1250)*Math.min(1,shp/300)+rev*700):npSet;
  const tq=np>0?shp/(TP.shp*np/TP.npMax)*100:0;                        // torque % of the gearbox limit at that Np
  const itt=ittOf(shp,r), ffkg=(0.52*shp+80*r.delta2*Math.sqrt(r.theta2))*0.4536;
  let thrust=feather?-40*at.sigma*Math.pow(o.tas/100,2):propThrust(shp*HP,o.tas,M,TP.V0);
  if(rev>0) thrust=-propThrust(shp*HP*0.55,Math.max(o.tas,20),M,TP.V0)*Math.min(1,rev/0.3);
  else if(beta) thrust*=0.35+0.65*Math.min(1,pl/0.08);
  const etaP=feather?0:propEta(o.tas,M,TP.V0), over={tq:tq>100.5,itt:itt>TP.ittMax+0.5,ng:ng>TP.ngMax+0.05};
  const limit=cap<TP.shp?'itt':'tq';
  return {type:'tp',M,cap,shp,kW:shp*HP,tq,itt,ng,np,ffkg,thrust,etaP,eta0:o.tas>5&&thrust>0?thrust*o.tas*KT/(ffkg/3600*LHV):0,beta,feather,rev:rev>0,limit,over,
    maxShp:Math.min(TP.shp,cap),stations:tpSt(at,r,shp/TP.shp,itt+273.15)}; }
function tpSt(at,r,f,ittK){ const pr=1+7*Math.pow(Math.max(f,0.05),0.8), T3=r.T2*Math.pow(pr,0.32); return [['in',r.T2],['comp',T3],['burn',T3+(ittK-T3)*1.55],['itt',ittK],['exh',ittK-180*Math.max(f,0.2)]]; }

/* ---------- jets ---------- */
/* thrust lapse: T/T0 ≈ σ^0.85 × (1 − aM + bM²) × flat(ISA dev). The high-bypass fan loses thrust faster with speed. */
const FAN={kN:120,tref:15,egtTO:950,egtStart:725,n1Idle:20,n2Idle:58,bpr:6};
const JET={kN:15,tref:15,egtTO:700,egtStart:650,nIdle:45};
const lapseM=(M,kind)=>kind==='jet'?1-0.25*M+0.45*M*M:1-0.9*M+0.55*M*M;
const flat=(dT,tref)=>dT<=tref?1:Math.max(0.4,1-0.0068*(dT-tref));
function jetMax(o,kind){ const at=isa(o.alt,o.dT), ai=isa(o.alt,0), M=machOf(o.tas,at.T); return (kind==='jet'?JET.kN:FAN.kN)*Math.pow(ai.sigma,0.85)*lapseM(M,kind)*flat(o.dT||0,15); }
function jet(o,kind){ const fan=kind!=='jet', at=isa(o.alt,o.dT), M=machOf(o.tas,at.T), r=ram(at,M), x=clamp(o.tl,0,1);
  const tmax=jetMax(o,kind), tidle=0.05*tmax, thrust=(tidle+(tmax-tidle)*Math.pow(x,1.8))*1000;     // N
  const sq=Math.sqrt(r.theta2), T2c=r.T2-273.15, hot=Math.max(0,(o.dT||0)-15);
  const n1=fan?Math.min(104,(FAN.n1Idle+(97.5-FAN.n1Idle)*Math.pow(x,0.8))*sq):Math.min(103,(JET.nIdle+(100-JET.nIdle)*Math.pow(x,0.7))*sq);
  const n2=fan?Math.min(103,(FAN.n2Idle+(97-FAN.n2Idle)*Math.pow(x,0.6))*Math.pow(r.theta2,0.25)):n1;
  const egt=fan?360+1.8*T2c+500*Math.pow(x,1.4)+(hot>0?1.8*Math.min(hot,40)*x:0):300+1.6*T2c+360*Math.pow(x,1.3);
  const tsfc=(fan?0.36*(1+0.9*M):0.85*(1+0.35*M))*Math.sqrt(r.theta2)*(1+0.5*Math.pow(1-x,3));    // lb/lbf/h
  const ffkg=tsfc*thrust/4.448*0.4536+(fan?150:60)*r.delta2;                                    // kg/h
  const etaP=jetEta(o.tas,fan?'fan':'jet');
  const epr=fan?1+0.5*Math.pow(x,1.5):1+1.9*Math.pow(x,1.5);
  return {type:fan?'fan':'jet',M,thrust,tmax:tmax*1000,frac:thrust/((fan?FAN.kN:JET.kN)*1000),n1,n2,egt,ffkg,tsfc:thrust>1?ffkg/0.4536/(thrust/4.448):0,epr,etaP,
    eta0:o.tas>5&&thrust>0?thrust*o.tas*KT/(ffkg/3600*LHV):0,stations:jetSt(r,x,egt,fan)}; }
function jetSt(r,x,egt,fan){ const opr=fan?4+28*Math.pow(x,1.2):2+8*Math.pow(x,1.1), T3=r.T2*Math.pow(opr,0.31), T4=Math.max(T3+250,(fan?900:850)+(fan?700:400)*Math.pow(x,1.1)), Te=egt+273.15;
  return fan?[['in',r.T2],['fan',r.T2+30*x+3],['comp',T3],['burn',T4],['hpt',(T4+Te)/2],['egt',Te],['exh',Te-120*x]]:[['in',r.T2],['comp',T3],['burn',T4],['egt',Te],['exh',Te-60*x]]; }
const fan=o=>jet(o,'fan'), tjet=o=>jet(o,'jet');

/* ---------- comparison helpers (all as fraction of each engine's own sea-level static rating) ---------- */
function availFrac(type,alt,dT,tas,turbo){ const o={alt,dT,tas};
  if(type==='pist'){ const p=piston(Object.assign(o,{thr:1,rpm:2700,mix:bestMix(alt,dT,tas,turbo),turbo})); return p.hp/PIS.hp; }
  if(type==='tp'){ const at=isa(alt,dT), r=ram(at,machOf(tas,at.T)); return Math.min(TP.shp,tpCap(at,r))/TP.shp; }
  return jetMax(o,type==='jet'?'jet':'fan')/(type==='jet'?JET.kN:FAN.kN); }
/* mixture lever position for best power at these conditions (search) */
function bestMix(alt,dT,tas,turbo){ let b=1,bp=-1; for(let m=0;m<=1.0001;m+=0.02){ const p=piston({alt,dT,tas,thr:1,rpm:2700,mix:m,turbo}).hp; if(p>bp){ bp=p; b=m; } } return b; }
function peakMix(o){ let b=1,be=-1e9; for(let m=0;m<=1.0001;m+=0.01){ const e=piston(Object.assign({},o,{mix:m})).egt; if(e>be){ be=e; b=m; } } return b; }
/* static take-off rating against OAT at an elevation (flat rating), fraction of rated */
function toFrac(type,elev,oat,turbo){ const dT=oat-isa(elev,0).Tc; return availFrac(type,elev,dT,0,turbo); }
/* FLEX / assumed temperature: allowed if above OAT and the flat-rating corner and at most 25 % below TOGA */
function flex(elev,oat,tflex){ const ti=isa(elev,0).Tc, corner=ti+FAN.tref, tmax=ti+55; const toga=flat(oat-ti,15); const ok=tflex>oat&&tflex>corner&&tflex<=tmax;
  const used=ok?Math.max(flat(tflex-ti,15),0.75*toga):toga; return {corner,toga,used,ok,red:1-used/toga,tmax}; }
/* thrust against speed at sea level, as a fraction of static */
function thrustVsSpeed(type,tas){ const at=isa(0,0), M=machOf(tas,at.T);
  if(type==='pist') return propThrust(PIS.hp*HP,tas,M,PIS.V0)/propThrust(PIS.hp*HP,0,0,PIS.V0);
  if(type==='tp') return propThrust(TP.shp*HP,tas,M,TP.V0)/propThrust(TP.shp*HP,0,0,TP.V0);
  return lapseM(M,type==='jet'?'jet':'fan'); }

/* ---------- start sequences (one step of a simple time model) ----------
   st = {ph:'off'|'crank'|'lit'|'run'|'abort'|'dry', t, ng, temp, ff, starter, fuel, lit, tFuel, peak, over, overT, msg}
   ng = N2 (fan), N (jet), Ng (turboprop) or rpm/27 (piston) in %; temp = EGT / ITT °C.
   Fan and jet: an automatic (FADEC) start that aborts by itself. Turboprop: a manual start, the pilot must cut the fuel. */
const SP={fan:{k:0.2,dry:26,fuelAt:22,cut:50,idle:58,lim:725,idleT:430,peak:620},jet:{k:0.25,dry:24,fuelAt:18,cut:45,idle:50,lim:650,idleT:420,peak:560},
  tp:{k:0.3,dry:16,fuelAt:13,cut:50,idle:52,lim:1000,idleT:580,peak:760},pist:{k:0.6,dry:8,fuelAt:0,cut:30,idle:37,lim:999,idleT:420,peak:480}};
function startInit(oat){ return {ph:'off',t:0,ng:0,temp:oat??15,oat:oat??15,ff:0,starter:false,fuel:false,lit:false,tFuel:0,tLow:0,peak:oat??15,over:0,msg:'',ok:false}; }
function startStep(s,dt,type,fault,auto){ const P=SP[type], o=Object.assign({},s); o.t+=dt;
  const amb=o.oat; let tgt;
  /* rotor speed */
  let acc=0; if(o.starter) acc+=((o.lit?(fault==='hung'?P.idle*0.72:P.cut*1.15):P.dry)-o.ng)*P.k;
  if(o.lit){ const top=fault==='hung'?P.idle*0.72:P.idle; acc+=(top-o.ng)*(o.ng<P.idle*0.75?0.10:0.18); if(!o.starter&&o.ng<P.cut*0.95) acc-=2; }
  if(!o.starter&&!o.lit) acc=-o.ng*0.12;
  o.ng=Math.max(0,o.ng+acc*dt);
  /* the starter cuts out (fan/jet automatically; turboprop and piston: we do it for the pilot at the cut-out speed) */
  if(o.starter&&o.lit&&o.ng>=P.cut){ o.starter=false; }
  /* fuel on at the fuel speed in an automatic start (and the piston always) */
  if(auto&&o.ph==='crank'&&!o.fuel&&o.ng>=P.fuelAt){ o.fuel=true; o.tFuel=o.t; }
  if(type==='pist'&&o.ph==='crank'&&!o.fuel){ o.fuel=true; o.tFuel=o.t; }
  /* light-off */
  if(o.fuel&&!o.lit&&fault!=='wet'&&o.t-o.tFuel>(type==='pist'?1.2:3)) o.lit=true;
  o.ff=o.fuel?(o.lit?1:0.6)*(fault==='hot'?1.6:1):0;
  /* temperature */
  if(o.lit){ const prog=clamp((o.ng-P.fuelAt)/(P.idle-P.fuelAt),0,1);
    tgt=fault==='hot'?amb+(P.lim*1.35)*(0.6+0.4*Math.min(1,(o.t-o.tFuel)/6)):fault==='hung'?P.peak*0.9+(o.t-o.tFuel)*3:P.idleT+(P.peak-P.idleT)*Math.sin(Math.PI*Math.min(1,prog*1.1))*1.0+(prog<0.2?(P.peak-P.idleT)*prog*3:0);
    o.temp+= (tgt-o.temp)*Math.min(1,dt*(fault==='hot'?0.9:0.6)); }
  else o.temp+=(amb-o.temp)*Math.min(1,dt*(o.starter?0.08:0.03));
  o.peak=Math.max(o.peak,o.temp);
  if(o.temp>P.lim){ o.over+=dt; }
  /* phases */
  if(o.ph==='crank'&&o.lit) o.ph='lit';
  if(o.ph==='lit'&&!o.starter&&o.ng>=P.idle*0.97){ o.ph='run'; o.ok=o.over===0; }
  if(o.ph==='lit'&&acc<0.15&&o.ng<P.idle*0.9) o.tLow+=dt; else o.tLow=0;
  /* automatic start protection */
  if(auto&&(o.ph==='crank'||o.ph==='lit')){
    if(o.lit&&o.temp>P.lim-25){ return abort(o,'hot'); }
    if(o.tLow>5){ return abort(o,'hung'); }
    if(o.fuel&&!o.lit&&o.t-o.tFuel>10){ return abort(o,'wet'); }
  }
  if(o.ph==='dry'&&o.t>o.tDry){ o.ph='off'; o.starter=false; }
  return o; }
function abort(o,why){ o.ph='dry'; o.fuel=false; o.lit=false; o.ff=0; o.starter=true; o.msg=why; o.tDry=o.t+(why==='wet'?15:10); return o; }
/* pilot actions */
function startAct(s,act,type){ const o=Object.assign({},s);
  if(act==='start'){ if(o.ph==='off'||o.ph==='abort'){ Object.assign(o,{ph:'crank',starter:true,fuel:false,lit:false,msg:'',tLow:0,over:0,peak:o.temp,ok:false}); } }
  else if(act==='fuel'){ if(o.ph==='crank'&&!o.fuel){ o.fuel=true; o.tFuel=o.t; o.early=o.ng<SP[type].fuelAt; } }
  else if(act==='cut'){ o.fuel=false; o.lit=false; o.ff=0; if(o.ph!=='off'){ o.ph=o.starter?'dry':'abort'; o.tDry=o.t+15; } o.msg='cut'; }
  else if(act==='stop'){ Object.assign(o,{ph:'abort',starter:false,fuel:false,lit:false,ff:0}); }
  return o; }

/* unit helpers */
const kgToLb=v=>v/0.4536, lbfOfN=v=>v/4.448, gkWh=(ffkg,kW)=>kW>0.5?ffkg*1000/kW:0, mgNs=(ffkg,N)=>N>1?ffkg/3.6/N*1000:0;

root.ENGC={FT,KT,LHV,HP,PIS,TP,FAN,JET,SP,clamp,isa,machOf,ram,propEta,jetEta,propThrust,mixPow,piston,tprop,tpCap,ittOf,fan,tjet,jet,jetMax,lapseM,flat,
  availFrac,bestMix,peakMix,toFrac,flex,thrustVsSpeed,startInit,startStep,startAct,kgToLb,lbfOfN,gkWh,mgNs};
})(typeof window!=='undefined'?window:globalThis);
