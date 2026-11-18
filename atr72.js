/* NORDAP – ATR 72 cockpit procedure trainer: the aircraft configuration (atr72.html). It runs on the same engine as the A320
   and 737 trainers (a320-app.js: panel, zoom, overlay, outside view; a320sys.js: system logic; a320fm.js: point-mass flight
   model and autopilot) and gives it the ATR 72-500: the rendered flight deck (FlightGear ATR 72-500, GPL-3.0), its overhead
   pushbuttons with the dark-cockpit lights, two PW127 turboprops run by power levers (PL) and condition levers (CL), the
   propeller brake for hotel mode, the AFCS with its ADU, the EADI and EHSI, the round engine gauges, the crew alerting panel
   and the flaps 0 / 15 / 30 (atr72disp.js draws the instruments).
   What maps to what on the shared logic: DC generators ↔ GEN 1 / 2, DC external power ↔ ground power, blue / green
   hydraulic pumps ↔ the two systems, fuel pumps 1 / 2 ↔ the wing tank pumps, bleeds and packs as they are. The PW127 is
   started electrically (the starter-generator): the trainer gives the shared starter its air while START is selected. */
(function(){
'use strict';
const clamp=(x,a,b)=>x<a?a:x>b?b:x, w360=a=>{ a%=360; return a<0?a+360:a; }, lag=(v,t,tau,dt)=>v+(t-v)*Math.min(1,dt/Math.max(1e-3,tau));
const KT=0.514444, FT=0.3048, FPM=0.00508, NM=1852, D2R=Math.PI/180, R2D=180/Math.PI;
const DSP=window.ATR72DISP;
/* flaps: the lever has 0, 15 and 30; on the shared aerodynamics they are configurations 0, 2 and 4 */
const FLAPS=[0,15,30], FLAPCONF=[0,2,4], VFE=[null,185,150];
/* power lever (TLA on the shared scale): ground idle 0, flight idle 8, the notch (rated power for the PWR MGT setting) 35, the ramp 45 */
const PL={GI:0,FI:8,NOTCH:35,RAMP:45};
const CLP=['FUEL SO','FTR','AUTO','MAX RPM'];
const PWR=['TO','MCT','CLB','CRZ'], TQREF={TO:90,MCT:90.9,CLB:80.6,CRZ:75.6};
const B={};
function bReset(cold){ Object.assign(B,{flap:0,cl:cold?[0,0]:[2,2],pbrk:cold?0:0,gust:cold?1:0,startSel:0,startPb:[0,0],np:[0,0],pwr:0,eec:[1,1],atpcs:1,
  yd:!cold,bank:0,cpl:0,crs:[360,360],mins:200,trimT:0,recallT:0,toInhi:0,probe:cold?[0,0,0]:[1,1,1],wsh:cold?[0,0]:[1,1],
  ai:{p1:0,p2:0,horns:0,side:cold?0:1,mode:0},di:{e1:0,e2:0,afr:0,mode:0},lp:[1,1],acwBtc:1,dcBtc:1,acwGen:[1,1],emerBat:0,anti:1,fdb:[1,1],
  nav:['109.50','110.30'],com:['118.700','121.800'],cab:0,iceT:0,fuelTest:0,oxy:cold?0:1,signs:{smk:cold?0:2,belts:cold?0:2,emer:1},hotel:false});
  UIb(); }
let X=null, UI=null;
function UIb(){ if(!UI) return; UI.efis={mode:0,range:2,qnh:1013,std:false}; UI.efis2=Object.assign({},UI.efis); }
/* ---------------- power: the levers are the pilot's (no autothrottle on the ATR) ---------------- */
function tla(){ const r=[0,1].map(i=>{ let v=UI.tla[i]; if(B.cl[i]<2) v=Math.min(v,PL.GI); /* feathered: no thrust */ if(B.gust&&v>PL.FI) v=PL.FI; return v; }); return r; }
function thrF(i){ const e=X.A.eng[i]; if(!e.run) return 0; return clamp((e.n1-21)/(100-21),0,1); }
function tq(i){ const e=X.A.eng[i]; if(!e.run||B.cl[i]<2&&!(B.hotel&&i===1)) return e.run?3:0; if(i===1&&B.pbrk) return 0; const np=B.np[i]/100; return clamp(thrF(i)*104*(0.85+0.15*np)+(X.M.gnd?2:4),0,125); }
/* ---------------- AFCS: modes on the shared autopilot, shown on the ADU ---------------- */
function afcs(){ const a=X.M.ap, M=X.M, ra=M.ra/FT;
  let lat='', latA='', vert='', vertA='';
  switch(a.lat){ case 'HDG': case 'TRK': lat=a.hdgHold?'HDG HLD':'HDG SEL'; break; case 'NAV': lat='NAV'; break; case 'LOC*': lat='LOC*'; break; case 'LOC': case 'LAND': case 'FLARE': case 'ROLL OUT': lat='LOC'; break; case 'GA TRK': lat='GA'; break; }
  if(a.latArm==='NAV') latA='NAV'; if(a.latArm==='LOC') latA='LOC';
  switch(a.vert){ case 'OP CLB': case 'OP DES': case 'CLB': case 'DES': vert='IAS '+Math.round(a.spd.v||M.ias); break; case 'V/S': case 'FPA': vert='VS '+(a.vs.v>0?'+':'')+Math.round(a.vs.v); break;
    case 'ALT*': case 'ALT CST*': vert='ALT*'; break; case 'ALT': case 'ALT CST': vert='ALT'; break; case 'G/S*': vert='GS*'; break; case 'G/S': case 'LAND': case 'FLARE': vert='GS'; break; case 'SRS': vert='GA'; break; }
  if(B.pitchHold&&!a.vert) vert='PITCH HLD';
  if(a.vertArm&&a.vertArm.includes('G/S')) vertA='GS'; else if(a.vert&&a.vert!=='ALT'&&a.vert!=='ALT*'&&!a.vert.startsWith('G/S')&&Math.abs(a.alt.v-M.h/FT)>150) vertA='ALT*';
  return {lat,latA,vert,vertA,ap:!!(a.ap1||a.ap2),yd:B.yd,bank:B.bank,cpl:B.cpl?'2':'1',altSel:a.alt.v,apOff:UI.apOffT>0}; }
/* ---------------- controls ---------------- */
function defs(x){
  const S_=k=>X.A.sw[k], A=()=>X.A, ap=()=>X.M.ap, F=X.F, CT=X.CT;
  const pw=()=>X.A.dc;
  const off=k=>['OFF','w',()=>pw()&&!S_(k)];
  const pbB=(id,get,set,up,dn,o)=>X.pb(id,null,up,dn,Object.assign({on:()=>{ set(!get()); }},o||{}));
  const sw=(id,get,set,vals,lab,o)=>X.tog(id,null,vals||[1,0],Object.assign({get,set,lab:lab||['ON','OFF']},o||{}));
  // ---- fire ----
  for(const n of [1,2]){ const i=n-1;
    X.mom('ENG '+n+' FIRE|ENG '+n+' AGENT 1','ag'+n+'1',['SQUIB','w',()=>S_('fireP'+n)&&!S_('ag'+n+'1')],['DISCH','a',()=>!!S_('ag'+n+'1')],{latch:true,down:()=>{ X.A.sw['fireP'+n]=1; B.lp[i]=0; }});
    X.mom('ENG '+n+' FIRE|ENG '+n+' AGENT 2','ag'+n+'2',['SQUIB','w',()=>S_('fireP'+n)&&!S_('ag'+n+'2')],['DISCH','a',()=>!!S_('ag'+n+'2')],{latch:true,down:()=>{ X.A.sw['fireP'+n]=1; B.lp[i]=0; }});
    X.ann('ENG '+n+' FIRE|ENG '+n+' LOOP A',null,['LOOP','a',()=>false],{cls:'big'}); X.ann('ENG '+n+' FIRE|ENG '+n+' LOOP B',null,['LOOP','a',()=>false],{cls:'big'});
    X.mom('ENG '+n+' FIRE|ENG '+n+' SQUIB TEST','sqT'+n,null,null); X.mom('ENG '+n+' FIRE|ENG '+n+' FAULT TEST','fireT'+n,null,null); }
  // ---- hydraulics ----
  X.pb('HYD PWR|BLUE PUMP','hyE1',['LO PR','a',()=>pw()&&S_('hyE1')&&X.A.hyd.g<1500],off('hyE1'));
  X.pb('HYD PWR|GREEN PUMP','hyE2',['LO PR','a',()=>pw()&&S_('hyE2')&&X.A.hyd.y<1500],off('hyE2'));
  X.pb('HYD PWR|AUX PUMP','hyY',['LO PR','a',()=>false],['ON','b',()=>pw()&&!!S_('hyY')]);
  X.ann('HYD PWR|HYD X FEED',null,['ON','b',()=>pw()&&!!B.xf],{click:()=>{ B.xf=B.xf?0:1; X.snd('click'); }});
  // ---- DC electrics ----
  X.pb('MAIN ELEC PWR|DC GEN 1','gen1',['FAULT','a',()=>pw()&&S_('gen1')&&!X.A.eng[0].run],off('gen1'));
  X.pb('MAIN ELEC PWR|DC GEN 2','gen2',['FAULT','a',()=>pw()&&S_('gen2')&&!X.A.eng[1].run],off('gen2'));
  X.pb('MAIN ELEC PWR|DC EXT PWR','ext',['AVAIL','g',()=>X.A.gpu&&!S_('ext')],['ON','b',()=>!!S_('ext')],{on:()=>{ if(!X.A.gpu){ X.say('No external power connected'); return; } X.A.sw.ext=X.A.sw.ext?0:1; }});
  pbB('MAIN ELEC PWR|DC BTC',()=>B.dcBtc,v=>{ B.dcBtc=v?1:0; X.A.sw.busTie=B.dcBtc; },['FAULT','a',()=>false],['ISOL','w',()=>pw()&&!B.dcBtc]);
  sw('MAIN ELEC PWR|BAT SEL',()=>S_('bat1')?1:0,v=>{ X.A.sw.bat1=X.A.sw.bat2=v; },[1,0],['ON','OFF']);
  X.pb('MAIN ELEC PWR|BAT','bat1',['FAULT','a',()=>false],['OFF','w',()=>!S_('bat1')],{on:()=>{ const v=X.A.sw.bat1?0:1; X.A.sw.bat1=X.A.sw.bat2=v; }});
  for(const [id,f] of [['DC BUS 1',()=>!X.A.bus.dc1],['DC BUS 2',()=>!X.A.bus.dc2],['DC BUS 2 OFF',()=>!X.A.bus.dc2],['EMER BUS / ESS BUS',()=>!X.A.bus.dcEss],['STBY BUS',()=>!X.A.bus.dcEss],['AC BUS 1',()=>!X.A.bus.ac1],['AC BUS 2',()=>!X.A.bus.ac2],['TRU',()=>false]])
    X.ann('MAIN ELEC PWR|'+id,null,[id.replace(' / ','/')+'\nOFF','a',()=>pw()&&f()],{cls:'big'});
  X.pb('MAIN ELEC PWR|EMER BAT CHG',null,null,['OFF','w',()=>pw()&&!B.emerBat],{on:()=>{ B.emerBat=B.emerBat?0:1; }});
  X.ann('MAIN ELEC PWR|BAT AMP',null,['','a',()=>false]);
  X.pb('MAIN ELEC PWR|DC SVCE/UTLY BUS','galy',null,['SHED','a',()=>pw()&&!S_('galy')]);
  // ---- AC wild ----
  for(const [n,i] of [['1',0],['2',1]]){ pbB('AC WILD ELEC PWR|ACW GEN '+n,()=>B.acwGen[i],v=>{ B.acwGen[i]=v?1:0; },['FAULT','a',()=>pw()&&B.acwGen[i]&&!X.A.eng[i].run],['OFF','w',()=>pw()&&!B.acwGen[i]]);
    X.ann('AC WILD ELEC PWR|ACW BUS '+n,null,['ACW BUS '+n+'\nOFF','a',()=>pw()&&!(X.A.eng[i].run&&B.acwGen[i]||X.A.eng[1-i].run&&B.acwGen[1-i]&&B.acwBtc)]); }
  pbB('AC WILD ELEC PWR|ACW BTC',()=>B.acwBtc,v=>{ B.acwBtc=v?1:0; },null,['ISOL','w',()=>pw()&&!B.acwBtc]);
  X.pb('AC WILD ELEC PWR|ACW EXT PWR',null,['AVAIL','g',()=>false],null,{on:()=>X.say('No AC external power on this stand')});
  // ---- fuel ----
  X.pb('FUEL|FUEL PUMP 1','fL1',['LO PR','a',()=>pw()&&S_('fL1')&&!X.A.bus.ac1],['OFF','w',()=>pw()&&!S_('fL1')],{on:()=>{ const v=X.A.sw.fL1?0:1; X.A.sw.fL1=X.A.sw.fL2=v; }});
  X.pb('FUEL|FUEL PUMP 2','fR1',['LO PR','a',()=>pw()&&S_('fR1')&&!X.A.bus.ac2],['OFF','w',()=>pw()&&!S_('fR1')],{on:()=>{ const v=X.A.sw.fR1?0:1; X.A.sw.fR1=X.A.sw.fR2=v; }});
  X.pb('FUEL|FUEL X FEED','fX',null,['ON','b',()=>pw()&&!!S_('fX')]);
  for(const i of [0,1]) pbB('FUEL|ENG '+(i+1)+' LP VALVE',()=>B.lp[i],v=>{ B.lp[i]=v?1:0; },['FAULT','a',()=>false],['FULL\nCLOSED','w',()=>pw()&&!B.lp[i]]);
  X.ann('FUEL|L TANK LOW LEVEL',null,['LOW\nLEVEL','a',()=>pw()&&X.A.fuel.li<160]); X.ann('FUEL|R TANK LOW LEVEL',null,['LOW\nLEVEL','a',()=>pw()&&X.A.fuel.ri<160]);
  // ---- engine start ----
  X.CT.push({id:'ENG START|START SEL',t:'selF',get:()=>B.startSel,set:v=>{ B.startSel=v; if(v===0){ B.startPb=[0,0]; } },pos:['OFF/START ABORT','CRANK','START A','START B','START A&B'],ang:[-60,-30,0,30,60]});
  for(const i of [0,1]) X.pb('ENG START|START '+(i+1),null,['FAULT','a',()=>false],['ON','b',()=>pw()&&B.startPb[i]],{on:()=>{ if(B.startSel===0){ X.say('START SEL first'); return; } if(!X.A.bus.dcEss){ X.say('No DC power for the starter'); return; } B.startPb[i]=B.startPb[i]?0:1; if(B.startPb[i]) X.say('Start '+(i+1)+': NH rising. At 10 % NH, CL '+(i+1)+' to FTR'); }});
  X.pb('ENG START|MAN IGN','manIgn',null,['ON','b',()=>pw()&&!!S_('manIgn')]);
  // ---- propeller brake (hotel mode, engine 2) ----
  pbB('PROP BRAKE|PROP BRAKE',()=>B.pbrk,v=>{ if(v&&!(X.M.gnd&&B.gust&&B.cl[1]<=1&&UI.tla[1]<=PL.GI+0.5)){ X.say('Prop brake: needs the gust lock on, CL 2 at FTR or FUEL SO and PL 2 at GI'); return; } if(!v&&B.cl[1]===1&&X.A.eng[1].run){ X.say('Prop brake released: propeller 2 turns'); } B.pbrk=v?1:0; },null,['ON','b',()=>pw()&&B.pbrk],{guard:true});
  X.ann('PROP BRAKE|PROP BRAKE UNLOCK',null,['UNLK','a',()=>pw()&&B.pbrk&&B.np[1]>2]); X.ann('PROP BRAKE|PROP BRAKE FAIL',null,['READY','b',()=>pw()&&B.gust&&X.M.gnd&&B.cl[1]<=1&&UI.tla[1]<=PL.GI+0.5&&!B.pbrk]);
  // ---- bleed and packs ----
  X.pb('AIR BLEED|BLEED 1','eb1',['FAULT','a',()=>false],off('eb1')); X.pb('AIR BLEED|BLEED 2','eb2',['FAULT','a',()=>false],off('eb2'));
  X.pb('AIR BLEED|PACK 1','pk1',['FAULT','a',()=>pw()&&S_('pk1')&&X.A.fail.pack1],off('pk1')); X.pb('AIR BLEED|PACK 2','pk2',['FAULT','a',()=>pw()&&S_('pk2')&&X.A.fail.pack2],off('pk2'));
  pbB('AIR BLEED|BLEED X VALVE',()=>X.A.sw.xb===2,v=>{ X.A.sw.xb=v?2:1; },null,['OPEN','b',()=>pw()&&X.A.sw.xb===2]);
  X.CT.push({id:'COMPT TEMP|PACK FLOW',t:'selF',get:()=>X.A.sw.pkFlow||1,set:v=>{ X.A.sw.pkFlow=v; },pos:['LO','NORM','HIGH'],ang:[-45,0,45]});
  for(const [id,k] of [['COMPT TEMP|FLT COMPT TEMP SEL','tCk'],['COMPT TEMP|CABIN TEMP SEL','tFwd']]) X.CT.push({id,t:'cont',k,lo:0,hi:1,step:0.1,ang:v=>-135+v*270});
  for(const n of ['1','2']) X.pb('COMPT TEMP|RECIRC FAN '+n,null,['FAULT','a',()=>false],null,{on:()=>{}});
  X.CT.push({id:'CAB PRESS|CAB PRESS MODE SEL',t:'selF',get:()=>B.cab,set:v=>{ B.cab=v; X.A.sw.pressMode=v?0:1; },pos:['AUTO','MAN'],ang:[-30,30]});
  // ---- ice protection ----
  const ice=()=>B.iceT>0;
  for(const [id,k] of [['PROP 1 ANTI ICING','p1'],['PROP 2 ANTI ICING','p2'],['L ELEV HORNS','horns'],['R ELEV HORNS','horns'],['SIDE WINDOWS','side']]) pbB('ANTI ICING|'+id,()=>B.ai[k],v=>{ B.ai[k]=v?1:0; },['FAULT','a',()=>false],['ON','b',()=>pw()&&B.ai[k]]);
  pbB('ANTI ICING|ANTI ICING MODE SEL',()=>B.ai.mode,v=>{ B.ai.mode=v?1:0; },null,['MAN','w',()=>pw()&&B.ai.mode]);
  X.ann('ANTI ICING|MODE SEL AUTO',null,['AUTO','b',()=>pw()&&!B.ai.mode]);
  for(const [id,k] of [['ENG 1 DE ICING','e1'],['ENG 2 DE ICING','e2'],['AIRFRAME DE ICING','afr']]) pbB('DE ICING|'+id,()=>B.di[k],v=>{ B.di[k]=v?1:0; },['FAULT','a',()=>false],['ON','b',()=>pw()&&B.di[k]]);
  pbB('DE ICING|DE ICING MODE SEL',()=>B.di.mode,v=>{ B.di.mode=v?1:0; },null,['FAST','w',()=>pw()&&B.di.mode]);
  X.ann('DE ICING|AIRFRAME MODE',null,['NORM','b',()=>pw()&&!B.di.mode&&B.di.afr]); X.ann('DE ICING|AFR AIR BLEED',null,['FAULT','a',()=>pw()&&B.di.afr&&!(X.A.sw.eb1||X.A.sw.eb2)]);
  for(const [id,i] of [['PROBES HTG CAPT',0],['PROBES HTG STBY',1],['PROBES HTG F/O',2]]) pbB('PROBES / WINDSHIELD HTG|'+id,()=>B.probe[i],v=>{ B.probe[i]=v?1:0; X.A.sw.probe=B.probe[0]&&B.probe[2]?1:0; },['FAULT','a',()=>false],['OFF','w',()=>pw()&&!B.probe[i]]);
  for(const [id,i] of [['WINDSHIELD HTG L',0],['WINDSHIELD HTG R',1]]) pbB('PROBES / WINDSHIELD HTG|'+id,()=>B.wsh[i],v=>{ B.wsh[i]=v?1:0; },['FAULT','a',()=>false],['OFF','w',()=>pw()&&!B.wsh[i]]);
  // ---- lights and signs ----
  for(const [id,k] of [['BEACON','beacon'],['STROBE','strobe'],['TAXI & TO','nose'],['LAND L','landL'],['LAND R','landR'],['WING','wing']])
    sw('EXT LT|'+id,()=>S_(k)?1:0,v=>{ X.A.sw[k]=v?(k==='strobe'||k==='landL'||k==='landR'||k==='nose'?2:1):0; });
  sw('EXT LT|NAV',()=>S_('navLogo')?1:0,v=>{ X.A.sw.navLogo=v; }); sw('EXT LT|LOGO',()=>B.logo?1:0,v=>{ B.logo=v; });
  sw('SIGNS|NO SMOKING',()=>B.signs.smk,v=>{ B.signs.smk=v; X.A.sw.noSmk=v; },[2,1,0],['ON','AUTO','OFF']);
  sw('SIGNS|SEAT BELTS',()=>B.signs.belts,v=>{ B.signs.belts=v; X.A.sw.seatB=v?2:0; },[2,1,0],['ON','AUTO','OFF']);
  sw('SIGNS|EMER EXIT LT',()=>B.signs.emer,v=>{ B.signs.emer=v; },[2,1,0],['ON','ARM','DISARM']);
  X.pb('OXYGEN|OXY MAIN SUPPLY',null,['LO PR','a',()=>false],['OFF','w',()=>pw()&&!B.oxy],{on:()=>{ B.oxy=B.oxy?0:1; }});
  X.pb('OXYGEN|OXY PAX SUPPLY',null,null,['OFF','w',()=>false],{on:()=>{}});
  for(const [id,i] of [['CAPT WIPER',0],['F/O WIPER',1]]) X.CT.push({id:'WIPERS|'+id,t:'selF',get:()=>B['wip'+i]||0,set:v=>{ B['wip'+i]=v; },pos:['OFF','SLOW','FAST'],ang:[-40,0,40]});
  X.ann('LDG GEAR / DOORS|LDG GEAR LIGHTS',null,['','a',()=>false]);
  // covers for lights the model has painted on (the cockpit is dark when all is normal)
  for(const id of ['FLT CTL|MFC 1A','FLT CTL|MFC 1B','FLT CTL|MFC 2A','FLT CTL|MFC 2B','FLT CTL|SPLR','LDG GEAR / DOORS|DOORS FWD COMPT','LDG GEAR / DOORS|DOORS CABIN/CARGO','LDG GEAR / DOORS|DOORS EMER/SVCE',
    'COMPT SMK|AFT COMPT / LAV DET FANS','AVIONICS VENT|EXHAUST MODE','CALLS / SELCAL|ATTND CALL','CALLS / SELCAL|MECH CALL','CALLS / SELCAL|SELCAL EMER','CALLS / SELCAL|SELCAL'])
    X.ann(id,null,['','w',()=>false],{cls:'big'});
  X.ann('LDG GEAR / DOORS|DOORS CAB/SVCE OK',null,['CAB/SVCE\nOK','g',()=>pw()&&!X.M.gnd]);
  X.ann('FLT CTL|FLT CTL FAULT',null,['FAULT','a',()=>false],{cls:'big'});
  // probe heat fault lights above the CAPT / STBY / F/O probe pbs
  for(const [r,i,t] of [[[500,140,18.5,13.5],0,'TAT ALPHA\nPITOT TAT'],[[519.5,146,19.5,7.5],1,'PITOT TAT'],[[539.3,140,18.7,13.5],2,'TAT ALPHA\nPITOT TAT']])
    X.ann('PROBES / WINDSHIELD HTG|FAULT'+i,null,[t,'a',()=>pw()&&!B.probe[i]&&!X.M.gnd],{cls:'big bl',rect:r});
  X.ann('OVHD|TOP',null,['','w',()=>false],{cls:'big',rect:[535.5,22.3,12.3,11]});
  X.mom('ANN LT|ANN LT','annT',null,null);
  // ---- glareshield / panel: master warning and caution, CAP ----
  for(const s of ['CPT','F/O']){ const P=s==='CPT'?'CPT PANEL|':'F/O PANEL|';
    X.ann(P+'MASTER WARNING '+s,null,['MASTER\nWARNING','r',()=>X.A.ecam.mw||test()],{cls:'big bl bx',click:()=>{ X.Y.master(X.A,3); }});
    X.ann(P+'MASTER CAUTION '+s,null,['MASTER\nCAUTION','a',()=>X.A.ecam.mc||test()],{cls:'big bl bx',click:()=>{ X.Y.master(X.A,2); }});
    X.ann(P+'AP OFF '+s,null,['AP OFF','r',()=>UI.apOffT>0&&UI.t%0.6<0.4],{cls:'big bl'});
    X.pb(P+'FD BARS '+s,null,null,['ON','g',()=>pw()&&(s==='CPT'?X.M.ap.fd1:X.M.ap.fd2)],{on:()=>{ F.fcu(X.M,s==='CPT'?'fd1':'fd2'); }});
    X.CT.push({id:P+'ADC SW '+s,t:'selF',get:()=>0,set:()=>{},pos:['NORM','1','2'],ang:[0,-40,40]});
    X.CT.push({id:P+'TAT/SAT/TAS '+s,t:'seg',txt:()=>''}); }
  X.act('CAP|RCL',()=>{ B.recallT=4; X.say('Recall: all active alerts'); }); X.act('CAP|CLR',()=>{ X.Y.master(X.A,2); }); X.act('CAP|TO INHI',()=>{ B.toInhi=B.toInhi?0:1; X.say('TO inhibit '+(B.toInhi?'on':'off')); });
  // ---- engine panel ----
  X.CT.push({id:'ENGINE|PWR MGT',t:'selF',get:()=>B.pwr,set:v=>{ B.pwr=v; X.say('PWR MGT '+PWR[v]+': rated torque '+TQREF[PWR[v]]+' %'); },pos:PWR,ang:[-60,-20,20,60]});
  pbB('ENGINE|EEC 1',()=>B.eec[0],v=>{ B.eec[0]=v?1:0; },['FAULT','a',()=>false],['OFF','w',()=>pw()&&!B.eec[0]]);
  pbB('ENGINE|EEC 2',()=>B.eec[1],v=>{ B.eec[1]=v?1:0; },['FAULT','a',()=>false],['OFF','w',()=>pw()&&!B.eec[1]]);
  pbB('ENGINE|ATPCS',()=>B.atpcs,v=>{ B.atpcs=v?1:0; },['ARM','g',()=>pw()&&B.atpcs&&X.M.gnd&&UI.tla[0]>30&&UI.tla[1]>30],['OFF','w',()=>pw()&&!B.atpcs]);
  X.mom('FUEL QTY|FUEL QTY TEST','fqT',null,null);
  // ---- landing gear and brakes ----
  X.CT.push({id:'LDG GEAR|LDG GEAR LEVER',t:'lever',kind:'gear'});
  pbB('LDG GEAR|ANTISKID',()=>!B.noAsk,v=>{ B.noAsk=!v; },['FAULT','a',()=>false],['OFF','w',()=>pw()&&B.noAsk]);
  // ---- AFCS ----
  const btn=(id,lit,on)=>X.bar('AFCS|'+id,lit,()=>{ on(); X.dirty.all=true; });
  const vsNow=()=>Math.round(X.M.vs/FPM/100)*100;
  btn('AP',()=>ap().ap1,()=>{ const a=ap(); if(a.ap1){ F.fcu(X.M,'instDisc'); return; } if(X.M.gnd){ X.say('AP: not on the ground'); return; } B.yd=true; const r=F.fcu(X.M,'ap1'); if(r) X.say(r); if(!a.lat){ a.lat='HDG'; a.hdg.v=Math.round(w360(X.M.psi*R2D)); a.hdgHold=true; } if(!a.vert){ a.vert='V/S'; a.vs.v=vsNow(); B.pitchHold=true; } });
  btn('YD',()=>B.yd,()=>{ if(B.yd&&ap().ap1){ F.fcu(X.M,'instDisc'); } B.yd=!B.yd; });
  btn('HDG',()=>ap().lat==='HDG'||ap().lat==='TRK',()=>{ F.fcu(X.M,'hdgPull'); ap().hdgHold=false; if(!ap().vert&&!X.M.gnd){ ap().vert='V/S'; ap().vs.v=vsNow(); B.pitchHold=true; } });
  btn('NAV',()=>ap().lat==='NAV'||ap().latArm==='NAV',()=>{ if(!X.K.active){ X.say('NAV: no active FMS route'); return; } F.fcu(X.M,'hdgPush'); });
  btn('APP',()=>ap().appr,()=>F.fcu(X.M,'appr'));
  btn('BC',()=>false,()=>X.say('Back course: not on this runway'));
  btn('BANK',()=>B.bank,()=>{ B.bank=!B.bank; X.say('Low bank '+(B.bank?'on (15°)':'off (27°)')); });
  btn('STBY',()=>false,()=>{ const a=ap(); a.lat=''; a.latArm=''; a.vert=''; a.vertArm=''; a.appr=false; a.loc=false; if(a.ap1){ a.lat='HDG'; a.hdg.v=Math.round(w360(X.M.psi*R2D)); a.hdgHold=true; a.vert='V/S'; a.vs.v=vsNow(); B.pitchHold=true; } X.say('STBY: basic modes (wings level / pitch hold)'); });
  btn('IAS',()=>['OP CLB','OP DES','CLB','DES'].includes(ap().vert),()=>{ const a=ap(); if(X.M.gnd) return; a.spd.man=true; a.spd.v=Math.round(X.M.ias); if(Math.abs(a.alt.v-X.M.h/FT)<250){ X.say('IAS: set ALT SEL away from the present altitude'); return; } F.fcu(X.M,'altPull'); a.athr=false; a.athrArm=false; B.pitchHold=false; });
  btn('VS',()=>ap().vert==='V/S'&&!B.pitchHold,()=>{ const a=ap(); if(X.M.gnd) return; a.vert='V/S'; a.vs.dash=false; a.vs.v=vsNow(); B.pitchHold=false; });
  btn('ALT',()=>ap().vert==='ALT',()=>{ const a=ap(); if(X.M.gnd) return; a.vert='ALT'; a.altHold=Math.round(X.M.h/FT/10)*10; a.vertArm=''; a.appr=false; B.pitchHold=false; });
  btn('CPL',()=>B.cpl,()=>{ B.cpl=B.cpl?0:1; X.say('AFCS coupled to the '+(B.cpl?'F/O':'captain')+' side'); });
  X.CT.push({id:'AFCS|PITCH WHEEL',t:'knob',turn:d=>{ const a=ap(); if(a.vert==='V/S'){ F.fcu(X.M,'vsTurn',-d); B.pitchHold=false; } else if(['OP CLB','OP DES','CLB','DES'].includes(a.vert)){ a.spd.v=clamp((a.spd.v||X.M.ias)-d,110,250); } },pull:()=>{ X.CT.find(c=>c.id==='AFCS|PITCH WHEEL').turn(-1); },push:()=>{ X.CT.find(c=>c.id==='AFCS|PITCH WHEEL').turn(1); },tip:()=>{ const a=ap(); return a.vert==='V/S'?'Pitch wheel: V/S '+a.vs.v+' ft/min (top = up)':['OP CLB','OP DES','CLB','DES'].includes(a.vert)?'Pitch wheel: IAS target '+Math.round(a.spd.v)+' kt (top = slower, nose up)':'Pitch wheel: in VS or IAS mode'; }});
  X.CT.push({id:'AFCS|HDG SEL',t:'knob',turn:d=>F.fcu(X.M,'hdgTurn',d),pull:()=>{},push:()=>{ ap().hdg.v=Math.round(w360(X.M.psi*R2D)); },tip:()=>'Heading bug '+String(Math.round(ap().hdg.v)).padStart(3,'0')+' (push: sync to the heading)'});
  X.CT.push({id:'AFCS|ALT SEL',t:'knob',turn:d=>F.fcu(X.M,'altTurn',d),pull:()=>{},push:()=>{},tip:()=>'ALT SEL '+ap().alt.v+' ft'});
  X.CT.push({id:'AFCS|CRS 1',t:'knob',turn:d=>{ B.crs[0]=w360(B.crs[0]+d)||360; },pull:()=>{},push:()=>{},tip:()=>'Course 1: '+String(B.crs[0]).padStart(3,'0')});
  X.CT.push({id:'AFCS|CRS 2',t:'knob',turn:d=>{ B.crs[1]=w360(B.crs[1]+d)||360; },pull:()=>{},push:()=>{},tip:()=>'Course 2: '+String(B.crs[1]).padStart(3,'0')});
  X.act('ADU|ADU RESET',()=>{ UI.apOffT=0; }); X.act('ADU|ADU L SEL',()=>{}); X.act('ADU|ADU R SEL',()=>{}); X.act('ADU|ADU BRT',()=>{});
  // radios: the selected frequency on the control heads
  for(const [id,i] of [['NAV 1|NAV 1 CONTROL',0],['NAV 2|NAV 2 CONTROL',1]]) X.CT.push({id,t:'knob',turn:d=>{ const v=clamp(+B.nav[i]+d*0.05,108,117.95); B.nav[i]=v.toFixed(2); },pull:()=>{},push:()=>{},tip:()=>'NAV '+(i+1)+' '+B.nav[i]+(B.nav[i]==='109.50'?' (ILS 36)':'')});
  for(const [id,i] of [['COM 1|COM 1',0],['COM 2|COM 2',1]]) X.CT.push({id,t:'knob',turn:d=>{ const v=clamp(+B.com[i]+d*0.025,118,136.975); B.com[i]=v.toFixed(3); },pull:()=>{},push:()=>{},tip:()=>'COM '+(i+1)+' '+B.com[i]});
  // ---- pedestal ----
  X.CT.push({id:'POWER LEVERS|PL 1',t:'thr',i:0}); X.CT.push({id:'POWER LEVERS|PL 2',t:'thr',i:1});
  X.act('POWER LEVERS|IDLE GATE',()=>X.say('Idle gate: lift the PL triggers to go below flight idle (on the ground)'));
  for(const i of [0,1]) X.act('POWER LEVERS|REVERSE '+(i+1),()=>{ if(!X.M.gnd){ X.say('Reverse: on the ground only'); return; } UI.tla[i]=UI.tla[i]<0?PL.GI:-20; });
  for(const i of [0,1]) X.CT.push({id:'CONDITION LEVERS|CL '+(i+1),t:'lever',kind:'cl',i,lp:[1.5,-6,15]});
  X.CT.push({id:'FLAPS|FLAPS LEVER',t:'lever',kind:'flaps'});
  X.CT.push({id:'PARKING / EMER BRAKE|PARKING BRAKE',t:'lever',kind:'park'});
  X.CT.push({id:'GUST LOCK|GUST LOCK',t:'lever',kind:'gust',lp:[13.7,-6,14]});
  X.CT.push({id:'TRIM|ROLL TRIM',t:'knob',turn:d=>{ B.rollT=clamp((B.rollT||0)+d*0.2,-5,5); },pull:()=>{},push:()=>{},tip:()=>'Aileron trim '+(B.rollT||0).toFixed(1)});
  X.CT.push({id:'TRIM|YAW TRIM',t:'knob',turn:d=>{ X.A.sw.rudTrim=clamp(+(X.A.sw.rudTrim+d*0.5).toFixed(1),-10,10); },pull:()=>{},push:()=>{},tip:()=>'Rudder trim '+X.A.sw.rudTrim});
  X.CT.push({id:'TRIM|STBY PITCH TRIM',t:'knob',turn:d=>trim(-d),pull:()=>trim(1),push:()=>trim(-1),tip:()=>'Standby pitch trim (top: nose down)'});
}
function test(){ return !!(X.A.sw.annT); }
/* pitch trim: the shared model trims a speed; the trim indicator shows what that speed needs */
function trimUnits(){ const M=X.M; const v=M.trimSpd||(M.ias>60?M.ias:130); return clamp((170-v)*0.06+(M.conf>0?0.8:0),-2,6); }
function trim(d){ const M=X.M; if(M.ap.ap1){ X.say('The autopilot trims: disconnect it to trim by hand'); return; } const v=M.trimSpd||M.ias; M.trimSpd=clamp(v+d*2*(v/180),80,260); B.trimT=0.6; }
/* ---------------- crew alerting panel ---------------- */
const CAPL=[['ENG 1','ENG 1'],['ELEC','ELEC'],['ENG 2','ENG 2'],['HYD','HYD'],['FUEL','FUEL'],['AIR','AIR'],['FLT CTL','F/CTL'],['ANTI ICING','ANTI ICE'],['DOORS','DOOR'],['CONFIG','CONFIG'],['OXY','OXY'],['CCAS','']];
const CAPP={'ENG 1':['ENG 1'],'ENG 2':['ENG 2'],'ELEC':['ELEC'],'HYD':['HYD'],'FUEL':['FUEL'],'AIR':['AIR','BLEED','PACK','COND','CAB PR'],'FLT CTL':['F/CTL'],'ANTI ICING':['ANTI ICE'],'DOORS':['DOOR'],'CONFIG':['CONFIG'],'OXY':['OXY'],'CCAS':[]};
function capLit(){ const E=X.A.ecam; const out={}; for(const [t] of CAPL){ out[t]=0; }
  if(!X.A.dc) return out; if(test()){ for(const k in out) out[k]=2; return out; }
  for(const a of E.list){ for(const k in CAPP){ if(CAPP[k].some(p=>a.title.startsWith(p))&&(B.recallT>0||!E.mcAck[a.id]&&!E.mwAck[a.id])) out[k]=Math.max(out[k],a.lvl>=3?3:2); } }
  if(X.M.gnd&&(UI.tla[0]>30||UI.tla[1]>30)&&(B.flap!==1||X.A.sw.park||B.gust)) out.CONFIG=3;
  return out; }
/* ---------------- displays ---------------- */
const DISP=[{id:'CPT PANEL|EADI CPT',k:'eadi',side:0,hz:30},{id:'CPT PANEL|EHSI CPT',k:'ehsi',side:0,hz:20},{id:'F/O PANEL|EADI F/O',k:'eadi',side:1,hz:15},{id:'F/O PANEL|EHSI F/O',k:'ehsi',side:1,hz:12},
  {id:'ADU|ADU DISPLAY',k:'adu',hz:6},
  {id:'CPT PANEL|AIRSPEED CPT',k:'asi',side:0,hz:20},{id:'CPT PANEL|ALTIMETER CPT',k:'alt',side:0,hz:20},{id:'CPT PANEL|VERTICAL SPEED CPT',k:'vsi',side:0,hz:15},{id:'CPT PANEL|RMI CPT',k:'rmi',side:0,hz:10},{id:'CPT PANEL|CLOCK CPT',k:'clock',hz:2},{id:'CPT PANEL|TAT/SAT/TAS CPT',k:'tat',hz:2},
  {id:'F/O PANEL|AIRSPEED F/O',k:'asi',side:1,hz:10},{id:'F/O PANEL|ALTIMETER F/O',k:'alt',side:1,hz:10},{id:'F/O PANEL|VERTICAL SPEED F/O',k:'vsi',side:1,hz:8},{id:'F/O PANEL|RMI F/O',k:'rmi',side:1,hz:6},{id:'F/O PANEL|CLOCK F/O',k:'clock',hz:2},{id:'F/O PANEL|TAT/SAT/TAS F/O',k:'tat',hz:2},
  {id:'STANDBY|STANDBY HORIZON',k:'stbyH',hz:15},{id:'STANDBY|STANDBY AIRSPEED',k:'stbyA',hz:8},{id:'STANDBY|STANDBY ALTIMETER',k:'stbyAlt',hz:8},
  {id:'ENGINE|TORQUE 1',k:'tq',i:0,hz:15},{id:'ENGINE|TORQUE 2',k:'tq',i:1,hz:15},{id:'ENGINE|NP 1',k:'np',i:0,hz:12},{id:'ENGINE|NP 2',k:'np',i:1,hz:12},{id:'ENGINE|ITT 1',k:'itt',i:0,hz:10},{id:'ENGINE|ITT 2',k:'itt',i:1,hz:10},
  {id:'ENGINE|NH 1',k:'nh',i:0,hz:10},{id:'ENGINE|NH 2',k:'nh',i:1,hz:10},{id:'ENGINE|FUEL FLOW 1',k:'ff',i:0,hz:4},{id:'ENGINE|FUEL FLOW 2',k:'ff',i:1,hz:4},{id:'ENGINE|OIL 1',k:'oil',i:0,hz:3},{id:'ENGINE|OIL 2',k:'oil',i:1,hz:3},
  {id:'ENGINE|FUEL TEMP 1',k:'ftemp',i:0,hz:1},{id:'ENGINE|FUEL TEMP 2',k:'ftemp',i:1,hz:1},
  {id:'CAP|CREW ALERTING PANEL',k:'cap',hz:4},{id:'FLAPS / TRIM|FLAPS INDICATOR',k:'flaps',hz:6},{id:'FLAPS / TRIM|TRIM INDICATORS',k:'trim',hz:4},{id:'CAB PRESS|CAB PRESS',k:'cab',hz:2},
  {id:'LDG GEAR|BRAKE ACCU PRESS',k:'accu',hz:2},{id:'LDG GEAR|LDG GEAR LIGHTS',k:'gearl',hz:3},{id:'LDG GEAR|BRAKE TEMP',k:'btemp',hz:1},{id:'MAIN ELEC PWR|BAT AMP',k:'batamp',hz:1},
  {id:'NAV 1|NAV 1 CONTROL',k:'radio',i:0,hz:2},{id:'NAV 2|NAV 2 CONTROL',k:'radio',i:1,hz:2},{id:'COM 1|COM 1',k:'radio',i:2,hz:2},{id:'COM 2|COM 2',k:'radio',i:3,hz:2},{id:'FMC|FMC',k:'fmc',hz:2,rect:[468,727,70,48]}];
function dispData(d){
  const M=X.M, A=X.A, K=X.K, ap=M.ap, side=d.side||0, E=side?UI.efis2:UI.efis;
  const acp=A.bus.ac1||A.bus.ac2||A.bus.acEss, dcp=A.dc, pwrS=side?(A.bus.ac2||A.bus.dc2):(A.bus.acEss||A.bus.ac1||A.bus.dcEss);
  const ir=A.irs[side?1:0], attOK=ir.st===2||ir.st===3, hdgOK=ir.st===2;
  const hdg=w360(M.psi*R2D), qnhAdj=E.std?0:(E.qnh-1013.25)*27.3, alt=M.h/FT+qnhAdj;
  const fdOn=side?ap.fd2:ap.fd1;
  switch(d.k){
    case 'eadi': { const fdP=ap.gamC!=null?clamp((ap.gamC-M.gam)*R2D*2.2,-10,10):0, fdR=ap.phiC!=null?clamp((ap.phiC-M.phi)*R2D,-25,25):0;
      const sp=M.spds||{}; return {pwr:pwrS,attOK,phi:M.phi*R2D,th:M.th*R2D,beta:(M.beta||0)*R2D,fd:fdOn&&!!(ap.lat||ap.vert),fdP,fdR,ra:M.ra/FT,gnd:M.gnd,ls:ap.appr||ap.loc||E.mode===1,loc:M.nav.loc,gs:M.nav.gs,dh:B.mins,
        spdDev:ap.spd.man&&['OP CLB','OP DES','CLB','DES'].includes(ap.vert)?clamp(M.ias-ap.spd.v,-20,20):null,afcs:afcs(),stall:M.stall&&!M.gnd,ias:M.ias,vls:sp.vls}; }
    case 'ehsi': { const W=M.wind||{dir:0,spd:0}; const nav=M.nav&&M.nav.fp; const ils=B.nav[side]==='109.50';
      return {pwr:pwrS,hdgOK,hdg,trk:w360((M.gnd?M.psi:M.trk||M.chi)*R2D),selHdg:ap.hdg.v,crs:B.crs[side],loc:ils?M.nav.loc:null,gs:ils?M.nav.gs:null,dme:ils?M.nav.dme:null,
        navId:ils?'IRD':'---',mode:E.mode,range:[5,10,25,50,100][E.range]||25,N:M.N,E:M.E,fpln:K.active&&K.fpln.length?K.fpln.map(p=>({id:p.rwy?'RW36':p.id,N:p.N,E:p.E})):null,act:K.act,toWpt:nav?nav.toWpt:null,toDist:nav?nav.toDist:null,gs_:M.gs/KT,wind:W}; }
    case 'adu': return {pwr:dcp,f:afcs()};
    case 'asi': { const sp=M.spds||{}; const k=K.d; return {pwr:true,ias:M.gnd&&M.ias<40?Math.max(0,M.ias):M.ias,vmo:sp.vmax||250,bugs:M.gnd?[k.v1,k.vr,k.v2].filter(Boolean):(k.vref?[k.vref,k.vref+10]:[]),sel:['OP CLB','OP DES','CLB','DES'].includes(ap.vert)?ap.spd.v:null}; }
    case 'alt': return {pwr:true,alt,qnh:E.std?'STD':String(Math.round(E.qnh)),sel:ap.alt.v};
    case 'vsi': return {pwr:pwrS,vs:M.vs/FPM};
    case 'rmi': { const b=(N,E_)=>w360(Math.atan2(E_-M.E,N-M.N)*R2D); const ndb=X.FIX.AN||{N:-7600,E:0}, vor=X.FIX.ASN||{N:900,E:-2600}; return {pwr:hdgOK&&pwrS,hdg,b1:b(vor.N,vor.E),b2:b(ndb.N,ndb.E)}; }
    case 'clock': return {pwr:dcp,t:Date.now()};
    case 'tat': { const at=X.F.isa(M.h,M.oatDev), sat=at.T-273.15; return {pwr:pwrS,sat,tat:sat+(M.tas*M.tas)/(2*1005),tas:M.tas/KT}; }
    case 'stbyH': return {pwr:A.bus.dcEss||A.dc,phi:M.phi*R2D,th:M.th*R2D};
    case 'stbyA': return {pwr:true,ias:M.ias};
    case 'stbyAlt': return {pwr:true,alt:M.h/FT+(UI.efis.std?0:(UI.efis.qnh-1013.25)*27.3)};
    case 'tq': return {pwr:acp||dcp,v:tq(d.i),ref:TQREF[PWR[B.pwr]]};
    case 'np': return {pwr:acp||dcp,v:B.np[d.i]};
    case 'itt': { const e=A.eng[d.i]; const t=e.run?440+thrF(d.i)*360+(A.env.t-15)*1.2:(e.st>=3?Math.min(e.egt*1.05,780):e.egt); return {pwr:acp||dcp,v:t}; }
    case 'nh': return {pwr:acp||dcp,v:A.eng[d.i].n2*(A.eng[d.i].run?1.12:1)};
    case 'ff': { const e=A.eng[d.i]; return {pwr:acp||dcp,v:e.ff*0.16,fu:Math.max(0,(B.fu||[0,0])[d.i])}; }
    case 'oil': { const e=A.eng[d.i]; return {pwr:acp||dcp,p:e.oilP*0.62,t:e.oilT*0.9}; }
    case 'ftemp': return {pwr:acp||dcp,v:A.env.t+3};
    case 'cap': return {pwr:dcp,l:capLit(),lbl:CAPL.map(x=>x[0])};
    case 'flaps': return {pwr:dcp,v:B.fpos||0};
    case 'trim': return {pwr:dcp,p:trimUnits(),r:B.rollT||0,y:A.sw.rudTrim||0};
    case 'cab': return {pwr:dcp,alt:A.air.cab||0,vs:A.air.cabVs||0,dp:A.air.dp||0};
    case 'accu': return {pwr:true,v:A.hyd.g>1500||A.hyd.y>1500?3000:2300};
    case 'gearl': { const g=M.gear; return {pwr:dcp,green:g>0.99,red:(g>0.01&&g<0.99)||(A.sw.gearLv===0&&g>0.01&&M.gnd)}; }
    case 'btemp': return {pwr:dcp,hot:false};
    case 'batamp': return {pwr:dcp,v:A.eng.some(e=>e.st>0&&e.st<4)?-250:(A.dc&&!A.ac?-12:3)};
    case 'fuelq': return {pwr:dcp,l:A.fuel.li+A.fuel.lo,r:A.fuel.ri+A.fuel.ro,test:!!A.sw.fqT};
    case 'radio': return {pwr:dcp,t:d.i<2?B.nav[d.i]:B.com[d.i-2]};
    case 'fmc': return {pwr:dcp,K,M,crz:K.d.crzFl};
  }
  return null;
}
/* ---------------- start positions ---------------- */
function reset(kind){
  const A=X.A, M=X.M, K=X.K, ap=M.ap, cold=kind==='cold';
  M.conv=true; bReset(cold);
  A.ffK=0.16; A.sw.ptu=1; A.sw.hyY=0; B.emerBat=1; B.xf=0;
  A.zfw=19300; A.fuel=Object.assign(A.fuel,{lo:0,li:1250,ri:1250,ro:0,c:0}); B.fu=[0,0];
  A.gw=A.zfw+A.fuel.li+A.fuel.ri;
  Object.assign(K.d,{v1:104,vr:106,v2:112,vref:113,vrefF:30,crzFl:170,fltNbr:'NRD72'}); ap.v1=104; ap.vr=106; ap.v2=112; ap.vapp=118;
  ap.athr=false; ap.athrArm=false;
  if(cold){ Object.assign(A.sw,{pk1:1,pk2:1,eb1:1,eb2:1,apuBl:0,ext:0,gen1:1,gen2:1,apuGen:0,apuM:0,fL1:0,fL2:0,fR1:0,fR2:0,hyE1:1,hyE2:1}); B.cl=[0,0]; B.gust=1; UI.tla=[0,0]; ap.fd1=ap.fd2=false; }
  else { Object.assign(A.sw,{apuM:0,apuBl:0,fL1:1,fL2:1,fR1:1,fR2:1,hyE1:1,hyE2:1,gen1:1,gen2:1,probe:1}); B.cl=kind==='ready'?[3,3]:[2,2]; B.gust=0; }
  if(kind==='ready'){ B.flap=1; A.sw.flapLv=FLAPCONF[1]; B.fpos=15; UI.tla=[0,0]; M.trimSpd=125; ap.spd.v=112; ap.alt.v=4000; ap.hdg.v=360; B.pwr=0; }
  if(kind==='air'){ B.flap=0; A.sw.flapLv=0; UI.tla=[30,30]; M.tas=112; M.trimSpd=200; ap.spd.man=true; ap.spd.v=200; ap.ap1=true; ap.vert='ALT'; ap.altHold=5000; ap.lat='HDG'; ap.hdg.v=360; ap.hdgHold=false; B.pwr=3; }
  if(kind==='appr'){ B.flap=1; A.sw.flapLv=FLAPCONF[1]; B.fpos=15; UI.tla=[22,22]; M.tas=80; M.trimSpd=150; ap.spd.man=true; ap.spd.v=150; ap.ap1=true; ap.vert='ALT'; ap.altHold=3000; ap.lat='HDG'; ap.hdg.v=360; B.pwr=1; B.nav=['109.50','109.50']; B.crs=[360,360]; }
  if(kind==='air'||kind==='appr'){ A.sw.gearLv=0; M.gear=0; M.gearDown=false; A.sw.abrk=0; A.sw.park=0; }
  if(kind==='appr'){ A.sw.gearLv=1; M.gear=1; M.gearDown=true; }
  for(const i of [0,1]) B.np[i]=cold?0:(kind==='ready'?100:82);
  B.fpos=FLAPS[B.flap]; UI.ls=[kind==='appr',kind==='appr'];
  X.say(cold?'Cold and dark on the stand, DC external power connected. Battery ON, DC EXT PWR ON, then start engine 2 in hotel mode or both engines.':
    kind==='ready'?'Lined up on runway 36, flaps 15, CL at MAX RPM, PWR MGT TO. Release the brakes and set the power levers in the notch.':
    kind==='air'?'5,000 ft, 200 kt, AP and YD on, HDG SEL 360, ALT. PWR MGT CRZ.':'12 NM from runway 36 at 3,000 ft, flaps 15, gear down, NAV 1 on the ILS. Press APP on the AFCS.',null,6000);
}
/* ---------------- per-tick mapping onto the shared systems ---------------- */
function postSys(dt){
  const A=X.A, M=X.M, S=A.sw, ap=M.ap;
  ap.athr=false; ap.athrArm=false; // no autothrottle on the ATR
  if(ap.ap1&&!B.yd) B.yd=true;
  // engine start: START SEL and START pushbutton crank the engine with the starter-generator (DC); fuel comes with the CL out of FUEL SO
  let mode=1;
  for(const i of [0,1]){ const e=A.eng[i];
    S['mst'+(i+1)]=B.cl[i]>=1&&B.lp[i]?1:0;
    const starting=B.startSel>=2&&B.startPb[i]&&!e.run;
    if(starting){ mode=2; if(A.bus.dcEss) A.air.duct[i]=Math.max(A.air.duct[i],45); }
    if(B.startSel===1&&B.startPb[i]){ S['manSt'+(i+1)]=1; A.air.duct[i]=Math.max(A.air.duct[i],45); } else S['manSt'+(i+1)]=0;
    if(e.run&&B.startPb[i]){ B.startPb[i]=0; X.say('Engine '+(i+1)+' started: START light off'); }
    // propeller speed: feathered at FTR, governed with the CL out of FTR; prop brake holds propeller 2
    let npT=0; if(e.run){ npT=B.cl[i]<=1?(e.n2>40?18:0):B.cl[i]===2?(M.gnd&&UI.tla[i]<PL.FI+1?70.8:82):100; if(B.cl[i]>=2&&UI.tla[i]>PL.NOTCH-3&&B.pwr<=1) npT=100; }
    if(i===1&&B.pbrk) npT=0;
    B.np[i]=lag(B.np[i],npT,e.run?2.5:5,dt);
    if(e.run){ B.fu=B.fu||[0,0]; B.fu[i]=(B.fu[i]||0)+e.ff*0.16*dt/3600; }
  }
  if(B.startSel>=2&&(B.startPb[0]||B.startPb[1])) S.engMode=2; else S.engMode=S.manIgn?2:1;
  if(B.startSel===1) S.engMode=0;
  B.hotel=!!(B.pbrk&&A.eng[1].run);
  // flaps: lever → shared configuration; the surfaces need hydraulic pressure
  const ci=FLAPCONF[B.flap]; if(S.flapLv!==ci) S.flapLv=ci;
  const tgt=FLAPS[B.flap], hydOK=A.hyd.g>1500||A.hyd.y>1500; if(hydOK){ B.fpos=(B.fpos||0)+clamp(tgt-(B.fpos||0),-dt*3,dt*3); }
  S.fireT2=S.fireT1; if(B.recallT>0) B.recallT-=dt; if(B.trimT>0) B.trimT-=dt;
  // low bank limit on the autopilot
  if(ap.ap1&&B.bank&&ap.phiC!=null) ap.phiC=clamp(ap.phiC,-15*D2R,15*D2R);
  if(ap.vert!=='V/S') B.pitchHold=false;
}
/* power and condition lever handling */
const D3=document.body.hasAttribute('data-d3');
function thrTxt(i){ const v=UI.tla[i]; if(v<-1) return 'REV'; if(D3) return v>=PL.RAMP-0.5?'RAMP':v>=PL.NOTCH-0.5?'NOTCH':v<=PL.GI+0.5?'GI':v<=PL.FI+0.5?'FI':''; if(v>=PL.NOTCH-0.5&&v<PL.NOTCH+0.5) return 'NOTCH'; if(v<=PL.GI+0.5) return 'GI'; if(Math.abs(v-PL.FI)<0.5) return 'FI'; return 'TQ '+Math.round(tq(i)); }
function levTxt(k,c){ if(k==='cl') return ['SO','FTR','AUTO','MAX'][B.cl[c&&c.i||0]]; const S=X.A.sw; if(k==='flaps') return String(FLAPS[B.flap]); if(k==='gear') return S.gearLv?'DN':'UP'; if(k==='gust') return B.gust?'LOCK':'OFF'; if(k==='cl') return null; return null; }
function flapSay(){ X.say('Flaps '+FLAPS[B.flap]+(VFE[B.flap]?' (VFE '+VFE[B.flap]+' kt)':'')); }
function clMove(i,d){ const n=clamp(B.cl[i]+d,0,3); if(n===B.cl[i]) return; if(i===1&&B.pbrk&&n>=2){ X.say('Prop brake on: CL 2 stays at FTR'); return; } B.cl[i]=n; X.say('CL '+(i+1)+' '+CLP[n]); }
function lever(c,fy){
  if(c.kind==='flaps'){ B.flap=clamp(B.flap+(fy<0.5?-1:1),0,2); flapSay(); return true; }
  if(c.kind==='cl'){ clMove(c.i,fy<0.5?1:-1); return true; }
  if(c.kind==='gust'){ if(!B.gust&&!X.M.gnd){ X.say('Gust lock: on the ground only'); return true; } B.gust=B.gust?0:1; if(B.gust){ UI.tla=UI.tla.map(v=>Math.min(v,PL.FI)); } X.say('Gust lock '+(B.gust?'ON: power levers held at flight idle':'OFF')); return true; }
  return false; }
function thrDrag(i,v,both){ const lim=x=>{ let y=x; if(B.gust) y=Math.min(y,PL.FI); if(!X.M.gnd) y=Math.max(y,PL.FI); return y; }; if(both) UI.tla=[lim(v),lim(v)]; else UI.tla[i]=lim(v); }
function keydown(c,e){
  switch(c){
    case 'KeyF': B.flap=Math.min(2,B.flap+1); flapSay(); return true;
    case 'KeyV': B.flap=Math.max(0,B.flap-1); flapSay(); return true;
    case 'KeyC': clMove(0,1); clMove(1,1); return true;
    case 'KeyX': clMove(0,-1); clMove(1,-1); return true;
    case 'KeyT': e.preventDefault(); UI.tla=[PL.NOTCH,PL.NOTCH]; X.say('Power levers in the notch: rated power ('+PWR[B.pwr]+')'); return true;
    case 'KeyI': UI.tla=X.M.gnd?[PL.GI,PL.GI]:[PL.FI,PL.FI]; return true;
    case 'Home': case 'Numpad7': case 'BracketLeft': e.preventDefault(); trim(1); return true;
    case 'End': case 'Numpad1': case 'BracketRight': e.preventDefault(); trim(-1); return true;
    case 'Digit1': X.view('ovhd'); return true; case 'Digit2': X.view('main'); return true; case 'Digit3': X.view('ped'); return true; case 'Digit4': X.view('afcs'); return true; case 'Digit5': X.view('eng'); return true;
  }
  return false; }
function speedsPane(el){ const K=X.K, A=X.A, r=(t,v)=>`<div class="row"><span>${t}</span><b>${v==null?'—':Math.round(v)+' kt'}</b></div>`;
  el.innerHTML='<div class="sgrp">Speeds at '+(A.gw/1000).toFixed(1)+' t</div>'+r('V1',K.d.v1)+r('VR',K.d.vr)+r('V2',K.d.v2)+r('VREF flaps 30',K.d.vref)+r('VMO',250)+'<p class="pdisc">VFE flaps 15: 185 kt, flaps 30: 150 kt. VLO 160 kt, VLE 185 kt. Torque for the PWR MGT setting: TO 90 %, MCT 90.9 %, CLB 80.6 %, CRZ 75.6 %. NP 100 % with the CL at MAX RPM, 82 % at AUTO in flight.</p>'; }
/* ---------------- aircraft ---------------- */
function init(x){ X=x; UI=x.UI; bReset(false);
  Object.assign(x.F.AC,{S:61,b:27.05,wheelbase:10.8,T0:32000,prop:2050000,CD0:0.028,k:0.042,CLa:5.6,CL0:0.24,gearCD:0.02,spCD:0.03,VMO:250,MMO:0.55,VLE:185,VLO:160,alphaMax:16*D2R,
    CONF:[['0',0,0,0,1.72,0,250],['8',0,8,0.22,1.95,0.01,215],['15',0,15,0.45,2.15,0.022,185],['22',0,22,0.6,2.35,0.034,170],['30',0,30,0.78,2.6,0.05,150],['33',0,33,0.82,2.65,0.06,145]]}); }
const REG={ovhd:[300,0,400,300],main:[0,360,1000,350],afcs:[390,365,225,100],eng:[395,485,175,225],ped:[340,700,320,566],side:[0,1300,1000,120]};
window.SIMAC={T:window.ATR72T,H:1266.7,key:'bb-atr72-start',img:['img/cockpits/atr72-deck-1500.webp','img/cockpits/atr72-deck-3000.webp'],cduIds:['FMC|FMC-NONE','FMC|FMC-NONE2'],gshade:null,
  REG,REGN:{ovhd:'Overhead',main:'Panel',afcs:'AFCS and ADU',eng:'Engine instruments',ped:'Pedestal'},
  DISP,draw:DSP,cdu:null,cduCls:'',trainer:'',cduHTML:()=>'',detents:[PL.GI,PL.FI,PL.NOTCH,PL.RAMP],
  B,speedsPane,init,defs,dispData,reset,postSys,tla,thrTxt,levTxt,lever,thrDrag,keydown,
  d3:{VIEWS:{ovh:{c:[-10.819,1.369,0],n:[-0.361,0.932,0],up:[0.932,0.361,0],W:0.769,H:0.608,r:[300,0,388,306.7]},
      front:{c:[-11.29,0.66,0],n:[-0.985,-0.173,0],up:[0,1,0],W:1.9,H:0.74,r:[0,330,1000,385]},
      ped:{c:[-10.72,0.2,0],n:[0,-1,0],up:[-1,0,0],W:0.56,H:1.08,r:[352,717,296,549.7]}},
    eye:[-10.25,1.12,0.42],pitch:-14,yaw:-0.12,phoneMain:[200,560,44],
    look:{main:1,ovhd:[500,150,64,-0.02],ped:[500,980,58,-0.18],afcs:[500,415,30],eng:[485,600,38,-0.2]}}};
})();
