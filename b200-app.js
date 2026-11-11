/* Birdbird – King Air B200 cockpit procedure trainer: page logic shared by b200.html (2D panel) and b200-3d.html (3D cockpit, beta).
   The 3D page sets data-d3 on <body> and loads cockpit3d.js + b200-3d.js; everything else is identical. */
(function(){
'use strict';
const {T,L,el,slider,visible,quiz,shuffle}=LAB;
const tr2=(en,no)=>({en,no});
LAB.add({},{
 '3D (beta)':'3D (beta)','Look around in a 3D cockpit (beta)':'Se deg rundt i en 3D-cockpit (beta)',
 'Birdbird Simulators':'Birdbird Simulatorer','King Air B200 cockpit procedure trainer':'King Air B200 prosedyretrener for cockpit',
 'A typical twin-turboprop panel: EFIS attitude and HSI displays for both pilots, a centre navigator and radar/multifunction display, round engine gauges, annunciators, subpanels and pedestal. Start the engines, test the autofeather and fly the engine-failure, fire and pressurisation drills.':'Tomotors turbopropp-panelet slik det er lagt opp i typeratingmaterialet: EFIS-attityde og -HSI for piloten, analoge instrumenter for andrepiloten, radar/flerfunksjonsskjerm i midten, runde motorinstrumenter, varsellys, underpaneler og pidestall. Start motorene, test autofeather og fly øvelsene for motorsvikt, brann og trykkfall.',
 'Cockpit':'Cockpit','Flight controls':'Flykontroller','Failures':'Feil','How it works':'Slik virker det','Test yourself':'Test deg selv','B200 type rating':'B200-typerating',
 'Procedures':'Prosedyrer','Limits':'Begrensninger','Lock view':'Lås visning','Locked':'Låst','Pause':'Pause','Resume':'Fortsett','Restart':'Start på nytt','More':'Mer','Sound on':'Lyd på','Sound off':'Lyd av','Touch stick':'Berøringsstikke','Full screen':'Fullskjerm','Outside view':'Utsikt','View out of the window':'Utsikt ut av vinduet','3D view is not available in this browser.':'3D-visning er ikke tilgjengelig i denne nettleseren.','← Whole panel':'← Hele panelet',
 'Rotate your device to landscape to use the cockpit.':'Snu enheten til liggende for å bruke cockpiten.',"For training only — follow the AFM/POH and your operator's SOP.":'Kun for trening — følg AFM/POH og operatørens SOP.','Zoom to the next control':'Zoom til neste kontroll',
 'Fly it':'Fly','Drag either control wheel on the panel, use the keyboard, a gamepad, the touch stick or this pad.':'Dra i et av rattene på panelet, eller bruk tastaturet, en spillkontroll, berøringsstikka eller denne flaten.',
 'How to use the panel':'Slik bruker du panelet','Zoom':'Zoom','Pick an area in the toolbar, double-click an empty part of the panel, or press 0–9. Esc or the back button zooms out. Lock view keeps the zoom while you work.':'Velg et område i verktøylinjen, dobbeltklikk på en tom del av panelet, eller trykk 0–9. Esc eller tilbakeknappen zoomer ut. «Lås visning» holder zoomen mens du jobber.',
 'Switches':'Brytere','Click a toggle to flip it. Three-position switches: click the top or bottom half to select that position, the middle to return to the centre. Guarded switches: the first click lifts the guard.':'Klikk på en vippebryter for å slå den om. Tre-stillingsbrytere: klikk på øvre eller nedre halvdel for å velge den stillingen, midten for å gå tilbake til midtstilling. Brytere med deksel: første klikk løfter dekselet.',
 'Levers':'Hendler','Drag the power, propeller and condition levers up and down; they snap to their detents. Beta and reverse (below IDLE) work on the ground only. The scroll wheel and the arrow keys move a lever in small steps.':'Dra effekt-, propell- og condition-hendlene opp og ned; de smetter inn i hakkene. Beta og revers (under IDLE) virker bare på bakken. Musehjulet og piltastene flytter en hendel i små steg.',
 'Knobs':'Knotter','Scroll on a knob or drag across it. HDG and CRS set the heading bug and the course on the HSI, ALT SEL the altitude alerter, CABIN ALT and RATE the pressurisation controller.':'Rull på en knott eller dra over den. HDG og CRS stiller kursmerket og kursen på HSI-en, ALT SEL høydevarsleren, CABIN ALT og RATE trykkontrolleren.',
 'Control wheel':'Ratt','Drag · releases to centre':'Dra · slipp for å sentrere','Assisted handling (attitude hold, auto-trim, rudder assist)':'Assistert styring (attitydehold, auto-trim, sideror-hjelp)','Rudder and brakes':'Sideror og bremser','Hold for brakes':'Hold for bremser',
 'Make it harder':'Gjør det vanskeligere','Engines':'Motorer','Flame out an engine at any time. With the autofeather armed and both power levers forward, the failed propeller feathers itself.':'Stopp en motor når som helst. Med autofeather armert og begge effekthendlene fremme fløyes propellen på motoren som stoppet automatisk.',
 'Fail left':'Stopp venstre','Fail right':'Stopp høyre','Fire left':'Brann venstre','Fire right':'Brann høyre','Restore both engines':'Gjenopprett begge motorene',
 'Pressurisation':'Trykkabin','Ground power':'Bakkestrøm','Plug a ground power unit in on the ramp (EXT PWR light). With the battery ON, EXT PWR — ON puts it on line.':'Koble til en bakkestrømenhet på oppstillingsplassen (EXT PWR-lys). Med batteriet PÅ kobler EXT PWR — ON den inn.','Plug in ground power':'Koble til bakkestrøm','Unplug ground power':'Koble fra bakkestrøm','Lose the cabin pressure. The cabin climbs towards the aircraft altitude; ALT WARN comes on at 12,500 ft cabin altitude.':'Mist kabintrykket. Kabinen stiger mot flyets høyde; ALT WARN tennes ved 12 500 ft kabinhøyde.','Decompression':'Trykkfall','Wind':'Vind',
 'Understand':'Forstå','How the model works':'Slik virker modellen','Engine start':'Motorstart',
 'IGN & START ON runs the starter and the igniters (IGNITION ON). Introduce fuel with the condition lever at LOW IDLE at a stabilised 12 % N1 or more. Fuel too early, a weak start or high idle gives a hotter start; above 1,000 °C ITT is a hot start. Starter OFF at about 50 % N1, then GEN RESET and ON.':'IGN & START ON kjører starteren og tennpluggene (IGNITION ON). Gi drivstoff med condition-hendelen på LOW IDLE ved stabile 12 % N1 eller mer. For tidlig drivstoff, svak start eller high idle gir varmere start; over 1000 °C ITT er en «hot start». Starter AV ved rundt 50 % N1, deretter GEN RESET og ON.',
 'Autofeather':'Autofeather','Armed with the switch at ARM and both power levers above about 90 % N1: two green AUTOFEATHER lights. Below 400 ft-lb on one engine the other side disarms; below 200 ft-lb the failing propeller feathers. TEST bypasses the power-lever switches so you can check it at low power.':'Armert med bryteren på ARM og begge effekthendlene over ca. 90 % N1: to grønne AUTOFEATHER-lys. Under 400 ft-lb på én motor desarmeres den andre siden; under 200 ft-lb fløyes propellen på motoren som svikter. TEST forbigår hendelbryterne slik at du kan sjekke systemet på lav effekt.',
 'Propellers':'Propeller','The propeller lever sets the governed rpm, 1,600 to 2,000. Pulled through the gate it feathers the propeller. Below IDLE the power lever controls the blade angle directly: beta for taxi, reverse for braking.':'Propellhendelen stiller turtallet regulatoren holder, 1600 til 2000. Trukket gjennom porten fløyes propellen. Under IDLE styrer effekthendelen bladvinkelen direkte: beta for taksing, revers for bremsing.',
 'Bleed air from each engine pressurises the cabin. The controller holds the selected cabin altitude until the differential reaches about 6.5 psi. Dump, no bleed air or a leak lets the cabin climb to the aircraft altitude.':'Tappeluft fra hver motor setter kabinen under trykk. Kontrolleren holder valgt kabinhøyde til trykkforskjellen når ca. 6,5 psi. Dump, ingen tappeluft eller en lekkasje lar kabinen stige til flyets høyde.',
 'Annunciators':'Varsellys','Red is a warning, yellow a caution, green an advisory. A new red or yellow light flashes MASTER WARNING or MASTER CAUTION on the glareshield; press it to acknowledge.':'Rødt er en varsling, gult en advarsel, grønt informasjon. Et nytt rødt eller gult lys blinker MASTER WARNING eller MASTER CAUTION på glareskjermen; trykk på den for å kvittere.',
 'What is simplified':'Hva som er forenklet','The flight model is a generic twin tuned to B200-like numbers. Gauges, limits and procedures are typical values for learning: no serial-number differences, no AC bus, no fuel transfer.':'Flymodellen er et generelt tomotorsfly justert til B200-lignende tall. Instrumenter, begrensninger og prosedyrer er typiske verdier for læring: ingen forskjeller mellom serienumre, ingen AC-skinne, ingen drivstoffoverføring.',
 'Keyboard':'Tastatur','Pitch and roll. Up is nose down, like a control wheel. Hold':'Stigning og krengning. Opp er nese ned, som et ratt. Hold','for more.':'for mer.','or':'eller',
 'Rudder left and right · centre the rudder':'Sideror venstre og høyre · sentrer sideroret','Both power levers forward and back (not below IDLE)':'Begge effekthendlene frem og tilbake (ikke under IDLE)','Elevator trim nose down and up':'Trim nese ned og opp',
 'Flaps down and up · gear · brakes while held':'Flaps ned og opp · understell · bremser mens du holder','Autopilot disconnect · pause':'Koble ut autopilot · pause','Zoom to a part of the panel · back to the whole panel':'Zoom til en del av panelet · tilbake til hele panelet','Move between panel controls; arrows, Space and Enter operate them':'Flytt mellom kontrollene på panelet; piltaster, mellomrom og Enter betjener dem',
 'Check':'Sjekk','Questions from the B200 type rating question bank, in English (the type rating language).':'Spørsmål fra spørsmålsbanken for B200-typerating, på engelsk (språket på typeratingen).',
 "Teaching model, not a certified simulator or an approved checklist, and not affiliated with any aircraft, engine or avionics manufacturer or any operator. Procedures here are generic and for training only — follow the AFM/POH and your operator's SOP. Numbers are typical King Air B200 values that vary with serial number and modifications; verify every figure in your approved documents.":'Pedagogisk modell, ikke en sertifisert simulator eller godkjent sjekkliste, og ikke tilknyttet noen fly-, motor- eller avionikkprodusent eller operatør. Prosedyrene er generelle og kun for trening — følg AFM/POH og operatørens SOP. Tallene er typiske King Air B200-verdier som varierer med serienummer og modifikasjoner; kontroller alle tall i godkjente dokumenter.',
 'Flying':'Flyr','Paused':'Pause','Crashed':'Havarert','On ground':'På bakken','Rudder':'Sideror','From':'Fra','Speed':'Fart','Turbulence':'Turbulens','Cockpit tools':'Cockpitverktøy','Procedure':'Prosedyre','Scenario':'Scenario'
});

/* ---------- aircraft: B200-like numbers on the shared flight model ---------- */
const F=FDM, KT=F.KT;
Object.assign(F.AC,{name:'B200',m:5300,S:28.15,b:16.61,c:1.98,Ixx:26000,Iyy:30000,Izz:50000,CL0:0.25,CLa:5.2,CLmax:1.30,
  flaps:[{n:'UP',dCL:0,dCLmax:0,dCD:0,dCm:0},{n:'APPR',dCL:0.22,dCLmax:0.30,dCD:0.012,dCm:-0.03},{n:'DN',dCL:0.50,dCLmax:0.80,dCD:0.055,dCm:-0.06}],
  CD0:0.024,k:0.045,gearCD:0.018,CnR:0.06,Pmax:634000,Tstatic:11000,Aprop:Math.PI*1.25*1.25,yEng:2.6,xMain:0.2,wheelbase:4.5,fuelCap:1e6,
  V:{s0:75,s1:99,fe1:200,fe2:157,no:259,ne:259,mc:86,yse:121,r:100,y:125,le:181,lo:163}});
const S=F.create(), AP=F.mkAP();
const UI={paused:false,sound:true};
const inp={keys:new Set(),stick:null,brakeHeld:false};
const SIDES=['L','R'];

/* ---------- systems state ---------- */
const SYS={}; const E=[0,1].map(()=>({}));
const NAVS={'110.30':'LOC','113.30':'VOR'};
const NDB={id:'AN',freq:375,N:-7600,E:0}, MKR=[{k:'O',N:-7600,E:0},{k:'M',N:-1100,E:0}];
const XN=['xpdrMd','com1Md','com2Md','nav1Md','nav2Md','adfMd'];
function engReset(e,run){ Object.assign(e,{ng:run?61:0,itt:run?560:15,np:run?800:0,tq:run?120:0,ff:run?150:0,oilP:run?95:0,oilT:run?55:15,lit:!!run,fail:false,fire:false,fireT:0,ext:false,ngLight:0,hotT:0,dmg:false,startT:0,hung:false,autoF:false,fwShut:false,afCyc:0,afArm:false,vane:0,vaneT:0,genOn:!!run,genRst:!!run,fwT:0,stT:0,main:1180,aux:420,nxT:0,xfr:false,warnedEarly:false}); }
function sysDefault(cold){
  const w=cold?0:1;
  Object.assign(SYS,{bat:w,genL:cold?1:0,genR:cold?1:0,avio:w,ignL:0,ignR:0,aignL:0,aignR:0,afSw:0,sync:0,beacon:w,strobe:0,navLt:w,recog:0,taxi:0,landL:0,landR:0,iceLt:0,tailFl:0,park:cold?1:0,
    engAIL:0,engAIR:0,actL:0,actR:0,surf:0,propDe:0,wsP:0,wsC:0,pitL:w,pitR:w,fvL:w,fvR:w,stallHt:w,govT:0,pilotAir:0,defrost:0,cabAir:0,copAir:0,
    cabAlt:0,cabRate:0.4,pressSw:0,annTest:0,fireTestL:0,fireTestR:0,stallTest:0,extPwr:0,busSense:0,genTies:0,tieOpen:0,gndIdle:0,envBleed:1,aftHeat:0,fastErect2:0,dhK2:0.2,raT2:0,
    bleedL:-1,bleedR:-1,cabMode:3,cabTemp:0.5,blower:1,manTemp:0,aftBlow:0,elecHeat:0,furn:w,cabLt:1,signs:cold?1:0,rudBoost:1,elTrim:1,mask:0,paxOvr:0,o2Ready:w,inv:cold?0:-1,brakeDe:0,micSel:1,micSelR:1,
    stbyL:0,stbyR:0,xfeed:0,auxL:0,auxR:0,fqSel:1,fwL:1,fwR:1,fwLG:0,fwRG:0,altStatic:0,altStaticG:0,
    pwrL:0,pwrR:0,propL:1,propR:1,condL:cold?0:0.5,condR:cold?0:0.5,trim:0.05,rudTrim:0,ailTrim:0.5,frPwr:0.5,frProp:0.5,frCond:0.5,frFlap:0.5,
    hdgK:0,crsK:0,baroK:0,baro2K:0,crs2K:0,altSel:0,apPitch:0,apTurn:0.5,apSR:0,apHB:0,bcMode:0,
    mpl:0,wiper:1,dimPF:0.75,dimEng:0.75,dimFlood:0.3,dimInd:0.6,dimAv:0.75,dimCons:0.6,dimSide:0.6,dimCG:0.75,dimCF:0.75,
    gyroMode:0,gyro2Mode:0,hdgErr1:cold?14:0,hdgErr2:cold?-9:0,dmePwr:1,dme2Pwr:1,d1ch:1,d2ch:2,d1sel:0,d2sel:0,dhK:0.2,
    autoCommP:1,autoCommC:1,spkrP:1,spkrC:1,audEmer:0,voiceP:0,voiceC:0,sideP:0.5,sideC:0.5,sensP:0.5,sensC:0.5,dmeV1:0.6,dmeV2:0.6,encAlt:1,pageVol:0.5,intphVol:0.5,hotIntph:0,mkrVol:0.6,annBrt:0.8,mkrHi:0,gndComm:0,micP:0,micC:1,volP:0.6,volC:0.6,xpdr12:1,oatF:0,
    mem:{com1:['118.10','121.50','119.70','122.80','121.90','118.30'],com2:['119.70','119.10','121.50','122.80','121.90','118.30'],nav1:['113.30','110.30','112.10','114.50'],nav2:['110.30','113.30','112.10','114.50'],adf:['375','287','350','410']},memI:{com1:1,com2:1,nav1:1,nav2:1,adf:1},stoT:{},chgT:{},
    com1Md:1,com2Md:1,nav1Md:1,nav2Md:1,adfMd:2,xpdrMd:cold?1:3,com1Act:0,com2Act:0,nav1Act:0,nav2Act:0,adfAct:0,
    mwL:0,mcL:0,mwR:0,mcR:0,fireL:0,fireR:0,cb:{},yd:0,paxDep:0,hornSilOn:0,asF:0,asVs:0,trimHat:0,apClimb:0,apDsc:0,acRun:0,acLow:0,gearH:1,pumpN:0,hornSil:0,hobbs:1234.5,o2psi:1820,cabT:72,
    cabSel:3500,cab:0,cabVS:0,decomp:false,battT:0,apFailT:0,hypT:0,
    com1:{a:'118.10',s:'121.50'},com2:{a:'119.70',s:'119.10'},nav1:{a:'113.30',s:'110.30'},nav2:{a:'110.30',s:'113.30'},adf:{a:'375',s:'287'},crs:360,crs2:360,xpdr:'7000',xpre:'1200',identT:0,dmeHold:[null,null,null],dmeGs:[0,0,0],dmeLast:[null,null,null],
    efisAux:cold?0:-1,efisHorn:0,efisDim:0.85,auxBat:1800,auxTestT:0,auxHornSil:0,altT:0,tcasAB:0,tcasR:0,tcasAB2:0,tcasR2:0,tcasM:0,tcasRng:6,tcasM2:0,tcasRng2:6,gpwsT:0,bgsC:0,gpwsT2:0,bgsC2:0,gpwsFlap:0,gpwsTestT:0,gsCxl:0,gpwsW:0,bgsW:0,
    gpsCrs:0,gpsApr:0,gpsOn:1,gpsInitT:0,gpsPgL:0,gpsPgR:0,gpsCurL:0,gpsCurR:0,gpsMsgT:0,gpsAltT:0,gpsWpt:'RW36',gpsDtoPend:0,altAck:0,altCx:0,propDeA:0,propDeM:0,
    mfdPwr:1,mfdMode:cold?0:1,mfdNavOn:1,mfdPage:'map',mfdPrev:'map',mfdRng:2,mfdNup:0,mfdWx:1,mfdGain:0,mfdData:0.85,mfdTilt:0,mfdChk:0,efisSrc:0,brgSel1:1,brgSel2:0,efisArc:0,etState:0,etT:0});
  [0,1,2,3,4,5,6,7,8].forEach(i=>{ SYS['auP'+i]=[1,0,1,0,1,0,1,0,0][i]; SYS['auC'+i]=[0,1,0,1,0,1,0,1,0][i]; });
  ['com1','com2','nav1','nav2','adf'].forEach(k=>{ SYS[k+'Vol']=0.6; SYS[k+'X']=0; });
  ['com1K','com2K','nav1K','nav2K','xpdrK','adfK'].forEach(k=>{ SYS[k+'O']=0; SYS[k+'I']=0; });
  SYS.fcOff=0; SYS.cab=S.h/F.FT||0; P.CBS.forEach(c=>SYS.cb[c.k]=1); SYS.cb.GEAR=1;
  E.forEach(e=>engReset(e,!cold)); S.eng.forEach(e=>{ e.fail=false; e.feather=false; });
  MW.ackR=new Set(); MW.ackA=new Set(); MW.w=false; MW.c=false;
}
const MW={ackR:new Set(),ackA:new Set(),w:false,c:false};
const fuelUsed=()=>E.reduce((a,e)=>a+Math.max(0,1600-(e.main+e.aux)),0);
const cbIn=n=>SYS.cb[n]!==0;
const bus=()=>SYS.bat===1||E.some(e=>e.genOn);
/* external power: the relay closes only with a unit plugged in, EXT PWR at ON and the battery switch ON (manual ch. 2, ground power) */
const extOn=()=>!!GPU.on&&SYS.extPwr===-1&&SYS.bat===1&&S.ground;
const GPU={on:false};
/* five-bus ties: GEN TIES OPEN or a BUS SENSE test opens the generator ties (battery isolated from the generators) */
const tiesOpen=()=>SYS.genTies===1||!!SYS.tieOpen;
const fwOpen=i=>!!SYS['fw'+SIDES[i]]&&!E[i].fwShut;
const fireDet=i=>SYS['fireTest'+SIDES[i]]===-1, fireExtT=i=>SYS['fireTest'+SIDES[i]]===1;
const avOn=()=>bus()&&(SYS.avio===1||!cbIn('AV MASTER'));
const radOn=k=>{ const cb={com1:'COMM 1',com2:'COMM 2',nav1:'NAV 1',nav2:'NAV 2',xpdr:'XPDR',adf:'ADF'}[k]; if(k==='com1'&&SYS.gndComm&&SYS.bat===1&&!avOn()) return SYS.com1Md>0; return avOn()&&cbIn(cb)&&SYS[k+'Md']>0; };
const feathered=i=>SYS['prop'+SIDES[i]]<0.03||E[i].autoF;
const idleNg=i=>{ const c=SYS['cond'+SIDES[i]]; return 61+Math.max(0,(c-0.5)/0.5)*9; };

/* ---------- panel ---------- */
const PST=el('stage');
const IO={get:k=>ioGet(k),set:(k,v)=>ioSet(k,v),intercept:()=>false};
const P=B200P.build(PST,IO);
/* 3D cockpit (beta page only: <body data-d3>): set up after the outside world, see d3Init() */
const D3=document.body.dataset.d3?window.B200_3D:null; let D3on=false;
const CBK={}; P.C.forEach(c=>{ if(c.t==='cb') CBK[c.id]=c.cb; });
function ioGet(k){
  if(k==='gear') return SYS.gearH; if(k==='flaps') return S.ctl.flap; if(k==='trim') return S.ctl.trim;
  if(k==='gearLights'){ if(!bus()||!cbIn('GEAR IND')) return 'off'; if(SYS.hdLt) return 'test'; const g=S.ctl.gearPos; return Math.abs(g-SYS.gearH)>0.01?'transit':(gearWarn()||(SYS.stallTest===1&&cbIn('GEAR WARN')))?'warn':g>0.99?'down':'up'; }
  if(k.startsWith('led:')) return ledOf(k.slice(4));
  if(k.startsWith('txt:')) return txtOf(k.slice(4));
  if(CBK[k]) return SYS.cb[CBK[k]];
  return SYS[k]??0;
}
function ledOf(id){ const b=bus(); if(!b) return false;
  if(id==='mwL'||id==='mwR') return (MW.w&&blinkOn())||!!SYS.annTest; if(id==='mcL'||id==='mcR') return (MW.c&&blinkOn())||!!SYS.annTest;
  if(id==='fireL'||id==='fireR'){ const i=id==='fireL'?0:1; return E[i].fire||(fireDet(i)&&cbIn('FIRE DET'))||fireExtT(i)||SYS.annTest; }
  if(id==='dmePwr') return avOn()&&!!SYS.dmePwr; if(id==='dme2Pwr') return avOn()&&!!SYS.dme2Pwr;
  if(id==='gyroMode') return !!SYS.gyroMode; if(id==='gyro2Mode') return !!SYS.gyro2Mode; if(id==='gndComm') return !!SYS.gndComm;
  if(/^(com1|com2|nav1|nav2|adf)Act$/.test(id)) return radOn(id.slice(0,-3))&&!!SYS[id];
  if(id==='gpsCrs') return gpsOk()?(SYS.gpsCrs?1:2):0;
  if(id==='gpsApr') return gpsOk()&&SYS.gpsApr?(gpsAprActive()?2:1):0;
  if(id==='gpwsFlap') return !!SYS.gpwsFlap;
  if(id==='gpwsT'||id==='gpwsT2') return !!SYS.gpwsW||SYS.gpwsTestT>0||!!SYS.annTest;
  if(id==='bgsC'||id==='bgsC2') return !!SYS.bgsW||SYS.gpwsTestT>0||!!SYS.annTest;
  if(id==='altAck') return !!annLit['x:altAl1'];
  if(id==='mfdPwr') return avOn()&&!!SYS.mfdPwr&&cbIn('MFD');
  if(id==='xpdrId') return radOn('xpdr')&&SYS.identT>0;
  if(id.startsWith('ap')){ const k=id.replace(/^ap2?/,''); if(!avOn()||!cbIn('AUTOPILOT')) return false; const n=AP.lat, a=AP.latArm, v=AP.vert;
    return ({AP:AP.on,YD:!!SYS.yd,HDG:n==='HDG',NAV:(n==='VOR'||a==='NAV')&&!SYS.bcMode,APPR:n==='LOC'||n==='VAPP'||a==='APR',BC:!!SYS.bcMode&&(AP.fd||AP.on),CLIMB:v==='FLC'&&SYS.apClimb,DSC:v==='VS'&&SYS.apDsc,ALT:v==='ALT',ALTSEL:/ALTS/.test(AP.vertArm),VS:v==='VS'&&!SYS.apDsc,IAS:v==='FLC'&&!SYS.apClimb,SR:!!SYS.apSR,HB:!!SYS.apHB})[k]||false; }
  return false; }
const blinkOn=()=>(performance.now()/350|0)%2===0;
const fmtF=(v,d)=>(+v).toFixed(d);
function txtOf(id){ const i=/[LR]$/.test(id)?(id.endsWith('L')?0:1):0;
  if(id.startsWith('pwr')){ const v=SYS[id]; return v>=0?Math.round(v*100)+' % (torque '+Math.round(E[i].tq)+' ft-lb)':v<-0.12?'REVERSE':'BETA'; }
  if(/^prop[LR]$/.test(id)){ const v=SYS[id]; return v<0.03?'FEATHER':Math.round(1600+400*Math.max(0,v-0.12)/0.88)+' RPM'; }
  if(id.startsWith('cond')){ const v=SYS[id]; return v<0.05?'FUEL CUTOFF':v<0.55?'LOW IDLE':v>0.95?'HIGH IDLE':'between LOW and HIGH IDLE'; }
  if(id==='hdgK') return 'HDG '+String(Math.round(AP.hdg)).padStart(3,'0'); if(id==='crsK') return 'CRS '+String(SYS.crs).padStart(3,'0'); if(id==='crs2K') return 'CRS '+String(SYS.crs2).padStart(3,'0');
  if(id==='baroK'||id==='baro2K') return Math.round(S.baro)+' hPa';
  if(id==='altSel') return AP.alt+' ft';
  if(id==='mfdTilt') return 'TILT '+(SYS.mfdTilt>0?'UP ':SYS.mfdTilt<0?'DN ':'')+Math.abs(SYS.mfdTilt/2).toFixed(1)+'°';
  if(id==='gpsKL') return ['NAV','FPL','MODE','TRIP'][SYS.gpsPgL]; if(id==='gpsKR') return ['APT','VOR','NDB','INT','SUPL'][SYS.gpsPgR];
  if(id==='gpsCrs') return SYS.gpsCrs?'OBS':'LEG'; if(id==='gpsApr') return SYS.gpsApr?(gpsAprActive()?'ACTV':'ARM'):'OFF';
  if(id==='efisCrsSel') return 'NAV '+(SYS.efisSrc+1); if(id==='efisBrg1') return ['OFF','NAV 1','ADF'][SYS.brgSel1]; if(id==='efisBrg2') return ['OFF','NAV 2','ADF'][SYS.brgSel2]; if(id==='efisFmt') return SYS.efisArc?'ARC':'FULL'; if(id==='efisEt') return ['RESET','RUN','STOP'][SYS.etState];
  if(id==='tcasAB') return ['NORMAL','ABOVE','BELOW'][SYS.tcasM]; if(id==='tcasR') return SYS.tcasRng+' NM'; if(id==='tcasAB2') return ['NORMAL','ABOVE','BELOW'][SYS.tcasM2]; if(id==='tcasR2') return SYS.tcasRng2+' NM'; if(id==='cabAlt') return 'cabin '+SYS.cabSel+' ft';
  if(id==='com1K'||id==='com2K'||id==='nav1K'||id==='nav2K'||id==='adfK'){ const r=SYS[id.slice(0,-1)]; return (SYS[id.slice(0,-1)+'Act']?'active ':'preset ')+(SYS[id.slice(0,-1)+'Act']?r.a:r.s); }
  if(id==='xpdrK') return 'code '+SYS.xpdr; if(id==='dhK') return 'DH '+Math.round(dhFt())+' ft'; if(id==='apTurn') return Math.abs(SYS.apTurn-0.5)<0.04?'centre (detent)':(SYS.apTurn<0.5?'L ':'R ')+Math.round(Math.abs(SYS.apTurn-0.5)*50)+'°';
  if(id==='cabTemp') return Math.round(60+SYS.cabTemp*25)+' °F'; if(id==='cabRate') return Math.round(200+SYS.cabRate*1800)+' ft/min';
  if(id==='ailTrim') return SYS.ailTrim<0.47?'L wing down':SYS.ailTrim>0.53?'R wing down':'neutral';
  if(id.startsWith('vol')) return Math.round(SYS[id]*100)+' %';
  return ''; }
const dhFt=()=>Math.round(SYS.dhK*1000/10)*10;
const NAME={bat:'BATTERY',genL:'GEN 1',genR:'GEN 2',avio:'AVIONICS MASTER',ignL:'IGN & START L',ignR:'IGN & START R',aignL:'AUTO IGNITION L',aignR:'AUTO IGNITION R',afSw:'AUTOFEATHER',fwL:'FIREWALL VALVE L',fwR:'FIREWALL VALVE R',stbyL:'STBY PUMP L',stbyR:'STBY PUMP R',xfeed:'CROSSFEED',pressSw:'CABIN PRESS',bleedL:'BLEED AIR L',bleedR:'BLEED AIR R',park:'PARKING BRAKE',gear:'GEAR',flaps:'FLAPS',inv:'INVERTER',mask:'CREW O2 MASK',paxOvr:'PAX O2 MANUAL OVERRIDE',micSel:'PILOT MIC',altStatic:"PILOT'S STATIC AIR SOURCE"};
function descr(k){ const o=P.byId[k]; if(!o) return null; const c=o.c, v=ioGet(k), n=NAME[k]||c.lbl||c.l;
  const st=c.t==='rotsel'?c.vals[v]:c.t==='tog3'?(c.vals[v+1]||'CENTRE'):c.t==='flap'?c.vals[v]:c.t==='lev'?txtOf(k):c.t==='pull'?(v?'PULLED':'IN'):c.t==='cb'?(v?'IN':'PULLED'):c.t==='guard'?(v?(c.up||'ON'):(k==='altStatic'?'NORMAL':'CLOSED')):c.t==='gear'?(v?'DOWN':'UP'):c.t==='abtn'?(v?'ON':'OFF'):(c.t==='key'||c.t==='lbtn')?(txtOf(k)||(v?'ON':'OFF')):(v?(c.up||'ON'):(c.dn||'OFF')); return String(n+' '+st).replace(/\n/g,' '); }
var slowForce=true; // panel: refresh the 10 Hz read-outs on the next frame (set by any control input)
function ioSet(k,v){
  ensureAudio(); slowForce=true;
  if(k==='stick'){ inp.stick=v; return; }
  if(k==='apDisc'){ SYS[k]=v; if(v&&AP.on){ AP.on=false; apDiscFx(); } return; }
  if(k==='trimUp'||k==='trimDn'){ SYS[k]=v; SYS.trimHat=v?(k==='trimUp'?1:-1):0; return; }
  if(k.endsWith(':d')){ encTurn(k.slice(0,-2),v); return; }
  if(k.endsWith(':o')||k.endsWith(':i')){ enc2Turn(k.slice(0,-2),k.endsWith(':i'),v); return; }
  const o=P.byId[k];
  if(k==='mwL'||k==='mwR'){ if(v){ MW.w=false; MW.ackR=new Set(curR); click(); procTouch(k); } SYS[k]=v; return; }
  if(k==='mcL'||k==='mcR'){ if(v){ MW.c=false; MW.ackA=new Set(curA); click(); procTouch(k); } SYS[k]=v; return; }
  if(k==='fireL'||k==='fireR'){ SYS[k]=v; if(v){ const i=k==='fireL'?0:1; E[i].fwShut=true; /* hot battery bus: works with the master switch off */ if(!E[i].ext){ E[i].ext=true; beep(300,0.25,0.06); msg(tr2((i?'Right':'Left')+' firewall fuel valve closed and extinguisher discharged — D light on',(i?'Høyre':'Venstre')+' brannskott-drivstoffventil lukket og brannslukker utløst — D-lyset tennes')); } procTouch(k); } return; }
  if(k==='extPwr'){ const o0=SYS.extPwr; SYS.extPwr=v; if(v!==o0) beep(260,0.025,0.06); if(v===1){ flash(L(tr2('EXT PWR RESET: resets the external power relay','EXT PWR RESET: tilbakestiller reléet for ekstern strøm'))); } else if(v===-1){ flash(GPU.on?(SYS.bat===1?L(tr2('External power ON line','Ekstern strøm tilkoblet')):L(tr2('EXT PWR: the relay closes only with the battery switch ON','EXT PWR: reléet lukker bare med batteribryteren PÅ'))):L(tr2('EXT PWR ON — no ground power unit plugged in','EXT PWR ON — ingen bakkestrømenhet tilkoblet'))); } else flash('EXT PWR OFF'); procTouch(k); return; }
  if(k==='busSense'){ SYS.busSense=v; if(v){ beep(260,0.025,0.06); if(bus()){ if(v===1){ SYS.tieOpen=1; flash(L(tr2('BUS SENSE TEST: bus ties open — L/R GEN TIE OPEN and BATT TIE OPEN','BUS SENSE TEST: busskoblingene åpner — L/R GEN TIE OPEN og BATT TIE OPEN'))); } else { SYS.tieOpen=0; flash(L(tr2('BUS SENSE RESET: bus ties closed','BUS SENSE RESET: busskoblingene lukket'))); } } } procTouch(k); return; }
  if(k==='genTies'){ const o0=SYS.genTies; SYS.genTies=v; if(v!==o0) beep(260,0.025,0.06); if(v===-1){ SYS.tieOpen=0; flash(L(tr2('GEN TIES MAN CLOSE: generator ties closed','GEN TIES MAN CLOSE: generatorkoblingene lukket'))); } else flash('GEN TIES '+(v===1?'OPEN':'NORM')); procTouch(k); return; }
  if(k==='dhK2'){ SYS.dhK2=SYS.dhK=v; return; }
  if(k==='raT2'){ SYS.raT2=v; SYS.raT=v; if(v) click(); return; }
  if(k==='gndIdle'){ SYS[k]=v; if(v){ click(); flash(L(tr2('PROP TEST GND IDLE STOP: ground idle stop solenoids released (props to the flight idle stop)','PROP TEST GND IDLE STOP: bakketomgang-stoppet utløst (propellene til flight idle-stoppet)'))); } return; }
  if(/^ap2?(AP|YD|HDG|NAV|APPR|BC|CLIMB|ALT|ALTSEL|VS|IAS|DSC)$/.test(k)){ SYS[k]=v; if(v) apPress(k.replace(/^ap2?/,'')); return; }
  if(k==='gang'){ SYS.gang=v; if(v){ SYS.bat=0; SYS.genL=1; SYS.genR=1; beep(260,0.04,0.06); flash(L(tr2('MASTER SWITCH gang bar: battery and both generators OFF','MASTER SWITCH-stangen: batteri og begge generatorer AV'))); procTouch('bat'); } return; }
  if(/^(com1|com2|nav1|nav2|adf)X$/.test(k)){ SYS[k]=v; const r=k.slice(0,-1); if(v&&radOn(r)){ const f=SYS[r];
      if(v<0){ [f.a,f.s]=[f.s,f.a]; SYS.chgT[r]=performance.now(); click(); procTouch('navSw'); }
      else { const m=SYS.mem[r]; SYS.memI[r]=(SYS.memI[r]+1)%m.length; f.s=m[SYS.memI[r]]; click(); flash(r.toUpperCase().replace(/(\d)/,' $1')+' — MEM CH '+(SYS.memI[r]+1)+': '+f.s); } } return; }
  if(/^(com1|com2|nav1|nav2|adf)Sto$/.test(k)){ SYS[k]=v; const r=k.slice(0,-3); if(v&&radOn(r)){ click(); const t=performance.now();
      if(t-(SYS.stoT[r]||-1e9)<5000){ SYS.mem[r][SYS.memI[r]]=SYS[r].s; SYS.stoT[r]=-1e9; flash(L(tr2('Stored in memory channel ','Lagret i minnekanal '))+(SYS.memI[r]+1)+': '+SYS[r].s); }
      else { SYS.stoT[r]=t; flash(L(tr2('STO: push again within 5 s to store the preset in channel ','STO: trykk igjen innen 5 s for å lagre forvalgt i kanal '))+(SYS.memI[r]+1)); } } return; }
  if(k==='oatF'){ SYS[k]=v; if(v) click(); return; }
  if(k==='fcRst'){ SYS[k]=v; if(v){ click(); SYS.fcOff=fuelUsed(); } return; }
  if(k==='gpwsT'||k==='gpwsT2'){ SYS[k]=v; if(v){ click(); if(avOn()&&cbIn('GPWS')){ SYS.gpwsTestT=S.ground?4:1.2; beep(620,0.5,0.05); flash(L(tr2('GPWS self-test: GPWS, BELOW G/S and GPWS INOP lights, "glideslope" and "pull up" tones','GPWS selvtest: GPWS-, BELOW G/S- og GPWS INOP-lys, «glideslope»- og «pull up»-toner'))); } } return; }
  if(k==='bgsC'||k==='bgsC2'){ SYS[k]=v; if(v){ click(); if(avOn()&&cbIn('GPWS')&&(SYS.bgsW||(curNav.gs&&S.o&&S.o.agl<2000))){ SYS.gsCxl=1; flash(L(tr2('Below-glideslope alert cancelled (G/S CANCLD)','Under-glidebane-varsel kansellert (G/S CANCLD)'))); } } return; }
  if(k==='altAck'){ SYS[k]=v; if(v){ click(); if(annLit['x:altAl1']) SYS.altCx=1; } return; }
  if(k==='efisHorn'){ SYS[k]=v; if(v){ click(); SYS.auxHornSil=1; } return; }
  if(k==='altT'){ SYS[k]=v; if(v) click(); return; }
  if(/^tcas(AB|R)2?$/.test(k)){ SYS[k]=v; if(v){ click(); const n=k.endsWith('2')?'2':''; if(k.startsWith('tcasAB')) SYS['tcasM'+n]=(SYS['tcasM'+n]+1)%3; else SYS['tcasRng'+n]=({6:12,12:3,3:6})[SYS['tcasRng'+n]]||6; } return; }
  if(/^mfd(Rdr|Nav|Rmt|Pge|Emg|L1|L2|L3|L4|Up|Dn|Rcl|Skp|Clr)$/.test(k)){ SYS[k]=v; if(v){ click(); mfdKey(k.slice(3)); } return; }
  if(/^gps(CrsrL|CrsrR|Msg|Alt|Dto|Clr|Ent|Pwr)$/.test(k)){ SYS[k]=v; if(v){ click(); gpsKey(k.slice(3)); } return; }
  if(/^efis(CrsSel|Brg1|Brg2|Fmt|Et)$/.test(k)){ SYS[k]=v; if(v){ click(); const m=k.slice(4);
      if(m==='CrsSel'){ SYS.efisSrc=1-SYS.efisSrc; flash('EFIS CRS — NAV '+(SYS.efisSrc+1)); }
      if(m==='Brg1'){ SYS.brgSel1=(SYS.brgSel1+1)%3; flash('BRG ○ — '+['OFF','NAV 1','ADF'][SYS.brgSel1]); }
      if(m==='Brg2'){ SYS.brgSel2=(SYS.brgSel2+1)%3; flash('BRG ◇ — '+['OFF','NAV 2','ADF'][SYS.brgSel2]); }
      if(m==='Fmt'){ SYS.efisArc=1-SYS.efisArc; flash('EHSI — '+(SYS.efisArc?'ARC':'FULL')); }
      if(m==='Et'){ SYS.etState=(SYS.etState+1)%3; if(SYS.etState===0) SYS.etT=0; flash('ET — '+['RESET','RUN','STOP'][SYS.etState]); } } return; }
  if(k==='propDeA'||k==='propDeM'){ SYS[k]=v; SYS.propDe=SYS.propDeA?-1:SYS.propDeM?1:0; beep(260,0.025,0.06); setTimeout(()=>{ const d=descr(k); if(d) flash(d); },0); procTouch('propDe'); return; }
  if(k==='micC'&&SYS.autoCommC&&v<2){ SYS.auC0=v===0?1:0; SYS.auC1=v===1?1:0; }
  if(k==='encAlt'||k==='xpdr12'||k==='audEmer'){ setTimeout(()=>{ if(k==='audEmer'&&SYS.audEmer) msg(tr2('AUDIO EMER: amplifiers bypassed — COMM 1, COMM 2, sidetone and warning tones go to the headsets only; no NAV/ADF/DME/marker audio.','AUDIO EMER: forsterkerne forbikoblet — COMM 1, COMM 2, sidetone og varseltoner bare til hodetelefonene; ingen NAV/ADF/DME/markør-lyd.')); },0); }
  if(k==='xpdrId'){ SYS[k]=v; if(v&&radOn('xpdr')&&SYS.xpdrMd>1){ SYS.identT=18; click(); } return; }
  if(k==='xpdrPre'){ SYS[k]=v; if(v&&radOn('xpdr')){ [SYS.xpdr,SYS.xpre]=[SYS.xpre,SYS.xpdr]; click(); } return; }
  if(k==='dmeCh'||k==='dme2Ch'){ SYS[k]=v; if(v){ const n=k==='dmeCh'?'d1ch':'d2ch'; SYS[n]=SYS[n]%3+1; click(); flash('DME '+(n==='d1ch'?'1':'2')+' — CH '+SYS[n]); } return; }
  if(k==='dmeSel'||k==='dme2Sel'){ SYS[k]=v; if(v){ const n=k==='dmeSel'?'d1sel':'d2sel'; SYS[n]=(SYS[n]+1)%3; click(); } return; }
  if(k==='slewL'||k==='slewR'||k==='slew2L'||k==='slew2R'||k==='fastErect'||k==='fastErect2'||k==='raT'||k==='hydT'||k==='hdLt'||k==='stallTest'||/^(com1|com2|nav1|nav2|xpdr|adf)T$/.test(k)||/^v(LoadL|LoadR|Batt|AC)$/.test(k)){ SYS[k]=v; if(v){ click(); if(k==='fastErect'||k==='fastErect2') flash(L(tr2('Attitude gyro fast erect','Attitydegyro hurtigoppretting'))); if(k==='stallTest'&&bus()) procTouch('stallTest'); } return; }
  if(k==='hornSil'){ SYS[k]=v; if(v&&gearWarn()&&!flapHorn()){ SYS.hornSilOn=1; click(); flash(L(tr2('Gear warning horn silenced (power-lever warning only)','Understellsvarsel dempet (bare effekthendel-varselet)'))); } return; }
  if(k==='dlRel'){ SYS[k]=v; if(v&&S.ground) flash(L(tr2('Down-lock release: overrides the ground lock — never on the ground with the handle up','Down-lock release: overstyrer bakkelåsen — aldri på bakken med hendelen oppe'))); return; }
  if(k==='gearPump'){ SYS[k]=v; if(v){ click(); if(SYS.gearH===1&&S.ctl.gear===0){ SYS.pumpN++; if(SYS.pumpN>=30){ S.ctl.gear=1; msg(tr2('Alternate extension: gear pumped down — check three green','Alternativ utfelling: understellet pumpet ned — sjekk tre grønne')); } else if(SYS.pumpN%5===0) flash(L(tr2('Pumping: ','Pumper: '))+SYS.pumpN+'/30'); } else flash(L(tr2('Alternate extension: handle DOWN first, then pump (only needed when the normal system fails)','Alternativ utfelling: hendelen NED først, pump så (bare når normalsystemet svikter)'))); } return; }
  if(CBK[k]){ SYS.cb[CBK[k]]=v; click(); flash(P.byId[k].c.l+' CB '+(v?'IN':'PULLED')); return; }
  if(k==='gear'){ if(v!==SYS.gearH) toggleGear(); procTouch('gear'); return; }
  if(k==='flaps'){ setFlap(v); procTouch('flaps'); return; }
  if(k==='trim'){ S.ctl.trim=v; holdPitch=null; procTouch('trim'); return; }
  if(k==='apTurn'){ if(Math.abs(v-0.5)<0.05) v=0.5; SYS.apTurn=v; if(v!==0.5&&(AP.on||AP.fd)){ AP.lat='ROL'; AP.latArm=''; SYS.bcMode=0; } return; }
  if(/^pwr[LR]$/.test(k)&&v<0&&!S.ground){ v=0; if(!ioSet.gw||performance.now()-ioSet.gw>3000){ ioSet.gw=performance.now(); msg(tr2('Beta and reverse are for ground use only.','Beta og revers er bare for bruk på bakken.')); } }
  if(/^cond[LR]$/.test(k)){ if(v<0.25) v=v<0.12?0:v; }
  if(k==='micP'&&SYS.autoCommP&&v<2){ SYS.auP0=v===0?1:0; SYS.auP1=v===1?1:0; }
  if(k==='nav1Md'&&v===2) SYS.dmeHold[1]=SYS.nav1.a; if(k==='nav1Md'&&v!==2) SYS.dmeHold[1]=null;
  if(k==='nav2Md'&&v===2) SYS.dmeHold[2]=SYS.nav2.a; if(k==='nav2Md'&&v!==2) SYS.dmeHold[2]=null;
  const old=SYS[k]; SYS[k]=v;
  if(o&&!['push','lev','vwheel','hwheel','rot','enc','enc2','sbtn','mbtn','abtn','yoke','bar'].includes(o.c.t)){ if(old!==v) beep(260,0.025,0.06); setTimeout(()=>{ const d=descr(k); if(d) flash(d); },0); }
  if(o&&o.c.t==='abtn'){ click(); setTimeout(()=>{ const d=descr(k); if(d) flash(d); },0); }
  if(o&&o.c.t==='lev'&&old!==undefined&&Math.abs(old-v)>0.001){ flashT=1.2; el('stat2').textContent=descr(k); el('stat2').classList.add('chg'); }
  if(k==='annTest'&&v) PR.m.annT=1;
  if((k==='fireTestL'||k==='fireTestR')&&v!==0) PR.m.fireT=1;
  if((k==='elecHeat'||k==='aftHeat')&&v&&!S.ground) msg(tr2('Electric heat is for ground use only: in flight the squat switch releases the solenoid-held switch to OFF.','Elektrisk varme er bare for bakken: i luften slipper squat-bryteren den solenoidholdte bryteren til OFF.'));
  if(k==='avio'&&!v){ AP.on=false; AP.fd=false; }
  if(k==='afSw'&&v===0) E.forEach(e=>{ e.autoF=false; });
  if(k==='pressSw'&&v===-1) msg(tr2('Cabin pressure DUMP: the outflow valve opens and the cabin climbs to the aircraft altitude.','Kabintrykk DUMP: utstrømningsventilen åpner og kabinen stiger til flyets høyde.'));
  if(k==='altStatic') msg(v?tr2("Pilot's static source ALTERNATE: pilot's airspeed, altimeter and VSI now read from cabin static — expect small errors.",'Pilotens statiske kilde ALTERNATE: pilotens fartsmåler, høydemåler og VSI leser nå kabinstatisk — forvent små feil.'):tr2("Pilot's static source NORMAL.",'Pilotens statiske kilde NORMAL.'));
  if(k==='wsP'||k==='wsC'||k==='cabMode') { if((SYS.wsP||SYS.wsC||SYS.cabMode===1||SYS.cabMode===3)&&!ioSet.cmpT){ ioSet.cmpT=1; flash(L(tr2('Standby compass is unreliable with windshield heat or air conditioning on','Standbykompasset er upålitelig med vindusvarme eller klimaanlegg på'))); } }
  procTouch(k);
}
function encTurn(id,d){ click();
  if(id==='hdgK'){ AP.hdg=F.wrap360(Math.round(AP.hdg)+d)||360; SYS.hdgK+=d; }
  else if(id==='crsK'){ SYS.crs=F.wrap360(SYS.crs+d)||360; SYS.crsK+=d; procTouch('crsK'); }
  else if(id==='crs2K'){ SYS.crs2=F.wrap360(SYS.crs2+d)||360; SYS.crs2K+=d; }
  else if(id==='baroK'||id==='baro2K'){ S.baro=F.clamp(Math.round(S.baro)+d,940,1060); SYS[id]+=d; }
  else if(id==='altSel'){ AP.alt=F.clamp(AP.alt+d*100,0,35000); SYS.altSel+=d; SYS.altCx=0; }
  else if(id==='mfdTilt'){ SYS.mfdTilt=F.clamp(SYS.mfdTilt+d,-15,15); }
  else if(id==='gpsKL'){ SYS.gpsPgL=(SYS.gpsPgL+d+400)%4; SYS.gpsKL=(SYS.gpsKL||0)+d; }
  else if(id==='gpsKR'){ SYS.gpsPgR=(SYS.gpsPgR+d+500)%5; SYS.gpsKR=(SYS.gpsKR||0)+d; }
  else if(id==='cabAlt'){ SYS.cabSel=F.clamp(SYS.cabSel+d*100,-1000,14000); SYS.cabAlt+=d; procTouch('cabAlt'); }
  else if(id==='apPitch'){ SYS.apPitch+=d; if(avOn()&&(AP.on||AP.fd)){ const o=F.readouts(S); for(let n=0;n<Math.min(5,Math.abs(d));n++) F.apSet(AP,S,o,d>0?'DN':'UP',curNav); } }
}
function enc2Turn(id,inner,d){ click(); const r=id.slice(0,-1); SYS[id+(inner?'I':'O')]+=d; SYS.chgT[r]=performance.now();
  if(r==='xpdr'){ const c=SYS.xpdr.split('').map(Number); const pair=inner?2:0; let v=c[pair]*8+c[pair+1]; v=(v+d+64*8)%64; c[pair]=v>>3; c[pair+1]=v&7; SYS.xpdr=c.join(''); return; }
  const f=SYS[r], key=SYS[r+'Act']?'a':'s';
  if(r==='adf'){ let v=+f[key]+(inner?d:d*10); if(v>1799) v=190; if(v<190) v=1799; f[key]=String(v); return; }
  const isCom=r.startsWith('com');
  f[key]=stepFreq(f[key],d,isCom?118:108,isCom?136:117,isCom?0.025:0.05,isCom?3:2,inner); if(r==='nav1') procTouch('navK');
}
function stepFreq(f,d,lo,hiI,st,dec,inner){ let m=Math.floor(+f+1e-6), k=+f-m; if(inner){ const n=Math.round(1/st); let q=Math.round(k/st)+d; q=((q%n)+n)%n; k=q*st; } else { const n=hiI-lo+1; m=lo+(((m-lo+d)%n)+n)%n; } return (m+k).toFixed(dec).replace(/(\.\d\d)0$/,'$1'); }

/* ---------- zoom, area selector, lock (shared framework) ---------- */
const Z={s:1,tx:0,ty:0,reg:'overview',lock:false};
const ZN=[['overview',tr2('Panel','Panel')],['flightT',tr2('Pilot EADI · ASI · altimeter · master warning','Pilot EADI · fart · høyde · master warning')],['flightB',tr2('Pilot EHSI · RMI · VSI','Pilot EHSI · RMI · VSI')],['engT',tr2('Engine gauges (upper)','Motorinstrumenter (øvre)')],['engB',tr2('Engine gauges (lower)','Motorinstrumenter (nedre)')],['lower',tr2('Left subpanel','Venstre underpanel')],['rsub',tr2('Lights · ice · gear','Lys · is · understell')],['center',tr2('Annunciators · flaps · cabin','Varsellys · flaps · kabin')],['pedT',tr2('Pedestal levers','Pidestall – hendler')],['pedB',tr2('EFIS controls · pressurisation','EFIS-kontroller · trykk')],['audio',tr2('Audio control panel','Lydpanel')],['fuelT',tr2('Fuel panel · OAT','Drivstoffpanel · OAT')],['fuelB',tr2('Fuel system breakers','Drivstoff-sikringer')],['apfd',tr2('Autopilot · flight director modes','Autopilot · flight director-moduser')],['centreM',tr2('Standby attitude · course · heading · altitude set','Reservehorisont · kurs · heading · høydevelger')],['radio1',tr2('Navigator: GPS · COMM 1 · NAV 1','Navigator: GPS · COMM 1 · NAV 1')],['mfd',tr2('Radar / multifunction display','Radar / flerfunksjonsskjerm')],['glare',tr2('Glareshield','Glareskjerm')],['overheadL',tr2('Overhead light control panel','Takpanel – lyskontroll')],['overheadR',tr2('Overhead meters · airspeeds','Takpanel – målere · fartsgrenser')],['copilotT',tr2('Copilot instruments (upper)','Andrepilot (øvre)')],['copilotB',tr2('Copilot instruments (lower) · transponder','Andrepilot (nedre) · transponder')],['cosubL',tr2('Environmental subpanel','Miljøpanel')],['cosubR',tr2('Copilot right subpanel · cabin · gauges','Andrepilot høyre underpanel · kabin · målere')],['rsideT',tr2('Right side breakers (upper)','Høyre sidepanel – sikringer (øvre)')],['rsideB',tr2('Right side · static source · COMM 2 · NAV 2 · ADF · prop amps','Høyre side · statisk kilde · COMM 2 · NAV 2 · ADF · propellampere')]];
function zoomTo(reg,instant,force){
  if(Z.lock&&!force&&reg!==Z.reg){ flash(L(tr2('View is locked — unlock to zoom','Visningen er låst — lås opp for å zoome'))); return; }
  if(D3on){ if(force&&instant){ D3.resize(); return; } const ov=reg==='overview'||!P.REG[reg]; Z.reg=ov?'overview':reg; if(ov) D3.lookAhead(instant); else D3.lookAt(P.REG[reg],instant); PST.classList.toggle('zoomed',!ov); syncAreaUI(); areaHL(null); return; }
  let r=P.REG[reg]||P.REG.overview; const w=PST.clientWidth, h=PST.clientHeight; if(!w||!h) return;
  const ov=reg==='overview'; if(ov&&skyOn()){ const k=B200P.SKY*(h<520?0.5:1); r=[r[0],-k,r[2],r[3]+k]; } /* phones: half, to keep the panel usable */ let s=Math.min(w/r[2],h/r[3])*(ov?1:0.95);
  const r0=P.REG.overview, s0=Math.min(w/r0[2],h/r0[3]); if(!ov) s=Math.max(s0,Math.min(s,4.5));
  let tx=w/2-(r[0]+r[2]/2)*s, ty=h/2-(r[1]+r[3]/2)*s;
  const cl=(v,lo,hi)=>lo>hi?(lo+hi)/2:Math.max(lo,Math.min(hi,v));
  tx=cl(tx,w-P.W*s,0); ty=cl(ty,h-P.H*s,0);
  if(ov){ tx=w/2-(r[0]+r[2]/2)*s; ty=Math.max(h/2-(r[1]+r[3]/2)*s,h-P.H*s); }
  Object.assign(Z,{s,tx,ty,reg});
  P.world.classList.toggle('nt',!!instant);
  P.world.style.transform=`translate(${tx}px,${ty}px) scale(${s})`;
  P.world.style.setProperty('--ls',ov?1:1.06);
  PST.classList.toggle('zoomed',!ov); syncAreaUI(); areaHL(null); otwFit();
}
function toWorld(e){ if(D3on) return D3.toWorld(e); const sv=P.svg, q=sv.createSVGPoint(); q.x=e.clientX; q.y=e.clientY; const p=q.matrixTransform(sv.getScreenCTM().inverse()); return {x:p.x,y:p.y}; }
function regionAt(p){ for(const k of P.REG_ORDER){ const r=P.REG[k]; if(p.x>=r[0]&&p.x<=r[0]+r[2]&&p.y>=r[1]&&p.y<=r[1]+r[3]) return k; } return null; }
const NS='http://www.w3.org/2000/svg';
const hlR=document.createElementNS(NS,'rect'); hlR.setAttribute('class','areahl'); hlR.setAttribute('rx',14); P.svg.insertBefore(hlR,P.svg.querySelector('g.ctls'));
const hlO=v=>{ if(hlR._o===v) return; hlR._o=v; if(P.svg.classList.contains('cpt')) hlR.style.setProperty('--bbo',v); else hlR.style.opacity=v; };
function areaHL(k){ if(!k||Z.reg!=='overview'){ hlO(0); return; } if(hlR._k!==k){ hlR._k=k; const r=P.REG[k]; hlR.setAttribute('x',r[0]); hlR.setAttribute('y',r[1]); hlR.setAttribute('width',r[2]); hlR.setAttribute('height',r[3]); } hlO(1); }
const magG=document.createElementNS(NS,'g'); magG.setAttribute('class','mags'); P.svg.appendChild(magG);
const MAGP={lower:[360,826],rsub:[812,890],center:[1112,884],cosubL:[1536,892],cosubR:[1972,840],pedT:[1296,1118],fuelT:[512,1120],fuelB:[438,1274],rsideT:[1984,1120],overheadL:[1164,10],overheadR:[1168,150],audio:[1330,398],glare:[1160,218],mfd:[1228,566]};
magG.innerHTML=Object.keys(MAGP).map(k=>{ const [x,y]=MAGP[k]; return `<g class="mag" data-z="${k}" tabindex="0" role="button" aria-label="Zoom ${k}"><circle cx="${x}" cy="${y}" r="11"/><circle cx="${x-2}" cy="${y-2}" r="4.5" class="mgl"/><path d="M${x+2} ${y+2}l4.5 4.5" class="mgl"/></g>`; }).join('');
magG.addEventListener('click',e=>{ const m=e.target.closest('.mag'); if(m) zoomTo(m.dataset.z); });
magG.addEventListener('keydown',e=>{ const m=e.target.closest('.mag'); if(m&&(e.key==='Enter'||e.key===' ')){ zoomTo(m.dataset.z); e.preventDefault(); } });
magG.addEventListener('pointerover',e=>{ const m=e.target.closest('.mag'); if(m) areaHL(m.dataset.z); });
const emptyAt=e=>!e.target.closest('g.ctl,.hit,.zback,.tz,.pill,.mag,.tip');
PST.addEventListener('pointermove',e=>{ if(Z.reg!=='overview'||e.pointerType==='touch'||(D3on&&D3.dragging)) return; if(!emptyAt(e)){ if(!e.target.closest('.mag')) areaHL(null); return; } areaHL(regionAt(toWorld(e))); });
PST.addEventListener('pointerleave',()=>areaHL(null));
PST.addEventListener('dblclick',e=>{ if(!emptyAt(e)) return; const k=regionAt(toWorld(e)); if(D3on){ zoomTo(k&&k!==Z.reg?k:'overview'); } else if(Z.reg!=='overview') zoomTo('overview'); else if(k) zoomTo(k); });
let lastTap={t:0,x:0,y:0};
PST.addEventListener('pointerup',e=>{ if(e.pointerType!=='touch'||!emptyAt(e)) return; const n=performance.now(); if(n-lastTap.t<320&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<24){ const k=regionAt(toWorld(e)); if(D3on){ zoomTo(k&&k!==Z.reg?k:'overview'); } else if(Z.reg!=='overview') zoomTo('overview'); else if(k) zoomTo(k); lastTap.t=0; } else lastTap={t:n,x:e.clientX,y:e.clientY}; });
el('zBack').onclick=()=>zoomTo('overview');
function drawZoomBar(){ el('zoomBar').innerHTML=ZN.map(([k,t],i)=>`<button class="cb${k===Z.reg?' on':''}" data-z="${k}" title="${i<10?i:''}">${L(t)}</button>`).join(''); el('zoomSel').innerHTML=ZN.map(([k,t])=>`<option value="${k}"${k===Z.reg?' selected':''}>${L(t)}</option>`).join(''); }
function syncAreaUI(){ el('zoomBar').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.z===Z.reg)); el('zoomSel').value=Z.reg; el('bLock').setAttribute('aria-pressed',Z.lock); el('bLock').textContent=(Z.lock?'🔒 ':'🔓 ')+T(Z.lock?'Locked':'Lock view'); PST.classList.toggle('locked',Z.lock); }
drawZoomBar(); LAB.onLang(()=>{ drawZoomBar(); syncAreaUI(); });
el('zoomBar').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) zoomTo(b.dataset.z); });
el('zoomSel').onchange=e=>zoomTo(e.target.value);
el('bLock').onclick=()=>{ Z.lock=!Z.lock; try{ localStorage.setItem('bb-b200-lock',Z.lock?'1':'0'); localStorage.setItem('bb-b200-zone',Z.reg); }catch(e){} syncAreaUI(); };
try{ Z.lock=localStorage.getItem('bb-b200-lock')==='1'; const z=localStorage.getItem('bb-b200-zone'); if(Z.lock&&z&&P.REG[z]) Z.reg=z; }catch(e){}
el('bMore').onclick=e=>{ const m=el('moreMenu'); m.hidden=!m.hidden; el('bMore').setAttribute('aria-expanded',!m.hidden); e.stopPropagation(); };
document.addEventListener('click',e=>{ if(!e.target.closest('#moreMenu,#bMore')) el('moreMenu').hidden=true; });
let flashT=0; function flash(t){ el('stat2').textContent=t; el('stat2').classList.add('chg'); flashT=3; }
const tip=document.createElement('div'); tip.className='tip'; tip.hidden=true; PST.appendChild(tip);
function tipText(g){ const n=g.getAttribute('aria-label'); const v=g.getAttribute('aria-valuetext')||(g.getAttribute('aria-checked')==null?'':g.getAttribute('aria-checked')==='true'?'ON':'OFF'); return n+(v?' · '+v:''); }
let tipG=null;
PST.addEventListener('pointerover',e=>{ const g=B200P.ctlFrom(P,e.target); if(!g||e.pointerType==='touch'){ tip.hidden=true; tipG=null; return; } tipG=g; tip.textContent=tipText(g); tip.hidden=false; });
PST.addEventListener('pointermove',e=>{ if(!tipG) return; tip.textContent=tipText(tipG); const r=PST.getBoundingClientRect(); tip.style.left=Math.max(4,Math.min(r.width-240,e.clientX-r.left+14))+'px'; tip.style.top=Math.max(4,e.clientY-r.top-34)+'px'; });
PST.addEventListener('pointerout',e=>{ if(tipG&&!(e.relatedTarget&&tipG.contains(e.relatedTarget))){ tipG=null; tip.hidden=true; } });
new ResizeObserver(()=>zoomTo(Z.reg,true,true)).observe(PST);
B200P.ctrlWheel(PST);
// touch-action:none comes from CSS on touch screens; a pen (or touch the media query missed) turns it on at its first hover/contact
{ const tact=e=>{ if(e.pointerType&&e.pointerType!=='mouse'){ PST.classList.add('tact'); PST.removeEventListener('pointerover',tact,true); PST.removeEventListener('pointerdown',tact,true); } }; PST.addEventListener('pointerover',tact,true); PST.addEventListener('pointerdown',tact,true); }
/* ---------- outside view (shared three.js scene, otw.js) ---------- */
// The canvas sits behind the panel (it never covers a control): the view shows through the windshield gaps beside the
// overhead console, above the glareshield and beside the panel. It reaches down to mid-panel (~46 % of the stage, as
// in the DA42) so the camera has a useful vertical field of view and the level-flight horizon sits just above the glareshield.
const OTW_BOTTOM_Y=850; // world units
// With the outside view on, the overview adds windshield above the overhead console (B200P.SKY), so the outside is a little under
// a third of the screen, and OTW.frame puts the level-flight horizon 7° above the glareshield in front of the left seat.
const OTW_EYEX=366; // panel x straight ahead of the left-seat pilot (the attitude indicator)
const OTW_NOSE=7;
function skyOn(){ return !D3&&!PST.classList.contains('nootw')&&!PST.classList.contains('nogl'); }
function otwFit(){ const c=el('otw'); if(!c||Z.reg!=='overview'||D3) return; const h=PST.clientHeight; c.style.height=Math.max(0,Math.min(h,Math.round(Z.ty+OTW_BOTTOM_Y*Z.s)))+'px'; if(window.OTW&&OTW.frame) OTW.frame({lip:Z.ty+B200P.LIP*Z.s,nose:OTW_NOSE,cx:Z.tx+OTW_EYEX*Z.s}); }
// adapter: the shared FDM state already uses N/E metres, h metres MSL and th/phi/psi radians on the same runway 36,
// so only the eye point changes — left seat (0.45 m left of the centre line), about 2.6 m above the ground — plus a
// 2.5° lower line of sight, so the level-flight horizon shows above the King Air's taller glareshield
const OTW_EYE={dh:1.05,left:0.45,look:0}, otwS={N:0,E:0,h:0,th:0,phi:0,psi:0};
function otwState(){ const c=Math.cos(S.psi), s=Math.sin(S.psi); otwS.N=S.N+OTW_EYE.left*s; otwS.E=S.E-OTW_EYE.left*c; otwS.h=S.h+OTW_EYE.dh; otwS.th=S.th-OTW_EYE.look; otwS.phi=S.phi; otwS.psi=S.psi; return otwS; }
let otwOn=true, otwReady=false, otwSkip=0;
/* Frame-budget governor shared by the panel and the outside view. Level 0: panel at 30 Hz, outside view every frame at up to 1.5
   device pixels per CSS pixel. Level 1 (frames over 24 ms, as before): panel 20 Hz, outside view every 2nd frame at 1 pixel.
   Level 2 (frames over 45 ms): panel 15 Hz, outside view every 3rd frame at 0.75 pixel. Hysteresis and a 2 s dwell avoid hunting. */
