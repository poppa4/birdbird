/* Birdbird – afcore.js: the pure logic behind the Automation and warnings lab (autoflight.html).
   No DOM. Loaded in the page as window.AFC and in Node (tests/afcore.test.mjs) through vm.
   Three parts:
   1. TCAS II version 7.1: sensitivity levels, tau and modified tau, the TA/RA tests, RA choice and a time-stepped encounter.
   2. EGPWS: typical mode 1–6 envelopes, the terrain look-ahead and the terrain display colours.
   3. A small autopilot / flight director / autothrust model for a generic light single (two-axis AP) and a generic jet.
   Units: ft, kt, NM, ft/min (fpm), seconds, degrees, unless stated. Envelopes are typical shapes, not certified data. */
(function(root){
'use strict';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const G=9.80665, KTMS=0.514444, D2R=Math.PI/180;
const A25=0.25*32.174*60, A35=0.35*32.174*60;      // 0.25 g and 0.35 g as vertical-speed change rates, fpm per second

/* ================= 1. TCAS II v7.1 ================= */
/* [own altitude below (ft), SL, tau TA (s), tau RA (s), DMOD TA (NM), DMOD RA (NM), ZTHR TA (ft), ZTHR RA (ft), ALIM (ft)]
   SL 2 and 3 use height above ground, the rest pressure altitude (here the lab flies over the sea, so they are the same). */
const SLT=[[1000,2,20,null,0.30,null,850,null,null],[2350,3,25,15,0.33,0.20,850,600,300],[5000,4,30,20,0.48,0.35,850,600,300],
  [10000,5,40,25,0.75,0.55,850,600,350],[20000,6,45,30,1.00,0.80,850,600,400],[42000,7,48,35,1.30,1.10,850,700,600],[Infinity,7,48,35,1.30,1.10,1200,800,700]];
function sens(alt){ const r=SLT.find(x=>alt<x[0]); return {sl:r[1],tauTA:r[2],tauRA:r[3],dTA:r[4],dRA:r[5],zTA:r[6],zRA:r[7],alim:r[8]}; }
const tau=(r,clo)=>clo>0?r/clo*3600:Infinity;                                   // range tau, s
const tauMod=(r,clo,dmod)=>r<=dmod?0:clo>0?(r*r-dmod*dmod)/(r*clo)*3600:Infinity; // modified tau (DMOD), s
const vTau=(dz,vrel)=>dz*vrel<0?Math.abs(dz)/Math.abs(vrel)*60:Infinity;         // vertical tau: dz intruder−own, vrel intruder−own rate
/* one TA or RA test: range (modified tau or inside DMOD) and altitude (inside ZTHR or vertical tau below the same threshold) */
function test(r,clo,dz,vrel,tauT,dmod,zthr,noAlt){ const rng=r<=dmod||(clo>0&&tauMod(r,clo,dmod)<=tauT); if(noAlt) return rng; return rng&&(Math.abs(dz)<=zthr||vTau(dz,vrel)<=tauT); }
/* altitude change after t s: v0 for the delay d, then a constant rate a (fpm/s) towards vt, then vt */
function proj(v0,vt,d,a,t){ if(t<=d) return v0*t/60; const z=v0*d/60, tt=t-d, tr=Math.abs(vt-v0)/a;
  if(tt<=tr){ const v=v0+Math.sign(vt-v0)*a*tt; return z+(v0+v)/2*tt/60; } return z+(v0+vt)/2*tr/60+vt*(tt-tr)/60; }
/* the strength of an RA in a given sense, assuming the other aircraft keeps its rate: preventive, level off, or climb/descend */
function strength(o,s){ const sep=vt=>s*((proj(o.vo,vt,5,A25,o.tc))-(o.dz+o.vi*o.tc/60));
  if(o.vo*s>=0&&sep(o.vo)>=o.alim) return {kind:'mon',vt:o.vo};
  if(o.vo*s<0&&sep(0)>=o.alim) return {kind:'lvl',vt:0};
  return {kind:'cd',vt:s*Math.max(1500,o.vo*s)}; }
/* choose the RA: o={dz,vo,vi,tc,alim,agl}. Non-crossing sense first if it gives ALIM; descend RAs inhibited below 1100 ft AGL */
function chooseRA(o){ const sepFor=(s,vt)=>s*(proj(o.vo,vt,5,A25,o.tc)-(o.dz+o.vi*o.tc/60));
  const nc=o.dz>0?-1:1, sNc=sepFor(nc,1500*nc), sX=sepFor(-nc,-1500*nc);
  let s=sNc>=o.alim?nc:(sX>sNc?-nc:nc); if(s<0&&o.agl<1100) s=1;
  const st=strength(o,s); return {sense:s,kind:st.kind,vt:st.vt,cross:s!==nc&&Math.abs(o.dz)>100}; }
const raText=ra=>!ra?'':ra.kind==='mon'?'MONITOR VERTICAL SPEED':ra.kind==='lvl'?'LEVEL OFF, LEVEL OFF':ra.kind==='inc'?(ra.sense>0?'INCREASE CLIMB, INCREASE CLIMB':'INCREASE DESCENT, INCREASE DESCENT')
  :ra.sense>0?(ra.cross?'CLIMB, CROSSING CLIMB':'CLIMB, CLIMB'):(ra.cross?'DESCEND, CROSSING DESCEND':'DESCEND, DESCEND');
/* time-stepped encounter on a collision course (zero horizontal miss distance).
   p={alt, r0 (NM), clo (kt), dz0 (ft, intruder above +), vi, vo (fpm), eq:'tcas'|'modec'|'modea', resp:'ra'|'atc'|'none', dt} */
function encounter(p){ const dt=p.dt||0.25, tCPA=p.r0/p.clo*3600, T=Math.min(300,tCPA+20), noAlt=p.eq==='modea';
  let zo=p.alt, zi=p.alt+p.dz0, vo=p.vo, vi=p.vi, st='other', ra=null, ra0=null, ira=null, tgO=null, tgI=null, taT=null, raT=null, cocT=null, strT=null;
  const fr=[];
  for(let k=0;;k++){ const t=k*dt; if(t>T+1e-9) break;
    const r=Math.abs(p.r0-p.clo*t/3600), closing=t<tCPA-1e-9, clo=closing?p.clo:-p.clo, dz=zi-zo, S=sens(zo), vrel=vi-vo;
    const prox=r<=6&&(noAlt||Math.abs(dz)<=1200);
    const ta=closing&&test(r,clo,dz,vrel,S.tauTA,S.dTA,S.zTA,noAlt);
    const raNow=!noAlt&&S.tauRA!=null&&closing&&test(r,clo,dz,vrel,S.tauRA,S.dRA,S.zRA,false);
    if(st==='ra'&&!closing){ st='coc'; cocT=t; if(tgO) tgO={vt:p.vo,t0:t+2,a:A25}; if(tgI) tgI={vt:p.vi,t0:t+2,a:A25}; }
    else if(st!=='ra'&&st!=='coc'){
      if(raNow){ st='ra'; raT=t; const tc=r/p.clo*3600; ra=chooseRA({dz,vo,vi,tc,alim:S.alim,agl:zo}); ra0=Object.assign({},ra);
        if(p.resp==='ra') tgO={vt:ra.vt,t0:t+5,a:A25}; else if(p.resp==='atc') tgO={vt:-ra.sense*1500,t0:t+5,a:A25};
        if(p.eq==='tcas'){ ira=Object.assign({sense:-ra.sense,cross:ra.cross},strength({dz:-dz,vo:vi,vi:vo,tc,alim:S.alim},-ra.sense)); tgI={vt:ira.vt,t0:t+5,a:A25}; } }
      else if(ta){ if(st!=='ta') taT=taT??t; st='ta'; }
      else st=prox?'prox':'other'; }
    /* strengthen to INCREASE when the predicted miss with the RA flown from now is still short (non-compliance or a manoeuvring intruder) */
    if(st==='ra'&&ra.kind==='cd'&&strT==null){ const tc=r/p.clo*3600, d=p.resp==='ra'&&tgO&&t<tgO.t0?tgO.t0-t:p.resp==='ra'?0:2.5;
      const sep=ra.sense*((zo+proj(vo,ra.vt,d,A25,tc))-(zi+vi*tc/60));
      if(sep<S.alim&&tc>4&&t>raT+1&&(ra.sense>0||zo>=1450)){ strT=t; ra=Object.assign({},ra,{kind:'inc',vt:ra.sense*2500}); if(p.resp==='ra') tgO={vt:ra.vt,t0:t+2.5,a:A35}; } }
    fr.push({t,r,dz,zo,zi,vo,vi,st,ra:ra&&(st==='ra')?ra:null,ira:ira&&st==='ra'?ira:null});
    /* integrate */
    if(tgO&&t>=tgO.t0){ const d=tgO.vt-vo, m=tgO.a*dt; vo+=Math.abs(d)<=m?d:Math.sign(d)*m; }
    if(tgI&&t>=tgI.t0){ const d=tgI.vt-vi, m=tgI.a*dt; vi+=Math.abs(d)<=m?d:Math.sign(d)*m; }
    zo+=vo*dt/60; zi+=vi*dt/60; }
  const at=t=>fr[clamp(Math.round(t/dt),0,fr.length-1)];
  return {fr,dt,tCPA,taT,raT,cocT,strT,ra0,ra,ira,at,S0:sens(p.alt),missNone:p.dz0+(p.vi-p.vo)*tCPA/60,missFlown:at(tCPA).dz}; }

/* ================= 2. EGPWS (typical envelopes) ================= */
/* mode 1, excessive descent rate: radio altitude against barometric rate of descent */
function m1(ra,rod){ if(ra<10||ra>2450) return null; if(rod>1600+ra*2.2) return 'PULL UP'; if(rod>1000+(ra-10)*4000/2440) return 'SINK RATE'; return null; }
/* mode 2, excessive terrain closure rate: 2A (not landing flaps) gives TERRAIN, TERRAIN then PULL UP; 2B (landing flaps) TERRAIN only */
function m2top(land,spd){ return land?790:1650+(spd>220?Math.min(800,(spd-220)*800/90):0); }
function m2(ra,clos,land,spd){ if(ra<30||ra>m2top(land,spd)) return null; const lim=2000+(ra-30)*2.8; if(clos<=lim) return null; return land||clos<lim*1.15?'TERRAIN, TERRAIN':'PULL UP'; }
/* mode 3, altitude loss after take-off or go-around: about 10 % of the height gained */
function m3(ra,loss,maxRa){ return ra>30&&ra<1500&&loss>Math.max(20,0.1*maxRa)?"DON'T SINK":null; }
/* mode 4, unsafe terrain clearance: 4A gear up, 4B gear down but flaps not in landing position */
function m4(ra,spd,gear,flaps){ if(ra<30||(gear&&flaps)) return null;
  if(!gear){ const lim=spd<190?500:Math.min(1000,500+(spd-190)*500/60); return ra<lim?(spd<190?'TOO LOW, GEAR':'TOO LOW, TERRAIN'):null; }
  const lim=spd<159?245:Math.min(1000,245+(spd-159)*755/91); return ra<lim?(spd<159?'TOO LOW, FLAPS':'TOO LOW, TERRAIN'):null; }
/* mode 5, below the glide slope (dots fly-up positive): soft below 1000 ft and 1.3 dots, louder below 300 ft and 2 dots */
function m5(ra,dotsLow,gear){ if(!gear||ra<30||ra>1000||dotsLow<=1.3) return null; return ra<300&&dotsLow>2?'GLIDESLOPE (loud)':'GLIDESLOPE'; }
/* mode 6: bank angle limit (typical: about 10° near the ground, 35° from 150 ft) and the height callouts */
const bankLim=ra=>ra<5?Infinity:ra<150?10+(ra-5)*25/145:35;
function m6bank(ra,bank){ return Math.abs(bank)>bankLim(ra)?'BANK ANGLE, BANK ANGLE':null; }
const CALLS=[[1000,'ONE THOUSAND'],[500,'FIVE HUNDRED'],[200,'MINIMUMS'],[100,'ONE HUNDRED'],[50,'FIFTY'],[40,'FORTY'],[30,'THIRTY'],[20,'TWENTY'],[10,'TEN']];
function callout(raPrev,ra){ const c=CALLS.find(([h])=>raPrev>h&&ra<=h); return c?c[1]:null; }
/* terrain look-ahead: first time (s) within the look-ahead at which the straight projected path comes within the floor of the terrain.
   ter(xNM) is the terrain elevation along track; caution about 60 s ahead, warning about 30 s (typical) */
const LA_CAUT=60, LA_WARN=30, LA_FLOOR=300;
function lookAhead(x,alt,vs,gs,ter,floor){ const fl=floor??LA_FLOOR; for(let t=0;t<=LA_CAUT;t+=0.5){ if(alt+vs*t/60<ter(x+gs*t/3600)+fl) return t; } return null; }
const laLevel=t=>t==null?null:t<=LA_WARN?'TERRAIN AHEAD, PULL UP':'CAUTION TERRAIN';
/* terrain display colour bands for terrain dh ft above (+) or below (−) the aircraft */
function tadBand(dh,gear){ const lo=gear?-250:-500; if(dh>2000) return 'red'; if(dh>1000) return 'yel2'; if(dh>lo) return 'yel1'; if(dh>-1000) return 'grn2'; if(dh>-2000) return 'grn1'; return 'none'; }

/* ================= 3. Autopilot, flight director and autothrust ================= */
const AC={ga:{vs1:55,vsw:62,vmax:163,turn:3,accV:300,vfe:110},jet:{vls:150,vsw:138,vmax:340,turn:2.5,accV:400}};
const tasOf=(ias,alt)=>ias*(1+alt*0.00002);
const dragW=(ac,v)=>ac==='ga'?0.075*(0.5*(v/105)**2+0.5*(105/Math.max(v,30))**2):0.06*(0.5*(v/240)**2+0.5*(240/Math.max(v,60))**2);
const gaThr=(pwr,v,alt)=>pwr*14.7/Math.max(v,40)*(1-alt/25000);
const tCl=alt=>0.16*(1-alt/45000), T_IDLE=0.005;
const LEV={idle:0,mid:0.35,cl:1,mct:1.08,toga:1.2};
const LOC_X=2, GS_X=-0.16, GS_DEG=3, CRS=90;   // runway threshold at x=0 (NM, east positive), landing east; localiser beyond the far end; glide path origin 0.16 NM in
const gsIdeal=x=>Math.tan(GS_DEG*D2R)*(GS_X-x)*6076.1;   // ft above the threshold elevation (sea level)
const gsDots=(x,alt)=>{ const d=(GS_X-x)*6076.1; if(d<=50) return 0; return (Math.atan2(alt,d)/D2R-GS_DEG)/0.35; }  // + = above the path (fly down)
const locDots=(x,y)=>Math.atan2(y,LOC_X-x)/D2R/1.25;   // + = right of course looking along it... (north of course)
const angDiff=(a,b)=>((a-b+540)%360)-180;
function apMake(o){ return Object.assign({ac:'jet',t:0,x:-20,y:-5,hdg:60,alt:4000,ias:180,vs:0,thr:0,pwr:0.55,lever:'cl',athr:true,ap:true,fd:true,
  lm:'HDG',lArm:false,apr:false,vm:'ALT',gsArm:false,selAlt:3000,selHdg:60,selVs:-700,selSpd:180,hold:4000,capT:0,capVs:0,lvlDir:0,
  prot:false,stall:false,overspd:false,ground:false,lim:false,vmax:null,msg:null,chg:{},ev:[],hist:[],gsPrev:null},o||{}); }
const apSpec=S=>AC[S.ac];
function setV(S,vm,txt){ if(vm!==S.vm){ S.vm=vm; S.chg.v=S.t; S.ev.push({t:S.t,x:S.x,alt:S.alt,txt:txt||vm}); } }
function setL(S,lm,txt){ if(lm!==S.lm){ S.lm=lm; S.chg.l=S.t; S.ev.push({t:S.t,x:S.x,alt:S.alt,txt:txt||lm}); } }
const r100=v=>Math.round(v/100)*100;
/* is altitude capture armed? Only in a climb or descent mode that is heading towards the selected altitude */
function altArmed(S){ if(!(S.ap||S.fd)) return false; let dir=0; if(S.vm==='VS') dir=Math.sign(S.selVs); else if(S.vm==='LVL') dir=S.lvlDir; else return false; return dir!==0&&(S.selAlt-S.alt)*dir>30; }
function thrMode(S){ if(S.ac!=='jet') return ''; const lv=LEV[S.lever]; if(!S.athr) return ''; if(lv>1) return S.lever==='toga'?'MAN TOGA':'MAN MCT';
  if(S.vm==='LVL'&&(S.ap||S.fd)) return S.lvlDir>0?'THR CLB':'THR IDLE'; return 'SPEED'; }
function athrActive(S){ return S.ac==='jet'&&S.athr&&LEV[S.lever]<=1; }
function press(S,b){ S.msg=null; const jet=S.ac==='jet';
  if(b==='AP'){ S.ap=!S.ap; S.ev.push({t:S.t,x:S.x,alt:S.alt,txt:S.ap?'AP':'AP OFF'}); if(S.ap) S.stall=false; return; }
  if(b==='FD'){ S.fd=!S.fd; return; }
  if(b==='ATHR'){ S.athr=!S.athr; S.chg.a=S.t; return; }
  if(b==='HDG'){ S.lArm=false; S.apr=false; S.gsArm=false; setL(S,'HDG'); if(S.vm==='GS'){ S.selVs=r100(S.vs); setV(S,'VS','V/S'); } return; }
  if(b==='NAV'||b==='LOC'){ S.apr=false; S.gsArm=false; if(S.lm!=='TRK') S.lArm=true; return; }
  if(b==='APR'){ S.apr=true; if(S.lm!=='TRK') S.lArm=true; if(S.vm!=='GS') S.gsArm=true; return; }
  if(b==='ALT'){ S.hold=Math.round(S.alt/10)*10; setV(S,'ALT'); return; }
  if(b==='VS'){ S.selVs=r100(S.vs); setV(S,'VS','V/S'); return; }
  if(b==='LVL'&&jet){ const d=S.selAlt-S.alt; if(Math.abs(d)<100){ S.msg='same'; return; } S.lvlDir=Math.sign(d); setV(S,'LVL','LVL CHG'); S.chg.a=S.t; return; } }
function setSel(S,k,v){ S.msg=null;
  if(k==='alt'){ S.selAlt=v;
    if(S.vm==='CAP'&&Math.abs(v-S.capT)>250){ S.selVs=r100(S.vs); setV(S,'VS','V/S'); S.msg='altstar'; }
    else if(S.vm==='LVL'&&(v-S.alt)*S.lvlDir<=0){ S.selVs=r100(S.vs); setV(S,'VS','V/S'); S.msg='lvlrev'; } return; }
  if(k==='vs') S.selVs=v; else if(k==='hdg') S.selHdg=v; else if(k==='spd') S.selSpd=v; else if(k==='pwr') S.pwr=v; else if(k==='lever'){ S.lever=v; S.chg.a=S.t; } }
function apStep(S,dt){ if(S.stall||S.ground) return; const P=apSpec(S), jet=S.ac==='jet', tas=tasOf(S.ias,S.alt), on=S.ap;
  /* ---- lateral ---- */
  const hr=D2R*S.hdg, yd=Math.cos(hr)*tas/60;   // NM per minute northwards
  if(S.lArm&&S.lm!=='TRK'&&S.x<LOC_X-0.5){ const R=((tas*KTMS)**2/(G*Math.tan(25*D2R)))/1852, dH=Math.abs(angDiff(S.hdg,CRS))*D2R, cap=Math.max(0.12,R*(1-Math.cos(dH))+0.06);
    const conv=S.y*yd<0, inBeam=Math.abs(locDots(S.x,S.y))<8&&Math.abs(angDiff(S.hdg,CRS))<100;
    if(inBeam&&(Math.abs(S.y)<=cap&&conv||Math.abs(S.y)<0.03)){ S.lArm=false; setL(S,'TRK',(S.apr||jet)?'LOC':'NAV'); } }
  let hCmd=S.hdg; if(on||S.fd){ hCmd=S.lm==='TRK'?CRS+clamp(S.y*45,-30,30):S.selHdg; }
  const turn=on?clamp(angDiff(hCmd,S.hdg)*0.45,-P.turn,P.turn):0; S.hdg=(S.hdg+turn*dt+360)%360; S.bank=Math.atan(turn*D2R*tas*KTMS/G)/D2R;
  /* ---- vertical: arming and captures ---- */
  if(on||S.fd){ if(altArmed(S)&&Math.abs(S.selAlt-S.alt)<=Math.max(50,Math.abs(S.vs)/6)&&Math.abs(S.vs)>50){ S.capT=S.selAlt; S.capVs=Math.max(300,Math.abs(S.vs)); setV(S,'CAP',jet?'ALT*':'ALT'); }
    else if(S.vm==='CAP'&&Math.abs(S.capT-S.alt)<20){ S.hold=S.capT; setV(S,'ALT'); }
    const gd=gsDots(S.x,S.alt); if(S.gsArm&&S.lm==='TRK'&&S.x<GS_X-0.3&&S.x>-12&&(Math.abs(gd)<0.12||(S.gsPrev!=null&&Math.sign(gd)!==Math.sign(S.gsPrev)))){ S.gsArm=false; setV(S,'GS',jet?'G/S':'GS'); }
    S.gsPrev=gd; }
  /* ---- thrust available ---- */
  const D=dragW(S.ac,S.ias), lim=jet?(LEV[S.lever]<=1?Math.max(T_IDLE,LEV[S.lever]*tCl(S.alt)):LEV[S.lever]*tCl(S.alt)):gaThr(S.pwr,S.ias,S.alt);
  const aTgt=()=>clamp(0.25*(S.selSpd-S.ias),-1,1)*KTMS/G;    // wanted acceleration as a fraction of g
  let vsCmd=S.vs, thr, speedOnPitch=false;
  if(on){ if(S.vm==='ALT') vsCmd=clamp((S.hold-S.alt)*4,-1000,1000);
    else if(S.vm==='VS') vsCmd=S.selVs;
    else if(S.vm==='CAP') vsCmd=clamp((S.capT-S.alt)*6,-S.capVs,S.capVs);
    else if(S.vm==='GS') vsCmd=-tas*101.27*Math.tan(GS_DEG*D2R)+clamp((gsIdeal(S.x)-S.alt)*4,-600,600);
    else if(S.vm==='LVL') speedOnPitch=true; }
  const mode=thrMode(S);
  if(jet&&athrActive(S)&&(mode==='THR CLB'||mode==='THR IDLE')) thr=mode==='THR CLB'?lim:T_IDLE;
  else if(jet&&athrActive(S)){ /* SPEED: the autothrust holds the speed, limited by the lever position */
    const sn=vsCmd/(tas*101.27); const need=D+sn+aTgt(); thr=clamp(need,T_IDLE,lim); S.lim=need>lim+0.002&&LEV[S.lever]<1; }
  else thr=jet?(LEV[S.lever]===0?T_IDLE:lim):lim;
  if(!(jet&&athrActive(S)&&mode==='SPEED')) S.lim=false;
  let vs, acc;
  if(speedOnPitch){ let sn=thr-D-aTgt(); vs=sn*tas*101.27; if(S.lvlDir>0&&vs<300) vs=300; if(S.lvlDir<0&&vs>-500) vs=-500; }
  else { const m=P.accV*dt; vs=S.vs+clamp(vsCmd-S.vs,-m,m); }
  acc=(thr-D-vs/(tas*101.27))*G/KTMS;
  /* speed protection on the jet in V/S: the V/S gives way at the minimum (or maximum) speed */
  S.prot=false;
  if(jet&&on&&S.vm==='VS'){ if(S.ias<=P.vls&&acc<0){ vs=Math.min(vs,(thr-D)*tas*101.27); acc=(thr-D-vs/(tas*101.27))*G/KTMS; S.prot=true; }
    else if(S.ias>=P.vmax-5&&acc>0){ vs=Math.max(vs,(thr-D)*tas*101.27); acc=(thr-D-vs/(tas*101.27))*G/KTMS; S.prot=true; } }
  S.ias=Math.max(0,S.ias+acc*dt); S.vs=vs; S.thr=thr; S.alt+=vs/60*dt; S.t+=dt;
  S.x+=Math.sin(D2R*S.hdg)*tas/3600*dt; S.y+=Math.cos(D2R*S.hdg)*tas/3600*dt;
  S.pitch=Math.atan2(vs/101.27,tas)/D2R+(jet?2.5:3)+(jet?(150/Math.max(S.ias,80))**2*1.5:(70/Math.max(S.ias,40))**2*2)-(jet?1.5:2);
  const vmax=S.vmax||P.vmax; S.overspd=S.ias>vmax;
  S.stallW=S.ias<(jet?P.vsw:P.vsw);
  if(!jet&&S.ias<=P.vs1||jet&&S.ias<=P.vsw-8){ S.stall=true; S.ap=false; S.ev.push({t:S.t,x:S.x,alt:S.alt,txt:'STALL'}); }
  if(S.lm==='TRK'&&S.vm==='GS'&&S.x>-0.35){ S.ground=true; S.landed=true; S.ev.push({t:S.t,x:S.x,alt:S.alt,txt:'MINIMUMS'}); }
  if(S.alt<=0&&!S.ground){ S.alt=0; S.ground=true; S.ev.push({t:S.t,x:S.x,alt:0,txt:'GROUND'}); }
  if(!S.hist.length||S.t-S.hist[S.hist.length-1].t>=1) S.hist.push({t:S.t,x:S.x,y:S.y,alt:S.alt,ias:S.ias,vs:S.vs,thr:S.thr}); if(S.hist.length>1500) S.hist.shift(); }
function apRun(S,secs,dt){ dt=dt||0.1; for(let t=0;t<secs;t+=dt) apStep(S,dt); return S; }
/* what the annunciator shows: {thr, vert, lat, vArm[], lArm, stat[]} */
function fma(S){ const jet=S.ac==='jet', on=S.ap||S.fd;
  const vm={ALT:'ALT',VS:(jet?'V/S ':'VS ')+(S.selVs>0?'+':S.selVs<0?'−':'')+Math.abs(S.selVs),CAP:jet?'ALT*':'ALT',GS:jet?'G/S':'GS',LVL:'LVL CHG'}[S.vm]||'';
  const lm=S.lm==='HDG'?'HDG':(S.apr||jet)?'LOC':'NAV';
  const vArm=[]; if(on&&altArmed(S)) vArm.push(jet?'ALT':'ALTS'); if(on&&S.gsArm) vArm.push(jet?'G/S':'GS');
  return {thr:thrMode(S),vert:on?vm:'',lat:on?lm:'',vArm,lArm:on&&S.lArm?((S.apr||jet)?'LOC':'NAV'):'',ap:S.ap,fd:S.fd,athr:jet?(S.athr?(athrActive(S)?'on':'arm'):'off'):null}; }

root.AFC={clamp,A25,A35,SLT,sens,tau,tauMod,vTau,test,proj,strength,chooseRA,raText,encounter,
  m1,m2,m2top,m3,m4,m5,bankLim,m6bank,CALLS,callout,LA_CAUT,LA_WARN,LA_FLOOR,lookAhead,laLevel,tadBand,
  AC,LEV,tasOf,dragW,tCl,gsIdeal,gsDots,locDots,GS_X,LOC_X,CRS,angDiff,apMake,press,setSel,apStep,apRun,altArmed,thrMode,athrActive,fma};
})(typeof window!=='undefined'?window:globalThis);
