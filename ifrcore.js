/* Birdbird – ifrcore.js: the pure engine behind the IFR trainer (ifr.html).
   No DOM, no state of its own. Builds on navcore.js (NAVCORE: angles, VOR, ILS, ADF, wind) and holdcore.js
   (HOLDCORE: holding entries with the 5° flexibility, wind in the hold). Loaded in the page as window.IFRCORE
   and in Node (tests/ifr.test.mjs) through vm, after navcore.js and holdcore.js.
   Frame: x east, y north in NM, true angles in degrees, as navcore.js. The trainer sets magnetic variation to 0,
   so map bearings and instrument bearings agree.
   Parts: areas (a fictional practice area, and real Norwegian navaids passed in from navmap.js), a simple flight model
   (rate-one turns, climb and descent to a selected altitude, wind with gusts), instrument readings, thirteen exercises
   (setup, judge, a scripted "good pilot" and one typical mistake each), think-first questions and grading.
   Judges return codes, not text: the page (ifr.js) turns codes into EN/NO sentences.
   Tolerances: EASA IR skill test (height ±100 ft, tracking on radio aids ±5°, precision approach half-scale,
   MDA +50/−0 ft). Holding: ICAO PANS-OPS (entries with ±5° flexibility, 1 min legs at or below 14 000 ft).
   Procedure turn 45°/180°: 1 min from the start of the 45° turn (Cat A/B). Base turn: φ = 36°/t.
   Training model, not for navigation. */
