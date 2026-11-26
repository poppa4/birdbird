/* NORDAP – Airbus A320 systems model for the A320 cockpit trainer (a320.html).
   Teaching model of the system logic as the FCOM describes it: electrical network (batteries, IDGs, APU GEN, EXT PWR,
   AC/DC buses, TRs, static inverter, RAT & EMER GEN), hydraulics (green, blue, yellow, PTU, RAT), fuel (wing and centre
   tanks, pumps, mode select, crossfeed), APU, bleed air and packs, cabin pressure, engines (CFM-type automatic start),
   ADIRS alignment, fire, flight controls computers, and the FWC/ECAM logic (warnings, cautions, procedures, memos,
   flight phases, automatic SD pages). Numbers are typical values for learning, not an operator's figures.
   Pure logic, no DOM: runs in the browser and in Node (tests/a320sys.test.mjs). */
(function(G){
'use strict';
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const toward=(v,t,r,dt)=>v<t?Math.min(t,v+r*dt):Math.max(t,v-r*dt);
const lag=(v,t,tau,dt)=>v+(t-v)*(1-Math.exp(-dt/Math.max(1e-3,tau)));

/* ---------- switches: every control on the panel that the systems read ---------- */
function defaults(cold){
  const r=cold?0:1;
  return {
    bat1:r,bat2:r,ext:0,gen1:1,gen2:1,apuGen:1,idg1:0,idg2:0,busTie:1,acEss:0,galy:1,comm:1,emerTest:0,emerMan:0,
    apuM:0,apuS:0,apuBl:0,eb1:1,eb2:1,xb:1,pk1:1,pk2:1,pkFlow:1,hotAir:1,ram:0,
    hyE1:1,hyE2:1,hyB:1,hyY:0,ptu:1,ratMan:0,blueOvrd:0,
    fL1:1,fL2:1,fC1:1,fC2:1,fR1:1,fR2:1,fMode:1,fX:0,
    irM1:r,irM2:r,irM3:r,ir1:1,ir2:1,ir3:1,adr1:1,adr2:1,adr3:1,
    elac1:1,elac2:1,sec1:1,sec2:1,sec3:1,fac1:1,fac2:1,
    mst1:r,mst2:r,engMode:1,manSt1:0,manSt2:0,
    fireP1:0,fireP2:0,fireA:0,fireT1:0,fireT2:0,fireTA:0,ag11:0,ag12:0,ag21:0,ag22:0,agA:0,
    strobe:cold?0:1,beacon:r,wing:0,navLogo:cold?0:1,rto:0,landL:0,landR:0,nose:0,
    seatB:cold?0:1,noSmk:cold?0:1,emerExit:cold?0:1,
    wai:0,eai1:0,eai2:0,probe:0,crewOxy:1,paxOxy:0,
    gpwsT:1,gpwsS:1,gpwsGs:1,gpwsF:1,ldgF3:0,ldgElev:0,pressMode:1,ditch:0,
    blower:1,extract:1,cabFans:1,tCk:0.5,tFwd:0.5,tAft:0.5,
    park:1,gearLv:1,flapLv:0,spdBrk:0,spArm:0,abrk:0,askid:1,
    thr1:0,thr2:0,rudTrim:0,pitchTrim:0,
    annLt:1,domeLt:0,integLt:0.6,wiperC:0,wiperF:0,
    ecamUp:1,ecamLo:1,xpdr:'2000',xpdrMd:0,tcas:0
  };
}

/* ---------- system state ---------- */
function create(o){
  o=o||{}; const cold=o.cold!==false;
  const A={t:0,cold,sw:defaults(cold),
    fail:{},             // failure name -> true (see FAILS)
    gpu:!!o.gpu,         // ground power unit plugged in
    bus:{},src:{},       // bus name -> powered; bus name -> source label for the ELEC page
    batV:[25.6,25.7],batA:[0,0],batCtc:[false,false],
    gen:[{v:0,hz:0,load:0},{v:0,hz:0,load:0}],idgT:[40,40],idgOK:[true,true],
    apu:{n:0,egt:o.temp||15,flap:0,st:0,avail:false,startT:0,availT:0,fire:false,ext:false,bleedOn:false,shutT:0,fault:false,cool:0},
    eng:[0,1].map(()=>engNew(cold,o.temp)),
    hyd:{g:0,b:0,y:0,qg:14.5,qb:6.5,qy:12.5,ptu:false,ptuT:0,rat:false,ratN:0},
    fuel:{lo:690,li:2700,ri:2700,ro:690,c:1200,xfr:false,used:[0,0],mode:'auto',ctrRun:false,ctrT:0},
    air:{p1:0,p2:0,pa:0,v1:false,v2:false,xbo:false,pk1:0,pk2:0,pr:0,cab:o.elev||0,cabVs:0,dp:0,ofv:100,tCk:21,tFwd:21,tAft:22,duct:[20,20,20]},
    irs:[0,1,2].map(()=>({st:cold?0:2,t:0,att:false})),
    emer:{rat:false,emerGen:false,t:0},
    elac:[true,true],sec:[true,true,true],fac:[true,true],
    fire:{e:[false,false],a:false,disch:{},test:[0,0,0]},
    cfgTest:0,phase:1,phaseT:0,
    ecam:{list:[],clr:{},rcl:false,page:'door',man:null,sts:false,mw:false,mc:false,mwAck:{},mcAck:{},chime:0,crc:false,cav:false,tomemo:false,ldgmemo:false,memo:[],memoR:[],t2:-1},
    doors:{fwd:false,aft:false,cargoF:false,cargoA:false,fwdL:o.doorOpen!==false&&cold},
    brk:{acc:3000,psiL:0,psiR:0,hot:[90,90,90,90],temp:[o.temp||15,o.temp||15,o.temp||15,o.temp||15]},
    gw:o.gw||64000,zfw:o.zfw||58000,
    events:[] // one-off notices for the page (chime, GPU, etc.)
  };
  if(!cold){ A.eng.forEach(e=>engRun(e)); A.apu.n=0; A.hyd.g=A.hyd.b=A.hyd.y=3000; } // engines running: the three systems at pressure
  return A;
}
function engNew(cold,t){ const T=t==null?15:t; return {n1:0,n2:0,egt:T,ff:0,oilP:0,oilT:T,oilQ:17.5,run:false,st:0,stT:0,ignA:false,ignB:false,startV:false,fuelOn:false,fail:false,fire:false,shut:false,hot:false,starter:false,avail:false,rev:0,lit:false,altIgn:false,startFault:''}; }
function engRun(e){ Object.assign(e,{n1:19.6,n2:58.8,egt:395,ff:290,oilP:42,oilT:78,run:true,st:4,avail:true,fuelOn:true,lit:true}); }

/* ---------- failures the page can set ---------- */
/* ADR i (0..2) gives air data: its pushbutton ON, the ADIRU powered with the mode selector not OFF, and not failed.
   IR i gives attitude and heading: its pushbutton ON and aligned in NAV (or ATT when att is asked for). */
function adrValid(A,i){ return A.sw['adr'+(i+1)]!==0&&!A.fail['adr'+(i+1)]&&A.irs[i].st!==0; }
function irValid(A,i,att){ const r=A.irs[i]; return A.sw['ir'+(i+1)]!==0&&(r.st===2||(!!att&&r.st===3)); }
const FAILS=['fmgc1','fmgc2','eng1','eng2','fire1','fire2','fire1x','fire2x','fireApu','gen1','gen2','idg1','apuGen','acBus1','hydG','hydB','hydY','yOvht','edp1','edp2','fuelL1','fuelL2','bleed1','bleed2','pack1','pack2','elac1','sec1','ir1','ir2','decomp','cabLeak','bothGen',
  'bscu','nws','ap1f','ap2f','smokeFwd','smokeAft','locTx','gsTx','adr1','adr2','adr3','gOvht','bOvht','gearUpl','gearDnl'];
/* the brakes and steering the BSCU gives (read by the flight model): normal braking with anti-skid and autobrake, nose wheel
   steering. Both BSCU channels lost, or the A/SKID & N/W STRG switch OFF: alternate braking on yellow without anti-skid (the
   ABCU limits the pressure to about 1,000 psi), no autobrake, no nose wheel steering. */
function wheels(A){ const S=A.sw, bscu=!A.fail.bscu&&S.askid!==0;
  return {antiSkid:bscu,autoBrk:bscu,nws:bscu&&!A.fail.nws&&A.hyd.y>1500,altn:!bscu}; }

/* ---------- ELECTRICAL ---------- */
function elec(A,dt,air){
  const S=A.sw, F=A.fail, B={}, src={}, gnd=air.gnd;
  const e1=A.eng[0], e2=A.eng[1];
  // IDG disconnect is irreversible in flight (and here: until Restart)
  for(let i=0;i<2;i++){ if(S['idg'+(i+1)]) A.idgOK[i]=false; }
  const genAv=[0,1].map(i=>{ const e=A.eng[i]; return A.idgOK[i]&&!F['gen'+(i+1)]&&!F.bothGen&&!(i===0&&F.idg1)&&e.n2>57&&S['gen'+(i+1)]===1; });
  const line1=S.genLine!==0; // EMER ELEC PWR GEN 1 LINE (smoke procedure): OFF opens the GEN 1 line contactor
  const apuAv=A.apu.avail&&S.apuGen===1&&!F.apuGen&&A.apu.n>95;
  const extAv=A.gpu&&S.ext===1&&gnd;
  // AC bus 1 / 2: own generator, else EXT PWR, else APU GEN, else the other generator through the bus tie
  const tie=S.busTie===1;
  function feed(i){
    if(F.acBus1&&i===0) return null;
    if(genAv[i]&&(i!==0||line1)) return 'GEN '+(i+1);
    if(!tie) return null;
    if(extAv) return 'EXT PWR';
    if(apuAv) return 'APU GEN';
    if(genAv[1-i]&&(1-i!==0||line1)) return 'GEN '+(2-i);
    return null; }
  src.ac1=feed(0); src.ac2=feed(1);
  // a single generator, EXT PWR or APU GEN can carry the whole network (GALY & CAB shed, FCOM)
  B.ac1=!!src.ac1; B.ac2=!!src.ac2;
  // emergency generation: RAT & EMER GEN when AC 1 and AC 2 are lost in flight above 100 kt
  const lostAC=!B.ac1&&!B.ac2;
  if((lostAC&&!gnd&&air.ias>100)||S.emerMan){ if(!A.emer.rat){ A.emer.rat=true; A.emer.t=0; A.hyd.rat=true; } }
  if(A.emer.rat){ A.emer.t+=dt; A.hyd.ratN=Math.min(1,A.hyd.ratN+dt/6); }
  A.emer.emerGen=A.emer.rat&&lostAC&&A.emer.t>8&&air.ias>100&&A.hyd.b>2000;
  // AC ESS: from AC 1 (NORM) or AC 2 (ALTN); else emergency generator; else static inverter (battery) above 50 kt
  if(S.acEss===0&&B.ac1){ B.acEss=true; src.acEss='AC 1'; }
  else if(S.acEss===1&&B.ac2){ B.acEss=true; src.acEss='AC 2'; }
  else if(A.emer.emerGen){ B.acEss=true; src.acEss='EMER GEN'; }
  else B.acEss=false;
  // TR 1 and TR 2 feed DC 1 and DC 2; the ESS TR feeds DC ESS from AC ESS when TR 1 is lost
  const tr1=B.ac1, tr2=B.ac2;
  B.dc1=tr1||tr2; B.dc2=tr2||tr1; src.dc1=tr1?'TR 1':tr2?'TR 2':null; src.dc2=tr2?'TR 2':tr1?'TR 1':null;
  // batteries: connected when DC BAT bus voltage is low (charging), on ground with no AC, or in emergency
  const anyDC=B.dc1||B.dc2;
  for(let i=0;i<2;i++){
    const on=S['bat'+(i+1)]===1;
    const need=!anyDC||(A.batV[i]<26.5)||(A.apu.st===1||A.apu.st===2)||(A.batCtc[i]&&A.batV[i]<27.8&&anyDC);
    A.batCtc[i]=on&&need; }
  const batOn=A.batCtc[0]||A.batCtc[1];
  B.dcBat=anyDC||batOn; src.dcBat=anyDC?'DC 1':batOn?'BAT':null;
  // DC ESS: from DC BAT (normal), ESS TR in emergency, batteries otherwise; DC ESS SHED and AC ESS SHED shed on batteries
  B.dcEss=B.dcBat; src.dcEss=anyDC?'DC BAT':A.emer.emerGen?'ESS TR':batOn?'BAT':null;
  // static inverter: batteries feed AC ESS only in flight above 50 kt (on ground with batteries only, the DUs stay dark)
  if(!B.acEss&&batOn&&!anyDC&&air.ias>50){ B.acEss=true; src.acEss='STAT INV'; }
  B.acEssShed=B.acEss&&src.acEss!=='STAT INV'; B.dcEssShed=B.dcEss&&(anyDC||A.emer.emerGen);
  B.hot1=A.batV[0]>5; B.hot2=A.batV[1]>5;
  B.galy=(B.ac1&&B.ac2&&S.galy===1&&(genAv[0]&&genAv[1]||extAv||(apuAv&&gnd)));
  B.dcEssOrBat=B.dcEss||B.dcBat;
  // battery charge / discharge
  for(let i=0;i<2;i++){
    let a=0;
    if(A.batCtc[i]){ if(anyDC){ a=clamp((28.2-A.batV[i])*30,0,60); A.batV[i]=toward(A.batV[i],28.2,0.03,dt); }
      else { a=-(B.acEss?45:12)-(A.apu.st===2?120:0); A.batV[i]=Math.max(18,A.batV[i]-(0.00012*(-a))*dt); } }
    else A.batV[i]=toward(A.batV[i],A.batV[i]>26?26.1:A.batV[i],0.002,dt);
    A.batA[i]=a; }
  // generator readouts
  for(let i=0;i<2;i++){ const on=genAv[i], g=A.gen[i]; g.v=on?115:0; g.hz=on?400:0; g.load=on?(B.galy?32:21)+(src['ac'+(2-i)]==='GEN '+(i+1)?18:0):0; g.on=on; g.avail=A.idgOK[i]&&A.eng[i].n2>57; }
  A.apuGenLoad=apuAv&&(src.ac1==='APU GEN'||src.ac2==='APU GEN')?(B.galy?42:26):0;
  A.extOn=extAv; A.genAv=genAv; A.apuAv=apuAv;
  A.bus=B; A.src=src;
  A.dc=B.dcBat||B.dcEss; A.ac=B.ac1||B.ac2||B.acEss;
}

/* ---------- APU ---------- */
function apu(A,dt,air){
  const S=A.sw, P=A.apu, B=A.bus;
  if(A.fail.fireApu&&P.n>10) P.fire=true;
  if(S.fireA){ /* APU FIRE pb pushed: shuts the APU down */ }
  const power=B.dcBat;
  const fuelOK=A.fuel.li+A.fuel.lo>5||A.fuel.c>5;
  // master ON: the air intake flap opens (about 20 s), ECB powered; START: starter motor, ignition, AVAIL at N > 95 % + 2 s
  const masterOn=S.apuM===1&&power&&!S.fireA&&!P.fire;
  P.flap=toward(P.flap,masterOn||P.n>7?1:0,1/18,dt);
  if(masterOn&&S.apuS&&P.st===0&&P.flap>0.99&&P.cool<=0){ P.st=1; P.startT=0; }
  if(masterOn&&S.apuS&&P.st===0&&P.flap<0.99) P.pending=true;
  if(P.pending&&masterOn&&P.flap>0.99&&P.st===0&&P.cool<=0){ P.st=1; P.startT=0; P.pending=false; }
  if(!masterOn){ P.pending=false; if(P.st>0&&P.st<4){ P.st=4; P.shutT=0; } }
  if(P.st===1||P.st===2){ // starting
    P.startT+=dt; P.st=2;
    const tgt=P.startT<3?0:Math.min(100,(P.startT-3)*2.9+(P.startT>20?(P.startT-20)*0.8:0));
    P.n=toward(P.n,Math.min(100,tgt),12,dt);
    const egtPk=P.n<50?(A.env.t+P.n*16):clamp(800-(P.n-50)*6,450,800);
    P.egt=lag(P.egt,P.startT>3&&fuelOK?egtPk:A.env.t,1.5,dt);
    if(P.n>=99.5){ P.st=3; P.availT=0; }
    if(!fuelOK&&P.startT>45){ P.st=4; P.fault=true; }
  } else if(P.st===3){ // running
    P.n=toward(P.n,100,5,dt); P.availT+=dt; if(P.availT>2) P.avail=true;
    const bl=S.apuBl===1&&P.avail;
    P.egt=lag(P.egt,bl?(A.air.pk1||A.air.pk2?560:470):390,8,dt);
  } else if(P.st===4){ // shutting down: with the bleed used, a 60 to 120 s cooling run (here 60 s) before the stop
    P.avail=false; P.shutT+=dt;
    if(P.bleedUsed&&P.shutT<60&&!S.fireA&&!P.fire){ P.n=toward(P.n,100,5,dt); }
    else { P.n=toward(P.n,0,4.5,dt); P.egt=lag(P.egt,A.env.t+P.n*3,12,dt); if(P.n<=0.1){ P.st=0; P.n=0; P.bleedUsed=false; P.cool=0; } }
  } else { P.n=toward(P.n,0,5,dt); P.egt=lag(P.egt,A.env.t,40,dt); P.avail=false; }
  if(S.apuBl&&P.avail) P.bleedUsed=true;
  if(P.st===0) P.cool=Math.max(0,P.cool-dt);
  P.bleedOn=P.avail&&S.apuBl===1&&(air.alt<20000);
}

/* ---------- ENGINES (A320-251N, CFM LEAP-1A26: FADEC automatic start) ----------
   Start as the A320neo LEAP FCOM describes it: when the engine is still warm the FADEC first dry cranks it (pre-start motoring
   against a bowed rotor: N2 held below about 30 %, COOLING on the E/WD, up to about 60 s), then ignition at about 15 % N2 and
   fuel at about 20 % N2; the FADEC alternates igniter A and B from one start to the next. Idle and EGT numbers are typical
   values for learning, not an operator's figures. */
const IDLE={n1:19.6,n2:58.8,egt:395,ff:290};
/* thermal state for the pre-start motoring: here the time since this engine last stopped (a teaching approximation; the
   FADEC itself decides from the measured core temperature) */
function coolNeed(A,e){ if(e.offT==null) return 0; const s=A.t-e.offT; if(s<20||s>7200) return 0; return Math.round(60*clamp(s/900,0.25,1)); }
function engines(A,dt,air,fm){
  const S=A.sw;
  for(let i=0;i<2;i++){
    const e=A.eng[i], n=i+1, mst=S['mst'+n]===1, ign=S.engMode===2, crank=S.engMode===0;
    const bleedP=A.air.duct[i]; // psi at the starter valve
    const fuelP=fuelPress(A,i);
    if((A.fail['fire'+n]||A.fail['fire'+n+'x'])&&e.n2>5) e.fire=true;
    if(A.fail['eng'+n]&&e.run){ e.fail=true; }
    const fireShut=S['fireP'+n]===1;
    // automatic start: master ON with the mode selector at IGN/START
    const begin=()=>{ e.st=1; e.stT=0; e.startFault=''; e.coolT=air.gnd?coolNeed(A,e):0; e.igB=e.igB==null?i===1:!e.igB; };
    if(mst&&!e.run&&e.st===0&&ign&&A.bus.dcEss) begin();
    if(!mst&&e.st>0){ if(e.run) e.offT=A.t; e.st=0; e.fuelOn=false; e.run=false; e.startV=false; e.ignA=e.ignB=false; e.coolT=0; }
    if(mst&&e.st===0&&!ign&&!e.run&&S['manSt'+n]&&A.bus.dcEss) begin();
    let n2t=0, egtT=A.env.t, ffT=0;
    e.startV=false; e.ignA=e.ignB=false;
    if(e.st>=1&&e.st<4){ // starting
      e.stT+=dt;
      e.startV=e.n2<50&&bleedP>20;
      const spool=e.startV?Math.min(24,bleedP*0.6):0;
      if(e.st===1){ if(e.coolT>0&&e.startV){ e.cooling=true; e.coolT-=dt; e.stT=0; n2t=Math.min(spool,25); } /* dry crank: no ignition, no fuel */
        else { e.cooling=false; n2t=spool; if(e.n2>=15){ e.st=2; } if(e.stT>60&&e.n2<15){ e.startFault='STARTER'; e.st=0; } } }
      if(e.st===2){ e.ignA=!e.igB; e.ignB=!!e.igB; n2t=spool+2; if(e.n2>=20&&fuelP){ e.st=3; e.fuelOn=true; e.lightT=0; } }
      if(e.st===3){ e.ignA=!e.igB; e.ignB=!!e.igB; e.lightT+=dt;
        n2t=IDLE.n2;
        const lit=e.lightT>3; e.lit=lit;
        egtT=lit?Math.min(690,A.env.t+(e.n2<45?120+e.n2*12:IDLE.egt+(60-e.n2)*18)):A.env.t;
        if(!lit&&e.lightT>15){ e.startFault='IGN'; e.st=0; e.fuelOn=false; }
        if(e.n2>=58) { e.st=4; e.run=true; e.avail=true; } }
      ffT=e.fuelOn?(150+e.n2*2.5):0;
    }
    if(e.run){
      if(!mst||fireShut||e.fail||!fuelP&&!gravity(A,i,air)) { e.run=false; e.st=0; e.fuelOn=false; e.shut=!e.fail; e.offT=A.t; }
    }
    if(e.st!==1) e.cooling=false;
    if(e.run){
      // thrust lever -> N1 command (A/THR replaces the lever between idle and the active detent; fm.js computes nTgt)
      const t=fm?fm.n1Cmd[i]:IDLE.n1;
      e.n1=lag(e.n1,Math.max(IDLE.n1+(S['eai'+n]?2.5:0)+(air.gnd?0:Math.max(0,(air.alt-0)/1e4*2+(air.ias>200?2:0))),t),e.n1<t?1.6:1.3,dt); // anti-ice raises the idle
      n2t=IDLE.n2+(e.n1-IDLE.n1)*0.55;
      egtT=IDLE.egt+(e.n1-IDLE.n1)*7.2+(A.env.t-15)*0.9-(air.alt/1e4)*12;
      const thrF=Math.max(0,(e.n1-IDLE.n1)/(100-IDLE.n1));
      ffT=IDLE.ff+Math.pow(thrF,1.4)*3600*Math.max(0.35,air.sig||1); // fuel flow about in step with thrust (LEAP-1A: ~1,050 kg/h a side at 250 kt low level, ~3,900 at TOGA)
      e.oilP=lag(e.oilP,40+thrF*55,2,dt); e.oilT=lag(e.oilT,80+thrF*45,40,dt);
      e.ignA=e.ignB=false;
      if(ign&&(!air.gnd||A.phase===2||A.phase===3)){ e.ignA=e.ignB=true; }
      if(S['eai'+n]){ e.ignA=e.ignB=true; } // ENG anti-ice ON selects continuous ignition (A320neo)
      if(ign&&!e.avail){ e.ignA=e.ignB=true; }
    } else if(e.st===0){
      n2t=crank&&S['manSt'+n]&&bleedP>20?22:(air.gnd?0:Math.min(30,air.ias*0.12)); // windmilling in flight
      if(crank&&S['manSt'+n]) e.startV=bleedP>20;
      egtT=A.env.t+(e.egt>A.env.t?0:0); ffT=0; e.oilP=lag(e.oilP,e.n2*0.4,2,dt); e.oilT=lag(e.oilT,A.env.t,180,dt); e.lit=false; e.avail=e.n2>50&&false;
      e.n1=lag(e.n1,e.n2*0.18+(air.gnd?0:air.ias*0.06),3,dt);
    }
    if(!e.run&&e.st>0&&e.st<4){ e.n1=lag(e.n1,e.n2*0.33,1.5,dt); }
    if(e.st>0&&e.st<4){ const r=e.st<3?1.55:(e.n2<50?1.25:0.75); e.n2=toward(e.n2,n2t,r,dt); } // dry crank, then light-off to idle: about 45 s
    else e.n2=lag(e.n2,n2t,e.run?2:6,dt);
    e.egt=lag(e.egt,egtT,e.run?2.5:(e.lit?2:18),dt);
    e.ff=lag(e.ff,ffT,1.2,dt);
    e.hot=e.egt>1060;
    e.thrF=e.run?Math.max(0,(e.n1-IDLE.n1)/(100-IDLE.n1)):0;
  }
}
function fuelPress(A,i){ const S=A.sw, F=A.fuel, B=A.bus;
  const wingL=(S.fL1&&!A.fail.fuelL1&&B.ac1)||(S.fL2&&!A.fail.fuelL2&&B.ac2), wingR=(S.fR1&&B.ac1)||(S.fR2&&B.ac2);
  const ctr=F.ctrRun&&F.c>0;
  const side=i===0?(wingL&&F.li+F.lo>0)||(ctr):(wingR&&F.ri+F.ro>0)||(ctr);
  const xf=S.fX&&B.dcEss&&((wingL&&F.li+F.lo>0)||(wingR&&F.ri+F.ro>0)||ctr);
  return side||xf; }
function gravity(A,i,air){ return air.alt<15000&&(i===0?A.fuel.li+A.fuel.lo>0:A.fuel.ri+A.fuel.ro>0); }

/* ---------- FUEL ---------- */
function fuel(A,dt,air,fm){
  const S=A.sw, F=A.fuel, B=A.bus;
  // centre tank pumps in AUTO: run for 2 min after engine start, then while the slats are retracted, stop 5 min after the
  // centre tank is empty; in MAN they run when their pushbuttons are ON
  const anyRun=A.eng[0].run||A.eng[1].run;
  if(S.fMode===1){
    if(anyRun) F.ctrT+=dt; else F.ctrT=0;
    const slats=fm?fm.slat>0:true;
    F.ctrRun=F.c>0&&anyRun&&(F.ctrT<120||!slats)&&B.ac1;
  } else F.ctrRun=F.c>0&&((S.fC1&&B.ac1)||(S.fC2&&B.ac2));
  if(S.fMode===1){ F.ctrRun=F.ctrRun&&(S.fC1||S.fC2); }
  F.mode=S.fMode?'auto':'man';
  // burn
  for(let i=0;i<2;i++){
    const ff=A.eng[i].ff*(A.ffK||1)/3600*dt; if(ff<=0) continue; F.used[i]+=ff;
    if(F.ctrRun&&F.c>0){ F.c=Math.max(0,F.c-ff); continue; }
    if(S.fX&&i===1&&!(S.fR1||S.fR2)){ take(F,'L',ff); continue; }
    if(S.fX&&i===0&&!(S.fL1||S.fL2)){ take(F,'R',ff); continue; }
    take(F,i===0?'L':'R',ff); }
  if(A.apu.n>5){ const ff=(A.apu.bleedOn?120:95)/3600*dt*(A.apu.n/100); if(F.c>0&&F.ctrRun) F.c=Math.max(0,F.c-ff); else take(F,'L',ff); }
  // outer tank transfer valves open when an inner tank is down to 750 kg
  if(F.li<750||F.ri<750) F.xfr=true;
  if(F.xfr){ const r=8*dt; const a=Math.min(r,F.lo), b=Math.min(r,F.ro); F.lo-=a; F.li+=a; F.ro-=b; F.ri+=b; }
  F.fob=F.lo+F.li+F.ri+F.ro+F.c;
}
function take(F,s,q){ if(s==='L'){ if(F.li>=q) F.li-=q; else { q-=F.li; F.li=0; F.lo=Math.max(0,F.lo-q); } } else { if(F.ri>=q) F.ri-=q; else { q-=F.ri; F.ri=0; F.ro=Math.max(0,F.ro-q); } } }

/* ---------- HYDRAULICS ---------- */
function hyd(A,dt,air){
  const S=A.sw, H=A.hyd, B=A.bus, e=A.eng;
  const edp1=S.hyE1&&e[0].n2>40&&!A.fail.edp1&&!(S.fireP1), edp2=S.hyE2&&e[1].n2>40&&!A.fail.edp2&&!(S.fireP2);
  // blue electric pump: AUTO runs when one engine runs (or BLUE PUMP OVRD on ground), on AC 1
  const bluePump=S.hyB&&B.ac1&&(e[0].run||e[1].run||S.blueOvrd)&&!A.fail.hydB;
  const yPump=S.hyY&&B.ac2&&!A.fail.hydY;
  let g=edp1&&!A.fail.hydG?3000:0, y=(edp2||yPump)&&!A.fail.hydY?3000:0, b=bluePump?3000:(H.rat&&H.ratN>0.9&&air.ias>100?2500:0);
  // PTU: transfers power between green and yellow when the difference exceeds 500 psi; inhibited between the first and
  // the second engine start with the parking brake ON (one master ON, other OFF), and with the PTU pb OFF
  const oneMaster=(S.mst1===1)!==(S.mst2===1);
  const inhibit=!S.ptu||(oneMaster&&S.park&&air.gnd)||!B.dcBat;
  H.ptu=false;
  if(!inhibit){
    if(g>=2500&&y<2500&&!A.fail.hydY&&H.qy>3){ y=2800; H.ptu=true; }
    else if(y>=2500&&g<2500&&!A.fail.hydG&&H.qg>3){ g=2800; H.ptu=true; }
  }
  H.ptuT=H.ptu?H.ptuT+dt:0;
  /* yellow reservoir overheat (failure): OVHT on the HYD page, FAULT in ENG 2 PUMP, YELLOW ELEC PUMP and PTU. With the yellow
     pumps and the PTU off the fluid cools; here the overheat goes out about 3 min later and the system can be restored. */
  for(const [c,off] of [['g',()=>!S.hyE1&&!S.ptu],['y',()=>!S.hyE2&&!S.hyY&&!S.ptu],['b',()=>!S.hyB]]){ const k=c+'Ovht';
    if(A.fail[k]){ if(!H[k+'Out']) H[k]=true; } else { H[k]=false; H[k+'Out']=false; H[k+'T']=0; }
    if(H[k]){ H[k+'T']=off()?(H[k+'T']||0)+dt:0; if(H[k+'T']>180){ H[k]=false; H[k+'Out']=true; } } }
  H.g=lag(H.g,g,0.8,dt); H.y=lag(H.y,y,0.8,dt); H.b=lag(H.b,b,0.8,dt);
  H.bluePump=bluePump; H.yPump=yPump; H.edp=[edp1,edp2];
  // brakes: green (normal, with anti-skid) or yellow + accumulator (alternate, park brake)
  A.brk.acc=toward(A.brk.acc,H.y>2500?3000:A.brk.acc,500,dt);
}

/* ---------- BLEED, PACKS, PRESSURISATION ---------- */
function air(A,dt,air){
  const S=A.sw, X=A.air, e=A.eng, P=A.apu;
  // engine bleed: HP/IP air when the engine runs, valve opens with pb ON and pressure; closes with the APU bleed in use,
  // with the fire pb, during engine start of that side
  const apuBl=P.bleedOn;
  const v1=S.eb1&&e[0].run&&!apuBl&&!S.fireP1&&!A.fail.bleed1, v2=S.eb2&&e[1].run&&!apuBl&&!S.fireP2&&!A.fail.bleed2;
  X.v1=v1; X.v2=v2;
  // crossbleed: AUTO opens with the APU bleed valve open, OPEN / SHUT manual
  X.xbo=S.xb===2||(S.xb===1&&apuBl);
  X.pa=apuBl?lag(X.pa||0,48,1.5,dt):lag(X.pa||0,0,1,dt);
  const p1=v1?(32+e[0].thrF*12):0, p2=v2?(32+e[1].thrF*12):0;
  let d1=Math.max(p1,apuBl?X.pa:0), d2=p2;
  if(X.xbo){ const m=Math.max(d1,d2); d1=d2=m; }
  X.duct=[lag(X.duct[0],d1,1.2,dt),lag(X.duct[1],d2,1.2,dt)];
  X.p1=X.duct[0]; X.p2=X.duct[1];
  // packs: flow control valve open with pb ON, pressure, and not during an engine start (FCOM: closes during start)
  const starting=e.some(x=>x.st>0&&x.st<4);
  const onePack=(S.pk1&&!S.pk2)||(S.pk2&&!S.pk1); // HI flow is selected automatically with the APU bleed or one pack only
  const flow=apuBl||onePack?1.2:[0.8,1,1.2][S.pkFlow];
  X.pk1=starting?0:lag(X.pk1,S.pk1&&!A.fail.pack1&&X.duct[0]>8&&!S.ditch?flow:0,2,dt); // the pack valves close at once during a start
  X.pk2=starting?0:lag(X.pk2,S.pk2&&!A.fail.pack2&&X.duct[1]>8&&!S.ditch?flow:0,2,dt);
  // cabin pressure controller (automatic): cabin altitude schedule from the aircraft altitude, max ΔP 8.06 psi,
  // landing elevation from the FMS (here: the field, 0 ft); with no packs or a leak the cabin climbs to the aircraft altitude
  const flowIn=X.pk1+X.pk2;
  const pAt=h=>14.696*Math.pow(1-6.8756e-6*h,5.2559);
  /* landing elevation: AUTO from the FMS (here the field), or the LDG ELEV selector (-2,000 to 14,000 ft) */
  const ldgE=S.ldgElev?(S.ldgElev-2)*2000:(A.env.elev||0); X.ldgElev=ldgE;
  const target=air.gnd?(A.env.elev||0):clamp(air.alt*0.235,ldgE,Math.max(8000,ldgE));
  let rate=air.gnd?500:(air.vs>0?clamp(air.vs*0.27,300,750):clamp(air.vs*0.27,-750,-300));
  let tgt=target;
  if(flowIn<0.2||A.fail.decomp||A.fail.cabLeak){ tgt=air.alt; rate=A.fail.decomp?30000:(A.fail.cabLeak?1200:1500); }
  X.ram=!!S.ram&&!S.ditch&&X.dp<1; // RAM AIR: the inlet opens when the differential pressure is below 1 psi
  if(X.ram&&!air.gnd){ tgt=air.alt; rate=Math.max(rate,800); }
  if(!S.pressMode&&!air.gnd&&!A.fail.decomp){ const v=S.manVs||0; tgt=v>0?air.alt:v<0?-1000:X.cab; rate=v?1000:0; } // MAN: the pilot drives the outflow valve with the V/S CTL switch
  X.cab=toward(X.cab,tgt,Math.abs(rate)/60,dt);
  X.cab=Math.min(X.cab,Math.max(air.alt,A.env.elev||0));
  X.dp=Math.max(0,pAt(X.cab)-pAt(air.alt));
  if(X.dp>8.6){ X.cab=Math.min(air.alt,X.cab+((X.dp-8.6)*2000)*dt); X.dp=8.6; }
  const prev=X.cabPrev==null?X.cab:X.cabPrev; X.cabVs=lag(X.cabVs,(X.cab-prev)/Math.max(dt,1e-3)*60,1.2,dt); X.cabPrev=X.cab;
  X.ofv=air.gnd?100:clamp(100-X.dp*11,4,100);
  /* WING anti-ice: in flight the valves open with bleed pressure; on the ground only a 30 s test, then they close (the ON light
     stays). ENG anti-ice valves open with the engine running. */
  X.waiT=S.wai?(X.waiT||0)+dt:0; X.wai=!!S.wai&&(X.duct[0]>8||X.duct[1]>8)&&(!air.gnd||X.waiT<30);
  X.eai=[0,1].map(i=>!!S['eai'+(i+1)]&&e[i].run);
  // cabin temperatures follow the selectors (18 to 30 °C), slowly
  X.tCk=lag(X.tCk,flowIn>0.2?18+12*S.tCk:A.env.t,120,dt); X.tFwd=lag(X.tFwd,flowIn>0.2?18+12*S.tFwd:A.env.t,140,dt); X.tAft=lag(X.tAft,flowIn>0.2?18+12*S.tAft:A.env.t,140,dt);
}

/* ---------- ADIRS: alignment ---------- */
function adirs(A,dt,air){
  const S=A.sw;
  for(let i=0;i<3;i++){
    const r=A.irs[i], m=S['irM'+(i+1)];
    const pw=A.bus.acEss||A.bus.dcBat||A.batV[0]>20; // IR 1/3 on AC ESS (or DC BAT / HOT), IR 2 on AC 2 (or HOT): backed by the batteries
    if(A.fail['ir'+(i+1)]&&r.st===2){ r.st=4; }
    if(m===0||!pw){ if(r.st!==4){ r.st=0; r.t=0; } r.att=false; continue; }
    if(m===2){ if(r.st!==4){ r.att=true; r.st=3; } continue; }
    if(r.st===0||r.st===3){ r.st=1; r.t=0; r.att=false; }
    if(r.st===1){ r.t+=dt*(A.alignK||1); r.onBat=r.t<8; if(r.t>=A.alignT) r.st=2; }
  }
  A.alignMin=A.irs.reduce((m,r)=>r.st===1?Math.max(m,Math.ceil((A.alignT-r.t)/60)):m,0);
}

/* ---------- FIRE ---------- */
function fire(A,dt){
  const S=A.sw, Fi=A.fire;
  Fi.e=[A.eng[0].fire||S.fireT1===1,A.eng[1].fire||S.fireT2===1]; Fi.a=A.apu.fire||S.fireTA===1;
  Fi.pbT=[0,1].map(i=>S['fireP'+(i+1)]?((Fi.pbT||[0,0])[i]+dt):0); Fi.apuPbT=S.fireA?(Fi.apuPbT||0)+dt:0;
  // agent discharge puts the fire out (once at least one agent of that engine has been discharged and fuel is shut);
  // the "inextinguishable" failure (fire1x / fire2x) keeps burning after both agents
  for(let i=0;i<2;i++){ const n=i+1; if(A.fail['fire'+n+'x']) continue; if(S['fireP'+n]&&(S['ag'+n+'1']||S['ag'+n+'2'])){ Fi.disch['e'+n]=(Fi.disch['e'+n]||0)+dt; if(Fi.disch['e'+n]>(S['ag'+n+'1']&&S['ag'+n+'2']?3:6)&&A.sw['mst'+n]===0){ A.eng[i].fire=false; A.fail['fire'+n]=false; } } }
  if(S.fireA&&S.agA){ A.apu.fire=false; A.fail.fireApu=false; }
  // APU auto extinguishing on ground
  if(A.apu.fire&&A.gndNow){ Fi.apuAuto=(Fi.apuAuto||0)+dt; if(Fi.apuAuto>3){ A.sw.agA=1; A.apu.st=4; } if(Fi.apuAuto>6) A.apu.fire=false; }
}

/* ---------- FLIGHT CONTROL COMPUTERS ---------- */
function fctl(A){
  const S=A.sw, B=A.bus;
  A.elac=[S.elac1&&!A.fail.elac1&&(B.dcEss||B.dcBat),S.elac2&&(B.dc2||B.dcBat)];
  A.sec=[S.sec1&&!A.fail.sec1&&(B.dcEss||B.dcBat),S.sec2&&B.dc2,S.sec3&&B.dc2];
  A.fac=[S.fac1&&B.acEss,S.fac2&&B.ac2];
  const adrOK=[0,1,2].filter(i=>adrValid(A,i)).length;
  const irOK=[0,1,2].filter(i=>irValid(A,i,false)).length;
  // alternate law: both ELACs, G+Y, two ADRs or two IRs lost; direct law with all IRs lost
  A.law=(!A.elac[0]&&!A.elac[1])||(A.hyd.g<1500&&A.hyd.y<1500)||adrOK<2||irOK<2?((A.hyd.g<1500&&A.hyd.y<1500&&A.hyd.b<1500)?'MECH':(irOK<1?'DIRECT':'ALTN')):'NORMAL';
  if(!A.sec[0]&&!A.sec[1]&&!A.sec[2]&&!A.elac[0]&&!A.elac[1]) A.law='MECH';
}

/* ---------- AUTO FLIGHT availability: FMGC, AP, A/THR, FD and approach capability, from the systems, so that what the ECAM
   STATUS lists as inoperative is inoperative in the cockpit too. FMGC 1 on AC ESS, FMGC 2 on AC 2 (each also fails on its own).
   An AP needs its FMGC, two ADRs, two IRs, normal or alternate law and not G+Y lost; AP 1 also needs green, AP 2 yellow.
   A/THR needs an FMGC and two ADRs. Each FD takes its own FMGC, else the other one (FMA 1FD2 / 2FD2 / 1FD1).
   Approach capability: CAT 3 DUAL needs both APs, both engines and generators, G and Y and A/THR; one AP gives CAT 3 SINGLE;
   no A/THR CAT 2; no AP, alternate / direct law or EMER CONFIG CAT 1. ---------- */
function autoFlt(A,air){ if(A.noAfs){ A.afs=null; return; }
  const F=A.fail, B=A.bus, H=A.hyd, fly=!air.gnd;
  const fmgc=[!F.fmgc1&&!!B.acEss,!F.fmgc2&&!!B.ac2];
  const adrOK=[0,1,2].filter(i=>adrValid(A,i)).length, irOK=[0,1,2].filter(i=>irValid(A,i,false)).length;
  const gLo=H.g<1500, yLo=H.y<1500, base=(A.law==='NORMAL'||A.law==='ALTN')&&adrOK>=2&&irOK>=2&&!(gLo&&yLo);
  const ap=[fmgc[0]&&!F.ap1f&&base&&!gLo,fmgc[1]&&!F.ap2f&&base&&!yLo];
  const athr=(fmgc[0]||fmgc[1])&&adrOK>=2, anyF=fmgc[0]||fmgc[1];
  const fdSrc=[fmgc[0]?1:fmgc[1]?2:0,fmgc[1]?2:fmgc[0]?1:0];
  let cat=3; const lim=c=>{ cat=Math.min(cat,c); };
  if(!ap[0]&&!ap[1]) lim(0); else if(!ap[0]||!ap[1]) lim(2);
  if(!athr) lim(1);
  if(A.law!=='NORMAL') lim(0);
  if(fly){ if(A.eng.some(e=>!e.run)||!A.genAv[0]||!A.genAv[1]||gLo||yLo) lim(2); if(A.emer&&A.emer.rat&&!B.ac1&&!B.ac2) lim(0); }
  // STATUS INOP SYS: in flight everything above; on the ground only what has failed (an FMGC or an AP), not a cold aircraft
  const inop=[], failAp=[!!(F.fmgc1||F.ap1f),!!(F.fmgc2||F.ap2f)], show=i=>fly?!ap[i]:failAp[i];
  if(show(0)&&show(1)) inop.push('AP 1+2'); else if(show(0)) inop.push('AP 1'); else if(show(1)) inop.push('AP 2');
  if(fly?!athr:!!(F.fmgc1&&F.fmgc2)) inop.push('A/THR');
  const catS=fly?cat:(failAp[0]&&failAp[1]?0:failAp[0]||failAp[1]?2:3); if(catS<3) inop.push(['CAT 2','CAT 3','CAT 3 DUAL'][catS]);
  A.afs={fmgc,ap,athr,fd:[anyF,anyF],fdSrc,catR:cat,cat:['CAT 1','CAT 2','CAT 3 SINGLE','CAT 3 DUAL'][cat],inop}; }
/* one AP 1+2 line instead of AP 1 and AP 2, and only the lowest approach capability lost (CAT 2 covers CAT 3 and CAT 3 DUAL) */
function normInop(L){ let o=L.slice();
  if(o.includes('AP 1+2')||o.includes('AP 1')&&o.includes('AP 2')){ const at=o.findIndex(t=>/^AP 1|^AP 2/.test(t)); o=o.filter(t=>!/^AP (1|2|1\+2)$/.test(t)); o.splice(Math.max(0,Math.min(at,o.length)),0,'AP 1+2'); }
  const cats=['CAT 2','CAT 3','CAT 3 DUAL'], worst=cats.find(c=>o.includes(c)); if(worst) o=o.filter(t=>!cats.includes(t)||t===worst);
  return o; }

/* ---------- FLIGHT PHASES (FWC) ----------
   1 elec power · 2 first engine started · 3 T.O power · 4 80 kt · 5 lift off · 6 above 1,500 ft (or 2 min after lift-off)
   7 below 800 ft · 8 touchdown · 9 below 80 kt · 10 5 min after the second engine shut down */
function phases(A,dt,air,fm){
  const anyRun=A.eng.some(e=>e.run), toPwr=fm&&fm.toPower, p=A.phase;
  let n=p;
  if(!A.ac&&!A.dc) n=1;
  else if(air.gnd){
    if(p>=5&&p<=8){ n=air.gs>80?8:9; if(p<8) n=8; }
    if(p===8&&air.gs<80) n=9;
    if(p===9&&!anyRun){ A.phaseT+=dt; if(A.phaseT>300) n=10; }
    if(p<=2||p===10||(p===9&&anyRun&&toPwr)) n=anyRun?(toPwr?(air.gs>80?4:3):2):1;
    if(p===3&&air.gs>80) n=4;
    if((p===3||p===4)&&!toPwr&&air.gs<80) n=anyRun?2:1;
  } else {
    if(p<=4) { n=5; A.liftT=0; }
    A.liftT=(A.liftT||0)+dt;
    if(n===5&&(air.ra>1500||A.liftT>120)) n=6;
    if(n===6&&air.ra<800&&fm&&fm.gearDown) n=7;
    if(n===7&&toPwr) n=6;
  }
  if(n!==p){ A.phase=n; A.phaseT=0; }
}

/* ---------- ECAM: warnings, cautions, procedures, memos ----------
   Each alert: id, lvl (3 red warning with MASTER WARN, 2 amber caution with MASTER CAUT, 1 amber without), sys title, text,
   steps [[text, done()]] in cyan until done (then removed, as on the E/WD), page (SD page called), inhibited phases. */
function alerts(A,air,fm){
  const S=A.sw, B=A.bus, H=A.hyd, F=A.fuel, e=A.eng, X=A.air, E=A.ecam, out=[], ph=A.phase, gnd=air.gnd, misc=A.misc||{};
  /* One alert as the E/WD shows it: lvl 3 red warning (MASTER WARN), 2 amber caution (MASTER CAUT and the single chime),
     1 amber without them. Each line is [text, done, show, colour]: '-' lines are actions (cyan) and go when the system senses
     them done, '.' lines are conditions (white) and go when nothing under them is left, other lines are limitations or
     information (cyan, or the colour given). The texts and the flight-phase inhibitions follow the A320 FWC. */
  const add=(id,lvl,title,text,lines,o)=>{ o=o||{}; if(o.inh&&o.inh.includes(ph)) return;
    let st=(lines||[]).filter(l=>(l[2]===undefined||!!l[2])&&!(l[1]&&l[1]()));
    st=st.filter((l,i)=>!/^\s*\./.test(l[0])||(st[i+1]&&!/^\s*\./.test(st[i+1][0])));
    out.push({id,lvl,title,text,steps:st,page:o.page||null,crc:!!o.crc}); };
  const tl=i=>fm?fm.tla[i]:0, idle=i=>tl(i)<=0.5, conf=fm&&fm.conf!=null?fm.conf:0;
  const red=(t,show)=>[t,null,show===undefined?true:show,'r'];

  /* ---- FIRE: ENG FIRE has the in-flight and the on-ground lines (on ground it ends in the EMER EVAC procedure) ---- */
  for(let i=0;i<2;i++){ const n=i+1; if(!A.fire.e[i]) continue; const pk=()=>!!S.park, ag1=()=>!!S['ag'+n+'1'], ag2=()=>!!S['ag'+n+'2'], t10=(A.fire.pbT||[0,0])[i]>=10;
    add('eng'+n+'fire',3,'ENG '+n+' FIRE','',[
      ['-THR LEVER '+n+'.......IDLE',()=>idle(i),!gnd],['-THR LEVERS........IDLE',()=>idle(0)&&idle(1),gnd],
      ['.WHEN A/C IS STOPPED:',pk,gnd],['-PARKING BRK.........ON',pk,gnd],['-ATC.............NOTIFY',null,gnd],['-CABIN CREW.......ALERT',null,gnd],
      ['-ENG MASTER '+n+'.......OFF',()=>!S['mst'+n]],['-ENG '+n+' FIRE P/B....PUSH',()=>!!S['fireP'+n]],
      ['-AGENT1 AFTER 10S.DISCH',ag1,!gnd&&!t10],['-AGENT 1..........DISCH',ag1,!gnd&&t10],
      ['-AGENT 1..........DISCH',ag1,gnd],['-AGENT 2..........DISCH',ag2,gnd],['-EMER EVAC PROC...APPLY',null,gnd],
      ['-ATC.............NOTIFY',null,!gnd],['.IF FIRE AFTER 30S:',ag2,!gnd],['-AGENT 2..........DISCH',ag2,!gnd]],{crc:true,page:'eng'}); }
  if(A.fire.a){ const t10=(A.fire.apuPbT||0)>=10;
    add('apufire',3,'APU FIRE','',[['-APU FIRE P/B......PUSH',()=>!!S.fireA],['-AGENT AFTER 10S..DISCH',()=>!!S.agA,!!S.fireA&&!t10],['-AGENT............DISCH',()=>!!S.agA,!!S.fireA&&t10],['-MASTER SW..........OFF',()=>!S.apuM]],{crc:true,page:'apu'}); }

  /* ---- CONFIG (T.O CONFIG pushbutton in phases 1, 2, 9, or take-off power in phases 3 and 4) ---- */
  const toc=fm&&(((ph===3||ph===4)&&fm.toPower)||(A.cfgTest>0&&(ph<=2||ph===9)));
  if(toc){
    if(fm.flapLv<1||fm.flapLv>3){ add('cfgslat',3,'CONFIG','',[red('SLATS NOT IN T.O CONFIG')],{crc:true,inh:[5,6,7,8]}); add('cfgflap',3,'CONFIG','',[red('FLAPS NOT IN T.O CONFIG')],{crc:true,inh:[5,6,7,8]}); }
    if(S.spdBrk>0.05) add('cfgspd',3,'CONFIG','',[red('SPD BRK NOT RETRACTED')],{crc:true,inh:[5,6,7,8]});
    if(fm.ths>3.9||fm.ths<-2.6) add('cfgtrim',3,'CONFIG','PITCH TRIM',[red('    NOT IN T.O RANGE')],{crc:true,inh:[5,6,7,8]});
    if(Math.abs(S.rudTrim||0)>3.6) add('cfgrud',3,'CONFIG','RUD TRIM',[red('    NOT IN T.O RANGE')],{crc:true,inh:[5,6,7,8]});
    if(S.park) add('cfgpark',3,'CONFIG','PARK BRK ON',[],{crc:true,inh:[1,4,5,6,7,8,9,10]}); }
  // T.O speeds: T.O CONFIG pushbutton or take-off power without V1 / VR / V2 in the MCDU
  if(fm&&fm.toSpd&&(ph===2||ph===3)&&(A.cfgTest>0||ph===3)){
    if(fm.toSpd==='none') add('tospd',2,'T.O','SPEEDS NOT INSERTED',[]); else if(fm.toSpd==='disagree') add('tospd',2,'T.O','V1/VR/V2 DISAGREE',[]); }
  // thrust levers between CL and MCT (or at MCT without FLX) at take-off
  if(fm&&(ph===2||ph===3||ph===9)&&e[0].run&&e[1].run){ const flx=!!fm.flex, nst=i=>(tl(i)>26&&tl(i)<34.5)||(!flx&&tl(i)>=34.5&&tl(i)<=35.5);
    if(nst(0)||nst(1)) add('thrnset',2,'ENG','THR LEVERS NOT SET',[['-THR LEVERS.....MCT/FLX',null,flx],['-THR LEVERS........TOGA',null,!flx]]); }

  /* ---- ENGINES ---- */
  for(let i=0;i<2;i++){ const n=i+1, x=e[i];
    if(x.fail&&!A.fire.e[i]) add('eng'+n+'fail',2,'ENG '+n,'FAIL',[['-ENG MODE SEL.......IGN',()=>S.engMode===2],['-THR LEVER '+n+'.......IDLE',()=>idle(i)],['.IF NO RELIGHT AFTER 30S:',()=>!S['mst'+n]],['-ENG MASTER '+n+'.......OFF',()=>!S['mst'+n]]],{page:'eng',inh:[4,5,8]});
    if(x.startFault) add('eng'+n+'sf',2,'ENG '+n,'START FAULT',[['-ENG MASTER '+n+'.......OFF',()=>!S['mst'+n]]],{page:'eng'});
    if(!gnd&&!x.run&&!x.fail&&!S['mst'+n]&&(e[1-i].run)) add('eng'+n+'sd',2,'ENG '+n,'SHUT DOWN',[],{page:'eng',inh:[4,5]}); }
  const rawT=i=>fm&&fm.tlaRaw?fm.tlaRaw[i]:tl(i);
  if(!gnd&&(rawT(0)<-0.5||rawT(1)<-0.5)) add('revset',2,'ENG','REV SET',[['-THR LEVER......FWD THR',null]],{inh:[1,2,3,4,8,9,10]});

  /* ---- ELEC ---- */
  if(A.emer.rat&&!B.ac1&&!B.ac2&&!gnd){ const reset=S.busTie!==0;
    add('emercfg',3,'ELEC','EMER CONFIG',[['MIN RAT SPEED.....140KT',null],['-GEN 1+2....OFF THEN ON',null,reset],['.IF UNSUCCESSFUL :',null,reset],['-BUS TIE............OFF',()=>S.busTie===0],
      ['-GEN 1+2....OFF THEN ON',null,!reset],['-EMER ELEC PWR...MAN ON',()=>!!S.emerMan],['-ENG MODE SEL.......IGN',()=>S.engMode===2],['-VHF1/ATC1..........USE',null],
      ['FUEL GRVTY FEED',null],['PROC:GRVTY FUEL FEEDING',null],['-FAC 1......OFF THEN ON',null],['-BUS TIE...........AUTO',()=>S.busTie!==0,!reset],['-APU (IF AVAIL)...START',()=>A.apu.st>0||A.apu.avail],
      ['-BLOWER + EXTRACT..OVRD',()=>S.blower===0&&S.extract===0]],{crc:true,page:'elec',inh:[4,8]}); }
  for(let i=0;i<2;i++){ const n=i+1;
    if(e[i].run&&!A.genAv[i]&&S['gen'+n]&&(A.fail['gen'+n]||A.fail.bothGen||!A.idgOK[i]||(A.fail.idg1&&i===0))) add('gen'+n+'f',2,'ELEC','GEN '+n+' FAULT',[['-GEN '+n+'......OFF THEN ON',null],['.IF UNSUCCESSFUL:',()=>!S['gen'+n]],['-GEN '+n+'..............OFF',()=>!S['gen'+n]]],{page:'elec',inh:[1,4,5,7,8,10]});
    if(A.fail.idg1&&i===0&&A.idgOK[0]) add('idg1',2,'ELEC','IDG 1 OIL LO PR',[['-IDG 1.............DISC',()=>!!S.idg1]],{page:'elec',inh:[3,4,5,7,8]});
    if(!A.idgOK[i]) add('idg'+n+'disc',2,'ELEC','IDG '+n+' DISCONNECTED',[],{page:'elec',inh:[1,4,5,6,7,8,9,10]});
    if(e[i].run&&!S['gen'+n]) add('gen'+n+'off',2,'ELEC','GEN '+n+' OFF',[],{page:'elec',inh:[1,4,5,7,8,10]}); }
  if(A.apu.avail&&S.apuGen&&A.fail.apuGen&&!A.extOn&&!(A.genAv[0]&&A.genAv[1])) add('apugenf',2,'ELEC','APU GEN FAULT',[['-APU GEN....OFF THEN ON',null],['.IF UNSUCCESSFUL:',()=>!S.apuGen],['-APU GEN............OFF',()=>!S.apuGen]],{page:'elec',inh:[4,5,7,8]});
  if(A.ac&&!B.acEss&&(B.ac1||B.ac2)) add('acess',2,'ELEC','AC ESS BUS FAULT',[['-AC ESS FEED.......ALTN',()=>S.acEss===1]],{page:'elec'});
  if(A.fail.acBus1&&B.ac2) add('ac1',2,'ELEC','AC BUS 1 FAULT',[['-AC ESS FEED.......ALTN',()=>S.acEss===1],['BLUE ELEC PUMP......LOST',null]],{page:'elec'});
  if(A.dc&&ph>=2&&!B.dcBat) add('dcbat',2,'ELEC','DC BAT BUS FAULT',[],{page:'elec'});
  for(let i=0;i<2;i++) if(A.ac&&!S['bat'+(i+1)]) add('bat'+i,1,'ELEC','BAT '+(i+1)+' OFF',[],{page:'elec',inh:[1,3,4,5,7,8,10]});
  if(S.genLine===0) add('genline',1,'ELEC','EMER GEN 1 LINE OFF',[],{inh:[1,3,4,5,7,8,9,10]});

  /* ---- HYD ---- */
  const lp=(v)=>v<1450;
  const gLo=lp(H.g)&&(e[0].run||A.fail.hydG), yLo=lp(H.y)&&(e[1].run||A.fail.hydY), bLo=lp(H.b)&&(e[0].run||e[1].run);
  if(ph>=2){
    if(gLo&&yLo) add('hydgy',3,'HYD','G + Y SYS LO PR',[['-PTU................OFF',()=>!S.ptu],['-GREEN ENG 1 PUMP...OFF',()=>!S.hyE1],['-YELLOW ENG 2 PUMP..OFF',()=>!S.hyE2],['FUEL.......USE MAN MODE',null],['MAX SPEED.......320/.77',null]],{crc:true,page:'hyd'});
    else { if(gLo&&!(A.fail.gOvht&&!S.hyE1)) add('hydg',2,'HYD','G SYS LO PR',[['-PTU................OFF',()=>!S.ptu],['-GREEN ENG 1 PUMP...OFF',()=>!S.hyE1]],{page:'hyd',inh:[4,5]});
      else if(e[0].run&&!H.edp[0]&&S.hyE1&&!gLo) add('edp1',2,'HYD','G ENG 1 PUMP LO PR',[['-GREEN ENG 1 PUMP...OFF',()=>!S.hyE1]],{page:'hyd',inh:[4,5]});
      if(yLo&&!(A.fail.yOvht&&!S.hyE2)) add('hydy',2,'HYD','Y SYS LO PR',[['-PTU................OFF',()=>!S.ptu],['-YELLOW ENG 2 PUMP..OFF',()=>!S.hyE2]],{page:'hyd',inh:[4,5]});
      else if(e[1].run&&!H.edp[1]&&S.hyE2&&!yLo) add('edp2',2,'HYD','Y ENG 2 PUMP LO PR',[['-YELLOW ENG 2 PUMP..OFF',()=>!S.hyE2]],{page:'hyd',inh:[4,5]}); }
    if(bLo&&!H.rat&&!(A.fail.bOvht&&!S.hyB)) add('hydb',2,'HYD','B SYS LO PR',[['-BLUE ELEC PUMP.....OFF',()=>!S.hyB]],{page:'hyd',inh:[4,5]});
    if(!S.hyB&&(e[0].run||e[1].run)&&!A.fail.bOvht) add('bpoff',1,'HYD','B ELEC PUMP OFF',[],{page:'hyd'}); }
  if(H.gOvht) add('govht',2,'HYD','G RSVR OVHT',[['-PTU................OFF',()=>!S.ptu],['-GREEN ENG 1 PUMP...OFF',()=>!S.hyE1]],{page:'hyd',inh:[3,4,5,7,8]});
  if(H.yOvht) add('yovht',2,'HYD','Y RSVR OVHT',[['-PTU................OFF',()=>!S.ptu],['-YELLOW ENG 2 PUMP..OFF',()=>!S.hyE2],['-YELLOW ELEC PUMP...OFF',()=>!S.hyY]],{page:'hyd',inh:[3,4,5,7,8]});
  if(H.bOvht) add('bovht',2,'HYD','B RSVR OVHT',[['-BLUE ELEC PUMP.....OFF',()=>!S.hyB]],{page:'hyd',inh:[3,4,5,7,8]});
  if(ph>=2&&!S.ptu&&!(gLo||yLo)&&!A.fail.yOvht&&!A.fail.gOvht) add('ptuoff',1,'HYD','PTU OFF',[]);

  /* ---- FUEL ---- */
  if(ph>=2){
    [['fL1','L TK PUMP 1',B.ac1&&!A.fail.fuelL1],['fL2','L TK PUMP 2',B.ac2&&!A.fail.fuelL2],['fR1','R TK PUMP 1',B.ac1],['fR2','R TK PUMP 2',B.ac2]].forEach(([k,t,ok])=>{
      if(S[k]&&!ok&&(F.li+F.lo>0||F.ri+F.ro>0)) add(k,2,'FUEL',t+' LO PR',[['-'+t+'........OFF',()=>!S[k]]],{page:'fuel',inh:[3,4,5,7,8]});
      if(!S[k]) add(k+'off',1,'FUEL',t+' OFF',[],{page:'fuel',inh:[3,4,5,7,8]}); });
    if(F.c>250&&(F.li<5000||F.ri<5000)&&!F.ctrRun&&S.fMode===1&&!(fm&&fm.slat>0)) add('autofeed',2,'FUEL','AUTO FEED FAULT',[['-MODE SEL...........MAN',()=>S.fMode===0],['-CTR TK PUMP 1+2.....ON',()=>S.fC1&&S.fC2]],{page:'fuel'});
    const lLo=F.li+F.lo<750, rLo=F.ri+F.ro<750;
    if(lLo&&rLo) add('wlo',2,'FUEL','L+R WING TK LO LVL',[['-FUEL MODE SEL......MAN',()=>S.fMode===0],['-L TK PUMP 1.........ON',()=>!!S.fL1],['-L TK PUMP 2.........ON',()=>!!S.fL2],['-CTR TK PUMP 1.......ON',()=>!!S.fC1,F.c>250],
      ['-R TK PUMP 1.........ON',()=>!!S.fR1],['-R TK PUMP 2.........ON',()=>!!S.fR2],['-CTR TK PUMP 2.......ON',()=>!!S.fC2,F.c>250],['.IF NO FUEL LEAK:',()=>!!S.fX],['-FUEL X FEED.........ON',()=>!!S.fX]],{page:'fuel',inh:[3,4,5,7,8,9]});
    else if(lLo||rLo){ const s=lLo?'L':'R'; add(s.toLowerCase()+'wlo',2,'FUEL',s+' WING TK LO LVL',[['-FUEL MODE SEL......MAN',()=>S.fMode===0],['.IF NO FUEL LEAK AND',()=>!!S.fX],['  FUEL IMBALANCE:',()=>!!S.fX],['-FUEL X FEED.........ON',()=>!!S.fX],
      ['-'+s+' TK PUMP 1........OFF',()=>!S['f'+s+'1']],['-'+s+' TK PUMP 2........OFF',()=>!S['f'+s+'2']]],{page:'fuel',inh:[3,4,5,7,8,9]}); } }

  /* ---- AIR / COND / CAB PR ---- */
  if(ph>=2){
    for(let i=0;i<2;i++){ const n=i+1;
      if(A.fail['bleed'+n]&&e[i].run&&S['eb'+n]) add('bl'+n,2,'AIR','ENG '+n+' BLEED FAULT',[['-ENG '+n+' BLEED........OFF',()=>!S['eb'+n]],['-X BLEED...........AUTO',null]],{page:'bleed',inh:[3,4,5,7,8]});
      if(!S['eb'+n]&&!gnd&&!A.apu.bleedOn) add('bl'+n+'off',1,'AIR','ENG '+n+' BLEED OFF',[],{page:'bleed',inh:[3,4,5,7,8]}); } }
  const pk12=!gnd&&((A.fail.pack1||!S.pk1)&&(A.fail.pack2||!S.pk2));
  if(pk12) add('pk12',2,'AIR','PACK 1+2 FAULT',[['-PACK 1.............OFF',()=>!S.pk1],['-PACK 2.............OFF',()=>!S.pk2],['-DES TO FL 100/MEA-MORA',null,!S.ram],['.WHEN DIFF PR <1 PSI',null,!S.ram],[' AND FL BELOW 100:',null,!S.ram],['-RAM AIR.............ON',()=>!!S.ram,!S.ram],['MAX FL.....100/MEA-MORA',null]],{page:'bleed',inh:[3,4,5,7,8]});
  else for(let i=0;i<2;i++){ const n=i+1;
    if(A.fail['pack'+n]&&S['pk'+n]) add('pk'+n,2,'AIR','PACK '+n+' FAULT',[['-PACK '+n+'.............OFF',()=>!S['pk'+n]]],{page:'bleed',inh:[3,4,5,7,8]});
    else if(!S['pk'+n]&&!A.fail['pack'+n]&&(ph===2||ph===6||ph===9)) add('pk'+n+'off',2,'AIR','PACK '+n+' OFF',[],{page:'bleed',inh:[1,3,4,5,7,8,10]}); }
  if(S.apuBl&&A.apu.avail&&(X.v1||X.v2)) add('apubl',2,'AIR','APU BLEED FAULT',[]);
  if(X.cab>9550&&!gnd){
    add('excab',3,'CAB PR','EXCESS CAB ALT',[['-CREW OXY MASKS.....USE',null],['-SIGNS...............ON',()=>S.seatB===2&&S.noSmk===2],['    .EMER DESCENT:',null],['-DESCENT.......INITIATE',null],
      ['-THR LEVERS........IDLE',()=>(idle(0)&&idle(1))||(fm&&fm.athr)],['-SPD BRK...........FULL',()=>S.spdBrk>0.9],['SPD.....MAX/APPROPRIATE',null],['-ENG MODE SEL.......IGN',()=>S.engMode===2],['-ATC.............NOTIFY',null],
      ['-CABIN CREW......ADVISE',null],['-EMER DES (PA).ANNOUNCE',null],['-XPDR 7700.....CONSIDER',null],['MAX FL.....100/MEA-MORA',null],['  .IF CAB ALT>14000FT:',()=>!!S.paxOxy],['-PAX OXY MASKS...MAN ON',()=>!!S.paxOxy]],{crc:true,page:'press',inh:[1,2,3,4,5,7,8,9,10]}); }
  if(gnd&&X.dp>0.03&&ph>=9&&!e[0].run&&!e[1].run) add('dphi',3,'CAB PR','EXCES RESIDUAL PR',[['-PACK 1.............OFF',()=>!S.pk1],['-PACK 2.............OFF',()=>!S.pk2],['-CABIN CREW.......ALERT',null]],{crc:true,page:'press',inh:[1,2,3,4,5,6,7,8]});

  /* ---- F/CTL ---- */
  if(!A.elac[0]&&S.elac1&&A.dc) add('elac1',2,'F/CTL','ELAC 1 FAULT',[['-ELAC 1.....OFF THEN ON',null],['.IF UNSUCCESSFUL :',()=>!S.elac1],['-ELAC 1.............OFF',()=>!S.elac1],['FUEL CONSUMPT INCRSD',null],['FMS PRED UNRELIABLE',null]],{page:'fctl',inh:[3,4,5,7,8]});
  if(!A.sec[0]&&S.sec1&&A.dc) add('sec1',2,'F/CTL','SEC 1 FAULT',[['-SEC 1......OFF THEN ON',null],['.IF UNSUCCESSFUL :',()=>!S.sec1],['-SEC 1..............OFF',()=>!S.sec1],['SPD BRK......DO NOT USE',null]],{page:'fctl',inh:[3,4,5]});
  if(!S.elac1&&ph>=2) add('elac1o',1,'F/CTL','ELAC 1 OFF',[],{page:'fctl'});
  if(A.law==='ALTN'&&!gnd) add('altn',2,'F/CTL','ALTN LAW',[['      (PROT LOST)',null,true,'a'],['MAX SPEED.......320/.77',null],['MANEUVER WITH CARE',null]],{page:'fctl',inh:[4,5,7,8]});
  if(A.law==='DIRECT'&&!gnd) add('direct',2,'F/CTL','DIRECT LAW',[['      (PROT LOST)',null,true,'a'],['MAX SPEED.......320/.77',null],['-MAN PITCH TRIM.....USE',null],['MANEUVER WITH CARE',null],['USE SPD BRK WITH CARE',null]],{page:'fctl',inh:[4,5,7,8]});
  // speed brakes out too long (50 s in flight, 5 s below 800 ft), flap lever not at 0 above FL 220, ground spoilers not armed on final
  E.sbT=S.spdBrk>0.05&&!gnd?(E.sbT||0)+(A.dtNow||0):0;
  if((ph===6&&E.sbT>50)||(ph===7&&E.sbT>5)) add('sbout',2,'F/CTL','SPD BRK STILL OUT',[],{inh:[1,2,3,4,5,8,9,10]});
  if(ph===6&&air.alt>=22000&&fm&&fm.flapLv>0) add('flapnz',3,'F/CTL','FLAP LVR NOT ZERO',[],{crc:true,inh:[1,2,3,4,5,7,8,9,10]});
  if((ph===6||ph===7)&&air.ra<500&&S.gearLv===1&&fm&&fm.gearDown&&!S.spArm&&!(fm.toPower)) add('gsplr',2,'F/CTL','GND SPLR NOT ARMED',[],{inh:[1,2,3,4,5,8,9,10]});

  /* ---- NAV ---- */
  /* IR and ADR faults; in flight an ADIRS mode selector turned to OFF loses the IR and the ADR, to ATT the IR navigation.
     The switching actions are for the captain's side (1) and the first officer's side (2); unit 3 is the standby. */
  const swtg=['CAPT ON 3','F/O ON 3',null];
  for(let i=0;i<3;i++){ const m=S['irM'+(i+1)], sel=i===0?0:2;
    if(A.irs[i].st===4||(!gnd&&(m===0||m===2))) add('ir'+i,2,'NAV','IR '+(i+1)+' FAULT',swtg[i]?[['-ATT HDG SWTG..'+swtg[i],()=>misc.attHdg===sel]]:[],{inh:[3,4,5,7,8]});
    if(A.fail['adr'+(i+1)]||(!gnd&&m===0)) add('adr'+i,2,'NAV','ADR '+(i+1)+' FAULT',swtg[i]?[['-AIR DATA SWTG.'+swtg[i],()=>misc.airData===sel]]:[],{inh:[3,4,5,7,8]}); }
  // IR not aligned at take-off power or T.O CONFIG test
  if((ph===2||ph===3)&&(A.cfgTest>0||(fm&&fm.toPower))&&A.irs.some(r=>r.st===1)) add('irna',2,'NAV','IR NOT ALIGNED',[],{inh:[1,4,5,6,7,8,10]});
  // the captain's and the first officer's baro references differ (QNH / STD)
  if(fm&&fm.baroDiff) add('baroref',2,'NAV','BARO REF DISCREPANCY',[['-BARO REF.......X CHECK',null]],{inh:[1,2,3,4,8,9,10]});
  if(fm&&fm.tcasStby) add('tcasstby',2,'NAV','TCAS STBY',[],{inh:[1,2,3,4,5,7,8,9,10]});
  if(fm&&fm.xpdrStby&&!gnd) add('xpdrstby',2,'NAV','ATC/XPDR STBY',[],{inh:[1,2,3,4,5,7,8,9,10]});
  if(S.gpwsT===0) add('terr',2,'NAV','GPWS TERR DET FAULT',[],{inh:[3,4,5,7,8]});

  /* ---- BRAKES / L/G / WHEEL ---- */
  // BRAKES HOT (above 300 °C): at take-off (T.O CONFIG test or take-off power) and in flight; not after landing
  E.toChk=ph===2||ph===3?(E.toChk||A.cfgTest>0||ph===3):false;
  if(Math.max(...A.brk.temp)>300&&(E.toChk||!gnd)) add('brkhot',2,'BRAKES','HOT',[['  .IF PERF PERMITS :',null,!gnd],['-PARK BRK:PREFER CHOCKS',null,ph===1||ph===10],['MAX SPEED.......250/.60',null,!gnd],
    ['-BRK FAN.............ON',()=>!!S.brkFan,ph===1||ph===2],['-DELAY T.O FOR COOL',null,gnd],['-L/G........DN FOR COOL',()=>!!(fm&&fm.gearDown),!gnd],['  .FOR L/G RETRACTION:',null,!gnd],['MAX SPEED.......220/.54',null,!gnd]],{page:'wheel',inh:[4,8,9,10]});
  if(A.fail.bscu) add('bscu',2,'BRAKES','A/SKID N/WS FAULT',[['MAX BRK PR......1000PSI',null]],{page:'wheel',inh:[4,5]});
  else if(S.askid===0) add('askidoff',2,'BRAKES','A/SKID N/WS OFF',[['MAX BRK PR......1000PSI',null]],{page:'wheel',inh:[4,5]});
  if(A.fail.nws&&!A.fail.bscu) add('nws',2,'WHEEL','N/W STRG FAULT',[],{page:'wheel',inh:[3,4,5,7,8]});
  E.pbT=S.park&&!gnd?(E.pbT||0)+(A.dtNow||0):0;
  if(E.pbT>2) add('parkfl',2,'BRAKES','PARK BRK ON',[['-PARK BRK...........OFF',()=>!S.park]],{inh:[1,2,3,4,5,8,9,10]});
  // gear not down: below 750 ft RA with the flaps in landing configuration (or the thrust levers at idle) and no gear
  if(!gnd&&fm&&!fm.gearDown&&air.ra<750&&(fm.flapLv>=3||(idle(0)&&idle(1)))&&ph>=6) add('lgnd',3,'L/G','GEAR NOT DOWN',[],{crc:true,page:'wheel',inh:[3,4,5]});
  // gear not uplocked / not downlocked (failures)
  if(!gnd&&fm&&fm.gearNotUplocked) add('lgnul',2,'L/G','GEAR NOT UPLOCKED',[['MAX SPEED.......220/.54',null,!fm.gearDown],['-L/G............RECYCLE',null,!E.lgRecycled],['   .IF UNSUCCESSFUL',()=>S.gearLv===1],['-L/G...............DOWN',()=>S.gearLv===1],
    ['MAX SPEED.......280/.67',null,!!fm.gearDown],['AVOID EXCESS G FACTOR',null],['FUEL CONSUMPT INCRSD',null],['FMS PRED UNRELIABLE',null]],{page:'wheel',inh:[3,4,7,8,9,10]});
  if(!gnd&&fm&&fm.gearNotDownlocked) add('lgndl',3,'L/G','GEAR NOT DOWNLOCKED',[['-L/G............RECYCLE',null,!E.lgRecycled],['   .IF UNSUCCESSFUL',null],['     AFTER 120S:',null],['-L/G GRVTY PROC...APPLY',()=>!!fm.gearGrav]],{crc:true,page:'wheel',inh:[3,4,5,8]});

  /* ---- SMOKE (cargo): the detectors also react to the agent, so the warning can stay after the discharge ---- */
  for(const [f,side,dk] of [['smokeFwd','FWD','cgoDF'],['smokeAft','AFT','cgoDA']]) if(A.fail[f]) add('smk'+side.toLowerCase(),3,'SMOKE',side+' CARGO SMOKE',[
    ['-AFT ISOL VALVE.....OFF',()=>misc.aftIsol===0,side==='AFT'],['-CAB FANS...........OFF',()=>!S.cabFans],['  .IF '+side+' CARG CLOSED:',()=>!!S[dk],ph===1||ph===10],['-AGENT............DISCH',()=>!!S[dk]],
    ['  .WHEN ON GROUND:',null,!gnd],[' BEFORE OPEN CRG DOORS:',null,!gnd],['.BEFORE OPEN CRG DOORS:',null,gnd],['-PAX..........DISEMBARK',null]],{crc:true,inh:[4,5,7,8]});

  /* ---- AUTO FLT / OVERSPEED / OXY / DOOR ---- */
  if(fm&&fm.apOffWarn) add('apoff',3,'AUTO FLT','AP OFF',[]);
  if(fm&&fm.athrOffCaut) add('athroff',2,'AUTO FLT','A/THR OFF',[['-THR LEVERS........MOVE',null]],{inh:[4,8,10]});
  if(fm&&fm.overspeed&&!gnd){ const vfe=[0,230,215,200,185,177][conf]||0, ias=air.ias;
    if(conf>0&&ias>vfe+4) add('ovsp',3,'OVER SPEED','',[['-VFE...............'+vfe,null]],{crc:true,inh:[2,3,4,8,9,10]});
    else add('ovsp',3,'OVER SPEED','',[['-VMO/MMO........350/.82',null]],{crc:true,inh:[2,3,4,8,9,10]}); }
  if(ph>=2&&!S.crewOxy) add('oxy',1,'OXY','CREW SUPPLY OFF',[]);
  if(A.doors.fwdL&&ph>=2&&!gnd) add('door',2,'DOOR','L FWD CABIN',[],{page:'door'});
  out.sort((a,b)=>b.lvl-a.lvl);
  return out;
}

function memos(A,air,fm){
  const S=A.sw, m=[], r=[], ph=A.phase, E=A.ecam;
  /* a memo line: green when done (t), cyan with the dotted action while not (p) */
  const blue=(t,ok,p)=>({t,ok:!!ok,p});
  // T.O MEMO: phase 2, 2 min after the second engine start (or T.O CONFIG pb), until T.O power
  const both=A.eng[0].run&&A.eng[1].run;
  if(both&&ph===2){ if(E.t2<0) E.t2=0; } else if(!both) E.t2=-1;
  E.tomemo=ph===2&&(E.t2>=120||A.cfgTest>0||E.toMemoOn);
  if(ph!==2) E.toMemoOn=false;
  E.ldgmemo=(ph===6||ph===7)&&air.ra<2000&&fm&&fm.gearDown!==undefined&&!air.gnd&&air.ra>=0&&ph>=6&&(air.ra<2000);
  if(E.tomemo){
    m.push(['T.O',[blue('AUTO BRK MAX',S.abrk===3,'AUTO BRK.....MAX'),blue('SIGNS ON',S.seatB===2&&S.noSmk===2,'SIGNS.........ON'),blue('CABIN READY',E.cabinReady,'CABIN......CHECK'),blue('SPLRS ARM',S.spArm,'SPLRS........ARM'),blue('FLAPS T.O',fm&&fm.flapLv>=1&&fm.flapLv<=3,'FLAPS........T.O'),blue('T.O CONFIG NORMAL',E.cfgOK&&E.cfgDone,'T.O CONFIG..TEST')]]);
  } else if(E.ldgmemo){
    m.push(['LDG',[blue('LDG GEAR DN',fm&&fm.gearDown,'LDG GEAR......DN'),blue('SIGNS ON',S.seatB===2&&S.noSmk===2,'SIGNS.........ON'),blue('CABIN READY',E.cabinReady,'CABIN......CHECK'),blue('SPLRS ARM',S.spArm,'SPLRS........ARM'),blue(S.ldgF3?'FLAPS CONF 3':'FLAPS FULL',fm&&(S.ldgF3?fm.flapLv>=3:fm.flapLv===4),S.ldgF3?'FLAPS.....CONF 3':'FLAPS.......FULL')]]);
  }
  // right memo (green; some amber)
  const R=(t,c)=>r.push({t,c:c||'g'});
  if(A.irs.some(x=>x.st===1)) R('IR IN ALIGN '+(A.alignMin>0?A.alignMin+' MN':''),air.gnd&&A.eng.some(e=>e.run)?'a':'g');
  if(S.park&&air.gnd) R('PARK BRK',ph>=3&&ph<=8?'a':'g');
  if(S.seatB===2||(S.seatB===1&&fm&&!fm.gearUp)) R('SEAT BELTS');
  if(S.noSmk===2||(S.noSmk===1&&fm&&!fm.gearUp)) R('NO SMOKING');
  if(!E.tomemo&&!E.ldgmemo&&S.spArm) R('GND SPLRS ARMED');
  if(S.spdBrk>0.05&&!air.gnd) R('SPEED BRK',both&&(air.ra<50||(A.eng[0].thrF>0.3))?'a':'g');
  if(S.wai) R('WING A.ICE'); if(S.eai1||S.eai2) R('ENG A.ICE');
  if(A.apu.avail&&!A.apu.bleedOn) R('APU AVAIL'); if(A.apu.bleedOn) R('APU BLEED');
  if(S.landL===2||S.landR===2) R('LDG LT');
  if(S.strobe===0&&!air.gnd) R('STROBE LT OFF');
  if(((S.engMode===2&&!air.gnd)||S.eai1||S.eai2)&&A.eng.some(e=>e.run&&(e.ignA||e.ignB))) R('IGNITION');
  if(A.hyd.rat) R('RAT OUT',air.gnd?'a':'g');
  if(A.emer.emerGen) R('EMER GEN');
  if(A.fuel.xfr) R('OUTR TK FUEL XFRD');
  if(S.fX) R('FUEL X FEED',air.gnd?'g':'a');
  if(A.hyd.ptu&&air.gnd) R('HYD PTU');
  if(A.sw.manSt1||A.sw.manSt2) R('MAN START');
  if(A.gpu&&!S.ext&&air.gnd) R('EXT PWR AVAIL','g');
  if(S.abrk&&!E.tomemo&&!E.ldgmemo) R('AUTO BRK '+['','LO','MED','MAX'][S.abrk]);
  if(fm&&fm.tcasStby) R('TCAS STBY');
  if(A.air.ram) R('RAM AIR ON'); if(S.ldgElev) R('MAN LDG ELEV'); if(S.gpwsF===0) R('GPWS FLAP MODE OFF');
  if(A.com&&A.com.wx&&A.com.wx.pws===0) R('PRED W/S OFF');
  const mi=A.misc; if(mi&&(mi.attHdg!==1||mi.airData!==1||mi.eisDmc!==1||mi.ecamNd!==1)) R('SWITCHG PNL'); if(mi&&mi.audio!==1) R('AUDIO 3 XFRD');
  if(E.land&&E.stsDone) R('LAND ASAP',E.land==='r'?'r':'a'); if(E.stsHas&&(E.stsDone||!E.stsAlert)) R('STS','w');
  E.memo=m; E.memoR=r;
}

/* ---------- ECAM flow (APS "ECAM Handling"): Box 1 primary failures and actions, Box 2 LAND ASAP and secondary failures (*),
   Box 3 STATUS limitations and procedures, Box 4 INOP SYS. CLR clears the primary failures one by one, then the SD shows each
   secondary failure's page in turn (CLR each), then the STATUS page comes up by itself; CLR removes it. ---------- */
const ECX=[
  [/^eng\dfire$/,{land:'r',sec:n=>[['*HYD','hyd'],['*ELEC','elec'],['*AIR','bleed']],lim:[],proc:['APPR PROC:','  IF SEVERE ICE: ENG ANTI ICE..ON'],inop:n=>['ENG '+n,'ENG '+n+' BLEED','GEN '+n,(n===1?'G':'Y')+' ENG '+n+' PUMP','CAT 3 DUAL']}],
  [/^eng\dfail$/,{land:'a',sec:n=>[['*HYD','hyd'],['*ELEC','elec'],['*AIR','bleed']],lim:[],proc:['ENG RELIGHT...CONSIDER'],inop:n=>['ENG '+n,'ENG '+n+' BLEED','GEN '+n,(n===1?'G':'Y')+' ENG '+n+' PUMP','CAT 3 DUAL']}],
  [/^eng\dsd$/,{land:'a',sec:n=>[['*HYD','hyd'],['*ELEC','elec'],['*AIR','bleed']],lim:[],proc:[],inop:n=>['ENG '+n,'ENG '+n+' BLEED','GEN '+n,(n===1?'G':'Y')+' ENG '+n+' PUMP','CAT 3 DUAL']}],
  [/^apufire$/,{land:'r',sec:()=>[],lim:[],proc:[],inop:()=>['APU']}],
  [/^emercfg$/,{land:'r',sec:()=>[['*F/CTL','fctl'],['*HYD','hyd'],['*FUEL','fuel'],['*AIR','bleed']],lim:['MAX SPD.............320/.77','MIN RAT SPD.........140 KT','APPR SPD.........VREF+10'],proc:['FOR LDG: USE FLAP 3','GPWS LDG FLAP 3....ON','L/G..........GRVTY EXTN','ALTN LAW: PROT LOST'],inop:()=>['GEN 1+2','MAIN GALLEY','FUEL PUMPS','CAT 2']}],
  [/^gen\df$/,{land:'',sec:()=>[],lim:[],proc:[],inop:n=>['GEN '+n,'CAT 3 DUAL']}],
  [/^hydgy$/,{land:'r',sec:()=>[['*F/CTL','fctl'],['*BRAKES','wheel'],['*NW STRG','wheel']],lim:['MAX SPD.............320 KT','MANEUVER WITH CARE','APPR SPD..........VREF+25'],proc:['FOR LDG: USE FLAP 3','GPWS LDG FLAP 3....ON','L/G..........GRVTY EXTN','ALTN LAW: PROT LOST','LDG DIST PROC.......APPLY'],inop:()=>['G+Y HYD','AP 1+2','SPLR 1+2+3+4+5','FLAPS','A/SKID','N/W STRG','CAT 2']}],
  [/^hydg$/,{land:'',sec:()=>[['*F/CTL','fctl'],['*WHEEL','wheel']],lim:[],proc:['SLATS SLOW','L/G..........GRVTY EXTN','LDG DIST PROC.......APPLY'],inop:()=>['G HYD','CAT 3 DUAL','SPLR 1+5','AP 1']}],
  [/^hydy$/,{land:'',sec:()=>[['*F/CTL','fctl'],['*WHEEL','wheel']],lim:[],proc:['FLAPS SLOW','LDG DIST PROC.......APPLY'],inop:()=>['Y HYD','CAT 3 DUAL','SPLR 2+4','AP 2','N/W STRG']}],
  [/^hydb$/,{land:'',sec:()=>[['*F/CTL','fctl']],lim:[],proc:[],inop:()=>['B HYD','SPLR 3','CSM/G']}],
  [/^bl\d$/,{land:'',sec:()=>[],lim:[],proc:[],inop:n=>['ENG '+n+' BLEED']}],
  [/^pk\d$/,{land:'',sec:()=>[],lim:[],proc:[],inop:n=>['PACK '+n]}],
  [/^pk12$/,{land:'a',sec:()=>[['*PRESS','press']],lim:['MAX FL..............100/MEA'],proc:['WHEN DIFF PR<1 PSI AND','FL BELOW 100: RAM AIR..ON'],inop:()=>['PACK 1+2']}],
  [/^excab$/,{land:'a',sec:()=>[],lim:['MAX FL..............100/MEA'],proc:[],inop:()=>[]}],
  [/^elac\d$/,{land:'',sec:()=>[],lim:[],proc:[],inop:n=>['ELAC '+n]}],
  [/^sec\d$/,{land:'',sec:()=>[],lim:[],proc:[],inop:n=>['SEC '+n]}],
  [/^altn$/,{land:'',sec:()=>[],lim:['MAX SPD.............320 KT'],proc:['ALTN LAW: PROT LOST','WHEN L/G DN: DIRECT LAW'],inop:()=>['F/CTL PROT','CAT 2']}],
  [/^direct$/,{land:'',sec:()=>[],lim:['MAX SPD..........320/.77','MANEUVER WITH CARE','USE MAN PITCH TRIM'],proc:[],inop:()=>['F/CTL PROT','AP 1+2','CAT 2']}],
  [/^bscu$/,{land:'',sec:()=>[],lim:[],proc:['LDG DIST PROC.......APPLY'],inop:()=>['ANTI SKID','N/W STRG','AUTO BRK']}],
  [/^nws$/,{land:'',sec:()=>[],lim:[],proc:[],inop:()=>['N/W STRG']}],
  [/^yovht$/,{land:'',sec:()=>[],lim:[],proc:['IF OVHT OUT:','YELLOW ENG 2 PUMP.....ON','PTU..................AUTO'],inop:()=>['Y HYD','N/W STRG']}],
  [/^govht$/,{land:'',sec:()=>[],lim:[],proc:['IF OVHT OUT:','GREEN ENG 1 PUMP......ON','PTU..................AUTO'],inop:()=>['G HYD']}],
  [/^bovht$/,{land:'',sec:()=>[],lim:[],proc:['IF OVHT OUT:','BLUE ELEC PUMP........ON'],inop:()=>['B HYD']}],
  [/^askidoff$/,{land:'',sec:()=>[],lim:[],proc:['LDG DIST PROC.......APPLY'],inop:()=>['ANTI SKID','N/W STRG','AUTO BRK']}],
  [/^lgnul$/,{land:'',sec:()=>[],lim:['MAX SPD........280/.67'],proc:[],inop:()=>[]}],
  [/^lgndl$/,{land:'',sec:()=>[],lim:[],proc:['L/G GRVTY PROC.....APPLY'],inop:()=>['L/G RETRACT']}],
  [/^smk(fwd|aft)$/,{land:'r',sec:()=>[],lim:[],proc:[],inop:()=>[]}],
  [/^ir\d$/,{land:'',sec:()=>[],lim:[],proc:[],inop:n=>['IR '+(n+1)]}],
  [/^adr\d$/,{land:'',sec:()=>[],lim:[],proc:[],inop:n=>['ADR '+(n+1)]}]
];
/* STATUS items from the auto flight availability (an AP, the A/THR or approach capability lost, also without an alert of its own) */
function standing(A){ return A.afs?A.afs.inop:[]; }
function ecamFlow(A){
  const E=A.ecam; let land='', sec=[], lim=[], proc=[], inop=[];
  for(const a of E.list){ const m=ECX.find(x=>x[0].test(a.id)); if(!m) continue; const d=m[1], n=+(/\d/.exec(a.id)||[0])[0]||0;
    if(d.land==='r'||(d.land==='a'&&land!=='r')) land=d.land;
    for(const sc of d.sec(n)) if(!sec.some(z=>z[0]===sc[0])) sec.push(sc);
    lim.push(...d.lim.filter(t=>!lim.includes(t))); proc.push(...d.proc.filter(t=>!proc.includes(t))); inop.push(...d.inop(n).filter(t=>t&&!inop.includes(t))); }
  if(A.gndNow) land=''; // LAND ASAP is a message for the flight
  E.stsAlert=lim.length+proc.length+inop.length>0; // STATUS that comes up by itself after the alerts
  for(const t of standing(A)) if(!inop.includes(t)) inop.push(t);
  inop=normInop(inop);
  E.land=land; E.secList=sec.map(([t,p])=>({t,p,clr:!!(E.secClr||{})[t]})); E.stsLim=lim; E.stsProc=proc; E.stsInop=inop;
  E.stsHas=lim.length+proc.length+inop.length>0;
}
/* the SD page the ECAM shows by itself: the page of the active alert, else the flight-phase page (FCOM DSC-31-40) */
function autoPage(A,air,fm){
  const E=A.ecam, S=A.sw;
  const top=E.list.find(a=>a.page&&!E.clr[a.id]);
  if(top) return top.page;
  if(E.list.some(a=>!E.clr[a.id])) return 'eng';
  const sc=(E.secList||[]).find(x=>!x.clr); if(sc) return sc.p;
  if(E.stsAlert&&!E.stsDone) return 'sts';
  if(A.eng.some(e=>e.st>0&&e.st<4)||S.engMode===2&&!(A.eng[0].run&&A.eng[1].run)) return 'eng';
  if(A.apu.st===1||A.apu.st===2||(A.apu.avail&&A.apu.availT<10)) return 'apu';
  const ph=A.phase;
  if(ph===1) return 'door';
  if(ph===2) return fm&&Math.abs(fm.sideAny)>0.3?'fctl':'wheel';
  if(ph>=3&&ph<=5) return 'eng';
  if(ph===6) return fm&&!fm.gearUp?'wheel':'crz';
  if(ph>=7) return 'wheel';
  return 'door';
}

/* ---------- one step ---------- */
function step(A,dt,air,fm){
  A.t+=dt; A.dtNow=dt; A.env=A.env||{t:15,elev:0}; A.gndNow=air.gnd;
  if(A.alignT==null) A.alignT=420;
  elec(A,dt,air); apu(A,dt,air); engines(A,dt,air,fm); air_(A,dt,air); fuel(A,dt,air,fm); hyd(A,dt,air); adirs(A,dt,air); fire(A,dt); fctl(A); autoFlt(A,air); phases(A,dt,air,fm);
  if(A.cfgTest>0) A.cfgTest=Math.max(0,A.cfgTest-dt);
  if(A.ecam.t2>=0) A.ecam.t2+=dt;
  // ECAM lists
  const E=A.ecam, prev=E.ids||{};
  const L=A.dc&&(A.bus.acEss||A.bus.ac1||A.bus.ac2||A.bus.dcEss)?alerts(A,air,fm):[];
  const ids={}; L.forEach(a=>{ ids[a.id]=1; if(!prev[a.id]){ if(a.lvl===3){ E.mwAck[a.id]=false; } if(a.lvl===2){ E.mcAck[a.id]=false; } A.events.push({k:a.lvl===3?'warn':(a.lvl===2?'caut':'adv'),id:a.id,crc:a.crc}); } });
  Object.keys(E.clr).forEach(k=>{ if(!ids[k]) delete E.clr[k]; });
  if(L.some(a=>!prev[a.id]&&a.lvl>=2)){ E.secClr={}; E.stsDone=false; }
  E.ids=ids; E.list=L;
  if(ids.lgnul||ids.lgndl){ if(E.lgPrev!=null&&A.sw.gearLv!==E.lgPrev) E.lgRecycled=true; } else E.lgRecycled=false; E.lgPrev=A.sw.gearLv;
  ecamFlow(A);
  E.mw=L.some(a=>a.lvl===3&&!E.mwAck[a.id]); E.mc=L.some(a=>a.lvl===2&&!E.mcAck[a.id]);
  E.crc=L.some(a=>a.crc&&!E.mwAck[a.id]);
  E.cfgOK=!L.some(a=>a.id.startsWith('cfg'));
  if(A.cfgTest>0&&E.cfgOK) E.cfgDone=true; if(A.phase!==2) E.cfgDone=false; // T.O CONFIG NORMAL after a test without a warning
  memos(A,air,fm);
  E.auto=autoPage(A,air,fm);
  E.page=E.man||E.auto;
  E.sts=L.length>0||A.law!=='NORMAL';
  A.gw=A.zfw+A.fuel.fob;
}
const air_=air;
/* panel actions that are more than a switch */
function ecamBtn(A,k){
  const E=A.ecam;
  if(k==='clr'){ const a=E.list.find(x=>!E.clr[x.id]); if(a){ E.clr[a.id]=1; E.man=null; return; }
    const sc=(E.secList||[]).find(x=>!x.clr); if(sc){ E.secClr=E.secClr||{}; E.secClr[sc.t]=1; ecamFlow(A); E.man=null; return; }
    if(E.stsAlert&&!E.stsDone){ E.stsDone=true; E.man=null; return; }
    E.man=null; E.rcl=false; return; }
  if(k==='rcl'){ E.clr={}; E.secClr={}; E.stsDone=false; ecamFlow(A); E.rcl=true; return; }
  if(k==='emer'){ E.list.forEach(a=>{ E.mwAck[a.id]=true; E.mcAck[a.id]=true; }); return; }
  if(k==='cfg'){ A.cfgTest=3; E.toMemoOn=true; return; }
  if(k==='sts'){ E.man=E.man==='sts'?null:'sts'; return; }
  if(k==='all'){ const pages=['eng','bleed','press','elec','hyd','fuel','apu','cond','door','wheel','fctl']; const i=pages.indexOf(E.man); E.man=pages[(i+1)%pages.length]; return; }
  E.man=E.man===k?null:k;
}
function master(A,lvl){ const E=A.ecam; E.list.forEach(a=>{ if(lvl===3&&a.lvl===3) E.mwAck[a.id]=true; if(lvl===2&&a.lvl===2) E.mcAck[a.id]=true; }); }

G.A320SYS={create,step,defaults,ecamBtn,master,FAILS,IDLE,wheels,adrValid,irValid};
})(typeof window!=='undefined'?window:globalThis);
