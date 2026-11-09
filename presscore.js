/* Birdbird – presscore.js: the pure maths behind the Pressurisation and oxygen lab (pressurisation.html).
   No DOM, no state. Loaded in the page as window.PRC and in Node (tests/press.test.mjs) through vm.
   ICAO standard atmosphere (Doc 7488): 1013.25 hPa, 15 °C, 6.5 °C/km to 11 km, then −56.5 °C.
   Units: altitudes in ft, pressures in hPa (psi only for display and ΔP), time in s unless stated. */
(function(root){
'use strict';
const FT=0.3048, P0=1013.25, T0=288.15, LR=0.0065, G0=9.80665, RA=287.05287, N=G0/(RA*LR);
const H11=11000, T11=216.65, P11=P0*Math.pow(T11/T0,N);
const HPA_PSI=68.9476, HPA_MMHG=1.333224;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

/* ISA */
function pressAt(hft){ const h=hft*FT; return h<=H11? P0*Math.pow(1-LR*h/T0,N) : P11*Math.exp(-G0*(h-H11)/(RA*T11)); }
function pressAlt(p){ if(p>=P11) return (T0/LR)*(1-Math.pow(p/P0,1/N))/FT; return (H11+RA*T11/G0*Math.log(P11/p))/FT; }
const isaTemp=hft=>{ const h=hft*FT; return (h<=H11? T0-LR*h : T11)-273.15; };
const psi=hpa=>hpa/HPA_PSI;
/* differential pressure (psi) between a cabin at cabin altitude cab and the outside at aircraft altitude h */
const dP=(cab,h)=>psi(pressAt(cab)-pressAt(h));
/* the cabin altitude that a given ΔP (psi) gives at aircraft altitude h */
const cabinFor=(h,dp)=>pressAlt(pressAt(h)+dp*HPA_PSI);

/* Generic aircraft classes (typical values, not any one type).
   dpMax: normal maximum ΔP; dpSafe: safety (positive relief) valve; dpNeg: negative relief opens below this ΔP;
   ceil: certified ceiling; cruise: typical cruise; vol: pressurised volume m³; pack: inflow kg/s;
   climb/desc: normal rates ft/min; emerg: emergency descent rate ft/min; up/dn: comfortable cabin rates ft/min. */
const CLS={
  pist:{press:false,dpMax:0,dpSafe:0,dpNeg:0,ceil:18000,cruise:9500,vol:3,pack:0,climb:700,desc:500,emerg:1500,up:0,dn:0},
  tp:{press:true,dpMax:6.4,dpSafe:6.8,dpNeg:-0.5,ceil:30000,cruise:25000,vol:30,pack:0.30,climb:1500,desc:1500,emerg:4000,up:500,dn:350},
  jet:{press:true,dpMax:8.4,dpSafe:8.9,dpNeg:-0.5,ceil:41000,cruise:37000,vol:330,pack:1.0,climb:2500,desc:2200,emerg:6000,up:500,dn:350}};

/* The cabin controller in normal flight. It plans the cruise cabin from the cruise level and the maximum ΔP,
   spreads the cabin climb over the aircraft climb and the cabin descent over the aircraft descent (so the cabin
   arrives at the landing elevation, set a little below it so the cabin is still slightly pressurised at touchdown),
   then dumps the rest on the ground. The safety valve caps ΔP at dpSafe and the negative relief valve at dpNeg.
   o: {cls, H (cruise ft), dep, dest (ft), ldg (selected landing elevation ft, default dest), cruiseMin (min)}
   returns {pts:[{t (min), h, cab, dp, vs (ft/min), ph, relief}], Ccr, tc, tcr, td, total} */
function schedule(o){ const c=CLS[o.cls], H=o.H, dep=o.dep||0, dest=o.dest||0, ldg=o.ldg==null?dest:o.ldg, crz=o.cruiseMin==null?20:o.cruiseMin;
  const Ccr=c.press? Math.max(cabinFor(H,c.dpMax),Math.min(dep,ldg)) : H;
  const tc=(H-dep)/c.climb, tcr=crz, td=(H-dest)/c.desc, tg=2, total=tc+tcr+td+tg, tgt=ldg-150, n=480, pts=[];
  for(let i=0;i<=n;i++){ const t=i/n*total; let h,cab,ph;
    if(t<tc){ h=dep+c.climb*t; ph='climb'; cab=c.press? dep+(Ccr-dep)*(h-dep)/Math.max(1,H-dep) : h; }
    else if(t<tc+tcr){ h=H; ph='cruise'; cab=c.press?Ccr:h; }
    else if(t<tc+tcr+td){ h=H-c.desc*(t-tc-tcr); ph='descent'; cab=c.press? tgt+(Ccr-tgt)*(h-dest)/Math.max(1,H-dest) : h; }
    else { h=dest; ph='ground'; const k=Math.min(1,(t-tc-tcr-td)/1); cab=c.press? pressAlt(pressAt(tgt)+(pressAt(dest)-pressAt(tgt))*k) : h; }
    let dp=dP(cab,h), relief='';
    if(c.press&&dp>c.dpSafe){ dp=c.dpSafe; cab=cabinFor(h,dp); relief='safety'; }
    if(c.press&&dp<c.dpNeg){ dp=c.dpNeg; cab=cabinFor(h,dp); relief='neg'; }
    pts.push({t,h,cab,dp,ph,relief}); }
  for(let i=0;i<pts.length;i++){ const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)]; pts[i].vs=(b.cab-a.cab)/Math.max(1e-9,b.t-a.t); }
  return {pts,Ccr,tc,tcr,td,total,ldg}; }