const GOV={lvl:0,ft:16,t:0,tick(dt){ this.ft+=((dt*1000||16)-this.ft)*0.05; this.t+=dt; if(this.t<2) return;
  const up=this.lvl<2&&this.ft>(this.lvl?45:24), dn=this.lvl>0&&this.ft<(this.lvl>1?32:19); if(up||dn){ this.lvl+=up?1:-1; this.t=0; } },
  get panelDt(){ return [0.033,0.05,0.066][this.lvl]; }};
function otwMsgSync(){ el('otwMsg').hidden=otwReady||!otwOn||!otwTried; }
let otwTried=false;
function hasWebGL(){ try{ const c=document.createElement('canvas'), g=c.getContext('webgl2')||c.getContext('webgl'); if(!g) return false; const x=g.getExtension('WEBGL_lose_context'); if(x) x.loseContext(); return true; }catch(e){ return false; } }
if(!D3) (window.requestIdleCallback||setTimeout)(()=>{ try{ otwReady=!!(window.OTW&&window.THREE&&hasWebGL()&&OTW.init(el('otw'))); }catch(e){ otwReady=false; } otwTried=true; PST.classList.toggle('nogl',!otwReady); otwMsgSync(); if(!otwReady&&Z.reg==='overview') zoomTo('overview',true,true); },{timeout:400});
function setOtw(on){ otwOn=on; PST.classList.toggle('nootw',!on); el('bOtw').setAttribute('aria-pressed',on); otwMsgSync(); try{ localStorage.setItem('bb-b200-otw',on?'1':'0'); }catch(e){}  if(Z.reg==='overview') zoomTo('overview',true,true); }
/* 3D cockpit (beta): the outside world is the 3D scene's background; the panel is placed in it and looked around in */
const otwS3={N:0,E:0,h:0,th:0,phi:0,psi:0};
function otwState3(){ const w=otwState(); Object.assign(otwS3,w); otwS3.th=S.th; return otwS3; }
function d3Toast(){ if(PST.querySelector('.d3t')) return; const t=document.createElement('div'); t.className='d3t'; t.setAttribute('role','status');
  t.innerHTML=`<span>${T('3D is running slowly on this device.')} <a href="${document.body.dataset.d3}">${T('Try the classic 2D panel')}</a></span><button aria-label="Close">×</button>`; t.querySelector('button').onclick=()=>t.remove(); PST.appendChild(t); setTimeout(()=>t.remove(),12000); }
