/* NORDAP – Airbus A320 cockpit procedure trainer: page logic (a320.html).
   Performance design: the panel is one picture moved by one CSS transform (written only when the view changes); the screens are
   canvases redrawn at their own rate and only when on screen (PFD / ND 30 Hz, E/WD and SD 12 Hz, ISIS 15 Hz, MCDU and FCU on
   change); lit legends are text whose class changes only when a light changes; the outside view (otw.js, shared with the other
   sims) is drawn only in the panel view, at most every frame and less when the frame budget is tight. The systems run at 20 Hz,
   the flight model at 60 Hz in fixed steps. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const LB=window.LAB||{}, T=s=>LB.T?LB.T(s):s;
if(LB.add) LB.add({},{'NORDAP · Simulators':'NORDAP · Simulatorer','Airbus A320 cockpit procedure trainer':'Airbus A320 prosedyretrener for cockpit','Overhead':'Takpanel','Panel':'Panel','Pedestal':'Pedestal',
  'Cockpit':'Cockpit','Flight controls':'Flykontroller','How it works':'Slik virker det','Sidestick':'Sidestikke','Thrust levers':'Gasshendler','Hold for brakes':'Hold for bremser',
  'Fast ADIRS alignment':'Rask ADIRS-oppretting','On ground':'På bakken','Flying':'Flyr','Paused':'Pause','Crashed':'Havarert','Cold and dark':'Kald og mørk','Ready for take-off':'Klar for avgang'});
const D3=document.body.hasAttribute('data-d3');
const F=A320FM, Y=A320SYS, DSP=A320DISP, MC=A320MCDU, SH=window.SIMSHELL;
const KT=F.KT, FT=F.FT, FPM=F.FPM, NM=F.NM, D2R=F.D2R, R2D=F.R2D, clamp=F.clamp, w360=F.w360, w180=F.w180;
const RECT={}; (window.A320T||[]).forEach(t=>RECT[t[0]]=t);
RECT['FCU|ALT KNOB']=['FCU|ALT KNOB',520.5,838.5,12.5,12.5];
const SHEET={W:1000,H:1678};
const FIX=(window.AIRPROC&&AIRPROC.FIX)||{RW36:{N:0,E:0},FAPSO:{N:-5*NM,E:0},RONAX:{N:-10*NM,E:0},ALPOR:{N:-10*NM,E:-5*NM},BIKAN:{N:-10*NM,E:5*NM},HOLAN:{N:9*NM,E:0},TUSKA:{N:-22*NM,E:-8*NM},OSVIK:{N:18*NM,E:-14*NM},ASN:{N:900,E:-2600},AN:{N:-7600,E:0}};
Object.keys(FIX).forEach(k=>FIX[k].id=k);

/* ================= state ================= */
let A,M,K; const UI={paused:false,sound:true,start:'cold',t:0,crashed:false,fastAlign:false,ls:[false,false],fd:[true,true],efis:{mode:3,range:2,filt:'wpt',qnh:1013,std:false,adf1:0,adf2:0},efis2:{mode:3,range:2,filt:'wpt',qnh:1013,std:false},
  annTest:false,inp:{keys:new Set(),sx:0,sy:0,pad:null,rud:0,brk:0,tiller:0,stick:null},tla:[0,0],mcduChg:0,fcuKey:''};
UI.start='air'; try{ UI.start=localStorage.getItem('bb-a320-start2')||'air'; }catch(e){}
const qp=new URLSearchParams(location.search); if(qp.get('start')) UI.start=qp.get('start');
const RANGES=[10,20,40,80,160,320], MODES=['ROSE ILS','ROSE VOR','ROSE NAV','ARC','PLAN'];

function reset(kind){
  UI.start=kind; try{ localStorage.setItem('bb-a320-start2',kind); }catch(e){}
  if(kind==='cold'){
    A=Y.create({cold:true,gpu:true}); M=F.create({N:820,E:215}); M.psi=M.chi=270*D2R;
  } else if(kind==='ready'){
    A=Y.create({cold:false}); M=F.create({N:25,E:0}); M.psi=M.chi=0;
    Object.assign(A.sw,{park:1,flapLv:1,spArm:1,abrk:3,strobe:2,beacon:1,navLogo:1,landL:2,landR:2,nose:2,rto:1,seatB:2,noSmk:2,engMode:1,pk1:1,pk2:1,xpdrMd:2,tcas:1});
    A.ecam.cabinReady=true;
  } else if(kind==='air'){
    A=Y.create({cold:false}); M=F.create({air:true,h:5000*FT,ias:250,hdg:360}); M.N=-22*NM; M.E=0;
    Object.assign(A.sw,{park:0,flapLv:0,spArm:0,abrk:0,strobe:2,beacon:1,navLogo:1,landL:1,landR:1,nose:0,seatB:2,noSmk:1,gearLv:0,xpdrMd:1,tcas:2});
    A.phase=6; A.ecam.cabinReady=true;
  } else {
    A=Y.create({cold:false}); M=F.create({air:true,h:3000*FT,ias:180,hdg:360}); M.N=-12*NM; M.E=0;
    Object.assign(A.sw,{park:0,flapLv:1,spArm:0,abrk:0,strobe:2,beacon:1,navLogo:1,landL:2,landR:2,nose:1,seatB:2,noSmk:2,gearLv:0});
    A.phase=6; A.ecam.cabinReady=true;
  }
  A.alignT=420; A.alignK=UI.fastAlign?20:1; A.env={t:15,elev:0};
  const airb=kind==='appr'||kind==='air';
  A.fuel=Object.assign(A.fuel,{lo:690,li:2950,ri:2950,ro:690,c:airb?0:1500}); A.zfw=airb?55000:56500;
  K=MC.create(FIX);
  if(kind!=='cold'){ Object.assign(K.d,{from:'ENRD',to:'ENRD',fltNbr:'NRD320',ci:30,crzFl:100,zfw:A.zfw,zfwcg:28,block:A.fuel.lo+A.fuel.li+A.fuel.ri+A.fuel.ro+A.fuel.c,flaps:1,ths:'UP0.4',v1:131,vr:134,v2:139,flex:null,qnh:1013,temp:15,wind:'360/05',dh:200,ldgConf:'FULL'}); K.fpln=MC.build(K); K.act=kind==='appr'?K.fpln.findIndex(p=>p.id==='FAPSO'):1; }
  if(kind==='air'){ K.act=K.fpln.findIndex(p=>p.id==='RONAX'); }
  M.lnavFn=m=>MC.lnav(K,m);
  const ap=M.ap; ap.fd1=ap.fd2=kind!=='cold'; UI.fd=[ap.fd1,ap.fd2];
  ap.alt.v=kind==='appr'?3000:5000; ap.hdg.v=kind==='cold'?270:360;
  if(kind!=='cold'){ ap.v1=K.d.v1; ap.vr=K.d.vr; ap.v2=K.d.v2; ap.thrRed=K.d.thrRed; ap.acc=K.d.acc; UI.ls=[kind==='appr',kind==='appr']; }
  if(kind==='air'){ ap.ap1=true; ap.athr=true; ap.vert='ALT'; ap.altHold=5000; ap.lat='HDG'; ap.hdg.v=360; ap.vapp=137; UI.tla=[25,25]; ap.clbPh=false; }
  if(kind==='appr'){ ap.ap1=true; ap.athr=true; ap.vert='ALT'; ap.altHold=3000; ap.lat='HDG'; ap.hdg.v=360; ap.vapp=137; UI.tla=[25,25]; UI.efis.mode=0; UI.efis.range=1; }
  else UI.tla=[0,0];
  UI.efis.qnh=1013; UI.efis.std=false; UI.crashed=false; UI.paused=false; UI.t=0; UI.fmaPrev={}; UI.fmaT={};
  M.nav=F.navCalc(M); M.spds=F.speeds(M); M.ap.tgtSpd=M.ias;
  syncCtl(); for(let i=0;i<20;i++) sysStep(0.05);
  if(kind==='ready'){ A.eng.forEach(e=>{ e.availT=99; }); A.ecam.t2=200; }
  dirty.all=true; say(kind==='cold'?'Cold and dark on the apron. Ground power is plugged in.':kind==='ready'?'Lined up on runway 36. Parking brake set.':kind==='air'?'5,000 ft, 250 kt, AP 1 and A/THR on, heading 360 towards NORDAP.':'Established 12 NM from runway 36, 3,000 ft. Press APPR on the FCU.');
}
const dirty={all:true};

/* ================= simulation ================= */
function airOf(){ return {gnd:M.gnd,ias:M.ias,gs:M.gs/KT,alt:M.h/FT,ra:M.ra/FT,vs:M.vs/FPM,sig:F.isa(M.h).sig,mach:M.mach}; }
const fmView={n1Cmd:[19.6,19.6],tla:[0,0],slat:0,flapLv:0,ths:0,gearDown:true,gearUp:false,toPower:false,sideAny:0};
function sysStep(dt){
  Object.assign(fmView,{n1Cmd:M.n1Cmd,tla:M.tla,slat:M.slat,flapLv:A.sw.flapLv,ths:M.ths||0,gearDown:M.gearDown,gearUp:M.gearUp,toPower:M.toPower,sideAny:M.sideAny||0,apOffWarn:UI.apOffT>0,athrOffCaut:UI.athrOffT>0,overspeed:M.overspeed,tcasStby:!A.sw.tcas});
  Y.step(A,dt,airOf(),fmView);
  if(UI.apOffT>0) UI.apOffT-=dt; if(UI.athrOffT>0) UI.athrOffT-=dt;
}
function syncCtl(){
  const S=A.sw, C=M.ctl, I=UI.inp;
  C.park=S.park; C.flapLv=S.flapLv; C.gearLv=S.gearLv; C.spd=S.spdBrk; C.spArm=S.spArm; C.abrk=S.abrk;
  C.tla=[UI.tla[0],UI.tla[1]];
  let sx=I.sx, sy=I.sy; if(I.stick){ sx=I.stick.x; sy=I.stick.y; } if(I.gp){ if(Math.abs(I.gp.x)>Math.abs(sx)) sx=I.gp.x; if(Math.abs(I.gp.y)>Math.abs(sy)) sy=I.gp.y; }
  C.sx=sx; C.sy=sy; C.rud=I.rud; C.tiller=I.rud*0.6+I.tiller; C.brkL=C.brkR=I.brk;
  M.gw=A.gw;
}
let acc=0, sysAcc=0;
function simTick(dt){
  if(UI.paused||UI.crashed) return;
  keysStep(dt); gamepad();
  acc+=dt; const h=1/60; let n=0;
  while(acc>=h&&n<6){ syncCtl(); F.step(M,h,A); sysAcc+=h; if(sysAcc>=0.05){ sysStep(sysAcc); sysAcc=0; } acc-=h; n++; }
  if(acc>h*6) acc=0;
  UI.t+=dt;
  events();
  if(M.crash&&!UI.crashed){ UI.crashed=true; say(T('Crashed')+': '+M.crash,'bad',8000); setStat(); }
}
function events(){
  for(const e of M.events){
    if(e==='apdisc-forced'||e==='apdisc'){ UI.apOffT=e==='apdisc'?3:9; snd('cav'); }
    if(e==='apinst'){ UI.apOffT=1.5; snd('cav'); }
    if(e==='athrdisc'){ UI.athrOffT=9; snd('chime'); }
    if(e==='athrinst'){ UI.athrOffT=2; snd('chime'); }
    if(e==='tailstrike') say('Tail strike','bad',4000);
    if(e==='touchdown'&&M.touch) say('Touchdown '+Math.round(M.touch.vs)+' ft/min','ok',4000);
    if(e==='afloor') say('A.FLOOR: alpha floor, TOGA thrust','bad',3000);
  }
  M.events.length=0;
  for(const e of A.events){ if(e.k==='warn') UI.crcOn=true; if(e.k==='caut') snd('chime'); }
  A.events.length=0;
  if(UI.crcOn&&!A.ecam.crc) UI.crcOn=false;
}

