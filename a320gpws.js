/* NORDAP – A320 GPWS, reactive windshear and TCAS for the cockpit trainer (a320.html, a320-3d.html).
   Built for practising the escape manoeuvres of the APS "GPWS and WS handling" guide: the warnings come when the aircraft
   would give them, with the aural, the PFD message and the glareshield light; the crew flies the escape.
   - GPWS (needs GPWS SYS on and DC power), simplified envelopes of the basic modes:
     1 excessive descent rate: SINK RATE, then PULL UP; 3 altitude loss after take-off: DON'T SINK;
     4 unsafe clearance: TOO LOW GEAR, TOO LOW FLAPS (FLAP MODE off or LDG FLAP 3 adjust it); 5 below the glideslope: GLIDESLOPE
     (G/S MODE off or the glareshield GPWS G/S pushbutton cancel it). PULL UP: red on the PFD and the glareshield light.
   - Reactive windshear (scenario from the Failures tab): a microburst below 1,000 ft on the approach or after take-off. The
     detection works on the energy loss (F-factor) from lift-off to 1,300 ft and from 1,300 ft to 50 ft with slats out: WINDSHEAR
     red on both PFDs and the aural three times.
   - TCAS (scenario): an intruder head-on at about the same level. With TCAS in TA or TA/RA: traffic on the ND (open diamond,
     filled when proximate, amber circle for a TA, red square for an RA, relative altitude and arrow), TRAFFIC TRAFFIC, and in
     TA/RA the resolution advisory: CLIMB or DESCEND with red and green sectors on the V/S scale, CLEAR OF CONFLICT.
   These are training approximations, not certified envelopes. */