function d3Init(){ PST.classList.add('d3wait');
  setTimeout(()=>{
    if(D3.supported&&D3.supported()&&hasWebGL()){ try{ otwReady=!!(window.OTW&&OTW.init(el('otw'))); }catch(e){ otwReady=false; } }
    otwTried=true;
    if(otwReady){ try{ D3on=D3.init({stage:PST,world:P.world,svg:P.svg,T,canLook:e=>emptyAt(e)&&!e.target.closest('.more,.d3t,.d3v'),onStick:v=>{ inp.stick=v; },onSlow:d3Toast,onAhead:()=>{ Z.reg='overview'; PST.classList.remove('zoomed'); syncAreaUI(); }}); }catch(e){ console.warn('3D cockpit',e); D3on=false; } }
    if(D3on){ Z.lock=false; Z.reg='overview'; IO.toWorld=e=>D3.toWorld(e); otwOn=true; PST.classList.remove('nootw','nogl'); el('bOtw').hidden=true; el('bLock').hidden=true;
      if(el('bAhead')){ el('bAhead').hidden=false; el('bAhead').onclick=()=>zoomTo('overview'); } D3.lookAhead(true); syncAreaUI(); otwMsgSync(); LAB.onLang(()=>D3.relabel()); }
    else { PST.classList.toggle('nogl',!otwReady); el('otwMsg').textContent=T('3D needs WebGL, which this browser does not offer. Showing the classic panel.'); el('otwMsg').hidden=false; }
    PST.classList.remove('d3wait'); zoomTo(Z.reg,true,true);
  },0); }
if(D3) d3Init();
el('bOtw').onclick=()=>setOtw(!otwOn);
// default on; off on phones (small touch screens), where the strip of sky is tiny and the GPU is better spent on the panel
{ let pr=null; try{ pr=localStorage.getItem('bb-b200-otw'); }catch(e){} const phone=matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<=500; setOtw(pr?pr==='1':!phone); }
function otwTick(dt){
  if(!otwReady||!otwOn||!cockpitVis||document.hidden||Z.reg!=='overview') return;
  const lv=GOV.lvl; if(!lv||(++otwSkip%(lv+1)===0)) OTW.render(otwState(),''); if(lv!==(OTW.lvl||0)) OTW.quality(lv===2?2:lv>0);
}
el('bFull').onclick=()=>{ const c=el('cockpit'); try{ if(document.fullscreenElement) document.exitFullscreen(); else c.requestFullscreen&&c.requestFullscreen().catch(()=>msg(tr2('Full screen is blocked here. Open the page in its own tab.','Fullskjerm er blokkert her. Åpne siden i en egen fane.'))); }catch(e){} };