/* ================= input ================= */
const KEYS=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','KeyB','Equal','Minus','NumpadAdd','NumpadSubtract','KeyR']);
function typing(e){ const t=e.target; return t&&(t.tagName==='INPUT'||t.tagName==='SELECT'||t.tagName==='TEXTAREA'||t.isContentEditable); }
window.addEventListener('keydown',e=>{
  if(!AC) ctx();
  if(typing(e)||e.ctrlKey||e.metaKey||e.altKey) return;
  if(!cockpitVis) return;
  const c=e.code, I=UI.inp;
  if(KEYS.has(c)){ I.keys.add(c); e.preventDefault(); if(c==='KeyR'&&M.gnd) UI.tla=UI.tla.map(()=>-20); return; }
  const lv=v=>{ UI.tla=[v,v]; e.preventDefault(); };
  switch(c){
    case 'KeyT': lv(45); break; case 'KeyY': lv(35); break; case 'KeyU': lv(25); break; case 'KeyI': lv(0); break;
    case 'KeyF': A.sw.flapLv=Math.min(4,A.sw.flapLv+1); flapSay(); break; case 'KeyV': A.sw.flapLv=Math.max(0,A.sw.flapLv-1); flapSay(); break;
    case 'KeyG': A.sw.gearLv=A.sw.gearLv?0:1; say('Gear '+(A.sw.gearLv?'down':'up')); break;
    case 'KeyK': A.sw.spdBrk=Math.min(1,+(A.sw.spdBrk+0.25).toFixed(2)); A.sw.spArm=0; break; case 'KeyJ': A.sw.spdBrk=Math.max(0,+(A.sw.spdBrk-0.25).toFixed(2)); break;
    case 'KeyL': A.sw.spArm=A.sw.spArm?0:1; if(A.sw.spArm) A.sw.spdBrk=0; say('Ground spoilers '+(A.sw.spArm?'armed':'disarmed')); break;
    case 'Space': F.fcu(M,'instDisc'); e.preventDefault(); break;
    case 'KeyZ': F.fcu(M,'athrInst'); break;
    case 'KeyP': pause(); break;
    case 'Digit1': view('ovhd'); break; case 'Digit2': view('main'); break; case 'Digit3': view('ped'); break; case 'Digit4': view('fcu'); break; case 'Digit5': view('ecam'); break; case 'Digit6': view('mcdu'); break;
    case 'Escape': view('main'); break;
    default: return;
  }
  dirty.all=true;
});
window.addEventListener('keyup',e=>{ UI.inp.keys.delete(e.code); if(e.code==='KeyR'&&M&&UI.tla[0]<0) UI.tla=[0,0]; });
window.addEventListener('blur',()=>UI.inp.keys.clear());
function flapSay(){ say('Flaps lever '+['0','1','2','3','FULL'][A.sw.flapLv]); }
function keysStep(dt){
  const I=UI.inp, k=I.keys, sh=k.has('ShiftLeft')||k.has('ShiftRight');
  const ax=(neg,pos,v,rate)=>{ const want=(k.has(pos[0])||k.has(pos[1])?1:0)-(k.has(neg[0])||k.has(neg[1])?1:0); if(want) return clamp(v+want*rate*dt,-1,1); return Math.abs(v)<0.04?0:v-Math.sign(v)*Math.min(Math.abs(v),4*dt); };
  I.sx=ax(['KeyA','ArrowLeft'],['KeyD','ArrowRight'],I.sx,sh?4:1.6);
  I.sy=ax(['KeyW','ArrowUp'],['KeyS','ArrowDown'],I.sy,sh?4:1.2);
  I.rud=ax(['KeyQ','KeyQ'],['KeyE','KeyE'],I.rud,1.5);
  I.brk=k.has('KeyB')||I.brkHeld?1:0;
  const up=k.has('Equal')||k.has('NumpadAdd'), dn=k.has('Minus')||k.has('NumpadSubtract');
  if(up||dn){ const r=(up?1:-1)*14*dt; UI.tla=UI.tla.map(v=>{ let n=clamp(v+r,M.gnd?-20:0,45); for(const d of [0,25,35,45]){ if((v<d&&n>=d)||(v>d&&n<=d)){ if(!UI.detentHold||UI.detentHold<0.25){ n=d; } } } return n; }); }
}
function gamepad(){ const gps=navigator.getGamepads?navigator.getGamepads():[]; const g=gps&&[...gps].find(x=>x&&x.connected); if(!g){ UI.inp.gp=null; return; }
  const dz=v=>Math.abs(v)<0.08?0:v; UI.inp.gp={x:dz(g.axes[0]||0),y:dz(g.axes[1]||0)}; }

