/* Birdbird – cgmodel.js: the "CG and mass" master model on stability.html.
   One side view of an illustrative twin-jet (own design), with live forces, an enlarged MAC ruler,
   phases (cruise, take-off rotation, landing flare), presets, six outcome gauges, a draggable
   mass/CG envelope, the "what sets the limits" chart, the Understand diagram and the Try tasks.
   Physics come from stab.js (STAB): two-surface trim (L_wing + L_tail = W, moments about the CG),
   stall with the tail load at CLmax, induced drag ∝ CL², range ∝ 1/drag at constant Mach.
   Illustrative A320-size teaching values, not AFM / FCOM data. */
(function(){
'use strict';
const S=window.STAB, AC=S.AC, I=S.INK, D2R=S.D2R;
const {L,nf,el}=LAB, txt=S.txt, arrow=S.arrow;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const OEW=42, MTOW=78, MLW=66, MZFW=62.5, WB=12.64, GE=0.6, TSFC=0.0625, RHO=S.isa(35000).rho;
const ZG=-4.3, ZCG=-0.4;                         // ground and CG height, m from the fuselage centreline
const TSA=11.7;                                  // tail-strike pitch angle on the ground, deg (illustrative)
const ST={m:64,h:28,ph:'cr',lab:false,td:false};
const hooks=[]; const changed=()=>hooks.forEach(f=>f());
const K={ok:'#71CC93',cau:'#F0B440',bad:'#EC5A47',nav:'#1D3A5C',mag:'#E46BAE',magD:'#9A1E68'};
const pm=(v,d)=>(v>0.0001?'+':v<-0.0001?'−':'±')+nf(Math.abs(v),d==null?1:d);
const isInstr=()=>document.body.classList.contains('depth-instructor');

/* ---------------- model ---------------- */
function calc(){
  const m=ST.m, h=ST.h/100, ph=ST.ph, conf=ph==='cr'?'clean':ph==='to'?'conf1':'full';
  const env=S.envelope(m), inEnv=ST.h>=env.fwd-1e-6&&ST.h<=env.aft+1e-6;
  const vs=S.stall(m,h,conf).Vs, vs25=S.stall(m,.25,conf).Vs, vs64=S.stall(64,h,conf).Vs;
  const vsLo=S.stall(OEW,.60,conf).Vs, vsHi=S.stall(MTOW,.05,conf).Vs;
  const cr=S.cruise(m,h,35000,.78), c25=S.cruise(m,.25,35000,.78), c64=S.cruise(64,h,35000,.78);
  const tas=cr.V/S.KT, sr=tas/(TSFC*cr.D/1000), sr25=tas/(TSFC*c25.D/1000), sr64=tas/(TSFC*c64.D/1000);
  const sm=(S.hn-h)*100, hm=S.hm(m,RHO), perg=S.perG(m,h,cr.q,RHO), sfg=m*(hm-h)/(64*(S.hm(64,RHO)-.15));
  const fl=S.flare(m,h,GE), to=S.takeoff(m,h), nw=(AC.xmg-h*AC.c)/WB;
  const q=ph==='cr'?cr.q:0.5*S.R0*Math.pow((ph==='to'?to.V2:fl.Vapp)*S.KT,2);
  const t=ph==='cr'?cr.t:S.trim({m,h,q,conf});
  const rr=Math.max(1.4,3*(1+4*(S.takeoff(64,.28).frac-to.frac)));   // rotation rate for the same stick input, deg/s (illustrative)
  return {m,h,ph,conf,env,inEnv,vs,vs25,vs64,vsLo,vsHi,cr,sr,sr25,sr64,dR:(sr/sr25-1)*100,dRm:(sr/sr64-1)*100,tas,
    sm,hm:hm*100,perg,sfg,fl,to,nw,t,rr,tip:nw<=0,flOut:fl.frac>1};
}
const ENVM=[]; for(let m=OEW;m<=MTOW+1e-9;m+=0.5) ENVM.push(m);

/* ---------------- geometry (s: m aft of LEMAC, z: m up from the fuselage centreline) ---------------- */
const FUS={top:[[-17.75,-0.30],[-17.5,0.55,-16.6,1.25,-15.2,1.70],[-13.6,2.0,-12,1.98,-11,1.98],[9.5,1.98],[13.5,1.9,17.5,1.35,20.3,0.78]],
  bot:[[20.4,0.42],[17.8,-0.35,15.2,-1.12,12.3,-1.65],[10.5,-1.98,9,-1.98,8,-1.98],[-12.5,-1.98],[-15.6,-1.95,-17.3,-1.35,-17.75,-0.30]]};
const XMG=AC.xmg, XNG=AC.xmg-WB;

/* ---------------- shared canvas helpers ---------------- */
function pill(g,s,x,y,o){ o=o||{}; const fs=o.size||11; g.font=(o.w||600)+' '+fs+'px '+(o.mono?S.FONT.mono:S.FONT.body);
  const w=g.measureText(s).width+12, h=fs+8, x0=o.al==='right'?x-w:o.al==='center'?x-w/2:x;
  g.fillStyle=o.bg||'rgba(13,20,27,.88)'; g.strokeStyle=o.bd||o.col||I.rule; g.lineWidth=1;
  g.beginPath(); g.roundRect?g.roundRect(x0,y-h/2,w,h,h/2):g.rect(x0,y-h/2,w,h); g.fill(); g.stroke();
  g.fillStyle=o.col||I.ink; g.textAlign='left'; g.textBaseline='middle'; g.fillText(s,x0+6,y+0.5); g.textBaseline='alphabetic'; return {x0,w}; }
function dim(g,x0,x1,y,col,label,o){ o=o||{}; g.strokeStyle=col; g.fillStyle=col; g.lineWidth=1.2; g.setLineDash(o.dash||[]);
  g.beginPath(); g.moveTo(x0,y); g.lineTo(x1,y); g.stroke(); g.setLineDash([]);
  [x0,x1].forEach(x=>{ g.beginPath(); g.moveTo(x,y-5); g.lineTo(x,y+5); g.stroke(); });
  if(label) txt(g,label,(x0+x1)/2,y+(o.below?14:-6),{mono:1,col,al:'center',size:o.size||10.5}); }

/* ---------------- the aircraft ---------------- */
function drawAircraft(g,Q,sc,o){
  const P=(s,z)=>Q(s,z);
  const path=(pts)=>{ g.beginPath(); pts.forEach((p,i)=>{ const a=P(p[0],p[1]); i?g.lineTo(a[0],a[1]):g.moveTo(a[0],a[1]); }); };
  // far wing and far engine (behind the fuselage), darker
  g.fillStyle='#22313D'; path([[-3.2,-1.2],[6.8,0.15],[8.2,0.2],[2.9,-1.15]]); g.closePath(); g.fill();
  // fin
  const fin=[[10.6,1.85],[16.5,7.35],[18.55,7.35],[19.9,1.0]];
  const fg=g.createLinearGradient(...P(12,1.5),...P(18,7.3)); fg.addColorStop(0,'#1F3B5E'); fg.addColorStop(1,'#16304F');
  g.fillStyle=fg; path(fin); g.closePath(); g.fill(); g.strokeStyle='#365A80'; g.lineWidth=1; g.stroke();
  // magenta swoosh on the fin
  g.save(); path(fin); g.closePath(); g.clip();
  g.fillStyle='rgba(228,107,174,.9)'; g.beginPath(); { const a=P(12.2,1.9),b=P(15.8,3.9),c=P(18.8,6.2),d=P(19.6,5.6),e=P(16.6,3.3),f=P(13.6,1.9);
    g.moveTo(...a); g.quadraticCurveTo(...b,...c); g.lineTo(...d); g.quadraticCurveTo(...e,...f); g.closePath(); g.fill(); }
  g.fillStyle='rgba(228,107,174,.28)'; g.beginPath(); { const a=P(14.4,1.9),b=P(17.4,3.4),c=P(19.9,4.7),d=P(19.9,4.1),e=P(17.8,2.8),f=P(15.8,1.9);
    g.moveTo(...a); g.quadraticCurveTo(...b,...c); g.lineTo(...d); g.quadraticCurveTo(...e,...f); g.closePath(); g.fill(); }
  g.restore();
  // rudder hinge line
  g.strokeStyle='rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(...P(17.2,7.2)); g.lineTo(...P(18.6,1.45)); g.stroke();
  // fuselage
  const fp=()=>{ g.beginPath(); const a=P(...FUS.top[0]); g.moveTo(a[0],a[1]);
    for(const seg of [...FUS.top.slice(1),...FUS.bot]){ if(seg.length===2) g.lineTo(...P(seg[0],seg[1])); else g.bezierCurveTo(...P(seg[0],seg[1]),...P(seg[2],seg[3]),...P(seg[4],seg[5])); } g.closePath(); };
  const top=P(0,2), bot=P(0,-2), gr=g.createLinearGradient(top[0],top[1],bot[0],bot[1]);
  gr.addColorStop(0,'#FFFFFF'); gr.addColorStop(0.45,'#E9EEF2'); gr.addColorStop(0.78,'#BCC7D0'); gr.addColorStop(1,'#8E9CA8');
  fp(); g.fillStyle=gr; g.fill(); g.strokeStyle='rgba(16,23,29,.55)'; g.lineWidth=1; g.stroke();
  // belly in navy below the cheatline
  g.save(); fp(); g.clip();
  g.fillStyle='rgba(29,58,94,.92)'; path([[-18,-1.15],[22,-0.15],[22,-3],[-18,-3]]); g.closePath(); g.fill();
  g.strokeStyle=K.mag; g.lineWidth=Math.max(1.2,sc*0.11); g.beginPath(); g.moveTo(...P(-18,-0.95)); g.lineTo(...P(22,0.05)); g.stroke();
  g.restore();
  // cockpit windows
  g.fillStyle='#1A2632'; path([[-16.55,0.72],[-15.35,1.32],[-14.55,1.32],[-14.6,0.78]]); g.closePath(); g.fill();
  g.strokeStyle='rgba(255,255,255,.35)'; g.lineWidth=0.8; g.beginPath(); g.moveTo(...P(-15.4,1.30)); g.lineTo(...P(-15.55,0.76)); g.stroke();
  // doors
  g.strokeStyle='rgba(60,78,94,.55)'; g.lineWidth=1;
  [[-13.6,0.85],[12.5,0.8]].forEach(([s,w])=>{ const a=P(s,1.45),b=P(s+w,1.45),c=P(s+w,-0.9),d=P(s,-0.9); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.stroke(); });
  // cabin windows: lit where passengers sit (the load picture follows the CG)
  const win=o.win||[]; const r=Math.max(1.1,0.13*sc);
  win.forEach(w=>{ const p=P(w.s,0.62); g.fillStyle=w.on?'#FFD58A':'#26333F'; g.beginPath(); g.ellipse?g.ellipse(p[0],p[1],r*0.85,r*1.25,o.th||0,0,7):g.arc(p[0],p[1],r,0,7); g.fill();
    if(w.on&&sc>14){ g.fillStyle='rgba(255,213,138,.18)'; g.beginPath(); g.arc(p[0],p[1],r*2.4,0,7); g.fill(); } });
  // cargo holds (below the floor): fill shows cargo
  if(sc>9){ [[-11.2,-3.2,o.cf],[4.4,10.2,o.ca]].forEach(([s0,s1,f])=>{ const a=P(s0,-0.55),b=P(s1,-0.55),c=P(s1,-1.75),d=P(s0,-1.75);
    g.strokeStyle='rgba(127,203,232,.35)'; g.setLineDash([3,3]); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.stroke(); g.setLineDash([]);
    if(f>0.01){ const e=P(s0+(s1-s0)*f,-0.55), e2=P(s0+(s1-s0)*f,-1.75); g.fillStyle='rgba(127,203,232,.22)'; g.beginPath(); g.moveTo(...a); g.lineTo(...e); g.lineTo(...e2); g.lineTo(...d); g.closePath(); g.fill(); } }); }
  // belly fairing
  g.fillStyle='rgba(142,156,168,.55)'; g.beginPath(); { const a=P(-4.2,-1.9),b=P(1,-2.55),c=P(7,-1.9); g.moveTo(...a); g.quadraticCurveTo(...b,...c); g.closePath(); g.fill(); }
  // near wing (projected), fuel inside, flaps and slats
  const wing=[[-3.5,-1.55],[6.5,-0.25],[8.0,-0.18],[2.5,-1.62]];
  const wg=g.createLinearGradient(...P(0,-1.6),...P(6,-0.2)); wg.addColorStop(0,'#C9D3DB'); wg.addColorStop(1,'#A9B6C1');
  g.fillStyle=wg; path(wing); g.closePath(); g.fill(); g.strokeStyle='rgba(16,23,29,.6)'; g.lineWidth=1; g.stroke();
  if(o.fuel>0){ g.save(); path(wing); g.closePath(); g.clip(); g.fillStyle='rgba(240,180,64,.28)';
    const f=o.fuel, a=P(-3.5,-1.55), b=P(-3.5+10*f,-1.55+1.3*f), c=P(2.5+5.5*f,-1.62+1.44*f), d=P(2.5,-1.62);
    g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.fill(); g.restore(); }
  // sharklet
  g.fillStyle='#B4C0CA'; path([[6.6,-0.25],[7.6,1.6],[8.25,1.6],[8.05,-0.18]]); g.closePath(); g.fill(); g.strokeStyle='rgba(16,23,29,.5)'; g.stroke();
  g.fillStyle=K.mag; path([[7.25,0.95],[7.6,1.6],[8.25,1.6],[8.15,0.95]]); g.closePath(); g.fill();
  if(o.flap){ const d=o.flap===2?1:0.45;
    g.fillStyle='#93A2AE'; path([[2.5,-1.62],[8.0,-0.18],[8.0+0.9*d,-0.18-0.9*d],[2.5+1.1*d,-1.62-1.25*d]]); g.closePath(); g.fill(); g.strokeStyle='rgba(16,23,29,.6)'; g.stroke();
    g.fillStyle='#93A2AE'; path([[-3.5,-1.55],[6.5,-0.25],[6.3,-0.25-0.35*d],[-3.8,-1.55-0.4*d]]); g.closePath(); g.fill(); }
  // MAC on the wing (cyan chord line at its spanwise station)
  if(o.mac){ const zm=-1.55+0.35*1.3, a=P(0,zm), b=P(AC.c,zm+0.02); g.strokeStyle=I.cyan; g.lineWidth=2.2; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
    [a,b].forEach(p=>{ g.beginPath(); g.moveTo(p[0],p[1]-4); g.lineTo(p[0],p[1]+4); g.stroke(); }); }
  // engine: pylon and nacelle
  g.fillStyle='#B8C3CC'; path([[-1.6,-1.0],[1.0,-0.85],[1.2,-1.45],[-1.4,-1.5]]); g.closePath(); g.fill();
  const ec=-2.25, er=0.95, E0=3.6, ng=g.createLinearGradient(...P(-4+E0,ec+er),...P(-4+E0,ec-er)); ng.addColorStop(0,'#F2F5F8'); ng.addColorStop(0.55,'#C9D3DB'); ng.addColorStop(1,'#8E9CA8');
  g.fillStyle=ng; g.beginPath(); { const a=P(-6.7+E0,ec+er*0.92),b=P(-3.2+E0,ec+er),c=P(-1.6+E0,ec+er*0.62),d=P(-1.0+E0,ec+0.2),e=P(-1.0+E0,ec-0.2),f=P(-1.6+E0,ec-er*0.62),h=P(-3.2+E0,ec-er),k=P(-6.7+E0,ec-er*0.92);
    g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.lineTo(...e); g.lineTo(...f); g.lineTo(...h); g.lineTo(...k); g.closePath(); g.fill(); }
  g.strokeStyle='rgba(16,23,29,.55)'; g.lineWidth=1; g.stroke(); g.strokeStyle=K.nav; g.lineWidth=Math.max(2,0.3*sc); g.beginPath(); g.moveTo(...P(-6.55+E0,ec+er*0.9)); g.lineTo(...P(-6.55+E0,ec-er*0.9)); g.stroke();
  g.fillStyle='#1F2C37'; g.beginPath(); { const a=P(-1.6+E0,ec+er*0.5),b=P(-0.6+E0,ec+0.12),c=P(-0.6+E0,ec-0.12),d=P(-1.6+E0,ec-er*0.5); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.fill(); }
  g.strokeStyle='rgba(228,107,174,.8)'; g.lineWidth=Math.max(1,0.07*sc); g.beginPath(); g.moveTo(...P(-6.2+E0,ec+er*0.95)); g.lineTo(...P(-6.2+E0,ec-er*0.95)); g.stroke();
  // horizontal stabiliser (THS) and elevator
  const piv=P(17.6,0.62), th=o.ths||0, el=o.elev||0, sx=sc;
  g.save(); g.translate(piv[0],piv[1]); g.rotate(o.th||0); g.rotate(th*D2R);
  g.fillStyle='#C3CDD6'; g.beginPath(); g.moveTo(-2.7*sx,0); g.quadraticCurveTo(-2.2*sx,-0.30*sx,-0.8*sx,-0.26*sx); g.lineTo(1.25*sx,-0.12*sx); g.lineTo(1.25*sx,0.12*sx); g.lineTo(-0.8*sx,0.22*sx); g.quadraticCurveTo(-2.2*sx,0.26*sx,-2.7*sx,0); g.fill();
  g.strokeStyle='rgba(16,23,29,.6)'; g.lineWidth=1; g.stroke();
  g.translate(1.25*sx,0); g.rotate(-el*D2R);
  g.fillStyle=o.elevCol||'#E46BAE'; g.beginPath(); g.moveTo(0,-0.13*sx); g.lineTo(1.9*sx,-0.03*sx); g.lineTo(1.9*sx,0.03*sx); g.lineTo(0,0.13*sx); g.closePath(); g.fill();
  g.restore();
  // landing gear
  if(o.gear){ const wr=0.55;
    [[XMG,-1.85,1.1],[XNG,-1.9,0.85]].forEach(([s,z0,k])=>{ const a=P(s,z0), b=P(s,ZG+wr*k); g.strokeStyle='#C3CDD6'; g.lineWidth=Math.max(2,0.22*sc); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
      g.fillStyle='#0C1218'; g.beginPath(); g.arc(b[0],b[1],wr*k*sc,0,7); g.fill(); g.strokeStyle='#4A5D6C'; g.lineWidth=Math.max(1.5,0.12*sc); g.stroke();
      g.fillStyle='#5E6D7C'; g.beginPath(); g.arc(b[0],b[1],wr*k*sc*0.35,0,7); g.fill(); }); }
}

/* window list and cargo fill for a given mass and CG: the load picture follows the CG (illustrative) */
function loadPicture(m,h){
  const pay=Math.max(0,Math.min(1,(m-OEW)/(MZFW-OEW))), fuel=Math.max(0.06,Math.min(1,(m-OEW-8)/24));
  const bias=Math.max(-1,Math.min(1,(h*100-28)/16));          // −1 forward … +1 aft
  const N=30, win=[]; for(let i=0;i<N;i++) win.push({s:-12.4+i*0.82,on:false});
  const score=w=>{ const u=(w.s+12.4)/(N*0.82); const j=Math.sin(w.s*12.9898)*0.5; return (bias>=0?-u:u)*bias*2.2+j*0.35+Math.abs(u-0.5)*0.15; };
  const n=Math.round(pay*N*0.95); win.slice().sort((a,b)=>score(a)-score(b)).slice(0,n).forEach(w=>w.on=true);
  const cg=Math.max(0,Math.min(1,pay*1.15-0.05));
  return {win, cf:Math.max(0,Math.min(1,cg*(1-bias)*0.75)), ca:Math.max(0,Math.min(1,cg*(1+bias)*0.75)), fuel};
}

/* ---------------- master canvas ---------------- */
const A={t0:performance.now(),th:0,q:0,trace:[],gust:-1,div:false,last:0,flow:[]};
for(let i=0;i<34;i++) A.flow.push({x:Math.random(),y:Math.random(),l:0.03+Math.random()*0.07,v:0.6+Math.random()*0.8});
let st=null, E=null, geo=null;
function phaseTime(){ return (performance.now()-A.t0)/1000; }

function paint(){
  if(!st||!st.w) return;
  const g=S.clear(st), W=st.w, H=st.h, n=W<560, fz=isInstr()?1.12:1, F=v=>v*fz;
  if(!E) E=calc();
  const ph=ST.ph, t=E.t, T=phaseTime();
  // layout
  const top=n?22:28, up=7.7, dn=6.4;
  const sc=Math.min(W*(n?0.88:0.74)/38.3,(H*(n?0.50:0.60)-top)/(up+dn));
  const acH=top+(up+dn)*sc, yc=top+up*sc;
  const ox=n?(W-38.3*sc)/2+17.9*sc:W*0.05+17.9*sc;
  // background
  const bg=g.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#0F1C29'); bg.addColorStop(0.62,'#142636'); bg.addColorStop(1,'#0D161E'); g.fillStyle=bg; g.fillRect(0,0,W,H);
  // attitude and position for the phase
  let th=0, piv=[E.h*AC.c,ZCG], alt=0, gear=ph!=='cr', flap=ph==='cr'?0:ph==='to'?1:2, elev=0, roll=0, msg=null, tail=false, tdTxt=null;
  if(ph==='cr'){ th=t.alpha/D2R+A.th; }
  else if(ph==='to'){
    piv=[XMG,ZG];
    if(E.tip){ th=TSA; piv=[XMG,ZG]; tail=true; msg={c:K.bad,t:L({en:'Tip-back: the CG is behind the main gear, the aircraft sits on its tail',no:'Tipper bakover: CG ligger bak hovedunderstellet, flyet setter seg på halen'})}; }
    else { const c=reduce?4.2:T%7.5, r0=1.0, rr=E.rr, pk=Math.min(TSA+1.5,8+(rr-3)*1.6), tr=(pk)/rr;
      roll=c; if(c<r0){ th=0; elev=0; } else if(c<r0+tr){ th=(c-r0)*rr; elev=Math.min(1,E.to.frac*2.4)*AC.elUp; } else { th=pk-(pk-8)*Math.min(1,(c-r0-tr)/0.8); elev=E.to.frac*1.6*AC.elUp*0.6; alt=Math.max(0,(c-r0-tr-0.3))*1.6; }
      if(alt>0) piv=[E.h*AC.c,ZG];
      if(E.h*100>E.env.aft) msg={c:K.cau,t:L({en:'Light nose: quick rotation, smaller tail clearance',no:'Lett nese: rask rotasjon, mindre haleklaring'})};
      else if(E.h*100<E.env.fwd) msg={c:K.cau,t:L({en:'Heavy nose: slow rotation, longer take-off roll',no:'Tung nese: treg rotasjon, lengre startrull'})}; }
  } else { // flare
    const c=reduce?4.6:T%7, need=E.fl.frac, ach=need<=1?1:Math.max(0.2,1-8*(need-1)), th0=2.0, thF=th0+4.2*ach;
    const h0=3.6; let hh; if(c<1.6){ hh=h0-c*0.9; th=th0; elev=0; } else if(c<4.4){ const u=(c-1.6)/2.8; hh=Math.max(0,(h0-1.6*0.9)*(1-u)*(1-u*(ach>=1?0.25:0))); th=th0+(thF-th0)*Math.min(1,u*1.4); elev=Math.min(1,need)*AC.elUp*Math.min(1,u*1.4); } else { hh=0; th=thF; elev=Math.min(1,need)*AC.elUp; }
    alt=hh; piv=[XMG,ZG]; roll=c*0.6;
    if(E.flOut) msg={c:K.bad,t:L({en:'Elevator at full travel: the nose cannot be raised enough for the flare',no:'Høyderoret står fullt ut: nesen kan ikke løftes nok i utflatingen'})};
    else if(need>0.92) msg={c:K.cau,t:L({en:'Little elevator left in the flare',no:'Lite høyderor igjen i utflatingen'})};
  }
  if(ph==='cr'&&E.sm<=0) msg={c:K.bad,t:L({en:'Unstable: CG behind the neutral point, a disturbance keeps growing',no:'Ustabilt: CG bak nøytralpunktet, en forstyrrelse fortsetter å vokse'})};
  const c=Math.cos(th*D2R), s=Math.sin(-th*D2R)*-1, sn=Math.sin(th*D2R);
  // pivot screen point: world (s,z) → screen with the aircraft level, then rotate about the pivot
  const groundY=yc-(ZG)*sc;
  const pxs=ox+piv[0]*sc, pys=yc-piv[1]*sc-alt*sc;
  const Q=(S0,Z0)=>{ const dx=(S0-piv[0])*sc, dy=-(Z0-piv[1])*sc; return [pxs+dx*Math.cos(th*D2R)-dy*Math.sin(th*D2R), pys+dx*Math.sin(th*D2R)+dy*Math.cos(th*D2R)]; };
  // scenery
  if(ph==='cr'){
    // soft clouds below
    g.save(); g.globalAlpha=0.5; for(let i=0;i<6;i++){ const x=((i*0.21+0.05-(reduce?0:T*0.012))%1.2+1.2)%1.2*W-0.1*W, y=acH-10+(i%2)*8; const cg=g.createRadialGradient(x,y,2,x,y,W*0.09); cg.addColorStop(0,'rgba(140,165,185,.16)'); cg.addColorStop(1,'rgba(140,165,185,0)'); g.fillStyle=cg; g.beginPath(); g.ellipse?g.ellipse(x,y,W*0.12,W*0.025,0,0,7):g.arc(x,y,W*0.05,0,7); g.fill(); } g.restore();
  } else {
    g.fillStyle='#0E161D'; g.fillRect(0,groundY,W,acH-groundY+8);
    g.fillStyle='#253039'; g.fillRect(0,groundY,W,Math.max(3,0.35*sc));
    g.strokeStyle='rgba(238,243,247,.55)'; g.lineWidth=Math.max(1.5,0.12*sc); g.setLineDash([3*sc,3*sc]); g.lineDashOffset=reduce?0:(T*(ph==='to'?28:22)*sc)%(6*sc);
    g.beginPath(); g.moveTo(0,groundY+Math.max(1.5,0.18*sc)); g.lineTo(W,groundY+Math.max(1.5,0.18*sc)); g.stroke(); g.setLineDash([]); g.lineDashOffset=0;
    // edge lights
    const sp=7*sc, off=reduce?0:(T*(ph==='to'?28:22)*sc)%sp; g.fillStyle='rgba(255,226,160,.8)'; for(let x=-off;x<W;x+=sp){ g.beginPath(); g.arc(x+sp,groundY+Math.max(4,0.55*sc),Math.max(1,0.09*sc),0,7); g.fill(); }
  }
  // airflow streaks (relative wind from the left)
  if(!reduce||true){ g.strokeStyle='rgba(127,203,232,.10)'; g.lineWidth=1; const spd=ph==='cr'?0.55:0.3;
    A.flow.forEach(f=>{ const x=((f.x+(reduce?0:T*spd*f.v))%1.15)*W*1.1-0.08*W, y=top+f.y*(acH-top-(ph==='cr'?0:(acH-groundY))); if(ph!=='cr'&&y>groundY-2) return; g.beginPath(); g.moveTo(x,y); g.lineTo(x+f.l*W,y); g.stroke(); }); }
  // aircraft
  const LP=loadPicture(ST.m,E.h);
  const thsDeg=Math.max(-14,Math.min(14,(t.it/D2R)*1.6));
  const elevCol=E.flOut&&ph==='fl'&&elev>=AC.elUp-0.01?K.bad:K.mag;
  drawAircraft(g,Q,sc,{gear,flap,ths:thsDeg,elev:elev,elevCol,win:LP.win,cf:LP.cf,ca:LP.ca,fuel:LP.fuel,mac:true,th:th*D2R});
  if(tail){ const p=Q(15.6,-1.55); g.fillStyle='rgba(236,90,71,.85)'; for(let i=0;i<6;i++){ const a=-Math.PI+i*0.35; g.beginPath(); g.arc(p[0]+Math.cos(a)*10,groundY-2+Math.sin(a)*4,1.6,0,7); g.fill(); } }
  // ---- forces (earth vertical), points ride with the aircraft ----
  const Wn=t.W, Wpx=Math.max(26,5.4*sc*ST.m/MTOW)*(n?1.05:1);
  const pCG=Q(E.h*AC.c,ZCG), xcp=t.cp*AC.c, pCP=Q(xcp,-1.0), pT=Q(17.6,0.62);
  const showF=!(ph==='to'&&E.tip);
  if(showF){
    // lift at CP (wing-body), drawn through the fuselage
    const Lpx=Wpx*t.Lw/Wn, pTop=Q(xcp,2.15); g.strokeStyle='rgba(127,203,232,.75)'; g.lineWidth=1.4; g.setLineDash([3,3]); g.beginPath(); g.moveTo(pCP[0],pCP[1]); g.lineTo(pTop[0],pTop[1]); g.stroke(); g.setLineDash([]);
    g.fillStyle=I.cyan; g.beginPath(); g.arc(pCP[0],pCP[1],3,0,7); g.fill();
    arrow(g,pTop[0],pTop[1],pTop[0],pTop[1]-Lpx,I.cyan,F(3.2),F(11));
    // weight at CG
    arrow(g,pCG[0],pCG[1],pCG[0],pCG[1]+Wpx,I.white,F(3.2),F(11));
    // tail force ×5
    const Tpx=t.Lt/Wn*Wpx*5, tc=t.Lt<0?K.mag:K.ok;
    if(Math.abs(Tpx)>3) arrow(g,pT[0],pT[1],pT[0],pT[1]-Tpx,tc,F(3),F(10)); else { g.fillStyle=tc; g.beginPath(); g.arc(pT[0],pT[1],3,0,7); g.fill(); }
    // CG symbol
    const r=Math.max(6,0.38*sc)*fz; g.fillStyle='#0D161E'; g.beginPath(); g.arc(pCG[0],pCG[1],r,0,7); g.fill(); g.strokeStyle=I.white; g.lineWidth=1.6; g.stroke();
    g.fillStyle=I.white; g.beginPath(); g.moveTo(pCG[0],pCG[1]); g.arc(pCG[0],pCG[1],r,-Math.PI/2,0); g.closePath(); g.fill(); g.beginPath(); g.moveTo(pCG[0],pCG[1]); g.arc(pCG[0],pCG[1],r,Math.PI/2,Math.PI); g.closePath(); g.fill();
    // thrust and drag
    if(ST.td&&ph==='cr'){ const D=E.cr.D, Dpx=Wpx*D/Wn*6, pe=Q(-3.3,-2.25), pd=Q(E.h*AC.c+0.6,2.9);
      arrow(g,pe[0],pe[1],pe[0]-Dpx,pe[1],K.cau,F(2.6),F(9)); arrow(g,pd[0],pd[1],pd[0]+Dpx,pd[1],'#B9A6F0',F(2.6),F(9));
      if(!n){ txt(g,L({en:'thrust',no:'skyvekraft'}),pe[0]-Dpx-6,pe[1]+4,{col:K.cau,al:'right',size:F(11)}); txt(g,L({en:'drag',no:'motstand'})+' '+nf(D/1000,1)+' kN',pd[0]+6+Dpx,pd[1]+4,{col:'#B9A6F0',size:F(11)}); } }
    // labels on the forces
    const fs=F(n?10.5:12);
    txt(g,(n?'L ':L({en:'Wing lift ',no:'Vingeløft '}))+nf(t.Lw/Wn*100,1)+' % W',pTop[0]+(n?5:8),pTop[1]-Lpx+(n?10:12),{col:I.cyan,size:fs});
    txt(g,(n?'W ':L({en:'Weight ',no:'Vekt '}))+nf(ST.m,1)+' t',pCG[0]+(n?5:9),pCG[1]+Wpx-2,{col:I.white,al:'left',size:fs});
    const tlab=(t.Lt<0?(n?'↓ ':L({en:'Tail down-force ',no:'Halekraft ned '})):(n?'↑ ':L({en:'Tail up-force ',no:'Halekraft opp '})))+nf(Math.abs(t.Lt)/Wn*100,1)+' % W';
    const tx=n?pT[0]-4:Q(20.9,0)[0], ty=n?Math.max(pT[1]+22,pT[1]-Tpx+12):t.Lt<0?Math.max(pT[1]+14,pT[1]-Tpx+4):Math.min(pT[1]-Tpx+4,pT[1]-10);
    txt(g,tlab,tx,ty,{col:tc,size:fs,al:n?'right':'left'});
    // tail moment arm (CG → THS) below the fuselage
    if(ph==='cr'){ const ya=pCG[1]+Wpx+(n?8:12);
      dim(g,pCG[0],pT[0],ya,'rgba(228,107,174,.75)',L({en:'tail moment arm ',no:'halens momentarm '})+nf(17.6-E.h*AC.c,1)+' m',{below:true,size:F(n?9.5:10.5)}); }
  }
  // callouts on the aircraft
  if(ST.lab&&!n&&showF&&Math.abs(A.th)<4&&!(ph==='to'&&th>3)){ const fs=F(10.5);
    const cpP=Q(xcp,-1.0); const mac0=Q(0,-1.1), mac1=Q(AC.c,-1.1);
    const lc=(x,y,x2,y2,s,col,al)=>{ g.strokeStyle=col; g.globalAlpha=0.7; g.lineWidth=1; g.beginPath(); g.moveTo(x,y); g.lineTo(x2,y2); g.stroke(); g.globalAlpha=1; pill(g,s,x2,y2,{col,size:fs,al:al||'left',w:500}); };
    lc(pCG[0]-8,pCG[1]-4,pCG[0]-0.8*W*0.12,pCG[1]-3.4*sc,L({en:'CG · centre of gravity: where the weight acts',no:'CG · tyngdepunkt: der vekten virker'}),I.white,'right');
    lc(mac0[0],mac0[1]+3,mac0[0]-2.4*sc,yc+3.3*sc,L({en:'MAC · mean aerodynamic chord',no:'MAC · midlere aerodynamisk korde'}),I.cyan,'right');
    lc(pT[0]+4,pT[1]+5,pT[0]+1.2*sc,pT[1]+5.2*sc,L({en:'THS · the tailplane balances pitch',no:'THS · haleflaten balanserer pitch'}),K.mag,'left');
  }
  // phase chip and status
  const chip=ph==='cr'?L({en:'CRUISE · FL350 · M 0.78 · CLEAN',no:'MARSJ · FL350 · M 0,78 · RENT'}):ph==='to'?L({en:'TAKE-OFF ROTATION · CONF 1+F · VR ',no:'ROTASJON VED AVGANG · CONF 1+F · VR '})+nf(E.to.VR,0)+' kt':L({en:'LANDING FLARE · CONF FULL · VAPP ',no:'UTFLATING · CONF FULL · VAPP '})+nf(E.fl.Vapp,0)+' kt';
  if(!n) txt(g,chip,14,22,{mono:1,col:I.mute,size:F(10.5)});
  else txt(g,chip,W-8,15,{mono:1,col:I.mute,al:'right',size:9});
  if(msg){ const y=n?top+26:44; pill(g,msg.t,n?8:12,y,{col:msg.c,bd:msg.c,al:'left',size:F(n?10:11.5),bg:'rgba(13,20,27,.92)'}); }
  // pitch trace (cruise)
  if(ph==='cr'&&!n&&A.trace.length>2){ const bx={x:W-206,y:80,w:190,h:74}; g.fillStyle='rgba(13,20,27,.75)'; g.fillRect(bx.x-8,bx.y-16,bx.w+14,bx.h+30); g.strokeStyle=I.rule; g.strokeRect(bx.x-8,bx.y-16,bx.w+14,bx.h+30);
    txt(g,L({en:'pitch after a gust, 8 s',no:'pitch etter vindkast, 8 s'}),bx.x-2,bx.y-3,{mono:1,col:I.mute,size:F(9.5)});
    const y0=bx.y+bx.h/2+6; g.strokeStyle=I.grid; g.beginPath(); g.moveTo(bx.x,y0); g.lineTo(bx.x+bx.w,y0); g.stroke();
    g.strokeStyle=E.sm<=0?K.bad:K.ok; g.lineWidth=1.8; g.beginPath();
    A.trace.forEach((p,i)=>{ const x=bx.x+p[0]/8*bx.w, y=y0-Math.max(-1,Math.min(1,p[1]/8))*bx.h/2; i?g.lineTo(x,y):g.moveTo(x,y); }); g.stroke(); }
  // ---------------- the enlarged MAC ----------------
  const lx0=n?6:W*0.035, lx1=W-(n?6:W*0.035), ly0=acH+(n?8:14), ly1=H-(n?6:10);
  const rx0=lx0+(n?18:44), rx1=lx1-(n?18:44), RX=p=>rx0+p/100*(rx1-rx0), PX=x=>(x-rx0)/(rx1-rx0)*100;
  const lh=ly1-ly0, kR=Math.min(1.15,lh/(n?170:196)), ry=ly0+(n?92:110)*kR, R=v=>v*kR;
  geo={ly0,ly1,rx0,rx1,PX,RX,pCG,sc,lx0,lx1};
  // fan from the MAC on the wing to the ruler
  const m0=Q(0,-1.1), m1=Q(AC.c,-1.1);
  g.fillStyle='rgba(127,203,232,.06)'; g.beginPath(); g.moveTo(m0[0],m0[1]); g.lineTo(m1[0],m1[1]); g.lineTo(RX(100),ly0); g.lineTo(RX(0),ly0); g.closePath(); g.fill();
  g.strokeStyle='rgba(127,203,232,.22)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(m0[0],m0[1]); g.lineTo(RX(0),ly0); g.moveTo(m1[0],m1[1]); g.lineTo(RX(100),ly0); g.stroke(); g.setLineDash([]);
  g.fillStyle='rgba(9,15,21,.86)'; g.strokeStyle='#26343F'; g.lineWidth=1; g.beginPath(); g.roundRect?g.roundRect(lx0,ly0,lx1-lx0,lh,8):g.rect(lx0,ly0,lx1-lx0,lh); g.fill(); g.stroke();
  const det=window.CN&&CN.full('cmMac');
  txt(g,n?L({en:'MAC enlarged · % MAC',no:'MAC forstørret · % MAC'}):L({en:'The wing chord (MAC, mean aerodynamic chord), enlarged · positions in % MAC',no:'Vingekorden (MAC, midlere aerodynamisk korde), forstørret · posisjoner i % MAC'}),lx0+10,ly0+16,{mono:1,col:I.mute,size:F(n?9:10)});
  { const e0=E.env, fwdX=ST.h<e0.fwd, aftX=ST.h>e0.aft, sc0=E.sm<=0?K.bad:(fwdX||aftX)?K.cau:K.ok;
    const st0=E.sm<=0?L({en:'behind the neutral point: unstable',no:'bak nøytralpunktet: ustabilt'}):fwdX?L({en:'ahead of the forward limit',no:'foran fremre grense'}):aftX?L({en:'behind the aft limit: too little margin',no:'bak bakre grense: for liten margin'}):L({en:'inside the limits · stable',no:'innenfor grensene · stabilt'});
    txt(g,(n?'':'CG '+nf(ST.h,1)+' % · ')+st0,lx1-10,ly0+16,{col:sc0,al:'right',size:F(n?9.5:11)}); }
  // airfoil along the chord
  const af=(p,up)=>{ const x=p/100, tk=0.12*(1.4845*Math.sqrt(x)-0.63*x-1.758*x*x+1.4215*x*x*x-0.5075*x*x*x*x), cam=0.04*(x<0.4?(2*0.4*x-x*x)/0.16:((1-0.8)+2*0.4*x-x*x)/0.36); return (cam+(up?tk:-tk)); };
  const AY=v=>ry-v*(n?110:150)*Math.min(1,(rx1-rx0)/900);
  g.beginPath(); for(let p=0;p<=100;p+=2) g[p?'lineTo':'moveTo'](RX(p),AY(af(p,true))); for(let p=100;p>=0;p-=2) g.lineTo(RX(p),AY(af(p,false))); g.closePath();
  const ag=g.createLinearGradient(0,AY(0.1),0,ry+6); ag.addColorStop(0,'rgba(201,211,219,.22)'); ag.addColorStop(1,'rgba(201,211,219,.08)'); g.fillStyle=ag; g.fill(); g.strokeStyle='rgba(201,211,219,.45)'; g.stroke();
  // zones along the chord: too nose-heavy · allowed · tail-heavy · unstable
  const e=E.env, hnP=S.hn*100;
  g.fillStyle='rgba(240,180,64,.13)'; g.fillRect(RX(0),ry-5,RX(e.fwd)-RX(0),10); g.fillRect(RX(e.aft),ry-5,RX(hnP)-RX(e.aft),10);
  g.fillStyle='rgba(236,90,71,.16)'; g.fillRect(RX(hnP),ry-5,RX(100)-RX(hnP),10);
  if(!det){ const zf=F(n?9:10.5), zy=ry-R(n?24:30);
    const Z=[[0,e.fwd,n?{en:'nose-heavy',no:'nesetungt'}:{en:'too nose-heavy',no:'for nesetungt'},K.cau],[e.fwd,e.aft,n?{en:'allowed',no:'tillatt'}:{en:'allowed CG range',no:'tillatt CG-område'},K.ok],[e.aft,hnP,n?{en:'tail-heavy',no:'haletungt'}:{en:'too tail-heavy',no:'for haletungt'},K.cau],[hnP,100,{en:'unstable',no:'ustabilt'},K.bad]];
    g.font='500 '+zf+'px '+S.FONT.body;
    Z.forEach(([a,b,t,col])=>{ const s0=L(t), w=g.measureText(s0).width, x0=RX(a), x1=RX(b); if(w+8>x1-x0) return; const cx=(x0+x1)/2, cgx0=RX(ST.h); if(Math.abs(cx-cgx0)<w/2+12&&b-a<30) return; txt(g,s0,cx,zy,{col,al:'center',size:zf,w:500}); }); }
  // envelope band
  g.fillStyle='rgba(113,204,147,.24)'; g.fillRect(RX(e.fwd),ry-5,RX(e.aft)-RX(e.fwd),10);
  g.strokeStyle='rgba(113,204,147,.9)'; g.lineWidth=1.5; [e.fwd,e.aft].forEach(v=>{ g.beginPath(); g.moveTo(RX(v),ry-9); g.lineTo(RX(v),ry+9); g.stroke(); });
  // chord line and ticks
  g.strokeStyle='#5B6B78'; g.lineWidth=1; g.beginPath(); g.moveTo(RX(0),ry); g.lineTo(RX(100),ry); g.stroke();
  const tY=ly1-(n?8:10);
  for(let p=0;p<=100;p+=10){ g.beginPath(); g.moveTo(RX(p),tY-12); g.lineTo(RX(p),tY-8); g.stroke(); if(!n||p%20===0) txt(g,p+'',RX(p),tY,{mono:1,col:I.dim,al:'center',size:F(9.5)}); }
  if(!n){ txt(g,det?'LEMAC':L({en:'leading edge',no:'forkant'}),RX(0),tY-16,{mono:1,col:I.dim,al:'center',size:F(9)}); txt(g,det?'TEMAC':L({en:'trailing edge',no:'bakkant'}),RX(100),tY-16,{mono:1,col:I.dim,al:'center',size:F(9)}); }
  const fsL=F(n?9.5:11);
  { const fsz=F(n?9:10), ls=[(n?'':L({en:'forward limit ',no:'fremre grense '}))+nf(e.fwd,1)+' %',(n?'':L({en:'aft limit ',no:'bakre grense '}))+nf(e.aft,1)+' %'];
    g.font='400 '+fsz+'px '+S.FONT.mono; const w0=g.measureText(ls[0]).width, w1=g.measureText(ls[1]).width, cg0=RX(ST.h);
    const fl=!(cg0<RX(e.fwd)-2&&cg0>RX(e.fwd)-w0-14), al=(cg0>RX(e.aft)+2&&cg0<RX(e.aft)+w1+14);
    txt(g,ls[0],fl?RX(e.fwd)-4:RX(e.fwd)+4,ry+20,{mono:1,col:K.ok,al:fl?'right':'left',size:fsz});
    txt(g,ls[1],al?RX(e.aft)-4:RX(e.aft)+4,ry+20,{mono:1,col:K.ok,al:al?'right':'left',size:fsz}); }
  // main gear (tip-back point)
  const mg=XMG/AC.c*100; if(ph!=='cr'){ g.strokeStyle='rgba(139,153,167,.7)'; g.setLineDash([2,3]); g.beginPath(); g.moveTo(RX(mg),ry-14); g.lineTo(RX(mg),ry+30); g.stroke(); g.setLineDash([]); }
  if(!n&&ph!=='cr') txt(g,L({en:'main gear',no:'hovedunderstell'}),RX(mg)+4,ry+36,{mono:1,col:I.mute,size:F(9.5)});
  // neutral point
  const npx=RX(S.hn*100); g.strokeStyle='#F08A5D'; g.lineWidth=1.8; g.setLineDash([5,3]); g.beginPath(); g.moveTo(npx,ry-R(n?50:60)); g.lineTo(npx,ry+12); g.stroke(); g.setLineDash([]);
  txt(g,det?'NP '+nf(S.hn*100,0)+' %'+(n?'':' · '+L({en:'neutral point',no:'nøytralpunkt'})):(n?'NP':L({en:'neutral point',no:'nøytralpunkt'})),npx+5,ry-R(n?40:46),{col:'#F08A5D',size:det?fsL:F(n?9:10),w:det?600:500});
  // CP with a small lift arrow
  const cpx=RX(t.cp*100), cpUp=R(n?32:38);
  if(det){ arrow(g,cpx,ry-4,cpx,ry-cpUp,I.cyan,2.4,8);
  const cpLab='CP '+nf(t.cp*100,0)+' %';
  g.font='600 '+fsL+'px '+S.FONT.body; const cpw=g.measureText(cpLab).width;
  const cpRight=cpx+cpw/2>npx-4&&cpx<npx;
  txt(g,cpLab,cpRight?cpx-6:cpx,ry-cpUp-5,{col:I.cyan,al:cpRight?'right':'center',size:fsL}); }
  // CG handle with a weight arrow, and the static margin
  const cgx=RX(ST.h), cgc=E.sm<=0?K.bad:E.inEnv?I.white:K.cau;
  arrow(g,cgx,ry+4,cgx,ry+R(n?30:34),cgc,2.4,8);
  g.fillStyle=cgc; g.beginPath(); const hs=(n?9:10)*fz; g.moveTo(cgx,ry-hs); g.lineTo(cgx+hs,ry); g.lineTo(cgx,ry+hs); g.lineTo(cgx-hs,ry); g.closePath(); g.fill();
  g.strokeStyle='#0D161E'; g.lineWidth=1.5; g.beginPath(); g.moveTo(cgx-3,ry-3); g.lineTo(cgx-3,ry+3); g.moveTo(cgx+3,ry-3); g.lineTo(cgx+3,ry+3); g.stroke();
  txt(g,'CG '+nf(ST.h,1)+' %',cgx,ry+R(n?44:52),{col:cgc,al:'center',size:F(n?11:13)});
  g.fillStyle=cgc; g.globalAlpha=0.55; [[-1,1]].forEach(()=>{ g.beginPath(); g.moveTo(cgx-hs-4,ry); g.lineTo(cgx-hs-10,ry-5); g.lineTo(cgx-hs-10,ry+5); g.closePath(); g.fill(); g.beginPath(); g.moveTo(cgx+hs+4,ry); g.lineTo(cgx+hs+10,ry-5); g.lineTo(cgx+hs+10,ry+5); g.closePath(); g.fill(); }); g.globalAlpha=1;
  // lift moment arm (CG ↔ CP)
  const arm=(t.cp-E.h)*AC.c; if(det&&Math.abs(cgx-cpx)>10){ const ay=ry-R(n?17:20), lab=(n?'':L({en:'lift arm ',no:'løftearm '}))+nf(Math.abs(arm),2)+' m', fsA=F(n?9:10);
    g.font='400 '+fsA+'px '+S.FONT.mono; const tw=g.measureText(lab).width;
    if(Math.abs(cgx-cpx)>tw+24) dim(g,cgx,cpx,ay,'rgba(127,203,232,.8)',lab,{size:fsA});
    else { dim(g,cgx,cpx,ay,'rgba(127,203,232,.8)','',{}); const lft=cpx>cgx; txt(g,lab,lft?Math.min(cgx,cpx)-8:Math.max(cgx,cpx)+8,ay+4,{mono:1,col:'rgba(127,203,232,.9)',al:lft?'right':'left',size:fsA}); } }
  // static margin bracket
  const smy=ry-R(n?62:70); const smc=E.sm<=0?K.bad:E.inEnv?K.ok:K.cau;
  if(Math.abs(npx-cgx)>4){ dim(g,cgx,npx,smy,smc,(E.sm<=0?(n?'':L({en:'negative margin ',no:'negativ margin '})):det?(n?'SM ':L({en:'static margin ',no:'statisk margin '})):(n?'':L({en:'stability margin ',no:'stabilitetsmargin '})))+nf(E.sm,1)+' %',{size:F(n?9.5:11)}); }
  // instructor hint on the stage
  geo.cgHit={x:cgx,y:ry};
}

/* ---------------- animation ---------------- */
let raf=0, vis=false;
function needsAnim(){ if(reduce) return false; return true; }
function frame(now){ raf=0; if(!vis) return;
  const dt=Math.min(0.05,(now-(A.last||now))/1000); A.last=now;
  if(ST.ph==='cr'){ const K2=90*E.sm/100, C=2.4; // θ'' = −K·SM·θ − C·θ'
    const acc=-K2*A.th-C*A.q; A.q+=acc*dt; A.th+=A.q*dt;
    if(E.sm<=0){ if(!A.div){ A.div=true; A.th=0.8; A.q=0; A.g0=now; A.trace=[]; } if(Math.abs(A.th)>16){ A.hold=(A.hold||0)+dt; A.th=Math.sign(A.th)*16; A.q=0; if(A.hold>1.2){ A.hold=0; A.th=0.8; A.q=0; A.trace=[]; A.g0=now; } } }
    else if(A.div){ A.div=false; A.th=0; A.q=0; A.trace=[]; A.g0=null; }
    if(A.g0!=null){ const tt=(now-A.g0)/1000; if(tt<=8) A.trace.push([tt,A.th]); }
  }
  paint(); raf=requestAnimationFrame(frame); }
function kick(){ if(!raf&&vis&&needsAnim()) { A.last=0; raf=requestAnimationFrame(frame); } else if(reduce) paint(); }
function gust(){ if(ST.ph!=='cr') { A.t0=performance.now(); return; } A.th=3; A.q=0; A.trace=[]; A.g0=performance.now(); kick(); }

/* ---------------- outcome gauges ---------------- */
const CARDS=['vs','rng','stab','feel','flare','rot'];
function bar(lo,hi,v,zones,ref){ const P=x=>Math.max(0,Math.min(100,(x-lo)/(hi-lo)*100));
  return `<div class="oc-bar" aria-hidden="true">${zones.map(z=>`<i class="z ${z[2]}" style="left:${P(z[0])}%;width:${Math.max(0,P(z[1])-P(z[0]))}%"></i>`).join('')}${ref!=null?`<em class="ref" style="left:${P(ref)}%"></em>`:''}<em class="cur" style="left:${P(v)}%"></em></div>`; }
function outcomes(){
  const e=E, hot={cr:['rng','stab','feel'],to:['vs','rot'],fl:['vs','flare']}[ST.ph];
  const cf=e.conf==='clean'?L({en:'clean',no:'rent'}):e.conf==='conf1'?'CONF 1+F':'CONF FULL';
  const fwdEdge=ST.h<e.env.fwd, aftEdge=ST.h>e.env.aft, c={};
  { const dCG=e.vs-e.vs25, dM=e.vs-e.vs64;
    c.vs={t:L({en:'Stall speed',no:'Steilefart'}),s:'VS1g · '+cf,v:nf(e.vs,1),u:'kt',st:fwdEdge?'cau':'ok',
      d:`${L({en:'CG',no:'CG'})} ${pm(dCG)} kt ${L({en:'vs 25 %',no:'mot 25 %'})} · ${L({en:'mass',no:'masse'})} ${pm(dM)} kt ${L({en:'vs 64 t',no:'mot 64 t'})}`,
      b:bar(e.vsLo,e.vsHi,e.vs,[[e.vsLo,e.vsHi,'n']],e.vs25),
      w:ST.h<25?L({en:'More tail down-force: the wing must lift more, so it stalls faster.',no:'Mer halekraft ned: vingen må løfte mer, så den staller ved høyere fart.'})
        :L({en:'Less tail down-force: slightly lower. Mass matters more (VS ∝ √W).',no:'Mindre halekraft ned: litt lavere. Massen betyr mer (VS ∝ √W).'})}; }
  { const tl=e.cr.t.Lt/e.cr.t.W*100;
    c.rng={t:L({en:'Range',no:'Rekkevidde'}),s:L({en:'cruise · vs 25 % MAC',no:'marsj · mot 25 % MAC'}),v:pm(e.dR),u:'%',st:e.dR<-2.5?'cau':'ok',
      d:`${nf(e.sr,0)} NM/t · ${L({en:'tail',no:'hale'})} ${tl<0?'↓':'↑'} ${nf(Math.abs(tl),1)} % W · ${L({en:'mass',no:'masse'})} ${pm(e.dRm)} % ${L({en:'vs 64 t',no:'mot 64 t'})}`,
      b:bar(-7,4,e.dR,[[-7,-2.5,'c'],[-2.5,4,'g']],0),
      w:e.dR<0?L({en:'More tail down-force → more induced (trim) drag → more fuel.',no:'Mer halekraft ned → mer indusert motstand (trimmotstand) → mer drivstoff.'})
        :L({en:'Less tail down-force → less trim drag → more range.',no:'Mindre halekraft ned → mindre trimmotstand → lengre rekkevidde.'})}; }
  { const marg=(S.hn*100-e.env.aft);
    c.stab={t:L({en:'Stability',no:'Stabilitet'}),s:L({en:'static margin, NP − CG',no:'statisk margin, NP − CG'}),v:nf(e.sm,1),u:'% MAC',st:e.sm<=0?'bad':aftEdge?'cau':'ok',
      d:`NP ${nf(S.hn*100,0)} % · ${L({en:'the aft limit keeps',no:'bakre grense gir'})} ≥ ${nf(marg,0)} %`,
      b:bar(-10,46,e.sm,[[-10,0,'r'],[0,marg,'c'],[marg,46,'g']],null),
      w:e.sm<=0?L({en:'Behind the NP: a disturbance keeps growing.',no:'Bak NP: en forstyrrelse fortsetter å vokse.'})
        :aftEdge?L({en:'Still stable, but less margin than the aft limit guarantees.',no:'Fortsatt stabilt, men mindre margin enn bakre grense garanterer.'})
        :L({en:'CG ahead of the NP: the nose returns after a gust.',no:'CG foran NP: nesen kommer tilbake etter et vindkast.'})}; }
  { const word=e.sfg<=0?L({en:'none',no:'ingen'}):e.sfg<0.3?L({en:'very light',no:'svært lett'}):e.sfg<0.65?L({en:'light',no:'lett'}):e.sfg<1.15?L({en:'firm',no:'fast'}):L({en:'heavy',no:'tung'});
    c.feel={t:L({en:'Control feel',no:'Rorfølelse'}),s:L({en:'stick force per g',no:'stikkekraft per g'}),v:word,u:'',st:e.sfg<=0.12?'bad':e.sfg<0.3||e.sfg>1.5?'cau':'ok',
      d:`${L({en:'elevator',no:'høyderor'})} ${nf(e.perg,1)}°/g · ${nf(Math.max(0,e.sfg)*100,0)} % ${L({en:'of 64 t at 15 % (classic controls)',no:'av 64 t ved 15 % (klassiske ror)'})}`,
      b:bar(-0.3,2,e.sfg,[[-0.3,0.12,'r'],[0.12,0.3,'c'],[0.3,1.5,'g'],[1.5,2,'c']],1),
      w:ST.h>=30?L({en:'Aft CG: light and quick, easy to over-control.',no:'Bakre CG: lett og kvikk, lett å overstyre.'})
        :L({en:'Forward CG: heavy, more pull for each g.',no:'Fremre CG: tungt, mer trekk for hver g.'})}; }
  { const f=e.fl.frac*100;
    c.flare={t:L({en:'Elevator in the flare',no:'Høyderor i utflatingen'}),s:L({en:'needed of available',no:'nødvendig av tilgjengelig'}),v:nf(f,0),u:'%',st:f>100?'bad':f>92?'cau':'ok',
      d:`CONF FULL · ${L({en:'THS frozen',no:'THS frosset'})} · ${nf(e.fl.elev,1)}° ${L({en:'of',no:'av'})} ${AC.elUp}°`,
      b:bar(40,120,f,[[40,92,'g'],[92,100,'c'],[100,120,'r']],100),
      w:f>100?L({en:'Out of elevator: this is why the forward limit exists.',no:'Tomt for høyderor: derfor finnes fremre grense.'})
        :L({en:'Forward CG uses up the nose-up elevator.',no:'Fremre CG bruker opp høyderoret.'})}; }
  { const nwp=e.nw*100;
    c.rot={t:L({en:'Rotation and tail',no:'Rotasjon og hale'}),s:L({en:'nose-wheel load',no:'nesehjulslast'}),v:e.tip?L({en:'tips back',no:'tipper'}):nf(nwp,1),u:e.tip?'':'% W',st:e.tip||nwp<4?'bad':aftEdge||fwdEdge?'cau':'ok',
      d:e.tip?L({en:'CG behind the main gear',no:'CG bak hovedunderstellet'}):`${L({en:'rotation',no:'rotasjon'})} ≈ ${nf(e.rr,1)}°/s ${L({en:'for the same stick input',no:'for samme stikkeutslag'})}`,
      b:bar(-3,20,nwp,[[-3,4,'r'],[4,20,'g']],null),
      w:e.tip?L({en:'CG behind the main wheels: it sits on its tail.',no:'CG bak hovedhjulene: flyet setter seg på halen.'})
        :ST.h>=32?L({en:'Light nose: quick rotation, tail-strike risk.',no:'Lett nese: rask rotasjon, fare for halenedslag.'})
        :L({en:'Heavy nose: slower rotation, longer roll.',no:'Tung nese: tregere rotasjon, lengre rull.'})}; }
  const stT={ok:L({en:'OK',no:'OK'}),cau:L({en:'Caution',no:'Obs'}),bad:L({en:'Limit',no:'Grense'})};
  el('cmOut').innerHTML=CARDS.map(k=>{ const x=c[k]; return `<li class="oc st-${x.st}${hot.includes(k)?' hot':''}" id="oc-${k}">
    <div class="oc-h"><span class="oc-t">${x.t}<small>${x.s}</small></span><span class="oc-v"><b>${x.v}</b>${x.u?` <small>${x.u}</small>`:''}</span><span class="oc-st">${stT[x.st]}</span></div>
    ${x.b}<p class="oc-w">${x.w}</p><p class="oc-d deep">${x.d}</p></li>`; }).join('');
  liveTask();
}

/* ---------------- envelope (drag the dot) and limits chart ---------------- */
let envSt=null, limSt=null;
const EX=[5,60], EY=[40,84];
function envBox(stc){ const n=stc.w<420; return {x:n?40:46,y:28,w:stc.w-(n?52:62),h:stc.h-(n?62:66)}; }
/* small multi-line label centred at (x,y) */
function lbl(g,lines,x,y,col,fs){ lines.forEach((s0,i)=>txt(g,s0,x,y+(i-(lines.length-1)/2)*(fs+2)+fs*0.35,{col,al:'center',size:fs,w:500})); }
function paintEnv(){ if(!envSt||!envSt.w) return; const g=S.clear(envSt), W=envSt.w, H=envSt.h, b=envBox(envSt), n=W<420, det=window.CN&&CN.full('cmEnv'), hnP=S.hn*100, fz=n?9.5:10.5;
  txt(g,L({en:'Mass and CG envelope · drag the dot',no:'Masse- og CG-konvolutt · dra punktet'}),10,17,{col:I.ink,size:12});
  const ax=S.axes(g,b,EX,EY,{xt:[10,20,30,40,50,60],yt:[40,50,60,70,80],xf:v=>v+'%',yf:v=>v===80?v+' t':v});
  txt(g,L({en:'CG position, % MAC →',no:'CG-posisjon, % MAC →'}),b.x+b.w,b.y+b.h+26,{mono:1,col:I.dim,al:'right',size:9.5});
  // zones: outside is tinted, the envelope is cut out of it
  g.save(); g.beginPath(); g.rect(b.x,b.y,b.w,b.h); g.clip();
  g.fillStyle='rgba(240,180,64,.07)'; g.fillRect(b.x,b.y,b.w,b.h);
  g.fillStyle='rgba(236,90,71,.10)'; g.fillRect(ax.X(hnP),b.y,b.x+b.w-ax.X(hnP),b.h); g.fillRect(b.x,b.y,b.w,ax.Y(MTOW)-b.y);
  g.restore();
  g.beginPath(); ENVM.forEach((m,i)=>{ const e=S.envelope(m); i?g.lineTo(ax.X(e.fwd),ax.Y(m)):g.moveTo(ax.X(e.fwd),ax.Y(m)); }); ENVM.slice().reverse().forEach(m=>{ const e=S.envelope(m); g.lineTo(ax.X(e.aft),ax.Y(m)); }); g.closePath();
  g.fillStyle=I.bg; g.fill(); g.fillStyle='rgba(113,204,147,.16)'; g.fill(); g.strokeStyle=K.ok; g.lineWidth=1.6; g.stroke();
  // mass lines: MTOW and OEW always, the others in the full chart
  const ML=det?[[MTOW,'MTOW'],[MLW,L({en:'MLW · max landing',no:'MLW · maks landing'})],[MZFW,L({en:'MZFW · max zero fuel',no:'MZFW · maks uten drivstoff'})],[OEW,L({en:'OEW · empty',no:'OEW · tomt'})]]:[[MTOW,'MTOW'],[OEW,L({en:'OEW · empty',no:'OEW · tomt'})]];
  ML.forEach(([m,s0])=>{ S.line(g,[[ax.X(EX[0]),ax.Y(m)],[ax.X(EX[1]),ax.Y(m)]],I.dim,1,[4,4]); txt(g,s0,ax.X(EX[1])-3,ax.Y(m)-4,{mono:1,col:I.mute,al:'right',size:9.5}); });
  S.line(g,[[ax.X(hnP),ax.Y(EY[1])],[ax.X(hnP),ax.Y(EY[0])]],'#F08A5D',1.4,[5,3]); txt(g,'NP',ax.X(hnP)-4,ax.Y(MTOW)+14,{mono:1,col:'#F08A5D',al:'right',size:10});
  if(det){ S.line(g,[[ax.X(XMG/AC.c*100),ax.Y(EY[1])],[ax.X(XMG/AC.c*100),ax.Y(EY[0])]],'rgba(139,153,167,.6)',1,[2,3]); if(!n) txt(g,L({en:'main gear',no:'hovedunderstell'}),ax.X(XMG/AC.c*100)+4,ax.Y(52),{mono:1,col:I.mute,size:9}); }
  // zone words
  const yTop=(ax.Y(EY[1])+ax.Y(MTOW))/2;
  txt(g,n?L({en:'Too heavy: above MTOW',no:'For tungt: over MTOW'}):L({en:'Too heavy: above MTOW (max take-off mass)',no:'For tungt: over MTOW (maks startmasse)'}),b.x+b.w/2-(n?14:20),yTop+4,{col:K.bad,al:'center',size:fz,w:500});
  const e46=S.envelope(46), mL=n?47:48;
  lbl(g,[L({en:'Too far',no:'For langt'}),L({en:'forward',no:'fram'})],(ax.X(EX[0])+ax.X(e46.fwd))/2,ax.Y(mL),K.cau,fz);
  lbl(g,[L({en:'Too far',no:'For langt'}),L({en:'aft',no:'bak'})],(ax.X(e46.aft)+ax.X(hnP))/2,ax.Y(mL),K.cau,fz);
  lbl(g,[L({en:'Unstable',no:'Ustabilt'})],(ax.X(hnP)+ax.X(EX[1]))/2,ax.Y(70),K.bad,fz);
  const inM=Math.abs(ax.Y(ST.m)-ax.Y(47))<26&&Math.abs(ax.X(ST.h)-ax.X(27))<60?72:47, eI=S.envelope(inM);
  lbl(g,[L({en:'Allowed',no:'Tillatt'}),L({en:'loading',no:'lasting'})],(ax.X(eI.fwd)+ax.X(eI.aft))/2,ax.Y(inM),K.ok,fz);
  // your loading
  const col=E.sm<=0?K.bad:E.inEnv?K.mag:K.cau, x=ax.X(ST.h), y=ax.Y(ST.m);
  g.strokeStyle='rgba(228,107,174,.35)'; g.lineWidth=1; g.beginPath(); g.moveTo(x,b.y+b.h); g.lineTo(x,y); g.lineTo(b.x,y); g.stroke();
  g.fillStyle=col; g.beginPath(); g.arc(x,y,8,0,7); g.fill(); g.strokeStyle='#0D161E'; g.lineWidth=2; g.stroke();
  envSt.ax=ax; envSt.b=b; }
function paintLim(){ if(!limSt||!limSt.w) return; const g=S.clear(limSt), W=limSt.w, H=limSt.h, n=W<420, b={x:n?40:46,y:28,w:W-(n?52:62),h:H-(n?62:66)}, det=window.CN&&CN.full('cmLim'), hnP=S.hn*100, fz=n?9.5:10.5;
  txt(g,L({en:'What sets the limits, at this mass',no:'Hva som setter grensene, ved denne massen'}),10,17,{col:I.ink,size:12});
  const ax=S.axes(g,b,EX,[0,120],{xt:[10,20,30,40,50,60],yt:[0,40,80,120],xf:v=>v+'%',yf:v=>v+'%'});
  txt(g,L({en:'CG position, % MAC →',no:'CG-posisjon, % MAC →'}),b.x+b.w,b.y+b.h+26,{mono:1,col:I.dim,al:'right',size:9.5});
  const e=E.env;
  g.fillStyle='rgba(240,180,64,.07)'; g.fillRect(b.x,b.y,ax.X(e.fwd)-b.x,b.h); g.fillRect(ax.X(e.aft),b.y,ax.X(hnP)-ax.X(e.aft),b.h);
  g.fillStyle='rgba(236,90,71,.10)'; g.fillRect(ax.X(hnP),b.y,b.x+b.w-ax.X(hnP),b.h);
  g.fillStyle='rgba(113,204,147,.10)'; g.fillRect(ax.X(e.fwd),b.y,ax.X(e.aft)-ax.X(e.fwd),b.h);
  S.line(g,[[ax.X(EX[0]),ax.Y(100)],[ax.X(EX[1]),ax.Y(100)]],I.dim,1,[2,3]);
  txt(g,L({en:'100 % = full nose-up elevator',no:'100 % = fullt høyderor opp'}),b.x+b.w-4,ax.Y(100)+(n?12:-5),{mono:1,col:I.mute,al:'right',size:9});
  const flv=h=>Math.min(120,S.flare(ST.m,h/100,GE).frac*100), sfv=h=>ST.m*(S.hm(ST.m,RHO)-h/100)/(64*(S.hm(64,RHO)-.15))*100;
  const fl=[], sf=[]; let hx=null; for(let h=EX[0];h<=EX[1];h+=0.5){ const f=flv(h); if(hx==null&&f<=100) hx=h; fl.push([ax.X(h),ax.Y(f)]); sf.push([ax.X(h),ax.Y(Math.max(0,Math.min(120,sfv(h))))]); }
  g.save(); g.beginPath(); g.rect(b.x,b.y,b.w,b.h); g.clip(); S.line(g,fl,K.cau,2.2); S.line(g,sf,I.cyan,2.2); g.restore();
  if(det) S.line(g,[[ax.X(hnP),b.y],[ax.X(hnP),b.y+b.h]],'#F08A5D',1.2,[4,3]);
  S.line(g,[[ax.X(ST.h),b.y],[ax.X(ST.h),b.y+b.h]],I.white,1.4);
  txt(g,L({en:'your CG',no:'din CG'}),ax.X(ST.h)+(ST.h>45?-4:4),b.y+12,{col:I.white,al:ST.h>45?'right':'left',size:9.5,w:500});
  // the two curves, named in words
  txt(g,n?L({en:'flare elevator needed',no:'høyderor for utflating'}):L({en:'elevator needed to flare',no:'høyderor som trengs for å flate ut'}),ax.X(n?33:31),ax.Y(flv(n?33:31))-8,{col:K.cau,size:n?10:11});
  { const hs=n?33:34, ys=Math.max(0,Math.min(120,sfv(hs))); txt(g,n?L({en:'stick force per g',no:'stikkekraft per g'}):L({en:'stick force per g (% of normal)',no:'stikkekraft per g (% av normal)'}),ax.X(hs)-6,ax.Y(ys)+ (n?16:18),{col:I.cyan,al:'right',size:n?10:11,bg:'rgba(16,23,29,.85)'}); }
  // where the elevator runs out, and the light-stick end
  if(hx!=null&&hx>EX[0]){ const px=ax.X(hx), py=ax.Y(100); g.fillStyle=K.bad; g.beginPath(); g.arc(px,py,4,0,7); g.fill();
    lbl(g,[L({en:'elevator',no:'høyderoret'}),L({en:'runs out',no:'tar slutt'})],px,py+(n?24:28),K.bad,fz);
    if(det&&ax.X(e.fwd)-px>14) { dim(g,px,ax.X(e.fwd),py+40,'rgba(240,180,64,.8)',L({en:'margin',no:'margin'}),{size:9}); } }
  { const px=ax.X(e.aft), py=ax.Y(Math.max(0,Math.min(120,sfv(e.aft)))); g.fillStyle=I.cyan; g.beginPath(); g.arc(px,py,4,0,7); g.fill();
    txt(g,n?L({en:'light',no:'lett'}):L({en:'stick getting light',no:'stikka blir lett'}),px-8,py+(n?15:17),{col:I.cyan,al:'right',size:fz,w:500,bg:'rgba(16,23,29,.85)'}); }
  // zone words along the bottom (the old limit notes in the full chart)
  if(det){ if(!n){ txt(g,L({en:'fwd limit: elevator runs out',no:'fremre grense: høyderoret tar slutt'}),ax.X(e.fwd)-4,b.y+b.h-8,{mono:1,col:K.ok,al:'right',size:9.5}); txt(g,L({en:'aft limit: margin and feel',no:'bakre grense: margin og følelse'}),ax.X(e.aft)+4,b.y+b.h-8,{mono:1,col:K.ok,size:9.5}); }
    txt(g,'NP',ax.X(hnP)+4,b.y+24,{mono:1,col:'#F08A5D',size:10});
    txt(g,L({en:'stick force 100 % = 64 t at 15 % MAC',no:'stikkekraft 100 % = 64 t ved 15 % MAC'}),b.x+b.w-4,ax.Y(100)+12,{mono:1,col:I.dim,al:'right',size:9}); }
  else { const zy=b.y+b.h-8, fw=g;
    const Z=[[EX[0],e.fwd,{en:'too far fwd',no:'for langt fram'},K.cau],[e.fwd,e.aft,{en:'allowed',no:'tillatt'},K.ok],[e.aft,hnP,{en:'too far aft',no:'for langt bak'},K.cau],[hnP,EX[1],{en:'unstable',no:'ustabilt'},K.bad]];
    fw.font='500 '+fz+'px '+S.FONT.body; Z.forEach(([a0,b0,t0,c0])=>{ const s0=L(t0), w0=fw.measureText(s0).width; if(w0+14>ax.X(b0)-ax.X(a0)) return; txt(g,s0,(ax.X(a0)+ax.X(b0))/2,zy,{col:c0,al:'center',size:fz,w:500}); }); }
}

/* ---------------- controls ---------------- */
let slCG, slM, phSeg;
const PRE=[
  ['fwd',{en:'Forward limit',no:'Fremre grense'},()=>({m:64,h:Math.ceil(S.envelope(64).fwd*2)/2,ph:'fl'})],
  ['aft',{en:'Aft limit',no:'Bakre grense'},()=>({m:64,h:Math.floor(S.envelope(64).aft*2)/2,ph:'cr'})],
  ['hf',{en:'Heavy and forward',no:'Tung og fremre'},()=>({m:78,h:Math.ceil(S.envelope(78).fwd*2)/2,ph:'to'})],
  ['la',{en:'Light and aft',no:'Lett og bakre'},()=>({m:46,h:Math.floor(S.envelope(46).aft*2)/2,ph:'cr'})],
  ['xa',{en:'Beyond aft limit',no:'Bak bakre grense'},()=>({m:64,h:55,ph:'cr'})],
  ['xf',{en:'Ahead of forward limit',no:'Foran fremre grense'},()=>({m:60,h:9,ph:'fl'})]];
let preOn=null;
function setState(o,keepPre){ if(o.m!=null) ST.m=Math.round(Math.max(OEW,Math.min(MTOW,o.m))*2)/2; if(o.h!=null) ST.h=Math.round(Math.max(5,Math.min(60,o.h))*2)/2; if(o.ph&&o.ph!==ST.ph){ ST.ph=o.ph; A.t0=performance.now(); A.th=0; A.q=0; A.trace=[]; A.g0=null; if(phSeg) phSeg.set(ST.ph); }
  if(!keepPre) preOn=null; update(); }
let cnEnv=null, cnMac=null;
function cnStatus(){ if(!E) return; const e=E.env, ld=nf(ST.m,1)+' t, CG '+nf(ST.h,1)+' % MAC';
  const head=L({en:'Your loading: ',no:'Lastingen din: '})+ld+': ';
  let s0, c0;
  if(E.sm<=0){ s0=L({en:'behind the neutral point. The aircraft is unstable: a disturbance keeps growing.',no:'bak nøytralpunktet. Flyet er ustabilt: en forstyrrelse fortsetter å vokse.'}); c0=K.bad; }
  else if(ST.h<e.fwd){ s0=nf(e.fwd-ST.h,1)+' % '+L({en:'ahead of the forward limit. Too nose-heavy: not enough elevator to flare or rotate.',no:'foran fremre grense. For nesetungt: ikke nok høyderor til å flate ut eller rotere.'}); c0=K.cau; }
  else if(ST.h>e.aft){ s0=nf(ST.h-e.aft,1)+' % '+L({en:'behind the aft limit. Too tail-heavy: little stability and very light controls.',no:'bak bakre grense. For haletungt: lite stabilitet og svært lette ror.'}); c0=K.cau; }
  else { s0=L({en:'inside the envelope. Legal to fly.',no:'innenfor konvolutten. Lovlig å fly.'}); c0=K.ok; }
  if(cnEnv) cnEnv.status(head+s0,c0); }
function update(){ E=calc(); cnStatus(); if(slCG) slCG.set(ST.h); if(slM) slM.set(ST.m); outcomes(); paint(); paintEnv(); paintLim(); drawPre(); drawTog(); kick(); changed(); }
function drawPre(){ const b=el('cmPre'); if(!b) return; b.innerHTML=PRE.map(([k,t])=>`<button type="button" class="btn sm${preOn===k?' on':''}" data-k="${k}">${L(t)}</button>`).join(''); }
function drawTog(){ const p=el('cmPlay'); if(p) p.textContent='▶ '+(ST.ph==='cr'?L({en:'Gust',no:'Vindkast'}):ST.ph==='to'?L({en:'Rotate again',no:'Roter igjen'}):L({en:'Flare again',no:'Flat ut igjen'}));
  const b=el('cmTog'); if(!b) return;
  b.innerHTML=`<label class="chk"><input type="checkbox" data-a="lab" ${ST.lab?'checked':''}> <span>${L({en:'Name the parts on the aircraft',no:'Navn på delene på flyet'})}</span></label>`+
   `<label class="chk"><input type="checkbox" data-a="td" ${ST.td?'checked':''} ${ST.ph!=='cr'?'disabled':''}> <span>${L({en:'Show thrust and drag (cruise)',no:'Vis skyvekraft og motstand (marsj)'})}</span></label>`; }

function legend(){ const b=el('cmLeg'); if(!b) return;
  const it=[['#EEF3F7','line',{en:'Weight at the CG',no:'Vekt i CG'}],['#7FCBE8','line',{en:'Wing lift at the CP',no:'Vingeløft i CP'}],['#E46BAE','line',{en:'Tail force (drawn ×5)',no:'Halekraft (tegnet ×5)'}],['#F08A5D','dash',{en:'NP, neutral point',no:'NP, nøytralpunkt'}],['#71CC93','band',{en:'CG limits at this mass',no:'CG-grenser ved denne massen'}],['#FFD58A','dot',{en:'Lit window = passengers',no:'Lyst vindu = passasjerer'}]];
  b.innerHTML=it.map(([c,k,t])=>`<span><i class="${k}" style="--c:${c}"></i>${L(t)}</span>`).join('');
  el('cmHint').innerHTML=(window.CN&&CN.full('cmMac')?'<b>'+L({en:'CP',no:'CP'})+'</b> '+L({en:'(centre of pressure): where the wing’s lift acts.',no:'(trykksenter): der vingeløftet virker.'})+' <b>NP</b> '+L({en:'(neutral point): with the CG here the aircraft has no stability left.',no:'(nøytralpunkt): med CG her har flyet ingen stabilitet igjen.'})+' <b>'+L({en:'Lift arm',no:'Løftearm'})+'</b> '+L({en:'(CG to CP): lift × arm is the pitch moment the tail must balance. ',no:'(CG til CP): løft × arm er pitchmomentet halen må balansere. '}):'')+L({en:'<b>What you are seeing:</b> the aircraft with its three vertical forces, and below it the wing chord (MAC) blown up so you can see where the CG sits between its limits. The distance from the CG to the NP is the static margin.',no:'<b>Det du ser:</b> flyet med de tre vertikale kreftene, og under det vingekorden (MAC) forstørret, så du ser hvor CG ligger mellom grensene. Avstanden fra CG til NP er den statiske marginen.'}); }
function init(){
  st=LAB.fit(el('cmCv'),()=>paint(),2);
  LAB.visible(el('cmCv'),v=>{ vis=v; kick(); });
  phSeg=LAB.seg(el('cmPh'),[['cr','Cruise'],['to','Take-off rotation'],['fl','Landing flare']],ST.ph,v=>setState({ph:v}));
  slCG=LAB.slider(el('cmSl'),{label:'CG position (% MAC)',hint:'Or drag the CG on the wing chord',min:5,max:60,step:0.5,v:ST.h,f:v=>nf(v,1)+' %',on:v=>{ ST.h=v; preOn=null; update(); }});
  slM=LAB.slider(el('cmSl'),{label:'Mass (t)',hint:'From empty (OEW 42 t) to MTOW 78 t',min:OEW,max:MTOW,step:0.5,v:ST.m,f:v=>nf(v,1)+' t',on:v=>{ ST.m=v; preOn=null; update(); }});
  el('cmPre').addEventListener('click',e=>{ const b=e.target.closest('button[data-k]'); if(!b) return; const p=PRE.find(x=>x[0]===b.dataset.k); preOn=p[0]; setState(p[2](),true); if(p[0]==='xa'){ A.div=false; } });
  el('cmTog').addEventListener('change',e=>{ const b=e.target.closest('[data-a]'); if(!b) return; const a=b.dataset.a;
    if(a==='lab'){ ST.lab=b.checked; paint(); } else if(a==='td'){ ST.td=b.checked; paint(); } });
  el('cmPlay').addEventListener('click',()=>{ gust(); A.t0=performance.now(); kick(); });
  // drag the CG on the stage (ruler or the CG symbol), keep vertical scrolling for touch
  const cv=el('cmCv'); let drag=null;
  cv.addEventListener('pointerdown',e=>{ if(!geo) return; const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    const onRuler=y>=geo.ly0&&x>=geo.lx0&&x<=geo.lx1, onCG=Math.hypot(x-geo.pCG[0],y-geo.pCG[1])<Math.max(22,geo.sc*1.6);
    if(!onRuler&&!onCG) return;
    drag={x0:x,h0:onRuler&&Math.abs(x-geo.cgHit.x)>24?geo.PX(x):ST.h,id:e.pointerId}; if(onRuler&&Math.abs(x-geo.cgHit.x)>24) setState({h:drag.h0});
    cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
  cv.addEventListener('pointermove',e=>{ if(!geo) return; const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    if(!drag){ const hov=(y>=geo.ly0&&x>=geo.lx0&&x<=geo.lx1)||Math.hypot(x-geo.pCG[0],y-geo.pCG[1])<Math.max(22,geo.sc*1.6); cv.style.cursor=hov?'ew-resize':''; return; }
    const pp=(geo.rx1-geo.rx0)/100; setState({h:drag.h0+(x-drag.x0)/pp}); });
  const end=()=>{ drag=null; cv.classList.remove('drag'); }; cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);
  // envelope: drag the dot in 2D
  envSt=LAB.fit(el('cmEnv'),()=>paintEnv(),2); limSt=LAB.fit(el('cmLim'),()=>paintLim(),2);
  if(window.CN){ const T=CN.t;
    cnMac=CN.add(el('cmCv'),{key:'cmMac',
      read:()=>L({en:'Top: the aircraft and its three up-down forces. Bottom: the wing chord blown up. The ◆ is the CG; the green band is where it is allowed to be.',no:'Øverst: flyet og de tre kreftene opp og ned. Nederst: vingekorden forstørret. ◆ er CG; det grønne båndet er der den får lov å være.'}),
      take:()=>L({en:'Further forward = more stable but heavier to pitch; further aft = lighter and more efficient but less stable. The limits keep you between “not enough elevator” and “not enough stability”.',no:'Lenger fram = mer stabilt, men tyngre å pitche; lenger bak = lettere og mer effektivt, men mindre stabilt. Grensene holder deg mellom «ikke nok høyderor» og «ikke nok stabilitet».'}),
      tog:{en:'Show CP, NP and lift arm',no:'Vis CP, NP og løftearm'},
      full:()=>{ paint(); legend(); }});
    cnEnv=CN.add(el('cmEnv'),{read:()=>L({en:'Across: where the CG is. Up: how heavy the aircraft is. Every loading inside the green shape is legal.',no:'Bortover: hvor CG ligger. Oppover: hvor tungt flyet er. All lasting innenfor den grønne formen er lovlig.'}),
      take:()=>L({en:'Mass and CG are checked together: a CG that is fine when light can be too far forward when heavy.',no:'Masse og CG sjekkes sammen: en CG som er grei når flyet er lett, kan være for langt fram når det er tungt.'}),
      status:true, full:()=>paintEnv()});
    CN.add(el('cmLim'),{read:()=>L({en:'Two needs against CG position: the amber line is elevator needed to flare, the blue line is how firm the stick feels in a pull.',no:'To behov mot CG-posisjon: den gule linjen er høyderoret som trengs for å flate ut, den blå er hvor fast stikka føles i et opptrekk.'}),
      take:()=>L({en:'The forward limit stops you running out of elevator in the flare; the aft limit keeps enough stability and stick feel. Both are set with a safety margin.',no:'Fremre grense hindrer at du går tom for høyderor i utflatingen; bakre grense sikrer nok stabilitet og stikkefølelse. Begge settes med sikkerhetsmargin.'}),
      full:()=>paintLim()}); }
  const ev=el('cmEnv'); let ed=false;
  const evSet=e=>{ if(!envSt.ax) return; const r=ev.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, b=envSt.b;
    const h=EX[0]+(x-b.x)/b.w*(EX[1]-EX[0]), m=EY[0]+(b.y+b.h-y)/b.h*(EY[1]-EY[0]); setState({h,m}); };
  ev.addEventListener('pointerdown',e=>{ ed=true; ev.setPointerCapture(e.pointerId); evSet(e); }); ev.addEventListener('pointermove',e=>{ if(ed) evSet(e); });
  ev.addEventListener('pointerup',()=>ed=false); ev.addEventListener('pointercancel',()=>ed=false);
  document.addEventListener('labdepth',()=>{ paint(); });
  LAB.onLang(()=>{ understand(); legend(); tryDraw(); update(); });
  understand(); legend(); E=calc(); tryInit(); update();
}

/* ---------------- Understand: one diagram and the words ---------------- */
function understand(){
  const f=el('unFig'); if(!f) return;
  const tL=L({en:'Lift',no:'Løft'}), tW=L({en:'Weight',no:'Vekt'}), tT=L({en:'Tail down-force',no:'Halekraft ned'});
  const ah=(x,y,dir,col)=>{ const d=dir==='up'?-1:1; return `<path d="M${x-7} ${y-d*12} L${x} ${y} L${x+7} ${y-d*12} Z" fill="${col}"/>`; };
  const ff='font-family="Public Sans,system-ui,sans-serif" font-weight="600" font-size="15"', fm='font-family="IBM Plex Mono,monospace"';
  const cx=250, cp=300, tx=566;
  f.innerHTML=`<svg viewBox="0 0 640 330" role="img" aria-label="${L({en:'Side view: weight at the CG, wing lift at the CP just behind it, and the tail pushing down far behind. Vertical: lift equals weight plus tail force. Moments about the CG: lift times its short arm equals tail force times its long arm.',no:'Sidebilde: vekt i CG, vingeløft i CP like bak, og halen som presser ned langt bak. Vertikalt: løft er lik vekt pluss halekraft. Momenter om CG: løft ganger kort arm er lik halekraft ganger lang arm.'})}">
  <defs><linearGradient id="unF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#E3E9EE"/><stop offset="1" stop-color="#9FAEBB"/></linearGradient>
  <linearGradient id="unB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F1C29"/><stop offset="1" stop-color="#132433"/></linearGradient></defs>
  <rect width="640" height="330" rx="8" fill="url(#unB)"/>
  <path d="M548 172 L586 104 L606 104 L612 170 Z" fill="#1F3B5E" stroke="#365A80"/>
  <path d="M566 170 Q590 140 604 112 L608 116 Q596 146 580 170 Z" fill="#E46BAE" opacity=".9"/>
  <path d="M56 196 C58 178 76 168 104 166 L520 166 C556 168 590 176 614 186 L614 192 C590 198 556 206 520 212 L104 214 C74 214 58 208 56 196 Z" fill="url(#unF)" stroke="#5B6B78"/>
  <path d="M60 204 C200 203 420 198 612 190" stroke="#E46BAE" stroke-width="2" fill="none"/>
  <g fill="#FFD58A">${Array.from({length:22},(_,i)=>`<circle cx="${130+i*17}" cy="182" r="2.2"/>`).join('')}</g>
  <path d="M72 186 L84 178 L98 178 L97 187 Z" fill="#1A2632"/>
  <path d="M226 214 L318 200 L352 200 L282 218 Z" fill="#B4C0CA" stroke="#5B6B78"/>
  <path d="M536 186 L604 181 L608 186 L540 191 Z" fill="#C3CDD6" stroke="#5B6B78"/>
  <line x1="${cx}" y1="190" x2="${cx}" y2="272" stroke="#EEF3F7" stroke-width="4"/>${ah(cx,284,'down','#EEF3F7')}
  <circle cx="${cx}" cy="190" r="8" fill="#0D161E" stroke="#EEF3F7" stroke-width="2"/><path d="M${cx} 190 L${cx} 182 A8 8 0 0 1 ${cx+8} 190 Z M${cx} 190 L${cx} 198 A8 8 0 0 1 ${cx-8} 190 Z" fill="#EEF3F7"/>
  <line x1="${cp}" y1="206" x2="${cp}" y2="98" stroke="#7FCBE8" stroke-width="4"/>${ah(cp,86,'up','#7FCBE8')}
  <line x1="${tx}" y1="186" x2="${tx}" y2="222" stroke="#E46BAE" stroke-width="4"/>${ah(tx,234,'down','#E46BAE')}
  <text x="${cp+10}" y="96" fill="#7FCBE8" ${ff}>${tL} · CP</text>
  <text x="${cx-12}" y="282" fill="#EEF3F7" ${ff} text-anchor="end">${tW} · CG</text>
  <text x="${tx-10}" y="246" fill="#E46BAE" ${ff} text-anchor="end">${tT} · T</text>
  <g stroke="#7FCBE8" stroke-width="1.3"><line x1="${cx}" y1="130" x2="${cp}" y2="130"/><line x1="${cx}" y1="124" x2="${cx}" y2="136"/><line x1="${cp}" y1="124" x2="${cp}" y2="136"/></g>
  <text x="${(cx+cp)/2}" y="121" fill="#7FCBE8" ${fm} font-size="14" text-anchor="middle">a</text>
  <g stroke="#E46BAE" stroke-width="1.3"><line x1="${cx}" y1="300" x2="${tx}" y2="300" stroke-dasharray="4 3"/><line x1="${cx}" y1="294" x2="${cx}" y2="306"/><line x1="${tx}" y1="294" x2="${tx}" y2="306"/></g>
  <text x="${(cx+tx)/2}" y="293" fill="#E46BAE" ${fm} font-size="13" text-anchor="middle">${L({en:'tail arm',no:'halearm'})} l<tspan font-size="10" dy="3">T</tspan></text>
  <rect x="18" y="16" width="${LAB.lang==='en'?262:252}" height="56" rx="5" fill="rgba(9,15,21,.7)" stroke="#26343F"/>
  <text x="30" y="38" fill="#D7E1E6" ${fm} font-size="13">${L({en:'up = down',no:'opp = ned'})}:  L = W + T</text>
  <text x="30" y="60" fill="#D7E1E6" ${fm} font-size="13">${L({en:'pitch, about CG',no:'pitch, om CG'})}:  L·a = T·l<tspan font-size="10" dy="3">T</tspan></text>
  <text x="622" y="322" fill="#8B99A7" ${fm} font-size="10.5" text-anchor="end">${L({en:'not to scale · a ≈ 0.1–1.5 m, tail arm ≈ 16 m',no:'ikke i skala · a ≈ 0,1–1,5 m, halearm ≈ 16 m'})}</text>
  </svg>`;
  const D=[
   ['CG',{en:'Centre of gravity',no:'Tyngdepunkt'},{en:'The point where the whole weight acts. You move it by loading: passengers, cargo and fuel.',no:'Punktet der hele vekten virker. Du flytter det ved lasting: passasjerer, last og drivstoff.'}],
   ['CP',{en:'Centre of pressure',no:'Trykksenter'},{en:'Where the wing’s lift acts. It moves forward as the angle of attack rises (and with mass), so it is not a fixed point.',no:'Der vingens løft virker. Det flytter seg fremover når anstigningsvinkelen øker (og med massen), så det er ikke et fast punkt.'}],
   ['MAC',{en:'Mean aerodynamic chord, % MAC',no:'Midlere aerodynamisk korde, % MAC'},{en:'A reference chord for the whole wing. CG positions are given as a percentage of it from its leading edge (0 % = LEMAC).',no:'En referansekorde for hele vingen. CG oppgis i prosent av den fra forkanten (0 % = LEMAC).'}],
   ['T',{en:'Tail down-force',no:'Halekraft ned'},{en:'With the CG ahead of the CP, the tailplane must push down to stop the nose dropping. The wing then carries weight plus tail force.',no:'Med CG foran CP må haleflaten presse ned for at nesen ikke skal falle. Vingen bærer da vekt pluss halekraft.'}],
   ['a',{en:'Moment arm',no:'Momentarm'},{en:'The distance from the CG to where a force acts. Force × arm = moment. The tail’s arm is long, so a small tail force balances a lot.',no:'Avstanden fra CG til der en kraft virker. Kraft × arm = moment. Halens arm er lang, så en liten halekraft balanserer mye.'}],
   ['NP',{en:'Neutral point',no:'Nøytralpunkt'},{en:'The CG position where the aircraft becomes neutrally stable. Set by the design (tail size and arm), not by loading.',no:'CG-posisjonen der flyet blir nøytralt stabilt. Bestemt av konstruksjonen (haleflate og arm), ikke av lastingen.'}],
   ['SM',{en:'Static margin',no:'Statisk margin'},{en:'NP minus CG, in % MAC. Positive = stable. The bigger it is, the more stable and the heavier the controls.',no:'NP minus CG, i % MAC. Positiv = stabil. Jo større, desto mer stabilt og tyngre ror.'}]];
  el('unDefs').innerHTML=D.map(([k,t,d])=>`<div><dt><b>${k}</b> ${L(t)}</dt><dd>${L(d)}</dd></div>`).join('');
  el('unLead').innerHTML=L({en:'An aircraft in steady flight is a balance. The weight acts at the CG, the wing’s lift acts at the centre of pressure, and the tailplane trims out the difference. Where you put the CG decides how hard the tail must work, and that one force explains stall speed, fuel burn, stability and control.',no:'Et fly i jevn flyging er en vektskål. Vekten virker i CG, vingens løft i trykksenteret, og haleflaten trimmer bort forskjellen. Hvor du legger CG, bestemmer hvor hardt halen må jobbe, og den ene kraften forklarer steilefart, drivstofforbruk, stabilitet og styring.'});
  el('unDeep').innerHTML=`<span class="k">${L({en:'Deep dive',no:'Dypdykk'})}</span><p>${L({en:'Two equations do all the work. <b>Vertically</b>, the wing must lift the weight plus the tail’s down-force: L = W + T. <b>In pitch</b>, the moments about the CG must cancel: the wing’s lift, acting a short distance behind the CG, tries to pitch the nose down; the tail’s down-force, on its long arm, pitches it back up. Move the CG forward and the lift arm a grows, so T must grow, and the wing must lift even more.',no:'To likninger gjør hele jobben. <b>Vertikalt</b> må vingen løfte vekten pluss halens kraft nedover: L = W + T. <b>I pitch</b> må momentene om CG oppheve hverandre: vingens løft, som virker et stykke bak CG, prøver å senke nesen; halens kraft ned, på sin lange arm, løfter den igjen. Flytt CG fremover, og løftets arm a blir større, så T må øke, og vingen må løfte enda mer.'})}</p>
  <p>${L({en:'The cambered wing also makes a nose-down pitching moment of its own (Cm0), which is why the CP sits behind the aerodynamic centre and moves forward as the lift coefficient rises. Stability is a different question from balance: it asks what happens <i>after</i> a disturbance. That depends on where the CG is relative to the neutral point, the point where the whole aircraft’s extra lift from a gust acts.',no:'Den krumme vingen lager også et eget nese-ned-moment (Cm0). Derfor ligger CP bak det aerodynamiske senteret og flytter seg fremover når løftekoeffisienten øker. Stabilitet er et annet spørsmål enn balanse: det handler om hva som skjer <i>etter</i> en forstyrrelse. Det avhenger av hvor CG ligger i forhold til nøytralpunktet, punktet der hele flyets ekstra løft fra et vindkast virker.'})}</p>`;
}

/* ---------------- Try: four tasks (template: Do it in the model / Show it in the model) ---------------- */
const t2=(en,no)=>({en,no});
let active=null; const touched={}, ans={};
const TASKS=[
 {k:'range',model:{m:64,h:25,ph:'cr'},q:t2('Find the CG that gives the best range while staying inside the limits (cruise, 64 t).','Finn CG-en som gir best rekkevidde og fortsatt er innenfor grensene (marsj, 64 t).'),
  check:()=>{ const e=E, env=e.env; if(ST.ph!=='cr') return {ok:0,m:t2('Choose Cruise first.','Velg Marsj først.')};
    if(!e.inEnv) return {ok:0,m:t2(`CG ${nf(ST.h,1)} % is outside the limits (${nf(env.fwd,1)}–${nf(env.aft,1)} %). The best legal answer is at the aft limit, not behind it.`,`CG ${nf(ST.h,1)} % er utenfor grensene (${nf(env.fwd,1)}–${nf(env.aft,1)} %). Det beste lovlige svaret er ved bakre grense, ikke bak den.`)};
    if(ST.h>=env.aft-1.5) return {ok:1,m:t2(`Yes: ${pm(e.dR)} % range at ${nf(ST.h,1)} %. At the aft limit the tail pushes down least, so the wing makes the least induced drag. Operators load aft for this, inside the limit.`,`Ja: ${pm(e.dR)} % rekkevidde ved ${nf(ST.h,1)} %. Ved bakre grense presser halen minst ned, så vingen lager minst indusert motstand. Operatører laster bakover av denne grunnen, innenfor grensen.`)};
    return {ok:0,m:t2(`Now ${pm(e.dR)} % at ${nf(ST.h,1)} %. Keep moving the CG aft and watch the tail force shrink.`,`Nå ${pm(e.dR)} % ved ${nf(ST.h,1)} %. Flytt CG videre bakover og se halekraften krympe.`)}; }},
 {k:'flare',model:{m:60,h:25,ph:'fl'},q:t2('Make the aircraft run out of elevator in the landing flare.','Få flyet til å gå tom for høyderor i utflatingen.'),
  check:()=>{ const e=E; if(ST.ph!=='fl') return {ok:0,m:t2('Choose Landing flare first.','Velg Utflating først.')};
    if(e.flOut) return {ok:1,m:t2(`Yes: at ${nf(ST.h,1)} % MAC the flare needs ${nf(e.fl.frac*100,0)} % of the elevator. The forward CG makes the aircraft so stable that the tail cannot raise the nose: a hard, flat landing. That is why the forward limit (${nf(e.env.fwd,1)} %) exists.`,`Ja: ved ${nf(ST.h,1)} % MAC trenger utflatingen ${nf(e.fl.frac*100,0)} % av høyderoret. Fremre CG gjør flyet så stabilt at halen ikke klarer å løfte nesen: en hard, flat landing. Derfor finnes fremre grense (${nf(e.env.fwd,1)} %).`)};
    return {ok:0,m:t2(`${nf(e.fl.frac*100,0)} % of the elevator is used. Move the CG further forward, past the forward limit.`,`${nf(e.fl.frac*100,0)} % av høyderoret er brukt. Flytt CG lenger frem, forbi fremre grense.`)}; }},
 {k:'vs',show:{m:64,h:19,ph:'fl'},q:t2('Why does the stall speed rise when you move the CG forward?','Hvorfor øker steilefarten når du flytter CG fremover?'),
  opts:[t2('The tail pushes down harder, so the wing must lift more than the weight','Halen presser hardere ned, så vingen må løfte mer enn vekten'),t2('The aircraft gets heavier','Flyet blir tyngre'),t2('The CP moves aft and CLmax falls','CP flytter seg bakover og CLmax synker'),t2('The elevator stalls first','Høyderoret staller først')],c:0,
  e:()=>{ const vf=S.stall(64,S.envelope(64).fwd/100,'full').Vs, va=S.stall(64,S.envelope(64).aft/100,'full').Vs;
    return [t2(`Yes. The mass is the same, the wing’s load is not. At 64 t, CONF FULL: ${nf(va,1)} kt at the aft limit, ${nf(vf,1)} kt at the forward limit.`,`Ja. Massen er den samme, vingens last er ikke det. Ved 64 t, CONF FULL: ${nf(va,1)} kt ved bakre grense, ${nf(vf,1)} kt ved fremre grense.`),
      t2('Not quite. The mass does not change; the tail’s down-force is added to the wing’s load. Show it in the model.','Ikke helt. Massen endrer seg ikke; halens kraft nedover legges til vingens last. Se det i modellen.')]; }},
 {k:'mass',show:{m:75,h:28,ph:'fl'},q:t2('Same CG, mass from 50 t to 75 t. How much does the stall speed rise?','Samme CG, masse fra 50 t til 75 t. Hvor mye øker steilefarten?'),
  opts:[t2('About 22 %','Rundt 22 %'),t2('About 50 %','Rundt 50 %'),t2('About 3 %','Rundt 3 %'),t2('Not at all','Ikke i det hele tatt')],c:0,
  e:()=>{ const v50=S.stall(50,.28,'full').Vs, v75=S.stall(75,.28,'full').Vs;
    return [t2(`Yes. VS ∝ √W: √(75/50) = 1.22. The model: ${nf(v50,1)} → ${nf(v75,1)} kt. Mass moves VS far more than the CG does.`,`Ja. VS ∝ √W: √(75/50) = 1,22. Modellen: ${nf(v50,1)} → ${nf(v75,1)} kt. Massen flytter VS mye mer enn CG gjør.`),
      t2('Not quite. VS grows with the square root of the weight: √1.5 ≈ 1.22. Show it in the model.','Ikke helt. VS øker med kvadratroten av vekten: √1,5 ≈ 1,22. Se det i modellen.')]; }}];
function tryInit(){ const b=el('tasks'); if(!b) return;
  b.addEventListener('click',e=>{ const go=e.target.closest('[data-go]'), o=e.target.closest('[data-o]'), sh=e.target.closest('[data-show]');
    const toModel=()=>el('basics').scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
    if(go){ const t=TASKS.find(x=>x.k===go.dataset.go); active=t.k; touched[t.k]=1; setState(t.model); toModel(); return; }
    if(o){ const k=o.closest('[data-k]').dataset.k; ans[k]=+o.dataset.o; tryDraw(); return; }
    if(sh){ const t=TASKS.find(x=>x.k===sh.dataset.show); active=null; setState(t.show); toModel(); } });
  el('cmTask').addEventListener('click',e=>{ if(e.target.closest('[data-x]')){ active=null; liveTask(); } });
  tryDraw(); }
function tryDraw(){ const b=el('tasks'); if(!b||!E) return;
  b.innerHTML=TASKS.map((t,i)=>{ let h=`<li class="task" id="task-${t.k}" data-k="${t.k}"><span class="n">${L(t2('Task','Oppgave'))} ${i+1}</span><p class="q">${L(t.q)}</p>`;
    if(t.model) h+=`<div class="btns"><button type="button" class="btn pri sm" data-go="${t.k}">${L(t2('Do it in the model','Gjør det i modellen'))} ↑</button></div><span class="fb" id="fb-${t.k}"></span>`;
    else { const a=ans[t.k], ex=t.e(); h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div>`+
      `<span class="fb${a===t.c?' ok':''}">${a!=null?L(ex[a===t.c?0:1]):''}</span><div class="btns"><button type="button" class="btn sm" data-show="${t.k}">${L(t2('Show it in the model','Vis det i modellen'))} ↑</button></div>`; }
    return h+'</li>'; }).join('');
  liveTask(); }
function liveTask(){ if(!E) return;
  TASKS.filter(t=>t.model&&touched[t.k]).forEach(t=>{ const r=t.check(), f=el('fb-'+t.k); if(f){ f.innerHTML=L(r.m); f.classList.toggle('ok',!!r.ok); } });
  const b=el('cmTask'); if(!b) return; if(!active){ b.hidden=true; return; }
  const i=TASKS.findIndex(t=>t.k===active), r=TASKS[i].check();
  b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${i+1}<button type="button" data-x="1" aria-label="${L(t2('Close the task','Lukk oppgaven'))}">×</button></span>${L(TASKS[i].q)}<span class="fb${r.ok?' ok':''}">${L(r.m)}</span>`; }

window.CGM={init,state:ST,calc,set:setState,onChange:f=>hooks.push(f)};
})();
