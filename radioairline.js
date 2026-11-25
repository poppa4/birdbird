/* NORDAP – airline radio trainer: A320, two pilots, gate to gate.
   What it trains: WHEN each call is made (the trigger: a flow or checklist done, a clearance received), WHO makes it
   (PF, PM) and TO WHOM (ATC on VHF, the ground crew on interphone, the other pilot, the cabin on PA).
   You pick a seat. The lines of your seat are your calls, graded element by element; everyone else speaks their line.
   The order follows common A320 two-pilot practice in EASA ATO training material (PF talks to the ground crew and asks
   PM for each ATC request; PM talks to ATC; PF repeats the clearance and PM crosschecks). Written in NORDAP's own words.
   TRAINING DATA: NORDAP, its units, frequencies, OSVIK 1N and FJORDAIR are fictional and not for navigation.
   Operator SOPs differ: the operator's SOP always wins. */
(function(G){
'use strict';
const C=G.RADIOCORE, S=G.RADIOSCEN; if(!C||!S) return;
const tr=C.tr, W=l=>C.PHW[String(l).toLowerCase()];

/* channels: shown on the radio display, and what the line sounds like */
const CH={
  crew:{n:'Flight deck',f:'CREW'},
  int:{n:'Interphone · ground crew',f:'INT'},
  pa:{n:'Cabin PA',f:'PA'}
};
const SPK={PF:tr('PF','PF'),PM:tr('PM','PM'),GC:tr('Ground crew','Bakkemannskap')};
const VOICE={PF:'am_michael',PM:'am_michael',GC:'am_puck'};

/* element shorthands (same kinds as radioscen.js) */
const cs=()=>({k:'cs'}), stn=v=>({k:'stn',v}), rwy=v=>({k:'rwy',v:String(v)}), qnh=v=>({k:'qnh',v}), alt=v=>({k:'alt',v}), fl=v=>({k:'fl',v}),
  hdg=v=>({k:'hdg',v}), turn=v=>({k:'turn',v}), sq=v=>({k:'sq',v}), freq=(v,unit)=>({k:'freq',v,unit}), info=v=>({k:'info',v}), hp=v=>({k:'hp',v}),
  P=(en,no,re,o)=>Object.assign({k:'phr',l:tr(en,no),re},o||{});
const OPT={opt:true};

/* ---------------- the script ----------------
   line kinds: {t:'sit'} the trigger (what has just been done) · {who:'ATC',unit,text} a transmission ·
   {who:'PF'|'PM'|'GC', ch, text, els?, task?} a spoken line; with els it is gradable when it is your seat's. */
function departure(V,u){
  const c=V.c, A=V.a;
  return [
  {t:'sit',text:tr(`Stand 4 at NORDAP, ${V.type} to Stockholm Arlanda (ESSA). Cockpit preparation and FMS set-up are done. ATIS is information ${W(V.info)}, QNH ${V.qnh}.`,`Stand 4 på NORDAP, ${V.type} til Stockholm Arlanda (ESSA). Cockpit preparation og FMS-oppsett er ferdig. ATIS er information ${W(V.info)}, QNH ${V.qnh}.`)},
  {who:'PF',ch:'crew',text:'Request ATC clearance.',task:tr('Ask PM to get the ATC clearance.','Be PM hente ATC-klareringen.'),els:[P('“Request … clearance”','«Request … clearance»',/\b(request|get)\b.*\bclearance\b/)]},
  {who:'PM',unit:u.del,text:`NORDAP Delivery, ${c}, stand 4, information ${W(V.info)}, request clearance to Arlanda.`,task:tr('First call to Delivery: station, callsign, stand, ATIS letter, request.','Første kall til Delivery: stasjon, kallesignal, stand, ATIS-bokstav, ønske.'),
   els:[stn('NORDAP Delivery'),cs(),P('Stand 4','Stand 4',/\bstand 4\b/),info(V.info),P('Request clearance','Be om klarering',/\bclearance\b/)]},
  {who:'ATC',unit:u.del,text:`${A}, cleared to Arlanda, OSVIK 1N departure, climb to altitude 5000 feet, squawk ${V.sq}.`},
  {who:'PM',unit:u.del,text:`Cleared to Arlanda, OSVIK 1N departure, climb to altitude 5000 feet, squawk ${V.sq}, ${A}.`,task:tr('Read back the clearance.','Les tilbake klareringen.'),
   els:[P('Destination','Destinasjon',/\b(arlanda|stockholm|essa|e s s a)\b/),P('OSVIK 1N','OSVIK 1N',/\bosvik\b/),alt(5000),sq(V.sq),cs()]},
  {who:'PF',ch:'crew',text:`Cleared to Arlanda via OSVIK 1N, climb initially 5000 feet, squawk ${V.sq}.`,task:tr('You have set the clearance in the FCU, MCDU and transponder. Repeat it to PM so it is crosschecked.','Du har satt klareringen i FCU, MCDU og transponder. Gjenta den til PM så den blir kryssjekket.'),
   els:[P('OSVIK 1N','OSVIK 1N',/\bosvik\b/),alt(5000),sq(V.sq)]},
  {who:'PM',ch:'crew',text:'Crosschecked.',task:tr('Confirm that what PF set matches the clearance.','Bekreft at det PF satte stemmer med klareringen.'),els:[P('“Crosschecked”','«Crosschecked»',/\b(cross ?checked|crosschecked|checked)\b/)]},
  {t:'sit',text:tr('Departure briefing done. Boarding complete, doors closed, Cockpit Preparation checklist complete.','Departure briefing ferdig. Boarding ferdig, dører lukket, Cockpit Preparation-sjekkliste ferdig.')},
  {who:'PF',ch:'int',text:'Ground from flight deck, ready for pushback?',task:tr('Ask the ground crew on the interphone if they are ready.','Spør bakkemannskapet på interphone om de er klare.'),
   els:[P('Who you call: “Ground”','Hvem du kaller: «Ground»',/\bground\b/),P('“Ready for pushback?”','«Ready for pushback?»',/\bready\b/)]},
  {who:'GC',ch:'int',text:'Flight deck from ground, walk-around completed, bypass pin inserted, tow truck connected, ready for pushback.'},
  {who:'PF',ch:'int',text:'Thank you, stand by.',task:tr('You have no ATC approval yet. Ask the ground crew to wait.','Du har ikke ATC-godkjenning ennå. Be bakkemannskapet vente.'),els:[P('“Stand by”','«Stand by»',/\bstandby\b/)]},
  {who:'PF',ch:'crew',text:'Request start and push.',task:tr('Ask PM to get start-up and pushback from ATC.','Be PM hente oppstart og pushback fra ATC.'),els:[P('Start','Oppstart',/\bstart/),P('Push','Push',/\bpush/)]},
  {who:'PM',unit:u.gnd,text:`NORDAP Ground, ${c}, stand 4, request start-up and pushback.`,task:tr('Call Ground for start-up and pushback.','Kall Ground for oppstart og pushback.'),
   els:[stn('NORDAP Ground'),cs(),P('Stand 4','Stand 4',/\bstand 4\b/),P('Start-up','Oppstart',/\bstart/),P('Pushback','Pushback',/\bpush/)]},
  {who:'ATC',unit:u.gnd,text:`${A}, start-up and pushback approved, facing south.`},
  {who:'PM',unit:u.gnd,text:`Start-up and pushback approved, facing south, ${A}.`,task:tr('Read back the approval and the direction.','Les tilbake godkjenningen og retningen.'),
   els:[P('Approved (start and push)','Godkjent (oppstart og push)',/\b(approved|start|push)\b/),P('Facing south','Facing south',/\bsouth\b/),cs()]},
  {t:'sit',text:tr('Start and push approved: Before Start flow done, Before Start checklist complete.','Start og push godkjent: Before Start-flow ferdig, Before Start-sjekkliste ferdig.')},
  {who:'PF',ch:'int',text:'Ground from flight deck, cleared for pushback, parking brake is set, facing south.',task:tr('Tell the ground crew you are cleared, the state of the parking brake and the direction.','Fortell bakkemannskapet at dere er klarert, status på parkeringsbremsen og retningen.'),
   els:[P('Cleared for pushback','Klarert for pushback',/\bcleared\b.*\bpush/),P('Parking brake set','Parkeringsbrems satt',/\bparking brake\b.*\bset\b/),P('Facing south','Facing south',/\bsouth\b/)]},
  {who:'GC',ch:'int',text:'Release parking brake.'},
  {who:'PF',ch:'int',text:'Parking brake released, you may commence pushback.',task:tr('You have released the parking brake. Tell them, and let them push.','Du har sluppet parkeringsbremsen. Si det, og la dem pushe.'),
   els:[P('Parking brake released','Parkeringsbrems sluppet',/\b(released|off)\b/),P('“Commence pushback”','«Commence pushback»',/\b(commence|start|begin|go ahead)\b/,OPT)]},
  {who:'GC',ch:'int',text:'Commencing pushback, facing south.'},
  {act:'push'},
  {who:'PF',ch:'int',text:'Clear to start engines?',task:tr('Ask if it is clear to start the engines.','Spør om det er klart for å starte motorene.'),els:[P('Start','Start',/\bstart/),P('Engines','Motorer',/\bengines?\b/)]},
  {who:'GC',ch:'int',text:'Clear to start engines 2 and 1.'},
  {who:'PF',ch:'int',text:'Starting engine 2.',task:tr('Announce the first engine you start (to the ground crew and PM).','Si fra hvilken motor du starter først (til bakkemannskapet og PM).'),els:[P('Engine 2','Motor 2',/\b(engine|number|no) ?2\b|\b2\b/)]},
  {who:'GC',ch:'int',text:'Pushback completed, set parking brake.'},
  {who:'PF',ch:'int',text:'Parking brake is set.',task:tr('You have set the parking brake. Confirm it.','Du har satt parkeringsbremsen. Bekreft det.'),els:[P('Parking brake set','Parkeringsbrems satt',/\bparking brake\b.*\bset\b|\bset\b/)]},
  {t:'sit',text:tr('Engine 1 started too. Both engines AVAIL: After Start flow done, After Start checklist complete.','Motor 1 er også startet. Begge motorer AVAIL: After Start-flow ferdig, After Start-sjekkliste ferdig.')},
  {who:'PF',ch:'int',text:'Ground from flight deck, two good starts, cleared to disconnect, hand signal on the left.',task:tr('Tell the ground crew the starts were good, clear them to disconnect, and say which side you want the hand signal.','Si til bakkemannskapet at startene var gode, klarer dem til å koble fra, og si hvilken side du vil ha håndsignalet.'),
   els:[P('Good starts','Gode starter',/\b(good|normal) starts?\b|\bstarts? (good|normal)\b/),P('Cleared to disconnect','Klarert til å koble fra',/\bdisconnect/),P('Hand signal side','Side for håndsignal',/\b(left|right)\b/)]},
  {who:'GC',ch:'int',text:'Disconnecting, hand signal on the left.'},
  {t:'sit',text:tr('The ground crew shows the bypass pin and gives the hand signal on the left.','Bakkemannskapet viser bypass-pinnen og gir håndsignal på venstre side.')},
  {who:'PF',ch:'crew',text:'Clear signal received, request taxi.',task:tr('Say you have the signal, and ask PM to request taxi.','Si at du har fått signalet, og be PM be om taksing.'),els:[P('Signal received','Signal mottatt',/\bsignal\b|\breceived\b/),P('Request taxi','Be om taksing',/\btaxi\b/)]},
  {who:'PM',unit:u.gnd,text:`${A}, request taxi.`,task:tr('Ask Ground for taxi.','Be Ground om taksing.'),els:[cs(),P('Request taxi','Be om taksing',/\btaxi\b/)]},
  {who:'ATC',unit:u.gnd,text:`${A}, taxi to holding point A1 runway 36 via Alpha.`},
  {who:'PM',unit:u.gnd,text:`Taxi to holding point A1 runway 36 via Alpha, ${A}.`,task:tr('Read back the taxi clearance.','Les tilbake taksiklareringen.'),els:[hp('A1'),rwy(36),cs()]},
  {who:'PF',ch:'crew',text:'Clear left side.',task:tr('Both of you understand the clearance. Before you release the brakes: check your side.','Begge har forstått klareringen. Før du slipper bremsene: sjekk din side.'),els:[P('“Clear left side”','«Clear left side»',/\bleft\b/)]},
  {who:'PM',ch:'crew',text:'Clear right side.',task:tr('Check your side before the aircraft moves.','Sjekk din side før flyet ruller.'),els:[P('“Clear right side”','«Clear right side»',/\bright\b/)]},
  {act:'taxi'},
  {t:'sit',text:tr('Taxiing. Brake check, flight control check and Taxi flow done. The cabin-ready memo shows on the ECAM.','Takser. Bremsesjekk, flight control check og Taxi-flow ferdig. Kabin klar vises på ECAM.')},
  {who:'PM',ch:'crew',text:'Cabin is ready.',task:tr('Tell PF the cabin is ready (then the Taxi checklist).','Si til PF at kabinen er klar (så Taxi-sjekklisten).'),els:[P('Cabin ready','Kabin klar',/\bcabin\b.*\bready\b/)]},
  {act:'hold',wait:1},{act:'traffic'},
  {t:'sit',text:tr('Taxi checklist complete. Approaching A1.','Taxi-sjekkliste ferdig. Nærmer dere A1.')},
  {who:'ATC',unit:u.gnd,text:`${A}, contact Tower 118.300.`},
  {who:'PM',unit:u.gnd,text:`Tower 118.300, ${A}.`,task:tr('Read back the frequency change.','Les tilbake frekvensskiftet.'),els:[freq('118.300','Tower'),cs()]},
  {who:'PM',unit:u.twr,text:`NORDAP Tower, ${c}, holding point A1, ready for departure.`,task:tr('First call to Tower.','Første kall til Tower.'),els:[stn('NORDAP Tower'),cs(),hp('A1'),P('Ready for departure','Klar for avgang',/\bready\b/)]},
  {who:'ATC',unit:u.twr,text:`${A}, behind the landing A320 on short final, line up runway 36 and wait, behind.`},
  {who:'PM',unit:u.twr,text:`Behind the landing A320, line up runway 36 and wait, behind, ${A}.`,task:tr('Read back the conditional line-up: the condition first, the clearance, the condition again.','Les tilbake den betingede oppstillingen: betingelsen først, klareringen, så betingelsen igjen.'),
   els:[P('Condition: “behind the landing A320”','Betingelse: «behind the landing A320»',/\bbehind\b.*\b(landing|a ?320|traffic)\b/,{say:'behind the landing A320'}),P('Line up','Line up',/\b(lineup|lining up)\b/),rwy(36),P('And wait','And wait',/\bwait\b/),P('“Behind” again at the end','«Behind» igjen til slutt',/\bbehind\b.*\b(lineup|lining up)\b.*\bbehind\b/,{say:'behind'}),cs()]},
  {t:'sit',text:tr('You hold at A1 while the A320 lands in front of you.','Du venter på A1 mens A320-en lander foran deg.')},
  {act:'clear',wait:1},
  {act:'lineup',wait:1},
  {t:'sit',text:tr('Line-up flow: runway confirmed, approach path clear, TCAS TA/RA, packs off.','Line-up-flow: bane bekreftet, innflygingen klar for trafikk, TCAS TA/RA, packs av.')},
  {who:'PM',ch:'pa',text:'Cabin crew, take-off.',task:tr('Tell the cabin on the PA.','Si fra til kabinen på PA.'),els:[P('“Cabin crew”','«Cabin crew»',/\bcabin crew\b/),P('“Take-off”','«Take-off»',/\btakeoff\b/)]},
  {t:'sit',text:tr('Lined up. Line-up checklist done.','Oppstilt. Line-up-sjekkliste ferdig.')},
  {who:'PM',ch:'crew',text:'Line-up checklist complete, take-off clearance?',task:tr('Report the checklist complete and ask about the take-off clearance.','Meld sjekklisten ferdig og spør om avgangsklareringen.'),els:[P('Checklist complete','Sjekkliste ferdig',/\bcomplete/),P('Take-off clearance?','Avgangsklarering?',/\bclearance\b/)]},
  {who:'ATC',unit:u.twr,text:`${A}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared for take-off.`},
  {who:'PM',unit:u.twr,text:`Runway 36, cleared for take-off, ${A}.`,task:tr('Read back the take-off clearance.','Les tilbake avgangsklareringen.'),els:[rwy(36),P('“Cleared for take-off”','«Cleared for take-off»',/\bcleared (for )?(the )?takeoff\b/),cs()]},
  {who:'PF',ch:'crew',text:'Clearance received.',task:tr('You heard the take-off clearance. Say so.','Du hørte avgangsklareringen. Si det.'),els:[P('“Clearance received”','«Clearance received»',/\breceived\b/)]},
  {who:'PM',ch:'crew',text:'Confirmed.',task:tr('Confirm the take-off clearance.','Bekreft avgangsklareringen.'),els:[P('“Confirmed”','«Confirmed»',/\bconfirm/)]},
  {act:'takeoff',wait:1},
  {t:'sit',text:tr('Airborne on the OSVIK 1N, passing 2000 ft.','I luften på OSVIK 1N, passerer 2000 ft.')},
  {who:'ATC',unit:u.twr,text:`${A}, contact Approach ${V.app}.`},
  {who:'PM',unit:u.twr,text:`Approach ${V.app}, ${A}.`,task:tr('Read back the frequency change.','Les tilbake frekvensskiftet.'),els:[freq(V.app,'Approach'),cs()]},
  {who:'PM',unit:u.app,text:`NORDAP Approach, ${c}, OSVIK 1N, passing 2500 feet, climbing to altitude 5000 feet.`,task:tr('First call to Approach after departure: SID, passing altitude, cleared altitude.','Første kall til Approach etter avgang: SID, høyde du passerer, klarert høyde.'),
   els:[stn('NORDAP Approach'),cs(),P('OSVIK 1N','OSVIK 1N',/\bosvik\b/,OPT),P('Passing altitude','Høyde du passerer',/\bpassing\b/),alt(5000)]},
  {who:'ATC',unit:u.app,text:`${A}, identified, climb to flight level 240.`},
  {who:'PM',unit:u.app,text:`Climb to flight level 240, ${A}.`,task:tr('Read back the level.','Les tilbake nivået.'),els:[fl(240),cs()]},
  {who:'PF',ch:'crew',text:'Flight level 240 set.',task:tr('You have set FL240 on the FCU. Say it.','Du har satt FL240 på FCU. Si det.'),els:[fl(240),P('“Set”','«Set»',/\bset\b/)]},
  {who:'PM',ch:'crew',text:'Checked.',task:tr('Check the FCU and confirm.','Sjekk FCU og bekreft.'),els:[P('“Checked”','«Checked»',/\bchecked\b/)]},
  {t:'sit',text:tr(`Climbing through the transition altitude, 7000 ft.`,`Stiger gjennom overgangshøyden, 7000 ft.`)},
  {who:'PF',ch:'crew',text:'Set standard.',task:tr('Order the standard altimeter setting.','Be om standard høydemålerinnstilling.'),els:[P('“Set standard”','«Set standard»',/\b(standard|std)\b/)]},
  {who:'PM',ch:'crew',text:'Standard set and crosschecked, passing flight level 75 now.',task:tr('Set STD on both sides, crosscheck, and say the level you pass.','Sett STD på begge sider, kryssjekk, og si nivået du passerer.'),
   els:[P('Standard set','Standard satt',/\b(standard|std)\b/),P('Crosschecked','Kryssjekket',/\b(cross ?checked|crosschecked)\b/),P('Passing flight level','Passerer nivå',/\bpassing\b/)]},
  {who:'PF',ch:'crew',text:'Checked, flight level 240 blue.'}
  ];
}

function arrival(V,u){
  const c=V.c, A=V.a, L=W(V.info2), Q=V.qnh2;
  return [
  {t:'sit',text:tr('Cruise at FL360, about 30 minutes before top of descent, inbound NORDAP. You are on Vestfjell Control.','Cruise i FL360, ca. 30 minutter før top of descent, inn mot NORDAP. Dere er på Vestfjell Control.'),unit:u.ctl},
  {who:'PF',ch:'crew',text:'I have control, I have communication.',task:tr('Take the radio so PM can get the ATIS.','Ta radioen så PM kan hente ATIS.'),els:[P('Control','Kontroll',/\bcontrols?\b/),P('Communication','Kommunikasjon',/\bcommunication\b/)]},
  {who:'PM',ch:'crew',text:'You have control, you have communication.',task:tr('Hand over the radio.','Gi fra deg radioen.'),els:[P('“You have control”','«You have control»',/\byou have controls?\b|\byour controls?\b/),P('“You have communication”','«You have communication»',/\bcommunication\b/)]},
  {who:'ATC',unit:{n:'NORDAP ATIS',f:'127.130'},atis:1,text:S.atisText(V,true)},
  {who:'PM',ch:'crew',text:`ATIS ${L}: runway 36, QNH ${Q}, transition level ${V.tl}.`,task:tr('Share the ATIS with PF: letter, runway, QNH, transition level.','Del ATIS med PF: bokstav, bane, QNH, overgangsnivå.'),
   els:[{k:'letter',v:V.info2},rwy(36),qnh(Q),P('Transition level','Overgangsnivå',new RegExp('\\b'+V.tl+'\\b'))]},
  {who:'PF',ch:'crew',text:'You have control, you have communication.',task:tr('Hand both over to PM while you prepare the approach in the FMS.','Gi begge til PM mens du forbereder innflygingen i FMS.'),els:[P('“You have control”','«You have control»',/\byou have controls?\b|\byour controls?\b/),P('Communication','Kommunikasjon',/\bcommunication\b/)]},
  {who:'PM',ch:'crew',text:'I have control, I have communication.',task:tr('Take control and the radio.','Ta kontroll og radio.'),els:[P('“I have control”','«I have control»',/\b(i have|my) controls?\b/),P('Communication','Kommunikasjon',/\bcommunication\b/)]},
  {t:'sit',text:tr('PF has prepared the approach and the landing performance. Time to give PM the radio back and take control.','PF har forberedt innflyging og landingsytelse. Tid for å gi PM radioen tilbake og ta kontrollen.')},
  {who:'PF',ch:'crew',text:'I have control, you have communication.',task:tr('Take control back, give PM the radio.','Ta tilbake kontrollen, gi PM radioen.'),els:[P('“I have control”','«I have control»',/\b(i have|my) controls?\b/),P('“You have communication”','«You have communication»',/\b(you have|your) communication\b/)]},
  {who:'PM',ch:'crew',text:'You have control, I have communication.',task:tr('Confirm the split.','Bekreft fordelingen.'),els:[P('“You have control”','«You have control»',/\b(you have|your) controls?\b/),P('“I have communication”','«I have communication»',/\b(i have|my) communication\b/)]},
  {t:'sit',text:tr('Arrival briefing done. Approaching top of descent.','Arrival briefing ferdig. Nærmer dere top of descent.')},
  {who:'ATC',unit:u.ctl,text:`${A}, descend to flight level 100.`},
  {who:'PM',unit:u.ctl,text:`Descend to flight level 100, ${A}.`,task:tr('Read back the descent.','Les tilbake nedstigningen.'),els:[fl(100),cs()]},
  {who:'PF',ch:'crew',text:'Flight level 100 set.',task:tr('You have set FL100. Say it.','Du har satt FL100. Si det.'),els:[fl(100),P('“Set”','«Set»',/\bset\b/)]},
  {who:'PM',ch:'crew',text:'Checked.',task:tr('Check and confirm.','Sjekk og bekreft.'),els:[P('“Checked”','«Checked»',/\bchecked\b/)]},
  {who:'PM',ch:'pa',text:'Cabin crew, start of descent.',task:tr('Descent has started. Tell the cabin.','Nedstigningen har startet. Si fra til kabinen.'),els:[P('“Cabin crew”','«Cabin crew»',/\bcabin crew\b/),P('“Start of descent”','«Start of descent»',/\bdescent\b/)]},
  {t:'sit',text:tr('Passing FL150.','Passerer FL150.')},
  {who:'PM',ch:'pa',text:'Cabin crew, prepare for landing.',task:tr('Passing FL150: tell the cabin.','Passerer FL150: si fra til kabinen.'),els:[P('“Cabin crew”','«Cabin crew»',/\bcabin crew\b/),P('“Prepare for landing”','«Prepare for landing»',/\blanding\b/)]},
  {who:'ATC',unit:u.ctl,text:`${A}, contact NORDAP Approach ${V.app}.`},
  {who:'PM',unit:u.ctl,text:`NORDAP Approach ${V.app}, ${A}.`,task:tr('Read back the frequency change.','Les tilbake frekvensskiftet.'),els:[freq(V.app,'Approach'),cs()]},
  {who:'PM',unit:u.app,text:`NORDAP Approach, ${c}, descending flight level 100, information ${L}.`,task:tr('First call to Approach: level, ATIS letter.','Første kall til Approach: nivå, ATIS-bokstav.'),els:[stn('NORDAP Approach'),cs(),fl(100),info(V.info2)]},
  {who:'ATC',unit:u.app,text:`${A}, descend to altitude 4000 feet, QNH ${Q}, turn left heading 270.`},
  {who:'PM',unit:u.app,text:`Descend to altitude 4000 feet, QNH ${Q}, left heading 270, ${A}.`,task:tr('Read back the clearance.','Les tilbake klareringen.'),els:[alt(4000),qnh(Q),turn('left'),hdg('270'),cs()]},
  {t:'sit',text:tr(`Passing the transition level, FL${V.tl}, cleared to an altitude.`,`Passerer overgangsnivået, FL${V.tl}, klarert til en høyde.`)},
  {who:'PF',ch:'crew',text:'Set QNH.',task:tr('Order the QNH setting.','Be om QNH-innstilling.'),els:[P('“Set QNH”','«Set QNH»',/\bqnh\b/)]},
  {who:'PM',ch:'crew',text:`QNH ${Q} set and crosschecked, passing altitude 6500 feet now.`,task:tr('Set QNH on both sides, crosscheck, say the altitude you pass.','Sett QNH på begge sider, kryssjekk, si høyden du passerer.'),
   els:[qnh(Q),P('Crosschecked','Kryssjekket',/\b(cross ?checked|crosschecked)\b/),P('Passing altitude','Passerer høyde',/\bpassing\b/)]},
  {who:'PF',ch:'crew',text:'Checked, 4000 feet blue.'},
  {who:'ATC',unit:u.app,text:`${A}, turn right heading 330, cleared ILS approach runway 36, report established.`},
  {who:'PM',unit:u.app,text:`Right heading 330, cleared ILS approach runway 36, wilco, ${A}.`,task:tr('Read back the approach clearance.','Les tilbake innflygingsklareringen.'),
   els:[turn('right'),hdg('330'),P('Cleared ILS','Klarert ILS',/\bils\b/),rwy(36),P('“Wilco”','«Wilco»',/\b(wilco|will report)\b/,OPT),cs()]},
  {act:'final'},
  {t:'sit',text:tr('Localizer and glideslope captured.','Localizer og glidebane fanget.')},
  {who:'PM',unit:u.app,text:`${A}, established ILS runway 36.`,task:tr('Report established.','Meld etablert.'),els:[cs(),P('Established','Etablert',/\bestablished\b/),rwy(36)]},
  {who:'ATC',unit:u.app,text:`${A}, contact Tower 118.300.`},
  {who:'PM',unit:u.app,text:`Tower 118.300, ${A}.`,task:tr('Read back the frequency change.','Les tilbake frekvensskiftet.'),els:[freq('118.300','Tower'),cs()]},
  {who:'PM',unit:u.twr,text:`NORDAP Tower, ${c}, ILS runway 36.`,task:tr('First call to Tower.','Første kall til Tower.'),els:[stn('NORDAP Tower'),cs(),P('ILS','ILS',/\bils\b/),rwy(36)]},
  {who:'ATC',unit:u.twr,text:`${A}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared to land.`},
  {who:'PM',unit:u.twr,text:`Runway 36, cleared to land, ${A}.`,task:tr('Read back the landing clearance.','Les tilbake landingsklareringen.'),els:[rwy(36),P('“Cleared to land”','«Cleared to land»',/\bcleared (to |for )?land/),cs()]},
  {act:'land',wait:1},
  {t:'sit',text:tr('Landed. Decelerating on the runway.','Landet. Bremser ned på banen.')},
  {who:'ATC',unit:u.twr,text:`${A}, vacate via Bravo, contact Ground 121.700.`},
  {who:'PM',unit:u.twr,text:`Vacate via Bravo, Ground 121.700, ${A}.`,task:tr('Read back.','Les tilbake.'),els:[P('Via Bravo','Via Bravo',/\bb\b/),freq('121.700','Ground'),cs()]},
  {act:'vacate',wait:1},
  {t:'sit',text:tr('Runway vacated. After Landing flow running.','Banen forlatt. After Landing-flow pågår.')},
  {who:'PM',unit:u.gnd,text:`NORDAP Ground, ${c}, runway vacated via Bravo.`,task:tr('First call to Ground after landing.','Første kall til Ground etter landing.'),els:[stn('NORDAP Ground'),cs(),P('Vacated','Forlatt',/\bvacated\b/)]},
  {who:'ATC',unit:u.gnd,text:`${A}, taxi to stand 6 via Alpha.`},
  {who:'PM',unit:u.gnd,text:`Taxi to stand 6 via Alpha, ${A}.`,task:tr('Read back the taxi to the stand.','Les tilbake taksing til stand.'),els:[P('Stand 6','Stand 6',/\bstand 6\b/),P('Via Alpha','Via Alpha',/\ba\b/),cs()]},
  {act:'taxiin',wait:1},
  {t:'sit',text:tr('On stand 6, parking brake set: Parking flow and checklist. The flight is done.','På stand 6, parkeringsbrems satt: Parking-flow og -sjekkliste. Turen er ferdig.')}
  ];
}

/* ---------------- script -> session steps for one seat ---------------- */
function build(script,role){
  return function(V){
    V.type='A320'; V.cs=C.parseCallsign('FJORDAIR 412'); V.c=V.cs.full; V.a=V.cs.full;
    const u=S.UNIT(V); const lines=script(V,u); const steps=[]; let pre=[], unit=null;
    const flushAfter=()=>{ if(steps.length&&pre.length){ const last=steps[steps.length-1]; last.after=(last.after||[]).concat(pre); pre=[]; } };
    lines.forEach((ln,i)=>{
      if(ln.unit&&!ln.who) unit=ln.unit;
      if(ln.t==='sit'){ pre.push({sit:ln.text}); return; }
      if(ln.act){ pre.push({act:ln.act,wait:!!ln.wait}); return; }
      const ch= ln.unit||CH[ln.ch]||unit; if(ln.unit) unit=ln.unit;
      const mine= ln.who===role&&ln.els;
      if(!mine){
        if(ln.who==='ATC'){ pre.push({who:ln.unit.n,text:ln.text,unit:ln.unit,atc:1,atis:!!ln.atis}); }
        else pre.push({who:ln.who,label:SPK[ln.who]||{en:ln.who,no:ln.who},text:ln.text,voice:VOICE[ln.who],ch:ln.ch});
        return; }
      // the transmission you answer: the last ATC line just before, when you are on that frequency
      let atc=null, atis=false;
      const lastPre=pre[pre.length-1];
      if(ln.unit&&lastPre&&lastPre.atc&&!lastPre.atis){ atc=lastPre.text; pre.pop(); }
      const who=SPK[ln.who];
      const step={id:'a320:'+role+':'+i,ph:'airline',cat:ln.unit?(atc?'rb':'call'):'crew',unit:ch,rb:atc?1:0,atc,
        pre:pre.slice(),
        task:tr(`${who.en}${ln.unit?' → '+ln.unit.n:ln.ch==='int'?' → ground crew':ln.ch==='pa'?' → cabin (PA)':' → '+(role==='PF'?'PM':'PF')}: ${ln.task.en}`,`${who.no}${ln.unit?' → '+ln.unit.n:ln.ch==='int'?' → bakkemannskap':ln.ch==='pa'?' → kabinen (PA)':' → '+(role==='PF'?'PM':'PF')}: ${ln.task.no}`),
        els:ln.els,model:ln.text,abbrOK:true};
      if(!ln.unit) step.noAtc=1;
      steps.push(step); pre=[];
    });
    flushAfter();
    return steps;
  };
}

const BASIS_AL=['SERA.8015 (readback)','SERA Section 14 (phraseology)','ICAO Doc 4444 ch. 12'];
const mk=(k,lvl,t,d,script,role)=>({k,group:'airline',lvl,t,d,basis:BASIS_AL,full:1,role,build:build(script,role)});
const AIRLINE=[
  mk('a320dep-pm',2,tr('A320 departure: you are PM','A320 avgang: du er PM'),tr('Clearance, start and push, taxi, line-up, take-off, first call to Approach, standard. You talk to ATC; PF and the ground crew speak.','Klarering, start og push, taksing, oppstilling, avgang, første kall til Approach, standard. Du snakker med ATC; PF og bakkemannskapet snakker.'),departure,'PM'),
  mk('a320dep-pf',2,tr('A320 departure: you are PF','A320 avgang: du er PF'),tr('Order the ATC requests, talk to the ground crew on the interphone through push and start, crosscheck the clearance. PM talks to ATC.','Bestill ATC-kallene, snakk med bakkemannskapet på interphone gjennom push og start, kryssjekk klareringen. PM snakker med ATC.'),departure,'PF'),
  mk('a320arr-pm',2,tr('A320 arrival: you are PM','A320 ankomst: du er PM'),tr('Radio handover for the ATIS, descent, cabin PA, QNH, ILS, landing, taxi to the stand.','Overføring av radio for ATIS, nedstigning, kabin-PA, QNH, ILS, landing, taksing til stand.'),arrival,'PM'),
  mk('a320arr-pf',2,tr('A320 arrival: you are PF','A320 ankomst: du er PF'),tr('Hand over and take back control and radio, order QNH, confirm what you set. PM talks to ATC.','Gi fra deg og ta tilbake kontroll og radio, be om QNH, bekreft det du setter. PM snakker med ATC.'),arrival,'PF')
];
const live=(k,role,t,d,sc,mode)=>Object.assign(mk(k,2,t,d,sc||departure,role),{map:mode||'dep'});
AIRLINE.unshift(
  live('a320live-pm','PM',tr('Live airport: A320 departure as PM','Live flyplass: A320-avgang som PM'),tr('See your A320 push, taxi via Alpha, wait for landing traffic and take off as your calls are accepted.','Se A320-en din pushe, takse via Alpha, vente på landende trafikk og ta av når kallene dine godkjennes.')),
  live('a320live-pf','PF',tr('Live airport: A320 departure as PF','Live flyplass: A320-avgang som PF'),tr('The ground crew pushes you when your interphone calls are right; PM talks to ATC.','Bakkemannskapet pusher deg når interphone-kallene dine er riktige; PM snakker med ATC.')),
  live('a320livearr-pm','PM',tr('Live airport: A320 arrival as PM','Live flyplass: A320-ankomst som PM'),tr('From cruise to the stand: you appear on the ILS, land as traffic departs, vacate via Bravo and taxi to stand 6.','Fra cruise til stand: du dukker opp på ILS, lander mens trafikk tar av, forlater via Bravo og takser til stand 6.'),arrival,'arr'),
  live('a320livearr-pf','PF',tr('Live airport: A320 arrival as PF','Live flyplass: A320-ankomst som PF'),tr('Control and radio handover, QNH, and the landing on the map; PM talks to ATC.','Overføring av kontroll og radio, QNH, og landingen på kartet; PM snakker med ATC.'),arrival,'arr'));
S.SCEN.push(...AIRLINE); S.ALL.push(...AIRLINE);
S.AIRLINE={departure,arrival,build,CH};
})(typeof window!=='undefined'?window:globalThis);