/* ================= sound ================= */
let AC=null;
function ctx(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function tone(f,t0,d,v,type){ const a=ctx(); if(!a) return; const o=a.createOscillator(), g=a.createGain(); o.type=type||'sine'; o.frequency.value=f; g.gain.setValueAtTime(0,a.currentTime+t0); g.gain.linearRampToValueAtTime(v,a.currentTime+t0+0.01); g.gain.exponentialRampToValueAtTime(0.0008,a.currentTime+t0+d); o.connect(g); g.connect(a.destination); o.start(a.currentTime+t0); o.stop(a.currentTime+t0+d+0.05); }
function snd(k){ if(!UI.sound||!AC) return;
  if(k==='chime'){ tone(1100,0,0.9,0.09); tone(1650,0,0.9,0.04); }
  if(k==='crc'){ tone(950,0,0.18,0.08,'triangle'); tone(1300,0,0.18,0.05,'triangle'); }
  if(k==='cav'){ [784,659,523,659,523,392].forEach((f,i)=>tone(f,i*0.11,0.16,0.06,'square')); }
  if(k==='click'){ tone(2400,0,0.025,0.03,'square'); } }
let crcT=0;
function soundTick(dt){ if(!UI.sound||UI.paused) return; if(A.ecam.crc){ crcT-=dt; if(crcT<=0){ snd('crc'); crcT=0.45; } } }

/* ================= panel controls ================= */
/* light colours: a amber, w white, b blue, g green, r red */
const S_=k=>A.sw[k], lp=(v)=>v<1450;
const CT=[];
function pb(id,k,up,dn,o){ CT.push(Object.assign({id,t:'pb',k,up,dn},o||{})); }
function mom(id,k,up,dn,o){ CT.push(Object.assign({id,t:'mom',k,up,dn},o||{})); }
function ann(id,up,dn,o){ CT.push(Object.assign({id,t:'ann',up,dn},o||{})); }
function sel(id,k,pos,ang,o){ CT.push(Object.assign({id,t:'sel',k,pos,ang},o||{})); }
function tog(id,k,vals,o){ CT.push(Object.assign({id,t:'tog',k,vals},o||{})); }
function bar(id,lit,on,o){ CT.push(Object.assign({id,t:'bar',lit,on},o||{})); }
function act(id,on,o){ CT.push(Object.assign({id,t:'act',on},o||{})); }
function defs(){
  const e=A=>A; // (readability)
  // ---- ADIRS ----
  for(const n of [1,2,3]){
    pb('ADIRS|IR '+n,'ir'+n,['FAULT','a',()=>A.irs[n-1].st===4||(A.irs[n-1].st===1&&(UI.t%2<1)&&false)],['OFF','w',()=>!S_('ir'+n)]);
    pb('ADIRS|ADR '+n,'adr'+n,['FAULT','a',()=>false],['OFF','w',()=>!S_('adr'+n)]);
    sel('ADIRS|IR MODE '+n,'irM'+n,['OFF','NAV','ATT'],[-55,0,55]); }
  ann('ADIRS|ON BAT',null,['ON BAT','a',()=>A.irs.some(r=>r.st===1&&r.onBat)||(!A.ac&&A.irs.some(r=>r.st>0))]);
  // ---- FIRE ----
  for(const n of [1,2]){
    pb('FIRE|ENG '+n+' FIRE','fireP'+n,null,['FIRE','r',()=>A.fire.e[n-1]],{cls:'fire big',guard:true});
    mom('FIRE|ENG '+n+' AGENT 1','ag'+n+'1',['SQUIB','w',()=>S_('fireP'+n)&&!S_('ag'+n+'1')],['DISCH','a',()=>!!S_('ag'+n+'1')],{latch:true});
    mom('FIRE|ENG '+n+' AGENT 2','ag'+n+'2',['SQUIB','w',()=>S_('fireP'+n)&&!S_('ag'+n+'2')],['DISCH','a',()=>!!S_('ag'+n+'2')],{latch:true});
    mom('FIRE|ENG '+n+' FIRE TEST','fireT'+n,null,null); }
  pb('FIRE|APU FIRE','fireA',null,['FIRE','r',()=>A.fire.a],{cls:'fire big',guard:true});
  mom('FIRE|APU AGENT','agA',['SQUIB','w',()=>S_('fireA')&&!S_('agA')],['DISCH','a',()=>!!S_('agA')],{latch:true});
  mom('FIRE|APU FIRE TEST','fireTA',null,null);
  // ---- HYD ----
  pb('HYD|ENG 1 PUMP','hyE1',['FAULT','a',()=>S_('hyE1')&&A.eng[0].run&&!A.hyd.edp[0]],['OFF','w',()=>!S_('hyE1')]);
  pb('HYD|ENG 2 PUMP','hyE2',['FAULT','a',()=>S_('hyE2')&&A.eng[1].run&&!A.hyd.edp[1]],['OFF','w',()=>!S_('hyE2')]);
  pb('HYD|BLUE ELEC PUMP','hyB',['FAULT','a',()=>S_('hyB')&&(A.eng[0].run||A.eng[1].run)&&!A.hyd.bluePump],['OFF','w',()=>!S_('hyB')]);
  pb('HYD|PTU','ptu',['FAULT','a',()=>false],['OFF','w',()=>!S_('ptu')]);
  pb('HYD|YELLOW ELEC PUMP','hyY',['FAULT','a',()=>S_('hyY')&&!A.hyd.yPump],['ON','b',()=>!!S_('hyY')]);
  mom('HYD|RAT MAN ON','ratMan',null,null,{down:()=>{ if(!A.hyd.rat){ A.hyd.rat=true; A.emer.rat=true; A.emer.t=0; say('RAT deployed'); } },guard:true});
  // ---- FUEL ----
  for(const [id,k,ac] of [['L TK PUMP 1','fL1','ac1'],['L TK PUMP 2','fL2','ac2'],['R TK PUMP 1','fR1','ac1'],['R TK PUMP 2','fR2','ac2']])
    pb('FUEL|'+id,k,['FAULT','a',()=>S_(k)&&A.dc&&!A.bus[ac]&&(A.eng[0].run||A.eng[1].run)],['OFF','w',()=>!S_(k)]);
  for(const [id,k] of [['CTR TK PUMP 1','fC1'],['CTR TK PUMP 2','fC2']]) pb('FUEL|'+id,k,['FAULT','a',()=>S_(k)&&S_('fMode')===0&&A.fuel.c<=0&&false],['OFF','w',()=>!S_(k)]);
  pb('FUEL|MODE SEL','fMode',['FAULT','a',()=>A.ecam.ids&&A.ecam.ids.autofeed],['MAN','w',()=>!S_('fMode')]);
  pb('FUEL|X FEED','fX',['OPEN','g',()=>S_('fX')&&A.bus.dcEss],['ON','w',()=>!!S_('fX')]);
  // ---- FLT CTL ----
  for(const [id,k,i,arr] of [['FLT CTL 1|ELAC 1','elac1',0,'elac'],['FLT CTL 2|ELAC 2','elac2',1,'elac'],['FLT CTL 1|SEC 1','sec1',0,'sec'],['FLT CTL 2|SEC 2','sec2',1,'sec'],['FLT CTL 2|SEC 3','sec3',2,'sec'],['FLT CTL 1|FAC 1','fac1',0,'fac'],['FLT CTL 2|FAC 2','fac2',1,'fac']])
    pb(id,k,['FAULT','a',()=>S_(k)&&A.dc&&!A[arr][i]],['OFF','w',()=>!S_(k)]);
  // ---- ELEC ----
  pb('ELEC|BAT 1','bat1',['FAULT','a',()=>false],['OFF','w',()=>!S_('bat1')]);
  pb('ELEC|BAT 2','bat2',['FAULT','a',()=>false],['OFF','w',()=>!S_('bat2')]);
  CT.push({id:'ELEC|BAT 1 VOLT',t:'seg',txt:()=>A.batV[0]>5&&(A.sw.bat1||true)?A.batV[0].toFixed(1):''});
  CT.push({id:'ELEC|BAT 2 VOLT',t:'seg',txt:()=>A.batV[1]>5?A.batV[1].toFixed(1):''});
  pb('ELEC|GEN 1','gen1',['FAULT','a',()=>S_('gen1')&&A.eng[0].run&&!A.genAv[0]],['OFF','w',()=>!S_('gen1')]);
  pb('ELEC|GEN 2','gen2',['FAULT','a',()=>S_('gen2')&&A.eng[1].run&&!A.genAv[1]],['OFF','w',()=>!S_('gen2')]);
  pb('ELEC|APU GEN','apuGen',['FAULT','a',()=>S_('apuGen')&&A.apu.avail&&!A.apuAv],['OFF','w',()=>!S_('apuGen')]);
  pb('ELEC|EXT PWR','ext',['AVAIL','g',()=>A.gpu&&!A.extOn],['ON','b',()=>A.extOn]);
  pb('ELEC|BUS TIE','busTie',null,['OFF','w',()=>!S_('busTie')]);
  pb('ELEC|AC ESS FEED','acEss',['FAULT','a',()=>A.ac&&!A.bus.acEss],['ALTN','w',()=>!!S_('acEss')]);
  pb('ELEC|GALY & CAB','galy',['FAULT','a',()=>false],['OFF','w',()=>!S_('galy')]);
  pb('ELEC|COMMERCIAL','comm',null,['OFF','w',()=>!S_('comm')]);
  pb('ELEC|IDG 1','idg1',['FAULT','a',()=>A.idgOK[0]&&A.fail.idg1&&A.eng[0].run],null,{guard:true,once:true});
  pb('ELEC|IDG 2','idg2',['FAULT','a',()=>false],null,{guard:true,once:true});
  ann('EMER ELEC PWR|RAT & EMER GEN',['FAULT','r',()=>!A.bus.ac1&&!A.bus.ac2&&!A.emer.emerGen&&A.dc&&!M.gnd],null);
  mom('EMER ELEC PWR|EMER GEN MAN ON','emerMan',null,null,{guard:true,latch:true});
  pb('EMER ELEC PWR|GEN 1 LINE','genLine',['SMOKE','a',()=>false],['OFF','w',()=>S_('genLine')===0]);
  // ---- GPWS ----
  for(const [id,k] of [['GPWS|TERR','gpwsT'],['GPWS|GPWS SYS','gpwsS'],['GPWS|G/S MODE','gpwsGs'],['GPWS|FLAP MODE','gpwsF']]) pb(id,k,['FAULT','a',()=>false],['OFF','w',()=>!S_(k)]);
  pb('GPWS|LDG FLAP 3','ldgF3',null,['ON','b',()=>!!S_('ldgF3')]);
  // ---- AIR COND ----
  sel('AIR COND|PACK FLOW','pkFlow',['LO','NORM','HI'],[-55,0,55]);
  for(const [id,k] of [['AIR COND|TEMP CKPT','tCk'],['AIR COND|TEMP FWD CAB','tFwd'],['AIR COND|TEMP AFT CAB','tAft']]) CT.push({id,t:'cont',k,lo:0,hi:1,step:0.1,ang:v=>-135+v*270});
  pb('AIR COND|HOT AIR','hotAir',['FAULT','a',()=>false],['OFF','w',()=>!S_('hotAir')]);
  pb('AIR COND|PACK 1','pk1',['FAULT','a',()=>(S_('pk1')&&A.fail.pack1)||(S_('pk1')&&A.air.pk1<0.1&&A.eng[0].run&&!A.eng.some(x=>x.st>0&&x.st<4))],['OFF','w',()=>!S_('pk1')]);
  pb('AIR COND|PACK 2','pk2',['FAULT','a',()=>(S_('pk2')&&A.fail.pack2)||(S_('pk2')&&A.air.pk2<0.1&&A.eng[1].run&&!A.eng.some(x=>x.st>0&&x.st<4))],['OFF','w',()=>!S_('pk2')]);
  pb('AIR COND|ENG 1 BLEED','eb1',['FAULT','a',()=>S_('eb1')&&A.fail.bleed1&&A.eng[0].run],['OFF','w',()=>!S_('eb1')]);
  pb('AIR COND|ENG 2 BLEED','eb2',['FAULT','a',()=>S_('eb2')&&A.fail.bleed2&&A.eng[1].run],['OFF','w',()=>!S_('eb2')]);
  pb('AIR COND|APU BLEED','apuBl',['FAULT','a',()=>false],['ON','b',()=>!!S_('apuBl')]);
  pb('AIR COND|RAM AIR','ram',null,['ON','b',()=>!!S_('ram')],{guard:true});
  sel('AIR COND|X BLEED','xb',['SHUT','AUTO','OPEN'],[-50,0,50]);
  // ---- OXYGEN / VENT / CARGO ----
  pb('OXYGEN|CREW SUPPLY','crewOxy',null,['OFF','w',()=>!S_('crewOxy')]);
  mom('OXYGEN|MASK MAN ON','paxOxy',null,null,{guard:true,latch:true});
  ann('OXYGEN|PASSENGER',['SYS ON','w',()=>!!S_('paxOxy')],null);
  pb('VENTILATION|BLOWER','blower',['FAULT','a',()=>false],['OVRD','w',()=>!S_('blower')]);
  pb('VENTILATION|EXTRACT','extract',['FAULT','a',()=>false],['OVRD','w',()=>!S_('extract')]);
  pb('VENTILATION|CAB FANS','cabFans',null,['OFF','w',()=>!S_('cabFans')]);
  mom('CARGO SMOKE|SMOKE TEST','cgoTest',null,null);
  ann('CARGO SMOKE|FWD SMOKE',['SMOKE','r',()=>!!S_('cgoTest')],null); ann('CARGO SMOKE|AFT SMOKE',['SMOKE','r',()=>!!S_('cgoTest')],null);
  // ---- CABIN PRESS / ENG MAN START / ANTI ICE ----
  pb('CABIN PRESS|PRESS MODE SEL','pressMode',['FAULT','a',()=>false],['MAN','w',()=>!S_('pressMode')],{inv:true});
  pb('CABIN PRESS|DITCHING','ditch',null,['ON','b',()=>!!S_('ditch')],{guard:true});
  sel('CABIN PRESS|LDG ELEV','ldgElev',['AUTO','-2','0','2','4','6','8','10','12','14'],[-140,-100,-70,-40,-10,20,50,80,110,140]);
  pb('ENG MAN START|ENG 1 MAN START','manSt1',null,['ON','b',()=>!!S_('manSt1')]);
  pb('ENG MAN START|ENG 2 MAN START','manSt2',null,['ON','b',()=>!!S_('manSt2')]);
  pb('ANTI ICE|WING A-ICE','wai',['FAULT','a',()=>false],['ON','b',()=>!!S_('wai')]);
  pb('ANTI ICE|ENG 1 A-ICE','eai1',['FAULT','a',()=>false],['ON','b',()=>!!S_('eai1')]);
  pb('ANTI ICE|ENG 2 A-ICE','eai2',['FAULT','a',()=>false],['ON','b',()=>!!S_('eai2')]);
  pb('PROBE/WINDOW HEAT|PROBE/WINDOW HEAT','probe',null,['ON','b',()=>!!S_('probe')]);
  // ---- APU ----
  pb('APU|APU MASTER SW','apuM',['FAULT','a',()=>A.apu.fault],['ON','b',()=>!!S_('apuM')]);
  mom('APU|APU START','apuS',['AVAIL','g',()=>A.apu.avail],['ON','b',()=>A.apu.st===1||A.apu.st===2||(A.apu.pending&&!!S_('apuM'))]);
  // ---- EXT LT / INT LT / SIGNS / WIPERS ----
  tog('EXT LT|STROBE','strobe',[2,1,0],{lab:['ON','AUTO','OFF']}); tog('EXT LT|BEACON','beacon',[1,0],{lab:['ON','OFF']}); tog('EXT LT|WING LT','wing',[1,0],{lab:['ON','OFF']});
  tog('EXT LT|NAV & LOGO','navLogo',[2,1,0],{lab:['2','1','OFF'],horiz:true}); tog('EXT LT|RWY TURN OFF','rto',[1,0],{lab:['ON','OFF']});
  tog('EXT LT|LAND L','landL',[2,1,0],{lab:['ON','OFF','RETRACT']}); tog('EXT LT|LAND R','landR',[2,1,0],{lab:['ON','OFF','RETRACT']}); tog('EXT LT|NOSE LT','nose',[2,1,0],{lab:['T.O','TAXI','OFF']});
  tog('SIGNS|SEAT BELTS','seatB',[2,0],{lab:['ON','OFF']}); tog('SIGNS|NO SMOKING','noSmk',[2,1,0],{lab:['ON','AUTO','OFF']}); tog('SIGNS|EMER EXIT LT','emerExit',[2,1,0],{lab:['ON','ARM','OFF']});
  ann('SIGNS|EXIT LT OFF',null,['OFF','a',()=>S_('emerExit')===0&&A.dc]);
  tog('INT LT|ANN LT','annLt',[2,1,0],{lab:['TEST','BRT','DIM']}); tog('INT LT|DOME','domeLt',[2,1,0],{lab:['BRT','DIM','OFF']}); tog('INT LT|ICE IND & STBY COMPASS','iceInd',[1,0],{lab:['ON','OFF']});
  sel('WIPER CPT|WIPER CPT','wiperC',['OFF','SLOW','FAST'],[-50,0,50]); sel('WIPER F/O|WIPER F/O','wiperF',['OFF','SLOW','FAST'],[-50,0,50]);
  // ---- glareshield: master warning / caution, autoland ----
  for(const s of ['CPT','F/O']){
    ann('MASTER '+s+'|MASTER WARN '+s,['MASTER','r',()=>A.ecam.mw&&UI.t%0.8<0.5],['WARN','r',()=>A.ecam.mw&&UI.t%0.8<0.5],{cls:'mw',click:()=>{ Y.master(A,3); UI.apOffT=Math.min(UI.apOffT||0,0); }});
    ann('MASTER '+s+'|MASTER CAUT '+s,['MASTER','a',()=>A.ecam.mc],['CAUT','a',()=>A.ecam.mc],{click:()=>{ Y.master(A,2); UI.athrOffT=0; }});
    ann('AUTO LAND '+s+'|AUTO LAND '+s,['AUTO','r',()=>autolandWarn()],['LAND','r',()=>autolandWarn()]);
  }
  // ---- EFIS control panels ----
  for(const side of [0,1]){ const s=side?' F/O':' CPT', P=side?'EFIS F/O|':'EFIS CPT|', E=side?UI.efis2:UI.efis;
    bar(P+'FD'+s,()=>side?M.ap.fd2:M.ap.fd1,()=>{ F.fcu(M,side?'fd2':'fd1'); });
    bar(P+'LS'+s,()=>UI.ls[side],()=>{ UI.ls[side]=!UI.ls[side]; });
    for(const f of ['CSTR','WPT','VOR.D','NDB','ARPT']) bar(P+f+(side?' F/O':''),()=>E.filt===f.toLowerCase().replace('.',''),()=>{ const k=f.toLowerCase().replace('.',''); E.filt=E.filt===k?'':k; });
    CT.push({id:P+'QNH'+s,t:'knob',turn:d=>{ if(!E.std){ E.qnh=clamp(E.qnh+d,940,1060); } },pull:()=>{ E.std=false; },push:()=>{ E.std=!E.std; },ang:()=>E.std?-30:0,tip:()=>E.std?'STD (pull for QNH)':'QNH '+E.qnh+' (push for STD)'});
    CT.push({id:P+'ND MODE'+s,t:'selF',get:()=>E.mode,set:v=>{ E.mode=v; },pos:['LS','VOR','NAV','ARC','PLAN'],ang:[-60,-30,0,30,60]});
    CT.push({id:P+'ND RANGE'+s,t:'selF',get:()=>E.range,set:v=>{ E.range=v; },pos:RANGES.map(String),ang:[-60,-36,-12,12,36,60]});
    tog(P+'ADF/VOR 1'+s,null,[2,1,0],{get:()=>E.adf1==null?1:E.adf1,set:v=>{ E.adf1=v; },lab:['VOR','OFF','ADF'],horiz:true});
    tog(P+'ADF/VOR 2'+s,null,[2,1,0],{get:()=>E.adf2==null?1:E.adf2,set:v=>{ E.adf2=v; },lab:['VOR','OFF','ADF'],horiz:true});
    CT.push({id:(side?'EFIS F/O|':'EFIS CPT|')+'BARO WIN'+s,t:'seg',rect:side?[645,826.5,18,7.5]:[336.5,826.5,18,7.5],txt:()=>A.bus.acEss||A.bus.ac2?(E.std?'Std':String(E.qnh)):''});
  }
  // ---- FCU ----
  const ap=()=>M.ap;
  CT.push({id:'FCU|SPD',t:'knob',turn:d=>F.fcu(M,'spdTurn',d),pull:()=>F.fcu(M,'spdPull'),push:()=>F.fcu(M,'spdPush'),tip:()=>'SPD: pull = selected, push = managed'});
  CT.push({id:'FCU|HDG',t:'knob',turn:d=>F.fcu(M,'hdgTurn',d),pull:()=>F.fcu(M,'hdgPull'),push:()=>F.fcu(M,'hdgPush'),tip:()=>'HDG: pull = selected, push = NAV'});
  CT.push({id:'FCU|ALT KNOB',t:'knob',turn:d=>F.fcu(M,'altTurn',d),pull:()=>F.fcu(M,'altPull'),push:()=>F.fcu(M,'altPush'),tip:()=>'ALT: pull = OP CLB / OP DES, push = managed'});
  CT.push({id:'FCU|V/S',t:'knob',turn:d=>F.fcu(M,'vsTurn',d),pull:()=>F.fcu(M,'vsPull'),push:()=>F.fcu(M,'vsPush'),tip:()=>'V/S: pull = V/S, push = level off'});
  bar('FCU|AP 1',()=>ap().ap1,()=>{ const r=F.fcu(M,'ap1'); if(r) say(r); if(!ap().ap1&&!ap().ap2) UI.apOffT=Math.max(UI.apOffT||0,1.5); });
  bar('FCU|AP 2',()=>ap().ap2,()=>{ const r=F.fcu(M,'ap2'); if(r) say(r); if(!ap().ap1&&!ap().ap2) UI.apOffT=Math.max(UI.apOffT||0,1.5); });
  bar('FCU|A/THR',()=>ap().athr||ap().athrArm,()=>F.fcu(M,'athr'));
  bar('FCU|LOC',()=>ap().loc,()=>F.fcu(M,'loc')); bar('FCU|APPR',()=>ap().appr,()=>F.fcu(M,'appr')); bar('FCU|EXPED',()=>ap().vert.startsWith('EXPED'),()=>F.fcu(M,'exped'));
  act('FCU|SPD/MACH',()=>F.fcu(M,'spdMach')); act('FCU|HDG V/S - TRK FPA',()=>F.fcu(M,'trkFpa')); act('FCU|METRIC ALT',()=>{ M.ap.alt.step=M.ap.alt.step===100?1000:100; say('ALT increment '+M.ap.alt.step+' ft'); });
  CT.push({id:'FCU|WINDOW',t:'fcu',rect:[433,818.5,137,10]});
  // ---- glareshield chrono and sidestick priority (pictures) ----
  // ---- landing gear, autobrake ----
  CT.push({id:'GEAR LEVER|GEAR LEVER',t:'lever',kind:'gear'});
  CT.push({id:'LDG GEAR / BRAKES|LDG GEAR IND',t:'gearInd'});
  for(const [id,v,txt] of [['LO',1,'LO'],['MED',2,'MED'],['MAX',3,'MAX']]) CT.push({id:'LDG GEAR / BRAKES|AUTO BRK '+id,t:'pb',k:null,up:['DECEL','g',()=>A.sw.abrk===v&&M.abActive&&M.accel<-1],dn:['ON','b',()=>A.sw.abrk===v],on:()=>{ A.sw.abrk=A.sw.abrk===v?0:v; }});
  pb('LDG GEAR / BRAKES|BRK FAN','brkFan',['HOT','a',()=>false],['ON','b',()=>!!S_('brkFan')]);
  tog('LDG GEAR / BRAKES|A/SKID & N/W STRG','askid',[1,0],{lab:['ON','OFF']});
  ann('TERR ON ND CPT|TERR ON ND CPT',null,['ON','b',()=>false]);
  // ---- ECAM control panel ----
  for(const [id,k] of [['ENG','eng'],['BLEED','bleed'],['PRESS','press'],['ELEC','elec'],['HYD','hyd'],['FUEL','fuel'],['APU','apu'],['COND','cond'],['DOOR','door'],['WHEEL','wheel'],['F/CTL','fctl'],['ALL','all'],['STS','sts']])
    CT.push({id:'ECAM CONTROL|'+id,t:'key',lit:()=>A.ecam.man===k||(k==='sts'&&A.ecam.man==='sts'),on:()=>Y.ecamBtn(A,k)});
  CT.push({id:'ECAM CONTROL|CLR',t:'key',lit:()=>A.ecam.list.some(a=>!A.ecam.clr[a.id])||!!A.ecam.man,on:()=>Y.ecamBtn(A,'clr')});
  CT.push({id:'ECAM CONTROL|CLR L',t:'key',lit:()=>A.ecam.list.some(a=>!A.ecam.clr[a.id]),on:()=>Y.ecamBtn(A,'clr')});
  CT.push({id:'ECAM CONTROL|RCL',t:'key',lit:()=>false,on:()=>Y.ecamBtn(A,'rcl')});
  CT.push({id:'ECAM CONTROL|EMER CANC',t:'key',lit:()=>false,on:()=>{ Y.ecamBtn(A,'emer'); UI.crcOn=false; }});
  CT.push({id:'ECAM CONTROL|T.O CONFIG',t:'key',lit:()=>false,on:()=>{ Y.ecamBtn(A,'cfg'); }});
  // ---- engines ----
  tog('ENGINE|ENG MASTER 1','mst1',[1,0],{lab:['ON','OFF'],lever:true});
  tog('ENGINE|ENG MASTER 2','mst2',[1,0],{lab:['ON','OFF'],lever:true});
  sel('ENGINE|ENG MODE SEL','engMode',['CRANK','NORM','IGN/START'],[-50,0,50]);
  ann('ENGINE|ENG 1 FIRE/FAULT',['FIRE','r',()=>A.fire.e[0]],['FAULT','a',()=>!!A.eng[0].startFault||(A.eng[0].fail&&S_('mst1'))]);
  ann('ENGINE|ENG 2 FIRE/FAULT',['FIRE','r',()=>A.fire.e[1]],['FAULT','a',()=>!!A.eng[1].startFault||(A.eng[1].fail&&S_('mst2'))]);
  CT.push({id:'THRUST LEVERS|THR LVR 1',t:'thr',i:0}); CT.push({id:'THRUST LEVERS|THR LVR 2',t:'thr',i:1});
  act('THRUST LEVERS|A/THR DISC 1',()=>F.fcu(M,'athrInst')); act('THRUST LEVERS|A/THR DISC 2',()=>F.fcu(M,'athrInst'));
  CT.push({id:'SPEED BRAKE|SPEED BRAKE LEVER',t:'lever',kind:'spd'});
  CT.push({id:'FLAPS|FLAPS LEVER',t:'lever',kind:'flaps'});
  CT.push({id:'PARKING BRK|PARKING BRAKE',t:'lever',kind:'park'});
  CT.push({id:'RUD TRIM|RUD TRIM',t:'knob',turn:d=>{ A.sw.rudTrim=clamp(+(A.sw.rudTrim+d*0.1).toFixed(1),-20,20); },push:()=>{},pull:()=>{},tip:()=>'Rudder trim'});
  act('RUD TRIM|RUD TRIM RESET',()=>{ A.sw.rudTrim=0; });
  CT.push({id:'RUD TRIM|RUD TRIM IND',t:'seg',txt:()=>A.dc?(A.sw.rudTrim===0?' 0.0':(A.sw.rudTrim<0?'L':'R')+Math.abs(A.sw.rudTrim).toFixed(1)):''});
  CT.push({id:'ATC / TCAS|XPDR CODE',t:'seg',txt:()=>A.dc?A.sw.xpdr:''});
  sel('ATC / TCAS|XPDR MODE','xpdrMd',['STBY','AUTO','ON'],[-45,0,45]);
  sel('ATC / TCAS|TCAS MODE','tcas',['STBY','TA','TA/RA'],[-45,0,45]);
  // ---- MCDU keys (both) ----
  mcduKeys(0); mcduKeys(1);
  // ---- side consoles: sidestick (drag) ----
  CT.push({id:'CPT SIDE CONSOLE|SIDESTICK CPT',t:'stick'}); CT.push({id:'F/O SIDE CONSOLE|SIDESTICK F/O',t:'stick'});
  CT.push({id:'CPT SIDE CONSOLE|TILLER CPT',t:'tiller'});
}
function autolandWarn(){ const a=M.ap; return !M.gnd&&M.ra/FT<200&&(a.vert==='LAND'||a.vert==='FLARE')&&!(a.ap1||a.ap2); }
function mcduKeys(side){
  const r=RECT[side?'MCDU 2':'MCDU 1']; if(!r) return; const x0=r[1], y0=r[2];
  const add=(k,x,y,w,h)=>CT.push({id:'MCDU '+(side+1)+'|'+k,t:'mkey',k,side,rect:[x0+x-(w||7)/2,y0+y-(h||5)/2,w||7,h||5]});
  [16.7,24,31.7,39.3,46.7,54.3].forEach((y,i)=>{ add('L'+(i+1),6,y,8,5); add('R'+(i+1),81,y,8,5); });
  ['DIR','PROG','PERF','INIT','DATA','',  'BRT'].forEach((k,i)=>{ if(k) add(k,[12.7,25,36,46.7,57.3,68.3,77.3][i],69.3,9,5.5); });
  ['F-PLN','RAD NAV','FUEL PRED','SEC F-PLN','ATC COMM','MCDU MENU','DIM'].forEach((k,i)=>add(k,[12.7,25,36,46.7,57.3,68.3,77.3][i],77.3,9,5.5));
  add('AIRPORT',12.7,85,9,5.5); add('←',12.7,92.5,8,5); add('↑',25,90,8,5); add('→',12.7,98.5,8,5); add('↓',25,97.7,8,5);
  'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('').forEach((c,i)=>add(c,[39,48.3,56.7,65.7,74.7][i%5],[85,93.3,101.7,110,118.3][Math.floor(i/5)],7.5,6.5));
  ['Z','/','SP','OVFY','CLR'].forEach((c,i)=>add(c,[39,48.3,56.7,65.7,74.7][i],126.7,7.5,6.5));
  ['1','2','3','4','5','6','7','8','9','.','0','+/-'].forEach((c,i)=>add(c,[12.7,21,30][i%3],[106,114,121.7,129.3][Math.floor(i/3)],7.5,6.5));
}

/* ================= overlay (lit legends, knobs, switches) ================= */
const OV=[]; let ovl;
function buildOverlay(){
  ovl=$('ovl'); ovl.textContent='';
  for(const c of CT){
    const r=c.rect?['',...c.rect]:RECT[c.id]; if(!r){ continue; } c.r=[r[1],r[2],r[3],r[4]];
    let el=null;
    if(c.t==='pb'||c.t==='mom'||c.t==='ann'){ if(!c.up&&!c.dn) continue; el=document.createElement('div'); el.className='pb'+(c.cls?' '+c.cls:''); el.innerHTML='<i></i><i></i>';
      const [u,d]=el.children; if(c.up) u.textContent=c.up[0]; if(c.dn) d.textContent=c.dn[0]; if(c.up) u.classList.add(c.up[1]); if(c.dn) d.classList.add(c.dn[1]);
      if(c.cls&&c.cls.includes('big')){ el.style.gridTemplateRows='1fr'; u.remove(); } }
    else if(c.t==='key'){ el=document.createElement('div'); el.className='pb'; el.style.gridTemplateRows='1fr'; el.innerHTML='<i class="w"></i>'; el.firstChild.textContent=c.id.split('|')[1].replace(' L',''); el.firstChild.style.fontSize='2.1px'; }
    else if(c.t==='bar'){ el=document.createElement('div'); el.className='bar'; const [x,y,w,h]=c.r; Object.assign(el.style,{left:(x+w*0.28)+'px',top:(y+h*0.12)+'px',width:(w*0.44)+'px'}); ovl.appendChild(el); c.el=el; OV.push(c); continue; }
    else if(c.t==='sel'||c.t==='selF'||c.t==='knob'||c.t==='cont'){ if(c.t==='knob'&&!c.ang){ c.el=null; OV.push(c); continue; } el=document.createElement('div'); el.className='knb'; el.dataset.a='1';
      const [x,y,w,h]=c.r, s=Math.min(w,h)*0.78; Object.assign(el.style,{left:(x+w/2-s/2)+'px',top:(y+h/2-s/2)+'px',width:s+'px',height:s+'px'}); ovl.appendChild(el); c.el=el; OV.push(c); continue; }
    else if(c.t==='tog'){ el=document.createElement('div'); el.className='tog'; el.innerHTML='<b></b>'; }
    else if(c.t==='seg'){ el=document.createElement('div'); el.className='seg7'; const [x,y,w,h]=c.r; el.style.fontSize=(h*0.62)+'px'; }
    else if(c.t==='fcu'){ el=document.createElement('canvas'); el.className='fcuw'; c.cv=el; }
    else if(c.t==='gearInd'){ el=document.createElement('div'); el.className='seg7'; el.style.background='#08090a'; el.style.color='#2bff4a'; el.style.fontSize='3.6px'; el.style.textShadow='none'; }
    else if(c.t==='thr'||c.t==='lever'){ el=document.createElement('div'); el.className='seg7'; el.style.background='rgba(8,9,10,.82)'; el.style.color='#7fe8ff'; el.style.textShadow='none'; el.style.fontSize='3px'; el.style.borderRadius='1px'; }
    if(!el){ OV.push(c); continue; }
    const [x,y,w,h]=c.r;
    if(c.t==='thr'){ Object.assign(el.style,{left:(x+(c.i?w:-12))+'px',top:(y+h+1)+'px',width:'12px',height:'4.5px'}); }
    else if(c.t==='lever'&&c.kind==='gear'){ Object.assign(el.style,{left:(x-14)+'px',top:(y+h/2-2.5)+'px',width:'13px',height:'5px'}); }
    else if(c.t==='lever'&&c.kind==='flaps'){ Object.assign(el.style,{left:(x+w+1)+'px',top:(y+2)+'px',width:'16px',height:'5px'}); }
    else if(c.t==='lever'&&c.kind==='spd'){ Object.assign(el.style,{left:(x-17)+'px',top:(y+2)+'px',width:'16px',height:'5px'}); }
    else if(c.t==='lever'&&c.kind==='park'){ Object.assign(el.style,{left:(x+w*0.35)+'px',top:(y+h-6)+'px',width:(w*0.3)+'px',height:'5px'}); }
    else Object.assign(el.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    ovl.appendChild(el); c.el=el; OV.push(c);
  }
  // display canvases
  DISP.forEach(d=>{ const r=d.rect||RECT[d.id]; if(!r) return; const [x,y,w,h]=d.rect?d.rect:[r[1],r[2],r[3],r[4]]; d.r=[x,y,w,h];
    const cv=document.createElement('canvas');
    if(D3){ const mob=matchMedia('(pointer:coarse)').matches; const px=d.k==='isis'?256:d.k==='mcdu'?(mob?320:448):(mob?384:576); cv.width=cv.height=px; d.px=px; }
    else { Object.assign(cv.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'}); $('world').insertBefore(cv,ovl); d.px=0; }
    d.cv=cv; d.g=cv.getContext('2d',{alpha:false}); d.t=0; });
}
const lastSig=new Map();
/* ---- 3D: paint lit legends, switches and the FCU window into the panel textures (sheet units), only when something changed ---- */
const COL={a:'#ffae2a',w:'#f4f7ff',b:'#3fd8ff',g:'#3dff63',r:'#ff3a2a'};
let sig3='';
function stateSig(){ const test=A.sw.annLt===2&&A.dc; let s=test?'T':'';
  for(const c of OV){ switch(c.t){
    case 'pb': case 'mom': case 'ann': s+=(c.up&&A.dc&&(test||c.up[2]())?1:0)+''+(c.dn&&A.dc&&(test||c.dn[2]())?1:0); break;
    case 'key': s+=A.dc&&A.bus.dcEss&&(test||c.lit())?1:0; break; case 'bar': s+=A.dc&&(test||c.lit())?1:0; break;
    case 'sel': case 'cont': s+=A.sw[c.k]; break; case 'selF': s+=c.get(); break; case 'knob': s+=c.ang?c.ang():''; break;
    case 'tog': s+=c.get?c.get():A.sw[c.k]; break; case 'seg': s+='|'+c.txt(); break; case 'gearInd': s+=M.gear>0.99?'D':M.gear<0.01?'U':'T'; break;
    case 'thr': s+=Math.round(UI.tla[c.i]); break; case 'lever': s+=A.sw.gearLv+''+A.sw.flapLv+A.sw.spArm+A.sw.spdBrk+A.sw.park; break; case 'fcu': s+=fcuVals().join('|')+M.ap.lat+M.ap.latArm+M.ap.spd.man+M.ap.alt.v; break; }
    s+=','; }
  return s; }
function paint3d(force){ if(!CK) return; const s=stateSig(); if(!force&&s===sig3) return; sig3=s; CK.repaint(paintPanel); }
function paintPanel(g,R){
  const test=A.sw.annLt===2&&A.dc, inR=c=>c.r&&c.r[0]+c.r[2]>R[0]&&c.r[0]<R[0]+R[2]&&c.r[1]+c.r[3]>R[1]&&c.r[1]<R[1]+R[3];
  const lit=(x,y,w,h,txt,col,fill)=>{ g.fillStyle=fill||'#0b0c0d'; g.fillRect(x+w*0.08,y+h*0.06,w*0.84,h*0.88); g.shadowColor=COL[col]; g.shadowBlur=1.6; g.fillStyle=COL[col]; g.font='700 '+Math.min(h*0.62,w*0.30).toFixed(2)+'px Archivo,Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,x+w/2,y+h/2+0.1); g.shadowBlur=0; };
  for(const c of OV){ if(!inR(c)) continue; const [x,y,w,h]=c.r;
    switch(c.t){
      case 'pb': case 'mom': case 'ann': { if(!A.dc) break; const big=c.cls&&c.cls.includes('big'); const u=c.up&&(test||c.up[2]()), d=c.dn&&(test||c.dn[2]());
        if(big){ if(d) lit(x,y,w,h,c.dn[0],c.dn[1],'#c0140e'); break; } if(u) lit(x,y,w,h/2,c.up[0],c.up[1]); if(d) lit(x,y+h/2,w,h/2,c.dn[0],c.dn[1]); break; }
      case 'key': if(A.dc&&A.bus.dcEss&&(test||c.lit())) lit(x,y,w,h,c.id.split('|')[1].replace(' L',''),'w'); break;
      case 'bar': if(A.dc&&(test||c.lit())){ g.fillStyle=COL.g; g.shadowColor=COL.g; g.shadowBlur=1.5; g.fillRect(x+w*0.28,y+h*0.12,w*0.44,1.1); g.shadowBlur=0; } break;
      case 'sel': case 'selF': case 'cont': case 'knob': { let a=null; if(c.t==='sel') a=c.ang[A.sw[c.k]]; else if(c.t==='selF') a=c.ang[c.get()]; else if(c.t==='cont') a=c.ang(A.sw[c.k]); else if(c.ang) a=c.ang(); if(a==null) break;
        const r=Math.min(w,h)*0.39, cx=x+w/2, cy=y+h/2, gr=g.createRadialGradient(cx-r*0.2,cy-r*0.36,r*0.1,cx,cy,r); gr.addColorStop(0,'#8a929b'); gr.addColorStop(0.62,'#3b4148'); gr.addColorStop(1,'#25292e');
        g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill(); g.save(); g.translate(cx,cy); g.rotate(a*Math.PI/180); g.fillStyle='#f1f3f5'; g.fillRect(-r*0.09,-r*0.88,r*0.18,r*0.88); g.restore(); break; }
      case 'tog': { const v=c.get?c.get():A.sw[c.k], i=c.vals.indexOf(v), n=c.vals.length; g.fillStyle='#1d2024'; g.beginPath(); g.ellipse(x+w/2,y+h/2,w*0.38,h*0.2,0,0,7); g.fill();
        const by=n===2?(i===0?y+h*0.02:y+h*0.52):(i===0?y+h*0.02:i===1?y+h*0.27:y+h*0.52); const gr=g.createLinearGradient(x+w*0.28,0,x+w*0.72,0); gr.addColorStop(0,'#9aa3ac'); gr.addColorStop(0.45,'#e7ebef'); gr.addColorStop(1,'#8b939b'); g.fillStyle=gr; g.fillRect(x+w*0.28,by,w*0.44,h*0.46); break; }
      case 'seg': { const t=c.txt(); if(!t) break; g.fillStyle='#090a0b'; g.fillRect(x,y,w,h); g.fillStyle='#ffb347'; g.font='600 '+(h*0.62).toFixed(2)+'px "IBM Plex Mono",monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,x+w/2,y+h/2); break; }
      case 'gearInd': { if(!A.dc) break; const t=M.gear>0.99?'▼ ▼ ▼':M.gear<0.01?'':'UNLK'; if(!t) break; g.fillStyle='#08090a'; g.fillRect(x,y,w,h); g.fillStyle=M.gear>0.99?COL.g:COL.r; g.font='600 3.6px Archivo,Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,x+w/2,y+h/2); break; }
      case 'thr': { const v=UI.tla[c.i]; const t=v>=44.5?'TOGA':v>=34.5?'FLX/MCT':v>=24.5&&v<=25.5?'CL':v<=0.5&&v>=-0.5?'IDLE':v<0?'REV':Math.round(v)+'°'; const lx=x+(c.i?w:-12); g.fillStyle='rgba(8,9,10,.85)'; g.fillRect(lx,y+h+1,12,4.5); g.fillStyle='#7fe8ff'; g.font='600 3px "IBM Plex Mono",monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,lx+6,y+h+3.3); break; }
      case 'lever': { let t='', lx=x, ly=y, lw=14; if(c.kind==='gear'){ t=A.sw.gearLv?'DOWN':'UP'; lx=x-14; ly=y+h/2-2.5; } if(c.kind==='flaps'){ t=['0','1','2','3','FULL'][A.sw.flapLv]; lx=x+w+1; ly=y+2; } if(c.kind==='spd'){ t=A.sw.spArm?'ARM':A.sw.spdBrk>0?Math.round(A.sw.spdBrk*100)+'%':'RET'; lx=x-17; ly=y+2; lw=16; } if(c.kind==='park'){ t=A.sw.park?'ON':'OFF'; lx=x+w*0.35; ly=y+h-6; lw=w*0.3; }
        g.fillStyle='rgba(8,9,10,.85)'; g.fillRect(lx,ly,lw,5); g.fillStyle='#7fe8ff'; g.font='600 3px "IBM Plex Mono",monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,lx+lw/2,ly+2.6); break; }
      case 'fcu': { const [pw,spd,hdg,vs]=fcuVals(); g.save(); g.translate(x,y); g.scale(w/137,h/10); fcuPaint(g,pw,spd,hdg,vs); g.restore(); break; }
    } }
}
function overlayTick(){
  if(D3){ paint3d(false); return; }
  const test=A.sw.annLt===2&&A.dc;
  for(const c of OV){
    if(!c.el) continue; let sig;
    switch(c.t){
      case 'pb': case 'mom': case 'ann': {
        const u=c.up&&A.dc&&(test||c.up[2]()), d=c.dn&&A.dc&&(test||c.dn[2]());
        sig=(u?1:0)+(d?2:0)+(c.gOpen?4:0); if(lastSig.get(c)===sig) break; lastSig.set(c,sig);
        const ch=c.el.children; if(c.cls&&c.cls.includes('big')) ch[0].classList.toggle('on',!!d); else { ch[0].classList.toggle('on',!!u); ch[1].classList.toggle('on',!!d); } break; }
      case 'key': { const on=A.dc&&A.bus.dcEss&&(test||c.lit()); if(lastSig.get(c)===on) break; lastSig.set(c,on); c.el.firstChild.classList.toggle('on',on); break; }
      case 'bar': { const on=A.dc&&(test||!!c.lit()); if(lastSig.get(c)===on) break; lastSig.set(c,on); c.el.classList.toggle('on',on); break; }
      case 'sel': { const v=A.sw[c.k]; if(lastSig.get(c)===v) break; lastSig.set(c,v); c.el.style.setProperty('--a',(c.ang[v]||0)+'deg'); break; }
      case 'selF': { const v=c.get(); if(lastSig.get(c)===v) break; lastSig.set(c,v); c.el.style.setProperty('--a',(c.ang[v]||0)+'deg'); break; }
      case 'cont': { const v=A.sw[c.k]; if(lastSig.get(c)===v) break; lastSig.set(c,v); c.el.style.setProperty('--a',c.ang(v)+'deg'); break; }
      case 'knob': { if(!c.ang) break; const v=c.ang(); if(lastSig.get(c)===v) break; lastSig.set(c,v); c.el.style.setProperty('--a',v+'deg'); break; }
      case 'tog': { const v=c.get?c.get():A.sw[c.k]; if(lastSig.get(c)===v) break; lastSig.set(c,v); const i=c.vals.indexOf(v), b=c.el.firstChild; b.className=c.vals.length===2?(i===0?'u':'d'):(i===0?'u':i===1?'m':'d'); break; }
      case 'seg': { const s=c.txt(); if(lastSig.get(c)===s) break; lastSig.set(c,s); c.el.textContent=s; c.el.style.visibility=s?'visible':'hidden'; break; }
      case 'gearInd': { const g=M.gear, on=A.dc; const s=on?(g>0.99?'▼ ▼ ▼':g<0.01?'':'UNLK'):''; if(lastSig.get(c)===s) break; lastSig.set(c,s); c.el.textContent=s; c.el.style.color=g>0.99?'#2bff4a':'#ff3a2a'; c.el.style.visibility=s?'visible':'hidden'; break; }
      case 'thr': { const v=UI.tla[c.i]; const s=v>=44.5?'TOGA':v>=34.5?'FLX/MCT':v>=24.5&&v<=25.5?'CL':v<=0.5&&v>=-0.5?'IDLE':v<0?'REV':Math.round(v)+'°'; if(lastSig.get(c)===s) break; lastSig.set(c,s); c.el.textContent=s; break; }
      case 'lever': { let s=''; if(c.kind==='gear') s=A.sw.gearLv?'DOWN':'UP'; if(c.kind==='flaps') s=['0','1','2','3','FULL'][A.sw.flapLv]; if(c.kind==='spd') s=A.sw.spArm?'ARM':A.sw.spdBrk>0?Math.round(A.sw.spdBrk*100)+'%':'RET'; if(c.kind==='park') s=A.sw.park?'ON':'OFF';
        if(lastSig.get(c)===s) break; lastSig.set(c,s); c.el.textContent=s; break; }
      case 'fcu': fcuDraw(c); break;
    }
  }
}
function fcuVals(){ const a=M.ap;
  const spd=a.spd.man?(a.spd.mach?'.'+String(Math.round(a.spd.v*100)).padStart(2,'0'):String(Math.round(a.spd.v))):'---';
  const hdg=(a.lat==='HDG'||a.lat==='TRK'||a.hdg.preset)&&!(a.lat==='NAV'&&!a.hdg.preset)?String(Math.round(a.hdg.v)).padStart(3,'0'):'---';
  const vs=a.vert==='V/S'?(a.vs.v>=0?'+':'-')+String(Math.abs(Math.round(a.vs.v/100))).padStart(2,'0')+'oo':a.vert==='FPA'?(a.vs.fpaV>=0?'+':'')+a.vs.fpaV.toFixed(1):'-----';
  return [!!(A.bus.acEss||A.bus.ac1||A.bus.ac2),spd,hdg,vs]; }
function fcuDraw(c){
  const a=M.ap, pw=A.bus.acEss||A.bus.ac1||A.bus.ac2, h=M.h/FT;
  const spd=a.spd.man?(a.spd.mach?'.'+String(Math.round(a.spd.v*100)).padStart(2,'0'):String(Math.round(a.spd.v))):'---';
  const hdg=(a.lat==='HDG'||a.lat==='TRK'||a.hdg.preset)&&!(a.lat==='NAV'&&!a.hdg.preset)?String(Math.round(a.hdg.v)).padStart(3,'0'):'---';
  const vs=a.vert==='V/S'?(a.vs.v>=0?'+':'-')+String(Math.abs(Math.round(a.vs.v/100))).padStart(2,'0')+'oo':a.vert==='FPA'?(a.vs.fpaV>=0?'+':'')+a.vs.fpaV.toFixed(1):'-----';
  const sig=[pw,spd,hdg,String(a.alt.v).padStart(5,'0'),vs,!a.spd.man,a.lat==='NAV'||a.latArm==='NAV',a.hdg.trk,a.spd.mach,c.px].join('|');
  if(c.sig===sig) return; c.sig=sig;
  const cv=c.cv, [x,y,w,hh]=c.r, sc=Math.max(1,Math.min(6,(Z.s||1)*(devicePixelRatio||1)));
  const W=Math.round(w*sc), H=Math.round(hh*sc); if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }
  const g=cv.getContext('2d'); g.setTransform(W/137,0,0,H/10,0,0); fcuPaint(g,pw,spd,hdg,vs); }
function fcuPaint(g,pw,spd,hdg,vs){ const a=M.ap; g.fillStyle='#0d0d0c'; g.fillRect(0,0,137,10); if(!pw) return;
  g.fillStyle='#ffb347'; g.font='600 4px "IBM Plex Mono",monospace'; g.textBaseline='alphabetic';
  g.font='600 2.3px Archivo,Arial'; g.fillText(a.spd.mach?'MACH':'SPD',4,3); g.fillText(a.hdg.trk?'TRK':'HDG',30,3); g.fillText('LAT',43,3); g.fillText(a.hdg.trk?'TRK':'HDG',62,3.4); g.fillText(a.hdg.trk?'FPA':'V/S',72,3.4); g.fillText('ALT',90,3); g.fillText(a.vs.fpa?'FPA':'V/S',118,3);
  g.font='600 5.6px "IBM Plex Mono",monospace'; g.fillText(spd,4,9.2); g.fillText(hdg,29,9.2); g.fillText(String(a.alt.v).padStart(5,'0'),88,9.2); g.fillText(vs,113,9.2);
  const dot=(cx)=>{ g.beginPath(); g.arc(cx,7.2,1.1,0,7); g.fill(); };
  if(!a.spd.man) dot(20); if(a.lat==='NAV'||a.latArm==='NAV') dot(46);
}

/* ================= displays ================= */
const DISP=[
  {id:'PFD CPT',k:'pfd',side:0,hz:30},{id:'ND CPT',k:'nd',side:0,hz:30},{id:'E/WD (upper ECAM)',k:'ewd',hz:12},{id:'SD (lower ECAM)',k:'sd',hz:12},
  {id:'ND F/O',k:'nd',side:1,hz:15},{id:'PFD F/O',k:'pfd',side:1,hz:15},{id:'STANDBY (ISIS)',k:'isis',hz:15},
  {id:'MCDU 1',k:'mcdu',side:0,hz:0,rect:null},{id:'MCDU 2',k:'mcdu',side:1,hz:0,rect:null}];
(function(){ for(const d of DISP){ if(d.k==='mcdu'){ const r=(window.A320T||[]).find(t=>t[0]===d.id); if(r) d.rect=[r[1]+14.6,r[2]+5.2,58.5,58.5]; } } })();
function dispData(d){
  const ap=M.ap, sp=M.spds||{}, side=d.side||0, E=side?UI.efis2:UI.efis;
  const ir=A.irs[side?1:0], irOK=ir.st===2, attOK=ir.st===2||ir.st===3;
  const adrOK=A.sw['adr'+(side?2:1)]&&(A.bus.acEss||A.bus.ac1||A.bus.ac2||A.bus.dcBat);
  const qnhAdj=E.std?0:(E.qnh-1013.25)*27.3, alt=M.h/FT+qnhAdj-(E.std?0:0);
  const hdg=w360(M.psi*R2D), trk=w360((M.gnd?M.psi:M.trk||M.chi)*R2D);
  const pwr=side?(A.bus.ac2||A.bus.acEss):(A.bus.acEss);
  if(d.k==='pfd'){
    const fmaA=fma(); const fdOn=side?ap.fd2:ap.fd1;
    const fdP=ap.gamC!=null?clamp((ap.gamC-M.gam)*R2D*2.2,-10,10):0, fdR=ap.phiC!=null?clamp((ap.phiC-M.phi)*R2D,-25,25):0;
    const ls=UI.ls[side], dh=K.d.dh, mda=K.d.mda;
    let msg='', msgC=DSP.C.a;
    if(M.fbw.law!=='NORMAL'&&!M.gnd) { msg=M.fbw.law==='DIRECT'?'USE MAN PITCH TRIM':''; }
    if(M.stall&&!M.gnd){ msg='STALL'; msgC=DSP.C.r; }
    return {pwr,attOK,adrOK:!!adrOK,irOK,phi:M.phi*R2D,th:M.th*R2D,beta:(M.beta||0)*R2D,ias:M.ias,alt,vs:M.vs/FPM,hdg,trk,ra:M.ra/FT,gnd:M.gnd,conf:M.conf,
      vls:sp.vls,vaprot:sp.vaprot,vamax:sp.vamax,vmax:sp.vmax,F:sp.F,S:sp.S,gd:sp.gd,v1:K.d.v1,vr:K.d.vr,vfeN:sp.vfeN,spdTgt:M.gnd&&!ap.vert?K.d.v2:ap.tgtSpd,spdMan:ap.spd.man,trend:(M.accel||0)*10,mach:M.mach,
      selAlt:ap.alt.v,std:E.std,qnh:E.std?1013:E.qnh,selHdg:(ap.lat==='HDG'||ap.lat==='TRK'||ap.hdg.preset)?ap.hdg.v:null,fd:fdOn&&!!(ap.lat||ap.vert),fdOn:true,fdPitch:fdP,fdRoll:fdR,
      fpv:ap.hdg.trk,drift:w180(trk-hdg),gam:M.gam*R2D,ls,loc:M.nav.loc,gs:M.nav.gs,dme:M.nav.dme,lsCrs:K.d.ilsCrs,lsId:K.d.ilsId,lsFreq:K.d.ilsFreq,fma:fmaA,dh:dh&&dh!=='NO'?dh:0,
      dhTxt:dh!=null?(dh==='NO'?'NO DH':'DH '+dh):mda?'MDA '+mda:'',pfdMsg:msg,pfdMsgC:msgC};
  }
  if(d.k==='nd'){
    const fx=[]; for(const k in FIX){ const f=FIX[k]; if(k==='RW36') continue; fx.push({id:k,N:f.N,E:f.E,vor:k==='ASN'}); }
    const nav=M.nav&&M.nav.fp; const fp=K.fpln.length?K.fpln.map(p=>({N:p.N,E:p.E})):null; K.fpln.forEach(p=>{ const f=fx.find(x=>x.id===p.id); if(f) f.fp=true; else if(!p.rwy) fx.push({id:p.id,N:p.N,E:p.E,fp:true}); });
    const mode=MODES[E.mode]; const W=M.wind;
    return {pwr,irOK,mode,range:RANGES[E.range],N:M.N,E:M.E,hdg,trk,selHdg:(ap.lat==='HDG'||ap.lat==='TRK'||ap.hdg.preset)?ap.hdg.v:null,gs:M.gs/KT,tas:M.tas/KT,windDir:W.dir,windSpd:W.spd,
      fixes:fx,fpln:mode==='ROSE ILS'||mode==='ROSE VOR'?null:fp&&fp.slice(Math.max(0,K.act-1)),toWpt:nav?nav.toWpt:null,toDist:nav?nav.toDist:null,toBrg:nav?nav.toBrg:null,lsOn:UI.ls[side]||ap.appr||ap.loc,loc:M.nav.loc,lsCrs:K.d.ilsCrs,lsFreq:K.d.ilsFreq,lsId:K.d.ilsId,
      filt:{wpt:E.filt==='wpt',vord:E.filt==='vord'||E.filt==='ndb'},rwyLen:F.RWY.len,vor1:E.adf1===2?'ASN':null,vor2:E.adf2===2?'ASN':null,ndMsg:M.gnd&&!K.fpln.length&&mode!=='ROSE ILS'?'':''};
  }
  if(d.k==='ewd'){
    const fl=M.flapLv, conf=['','1','1+F','2','3','FULL'][M.conf]||'';
    const thrLim=M.gnd&&!M.toPower?(K.d.flex?'FLX':'TOGA'):M.toPower?(M.tla.some(x=>x>=44.5)?'TOGA':(M.flxLatched?'FLX':'MCT')):'CLB';
    const n1lim=F.n1Rating(M,thrLim==='TOGA'?'toga':thrLim==='FLX'?'flx':thrLim==='MCT'?'mct':'clb');
    const al=A.ecam.list.map(a=>Object.assign({},a,{clr:!!A.ecam.clr[a.id]}));
    const moving=Math.abs(M.slat-[0,18,18,22,22,27][Math.min(5,fl===0?0:fl===1?(M.onePlusF?2:1):fl+1)])>0.3||Math.abs(M.flap-[0,0,10,15,20,35][Math.min(5,fl===0?0:fl===1?(M.onePlusF?2:1):fl+1)])>0.3;
    return {pwr:A.bus.acEss||A.bus.ac1,fadec:[0,1].map(i=>A.sw.engMode===2||A.sw['mst'+(i+1)]===1||A.t<300),eng:A.eng,n1Cmd:ap.athr?M.n1Cmd:null,thrLim:thrLim+(thrLim==='FLX'&&K.d.flex?' +'+K.d.flex+'°C':''),thrLimN1:n1lim,fob:A.fuel.fob,slat:M.slat,flap:M.flap,confTxt:M.slat>0.5||M.flap>0.5||moving?conf||'':'',flapMoving:moving,
      alerts:al,memo:A.ecam.memo,memoR:A.ecam.memoR};
  }
  if(d.k==='sd'){
    const at=F.isa(M.h,M.oatDev), sat=at.T-273.15, tat=sat+(M.tas*M.tas)/(2*1005);
    const dt=new Date(); const utc=String(dt.getUTCHours()).padStart(2,'0')+':'+String(dt.getUTCMinutes()).padStart(2,'0');
    return {pwr:A.bus.ac2||A.bus.acEss,page:A.ecam.page,eng:A.eng,fused:A.fuel.used,duct:A.air.duct,showStart:A.sw.engMode!==1||A.eng.some(e=>e.st>0&&e.st<4),air:A.air,sw:A.sw,apu:A.apu,bus:A.bus,src:A.src,batV:A.batV,batA:A.batA,batCtc:A.batCtc,gen:A.gen,apuAv:A.apuAv,apuGenLoad:A.apuGenLoad||0,
      gpu:A.gpu,extOn:A.extOn,idgOK:A.idgOK,idgT:[A.eng[0].run?70:A.env.t,A.eng[1].run?70:A.env.t],hyd:A.hyd,fuel:A.fuel,doors:A.doors,gear:M.gear,gearLv:A.sw.gearLv,autoBrk:A.sw.abrk,brkT:A.brk.temp,sp:M.sp,ths:M.ths||0,
      ail:M.ctl.sx,elev:-M.ctl.sy,rud:M.ctl.rud,elac:A.elac,sec:A.sec,law:A.law,alerts:A.ecam.list,tat,sat,utc,gw:A.gw,gwOK:!!(K.d.zfw),elev:0,gnd:M.gnd};
  }
  if(d.k==='isis') return {pwrIsis:A.bus.dcEss||A.bus.hot1,phi:A.irs[2].st>=0?M.phi*R2D:0,th:M.th*R2D,ias:M.ias,alt:M.h/FT+(UI.efis.std?0:(UI.efis.qnh-1013.25)*27.3),qnh:UI.efis.qnh,mach:M.mach};
  if(d.k==='mcdu'){ return {pwr:side?A.bus.ac2:(A.bus.acEss||A.bus.ac1),mcdu:MC.render(K,M,A)}; }
  return {};
}
function fma(){
  const a=M.ap, F_={thr:a.thr,flx:K.d.flex,vert:a.vert,vertArm:a.vertArm,lat:a.lat,latArm:a.latArm};
  if(M.gnd&&!a.vert&&(a.fd1||a.fd2)&&K.d.v2){ F_.vert='SRS'; F_.lat='RWY'; F_.vertArm='CLB'; F_.latArm=K.fpln.length?'NAV':''; }
  if(a.vert==='ROLL OUT'){ F_.common='ROLL OUT'; F_.vert=F_.lat=''; }
  if(a.vert==='LAND'||a.vert==='FLARE'){ F_.common=a.vert; F_.vert=F_.lat=''; }
  if(a.appr&&(a.ap1&&a.ap2)){ F_.cat='CAT 3'; F_.cat2='DUAL'; } else if(a.appr){ F_.cat='CAT '+(a.ap1||a.ap2?'3':'1'); F_.cat2=a.ap1||a.ap2?'SINGLE':''; }
  const dh=K.d.dh, mda=K.d.mda; if(a.appr) F_.mins=dh!=null?(dh==='NO'?'NO DH':'DH '+dh):mda?'MDA '+mda:'';
  F_.ap=a.ap1&&a.ap2?'AP1+2':a.ap1?'AP1':a.ap2?'AP2':'';
  F_.fd=(a.fd1||a.fd2)&&(a.lat||a.vert||F_.vert)?((a.fd1?'1':'-')+' FD '+(a.fd2?'2':'-')):'';
  F_.athr=a.athr?'A/THR':a.athrArm?'A/THR':''; F_.athrArm=!a.athr&&a.athrArm;
  if(a.lvrClb&&UI.t%1<0.6) F_.lvr='LVR CLB';
  if(a.retard&&M.ra/FT<40) F_.thr='THR IDLE';
  if(a.alphaFloor) F_.thr='A.FLOOR';
  // box around a mode for 10 s after it changes
  const t=UI.t; const chg=(k,v)=>{ if(UI.fmaPrev[k]!==v){ UI.fmaPrev[k]=v; UI.fmaT[k]=t; } return v&&t-UI.fmaT[k]<10; };
  F_.boxThr=chg('thr',F_.thr); F_.boxVert=chg('vert',F_.vert); F_.boxLat=chg('lat',F_.lat);
  if(M.fbw.law==='ALTN'&&!M.gnd) F_.msg='MAN PITCH TRIM ONLY';
  return F_;
}
let dispFrame=0;
function displayTick(dt){
  if(!cockpitVis) return;
  dispFrame++;
  const vw=VPW, vh=VPH;
  if(D3&&CK){ for(const d of DISP){ if(!d.cv||!d.tex) continue; if(!CK.visible(d)){ d.hidden=true; continue; } d.t+=dt;
      if(d.k==='mcdu'){ const sig=K.changed+'|'+side_pw(d)+'|'+(K.page==='fpln'||K.page==='prog'?Math.round(UI.t):0)+'|'+d.hidden; if(sig===d.sig) continue; d.sig=sig; }
      else { const hz=Math.min(d.hz,GOV.lvl>1?10:GOV.lvl?15:d.side?12:d.hz>=30?24:d.hz); if(d.t<1/hz&&!d.hidden) continue; }
      d.hidden=false; d.t=0; DSP[d.k](d.g,d.cv,dispData(d)); d.tex.needsUpdate=true; }
    return; }
  for(const d of DISP){
    if(!d.cv) continue;
    // on screen?
    const [x,y,w,h]=d.r, sx=x*Z.s+Z.tx, sy=y*Z.s+Z.ty, sw=w*Z.s, sh=h*Z.s;
    const vis=sx+sw>0&&sy+sh>0&&sx<vw&&sy<vh&&sw>6; if(!vis){ d.hidden=true; continue; }
    const px=Math.round(clamp(sw*Math.min(devicePixelRatio||1,2),96,1100));
    if(px!==d.px){ d.px=px; d.cv.width=d.cv.height=px; d.t=99; d.sig=''; }
    d.t+=dt;
    if(d.k==='mcdu'){ const sig=K.changed+'|'+(side_pw(d))+'|'+(K.page==='fpln'||K.page==='prog'?Math.round(UI.t):0)+'|'+d.px+'|'+d.hidden; if(sig===d.sig) continue; d.sig=sig; }
    else { const hz=GOV.lvl>1?Math.min(d.hz,15):d.hz; if(d.t<1/hz&&!d.hidden) continue; }
    d.hidden=false; d.t=0;
    const D=dispData(d);
    DSP[d.k](d.g,d.cv,D);
  }
}
function side_pw(d){ return (d.side?A.bus.ac2:(A.bus.acEss||A.bus.ac1))?1:0; }

/* ================= view, zoom and pan ================= */
const ST=$('stage'), VP=$('vp'), WORLD=$('world');
const REG={ovhd:[300,438,400,356],aft:[300,0,400,436],pfd:[100,893,400,125],main:[0,793,1000,345],ped:[330,1130,340,548],fcu:[296,810,408,68],ecam:[390,880,240,370],mcdu:[338,1132,325,150],side:[0,1300,1000,120]};
const REGN={ovhd:'Overhead',aft:'Aft overhead',main:'Panel',ped:'Pedestal',fcu:'FCU and EFIS',ecam:'ECAM',mcdu:'MCDU'};
const Z={s:1,tx:0,ty:0,reg:'main',free:false}; let VPW=1,VPH=1, OTWH=0, cockpitVis=true;
function layout(instant){
  const W=ST.clientWidth, H=ST.clientHeight; if(!W||!H) return;
  if(D3){ OTWH=H; ST.style.setProperty('--vpt','0px'); ST.style.setProperty('--otwh','100%'); ST.classList.remove('noout'); ST.classList.toggle('zoomed',Z.reg!=='main'); VPW=W; VPH=H; Z.s=3;
    document.querySelectorAll('.vseg .cb').forEach(b=>b.classList.toggle('on',b.dataset.v===Z.reg)); const zs=$('zoomSel'); if(zs&&zs.value!==Z.reg) zs.value=Z.reg; return; }
  const r=REG[Z.reg]||REG.main;
  let otwH=0;
  if(Z.reg==='main'&&UI.otw!==false){ const s=Math.min(W/r[2],(H*0.68)/r[3]); otwH=Math.max(0,Math.round(H-r[3]*s)); Z.s=s; Z.tx=(W-r[2]*s)/2-r[0]*s; Z.ty=-r[1]*s; }
  else { const s=Math.min(W/r[2],H/r[3]); Z.s=s; Z.tx=(W-r[2]*s)/2-r[0]*s; Z.ty=(H-r[3]*s)/2-r[1]*s; }
  OTWH=otwH; ST.style.setProperty('--vpt',otwH+'px'); ST.style.setProperty('--otwh',(otwH+2)+'px');
  ST.classList.toggle('noout',otwH<8); Z.free=false; ST.classList.toggle('zoomed',Z.reg!=='main');
  VPW=W; VPH=H-otwH; apply(instant);
  if(window.OTW&&OTW.frame&&otwH>8) OTW.frame({lip:otwH,nose:6,cx:W*((236-0)*Z.s+Z.tx)/W});
  document.querySelectorAll('.vseg .cb').forEach(b=>b.classList.toggle('on',b.dataset.v===Z.reg));
  const zs=$('zoomSel'); if(zs&&zs.value!==Z.reg) zs.value=Z.reg;
}
function apply(instant){ WORLD.classList.toggle('anim',!instant); WORLD.style.transform=`translate(${Z.tx.toFixed(1)}px,${Z.ty.toFixed(1)}px) scale(${Z.s.toFixed(4)})`; hiRes(); fitSoon(); }
let fitT=0; function fitSoon(){ clearTimeout(fitT); fitT=setTimeout(()=>{ DISP.forEach(d=>{ d.t=99; }); OV.forEach(c=>{ if(c.t==='fcu') c.sig=''; }); },360); }
function hiRes(){ const need=Z.s*(devicePixelRatio||1)>1.55; const img=$('deck'); const src=need?'img/cockpits/a320-deck-3000.webp':'img/cockpits/a320-deck-1500.webp'; if(need&&!img.src.endsWith('3000.webp')){ const im=new Image(); im.decoding='async'; im.src=src; im.decode().then(()=>{ img.src=src; }).catch(()=>{}); } }
function view(r){ if(!REG[r]) return; Z.reg=r; if(D3&&CK&&CK.LOOK[r]) CK.LOOK[r](); layout(false); }
new ResizeObserver(()=>layout(true)).observe(ST);
document.querySelectorAll('.vseg .cb').forEach(b=>b.onclick=()=>view(b.dataset.v));
$('zBack').onclick=()=>view('main');
{ const zs=$('zoomSel'); Object.keys(REGN).forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=T(REGN[k]); zs.appendChild(o); }); zs.onchange=()=>view(zs.value); }
// free zoom: wheel (not on a control) and pinch; drag to pan when zoomed
function toWorld(cx,cy){ const b=VP.getBoundingClientRect(); return [(cx-b.left-Z.tx)/Z.s,(cy-b.top-Z.ty)/Z.s]; }
function zoomAt(cx,cy,f){ const b=VP.getBoundingClientRect(), px=cx-b.left, py=cy-b.top; const ns=clamp(Z.s*f,fitScale()*0.9,fitScale()*6); const k=ns/Z.s; Z.tx=px-(px-Z.tx)*k; Z.ty=py-(py-Z.ty)*k; Z.s=ns; Z.free=true; ST.classList.add('zoomed'); clampPan(); apply(true); }
function fitScale(){ const r=REG[Z.reg]; return Math.min(VPW/r[2],VPH/r[3]); }
function clampPan(){ const w=SHEET.W*Z.s, h=SHEET.H*Z.s; Z.tx=clamp(Z.tx,Math.min(0,VPW-w)-VPW*0.3,VPW*0.3); Z.ty=clamp(Z.ty,Math.min(0,VPH-h)-VPH*0.3,VPH*0.3); }

/* ================= pointer: controls ================= */
function hit(wx,wy){
  let best=null, ba=1e9;
  for(const c of CT){ const r=c.r; if(!r) continue; const pad=c.t==='mkey'?0.4:1.2; if(wx<r[0]-pad||wx>r[0]+r[2]+pad||wy<r[1]-pad||wy>r[1]+r[3]+pad) continue; if(c.t==='ann'&&!c.click) continue; if(c.t==='seg'||c.t==='fcu'||c.t==='gearInd') continue; const a=r[2]*r[3]; if(a<ba){ ba=a; best=c; } }
  return best; }
const ptrs=new Map(); let drag=null, pinch=null;
function pickW(e){ if(!D3) return toWorld(e.clientX,e.clientY); if(!CK) return [-1,-1]; const b=ST.getBoundingClientRect(); return CK.pick(((e.clientX-b.left)/b.width)*2-1,-(((e.clientY-b.top)/b.height)*2-1))||[-1,-1]; }
if(D3){ const PT=ST;
  PT.addEventListener('pointerdown',e=>{ if(e.target.closest('button,select,a,input,.more,.pill,.tpad,.tring')) return; ctx(); if(AC&&AC.state==='suspended') AC.resume();
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(ptrs.size===2){ const p=[...ptrs.values()]; pinch={d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)}; drag=null; return; }
    const [wx,wy]=pickW(e); const c=hit(wx,wy); try{ PT.setPointerCapture(e.pointerId); }catch(_){}
    if(c){ e.preventDefault(); drag={c,x0:e.clientX,y0:e.clientY,wx,wy,moved:false,acc:0}; press(c,wx,wy,e); } else drag={look:true,x:e.clientX,y:e.clientY}; });
  PT.addEventListener('pointermove',e=>{ if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&ptrs.size===2){ const p=[...ptrs.values()], d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y); if(d>10&&CK){ CK.zoom(pinch.d/d); pinch.d=d; } return; }
    if(!drag){ if(e.pointerType==='mouse'){ const [wx,wy]=pickW(e); const c=hit(wx,wy); PT.style.cursor=c?'pointer':'grab'; } return; }
    if(drag.look){ if(CK) CK.drag(e.clientX-drag.x,e.clientY-drag.y); drag.x=e.clientX; drag.y=e.clientY; return; }
    dragCtl(drag,e,e.clientX-drag.x0,e.clientY-drag.y0); });
  const end=e=>{ ptrs.delete(e.pointerId); if(ptrs.size<2) pinch=null; if(drag){ if(drag.c) release(drag.c,drag); drag=null; } };
  PT.addEventListener('pointerup',end); PT.addEventListener('pointercancel',end);
  PT.addEventListener('wheel',e=>{ if(e.target.closest('.more,.drawer')) return; e.preventDefault(); const [wx,wy]=pickW(e); const c=hit(wx,wy);
    if(c&&(c.t==='knob'||c.t==='sel'||c.t==='selF'||c.t==='cont'||c.t==='thr')){ turn(c,e.deltaY<0?1:-1,e.shiftKey); dirty.all=true; return; } if(CK) CK.zoom(e.deltaY<0?0.9:1.11); },{passive:false}); }
VP.addEventListener('pointerdown',e=>{
  ctx(); if(AC&&AC.state==='suspended') AC.resume();
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){ const p=[...ptrs.values()]; pinch={d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),cx:(p[0].x+p[1].x)/2,cy:(p[0].y+p[1].y)/2}; if(drag&&drag.c) drag.c.up&&0; drag=null; return; }
  const [wx,wy]=toWorld(e.clientX,e.clientY); const c=hit(wx,wy);
  try{ VP.setPointerCapture(e.pointerId); }catch(_){}
  if(c){ e.preventDefault(); drag={c,x0:e.clientX,y0:e.clientY,wx,wy,moved:false,t0:performance.now(),acc:0}; press(c,wx,wy,e); }
  else drag={pan:true,x0:e.clientX,y0:e.clientY,tx:Z.tx,ty:Z.ty,moved:false};
});
VP.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size===2){ const p=[...ptrs.values()], d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y); if(d>10){ zoomAt(pinch.cx,pinch.cy,d/pinch.d); pinch.d=d; } return; }
  if(!drag){ hover(e); return; }
  const dx=e.clientX-drag.x0, dy=e.clientY-drag.y0; if(Math.hypot(dx,dy)>4) drag.moved=true;
  if(drag.pan){ if(drag.moved){ Z.tx=drag.tx+dx; Z.ty=drag.ty+dy; Z.free=true; ST.classList.add('zoomed'); clampPan(); apply(true); } return; }
  dragCtl(drag,e,dx,dy);
});
const endP=e=>{ ptrs.delete(e.pointerId); if(ptrs.size<2) pinch=null; if(drag){ if(drag.c) release(drag.c,drag); drag=null; } };
VP.addEventListener('pointerup',endP); VP.addEventListener('pointercancel',endP);
VP.addEventListener('dblclick',e=>{ const [wx,wy]=toWorld(e.clientX,e.clientY); if(hit(wx,wy)) return; if(Z.free) layout(false); else zoomAt(e.clientX,e.clientY,2); });
VP.addEventListener('wheel',e=>{ const [wx,wy]=toWorld(e.clientX,e.clientY); const c=hit(wx,wy); e.preventDefault();
  if(c&&(c.t==='knob'||c.t==='sel'||c.t==='selF'||c.t==='cont'||c.t==='thr')){ const d=e.deltaY<0?1:-1; turn(c,d,e.shiftKey); dirty.all=true; return; }
  zoomAt(e.clientX,e.clientY,e.deltaY<0?1.15:1/1.15); },{passive:false});
