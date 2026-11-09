/* Birdbird – classic analog King Air B200-style panel drawn in SVG (world units 2000×1300).
   Generic training layout drawn by Birdbird from general type knowledge; not a manufacturer drawing.
   Interaction framework shared with da42panel.js. Controls report through io.get/io.set. */
(function(G){
'use strict';
const W=2000, H=1300, NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- regions for zoom ---------- */
const REG={
  overview:[0,0,2000,1300],
  overheadL:[575,0,430,212], overheadR:[995,0,430,212],
  glare:[740,196,560,100],
  flightT:[22,222,708,222], flightB:[22,440,708,292],
  engT:[718,286,254,226], engB:[718,506,254,226],
  audio:[966,286,372,166], radio1:[966,448,372,184], radio2:[966,628,372,100],
  copilotT:[1334,222,662,222], copilotB:[1334,440,662,292],
  lower:[22,726,458,236], rsub:[478,726,540,236], center:[1010,726,334,236], cosubL:[1336,726,400,236], cosubR:[1730,726,268,236],
  pedT:[735,958,530,186], pedB:[690,1140,580,160],
  fuelT:[4,958,366,178], fuelB:[4,1132,366,168],
  rsideT:[1634,958,366,170], rsideB:[1634,1124,366,176]
};
const REG_ORDER=['fuelT','fuelB','rsideT','rsideB','pedT','pedB','lower','rsub','center','cosubL','cosubR','overheadL','overheadR','glare','engT','engB','audio','radio1','radio2','flightT','flightB','copilotT','copilotB'];

/* ---------- layout: every control ---------- */
const C=[]; const add=o=>{ C.push(o); return o; };
/* overhead light control panel */
add({id:'mpl',t:'tog',x:640,y:84,l:'MASTER PANEL LIGHTS',d:'MASTER\nPANEL LTS',sm:1});
add({id:'wiper',t:'rotsel',x:722,y:40,l:'WINDSHIELD WIPERS',d:'',vals:['PARK','OFF','SLOW','FAST'],ang:[-70,-20,25,70]});
/* rheostats: two rows as on the overhead light control panel (flood and indirect above avionics / subpanel) */
[['dimPF','PILOT FLIGHT LIGHTS','PILOT\nFLIGHT',722,86],['dimEng','ENGINE INSTRUMENT LIGHTS','ENGINE\nINSTR',830,86],['dimFlood','OVERHEAD FLOOD LIGHTS','OVHD\nFLOOD',970,34],['dimInd','INSTRUMENT INDIRECT LIGHTS','INSTR\nINDIRECT',1040,34],['dimAv','AVIONICS PANEL LIGHTS','AVIONICS\nPANEL',970,86],['dimCons','OVERHEAD, SUBPANEL AND CONSOLE LIGHTS','SUBPNL &\nCONSOLE',1040,86],['dimSide','SIDE PANEL LIGHTS','SIDE\nPANEL',1110,86],['dimCG','COPILOT GYRO INSTRUMENT LIGHTS','COPLT\nGYRO',1180,86],['dimCF','COPILOT FLIGHT LIGHTS','COPLT\nFLIGHT',1250,86]]
  .forEach(([id,l,d,x,y])=>add({id,t:'rot',x,y,r:11,l,d}));
add({id:'vLoadL',t:'push',x:688,y:178,r:6,l:'L LOADMETER – PUSH FOR VOLTS',d:'VOLTS'});
add({id:'vLoadR',t:'push',x:768,y:178,r:6,l:'R LOADMETER – PUSH FOR VOLTS',d:'VOLTS'});
add({id:'vBatt',t:'push',x:848,y:178,r:6,l:'BATTERY AMMETER – PUSH FOR VOLTS',d:'VOLTS'});
add({id:'vAC',t:'push',x:928,y:178,r:6,l:'AC METER – PUSH FOR VOLTS',d:'VOLTS'});
/* glareshield */
add({id:'mwL',t:'mbtn',x:330,y:242,w:66,h:38,l1:'MASTER',l2:'WARNING',col:'r',l:'MASTER WARNING (L)'});
add({id:'mcL',t:'mbtn',x:408,y:242,w:66,h:38,l1:'MASTER',l2:'CAUTION',col:'a',l:'MASTER CAUTION (L)'});
add({id:'fireL',t:'mbtn',x:826,y:232,w:84,h:28,l1:'L ENG FIRE',l2:'PUSH TO EXT',col:'r',l:'L ENGINE FIRE – PUSH TO EXTINGUISH'});
add({id:'annTest',t:'push',x:1142,y:236,r:10,l:'ANNUNCIATOR PRESS TO TEST',d:'PRESS\nTO TEST'});
add({id:'fireR',t:'mbtn',x:1206,y:232,w:84,h:28,l1:'R ENG FIRE',l2:'PUSH TO EXT',col:'r',l:'R ENGINE FIRE – PUSH TO EXTINGUISH'});
add({id:'mcR',t:'mbtn',x:1592,y:242,w:66,h:38,l1:'MASTER',l2:'CAUTION',col:'a',l:'MASTER CAUTION (R)'});
add({id:'mwR',t:'mbtn',x:1670,y:242,w:66,h:38,l1:'MASTER',l2:'WARNING',col:'r',l:'MASTER WARNING (R)'});
/* pilot flight panel */
add({id:'slewL',t:'push',x:58,y:598,r:7,l:'GYRO SLAVING – SLEW LEFT',d:'◄'});
add({id:'slewR',t:'push',x:92,y:598,r:7,l:'GYRO SLAVING – SLEW RIGHT',d:'►'});
add({id:'gyroMode',t:'abtn',x:128,y:598,l:'FREE',lbl:'GYRO SLAVING MODE (SLAVE / FREE)'});
add({id:'fastErect',t:'push',x:96,y:660,r:9,l:'ATTITUDE GYRO FAST ERECT',d:'FAST\nERECT'});
add({id:'dmeCh',t:'abtn',x:190,y:654,l:'CH',momentary:1,lbl:'DME (PILOT) – CHANNEL 1 / 2 / 3'});
add({id:'dmeSel',t:'abtn',x:228,y:654,l:'SEL',momentary:1,lbl:'DME (PILOT) – SELECT KT / MIN / ID'});
add({id:'dmePwr',t:'abtn',x:266,y:654,l:'PWR',lbl:'DME (PILOT) – POWER'});
add({id:'hdgK',t:'enc',x:305,y:640,r:11,l:'HDG'});
add({id:'crsK',t:'enc',x:445,y:640,r:11,l:'CRS'});
add({id:'baroK',t:'enc',x:590,y:412,r:9,l:'BARO'});
add({id:'altSel',t:'enc',x:572,y:618,r:10,l:'ALTITUDE SET',d:'ALT SET'});
add({id:'sync',t:'tog',x:612,y:656,l:'PROP SYNC',d:'PROP SYNC',sm:1});
/* audio control panel: per side AUTO COMM + nine source switches on top; speaker, emergency, filter,
   microphone selector with master volume, sidetone / interphone pots, DME volumes, encoder select, paging,
   ground comm power, interphone volume, hot interphone, marker sensitivity and volume, annunciator dimming */
const AUD=[['COMM 1','1'],['COMM 2','2'],['NAV 1','1'],['NAV 2','2'],['MKR BCN 1','1'],['MKR BCN 2','2'],['DME 1','1'],['DME 2','2'],['ADF','ADF']];
const AUDX={P:[1004,1131],C:[1176,1303]};
['P','C'].forEach(sd=>{ const nm=sd==='C'?'COPILOT':'PILOT', x0=AUDX[sd][0];
  AUD.forEach(([n,u],i)=>add({id:'au'+sd+i,t:'tog',x:x0+i*15.9,y:334,l:nm+' AUDIO '+n,d:'',up:u,xs:1,s:4.4}));
  add({id:'autoComm'+sd,t:'tog',x:sd==='P'?986:1322,y:334,l:nm+' AUTO COMM',d:'',up:'AUTO',dn:'OFF',xs:1});
});
add({id:'micP',t:'rotsel',x:1002,y:388,l:'PILOT MICROPHONE SELECTOR',d:'MIC',vals:['COMM 1','COMM 2','CABIN'],ang:[-50,0,50],s:3.6});
add({id:'volP',t:'rot',x:1034,y:388,r:8,l:'PILOT MASTER VOLUME',d:'VOL'});
add({id:'spkrP',t:'tog',x:1058,y:392,l:'PILOT AUDIO SPEAKER',d:'',up:'SPKR',dn:'OFF',xs:1});
add({id:'audEmer',t:'tog',x:1078,y:392,l:'AUDIO AMPS BYPASS (EMER / NORM)',d:'',up:'EMER',dn:'NORM',xs:1,red:1});
add({id:'voiceP',t:'tog3',x:1104,y:390,l:'PILOT NAV/ADF FILTER (VOICE / BOTH / RANGE)',d:'',vals:['VOICE','BOTH','RANGE']});
add({id:'sideP',t:'rot',x:992,y:422,r:5.5,l:'PILOT SIDETONE VOLUME',d:'SIDETONE',s:3.8});
add({id:'sensP',t:'rot',x:1016,y:422,r:5.5,l:'PILOT INTERPHONE THRESHOLD',d:'INTPH\nSENS',s:3.8});
add({id:'dmeV1',t:'rot',x:1046,y:422,r:7,l:'DME 1 VOLUME',d:'DME 1',s:4});
add({id:'dmeV2',t:'rot',x:1072,y:422,r:7,l:'DME 2 VOLUME',d:'DME 2',s:4});
add({id:'encAlt',t:'tog',x:1102,y:426,l:'ENCODING ALTIMETER SELECT (1 / 2)',d:'',up:'ALTM 1',dn:'ALTM 2',xs:1});
add({id:'pageVol',t:'rot',x:1130,y:420,r:8,l:'PASSENGER ADDRESS (PAGING) VOLUME',d:'PAGING',s:4});
add({id:'gndComm',t:'abtn',x:1152,y:390,l:'GND',lbl:'GROUND COMM POWER (PUSH ON / OFF)'});
add({id:'intphVol',t:'rot',x:1164,y:424,r:8,l:'INTERPHONE VOLUME',d:'INTPH',s:4});
add({id:'voiceC',t:'tog3',x:1186,y:390,l:'COPILOT NAV/ADF FILTER (VOICE / BOTH / RANGE)',d:'',vals:['VOICE','BOTH','RANGE']});
add({id:'hotIntph',t:'tog',x:1226,y:392,l:'HOT INTERPHONE',d:'',up:'HOT',dn:'OFF',xs:1});
add({id:'spkrC',t:'tog',x:1248,y:392,l:'COPILOT AUDIO SPEAKER',d:'',up:'SPKR',dn:'OFF',xs:1});
add({id:'volC',t:'rot',x:1272,y:388,r:8,l:'COPILOT MASTER VOLUME',d:'VOL'});
add({id:'micC',t:'rotsel',x:1302,y:388,l:'COPILOT MICROPHONE SELECTOR',d:'MIC',vals:['COMM 1','COMM 2','CABIN'],ang:[-50,0,50],s:3.6});
add({id:'mkrHi',t:'tog',x:1192,y:428,l:'MARKER BEACON SENSITIVITY (HI / LO)',d:'',up:'HI',dn:'LO',xs:1});
add({id:'mkrVol',t:'rot',x:1218,y:422,r:7,l:'MARKER BEACON VOLUME',d:'MKR',s:4});
add({id:'annBrt',t:'rot',x:1244,y:422,r:7,l:'RADIO DISPLAY DIMMING (ANN PUSH BRT)',d:'DIM',s:4});
add({id:'sideC',t:'rot',x:1284,y:422,r:5.5,l:'COPILOT SIDETONE VOLUME',d:'SIDETONE',s:3.8});
add({id:'sensC',t:'rot',x:1308,y:422,r:5.5,l:'COPILOT INTERPHONE THRESHOLD',d:'INTPH\nSENS',s:3.8});
/* radios: COMM, NAV, XPDR, ADF control heads */
const RAD=[['com1','COMM 1',976,452,['OFF','ON','SQ OFF']],['com2','COMM 2',1160,452,['OFF','ON','SQ OFF']],['nav1','NAV 1',976,542,['OFF','ON','HLD']],['nav2','NAV 2',1160,542,['OFF','ON','HLD']],['xpdr','TRANSPONDER',976,632,['OFF','STBY','ON','ALT']],['adf','ADF',1160,632,['OFF','ANT','ADF','TONE']]];
RAD.forEach(([k,n,x,y,vals])=>{
  const by=y+72;
  add({id:k+'Md',t:'rotsel',x:x+20,y:by,l:n+' POWER / MODE',d:'',vals,ang:vals.length===3?[-55,0,55]:[-75,-25,25,75],s:4.2});
  if(k==='xpdr'){
    add({id:'xpdr12',t:'tog',x:x+52,y:by-3,l:'TRANSPONDER 1 / 2 SELECT',d:'',up:'1',dn:'2',xs:1});
    add({id:'xpdrPre',t:'push',x:x+76,y:by,r:5.5,l:'TRANSPONDER PRESET CODE (PRE)',d:'PRE'});
    add({id:'xpdrT',t:'push',x:x+96,y:by,r:5.5,l:'TRANSPONDER TEST',d:'TEST'});
    add({id:'xpdrId',t:'abtn',x:x+140,y:y+30,l:'IDENT',momentary:1,lbl:'TRANSPONDER IDENT'});
  } else {
    add({id:k+'Vol',t:'rot',x:x+56,y:by,r:6,l:n+' VOLUME',d:'VOL',s:4});
    add({id:k+'Sto',t:'push',x:x+76,y:by,r:5.5,l:n+' STORE (STO, PUSH TWICE)',d:'STO'});
    add({id:k+'T',t:'push',x:x+96,y:by,r:5.5,l:n+' TEST',d:'TEST'});
    add({id:k+'Act',t:'abtn',x:x+119,y:by,l:'ACT',lbl:n+' ACTIVE (DIRECT) TUNE'});
    add({id:k+'X',t:'tog3',x:x+136,y:y+30,l:n+' TRANSFER / MEMORY (XFR / MEM)',d:'',vals:['XFR','','MEM'],spring:1});
  }
  add({id:k+'K',t:'enc2',x:x+148,y:by,r:13,l:n+(k==='xpdr'?' CODE':' FREQUENCY'),d:''});
});
/* copilot flight panel */
add({id:'baro2K',t:'enc',x:1778,y:410,r:9,l:'BARO 2',d:'BARO'});
add({id:'crs2K',t:'enc',x:1640,y:640,r:11,l:'CRS 2',d:'CRS'});
add({id:'dhK',t:'rot',x:1472,y:700,r:8,l:'RADAR ALTIMETER DH SET',d:'DH'});
add({id:'raT',t:'push',x:1370,y:700,r:7,l:'RADAR ALTIMETER TEST',d:'TEST'});
add({id:'dme2Ch',t:'abtn',x:1694,y:654,l:'CH',momentary:1,lbl:'DME (COPILOT) – CHANNEL 1 / 2 / 3'});
add({id:'dme2Sel',t:'abtn',x:1732,y:654,l:'SEL',momentary:1,lbl:'DME (COPILOT) – SELECT KT / MIN / ID'});
add({id:'dme2Pwr',t:'abtn',x:1770,y:654,l:'PWR',lbl:'DME (COPILOT) – POWER'});
add({id:'slew2L',t:'push',x:1840,y:648,r:7,l:'GYRO SLAVING 2 – SLEW LEFT',d:'◄'});
add({id:'slew2R',t:'push',x:1874,y:648,r:7,l:'GYRO SLAVING 2 – SLEW RIGHT',d:'►'});
add({id:'gyro2Mode',t:'abtn',x:1912,y:648,l:'FREE',lbl:'GYRO SLAVING 2 MODE (SLAVE / FREE)'});
/* pilot's left subpanel */
add({id:'micSel',t:'tog',x:60,y:776,l:'PILOT MIC – NORMAL / OXYGEN MASK',d:'MIC',up:'NORMAL',dn:'OXY MASK',sm:1});
add({id:'avio',t:'tog',x:118,y:776,l:'AVIONICS MASTER POWER',d:'AVIONICS\nMASTER PWR',sm:1});
add({id:'inv',t:'tog3',x:182,y:776,l:'INVERTER',d:'INVERTER',vals:['NO 1','OFF','NO 2']});
add({id:'aignL',t:'tog',x:300,y:780,l:'ENG AUTO IGNITION LEFT',d:'LEFT',sm:1,up:'ARM',dn:'OFF'});
add({id:'aignR',t:'tog',x:350,y:780,l:'ENG AUTO IGNITION RIGHT',d:'RIGHT',sm:1,up:'ARM',dn:'OFF'});
add({id:'pilotAir',t:'pull',x:436,y:792,l:'PILOT AIR (PULL ON)',d:'PILOT AIR'});
add({id:'gang',t:'bar',x:122,y:822,w:168,h:15,l:'MASTER SWITCH (GANG BAR) – ALL OFF',d:'MASTER  SWITCH'});
add({id:'bat',t:'tog',x:62,y:866,l:'BATTERY',d:'BATT',sm:1});
add({id:'genL',t:'tog3',x:112,y:866,l:'GEN 1 (LEFT)',d:'GEN 1',vals:['RESET','ON','OFF']});
add({id:'genR',t:'tog3',x:172,y:866,l:'GEN 2 (RIGHT)',d:'GEN 2',vals:['RESET','ON','OFF']});
add({id:'engAIL',t:'tog',x:300,y:860,l:'ENGINE ANTI-ICE LEFT',d:'LEFT',sm:1});
add({id:'engAIR',t:'tog',x:350,y:860,l:'ENGINE ANTI-ICE RIGHT',d:'RIGHT',sm:1});
add({id:'ignL',t:'tog3',x:58,y:930,l:'IGNITION AND ENGINE START LEFT',d:'LEFT',vals:['ON','OFF','STARTER ONLY']});
add({id:'ignR',t:'tog3',x:132,y:930,l:'IGNITION AND ENGINE START RIGHT',d:'RIGHT',vals:['ON','OFF','STARTER ONLY']});
add({id:'afSw',t:'tog3',x:212,y:930,l:'AUTOFEATHER',d:'AUTOFEATHER',vals:['ARM','OFF','TEST']});
add({id:'govT',t:'tog',x:262,y:930,l:'PROP GOV TEST',d:'PROP GOV',sm:1,up:'TEST',dn:'OFF',red:1});
add({id:'actL',t:'tog',x:300,y:932,l:'ENG ANTI-ICE ACTUATOR LEFT (STANDBY / MAIN)',d:'',sm:1,up:'STBY',dn:'MAIN',red:1});
add({id:'actR',t:'tog',x:350,y:932,l:'ENG ANTI-ICE ACTUATOR RIGHT (STANDBY / MAIN)',d:'',sm:1,up:'STBY',dn:'MAIN',red:1});
add({id:'park',t:'pull',x:436,y:932,l:'PARKING BRAKE',d:'PARKING\nBRAKE'});
/* pilot's right subpanel */
add({id:'defrost',t:'pull',x:568,y:792,l:'DEFROST AIR (PULL ON)',d:'DEFROST\nAIR'});
[['landL','LANDING LIGHT LEFT','LDG L'],['landR','LANDING LIGHT RIGHT','LDG R'],['taxi','TAXI LIGHT','TAXI'],['iceLt','WING ICE LIGHT','ICE'],['navLt','NAV LIGHTS','NAV'],['recog','RECOGNITION LIGHTS','RECOG']].forEach(([id,l,d],i)=>add({id,t:'tog',x:630+i*40,y:784,l,d,sm:1}));
add({id:'wsP',t:'tog3',x:630,y:860,l:'WINDSHIELD ANTI-ICE PILOT',d:'WSHLD PLT',vals:['NORMAL','OFF','HI']});
add({id:'wsC',t:'tog3',x:688,y:860,l:'WINDSHIELD ANTI-ICE COPILOT',d:'WSHLD CPLT',vals:['NORMAL','OFF','HI']});
add({id:'propDe',t:'tog3',x:748,y:860,l:'PROP DEICE',d:'PROP',vals:['AUTO','OFF','MANUAL']});
add({id:'fvL',t:'tog',x:806,y:860,l:'FUEL VENT HEAT LEFT',d:'VENT L',sm:1,red:1});
add({id:'fvR',t:'tog',x:842,y:860,l:'FUEL VENT HEAT RIGHT',d:'VENT R',sm:1,red:1});
add({id:'brakeDe',t:'tog',x:630,y:932,l:'BRAKE DEICE',d:'BRAKE\nDEICE',sm:1});
add({id:'surf',t:'tog3',x:672,y:932,l:'SURFACE DEICE',d:'SURFACE\nDEICE',vals:['SINGLE','OFF','MANUAL']});
add({id:'stallHt',t:'tog',x:736,y:932,l:'STALL WARN HEAT',d:'STALL\nWARN',sm:1});
add({id:'pitL',t:'tog',x:778,y:932,l:'PITOT HEAT LEFT',d:'PITOT L',sm:1});
add({id:'pitR',t:'tog',x:818,y:932,l:'PITOT HEAT RIGHT',d:'PITOT R',sm:1});
add({id:'gearRelay',t:'cb',x:862,y:932,l:'LANDING GEAR RELAY',cb:'GEAR'});
add({id:'gear',t:'gear',x:902,y:808,l:'LANDING GEAR'});
add({id:'dlRel',t:'push',x:880,y:878,r:6,l:'GEAR DOWN LOCK RELEASE',d:'DOWN\nLOCK REL'});
add({id:'hdLt',t:'push',x:924,y:878,r:6,l:'GEAR HANDLE LIGHT TEST',d:'HD LT\nTEST'});
add({id:'hornSil',t:'push',x:908,y:932,r:7,l:'GEAR WARN HORN SILENCE',d:'HORN\nSILENCE'});
add({id:'beacon',t:'tog',x:956,y:784,l:'BEACON',d:'BEACON',sm:1});
add({id:'strobe',t:'tog',x:994,y:784,l:'STROBE',d:'STROBE',sm:1});
add({id:'tailFl',t:'tog',x:994,y:866,l:'TAIL FLOOD LIGHTS',d:'TAIL\nFLOOD',sm:1});
add({id:'hydT',t:'push',x:960,y:932,r:7,l:'HYD FLUID SENSOR TEST',d:'HYD FLUID\nTEST'});
/* copilot's left subpanel */
add({id:'furn',t:'tog',x:1366,y:784,l:'CABIN FURNISHING POWER',d:'FURN',sm:1,red:1});
add({id:'cabLt',t:'tog3',x:1404,y:784,l:'CABIN LIGHTS',d:'CABIN LT',vals:['BRIGHT','DIM','OFF']});
add({id:'signs',t:'tog3',x:1458,y:784,l:'NO SMOKE & FSB SIGNS',d:'SIGNS',vals:['NO SMK+FSB','FSB','OFF']});
add({id:'manTemp',t:'tog3',x:1534,y:784,l:'MANUAL TEMP (INCR / DECR)',d:'MAN TEMP',vals:['INCR','','DECR'],spring:1});
add({id:'blower',t:'tog3',x:1590,y:784,l:'VENT BLOWER',d:'BLOWER',vals:['HIGH','LO','AUTO']});
add({id:'cabTemp',t:'rot',x:1648,y:778,r:11,l:'CABIN TEMP',d:'CABIN\nTEMP'});
add({id:'cabMode',t:'rotsel',x:1704,y:790,l:'CABIN TEMP MODE',d:'TEMP MODE',vals:['MAN HEAT','MAN COOL','OFF','AUTO'],ang:[-80,-115,0,60]});
add({id:'bleedL',t:'tog3',x:1442,y:866,l:'BLEED AIR VALVE LEFT',d:'BLEED L',vals:['OPEN','ENVR OFF','INSTR&ENVR OFF']});
add({id:'bleedR',t:'tog3',x:1516,y:866,l:'BLEED AIR VALVE RIGHT',d:'BLEED R',vals:['OPEN','ENVR OFF','INSTR&ENVR OFF']});
add({id:'stallTest',t:'tog',x:1450,y:934,l:'STALL WARN TEST (SPRING-LOADED)',d:'STALL WARN\nTEST',up:'TEST',sm:1,mom:1});
add({id:'aftBlow',t:'tog',x:1514,y:934,l:'AFT BLOWER',d:'AFT\nBLOWER',sm:1,red:1});
add({id:'elecHeat',t:'tog',x:1562,y:934,l:'ELECTRIC HEAT',d:'ELEC\nHEAT',sm:1,red:1});
add({id:'fireTest',t:'rotsel',x:1642,y:922,l:'TEST SWITCH ENG FIRE SYS',d:'FIRE SYS TEST',vals:['EXT L','DET L','OFF','DET R','EXT R'],ang:[-90,-45,0,45,90]});
add({id:'cabAir',t:'pull',x:1710,y:900,l:'CABIN AIR (PULL DECR)',d:'CABIN\nAIR'});
/* copilot's right subpanel */
add({id:'copAir',t:'pull',x:1790,y:788,l:'COPILOT AIR (PULL ON)',d:'COPILOT\nAIR'});
add({id:'micSelR',t:'tog',x:1790,y:900,l:'COPILOT MIC – NORMAL / OXYGEN MASK',d:'MIC',up:'NORMAL',dn:'OXY MASK',sm:1});
/* left side: fuel control panel */
add({id:'stbyL',t:'tog',x:44,y:1008,l:'STANDBY PUMP LEFT',d:'STBY PUMP',sm:1});
add({id:'xfeed',t:'tog3',x:178,y:1008,l:'CROSSFEED FLOW',d:'CROSSFEED',vals:['LEFT','OFF','RIGHT']});
add({id:'stbyR',t:'tog',x:324,y:1008,l:'STANDBY PUMP RIGHT',d:'STBY PUMP',sm:1});
add({id:'auxL',t:'tog',x:44,y:1084,l:'AUX TRANSFER LEFT',d:'AUX XFR',sm:1,up:'OVRD',dn:'AUTO'});
add({id:'fqSel',t:'tog',x:184,y:1092,l:'FUEL QUANTITY – MAIN / AUXILIARY',d:'FUEL QTY',sm:1,up:'MAIN',dn:'AUX'});
add({id:'auxR',t:'tog',x:324,y:1084,l:'AUX TRANSFER RIGHT',d:'AUX XFR',sm:1,up:'OVRD',dn:'AUTO'});
add({id:'fwL',t:'guard',x:30,y:1182,l:'FIREWALL SHUTOFF VALVE LEFT',d:'FIREWALL L',up:'OPEN'});
add({id:'mask',t:'tog',x:290,y:1262,l:'CREW O2 MASK – DON',d:'CREW MASK',sm:1,up:'ON',dn:'STOWED'});
add({id:'fwR',t:'guard',x:340,y:1182,l:'FIREWALL SHUTOFF VALVE RIGHT',d:'FIREWALL R',up:'OPEN'});
/* circuit breakers: fuel panel and right side panel */
const CBS=[]; const cbAdd=(k,l,x,y)=>{ const i=CBS.length; CBS.push({k,l}); add({id:'cb'+i,t:'cb',x,y,l,cb:k,ds:k}); };
[['FW VALVE L','FIREWALL VALVE L'],['STBY PUMP L','STBY PUMP L'],['AUX XFR L','AUX XFR L'],['QTY IND L','QTY IND L'],['PRESS WARN L','PRESS WARN L'],['CROSSFEED','CROSSFEED'],['PRESS WARN R','PRESS WARN R'],['QTY IND R','QTY IND R'],['AUX XFR R','AUX XFR R'],['STBY PUMP R','STBY PUMP R'],['FW VALVE R','FIREWALL VALVE R']].forEach(([k,l],i)=>cbAdd(k,l,64+i*24.4,1166));
[['START L','START CTL L'],['IGN L','IGNITOR PWR L'],['PROP DEICE','PROP DEICE'],['FLAP','FLAP MOTOR'],['FLAP CTL','FLAP CONTROL'],['PROP GOV','PROP GOV'],['IGN R','IGNITOR PWR R'],['START R','START CTL R']].forEach(([k,l],i)=>cbAdd(k,l,70+i*33,1206));
const RCB=[['ENGINES',[['AUTOFEATHER','AUTOFEATHER'],['PROP SYNC','PROP SYNC'],['FIRE DET','FIRE DET'],['CHIP DET','CHIP DET'],['ENG ANTI-ICE','ENG ANTI-ICE'],['STBY ANTI-ICE','STBY ENG ANTI-ICE']]],
 ['WARNING',[['ANN POWER','ANNUN POWER'],['ANN IND','ANNUN IND'],['BLEED WARN','BLEED AIR WARN'],['GEAR IND','LDG GEAR IND'],['GEAR WARN','LDG GEAR WARN'],['STALL WARN','STALL WARN']]],
 ['FLIGHT',[['PITCH TRIM','PITCH TRIM'],['RUDDER BOOST','RUDDER BOOST'],['TURN & SLIP','TURN & SLIP'],['ENCD ALTM','ENCD ALTM'],['OAT','OAT'],['PRESS CONT','PRESS CONT']]],
 ['AVIONICS',[['AV MASTER','AVIONICS MASTER'],['AUTOPILOT','AP / FCS POWER'],['COMM 1','COMM 1'],['NAV 1','NAV 1'],['COMM 2','COMM 2'],['NAV 2','NAV 2'],['XPDR','XPNDR'],['ADF','ADF'],['DME','DME'],['AUDIO','AUDIO']]]];
{ let row=0; RCB.forEach(([g,list])=>{ list.forEach(([k,l],i)=>{ const r=row+Math.floor(i/6); cbAdd(k,l,1668+(i%6)*52,1004+r*44); }); row+=Math.ceil(list.length/6); }); }
add({id:'oatF',t:'push',x:190,y:1268,r:6,l:'FREE AIR TEMP – PUSH FOR °F',d:'°F'});
add({id:'altStatic',t:'guard',x:1700,y:1262,l:"PILOT'S STATIC AIR SOURCE",d:'STATIC AIR',up:'ALTERNATE'});
/* pedestal */
add({id:'trim',t:'vwheel',x:784,y:1036,l:'ELEVATOR TRIM'});
add({id:'pwrL',t:'lev',x:850,y:986,len:100,min:-0.4,max:1,kind:'pwr',l:'POWER L',mk:1,marks:[[1,'MAX'],[0,'IDLE'],[-0.12,'BETA'],[-0.4,'REV']]});
add({id:'pwrR',t:'lev',x:894,y:986,len:100,min:-0.4,max:1,kind:'pwr',l:'POWER R'});
add({id:'propL',t:'lev',x:966,y:986,len:100,min:0,max:1,kind:'prop',l:'PROP L',mk:1,marks:[[1,'2000'],[0.12,'1600'],[0,'FTHR']]});
add({id:'propR',t:'lev',x:1004,y:986,len:100,min:0,max:1,kind:'prop',l:'PROP R'});
add({id:'condL',t:'lev',x:1078,y:986,len:100,min:0,max:1,kind:'cond',l:'CONDITION L',mk:1,marks:[[1,'HI IDLE'],[0.5,'LO IDLE'],[0,'CUTOFF']]});
add({id:'condR',t:'lev',x:1116,y:986,len:100,min:0,max:1,kind:'cond',l:'CONDITION R'});
add({id:'flaps',t:'flap',x:1196,y:1030,l:'FLAPS',vals:['UP','APPR','DOWN']});
[['frPwr','POWER LEVER FRICTION',872],['frProp','PROP LEVER FRICTION',985],['frCond','CONDITION LEVER FRICTION',1097],['frFlap','FLAP / TRIM FRICTION',1196]].forEach(([id,l,x])=>add({id,t:'rot',x,y:1134,r:7,l,d:'FRICTION',s:4.4}));
add({id:'o2Ready',t:'pull',x:762,y:1168,l:'OXYGEN SYSTEM READY (PULL ON)',d:'O2 SYS\nREADY'});
add({id:'elTrim',t:'tog',x:830,y:1168,l:'ELEVATOR ELECTRIC TRIM',d:'ELEV TRIM',sm:1,red:1});
add({id:'rudBoost',t:'tog',x:900,y:1168,l:'RUDDER BOOST',d:'RUDDER\nBOOST',sm:1});
add({id:'rudTrim',t:'hwheel',x:962,y:1166,l:'RUDDER TRIM'});
add({id:'ailTrim',t:'rot',x:1050,y:1172,r:10,l:'AILERON TRIM',d:'AIL TRIM'});
add({id:'pressSw',t:'tog3',x:1132,y:1170,l:'CABIN PRESS',d:'CABIN PRESS',vals:['DUMP','PRESS','TEST']});
add({id:'paxOvr',t:'pull',x:1232,y:1168,l:'PASSENGER OXYGEN MANUAL OVERRIDE',d:'PAX O2\nOVERRIDE'});
[['HDG','HDG'],['NAV','NAV'],['APPR','APPR'],['BC','B/C'],['CLIMB','CLIMB'],['ALT','ALT'],['ALTSEL','ALT SEL'],['VS','VS'],['IAS','IAS'],['DSC','DSC']].forEach(([k,l],i)=>add({id:'ap'+k,t:'abtn',x:812+(i%5)*44,y:i<5?1222:1250,l,momentary:1,lbl:'AP/FD '+l}));
add({id:'apYD',t:'abtn',x:802,y:1282,l:'YAW',momentary:1,lbl:'YAW DAMP ENGAGE'});
add({id:'apAP',t:'abtn',x:842,y:1282,l:'AP',momentary:1,lbl:'AUTOPILOT ENGAGE'});
add({id:'apTurn',t:'rot',x:890,y:1280,r:9,l:'AUTOPILOT TURN KNOB',d:''});
add({id:'apSR',t:'abtn',x:934,y:1282,l:'SR',lbl:'SOFT RIDE'});
add({id:'apHB',t:'abtn',x:970,y:1282,l:'½',lbl:'HALF BANK'});
add({id:'apPitch',t:'enc',x:1010,y:1278,r:9,l:'AUTOPILOT PITCH WHEEL (DN / UP)',d:''});
add({id:'cabAlt',t:'enc',x:1170,y:1236,r:11,l:'CABIN ALTITUDE SELECT',d:'CABIN ALT'});
add({id:'cabRate',t:'rot',x:1222,y:1268,r:9,l:'CABIN RATE',d:'RATE'});
add({id:'gearPump',t:'push',x:702,y:1262,r:11,l:'ALTERNATE GEAR EXTENSION HAND PUMP',d:'ALT GEAR\nPUMP'});
/* control wheels */
add({id:'yokeL',t:'yoke',x:552,y:1218,l:'CONTROL WHEEL'}); add({id:'yokeR',t:'yoke',x:1448,y:1218,l:'CONTROL WHEEL',co:1});
add({id:'apDisc',t:'sbtn',x:552,y:1218,l:'AP DISC',dx:-84,dy:-30,col:'#c62a1d'});
add({id:'trimDn',t:'sbtn',x:552,y:1218,l:'TRIM NOSE DN',dx:-70,dy:-42,col:'#59616b',r:4}); add({id:'trimUp',t:'sbtn',x:552,y:1218,l:'TRIM NOSE UP',dx:-70,dy:-32,col:'#59616b',r:4});

/* ---------- SVG helpers ---------- */
function lab(x,y,t,o){ o=o||{}; const s=o.s||7; return String(t).split('\n').map((ln,i)=>`<text x="${x}" y="${y+i*s*1.12}" class="pl ${o.c||''}" style="font-size:calc(var(--ls,1)*${s}px)" text-anchor="${o.a||'middle'}">${esc(ln)}</text>`).join(''); }
const D=c=>c.d!==undefined?c.d:c.l;
function plate(x,y,w,h,r,cls){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r||6}" class="${cls||'sub'}"/>`; }
function grp(x,y,w,h,t){ return `<path d="M${x} ${y}h${w/2-t.length*2.2-4}M${x+w/2+t.length*2.2+4} ${y}h${w/2-t.length*2.2-4}" class="grpl"/><path d="M${x} ${y}v${h}h${w}v-${h}" class="grpl" stroke-dasharray="1 0"/>${lab(x+w/2,y+2,t,{s:5,c:'gp'})}`; }
function screw(x,y){ return `<g class="screw"><circle cx="${x}" cy="${y}" r="3"/><path d="M${x-2} ${y-1}l4 2"/></g>`; }
const pol=(x,y,r,deg)=>{ const a=deg*Math.PI/180; return [x+Math.sin(a)*r, y-Math.cos(a)*r]; };

function ctlSVG(c){
  const {x,y}=c; let s='';
  switch(c.t){
    case 'tog': { const L=c.xs?13:c.sm?18:24, ls=c.s||5.4; s=`<circle cx="${x}" cy="${y}" r="${c.xs?6:c.sm?7.5:9}" class="nut"/><circle cx="${x}" cy="${y}" r="${c.xs?3.6:c.sm?4.5:5.5}" class="nut2"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.2}" y="${y-L}" width="6.4" height="${L}" rx="3" class="${c.red?'batr':'batg'}"/><ellipse cx="${x}" cy="${y-L+1}" rx="4.2" ry="2.8" class="${c.red?'batr':'batg'}"/></g>${c.xs&&!c.up?'':lab(x,y-L-5,c.up||'ON',{s:4.6,c:'dim'})}`;
      if(c.dn){ s+=lab(x,y+L+5,c.dn,{s:4.4,c:'dim'})+(D(c)?lab(x,y+L+12,D(c),{s:ls}):''); } else s+=(D(c)?lab(x,y+L+6,D(c),{s:ls}):''); break; }
    case 'tog3': { const L=17; s=`<circle cx="${x}" cy="${y}" r="7.5" class="nut"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.2}" y="${y-L}" width="6.4" height="${L}" rx="3" class="batg"/><ellipse cx="${x}" cy="${y-L+1}" rx="4.2" ry="2.8" class="batg"/></g>${lab(x+10,y-13,c.vals[0],{s:4.4,a:'start'})}${c.vals[1]?lab(x+10,y+2,c.vals[1],{s:4.4,a:'start'}):''}${lab(x+10,y+17,c.vals[2],{s:4.4,a:'start'})}${D(c)?lab(x,y+L+11,D(c),{s:5.2}):''}`; break; }
    case 'guard': s=`<circle cx="${x}" cy="${y}" r="8" class="nut"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-3.4}" y="${y-20}" width="6.8" height="20" rx="3.2" class="batg"/><ellipse cx="${x}" cy="${y-19}" rx="4.4" ry="2.9" class="batg"/></g><g class="gd" style="transform-origin:${x}px ${y+12}px"><path d="M${x-12} ${y+12}V${y-22}q0-5 5-5h14q5 0 5 5V${y+12}z" class="guardc"/><path d="M${x-8} ${y-17}h16" class="guardl"/></g>${lab(x,y+23,D(c),{s:5.4})}${lab(x,y-31,c.up||'ON',{s:5,c:'dim'})}${lab(x,y+31,c.id==='altStatic'?'NORMAL ↓':'CLOSED ↓',{s:4.4,c:'dim'})}`; break;
    case 'rot': { const r=c.r||12; s=`<circle cx="${x}" cy="${y}" r="${r+3}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/><circle cx="${x}" cy="${y}" r="${r-4}" class="knobtop"/><rect x="${x-1.2}" y="${y-r+1}" width="2.4" height="${r*0.6}" class="ptr"/></g>${D(c)?lab(x,y+r+9,D(c),{s:c.s||5.2}):''}`; break; }
    case 'enc': { const r=c.r||12; s=`<circle cx="${x}" cy="${y}" r="${r+3}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/>${Array.from({length:12},(_,i)=>{ const [a,b]=pol(x,y,r-0.5,i*30), [e,f]=pol(x,y,r-3,i*30); return `<path d="M${a} ${b}L${e} ${f}" class="knurl"/>`; }).join('')}<circle cx="${x}" cy="${y}" r="${r*0.45}" class="knobtop"/><rect x="${x-1}" y="${y-r+1}" width="2" height="${r*0.45}" class="ptr"/></g>${D(c)?lab(x,y+r+9,D(c),{s:5.2}):''}`; break; }
    case 'enc2': { const r=c.r||14, ri=r*0.56; s=`<circle cx="${x}" cy="${y}" r="${r+2.5}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/>${Array.from({length:16},(_,i)=>{ const [a,b]=pol(x,y,r-0.5,i*22.5), [e,f]=pol(x,y,r-3,i*22.5); return `<path d="M${a} ${b}L${e} ${f}" class="knurl"/>`; }).join('')}</g><g class="mvi rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${ri}" class="knob2"/><rect x="${x-0.9}" y="${y-ri+1}" width="1.8" height="${ri*0.6}" class="ptr"/></g>`; break; }
    case 'rotsel': { const r=12; s=`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/>${c.vals.map((v,i)=>{ const [a,b]=pol(x,y,r+(v.length>4?15:10),c.ang[i]); return `<text x="${a}" y="${b+1.8}" class="pl" font-size="${c.s||4.6}" text-anchor="middle">${esc(v)}</text>`; }).join('')}<g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/><path d="M${x-3} ${y+r-2}L${x} ${y-r+2}L${x+3} ${y+r-2}z" class="ptrbar"/></g>${D(c)?lab(x,y+r+10,D(c),{s:5}):''}`; break; }
    case 'push': { const r=c.r||10; s=`<circle cx="${x}" cy="${y}" r="${r+2.5}" class="ring0"/><g class="mv pb"><circle cx="${x}" cy="${y}" r="${r}" class="${c.red?'pbtnr':'pbtn'}"/><circle cx="${x-r*0.3}" cy="${y-r*0.35}" r="${r*0.35}" class="spec"/></g>${D(c)?lab(x,y+r+8,D(c),{s:c.s||4.8}):''}`; break; }
    case 'bar': { const w=c.w,h=c.h; s=`<g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="3" class="gangb"/><text x="${x}" y="${y+2.6}" class="pl" font-size="7" text-anchor="middle">${esc(D(c))}</text></g>`; break; }
    case 'mbtn': { const w=c.w, h=c.h; s=`<rect x="${x-w/2-3}" y="${y-h/2-3}" width="${w+6}" height="${h+6}" rx="3" class="bezel1"/><g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="mb mb-${c.col}"/><text x="${x}" y="${y-(h>30?2:1)}" class="mbt" font-size="${h>30?7.4:6.6}" text-anchor="middle">${esc(c.l1)}</text><text x="${x}" y="${y+(h>30?9:8)}" class="mbt" font-size="${h>30?7.4:5.2}" text-anchor="middle">${esc(c.l2)}</text></g>`; break; }
    case 'abtn': { const w=c.l.length>4?38:30; s=`<g class="mv pb"><rect x="${x-w/2}" y="${y-10}" width="${w}" height="20" rx="2.5" class="abtn"/><rect class="aled" x="${x-6}" y="${y-7.5}" width="12" height="2.2" rx="1"/><text x="${x}" y="${y+6}" class="pl" font-size="${c.l.length>4?5.6:6.6}" text-anchor="middle">${esc(c.l)}</text></g>`; break; }
    case 'gear': s=`<rect x="${x-9}" y="${y-36}" width="18" height="72" rx="8" class="slot"/>${lab(x-14,y-28,'UP',{s:6,a:'end'})}${lab(x-14,y+33,'DN',{s:6,a:'end'})}<g class="mv gk"><rect x="${x-2.2}" y="${y-30}" width="4.4" height="30" class="rod"/><circle cx="${x}" cy="${y-30}" r="10" class="wheelk"/><circle cx="${x}" cy="${y-30}" r="4.5" class="wheelh"/><circle class="gl gU" cx="${x}" cy="${y-30}" r="3.4"/></g>${lab(x,y+46,'LDG GEAR',{s:5.2})}`; break;
    case 'flap': s=`<rect x="${x-8}" y="${y-36}" width="16" height="72" rx="7" class="slot"/>${c.vals.map((v,i)=>lab(x-15,y-30+i*30+2,v,{s:5.6,a:'end'})).join('')}<g class="mv fk"><rect x="${x-14}" y="${y-36}" width="28" height="12" rx="3" class="flapk"/><path d="M${x-10} ${y-30}h20" class="flapl"/></g>${lab(x,y+48,'FLAP',{s:6})}`; break;
    case 'cb': { const ln=String(c.ds||c.l).split(' '); const l1=ln.length>1?ln.slice(0,-1).join(' '):(c.ds||c.l), l2=ln.length>1?ln[ln.length-1]:''; s=`<circle cx="${x}" cy="${y}" r="7" class="cbcol"/><g class="mv cbk"><circle cx="${x}" cy="${y}" r="5.2" class="cbh"/></g><text x="${x}" y="${y+13}" class="pl" font-size="3.9" text-anchor="middle">${esc(l1)}</text>${l2?`<text x="${x}" y="${y+17.6}" class="pl" font-size="3.9" text-anchor="middle">${esc(l2)}</text>`:''}`; break; }
    case 'pull': s=`<circle cx="${x}" cy="${y}" r="11" class="ring0"/><g class="mv pk" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="8.5" class="pullk"/><circle cx="${x}" cy="${y}" r="3" class="knobtop"/></g>${lab(x,y+19,D(c),{s:4.8})}`; break;
    case 'vwheel': s=`<rect x="${x-14}" y="${y-58}" width="28" height="116" rx="8" class="slot"/><svg x="${x-10}" y="${y-54}" width="20" height="108" overflow="hidden"><g class="mv wr">${Array.from({length:36},(_,i)=>`<rect x="0" y="${i*6-54}" width="20" height="3" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x+16} ${y}h7" class="tomark"/>${lab(x+18,y-6,'T/O',{s:5,a:'start'})}${lab(x,y-63,'NOSE DN',{s:5})}${lab(x,y+67,'NOSE UP',{s:5})}<path class="mv trind" d="M${x-24} ${y}l6-4v8z"/>${lab(x,y+76,'ELEV TRIM',{s:5})}`; break;
    case 'hwheel': s=`<rect x="${x-40}" y="${y-8}" width="80" height="16" rx="7" class="slot"/><svg x="${x-36}" y="${y-5}" width="72" height="10" overflow="hidden"><g class="mv wr">${Array.from({length:26},(_,i)=>`<rect y="0" x="${i*6-42}" width="3" height="10" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x} ${y-10}v-5" class="tomark"/><path class="mv trind" d="M${x} ${y+10}l-4 6h8z"/>${lab(x-44,y+3,'L',{s:6,a:'end'})}${lab(x+44,y+3,'R',{s:6,a:'start'})}${lab(x,y+26,'RUDDER TRIM',{s:5})}`; break;
    case 'lev': { const L=c.len, ly=v=>y+(c.max-v)/(c.max-c.min)*L; const hw=c.kind==='pwr'?14:11;
      const knob=c.kind==='pwr'?`<path d="M${x-hw} ${y-6}q0-7 7-7h${2*hw-14}q7 0 7 7v6q0 6-6 6h-${2*hw-12}q-6 0-6-6z" class="lever"/><path d="M${x-hw+5} ${y-5}h${2*hw-10}M${x-hw+5} ${y-1}h${2*hw-10}M${x-hw+5} ${y+3}h${2*hw-10}" class="grip"/>`
        :c.kind==='prop'?`<rect x="${x-hw}" y="${y-9}" width="${2*hw}" height="16" rx="7" class="levP"/><path d="M${x-hw+4} ${y-4}h${2*hw-8}M${x-hw+4} ${y}h${2*hw-8}" class="gripP"/>`
        :`<rect x="${x-hw}" y="${y-9}" width="${2*hw}" height="16" rx="3" class="levC"/><path d="M${x-hw+3} ${y-1}h${2*hw-6}" class="gripP"/>`;
      s=`<rect x="${x-5}" y="${y-10}" width="10" height="${L+20}" rx="4" class="slot"/>${c.mk?c.marks.map(([v,t])=>`<path d="M${x-20} ${ly(v)}h8" class="tick"/>${lab(x-22,ly(v)+2,t,{s:4.6,a:'end'})}`).join(''):''}<g class="mv lv"><rect x="${x-2.2}" y="${y}" width="4.4" height="14" class="rod"/>${knob}</g>${lab(x,y+L+20,c.l.slice(-1),{s:6})}`; break; }
    case 'yoke': { const X=x; s=`<path d="M${X-10} ${H}V${y+18}h20V${H}z" class="col"/><g class="mv skg" style="transform-origin:${X}px ${y}px"><path d="M${X-80} ${y-34}q-12 0-12 12v26q0 10 12 10h160q12 0 12-10v-26q0-12-12-12q-8 0-8 10v16h-144v-16q0-10-8-10z" class="yk"/><circle cx="${X}" cy="${y}" r="16" class="ykh"/><rect x="${X-14}" y="${y-5}" width="28" height="10" rx="2" class="ykp"/><text x="${X}" y="${y+2.5}" class="pl" font-size="4.6" text-anchor="middle">${c.co?'':'B200'}</text></g>`; break; }
    case 'sbtn': { const r=c.r||5; s=`<g class="mv sbm" style="transform-origin:${x}px ${y}px"><circle cx="${x+c.dx}" cy="${y+c.dy}" r="${r}" fill="${c.col}" stroke="#000"/></g>`; break; }
  }
  const role=({tog:'switch',guard:'switch',push:'button',bar:'button',mbtn:'button',abtn:'button',cb:'switch',pull:'switch',gear:'switch',sbtn:'button',yoke:'application'})[c.t]||'slider';
  return `<g class="ctl t-${c.t}" data-id="${c.id}" tabindex="0" role="${role}" aria-label="${esc(c.lbl||c.l)}">${s}</g>`;
}

