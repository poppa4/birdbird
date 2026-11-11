/* Birdbird – King Air B200 panel drawn in SVG (world units 2000×1640).
   Own drawing: positions and proportions follow the reference instrument-panel layout for the
   type (EFIS pilot side, analog copilot side, centre radar/multifunction display); no images or
   artwork from any manual are used. No manufacturer or operator marks.
   Interaction framework shared with da42panel.js. Controls report through io.get/io.set. */
(function(G){
'use strict';
const W=2000, H=1780, NS='http://www.w3.org/2000/svg';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* reference-photo coordinates (1290 × 1007 px frame) → world units. The main panel is laid out by measuring
   every instrument and switch in that frame; DY moves the side consoles and pedestal (below the frame) down. */
const SKY=250, LIP=285; // 2D: windshield headroom above y=0 with the outside view on; glareshield top in front of the left seat
const PK=1.625, PX=x=>+(20+(x-50)*PK).toFixed(1), PY=y=>+(236+(y-30)*PK).toFixed(1), DY=140;
const PR=(x0,y0,x1,y1)=>[PX(x0),PY(y0),+((x1-x0)*PK).toFixed(1),+((y1-y0)*PK).toFixed(1)];
const pp=pts=>pts.map(([x,y])=>[PX(x),PY(y)]);

/* ---------- regions for zoom ---------- */
const sh=(r,d)=>[r[0],r[1]+d,r[2],r[3]];
const REG={
  overview:[0,0,2000,H],
  overheadL:[818,0,358,144], overheadR:[814,138,366,104],
  glare:PR(375,18,840,142),
  flightT:PR(45,88,425,300), flightB:PR(45,292,425,470),
  engT:PR(400,140,545,300), engB:PR(380,292,548,500),
  apfd:PR(533,138,875,266), centreM:PR(535,262,872,356),
  radio1:PR(528,346,702,494), mfd:PR(698,346,875,488),
  copilotT:PR(866,80,1262,302), copilotB:PR(862,284,1262,468),
  lower:PR(48,458,336,652), rsub:PR(318,462,560,652), center:PR(540,486,752,664), cosubL:PR(740,458,1002,652), cosubR:PR(990,452,1264,652),
  fuelT:sh([4,1106,524,160],DY), fuelB:sh([4,1262,500,218],DY),
  pedT:sh([688,1106,624,212],DY), pedB:sh([664,1290,660,160],DY), audio:sh([740,1440,520,200],DY),
  rsideT:sh([1522,1106,476,190],DY), rsideB:[1522,1430,476,H-1430],
  /* EFIS focus views (EADI over EHSI of one side); not in REG_ORDER, so a click never picks them as a cluster */
  efisL:PR(184,192,348,470), efisR:PR(954,177,1099,463)
};
/* display faces (EADI, EHSI) of each EFIS focus view: a click on one opens that view */
const EFISF={efisL:[PR(190,198,330,329),PR(209,332,342,464)],efisR:[PR(969,183,1093,320),PR(960,322,1092,457)]};
const REG_ORDER=['fuelT','fuelB','rsideT','rsideB','audio','pedT','pedB','lower','rsub','center','cosubL','cosubR','overheadL','overheadR','glare','engT','engB','apfd','centreM','radio1','mfd','flightT','flightB','copilotT','copilotB'];

/* ---------- layout: every control ---------- */
const C=[]; const add=o=>{ C.push(o); return o; };
/* overhead light control panel (upper) and meter panel (lower) */
add({id:'mpl',t:'tog',rk:1,x:867.9,y:89.3,l:'MASTER PANEL LIGHTS',d:'',up:'',dn:''});
add({id:'wiper',t:'rotsel',x:898.8,y:50.4,r:9,l:'WINDSHIELD WIPERS',d:'',vals:['PARK','OFF','SLOW','FAST'],ang:[-62,0,62,110],s:2.6,big:1});
[['dimFlood','OVERHEAD FLOOD LIGHTS','OVERHEAD\nFLOOD\nLIGHTS',1019.4,46.8],['dimInd','INSTRUMENT INDIRECT LIGHTS','INSTRUMENT\nINDIRECT\nLIGHTS',1049.3,46.8],['dimPF','PILOT FLIGHT LIGHTS','PILOT\nFLIGHT\nLIGHTS',899.2,88.2],['dimEng','ENGINE INSTRUMENT LIGHTS','ENGINE\nINSTRUMENT\nLIGHTS',962.2,88.2],['dimAv','AVIONICS PANEL LIGHTS','AVIONICS\nPANEL\nLIGHTS',1019.4,88.2],['dimCons','OVERHEAD, SUBPANEL AND CONSOLE LIGHTS','OVERHEAD\nSUB PANEL\n& CONSOLE\nLIGHTS',1049.3,88.2],['dimSide','SIDE PANEL LIGHTS','SIDE\nPANEL\nLIGHTS',1078.8,88.2],['dimCG','COPILOT GYRO INSTRUMENT LIGHTS','COPILOT GYRO\nINSTRUMENT\nLIGHTS',1109.1,88.2],['dimCF','COPILOT FLIGHT LIGHTS','COPILOT\nFLIGHT\nLIGHTS',1138.6,88.2]]
  .forEach(([id,l,d,x,y])=>add({id,t:'rot',x,y,r:9.5,l,d:'',top:d,bo:1,s:2.5,ptr:1}));
[['vLoadL','L LOADMETER – PUSH FOR VOLTS',844.1],['vLoadR','R LOADMETER – PUSH FOR VOLTS',898.1],['vBatt','BATTERY AMMETER – PUSH FOR VOLTS',952.1],['vAC','AC FREQUENCY METER – PUSH FOR VOLTS',1006.5]]
  .forEach(([id,l,x])=>add({id,t:'push',x,y:190.8,r:2.8,l,d:''}));
/* glareshield */
add({id:'mwL',t:'mbtn',x:300,y:336,w:36,h:22,l1:'MASTER',l2:'WARNING',col:'r',sub:'PRESS TO RESET',l:'MASTER WARNING (L)'});
add({id:'mcL',t:'mbtn',x:354,y:336,w:36,h:22,l1:'MASTER',l2:'CAUTION',col:'a',sub:'PRESS TO RESET',l:'MASTER CAUTION (L)'});
add({id:'fireL',t:'mbtn',x:875,y:313,w:46,h:15,l1:'L ENG FIRE',l2:'PUSH TO EXT',col:'r',l:'L ENGINE FIRE – PUSH TO EXTINGUISH'});
add({id:'annTest',t:'push',x:1158,y:262,r:7,l:'ANNUNCIATOR TEST',d:'',s:4});
add({id:'fireR',t:'mbtn',x:1125,y:313,w:46,h:15,l1:'R ENG FIRE',l2:'PUSH TO EXT',col:'r',l:'R ENGINE FIRE – PUSH TO EXTINGUISH'});
add({id:'mcR',t:'mbtn',x:1646,y:336,w:36,h:22,l1:'MASTER',l2:'CAUTION',col:'a',sub:'PRESS TO RESET',l:'MASTER CAUTION (R)'});
add({id:'mwR',t:'mbtn',x:1700,y:336,w:36,h:22,l1:'MASTER',l2:'WARNING',col:'r',sub:'PRESS TO RESET',l:'MASTER WARNING (R)'});
/* pilot flight panel */
add({id:'gpsCrs',t:'lbtn',x:326,y:419,w:29,h:24,l1:'GPS  CRS',a:'OBS',b:'LEG',ca:'o',cb:'g',l:'GPS COURSE (OBS / LEG)'});
add({id:'gpsApr',t:'lbtn',x:360,y:419,w:29,h:24,l1:'GPS  APR',a:'ARM',b:'ACTV',ca:'w',cb:'g',l:'GPS APPROACH (ARM / ACTV)'});
add({id:'gpwsT',t:'mbtn',x:50,y:447,w:26,h:25,l1:'GPWS',l2:'P/TEST',col:'r',l:'GPWS – PUSH TO TEST'});
add({id:'bgsC',t:'mbtn',x:86,y:447,w:26,h:25,l1:'BELOW G/S',l2:'P/CANCEL',col:'a',l:'BELOW GLIDESLOPE – PUSH TO CANCEL'});
add({id:'slewL',t:'key',x:93,y:803,w:14,h:8,l:'◄',lbl:'GYRO SLAVING – SLEW LEFT'});
add({id:'slewR',t:'key',x:112,y:803,w:14,h:8,l:'►',lbl:'GYRO SLAVING – SLEW RIGHT'});
add({id:'gyroMode',t:'key',x:132,y:803,w:14,h:8,l:'DG',alt:1,led:1,lbl:'GYRO SLAVING MODE (SLAVED / DG FREE)'});
add({id:'efisAux',t:'tog3',x:46,y:503,l:'EFIS AUX POWER (ON / OFF / TEST)',d:'',vals:['ON','OFF','TEST'],sm3:1});
add({id:'efisHorn',t:'push',x:90,y:501,r:5.5,red:1,l:'EFIS AUX POWER – HORN SILENCE',d:''});
add({id:'dmeCh',t:'key',x:192,y:769,w:15,h:8,l:'CH',lbl:'DME (PILOT) – CHANNEL 1 / 2 / 3'});
add({id:'dmeSel',t:'key',x:221,y:769,w:15,h:8,l:'SEL',lbl:'DME (PILOT) – SELECT KT / MIN / ID'});
add({id:'dmePwr',t:'key',x:250,y:769,w:15,h:8,l:'PWR',alt:1,led:1,lbl:'DME (PILOT) – POWER'});
add({id:'fastErect',t:'push',x:212,y:806,r:9,red:1,l:'ATTITUDE GYRO FAST ERECT',d:''});
add({id:'micSel',t:'tog',x:380,y:604,l:'PILOT MIC – NORMAL / OXYGEN MASK',d:'',up:'',dn:'',blk:1});
add({id:'altT',t:'push',x:508,y:548,r:4,l:'ALTIMETER TEST',d:''});
add({id:'baroK',t:'enc',x:596,y:548,r:8,l:'BARO (PULL)',d:''});
add({id:'tcasAB',t:'push',x:510,y:704,r:5.5,l:'TCAS ABOVE / BELOW (A/B)',d:''});
add({id:'tcasR',t:'push',x:594,y:704,r:5.5,l:'TCAS RANGE (R)',d:''});
add({id:'gpwsFlap',t:'key',x:492,y:419,w:28,h:24,lamp:'b',l1:'GPWS',l2:'FLAP',l3:'OVRD',alt:1,led:1,lbl:'GPWS FLAP OVERRIDE'});
add({id:'fcRst',t:'push',x:556,y:793,r:3.4,l:'FUEL CONSUMED RESET',d:'',s:3.4,dark:1});
add({id:'sync',t:'tog',x:534,y:858,dk:1,l:'PROP SYNC',d:'',xs:1,up:'',dn:'OFF'});
/* audio control panel */
const AUD=[['COMM 1','1'],['COMM 2','2'],['NAV 1','1'],['NAV 2','2'],['MKR BCN 1','1'],['MKR BCN 2','2'],['DME 1','1'],['DME 2','2'],['ADF','']];
const AUDX={P:[920,939,957.5,977.5,997.5,1017.5,1037.5,1056,1076],C:[1148.5,1167.5,1187.5,1207.5,1226,1245,1265,1284,1304]};
['P','C'].forEach(sd=>{ const nm=sd==='C'?'COPILOT':'PILOT';
  AUD.forEach(([n,u],i)=>add({id:'au'+sd+i,t:'tog',x:AUDX[sd][i],y:424,l:nm+' AUDIO '+n,d:'',up:u,xs:1,noup:i===8}));
  add({id:'autoComm'+sd,t:'tog',x:sd==='P'?897:1327,y:424,l:nm+' AUTO COMM',d:'',up:'AUTO\nCOMM',dn:'OFF',xs:1});
});
add({id:'micP',t:'rotsel',x:924,y:484,l:'PILOT MICROPHONE SELECTOR',d:'',vals:['COMM 1','COMM 2','CABIN'],ang:[-82,0,82],s:4.2,big:1});
add({id:'volP',t:'rot',x:957,y:466,r:5.5,l:'PILOT MASTER VOLUME',d:'VOL',s:3.6});
add({id:'spkrP',t:'tog',x:979,y:480,l:'PILOT AUDIO SPEAKER',d:'',up:'AUDIO\nSPKR',dn:'OFF',xs:1});
add({id:'audEmer',t:'tog',x:1009,y:480,l:'AUDIO AMPS BYPASS (EMER / NORM)',d:'',up:'AUDIO\nEMER',dn:'NORM',xs:1,blk:1});
add({id:'voiceP',t:'tog3',x:1037,y:480,l:'PILOT NAV/ADF FILTER (VOICE / BOTH / RANGE)',d:'',vals:['VOICE','BOTH','RANGE'],sm3:1,lay:'vbr'});
add({id:'pageVol',t:'rot',x:1076,y:468,r:9,l:'PASSENGER ADDRESS (PAGING) VOLUME',d:'',top:'PAGING',vol:1});
add({id:'gndComm',t:'key',x:1111,y:470,w:26,h:26,lamp:'g',l1:'GND',l2:'COMM',l3:'PWR',alt:1,led:1,lbl:'GROUND COMM POWER (PUSH ON / OFF)'});
add({id:'intphVol',t:'rot',x:1151,y:468,r:9,l:'INTERPHONE VOLUME',d:'',top:'INTPH',vol:1});
add({id:'voiceC',t:'tog3',x:1189,y:480,l:'COPILOT NAV/ADF FILTER (VOICE / BOTH / RANGE)',d:'',vals:['VOICE','BOTH','RANGE'],sm3:1,lay:'vbr'});
add({id:'hotIntph',t:'tog',x:1219,y:480,l:'HOT INTERPHONE',d:'',up:'HOT\nINTPH',dn:'OFF',xs:1});
add({id:'spkrC',t:'tog',x:1248,y:480,l:'COPILOT AUDIO SPEAKER',d:'',up:'AUDIO\nSPKR',dn:'OFF',xs:1});
add({id:'volC',t:'rot',x:1270,y:466,r:5.5,l:'COPILOT MASTER VOLUME',d:'VOL',s:3.6});
add({id:'micC',t:'rotsel',x:1302,y:484,l:'COPILOT MICROPHONE SELECTOR',d:'',vals:['COMM 1','COMM 2','CABIN'],ang:[-82,0,82],s:4.2,big:1});
add({id:'sideP',t:'rot',x:906,y:514,r:3.6,l:'PILOT SIDETONE VOLUME',d:'',top:'SIDE-\nTONE',s:3.6});
add({id:'sensP',t:'rot',x:935,y:514,r:3.6,l:'PILOT INTERPHONE THRESHOLD',d:'',top:'INTPH\nSENS',s:3.6});
add({id:'dmeV1',t:'rot',x:988,y:512,r:8.5,l:'DME 1 VOLUME',d:'',vol:1});
add({id:'dmeV2',t:'rot',x:1026,y:512,r:8.5,l:'DME 2 VOLUME',d:'',vol:1});
add({id:'encAlt',t:'tog',x:1007,y:552,l:'ENCODING ALTIMETER SELECT (1 / 2)',d:'',up:'1',dn:'2',xs:1});
add({id:'altAck',t:'key',x:1229,y:577,w:24,h:22,lamp:'a',l1:'ALT',l2:'ALERT',lbl:'ALTITUDE ALERT – PUSH TO CANCEL'});
add({id:'altSel',t:'enc',x:1334,y:590,r:8,l:'ALTITUDE SET (PUSH 100)',d:''});
add({id:'mkrHi',t:'tog',x:1198,y:525,l:'MARKER BEACON SENSITIVITY (HI / LO)',d:'',up:'HI',dn:'LO',xs:1});
add({id:'mkrVol',t:'rot',x:1239,y:512,r:8.5,l:'MARKER BEACON VOLUME',d:'',vol:1});
add({id:'annBrt',t:'rot',x:1218,y:547,r:9,l:'ANNUNCIATOR DIMMING (ANN PUSH BRT)',d:'',top:'ANN\nPUSH BRT',txt:'DIM'});
add({id:'sideC',t:'rot',x:1284,y:514,r:3.6,l:'COPILOT SIDETONE VOLUME',d:'',top:'SIDE-\nTONE',s:3.6});
add({id:'sensC',t:'rot',x:1313,y:514,r:3.6,l:'COPILOT INTERPHONE THRESHOLD',d:'',top:'INTPH\nSENS',s:3.6});
/* radios. COMM 1 / NAV 1 are tuned on the navigator (left centre screen); COMM 2, NAV 2 and ADF on the
   radio tuning strip under the course/heading panel; the transponder control head sits on the copilot's panel. */
const RAD=[['com1','COMM 1','COM',0,0,['OFF','ON','SQ OFF']],['nav1','NAV 1','VLOC',0,0,['OFF','ON','HLD']],
  ['com2','COMM 2','COMM 2',822,614,['OFF','ON','SQ OFF']],['nav2','NAV 2','NAV 2',1001,614,['OFF','ON','HLD']],['adf','ADF','ADF',1180,614,['OFF','ANT','ADF','TONE']],
  ['xpdr','TRANSPONDER','ATC',1368,716,['OFF','STBY','ON','ALT']]];
/* navigator bezel positions for COMM 1 / NAV 1 */
const NVX={com1:{Md:[845,707],Vol:[860,731],T:[831,731],Sto:[831,749],Act:[860,749],X:[845,774],K:[846,856]},nav1:{Md:[845,796],Vol:[860,818],T:[831,818],Sto:[831,832],Act:[901,860],X:[1057,826],K:[878,856]}};
RAD.forEach(([k,n,tag,x0,y0,vals])=>{
  const four=vals.length===4, nv=NVX[k];
  if(nv){
    add({id:k+'Md',t:'rotsel',x:nv.Md[0],y:nv.Md[1],l:n+' POWER / MODE',d:'',vals,ang:[-80,-32,16],s:3.2,r:7.5,rad:1});
    add({id:k+'Vol',t:'rot',x:nv.Vol[0],y:nv.Vol[1],r:3.6,l:n+' VOLUME',d:'',s:3.4});
    add({id:k+'Sto',t:'push',x:nv.Sto[0],y:nv.Sto[1],r:3.4,l:n+' STORE (STO, PUSH TWICE)',d:'',s:3.4,dark:1});
    add({id:k+'T',t:'push',x:nv.T[0],y:nv.T[1],r:3.4,l:n+' TEST',d:'',s:3.4,dark:1});
    add({id:k+'Act',t:'abtn',x:nv.Act[0],y:nv.Act[1],l:'ACT',sm:1,lbl:n+' ACTIVE (DIRECT) TUNE'});
    add({id:k+'X',t:'tog3',x:nv.X[0],y:nv.X[1],l:n+' TRANSFER / MEMORY (XFR / MEM)',d:'',vals:['XFR','','MEM'],spring:1,sm3:1,dark:1,lay:'none'});
    add({id:k+'K',t:'enc2',x:nv.K[0],y:nv.K[1],r:k==='com1'?13:11,l:n+' FREQUENCY',d:''});
    return;
  }
  if(k==='xpdr'){
    add({id:k+'Md',t:'rotsel',x:x0+24,y:y0+80,l:n+' POWER / MODE',d:'',vals,ang:[-112,-62,-12,38],s:4,r:9,rad:1});
    add({id:'xpdr12',t:'tog',x:x0+84,y:y0+32,l:'TRANSPONDER 1 / 2 SELECT',d:'',up:'1',dn:'2',xs:1,dark:1});
    add({id:'xpdrId',t:'abtn',x:x0+50,y:y0+72,l:'IDENT',sm:1,momentary:1,lbl:'TRANSPONDER IDENT'});
    add({id:'xpdrT',t:'push',x:x0+46,y:y0+90,r:3.4,l:'TRANSPONDER TEST',d:'TEST',s:3.8,dark:1});
    add({id:'xpdrPre',t:'push',x:x0+72,y:y0+98,r:3.4,l:'TRANSPONDER PRESET CODE (PRE)',d:'PRE',s:3.8,side:1,dark:1});
    add({id:k+'K',t:'enc2',x:x0+73,y:y0+77,r:12,l:n+' CODE',d:''});
    return;
  }
  /* tuning strip head, 172 × 64 */
  add({id:k+'Md',t:'rotsel',x:x0+106,y:y0+20,l:n+' POWER / MODE',d:'',vals,ang:four?[-112,-62,-12,38]:[-80,-32,16],s:3.2,r:8,rad:1});
  add({id:k+'Vol',t:'rot',x:x0+106,y:y0+50,r:3.6,l:n+' VOLUME',d:'',s:3.4});
  add({id:k+'Sto',t:'push',x:x0+43,y:y0+55,r:3.4,l:n+' STORE (STO, PUSH TWICE)',d:'',s:3.4,dark:1});
  add({id:k+'T',t:'push',x:x0+66,y:y0+55,r:3.4,l:n+' TEST',d:'',s:3.4,dark:1});
  add({id:k+'Act',t:'abtn',x:x0+18,y:y0+55,l:'ACT',sm:1,lbl:n+' ACTIVE (DIRECT) TUNE'});
  add({id:k+'X',t:'tog3',x:x0+128,y:y0+32,l:n+' TRANSFER / MEMORY (XFR / MEM)',d:'',vals:['XFR','','MEM'],spring:1,sm3:1,dark:1,lay:'none'});
  add({id:k+'K',t:'enc2',x:x0+152,y:y0+32,r:13,l:n+' FREQUENCY',d:''});
});
/* centre multifunction / weather radar display */
add({id:'mfdPwr',t:'key',x:1012,y:587,w:9,h:9,round:1,alt:1,led:1,l:'',lbl:'DISPLAY POWER (PWR)'});
[['mfdRdr','RDR','RADAR MODE (OFF / STBY / TEST / WX)'],['mfdNav','NAV','NAV OVERLAY'],['mfdRmt','RMT','RADIO (REMOTE) PAGE'],['mfdPge','PGE','PAGE SELECT'],['mfdEmg','EMG','EMERGENCY CHECKLIST']]
  .forEach(([id,l,lbl],i)=>add({id,t:'key',x:1009,y:615+i*19,w:15,h:14,l,lbl,kw:1}));
[1,2,3,4].forEach(i=>add({id:'mfdL'+i,t:'key',x:1219,y:592+i*22,w:17,h:9,l:'◄',lbl:'DISPLAY LINE KEY '+i,kw:1}));
[['mfdUp','▲','RANGE UP'],['mfdDn','▼','RANGE DOWN'],['mfdRcl','RCL','RECALL'],['mfdSkp','SKP','SKIP'],['mfdClr','CLR','CLEAR']]
  .forEach(([id,l,lbl],i)=>add({id,t:'key',x:1068+i*23.3,y:737,w:15,h:14,l,lbl:'DISPLAY '+lbl,kw:1}));
add({id:'mfdData',t:'rot',x:1013,y:727,r:8,l:'DISPLAY BRIGHTNESS (DATA)',d:''});
add({id:'mfdTilt',t:'enc',x:1214,y:727,r:9,l:'RADAR ANTENNA TILT',d:''});
/* navigator: GPS keys and knobs (right bezel and bottom row) */
add({id:'gpsPwr',t:'push',x:1057,y:701,r:4.2,l:'GPS POWER (PUSH ON)',d:''});
[['gpsCrsrL','CRSR','GPS LEFT CURSOR',719],['gpsDto','D→','GPS DIRECT-TO',740],['gpsMsg','MSG','GPS MSG',758],['gpsClr','CLR','GPS CLR',776],['gpsEnt','ENT','GPS ENT',794],['gpsCrsrR','CRSR','GPS RIGHT CURSOR',848]]
  .forEach(([id,l,lbl,y])=>add({id,t:'key',x:1057,y,w:18,h:10,l,lbl,kw:1}));
add({id:'gpsAlt',t:'key',x:1000,y:860,w:16,h:9,l:'ALT',lbl:'GPS ALT',kw:1});
add({id:'gpsKL',t:'enc',x:1029,y:859,r:8,l:'GPS LEFT PAGE KNOB (NAV / FPL / MODE / TRIP)',d:''});
add({id:'gpsKR',t:'enc',x:1061,y:861,r:9,l:'GPS RIGHT PAGE KNOB (APT / VOR / NDB / INT / SUPL)',d:''});
/* copilot flight panel */
add({id:'baro2K',t:'enc',x:1850,y:548,r:7,l:'BARO 2',d:''});
add({id:'gpwsT2',t:'mbtn',x:1892,y:447,w:26,h:25,l1:'GPWS',l2:'P/TEST',col:'r',l:'GPWS (COPILOT) – PUSH TO TEST'});
add({id:'bgsC2',t:'mbtn',x:1928,y:447,w:26,h:25,l1:'BELOW G/S',l2:'P/CANCEL',col:'a',l:'BELOW GLIDESLOPE (COPILOT) – PUSH TO CANCEL'});
add({id:'crs2K',t:'enc',x:1148,y:576,r:12,l:'CRS 2',d:''});
add({id:'tcasAB2',t:'push',x:1764,y:704,r:5.5,l:'TCAS ABOVE / BELOW (COPILOT)',d:''});
add({id:'tcasR2',t:'push',x:1848,y:704,r:5.5,l:'TCAS RANGE (COPILOT)',d:''});
add({id:'fastErect2',t:'push',x:1600,y:604,r:4,l:'COPILOT ATTITUDE GYRO FAST ERECT',d:''});
add({id:'dhK',t:'rot',x:1648,y:604,r:5,l:'PILOT EADI – DH SET',d:''});
add({id:'raT',t:'push',x:1648,y:624,r:3,l:'PILOT EADI – TEST (RADIO ALTIMETER / DH)',d:''});
add({id:'dhK2',t:'rot',x:1648,y:644,r:5,l:'COPILOT EADI – DH SET',d:''});
add({id:'raT2',t:'push',x:1648,y:664,r:3,l:'COPILOT EADI – TEST (RADIO ALTIMETER / DH)',d:''});
add({id:'dme2Ch',t:'key',x:1773,y:773,w:15,h:8,l:'CH',lbl:'DME (COPILOT) – CHANNEL 1 / 2 / 3'});
add({id:'dme2Sel',t:'key',x:1806,y:773,w:15,h:8,l:'SEL',lbl:'DME (COPILOT) – SELECT KT / MIN / ID'});
add({id:'dme2Pwr',t:'key',x:1839,y:773,w:15,h:8,l:'PWR',alt:1,led:1,lbl:'DME (COPILOT) – POWER'});
add({id:'slew2L',t:'key',x:1891,y:808,w:14,h:8,l:'◄',lbl:'GYRO SLAVING 2 – SLEW LEFT'});
add({id:'slew2R',t:'key',x:1910,y:808,w:14,h:8,l:'►',lbl:'GYRO SLAVING 2 – SLEW RIGHT'});
add({id:'gyro2Mode',t:'key',x:1930,y:808,w:14,h:8,l:'DG',alt:1,led:1,lbl:'GYRO SLAVING 2 MODE (SLAVED / DG FREE)'});
/* pilot's left subpanel */
add({id:'extPwr',t:'tog3',x:119,y:858,l:'EXTERNAL POWER (ON / OFF / RESET)',d:'',vals:['ON','OFF','RESET'],spring:'dn',lay:'none',red:1});
add({id:'avio',t:'tog',x:161,y:858,l:'AVIONICS MASTER POWER',d:'',up:'AVIONICS\nMASTER PWR',dn:'OFF',red:1});
add({id:'inv',t:'tog3',x:233,y:864,l:'INVERTER',d:'',vals:['NO 1','OFF','NO 2'],lay:'inv'});
add({id:'aignL',t:'tog',x:277,y:860,l:'ENG AUTO IGNITION LEFT',d:'',up:'',dn:'LEFT',sm:1});
add({id:'aignR',t:'tog',x:334,y:860,l:'ENG AUTO IGNITION RIGHT',d:'',up:'',dn:'RIGHT',sm:1});
add({id:'bat',t:'tog',x:80,y:930,l:'BATTERY',d:'',up:'',dn:'BATT',sm:1});
add({id:'genL',t:'tog3',x:141,y:930,l:'GEN 1 (LEFT)',d:'',vals:['RESET','ON','OFF'],lay:'none',dn:'GEN 1'});
add({id:'genR',t:'tog3',x:205,y:930,l:'GEN 2 (RIGHT)',d:'',vals:['RESET','ON','OFF'],lay:'none',dn:'GEN 2'});
add({id:'gang',t:'bar',x:144,y:904,w:160,h:22,l:'MASTER SWITCH (GANG BAR) – ALL OFF',d:'MASTER SWITCH'});

add({id:'busSense',t:'tog3',x:268,y:924,l:'BUS SENSE (RESET / TEST, spring-loaded to centre)',d:'',vals:['RESET','','TEST'],spring:1,lay:'none',red:1});
add({id:'genTies',t:'tog3',x:320,y:924,l:'GEN TIES (MAN CLOSE / NORM / OPEN)',d:'',vals:['MAN CLOSE','NORM','OPEN'],spring:'up',lay:'none'});
add({id:'pilotAir',t:'pull',x:361,y:966,r:15,l:'PILOT AIR (PULL ON)',d:'',top:'PILOT\nAIR',dn:'PULL\nON'});
add({id:'ignL',t:'tog3',x:115,y:1027,l:'IGNITION AND ENGINE START LEFT',d:'',vals:['ON','OFF','STARTER ONLY'],lay:'none',big:1});
add({id:'ignR',t:'tog3',x:160,y:1027,l:'IGNITION AND ENGINE START RIGHT',d:'',vals:['ON','OFF','STARTER ONLY'],lay:'none',big:1});
add({id:'afSw',t:'tog3',x:256,y:1029,l:'AUTOFEATHER',d:'',vals:['ARM','OFF','TEST'],lay:'left',ring:1});
add({id:'govT',t:'tog',x:307,y:1030,l:'PROP TEST – GOV (OVERSPEED GOVERNOR TEST, HOLD)',d:'',sm:1,up:'',dn:'',red:1,mom:1});
add({id:'gndIdle',t:'tog',x:330,y:1030,l:'PROP TEST – GND IDLE STOP (HOLD)',d:'',sm:1,up:'',dn:'',red:1,mom:1});
add({id:'park',t:'pull',x:118,y:1090,r:9,l:'PARKING BRAKE',d:'',tee:1});
/* pilot's right subpanel */
add({id:'defrost',t:'pull',x:466,y:966,r:15,l:'DEFROST AIR (PULL ON)',d:'',top:'DEFROST\nAIR',dn:'PULL\nON'});
[['landL','LANDING LIGHT LEFT','LEFT',501],['landR','LANDING LIGHT RIGHT','RIGHT',531],['taxi','TAXI LIGHT','',560],['iceLt','WING ICE LIGHT','',589],['navLt','NAV LIGHTS','',618],['recog','RECOGNITION LIGHTS','',648]]
  .forEach(([id,l,dn,x])=>add({id,t:'tog',x,y:922,l,d:'',xs:1,up:dn}));
add({id:'wsP',t:'tog3',x:509,y:979,l:'WINDSHIELD ANTI-ICE PILOT',d:'',vals:['NORMAL','OFF','HI'],lay:'none',dn:'PILOT',big:1});
add({id:'wsC',t:'tog3',x:538,y:979,l:'WINDSHIELD ANTI-ICE COPILOT',d:'',vals:['NORMAL','OFF','HI'],lay:'none',dn:'COPILOT',big:1});
add({id:'propDeA',t:'tog',x:567,y:980,l:'PROP DEICE AUTO',d:'',sm:1,up:'',dn:''});
add({id:'propDeM',t:'tog',x:595,y:980,l:'PROP DEICE MANUAL',d:'',sm:1,up:'',dn:'',red:1});
add({id:'fvL',t:'tog',x:622,y:982,l:'FUEL VENT HEAT LEFT',d:'',sm:1,up:'',dn:'LEFT',red:1});
add({id:'fvR',t:'tog',x:651,y:982,l:'FUEL VENT HEAT RIGHT',d:'',sm:1,up:'',dn:'RIGHT',red:1});
add({id:'brakeDe',t:'tog',x:502,y:1031,l:'BRAKE DEICE',d:'',sm:1,up:'',big:1});
add({id:'surf',t:'tog3',x:531,y:1031,l:'SURFACE DEICE (SINGLE / OFF / MANUAL)',d:'',vals:['SINGLE','OFF','MANUAL'],lay:'none',red:1});
add({id:'stallHt',t:'tog',x:562,y:1031,l:'STALL WARN HEAT',d:'',sm:1,up:''});
add({id:'pitL',t:'tog',x:590,y:1031,l:'PITOT HEAT LEFT',d:'',sm:1,up:'',dn:'LEFT'});
add({id:'pitR',t:'tog',x:617,y:1031,l:'PITOT HEAT RIGHT',d:'',sm:1,up:'',dn:'RIGHT'});
add({id:'gearRelay',t:'cb',x:650,y:1028,l:'LANDING GEAR RELAY',cb:'GEAR',big:1,amp:'2',ds:'',la:'LANDING\nGEAR',lb:'RELAY'});
add({id:'gear',t:'gear',x:706,y:952,l:'LANDING GEAR'});
add({id:'dlRel',t:'push',x:679,y:998,r:8,l:'GEAR DOWN LOCK RELEASE',d:'',org:1});
add({id:'hdLt',t:'push',x:730,y:998,r:7,l:'GEAR HANDLE LIGHT TEST',d:''});
add({id:'beacon',t:'tog',x:761,y:931,l:'BEACON',d:'',sm:1,up:'',big:1});
add({id:'strobe',t:'tog',x:795,y:931,l:'STROBE',d:'',sm:1,up:''});
add({id:'tailFl',t:'tog',x:796,y:981,l:'TAIL FLOOD LIGHTS',d:'',sm:1,up:'',dn:'OFF'});
add({id:'hydT',t:'push',x:790,y:1030,r:7,l:'HYD FLUID SENSOR TEST',d:''});
add({id:'hornSil',t:'push',x:760,y:1030,r:7,l:'GEAR WARN SILENCE (LANDING GEAR WARNING HORN)',d:''});
/* copilot's left subpanel */
add({id:'furn',t:'tog',x:1158,y:926,l:'CABIN FURNISHING POWER',d:'',sm:1,up:'',dn:'OFF',red:1,ring:1});
add({id:'cabLt',t:'tog3',x:1197,y:926,l:'CABIN LIGHTS (START/BRIGHT / DIM / OFF)',d:'',vals:['START/BRIGHT','DIM','OFF'],lay:'none',red:1,ring:1});
add({id:'signs',t:'tog3',x:1236,y:926,l:'NO SMOKE & FSB SIGNS',d:'',vals:['NO SMOKE & FSB','OFF','FSB'],lay:'none',red:1,ring:1});
add({id:'manTemp',t:'tog3',x:1281,y:920,l:'MANUAL TEMP (INCR / DECR)',d:'',vals:['INCR','','DECR'],spring:1,lay:'none',red:1,ring:1});
add({id:'blower',t:'tog3',x:1320,y:920,l:'VENT BLOWER (HIGH / LO / AUTO)',d:'',vals:['HIGH','LO','AUTO'],lay:'right',red:1,ring:1});
add({id:'cabTemp',t:'rot',x:1374,y:927,r:17,l:'CABIN TEMP',d:''});
add({id:'cabMode',t:'rotsel',x:1454,y:920,l:'CABIN TEMP MODE',d:'',vals:['MAN HEAT','MAN COOL','OFF','AUTO'],ang:[-60,-112,0,60],r:17,s:4.4,big:1});
add({id:'bleedL',t:'tog3',x:1268,y:984,l:'BLEED AIR VALVE LEFT',d:'',vals:['OPEN','ENVR OFF','INSTR & ENVIR OFF'],lay:'none',ball:1});
add({id:'bleedR',t:'tog3',x:1320,y:984,l:'BLEED AIR VALVE RIGHT',d:'',vals:['OPEN','ENVR OFF','INSTR & ENVIR OFF'],lay:'none',ball:1});
add({id:'stallTest',t:'tog3',x:1262,y:1037,l:'STALL WARN TEST / OFF / LDG GEAR WARN TEST (SPRING-LOADED)',d:'',vals:['STALL WARN TEST','OFF','LDG GEAR WARN TEST'],spring:1,lay:'none',red:1,ring:1});
add({id:'envBleed',t:'tog',x:1240,y:984,l:'ENVIRONMENTAL BLEED AIR (NORMAL / LOW)',d:'',up:'',dn:''});
add({id:'aftHeat',t:'tog',x:1380,y:1037,l:'AFT HEAT',d:'',sm:1,up:'',dn:'OFF',red:1,ring:1});
add({id:'aftBlow',t:'tog',x:1301,y:1037,l:'AFT BLOWER',d:'',sm:1,up:'',dn:'OFF',red:1,ring:1});
add({id:'elecHeat',t:'tog',x:1340,y:1037,l:'ELECTRIC HEAT',d:'',sm:1,up:'',dn:'OFF',red:1,ring:1});
add({id:'fireTestL',t:'tog3',x:1440,y:1013,l:'ENG FIRE TEST LEFT (DET / OFF / EXT)',d:'',vals:['DET','OFF','EXT'],spring:1,lay:'none'});
add({id:'fireTestR',t:'tog3',x:1470,y:1013,l:'ENG FIRE TEST RIGHT (DET / OFF / EXT)',d:'',vals:['DET','OFF','EXT'],spring:1,lay:'none'});
add({id:'cabAir',t:'pull',x:1522,y:970,r:15,l:'CABIN/COCKPIT AIR (PULL: INCR COCKPIT, DECR CABIN)',d:'',top:'CABIN/\nCOCKPIT\nAIR',dn:'PULL\nINCR COCKPIT\nDECR CABIN'});
/* copilot's right subpanel */
add({id:'copAir',t:'pull',x:1635,y:970,r:15,l:'COPILOT AIR (PULL ON)',d:'',top:'COPILOT\nAIR',dn:'PULL\nON'});
add({id:'micSelR',t:'tog',x:1834,y:884,l:'COPILOT MIC – NORMAL / OXYGEN MASK',d:'',up:'',dn:'',blk:1});
/* left sidewall: fuel control panel, fuel system breakers, free air temperature */
add({id:'stbyL',t:'tog',x:34,y:1140,l:'STANDBY PUMP LEFT',d:'',sm:1,up:'STANDBY PUMP\nON',dn:'OFF'});
add({id:'auxL',t:'tog',x:34,y:1192,l:'AUX TRANSFER LEFT (OVERRIDE / AUTO)',d:'',sm:1,up:'AUX TRANSFER\nOVERRIDE',dn:'AUTO'});
add({id:'xfeed',t:'tog3',x:227,y:1142,l:'CROSSFEED FLOW',d:'',vals:['LEFT','OFF','RIGHT'],horiz:1,nolab:1});
add({id:'fqSel',t:'tog',x:227,y:1234,l:'FUEL QUANTITY – MAIN / AUXILIARY',d:'',sm:1,up:'FUEL QUANTITY\nMAIN',dn:'AUXILIARY'});
add({id:'stbyR',t:'tog',x:420,y:1140,l:'STANDBY PUMP RIGHT',d:'',sm:1,up:'STANDBY PUMP\nON',dn:'OFF'});
add({id:'auxR',t:'tog',x:420,y:1192,l:'AUX TRANSFER RIGHT (OVERRIDE / AUTO)',d:'',sm:1,up:'AUX TRANSFER\nOVERRIDE',dn:'AUTO'});
add({id:'fwL',t:'guard',x:48,y:1303,nolab:1,l:'FIREWALL SHUTOFF VALVE LEFT',d:'',up:'OPEN',dn:'CLOSED'});
add({id:'fwR',t:'guard',x:408,y:1303,nolab:1,l:'FIREWALL SHUTOFF VALVE RIGHT',d:'',up:'OPEN',dn:'CLOSED'});
add({id:'oatF',t:'push',x:486,y:1170,r:5,l:'FREE AIR TEMP – PUSH FOR °F',d:'°F',s:4});
add({id:'mask',t:'tog',x:486,y:1224,l:'CREW O2 MASK – DON',d:'',sm:1,up:'MASK\nDON',dn:'STOWED'});
add({id:'gearPump',t:'push',x:478,y:1440,r:10,l:'ALTERNATE GEAR EXTENSION HAND PUMP',d:'ALT GEAR\nHAND PUMP',s:4});
/* circuit breakers */
const CBS=[]; const cbAdd=(k,l,x,y,o)=>{ const i=CBS.length; CBS.push({k,l}); add(Object.assign({id:'cb'+i,t:'cb',x,y,l,cb:k,ds:''},o||{})); };
/* fuel system breakers (pilot's sidewall) */
[['FW VALVE L','FIREWALL VALVE L','FIRE\nWALL\nVALVE','5'],['STBY PUMP L','STANDBY PUMP L','STANDBY\nPUMP','10'],['AUX XFR L','AUX TRANSFER L','AUX\nTRANS\nFER','5'],['QTY IND L','QTY IND L','QTY\nIND','5'],['PRESS WARN L','PRESS WARN L','PRESS\nWARN','5'],
 ['CROSSFEED','CROSSFEED','CROSS\nFEED','5'],['PRESS WARN R','PRESS WARN R','PRESS\nWARN','5'],['QTY IND R','QTY IND R','QTY\nIND','5'],['AUX XFR R','AUX TRANSFER R','AUX\nTRANS\nFER','5'],['STBY PUMP R','STANDBY PUMP R','STANDBY\nPUMP','10'],['FW VALVE R','FIREWALL VALVE R','FIRE\nWALL\nVALVE','5']]
  .forEach(([k,l,la,amp],i)=>cbAdd(k,l,73.4+i*30.9,1306,{la,amp}));
[[['BUS FDR 3L','NO 3 BUS FEEDER','NO 3','50'],['BUS FDR 4L','NO 4 BUS FEEDER','NO 4','50']],[['PROP DEICE','PROP DEICE L','LEFT','25'],['PROP DEICE R','PROP DEICE R','RIGHT','25']],
 [['FLAP','FLAP MOTOR','MOTOR','20'],['PROP DEICE CTL','PROP DEICE CONTROL','CONTROL','5']],[['FLAP CTL','FLAP CONTROL','CONTROL','5'],['PROP GOV','PROP GOV','GOV','5']],
 [['IGN L','IGNITOR POWER L','LEFT','5'],['IGN R','IGNITOR POWER R','RIGHT','5']],[['START L','START CONTROL L','LEFT','5'],['START R','START CONTROL R','RIGHT','5']],[['BUS FDR 3R','NO 3 BUS FEEDER R','NO 3','50'],['BUS FDR 4R','NO 4 BUS FEEDER R','NO 4','50']]]
  .forEach((pair,i)=>pair.forEach(([k,l,t,amp],j)=>cbAdd(k,l,[35.6,60.6,84.1,107.7,131.3,154.9,178.5][i],1372+j*54,j?{lb:t,amp}:{la:(i===2||i===3)?'':t,amp})));
['ITT','TQ','NP','NG','FF','OILP','OILT'].forEach((k,i)=>['L','R'].forEach((s,j)=>cbAdd(k+' '+s,'ENGINE INSTRUMENTS '+['ITT','TORQUE','PROP TACH','TURBINE TACH','FUEL FLOW','OIL PRESS','OIL TEMP'][i]+' '+s,274.2+i*26.2,1382+j*44,{amp:'5'})));
/* copilot's circuit-breaker panel (right sidewall): [col,row,top,amp,bottom,key] */
const RCB=[[0,0,'PROP','5','SYNC','PROP SYNC'],[0,1,'AUTO','5','FEATHER','AUTOFEATHER'],[1,0,'LEFT','5','CHP DETR','CHIP DET L'],[1,1,'','5','RIGHT','CHIP DET R'],[2,0,'FIRE','5','DET','FIRE DET'],
 [3,0,'LEFT','5','STBY ENG\nANTI-ICE','STBY ANTI-ICE L'],[3,1,'','5','RIGHT','STBY ANTI-ICE R'],[4,0,'LEFT','5','MN ENG\nANTI-ICE','ENG ANTI-ICE L'],[4,1,'','5','RIGHT','ENG ANTI-ICE R'],
 [5,0,'LEFT','7½','FUEL CONTROL\nHEAT','FUEL CTL HEAT L'],[5,1,'','7½','RIGHT','FUEL CTL HEAT R'],[10,0,'LEFT','7½','ENG INSTR\nPOWER','ENG INSTR L'],[10,1,'','7½','RIGHT','ENG INSTR R'],
 [12,0,'VOICE','2','RCDR','VOICE RCDR'],[13,0,'AVIONICS','5','MASTER','AV MASTER'],[14,0,'RADIO','5','PHONE','RADIO PHONE'],
 [12,1,'AURAL','1','WARN','AURAL WARN'],[13,1,'PILOT','2','AUDIO','AUDIO'],[14,1,'CABIN','5','AUDIO','CABIN AUDIO'],[15,1,'COPILOT','2','AUDIO','COPILOT AUDIO'],
 [12,2,'AVIONICS','30','NO 1','AV BUS 1'],[13,2,'COMM','7½','NO 1','COMM 1'],[14,2,'NAV','2','NO 1','NAV 1'],[15,2,'COMPASS','3','NO 1','COMPASS 1'],
 [12,3,'AVIONICS','30','NO 2','AV BUS 2'],[13,3,'COMM','7½','NO 2','COMM 2'],[14,3,'NAV','2','NO 2','NAV 2'],[15,3,'COMPASS','3','NO 2','COMPASS 2'],[16,3,'EFIS\nAUX','15','BAT','EFIS AUX BAT'],
 [12,4,'LEFT','7½','MULTI FCTN\nPRCSR','MFP L'],[13,4,'PILOT\nEADI','5','','EADI'],[14,4,'DSPL','7½','PRCSR','DSPL PRCSR'],[15,4,'ADF','2','','ADF'],[16,4,'RMI','2','NO 2','RMI 2'],
 [12,5,'','7½','RIGHT','MFP R'],[13,5,'PILOT\nEHSI','5','','EHSI'],[14,5,'ELEK\nDSP','1','CONTR','DSP CONTR'],[15,5,'MULTI\nFCTN','4','DSPL','MFD'],[16,5,'RMI','2','NO 1','RMI 1'],
 [12,6,'XPNDR','3','NO 1','XPDR'],[13,6,'DME','2','NO 1','DME'],[14,6,'NORMAL','7½','EFIS\nFANS','EFIS FAN'],[15,6,'AP','10','SERVO','AUTOPILOT'],[16,6,'FCS','2','POWER','FCS POWER'],
 [12,7,'XPNDR','3','NO 2','XPDR 2'],[13,7,'DME','2','NO 2','DME 2'],[14,7,'','7½','STBY','EFIS FAN STBY'],[15,7,'COPILOT\nEHSI','2','','COPLT EHSI'],[16,7,'HDG','5','PRCSR','COPLT HDG'],
 [0,2,'AVIONICS','5','ANN','LT AV ANN'],[1,2,'NO SMK','10','FSB &\nCABIN','LT SIGNS'],[2,2,'AVIONICS','5','& ENG INSTR','LT AV ENG'],[3,2,'PLT FLT','7½','SIDE PNL','LT PLT FLT'],
 [0,3,'READING','5','','LT READ'],[1,3,'INSTR','5','INDIRECT','LT INDIRECT'],[2,3,'SUB PNL\nOVHD &','7½','CONSOLE','LT CONSOLE'],[3,3,'COPLT FLT','7½','INSTR','LT COPLT'],
 [5,2,'STALL','5','WARN','STALL WARN'],[6,2,'LEFT','5','BLEED AIR\nWARN','BLEED WARN'],[6,3,'','5','RIGHT','BLEED WARN R'],[7,2,'WARN','5','LANDING\nGEAR','GEAR WARN'],[7,3,'','5','IND','GEAR IND'],[8,2,'POWER','7½','ANN','ANN POWER'],[8,3,'','5','IND','ANN IND'],
 [9,2,'LEFT','5','FUEL\nVENT','FUEL VENT L'],[9,3,'','5','RIGHT','FUEL VENT R'],[10,2,'SURF','5','DEICE','SURF DEICE'],[11,2,'BRAKE','5','DEICE','BRAKE DEICE'],[10,3,'WSHLD','10','WIPER','WIPER'],
 [0,4,'OXYGEN','5','CONTROL','OXY CONTROL'],[1,4,'PRESS','5','CONTROL','PRESS CONT'],[2,4,'LEFT','5','BLEED AIR\nCONTROL','BLEED CTL L'],[1,5,'TEMP','5','CONTROL','TEMP CONTROL'],[2,5,'','5','RIGHT','BLEED CTL R'],
 [3,4,'ALT','1','ALERT','ALT ALERT'],[4,4,'PILOT','5','TURN &\nSLIP','TURN & SLIP'],[4,5,'','5','COPLT','TURN & SLIP 2'],[5,4,'PILOT','3','ALTM\nAIR DATA','AIR DATA'],[5,5,'COPLT','1','ENCD ALTM','ENCD ALTM'],
 [6,4,'PITCH','5','TRIM','PITCH TRIM'],[6,5,'RUDDER','5','BOOST','RUDDER BOOST'],[7,4,'OUTSIDE','5','AIR TEMP','OAT'],
 [9,4,'LEFT','10','GEN\nCONTROL','GEN CTL L'],[9,5,'','10','RIGHT','GEN CTL R'],[10,4,'NO 1','50','','BUS FDR 1A'],[11,4,'','50','','BUS FDR 1B'],[10,5,'','50','NO 2','BUS FDR 2A'],[11,5,'','50','','BUS FDR 2B'],
 [9,6,'MASTER','10','POWER','FURN MASTER'],[10,6,'CIGAR','5','LIGHTER','CIGAR'],
 [5,7,'TCAS','7½','','TCAS'],[6,7,'GPWS','2','','GPWS'],[7,7,'GPS','2','','GPS'],[8,7,'FMS','3','','FMS'],[9,7,'RADIO','2','ALTM','RAD ALTM'],[10,7,'RADAR','5','','RADAR']];
const RCX=c=>1550+c*25.4, RCY=r=>1144+r*36;
RCB.forEach(([c,r,ta,amp,tb,k])=>cbAdd(k,k,RCX(c),RCY(r),{la:ta,lb:tb,amp,fs:3.3}));
add({id:'altStatic',t:'guard',x:1712,y:1446,l:"PILOT'S STATIC AIR SOURCE",d:'',up:'ALTERNATE',dn:'NORMAL'});
/* pedestal */
add({id:'trim',t:'vwheel',x:722,y:1196,l:'ELEVATOR TRIM'});
add({id:'pwrL',t:'lev',x:798,y:1140,len:100,min:-0.4,max:1,kind:'pwr',l:'POWER L',mk:1,marks:[[1,'MAX'],[0,'IDLE'],[-0.12,'BETA'],[-0.4,'REV']]});
add({id:'pwrR',t:'lev',x:838,y:1140,len:100,min:-0.4,max:1,kind:'pwr',l:'POWER R'});
add({id:'propL',t:'lev',x:912,y:1140,len:100,min:0,max:1,kind:'prop',l:'PROP L',mk:1,marks:[[1,'2000'],[0.12,'1600'],[0,'FTHR']]});
add({id:'propR',t:'lev',x:946,y:1140,len:100,min:0,max:1,kind:'prop',l:'PROP R'});
add({id:'condL',t:'lev',x:1022,y:1140,len:100,min:0,max:1,kind:'cond',l:'CONDITION L',mk:1,marks:[[1,'HI IDLE'],[0.5,'LO IDLE'],[0,'CUTOFF']]});
add({id:'condR',t:'lev',x:1056,y:1140,len:100,min:0,max:1,kind:'cond',l:'CONDITION R'});
add({id:'flaps',t:'flap',x:1162,y:1180,l:'FLAPS',vals:['UP','APPROACH','DOWN']});
[['frPwr','POWER LEVER FRICTION',818],['frProp','PROP LEVER FRICTION',929],['frCond','CONDITION LEVER FRICTION',1039],['frFlap','FLAP / TRIM FRICTION',1240]].forEach(([id,l,x])=>add({id,t:'rot',x,y:x===1240?1180:1284,r:6,l,d:'FRICTION LOCK',s:3.6}));
add({id:'ailTrim',t:'rot',x:770,y:1312,r:10,l:'AILERON TRIM',d:'AILERON TRIM',s:4});
add({id:'rudTrim',t:'hwheel',x:880,y:1306,l:'RUDDER TRIM'});
add({id:'o2Ready',t:'pull',x:1208,y:1300,r:9,l:'OXYGEN SYSTEM READY (PULL ON)',d:'OXYGEN SYSTEM\nREADY – PULL ON',s:3.8});
add({id:'paxOvr',t:'pull',x:1268,y:1300,r:9,l:'PASSENGER OXYGEN MANUAL OVERRIDE',d:'PASSENGER O2\nMANUAL OVRD',s:3.8});
/* EFIS display control panel */
[['efisCrsSel','CRS 1/2','EFIS COURSE SOURCE (NAV 1 / NAV 2)'],['efisBrg1','BRG ○','EFIS BEARING POINTER ○ (OFF / NAV 1 / ADF)'],['efisBrg2','BRG ◇','EFIS BEARING POINTER ◇ (OFF / NAV 2 / ADF)'],['efisFmt','ARC','EHSI FORMAT (FULL / ARC)'],['efisEt','ET','ELAPSED TIME (START / STOP / RESET)']]
  .forEach(([id,l,lbl],i)=>add({id,t:'key',x:730+i*38,y:1358,w:30,h:14,l,lbl,kg:1}));
add({id:'efisDim',t:'rot',x:924,y:1358,r:7,l:'EFIS DISPLAY DIMMING (DIM)',d:'DIM',s:3.6});
add({id:'hdgK',t:'enc',x:1065,y:576,r:13,l:'HDG',d:''});
add({id:'crsK',t:'enc',x:982,y:576,r:12,l:'CRS 1',d:''});
/* autopilot / flight director: autopilot controller (top centre) and two mode selector panels */
const APM=[['HDG','HDG'],['NAV','NAV'],['APPR','APPR'],['BC','B/C'],['CLIMB','CLIMB'],['ALT','ALT'],['ALTSEL','ALT SEL'],['VS','VS'],['IAS','IAS'],['DSC','DSC']];
APM.forEach(([k,l],i)=>add({id:'ap'+k,t:'abtn',x:864+(i%5)*41,y:i<5?498:523,l,momentary:1,lbl:'AP/FD '+l}));
APM.forEach(([k,l],i)=>add({id:'ap2'+k,t:'abtn',x:1146+(i%5)*41,y:i<5?498:523,l,momentary:1,lbl:'AP/FD (COPILOT) '+l}));
add({id:'apYD',t:'abtn',x:968,y:410,l:'YD',momentary:1,lbl:'YAW DAMP ENGAGE'});
add({id:'apAP',t:'abtn',x:1004,y:410,l:'AP',momentary:1,lbl:'AUTOPILOT ENGAGE'});
add({id:'apSR',t:'abtn',x:1110,y:397,l:'SR',lbl:'SOFT RIDE'});
add({id:'apHB',t:'abtn',x:1110,y:421,l:'½ φ',lbl:'HALF BANK'});
add({id:'apTurn',t:'rot',x:1062,y:408,r:15,l:'AUTOPILOT TURN KNOB',d:'',s:4});
add({id:'apPitch',t:'enc',x:1158,y:408,r:10,l:'AUTOPILOT PITCH WHEEL (DN / UP)',d:'',deg:20});
/* cabin pressure controller and pedestal switches */
add({id:'cabAlt',t:'enc',x:1130,y:1372,r:11,l:'CABIN ALTITUDE SELECT',d:'CABIN ALT'});
add({id:'cabRate',t:'rot',x:1180,y:1384,r:8,l:'CABIN RATE',d:'RATE',s:4});
add({id:'pressSw',t:'tog3',x:760,y:1422,l:'CABIN PRESS (DUMP / PRESS / TEST)',d:'',vals:['DUMP','PRESS','TEST'],lay:'none'});
add({id:'rudBoost',t:'tog',x:826,y:1422,l:'RUDDER BOOST',d:'',sm:1,up:'',dn:'OFF'});
add({id:'elTrim',t:'tog',x:888,y:1422,l:'ELEVATOR TRIM',d:'',sm:1,up:'',dn:'OFF',red:1});
/* control wheels */
add({id:'yokeL',t:'yoke',x:585,y:1308,l:'CONTROL WHEEL'}); add({id:'yokeR',t:'yoke',x:1415,y:1308,l:'CONTROL WHEEL',co:1});
add({id:'apDisc',t:'sbtn',x:585,y:1308,l:'AP DISC',dx:-84,dy:-30,col:'#c62a1d'});
add({id:'trimDn',t:'sbtn',x:585,y:1308,l:'TRIM NOSE DN',dx:-70,dy:-42,col:'#59616b',r:4}); add({id:'trimUp',t:'sbtn',x:585,y:1308,l:'TRIM NOSE UP',dx:-70,dy:-32,col:'#59616b',r:4});
/* engine anti-ice group: on the pilot's left subpanel behind the control column (drawn over the column so it can be reached) */
add({id:'engAIL',t:'tog',x:268,y:924,l:'ENGINE ANTI-ICE LEFT (ON / OFF)',d:'',up:'',dn:'',sm:1});
add({id:'engAIR',t:'tog',x:320,y:924,l:'ENGINE ANTI-ICE RIGHT (ON / OFF)',d:'',up:'',dn:'',sm:1});
add({id:'actL',t:'tog',x:268,y:976,l:'ENG ANTI-ICE ACTUATOR LEFT (STANDBY / MAIN)',d:'',sm:1,up:'',dn:'',red:1});
add({id:'actR',t:'tog',x:320,y:976,l:'ENG ANTI-ICE ACTUATOR RIGHT (STANDBY / MAIN)',d:'',sm:1,up:'',dn:'',red:1});

/* group moves to the reference layout (control positions follow their drawn module) */
const SHIFT=[[105,110,['mfdPwr','mfdRdr','mfdNav','mfdRmt','mfdPge','mfdEmg','mfdL1','mfdL2','mfdL3','mfdL4','mfdUp','mfdDn','mfdRcl','mfdSkp','mfdClr','mfdData','mfdTilt']],
  [-101,1067,['autoCommP','autoCommC','micP','volP','spkrP','audEmer','voiceP','pageVol','gndComm','intphVol','voiceC','hotIntph','spkrC','volC','micC','sideP','sensP','dmeV1','dmeV2','encAlt','mkrHi','mkrVol','annBrt','sideC','sensC'].concat([0,1,2,3,4,5,6,7,8].flatMap(i=>['auP'+i,'auC'+i]))]];
SHIFT.forEach(([dx,dy,ids])=>ids.forEach(id=>{ const c=C.find(k=>k.id===id); c.x+=dx; c.y+=dy; }));

/* ---------- layout from the reference photo ---------- */
const CB=id=>C.find(k=>k.id===id);
/* side consoles, pedestal and audio panel sit below the photo frame: move them down as one block */
C.forEach(c=>{ if(c.y>=1100&&!['yokeL','yokeR','apDisc','trimUp','trimDn'].includes(c.id)) c.y+=DY; });
/* place a control at a photo position (px, py) */
const at=(id,px,py,o)=>{ const c=CB(id); c.x=PX(px); c.y=PY(py); if(o) Object.assign(c,o); };
/* glareshield */
at('mwL',205,115,{rot:-10,w:34,h:26}); at('mcL',240,108,{rot:-10,w:34,h:26}); at('mcR',1043,98,{rot:9,w:34,h:26}); at('mwR',1083,102,{rot:9,w:34,h:26});
at('fireL',565,115,{w:46,h:30,l2:'PUSH TO EXT'}); at('fireR',714,112,{w:46,h:30,l2:'PUSH TO EXT'}); at('annTest',734,66,{r:8});
/* pilot: lamp strip above the EADI, GPWS group in the dark corner, fast erect, EFIS dimming */
at('gpsCrs',221,180,{w:24,h:26}); at('gpsApr',240,180,{w:24,h:26}); at('gpwsFlap',280,180,{w:24,h:26});
at('gpwsT',62,163,{w:24,h:20}); at('bgsC',87,163,{w:24,h:20});
at('fastErect',186,447,{r:10}); at('micSel',157,455,{xs:1,s:3.2});
at('sync',388,481,{xs:1});
/* copilot: radio altimeter test / DH knob */
at('fastErect2',1096,428,{r:10,red:1}); at('micSelR',1148,441,{xs:1,s:3.2});
/* EADI bezel: DH SET knob with the TEST button beside it (both displays) */
at('dhK',258,326,{r:5}); at('raT',272,326,{r:3.2}); at('dhK2',1027,313,{r:5}); at('raT2',1041,313,{r:3.2});
at('gpwsT2',1213,172,{w:24,h:20}); at('bgsC2',1238,172,{w:24,h:20});
/* autopilot controller, course / heading panel, altitude alerter, ground comm */
at('apYD',638,173,{bw:20,bh:30,l:'YAW\nENG'}); at('apAP',659,173,{bw:20,bh:30,l:'AP\nENG'}); at('apTurn',690,178,{r:25}); at('apSR',719,165,{bw:20,bh:19}); at('apHB',719,187,{bw:20,bh:19}); at('apPitch',746,178,{r:12});
at('gndComm',561,184,{w:30,h:30});
at('crsK',636,290,{r:15}); at('hdgK',690,290,{r:15}); at('crs2K',743,290,{r:15});
at('altAck',791,289,{w:26,h:22}); at('altSel',857,302,{r:8});
/* navigator: COMM 1 / NAV 1 on the left bezel, GPS keys on the right bezel, secondary keys on the soft-key row */
at('com1Md',554,365,{r:6.5,s:2.8}); at('com1Vol',554,379,{r:3.6}); at('com1X',554,393);
at('nav1Md',554,408,{r:6.5,s:2.8}); at('nav1Vol',554,422,{r:3.6}); at('nav1X',554,436);
at('nav1K',554,454,{r:10}); at('com1K',553,475,{r:13});
[['com1Sto','C STO'],['com1T','C TST'],['com1Act','C ACT'],['nav1Sto','V STO'],['nav1T','V TST'],['nav1Act','V ACT'],['gpsCrsrL','◄CRSR'],['gpsCrsrR','CRSR►']]
  .forEach(([id,t],i)=>at(id,579+i*12.6,463,{soft:t,w:17,h:11,kw:0}));
at('gpsPwr',687,364,{r:4}); ['gpsDto','gpsMsg','gpsClr','gpsEnt','gpsAlt'].forEach((id,i)=>at(id,687,381+i*14,{w:17,h:10}));
at('gpsKL',687,455,{r:8}); at('gpsKR',689,476,{r:11});
/* pilot's left subpanel */
at('extPwr',78,497,{sm3:1,ring:1}); at('avio',124,497,{xs:1,s:3.6}); at('inv',166,497,{sm3:1,s:3.6});
at('aignL',201,500,{xs:1}); at('aignR',219,500,{xs:1});
at('gang',115,523,{w:150,h:20}); at('bat',85,541,{xs:1}); at('genL',115,541,{sm3:1}); at('genR',145,541,{sm3:1});
at('busSense',145,571,{sm3:1}); at('genTies',167,571,{sm3:1});
at('engAIL',199,535,{xs:1}); at('engAIR',226,535,{xs:1}); at('actL',199,574,{xs:1}); at('actR',226,574,{xs:1});
at('ignL',107,611,{sm3:1,big:0}); at('ignR',133,611,{sm3:1,big:0}); at('afSw',182,611,{sm3:1}); at('govT',216,612,{xs:1}); at('gndIdle',236,612,{xs:1});
at('park',80,624); at('pilotAir',281,566,{r:11});
/* pilot's right subpanel */
at('defrost',333,573,{r:12});
['landL','landR','taxi','iceLt','navLt','recog'].forEach((id,i)=>at(id,[345,364,383,401,419,437][i],536,{xs:1,up:''}));
[['wsP',352],['wsC',370],['propDeA',389],['propDeM',407],['fvL',425],['fvR',443]].forEach(([id,x])=>at(id,x,576,{xs:1,sm3:1,dn:''}));
[['brakeDe',351],['surf',369],['stallHt',387],['pitL',405],['pitR',423]].forEach(([id,x])=>at(id,x,611,{xs:1,sm3:1,big:0,dn:''}));
at('gearRelay',442,611,{big:0,la:'',lb:''}); at('gear',474,568); at('dlRel',456,598,{r:6}); at('hdLt',494,594,{r:5}); at('hornSil',514,611,{r:6});
at('beacon',511,532,{xs:1,big:0}); at('strobe',531,532,{xs:1}); at('tailFl',532,574,{xs:1,dn:''}); at('hydT',537,611,{r:6});
/* copilot's environmental subpanel */
at('stallTest',764,607,{sm3:1}); at('envBleed',792,578,{xs:1}); at('aftHeat',865,607,{xs:1}); at('manTemp',836,533,{sm3:1}); at('blower',860,533,{sm3:1}); at('cabTemp',885,536,{r:14}); at('cabMode',938,527,{r:17});
at('bleedL',828,572); at('bleedR',857,572); at('aftBlow',818,607,{xs:1}); at('elecHeat',840,607,{xs:1});
at('fireTestL',913,585,{sm3:1}); at('fireTestR',940,585,{sm3:1}); at('cabAir',982,576,{r:13});
/* copilot's right subpanel (column behind the copilot control column) */
at('copAir',1044,600,{r:9}); at('furn',1139,500,{xs:1}); at('cabLt',1160,500,{sm3:1}); at('signs',1181,500,{sm3:1}); 
/* control columns, seen end-on as in the photo */
at('yokeL',217,546); at('yokeR',1077,533);
[['apDisc',-40,-24],['trimDn',-42,14],['trimUp',-48,2]].forEach(([id,dx,dy])=>{ const c=CB(id); c.x=CB('yokeL').x; c.y=CB('yokeL').y; c.dx=dx; c.dy=dy; });
/* instruments and units moved and scaled as one group: [name, source box (world, as drawn), photo box (x0,y0,x1,y1) or world box, control ids] */
const MODS={};
[['asi',[147,457,116,116],[106,205,188,287],[]],
 ['eadi',[283,441,194,176],[190,198,330,329],[]],
 ['ehsi',[283,637,194,190],[209,332,342,464],[]],
 ['alt',[489.5,434.5,125,127],[322,188,418,292],['altT','baroK']],
 ['vsi',[492.5,595,120,128],[335,292,420,383],['tcasAB','tcasR']],
 ['fcons',[525,741,62,62],[357,388,415,446],['fcRst']],
 ['clk1',[66,574,72,72],[56,279,112,335],[]],
 ['rmi',[158,591,124,118],[120,300,212,387],[]],
 ['ts1',[74,668,68,68],[65,334,119,388],[]],
 ['slv1',[74,752,76,66],[80,408,142,462],['slewL','slewR','gyroMode']],
 ['dme1',[170,723,110,58],[131,391,211,432],['dmeCh','dmeSel','dmePwr']],
 ['aux',[28,468,88,80],{w:[22,500,80,73]},['efisAux','efisHorn']],
 ['asi2',[1374,438,116,116],[881,191,963,273],[]],
 ['eadi2',[1527,441,194,176],[969,183,1093,320],[]],
 ['ehsi2',[1527,637,194,190],[960,322,1092,457],[]],
 ['alt2',[1743.5,436.5,125,127],[1100,183,1205,286],['baro2K']],
 ['vsi2',[1746,595,120,128],[1097,286,1182,374],['tcasAB2','tcasR2']],
 ['rmi2',[1362,591,124,118],[872,287,962,377],[]],
 ['clk2',[1874,564,72,72],[1189,263,1243,317],[]],
 ['ts2',[1876,668,68,68],[1185,329,1239,383],[]],
 ['slv2',[1872,757,76,66],[1172,395,1232,448],['slew2L','slew2R','gyro2Mode']],
 ['dme2',[1746,722,120,60],[1093,376,1172,420],['dme2Ch','dme2Sel','dme2Pwr']],
 ['xpdr',[1368,716,96,103],[878,380,946,461],['xpdrMd','xpdr12','xpdrId','xpdrT','xpdrPre','xpdrK']],
 ['fdL',[822,455,250,82],[540,208,695,262],APM.map(([k])=>'ap'+k)],
 ['fdR',[1104,455,250,82],[713,207,868,260],APM.map(([k])=>'ap2'+k)],
 ['mfd',[1094,680,249,193],[703,352,868,480],['mfdPwr','mfdRdr','mfdNav','mfdRmt','mfdPge','mfdEmg','mfdL1','mfdL2','mfdL3','mfdL4','mfdUp','mfdDn','mfdRcl','mfdSkp','mfdClr','mfdData','mfdTilt']],
 /* COMM 2 / NAV 2 / ADF tuning strip: not visible in the photo; it lives on the right side console under the static-air panel */
 ['strip',[816,608,542,74],{w:[1531,1690,460,63]},['com2','nav2','adf'].flatMap(k=>[k+'Md',k+'Vol',k+'Sto',k+'T',k+'Act',k+'X',k+'K'])]
].forEach(([n,sr,d,ids])=>{ const dw=d.w?d.w:PR(...d); const sx=dw[2]/sr[2], sy=dw[3]/sr[3], tx=dw[0]-sx*sr[0], ty=dw[1]-sy*sr[1];
  const m=MODS[n]={sx,sy,tx,ty,mt:`matrix(${sx.toFixed(4)} 0 0 ${sy.toFixed(4)} ${tx.toFixed(2)} ${ty.toFixed(2)})`};
  ids.forEach(id=>{ const c=CB(id); c.ox=c.x; c.oy=c.y; c.x=tx+sx*c.ox; c.y=ty+sy*c.oy; c.mt=m.mt; c.sc=(sx+sy)/2; }); });
const M=(n,svg)=>`<g class="mod mod-${n}" transform="${MODS[n].mt}">${svg}</g>`;

/* ---------- SVG helpers ---------- */
function lab(x,y,t,o){ o=o||{}; const s=o.s||7; return String(t).split('\n').map((ln,i)=>`<text x="${x}" y="${(y+i*s*1.12).toFixed(1)}" class="pl ${o.c||''}" style="font-size:calc(var(--ls,1)*${s}px)" text-anchor="${o.a||'middle'}">${esc(ln)}</text>`).join(''); }
function labUp(x,y,t,o){ o=o||{}; const s=o.s||7, n=String(t).split('\n').length; return lab(x,y-(n-1)*s*1.12,t,o); }
const D=c=>c.d!==undefined?c.d:c.l;
function plate(x,y,w,h,r,cls){ return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r||6}" class="${cls||'sub'}"/>`; }
/* group outline with a title gap in the top line (placard style) */
function grp(x,y,w,h,t,o){ o=o||{}; const s=o.s||4.6, tw=t?t.length*s*0.62+6:0, m=x+w/2;
  return `<path d="M${m-tw/2} ${y}H${x}V${y+h}H${x+w}V${y}H${m+tw/2}" class="grpl"/>${t?lab(m,y+s*0.36,t,{s}):''}`; }
function brk(x0,x1,y,t,o){ o=o||{}; const s=o.s||4.2, tw=t.length*s*0.62+6, m=(x0+x1)/2; return `<path d="M${x0} ${y-3}V${y}H${m-tw/2}M${m+tw/2} ${y}H${x1}V${y-3}" class="grpl"/>${lab(m,y+s*0.36,t,{s})}`; }
function screw(x,y){ return `<g class="screw"><circle cx="${x}" cy="${y}" r="3.2"/><path d="M${x-2} ${y-1}l4 2"/></g>`; }
const pol=(x,y,r,deg)=>{ const a=deg*Math.PI/180; return [x+Math.sin(a)*r, y-Math.cos(a)*r]; };
const octP=(cx,cy,w,h,c)=>{ const x=cx-w/2, y=cy-h/2; return `M${x+c} ${y}H${x+w-c}L${x+w} ${y+c}V${y+h-c}L${x+w-c} ${y+h}H${x+c}L${x} ${y+h-c}V${y+c}Z`; };
function oct(cx,cy,w,h,c,cls){ return `<path d="${octP(cx,cy,w,h,c)}" class="${cls||'obz'}"/>`; }
/* instrument case: outer octagonal case with a lighter rim and a dark face */
function ocase(cx,cy,w,h,c){ return `${oct(cx,cy,w,h,c,'obz')}${oct(cx,cy,w-6,h-6,c-2,'obz2')}`; }
/* annunciator lamp: dark lens with a coloured legend, lit by ann() */
function lampBox(k,x,y,w,h,lines,col,fs){ const f=fs||Math.min(h/(lines.length+0.6),w/(Math.max(...lines.map(s=>s.length))*0.72)); const y0=y+h/2-(lines.length-1)*f*0.55+f*0.36;
  return `<rect x="${x-2}" y="${y-2}" width="${w+4}" height="${h+4}" rx="3" class="lampb"/><g class="an an-${col}" data-a="${esc(k)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>${lines.map((s,i)=>`<text x="${x+w/2}" y="${(y0+i*f*1.1).toFixed(1)}" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(s)}</text>`).join('')}</g>`; }

function nutSVG(c,x,y,r){ return `${c.ring?`<circle cx="${x}" cy="${y}" r="${r+3.2}" class="ringR"/>`:''}<circle cx="${x}" cy="${y}" r="${r}" class="nut"/><circle cx="${x}" cy="${y}" r="${r*0.6}" class="nut2"/>`; }
function batSVG(c,x,y,L,cls){ const k=c.big?5.6:4.2; return `<rect x="${x-3}" y="${y-L}" width="6" height="${L}" rx="3" class="${cls}"/><ellipse cx="${x}" cy="${y-L+1}" rx="${k}" ry="${k*0.72}" class="${cls}"/>`; }
function softSVG(c,x,y){ const w=c.w||17, h=c.h||11, f=Math.min(h*0.42,w/(c.soft.length*0.74));
  return `<g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="1.6" class="keyw"/>${c.t==='abtn'?`<rect class="aled" x="${x-w*0.3}" y="${y-h/2+1}" width="${w*0.6}" height="1.3" rx=".6"/>`:''}<text x="${x}" y="${(y+f*0.4+(c.t==='abtn'?0.6:0)).toFixed(1)}" class="kt" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(c.soft)}</text></g>`; }
function ctlSVG(c){
  const x=c.ox!==undefined?c.ox:c.x, y=c.oy!==undefined?c.oy:c.y; let s='';
  if(c.soft) s=softSVG(c,x,y); else
  switch(c.t){
    case 'tog': if(c.rk){ s=`<rect x="${x-8}" y="${y-14}" width="16" height="28" rx="1" fill="#0e0d0d"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><rect x="${x-6.5}" y="${y-12.5}" width="13" height="25" rx="1" fill="#f4f4f2"/><rect x="${x-6.5}" y="${y}" width="13" height="12.5" rx="1" fill="#b9b9b6"/></g>`; break; }
    case 'tog': { const L=c.xs?12:c.sm?16:20, ls=c.s||4.4, nr=c.xs?5.5:c.sm?7:8.5; const cls=c.red?'batr':c.blk?'batk':'batg';
      s=`${nutSVG(c,x,y,nr)}<g class="mv bat" style="transform-origin:${x}px ${y}px">${batSVG(c,x,y,L,cls)}</g>`;
      if(c.up!==''&&!c.noup) s+=labUp(x,y-L-5,c.up===undefined?'ON':c.up,{s:ls});
      if(c.dn) s+=lab(x,y+L+ls*0.95+1,c.dn,{s:ls});
      if(D(c)) s+=lab(x,y+L+ls+(c.dn?ls*1.2*String(c.dn).split('\n').length:0)+2,D(c),{s:c.s||5}); break; }
    case 'tog3': { const L=c.sm3?13:16, ls=c.s||4.2, nr=c.sm3?5.8:7; const cls=c.red?'batr':'batg';
      const inner=`${nutSVG(c,x,y,nr)}<g class="mv bat" style="transform-origin:${x}px ${y}px">${batSVG(c,x,y,L,cls)}</g>`;
      s=c.horiz?`<g transform="rotate(-90 ${x} ${y})">${inner}</g>`:inner;
      if(c.ball) s=`<circle cx="${x}" cy="${y}" r="11" class="ring0"/><g class="mv bat" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y-6}" r="8.5" class="ballk"/></g>`;
      const lay=c.lay||'right';
      if(c.horiz){ s+=(c.nolab?'':lab(x-L-4,y+1.5,c.vals[0],{s:ls,a:'end'})+lab(x+L+4,y+1.5,c.vals[2],{s:ls,a:'start'}))+lab(x,y+nr+ls+1,c.vals[1],{s:ls}); }
      else if(lay==='right'){ s+=lab(x+nr+3,y-L+3,c.vals[0],{s:ls,a:'start'})+(c.vals[1]?lab(x+nr+3,y+1.5,c.vals[1],{s:ls,a:'start'}):'')+lab(x+nr+3,y+L-1,c.vals[2],{s:ls,a:'start'}); }
      else if(lay==='left'){ s+=lab(x-nr-3,y-L+3,c.vals[0],{s:ls,a:'end'})+(c.vals[1]?lab(x-nr-3,y+1.5,c.vals[1],{s:ls,a:'end'}):'')+lab(x-nr-3,y+L-1,c.vals[2],{s:ls,a:'end'}); }
      else if(lay==='inv'){ s+=labUp(x,y-L-4,'INVERTER\n'+c.vals[0],{s:ls})+lab(x+nr+3,y-1,'O\nF\nF',{s:ls*0.9,a:'start'})+lab(x,y+nr+ls+1,c.vals[2],{s:ls}); }
      else if(lay==='vbr'){ s+=labUp(x,y-L-4,c.vals[0],{s:ls})+lab(x+nr+3,y-8,'B\nO\nT\nH',{s:ls*0.85,a:'start'})+lab(x,y+nr+ls+1,c.vals[2],{s:ls}); }
      if(c.dn) s+=lab(x,y+L+ls+1,c.dn,{s:ls});
      if(D(c)) s+=lab(x,y+L+11,D(c),{s:5}); break; }
    case 'guard': s=`${nutSVG(c,x,y,7)}<g class="mv bat" style="transform-origin:${x}px ${y}px">${batSVG(c,x,y,18,'batg')}</g><g class="gd" style="transform-origin:${x}px ${y+12}px"><path d="M${x-11} ${y+12}V${y-21}q0-5 5-5h12q5 0 5 5V${y+12}z" class="guardc"/><path d="M${x-7} ${y-16}h14" class="guardl"/></g>${c.nolab?'':lab(x,y-29,c.up||'ON',{s:4.6})+lab(x,y+21,c.dn||'CLOSED',{s:4.6})}${D(c)?lab(x,y+28,D(c),{s:4.6}):''}`; break;
    case 'rot': { const r=c.r||12; const knob=c.vol?`<circle cx="${x}" cy="${y}" r="${r}" class="knobk"/><path d="M${x} ${y-r*0.15}V${y-r*0.72}M${x-r*0.16} ${y-r*0.5}L${x} ${y-r*0.74}L${x+r*0.16} ${y-r*0.5}" class="volar"/><text x="${x}" y="${y+r*0.42}" class="kt" font-size="${r*0.5}" text-anchor="middle">VOL</text>`
        :c.txt?`<circle cx="${x}" cy="${y}" r="${r}" class="knobk"/><text x="${x}" y="${y+r*0.2}" class="kt" font-size="${r*0.5}" text-anchor="middle" transform="rotate(30 ${x} ${y})">${esc(c.txt)}</text>`
        :`<circle cx="${x}" cy="${y}" r="${r}" class="knob"/><circle cx="${x}" cy="${y}" r="${r-Math.min(4,r*0.3)}" class="knobtop"/><rect x="${x-Math.max(0.8,r*0.1)}" y="${y-r+1}" width="${Math.max(1.6,r*0.2)}" height="${r*0.6}" class="ptr"/>`;
      s=`<circle cx="${x}" cy="${y}" r="${r+2.5}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px">${knob}</g>`;
      if(c.top) s+=labUp(x,y-r-4.5,c.top,{s:c.s||4.2});
      if(c.bo) s+=lab(x-r*0.55,y-r-1.2,'BRT',{s:2.3,a:'end'})+lab(x+r*0.55,y-r-1.2,'OFF',{s:2.3,a:'start'});
      if(D(c)) s+=lab(x,y+r+(c.s||4.4)+2.5,D(c),{s:c.s||4.4}); break; }
    case 'enc': { const r=c.r||12; s=`<circle cx="${x}" cy="${y}" r="${r+2.5}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/>${Array.from({length:12},(_,i)=>{ const [a,b]=pol(x,y,r-0.5,i*30), [e,f]=pol(x,y,r-Math.min(3,r*0.3),i*30); return `<path d="M${a} ${b}L${e} ${f}" class="knurl"/>`; }).join('')}<circle cx="${x}" cy="${y}" r="${r*0.45}" class="knobtop"/><rect x="${x-0.9}" y="${y-r+1}" width="1.8" height="${r*0.45}" class="ptr"/></g>${D(c)?lab(x,y+r+7,D(c),{s:4.6}):''}`; break; }
    case 'enc2': { const r=c.r||14, ri=r*0.56; s=`<circle cx="${x}" cy="${y}" r="${r+2.5}" class="ring0"/><g class="mv rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r}" class="knob"/>${Array.from({length:16},(_,i)=>{ const [a,b]=pol(x,y,r-0.5,i*22.5), [e,f]=pol(x,y,r-3,i*22.5); return `<path d="M${a} ${b}L${e} ${f}" class="knurl"/>`; }).join('')}</g><g class="mvi rt" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${ri}" class="knob2"/><rect x="${x-0.9}" y="${y-ri+1}" width="1.8" height="${ri*0.6}" class="ptr"/></g>`; break; }
    case 'rotsel': { const r=c.r||12; const knob=c.half?`<circle cx="${x}" cy="${y}" r="${r}" class="knobk"/><path d="M${x} ${y-r}A${r} ${r} 0 0 1 ${x} ${y+r}z" class="halfw"/>`
        :c.rad?`<circle cx="${x}" cy="${y}" r="${r}" class="knobw"/><circle cx="${x}" cy="${y}" r="${r*0.68}" class="knobk"/><text x="${x}" y="${y+r*0.28}" class="kt" font-size="${r*0.72}" text-anchor="middle" font-style="italic">V</text><path d="M${x} ${y-r}v${r*0.3}" stroke="#111" stroke-width="1.6"/>`
        :c.big?`<circle cx="${x}" cy="${y}" r="${r}" class="knob"/><path d="M${x-r*0.3} ${y+r*0.9}L${x-r*0.22} ${y-r*0.92}h${r*0.44}L${x+r*0.3} ${y+r*0.9}z" class="selbar"/><path d="M${x} ${y-r*0.9}v${r*0.6}" stroke="#eee" stroke-width="1.4"/>`
        :`<circle cx="${x}" cy="${y}" r="${r}" class="knob"/><path d="M${x-3} ${y+r-2}L${x} ${y-r+2}L${x+3} ${y+r-2}z" class="ptrbar"/>`;
      s=`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/>${c.vals.map((v,i)=>{ const a=c.ang[i]; const ln=Math.max(...v.replace(' & ','\n& ').replace('MAN ','MAN\n').split('\n').map(t=>t.length)); const [px,py]=pol(x,y,r+4+(c.s||4.4)*(Math.abs(Math.sin(a*Math.PI/180))*ln*0.34+0.8),a); return v?lab(px,py+(c.s||4.4)*0.36,v.replace(' & ','\n& ').replace('MAN ','MAN\n'),{s:c.s||4.4}):''; }).join('')}<g class="mv rt" style="transform-origin:${x}px ${y}px">${knob}</g>${D(c)?lab(x,y+r+10,D(c),{s:5}):''}`; break; }
    case 'push': { const r=c.r||10; s=`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/><g class="mv pb"><circle cx="${x}" cy="${y}" r="${r}" class="${c.red?'pbtnr':c.org?'pbtno':'pbtn'}"/><circle cx="${x-r*0.3}" cy="${y-r*0.35}" r="${r*0.35}" class="spec"/></g>`+(D(c)?(c.side?lab(x+r+3,y+1.4,D(c),{s:c.s||4.6,a:'start'}):lab(x,y+r+(c.s||4.6)+1.5,D(c),{s:c.s||4.6})):''); break; }
    case 'bar': { const w=c.w,h=c.h; s=`<g class="mv pb"><path d="M${x-w/2} ${y-h/2}h${w}l-6 ${h}h-${w-12}z" class="gangb"/><text x="${x}" y="${y+2.8}" class="pl" font-size="8.4" text-anchor="middle">${esc(D(c))}</text></g>`; break; }
    case 'mbtn': { const w=c.w, h=c.h, f=Math.min(h*0.3,w/Math.max(c.l1.length,c.l2.length)/0.62,6.6); s=`<rect x="${x-w/2-3}" y="${y-h/2-3}" width="${w+6}" height="${h+6+(c.sub?7:0)}" rx="2.5" class="bezel1"/><g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="mb mb-${c.col}"/><text x="${x}" y="${y-h*0.06}" class="mbt" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(c.l1)}</text><text x="${x}" y="${y+h*0.32}" class="mbt" font-size="${(c.sub?f:f*0.78).toFixed(2)}" text-anchor="middle">${esc(c.l2)}</text></g>${c.sub?`<text x="${x}" y="${y+h/2+6}" class="pl" font-size="3.6" text-anchor="middle">${esc(c.sub)}</text>`:''}`; break; }
    case 'abtn': { const w=c.bw||(c.sm?13:c.l.length>4?36:30), h=c.bh||(c.sm?7:18); const ls=String(c.l).split('\n'), fs=c.sm?3.6:Math.min(c.l.length>4&&ls.length<2?5.4:6.4,w/(Math.max(...ls.map(t=>t.length))*0.66)), y0=y+(c.sm?2.6:h*0.3)-(ls.length-1)*fs*0.55;
      s=`<g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${c.sm?1.5:2.5}" class="abtn"/><rect class="aled" x="${x-w*0.2}" y="${y-h/2+1.2}" width="${w*0.4}" height="${c.sm?1.4:2.2}" rx="0.8"/>${ls.map((t,i)=>`<text x="${x}" y="${(y0+i*fs*1.1).toFixed(1)}" class="pl" font-size="${fs.toFixed(2)}" text-anchor="middle">${esc(t)}</text>`).join('')}</g>`; break; }
    case 'key': { const w=c.w||16, h=c.h||12;
      if(c.lamp){ const ls=[c.l1,c.l2,c.l3].filter(Boolean); const f=Math.min(h/(ls.length+0.5),w/(Math.max(...ls.map(t=>t.length))*0.64)); const y0=y-(ls.length-1)*f*0.55+f*0.36;
        s=`<rect x="${x-w/2-2}" y="${y-h/2-2}" width="${w+4}" height="${h+4}" rx="3" class="lampb"/><g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="lk lk-${c.lamp}"/>${ls.map((t,i)=>`<text x="${x}" y="${(y0+i*f*1.1).toFixed(1)}" class="lkt lkt-${c.lamp}" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(t)}</text>`).join('')}</g>`; break; }
      if(c.round){ s=`<circle cx="${x}" cy="${y}" r="${w/2+1.5}" class="ring0"/><g class="mv pb"><circle cx="${x}" cy="${y}" r="${w/2}" class="keyr"/></g>`; break; }
      const f=Math.min(h*0.62,w/(Math.max(1,c.l.length)*0.62),6);
      s=`<g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="1.5" class="${c.kw?'keyw':c.kg?'keyg':'keyo'}"/>${c.led?`<rect x="${x-w/2+1.5}" y="${y-h/2+1}" width="${w-3}" height="1.3" rx=".6" class="kled"/>`:''}<text x="${x}" y="${(y+f*0.36+(c.led?0.5:0)).toFixed(1)}" class="kt" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(c.l)}</text></g>`; break; }
    case 'lbtn': { const w=c.w, h=c.h, f=Math.min(h*0.3,w/(c.l1.length*0.6)); s=`<rect x="${x-w/2-2}" y="${y-h/2-2}" width="${w+4}" height="${h+4}" rx="3" class="lampb"/><g class="mv pb"><rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2" class="lk"/><text x="${x}" y="${y-h*0.1}" class="lkt lkt-w" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(c.l1)}</text><text x="${x-w*0.24}" y="${y+h*0.32}" class="lkt lkt-${c.ca} lba" font-size="${(f*0.95).toFixed(2)}" text-anchor="middle">${esc(c.a)}</text><text x="${x+w*0.24}" y="${y+h*0.32}" class="lkt lkt-${c.cb} lbb" font-size="${(f*0.95).toFixed(2)}" text-anchor="middle">${esc(c.b)}</text></g>`; break; }
    case 'gear': s=`<rect x="${x-11}" y="${y-37}" width="22" height="74" rx="6" class="slot"/><rect x="${x-6}" y="${y-30}" width="12" height="60" rx="2" class="slot2"/>${lab(x+22,y-24,'↑ UP',{s:5})}${lab(x+22,y+13,'↓ DN',{s:5})}<g class="mv gk"><rect x="${x-2.2}" y="${y-30}" width="4.4" height="30" class="rod"/><rect x="${x-10}" y="${y-44}" width="20" height="30" rx="7" class="wheelk"/>${[0,1,2,3,4,5].map(i=>`<path d="M${x-7+i*2.8} ${y-41}v24" class="wheelr"/>`).join('')}<ellipse class="gl gU" cx="${x}" cy="${y-36}" rx="4.5" ry="2.6"/></g>`; break;
    case 'flap': s=`<rect x="${x-8}" y="${y-36}" width="16" height="72" rx="7" class="slot"/>${c.vals.map((v,i)=>lab(x-15,y-30+i*30+2,v,{s:5,a:'end'})).join('')}<g class="mv fk"><rect x="${x-14}" y="${y-36}" width="28" height="12" rx="3" class="flapk"/><path d="M${x-10} ${y-30}h20" class="flapl"/></g>${lab(x,y+48,'FLAP',{s:7})}`; break;
    case 'cb': { const r=c.big?9:6.2, fs=c.fs||3.6; s=`<circle cx="${x}" cy="${y}" r="${r+1.6}" class="cbcol"/><g class="mv cbk"><circle cx="${x}" cy="${y}" r="${r}" class="cbh"/><circle cx="${x}" cy="${y}" r="${r*0.62}" class="cbh2"/>${c.amp?`<text x="${x}" y="${y+fs*0.4}" class="cbt" font-size="${c.big?5:fs*0.95}" text-anchor="middle">${esc(c.amp)}</text>`:''}</g>`;
      if(c.la) s+=labUp(x,y-r-2.6,c.la,{s:fs}); if(c.lb) s+=lab(x,y+r+fs+1.2,c.lb,{s:fs}); break; }
    case 'pull': { const r=c.r||11; s=c.tee?`<rect x="${x-4}" y="${y-8}" width="8" height="8" class="slot"/><g class="mv pk" style="transform-origin:${x}px ${y}px"><rect x="${x-14}" y="${y-2}" width="28" height="9" rx="4" class="tee"/><rect x="${x-2}" y="${y-7}" width="4" height="7" class="rod"/></g>`
        :`<circle cx="${x}" cy="${y}" r="${r+2}" class="ring0"/><circle cx="${x}" cy="${y}" r="${r+0.5}" class="pullring"/><g class="mv pk" style="transform-origin:${x}px ${y}px"><circle cx="${x}" cy="${y}" r="${r*0.82}" class="pullk"/><circle cx="${x}" cy="${y}" r="${r*0.32}" class="knobtop"/></g>`;
      if(c.top) s+=labUp(x,y-r-5,c.top,{s:4.4})+`<path d="M${x} ${y-r-4}v2.5" class="grpl"/>`; if(c.dn) s+=`<path d="M${x} ${y+r+1.5}v2.5" class="grpl"/>`+lab(x,y+r+8.5,c.dn,{s:4.4});
      if(D(c)) s+=lab(x,y+r+(c.s||4.6)+3,D(c),{s:c.s||4.6}); break; }
    case 'vwheel': s=`<rect x="${x-14}" y="${y-58}" width="28" height="116" rx="8" class="slot"/><svg x="${x-10}" y="${y-54}" width="20" height="108" overflow="hidden"><g class="mv wr">${Array.from({length:36},(_,i)=>`<rect x="0" y="${i*6-54}" width="20" height="3" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x+16} ${y}h7" class="tomark"/>${lab(x+18,y-6,'T/O',{s:4.6,a:'start'})}${lab(x,y-62,'DN',{s:4.6})}${lab(x,y+66,'UP',{s:4.6})}<path class="mv trind" d="M${x-24} ${y}l6-4v8z"/>`; break;
    case 'hwheel': s=`<rect x="${x-40}" y="${y-8}" width="80" height="16" rx="7" class="slot"/><svg x="${x-36}" y="${y-5}" width="72" height="10" overflow="hidden"><g class="mv wr">${Array.from({length:26},(_,i)=>`<rect y="0" x="${i*6-42}" width="3" height="10" rx="1" class="ridge"/>`).join('')}</g></svg><path d="M${x} ${y-10}v-5" class="tomark"/><path class="mv trind" d="M${x} ${y+10}l-4 6h8z"/>${lab(x-44,y+2,'L',{s:5,a:'end'})}${lab(x+44,y+2,'R',{s:5,a:'start'})}${lab(x,y+24,'RUDDER TRIM',{s:4.4})}`; break;
    case 'lev': { const L=c.len, ly=v=>y+(c.max-v)/(c.max-c.min)*L; const hw=c.kind==='pwr'?14:11;
      const knob=c.kind==='pwr'?`<path d="M${x-hw} ${y-6}q0-7 7-7h${2*hw-14}q7 0 7 7v6q0 6-6 6h-${2*hw-12}q-6 0-6-6z" class="lever"/><path d="M${x-hw+5} ${y-5}h${2*hw-10}M${x-hw+5} ${y-1}h${2*hw-10}M${x-hw+5} ${y+3}h${2*hw-10}" class="grip"/>`
        :c.kind==='prop'?`<rect x="${x-hw}" y="${y-9}" width="${2*hw}" height="16" rx="3" class="levP"/><path d="M${x-hw+4} ${y-4}h${2*hw-8}M${x-hw+4} ${y}h${2*hw-8}" class="gripP"/>`
        :`<path d="M${x-hw} ${y-6}q0-4 4-4h${2*hw-8}q4 0 4 4v9h-${2*hw}z" class="levC"/><path d="M${x-hw+3} ${y-1}h${2*hw-6}" class="gripP"/>`;
      s=`<rect x="${x-5}" y="${y-10}" width="10" height="${L+20}" rx="4" class="slot"/>${c.mk?c.marks.map(([v,t])=>`<path d="M${x-20} ${ly(v)}h8" class="tick"/>${lab(x-22,ly(v)+1.6,t,{s:4.2,a:'end'})}`).join(''):''}<g class="mv lv"><rect x="${x-2.2}" y="${y}" width="4.4" height="14" class="rod"/>${knob}</g>${lab(x,y+L+18,c.l.slice(-1),{s:5.4})}`; break; }
    case 'yoke': { const X=x, R=56, sh=c.co?-1:1; let bolts=''; for(let k=0;k<8;k++){ const [bx,by]=pol(X,y,R*0.8,k*45+22.5); bolts+=`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.4" class="ykb"/>`; }
      s=`<path d="M${X+sh*14} ${y-50}L${X+sh*70} ${y-96}L${X+sh*104} ${y-62}L${X+sh*48} ${y+8}Z" class="ykshaft"/><ellipse cx="${X+sh*87}" cy="${y-79}" rx="24" ry="28" transform="rotate(${sh*-42} ${X+sh*87} ${y-79})" class="ykshaft2"/><g class="mv skg" style="transform-origin:${X}px ${y}px"><circle cx="${X}" cy="${y}" r="${R+4}" class="ykrim"/><circle cx="${X}" cy="${y}" r="${R}" class="ykf"/>${bolts}<path d="M${X-33} ${y-33}L${X+33} ${y+33}M${X+33} ${y-33}L${X-33} ${y+33}" class="ykx"/><rect x="${X-22}" y="${y-22}" width="44" height="44" rx="6" class="ykp"/><circle cx="${X}" cy="${y}" r="14" class="ykh"/><circle cx="${X}" cy="${y}" r="5" class="ykb"/></g>`; break; }
    case 'sbtn': { const r=c.r||5; s=`<g class="mv sbm" style="transform-origin:${x}px ${y}px"><circle cx="${x+c.dx}" cy="${y+c.dy}" r="${r}" fill="${c.col}" stroke="#000"/></g>`; break; }
  }
  const role=({tog:'switch',guard:'switch',push:'button',bar:'button',mbtn:'button',abtn:'button',key:'button',lbtn:'button',cb:'switch',pull:'switch',gear:'switch',sbtn:'button',yoke:'application'})[c.t]||'slider';
  if(c.rot) s=`<g transform="rotate(${c.rot} ${x} ${y})">${s}</g>`;
  if(c.mt) s=`<g transform="${c.mt}">${s}</g>`;
  return `<g class="ctl t-${c.t}${c.dk?' dk':''}${c.soft?' soft':''}" data-id="${c.id}" tabindex="0" role="${role}" aria-label="${esc(c.lbl||c.l)}">${s}</g>`;
}