(function(root){
'use strict';
const N=root.NAVCORE, H=root.HOLDCORE;
const D2R=Math.PI/180, R2D=180/Math.PI, FT_NM=N.K.FT_NM;
const norm=N.norm, diff=N.diff, clamp=N.clamp, bearing=N.bearing;
const uvec=c=>[Math.sin(c*D2R),Math.cos(c*D2R)];
const r10=v=>Math.round(v/10)*10;

/* ---------- small helpers ---------- */
/* seeded random (mulberry32): same seed, same exercise */
function rng(seed){ let a=(seed>>>0)||1; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
const pick=(r,a)=>a[Math.floor(r()*a.length)%a.length];
const between=(r,a,b)=>a+(b-a)*r();
/* position relative to a line through P with direction c: along (+ ahead), xt (+ right of the direction) */
function lineRel(P,c,p){ const u=uvec(c), dx=p.x-P.x, dy=p.y-P.y; return {along:dx*u[0]+dy*u[1],xt:dx*u[1]-dy*u[0]}; }
/* angular error from a course line through a station (deg). + = the course lies to the right (fly right). */
function crsErr(P,c,p,minAlong){ const l=lineRel(P,c,p); return -Math.atan2(l.xt,Math.max(Math.abs(l.along),minAlong||0.05))*R2D; }
/* a point at true bearing b, distance d from P */
const at=(P,b,d)=>({x:P.x+Math.sin(b*D2R)*d,y:P.y+Math.cos(b*D2R)*d});
/* intercept heading: the course plus `ang` degrees towards it (xt from lineRel: + = right of the course) */
const interceptHdg=(crs,xt,ang)=>norm(crs+(xt>0?-1:1)*(ang||30));
/* rate-one turn radius (NM) and the lead to start a turn of `deg` degrees onto a line */
const turnR=tas=>N.turnRadius(tas);
const leadNm=(tas,deg)=>turnR(tas)*Math.tan(Math.min(Math.abs(deg),170)/2*D2R);
/* arcs: heading along an arc (dir +1 clockwise = radials increasing) and the lead radial to leave it for a radial */
const arcTrack=(radial,dir)=>norm(radial+dir*90);
const arcLeadDeg=(tas,R)=>turnR(tas)/R*R2D;
/* ground speed → rate of descent on a path angle (ft/min) and the ×5 rule */
const rodFor=(gs,ang)=>H.rod(gs,ang??3);
/* standard rate climb/descent profile altitude above a threshold (ft) at dT NM from it (TCH 50 ft) */
const profileAlt=(dT,elev,ang)=>(elev||0)+50+Math.tan((ang??3)*D2R)*FT_NM*dT;
/* base turn: angle between the outbound track and the reciprocal of the inbound (PANS-OPS φ = 36/t, t in min) */
const baseAngle=tMin=>36/tMin;

/* ---------- areas ---------- */
/* The practice area: clean fictional stations (names and frequencies are not real). */
function practiceArea(){
  const ST={}, NAV=[], ILS=[];
  const add=o=>{ o.var=0; ST[o.id]=o; NAV.push(o); };
  add({id:'HMV',name:'Holmvik',type:'VOR',f:113.30,x:0,y:0,elev:60,dme:true});
  add({id:'KVS',name:'Kvist',type:'VOR',f:116.40,x:-16,y:13,elev:400,dme:true});
  add({id:'FJ',name:'Fjell',type:'NDB',f:365,x:15,y:15,elev:300});
  add({id:'RA',name:'Ravn',type:'NDB',f:402,x:-12,y:-14,elev:100});
  /* Holmvik runway 20 (true course 200) lies on the extended centreline north-east of the VOR */
  const crs=200, u=uvec(crs), len=1.3, end={x:-u[0]*0.5,y:-u[1]*0.5}, thr={x:end.x-u[0]*len,y:end.y-u[1]*len};
  const ils={id:'I20',name:'ILS RWY 20',type:'ILS',apt:'HOLMVIK',crs,elev:50,len,u,thr,end,arp:{x:(thr.x+end.x)/2,y:(thr.y+end.y)/2},
    x:end.x+u[0]*0.16,y:end.y+u[1]*0.16,gp:{x:thr.x+u[0]*0.16,y:thr.y+u[1]*0.16},gpa:3,var:0};
  ST.I20=ils; ILS.push(ils);
  return {id:'practice',real:false,ST,NAV,ILS,APT:[{id:'HOLMVIK',name:'Holmvik',x:ils.arp.x,y:ils.arp.y,elev:50}],
    plan:{vor:'KVS',ndb:'FJ',app:'HMV',ils:'I20',mda:500,alt:4000},
    /* fictional coastline for the plan view (NM): a mainland to the east with fjords, islands to the west */
    coast:[[-3,48,-4,40,-7,35,-5,31,-9,27,-7,23,-11,20,-6,18,0,19,6,21,8,19,2,16.5,-4,15.5,-5,13,1,12,7,13.5,10,12,4,10,-2,9.5,-6,7,-4,4.5,-1.5,3,-2.2,0.5,-0.8,-2,1.6,-4,0,-6.5,-2,-8.5,1,-10.5,5,-9.5,9,-8,12,-10,10,-12.5,5,-13,3,-15.5,6,-18,4.5,-21,8,-24,6,-27,10,-30,9,-33,12,-36,11,-40,14,-48,48,-48,48,48],
           [-21,9,-18,8,-15.5,8.6,-13,10,-13.2,12.5,-13.5,14.5,-16,16.5,-18.5,16,-20,15,-21.5,12],[-15,-16,-13,-17.2,-11,-17,-8.5,-14,-9.2,-12.6,-10,-11.5,-13.5,-12,-15.2,-13.8],[-30,-1,-28,-2.6,-26,-3,-23,0,-23.6,2,-25,3.5,-29,3],[-8,32,-5,31,-4.2,33.5,-6,36,-9,35]].map(p=>chaikin(p,2))};
}
/* corner-cutting smoothing for a closed polygon [x0,y0,x1,y1,…] (two passes) */
function chaikin(p,n){ for(let k=0;k<(n||2);k++){ const o=[], n=p.length/2; for(let i=0;i<n;i++){ const x0=p[2*i],y0=p[2*i+1],j=(i+1)%n,x1=p[2*j],y1=p[2*j+1]; o.push(0.75*x0+0.25*x1,0.75*y0+0.25*y1,0.25*x0+0.75*x1,0.25*y0+0.75*y1); } p=o; } return p; }
/* Real areas from navmap.js (NAVMAP.build): Norwegian navaids from OurAirports, for training only */
const PLANS={bergen:{vor:'FLS',ndb:'ASK',app:'FLS',ils:'I17',mda:620,alt:4000},
             oslo:{vor:'GRM',ndb:'SLB',app:null,ils:null,alt:5000}};
function realArea(id,B){ const ST=Object.assign({},B.ST); B.NAV.forEach(n=>{ n.var=0; if(n.type==='VOR') n.dme=true; });
  return {id,real:true,ST,NAV:B.NAV,ILS:B.ILS,APT:B.APT,plan:PLANS[id]}; }

/* ---------- flight model ---------- */
/* TAS from IAS (≈ 2 % per 1000 ft) */
const tasOf=(ias,alt)=>ias*(1+0.02*Math.max(0,alt)/1000);
/* wind at time t: steady, or gusty and variable (deterministic, so a replay is the same) */
function windAt(w,t){ if(!w||!w.spd) return {dir:w?w.dir:0,spd:0};
  if(!w.gust) return {dir:w.dir,spd:w.spd};
  const p=w.ph||0, g=Math.sin(t*0.21+p)*0.55+Math.sin(t*0.53+p*2.1)*0.3+Math.sin(t*1.37+p*0.7)*0.15;
  const v=Math.sin(t*0.031+p)*0.7+Math.sin(t*0.077+p*1.3)*0.3;
  return {dir:norm(w.dir+v*14),spd:Math.max(0,w.spd*(1+0.32*g))}; }
/* a new aircraft state. sel: the selected values (HDG bug, ALT, VS magnitude, SPD); dir: forced turn direction */
function newSim(o){ const s={t:0,x:o.x,y:o.y,hdg:norm(o.hdg),alt:o.alt,ias:o.ias||120,vs:0,rate:0,bank:0,
  sel:{hdg:norm(o.hdg),alt:o.alt,vs:o.vs||500,spd:o.ias||120,dir:0},wind:o.wind||{dir:0,spd:0},gs:0,trk:o.hdg};
  s.tas=tasOf(s.ias,s.alt); const w=N.windTriangle(s.tas,s.hdg,s.wind.dir,s.wind.spd); s.gs=w.gs; s.trk=w.trk; return s; }
/* heading error the autopilot turns through: the shortest way, unless a direction was chosen and the other way round is at least 45° (so small corrections never become 360° turns) */
function hdgErr(s){ let e=diff(s.sel.hdg,s.hdg); const d=s.sel.dir||0;
  if(d&&Math.abs(e)>=45&&Math.sign(e)!==d) e+=d*360; return e; }
function step(s,dt){
  const tas=s.tas=tasOf(s.ias,s.alt), r1=N.turnRate(tas);
  /* heading: rate-one at most, a smooth roll-in and roll-out */
  const e=hdgErr(s); if(Math.abs(e)<0.05&&Math.abs(s.rate)<0.05){ s.sel.dir=0; }
  const want=clamp(e*0.55,-r1,r1); s.rate+=(want-s.rate)*Math.min(1,dt/0.8);
  s.hdg=norm(s.hdg+s.rate*dt); if(Math.abs(e)<0.5&&Math.sign(e)!==Math.sign(s.rate)) s.sel.dir=0;
  s.bank=Math.atan(s.rate*D2R*tas*0.5144/9.81)*R2D;
  /* vertical: to the selected altitude at the selected rate, captured gently */
  const da=s.sel.alt-s.alt, vmax=Math.abs(s.sel.vs)||500;
  const vw=Math.abs(da)<1?0:Math.sign(da)*Math.min(vmax,Math.abs(da)*2.2+40);
  s.vs+=(vw-s.vs)*Math.min(1,dt/1.2); s.alt+=s.vs/60*dt; if(Math.abs(s.sel.alt-s.alt)<0.5&&Math.abs(s.vs)<20){ s.alt=s.sel.alt; s.vs=0; }
  /* speed: 1.5 kt/s */
  s.ias+=clamp(s.sel.spd-s.ias,-1.5*dt,1.5*dt);
  const w=windAt(s.wind,s.t), g=N.windTriangle(tas,s.hdg,w.dir,w.spd);
  s.x+=g.vx*dt/3600; s.y+=g.vy*dt/3600; s.gs=g.gs; s.trk=g.trk; s.wnow=w; s.t+=dt; return s; }

/* ---------- instrument readings ---------- */
/* cfg: {nav: station id (VOR) or ILS id, obs, adf: NDB id}. Returns what every instrument needs. */
function read(s,A,cfg){
  const nav=A.ST[cfg.nav], adf=A.ST[cfg.adf], o={mh:s.hdg,gs:s.gs,trk:s.trk,ils:false};
  if(nav&&nav.type==='ILS'){ const lc=N.loc(nav,s), g=N.gs(nav,s,s.alt);
    o.ils=true; o.flag=lc.valid?'TO':'OFF'; o.dev=lc.dev; o.dots=lc.dots; o.hsiDots=clamp(lc.dev/1.25,-2.5,2.5);
    o.gsOk=g.valid; o.gsDots=g.dots; o.gsDev=g.dev; o.thr=Math.hypot(s.x-nav.thr.x,s.y-nav.thr.y); o.pathFt=g.pathFt;
    const dmeSt=cfg.dme&&A.ST[cfg.dme]; o.dme=dmeSt?N.dme(dmeSt,s,s.alt).slant:o.thr; o.dmeOk=true; o.radial=null; o.qdmV=null; o.vorOk=false; }
  else if(nav){ const v=N.vor(nav,s,cfg.obs,{alt:s.alt,cone:40});
    o.flag=v.flag; o.why=v.why; o.dev=v.dev; o.dots=v.flag==='OFF'&&v.why==='cone'?v.dots*0.3:v.dots; o.hsiDots=clamp(v.dev/5,-2.5,2.5);
    o.radial=v.radial; o.qdmV=v.qdm; o.vorOk=v.dist>0.05; o.dme=nav.dme?v.slant:null; o.dmeOk=!!nav.dme; }
  if(adf){ o.rb=N.adf(adf,s,s.hdg); o.qdmA=norm(s.hdg+o.rb); o.adfOk=true; } else { o.rb=0; o.qdmA=0; o.adfOk=false; }
  return o; }

/* ---------- the judge's toolkit ---------- */
function newJudge(){ return {t:0,phase:'start',ev:[],coach:null,done:false,result:null,acc:{s:0,n:0},times:[],turns:[],
  T:{on:false,h:null,dir:0,sum:0,t0:0,calm:0,p0:null},pass:[],pd:Infinity,armed:true,mark:{}}; }
/* sample score for a normalised error n = |error| / limit: 1 inside 40 % of the limit, 0 at the limit */
const sampleScore=n=>clamp(1-(n-0.4)/0.6,0,1);
function accum(J,n){ J.acc.s+=sampleScore(n); J.acc.n++; if(!(J.nNow>=n)) J.nNow=n; }
/* an event: code, severity (err | warn | good | info), category (acc | time | proc), params, time and place */
function event(J,f,code,sev,cat,p){ if(J.mark[code]&&sev!=='good') return null; J.mark[code]=1;
  const e={code,sev,cat,p:p||{},t:f.s.t,x:f.s.x,y:f.s.y}; J.ev.push(e); return e; }
const coach=(J,k,p,sev,why)=>{ J.coach={k,p:p||{},sev:sev||'info',why:why||null}; };
/* turns: a record when a turn of any size ends; the judge looks only at the big ones */
function trackTurn(J,f,dt){ const T=J.T, h=f.s.hdg; if(T.h===null){ T.h=h; return null; }
  const r=diff(h,T.h)/Math.max(dt,1e-3); T.h=h; let out=null;
  if(!T.on){ if(Math.abs(r)>0.8){ T.on=true; T.sum=0; T.t0=f.s.t; T.calm=0; T.p0={x:f.s.x,y:f.s.y,dme:f.r.dme,h:norm(h-r*dt),radial:f.r.radial}; } }
  if(T.on){ T.sum+=r*dt; if(Math.abs(r)<0.3){ T.calm+=dt; if(T.calm>1.6){ T.on=false; out={t0:T.t0,t1:f.s.t,dir:Math.sign(T.sum),sum:T.sum,h1:h,p0:T.p0}; if(Math.abs(T.sum)>=20) J.turns.push(out); } } else T.calm=0; }
  return out; }
/* station passage: closest approach inside 1.2 NM, re-armed beyond 1.8 NM */
function trackPass(J,f,P){ const d=Math.hypot(f.s.x-P.x,f.s.y-P.y); let hit=false;
  if(J.armed&&d<1.2&&d>J.pd+1e-4){ J.armed=false; J.pass.push(f.s.t); hit=true; }
  if(d>1.8) J.armed=true; J.pd=d; return hit; }
/* the current turn (still in progress) with its sum so far */
const turning=J=>J.T.on&&Math.abs(J.T.sum)>4;
function altCheck(J,f,target){ const e=f.s.alt-target; if(Math.abs(e)>100) event(J,f,'alt','err','acc',{target,e:Math.round(e)}); return Math.abs(e)/100; }

/* ---------- grading ---------- */
function grade(J,ex){
  const acc=J.acc.n?J.acc.s/J.acc.n*100:100;
  const accPen=J.ev.filter(e=>e.cat==='acc'&&e.sev==='err').length*8;
  const timing=J.times.length?J.times.reduce((a,b)=>a+b.s,0)/J.times.length*100:null;
  let proc=100; J.ev.forEach(e=>{ if(e.cat==='proc') proc-= e.sev==='err'?35:e.sev==='warn'?10:0; });
  const A=clamp(Math.round(acc-accPen),0,100), T=timing===null?null:clamp(Math.round(timing),0,100), P=clamp(Math.round(proc),0,100);
  const total=Math.round(T===null?0.55*A+0.45*P:0.4*A+0.25*T+0.35*P);
  const errs=J.ev.filter(e=>e.sev==='err'), warns=J.ev.filter(e=>e.sev==='warn');
  const first=errs[0]||warns[0]||null;
  return {acc:A,time:T,proc:P,total,first,errs:errs.length,warns:warns.length,pass:total>=75&&!errs.some(e=>e.cat==='proc')}; }

/* ---------- the good pilot's tools ---------- */
/* heading to make good a track with the mean wind (the instructor's estimate) */
function hdgFor(s,trk){ const w=s.wind||{spd:0}; if(!w.spd) return norm(trk); const h=N.headingFor(s.tas,trk,w.dir,w.spd); return h.ok?h.hdg:norm(trk); }
/* steer onto and along a course line through P: intercept at up to `max` degrees, 1-in-60 style */
function steer(s,P,crs,o){ o=o||{}; const l=lineRel(P,crs,s), k=o.k||32, mx=o.max||45;
  return hdgFor(s,norm(crs-clamp(l.xt*k,-mx,mx))); }
/* the pilot's command object, starting from the current selections */
const cmd=(s,P)=>({hdg:s.sel.hdg,dir:0,alt:s.sel.alt,vs:s.sel.vs,spd:s.sel.spd,obs:P.obs});

/* ---------- exercises ---------- */
const EX={}, ORDER=[];
function def(o){ EX[o.id]=o; ORDER.push(o.id); }
/* wind for a level: none (1), steady crosswind (2, 3), gusty and variable (4) */
function windFor(lv,r,crs){ if(lv<=1) return {dir:0,spd:0,gust:0,hidden:false};
  const off=pick(r,[-1,1])*between(r,40,80)+(r()<0.3?180:0); const spd=Math.round(between(r,15,26));
  return {dir:Math.round(norm(crs+off)),spd,gust:lv>=4?1:0,ph:r()*6.28,hidden:lv>=4}; }
const niceCrs=(r,lv)=>lv<=1?pick(r,[0,30,60,90,120,150,180,210,240,270,300,330])||360:Math.round(r()*359)+1;
/* everything an exercise needs to start */
function base(A,lv,seed,o){ return Object.assign({area:A.id,lv,seed,obs:0,nav:A.plan.vor,adf:null,hidden:lv>=3,coach:lv<=2},o); }

/* 1 · Orientation: which radial am I on? Three positions, report each radial. */
def({id:'orient',group:'radials',inst:['cdi','rmi','hsi','pfd'],def:'rmi',
  setup(A,lv,seed){ const r=rng(seed), st=A.ST[A.plan.vor], qs=[];
    for(let i=0;i<3;i++){ const rad=Math.round(r()*359)+1, d=between(r,7,22); qs.push({rad,d,hdg:Math.round(r()*359)+1}); }
    const q=qs[0], p=at(st,q.rad,q.d);
    return base(A,lv,seed,{nav:st.id,adf:null,ac:{x:p.x,y:p.y,hdg:q.hdg,alt:A.plan.alt,ias:120},wind:windFor(lv,r,q.hdg),obs:Math.round(r()*359)+1,
      task:{st:st.id,qs,n:3},box:[st,at(st,0,24),at(st,90,24),at(st,180,24),at(st,270,24)]}); },
  /* the UI (or the pilot) reports with f.act={type:'report',val}; the next position follows */
  judge(J,f,X){ const st=f.A.ST[X.task.st], qi=J.qi||0;
    if(J.qa===undefined){ J.qa=f.s.t; }
    coach(J,'orient.ask',{n:qi+1,of:3});
    if(f.r.flag==='TO'&&Math.abs(f.r.dots)<1) coach(J,'orient.to',{},'warn','orient.to.why');
    if(f.r.flag==='FROM'&&Math.abs(f.r.dots)<0.5) coach(J,'orient.centred',{obs:N.d3(X.obs)},'good');
    if(f.act&&f.act.type==='report'){ const truth=f.r.radial, err=Math.abs(diff(f.act.val,truth)), dt=f.s.t-J.qa;
      J.times.push({s:clamp(1-(dt-25)/65,0,1),k:'answer',v:dt}); accum(J,err/10);
      if(Math.abs(diff(f.act.val,norm(truth+180)))<8) event(J,f,'orient.recip','err','proc',{val:f.act.val,truth:Math.round(truth)});
      else if(err>8) event(J,f,'orient.wrong','err','proc',{val:f.act.val,truth:Math.round(truth)});
      else event(J,f,'orient.ok','good','acc',{val:f.act.val,truth:Math.round(truth)});
      J.mark['orient.ok']=0;
      J.qi=qi+1; J.qa=null; J.answers=(J.answers||[]).concat([{val:f.act.val,truth,dt}]);
      if(J.qi>=3){ J.done=true; return; }
      const q=X.task.qs[J.qi], p=at(st,q.rad,q.d); J.reposition={x:p.x,y:p.y,hdg:q.hdg}; } },
  pilot(P,f,X,m){ const c=cmd(f.s,X); const truth=f.r.radial; P.k=P.k||0; P.k+=f.dt;
    if(P.k>3.5){ P.k=0; const val=Math.round(m&&!P.mis?norm(truth+180):truth)||360; if(m) P.mis=1; c.act={type:'report',val:val===0?360:val}; }
    c.obs=Math.round(truth)||360; return c; },
  think(X,A){ const q=X.task.qs[0]; return {kind:'radial',qdm:Math.round(norm(q.rad+180))||360,opts:shuffleOpts([q.rad,norm(q.rad+180),norm(q.rad+90),norm(q.rad-90)].map(v=>Math.round(v)||360),X.seed),ans:Math.round(q.rad)||360}; },
  tmax:600});

/* 2 · Track inbound */
def({id:'trackIn',group:'track',inst:['cdi','rmi','hsi','pfd'],def:'cdi',
  setup(A,lv,seed){ const r=rng(seed), st=A.ST[A.plan.vor], crs=niceCrs(r,lv), off=pick(r,[-1,1])*between(r,3,6), d=between(r,13,16);
    const p=at(st,norm(crs+180+off),d);
    return base(A,lv,seed,{nav:st.id,ac:{x:p.x,y:p.y,hdg:crs,alt:A.plan.alt,ias:120},wind:windFor(lv,r,crs),obs:lv<=2?crs:Math.round(norm(crs+between(r,40,140)*pick(r,[-1,1]))),
      task:{st:st.id,crs,inbound:true,alt:A.plan.alt},box:[st,p,at(st,crs+180,d+2)]}); },
  judge(J,f,X){ trackJudge(J,f,X,true); },
  pilot(P,f,X,m){ const c=cmd(f.s,X), st=f.A.ST[X.task.st]; c.obs=m?norm(X.task.crs+180):X.task.crs; c.hdg=steer(f.s,st,X.task.crs); return c; },
  think(X){ return windThink(X); },tmax:900});
/* 3 · Track outbound */
def({id:'trackOut',group:'track',inst:['cdi','rmi','hsi','pfd'],def:'cdi',
  setup(A,lv,seed){ const r=rng(seed), st=A.ST[A.plan.vor], crs=niceCrs(r,lv), off=pick(r,[-1,1])*between(r,4,8);
    const p=at(st,norm(crs+off),2.2);
    return base(A,lv,seed,{nav:st.id,ac:{x:p.x,y:p.y,hdg:crs,alt:A.plan.alt,ias:120},wind:windFor(lv,r,crs),obs:lv<=2?crs:Math.round(norm(crs+between(r,40,140)*pick(r,[-1,1]))),
      task:{st:st.id,crs,inbound:false,alt:A.plan.alt,to:12},box:[st,at(st,crs,13),at(st,crs+180,2)]}); },
  judge(J,f,X){ trackJudge(J,f,X,false); },
  pilot(P,f,X,m){ const c=cmd(f.s,X), st=f.A.ST[X.task.st]; c.obs=X.task.crs; c.hdg= m? X.task.crs : steer(f.s,st,X.task.crs); return c; },
  think(X){ return windThink(X); },tmax:900});
/* the shared tracking judge (also used after an intercept) */
function trackJudge(J,f,X,inbound){ const st=f.A.ST[X.task.st], crs=X.task.crs, e=crsErr(st,crs,f.s), s=f.s;
  const d=Math.hypot(s.x-st.x,s.y-st.y), want=inbound?'TO':'FROM';
  if(J.phase==='start'){ J.phase='track'; }
  /* course set? */
  const obsOk=Math.abs(diff(X.obs,crs))<=3;
  if(!obsOk){ if(Math.abs(diff(X.obs,crs+180))<=3&&f.r.flag!=='OFF'){ if(s.t>8) event(J,f,'reverse','err','proc',{obs:Math.round(X.obs),crs}); coach(J,'track.reverse',{crs:N.d3(crs)},'warn','track.reverse.why'); }
    else coach(J,'track.setcrs',{crs:N.d3(crs)},'info','track.setcrs.why');
    if(s.t>45&&!(Math.abs(diff(X.obs,crs+180))<=3)) event(J,f,'nocrs','warn','proc',{crs}); }
  const n=Math.abs(e)/5;
  if(!J.est&&Math.abs(e)<2.5){ J.estT=(J.estT||0)+f.dt; if(J.estT>8){ J.est=true; J.times.push({s:clamp(1-(s.t-40)/120,0,1),k:'established',v:s.t}); } }
  if(J.est||s.t>60){ accum(J,n); accum(J,altCheck(J,f,X.task.alt));
    if(Math.abs(e)>5&&!(inbound&&d<2.5)){ const drift=Math.abs(diff(s.hdg,crs))<3&&X.wind.spd>0; event(J,f,drift?'drift':'outside','err','acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L',wind:X.wind}); } }
  /* turning away from the needle: error > 3° and the track takes us further away for 12 s */
  const clos=Math.sign(e)*diff(s.trk,crs); if(Math.abs(e)>3&&clos<-2){ J.away=(J.away||0)+f.dt; if(J.away>12) event(J,f,'away','err','proc',{side:e>0?'R':'L'}); } else J.away=0;
  if(obsOk){ if(Math.abs(e)<1) coach(J,'track.good',{wca:Math.round(diff(s.hdg,crs))},'good');
    else if(Math.abs(e)<2.5) coach(J,'track.small',{side:e>0?'R':'L'},'info','track.small.why');
    else coach(J,'track.big',{side:e>0?'R':'L',hdg:N.d3(norm(crs+Math.sign(e)*20))},'warn','track.big.why');
    if(X.wind.spd>0&&J.est&&Math.abs(diff(s.hdg,crs))<1.5&&Math.abs(e)>1.5) coach(J,'track.wind',{side:e>0?'R':'L'},'info','track.wind.why'); }
  if(inbound&&f.r.flag==='OFF'&&d<2) coach(J,'track.cone',{},'info');
  if(inbound){ if(trackPass(J,f,st)) J.done=true; }
  else if(d>=X.task.to) J.done=true; }
function windThink(X){ const w=X.wind, crs=X.task.crs, tas=tasOf(120,X.ac.alt);
  if(!w.spd) return {kind:'needle',crs,side:'R',opts:['R','L'],ans:'R'};
  const h=N.headingFor(tas,crs,w.dir,w.spd), wca=Math.round(h.wca)||1;
  const ans=Math.round(norm(crs+wca))||360;
  return {kind:'wca',crs,w:{dir:w.dir,spd:w.spd},tas:Math.round(tas),wca,opts:shuffleOpts([ans,Math.round(norm(crs-wca))||360,crs,Math.round(norm(crs+3*wca))||360],X.seed),ans}; }
function shuffleOpts(a,seed){ const r=rng(seed+7), b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b.filter((v,i)=>b.indexOf(v)===i); }

/* 4 · Intercept inbound, 5 · intercept outbound */
function interceptSetup(A,lv,seed,inbound){ const r=rng(seed), st=A.ST[A.plan.vor], crs=niceCrs(r,lv), side=pick(r,[-1,1]);
  const ref=inbound?norm(crs+180):crs, d=inbound?between(r,13,17):between(r,4,6), p=at(st,norm(ref+side*between(r,30,55)),d);
  /* start heading: roughly parallel to the course or crossing it at a poor angle, so a decision is needed */
  const hdg=Math.round(norm(crs+side*pick(r,[0,0,20])*(inbound?1:-1)+(inbound?0:0)));
  return base(A,lv,seed,{nav:st.id,ac:{x:p.x,y:p.y,hdg:hdg||360,alt:A.plan.alt,ias:120},wind:windFor(lv,r,crs),obs:lv<=2?crs:Math.round(norm(crs+between(r,60,120)*pick(r,[-1,1]))),
    task:{st:st.id,crs,inbound,alt:A.plan.alt,to:inbound?null:Math.round(d+9)},box:[st,p,at(st,ref,d+2),inbound?at(st,crs,2):at(st,crs,d+10)]}); }
function interceptJudge(J,f,X){ const st=f.A.ST[X.task.st], crs=X.task.crs, s=f.s, e=crsErr(st,crs,s), l=lineRel(st,crs,s);
  if(J.phase==='start'){ J.phase='decide'; J.e0=Math.sign(e); }
  const obsOk=Math.abs(diff(X.obs,crs))<=3, clos=Math.sign(e)*diff(s.trk,crs);
  if(J.phase==='decide'){
    if(!obsOk) coach(J,'track.setcrs',{crs:N.d3(crs)},'info','track.setcrs.why');
    else coach(J,'int.pick',{side:e>0?'R':'L',a:N.d3(interceptHdg(crs,l.xt,30)),b:N.d3(interceptHdg(crs,l.xt,45))},'info','int.pick.why');
    /* the decision: heading steady and converging at 15–95° */
    const ang=Math.abs(diff(s.hdg,crs));
    if(clos>4&&!turning(J)&&ang>=15){ J.phase='converge'; J.times.push({s:clamp(1-(s.t-10)/35,0,1),k:'decision',v:s.t});
      if(ang>95) event(J,f,'int.steep','warn','proc',{ang:Math.round(ang)}); }
    if(clos<-3&&s.t>4&&Math.abs(e)>3){ J.away=(J.away||0)+f.dt; if(J.away>8) event(J,f,'int.away','err','proc',{side:e>0?'R':'L'}); } else J.away=0;
    if(s.t>45&&J.phase==='decide') event(J,f,'int.slow','warn','time',{});
  }
  if(J.phase==='converge'){
    const lead=Math.abs(e)<(X.task.inbound?6:9);
    coach(J,lead?'int.lead':'int.wait',{crs:N.d3(crs)},lead?'warn':'info',lead?'int.lead.why':'int.wait.why');
    if(Math.abs(e)<2.5){ J.phase='track'; J.e1=Math.sign(e)||J.e0; J.tOn=s.t; }
    if(clos<-3&&Math.abs(e)>3){ J.away=(J.away||0)+f.dt; if(J.away>10) event(J,f,'int.away','err','proc',{side:e>0?'R':'L'}); } else J.away=0;
  }
  if(J.phase==='track'){
    /* overshoot: through the centre and out beyond 5° on the far side */
    if(Math.sign(e)===-J.e0&&Math.abs(e)>5&&s.t-J.tOn<90) event(J,f,'int.overshoot','err','proc',{e:Math.round(Math.abs(e))});
    accum(J,Math.abs(e)/5); accum(J,altCheck(J,f,X.task.alt));
    if(Math.abs(e)>5&&!J.mark['int.overshoot']) event(J,f,'outside','err','acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'});
    if(Math.abs(e)<2.5){ J.estT=(J.estT||0)+f.dt; } else J.estT=0;
    coach(J,Math.abs(e)<1?'track.good':Math.abs(e)<2.5?'track.small':'track.big',{side:e>0?'R':'L',wca:Math.round(diff(s.hdg,crs)),hdg:N.d3(norm(crs+Math.sign(e)*20))},Math.abs(e)<1?'good':Math.abs(e)<2.5?'info':'warn');
    if(J.estT>40){ J.done=true; }
  }
  if(X.task.inbound&&trackPass(J,f,st)&&J.phase==='track') J.done=true;
  if(!X.task.inbound&&Math.hypot(s.x-st.x,s.y-st.y)>(X.task.to||20)) J.done=true; }
function interceptPilot(P,f,X,m){ const c=cmd(f.s,X), st=f.A.ST[X.task.st], crs=X.task.crs, l=lineRel(st,crs,f.s);
  c.obs=crs;
  if(m==='away'){ if(!P.done2&&f.s.t<30){ c.hdg=norm(crs+(l.xt>0?1:-1)*40); return c; } P.done2=1; }
  if(m==='late'){ if(!P.on){ c.hdg=interceptHdg(crs,l.xt,90); if(Math.abs(l.xt)<0.05) P.on=1; return c; } }
  c.hdg=steer(f.s,st,crs,{k:X.task.inbound?28:40}); return c; }
def({id:'intIn',group:'intercept',inst:['cdi','rmi','hsi','pfd'],def:'cdi',
  setup(A,lv,seed){ return interceptSetup(A,lv,seed,true); },judge:interceptJudge,
  pilot(P,f,X,m){ return interceptPilot(P,f,X,m?'away':null); },
  think(X,A){ const st=A.ST[X.task.st], l=lineRel(st,X.task.crs,X.ac); const ok=Math.round(interceptHdg(X.task.crs,l.xt,30))||360, bad=Math.round(interceptHdg(X.task.crs,-l.xt,30))||360;
    return {kind:'intercept',crs:X.task.crs,radial:Math.round(N.radial(st,X.ac))||360,inbound:true,opts:shuffleOpts([ok,bad,X.task.crs,Math.round(norm(X.task.crs+180))||360],X.seed),ans:ok}; },tmax:900});
def({id:'intOut',group:'intercept',inst:['cdi','rmi','hsi','pfd'],def:'hsi',
  setup(A,lv,seed){ return interceptSetup(A,lv,seed,false); },judge:interceptJudge,
  pilot(P,f,X,m){ return interceptPilot(P,f,X,m?'late':null); },
  think(X,A){ const st=A.ST[X.task.st], l=lineRel(st,X.task.crs,X.ac); const ok=Math.round(interceptHdg(X.task.crs,l.xt,45))||360, bad=Math.round(interceptHdg(X.task.crs,-l.xt,45))||360;
    return {kind:'intercept',crs:X.task.crs,radial:Math.round(N.radial(st,X.ac))||360,inbound:false,opts:shuffleOpts([ok,bad,X.task.crs,Math.round(norm(X.task.crs+180))||360],X.seed),ans:ok}; },tmax:900});

/* 6 · NDB: track inbound on a QDM (homing vs tracking) */
def({id:'ndb',group:'ndb',inst:['rbi','rmi','pfd'],def:'rbi',
  setup(A,lv,seed){ const r=rng(seed), st=A.ST[A.plan.ndb], crs=niceCrs(r,lv), lv2=Math.max(lv,2), d=between(r,11,14);
    const p=at(st,norm(crs+180+pick(r,[-1,1])*between(r,2,4)),d);
    return base(A,lv,seed,{nav:null,adf:st.id,ac:{x:p.x,y:p.y,hdg:crs,alt:A.plan.alt,ias:120},wind:windFor(lv2,r,crs),obs:0,
      task:{st:st.id,crs,alt:A.plan.alt},box:[st,p,at(st,crs+180,d+2),at(st,crs,2)]}); },
  judge(J,f,X){ const st=f.A.ST[X.task.st], crs=X.task.crs, s=f.s, e=crsErr(st,crs,s), d=Math.hypot(s.x-st.x,s.y-st.y), rb=diff(f.r.rb,0);
    if(J.phase==='start') J.phase='track';
    if(!J.est&&Math.abs(e)<2.5){ J.estT=(J.estT||0)+f.dt; if(J.estT>8){ J.est=true; J.times.push({s:clamp(1-(s.t-40)/120,0,1),k:'established',v:s.t}); } }
    /* homing: the nose stays on the needle while the track error grows */
    if(Math.abs(rb)<3&&X.wind.spd>0&&d>1.5){ J.homeT=(J.homeT||0)+f.dt; } else J.homeT=0;
    if(J.est||s.t>60){ accum(J,Math.abs(e)/5); accum(J,altCheck(J,f,X.task.alt));
      if(Math.abs(e)>5&&d>1.5) event(J,f,J.homeT>20?'ndb.homing':'outside','err',J.homeT>20?'proc':'acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'}); }
    const qdm=Math.round(f.r.qdmA)||360;
    if(J.homeT>15&&Math.abs(e)>2) coach(J,'ndb.homing',{},'warn','ndb.homing.why');
    else if(Math.abs(e)<1) coach(J,'ndb.good',{rb:Math.round(Math.abs(rb)),side:rb>0?'R':'L'},'good','ndb.good.why');
    else coach(J,'ndb.off',{qdm:N.d3(qdm),crs:N.d3(crs),side:e>0?'R':'L'},Math.abs(e)<2.5?'info':'warn','ndb.off.why');
    if(trackPass(J,f,st)) J.done=true; },
  pilot(P,f,X,m){ const c=cmd(f.s,X), st=f.A.ST[X.task.st]; if(m){ c.hdg=norm(f.r.qdmA); return c; } c.hdg=steer(f.s,st,X.task.crs,{k:30}); return c; },
  think(X){ return windThink(X); },tmax:900});