/* ---------- engines and systems ---------- */
const pA=h=>1013.25*Math.pow(Math.max(0.01,1-6.8756e-6*h),5.2559);
const hP=p=>(1-Math.pow(p/1013.25,1/5.2559))/6.8756e-6;
const RAD_={nav1:null,nav2:null};
let blLast=null;
function sysTick(dt,o){
  const b=bus(), ias=o.ias, sig=F.isa(S.h,S.env.isa).sig, dens=Math.min(1,sig/0.62);
  const af=SYS.afSw, afPow=b&&cbIn('AUTOFEATHER'), afSys=afPow&&((af===-1&&SYS.pwrL>=0.88&&SYS.pwrR>=0.88)||af===1);
  E.forEach((e,i)=>{ const s=SIDES[i], ign=SYS['ign'+s], cond=SYS['cond'+s], pl=SYS['pwr'+s], idle=idleNg(i);
    const starter=(ign===-1||ign===1)&&b&&cbIn('START '+s)&&!e.genOn;
    const autoIgn=SYS['aign'+s]&&b&&e.tq<400&&e.ng>50;
    e.ignOn=b&&cbIn('IGN '+s)&&(ign===-1||autoIgn);
    if(!fwOpen(i)) e.fwT+=dt; else e.fwT=0;
    const fuelAv=e.fwT<3&&(e.main+e.aux)>0;
    e.press=fwOpen(i)&&((SYS['stby'+s]&&b&&cbIn('STBY PUMP '+s))||e.ng>8);
    const fuelOn=cond>=0.45&&fuelAv;
    if(starter) e.stT+=dt; else e.stT=Math.max(0,e.stT-dt*0.5);
    if(!e.lit&&fuelOn&&e.ignOn&&e.ng>=10&&!e.fail){ e.lit=true; e.ngLight=e.ng; e.startT=0; e.hung=false; if(e.ng<12&&!e.warnedEarly){ e.warnedEarly=true; msg(tr2(s+' engine: fuel introduced below 12 % N1 — expect a hotter start.',s+' motor: drivstoff gitt under 12 % N1 — forvent en varmere start.')); procBad(); } }
    if(e.lit&&(!fuelOn||e.fail||e.ng<8)){ e.lit=false; if(e.ng>40&&!e.fail&&cond>=0.45) msg(tr2(s+' engine flamed out (no fuel).',s+' motor sluknet (ikke drivstoff).')); }
    if(e.lit){ if(e.ng<idle-2){ e.hung=e.ng<45&&!starter; const rate=e.hung?0.12:1.9+(starter?0.8:0)-(e.dmg?0.8:0); e.ng+=rate*dt; e.startT+=dt; }
      else { const ngT=pl>=0? idle+pl*(101.5-idle) : pl<-0.12? idle+(-pl-0.12)/0.28*(88-idle) : idle; e.ng+=(ngT-e.ng)*Math.min(1,dt/1.6); } }
    else if(starter){ e.ng+=(19-e.ng)*Math.min(1,dt/5); }
    else { e.ng+=(Math.min(6,ias/25)-e.ng)*Math.min(1,dt*0.16); }
    e.ng=Math.max(0,e.ng);
    let ittT;
    if(e.lit){ if(e.ng<idle-2){ const peak=700+75*Math.max(0,12-e.ngLight)+(cond>0.9?170:0); ittT=e.hung?Math.min(1150,e.itt+60):(e.startT<5?peak:Math.max(560,peak-(e.startT-5)*30)); }
      else ittT=520+(e.ng-61)*6.1+Math.max(0,o.oat-15)*1.2+(pl<-0.12?40:0)+(e.dmg?60:0)+e.vane*15-(SYS.envBleed===0&&SYS['bleed'+s]===-1?10:0); }
    else ittT=Math.max(o.oat,15);
    e.itt+=(ittT-e.itt)*Math.min(1,dt*(e.lit?(e.ng<idle-2?1.1:0.8):(starter?0.25:0.06)));
    if(e.itt>1000){ e.hotT+=dt; if(!e.hotMsg){ e.hotMsg=true; msg(tr2(s+' ENGINE HOT START — ITT above 1000 °C. Condition lever FUEL CUTOFF, keep the starter running to cool it.',s+' MOTOR «HOT START» — ITT over 1000 °C. Condition-hendel FUEL CUTOFF, la starteren gå for å kjøle.')); procBad(); } if(e.hotT>5&&!e.dmg){ e.dmg=true; msg(tr2(s+' engine over-temperature for more than 5 s: an inspection is required after flight.',s+' motor overtemperatur i mer enn 5 s: krever inspeksjon etter flyging.')); } } else { e.hotT=0; if(e.itt<900) e.hotMsg=false; }
    if(e.stT>40&&!e.stMsg){ e.stMsg=true; msg(tr2('Starter limit: about 40 s on, then let it cool (typical — check the AFM).','Startergrense: ca. 40 s på, la den så kjøle seg (typisk — sjekk AFM).')); } if(e.stT<1) e.stMsg=false;
    const o2=E[1-i]; e.afArm=afSys&&o2.tq>=400&&!e.autoF;
    if(e.afArm&&e.tq<200){ if(af===-1){ e.autoF=true; e.afArm=false; msg(tr2(s+' propeller autofeathered.',s+' propell autofløyd.')); } else e.afCyc+=dt; } else if(af!==1) e.afCyc=0;
    if(af!==1&&e.afCyc) e.afCyc=0;
    const fth=feathered(i), base=F.clamp((e.ng-idle)/(101.5-idle),0,1);
    let tqT=0; if(e.lit&&e.ng>=idle-3){ tqT=fth?50+250*base:(pl<-0.12?150+900*(-pl-0.12)/0.28:120+2110*Math.pow(base,1.25)*dens*(1-0.05*e.vane)); }
    e.tq+=(tqT-e.tq)*Math.min(1,dt*2.5);
    const pp=SYS['prop'+s], npSet=1600+400*F.clamp((pp-0.12)/0.88,0,1);
    let npT; if(fth) npT=e.lit?380:(ias>40?60:0);
    else if(e.lit) npT=pl<-0.12?npSet*0.95:pl<0?1000:Math.min(npSet,800+(e.ng-61)*26+ias*3.2);
    else npT=Math.min(npSet,ias*11);
    if(SYS.govT&&b&&cbIn('PROP GOV')&&npT>1870) npT=1870+(npT-1870)*0.1;
    if(S.ground&&e.lit&&!fth&&pl>=0&&pl<0.1&&b&&cbIn('PROP GOV')&&!SYS.gndIdle) npT+=60; /* ground idle stop solenoids energised on the ground: finer pitch, a little more rpm */
    if(i===1&&SYS.sync&&b&&cbIn('PROP SYNC')&&E[0].lit&&e.lit&&!fth&&Math.abs(E[0].np-npT)<30) npT=E[0].np;
    if(af===1&&e.afCyc>0) npT-=150*(0.5+0.5*Math.sin(e.afCyc*5));
    e.np+=(npT-e.np)*Math.min(1,dt*(fth?0.35:1.0));
    e.ff=e.lit?Math.max(60,95+7.2*(e.ng-56)*Math.max(0.55,dens)):0;
    e.oilP+=((e.lit?60+60*F.clamp((e.ng-56)/40,0,1):e.ng*2.2)-e.oilP)*Math.min(1,dt*1.5);
    e.oilT+=((e.lit?45+28*base:Math.max(15,o.oat))-e.oilT)*dt/60;
    // fuel: crossfeed draws from the other side; auxiliary fuel is used first while it transfers
    const xf=b&&cbIn('CROSSFEED')?SYS.xfeed:0, src=xf===-1?0:xf===1?1:i, T=E[src], burn=e.ff*dt/3600;
    if(T.aux>0&&T.xfr){ T.aux=Math.max(0,T.aux-burn); } else T.main=Math.max(0,T.main-burn);
    e.xfr=e.aux>0&&b&&cbIn('AUX XFR '+s)&&(e.lit||SYS['aux'+s]===1);
    if(e.aux>0&&e.lit&&!e.xfr) e.nxT+=dt; else e.nxT=0;
    // generator
    const gs=SYS['gen'+s]; if(gs===-1){ if(e.ng>=50&&e.lit) e.genRst=true; e.rstT=(e.rstT||0)+dt; if(e.rstT>0.7){ SYS['gen'+s]=0; e.rstT=0; } } else e.rstT=0; if(gs===1){ e.genRst=false; }
    const was=e.genOn; e.genOn=e.genRst&&gs===0&&e.ng>=50&&e.lit; if(e.genOn&&!was){ if(!tiesOpen()) SYS.battT=Math.max(SYS.battT,20); procTouch('gen'+s+'On'); }
    // engine anti-ice (inertial vane): main actuator needs ENG ANTI-ICE power, standby its own
    const tgt=SYS['engAI'+s]?1:0, act=SYS['act'+s]?(b&&cbIn('STBY ANTI-ICE '+s)):(b&&cbIn('ENG ANTI-ICE '+s));
    if(act) e.vane=F.clamp(e.vane+(tgt?1:-1)*dt/(SYS['act'+s]?18:12),0,1);
    if(Math.abs(tgt-e.vane)>0.01) e.vaneT+=dt; else e.vaneT=0;
    if(e.fire){ if(cond<0.05&&!fwOpen(i)){ e.fireT+=dt*(e.ext?3:1); if(e.fireT>9){ e.fire=false; e.fireT=0; msg(tr2(s+' engine fire out.',s+' motorbrann slukket.')); } } }
    const fe=S.eng[i]; fe.fail=false; fe.off=!e.lit; fe.feather=fth; fe.thr=e.lit&&pl>=0?F.clamp(e.tq*e.np/(2230*2000),0,1):0;
  });
  SYS.battT=Math.max(0,SYS.battT-dt); if(tiesOpen()) SYS.battT=0;
  /* solenoid-held heat switches: released to OFF about a second after they are selected in flight */
  if(!S.ground&&(SYS.elecHeat||SYS.aftHeat)){ SYS.ehT=(SYS.ehT||0)+dt; if(SYS.ehT>1.2){ SYS.elecHeat=0; SYS.aftHeat=0; SYS.ehT=0; } } else SYS.ehT=0;
  if(SYS.identT>0) SYS.identT-=dt;
  // gear: the handle drives the hydraulic gear only with power and the relay breaker in
  if(b&&cbIn('GEAR')&&S.ctl.gear!==SYS.gearH&&!(S.ground&&SYS.gearH===0)){ S.ctl.gear=SYS.gearH; SYS.pumpN=0; }
  { const asT=SYS.altStatic?1:0, a0=SYS.asF||0; SYS.asF=a0+(asT-a0)*Math.min(1,dt*0.8); SYS.asVs=(SYS.asVs||0)+(((SYS.asF-a0)*45/Math.max(dt,1e-3)*60)-(SYS.asVs||0))*Math.min(1,dt*3); }
  if(SYS.hornSilOn&&(SYS.pwrL>0.2||SYS.pwrR>0.2||S.ctl.gearPos>0.99)) SYS.hornSilOn=0;
  // pressurisation
  const acAlt=o.altTrue, ground=S.ground;
  const supply=E.filter((e,i)=>SYS['bleed'+SIDES[i]]===-1&&e.lit&&e.ng>=60).length;
  const pres=supply>0&&!SYS.decomp&&cbIn('PRESS CONT')&&((SYS.pressSw===0&&!ground)||SYS.pressSw===1);
  const maxDiff=hP(pA(acAlt)+6.5*68.95);
  const tgt=pres?Math.min(acAlt,Math.max(SYS.cabSel,maxDiff)):acAlt;
  const rate=pres?(200+SYS.cabRate*1800)*(SYS.envBleed===0?0.6:1):(SYS.decomp?7000:SYS.pressSw===-1?3000:supply?1500:2200);
  const c0=SYS.cab; SYS.cab+=F.clamp(tgt-SYS.cab,-rate*dt/60,rate*dt/60); SYS.cabVS+=(((SYS.cab-c0)/Math.max(dt,1e-3))*60-SYS.cabVS)*Math.min(1,dt*2);
  SYS.diff=Math.max(0,(pA(SYS.cab)-pA(acAlt))/68.95);
  // oxygen: masks only help with the system-ready handle pulled; passenger masks auto-deploy at 12,500 ft
  const o2=SYS.o2Ready&&SYS.o2psi>50; if(o2&&(SYS.mask||SYS.paxDep)) SYS.o2psi=Math.max(0,SYS.o2psi-dt*(SYS.paxDep?0.8:0.15));
  if(o2&&(SYS.cab>12500||SYS.paxOvr)) SYS.paxDep=1;
  if(SYS.cab>12500&&!(SYS.mask&&o2)){ SYS.hypT+=dt; if(SYS.hypT>20&&!SYS.hypMsg){ SYS.hypMsg=true; msg(SYS.mask?tr2('Mask on but no oxygen: pull the OXYGEN SYSTEM READY handle on the pedestal.','Maske på, men ikke oksygen: trekk OXYGEN SYSTEM READY-håndtaket på pidestallen.'):tr2('Cabin above 12,500 ft without oxygen: masks ON now — hypoxia degrades judgement within minutes.','Kabin over 12 500 ft uten oksygen: masker PÅ nå — hypoksi svekker dømmekraften i løpet av minutter.')); } } else { SYS.hypT=0; SYS.hypMsg=false; }
  // cabin temperature
  const heatOn=SYS.cabMode===0||(SYS.cabMode===3&&SYS.cabT<60+SYS.cabTemp*25-1), coolOn=SYS.cabMode===1||(SYS.cabMode===3&&SYS.cabT>60+SYS.cabTemp*25+1);
  if(SYS.manTemp&&SYS.cabMode<2) SYS.cabTemp=F.clamp(SYS.cabTemp-SYS.manTemp*dt*0.08,0,1);
  SYS.acRun=coolOn&&E[1].lit&&b; SYS.acLow=coolOn&&b&&E[1].ng<62;
  SYS.cabT+=((heatOn&&supply?95:SYS.acRun?55:Math.max(40,o.oat*1.8+32+20))-SYS.cabT)*dt*0.01;
  // trims, autopilot power
  if(SYS.trimHat&&b&&SYS.elTrim&&cbIn('PITCH TRIM')){ S.ctl.trim=F.clamp(S.ctl.trim+SYS.trimHat*dt*0.18,-1,1); holdPitch=null; }
  if(!avOn()&&(AP.on||AP.fd)){ AP.on=false; AP.fd=false; }
  if(!cbIn('AUTOPILOT')&&(AP.on||SYS.yd)){ if(AP.on){ AP.on=false; apDiscFx(); } SYS.yd=0; }
  if(AP.on&&!SYS.yd) SYS.yd=1;
  if(SYS.apFailT>0) SYS.apFailT-=dt;
  // compass systems: slaved card drifts back to magnetic, free gyro precesses; slew only in FREE
  [1,2].forEach(n=>{ const free=n===1?SYS.gyroMode:SYS.gyro2Mode, k='hdgErr'+n, sl=n===1?(SYS.slewR-SYS.slewL):(SYS.slew2R-SYS.slew2L);
    if(!b) return; if(free){ SYS[k]+=dt*0.02+(sl*dt*3); } else SYS[k]-=F.clamp(SYS[k],-dt*(Math.abs(SYS[k])>5?3:0.1),dt*(Math.abs(SYS[k])>5?3:0.1)); });
  // flight hour meter
  if(!S.ground) SYS.hobbs+=dt/3600*20;
  // DME (channel 1 = NAV 1, 2 = NAV 2, 3 = no station) with ground speed from the change in distance
  [1,2].forEach(n=>{ const ch=SYS['d'+n+'ch'], nv=ch===1?'nav1':ch===2?'nav2':null; let f=nv?(SYS.dmeHold[ch]||SYS[nv].a):null; const ok=f&&NAVS[f]&&avOn()&&cbIn('DME');
    const r=ok?F.nav(S,NAVS[f],0):null; const d=r&&r.dist!=null&&r.dist<199?r.dist:null; SYS['dmeD'+n]=d; SYS['dmeId'+n]=r?r.id:'';
    if(d!=null&&SYS.dmeLast[n]!=null&&dt>0){ const g=Math.abs(SYS.dmeLast[n]-d)/dt*3600; SYS.dmeGs[n]+=(g-SYS.dmeGs[n])*Math.min(1,dt*0.6); } SYS.dmeLast[n]=d; });
  { const bl=(0.35+0.62*(b?(SYS.mpl?SYS.dimPF:0.9):0.1)).toFixed(2); if(bl!==blLast){ blLast=bl; document.documentElement.style.setProperty('--bl',bl); } }
}
const efisMain=()=>avOn()&&cbIn('DSPL PRCSR');
const efisOnAux=()=>!efisMain()&&SYS.efisAux===-1&&cbIn('EFIS AUX BAT')&&SYS.auxBat>0&&SYS.efisWasOn;
const gpsOk=()=>!!SYS.gpsOn&&avOn()&&cbIn('GPS');
const GPSW=Object.assign({RW36:{N:0,E:0,id:'RW36'},ASN:{N:900,E:-2600,id:'ASN'},AN:{N:-7600,E:0,id:'AN'}},AIRPROC.FIX);
const gpsTo=w=>{ const p=GPSW[w]||GPSW.RW36, dN=p.N-S.N, dE=p.E-S.E; return {d:Math.hypot(dN,dE)/F.NM,brg:F.wrap360(Math.atan2(dE,dN)*180/Math.PI)}; };
const gpsAprActive=()=>!!SYS.gpsApr&&SYS.gpsWpt==='RW36'&&gpsTo('RW36').d<2.2&&!S.ground;
const MFDM=['OFF','STBY','TEST','WX'], MFDR=[10,25,50,100,150,300];
const WXC=[{n:22,e:-10,r:2.6,l:1},{n:24,e:-9,r:1.4,l:2},{n:24.5,e:-8.6,r:0.6,l:3},{n:31,e:6,r:3.5,l:0},{n:33,e:7.5,r:1.8,l:1},{n:40,e:-3,r:4.5,l:0},{n:42,e:-2,r:2,l:1},{n:15,e:14,r:2.5,l:0},{n:-12,e:18,r:3,l:0},{n:55,e:12,r:5,l:1},{n:57,e:13,r:2.4,l:2},{n:58,e:13.5,r:1,l:3},{n:80,e:-30,r:7,l:0},{n:90,e:20,r:6,l:1}];
function mfdKey(m){ if(!(avOn()&&SYS.mfdPwr&&cbIn('MFD'))) return;
  const pg=p=>{ SYS.mfdPrev=SYS.mfdPage; SYS.mfdPage=SYS.mfdPage===p?'map':p; SYS.mfdChk=0; };
  switch(m){
    case 'Rdr': SYS.mfdMode=cbIn('RADAR')?(SYS.mfdMode+1)%4:0; if(SYS.mfdPage!=='map'){ SYS.mfdPrev=SYS.mfdPage; SYS.mfdPage='map'; } flash('RADAR — '+MFDM[SYS.mfdMode]); break;
    case 'Nav': SYS.mfdNavOn=1-SYS.mfdNavOn; flash('NAV OVERLAY — '+(SYS.mfdNavOn?'ON':'OFF')); break;
    case 'Rmt': pg('rmt'); break;
    case 'Pge': { const o=['map','nav','chk'], i=o.indexOf(SYS.mfdPage); SYS.mfdPrev=SYS.mfdPage; SYS.mfdPage=o[(i+1)%3]; SYS.mfdChk=0; break; }
    case 'Emg': pg('emg'); break;
    case 'L1': SYS.mfdWx=1-SYS.mfdWx; break; case 'L2': SYS.mfdNup=1-SYS.mfdNup; break; case 'L3': SYS.mfdGain=(SYS.mfdGain+1)%3; break; case 'L4': SYS.mfdTilt=0; break;
    case 'Up': SYS.mfdRng=Math.min(MFDR.length-1,SYS.mfdRng+1); flash('RANGE '+MFDR[SYS.mfdRng]+' NM'); break; case 'Dn': SYS.mfdRng=Math.max(0,SYS.mfdRng-1); flash('RANGE '+MFDR[SYS.mfdRng]+' NM'); break;
    case 'Rcl': { const p=SYS.mfdPrev; SYS.mfdPrev=SYS.mfdPage; SYS.mfdPage=p; break; }
    case 'Skp': SYS.mfdChk++; break;
    case 'Clr': SYS.mfdPrev=SYS.mfdPage; SYS.mfdPage='map'; break; } }
function gpsKey(m){
  if(m==='Pwr'){ if(!avOn()||!cbIn('GPS')){ msg(tr2('GPS: no avionics power or GPS breaker out.','GPS: ingen avionikkstrøm eller GPS-sikring ute.')); return; } SYS.gpsOn=1-SYS.gpsOn; if(SYS.gpsOn) SYS.gpsInitT=6; flash('GPS '+(SYS.gpsOn?'ON':'OFF')); return; }
  if(!gpsOk()) return;
  if(m==='CrsrL') SYS.gpsCurL=1-SYS.gpsCurL; if(m==='CrsrR') SYS.gpsCurR=1-SYS.gpsCurR;
  if(m==='Msg') SYS.gpsMsgT=4; if(m==='Alt') SYS.gpsAltT=6;
  if(m==='Dto') SYS.gpsDtoPend=SYS.gpsWpt==='RW36'?'ASN':SYS.gpsWpt==='ASN'?'AN':'RW36';
  if(m==='Ent'&&SYS.gpsDtoPend){ SYS.gpsWpt=SYS.gpsDtoPend; SYS.gpsDtoPend=0; flash('GPS — direct to '+SYS.gpsWpt); }
  if(m==='Clr'){ SYS.gpsDtoPend=0; SYS.gpsMsgT=0; SYS.gpsAltT=0; } }
let gpwsSnd=0, auxSnd=0;
function gpwsTick(dt,o){ const gOk=avOn()&&cbIn('GPWS'), nv=curNav; SYS.bgsW=0; SYS.gpwsW=0;
  if(gOk&&!S.ground){ const agl=o.agl;
    if(nv.valid&&nv.gs&&agl<1000&&agl>30&&nv.gs.dev<-1.0&&!SYS.gsCxl) SYS.bgsW=1;
    if(agl>2000||!nv.gs) SYS.gsCxl=0;
    if(agl<2450&&-o.vs>1000+agl*1.6) SYS.gpwsW=1;
    if(agl<500&&S.ctl.gearPos<0.99&&o.ias<190&&o.vs<-100) SYS.gpwsW=1;
    if(agl<200&&S.ctl.flapPos<0.5&&!SYS.gpwsFlap&&S.ctl.gearPos>0.99&&o.vs<-100&&o.ias<160) SYS.gpwsW=1; }
  if(SYS.gpwsTestT>0) SYS.gpwsTestT-=dt;
  gpwsSnd-=dt; if((SYS.gpwsW||SYS.bgsW)&&gpwsSnd<=0){ gpwsSnd=1.6; beep(SYS.gpwsW?760:420,0.3,0.035); }
  // EFIS auxiliary battery: keeps the EFIS alive when main power is lost (switch ON); horn until silenced
  if(efisMain()){ SYS.efisWasOn=1; SYS.auxHornSil=0; SYS.auxBat=Math.min(1800,SYS.auxBat+dt*2); }
  else if(efisOnAux()){ SYS.auxBat-=dt; auxSnd-=dt; if(!SYS.auxHornSil&&auxSnd<=0){ auxSnd=2; beep(880,0.15,0.03); } }
  if(SYS.etState===1) SYS.etT+=dt; if(SYS.gpsInitT>0) SYS.gpsInitT-=dt; if(SYS.gpsMsgT>0) SYS.gpsMsgT-=dt; if(SYS.gpsAltT>0) SYS.gpsAltT-=dt;
}
function flapHorn(){ return !S.ground&&S.ctl.gearPos<0.99&&S.ctl.flapPos>1.2; }
function gearWarn(){ const o=S.o||{}; return !S.ground&&S.ctl.gearPos<0.99&&((SYS.pwrL<0.12&&SYS.pwrR<0.12&&o.ias<140)||S.ctl.flapPos>1.2); }

/* ---------- radios: ADF, markers, idents ---------- */
function adfNow(){ if(!radOn('adf')||SYS.adfMd<2||+SYS.adf.a!==NDB.freq) return null; const dN=NDB.N-S.N, dE=NDB.E-S.E; if(Math.hypot(dN,dE)/F.NM>80) return null; return F.wrap360(Math.atan2(dE,dN)*180/Math.PI); }
function mkrNow(){ if(!radOn('nav1')) return null; const r=(SYS.mkrHi?1.5:1)*Math.max(250,S.h*0.45); for(const m of MKR){ if(Math.hypot(m.N-S.N,m.E-S.E)<r&&S.h<2500) return m.k; } return null; }
const MORSE={A:'.-',N:'-.',S:'...',I:'..'};
let identT=0, mkrT=0;
function audioTick(dt){ if(!AC||!UI.sound||UI.paused) return; identT-=dt; mkrT-=dt; const vol=(0.02+0.05*SYS.volP)*(SYS.spkrP?1:0.7);
  if(SYS.audEmer) return; // emergency bypass: only COMM audio, sidetone and warning tones reach the headsets
  const range=SYS.voiceP!==-1; // VOICE filter removes the Morse identifier
  if(identT<=0){ identT=9; let id=null, f=1020, v=vol;
    if(range&&SYS.auP2&&radOn('nav1')&&curNav.valid){ id=(NAVS[SYS.nav1.a]==='LOC'?'IASN':'ASN'); v*=0.3+SYS.nav1Vol; }
    else if(range&&SYS.auP8&&radOn('adf')&&SYS.adfMd>0&&+SYS.adf.a===NDB.freq){ id=NDB.id; v*=0.3+SYS.adfVol; }
    else if(SYS.auP6&&SYS.dmeD1!=null){ id=SYS.dmeId1; f=1350; v*=0.2+SYS.dmeV1; }
    if(id) morse(id.replace(/[^A-Z]/g,''),f,v*0.8); }
  const mk=mkrNow(); if(mk&&(SYS.auP4||SYS.auP5)&&mkrT<=0){ mkrT=mk==='O'?0.5:0.4; beep(mk==='O'?400:1300,mk==='O'?0.3:0.12,vol*(0.2+SYS.mkrVol)); } }
