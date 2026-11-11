/* Birdbird – DA42 NG / DA42-VI procedures: normal flows, emergency and abnormal checklists, failure scenarios and the AFM speeds.
   Written by Birdbird from the facts in the manufacturer's AFM (sections 2, 3, 4A, 4B); flow order and callouts follow common
   ATO practice. Training use only — always use the approved AFM and the company checklists.
   Data only, plus a small renderer for the Procedures drawer. Nothing here runs per frame except the one predicate of the
   current step (called by the page's procTick).

   Item: {c:challenge, r:response, k:auto-tick key in CK (null = tick by hand), mem:memory item, call:callout, sec:section
   heading shown above the item, chk:verification item (must hold 0.7 s)}. Text may contain {E} (affected engine, L/R) and
   {O} (the other, live engine). CK predicates get the page context c = {S, SYS, o, AP, i (affected engine 0/1), dt,
   cb(name), cbAll()} and a per-step memo m. CK ctl is the panel control to highlight; '*' = affected side, '~' = live side. */
(function(G){
'use strict';
const T=(en,no)=>({en,no:no==null?en:no});
const DISC=T("Based on the manufacturer's AFM; training use only — always use your approved AFM and company checklists.",
  'Basert på produsentens AFM; kun for trening — bruk alltid godkjent AFM og selskapets sjekklister.');
const VARIANT='DA42 NG / DA42-VI · Austro AE300 (E4-C) · G1000 NXi · GFC 700';

/* ---------- auto-tick predicates ---------- */
const sd=c=>c.i?'R':'L', od=c=>c.i?'L':'R';
const both=(c,k,v)=>c.SYS[k+'L']===v&&c.SYS[k+'R']===v;
const CK={
  park:{ctl:'park',f:c=>!!c.SYS.park},
  parkOff:{ctl:'park',f:c=>!c.SYS.park},
  idle:{ctl:'pwr',f:c=>c.S.eng.every(e=>e.thr<0.05)},
  idle10:{ctl:'pwr',f:c=>c.S.eng.every(e=>e.thr<0.12)},
  pwrMax:{ctl:'pwr',f:c=>c.S.eng.every(e=>e.thr>0.95)},
  pwrMaxLive:{ctl:'pwr',f:c=>c.S.eng[1-c.i].thr>0.95},
  pwrLive92:{ctl:'pwr',f:c=>c.S.eng[1-c.i].thr>0.85},
  pwrAffIdle:{ctl:'pwr',f:c=>c.S.eng[c.i].thr<0.05},
  pwrClimb:{ctl:'pwr',f:c=>c.S.eng.every(e=>e.thr>0.86&&e.thr<0.96)},
  pwrCruise:{ctl:'pwr',f:c=>c.S.eng.every(e=>e.thr>=0.4&&e.thr<=0.93)},
  avioOn:{ctl:'avio',f:c=>!!c.SYS.avio}, avioOff:{ctl:'avio',f:c=>!c.SYS.avio},
  elecOn:{ctl:'elec',f:c=>!!c.SYS.elec}, elecOff:{ctl:'elec',f:c=>!c.SYS.elec},
  elecOffAfter:{ctl:'elec',f:c=>!c.SYS.elec&&c.S.eng.every(e=>e.rpm<300)},
  emerOn:{ctl:'emer',f:c=>!!c.SYS.emer},
  ack:{ctl:'bzM',f:c=>!!c.SYS.ack},
  backup:{ctl:'audBackup',f:c=>!!c.SYS.backup},
  gearDown:{ctl:'gear',f:c=>c.S.ctl.gear===1},
  gear3:{ctl:'gear',f:c=>c.S.ctl.gear===1&&c.S.ctl.gearPos>0.99},
  gearUp:{ctl:'gear',f:c=>c.S.ctl.gear===0},
  gearUpPos:{ctl:'gear',f:c=>c.S.ctl.gear===0&&!c.S.ground&&c.o.vs>50},
  gearUpLocked:{ctl:'gear',f:c=>c.S.ctl.gear===0&&c.S.ctl.gearPos<0.01},
  gearRecycle:{ctl:'gear',f:(c,m)=>{ if(c.S.ctl.gear===0) m.up=1; return !!m.up&&c.S.ctl.gear===1; }},
  gearEmer:{ctl:'gearEmer',f:c=>!!c.SYS.gearEmer},
  flapsUp:{ctl:'flaps',f:c=>c.S.ctl.flap===0},
  flapsApp:{ctl:'flaps',f:c=>c.S.ctl.flap===1},
  flapsAppDown:{ctl:'flaps',f:c=>c.S.ctl.flap>=1},
  flapsLdg:{ctl:'flaps',f:c=>c.S.ctl.flap===2},
  flapsCycle:{ctl:'flaps',f:(c,m)=>{ if(c.S.ctl.flap>0) m.b=1; return !!m.b&&c.S.ctl.flap===0&&c.S.ctl.flapPos<0.05; }},
  trimTO:{ctl:'trim',f:c=>Math.abs(c.S.ctl.trim-0.05)<0.08},
  rudTrim0:{ctl:'rudTrim',f:c=>Math.abs(c.SYS.rudTrim||0)<0.05},
  votersAuto:{ctl:'voterL',f:c=>both(c,'voter',1)},
  voterAffAuto:{ctl:'voter*',f:c=>c.SYS['voter'+sd(c)]===1},
  voterAffA:{ctl:'voter*',f:c=>c.SYS['voter'+sd(c)]===0},
  voterAffA5:{ctl:'voter*',f:(c,m)=>{ if(c.SYS['voter'+sd(c)]===0) m.t=(m.t||0)+(c.dt||0); return (m.t||0)>=5; }},
  voterLA:{ctl:'voterL',f:c=>c.SYS.voterL===0}, voterLAuto:{ctl:'voterL',f:c=>c.SYS.voterL===1}, voterLB:{ctl:'voterL',f:c=>c.SYS.voterL===2},
  voterRcycle:{ctl:'voterR',f:(c,m)=>{ if(c.SYS.voterR===0) m.a=1; if(c.SYS.voterR===2) m.b=1; return !!(m.a&&m.b)&&c.SYS.voterR===1; }},
  ecuL:{ctl:'ecuL',f:c=>!!c.SYS.ecuDone[0]}, ecuR:{ctl:'ecuR',f:c=>!!c.SYS.ecuDone[1]},
  altsOn:{ctl:'altL',f:c=>!!(c.SYS.altL&&c.SYS.altR)}, altsOff:{ctl:'altL',f:c=>!c.SYS.altL&&!c.SYS.altR},
  altAffOff:{ctl:'alt*',f:c=>!c.SYS['alt'+sd(c)]}, altAffOn:{ctl:'alt*',f:c=>!!c.SYS['alt'+sd(c)]},
  pumpsOff:{ctl:'pumpL',f:c=>!c.SYS.pumpL&&!c.SYS.pumpR}, pumpsOn:{ctl:'pumpL',f:c=>!!(c.SYS.pumpL&&c.SYS.pumpR)},
  pumpAffOff:{ctl:'pump*',f:c=>!c.SYS['pump'+sd(c)]}, pumpAffOn:{ctl:'pump*',f:c=>!!c.SYS['pump'+sd(c)]},
  pumpLiveOn:{ctl:'pump~',f:c=>!!c.SYS['pump'+od(c)]},
  fselsOn:{ctl:'fselL',f:c=>both(c,'fsel',0)}, fselsX:{ctl:'fselL',f:c=>both(c,'fsel',1)}, fselsOff:{ctl:'fselL',f:c=>both(c,'fsel',2)},
  fselAffOn:{ctl:'fsel*',f:c=>c.SYS['fsel'+sd(c)]===0}, fselAffX:{ctl:'fsel*',f:c=>c.SYS['fsel'+sd(c)]===1}, fselAffOff:{ctl:'fsel*',f:c=>c.SYS['fsel'+sd(c)]===2},
  fselLiveOn:{ctl:'fsel~',f:c=>c.SYS['fsel'+od(c)]===0}, fselLiveFeed:{ctl:'fsel~',f:c=>c.SYS['fsel'+od(c)]!==2},
  engsOff:{ctl:'engL',f:c=>!c.SYS.engL&&!c.SYS.engR},
  engAffOff:{ctl:'eng*',f:c=>!c.SYS['eng'+sd(c)]}, engAffOn:{ctl:'eng*',f:c=>!!c.SYS['eng'+sd(c)]},
  engLOn:{ctl:'engL',f:c=>!!c.SYS.engL}, engROn:{ctl:'engR',f:c=>!!c.SYS.engR},
  glowL:{ctl:'bzP',f:c=>!!c.SYS.engL&&c.SYS.glow[0]<=0}, glowR:{ctl:'bzP',f:c=>!!c.SYS.engR&&c.SYS.glow[1]<=0},
  runL:{ctl:'start',f:c=>c.S.eng[0].run&&c.SYS.start===0}, runR:{ctl:'start',f:c=>c.S.eng[1].run&&c.SYS.start===0},
  oilL:{ctl:'bzM',f:c=>c.S.eng[0].oilP>1.5&&c.S.eng[0].rpm>650}, oilR:{ctl:'bzM',f:c=>c.S.eng[1].oilP>1.5&&c.S.eng[1].rpm>650},
  strobeOn:{ctl:'strobe',f:c=>!!c.SYS.strobe}, strobeOff:{ctl:'strobe',f:c=>!c.SYS.strobe},
  navOn:{ctl:'nav',f:c=>!!c.SYS.nav}, landOn:{ctl:'land',f:c=>!!c.SYS.land}, landOff:{ctl:'land',f:c=>!c.SYS.land},
  lightsOff:{ctl:'strobe',f:c=>!c.SYS.strobe&&!c.SYS.nav&&!c.SYS.land&&!c.SYS.taxi},
  consumersOff:{ctl:'land',f:c=>!c.SYS.land&&!c.SYS.taxi&&!c.SYS.pitot},
  pitotOn:{ctl:'pitot',f:c=>!!c.SYS.pitot}, pitotOff:{ctl:'pitot',f:c=>!c.SYS.pitot},
  pitotCycle:{ctl:'pitot',f:(c,m)=>{ if(c.SYS.pitot) m.b=1; return !!m.b&&!c.SYS.pitot; }},
  fireTest:{ctl:'fireTest',f:(c,m)=>{ if(c.SYS.fireTest) m.b=1; return !!m.b; }},
  altAirOpen:{ctl:'altAir',f:c=>!!c.SYS.altAir}, altAirClosed:{ctl:'altAir',f:c=>!c.SYS.altAir},
  heatOff:{ctl:'heat',f:c=>c.SYS.heat<0.05&&c.SYS.defrost<0.05}, heatOn:{ctl:'heat',f:c=>c.SYS.heat>0.5&&c.SYS.defrost>0.5},
  cbsIn:{ctl:'cb0',f:c=>c.cbAll()}, cbGear:{ctl:'cb18',f:c=>c.cb('LDG GEAR')}, cbApPulled:{ctl:'cb16',f:c=>!c.cb('AUTOPILOT')},
  eltOff:{ctl:'elt',f:c=>c.SYS.elt!==-1},
  apOff:{ctl:'apDisc',f:c=>!c.AP.on},
  /* flight path (highlight the PFD) */
  iasAlive:{ctl:'bzP',f:c=>c.o.ias>=40},
  rotate:{ctl:'bzP',f:c=>!c.S.ground},
  climb83:{ctl:'bzP',f:c=>!c.S.ground&&c.o.ias>=83},
  vy:{ctl:'bzP',f:c=>!c.S.ground&&c.o.ias>=85&&c.o.ias<=100},
  vyse:{ctl:'bzP',f:c=>!c.S.ground&&c.o.ias>=82&&c.o.ias<=100},
  aboveVmc:{ctl:'bzP',f:c=>c.o.ias>=(c.S.ctl.flap>=1?68:71)},
  ias85:{ctl:'bzP',f:c=>c.o.ias>=85},
  iasGa:{ctl:'bzP',f:c=>c.o.ias>=88},
  vref:{ctl:'bzP',f:c=>c.o.ias>=82&&c.o.ias<=100},
  below152:{ctl:'bzP',f:c=>c.o.ias<152}, below140:{ctl:'bzP',f:c=>c.o.ias<140}, below117:{ctl:'bzP',f:c=>c.o.ias<117},
  dirCtl:{ctl:'bzP',f:c=>Math.abs(c.S.r||0)<0.06&&Math.abs(c.o.roll)<20},
  bankLive:{ctl:'bzP',f:c=>{ const b=c.o.roll*(c.i===0?1:-1); return b>=1.5&&b<=8; }},
  stopped:{ctl:'bzP',f:c=>c.S.ground&&c.o.gs<3}
};

/* ---------- builders ---------- */
const I=(c,r,k,o)=>Object.assign({c:Array.isArray(c)?T(c[0],c[1]):typeof c==='string'?T(c):c,r:Array.isArray(r)?T(r[0],r[1]):typeof r==='string'?T(r):r,k:k||null},o||{});
const M=(c,r,k,o)=>I(c,r,k,Object.assign({mem:1},o||{}));
const S=(en,no)=>T(en,no);
/* callouts (standard phraseology stays English) */
const CALL={
  power:T('“Power set — engine instruments checked”'), alive:T('“Airspeed alive”'), rotate:T('“Rotate”'),
  posgear:T('“Positive climb — gear up”'), flapsUp:T('“Flaps up”'), ga:T('“Go around — flaps”'),
  efcont:T('“Engine failure — continue”'), efstop:T('“Stopping”'), ef:T('“Engine failure”'),
  gf:T('“Gear up — flaps up”'), ivs:T('“Identify — verify — secure”'), dead:T('“Dead foot — dead engine”'),
  stable:T('At 1000 ft (500 ft visual): “Stable, continuing” or “Unstable, going around”','Ved 1000 ft (500 ft visuelt): «Stable, continuing» eller «Unstable, going around»'),
  onetogo:T('1000 ft before the cleared level: “One to go”','1000 ft før klarert høyde: «One to go»'),
  brakes:T('“Brakes checked”'), fltinst:T('“Flight instruments checked”'), hdg:T('“Heading — compass checked”')
};

/* ---------- normal flows (AFM 4A.6, flow order and callouts as common ATO SOP practice) ---------- */
const FLOWS=[
 {id:'preflight',g:'gnd',set:'cold',t:T('Preflight cockpit check','Cockpitsjekk før flyging'),ref:'AFM 4A.6.1',
  brief:T('Cold and dark. Cabin check before the walk-around: documents, fuel, safety equipment, then a quick electrical check with the master and back off.','Kald og mørk. Kabinsjekk før walk-around: dokumenter, drivstoff, sikkerhetsutstyr, og en rask elektrisk sjekk med masteren — og av igjen.'),
  items:[I(['Aircraft documents','Flydokumenter'],'CHECKED'),I(['Fuel system','Drivstoffsystem'],'DRAINED'),
   I(['Fire extinguisher, first aid kit','Brannslukker, førstehjelpsskrin'],'CHECKED'),
   I('ELECT. MASTER','ON','elecOn'),I(['Fuel quantity','Drivstoffmengde'],'CHECKED'),
   I(['Lights','Lys'],['CHECKED, then OFF','SJEKKET, så AV']),I(['Pitot heat','Pitotvarme'],['CHECKED, then OFF','SJEKKET, så AV'],'pitotCycle'),
   I(['Electrical equipment','Elektrisk utstyr'],'OFF','consumersOff',{chk:1}),I('ELECT. MASTER','OFF','elecOff'),
   I(['Walk-around','Walk-around'],'COMPLETE'),I(['Baggage','Bagasje'],'SECURED')]},
 {id:'bse',g:'gnd',set:'cold',t:T('Before start','Før start'),ref:'AFM 4A.6.2',
  brief:T('Cold and dark on the apron. Set up the cockpit, then power up the electrics and the G1000.','Kald og mørk på oppstillingsplassen. Klargjør cockpiten, slå så på strømmen og G1000.'),
  items:[I(['Preflight, passenger briefing','Preflight, passasjerbriefing'],'COMPLETE'),I(['Pitot cover, chocks, control lock','Pitottrekk, klosser, rorlås'],'REMOVED'),
   I(['Front baggage doors, rear door','Bagasjeluker foran, bakdør'],'CLOSED & LOCKED'),I(['Front canopy','Kanopi foran'],'POSITION 1 or 2'),
   I(['Backrests','Seterygger'],'UPRIGHT'),I(['Rudder pedals','Rorpedaler'],'ADJUSTED'),I(['Safety harnesses','Seler'],'ON & FASTENED'),
   I(['Power levers','Effekthendler'],'IDLE','idle',{chk:1}),I(['Parking brake','Parkeringsbrems'],'SET','park'),
   I('AVIONIC MASTER',['check OFF','sjekk AV'],'avioOff',{chk:1}),I(['Gear selector','Understellsvelger'],['check DOWN','sjekk NEDE'],'gearDown',{chk:1}),
   I(['VOTER switches','VOTER-brytere'],['check AUTO','sjekk AUTO'],'votersAuto',{chk:1}),I(['Alternators','Generatorer'],['check ON','sjekk PÅ'],'altsOn',{chk:1}),
   I(['Fuel pumps','Drivstoffpumper'],['check OFF','sjekk AV'],'pumpsOff',{chk:1}),I(['Fuel selectors','Drivstoffvelgere'],'ON','fselsOn',{chk:1}),
   I('ELECT. MASTER','ON','elecOn'),I('G1000',['POWER-UP, ENT on the MFD','OPPSTART, ENT på MFD'],'ack'),
   I(['Fuel temperature','Drivstofftemperatur'],'CHECKED'),I(['Flight controls, variable elevator backstop','Flykontroller, variabelt høyderorsstopp'],'CHECKED'),
   I(['Gear warning, fire detection','Understellsvarsel, brannvarsling'],'TESTED','fireTest')]},
 {id:'start',g:'gnd',set:'powered',t:T('Engine start','Motorstart'),ref:'AFM 4A.6.3',
  brief:T('Electrics on, G1000 acknowledged. Start the left engine, then the right. Starter max 10 s; oil pressure out of the red within 3 s.','Strøm på og G1000 kvittert. Start venstre motor, så høyre. Starter maks 10 s; oljetrykket ut av rødt innen 3 s.'),
  items:[I(['Strobe lights','Antikollisjonslys'],'ON','strobeOn'),I(['Propeller area','Propellområdet'],'CLEAR',null,{call:T('“Clear left”, “Clear right”')}),
   I('ENGINE MASTER L','ON','engLOn'),I('L ENGINE GLOW',['wait until OUT','vent til SLUKKET'],'glowL'),
   I(['START key','START-nøkkel'],['L, release when running (max 10 s)','L, slipp når den går (maks 10 s)'],'runL'),
   I(['Oil pressure, STARTER caution, idle RPM','Oljetrykk, STARTER-varsel, tomgang'],['UP, OUT, 710 ±30','OPPE, SLUKKET, 710 ±30'],'oilL',{chk:1}),
   I('ENGINE MASTER R','ON','engROn',{sec:T('Right engine','Høyre motor')}),I('R ENGINE GLOW',['wait until OUT','vent til SLUKKET'],'glowR'),
   I(['START key','START-nøkkel'],['R, release when running (max 10 s)','R, slipp når den går (maks 10 s)'],'runR'),
   I(['Oil pressure, STARTER caution, idle RPM','Oljetrykk, STARTER-varsel, tomgang'],['UP, OUT, 710 ±30','OPPE, SLUKKET, 710 ±30'],'oilR',{chk:1}),
   I(['Circuit breakers','Sikringer'],['check IN','sjekk INNE'],'cbsIn',{chk:1})]},
 {id:'after',g:'gnd',set:'running',t:T('After start','Etter start'),ref:'AFM 4A.6.4',
  brief:T('Both engines running. Avionics on, heating test, autopilot test and set-up before taxi. Max 50 % power until the engines are in the green.','Begge motorer går. Avionikk på, varmetest, autopilottest og oppsett før taksing. Maks 50 % effekt til motorene er i grønt.'),
  items:[I(['Annunciations, engine instruments','Varsler, motorinstrumenter'],'CHECKED'),I('AVIONIC MASTER','ON','avioOn'),
   I(['Pitot and stall warning heat','Pitot- og stallvarselvarme'],['ON, check annunciation','PÅ, sjekk varsel'],'pitotOn'),I(['Pitot heat','Pitotvarme'],'OFF','pitotOff'),
   I(['Strobe lights','Antikollisjonslys'],['check ON','sjekk PÅ'],'strobeOn',{chk:1}),I(['Position lights','Posisjonslys'],'ON','navOn'),
   I(['PFD: autopilot pre-flight test','PFD: autopilotens selvtest'],['no AP annunciation, disconnect tone','ingen AP-varsel, utkoblingstone']),
   I(['Manual electric trim','Manuell elektrisk trim'],['TEST (no movement with AP DISC held)','TEST (ingen bevegelse med AP DISC holdt inne)']),
   I(['Elevator trim','Høyderortrim'],'T/O','trimTO'),I(['Flaps','Flaps'],['CHECK, then UP','SJEKK, så UP'],'flapsCycle'),
   I(['Altimeters','Høydemålere'],'SET & CROSS-CHECKED'),I(['ATIS, ATC clearance','ATIS, ATC-klarering'],'RECEIVED'),
   I(['G1000 set-up, nav aids','G1000-oppsett, navigasjonshjelpemidler'],'SET & IDENTIFIED')]},
 {id:'taxi',g:'gnd',set:'running',t:T('Taxi','Taksing'),ref:'AFM 4A.6.5',
  brief:T('Release the brake, test the brakes and the steering, check the instruments in the turns and test the crossfeed for about 30 s.','Slipp bremsen, test bremser og nesehjulsstyring, sjekk instrumentene i svingene og test crossfeed i rundt 30 s.'),
  items:[I(['Parking brake','Parkeringsbrems'],'RELEASED','parkOff'),I(['Brakes','Bremser'],['CHECK on moving off','SJEKK når du ruller'],null,{call:CALL.brakes}),
   I(['Nose-wheel steering','Nesehjulsstyring'],'CHECKED'),I(['Flight instruments','Flyinstrumenter'],'CHECKED',null,{call:CALL.fltinst}),
   I(['Fuel pumps','Drivstoffpumper'],['check OFF','sjekk AV'],'pumpsOff',{chk:1}),
   I(['Fuel selectors','Drivstoffvelgere'],['CROSSFEED (test, about 30 s)','CROSSFEED (test, rundt 30 s)'],'fselsX'),I(['Fuel selectors','Drivstoffvelgere'],'ON','fselsOn')]},
 {id:'bto',g:'gnd',set:'running',t:T('Before take-off and run-up','Før avgang og motorprøve'),ref:'AFM 4A.6.6',
  brief:T('At the holding point, parking brake set. Doors, trims, flaps, then the ECU test on both engines and the voter checks. Oil and gearbox temperatures must be green before the ECU test.','På venteposisjonen, parkeringsbrems på. Dører, trim, flaps, så ECU-test på begge motorer og voter-sjekk. Olje- og girkassetemperatur må være grønne før ECU-testen.'),
  items:[I(['Parking brake','Parkeringsbrems'],'SET','park'),I(['Backrests, harnesses','Seterygger, seler'],'UPRIGHT, FASTENED'),
   I(['Rear door, canopy, baggage doors','Bakdør, kanopi, bagasjeluker'],'CLOSED & LOCKED'),I(['DOOR warning','DOOR-varsel'],['none','ingen']),
   I(['Annunciations, engine instruments','Varsler, motorinstrumenter'],'CHECKED'),I(['Circuit breakers','Sikringer'],'IN','cbsIn',{chk:1}),
   I(['Elevator trim','Høyderortrim'],'T/O','trimTO'),I(['Fuel selectors','Drivstoffvelgere'],['check ON (no take-off on crossfeed)','sjekk ON (ikke avgang på crossfeed)'],'fselsOn',{chk:1}),
   I(['Rudder trim','Sideror-trim'],'NEUTRAL','rudTrim0',{chk:1}),I(['Flaps','Flaps'],['check function, UP','sjekk funksjon, UP'],'flapsCycle'),
   I(['Flight controls','Flykontroller'],['FREE, correct sense','FRIE, riktig retning']),I(['Pitot heat','Pitotvarme'],['AS REQUIRED','ETTER BEHOV']),
   I(['Power levers','Effekthendler'],'IDLE','idle',{sec:T('ECU test','ECU-test')}),I(['Fuel pumps','Drivstoffpumper'],['check OFF','sjekk AV'],'pumpsOff',{chk:1}),
   I(['VOTER switches','VOTER-brytere'],['check AUTO','sjekk AUTO'],'votersAuto',{chk:1}),
   I('ECU TEST L',['press and hold to the end of the sequence','trykk og hold til sekvensen er ferdig'],'ecuL'),
   I('ECU TEST R',['press and hold to the end of the sequence','trykk og hold til sekvensen er ferdig'],'ecuR'),
   I('VOTER L',['ECU A — engine runs on','ECU A — motoren går videre'],'voterLA'),I('VOTER L','AUTO','voterLAuto'),
   I('VOTER L',['ECU B — engine runs on','ECU B — motoren går videre'],'voterLB'),I('VOTER L','AUTO','voterLAuto'),
   I('VOTER R',['ECU A, AUTO, ECU B, AUTO','ECU A, AUTO, ECU B, AUTO'],'voterRcycle'),
   I(['Power check','Effektsjekk'],['MAX 10 s on the brakes: 2250–2300 RPM, load 89–100 %','MAX 10 s på bremsene: 2250–2300 RPM, last 89–100 %'],null,{sec:T('Power check','Effektsjekk')}),
   I(['Power levers','Effekthendler'],'IDLE','idle'),I(['Fuel pumps','Drivstoffpumper'],'ON','pumpsOn'),
   I(['Departure and emergency briefing','Avgangs- og nødbriefing'],['GIVEN (runway, routing, abort plan, engine failure actions)','GITT (bane, rute, avbruddsplan, tiltak ved motorstans)']),
   I(['Transponder','Transponder'],'CHECKED')]},
 {id:'lineup',g:'gnd',set:'runway',t:T('Line-up','Oppstilling'),ref:'AFM 4A.6.6 · SOP',
  brief:T('Cleared to line up. Lights, both fuel pumps on, final cockpit check and the heading against the runway.','Klarert til oppstilling. Lys, begge drivstoffpumper på, siste cockpitsjekk og kursen mot banen.'),
  items:[I(['Landing light','Landingslys'],['ON when cleared','PÅ når klarert'],'landOn'),I(['Strobe lights','Antikollisjonslys'],'ON','strobeOn',{chk:1}),
   I(['Fuel pumps','Drivstoffpumper'],['BOTH ON','BEGGE PÅ'],'pumpsOn',{chk:1}),I(['Backrests','Seterygger'],'UPRIGHT'),
   I(['Front canopy, windows','Kanopi foran, vinduer'],'CLOSED & LOCKED'),I(['Heading indicator, compass','Kursindikator, kompass'],['CHECKED against the runway','SJEKKET mot banen'],null,{call:CALL.hdg}),
   I(['Pitot heat, alternate air, de-ice','Pitotvarme, alternativ luft, avising'],['AS REQUIRED','ETTER BEHOV'])]},
 {id:'takeoff',g:'flt',set:'rwyTO',t:T('Take-off','Avgang'),ref:'AFM 4A.6.7',
  brief:T('Runway 36, flaps UP, fuel pumps on. Full power, check both engines early, rotate at VR min 76 KIAS, climb at min 83 KIAS and VY 90 when clear of obstacles. Gear up with a positive climb when you can no longer land ahead.','Bane 36, flaps UP, drivstoffpumper på. Full effekt, sjekk begge motorene tidlig, roter ved VR min. 76 KIAS, stig med min. 83 KIAS og VY 90 når du er klar av hindringer. Understell opp med positiv stigning når du ikke lenger kan lande rett frem.'),
  items:[I(['Transponder','Transponder'],['AS REQUIRED','ETTER BEHOV']),
   I(['Power levers','Effekthendler'],'MAX','pwrMax',{call:CALL.power}),I(['Airspeed','Fart'],['ALIVE','LEVENDE'],'iasAlive',{call:CALL.alive}),
   I(['Elevator neutral, rudder','Høyderor nøytralt, sideror'],['maintain the centreline','hold senterlinjen'],'dirCtl'),
   I(['Rotate','Roter'],['VR min. 76 KIAS','VR min. 76 KIAS'],'rotate',{call:CALL.rotate}),
   I(['Initial climb','Første stigning'],['min. 83 KIAS, VY 90 when clear','min. 83 KIAS, VY 90 når klar'],'climb83'),
   I(['Landing gear','Understell'],['brakes, then UP','bremser, så OPP'],'gearUpPos',{call:CALL.posgear}),
   I(['Gear unsafe light','Understell-varsellys'],['OUT','SLUKKET'],'gearUpLocked',{chk:1}),
   I(['Fuel pumps','Drivstoffpumper'],['OFF when a safe climb is established','AV når sikker stigning er etablert'],'pumpsOff'),
   I(['Alternate air','Alternativ luft'],['OPEN in rain, snow or visible moisture','ÅPEN i regn, snø eller synlig fuktighet'])]},
 {id:'aftto',g:'flt',set:'airTO',t:T('After take-off','Etter avgang'),ref:'AFM 4A.6.7 · 4A.6.8',
  brief:T('Just airborne at 500 ft with the gear still down. Clean up and set climb power.','Akkurat i lufta i 500 ft med understellet fortsatt ute. Rydd opp og sett stigeeffekt.'),
  items:[I(['Landing gear','Understell'],['UP with a positive climb','OPP med positiv stigning'],'gearUpPos',{call:CALL.posgear}),
   I(['Gear unsafe light','Understell-varsellys'],['OUT','SLUKKET'],'gearUpLocked',{chk:1}),I(['Flaps','Flaps'],['check UP','sjekk UP'],'flapsUp',{chk:1}),
   I(['Climb power','Stigeeffekt'],'92 %','pwrClimb'),I(['Airspeed','Fart'],['VY 90 KIAS (92 above 1900 kg)','VY 90 KIAS (92 over 1900 kg)'],'vy'),
   I(['Fuel pumps','Drivstoffpumper'],'OFF','pumpsOff'),I(['Landing light','Landingslys'],['AS REQUIRED','ETTER BEHOV'])]},
 {id:'climb',g:'flt',set:'climb',t:T('Climb','Stigning'),ref:'AFM 4A.6.8',
  brief:T('Climbing through 2000 ft. Climb at VY or cruise climb speed with 92 % power. If oil or coolant gets into the yellow: 10 KIAS faster and 10 % less power.','Stiger gjennom 2000 ft. Stig med VY eller marsjstigefart og 92 % effekt. Hvis olje eller kjølevæske kommer i gult: 10 KIAS raskere og 10 % mindre effekt.'),
  items:[I(['Landing gear, flaps','Understell, flaps'],['UP','OPPE'],'gearUpLocked',{chk:1}),I(['Altimeters','Høydemålere'],'SET & CROSS-CHECKED'),
   I(['Airspeed','Fart'],['90 KIAS or cruise climb','90 KIAS eller marsjstigning'],'vy'),I(['Power','Effekt'],'92 %','pwrClimb'),
   I(['Trim','Trim'],['ball centred','kula i midten']),I(['Engine instruments','Motorinstrumenter'],['MONITOR','OVERVÅK']),
   I(['Fuel pumps','Drivstoffpumper'],['check OFF','sjekk AV'],'pumpsOff',{chk:1}),I(['Level-off','Utflating'],['call ahead','varsle i forkant'],null,{call:CALL.onetogo})]},
 {id:'cruise',g:'flt',set:'cruise',t:T('Cruise','Marsj'),ref:'AFM 4A.6.9',
  brief:T('Level at 5000 ft. Up to 92 % power; the engine maker recommends 75 %.','Planflukt i 5000 ft. Opptil 92 % effekt; motorprodusenten anbefaler 75 %.'),
  items:[I(['Cruise power','Marsjeffekt'],['SET (75 % recommended, max 92 %)','SATT (75 % anbefalt, maks 92 %)'],'pwrCruise',{chk:1}),I(['Trim','Trim'],['AS REQUIRED','ETTER BEHOV']),
   I(['Engine instruments','Motorinstrumenter'],'CHECKED'),I(['Fuel','Drivstoff'],['CHECKED, balance with crossfeed if needed','SJEKKET, balanser med crossfeed ved behov']),I(['Alerts','Varsler'],'CHECKED')]},
 {id:'descent',g:'flt',set:'cruise',t:T('Descent and approach briefing','Nedstigning og innflygingsbriefing'),ref:'AFM 4A.6.10 · SOP',
  brief:T('Before top of descent: weather, briefing, altimeters, then descend with power as required.','Før toppen av nedstigningen: vær, briefing, høydemålere, så ned med effekt etter behov.'),
  items:[I(['ATIS, weather','ATIS, vær'],'RECEIVED'),I(['Approach briefing','Innflygingsbriefing'],['GIVEN (approach, minimums, missed approach, configuration)','GITT (innflyging, minima, bortflyging, konfigurasjon)']),
   I(['Altimeters (QNH)','Høydemålere (QNH)'],'SET & CROSS-CHECKED'),I(['Power, airspeed','Effekt, fart'],['AS REQUIRED','ETTER BEHOV']),
   I(['Engine instruments, fuel, alerts','Motorinstrumenter, drivstoff, varsler'],'CHECKED')]},
 {id:'appr',g:'flt',set:'appr',t:T('Approach','Innflyging'),ref:'AFM 4A.6.11',
  brief:T('2000 ft, being vectored for the ILS 36. Prepare the aircraft for landing before the final approach fix.','2000 ft, vektorert mot ILS 36. Gjør flyet klart for landing før sluttinnflygingspunktet.'),
  items:[I(['Backrests, harnesses','Seterygger, seler'],'UPRIGHT, FASTENED'),I(['Yaw damper','Giringsdemper'],['check OFF','sjekk AV']),
   I(['Controls','Kontroller'],['no interference','ingen hindringer']),I(['Landing light','Landingslys'],['AS REQUIRED','ETTER BEHOV']),
   I(['Gear warning horn','Understellsvarsel'],['CHECK function','SJEKK funksjon']),I(['Fuel selectors','Drivstoffvelgere'],['check ON','sjekk ON'],'fselsOn',{chk:1}),
   I(['Fuel pumps','Drivstoffpumper'],'ON','pumpsOn'),I(['Parking brake','Parkeringsbrems'],['check RELEASED','sjekk AV'],'parkOff',{chk:1}),
   I(['Directional trim','Sideror-trim'],'NEUTRAL','rudTrim0',{chk:1})]},
 {id:'bldg',g:'flt',set:'final',t:T('Before landing','Før landing'),ref:'AFM 4A.6.11',
  brief:T('Established on final, 1500 ft, flaps APP. Gear down, flaps LDG, final approach speed min 84 KIAS (86 above 1900 kg).','Etablert på finalen, 1500 ft, flaps APP. Understell ned, flaps LDG, sluttinnflygingsfart min. 84 KIAS (86 over 1900 kg).'),
  items:[I(['Landing gear','Understell'],['DOWN, 3 GREEN','NEDE, 3 GRØNNE'],'gear3'),I(['Flaps','Flaps'],['APP (min. 84 KIAS)','APP (min. 84 KIAS)'],'flapsAppDown'),
   I(['Airspeed','Fart'],['min. 84 KIAS flaps APP','min. 84 KIAS flaps APP'],'vref'),I(['Stable approach','Stabil innflyging'],['CALL','MELD'],null,{call:CALL.stable}),
   I(['Flaps','Flaps'],'LDG','flapsLdg'),I(['Final approach speed','Sluttinnflygingsfart'],['min. 84 KIAS (86 above 1900 kg)','min. 84 KIAS (86 over 1900 kg)'],'vref'),
   I(['Directional trim','Sideror-trim'],'NEUTRAL','rudTrim0',{chk:1})]},
 {id:'ga',g:'flt',set:'short',t:T('Go-around','Bortflyging'),ref:'AFM 4A.6.12',
  brief:T('Short final, 300 ft, gear down, flaps LDG — the runway is blocked. Go around: full power, flaps APP, min 90 KIAS, gear up with a positive climb, then flaps up.','Kort finale, 300 ft, understell ute, flaps LDG — banen er blokkert. Gå rundt: full effekt, flaps APP, min. 90 KIAS, understell opp med positiv stigning, så flaps opp.'),
  items:[I(['Power levers','Effekthendler'],'MAX','pwrMax',{call:CALL.ga,mem:1}),I(['Flaps','Flaps'],'APP','flapsApp',{mem:1}),
   I(['Airspeed','Fart'],['min. 90 KIAS','min. 90 KIAS'],'iasGa',{mem:1}),I(['Landing gear','Understell'],['UP with a positive climb','OPP med positiv stigning'],'gearUpPos',{call:CALL.posgear}),
   I(['Flaps','Flaps'],'UP','flapsUp',{call:CALL.flapsUp}),I(['Fuel pumps','Drivstoffpumper'],['OFF when the climb is safe','AV når stigningen er sikker'],'pumpsOff'),
   I(['Missed approach','Bortflygingsprosedyre'],['FLY, set the altitude','FLY, still høyden'])]},
 {id:'aftldg',g:'gnd',set:'landed',t:T('After landing','Etter landing'),ref:'AFM 4A.6.13',
  brief:T('Runway vacated. Clean up.','Klar av banen. Rydd opp.'),
  items:[I(['Power levers','Effekthendler'],'IDLE','idle'),I(['Flaps','Flaps'],'UP','flapsUp'),I(['Alternate air','Alternativ luft'],'CLOSED','altAirClosed',{chk:1}),
   I(['Pitot heat','Pitotvarme'],'OFF','pitotOff'),I(['Fuel pumps','Drivstoffpumper'],['BOTH OFF','BEGGE AV'],'pumpsOff'),
   I(['Landing light','Landingslys'],['OFF (taxi light on)','AV (takselys på)'],'landOff'),I(['Avionics','Avionikk'],['AS REQUIRED','ETTER BEHOV'])]},
 {id:'shut',g:'gnd',set:'landed',t:T('Parking and shut-down','Parkering og avslutning'),ref:'AFM 4A.6.14',
  brief:T('On the stand. Cool the turbochargers at max 10 % load for one minute, then shut down.','På plassen. Kjøl turboene med maks 10 % last i ett minutt, slå så av.'),
  items:[I(['Parking brake','Parkeringsbrems'],'SET','park'),I(['Power levers','Effekthendler'],['max 10 % load for 1 minute','maks 10 % last i 1 minutt'],'idle10',{chk:1}),
   I(['Engine and system page','Motor- og systemside'],'CHECKED'),I('ELT',['check not transmitting','sjekk at den ikke sender'],'eltOff',{chk:1}),
   I('AVIONIC MASTER','OFF','avioOff'),I(['Electrical consumers','Strømforbrukere'],'OFF','consumersOff'),
   I(['ENGINE MASTERS','ENGINE MASTER'],['BOTH OFF','BEGGE AV'],'engsOff'),I(['Strobe lights','Antikollisjonslys'],'OFF','strobeOff'),
   I('ELECT. MASTER',['OFF after the engine data are X-ed','AV når motordataene er krysset ut'],'elecOffAfter')]}
];

/* ---------- emergency and abnormal checklists (AFM 3 and 4B) ---------- */
const GROUPS=[
 ['eng',T('Engine failure and one engine inoperative','Motorstans og én motor ute')],
 ['fire',T('Fire, smoke and fumes','Brann, røyk og gass')],
 ['ind',T('Engine indications and ECU','Motorvisninger og ECU')],
 ['elec',T('Electrical','Elektrisk')],
 ['fuel',T('Fuel','Drivstoff')],
 ['gear',T('Landing gear, brakes and flaps','Understell, bremser og flaps')],
 ['avi',T('Avionics and autopilot','Avionikk og autopilot')],
 ['oth',T('Other','Annet')]
];
const SEC=T('Secure the engine (3.7.3)','Sikre motoren (3.7.3)');
const secure=(mem)=>[M(['Affected engine','Motoren som sviktet'],['IDENTIFY — VERIFY','IDENTIFISER — VERIFISER'],null,{sec:SEC,call:CALL.dead,mem:mem?1:0}),
  I('ENGINE MASTER {E}','OFF','engAffOff',{mem:mem?1:0,call:CALL.ivs}),I(['Alternator {E}','Generator {E}'],'OFF','altAffOff'),
  I(['Fuel pump {E}','Drivstoffpumpe {E}'],['check OFF','sjekk AV'],'pumpAffOff',{chk:1}),I(['Fuel selector {E}','Drivstoffvelger {E}'],'OFF','fselAffOff')];
const EMER=[
 /* engine failure */
 {id:'efrun',g:'eng',side:1,t:T('Engine failure during the take-off run','Motorstans under startrullet'),ref:'AFM 3.7.5 a',kw:'abort reject rto stopping',
  items:[M(['Take-off','Avgang'],['ABORT','AVBRYT'],null,{call:CALL.efstop}),M(['Power levers','Effekthendler'],['BOTH IDLE','BEGGE IDLE'],'idle'),
   M(['Rudder','Sideror'],['maintain directional control','hold retningen'],'dirCtl'),M(['Brakes','Bremser'],['AS REQUIRED — stop','ETTER BEHOV — stopp'],'stopped'),
   I(['ENGINE MASTERS','ENGINE MASTER'],['BOTH OFF','BEGGE AV'],'engsOff',{sec:T('If time permits (fire risk)','Hvis tiden tillater (brannfare)')}),
   I(['Fuel selectors','Drivstoffvelgere'],['BOTH OFF','BEGGE AV'],'fselsOff'),I('ELECT. MASTER','OFF','elecOff')]},
 {id:'efato',g:'eng',side:1,t:T('Engine failure after lift-off','Motorstans etter løft'),ref:'AFM 3.7.5 b',kw:'efato take-off climb blue line vyse',
  note:T('Gear still down and runway left: land ahead. Continue only if the one-engine climb gradient is 3.3 % or better.','Understell ute og bane igjen: land rett frem. Fortsett bare hvis stigegradienten på én motor er 3,3 % eller bedre.'),
  items:[M(['Power levers','Effekthendler'],'MAX','pwrMaxLive',{call:CALL.efcont}),M(['Rudder','Sideror'],['maintain directional control','hold retningen'],'dirCtl'),
   M(['Airspeed','Fart'],['VYSE 85 KIAS','VYSE 85 KIAS'],'vyse'),M(['Landing gear','Understell'],['UP for a positive climb','OPP for positiv stigning'],'gearUp',{call:CALL.gf}),
   M(['Flaps','Flaps'],['check UP','sjekk UP'],'flapsUp'),...secure(1),
   I(['Land','Land'],['as soon as possible (OEI landing)','så snart som mulig (landing på én motor)'])]},
 {id:'efclb',g:'eng',side:1,t:T('Engine failure during initial climb','Motorstans i første stigning'),ref:'AFM 3.7.6 a',kw:'climb vmca',
  items:[M(['Rudder','Sideror'],['maintain directional control','hold retningen'],'dirCtl',{call:CALL.ef}),
   M(['Airspeed','Fart'],['VYSE 85 KIAS, above VMCA 71 (68 flaps APP)','VYSE 85 KIAS, over VMCA 71 (68 flaps APP)'],'vyse'),
   M(['Live engine','Den levende motoren'],['power as required once in control','effekt etter behov når du har kontroll'],'pwrLive92'),
   I(['Sideslip','Sideglidning'],['minimum: ½ ball and 3–5° bank to the live engine','minst mulig: ½ kule og 3–5° krengning mot den levende motoren'],'bankLive'),
   ...secure(1),I(['Land','Land'],['as soon as possible (OEI landing)','så snart som mulig (landing på én motor)'])]},
 {id:'efflt',g:'eng',side:1,t:T('Engine failure in flight','Motorstans i lufta'),ref:'AFM 3.7.6 b',kw:'cruise en route',
  items:[M(['Rudder','Sideror'],['maintain directional control','hold retningen'],'dirCtl',{call:CALL.ef}),
   M(['Airspeed','Fart'],['as required, above VMCA 71 (68 flaps APP)','etter behov, over VMCA 71 (68 flaps APP)'],'aboveVmc'),
   M(['Live engine','Den levende motoren'],['power up to 92 %','effekt opptil 92 %'],'pwrLive92'),
   I(['Sideslip','Sideglidning'],['minimum: ½ ball and 3–5° bank to the live engine','minst mulig: ½ kule og 3–5° krengning mot den levende motoren'],'bankLive'),
   ...secure(1),I(['Fuel selector {O}','Drivstoffvelger {O}'],['ON or CROSSFEED to keep the fuel balanced','ON eller CROSSFEED for å holde drivstoffet balansert'],'fselLiveFeed',{sec:T('Flight with one engine inoperative (3.7.9)','Flyging med én motor ute (3.7.9)')}),
   I(['Live engine, fuel quantity','Den levende motoren, drivstoffmengde'],['MONITOR','OVERVÅK']),I(['Land','Land'],['as soon as possible (OEI landing)','så snart som mulig (landing på én motor)'])]},
 {id:'secure',g:'eng',side:1,t:T('Engine securing (feathering)','Sikre motoren (fløying)'),ref:'AFM 3.7.3',kw:'feather shut down',
  note:T('Never shut an engine down with the fuel selector — it can damage the high-pressure pump.','Stopp aldri en motor med drivstoffvelgeren — det kan skade høytrykkspumpen.'),
  items:secure(1)},
 {id:'restart',g:'eng',side:1,t:T('Restart in flight with the starter','Omstart i lufta med starter'),ref:'AFM 3.7.4',kw:'unfeather relight',
  note:T('Only if the cause is known and there is no fire. Max 100 KIAS (or a stopped propeller). Never engage the starter on a windmilling propeller.','Bare hvis årsaken er kjent og det ikke brenner. Maks 100 KIAS (eller stoppet propell). Aldri starter på en propell som vindmøller.'),
  items:[I(['Power lever {E}','Effekthendel {E}'],'IDLE','pwrAffIdle'),I(['Fuel selector {E}','Drivstoffvelger {E}'],['check ON','sjekk ON'],'fselAffOn'),
   I(['Alternate air','Alternativ luft'],['AS REQUIRED','ETTER BEHOV']),I(['Alternator {E}','Generator {E}'],'ON','altAffOn'),
   I('ENGINE MASTER {E}',['ON — propeller unfeathers','PÅ — propellen går ut av fløy'],'engAffOn'),
   I(['Starter {E}','Starter {E}'],['ENGAGE with a stopped propeller','START med stoppet propell']),
   I(['Power','Effekt'],['moderate until temperatures are green','moderat til temperaturene er grønne']),I(['Circuit breakers','Sikringer'],['CHECK, reset if needed','SJEKK, tilbakestill ved behov'],'cbsIn')]},
 {id:'restartwm',g:'eng',side:1,t:T('Restart in flight by windmilling','Omstart i lufta ved vindmølling'),ref:'AFM 3.7.4',kw:'windmill unfeather relight',
  note:T('125–145 KIAS only. Max restart altitude 18,000 ft for an immediate restart, 10,000 ft within two minutes.','Kun 125–145 KIAS. Maks høyde for omstart 18 000 ft umiddelbart, 10 000 ft innen to minutter.'),
  items:[I(['Airspeed','Fart'],'125–145 KIAS'),I(['Power lever {E}','Effekthendel {E}'],'IDLE','pwrAffIdle'),I(['Fuel selector {E}','Drivstoffvelger {E}'],['check ON','sjekk ON'],'fselAffOn'),
   I(['Alternate air','Alternativ luft'],['AS REQUIRED','ETTER BEHOV']),I(['Alternator {E}','Generator {E}'],'ON','altAffOn'),
   I('ENGINE MASTER {E}',['ON — restarts by windmilling','PÅ — starter ved vindmølling'],'engAffOn'),I(['Power','Effekt'],['moderate until temperatures are green','moderat til temperaturene er grønne'])]},
 {id:'trouble',g:'eng',side:1,t:T('Engine troubleshooting','Feilsøking motor'),ref:'AFM 3.7.2 · 3.6',kw:'rough power loss ecu a b both simultaneous abnormal behaviour',
  note:T('Fly first. The left engine is the critical engine.','Fly først. Venstre motor er den kritiske motoren.'),
  items:[I(['Power','Effekt'],['FULL (abnormal engine behaviour)','FULL (unormal motorgang)'],null,{sec:T('Abnormal engine behaviour','Unormal motorgang')}),
   I(['Power lever {E}','Effekthendel {E}'],['IDLE for 1 s, then slowly up to max 1975 RPM','IDLE i 1 s, så sakte opp til maks 1975 RPM'],null,{sec:T('Both ECU A and B cautions together','ECU A- og B-varsel samtidig')}),
   I(['Power lever {E}','Effekthendel {E}'],['if power drops: IDLE 1 s, then up to just below that RPM','faller effekten: IDLE 1 s, så opp til like under det turtallet']),
   I(['Land','Land'],['at the next suitable airfield','på nærmeste egnede flyplass']),
   I(['Circuit breakers','Sikringer'],['CHECK, reset if needed','SJEKK, tilbakestill ved behov'],'cbsIn',{sec:T('Otherwise, to restore the engine','Ellers, for å få motoren tilbake')}),
   I('VOTER {E}',['swap ECU A / ECU B','bytt ECU A / ECU B']),I('VOTER {E}',['AUTO if no improvement','AUTO hvis ingen bedring'],'voterAffAuto'),
   I(['Fuel selector {E}','Drivstoffvelger {E}'],'CROSSFEED','fselAffX'),I(['Fuel selector {E}','Drivstoffvelger {E}'],['ON / CROSSFEED as required','ON / CROSSFEED etter behov']),
   I(['Alternate air','Alternativ luft'],'OPEN','altAirOpen'),I(['Power lever {E}','Effekthendel {E}'],['AS REQUIRED','ETTER BEHOV']),
   I(['No recovery','Ingen bedring'],['secure the engine, land as soon as possible','sikre motoren, land så snart som mulig'])]},
 {id:'oeiflt',g:'eng',side:1,t:T('Flight with one engine inoperative','Flyging med én motor ute'),ref:'AFM 3.7.9',kw:'oei single engine crossfeed',
  note:T('Long, steep sideslip can starve the engine of fuel — fly coordinated or use crossfeed.','Lang, kraftig sideglidning kan gi drivstoffmangel — fly koordinert eller bruk crossfeed.'),
  items:[I(['Airspeed','Fart'],['above VMCA 71 (68 flaps APP)','over VMCA 71 (68 flaps APP)'],'aboveVmc'),I(['Live engine instruments','Instrumentene for den levende motoren'],['MONITOR','OVERVÅK']),
   I(['Fuel quantity','Drivstoffmengde'],['MONITOR','OVERVÅK']),I(['Fuel pumps','Drivstoffpumper'],['check OFF','sjekk AV'],'pumpsOff',{chk:1}),
   I(['Fuel selector {O}','Drivstoffvelger {O}'],['ON or CROSSFEED to keep the fuel balanced','ON eller CROSSFEED for å holde drivstoffet balansert'],'fselLiveFeed'),
   I(['Land','Land'],['as soon as possible','så snart som mulig'])]},
 {id:'oeildg',g:'eng',side:1,t:T('Landing with one engine inoperative','Landing med én motor ute'),ref:'AFM 3.7.7',kw:'oei single engine approach',
  note:T('Flaps beyond UP only once the landing is assured — they cost height in a go-around.','Flaps forbi UP først når landingen er sikker — de koster høyde ved bortflyging.'),
  items:[I(['Backrests, harnesses','Seterygger, seler'],'UPRIGHT, FASTENED'),I(['Landing light','Landingslys'],['AS REQUIRED','ETTER BEHOV']),
   I(['Gear warning horn','Understellsvarsel'],['CHECK function','SJEKK funksjon']),I(['Fuel pump {O}','Drivstoffpumpe {O}'],'ON','pumpLiveOn'),
   I(['Fuel selector {O}','Drivstoffvelger {O}'],['check ON','sjekk ON'],'fselLiveOn'),I(['Engine {E}','Motor {E}'],['check SECURED (feathered)','sjekk SIKRET (fløyet)'],'engAffOff'),
   I(['Landing gear','Understell'],['DOWN, 3 GREEN — when sure of the field','NEDE, 3 GRØNNE — når du er sikker på å nå banen'],'gear3',{sec:T('Making the field','Når du er sikker på å nå banen')}),
   I(['Trim','Trim'],['AS REQUIRED','ETTER BEHOV']),I(['Flaps','Flaps'],['AS REQUIRED','ETTER BEHOV']),
   I(['Final approach speed','Sluttinnflygingsfart'],['86 KIAS flaps UP, 84 APP or LDG','86 KIAS flaps UP, 84 APP eller LDG'],'vref'),
   I(['Power levers','Effekthendler'],['AS REQUIRED (move both together)','ETTER BEHOV (flytt begge sammen)']),I(['Directional trim','Sideror-trim'],['NEUTRAL before touchdown','NØYTRAL før touchdown'],'rudTrim0')]},
 {id:'oeiga',g:'eng',side:1,t:T('Go-around with one engine inoperative','Bortflyging med én motor ute'),ref:'AFM 3.7.8',kw:'balked landing oei',
  note:T('Not recommended below 800 ft above ground. If no positive climb: land clear of obstacles.','Ikke anbefalt under 800 ft over bakken. Uten positiv stigning: land klar av hindringer.'),
  items:[M(['Power lever','Effekthendel'],'MAX','pwrMaxLive'),M(['Rudder','Sideror'],['maintain directional control','hold retningen'],'dirCtl'),
   M(['Airspeed','Fart'],['VYSE 85 KIAS','VYSE 85 KIAS'],'vyse'),M(['Landing gear','Understell'],'UP','gearUp'),M(['Flaps','Flaps'],'UP','flapsUp'),
   I(['Sideslip','Sideglidning'],['minimum, then a new approach','minst mulig, så ny innflyging'],'bankLive')]},
 {id:'allout',g:'eng',t:T('Landing with both engines out','Landing uten motorer'),ref:'AFM 3.8',kw:'forced landing glide double engine failure',
  note:T('No best-glide speed is published in the AFM. Off-airfield, gear UP may be better on soft ground.','AFM oppgir ingen fart for beste glidetall. Utenfor flyplass kan understell OPPE være bedre på mykt underlag.'),
  items:[I(['ENGINE MASTERS','ENGINE MASTER'],['BOTH OFF','BEGGE AV'],'engsOff'),I(['Alternators','Generatorer'],['BOTH OFF','BEGGE AV'],'altsOff'),
   I(['Fuel pumps','Drivstoffpumper'],['BOTH OFF','BEGGE AV'],'pumpsOff'),I(['Fuel selectors','Drivstoffvelgere'],['BOTH OFF','BEGGE AV'],'fselsOff'),
   I('AVIONIC MASTER','OFF','avioOff'),I(['Harnesses','Seler'],['FASTENED & TIGHT','FESTET OG STRAMME']),
   I(['Flaps','Flaps'],['APP or LDG when sure of the field','APP eller LDG når du er sikker på å nå'],'flapsAppDown',{sec:T('When sure of the landing area','Når du er sikker på landingsstedet')}),
   I(['Approach speed','Innflygingsfart'],['min. 84 KIAS (88 APP / 86 LDG above 1900 kg)','min. 84 KIAS (88 APP / 86 LDG over 1900 kg)']),
   I(['Landing gear','Understell'],['DOWN, 3 GREEN (or UP on soft ground)','NEDE, 3 GRØNNE (eller OPPE på mykt underlag)']),
   I(['Power levers','Effekthendler'],['BOTH IDLE','BEGGE IDLE'],'idle'),I('ELECT. MASTER',['OFF (gear up: right after touchdown)','AV (understell oppe: rett etter touchdown)'],'elecOff'),
   I(['Touchdown','Touchdown'],['lowest practical speed','lavest mulige fart'])]},
 /* fire */
 {id:'firegnd',g:'fire',t:T('Engine fire on the ground','Motorbrann på bakken'),ref:'AFM 3.11.1',kw:'eng fire ground evacuate',
  items:[M(['ENGINE MASTERS','ENGINE MASTER'],['BOTH OFF','BEGGE AV'],'engsOff'),M(['Fuel selectors','Drivstoffvelgere'],['BOTH OFF','BEGGE AV'],'fselsOff'),
   M('ELECT. MASTER','OFF','elecOff'),M(['Canopy','Kanopi'],['OPEN after standstill','ÅPNE når flyet står'],null,{sec:T('After standstill','Når flyet står')}),
   M(['Aircraft','Flyet'],['EVACUATE immediately','EVAKUER straks'])]},
 {id:'fireto',g:'fire',side:1,t:T('Engine fire during take-off','Motorbrann under avgang'),ref:'AFM 3.11.2',kw:'eng fire take-off',
  note:T('Then the engine failure on take-off checklist (abort, or continue and secure).','Deretter sjekklisten for motorstans under avgang (avbryt, eller fortsett og sikre).'),
  items:[M(['Cabin heat and defrost','Kabinvarme og defroster'],'OFF','heatOff'),I(['Smoke','Røyk'],['front canopy may be unlatched in flight (max 117 KIAS)','frontkanopien kan låses opp i lufta (maks 117 KIAS)']),
   I(['Engine failure on take-off','Motorstans under avgang'],['CARRY OUT','UTFØR'])]},
 {id:'fireflt',g:'fire',side:1,t:T('Engine fire in flight','Motorbrann i lufta'),ref:'AFM 3.11.3',kw:'eng fire warning flight',
  items:[M(['Cabin heat and defrost','Kabinvarme og defroster'],'OFF','heatOff'),M(['Rudder, airspeed','Sideror, fart'],['control, above VMCA','kontroll, over VMCA'],'aboveVmc'),
   M(['Live engine','Den levende motoren'],['power as required','effekt etter behov'],'pwrLive92'),...secure(1),
   I(['Smoke','Røyk'],['front canopy may be unlatched (max 117 KIAS)','frontkanopien kan låses opp (maks 117 KIAS)']),
   I(['Land','Land'],['as soon as possible','så snart som mulig'])]},
 {id:'elfiregnd',g:'fire',t:T('Electrical fire on the ground','Elektrisk brann på bakken'),ref:'AFM 3.11.4',kw:'smoke electric',
  items:[M('ELECT. MASTER','OFF','elecOff'),M(['Power levers','Effekthendler'],['BOTH IDLE','BEGGE IDLE'],'idle',{sec:T('If the engines run','Hvis motorene går')}),
   M(['ENGINE MASTERS','ENGINE MASTER'],['BOTH OFF','BEGGE AV'],'engsOff'),M(['Fuel selectors','Drivstoffvelgere'],['BOTH OFF','BEGGE AV'],'fselsOff'),
   M(['Canopy','Kanopi'],['OPEN after standstill','ÅPNE når flyet står'],null,{sec:T('After standstill','Når flyet står')}),M(['Aircraft','Flyet'],['EVACUATE immediately','EVAKUER straks'])]},
 {id:'elfireflt',g:'fire',t:T('Electrical fire in flight','Elektrisk brann i lufta'),ref:'AFM 3.11.5',kw:'smoke electric burning',
  note:T('With ELECT. MASTER off everything electric is lost, AHRS too; the EMERGENCY switch keeps the standby attitude and flood light.','Med ELECT. MASTER av forsvinner alt elektrisk, også AHRS; EMERGENCY-bryteren holder standby-horisonten og flomlyset.'),
  items:[M(['EMERGENCY switch','EMERGENCY-bryter'],'ON','emerOn'),M('AVIONIC MASTER','OFF','avioOff'),M('ELECT. MASTER','OFF','elecOff'),
   M(['Cabin heat and defrost','Kabinvarme og defroster'],'OFF','heatOff'),I(['Emergency windows','Nødvinduer'],['OPEN if required','ÅPNE ved behov']),
   I(['Land','Land'],['at the next suitable airfield','på nærmeste egnede flyplass'])]},
 {id:'co',g:'fire',t:T('Smoke, fumes or carbon monoxide in the cabin','Røyk, gass eller karbonmonoksid i kabinen'),ref:'AFM 3.12.1',kw:'co exhaust smell fumes smoke',
  items:[I(['Cabin heat and defrost','Kabinvarme og defroster'],'OFF','heatOff'),I(['Ventilation','Ventilasjon'],'OPEN'),I(['Emergency windows','Nødvinduer'],'OPEN'),
   I(['Front canopy','Kanopi foran'],['unlatch to the cooling-gap position (max 117 KIAS)','lås opp til kjølespalte-posisjon (maks 117 KIAS)'],'below117')]},
 /* engine indications and ECU */
 {id:'ecua',g:'ind',side:1,t:T('{E} ECU A FAIL in flight','{E} ECU A FAIL i lufta'),ref:'AFM 4B.4.2 b',kw:'ecu a fail fadec caution voter',alert:'ECU A FAIL',
  note:T('The engine switches to ECU B by itself. If the single-engine climb is negative, clear the caution only with a landing site within gliding distance.','Motoren går over til ECU B av seg selv. Ved negativ stigning på én motor: nullstill bare med et landingssted innen glidedistanse.'),
  items:[I(['Alternate air','Alternativ luft'],'OPEN','altAirOpen'),I(['Fuel pumps','Drivstoffpumper'],['BOTH ON','BEGGE PÅ'],'pumpsOn'),
   I(['Circuit breakers','Sikringer'],['CHECK, reset if needed','SJEKK, tilbakestill ved behov'],'cbsIn',{chk:1}),I('VOTER {E}','AUTO','voterAffAuto',{chk:1}),
   I(['Safe altitude','Sikker høyde'],'CHECKED',null,{sec:T('If the caution remains: clearing procedure','Hvis varselet blir stående: nullstilling')}),
   I(['Airspeed','Fart'],['min. 85 KIAS','min. 85 KIAS'],'ias85'),I(['Flaps, landing gear','Flaps, understell'],['check UP','sjekk OPPE'],'gearUpLocked',{chk:1}),
   I(['ECU B caution','ECU B-varsel'],['check OFF','sjekk AV']),I('VOTER {E}','ECU A','voterAffA'),I(['Wait','Vent'],['5 seconds','5 sekunder'],'voterAffA5'),
   I('VOTER {E}','AUTO','voterAffAuto'),I(['If the caution stays','Hvis varselet blir stående'],['land at the next suitable airfield','land på nærmeste egnede flyplass'])]},
 {id:'ecub',g:'ind',side:1,t:T('{E} ECU B FAIL in flight','{E} ECU B FAIL i lufta'),ref:'AFM 4B.4.3 b',kw:'ecu b fail fadec caution voter',alert:'ECU B FAIL',
  items:[I(['Alternate air','Alternativ luft'],'OPEN','altAirOpen'),I(['Fuel pumps','Drivstoffpumper'],['BOTH ON','BEGGE PÅ'],'pumpsOn'),
   I(['Circuit breakers','Sikringer'],['CHECK, reset if needed','SJEKK, tilbakestill ved behov'],'cbsIn',{chk:1}),I('VOTER {E}','AUTO','voterAffAuto',{chk:1}),
   I(['Safe altitude, min. 85 KIAS, flaps and gear UP','Sikker høyde, min. 85 KIAS, flaps og understell OPPE'],'CHECKED',null,{sec:T('If the caution remains: clearing procedure','Hvis varselet blir stående: nullstilling')}),
   I(['ECU A caution','ECU A-varsel'],['check OFF','sjekk AV']),I('VOTER {E}',['ECU B, wait 5 s','ECU B, vent 5 s']),I('VOTER {E}','AUTO','voterAffAuto'),
   I(['If the caution stays','Hvis varselet blir stående'],['land at the next suitable airfield','land på nærmeste egnede flyplass'])]},
 {id:'ecugnd',g:'ind',side:1,t:T('ECU A or B caution on the ground','ECU A- eller B-varsel på bakken'),ref:'AFM 4B.4.2 a · 4B.4.3 a',kw:'ecu ground voter terminate',
  items:[I('VOTER {E}',['check AUTO','sjekk AUTO'],'voterAffAuto'),I(['Other ECU caution','Det andre ECU-varselet'],['check OFF','sjekk AV']),
   I('VOTER {E}',['the failed ECU, wait 5 s','den feilende ECU-en, vent 5 s']),I('VOTER {E}','AUTO','voterAffAuto'),
   I(['If the caution persists','Hvis varselet blir stående'],['TERMINATE flight preparation','AVSLUTT forberedelsene'])]},
 {id:'engtemp',g:'ind',side:1,t:T('{E} ENG TEMP — coolant hot','{E} ENG TEMP — kjølevæske for varm'),ref:'AFM 3.2.2',kw:'coolant temperature cool lvl',alert:'ENG TEMP',
  items:[I(['COOL LVL caution','COOL LVL-varsel'],'CHECK'),I(['Power {E}','Effekt {E}'],['reduce 10 % or more','reduser 10 % eller mer'],null,{sec:T('No COOL LVL — in the climb','Ingen COOL LVL — i stigning')}),
   I(['Airspeed','Fart'],['+10 KIAS or more','+10 KIAS eller mer']),I(['Not green within 60 s','Ikke grønn innen 60 s'],['power {E} as low as possible, more speed','effekt {E} så lavt som mulig, mer fart']),
   I(['Power {E} and airspeed','Effekt {E} og fart'],['reduce power, increase speed','reduser effekt, øk farten'],null,{sec:T('No COOL LVL — in cruise','Ingen COOL LVL — i marsj')}),
   I(['With COOL LVL','Med COOL LVL'],['reduce power, expect coolant loss and an engine failure','reduser effekt, forvent tap av kjølevæske og motorstans'],null,{sec:T('COOL LVL shown','COOL LVL vises')}),
   I(['Not back in the green','Ikke tilbake i grønt'],['precautionary landing at the nearest suitable airfield','sikkerhetslanding på nærmeste egnede flyplass'])]},
 {id:'oiltemp',g:'ind',side:1,t:T('{E} OIL TEMP — oil hot','{E} OIL TEMP — olje for varm'),ref:'AFM 3.2.3',kw:'oil temperature',alert:'OIL TEMP',
  items:[I(['Oil pressure','Oljetrykk'],'CHECK'),I(['Oil pressure low','Lavt oljetrykk'],['reduce power {E}, expect oil loss and an engine failure','reduser effekt {E}, forvent oljetap og motorstans']),
   I(['Oil pressure green','Oljetrykk i grønt'],['reduce power {E}, increase speed','reduser effekt {E}, øk farten']),
   I(['Not back in the green','Ikke tilbake i grønt'],['precautionary landing at the nearest suitable airfield','sikkerhetslanding på nærmeste egnede flyplass'])]},
 {id:'oilpres',g:'ind',side:1,t:T('{E} OIL PRES — oil pressure low','{E} OIL PRES — lavt oljetrykk'),ref:'AFM 3.2.4',kw:'oil pressure',alert:'OIL PRES',
  items:[I(['Power {E}','Effekt {E}'],['REDUCE','REDUSER']),I(['Expect','Forvent'],['oil loss and an engine failure','oljetap og motorstans']),
   I(['Land','Land'],['at the nearest suitable airfield','på nærmeste egnede flyplass'])]},
 {id:'gboxtemp',g:'ind',side:1,t:T('{E} GBOX TEMP / FUEL TEMP — hot','{E} GBOX TEMP / FUEL TEMP — for varm'),ref:'AFM 3.2.5 · 3.2.6',kw:'gearbox fuel temperature',
  items:[I(['Power {E}','Effekt {E}'],['REDUCE','REDUSER']),I(['Airspeed','Fart'],['INCREASE','ØK']),
   I(['Not back in the green','Ikke tilbake i grønt'],['precautionary landing at the nearest suitable airfield','sikkerhetslanding på nærmeste egnede flyplass'])]},
 {id:'fuelpress',g:'ind',side:1,t:T('{E} FUEL PRESS — fuel pressure low','{E} FUEL PRESS — lavt drivstofftrykk'),ref:'AFM 3.2.7',kw:'fuel pressure',alert:'FUEL PRESS',
  items:[I(['Fuel quantity','Drivstoffmengde'],'CHECK'),I(['Fuel selector {E}','Drivstoffvelger {E}'],['check ON','sjekk ON'],'fselAffOn'),
   I(['Fuel pump {E}','Drivstoffpumpe {E}'],'ON','pumpAffOn'),I(['Fuel selector {E}','Drivstoffvelger {E}'],['CROSSFEED if the warning stays','CROSSFEED hvis varselet blir stående'],'fselAffX'),
   I(['Still on','Fortsatt på'],['expect an engine failure','forvent motorstans'])]},
 {id:'prop',g:'ind',side:1,t:T('Propeller RPM: oscillating, overspeed or fixed','Propellturtall: pendler, overspeed eller låst'),ref:'AFM 3.12.3',kw:'rpm overspeed governor oscillating fixed propeller',
  note:T('Move the power lever slowly — the light wooden blades change RPM quickly.','Flytt effekthendelen sakte — de lette trebladene endrer turtall raskt.'),
  items:[I(['Power {E}','Effekt {E}'],['CHANGE (overspeed: reduce)','ENDRE (overspeed: reduser)']),I(['ECU A / B FAIL caution','ECU A / B FAIL-varsel'],'CHECK'),
   I('VOTER {E}',['ECU B if ECU A failed, ECU A if ECU B failed','ECU B hvis ECU A feiler, ECU A hvis ECU B feiler']),
   I(['Not cleared','Ikke løst'],['VOTER AUTO, land at the nearest suitable airfield','VOTER AUTO, land på nærmeste egnede flyplass'])]},
 /* electrical */
 {id:'altn1',g:'elec',side:1,t:T('{E} ALTN FAIL — one alternator','{E} ALTN FAIL — én generator'),ref:'AFM 4B.4.6 a',kw:'alternator generator altn fail',alert:'ALTN FAIL',
  items:[I(['Alternator {E}','Generator {E}'],'OFF','altAffOff'),I(['Bus voltage','Bussspenning'],['MONITOR','OVERVÅK']),I(['Electrical consumers','Strømforbrukere'],['REDUCE as practical','REDUSER så langt det går'])]},
 {id:'altn2',g:'elec',t:T('Both alternators failed','Begge generatorene feiler'),ref:'AFM 3.3.1 b',kw:'alternator generator double battery',
  note:T('Expect about 30 minutes of battery, then engine stoppage. Land as soon as possible.','Regn med rundt 30 minutter batteri, deretter motorstopp. Land så snart som mulig.'),
  items:[I('AVIONIC MASTER','OFF','avioOff'),I(['Alternators','Generatorer'],['BOTH OFF','BEGGE AV'],'altsOff'),I('XPDR','STBY'),
   I(['Landing gear','Understell'],['DOWN; when locked, pull the emergency release','NED; når låst, trekk nødutløseren'],'gear3'),
   I(['Pitot and stall heat','Pitot- og stallvarme'],'OFF','pitotOff'),I(['All lights','Alle lys'],'OFF','lightsOff')]},
 {id:'lowvolt',g:'elec',t:T('LOW VOLTS','LOW VOLTS'),ref:'AFM 4B.4.5',kw:'voltage low volts battery',alert:'LOW VOLTS',
  items:[I(['Alternators','Generatorer'],['check ON','sjekk PÅ'],'altsOn'),I(['Bus voltage','Bussspenning'],'CHECK'),I(['Both low','Begge lave'],['treat as both alternators failed','behandle som begge generatorer feilet'])]},
 {id:'hicurrent',g:'elec',t:T('High current (ALTN AMPS)','Høy strøm (ALTN AMPS)'),ref:'AFM 3.10.2 · 3.2.8',kw:'amps current',
  items:[I(['Circuit breakers','Sikringer'],'CHECK','cbsIn'),I(['Electrical load','Strømforbruk'],['REDUCE to the minimum','REDUSER til minimum']),I(['Land','Land'],['at the nearest suitable airfield','på nærmeste egnede flyplass'])]},
 {id:'elecall',g:'elec',t:T('Complete electrical failure','Total elektrisk svikt'),ref:'AFM 3.10.1',kw:'electrical total dark blackout',
  note:T('ECU backup batteries keep the engines running at least 30 min; the standby attitude and flood light at least 1.5 h. The gear may creep down.','Backup-batterier holder motorene i gang minst 30 min; standby-horisont og flomlys minst 1,5 t. Understellet kan sige ned.'),
  items:[I(['Circuit breakers','Sikringer'],['check IN','sjekk INNE'],'cbsIn'),I(['EMERGENCY switch','EMERGENCY-bryter'],'ON','emerOn'),
   I(['Flood light','Flomlys'],['ON if needed','PÅ ved behov']),I(['Power','Effekt'],['set by lever position and sound','sett etter hendelposisjon og lyd']),
   I(['Flaps','Flaps'],['land with the flaps where they are','land med flapsene der de er']),I(['Land','Land'],['at the nearest suitable airfield','på nærmeste egnede flyplass'])]},
 {id:'starter',g:'elec',side:1,t:T('{E} STARTER — starter stays engaged','{E} STARTER — starteren slipper ikke'),ref:'AFM 3.10.3',kw:'starter engaged',alert:'STARTER',
  items:[I(['Power lever {E}','Effekthendel {E}'],'IDLE','pwrAffIdle',{sec:T('On the ground','På bakken')}),I('ENGINE MASTER {E}','OFF','engAffOff'),I('ELECT. MASTER','OFF','elecOff'),
   I(['In flight','I lufta'],['restart checklist; if no restart, flight with one engine inoperative','omstartsjekklisten; uten omstart, flyging med én motor ute'],null,{sec:T('In flight','I lufta')})]},
 /* fuel */
 {id:'fuelsup',g:'fuel',side:1,t:T('Fuel supply failure','Svikt i drivstofftilførselen'),ref:'AFM 3.12.5',kw:'fuel starvation supply',
  items:[I(['Fuel selector {E}','Drivstoffvelger {E}'],'CROSSFEED','fselAffX'),I(['Fuel quantity','Drivstoffmengde'],['MONITOR','OVERVÅK']),I(['Fuel pump {E}','Drivstoffpumpe {E}'],'ON','pumpAffOn'),
   I(['Fuel selector {E}','Drivstoffvelger {E}'],['ON if the failure remains','ON hvis svikten fortsetter'],'fselAffOn')]},
 {id:'fuellow',g:'fuel',side:1,t:T('{E} FUEL LOW','{E} FUEL LOW'),ref:'AFM 4B.4.4',kw:'fuel low quantity imbalance leak',alert:'FUEL LOW',
  items:[I(['Fuel quantity','Drivstoffmengde'],'CHECK'),I(['Sideslip','Sideglidning'],['back to coordinated flight (max ½ ball)','tilbake til koordinert flyging (maks ½ kule)']),
   I(['Fuel selector {E}','Drivstoffvelger {E}'],['CROSSFEED if one tank reads much lower (suspect a leak)','CROSSFEED hvis én tank viser mye mindre (mulig lekkasje)'])]},
 /* gear, brakes, flaps */
 {id:'gearunsafe',g:'gear',t:T('Landing gear unsafe — manual extension','Understell usikkert — manuell utfelling'),ref:'AFM 3.9.1 · 3.9.2',kw:'gear unsafe red light manual extension emergency hydraulic',
  note:T('The red light is normal in transit. Act if it stays on more than 20 s. Manual extension up to 152 KIAS, takes up to 20 s.','Det røde lyset er normalt under bevegelse. Handle hvis det står på mer enn 20 s. Manuell utfelling opp til 152 KIAS, tar opptil 20 s.'),
  items:[I(['Airspeed','Fart'],['below VLO retraction 152 KIAS','under VLO inntrekking 152 KIAS'],'below152'),I(['Gear selector','Understellsvelger'],['RECYCLE','SYKLUS (opp og ned)'],'gearRecycle'),
   I(['Gear indicator lights','Understellslys'],['TEST','TEST'],null,{sec:T('Still not down and locked: manual extension (3.9.2)','Fortsatt ikke nede og låst: manuell utfelling (3.9.2)')}),
   I('ELECT. MASTER',['check ON','sjekk PÅ'],'elecOn',{chk:1}),I(['Bus voltage','Bussspenning'],['check normal','sjekk normal']),
   I(['LDG GEAR circuit breaker','LDG GEAR-sikring'],['check IN','sjekk INNE'],'cbGear',{chk:1}),I(['Gear selector','Understellsvelger'],'DOWN','gearDown'),
   I(['Emergency gear extension handle','Nødutløser for understell'],['PULL','TREKK'],'gearEmer'),I(['Gear lights','Understellslys'],['3 GREEN (below 110 KIAS, yaw and pitch gently if not)','3 GRØNNE (under 110 KIAS, gir og stamp forsiktig hvis ikke)'],'gear3')]},
 {id:'gearup',g:'gear',t:T('Landing with the gear up','Landing med understellet oppe'),ref:'AFM 3.9.3',kw:'belly gear up',
  items:[I(['Approach','Innflyging'],['normal speeds and flaps, with power','normale farter og flaps, med effekt']),I(['Power levers','Effekthendler'],['IDLE just before touchdown','IDLE like før touchdown'],'idle'),
   I(['ENGINE MASTERS','ENGINE MASTER'],['BOTH OFF if time allows','BEGGE AV hvis tiden tillater'],'engsOff'),I(['Fuel pumps','Drivstoffpumper'],['check OFF','sjekk AV'],'pumpsOff'),
   I(['Fuel selectors','Drivstoffvelgere'],['BOTH OFF','BEGGE AV'],'fselsOff'),I(['Touchdown','Touchdown'],['minimum speed, keep straight with rudder','minimumsfart, hold retningen med sideror']),
   I('ELECT. MASTER',['OFF right after touchdown (earlier lets the gear creep down)','AV rett etter touchdown (tidligere lar understellet sige ned)'],'elecOff')]},
 {id:'checkgear',g:'gear',t:T('CHECK GEAR caution','CHECK GEAR-varsel'),ref:'AFM 4B.4.12',kw:'check gear horn',alert:'CHECK GEAR',
  items:[I(['Landing gear','Understell'],['DOWN / as required','NED / etter behov'],'gear3')]},
 {id:'hydr',g:'gear',t:T('Hydraulic pump failure or running continuously','Hydraulikkpumpe svikter eller går kontinuerlig'),ref:'AFM 4B.7',kw:'hydraulic pump gear creep',
  items:[I(['Gear indicator lights','Understellslys'],'CHECK'),I(['Manual gear extension','Manuell utfelling'],['PREPARE (3.9.2)','FORBERED (3.9.2)']),I(['After landing','Etter landing'],['maintenance action','vedlikehold'])]},
 {id:'tire',g:'gear',t:T('Landing with a defective main-wheel tyre','Landing med defekt dekk på hovedhjul'),ref:'AFM 3.9.4',kw:'tyre tire burst',
  items:[I(['Touchdown','Touchdown'],['on the runway side of the good tyre, that wing low','på den siden av banen som har det hele dekket, den vingen lavt']),I(['Direction','Retning'],['rudder, then brake hard as needed','sideror, så brems kraftig ved behov'])]},
 {id:'brakes',g:'gear',t:T('Landing with defective brakes','Landing med defekte bremser'),ref:'AFM 3.9.5',kw:'brakes failure',
  items:[I(['Harnesses','Seler'],['FASTENED & TIGHT','FESTET OG STRAMME']),I(['Runway','Bane'],['allow for a longer roll','regn med lengre utrulling']),
   I(['After touchdown, if needed','Etter touchdown, ved behov'],['ENGINE MASTERS, FUEL SELECTORS, ELECT. MASTER — OFF','ENGINE MASTER, DRIVSTOFFVELGERE, ELECT. MASTER — AV'])]},
 {id:'flapfail',g:'gear',t:T('Flap failure','Flapssvikt'),ref:'AFM 4B.5',kw:'flaps asymmetric indication',
  items:[I(['Flap position','Flapsposisjon'],['CHECK visually','SJEKK visuelt']),I(['Airspeed','Fart'],['in the white arc, max 113 KIAS','i den hvite buen, maks 113 KIAS']),
   I(['Flap switch','Flapsbryter'],['re-check all positions','sjekk alle posisjoner på nytt']),
   I(['Only UP','Bare UP'],['min. 86 KIAS, flat approach, fly the speed with power','min. 86 KIAS, flat innflyging, fly farten med effekt'],null,{sec:T('Approach with the flaps available','Innflyging med de flapsene du har')}),
   I(['Only APP','Bare APP'],['min. 84 KIAS, flat approach','min. 84 KIAS, flat innflyging']),I(['Only LDG','Bare LDG'],['normal landing','normal landing'])]},
 /* avionics and autopilot */
 {id:'apfail',g:'avi',t:T('Autopilot or electric trim malfunction','Feil i autopilot eller elektrisk trim'),ref:'AFM 3.12.9',kw:'autopilot trim runaway ap disc',
  note:T('Items 1 and 2 together. Do not re-engage until the cause is fixed.','Punkt 1 og 2 samtidig. Ikke koble inn igjen før årsaken er rettet.'),
  items:[M(['Control stick','Stikka'],['GRASP FIRMLY, regain control','HOLD FAST, gjenvinn kontrollen']),M(['AP DISC switch','AP DISC-bryter'],['PRESS AND HOLD','TRYKK OG HOLD'],'apOff'),
   M(['Trim','Trim'],['retrim manually','trim manuelt']),M(['AUTOPILOT circuit breaker','AUTOPILOT-sikring'],['PULL','TREKK'],'cbApPulled'),M(['AP DISC switch','AP DISC-bryter'],['RELEASE','SLIPP'])]},
 {id:'pfdfail',g:'avi',t:T('PFD or MFD display failure','PFD- eller MFD-svikt'),ref:'AFM 3.5.2',kw:'display reversionary backup pfd mfd blank',
  note:T('After the backup button has been pushed, one attempt to return to normal mode is allowed.','Etter at backup-knappen er trykket, er ett forsøk på å gå tilbake til normal modus tillatt.'),
  items:[I(['DISPLAY BACKUP (audio panel)','DISPLAY BACKUP (lydpanelet)'],['PUSH','TRYKK'],'backup'),I(['Fly on the working display','Fly på skjermen som virker'],['reversionary mode','reversjonsmodus']),
   I(['Standby instruments','Standby-instrumenter'],['CROSS-CHECK','KRYSSJEKK'])]},
 {id:'ahrs',g:'avi',t:T('AHRS, ATTITUDE or HDG failure','AHRS-, ATTITUDE- eller HDG-svikt'),ref:'AFM 3.4 · 3.5.3',kw:'ahrs attitude heading red x',
  items:[I(['Standby attitude, compass, map','Standby-horisont, kompass, kart'],['USE','BRUK']),I(['Course','Kurs'],['set in the digital window','sett i det digitale vinduet'])]},
 {id:'adc',g:'avi',t:T('Air data failure (airspeed, altitude, VS)','Luftdatasvikt (fart, høyde, VS)'),ref:'AFM 3.4 · 3.5.4',kw:'adc airspeed altitude vertical speed red x',
  items:[I(['Standby airspeed and altimeter','Standby fartsmåler og høydemåler'],['USE','BRUK']),I(['Vertical speed','Vertikalfart'],['from the altitude trend','fra høydeendringen'])]},
 {id:'engdisp',g:'avi',t:T('Engine or fuel displays lost or wrong','Motor- eller drivstoffvisning borte eller feil'),ref:'AFM 3.5.5 · 3.5.6',kw:'engine display red x annunciator',
  items:[I(['Power','Effekt'],['set by lever position, sound and speed','sett etter hendelposisjon, lyd og fart']),I(['Other indications','Andre visninger'],['MONITOR the engine health','OVERVÅK motorens tilstand']),
   I(['Fuel','Drivstoff'],['known settings and GPS fuel data','kjente innstillinger og GPS-drivstoffdata']),I(['Annunciation shown','Varsel vises'],['treat it as real','behandle det som ekte'])]},
 {id:'pitotfail',g:'avi',t:T('PITOT FAIL / HT OFF, STALL HT FAIL','PITOT FAIL / HT OFF, STALL HT FAIL'),ref:'AFM 4B.4.8 · 4B.4.9',kw:'pitot heat stall warning',alert:'PITOT HT OFF',
  items:[I(['PITOT HEAT','PITOT HEAT'],['check ON / as required','sjekk PÅ / etter behov'],'pitotOn'),I(['In icing','I ising'],['expect lost air data and stall warning; leave the icing','forvent tap av luftdata og stallvarsel; kom deg ut av isingen'])]},
 /* other */
 {id:'doors',g:'oth',t:T('Unlocked doors (DOOR OPEN)','Ulåste dører (DOOR OPEN)'),ref:'AFM 3.12.2',kw:'door open canopy baggage',alert:'DOOR OPEN',
  note:T('Never try to lock the rear door in flight. A lost baggage door can damage a propeller.','Prøv aldri å låse bakdøren i lufta. En bagasjeluke som faller av kan skade en propell.'),
  items:[I(['Airspeed','Fart'],['REDUCE immediately, below 140 KIAS','REDUSER straks, under 140 KIAS'],'below140'),I(['Canopy, rear door, baggage doors','Kanopi, bakdør, bagasjeluker'],['check visually','sjekk visuelt']),
   I(['Land','Land'],['at the next suitable airfield','på nærmeste egnede flyplass'])]},
 {id:'emdesc',g:'oth',t:T('Emergency descent','Nødnedstigning'),ref:'AFM 3.12.7',kw:'descent rapid',
  items:[I(['Flaps','Flaps'],'UP','flapsUp'),I(['Landing gear','Understell'],['DOWN','NED'],'gearDown'),I(['Power levers','Effekthendler'],'IDLE','idle'),
   I(['Airspeed','Fart'],['as required — VNO 151, VNE 188','etter behov — VNO 151, VNE 188'])]},
 {id:'icing',g:'oth',t:T('Unintentional flight into icing','Utilsiktet ising'),ref:'AFM 3.12.4',kw:'ice icing',
  items:[I(['Icing area','Isingsområdet'],['LEAVE (altitude or turn back)','FORLAT (høyde eller snu)']),I(['PITOT HEAT','PITOT HEAT'],'ON','pitotOn'),
   I(['Cabin heat and defrost','Kabinvarme og defroster'],'ON','heatOn'),I(['Power','Effekt'],['INCREASE, change periodically','ØK, endre med jevne mellomrom']),
   I(['Alternate air','Alternativ luft'],'OPEN','altAirOpen'),I(['Emergency windows','Nødvinduer'],['OPEN if required','ÅPNE ved behov']),I('ATC',['advise if an emergency is expected','informer hvis nødsituasjon kan oppstå'])]},
 {id:'spin',g:'oth',t:T('Unintentional spin','Utilsiktet spinn'),ref:'AFM 3.12.6',kw:'spin recovery stall',
  note:T('Spin recovery was not shown in certification. Steps 1–4 at once.','Spinngjenvinning er ikke vist under sertifiseringen. Punkt 1–4 samtidig.'),
  items:[M(['Power levers','Effekthendler'],'IDLE','idle'),M(['Rudder','Sideror'],['FULL against the spin','FULLT mot spinnet']),M(['Elevator','Høyderor'],['FULLY FORWARD','HELT FREMOVER']),
   M(['Ailerons','Balanseror'],['NEUTRAL','NØYTRALE']),M(['Flaps','Flaps'],'UP','flapsUp'),I(['Rotation stopped','Rotasjonen stoppet'],['rudder neutral, pull out gently, below VNE 188','sideror nøytralt, trekk forsiktig ut, under VNE 188'])]},
 {id:'precland',g:'oth',t:T('Precautionary landing','Sikkerhetslanding'),ref:'AFM 4B.1',kw:'field landing off airport',
  items:[I(['Landing area','Landingssted'],'SELECT'),I(['Wind','Vind'],'CONSIDER'),I(['Overfly the area','Overfly området'],['check obstacles','sjekk hindringer']),I('ATC','ADVISE'),
   I(['Approach and landing','Innflyging og landing'],['normal checklist, lowest speed at touchdown','normal sjekkliste, lavest fart ved touchdown']),
   I(['After touchdown if time allows','Etter touchdown hvis tiden tillater'],['ENGINE MASTERS, FUEL SELECTORS, ELECT. MASTER — OFF','ENGINE MASTER, DRIVSTOFFVELGERE, ELECT. MASTER — AV'])]}
];

/* ---------- failure scenarios: the sim triggers a failure, then opens the matching checklist ---------- */
const SCENS=[
 {id:'s_rto',t:T('Engine failure on the take-off run','Motorstans i startrullet'),set:'rwyTO',proc:'efrun',fail:{kind:'eng',ias:45},
  brief:T('Runway 36, ready for take-off. Apply full power. An engine fails before VR: stop.','Bane 36, klar for avgang. Gi full effekt. En motor stopper før VR: stopp.')},
 {id:'s_efato',t:T('Engine failure after take-off','Motorstans etter avgang'),set:'efato',proc:'efato',fail:{kind:'eng',at:3},
  brief:T('Just airborne at 400 ft, gear down, flaps APP. An engine fails. Fly first: power, rudder, blue line, clean up, identify — verify — secure.','Akkurat i lufta i 400 ft, understell ute, flaps APP. En motor stopper. Fly først: effekt, sideror, blå linje, rydd opp, identifiser — verifiser — sikre.')},
 {id:'s_efflt',t:T('Engine failure in cruise','Motorstans i marsj'),set:'cruise',proc:'efflt',fail:{kind:'eng',at:6},
  brief:T('Cruise at 5000 ft. An engine fails. Keep control, above VMCA, then secure the dead engine and balance the fuel.','Marsj i 5000 ft. En motor stopper. Behold kontrollen, over VMCA, sikre så den døde motoren og balanser drivstoffet.')},
 {id:'s_fireflt',t:T('Engine fire in flight','Motorbrann i lufta'),set:'cruise',proc:'fireflt',fail:{kind:'fire',at:6},
  brief:T('Cruise at 5000 ft. An ENG FIRE warning will come. Heat off, then secure that engine.','Marsj i 5000 ft. Et ENG FIRE-varsel kommer. Varme av, sikre så den motoren.')},
 {id:'s_firegnd',t:T('Engine fire on the ground','Motorbrann på bakken'),set:'running',proc:'firegnd',fail:{kind:'fire',at:4},
  brief:T('Engines running on the apron. A fire warning comes: shut everything down and get out.','Motorene går på oppstillingsplassen. Et brannvarsel kommer: slå av alt og kom deg ut.')},
 {id:'s_altn',t:T('Alternator failure','Generatorsvikt'),set:'cruise',proc:'altn1',fail:{kind:'alt',at:5},
  brief:T('Cruise at 5000 ft. Watch the annunciations.','Marsj i 5000 ft. Følg med på varslene.')},
 {id:'s_ecua',t:T('ECU A failure','ECU A-svikt'),set:'cruise',proc:'ecua',fail:{kind:'ecuA',at:5},
  brief:T('Cruise at 5000 ft. An ECU caution will come. Work the checklist, including the clearing procedure.','Marsj i 5000 ft. Et ECU-varsel kommer. Gå gjennom sjekklisten, også nullstillingen.')},
 {id:'s_gear',t:T('Landing gear unsafe','Understell usikkert'),set:'appr',proc:'gearunsafe',fail:{kind:'gear',onGear:1},
  brief:T('On vectors at 2000 ft, gear up. Select the gear down: it will not lock. Extend it manually.','På vektorer i 2000 ft, understell oppe. Velg understell ned: det låser seg ikke. Fell det ut manuelt.')},
 {id:'s_pfd',t:T('PFD failure','PFD-svikt'),set:'cruise',proc:'pfdfail',fail:{kind:'pfd',at:5},
  brief:T('Cruise at 5000 ft. The PFD will go dark. Get the flight instruments back on the MFD.','Marsj i 5000 ft. PFD-en blir mørk. Få flyinstrumentene tilbake på MFD-en.')}
];

/* failures the page can trigger from the failure menu: kind → the checklist to open */
const FAILS=[
 {kind:'fire',side:1,t:T('Engine fire','Motorbrann'),proc:{air:'fireflt',gnd:'firegnd'}},
 {kind:'alt',side:1,t:T('Alternator failure','Generatorsvikt'),proc:'altn1'},
 {kind:'ecuA',side:1,t:T('ECU A failure','ECU A-svikt'),proc:'ecua'},
 {kind:'gear',t:T('Gear will not extend','Understellet felles ikke ut'),proc:'gearunsafe'},
 {kind:'pfd',t:T('PFD failure','PFD-svikt'),proc:'pfdfail'}
];

/* ---------- AFM speeds (KIAS), DA42 NG / DA42-VI with the 1999 kg modification ---------- */
const SPEEDS=[
 ['VR',T('Rotation, flaps UP','Rotasjon, flaps UP'),'min. 76'],
 ['VR',T('Rotation, flaps APP (short field) · above 1900 kg','Rotasjon, flaps APP (kortbane) · over 1900 kg'),'71 · 74'],
 ['—',T('Initial climb, flaps UP','Første stigning, flaps UP'),'min. 83'],
 ['VX',T('Best angle, flaps APP','Beste stigevinkel, flaps APP'),'77'],
 ['VY',T('Best rate, flaps UP · above 1900 kg','Beste stigerate, flaps UP · over 1900 kg'),'90 · 92'],
 ['VY',T('Best rate, flaps APP','Beste stigerate, flaps APP'),'85'],
 ['VYSE',T('One engine, best rate (blue line)','Én motor, beste stigerate (blå linje)'),'85'],
 ['VMCA',T('Minimum control speed, one engine (red line) · flaps UP · APP','Minste kontrollfart, én motor (rød linje) · flaps UP · APP'),'71 · 68'],
 ['VO',T('Operating manoeuvring speed · up to 1700 · 1800 · above 1800 kg','Manøvreringsfart · opptil 1700 · 1800 · over 1800 kg'),'112 · 119 · 122'],
 ['VFE',T('Flaps extended · APP · LDG','Flaps ute · APP · LDG'),'133 · 113'],
 ['VLO',T('Gear operating · extension · retraction','Understell i bevegelse · ut · inn'),'188 · 152'],
 ['VLE',T('Gear extended','Understell ute'),'188'],
 ['VNO',T('Max structural cruising','Maks strukturell marsjfart'),'151'],
 ['VNE',T('Never exceed','Aldri overskrid'),'188'],
 ['VREF',T('Approach, flaps UP · above 1900 kg','Innflyging, flaps UP · over 1900 kg'),'86 · 92'],
 ['VREF',T('Approach, flaps APP · above 1900 kg','Innflyging, flaps APP · over 1900 kg'),'84 · 88'],
 ['—',T('Final approach, flaps LDG · above 1900 kg','Sluttinnflyging, flaps LDG · over 1900 kg'),'84 · 86'],
 ['—',T('Go-around, minimum','Bortflyging, minimum'),'90'],
 ['—',T('Restart in flight · starter (max) · windmilling','Omstart i lufta · starter (maks) · vindmølling'),'100 · 125–145'],
 ['—',T('Canopy opened in flight, max demonstrated','Kanopi åpnet i lufta, maks demonstrert'),'117'],
 ['—',T('Best glide','Beste glidetall'),T('not in the AFM','ikke i AFM')]
];
const LIMITS=[
 T('Max take-off power 100 % for 5 min; max continuous 92 %; 2300 RPM','Maks starteffekt 100 % i 5 min; maks kontinuerlig 92 %; 2300 RPM'),
 T('Starter max 10 s, then 20 s cooling','Starter maks 10 s, deretter 20 s avkjøling'),
 T('No intentional shutdown below 3000 ft AGL or above 10,000 ft','Ingen planlagt motorstopp under 3000 ft AGL eller over 10 000 ft'),
 T('Restart altitude: 18,000 ft immediately, 10,000 ft within 2 min','Omstartshøyde: 18 000 ft umiddelbart, 10 000 ft innen 2 min'),
 T('Take-off on CROSSFEED and VOTER away from AUTO (except tests and emergencies) are prohibited','Avgang på CROSSFEED og VOTER utenom AUTO (unntatt test og nød) er forbudt'),
 T('Turbo cool-down: max 10 % load for 1 min before shut-down','Turbo-avkjøling: maks 10 % last i 1 min før stopp')
];

/* ---------- helpers ---------- */
const ALL=()=>FLOWS.concat(EMER);
function find(id){ return FLOWS.find(p=>p.id===id)||EMER.find(p=>p.id===id)||null; }
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9æøå ]+/g,' ');
function search(q,lang){ q=norm(q).trim(); if(!q) return EMER.slice(); const w=q.split(/\s+/);
  return EMER.filter(p=>{ const h=norm([p.t.en,p.t.no,p.ref,p.kw||'',p.alert||'',...p.items.map(i=>i.c.en+' '+i.c.no)].join(' ').replace(/\{[EO]\}/g,'')); return w.every(x=>h.includes(x)); }); }