/* 7 · DME arc, then arc to radial */
def({id:'dme',group:'arc',inst:['rmi','cdi','hsi','pfd'],def:'rmi',
  setup(A,lv,seed){ const r=rng(seed), st=A.ST[A.plan.vor], R=10, r0=niceCrs(r,lv), dir=pick(r,[-1,1]), sweep=pick(r,[70,90,110]);
    const r1=Math.round(norm(r0+dir*sweep))||360, p=at(st,r0,5.2);
    return base(A,lv,seed,{nav:st.id,ac:{x:p.x,y:p.y,hdg:r0,alt:A.plan.alt,ias:120},wind:windFor(lv,r,r0+dir*45),obs:r0,
      task:{st:st.id,r0,r1,R,dir,crsIn:Math.round(norm(r1+180))||360,alt:A.plan.alt},box:[st,at(st,r0,R+2),at(st,r1,R+2),at(st,norm(r0+dir*sweep/2),R+2)]}); },
  judge(J,f,X){ const T=X.task, st=f.A.ST[T.st], s=f.s, D=Math.hypot(s.x-st.x,s.y-st.y), rad=N.radial(st,s), tas=s.tas;
    if(J.phase==='start') J.phase='out';
    if(J.phase==='out'){ const e=crsErr(st,T.r0,s), leadD=T.R-leadNm(tas,90);
      accum(J,Math.abs(e)/5);
      coach(J,D<leadD-1?'arc.out':'arc.turnsoon',{R:T.R,lead:(Math.round(leadD*10)/10),dir:T.dir>0?'R':'L',hdg:N.d3(arcTrack(T.r0,T.dir))},D<leadD-1?'info':'warn','arc.lead.why');
      if(J.T.on&&Math.abs(J.T.sum)>20&&D>leadD-1.5){ J.phase='arc'; const dm=J.T.p0?Math.hypot(J.T.p0.x-st.x,J.T.p0.y-st.y):D;
        J.times.push({s:clamp(1-Math.abs(dm-leadD)/1.2,0,1),k:'arcjoin',v:dm});
        if(Math.sign(J.T.sum)!==T.dir) event(J,f,'arc.wrongdir','err','proc',{dir:T.dir}); }
      if(D>T.R+1.0) event(J,f,'arc.late','err','proc',{D:Math.round(D*10)/10}); }
    else if(J.phase==='arc'){ const e=D-T.R, toGo=diff(T.r1,rad)*T.dir, leadDeg=arcLeadDeg(tas,T.R)+2;
      if(Math.abs(diff(rad,T.r0))>8||Math.abs(e)<0.8) J.arcOn=true;
      if(J.arcOn){ accum(J,Math.abs(e)/1); accum(J,altCheck(J,f,T.alt)); if(Math.abs(e)>1) event(J,f,'arc.out','err','acc',{e:Math.round(e*10)/10,R:T.R}); }
      if(toGo>leadDeg+4) coach(J,Math.abs(e)<0.3?'arc.good':(e>0?'arc.outside':'arc.inside'),{e:Math.round(Math.abs(e)*10)/10,R:T.R,r1:N.d3(T.r1)},Math.abs(e)<0.5?'good':'warn','arc.fly.why');
      else coach(J,'arc.leadradial',{r1:N.d3(T.r1),crs:N.d3(T.crsIn),lead:Math.round(leadDeg)},'warn','arc.leadradial.why');
      if(toGo<leadDeg+12&&J.T.on&&Math.abs(J.T.sum)>12&&Math.sign(J.T.sum)===T.dir){ J.phase='in'; J.times.push({s:clamp(1-Math.abs(toGo-leadDeg)/6,0,1),k:'arcleave',v:toGo}); J.e0=Math.sign(crsErr(st,T.crsIn,s))||1; J.tIn=s.t; }
      if(toGo<-6) { event(J,f,'arc.missed','err','proc',{r1:T.r1}); J.phase='in'; J.e0=Math.sign(crsErr(st,T.crsIn,s))||1; J.tIn=s.t; } }
    else { const e=crsErr(st,T.crsIn,s);
      if(s.t-J.tIn>20){ accum(J,Math.abs(e)/5); if(Math.abs(e)>5) event(J,f,'outside','err','acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'}); }
      coach(J,Math.abs(e)<1?'track.good':Math.abs(e)<2.5?'track.small':'track.big',{side:e>0?'R':'L',wca:Math.round(diff(s.hdg,T.crsIn)),hdg:N.d3(norm(T.crsIn+Math.sign(e)*20))},Math.abs(e)<1?'good':'info');
      if(s.t-J.tIn>55||D<3) J.done=true; } },
  pilot(P,f,X,m){ const T=X.task, c=cmd(f.s,X), st=f.A.ST[T.st], s=f.s, D=Math.hypot(s.x-st.x,s.y-st.y), rad=N.radial(st,s), tas=s.tas;
    P.ph=P.ph||'out';
    if(P.ph==='out'){ c.obs=T.r0; c.hdg=steer(s,st,T.r0); if(D>=T.R-leadNm(tas,90)) P.ph='arc'; return c; }
    if(P.ph==='arc'){ c.obs=T.crsIn; const e=D-T.R; P.ta=P.ta||s.t; c.hdg=hdgFor(s,norm(arcTrack(rad,T.dir)+T.dir*(clamp(e*35,-35,35)+4))); c.dir=T.dir;
      if(m&&s.t-P.ta<110){ P.fh=P.fh||c.hdg; c.hdg=P.fh; }
      const toGo=diff(T.r1,rad)*T.dir; if(toGo<=arcLeadDeg(tas,T.R)+1) P.ph='in'; return c; }
    c.obs=T.crsIn; c.dir=0; c.hdg=steer(s,st,T.crsIn); return c; },
  think(X){ const tas=tasOf(120,X.ac.alt), ld=Math.round(leadNm(tas,90)*10)/10; return {kind:'arclead',R:X.task.R,tas:Math.round(tas),opts:shuffleOpts([ld,0.1,2.5,5],X.seed),ans:ld}; },tmax:1200});

