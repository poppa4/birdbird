/* Birdbird – classic Cessna 172 (typical 172P-like, 160 hp carburetted, fixed-pitch propeller) systems model.
   Pure logic, no DOM: used by c172.html and by tests/c172core.test.mjs.
   Engine: throttle → induction air, mixture → fuel/air ratio, carburettor heat and carburettor ice, two magnetos,
   priming and starting, fixed-pitch propeller rpm from the power balance with the airspeed, oil, EGT and fuel flow.
   Electrical: 28 V alternator and 24 V battery, split ALT/BAT master, ammeter and LOW VOLTAGE light.
   Vacuum: engine-driven pump, suction gauge, attitude and heading gyros that spin down and drift after a failure.
   Also the magnetic compass (turning and acceleration errors) and the two wing tanks.
   Numbers are typical teaching values, not certified data. */
(function(root){
'use strict';
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const smooth=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const wrap360=a=>{ a%=360; return a<0?a+360:a; };
const wrap180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const sigma=(altFt,dT)=>{ const h=altFt*0.3048, T=288.15-0.0065*h+(dT||0), p=Math.pow(1-0.0065*h/288.15,5.2559); return p*288.15/T; };
const cToF=c=>c*9/5+32;

/* ---------- typical numbers (KIAS unless stated) ---------- */
const LIM={ rpmMax:2700, rpmGreen:[2100,2700], oilT:[100,245], oilP:{min:25,green:[60,90],max:115}, suction:[4.5,5.4],
  magDrop:125, magDiff:50, runup:1700, idle:[600,700], fuelUsable:40, fuelTotal:43, hp:160,
  V:{s0:33,s1:44,r:55,x:60,y:76,g:65,a:99,fe10:110,fe:85,no:127,ne:158} };

/* ---------- engine ---------- */
const K={ Kp:1.307, Vz:200, fric:0.06, idleAir:0.09, inertia:0.55 };
function thrCurve(t){ t=clamp(t,0,1); return 1-Math.pow(1-t,1.6); }
/* rich-limit equivalence ratio: a float carburettor runs richer as the air thins */
const phiRich=(sig,heat)=>1.25/Math.sqrt(Math.max(sig,0.3))*(heat?1.12:1);
const mixK=m=>m<0.04?0:0.42+0.58*clamp(m,0,1);
/* combustion power factor against the equivalence ratio: best power ~1.15, peak EGT 1.0, lean misfire < 0.65, too rich > 2 */
function powF(phi){ if(phi<=0) return 0;
  const p=phi>=1.15?1-0.7*(phi-1.15)*(phi-1.15):1-1.6*(1.15-phi)*(1.15-phi);
  return Math.max(0,p)*smooth(0.56,0.68,phi)*(1-smooth(1.95,2.25,phi)); }
function engInit(run,oatC){ const o=oatC??15;
  return { run:!!run, n:run?0.24:0, oilT:run?cToF(o)+95:cToF(o), oilP:run?40:0, egt:run?1150:cToF(o), ice:0, water:0, wet:0, crankT:0, lastCrank:0, rough:0,
    bowl:30, pwr:run?0.05:0, ff:run?1.2:0, phi:1.25, air:0, dead:'', magFault:null, plug:0, fire:0, stopT:0, catchT:0, startedAt:-1, t:0, rpm:run?650:0 }; }
/* one step. i = {thr, mix, heat, mags (0 OFF,1 R,2 L,3 BOTH,4 START), starter (cranking power available), fuel (selector open and tank fuel),
   ias (kt), alt (ft), oat (°C), rh (0..1), rnd (0..1 random)} */
function engStep(e,i,dt){
  e.t+=dt; const rnd=i.rnd??Math.random();
  const sig=sigma(i.alt||0,(i.oat??15)-(15-0.0019812*(i.alt||0)));
  const heatEff=i.heat?smooth(500,1100,e.egt):0;
  /* fuel to the carburettor: the bowl holds about 30 s at cruise */
  if(i.fuel) e.bowl=Math.min(30,e.bowl+dt*3); else e.bowl=Math.max(0,e.bowl-dt*Math.max(0.25,e.ff/6));
  const fuelOK=e.bowl>0.5;
  /* carburettor ice: builds with partial throttle in humid air between about −10 and +30 °C, melts with carburettor heat */
  const risk=icingRisk(i.oat??15,i.rh??0.5,i.thr);
  if(e.run||e.n>0.15){ if(heatEff>0.2){ const m=Math.min(e.ice,dt*heatEff/18); e.ice-=m; e.water=Math.min(1,e.water+m*5); }
    else e.ice=Math.min(1,e.ice+dt*risk*(i.icing??1)/170); }
  e.water=Math.max(0,e.water-e.water*dt*0.6-dt*0.01);
  /* induction air and mixture */
  let air=sig*(K.idleAir+(1-K.idleAir)*thrCurve(i.thr));
  if(heatEff>0) air*=1-0.075*heatEff;
  air*=1-0.72*Math.pow(e.ice,1.5);
  e.air=air;
  const phi=phiRich(sig,heatEff>0.5)*mixK(i.mix)*(1+0.35*e.water); e.phi=phi;
  /* magnetos */
  const mg=i.mags; let magF=0;
  const leftOK=e.magFault!=='L', rightOK=e.magFault!=='R';
  if(mg===3||mg===4) magF=(leftOK&&rightOK)?1:(leftOK||rightOK)?0.93:0;
  else if(mg===1) magF=rightOK?0.93*(1-0.11*e.plug):0;
  else if(mg===2) magF=leftOK?0.93:0;
  if(mg>=3&&e.plug>0) magF*=1-0.015*e.plug;
  /* starting: prime and carburettor fuel must give a combustible charge while the starter turns the engine */
  const warm=smooth(70,120,e.oilT);
  const crank=i.starter&&!e.run;
  if(crank){ e.crankT+=dt; e.lastCrank=e.t; } else if(!i.starter) e.crankT=Math.max(0,e.crankT-dt*0.2);
  if(!e.run){
    const carb=fuelOK&&i.mix>0.3?(0.22+0.42*warm)*(i.thr<0.3?1:i.thr<0.6?0.6:0.35):0;
    const charge=e.wet+carb;
    e.charge=charge;
    if(crank&&e.wet>1.6&&i.thr>0.85&&i.mix<0.1) e.wet=Math.max(0,e.wet-dt*0.18); /* flooded start: clearing the cylinders */
    const turning=e.n>0.07;
    if(turning&&!e.failed&&magF>0&&charge>=0.5&&charge<=1.7){ e.fire+=dt*(0.9+rnd*0.6); if(e.fire>1.1){ e.run=true; e.dead=''; e.fire=0; e.catchT=0; e.startedAt=e.t; e.wet=Math.max(e.wet,0.4); } }
    else e.fire=Math.max(0,e.fire-dt);
    if(!turning) e.fire=0;
  }
  /* running: lose it for a reason */
  if(e.failed){ if(e.run){ e.run=false; e.dead='engine failure'; } e.fire=0; }
  if(e.run){
    e.wet=Math.max(0,e.wet-dt*0.06);
    let why='';
    if(magF===0) why='ignition off';
    else if(!fuelOK&&e.wet<0.3) why='fuel starvation';
    else if(mixK(i.mix)===0&&e.t-e.startedAt>1.5) why='mixture idle cut-off';
    else if(phi<0.58&&!(e.wet>0.3)) why='mixture too lean';
    else if(phi>2.2) why='mixture too rich';
    else if(e.ice>=0.97) why='carburettor ice';
    else if(e.n<0.13&&!crank&&e.t-e.startedAt>2) why='rpm too low';
    if(why){ e.run=false; e.dead=why; }
  }
  /* power and the propeller */
  const comb=e.run?powF(phi>0?phi:(e.wet>0.3?1.1:0)):0;
  const prime=e.run&&(!fuelOK||mixK(i.mix)===0)?Math.min(1,e.wet)*0.6:0;   // the engine runs briefly on the prime
  const pot=(e.run?air*Math.max(comb,prime?powF(1.1)*prime:0)*magF*(1-0.45*e.water):0);
  e.rough=e.run?clamp(smooth(0.5,0.9,e.ice)+e.water*1.5+(magF>0&&magF<0.95?0.25:0)+(mg===1?0.25*e.plug:0)+smooth(1.6,2.0,phi)+(1-smooth(0.62,0.78,phi)),0,1):0;
  const n=e.n, V=Math.max(0,i.ias||0);
  const peng=pot*n*(1+(e.rough>0.2?(rnd-0.5)*0.3*e.rough:0));
  const pf=K.fric*n*n+(e.run?0:0.02*n);
  const g=V>0?1-Math.pow(V/(K.Vz*Math.max(n,0.02)),2):1;
  const pabs=K.Kp*sig*n*n*n*g;
  const pst=crank&&i.starter?0.009*(1-smooth(0.08,0.13,n))*(i.starterK??1):0;
  e.pabs=pabs;
  let dn=(peng+pst-pf-pabs)/Math.max(n,0.06)/K.inertia;
  e.n=Math.max(0,n+dn*dt);
  if(!e.run&&!crank&&e.n<0.11&&V<80){ e.n=Math.max(0,e.n-dt*0.25); }  // compression stops a slow windmill
  e.rpm=e.n*2700;
  /* windmilling restart */
  if(!e.run&&!e.failed&&!crank&&e.n>0.2&&magF>0&&fuelOK&&mixK(i.mix)>0&&phi>0.65&&phi<1.9&&e.ice<0.7&&warm>0.3){ e.fire+=dt; if(e.fire>1.5){ e.run=true; e.dead=''; e.fire=0; e.startedAt=e.t; } }
  /* outputs */
  e.pwr=Math.max(0,peng);                                   // fraction of 160 hp
  e.ff=e.run?Math.max(0.6,10.4*air*e.n*phi):0;           // US gal/h
  const egtBase=1050+430*Math.sqrt(clamp(e.pwr/0.75,0,1.4));
  const egtT=e.run?egtBase-(phi>1?520*(phi-1):950*(1-phi))-160*e.water:cToF(i.oat??15)+(e.egt>300?0:0);
  e.egt+=(egtT-e.egt)*Math.min(1,dt/(e.run?6:40));
  const oilTt=e.run?cToF(i.oat??15)+75+150*clamp(e.pwr,0,1)-0.25*Math.max(0,V-60):cToF(i.oat??15);
  e.oilT+=(oilTt-e.oilT)*dt/(e.run?260:900);
  const oilPt=e.run||e.n>0.1?(e.n>0.12?22+58*smooth(0.18,0.85,e.n)+18*(1-warm):0)*(e.run?1:0.5):0;
  e.oilP+=(oilPt-e.oilP)*Math.min(1,dt/(oilPt>e.oilP?(e.t-e.startedAt<20?2.5:1):1.5));
  return e;
}
/* propeller thrust fraction for the flight model (of rated power): absorbed power, plus windmilling drag near idle */
function propThr(e,ias){ const V=Math.max(0,ias||0); return e.pabs-0.035*(V/65)*(V/65)*(1-smooth(0.02,0.16,Math.max(0,e.pabs))); }
/* carburettor icing risk 0..1: temperature band, humidity and throttle (the FAA icing chart in miniature) */
function icingRisk(oat,rh,thr){ const fT=smooth(-12,-3,oat)*(1-smooth(20,32,oat))*(oat>-3&&oat<20?1:1); const fH=smooth(0.5,0.9,rh); const fP=1.35-0.6*clamp(thr,0,1); return clamp(fT*fH*fP,0,1); }
function prime(e){ e.wet=Math.min(3,e.wet+0.32); return e.wet; }

/* ---------- electrical: 28 V alternator, 24 V battery ---------- */
function elInit(on){ return { soc:0.9, volts:0, amps:0, altOn:false, trip:false, fail:false, retrip:0, low:false, t:0, cranking:false, load:0 }; }
/* i = {bat, alt (switch halves), rpm, load (A, without the starter), starter (bool), cb (alternator breaker in)} */
function elStep(b,i,dt){
  b.t+=dt;
  const cap=14; // Ah
  const ocv=22.8+2.0*clamp(b.soc,0,1);
  const altAvail=i.bat&&i.alt&&!b.fail&&!b.trip&&i.cb!==false&&i.rpm>700;
  const altMax=altAvail?clamp((i.rpm-650)/650,0,1)*60:0;
  let load=(i.load||0)+(i.starter&&i.bat?95:0);
  b.load=load;
  if(!i.bat){ b.volts=0; b.amps=0; b.altOn=false; b.low=false; return b; }
  if(altAvail&&altMax>load){
    b.altOn=true; b.volts=28.2;
    const chg=Math.min(altMax-load,2+40*Math.pow(1-clamp(b.soc,0,1),1.2)); b.amps=chg; b.soc=Math.min(1,b.soc+chg*dt/3600/cap);
  } else {
    b.altOn=false; const deficit=load-altMax; const R=0.025+0.06*(1-b.soc);
    b.volts=Math.max(0,ocv-deficit*R-(b.soc<0.15?(0.15-b.soc)*40:0)); b.amps=-deficit; b.soc=Math.max(0,b.soc-deficit*dt/3600/cap);
  }
  if(b.retrip>0&&b.altOn){ b.retrip-=dt; if(b.retrip<=0){ b.retrip=0; b.trip=true; } }
  b.low=b.volts<24.6;
  return b;
}
/* the alternator control unit resets when the master (both halves) is cycled */
function elReset(b){ if(b.trip&&!b.fail){ b.trip=false; return true; } return false; }

/* ---------- vacuum and gyros ---------- */
function vacInit(run){ return { pump:true, suction:run?5:0, ai:run?1:0, dg:run?1:0, eR:0, eP:0, dR:0, dP:0, drift:0, hdg:0, tc:0 }; }
function suctionOf(pumpOK,rpm){ return pumpOK?Math.min(5.2,5.05*(1-Math.exp(-rpm/700))):0; }
/* i = {rpm, roll, pitch, hdg, turn (deg/s), rnd} ; returns the indicated attitude and heading */
function vacStep(v,i,dt){
  v.suction=suctionOf(v.pump,i.rpm);
  const tgt=clamp((v.suction-0.5)/4.0,0,1);
  v.ai+=(tgt-v.ai)*dt/(tgt>v.ai?55:140); v.dg+=(tgt-v.dg)*dt/(tgt>v.dg?55:140);
  const rnd=i.rnd??Math.random();
  /* attitude gyro: erects at ~ 6°/min when fast; precesses and topples as it slows */
  const slow=1-smooth(0.45,0.8,v.ai);
  if(slow>0){ v.dR+=((rnd-0.5)*0.8-v.dR*0.02)*dt*slow; v.dP+=((rnd-0.48)*0.4-v.dP*0.02)*dt*slow; v.eR+=v.dR*dt*slow*1.8; v.eP+=v.dP*dt*slow*1.2; }
  const erect=0.1*smooth(0.5,0.9,v.ai); v.eR-=clamp(v.eR,-erect*dt,erect*dt); v.eP-=clamp(v.eP,-erect*dt,erect*dt);
  v.eR=clamp(v.eR,-120,120); v.eP=clamp(v.eP,-35,35);
  /* heading indicator: follows the turn while the rotor is fast, otherwise lags and wanders */
  const follow=smooth(0.3,0.75,v.dg);
  v.drift+=((rnd-0.5)*0.3)*dt*(1-follow); v.drift=clamp(v.drift,-1.5,1.5);
  v.hdg=wrap360(v.hdg+(i.turn||0)*dt*follow+(0.0028+v.drift*(1-follow))*dt);
  return { roll:i.roll+v.eR, pitch:i.pitch+v.eP, hdg:v.hdg, flagAI:v.ai<0.6, flagDG:v.dg<0.6 };
}

/* ---------- magnetic compass: northerly turning error, acceleration error, deviation, swing ---------- */
function cmpInit(h){ return { c:h||0, v:0 }; }
/* i = {hdg, bank (deg, right +), accel (kt/s), dip (deg)} */
function cmpStep(m,i,dt){
  const dip=(i.dip??72)*Math.PI/180, h=i.hdg*Math.PI/180;
  const turnErr=-Math.sin(dip)*clamp(i.bank,-45,45)*Math.cos(h)*0.9;
  const accErr=-clamp(i.accel||0,-3,3)*6*Math.sin(h);
  const dev=1.5*Math.sin(2*h)+1*Math.cos(h);
  const tgt=wrap360(i.hdg+turnErr+accErr+dev);
  const err=wrap180(tgt-m.c);
  m.v+=(err*3.2-m.v*1.6)*dt; m.c=wrap360(m.c+m.v*dt);
  return m.c;
}

/* ---------- fuel: two wing tanks and the selector valve ---------- */
const SEL=['LEFT','BOTH','RIGHT','OFF'];
function fuelStep(f,sel,ff,dt){ const use=ff*dt/3600; const s=SEL[sel];
  if(s==='OFF'||use<=0) return f;
  if(s==='BOTH'){ const a=f.L>0&&f.R>0?0.5:f.L>0?1:0; f.L=Math.max(0,f.L-use*a); f.R=Math.max(0,f.R-use*(1-a)); }
  else if(s==='LEFT') f.L=Math.max(0,f.L-use); else f.R=Math.max(0,f.R-use);
  return f; }
function fuelFeeds(f,sel){ const s=SEL[sel]; return s==='BOTH'?f.L+f.R>0.05:s==='LEFT'?f.L>0.05:s==='RIGHT'?f.R>0.05:false; }

/* ---------- run-up magneto check: judge the drops ---------- */
function magJudge(base,r,l){ const dR=base-r, dL=base-l; const ok=dR<=LIM.magDrop&&dL<=LIM.magDrop&&Math.abs(dR-dL)<=LIM.magDiff&&dR>5&&dL>5;
  return { dR:Math.round(dR), dL:Math.round(dL), diff:Math.round(Math.abs(dR-dL)), ok, none:dR<=5||dL<=5 }; }

root.C172C={propThr,LIM,K,clamp,smooth,sigma,cToF,thrCurve,phiRich,mixK,powF,engInit,engStep,icingRisk,prime,elInit,elStep,elReset,vacInit,vacStep,suctionOf,cmpInit,cmpStep,SEL,fuelStep,fuelFeeds,magJudge,wrap360,wrap180};
})(typeof window!=='undefined'?window:globalThis);
