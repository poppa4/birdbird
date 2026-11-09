/* Birdbird – hfcore.js: the pure maths behind the Human factors labs (orientation.html, humanperf.html).
   No DOM, no state. Loaded in the page as window.HFC and in Node (tests/hf.test.mjs) through vm.
   These are TEACHING models with typical values, not physiology research models:
   - the semicircular canals as a high-pass filter (time constant TAU_C) with a detection threshold (about 2 °/s, typical);
   - the otoliths, which cannot tell a tilt from a linear acceleration: the felt pitch follows θ + atan(a/g);
   - the runway picture: the pilot holds the familiar runway shape, so slope and width change the path flown by eye;
   - alertness from the two-process idea (sleep pressure S + circadian C);
   - fatigue against alcohol: the often-quoted 17 h awake ≈ 0.05 % BAC and 24 h ≈ 0.10 % (one well-known study).
   Angles in degrees, time in seconds (vestibular) or hours (fatigue). */
(function(root){
const D2R=Math.PI/180, R2D=180/Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TAU_C=6;       // s: the canal signal for a constant rotation fades with this time constant (gone in about 10–20 s)
const THR=2;         // °/s: rotation below this is typically not felt
const TAU_G=25;      // s: the slow pull of the felt vertical towards what the otoliths say (in coordinated flight: "level")
const TAU_O=2.5;     // s: how fast the otolith-based felt pitch builds up
/* one step of the canal: input rate w (°/s) and its change dw this step; returns the new canal signal */
function canalStep(c,dw,dt){ return (c+dw)*Math.exp(-dt/TAU_C); }
/* what reaches awareness: nothing below the threshold */
function felt(c,thr){ const t=thr==null?THR:thr; return Math.abs(c)<=t?0:c; }
/* felt angle: integrates the felt rate and drifts towards the otolith reference */
function feltStep(f,rateFelt,ref,dt,tau){ return f+(rateFelt-(f-ref)/(tau||TAU_G))*dt; }
/* the otoliths: a forward acceleration a (in g) feels like a nose-up tilt of atan(a) */
function somaAngle(a){ return Math.atan(a)*R2D; }
function somaStep(f,target,dt){ return target+(f-target)*Math.exp(-dt/TAU_O); }

/* ---- the vestibular simulation: one run of a scenario, sampled every dt ----
   sc: 'leans' | 'spiral' | 'soma'.  o: {rate (°/s, leans), turn (s, spiral), acc (g excess, soma), by:'feel'|'inst'} */
function simulate(sc,o){ o=o||{}; const dt=0.05, out=[]; const by=o.by||'inst';
  if(sc==='leans'){ const rate=o.rate??1, bank=o.bank??20, tIn=bank/rate, T=Math.max(70,tIn+50), tFix=tIn+10;
    let phi=0, c=0, f=0, wPrev=0, phase='roll';
    for(let t=0;t<=T+1e-9;t+=dt){ let w=0;
      if(t<tIn){ w=rate; phase='roll'; }
      else if(t<tFix){ w=0; phase='hold'; }
      else { phase='fix';
        const want=by==='feel'&&t>tFix+bank/10+2?0:null;            // after the brisk roll level: the pilot then flies by the felt bank
        if(t<tFix+bank/10) w=-10; else if(want===0) w=clamp((-f-phi)*0.5,-1.5,1.5); else w=0; }
      const dw=w-wPrev; wPrev=w; c=canalStep(c,dw,dt); f=feltStep(f,felt(c),0,dt); phi+=w*dt;
      out.push({t,real:phi,felt:f,rate:w,canal:c,phase}); }
    return {dt,rows:out,tIn,tFix}; }
  if(sc==='spiral'){ const bank=o.bank??25, turn=o.turn??40, T=turn+70, V=110, g=9.81;
    let phi=0, c=0, cr=0, f=0, fr=0, wPrev=0, rPrev=0, alt=4000, vs=0, rollIn=bank/8, tOut=rollIn+turn;
    for(let t=0;t<=T+1e-9;t+=dt){ let w=0;
      if(t<rollIn) w=8; else if(t<tOut) w=0; else if(t<tOut+bank/8) w=-8;
      else if(by==='feel'){ /* the pilot cancels the false turn he feels by rolling back in; feeling level, the bank creeps on */ w=fr<-0.05?clamp(-fr*4,0,5):(phi<60?0.6:0); }
      else w=clamp(-phi*0.8,-8,8);
      const dw=w-wPrev; wPrev=w; phi=clamp(phi+w*dt,-75,75);
      const r=g*Math.tan(phi*D2R)/(V*0.5144)*R2D;                 // turn rate (°/s) in a coordinated turn at V kt
      const dr=r-rPrev; rPrev=r; cr=canalStep(cr,dr,dt); fr=felt(cr);
      c=canalStep(c,dw,dt); f=feltStep(f,felt(c),0,dt);
      /* height: in a bank without extra back pressure the nose drops; flying by feel the descent builds (the spiral) */
      const lossTarget=by==='feel'&&t>tOut?-(Math.max(0,Math.abs(phi)-10))*90:(t>=rollIn&&t<tOut?-Math.max(0,Math.abs(phi)-25)*20:0);
      vs+= (lossTarget-vs)*(1-Math.exp(-dt/4)); alt+=vs/60*dt;
      out.push({t,real:phi,felt:f,turn:r,turnFelt:fr,alt,vs,phase:t<rollIn?'in':t<tOut?'turn':'out'}); }
    return {dt,rows:out,rollIn,tOut}; }
  /* somatogravic: a go-around at night from 1000 ft. Target pitch 15°. a = excess − sin(γ), γ = θ − α (α ≈ 5°) */
  const ex=o.acc??0.3, T=60, tgt=15, alpha=5;
  let th=-1, f=-1, V=140, h=o.h0??1000, crashed=false;
  for(let t=0;t<=T+1e-9;t+=dt){ const gam=th-alpha*(1-Math.exp(-t/2));
    const a=t<1?0:clamp(ex-Math.sin(gam*D2R)-(V-140)*0.0012,-0.5,0.8);
    const ref=th+somaAngle(Math.max(a,-0.5)); f=somaStep(f,ref,dt);
    const seen=by==='feel'?f:th, dth=clamp((tgt-seen)*0.8,-3,3); if(!crashed) th=clamp(th+dth*dt,-25,25);
    if(!crashed){ V=clamp(V+a*9.81*dt/0.5144,90,320); h+=V*0.5144*Math.sin(gam*D2R)*dt/0.3048; if(h<=0){ h=0; crashed=true; } }
    out.push({t,real:th,felt:f,acc:a,V,h,gam,crashed}); if(crashed) break; }
  return {dt,rows:out,tgt,T}; }

/* ---- the runway picture ----
   A pilot holds the familiar shape of the runway: its depth-to-width ratio ∝ L·sin(γ + s)/W, learnt on a flat runway of width W0 on a 3° path.
   s: runway slope (° , + up away from you), w: width (m). Returns the path angle flown by eye (°). */
function eyeAngle(s,w,w0,g0){ w0=w0||45; g0=g0||3; const x=Math.sin(g0*D2R)*w/w0; return Math.asin(clamp(x,-1,1))*R2D-s; }
const pct2deg=p=>Math.atan(p/100)*R2D;
/* black hole: typical shape of the path flown by eye over unlit ground (sags below the 3° path several miles out, after night-approach studies). d in NM, returns height in ft */
function blackHoleH(d){ const base=d*1852*Math.tan(3*D2R)/0.3048; return base*(1-0.55*Math.exp(-Math.pow((d-4.5)/2.2,2)))*(d<0.5?1:1); }
/* PAPI: lights from left, true = white. Typical transition angles 2.5°, 2.83°, 3.17°, 3.5° on a 3° path */
function papi(angle){ return [3.5,3.17,2.83,2.5].map(x=>angle>x); }

/* ---- fatigue: sleep pressure and the body clock ---- */
const TW=18.2, TS=4.2, CAMP=0.12, CPEAK=16.8;
function circ(h){ return CAMP*Math.cos(2*Math.PI*(h-CPEAK)/24); }
/* S after s hours awake starting from S0, and after s hours asleep */
function sWake(S0,h){ return 1-(1-S0)*Math.exp(-h/TW); }
function sSleep(S0,h){ return S0*Math.exp(-h/TS); }
/* the S level at bedtime: 0.70 after a normal day, more with sleep debt (nights of short sleep before) */
function sBed(debt){ return clamp(0.70+0.07*(debt||0),0,0.97); }
/* alertness index 0–1 (teaching scale): 1 − S + C */
function alert(S,h){ return clamp(1-S+circ(h),0,1); }
/* hours awake → equivalent blood alcohol (%), typical (17 h ≈ 0.05 %, 24 h ≈ 0.10 %) */
function bacEq(hAwake){ return Math.max(0,(hAwake-10)*0.05/7); }
/* a day plan: bed at clock hour b, sleep for sl hours, debt nights; duty from report r (clock, after waking) for len hours.
   Returns samples every 0.25 h over 36 h from bedtime, plus the duty statistics. */
function day(o){ const b=o.bed??23, sl=o.sleep??8, debt=o.debt||0, r=o.report??8, len=o.len??10;
  const wake=b+sl; let rep=r; while(rep<wake) rep+=24; const end=rep+len, H=Math.max(36,end-b+4), rows=[];
  const S0=sBed(debt), Sw=sSleep(S0,sl);
  let minA=1, minAt=rep, wocl=0;
  for(let k=0;k<=H*4;k++){ const t=b+k/4; const asleep=t<wake; const S=asleep?sSleep(S0,t-b):sWake(Sw,t-wake), clock=((t%24)+24)%24;
    const A=asleep?null:alert(S,clock), onDuty=t>=rep&&t<=end; rows.push({t,clock,S,A,asleep,onDuty});
    if(onDuty&&A!=null){ if(A<minA){ minA=A; minAt=t; } if(clock>=2&&clock<6) wocl+=0.25; } }
  return {rows,wake,rep,end,minA,minAt,awakeEnd:end-wake,bac:bacEq(end-wake),wocl:Math.min(wocl,len),Sw}; }
const zone=A=>A>=0.5?'ok':A>=0.3?'low':'high';

/* ---- workload against capacity through a flight ----
   o: {wx:'good'|'poor', brief:bool, hand:bool, fatigue:0|1|2, change:bool (late runway change), startle:bool}
   Returns samples over a normalised flight (0–100) with demand and capacity, and the phases. */
const PH=[['pre',0,8,32],['taxi',8,14,38],['to',14,20,74],['climb',20,32,48],['cruise',32,58,18],['desc',58,72,44],['app',72,90,66],['ldg',90,100,78]];
function workload(o){ o=o||{}; const rows=[];
  const capBase=86-(o.fatigue===1?12:o.fatigue===2?26:0);
  /* the demand of each phase with the modifiers, then blended smoothly between phases */
  const dem=PH.map(([k,,,base])=>{ let d=base; const air=k!=='pre'&&k!=='taxi';
    if(o.wx==='poor'){ if(k==='to'||k==='app'||k==='ldg') d+=16; else if(k==='desc'||k==='climb') d+=8; }
    if(o.hand&&air) d+=10;
    if(o.brief){ if(k==='app'||k==='ldg') d-=16; if(k==='desc'||k==='to') d-=6; if(k==='pre') d+=6; }
    return d; });
  for(let i=0;i<=400;i++){ const x=i/4; const ph=PH.find(p=>x>=p[1]&&x<p[2])||PH[PH.length-1];
    let d=0, wsum=0; PH.forEach((p,j)=>{ const c=(p[1]+p[2])/2, wdt=(p[2]-p[1])/2, k=Math.exp(-Math.pow(Math.max(0,Math.abs(x-c)-wdt+1.5)/2.6,2)); d+=dem[j]*k; wsum+=k; }); d/=wsum;
    if(o.brief) d+=10*Math.exp(-Math.pow((x-52)/4,2));                       // the briefing, done in the cruise
    if(o.change&&x>=76&&x<88) d+=(o.brief?10:24)*Math.sin(Math.PI*(x-76)/12);   // a crew that has planned asks for time: a smaller surge
    let cap=capBase;
    if(o.startle){ const s=81; if(x>=s){ const k=Math.exp(-(x-s)/2.2); d+=38*k; cap-=34*k; } }
    rows.push({x,d:clamp(d,0,110),cap,ph:ph[0]}); }
  let over=0, under=0, minSpare=100; for(const r of rows){ const sp=r.cap-r.d; if(sp<0) over+=0.25; if(r.d<25) under+=0.25; if(sp<minSpare) minSpare=sp; }
  return {rows,over,under,minSpare,phases:PH}; }
/* the inverted U (arousal → performance): x 0–1 */
function yd(x){ return Math.exp(-Math.pow((x-0.55)/0.27,2)); }

root.HFC={D2R,R2D,clamp,TAU_C,THR,TAU_G,TAU_O,canalStep,felt,feltStep,somaAngle,somaStep,simulate,eyeAngle,pct2deg,blackHoleH,papi,
  circ,sWake,sSleep,sBed,alert,bacEq,day,zone,PH,workload,yd};
})(typeof window!=='undefined'?window:globalThis);