/* 8 · Holding entry, 9 · holding pattern */
const ENTRIES=['direct','parallel','teardrop'];
function holdSetup(A,lv,seed){ const r=rng(seed), st=A.ST[A.plan.vor], inb=lv<=1?pick(r,[90,180,270,360]):niceCrs(r,lv), dir=lv>=3&&r()<0.4?-1:1;
  return {r,st,inb,dir,out:norm(inb+180)}; }
/* an arrival heading in the middle of the wanted entry's sector (rel measured from the outbound course towards the holding side) */
function arrivalFor(inb,dir,entry,r,lv){ const lo={teardrop:[12,58],direct:[90,230],parallel:[262,348]}[entry], rel=between(r,lo[0],lo[1]);
  return norm(dir>0?norm(inb+180)-rel:norm(inb+180)+rel); }
def({id:'holdEntry',group:'hold',inst:['cdi','rmi','hsi','pfd'],def:'hsi',
  setup(A,lv,seed){ const h=holdSetup(A,lv,seed), r=h.r, entry=ENTRIES[seed%3], arr=Math.round(arrivalFor(h.inb,h.dir,entry,r,lv))||360, p=at(h.st,norm(arr+180),5.5);
    const W=windFor(lv,r,h.inb);
    return base(A,lv,seed,{nav:h.st.id,ac:{x:p.x,y:p.y,hdg:arr,alt:A.plan.alt,ias:120},wind:W,obs:lv<=2?arr:h.inb,
      task:{st:h.st.id,inb:h.inb,dir:h.dir,out:h.out,alt:A.plan.alt,arr,expect:entry,legS:H.legSec(A.plan.alt)},box:[h.st,p,at(h.st,h.out,6),at(h.st,norm(h.out+h.dir*90),4),at(h.st,norm(h.out-h.dir*90),4)]}); },
  judge(J,f,X){ holdJudge(J,f,X,true); },
  pilot(P,f,X,m){ return holdPilot(P,f,X,m?'direct':null,true); },
  think(X){ const e=H.entry(X.task.inb,X.task.dir,X.task.arr); return {kind:'entry',hdg:X.task.arr,inb:X.task.inb,dir:X.task.dir,opts:ENTRIES.slice(),ans:e.entry,alt:e.alt}; },tmax:900});