const sub=(s,side)=>{ const e=side?'R':'L', o=side?'L':'R'; return String(s).replace(/\{E\}/g,e).replace(/\{O\}/g,o); };
const subT=(t,side)=>t&&{en:sub(t.en,side),no:sub(t.no,side)};
function label(it,side){ return {en:sub(it.c.en,side)+' — '+sub(it.r.en,side),no:sub(it.c.no,side)+' — '+sub(it.r.no,side)}; }
/* steps for the page's step engine. env: {ctx:()=>context, side:()=>0|1} */
function toSteps(p,env){
  return p.items.map(it=>{ const ck=it.k?CK[it.k]:null, raw=ck?ck.ctl:'';
    const ctl=!ck?null:/[*~]/.test(raw)?()=>raw.replace('*',env.side()?'R':'L').replace('~',env.side()?'L':'R'):raw;
    return {get t(){ return label(it,env.side()); },get call(){ return it.call&&subT(it.call,env.side()); },get sec(){ return it.sec&&subT(it.sec,env.side()); },
      ctl,k:it.k,chk:!!it.chk,mem:!!it.mem,manual:!ck,
      ok(){ return ck?!!ck.f(env.ctx(),this.m||(this.m={})):false; }}; }); }
function build(env){
  const out=[];
  FLOWS.forEach(p=>out.push({k:p.id,kind:'flow',g:p.g,t:p.t,ref:p.ref,brief:p.brief,set:p.set,steps:toSteps(p,env)}));
  SCENS.forEach(s=>{ const p=find(s.proc); out.push({k:s.id,kind:'scen',t:s.t,ref:p.ref,brief:s.brief,set:s.set,fail:s.fail,proc:p.id,side:!!p.side,get title(){ return subT(p.t,env.side()); },note:p.note,steps:toSteps(p,env)}); });
  EMER.forEach(p=>out.push({k:p.id,kind:'emer',g:p.g,t:p.t,ref:p.ref,note:p.note,side:!!p.side,alert:p.alert,lib:true,get title(){ return subT(p.t,env.side()); },steps:toSteps(p,env)}));
  return out; }