function morse(t,f,v){ if(!AC) return; let at=AC.currentTime+0.05; const u=0.09; for(const ch of t){ for(const s of (MORSE[ch]||'')){ const d=s==='.'?u:3*u; try{ const o=AC.createOscillator(), g=AC.createGain(); o.frequency.value=f; g.gain.value=v; o.connect(g).connect(AC.destination); o.start(at); o.stop(at+d); }catch(e){} at+=d+u; } at+=2*u; } }
/* ---------- annunciators and master warning / caution ---------- */
let curR=[], curA=[], annLit={};
const RSET=new Set(B200P.WARN.flat().filter(Boolean)), ASET=new Set(); B200P.CAUT.flat().forEach(x=>{ if(typeof x==='string') ASET.add(x); else if(x&&x[2]==='a') ASET.add(x[0]); });
function annCompute(o){
  const A={}; if(!bus()){ annLit=A; curR=[]; curA=[]; return A; }
  const fd=cbIn('FIRE DET');
  E.forEach((e,i)=>{ const s=SIDES[i];
    if(e.fire&&fd) A[s+' ENG FIRE']=1;
    if(!e.press&&cbIn('PRESS WARN '+s)) A[s+' FUEL PRESS']=1;
    if(e.oilP<60) A[s+' OIL PRESS']=1;
    if(!e.genOn) A[s+' DC GEN']=1;
    if(e.ignOn) A[s+' IGNITION ON']=1;
    if(SYS['bleed'+s]!==-1) A[s+' BL AIR OFF']=1;
    if(e.afArm) A[s+' AUTOFEATHER']=(SYS.afSw===1&&e.afCyc>0)?'blink':1;
    if(e.vane>0.99) A[s+' ENG ANTI-ICE']=1;
    if(e.vaneT>15) A[s+' ENG ICE FAIL']=1;
    if(e.ext) A[s+' EXT D']=1;
    if(fireDet(i)&&fd) A[s+' ENG FIRE']=1;
    if(fireExtT(i)){ A[s+' EXT D']=1; A[s+' EXT OK']=1; }
    if(e.nxT>30) A['x:nx'+s]=1;
  });
  if(SYS.inv===0) A['INVERTER']=1;
  if(SYS.cab>=12500) A['ALT WARN']=1;
  if(SYS.paxDep) A['PASS OXY ON']=1;
  if(SYS.battT>0) A['BATTERY CHARGE']=1;
  if(!SYS.elTrim||!cbIn('PITCH TRIM')) A['ELEC TRIM OFF']=1;
  if(SYS.apFailT>0) A['A/P FAIL']='blink';
  if(S.ctl.gearPos>0.5&&(SYS.propL<0.97||SYS.propR<0.97)&&!S.ground&&cbIn('GEAR')) A['RVS NOT READY']=1;
  if(SYS.hydT&&cbIn('GEAR')) A['HYD FLUID LOW']=1;
  if(SYS.xfeed!==0&&cbIn('CROSSFEED')) A['FUEL CROSSFEED']=1;
  if(SYS.brakeDe) A['BRAKE DEICE ON']=1;
  if((SYS.landL||SYS.landR||SYS.taxi)&&S.ctl.gearPos<0.01) A['LDG/TAXI LIGHT']=1;
  if(SYS.acLow) A['AIR COND N1 LOW']=1;
  if((SYS.elecHeat||SYS.aftHeat)&&S.ground) A['ELEC HEAT ON']=1;
  if(GPU.on) A['EXT PWR']=1;
  if(tiesOpen()){ A['L GEN TIE OPEN']=1; A['R GEN TIE OPEN']=1; }
  if(SYS.tieOpen) A['BATT TIE OPEN']=1;
  if(SYS.trimHat&&AP.on) A['A/P TRIM FAIL']=1;
  if(avOn()&&cbIn('AUTOPILOT')){ if(AP.on) A['ap:AP']=1; if(SYS.yd) A['ap:YD']=1; if(AP.lat==='HDG') A['ap:HDG']=1; if((AP.lat==='VOR'||AP.latArm==='NAV')&&!SYS.bcMode) A['ap:NAV']=AP.latArm?'blink':1; if(SYS.bcMode&&(AP.fd||AP.on)) A['ap:B/C']=1; if(AP.lat==='LOC'||AP.lat==='VAPP'||AP.latArm==='APR') A['ap:APR']=AP.latArm?'blink':1; if(AP.vert==='ALT') A['ap:ALT']=1; if(/ALTS/.test(AP.vertArm)) A['ap:ALTS']=1; if(AP.vert==='VS') A['ap:VS']=1; if(AP.vert==='FLC') A['ap:IAS']=1; if(AP.vert==='GS'||/GS/.test(AP.vertArm)) A['ap:GS']=AP.vert==='GS'?1:'blink'; if(AP.on) A['ap:TRIM']=1; }
  // marker beacons, altitude alerter and decision height (copilot radar altimeter)
  const mk=mkrNow(); if(mk){ A['x:mkr'+mk+'1']=1; A['x:mkr'+mk+'2']=1; }
  if(avOn()){ const d=Math.abs(AP.alt-o.alt); if(d<=250||d>=1000) SYS.altCx=0; if(d>250&&d<1000&&!S.ground&&!SYS.altCx) A['x:altAl1']=A['x:altAl2']=1; }
  if(SYS.sync&&S.ctl.gearPos>0.5&&cbIn('PROP SYNC')) A['PROP SYNC ON']=1;
  { const gOk=avOn()&&cbIn('GPWS'); if(!gOk||SYS.gpwsTestT>0) A['x:gpwsInop']=1; if(gOk&&(SYS.gsCxl||SYS.gpwsTestT>0)) A['x:gsCx']=1; }
  if(avOn()&&(!gpsOk()||SYS.gpsInitT>0)) A['x:gpsInteg']=1;
  if(efisOnAux()||SYS.efisAux===1){ A['x:efisAux']=1; A['x:auxDrive']=1; }
  if(avOn()&&!S.ground&&o.agl<dhFt()&&o.agl<2500) A['x:dh1']=A['x:dh2']=1;
  if(SYS.raT&&avOn()) A['x:dh1']=A['x:dh2']=1;
  if(bus()&&cbIn('GEAR IND')&&!SYS.hdLt){ const g=S.ctl.gearPos; if(g>0.99) A['x:gN']=A['x:gL']=A['x:gR']=1; }
  if(!cbIn('ANN POWER')){ annLit={}; curR=[]; curA=[]; MW.w=MW.c=false; return annLit; }
  curR=Object.keys(A).filter(k=>RSET.has(k)&&A[k]); curA=Object.keys(A).filter(k=>ASET.has(k)&&A[k]);
  [...MW.ackR].forEach(k=>{ if(!A[k]) MW.ackR.delete(k); }); [...MW.ackA].forEach(k=>{ if(!A[k]) MW.ackA.delete(k); });
  if(curR.some(k=>!MW.ackR.has(k))){ if(!MW.w) beep(990,0.18,0.05); MW.w=true; } if(curA.some(k=>!MW.ackA.has(k))){ if(!MW.c) beep(700,0.1,0.04); MW.c=true; }
  annLit=A; return A;
}

/* ---------- autopilot / flight director controller ---------- */
let curNav={valid:false}, curNav2={valid:false};
function navNow(n){ const r=n===2?'nav2':(SYS.efisSrc?'nav2':'nav1'), crs=n===2?SYS.crs2:SYS.crs, t=NAVS[SYS[r].a]; if(!t||!radOn(r)) return {src:'VOR',valid:false,dev:0,crs}; const x=F.nav(S,t,crs); if(SYS.bcMode&&n!==2&&x.src==='LOC') x.dev=-x.dev; return x; }
function apPress(k){ if(!avOn()||!cbIn('AUTOPILOT')){ msg(tr2('Autopilot unavailable: avionics power or circuit breaker.','Autopilot utilgjengelig: avionikkstrøm eller sikring.')); return; }
  if(k==='YD'){ SYS.yd=SYS.yd?0:1; if(!SYS.yd&&AP.on){ AP.on=false; apDiscFx(); } beep(1200,0.04,0.05); return; }
  if(k==='AP'&&AP.on){ AP.on=false; apDiscFx(); return; }
  const o=F.readouts(S); SYS.apClimb=SYS.apDsc=0;
  if(k==='APPR') k='APR';
  if(k==='BC'){ SYS.bcMode=SYS.bcMode?0:1; if(SYS.bcMode){ F.apSet(AP,S,o,'NAV',curNav); } else if(AP.latArm==='NAV'||AP.lat==='LOC'){ AP.lat='ROL'; AP.latArm=''; AP.rollRef=0; } beep(1200,0.04,0.05); return; }
  if(k==='NAV'||k==='APR') SYS.bcMode=0;
  if(k==='ALTSEL'){ AP.fd=true; if(!AP.vert){ F.apSet(AP,S,o,'VS',curNav); AP.vsRef=0; } if(/ALTS/.test(AP.vertArm)) AP.vertArm=AP.vertArm.replace('ALTS','').trim(); else AP.vertArm=(AP.vertArm+' ALTS').trim(); beep(1200,0.04,0.05); return; }
  if(k==='CLIMB'||k==='DSC'){ if(k==='CLIMB'){ if(AP.vert!=='FLC') F.apSet(AP,S,o,'FLC',curNav); AP.iasRef=140; SYS.apClimb=1; } else { if(AP.vert!=='VS') F.apSet(AP,S,o,'VS',curNav); AP.vsRef=-1000; SYS.apDsc=1; } beep(1200,0.04,0.05); return; }
  if(k==='IAS') k='FLC';
  F.apSet(AP,S,o,k,curNav); if(k==='AP'&&AP.on) SYS.yd=1; beep(1200,0.04,0.05); }
function apDiscFx(){ SYS.apFailT=2.5; beep(500,0.35,0.05); flash('AP DISCONNECT'); }
function apText(){ if(!avOn()||!cbIn('AUTOPILOT')) return ''; const lat={HDG:'HDG',VOR:'NAV',LOC:SYS.bcMode?'B/C':'APPR',VAPP:'APPR',ROL:'ROLL'}[AP.lat]||''; const vt={ALT:'ALT',VS:'VS '+AP.vsRef,FLC:'IAS '+Math.round(AP.iasRef),GS:'GS',PIT:'PITCH'}[AP.vert]||'';
  return [SYS.yd?'YAW':'',AP.on?'AP':'',lat,AP.latArm?'('+AP.latArm+')':'',vt,/ALTS/.test(AP.vertArm)?'(ALT SEL)':'',/GS/.test(AP.vertArm)?'(GS)':'',SYS.apHB?'½':'',SYS.apSR?'SR':''].filter(Boolean).join('  '); }
/* ---------- flaps, gear, failures ---------- */
function setFlap(n){ n=F.clamp(n,0,2); if(n!==S.ctl.flap&&(!bus()||!cbIn('FLAP')||!cbIn('FLAP CTL'))){ msg(tr2('Flaps need electrical power.','Flaps trenger strøm.')); return; } S.ctl.flap=n; }
function toggleGear(){ if(S.ground&&SYS.gearH===1){ msg(tr2('The gear handle is locked on the ground.','Understellshendelen er låst på bakken.')); return; } SYS.gearH=SYS.gearH?0:1; beep(400,0.08,0.06); if(!bus()||!cbIn('GEAR')) msg(tr2('No power to the gear hydraulics (LANDING GEAR RELAY breaker or bus). Handle DOWN, then use the alternate extension pump.','Ingen strøm til understellshydraulikken (LANDING GEAR RELAY-sikring eller skinne). Hendel NED, bruk så den alternative pumpen.')); }
const brk=el('brk'); brk.addEventListener('pointerdown',()=>inp.brakeHeld=true); ['pointerup','pointerleave','pointercancel'].forEach(ev=>brk.addEventListener(ev,()=>inp.brakeHeld=false));
el('autoTrim').onchange=e=>S.autotrim=e.target.checked;
el('failL').onclick=()=>{ E[0].fail=true; }; el('failR').onclick=()=>{ E[1].fail=true; };
el('fireLb').onclick=()=>{ E[0].fire=true; }; el('fireRb').onclick=()=>{ E[1].fire=true; };
const gpuLbl=()=>{ el('gpuBtn').textContent=L(GPU.on?tr2('Unplug ground power','Koble fra bakkestrøm'):tr2('Plug in ground power','Koble til bakkestrøm')); };
el('gpuBtn').onclick=()=>{ if(!S.ground&&!GPU.on){ msg(tr2('Ground power: on the ground only.','Bakkestrøm: bare på bakken.')); return; } GPU.on=!GPU.on; gpuLbl(); msg(GPU.on?tr2('Ground power unit plugged in: EXT PWR light on. Battery ON, then EXT PWR — ON.','Bakkestrømenhet tilkoblet: EXT PWR-lyset tennes. Batteri PÅ, så EXT PWR — ON.'):tr2('Ground power unit unplugged.','Bakkestrømenhet frakoblet.')); };
el('decomp').onclick=()=>{ SYS.decomp=true; msg(tr2('Rapid decompression: the cabin is climbing.','Hurtig trykkfall: kabinen stiger.')); };
el('restore').onclick=()=>{ E.forEach((e,i)=>{ e.fail=false; e.fire=false; e.dmg=false; e.autoF=false; e.fwShut=false; SYS['fw'+SIDES[i]]=1; if(SYS['cond'+SIDES[i]]<0.45) SYS['cond'+SIDES[i]]=0.5; if(SYS['prop'+SIDES[i]]<0.12) SYS['prop'+SIDES[i]]=0.8; if(!e.lit){ e.lit=true; e.ng=Math.max(e.ng,62); e.itt=600; } SYS['gen'+SIDES[i]]=0; e.genRst=true; }); SYS.decomp=false; };
const rud=slider(el('rudBox'),{label:'Rudder',min:-100,max:100,step:1,v:0,f:v=>(v>0?'R ':v<0?'L ':'')+Math.abs(v)+' %',on:v=>{ inp.rudUser=v/100; }});
const windDir=slider(el('windBox'),{label:'From',min:0,max:360,step:10,v:0,f:v=>String(v||360).padStart(3,'0')+'°',on:v=>S.env.wdir=v});
const windSpd=slider(el('windBox'),{label:'Speed',min:0,max:40,step:1,v:0,f:v=>v+' kt',on:v=>S.env.wspd=v});
const turb=slider(el('windBox'),{label:'Turbulence',min:0,max:100,step:5,v:0,f:v=>v+' %',on:v=>S.env.turb=v/100});
inp.rudUser=0;

/* ---------- touch stick and yoke pad ---------- */
const tStk=el('tStk');
function setTouch(on){ el('touch').hidden=!on; el('bTouch').setAttribute('aria-pressed',on); try{ localStorage.setItem('naeroson-touch',on?'1':'0'); }catch(e){} }
el('bTouch').onclick=()=>setTouch(el('touch').hidden);
{ let pref=null; try{ pref=localStorage.getItem('naeroson-touch'); }catch(e){} setTouch(pref?pref==='1':false); }
let tO=null; function tStkAt(e){ const r=tStk.getBoundingClientRect(), R=r.width*0.42; let dx=(e.clientX-tO.x)/R, dy=(e.clientY-tO.y)/R; const m=Math.hypot(dx,dy); if(m>1){ dx/=m; dy/=m; } const sh=v=>{ const a=Math.abs(v), d=0.1, u=a<d?0:(a-d)/(1-d); return Math.sign(v)*(0.3*u+0.7*u*u*u)*0.8; }; inp.stick={x:sh(dx),y:sh(dy)}; const k=tStk.querySelector('i'); k.style.left=((tO.x-r.left)+dx*R)/r.width*100+'%'; k.style.top=((tO.y-r.top)+dy*R)/r.height*100+'%'; }
tStk.addEventListener('pointerdown',e=>{ e.preventDefault(); tStk.setPointerCapture(e.pointerId); tO={x:e.clientX,y:e.clientY}; tStkAt(e); ensureAudio(); });
tStk.addEventListener('pointermove',e=>{ if(inp.stick&&tO) tStkAt(e); });
['pointerup','pointercancel'].forEach(ev=>tStk.addEventListener(ev,()=>{ inp.stick=null; tO=null; const k=tStk.querySelector('i'); k.style.left='50%'; k.style.top='50%'; }));
const stick=el('stick'), dot=stick.querySelector('.dot');
function stickAt(e){ const r=stick.getBoundingClientRect(); inp.stick={x:FK.shapePad((e.clientX-r.left)/r.width*2-1),y:FK.shapePad((e.clientY-r.top)/r.height*2-1)}; } // expo: gentle near centre
stick.addEventListener('pointerdown',e=>{ stick.setPointerCapture(e.pointerId); stickAt(e); ensureAudio(); });
stick.addEventListener('pointermove',e=>{ if(inp.stick) stickAt(e); });
['pointerup','pointercancel'].forEach(ev=>stick.addEventListener(ev,()=>{ inp.stick=null; }));

/* ---------- keyboard ---------- */
const typing=FK.typing, KB=FK.create('B200');
let cockpitVis=true; visible(el('cockpit'),v=>cockpitVis=v);
window.addEventListener('keydown',e=>{
  if(typing()||e.metaKey||e.ctrlKey||e.altKey) return;
  if(D3on&&cockpitVis&&!e.repeat&&D3.key(e)) return; if(D3on&&e.repeat&&D3.isLookKey(e)){ e.preventDefault(); return; }
  if(e.key==='Escape'&&Z.reg!=='overview'&&!Z.lock){ zoomTo('overview'); e.preventDefault(); return; }
  if(/^[0-9]$/.test(e.key)&&cockpitVis&&!e.repeat){ const z=ZN[+e.key]; if(z){ zoomTo(z[0]); e.preventDefault(); return; } }
  if(e.target.closest&&e.target.closest('g.ctl:not(.t-yoke)')&&/^Arrow| |Enter/.test(e.key)) return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(!cockpitVis&&k!=='p') return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End',' ','+','-','=','[',']','f','v','g','p','x','q','e','b','w','a','s','d'].includes(k)) e.preventDefault();
  ensureAudio();
  if(e.repeat&&['f','v','g','p',' ','x'].includes(k)) return;
  inp.keys.add(k);
  if(k==='f') setFlap(S.ctl.flap+1); if(k==='v') setFlap(S.ctl.flap-1); if(k==='g') toggleGear();
  if(k===' '&&AP.on){ AP.on=false; apDiscFx(); }
  if(k==='x'){ rud.set(0); inp.rudUser=0; }
  if(k==='p') togglePause();
});
window.addEventListener('keyup',e=>{ const k=e.key.length===1?e.key.toLowerCase():e.key; inp.keys.delete(k); if(k==='shift') inp.keys.delete('Shift'); });
window.addEventListener('blur',()=>inp.keys.clear());
FK.hint(PST);

/* ---------- sound ---------- */
let AC=null, horn=null;
function ensureAudio(){ if(AC||!UI.sound) return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); const o=AC.createOscillator(), g=AC.createGain(); o.type='square'; o.frequency.value=420; g.gain.value=0; o.connect(g).connect(AC.destination); o.start(); horn={o,g}; }catch(e){ AC=null; } }
function beep(f,d,v){ if(!AC||!UI.sound) return; try{ const o=AC.createOscillator(), g=AC.createGain(); o.frequency.value=f; g.gain.value=v||0.05; o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime+d); }catch(e){} }
function click(){ beep(1700,0.015,0.03); }
function hornLevel(stall,gear){ if(!horn) return; const t=AC.currentTime; let v=0; if(UI.sound&&stall) v=0.035; else if(UI.sound&&gear) v=(t*2.5%1<0.5)?0.03:0; horn.g.gain.setTargetAtTime(v,t,0.02); horn.o.frequency.setTargetAtTime(stall?420:900,t,0.01); }
el('bSound').onclick=()=>{ UI.sound=!UI.sound; if(!UI.sound&&horn) horn.g.gain.value=0; el('bSound').textContent=T(UI.sound?'Sound on':'Sound off'); el('bSound').setAttribute('aria-pressed',UI.sound); if(UI.sound) ensureAudio(); };
document.addEventListener('pointerdown',ensureAudio,{once:true});
function togglePause(){ UI.paused=!UI.paused; el('bPause').textContent=T(UI.paused?'Resume':'Pause'); }
el('bPause').onclick=togglePause; el('bReset').onclick=()=>{ procStart(PR.k||'free'); if(UI.paused) togglePause(); };
LAB.onLang(()=>{ el('bPause').textContent=T(UI.paused?'Resume':'Pause'); el('bSound').textContent=T(UI.sound?'Sound on':'Sound off'); });

/* ---------- procedures and scenarios (generic training flows; follow the AFM/POH and the operator's SOP) ---------- */
const st=(t,ctl,ok,o)=>Object.assign({t,ctl,ok},o||{});
const chk=(t,ctl,ok)=>st(t,ctl,ok,{chk:1});
const both=f=>f('L')&&f('R');
const idle=()=>SYS.pwrL<0.05&&SYS.pwrR<0.05&&SYS.pwrL>-0.05&&SYS.pwrR>-0.05;
const D=()=>PR.dead, Ls=()=>SIDES[1-PR.dead], Ds=()=>SIDES[PR.dead];
const dz=(base)=>()=>base+Ds();
function startSteps(s){ const i=s==='L'?0:1; return [
  st(tr2(`IGN & START ${s} — ON (starter and igniters, IGNITION ON light)`,`IGN & START ${s} — ON (starter og tenning, IGNITION ON-lys)`),'ign'+s,()=>SYS['ign'+s]===-1&&E[i].ng>3),
  st(tr2(`At a stabilised 12 % N1 or more: condition lever ${s} — LOW IDLE`,`Ved stabile 12 % N1 eller mer: condition-hendel ${s} — LOW IDLE`),'cond'+s,()=>E[i].lit&&SYS['cond'+s]>=0.45),
  st(tr2(`Watch ITT (start limit 1000 °C) and N1 rising — at about 50 % N1: IGN & START ${s} — OFF`,`Følg ITT (startgrense 1000 °C) og N1 — ved ca. 50 % N1: IGN & START ${s} — OFF`),'ign'+s,()=>SYS['ign'+s]===0&&E[i].lit&&E[i].ng>=48),
  chk(tr2(`Oil pressure ${s} — rising, ${s} OIL PRESS out; idle N1 about 61 %`,`Oljetrykk ${s} — stiger, ${s} OIL PRESS slukker; tomgang ca. 61 % N1`),'ign'+s,()=>E[i].oilP>=60&&E[i].ng>58),
  st(tr2(`GEN ${s} — RESET, then ON (${s} DC GEN out)`,`GEN ${s} — RESET, så ON (${s} DC GEN slukker)`),'gen'+s,()=>E[i].genOn)]; }