def({id:'hold',group:'hold',inst:['cdi','rmi','hsi','pfd'],def:'hsi',
  setup(A,lv,seed){ const h=holdSetup(A,lv,seed), r=h.r, W=windFor(lv,r,h.inb+90);
    const p=at(h.st,h.out,1.6);
    const hw=N.headingFor(tasOf(120,A.plan.alt),h.inb,W.dir,W.spd);
    return base(A,lv,seed,{nav:h.st.id,ac:{x:p.x,y:p.y,hdg:Math.round(hw.ok?hw.hdg:h.inb)||360,alt:A.plan.alt,ias:120},wind:W,obs:h.inb,
      task:{st:h.st.id,inb:h.inb,dir:h.dir,out:h.out,alt:A.plan.alt,laps:2,legS:H.legSec(A.plan.alt),direct:true},box:[h.st,at(h.st,h.out,6),at(h.st,norm(h.out+h.dir*90),3),at(h.st,norm(h.out-h.dir*90),1.5)]}); },
  judge(J,f,X){ holdJudge(J,f,X,false); },
  pilot(P,f,X,m){ return holdPilot(P,f,X,m?'wrongturn':null,false); },
  think(X){ const T=X.task, W=H.holdWind(T.inb,tasOf(120,T.alt),X.wind.dir,X.wind.spd,T.legS), hIn=Math.round(W.hdgIn)||360, ans=Math.round(W.hdgOut)||360;
    return {kind:'holdwca',inb:T.inb,hdgIn:hIn,wca:Math.round(W.wca),opts:shuffleOpts([ans,Math.round(norm(T.out-W.wca))||360,T.out||360,Math.round(norm(T.out+3*W.wca))||360],X.seed),ans}; },tmax:1100});