/* ---------- drawer renderer ---------- */
const CSS=`
.pnav{display:flex;gap:4px;margin:2px 0 8px;align-items:stretch}.pnav button{flex:1;font:600 12px system-ui;padding:6px 4px;border-radius:6px;border:1px solid #333a42;background:#1b2026;color:#dfe5ea;cursor:pointer}
.pnav button.on{background:#e8edf1;color:#0d1319}.pnav .aa{flex:0 0 34px;font-weight:800}
.pdisc{font-size:11px;color:#c9a94a;line-height:1.35;margin:0 0 8px}
.psrch{width:100%;box-sizing:border-box;font:500 13px system-ui;padding:8px 10px;border-radius:7px;border:1px solid #333a42;background:#0d1115;color:#fff;margin-bottom:8px}
.pgrp{font:700 10.5px system-ui;letter-spacing:.07em;text-transform:uppercase;color:#8e9aa5;margin:10px 0 4px}
.plist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
.plist button{width:100%;text-align:left;display:flex;gap:8px;align-items:center;font:600 12.5px system-ui;padding:8px 9px;border-radius:7px;border:1px solid #262c33;background:#161b20;color:#e6ebef;cursor:pointer}
.plist button:hover,.plist button:focus-visible{border-color:#7fcbe8;outline:none}.plist .rf{margin-left:auto;font:500 10.5px system-ui;color:#7d8a95;white-space:nowrap}
.plist .mk{flex:0 0 auto;font:800 9.5px system-ui;padding:2px 5px;border-radius:4px;background:#5a1a14;color:#ffb4a8;letter-spacing:.04em}
.plist .sk{flex:0 0 auto;font:800 9.5px system-ui;padding:2px 5px;border-radius:4px;background:#13324a;color:#9ed8f5}
.pspd{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.pspd col.a{width:46px}.pspd col.c{width:34%}.pspd td{padding:5px 4px;border-bottom:1px solid #232930;color:#dfe5ea;vertical-align:top}.pspd td:first-child{font-weight:800;color:#fff;white-space:nowrap}.pspd td:last-child{text-align:right;font-variant-numeric:tabular-nums;color:#fff;font-weight:700}
.plim{margin:10px 0 0;padding-left:16px;color:#a9b5bf;font-size:11.5px}.plim li{margin:3px 0}
.phd{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px}.phd>div{flex:1;min-width:0}.phd h3{margin:0!important;font-size:15px!important;line-height:1.25}.phd small{display:block;color:#8e9aa5;font:500 11px system-ui;margin-top:2px}
.phd .x{flex:0 0 auto;font:600 12px system-ui;padding:5px 8px;border-radius:6px;border:1px solid #333a42;background:#1b2026;color:#dfe5ea;cursor:pointer}
.pside{display:flex;gap:4px;align-items:center;margin:4px 0 8px;font-size:12px;color:#a9b5bf}.pside button{font:700 12px system-ui;padding:5px 12px;border-radius:6px;border:1px solid #333a42;background:#1b2026;color:#dfe5ea;cursor:pointer}.pside button.on{background:#ffcf3a;color:#111;border-color:#ffcf3a}
.palert{border:2px solid #ff5a47;background:#2a0f0c;color:#fff;border-radius:8px;padding:8px 10px;margin:0 0 8px;font:800 13px system-ui;letter-spacing:.03em;animation:pblink 1s steps(2) 3}.palert small{display:block;font:500 11.5px system-ui;color:#ffc9c1;letter-spacing:0;margin-top:2px}
.pwait{border:1px dashed #4a5560;border-radius:8px;padding:8px 10px;color:#c6d0d8;font-size:12.5px;margin:0 0 8px}
@keyframes pblink{50%{opacity:.55}}
.pnote{font-size:11.5px;color:#c6d0d8;background:#182029;border-left:3px solid #7fcbe8;padding:6px 8px;border-radius:4px;margin:0 0 8px}
.checks li.sec{background:none;border:0;padding:8px 2px 0;font:700 10.5px system-ui;letter-spacing:.06em;text-transform:uppercase;color:#8e9aa5}
.checks li.mem{border-left:3px solid #ff5a47}.checks li .tg{display:inline-block;font:800 9px system-ui;letter-spacing:.05em;padding:1px 4px;border-radius:3px;background:#5a1a14;color:#ffb4a8;margin-left:6px;vertical-align:1px}
.checks li .tg.man{background:#26313c;color:#b8c4ce}.checks li .call{display:block;color:#9ed8f5;font-size:11px;font-style:italic;margin-top:2px}
.checks li.now.man{cursor:pointer}
.drawer .next .mtag{display:inline-block;font:800 9.5px system-ui;padding:2px 5px;border-radius:4px;background:#ff5a47;color:#fff;margin-left:6px;letter-spacing:.05em;vertical-align:2px}
.drawer .next .call{display:block;color:#9ed8f5;font-size:12px;font-style:italic;margin-top:3px}
.drawer .next button.done{background:#3cdc6e;color:#0d1319;border-color:#3cdc6e;font-weight:800}
.drawer.big.open,.drawer.big .din{width:min(440px,46vw)}
.drawer.big .din{font-size:15px}.drawer.big .checks li{font-size:15px;padding:9px 10px}.drawer.big .checks li i{flex-basis:21px;height:21px;font-size:12px}
.drawer.big .next b{font-size:19px}.drawer.big .plist button{font-size:15px;padding:10px}.drawer.big .pspd{font-size:14.5px}.drawer.big .brief,.drawer.big .pnote{font-size:14px}
.drawer.big .row button{font-size:14.5px;padding:10px}.drawer.big .checks li .call{font-size:13px}
@media (max-height:500px){.drawer.big.open,.drawer.big .din{width:min(360px,46vw)}.drawer.big .din{font-size:13.5px}.drawer.big .checks li{font-size:13.5px;padding:7px 8px}.drawer.big .next b{font-size:16px}}
`;
let cssOn=false; function css(){ if(cssOn||typeof document==='undefined') return; cssOn=true; const s=document.createElement('style'); s.textContent=CSS; document.head.appendChild(s); }
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const W=(en,no)=>({en,no});
const TXT={flows:W('Flows','Flyter'),emer:W('Emergency','Nød'),scen:W('Scenarios','Scenarier'),spd:W('Speeds','Farter'),
  search:W('Search: fire, ECU, gear, alternator…','Søk: brann, ECU, understell, generator…'),none:W('No checklist matches.','Ingen sjekkliste passer.'),
  gnd:W('On the ground','På bakken'),flt:W('In flight','I lufta'),mem:W('MEMORY','HUKOMMELSE'),man:W('tick','kryss'),
  sim:W('SIM','SIM'),big:W('Large text','Stor tekst'),close:W('All procedures','Alle prosedyrer'),side:W('Affected engine','Motoren det gjelder'),
  pickFlow:W('Pick a flow. The trainer sets the aircraft up, highlights the next control and ticks each item when you do it. Items without a control are ticked by hand.','Velg en flyt. Treneren klargjør flyet, markerer neste bryter og krysser av hvert punkt når du gjør det. Punkter uten bryter krysser du av selv.'),
  pickScen:W('The trainer sets up the flight and triggers a failure. When it happens, the matching checklist opens. The debrief scores time to action, the correct engine, VMCA and VYSE.','Treneren setter opp flygingen og utløser en feil. Når den skjer, åpnes riktig sjekkliste. Debriefen vurderer tid til handling, riktig motor, VMCA og VYSE.'),
  pickEmer:W('Opens on the current flight — nothing is reset. Red items are memory items.','Åpnes på flygingen du har nå — ingenting nullstilles. Røde punkter er hukommelsespunkter.'),
  speedsH:W('AFM speeds (KIAS)','AFM-farter (KIAS)'),limH:W('Key limitations','Viktige begrensninger'),memH:W('memory items','hukommelsespunkter'),
  wait:W('Fly the aircraft. The failure will come — the checklist opens when it does.','Fly flyet. Feilen kommer — sjekklisten åpnes når den skjer.')};