const PROCS=[
 {k:'air',t:tr2('Airborne: procedure and auto-fly','I lufta: prosedyre og autofly'),set:'air',brief:tr2('',''),steps:[]},
 {k:'free',t:tr2('Free flight','Fri flyging'),set:'free',brief:tr2('5,000 ft, 180 KIAS on the localizer side of the field. Explore the panel: autopilot HDG and ALT, the HSI, propeller rpm, or fail an engine from the Failures section.','5000 ft, 180 KIAS. Utforsk panelet: autopilot HDG og ALT, HSI-en, propellturtall, eller stopp en motor under Feil.'),steps:[]},
 {k:'start',t:tr2('Engine start (both)','Motorstart (begge)'),set:'cold',brief:tr2('Cold aircraft on the ramp, battery start. This flow starts the right engine first, then the left. Watch N1 and ITT through every start.','Kaldt fly på oppstillingsplassen, batteristart. Denne flyten starter høyre motor først, så venstre. Følg N1 og ITT gjennom hver start.'),
  steps:[chk(tr2('Parking brake — SET','Parkeringsbrems — SATT'),'park',()=>SYS.park),
   chk(tr2('Power levers — IDLE · prop levers — FULL FORWARD','Effekthendler — IDLE · propellhendler — HELT FREM'),'pwrL',()=>idle()&&SYS.propL>0.97&&SYS.propR>0.97),
   chk(tr2('Condition levers — FUEL CUTOFF','Condition-hendler — FUEL CUTOFF'),'condL',()=>SYS.condL<0.05&&SYS.condR<0.05),
   chk(tr2('Firewall valves — OPEN','Brannskottventiler — ÅPNE'),'fwL',()=>SYS.fwL&&SYS.fwR),
   st(tr2('Battery — ON','Batteri — PÅ'),'bat',()=>SYS.bat),
   st(tr2('Annunciators — TEST (every light on)','Varsellys — TEST (alle lys på)'),'annTest',()=>PR.m.annT),
   st(tr2('MASTER WARNING and MASTER CAUTION — press to acknowledge','MASTER WARNING og MASTER CAUTION — trykk for å kvittere'),'mwL',()=>!MW.w&&!MW.c),
   st(tr2('Beacon — ON','Antikollisjonslys — PÅ'),'beacon',()=>SYS.beacon),
   ...startSteps('R'),...startSteps('L'),
   st(tr2('Inverter — ON (INVERTER light out)','Inverter — PÅ (INVERTER-lyset slukker)'),'inv',()=>SYS.inv!==0),
   st(tr2('Avionics master — ON','Avionikk — PÅ'),'avio',()=>SYS.avio)]},
 {k:'runup',t:tr2('Before take-off and autofeather test','Før avgang og autofeather-test'),set:'running',brief:tr2('Both engines running at low idle on the ramp. Set up for take-off and test the autofeather: with both engines at about 500 ft-lb and the switch held at TEST, pull one power lever back slowly. The other side\'s light goes out near 400 ft-lb, this side\'s near 200 ft-lb, then it flashes as the propeller cycles.','Begge motorer går på low idle. Klargjør for avgang og test autofeather: med begge motorene på ca. 500 ft-lb og bryteren på TEST, trekk én effekthendel sakte tilbake. Lyset på den andre siden slukker nær 400 ft-lb, denne sidens nær 200 ft-lb, og så blinker det mens propellen sykler.'),
  steps:[st(tr2('Avionics — ON, inverter ON','Avionikk — PÅ, inverter PÅ'),'avio',()=>SYS.avio&&SYS.inv!==0),
   st(tr2('Flight controls — free and correct (move the control wheel fully)','Ror — frie og riktige (beveg rattet fullt ut)'),'yokeL',()=>PR.m.yx&&PR.m.yy),
   st(tr2('Elevator trim — T/O mark','Høyderortrim — T/O-merket'),'trim',()=>Math.abs(S.ctl.trim-0.05)<0.1&&PR.m.trimMoved),
   st(tr2('Flaps — APPROACH','Flaps — APPROACH'),'flaps',()=>S.ctl.flap===1),
   st(tr2('Autofeather test: both power levers — about 500 ft-lb torque','Autofeather-test: begge effekthendler — ca. 500 ft-lb moment'),'pwrL',()=>E.every(e=>e.tq>440&&e.tq<700)),
   st(tr2('AUTOFEATHER — TEST: both AUTOFEATHER lights on','AUTOFEATHER — TEST: begge AUTOFEATHER-lysene på'),'afSw',()=>SYS.afSw===1&&E.every(e=>e.afArm)),
   st(tr2('Left power lever — slowly back: R light out (~400), L light out (~200), then L flashes','Venstre effekthendel — sakte tilbake: R-lys slukker (~400), L-lys slukker (~200), så blinker L'),'pwrL',()=>E[0].afCyc>0.6),
   st(tr2('Left power lever — back to about 500 ft-lb','Venstre effekthendel — tilbake til ca. 500 ft-lb'),'pwrL',()=>E[0].tq>440),
   st(tr2('Right power lever — the same test (L out ~400, R out ~200, R flashes)','Høyre effekthendel — samme test (L slukker ~400, R ~200, R blinker)'),'pwrR',()=>E[1].afCyc>0.6),
   st(tr2('Right power lever — back to about 500 ft-lb','Høyre effekthendel — tilbake til ca. 500 ft-lb'),'pwrR',()=>E[1].tq>440),
   st(tr2('Power levers — IDLE, AUTOFEATHER — ARM (lights out until take-off power)','Effekthendler — IDLE, AUTOFEATHER — ARM (lysene av til startkraft)'),'afSw',()=>SYS.afSw===-1&&idle()),
   st(tr2('Auto-ignition — ARM both','Auto-tenning — ARM begge'),'aignL',()=>SYS.aignL&&SYS.aignR),
   st(tr2('Pitot heat — ON both','Pitotvarme — PÅ begge'),'pitL',()=>SYS.pitL&&SYS.pitR),
   st(tr2('Bleed air — OPEN both · cabin pressure — PRESS · set the cabin altitude','Tappeluft — OPEN begge · kabintrykk — PRESS · still kabinhøyden'),'cabAlt',()=>SYS.bleedL===-1&&SYS.bleedR===-1&&SYS.pressSw===0&&PR.m.cabSet),
   chk(tr2('Prop levers — FULL FORWARD · condition levers — LOW IDLE','Propellhendler — HELT FREM · condition — LOW IDLE'),'propL',()=>SYS.propL>0.97&&SYS.propR>0.97&&SYS.condL>=0.45),
   chk(tr2('Crossfeed — OFF · firewall valves — OPEN','Crossfeed — AV · brannskottventiler — ÅPNE'),'xfeed',()=>SYS.xfeed===0&&SYS.fwL&&SYS.fwR),
   st(tr2('Strobe and landing lights — ON','Strobe- og landingslys — PÅ'),'strobe',()=>SYS.strobe&&SYS.landL&&SYS.landR),
   st(tr2('Parking brake — RELEASE','Parkeringsbrems — LØS'),'park',()=>!SYS.park)]},
 {k:'efato',t:tr2('Engine failure at rotation (autofeather)','Motorstans ved rotasjon (autofeather)'),set:'runway',brief:tr2('Lined up on runway 36, flaps APPROACH, autofeather ARM. Set take-off power and rotate at about 100 KIAS. One engine fails at lift-off. Fly first: rudder, wings level, pitch for V2 then blue line (121 KIAS). Verify the autofeather, then clean up.','Oppstilt på bane 36, flaps APPROACH, autofeather ARM. Sett startkraft og roter ved ca. 100 KIAS. En motor stopper ved løft. Fly først: sideror, vingene vannrett, nese for V2 og så blå linje (121 KIAS). Bekreft autofeather, rydd så opp.'),fail:'liftoff',
  steps:[st(tr2('Power levers — TAKE-OFF power (about 2,230 ft-lb, ITT and N1 in limits)','Effekthendler — STARTKRAFT (ca. 2230 ft-lb, ITT og N1 innenfor grenser)'),'pwrL',()=>SYS.pwrL>0.9&&SYS.pwrR>0.9),
   chk(tr2('Autofeather — both lights ON','Autofeather — begge lysene PÅ'),'afSw',()=>E[0].afArm&&E[1].afArm),
   st(tr2('Rotate at VR (about 100 KIAS) — lift off','Roter ved VR (ca. 100 KIAS) — løft av'),'yokeL',()=>!S.ground&&S.o.alt>20),
   st(tr2('ENGINE FAILURE — maintain control: rudder against the yaw, wings level, pitch for V2','MOTORSTANS — behold kontrollen: sideror mot giringen, vingene vannrett, nese for V2'),'yokeL',()=>PR.failed&&PR.t>PR.failT+3&&S.o.ias>100),
   st(tr2('Landing gear — UP (positive rate)','Understell — OPP (positiv stigning)'),'gear',()=>S.ctl.gear===0),
   st(tr2('Prop lever (failed engine) — FEATHER (verify autofeathered)','Propellhendel (død motor) — FEATHER (bekreft autofløyd)'),dz('prop'),()=>SYS['prop'+Ds()]<0.03),
   st(tr2('Airspeed — blue line 121 KIAS, climb to 1,000 ft','Fart — blå linje 121 KIAS, stig til 1000 ft'),'yokeL',()=>S.o.alt>950&&S.o.ias>112&&S.o.ias<140),
   st(tr2('Flaps — UP','Flaps — UP'),'flaps',()=>S.ctl.flap===0&&S.ctl.flapPos<0.05),
   st(tr2('Power lever (failed) — IDLE','Effekthendel (død motor) — IDLE'),dz('pwr'),()=>SYS['pwr'+Ds()]<0.05),
   st(tr2('Condition lever (failed) — FUEL CUTOFF','Condition-hendel (død motor) — FUEL CUTOFF'),dz('cond'),()=>SYS['cond'+Ds()]<0.05),
   st(tr2('Firewall valve (failed) — CLOSED','Brannskottventil (død motor) — LUKKET'),dz('fw'),()=>!SYS['fw'+Ds()]),
   st(tr2('Generator (failed) — OFF','Generator (død motor) — AV'),dz('gen'),()=>SYS['gen'+Ds()]===1),
   st(tr2('Autofeather — OFF · electrical load — check','Autofeather — AV · elektrisk last — sjekk'),'afSw',()=>SYS.afSw===0)]},
 {k:'fire',t:tr2('Engine fire on the ground','Motorbrann på bakken'),set:'running',fail:'fire',brief:tr2('Both engines at idle on the ramp. A fire warning will come on. Identify the engine from the red fire light, then shut off its fuel and extinguish. Evacuate when the aircraft is shut down.','Begge motorer på tomgang. En brannvarsling vil tennes. Identifiser motoren på det røde brannlyset, steng drivstoffet og slukk. Evakuer når flyet er slått av.'),
  steps:[st(tr2('Fire warning — identify the engine (red ENG FIRE light)','Brannvarsling — identifiser motoren (rødt ENG FIRE-lys)'),dz('fire'),()=>PR.failed&&PR.t>PR.failT+1.5),
   st(tr2('Condition lever (fire) — FUEL CUTOFF','Condition-hendel (brann) — FUEL CUTOFF'),dz('cond'),()=>SYS['cond'+Ds()]<0.05),
   st(tr2('Firewall valve (fire) — CLOSED','Brannskottventil (brann) — LUKKET'),dz('fw'),()=>!SYS['fw'+Ds()]),
   st(tr2('Fire extinguisher (fire) — PUSH (D light)','Brannslukker (brann) — TRYKK (D-lys)'),dz('fire'),()=>E[D()].ext),
   st(tr2('Other engine: condition lever — FUEL CUTOFF','Andre motor: condition-hendel — FUEL CUTOFF'),()=>'cond'+Ls(),()=>SYS['cond'+Ls()]<0.05),
   st(tr2('Generators — OFF','Generatorer — AV'),'genL',()=>SYS.genL===1&&SYS.genR===1),
   st(tr2('Battery — OFF, then evacuate','Batteri — AV, evakuer så'),'bat',()=>!SYS.bat)]},
 {k:'press',t:tr2('Pressurisation loss and emergency descent','Tap av kabintrykk og nødnedstigning'),set:'fl250',fail:'decomp',brief:tr2('Cruise at FL250 on the autopilot. The cabin will lose pressure. Masks first, then an emergency descent: idle power, props forward, flaps APPROACH below 200 KIAS, gear down below 181 KIAS, about 20° nose down at first, then hold VLE. Level off at or below 12,500 ft.','Cruise i FL250 på autopilot. Kabinen vil miste trykket. Masker først, så nødnedstigning: tomgang, propeller frem, flaps APPROACH under 200 KIAS, understell ned under 181 KIAS, ca. 20° nese ned først, hold så VLE. Flat ut i eller under 12 500 ft.'),
  steps:[st(tr2('Crew oxygen masks — ON, 100 %','Oksygenmasker — PÅ, 100 %'),'mask',()=>PR.failed&&SYS.mask),
   st(tr2('Pilot MIC switch — OXY MASK','Pilotens MIC-bryter — OXY MASK'),'micSel',()=>SYS.micSel===0),
   st(tr2('Passenger oxygen — check deployed, or pull the MANUAL OVERRIDE (PASS OXY ON light)','Passasjeroksygen — sjekk utløst, eller trekk MANUAL OVERRIDE (PASS OXY ON)'),'paxOvr',()=>SYS.paxOvr||SYS.paxDep),
   st(tr2('Autopilot — DISCONNECT','Autopilot — KOBLE UT'),'apAP',()=>!AP.on),
   st(tr2('Power levers — IDLE','Effekthendler — IDLE'),'pwrL',()=>SYS.pwrL<0.05&&SYS.pwrR<0.05),
   st(tr2('Prop levers — FULL FORWARD','Propellhendler — HELT FREM'),'propL',()=>SYS.propL>0.97&&SYS.propR>0.97),
   st(tr2('Flaps — APPROACH (below 200 KIAS)','Flaps — APPROACH (under 200 KIAS)'),'flaps',()=>S.ctl.flap===1,{bad:()=>S.ctl.flap>0&&S.o.ias>205}),
   st(tr2('Landing gear — DOWN (below 181 KIAS)','Understell — NED (under 181 KIAS)'),'gear',()=>S.ctl.gear===1,{bad:()=>S.ctl.gear===1&&S.o.ias>186}),
   st(tr2('Pitch about 20° nose down, then about 14° near VLE — descend through FL180','Nese ca. 20° ned, så ca. 14° nær VLE — sink gjennom FL180'),'yokeL',()=>S.o.alt<18000),
   st(tr2('Level off at or below 12,500 ft (start the level-off 500 ft early)','Flat ut i eller under 12 500 ft (start utflatingen 500 ft før)'),'yokeL',()=>S.o.alt<=12600&&Math.abs(S.o.vs)<700)]},
 {k:'seapp',t:tr2('Single-engine approach','Enmotors innflyging'),set:'seapp',brief:tr2('8 NM final for runway 36 at 2,500 ft, one engine feathered and secured. Trim the rudder, tune the ILS (110.30) with course 360, keep blue line or more until landing is assured, gear down at the glideslope, then land.','8 NM finale til bane 36 i 2500 ft, én motor fløyd og sikret. Trim sideroret, still inn ILS (110.30) med kurs 360, hold blå linje eller mer til landing er sikret, understell ned ved glidebanen, og land.'),
  steps:[st(tr2('Rudder trim — towards the live engine (ball centred)','Sideror-trim — mot motoren som går (kula i midten)'),'rudTrim',()=>Math.sign(SYS.rudTrim)===(D()===1?-1:1)&&Math.abs(SYS.rudTrim)>0.12),
   st(tr2('NAV 1 — 110.30 active (XFR), course 360 on the HSI','NAV 1 — 110.30 aktiv (XFR), kurs 360 på HSI-en'),'nav1X',()=>SYS.nav1.a==='110.30'&&SYS.crs===360),
   chk(tr2('Speed — blue line 121 KIAS or more until landing is assured','Fart — blå linje 121 KIAS eller mer til landing er sikret'),'yokeL',()=>S.o.ias>=115),
   st(tr2('Flaps — APPROACH','Flaps — APPROACH'),'flaps',()=>S.ctl.flap===1),
   st(tr2('Prop lever (live engine) — FULL FORWARD','Propellhendel (levende motor) — HELT FREM'),()=>'prop'+Ls(),()=>SYS['prop'+Ls()]>0.97),
   st(tr2('Landing gear — DOWN at the glideslope (three green)','Understell — NED ved glidebanen (tre grønne)'),'gear',()=>S.ctl.gear===1&&S.ctl.gearPos>0.99),
   st(tr2('Landing assured: reduce towards about 110 KIAS, flaps as required','Landing sikret: reduser mot ca. 110 KIAS, flaps etter behov'),'yokeL',()=>S.o.alt<500&&S.o.ias<125),
   st(tr2('Land on runway 36','Land på bane 36'),'yokeL',()=>S.ground&&!S.crash),
   st(tr2('Power (live) — IDLE then BETA, brakes, stop','Effekt (levende) — IDLE og så BETA, bremser, stopp'),()=>'pwr'+Ls(),()=>S.ground&&Math.abs(S.Vg)<3)]}
];
const PR={k:null,i:0,done:[],t:0,dead:1,failed:false,failT:0,m:{}};
function trimEngines(){ const o=F.readouts(S); E.forEach((e,i)=>{ const s=SIDES[i]; if(!e.lit) return; const thr=S.eng[i].thr, pp=SYS['prop'+s], np=1600+400*F.clamp((pp-0.12)/0.88,0,1); const sig=F.isa(S.h,S.env.isa).sig, dens=Math.min(1,sig/0.62);
  const tq=F.clamp(thr*2230*2000/np,150,2230); const base=Math.pow(Math.max(0,(tq-120)/(2110*dens)),1/1.25); const idle=idleNg(i);
  SYS['pwr'+s]=F.clamp(base,0,1); e.ng=idle+base*(101.5-idle); e.tq=tq; e.np=np; e.itt=520+(e.ng-61)*6.1+Math.max(0,o.oat-15)*1.2; e.ff=95+7.2*(e.ng-56)*Math.max(0.55,dens); e.oilP=60+60*F.clamp((e.ng-56)/40,0,1); e.oilT=70; }); }
function procSet(kind){
  S.env.wdir=windDir.v; S.env.wspd=windSpd.v; S.env.turb=turb.v/100; S.baro=S.env.qnh=1013;
  const ramp={ground:true,N:-260,E:-120,hdg:90,thr:0,flap:0,gear:1};
  if(kind==='cold'||kind==='running'){ F.place(S,ramp); S.Vg=0; F.readouts(S); sysDefault(kind==='cold'); if(kind==='running'){ SYS.park=1; SYS.beacon=1; } }
  else if(kind==='runway'){ F.place(S,{ground:true,N:20,E:0,hdg:360,thr:0,flap:1,gear:1}); sysDefault(false); S.ctl.flap=S.ctl.flapPos=1; SYS.afSw=-1; SYS.aignL=SYS.aignR=1; SYS.strobe=SYS.landL=SYS.landR=1; SYS.park=0; PR.dead=Math.random()<0.5?0:1; }
  else if(kind==='fl250'){ F.place(S,{N:-60000,E:0,alt:25000,ias:165,hdg:360,gear:0,flap:0}); sysDefault(false); SYS.propL=SYS.propR=0.78; trimEngines(); SYS.cab=SYS.cabSel=6000; SYS.strobe=1; SYS.aignL=SYS.aignR=1; const o=F.readouts(S); F.apSet(AP,S,o,'AP',curNav); F.apSet(AP,S,o,'HDG',curNav); F.apSet(AP,S,o,'ALT',curNav); AP.alt=25000; SYS.yd=1; }
  else if(kind==='seapp'){ PR.dead=Math.random()<0.5?0:1; F.place(S,{N:-14800,E:0,alt:2500,ias:140,hdg:360,gear:0,flap:0,fail:PR.dead?[0,1]:[1,0]}); sysDefault(false); const d=SIDES[PR.dead]; S.eng[PR.dead].fail=false;
    Object.assign(E[PR.dead],{lit:false,ng:2,itt:80,np:0,tq:0,ff:0,oilP:0,genOn:false,genRst:false}); SYS['cond'+d]=0; SYS['prop'+d]=0; SYS['fw'+d]=0; SYS['gen'+d]=1; SYS['pwr'+d]=0; trimEngines(); SYS.nav1={a:'113.30',s:'110.30'}; SYS.crs=330; SYS.cab=2500; SYS.strobe=SYS.landL=SYS.landR=1; SYS.gearH=0; }
  else if(kind==='air'){ const D=AF.D, st=D.start, to=D.cfg==='to'; F.WORLD.gsOut=!!D.gsOut;
    F.place(S,{N:st.N,E:st.E,alt:st.alt,ias:st.ias,hdg:st.hdg,gear:to?1:0,flap:to?1:0,gam:st.gam||0,thr:to?0.85:undefined}); sysDefault(false); SYS.propL=SYS.propR=to?1:0.88; trimEngines();
    SYS.cab=Math.min(st.alt,3000); SYS.strobe=1; SYS.aignL=SYS.aignR=1; SYS.recog=1; if(to){ SYS.landL=SYS.landR=1; SYS.afSw=-1; }
    SYS.nav1={a:'110.30',s:'113.30'}; SYS.nav2={a:'113.30',s:'110.30'}; SYS.crs=360; SYS.crs2=D.k==='sid'?324:360; SYS.adf={a:'375',s:'287'}; SYS.adfMd=2; SYS.d1ch=1;
    SYS.gpsWpt=(D.fpl&&D.fpl[0])||'RW36'; SYS.gpsApr=/^rnp/.test(D.k)?1:0; SYS.gpsCrs=0; }
  else { F.place(S,{N:-30000,E:2000,alt:5000,ias:180,hdg:360,gear:0,flap:0}); sysDefault(false); SYS.propL=SYS.propR=0.78; trimEngines(); SYS.cab=5000; SYS.strobe=1; }
  if(kind!=='air') F.WORLD.gsOut=false;
  if(!S.ground&&kind!=='fl250') Object.assign(AP,F.mkAP());
  if(kind!=='fl250'){ Object.assign(AP,F.mkAP()); AP.alt=kind==='seapp'?2500:5000; }
  AP.hdg=Math.round(F.wrap360(S.psi*180/Math.PI))||360; if(kind==='fl250'){ AP.hdg=360; }
  if(kind==='free'){ const o=F.readouts(S); F.apSet(AP,S,o,'HDG',curNav); F.apSet(AP,S,o,'ALT',curNav); AP.alt=7000; AP.vertArm='ALTS'; SYS.yd=1; }
  if(kind==='air'){ const o=F.readouts(S), st=AF.D.start; AP.on=true; AP.fd=true; AP.lat='HDG'; AP.hdg=st.hdg||360; AP.phiCmd=0; AP.thCmd=o.pitch;
    if(AF.D.cfg==='to'){ AP.vert='VS'; AP.vsRef=1500; AP.alt=3000; AP.vertArm='ALTS'; } else { AP.vert='ALT'; AP.altHold=Math.round(o.alt); AP.alt=Math.round(o.alt); } SYS.yd=1; }
  if(!S.ground&&GPU.on){ GPU.on=false; gpuLbl(); }
  SYS.gearH=S.ctl.gear; S.autotrim=el('autoTrim').checked; holdPitch=null; holdRoll=null; inp.rudI=0; SYS.rudTrim=0; rud.set(0); inp.rudUser=0; S.trail.length=0;
}
/* ---------- airborne procedures and auto-fly (airproc.js) ---------- */
const AIRCAPS={gps:'nav',adf:true}; let AIRK='ils';
const AF=AIRPROC.autofly({type:'B200',S,F,AP,nav:()=>curNav,power:{get:()=>Math.max(0,(SYS.pwrL+SYS.pwrR)/2),set:v=>{ SYS.pwrL=SYS.pwrR=F.clamp(v,0,1); }},
  say:(m,c)=>{ pill(m,c==='bad'?'bad':'ok'); flash(m); },cfg:()=>({gear:S.ctl.gear,flap:S.ctl.flap}),
  useLoc:()=>{ SYS.efisSrc=0; if(SYS.nav1.a!=='110.30') SYS.nav1={a:'110.30',s:SYS.nav1.a}; SYS.crs=360; },apOn:()=>{ SYS.yd=1; },apOff:()=>apDiscFx(),onOff:()=>airUI()});
function airSteps(k){ const app=AIRPROC.isApp(k)||k==='star';
  if(k==='sid') return [st(tr2('Landing gear — UP (positive rate)','Understell — OPP (positiv stigning)'),'gear',()=>S.ctl.gear===0),
    st(tr2('Yaw damper — ON','Yaw damper — PÅ'),'apYD',()=>!!SYS.yd),
    st(tr2('Flaps — UP (above about 130 KIAS)','Flaps — UP (over ca. 130 KIAS)'),'flaps',()=>S.ctl.flap===0&&S.ctl.flapPos<0.05),
    st(tr2('Climb power — props 1900 RPM (prop levers back a little)','Stigeeffekt — propeller 1900 o/min (propellhendlene litt tilbake)'),'propL',()=>SYS.propL<0.95&&SYS.propR<0.95),
    st(tr2('Landing lights — OFF','Landingslys — AV'),'landL',()=>!SYS.landL&&!SYS.landR),
    st(tr2('Autofeather — OFF after the climb is established','Autofeather — AV når stigningen er etablert'),'afSw',()=>SYS.afSw===0)];
  if(k==='hold') return [chk(tr2('Holding speed — about 160 KIAS (auto-fly sets the power)','Ventefart — ca. 160 KIAS (autofly setter effekten)'),'pwrL',()=>S.o.ias<175),
    st(tr2('Pitot heat — ON both','Pitotvarme — PÅ begge'),'pitL',()=>SYS.pitL&&SYS.pitR),
    st(tr2('Prop levers — 1900 RPM or less for the hold','Propellhendler — 1900 o/min eller mindre i ventingen'),'propL',()=>SYS.propL<0.95&&SYS.propR<0.95)];
  if(!app) return [];
  return [chk(tr2('NAV 1 — IASN 110.30 active, course 360','NAV 1 — IASN 110.30 aktiv, kurs 360'),'crsK',()=>SYS.nav1.a==='110.30'&&SYS.crs===360),
    st(tr2('Recognition and landing lights — ON','Gjenkjennings- og landingslys — PÅ'),'landL',()=>SYS.landL&&SYS.landR),
    st(tr2('Prop levers — FULL FORWARD','Propellhendler — HELT FREM'),'propL',()=>SYS.propL>0.97&&SYS.propR>0.97),
    st(tr2('Flaps — APPROACH (below 200 KIAS)','Flaps — APPROACH (under 200 KIAS)'),'flaps',()=>S.ctl.flap>=1,{bad:()=>S.ctl.flap>0&&S.o.ias>205}),
    st(tr2('Landing gear — DOWN at the glide path or FAF (three green)','Understell — NED ved glidebanen eller FAF (tre grønne)'),'gear',()=>S.ctl.gear===1&&S.ctl.gearPos>0.99,{bad:()=>S.ctl.gear===1&&S.o.ias>186}),
    st(tr2('Flaps — DOWN for landing (below 157 KIAS)','Flaps — DOWN for landing (under 157 KIAS)'),'flaps',()=>S.ctl.flap===2),
    st(tr2('Minimums: land (autopilot off) or go around','Minima: land (autopilot av) eller gå rundt'),'apAP',()=>!AP.on&&(S.ground||!!AF.rec.decision))]; }