/* the holding judge: entry (when asked), then laps */
function holdJudge(J,f,X,isEntry){ const T=X.task, st=f.A.ST[T.st], s=f.s, d=T.dir, l=lineRel(st,T.inb,s);
  const W=J.W||(J.W=H.holdWind(T.inb,s.tas,X.wind.dir,X.wind.spd,T.legS));
  const pass=trackPass(J,f,st);
  if(J.phase==='start'){ J.phase='tofix'; J.lap=0; }
  if(J.phase==='tofix'){
    if(isEntry){ const e=H.entry(T.inb,d,s.hdg); coach(J,'hold.tofix',{entry:e.entry,inb:N.d3(T.inb),dir:d>0?'R':'L'},'info','hold.entry.why'); }
    else { const e=crsErr(st,T.inb,s); accum(J,Math.abs(e)/5); coach(J,'hold.inbound',{inb:N.d3(T.inb),hdg:N.d3(W.hdgIn)},'info','hold.inbound.why'); }
    if(pass){ J.tFix=s.t; J.hFix=s.hdg;
      if(isEntry&&!J.entryDone){ J.correct=H.entry(T.inb,d,s.hdg); J.phase='entry'; J.nT=J.turns.length; }
      else { J.phase='turnOut'; J.nT=J.turns.length; J.lap++; } } }
  else if(J.phase==='entry'){ const ok=J.correct, tSince=s.t-J.tFix;
    const hfo=c=>{ const h=N.headingFor(s.tas,c,X.wind.dir,X.wind.spd); return h.ok?h.hdg:c; };
    const dT=Math.abs(diff(s.hdg,hfo(norm(T.out-d*30)))), dO=Math.min(Math.abs(diff(s.hdg,hfo(T.out))),Math.abs(diff(s.hdg,W.hdgOut)));
    coach(J,'hold.entry.'+ok.entry,{out:N.d3(T.out),td:N.d3(norm(T.out-d*30)),dir:d>0?'R':'L'},'info','hold.entry.'+ok.entry+'.why');
    /* the first turn after the fix, signed in the hold direction: direct turns with the hold (70–250°), parallel against it,
       the teardrop needs only a small turn to the offset heading */
    const tr=J.turns.slice(J.nT).find(q=>q.t0>=J.tFix-8);
    if((tr&&s.t-tr.t1>3)||(!tr&&!J.T.on&&tSince>25)||tSince>140){ const a=tr?d*tr.sum:J.T.on?d*J.T.sum:d*diff(s.hdg,J.hFix); let flown=null;
      if(a>55) flown='direct'; else if(a<-40) flown='parallel';
      else if(dT<dO&&dT<20) flown='teardrop'; else if(dO<25) flown=a>=0?'direct':'parallel';
      { J.flown=flown||'unclear'; J.entryDone=true;
        if(J.flown!==ok.entry&&J.flown!==ok.alt) event(J,f,'hold.wrongentry','err','proc',{flown:J.flown,entry:ok.entry,alt:ok.alt,hdg:Math.round(J.hFix)});
        else event(J,f,'hold.entryok','good','proc',{flown:J.flown});
        J.phase= J.flown==='direct'?'outbound':'entryleg'; J.tOut=s.t; J.nT=J.turns.length; } } }
  else if(J.phase==='entryleg'){ const tSince=s.t-J.tFix;
    coach(J,tSince<T.legS?'hold.entryleg':'hold.entryturn',{s:Math.max(0,Math.round(T.legS-tSince)),dir:(J.flown==='teardrop'?d:-d)>0?'R':'L'},tSince<T.legS?'info':'warn','hold.entryturn.why');
    if(J.T.on&&Math.abs(J.T.sum)>40){ J.times.push({s:clamp(1-(Math.abs(tSince-T.legS)-5)/20,0,1),k:'entryleg',v:tSince});
      if(Math.abs(tSince-T.legS)>12) event(J,f,'hold.entrytime','warn','time',{v:Math.round(tSince),want:T.legS});
      const want=J.flown==='teardrop'?d:-d; if(Math.sign(J.T.sum)!==want) event(J,f,'hold.wrongturn','err','proc',{dir:want});
      J.phase='back'; } }
  else if(J.phase==='back'){ coach(J,'hold.back',{inb:N.d3(T.inb)},'info','hold.inbound.why');
    if(!turning(J)){ const e=crsErr(st,T.inb,s); if(l.along<-0.3&&Math.abs(e)<20) accum(J,Math.abs(e)/5); }
    if(pass){ J.done=isEntry; if(!isEntry){ J.phase='turnOut'; J.lap++; J.nT=J.turns.length; } } }
  else if(J.phase==='turnOut'){ coach(J,'hold.turnout',{dir:d>0?'R':'L',hdg:N.d3(W.hdgOut)},'info','hold.turnout.why');
    if(J.T.on&&Math.abs(J.T.sum)>30){ if(Math.sign(J.T.sum)!==d) event(J,f,'hold.wrongturn','err','proc',{dir:d}); J.phase='outbound'; } }
  else if(J.phase==='outbound'){
    if(!J.abeam&&l.along<0){ J.abeam=s.t; }
    if(!J.outEnd&&!J.T.on) J.outEnd=s.t;
    const t0=J.abeam&&J.outEnd?Math.max(J.abeam,J.outEnd):0, tOut=t0?s.t-t0:0;
    if(!turning(J)) coach(J,t0?'hold.timing':'hold.outbound',{s:Math.round(tOut),want:Math.round(W.tOut),hdg:N.d3(W.hdgOut)},'info',t0?'hold.timing.why':'hold.outbound.why');
    if(!turning(J)&&X.wind.spd>0&&t0&&tOut>8){ const errH=Math.abs(diff(s.hdg,W.hdgOut)); if(errH>Math.max(6,Math.abs(W.wca)*1.6)) event(J,f,'hold.nowca','warn','proc',{hdg:Math.round(W.hdgOut)}); }
    if(t0&&J.T.on&&J.T.t0>=t0-1&&Math.abs(J.T.sum)>45){ if(Math.sign(J.T.sum)!==d) event(J,f,'hold.wrongturn','err','proc',{dir:d}); J.phase='turnIn'; J.abeam=0; J.outEnd=0; } }
  else if(J.phase==='turnIn'){ coach(J,'hold.turnin',{inb:N.d3(T.inb)},'info','hold.inbound.why');
    if(Math.abs(diff(s.hdg,W.hdgIn))<12||!J.T.on){ J.phase='inbound'; J.tIn=s.t; } }
  else if(J.phase==='inbound'){ const e=crsErr(st,T.inb,s,1.2); if(l.along<-0.5&&s.t-J.tIn>25){ accum(J,Math.abs(e)/5); if(Math.abs(e)>5) event(J,f,'outside','err','acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'}); }
    coach(J,'hold.inbound',{inb:N.d3(T.inb),hdg:N.d3(W.hdgIn)},'info','hold.inbound.why');
    if(pass&&isEntry){ J.done=true; }
    else if(pass){ const leg=s.t-J.tIn; J.legs=(J.legs||[]).concat([leg]); J.times.push({s:clamp(1-(Math.abs(leg-T.legS)-5)/20,0,1),k:'inleg',v:leg});
      J.lastLeg=leg; if(Math.abs(leg-T.legS)>12) event(J,f,leg<T.legS?'hold.legshort':'hold.leglong','warn','time',{v:Math.round(leg),want:T.legS,adj:Math.round(T.legS-leg)});
      J.lap++; if(isEntry||J.lap>T.laps) J.done=true; else { J.phase='turnOut'; J.nT=J.turns.length; } } }
  if(J.phase!=='tofix') accum(J,altCheck(J,f,T.alt)); }
/* the holding pilot */
function holdPilot(P,f,X,m,isEntry){ const T=X.task, st=f.A.ST[T.st], s=f.s, c=cmd(s,X), d=T.dir, l=lineRel(st,T.inb,s);
  const W=P.W||(P.W=H.holdWind(T.inb,s.tas,X.wind.dir,X.wind.spd,T.legS)), hOut=m==='nowind'?T.out:W.hdgOut;
  c.obs=T.inb; P.ph=P.ph||'tofix'; P.lap=P.lap||0;
  const dist=Math.hypot(s.x-st.x,s.y-st.y), passed=P.pd!==undefined&&dist<1.2&&dist>P.pd&&!P.lock; P.pd=dist; if(dist>1.8) P.lock=0;
  if(passed) P.lock=1;
  switch(P.ph){
    case 'tofix': c.hdg= isEntry&&!P.entered? hdgFor(s,bearing(st.x-s.x,st.y-s.y)) : steer(s,st,T.inb,{k:120,max:30});
      if(passed){ if(isEntry&&!P.entered){ P.entered=1; const e=m==='direct'?'direct':H.entry(T.inb,d,s.hdg).entry; P.e=e; P.t0=s.t;
          if(e==='direct'){ P.ph='turnOut'; } else { P.ph='eleg'; P.eh= e==='teardrop'? hdgFor(s,norm(T.out-d*30)) : hdgFor(s,T.out); } }
        else { P.ph='turnOut'; P.lap++; if(P.tIn){ P.tO=clamp((P.tO||W.tOut)+(T.legS-(s.t-P.tIn)),10,180); } } }
      break;
    case 'eleg': c.hdg=P.eh; c.dir=0; if(s.t-P.t0>=T.legS){ P.ph='eturn'; } break;
    case 'eturn': if(P.e==='teardrop'){ c.hdg=W.hdgIn; c.dir=d; if(Math.abs(diff(s.hdg,W.hdgIn))<25) P.ph='tofix'; }
      else { c.hdg=hdgFor(s,norm(T.inb-d*40)); c.dir=-d; if(Math.abs(diff(s.hdg,c.hdg))<3) P.ph='pback'; } break;
    case 'pback': c.hdg=steer(s,st,T.inb,{k:60,max:50}); if(passed){ P.ph='turnOut'; } break;
    case 'turnOut': c.hdg=hOut; c.dir=m==='wrongturn'&&!P.mis1?-d:d; if(Math.abs(diff(s.hdg,hOut))<3){ P.ph='out'; P.ab=0; if(m==='wrongturn') P.mis1=1; } break;
    case 'out': { c.dir=0; P.tO=P.tO||W.tOut;
      /* fly a line parallel to the inbound course, far enough out that the wind in the inbound turn brings us onto it */
      const cr=N.windComp(T.inb,X.wind.dir,X.wind.spd).cross, off=2*N.turnRadius(s.tas)+d*cr*W.turnS/3600, I=T.inb*D2R;
      const Pl={x:st.x+d*Math.cos(I)*off,y:st.y-d*Math.sin(I)*off}; c.hdg= m==='nowind'?hOut: norm(hOut+clamp(-lineRel(Pl,T.out,s).xt*25,-8,8)); if(!P.ab&&l.along<=0) P.ab=s.t; if(P.ab&&s.t-P.ab>=P.tO){ P.ph='turnIn'; } break; }
    case 'turnIn': c.hdg=W.hdgIn; c.dir=d; if(Math.abs(diff(s.hdg,W.hdgIn))<35){ P.ph='tofix'; P.tIn=s.t+3; } break;
  }
  return c; }

