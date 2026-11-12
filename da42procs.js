/* Birdbird – DA42 data for the trainer: control predicates, failure scenarios, the failure menu and the key speeds.
   No procedure text: schools have their own checklists (ownck.js). CK predicates tick the student's own checklist items and
   judge the outcome of a failure scenario (debrief, any order). A predicate gets the page context c = {S, SYS, o, AP,
   i (affected engine 0/1), dt, cb(name), cbAll()} and a per-key memo m; ctl is the panel control to highlight
   ('*' = affected side, '~' = the live side). */
(function(G){
'use strict';
const T=(en,no)=>({en,no:no==null?en:no});

/* ---------- auto-tick predicates ---------- */
const sd=c=>c.i?'R':'L', od=c=>c.i?'L':'R';
const both=(c,k,v)=>c.SYS[k+'L']===v&&c.SYS[k+'R']===v;
const CK={
  park:{ctl:'park',f:c=>!!c.SYS.park},
  parkOff:{ctl:'park',f:c=>!c.SYS.park},
  idle:{ctl:'pwr',f:c=>c.S.eng.every(e=>e.thr<0.05)},
  pwrMax:{ctl:'pwr',f:c=>c.S.eng.every(e=>e.thr>0.95)},
  pwrMaxLive:{ctl:'pwr',f:c=>c.S.eng[1-c.i].thr>0.95},
  pwrLive92:{ctl:'pwr',f:c=>c.S.eng[1-c.i].thr>0.85},
  pwrAffIdle:{ctl:'pwr',f:c=>c.S.eng[c.i].thr<0.05},
  avioOn:{ctl:'avio',f:c=>!!c.SYS.avio}, avioOff:{ctl:'avio',f:c=>!c.SYS.avio},
  elecOn:{ctl:'elec',f:c=>!!c.SYS.elec}, elecOff:{ctl:'elec',f:c=>!c.SYS.elec},
  emerOn:{ctl:'emer',f:c=>!!c.SYS.emer},
  backup:{ctl:'audBackup',f:c=>!!c.SYS.backup},
  gear3:{ctl:'gear',f:c=>c.S.ctl.gear===1&&c.S.ctl.gearPos>0.99},
  gearUp:{ctl:'gear',f:c=>c.S.ctl.gear===0},
  gearEmer:{ctl:'gearEmer',f:c=>!!c.SYS.gearEmer},
  flapsUp:{ctl:'flaps',f:c=>c.S.ctl.flap===0},
  flapsApp:{ctl:'flaps',f:c=>c.S.ctl.flap===1},
  flapsLdg:{ctl:'flaps',f:c=>c.S.ctl.flap===2},
  trimTO:{ctl:'trim',f:c=>Math.abs(c.S.ctl.trim-0.05)<0.08},
  rudTrim0:{ctl:'rudTrim',f:c=>Math.abs(c.SYS.rudTrim||0)<0.05},
  votersAuto:{ctl:'voterL',f:c=>both(c,'voter',1)},
  voterAffAuto:{ctl:'voter*',f:c=>c.SYS['voter'+sd(c)]===1},
  ecuL:{ctl:'ecuL',f:c=>!!c.SYS.ecuDone[0]}, ecuR:{ctl:'ecuR',f:c=>!!c.SYS.ecuDone[1]},
  altsOn:{ctl:'altL',f:c=>!!(c.SYS.altL&&c.SYS.altR)}, altsOff:{ctl:'altL',f:c=>!c.SYS.altL&&!c.SYS.altR},
  altAffOff:{ctl:'alt*',f:c=>!c.SYS['alt'+sd(c)]}, altAffOn:{ctl:'alt*',f:c=>!!c.SYS['alt'+sd(c)]},
  pumpsOff:{ctl:'pumpL',f:c=>!c.SYS.pumpL&&!c.SYS.pumpR}, pumpsOn:{ctl:'pumpL',f:c=>!!(c.SYS.pumpL&&c.SYS.pumpR)},
  pumpAffOff:{ctl:'pump*',f:c=>!c.SYS['pump'+sd(c)]}, pumpAffOn:{ctl:'pump*',f:c=>!!c.SYS['pump'+sd(c)]},
  pumpLiveOn:{ctl:'pump~',f:c=>!!c.SYS['pump'+od(c)]},
  fselsOn:{ctl:'fselL',f:c=>both(c,'fsel',0)}, fselsX:{ctl:'fselL',f:c=>both(c,'fsel',1)}, fselsOff:{ctl:'fselL',f:c=>both(c,'fsel',2)},
  fselAffOn:{ctl:'fsel*',f:c=>c.SYS['fsel'+sd(c)]===0}, fselAffX:{ctl:'fsel*',f:c=>c.SYS['fsel'+sd(c)]===1}, fselAffOff:{ctl:'fsel*',f:c=>c.SYS['fsel'+sd(c)]===2},
  fselLiveOn:{ctl:'fsel~',f:c=>c.SYS['fsel'+od(c)]===0},
  engsOff:{ctl:'engL',f:c=>!c.SYS.engL&&!c.SYS.engR},
  engAffOff:{ctl:'eng*',f:c=>!c.SYS['eng'+sd(c)]}, engAffOn:{ctl:'eng*',f:c=>!!c.SYS['eng'+sd(c)]},
  engLOn:{ctl:'engL',f:c=>!!c.SYS.engL}, engROn:{ctl:'engR',f:c=>!!c.SYS.engR},
  glowL:{ctl:'bzP',f:c=>!!c.SYS.engL&&c.SYS.glow[0]<=0}, glowR:{ctl:'bzP',f:c=>!!c.SYS.engR&&c.SYS.glow[1]<=0},
  runL:{ctl:'start',f:c=>c.S.eng[0].run&&c.SYS.start===0}, runR:{ctl:'start',f:c=>c.S.eng[1].run&&c.SYS.start===0},
  strobeOn:{ctl:'strobe',f:c=>!!c.SYS.strobe}, strobeOff:{ctl:'strobe',f:c=>!c.SYS.strobe},
  navOn:{ctl:'nav',f:c=>!!c.SYS.nav}, landOn:{ctl:'land',f:c=>!!c.SYS.land}, landOff:{ctl:'land',f:c=>!c.SYS.land},
  pitotOn:{ctl:'pitot',f:c=>!!c.SYS.pitot}, pitotOff:{ctl:'pitot',f:c=>!c.SYS.pitot},
  pitotCycle:{ctl:'pitot',f:(c,m)=>{ if(c.SYS.pitot) m.b=1; return !!m.b&&!c.SYS.pitot; }},
  fireTest:{ctl:'fireTest',f:(c,m)=>{ if(c.SYS.fireTest) m.b=1; return !!m.b; }},
  altAirOpen:{ctl:'altAir',f:c=>!!c.SYS.altAir}, altAirClosed:{ctl:'altAir',f:c=>!c.SYS.altAir},
  heatOff:{ctl:'heat',f:c=>c.SYS.heat<0.05&&c.SYS.defrost<0.05}, heatOn:{ctl:'heat',f:c=>c.SYS.heat>0.5&&c.SYS.defrost>0.5},
  cbsIn:{ctl:'cb0',f:c=>c.cbAll()},
  eltOff:{ctl:'elt',f:c=>c.SYS.elt!==-1},
  apOff:{ctl:'apDisc',f:c=>!c.AP.on},
  vyse:{ctl:'bzP',f:c=>!c.S.ground&&c.o.ias>=82&&c.o.ias<=100},
  stopped:{ctl:'bzP',f:c=>c.S.ground&&c.o.gs<3}
};

/* ---------- failure scenarios: a set-up flight, the failure comes by itself; the debrief scores the outcome ----------
   crit: outcome keys (each must hold once after the failure, any order), critLim: [pass, amber] s, own: the section kind of the
   student's own checklist to open */
const SCENS=[
 {id:'s_rto',t:T('Engine failure on the take-off run','Motorstans i startrullet'),d:T('Runway 36, ready for take-off. An engine fails before VR.','Bane 36, klar for avgang. En motor stopper før VR.'),
  set:'rwyTO',fail:{kind:'eng',ias:45},own:'efrun',crit:['idle','stopped'],critTxt:T('both power levers idle, aircraft stopped','begge effekthendler på tomgang, flyet stoppet'),critLim:[15,30]},
 {id:'s_efato',t:T('Engine failure after take-off','Motorstans etter avgang'),d:T('Just airborne at 400 ft. An engine fails.','Akkurat i lufta i 400 ft. En motor stopper.'),
  set:'efato',fail:{kind:'eng',at:3},own:['efato','eng'],crit:['pwrMaxLive','vyse','gearUp','engAffOff'],critTxt:T('live engine at full power, blue line, gear up, failed engine secured','full effekt på den levende motoren, blå linje, understell oppe, motoren som sviktet sikret'),critLim:[25,50]},
 {id:'s_efflt',t:T('Engine failure in cruise','Motorstans i marsj'),d:T('Cruise at 5000 ft. An engine fails.','Marsj i 5000 ft. En motor stopper.'),
  set:'cruise',fail:{kind:'eng',at:6},own:['efflt','eng'],crit:['pwrLive92','engAffOff'],critTxt:T('power on the live engine, failed engine secured','effekt på den levende motoren, motoren som sviktet sikret'),critLim:[30,60]},
 {id:'s_fireflt',t:T('Engine fire in flight','Motorbrann i lufta'),d:T('Cruise at 5000 ft. An engine fire warning comes.','Marsj i 5000 ft. Et motorbrannvarsel kommer.'),
  set:'cruise',fail:{kind:'fire',at:6},own:'fire_air',crit:['heatOff','engAffOff','fselAffOff'],critTxt:T('heat off, that engine shut down and its fuel off','varme av, motoren stoppet og drivstoffet av'),critLim:[20,45]},
 {id:'s_firegnd',t:T('Engine fire on the ground','Motorbrann på bakken'),d:T('Engines running on the apron. A fire warning comes.','Motorene går på oppstillingsplassen. Et brannvarsel kommer.'),
  set:'running',fail:{kind:'fire',at:4},own:'fire_gnd',crit:['engsOff','fselsOff','elecOff'],critTxt:T('engines, fuel and master off','motorer, drivstoff og master av'),critLim:[15,30]},
 {id:'s_altn',t:T('Alternator failure','Generatorsvikt'),d:T('Cruise at 5000 ft. An alternator fails.','Marsj i 5000 ft. En generator svikter.'),
  set:'cruise',fail:{kind:'alt',at:5},own:'alt',crit:['altAffOff'],critTxt:T('failed alternator off','generatoren som sviktet av'),critLim:[30,90]},
 {id:'s_ecua',t:T('ECU A failure','ECU A-svikt'),d:T('Cruise at 5000 ft. An ECU caution comes.','Marsj i 5000 ft. Et ECU-varsel kommer.'),
  set:'cruise',fail:{kind:'ecuA',at:5},own:'ecu',crit:['pumpsOn','altAirOpen'],critTxt:T('fuel pumps on, alternate air open','drivstoffpumper på, alternativ luft åpen'),critLim:[30,90]},
 {id:'s_gear',t:T('Landing gear unsafe','Understell usikkert'),d:T('2000 ft on vectors, gear up. The gear will not lock down.','2000 ft på vektorer, understell oppe. Understellet låser seg ikke nede.'),
  set:'appr',fail:{kind:'gear',onGear:1},own:'gear',crit:['gear3'],critTxt:T('gear down and locked','understell nede og låst'),critLim:[60,120]},
 {id:'s_pfd',t:T('PFD failure','PFD-svikt'),d:T('Cruise at 5000 ft. The PFD goes dark.','Marsj i 5000 ft. PFD-en blir mørk.'),
  set:'cruise',fail:{kind:'pfd',at:5},own:'pfd',crit:['backup'],critTxt:T('display backup selected','display backup valgt'),critLim:[10,30]}
];

/* failures the page can trigger on the flight you have (Procedures → Failures and the page's failure menu) */
const FAILS=[
 {kind:'fire',side:1,t:T('Engine fire','Motorbrann')},
 {kind:'alt',side:1,t:T('Alternator failure','Generatorsvikt')},
 {kind:'ecuA',side:1,t:T('ECU A failure','ECU A-svikt')},
 {kind:'gear',t:T('Gear will not extend','Understellet felles ikke ut')},
 {kind:'pfd',t:T('PFD failure','PFD-svikt')}
];

/* ---------- key speeds (KIAS), DA42 NG / DA42-VI with the 1999 kg modification ---------- */
const SPEEDS=[
 ['VR',T('Rotation, flaps UP','Rotasjon, flaps UP'),'min. 76'],
 ['VX',T('Best angle, flaps APP','Beste stigevinkel, flaps APP'),'77'],
 ['VY',T('Best rate, flaps UP','Beste stigerate, flaps UP'),'90'],
 ['VYSE',T('One engine, blue line','Én motor, blå linje'),'85'],
 ['VMCA',T('Red line · flaps UP · APP','Rød linje · flaps UP · APP'),'71 · 68'],
 ['VO',T('Manoeuvring · up to 1700 · 1800 · above 1800 kg','Manøvrering · opptil 1700 · 1800 · over 1800 kg'),'112 · 119 · 122'],
 ['VFE',T('Flaps · APP · LDG','Flaps · APP · LDG'),'133 · 113'],
 ['VLO',T('Gear · extend · retract','Understell · ut · inn'),'188 · 152'],
 ['VLE',T('Gear extended','Understell ute'),'188'],
 ['VNO',T('Max structural cruise','Maks strukturell marsjfart'),'151'],
 ['VNE',T('Never exceed','Aldri overskrid'),'188']
];

G.DA42PROCS={CK,SCENS,FAILS,SPEEDS};
})(window);