function guardOK(c){ if(!c.guard) return true; const t=performance.now(); if(c.gOpenT&&t-c.gOpenT<4000){ c.gOpenT=0; return true; } c.gOpenT=t; tip(c,'Guard lifted: click again'); return false; }
function press(c,wx,wy,e){
  const r=c.r, fx=(wx-r[0])/r[2], fy=(wy-r[1])/r[3];
  snd('click');
  switch(c.t){
    case 'pb': if(!guardOK(c)) break; if(c.on) c.on(); else if(c.once){ A.sw[c.k]=1; } else A.sw[c.k]=A.sw[c.k]?0:1; tip(c); break;
    case 'mom': if(!guardOK(c)) break; if(c.down) c.down(); if(c.k){ if(c.latch) A.sw[c.k]=1; else A.sw[c.k]=1; } break;
    case 'ann': if(c.click) c.click(); break;
    case 'act': c.on(); tip(c); break;
    case 'bar': c.on(); tip(c); break;
    case 'key': c.on(); break;
    case 'mkey': { const ch=MC.key(K,c.k,M,A,mcApi); dirty.all=true; break; }
    case 'sel': { const n=c.pos.length; A.sw[c.k]=clamp(A.sw[c.k]+(fx<0.5?-1:1),0,n-1); tip(c); break; }
    case 'selF': { const n=c.pos.length; c.set(clamp(c.get()+(fx<0.5?-1:1),0,n-1)); tip(c); break; }
    case 'cont': { A.sw[c.k]=clamp(+(A.sw[c.k]+(fx<0.5?-c.step:c.step)).toFixed(2),c.lo,c.hi); break; }
    case 'knob': if(fy<0.5) c.pull&&c.pull(); else c.push&&c.push(); tip(c); break;
    case 'tog': { const n=c.vals.length, cur=c.get?c.get():A.sw[c.k], i=c.vals.indexOf(cur); let ni;
      const f=c.horiz?fx:fy;
      if(n===2) ni=i===0?1:0; else ni=f<0.36?0:f>0.64?2:1;
      if(c.horiz&&n===3) ni=f<0.36?2:f>0.64?0:1;
      const v=c.vals[ni]; if(c.set) c.set(v); else A.sw[c.k]=v; tip(c); break; }
    case 'lever': lever(c,fy); break;
    case 'thr': drag.thr=true; drag.tla0=UI.tla[c.i]; drag.both=!e.shiftKey; break;
    case 'stick': drag.stick=true; break;
    case 'tiller': drag.tiller=true; break;
  }
  dirty.all=true;
}
function release(c,dr){
  if(c.t==='mom'){ if(c.k&&!c.latch) A.sw[c.k]=0; if(c.k==='apuS') A.sw.apuS=0; }
  if(c.t==='stick'){ UI.inp.stick=null; }
  if(c.t==='tiller'){ UI.inp.tiller=0; }
  dirty.all=true;
}
function dragCtl(dr,e,dx,dy){
  const c=dr.c;
  if(c.t==='thr'){ const h=c.r[3]*Z.s; let v=clamp(dr.tla0-dy/h*80,M.gnd?-20:0,45); for(const d of [0,25,35,45]) if(Math.abs(v-d)<2.2) v=d; if(dr.both) UI.tla=[v,v]; else UI.tla[c.i]=v; return; }
  if(c.t==='stick'){ const R=40; UI.inp.stick={x:clamp(dx/R,-1,1),y:clamp(dy/R,-1,1)}; return; }
  if(c.t==='tiller'){ UI.inp.tiller=clamp(dx/60,-1,1); return; }
  if(c.t==='knob'||c.t==='sel'||c.t==='selF'||c.t==='cont'){ dr.acc+=e.movementX||0; const step=14; while(Math.abs(dr.acc)>=step){ const d=Math.sign(dr.acc); dr.acc-=d*step; turn(c,d,false); } }
}
function turn(c,d,big){
  if(c.t==='knob'){ c.turn&&c.turn(d*(big?10:1)); tip(c); }
  else if(c.t==='sel'){ A.sw[c.k]=clamp(A.sw[c.k]+d,0,c.pos.length-1); tip(c); }
  else if(c.t==='selF'){ c.set(clamp(c.get()+d,0,c.pos.length-1)); tip(c); }
  else if(c.t==='cont'){ A.sw[c.k]=clamp(+(A.sw[c.k]+d*c.step).toFixed(2),c.lo,c.hi); }
  else if(c.t==='thr'){ UI.tla=UI.tla.map(v=>clamp(v+d*2.5,M.gnd?-20:0,45)); }
}
function lever(c,fy){
  if(c.kind==='gear'){ A.sw.gearLv=A.sw.gearLv?0:1; say('Gear lever '+(A.sw.gearLv?'DOWN':'UP')); }
  if(c.kind==='flaps'){ A.sw.flapLv=clamp(A.sw.flapLv+(fy<0.5?-1:1),0,4); flapSay(); }
  if(c.kind==='spd'){ if(fy<0.25){ A.sw.spArm=A.sw.spArm?0:1; if(A.sw.spArm) A.sw.spdBrk=0; } else { A.sw.spArm=0; A.sw.spdBrk=clamp(+(A.sw.spdBrk+(fy<0.6?-0.5:0.5)).toFixed(1),0,1); } }
  if(c.kind==='park'){ A.sw.park=A.sw.park?0:1; say('Parking brake '+(A.sw.park?'ON':'OFF')); }
}
/* tooltips: what a control is and what it is set to */
const TIP=$('tip'); let tipT=0;
function tipText(c){ const n=c.id.split('|')[1];
  if(c.t==='sel') return n+': '+c.pos[A.sw[c.k]];
  if(c.t==='selF') return n+': '+c.pos[c.get()];
  if(c.t==='tog'){ const v=c.get?c.get():A.sw[c.k]; return n+': '+(c.lab?c.lab[c.vals.indexOf(v)]:v); }
  if(c.t==='knob'&&c.tip) return c.tip();
  if(c.t==='cont') return n+': '+Math.round(18+12*A.sw[c.k])+' °C';
  if(c.t==='pb'&&c.k) return n+': '+(A.sw[c.k]?(c.dn&&c.dn[0]==='ON'?'ON':'ON / AUTO'):'OFF');
  return n; }