/* 10 · Procedure turn 45°/180°, 11 · base turn */
def({id:'pt',group:'pt',inst:['cdi','rmi','hsi','pfd'],def:'cdi',
  setup(A,lv,seed){ const r=rng(seed), st=A.ST[A.plan.app||A.plan.vor], inb=niceCrs(r,lv), out=norm(inb+180), side=pick(r,[-1,1]);
    const p=at(st,inb,1.2);  /* 1.2 NM before the station, flying outbound over it */
    return base(A,lv,seed,{nav:st.id,ac:{x:p.x,y:p.y,hdg:Math.round(out)||360,alt:A.plan.app?3000:A.plan.alt,ias:110},wind:windFor(lv,r,out),obs:Math.round(out)||360,
      task:{st:st.id,inb,out,side,legS:60,ptS:60,alt:A.plan.app?3000:A.plan.alt},box:[st,at(st,out,6),at(st,norm(out+side*45),6),at(st,inb,2)]}); },
  judge(J,f,X){ const T=X.task, st=f.A.ST[T.st], s=f.s, pass=trackPass(J,f,st);
    if(J.phase==='start') J.phase='tofix';
    if(J.phase==='tofix'){ coach(J,'pt.tofix',{out:N.d3(T.out)},'info','pt.tofix.why'); if(pass){ J.phase='out'; J.tFix=s.t; } }
    else if(J.phase==='out'){ const e=crsErr(st,T.out,s), ts=s.t-J.tFix; if(ts>15){ accum(J,Math.abs(e)/5); if(Math.abs(e)>5) event(J,f,'outside','err','acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'}); }
      coach(J,ts<T.legS?'pt.out':'pt.turn45',{s:Math.max(0,Math.round(T.legS-ts)),dir:T.side>0?'R':'L',hdg:N.d3(norm(T.out+T.side*45))},ts<T.legS?'info':'warn','pt.turn45.why');
      if(J.T.on&&Math.abs(J.T.sum)>12){ J.times.push({s:clamp(1-(Math.abs(ts-T.legS)-5)/20,0,1),k:'ptout',v:ts});
        if(Math.sign(J.T.sum)!==T.side) event(J,f,'pt.wrong45','err','proc',{dir:T.side}); J.phase='t45'; J.t45=s.t; } }
    else if(J.phase==='t45'){ const ts=s.t-J.t45;
      coach(J,ts<T.ptS?'pt.leg45':'pt.turn180',{s:Math.max(0,Math.round(T.ptS-ts)),dir:T.side>0?'L':'R',hdg:N.d3(norm(T.inb+T.side*45))},ts<T.ptS?'info':'warn','pt.turn180.why');
      if(ts>20&&J.T.on&&Math.abs(J.T.sum)>25){ J.times.push({s:clamp(1-(Math.abs(ts-T.ptS)-5)/20,0,1),k:'pt45',v:ts});
        if(Math.sign(J.T.sum)!==-T.side) event(J,f,'pt.wrong180','err','proc',{dir:-T.side}); J.phase='t180'; } }
    else if(J.phase==='t180'){ coach(J,'pt.intercept',{inb:N.d3(T.inb)},'info','int.lead.why');
      if(!turning(J)){ J.phase='in'; J.tIn=s.t; J.e0=Math.sign(crsErr(st,T.inb,s)); } }
    else { const e=crsErr(st,T.inb,s);
      if(Math.abs(e)<2.5) J.on=true;
      if(J.on){ accum(J,Math.abs(e)/5); if(Math.abs(e)>5){ event(J,f,Math.sign(e)!==J.e0?'int.overshoot':'outside','err',Math.sign(e)!==J.e0?'proc':'acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'}); } J.onT=(J.onT||0)+f.dt; }
      coach(J,Math.abs(e)<1?'track.good':Math.abs(e)<2.5?'track.small':'track.big',{side:e>0?'R':'L',wca:Math.round(diff(s.hdg,T.inb)),hdg:N.d3(norm(T.inb+Math.sign(e)*20))},Math.abs(e)<1?'good':'info');
      if(J.onT>35||pass) J.done=true; }
    if(J.phase!=='tofix') accum(J,altCheck(J,f,T.alt)); },
  pilot(P,f,X,m){ const T=X.task, st=f.A.ST[T.st], s=f.s, c=cmd(s,X); P.ph=P.ph||'tofix';
    const dist=Math.hypot(s.x-st.x,s.y-st.y), passed=P.pd!==undefined&&dist<1.2&&dist>P.pd&&!P.lock; P.pd=dist; if(passed) P.lock=1;
    if(P.ph==='tofix'){ c.obs=T.out; c.hdg=steer(s,st,T.out); if(passed){ P.ph='out'; P.t0=s.t; } }
    else if(P.ph==='out'){ c.hdg=steer(s,st,T.out); if(s.t-P.t0>=T.legS){ P.ph='l45'; P.t1=s.t; } }
    else if(P.ph==='l45'){ c.hdg=hdgFor(s,norm(T.out+T.side*45)); c.dir=T.side; if(s.t-P.t1>=T.ptS){ P.ph='t180'; } }
    else if(P.ph==='t180'){ c.obs=T.inb; c.hdg=hdgFor(s,norm(T.inb+T.side*45)); c.dir=m?T.side:-T.side; if(Math.abs(diff(s.hdg,c.hdg))<4) P.ph='in'; }
    else { c.obs=T.inb; c.dir=0; c.hdg=steer(s,st,T.inb,{k:30}); }
    return c; },
  think(X){ const T=X.task; return {kind:'ptdir',side:T.side,opts:['L','R'],ans:T.side>0?'L':'R'}; },tmax:900});
def({id:'base',group:'pt',inst:['cdi','rmi','hsi','pfd'],def:'hsi',
  setup(A,lv,seed){ const r=rng(seed), st=A.ST[A.plan.app||A.plan.vor], inb=niceCrs(r,lv), tMin=2, phi=Math.round(baseAngle(tMin)), side=pick(r,[-1,1]);
    const ro=Math.round(norm(inb+180+side*phi))||360, p=at(st,norm(ro+180),1.2);
    return base(A,lv,seed,{nav:st.id,ac:{x:p.x,y:p.y,hdg:ro,alt:A.plan.app?3000:A.plan.alt,ias:110},wind:windFor(lv,r,ro),obs:ro,
      task:{st:st.id,inb,ro,phi,side,turn:-side,legS:tMin*60,alt:A.plan.app?3000:A.plan.alt},box:[st,at(st,ro,7),at(st,inb,2),at(st,norm(inb+180),6)]}); },
  judge(J,f,X){ const T=X.task, st=f.A.ST[T.st], s=f.s, pass=trackPass(J,f,st);
    if(J.phase==='start') J.phase='tofix';
    if(J.phase==='tofix'){ coach(J,'base.tofix',{ro:N.d3(T.ro)},'info','base.why'); if(pass){ J.phase='out'; J.tFix=s.t; } }
    else if(J.phase==='out'){ const e=crsErr(st,T.ro,s), ts=s.t-J.tFix; if(ts>15){ accum(J,Math.abs(e)/5); if(Math.abs(e)>5) event(J,f,'outside','err','acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'}); }
      coach(J,ts<T.legS?'base.out':'base.turn',{s:Math.max(0,Math.round(T.legS-ts)),dir:T.turn>0?'R':'L',inb:N.d3(T.inb)},ts<T.legS?'info':'warn','base.turn.why');
      if(ts>20&&J.T.on&&Math.abs(J.T.sum)>20){ J.times.push({s:clamp(1-(Math.abs(ts-T.legS)-5)/20,0,1),k:'baseout',v:ts});
        if(Math.sign(J.T.sum)!==T.turn) event(J,f,'base.wrongturn','err','proc',{dir:T.turn}); J.phase='turn'; } }
    else if(J.phase==='turn'){ coach(J,'pt.intercept',{inb:N.d3(T.inb)},'info','int.lead.why'); if(!turning(J)){ J.phase='in'; J.e0=Math.sign(crsErr(st,T.inb,s)); } }
    else { const e=crsErr(st,T.inb,s);
      if(Math.abs(e)<2.5) J.on=true;
      if(J.on){ accum(J,Math.abs(e)/5); if(Math.abs(e)>5) event(J,f,'outside','err','acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'}); J.onT=(J.onT||0)+f.dt; }
      coach(J,Math.abs(e)<1?'track.good':Math.abs(e)<2.5?'track.small':'track.big',{side:e>0?'R':'L',wca:Math.round(diff(s.hdg,T.inb)),hdg:N.d3(norm(T.inb+Math.sign(e)*20))},Math.abs(e)<1?'good':'info');
      if(J.onT>35||pass) J.done=true; }
    if(J.phase!=='tofix') accum(J,altCheck(J,f,T.alt)); },
  pilot(P,f,X,m){ const T=X.task, st=f.A.ST[T.st], s=f.s, c=cmd(s,X); P.ph=P.ph||'tofix';
    const dist=Math.hypot(s.x-st.x,s.y-st.y), passed=P.pd!==undefined&&dist<1.2&&dist>P.pd&&!P.lock; P.pd=dist; if(passed) P.lock=1;
    if(P.ph==='tofix'){ c.obs=T.ro; c.hdg=steer(s,st,T.ro); if(passed){ P.ph='out'; P.t0=s.t; } }
    else if(P.ph==='out'){ c.hdg=steer(s,st,T.ro); if(s.t-P.t0>=T.legS){ P.ph='turn'; } }
    else if(P.ph==='turn'){ c.obs=T.inb; c.hdg=hdgFor(s,norm(T.inb-T.turn*30)); c.dir=m?-T.turn:T.turn; if(Math.abs(diff(s.hdg,c.hdg))<4) P.ph='in'; }
    else { c.obs=T.inb; c.dir=0; c.hdg=steer(s,st,T.inb,{k:30}); }
    return c; },
  think(X){ const T=X.task; return {kind:'basedir',turn:T.turn,opts:['L','R'],ans:T.turn>0?'R':'L'}; },tmax:900});

/* 12 · VOR/DME approach (CDFA to the MDA), 13 · ILS to the decision altitude */
function vorApp(A){ const st=A.ST[A.plan.app], ils=A.ST[A.plan.ils], crs=ils.crs, elev=ils.elev;
  /* threshold position along the final course, measured from the VOR (+ = before the VOR) */
  const k=-lineRel(st,crs,ils.thr).along;
  const fafD=Math.round(k+5), fafAlt=r10(profileAlt(fafD-k,elev)), ifD=fafD+4, mda=A.plan.mda;
  const table=[]; for(let dme=fafD;dme>=Math.ceil(k+0.5);dme--){ const a=profileAlt(dme-k,elev); if(a<mda-60) break; table.push({dme,alt:r10(a)}); }
  return {st,ils,crs,elev,k,fafD,fafAlt,ifD,mda,mapD:Math.max(0.3,Math.round(k*10)/10),table,minD:k+(mda-elev-50)/(Math.tan(3*D2R)*FT_NM)}; }