/* ---------- round gauges ---------- */
const GA={};
function dial(id,x,y,r,o){
  GA[id]={x,y,r,sc:o.sc};
  let t=`<circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>`;
  o.sc.forEach(sc=>{ const A=v=>angOf(sc,v);
    (sc.arcs||[]).forEach(([a,b,cls])=>{ const rr=r-2.5; const [x0,y0]=pol(x,y,rr,A(a)), [x1,y1]=pol(x,y,rr,A(b)); const big=Math.abs(A(b)-A(a))>180?1:0, sw=A(b)>A(a)?1:0; t+=`<path d="M${x0} ${y0}A${rr} ${rr} 0 ${big} ${sw} ${x1} ${y1}" class="${cls}" style="stroke-width:${Math.max(2.5,r*0.07)}px"/>`; });
    if(sc.mnr) for(let v=sc.min; v<=sc.max+1e-6; v+=sc.mnr){ const a=A(v); const maj=sc.maj&&Math.abs(v/sc.maj-Math.round(v/sc.maj))<1e-6; const L=maj?r*0.16:r*0.08; const [a0,b0]=pol(x,y,r,a), [a1,b1]=pol(x,y,r-L,a); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="dtick" style="stroke-width:${maj?1.3:0.8}px"/>`;
      if(maj&&sc.lab){ const s=sc.lab(v); if(s!==null&&s!==undefined){ const [lx,ly]=pol(x,y,r*(sc.lr||0.68),a); t+=`<text x="${lx}" y="${ly+r*0.07}" class="dnum" font-size="${(sc.fs||0.19)*r}" text-anchor="middle">${s}</text>`; } } }
    (sc.red||[]).forEach(v=>{ const [a0,b0]=pol(x,y,r,A(v)), [a1,b1]=pol(x,y,r-r*0.22,A(v)); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="redl" style="stroke-width:${Math.max(2,r*0.06)}px"/>`; });
    (sc.dash||[]).forEach(v=>{ const [a0,b0]=pol(x,y,r,A(v)), [a1,b1]=pol(x,y,r-r*0.22,A(v)); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="redl" stroke-dasharray="2 1.5" style="stroke-width:${Math.max(2,r*0.06)}px"/>`; });
  });
  if(o.title) t+=lab0(x,y+r*(o.ty||0.42),o.title,r*(o.tfs||0.15));
  if(o.unit) t+=lab0(x,y+r*(o.uy||0.6),o.unit,r*0.12);
  if(o.dig) t+=`<rect x="${x-r*0.36}" y="${y+r*0.12}" width="${r*0.72}" height="${r*0.24}" rx="1.5" class="digw"/><text class="dig dg-${id}" x="${x}" y="${y+r*0.3}" font-size="${r*0.19}" text-anchor="middle">0</text>`;
  if(o.extra) t+=o.extra;
  o.sc.forEach(sc=>{ if(sc.nond) return; const L=sc.nl||r-5; t+=`<g class="nd nd-${id}${sc.nd||''}" style="transform-origin:${x}px ${y}px;transform:rotate(${angOf(sc,sc.min)}deg)"><path d="M${x-r*0.035} ${y+r*0.12}L${x-r*0.02} ${y-L+4}L${x} ${y-L}L${x+r*0.02} ${y-L+4}L${x+r*0.035} ${y+r*0.12}z" class="needle ${sc.ncls||''}"/></g>`; });
  t+=`<circle cx="${x}" cy="${y}" r="${r*0.07}" class="hub"/>`;
  return `<g class="gauge" data-g="${id}">${t}</g>`;
}
function lab0(x,y,t,fs){ return String(t).split('\n').map((ln,i)=>`<text x="${x}" y="${y+i*fs*1.15}" class="dnum dt" font-size="${fs}" text-anchor="middle">${esc(ln)}</text>`).join(''); }
function angOf(sc,v){ const f=sc.f?sc.f(v):(clamp(v,sc.min,sc.max)-sc.min)/(sc.max-sc.min); return sc.a0+f*(sc.a1-sc.a0); }

/* ASI: non-linear, 40 → 300 kt */
const asiF=v=>{ v=clamp(v,40,300); return v<=160?(v-40)/120*0.55:0.55+(v-160)/140*0.45; };
function asi(id,x,y,r){ return dial(id,x,y,r,{sc:[{min:40,max:300,a0:10,a1:345,f:asiF,maj:20,mnr:10,lab:v=>v%40===0&&v>=80?v:null,fs:0.15,lr:0.66,
  arcs:[[75,157,'awhite'],[99,259,'agreen']],red:[86,259]}],title:'AIRSPEED',unit:'KNOTS',ty:-0.3,uy:-0.17,
  extra:(()=>{ const sc={min:40,max:300,a0:10,a1:345,f:asiF}; const b=angOf(sc,121); const [a0,b0]=pol(x,y,r,b),[a1,b1]=pol(x,y,r-r*0.22,b); const tr=angOf(sc,200); const [t0,t1]=pol(x,y,r-3,tr); return `<path d="M${a0} ${b0}L${a1} ${b1}" class="bluel" style="stroke-width:${r*0.06}px"/><path d="M${t0} ${t1}l-3 -5h6z" fill="#fff" transform="rotate(${tr} ${t0} ${t1})"/>`; })()}); }
function alt(id,x,y,r){ const sc={min:0,max:1000,a0:0,a1:360,maj:100,mnr:20,lab:v=>v<1000?v/100:null,fs:0.24,lr:0.66,nd:'0',nl:r-6};
  const s1={min:0,max:10000,a0:0,a1:360,nd:'1',nl:r*0.5,ncls:'wide'}; const s2={min:0,max:100000,a0:0,a1:360,nd:'2',nl:r-2,ncls:'thin'};
  return dial(id,x,y,r,{sc:[sc,s1,s2],title:'ALT',ty:-0.3,tfs:0.12,extra:`<rect x="${x+r*0.12}" y="${y+r*0.15}" width="${r*0.56}" height="${r*0.22}" rx="1" class="digw"/><text class="dig kol-${id}" x="${x+r*0.4}" y="${y+r*0.32}" font-size="${r*0.17}" text-anchor="middle">1013</text><text x="${x-r*0.38}" y="${y+r*0.32}" class="dnum" font-size="${r*0.1}" text-anchor="middle">100 FT</text><text class="hflag altflag-${id}" x="${x-r*0.5}" y="${y-r*0.42}" fill="#ffcf3a" font-size="${r*0.11}" font-weight="700" style="opacity:0">ALT STATIC</text>`}); }
const vsiF=v=>{ const a=Math.min(1,Math.pow(Math.abs(v)/6000,0.62)); return 0.5+Math.sign(v)*a*0.5; };
function vsi(id,x,y,r){ return dial(id,x,y,r,{sc:[{min:-6000,max:6000,a0:-90-165,a1:-90+165,f:vsiF,maj:1000,mnr:500,lab:v=>[0,1000,2000,4000,-1000,-2000,-4000].includes(v)?Math.abs(v)/1000:null,fs:0.22}],title:'VERTICAL SPEED',unit:'×1000 FT/MIN',ty:-0.28,uy:0.34,tfs:0.1,extra:`<text x="${x-r*0.4}" y="${y-r*0.08}" class="dnum" font-size="${r*0.11}">UP</text><text x="${x-r*0.4}" y="${y+r*0.17}" class="dnum" font-size="${r*0.11}">DN</text>`}); }
function adi(id,x,y,r,fd){
  const clip='ac-'+id; let lad=''; for(let p=-30;p<=30;p+=5){ if(!p) continue; const w=p%10?r*0.16:r*0.32; lad+=`<path d="M${x-w/2} ${y-p*r*0.04}h${w}" stroke="#fff" stroke-width="1.1"/>${p%10?'':`<text x="${x+w/2+3}" y="${y-p*r*0.04+3}" fill="#fff" font-size="${r*0.1}">${Math.abs(p)}</text>`}`; }
  let bank=''; [-60,-45,-30,-20,-10,10,20,30,45,60].forEach(b=>{ const [a0,b0]=pol(x,y,r,b), [a1,b1]=pol(x,y,r-(Math.abs(b)%30===0?r*0.14:r*0.08),b); bank+=`<path d="M${a0} ${b0}L${a1} ${b1}" stroke="#fff" stroke-width="1.4"/>`; });
  return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><g clip-path="url(#${clip})"><g class="att att-${id}" style="transform-origin:${x}px ${y}px"><g class="attp attp-${id}"><rect x="${x-r*3}" y="${y-r*3}" width="${r*6}" height="${r*3}" fill="#2f86d6"/><rect x="${x-r*3}" y="${y}" width="${r*6}" height="${r*3}" fill="#7b4a22"/><path d="M${x-r*3} ${y}h${r*6}" stroke="#fff" stroke-width="1.5"/>${lad}</g><path d="M${x} ${y-r+2}l-4 7h8z" fill="#fff"/></g></g>${bank}<path d="M${x} ${y-r+1}l-5 -0.5 5 9 5 -9z" fill="#ffb000"/>
   ${fd?`<g class="fdb fdb-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-r*0.62} ${y+r*0.2}L${x} ${y}L${x+r*0.62} ${y+r*0.2}" class="fdv"/></g>`:''}
   <path d="M${x-r*0.55} ${y+r*0.2}L${x} ${y+2}L${x+r*0.55} ${y+r*0.2}" class="acv"/><circle cx="${x}" cy="${y+1}" r="2" fill="#ffb000"/>
   <rect x="${x-r*0.32}" y="${y+r*0.68}" width="${r*0.64}" height="${r*0.15}" rx="${r*0.07}" class="balltube"/><path d="M${x-r*0.07} ${y+r*0.68}v${r*0.15}M${x+r*0.07} ${y+r*0.68}v${r*0.15}" stroke="#000" stroke-width="1"/><circle class="ball ball-${id}" cx="${x}" cy="${y+r*0.755}" r="${r*0.06}" fill="#111" style="transform-origin:${x}px ${y}px"/>
   <text x="${x-r*0.85}" y="${y+r*0.95}" class="dnum" font-size="${r*0.11}">${fd?'ATTITUDE':'ATT'}</text></g>`;
}
function card(x,y,r,cls){ let t=''; for(let d=0;d<360;d+=5){ const L=d%30===0?r*0.14:d%10===0?r*0.09:r*0.05; const [a0,b0]=pol(x,y,r,d),[a1,b1]=pol(x,y,r-L,d); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" stroke="#eee" stroke-width="${d%10?0.7:1.1}"/>`; if(d%30===0){ const [lx,ly]=pol(x,y,r*0.72,d); const s={0:'N',90:'E',180:'S',270:'W'}[d]||d/10; t+=`<text x="${lx}" y="${ly+r*0.06}" fill="#eee" font-size="${r*(d%90?0.13:0.17)}" font-weight="700" text-anchor="middle" transform="rotate(${d} ${lx} ${ly})">${s}</text>`; } } return `<g class="${cls}" style="transform-origin:${x}px ${y}px">${t}</g>`; }
function hsi(id,x,y,r){ return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-2,'hcard hcard-'+id)}
  <g class="hbug hbug-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-6} ${y-r+1}h12v6l-3 0-3 4-3-4-3 0z" fill="#ff8a00"/></g>
  <g class="hcrs hcrs-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y-r*0.82}l-5 9h3.4v${r*0.3}h3.2v-${r*0.3}h3.4z M${x-1.6} ${y+r*0.4}h3.2v${r*0.4}h-3.2z" fill="#ffd400"/>${[-2,-1,1,2].map(k=>`<circle cx="${x+k*r*0.17}" cy="${y}" r="2.2" fill="none" stroke="#fff" stroke-width="1"/>`).join('')}<g class="hdev hdev-${id}"><rect x="${x-1.6}" y="${y-r*0.36}" width="3.2" height="${r*0.72}" fill="#ffd400"/></g><path class="htf htf-${id}" d="M${x+r*0.3} ${y-r*0.2}l-5 7h10z" fill="#fff"/></g>
  <path d="M${x-r*0.28} ${y+2}h${r*0.56}M${x} ${y-r*0.18}v${r*0.4}M${x-r*0.12} ${y+r*0.2}h${r*0.24}" stroke="#ffb000" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M${x} ${y-r-4}l-4 -5h8z" fill="#fff"/>${[45,90,135,225,270,315].map(d=>{ const [a,b]=pol(x,y,r+3,d); const [e,f]=pol(x,y,r+8,d); return `<path d="M${a} ${b}L${e} ${f}" stroke="#fff" stroke-width="1.6"/>`; }).join('')}
  <g class="hgs hgs-${id}"><path d="M${x+r+1} ${y}l-6 -4v8z" fill="#2ce36a"/></g><text class="hflag hflag-${id}" x="${x-r*0.5}" y="${y-r*0.35}" fill="#ff3b2b" font-size="${r*0.12}" font-weight="700">NAV</text><text class="hflag hhdg-${id}" x="${x+r*0.22}" y="${y-r*0.35}" fill="#ff3b2b" font-size="${r*0.12}" font-weight="700" style="opacity:0">HDG</text></g>`; }
function rmi(id,x,y,r,n){ return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-2,'rcard rcard-'+id)}
  <g class="rn1 rn1-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y-r*0.8}l-4 8h8z M${x-1.3} ${y-r*0.66}h2.6v${r*1.4}h-2.6z" fill="#2ce36a"/></g>
  <g class="rn2 rn2-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-3.5} ${y+r*0.72}v-${r*1.4}l3.5-6 3.5 6v${r*1.4}" fill="none" stroke="#ffd400" stroke-width="1.8"/></g>
  <path d="M${x} ${y-r-4}l-4 -5h8z" fill="#fff"/><circle cx="${x}" cy="${y}" r="3" class="hub"/><text x="${x}" y="${y+r+13}" class="dnum" font-size="7" text-anchor="middle">RMI · ● NAV ${n} · ‖ ADF</text></g>`; }
function ts(id,x,y,r){ return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>
  ${[-1,1].map(k=>{ const [a,b]=pol(x,y,r,k*20), [e,f]=pol(x,y,r-r*0.2,k*20); return `<path d="M${a} ${b}L${e} ${f}" stroke="#fff" stroke-width="3"/>`; }).join('')}<path d="M${x} ${y-r}v${r*0.2}" stroke="#fff" stroke-width="2"/>
  <text x="${x-r*0.55}" y="${y-r*0.45}" class="dnum" font-size="${r*0.2}">L</text><text x="${x+r*0.4}" y="${y-r*0.45}" class="dnum" font-size="${r*0.2}">R</text>
  <g class="tcp tcp-${id}" style="transform-origin:${x}px ${y+r*0.2}px"><path d="M${x-r*0.05} ${y+r*0.2}L${x} ${y-r*0.82}L${x+r*0.05} ${y+r*0.2}z" fill="#fff"/></g><rect x="${x-r*0.3}" y="${y+r*0.1}" width="${r*0.6}" height="${r*0.22}" rx="2" fill="#e8e8e8"/>
  <rect x="${x-r*0.45}" y="${y+r*0.42}" width="${r*0.9}" height="${r*0.2}" rx="${r*0.1}" class="balltube"/><circle class="ball ball-${id}" cx="${x}" cy="${y+r*0.52}" r="${r*0.085}" fill="#111"/>
  <text x="${x}" y="${y+r*0.86}" class="dnum" font-size="${r*0.16}" text-anchor="middle">DC</text><text class="hflag tsflag-${id}" x="${x+r*0.22}" y="${y+r*0.86}" fill="#ff3b2b" font-size="${r*0.14}" font-weight="700" style="opacity:0">OFF</text></g>`; }
function synchro(x,y,r){ let p=''; for(let i=0;i<4;i++){ const a0=i*90, [x0,y0]=pol(x,y,r*0.85,a0-20), [x1,y1]=pol(x,y,r*0.85,a0+20); p+=`<path d="M${x} ${y}L${x0} ${y0}A${r*0.85} ${r*0.85} 0 0 1 ${x1} ${y1}z" fill="#f2f2f2"/>`; }
  return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+4}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" fill="#0d0e10"/><g class="syn" style="transform-origin:${x}px ${y}px">${p}</g><circle cx="${x}" cy="${y}" r="${r*0.15}" class="hub"/>${lab(x,y+r+11,'SYNCHROSCOPE',{s:4.6,c:'dim'})}</g>`; }
function dme(id,x,y){ return `${plate(x,y,140,70,5,'rbox')}<rect x="${x+8}" y="${y+6}" width="124" height="26" rx="2" class="digw"/><text class="dig dm-${id}a" x="${x+60}" y="${y+25}" font-size="15" text-anchor="end">---.-</text><text class="dig dim dm-${id}u" x="${x+63}" y="${y+25}" font-size="6">NM</text><text class="dig dm-${id}b" x="${x+124}" y="${y+25}" font-size="11" text-anchor="end"></text><text class="dig dim dm-${id}c" x="${x+12}" y="${y+14}" font-size="5.6"></text>${lab(x+70,y+40,'DME',{s:4.6,c:'dim'})}`; }

/* ---------- annunciator panels and lamps ---------- */
const ANN={};
function annGrid(x0,y0,cols,cw,ch,gap,rows,cls,fs){ let t=`<rect x="${x0-4}" y="${y0-4}" width="${cols*(cw+gap)-gap+8}" height="${rows.length*(ch+gap)-gap+8}" rx="3" class="annbox"/>`;
  rows.forEach((row,j)=>row.forEach((it,i)=>{ const x=x0+i*(cw+gap), y=y0+j*(ch+gap); if(!it){ t+=`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="1.5" class="an blank"/>`; return; }
    const [k,txt,col]=Array.isArray(it)?it:[it,it,cls]; const f=fs||(txt.length>12?Math.min(5.4,ch*0.34):Math.min(6.4,ch*0.4)); t+=`<g class="an an-${col}" data-a="${esc(k)}"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="1.5"/><text x="${x+cw/2}" y="${y+ch/2+f*0.36}" font-size="${f}" text-anchor="middle">${esc(txt)}</text></g>`; }));
  return t; }
/* warning panel and caution/advisory panel as shown for later B200 serials */
const WARN=[['L ENG FIRE','INVERTER','DOOR UNLOCKED','ALT WARN','R ENG FIRE'],['L FUEL PRESS',null,null,null,'R FUEL PRESS'],['L OIL PRESS','L GEN OVHT','A/P TRIM FAIL','R GEN OVHT','R OIL PRESS'],[null,'L BL AIR FAIL','A/P FAIL','R BL AIR FAIL',null]];
const G_=k=>[k,k,'g'];
const CAUT=[['L DC GEN',null,'HYD FLUID LOW','RVS NOT READY',null,'R DC GEN'],['L CHIP DETECT',null,null,'DUCT OVERTEMP',null,'R CHIP DETECT'],['L ENG ICE FAIL',null,'BATTERY CHARGE','EXT PWR',null,'R ENG ICE FAIL'],
  [G_('L AUTOFEATHER'),null,'ELEC TRIM OFF',G_('AIR COND N1 LOW'),null,G_('R AUTOFEATHER')],[G_('L ENG ANTI-ICE'),G_('BRAKE DEICE ON'),G_('LDG/TAXI LIGHT'),G_('PASS OXY ON'),G_('ELEC HEAT ON'),G_('R ENG ANTI-ICE')],
  [G_('L IGNITION ON'),G_('L BL AIR OFF'),null,G_('FUEL CROSSFEED'),G_('R BL AIR OFF'),G_('R IGNITION ON')]];
const lamp=(k,x,y,w,h,txt,col,fs)=>annGrid(x,y,1,w,h,0,[[[k,txt,col]]],col,fs);

/* ---------- the panel ---------- */
function panelSVG(){
  const rows=[330,395,460,525,590,655], cx=[785,905], er=30;
  const ENG=[
    ['ITT','ITT',{sc:[{min:0,max:1200,a0:-135,a1:135,maj:200,mnr:50,lab:v=>v/100,fs:0.24,arcs:[[400,800,'agreen']],red:[800],dash:[1000]}],unit:'°C ×100',uy:0.62,dig:1}],
    ['TQ','TORQUE',{sc:[{min:0,max:3000,a0:-135,a1:135,maj:500,mnr:100,lab:v=>v/100,fs:0.24,arcs:[[400,2230,'agreen']],red:[2230]}],unit:'FT-LB ×100',uy:0.62,dig:1}],
    ['NP','PROP RPM',{sc:[{min:0,max:2400,a0:-135,a1:135,maj:400,mnr:100,lab:v=>v/100,fs:0.24,arcs:[[1600,2000,'agreen']],red:[2000]}],unit:'RPM ×100',uy:0.62,dig:1}],
    ['NG','TURBINE %RPM',{sc:[{min:0,max:110,a0:-135,a1:135,maj:10,mnr:5,lab:v=>v%20===0?v:null,fs:0.22,arcs:[[61,101.5,'agreen']],red:[101.5]}],unit:'N1 %',uy:0.62,dig:1}],
    ['FF','FUEL FLOW',{sc:[{min:0,max:800,a0:-135,a1:135,maj:100,mnr:50,lab:v=>v%200===0?v/100:null,fs:0.24}],unit:'PPH ×100',uy:0.62}],
    ['OIL','OIL',{sc:[{min:0,max:200,a0:-150,a1:-30,maj:50,mnr:25,lab:v=>v%100===0?v:null,fs:0.18,lr:0.62,arcs:[[100,135,'agreen'],[60,100,'ayellow']],red:[60,135],nd:'P'},{min:0,max:140,a0:150,a1:30,maj:20,mnr:20,lab:v=>v%40===0?v:null,fs:0.18,lr:0.62,arcs:[[10,99,'agreen']],red:[99],nd:'T',ncls:'amb'}],unit:'PSI  ·  °C',uy:0.5}]];
  let engs=''; ENG.forEach(([k,t,o],j)=>{ cx.forEach((x,i)=>{ engs+=dial(k+(i?'R':'L'),x,rows[j],er,o); }); engs+=lab(845,rows[j]-2,t,{s:5.4,c:'gp'})+lab(845,rows[j]+8,'L · R',{s:4.6,c:'dim'}); });
  const radio=(k,n,x,y)=>{ const two=k!=='xpdr', an=k.startsWith('com')?['ACT','MEM','TX']:k.startsWith('nav')?['ACT','MEM','HLD']:k==='adf'?['ACT','MEM','']:['ACT','TX',''];
    return `${plate(x,y,166,88,4,'rbox')}<text x="${x+6}" y="${y+8}" class="pl" font-size="5.2">${n}</text><rect x="${x+6}" y="${y+11}" width="104" height="${two?36:36}" rx="2" class="digw"/>
    <text class="dig rd-${k}A" x="${x+104}" y="${y+(two?27:34)}" font-size="${two?14:17}" text-anchor="end">---</text><text class="dig dim rd-${k}S" x="${x+104}" y="${y+43}" font-size="${two?11:6}" text-anchor="end"></text>
    ${an.map((t,i)=>t?`<text class="dig rda rd-${k}N${i}" x="${x+10}" y="${y+19+i*9}" font-size="5.4"></text>`:'').join('')}`; };
  const meter=(id,x,y,r,o)=>dial(id,x,y,r,o);
  return `<svg class="psvg" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
<defs>
 <linearGradient id="gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5056"/><stop offset=".6" stop-color="#3d4247"/><stop offset="1" stop-color="#33373c"/></linearGradient>
 <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f45"/><stop offset="1" stop-color="#2c3035"/></linearGradient>
 <linearGradient id="gGlare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1d20"/><stop offset=".85" stop-color="#0d0f11"/><stop offset="1" stop-color="#202327"/></linearGradient>
 <linearGradient id="gCons" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2e33"/><stop offset="1" stop-color="#17191c"/></linearGradient>
 <linearGradient id="gOvh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3530"/><stop offset="1" stop-color="#2b2723"/></linearGradient>
 <radialGradient id="gKnob" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#5d646d"/><stop offset=".6" stop-color="#25292e"/><stop offset="1" stop-color="#121417"/></radialGradient>
 <radialGradient id="gKnob2" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#7a828c"/><stop offset=".7" stop-color="#363b42"/><stop offset="1" stop-color="#1a1d21"/></radialGradient>
 <radialGradient id="gMetal" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f2f4f6"/><stop offset=".45" stop-color="#a7adb4"/><stop offset="1" stop-color="#5a6067"/></radialGradient>
 <linearGradient id="gBat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d949b"/><stop offset=".45" stop-color="#f4f6f8"/><stop offset="1" stop-color="#6f767d"/></linearGradient>
 <linearGradient id="gBatR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f1d14"/><stop offset=".45" stop-color="#ef4a3a"/><stop offset="1" stop-color="#7d160f"/></linearGradient>
 <linearGradient id="gLever" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5057"/><stop offset="1" stop-color="#16181b"/></linearGradient>
 <linearGradient id="gYoke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4046"/><stop offset="1" stop-color="#121416"/></linearGradient>
 <filter id="fGlow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation=".6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fLed" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".55"/></filter>
 <clipPath id="cCmp"><rect x="1218" y="128" width="84" height="30" rx="4"/></clipPath>
</defs>
<!-- overhead light control panel -->
<path d="M560 0H1440V170Q1440 214 1396 214H604Q560 214 560 170Z" fill="#141518"/>
${plate(586,6,828,200,10,'ovh')}
${lab(668,30,'WINDSHIELD\nWIPERS',{s:5})}${lab(668,46,'DO NOT OPERATE\nON DRY GLASS',{s:3.8,c:'dim'})}${lab(1180,30,'LIGHTS  (BRT ↻  OFF)',{s:5,c:'gp'})}<circle cx="900" cy="88" r="3" fill="#0b0b0b"/>
${meter('ldL',660,152,28,{sc:[{min:0,max:100,a0:-120,a1:120,maj:20,mnr:10,lab:v=>v,fs:0.2}],title:'% LOAD',ty:0.48,tfs:0.16})}
${meter('ldR',740,152,28,{sc:[{min:0,max:100,a0:-120,a1:120,maj:20,mnr:10,lab:v=>v,fs:0.2}],title:'% LOAD',ty:0.48,tfs:0.16})}
${meter('bam',820,152,28,{sc:[{min:-60,max:60,a0:-120,a1:120,maj:20,mnr:10,lab:v=>v%60===0?(v>0?'+'+v:v):null,fs:0.2}],title:'BATT AMPS',ty:0.48,tfs:0.14})}
${meter('acm',900,152,28,{sc:[{min:380,max:420,a0:-120,a1:120,maj:10,mnr:5,lab:v=>v%20===0?v:null,fs:0.18}],title:'FREQ · AC V',ty:0.48,tfs:0.13})}

<g>${plate(964,112,210,82,4,'plc')}${lab(1069,124,'AIRSPEEDS (IAS)',{s:5.8})}${[['MAX GEAR EXTENSION','181 KT'],['MAX GEAR RETRACT','163 KT'],['MAX GEAR EXTENDED','181 KT'],['MAX APPROACH FLAP','200 KT'],['MAX FULL DOWN FLAP','157 KT'],['MAX MANEUVERING','181 KT']].map(([a,b],i)=>lab(972,135+i*9.6,a,{s:5,a:'start'})+lab(1166,135+i*9.6,b,{s:5,a:'end'})).join('')}</g>
<g>${plate(1206,112,108,82,6,'plc')}<rect x="1218" y="128" width="84" height="30" rx="4" fill="#e9e2c8"/><g clip-path="url(#cCmp)"><g class="cmp">${Array.from({length:30},(_,i)=>{ const d=i*30-360; const n=((d%360)+360)%360; const s={0:'N',90:'E',180:'S',270:'W'}[n]||String(n/10); return `<text x="${1260+d*0.9}" y="149" font-size="10" font-weight="700" text-anchor="middle" fill="#111">${s}</text><path d="M${1260+d*0.9+13.5} 132v6" stroke="#111" stroke-width="0.8"/>`; }).join('')}</g></g><path d="M1260 124v38" stroke="#d0281c" stroke-width="1.6"/>${lab(1260,172,'STANDBY COMPASS',{s:5})}${lab(1260,182,'erratic with WSHLD heat / air cond',{s:3.8,c:'dim'})}</g>
<g>${plate(1324,112,84,82,4,'plc')}${lab(1366,126,'LIMITATIONS',{s:5.2})}${lab(1366,138,'Normal category\nNo acrobatics\nVFR / IFR · day / night\nKnown icing\nSee AFM/POH',{s:4.2,c:'dim'})}</g>
<!-- glareshield and panel face -->
<path d="M10 726V300Q10 222 120 206Q1000 168 1880 206Q1990 222 1990 300V726Z" fill="url(#gGlare)" filter="url(#fShadow)"/>
<path d="M22 722V312Q22 292 110 290Q1000 284 1890 290Q1978 292 1978 312V722Z" fill="url(#gPanel)" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
${plate(28,728,448,232,8)}${plate(536,728,476,232,8)}${plate(1014,728,322,232,8)}${plate(1340,728,394,232,8)}${plate(1764,728,212,232,8)}
<path d="M480 726H532V960H480Z M1736 726H1760V960H1736Z" fill="#101113"/>
${plate(724,294,242,428,6,'sub2')}${plate(970,294,364,428,6,'sub2')}
<!-- glareshield items -->
${annGrid(888,212,5,44,15,2.5,WARN,'r')}
<rect x="787" y="248" width="78" height="13" rx="1" class="annbox"/><rect x="1167" y="248" width="78" height="13" rx="1" class="annbox"/>
${annGrid(791,250,2,34,9,2,[[['L EXT D','D','a'],['L EXT OK','OK','g']]])}${annGrid(1171,250,2,34,9,2,[[['R EXT D','D','a'],['R EXT OK','OK','g']]])}
${lab(1000,292,'WARNING ANNUNCIATORS',{s:4.6,c:'dim'})}
<!-- pilot flight instruments -->
${annGrid(472,266,3,15,13,2,[[['x:mkrO1','O','b'],['x:mkrM1','M','a'],['x:mkrI1','I','w']]],null,7)}${lamp('x:altAl1',526,266,42,13,'ALT ALERT','a',5.4)}${lamp('x:dh1',574,266,22,13,'DH','a',6)}
${annGrid(298,258,6,23,11,2,[['YD','AP','HDG','NAV','APR','B/C'],['ALT','ALTS','VS','IAS','GS','TRIM']].map(r=>r.map(k=>['ap:'+k,k,k==='AP'||k==='YD'?'g':'w'])),null,5.4)}
${ts('ts',90,440,40)}
${plate(38,532,116,82,5,'rbox')}${lab(96,542,'GYRO SLAVING',{s:4.8,c:'gp'})}<rect x="60" y="550" width="72" height="22" rx="3" class="digw"/><g class="slv slv-1" style="transform-origin:96px 574px"><path d="M96 574v-20" stroke="#f2f2f2" stroke-width="1.6"/></g><path d="M64 558h64" stroke="#555" stroke-width=".8"/>${lab(70,568,'−',{s:6})}${lab(122,568,'+',{s:6})}
${asi('asi',215,362,62)}${rmi('rmi',215,522,56,1)}
${dme('d1',160,592)}
${adi('adi',375,362,74,1)}${hsi('hsi',375,548,74)}
${alt('alt',535,362,62)}${vsi('vsi',535,522,56)}
${plate(478,594,128,58,4,'rbox')}${lab(542,603,'ALTITUDE SET',{s:4.8,c:'gp'})}<rect x="484" y="608" width="70" height="20" rx="2" class="digw"/><text class="dig rd-altsel" x="550" y="623" font-size="11" text-anchor="end">3000</text>
${synchro(668,654,24)}
<!-- engine instruments -->
${engs}
<!-- audio control panel -->
${plate(976,296,352,152,5,'rbox')}${lab(1012.0,308,'COMM',{s:4.2,c:'gp'})}${lab(1043.8,308,'NAV',{s:4.2,c:'gp'})}${lab(1075.5,308,'MKR BCN',{s:4.2,c:'gp'})}${lab(1107.3,308,'DME',{s:4.2,c:'gp'})}${lab(1184.0,308,'COMM',{s:4.2,c:'gp'})}${lab(1215.8,308,'NAV',{s:4.2,c:'gp'})}${lab(1247.5,308,'MKR BCN',{s:4.2,c:'gp'})}${lab(1279.3,308,'DME',{s:4.2,c:'gp'})}${lab(1067,355,'PILOT AUDIO OFF',{s:3.8,c:'dim'})}${lab(1240,355,'COPILOT AUDIO OFF',{s:3.8,c:'dim'})}<path d="M1006 350h122M1178 350h122" class="grpl"/>${lab(1152,406,'GND COMM PWR',{s:3.6,c:'dim'})}
<!-- radios -->
${RAD.map(([k,n,x,y])=>radio(k,n,x,y)).join('')}
<!-- copilot flight instruments -->
${annGrid(1782,266,3,15,13,2,[[['x:mkrO2','O','b'],['x:mkrM2','M','a'],['x:mkrI2','I','w']]],null,7)}${lamp('x:altAl2',1836,266,42,13,'ALT ALERT','a',5.4)}${lamp('x:dh2',1884,266,22,13,'DH','a',6)}
${asi('asi2',1420,362,58)}${adi('adi2',1575,362,66,0)}${alt('alt2',1730,362,58)}
${rmi('rmi2',1420,522,54,2)}${hsi('hsi2',1575,535,66)}${vsi('vsi2',1730,522,54)}${ts('ts2',1885,512,40)}
${dial('ra',1420,646,40,{sc:[{min:0,max:2500,a0:-150,a1:150,f:v=>{ v=clamp(v,0,2500); return v<=500?v/500*0.55:0.55+Math.log10(v/500)/Math.log10(5)*0.45; },maj:100,mnr:50,lab:v=>[0,100,200,500,1000,2500].includes(v)?(v>=1000?v/1000+'K':v):null,fs:0.17}],title:'RAD ALT',ty:0.42,tfs:0.13,extra:`<g class="dhb" style="transform-origin:1420px 646px"><path d="M1420 607l-4-5h8z" fill="#ff8a00"/></g><text class="hflag raflag" x="1404" y="634" fill="#ff3b2b" font-size="6" font-weight="700">OFF</text>`})}
${dme('d2',1664,592)}
${plate(1820,566,140,100,5,'rbox')}${lab(1890,578,'GYRO SLAVING',{s:4.8,c:'gp'})}<rect x="1854" y="584" width="72" height="22" rx="3" class="digw"/><g class="slv slv-2" style="transform-origin:1890px 608px"><path d="M1890 608v-20" stroke="#f2f2f2" stroke-width="1.6"/></g><path d="M1858 592h64" stroke="#555" stroke-width=".8"/>
<!-- pilot's left subpanel -->
${lab(325,746,'ENG AUTO IGNITION',{s:4.8,c:'gp'})}${lab(325,828,'ENGINE ANTI-ICE',{s:4.8,c:'gp'})}${lab(325,902,'ACTUATOR',{s:4.6,c:'gp'})}${lab(95,904,'IGNITION AND ENGINE START',{s:4.8,c:'gp'})}
<!-- pilot's right subpanel -->
${lab(730,756,'LIGHTS',{s:5,c:'gp'})}${lab(736,834,'ICE PROTECTION',{s:5,c:'gp'})}${lab(975,756,'LIGHTS',{s:5,c:'gp'})}
${lab(902,754,'LDG GEAR CONTROL',{s:4.6,c:'gp'})}${annGrid(940,820,1,30,10,1,[[['x:gN','NOSE','g']],[['x:gL','L','g']],[['x:gR','R','g']]],null,5)}${lab(955,814,'GEAR DOWN',{s:4,c:'dim'})}
<!-- centre subpanel: caution / advisory annunciators, flap, cabin -->
${annGrid(1026,738,6,47,14,2.2,CAUT,'a')}
${dial('flp',1070,900,38,{sc:[{min:0,max:100,a0:-30,a1:150,maj:20,mnr:20,lab:v=>v===0?'UP':v===40?'40':v===100?'DN':v===20?'20':v===60?'60':v===80?'80':null,fs:0.18,lr:0.62,arcs:[[0,40,'agreen']]}],title:'FLAPS',ty:-0.1,tfs:0.2})}
${dial('cvs',1176,900,40,{sc:[{min:-4000,max:4000,a0:-90-150,a1:-90+150,maj:1000,mnr:500,lab:v=>v%1000===0&&Math.abs(v)<4000?Math.abs(v)/1000:null,fs:0.19}],title:'CABIN CLIMB',unit:'×1000 FT/MIN',ty:0.38,uy:0.56,tfs:0.12})}
${dial('cab',1282,900,40,{sc:[{min:0,max:50000,a0:-150,a1:150,f:v=>clamp(v,0,50000)/50000,maj:5000,mnr:1000,lab:v=>v%10000===0||v===5000?v/1000:null,fs:0.16,arcs:[[12500,50000,'ayellow']],nd:'A'},{min:0,max:7,a0:-60,a1:60,maj:1,mnr:1,nd:'D',nl:28,ncls:'amb',red:[6.6],lab:null}],title:'CABIN ALT ×1000',unit:'DIFF PSI',ty:0.36,uy:0.6,tfs:0.11})}
<!-- copilot's left subpanel -->
${lab(1416,756,'CABIN',{s:5,c:'gp'})}${lab(1600,756,'ENVIRONMENTAL',{s:5,c:'gp'})}${lab(1480,842,'BLEED AIR VALVES',{s:4.8,c:'gp'})}
${dial('pamp',1384,880,28,{sc:[{min:0,max:30,a0:-120,a1:120,maj:10,mnr:5,lab:v=>v,fs:0.22,arcs:[[18,24,'agreen']]}],title:'PROP AMPS',ty:0.5,tfs:0.15})}
<!-- copilot's right subpanel -->
${dial('suct',1856,790,30,{sc:[{min:0,max:10,a0:-130,a1:130,maj:1,mnr:0.5,lab:v=>v%2===0?v:null,fs:0.2,arcs:[[4.3,5.9,'agreen']]}],title:'GYRO\nSUCTION',ty:0.35,tfs:0.13})}
${dial('pneu',1934,790,30,{sc:[{min:0,max:25,a0:-130,a1:130,maj:5,mnr:1,lab:v=>v%10===0||v===20?v:null,fs:0.2,arcs:[[12,20,'agreen']],red:[20]}],title:'PNEUMATIC\nPRESSURE',ty:0.35,tfs:0.12})}
${dial('ctemp',1850,900,26,{sc:[{min:0,max:100,a0:-120,a1:120,maj:20,mnr:10,lab:v=>v%40===0?v:null,fs:0.2}],title:'CABIN AIR',unit:'°F',ty:0.5,uy:0.75,tfs:0.15})}
<rect x="1888" y="884" width="44" height="30" rx="4" class="rbox"/>${lab(1910,894,'FLIGHT',{s:5})}<rect x="1892" y="898" width="36" height="12" rx="1.5" class="digw"/><text class="dig rd-hobbs" x="1910" y="907.5" font-size="7.5" text-anchor="middle">0000.0</text>
${dial('oxy',1956,900,18,{sc:[{min:0,max:2000,a0:-120,a1:120,maj:1000,mnr:500,lab:v=>v/1000,fs:0.3,arcs:[[1550,1850,'agreen']]}],title:'O2',ty:0.55,tfs:0.24})}
<!-- side panels and pedestal -->
<path d="M4 962H366V1300H4Z" fill="url(#gCons)" stroke="#000" stroke-opacity=".6"/>${lab(184,972,'FUEL CONTROL PANEL (LEFT SIDE)',{s:5,c:'gp'})}
${dial('fqL',112,1030,34,{sc:[{min:0,max:1400,a0:-135,a1:135,maj:200,mnr:100,lab:v=>v%400===0?v/100:null,fs:0.2,arcs:[[0,250,'ayellow']]}],title:'FUEL L',unit:'LBS ×100',ty:0.42,uy:0.62,tfs:0.13})}
${dial('fqR',256,1030,34,{sc:[{min:0,max:1400,a0:-135,a1:135,maj:200,mnr:100,lab:v=>v%400===0?v/100:null,fs:0.2,arcs:[[0,250,'ayellow']]}],title:'FUEL R',unit:'LBS ×100',ty:0.42,uy:0.62,tfs:0.13})}
${lamp('x:nxL',86,1078,46,13,'NO TRANSFER','a',4.8)}${lamp('x:nxR',232,1078,46,13,'NO TRANSFER','a',4.8)}
${lab(184,1146,'FUEL SYSTEM CIRCUIT BREAKERS',{s:4.4,c:'dim'})}<path d="M8 1136H362" class="grpl"/>
<rect x="92" y="1258" width="80" height="20" rx="2" class="digw"/><text class="dig rd-oat" x="132" y="1273" font-size="11" text-anchor="middle">OAT</text>${lab(132,1252,'FREE AIR TEMP',{s:4.6,c:'gp'})}
<path d="M1634 962H1996V1300H1634Z" fill="url(#gCons)" stroke="#000" stroke-opacity=".6"/>${lab(1815,972,'RIGHT SIDE CIRCUIT-BREAKER PANEL',{s:5,c:'gp'})}
${(()=>{ let t='', row=0; RCB.forEach(([g,list])=>{ t+=lab(1648,1006+row*44,g,{s:4.2,c:'gp',a:'end'}).replace('text-anchor="end"','text-anchor="end" transform="rotate(-90 1648 '+(1006+row*44)+')"'); row+=Math.ceil(list.length/6); }); return t; })()}
<path d="M744 962H1256L1268 1300H732Z" fill="url(#gCons)" stroke="#000" stroke-opacity=".6"/>
${lab(872,1116,'POWER',{s:5.4,c:'gp'})}${lab(985,1116,'PROPELLER',{s:5.4,c:'gp'})}${lab(1097,1116,'CONDITION',{s:5.4,c:'gp'})}
<path class="trind aitr" d="M1050 1154l-3-5h6z"/>${lab(1030,1174,'L',{s:4.6})}${lab(1070,1174,'R',{s:4.6})}
${plate(780,1200,250,98,4,'rbox')}<rect x="786" y="1203" width="238" height="8" rx="1.5" class="digw"/><text class="dig rd-apm" x="905" y="1209.5" font-size="6" text-anchor="middle"></text>${lab(890,1296,'TURN',{s:4,c:'dim'})}${lab(1010,1296,'DN / UP',{s:4,c:'dim'})}
${plate(1040,1200,208,98,4,'rbox')}${lab(1144,1209,'CABIN PRESSURE CONTROLLER',{s:4.6,c:'gp'})}
${dial('pctl',1092,1252,34,{sc:[{min:-1000,max:10000,a0:-150,a1:150,maj:1000,mnr:500,lab:v=>v%2000===0?v/1000:null,fs:0.18,nond:1}],title:'CABIN ALT\n×1000',ty:0.3,tfs:0.12,extra:`<g class="pctlp" style="transform-origin:1092px 1252px"><path d="M1092 1252L1092 1222" stroke="#ff8a00" stroke-width="2"/></g><rect x="1066" y="1268" width="52" height="11" rx="1.5" class="digw"/><text class="dig rd-cab2" x="1092" y="1276.5" font-size="6.4" text-anchor="middle"></text>`})}
<g class="ctls">${C.map(ctlSVG).join('')}</g>
</svg>`;
}

/* ---------- build ---------- */
function build(stage,io){
  const world=document.createElement('div'); world.className='world'; world.style.width=W+'px'; world.style.height=H+'px';
  world.innerHTML=panelSVG(); stage.appendChild(world);
  const svg=world.querySelector('svg'), byId={};
  svg.querySelectorAll('g.ctl').forEach(g=>{ const c=C.find(k=>k.id===g.dataset.id); byId[c.id]={c,g}; });
  svg.querySelectorAll('.an[data-a]').forEach(e=>{ (ANN[e.dataset.a]=ANN[e.dataset.a]||[]).push(e); });
  requestAnimationFrame(()=>{ const layer=document.createElementNS(NS,'g'); layer.setAttribute('class','hits'); const host=svg.querySelector('g.ctls'); host.insertBefore(layer,host.firstChild);
    const Z=[]; Object.values(byId).forEach(o=>{ try{ const b=o.g.getBBox(); const r=document.createElementNS(NS,'rect'); r.setAttribute('class','hlr');
      const x0=Math.max(1,b.x-4), y0=Math.max(1,b.y-4), x1=Math.min(W-1,b.x+b.width+4), y1=Math.min(H-1,b.y+b.height+4);
      r.setAttribute('x',x0); r.setAttribute('y',y0); r.setAttribute('width',x1-x0); r.setAttribute('height',y1-y0); r.setAttribute('rx',6); o.g.insertBefore(r,o.g.firstChild);
      if(o.c.t==='sbtn') return; const cx=b.x+b.width/2, cy=b.y+b.height/2, hw=Math.max(b.width+8,30)/2, hh=Math.max(b.height+8,30)/2; Z.push({o,cx,cy,x0:cx-hw,x1:cx+hw,y0:cy-hh,y1:Math.min(H-1,cy+hh)}); }catch(e){} });
    for(let a=0;a<Z.length;a++) for(let k=a+1;k<Z.length;k++){ const A=Z[a], B=Z[k]; if(A.x1<=B.x0||B.x1<=A.x0||A.y1<=B.y0||B.y1<=A.y0) continue;
      const dx=B.cx-A.cx, dy=B.cy-A.cy;
      if(Math.abs(dx)>=Math.abs(dy)){ const m=(A.cx+B.cx)/2; if(dx>=0){ A.x1=Math.min(A.x1,m); B.x0=Math.max(B.x0,m); } else { A.x0=Math.max(A.x0,m); B.x1=Math.min(B.x1,m); } }
      else { const m=(A.cy+B.cy)/2; if(dy>=0){ A.y1=Math.min(A.y1,m); B.y0=Math.max(B.y0,m); } else { A.y0=Math.max(A.y0,m); B.y1=Math.min(B.y1,m); } } }
    Z.forEach(z=>{ if(z.x1<=z.x0||z.y1<=z.y0) return; const h=document.createElementNS(NS,'rect'); h.setAttribute('class','hit'); h.dataset.for=z.o.c.id; h.setAttribute('x',z.x0); h.setAttribute('y',z.y0); h.setAttribute('width',z.x1-z.x0); h.setAttribute('height',z.y1-z.y0); layer.appendChild(h); }); });
  bind(world,byId,io);
  return {world,svg,byId,W,H,REG,REG_ORDER,C,CBS};
}

/* ---------- interaction ---------- */
function ctlFromBy(byId,t){ if(!t||!t.closest) return null; const g=t.closest('g.ctl'); if(g) return g; const h=t.closest('.hit'); return h&&byId[h.dataset.for]?byId[h.dataset.for].g:null; }
function levSnap(c,v){ const rng=c.max-c.min; for(const [m] of c.marks||C.find(k=>k.kind===c.kind&&k.marks).marks){ if(Math.abs(v-m)<rng*0.035) return m; } return v; }
const MOM=c=>c.mom||c.t==='push'||c.t==='mbtn'||c.t==='sbtn'||c.t==='bar'||(c.t==='abtn'&&c.momentary);
function bind(world,byId,io){
  const ctlFrom=t=>ctlFromBy(byId,t);
  const svg=world.querySelector('svg'); const pt0=svg.createSVGPoint();
  const toW=e=>{ pt0.x=e.clientX; pt0.y=e.clientY; const p=pt0.matrixTransform(svg.getScreenCTM().inverse()); return {x:p.x,y:p.y}; };
  const inner=(c,pt)=>Math.hypot(pt.x-c.x,pt.y-c.y)<(c.r||14)*0.58;
  const step=(o,d,inn)=>{ const c=o.c, v=io.get(c.id);
    switch(c.t){
      case 'tog': case 'cb': case 'pull': case 'abtn': io.set(c.id,d>0?1:d<0?0:(v?0:1)); return;
      case 'guard': { const gk=c.id+'G'; if(!io.get(gk)){ io.set(gk,1); return; } if(d===0) io.set(c.id,v?0:1); else io.set(c.id,d>0?1:0); return; }
      case 'tog3': io.set(c.id,d? clamp((v||0)-d,-1,1) : (v!==0?0:-1)); return;
      case 'rotsel': io.set(c.id,clamp(v+(d||1),0,c.vals.length-1)); return;
      case 'rot': io.set(c.id,clamp(v+d*0.08,0,1)); return;
      case 'enc': io.set(c.id+':d',d||1); return;
      case 'enc2': io.set(c.id+(inn?':i':':o'),d||1); return;
      case 'gear': io.set(c.id,d>0?0:d<0?1:(v?0:1)); return;
      case 'flap': io.set(c.id,clamp(v-(d||0),0,2)); return;
      case 'vwheel': case 'hwheel': io.set(c.id,clamp(v+d*0.04,-1,1)); return;
      case 'lev': io.set(c.id,levSnap(c,clamp(v+d*(c.max-c.min)*0.04,c.min,c.max))); return;
    } };
  let wacc=0;
  world.addEventListener('wheel',e=>{ const g=ctlFrom(e.target); if(!g) return; const o=byId[g.dataset.id]; if(!['rot','enc','enc2','rotsel','vwheel','hwheel','lev','flap'].includes(o.c.t)) return; e.preventDefault(); e.stopPropagation(); if(e.ctrlKey) return; const raw=(Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:-e.deltaX)*(e.deltaMode?40:1); wacc+=raw; if(Math.abs(wacc)<30) return; const d=wacc<0?1:-1; wacc=0;
    if(o.c.t==='vwheel') return step(o,-d); step(o,d,o.c.t==='enc2'&&(e.shiftKey||inner(o.c,toW(e)))); },{passive:false});
  let drag=null;
  world.addEventListener('pointerdown',e=>{ const g=ctlFrom(e.target); if(!g) return; if(io.intercept&&io.intercept(e,g)) return; const o=byId[g.dataset.id], c=o.c; e.preventDefault(); e.stopPropagation(); g.focus({preventScroll:true});
    const pt=toW(e);
    if(MOM(c)){ io.set(c.id,1); drag={o,mom:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='lev'){ drag={o,lev:1,y:pt.y,v:io.get(c.id),moved:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); return; }
    if(c.t==='vwheel'||c.t==='hwheel'||c.t==='rot'||c.t==='enc'||c.t==='enc2'){ drag={o,x:pt.x,y:pt.y,v:io.get(c.id),acc:0,moved:0,inn:c.t==='enc2'&&inner(c,pt)}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='rotsel'){ const a=Math.atan2(pt.x-c.x,-(pt.y-c.y))*180/Math.PI; const v=io.get(c.id); if(Math.hypot(pt.x-c.x,pt.y-c.y)>15){ let best=0; c.ang.forEach((x,i)=>{ if(Math.abs(x-a)<Math.abs(c.ang[best]-a)) best=i; }); if(best!==v){ io.set(c.id,best); return; } } io.set(c.id,(v+1)%c.vals.length); return; }
    if(c.t==='flap'){ const idx=clamp(Math.round((pt.y-(c.y-30))/30),0,2); io.set(c.id,idx===io.get(c.id)?(idx+1)%3:idx); return; }
    if(c.t==='tog'){ drag={o,tg:1,y:pt.y,done:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='yoke'){ drag={o,stk:1,x:pt.x,y:pt.y}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); io.set('stick',{x:0,y:0}); return; }
    if(c.t==='tog3'){ const v=io.get(c.id); const t=pt.y<c.y-9?-1:pt.y>c.y+9?1:(v!==0?0:-1); io.set(c.id,t===v?0:t); if(c.spring){ drag={o,spr:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} } return; }
    if(c.t==='guard'){ const onGuard=e.target.closest('.gd'); const gk=c.id+'G'; if(onGuard||!io.get(gk)){ io.set(gk,io.get(gk)?0:1); return; } io.set(c.id,io.get(c.id)?0:1); return; }
    step(o,0);
  });
  world.addEventListener('pointermove',e=>{ if(!drag||drag.mom||drag.spr) return; const c=drag.o.c, pt=toW(e);
    if(drag.tg){ const dy=pt.y-drag.y; if(!drag.done&&Math.abs(dy)>6){ drag.done=1; io.set(c.id,dy<0?1:0); } return; }
    if(drag.stk){ io.set('stick',{x:clamp((pt.x-drag.x)/60,-1,1),y:clamp((pt.y-drag.y)/40,-1,1)}); return; }
    if(drag.lev){ const v=clamp(drag.v-(pt.y-drag.y)/c.len*(c.max-c.min),c.min,c.max); drag.moved=1; io.set(c.id,v); return; }
    if(c.t==='vwheel') io.set(c.id,clamp(drag.v+(pt.y-drag.y)/110,-1,1));
    if(c.t==='hwheel') io.set(c.id,clamp(drag.v+(pt.x-drag.x)/90,-1,1));
    if(c.t==='rot') io.set(c.id,clamp(drag.v+(pt.x-drag.x)/60,0,1));
    if(c.t==='enc'||c.t==='enc2'){ const d=(pt.x-drag.x)-(pt.y-drag.y); const n=Math.trunc(d/6)-drag.acc; if(n){ drag.acc+=n; io.set(c.id+(c.t==='enc'?':d':drag.inn?':i':':o'),n); } }
  });
  const end=()=>{ if(!drag) return; const c=drag.o.c; if(drag.tg&&!drag.done) io.set(c.id,io.get(c.id)?0:1); if(drag.stk) io.set('stick',null); if(drag.mom) io.set(c.id,0); if(drag.spr) io.set(c.id,0);
    if(drag.lev) io.set(c.id,levSnap(c,io.get(c.id)));
    if(c.t==='enc'&&!drag.acc) io.set(c.id+':d',1);
    if(c.t==='enc2'&&!drag.acc) io.set(c.id+(drag.inn?':i':':o'),1);
    drag.o.g.classList.remove('drag'); drag=null; };
  world.addEventListener('pointerup',end); world.addEventListener('pointercancel',end);
  const held=new Set();
  world.addEventListener('keydown',e=>{ const g=e.target.closest&&e.target.closest('g.ctl'); if(!g) return; const o=byId[g.dataset.id], c=o.c; const k=e.key;
    let d=null; if(k==='ArrowUp'||k==='ArrowRight') d=1; else if(k==='ArrowDown'||k==='ArrowLeft') d=-1;
    if(MOM(c)&&c.t!=='sbtn'){ if(e.repeat){ e.preventDefault(); return; } if(k===' '||k==='Enter'){ io.set(c.id,1); held.add(c.id); e.preventDefault(); e.stopPropagation(); } return; }
    if(k===' '||k==='Enter'){ step(o,0); e.preventDefault(); e.stopPropagation(); return; }
    if(d!=null){ if(c.t==='vwheel') d=-d; step(o,d,e.shiftKey); e.preventDefault(); e.stopPropagation(); } });
  world.addEventListener('keyup',e=>{ const g=e.target.closest&&e.target.closest('g.ctl'); if(!g) return; const c=byId[g.dataset.id].c; if(held.has(c.id)){ held.delete(c.id); io.set(c.id,0); } });
}

/* ---------- render state ---------- */
const cache={};
function setT(el,t){ if(el&&el._t!==t){ el._t=t; el.style.transform=t; } }
function setTx(el,t){ if(el&&el._x!==t){ el._x=t; el.textContent=t; } }
function sync(P,io){
  for(const id in P.byId){ const {c,g}=P.byId[id]; let v=io.get(id); if(c.t==='guard') v=v+'|'+io.get(id+'G'); if(c.t==='gear') v=v+'|'+io.get('gearLights'); if(c.t==='abtn'||c.t==='mbtn') v=v+'|'+io.get('led:'+id); if(c.t==='lev') v=(+v).toFixed(3); if(c.t==='enc2') v=io.get(id+'O')+'|'+io.get(id+'I')+'|'+io.get('txt:'+id); if(c.t==='enc') v=v+'|'+io.get('txt:'+id);
    if(cache[id]===v) continue; cache[id]=v; const m=g.querySelector('.mv'); const val=io.get(id);
    switch(c.t){
      case 'tog': case 'guard': setT(m,val?'scaleY(1)':'scaleY(-1)'); g.classList.toggle('on',!!val); if(c.t==='guard'){ const go=io.get(id+'G'); setT(g.querySelector('.gd'),go?'translateY(-24px) scaleY(.35)':'none'); g.setAttribute('aria-label',c.l+(go?' (guard open)':' (guard closed)')); } g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?(c.up||'ON'):(c.dn||(c.t==='guard'?(c.id==='altStatic'?'NORMAL':'CLOSED'):'OFF'))); break;
      case 'tog3': g.setAttribute('aria-valuetext',c.vals[val+1]||'CENTRE'); setT(m,val<0?'scaleY(1)':val>0?'scaleY(-1)':'scaleY(.2)'); break;
      case 'rot': setT(m,`rotate(${-135+val*270}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||Math.round(val*100)+' %')); break;
      case 'enc': setT(m,`rotate(${(val*(c.deg||7))%360}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||val)); break;
      case 'enc2': setT(m,`rotate(${((io.get(id+'O')||0)*11)%360}deg)`); setT(g.querySelector('.mvi'),`rotate(${((io.get(id+'I')||0)*11)%360}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||'')); break;
      case 'rotsel': setT(m,`rotate(${c.ang[val]}deg)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'push': case 'bar': case 'sbtn': g.classList.toggle('on',!!val); break;
      case 'mbtn': case 'abtn': g.classList.toggle('on',!!val); g.classList.toggle('led',!!io.get('led:'+id)); if(c.t==='abtn'&&!c.momentary) g.setAttribute('aria-valuetext',val?'ON':'OFF'); break;
      case 'gear': { setT(m,val?'translateY(56px)':'none'); const L=io.get('gearLights'); g.querySelectorAll('.gl').forEach(x=>x.classList.remove('g','r')); if(L==='transit'||L==='warn'||L==='test') g.querySelector('.gU').classList.add('r'); g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?'DOWN':'UP'); break; }
      case 'flap': setT(m,`translateY(${val*30}px)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'cb': g.classList.toggle('out',!val); g.setAttribute('aria-valuetext',val?'IN':'PULLED'); g.setAttribute('aria-pressed',val?'false':'true'); break;
      case 'pull': g.setAttribute('aria-valuetext',val?'PULLED':'IN'); g.setAttribute('aria-pressed',val?'true':'false'); setT(m,val?'scale(1.25)':'none'); g.classList.toggle('on',!!val); break;
      case 'vwheel': setT(m,`translateY(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateY(${-val*50}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'hwheel': setT(m,`translateX(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateX(${val*36}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'lev': { const y=(c.max-val)/(c.max-c.min)*c.len; setT(m,`translateY(${y.toFixed(1)}px)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||val)); break; }
    }
  }
}
function syncYokes(P,x,y){ const t=`translateY(${(y*14).toFixed(1)}px) rotate(${(x*38).toFixed(1)}deg)`; ['yokeL','yokeR','apDisc','trimUp','trimDn'].forEach(id=>{ const o=P.byId[id]; if(!o) return; setT(o.g.querySelector('.skg')||o.g.querySelector('.sbm'),t); }); }
/* gauges */
function needle(P,id,v,k){ const g=GA[id]; if(!g) return; const sc=g.sc.find(s=>(s.nd||'')===(k||''))||g.sc[0]; const a=angOf(sc,v); const el=P.q['nd-'+id+(k||'')]||(P.q['nd-'+id+(k||'')]=P.svg.querySelector('.nd-'+id+(k||''))); if(el){ const t=`rotate(${a.toFixed(1)}deg)`; setT(el,t); } }
function text(P,cls,t){ const el=P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls)); setTx(el,t); }
function rot(P,cls,deg,extra){ const el=P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls)); setT(el,`rotate(${deg.toFixed(1)}deg)${extra||''}`); }
function tr(P,cls,t){ const el=P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls)); setT(el,t); }
function vis(P,cls,on){ const el=P.q[cls]||(P.q[cls]=P.svg.querySelector('.'+cls)); if(el&&el._v!==on){ el._v=on; el.style.opacity=on?1:0; } }
function ann(P,lit,test,blink){ for(const k in ANN){ const t=test&&!k.startsWith('x:'); const on=t||!!lit[k]; const fl=!t&&lit[k]==='blink'; ANN[k].forEach(e=>{ const s=on?(fl?(blink?'on':'off'):'on'):'off'; if(e._s!==s){ e._s=s; e.classList.toggle('on',s==='on'); } }); } }
function flight(P,o,sfx){ sfx=sfx||'';
  needle(P,'asi'+sfx,o.ias); needle(P,'alt'+sfx,((o.alt%1000)+1000)%1000,'0'); needle(P,'alt'+sfx,((o.alt%10000)+10000)%10000,'1'); needle(P,'alt'+sfx,Math.max(0,o.alt),'2');
  text(P,'kol-alt'+sfx,String(Math.round(o.baro)));
  const id='adi'+sfx, rr=sfx?66:74; rot(P,'att-'+id,-o.roll); tr(P,'attp-'+id,`translateY(${clamp(o.pitch,-30,30)*rr*0.04}px)`);
  tr(P,'ball-'+id,`translateX(${(clamp(o.slip,-1,1)*rr*0.22).toFixed(1)}px)`);
}
G.B200P={ctlFrom:(P,t)=>ctlFromBy(P.byId,t),build:(s,io)=>{ const P=build(s,io); P.q={}; return P; },sync,syncYokes,needle,text,rot,tr,vis,ann,flight,REG,REG_ORDER,W,H,WARN,CAUT,CBS};
})(window);