function tip(c,txt){ if(!c.r) return; if(D3){ TIP.textContent=txt||tipText(c); TIP.hidden=false; TIP.style.left='50%'; TIP.style.top='12px'; TIP.style.transform='translateX(-50%)'; clearTimeout(tipT); tipT=setTimeout(()=>TIP.hidden=true,1800); return; } TIP.textContent=txt||tipText(c); TIP.hidden=false; const b=VP.getBoundingClientRect(), sb=ST.getBoundingClientRect();
  const x=c.r[0]*Z.s+Z.tx+b.left-sb.left, y=c.r[1]*Z.s+Z.ty+b.top-sb.top; TIP.style.left=Math.round(clamp(x,4,sb.width-200))+'px'; TIP.style.top=Math.round(Math.max(4,y-26))+'px'; clearTimeout(tipT); tipT=setTimeout(()=>TIP.hidden=true,1800); }
let hovC=null; function hover(e){ if(e.pointerType!=='mouse') return; const [wx,wy]=toWorld(e.clientX,e.clientY); const c=hit(wx,wy); VP.style.cursor=c?(c.t==='thr'?'ns-resize':c.t==='knob'||c.t==='sel'||c.t==='selF'?'ew-resize':'pointer'):(Z.free?'grab':'default'); if(c!==hovC){ hovC=c; if(c&&c.t!=='mkey') tip(c); } }
const mcApi={say:m=>say(m),perf:d=>{ const a=M.ap; if(d.v1) a.v1=d.v1; if(d.vr) a.vr=d.vr; if(d.v2) a.v2=d.v2; a.thrRed=d.thrRed; a.acc=d.acc; M.flx=d.flex||0; if(d.ldgConf) A.sw.ldgF3=d.ldgConf==='3'?1:0; },weights:d=>{ if(d.zfw) A.zfw=d.zfw; },dirTo:()=>{ if(!M.gnd){ M.ap.lat='NAV'; M.ap.latArm=''; M.ap.hdg.preset=false; } }};

