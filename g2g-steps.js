/* Birdbird – gate to gate: alle steg i en DA42-tur, fra planlegging til flyet står fortøyd.
   Stegtyper: mcq (valg), order (flow i riktig rekkefølge), check (sjekkliste, les-og-gjør), info, atis, brief, radio.
   Rekkefølgen følger en vanlig ATO-SOP for DA42-VI: flow, så sjekkliste for verifisering. */
(function(G){
'use strict';
const O=G.OPS;
/* radiopunkter: re testes mot normalisert tekst */
const I=(en,no,re,o)=>Object.assign({l:{en,no},re},o||{});
const CS={l:{en:'Your callsign',no:'Kallesignalet ditt'},cs:true};
const ST=(name)=>I('Station: '+name,'Stasjon: '+name,new RegExp(name.toLowerCase()));
const N=(en,no,v)=>{ v=String(v); const src=v.includes('.')? v.replace('.','\\.?').replace(/0+$/,m=>'('+m+')?') : v; return I(en+': '+v,no+': '+v,new RegExp('(^|[^0-9])'+src+'([^0-9]|$)')); };
const Q=v=>N('QNH','QNH',v);

function STEPS(V){
  const ifr=V.ifr, P=O.APPS[V.app], APN= P.kind==='RNP'?'RNP':P.kind==='LOC'?'LOC':'ILS';
  const appWord= P.kind==='RNP'?'RNP approach':P.kind==='LOC'?'localizer approach':'ILS approach';
  const appRe= P.kind==='RNP'?/rnp|rnav/:P.kind==='LOC'?/loc|localizer|localiser/:/ils/;
  const VRP= V.vrp==='S'?'SIERRA':'NOVEMBER';
  const s=O.speeds(V.mass), F=O.APT.freq;
  const wind=`wind ${String(V.wd).padStart(3,'0')} degrees ${V.ws} knots${V.gust?' gusting '+V.gust:''}`;
  const L=[];
  const add=(o)=>L.push(o);

  /* ================= PLANLEGGING ================= */
  add({ph:'pre',k:'mcq',pos:'office',t:{en:'Where do you start?',no:'Hvor starter du?'},
    q:{en:`You are at the club ${ifr?'90':'60'} minutes before ${ifr?'an IFR training flight':'a VFR local flight'} in the DA42. What do you do first?`,no:`Du er på klubben ${ifr?'90':'60'} minutter før ${ifr?'en IFR-treningstur':'en VFR lokaltur'} i DA42. Hva gjør du først?`},
    a:[{en:'Weather and NOTAMs for departure, route and alternate',no:'Vær og NOTAM for avgang, rute og alternativ'},{en:'The walk-around, while it is still light',no:'Walk-around, mens det fortsatt er lyst'},{en:'File the flight plan so it is in the system',no:'Send inn flyplanen så den ligger i systemet'},{en:'Fuel the aircraft to full tanks',no:'Fyll flyet med fulle tanker'}],c:0,
    why:{en:'Everything else depends on it: whether you can go at all, the alternate, the fuel, the mass and the route. Plan first, then the aircraft.',no:'Alt annet avhenger av det: om du kan dra i det hele tatt, alternativ, drivstoff, masse og rute. Planlegg først, så flyet.'}});
  add({ph:'pre',k:'order',pos:'office',t:{en:'Pre-flight preparation',no:'Forberedelse før flyging'},
    q:{en:'Put the preparation in a sensible order.',no:'Sett forberedelsene i en fornuftig rekkefølge.'},
    items:['Weather and NOTAM','Route, minima'+(ifr?' and alternate':' and reporting points'),'Mass and balance, performance','Fuel plan',ifr?'File the IFR flight plan':'File a flight plan if required','Aircraft documents and tech log','Daily inspection and walk-around'],
    why:{en:'Mass and fuel affect each other, so many pilots iterate between them. The point is that the aircraft check comes after you know the flight can be done.',no:'Masse og drivstoff påvirker hverandre, så mange piloter går frem og tilbake mellom dem. Poenget er at sjekken av flyet kommer etter at du vet at turen lar seg gjennomføre.'}});

  /* ================= FØR START ================= */
  add({ph:'bstart',k:'order',pos:'stand',t:{en:'Before start flow',no:'Before start-flow'},
    q:{en:'Do the before start flow from memory. Tap the items in order.',no:'Gjør before start-flowen fra hukommelsen. Trykk punktene i riktig rekkefølge.'},
    items:['Passenger briefing completed','Pitot cover, chocks, control lock removed','Doors closed and locked, seat belts fastened','Electric master ON','Flight controls free and correct','G1000 powered, fuel quantity and selectors checked','Gear warning and fire detection tested'],
    why:{en:'A flow moves around the cockpit in a fixed pattern so nothing is missed. Afterwards you read the checklist to verify. Flow first, then checklist.',no:'En flow går rundt i cockpiten i et fast mønster, så ingenting blir glemt. Etterpå leser du sjekklisten for å verifisere. Først flow, så sjekkliste.'}});
  add({ph:'bstart',k:'mcq',pos:'stand',t:{en:'Ready to call?',no:'Klar til å kalle opp?'},
    q:{en:'The before start checklist is done down to “Start-up clearance”. What do you need before you call Ground?',no:'Before start-sjekklisten er gjort ned til «Start-up clearance». Hva trenger du før du kaller Ground?'},
    a:[{en:'The current ATIS letter and QNH',no:'Gjeldende ATIS-bokstav og QNH'},{en:'Your IFR clearance',no:'IFR-klareringen din'},{en:'The taxi route',no:'Takseruten'},{en:'Nothing, Ground gives you everything',no:'Ingenting, Ground gir deg alt'}],c:0,
    why:{en:'Listen to the ATIS on COM 1 with the electric master on, then request start-up and say which information you have. Ground then knows you have the runway, wind and QNH.',no:'Lytt på ATIS på COM 1 med electric master på, og be så om oppstart og si hvilken informasjon du har. Da vet Ground at du har rullebane, vind og QNH.'}});
  add({ph:'bstart',k:'atis',pos:'stand',t:{en:'Listen to the ATIS',no:'Lytt på ATIS'},freq:[F.atis,'Birdbird ATIS'],text:V.atis,
    q:{en:'Write down what you need on your kneeboard. Press play to hear it, then answer.',no:'Skriv ned det du trenger på kneebrettet. Trykk spill av for å høre den, og svar så.'},
    ask:[{q:{en:'Information',no:'Informasjon'},a:V.info,opts:[V.info,V.infoNext,O.LET[(O.LET.indexOf(V.info)+2)%26]]},{q:{en:'QNH',no:'QNH'},a:String(V.qnh),opts:[String(V.qnh),String(V.qnh+2),String(V.qnh-3)]},{q:{en:'Runway',no:'Rullebane'},a:'36',opts:['36','18','03']}],
    knee:{atis:V.info,qnh:V.qnh,wind:V.wind,rwy:'36'}});
  add({ph:'bstart',k:'radio',pos:'stand',t:{en:'Request start-up',no:'Be om oppstart'},freq:[F.gnd,'Birdbird Ground'],
    task:{en:'Call Ground: who you call, who you are, where you are, the ATIS, and what you want.',no:'Kall Ground: hvem du kaller, hvem du er, hvor du er, ATIS, og hva du vil.'},
    items:[ST('Ground'),CS,I(`Where: stand ${V.stand}`,`Hvor: stand ${V.stand}`,new RegExp('stand ?'+V.stand+'|parking|apron')),I('Information '+V.info,'Informasjon '+V.info,new RegExp('information '+V.info.toLowerCase()+'|info '+V.info.toLowerCase()+'|\\b'+V.info.toLowerCase()+'\\b')),I('Request start-up','Be om oppstart',/start/)],
    model:`Birdbird Ground, LN-NAE, DA42, stand ${V.stand}, ${ifr?'IFR':'VFR local'}, information ${V.info}, request start-up.`,
    atc:`LN-NAE, Birdbird Ground, start-up approved, QNH ${V.qnh}.`});
  add({ph:'bstart',k:'radio',pos:'stand',t:{en:'Read back',no:'Les tilbake'},freq:[F.gnd,'Birdbird Ground'],rb:true,
    task:{en:'Read back the approval and the QNH, then your callsign.',no:'Les tilbake godkjenningen og QNH, så kallesignalet.'},
    items:[I('Start-up approved','Oppstart godkjent',/start/),Q(V.qnh),CS],model:`Start-up approved, QNH ${V.qnh}, LN-NAE.`,knee:{start:'✓'}});

  /* ================= START ================= */
  add({ph:'start',k:'order',pos:'stand',t:{en:'Engine start',no:'Motorstart'},
    q:{en:'Start both engines. Tap the items in order.',no:'Start begge motorene. Trykk punktene i riktig rekkefølge.'},
    items:['Position lights ON (warns people outside)','Left engine master ON','Annunciations checked, wait for GLOW to go out','Start key to START (max 10 s)','Right engine: master ON, GLOW out, START','Oil pressure and annunciations checked','Idle RPM 710 ± 30 checked'],
    why:{en:'The AE300 is a diesel: the glow plugs pre-heat first, so you wait for GLOW before cranking. Oil pressure must come up within a few seconds of start.',no:'AE300 er en diesel: glødepluggene varmer først, så du venter på at GLOW slukker før du starter. Oljetrykket må komme opp innen få sekunder etter start.'}});
  add({ph:'start',k:'mcq',pos:'stand',t:{en:'Starter limit',no:'Startergrense'},
    q:{en:'The right engine has not started after 10 seconds on the starter. What now?',no:'Høyre motor har ikke startet etter 10 sekunder på starteren. Hva nå?'},
    a:[{en:'Release the key, let the starter cool for 20 seconds, then try again',no:'Slipp nøkkelen, la starteren kjøle i 20 sekunder, og prøv igjen'},{en:'Keep cranking up to 30 seconds',no:'Fortsett å starte opp til 30 sekunder'},{en:'Advance the power lever to help it catch',no:'Gi mer gass så den tar seg'},{en:'Switch the electric master off and on again',no:'Slå electric master av og på igjen'}],c:0,
    why:{en:'Starter limitation: max 10 seconds, then 20 seconds to cool. If STARTER stays lit after the engine runs and the key is released, engine master OFF and investigate.',no:'Startergrense: maks 10 sekunder, så 20 sekunder kjøling. Hvis STARTER fortsatt lyser når motoren går og nøkkelen er sluppet: engine master OFF og undersøk.'}});
  add({ph:'start',k:'check',pos:'stand',t:{en:'After start checklist',no:'After start-sjekkliste'},
    q:{en:'Read and do. Pick the right response for each item.',no:'Les og gjør. Velg riktig respons for hvert punkt.'},
    items:[['Annunciations / engine instruments','CHECKED',['SET','ON']],['RPM 710 ± 30','CHECKED',['SET','AS REQUIRED']],['Fuel selectors (first flight of the day)','BOTH CROSSFEED',['BOTH ON','BOTH OFF']],['Avionic master','ON',['OFF','CHECKED']],['Flaps','CHECKED / AS REQUIRED',['LDG','OFF']],['Pitot heat','CHECKED / OFF',['ON','AS REQUIRED']],['Stand-by instruments','CHECKED',['OFF','SET']],['Altimeters',`SET ${V.qnh} & CROSS-CHECKED`,[`SET ${V.qnh+10} & CROSS-CHECKED`,'SET 1013']]],
    why:{en:'On the first flight of the day the crossfeed check proves each engine can feed from the other tank. Altimeters are set and cross-checked against each other and the field elevation.',no:'På dagens første tur viser crossfeed-sjekken at hver motor kan få drivstoff fra den andre tanken. Høydemålerne settes og kryssjekkes mot hverandre og flyplassens høyde.'}});
  if(ifr){
    add({ph:'start',k:'radio',pos:'stand',t:{en:'IFR clearance',no:'IFR-klarering'},freq:[F.del,'Birdbird Delivery'],
      task:{en:'Ask Delivery for your IFR clearance. Have a pen ready.',no:'Be Delivery om IFR-klareringen. Ha pennen klar.'},
      items:[ST('Delivery'),CS,I('Where or what: stand, IFR to Birdbird','Hvor eller hva: stand, IFR til Birdbird',/stand|ifr|naeroson/),I('Information '+V.info,'Informasjon '+V.info,new RegExp('information '+V.info.toLowerCase()+'|\\b'+V.info.toLowerCase()+'\\b')),I('Request clearance','Be om klarering',/clearance/)],
      model:`Birdbird Delivery, LN-NAE, stand ${V.stand}, information ${V.info}, IFR to Birdbird, request clearance.`,
      atc:`LN-NAE, cleared to Birdbird via ${O.SID.name} departure, flight planned route, climb to ${V.clrAlt.replace(' ft',' feet')}, squawk ${V.sq}.`});
    add({ph:'start',k:'radio',pos:'stand',t:{en:'Read back the clearance',no:'Les tilbake klareringen'},freq:[F.del,'Birdbird Delivery'],rb:true,
      task:{en:'Read back the whole clearance: limit, departure, altitude, squawk, callsign.',no:'Les tilbake hele klareringen: grense, avgang, høyde, squawk, kallesignal.'},
      items:[I('Clearance limit: Birdbird','Klareringsgrense: Birdbird',/naeroson|cleared/),I('Departure: '+O.SID.name,'Avgang: '+O.SID.name,/osvik/),N('Altitude','Høyde',3000),N('Squawk','Squawk',V.sq),CS],
      model:`Cleared to Birdbird via ${O.SID.name} departure, flight planned route, climb to 3000 feet, squawk ${V.sq}, LN-NAE.`,
      atc:`LN-NAE, that is correct. Contact Ground ${F.gnd} when ready to taxi.`,knee:{clr:`NAER ${O.SID.name} A030`,sq:V.sq}});
    add({ph:'start',k:'check',pos:'stand',t:{en:'G1000 setup',no:'G1000-oppsett'},
      q:{en:'Set up the avionics for the departure. Pick the right value for each item.',no:'Sett opp avionikken for avgangen. Velg riktig verdi for hvert punkt.'},
      items:[['Altitude preselect','3000 ft',['1500 ft','3200 ft']],['Heading bug','360°',['322°','180°']],['Transponder',V.sq,['7000','2000']],['Flight plan','OSVIK 1N loaded',['Direct HOLAN','ILS 36 only']],['NAV 1 (for a quick return)','IASN 110.30, identified',['ASN 113.30','Not needed']],['Approach in the FMS','ILS 36 loaded, not activated',['Activated now','Nothing loaded']]],
      why:{en:'If an engine fails after take-off you want to come straight back: having the ILS frequency set and the approach loaded saves your hands and your head when it matters.',no:'Hvis en motor stopper etter avgang vil du rett tilbake: ILS-frekvensen satt og innflygingen lastet sparer hender og hode når det gjelder.'}});
  } else {
    add({ph:'start',k:'check',pos:'stand',t:{en:'Avionics setup',no:'Avionikkoppsett'},
      q:{en:'Set up the avionics for a VFR departure.',no:'Sett opp avionikken for en VFR-avgang.'},
      items:[['Transponder','7000, ALT',['2000, STBY','7700']],['Altitude preselect','1500 ft',['3000 ft','1000 ft']],['COM 1 / COM 2',`Ground ${F.gnd} / Tower ${F.twr}`,[`Tower ${F.twr} / ATIS`,`FIS ${F.fis} / Ground`]],['Flight plan',VRP+' then training area',['Nothing','Direct OSVIK']]]});
  }

  /* ================= TAKSING ================= */
  add({ph:'taxi',k:'radio',pos:'stand',t:{en:'Request taxi',no:'Be om taksing'},freq:[F.gnd,'Birdbird Ground'],
    task:{en:'Call Ground for taxi.',no:'Kall Ground for taksing.'},
    items:[ST('Ground'),CS,I(`Stand ${V.stand}`,`Stand ${V.stand}`,new RegExp('stand ?'+V.stand+'|apron|parking')),I('Request taxi','Be om taksing',/taxi/)],
    model:`Birdbird Ground, LN-NAE, stand ${V.stand}, request taxi.`,
    atc: ifr?`LN-NAE, taxi to holding point A1 runway 36 via A, QNH ${V.qnh}.`:`LN-NAE, taxi to holding point A1 runway 36 via A, QNH ${V.qnh}. After departure leave the control zone via ${VRP}, 1500 feet or below.`});
  add({ph:'taxi',k:'radio',pos:'stand',t:{en:'Read back the taxi clearance',no:'Les tilbake taksiklareringen'},freq:[F.gnd,'Birdbird Ground'],rb:true,
    task:{en:'Read back the holding point, runway, QNH'+(ifr?'':' and the departure route')+', then your callsign.',no:'Les tilbake holdepunkt, rullebane, QNH'+(ifr?'':' og avgangsruten')+', så kallesignalet.'},
    items:[I('Holding point A1','Holdepunkt A1',/a ?1|alfa 1|alpha 1/),I('Runway 36','Rullebane 36',/36/),Q(V.qnh)].concat(ifr?[]:[I('Leave via '+VRP,'Ut via '+VRP,new RegExp(VRP.toLowerCase())),N('Not above','Ikke over',1500)]).concat([CS]),
    model: ifr?`Taxi to holding point A1 runway 36 via A, QNH ${V.qnh}, LN-NAE.`:`Taxi to holding point A1 runway 36 via A, QNH ${V.qnh}, after departure leave via ${VRP} 1500 feet or below, LN-NAE.`,
    knee:{taxi:'A1 via A'}});
  add({ph:'taxi',k:'mcq',pos:'taxi',t:{en:'Instrument check while taxiing',no:'Instrumentsjekk under taksing'},
    q:{en:'Brakes checked as you started rolling. Now you turn left onto taxiway A. What should the instruments show?',no:'Bremsene er sjekket da du begynte å rulle. Nå svinger du til venstre inn på taksebane A. Hva skal instrumentene vise?'},
    a:[{en:'Heading decreasing, turn rate to the left, ball to the right, attitude level',no:'Kurs minker, svingrate mot venstre, kula mot høyre, attityde vannrett'},{en:'Heading increasing, turn rate to the left, ball to the left',no:'Kurs øker, svingrate mot venstre, kula mot venstre'},{en:'Heading decreasing, attitude banked left',no:'Kurs minker, attityden banker mot venstre'},{en:'Nothing moves on the ground',no:'Ingenting beveger seg på bakken'}],c:0,
    why:{en:'On the ground the aircraft skids in a turn, so the ball goes to the outside. The attitude indicator must stay level: a bank shown on the ground means a problem.',no:'På bakken skrenser flyet i svingen, så kula går til utsiden. Kunstig horisont skal holde seg vannrett: viser den bank på bakken, er det noe galt.'}});

  /* ================= AVGANG ================= */
  add({ph:'dep',k:'order',pos:'hp',t:{en:'Before take-off flow',no:'Before take-off-flow'},
    q:{en:'You are at holding point A1. Do the before take-off flow in order.',no:'Du står på holdepunkt A1. Gjør before take-off-flowen i riktig rekkefølge.'},
    items:['Parking brake set','Annunciations and engine instruments in the green','Circuit breakers checked','Flaps set, trims set for take-off','Fuel selectors BOTH ON','Voter switches checked, back to AUTO','Power levers idle, ECU test completed','Departure and emergency briefing','Transponder checked'],
    why:{en:'The briefing comes after the aircraft is ready and before you call ready: everything is set, and the plan is fresh in your head when you line up.',no:'Briefingen kommer etter at flyet er klart og før du melder klar: alt er satt, og planen er fersk i hodet når du kjører inn på banen.'}});
  add({ph:'dep',k:'mcq',pos:'hp',t:{en:'When do you brief?',no:'Når briefer du?'},
    q:{en:'When is the departure briefing given?',no:'Når gis avgangsbriefingen?'},
    a:[{en:'At the holding point, after the run-up and ECU test, before calling ready',no:'På holdepunktet, etter run-up og ECU-test, før du melder klar'},{en:'Before start-up, at the stand',no:'Før oppstart, på standplassen'},{en:'Lined up on the runway, before applying power',no:'Oppstilt på rullebanen, før du gir gass'},{en:'During the climb, once the workload is down',no:'Under stigningen, når arbeidsmengden har gått ned'}],c:0,
    why:{en:'Many schools also do a short pre-brief at the stand. The real departure brief, with today’s clearance, wind and runway, comes at the holding point, right before you call ready.',no:'Mange skoler gjør også en kort pre-brief på standplassen. Den egentlige avgangsbriefingen, med dagens klarering, vind og bane, kommer på holdepunktet, rett før du melder klar.'}});
  add({ph:'dep',k:'brief',pos:'hp',kind:'dep',t:{en:'Departure briefing',no:'Avgangsbriefing'},
    q:{en:'Give the departure briefing out loud (hold the mic) or type it. It is scored on structure, today’s numbers and the threats.',no:'Gi avgangsbriefingen høyt (hold mikrofonen) eller skriv den. Den vurderes på struktur, dagens tall og truslene.'}});
  add({ph:'dep',k:'radio',pos:'hp',t:{en:'Ready for departure',no:'Klar for avgang'},freq:[F.twr,'Birdbird Tower'],
    task:{en:'Change to Tower and report ready. Mind the words.',no:'Skift til Tower og meld klar. Pass på ordene.'},
    items:[ST('Tower'),CS,I('Holding point A1','Holdepunkt A1',/a ?1|holding/),I('“Ready for departure” (never “ready for take-off”)','«Ready for departure» (aldri «ready for take-off»)',/ready( for departure)?/,{not:/take ?off/})],
    model:`Birdbird Tower, LN-NAE, holding point A1, ready for departure.`,
    atc:`LN-NAE, Birdbird Tower, line up and wait runway 36.`});
  add({ph:'dep',k:'radio',pos:'hp',t:{en:'Read back',no:'Les tilbake'},freq:[F.twr,'Birdbird Tower'],rb:true,
    task:{en:'Read back the line-up instruction.',no:'Les tilbake oppstillingen.'},
    items:[I('Line up and wait','Line up and wait',/line ?up/),I('Runway 36','Rullebane 36',/36/),CS],model:`Line up and wait runway 36, LN-NAE.`});
  add({ph:'dep',k:'check',pos:'lineup',t:{en:'Line-up checklist',no:'Line-up-sjekkliste'},
    q:{en:'Lining up. Read and do.',no:'Kjører inn på banen. Les og gjør.'},
    items:[['Lights','STROBES ON, landing light when cleared',['ALL OFF','TAXI only']],['Fuel pumps','BOTH ON',['BOTH OFF','LEFT ON']],['Backrests','UPRIGHT',['RECLINED','AS REQUIRED']],['Front canopy / windows','CLOSED & LOCKED',['POS 1','OPEN']],['Compass / heading','CHECKED: 360°, matches the runway',['SET 322°','SET 3000']],['Flight instruments','CHECKED',['OFF','SET']],['Pitot heat','ON',['OFF','CHECKED']]],
    why:{en:'Lined up: check that the heading matches the runway QFU and call “Heading/compass checked”. It catches the wrong runway and a heading system that has drifted.',no:'Oppstilt: sjekk at kursen stemmer med banens QFU og si «Heading/compass checked». Det fanger feil bane og et kurssystem som har drevet.'}});
  add({ph:'dep',k:'radio',pos:'lineup',t:{en:'Take-off clearance',no:'Avgangsklarering'},freq:[F.twr,'Birdbird Tower'],rb:true,
    atcFirst: ifr?`LN-NAE, after departure contact Birdbird Approach ${F.app}, ${wind}, runway 36, cleared for take-off.`:`LN-NAE, ${wind}, runway 36, cleared for take-off, report ${VRP}.`,
    task:{en:'Read back the take-off clearance'+(ifr?' and the frequency.':' and the report.'),no:'Les tilbake avgangsklareringen'+(ifr?' og frekvensen.':' og rapporten.')},
    items:[I('Cleared for take-off','Klarert for avgang',/cleared (for )?take ?off/),I('Runway 36','Rullebane 36',/36/)].concat(ifr?[N('Approach','Approach',F.app)]:[I('Report '+VRP+' (or wilco)','Rapportere '+VRP+' (eller wilco)',new RegExp(VRP.toLowerCase()+'|wilco'))]).concat([CS]),
    model: ifr?`Cleared for take-off runway 36, after departure ${F.app}, LN-NAE.`:`Cleared for take-off runway 36, wilco, LN-NAE.`,knee:{to:'✓'}});

  /* ================= AVGANG OG STIGNING ================= */
  add({ph:'climb',k:'order',pos:'roll',t:{en:'Take-off and callouts',no:'Avgang og callouts'},
    q:{en:'Say the take-off callouts in order.',no:'Si avgangs-callouts i riktig rekkefølge.'},
    items:['“Power set, engine instruments green”','“Airspeed alive”',`“Rotate” at ${s.vr} KIAS`,'“Positive climb, gear up” (no runway left to land on)',`Climb at Vy ${s.vy} KIAS`,ifr?'At 1500 ft: “left turn direct OSVIK”':'At 500 ft: lights and climb power',ifr?'Climb checklist above 1000 ft AAL':'Climb checklist'],
    why:{en:'Gear up when you can no longer land on the remaining runway: until then the plan for an engine failure is to put it back down.',no:'Hjul opp når du ikke lenger kan lande på resten av banen: inntil da er planen ved motorstans å sette flyet ned igjen.'}});
  add({ph:'climb',k:'mcq',pos:'climb',t:{en:'Engine failure after take-off',no:'Motorstans etter avgang'},
    q:{en:'Passing 400 ft, gear up, the left engine fails. What first?',no:'Du passerer 400 ft, hjulene er oppe, og venstre motor stopper. Hva først?'},
    a:[{en:'Power MAX, gear and flaps UP, hold 85 KIAS, then identify, verify, secure',no:'Gass MAX, hjul og klaff OPP, hold 85 KIAS, så identify, verify, secure'},{en:'Identify the failed engine and shut it down straight away',no:'Identifiser motoren som har stoppet og slå den av med en gang'},{en:'Both power levers idle and land straight ahead',no:'Begge gasshendler tomgang og land rett frem'},{en:'Call MAYDAY first, then fly the aircraft',no:'Rop MAYDAY først, og fly så flyet'}],c:0,
    why:{en:'Fly the aircraft first: directional control, speed above Vyse 85 KIAS, drag off. Only then identify, verify and secure. Aviate, navigate, communicate.',no:'Fly flyet først: retningskontroll, fart over Vyse 85 KIAS, motstand vekk. Først da identify, verify og secure. Aviate, navigate, communicate.'}});
  if(ifr){
    add({ph:'climb',k:'radio',pos:'climb',t:{en:'First call to Approach',no:'Første oppkall til Approach'},freq:[F.app,'Birdbird Approach'],
      task:{en:'Tower told you to contact Approach after departure. Make the initial call: station, callsign, passing level, cleared level, SID.',no:'Tower ba deg kontakte Approach etter avgang. Gjør første oppkall: stasjon, kallesignal, passerer høyde, klarert høyde, SID.'},
      items:[ST('Approach'),CS,I('Passing altitude','Høyden du passerer',/passing|\b1\d00\b|\b[1-2]\d{3}\b/),N('Climbing','Stiger til',3000),I('SID: OSVIK 1N','SID: OSVIK 1N',/osvik/)],
      model:`Birdbird Approach, LN-NAE, passing 1400 feet, climbing to 3000 feet, OSVIK 1N.`,
      atc:`LN-NAE, Birdbird Approach, identified. Continue OSVIK 1N, climb to 3000 feet.`});
  } else {
    add({ph:'climb',k:'radio',pos:'vrp',t:{en:`Report ${VRP}`,no:`Rapporter ${VRP}`},freq:[F.twr,'Birdbird Tower'],
      task:{en:`You are over ${VRP} at 1500 ft. Report it as instructed.`,no:`Du er over ${VRP} i 1500 ft. Rapporter som instruert.`},
      items:[ST('Tower'),CS,I(VRP,VRP,new RegExp(VRP.toLowerCase())),N('Altitude','Høyde',1500)],
      model:`Birdbird Tower, LN-NAE, ${VRP}, 1500 feet.`,
      atc:`LN-NAE, leaving the control zone, frequency change approved. Contact Vestfjell Information ${F.fis}.`});
  }
  add({ph:'climb',k:'check',pos:'climb',t:{en:'Climb checklist',no:'Climb-sjekkliste'},
    q:{en:'Above 1000 ft AAL. Read and do.',no:'Over 1000 ft AAL. Les og gjør.'},
    items:[['Landing gear','UP',['DOWN','AS REQUIRED']],['Lights','AS REQUIRED',['ALL OFF','ALL ON']],['Altimeters',`SET ${V.qnh} & CROSS-CHECKED`,['SET 1013','SET QFE']],['Flaps','UP',['APP','LDG']],['Climb power','SET 92 %',['SET 65 %','IDLE']],['Fuel pumps','BOTH OFF',['BOTH ON','LEFT OFF']]],
    why:{en:'You stay on QNH in the climb: Birdbird’s transition altitude is 7000 ft, so 1013 is only set when cleared to a flight level.',no:'Du står på QNH i stigningen: overgangshøyden på Birdbird er 7000 ft, så 1013 settes først når du klareres til et flygenivå.'}});
  add({ph:'climb',k:'mcq',pos:'climb',t:{en:'One to go',no:'One to go'},
    q:{en:`You are climbing to ${ifr?'3000':'2500'} ft. When and what do you call?`,no:`Du stiger til ${ifr?'3000':'2500'} ft. Når og hva sier du?`},
    a:[{en:`Passing ${ifr?'2000':'1500'} ft: “one to go”, and check the altitude preselect`,no:`Passerer ${ifr?'2000':'1500'} ft: «one to go», og sjekk høydevelgeren`},{en:'Levelling off: “altitude”',no:'Når du flater ut: «altitude»'},{en:'Nothing, the autopilot captures it',no:'Ingenting, autopiloten fanger høyden'},{en:'100 ft before: “approaching”',no:'100 ft før: «approaching»'}],c:0,
    why:{en:'1000 ft before the cleared altitude you say “one to go”. It is the moment to check the preselect, the QNH and that the autopilot mode is armed for capture.',no:'1000 ft før klarert høyde sier du «one to go». Det er øyeblikket for å sjekke høydevelgeren, QNH og at autopiloten er armert for å fange høyden.'}});

  /* ================= UNDERVEIS ================= */
  if(ifr){
    add({ph:'enr',k:'radio',pos:'osvik',t:{en:'Re-route and hold',no:'Omruting og holding'},freq:[F.app,'Birdbird Approach'],rb:true,
      atcFirst:`L-AE, proceed direct ALPOR, maintain 3000 feet. Hold at RONAX as published, expected approach time 35.`,
      task:{en:'Read back the route, the altitude and the hold.',no:'Les tilbake ruten, høyden og holdingen.'},
      items:[I('Direct ALPOR','Direkte ALPOR',/alpor/),N('Maintain','Hold',3000),I('Hold at RONAX','Hold ved RONAX',/ronax/),CS],
      model:`Direct ALPOR, maintain 3000 feet, hold at RONAX as published, L-AE.`,knee:{exp:APN+' 36'}});
    add({ph:'enr',k:'check',pos:'alpor',t:{en:'Cruise checklist',no:'Cruise-sjekkliste'},q:{en:'Level at 3000 ft. Read and do.',no:'Flatet ut i 3000 ft. Les og gjør.'},
      items:[['Cruise power','SET 65 %',['SET 92 %','SET 30 %']],['Engine instruments','CHECKED',['SET','OFF']],['Fuel','CHECKED: quantity and balance',['BOTH OFF','CROSSFEED']],['Alerts','CHECKED',['CLEARED','OFF']]]});
    add({ph:'enr',k:'mcq',pos:'alpor',t:{en:'Hold entry',no:'Holdinginnflyging'},
      q:{en:'From ALPOR you track 090° to RONAX. The RONAX hold is inbound 360°, right-hand turns. Which entry?',no:'Fra ALPOR flyr du 090° til RONAX. RONAX-holdingen er inbound 360°, høyresvinger. Hvilken innflyging?'},
      a:[{en:'Direct',no:'Direkte'},{en:'Parallel',no:'Parallell'},{en:'Teardrop (offset)',no:'Teardrop (offset)'}],c:0,
      why:{en:'Heading 090° is 90° to the right of the inbound course 360°, inside the 180° direct sector on the holding side. Over RONAX you turn right onto the outbound 180°.',no:'Kurs 090° er 90° til høyre for inbound-kursen 360°, innenfor den 180° store direkte-sektoren på holdingsiden. Over RONAX svinger du til høyre ut på outbound 180°.'}});
    add({ph:'enr',k:'mcq',pos:'hold',t:{en:'When do you brief the approach?',no:'Når briefer du innflygingen?'},
      q:{en:'When is the approach briefing given?',no:'Når gis innflygingsbriefingen?'},
      a:[{en:'Now, in the hold or before top of descent: after the ATIS, with the chart in front of you',no:'Nå, i holdingen eller før toppen av nedstigningen: etter ATIS, med kartet foran deg'},{en:'When you are cleared for the approach',no:'Når du blir klarert for innflygingen'},{en:'At the final approach fix',no:'Ved final approach fix'},{en:'Before start-up, at the stand',no:'Før oppstart, på standplassen'}],c:0,
      why:{en:'Brief while the workload is low. Get the ATIS first, because it decides the runway, the approach and the QNH. Use the autopilot while you brief.',no:'Brief mens arbeidsmengden er lav. Hent ATIS først, fordi den bestemmer bane, innflyging og QNH. Bruk autopiloten mens du briefer.'}});
    add({ph:'enr',k:'atis',pos:'hold',t:{en:'New ATIS',no:'Ny ATIS'},freq:[F.atis,'Birdbird ATIS (COM 2)'],text:V.atis2,
      q:{en:'Listen to the ATIS on COM 2. What has changed?',no:'Lytt på ATIS på COM 2. Hva har endret seg?'},
      ask:[{q:{en:'Information',no:'Informasjon'},a:V.infoNext,opts:[V.infoNext,V.info,O.LET[(O.LET.indexOf(V.infoNext)+1)%26]]},{q:{en:'QNH',no:'QNH'},a:String(V.qnh2),opts:[String(V.qnh2),String(V.qnh),String(V.qnh2-2)]}],
      knee:{atis:V.infoNext,qnh:V.qnh2}});
    add({ph:'enr',k:'brief',pos:'hold',kind:'app',t:{en:'Approach briefing (TSADMM)',no:'Innflygingsbriefing (TSADMM)'},
      q:{en:`Brief the ${P.name}. Use TSADMM. The chart is in the panel. It is scored on structure, the numbers and the threats.`,no:`Brief ${P.name}. Bruk TSADMM. Kartet ligger i panelet. Det vurderes på struktur, tallene og truslene.`}});
    add({ph:'enr',k:'check',pos:'hold',t:{en:'Approach checklist',no:'Approach-sjekkliste'},q:{en:'Read and do.',no:'Les og gjør.'},
      items:[['ATIS / weather information',`RECEIVED, information ${V.infoNext}`,[`RECEIVED, information ${V.info}`,'NOT REQUIRED']],['Approach brief','BRIEFED',['NOT REQUIRED','AT THE FAF']],['Engine instruments','CHECKED',['SET','OFF']],['Fuel','CHECKED',['CROSSFEED','OFF']],['Alerts','CHECKED',['CLEARED','OFF']],['QNH',`SET ${V.qnh2} & CROSS-CHECKED`,[`SET ${V.qnh} & CROSS-CHECKED`,'SET 1013']]]});
    add({ph:'enr',k:'radio',pos:'hold',t:{en:'Report information '+V.infoNext,no:'Meld informasjon '+V.infoNext},freq:[F.app,'Birdbird Approach'],
      task:{en:'Tell Approach you have the new ATIS. Short.',no:'Si til Approach at du har den nye ATIS-en. Kort.'},
      items:[ST('Approach'),CS,I('Information '+V.infoNext,'Informasjon '+V.infoNext,new RegExp('information '+V.infoNext.toLowerCase()+'|\\b'+V.infoNext.toLowerCase()+'\\b'))],
      model:`Birdbird Approach, L-AE, information ${V.infoNext}.`, atc:`L-AE, roger, QNH ${V.qnh2}.`});

    /* ================= INNFLYGING ================= */
    add({ph:'app',k:'radio',pos:'hold',t:{en:'Approach clearance',no:'Innflygingsklarering'},freq:[F.app,'Birdbird Approach'],rb:true,
      atcFirst:`L-AE, leave RONAX inbound, cleared ${appWord} runway 36, report established.`,
      task:{en:'Read back the approach clearance.',no:'Les tilbake innflygingsklareringen.'},
      items:[I('Cleared '+appWord,'Klarert '+appWord,new RegExp('cleared.*('+appRe.source+')')),I('Runway 36','Rullebane 36',/36/),I('Report established','Rapportere etablert',/(report )?establish|wilco/),CS],
      model:`Cleared ${appWord} runway 36, wilco, L-AE.`,knee:{app:APN+' 36 ✓'}});
    add({ph:'app',k:'order',pos:'faf',t:{en:'Before landing flow',no:'Before landing-flow'},
      q:{en:'Before landing flow, in order. The last three are done when established on final.',no:'Before landing-flow i rekkefølge. De tre siste gjøres når du er etablert på final.'},
      items:['Backrests upright, seat belts fastened','Brakes checked','Fuel selectors BOTH ON','Parking brake released','Fuel pumps BOTH ON','Gear warning horn checked','Yaw damper OFF','Landing considerations briefed','Final: landing gear DOWN, 3 green','Final: flaps min APP','Final: lights as required'],
      why:{en:`Gear down on final, with the speed below VLO ${O.AC.vlo.ext} KIAS: in IFR at the latest when established (by 1000 ft AGL), in VFR by 500 ft AGL.`,no:`Hjul ned på final, med farten under VLO ${O.AC.vlo.ext} KIAS: i IFR senest når du er etablert (innen 1000 ft AGL), i VFR innen 500 ft AGL.`}});
    add({ph:'app',k:'radio',pos:'faf',t:{en:'Report established',no:'Rapporter etablert'},freq:[F.app,'Birdbird Approach'],
      task:{en:'You are established on the final approach course. Report it.',no:'Du er etablert på sluttkursen. Rapporter det.'},
      items:[CS,I('Established','Etablert',/establish/),I(APN+' 36',APN+' 36',appRe)],
      model:`L-AE, established ${APN} runway 36.`,atc:`L-AE, contact Tower ${F.twr}.`});
    add({ph:'app',k:'radio',pos:'faf',t:{en:'Change to Tower',no:'Skift til Tower'},freq:[F.twr,'Birdbird Tower'],
      task:{en:'Read back the frequency, change over, and make your first call to Tower.',no:'Les tilbake frekvensen, skift, og gjør første oppkall til Tower.'},
      items:[ST('Tower'),CS,I('Established '+APN+' 36','Etablert '+APN+' 36',appRe),I('Position: range or fix','Posisjon: avstand eller fix',/mile|nm|fapso|established|final/)],
      model:`Birdbird Tower, LN-NAE, established ${APN} runway 36, 6 miles.`,atc:`L-AE, Birdbird Tower, ${wind}, runway 36, cleared to land.`});
    add({ph:'app',k:'radio',pos:'final',t:{en:'Read back the landing clearance',no:'Les tilbake landingsklareringen'},freq:[F.twr,'Birdbird Tower'],rb:true,
      task:{en:'Read back.',no:'Les tilbake.'},items:[I('Cleared to land','Klarert for landing',/cleared (to )?land/),I('Runway 36','Rullebane 36',/36/),CS],model:`Runway 36, cleared to land, L-AE.`,knee:{ldg:'✓'}});
    add({ph:'app',k:'mcq',pos:'final',t:{en:'Stable?',no:'Stabil?'},
      q:{en:'1000 ft AAL in IMC: one dot high on the glidepath, 104 KIAS against a target of 90, descending 900 ft/min, gear down, flaps APP. What do you call?',no:'1000 ft AAL i IMC: én prikk høy på glidebanen, 104 KIAS mot et mål på 90, synker 900 ft/min, hjul nede, klaff APP. Hva sier du?'},
      a:[{en:'“Unstable, going around”',no:'«Unstable, going around»'},{en:'“Stable, continuing”',no:'«Stable, continuing»'},{en:'Continue and fix the speed by 500 ft',no:'Fortsett og rett opp farten innen 500 ft'}],c:0,
      why:{en:'Speed is 14 kt above target, outside ±10 kt. One criterion missed by 1000 ft in IMC means a go-around, not a correction.',no:'Farten er 14 kt over målet, utenfor ±10 kt. Ett kriterium brutt ved 1000 ft i IMC betyr go-around, ikke korrigering.'}});
    add({ph:'app',k:'mcq',pos:'short',t:{en:'At minimums',no:'Ved minima'},
      q:{en:P.kind==='LOC'?`At MDA ${P.minima.locMda} ft you see the approach lights, but not the runway.`:`At DA ${P.minima.da} ft you see the approach lights, but not the runway.`,no:P.kind==='LOC'?`Ved MDA ${P.minima.locMda} ft ser du innflygingslysene, men ikke rullebanen.`:`Ved DA ${P.minima.da} ft ser du innflygingslysene, men ikke rullebanen.`},
      a:[{en:'Continue, but not below 100 ft above the threshold unless the runway or its lights come into view',no:'Fortsett, men ikke under 100 ft over terskelen med mindre banen eller banelysene kommer til syne'},{en:'Go around at once: only the runway counts',no:'Gå rundt med en gang: bare rullebanen teller'},{en:'Continue to land: the lights are enough',no:'Fortsett til landing: lysene er nok'}],c:0,
      why:{en:'With only the approach lights in sight you may continue below the minimum to 100 ft above the threshold. Below that you need the threshold, its lights or markings, or the touchdown zone. Check the exact wording in your operations manual.',no:'Med bare innflygingslysene i sikte kan du fortsette under minima til 100 ft over terskelen. Under det må du se terskelen, lysene eller merkingen der, eller touchdown-sonen. Sjekk nøyaktig ordlyd i operasjonsmanualen din.'}});
  } else {
    /* ================= VFR UNDERVEIS OG ANKOMST ================= */
    add({ph:'enr',k:'radio',pos:'area',t:{en:'Flight information service',no:'Flyinformasjonstjeneste'},freq:[F.fis,'Vestfjell Information'],
      task:{en:'Call Vestfjell Information for flight information service: who you call, who you are, type, where, altitude, intentions, request.',no:'Kall Vestfjell Information for flyinformasjonstjeneste: hvem du kaller, hvem du er, type, hvor, høyde, intensjon, forespørsel.'},
      items:[ST('Information'),CS,I('Type DA42','Type DA42',/da ?42|diamond/),I('Position','Posisjon',/mile|nm|north|south|naeroson|birdbird|november|sierra/),I('Altitude','Høyde',/feet|ft|\b\d{4}\b/),I('Request flight information','Be om flyinformasjon',/information service|flight information|basic service|fis/)],
      model:`Vestfjell Information, LN-NAE, DA42, 5 miles ${V.vrp==='S'?'south':'north'} of Birdbird, 2500 feet, VFR local training, request flight information service.`,
      atc:`LN-NAE, Vestfjell Information, flight information service, traffic a Cessna 172 in the training area at 3000 feet. QNH ${V.qnh2}.`});
    add({ph:'enr',k:'radio',pos:'area',t:{en:'Read back',no:'Les tilbake'},freq:[F.fis,'Vestfjell Information'],rb:true,
      task:{en:'Read back what must be read back and acknowledge the traffic.',no:'Les tilbake det som må leses tilbake og bekreft trafikken.'},
      items:[Q(V.qnh2),I('Traffic: looking out','Trafikk: ser etter',/looking|traffic|in sight|negative contact/),CS],model:`QNH ${V.qnh2}, looking out for the traffic, LN-NAE.`});
    add({ph:'enr',k:'mcq',pos:'area',t:{en:'Before air work',no:'Før luftarbeid'},
      q:{en:'You want to practise steep turns and slow flight. What first?',no:'Du vil øve bratte svinger og saktefly. Hva først?'},
      a:[{en:'At least 3000 ft AGL, clearing turns 90° left and right, engine instruments checked',no:'Minst 3000 ft AGL, utkikkssvinger 90° venstre og høyre, motorinstrumenter sjekket'},{en:'Start straight away at 2500 ft, the area is clear',no:'Start med en gang i 2500 ft, området er klart'},{en:'Tell FIS and wait for a clearance',no:'Si fra til FIS og vent på klarering'},{en:'Flaps APP and 90 KIAS',no:'Klaff APP og 90 KIAS'}],c:0,
      why:{en:'Minimum 3000 ft AGL for air work, clearing turns so you see traffic below and behind, and a quick check that both engines are green. FIS gives information, not clearances.',no:'Minst 3000 ft AGL for luftarbeid, utkikkssvinger så du ser trafikk under og bak deg, og en rask sjekk at begge motorene er grønne. FIS gir informasjon, ikke klareringer.'}});
    add({ph:'enr',k:'atis',pos:'rejoin',t:{en:'ATIS before rejoining',no:'ATIS før innkomst'},freq:[F.atis,'Birdbird ATIS (COM 2)'],text:V.atis2,
      q:{en:'Listen to the ATIS before you call Tower.',no:'Lytt på ATIS før du kaller Tower.'},
      ask:[{q:{en:'Information',no:'Informasjon'},a:V.infoNext,opts:[V.infoNext,V.info,O.LET[(O.LET.indexOf(V.infoNext)+1)%26]]},{q:{en:'QNH',no:'QNH'},a:String(V.qnh2),opts:[String(V.qnh2),String(V.qnh),String(V.qnh2+3)]}],knee:{atis:V.infoNext,qnh:V.qnh2}});
    add({ph:'enr',k:'brief',pos:'rejoin',kind:'land',t:{en:'Arrival and landing briefing',no:'Ankomst- og landingsbriefing'},
      q:{en:'Brief the arrival and landing before you call Tower.',no:'Brief ankomsten og landingen før du kaller Tower.'}});
    add({ph:'app',k:'radio',pos:'rejoin',t:{en:'Request joining',no:'Be om innkomst'},freq:[F.twr,'Birdbird Tower'],
      task:{en:'Call Tower to join: who, who you are, type, where, altitude, ATIS, request.',no:'Kall Tower for innkomst: hvem, hvem du er, type, hvor, høyde, ATIS, forespørsel.'},
      items:[ST('Tower'),CS,I('Type DA42','Type DA42',/da ?42|diamond/),I('Position','Posisjon',/mile|nm|north|south|of november|of sierra/),I('Altitude','Høyde',/feet|ft|\b\d{4}\b/),I('Information '+V.infoNext,'Informasjon '+V.infoNext,new RegExp('information '+V.infoNext.toLowerCase()+'|\\b'+V.infoNext.toLowerCase()+'\\b')),I('Request joining for landing','Be om innkomst for landing',/join|landing|enter/)],
      model:`Birdbird Tower, LN-NAE, DA42, 5 miles ${V.vrp==='S'?'south':'north'} of ${VRP}, 2000 feet, information ${V.infoNext}, request joining for landing.`,
      atc:`LN-NAE, Birdbird Tower, enter the control zone via ${VRP}, 1500 feet or below, runway 36, QNH ${V.qnh2}, report ${VRP}.`});
    add({ph:'app',k:'radio',pos:'rejoin',t:{en:'Read back',no:'Les tilbake'},freq:[F.twr,'Birdbird Tower'],rb:true,task:{en:'Read back the entry clearance.',no:'Les tilbake innkomstklareringen.'},
      items:[I('Enter via '+VRP,'Inn via '+VRP,new RegExp(VRP.toLowerCase())),N('Not above','Ikke over',1500),I('Runway 36','Rullebane 36',/36/),Q(V.qnh2),CS],
      model:`Enter the control zone via ${VRP}, 1500 feet or below, runway 36, QNH ${V.qnh2}, wilco, LN-NAE.`});
    add({ph:'app',k:'radio',pos:'vrpIn',t:{en:`Report ${VRP}`,no:`Rapporter ${VRP}`},freq:[F.twr,'Birdbird Tower'],
      task:{en:`Over ${VRP}. Report.`,no:`Over ${VRP}. Rapporter.`},items:[CS,I(VRP,VRP,new RegExp(VRP.toLowerCase()))],
      model:`LN-NAE, ${VRP}.`,atc: V.vrp==='S'?`L-AE, report final runway 36.`:`L-AE, join right base runway 36, report right base.`});
    add({ph:'app',k:'order',pos:'base',t:{en:'Before landing flow',no:'Before landing-flow'},
      q:{en:'Before landing flow, in order.',no:'Before landing-flow i rekkefølge.'},
      items:['Backrests upright, seat belts fastened','Brakes checked','Fuel selectors BOTH ON','Parking brake released','Fuel pumps BOTH ON','Gear warning horn checked','Yaw damper OFF','Landing gear DOWN, 3 green','Flaps APP, then LDG on final','Lights as required']});
    add({ph:'app',k:'radio',pos:'base',t:{en:V.vrp==='S'?'Report final':'Report right base',no:V.vrp==='S'?'Rapporter final':'Rapporter right base'},freq:[F.twr,'Birdbird Tower'],
      task:{en:'Make the report.',no:'Gjør rapporten.'},items:[CS,I(V.vrp==='S'?'Final':'Right base',V.vrp==='S'?'Final':'Right base',V.vrp==='S'?/final/:/base/),I('Runway 36','Rullebane 36',/36/)],
      model: V.vrp==='S'?`L-AE, final runway 36.`:`L-AE, right base runway 36.`,atc:`L-AE, ${wind}, runway 36, cleared to land.`});
    add({ph:'app',k:'radio',pos:'final',t:{en:'Read back the landing clearance',no:'Les tilbake landingsklareringen'},freq:[F.twr,'Birdbird Tower'],rb:true,
      task:{en:'Read back.',no:'Les tilbake.'},items:[I('Cleared to land','Klarert for landing',/cleared (to )?land/),I('Runway 36','Rullebane 36',/36/),CS],model:`Runway 36, cleared to land, L-AE.`,knee:{ldg:'✓'}});
    add({ph:'app',k:'mcq',pos:'final',t:{en:'Stable?',no:'Stabil?'},
      q:{en:`500 ft AGL in VMC: on the PAPI two white two red, ${s.vref+4} KIAS against Vref ${s.vref}, 600 ft/min, gear down, flaps LDG. What do you call?`,no:`500 ft AGL i VMC: PAPI to hvite og to røde, ${s.vref+4} KIAS mot Vref ${s.vref}, 600 ft/min, hjul nede, klaff LDG. Hva sier du?`},
      a:[{en:'“Stable, continuing”',no:'«Stable, continuing»'},{en:'“Unstable, going around”',no:'«Unstable, going around»'},{en:'Nothing, keep flying',no:'Ingenting, bare fortsett'}],c:0,
      why:{en:'On the slope, speed within ±10 kt, rate well below 1000 ft/min and configured: stable. Say it out loud anyway, it is a decision, not a habit.',no:'På glidebanen, farten innenfor ±10 kt, synk godt under 1000 ft/min og konfigurert: stabil. Si det høyt likevel, det er en beslutning, ikke en vane.'}});
  }

  /* ================= ETTER LANDING OG PARKERING ================= */
  add({ph:'park',k:'radio',pos:'vacate',t:{en:'Vacate',no:'Forlat banen'},freq:[F.twr,'Birdbird Tower'],rb:true,
    atcFirst:`L-AE, take first left, A3, and contact Ground ${F.gnd}.`,task:{en:'Read back.',no:'Les tilbake.'},
    items:[I('First left, A3','Første til venstre, A3',/a ?3|alfa 3|alpha 3/),N('Ground','Ground',F.gnd),CS],model:`First left A3, Ground ${F.gnd}, L-AE.`});
  add({ph:'park',k:'check',pos:'vacate',t:{en:'After landing (runway vacated)',no:'After landing (banen forlatt)'},
    q:{en:'Behind the holding line on A3. Flow, then verify. Pick the responses.',no:'Bak holdelinjen på A3. Flow, så verifiser. Velg responsene.'},
    items:[['Flaps','UP',['APP','AS REQUIRED']],['Pitot heat / alternate air / de-ice','OFF',['ON','AS REQUIRED']],['Fuel pumps','BOTH OFF',['BOTH ON','CROSSFEED']],['Lights','AS REQUIRED: strobes and landing light off, taxi light on',['ALL OFF','ALL ON']]],
    why:{en:'Do the after landing flow only once you are clear of the runway and stopped or taxiing slowly. Nothing is touched on the runway except what keeps you on it.',no:'Gjør after landing-flowen først når du er klar av banen og står eller taksier sakte. Ingenting røres på banen bortsett fra det som holder deg på den.'}});
  add({ph:'park',k:'radio',pos:'vacate',t:{en:'Taxi to the stand',no:'Taksing til stand'},freq:[F.gnd,'Birdbird Ground'],
    task:{en:'Call Ground for taxi to your stand.',no:'Kall Ground for taksing til standplassen.'},
    items:[ST('Ground'),CS,I('Runway vacated, A3','Banen forlatt, A3',/vacated|a ?3/),I(`Request taxi to stand ${V.stand}`,`Be om taksing til stand ${V.stand}`,/taxi|stand/)],
    model:`Birdbird Ground, LN-NAE, runway vacated via A3, request taxi to stand ${V.stand}.`,atc:`L-AE, taxi to stand ${V.stand} via A.`});
  add({ph:'park',k:'radio',pos:'taxiin',t:{en:'Read back',no:'Les tilbake'},freq:[F.gnd,'Birdbird Ground'],rb:true,task:{en:'Read back.',no:'Les tilbake.'},
    items:[I(`Stand ${V.stand}`,`Stand ${V.stand}`,new RegExp('stand ?'+V.stand)),I('Via A','Via A',/via a|alfa|alpha|\ba\b/),CS],model:`Taxi to stand ${V.stand} via A, L-AE.`});
  add({ph:'park',k:'order',pos:'stand',t:{en:'Shutdown',no:'Avslutning'},
    q:{en:'On the stand. Shut down in order.',no:'På standplassen. Slå av i riktig rekkefølge.'},
    items:['Parking brake set','Power levers both idle for 2 minutes','Avionic master OFF','Engine masters both OFF','Lights OFF','Electric master OFF','Block-on time, tech log and flight time written'],
    why:{en:'Two minutes at idle lets the temperatures settle before shutdown. Avionics off before the engines, so the avionics are not hit by voltage spikes.',no:'To minutter på tomgang lar temperaturene stabilisere seg før avslutning. Avionikk av før motorene, så avionikken ikke får spenningstopper.'}});
  add({ph:'park',k:'mcq',pos:'stand',t:{en:'The flight plan',no:'Flyplanen'},
    q:{en:ifr?'Do you need to close your IFR flight plan after landing at Birdbird?':'You filed a VFR flight plan for this trip. Do you need to close it?',no:ifr?'Må du lukke IFR-flyplanen etter landing på Birdbird?':'Du sendte inn en VFR-flyplan for turen. Må du lukke den?'},
    a: ifr?[{en:'No: at a controlled aerodrome ATC closes it when you land. At an AFIS or uncontrolled aerodrome you close it yourself.',no:'Nei: på en kontrollert flyplass lukker ATC den når du lander. På en AFIS- eller ukontrollert flyplass lukker du den selv.'},{en:'Yes, always by phone within 30 minutes',no:'Ja, alltid på telefon innen 30 minutter'},{en:'No, IFR flight plans never need closing',no:'Nei, IFR-flyplaner må aldri lukkes'}]
         :[{en:'Landing at a controlled aerodrome, Tower normally reports your arrival. Check: if in doubt, close it yourself, or search and rescue may start.',no:'Lander du på en kontrollert flyplass, melder Tower normalt ankomsten. Sjekk: er du i tvil, lukk den selv, ellers kan søk og redning starte.'},{en:'No, VFR flight plans close themselves',no:'Nei, VFR-flyplaner lukker seg selv'},{en:'Only if you landed late',no:'Bare hvis du landet sent'}],c:0,
    why:{en:'An arrival report is required for every flight plan (SERA.4020). At a controlled aerodrome the ATS unit normally makes it for you. If you are unsure, close it: a missing arrival report starts alerting.',no:'Ankomstmelding kreves for alle flyplaner (SERA.4020). På en kontrollert flyplass gjør ATS-enheten det normalt for deg. Er du usikker, lukk den: en manglende ankomstmelding starter alarmtjenesten.'}});
  add({ph:'park',k:'check',pos:'stand',t:{en:'Post-flight',no:'Etter flyging'},q:{en:'Secure the aircraft.',no:'Sikre flyet.'},
    items:[['Gust lock','INSTALLED',['REMOVED','AS REQUIRED']],['Chocks','SET',['REMOVED','NOT REQUIRED']],['Pitot cover','INSTALLED',['REMOVED','STOWED']],['Aircraft condition','CHECKED, defects in the tech log',['NOT REQUIRED','NEXT FLIGHT']]],
    why:{en:'The DA42’s parking brake is not reliable for long periods: use chocks. Write any defect in the tech log before you leave, so the next crew knows.',no:'Parkeringsbremsen på DA42 er ikke pålitelig over tid: bruk klosser. Skriv eventuelle feil i tech log før du går, så neste besetning vet.'}});
  return L;
}
const PHASES=[['pre',{en:'Plan',no:'Planlegging'}],['bstart',{en:'Before start',no:'Før start'}],['start',{en:'Start and clearance',no:'Start og klarering'}],['taxi',{en:'Taxi',no:'Taksing'}],['dep',{en:'Holding point and line-up',no:'Holdepunkt og oppstilling'}],['climb',{en:'Take-off and climb',no:'Avgang og stigning'}],['enr',{en:'En route',no:'Underveis'}],['app',{en:'Approach and landing',no:'Innflyging og landing'}],['park',{en:'After landing and parking',no:'Etter landing og parkering'}]];
G.G2G={STEPS,PHASES};
})(window);
