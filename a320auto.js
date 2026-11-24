/* NORDAP – A320 auto-fly (a320.html, a320-3d.html): a second pilot who flies the aircraft by hand, so the student can work the
   checklists, flows and the FMS while the aircraft moves. It is NOT the autopilot: the AP, FD and A/THR stay the student's own
   to engage and disengage. Auto-fly moves the sidestick, the thrust levers, the pedals and the brakes through the flight model's
   own hooks (M.auto: gamC = flight path to fly, phiC = bank, sy/rud/til/brk on the ground) and the thrust levers as the student
   sees them. When the AP is engaged the AP flies and auto-fly only keeps the thrust (unless the A/THR has it). Any sidestick
   input takes over ("You have control").
   As pilot flying it calls for the gear and the flaps; the student (pilot monitoring) selects them. If nothing happens within
   a few seconds it selects them itself, so the flight never gets stuck.
   The flight: taxi from the stand to the holding point of runway 36, line up and take off when the student says so, a circuit
   at the FCU altitude (3,000 to 10,000 ft) with a downwind leg long enough for the descent and approach preparation, the
   ILS 36 to a landing, and off the runway at the end. Started in the air it joins the circuit where it makes sense. */
(function(G){
'use strict';
const F=G.A320FM, D2R=F.D2R, R2D=F.R2D, KT=F.KT, FT=F.FT, NM=F.NM, clamp=F.clamp, w180=F.w180, w360=F.w360;
const T=(en,no)=>({en,no});
const P={P1:[7,0],P2:[9,5.5],P3:[-6,6],P4:[-14,3]}; // NM north, east of the threshold of runway 36
const HOLD=[-40,60], LINE=[15,0];
const GP=3*D2R;
const TX={
  title:T('Auto-fly','Autofly'),
  taxi:T('Taxiing to the holding point of runway 36','Taxer til venteposisjonen for rullebane 36'),
  hold:T('Holding short of runway 36','Venter før rullebane 36'),
  lineup:T('Lining up on runway 36','Stiller opp på rullebane 36'),
  ready:T('Lined up on runway 36','Oppstilt på rullebane 36'),
  to:T('Take-off','Avgang'),climb:T('Climbing','Stiger'),level:T('Level','Plan flyging'),
  down:T('Downwind, descending to 3,000 ft','Medvind, synker til 3 000 ft'),base:T('Base, intercepting the localizer','Base, fanger localizer'),
  final:T('ILS 36','ILS 36'),flare:T('Flare','Utflating'),roll:T('Roll-out','Utrulling'),exit:T('Vacating the runway','Forlater rullebanen'),
  done:T('Clear of the runway, stopped. Your aircraft.','Klar av rullebanen, stoppet. Flyet er ditt.'),
  bLine:T('Line up','Still opp'),bTo:T('Take off','Ta av'),bOff:T('Stop auto-fly','Stopp autofly'),
  engines:T('Auto-fly taxis once both engines run.','Autofly taxer når begge motorene går.'),
  flapsTO:T('Set the flaps for take-off first.','Sett klaffene for avgang først.'),
  have:T('You have control.','Du har kontrollen.'),
  next:T('PF calls','PF ber om'),apNote:T('AP engaged: the autopilot flies, auto-fly keeps the thrust','AP på: autopiloten flyr, autofly tar seg av skyvekraften'),
  self:T('Auto-fly did it','Autofly gjorde det')
};
const brg=(dN,dE)=>w360(Math.atan2(dE,dN)*R2D);

function create(X,o){
  const L=o.L, say=m=>o.say(L(m)), sayS=s=>o.say(s);
  const S={on:false,ph:'',leg:0,altT:5000,req:null,int:12,t:0,act:null,reqDone:{},msgT:0};
  const AU={on:false,gamC:null,phiC:null,sy:0,rud:0,til:0,brk:0};
  const A=()=>X.A, M=()=>X.M, UI=()=>X.UI;
  function setTla(v){ UI().tla=[v,v]; }
  function both(){ const e=A().eng; return e[0].run&&e[1].run; }
  /* ---------- requests: PF asks, PM does ---------- */
  function ask(key,text,done,doIt){ if(S.reqDone[key]||(S.req&&S.req.key===key)) return; if(done()){ S.reqDone[key]=1; return; }
    S.req={key,text,done,doIt,t:0}; sayS(text); o.changed(); }
  function reqTick(dt){ const r=S.req; if(!r) return; r.t+=dt;
    if(r.done()){ S.reqDone[r.key]=1; S.req=null; o.changed(); return; }
    if(r.t>7){ r.doIt(); S.reqDone[r.key]=1; S.req=null; sayS(r.text+' · '+L(TX.self)); o.changed(); } }
  /* ---------- phase and start ---------- */
  function set(ph){ if(S.ph!==ph){ S.ph=ph; o.changed(); if(o.phase) o.phase(ph); } }
  function start(){ const m=M(); S.req=null; S.reqDone={}; S.int=12; S.altT=clamp(Math.round((m.ap.alt.v||5000)/100)*100,3000,10000);
    if(m.gnd){
      const onRwy=Math.abs(m.E)<12&&m.N>-60&&m.N<2600&&Math.abs(w180(m.psi*R2D))<12;
      if(onRwy){ set(m.gs/KT>30?'to':'ready'); }
      else if(Math.hypot(m.N-HOLD[0],m.E-HOLD[1])<30) set('hold');
      else { S.path=taxiPath(m); set('taxi'); }
    } else {
      const h=w180(m.psi*R2D);
      if(m.N<-1*NM&&Math.abs(m.E)<2.5*NM&&Math.abs(h)<60) { S.leg=5; set('base'); }
      else if(m.E>2*NM&&m.N>P.P4[0]*NM){ S.leg=m.N>P.P3[0]*NM?3:4; set('down'); }
      else { S.leg=m.N>P.P1[0]*NM-1.5*NM?2:1; set('climb'); }
      if(UI().tla[0]<1&&!m.ap.athr) setTla(F.TLA.CL);
    }
    S.on=true; AU.on=true; m.auto=AU; say(TX.title); o.changed(); }
  function stop(msg){ S.on=false; AU.on=false; AU.gamC=AU.phiC=null; AU.sy=AU.rud=AU.til=0; AU.brk=0; S.req=null; S.ph=''; if(msg) say(msg); o.changed(); }
  function taxiPath(m){ const p=[]; if(m.E>70) p.push([m.N,60]); p.push(HOLD); return p; }

  /* ---------- controllers ---------- */
  function spdPitch(m,tgt,lo,hi){ const e=tgt-m.ias, acc=m.accel||0; return clamp(m.gam-(e*0.004-acc*0.05),lo,hi); }
  function thrust(m,tgt,dt,max){ if(m.ap.athr){ /* the A/THR has the thrust: PF selects the speed on the FCU */ const v=Math.round(tgt); if(!m.ap.spd.man||m.ap.spd.mach||m.ap.spd.v!==v){ m.ap.spd.man=true; m.ap.spd.mach=false; m.ap.spd.v=v; } return; } const e=tgt-m.ias; S.int=clamp(S.int+e*0.12*dt,0,max); setTla(clamp(S.int+e*1.0-(m.accel||0)*2,0,max)); }
  function steerTo(m,hdgC,lim){ const e=w180(hdgC-m.psi*R2D); AU.phiC=clamp(e*1.6,-lim,lim)*D2R; }
  function altPath(m,altT){ const e=altT-m.h/FT; return clamp(e*0.00028,-3.2*D2R,6*D2R); }
  function gndSteer(m,tN,tE,spd,dt){ const dN=tN-m.N, dE=tE-m.E, d=Math.hypot(dN,dE), e=w180(brg(dN,dE)-m.psi*R2D);
    const gs=m.gs/KT, v=Math.abs(e)>25?Math.min(spd,8):spd;
    AU.til=clamp(e/35,-1,1); AU.rud=0; setTla(gs<v-2?clamp(6+(v-gs)*1.2,0,14):gs<v?4:0); AU.brk=gs>v+3?0.35:0; return d; }
  function stopGnd(){ setTla(0); AU.til=0; AU.rud=0; AU.brk=1; }
  /* configuration speed for the lever position (approach) */
  function cfgSpd(m){ const lv=A().sw.flapLv, sp=m.spds||{}; return [220,Math.max(185,(sp.S||185)),Math.max(165,(sp.F||165)),Math.max(150,(sp.F||150)-10),m.ap.vapp||137][lv]; }

  function tick(dt){
    if(!S.on) return; const m=M(), a=A(), C=m.ctl;
    if(m.crash){ stop(); return; }
    // the student takes over: sidestick in the air, brakes on the ground
    if(!m.gnd&&(Math.abs(C.sx)>0.3||Math.abs(C.sy)>0.3)){ stop(TX.have); return; }
    if(m.gnd&&UI().inp.brk>0.5&&S.ph!=='done'&&S.ph!=='hold'&&S.ph!=='ready'){ stop(TX.have); return; }
    reqTick(dt); S.t+=dt;
    const ra=m.ra/FT, h=m.h/FT, apOn=m.ap.ap1||m.ap.ap2;
    AU.sy=0;
    switch(S.ph){
      case 'taxi':{ if(!both()){ stopGnd(); if((S.msgT-=dt)<0){ say(TX.engines); S.msgT=8; } break; }
        if(a.sw.park) a.sw.park=0;
        const p=S.path[0]; const d=gndSteer(m,p[0],p[1],S.path.length>1?18:12,dt);
        if(d<(S.path.length>1?25:8)){ S.path.shift(); if(!S.path.length){ stopGnd(); set('hold'); } } break; }
      case 'hold': stopGnd(); break;
      case 'lineup':{ const p=S.path[0]; const d=gndSteer(m,p[0],p[1],8,dt);
        if(d<(S.path.length>1?14:6)){ S.path.shift(); if(!S.path.length){ stopGnd(); set('ready'); } } break; }
      case 'ready': stopGnd(); break;
      case 'to':{ AU.brk=0; AU.til=0; const hE=w180(m.psi*R2D); AU.rud=clamp(-hE*0.25-m.E*0.04,-1,1);
        if(m.ias>=(m.ap.vr||134)){ AU.sy=m.th<12.5*D2R?0.7:0.15; }
        if(!m.gnd){ AU.rud=0; S.leg=1; set('climb'); }
        AU.gamC=null; AU.phiC=0; break; }
      case 'climb': case 'level': case 'down': case 'base':{
        lateral(m); vertical(m,dt,h,ra); config(m,h,ra); break; }
      case 'final':{ const lat=final(m); vertical(m,dt,h,ra,lat); config(m,h,ra);
        if(ra<35&&!m.gnd) set('flare'); break; }
      case 'flare':{ const fr=clamp((35-ra)/35,0,1); AU.gamC=(-3+2.4*fr)*D2R; AU.phiC=clamp(-m.E*0.0015,-0.05,0.05)-0*m.phi;
        if(ra<20) setTla(0);
        if(m.gnd){ AU.gamC=null; AU.phiC=null; set('roll'); } break; }
      case 'roll':{ const gs=m.gs/KT, hE=w180(m.psi*R2D); AU.sy=-0.35; AU.gamC=m.gnd?null:-1*D2R; AU.phiC=m.gnd?null:0; AU.rud=clamp(-hE*0.25-m.E*0.04,-1,1); AU.til=0;
        setTla(gs>75?-20:0); AU.brk=(a.sw.abrk>0&&m.abActive)?0:gs>25?0.45:0;
        if(gs<25){ AU.rud=0; S.path=[[m.N+80,40],[m.N+160,60]]; set('exit'); } break; }
      case 'exit':{ const p=S.path[0]; const d=gndSteer(m,p[0],p[1],10,dt);
        if(d<12){ S.path.shift(); if(!S.path.length){ stopGnd(); set('done'); say(TX.done); } } break; }
      case 'done': stopGnd(); break;
    }
  }
  /* lateral: the circuit legs, then the localizer */
  function lateral(m){
    if(S.leg===1&&m.h/FT<1000){ AU.phiC=clamp(-w180(m.psi*R2D)*1.6,-10,10)*D2R; return; }
    const pts=[null,P.P1,P.P2,P.P3,P.P4];
    if(S.leg>=1&&S.leg<=4){ const p=pts[S.leg], dN=p[0]*NM-m.N, dE=p[1]*NM-m.E; steerTo(m,brg(dN,dE),25);
      if(Math.hypot(dN,dE)<1.3*NM){ S.leg++; if(S.leg===3) set('down'); if(S.leg===5) set('base'); } return; }
    final(m); }
  function final(m){ const hdgC=w360(-clamp(m.E*0.012,-45,45)); const lim=Math.abs(m.E)<600?12:25; steerTo(m,hdgC,lim); return true; }
  /* vertical and thrust */
  function vertical(m,dt,h,ra){
    const a=A(), lv=a.sw.flapLv;
    if(S.ph==='climb'){
      const red=h>1500, tgt=red?Math.min(250,lv>0?cfgSpd(m)+10:250):(m.ap.v2||139)+10;
      if(!red&&!m.ap.athr){ /* take-off thrust until the reduction altitude */ }
      if(red&&UI().tla[0]>F.TLA.CL+0.5){ setTla(F.TLA.CL); }
      if(S.altT-h<700){ set('level'); return vertical(m,dt,h,ra); }
      if(m.ap.athr) thrust(m,tgt,dt,F.TLA.CL); /* the FCU speed follows; in the climb the A/THR gives climb thrust and the pitch keeps the speed */
      AU.gamC=spdPitch(m,tgt,0.02,15*D2R); return; }
    if(S.ph==='level'){ AU.gamC=altPath(m,S.altT); thrust(m,250,dt,F.TLA.CL); return; }
    if(S.ph==='down'||S.ph==='base'){ const tgt=S.ph==='down'?220:cfgSpd(m), gs=m.nav&&m.nav.gs;
      // the glideslope from below: capture it
      if(S.ph==='base'&&gs&&gs.valid&&gsH(m)<=m.h+15&&Math.abs(m.E)<900){ set('final'); return; }
      let g=altPath(m,3000); if(m.ias>tgt+8&&g<0) g=Math.max(g,-1.5*D2R); AU.gamC=g; thrust(m,tgt,dt,F.TLA.CL); return; }
    if(S.ph==='final'){ const dist=Math.max(1,(F.ILS.gsN-m.N)), e=gsH(m)-m.h; AU.gamC=-GP+clamp(e*0.004,-0.045,0.045);
      thrust(m,cfgSpd(m),dt,F.TLA.CL); }
  }
  function gsH(m){ return Math.max(0,(F.ILS.gsN-m.N))*Math.tan(GP)+F.RWY.elev; }
  /* configuration: PF calls, PM selects */
  function config(m,h,ra){ const a=A(), sw=a.sw, sp=m.spds||{};
    if(S.ph==='climb'||S.ph==='level'){
      if(!m.gnd&&m.vs/F.FPM>300&&ra>30) ask('gearUp','“Positive climb. Gear up.”',()=>sw.gearLv===0,()=>{ sw.gearLv=0; });
      if(h>1500&&sw.flapLv>=2&&m.ias>(sp.F||165)) ask('f1','“Flaps 1.”',()=>sw.flapLv<=1,()=>{ sw.flapLv=1; });
      if(h>1500&&sw.flapLv===1&&m.ias>(sp.S||200)) ask('f0','“Flaps zero.”',()=>sw.flapLv===0,()=>{ sw.flapLv=0; });
    }
    if(S.ph==='down'&&S.leg>=4) ask('af1','“Flaps 1.”',()=>sw.flapLv>=1,()=>{ sw.flapLv=Math.max(1,sw.flapLv); });
    if(S.ph==='base'||S.ph==='final'){ ask('af1','“Flaps 1.”',()=>sw.flapLv>=1,()=>{ sw.flapLv=Math.max(1,sw.flapLv); });
      if(S.reqDone.af1&&m.ias<(sp.S||200)+5) ask('af2','“Flaps 2.”',()=>sw.flapLv>=2,()=>{ sw.flapLv=Math.max(2,sw.flapLv); }); }
    if(S.ph==='final'){
      if(S.reqDone.af2) ask('gear','“Gear down.”',()=>sw.gearLv===1,()=>{ sw.gearLv=1; });
      if(S.reqDone.gear&&m.gearDown) ask('af3','“Flaps 3.”',()=>sw.flapLv>=3,()=>{ sw.flapLv=Math.max(3,sw.flapLv); });
      if(S.reqDone.af3&&(F.ILS.gsN-m.N)<6.5*NM&&!sw.ldgF3) ask('afull','“Flaps full.”',()=>sw.flapLv===4,()=>{ sw.flapLv=4; });
    }
  }
  /* ---------- the student's go-ahead on the ground ---------- */
  function action(k){ const m=M();
    if(k==='line'&&S.ph==='hold'){ S.path=[[-40,0],LINE]; set('lineup'); }
    else if(k==='to'&&S.ph==='ready'){ const lv=A().sw.flapLv; if(lv<1||lv>3){ say(TX.flapsTO); return; }
      if(A().sw.park) A().sw.park=0; setTla(m.flx||(X.K&&X.K.d&&X.K.d.flex)?F.TLA.MCT:F.TLA.TOGA); S.reqDone={}; set('to'); sayS('“Take-off.”'); } }
  /* ---------- the banner text ---------- */
  function status(){ if(!S.on) return null; const m=M(), apOn=m.ap.ap1||m.ap.ap2;
    let t=L(TX[S.ph]||TX.title); if(S.ph==='level') t+=' '+S.altT.toLocaleString('en')+' ft';
    if(S.ph==='climb') t+=' to '+S.altT.toLocaleString('en')+' ft';
    const btn=S.ph==='hold'?['line',L(TX.bLine)]:S.ph==='ready'?['to',L(TX.bTo)]:null;
    return {t,req:S.req?S.req.text:'',btn,ap:apOn&&!m.gnd?L(TX.apNote):''}; }
  return {get on(){ return S.on; },start,stop:()=>stop(),toggle(){ if(S.on) stop(); else start(); },tick,action,status,get phase(){ return S.ph; },reset(){ if(S.on) stop(); },TX};
}
G.A320AUTO={create};
})(window);