function airUI(){ if(!AIRUI) return; AIRUI.draw(PR.k==='air'?AIRK:PR.k==='free'?'free':'',AF.on); }
function pickProc(k){ AIRK=k==='free'?AIRK:k; procStart(k==='free'?'free':'air'); }
function toggleAuto(){ if(AF.on) AF.off('toggle'); else { if(PR.k!=='air'&&PR.k!=='free'){ pickProc(AIRK); } AF.engage(); } airUI(); }
let AIRUI=null;
function procStart(k){
  const p=PROCS.find(x=>x.k===k)||PROCS[0];
  if(UI.paused) togglePause(); S.crash=null;
  AF.off('reset',true); AF.setProc(p.k==='air'?AIRK:p.k==='free'?'free':'free',AIRCAPS); if(p.k==='air'){ p.steps=airSteps(AIRK); p.brief=AIRPROC.brief(AIRK,'B200'); }
  Object.assign(PR,{k:p.k,i:0,done:p.steps.map(()=>0),t:0,failed:false,failT:0,m:{},bad:0}); p.steps.forEach(s=>{ delete s.b; s.okT=0; });
  procSet(p.set); renderProc(); procFocus(); drawScenSel(); airUI();
}
const curStep=()=>{ const p=PROCS.find(x=>x.k===PR.k); return p&&p.steps[PR.i]; };
const ctlOf=s=>typeof s.ctl==='function'?s.ctl():s.ctl;
function hlCtl(id){ P.svg.querySelectorAll('g.ctl.hl').forEach(g=>g.classList.remove('hl')); if(!id) return; const o=P.byId[id]; if(o) o.g.classList.add('hl'); }
function procFocus(){ const s=curStep(); if(!s){ hlCtl(null); pill(null); return; } const id=ctlOf(s); hlCtl(id); pill(L(s.t));
  if(el('follow').checked&&!Z.lock){ const o=P.byId[id]; if(o){ const b=o.g.getBBox(); const k=regionAt({x:b.x+b.width/2,y:b.y+b.height/2}); if(k&&k!==Z.reg) zoomTo(k); } } }