/* ================= flight-control pads below the cockpit ================= */
(function(){ const st=$('stick'); if(!st) return; const dot=st.querySelector('.dot'); let id=null;
  const mv=e=>{ const b=st.getBoundingClientRect(), R=b.width/2; let x=(e.clientX-b.left-R)/R, y=(e.clientY-b.top-R)/R; const m=Math.hypot(x,y); if(m>1){ x/=m; y/=m; } UI.inp.stick={x,y}; dot.style.transform=`translate(${x*R*0.75}px,${y*R*0.75}px)`; };
  st.addEventListener('pointerdown',e=>{ id=e.pointerId; st.setPointerCapture(id); mv(e); }); st.addEventListener('pointermove',e=>{ if(e.pointerId===id) mv(e); });
  const up=e=>{ if(e.pointerId!==id) return; id=null; UI.inp.stick=null; dot.style.transform=''; }; st.addEventListener('pointerup',up); st.addEventListener('pointercancel',up); })();
(function(){ const box=$('thrBox'); if(!box) return; const marks=[[45,'TOGA'],[35,'FLX/MCT'],[25,'CL'],[0,'IDLE'],[-20,'REV']];
  const yOf=v=>(1-(v+20)/65)*100;
  for(const i of [0,1]){ const lv=document.createElement('div'); lv.className='lv'; lv.innerHTML='<b></b>'+(i?marks.map(([v,t])=>`<span style="top:${yOf(v)}%">${t}</span>`).join(''):''); box.appendChild(lv);
    const b=lv.querySelector('b'); let id=null;
    const mv=e=>{ const r=lv.getBoundingClientRect(); let v=45-(e.clientY-r.top)/r.height*65; v=clamp(v,M.gnd?-20:0,45); for(const d of [0,25,35,45]) if(Math.abs(v-d)<2.5) v=d; UI.tla=[v,v]; };
    lv.addEventListener('pointerdown',e=>{ id=e.pointerId; lv.setPointerCapture(id); mv(e); }); lv.addEventListener('pointermove',e=>{ if(e.pointerId===id) mv(e); }); lv.addEventListener('pointerup',()=>id=null);
    lv._b=b; }
  setInterval(()=>{ box.querySelectorAll('.lv').forEach((lv,i)=>{ lv._b.style.top=`calc(${yOf(UI.tla[i])}% - 11px)`; }); },100); })();
{ const b=$('brk'); if(b){ const on=()=>{ UI.inp.brkHeld=true; }, off=()=>{ UI.inp.brkHeld=false; }; b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off); b.addEventListener('pointerleave',off); } }

