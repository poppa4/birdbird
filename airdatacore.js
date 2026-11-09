/* Birdbird – airdatacore.js: the pure maths behind the Air data lab (airdata.html).
   No DOM, no state. Loaded in the page as window.ADC and in Node (tests/airdata.test.mjs) through vm.
   ICAO standard atmosphere (Doc 7488) up to 20 km: sea level 1013.25 hPa, 15 °C, lapse rate 6.5 °C/km to 11 km, then −56.5 °C.
   Units: altitudes in ft, pressures in hPa, temperatures in °C, speeds in kt, unless stated. */
(function(root){
'use strict';
const FT=0.3048, P0=1013.25, T0=288.15, LR=0.0065, G0=9.80665, RA=287.05287, N=G0/(RA*LR);   // N ≈ 5.25588
const H11=11000, T11=216.65, P11=P0*Math.pow(T11/T0,N);                                       // tropopause
const A0=661.4786;          // speed of sound at sea level ISA, kt
const KA=A0/Math.sqrt(T0);  // a = KA·√T(K) ≈ 38.968·√T kt
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ISA */
const isaTempK=hft=>{ const h=hft*FT; return h<=H11? T0-LR*h : T11; };
const isaTemp=hft=>isaTempK(hft)-273.15;
/* pressure at a pressure altitude (ft) */
function pressAt(hft){ const h=hft*FT; return h<=H11? P0*Math.pow(1-LR*h/T0,N) : P11*Math.exp(-G0*(h-H11)/(RA*T11)); }
/* pressure altitude (ft) of a pressure (hPa) */
function pressAlt(p){ if(p>=P11) return (T0/LR)*(1-Math.pow(p/P0,1/N))/FT; return (H11+RA*T11/G0*Math.log(P11/p))/FT; }
/* the altimeter: a barometer calibrated in ISA. The subscale shifts the zero to the level where the pressure equals the setting. */
const indicated=(p,setting)=>pressAlt(p)-pressAlt(setting);
const ftPerHpa=p=>{ const d=0.05; return (pressAlt(p-d)-pressAlt(p+d))/(2*d); };

/* True altitude. The real column has the ISA lapse rate shifted by dT (°C) and sea-level pressure qnh.
   z = ISA height above sea level of the pressure level (m); the hypsometric equation with T = T_isa(z)+dT gives
   true = z + dT/L · ln(T0 / (T0 − L z)): each ISA metre is stretched by T/T_isa. */
function trueFromP(p,qnh,dT){ const z=(pressAlt(p)-pressAlt(qnh))*FT; return trueFromZ(z,dT)/FT; }
function trueFromZ(z,dT){ const zz=Math.min(z,H11*0.999); let t=zz+(dT/LR)*Math.log(T0/(T0-LR*zz)); if(z>zz) t+=(z-zz)*(T11+dT)/T11; return t; }
/* inverse: pressure at a true altitude (ft) */
function pAtTrue(tft,qnh,dT){ const t=tft*FT; let z=t; for(let i=0;i<30;i++){ const f=trueFromZ(z,dT)-t, d=(trueFromZ(z+1,dT)-trueFromZ(z-1,dT))/2; const dz=f/(d||1); z-=dz; if(Math.abs(dz)<1e-6) break; }
  return pressAt(z/FT+pressAlt(qnh)); }
/* QFE: the pressure at the aerodrome (elevation in ft above sea level) */
const qfe=(elev,qnh,dT)=>pAtTrue(elev,qnh,dT);
/* rule of thumb and the ICAO cold temperature correction (Doc 8168): height above the aerodrome h, aerodrome temperature t0 (°C), elevation */
const coldRule=(h,dT)=>h*dT/10*0.04;
/* ICAO Doc 8168 cold temperature correction, h ft above the aerodrome (the altimeter setting source), aerodrome temperature t0 °C and elevation elev ft:
   ΔH = H·(15 − tₛ)/(273 + tₛ − ½·L₀·(H + Hₛₛ)) with tₛ = t0 + L₀·Hₛₛ (aerodrome temperature taken down to sea level). Zero when not colder than ISA. */
function icaoCold(h,t0,elev){ const L0=0.0019812, ts=t0+L0*elev; if(ts>=15) return 0; return h*(15-ts)/(273.15+ts-0.5*L0*(h+elev)); }

/* speeds: compressible flow (subsonic). qc = impact pressure pt − ps (hPa). */
const qcFromCas=cas=>P0*(Math.pow(1+0.2*(cas/A0)**2,3.5)-1);
const casFromQc=qc=>qc<=0?0:A0*Math.sqrt(5*(Math.pow(qc/P0+1,2/7)-1));
const machFromQc=(qc,ps)=>qc<=0?0:Math.sqrt(5*(Math.pow(qc/ps+1,2/7)-1));
const qcFromMach=(m,ps)=>ps*(Math.pow(1+0.2*m*m,3.5)-1);
const sos=tC=>KA*Math.sqrt(tC+273.15);
/* everything from CAS at a pressure altitude and ISA deviation */
function speeds(cas,pa,dT){ const ps=pressAt(pa), qc=qcFromCas(cas), M=machFromQc(qc,ps), T=isaTemp(pa)+dT, a=sos(T), tas=M*a, eas=A0*M*Math.sqrt(ps/P0),
  sigma=(ps/P0)*(T0/(T+273.15)); return {ps,qc,M,T,a,tas,eas,sigma,comp:cas-eas}; }
const tasThumb=(ias,altft)=>ias*(1+0.02*altft/1000);
/* density altitude (ft) */
function densityAlt(p,tC){ const sig=(p/P0)*(T0/(tC+273.15)); return (T0/LR)*(1-Math.pow(sig,1/(N-1)))/FT; }

/* the pitot-static system. Pressures the instruments actually see, given the faults:
   fault: 'none' | 'pitot' (inlet blocked, drain open) | 'pitotDrain' (inlet and drain blocked) | 'static' | 'both'
   trap: {pt, ps} pressures at the moment the blockage happened; alt: alternate static (cabin pressure dp below ambient). */
function sensed(o){ const {ps,pt,fault,trap,alt,altDp}=o; let s=ps, t=pt;
  if(fault==='static'||fault==='both') s=trap.ps;
  if(alt&&(fault==='static'||fault==='none'||fault==='pitot'||fault==='pitotDrain')) s=ps-(altDp??1.5);
  if(fault==='pitot') t=s;                 // the drain lets the trapped air bleed to static: the ASI drops to zero
  else if(fault==='pitotDrain'||fault==='both') t=trap.pt;
  return {ps:s,pt:t,qc:Math.max(0,t-s)}; }

/* the VSI: a capsule fed directly and a case fed through a metered leak. The case pressure lags (first order, tau s),
   so the reading is the difference between the altitude now and the lagged altitude, divided by tau. */
function vsiStep(lagAlt,altNow,dt,tau){ const k=1-Math.exp(-dt/tau); return lagAlt+(altNow-lagAlt)*k; }
const vsiRead=(lagAlt,altNow,tau)=>(altNow-lagAlt)/tau*60;

root.ADC={FT,P0,T0,LR,N,A0,clamp,isaTemp,isaTempK,pressAt,pressAlt,indicated,ftPerHpa,trueFromP,pAtTrue,qfe,coldRule,icaoCold,
  qcFromCas,casFromQc,machFromQc,qcFromMach,sos,speeds,tasThumb,densityAlt,sensed,vsiStep,vsiRead};
})(typeof window!=='undefined'?window:globalThis);