def({id:'vordme',group:'app',inst:['cdi','rmi','hsi','pfd'],def:'cdi',needs:'app',
  setup(A,lv,seed){ const r=rng(seed), V=vorApp(A), p=at(V.st,norm(V.crs+180),V.ifD+1.5);
    const q=at(p,norm(V.crs+90),pick(r,[-1,1])*between(r,0.15,0.35)*(lv>=2?1:0.3));
    return base(A,lv,seed,{nav:V.st.id,ac:{x:q.x,y:q.y,hdg:V.crs,alt:V.fafAlt,ias:100,vs:500},wind:windFor(lv,r,V.crs),obs:V.crs,
      task:{st:V.st.id,crs:V.crs,fafD:V.fafD,fafAlt:V.fafAlt,ifD:V.ifD,mda:V.mda,k:V.k,elev:V.elev,table:V.table,minD:V.minD,ils:V.ils.id},box:[V.st,p,V.ils.thr,at(V.st,norm(V.crs+180),2)]}); },
  judge(J,f,X){ const T=X.task, st=f.A.ST[T.st], s=f.s, e=crsErr(st,T.crs,s), D=Math.hypot(s.x-st.x,s.y-st.y), prof=profileAlt(D-T.k,T.elev), pa=s.alt-prof;
    if(J.phase==='start') J.phase='initial';
    accum(J,Math.abs(e)/5); if(Math.abs(e)>5&&D>1) event(J,f,'outside','err','acc',{e:Math.round(Math.abs(e)),side:e>0?'R':'L'});
    if(J.phase==='initial'){ if(s.alt<T.fafAlt-100){ event(J,f,'app.early','err','proc',{alt:T.fafAlt,faf:T.fafD}); accum(J,1); } else accum(J,altCheck(J,f,T.fafAlt));
      coach(J,D>T.fafD+0.7?'vor.initial':'vor.faf',{faf:T.fafD,alt:T.fafAlt,mda:T.mda,rod:Math.round(rodFor(s.gs)/10)*10},D>T.fafD+0.7?'info':'warn',D>T.fafD+0.7?'vor.initial.why':'vor.faf.why');
      if(D<=T.fafD){ J.phase='final'; J.tF=s.t; } }
    else if(J.phase==='final'){
      if(!J.desc&&s.vs<-250){ J.desc=true; J.times.push({s:clamp(1-(Math.abs(D-T.fafD)-0.15)/0.8,0,1),k:'descent',v:D}); }
      if(s.t-J.tF>8){ accum(J,Math.abs(pa)/100); if(pa<-150&&s.alt>T.mda) event(J,f,'app.low','err','proc',{pa:Math.round(pa)}); if(pa>250) event(J,f,'app.high','warn','proc',{pa:Math.round(pa)}); }
      if(s.alt<T.mda-15) event(J,f,'app.belowmda','err','proc',{mda:T.mda});
      const nx=T.table.find(q=>q.dme<D-0.05);
      coach(J,Math.abs(pa)<60?'vor.onprofile':pa>0?'vor.high':'vor.low',{pa:Math.round(Math.abs(pa)/10)*10,dme:nx?nx.dme:'',alt:nx?nx.alt:T.mda,rod:Math.round(rodFor(s.gs)/10)*10},Math.abs(pa)<60?'good':'warn','vor.profile.why');
      if(s.alt<=T.mda+30){ J.phase='min'; coach(J,'app.minimums',{},'good'); J.done=true; }
      if(D-T.k<0.2&&!J.done){ event(J,f,'app.mapt','warn','proc',{}); J.done=true; } } },
  pilot(P,f,X,m){ const T=X.task, st=f.A.ST[T.st], s=f.s, c=cmd(s,X), D=Math.hypot(s.x-st.x,s.y-st.y);
    c.obs=T.crs; c.hdg=steer(s,st,T.crs,{k:40,max:30});
    if(m&&D<T.fafD+3){ c.alt=T.mda; c.vs=800; return c; }
    if(D>T.fafD){ c.alt=T.fafAlt; c.vs=500; }
    else { const prof=profileAlt(D-T.k,T.elev); c.alt=T.mda; c.vs=clamp(rodFor(s.gs)+(s.alt-prof)*3,150,1200); }
    return c; },
  think(X){ const T=X.task, q=T.table[Math.min(2,T.table.length-1)]; return {kind:'profile',dme:q.dme,opts:shuffleOpts([q.alt,q.alt+320,q.alt-320,T.mda],X.seed),ans:q.alt}; },tmax:900});
def({id:'ils',group:'app',inst:['cdi','hsi','pfd'],def:'pfd',needs:'ils',
  setup(A,lv,seed){ const r=rng(seed), ils=A.ST[A.plan.ils], side=pick(r,[-1,1]), elev=ils.elev, alt=r10(elev+1900);
    const p0=at(ils.thr,norm(ils.crs+180),between(r,13,14)), p=at(p0,norm(ils.crs+90*side),between(r,1.5,2.1)), hdg=Math.round(norm(ils.crs-side*30))||360;
    return base(A,lv,seed,{nav:ils.id,adf:null,dme:A.plan.app,ac:{x:p.x,y:p.y,hdg,alt,ias:100,vs:500},wind:windFor(lv,r,ils.crs),obs:ils.crs,
      task:{ils:ils.id,crs:ils.crs,alt,elev,da:elev+200,side},box:[ils.thr,p,p0,ils.end]}); },
  judge(J,f,X){ const T=X.task, s=f.s, ils=f.A.ST[T.ils], ld=f.r.dots, gd=f.r.gsDots, hab=s.alt-T.elev;
    if(J.phase==='start'){ J.phase='vector'; J.e0=Math.sign(ld)||1; }
    if(J.phase==='vector'){ coach(J,Math.abs(ld)>4.5?'ils.vector':'ils.alive',{crs:N.d3(T.crs)},Math.abs(ld)>4.5?'info':'warn',Math.abs(ld)>4.5?'ils.vector.why':'int.lead.why');
      if(Math.abs(ld)<1.2){ J.phase='loc'; J.tL=s.t; } }
    else if(J.phase!=='done'){ if(Math.sign(ld)===-J.e0&&Math.abs(ld)>2.5&&s.t-J.tL<60) event(J,f,'ils.overshoot','err','proc',{});
      accum(J,Math.abs(ld)/2.5); if(Math.abs(ld)>2.5&&!J.mark['ils.overshoot']) event(J,f,'ils.loclimit','err','acc',{d:Math.round(Math.abs(ld)*10)/10}); }
    if(!J.gsCap){ if(s.alt<T.alt-100) event(J,f,'app.early','err','proc',{alt:T.alt});
      if(f.r.gsOk&&gd>-0.6&&gd<1.5&&Math.abs(ld)<2.5){ J.gsCap=true; J.tG=s.t; }
      else if(J.phase==='loc') coach(J,'ils.waitgs',{alt:T.alt,rod:Math.round(rodFor(s.gs)/10)*10},'info','ils.waitgs.why'); }
    if(J.gsCap){ if(!J.desc&&s.vs<-250){ J.desc=true; J.times.push({s:clamp(1-(Math.abs(gd)-0.6)/1.6,0,1),k:'gsdescent',v:gd}); }
      if(s.t-J.tG>12){ accum(J,Math.abs(gd)/2.5); if(Math.abs(gd)>2.5) event(J,f,'ils.gslimit','err','acc',{d:Math.round(Math.abs(gd)*10)/10,dir:gd>0?'low':'high'}); }
      const big=Math.max(Math.abs(ld),Math.abs(gd));
      coach(J,big<0.6?'ils.good':(Math.abs(gd)>=Math.abs(ld)?(gd>0?'ils.low':'ils.high'):'ils.loc'),{side:ld>0?'R':'L',rod:Math.round(rodFor(s.gs)/10)*10},big<0.6?'good':'warn','ils.fly.why'); }
    if(J.gsCap&&s.alt<=T.da){ coach(J,'app.minimums',{},'good'); J.done=true; } },
  pilot(P,f,X,m){ const T=X.task, s=f.s, ils=f.A.ST[T.ils], c=cmd(s,X); c.obs=T.crs;
    const l=lineRel(ils.thr,T.crs,s); c.hdg=Math.abs(f.r.dots)>4.2&&!P.cap?s.sel.hdg:hdgFor(s,norm(T.crs-clamp(l.xt*45,-30,30))); if(Math.abs(f.r.dots)<4.2) P.cap=1;
    if(m&&s.t>20){ c.alt=T.da-100; c.vs=700; return c; }
    if(!P.g){ c.alt=T.alt; if(f.r.gsOk&&f.r.gsDots<0.15&&Math.abs(f.r.dots)<1.2) P.g=1; }
    else { const path=f.r.pathFt; c.alt=T.elev; c.vs=clamp(rodFor(s.gs)+(s.alt-path)*(f.r.thr<3?9:4),150,1200); }
    return c; },
  think(X){ const gs=90, ans=Math.round(rodFor(gs)/10)*10; return {kind:'rod',gs,opts:shuffleOpts([ans,ans*2,Math.round(ans/2/10)*10,300+ans],X.seed),ans}; },tmax:900});

/* ---------- running a whole exercise (headless): the scripted pilot, for tests and the "Show me" ideal path ---------- */
function frame(X,A,s,act,dt){ return {A,s,r:read(s,A,{nav:X.nav,obs:X.obs,adf:X.adf,dme:X.dme}),act,dt}; }
function apply(s,X,c){ if(!c) return; s.sel.hdg=norm(c.hdg); s.sel.dir=c.dir||0; s.sel.alt=c.alt; s.sel.vs=c.vs; s.sel.spd=c.spd; if(c.obs!==undefined) X.obs=norm(c.obs)||360; }
function run(id,A,lv,seed,o){ o=o||{}; const ex=EX[id], X=ex.setup(A,lv,seed), s=newSim(Object.assign({},X.ac,{wind:X.wind})), J=newJudge(), P={}, dt=o.dt||0.25;
  const path=[]; let act=null;
  for(let i=0;i<1e6&&s.t<(ex.tmax||900);i++){ const f=frame(X,A,s,act,dt); act=null;
    trackTurn(J,f,dt); ex.judge(J,f,X);
    if(i%4===0) path.push({t:s.t,x:s.x,y:s.y,h:s.hdg,alt:s.alt,ph:J.phase});
    if(J.reposition){ s.x=J.reposition.x; s.y=J.reposition.y; s.hdg=s.sel.hdg=J.reposition.hdg; J.reposition=null; J.pd=Infinity; }
    if(J.done) break;
    const c=ex.pilot(P,f,X,o.mistake); if(c&&c.act){ act=c.act; } apply(s,X,c); step(s,dt); }
  return {X,J,s,path,g:grade(J,ex)}; }

root.IFRCORE={EX,ORDER,ENTRIES,PLANS,practiceArea,realArea,rng,lineRel,crsErr,at,interceptHdg,turnR,leadNm,arcTrack,arcLeadDeg,rodFor,profileAlt,baseAngle,
  tasOf,windAt,newSim,hdgErr,step,read,newJudge,trackTurn,trackPass,grade,sampleScore,hdgFor,steer,vorApp,frame,apply,run,windFor};
})(typeof window!=='undefined'?window:globalThis);