/* ---------- round gauges ---------- */
const GA={};
function dial(id,x,y,r,o){
  GA[id]={x,y,r,sc:o.sc};
  let t=o.bz==='none'?`<circle cx="${x}" cy="${y}" r="${r}" class="dial"/>`:`${o.ears?[-1,1].map(k=>`<circle cx="${x+k*r*0.92}" cy="${y-r*0.82}" r="${r*0.2}" class="ear"/>`).join(''):''}<circle cx="${x}" cy="${y}" r="${r+6}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r+2.5}" class="sbz2"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>`;
  o.sc.forEach(sc=>{ const A=v=>angOf(sc,v);
    (sc.arcs||[]).forEach(([a,b,cls])=>{ const rr=r-2.5; const [x0,y0]=pol(x,y,rr,A(a)), [x1,y1]=pol(x,y,rr,A(b)); const big=Math.abs(A(b)-A(a))>180?1:0, sw=A(b)>A(a)?1:0; t+=`<path d="M${x0} ${y0}A${rr} ${rr} 0 ${big} ${sw} ${x1} ${y1}" class="${cls}" style="stroke-width:${Math.max(2.5,r*0.08)}px"/>`; });
    if(sc.mnr) for(let v=sc.min; v<=sc.max+1e-6; v+=sc.mnr){ const a=A(v); const maj=sc.maj&&Math.abs(v/sc.maj-Math.round(v/sc.maj))<1e-6; const L=maj?r*0.16:r*0.08; const [a0,b0]=pol(x,y,r,a), [a1,b1]=pol(x,y,r-L,a); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="dtick" style="stroke-width:${maj?1.3:0.8}px"/>`;
      if(maj&&sc.lab){ const s=sc.lab(v); if(s!==null&&s!==undefined){ const [lx,ly]=pol(x,y,r*(sc.lr||0.68),a); t+=`<text x="${lx}" y="${ly+r*0.07}" class="dnum" font-size="${(sc.fs||0.19)*r}" text-anchor="middle">${s}</text>`; } } }
    (sc.red||[]).forEach(v=>{ const [a0,b0]=pol(x,y,r,A(v)), [a1,b1]=pol(x,y,r-r*0.22,A(v)); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="redl" style="stroke-width:${Math.max(2,r*0.06)}px"/>`; });
    (sc.dash||[]).forEach(v=>{ const [a0,b0]=pol(x,y,r,A(v)), [a1,b1]=pol(x,y,r-r*0.22,A(v)); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" class="redl" stroke-dasharray="2 1.5" style="stroke-width:${Math.max(2,r*0.06)}px"/>`; });
  });
  if(o.title) t+=lab0(x,y+r*(o.ty||0.42),o.title,r*(o.tfs||0.15),o.tc);
  if(o.unit) t+=lab0(x,y+r*(o.uy||0.6),o.unit,r*(o.ufs||0.12),o.tc);
  if(o.dig) t+=`<rect x="${x-r*0.36}" y="${y-r*0.84}" width="${r*0.72}" height="${r*0.27}" rx="1.5" class="digw"/><text class="dig dg-${id}" x="${x}" y="${y-r*0.63}" font-size="${r*0.21}" text-anchor="middle">0</text>`;
  if(o.extra) t+=o.extra;
  o.sc.forEach(sc=>{ if(sc.nond) return; const L=sc.nl||r-5; t+=`<g class="nd nd-${id}${sc.nd||''}" style="transform-origin:${x}px ${y}px;transform:rotate(${angOf(sc,sc.min)}deg)"><path d="M${x-r*0.035} ${y+r*0.12}L${x-r*0.02} ${y-L+4}L${x} ${y-L}L${x+r*0.02} ${y-L+4}L${x+r*0.035} ${y+r*0.12}z" class="needle ${sc.ncls||''}"/></g>`; });
  t+=`<circle cx="${x}" cy="${y}" r="${o.hub||r*0.07}" class="hub"/>`;
  return `<g class="gauge" data-g="${id}">${t}</g>`;
}
function lab0(x,y,t,fs,cls){ return String(t).split('\n').map((ln,i)=>`<text x="${x}" y="${y+i*fs*1.15}" class="dnum dt ${cls||''}" font-size="${fs}" text-anchor="middle">${esc(ln)}</text>`).join(''); }
function angOf(sc,v){ const f=sc.f?sc.f(v):(clamp(v,sc.min,sc.max)-sc.min)/(sc.max-sc.min); return sc.a0+f*(sc.a1-sc.a0); }

/* ASI: non-linear, 40 → 300 kt, with VMO pointer */
const asiF=v=>{ v=clamp(v,40,300); return v<=160?(v-40)/120*0.55:0.55+(v-160)/140*0.45; };
function asi(id,x,y,r){ const sc={min:40,max:300,a0:10,a1:345,f:asiF}; const vmo=angOf(sc,259);
  return dial(id,x,y,r,{ears:1,sc:[{min:40,max:300,a0:10,a1:345,f:asiF,maj:20,mnr:10,lab:v=>(v<=160&&v%20===0&&v>=80)||v===200||v===240||v===280?v:null,fs:0.15,lr:0.7,
  arcs:[[75,157,'awhite'],[99,259,'agreen']],red:[86]}],title:'KNOTS',ty:-0.26,tfs:0.13,
  extra:(()=>{ const b=angOf(sc,121); const [a0,b0]=pol(x,y,r,b),[a1,b1]=pol(x,y,r-r*0.22,b); const [v0,v1]=pol(x,y,r*0.1,vmo), [v2,v3]=pol(x,y,r*0.9,vmo);
    return `<path d="M${a0} ${b0}L${a1} ${b1}" class="bluel" style="stroke-width:${r*0.06}px"/><path d="M${v0} ${v1}L${v2} ${v3}" class="barber" style="stroke-width:${r*0.07}px"/><path d="M${v0} ${v1}L${v2} ${v3}" class="barber2" style="stroke-width:${r*0.07}px"/>`; })()}); }
/* drum-pointer altimeter: one 100-ft pointer, drum counter for thousands, pressure window */
function alt(id,x,y,r,o){ o=o||{}; const sc={min:0,max:1000,a0:0,a1:360,maj:100,mnr:20,lab:v=>v<1000?v/100:null,fs:0.24,lr:0.7,nd:'0',nl:r-5};
  return dial(id,x,y,r,{bz:o.bz,sc:[sc],title:'ALT',ty:-0.42,tfs:0.12,hub:r*0.1,extra:`<rect x="${x-r*0.62}" y="${y-r*0.24}" width="${r*1.02}" height="${r*0.34}" rx="1.5" class="drumw"/><text class="dig2 drm-${id}" x="${x+r*0.36}" y="${y+r*0.04}" font-size="${r*0.27}" text-anchor="end">0,000</text><rect x="${x-r*0.3}" y="${y+r*0.32}" width="${r*0.6}" height="${r*0.2}" rx="1" class="drumw"/><text class="dig2 kol-${id}" x="${x}" y="${y+r*0.47}" font-size="${r*0.16}" text-anchor="middle">29.92</text><text class="hflag altflag-${id}" x="${x}" y="${y-r*0.5}" fill="#ffcf3a" font-size="${r*0.11}" font-weight="700" text-anchor="middle" style="opacity:0">ALT STATIC</text><text class="hflag alttest-${id}" x="${x-r*0.2}" y="${y-r*0.3}" fill="#ff3b2b" font-size="${r*0.13}" font-weight="700" text-anchor="middle" style="opacity:0">TEST</text>`}); }
const vsiF=v=>{ const a=Math.min(1,Math.pow(Math.abs(v)/6000,0.62)); return 0.5+Math.sign(v)*a*0.5; };
function vsi(id,x,y,r){ return dial(id,x,y,r,{bz:'none',sc:[{min:-6000,max:6000,a0:-90-165,a1:-90+165,f:vsiF,maj:1000,mnr:500,lab:v=>[0,1000,2000,4000,6000,-1000,-2000,-4000].includes(v)?(Math.abs(v)===500?'.5':Math.abs(v)/1000):null,fs:0.2,lr:0.72}],title:'VERT SPEED',unit:'X1000 FPM',ty:-0.16,uy:0.28,tfs:0.13,ufs:0.13,tc:'cy',
  extra:`<rect x="${x-r*0.98}" y="${y-r*1.02}" width="${r*0.42}" height="${r*0.2}" class="tcasTag"/><text x="${x-r*0.77}" y="${y-r*0.87}" font-size="${r*0.15}" class="tcasT" text-anchor="middle">TCAS</text><g class="tcasoff-${id}"><rect x="${x+r*0.5}" y="${y-r*1.04}" width="${r*0.48}" height="${r*0.36}" class="tcasOff"/><text x="${x+r*0.74}" y="${y-r*0.88}" font-size="${r*0.14}" fill="#fff" text-anchor="middle">TCAS</text><text x="${x+r*0.74}" y="${y-r*0.73}" font-size="${r*0.14}" fill="#fff" text-anchor="middle">OFF</text></g><text class="tcasm-${id}" x="${x}" y="${y+r*0.55}" font-size="${r*0.12}" fill="#3fd8ff" text-anchor="middle"></text>`}); }
function adi(id,x,y,r,fd){
  const clip='ac-'+id; let lad=''; for(let p=-30;p<=30;p+=5){ if(!p) continue; const w=p%10?r*0.16:r*0.32; lad+=`<path d="M${x-w/2} ${y-p*r*0.04}h${w}" stroke="#fff" stroke-width="1.1"/>${p%10?'':`<text x="${x+w/2+3}" y="${y-p*r*0.04+3}" fill="#fff" font-size="${r*0.09}">${Math.abs(p)}</text>`}`; }
  let bank=''; [-60,-45,-30,-20,-10,10,20,30,45,60].forEach(b=>{ const [a0,b0]=pol(x,y,r,b), [a1,b1]=pol(x,y,r-(Math.abs(b)%30===0?r*0.16:r*0.09),b); bank+=`<path d="M${a0} ${b0}L${a1} ${b1}" stroke="#fff" stroke-width="${Math.abs(b)%30===0?2.6:1.6}"/>`; });
  return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+9}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r+3}" class="sbz2"/><clipPath id="${clip}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><g clip-path="url(#${clip})"><g class="att att-${id}" style="transform-origin:${x}px ${y}px"><g class="attp attp-${id}"><rect x="${x-r*3}" y="${y-r*3}" width="${r*6}" height="${r*3}" fill="#7d93b8"/><rect x="${x-r*3}" y="${y}" width="${r*6}" height="${r*3}" fill="#2b2829"/><path d="M${x-r*3} ${y}h${r*6}" stroke="#fff" stroke-width="1.8"/>${lad}</g></g><path d="M${x-r} ${y+r*0.62}h${r*2}V${y+r}H${x-r}z" fill="#2b2829"/></g>${bank}<path d="M${x} ${y-r+1}l-6 -2 6 11 6 -11z" fill="#ffcf3a"/>
   ${fd?`<g class="fdb fdb-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-r*0.62} ${y+r*0.2}L${x} ${y}L${x+r*0.62} ${y+r*0.2}" class="fdv"/></g>`:''}
   <path d="M${x-r*0.6} ${y}h${r*0.42}l${r*0.18} ${r*0.12}l${r*0.18} -${r*0.12}h${r*0.42}" class="acw"/><circle cx="${x}" cy="${y}" r="2" fill="#fff"/>
   <text x="${x}" y="${y+r*0.78}" class="dnum" font-size="${r*0.13}" text-anchor="middle">AIR</text>
   <circle cx="${x}" cy="${y+r+4}" r="${r*0.2}" class="knob"/><circle class="ball ball-${id}" cx="${x}" cy="${y+r*2}" r="0.1" fill="none" style="transform-origin:${x}px ${y}px"/></g>`;
}
function card(x,y,r,cls,o){ o=o||{}; let t=''; for(let d=0;d<360;d+=5){ const L=d%30===0?r*0.14:d%10===0?r*0.1:r*0.06; const [a0,b0]=pol(x,y,r,d),[a1,b1]=pol(x,y,r-L,d); t+=`<path d="M${a0} ${b0}L${a1} ${b1}" stroke="${o.col||'#eee'}" stroke-width="${d%10?0.7:1.2}"/>`; if(d%30===0){ const [lx,ly]=pol(x,y,r*0.74,d); const s={0:'N',90:'E',180:'S',270:'W'}[d]||d/10; t+=`<text x="${lx}" y="${ly+r*0.06}" fill="${o.col||'#eee'}" font-size="${r*(d%90?0.14:0.17)}" font-weight="700" text-anchor="middle" transform="rotate(${d} ${lx} ${ly})">${s}</text>`; } } return `<g class="${cls}" style="transform-origin:${x}px ${y}px">${t}</g>`; }
function hsi(id,x,y,r){ return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-2,'hcard hcard-'+id)}
  <g class="hbug hbug-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-5} ${y-r+1}h10v5l-2.5 0-2.5 3.5-2.5-3.5-2.5 0z" fill="#ff8a00"/></g>
  <g class="hcrs hcrs-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y-r*0.82}l-4 8h2.6v${r*0.3}h2.8v-${r*0.3}h2.6z M${x-1.4} ${y+r*0.42}h2.8v${r*0.38}h-2.8z" fill="#2ce36a"/>${[-2,-1,1,2].map(k=>`<circle cx="${x+k*r*0.17}" cy="${y}" r="1.8" fill="none" stroke="#fff" stroke-width="1"/>`).join('')}<g class="hdev hdev-${id}"><rect x="${x-1.4}" y="${y-r*0.36}" width="2.8" height="${r*0.72}" fill="#2ce36a"/></g><path class="htf htf-${id}" d="M${x} ${y-r*0.5}l-4 6h8z" fill="#2ce36a"/></g>
  <path d="M${x-r*0.24} ${y}h${r*0.48}M${x} ${y-r*0.16}v${r*0.32}M${x-r*0.1} ${y+r*0.14}h${r*0.2}" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M${x} ${y-r-1}l-3.5 -5h7z" fill="none" stroke="#fff" stroke-width="1.2"/>${[90,270].map(d=>{ const [a,b]=pol(x,y,r+2,d); const [e,f]=pol(x,y,r+10,d); return `<path d="M${a} ${b}L${e} ${f}" stroke="#fff" stroke-width="1.8"/>`; }).join('')}<path d="M${x} ${y+r+2}v8" stroke="#fff" stroke-width="1.8"/>
  <g class="hgs hgs-${id}"><path d="M${x+r+1} ${y}l-6 -4v8z" fill="#2ce36a"/></g><text class="hflag hflag-${id}" x="${x-r*0.5}" y="${y-r*0.35}" fill="#ff3b2b" font-size="${r*0.12}" font-weight="700">NAV</text><text class="hflag hhdg-${id}" x="${x+r*0.22}" y="${y-r*0.35}" fill="#ff3b2b" font-size="${r*0.12}" font-weight="700" style="opacity:0">HDG</text></g>`; }