(function(G){
'use strict';
const F=G.A320FM, FT=F.FT, FPM=F.FPM, KT=F.KT, NM=F.NM, D2R=F.D2R, R2D=F.R2D, clamp=F.clamp, w180=F.w180;
function create(X,o){
  const S={gp:'',gpT:0,pull:false,gpLt:'',said:{},lastSay:0,ws:false,wsT:0,wsSaid:0,mb:null,mbT:0,toMinH:null,tcas:null,ra:null,ta:false,clr:0,raPrev:null,raT:0};
  const A=()=>X.A, M=()=>X.M;
  function say(t,k,gap){ const now=performance.now()/1000; if(S.said[k]&&now-S.said[k]<(gap||2.5)) return; S.said[k]=now; o.say(t); }
  /* ---------- GPWS ---------- */
  function gpws(dt){
    const a=A(), m=M(), sw=a.sw, ra=m.ra/FT, vs=m.vs/FPM, ias=m.ias;
    S.gp=''; S.pull=false; S.gpLt='';
    if(!sw.gpwsS||!a.dc||m.gnd||ra>2450||ra<10) { S.wasGnd=m.gnd; if(m.gnd){ S.toMinH=null; S.gsInh=false; } return; }
    // mode 1
    if(-vs>1500+2.2*ra){ S.pull=true; S.gp='PULL UP'; }
    else if(-vs>1000+1.6*ra) S.gp='SINK RATE';
    // mode 3: altitude loss after take-off (until 1,500 ft or gear and flaps in the landing configuration)
    if(S.wasGnd&&!m.gnd) S.afterTO=true; S.wasGnd=m.gnd; if(ra>1500||(m.gearDown&&sw.flapLv>=3&&!S.climbOut)) S.afterTO=false; S.climbOut=S.afterTO&&vs>0;
    const toPh=!!S.afterTO;
    if(toPh){ const h=m.h/FT; S.toMinH=S.toMinH==null?h:Math.max(S.toMinH,h); const loss=S.toMinH-h; if(!S.gp&&ra<1500&&loss>Math.max(20,ra*0.1)) S.gp="DON'T SINK"; }
    else S.toMinH=null;
    // mode 4
    const ldgFlaps=sw.flapLv===4||(sw.ldgF3&&sw.flapLv>=3);
    if(!S.gp&&!toPh&&ra<500&&ias<190&&!m.gearDown) S.gp='TOO LOW GEAR';
    else if(!S.gp&&!toPh&&sw.gpwsF&&ra<245&&ias<159&&m.gearDown&&!ldgFlaps) S.gp='TOO LOW FLAPS';
    // mode 5
    const gs=m.nav&&m.nav.gs;
    if(ra>1000||!m.gearDown) S.gsInh=false;
    if(!S.gp&&sw.gpwsGs&&!S.gsInh&&m.gearDown&&ra<1000&&ra>30&&gs&&gs.valid&&gs.dev<-1.3) S.gp='GLIDESLOPE';
    if(S.gp){ S.gpLt=S.pull?'pull':'gpws'; say(S.gp==='PULL UP'?'pull up':S.gp.toLowerCase(),'gp',S.pull?1.2:2.2); }
  }
  /* ---------- windshear ---------- */
  function windshear(dt){
    const a=A(), m=M(), ra=m.ra/FT;
    if(a.fail.ws&&!S.mb&&!m.gnd&&ra<1000&&ra>150&&a.sw.flapLv>=1){ S.mb={t:0,base:{dir:m.wind.dir,spd:m.wind.spd},hdg:m.chi}; }
    let w=0, dHw=0;
    if(S.mb){ const mb=S.mb; mb.t+=dt; const t=mb.t;
      // 0–8 s: increasing headwind (+20 kt); 8–22 s: downdraft up to 1,500 ft/min and the wind swinging to a 25 kt tailwind; then out
      const hw=t<8?20*t/8:t<22?20-45*(t-8)/14:t<34?-25+25*(t-22)/12:0; const dn=t<6?0:t<12?(t-6)/6:t<20?1:t<26?(26-t)/6:0;
      dHw=(hw-(mb.hw||0)); mb.hw=hw; w=dn*1500;
      const into=mb.hdg*R2D+180; m.wind.dir=(into+360)%360; m.wind.spd=Math.max(0,hw);
      if(hw<0){ m.wind.dir=(mb.hdg*R2D+360)%360; m.wind.spd=-hw; }
      m.tas=Math.max(30*KT,m.tas+dHw*KT); m.h-=w*FPM*dt;
      if(t>36){ m.wind.dir=mb.base.dir; m.wind.spd=mb.base.spd; S.mb=null; a.fail.ws=false; } }
    // reactive detection: F-factor from the airspeed loss and the downdraft
    const v=Math.max(60,m.tas/KT), Fx=-(dHw/Math.max(dt,1e-3))*0.514/9.81, Fw=-(-w*FPM)/(v*KT);
    S.ff=(S.ff||0)*0.9+0.1*(Fx+Fw);
    const toWin=a.phase===5&&ra<1300, apWin=!m.gnd&&ra<1300&&ra>50&&a.sw.flapLv>=1;
    if(a.dc&&(toWin||apWin)&&S.ff>0.105){ if(!S.ws){ S.ws=true; S.wsT=0; S.wsSaid=0; } }
    if(S.ws){ S.wsT+=dt; if(S.wsSaid<3&&S.wsT>S.wsSaid*1.3){ S.wsSaid++; o.say('windshear'); } if(S.wsT>15&&S.ff<0.04) S.ws=false; }
  }
  /* ---------- TCAS ---------- */
  function tcas(dt){
    const a=A(), m=M(), sw=a.sw, h=m.h/FT;
    if(a.fail.tcas&&!S.tcas&&!m.gnd){ const tk=m.chi; S.tcas={N:m.N+Math.cos(tk)*9*NM+Math.sin(tk)*0.15*NM,E:m.E+Math.sin(tk)*9*NM-Math.cos(tk)*0.15*NM,h:h+(Math.random()<0.5?200:-200),trk:tk+Math.PI,gs:260*KT,vs:0}; S.ta=false; S.ra=null; S.clr=0; }
    if(!S.tcas){ S.ra=null; return; }
    const I=S.tcas; I.N+=Math.cos(I.trk)*I.gs*dt; I.E+=Math.sin(I.trk)*I.gs*dt; I.h+=I.vs*dt/60;
    const dN=I.N-m.N, dE=I.E-m.E, rng=Math.hypot(dN,dE), vN=Math.cos(I.trk)*I.gs-Math.cos(m.chi)*m.gs, vE=Math.sin(I.trk)*I.gs-Math.sin(m.chi)*m.gs, rr=(dN*vN+dE*vE)/Math.max(1,rng), tau=rr<0?rng/-rr:1e9, dh=I.h-h, vtau=Math.abs(dh)/Math.max(1,Math.abs(I.vs-m.vs/FPM)/60);
    const mode=a.dc?sw.tcas:0; // 0 STBY, 1 TA, 2 TA/RA
    I.rel=Math.round(dh/100); I.dist=rng;
    I.type=rng<6*NM&&Math.abs(dh)<1200?'prox':'other';
    if(mode&&tau<40&&Math.abs(dh)<850) { I.type='ta'; if(!S.ta){ S.ta=true; o.say('traffic, traffic'); } }
    if(mode===2&&tau<25&&Math.abs(dh)<600&&!S.ra&&!S.clr){ const up=dh<0; S.ra={sense:up?'CLIMB':'DESCEND',lo:up?1500:-6000,hi:up?6000:-1500}; o.say(up?'climb, climb':'descend, descend'); }
    if(S.ra){ I.type='ra'; if(rr>0&&rng>1.2*NM){ S.ra=null; S.clr=1; o.say('clear of conflict'); } }
    if(rr>0&&rng>10*NM){ S.tcas=null; S.ta=false; S.ra=null; a.fail.tcas=false; }
    if(!mode){ S.ra=null; }
  }
  return {
    tick(dt){ if(!X.A||!X.M) return; gpws(dt); windshear(dt); tcas(dt); },
    pfdMsg(){ if(S.ws) return ['WINDSHEAR','r']; if(S.pull) return ['PULL UP','r']; return null; },
    light(){ return S.gpLt; },
    gsCancel(){ S.gsInh=true; },
    traffic(){ const I=S.tcas, a=A(); if(!I||!a.dc||!a.sw.tcas) return null; return [{N:I.N,E:I.E,rel:I.rel,vs:I.vs,type:I.type}]; },
    ra(){ return S.ra; },
    reset(){ S.mb=null; S.tcas=null; S.ra=null; S.ws=false; S.ta=false; S.clr=0; }
  };
}
G.A320GPWS={create};
})(window);