/* ================= shell: toolbar, drawer panes, messages ================= */
function say(m,cls,ms){ if(SH&&SH.say) SH.say(T(m),cls||'',ms||3200); }
function setStat(){ const s=$('stat'); if(!s) return; const t=UI.crashed?T('Crashed'):UI.paused?T('Paused'):M.gnd?T('On ground'):T('Flying'); if(s.textContent!==t) s.textContent=t; s.className='status '+(UI.crashed?'bad':'ok'); }
function pause(){ UI.paused=!UI.paused; setStat(); if(CH) CH.sync(); }
let CH=null;
if(SH){ SH.init(); CH=SH.chrome({paused:()=>UI.paused,pause,restart:()=>reset(UI.start),sound:()=>UI.sound,setSound:v=>{ UI.sound=v; },refit:()=>layout(true)});
  SH.pane('fl',el=>{ const L_=[['eng1','Engine 1 failure'],['fire1','Engine 1 fire'],['fire2','Engine 2 fire'],['fireApu','APU fire'],['gen1','Generator 1'],['idg1','IDG 1 oil pressure'],['acBus1','AC BUS 1'],['bothGen','Both generators'],['hydG','Green hydraulics'],['hydY','Yellow hydraulics'],['edp1','Engine 1 pump (green)'],['fuelL1','Left tank pump 1'],['bleed1','Engine 1 bleed'],['pack1','Pack 1'],['elac1','ELAC 1'],['sec1','SEC 1'],['ir1','IR 1'],['decomp','Decompression'],['cabLeak','Slow cabin leak']];
    el.innerHTML='<div class="sgrp">'+T('Failures')+'</div><div class="fbtns">'+L_.map(([k,t])=>`<button type="button" data-f="${k}" class="${A.fail[k]?'on':''}">${t}</button>`).join('')+'<button type="button" class="rs" data-f="__clr">Clear all failures</button></div>';
    el.querySelectorAll('button').forEach(b=>b.onclick=()=>{ const k=b.dataset.f; if(k==='__clr'){ A.fail={}; A.idgOK=[true,true]; A.eng.forEach(e=>{ e.fail=false; e.fire=false; }); A.apu.fire=false; A.irs.forEach(r=>{ if(r.st===4) r.st=0; }); } else { A.fail[k]=!A.fail[k]; if(k==='decomp'&&A.fail[k]) say('Decompression'); }
      el.querySelectorAll('button[data-f]').forEach(x=>x.classList.toggle('on',!!A.fail[x.dataset.f])); }); });
  SH.pane('sp',el=>{ const s=M.spds||{}; const r=(t,v)=>`<div class="row"><span>${t}</span><b>${v==null?'—':Math.round(v)+' kt'}</b></div>`;
    el.innerHTML='<div class="sgrp">Speeds at '+(A.gw/1000).toFixed(1)+' t</div>'+r('V1',K.d.v1)+r('VR',K.d.vr)+r('V2',K.d.v2)+r('VS1G (this config)',s.vs1g)+r('VLS',s.vls)+r('F',s.F)+r('S',s.S)+r('Green dot',s.gd)+r('VFE (this config)',s.vfe)+r('VMO','350')+'<p class="pdisc">MMO 0.82. VLE 280 kt, VLO 250 kt (retraction 220 kt). VFE: 1 230, 1+F 215, 2 200, 3 185, FULL 177 kt.</p>'; });
}
$('apSel').value=UI.start; $('apSel').onchange=()=>reset($('apSel').value);
$('bOtw').onclick=()=>{ UI.otw=UI.otw===false; $('bOtw').setAttribute('aria-pressed',UI.otw!==false); layout(true); };
$('bAlign').onclick=()=>{ UI.fastAlign=!UI.fastAlign; A.alignK=UI.fastAlign?20:1; $('bAlign').setAttribute('aria-pressed',UI.fastAlign); say(UI.fastAlign?'ADIRS align in about 20 s':'ADIRS align in 7 min, as in the aircraft'); };
$('bPerf').onclick=()=>{ const p=$('perfm'); p.hidden=!p.hidden; $('bPerf').setAttribute('aria-pressed',!p.hidden); };
$('bHelp').onclick=()=>{ if(SH&&SH.help) SH.help(); };
if(SH&&SH.touch) SH.touch({stage:ST,stick:v=>{ UI.inp.stick=v; },rud:v=>{ UI.inp.rud=v; }});