function rmi(id,x,y,r){ return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${card(x,y,r-2,'rcard rcard-'+id)}
  <g class="rn2 rn2-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x} ${y-r*0.82}l-3.5 7h7z M${x-1} ${y-r*0.7}h2v${r*1.48}h-2z" fill="#ffd400"/></g>
  <g class="rn1 rn1-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-3} ${y+r*0.76}v-${r*1.3}l-3 0 6 -${r*0.24} 6 ${r*0.24}-3 0v${r*1.3}" fill="none" stroke="#2ce36a" stroke-width="1.6"/></g>
  <path d="M${x} ${y-r-1}l-4 -5h8z" fill="#ff5a1f"/><circle cx="${x}" cy="${y}" r="3" class="hub"/></g>`; }
function ts(id,x,y,r){ return `<g class="gauge"><circle cx="${x-r*0.78}" cy="${y-r*0.82}" r="${r*0.2}" class="ear"/><circle cx="${x+r*0.78}" cy="${y-r*0.82}" r="${r*0.2}" class="ear"/><circle cx="${x}" cy="${y}" r="${r+5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>
  <text x="${x-r*0.55}" y="${y-r*0.3}" class="dnum" font-size="${r*0.2}">L</text><text x="${x+r*0.4}" y="${y-r*0.3}" class="dnum" font-size="${r*0.2}">R</text>
  <g class="tcp tcp-${id}" style="transform-origin:${x}px ${y+r*0.2}px"><path d="M${x-r*0.08} ${y+r*0.12}L${x-r*0.04} ${y-r*0.62}L${x} ${y-r*0.8}L${x+r*0.04} ${y-r*0.62}L${x+r*0.08} ${y+r*0.12}z" fill="#fff"/></g>
  <path d="M${x-r*0.5} ${y+r*0.12}h${r*0.34}v${r*0.32}h-${r*0.34}z M${x+r*0.16} ${y+r*0.12}h${r*0.34}v${r*0.32}h-${r*0.34}z" fill="#f2f2f2"/><rect x="${x-r*0.12}" y="${y+r*0.14}" width="${r*0.24}" height="${r*0.26}" fill="none" stroke="#f2f2f2" stroke-width="1.2"/>
  <circle class="ball ball-${id}" cx="${x}" cy="${y+r*0.28}" r="${r*0.09}" fill="#111" stroke="#666" stroke-width=".6"/>
  <text x="${x}" y="${y+r*0.8}" class="dnum" font-size="${r*0.22}" text-anchor="middle">DC</text><text class="hflag tsflag-${id}" x="${x+r*0.38}" y="${y+r*0.8}" fill="#ff3b2b" font-size="${r*0.16}" font-weight="700" style="opacity:0">OFF</text></g>`; }
function synchro(x,y,r){ let p=''; for(let i=0;i<4;i++){ const a0=i*90, [x0,y0]=pol(x,y,r*0.92,a0-22), [x1,y1]=pol(x,y,r*0.92,a0+22); p+=`<path d="M${x} ${y}L${x0} ${y0}A${r*0.92} ${r*0.92} 0 0 1 ${x1} ${y1}z" fill="#f2f2f2"/>`; }
  return `<g class="gauge"><circle cx="${x+r*0.75}" cy="${y-r*0.85}" r="${r*0.42}" class="knob"/><circle cx="${x}" cy="${y}" r="${r+2.5}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" fill="#111"/><g class="syn" style="transform-origin:${x}px ${y}px">${p}</g><circle cx="${x}" cy="${y}" r="${r*0.14}" class="hub"/></g>`; }
/* DME indicator in an octagonal case */
function dme(id,cx,cy,w,h,big){ const x=cx-w/2, y=cy-h/2; return `${ocase(cx,cy,w,h,12)}<text class="dig dm-${id}a" x="${cx-6}" y="${y+h*0.42}" font-size="${big?15:13}" text-anchor="end">---.-</text><text class="dig dm-${id}b" x="${cx+2}" y="${y+h*0.42}" font-size="${big?15:13}" text-anchor="start"></text><text class="digy dm-${id}c" x="${x+w*0.22}" y="${y+h*0.66}" font-size="5" text-anchor="middle"></text><text class="digy dm-${id}u" x="${cx}" y="${y+h*0.66}" font-size="5" text-anchor="middle"></text>`; }
/* gyro slaving meter in an octagonal case */
function slaving(n,cx,cy,w,h){ return `${ocase(cx,cy,w,h,13)}<path d="M${cx-19} ${cy-24}h38l5 7-5 7h-38l-5-7z" fill="#f2f2f2"/><text x="${cx}" y="${cy-18}" font-size="4.4" fill="#111" font-weight="700" text-anchor="middle">GYRO</text><text x="${cx}" y="${cy-13.4}" font-size="4.4" fill="#111" font-weight="700" text-anchor="middle">SLAVING</text><text x="${cx-17}" y="${cy-15}" font-size="7" fill="#111" font-weight="700" text-anchor="middle">-</text><text x="${cx+17}" y="${cy-15}" font-size="7" fill="#111" font-weight="700" text-anchor="middle">+</text><g class="slv slv-${n}" style="transform-origin:${cx}px ${cy-4}px"><path d="M${cx} ${cy-6}v-19" stroke="#111" stroke-width="1.4"/></g>${lab(cx-12,cy+5,'SLEW',{s:4})}${lab(cx+19,cy+5,'MODE',{s:4})}`; }

/* ---------- electronic attitude director (EADI) ---------- */
const EA={x0:357,y0:452,w:150,h:130}; EA.cx=EA.x0+EA.w/2; EA.cy=EA.y0+EA.h*0.47; EA.k=2.5;
function eadiSVG(){ const {x0,y0,w,h,cx,cy,k}=EA; let lad='';
  for(let p=-30;p<=30;p+=2.5){ if(!p) continue; const m=p%10===0, f=p%5===0, ww=m?30:f?16:7; lad+=`<path d="M${cx-ww/2} ${cy-p*k}h${ww}" stroke="#fff" stroke-width="${m?1.3:1}"/>${m?`<text x="${cx+ww/2+3}" y="${cy-p*k+3}" font-size="8" fill="#fff" font-weight="600">${Math.abs(p)}</text><text x="${cx-ww/2-3}" y="${cy-p*k+3}" font-size="8" fill="#fff" font-weight="600" text-anchor="end">${Math.abs(p)}</text>`:''}`; }
  let arc=''; [-60,-45,-30,-20,-10,10,20,30,45,60].forEach(b=>{ const R=50; const [a0,b0]=pol(cx,cy,R,b), [a1,b1]=pol(cx,cy,R+(Math.abs(b)%30===0?8:5),b); arc+=Math.abs(b)===45?`<path d="M${a0} ${b0}l0 0" />${(()=>{ const [t0,t1]=pol(cx,cy,R+5,b); return `<path d="M${t0} ${t1}l-3 -5h6z" fill="none" stroke="#fff" stroke-width="1.2" transform="rotate(${b} ${t0} ${t1})"/>`; })()}`:`<path d="M${a0} ${b0}L${a1} ${b1}" stroke="#fff" stroke-width="${Math.abs(b)%30===0?2:1.3}"/>`; });
  const gsx=x0+w-12, spx=x0+10;
  return `<g class="efis ea-dim"><clipPath id="cEadi"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="13"/></clipPath><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="13" fill="#000"/>
  <g clip-path="url(#cEadi)"><g class="ea-att" style="transform-origin:${cx}px ${cy}px"><g class="ea-pit"><rect x="${cx-260}" y="${cy-260}" width="520" height="260" fill="#2f86e0"/><rect x="${cx-260}" y="${cy}" width="520" height="260" fill="#b0662a"/><path d="M${cx-260} ${cy}h520" stroke="#fff" stroke-width="1.4"/>${lad}</g><path d="M${cx} ${cy-50}l-5 8h10z" fill="#fff"/></g>
   <g class="ea-rwy"><path d="M${cx-9} ${y0+h-30}h18l7 22h-32z" fill="none" stroke="#ffe600" stroke-width="1.6"/><path d="M${cx} ${y0+h-28}v18" stroke="#ffe600" stroke-width="1"/></g></g>
  ${arc}<path d="M${cx} ${cy-50}l-5 -8h10z" fill="none" stroke="#ffe600" stroke-width="1.4"/>
  <g class="ea-fd" style="transform-origin:${cx}px ${cy}px"><path d="M${cx-46} ${cy+16}L${cx} ${cy-1}L${cx+46} ${cy+16}l-2 4L${cx} ${cy+6}L${cx-44} ${cy+20}z" fill="none" stroke="#ff3cf0" stroke-width="1.6"/></g>
  <path d="M${cx-40} ${cy+12}L${cx} ${cy}L${cx+40} ${cy+12}L${cx+30} ${cy+13}L${cx} ${cy+6}L${cx-30} ${cy+13}z" fill="#111" stroke="#ffe600" stroke-width="1.6"/>
  <rect x="${cx-59}" y="${cy-3}" width="9" height="6" fill="#111" stroke="#ffe600" stroke-width="1.2"/><rect x="${cx+50}" y="${cy-3}" width="9" height="6" fill="#111" stroke="#ffe600" stroke-width="1.2"/>
  ${[-2,-1,1,2].map(i=>`<circle cx="${gsx}" cy="${cy+i*12}" r="2.2" fill="none" stroke="#fff" stroke-width="1"/>`).join('')}<path d="M${gsx-5} ${cy}h10" stroke="#fff" stroke-width="1"/><g class="ea-gs"><path d="M${gsx} ${cy-5}l5 5-5 5-5-5z" fill="#111" stroke="#2ce36a" stroke-width="1.4"/></g>
  <g class="ea-spdg">${[-1,1].map(i=>`<circle cx="${spx}" cy="${cy+i*14}" r="2" fill="none" stroke="#fff" stroke-width="1"/>`).join('')}<g class="ea-spd"><rect x="${spx-4}" y="${cy-6}" width="8" height="12" fill="#111" stroke="#2ce36a" stroke-width="1.3"/></g></g>
  <text class="ea-lat" x="${x0+12}" y="${y0+11}" font-size="7" fill="#2ce36a" font-weight="700" text-anchor="start"></text><text class="ea-vert" x="${x0+w-12}" y="${y0+11}" font-size="7" fill="#2ce36a" font-weight="700" text-anchor="end"></text>
  <text class="ea-latA" x="${x0+30}" y="${cy-5}" font-size="6.6" fill="#fff" font-weight="700" text-anchor="middle"></text><text class="ea-vertA" x="${x0+w-30}" y="${cy-5}" font-size="6.6" fill="#fff" font-weight="700" text-anchor="middle"></text>
  <text class="ea-ap" x="${x0+10}" y="${y0+24}" font-size="6.6" fill="#2ce36a" font-weight="700"></text>
  <g class="ea-mkrg"><rect x="${x0+w-34}" y="${y0+26}" width="18" height="11" fill="#000" stroke="#fff" stroke-width=".8"/><text class="ea-mkr" x="${x0+w-25}" y="${y0+34.5}" font-size="7.5" font-weight="700" text-anchor="middle" fill="#fff"></text></g>
  <text class="ea-ra" x="${x0+w-12}" y="${y0+h-18}" font-size="10" fill="#ffe600" font-weight="700" text-anchor="end"></text><text class="ea-dh" x="${x0+w-12}" y="${y0+h-6}" font-size="7.5" fill="#fff" font-weight="700" text-anchor="end">DH 500</text>
  <text class="ea-dhA" x="${x0+30}" y="${y0+h-10}" font-size="9" fill="#ffb000" font-weight="700" text-anchor="middle"></text>
  <rect x="${cx-11}" y="${y0+h-11}" width="22" height="6" rx="3" fill="none" stroke="#fff" stroke-width=".8"/><circle class="ea-ball" cx="${cx}" cy="${y0+h-8}" r="2.4" fill="#fff"/>
  <g class="ea-off" style="opacity:0"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="13" fill="#000"/></g></g>`; }
/* ---------- electronic horizontal situation indicator (EHSI) ---------- */
const EH={x0:347,y0:634,w:170,h:150}; EH.cx=EH.x0+EH.w/2; EH.cy=EH.y0+EH.h*0.52; EH.R=52;
function ehsiSVG(){ const {x0,y0,w,h,cx,cy,R}=EH; const gsx=x0+w-12;
  const rose=`${card(cx,cy,R,'eh-card',{col:'#f2f2f2'})}
   <g class="eh-bug" style="transform-origin:${cx}px ${cy}px"><path d="M${cx-6} ${cy-R-2}h12v-5h-3l-3 4-3-4h-3z" fill="#ff3cf0"/></g>
   <g class="eh-b2" style="transform-origin:${cx}px ${cy}px"><path d="M${cx-2.5} ${cy-R+20}V${cy-R+9}l2.5-5 2.5 5V${cy-R+20}M${cx-2.5} ${cy+R-3}V${cy+R-16}h5V${cy+R-3}" fill="none" stroke="#3fd8ff" stroke-width="1.3"/></g>
   <g class="eh-b1" style="transform-origin:${cx}px ${cy}px"><path d="M${cx} ${cy-R+20}V${cy-R+3}M${cx-4} ${cy-R+10}L${cx} ${cy-R+3}L${cx+4} ${cy-R+10}M${cx} ${cy+R-3}V${cy+R-18}M${cx-4} ${cy+R-12}L${cx} ${cy+R-18}L${cx+4} ${cy+R-12}" fill="none" stroke="#ff3cf0" stroke-width="1.5"/></g>
   <g class="eh-crs" style="transform-origin:${cx}px ${cy}px"><path d="M${cx} ${cy-R+3}l-3.5 8h7z" fill="none" stroke="#2ce36a" stroke-width="1.1"/><path d="M${cx} ${cy-R+11}V${cy-R*0.4}M${cx} ${cy+R*0.4}V${cy+R+6}" stroke="#2ce36a" stroke-width="1.1"/>${[-2,-1,1,2].map(i=>`<circle cx="${cx+i*R*0.25}" cy="${cy}" r="2.2" fill="none" stroke="#fff" stroke-width="1"/>`).join('')}<g class="eh-dev"><path d="M${cx} ${cy-R*0.38}V${cy+R*0.38}" stroke="#2ce36a" stroke-width="1.3"/></g><path class="eh-tf" style="transform-origin:${cx}px ${cy}px" d="M${cx} ${cy-R*0.6}l-5 7h10z" fill="#2ce36a"/></g>`;
  return `<g class="efis eh-dim"><clipPath id="cEhsi"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="11"/></clipPath><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="11" fill="#000"/>
  <g clip-path="url(#cEhsi)"><g class="eh-rose" style="transform-origin:${cx}px ${cy}px">${rose}</g></g>
  <path d="M${cx} ${cy-R+0.5}l-4 -7h8z" fill="none" stroke="#fff" stroke-width="1.2"/>${[45,135,225,315].map(d=>{ const [a,b]=pol(cx,cy,R+4,d); return `<path d="M${a} ${b}l-3 -5h6z" fill="none" stroke="#fff" stroke-width="1" transform="rotate(${d} ${a} ${b})"/>`; }).join('')}
  <path d="M${cx-13} ${cy}h26M${cx} ${cy-9}v20M${cx-5} ${cy+8}h10" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  ${[-2,-1,1,2].map(i=>`<circle cx="${gsx}" cy="${cy+i*12}" r="2" fill="none" stroke="#fff" stroke-width="1"/>`).join('')}<g class="eh-gsg"><path class="eh-gs" d="M${gsx+5} ${cy}l-8 -5v10z" fill="#2ce36a"/></g>
  <text x="${x0+28}" y="${y0+14}" font-size="8.5" fill="#2ce36a" font-weight="700" text-anchor="middle">DIST</text><text class="eh-dist" x="${x0+28}" y="${y0+25}" font-size="8.5" fill="#2ce36a" font-weight="700" text-anchor="middle">----</text>
  <text x="${x0+w-24}" y="${y0+14}" font-size="8.5" fill="#2ce36a" font-weight="700" text-anchor="middle">ET</text><text class="eh-et" x="${x0+w-24}" y="${y0+25}" font-size="8.5" fill="#2ce36a" font-weight="700" text-anchor="middle">00:00</text>
  ${[0,1,2,3].map(i=>`<text class="eh-s${i}" x="${x0+10}" y="${cy-14+i*9}" font-size="8" fill="#2ce36a" font-weight="700" text-anchor="middle"></text>`).join('')}
  <text x="${x0+22}" y="${y0+h-19}" font-size="8" fill="#b24bd8" font-weight="700" text-anchor="middle">BRG</text><rect x="${x0+7}" y="${y0+h-16}" width="30" height="11" fill="none" stroke="#ff3b2b" stroke-width=".9" class="eh-brgbox"/><text class="eh-brg" x="${x0+22}" y="${y0+h-7.5}" font-size="7.5" fill="#ff3cf0" font-weight="700" text-anchor="middle"></text>
  <text x="${x0+w-22}" y="${y0+h-20}" font-size="8" fill="#2ce36a" font-weight="700" text-anchor="middle">CRS</text><text class="eh-crsv" x="${x0+w-22}" y="${y0+h-6}" font-size="11" fill="#2ce36a" font-weight="700" text-anchor="middle">360</text>
  <text class="eh-flag" x="${cx}" y="${cy+R*0.62}" font-size="7" fill="#ffb000" font-weight="700" text-anchor="middle"></text>
  <g class="eh-off" style="opacity:0"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="11" fill="#000"/></g></g>`; }
const cop=t=>t.replace(/\b(ea|eh)-/g,'$12-').replace(/cEadi|cEhsi/g,m=>m+'2');
/* ---------- centre multifunction / weather radar display ---------- */
const MF={x0:1024,y0:584,w:180,h:142}; MF.cx=MF.x0+MF.w/2-6; MF.cy=MF.y0+MF.h*0.6; MF.R=48;
function mfdSVG(){ const {x0,y0,w,h,cx,cy,R}=MF; let ticks=''; for(let d=0;d<360;d+=10){ const [a,b]=pol(cx,cy,R*1.42,d), [e,f]=pol(cx,cy,R*1.42-(d%30?3:6),d); ticks+=`<path d="M${a} ${b}L${e} ${f}" stroke="#3fd8ff" stroke-width=".8"/>`; }
  return `<g class="mf-all"><clipPath id="cMfd"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="6"/></clipPath><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="6" fill="#030406"/>
  <g clip-path="url(#cMfd)" class="mf-map">
   <g class="mf-wxg"></g>
   <g class="mf-test" style="opacity:0">${['#18b552','#f2c20f','#e3261b','#d23be0'].map((c,i)=>`<path d="M${pol(cx,cy,R*(0.35+i*0.22),-45).join(' ')}A${R*(0.35+i*0.22)} ${R*(0.35+i*0.22)} 0 0 1 ${pol(cx,cy,R*(0.35+i*0.22),45).join(' ')}" fill="none" stroke="${c}" stroke-width="${R*0.16}"/>`).join('')}</g>
   <circle cx="${cx}" cy="${cy}" r="${R*0.5}" fill="none" stroke="#3fd8ff" stroke-width=".8" stroke-dasharray="2 2"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#3fd8ff" stroke-width=".8" stroke-dasharray="2 2"/>
   <g class="mf-rose" style="transform-origin:${cx}px ${cy}px">${ticks}<text x="${cx}" y="${cy-R*1.42+12}" font-size="10" fill="#fff" font-weight="700" text-anchor="middle">N</text></g>
   <g class="mf-geo"><path class="mf-crs" d="M${cx} ${cy}L${cx} ${cy}" stroke="#ff9d2e" stroke-width="1.3"/><g class="mf-st1"><path d="M-4 0h8M0 -4v8" stroke="#2ce36a" stroke-width="1.4"/><circle r="3.4" fill="none" stroke="#2ce36a" stroke-width="1"/></g><g class="mf-st2"><rect x="-3.4" y="-3.4" width="6.8" height="6.8" fill="none" stroke="#ff9d2e" stroke-width="1.2" transform="rotate(30)"/></g><g class="mf-st3"><circle r="3" fill="none" stroke="#b24bd8" stroke-width="1.4"/><circle r="1" fill="#b24bd8"/></g></g>
   <path d="M${cx-6} ${cy-6}l12 12M${cx+6} ${cy-6}l-12 12" stroke="#fff" stroke-width="1.6"/>
   <text class="mf-r1" x="${cx+R*0.5+2}" y="${cy+4}" font-size="9" fill="#3fd8ff" font-weight="700">25</text><text class="mf-r2" x="${cx+R+2}" y="${cy+4}" font-size="9" fill="#3fd8ff" font-weight="700">50</text>
   <text class="mf-mode" x="${x0+14}" y="${y0+15}" font-size="10" fill="#3fd8ff" font-weight="700">OFF</text><text class="mf-nav" x="${x0+12}" y="${y0+29}" font-size="9.5" fill="#3fd8ff" font-weight="700">NAV</text>
   <text class="mf-hdg" x="${x0+w-34}" y="${y0+15}" font-size="9" fill="#fff" font-weight="700" text-anchor="end">MAG1 000</text><text class="mf-tilt" x="${x0+w-14}" y="${y0+15}" font-size="7.5" fill="#ff9d2e" font-weight="700" text-anchor="end">00</text><text class="mf-gain" x="${x0+w-14}" y="${y0+25}" font-size="7.5" fill="#ff9d2e" font-weight="700" text-anchor="end"></text>
   <text class="mf-b1" x="${x0+10}" y="${y0+h-18}" font-size="9" fill="#2ce36a" font-weight="700"></text><text class="mf-b2" x="${x0+10}" y="${y0+h-7}" font-size="9" fill="#ff5a47" font-weight="700"></text>
  </g>
  <g class="mf-txt" style="opacity:0"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="6" fill="#030406"/>${[0,1,2,3,4,5,6,7,8].map(i=>`<text class="mf-t${i}" x="${x0+10}" y="${y0+16+i*14}" font-size="8.6" fill="${i?'#2ce36a':'#3fd8ff'}" font-weight="700"></text>`).join('')}<rect class="mf-cur" x="${x0+6}" y="${y0+20}" width="${w-12}" height="13" fill="none" stroke="#fff" stroke-width=".9" style="opacity:0"/></g>
  ${[0,1,2,3].map(i=>`<text class="mf-lk${i}" x="${x0+w-3}" y="${y0+11+(i+1)*22}" font-size="7" fill="#fff" font-weight="700" text-anchor="end"></text>`).join('')}
  <g class="mf-off" style="opacity:0"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="6" fill="#000"/></g></g>`; }
/* ---------- navigator (GPS / COMM 1 / NAV 1): frequency column at the left of the screen, moving map by default ---------- */
const NV=PR(538,352,698,489), NS0=PR(568,366,676,452);
const GP={x0:NS0[0]+46,y0:NS0[1]+2,w:NS0[2]-48,h:NS0[3]-4}; GP.cx=GP.x0+GP.w/2; GP.cy=GP.y0+GP.h*0.7; GP.R=GP.h*0.52;
function gpsSVG(){ const {x0,y0,w,h,cx,cy,R}=GP, f='font-family="IBM Plex Mono,monospace" font-weight="600"';
  return `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#020503"/>
  <g class="gp-map"><clipPath id="cGpm"><rect x="${x0}" y="${y0}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#cGpm)">
   <path d="M${x0+8} ${y0+h-6}c18-10 26-30 46-34s30 8 52-6" stroke="#2f6fd0" stroke-width="5" fill="none" opacity=".45"/><path d="M${x0} ${y0+h*0.3}c30 6 50-2 80 4" stroke="#3a3a3a" stroke-width="1" fill="none"/>
   <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#9aa5ad" stroke-width=".7" stroke-dasharray="3 3"/>
   <path class="gp-rte" d="M0 0" stroke="#e9eef2" stroke-width="1.3" fill="none"/><path class="gp-leg" d="M0 0" stroke="#ff3cf0" stroke-width="2" fill="none"/>
   ${[0,1,2].map(i=>`<g class="gp-w${i}"><path d="M-3.5 0h7M0 -3.5v7" stroke="#3fd8ff" stroke-width="1.3"/><circle r="3" fill="none" stroke="#3fd8ff" stroke-width="1"/><text class="gp-wt${i}" x="5" y="-4" font-size="7" fill="#fff" ${f}></text></g>`).join('')}
   <path d="M${cx} ${cy-7}l4.5 11-4.5-3-4.5 3z" fill="#fff" stroke="#000" stroke-width=".6"/>
   <text class="gp-rng" x="${cx+R*0.72}" y="${cy-R*0.72}" font-size="6.5" fill="#9aa5ad" ${f}></text>
   <rect x="${x0}" y="${y0}" width="${w}" height="12" fill="#000" opacity=".75"/><rect x="${x0}" y="${y0+h-11}" width="${w}" height="11" fill="#000" opacity=".75"/>
   <text class="gp-m0" x="${x0+2}" y="${y0+9}" font-size="7" fill="#2ce36a" ${f}></text><text class="gp-m1" x="${x0+w-2}" y="${y0+9}" font-size="7" fill="#2ce36a" text-anchor="end" ${f}></text>
   <text class="gp-m2" x="${x0+2}" y="${y0+h-3}" font-size="7" fill="#2ce36a" ${f}></text><text class="gp-m3" x="${x0+w-2}" y="${y0+h-3}" font-size="7" fill="#2ce36a" text-anchor="end" ${f}></text>
  </g></g>
  <g class="gp-txt" style="opacity:0"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#020503"/><path d="M${x0+4} ${y0+52}h${w-8}M${x0+4} ${y0+h-17}h${w-8}" stroke="#2ce36a" stroke-width=".5"/>
  ${[0,1,2,3].map(i=>`<text class="gp-l${i}" x="${x0+3}" y="${y0+10+i*10.5}" font-size="7.4" fill="#2ce36a" ${f}></text><text class="gp-r${i}" x="${x0+3}" y="${y0+63+i*10.5}" font-size="7.4" fill="#3fd8ff" ${f}></text>`).join('')}
  <text class="gp-pl" x="${x0+3}" y="${y0+h-9}" font-size="6" fill="#fff" ${f}></text><text class="gp-pr" x="${x0+3}" y="${y0+h-2}" font-size="6" fill="#fff" ${f}></text>
  <rect class="gp-cl" x="${x0+1}" y="${y0+1.5}" width="${w-2}" height="10" fill="none" stroke="#2ce36a" stroke-width=".8" style="opacity:0"/><rect class="gp-cr" x="${x0+1}" y="${y0+54.5}" width="${w-2}" height="10" fill="none" stroke="#3fd8ff" stroke-width=".8" style="opacity:0"/></g>
  <g class="gp-off" style="opacity:0"><rect x="${x0-46}" y="${y0-2}" width="${w+48}" height="${h+4}" fill="#000"/></g>`; }
function navSVG(){ const [x,y,w,h]=NV, [sx,sy,sw,sh]=NS0, fx=sx+2, fw=42;
  return `<g class="dynu"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="nvu"/><rect x="${sx-3}" y="${sy-3}" width="${sw+6}" height="${sh+6}" rx="3" class="nvbz"/><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="#000"/>
  <rect x="${fx}" y="${sy+2}" width="${fw}" height="${sh-4}" fill="#cfd5d9"/><g class="nvf"><text x="${fx+2}" y="${sy+10}" font-size="5" class="nvl">COM</text><text class="dig rd-com1A" x="${fx+fw-2}" y="${sy+22}" font-size="9" text-anchor="end">---</text><text class="dig rd-com1S" x="${fx+fw-2}" y="${sy+33}" font-size="9" text-anchor="end"></text><text class="dig rda rd-com1N0" x="${fx+2}" y="${sy+41}" font-size="4.4"></text><text class="dig rd-com1N1" x="${fx+17}" y="${sy+41}" font-size="4.4">MEM</text><text class="dig rda rd-com1N2" x="${fx+30}" y="${sy+41}" font-size="4.4"></text>
  <path d="M${fx+2} ${sy+46}h${fw-4}" stroke="#7d868c" stroke-width=".6"/><text x="${fx+2}" y="${sy+55}" font-size="5" class="nvl">VLOC</text><text class="dig rd-nav1A" x="${fx+fw-2}" y="${sy+67}" font-size="9" text-anchor="end">---</text><text class="dig rd-nav1S" x="${fx+fw-2}" y="${sy+78}" font-size="9" text-anchor="end"></text><text class="dig rda rd-nav1N0" x="${fx+2}" y="${sy+86}" font-size="4.4"></text><text class="dig rd-nav1N1" x="${fx+17}" y="${sy+86}" font-size="4.4">MEM</text><text class="dig rda rd-nav1N2" x="${fx+30}" y="${sy+86}" font-size="4.4"></text></g>
  ${gpsSVG()}
  ${lab(PX(546),PY(361),'PWR',{s:2.8,a:'start'})}${lab(PX(546),PY(376),'VOL',{s:2.6,a:'start'})}${lab(PX(560),PY(398.5),'C⇆',{s:3,a:'start'})}${lab(PX(546),PY(404),'PWR',{s:2.8,a:'start'})}${lab(PX(546),PY(419),'VOL',{s:2.6,a:'start'})}${lab(PX(560),PY(441.5),'V⇆',{s:3,a:'start'})}
  ${lab(PX(689),PY(359.5),'PWR',{s:2.8})}${lab(PX(554),PY(487),'COM / VLOC',{s:2.8})}${lab(PX(690),PY(487),'GPS',{s:2.8})}${lab(PX(674),PY(453),'PAGE',{s:2.6,a:'end'})}</g>`; }
/* radio tuning strip head (COMM 2 / NAV 2 / ADF), 172 × 64 */
function stripHead(k,tag,x0,y0){ return `<rect x="${x0}" y="${y0}" width="172" height="64" rx="3" class="rhead"/><rect x="${x0+4}" y="${y0+4}" width="80" height="40" rx="2" class="rglass"/>
  <text class="dig rd-${k}A" x="${x0+81}" y="${y0+21}" font-size="14" text-anchor="end">---</text><text class="dig rd-${k}S" x="${x0+81}" y="${y0+40}" font-size="14" text-anchor="end"></text>
  <text class="dig rda rd-${k}N0" x="${x0+7}" y="${y0+11}" font-size="5"></text><text class="dig rd-${k}N1" x="${x0+7}" y="${y0+41}" font-size="5" style="fill:#ff9d2e">MEM</text>${k!=='adf'?`<text class="dig rda rd-${k}N2" x="${x0+7}" y="${y0+19}" font-size="5"></text>`:''}
  ${lab(x0+43,y0+49.5,'STO',{s:3.4})}${lab(x0+66,y0+49.5,'TEST',{s:3.4})}${lab(x0+106,y0+43,'VOL',{s:3})}${lab(x0+128,y0+13,'XFR',{s:3.6})}${lab(x0+128,y0+57,'MEM',{s:3.6})}${lab(x0+152,y0+61,tag,{s:4.4})}`; }
/* analog clock (static face; hands follow the local time) */
function clock(id,x,y,r){ let t=''; for(let i=0;i<60;i++){ const [a,b]=pol(x,y,r,i*6), [c,d]=pol(x,y,r-(i%5?r*0.07:r*0.16),i*6); t+=`<path d="M${a} ${b}L${c} ${d}" stroke="#eee" stroke-width="${i%5?0.6:1.3}"/>`; if(i%5===0){ const [lx,ly]=pol(x,y,r*0.68,i*6); t+=`<text x="${lx}" y="${ly+r*0.08}" class="dnum" font-size="${r*0.22}" text-anchor="middle">${i/5||12}</text>`; } }
  return `<g class="gauge"><circle cx="${x}" cy="${y}" r="${r+6}" class="sbz"/><circle cx="${x}" cy="${y}" r="${r}" class="dial"/>${t}<g class="clkh clkh-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-1.6} ${y+4}L${x} ${y-r*0.5}L${x+1.6} ${y+4}z" fill="#fff"/></g><g class="clkm clkm-${id}" style="transform-origin:${x}px ${y}px"><path d="M${x-1.2} ${y+5}L${x} ${y-r*0.82}L${x+1.2} ${y+5}z" fill="#fff"/></g><circle cx="${x}" cy="${y}" r="${r*0.07}" class="hub"/></g>`; }
/* fuel consumed totaliser */
function fcons(x,y){ return `<circle cx="${x}" cy="${y}" r="31" class="sbz"/><circle cx="${x}" cy="${y}" r="27" class="dial"/>${lab0(x,y-12,'FUEL CONSUMED',4.6)}<rect x="${x-19}" y="${y-6}" width="38" height="13" rx="1.5" class="digw"/><text class="dig rd-fcons" x="${x+16}" y="${y+4.5}" font-size="10.5" text-anchor="end">0000</text>${lab0(x,y+13,'LBS',3.6)}${lab0(x+11,y+22.5,'RESET',3)}`; }
/* ---------- annunciator panels ---------- */
const ANN={};
function annGrid(x0,y0,cols,cw,ch,gap,rows,cls,fs){ let t=`<g class="dynu"><rect x="${x0-4}" y="${y0-4}" width="${cols*(cw+gap)-gap+8}" height="${rows.length*(ch+gap)-gap+8}" rx="2" class="annbox"/>`;
  rows.forEach((row,j)=>row.forEach((it,i)=>{ const x=x0+i*(cw+gap), y=y0+j*(ch+gap); if(!it){ t+=`<g class="an an-blank"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="1.5"/><path d="M${x+cw*0.15} ${y+ch/2}h${cw*0.7}" class="anbl"/></g>`; return; }
    const [k,txt,col]=Array.isArray(it)?it:[it,it,cls]; const f=Math.min(fs||ch*0.5,cw/(txt.length*0.66)); t+=`<g class="an an-${col}" data-a="${esc(k)}"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="1.5"/><text x="${x+cw/2}" y="${y+ch/2+f*0.36}" font-size="${f.toFixed(2)}" text-anchor="middle">${esc(txt)}</text></g>`; }));
  return t+'</g>'; }
/* warning panel and caution/advisory panel (later B200 serials) */
const WARN=[['L ENG FIRE','INVERTER','DOOR UNLOCKED','ALT WARN','R ENG FIRE'],['L FUEL PRESS',null,null,null,'R FUEL PRESS'],['L OIL PRESS','L GEN OVHT','A/P TRIM FAIL','R GEN OVHT','R OIL PRESS'],[null,'L BL AIR FAIL','A/P FAIL','R BL AIR FAIL',null]];
const G_=k=>[k,k,'g'];
const CAUT=[['L DC GEN','L GEN TIE OPEN','HYD FLUID LOW','RVS NOT READY','R GEN TIE OPEN','R DC GEN'],['L CHIP DETECT','BATT TIE OPEN','PROP SYNC ON','DUCT OVERTEMP',null,'R CHIP DETECT'],['L ENG ICE FAIL',null,'BATTERY CHARGE','EXT PWR',null,'R ENG ICE FAIL'],
  [G_('L AUTOFEATHER'),null,G_('ELEC TRIM OFF'),G_('AIR COND N1 LOW'),null,G_('R AUTOFEATHER')],[G_('L ENG ANTI-ICE'),G_('BRAKE DEICE ON'),G_('LDG/TAXI LIGHT'),G_('PASS OXY ON'),G_('ELEC HEAT ON'),G_('R ENG ANTI-ICE')],
  [G_('L IGNITION ON'),G_('L BL AIR OFF'),null,G_('FUEL CROSSFEED'),G_('R BL AIR OFF'),G_('R IGNITION ON')]];

/* ---------- the panel ---------- */
/* outlines traced from the reference photo (photo px), mapped to world units */
const GTOP=pp([[40,128],[50,118],[100,103],[150,91],[200,81],[250,73],[300,66],[350,60],[400,55],[446,51],[452,38],[464,22],[474,19],[822,19],[834,30],[842,47],[900,52],[950,57],[1000,61],[1050,67],[1100,75],[1150,84],[1200,96],[1250,112],[1268,122]]);
const GBOT=pp([[1268,182],[1250,171],[1200,153],[1150,140],[1100,130],[1050,122],[1000,117],[950,112],[900,108],[848,105],[749,107],[749,136],[531,136],[531,108],[450,108],[400,112],[350,116],[300,120],[250,124],[200,129],[150,134],[100,140],[60,147],[40,152]]);
const HUMP=pp([[446,108],[446,51],[452,38],[464,22],[474,19],[822,19],[834,30],[842,47],[848,105],[749,107],[749,136],[531,136],[531,108]]);
const CREAM=pp([[50,470],[50,262],[56,240],[68,218],[85,200],[105,186],[130,174],[160,164],[200,155],[250,147],[300,141],[350,137],[400,134],[450,132],[531,138],[749,138],[800,131],[850,129],[900,129],[950,131],[1000,135],[1050,143],[1100,157],[1140,173],[1175,193],[1205,218],[1230,246],[1248,275],[1257,300],[1257,462],[960,462],[945,464],[930,472],[916,484],[904,496],[893,504],[375,505],[362,501],[350,493],[340,483],[332,473],[322,469]]);
const SUBP=pp([[52,469],[322,469],[332,473],[340,483],[350,493],[362,501],[375,505],[893,504],[904,496],[916,484],[930,472],[945,464],[960,462],[1259,462],[1259,632],[52,632]]);
const smooth=pts=>pts.map((p,i)=>(i?'L':'M')+(+p[0]).toFixed(1)+' '+(+p[1]).toFixed(1)).join('');
/* square instrument case with corner screws */
function sqcase(cx,cy,w,h,r){ return `<rect x="${cx-w/2}" y="${cy-h/2}" width="${w}" height="${h}" rx="${r}" class="icase"/>${[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>`<circle cx="${(cx+a*(w/2-6)).toFixed(1)}" cy="${(cy+b*(h/2-6)).toFixed(1)}" r="2.6" class="cscr"/>`).join('')}`; }
/* placard helpers in photo coordinates */
const L=(px,py,t,sz,o)=>lab(PX(px),PY(py),t,Object.assign({s:sz||4},o||{}));
const GRP=(x0,y0,x1,y1,t,o)=>grp(PX(x0),PY(y0),(x1-x0)*PK,(y1-y0)*PK,t,Object.assign({s:3.8},o||{}));
const EPC=[[[440,170],[501,168]],[[445,231],[504,230]],[[450,293],[508,292]],[[454,354],[511,353]],[[458,412],[514,411]],[[461,469],[518,468]]];
function engDials(){ const er=38;
  const ENG=[
    ['ITT','ITT',{sc:[{min:100,max:1200,a0:-150,a1:150,f:v=>{ v=clamp(v,100,1200); return v<=800?(v-100)/700*0.78:0.78+(v-800)/400*0.22; },maj:100,mnr:50,lab:v=>v>=200&&v<=1200&&v!==1100&&v!==900?(v/100)%13:null,fs:0.2,arcs:[[400,800,'agreen']],red:[800],dash:[1000]}],unit:'C° X 100',title:'ITT',ty:-0.34,tfs:0.17,uy:0.5}],
    ['TQ','TORQUE',{sc:[{min:0,max:2800,a0:-150,a1:150,maj:200,mnr:100,lab:v=>v%400===0?v/100:null,fs:0.19,arcs:[[400,2230,'agreen']],red:[2230]}],title:'TORQUE',ty:-0.32,tfs:0.15,unit:'FT LB X 100',uy:0.46,dig:1}],
    ['NP','PROP',{sc:[{min:0,max:2300,a0:-150,a1:150,f:v=>{ v=clamp(v,0,2300); return v<1300?v/1300*0.28:0.28+(v-1300)/1000*0.72; },maj:100,mnr:100,lab:v=>v>=1300&&v%100===0?(v/100):v===500?'5':v===1000?'10':null,fs:0.15,lr:0.71,arcs:[[1600,2000,'agreen']],red:[2000]}],title:'PROP',ty:-0.32,tfs:0.17,unit:'RPM X 100',uy:0.46}],
    ['NG','TURBINE',{sc:[{min:0,max:110,a0:-150,a1:150,maj:10,mnr:2,lab:v=>v%20===0||v===110?v:null,fs:0.18,arcs:[[61,101.5,'agreen']],red:[101.5]}],title:'TURBINE',ty:-0.32,tfs:0.15,unit:'%RPM',uy:0.46,dig:1}],
    ['FF','FUEL FLOW',{sc:[{min:0,max:600,a0:150,a1:345,maj:100,mnr:20,lab:v=>v/100,fs:0.2}],title:'FUEL FLOW',ty:-0.34,tfs:0.15,unit:'PPH X 100',uy:0.5}],
    ['OIL','OIL',{sc:[{min:0,max:200,a0:150,a1:30,maj:50,mnr:10,lab:v=>v%50===0&&v<200?v:null,fs:0.15,lr:0.66,arcs:[[100,135,'agreen'],[60,100,'ayellow']],red:[60,200],nd:'P'},{min:-20,max:140,a0:-150,a1:-30,maj:20,mnr:10,lab:v=>v%40===0||v===-20?v:null,fs:0.15,lr:0.66,arcs:[[10,99,'agreen']],red:[99],nd:'T',nl:er*0.62}],title:'OIL',ty:-0.5,tfs:0.17,unit:'°C         PSI',uy:0.84}]];
  let t=''; ENG.forEach(([k,ti,o],j)=>{ EPC[j].forEach(([px,py],i)=>{ t+=dial(k+(i?'R':'L'),PX(px),PY(py),er,Object.assign({hub:er*0.26},o)); }); }); return t; }
function radioHead(k,n,tag,x0,y0){ const two=k!=='xpdr';
  return `${lab(x0+48,y0-4,n,{s:4.6})}<rect x="${x0}" y="${y0}" width="96" height="103" rx="2" class="rhead"/><rect x="${x0+5}" y="${y0+7}" width="86" height="45" rx="3" class="rglass"/><rect x="${x0}" y="${y0+56}" width="96" height="1.2" fill="#0a0a0a"/>
   <text class="dig rd-${k}A" x="${x0+70}" y="${y0+(two?27:36)}" font-size="${two?16:20}" text-anchor="end">---</text><text class="dig rd-${k}S" x="${x0+70}" y="${y0+(two?46:49)}" font-size="${two?16:5.5}" text-anchor="end"></text>
   ${two?`<text class="dig rda rd-${k}N0" x="${x0+9}" y="${y0+15}" font-size="5"></text><text class="dig rd-${k}N1" x="${x0+12}" y="${y0+50}" font-size="5" style="fill:#ff9d2e">MEM</text><text class="dig rda rd-${k}N2" x="${x0+9}" y="${y0+22}" font-size="5"></text>`
     :`<text class="dig rda rd-${k}N0" x="${x0+9}" y="${y0+16}" font-size="5"></text><text class="dig rda rd-${k}N1" x="${x0+9}" y="${y0+24}" font-size="5"></text>`}
   <text x="${x0+90}" y="${y0+66}" class="pl" font-size="6.4" text-anchor="end" font-weight="700">${tag}</text>`; }
function rcbStatic(){ const bx=(c0,c1,r0,r1,t)=>grp(RCX(c0)-12.7,RCY(r0)-21,RCX(c1)-RCX(c0)+25.4,RCY(r1)-RCY(r0)+39,t,{s:5.2});
  return `<rect x="1528" y="1112" width="466" height="304" rx="8" class="cbpan"/>${bx(0,10,0,1,'ENGINES')}${bx(12,16,0,7,'AVIONICS')}${bx(0,3,2,3,'LIGHTS')}${bx(4,8,2,3,'WARNINGS')}${bx(9,11,2,3,'WEATHER')}${bx(0,2,4,5,'ENVIRONMENTAL')}${bx(3,7,4,5,'FLIGHT')}${bx(8,11,4,5,'ELECTRICAL')}${bx(9,10,6,6,'FURNISHING')}${bx(5,10,7,7,'')}`; }
function panelSVG(){
  return `<svg class="psvg" viewBox="0 0 ${W} ${H}" xmlns="${NS}">
<defs>
 <linearGradient id="gPanel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9e3d3"/><stop offset="1" stop-color="#ddd5c1"/></linearGradient>
 <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1d1d"/><stop offset="1" stop-color="#151414"/></linearGradient>
 <linearGradient id="gGlareTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2624"/><stop offset="1" stop-color="#2a2624" stop-opacity="0"/></linearGradient>
 <linearGradient id="gGlare" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f4842"/><stop offset=".55" stop-color="#625a52"/><stop offset="1" stop-color="#37312d"/></linearGradient>
 <linearGradient id="gHump" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a524b"/><stop offset="1" stop-color="#3a3430"/></linearGradient>
 <linearGradient id="gTrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1ece2"/><stop offset=".5" stop-color="#bdb7ad"/><stop offset="1" stop-color="#6d6861"/></linearGradient>
 <linearGradient id="gOvh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ab9b80"/><stop offset="1" stop-color="#9f8e73"/></linearGradient>
 <linearGradient id="gCons" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3839"/><stop offset="1" stop-color="#252223"/></linearGradient>
 <radialGradient id="gKnob" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#6a6f76"/><stop offset=".6" stop-color="#2a2d31"/><stop offset="1" stop-color="#121417"/></radialGradient>
 <radialGradient id="gKnob2" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#7a828c"/><stop offset=".7" stop-color="#363b42"/><stop offset="1" stop-color="#1a1d21"/></radialGradient>
 <radialGradient id="gMetal" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#f6f7f8"/><stop offset=".45" stop-color="#b1b6bb"/><stop offset="1" stop-color="#5a6067"/></radialGradient>
 <radialGradient id="gChrome" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9a9fa5"/><stop offset=".8" stop-color="#e2e4e6"/><stop offset="1" stop-color="#6d7277"/></radialGradient>
 <radialGradient id="gBall" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#d7d9db"/><stop offset=".5" stop-color="#55595e"/><stop offset="1" stop-color="#1b1d20"/></radialGradient>
 <linearGradient id="gBat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8d949b"/><stop offset=".45" stop-color="#f4f6f8"/><stop offset="1" stop-color="#6f767d"/></linearGradient>
 <linearGradient id="gBatK" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2e31"/><stop offset=".45" stop-color="#8a9097"/><stop offset="1" stop-color="#1e2023"/></linearGradient>
 <linearGradient id="gBatR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8f1d14"/><stop offset=".45" stop-color="#ef4a3a"/><stop offset="1" stop-color="#7d160f"/></linearGradient>
 <linearGradient id="gLever" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5057"/><stop offset="1" stop-color="#16181b"/></linearGradient>
 <linearGradient id="gYoke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4046"/><stop offset="1" stop-color="#121416"/></linearGradient>
 <linearGradient id="gWheel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9d3bd"/><stop offset=".5" stop-color="#fbf8ec"/><stop offset="1" stop-color="#cfc8b0"/></linearGradient>
 <filter id="fLed" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="fShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".55"/></filter>
 <clipPath id="cCmp"><rect x="983.7" y="211.1" width="24" height="11" rx="2"/></clipPath>
</defs>
<!-- overhead light control panel -->
<!-- roof and centre windshield post above the overhead console: seen when the 2D overview shows more windshield (SKY) -->
<g class="roof2d"><path d="M-900 ${-SKY}H${W+900}V${24-SKY}Q${W/2} ${40-SKY} -900 ${24-SKY}Z" fill="#8f8a82"/><path d="M-900 ${24-SKY}Q${W/2} ${40-SKY} ${W+900} ${24-SKY}" fill="none" stroke="#5d5953" stroke-width="3"/>
<path d="M969 ${30-SKY}H1025L1019 0H975Z" fill="#2c2a28" stroke="#161514" stroke-width="1.5"/></g>
<path d="M829.0 0V133.9Q829.0 140.4 836.2 140.4H1157.7Q1164.9 140.4 1164.9 133.9V0Z" class="ovh"/>
<path d="M829.0 141.5H1164.9Q1170.3 141.5 1170.3 147.6L1171.7 201.6Q1171.7 208.1 1165.2 208.1H829.0Q822.5 208.1 822.5 201.6L824.0 147.6Q824.0 141.5 829.0 141.5Z" class="ovh"/>
<path d="M841.6 202.3H1163.1" class="ovhl"/>
${lab(898.5,24.5,'DO NOT OPERATE\nON DRY GLASS',{s:2.3})}<rect x="886.6" y="22.0" width="23.8" height="7.9" class="grpl"/>${lab(898.8,33.8,'WINDSHIELD WIPERS',{s:2.3})}
${labUp(867.9,70.6,'MASTER\nPANEL\nLIGHTS\nON',{s:2.4})}${lab(867.9,107.3,'OFF',{s:2.4})}
<rect x="858.5" y="74.2" width="19.4" height="30.2" rx="1" fill="#111"/>
${lab(992.8,102.6,'OPERATION LIMITATIONS',{s:3.4})}${lab(992.8,105.5,'THIS AIRPLANE MUST BE OPERATED AS A NORMAL CATEGORY AIRPLANE IN COMPLIANCE WITH\nTHE OPERATING LIMITATIONS STATED IN THE FORM OF PLACARDS, MARKINGS AND MANUALS\nNO ACROBATIC MANEUVERS INCLUDING SPINS APPROVED\nTHIS AIRPLANE APPROVED FOR VFR, IFR, & DAY & NIGHT OPERATION AND IN ICING CONDITIONS',{s:1.7})}${lab(992.8,120.2,'CAUTION',{s:3})}${lab(992.8,127.8,'STALL WARNING IS INOPERATIVE WHEN MASTER SWITCH IS OFF\nSTANDBY COMPASS IS ERRATIC WHEN WINDSHIELD ANTI-ICE AND/OR AIR CONDITIONING IS ON',{s:1.7})}
<circle cx="991.7" cy="88.6" r="1.6" fill="#0b0b0b"/>
${[[846.3,124.9],[996.4,123.8],[1147.2,124.6],[862.5,145.8],[862.5,199.1],[996.4,146.5],[996.4,202.7],[1133.2,145.8],[1133.2,199.1]].map(([x,y])=>screw(x,y)).join('')}
${dial('ldL',862.5,172.1,19,{sc:[{min:0,max:100,a0:-70,a1:70,maj:20,mnr:10,lab:v=>v,fs:0.13,lr:0.8},{min:0,max:30,a0:-55,a1:55,nond:1,maj:10,mnr:5,lab:v=>v,fs:0.12,lr:0.42}],title:'% LOAD',ty:-0.6,tfs:0.12,unit:'DC VOLTS',uy:0.16,ufs:0.12,hub:1.6})}
${dial('ldR',916.5,172.1,19,{sc:[{min:0,max:100,a0:-70,a1:70,maj:20,mnr:10,lab:v=>v,fs:0.13,lr:0.8},{min:0,max:30,a0:-55,a1:55,nond:1,maj:10,mnr:5,lab:v=>v,fs:0.12,lr:0.42}],title:'% LOAD',ty:-0.6,tfs:0.12,unit:'DC VOLTS',uy:0.16,ufs:0.12,hub:1.6})}
${dial('bam',970.5,172.1,19,{sc:[{min:-60,max:60,a0:-70,a1:70,maj:20,mnr:10,lab:v=>v%60===0?(v>0?'+'+v:v):null,fs:0.2,lr:0.62}],title:'BATT AMPS',ty:0.16,tfs:0.12,hub:1.6})}
${dial('acm',1024.8,172.1,19,{sc:[{min:380,max:420,a0:-70,a1:70,maj:10,mnr:5,lab:v=>v,fs:0.12,lr:0.8},{min:100,max:130,a0:-55,a1:55,nond:1,maj:10,mnr:5,lab:v=>v,fs:0.12,lr:0.42}],title:'FREQ',ty:-0.6,tfs:0.12,unit:'AC VOLTS',uy:0.16,ufs:0.12,hub:1.6})}
${[843.4,897.4,951.4,1005.8].map(x=>lab(x,168.5,'PUSH\nFOR VOLTS',{s:1.6,a:'start'})).join('')}
<rect x="1059.4" y="149.4" width="96.5" height="45.7" rx="3" fill="none" stroke="#efe9df" stroke-width=".6"/>${lab(1107.7,156.2,'AIRSPEEDS (IAS)',{s:3.4})}${[['MAX GEAR EXTENSION','181 KNOTS'],['MAX GEAR RETRACT','163 KNOTS'],['MAX GEAR EXTENDED','181 KNOTS'],['MAX APPROACH FLAP','200 KNOTS'],['MAX FULL DOWN FLAP','157 KNOTS'],['MAX MANEUVERING','181 KNOTS']].map(([a,b],i)=>lab(1070.9,162.7+i*3.96,a,{s:2.2,a:'start'})+lab(1129.6,162.7+i*3.96,b,{s:2.2,a:'start'})).join('')}
<!-- panel face: dark surround, cream panel, black subpanels with bright trim strip (outline traced from the photo) -->
<path d="${smooth(GTOP.map(([x,y])=>[x,y+14]))}L${PX(1268)} ${PY(645)}H${PX(40)}Z" class="pback"/>
<path d="${smooth(CREAM)}Z" fill="url(#gPanel)"/>
<path d="${smooth(SUBP)}Z" class="subp"/>
<path d="${smooth(SUBP.slice(0,SUBP.length-2))}" fill="none" stroke="#5b5752" stroke-width="1.2"/>
<rect x="${PX(50)}" y="${PY(631)}" width="${(1210*PK).toFixed(1)}" height="${(11*PK).toFixed(1)}" rx="3" fill="url(#gTrim)"/>
<!-- glareshield, centre hump -->
<path d="${smooth(GTOP)}${smooth(GBOT).replace('M','L')}Z" class="glare" filter="url(#fShadow)"/>
<path d="${smooth(GTOP)}${smooth(GTOP.map(([x,y])=>[x,y+20]).reverse()).replace('M','L')}Z" fill="url(#gGlareTop)" opacity=".75"/>
<path d="${smooth(GTOP)}" fill="none" stroke="#141213" stroke-width="2.4"/><path d="${smooth(GBOT.filter(([x])=>x<PX(531)||x>PX(749)))}" fill="none" stroke="#0c0b0b" stroke-width="2"/>
<path d="${smooth(HUMP)}Z" fill="url(#gHump)" stroke="#0e0d0d" stroke-width="1.2"/>
${[[452,96],[528,40],[528,96],[742,40],[742,96],[838,90],[540,130],[742,130]].map(([x,y])=>screw(PX(x),PY(y))).join('')}
<g><path d="M977.7 208.1h36v14q0 15-18 15t-18-15z" class="cmpcase"/><rect x="983.7" y="211.1" width="24" height="11" rx="2" fill="#151313"/><g clip-path="url(#cCmp)"><g class="cmp">${Array.from({length:30},(_,i)=>{ const d=i*30-360; const n=((d%360)+360)%360; const s={0:'N',90:'E',180:'S',270:'W'}[n]||n/10; return `<text x="${995.7+d*0.4}" y="219.6" font-size="4.6" font-weight="700" fill="#f2f2f2" text-anchor="middle">${s}</text>`; }).join('')}</g></g><path d="M995.7 211.1v11" stroke="#fff" stroke-width=".6"/></g>
<!-- cockpit voice recorder, warning annunciator panel, press-to-test -->
<rect x="${PX(468)}" y="${PY(38)}" width="${(56*PK).toFixed(1)}" height="${(62*PK).toFixed(1)}" rx="5" class="cvrp"/><circle cx="${PX(494)}" cy="${PY(64)}" r="27" class="cvrr"/><circle cx="${PX(494)}" cy="${PY(64)}" r="20" class="cvrg"/>${Array.from({length:19},(_,i)=>{ const a=i*2.4, rr=i?3.5+((i%6)*2.6):0; return `<circle cx="${(PX(494)+Math.cos(a)*rr).toFixed(1)}" cy="${(PY(64)+Math.sin(a)*rr).toFixed(1)}" r="1.3" fill="#7d7a70"/>`; }).join('')}${lab(PX(496),PY(91),'COCKPIT VOICE\nRECORDER',{s:5})}
<rect x="${PX(545)}" y="${PY(28)}" width="${(172*PK).toFixed(1)}" height="${(59*PK).toFixed(1)}" rx="3" class="annhous"/>${annGrid(PX(551),PY(33),5,47,17,4.5,WARN,'r',7)}
${lab(PX(736),PY(39),'PRESS\nTO TEST',{s:4.6})}
<!-- extinguisher lamps (three-lens fire system: amber D = discharged, green OK = test) -->
<rect x="${PX(389)}" y="${PY(73)}" width="${(44*PK).toFixed(1)}" height="${(28*PK).toFixed(1)}" rx="3" class="lampb"/>${lab(PX(411),PY(78.5),'L ENG FIRE EXT',{s:4.2})}${annGrid(PX(393),PY(81),2,30,22,2,[[['L EXT D','D','a'],['L EXT OK','OK','g']]],null,9)}
<rect x="${PX(764)}" y="${PY(67)}" width="${(44*PK).toFixed(1)}" height="${(28*PK).toFixed(1)}" rx="3" class="lampb"/>${lab(PX(786),PY(72.5),'R ENG FIRE EXT',{s:4.2})}${annGrid(PX(768),PY(75),2,30,22,2,[[['R EXT D','D','a'],['R EXT OK','OK','g']]],null,9)}
<rect x="${PX(597)}" y="${PY(101)}" width="${(94*PK).toFixed(1)}" height="${(29*PK).toFixed(1)}" rx="4" class="plq"/>${lab(PX(644),PY(110),'FIREWALL FUEL VALVE',{s:8})}${lab(PX(644),PY(118),'AND',{s:7})}<path d="M${PX(608)} ${PY(116.5)}h44M${PX(680)} ${PY(116.5)}h-44" stroke="#f2f2f2" stroke-width="1.4"/><path d="M${PX(604)} ${PY(116.5)}l7-4v8zM${PX(684)} ${PY(116.5)}l-7-4v8z" fill="#f2f2f2"/>${lab(PX(644),PY(126.5),'FIRE EXT ARM',{s:8})}
<!-- pilot: dark corner (GPWS, EFIS aux power), radio-call placard, lamp strip -->
${lampBox('x:gsCx',PX(52),PY(178),26,22,['G/S','CANCLD'],'a',5.6)}${lampBox('x:gpwsInop',PX(52)+28,PY(178),26,22,['GPWS','INOP'],'a',5.6)}${lampBox('x:auxDrive',PX(52)+56,PY(178),24,22,['AUX','DRIVE'],'a',5.2)}
${M('aux',`<g transform="translate(-78 -267)"><rect x="106" y="735" width="88" height="80" rx="5" class="auxp"/>${lab(150,744,'EFIS',{s:5})}${brk(116,184,752,'AUX POWER',{s:4.6})}${lab(116,763,'ON',{s:4.4})}${lab(136,775,'OFF',{s:4.2,a:'start'})}${lab(124,792,'TEST',{s:4.2})}${lab(168,762,'HORN',{s:4.4})}${lab(168,784,'SILENCE',{s:4.2})}${lampBox('x:efisAux',131,789,18,12,['AUX','ON'],'o',4)}${lab(158,810,'AUX TEST',{s:4.6,c:'gn'})}</g>`)}
<rect x="${PX(66)}" y="${PY(250)}" width="${(37*PK).toFixed(1)}" height="${(20*PK).toFixed(1)}" rx="2" class="plq"/>${lab(PX(84.5),PY(257),'RADIO CALL',{s:5})}
<rect x="${PX(211)}" y="${PY(167)}" width="${(80*PK).toFixed(1)}" height="${(27*PK).toFixed(1)}" rx="3" class="lampb"/>${lampBox('x:gpsInteg',PX(260)-12,PY(180)-13,24,26,['GPS','INTEG'],'a',5.2)}${lab(PX(250),PY(164),'EFIS / GPS',{s:4.2,c:'dk'})}
${lampBox('x:altAl1',PX(363)-14,PY(178)-14,28,28,['ALT','ALERT'],'a',6.4)}
<!-- pilot flight instruments -->
${M('asi',sqcase(205,515,130,130,18)+asi('asi',205,515,52))}
${M('eadi',`<g transform="translate(-52 8)"><rect x="335" y="433" width="194" height="176" rx="18" class="ebz"/><rect x="342" y="440" width="180" height="152" rx="16" class="ebz2"/>${eadiSVG()}<rect x="392" y="589" width="80" height="14" rx="7" class="eslide"/></g>`)}
${M('ehsi',`<g transform="translate(-52 22)"><rect x="335" y="615" width="194" height="190" rx="18" class="ebz"/><rect x="341" y="622" width="182" height="176" rx="14" class="ebz2"/>${ehsiSVG()}<rect x="384" y="789" width="96" height="9" rx="4.5" class="eslot"/></g>`)}
${M('alt',`<g transform="translate(-44 6)">${ocase(596,492,125,127,16)}${alt('alt',596,494,52,{bz:'none'})}${lab(552,532,'TEST',{s:4})}${lab(640,528,'BARO',{s:4})}</g>`)}
${M('clk1',sqcase(102,610,80,80,12)+clock('c1',102,610,30))}${M('ts1',sqcase(108,702,76,76,12)+ts('ts',108,702,29))}${M('slv1',slaving(1,112,785,76,66))}
${M('rmi',`<g transform="translate(-44 6)">${ocase(264,644,124,118,16)}${rmi('rmi',264,642,47)}${lab(211,640,'A\nD\nF',{s:4})}${lab(317,640,'A\nD\nF',{s:4})}${lab(240,698,'NAV',{s:4})}${lab(288,698,'NAV',{s:4})}<path d="M209 688l6 6-6 6-6-6z M319 688l6 6-6 6-6-6z" fill="#f2f2f2"/></g>`)}
${M('dme1',dme('d1',225,752,110,58))}${lab(PX(205),PY(445),'FAST\nERECT',{s:4.4,a:'start',c:'dk'})}${L(157,445.5,'MIC\nNORMAL',3.2,{c:'dk'})}${L(157,465,'OXY MASK',3.2,{c:'dk'})}
${M('vsi',`<g transform="translate(-43 30)">${ocase(595,629,120,128,16)}${vsi('vsi',595,622,47)}${lab(553,683,'A/B',{s:3.6})}${lab(637,683,'R',{s:3.6})}</g>`)}
${M('fcons',fcons(556,772))}
<rect x="${PX(398)}" y="${PY(465)}" width="${(31*PK).toFixed(1)}" height="${(30*PK).toFixed(1)}" rx="3" class="lampb"/>${synchro(PX(413),PY(480),18)}${lab(PX(388),PY(470),'PROP SYNC',{s:3.6,c:'dk'})}
<!-- engine instruments -->
${engDials()}
<!-- centre: ground comm, autopilot controller, control lock handle -->
${lab(PX(561),PY(170),'GND COMM',{s:3.8,c:'dk'})}
<rect x="${PX(612)}" y="${PY(145)}" width="${(158*PK).toFixed(1)}" height="${(57*PK).toFixed(1)}" rx="5" class="avu"/><rect x="${PX(620)}" y="${PY(149)}" width="${(142*PK).toFixed(1)}" height="7" rx="2" class="avslot"/>${screw(PX(619),PY(176))}${screw(PX(763),PY(176))}
${lab(PX(690),PY(160),'L          R',{s:4.4})}${lab(PX(690),PY(199),'TURN',{s:4})}${lab(PX(746),PY(165),'DN',{s:3.8})}${lab(PX(746),PY(196),'UP',{s:3.8})}
<rect x="${PX(794)}" y="${PY(143)}" width="${(17*PK).toFixed(1)}" height="${(60*PK).toFixed(1)}" rx="4" class="rhdl"/><rect x="${PX(792)}" y="${PY(190)}" width="${(21*PK).toFixed(1)}" height="${(13*PK).toFixed(1)}" rx="2" class="rhdlb"/>
<!-- flight director mode selectors (pilot left, copilot right) -->
${M('fdL',`<rect x="822" y="455" width="250" height="82" rx="5" class="avu"/><rect x="832" y="462" width="230" height="17" rx="2" class="digw"/><text class="dig rd-apm" x="947" y="474" font-size="8" text-anchor="middle"></text>`)}
${M('fdR',`<rect x="1104" y="455" width="250" height="82" rx="5" class="avu"/><rect x="1114" y="462" width="230" height="17" rx="2" class="digw"/><text class="dig rd-apm2" x="1229" y="474" font-size="8" text-anchor="middle"></text>`)}
<!-- standby attitude, course / heading panel, altitude alerter, blank riveted plate -->
<path d="${smooth(pp([[608,307],[869,307],[869,352],[536,352],[536,343],[608,343]]))}Z" class="rivet"/>${[[620,322],[660,322],[700,322],[740,322],[780,322],[820,322],[860,322],[560,348],[640,345],[720,345],[800,345]].map(([x,y])=>`<circle cx="${PX(x)}" cy="${PY(y)}" r="2" class="rvt"/>`).join('')}
${sqcase(PX(576.5),PY(305.5),PK*67,PK*75,10)}${adi('adi2',PX(576.5),PY(301),44,0)}
<rect x="${PX(615)}" y="${PY(268)}" width="${(152*PK).toFixed(1)}" height="${(41*PK).toFixed(1)}" rx="4" class="avu"/>${lab(PX(636),PY(275),'CRS 1',{s:4.6})}${lab(PX(690),PY(275),'HDG',{s:4.6})}${lab(PX(743),PY(275),'CRS 2',{s:4.6})}
${[[662,292],[718,292]].map(([x,y])=>`<rect x="${PX(x)-6}" y="${PY(y)-6}" width="12" height="12" rx="1.5" class="decok"/>`).join('')}${lab(PX(662),PY(305),'DIRECT',{s:3.2})}${lab(PX(718),PY(305),'SYNC',{s:3.2})}
<path d="${octP(PX(820),PY(289),90*PK,46*PK,12)}" class="obz"/><path d="${octP(PX(820),PY(289),86*PK,42*PK,10)}" class="altsetf"/>${lab(PX(826),PY(274),'ALTITUDE SET',{s:4.6})}<rect x="${PX(803)}" y="${PY(280)}" width="${(40*PK).toFixed(1)}" height="${(18*PK).toFixed(1)}" rx="3" fill="#0b0c0d"/><text class="dig2 rd-altsel" x="${PX(841)}" y="${PY(295)}" font-size="20" text-anchor="end">5.0</text>${lab(PX(791),PY(305),'PUSH TO\nCANCEL',{s:2.8})}
<!-- navigator (GPS, COMM 1, NAV 1) -->
${navSVG()}
<!-- centre multifunction / weather radar display -->
${M('mfd',`<g transform="translate(105 110)"><rect x="989" y="570" width="249" height="193" rx="12" class="mbz"/><rect x="996" y="577" width="235" height="179" rx="9" class="mbz2"/>${mfdSVG()}${lab(1012,600,'PWR',{s:5})}${lab(1013,712,'DATA',{s:5})}${lab(1219,600,'INT',{s:5})}</g>`)}
<!-- copilot flight instruments -->
<rect x="${PX(1009)}" y="${PY(156)}" width="${(65*PK).toFixed(1)}" height="${(23*PK).toFixed(1)}" rx="2" class="lampb"/>${annGrid(PX(1012),PY(158.5),2,12.5,14.5,1.5,[[['x:mkrO2','O','b'],['x:mkrM2','M','a']],[['x:mkrI2','I','w'],['x:dh2','DH','a']]],null,9)}${lampBox('x:altAl2',PX(1033),PY(158.5),29,30,['ALT','ALERT'],'a',6.4)}<rect x="${PX(1054)}" y="${PY(158.5)}" width="29" height="30" rx="2" class="lampd0"/>
<rect x="${PX(1196)}" y="${PY(233)}" width="${(42*PK).toFixed(1)}" height="${(20*PK).toFixed(1)}" rx="2" class="plq"/>${lab(PX(1217),PY(240),'RADIO CALL',{s:5})}
${M('asi2',sqcase(1432,496,130,130,18)+asi('asi2',1432,496,52))}
${M('eadi2',`<g transform="translate(1192 8)"><rect x="335" y="433" width="194" height="176" rx="18" class="ebz"/><rect x="342" y="440" width="180" height="152" rx="16" class="ebz2"/>${cop(eadiSVG())}<rect x="392" y="589" width="80" height="14" rx="7" class="eslide"/></g>`)}
${M('ehsi2',`<g transform="translate(1192 22)"><rect x="335" y="615" width="194" height="190" rx="18" class="ebz"/><rect x="341" y="622" width="182" height="176" rx="14" class="ebz2"/>${cop(ehsiSVG())}<rect x="384" y="789" width="96" height="9" rx="4.5" class="eslot"/></g>`)}
${M('alt2',`${ocase(1806,500,125,127,16)}${alt('alt2',1806,502,52,{bz:'none'})}${lab(1850,534,'BARO',{s:4})}`)}
${M('clk2',sqcase(1910,600,80,80,12)+clock('c2',1910,600,30))}${M('ts2',sqcase(1910,702,76,76,12)+ts('ts2',1910,702,29))}${M('slv2',slaving(2,1910,790,76,66))}
${M('rmi2',`${ocase(1424,650,124,118,16)}${rmi('rmi2',1424,648,47)}${lab(1371,646,'A\nD\nF',{s:4})}${lab(1477,646,'A\nD\nF',{s:4})}${lab(1400,704,'NAV',{s:4})}${lab(1448,704,'NAV',{s:4})}<path d="M1369 694l6 6-6 6-6-6z M1479 694l6 6-6 6-6-6z" fill="#f2f2f2"/>`)}
${M('vsi2',`${ocase(1806,659,120,128,16)}${vsi('vsi2',1806,652,47)}${lab(1764,713,'A/B',{s:3.6})}${lab(1848,713,'R',{s:3.6})}`)}
${M('xpdr',radioHead('xpdr','','ATC',1368,716))}
${M('dme2',dme('d2',1806,752,120,60,1))}
${lab(PX(1105),PY(425),'FAST\nERECT',{s:4.4,a:'start',c:'dk'})}${L(1148,431.5,'MIC\nNORMAL',3.2,{c:'dk'})}${L(1148,451,'OXY MASK',3.2,{c:'dk'})}
${lab(PX(265),PY(331.5),'DH        TEST',{s:2.4})}${lab(PX(1034),PY(318.5),'DH        TEST',{s:2.4})}
<!-- pilot's left subpanel -->
${GRP(190,481,236,514,'ENG AUTO\nIGNITION')}${L(210,494,'ARM',3.8)}${L(210,511,'OFF',3.8)}
${L(172,518,'GEN\nRESET',3.6)}${L(172,536,'ON',3.8)}${L(172,549,'OFF',3.8)}${L(66,541,'ON',3.8)}${L(66,551,'OFF',3.8)}
${L(78,484,'EXT PWR',3.6)}${L(78,490,'ON',3.2)}${L(84,499,'OFF',3.0,{a:'start'})}${L(84,508,'RESET',3.0,{a:'start'})}
${L(145,557.5,'BUS SENSE\nRESET',3.0)}${L(145,583,'TEST',3.0)}${L(167,557.5,'GEN TIES\nMAN CLOSE',3.0)}${L(173,572,'NORM',2.4,{a:'start'})}${L(167,583,'OPEN',3.0)}
${GRP(186,520,240,592,'ENGINE ANTI-ICE')}${L(199,526,'LEFT',3.0)}${L(226,526,'RIGHT',3.0)}${L(212.5,531,'ON',3.0)}${L(212.5,543,'OFF',3.0)}${L(212.5,557,'ACTUATOR\nSTANDBY',3.0)}${L(212.5,588,'MAIN',3.0)}
${GRP(95,592,146,630,'IGNITION AND\nENGINE START')}${L(120,606,'ON',3.6)}${L(120,615,'OFF',3.6)}${L(120,627,'STARTER ONLY',3.6)}${L(107,600,'LEFT',3.6)}${L(133,600,'RIGHT',3.6)}
${GRP(160,594,201,630,'AUTOFEATHER')}${GRP(206,594,246,630,'PROP TEST')}${L(216,601,'GOV',3.0)}${L(236,598.5,'GND IDLE\nSTOP',2.7)}${L(226,628,'OFF',3.0)}
${L(80,614,'PARKING BRAKE',3.8)}
<!-- pilot's right subpanel -->
${GRP(338,513,448,548,'LIGHTS')}${L(355,522,'LANDING',3.8)}${L(383,522,'TAXI',3.8)}${L(401,522,'ICE',3.8)}${L(419,522,'NAV',3.8)}${L(437,522,'RECOG',3.8)}${L(345,546,'LEFT',3.2)}${L(364,546,'RIGHT',3.2)}${L(410,547,'OFF',3.4)}
${GRP(342,554,451,629,'ICE PROTECTION')}${L(361,561,'WSHLD ANTI-ICE\nNORMAL',3.4)}${L(398,561,'PROP',3.6)}${L(389,566,'AUTO',3.4)}${L(407,566,'MANUAL',3.4)}${L(434,563,'FUEL VENT',3.6)}
${L(352,588,'PILOT',3.2)}${L(370,588,'COPLT',3.2)}${L(398,588,'-OFF-',3.2)}${L(425,588,'LEFT',3.2)}${L(443,588,'RIGHT',3.2)}${L(361,592,'HI',3.2)}
${L(351,597,'BRAKE\nDEICE',3.2)}${L(369,597,'SURFACE\nDEICE',3.2)}${L(387,597,'STALL\nWARN',3.2)}${L(414,598,'PITOT',3.4)}${L(442,597,'LDG GEAR\nRELAY',3.2)}${L(369,625,'MANUAL',3.2)}${L(414,625,'OFF',3.2)}
${L(474,519,'LDG GEAR CONTROL',3.8)}${L(452,588,'DOWN\nLOCK REL',3.2)}${L(494,584,'HD LT\nTEST',3.2)}
${GRP(500,515,546,548,'LIGHTS')}${L(511,523,'BEACON',3.6)}${L(531,523,'STROBE',3.6)}
${L(513,554,'GEAR\nDOWN',3.4)}<rect x="${PX(505)}" y="${PY(562)}" width="${(17*PK).toFixed(1)}" height="${(18*PK).toFixed(1)}" rx="1" class="lampb"/>${annGrid(PX(506),PY(563),1,24,12,1,[[['x:gN','NOSE','g']]],null,5.4)}${annGrid(PX(506),PY(563)+13,2,11.5,13,1,[[['x:gL','L','g'],['x:gR','R','g']]],null,6.4)}
${L(532,560,'TAIL\nFLOOD',3.4)}${L(514,598,'GEAR\nWARN',3.2)}${L(514,623,'SILENCE',3.2)}${L(537,599,'HYD FLUID\nSENSOR',3.2)}${L(537,622,'TEST',3.2)}
<!-- centre: caution / advisory annunciators and the cabin gauges plate on the pedestal -->
<rect x="${PX(556)}" y="${PY(507)}" width="${(184*PK).toFixed(1)}" height="${(74*PK).toFixed(1)}" rx="3" class="annhous"/>${annGrid(PX(566),PY(512),6,37,13,2.6,CAUT.concat([[null,null,null,null,null,null]]),'a')}
<!-- copilot's environmental subpanel -->
${GRP(780,509,906,622,'ENVIRONMENTAL')}${L(764,590,'STALL\nWARN TEST',3.4)}${L(764,622,'LDG GEAR\nWARN TEST',3.0)}${L(771,608,'OFF',2.8,{a:'start'})}
${L(792,563,'ENVR\nBLEED AIR\nNORMAL',2.8)}${L(792,589,'LOW',2.8)}${L(865,595,'AFT\nHEAT',3.2)}
${L(836,517,'MANUAL\nTEMP',3.4)}${L(848,528,'INCR',3.2)}${L(848,544,'DECR',3.2)}${L(860,517,'VENT\nBLOWER',3.4)}
${Array.from({length:7},(_,i)=>{ const a=-150+i*50; const [p,q]=pol(PX(885),PY(536),PK*14*1.62+4,a), [u,v]=pol(PX(885),PY(536),PK*14*1.62+8,a); return `<path d="M${p} ${q}L${u} ${v}" class="grpl"/>`; }).join('')}${L(892,520,'INCR',3.4)}${L(885,553,'CABIN TEMP',3.6)}${L(938,553,'CABIN TEMP MODE',3.6)}
${L(843,553,'BLEED AIR VALVES',3.6)}${L(828,559,'LEFT',3.2)}${L(857,559,'RIGHT',3.2)}${L(843,565,'OPEN',3.2)}${L(843,573,'ENVR\nOFF',3.0)}${L(843,588,'INSTR & ENVIR OFF',3.0)}
${L(818,595,'AFT\nBLOWER',3.2)}${L(840,595,'ELEC\nHEAT',3.2)}
${GRP(906,559,958,612,'ENG FIRE TEST')}${L(926.5,576.5,'DET',3.0)}${L(926.5,586,'OFF',2.8)}${L(926.5,595.5,'EXT',3.0)}${L(913,601,'LEFT',3.0)}${L(940,601,'RIGHT',3.0)}<path d="M${PX(913)} ${PY(578)}V${PY(575.5)}H${PX(921)}M${PX(932)} ${PY(575.5)}H${PX(940)}V${PY(578)}M${PX(913)} ${PY(592)}V${PY(594.5)}H${PX(921)}M${PX(932)} ${PY(594.5)}H${PX(940)}V${PY(592)}" class="grpl"/>
<!-- copilot's right subpanel: suction and cabin-air gauges sit behind the control column -->
${dial('suct',PX(1104),PY(506),30,{sc:[{min:2,max:7,a0:-60,a1:60,maj:1,mnr:0.25,lab:v=>v>=3&&v<=6?v:null,fs:0.24,lr:0.72,arcs:[[4.3,5.9,'agreen']]}],title:'SUCTION',ty:0.3,tfs:0.15})}
${dial('ctemp',PX(1097),PY(552),34,{sc:[{min:0,max:110,a0:-60,a1:60,maj:10,mnr:5,lab:v=>[0,50,80,100].includes(v)?v:null,fs:0.17,lr:0.8}],title:'°F',ty:0.06,tfs:0.15})}${L(1097,583,'CABIN AIR',4.2)}
<circle cx="${PX(1016)}" cy="${PY(565)}" r="22" class="spk"/>${Array.from({length:19},(_,i)=>{ const a=i*2.4, rr=i?3+((i%6)*2.8):0; return `<circle cx="${(PX(1016)+Math.cos(a)*rr).toFixed(1)}" cy="${(PY(565)+Math.sin(a)*rr).toFixed(1)}" r="1.1" fill="#6d6964"/>`; }).join('')}
${GRP(1128,480,1193,526,'CABIN')}${L(1139,515,'FURN',3.2)}${L(1160,515,'LIGHTS',3.2)}${L(1181,515,'SIGNS',3.2)}
${dial('pneu',PX(1220),PY(505),42,{sc:[{min:0,max:24,a0:-110,a1:110,maj:10,mnr:2,lab:v=>v%10===0?v:null,fs:0.2,lr:0.72,arcs:[[12,20,'agreen']],red:[20]}],title:'PNEUMATIC\nPRESSURE',ty:0.38,tfs:0.11,unit:'PSI',uy:0.05})}
<circle cx="${PX(1160)}" cy="${PY(570)}" r="48" class="sbz"/><circle cx="${PX(1160)}" cy="${PY(570)}" r="42" class="dial"/>${lab0(PX(1160),PY(564),'FLIGHT',10)}${lab0(PX(1153),PY(573),'HOURS',4.4)}${lab0(PX(1172),PY(573),'1/10',4.4)}<rect x="${PX(1160)-24}" y="${PY(576)}" width="48" height="12" rx="1" fill="#f2f2f2"/><text class="rd-hobbs" x="${PX(1160)}" y="${PY(576)+10}" font-size="9.5" fill="#111" font-family="IBM Plex Mono,monospace" text-anchor="middle">0000.0</text>
${dial('oxy',PX(1216),PY(568),22,{sc:[{min:0,max:2000,a0:-110,a1:110,maj:500,mnr:100,lab:v=>v%500===0?v:null,fs:0.15,lr:0.68}],title:'OXYGEN',ty:0.42,tfs:0.16,unit:'SUPPLY PRESSURE  PSI',uy:0.62,ufs:0.08})}
<g transform="translate(0 ${DY})">
<!-- left sidewall: fuel control panel, fuel system breakers, free air temperature -->
<rect x="8" y="1112" width="438" height="152" rx="6" class="fuelp"/>${screw(16,1120)}${screw(438,1120)}${screw(16,1256)}${screw(438,1256)}
${lab(130,1124,'ENGINE',{s:4.6})}${lab(324,1124,'ENGINE',{s:4.6})}<path d="M130 1135V1129H144M310 1129H324V1135" class="grpl"/><path d="M130 1137l-2.5 -5h5z M324 1137l-2.5 -5h5z" fill="#eef2f4"/>${lab(227,1124,'CROSSFEED FLOW',{s:4.6})}<path d="M144 1129H201M253 1129H310" class="grpl"/><path d="M200 1129l-6 -2.5v5z M254 1129l6 -2.5v5z" fill="#eef2f4"/>
${dial('fqL',130,1188,42,{sc:[{min:0,max:1400,a0:-135,a1:135,maj:200,mnr:50,lab:v=>v%200===0?v/100:null,fs:0.17,lr:0.74,arcs:[[0,250,'ayellow']]}],title:'FUEL',ty:-0.25,tfs:0.17,unit:'QTY\nLBS X 100',uy:0.45})}
${dial('fqR',324,1188,42,{sc:[{min:0,max:1400,a0:-135,a1:135,maj:200,mnr:50,lab:v=>v%200===0?v/100:null,fs:0.17,lr:0.74,arcs:[[0,250,'ayellow']]}],title:'FUEL',ty:-0.25,tfs:0.17,unit:'QTY\nLBS X 100',uy:0.45})}
${lab(130,1251,'LEFT',{s:5})}${lab(324,1251,'RIGHT',{s:5})}<rect x="196" y="1168" width="62" height="24" rx="1" class="grpl"/>${lab(227,1177,'SEE MANUAL FOR\nFUEL CAPACITY',{s:3.8})}
${[['x:nxL',34],['x:nxR',420]].map(([k,x])=>`${lab(x,1229,'NO',{s:4})}<g class="an an-a" data-a="${k}"><circle cx="${x}" cy="1240" r="6.5"/></g><circle cx="${x}" cy="1240" r="7.5" fill="none" stroke="#000" stroke-width="1"/>${lab(x,1255,'TRANSFER',{s:4})}`).join('')}
<rect x="8" y="1268" width="438" height="206" rx="6" class="fuelp"/>
${lab(27,1279,'OPEN',{s:4.2})}${lab(27,1296,'FIREWALL\nSHUTOFF\nVALVE',{s:3.4})}${lab(27,1330,'CLOSED',{s:4.2})}${lab(429,1279,'OPEN',{s:4.2})}${lab(429,1296,'FIREWALL\nSHUTOFF\nVALVE',{s:3.4})}${lab(429,1330,'CLOSED',{s:4.2})}
<rect x="37" y="1276" width="22" height="56" rx="2" fill="#141213"/><rect x="397" y="1276" width="22" height="56" rx="2" fill="#141213"/>
<path d="M66 1328H94M120 1328H186M268 1328H334M360 1328H390" class="grpl"/><path d="M66 1328l5 -2.4v4.8z M390 1328l-5 -2.4v4.8z" fill="#eef2f4"/>${lab(107,1329.5,'LEFT',{s:4})}${lab(227,1330,'FUEL SYSTEM',{s:5})}${lab(347,1329.5,'RIGHT',{s:4})}
<path d="M14 1340H452" class="grpl" stroke-opacity=".25"/>
${brk(80,112,1352,'FLAP',{s:3.6})}${[['BUS\nFEEDERS',35.6],['PROP\nDEICE',60.6],['MOTOR',84.1],['CONTROL',107.7],['IGNITOR\nPOWER',131.3],['START\nCONTROL',154.9],['BUS\nFEEDERS',178.5]].map(([t,x])=>lab(x,1393,t,{s:3.2})).join('')}${lab(84.1,1406,'PROP\nDEICE',{s:3.2})}${lab(107.7,1406,'PROP',{s:3.2})}
${lab(358,1356,'ENGINE INSTRUMENTS',{s:4.2})}${lab(353,1366,'LEFT',{s:3.6})}${lab(353,1446,'RIGHT',{s:3.6})}${['ITT','TORQUE','PROP\nTACH','TURBINE\nTACH','FUEL\nFLOW','OIL\nPRESS','OIL\nTEMP'].map((t,i)=>lab(274.2+i*26.2,1400,t,{s:3.2})).join('')}
${screw(98,1466)}${screw(238,1466)}${screw(410,1466)}
<rect x="452" y="1112" width="68" height="134" rx="5" class="fuelp"/>${lab(486,1122,'FREE AIR\nTEMP',{s:4})}<rect x="460" y="1135" width="52" height="20" rx="2" class="digw"/><text class="dig rd-oat" x="486" y="1150" font-size="11" text-anchor="middle">OAT</text>
<!-- pedestal -->
<path d="M712 1110H1288L1306 1640H694Z" class="ped"/>
${lab(818,1121,'POWER',{s:5})}${lab(929,1121,'PROPELLER',{s:5})}${lab(1039,1121,'CONDITION',{s:5})}${lab(722,1125,'ELEV TRIM',{s:4})}
${lab(1162,1121,'FLAP',{s:5})}
<rect x="704" y="1332" width="294" height="56" rx="4" class="pedp"/>${lab(712,1342,'EFIS',{s:4.6,a:'start'})}

<rect x="1004" y="1332" width="292" height="90" rx="4" class="pedp"/>${lab(1150,1342,'CABIN PRESSURE CONTROLLER',{s:4.4})}
${dial('pctl',1058,1380,32,{sc:[{min:-1000,max:10000,a0:-150,a1:150,maj:1000,mnr:500,lab:v=>v%2000===0?v/1000:null,fs:0.18,nond:1},{min:0,max:35000,a0:-150,a1:150,nond:1,maj:5000,mnr:5000,lab:v=>v%10000===0?v/1000:null,fs:0.13,lr:0.42}],title:'CABIN ALT',ty:0.36,tfs:0.12,unit:'ACFT ALT',uy:0.58,extra:`<g class="pctlp" style="transform-origin:1058px 1380px"><path d="M1058 1380L1058 1352" stroke="#ff9d2e" stroke-width="2.2"/></g>`})}
<text class="dig rd-cab2" x="1240" y="1408" font-size="7" text-anchor="middle"></text>
<g transform="translate(-272 -34)"><rect x="1004" y="1426" width="292" height="50" rx="4" class="pedp"/>${lab(1032,1432,'CABIN PRESS\nDUMP',{s:3.6})}${lab(1044,1458,'P\nR\nE\nS\nS',{s:3,a:'start'})}${lab(1032,1477,'TEST',{s:3.6})}${lab(1098,1432,'RUDDER\nBOOST',{s:3.6})}${lab(1160,1432,'ELEV\nTRIM',{s:3.6})}</g>
<!-- audio control panel (pedestal) -->
<g transform="translate(-101 1067)"><rect x="862" y="386" width="478" height="182" rx="6" class="pedp"/>${lab(929,404,'COMM',{s:4.4})}${lab(967.5,404,'NAV',{s:4.4})}${lab(1007.5,404,'MKR BCN',{s:4.4})}${lab(1046.75,404,'DME',{s:4.4})}${lab(1076,404,'ADF',{s:4.4})}${brk(915,1080,438,'PILOT AUDIO OFF',{s:4.2})}
${lab(1158,404,'COMM',{s:4.4})}${lab(1197.5,404,'NAV',{s:4.4})}${lab(1235.5,404,'MKR BCN',{s:4.4})}${lab(1274.5,404,'DME',{s:4.4})}${lab(1304,404,'ADF',{s:4.4})}${brk(1144,1309,438,'COPILOT AUDIO OFF',{s:4.2})}
${screw(1111,413)}${screw(950,537)}${screw(1269,537)}${screw(876,504)}${screw(1347,504)}
${lab(1111,445,'PUSH\nON/OFF',{s:4.2})}${brk(978,1036,494,'DME',{s:4.4})}${lab(988,501,'1',{s:4})}${lab(1026,501,'2',{s:4})}${labUp(1007,540,'ENCD\nALTM',{s:4.2})}${brk(1186,1252,496,'MKR BCN 1 & 2',{s:4})}${screw(870,394)}${screw(1332,394)}${screw(870,560)}${screw(1332,560)}</g>
${lab(760,1328,'L       R',{s:3.6})}<path class="trind aitr" d="M770 1298l-3-5h6z"/>
<!-- right sidewall: copilot's circuit-breaker panel, pilot's static air source -->
${rcbStatic()}
<rect x="1640" y="1418" width="300" height="64" rx="5" class="fuelp"/>${lab(1820,1444,"PILOT'S STATIC\nAIR SOURCE",{s:5})}
</g>
<!-- COMM 2 / NAV 2 / ADF tuning strip (not in the photo frame): right side console -->
${M('strip',`<rect x="816" y="608" width="542" height="74" rx="4" class="avplate"/>${screw(820,612)}${screw(1354,612)}${stripHead('com2','COMM 2',822,614)}${stripHead('nav2','NAV 2',1001,614)}${stripHead('adf','ADF',1180,614)}`)}
${dial('pamp',1586,1650,26,{sc:[{min:0,max:30,a0:-60,a1:60,maj:10,mnr:2,lab:v=>v,fs:0.24,lr:0.8,arcs:[[18,24,'agreen']]}],title:'PROP AMPS',ty:0.4,tfs:0.15})}
<!-- cabin gauges plate on top of the pedestal (white faces) -->
<rect x="${PX(553)}" y="${PY(580)}" width="${(190*PK).toFixed(1)}" height="${(78*PK).toFixed(1)}" rx="6" class="gplate"/>${[[560,587],[736,587],[560,651],[736,651]].map(([x,y])=>screw(PX(x),PY(y))).join('')}
<g class="wface">${dial('flp',PX(588),PY(624),34,{sc:[{min:0,max:100,a0:0,a1:180,maj:20,mnr:20,lab:v=>v===20?'20':v===60?'60':v===80?'80':null,fs:0.18,lr:0.68,arcs:[[0,40,'awhite']]}],title:'FLAPS',ty:-0.12,tfs:0.24,extra:`<text x="${PX(588)-6}" y="${PY(624)-26}" class="dnum" font-size="7.5" text-anchor="end">UP</text><text x="${PX(588)-6}" y="${PY(624)+32}" class="dnum" font-size="7.5" text-anchor="end">DOWN</text><text x="${PX(588)+18}" y="${PY(624)-4}" class="dnum" font-size="3.4" text-anchor="middle">APPROACH</text>`})}
${dial('cvs',PX(646),PY(624),34,{sc:[{min:-4000,max:4000,a0:-90-150,a1:-90+150,maj:1000,mnr:500,lab:v=>v%1000===0&&Math.abs(v)<4000?Math.abs(v)/1000:Math.abs(v)===500?'.5':null,fs:0.19}],title:'CABIN CLIMB',unit:'THDS FT PER MIN',ty:-0.32,uy:-0.18,tfs:0.13,ufs:0.08})}
${dial('cab',PX(707),PY(623),34,{sc:[{min:0,max:50000,a0:-150,a1:150,f:v=>clamp(v,0,50000)/50000,maj:5000,mnr:1000,lab:v=>v%10000===0||v===5000||v===15000||v===25000||v===35000?v/1000:null,fs:0.15,arcs:[[12500,50000,'ayellow']],nd:'A'},{min:0,max:7,a0:-120,a1:120,maj:1,mnr:1,nd:'D',nl:21,ncls:'amb',arcs:[[0,6.5,'agreen']],red:[6.6],lab:v=>v,fs:0.12,lr:0.38}],title:'CABIN\nALT',ty:-0.62,tfs:0.11,unit:'PSI',uy:-0.25})}</g>
<g class="ctls">${C.map(ctlSVG).join('')}</g>
</svg>`;
}

/* ---------- build ---------- */
function build(stage,io){
  const world=document.createElement('div'); world.className='world'; world.style.width=W+'px'; world.style.height=H+'px';
  /* the panel sits in an unscaled full-stage wrapper; CSS composites it while the outside view is drawn behind the panel, so the
     WebGL canvas below does not split the panel into overlap layers (the panel itself keeps its scale and stays sharp) */
  const wlay=document.createElement('div'); wlay.className='wlay'; wlay.appendChild(world);
  world.innerHTML=panelSVG(); stage.appendChild(wlay);
  const svg=world.querySelector('svg'), byId={}; if(CPT) svg.classList.add('cpt');
  svg.querySelectorAll('g.ctl').forEach(g=>{ const c=C.find(k=>k.id===g.dataset.id); byId[c.id]={c,g}; });
  svg.querySelectorAll('.an[data-a]').forEach(e=>{ (ANN[e.dataset.a]=ANN[e.dataset.a]||[]).push(e); });
  requestAnimationFrame(()=>{ const layer=document.createElementNS(NS,'g'); layer.setAttribute('class','hits'); const host=svg.querySelector('g.ctls'); host.insertBefore(layer,host.firstChild);
    const Z=[]; Object.values(byId).forEach(o=>{ try{ const b=o.g.getBBox(); const r=document.createElementNS(NS,'rect'); r.setAttribute('class','hlr');
      const x0=Math.max(1,b.x-3), y0=Math.max(1,b.y-3), x1=Math.min(W-1,b.x+b.width+3), y1=Math.min(H-1,b.y+b.height+3);
      r.setAttribute('x',x0); r.setAttribute('y',y0); r.setAttribute('width',x1-x0); r.setAttribute('height',y1-y0); r.setAttribute('rx',5); o.g.insertBefore(r,o.g.firstChild);
      if(o.c.t==='sbtn') return; const cx=b.x+b.width/2, cy=b.y+b.height/2, hw=Math.max(b.width+6,26)/2, hh=Math.max(b.height+6,26)/2; Z.push({o,cx,cy,x0:cx-hw,x1:cx+hw,y0:cy-hh,y1:Math.min(H-1,cy+hh)}); Object.assign(o.c,{_hx:cx,_hy:cy,_hw:hw,_hh:hh}); }catch(e){} });
    for(let a=0;a<Z.length;a++) for(let k=a+1;k<Z.length;k++){ const A=Z[a], B=Z[k]; if(A.x1<=B.x0||B.x1<=A.x0||A.y1<=B.y0||B.y1<=A.y0) continue;
      const dx=B.cx-A.cx, dy=B.cy-A.cy;
      if(Math.abs(dx)>=Math.abs(dy)){ const m=(A.cx+B.cx)/2; if(dx>=0){ A.x1=Math.min(A.x1,m); B.x0=Math.max(B.x0,m); } else { A.x0=Math.max(A.x0,m); B.x1=Math.min(B.x1,m); } }
      else { const m=(A.cy+B.cy)/2; if(dy>=0){ A.y1=Math.min(A.y1,m); B.y0=Math.max(B.y0,m); } else { A.y0=Math.max(A.y0,m); B.y1=Math.min(B.y1,m); } } }
    Z.forEach(z=>{ if(z.x1<=z.x0||z.y1<=z.y0) return; const h=document.createElementNS(NS,'rect'); const wh=WHT.includes(z.o.c.t); h.setAttribute('class',wh?'hit hitw':'hit'); if(wh) fineWheel(h,onWheel); h.dataset.for=z.o.c.id; h.setAttribute('x',z.x0); h.setAttribute('y',z.y0); h.setAttribute('width',z.x1-z.x0); h.setAttribute('height',z.y1-z.y0); layer.appendChild(h); }); });
  const onWheel=bind(world,byId,io);
  return {world,svg,byId,W,H,REG,REG_ORDER,C,CBS};
}

/* ---------- interaction ---------- */
function ctlFromBy(byId,t){ if(!t||!t.closest) return null; const g=t.closest('g.ctl'); if(g) return g; const h=t.closest('.hit'); return h&&byId[h.dataset.for]?byId[h.dataset.for].g:null; }
function levSnap(c,v){ const rng=c.max-c.min; for(const [m] of c.marks||C.find(k=>k.kind===c.kind&&k.marks).marks){ if(Math.abs(v-m)<rng*0.035) return m; } return v; }
/* A blocking (non-passive) wheel listener makes Chrome keep a wheel-event region for every painted part below it and rebuild it on
   every repaint (the main cost of a repaint on a desktop, worst when zoomed in). Wheel events only come from a mouse or touchpad.
   So the knob listener sits on the knobs and their touch zones only (the only targets it ever acted on), attached while the device
   has a fine pointer; the stage-wide Ctrl+wheel guard (no browser zoom over the panel) is attached while the Ctrl key is held. */
const WH=[]; let whMq=null, whOn=null;
function whSync(){ const on=!whMq||whMq.matches; if(on===whOn) return; whOn=on; WH.forEach(([el,fn])=>{ if(on) el.addEventListener('wheel',fn,{passive:false}); else el.removeEventListener('wheel',fn,{passive:false}); }); }
function fineWheel(el,fn){ if(whOn===null){ whMq=G.matchMedia?G.matchMedia('(any-pointer:fine)'):null; if(whMq){ if(whMq.addEventListener) whMq.addEventListener('change',whSync); else if(whMq.addListener) whMq.addListener(whSync); } whSync(); }
  WH.push([el,fn]); if(whOn) el.addEventListener('wheel',fn,{passive:false}); }
function ctrlWheel(el){ const fn=e=>{ if(e.ctrlKey) e.preventDefault(); }; let on=false; const set=v=>{ if(v===on) return; on=v; if(v) el.addEventListener('wheel',fn,{passive:false}); else el.removeEventListener('wheel',fn,{passive:false}); };
  G.addEventListener('keydown',e=>{ if(e.key==='Control'||e.ctrlKey) set(true); },true); G.addEventListener('keyup',e=>{ if(e.key==='Control'||!e.ctrlKey) set(false); },true); G.addEventListener('blur',()=>set(false)); }
const WHT=['rot','enc','enc2','rotsel','vwheel','hwheel','lev','flap'];
const MOM=c=>c.mom||c.t==='push'||c.t==='mbtn'||c.t==='sbtn'||c.t==='bar'||(c.t==='abtn'&&c.momentary)||(c.t==='key'&&!c.alt);
function bind(world,byId,io){
  const ctlFrom=t=>ctlFromBy(byId,t);
  const svg=world.querySelector('svg'); const pt0=svg.createSVGPoint();
  const toW=e=>{ if(io.toWorld) return io.toWorld(e); pt0.x=e.clientX; pt0.y=e.clientY; const p=pt0.matrixTransform(svg.getScreenCTM().inverse()); return {x:p.x,y:p.y}; };
  const inner=(c,pt)=>Math.hypot(pt.x-c.x,pt.y-c.y)<(c.r||14)*0.58*(c.sc||1);
  const step=(o,d,inn)=>{ const c=o.c, v=io.get(c.id);
    switch(c.t){
      case 'tog': case 'cb': case 'pull': case 'abtn': case 'key': case 'lbtn': io.set(c.id,d>0?1:d<0?0:(v?0:1)); return;
      case 'guard': { const gk=c.id+'G'; if(!io.get(gk)){ io.set(gk,1); return; } if(d===0) io.set(c.id,v?0:1); else io.set(c.id,d>0?1:0); return; }
      case 'tog3': { const nv=d? clamp((v||0)-d,-1,1) : (v!==0?0:-1); io.set(c.id,nv); if(c.spring&&nv!==0&&(c.spring===1||c.spring===true||(c.spring==='up'&&nv<0)||(c.spring==='dn'&&nv>0))) setTimeout(()=>{ if(io.get(c.id)===nv) io.set(c.id,0); },450); return; }
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
  const onWheel=e=>{ const g=ctlFrom(e.target); if(!g) return; const o=byId[g.dataset.id]; if(!WHT.includes(o.c.t)) return; e.preventDefault(); e.stopPropagation(); if(e.ctrlKey) return; const raw=(Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:-e.deltaX)*(e.deltaMode?40:1); wacc+=raw; if(Math.abs(wacc)<30) return; const d=wacc<0?1:-1; wacc=0;
    if(o.c.t==='vwheel') return step(o,-d); step(o,d,o.c.t==='enc2'&&(e.shiftKey||inner(o.c,toW(e)))); };
  Object.values(byId).forEach(o=>{ if(WHT.includes(o.c.t)) fineWheel(o.g,onWheel); });
  let drag=null;
  world.addEventListener('pointerdown',e=>{ const g=ctlFrom(e.target); if(!g) return; if(io.intercept&&io.intercept(e,g)) return; const o=byId[g.dataset.id], c=o.c; e.preventDefault(); e.stopPropagation(); g.focus({preventScroll:true});
    const pt=toW(e);
    if(MOM(c)){ io.set(c.id,1); drag={o,mom:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='lev'){ drag={o,lev:1,y:pt.y,v:io.get(c.id),moved:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); return; }
    if(c.t==='vwheel'||c.t==='hwheel'||c.t==='rot'||c.t==='enc'||c.t==='enc2'){ drag={o,x:pt.x,y:pt.y,v:io.get(c.id),acc:0,moved:0,inn:c.t==='enc2'&&inner(c,pt)}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='rotsel'){ const a=Math.atan2(pt.x-c.x,-(pt.y-c.y))*180/Math.PI; const v=io.get(c.id); const dA=(p,q)=>Math.abs(((p-q+540)%360)-180); if(Math.hypot(pt.x-c.x,pt.y-c.y)>(c.r||12)*(c.sc||1)+3){ let best=0; c.ang.forEach((x,i)=>{ if(dA(x,a)<dA(c.ang[best],a)) best=i; }); if(best!==v){ io.set(c.id,best); return; } } io.set(c.id,(v+1)%c.vals.length); return; }
    if(c.t==='flap'){ const idx=clamp(Math.round((pt.y-(c.y-30))/30),0,2); io.set(c.id,idx===io.get(c.id)?(idx+1)%3:idx); return; }
    if(c.t==='tog'){ drag={o,tg:1,y:pt.y,done:0}; try{ g.setPointerCapture(e.pointerId); }catch(_){} return; }
    if(c.t==='yoke'){ drag={o,stk:1,x:pt.x,y:pt.y,cx:e.clientX,cy:e.clientY,pt:e.pointerType}; try{ g.setPointerCapture(e.pointerId); }catch(_){} g.classList.add('drag'); io.set('stick',{x:0,y:0}); return; }
    if(c.t==='tog3'){ const v=io.get(c.id); /* thirds of the switch's own touch zone: top / centre / bottom */ const q=c.horiz?pt.x-(c._hx??c.x):pt.y-(c._hy??c.y), th=Math.max(4,(c.horiz?(c._hw||13):(c._hh||13))*0.34); const t=q<-th?-1:q>th?1:(v!==0?0:-1); io.set(c.id,t===v?0:t); if(c.spring){ drag={o,spr:1}; try{ g.setPointerCapture(e.pointerId); }catch(_){} } return; }
    if(c.t==='guard'){ const onGuard=e.target.closest('.gd'); const gk=c.id+'G'; if(onGuard||!io.get(gk)){ io.set(gk,io.get(gk)?0:1); return; } io.set(c.id,io.get(c.id)?0:1); return; }
    step(o,0);
  });
  world.addEventListener('pointermove',e=>{ if(!drag||drag.mom||drag.spr) return; const c=drag.o.c, pt=toW(e);
    if(drag.tg){ const dy=pt.y-drag.y; if(!drag.done&&Math.abs(dy)>6){ drag.done=1; io.set(c.id,dy<0?1:0); } return; }
    if(drag.stk){ io.set('stick',G.FK?G.FK.shapeDrag(e.clientX-drag.cx,e.clientY-drag.cy,drag.pt):{x:clamp((pt.x-drag.x)/60,-1,1),y:clamp((pt.y-drag.y)/40,-1,1)}); return; } // screen px through the shared mouse/touch curve
    if(drag.lev){ const v=clamp(drag.v-(pt.y-drag.y)/c.len*(c.max-c.min),c.min,c.max); drag.moved=1; io.set(c.id,v); return; }
    if(c.t==='vwheel') io.set(c.id,clamp(drag.v+(pt.y-drag.y)/110,-1,1));
    if(c.t==='hwheel') io.set(c.id,clamp(drag.v+(pt.x-drag.x)/90,-1,1));
    if(c.t==='rot') io.set(c.id,clamp(drag.v+(pt.x-drag.x)/60,0,1));
    if(c.t==='enc'||c.t==='enc2'){ const d=(pt.x-drag.x)-(pt.y-drag.y); const n=Math.trunc(d/6)-drag.acc; if(n){ drag.acc+=n; io.set(c.id+(c.t==='enc'?':d':drag.inn?':i':':o'),n); } }
  });
  const end=()=>{ if(!drag) return; const c=drag.o.c; if(drag.tg&&!drag.done) io.set(c.id,io.get(c.id)?0:1); if(drag.stk) io.set('stick',null); if(drag.mom) io.set(c.id,0); if(drag.spr){ const sv=io.get(c.id); if(c.spring===1||c.spring===true||(c.spring==='up'&&sv<0)||(c.spring==='dn'&&sv>0)) io.set(c.id,0); }
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
  return onWheel;
}

/* ---------- render state ---------- */
const cache={};
/* moving parts (.mv/.mvi/.gd) take their transform as custom properties (--bbx/--bby/--bbr/--bbsx/--bbsy, see b200.css) when the
   browser supports @property, so their transitions run on the main thread and do not lift half the panel into compositor layers */
const CPT=typeof CSS!=='undefined'&&!!G.CSSPropertyRule, TPN=['--bbx','--bby','--bbr','--bbsx','--bbsy'], TID=['0px','0px','0deg','1','1'];
function tProps(t){ const v=TID.slice(); if(t==='none'||t==='') return v; let i=0; const re=/(\w+)\(([^)]*)\)\s*/y; let m;
  while(i<t.length&&(m=(re.lastIndex=i,re.exec(t)))){ i=re.lastIndex; const a=m[2].split(',').map(x=>x.trim()), f=m[1];
    if(f==='translateX'&&!v.o) v[0]=a[0]; else if(f==='translateY'&&!v.o) v[1]=a[0]; else if(f==='translate'&&!v.o){ v[0]=a[0]; v[1]=a[1]||'0px'; }
    else if(f==='rotate'&&v.o!==2&&v.o!==3){ v[2]=a[0]; v.o=2; } else if(f==='scale'&&v.o!==3){ v[3]=a[0]; v[4]=a[1]||a[0]; v.o=3; } else if(f==='scaleX'&&v.o!==3){ v[3]=a[0]; v.o=3; } else if(f==='scaleY'&&v.o!==3){ v[4]=a[0]; v.o=3; }
    else return null; }
  return i===t.length?v:null; }
function setT(el,t){ if(!el||el._t===t) return; el._t=t;
  if(el._cp===undefined) el._cp=CPT&&(el.classList.contains('mv')||el.classList.contains('mvi')||el.classList.contains('gd'));
  const v=el._cp?tProps(t):null;
  if(v){ /* driven continuously (yoke, trim wheel, lever drag): no easing between 30 Hz updates, so the part is not animated (and
       repainted) on every frame in between; a single change still eases as before */
    const now=performance.now(), cont=now-(el._lt||-1e9)<120; el._lt=now; if(cont!==!!el._cn){ el._cn=cont; el.style.transitionDuration=cont?'0s':''; }
    if(el._ti){ el._ti=0; el.style.transform=''; } for(let i=0;i<5;i++){ const k=TPN[i], x=String(v[i]); if((el['_p'+i]||TID[i])!==x){ el['_p'+i]=x; el.style.setProperty(k,x); } } }
  else { el._ti=1; el.style.transform=t; } }
function setTx(el,t){ if(el&&el._x!==t){ el._x=t; el.textContent=t; } }
function sync(P,io){
  for(const id in P.byId){ const {c,g}=P.byId[id]; let v=io.get(id); if(c.t==='guard') v=v+'|'+io.get(id+'G'); if(c.t==='gear') v=v+'|'+io.get('gearLights'); if(c.t==='abtn'||c.t==='mbtn'||c.t==='key'||c.t==='lbtn') v=v+'|'+io.get('led:'+id)+'|'+io.get('txt:'+id); if(c.t==='lev') v=(+v).toFixed(3); if(c.t==='enc2') v=io.get(id+'O')+'|'+io.get(id+'I')+'|'+io.get('txt:'+id); if(c.t==='enc'||c.t==='rot') v=v+'|'+io.get('txt:'+id);
    if(cache[id]===v) continue; cache[id]=v; const m=g.querySelector('.mv'); const val=io.get(id);
    switch(c.t){
      case 'tog': case 'guard': setT(m,val?'scaleY(1)':'scaleY(-1)'); g.classList.toggle('on',!!val); if(c.t==='guard'){ const go=io.get(id+'G'); setT(g.querySelector('.gd'),go?'translateY(-24px) scaleY(.35)':'none'); g.setAttribute('aria-label',c.l+(go?' (guard open)':' (guard closed)')); } g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?(String(c.up||'ON').replace(/\n/g,' ')||'ON'):(String(c.dn||(c.t==='guard'?'CLOSED':'OFF')).replace(/\n/g,' ')||'OFF')); break;
      case 'tog3': g.setAttribute('aria-valuetext',c.vals[val+1]||'CENTRE'); setT(m,val<0?'scaleY(1)':val>0?'scaleY(-1)':'scaleY(.2)'); break;
      case 'rot': setT(m,`rotate(${-135+val*270}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||Math.round(val*100)+' %')); break;
      case 'enc': setT(m,`rotate(${(val*(c.deg||7))%360}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||val)); break;
      case 'enc2': setT(m,`rotate(${((io.get(id+'O')||0)*11)%360}deg)`); setT(g.querySelector('.mvi'),`rotate(${((io.get(id+'I')||0)*11)%360}deg)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||'')); break;
      case 'rotsel': setT(m,`rotate(${c.ang[val]}deg)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'push': case 'bar': case 'sbtn': g.classList.toggle('on',!!val); break;
      case 'mbtn': case 'abtn': case 'key': case 'lbtn': { const L=io.get('led:'+id); g.classList.toggle('on',!!val); g.classList.toggle('led',!!L); if(c.t==='lbtn'){ g.classList.toggle('la',L===1); g.classList.toggle('lb',L===2); }
        const tx=io.get('txt:'+id); if(tx) g.setAttribute('aria-valuetext',String(tx)); else if((c.t==='abtn'&&!c.momentary)||(c.t==='key'&&c.alt)) g.setAttribute('aria-valuetext',val?'ON':'OFF'); break; }
      case 'gear': { setT(m,val?'translateY(56px)':'none'); const L=io.get('gearLights'); g.querySelectorAll('.gl').forEach(x=>x.classList.remove('g','r')); if(L==='transit'||L==='warn'||L==='test') g.querySelector('.gU').classList.add('r'); g.setAttribute('aria-checked',val?'true':'false'); g.setAttribute('aria-valuetext',val?'DOWN':'UP'); break; }
      case 'flap': setT(m,`translateY(${val*30}px)`); g.setAttribute('aria-valuetext',c.vals[val]); break;
      case 'cb': g.classList.toggle('out',!val); g.setAttribute('aria-valuetext',val?'IN':'PULLED'); g.setAttribute('aria-pressed',val?'false':'true'); break;
      case 'pull': g.setAttribute('aria-valuetext',val?'PULLED':'IN'); g.setAttribute('aria-pressed',val?'true':'false'); setT(m,val?(c.tee?'translateY(5px)':'scale(1.22)'):'none'); g.classList.toggle('on',!!val); break;
      case 'vwheel': setT(m,`translateY(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateY(${-val*50}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'hwheel': setT(m,`translateX(${(val*60)%6}px)`); setT(g.querySelector('.trind'),`translateX(${val*36}px)`); g.setAttribute('aria-valuetext',Math.round(val*100)+''); break;
      case 'lev': { const y=(c.max-val)/(c.max-c.min)*c.len; setT(m,`translateY(${y.toFixed(1)}px)`); g.setAttribute('aria-valuetext',String(io.get('txt:'+id)||val)); break; }
    }
  }
}
function syncYokes(P,x,y){ const t=`translateY(${(y*14).toFixed(1)}px) rotate(${(x*38).toFixed(1)}deg)`; ['yokeL','yokeR','apDisc','trimUp','trimDn'].forEach(id=>{ const o=P.byId[id]; if(!o) return; setT(o.g.querySelector('.skg')||o.g.querySelector('.sbm'),t); }); }
/* gauges */
const q=(P,cls)=>{ const e=P.q[cls]; if(e!==undefined) return e; return (P.q[cls]=P.svg.querySelector('.'+cls)); };
function needle(P,id,v,k){ const g=GA[id]; if(!g) return; const sc=g.sc.find(s=>(s.nd||'')===(k||''))||g.sc[0]; const a=angOf(sc,v); const el=q(P,'nd-'+id+(k||'')); if(el){ setT(el,`rotate(${a.toFixed(1)}deg)`); } }
function text(P,cls,t){ setTx(q(P,cls),t); }
function rot(P,cls,deg,extra){ setT(q(P,cls),`rotate(${deg.toFixed(1)}deg)${extra||''}`); }
function tr(P,cls,t){ setT(q(P,cls),t); }
function vis(P,cls,on){ const el=q(P,cls); if(el&&el._v!==on){ el._v=on; el.style.opacity=on?1:0; } }
function attr(P,cls,n,v){ const el=q(P,cls); if(el&&el['_a'+n]!==v){ el['_a'+n]=v; el.setAttribute(n,v); } }
function op(P,cls,v){ const el=q(P,cls); const s=(+v).toFixed(2); if(el&&el._o!==s){ el._o=s; el.style.opacity=s; } }
function ann(P,lit,test,blink){ for(const k in ANN){ const t=test&&!k.startsWith('x:'); const on=t||!!lit[k]; const fl=!t&&lit[k]==='blink'; ANN[k].forEach(e=>{ const s=on?(fl?(blink?'on':'off'):'on'):'off'; if(e._s!==s){ e._s=s; e.classList.toggle('on',s==='on'); } }); } }
const fmtAlt=a=>{ a=Math.max(-990,Math.round(a/20)*20); const s=Math.abs(a); return (a<0?'-':'')+(s>=1000?Math.floor(s/1000)+','+String(s%1000).padStart(3,'0'):String(s).padStart(3,'0')); };
function flight(P,o,sfx){ sfx=sfx||'';
  needle(P,'asi'+sfx,o.ias); needle(P,'alt'+sfx,((o.alt%1000)+1000)%1000,'0');
  text(P,'drm-alt'+sfx,fmtAlt(o.alt)); text(P,'kol-alt'+sfx,(o.baro/33.8639).toFixed(2));
  if(sfx){ const id='adi'+sfx, rr=44; rot(P,'att-'+id,-o.roll); tr(P,'attp-'+id,`translateY(${clamp(o.pitch,-30,30)*rr*0.04}px)`); }
}
/* EFIS: EADI and EHSI */
function efis(P,d,sfx){ sfx=sfx||''; const N=c=>c.replace(/^(ea|eh)-/,'$1'+sfx+'-');
  const vis_=(c,v)=>vis(P,N(c),v), op_=(c,v)=>op(P,N(c),v), rot_=(c,v)=>rot(P,N(c),v), tr_=(c,v)=>tr(P,N(c),v), text_=(c,v)=>text(P,N(c),v), q_=c=>q(P,N(c));
  vis_('ea-off',!d.onA); vis_('eh-off',!d.onH); op_('ea-dim',0.3+0.7*d.dim); op_('eh-dim',0.3+0.7*d.dim); if(!d.onA&&!d.onH) return;
  const {k}=EA; rot_('ea-att',-d.roll); tr_('ea-pit',`translateY(${(clamp(d.pitch,-40,40)*k).toFixed(1)}px)`);
  vis_('ea-fd',!!d.fd); if(d.fd) tr_('ea-fd',`translateY(${(clamp(d.fdP,-10,10)*k).toFixed(1)}px) rotate(${clamp(d.fdR,-30,30).toFixed(1)}deg)`);
  text_('ea-lat',d.lat||''); text_('ea-latA',d.latA||''); text_('ea-vert',d.vert||''); text_('ea-vertA',d.vertA||''); text_('ea-ap',d.ap||'');
  vis_('ea-gs',d.gs!=null); if(d.gs!=null) tr_('ea-gs',`translateY(${(clamp(d.gs,-2.3,2.3)*12).toFixed(1)}px)`);
  vis_('ea-rwy',d.loc!=null); if(d.loc!=null) tr_('ea-rwy',`translate(${(clamp(d.loc,-2.3,2.3)*16).toFixed(1)}px,${(d.ra!=null&&d.ra<200?-(200-Math.max(0,d.ra))*0.11:0).toFixed(1)}px)`);
  vis_('ea-spdg',d.spd!=null); if(d.spd!=null) tr_('ea-spd',`translateY(${(clamp(d.spd,-2,2)*14).toFixed(1)}px)`);
  text_('ea-ra',d.ra!=null&&d.ra<2500?String(Math.round(d.ra/10)*10):''); text_('ea-dh','DH '+d.dh); text_('ea-dhA',d.dhA?'DH':'');
  vis_('ea-mkrg',!!d.mkr); text_('ea-mkr',d.mkr||''); tr_('ea-ball',`translateX(${(clamp(d.slip,-1,1)*8).toFixed(1)}px)`);
  const {cx,cy}=EH;
  tr_('eh-rose',d.arc?`translate(0px,${EH.h*0.24}px) scale(1.5)`:'none'); if(d.arc){ const el=q_('eh-rose'); if(el&&!el._o2){ el._o2=1; el.style.transformOrigin=cx+'px '+cy+'px'; } }
  rot_('eh-card',-d.hdg); rot_('eh-bug',d.bug-d.hdg); rot_('eh-crs',d.crs-d.hdg);
  tr_('eh-dev',`translateX(${((d.valid?clamp(d.dev,-2.3,2.3):0)*EH.R*0.25).toFixed(1)}px)`); vis_('eh-dev',d.valid); vis_('eh-tf',d.valid&&!!d.tf); tr_('eh-tf',d.tf==='FROM'?'rotate(180deg)':'none');
  vis_('eh-b1',d.b1!=null); if(d.b1!=null) rot_('eh-b1',d.b1-d.hdg); vis_('eh-b2',d.b2!=null); if(d.b2!=null) rot_('eh-b2',d.b2-d.hdg);
  text_('eh-dist',d.dist); text_('eh-et',d.et); [0,1,2,3].forEach(i=>text_('eh-s'+i,(d.src||'')[i]||'')); text_('eh-brg',d.brg||''); vis_('eh-brgbox',!!d.brgFail); text_('eh-crsv',String(Math.round(d.crs)||360).padStart(3,'0'));
  vis_('eh-gsg',d.gs!=null); if(d.gs!=null) tr_('eh-gs',`translateY(${(clamp(d.gs,-2.3,2.3)*12).toFixed(1)}px)`); text_('eh-flag',d.flag||'');
}
/* multifunction display: weather radar and map, text pages */
function mfd(P,d){
  vis(P,'mf-off',!d.on); op(P,'mf-all',0.35+0.65*d.dim); if(!d.on) return;
  const map=d.page==='map'; vis(P,'mf-txt',!map);
  if(!map){ (d.lines||[]).concat(Array(9).fill('')).slice(0,9).forEach((t,i)=>text(P,'mf-t'+i,t)); vis(P,'mf-cur',d.cur>=0); if(d.cur>=0) attr(P,'mf-cur','y',MF.y0+20+(d.cur)*14-10+12); }
  [0,1,2,3].forEach(i=>text(P,'mf-lk'+i,(d.lk||[])[i]||''));
  if(!map) return;
  const {cx,cy,R}=MF, h=(d.nup?0:d.hdg)*Math.PI/180, s=R/d.range, co=Math.cos(h), si=Math.sin(h);
  const scr=(dE,dN)=>[cx+s*(dE*co-dN*si), cy-s*(dE*si+dN*co)];
  rot(P,'mf-rose',-(d.nup?0:d.hdg));
  text(P,'mf-mode',d.mode); vis(P,'mf-nav',d.nav); text(P,'mf-hdg',(d.nup?'N UP ':'MAG1 ')+String(Math.round(d.hdg)||360).padStart(3,'0')); text(P,'mf-tilt',d.tilt); text(P,'mf-gain',d.gain||'');
  text(P,'mf-r1',String(d.range/2)); text(P,'mf-r2',String(d.range)); text(P,'mf-b1',d.b1||''); text(P,'mf-b2',d.b2||'');
  vis(P,'mf-test',d.mode==='TEST');
  (d.st||[]).forEach((o,i)=>{ const [x,y]=scr(o.e,o.n); const inb=x>MF.x0-10&&x<MF.x0+MF.w+10&&y>MF.y0-10&&y<MF.y0+MF.h+10; vis(P,'mf-st'+(i+1),d.nav&&inb); tr(P,'mf-st'+(i+1),`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`); if(i===0) attr(P,'mf-crs','d',d.nav&&o.line?`M${cx} ${cy}L${x.toFixed(1)} ${y.toFixed(1)}`:'M0 0'); });
  const g=q(P,'mf-wxg'); if(!g) return; if(!P.mfWx){ P.mfWx=[]; for(let i=0;i<24;i++){ const c=document.createElementNS(NS,'ellipse'); g.appendChild(c); P.mfWx.push(c); } }
  const cols=['#18b552','#f2c20f','#e3261b','#d23be0'];
  const sa=(c,n,v)=>{ v=String(v); if(c['_a'+n]!==v){ c['_a'+n]=v; c.setAttribute(n,v); } };
  P.mfWx.forEach((c,i)=>{ const w=d.mode==='WX'?(d.wx||[])[i]:null; if(!w){ if(c._v!==0){ c._v=0; sa(c,'rx',0); sa(c,'ry',0); } return; }
    const [x,y]=scr(w.e,w.n); const ang=Math.atan2(w.e*co-w.n*si,w.e*si+w.n*co)*180/Math.PI, dist=Math.hypot(w.e,w.n);
    const ok=Math.abs(ang)<60&&dist<d.range*1.6; c._v=1; sa(c,'cx',x.toFixed(1)); sa(c,'cy',y.toFixed(1)); sa(c,'rx',ok?(w.r*s).toFixed(1):0); sa(c,'ry',ok?(w.r*s*0.75).toFixed(1):0); sa(c,'fill',cols[clamp(w.l,0,3)]); sa(c,'opacity',(w.a||1).toFixed(2)); });
}
function gps(P,d){ vis(P,'gp-off',!d.on); if(!d.on) return; const m=!!d.map; vis(P,'gp-map',m); vis(P,'gp-txt',!m);
  if(m){ [0,1,2,3].forEach(i=>text(P,'gp-m'+i,(d.mf||[])[i]||'')); text(P,'gp-rng',d.rng+''); const {cx,cy,R}=GP, k=R/d.rng, h=(d.trk||0)*Math.PI/180, co=Math.cos(h), si=Math.sin(h);
    const scr=(e,n)=>[cx+k*(e*co-n*si), cy-k*(e*si+n*co)]; const pts=(d.wp||[]).map(w=>scr(w.e,w.n));
    attr(P,'gp-rte','d',pts.length?pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(''):'M0 0');
    const a=pts[d.act]; attr(P,'gp-leg','d',a?`M${cx} ${cy}L${a[0].toFixed(1)} ${a[1].toFixed(1)}`:'M0 0');
    pts.forEach((p,i)=>{ tr(P,'gp-w'+i,`translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)`); text(P,'gp-wt'+i,d.wp[i].id); }); return; }
  [0,1,2,3].forEach(i=>{ text(P,'gp-l'+i,d.l[i]||''); text(P,'gp-r'+i,d.r[i]||''); }); text(P,'gp-pl',d.pl||''); text(P,'gp-pr',d.pr||''); vis(P,'gp-cl',!!d.cl); vis(P,'gp-cr',!!d.cr); }
/* paint layers (panellayers.js): every unit that moves gets its own small SVG, the static artwork is painted once */
const LAYERS={dyn:'g.mod,g.gauge,g.dynu,.an,.cmp,.aitr,[class*="rd-"]',hot:c=>c.t==='lev'||c.t==='vwheel'||c.t==='hwheel'||c.t==='yoke'||['apDisc','trimUp','trimDn'].includes(c.id)};
G.B200P={SKY,LIP,fineWheel,ctrlWheel,ctlFrom:(P,t)=>ctlFromBy(P.byId,t),build:(s,io)=>{ const P=build(s,io); P.q={}; if(G.PANEL_LAYERS) G.PANEL_LAYERS.lift(P,LAYERS); return P; },sync,syncYokes,needle,text,rot,tr,vis,attr,op,ann,flight,efis,mfd,gps,REG,REG_ORDER,EFISF,W,H,WARN,CAUT,CBS};
})(window);