/* Compressible flow through an orifice of effective area A (m²), from pressure p1 to p2 (Pa), air at T (K).
   Choked (sonic) below the critical ratio 0.528. Returns kg/s, positive when p1 > p2. */
const RG=287.05, GAM=1.4, CD=0.65;
function orifice(p1,p2,A,T){ T=T||293; const s=p1>=p2?1:-1, hi=Math.max(p1,p2), lo=Math.min(p1,p2), r=lo/hi;
  const crit=Math.pow(2/(GAM+1),GAM/(GAM-1));
  const m= r<crit? CD*A*hi*Math.sqrt(GAM/(RG*T))*Math.pow(2/(GAM+1),(GAM+1)/(2*(GAM-1)))
                 : CD*A*hi*Math.sqrt(2*GAM/(RG*T*(GAM-1))*(Math.pow(r,2/GAM)-Math.pow(r,(GAM+1)/GAM)));
  return s*m; }
/* outflow valve: the open area that lets out exactly the inflow (kg/s) at the cabin and outside pressures (hPa) */
function valveArea(inflow,pc,pa){ const per=orifice(pc*100,pa*100,1); return per>1e-9? inflow/per : Infinity; }
/* time constant of a decompression (s): V / (A · c) scale, for comparing hole sizes */
const decompTau=(V,A)=>V/(CD*A*Math.sqrt(GAM*RG*293)*0.5787);

/* Decompression in cruise, then the emergency descent.
   o: {cls, H (ft), A (hole m²), react (s before the descent starts; counted from the cabin warning when afterWarn), packs (bool or fraction of the normal inflow), floor (ft, level-off), tmax (s)}
   The controller holds the planned cabin while it can (outflow valve closes); then the hole wins.
   Cabin pressure from an isothermal mass balance; the air temperature follows the expansion (isentropic)
   and is warmed back by the cabin with a time constant of 25 s. */
function decompress(o){ const c=CLS[o.cls], H=o.H, A=o.A, V=c.vol, Tc=294, floor=o.floor==null?10000:o.floor, tmax=o.tmax||900;
  const cab0=Math.max(0,cabinFor(H,c.dpMax)), pT=pressAt(cab0)*100, inflow=o.packs===false?0:typeof o.packs==='number'?c.pack*o.packs:c.pack;
  let m=pT*V/(RG*Tc), h=H, t=0, T=Tc, pPrev=pT, tEnd=null, t10=null, t14=null, peak=cab0, teq=null, above14=0, above10=0, Tmin=Tc;
  const dp0=pT-pressAt(H)*100, out=[];
  while(t<tmax){ const dt=t<2?0.002:t<30?0.01:0.1;
    const pa=pressAt(h)*100; let pc=m*RG*Tc/V;
    m+=(inflow-orifice(pc,pa,A,Tc))*dt; pc=m*RG*Tc/V;
    if(pc>pT){ pc=pT; m=pc*V/(RG*Tc); }                      // outflow valve keeps the planned cabin
    if(pc<pa){ pc=pa; m=pc*V/(RG*Tc); }
    T=T*Math.pow(pc/pPrev,(GAM-1)/GAM); T+=(Tc-T)*(1-Math.exp(-dt/25)); pPrev=pc; if(T<Tmin) Tmin=T;
    const ca=pressAlt(pc/100);
    if(ca>peak) peak=ca; if(ca>10000&&t10===null) t10=t; if(ca>14000&&t14===null) t14=t; if(ca>14000) above14+=dt; if(ca>10000) above10+=dt;
    if(teq===null&&(pc-pa)<0.1*dp0) teq=t;
    const tGo=o.afterWarn?(t10===null?Infinity:t10+o.react):o.react; if(t>tGo&&h>floor){ const ramp=Math.min(1,(t-tGo)/15); h=Math.max(floor,h-c.emerg/60*ramp*dt); }
    if(h<=floor&&tEnd===null) tEnd=t;
    if(!out.length||t-out[out.length-1].t>=(t<2?0.01:t<30?0.1:1)) out.push({t,h,cab:ca,dp:(pc-pa)/100/HPA_PSI,T:T-273.15});
    t+=dt; if(tEnd!==null&&t>tEnd+60) break; }
  out.push({t,h,cab:pressAlt(Math.max(pressAt(h),m*RG*Tc/V/100)),dp:0,T:T-273.15});
  const kind= peak<cab0+300? 'held' : teq!==null&&teq<0.5? 'explosive' : teq!==null&&teq<60? 'rapid' : 'slow';
  return {out,cab0,peak,t10,t14,teq,tEnd,above14,above10,Tmin:Tmin-273.15,kind,end:t,inflow}; }