/* ================= outside view ================= */
let otwReady=false;
function hasWebGL(){ try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); }catch(e){ return false; } }
let CK=null;
(window.requestIdleCallback||setTimeout)(()=>{ try{ otwReady=!!(window.OTW&&window.THREE&&hasWebGL()&&OTW.init($('otw'))); }catch(e){ otwReady=false; } ST.classList.toggle('otwlive',otwReady);
  if(D3){ if(otwReady&&window.A3D){ try{ CK=A3D.init({R:OTW.renderer(),displays:DISP.filter(d=>d.cv),aspect:()=>ST.clientWidth/Math.max(1,ST.clientHeight)});
      const im=new Image(); im.decoding='async'; im.src=matchMedia('(pointer:coarse)').matches?'img/cockpits/a320-deck-1500.webp':'img/cockpits/a320-deck-3000.webp'; im.decode().then(()=>{ CK.setImage(im); paint3d(true); }).catch(()=>{});
      if(CK.LOOK[Z.reg]) CK.LOOK[Z.reg](); }catch(err){ console.warn('A320 3D',err); CK=null; } }
    if(!CK){ $('otwMsg')&&($('otwMsg').hidden=false); } }
  layout(true); },{timeout:500});
const otwS={N:0,E:0,h:0,th:0,phi:0,psi:0};
let otwSkip=0;
let d3Last=0;
function otwTick(){
  if(D3){ if(!CK||document.hidden) return; const now=performance.now(), dt=d3Last?Math.min(0.1,(now-d3Last)/1000):0.016; d3Last=now; CK.updCam(dt);
    const c=Math.cos(M.psi), s=Math.sin(M.psi), hx=CK.cam.position, fw=5-hx.z; otwS.N=M.N+fw*c-hx.x*s; otwS.E=M.E+fw*s+hx.x*c; otwS.h=M.h+3.7-1.55+(hx.y-0.63); otwS.th=M.th; otwS.phi=M.phi; otwS.psi=M.psi;
    const dpr=Math.min(devicePixelRatio||1,[1.5,1.15,0.8][GOV.lvl]); OTW.render3d(otwS,CK.qHead(),CK.fov(),dpr,R=>CK.draw(R)); if(GOV.lvl!==(OTW.lvl||0)) OTW.quality(GOV.lvl===2?2:GOV.lvl>0); return; }
  if(!otwReady||OTWH<8||UI.otw===false||document.hidden) return; const n=GOV.lvl+1; if(n>1&&(++otwSkip%n)) return;
  const c=Math.cos(M.psi), s=Math.sin(M.psi); otwS.N=M.N+5*c+0.5*s; otwS.E=M.E+5*s-0.5*c; otwS.h=M.h+2.3; otwS.th=M.th; otwS.phi=M.phi; otwS.psi=M.psi; OTW.render(otwS,''); if(GOV.lvl!==(OTW.lvl||0)) OTW.quality(GOV.lvl===2?2:GOV.lvl>0); }

/* ================= frame governor and loop ================= */
const GOV={lvl:0,ft:16,t:0,tick(dt){ this.ft+=((dt*1000||16)-this.ft)*0.05; this.t+=dt; if(this.t<2) return; if(this.lvl<2&&this.ft>(this.lvl?40:22)){ this.lvl++; this.t=0; } else if(this.lvl>0&&this.t>10&&this.ft<(this.lvl>1?24:14)){ this.lvl--; this.t=0; } }};
window.SIMGOV=GOV;
new IntersectionObserver(es=>{ cockpitVis=es[0].isIntersecting; }).observe($('cockpit'));
let last=0, ovT=0, statT=0, fpsN=0, fpsT=0, fpsMs=0;
function frame(t){
  const dt=last?Math.min(0.1,(t-last)/1000):0.016; last=t;
  const t0=performance.now();
  if(!document.hidden){
    simTick(dt); soundTick(dt);
    if(cockpitVis){ otwTick(); displayTick(dt); ovT+=dt; if(ovT>0.1||dirty.all){ ovT=0; dirty.all=false; overlayTick(); } }
    statT+=dt; if(statT>0.5){ statT=0; setStat(); }
    GOV.tick(dt);
    fpsN++; fpsT+=dt; fpsMs+=performance.now()-t0; if(fpsT>1){ const p=$('perfm'); if(!p.hidden) p.textContent=`${Math.round(fpsN/fpsT)} fps · ${(fpsMs/fpsN).toFixed(1)} ms/frame\nquality level ${GOV.lvl}`; fpsN=0; fpsT=0; fpsMs=0; }
  }
  requestAnimationFrame(frame);
}

/* ================= start ================= */
reset(UI.start);
defs(); buildOverlay(); layout(true);
requestAnimationFrame(frame);
window.__a320={get CK(){ return CK; },get A(){ return A; },get M(){ return M; },get K(){ return K; },reset,view,UI,GOV,fast(sec){ for(let i=0;i<sec*20;i++) simTick(0.05); }};
})();