let pillT=0;
function pill(t,cls){ const p=el('pill'); if(!t){ p.className='pill'; return; } p.textContent=t; p.className='pill show '+(cls||''); if(cls) pillT=1.6; }
function procBad(){ PR.bad=(PR.bad||0)+1; }
function procTouch(k){ const s=curStep(); if(!s) return; const id=ctlOf(s); const base=x=>x.replace(/[LR](On)?$/,'');
  if(k==='crsK'||k==='navK'||k==='navSw') return;
  if(k==='cabAlt') PR.m.cabSet=1; if(k==='trim') PR.m.trimMoved=1;
  if(typeof s.ctl==='function'&&k!==id&&base(k)===base(id)&&/^(prop|cond|fw|gen|pwr|fire)[LR]$/.test(k)){ pill(L(tr2('Wrong engine! Identify — verify — then act on the failed one.','Feil motor! Identifiser — verifiser — gjør så tiltaket på motoren som har sviktet.')),'bad'); beep(160,0.3,0.06); procBad(); const o=P.byId[k]; if(o){ o.g.classList.add('bad'); setTimeout(()=>o.g.classList.remove('bad'),1200); } return; }
  if(k===id||base(k)===base(id)||/^(mw|mc|ap|ann|stick|trim|yoke|fireTest|hdg|alt|baro|com|dim|cab)/.test(k)||k.endsWith('G')||k.endsWith('On')) return;
  const p=PROCS.find(x=>x.k===PR.k); const later=p.steps.slice(PR.i+1).some(x=>{ const c=ctlOf(x); return c===k||base(c)===base(k); });
  if(later){ pill(L(tr2('Not yet — next: ','Ikke ennå — neste: '))+L(s.t),'bad'); beep(220,0.12,0.05); const o=P.byId[k]; if(o){ o.g.classList.add('bad'); setTimeout(()=>o.g.classList.remove('bad'),900); } }
}
function procTick(dt){
  const p=PROCS.find(x=>x.k===PR.k); if(!p) return; PR.t+=dt;
  if(inp.stick){ if(Math.abs(inp.stick.x)>0.6) PR.m.yx=1; if(Math.abs(inp.stick.y)>0.6) PR.m.yy=1; }
  if(p.fail&&!PR.failed){
    if(p.fail==='liftoff'&&!S.ground&&S.o.alt>15){ PR.ltT=(PR.ltT||0)+dt; if(PR.ltT>1.2){ E[PR.dead].fail=true; PR.failed=true; PR.failT=PR.t; } }
    if(p.fail==='fire'&&PR.t>3){ PR.dead=Math.random()<0.5?0:1; E[PR.dead].fire=true; PR.failed=true; PR.failT=PR.t; }
    if(p.fail==='decomp'&&PR.t>4){ SYS.decomp=true; PR.failed=true; PR.failT=PR.t; msg(tr2('Rapid decompression: the cabin is climbing.','Hurtig trykkfall: kabinen stiger.')); }
  }
  if(pillT>0){ pillT-=dt; if(pillT<=0) procFocus(); }
  const s=p.steps[PR.i]; if(!s) return;
  if(s.bad&&s.bad()&&!s.badShown){ s.badShown=1; pill(L(tr2('Limit exceeded — slow down first.','Grense overskredet — sakk farten først.')),'bad'); procBad(); }
  if(s.ok.call(s)){ s.okT=(s.okT||0)+dt; if(!s.chk||s.okT>0.6){ s.okT=0; PR.done[PR.i]=1; PR.i++; beep(880,0.07,0.05); renderProc(); if(PR.i>=p.steps.length){ hlCtl(null); pill(L(tr2('Checklist complete','Sjekkliste fullført')),'ok'); if(window.NPROG) try{ NPROG.award('b200:'+p.k,Math.max(40,100-15*(PR.bad||0))); }catch(e){} } else { procFocus(); pill('✓ '+L(p.steps[PR.i-1].t),'ok'); } } }
  else s.okT=0;
}
function renderProc(){
  const sel=el('procSel'); sel.innerHTML=PROCS.map(p=>`<option value="${p.k}"${p.k===PR.k?' selected':''}>${L(p.t)}</option>`).join('');
  const p=PROCS.find(x=>x.k===PR.k); if(!p){ el('proc').innerHTML=''; return; }
  const cur=p.steps[PR.i];
  el('proc').innerHTML=`${cur?`<div class="next"><small>${L(tr2('Next step','Neste steg'))} ${PR.i+1}/${p.steps.length}</small><b>${L(cur.t)}</b><div class="row"><button id="pBack"${PR.i?'':' disabled'}>← ${L(tr2('Back','Tilbake'))}</button><button id="pSkip">${L(tr2('Skip','Hopp over'))} →</button></div></div>`:''}<p class="brief">${L(p.brief)}</p>${p.steps.length?`<ul class="checks">${p.steps.map((s,i)=>`<li class="${PR.done[i]===1?'ok':PR.done[i]===2?'skip':i===PR.i?'now':''}"><i>${PR.done[i]===1?'✓':PR.done[i]===2?'–':i+1}</i><span>${L(s.t)}${s.chk?`<small>${L(tr2('check','sjekk'))}</small>`:''}</span></li>`).join('')}</ul>`:''}
   ${p.steps.length&&PR.i>=p.steps.length?`<div class="callout blue"><b>${L(tr2('Checklist complete.','Sjekklisten er fullført.'))}</b> ${PR.bad?L(tr2('Remarks: ','Merknader: '))+PR.bad:L(tr2('Clean run.','Ren gjennomføring.'))}</div>`:''}
   <div class="row"><button id="procRe">${L(tr2('Restart scenario','Start scenarioet på nytt'))}</button></div>`;
  if(el('pSkip')){ el('pSkip').onclick=()=>{ PR.done[PR.i]=2; PR.i++; renderProc(); if(PR.i<p.steps.length) procFocus(); else { hlCtl(null); pill(null); } }; el('pBack').onclick=()=>{ if(!PR.i) return; PR.i--; PR.done[PR.i]=0; delete p.steps[PR.i].b; renderProc(); procFocus(); }; }
  el('procRe').onclick=()=>procStart(PR.k);
  const now=el('proc').querySelector('li.now'); if(now) now.scrollIntoView({block:'nearest'});
}
el('procSel').onchange=e=>procStart(e.target.value);
LAB.onLang(()=>{ renderProc(); drawScenSel(); renderLim(); if(PR.k) procFocus(); });
function drawScenSel(){ el('scenSel').innerHTML=PROCS.map(x=>`<option value="${x.k}"${x.k===PR.k?' selected':''}>${T('Scenario')}: ${L(x.t)}</option>`).join(''); }
el('scenSel').onchange=e=>{ procStart(e.target.value); setDrawer(true); };
function setDrawer(on){ el('drawer').classList.toggle('open',on); el('bDrawer').setAttribute('aria-pressed',on); setTimeout(()=>zoomTo(Z.reg,true,true),320); }
el('bDrawer').onclick=()=>setDrawer(!el('drawer').classList.contains('open'));
el('drawer').querySelector('.tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; el('drawer').querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b)); el('tabProc').hidden=b.dataset.t!=='proc'; el('tabLim').hidden=b.dataset.t!=='lim'; });
const LIM=[[tr2('Torque, maximum','Moment, maks'),'2,230 ft-lb'],[tr2('ITT, take-off and maximum continuous','ITT, avgang og maks kontinuerlig'),'800 °C'],[tr2('ITT, starting (5 s)','ITT, start (5 s)'),'1,000 °C'],[tr2('N1, maximum','N1, maks'),'101.5 %'],[tr2('N1, low idle (minimum, varies by serial)','N1, low idle (minimum, varierer)'),'≈ 56–61 %'],[tr2('N1, high idle','N1, high idle'),'≈ 70 %'],[tr2('Propeller rpm, maximum','Propellturtall, maks'),'2,000'],[tr2('N1, maximum reverse','N1, maks revers'),'88 %'],[tr2('Oil pressure, normal (minimum at idle 60)','Oljetrykk, normalt (minst 60 på tomgang)'),'100–135 psi'],[tr2('Oil temperature','Oljetemperatur'),'0–99 °C'],[tr2('Autofeather: other side disarms / feather','Autofeather: andre side desarmeres / fløying'),'400 / 200 ft-lb'],[tr2('Auto-ignition active below','Auto-tenning aktiv under'),'400 ft-lb'],
 ['VMCA','86 KIAS'],[tr2('VYSE (blue line)','VYSE (blå linje)'),'121 KIAS'],['VMO','259 KIAS'],[tr2('VFE approach / full flaps','VFE approach / fulle flaps'),'200 / 157 KIAS'],[tr2('VLO extend and VLE','VLO ut og VLE'),'181 KIAS'],[tr2('VLO retract','VLO inn'),'163 KIAS'],[tr2('Cabin differential, maximum','Kabintrykkforskjell, maks'),'6.6 psi'],[tr2('Cabin altitude warning (ALT WARN)','Kabinhøydevarsel (ALT WARN)'),'12,500 ft']];
function renderLim(){ el('tabLim').innerHTML=`<p class="warnline">${L(tr2('Typical King Air B200 values for learning — verify in your AFM/POH; they vary with serial number.','Typiske King Air B200-verdier for læring — kontroller i AFM/POH; de varierer med serienummer.'))}</p><table class="lim">${LIM.map(([a,b])=>`<tr><td>${L(a)}</td><td>${b}</td></tr>`).join('')}</table>`; }
renderLim();

/* ---------- messages ---------- */
function msg(m){ pill(L(m),'bad'); flash(L(m)); flashT=5; }

/* ---------- instruments ---------- */
let turnRate=0, lastHdg=null, synA=0, lastDraw=performance.now(), lastSlow=-1e9, engTxt='';
const raF2=v=>{ v=F.clamp(v,0,2500); return v<=500?v/500*0.62:0.62+Math.log10(v/500)/Math.log10(5)*0.38; };
const raF=v=>{ v=F.clamp(v,0,2500); return v<=500?v/500*0.55:0.55+Math.log10(v/500)/Math.log10(5)*0.45; };
function radTxt(k,a){ if(!radOn(k)) return ''; if(SYS[k+'T']) return k.startsWith('com')?'888.888':k==='adf'?'8888':'888.88'; return a; }
function draw(o){
  const b=bus(), av=avOn(), now=performance.now(), dt=Math.min(0.1,(now-lastDraw)/1000); lastDraw=now;
  // slow-changing read-outs (DME, counters, MFD and GPS maps and pages, engine read-out) at 10 Hz; at once after any control input
  const slowDo=slowForce||now-lastSlow>=100; if(slowDo){ lastSlow=now; slowForce=false; }
  const asF=SYS.asF||0;
  B200P.flight(P,{ias:o.ias+3*asF,alt:o.alt+45*asF,baro:S.baro,roll:o.roll,pitch:o.pitch,slip:o.slip},'');
  B200P.flight(P,{ias:o.ias,alt:o.alt,baro:S.baro,roll:o.roll,pitch:o.pitch,slip:o.slip},'2');
  B200P.vis(P,'altflag-alt',asF>0.5);
  B200P.needle(P,'vsi',o.vs+(SYS.asVs||0)); B200P.needle(P,'vsi2',o.vs);
  const tsOk=b&&cbIn('TURN & SLIP'); B200P.rot(P,'tcp-ts',tsOk?F.clamp(turnRate/3*20,-40,40):0); B200P.vis(P,'tsflag-ts',!tsOk); B200P.tr(P,'ball-ts',`translateX(${(F.clamp(o.slip,-1,1)*14).toFixed(1)}px)`);
  B200P.rot(P,'tcp-ts2',b?F.clamp(turnRate/3*20,-40,40):0); B200P.vis(P,'tsflag-ts2',!b); B200P.tr(P,'ball-ts2',`translateX(${(F.clamp(o.slip,-1,1)*14).toFixed(1)}px)`);
  const h=o.hdg, h1=F.wrap360(h+SYS.hdgErr1), h2=F.wrap360(h+SYS.hdgErr2);
  [[1,'',h1,curNav,SYS.crs,74],[2,'2',h2,curNav2,SYS.crs2,66]].forEach(([n,sf,hc,nv,crs,r])=>{ const id='hsi'+sf;
    B200P.rot(P,'hcard-'+id,-hc); B200P.rot(P,'hbug-'+id,AP.hdg-hc); B200P.rot(P,'hcrs-'+id,crs-hc);
    B200P.tr(P,'hdev-'+id,`translateX(${((nv.valid?F.clamp(nv.dev,-1.2,1.2):0)*0.34*r).toFixed(1)}px)`); B200P.vis(P,'hflag-'+id,!nv.valid); B200P.vis(P,'htf-'+id,nv.valid&&nv.toFrom==='TO'); B200P.vis(P,'hhdg-'+id,!b);
    B200P.vis(P,'hgs-'+id,!!(nv.valid&&nv.gs)); if(nv.gs) B200P.tr(P,'hgs-'+id,`translateY(${(F.clamp(nv.gs.dev,-1.2,1.2)*0.34*r).toFixed(1)}px)`);
    const rv=n===1?'nav1':'nav2', t=NAVS[SYS[rv].a], vb=radOn(rv)&&t==='VOR'?F.nav(S,'VOR',0):null, ab=adfNow();
    B200P.rot(P,'rcard-rmi'+sf,-hc); B200P.rot(P,'rn1-rmi'+sf,vb&&vb.valid?vb.brg-h:90); B200P.rot(P,'rn2-rmi'+sf,ab!=null?ab-h:90);
    B200P.rot(P,'slv-'+n,b?F.clamp((n===1?SYS.hdgErr1:SYS.hdgErr2)*4,-40,40):0); });
  if(AP.fd&&av) B200P.tr(P,'fdb-adi',`translateY(${(F.clamp(o.pitch-AP.thCmd,-12,12)*74*0.04).toFixed(1)}px) rotate(${F.clamp(AP.phiCmd-o.roll,-30,30).toFixed(1)}deg)`); B200P.vis(P,'fdb-adi',AP.fd&&av);
  E.forEach((e,i)=>{ const s=SIDES[i], ep=b&&cbIn('ENG INSTR '+s), ci=k=>ep&&cbIn(k+' '+s); B200P.needle(P,'TQ'+s,ci('TQ')?e.tq:0); B200P.needle(P,'ITT'+s,ci('ITT')?e.itt:100); B200P.needle(P,'NP'+s,ci('NP')?e.np:0); B200P.needle(P,'NG'+s,ci('NG')?e.ng:0); B200P.needle(P,'FF'+s,ci('FF')?e.ff:0); B200P.needle(P,'OIL'+s,ci('OILP')?e.oilP:0,'P'); B200P.needle(P,'OIL'+s,ci('OILT')?e.oilT:-40,'T');
    B200P.text(P,'dg-TQ'+s,ci('TQ')?String(Math.round(e.tq/10)*10):''); B200P.text(P,'dg-NG'+s,ci('NG')?e.ng.toFixed(1):'');
    B200P.needle(P,'fq'+s,b&&cbIn('QTY IND '+s)?(SYS.fqSel?e.main:e.aux):0); });
  B200P.needle(P,'cab',SYS.cab,'A'); B200P.needle(P,'cab',SYS.diff||0,'D'); B200P.needle(P,'cvs',SYS.cabVS);
  const fp=S.ctl.flapPos; B200P.needle(P,'flp',b?(fp<=1?fp*40:40+(fp-1)*60):0);
  // overhead meters (push for volts)
  const gv=i=>E[i].genOn?28.2:0, bv=E.some(e=>e.genOn)&&!tiesOpen()?28.2:extOn()?28:SYS.bat?(E.some(e=>e.ng>3&&!e.lit&&e.stT>0)?21.5:24.3):0;
  const load=(av?14:4)+(SYS.wsP?9:0)+(SYS.wsC?9:0)+(SYS.propDe?12:0)+(SYS.landL+SYS.landR+SYS.taxi)*4+(SYS.elecHeat?20:0)+(SYS.aftHeat?12:0)+(SYS.battT>0?18:0)+(SYS.inv?6:0);
  const nG=E.filter(e=>e.genOn).length;
  B200P.needle(P,'ldL',SYS.vLoadL?gv(0)/30*100:E[0].genOn?load/nG:0); B200P.needle(P,'ldR',SYS.vLoadR?gv(1)/30*100:E[1].genOn?load/nG:0);
  B200P.needle(P,'bam',SYS.vBatt?-60+bv/30*120:!SYS.bat?0:extOn()?4:(nG&&tiesOpen())?-6:nG?(SYS.battT>0?SYS.battT*2:2):-F.clamp(load*0.8+(E.some(e=>e.stT>0&&!e.genOn&&(SYS.ignL||SYS.ignR))?60:0),0,60));
  const acOn=b&&SYS.inv!==0; B200P.needle(P,'acm',acOn?(SYS.vAC?380+(115-100)/30*40:400):380);
  // standby compass (erratic with windshield heat or air conditioning)
  const jit=(SYS.wsP||SYS.wsC||SYS.acRun)?Math.sin(now/180)*6+Math.sin(now/57)*3:0; B200P.tr(P,'cmp',`translateX(${(-(F.wrap180(h+jit))*0.9).toFixed(1)}px)`);
  // synchroscope
  if(b&&E[0].lit&&E[1].lit) synA+=(E[0].np-E[1].np)*dt*8; B200P.rot(P,'syn',synA%360);
  // copilot radar altimeter and DME indicators
  const raV=SYS.raT?100:o.agl; B200P.needle(P,'ra',av?raV:2500); B200P.vis(P,'raflag',!av); B200P.rot(P,'dhb',-30+raF2(dhFt())*300);
  if(slowDo) [1,2].forEach(n=>{ const on=av&&cbIn('DME')&&SYS[n===1?'dmePwr':'dme2Pwr'], d=SYS['dmeD'+n], sel=SYS['d'+n+'sel'], ch=SYS['d'+n+'ch'], hold=ch<3&&SYS.dmeHold[ch];
    B200P.text(P,'dm-d'+n+'a',on?(d!=null?d.toFixed(1):'---.-'):''); B200P.text(P,'dm-d'+n+'u',on?'NM':'');
    const gs=SYS.dmeGs[n]; B200P.text(P,'dm-d'+n+'b',!on||d==null?'':sel===0?Math.round(gs)+' KT':sel===1?(gs>30?Math.min(99,Math.round(d/gs*60))+' MIN':'-- MIN'):SYS['dmeId'+n]);
    B200P.text(P,'dm-d'+n+'c',on?'CH '+ch+(hold?'  HLD':''):''); });
  // radios
  const tNow=performance.now();
  ['com1','com2','nav1','nav2','adf'].forEach(k=>{ const on=radOn(k), act=!!SYS[k+'Act'], hld=k.startsWith('nav')&&SYS[k+'Md']===2;
    B200P.text(P,'rd-'+k+'A',radTxt(k,SYS[k].a)); B200P.text(P,'rd-'+k+'S',!on?'':act&&!SYS[k+'T']?'------':hld&&!SYS[k+'T']?SYS.dmeHold[k==='nav1'?1:2]||SYS[k].s:radTxt(k,SYS[k].s));
    const chg=on&&(tNow-(SYS.chgT[k]||-1e9)<900||SYS[k+'T']), mem=on&&!act&&SYS.mem[k][SYS.memI[k]]===SYS[k].s;
    B200P.text(P,'rd-'+k+'N0',chg?'ACT':''); B200P.text(P,'rd-'+k+'N1',mem?'MEM':'');
    if(k!=='adf') B200P.text(P,'rd-'+k+'N2',!on?'':k.startsWith('nav')?(hld?'HLD':''):''); });
  const xo=radOn('xpdr'), xm=SYS.xpdrMd; B200P.text(P,'rd-xpdrA',xo?(SYS.xpdrT?'8888':SYS.xpdr):''); const xr=xo&&xm>1&&(SYS.identT>0?blinkOn():Math.random()<0.15); B200P.text(P,'rd-xpdrN0',xo&&tNow-(SYS.chgT.xpdr||-1e9)<900?'ACT':''); B200P.text(P,'rd-xpdrN1',xr?'TX':''); B200P.text(P,'rd-xpdrS',xo?('ATC '+(SYS.xpdr12?1:2)+'  '+['','SBY','ON','ALT'][xm]+(xm===3?(cbIn('ENCD ALTM')?' · ALTM '+(SYS.encAlt?1:2):' FAIL'):'')):'');
  B200P.text(P,'rd-altsel',av?(AP.alt/1000).toFixed(1):''); B200P.text(P,'rd-apm',apText()); B200P.text(P,'rd-apm2',apText());
  if(slowDo) B200P.text(P,'rd-fcons',b?String(Math.round(Math.max(0,fuelUsed()-(SYS.fcOff||0)))).padStart(4,'0'):'');
  { const d=new Date(), mn=d.getMinutes()+d.getSeconds()/60, hr=(d.getHours()%12)+mn/60; ['c1','c2'].forEach(c=>{ B200P.rot(P,'clkh-'+c,hr*30); B200P.rot(P,'clkm-'+c,mn*6); }); }
  B200P.rot(P,'pctlp',-150+F.clamp((SYS.cabSel+1000)/11000,0,1)*300); B200P.text(P,'rd-cab2',b?'ACFT '+Math.max(0,Math.round(hP(pA(SYS.cabSel)-6.5*68.95)/100)*100):'');
  { const br=(0.45+0.55*SYS.annBrt).toFixed(2); if(P.svg._br!==br){ P.svg._br=br; P.svg.style.setProperty('--rbrt',br); } }
  if(slowDo){ B200P.text(P,'rd-oat',b&&cbIn('OAT')?(SYS.oatF?Math.round(o.oat*9/5+32)+' °F':Math.round(o.oat)+' °C'):'');
  B200P.text(P,'rd-hobbs',String(SYS.hobbs.toFixed(1)).padStart(6,'0')); }
  // copilot subpanel gauges
  const pd=SYS.propDe; B200P.needle(P,'pamp',b&&cbIn('PROP DEICE')&&E.some(e=>e.lit)?(pd===-1?20+2*Math.sin(now/900):pd===1?22:0):0);
  const pneu=E.some((e,i)=>e.lit&&e.ng>55&&SYS['bleed'+SIDES[i]]!==1); B200P.needle(P,'suct',pneu?5.1:0); B200P.needle(P,'pneu',pneu?(SYS.surf&&Math.sin(now/1500)>0?15.5:18):0);
  B200P.needle(P,'ctemp',SYS.cabT); B200P.needle(P,'oxy',SYS.o2psi);
  B200P.tr(P,'aitr',`translateX(${((SYS.ailTrim-0.5)*44).toFixed(1)}px)`);
  B200P.ann(P,annLit,SYS.annTest&&b&&cbIn('ANN POWER'),blinkOn());
  drawEfis(o,h1,h2); if(slowDo){ drawMfd(o,h1); drawGps(o); }
  B200P.vis(P,'alttest-alt',!!SYS.altT);
  [['','tcasM','tcasRng'],['2','tcasM2','tcasRng2']].forEach(([n,m,r])=>{ const on=radOn('xpdr')&&SYS.xpdrMd===3&&cbIn('TCAS'); B200P.vis(P,'tcasoff-vsi'+n,!on); B200P.text(P,'tcasm-vsi'+n,on?(['','ABV ','BLW '][SYS[m]]+SYS[r]+' NM'):''); });
  if(slowDo){ const d2=SYS.dmeD2, on=av&&cbIn('DME')&&SYS.dme2Pwr; B200P.text(P,'h2-dme',on&&d2!=null?d2.toFixed(1):'---'); B200P.text(P,'h2-crs',String(SYS.crs2).padStart(3,'0')); B200P.text(P,'h2-gsp',on&&d2!=null?String(Math.round(SYS.dmeGs[2])):'---'); B200P.text(P,'h2-src',radOn('nav2')?(NAVS[SYS.nav2.a]==='LOC'?'LOC2':'VOR2'):''); }
  if(slowDo&&PST.closest('.ckp')){ const t=E.map((e,i)=>`${SIDES[i]}: TQ ${Math.round(e.tq)} · ITT ${Math.round(e.itt)} · N1 ${e.ng.toFixed(1)} · NP ${Math.round(e.np)}`).join('<br>')+`<br>${L(tr2('Cabin','Kabin'))} ${Math.round(SYS.cab)} ft · ΔP ${(SYS.diff||0).toFixed(1)} psi<br>${L(tr2('Fuel','Drivstoff'))} L ${Math.round(E[0].main+E[0].aux)} · R ${Math.round(E[1].main+E[1].aux)} lb`; if(t!==engTxt){ engTxt=t; el('engRead').innerHTML=t; } }
}
/* ---------- EFIS, multifunction display and GPS ---------- */
const MKN={O:'OM',M:'MM',I:'IM'};
function drawEfis(o,hc,hc2){
  const onM=efisMain(), aux=efisOnAux(), on=onM||aux, nv=curNav, srcR=SYS.efisSrc?'nav2':'nav1';
  const fd=(AP.fd||AP.on)&&avOn()&&cbIn('AUTOPILOT');
  const latT={HDG:'HDG',VOR:'VOR',LOC:SYS.bcMode?'B/C':'LOC',VAPP:'APR',ROL:'ROL'}[AP.lat]||'', vertT={ALT:'ALT',VS:'VS',FLC:'IAS',GS:'GS',PIT:'PIT'}[AP.vert]||'';
  const ra=avOn()&&cbIn('RAD ALTM')?(SYS.raT?100:o.agl):null, dh=dhFt(), mk=mkrNow();
  const gs=nv.valid&&nv.gs?nv.gs.dev:null, loc=nv.valid&&nv.src==='LOC'?nv.dev:null;
  const brgOf=(sel,n)=>{ if(sel===2){ const a=adfNow(); return a; } if(sel===1){ const r=n===1?'nav1':'nav2', t=NAVS[SYS[r].a]; if(radOn(r)&&t==='VOR'){ const x=F.nav(S,'VOR',0); return x.valid?x.brg:null; } } return null; };
  const b1=brgOf(SYS.brgSel1,1), b2=brgOf(SYS.brgSel2,2);
  const st=NAVS[SYS[srcR].a], dme=radOn(srcR)&&st&&cbIn('DME')?F.nav(S,st,0):null;
  const et=Math.floor(SYS.etT), etx=String(Math.floor(et/60)).padStart(2,'0')+':'+String(et%60).padStart(2,'0');
  B200P.efis(P,{onA:on&&cbIn('EADI'),onH:on&&cbIn('EHSI'),dim:SYS.efisDim,roll:o.roll,pitch:o.pitch,fd,fdP:o.pitch-AP.thCmd,fdR:AP.phiCmd-o.roll,
    lat:fd?latT:'',latA:fd?(AP.latArm||''):'',vert:fd?vertT:'',vertA:fd?(AP.vertArm||'').replace('ALTS','ALT').trim():'',ap:AP.on?'AP':SYS.yd?'YD':'',
    gs,loc,ra,dh,dhA:ra!=null&&!S.ground&&ra<dh,mkr:mk?MKN[mk]:'',spd:fd&&AP.vert==='FLC'?(o.ias-AP.iasRef)/10:null,slip:o.slip,
    hdg:hc,bug:AP.hdg,crs:SYS.crs,dev:nv.dev,valid:!!nv.valid,tf:nv.toFrom,b1,b2,arc:!!SYS.efisArc,
    dist:dme&&dme.dist!=null&&dme.dist<199?dme.dist.toFixed(1):'----',et:etx,src:(st==='LOC'?'LOC':'VOR')+(SYS.efisSrc+1),brg:['---','VOR1','ADF'][SYS.brgSel1],brgFail:true,flag:radOn(srcR)&&nv.valid?'':'NAV'});
  /* copilot's EADI / EHSI: same flight-director data, own heading (compass 2), course 2 and NAV 2 */
  const nv2=curNav2, st2=NAVS[SYS.nav2.a], dme2=radOn('nav2')&&st2&&cbIn('DME')?F.nav(S,st2,0):null;
  const gs2=nv2.valid&&nv2.gs?nv2.gs.dev:null, loc2=nv2.valid&&nv2.src==='LOC'?nv2.dev:null;
  /* copilot displays: avionics bus no 2 only (not on the EFIS aux battery), copilot EHSI breaker, display processor */
  const onC=avOn()&&cbIn('AV BUS 2')&&cbIn('COPLT EHSI')&&cbIn('DSPL PRCSR');
  B200P.efis(P,{onA:onC,onH:onC,dim:SYS.efisDim,roll:o.roll,pitch:o.pitch,fd,fdP:o.pitch-AP.thCmd,fdR:AP.phiCmd-o.roll,
    lat:fd?latT:'',latA:fd?(AP.latArm||''):'',vert:fd?vertT:'',vertA:fd?(AP.vertArm||'').replace('ALTS','ALT').trim():'',ap:AP.on?'AP':SYS.yd?'YD':'',
    gs:gs2,loc:loc2,ra,dh,dhA:ra!=null&&!S.ground&&ra<dh,mkr:mk?MKN[mk]:'',spd:fd&&AP.vert==='FLC'?(o.ias-AP.iasRef)/10:null,slip:o.slip,
    hdg:hc2,bug:AP.hdg,crs:SYS.crs2,dev:nv2.dev,valid:!!nv2.valid,tf:nv2.toFrom,b1,b2,arc:!!SYS.efisArc,
    dist:dme2&&dme2.dist!=null&&dme2.dist<199?dme2.dist.toFixed(1):'----',et:etx,src:(st2==='LOC'?'LOC':'VOR')+'2',brg:['---','VOR1','ADF'][SYS.brgSel1],brgFail:true,flag:radOn('nav2')&&nv2.valid?'':'NAV'},'2');
}
function drawMfd(o,hc){
  const on=avOn()&&!!SYS.mfdPwr&&cbIn('MFD'), m=cbIn('RADAR')?SYS.mfdMode:0, rng=MFDR[SYS.mfdRng];
  const rel=p=>({e:(p.E-S.E)/F.NM,n:(p.N-S.N)/F.NM});
  const t1=NAVS[SYS.nav1.a]==='LOC'?{N:1800,E:0}:{N:900,E:-2600}, wp=GPSW[SYS.gpsWpt]||GPSW.RW36;
  const sE=S.E/F.NM, sN=S.N/F.NM, att=F.clamp(1-Math.abs(SYS.mfdTilt)*0.055,0.15,1);
  const wx=SYS.mfdWx?WXC.map(c=>({e:c.e-sE,n:c.n-sN,r:c.r,l:Math.min(3,c.l+(SYS.mfdGain===2?1:0)),a:att*(SYS.mfdGain===1?0.7:1)})):[];
  const lines=[], p=SYS.mfdPage, f=(k)=>SYS[k]; let cur=-1;
  if(p==='rmt') lines.push('RADIO DATA','COM 1  '+SYS.com1.a+'  /  '+SYS.com1.s,'COM 2  '+SYS.com2.a+'  /  '+SYS.com2.s,'NAV 1  '+SYS.nav1.a+'  /  '+SYS.nav1.s,'NAV 2  '+SYS.nav2.a+'  /  '+SYS.nav2.s,'ADF    '+SYS.adf.a+'  /  '+SYS.adf.s,'XPDR   '+SYS.xpdr+'  '+['OFF','SBY','ON','ALT'][SYS.xpdrMd],'DME    CH '+SYS.d1ch+' / CH '+SYS.d2ch);
  if(p==='nav'){ const g=gpsTo(SYS.gpsWpt), gsk=Math.max(1,o.gs); lines.push('NAV DATA','WPT    '+SYS.gpsWpt,'DIS    '+g.d.toFixed(1)+' NM','BRG    '+String(Math.round(g.brg)).padStart(3,'0')+'°','GS     '+Math.round(o.gs)+' KT','ETE    '+Math.floor(g.d/gsk*60)+':'+String(Math.floor(g.d/gsk*3600)%60).padStart(2,'0'),'TAS    '+Math.round(o.tas)+' KT','SAT    '+Math.round(o.oat)+' °C'); }
  if(p==='chk'){ const L=['NORMAL – BEFORE TAKEOFF','AUTOFEATHER ........... ARM','TRIM ............... SET','FLAPS ........ AS REQUIRED','PROP LEVERS ...... FULL FWD','PITOT HEAT ............ ON','TRANSPONDER ......... ALT','LIGHTS ....... AS REQUIRED']; lines.push(...L); cur=1+SYS.mfdChk%(L.length-1); }
  if(p==='emg'){ const L=['EMERGENCY – ENGINE FIRE','POWER LEVER ......... IDLE','PROP LEVER ...... FEATHER','CONDITION LEVER .. CUTOFF','FIREWALL VALVE ...... CLOSE','FIRE EXTINGUISHER .. ACTUATE','GENERATOR ........... OFF','(follow the AFM/POH)']; lines.push(...L); cur=1+SYS.mfdChk%(L.length-2); }
  B200P.mfd(P,{on,dim:SYS.mfdData,page:p,lines,cur,lk:p==='map'?['WX '+(SYS.mfdWx?'ON':'OFF'),SYS.mfdNup?'N UP':'HDG UP',['CAL','PRE','MAX'][SYS.mfdGain],'TILT 0']:['','','',''],
    mode:cbIn('RADAR')?MFDM[m]:'FAIL',nav:!!SYS.mfdNavOn,hdg:hc,nup:!!SYS.mfdNup,range:rng,tilt:(SYS.mfdTilt>=0?'+':'')+(SYS.mfdTilt/2).toFixed(1),gain:m===3?['CAL','PRE','MAX'][SYS.mfdGain]:'',
    st:[Object.assign(rel(t1),{line:true}),rel(wp),rel({N:-7600,E:0})],wx:m===3?wx:[],
    b1:radOn('nav1')?(NAVS[SYS.nav1.a]==='LOC'?'LOC ':'VOR ')+SYS.nav1.a:'',b2:gpsOk()?'GPS '+SYS.gpsWpt:''});
}
function drawGps(o){ const on=gpsOk(); if(!on){ B200P.gps(P,{on:false}); return; }
  if(SYS.gpsInitT>0){ B200P.gps(P,{on:true,l:['SELF TEST','','',''],r:['GPS','INIT','',''],pl:'',pr:''}); return; }
  const g=gpsTo(SYS.gpsWpt), gsk=Math.max(1,o.gs), ete=g.d/gsk*60;
  const L=[['DIS '+g.d.toFixed(1)+'NM','GS  '+Math.round(o.gs)+'KT','DTK '+String(Math.round(g.brg)).padStart(3,'0')+'°','ETE '+Math.floor(ete)+':'+String(Math.floor(ete*60)%60).padStart(2,'0')],['FPL 0','1 AN','2 ASN','3 RW36'],['MODE','CRS '+(SYS.gpsCrs?'OBS':'LEG'),'APR '+(SYS.gpsApr?(gpsAprActive()?'ACTV':'ARM'):'OFF'),''],['TRIP','FF '+Math.round(E[0].ff+E[1].ff)+'PPH','FUEL '+Math.round(E[0].main+E[0].aux+E[1].main+E[1].aux),'']][SYS.gpsPgL];
  const sAN=gpsTo('AN'), sASN=gpsTo('ASN');
  let R=[['RW36','BIRDBIRD','ELEV 0FT','RWY 36'],['ASN VOR','113.30','BRG '+String(Math.round(sASN.brg)).padStart(3,'0'),'DIS '+sASN.d.toFixed(1)],['AN NDB','375.0','BRG '+String(Math.round(sAN.brg)).padStart(3,'0'),'DIS '+sAN.d.toFixed(1)],['INT','----','',''],['SUPL','',''+'','']][SYS.gpsPgR];
  let Lx=L; if(SYS.gpsAltT>0) Lx=['ALT '+Math.round(o.alt)+'FT','BARO '+(S.baro/33.8639).toFixed(2),'MSA 2500FT',''];
  if(SYS.gpsMsgT>0) R=['NO','MESSAGES','',''];
  if(SYS.gpsDtoPend) R=['DIRECT TO:',SYS.gpsDtoPend,'ENT?',''];
  /* default page: moving map (route AN → ASN → RW36, magenta leg to the active waypoint); page knobs, cursors and messages show the text pages */
  const mapPg=!SYS.gpsPgL&&!SYS.gpsPgR&&!SYS.gpsCurL&&!SYS.gpsCurR&&!(SYS.gpsMsgT>0)&&!(SYS.gpsAltT>0)&&!SYS.gpsDtoPend;
  if(mapPg){ const rt=['AN','ASN','RW36'], rel=k=>({id:k,e:(GPSW[k].E-S.E)/F.NM,n:(GPSW[k].N-S.N)/F.NM}), rng=g.d>9?20:g.d>4?10:5;
    B200P.gps(P,{on:true,map:true,trk:o.hdg||0,rng,wp:rt.map(rel),act:Math.max(0,rt.indexOf(SYS.gpsWpt)),mf:[L[0].replace('NM',''),'DTK '+String(Math.round(g.brg)).padStart(3,'0'),'GS '+Math.round(o.gs),'>'+SYS.gpsWpt]}); return; }
  B200P.gps(P,{on:true,l:Lx,r:R,pl:['NAV','FPL','MODE','TRIP'][SYS.gpsPgL]+' '+(SYS.gpsCrs?'OBS':'LEG'),pr:['APT','VOR','NDB','INT','SUPL'][SYS.gpsPgR]+' >'+SYS.gpsWpt,cl:!!SYS.gpsCurL,cr:!!SYS.gpsCurR});
}
/* ---------- loop ---------- */
let holdRoll=null, holdPitch=null, last=performance.now(), slow=0, panelT=1;
function pilotInput(dt){
  const K=inp.keys, kb=KB.tick(K,dt); // W/S/A/D + arrows, ramped (flightkeys.js)
  let x=kb.x, y=kb.y, r=null, gpThr=0;
  const sv=FK.spring(inp,dt); if(inp.stick){ x=sv.x; y=sv.y; } else if(sv){ x=F.clamp(x+sv.x,-1,1); y=F.clamp(y+sv.y,-1,1); }
  const pads=navigator.getGamepads?navigator.getGamepads():[]; const gp=pads&&[...pads].find(p=>p&&p.connected);
  if(gp){ const dzf=v=>Math.abs(v)<0.08?0:v; const gx=dzf(gp.axes[0]||0), gy=dzf(gp.axes[1]||0), gr=dzf(gp.axes[2]||0); if(gx||gy){ x=gx; y=gy; } if(gr) r=gr; gpThr=(gp.buttons[7]?gp.buttons[7].value:0)-(gp.buttons[6]?gp.buttons[6].value:0); }
  if(K.has('q')) inp.rudUser=F.clamp(inp.rudUser-dt*0.8,-1,1); if(K.has('e')) inp.rudUser=F.clamp(inp.rudUser+dt*0.8,-1,1); if(r!==null) inp.rudUser=r;
  let td=0; if(K.has('+')||K.has('=')) td+=1; if(K.has('-')) td-=1; td+=gpThr;
  if(td){ ['pwrL','pwrR'].forEach(k=>{ SYS[k]=F.clamp(Math.max(0,SYS[k])+td*dt*0.4,0,1); }); }
  S.ctl.brake=(K.has('b')||inp.brakeHeld||SYS.park)?1:0;
  if(kb.trim&&SYS.elTrim) S.ctl.trim=F.clamp(S.ctl.trim+kb.trim*dt*0.25,-1,1);
  // rudder: pilot + optional assist (integrating sideslip, like a firm foot)
  let rudA=0; if(S.autotrim&&!S.ground){ const bta=S.beta||0; inp.rudI=F.clamp((inp.rudI||0)+bta*dt*3,-0.9,0.9); rudA=F.clamp(3*bta+inp.rudI-0.5*S.r,-1,1); } else inp.rudI=0;
  if(SYS.yd&&!S.ground) rudA+=F.clamp(-0.6*S.r,-0.2,0.2);
  S.ctl.rud=F.clamp(inp.rudUser+rudA,-1,1);
  if(AF.on){ if(Math.abs(x)>0.15||Math.abs(y)>0.15||kb.held){ AF.off('stick'); if(AP.on){ AP.on=false; apDiscFx(); } airUI(); } else if(AF.hands()) return; }
  if(AP.on){ if(Math.abs(x)>0.35||Math.abs(y)>0.35||Math.max(Math.abs(kb.rx),Math.abs(kb.ry))>0.35){ AP.on=false; apDiscFx(); } else return; }
  if(S.autotrim&&!S.ground&&Math.abs(x)<0.03){ const o=S.o||{}; if(holdRoll===null) holdRoll=Math.abs(o.roll)<6?0:F.clamp(o.roll,-30,30); x=F.clamp((holdRoll-(o.roll||0))*0.03-(S.p||0)*0.8,-0.4,0.4); } else holdRoll=null;
  if(S.autotrim) x=F.clamp(x,-0.8,0.8);
  S.ctl.ail=x; S.ctl.ele=y;
  if(S.autotrim&&!S.ground){ if(Math.abs(y)>0.03) holdPitch=null; else { const o=S.o; if(holdPitch===null) holdPitch=o.pitch; S.ctl.trim=F.clamp(S.ctl.trim+F.clamp(0.06*(holdPitch-o.pitch)-1.2*S.q,-0.4,0.4)*dt*3,-1,1); } } else holdPitch=null;
}
function simTick(dt){
    pilotInput(dt);
    const o0=F.readouts(S); curNav=navNow(1); curNav2=navNow(2); sysTick(dt,o0); procTick(dt); AF.tick(dt);
    const N=Math.max(1,Math.round(dt*240)), h=dt/N, rt=SYS.rudTrim*0.3, at=(SYS.ailTrim-0.5)*0.12;
    for(let i=0;i<N;i++){ const o=F.readouts(S); F.apRun(AP,S,o,curNav,h); AF.sub(o,h); S.ctl.rud+=rt; S.ctl.ail+=at; F.step(S,h); S.ctl.rud-=rt; S.ctl.ail-=at; }
    if(S.ground){ let rev=0; E.forEach((e,i)=>{ const pl=SYS['pwr'+SIDES[i]]; if(e.lit&&pl<0) rev+=pl<-0.12?2500+6500*(-pl-0.12)/0.28:1200*(-pl/0.12); }); if(rev&&S.Vg>0) S.Vg=Math.max(0,S.Vg-rev/F.AC.m*dt); }
    if(AP.msgT>0&&!AP.on&&AP.msg==='AP OFF'){ AP.msg=''; apDiscFx(); }
}
function loop(t){
  const dt=Math.max(0,Math.min(0.05,(t-last)/1000)); GOV.tick(Math.max(0,Math.min(0.25,(t-last)/1000))); last=t;
  if(!UI.paused&&!S.crash){ simTick(dt); audioTick(dt); }
  const o=F.readouts(S);
  if(lastHdg!==null&&dt>0&&!UI.paused){ const dh=F.wrap180(o.hdg-lastHdg)/dt; turnRate+=(dh-turnRate)*Math.min(1,dt*3); } lastHdg=o.hdg;
  annCompute(o); if(!UI.paused) gpwsTick(Math.max(0,Math.min(0.05,dt)),o);
  if(D3on){ if(cockpitVis) D3.frame(otwState3(),{active:!UI.paused&&!S.crash,stick:inp.stick||{x:S.ctl.ail,y:S.ctl.ele}}); } else otwTick(dt);
  if(cockpitVis){ panelT+=dt; if(panelT>GOV.panelDt){ panelT=0; B200P.sync(P,{get:ioGet}); B200P.syncYokes(P,inp.stick?inp.stick.x:S.ctl.ail,inp.stick?inp.stick.y:S.ctl.ele); draw(o); } }
  const bb=bus(); hornLevel(bb&&cbIn('STALL WARN')&&!UI.paused&&!S.crash&&((S.buffet>0.05&&!S.ground)||SYS.stallTest===-1), bb&&cbIn('GEAR WARN')&&((gearWarn()&&!(SYS.hornSilOn&&!flapHorn()))||SYS.stallTest===1)&&!UI.paused);
  slow+=dt; if(slow>0.12){ slow=0; slowUI(o); }
  requestAnimationFrame(loop);
}
let wasCrash=null;
function slowUI(o){
  if(Math.abs(rud.v/100-inp.rudUser)>0.005) rud.set(Math.round(inp.rudUser*100));
  const sEl=el('stat'); const sKey=S.crash?'Crashed':UI.paused?'Paused':S.ground?'On ground':'Flying';
  sEl.textContent=T(sKey); sEl.className='status'+(S.crash||UI.paused?'':' ok');
  if(flashT>0) flashT-=0.12; else { el('stat2').classList.remove('chg'); el('stat2').textContent=T(sKey)+' · '+Math.round(o.ias)+' KIAS · '+Math.round(o.alt)+' FT'; }
  if(S.crash!==wasCrash){ wasCrash=S.crash; if(S.crash){ pill(L(tr2('Crashed: ','Havarert: '))+S.crash+' — '+L(tr2('press Restart','trykk Start på nytt')),'bad'); pillT=8; } }
  ['L','R'].forEach((s,i)=>{ el('fail'+s).disabled=E[i].fail; });
  if(AF.on&&AF.fix&&GPSW[AF.fix]&&SYS.gpsWpt!==AF.fix) SYS.gpsWpt=AF.fix;
  if(AIRUI){ AIRUI.banner(AF.on,L(tr2('AUTO-FLY','AUTOFLY'))+' · '+L(tr2('autopilot flies, you run the checklists','autopiloten flyr, du tar sjekklistene')),AF.status); if((AIRUI.btn.getAttribute('aria-pressed')==='true')!==AF.on) airUI(); }
  const x=inp.stick?inp.stick.x:S.ctl.ail, y=inp.stick?inp.stick.y:S.ctl.ele; dot.style.left=(50+x*42)+'%'; dot.style.top=(50+y*42)+'%';
}

/* ---------- quiz (shared B200 question bank) ---------- */
const QB=(Array.isArray(window.B200Q)?window.B200Q:[]).filter(q=>q&&['power','press','fire','lim','emer','ice'].includes(q.ch)&&Array.isArray(q.a)&&Number.isInteger(q.c));
if(QB.length) quiz(el('qbox'),'b200cockpit',()=>shuffle(QB.slice()).slice(0,8).map(q=>({q:q.q,a:q.a,c:q.c,e:q.e})));

LAB.start('sim'); window.__S=S; window.__SYS=SYS; window.__E=E; window.__AP=AP; window.__PR=PR; window.__io={set:ioSet,get:ioGet}; window.__step=procStart;
if(!location.hash) requestAnimationFrame(()=>{ const c=el('cockpit'); window.scrollTo(0,c.getBoundingClientRect().top+scrollY); });
const q0=(location.search.match(/[?&]s=(\w+)/)||[])[1], qp=(location.search.match(/[?&]p=(\w+)/)||[])[1];
AIRUI=AIRPROC.ui({after:el('scenSel'),stage:PST,list:AIRPROC.list('B200',AIRCAPS),L,onPick:pickProc,onAuto:toggleAuto}); LAB.onLang(airUI);
if(qp&&AIRPROC.list('B200',AIRCAPS).some(x=>x.k===qp)) AIRK=qp;
procStart(PROCS.some(p=>p.k===q0)?q0:qp==='free'?'free':'air');
if(/[?&]af=1/.test(location.search)) toggleAuto();
window.__air={AF,sim:simTick,fast(sec){ for(let i=0;i<sec/0.05&&!S.crash;i++) simTick(0.05); return AF.rec; },pick:pickProc,auto:toggleAuto,list:()=>AIRPROC.list('B200',AIRCAPS),o:()=>F.readouts(S),cfg(g,f){ if(g!=null){ SYS.gearH=g; S.ctl.gear=g; } if(f!=null) S.ctl.flap=f; }};
requestAnimationFrame(loop);
})();