/* the equivalent hole (m²) that a pack inflow can just hold at a given ΔP: below this a leak is absorbed */
function holdArea(cls,H){ const c=CLS[cls], cab=cabinFor(H,c.dpMax); return valveArea(c.pack,pressAt(cab),pressAt(H)); }

/* Hypoxia. Alveolar gas equation: PAO2 = FiO2·(PB − 47) − PaCO2·(FiO2 + (1 − FiO2)/R), R = 0.8.
   Breathing air at altitude you hyperventilate, so PaCO2 falls (acute values); on 100 % oxygen it stays near 40. */
const PCO=[[0,40],[5000,38],[10000,35],[15000,32],[20000,29],[25000,26],[30000,24],[45000,22]];
function paco2(h,fio2){ if(fio2>=0.99) return 40; for(let i=1;i<PCO.length;i++) if(h<=PCO[i][0]){ const [a,va]=PCO[i-1],[b,vb]=PCO[i]; return va+(vb-va)*(h-a)/(b-a); } return 22; }
const pb=h=>pressAt(h)/HPA_MMHG;                                  // barometric pressure, mmHg
const pio2=(h,f)=>f*(pb(h)-47);
function pao2(h,f){ f=f==null?0.2095:f; const c=paco2(h,f); return Math.max(0,pio2(h,f)-c*(f+(1-f)/0.8)); }
const sat=po2=>po2<=0?0:100/(23400/(po2*po2*po2+150*po2)+1);          // Severinghaus
/* the altitude on air that gives the same alveolar oxygen */
function eqAir(pa){ let lo=-2000,hi=50000; for(let i=0;i<50;i++){ const m=(lo+hi)/2; if(pao2(m)>pa) lo=m; else hi=m; } return (lo+hi)/2; }
/* diluter-demand crew mask (N): mixes in just enough oxygen to keep the inspired oxygen at the sea-level value */
const diluter=h=>clamp(0.2095*(P0/HPA_MMHG-47)/(pb(h)-47),0.2095,1);
/* time of useful consciousness, typical, at rest (s). Halved after a rapid decompression. */
const TUC=[[15000,1800],[18000,1500],[22000,450],[25000,240],[28000,165],[30000,90],[35000,45],[40000,18],[43000,10],[50000,10]];
function tuc(h,rapid){ if(h<TUC[0][0]) return null; let v=10; for(let i=1;i<TUC.length;i++) if(h<=TUC[i][0]){ const [a,ta]=TUC[i-1],[b,tb]=TUC[i], f=(h-a)/(b-a); v=Math.exp(Math.log(ta)+(Math.log(tb)-Math.log(ta))*f); break; } return rapid?v/2:v; }
/* stage of hypoxic hypoxia by (equivalent) altitude */
const stage=h=>h<10000?'ind':h<15000?'comp':h<20000?'dist':'crit';

/* EASA oxygen requirements (Air OPS), simplified to who must have oxygen at a cabin pressure altitude.
   rule: 'catnp' CAT.IDE.A.240 (non-pressurised), 'catp' CAT.IDE.A.235 (pressurised), 'nco' NCO.OP.190(b).
   mins: how long the cabin has been above 10 000 ft (min). Returns {crew, pax} with pax in % of passengers. */
function o2Rule(rule,cab,mins){ mins=mins||0;
  if(rule==='catnp'){ if(cab>13000) return {crew:true,pax:100}; if(cab>10000) return {crew:true,pax:mins>30?10:0}; return {crew:false,pax:0}; }
  if(rule==='catp'){ if(cab>15000) return {crew:true,pax:100}; if(cab>14000) return {crew:true,pax:30}; if(cab>13000) return {crew:true,pax:mins>30?10:0};
    if(cab>10000) return {crew:mins>30,pax:mins>30?10:0}; return {crew:false,pax:0}; }
  if(cab>13000) return {crew:true,pax:100}; if(cab>10000) return {crew:mins>30,pax:0}; return {crew:false,pax:0}; }

root.PRC={FT,P0,HPA_PSI,HPA_MMHG,CLS,clamp,pressAt,pressAlt,isaTemp,psi,dP,cabinFor,schedule,orifice,valveArea,decompTau,decompress,holdArea,
  paco2,pb,pio2,pao2,sat,eqAir,diluter,tuc,stage,o2Rule};
})(typeof window!=='undefined'?window:globalThis);