function navHTML(st,L){ const tab=st.tab||'flows', q=st.q||'';
  const tabs=['flows','emer','scen','spd'].map(k=>`<button data-pt="${k}" class="${k===tab?'on':''}" aria-pressed="${k===tab}">${esc(L(TXT[k]))}</button>`).join('')+`<button class="aa${st.big?' on':''}" data-pbig aria-pressed="${!!st.big}" title="${esc(L(TXT.big))}" aria-label="${esc(L(TXT.big))}">Aa</button>`;
  let body='';
  const item=(k,t,rf,tags)=>`<li><button data-pk="${k}">${tags||''}<span>${esc(L(t))}</span><span class="rf">${esc(rf||'')}</span></button></li>`;
  if(tab==='flows'){ body=`<p class="brief">${esc(L(TXT.pickFlow))}</p>`+['gnd','flt'].map(g=>`<div class="pgrp">${esc(L(TXT[g]))}</div><ul class="plist">${FLOWS.filter(p=>p.g===g).map(p=>item(p.id,p.t,p.ref.replace(/^AFM /,''))).join('')}</ul>`).join(''); }
  else if(tab==='scen'){ body=`<p class="brief">${esc(L(TXT.pickScen))}</p><ul class="plist">${SCENS.map(s=>item(s.id,s.t,find(s.proc).ref.replace(/^AFM /,''),`<span class="sk">${esc(L(TXT.sim))}</span>`)).join('')}</ul>`; }
  else if(tab==='spd'){ body=`<div class="pgrp">${esc(L(TXT.speedsH))}</div><table class="pspd"><colgroup><col class="a"><col><col class="c"></colgroup>${SPEEDS.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(L(r[1]))}</td><td>${esc(typeof r[2]==='string'?r[2]:L(r[2]))}</td></tr>`).join('')}</table><div class="pgrp">${esc(L(TXT.limH))}</div><ul class="plim">${LIMITS.map(x=>`<li>${esc(L(x))}</li>`).join('')}</ul>`; }
  else { const hits=search(q); const simK=new Set(SCENS.map(s=>s.proc));
    body=`<input class="psrch" type="search" data-psearch value="${esc(q)}" placeholder="${esc(L(TXT.search))}" aria-label="${esc(L(TXT.search))}"><p class="brief">${esc(L(TXT.pickEmer))}</p>`+
      (hits.length?GROUPS.map(([g,gt])=>{ const h=hits.filter(p=>p.g===g); return h.length?`<div class="pgrp">${esc(L(gt))}</div><ul class="plist">${h.map(p=>item(p.id,subT(p.t,st.side||0),p.ref.replace(/^AFM /,''),(p.items.some(i=>i.mem)?`<span class="mk" title="${esc(L(TXT.memH))}">M</span>`:'')+(simK.has(p.id)?`<span class="sk">${esc(L(TXT.sim))}</span>`:''))).join('')}</ul>`:''; }).join(''):`<p class="brief">${esc(L(TXT.none))}</p>`); }
  return `<div class="pnav" role="group">${tabs}</div><p class="pdisc">${esc(L(DISC))}</p>${body}`; }
/* the running checklist. st: {p (built proc), i, done[], side, failed, alertText, big} */
function runHTML(st,L){ const p=st.p, steps=p.steps, cur=steps[st.i];
  const title=p.title||p.t;
  let h=`<div class="phd"><div><h3>${esc(L(title))}</h3><small>${esc(p.ref||'')}${p.kind==='scen'?' · '+esc(L(TXT.sim)):''}</small></div><button class="x" data-pbig aria-pressed="${!!st.big}" title="${esc(L(TXT.big))}" aria-label="${esc(L(TXT.big))}">Aa</button><button class="x" data-pclose>← ${esc(L(TXT.close))}</button></div>`;
  if(p.side&&p.kind==='emer') h+=`<div class="pside">${esc(L(TXT.side))}: <button data-pside="0" class="${st.side?'':'on'}">L</button><button data-pside="1" class="${st.side?'on':''}">R</button></div>`;
  if(p.kind==='scen'&&!st.failed) h+=`<div class="pwait">${esc(L(TXT.wait))}</div><p class="brief">${esc(L(p.brief))}</p>`;
  else { if(st.alertText) h+=`<div class="palert" role="alert">${esc(st.alertText)}<small>${esc(L(title))}</small></div>`;
    if(p.kind==='scen') h+=`<p class="brief">${esc(L(p.brief))}</p>`; else if(p.brief) h+=`<p class="brief">${esc(L(p.brief))}</p>`;
    if(p.note) h+=`<div class="pnote">${esc(L(subT(p.note,st.side)))}</div>`;
    if(cur) h+=`<div class="next"><small>${esc(L({en:'Next',no:'Neste'}))} ${st.i+1}/${steps.length}${cur.mem?`<span class="mtag">${esc(L(TXT.mem))}</span>`:''}</small><b>${esc(L(cur.t))}</b>${cur.call?`<span class="call">${esc(L(cur.call))}</span>`:''}
      <div class="row"><button data-pback${st.i?'':' disabled'}>← ${esc(L({en:'Back',no:'Tilbake'}))}</button>${cur.manual?`<button class="done" data-pdone>✓ ${esc(L({en:'Done',no:'Utført'}))}</button>`:''}<button data-pskip>${esc(L({en:'Skip',no:'Hopp over'}))} →</button></div></div>`; }
  const pre=p.kind==='scen'&&!st.failed;
  h+=`<ul class="checks">${steps.map((s,i)=>{ const d=st.done[i]; const cls=[d===1?'ok':d===2?'skip':(!pre&&i===st.i)?'now':'',s.mem?'mem':'',s.manual?'man':''].join(' ');
    return `${s.sec?`<li class="sec">${esc(L(s.sec))}</li>`:''}<li class="${cls}" data-pi="${i}"><i>${d===1?'✓':d===2?'–':i+1}</i><span>${esc(L(s.t))}${s.mem?`<span class="tg">${esc(L(TXT.mem))}</span>`:''}${s.manual?`<span class="tg man">${esc(L(TXT.man))}</span>`:''}${s.chk?`<small>${esc(L({en:'check',no:'sjekk'}))}</small>`:''}${s.call?`<span class="call">${esc(L(s.call))}</span>`:''}</span></li>`; }).join('')}</ul>`;
  if(st.i>=steps.length) h+=`<div class="callout blue"><b>${esc(L({en:'Checklist complete.',no:'Sjekklisten er fullført.'}))}</b></div>`;
  h+=`<div class="row"><button data-prestart>${esc(L({en:'Restart',no:'Start på nytt'}))}</button>${p.kind!=='emer'?`<button data-pfree>${esc(L({en:'Free flight',no:'Fri flyging'}))}</button>`:''}</div><p class="pdisc" style="margin-top:10px">${esc(L(DISC))}</p>`;
  return h; }

G.DA42PROCS={DISC,VARIANT,CK,FLOWS,EMER,SCENS,FAILS,GROUPS,SPEEDS,LIMITS,CALL,find,search,label,sub,subT,toSteps,build,css,navHTML,runHTML,all:ALL};
})(typeof window!=='undefined'?window:globalThis);
