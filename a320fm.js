/* NORDAP – Airbus A320 flight model, fly-by-wire control laws and auto flight (a320.html).
   Teaching model. The normal law is modelled the way the FCOM describes it to pilots: the sidestick commands a load factor in
   pitch (neutral stick = flight path stability, automatic trim) and a roll rate in roll (neutral stick = bank angle hold,
   spiral stability beyond 33°), with the protections (pitch attitude, bank, load factor, high angle of attack with alpha floor,
   high speed) and the flare mode. Point-mass dynamics in the vertical and horizontal plane with lift as the controlled force,
   CFM/LEAP-like thrust with lapse, configurations 0/1/1+F/2/3/FULL, gear, spoilers, ground roll, brakes and autobrake.
   Auto flight: FD, AP 1/2, A/THR, FCU (SPD/MACH, HDG/TRK, ALT, V/S, LOC, APPR, EXPED, managed / selected) and the FMA.
   Practice area: runway 36 at N=0, E=0 (3,000 m), ILS 36 110.30 crs 360 (as in the other NORDAP sims). SI units inside. */
(function(G){
'use strict';
const D2R=Math.PI/180, R2D=180/Math.PI, KT=0.514444, FT=0.3048, FPM=0.00508, NM=1852, g0=9.80665;
const clamp=(x,a,b)=>x<a?a:x>b?b:x, lag=(v,t,tau,dt)=>v+(t-v)*(1-Math.exp(-dt/Math.max(1e-3,tau))), toward=(v,t,r,dt)=>v<t?Math.min(t,v+r*dt):Math.max(t,v-r*dt);
const w360=a=>{ a%=360; return a<0?a+360:a; }, w180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const RWY={len:3000,wid:45,hdg:360,elev:0};
const ILS={freq:'110.30',crs:360,locN:3000+300,gsN:300,gp:3,id:'IASN'};

/* ---------- aircraft data (A320neo-like) ---------- */
const AC={S:122.6,b:35.8,wheelbase:12.6,T0:120600 /* N per engine, SL static */,CD0:0.0215,k:0.0405,CLa:5.3,
  // config: [name, slats°, flaps°, dCL0, CLmax, dCD, VFE kt]
  CONF:[['0',0,0,0,1.52,0,350],['1',18,0,0.17,1.90,0.006,230],['1+F',18,10,0.32,2.06,0.012,215],['2',22,15,0.47,2.30,0.024,200],['3',22,20,0.58,2.45,0.036,185],['FULL',27,35,0.80,2.80,0.065,177]],
  CL0:0.20,gearCD:0.016,spCD:0.040,spLoss:0.30,VMO:350,MMO:0.82,VLE:280,VLO:250,alphaMax:15.5*D2R};
const TLA={REVMAX:-20,IDLE:0,CL:25,MCT:35,TOGA:45};

function isa(h,dev){ const T=288.15-0.0065*Math.min(h,11000)+(dev||0), p=101325*(h<11000?Math.pow(1-0.0065*h/288.15,5.2559):0.22336*Math.exp(-(h-11000)/6341.6)); return {T,p,rho:p/(287.05*T),sig:p/(287.05*T)/1.225,a:Math.sqrt(1.4*287.05*T)}; }
function casFromTas(tas,h,dev){ const at=isa(h,dev), q=at.p*(Math.pow(1+0.2*Math.pow(tas/at.a,2),3.5)-1); return Math.sqrt(7*101325/1.225*(Math.pow(q/101325+1,1/3.5)-1)); }
function tasFromCas(cas,h,dev){ const at=isa(h,dev), q=101325*(Math.pow(1+0.2*Math.pow(cas/340.294,2),3.5)-1); return at.a*Math.sqrt(5*(Math.pow(q/at.p+1,1/3.5)-1)); }

function create(o){
  o=o||{};
  const M={N:o.N||-40,E:o.E||0,h:o.h||0,tas:0,gam:0,chi:0,th:0,phi:0,psi:0,q:0,p:0,alpha:0,nz:1,nzC:1,gnd:true,crash:'',
    gs:0,vs:0,ias:0,mach:0,ra:0,
    ctl:{sx:0,sy:0,rud:0,tiller:0,brkL:0,brkR:0,tla:[0,0],flapLv:0,spd:0,gearLv:1,ths:0,park:1,spArm:0,abrk:0,rudTrim:0},
    slat:0,flap:0,conf:0,gear:1,gearUp:false,gearDown:true,gearT:0,sp:0,
    fbw:{law:'NORMAL',flare:false,thHold:0,phiHold:0,protA:false,floor:false,hsp:false,flareT:0,flareTh:0,trim:0},
    wind:{dir:0,spd:0},turb:0,oatDev:0,qnh:1013,
    n1Cmd:[19.6,19.6],tla:[0,0],toPower:false,flx:0,thrust:[0,0],
    ap:mkAP(),
    gw:o.gw||64000,cg:28,
    t:0,touch:null,events:[]};
  if(o.air){ Object.assign(M,{h:o.h,gnd:false,ias:o.ias,tas:tasFromCas(o.ias*KT,o.h),chi:(o.hdg||0)*D2R,psi:(o.hdg||0)*D2R,gear:0,gearUp:true,gearDown:false}); M.ctl.gearLv=0; M.ctl.park=0; M.alpha=4*D2R; M.th=M.alpha; }
  return M;
}
/* ---------- FCU / auto flight state ---------- */
function mkAP(){ return {ap1:false,ap2:false,fd1:true,fd2:true,athr:false,athrArm:false,
  spd:{man:false,v:250,mach:false},hdg:{man:true,v:360,trk:false,sel:false},alt:{v:5000,step:100},vs:{v:0,dash:true,fpa:false},
  loc:false,appr:false,exped:false,lat:'',latArm:'',vert:'',vertArm:'',thr:'',thrMsg:'',fmaT:{},app:'',
  vr:140,v1:135,v2:145,thrRed:1500,acc:1500,vapp:137,flexT:0,
  lim:'',retard:false,landStage:'',gaMode:false,alphaFloor:false,toga:false,lvrClb:false,disc:{ap:0,athr:0}};
}

/* ---------- configuration and speeds ---------- */
const CONFS=[[0,0],[18,0],[18,10],[22,15],[22,20],[27,35]];
function confIndex(M){ const s=M.slat, f=M.flap; let best=0, d=1e9; CONFS.forEach((c,i)=>{ const x=Math.abs(c[0]-s)+Math.abs(c[1]-f); if(x<d){ d=x; best=i; } }); return best; }
function cl(M){ // CL0 and CLmax interpolated with the slat / flap positions
  let dCL=0, CLmax=AC.CONF[0][4], dCD=0;
  const sF=M.slat/27, fF=M.flap/35;
  dCL=0.18*sF+0.62*Math.pow(fF,0.9); CLmax=1.52+0.40*sF+0.88*fF; dCD=0.004*sF+0.061*fF*fF+0.004*fF;
  return {dCL,CLmax,dCD}; }
function speeds(M){
  const at=isa(M.h,M.oatDev), W=M.gw*g0;
  const vs=CLm=>Math.sqrt(2*W/(1.225*AC.S*CLm))/KT; // VS1G (CAS, kt)
  const c=cl(M), vs1g=vs(c.CLmax), i=M.conf;
  const vls=Math.max(vs1g*(M.gnd||M.tlaTOGA&&M.h<400?1.13:1.23),0);
  const gd=Math.max(140,2*M.gw/1000+85+Math.max(0,(M.h/FT-20000)/1000));
  const F=vs(1.52+0.40*18/27+0.88*15/35)*1.26, Ssp=vs(1.52)*1.23;
  const vfe=AC.CONF[i][6], vfeN=i<5?AC.CONF[i+1][6]:null;
  const vmoC=Math.min(AC.VMO,casFromTas(AC.MMO*at.a,M.h,M.oatDev)/KT);
  let vmax=Math.min(vmoC,i>0?vfe:999,M.gear>0.01?AC.VLE:999);
  const vapr=vs1g*1.06, vamax=vs1g*1.0, vfloor=vs1g*1.03;
  return {vs1g,vls,gd,F,S:Ssp,vfe,vfeN,vmax,vmo:vmoC,vaprot:vapr,vamax,vfloor,vapp:Math.max(vs(2.8)*1.23+5,vls+5)};
}

/* ---------- thrust: lever angle -> N1 (rating) -> thrust ---------- */
function n1Rating(M,k){ // N1 for each rating at this altitude and temperature (typical CFM-like values)
  const h=M.h/FT, t=isa(M.h,M.oatDev).T-273.15;
  const toga=clamp(93.5-Math.max(0,t-30)*0.35+Math.min(h,10000)/10000*1.5,80,95);
  const flx=M.flx>t?toga-(M.flx-Math.max(t,30))*0.38:toga;
  const mct=clamp(toga-2.5+Math.min(h,35000)/35000*1.5,80,94.5), clb=clamp(mct-3+Math.min(h,35000)/35000*3.5,78,93);
  return {toga,flx:Math.min(toga,flx),mct,clb}[k]; }
const N1I=19.6;
function leverN1(M,tla){ if(tla<0) return N1I+(-tla/20)*(70-N1I);
  const clb=n1Rating(M,'clb'), mct=M.flx&&M.gnd||M.flxLatched?n1Rating(M,'flx'):n1Rating(M,'mct'), tg=n1Rating(M,'toga');
  if(tla<=TLA.CL) return N1I+(clb-N1I)*(tla/TLA.CL);
  if(tla<=TLA.MCT) return clb+(mct-clb)*((tla-TLA.CL)/(TLA.MCT-TLA.CL));
  return mct+(tg-mct)*((tla-TLA.MCT)/(TLA.TOGA-TLA.MCT)); }
function thrustOf(M,n1,rev){ const at=isa(M.h,M.oatDev), m=M.mach;
  const f=clamp(Math.pow(Math.max(0,(n1-N1I))/(93.5-N1I),1.75),0,1.12)+0.045;
  let T=AC.T0*f*Math.pow(at.sig,0.78)*(1-0.62*m+0.26*m*m);
  if(AC.prop){ /* turboprop: shaft power × propeller efficiency / airspeed, capped by the static thrust */ T=Math.min(AC.T0*f*Math.pow(at.sig,0.7),AC.prop*0.8*f*Math.pow(at.sig,0.75)/Math.max(M.tas,20)); }
  if(rev) T=-AC.T0*0.38*clamp((n1-N1I)/(70-N1I),0,1)*Math.pow(at.sig,0.8)-AC.T0*0.02;
  return T; }

/* ---------- auto flight: commands for the FBW (vertical: flight path angle; lateral: bank) and A/THR ---------- */
function apLogic(M,dt,sys,sp,nav){
  const A=M.ap, h=M.h/FT, ias=M.ias, vs=M.vs/FPM, ra=M.ra/FT, onG=M.gnd;
  const apOn=A.ap1||A.ap2, fd=A.fd1||A.fd2;
  if(A.vert==='SRS') A.clbPh=true;
  if(['OP DES','DES','EXPED DES','G/S*','G/S'].includes(A.vert)||A.appr||A.loc) A.clbPh=false;
  const tgtSpd=targetSpeed(M,sp);
  A.tgtSpd=tgtSpd;
  // ----- take-off: both levers in FLX or TOGA on the ground -> SRS / RWY, MAN FLX / MAN TOGA, A/THR armed (blue)
  const tla=M.tla, toga=tla[0]>=TLA.TOGA-0.5||tla[1]>=TLA.TOGA-0.5, flxmct=!toga&&(tla[0]>=TLA.MCT-0.5||tla[1]>=TLA.MCT-0.5);
  if(onG&&(toga||flxmct)&&A.vert!=='SRS'&&!A.gaMode){ A.vert='SRS'; A.lat=ias<30?'RWY':'RWY TRK'; A.vertArm='CLB'; A.latArm=nav.fp?'NAV':''; A.athr=false; A.athrArm=true; M.flxLatched=flxmct&&M.flx>0; A.srsHdg=M.psi; A.toga=true; }
  if(onG&&!toga&&!flxmct&&A.vert==='SRS'&&M.gs<1) { A.vert=''; A.lat=''; A.vertArm=''; A.athrArm=false; }
  // go-around: TOGA in flight with flaps out
  const togaEdge=toga&&!A.togaPrev; A.togaPrev=toga;
  if(!onG&&togaEdge&&M.conf>0&&!A.gaMode&&A.vert!=='SRS'){ A.gaMode=true; A.vert='SRS'; A.lat='GA TRK'; A.chiGa=M.chi; A.vertArm='CLB'; A.athrArm=true; A.athr=false; A.appr=false; A.loc=false; A.landStage=''; A.latArm=nav.fp?'NAV':''; }
  // ----- thrust reduction: at THR RED altitude "LVR CLB" flashes until the levers are in CL; then A/THR becomes active
  const red=A.athrArm&&!onG&&ra>A.thrRed;
  A.lvrClb=red&&(tla[0]>TLA.CL+0.5||tla[1]>TLA.CL+0.5);
  if(A.athrArm&&!onG&&tla.every(x=>x<=TLA.CL+0.5&&x>0.5)){ A.athr=true; A.athrArm=false; M.flxLatched=false; }
  // ----- acceleration altitude: SRS -> CLB (or OP CLB), speed target to managed climb speed
  if(A.vert==='SRS'&&!onG&&ra>A.acc){ A.vert=A.lat==='NAV'&&M.vnavFn?'CLB':'OP CLB'; A.vertArm='ALT'; if(A.gaMode){ A.gaMode=false; } A.toga=false; }
  if(A.vert==='SRS'&&!onG&&A.lat==='RWY'&&ra>30){ A.lat='RWY TRK'; A.srsHdg=M.chi; }
  if(A.latArm==='NAV'&&nav.fp&&!onG&&ra>(A.gaMode?100:30)){ A.lat='NAV'; A.latArm=''; }
  if(A.lat==='NAV'&&!nav.fp) A.lat='HDG';
  // ----- managed vertical (CLB / DES): constraints from the flight plan limit the altitude target
  const managedV=A.vert==='CLB'||A.vert==='DES'||A.vert.startsWith('ALT CST');
  const climbingM=A.vert==='CLB'||(A.vert.startsWith('ALT CST')&&A.cstClimb);
  const vn=managedV&&M.vnavFn?M.vnavFn(M,climbingM,A.alt.v):null; A.vn=vn;
  if(managedV&&A.lat!=='NAV'&&!onG){ A.vert=A.vert==='DES'||(!A.cstClimb&&A.vert.startsWith('ALT CST'))?'V/S':(A.vert==='CLB'?'OP CLB':'V/S'); if(A.vert==='V/S'){ A.vs.v=Math.round(vs/100)*100; A.vs.dash=false; } }
  if(A.vert==='ALT CST'&&vn&&Math.abs(vn.alt-(A.altHold||vn.alt))>60){ A.vert=A.cstClimb?'CLB':'DES'; A.vertArm=A.vertArm.replace(/^(CLB|DES)/,'ALT'); } // constraint passed: climb / descend on
  if(A.vert==='ALT CST'&&!vn&&Math.abs(A.alt.v-h)>250){ A.vert=A.cstClimb?'CLB':'DES'; A.vertArm=A.vertArm.replace(/^(CLB|DES)/,'ALT'); }
  // ----- altitude capture logic
  const altT=(A.vert==='CLB'||A.vert==='DES')&&vn?vn.alt:A.alt.v, dAlt=altT-h, cstCap=(A.vert==='CLB'||A.vert==='DES')&&vn&&vn.alt!==A.alt.v;
  if(['OP CLB','CLB','OP DES','DES','V/S','FPA','EXPED CLB','EXPED DES'].includes(A.vert)){
    const climbing=A.vert.includes('CLB')||(A.vert==='V/S'&&A.vs.v>0)||((A.vert==='FPA')&&A.vs.fpaV>0);
    const capt=Math.max(150,Math.abs(vs)*0.18);
    if((climbing&&dAlt>0&&dAlt<capt)||(!climbing&&dAlt<0&&-dAlt<capt)){ const gsA=/G\/S|FINAL/.exec(A.vertArm); if(cstCap){ A.cstClimb=climbing; A.vert='ALT CST*'; A.cstAlt=altT; A.vertArm=((climbing?'CLB':'DES')+(gsA?' '+gsA[0]:'')); } else { A.vert='ALT*'; A.vertArm=gsA?gsA[0]:''; } A.capT=0; }
  }
  /* second line: ALT armed (blue) whenever a climb or descent mode is heading for the FCU altitude, with G/S or FINAL kept */
  if(['OP CLB','CLB','OP DES','DES','V/S','FPA','EXPED CLB','EXPED DES'].includes(A.vert)){ const up=A.vert.includes('CLB')||(A.vert==='V/S'&&A.vs.v>0)||(A.vert==='FPA'&&A.vs.fpaV>0), tow=up?dAlt>0:dAlt<0, g=/G\/S|FINAL/.exec(A.vertArm);
    if(!/^(CLB|DES)/.test(A.vertArm)) A.vertArm=((tow?'ALT':'')+(g?' '+g[0]:'')).trim(); }
  if(A.vert==='ALT*'&&Math.abs(dAlt)<25&&Math.abs(vs)<150){ A.vert='ALT'; A.altHold=altT; }
  if(A.vert==='ALT CST*'){ const e=(A.cstAlt||h)-h; if(Math.abs(e)<25&&Math.abs(vs)<150){ A.vert='ALT CST'; A.altHold=A.cstAlt; } }
  if(A.vert==='ALT'&&Math.abs(altT-(A.altHold||altT))>0&&A.altHold!=null&&false){}
  // ----- LOC / G/S
  const L=nav.loc, Gs=nav.gs;
  if(A.latArm==='LOC'&&L.valid&&Math.abs(L.dev)<1.6){ A.lat='LOC*'; A.latArm=''; A.locT=0; }
  if(A.lat==='LOC*'){ A.locT+=dt; if(Math.abs(L.dev)<0.12&&A.locT>3) A.lat='LOC'; }
  if(A.vertArm.includes('G/S')&&Gs.valid&&(A.lat==='LOC'||A.lat==='LOC*')&&Math.abs(Gs.dev)<0.25){ A.vert='G/S*'; A.vertArm=''; A.gsT=0; }
  if(A.vert==='G/S*'){ A.gsT+=dt; if(Math.abs(Gs.dev)<0.15&&A.gsT>3) A.vert='G/S'; }
  if(A.appr&&A.vert==='G/S'&&A.lat==='LOC'&&ra<400&&ra>0) { A.vert='LAND'; A.lat='LAND'; }
  if(A.vert==='LAND'&&ra<40) { A.vert='FLARE'; A.lat='FLARE'; }
  if(A.vert==='FLARE'&&onG){ A.vert='ROLL OUT'; A.lat='ROLL OUT'; }
  // ----- vertical command (flight path angle, rad) ----
  let gamC=null, phiC=null;
  const Vtas=Math.max(M.tas,30);
  const gamFromVs=v=>Math.asin(clamp(v*FPM/Vtas,-0.3,0.3));
  const spdOnElev=(lo,hi)=>{ // speed on elevator (open modes, SRS): pitch to hold target speed
    const e=(tgtSpd-ias), acc=M.accel||0; return clamp(M.gam-(e*0.0028-acc*0.035)*-1*1+0*hi,lo,hi); };
  switch(A.vert){
    case 'SRS': { const vt=A.gaMode?Math.max(ias,sp.vls+15):Math.max(A.v2+10,ias>A.v2+15?ias:A.v2+10);
      const e=(vt-ias), acc=M.accel||0; gamC=clamp(M.gam+(-e*0.0035+acc*0.06)*-1*-1*-1,-0.02,18*D2R-M.alpha);
      gamC=clamp(M.gam-(e*0.004-acc*0.05),M.gnd?0:0.02,18*D2R-M.alpha); if(ra<35&&!A.gaMode) gamC=Math.min(gamC,0.16); break; }
    case 'OP CLB': case 'CLB': case 'EXPED CLB': { const e=(tgtSpd-ias), acc=M.accel||0; gamC=clamp(M.gam-(e*0.004-acc*0.05),0.005,15*D2R); break; }
    case 'DES': if(A.vn&&A.vn.pathAlt!=null&&A.vn.dist>0.3){ // geometric path to the next constraint: the V/S it needs at this ground speed
        const need=(h-A.vn.pathAlt)/Math.max(0.3,A.vn.dist-5)*(M.gs/KT)/60; /* reach it a little before the waypoint (turn anticipation) */ A.desSpd=need<1700; const vsT=-clamp(need,300,3500); gamC=gamFromVs(vsT); if(!A.desSpd){ const e=(tgtSpd-ias); gamC=Math.max(gamC,clamp(M.gam-(e*0.004-(M.accel||0)*0.05),-12*D2R,-0.003)); } break; }
      // fall through: no constraint ahead, idle descent on speed
    case 'OP DES': case 'EXPED DES': { A.desSpd=false; const e=(tgtSpd-ias), acc=M.accel||0; gamC=clamp(M.gam-(e*0.004-acc*0.05),-12*D2R,-0.003); break; }
    case 'V/S': gamC=gamFromVs(A.vs.v); break;
    case 'FPA': gamC=A.vs.fpaV*D2R; break;
    case 'ALT CST*': { const vsC=clamp(((A.cstAlt||h)-h)*4.2,-Math.abs(A.capVs||2000),Math.abs(A.capVs||2000)); gamC=gamFromVs(vsC); break; }
    case 'ALT CST': { const vsC=clamp(((A.altHold!=null?A.altHold:h)-h)*2.5,-900,900); gamC=gamFromVs(vsC); break; }
    case 'ALT*': { const vsC=clamp(dAlt*4.2,-Math.abs(A.capVs||2000),Math.abs(A.capVs||2000)); gamC=gamFromVs(vsC); break; }
    case 'ALT': { const vsC=clamp(((A.altHold!=null?A.altHold:altT)-h)*2.5,-900,900); gamC=gamFromVs(vsC); break; }
    case 'G/S*': case 'G/S': case 'LAND': { const dev=Gs.valid?Gs.dev:0; gamC=-ILS.gp*D2R+clamp(dev*0.35*2.6,-1.6,1.6)*D2R; break; }
    case 'FLARE': { const vsT=clamp(-ra*9-60,-800,-120); gamC=gamFromVs(vsT); break; }
    case 'ROLL OUT': gamC=0; break;
  }
  if(A.vert!=='ALT*'&&A.vert!=='ALT CST*') A.capVs=Math.max(500,Math.abs(vs));
  // ----- lateral command (bank, rad) -----
  const trk=w360(M.chi*R2D), hdg=w360(M.psi*R2D);
  const bankLim=A.lat==='LOC*'||A.lat==='LOC'?25:(ias<200?25:30);
  const toward_=(err)=>clamp(err*1.15,-bankLim,bankLim)*D2R;
  switch(A.lat){
    case 'HDG': case 'TRK': { const err=w180(A.hdg.v-(A.hdg.trk?trk:hdg)); phiC=toward_(err); break; }
    case 'GA TRK': { const err=w180((A.chiGa||M.chi)*R2D-trk); phiC=toward_(err); break; }
    case 'RWY': case 'RWY TRK': { const err=w180((A.srsHdg||M.psi)*R2D-trk); phiC=toward_(err); break; }
    case 'NAV': { const err=w180(nav.dtk-trk); phiC=toward_(err+nav.xtkCorr); break; }
    case 'LOC*': case 'LOC': case 'LAND': case 'FLARE': case 'ROLL OUT': {
      const dev=L.valid?L.dev:0, xtkDeg=clamp(dev*(A.lat==='LOC*'?14:9)*clamp(L.distNm/8,0.5,1.6),-35,35);
      const err=w180(ILS.crs+xtkDeg-trk); phiC=toward_(err); if(A.lat==='FLARE'||A.lat==='ROLL OUT') phiC=clamp(phiC,-3*D2R,3*D2R); break; }
  }
  if(!A.lat&&!onG) { A.lat='HDG'; A.hdg.v=Math.round(hdg); }
  if(!A.vert&&!onG) { A.vert='V/S'; A.vs.v=Math.round(vs/100)*100; A.vs.dash=false; }
  A.gamC=gamC; A.phiC=phiC;
  // ----- A/THR -----
  let thrMode='';
  const active=A.athr&&!onG||A.athr&&A.vert==='ROLL OUT';
  /* FMA column 1, as in the APS FMA manual: an engine out moves the active limit from CL to MCT. With A/THR active, levers set
     beyond the limit put A/THR back to armed (MAN THR / MAN MCT / MAN TOGA). TOGA LK after alpha floor holds TOGA thrust until
     A/THR is disconnected. */
  const eo=sys?sys.eng.filter(e=>e.n1>15).length===1:false, lmt=eo?TLA.MCT:TLA.CL, tMax=Math.max(tla[0],tla[1]);
  if(A.athr&&!onG&&!A.alphaFloor&&!A.thrLk&&tMax>lmt+0.5){ A.athr=false; A.athrArm=true; }
  if(A.athr){
    if(['OP CLB','CLB','SRS','EXPED CLB'].includes(A.vert)) thrMode='THR CLB';
    else if(A.vert==='DES') thrMode=A.desSpd?(A.spd.mach?'MACH':'SPEED'):'THR IDLE';
    else if(['OP DES','EXPED DES'].includes(A.vert)) thrMode='THR IDLE';
    else thrMode=A.spd.mach?'MACH':'SPEED';
    if((A.vert==='FLARE'&&ra<30)||A.vert==='ROLL OUT') { thrMode='THR IDLE'; A.retard=true; } else A.retard=false;
    // thrust modes with the levers below the active detent: thrust limited by the levers
    if(thrMode==='THR CLB'&&tMax<lmt-0.5) thrMode='THR LVR';
    else if(thrMode==='THR CLB'&&eo) thrMode='THR MCT';
    if(A.thrLk) thrMode='TOGA LK';
    if(A.alphaFloor) thrMode='A.FLOOR';
  }
  else if(A.athrArm||(onG&&A.toga)){ thrMode=toga?'MAN TOGA':flxmct&&M.flxLatched?'MAN FLX':flxmct?'MAN MCT':tMax>lmt+0.5?'MAN THR':''; }
  // third line: lever requests
  A.lvrMsg='';
  if(A.athrArm&&!onG&&ra>A.thrRed&&!A.gaMode&&A.vert!=='SRS'||A.lvrClb) A.lvrMsg=eo?(Math.abs(tMax-TLA.MCT)>0.5?'LVR MCT':''):(tMax>TLA.CL+0.5?'LVR CLB':'');
  else if(A.athr&&!eo&&!onG&&(Math.abs(tla[0]-TLA.CL)<=0.5)!==(Math.abs(tla[1]-TLA.CL)<=0.5)) A.lvrMsg='LVR ASYM';
  if(A.thrLock){ A.lvrMsg='THR LK'; if(Math.abs(tla[0]-TLA.CL)>0.5||Math.abs(tla[1]-TLA.CL)>0.5) A.thrLock=null; }
  if(A.athr&&tla[0]<=0.5&&tla[1]<=0.5&&A.vert!=='ROLL OUT'&&A.vert!=='FLARE'&&!A.alphaFloor){ A.athr=false; A.athrArm=false; }
  A.thr=thrMode;
  const n1=[0,1].map(i=>{
    const lev=leverN1(M,tla[i]);
    if(tla[i]<0) return lev;
    if(A.thrLock) return A.thrLock[i];
    if(!A.athr) return lev;
    if(A.alphaFloor||A.thrLk) return n1Rating(M,'toga');
    if(thrMode==='THR LVR') return lev;
    const lim=Math.max(N1I,Math.min(lev,leverN1(M,tla[i]<=TLA.CL+0.5?TLA.CL:tla[i])));
    if(thrMode==='THR CLB') return lim;
    if(thrMode==='THR IDLE') return N1I;
    // SPEED / MACH: N1 from the speed error and the acceleration
    A.n1s=A.n1s==null?(M.n1Act||50):A.n1s;
    const e=tgtSpd-ias, acc=M.accel||0;
    A.n1s=clamp(A.n1s+(e*1.3-acc*3.2)*dt,N1I,lim);
    return A.n1s; });
  if(!A.athr||thrMode!=='SPEED'&&thrMode!=='MACH') A.n1s=null;
  M.n1Cmd=n1;
  A.apOn=apOn; A.fdOn=fd;
}
function targetSpeed(M,sp){ const A=M.ap, h=M.h/FT;
  if(A.spd.man) return A.spd.mach?casFromTas(A.spd.v*isa(M.h,M.oatDev).a,M.h,M.oatDev)/KT:A.spd.v;
  // managed (FMGC defaults, no flight plan constraints in this version): T.O V2+10, climb 250 below FL100 then ECON,
  // descent 250 below FL100, approach: VAPP from CONF 3 / FULL, and green dot / F / S as the configuration needs
  let v;
  if(A.vert==='SRS') v=A.v2+10;
  else if(A.clbPh&&M.conf>=1) v=Math.min(250,sp.vmax-5);
  else if(A.appr||A.apprPh||A.vert.startsWith('G/S')||A.vert==='LAND'||A.vert==='FLARE'||M.conf>=1&&!A.gaMode) v=M.conf>=4?Math.max(sp.vls+5,A.vapp):M.conf===3?sp.F+0:M.conf>=2?sp.F:M.conf===1?sp.S:sp.gd;
  else if(h<10000) v=Math.max(250,sp.gd);
  else v=Math.min(300,casFromTas(0.78*isa(M.h,M.oatDev).a,M.h,M.oatDev)/KT);
  if(M.conf>=1&&!A.gaMode&&A.vert!=='SRS') v=Math.min(v,sp.vmax-5);
  A.managedSpd=v; return v; }

/* ---------- navigation receivers (ILS 36) ---------- */
function navCalc(M){
  const dN=ILS.locN-M.N, dE=0-M.E, dist=Math.hypot(dN,dE), brg=w360(Math.atan2(dE,dN)*R2D);
  // LOC deviation in dots (1 dot = 0.8° here, full scale ±2 dots)
  const ang=w180(brg-ILS.crs), locDev=clamp(ang/0.8,-2.5,2.5), locValid=dist<25*NM&&Math.abs(ang)<35&&M.N<ILS.locN;
  const gN=ILS.gsN-M.N, gDist=Math.hypot(gN,M.E), elev=Math.atan2(M.h-RWY.elev,gDist)*R2D;
  const gsDev=clamp((ILS.gp-elev)/0.35,-2.5,2.5)*-1, gsValid=locValid&&gDist<20*NM&&M.N<ILS.gsN-50;
  return {loc:{valid:locValid,dev:locDev,distNm:dist/NM},gs:{valid:gsValid,dev:-gsDev,distNm:gDist/NM},dme:Math.hypot(M.N-ILS.locN,M.E)/NM,dtk:0,xtkCorr:0}; }

/* ---------- one simulation step ---------- */
function step(M,dt,sys){
  if(M.crash) return;
  M.t+=dt; const C=M.ctl, A=M.ap, at=isa(M.h,M.oatDev), W=M.gw*g0;
  // surfaces
  // lever 1 gives CONF 1+F when selected below 100 kt (or on the ground), CONF 1 when selected in flight from CONF 0 above 100 kt
  if(C.flapLv!==M.lvPrev){ M.onePlusF=C.flapLv===1&&(M.gnd||M.ias<100||(M.lvPrev||0)>1); M.lvPrev=C.flapLv; }
  const ci=C.flapLv===0?0:C.flapLv===1?(M.onePlusF?2:1):C.flapLv+1;
  const flapT=CONFS[ci].slice();
  const hydOK=!sys||sys.hyd.g>1500||sys.hyd.y>1500, slatHyd=!sys||sys.hyd.g>1500||sys.hyd.b>1500;
  if(slatHyd) M.slat=toward(M.slat,flapT[0],0.85,dt);
  if(hydOK) M.flap=toward(M.flap,flapT[1],0.95,dt);
  // CONF 1+F retracts to CONF 1 at 210 kt (flap load relief)
  if(C.flapLv===1&&M.ias>210&&!M.gnd&&M.onePlusF){ M.onePlusF=false; }
  M.conf=confIndex(M); M.flapLv=C.flapLv;
  // gear: 10 s cycle on green hydraulics
  const gUp=C.gearLv===0;
  if(!M.gnd&&(!sys||sys.hyd.g>1500)) M.gear=toward(M.gear,gUp?0:1,0.1,dt);
  M.gearUp=M.gear<0.01; M.gearDown=M.gear>0.99;
  // speed brake / ground spoilers
  const both=[0,1].map(i=>M.tla[i]<=0.5);
  let spT=C.spd;
  if(M.gnd&&M.gs*1/KT>60&&C.spArm&&both[0]&&both[1]) M.gsplr=true; // touchdown or RTO
  if(M.gsplr&&(M.tla.some(x=>x>TLA.CL*0.5)||M.gs/KT<5)) M.gsplr=false;
  if(M.gsplr) spT=1;
  if(!M.gnd&&(M.conf>=5||M.tla.some(x=>x>TLA.MCT-1))) spT=0; // auto retraction
  M.sp=toward(M.sp,spT,1.5,dt);
  // engines: thrust lever angle
  M.tla=[C.tla[0],C.tla[1]];
  M.toPower=M.tla.every(x=>x>=TLA.MCT-0.5)||M.tla.some(x=>x>=TLA.TOGA-0.5);
  const rev=[0,1].map(i=>M.tla[i]<0);
  if(!M.gnd) for(let i=0;i<2;i++) if(rev[i]) M.tla[i]=0;
  // air data
  const wN=-Math.cos(M.wind.dir*D2R)*M.wind.spd*KT, wE=-Math.sin(M.wind.dir*D2R)*M.wind.spd*KT;
  const Vh=M.tas*Math.cos(M.gam), vN=Vh*Math.cos(M.chi)+(M.gnd?0:wN), vE=Vh*Math.sin(M.chi)+(M.gnd?0:wE);
  // (the airborne velocity is air-relative plus wind; on the ground the aircraft rolls along its heading)
  const casMs=casFromTas(M.tas,M.h,M.oatDev);
  const prevIas=M.ias; M.ias=casMs/KT; M.mach=M.tas/at.a; M.accel=lag(M.accel||0,(M.ias-prevIas)/Math.max(dt,1e-3),0.6,dt);
  const qd=0.5*at.rho*M.tas*M.tas;
  const sp=speeds(M); M.spds=sp;
  const navR=navCalc(M); M.nav=navR;
  if(M.lnavFn){ const r=M.lnavFn(M); if(r){ navR.dtk=r.dtk; navR.xtkCorr=r.xtkCorr; navR.fp=r; } }
  // thrust
  apLogic(M,dt,sys,sp,navR);
  let T=0; const n1=[0,1].map(i=>sys?sys.eng[i].n1:M.n1Cmd[i]);
  M.n1Act=(n1[0]+n1[1])/2;
  for(let i=0;i<2;i++){ const run=!sys||sys.eng[i].run; M.thrust[i]=run?thrustOf(M,n1[i],rev[i]&&M.gnd):(M.gnd?0:-AC.T0*0.02); T+=M.thrust[i]; }
  M.asym=(M.thrust[0]-M.thrust[1]);
  // aerodynamic coefficients
  const c=cl(M), gearCD=AC.gearCD*M.gear, spCD=AC.spCD*M.sp;
  M.fbw.law=M.conv?'CONV':(sys?sys.law:'NORMAL');
  const law=M.fbw.law;
  // ----- FBW normal law: sidestick -> load factor demand (pitch), roll rate demand (roll)
  const ap=A.ap1||A.ap2;
  let sy=C.sy, sx=C.sx;
  /* auto-fly (a320auto.js): a second pilot flying by hand. It gives way to the AP when that is engaged and to any input on the sidestick. */
  const AU=M.auto&&M.auto.on?M.auto:null;
  if(AU&&M.gnd&&Math.abs(C.sy)<0.02&&AU.sy) sy=AU.sy;
  if(ap&&(Math.abs(C.sy)>0.55||Math.abs(C.sx)>0.55)){ A.ap1=A.ap2=false; M.events.push('apdisc-forced'); }
  const apAct=(A.ap1||A.ap2);
  const flapsOut=M.conf>0;
  const nzMax=flapsOut?2.0:2.5, nzMin=flapsOut?0:-1;
  const ra=M.ra/FT;
  if(M.gnd){
    // ground: rotation with elevator authority from dynamic pressure; nose wheel on the ground at θ=0
    const auth=clamp((M.ias-60)/70,0,1);
    let thRate=(sy*5.0*auth)*D2R;
    if(apAct&&A.vert==='SRS') thRate=0;
    if(sy<0.05&&M.th>0) thRate=-1.5*D2R*clamp(1-qd*AC.S*(AC.CL0+c.dCL+AC.CLa*M.th)/W,0.15,1);
    M.th=clamp(M.th+thRate*dt,0,11.5*D2R);
    if(M.th>=11.4*D2R&&M.ias<140&&!M.tail){ M.tail=true; M.events.push('tailstrike'); }
    M.alpha=M.th; M.gam=0;
    const CL=AC.CL0+c.dCL+AC.CLa*M.alpha*(1+0.15)- AC.spLoss*M.sp; // ground effect
    const L=qd*AC.S*Math.max(0,CL);
    M.nz=L/W;
    // longitudinal forces on the ground
    const CD=AC.CD0+c.dCD+AC.k*CL*CL*0.6+gearCD+spCD;
    const D=qd*AC.S*CD, N=Math.max(0,W-L);
    let brk=Math.max(C.brkL,C.brkR,AU?AU.brk||0:0);
    if(C.park) brk=1;
    // autobrake: LO 1.7, MED 3.0 m/s² from touchdown (with ground spoilers); MAX on an RTO above 72 kt
    if(M.gsplr&&C.abrk>0) M.abLatch=true;
    if(M.abLatch&&(C.abrk===0||C.brkL>0.6||M.tla.some(x=>x>TLA.CL*0.5))) M.abLatch=false;
    if(M.abLatch&&C.abrk>0&&M.tas>0.05){ const dec=[0,1.7,3.0,6][C.abrk]; M.abActive=true; brk=Math.max(brk,clamp((dec*M.gw-(D-T))/(0.55*N+1),0,1)); } else M.abActive=false;
    const brkF=brk*0.55*N*(M.tas>0.3?1:0), roll=0.011*N;
    let ax=(T-D-roll*(M.tas>0.05?1:0)-brkF)/M.gw;
    if(M.tas<=0.05&&T<roll+brkF) ax=Math.max(0,ax);
    M.tas=Math.max(0,M.tas+ax*dt);
    if(M.tas<0.05&&brk>0.3) M.tas=0;
    // steering: tiller up to 75° (below 20 kt, fading to 0 at 70 kt), pedals ±6°; yaw rate = V·tan(δ)/wheelbase
    const tilA=75*clamp(1-(M.gs/KT-20)/50,0,1), tilC=C.tiller+(AU?AU.til||0:0), rudC=C.rud+(AU?AU.rud||0:0), steer=(clamp(tilC,-1,1)*tilA+clamp(rudC,-1,1)*6*clamp(1-(M.gs/KT-100)/40,0,1))*D2R;
    const sysNWS=!sys||(sys.hyd.y>1500);
    const r=sysNWS?M.tas*Math.tan(steer)/AC.wheelbase:0;
    const rudYaw=C.rud*0.02*clamp((M.ias-40)/80,0,1)+(M.asym/(AC.T0*2))*-0.015*clamp(M.ias/80,0,1);
    M.psi+=(r+rudYaw)*dt; M.chi=M.psi; M.phi=lag(M.phi,0,0.3,dt);
    M.p=0;
    M.vs=0; M.h=RWY.elev;
    // lift-off
    if(L>W*1.0&&M.ias>100&&M.th>3*D2R&&!M.gsplr){ M.gnd=false; M.gam=0.01; M.events.push('liftoff'); M.fbw.thHold=M.th; M.liftT=M.t; }
    if(!onPaved(M)&&M.gs/KT>30){ M.crash='Runway excursion'; }
  } else {
    // ----- normal law in flight -----
    // pitch: neutral stick holds the flight path (automatic trim). Pitch attitude limits +30°/−15° (25° in CONF FULL slow),
    // load factor limits, high angle of attack protection (αprot..αmax), alpha floor (A/THR TOGA), high speed protection.
    const cosPhi=Math.cos(M.phi), cg=Math.cos(M.gam);
    let nzD;
    const vAlpha=M.ias<sp.vaprot+2;
    const auP=!apAct&&AU&&AU.gamC!=null&&Math.abs(sy)<0.02&&law!=='CONV';
    if(auP){ const e=AU.gamC-M.gam; nzD=cg/Math.max(0.5,cosPhi)+clamp(e*M.tas/g0*1.2,-0.35,0.35); M.fbw.gamHold=null; M.fbw.flare=false; }
    else if(apAct&&A.gamC!=null){ // the AP flies a flight path angle
      const e=A.gamC-M.gam; nzD=cg/Math.max(0.5,cosPhi)+clamp(e*M.tas/g0*1.2,-0.35,0.35);
      if(A.vert==='FLARE'||A.vert==='ROLL OUT') nzD=cg/Math.max(0.5,cosPhi)+clamp(e*M.tas/g0*1.5,-0.3,0.3);
    } else if(law==='CONV'){ // conventional controls (737): the column adds load factor; speed stability about the trimmed speed; no auto trim, no bank compensation
      if(M.trimSpd==null) M.trimSpd=M.ias;
      nzD=cg+sy*1.15+clamp((M.ias-M.trimSpd)*0.009+(M.accel||0)*0.03,-0.45,0.45);
      M.fbw.gamHold=null; M.fbw.flare=false;
    } else if(law==='NORMAL'||law==='ALTN'){
      const neutral=Math.abs(sy)<0.02;
      if(neutral){ // path hold, bank-compensated up to 33°
        if(M.fbw.gamHold==null) M.fbw.gamHold=M.gam;
        const comp=Math.abs(M.phi)<=33*D2R?cg/Math.max(0.5,cosPhi):cg;
        nzD=comp+clamp((M.fbw.gamHold-M.gam)*M.tas/g0*0.8,-0.2,0.2);
      } else { M.fbw.gamHold=null; nzD=cg/Math.max(0.5,cosPhi)+(sy>0?sy*(nzMax-1):sy*(1-nzMin)); }
      if(neutral&&M.fbw.gamHold!=null&&Math.abs(M.q)>0) {}
      // flare mode: below 50 ft RA in manual flight the law memorises the attitude and lowers it by 2° over 8 s, so a flare needs a pull
      if(ra<50&&!M.fbw.flare&&M.vs<0){ M.fbw.flare=true; M.fbw.flareTh=M.th; M.fbw.flareT=0; }
      if(M.fbw.flare){ M.fbw.flareT+=dt; if(ra>100) M.fbw.flare=false;
        const thT=M.fbw.flareTh-2*D2R*Math.min(1,M.fbw.flareT/8)+sy*8*D2R; const gT=thT-M.alpha; nzD=cg+clamp((gT-M.gam)*M.tas/g0*1.6,-0.4,0.6); M.fbw.gamHold=null; }
    } else { // direct / mechanical: stick moves the elevator; here: a softer load-factor response without auto trim
      nzD=cg/Math.max(0.5,cosPhi)+sy*0.9+(M.fbw.trim||0);
    }
    nzD=clamp(nzD,nzMin,nzMax);
    // pitch attitude protection
    const thMax=(M.conf>=5?25:30)*D2R, thMin=-15*D2R;
    if(law!=='CONV'){
    if(M.th>thMax-2*D2R&&nzD>cg) nzD=Math.min(nzD,cg+(thMax-M.th)*3);
    if(M.th<thMin+2*D2R&&nzD<cg) nzD=Math.max(nzD,cg-(M.th-thMin)*3); }
    if(law==='CONV'&&apAct) M.trimSpd=M.ias; // the autopilot trims
    // high speed protection: nose-up demand above VMO+6, bank limited to 40°
    M.fbw.hsp=M.ias>sp.vmo+6&&law==='NORMAL';
    if(M.fbw.hsp) nzD=Math.max(nzD,cg+0.15+(M.ias-sp.vmo-6)*0.02);
    // the aircraft follows the demand with a short lag, limited by the lift available (α max)
    M.nzC=lag(M.nzC,nzD,law==='NORMAL'?0.45:0.7,dt);
    const CLreq=M.nzC*W/(qd*AC.S), CLmaxEff=c.CLmax-AC.spLoss*M.sp*0.5;
    // high angle of attack protection: neutral stick holds αprot, full aft αmax; in alternate law the aircraft can stall
    const CLaprot=CLmaxEff*0.89, CLamax=CLmaxEff*0.97;
    let CL=CLreq;
    if(law==='NORMAL'){ const lim=sy>0.02?CLaprot+(CLamax-CLaprot)*sy:CLaprot; if(CL>lim&&(vAlpha||CL>lim)){ CL=lim; M.fbw.protA=true; } else M.fbw.protA=CL>CLaprot*0.98; }
    else if(CL>CLmaxEff){ CL=CLmaxEff*0.8; M.stall=true; } else M.stall=false;
    M.alpha=(CL-AC.CL0-c.dCL+AC.spLoss*M.sp)/AC.CLa;
    const L=qd*AC.S*CL; M.nz=L/W;
    // alpha floor (A/THR): α above the floor threshold in normal law, not below 100 ft RA in landing
    const CLfloor=CLmaxEff*0.92;
    if(A.athr||A.athrArm||A.alphaFloor){ if(law==='NORMAL'&&CL>=CLfloor&&ra>100&&!A.alphaFloor){ A.alphaFloor=true; A.athr=true; M.events.push('afloor'); } }
    if(A.alphaFloor&&CL<CLfloor*0.85) { A.alphaFloor=false; A.toga=true; A.thrLk=true; }
    const CD=AC.CD0+c.dCD+AC.k*CL*CL+gearCD+spCD+(M.mach>0.74?Math.pow(Math.max(0,M.mach-0.74),2)*1.6:0);
    const D=qd*AC.S*CD;
    // point-mass equations
    const Lv=L*Math.cos(M.phi), Lh=L*Math.sin(M.phi);
    M.tas=Math.max(10,M.tas+((T*Math.cos(M.alpha)-D)/M.gw-g0*Math.sin(M.gam))*dt);
    M.gam+=((Lv+T*Math.sin(M.alpha)*Math.cos(M.phi))/(M.gw*M.tas)-g0*Math.cos(M.gam)/M.tas)*dt;
    M.gam=clamp(M.gam,-1.2,1.2);
    M.chi+=(Lh/(M.gw*M.tas*Math.max(0.2,Math.cos(M.gam))))*dt;
    // roll: rate demand ±15°/s, bank hold, spiral stability beyond 33°, 67° limit (45° in α / high-speed protection)
    let pD;
    const phiLim=(M.fbw.protA||M.fbw.hsp?45:67)*D2R;
    if(apAct&&A.phiC!=null) pD=clamp((A.phiC-M.phi)*0.6,-5*D2R,5*D2R);
    else if(AU&&AU.phiC!=null&&Math.abs(sx)<0.02&&law==='NORMAL'){ pD=clamp((AU.phiC-M.phi)*0.6,-5*D2R,5*D2R); M.fbw.phiHold=null; }
    else if(Math.abs(sx)>0.02){ pD=sx*15*D2R; M.fbw.phiHold=null; }
    else { if(M.fbw.phiHold==null) M.fbw.phiHold=M.phi; if(Math.abs(M.phi)>33*D2R) M.fbw.phiHold=Math.sign(M.phi)*33*D2R; pD=clamp((M.fbw.phiHold-M.phi)*1.2,-5*D2R,5*D2R); }
    if(law!=='NORMAL'&&!apAct) pD=sx*15*D2R+(Math.abs(sx)<0.02?M.asym/(AC.T0)*-0.02:0);
    if(M.phi>phiLim&&pD>0) pD=Math.min(pD,(phiLim-M.phi)*2); if(M.phi<-phiLim&&pD<0) pD=Math.max(pD,(-phiLim-M.phi)*2);
    if(Math.abs(M.phi)>phiLim) pD+=-Math.sign(M.phi)*5*D2R;
    M.p=lag(M.p,pD,0.25,dt); M.phi+=M.p*dt;
    // engine out: yaw from asymmetric thrust; in normal law the lateral law limits the sideslip, the pilot uses rudder
    M.beta=clamp((M.asym/(AC.T0*2))*-6*D2R*(1-Math.min(1,Math.abs(C.rud)*1.4))+C.rud*1.5*D2R,-15*D2R,15*D2R);
    // heading = track minus drift (wind) and sideslip
    const drift=Math.atan2(-(wN*Math.sin(M.chi)-wE*Math.cos(M.chi))*1,M.tas)*1;
    M.psi=M.chi-drift*0-M.beta*0.5;
    M.th=M.gam+M.alpha*Math.cos(M.phi);
    M.q=(M.th-(M.thPrev==null?M.th:M.thPrev))/Math.max(dt,1e-3); M.thPrev=M.th;
    M.overspeed=M.ias>sp.vmax+4;
    // touchdown
    M.ra=Math.max(0,M.h-RWY.elev);
  }
  // integrate position
  const Vh2=M.tas*Math.cos(M.gam), vN2=Vh2*Math.cos(M.chi)+(M.gnd?0:wN), vE2=Vh2*Math.sin(M.chi)+(M.gnd?0:wE);
  M.N+=vN2*dt; M.E+=vE2*dt;
  if(!M.gnd){ M.h+=M.tas*Math.sin(M.gam)*dt; M.vs=M.tas*Math.sin(M.gam); }
  M.gs=Math.hypot(vN2,vE2); M.trk=Math.atan2(vE2,vN2);
  M.ra=Math.max(0,M.h-RWY.elev);
  if(!M.gnd&&M.h<=RWY.elev){
    const vsFpm=-M.vs/FPM;
    M.h=RWY.elev; M.touch={vs:vsFpm,ias:M.ias,phi:M.phi*R2D,th:M.th*R2D,gear:M.gearDown,n:M.N,e:M.E};
    if(!M.gearDown||vsFpm>1000||Math.abs(M.phi)>8*D2R||!onPaved(M)&&vsFpm>300) { M.crash=!M.gearDown?'Landed with the gear up':vsFpm>1000?'Hard landing ('+Math.round(vsFpm)+' ft/min)':'Wing strike'; return; }
    if(M.th>11.5*D2R) M.events.push('tailstrike');
    M.gnd=true; M.gam=0; M.vs=0; M.chi=M.psi; M.fbw.flare=false; M.events.push('touchdown');
    if(A.ap1||A.ap2){ if(A.vert!=='ROLL OUT'&&A.vert!=='FLARE'){ A.ap1=A.ap2=false; } }
  }
  if(M.gnd&&(A.vert==='ROLL OUT')&&M.gs/KT<10){ A.ap1=A.ap2=false; A.vert=''; A.lat=''; }
  // automatic pitch trim position (THS) for the display / T.O config check
  if(!M.gnd) M.ths=clamp(lag(M.ths||0,clamp((M.alpha*R2D-3)*0.6+(M.cg-28)*-0.15,-3,10),3,dt),-4,13.5);
  else M.ths=C.ths;
  M.sideAny=Math.abs(C.sx)+Math.abs(C.sy);
}
function onPaved(M){ const al=M.N, xt=M.E; return (al>-120&&al<RWY.len+120&&Math.abs(xt)<RWY.wid/2+8)||(al>-260&&al<RWY.len+60&&xt>-8&&xt<130)||(al>690&&al<950&&xt>100&&xt<300); }

/* ---------- FCU actions ---------- */
function fcu(M,k,v){
  const A=M.ap, h=M.h/FT;
  switch(k){
    case 'spdPull': A.spd.man=true; A.spd.v=A.spd.mach?Math.round(M.mach*100)/100:Math.round(M.ias); break;
    case 'spdPush': A.spd.man=false; break;
    case 'spdTurn': if(!A.spd.man){ A.spd.man=true; A.spd.v=Math.round(A.tgtSpd||M.ias); } A.spd.v=A.spd.mach?clamp(Math.round((A.spd.v+v*0.01)*100)/100,0.10,0.82):clamp(A.spd.v+v,100,399); break;
    case 'spdMach': A.spd.mach=!A.spd.mach; A.spd.v=A.spd.mach?Math.round(M.mach*100)/100:Math.round(M.ias); break;
    case 'hdgTurn': A.hdg.v=w360(Math.round(A.hdg.v+v)); A.hdg.sel=true; if(A.hdg.v===0) A.hdg.v=360; A.hdg.preset=true; break;
    case 'hdgPull': A.lat=A.hdg.trk?'TRK':'HDG'; A.latArm=A.latArm==='NAV'?'':A.latArm; if(A.loc||A.appr){ A.loc=false; A.appr=false; if(A.vert.startsWith('G/S')) A.vert='V/S'; A.vertArm=A.vertArm.replace('G/S','').trim(); A.latArm=''; } break;
    case 'hdgPush': A.latArm='NAV'; A.navArm=true; break;
    case 'trkFpa': A.hdg.trk=!A.hdg.trk; A.vs.fpa=!A.vs.fpa; if(A.lat==='HDG'||A.lat==='TRK') A.lat=A.hdg.trk?'TRK':'HDG'; break;
    case 'altTurn': A.alt.v=clamp(Math.round((A.alt.v+v*A.alt.step)/A.alt.step)*A.alt.step,100,39000); break;
    case 'altStep': A.alt.step=A.alt.step===100?1000:100; break;
    case 'altPull': if(Math.abs(A.alt.v-h)>250){ A.vert=A.alt.v>h?'OP CLB':'OP DES'; A.exped=false; A.vertArm=''; } break;
    case 'altPush': if(Math.abs(A.alt.v-h)>250||A.vert==='ALT CST'){ const nav=A.lat==='NAV'&&M.vnavFn; A.vert=A.alt.v>h?(nav?'CLB':'OP CLB'):(nav?'DES':'OP DES'); A.cstClimb=A.alt.v>h; } break; // managed CLB / DES with NAV, else open
    case 'vsTurn': A.vs.dash=false; if(A.vert!=='V/S'&&A.vert!=='FPA'&&!M.gnd){ A.vs.v=Math.round(M.vs/FPM/100)*100; A.vert=A.vs.fpa?'FPA':'V/S'; A.vs.fpaV=Math.round(M.gam*R2D*10)/10; } if(A.vs.fpa) A.vs.fpaV=clamp(Math.round((A.vs.fpaV+v*0.1)*10)/10,-9.9,9.9); else A.vs.v=clamp(A.vs.v+v*100,-6000,6000); break;
    case 'vsPull': if(!M.gnd){ A.vert=A.vs.fpa?'FPA':'V/S'; A.vs.dash=false; if(A.vs.v==null) A.vs.v=0; } break;
    case 'vsPush': if(!M.gnd){ A.vert='V/S'; A.vs.v=0; A.vs.dash=false; } break; // level off
    case 'loc': if(A.loc){ A.loc=false; A.latArm=''; if(A.lat.startsWith('LOC')) A.lat='HDG'; } else { A.loc=true; A.appr=false; A.latArm='LOC'; A.vertArm=A.vertArm.replace('G/S','').trim(); } break;
    case 'appr': if(A.appr){ A.appr=false; A.loc=false; A.latArm=''; A.vertArm=A.vertArm.replace('G/S','').trim(); } else { A.appr=true; A.loc=false; if(!A.lat.startsWith('LOC')) A.latArm='LOC'; A.vertArm=(A.vertArm.replace('G/S','').trim()+' G/S').trim(); } break;
    case 'exped': if(!M.gnd&&Math.abs(A.alt.v-h)>250){ A.vert=A.alt.v>h?'EXPED CLB':'EXPED DES'; A.spd.man=false; } break;
    case 'ap1': case 'ap2': { const on=!A[k]; if(on&&(M.gnd&&!(M.liftT>0))) return 'AP: not on the ground'; if(on&&!M.gnd&&M.ra/FT<100&&!A.appr) {} A[k]=on; if(on){ if(!A.appr) A[k==='ap1'?'ap2':'ap1']=false; if(!A.lat) A.lat='HDG'; if(!A.vert) { A.vert='V/S'; A.vs.v=Math.round(M.vs/FPM/100)*100; } } else { M.events.push('apdisc'); } break; }
    case 'athr': if(A.athr||A.athrArm){ if(A.athr&&!M.gnd&&M.tla.every(x=>Math.abs(x-TLA.CL)<=0.5)) A.thrLock=M.n1Cmd.slice(); A.athr=false; A.athrArm=false; A.alphaFloor=false; A.thrLk=false; M.events.push('athrdisc'); } else { if(M.gnd) A.athrArm=true; else if(M.tla.every(x=>x>0.5&&x<=TLA.CL+0.5)) A.athr=true; else A.athrArm=true; } break;
    case 'fd1': A.fd1=!A.fd1; if(!A.fd1&&!A.fd2&&!A.ap1&&!A.ap2){ A.lat=''; A.vert=''; } break;
    case 'fd2': A.fd2=!A.fd2; if(!A.fd1&&!A.fd2&&!A.ap1&&!A.ap2){ A.lat=''; A.vert=''; } break;
    case 'instDisc': if(A.ap1||A.ap2){ A.ap1=A.ap2=false; M.events.push('apinst'); } break;
    case 'athrInst': if(A.athr||A.athrArm){ A.athr=false; A.athrArm=false; A.thrLk=false; A.alphaFloor=false; A.thrLock=null; M.events.push('athrinst'); } break;
  }
  return null;
}

G.A320FM={create,step,fcu,speeds,isa,casFromTas,tasFromCas,leverN1,n1Rating,TLA,AC,RWY,ILS,KT,FT,FPM,NM,D2R,R2D,w360,w180,clamp,navCalc,targetSpeed};
})(typeof window!=='undefined'?window:globalThis);
