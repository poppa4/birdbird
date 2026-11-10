/* Birdbird – ifr.js: the IFR trainer page (ifr.html).
   Two views. The start screen: everything you can practise, grouped along the recommended path, with your progress, a
   "continue" and a "recommended next" nudge, and the builder ("Practise exactly this": exercise, area, station, course,
   hold, entry, wind, instrument, start position on a map, help level). The trainer: Understand (a short animated
   walk-through), Think first, Fly (one large instrument, the map, the controls you need, help at three levels: Guided,
   Hints, Off) and Debrief (score, the first mistake marked on the map and the timeline, the instrument at that moment).
   All geometry, the flight model, the judges and the scripted pilot live in ifrcore.js (pure, tested in tests/ifr.test.mjs).
   In Guided mode the scripted pilot is the instructor: it flies alongside you, unseen, and its next action is what the page
   tells you to do. Instruments: navgauges.js and a glass PFD drawn here. Map: navmap.js. Strings EN/NO through LAB.L.
   Training model, not for navigation. */
(function(){
'use strict';
const N=window.NAVCORE, H=window.HOLDCORE, I=window.IFRCORE, NM=window.NAVMAP, {L,el}=LAB;
const t2=(en,no)=>({en,no});
const D2R=Math.PI/180, R2D=180/Math.PI, TAU=Math.PI*2, norm=N.norm, diff=N.diff, clamp=N.clamp, d3=N.d3;
const FM='"IBM Plex Mono", ui-monospace, monospace', FB='"Public Sans", system-ui, sans-serif', FD='Archivo, "Public Sans", system-ui, sans-serif';
const COL=Object.assign({},NM.COL,{crs:'#F06BB4',crs2:'rgba(240,107,180,.55)',ideal:'#7FCBE8',trail:'rgba(255,255,255,.78)',good:'#63D9A0',mid:'#F0B440',bad:'#EF6450',
  direct:'#71CC93',parallel:'#7FCBE8',teardrop:'#F0B440',bug:'#57C7F5',adf:'#F5BC4C',tgt:'#7FE0FF'});
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const no=()=>LAB.lang==='no';
const nf1=v=>Number.isFinite(v)?v.toLocaleString(no()?'nb-NO':'en-GB',{minimumFractionDigits:1,maximumFractionDigits:1}):'–';
const mmss=t=>{ t=Math.max(0,Math.round(t)); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); };
const tx=(en,nb)=>no()?nb:en;

/* ---------- words ---------- */
const W={
  side:{R:t2('right','høyre'),L:t2('left','venstre')},
  entry:{direct:t2('direct','direkte'),parallel:t2('parallel','parallell'),teardrop:t2('teardrop','teardrop'),unclear:t2('unclear','uklar')},
  inst:{cdi:'CDI',rmi:'RMI',rbi:'RBI',hsi:'HSI',pfd:'PFD'},
  instLong:{cdi:t2('CDI: the VOR needle','CDI: VOR-nålen'),rmi:t2('RMI: needles to the stations','RMI: nåler mot stasjonene'),rbi:t2('RBI: the ADF needle, fixed card','RBI: ADF-nålen, fast skive'),hsi:t2('HSI: one picture','HSI: ett bilde'),pfd:t2('PFD: glass cockpit','PFD: glasscockpit')},
  group:{basics:t2('Basics','Grunnlag'),track:t2('Tracking','Følge kurs'),intercept:t2('Intercepts','Interception'),ndb:t2('NDB','NDB'),arc:t2('DME arcs','DME-buer'),hold:t2('Holding','Holding'),
    rev:t2('Procedure turns and reversals','Prosedyresvinger og snuprosedyrer'),app:t2('Approaches','Innflyginger'),route:t2('Departures and arrivals','Utflyging og innflygingsruter'),math:t2('Mental maths','Hoderegning'),pp:t2('Partial panel','Delvis panel')},
  groupSub:{basics:t2('Where am I? Read the instruments quickly and right.','Hvor er jeg? Les instrumentene raskt og riktig.'),track:t2('Stay on a line in wind, and know when you pass the station.','Bli på en linje i vind, og vit når du passerer stasjonen.'),
    intercept:t2('Join a course at the right angle and turn on at the right moment.','Kom inn på en kurs med riktig vinkel og sving inn i riktig øyeblikk.'),ndb:t2('Track to and from a beacon with heading plus needle.','Følg kurs til og fra et fyr med kurs pluss nål.'),
    arc:t2('Join, fly and leave a DME arc.','Inn på, fly og forlat en DME-bue.'),hold:t2('Entries, wind correction and timing, at any fix.','Innganger, vindkorreksjon og timing, ved hvilken som helst fiks.'),
    rev:t2('Turn around onto the final course inside the protected area.','Snu inn på sluttkursen innenfor det beskyttede området.'),app:t2('Down to the minimums, then the missed approach.','Ned til minima, så missed approach.'),
    route:t2('Follow an RNAV departure and arrival with altitude constraints.','Følg en RNAV-utflyging og -innflyging med høydebegrensninger.'),math:t2('The rules of thumb, quick-fire, with the method.','Tommelfingerreglene, raskt, med metoden.'),
    pp:t2('Heading indicator failed: the compass and timed turns.','Kursindikatoren svikter: kompasset og tidsstyrte svinger.')},
  level:[null,t2('Map, no wind','Kart, ingen vind'),t2('Map and wind','Kart og vind'),t2('Map hidden','Skjult kart'),t2('Hidden map, gusty hidden wind','Skjult kart, skjult byget vind')],
  area:{practice:t2('Practice area','Øvingsområde'),bergen:t2('Bergen','Bergen'),oslo:t2('Oslo','Oslo')},
  help:{guided:t2('Guided','Veiledet'),hints:t2('Hints','Hint'),off:t2('Off','Av')},
  helpSub:{guided:t2('The next action, a target on the instrument, the path on the map and a pause before each key moment.','Neste handling, et mål på instrumentet, banen på kartet og en pause før hvert viktig øyeblikk.'),
    hints:t2('Help only when you ask for it: press Hint or H. Each press says a little more.','Hjelp bare når du ber om det: trykk Hint eller H. Hvert trykk sier litt mer.'),
    off:t2('Fly alone. “Why?” still explains what the step is about.','Fly alene. «Hvorfor?» forklarer fortsatt hva steget handler om.')},
  diff:[null,t2('Easy','Lett'),t2('Medium','Middels'),t2('Hard','Krevende')]
};
const sideW=s=>L(W.side[s]||W.side.R), dirW=d=>sideW(d>0||d==='R'?'R':'L');
const SCAN={cdi:t2('Needle, then the heading below','Nålen, så kursen under'),rmi:t2('Needle head to the station, tail is your radial','Nålhodet mot stasjonen, halen er radialen'),
  rbi:t2('Heading + needle = bearing to the beacon','Kurs + nål = peiling til fyret'),hsi:t2('The course bar against the aircraft','Kursstreken mot flyet'),pfd:t2('Attitude in the centre, navigation below','Attityde i midten, navigasjon under')};

/* ---------- the catalogue: name and one plain sentence per item ---------- */
const IT={
 orient:{n:t2('Which radial am I on?','Hvilken radial er jeg på?'),s:t2('Centre the needle with FROM and read your radial off the CDI.','Sentrer nålen med FROM og les radialen din på CDI-en.')},
 orientRmi:{n:t2('RMI: radial from the tail','RMI: radialen fra halen'),s:t2('The tail of the RMI needle is your radial. Read it in seconds.','Halen på RMI-nålen er radialen din. Les den på sekunder.')},
 orientRbi:{n:t2('RBI: bearing to the beacon','RBI: peiling til fyret'),s:t2('Heading plus needle is the bearing to the NDB. Add it up fast.','Kurs pluss nål er peilingen til NDB-en. Regn det ut raskt.')},
 orientDrill:{n:t2('Ten-position drill','Drill med ti posisjoner'),s:t2('Ten positions against the clock on the HSI. Speed and no reciprocals.','Ti posisjoner mot klokka på HSI. Fart og ingen motsatte radialer.')},
 trackIn:{n:t2('Track to the station','Følg kurs inn til stasjonen'),s:t2('Set the course, find the heading that holds the needle in wind.','Still inn kursen, finn kursen som holder nålen i vind.')},
 trackOut:{n:t2('Track away from the station','Følg radial ut fra stasjonen'),s:t2('The same rule outbound: set the radial you fly, bracket the wind.','Samme regel ut: still inn radialen du flyr, og finn vinden.')},
 pass:{n:t2('Station passage','Stasjonspassering'),s:t2('Recognise the moment you pass the VOR: the flag flips.','Kjenn igjen øyeblikket du passerer VOR-en: flagget skifter.')},
 tts:{n:t2('Time to the station','Tid til stasjonen'),s:t2('Wingtip method: time a 10° bearing change and work out the minutes.','Vingetippmetoden: ta tiden på 10° peilingsendring og regn ut minuttene.')},
 intIn:{n:t2('Intercept a course inbound','Fang en kurs inn'),s:t2('Point 30° to 45° across the course, turn on as the needle moves.','Pek 30° til 45° inn mot kursen, sving inn når nålen beveger seg.')},
 intOut:{n:t2('Intercept a radial outbound','Fang en radial ut'),s:t2('Close to the station the needle moves fast: lead the turn.','Nær stasjonen beveger nålen seg fort: start svingen tidlig.')},
 int90:{n:t2('Intercept at 90°','Interception på 90°'),s:t2('A steep intercept needs a big lead: start the turn a turn radius early.','En bratt interception trenger stor ledning: start svingen én svingradius før.')},
 intPass:{n:t2('New radial after the station','Ny radial etter stasjonen'),s:t2('Hold the heading through the station, then intercept the new radial.','Hold kursen gjennom stasjonen, og fang så den nye radialen.')},
 intNdbIn:{n:t2('Intercept a QDM (NDB)','Fang en QDM (NDB)'),s:t2('Intercept a bearing to the beacon with the RMI.','Fang en peiling til fyret med RMI-en.')},
 intNdbOut:{n:t2('Intercept a QDR (NDB)','Fang en QDR (NDB)'),s:t2('Intercept a bearing from the beacon on the fixed-card RBI.','Fang en peiling fra fyret på RBI med fast skive.')},
 locInt:{n:t2('Intercept the localiser','Fang localiseren'),s:t2('Four times as sensitive as a VOR: turn on as soon as it comes alive.','Fire ganger så følsom som en VOR: sving inn så snart den blir levende.')},
 ndb:{n:t2('NDB inbound: homing or tracking','NDB inn: homing eller tracking'),s:t2('Hold a heading into the wind with the needle off the nose.','Hold en kurs opp mot vinden med nålen litt fra nesen.')},
 ndbOut:{n:t2('NDB outbound (QDR)','NDB ut (QDR)'),s:t2('Track away from a beacon: the needle tail tells you the side.','Følg kurs ut fra et fyr: halen på nålen viser siden.')},
 dmeJoin:{n:t2('Join a DME arc','Inn på en DME-bue'),s:t2('From a radial onto the arc: start the 90° turn one turn radius early.','Fra en radial inn på buen: start svingen på 90° én svingradius før.')},
 dme:{n:t2('Fly a DME arc','Fly en DME-bue'),s:t2('Radial, arc, radial: the whole manoeuvre in wind.','Radial, bue, radial: hele manøveren i vind.')},
 dmeLeave:{n:t2('Leave an arc for a radial','Fra buen inn på en radial'),s:t2('Use a lead radial so you roll out on the course.','Bruk en ledende radial så du ruller ut på kursen.')},
 holdEntry:{n:t2('Holding entry','Inngang til holding'),s:t2('Direct, parallel or teardrop: your heading at the fix decides.','Direkte, parallell eller teardrop: kursen over fiksen bestemmer.')},
 hold:{n:t2('Holding pattern','Holdingmønster'),s:t2('Triple the drift outbound and fix the timing lap by lap.','Tredobbel avdriften ut og juster tiden runde for runde.')},
 holdLeft:{n:t2('Left-hand hold','Holding med venstresvinger'),s:t2('Non-standard turns: every turn goes left, the sectors flip.','Ikke-standard svinger: alle svinger går til venstre, sektorene speiles.')},
 holdNdb:{n:t2('Hold at an NDB','Holding ved en NDB'),s:t2('Enter and fly a hold on a beacon with the RMI.','Gå inn i og fly en holding ved et fyr med RMI-en.')},
 holdDme:{n:t2('Hold at a DME fix','Holding ved en DME-fiks'),s:t2('A fix in the air: a radial and a distance.','En fiks i lufta: en radial og en avstand.')},
 holdDmeLim:{n:t2('DME-limited hold','DME-begrenset holding'),s:t2('Turn inbound at the DME limit, not by the clock.','Sving inn ved DME-grensen, ikke etter klokka.')},
 pt:{n:t2('Procedure turn 45°/180°','Prosedyresving 45°/180°'),s:t2('Out, 45° away for a minute, then 180° the other way.','Ut, 45° vekk i ett minutt, så 180° den andre veien.')},
 pt80:{n:t2('Procedure turn 80°/260°','Prosedyresving 80°/260°'),s:t2('80° to the chart side, then straight into 260° the other way.','80° mot siden på kartet, så rett inn i 260° den andre veien.')},
 base:{n:t2('Base turn','Base turn'),s:t2('Out on an offset leg, then one big turn onto final.','Ut på et forskjøvet legg, så én stor sving inn på finalen.')},
 racetrack:{n:t2('Racetrack procedure','Racetrack-prosedyre'),s:t2('Enter like a hold, fly one lap, and you are inbound on final.','Gå inn som i en holding, fly én runde, og du er inne på finalen.')},
 vorApp:{n:t2('VOR approach','VOR-innflyging'),s:t2('No DME: the locator marks the FAF, then descend by time.','Ingen DME: lokatoren markerer FAF, sink så etter tid.')},
 vordme:{n:t2('VOR/DME approach','VOR/DME-innflyging'),s:t2('Descend on the profile and check the table every mile.','Sink på profilen og sjekk tabellen hver mil.')},
 ndbApp:{n:t2('NDB approach','NDB-innflyging'),s:t2('Track the QDM, cross the beacon, track the QDR down to the MDA.','Følg QDM-en, passer fyret, følg QDR-en ned til MDA.')},
 locApp:{n:t2('Localiser approach','Localiser-innflyging'),s:t2('ILS lateral precision, no glide slope: descend on the table.','ILS-presisjon sideveis, ingen glidebane: sink etter tabellen.')},
 ils:{n:t2('ILS approach','ILS-innflyging'),s:t2('Localiser and glide slope to the DA, then the missed approach.','Localiser og glidebane til DA, så missed approach.')},
 lnav:{n:t2('RNP approach (LNAV)','RNP-innflyging (LNAV)'),s:t2('GPS lateral guidance, an MDA and a descent table.','GPS-veiledning sideveis, en MDA og en nedstigningstabell.')},
 lnavVnav:{n:t2('RNP approach (LNAV/VNAV)','RNP-innflyging (LNAV/VNAV)'),s:t2('A baro-VNAV glide path down to a DA.','En baro-VNAV-glidebane ned til en DA.')},
 lpv:{n:t2('RNP approach (LPV)','RNP-innflyging (LPV)'),s:t2('ILS-like needles from satellites, down to 200 ft.','ILS-lignende nåler fra satellitter, ned til 200 ft.')},
 sid:{n:t2('Departure (SID)','Utflyging (SID)'),s:t2('Climb out on RNAV legs and meet the “at or above” constraints.','Stig ut på RNAV-legg og møt «i eller over»-kravene.')},
 star:{n:t2('Arrival (STAR)','Innflygingsrute (STAR)'),s:t2('Follow the arrival and plan the descent to meet each altitude.','Følg ruten og planlegg nedstigningen så du møter hver høyde.')},
 math:{n:t2('Quick-fire maths: everything','Hoderegning: alt'),s:t2('Intercepts, wind, 1 in 60, time to station, descents, leads.','Interception, vind, 1 av 60, tid til stasjon, nedstigning, ledning.')},
 mathNav:{n:t2('Quick-fire maths: navigation','Hoderegning: navigasjon'),s:t2('Intercept headings, drift, 1 in 60, time to station, lead radials.','Interceptkurser, avdrift, 1 av 60, tid til stasjon, ledende radialer.')},
 mathApp:{n:t2('Quick-fire maths: descents','Hoderegning: nedstigning'),s:t2('Rate of descent on 3° and where to start down.','Sinkrate på 3° og hvor du starter ned.')},
 ppTrack:{n:t2('Partial panel: track inbound','Delvis panel: følg kurs inn'),s:t2('No heading indicator: steer with timed turns and the compass.','Ingen kursindikator: styr med tidsstyrte svinger og kompasset.')},
 ppNdb:{n:t2('Partial panel: NDB','Delvis panel: NDB'),s:t2('The RBI and the compass only: bearing = compass + needle.','Bare RBI og kompass: peiling = kompass + nål.')},
 ppHold:{n:t2('Partial panel: holding','Delvis panel: holding'),s:t2('Fly the hold on timed rate-one turns: 3° a second.','Fly holdingen på tidsstyrte standardsvinger: 3° i sekundet.')}
};
const itemName=id=>L((IT[id]||IT.trackIn).n);

/* ---------- Understand: a short animated walk-through per exercise ----------
   Each step: one sentence, a part of the instructor's path to animate (fractions of the run, or the judge's phases) and what
   to draw. The last step is always "Your turn": drag the aircraft and watch the instrument. Plain words first, the term second. */
const U=(s,seg,show)=>({s,seg,show});
const UW={
 orient:[U(t2('A VOR sends 360 lines, like the spokes of a wheel: they are the radials.','En VOR sender 360 linjer, som eikene i et hjul: det er radialene.'),[0,0.02],'radials'),
   U(t2('Your radial depends only on where you are, never on where the nose points.','Radialen din avhenger bare av hvor du er, aldri av hvor nesen peker.'),[0,0.3],'radials'),
   U(t2('Turn the course knob until the needle centres with FROM: the number at the top is your radial. On the RMI it is the tail of the needle.','Vri kursknappen til nålen står midt med FROM: tallet øverst er radialen din. På RMI er det halen av nålen.'),[0.3,0.6],'radials')],
 orientRbi:[U(t2('The ADF needle points at the beacon, measured from the nose: the relative bearing.','ADF-nålen peker mot fyret, målt fra nesen: den relative peilingen.'),[0,0.02],'brg'),
   U(t2('Add it to your heading: heading + needle = the bearing to the beacon (QDM).','Legg den til kursen: kurs + nål = peilingen til fyret (QDM).'),[0,0.3],'brg'),
   U(t2('More than 360? Take 360 away. That is the answer you report.','Mer enn 360? Trekk fra 360. Det er svaret du rapporterer.'),[0.3,0.6],'brg')],
 trackIn:[U(t2('Set the course you want to fly. Flying to the station the flag shows TO.','Still inn kursen du vil fly. Når du flyr mot stasjonen, viser flagget TO.'),[0,0.25],'wedge'),
   U(t2('Needle right means the course is to your right: turn towards the needle.','Nål til høyre betyr at kursen ligger til høyre: sving mot nålen.'),[0.15,0.55],'wedge'),
   U(t2('Then find the heading that keeps the needle still. The difference from the course is your wind correction (bracketing).','Finn så kursen som holder nålen i ro. Forskjellen fra kursen er vindkorreksjonen din (bracketing).'),[0.55,1],'wedge')],
 trackOut:[U(t2('Outbound, set the radial you fly. The flag shows FROM and the needle still points to the course.','Ut fra stasjonen still inn radialen du flyr. Flagget viser FROM, og nålen peker fortsatt mot kursen.'),[0,0.3],'wedge'),
   U(t2('Wind shows up as a slow drift of the needle. Correct 10°, watch, then halve it.','Vind viser seg som en langsom avdrift av nålen. Korriger 10°, se, og halver så.'),[0.3,0.7],'wedge'),
   U(t2('When the needle stands still, the heading you hold is the answer.','Når nålen står i ro, er kursen du holder svaret.'),[0.7,1],'wedge')],
 pass:[U(t2('Close to the station the needle gets lively: hold your heading, do not chase it.','Nær stasjonen blir nålen urolig: hold kursen, ikke jag den.'),[0.55,0.85],'wedge'),
   U(t2('Right over the station the flag flips from TO to FROM: that is station passage.','Rett over stasjonen skifter flagget fra TO til FROM: det er stasjonspassering.'),[0.85,0.97],'wedge'),
   U(t2('Press “Station passage” when you see the flip, and start the clock if the procedure needs it.','Trykk «Stasjonspassering» når du ser skiftet, og start klokken hvis prosedyren krever det.'),[0.9,1],'wedge')],
 tts:[U(t2('Turn so the station sits on your wingtip: 90° to the bearing.','Sving så stasjonen står på vingetippen: 90° på peilingen.'),[0,0.05],'brg'),
   U(t2('Start the stopwatch and fly straight. The needle tail slides back.','Start stoppeklokken og fly rett frem. Halen på nålen glir bakover.'),[0,0.6],'brg'),
   U(t2('Time to the station in minutes = seconds ÷ degrees of change. 90 s for 10° is 9 minutes.','Tid til stasjonen i minutter = sekunder ÷ grader endring. 90 s for 10° er 9 minutter.'),[0.6,1],'brg')],
 intIn:[U(t2('The needle tells you which side the course is on.','Nålen forteller hvilken side kursen ligger på.'),[0,0.15],'arrows'),
   U(t2('Point 30° to 45° across the course, towards the needle: the intercept heading.','Pek 30° til 45° inn mot kursen, mot nålen: interceptkursen.'),[0.1,0.5],'arrows'),
   U(t2('When the needle comes off the side, start the turn: lead the turn and you roll out on the course.','Når nålen slipper fra siden, start svingen: led svingen, så ruller du ut på kursen.'),[0.5,1],'wedge')],
 intOut:[U(t2('Close to the station one degree is only a few hundred metres.','Nær stasjonen er én grad bare noen hundre meter.'),[0,0.2],'wedge'),
   U(t2('Set the radial, check FROM, and point 45° towards the needle.','Still inn radialen, sjekk FROM, og pek 45° mot nålen.'),[0.1,0.5],'arrows'),
   U(t2('The needle comes off the stop quickly here: turn on as soon as it moves.','Nålen slipper fort fra stoppen her: sving inn så snart den beveger seg.'),[0.5,1],'wedge')],
 intPass:[U(t2('Fly to the station on your course and hold the heading through the confusion over it.','Fly til stasjonen på kursen din og hold kursen gjennom uroen over den.'),[0,0.35],'wedge'),
   U(t2('After the flag flips to FROM, set the new radial.','Etter at flagget skifter til FROM, still inn den nye radialen.'),[0.3,0.5],'wedge'),
   U(t2('Then intercept it outbound: 45° towards the needle and an early turn on.','Fang den så ut: 45° mot nålen og en tidlig sving inn.'),[0.5,1],'wedge')],
 locInt:[U(t2('You fly a heading towards the localiser. Its needle sits on the stop for a long time.','Du flyr en kurs mot localiseren. Nålen står lenge på stoppen.'),[0,0.4],'loc'),
   U(t2('Full scale is only about 2.5°: when the needle moves, it moves fast.','Fullt utslag er bare rundt 2,5°: når nålen beveger seg, går det fort.'),[0.35,0.65],'loc'),
   U(t2('Turn onto the course as soon as it comes alive, then make 2° corrections.','Sving inn på kursen så snart den blir levende, og korriger så med 2°.'),[0.6,1],'loc')],
 ndb:[U(t2('The ADF needle always points at the beacon.','ADF-nålen peker alltid mot fyret.'),[0,0.2],'homing'),
   U(t2('Keep it on the nose in a crosswind and the wind bends your path: that is homing.','Holder du den på nesen i sidevind, bøyer vinden banen din: det er homing.'),[0,0.4],'homing'),
   U(t2('To track, turn into the wind until the needle sits a few degrees off the nose on the downwind side.','For å tracke svinger du opp mot vinden til nålen står noen grader fra nesen på lesiden.'),[0.4,1],'homing')],
 ndbOut:[U(t2('Outbound, the needle points behind you: read its tail.','Ut fra fyret peker nålen bak deg: les halen.'),[0,0.3],'wedge'),
   U(t2('Heading + needle − 180 is the bearing from the beacon (QDR).','Kurs + nål − 180 er peilingen fra fyret (QDR).'),[0.3,0.6],'wedge'),
   U(t2('Tail right of the tail position you want? You are left of track: turn right.','Halen til høyre for der du vil ha den? Du er til venstre for sporet: sving til høyre.'),[0.6,1],'wedge')],
 dme:[U(t2('Fly out on the radial. One turn radius before the arc, start a 90° turn.','Fly ut på radialen. Én svingradius før buen starter du en sving på 90°.'),[0,0.3],'arc'),
   U(t2('On the arc the station stays on your wingtip. Flying straight, the DME grows: turn about 10° towards the station.','På buen står stasjonen på vingetippen. Flyr du rett frem, øker DME-en: sving rundt 10° mot stasjonen.'),[0.3,0.7],'arc'),
   U(t2('Leave the arc at a lead radial a few degrees before the one you want.','Forlat buen på en ledende radial noen grader før den du skal ha.'),[0.7,1],'arc')],
 dmeJoin:[U(t2('Fly out on the radial and watch the DME count up.','Fly ut på radialen og se DME-en telle opp.'),[0,0.35],'arc'),
   U(t2('A 90° turn takes about one turn radius, about 0.6 NM at 120 kt: start it that much early.','En sving på 90° tar omtrent én svingradius, rundt 0,6 NM i 120 kt: start den så mye før.'),[0.3,0.6],'arc'),
   U(t2('Roll out with the station on the wingtip, then nudge 10° to keep the DME steady.','Rull ut med stasjonen på vingetippen, og juster 10° for å holde DME-en jevn.'),[0.6,1],'arc')],
 dmeLeave:[U(t2('On the arc, watch the radials count towards the one you want.','På buen ser du radialene telle mot den du skal ha.'),[0,0.4],'arc'),
   U(t2('Lead radial: about 60 × turn radius ÷ DME degrees before it. On a 10 NM arc at 120 kt, about 4°.','Ledende radial: rundt 60 × svingradius ÷ DME grader før. På en bue på 10 NM i 120 kt, rundt 4°.'),[0.4,0.7],'arc'),
   U(t2('Turn there, and you roll out on the inbound course instead of through it.','Sving der, så ruller du ut på kursen inn i stedet for gjennom den.'),[0.7,1],'arc')],
 holdEntry:[U(t2('Three sectors round the fix pick the entry: direct 180°, parallel 110°, teardrop 70°.','Tre sektorer rundt fiksen bestemmer inngangen: direkte 180°, parallell 110°, teardrop 70°.'),['tofix'],'sectors'),
   U(t2('Crossing the fix, your heading tells you which sector you came from.','Over fiksen forteller kursen din hvilken sektor du kom fra.'),['tofix','entry'],'sectors'),
   U(t2('Then fly that entry: here the instructor flies it in this wind.','Fly så den inngangen: her flyr instruktøren den i denne vinden.'),['entry','entryleg','back','outbound','turnIn','inbound','turnOut'],'sectors')],
 hold:[U(t2('Fly the inbound leg first: it teaches you the wind.','Fly inngående legg først: det lærer deg vinden.'),['tofix'],'race'),
   U(t2('Outbound, hold three times the inbound correction the other way: triple the drift.','Ut holder du tre ganger den inngående korreksjonen motsatt vei: tredobbel avdrift.'),['turnOut','outbound'],'race'),
   U(t2('Start the clock abeam the fix. Inbound leg short? Fly longer outbound next time.','Start klokken tvers av fiksen. Kort inngående legg? Fly lenger ut neste gang.'),['turnIn','inbound'],'race')],
 holdDmeLim:[U(t2('Fly the inbound leg first: it teaches you the wind.','Fly inngående legg først: det lærer deg vinden.'),['tofix'],'race'),
   U(t2('Outbound, the leg ends at a DME distance, not after a minute.','Ut slutter legget ved en DME-avstand, ikke etter ett minutt.'),['turnOut','outbound'],'race'),
   U(t2('At the DME limit, turn inbound at once, whatever the clock says.','Ved DME-grensen svinger du inn med en gang, uansett hva klokka sier.'),['turnIn','inbound'],'race')],
 racetrack:[U(t2('A racetrack is a hold flown once: enter it like a hold.','En racetrack er en holding fløyet én gang: gå inn som i en holding.'),['tofix'],'sectors'),
   U(t2('Fly the entry the sector gives you.','Fly inngangen sektoren gir deg.'),['entry','entryleg','back'],'sectors'),
   U(t2('One lap: outbound, the turn, and you are on the final course.','Én runde: ut, svingen, og du er på sluttkursen.'),['turnOut','outbound','turnIn','inbound'],'race')],
 pt:[U(t2('Overfly the station and fly outbound for the published time.','Overfly stasjonen og fly ut den publiserte tiden.'),['tofix','out'],'pt'),
   U(t2('Turn 45° to the side on the chart and fly 1 minute.','Sving 45° mot siden på kartet og fly 1 minutt.'),['t45'],'pt'),
   U(t2('Turn 180° the other way: you roll out at 45° to the inbound course and intercept it.','Sving 180° den andre veien: du ruller ut 45° på kursen inn og fanger den.'),['t180','in'],'pt')],
 pt80:[U(t2('Overfly the station and fly outbound for the published time.','Overfly stasjonen og fly ut den publiserte tiden.'),['tofix','out'],'pt'),
   U(t2('Turn 80° to the side on the chart.','Sving 80° mot siden på kartet.'),['t45'],'pt'),
   U(t2('Without a pause, turn 260° the other way: you roll out on the inbound course.','Uten pause svinger du 260° den andre veien: du ruller ut på kursen inn.'),['t180','in'],'pt')],
 base:[U(t2('Overfly the station and fly out on a radial offset from the final course.','Overfly stasjonen og fly ut på en radial forskjøvet fra sluttkursen.'),['tofix','out'],'base'),
   U(t2('The offset is about 36° divided by the outbound minutes.','Forskyvningen er rundt 36° delt på antall minutter ut.'),['out'],'base'),
   U(t2('When the time is up, turn towards the final course, through more than 180°.','Når tiden er ute, sving mot sluttkursen, mer enn 180°.'),['turn','in'],'base')],
 vordme:[U(t2('Stay level at the FAF altitude until the final approach fix.','Hold FAF-høyden plant til final approach fix.'),['initial'],'prof'),
   U(t2('At the FAF descend at about ground speed × 5 ft/min.','Ved FAF sinker du med omtrent fart over bakken × 5 ft/min.'),['final'],'prof'),
   U(t2('Compare each DME with the table and adjust a little. At the MDA with no runway: go around (missed approach).','Sammenlign hver DME med tabellen og juster litt. Ved MDA uten rullebane: gå rundt (missed approach).'),['min','miss'],'prof')],
 vorApp:[U(t2('Track to the VOR at the FAF altitude. The ADF needle on the locator marks the FAF.','Følg kurs mot VOR-en på FAF-høyden. ADF-nålen på lokatoren markerer FAF.'),['initial'],'prof'),
   U(t2('When the ADF needle swings behind you, start the clock and descend at ground speed × 5.','Når ADF-nålen svinger bak deg, start klokken og sink med fart over bakken × 5.'),['final'],'prof'),
   U(t2('Check altitude against time. At the MDA, no runway: missed approach.','Sjekk høyden mot tiden. Ved MDA, ingen rullebane: missed approach.'),['min','miss'],'prof')],
 ndbApp:[U(t2('Track the bearing to the locator (QDM) at the FAF altitude.','Følg peilingen til lokatoren (QDM) på FAF-høyden.'),['initial'],'prof'),
   U(t2('Over the beacon the needle swings: now track the bearing from it (QDR) and descend.','Over fyret svinger nålen: følg nå peilingen fra det (QDR) og sink.'),['final'],'prof'),
   U(t2('Hold the tail of the needle where you want it. At the MDA: missed approach.','Hold halen av nålen der du vil ha den. Ved MDA: missed approach.'),['min','miss'],'prof')],
 locApp:[U(t2('The localiser gives ILS precision left and right, but there is no glide slope.','Localiseren gir ILS-presisjon sideveis, men det er ingen glidebane.'),['initial'],'prof'),
   U(t2('At the FAF start down and check the DME table every mile.','Ved FAF starter du ned og sjekker DME-tabellen hver mil.'),['final'],'prof'),
   U(t2('The MDA is a floor. No runway: missed approach.','MDA er et gulv. Ingen rullebane: missed approach.'),['min','miss'],'prof')],
 ils:[U(t2('Two needles: the localiser for left and right, the glide slope for up and down.','To nåler: localiseren for venstre og høyre, glidebanen for opp og ned.'),[0,0.35],'prof'),
   U(t2('Take the glide slope from below: hold altitude until it comes down to the centre, then descend at ground speed × 5.','Ta glidebanen nedenfra: hold høyden til den kommer ned til midten, og sink så med fart over bakken × 5.'),[0.35,0.75],'prof'),
   U(t2('At the decision altitude with no runway in sight: go around and fly the missed approach.','På beslutningshøyden uten rullebanen i sikte: gå rundt og fly missed approach.'),['miss'],'prof')],
 lnav:[U(t2('The GPS draws the final course. Full scale shrinks from 1 NM to 0.3 NM before the FAF.','GPS-en tegner sluttkursen. Fullt utslag krymper fra 1 NM til 0,3 NM før FAF.'),['initial'],'prof'),
   U(t2('LNAV has no glide path: at the FAF, descend and check the distance table.','LNAV har ingen glidebane: ved FAF sinker du og sjekker avstandstabellen.'),['final'],'prof'),
   U(t2('The MDA is a floor. At the MDA without the runway: missed approach.','MDA er et gulv. Ved MDA uten rullebanen: missed approach.'),['min','miss'],'prof')],
 lnavVnav:[U(t2('LNAV/VNAV adds a glide path computed from the altimeter (baro-VNAV).','LNAV/VNAV legger til en glidebane regnet fra høydemåleren (baro-VNAV).'),['initial'],'prof'),
   U(t2('Follow the vertical needle like a glide slope; it is linear, not angular.','Følg den vertikale nålen som en glidebane; den er lineær, ikke vinkelbasert.'),['final'],'prof'),
   U(t2('At the DA without the runway: missed approach.','På DA uten rullebanen: missed approach.'),['min','miss'],'prof')],
 lpv:[U(t2('LPV looks and flies like an ILS, but the needles come from satellites.','LPV ser ut og flys som en ILS, men nålene kommer fra satellitter.'),['initial'],'prof'),
   U(t2('Capture the glide path from below and keep corrections small.','Fang glidebanen nedenfra og hold korreksjonene små.'),['final'],'prof'),
   U(t2('Down to a DA of about 200 ft, then the missed approach.','Ned til en DA på rundt 200 ft, så missed approach.'),['min','miss'],'prof')],
 sid:[U(t2('A departure is a chain of legs between waypoints, with altitudes to meet.','En utflyging er en kjede av legg mellom waypoints, med høyder du skal møte.'),[0,0.3],'route'),
   U(t2('“At or above” means cross the waypoint no lower than that. Climb early.','«I eller over» betyr at du krysser waypointet ikke lavere enn det. Stig tidlig.'),[0.25,0.6],'route'),
   U(t2('At each waypoint the course changes: turn as the GPS sequences, then track the new leg.','Ved hvert waypoint endrer kursen seg: sving når GPS-en går videre, og følg det nye legget.'),[0.6,1],'route')],
 star:[U(t2('An arrival brings you from the airway to the approach.','En innflygingsrute tar deg fra luftveien til innflygingen.'),[0,0.3],'route'),
   U(t2('“At or below” and “at” constraints shape your descent: plan 3 NM per 1000 ft.','Krav om «i eller under» og «i» former nedstigningen: planlegg 3 NM per 1000 ft.'),[0.25,0.65],'route'),
   U(t2('Turn at each waypoint and arrive at the last one at the right altitude.','Sving ved hvert waypoint og kom til det siste i riktig høyde.'),[0.65,1],'route')],
 ppTrack:[U(t2('The heading indicator has failed. The compass still works, but it swings.','Kursindikatoren har sviktet. Kompasset virker, men det svinger.'),[0,0.3],'wedge'),
   U(t2('Turn by time instead: a rate-one turn is 3° a second, so 30° takes 10 seconds.','Sving etter tid i stedet: en standardsving er 3° i sekundet, så 30° tar 10 sekunder.'),[0.3,0.65],'wedge'),
   U(t2('Use small timed turns and let the needle tell you if it worked.','Bruk små tidsstyrte svinger og la nålen fortelle om det virket.'),[0.65,1],'wedge')],
 ppNdb:[U(t2('No heading indicator: take the heading from the compass when it settles.','Ingen kursindikator: ta kursen fra kompasset når det roer seg.'),[0,0.3],'homing'),
   U(t2('Bearing to the beacon = compass + needle.','Peiling til fyret = kompass + nål.'),[0.3,0.65],'homing'),
   U(t2('Correct with timed turns: 3° a second.','Korriger med tidsstyrte svinger: 3° i sekundet.'),[0.65,1],'homing')],
 ppHold:[U(t2('The hold on partial panel: every turn is a timed rate-one turn.','Holding på delvis panel: hver sving er en tidsstyrt standardsving.'),['tofix'],'race'),
   U(t2('180° takes one minute. Roll out on time, then check the compass.','180° tar ett minutt. Rull ut på tid, og sjekk så kompasset.'),['turnOut','outbound'],'race'),
   U(t2('The needle tells you how well the timing worked.','Nålen forteller hvor godt timingen virket.'),['turnIn','inbound'],'race')]
};
/* exercises without their own walk-through borrow one */
const UMAP={orientRmi:'orient',orientDrill:'orient',int90:'intIn',intNdbIn:'intIn',intNdbOut:'intOut',holdLeft:'hold',holdNdb:'holdEntry',holdDme:'holdEntry'};
const uwFor=id=>UW[id]||UW[UMAP[id]]||UW[(I.ITEM[id]||{}).ex]||UW.trackIn;
const TRY=t2('Your turn: drag the aircraft and turn it with the handle. Watch the instrument answer.','Din tur: dra flyet og snu det med håndtaket. Se hvordan instrumentet svarer.');
/* mental maths: the methods, also the walk-through */
const MATHU=[t2('Most IFR sums are one rule of thumb each. Learn the rule, then the number comes by itself.','De fleste IFR-regnestykker er én tommelfingerregel hver. Lær regelen, så kommer tallet av seg selv.'),
  t2('Wind: crosswind × 60 ÷ TAS is the correction angle. 1 in 60: 1 NM off after 60 NM is 1°.','Vind: sidevind × 60 ÷ TAS er korreksjonsvinkelen. 1 av 60: 1 NM ute etter 60 NM er 1°.'),
  t2('Descent: ground speed × 5 is the rate on 3°; you need 3 NM for every 1000 ft.','Nedstigning: fart over bakken × 5 er raten på 3°; du trenger 3 NM for hver 1000 ft.')];
const MATHQ={
 int:{q:t2('Course {crs}, needle {side}. Intercept at {ang}°: heading?','Kurs {crs}, nål til {side}. Interception på {ang}°: kurs?'),m:[t2('The course is on the side of the needle: {side}.','Kursen ligger på samme side som nålen: {side}.'),t2('Turn towards it: course {sgn} {ang}°.','Sving mot den: kurs {sgn} {ang}°.'),t2('{crs} {sgn} {ang} = {ans}.','{crs} {sgn} {ang} = {ans}.')]},
 wca:{q:t2('Crosswind {xw} kt from the {side}, TAS {tas} kt. Wind correction angle?','Sidevind {xw} kt fra {side}, TAS {tas} kt. Vindkorreksjonsvinkel?'),m:[t2('Rule: crosswind × 60 ÷ TAS.','Regel: sidevind × 60 ÷ TAS.'),t2('{xw} × 60 = {p60}.','{xw} × 60 = {p60}.'),t2('{p60} ÷ {tas} ≈ {ans}°, into the wind.','{p60} ÷ {tas} ≈ {ans}°, opp mot vinden.')]},
 r160:{q:t2('After {dist} NM you are {off} NM off track. Track error in degrees?','Etter {dist} NM er du {off} NM ute av sporet. Sporfeil i grader?'),m:[t2('1 in 60: 1 NM off at 60 NM is 1°.','1 av 60: 1 NM ute på 60 NM er 1°.'),t2('Error = 60 × off ÷ distance.','Feil = 60 × ute ÷ avstand.'),t2('60 × {off} ÷ {dist} = {ans}°.','60 × {off} ÷ {dist} = {ans}°.')]},
 tts:{q:t2('Station on the wingtip, the bearing changes {deg}° in {sec} s. Minutes to the station?','Stasjonen på vingetippen, peilingen endres {deg}° på {sec} s. Minutter til stasjonen?'),m:[t2('Minutes = seconds ÷ degrees.','Minutter = sekunder ÷ grader.'),t2('{sec} ÷ {deg}.','{sec} ÷ {deg}.'),t2('= {ans} minutes.','= {ans} minutter.')]},
 rod:{q:t2('Ground speed {gs} kt on a 3° path. Rate of descent?','Fart over bakken {gs} kt på en bane på 3°. Sinkrate?'),m:[t2('Rule: ground speed × 5.','Regel: fart over bakken × 5.'),t2('{gs} × 5.','{gs} × 5.'),t2('= {ans} ft/min (exactly about {ex}).','= {ans} ft/min (nøyaktig rundt {ex}).')]},
 tod:{q:t2('Descend from {from} ft to {to} ft on 3°. How many NM before?','Ned fra {from} ft til {to} ft på 3°. Hvor mange NM før?'),m:[t2('Rule: 3 NM per 1000 ft.','Regel: 3 NM per 1000 ft.'),t2('{from} − {to} = {dh} ft.','{from} − {to} = {dh} ft.'),t2('{dh} ÷ 1000 × 3 = {ans} NM.','{dh} ÷ 1000 × 3 = {ans} NM.')]},
 lead:{q:t2('{dme} DME arc, ground speed {gs} kt. Lead radial for the 90° turn (degrees before)?','{dme} DME-bue, fart over bakken {gs} kt. Ledende radial for svingen på 90° (grader før)?'),m:[t2('Turn radius ≈ ground speed ÷ 200 = {R} NM.','Svingradius ≈ fart over bakken ÷ 200 = {R} NM.'),t2('Lead = 60 × radius ÷ DME.','Ledning = 60 × radius ÷ DME.'),t2('60 × {R} ÷ {dme} ≈ {ans}°.','60 × {R} ÷ {dme} ≈ {ans}°.')]},
 leadd:{q:t2('Ground speed {gs} kt. Lead distance for a 90° turn onto a line?','Fart over bakken {gs} kt. Ledningsavstand for en sving på 90° inn på en linje?'),m:[t2('A 90° turn needs one turn radius.','En sving på 90° trenger én svingradius.'),t2('Radius ≈ ground speed ÷ 200.','Radius ≈ fart over bakken ÷ 200.'),t2('{gs} ÷ 200 = {ans} NM.','{gs} ÷ 200 = {ans} NM.')]}
};
function mathParams(Q){ const p=Object.assign({},Q.p,{ans:Q.unit==='°'&&Q.kind==='int'?d3(Q.ans):String(Q.ans).replace('.',no()?',':'.')});
  if(Q.kind==='int'){ p.crs=d3(Q.p.crs); p.sgn=Q.p.side==='R'?'+':'−'; p.side=sideW(Q.p.side); }
  if(Q.kind==='wca'){ p.p60=Q.p.xw*60; p.side=sideW(Q.p.side); }
  if(Q.kind==='rod') p.ex=Math.round(Q.p.gs*5.3/10)*10;
  if(Q.kind==='tod') p.dh=Q.p.from-Q.p.to;
  if(Q.kind==='lead'){ p.R=String(Math.round(Q.p.gs/200*10)/10).replace('.',no()?',':'.'); }
  return p; }

/* live coach lines (code → one line) and their "Why?" */
const CO={
 'orient.ask':t2('Position {n} of {of}: centre the needle with FROM, then report your radial.','Posisjon {n} av {of}: sentrer nålen med FROM, og rapporter radialen din.'),
 'orient.askr':t2('Position {n} of {of}: read the tail of the green needle, then report your radial.','Posisjon {n} av {of}: les halen på den grønne nålen, og rapporter radialen din.'),
 'orient.askq':t2('Position {n} of {of}: heading + needle = bearing to the beacon. Report it.','Posisjon {n} av {of}: kurs + nål = peiling til fyret. Rapporter den.'),
 'orient.rmi.why':t2('The RMI needle head points to the station, so its tail points to where you are: your radial.','RMI-nålens hode peker mot stasjonen, så halen peker dit du er: radialen din.'),
 'orient.rbi.why':t2('The needle is measured from the nose. Add your heading to turn it into a bearing; take away 360 if it goes over.','Nålen måles fra nesen. Legg til kursen for å gjøre den om til en peiling; trekk fra 360 hvis den går over.'),
 'orient.to':t2('Centred with TO: that is the bearing to the station. Your radial is the other end.','Midt med TO: det er peilingen til stasjonen. Radialen din er den andre enden.'),
 'orient.to.why':t2('With TO, the OBS shows the course that takes you to the station. The radial is where you are from it: add or take away 180.','Med TO viser OBS kursen som tar deg til stasjonen. Radialen er der du er fra den: legg til eller trekk fra 180.'),
 'orient.centred':t2('Centred with FROM: you are on radial {obs}. Report it.','Midt med FROM: du er på radial {obs}. Rapporter den.'),
 'track.reverse':t2('FROM while flying to the station: the needle works backwards. Set {crs}.','FROM mens du flyr mot stasjonen: nålen virker baklengs. Still inn {crs}.'),
 'track.reverse.why':t2('Set the course you fly. Inbound that gives TO, and then a needle on the right always means the course is on your right.','Still inn kursen du flyr. Inn mot stasjonen gir det TO, og da betyr nål til høyre alltid at kursen er til høyre.'),
 'track.setcrs':t2('Set the course first: OBS {crs}.','Still inn kursen først: OBS {crs}.'),
 'track.setcrs.why':t2('The needle only means something once the OBS shows the course you want to fly.','Nålen betyr noe først når OBS viser kursen du vil fly.'),
 'track.good':t2('On course. Hold this heading{wca}.','På kurs. Hold denne kursen{wca}.'),
 'track.small':t2('Needle slightly {side}. Turn 5° {side}, then hold and watch.','Nålen litt til {side}. Sving 5° til {side}, hold og se.'),
 'track.small.why':t2('Small corrections: 5° for a dot or less. Wait until the needle stops before you correct again.','Små korreksjoner: 5° for én prikk eller mindre. Vent til nålen stopper før du korrigerer igjen.'),
 'track.big':t2('Needle well {side}. Turn towards it, heading {hdg}.','Nålen godt til {side}. Sving mot den, kurs {hdg}.'),
 'track.big.why':t2('Turn towards the needle. The bigger the deflection, the bigger the correction, up to 30° to 45°.','Sving mot nålen. Jo større utslag, jo større korreksjon, opp til 30° til 45°.'),
 'track.wind':t2('Heading on the course, but the needle drifts {side}: that is the wind. Hold a few degrees into it.','Kursen er lik sporet, men nålen driver til {side}: det er vinden. Hold noen grader opp mot den.'),
 'track.wind.why':t2('Find the heading that keeps the needle still. Its difference from the course is your wind correction.','Finn kursen som holder nålen i ro. Forskjellen fra sporet er vindkorreksjonen din.'),
 'track.cone':t2('Over the station: the needle is unreliable. Hold the heading until the flag changes.','Over stasjonen: nålen er upålitelig. Hold kursen til flagget skifter.'),
 'int.pickA':t2('Course to your {side}. Turn to {a}, a {ang}° intercept.','Kursen ligger til {side}. Sving til {a}, en interception på {ang}°.'),
 'int.pick':t2('Course to your {side}. Turn to {a} (30°) or {b} (45°).','Kursen ligger til {side}. Sving til {a} (30°) eller {b} (45°).'),
 'int.pick.why':t2('Intercept heading = course ± 30° to 45°, towards the needle. Far out use 45°; close in, 30°.','Interceptkurs = kursen ± 30° til 45°, mot nålen. Langt ute 45°; nærme 30°.'),
 'int.wait':t2('Hold the intercept heading. The needle will come off the stop.','Hold interceptkursen. Nålen kommer løs fra stoppen.'),
 'int.wait.why':t2('Full scale means 10° or more off the course. Nothing to do yet but hold the heading.','Fullt utslag betyr 10° eller mer fra kursen. Ingenting å gjøre ennå annet enn å holde kursen.'),
 'int.lead':t2('Needle moving: start the turn onto {crs} now.','Nålen beveger seg: start svingen inn på {crs} nå.'),
 'int.lead.why':t2('A turn takes distance. Start it as the needle moves through 2 to 3 dots, and you roll out on the course instead of through it.','En sving tar plass. Start den når nålen passerer 2 til 3 prikker, så ruller du ut på kursen i stedet for gjennom den.'),
 'ndb.homing':t2('Homing: the nose follows the needle and the wind bends your path.','Homing: nesen følger nålen og vinden bøyer banen din.'),
 'ndb.homing.why':t2('Pointing at the beacon only works in still air. In wind, fly a heading into it and let the needle sit a few degrees off the nose.','Å peke på fyret virker bare i stille luft. I vind flyr du en kurs opp mot den og lar nålen stå noen grader fra nesen.'),
 'ndb.good':t2('On track. The needle sits {rb}° {side} of the nose: that is your drift.','På sporet. Nålen står {rb}° til {side} for nesen: det er avdriften din.'),
 'ndb.good.why':t2('Tracking with drift, the needle points at the station, not straight ahead. Its angle off the nose equals your wind correction.','Når du tracker med avdrift, peker nålen mot stasjonen, ikke rett frem. Vinkelen fra nesen er lik vindkorreksjonen.'),
 'ndb.off':t2('Bearing to the beacon {qdm}, you want {crs}. Turn {side} to regain the track.','Peiling til fyret {qdm}, du vil ha {crs}. Sving til {side} for å komme inn på sporet.'),
 'ndb.off.why':t2('Bearing to the station = heading + needle. Bearing bigger than the one you want: you are left of track, so turn right.','Peiling til stasjonen = kurs + nål. Større peiling enn ønsket: du er til venstre for sporet, sving til høyre.'),
 'arc.out':t2('Track outbound. At {lead} DME turn {dir} onto the arc, heading about {hdg}.','Følg radialen ut. Ved {lead} DME svinger du til {dir} inn på buen, kurs rundt {hdg}.'),
 'arc.turnsoon':t2('Arc ahead: turn {dir} at {lead} DME to roll out on {R} DME.','Buen kommer: sving til {dir} ved {lead} DME for å rulle ut på {R} DME.'),
 'arc.lead.why':t2('A 90° turn takes about one turn radius. Start that much early and you roll out on the arc instead of outside it.','En sving på 90° tar omtrent én svingradius. Start så mye før, så ruller du ut på buen i stedet for utenfor.'),
 'arc.good':t2('On the arc. Keep the station on the wingtip; nudge about 10° when the DME drifts.','På buen. Hold stasjonen på vingetippen; juster rundt 10° når DME-en driver.'),
 'arc.outside':t2('{e} NM outside the arc: turn 10° to 20° towards the station.','{e} NM utenfor buen: sving 10° til 20° mot stasjonen.'),
 'arc.inside':t2('{e} NM inside the arc: turn about 10° away from the station.','{e} NM innenfor buen: sving rundt 10° vekk fra stasjonen.'),
 'arc.fly.why':t2('On an arc you never fly straight for long. Keep the RMI needle at the wingtip and correct in steps of about 10°.','På en bue flyr du aldri rett lenge. Hold RMI-nålen ved vingetippen og korriger i trinn på rundt 10°.'),
 'arc.leadradial':t2('Lead radial: start the turn onto {crs} about {lead}° before radial {r1}.','Ledende radial: start svingen inn på {crs} rundt {lead}° før radial {r1}.'),
 'arc.leadradial.why':t2('The turn from the arc onto the radial is 90°. Start it a few degrees early: about 60 × turn radius ÷ DME.','Svingen fra buen inn på radialen er 90°. Start den noen grader før: rundt 60 × svingradius ÷ DME.'),
 'hold.tofix':t2('To the fix. Your heading now means a {entry} entry.','Mot fiksen. Kursen din nå betyr {entry} inngang.'),
 'hold.entry.why':t2('The heading you cross the fix with picks the entry. Picture the 70° line through the fix on the holding side.','Kursen du krysser fiksen med bestemmer inngangen. Se for deg 70°-linjen gjennom fiksen på holdingsiden.'),
 'hold.entry.direct':t2('Direct entry: turn {dir} into the hold, outbound {out}.','Direkte inngang: sving til {dir} inn i holdingen, ut {out}.'),
 'hold.entry.direct.why':t2('Direct: you are already pointing roughly the right way. Follow the hold.','Direkte: du peker allerede omtrent riktig vei. Følg holdingen.'),
 'hold.entry.parallel':t2('Parallel entry: turn to {out} on the non-holding side, time 1 minute.','Parallell inngang: sving til {out} på siden uten holding, ta tiden 1 minutt.'),
 'hold.entry.parallel.why':t2('Parallel: fly outbound on the other side of the inbound course, then turn back through the holding side to the fix.','Parallell: fly ut på motsatt side av inngående kurs, og sving så tilbake gjennom holdingsiden til fiksen.'),
 'hold.entry.teardrop':t2('Teardrop entry: fly {td}, 30° into the holding side, for 1 minute.','Teardrop-inngang: fly {td}, 30° inn mot holdingsiden, i 1 minutt.'),
 'hold.entry.teardrop.why':t2('Teardrop: an offset leg 30° from the outbound course, then one turn in the hold direction onto the inbound course.','Teardrop: en legg 30° fra utgående kurs, så én sving i holdingretningen inn på inngående kurs.'),
 'hold.entryleg':t2('{s} s to go on the entry leg.','{s} s igjen på inngangsleggen.'),
 'hold.entryturn':t2('Time: turn {dir} back towards the fix.','Tiden er ute: sving til {dir} tilbake mot fiksen.'),
 'hold.entryturn.why':t2('Teardrop: turn in the hold direction onto the inbound course. Parallel: turn towards the holding side, more than 180°, back to the fix.','Teardrop: sving i holdingretningen inn på inngående kurs. Parallell: sving mot holdingsiden, mer enn 180°, tilbake til fiksen.'),
 'hold.back':t2('Back to the fix on {inb}.','Tilbake til fiksen på {inb}.'),
 'hold.inbound':t2('Inbound {inb}. Hold about {hdg} to stay on the course.','Inn {inb}. Hold rundt {hdg} for å bli på kursen.'),
 'hold.inbound.why':t2('The inbound leg teaches you the wind: the heading that keeps the needle centred gives the correction for the whole hold.','Inngående legg lærer deg vinden: kursen som holder nålen i midten gir korreksjonen for hele holdingen.'),
 'hold.turnout':t2('Over the fix: turn {dir} to the outbound heading {hdg}.','Over fiksen: sving til {dir} til utgående kurs {hdg}.'),
 'hold.turnout.why':t2('Outbound heading = outbound course with three times the inbound correction the other way. The triple also covers the drift in both turns.','Utgående kurs = utgående spor med tre ganger den inngående korreksjonen motsatt vei. Tredoblingen dekker også avdriften i begge svingene.'),
 'hold.outbound':t2('Outbound {hdg}. Start the clock abeam the fix.','Ut {hdg}. Start klokken tvers av fiksen.'),
 'hold.outbound.why':t2('Timing starts abeam the fix, or when the outbound turn is complete if that is later.','Tiden starter tvers av fiksen, eller når svingen ut er ferdig hvis det er senere.'),
 'hold.timing':t2('Outbound {s} s of about {want} s.','Ut {s} s av rundt {want} s.'),
 'hold.timing.why':t2('Set the outbound time so the inbound leg takes 1 minute. Inbound leg short? Fly longer outbound next time.','Juster tiden ut så inngående legg tar 1 minutt. Ble inngående legg kort? Fly lenger ut neste gang.'),
 'hold.turnin':t2('Turn inbound to {inb}. Watch the needle as you roll out.','Sving inn til {inb}. Følg nålen når du ruller ut.'),
 'pt.tofix':t2('Overfly the station, then outbound on {out}.','Overfly stasjonen, så ut på {out}.'),
 'pt.tofix.why':t2('Start the clock over the station: the outbound time is published.','Start klokken over stasjonen: tiden ut er publisert.'),
 'pt.out':t2('Outbound: {s} s to the 45° turn.','Ut: {s} s til 45°-svingen.'),
 'pt.turn45':t2('Turn {dir} {a}° to {hdg}, and start the clock.','Sving {a}° til {dir} til {hdg}, og start klokken.'),
 'pt.turn45.why':t2('The 45° turn and the 1-minute leg make room for the 180° turn. Turn to the side on the chart: that side is protected.','45°-svingen og legget på 1 minutt gir plass til 180°-svingen. Sving til siden på kartet: den siden er beskyttet.'),
 'pt.leg45':t2('{s} s on the 45° leg.','{s} s på 45°-legget.'),
 'pt.turn180':t2('Turn {dir} 180° to {hdg} to intercept inbound.','Sving 180° til {dir} til {hdg} for å fange kursen inn.'),
 'pt.turn180.why':t2('The 180° turn goes the opposite way to the 45° turn, away from the station, so you stay in the protected area.','180°-svingen går motsatt vei av 45°-svingen, bort fra stasjonen, så du blir i det beskyttede området.'),
 'pt.intercept':t2('Intercept {inb} inbound: turn on as the needle moves.','Fang {inb} inn: sving inn når nålen beveger seg.'),
 'base.tofix':t2('Overfly the station, then outbound on radial {ro}.','Overfly stasjonen, så ut på radial {ro}.'),
 'base.why':t2('A base turn is an outbound leg slightly off the final course, then one turn of more than 180° onto it.','En base turn er en legg ut litt til siden for sluttkursen, så én sving på mer enn 180° inn på den.'),
 'base.out':t2('Outbound: {s} s to the base turn.','Ut: {s} s til base turn.'),
 'base.turn':t2('Turn {dir} now, onto {inb} inbound.','Sving til {dir} nå, inn på {inb}.'),
 'base.turn.why':t2('Turn towards the final course: the outbound leg is offset to that side so one turn brings you onto it.','Sving mot sluttkursen: legget ut er forskjøvet til den siden, så én sving tar deg inn på den.'),
 'vor.initial':t2('Level at {alt} ft until the FAF at {faf} DME. Set the MDA, {mda} ft.','Plant på {alt} ft til FAF ved {faf} DME. Still inn MDA, {mda} ft.'),
 'vor.initial.why':t2('No descent below the published altitude before the final approach fix.','Ingen nedstigning under publisert høyde før final approach fix.'),
 'vor.faf':t2('FAF next: start down at about {rod} ft/min.','FAF nå: start ned med rundt {rod} ft/min.'),
 'vor.faf.why':t2('At the FAF, descend on the 3° profile: rate ≈ ground speed × 5.','Ved FAF sinker du på 3°-profilen: rate ≈ fart over bakken × 5.'),
 'vor.onprofile':t2('On profile. Next check {dme} DME, {alt} ft.','På profilen. Neste sjekk {dme} DME, {alt} ft.'),
 'vor.high':t2('{pa} ft high. Increase the descent a little.','{pa} ft høyt. Øk sinket litt.'),
 'vor.low':t2('{pa} ft low. Reduce the descent.','{pa} ft lavt. Reduser sinket.'),
 'vor.profile.why':t2('Check the altitude against the table every mile. High or low: change the rate a little, then check again.','Sjekk høyden mot tabellen hver mil. Høyt eller lavt: endre raten litt, og sjekk igjen.'),
 'app.minimums':t2('Minimums. Runway in sight: land.','Minima. Rullebanen i sikte: land.'),
 'ils.vector':t2('Hold the heading. The localiser is not alive yet.','Hold kursen. Localiseren er ikke levende ennå.'),
 'ils.vector.why':t2('Full scale on the localiser is about 2.5°: it comes alive late and moves fast.','Fullt utslag på localiseren er rundt 2,5°: den blir levende sent og beveger seg fort.'),
 'ils.alive':t2('Localiser alive: turn onto {crs} now.','Localiseren lever: sving inn på {crs} nå.'),
 'ils.waitgs':t2('Established. Hold {alt} ft until the glide slope comes down to the centre.','Etablert. Hold {alt} ft til glidebanen kommer ned til midten.'),
 'ils.waitgs.why':t2('Take the glide slope from below. When the needle is centred, descend at about {rod} ft/min.','Ta glidebanen nedenfra. Når nålen er i midten, sinker du med rundt {rod} ft/min.'),
 'ils.good':t2('On both needles. Keep the corrections small.','På begge nålene. Hold korreksjonene små.'),
 'ils.low':t2('Below the glide slope: reduce the descent.','Under glidebanen: reduser sinket.'),
 'ils.high':t2('Above the glide slope: increase the descent.','Over glidebanen: øk sinket.'),
 'ils.loc':t2('Localiser {side}: turn 2° to 3° towards it.','Localiseren til {side}: sving 2° til 3° mot den.'),
 'ils.fly.why':t2('Fly the needles with small changes: 2° to 3° of heading for the localiser, 100 to 200 ft/min for the glide slope.','Fly nålene med små endringer: 2° til 3° kurs for localiseren, 100 til 200 ft/min for glidebanen.'),
 'pt.turn260':t2('Turn {dir} through 260° to {hdg}, onto the inbound course.','Sving 260° til {dir} til {hdg}, inn på kursen inn.'),
 'pt.turn260.why':t2('80°/260°: no leg between the turns. The 260° turn goes the opposite way and ends on the inbound course.','80°/260°: ingen legg mellom svingene. Svingen på 260° går motsatt vei og ender på kursen inn.'),
 'hold.dmeout':t2('Outbound {hdg}. Turn inbound at {D} DME (now {now}).','Ut {hdg}. Sving inn ved {D} DME (nå {now}).'),
 'hold.dmeout.why':t2('A DME-limited hold ends the outbound leg at the DME limit, whatever the time.','En DME-begrenset holding avslutter utgående legg ved DME-grensen, uansett tid.'),
 'miss.climb':t2('Go around: climb, track {crs}. At {ta} ft turn {dir} heading {hdg}.','Gå rundt: stig, følg {crs}. Ved {ta} ft sving til {dir}, kurs {hdg}.'),
 'miss.turn':t2('Turn {dir} heading {hdg}, climb to {alt} ft.','Sving til {dir}, kurs {hdg}, stig til {alt} ft.'),
 'miss.why':t2('At the minimums without the runway in sight, go around at once: power, pitch up, climb straight ahead, then the published turn.','Ved minima uten rullebanen i sikte går du rundt med en gang: kraft, nesen opp, stig rett frem, så den publiserte svingen.'),
 'app.init':t2('Level at {alt} ft until the FAF. Minimums {mins} ft.','Plant på {alt} ft til FAF. Minima {mins} ft.'),
 'app.init.cdfa.why':t2('No descent below the published altitude before the final approach fix. Then a constant descent to the MDA.','Ingen nedstigning under publisert høyde før final approach fix. Så en jevn nedstigning til MDA.'),
 'app.init.gp.why':t2('Stay level and let the glide path come down to you; take it from below.','Hold deg plant og la glidebanen komme ned til deg; ta den nedenfra.'),
 'app.faf':t2('FAF ({fix}) next: start down at about {rod} ft/min.','FAF ({fix}) nå: start ned med rundt {rod} ft/min.'),
 'app.gpfaf':t2('Glide path coming down: when it centres, descend at about {rod} ft/min.','Glidebanen kommer ned: når den er i midten, sink med rundt {rod} ft/min.'),
 'app.ontime':t2('On profile. Next: {t} s after the FAF, {alt} ft.','På profilen. Neste: {t} s etter FAF, {alt} ft.'),
 'rt.next':t2('Track {crs} to {wp}, {d} NM.','Følg {crs} til {wp}, {d} NM.'),
 'rt.alt':t2('Check the altitude: {wp} needs {cw} {alt} ft.','Sjekk høyden: {wp} krever {cw} {alt} ft.'),
 'rt.turn':t2('{wp} ahead: turn {dir} onto {crs}.','{wp} foran: sving til {dir} inn på {crs}.'),
 'rt.next.why':t2('Each leg is a straight line between waypoints. Hold the course bar centred and meet each altitude constraint.','Hvert legg er en rett linje mellom waypoints. Hold kursstreken i midten og møt hvert høydekrav.'),
 'rt.turn.why':t2('Fly-by waypoints: turn before the waypoint so you roll out on the next leg.','Fly-by-waypoints: sving før waypointet så du ruller ut på neste legg.'),
 'pass.watch':t2('Station close: hold the heading and watch the flag.','Stasjonen er nær: hold kursen og følg flagget.'),
 'pass.after':t2('Station passed. Report it if you have not.','Stasjonen er passert. Rapporter hvis du ikke har gjort det.'),
 'pass.why':t2('Over a VOR the needle swings and the flag flips from TO to FROM. The flip is the passage.','Over en VOR svinger nålen, og flagget skifter fra TO til FROM. Skiftet er passeringen.'),
 'tts.time':t2('Station on the wingtip. Bearing changed {ch}° in {s} s.','Stasjonen på vingetippen. Peilingen er endret {ch}° på {s} s.'),
 'tts.report':t2('10° done in {s} s: work out the minutes and report.','10° på {s} s: regn ut minuttene og rapporter.'),
 'tts.why':t2('Minutes to the station = seconds for the change ÷ degrees of change.','Minutter til stasjonen = sekunder for endringen ÷ grader endring.'),
 'ndbo.good':t2('On track: bearing from the beacon {qdr}.','På sporet: peiling fra fyret {qdr}.'),
 'ndbo.off':t2('Bearing from the beacon {qdr}, you want {crs}. Turn {side}.','Peiling fra fyret {qdr}, du vil ha {crs}. Sving til {side}.'),
 'ndbo.why':t2('Bearing from the beacon (QDR) = heading + needle − 180.','Peiling fra fyret (QDR) = kurs + nål − 180.'),
 'ip.inbound':t2('Track {c0} to the station. After it, intercept radial {crs} outbound.','Følg {c0} til stasjonen. Etter den, fang radial {crs} ut.'),
 'ip.wait':t2('Hold {c0} through the station. Turn only after the flag says FROM.','Hold {c0} gjennom stasjonen. Sving først når flagget viser FROM.'),
 'ip.why':t2('Over the station the needle is unreliable. Hold the heading until the flag flips, then intercept.','Over stasjonen er nålen upålitelig. Hold kursen til flagget skifter, og fang så.'),
 'loc.good':t2('On the localiser. Keep it with 2° changes.','På localiseren. Hold den med endringer på 2°.'),
 'math.ask':t2('Question {n} of {of}.','Spørsmål {n} av {of}.'),
 'math.int.why':t2('Intercept heading = course ± 30° or 45°, towards the needle.','Interceptkurs = kurs ± 30° eller 45°, mot nålen.'),
 'math.wca.why':t2('Wind correction ≈ crosswind × 60 ÷ TAS.','Vindkorreksjon ≈ sidevind × 60 ÷ TAS.'),
 'math.r160.why':t2('1 in 60: 1 NM off after 60 NM is 1°.','1 av 60: 1 NM ute etter 60 NM er 1°.'),
 'math.tts.why':t2('Time to station (min) = seconds ÷ degrees of bearing change.','Tid til stasjonen (min) = sekunder ÷ grader peilingsendring.'),
 'math.rod.why':t2('On 3°: rate of descent ≈ ground speed × 5.','På 3°: sinkrate ≈ fart over bakken × 5.'),
 'math.tod.why':t2('On 3°: 3 NM for every 1000 ft.','På 3°: 3 NM for hver 1000 ft.'),
 'math.lead.why':t2('Lead radial ≈ 60 × turn radius ÷ DME; radius ≈ ground speed ÷ 200.','Ledende radial ≈ 60 × svingradius ÷ DME; radius ≈ fart over bakken ÷ 200.'),
 'math.leadd.why':t2('Lead for a 90° turn = one turn radius ≈ ground speed ÷ 200 NM.','Ledning for en sving på 90° = én svingradius ≈ fart over bakken ÷ 200 NM.')
};

/* debrief: what happened, and what to do instead */
const EV={
 reverse:{h:t2('Reverse sensing','Reversert nål'),w:t2('The OBS was set to {obs}, the reciprocal, while you flew towards the station. The flag showed FROM and the needle worked backwards.','OBS sto på {obs}, motsatt kurs, mens du fløy mot stasjonen. Flagget viste FROM og nålen virket baklengs.'),
  d:t2('Set the course you fly, {crs}. Inbound that gives TO, and the needle points to the course.','Still inn kursen du flyr, {crs}. Inn mot stasjonen gir det TO, og nålen peker mot kursen.')},
 nocrs:{h:t2('Course not set','Kursen ikke innstilt'),w:t2('The OBS did not show the course for a long time.','OBS viste ikke kursen på lang tid.'),d:t2('Set the course before anything else: then every needle movement means something.','Still inn kursen før noe annet: da betyr hver nålbevegelse noe.')},
 outside:{h:t2('Off course','Utenfor kurs'),w:t2('You were {e}° off the course, outside the ±5° limit.','Du var {e}° fra kursen, utenfor grensen på ±5°.'),
  d:t2('Correct early, at one dot: 5° to 10° towards the needle, then hold and watch.','Korriger tidlig, ved én prikk: 5° til 10° mot nålen, hold og se.')},
 drift:{h:t2('Wind drift','Vindavdrift'),w:t2('You flew the course as a heading, and the wind carried you {e}° off.','Du fløy kursen som kurs uten korreksjon, og vinden tok deg {e}° ut.'),
  d:t2('Hold a heading into the wind. When the needle stays still, that heading is your answer.','Hold en kurs opp mot vinden. Når nålen står i ro, har du funnet riktig kurs.')},
 away:{h:t2('Turned away from the needle','Svingte vekk fra nålen'),w:t2('The needle was {side} and you flew further away from the course.','Nålen var til {side}, og du fløy lenger vekk fra kursen.'),
  d:t2('Turn towards the needle: needle {side}, turn {side}.','Sving mot nålen: nål til {side}, sving til {side}.')},
 alt:{h:t2('Altitude','Høyde'),w:t2('You were {e} ft off {target} ft, outside ±100 ft.','Du var {e} ft fra {target} ft, utenfor ±100 ft.'),d:t2('Include the altimeter in every scan. Catch it at 50 ft.','Ta med høydemåleren i hver skanning. Ta det ved 50 ft.')},
 'orient.recip':{h:t2('The reciprocal','Motsatt retning'),w:t2('You reported {val}, the bearing to the station. You were on radial {truth}.','Du rapporterte {val}, peilingen til stasjonen. Du var på radial {truth}.'),
  d:t2('Centre the needle with FROM, or read the tail of the RMI needle.','Sentrer nålen med FROM, eller les halen av RMI-nålen.')},
 'orient.wrong':{h:t2('Wrong radial','Feil radial'),w:t2('You reported {val}; you were on radial {truth}.','Du rapporterte {val}; du var på radial {truth}.'),d:t2('Centre the needle with a FROM flag, then read the number at the top.','Sentrer nålen med FROM-flagg, og les tallet øverst.')},
 'orient.ok':{h:t2('Correct','Riktig'),w:t2('Radial {truth}.','Radial {truth}.'),d:t2('','')},
 'int.away':{h:t2('Turned away from the course','Svingte vekk fra kursen'),w:t2('The needle was {side}, so the course was on your {side}, and you turned the other way.','Nålen var til {side}, altså lå kursen til {side}, og du svingte den andre veien.'),
  d:t2('Turn towards the needle: the course plus 30° to 45° towards it.','Sving mot nålen: kursen pluss 30° til 45° mot den.')},
 'int.slow':{h:t2('Slow decision','Treg beslutning'),w:t2('It took a long time to set an intercept heading.','Det tok lang tid å sette en interceptkurs.'),d:t2('Decide within 10 s: which side is the needle, then course ± 30° or 45°.','Bestem deg innen 10 s: hvilken side er nålen, så kurs ± 30° eller 45°.')},
 'int.steep':{h:t2('Steep intercept','Bratt interception'),w:t2('The intercept angle was {ang}°.','Interceptvinkelen var {ang}°.'),d:t2('Keep it at 30° to 45°. Steeper angles leave no time to turn on.','Hold den på 30° til 45°. Brattere vinkler gir ikke tid til å svinge inn.')},
 'int.overshoot':{h:t2('Overshoot','Skjøt over'),w:t2('You flew through the course to {e}° on the other side.','Du fløy gjennom kursen til {e}° på den andre siden.'),
  d:t2('Start the turn when the needle starts to move, at 2 to 3 dots, not when it is centred.','Start svingen når nålen begynner å bevege seg, ved 2 til 3 prikker, ikke når den står i midten.')},
 'ndb.homing':{h:t2('Homing instead of tracking','Homing i stedet for tracking'),w:t2('You kept the nose on the needle. The wind pushed you {e}° off the track along a curve.','Du holdt nesen på nålen. Vinden presset deg {e}° ut fra sporet langs en kurve.'),
  d:t2('Turn to regain the track, then hold a heading into the wind with the needle a few degrees off the nose.','Sving for å komme inn på sporet igjen, og hold så en kurs opp mot vinden med nålen noen grader fra nesen.')},
 'arc.wrongdir':{h:t2('Wrong way onto the arc','Feil vei inn på buen'),w:t2('You turned the wrong way onto the arc.','Du svingte feil vei inn på buen.'),d:t2('Turn {dir} off the radial: clockwise the radials increase, anticlockwise they decrease.','Sving til {dir} fra radialen: med klokka øker radialene, mot klokka minker de.')},
 'arc.late':{h:t2('Late onto the arc','Sent inn på buen'),w:t2('You were at {D} NM before the turn: past the arc.','Du var på {D} NM før svingen: forbi buen.'),d:t2('Start the turn about one turn radius early, about 0.6 NM at 120 kt.','Start svingen omtrent én svingradius før, rundt 0,6 NM ved 120 kt.')},
 'arc.out':{h:t2('Off the arc','Utenfor buen'),w:t2('You were {e} NM off the {R} DME arc, outside ±1 NM.','Du var {e} NM fra {R} DME-buen, utenfor ±1 NM.'),
  d:t2('Keep the station on the wingtip. When the DME grows, turn 10° to 20° towards the station.','Hold stasjonen på vingetippen. Når DME-en øker, sving 10° til 20° mot stasjonen.')},
 'arc.missed':{h:t2('Missed the radial','Bommet på radialen'),w:t2('You flew past radial {r1} before turning inbound.','Du fløy forbi radial {r1} før du svingte inn.'),d:t2('Use a lead radial: start the turn a few degrees before.','Bruk en ledende radial: start svingen noen grader før.')},
 'hold.wrongentry':{h:t2('Wrong entry','Feil inngang'),w:t2('Crossing the fix on heading {hdg} you flew a {flown} entry. That heading calls for {entry}{alt}.','Over fiksen på kurs {hdg} fløy du {flown} inngang. Den kursen krever {entry}{alt}.'),
  d:t2('Before the fix, picture your heading and the 70° line, and say the entry out loud.','Før fiksen: se for deg kursen og 70°-linjen, og si inngangen høyt.')},
 'hold.entryok':{h:t2('Entry','Inngang'),w:t2('{flown} entry.','{flown} inngang.'),d:t2('','')},
 'hold.entrytime':{h:t2('Entry leg timing','Tid på inngangslegget'),w:t2('The entry leg lasted {v} s; it should be about {want} s.','Inngangslegget varte {v} s; det skal være rundt {want} s.'),d:t2('Start the clock over the fix, turn back at 1 minute.','Start klokken over fiksen, sving tilbake etter 1 minutt.')},
 'hold.wrongturn':{h:t2('Turned the wrong way','Svingte feil vei'),w:t2('This hold uses {dir} turns, and you turned the other way.','Denne holdingen bruker {dir}svinger, og du svingte den andre veien.'),
  d:t2('Every turn in the hold goes the way in the clearance. Standard is right turns.','Alle svinger i holdingen går veien i klareringen. Standard er høyresvinger.')},
 'hold.nowca':{h:t2('No outbound correction','Ingen korreksjon ut'),w:t2('The outbound heading did not allow for the wind.','Utgående kurs tok ikke hensyn til vinden.'),d:t2('Outbound: three times the inbound correction, the other way, about {hdg}.','Ut: tre ganger den inngående korreksjonen, motsatt vei, rundt {hdg}.')},
 'hold.legshort':{h:t2('Inbound leg short','Kort inngående legg'),w:t2('The inbound leg took {v} s; it should take {want} s.','Inngående legg tok {v} s; det skal ta {want} s.'),d:t2('Fly about {adj} s longer outbound next time.','Fly rundt {adj} s lenger ut neste gang.')},
 'hold.leglong':{h:t2('Inbound leg long','Langt inngående legg'),w:t2('The inbound leg took {v} s; it should take {want} s.','Inngående legg tok {v} s; det skal ta {want} s.'),d:t2('Fly about {adj} s shorter outbound next time.','Fly rundt {adj} s kortere ut neste gang.')},
 'pt.wrong45':{h:t2('45° turn to the wrong side','45°-svingen til feil side'),w:t2('The 45° turn went away from the side on the chart.','45°-svingen gikk vekk fra siden på kartet.'),d:t2('Turn {dir}, to the side on the chart: that is the protected side.','Sving til {dir}, til siden på kartet: det er den beskyttede siden.')},
 'pt.wrong180':{h:t2('180° turn the wrong way','180°-svingen feil vei'),w:t2('The 180° turn went towards the station, out of the protected area.','180°-svingen gikk mot stasjonen, ut av det beskyttede området.'),d:t2('Turn {dir}, the opposite way to the 45° turn.','Sving til {dir}, motsatt vei av 45°-svingen.')},
 'base.wrongturn':{h:t2('Base turn the wrong way','Base turn feil vei'),w:t2('You turned away from the final course.','Du svingte vekk fra sluttkursen.'),d:t2('Turn {dir}, towards the side the outbound leg is offset to.','Sving til {dir}, mot siden legget ut er forskjøvet til.')},
 'app.early':{h:t2('Descent too early','For tidlig nedstigning'),w:t2('You went below {alt} ft before you were allowed to.','Du gikk under {alt} ft før du hadde lov.'),
  d:t2('Hold the published altitude until the FAF, or on an ILS until the glide slope is centred. Then descend.','Hold publisert høyde til FAF, eller på ILS til glidebanen står i midten. Sink så.')},
 'app.low':{h:t2('Below the profile','Under profilen'),w:t2('You were {pa} ft below the profile.','Du var {pa} ft under profilen.'),d:t2('Check the table every mile, and reduce the rate when low.','Sjekk tabellen hver mil, og reduser sinket når du er lav.')},
 'app.high':{h:t2('Above the profile','Over profilen'),w:t2('You were {pa} ft above the profile.','Du var {pa} ft over profilen.'),d:t2('Start down at the FAF at about ground speed × 5 ft/min.','Start ned ved FAF med rundt fart over bakken × 5 ft/min.')},
 'app.belowmda':{h:t2('Below the MDA','Under MDA'),w:t2('You went below the MDA of {mda} ft.','Du gikk under MDA på {mda} ft.'),d:t2('The MDA is a floor: level at or just above it, never below.','MDA er et gulv: plan ut på eller like over den, aldri under.')},
 'app.mapt':{h:t2('Missed approach point','Missed approach-punktet'),w:t2('You reached the missed approach point above the MDA.','Du nådde missed approach-punktet over MDA.'),d:t2('Start down at the FAF and use about ground speed × 5 ft/min.','Start ned ved FAF og bruk rundt fart over bakken × 5 ft/min.')},
 'ils.overshoot':{h:t2('Through the localiser','Gjennom localiseren'),w:t2('You flew through the localiser.','Du fløy gjennom localiseren.'),d:t2('Turn onto the course as soon as the needle comes alive: it moves fast.','Sving inn på kursen så snart nålen blir levende: den beveger seg fort.')},
 'ils.loclimit':{h:t2('Localiser limit','Localisergrense'),w:t2('Localiser deviation reached {d} dots, beyond half scale.','Localiseravviket nådde {d} prikker, mer enn halvt utslag.'),d:t2('Fly the localiser with 2° to 3° corrections, early.','Fly localiseren med korreksjoner på 2° til 3°, tidlig.')},
 'ils.gslimit':{h:t2('Glide slope limit','Glidebanegrense'),w:t2('Glide slope deviation reached {d} dots, beyond half scale.','Glidebaneavviket nådde {d} prikker, mer enn halvt utslag.'),d:t2('Change the descent rate by 100 to 200 ft/min and watch the needle.','Endre sinket med 100 til 200 ft/min og følg nålen.')},
 'int.angle':{h:t2('Different intercept angle','Annen interceptvinkel'),w:t2('You intercepted at {ang}°; the task asked for {want}°.','Du fanget med {ang}°; oppgaven ba om {want}°.'),d:t2('Course ± {want}° towards the needle.','Kurs ± {want}° mot nålen.')},
 'hold.dmepast':{h:t2('Past the DME limit','Forbi DME-grensen'),w:t2('The outbound leg went past {D} DME.','Utgående legg gikk forbi {D} DME.'),d:t2('Watch the DME outbound and start the turn at the limit.','Følg DME-en ut og start svingen ved grensen.')},
 'miss.late':{h:t2('Late go-around','Sen go-around'),w:t2('You did not start climbing within about 10 s of the minimums.','Du startet ikke stigningen innen rundt 10 s etter minima.'),d:t2('At the minimums without the runway: power, pitch up, climb. Say “go around” out loud.','Ved minima uten rullebanen: kraft, nesen opp, stig. Si «go around» høyt.')},
 'miss.below':{h:t2('Below the minimums','Under minima'),w:t2('You went well below {mins} ft before climbing.','Du gikk godt under {mins} ft før du steg.'),d:t2('Start the go-around at the minimums, not after.','Start go-around ved minima, ikke etter.')},
 'miss.early':{h:t2('Early turn','Tidlig sving'),w:t2('You turned before {ta} ft.','Du svingte før {ta} ft.'),d:t2('Climb straight ahead to the turn altitude first.','Stig rett frem til svinghøyden først.')},
 'miss.wrongturn':{h:t2('Missed approach turn the wrong way','Missed approach-sving feil vei'),w:t2('The missed approach turns {dir}; you turned the other way.','Missed approach svinger til {dir}; du svingte den andre veien.'),d:t2('Brief the missed approach before the FAF: turn direction, heading, altitude.','Brief missed approach før FAF: svingretning, kurs, høyde.')},
 'miss.incomplete':{h:t2('Missed approach not flown','Missed approach ikke fløyet'),w:t2('The missed approach turn never came.','Svingen i missed approach kom aldri.'),d:t2('After the turn altitude, turn to the published heading.','Etter svinghøyden svinger du til publisert kurs.')},
 'rt.off':{h:t2('Off the route','Utenfor ruten'),w:t2('You were {e} NM {side} of the leg, beyond 0.5 NM.','Du var {e} NM til {side} for legget, mer enn 0,5 NM.'),d:t2('Keep the course bar centred: small corrections towards it.','Hold kursstreken i midten: små korreksjoner mot den.')},
 'rt.constraint':{h:t2('Altitude constraint missed','Høydekrav ikke møtt'),w:t2('You crossed {wp} at {was} ft; it needed {cw} {alt} ft.','Du krysset {wp} i {was} ft; den krevde {cw} {alt} ft.'),d:t2('Set the next constraint early and check the distance: 3 NM per 1000 ft down, about 2 NM per 1000 ft up.','Still inn neste krav tidlig og sjekk avstanden: 3 NM per 1000 ft ned, rundt 2 NM per 1000 ft opp.')},
 'pass.early':{h:t2('Passage reported early','Passering rapportert for tidlig'),w:t2('You reported station passage {d} NM before the station.','Du rapporterte stasjonspassering {d} NM før stasjonen.'),d:t2('Wait for the flag to flip from TO to FROM. A lively needle alone is not passage.','Vent til flagget skifter fra TO til FROM. En urolig nål alene er ikke passering.')},
 'pass.late':{h:t2('Passage not reported','Passering ikke rapportert'),w:t2('The station passed and no report came.','Stasjonen ble passert uten rapport.'),d:t2('Keep an eye on the flag as the DME goes low.','Følg med på flagget når DME-en blir lav.')},
 'pass.ok':{h:t2('Passage','Passering'),w:t2('Reported.','Rapportert.'),d:t2('','')},
 'pass.turnearly':{h:t2('Turned before the station','Svingte før stasjonen'),w:t2('You left the course before the station.','Du forlot kursen før stasjonen.'),d:t2('Hold the heading until the flag shows FROM, then intercept the new radial.','Hold kursen til flagget viser FROM, og fang så den nye radialen.')},
 'tts.wrong':{h:t2('Time to station','Tid til stasjonen'),w:t2('You reported {val} min; it was about {truth} min.','Du rapporterte {val} min; det var rundt {truth} min.'),d:t2('Minutes = seconds ÷ degrees. 90 s for 10° is 9 min, not 90.','Minutter = sekunder ÷ grader. 90 s for 10° er 9 min, ikke 90.')},
 'tts.ok':{h:t2('Time to station','Tid til stasjonen'),w:t2('{val} min (about {truth}).','{val} min (rundt {truth}).'),d:t2('','')},
 'tts.slow':{h:t2('No report','Ingen rapport'),w:t2('The bearing changed 40° without a report.','Peilingen endret seg 40° uten rapport.'),d:t2('Start the stopwatch at once; report after 10°.','Start stoppeklokken med en gang; rapporter etter 10°.')},
 'math.wrong':{h:t2('Wrong answer','Feil svar'),w:t2('You answered {val}; the answer is {ans}.','Du svarte {val}; svaret er {ans}.'),d:t2('','')},
 'math.ok':{h:t2('Right','Riktig'),w:t2('{ans}.','{ans}.'),d:t2('','')},
 timeout:{h:t2('Out of time','Tiden ute'),w:t2('The run ended before the task was done.','Øvelsen tok slutt før oppgaven var ferdig.'),d:t2('Follow the coach line step by step, or watch “Show me” first.','Følg coach-linjen steg for steg, eller se «Vis meg» først.')}
};

/* parameters → words */
function pw(p,raw){ const o=Object.assign({},p);
  if(o.side) o.side=sideW(o.side);
  if(o.dir!==undefined) o.dir=dirW(o.dir);
  if(o.entry) o.entry=L(W.entry[o.entry]||W.entry.unclear);
  if(o.flown) o.flown=L(W.entry[o.flown]||W.entry.unclear);
  if(o.alt===null) o.alt=''; else if(typeof o.alt==='string'&&W.entry[o.alt]) o.alt=no()?` (eller ${L(W.entry[o.alt])})`:` (or ${L(W.entry[o.alt])})`;
  if(o.wca!==undefined&&typeof o.wca==='number'){ const w=o.wca; o.wca= Math.abs(w)<1? '' : no()? `, ${Math.abs(w)}° til ${sideW(w>0?'R':'L')} for kursen: det er vindkorreksjonen` : `, ${Math.abs(w)}° ${sideW(w>0?'R':'L')} of the course: that is your wind correction`; }
  if(!raw) ['obs','crs','val','truth','hdg','qdm','r1','inb','out','ro','td','b'].forEach(k=>{ if(typeof o[k]==='number') o[k]=d3(o[k]); });
  if(typeof o.e==='number') o.e=String(Math.abs(o.e)).replace('.',no()?',':'.');
  if(typeof o.lead==='number') o.lead=String(o.lead).replace('.',no()?',':'.');
  if(typeof o.D==='number') o.D=String(o.D).replace('.',no()?',':'.');
  if(typeof o.adj==='number') o.adj=Math.abs(o.adj);
  if(o.t==='ge'||o.t==='le'||o.t==='at') o.cw=L({ge:t2('at or above','i eller over'),le:t2('at or below','i eller under'),at:t2('at','i')}[o.t]);
  if(raw&&typeof o.truth==='number') o.truth=String(o.truth).replace('.',no()?',':'.');
  if(typeof o.ans==='number') o.ans=String(o.ans).replace('.',no()?',':'.')+(o.unit&&o.unit!=='°'?' '+o.unit:'');
  if(typeof o.val==='number') o.val=String(o.val).replace('.',no()?',':'.');
  return o; }
const fmt=(o,p)=>L(o).replace(/\{(\w+)\}/g,(m,k)=>{ const v=p[k]; return v===undefined||v===null?'':String(v); });


/* ---------- clearances, in plain ATC phrasing (callsign Student 12) ---------- */
function clearance(X,A,ex){ const T=X.task, st=A.ST[T.st||T.ils], c={en:'',no:''}, cs='Student 12, ', alt=a=>`${Math.round(a)} ft`, id=ex;
  const fx=T.fx?T.fx.id+' ('+(st?st.id:'')+' '+d3(norm(T.inb+180))+'/'+T.D+')':st?st.id:'';
  switch(id){
    case 'orient': { const k=Math.min(T.n,(S.J&&S.J.qi||0)+1), what=T.kind==='rbi'?t2('your bearing to','peilingen din til'):t2('your radial from','radialen din fra');
      c.en=`${cs}report ${what.en} ${st.id}. Position ${k} of ${T.n}.`; c.no=`${cs}rapporter ${what.no} ${st.id}. Posisjon ${k} av ${T.n}.`; break; }
    case 'trackIn': case 'pass': c.en=`${cs}track inbound to ${st.id} on course ${d3(T.crs)}, maintain ${alt(T.alt)}${id==='pass'?', report station passage':''}.`; c.no=`${cs}følg kurs ${d3(T.crs)} inn til ${st.id}, hold ${alt(T.alt)}${id==='pass'?', rapporter stasjonspassering':''}.`; break;
    case 'trackOut': c.en=`${cs}track outbound from ${st.id} on radial ${d3(T.crs)} to ${T.to} DME, maintain ${alt(T.alt)}.`; c.no=`${cs}følg radial ${d3(T.crs)} ut fra ${st.id} til ${T.to} DME, hold ${alt(T.alt)}.`; break;
    case 'tts': c.en=`${cs}report your time to ${st.id}. Maintain ${alt(T.alt)}.`; c.no=`${cs}rapporter tiden din til ${st.id}. Hold ${alt(T.alt)}.`; break;
    case 'intIn': c.en=`${cs}intercept ${T.ndb?'QDM':'course'} ${d3(T.crs)} inbound to ${st.id}${T.ang?`, ${T.ang}° intercept`:''}, maintain ${alt(T.alt)}.`; c.no=`${cs}fang ${T.ndb?'QDM':'kurs'} ${d3(T.crs)} inn til ${st.id}${T.ang?`, interception på ${T.ang}°`:''}, hold ${alt(T.alt)}.`; break;
    case 'intOut': c.en=`${cs}intercept ${T.ndb?'QDR':'radial'} ${d3(T.crs)} outbound from ${st.id}${T.ang?`, ${T.ang}° intercept`:''}, maintain ${alt(T.alt)}.`; c.no=`${cs}fang ${T.ndb?'QDR':'radial'} ${d3(T.crs)} ut fra ${st.id}${T.ang?`, interception på ${T.ang}°`:''}, hold ${alt(T.alt)}.`; break;
    case 'intPass': c.en=`${cs}track ${d3(T.c0)} to ${st.id}, after ${st.id} intercept radial ${d3(T.crs)} outbound, maintain ${alt(T.alt)}.`; c.no=`${cs}følg ${d3(T.c0)} til ${st.id}, etter ${st.id} fang radial ${d3(T.crs)} ut, hold ${alt(T.alt)}.`; break;
    case 'locInt': c.en=`${cs}fly heading ${d3(X.ac.hdg)}, maintain ${alt(T.alt)}, intercept the localiser ${d3(T.crs)}.`; c.no=`${cs}fly kurs ${d3(X.ac.hdg)}, hold ${alt(T.alt)}, fang localiseren ${d3(T.crs)}.`; break;
    case 'ndb': c.en=`${cs}track inbound to ${st.id} on QDM ${d3(T.crs)}, maintain ${alt(T.alt)}.`; c.no=`${cs}følg QDM ${d3(T.crs)} inn til ${st.id}, hold ${alt(T.alt)}.`; break;
    case 'ndbOut': c.en=`${cs}track outbound from ${st.id} on QDR ${d3(T.crs)} for ${T.to} NM, maintain ${alt(T.alt)}.`; c.no=`${cs}følg QDR ${d3(T.crs)} ut fra ${st.id} i ${T.to} NM, hold ${alt(T.alt)}.`; break;
    case 'dme': { const cw=T.dir>0?t2('clockwise','med klokka'):t2('anticlockwise','mot klokka');
      if(T.part==='leave'){ c.en=`${cs}continue the ${T.R} DME arc ${cw.en}, intercept radial ${d3(T.r1)} inbound.`; c.no=`${cs}fortsett ${T.R} DME-buen ${cw.no}, fang radial ${d3(T.r1)} inn.`; }
      else if(T.part==='join'){ c.en=`${cs}track outbound radial ${d3(T.r0)}, join the ${T.R} DME arc ${cw.en}.`; c.no=`${cs}følg radial ${d3(T.r0)} ut, gå inn på ${T.R} DME-buen ${cw.no}.`; }
      else { c.en=`${cs}track outbound radial ${d3(T.r0)}, join the ${T.R} DME arc ${cw.en}, intercept radial ${d3(T.r1)} inbound.`; c.no=`${cs}følg radial ${d3(T.r0)} ut, gå inn på ${T.R} DME-buen ${cw.no}, fang radial ${d3(T.r1)} inn.`; } break; }
    case 'holdEntry': case 'hold': { const turns=T.dir>0?t2('right turns','høyresvinger'):t2('left turns','venstresvinger'), leg=T.dmeLim?t2(`outbound limit ${T.dmeLim} DME`,`utgående grense ${T.dmeLim} DME`):t2('one-minute legs','legg på ett minutt');
      const what=T.kind==='ndb'?t2(`on ${st.id}, inbound QDM ${d3(T.inb)}`,`ved ${st.id}, inngående QDM ${d3(T.inb)}`):t2(`on the ${d3(T.out)} radial${T.fx?' at '+T.D+' DME':''}, inbound course ${d3(T.inb)}`,`på radial ${d3(T.out)}${T.fx?' ved '+T.D+' DME':''}, inngående kurs ${d3(T.inb)}`);
      const head=T.race?t2(`proceed direct ${fx}, racetrack procedure`,`direkte ${fx}, racetrack-prosedyre`):id==='hold'?t2('hold','hold'):t2(`proceed direct ${fx}, hold`,`direkte ${fx}, hold`);
      c.en=`${cs}${head.en} ${what.en}, ${turns.en}, ${leg.en}, maintain ${alt(T.alt)}.${id==='hold'?` ${T.laps} pattern${T.laps>1?'s':''}.`:''}`;
      c.no=`${cs}${head.no} ${what.no}, ${turns.no}, ${leg.no}, hold ${alt(T.alt)}.${id==='hold'?` ${T.laps} runde${T.laps>1?'r':''}.`:''}`; break; }
    case 'pt': { const a=T.a||45, b=a===80?260:180; c.en=`${cs}outbound radial ${d3(T.out)} 1 min, procedure turn ${a}°/${b}° ${T.side>0?'right':'left'} ${d3(norm(T.out+T.side*a))}, inbound course ${d3(T.inb)}, maintain ${alt(T.alt)}.`;
      c.no=`${cs}radial ${d3(T.out)} ut 1 min, prosedyresving ${a}°/${b}° ${T.side>0?'høyre':'venstre'} ${d3(norm(T.out+T.side*a))}, inngående kurs ${d3(T.inb)}, hold ${alt(T.alt)}.`; break; }
    case 'base': c.en=`${cs}outbound radial ${d3(T.ro)} 2 min, base turn ${T.turn>0?'right':'left'}, inbound course ${d3(T.inb)}, maintain ${alt(T.alt)}.`;
      c.no=`${cs}radial ${d3(T.ro)} ut 2 min, base turn ${T.turn>0?'høyre':'venstre'}, inngående kurs ${d3(T.inb)}, hold ${alt(T.alt)}.`; break;
    case 'vordme': case 'ils': case 'vorApp': case 'ndbApp': case 'locApp': case 'lnav': case 'lnavVnav': case 'lpv': {
      const M=T.miss, nm={vordme:'VOR/DME',ils:'ILS',vorApp:'VOR',ndbApp:'NDB',locApp:'LOC',lnav:'RNP (LNAV)',lnavVnav:'RNP (LNAV/VNAV)',lpv:'RNP (LPV)'}[id], mins=T.da?`DA ${T.da} ft`:`MDA ${T.mda||T.mins} ft`;
      const mEn=M?` Missed approach: climb straight ahead to ${M.ta} ft, turn ${M.dir>0?'right':'left'} heading ${d3(M.hdg)}, climb ${M.alt} ft.`:'', mNo=M?` Missed approach: stig rett frem til ${M.ta} ft, sving ${M.dir>0?'høyre':'venstre'} kurs ${d3(M.hdg)}, stig til ${M.alt} ft.`:'';
      if(id==='ils'){ c.en=`${cs}fly heading ${d3(X.ac.hdg)}, maintain ${alt(T.alt)} until established, cleared ILS, course ${d3(T.crs)}. ${mins}.${mEn}`; c.no=`${cs}fly kurs ${d3(X.ac.hdg)}, hold ${alt(T.alt)} til etablert, klarert ILS, kurs ${d3(T.crs)}. ${mins}.${mNo}`; }
      else { c.en=`${cs}cleared ${nm} approach, final course ${d3(T.crs)}. ${mins}.${mEn}`; c.no=`${cs}klarert ${nm}-innflyging, sluttkurs ${d3(T.crs)}. ${mins}.${mNo}`; } break; }
    case 'sid': case 'star': { const wp=T.wps.map(w=>w.id+(w.c?` ${w.c.t==='ge'?'+':w.c.t==='le'?'−':''}${w.c.alt}`:'')).join(', ');
      c.en=`${cs}${id==='sid'?'cleared '+T.name+' departure, climb':'cleared '+T.name+' arrival, descend'} ${alt(T.alt)} (${wp}).`; c.no=`${cs}${id==='sid'?'klarert '+T.name+'-utflyging, stig til':'klarert '+T.name+'-innflygingsrute, sink til'} ${alt(T.alt)} (${wp}).`; break; }
    case 'math': c.en=`${T.n} quick questions. Work them out in your head, then type the answer.`; c.no=`${T.n} raske spørsmål. Regn i hodet, og skriv svaret.`; break;
  }
  return c; }

/* ---------- areas, progress, remembered settings ---------- */
const AREAS={practice:I.practiceArea(),bergen:I.realArea('bergen',NM.build('bergen')),oslo:I.realArea('oslo',NM.build('oslo'))};
const PK='bb-ifr-v2', BK='bb-ifr-builder';
const load=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
const save=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
let PROG=load(PK)||(()=>{ const v1=load('bb-ifr-v1')||{}; return {ex:v1.ex||{},last:v1.last?{item:v1.last.ex,lv:v1.last.lv,area:v1.last.area}:null}; })(); PROG.ex=PROG.ex||{};
const prog=id=>PROG.ex[id]||null, passed=id=>(PROG.ex[id]&&PROG.ex[id].lv)||0, best=id=>{ const p=PROG.ex[id]; if(!p||!p.best) return null; const v=Object.values(p.best); return v.length?Math.max(...v):null; };
/* the short recommended path shown first; everything else behind "Show all" */
const CORE=['orient','trackIn','intIn','ndb','holdEntry','hold','vordme','ils'];

/* ---------- state ---------- */
const S={item:'orient',ex:'orient',p:{},custom:false,lv:1,area:'practice',step:'understand',inst:null,seed:1,X:null,sim:null,J:null,P:null,GP:null,gc:null,
  run:false,started:false,paused:false,speed:1,demo:false,mistake:false,log:[],watch:{on:false,t:0},help:PROG.help||'guided',hint:0,hintK:null,hintsUsed:0,showWhy:false,
  moments:{},pause:null,peeks:0,peek:false,think:null,thinkAns:null,res:null,ideal:null,scrub:0,replay:false,mapOpen:false,u:null,uStep:0,uT:0,clrOpen:false,
  gTh:null,gIdx:0,tt:null,last:null};
const A=()=>AREAS[S.area], EXo=()=>I.EX[S.ex], ITo=()=>I.ITEM[S.item]||{id:S.item,ex:S.ex,p:{},d:2,g:'basics'};
const allowed=(ex,ar)=>{ const e=I.EX[ex]; return !e.needs||!!AREAS[ar].plan[e.needs]; };
const isApp=ex=>['vordme','ils','vorApp','ndbApp','locApp','lnav','lnavVnav','lpv'].indexOf(ex)>=0;
const isRoute=ex=>ex==='sid'||ex==='star';
const isQuiz=ex=>ex==='orient'||ex==='math'||ex==='tts'||ex==='pass';

/* ---------- gauges ---------- */
const GA={}; ['cdi','hsi','rmi','adf','dg'].forEach(k=>{ GA[k]=NAVG.make(q(`[data-g="${k}"] canvas`),k); });
const pfdC=q('[data-g="pfd"] canvas'), pfdG=pfdC.getContext('2d'), cmpC=q('[data-g="cmp"] canvas'), cmpG=cmpC.getContext('2d');
const SET={cdi:['cdi','dg'],rbi:['adf','dg'],hsi:['hsi'],rmi:['rmi'],pfd:['pfd']};
const SETPP={cdi:['cdi','cmp'],rbi:['adf','cmp']};
const kindsNow=()=>(S.X&&S.X.pp?SETPP[S.inst]:SET[S.inst])||['cdi'];
/* which instruments make sense for this run: no VOR → no CDI/HSI; no NDB → no RBI; partial panel → only the needle instruments with the compass */
function instOk(k){ const X=S.X, ex=EXo(); if(!X||ex.inst.indexOf(k)<0) return false;
  if(X.pp) return k==='cdi'?!!X.nav:k==='rbi'?!!X.adf:false;
  if(k==='rbi') return !!X.adf; if(k==='cdi'||k==='hsi') return !!X.nav||isRoute(S.ex); if(k==='rmi') return !!X.adf||(!!X.nav&&!isRoute(S.ex)&&A().ST[X.nav]&&A().ST[X.nav].type==='VOR'); return true; }
function pickInst(){ const X=S.X, ex=EXo(), it=ITo(); const want=[S.instWant,it.inst,ex.def].concat(ex.inst).filter(Boolean);
  S.inst=want.find(k=>instOk(k))||'cdi'; }
let pfdW=0,pfdH=0,pfdDpr=1, cmpW=0,cmpH=0;
function sizePFD(w,h){ pfdDpr=Math.min(devicePixelRatio||1,2.5); pfdW=w; pfdH=h; pfdC.width=Math.round(w*pfdDpr); pfdC.height=Math.round(h*pfdDpr); }
function sizeCmp(w,h){ const d=Math.min(devicePixelRatio||1,2.5); cmpW=w; cmpH=h; cmpC.width=Math.round(w*d); cmpC.height=Math.round(h*d); cmpC.style.width=w+'px'; cmpC.style.height=h+'px'; cmpG.setTransform(d,0,0,d,0,0); }
function layoutInst(){ const box=el('inst'), narrow=innerWidth<980, kinds=kindsNow();
  qa('#inst .g').forEach(g=>g.hidden=kinds.indexOf(g.dataset.g)<0);
  const W=box.clientWidth; let Hh=box.clientHeight; const phone=narrow&&W<520;
  box.classList.toggle('stack',phone&&kinds.length>1);
  if(narrow){ Hh= S.inst==='pfd'? Math.min(540,W*1.12) : kinds.length>1? (phone? Math.min(W,330)+12+Math.min(W*0.56,190) : Math.min(W/1.62,380)) : Math.min(W,phone?340:430);
    if(S.step==='debrief') Hh=Math.min(Hh,phone?400:300); if(innerHeight<560) Hh=Math.min(Hh,Math.max(220,innerHeight-120)); box.style.height=Math.round(Hh)+'px'; }
  else box.style.height='';
  if(!W||!Hh) return;
  const set=(k,w,h)=>{ const g=q(`[data-g="${k}"]`); if(k==='cmp'){ sizeCmp(Math.floor(w),Math.floor(h||w*0.42)); return; } const c=g.querySelector('canvas'); c.style.width=Math.floor(w)+'px'; c.style.height=Math.floor(h||w)+'px';
    const t=g.querySelector('canvas.tg'); if(t){ const d=Math.min(devicePixelRatio||1,2); t.style.width=c.style.width; t.style.height=c.style.height; t.width=Math.floor(w)*d; t.height=Math.floor(h||w)*d; } };
  if(S.inst==='pfd'){ const w=Math.min(W,Hh/1.12); set('pfd',w,w*1.12); sizePFD(w,w*1.12); }
  else if(kinds.length>1&&phone){ const s1=Math.min(W,330,(Hh-12)/1.56); set(kinds[0],s1); set(kinds[1],s1*0.56,kinds[1]==='cmp'?s1*0.3:null); }
  else if(kinds.length>1){ let s1,s2; if(W<560||narrow){ s1=Math.min(Hh,(W-12)/1.62); s2=s1*0.62; } else { s1=Math.min(Hh,(W-16)/1.62); s2=Math.min(s1*0.62,W-16-s1); } set(kinds[0],s1); set(kinds[1],s2,kinds[1]==='cmp'?s2*0.55:null); }
  else set(kinds[0],Math.min(W,Hh));
}

/* ---------- maps: the trainer's and the builder's preview ---------- */
const mapC=el('map'), mapG=mapC.getContext('2d'), baseC=document.createElement('canvas'), baseG=baseC.getContext('2d');
const map=NM.create(mapC,{onLoad:()=>{ baseDirty=true; bDirty=true; }});
let MW=0,MH=0,dpr=1,baseDirty=true;
function sizeMap(){ const r=mapC.getBoundingClientRect(); MW=Math.max(1,Math.round(r.width)); MH=Math.max(1,Math.round(r.height)); dpr=Math.min(devicePixelRatio||1,2);
  for(const c of [mapC,baseC]){ c.width=Math.round(MW*dpr); c.height=Math.round(MH*dpr); } fitView(); baseDirty=true; }
let viewPts=null;
function fitView(pts){ if(pts) viewPts=pts; const P=viewPts||(S.X?S.X.box:[{x:0,y:0}]); if(MW<80||MH<80) return;
  const b={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity}; P.forEach(p=>{ b.x0=Math.min(b.x0,p.x); b.x1=Math.max(b.x1,p.x); b.y0=Math.min(b.y0,p.y); b.y1=Math.max(b.y1,p.y); });
  map.set(NM.fit(b,MW,MH,{l:40,r:40,t:46,b:40},{pad:1.6,min:7,maxK:220})); baseDirty=true; }
function keepInView(x,y){ if(MW<80||MH<80) return; map.P(x,y); if(map.sx<24||map.sy<24||map.sx>MW-24||map.sy>MH-24){ fitView((viewPts||S.X.box).concat([{x,y}])); } }

/* drawing helpers that take the map they draw on */
function line(m,g,a,b,col,w,dash){ m.P(a.x,a.y); const x1=m.sx,y1=m.sy; m.P(b.x,b.y); g.strokeStyle=col; g.lineWidth=w||2; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(m.sx,m.sy); g.stroke(); g.setLineDash([]); }
function crsLine(m,g,st,brg,from,to,col,lab,fly){ const a=I.at(st,brg,from), b=I.at(st,brg,to); line(m,g,a,b,col,2.2); const mm=I.at(st,brg,from+(to-from)*0.45); m.P(mm.x,mm.y); m.arrowHead(g,m.sx,m.sy,m.sa(fly===undefined?brg:fly),8,col); if(lab) m.label(m.sx,m.sy,lab,col); }
function drawStation(m,g,s,sel){ m.drawNavaid(g,s,sel); m.P(s.x,s.y); m.label(m.sx,m.sy,`${s.id} ${s.type==='NDB'?s.f:s.f.toFixed(2)}`,s.type==='NDB'?COL.ndb:COL.vor); }
/* the clean holding entry sectors round the fix: 70° teardrop, 110° parallel, 180° direct (where you arrive from), with the sector lines */
function drawSectors(m,g,F,inb,dir,R){ const S0=I.holdSectors(inb,dir); m.P(F.x,F.y); const cx=m.sx, cy=m.sy, rp=R*m.v.k;
  g.save(); g.fillStyle='rgba(11,18,23,.55)'; g.beginPath(); g.arc(cx,cy,rp+2,0,TAU); g.fill();
  for(const sc of S0){ const a0=m.sa(sc.from)-Math.PI/2, span=(norm(sc.to-sc.from)||360)*D2R;
    g.fillStyle=COL[sc.entry]; g.globalAlpha=0.2; g.beginPath(); g.moveTo(cx,cy); g.arc(cx,cy,rp,a0,a0+span); g.closePath(); g.fill(); g.globalAlpha=1;
    g.strokeStyle=COL[sc.entry]; g.lineWidth=2.5; g.beginPath(); g.arc(cx,cy,rp-1.5,a0+0.02,a0+span-0.02); g.stroke();
    const mid=sc.from+(norm(sc.to-sc.from)||360)/2, lp=I.at(F,mid,R*0.62); m.P(lp.x,lp.y);
    g.font=`650 13px ${FB}`; g.fillStyle=COL[sc.entry]; g.textAlign='center'; g.textBaseline='middle'; const nm=L(W.entry[sc.entry]); g.fillText(nm.charAt(0).toUpperCase()+nm.slice(1),m.sx,m.sy-7);
    g.font=`500 11.5px ${FM}`; g.fillStyle='rgba(230,235,239,.75)'; g.fillText(sc.size+'°',m.sx,m.sy+8); }
  /* sector lines: the inbound course through the fix, the 70° line */
  const b1=[inb,norm(inb+180)], b2=[norm(inb-dir*70),norm(inb-dir*70+180)];
  for(const [p,q2] of [b1,b2]) line(m,g,I.at(F,p,R),I.at(F,q2,R),'rgba(230,235,239,.7)',1.3,[5,4]);
  g.restore(); }
/* the exercise's chart geometry */
function drawGeom(m,g,X,Ar,id,W0,H0,opt){ opt=opt||{}; const T=X.task, C=COL.crs, st=Ar.ST[T.st||X.nav]||null;
  if(st&&st.dme&&['orient','dme','vordme','trackIn','trackOut','intIn','intOut','pass','tts','intPass'].indexOf(id)>=0) m.drawRings(g,st.x,st.y,5,30,135);
  switch(id){
    case 'trackIn': case 'intIn': case 'pass': crsLine(m,g,st,norm(T.crs+180),22,0,C,(T.ndb?'QDM ':'')+d3(T.crs)+'°',T.crs); break;
    case 'trackOut': case 'intOut': crsLine(m,g,st,T.crs,0,(T.to||14)+2,C,(T.ndb?'QDR ':'R')+d3(T.crs)); break;
    case 'intPass': crsLine(m,g,st,norm(T.c0+180),8,0,'rgba(240,107,180,.55)',d3(T.c0)+'°',T.c0); crsLine(m,g,st,T.crs,0,(T.to||12)+2,C,'R'+d3(T.crs)); break;
    case 'ndb': crsLine(m,g,st,norm(T.crs+180),20,0,C,'QDM '+d3(T.crs),T.crs); break;
    case 'ndbOut': crsLine(m,g,st,T.crs,0,(T.to||12)+2,C,'QDR '+d3(T.crs)); break;
    case 'tts': { const p=I.at(st,T.rad,30); line(m,g,st,p,'rgba(99,217,160,.25)',1); break; }
    case 'dme': { if(T.part!=='leave') crsLine(m,g,st,T.r0,0,T.R,C,'R'+d3(T.r0)); const sw=diff(T.r1,T.r0); g.strokeStyle=C; g.lineWidth=2.2; g.beginPath(); for(let i=0;i<=48;i++){ const p=I.at(st,T.r0+sw*i/48,T.R); m.P(p.x,p.y); if(i) g.lineTo(m.sx,m.sy); else g.moveTo(m.sx,m.sy); } g.stroke();
      if(T.part!=='join'){ const b=I.at(st,T.r1,T.R); line(m,g,b,st,C,2.2); const mm=I.at(st,T.r1,T.R*0.5); m.P(mm.x,mm.y); m.arrowHead(g,m.sx,m.sy,m.sa(T.crsIn),8,C); m.label(m.sx,m.sy,'R'+d3(T.r1),C); }
      const ma=I.at(st,T.r0+sw/2,T.R); m.P(ma.x,ma.y); m.label(m.sx,m.sy,`${T.R} DME`,C); break; }
    case 'holdEntry': case 'hold': { const F=I.fixOf(Ar,T), tas=I.tasOf(120,T.alt); m.racetrack(g,F,T.inb,T.dir,N.turnRadius(tas),T.dmeLim?Math.max(2,T.dmeLim-(T.D||0)):tas/60*T.legS/60,{col:COL.hold,lw:2,arrow:'mid'});
      if(T.fx){ m.P(F.x,F.y); m.drawFix(g,m.sx,m.sy,'#E6EBEF'); m.label(m.sx,m.sy,F.id,'#E6EBEF'); line(m,g,st,F,'rgba(99,217,160,.35)',1,[3,4]); }
      if(T.dmeLim&&st){ g.strokeStyle='rgba(240,180,64,.6)'; g.lineWidth=1.2; g.setLineDash([4,4]); m.P(st.x,st.y); g.beginPath(); g.arc(m.sx,m.sy,T.dmeLim*m.v.k,0,TAU); g.stroke(); g.setLineDash([]); } break; }
    case 'pt': { const a=T.a||45; crsLine(m,g,st,T.out,0,6,C,'R'+d3(T.out)); const p0=I.at(st,T.out,3.2), p1=I.at(p0,norm(T.out+T.side*a),a===80?1:2); line(m,g,p0,p1,C,2); m.P(p1.x,p1.y); m.arrowHead(g,m.sx,m.sy,m.sa(norm(T.out+T.side*a)),7,C);
      const p2=I.at(p1,a===80?T.inb:norm(T.inb+T.side*45),1.6); line(m,g,p1,p2,C,1.6,[5,4]); m.P(p2.x,p2.y); m.arrowHead(g,m.sx,m.sy,m.sa(a===80?T.inb:norm(T.inb+T.side*45)),7,C); m.P(p1.x,p1.y); m.label(m.sx,m.sy,d3(norm(T.out+T.side*a))+'°',C); break; }
    case 'base': { crsLine(m,g,st,T.ro,0,6.5,C,'R'+d3(T.ro)); crsLine(m,g,st,norm(T.inb+180),6,0,'rgba(240,107,180,.6)',d3(T.inb)+'°',T.inb); break; }
    case 'vordme': { const ils=Ar.ST[T.ils]; m.drawRunway(g,ils.thr,ils.end); const a=I.at(st,norm(T.crs+180),T.ifD+2); line(m,g,a,ils.thr,C,2.2);
      for(const [d,lab] of [[T.fafD,'FAF D'+T.fafD+' '+T.fafAlt],[T.ifD,'IF D'+T.ifD]]){ const p=I.at(st,norm(T.crs+180),d); m.P(p.x,p.y); m.drawFix(g,m.sx,m.sy,'#E6EBEF'); m.label(m.sx,m.sy,lab,'#E6EBEF'); } drawMissed(m,g,X,Ar,ils); break; }
    case 'ils': case 'locInt': { const ils=Ar.ST[T.ils]; m.drawRunway(g,ils.thr,ils.end); m.drawIls(g,ils,true,{cl:16,label:'LOC '+d3(T.crs)}); if(id==='ils'){ const gi=I.at(ils.thr,norm(T.crs+180),(T.alt-T.elev-50)/318.4); m.P(gi.x,gi.y); m.drawFix(g,m.sx,m.sy,'#7FCBE8'); m.label(m.sx,m.sy,'GS '+T.alt,COL.ils); drawMissed(m,g,X,Ar,ils); } break; }
    case 'vorApp': case 'ndbApp': case 'locApp': case 'lnav': case 'lnavVnav': case 'lpv': { const ils=Ar.ST[T.ils]; m.drawRunway(g,ils.thr,ils.end); const a=I.at(ils.thr,norm(T.crs+180),T.fafD+5); line(m,g,a,ils.thr,C,2.2);
      const f=I.at(ils.thr,norm(T.crs+180),T.fafD); m.P(f.x,f.y); m.drawFix(g,m.sx,m.sy,'#E6EBEF'); m.label(m.sx,m.sy,'FAF '+T.fafAlt,'#E6EBEF'); drawMissed(m,g,X,Ar,ils); break; }
    case 'sid': case 'star': { const pts=[T.p0].concat(T.wps.map(w=>I.wpOf(Ar,w.id))); g.strokeStyle=C; g.lineWidth=2.2; g.beginPath(); pts.forEach((p,i)=>{ m.P(p.x,p.y); if(i) g.lineTo(m.sx,m.sy); else g.moveTo(m.sx,m.sy); }); g.stroke();
      for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i], mm={x:(a.x+b.x)/2,y:(a.y+b.y)/2}; m.P(mm.x,mm.y); m.arrowHead(g,m.sx,m.sy,m.sa(N.bearing(b.x-a.x,b.y-a.y)),7,C); }
      T.wps.forEach(w=>{ const p=I.wpOf(Ar,w.id); m.P(p.x,p.y); if(!Ar.ST[w.id]) m.drawWaypoint(g,m.sx,m.sy,{}); m.label(m.sx,m.sy,w.id+(w.c?` ${w.c.t==='ge'?'↑':w.c.t==='le'?'↓':''}${w.c.alt}`:''),'#E6EBEF'); });
      if(id==='sid'){ const ils=Ar.ST[Ar.plan.ils]; m.drawRunway(g,ils.thr,ils.end); } break; }
  }
  if(id!=='vordme'&&!isApp(id)&&id!=='ils'&&id!=='locInt') Ar.ILS.forEach(i=>m.drawRunway(g,i.thr,i.end));
  Ar.APT.forEach(a=>{ m.P(a.x,a.y); m.drawAirport(g,m.sx,m.sy); });
  Ar.NAV.forEach(n=>{ if(n.type!=='ILS') drawStation(m,g,n,n.id===X.nav||n.id===X.adf||n.id===(T&&T.st)); });
}
/* the missed approach drawn after the runway: straight ahead, then the turn */
function drawMissed(m,g,X,Ar,ils){ const M=X.task.miss; if(!M) return; const a=ils.end, b=I.at(a,M.crs,2.2), c=I.at(b,M.hdg,3); g.save(); g.globalAlpha=0.8;
  line(m,g,a,b,'rgba(230,235,239,.55)',1.6,[6,4]); line(m,g,b,c,'rgba(230,235,239,.55)',1.6,[6,4]); m.P(c.x,c.y); m.arrowHead(g,m.sx,m.sy,m.sa(M.hdg),7,'rgba(230,235,239,.7)'); m.label(m.sx,m.sy,(no()?'Bomløp ':'Missed ')+d3(M.hdg)+' / '+M.alt,'rgba(230,235,239,.8)'); g.restore(); }

/* ---------- pictograms: each group drawn as a small chart symbol ---------- */
function pic(id){ const it=I.ITEM[id]||{g:'basics',ex:id}, e=it.ex, g=it.g; let b='';
  const sw='fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  if(g==='basics') b=`<circle cx="24" cy="24" r="17" ${sw} stroke-width="1.4" opacity=".45"/>${[0,45,90,135,180,225,270,315].map(a=>`<path d="M24 24 L${(24+Math.sin(a*D2R)*17).toFixed(1)} ${(24-Math.cos(a*D2R)*17).toFixed(1)}" ${sw} stroke-width="1.2" opacity=".5"/>`).join('')}<path d="M24 24 L36 12" ${sw}/><circle cx="36" cy="12" r="3" fill="currentColor"/>`;
  else if(g==='track') b=`<path d="M8 40 L36 12" ${sw}/><path d="M28 13 L36 12 L35 20" ${sw}/><path d="M36 8 l4 2.3 v4.6 l-4 2.3 l-4 -2.3 v-4.6z" ${sw} stroke-width="1.6" transform="translate(4 -2)"/>`;
  else if(g==='intercept') b=`<path d="M4 34 H44" ${sw}/><path d="M10 10 L26 26 Q30 34 38 34" ${sw} stroke-dasharray="3 3"/><path d="M38 30 L43 34 L38 38" ${sw}/>`;
  else if(g==='ndb') b=`${[6,11,16].map(r=>`<circle cx="24" cy="24" r="${r}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="0.1 4.2" stroke-linecap="round"/>`).join('')}<circle cx="24" cy="24" r="2.5" fill="currentColor"/>`;
  else if(g==='arc') b=`<path d="M12 40 A26 26 0 0 1 40 12" ${sw}/><path d="M6 44 L20 30 M44 6 L30 20" ${sw} stroke-width="1.4" opacity=".6"/><circle cx="6" cy="44" r="2.5" fill="currentColor"/>`;
  else if(g==='hold') b=e==='holdEntry'&&!it.p.race?`<path d="M18 10 V30 A6 6 0 0 0 30 30 V18 A6 6 0 0 0 18 18" ${sw} opacity=".45"/><path d="M18 10 L8 26 Q6 34 14 34 Q20 33 18 26" ${sw}/><path d="M14 6 L18 10 L22 6" ${sw}/>`:`<path d="M16 12 V32 A7 7 0 0 0 30 32 V16 A7 7 0 0 0 16 16" ${sw}/><path d="M12 16 L16 12 L20 16" ${sw}/><path d="M10 8 h4" ${sw} stroke-width="1.4"/>`;
  else if(g==='rev') b=e==='base'?`<path d="M24 6 V18 L14 40 Q12 46 20 44 Q30 40 26 18" ${sw}/><circle cx="24" cy="6" r="2.5" fill="currentColor"/>`:`<path d="M24 6 V26 L36 36" ${sw}/><path d="M36 36 Q42 42 34 44 Q28 44 24 36" ${sw} stroke-dasharray="3 3"/><circle cx="24" cy="6" r="2.5" fill="currentColor"/>`;
  else if(g==='app') b=`<path d="M6 38 H42" ${sw} stroke-width="1.2" opacity=".5"/><path d="M30 38 H42" ${sw} stroke-width="4"/><path d="M4 14 L30 37" ${sw}/><path d="M4 20 L30 37 M4 8 L30 37" ${sw} stroke-width="1" opacity=".45"/>`;
  else if(g==='route') b=`<path d="M6 40 L18 22 L32 26 L42 8" ${sw}/>${[[18,22],[32,26],[42,8]].map(([x,y])=>`<path d="M${x} ${y-5} L${x+1.6} ${y-1.6} L${x+5} ${y} L${x+1.6} ${y+1.6} L${x} ${y+5} L${x-1.6} ${y+1.6} L${x-5} ${y} L${x-1.6} ${y-1.6}Z" fill="currentColor"/>`).join('')}`;
  else if(g==='math') b=`<text x="24" y="30" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="15" font-weight="600" fill="currentColor">1:60</text><path d="M8 38 H40" ${sw} stroke-width="1.4" opacity=".5"/>`;
  else if(g==='pp') b=`<circle cx="24" cy="24" r="16" ${sw}/><path d="M24 12 L28 24 L24 36 L20 24Z" fill="currentColor" opacity=".55"/><path d="M10 38 L38 10" ${sw} stroke-width="2.4"/>`;
  return `<svg class="pic" viewBox="0 0 48 48" aria-hidden="true">${b}</svg>`; }

/* ---------- home: nudges, the short path, the full catalogue ---------- */
const HS=Object.assign({all:false,g:'all',st:'all'},load('bb-ifr-home')||{});
function recommended(){ return CORE.find(id=>!passed(id))||I.ITEMS.find(it=>!passed(it.id)&&I.itemOk(it,AREAS.practice))?.id||CORE[0]; }
function renderNudge(){ const L0=PROG.last, rec=recommended(), box=el('nudge'); let h='';
  if(L0&&I.ITEM[L0.item]){ h+=`<div class="ncard">${pic(L0.item)}<span class="k">${tx('Continue where you left off','Fortsett der du slapp')}</span><b>${esc(itemName(L0.item))}${L0.custom?` <span style="font-weight:500;color:var(--ink-3);font-size:15px">${tx('(your setup)','(ditt oppsett)')}</span>`:''}</b><button class="btn2" data-go="continue" type="button">${tx('Continue','Fortsett')}</button></div>`; }
  h+=`<div class="ncard go">${pic(rec)}<span class="k">${L0?tx('Recommended next','Anbefalt neste'):tx('New here? Start with this','Ny her? Start med denne')}</span><b>${esc(itemName(rec))}</b><button class="btn2 pri" data-go="${rec}" type="button">${tx('Start','Start')}</button></div>`;
  box.innerHTML=h; box.style.gridTemplateColumns=L0?'':'minmax(0,1fr)';
  box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ if(b.dataset.go==='continue'){ const l=PROG.last; openItem(l.item,{p:l.custom?l.p:null,custom:l.custom,lv:l.lv,area:l.area,seed:l.custom?l.seed:undefined,step:'fly'}); } else openItem(b.dataset.go,{}); }); }
function rowHTML(it,rec){ const p=passed(it.id), bs=best(it.id), ok=I.itemOk(it,AREAS.practice);
  return `<li class="row${rec?' rec':''}" data-id="${it.id}">${pic(it.id)}<div class="tx"><b>${esc(itemName(it.id))}${rec?`<em>${tx('Recommended next','Anbefalt neste')}</em>`:''}</b><span>${esc(L(IT[it.id].s))}</span></div>
    <div class="st"><small>${esc(L(W.diff[it.d]))}</small>${bs===null?'':`<span class="pips" title="${esc(tx('Levels passed','Nivåer bestått'))}: ${p}/4" aria-label="${esc(tx('Levels passed','Nivåer bestått'))}: ${p} / 4">${[1,2,3,4].map(k=>`<i class="${k<=p?'on':''}"></i>`).join('')}</span><small>${tx('Best ','Beste ')+bs}</small>`}</div>
    <div class="acts"><button class="btn2 sm ${rec?'pri':''}" data-start="${it.id}" type="button" ${ok?'':'disabled'}>${tx('Start','Start')}<span class="sr" style="position:absolute;left:-9999px">: ${esc(itemName(it.id))}</span></button><button class="btn2 sm q" data-setup="${it.id}" type="button" title="${esc(tx('Choose course, wind, start …','Velg kurs, vind, start …'))}">${tx('Set up','Sett opp')}</button></div></li>`; }
function renderCat(){ const rec=recommended(), box=el('catList'), fl=el('filters');
  if(!HS.all){ fl.innerHTML=`<div style="display:flex;flex-direction:column;gap:2px"><b style="font-family:var(--f-display);font-stretch:88%;font-size:24px;font-weight:720;color:var(--ink)">${tx('Start here','Start her')}</b><span style="color:var(--ink-2);font-size:14.5px">${tx('Eight core exercises, in the order an instructor would teach them.','Åtte kjerneøvelser, i den rekkefølgen en instruktør ville lært dem bort.')}</span></div>`;
    fl.style.position='static';
    box.innerHTML=`<ol class="rows">${CORE.map(id=>rowHTML(I.ITEM[id],id===rec)).join('')}</ol><p style="margin:18px 0 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn2" id="showAll" type="button">${tx(`Show all ${I.ITEMS.length} exercises`,`Vis alle ${I.ITEMS.length} øvelsene`)}</button><span style="color:var(--ink-2);font-size:14px">${tx('Intercepts, NDB, holds at any fix, reversals, RNP approaches, SID and STAR, mental maths, partial panel.','Interception, NDB, holding ved hvilken som helst fiks, snuprosedyrer, RNP-innflyginger, SID og STAR, hoderegning, delvis panel.')}</span></p>`;
    el('showAll').onclick=()=>{ HS.all=true; save('bb-ifr-home',HS); renderCat(); };
  } else {
    fl.style.position='';
    fl.innerHTML=`<div class="chips" role="group" aria-label="${esc(tx('Group','Gruppe'))}">${['all'].concat(I.GROUPS).map(g=>`<button type="button" class="chip ${HS.g===g?'on':''}" data-g="${g}" aria-pressed="${HS.g===g}">${esc(g==='all'?tx('All','Alle'):L(W.group[g]))}</button>`).join('')}</div>
      <div class="fsel" role="group" aria-label="${esc(tx('Progress','Fremgang'))}">${[['all',t2('Any','Alle')],['new',t2('Not flown','Ikke fløyet')],['open',t2('Not passed','Ikke bestått')],['done',t2('Passed','Bestått')]].map(([k,n])=>`<button type="button" class="${HS.st===k?'on':''}" data-st="${k}" aria-pressed="${HS.st===k}">${esc(L(n))}</button>`).join('')}</div>
      <button class="btn2 sm q" id="showCore" type="button">${tx('Back to the short path','Tilbake til den korte veien')}</button>`;
    const keep=it=>(HS.g==='all'||it.g===HS.g)&&(HS.st==='all'||(HS.st==='new'&&best(it.id)===null)||(HS.st==='open'&&!passed(it.id))||(HS.st==='done'&&passed(it.id)));
    let n=0; box.innerHTML=I.GROUPS.map((g,gi)=>{ const its=I.ITEMS.filter(it=>it.g===g&&keep(it)); if(!its.length) return ''; n+=its.length;
      return `<section class="cgrp" id="grp-${g}"><header><i>${String(gi+1).padStart(2,'0')}</i><h2>${esc(L(W.group[g]))}</h2><p>${esc(L(W.groupSub[g]))}</p></header><ol class="rows">${its.map(it=>rowHTML(it,it.id===rec)).join('')}</ol></section>`; }).join('')||'';
    if(!n) box.innerHTML=`<p class="cat-empty">${tx('Nothing here with these filters. Choose “All” to see every exercise.','Ingenting her med disse filtrene. Velg «Alle» for å se alle øvelsene.')}</p>`;
    fl.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ HS.g=b.dataset.g; save('bb-ifr-home',HS); renderCat(); });
    fl.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{ HS.st=b.dataset.st; save('bb-ifr-home',HS); renderCat(); });
    el('showCore').onclick=()=>{ HS.all=false; save('bb-ifr-home',HS); renderCat(); }; }
  box.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>openItem(b.dataset.start,{}));
  box.querySelectorAll('[data-setup]').forEach(b=>b.onclick=()=>{ bldSet(b.dataset.setup); el('bld').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'}); const f=el('bld').querySelector('select,input'); if(f) f.focus({preventScroll:true}); }); }

/* ---------- the builder: "Practise exactly this" ---------- */
const BLD=Object.assign({item:'holdEntry',area:'practice',wind:'ex',wdir:270,wspd:20,gust:false,start:null,help:'guided',lv:1,more:false,seed:7},load(BK)||{});
const bEx=()=>(I.ITEM[BLD.item]||I.ITEM.trackIn).ex;
/* the main choice of each exercise (shown up front) and the rest (behind "More options") */
const BF={orient:[['kind'],['n','st']],trackIn:[['crs'],['st']],trackOut:[['crs'],['st']],pass:[['crs'],['st']],tts:[['crs'],['st']],intIn:[['crs','ang'],['st']],intOut:[['crs','ang'],['st']],
  intPass:[['crs'],['st']],locInt:[[],[]],ndb:[['crs'],['st']],ndbOut:[['crs'],['st']],dme:[['part','crs'],['dir','R','st']],holdEntry:[['radial','entry'],['dir','fix','D','st']],hold:[['radial','dir'],['fix','D','dmeLim','st']],
  pt:[['crs','a'],['side']],base:[['crs'],[]],math:[['mk'],['n']]};
const bFields=()=>BF[bEx()]||[[],[]];
function bVals(){ const it=I.ITEM[BLD.item], ex=it.ex, F=Object.assign({ex},it.p); const [f1,f2]=bFields();
  f1.concat(f2).forEach(k=>{ const v=BLD[k]; if(v!==undefined&&v!==''&&v!==null&&v!==false) F[k]=v; });
  if(BLD.wind==='calm'||BLD.wind==='random') F.wind=BLD.wind; else if(BLD.wind==='set') F.wind={dir:BLD.wdir,spd:BLD.wspd,gust:BLD.gust};
  if(BLD.start&&!I.EX[ex].fixedStart) F.start=BLD.start;
  const r=I.builderParams(F); if(it.p.pp) r.p.pp=true; if(it.p.race&&ex==='holdEntry') r.p.race=true; if(it.p.ndb&&(ex==='intIn'||ex==='intOut')) r.p.ndb=true;
  if(ex==='orient'&&!r.p.kind) r.p.kind=it.p.kind; if(ex==='math'&&!r.p.mk&&it.p.mk) r.p.mk=it.p.mk; if(it.p.part&&!r.p.part) r.p.part=it.p.part; if(it.p.a&&!r.p.a) r.p.a=it.p.a; if(it.p.fix&&!r.p.fix) r.p.fix=it.p.fix; if(it.p.dmeLim) r.p.dmeLim=true; if(it.p.dir&&!r.p.dir) r.p.dir=it.p.dir;
  return r; }
function bldSet(id){ if(!I.ITEM[id]) return; BLD.item=id; BLD.start=null; ['st','crs','radial','entry','dir','fix','D','dmeLim','ang','part','R','a','side','kind','n','mk'].forEach(k=>delete BLD[k]);
  if(!allowed(I.ITEM[id].ex,BLD.area)) BLD.area='practice'; save(BK,BLD); renderBld(); }
const FL={kind:t2('What to read','Hva du leser'),n:t2('Positions','Posisjoner'),st:t2('Station','Stasjon'),crs:t2('Course','Kurs'),radial:t2('Hold on the radial','Hold på radial'),entry:t2('Entry','Inngang'),dir:t2('Turns','Svinger'),
  fix:t2('Holding fix','Holdingfiks'),D:t2('DME of the fix','DME for fiksen'),dmeLim:t2('DME-limited outbound leg','DME-begrenset utgående legg'),ang:t2('Intercept angle','Interceptvinkel'),part:t2('Which part','Hvilken del'),R:t2('Arc distance (DME)','Buens avstand (DME)'),a:t2('Type','Type'),side:t2('First turn','Første sving'),mk:t2('Topic','Emne')};
function crsLabel(){ const ex=bEx(), it=I.ITEM[BLD.item]; return ex==='trackOut'||ex==='intOut'||ex==='intPass'?(it.p.ndb?t2('QDR (from the beacon)','QDR (fra fyret)'):t2('Radial (outbound)','Radial (ut)')):ex==='ndb'||(it.p.ndb&&ex==='intIn')?t2('QDM (to the beacon)','QDM (til fyret)'):ex==='ndbOut'?t2('QDR (from the beacon)','QDR (fra fyret)'):ex==='dme'?t2('Start radial','Startradial'):ex==='tts'?t2('Radial','Radial'):ex==='pt'||ex==='base'?t2('Final course (inbound)','Sluttkurs (inn)'):t2('Course (inbound)','Kurs (inn)'); }
function seg(k,opts){ return `<div class="bseg" role="group" aria-label="${esc(L(FL[k]))}">${opts.map(([v,n])=>`<button type="button" data-k="${k}" data-v="${v}" class="${String(BLD[k]??'')===String(v)?'on':''}" aria-pressed="${String(BLD[k]??'')===String(v)}">${esc(typeof n==='string'?n:L(n))}</button>`).join('')}</div>`; }
const AUTO=t2('Auto','Auto');
function fieldHTML(k){ const Ar=AREAS[BLD.area], it=I.ITEM[BLD.item], ex=bEx();
  const wrap=(inner,wide)=>`<div class="lab${wide?' w':''}"><span>${esc(L(k==='crs'?crsLabel():FL[k]))}</span>${inner}</div>`;
  switch(k){
    case 'st': { const want=(ex==='ndb'||ex==='ndbOut'||it.p.ndb||it.p.fix==='ndb'||BLD.fix==='ndb'||(ex==='orient'&&(BLD.kind||it.p.kind)==='rbi'))?'NDB':'VOR';
      return `<label><span>${esc(L(FL.st))}</span><select data-k="st"><option value="">${esc(L(AUTO))}</option>${Ar.NAV.filter(n=>n.type===want).map(n=>`<option value="${n.id}" ${BLD.st===n.id?'selected':''}>${n.id} ${esc(n.name)}</option>`).join('')}</select></label>`; }
    case 'crs': case 'radial': case 'D': case 'R': case 'n': return `<label><span>${esc(L(k==='crs'?crsLabel():FL[k]))}</span><input type="number" inputmode="numeric" data-k="${k}" min="${k==='n'?1:k==='D'?4:k==='R'?6:1}" max="${k==='n'?20:k==='D'?25:k==='R'?20:360}" placeholder="${esc(L(AUTO))}" value="${BLD[k]??''}"></label>`;
    case 'entry': return wrap(seg('entry',[['',AUTO],['direct',t2('Direct','Direkte')],['parallel',t2('Parallel','Parallell')],['teardrop',t2('Teardrop','Teardrop')]]),true);
    case 'dir': return wrap(seg('dir',[['',AUTO],['1',t2('Right','Høyre')],['-1',t2('Left','Venstre')]]));
    case 'side': return wrap(seg('side',[['',AUTO],['1',t2('Right','Høyre')],['-1',t2('Left','Venstre')]]));
    case 'fix': return wrap(seg('fix',[['',t2('VOR','VOR')],['ndb','NDB'],['dme',t2('DME fix','DME-fiks')]]));
    case 'dmeLim': return `<label class="chk w"><input type="checkbox" data-k="dmeLim" ${BLD.dmeLim?'checked':''}><span>${esc(L(FL.dmeLim))}</span></label>`;
    case 'ang': return wrap(seg('ang',[['',t2('30–45°','30–45°')],['30','30°'],['45','45°'],['90','90°']]));
    case 'part': return wrap(seg('part',[['',t2('Whole arc','Hele buen')],['join',t2('Join','Inn')],['leave',t2('Leave','Ut')]]),true);
    case 'a': return wrap(seg('a',[['','45°/180°'],['80','80°/260°']]));
    case 'kind': return wrap(seg('kind',[['',AUTO],['vor','CDI'],['rmi','RMI'],['rbi','RBI']]),true);
    case 'mk': return `<label class="w"><span>${esc(L(FL.mk))}</span><select data-k="mk"><option value="">${esc(tx('Mixed','Blandet'))}</option>${I.MATHK.map(k2=>`<option value="${k2}" ${BLD.mk===k2?'selected':''}>${esc(L(MATHN[k2]))}</option>`).join('')}</select></label>`;
  } return ''; }
const MATHN={int:t2('Intercept heading','Interceptkurs'),wca:t2('Wind correction angle','Vindkorreksjonsvinkel'),r160:t2('1 in 60','1 av 60'),tts:t2('Time to station','Tid til stasjonen'),rod:t2('Rate of descent (3°)','Sinkrate (3°)'),tod:t2('Top of descent','Start av nedstigning'),lead:t2('Lead radial','Ledende radial'),leadd:t2('Lead distance','Ledningsavstand')};
function renderBld(){ const box=el('bld'), it=I.ITEM[BLD.item], ex=it.ex, E=I.EX[ex], [f1,f2]=bFields();
  const opts=I.GROUPS.map(g=>`<optgroup label="${esc(L(W.group[g]))}">${I.ITEMS.filter(x=>x.g===g).map(x=>`<option value="${x.id}" ${x.id===BLD.item?'selected':''}>${esc(itemName(x.id))}</option>`).join('')}</optgroup>`).join('');
  const insts=E.inst.filter(k=>!(it.p.pp&&['hsi','rmi','pfd'].indexOf(k)>=0));
  box.innerHTML=`<h2 id="bldH">${tx('Practise exactly this','Øv på akkurat dette')}</h2><p class="lede">${tx('Choose the exercise and what matters to you. Everything else has a sensible default.','Velg øvelsen og det som betyr noe for deg. Alt annet har et fornuftig standardvalg.')}</p>
   <div class="bf">
    <label class="w"><span>${tx('Exercise','Øvelse')}</span><select data-k="item">${opts}</select></label>
    ${f1.map(fieldHTML).join('')}
    <div class="lab w"><span>${tx('Wind','Vind')}</span>${seg('wind',[['ex',t2('Exercise decides','Øvelsen bestemmer')],['calm',t2('Calm','Stille')],['set',t2('Choose','Velg')],['random',t2('Random','Tilfeldig')]])}</div>
    ${BLD.wind==='set'?`<div class="row3 w"><label><span>${tx('From (°)','Fra (°)')}</span><input type="number" data-k="wdir" min="1" max="360" value="${BLD.wdir}"></label><label><span>${tx('Speed (kt)','Fart (kt)')}</span><input type="number" data-k="wspd" min="0" max="60" value="${BLD.wspd}"></label><label class="chk"><input type="checkbox" data-k="gust" ${BLD.gust?'checked':''}><span>${tx('Gusts','Byger')}</span></label></div>`:''}
    <div class="lab w"><span>${E.fixedStart?tx('The picture','Bildet'):tx('Where you start: drag the aircraft, turn it with the handle','Hvor du starter: dra flyet, snu det med håndtaket')}</span><div class="bmap" id="bmap"><canvas id="bmapC" aria-label="${esc(tx('Preview of the setup. Drag the aircraft to choose the start.','Forhåndsvisning av oppsettet. Dra flyet for å velge start.'))}"></canvas><span class="bm-note" id="bmNote"></span></div></div>
    <div class="w" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><button type="button" class="btn3" id="bMore" aria-expanded="${!!BLD.more}">${BLD.more?tx('Fewer options','Færre valg'):tx('More options','Flere valg')}</button>${BLD.start?`<button type="button" class="btn3" id="bRstart">${tx('Random start again','Tilfeldig start igjen')}</button>`:''}</div>
    ${BLD.more?`<div class="lab w"><span>${tx('Area','Område')}</span>${`<div class="bseg" role="group">${['practice','bergen','oslo'].map(a=>`<button type="button" data-area="${a}" class="${BLD.area===a?'on':''}" ${allowed(ex,a)?'':'disabled'} aria-pressed="${BLD.area===a}">${esc(L(W.area[a]))}</button>`).join('')}</div>`}</div>
    ${f2.map(fieldHTML).join('')}
    <div class="lab w"><span>${tx('Instrument','Instrument')}</span><div class="bseg" role="group">${['',...insts].map(k=>`<button type="button" data-k="inst" data-v="${k}" class="${(BLD.inst||'')===k?'on':''}" aria-pressed="${(BLD.inst||'')===k}">${k?W.inst[k]:esc(L(AUTO))}</button>`).join('')}</div></div>
    <div class="lab w"><span>${tx('Level','Nivå')}</span>${`<div class="bseg" role="group">${[1,2,3,4].map(k=>`<button type="button" data-lv="${k}" class="${BLD.lv===k?'on':''}" aria-pressed="${BLD.lv===k}" title="${esc(L(W.level[k]))}">${k}</button>`).join('')}</div>`}<span class="hint" style="margin:0">${esc(L(W.level[BLD.lv]))}${BLD.wind!=='ex'?esc(tx('. Your wind choice replaces the level’s wind.','. Vindvalget ditt erstatter nivåets vind.')):''}</span></div>
    <div class="lab w"><span>${tx('Help','Hjelp')}</span>${`<div class="bseg" role="group">${['guided','hints','off'].map(k=>`<button type="button" data-help="${k}" class="${BLD.help===k?'on':''}" aria-pressed="${BLD.help===k}">${esc(L(W.help[k]))}</button>`).join('')}</div>`}<span class="hint" style="margin:0">${esc(L(W.helpSub[BLD.help]))}</span></div>`:''}
   </div>
   <div class="bacts"><button type="button" class="btn3 pri" id="bGo">${tx('Start this run','Start denne runden')}</button><button type="button" class="btn3" id="bRand" title="${esc(tx('A random exercise, start and wind','En tilfeldig øvelse, start og vind'))}"><svg viewBox="0 0 14 14" aria-hidden="true"><rect x="1.5" y="1.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="4.7" cy="4.7" r="1.1" fill="currentColor"/><circle cx="9.3" cy="9.3" r="1.1" fill="currentColor"/><circle cx="9.3" cy="4.7" r="1.1" fill="currentColor"/><circle cx="4.7" cy="9.3" r="1.1" fill="currentColor"/></svg>${tx('Random','Tilfeldig')}</button>${PROG.lastCustom?`<button type="button" class="btn3" id="bRep">${tx('Repeat last','Gjenta siste')}</button>`:''}</div>`;
  const ch=()=>{ save(BK,BLD); renderBld(); };
  box.querySelector('[data-k="item"]').onchange=e=>bldSet(e.target.value);
  box.querySelectorAll('select[data-k]:not([data-k="item"])').forEach(s=>s.onchange=()=>{ BLD[s.dataset.k]=s.value; ch(); });
  box.querySelectorAll('input[type=number][data-k]').forEach(i=>i.onchange=()=>{ const k=i.dataset.k; BLD[k]=i.value===''?'':+i.value; if(k==='wdir'||k==='wspd') BLD[k]=clamp(+i.value||0,k==='wdir'?1:0,k==='wdir'?360:60); BLD.start=null; ch(); });
  box.querySelectorAll('input[type=checkbox][data-k]').forEach(i=>i.onchange=()=>{ BLD[i.dataset.k]=i.checked; ch(); });
  box.querySelectorAll('button[data-k]').forEach(b=>b.onclick=()=>{ BLD[b.dataset.k]=b.dataset.v; if(b.dataset.k!=='inst'&&b.dataset.k!=='wind') BLD.start=null; ch(); });
  box.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{ if(b.disabled) return; BLD.area=b.dataset.area; BLD.st=''; BLD.start=null; ch(); });
  box.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{ BLD.lv=+b.dataset.lv; ch(); });
  box.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>{ BLD.help=b.dataset.help; ch(); });
  el('bMore').onclick=()=>{ BLD.more=!BLD.more; ch(); };
  if(el('bRstart')) el('bRstart').onclick=()=>{ BLD.start=null; BLD.seed=Math.floor(Math.random()*9000)+1; ch(); };
  el('bGo').onclick=startBuilder;
  el('bRand').onclick=()=>{ const pool=I.ITEMS.filter(x=>I.itemOk(x,AREAS[BLD.area])); bldSet(pool[Math.floor(Math.random()*pool.length)].id); BLD.seed=Math.floor(Math.random()*9000)+1; BLD.wind='random'; save(BK,BLD); renderBld(); };
  if(el('bRep')) el('bRep').onclick=()=>{ const l=PROG.lastCustom; openItem(l.item,{p:l.p,custom:true,lv:l.lv,area:l.area,seed:l.seed,help:l.help,inst:l.inst,step:'fly'}); };
  bPrev(); }
function startBuilder(){ const r=bVals(); PROG.lastCustom={item:BLD.item,p:r.p,lv:BLD.lv,area:BLD.area,seed:BLD.seed,help:BLD.help,inst:BLD.inst||null}; save(PK,PROG);
  openItem(BLD.item,{p:r.p,custom:true,lv:BLD.lv,area:BLD.area,seed:BLD.seed,help:BLD.help,inst:BLD.inst||null,step:'fly'}); }
/* the builder's preview map: what you will fly, from where you will start */
let bmap=null, bX=null, bDirty=true, bW=0, bH=0;
function bPrev(){ const c=el('bmapC'); if(!c) return; const it=I.ITEM[BLD.item]; const r=bVals(); const Ar=AREAS[BLD.area];
  try{ bX=I.setupX(r.ex,Ar,BLD.lv,BLD.seed,r.p); }catch(e){ bX=null; return; }
  if(!bmap){ bmap=NM.create(c,{onLoad:()=>{ bDirty=true; }}); }
  bmap.canvas=c; if(Ar.real) bmap.setRegion(BLD.area); else bmap.region=null;
  const rr=c.getBoundingClientRect(); bW=Math.max(1,Math.round(rr.width)); bH=Math.max(1,Math.round(rr.height)); const d=Math.min(devicePixelRatio||1,2); c.width=Math.round(bW*d); c.height=Math.round(bH*d);
  const P=bX.box.concat([{x:bX.ac.x,y:bX.ac.y}]), b={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity}; P.forEach(p=>{ b.x0=Math.min(b.x0,p.x); b.x1=Math.max(b.x1,p.x); b.y0=Math.min(b.y0,p.y); b.y1=Math.max(b.y1,p.y); });
  if(bW>60&&bH>60) bmap.set(NM.fit(b,bW,bH,{l:28,r:28,t:28,b:28},{pad:1.4,min:6,maxK:200}));
  const w=bX.wind; el('bmNote').textContent=(I.EX[r.ex].fixedStart?tx('Fixed start','Fast start'):BLD.start?tx('Your start','Din start'):tx('Random start','Tilfeldig start'))+' · '+(w.spd?`${tx('wind','vind')} ${d3(w.dir)}/${Math.round(w.spd)}${w.gust?'G':''}`:tx('calm','stille'));
  bDirty=true; drawBPrev(); }
function drawBPrev(){ const c=el('bmapC'); if(!c||!bX||!bmap||bW<60) return; const g=c.getContext('2d'), d=c.width/bW, Ar=AREAS[BLD.area]; g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,bW,bH);
  bmap.drawBase(g,bW,bH,{}); if(!Ar.real) drawCoast(bmap,g,Ar);
  const ex=I.ITEM[BLD.item].ex; if(ex!=='math'){ drawGeom(bmap,g,bX,Ar,ex,bW,bH); if(ex==='holdEntry'){ const F=I.fixOf(Ar,bX.task); drawSectors(bmap,g,F,bX.task.inb,bX.task.dir,Math.min(4,40/bmap.v.k*1.6)); } }
  bmap.flushLabels(g,bW,bH); bmap.drawAircraft(g,bX.ac.x,bX.ac.y,bX.ac.hdg,{size:14,ring:!I.EX[ex].fixedStart,handle:!I.EX[ex].fixedStart}); bDirty=false; }
function drawCoast(m,g,Ar){ g.fillStyle='#16242e'; g.strokeStyle='rgba(150,182,204,.32)'; g.lineWidth=1; for(const poly of Ar.coast){ g.beginPath(); for(let i=0;i<poly.length;i+=2){ m.P(poly[i],poly[i+1]); if(i) g.lineTo(m.sx,m.sy); else g.moveTo(m.sx,m.sy); } g.closePath(); g.fill(); g.stroke(); } }
/* drag the start on the preview */
(function(){ let drag=null; const bx=()=>el('bmapC');
  const hit=(e)=>{ const c=bx(); if(!c||!bX||!bmap) return null; const r=c.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top; bmap.P(bX.ac.x,bX.ac.y); const a=bmap.sa(bX.ac.hdg), hx=bmap.sx+Math.sin(a)*34, hy=bmap.sy-Math.cos(a)*34;
    if(Math.hypot(x-hx,y-hy)<16) return {k:'hdg',x,y}; return {k:'pos',x,y}; };
  document.addEventListener('pointerdown',e=>{ const c=bx(); if(!c||e.target!==c||!bX) return; if(I.EX[I.ITEM[BLD.item].ex].fixedStart) return; const h=hit(e); drag=h.k; c.setPointerCapture(e.pointerId); mv(e); e.preventDefault(); });
  const mv=e=>{ if(!drag) return; const c=bx(), r=c.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
    if(drag==='pos'){ const n=bmap.unP(x,y); bX.ac.x=n.x; bX.ac.y=n.y; } else { bmap.P(bX.ac.x,bX.ac.y); bX.ac.hdg=norm(Math.round(N.bearing(x-bmap.sx,-(y-bmap.sy))+bmap.v.rot))||360; }
    BLD.start={x:Math.round(bX.ac.x*100)/100,y:Math.round(bX.ac.y*100)/100,hdg:Math.round(bX.ac.hdg)||360}; drawBPrev(); };
  document.addEventListener('pointermove',e=>{ if(drag) mv(e); });
  document.addEventListener('pointerup',()=>{ if(drag){ drag=null; save(BK,BLD); renderBld(); } }); })();

/* ---------- views: home and trainer ---------- */
function openItem(id,o){ o=o||{}; const it=I.ITEM[id]; if(!it) return;
  S.item=id; S.ex=it.ex; S.p=Object.assign({},o.p||it.p); S.custom=!!o.custom;
  S.lv=o.lv||clamp(passed(id)+1,1,4); S.area=o.area&&allowed(it.ex,o.area)?o.area:(allowed(it.ex,S.area)?S.area:'practice');
  if(o.help) S.help=o.help; S.instWant=o.inst||null; S.inst=null;
  if(A().real) map.setRegion(S.area); else map.region=null;
  document.body.classList.add('v-trainer');
  setup(o.seed||Math.floor(Math.random()*9000)+1); if((location.hash||'').slice(1)!==id) history.pushState(null,'','#'+id);
  S.uStep=0; go(o.step||'understand'); requestAnimationFrame(()=>{ el('trainer').scrollIntoView({block:'start'}); sizeAll(); }); }
function showHome(push){ if(S.run){ S.run=false; S.started=false; } document.body.classList.remove('v-trainer'); closePops();
  if(push&&location.hash) history.pushState(null,'',location.pathname+location.search); renderNudge(); renderCat(); renderBld(); scrollTo(0,0); }
function route(){ const h=decodeURIComponent((location.hash||'').slice(1)); if(I.ITEM[h]){ if(!(document.body.classList.contains('v-trainer')&&S.item===h)) openItem(h,{}); } else if(document.body.classList.contains('v-trainer')) showHome(false); }

/* ---------- setup of a run ---------- */
const STEPS=[['understand',t2('Understand','Forstå')],['think',t2('Think first','Tenk først')],['fly',t2('Fly','Fly')],['debrief',t2('Debrief','Debrief')]];
function setup(seed){ if(seed!==undefined) S.seed=seed;
  if(!allowed(S.ex,S.area)) S.area='practice';
  const ex=EXo(); S.X=I.setupX(S.ex,A(),S.lv,S.seed,S.p); pickInst();
  S.sim=I.newSim(Object.assign({},S.X.ac,{wind:S.X.wind})); S.J=I.newJudge(); S.P={}; S.GP={}; S.gc=null; S.log=[]; S.run=false; S.started=false; S.paused=false; S.demo=false; S.mistake=false;
  S.watch={on:false,t:0}; S.peeks=0; S.res=null; S.moments={}; S.pause=null; S.hint=0; S.hintK=null; S.hintsUsed=0; S.showWhy=false; S.gTh=null; S.gIdx=0; S.tt=null; S.clrOpen=false;
  S.u={x:S.X.ac.x,y:S.X.ac.y,hdg:S.X.ac.hdg,alt:S.X.ac.alt,ias:S.X.ac.ias,gs:S.X.ac.ias,trk:S.X.ac.hdg,obs:S.X.obs};
  S.ideal=null; viewPts=null; fitView(); baseDirty=true; { const dt=el('doneT'); clearTimeout(dt._t); dt.hidden=true; } el('pausec').hidden=true;
  S.think=ex.think?ex.think(S.X,A()):null; S.thinkAns=null;
  try{ const r=I.run(S.ex,A(),S.lv,S.seed,{p:S.p}); S.ideal=r.path; S.idealEnd=r.s.t; }catch(e){ S.ideal=null; }
  if(document.body.classList.contains('v-trainer')){ PROG.last={item:S.item,lv:S.lv,area:S.area,custom:S.custom,p:S.custom?S.p:null,seed:S.seed}; PROG.help=S.help; save(PK,PROG); } }
function go(step){ if(step==='debrief'&&!S.res) return; if(step==='think'&&!S.think) step='fly';
  S.step=step; el('trainer').dataset.step=step; el('trainer').dataset.quiz=S.ex==='math'?'1':'0'; closePops();
  if(step==='understand'){ S.uT=0; setUStep(S.uStep||0,true); }
  if(step==='debrief'){ S.scrub=S.res?S.res.first?S.res.first.t:(S.log.length?S.log[S.log.length-1].t:0):0; S.replay=false; fitView(debriefPts()); }
  else if(step!=='fly'||!S.started){ fitView(S.X.box); }
  renderAll(); }

/* ---------- top bar, help, setup popover, keys ---------- */
function renderBar(){ const it=ITo();
  el('exName').textContent=itemName(S.item); el('backT').textContent=tx('All exercises','Alle øvelser');
  el('exSub').textContent=`${tx('Level','Nivå')} ${S.lv}: ${L(W.level[S.lv])} · ${L(W.area[S.area])}${S.custom?' · '+tx('your setup','ditt oppsett'):''}`;
  el('steps').innerHTML=STEPS.filter(([k])=>k!=='think'||S.think).map(([k,n],j)=>`<button type="button" data-s="${k}" class="${k===S.step?'on':''}" ${k==='debrief'&&!S.res?'disabled':''} aria-current="${k===S.step?'step':'false'}"><i>${j+1}</i>${esc(L(n))}</button>`).join('');
  el('steps').querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.disabled) return; if(b.dataset.s==='fly'&&(S.step==='debrief'||S.started)){ setup(S.seed); } go(b.dataset.s); });
  el('helpK').textContent=tx('Help','Hjelp');
  el('helpSeg').innerHTML=['guided','hints','off'].map(k=>`<button type="button" data-h="${k}" class="${k===S.help?'on':''}" aria-pressed="${k===S.help}" title="${esc(L(W.helpSub[k]))}">${esc(L(W.help[k]))}</button>`).join('');
  el('helpSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{ S.help=b.dataset.h; PROG.help=S.help; save(PK,PROG); if(S.help!=='guided'&&S.pause) resumePause(); renderBar(); renderGuide(true); renderCtl(); renderLegend(); });
  el('setT').textContent=tx('Setup','Oppsett');
  el('mapBtn').textContent=S.mapOpen?tx('Hide map','Skjul kart'):tx('Map','Kart'); el('mapBtn').setAttribute('aria-pressed',S.mapOpen);
  renderItabs(); }
function renderItabs(){ const ex=EXo(); const ks=['cdi','rmi','rbi','hsi','pfd'].filter(k=>ex.inst.indexOf(k)>=0);
  el('itabs').innerHTML=ks.map(k=>`<button type="button" data-i="${k}" class="${k===S.inst?'on':''}" ${instOk(k)?'':'disabled'} aria-pressed="${k===S.inst}" title="${esc(L(W.instLong[k]))}">${W.inst[k]}</button>`).join('');
  el('itabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.disabled) return; S.inst=S.instWant=b.dataset.i; renderItabs(); layoutInst(); });
  el('scan').textContent=S.X&&S.X.pp?tx('Heading indicator failed: use the compass','Kursindikatoren har sviktet: bruk kompasset'):L(SCAN[S.inst]||SCAN.cdi); }
function closePops(){ el('setPop').hidden=true; el('setBtn').setAttribute('aria-expanded','false'); el('drawer').hidden=true; el('keysov').hidden=true; }
el('setBtn').onclick=e=>{ const p=el('setPop'); if(!p.hidden){ closePops(); return; } closePops(); renderSetPop(); p.hidden=false; el('setBtn').setAttribute('aria-expanded','true');
  const r=el('setBtn').getBoundingClientRect(), st=el('trainer').getBoundingClientRect(); p.style.top=(r.bottom-st.top+6)+'px'; p.style.right=Math.max(8,st.right-r.right)+'px'; p.style.left='auto'; };
function renderSetPop(){ const p=el('setPop'), ex=S.ex;
  p.innerHTML=`<span class="lab">${tx('Level','Nivå')}</span><div class="dseg" role="group">${[1,2,3,4].map(k=>`<button type="button" data-l="${k}" class="${k===S.lv?'on':''}" aria-pressed="${k===S.lv}">${k}</button>`).join('')}</div><p>${esc(L(W.level[S.lv]))}</p>
    <span class="lab">${tx('Area','Område')}</span><div class="dseg" role="group">${['practice','bergen','oslo'].map(k=>`<button type="button" data-a="${k}" class="${k===S.area?'on':''}" ${allowed(ex,k)?'':'disabled'} aria-pressed="${k===S.area}">${esc(L(W.area[k]))}</button>`).join('')}</div>
    <p>${A().real?esc(tx('Real navaid positions and frequencies, for training only.','Ekte posisjoner og frekvenser for navigasjonshjelpemidler, kun for trening.')):esc(tx('Fictional stations, clean and simple.','Fiktive stasjoner, rene og enkle.'))}</p>
    <button type="button" class="dbtn" id="toBld">${tx('Choose course, wind and start','Velg kurs, vind og start')}</button>`;
  p.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{ S.lv=+b.dataset.l; setup(); go(S.step==='debrief'?'fly':S.step); renderSetPop(); });
  p.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ if(b.disabled) return; S.area=b.dataset.a; map.region=null; if(A().real) map.setRegion(S.area); setup(); go(S.step==='debrief'?'fly':S.step); renderSetPop(); });
  el('toBld').onclick=()=>{ bldSet(S.item); BLD.area=S.area; BLD.lv=S.lv; save(BK,BLD); showHome(true); requestAnimationFrame(()=>el('bld').scrollIntoView({block:'start'})); }; }
el('keysBtn').onclick=()=>{ const o=el('keysov'); if(!o.hidden){ o.hidden=true; return; } closePops();
  o.innerHTML=`<div class="kc" role="dialog" aria-labelledby="kh"><h3 id="kh">${tx('Keyboard','Tastatur')}</h3><dl>
   <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>${tx('Heading bug 1° (with Shift 10°)','Kursmarkør 1° (med Shift 10°)')}</dd>
   <dt><kbd>,</kbd> <kbd>.</kbd></dt><dd>${tx('Course (CRS / OBS) 1° (with Shift 10°)','Kurs (CRS / OBS) 1° (med Shift 10°)')}</dd>
   <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>${tx('Selected altitude 100 ft (with Shift 1000 ft)','Valgt høyde 100 ft (med Shift 1000 ft)')}</dd>
   <dt><kbd>Space</kbd></dt><dd>${tx('Start, pause and resume','Start, pause og fortsett')}</dd>
   <dt><kbd>H</kbd></dt><dd>${tx('Hint (in Hints mode)','Hint (i Hint-modus)')}</dd>
   <dt><kbd>W</kbd></dt><dd>${tx('Why? for the current step','Hvorfor? for steget nå')}</dd>
   <dt><kbd>T</kbd></dt><dd>${tx('Stopwatch','Stoppeklokke')}</dd>
   <dt><kbd>Enter</kbd></dt><dd>${tx('Continue after a pause','Fortsett etter en pause')}</dd>
   <dt>${tx('Drag','Dra')}</dt><dd>${tx('the knobs on the instruments turn them','knappene på instrumentene vrir dem')}</dd></dl>
   <button type="button" class="dbtn" id="kClose">${tx('Close','Lukk')}</button></div>`;
  o.hidden=false; el('kClose').onclick=()=>{ o.hidden=true; el('keysBtn').focus(); }; el('kClose').focus(); };
el('back').onclick=()=>showHome(true);
el('mapBtn').onclick=()=>{ S.mapOpen=!S.mapOpen; el('trainer').classList.toggle('mapopen',S.mapOpen); renderBar(); requestAnimationFrame(sizeAll); };

/* ---------- clearance: a card before the start, a one-line strip after ---------- */
function windTxt(){ const w=S.X.wind, hid=w.hidden||S.lv>=4; return hid?tx('hidden','skjult'):w.spd?`${d3(w.dir)}/${Math.round(w.spd)}${w.gust?'G':''}`:tx('calm','stille'); }
function tblHTML(){ const T=S.X.task;
  if(S.ex==='vordme') return T.table.slice(0,6).map(r=>`<span>D${r.dme} <b>${r.alt}</b></span>`).join(' ');
  if(isApp(S.ex)&&T.table){ if(S.ex==='vorApp'||S.ex==='ndbApp') return T.table.slice(1,6).map(r=>`<span>+${r.t}s <b>${r.alt}</b></span>`).join(' '); if(S.ex==='locApp') return T.table.slice(0,6).map(r=>`<span>D${r.dme} <b>${r.alt}</b></span>`).join(' '); if(S.ex==='lnav') return T.table.slice(0,6).map(r=>`<span>${r.d} NM <b>${r.alt}</b></span>`).join(' '); }
  return ''; }
function renderBrief(){ const c=clearance(S.X,A(),S.ex), tb=tblHTML(), cc=el('ccard'), strip=el('clr');
  const meta=`<span>${tx('Wind','Vind')} <b>${windTxt()}</b></span><span>TAS <b>${Math.round(I.tasOf(S.X.ac.ias,S.X.ac.alt))}</b></span>${A().real?`<span>${tx('Real navaid data','Ekte navigasjonsdata')}</span>`:''}`;
  if(S.step==='fly'&&!S.started){ strip.hidden=true; el('guide').hidden=true;
    cc.innerHTML=`<div class="ccard"><div><div class="k">${S.ex==='math'?tx('The task','Oppgaven'):tx('Your clearance','Klareringen din')}</div><div class="ct">${esc(L(c))}</div>${tb?`<div class="tbl">${tb}</div>`:''}<div class="meta">${meta}<span>${tx('Help','Hjelp')} <b>${esc(L(W.help[S.help]))}</b></span></div></div>
      <div class="go"><button class="dbtn pri" type="button" data-a="start"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>${tx('Start','Start')}</button>${S.ex!=='math'?`<button class="dbtn lt" type="button" data-a="demo">${tx('Watch the instructor first','Se instruktøren først')}</button>`:''}</div></div>`;
    cc.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a)); return; }
  cc.innerHTML=''; strip.hidden=S.step!=='fly'; el('guide').hidden=S.step!=='fly';
  strip.classList.toggle('open',S.clrOpen); strip.setAttribute('aria-expanded',S.clrOpen);
  strip.innerHTML=`<span class="ct">${esc(L(c))}${S.clrOpen&&tb?`<span class="tbl">${tb}</span>`:''}</span><span class="meta">${meta}</span>`; }
el('clr').onclick=()=>{ S.clrOpen=!S.clrOpen; renderBrief(); };
el('clr').onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); S.clrOpen=!S.clrOpen; renderBrief(); } };

/* ---------- controls ---------- */
const CTL={hdg:{l:'HDG',step:[1,10],get:()=>S.sim.sel.hdg,fmt:v=>d3(v)},crs:{l:'CRS',step:[1,10],get:()=>S.X.obs,fmt:v=>d3(v)},
  alt:{l:'ALT',step:[100,1000],lab:['100','1k'],get:()=>S.sim.sel.alt,fmt:v=>String(Math.round(v))},vs:{l:'VS',step:[50,100],get:()=>S.sim.sel.vs,fmt:v=>String(Math.round(v))},spd:{l:'SPD',step:[1,10],get:()=>S.sim.sel.spd,fmt:v=>String(Math.round(v))}};
function ctlList(){ const X=S.X, ex=S.ex; if(ex==='math') return [];
  if(ex==='orient') return ['crs']; const l=['hdg']; if(X.nav&&X.nav!=='GPS'&&A().ST[X.nav]&&A().ST[X.nav].type==='VOR'||(X.nav&&A().ST[X.nav]&&A().ST[X.nav].type==='ILS')) l.push('crs');
  if(isApp(ex)||isRoute(ex)) l.push('alt','vs'); return l; }
function setCtl(k,v,delta){ const s=S.sim;
  if(k==='hdg'){ if(S.X.pp&&delta!==undefined){ /* partial panel: a timed rate-one turn relative to where the nose is */ s.sel.hdg=norm(s.hdg+delta)||360; s.sel.dir=Math.sign(delta); S.tt={deg:delta,t0:s.t,dur:Math.abs(delta)/3}; }
    else if(delta!==undefined){ const off=I.hdgErr(s)+delta; s.sel.hdg=norm(s.sel.hdg+delta)||360; s.sel.dir=Math.abs(off)>180?Math.sign(off):0; } else { s.sel.hdg=norm(v)||360; s.sel.dir=0; } }
  else if(k==='crs'){ if(S.X.nav==='GPS') return; S.X.obs=norm(delta!==undefined?S.X.obs+delta:v)||360; if(S.step==='understand') S.u.obs=S.X.obs; }
  else if(k==='alt') s.sel.alt=clamp(delta!==undefined?Math.round((s.sel.alt+delta)/10)*10:v,0,20000);
  else if(k==='vs') s.sel.vs=clamp(delta!==undefined?s.sel.vs+delta:v,100,2000);
  else if(k==='spd') s.sel.spd=clamp(delta!==undefined?s.sel.spd+delta:v,80,200);
  if(S.demo&&S.run){ S.demo=false; renderTbar(); }
  syncCtl(); }
function stepper(k,label,steps,labs){ const c=CTL[k]; return `<div class="c" data-k="${k}"><div class="top"><label for="in-${k}">${label||c.l}<small id="tg-${k}"></small></label><input id="in-${k}" inputmode="numeric" autocomplete="off" aria-label="${label||c.l}"></div>
  <div class="st">${steps.map((d,j)=>`<button type="button" data-d="${d}" aria-label="${(label||c.l)} ${d>0?'+':'−'}${Math.abs(d)}">${d>0?'+':'−'}${labs?labs[j]:Math.abs(d)}</button>`).join('')}</div></div>`; }
function renderCtl(){ const box=el('ctl'), l=ctlList(), X=S.X; let h='';
  l.forEach(k=>{ const c=CTL[k];
    if(k==='hdg'&&X.pp) h+=`<div class="c" data-k="hdg" data-pp="1"><div class="top"><label>${tx('Timed turn','Tidsstyrt sving')}<small id="tg-hdg"></small></label><span class="tt" id="ttl"></span></div><div class="st">${[-30,-10,10,30].map(d=>`<button type="button" data-d="${d}" aria-label="${tx('Turn','Sving')} ${d<0?tx('left','venstre'):tx('right','høyre')} ${Math.abs(d)}°">${d<0?'◀ ':''}${Math.abs(d)}°${d>0?' ▶':''}</button>`).join('')}</div></div>`;
    else h+=stepper(k,null,[-c.step[1],-c.step[0],c.step[0],c.step[1]],c.lab?[c.lab[1],c.lab[0],c.lab[0],c.lab[1]]:null); });
  if(S.ex==='orient') h+=`<div class="c rep"><div class="top"><label for="in-rep">${X.task.kind==='rbi'?tx('Bearing to the beacon','Peiling til fyret'):tx('Your radial','Radialen din')}<small id="tg-rep"></small></label><input id="in-rep" inputmode="numeric" autocomplete="off" placeholder="—"></div><div class="st">${X.task.kind==='rbi'?'<span></span>':`<button type="button" id="repObs">${tx('Use the course','Bruk kursen')}</button>`}<button type="button" id="repGo" class="go">${tx('Report','Rapporter')}</button></div></div>`;
  if(S.ex==='tts') h+=`<div class="c rep"><div class="top"><label for="in-rep">${tx('Minutes to the station','Minutter til stasjonen')}</label><input id="in-rep" inputmode="decimal" autocomplete="off" placeholder="—"></div><div class="st"><button type="button" id="repSw">${tx('Stopwatch','Stoppeklokke')} <span id="swv">0:00</span></button><button type="button" id="repGo" class="go">${tx('Report','Rapporter')}</button></div></div>`;
  if(S.ex==='pass') h+=`<div class="c rep"><div class="top"><label>${tx('When the flag flips','Når flagget skifter')}</label></div><div class="st" style="grid-template-columns:1fr"><button type="button" id="passGo" class="go">${tx('Station passage','Stasjonspassering')}</button></div></div>`;
  const n=l.length+((S.ex==='orient'||S.ex==='tts'||S.ex==='pass')?1:0); box.style.setProperty('--nc',innerWidth<560?Math.min(2,n):Math.min(n,4)); box.innerHTML=h;
  box.querySelectorAll('.c[data-k]').forEach(c0=>{ const k=c0.dataset.k, inp=c0.querySelector('input');
    c0.querySelectorAll('button[data-d]').forEach(b=>{ let tm=null, iv=null; const fire=()=>setCtl(k,null,+b.dataset.d);
      b.addEventListener('pointerdown',e=>{ e.preventDefault(); fire(); if(c0.dataset.pp) return; tm=setTimeout(()=>{ iv=setInterval(fire,90); },420); });
      const stop=()=>{ clearTimeout(tm); clearInterval(iv); }; b.addEventListener('pointerup',stop); b.addEventListener('pointerleave',stop); b.addEventListener('pointercancel',stop);
      b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fire(); } }); });
    if(!inp) return;
    inp.addEventListener('focus',()=>{ c0.classList.add('hot'); inp.select(); });
    inp.addEventListener('blur',()=>{ c0.classList.remove('hot'); const v=parseFloat(inp.value); if(Number.isFinite(v)) setCtl(k,v); else syncCtl(); });
    inp.addEventListener('keydown',e=>{ const c=CTL[k]; if(e.key==='Enter') inp.blur(); if(e.key==='ArrowUp'||e.key==='ArrowDown'){ e.preventDefault(); e.stopPropagation(); setCtl(k,null,(e.key==='ArrowUp'?1:-1)*c.step[e.shiftKey?1:0]); inp.select(); } }); });
  const ri=el('in-rep');
  if(ri){ const send=()=>{ const v=parseFloat(String(ri.value).replace(',','.')); if(!Number.isFinite(v)){ ri.focus(); return; } report(S.ex==='tts'?Math.round(v*10)/10:(norm(Math.round(v))||360)); ri.value=''; };
    el('repGo').onclick=send; ri.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); send(); } });
    if(el('repObs')) el('repObs').onclick=()=>{ ri.value=d3(S.X.obs); ri.focus(); };
    if(el('repSw')) el('repSw').onclick=toggleWatch; }
  if(el('passGo')) el('passGo').onclick=()=>{ S.pendingAct={type:'pass'}; };
  syncCtl(); }
function syncCtl(){ Object.keys(CTL).forEach(k=>{ const inp=el('in-'+k); if(inp&&document.activeElement!==inp) inp.value=CTL[k].fmt(CTL[k].get()); }); }
function toggleWatch(){ S.watch.on=!S.watch.on; renderDrawer(); }
function report(val){ S.pendingAct={type:'report',val}; }

/* keyboard */
document.addEventListener('keydown',e=>{ if(!document.body.classList.contains('v-trainer')) return; const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)) return;
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  if(e.key==='Escape'){ if(!el('keysov').hidden||!el('setPop').hidden||!el('drawer').hidden){ closePops(); e.preventDefault(); } return; }
  if(S.pause&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); resumePause(); return; }
  if(S.step==='understand'){ if(e.key==='ArrowRight'&&t.tagName!=='BUTTON'){ e.preventDefault(); uNext(); } else if(e.key==='ArrowLeft'&&t.tagName!=='BUTTON'){ e.preventDefault(); setUStep(Math.max(0,S.uStep-1)); } return; }
  if(S.step!=='fly') return;
  const big=e.shiftKey; let used=true;
  switch(e.key){
    case 'ArrowLeft': setCtl('hdg',null,S.X.pp?-10:big?-10:-1); break; case 'ArrowRight': setCtl('hdg',null,S.X.pp?10:big?10:1); break;
    case 'ArrowUp': setCtl('alt',null,big?1000:100); break; case 'ArrowDown': setCtl('alt',null,big?-1000:-100); break;
    case ',': case '<': setCtl('crs',null,big?-10:-1); break; case '.': case '>': setCtl('crs',null,big?10:1); break;
    case ' ': if(t&&t.tagName==='BUTTON'){ used=false; break; } if(!S.started) start(false); else { S.paused=!S.paused; renderTbar(); } break;
    case 't': case 'T': toggleWatch(); break;
    case 'h': case 'H': if(S.started&&S.help==='hints') hintMore(); else used=false; break;
    case 'w': case 'W': if(S.started){ S.showWhy=!S.showWhy; renderGuide(true); } else used=false; break;
    default: used=false; }
  if(used) e.preventDefault(); });

/* drag the instrument knobs (and the wheel) */
function knobDrag(kind){ const cv=q(`[data-g="${kind}"] canvas`), G=GA[kind];
  const target=(x,y)=>{ const ks=G?G.knobs:[]; const kn=ks.find(k=>Math.hypot(x-k.x,y-k.y)<k.r*1.25); if(kn) return kn.id==='obs'||kn.id==='crs'?'crs':kn.id==='hdg'?'hdg':kn.id==='card'?'hdg':null;
    if(kind==='cdi') return 'crs'; if(kind==='dg'||kind==='adf'||kind==='rmi') return 'hdg'; if(kind==='hsi') return x<cv.clientWidth/2?'crs':'hdg'; return null; };
  let drag=null;
  cv.addEventListener('pointerdown',e=>{ if(S.step==='debrief'||S.X.pp&&target(0,0)==='hdg') return; const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, k=target(x,y); if(!k) return;
    drag={k,y:e.clientY,x:e.clientX,acc:0}; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
  cv.addEventListener('pointermove',e=>{ if(!drag) return; const d=(e.clientX-drag.x)-(e.clientY-drag.y); drag.x=e.clientX; drag.y=e.clientY; drag.acc+=d/3;
    const n=Math.trunc(drag.acc); if(n){ drag.acc-=n; if(S.step==='fly'||drag.k==='crs') setCtl(drag.k,null,n); else if(S.step==='understand'&&drag.k==='hdg'){ S.u.hdg=norm(S.u.hdg+n); } } });
  const up=()=>{ drag=null; }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ if(S.step==='debrief') return; const r=cv.getBoundingClientRect(), k=target(e.clientX-r.left,e.clientY-r.top); if(!k) return; e.preventDefault(); const n=e.deltaY<0?1:-1;
    if(S.step==='fly'||k==='crs') setCtl(k,null,n*(e.shiftKey?10:1)); else S.u.hdg=norm(S.u.hdg+n); },{passive:false});
  cv.style.cursor='grab'; }
['cdi','hsi','dg','rmi','adf'].forEach(knobDrag);
(function(){ let drag=null; pfdC.addEventListener('pointerdown',e=>{ if(S.step==='debrief') return; const r=pfdC.getBoundingClientRect(), y=e.clientY-r.top, x=e.clientX-r.left; if(y<r.height*0.55) return;
  drag={k:x<r.width*0.3?'crs':'hdg',x:e.clientX,y:e.clientY,acc:0}; pfdC.setPointerCapture(e.pointerId); e.preventDefault(); });
  pfdC.addEventListener('pointermove',e=>{ if(!drag) return; const d=(e.clientX-drag.x)-(e.clientY-drag.y); drag.x=e.clientX; drag.y=e.clientY; drag.acc+=d/3; const n=Math.trunc(drag.acc); if(n){ drag.acc-=n; if(S.step==='fly'||drag.k==='crs') setCtl(drag.k,null,n); else S.u.hdg=norm(S.u.hdg+n); } });
  const up=()=>{ drag=null; }; pfdC.addEventListener('pointerup',up); pfdC.addEventListener('pointercancel',up); pfdC.style.cursor='grab'; })();

/* ---------- transport bar and the "More" drawer ---------- */
const ICON={play:'<svg viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>',pause:'<svg viewBox="0 0 14 14"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>',
  again:'<svg viewBox="0 0 14 14"><path d="M11.5 7A4.5 4.5 0 1 1 7 2.5h2.5M8 .8l1.8 1.7L8 4.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  dice:'<svg viewBox="0 0 14 14"><rect x="1.5" y="1.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="4.7" cy="4.7" r="1.1" fill="currentColor"/><circle cx="9.3" cy="9.3" r="1.1" fill="currentColor"/><circle cx="9.3" cy="4.7" r="1.1" fill="currentColor"/><circle cx="4.7" cy="9.3" r="1.1" fill="currentColor"/></svg>',
  eye:'<svg viewBox="0 0 14 14"><path d="M1 7s2.3-4 6-4 6 4 6 4-2.3 4-6 4-6-4-6-4z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="7" r="1.8" fill="currentColor"/></svg>',
  stop:'<svg viewBox="0 0 14 14"><rect x="2.5" y="2.5" width="9" height="9" rx="1" fill="currentColor"/></svg>',
  more:'<svg viewBox="0 0 14 14"><circle cx="3" cy="7" r="1.3" fill="currentColor"/><circle cx="7" cy="7" r="1.3" fill="currentColor"/><circle cx="11" cy="7" r="1.3" fill="currentColor"/></svg>',
  bulb:'<svg viewBox="0 0 16 16"><path d="M8 1.5a4.5 4.5 0 0 0-2.6 8.2V12h5.2V9.7A4.5 4.5 0 0 0 8 1.5zM6 14h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  arrow:'<svg viewBox="0 0 16 16"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check:'<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  warn:'<svg viewBox="0 0 16 16"><path d="M8 2 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6.5v3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="currentColor"/></svg>',
  solo:'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'};
function renderPlay(){ el('play').innerHTML=S.replay?ICON.pause:ICON.play; el('play').setAttribute('aria-label',S.replay?tx('Pause','Pause'):tx('Play the replay','Spill av reprisen')); }
function renderTbar(){ const tb=el('tbar'); let h='';
  if(S.step==='understand') h=`<span class="hint">${S.uStep>=uSteps().length-1?esc(tx('Drag the aircraft on the map. Turn it with the handle in front of the nose.','Dra flyet på kartet. Snu det med håndtaket foran nesen.')):esc(tx('The aircraft flies the instructor’s path. Watch the instrument.','Flyet flyr instruktørens bane. Se på instrumentet.'))}</span><button class="dbtn" data-a="${S.think?'think':'fly'}" type="button">${S.think?tx('Skip to the question','Hopp til spørsmålet'):tx('Skip to flying','Hopp til flygingen')}</button>`;
  else if(S.step==='think') h=`<span class="sp"></span><button class="dbtn q" data-a="understand" type="button">${tx('Back','Tilbake')}</button><button class="dbtn ${S.thinkAns!=null?'pri':''}" data-a="fly" type="button">${S.thinkAns!=null?tx('Fly it','Fly den'):tx('Skip and fly','Hopp over og fly')}</button>`;
  else if(S.step==='fly'){
    if(!S.started) h=`<span class="hint">${esc(tx('Read the clearance, then press Start (or Space).','Les klareringen, og trykk Start (eller mellomrom).'))}</span><span class="sp"></span><button class="ib" data-a="keys" type="button">${tx('Keys','Taster')}</button>`;
    else h=`<button class="ib" data-a="pause" aria-pressed="${S.paused}" type="button">${S.paused?ICON.play:ICON.pause}<span class="tx">${S.paused?tx('Resume','Fortsett'):tx('Pause','Pause')}</span></button>
      <span class="clock">${tx('Time','Tid')} <b id="clk">${mmss(S.sim.t)}</b>${S.speed>1?` ×${S.speed}`:''}${S.demo?` <span class="tx">· ${tx('the instructor is flying','instruktøren flyr')}</span>`:''}</span><span class="sp"></span>
      <button class="ib" data-a="more" aria-expanded="${!el('drawer').hidden}" type="button">${ICON.more}<span class="tx">${tx('More','Mer')}</span></button>
      <button class="ib" data-a="end" type="button">${ICON.stop}<span class="tx">${tx('End','Avslutt')}</span></button>`; }
  else if(S.step==='debrief'){ const g=S.res&&S.res.g, nxt=nextItem();
    h=`<button class="dbtn pri" data-a="again" type="button">${ICON.again}${tx('Fly again','Fly igjen')}</button><button class="ib" data-a="repo" type="button">${ICON.dice}<span class="tx">${tx('New start','Ny start')}</span></button>${S.ex!=='math'?`<button class="ib" data-a="demo" type="button">${ICON.eye}<span class="tx">${tx('Watch the instructor','Se instruktøren')}</span></button>`:''}<span class="sp"></span>
      ${g&&g.pass&&S.lv<4&&!S.res.demo?`<button class="dbtn" data-a="nextlv" type="button">${tx('Level','Nivå')} ${S.lv+1}</button>`:''}${nxt?`<button class="dbtn q" data-a="nextex" type="button">${esc(tx('Next: ','Neste: '))}${esc(itemName(nxt))}</button>`:''}`; }
  tb.innerHTML=h; tb.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a)); }
function nextItem(){ const path=CORE.indexOf(S.item)>=0?CORE:I.ITEMS.map(x=>x.id); const i=path.indexOf(S.item); for(let k=1;k<path.length;k++){ const id=path[(i+k)%path.length]; if(I.itemOk(I.ITEM[id],AREAS.practice)) return id; } return null; }
function renderDrawer(){ const d=el('drawer'); if(d.hidden) return; const vsMain=ctlList().indexOf('vs')>=0;
  d.innerHTML=`<div class="dr"><span>${tx('Time','Tid')}</span><div class="dseg" role="group">${[1,2,4].map(k=>`<button type="button" data-sp="${k}" class="${k===S.speed?'on':''}" aria-pressed="${k===S.speed}">×${k}</button>`).join('')}</div></div>
    <div class="dr"><span>${tx('Stopwatch','Stoppeklokke')}</span><span class="sw ${S.watch.on?'run':''}" id="dsw">${mmss(S.watch.t)}</span><span style="display:flex;gap:6px"><button class="ib" type="button" id="swGo">${S.watch.on?tx('Stop','Stopp'):tx('Start','Start')}</button><button class="ib" type="button" id="swRe">${tx('Reset','Nullstill')}</button></span></div>
    <div class="ctl" id="ctl2">${vsMain?'':stepper('vs',null,[-100,-50,50,100])}${stepper('spd',null,[-10,-1,1,10])}</div>
    <div class="dr" style="justify-content:flex-start"><button class="ib" data-a="repo" type="button">${ICON.dice}${tx('New start','Ny start')}</button><button class="ib" data-a="restart" type="button">${ICON.again}${tx('Restart','Start på nytt')}</button>${S.ex!=='math'?`<button class="ib" data-a="demo" type="button">${ICON.eye}${tx('Instructor flies','Instruktøren flyr')}</button>`:''}</div>`;
  d.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{ S.speed=+b.dataset.sp; renderDrawer(); renderTbar(); });
  el('swGo').onclick=toggleWatch; el('swRe').onclick=()=>{ S.watch={on:false,t:0}; renderDrawer(); };
  d.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a));
  d.querySelectorAll('#ctl2 .c[data-k]').forEach(c0=>{ const k=c0.dataset.k; c0.querySelectorAll('button[data-d]').forEach(b=>b.onclick=()=>setCtl(k,null,+b.dataset.d)); const inp=c0.querySelector('input'); inp.onchange=()=>{ const v=parseFloat(inp.value); if(Number.isFinite(v)) setCtl(k,v); }; });
  syncCtl(); }
function act(a){
  switch(a){
    case 'think': go('think'); break;
    case 'understand': go('understand'); break;
    case 'fly': if(S.step==='debrief'||S.started) setup(S.seed); go('fly'); break;
    case 'start': start(false); break;
    case 'demo': setup(S.seed); go('fly'); start(true); break;
    case 'pause': S.paused=!S.paused; renderTbar(); break;
    case 'more': { const d=el('drawer'); d.hidden=!d.hidden; renderDrawer(); renderTbar(); break; }
    case 'keys': el('keysBtn').click(); break;
    case 'repo': setup(Math.floor(Math.random()*9000)+1); go('fly'); break;
    case 'restart': setup(S.seed); go('fly'); break;
    case 'end': finish(true); break;
    case 'again': setup(S.seed); go('fly'); break;
    case 'nextlv': S.lv=Math.min(4,S.lv+1); setup(Math.floor(Math.random()*9000)+1); go('fly'); break;
    case 'nextex': { const n=nextItem(); if(n){ history.replaceState(null,'','#'+n); openItem(n,{}); } break; }
  } }
function start(demo,mistake){ S.started=true; S.run=true; S.paused=false; S.demo=!!demo; S.mistake=mistake||false; closePops(); renderBrief(); renderTbar(); renderGuide(true); renderCtl(); renderQuiz(); }

/* ---------- the guide: what to do now ----------
   The scripted pilot (ifrcore) flies alongside, unseen, on your real aircraft state. Its next command, compared with your
   selections, becomes one plain instruction: set the course, turn to a heading, set an altitude. When nothing needs doing,
   the judge's coach line says what is happening. */
const coachTxt=()=>{ const c=S.J&&S.J.coach; return c?fmt(CO[c.k]||t2('',''),pw(c.p)):''; };
const whyTxt=()=>{ const c=S.J&&S.J.coach; if(!c||!c.why||!CO[c.why]) return ''; return fmt(CO[c.why],pw(Object.assign({rod:Math.round(I.rodFor(S.sim.gs)/10)*10},c.p))); };
const turnW=d=>d>0?tx('right','høyre'):tx('left','venstre');
function action(){ const c=S.gc, s=S.sim, X=S.X, J=S.J, ex=S.ex; if(!c||!J) return null; const co=J.coach, sev=co?co.sev:'info', cl=coachTxt(), r=readNow();
  if(ex==='math') return {big:tx('Work it out in your head, then type the answer.','Regn det ut i hodet, og skriv svaret.'),sm:'',sev:'info'};
  if(ex==='orient'){ const k=X.task.kind;
    if(k==='rbi'){ const rb=Math.round(norm(r.rb)); return {big:tx(`Add them up: heading ${d3(s.hdg)} + needle ${rb}°`,`Legg sammen: kurs ${d3(s.hdg)} + nål ${rb}°`),sm:tx('Over 360? Take 360 away. Type the bearing and press Report.','Over 360? Trekk fra 360. Skriv peilingen og trykk Rapporter.'),sev:'info'}; }
    if(k==='rmi') return {big:tx('Read the tail of the green needle: that is your radial','Les halen på den grønne nålen: det er radialen din'),sm:tx('Type it and press Report.','Skriv den og trykk Rapporter.'),sev:'info'};
    const want=c.obs, off=diff(want,X.obs);
    if(Math.abs(off)>2) return {big:tx(`Turn the course knob ${off>0?'up':'down'} until the needle centres with FROM`,`Vri kursknappen ${off>0?'opp':'ned'} til nålen står midt med FROM`),sm:tx('The cyan mark on the card shows where to stop.','Det blå merket på skiven viser hvor du stopper.'),tgt:{crs:want},sev:'info'};
    return {big:tx('Centred with FROM: the course at the top is your radial. Report it.','Midt med FROM: kursen øverst er radialen din. Rapporter den.'),sm:'',sev:'good'}; }
  if(ex==='tts'){ const st=A().ST[X.task.st], b=N.bearing(s.x-st.x,s.y-st.y), ch=J.b0===undefined?0:Math.abs(diff(b,J.b0));
    if(!S.watch.on&&S.watch.t<1) return {big:tx('Start the stopwatch now','Start stoppeklokken nå'),sm:tx('Press Stopwatch (or T), then fly straight.','Trykk Stoppeklokke (eller T), og fly rett frem.'),sev:'warn'};
    if(ch<10) return {big:tx(`Fly straight. The bearing has changed ${Math.round(ch)}° of 10°.`,`Fly rett frem. Peilingen har endret seg ${Math.round(ch)}° av 10°.`),sm:tx('Watch the tail of the needle slide back.','Se halen av nålen gli bakover.'),sev:'info'};
    return {big:tx(`10° done: minutes = ${Math.round(S.watch.t)} s ÷ 10. Report it.`,`10° nådd: minutter = ${Math.round(S.watch.t)} s ÷ 10. Rapporter.`),sm:'',sev:'warn'}; }
  /* course */
  const navT=X.nav&&A().ST[X.nav]?A().ST[X.nav].type:null;
  if((navT==='VOR'||navT==='ILS')&&c.obs!=null&&Math.abs(diff(c.obs,X.obs))>2) return {big:tx(`Set the course to ${d3(c.obs)}`,`Still inn kursen ${d3(c.obs)}`),sm:tx('Turn the CRS knob, or use the , and . keys.','Vri CRS-knappen, eller bruk tastene , og .'),tgt:{crs:c.obs},sev:'info'};
  if(ex==='pass'){ const st=A().ST[X.task.st]; if(Math.hypot(s.x-st.x,s.y-st.y)<2.6&&!J.rep) return {big:tx('Hold the heading and watch the flag: press Station passage when it shows FROM','Hold kursen og følg flagget: trykk Stasjonspassering når det viser FROM'),sm:'',sev:'warn'}; }
  /* heading */
  let th=Math.round(c.hdg)||360; if(S.gTh===null||Math.abs(diff(th,S.gTh))>=3) S.gTh=th; th=S.gTh;
  const toGo=diff(th,s.hdg), dir=(c.dir&&Math.abs(toGo)>=45)?c.dir:Math.sign(toGo)||1;
  const tgt={hdg:th};
  /* altitude and rate */
  let ta=c.alt!=null?Math.round(c.alt/10)*10:null; const mins=X.task.da||X.task.mda||X.task.mins; if(ta!=null&&mins&&isApp(ex)&&ta<mins&&!(J.miss)) ta=mins;
  const vsKey=ctlList().indexOf('vs')>=0, altNeed=ta!=null&&ctlList().indexOf('alt')>=0&&Math.abs(ta-s.sel.alt)>40, vsWant=Math.round((c.vs||0)/50)*50, vsNeed=vsKey&&ta!=null&&Math.abs(ta-s.alt)>150&&Math.abs(vsWant-s.sel.vs)>=100;
  if(altNeed) tgt.alt=ta; if(vsNeed) tgt.vs=vsWant;
  if(X.pp){ const deg=Math.round(toGo/10)*10; if(Math.abs(deg)>=10&&!(S.tt&&s.t-S.tt.t0<S.tt.dur+1)) return {big:tx(`Timed turn ${turnW(deg)} ${Math.abs(deg)}° (${Math.abs(deg)/3} s)`,`Tidsstyrt sving ${turnW(deg)} ${Math.abs(deg)}° (${Math.abs(deg)/3} s)`),sm:cl,tgt:{},sev:'info'}; }
  else if(Math.abs(diff(th,s.sel.hdg))>=3) return {big:tx(`Turn ${turnW(dir)} to heading ${d3(th)}${Math.abs(toGo)>25?' now':''}`,`Sving til ${turnW(dir)} til kurs ${d3(th)}${Math.abs(toGo)>25?' nå':''}`),sm:altNeed?altLine(ta,s):reasonTxt(r,co,cl),tgt,sev:Math.abs(toGo)>25?'warn':'info'};
  if(altNeed) return {big:ta<s.alt?tx(`Descend: set altitude ${ta} ft`,`Sink: still inn høyde ${ta} ft`):tx(`Climb: set altitude ${ta} ft`,`Stig: still inn høyde ${ta} ft`),sm:vsNeed?rateLine(vsWant,ta<s.alt):cl,tgt,sev:'warn'};
  if(vsNeed) return {big:rateLine(vsWant,ta<s.alt),sm:cl,tgt,sev:'info'};
  if(!X.pp&&Math.abs(toGo)>5) return {big:tx(`Turning ${turnW(dir)} to ${d3(th)}: let it come round`,`Svinger til ${turnW(dir)} til ${d3(th)}: la den komme rundt`),sm:cl,tgt,sev:'info'};
  return {big:cl||tx('Hold it steady.','Hold det stødig.'),sm:'',tgt,sev}; }
/* a short reason under a turn instruction, without a competing number */
function reasonTxt(r,co,cl){ if(co&&co.p&&co.p.hdg===undefined&&co.p.a===undefined) return cl;
  if(r&&Number.isFinite(r.dots)&&Math.abs(r.dots)>0.3&&r.flag!=='OFF'){ const sd=r.dots>0?'R':'L'; return tx(`Needle ${sideW(sd)}: the course is on your ${sideW(sd)}.`,`Nål til ${sideW(sd)}: kursen ligger til ${sideW(sd)}.`); }
  return tx('This is the heading the instructor would fly now.','Dette er kursen instruktøren ville fløyet nå.'); }
const altLine=(ta,s)=>ta<s.alt?tx(`Then descend: set ${ta} ft.`,`Sink så: still inn ${ta} ft.`):tx(`Then climb: set ${ta} ft.`,`Stig så: still inn ${ta} ft.`);
const rateLine=(v,down)=>down?tx(`Set the descent rate (VS) to ${v} ft/min`,`Still inn sinkraten (VS) ${v} ft/min`):tx(`Set the climb rate (VS) to ${v} ft/min`,`Still inn stigeraten (VS) ${v} ft/min`);
/* targets shown on the instrument and the controls: guided, a third hint, or the instructor flying */
const showHelp=()=>S.help==='guided'||S.demo||(S.help==='hints'&&S.hint>=3);
let ACT=null;
function targetsNow(){ if(S.step!=='fly'||!S.started||!showHelp()||!ACT) return null; return ACT.tgt||null; }
let guideKey='';
function renderGuide(force){ const g=el('guide'); if(S.step!=='fly'||!S.started){ g.hidden=true; return; } g.hidden=false;
  ACT=action(); const co=S.J.coach;
  if(S.help==='hints'&&co&&co.k!==S.hintK){ S.hintK=co.k; S.hint=0; }
  let big='',sm='',cls='info',btns='';
  const why=whyTxt(), whyB=why?`<button type="button" class="pill" id="gWhy" aria-expanded="${S.showWhy}">${tx('Why?','Hvorfor?')}<kbd>W</kbd></button>`:'';
  if(S.demo){ big=ACT?tx('The instructor: ','Instruktøren: ')+ACT.big.charAt(0).toLowerCase()+ACT.big.slice(1):''; sm=coachTxt(); cls='info'; btns=whyB; }
  else if(S.help==='guided'){ if(ACT){ big=ACT.big; sm=ACT.sm; cls=ACT.sev||'info'; } btns=whyB; }
  else if(S.help==='hints'){ btns=`<button type="button" class="pill" id="gHint">${S.hint===0?tx('Hint','Hint'):S.hint<3?tx('More help','Mer hjelp'):tx('Hint','Hint')}<kbd>H</kbd></button>`+whyB;
    if(S.hint===0){ big=tx('Flying with hints. Stuck? Ask for a hint.','Flyr med hint. Står du fast? Be om et hint.'); cls='quiet'; }
    else if(S.hint===1){ big=coachTxt()||tx('Hold it steady.','Hold det stødig.'); cls=co?co.sev:'info'; }
    else { big=ACT?ACT.big:''; sm=coachTxt(); cls=ACT?ACT.sev:'info'; } }
  else { big=tx('Flying alone. “Why?” explains the current step.','Flyr alene. «Hvorfor?» forklarer steget nå.'); cls='quiet'; btns=whyB; }
  const key=[big,sm,cls,btns,S.showWhy,why].join('|'); if(!force&&key===guideKey) return; guideKey=key;
  g.className='guide '+cls;
  g.innerHTML=`<span class="mk" aria-hidden="true">${cls==='good'?ICON.check:cls==='warn'?ICON.warn:cls==='quiet'?ICON.solo:ICON.arrow}</span><div class="gx"><span class="big">${esc(big)}</span>${sm?`<span class="sm">${esc(sm)}</span>`:''}${S.showWhy&&why?`<span class="wt">${esc(why)}</span>`:''}</div><div class="gb">${btns}</div>`;
  if(el('gWhy')) el('gWhy').onclick=()=>{ S.showWhy=!S.showWhy; renderGuide(true); };
  if(el('gHint')) el('gHint').onclick=hintMore;
  /* the controls that need touching glow */
  qa('#ctl .c').forEach(c=>c.classList.remove('tgt')); qa('#ctl small[id^="tg-"]').forEach(s=>s.textContent='');
  const T=targetsNow(); if(T){ const mark=(k,v)=>{ const c=q(`#ctl .c[data-k="${k}"]`); if(c){ c.classList.add('tgt'); const s=el('tg-'+k); if(s) s.textContent='→ '+v; } };
    if(T.crs!=null&&Math.abs(diff(T.crs,S.X.obs))>2) mark('crs',d3(T.crs)); if(T.hdg!=null&&Math.abs(diff(T.hdg,S.sim.sel.hdg))>=3&&!S.X.pp) mark('hdg',d3(T.hdg)); if(T.alt!=null) mark('alt',T.alt); if(T.vs!=null) mark('vs',T.vs); }
  if(S.ex==='math') renderQuiz(); }
function hintMore(){ if(S.hint<3){ S.hint++; S.hintsUsed++; } S.hintK=S.J.coach&&S.J.coach.k; renderGuide(true); }

/* ---------- key moments: a short pause and the explanation (Guided) ---------- */
const MOM={'int.lead':t2('The needle is moving','Nålen beveger seg'),'arc.turnsoon':t2('Onto the arc','Inn på buen'),'arc.leadradial':t2('The lead radial','Den ledende radialen'),
  'hold.entryturn':t2('Turn back to the fix','Sving tilbake til fiksen'),'hold.turnout':t2('Over the fix','Over fiksen'),'pt.turn45':t2('The first turn','Den første svingen'),'pt.turn180':t2('The turn back','Svingen tilbake'),
  'pt.turn260':t2('The turn back','Svingen tilbake'),'base.turn':t2('Time is up','Tiden er ute'),'vor.faf':t2('The final approach fix','Final approach fix'),'app.faf':t2('The final approach fix','Final approach fix'),
  'app.gpfaf':t2('The glide path','Glidebanen'),'ils.alive':t2('The localiser comes alive','Localiseren blir levende'),'ils.waitgs':t2('Established on the localiser','Etablert på localiseren'),
  'miss.climb':t2('Minimums: no runway','Minima: ingen rullebane'),'rt.turn':t2('A waypoint ahead','Et waypoint foran'),'pass.watch':t2('Close to the station','Nær stasjonen'),'tts.report':t2('10° done','10° nådd'),
  'ip.wait':t2('Over the station','Over stasjonen'),'hold.near':t2('Before the fix: which entry?','Før fiksen: hvilken inngang?')};
function checkMoment(){ if(S.help!=='guided'||S.demo||S.pause||!S.J) return; const co=S.J.coach; let k=co&&MOM[co.k]?co.k:null;
  if(S.ex==='holdEntry'&&S.J.phase==='tofix'){ const F=I.fixOf(A(),S.X.task); if(Math.hypot(S.sim.x-F.x,S.sim.y-F.y)<1.7) k='hold.near'; }
  if(k&&!S.moments[k]){ S.moments[k]=1; pauseAt(k); } }
function pauseAt(k){ S.pause=k; S.paused=true; ACT=action(); const T=S.X.task;
  let txt=whyTxt(), doo=ACT?ACT.big:'';
  if(k==='hold.near'){ const e=H.entry(T.inb,T.dir,S.sim.hdg), nm=L(W.entry[e.entry]); txt=tx(`You will cross the fix heading ${d3(S.sim.hdg)}. That puts you in the ${nm} sector.`,`Du krysser fiksen på kurs ${d3(S.sim.hdg)}. Det gir ${nm}-sektoren.`)+' '+L(CO['hold.entry.'+e.entry+'.why']);
    doo=fmt(CO['hold.entry.'+e.entry],pw({out:T.out,td:norm(T.out-T.dir*30),dir:T.dir>0?'R':'L'})); }
  const p=el('pausec'); p.hidden=false;
  p.innerHTML=`<span class="k">${tx('Paused: a key moment','Pause: et viktig øyeblikk')}</span><b id="pauseB">${esc(L(MOM[k]))}</b>${txt?`<p>${esc(txt)}</p>`:''}${doo?`<p class="do">${esc(tx('Now: ','Nå: ')+doo)}</p>`:''}<div class="row2"><button type="button" class="dbtn pri" id="pGo">${tx('Continue','Fortsett')}</button><span style="font-size:12.5px;color:var(--ni3)">Enter</span></div>`;
  el('pGo').onclick=resumePause; el('pGo').focus({preventScroll:true}); renderTbar(); }
function resumePause(){ S.pause=null; S.paused=false; el('pausec').hidden=true; renderTbar(); }

/* ---------- mental maths: the question card ---------- */
let quizKey='';
function renderQuiz(){ const box=el('quiz'), mc=el('mathcard'); if(S.ex!=='math'){ box.innerHTML=''; mc.hidden=true; quizKey=''; return; }
  const T=S.X.task, J=S.J, qi=Math.min(J.qi||0,T.n-1), Q=T.qs[qi], P=mathParams(Q), M=MATHQ[Q.kind], last=(J.answers||[])[J.answers?J.answers.length-1:0];
  const nm=S.help==='guided'?2:S.help==='hints'?Math.min(S.hint,3):0;
  const key=[qi,nm,J.answers?J.answers.length:0,S.started,LAB.lang].join('|'); if(key===quizKey) return; quizKey=key;
  const lastQ=last?T.qs[last.qi]:null;
  box.innerHTML=`<span class="qn">${tx('Question','Spørsmål')} ${qi+1} ${tx('of','av')} ${T.n} · ${esc(L(MATHN[Q.kind]))}</span><p class="qq">${esc(fmt(M.q,P))}</p>
    ${S.started&&!J.done?`<div class="ans"><input id="mathIn" inputmode="decimal" autocomplete="off" aria-label="${esc(tx('Your answer','Svaret ditt'))}"><span>${Q.unit}</span><button type="button" class="dbtn pri" id="mathGo">${tx('Answer','Svar')}</button></div>`:''}
    ${nm?`<ol class="meth">${M.m.slice(0,Math.min(nm,2)).map(m=>`<li>${esc(fmt(m,P))}</li>`).join('')}</ol>`:''}
    ${last&&lastQ?`<p class="last ${last.ok?'ok':'no'}">${last.ok?tx('Right. ','Riktig. '):tx('Not quite. ','Ikke helt. ')}${esc(M===MATHQ[lastQ.kind]&&false?'':fmt(MATHQ[lastQ.kind].m[2],mathParams(lastQ)))}</p>`:''}`;
  const inp=el('mathIn'); if(inp){ const send=()=>{ const v=parseFloat(String(inp.value).replace(',','.')); if(!Number.isFinite(v)){ inp.focus(); return; } report(v); inp.value=''; };
    el('mathGo').onclick=send; inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); send(); } }); if(S.started&&document.activeElement.tagName!=='INPUT') inp.focus({preventScroll:true}); }
  mc.hidden=S.help==='off'&&S.started;
  mc.innerHTML=`<h3>${tx('Rules of thumb','Tommelfingerregler')}</h3><ol>${MATHU.slice(1).concat([t2('Intercept: course ± 30° or 45°, towards the needle. Time to station: seconds ÷ degrees.','Interception: kurs ± 30° eller 45°, mot nålen. Tid til stasjon: sekunder ÷ grader.'),t2('Turn radius ≈ ground speed ÷ 200 NM. Lead radial ≈ 60 × radius ÷ DME.','Svingradius ≈ fart over bakken ÷ 200 NM. Ledende radial ≈ 60 × radius ÷ DME.')]).map(m=>`<li>${esc(L(m))}</li>`).join('')}</ol>`; }

/* ---------- Understand: the walk-through ---------- */
const uSteps=()=>S.ex==='math'?MATHU.map(s=>({s,static:true})):uwFor(S.item).concat([{s:TRY,try:true}]);
function segIdx(st){ const P=S.ideal||[]; if(!P.length||!st.seg) return {i0:0,i1:Math.max(0,P.length-1)};
  if(typeof st.seg[0]==='number'){ const t1=P[P.length-1].t; const a=P.findIndex(p=>p.t>=st.seg[0]*t1), b=P.findIndex(p=>p.t>=st.seg[1]*t1); return {i0:Math.max(0,a),i1:b<0?P.length-1:Math.max(a+1,b)}; }
  let a=-1,b=-1; P.forEach((p,i)=>{ if(st.seg.indexOf(p.ph)>=0){ if(a<0) a=i; b=i; } }); if(a<0) return {i0:0,i1:P.length-1}; return {i0:a,i1:Math.max(a+1,b)}; }
function setUStep(i,quiet){ const st=uSteps(); S.uStep=clamp(i,0,st.length-1); S.uT=0; const cur=st[S.uStep];
  if(cur.try){ S.u={x:S.X.ac.x,y:S.X.ac.y,hdg:S.X.ac.hdg,alt:S.X.ac.alt,ias:S.X.ac.ias,gs:S.X.ac.ias,trk:S.X.ac.hdg,obs:S.X.obs}; }
  S.useg=segIdx(cur); if(!quiet){ renderLesson(); renderTbar(); renderLegend(); } }
function uNext(){ const n=uSteps().length; if(S.uStep<n-1) setUStep(S.uStep+1); else act(S.think?'think':'fly'); }
function renderLesson(){ const st=uSteps(), cur=st[S.uStep], n=st.length, last=S.uStep===n-1;
  el('lesson').innerHTML=`<div class="uh"><div class="udots" role="group" aria-label="${esc(tx('Steps','Steg'))}">${st.map((s,i)=>`<button type="button" data-u="${i}" class="${i===S.uStep?'on':i<S.uStep?'done':''}" aria-label="${tx('Step','Steg')} ${i+1}" aria-current="${i===S.uStep?'step':'false'}"></button>`).join('')}</div><span class="uc">${S.uStep+1} ${tx('of','av')} ${n}</span></div>
    <p class="us" aria-live="polite">${esc(L(cur.s))}</p><div class="live" id="uLive"></div>
    <div class="unav">${S.uStep>0?`<button type="button" class="dbtn q" id="uBack">${tx('Back','Tilbake')}</button>`:''}<span class="sp"></span><button type="button" class="dbtn pri" id="uNext">${last?(S.think?tx('Think first','Tenk først'):tx('Fly it','Fly den')):tx('Next','Neste')}</button></div>`;
  el('lesson').querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>setUStep(+b.dataset.u));
  if(el('uBack')) el('uBack').onclick=()=>setUStep(S.uStep-1); el('uNext').onclick=uNext; }
function idealAt(t){ const P=S.ideal; if(!P||!P.length) return null; let lo=0,hi=P.length-1; if(t<=P[0].t) return P[0]; if(t>=P[hi].t) return P[hi];
  while(hi-lo>1){ const m=(lo+hi)>>1; if(P[m].t<=t) lo=m; else hi=m; } const a=P[lo], b=P[hi], k=(t-a.t)/Math.max(1e-6,b.t-a.t);
  return {t,x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,h:norm(a.h+diff(b.h,a.h)*k),alt:a.alt+(b.alt-a.alt)*k,obs:a.obs,vs:a.vs,gs:a.gs,bank:a.bank,ias:a.ias,ph:a.ph}; }
function animU(dt){ const st=uSteps()[S.uStep]; if(!st||st.try||st.static||!S.ideal||!S.useg) return; const P=S.ideal, a=P[S.useg.i0], b=P[S.useg.i1]; if(!a||!b) return;
  const dur=clamp((b.t-a.t)/14,3.2,7); S.uT+=dt; const k=reduced()?1:Math.min(1,S.uT/dur); if(S.uT>dur+1.4) S.uT=0;
  const p=idealAt(a.t+(b.t-a.t)*k); if(p){ S.u={x:p.x,y:p.y,hdg:p.h,alt:p.alt,ias:p.ias||120,gs:p.gs||120,trk:p.h,obs:p.obs!==undefined?p.obs:S.X.obs,vs:p.vs||0,bank:p.bank||0,t:p.t}; } }

/* ---------- Think first ---------- */
function renderThink(){ const T=S.think, box=el('think'); if(!T){ box.innerHTML=''; return; }
  const cap=x=>x.charAt(0).toUpperCase()+x.slice(1);
  const ans=S.thinkAns, X=S.X, opt=v=>typeof v==='number'?(T.kind==='arclead'?nf1(v)+' NM':T.kind==='profile'||T.kind==='proftime'?v+' ft':T.kind==='rod'?v+' ft/min':T.kind==='ttsq'?String(v).replace('.',no()?',':'.')+' min':T.kind==='locq'?v+'×':d3(v))
    :T.kind==='passq'?L({flag:t2('The TO/FROM flag flips','TO/FROM-flagget skifter'),needle:t2('The needle swings','Nålen svinger'),dme:t2('The DME reads 0','DME-en viser 0')}[v]):cap(T.kind==='entry'?L(W.entry[v]):sideW(v));
  let qx='';
  switch(T.kind){
    case 'radial': qx=tx(`The RMI needle points to <b>${d3(T.qdm)}</b>. Which radial are you on?`,`RMI-nålen peker på <b>${d3(T.qdm)}</b>. Hvilken radial er du på?`); break;
    case 'qdm': qx=tx(`Heading <b>${d3(T.hdg)}</b>, the ADF needle shows <b>${T.rb}°</b>. Bearing to the beacon?`,`Kurs <b>${d3(T.hdg)}</b>, ADF-nålen viser <b>${T.rb}°</b>. Peiling til fyret?`); break;
    case 'needle': qx=tx('Flying inbound with TO, the needle is right of centre. Where is the course?','Inn mot stasjonen med TO står nålen til høyre. Hvor ligger kursen?'); break;
    case 'wca': qx=tx(`Course <b>${d3(T.crs)}</b>, TAS <b>${T.tas}</b> kt, wind <b>${d3(T.w.dir)}/${T.w.spd}</b>. Which heading holds the course?`,`Kurs <b>${d3(T.crs)}</b>, TAS <b>${T.tas}</b> kt, vind <b>${d3(T.w.dir)}/${T.w.spd}</b>. Hvilken kurs holder sporet?`); break;
    case 'intercept': qx=tx(`You are on radial <b>${d3(T.radial)}</b>, cleared to intercept <b>${d3(T.crs)}</b> ${T.inbound?'inbound':'outbound'}. Intercept heading?`,`Du er på radial <b>${d3(T.radial)}</b> og skal fange <b>${d3(T.crs)}</b> ${T.inbound?'inn':'ut'}. Interceptkurs?`); break;
    case 'arclead': qx=tx(`Joining a <b>${T.R} DME</b> arc at <b>${T.tas}</b> kt: how far before the arc do you start the 90° turn?`,`Inn på en <b>${T.R} DME</b>-bue i <b>${T.tas}</b> kt: hvor langt før buen starter du svingen på 90°?`); break;
    case 'entry': qx=tx(`Inbound <b>${d3(T.inb)}</b>, ${T.dir>0?'right':'left'} turns. You will cross the fix heading <b>${d3(T.hdg)}</b>. Which entry?`,`Inngående <b>${d3(T.inb)}</b>, ${T.dir>0?'høyresvinger':'venstresvinger'}. Du krysser fiksen på kurs <b>${d3(T.hdg)}</b>. Hvilken inngang?`); break;
    case 'holdwca': qx=tx(`Inbound you need <b>${Math.abs(T.wca)}°</b> of correction (heading <b>${d3(T.hdgIn)}</b>). Which heading outbound?`,`Inn trenger du <b>${Math.abs(T.wca)}°</b> korreksjon (kurs <b>${d3(T.hdgIn)}</b>). Hvilken kurs flyr du ut?`); break;
    case 'ptdir': qx=tx(`After the ${T.a}° turn ${T.side>0?'right':'left'}: which way is the turn back?`,`Etter ${T.a}°-svingen til ${T.side>0?'høyre':'venstre'}: hvilken vei går svingen tilbake?`); break;
    case 'basedir': qx=tx(`When the outbound time is up, which way do you turn onto course <b>${d3(X.task.inb)}</b>?`,`Når tiden ut er ferdig: hvilken vei svinger du inn på kurs <b>${d3(X.task.inb)}</b>?`); break;
    case 'profile': qx=tx(`On the 3° profile, what altitude at <b>${T.dme} DME</b>?`,`På 3°-profilen: hvilken høyde ved <b>${T.dme} DME</b>?`); break;
    case 'proftime': qx=tx(`On the 3° profile, what altitude <b>${T.t} s</b> after the FAF?`,`På 3°-profilen: hvilken høyde <b>${T.t} s</b> etter FAF?`); break;
    case 'rod': qx=tx(`Ground speed <b>${T.gs}</b> kt on a 3° path. Rate of descent?`,`Fart over bakken <b>${T.gs}</b> kt på en bane på 3°. Sinkrate?`); break;
    case 'rtturn': qx=tx(`At <b>${T.wp}</b> the next leg is <b>${d3(T.crs)}</b>. Which way do you turn?`,`Ved <b>${T.wp}</b> er neste legg <b>${d3(T.crs)}</b>. Hvilken vei svinger du?`); break;
    case 'passq': qx=tx('How do you know you have passed a VOR?','Hvordan vet du at du har passert en VOR?'); break;
    case 'ttsq': qx=tx('Station on the wingtip, the bearing changes 10° in 90 s. Time to the station?','Stasjonen på vingetippen, peilingen endres 10° på 90 s. Tid til stasjonen?'); break;
    case 'locq': qx=tx('How much more sensitive is a localiser than a VOR?','Hvor mye mer følsom er en localiser enn en VOR?'); break;
  }
  const why=()=>{ const a=opt(T.ans);
    switch(T.kind){
      case 'radial': return tx(`The radial is the tail: ${d3(T.qdm)} ± 180 = ${a}.`,`Radialen er halen: ${d3(T.qdm)} ± 180 = ${a}.`);
      case 'qdm': return tx(`Heading + needle: ${d3(T.hdg)} + ${T.rb} = ${a} (take 360 away if it goes over).`,`Kurs + nål: ${d3(T.hdg)} + ${T.rb} = ${a} (trekk fra 360 hvis den går over).`);
      case 'needle': return tx('Needle right, course right. Turn towards the needle.','Nål til høyre, kurs til høyre. Sving mot nålen.');
      case 'wca': return tx(`The wind is from the ${sideW(T.wca>0?'R':'L')}: point into it, about ${Math.abs(T.wca)}°, heading ${a}.`,`Vinden kommer fra ${sideW(T.wca>0?'R':'L')}: hold opp mot den, rundt ${Math.abs(T.wca)}°, kurs ${a}.`);
      case 'intercept': return tx(`The course lies towards the needle; the course ± ${T.inbound?30:45}° towards it gives ${a}.`,`Kursen ligger mot nålen; kursen ± ${T.inbound?30:45}° mot den gir ${a}.`);
      case 'arclead': return tx(`About one turn radius: ${a} at this speed.`,`Omtrent én svingradius: ${a} i denne farten.`);
      case 'entry': return tx(`${a}${T.alt?` (within 5° of a line, so ${L(W.entry[T.alt])} is fine too)`:''}. Picture your heading on the fix and the 70° line.`,`${a}${T.alt?` (innenfor 5° av en linje, også ${L(W.entry[T.alt])})`:''}. Se for deg kursen din over fiksen og 70°-linjen.`);
      case 'holdwca': return tx(`Three times, the other way: ${a}.`,`Tre ganger, motsatt vei: ${a}.`);
      case 'ptdir': return tx(`The opposite way to the first turn: ${a}, away from the station.`,`Motsatt vei av den første svingen: ${a}, vekk fra stasjonen.`);
      case 'basedir': return tx(`Towards the final course: ${a}.`,`Mot sluttkursen: ${a}.`);
      case 'profile': case 'proftime': return tx(`From the table: ${a}.`,`Fra tabellen: ${a}.`);
      case 'rod': return tx(`Ground speed × 5 ≈ ${T.gs*5}; exactly ${a}.`,`Fart over bakken × 5 ≈ ${T.gs*5}; nøyaktig ${a}.`);
      case 'rtturn': return tx(`The new course is to the ${sideW(T.ans)}: turn ${sideW(T.ans)}.`,`Den nye kursen ligger til ${sideW(T.ans)}: sving til ${sideW(T.ans)}.`);
      case 'passq': return tx('The flag flips from TO to FROM. The needle also swings before, so it alone is not enough.','Flagget skifter fra TO til FROM. Nålen svinger også før, så den alene er ikke nok.');
      case 'ttsq': return tx('Seconds ÷ degrees: 90 ÷ 10 = 9 minutes.','Sekunder ÷ grader: 90 ÷ 10 = 9 minutter.');
      case 'locq': return tx('Full scale is about 2.5° instead of 10°: four times.','Fullt utslag er rundt 2,5° i stedet for 10°: fire ganger.');
    } return ''; };
  const isTxt=typeof T.opts[0]==='string', answered=ans!==null&&ans!==undefined;
  box.innerHTML=`<h3>${tx('Think first','Tenk først')}</h3><p class="q">${qx}</p><div class="opts">${T.opts.map((v,i)=>`<button type="button" data-i="${i}" class="${isTxt?'txt':''} ${answered?(v===T.ans||v===T.alt?'right':(i===ans?'wrong':'')):''}" ${answered?'disabled':''}>${esc(opt(v))}</button>`).join('')}</div>`+
    (answered?`<p class="fb ${T.opts[ans]===T.ans||T.opts[ans]===T.alt?'':'no'}">${esc((T.opts[ans]===T.ans||T.opts[ans]===T.alt?tx('Right. ','Riktig. '):tx('Not quite. ','Ikke helt. '))+why())}</p>`:'');
  box.querySelectorAll('.opts button').forEach(b=>b.onclick=()=>{ S.thinkAns=+b.dataset.i; renderThink(); renderTbar(); }); }

/* ---------- Debrief ---------- */
function scoreCls(v){ return v>=80?'':v>=55?'mid':'low'; }
function renderDeb(){ const R=S.res, box=el('deb'); if(!R){ box.innerHTML=''; return; }
  const g=R.g, f=g.first, ev=S.J.ev;
  const timeTxt={established:t2('time to get established','tid til etablert'),decision:t2('time to choose an intercept heading','tid til valgt interceptkurs'),answer:t2('time per answer','tid per svar'),arcjoin:t2('lead onto the arc','ledning inn på buen'),arcleave:t2('lead radial off the arc','ledende radial ut av buen'),
    entryleg:t2('entry leg time','tid på inngangslegget'),inleg:t2('inbound leg times','tid på inngående legg'),ptout:t2('outbound time','tid ut'),pt45:t2('time on the first leg','tid på første legg'),baseout:t2('outbound time','tid ut'),descent:t2('descent started at the FAF','nedstigning startet ved FAF'),
    gsdescent:t2('descent started on the glide slope','nedstigning startet på glidebanen'),goaround:t2('go-around started at the minimums','go-around startet ved minima'),wp:t2('waypoints crossed on track','waypoints krysset på sporet'),passrep:t2('passage reported on time','passering rapportert i tide'),dmelim:t2('turn at the DME limit','sving ved DME-grensen')};
  const tk=[...new Set(S.J.times.map(x=>x.k))].map(k=>L(timeTxt[k]||t2(k,k))).join(', ');
  const verdict=R.demo?tx('Demonstration','Demonstrasjon'):g.pass?tx(`Level ${S.lv} passed`,`Nivå ${S.lv} bestått`):tx('Not yet','Ikke helt ennå');
  const sub=R.demo?tx('This is how the instructor flies it. Your turn now.','Slik flyr instruktøren den. Nå er det din tur.'):g.pass?(S.lv<4?tx(`Try level ${S.lv+1}: ${L(W.level[S.lv+1])}.`,`Prøv nivå ${S.lv+1}: ${L(W.level[S.lv+1])}.`):tx('All levels passed.','Alle nivåer bestått.')):tx('75 or more and no procedure error to pass.','75 eller mer og ingen prosedyrefeil for å bestå.');
  let card;
  if(f){ const E=EV[f.code]||EV.outside, raw=/^(tts|math)\./.test(f.code), p=pw(f.p,raw);
    let extra=''; if(f.code==='math.wrong'){ const Q=S.X.task.qs[f.p.qi]; if(Q){ const P=mathParams(Q); extra=`<p>${esc(fmt(MATHQ[Q.kind].q,P))}</p><p class="do">${esc(MATHQ[Q.kind].m.map(m=>fmt(m,P)).join(' '))}</p>`; } }
    card=`<div class="mist ${f.sev==='warn'?'warn':''}" id="mistCard" role="button" tabindex="0" aria-label="${esc(tx('Show it on the map','Vis det på kartet'))}"><div class="h"><b>${esc((f.sev==='err'?tx('First mistake: ','Første feil: '):tx('To tidy up: ','Å rydde opp i: '))+L(E.h))}</b><span>${mmss(f.t)}</span></div><p>${esc(fmt(E.w,p))}</p>${extra||(L(E.d)?`<p class="do">${esc(fmt(E.d,p))}</p>`:'')}</div>`; }
  else card=`<div class="mist clean"><div class="h"><b>${tx('Clean run','Ren runde')}</b><span>${mmss(S.sim.t)}</span></div><p>${esc(S.ex==='math'?tx('Every answer right.','Alle svar riktige.'):tx('No mistakes. The dashed line is the instructor’s path: compare the shapes.','Ingen feil. Den stiplede linjen er instruktørens bane: sammenlign formene.'))}</p></div>`;
  const others=ev.filter(e=>e!==f&&e.sev!=='info'&&!/\.(ok|entryok)$/.test(e.code)).slice(0,5);
  const help=R.demo?'':S.help==='guided'?tx('Flown with Guided help.','Fløyet med veiledning.'):S.help==='hints'?tx(`Flown with hints: ${S.hintsUsed} used.`,`Fløyet med hint: ${S.hintsUsed} brukt.`):tx('Flown alone.','Fløyet alene.');
  box.innerHTML=`<div class="res"><div class="tot">${g.total}<small>/100</small></div><div class="verdict ${g.pass||R.demo?'':'no'}">${esc(verdict)}</div><div class="sub">${esc(sub)} ${esc(help)}</div></div>
    <div class="bars">
      <span>${tx('Accuracy','Nøyaktighet')}</span><div class="b"><i class="${scoreCls(g.acc)}" style="width:${g.acc}%"></i></div><b>${g.acc}</b><em>${esc(tx('Time inside the limits, weighted by how far out you were','Tid innenfor grensene, vektet mot hvor langt ute du var'))}</em>
      <span>${tx('Timing','Timing')}</span><div class="b"><i class="${scoreCls(g.time??100)}" style="width:${g.time??0}%"></i></div><b>${g.time===null?'–':g.time}</b><em>${esc(tk||tx('No timing items in this exercise','Ingen tidskrav i denne øvelsen'))}</em>
      <span>${tx('Procedure','Prosedyre')}</span><div class="b"><i class="${scoreCls(g.proc)}" style="width:${g.proc}%"></i></div><b>${g.proc}</b><em>${esc(tx('Right direction, entry, order and altitudes','Riktig retning, inngang, rekkefølge og høyder'))}</em>
    </div>${card}
    ${others.length?`<ul class="evs">${others.map(e=>{ const E=EV[e.code]||EV.outside; return `<li data-t="${e.t}"><span class="t">${mmss(e.t)}</span><i class="${e.sev}"></i><span>${esc(L(E.h))}</span></li>`; }).join('')}</ul>`:''}
    ${S.peeks?`<p class="sub">${esc(tx(`You peeked at the map ${S.peeks} time${S.peeks>1?'s':''}.`,`Du kikket på kartet ${S.peeks} gang${S.peeks>1?'er':''}.`))}</p>`:''}`;
  const mc=el('mistCard'); if(mc){ const goT=()=>{ S.scrub=f.t; S.replay=false; renderPlay(); }; mc.onclick=goT; mc.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); goT(); } }; }
  box.querySelectorAll('.evs li').forEach(li=>li.onclick=()=>{ S.scrub=+li.dataset.t; S.replay=false; renderPlay(); }); }
/* ---------- the glass PFD with an electronic HSI ---------- */
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
const PF={hdg:null,ias:null,alt:null,bank:0};
function drawPFD(v,dt){ const g=pfdG, Wp=pfdW, Hp=pfdH; if(!Wp) return; g.setTransform(pfdDpr,0,0,pfdDpr,0,0); g.clearRect(0,0,Wp,Hp);
  const u=Wp/100; const k=Math.min(1,dt*6);
  PF.hdg= PF.hdg===null||reduced()? v.hdg : norm(PF.hdg+diff(v.hdg,PF.hdg)*k); PF.ias= PF.ias===null?v.ias:PF.ias+(v.ias-PF.ias)*k; PF.alt=PF.alt===null?v.alt:PF.alt+(v.alt-PF.alt)*k; PF.bank+=(v.bank-PF.bank)*k;
  g.fillStyle='#05080B'; rr(g,0,0,Wp,Hp,u*2.2); g.fill();
  /* attitude */
  const ax=u*17, aw=u*66, ay=u*7, ah=u*48, cx=ax+aw/2, cy=ay+ah/2, pitch=clamp(v.pitch,-20,20), ppd=ah/40;
  g.save(); rr(g,ax,ay,aw,ah,u*1.5); g.clip(); g.translate(cx,cy); g.rotate(-PF.bank*D2R);
  const sk=g.createLinearGradient(0,-ah,0,0); sk.addColorStop(0,'#1D5FA6'); sk.addColorStop(1,'#4C8FD0'); g.fillStyle=sk; g.fillRect(-aw,-ah*1.5+pitch*ppd,aw*2,ah*1.5);
  const gr=g.createLinearGradient(0,0,0,ah); gr.addColorStop(0,'#7A4E25'); gr.addColorStop(1,'#4A2E14'); g.fillStyle=gr; g.fillRect(-aw,pitch*ppd,aw*2,ah*1.5);
  g.strokeStyle='#fff'; g.lineWidth=Math.max(1,u*0.35); g.beginPath(); g.moveTo(-aw,pitch*ppd); g.lineTo(aw,pitch*ppd); g.stroke();
  g.font=`500 ${u*2.6}px ${FM}`; g.fillStyle='#fff'; g.textAlign='right'; g.textBaseline='middle';
  for(const p of [-15,-10,-5,-2.5,2.5,5,10,15]){ const y=(pitch-p)*ppd, w=Math.abs(p)%5===0?(Math.abs(p)%10===0?u*9:u*5):u*2.6; g.beginPath(); g.moveTo(-w,y); g.lineTo(w,y); g.stroke(); if(Math.abs(p)%10===0){ g.fillText(String(Math.abs(p)),-w-u*1,y); } }
  g.restore();
  /* bank scale */
  g.save(); g.translate(cx,cy); const br=ah*0.44; g.strokeStyle='#fff'; g.lineWidth=Math.max(1,u*0.35);
  g.beginPath(); g.arc(0,0,br,(-90-60)*D2R,(-90+60)*D2R); g.stroke();
  for(const a of [-60,-45,-30,-20,-10,10,20,30,45,60]){ const t=(a-90)*D2R, l=Math.abs(a)%30===0?u*2.6:u*1.5; g.beginPath(); g.moveTo(Math.cos(t)*br,Math.sin(t)*br); g.lineTo(Math.cos(t)*(br+l),Math.sin(t)*(br+l)); g.stroke(); }
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(0,-br); g.lineTo(-u*1.4,-br-u*2.2); g.lineTo(u*1.4,-br-u*2.2); g.closePath(); g.fill();
  g.rotate(-PF.bank*D2R); g.fillStyle='#F5D547'; g.beginPath(); g.moveTo(0,-br+u*0.4); g.lineTo(-u*1.5,-br+u*2.6); g.lineTo(u*1.5,-br+u*2.6); g.closePath(); g.fill(); g.restore();
  /* aircraft symbol */
  g.save(); g.translate(cx,cy); g.fillStyle='#F5D547'; g.strokeStyle='#000'; g.lineWidth=1;
  g.beginPath(); g.moveTo(-u*14,-u*0.6); g.lineTo(-u*5,-u*0.6); g.lineTo(-u*5,u*2.4); g.lineTo(-u*6.4,u*2.4); g.lineTo(-u*6.4,u*0.8); g.lineTo(-u*14,u*0.8); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(u*14,-u*0.6); g.lineTo(u*5,-u*0.6); g.lineTo(u*5,u*2.4); g.lineTo(u*6.4,u*2.4); g.lineTo(u*6.4,u*0.8); g.lineTo(u*14,u*0.8); g.closePath(); g.fill(); g.stroke();
  g.fillRect(-u*0.8,-u*0.8,u*1.6,u*1.6); g.restore();
  /* localiser and glide slope scales on the attitude */
  if(v.ils){ const dd=u*3.2; g.strokeStyle='#fff'; g.lineWidth=1;
    for(const i of [-2,-1,1,2]){ g.beginPath(); g.arc(ax+aw-u*3.2,cy+i*dd,u*0.8,0,TAU); g.stroke(); g.beginPath(); g.arc(cx+i*dd*1.6,ay+ah-u*3,u*0.8,0,TAU); g.stroke(); }
    const dia=(x,y)=>{ g.fillStyle='#F06BB4'; g.beginPath(); g.moveTo(x,y-u*1.6); g.lineTo(x+u*1.2,y); g.lineTo(x,y+u*1.6); g.lineTo(x-u*1.2,y); g.closePath(); g.fill(); };
    if(v.gsOk) dia(ax+aw-u*3.2,cy-clamp(v.gsDots*0.4,-2.4,2.4)*dd);
    if(v.flag!=='OFF') dia(cx+clamp(v.dev,-2.4,2.4)*dd*1.6,ay+ah-u*3); }
  /* speed tape */
  const sx=u*2, sw=u*12;
  g.save(); g.fillStyle='rgba(40,48,56,.85)'; g.fillRect(sx,ay,sw,ah); g.beginPath(); g.rect(sx,ay,sw,ah); g.clip();
  const kpx=ah/50; g.strokeStyle='#fff'; g.fillStyle='#fff'; g.font=`500 ${u*2.9}px ${FM}`; g.textAlign='right'; g.textBaseline='middle';
  for(let s0=Math.floor((PF.ias-30)/5)*5;s0<=PF.ias+30;s0+=5){ if(s0<0) continue; const y=cy-(s0-PF.ias)*kpx; g.beginPath(); g.moveTo(sx+sw-u*2,y); g.lineTo(sx+sw,y); g.stroke(); if(s0%10===0) g.fillText(String(s0),sx+sw-u*2.8,y); }
  g.restore();
  g.fillStyle='#000'; g.strokeStyle='#fff'; g.lineWidth=1; g.beginPath(); g.moveTo(sx,cy-u*3); g.lineTo(sx+sw-u*0.6,cy-u*3); g.lineTo(sx+sw+u*1.2,cy); g.lineTo(sx+sw-u*0.6,cy+u*3); g.lineTo(sx,cy+u*3); g.closePath(); g.fill(); g.stroke();
  g.fillStyle='#fff'; g.font=`600 ${u*3.6}px ${FM}`; g.textAlign='right'; g.fillText(String(Math.round(PF.ias)),sx+sw-u*0.8,cy+u*0.2);
  g.fillStyle='#57C7F5'; g.font=`500 ${u*2.8}px ${FM}`; g.textAlign='center'; g.fillText(String(Math.round(v.spd)),sx+sw/2,ay-u*3);
  g.fillStyle='#9EADB7'; g.font=`500 ${u*2.4}px ${FM}`; g.fillText('GS '+Math.round(v.gs),sx+sw/2,ay+ah+u*3);
  /* altitude tape */
  const lx=u*86, lw=u*12; g.save(); g.fillStyle='rgba(40,48,56,.85)'; g.fillRect(lx,ay,lw,ah); g.beginPath(); g.rect(lx,ay,lw,ah); g.clip();
  const fpx=ah/600; g.strokeStyle='#fff'; g.fillStyle='#fff'; g.font=`500 ${u*2.7}px ${FM}`; g.textAlign='left';
  for(let a=Math.floor((PF.alt-320)/20)*20;a<=PF.alt+320;a+=20){ const y=cy-(a-PF.alt)*fpx; g.beginPath(); g.moveTo(lx,y); g.lineTo(lx+(a%100===0?u*2:u*1),y); g.stroke(); if(a%100===0) g.fillText(String(a),lx+u*2.6,y); }
  /* selected altitude bug */
  const by=cy-(v.salt-PF.alt)*fpx; g.fillStyle='#57C7F5'; g.fillRect(lx,clamp(by,ay,ay+ah)-u*1.6,u*1.2,u*3.2);
  /* decision / minimum altitude */
  if(v.mins){ const my=cy-(v.mins-PF.alt)*fpx; if(my>ay&&my<ay+ah){ g.fillStyle='#F0B440'; g.fillRect(lx,my-1,lw,2); } }
  g.restore();
  g.fillStyle='#000'; g.strokeStyle='#fff'; g.beginPath(); g.moveTo(lx+lw,cy-u*3); g.lineTo(lx+u*0.6,cy-u*3); g.lineTo(lx-u*1.2,cy); g.lineTo(lx+u*0.6,cy+u*3); g.lineTo(lx+lw,cy+u*3); g.closePath(); g.fill(); g.stroke();
  g.fillStyle='#fff'; g.font=`600 ${u*3.3}px ${FM}`; g.textAlign='right'; g.fillText(String(Math.round(PF.alt/10)*10),lx+lw-u*0.4,cy+u*0.2);
  g.fillStyle='#57C7F5'; g.font=`500 ${u*2.8}px ${FM}`; g.textAlign='center'; g.fillText(String(Math.round(v.salt)),lx+lw/2,ay-u*3);
  g.fillStyle=Math.abs(v.vs)>50?'#fff':'#9EADB7'; g.font=`500 ${u*2.6}px ${FM}`; g.fillText((v.vs>=0?'+':'−')+Math.abs(Math.round(v.vs/10)*10),lx+lw/2,ay+ah+u*3);
  /* EHSI */
  const hx=Wp/2, hy=ay+ah+(Hp-ay-ah)/2+u*2.5, R=Math.min(u*24,(Hp-ay-ah)/2-u*3.5);
  g.save(); g.translate(hx,hy);
  g.fillStyle='rgba(18,26,32,.9)'; g.beginPath(); g.arc(0,0,R+u*0.6,0,TAU); g.fill();
  g.save(); g.rotate(-PF.hdg*D2R); g.strokeStyle='#fff'; g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle';
  for(let a=0;a<360;a+=5){ const t=a*D2R, l=a%10===0?u*2.2:u*1.2; g.lineWidth=a%10===0?Math.max(1,u*0.3):1; g.beginPath(); g.moveTo(Math.sin(t)*R,-Math.cos(t)*R); g.lineTo(Math.sin(t)*(R-l),-Math.cos(t)*(R-l)); g.stroke(); }
  g.font=`600 ${u*3}px ${FD}`; for(let a=0;a<360;a+=30){ const t=a*D2R; g.save(); g.translate(Math.sin(t)*(R-u*4.8),-Math.cos(t)*(R-u*4.8)); g.rotate(t); g.fillText(a===0?'N':a===90?'E':a===180?'S':a===270?'W':String(a/10),0,0); g.restore(); }
  /* heading bug */
  g.save(); g.rotate(v.bug*D2R); g.fillStyle='#57C7F5'; g.beginPath(); g.moveTo(-u*2,-R-u*0.2); g.lineTo(-u*2,-R+u*1.6); g.lineTo(-u*0.7,-R+u*1.6); g.lineTo(0,-R+u*0.6); g.lineTo(u*0.7,-R+u*1.6); g.lineTo(u*2,-R+u*1.6); g.lineTo(u*2,-R-u*0.2); g.closePath(); g.fill(); g.restore();
  /* the instructor's target heading: a hollow cyan bug */
  if(v.tgt!=null){ g.save(); g.rotate(v.tgt*D2R); g.strokeStyle='#7FE0FF'; g.lineWidth=Math.max(1.6,u*0.55); g.beginPath(); g.moveTo(-u*2.4,-R-u*1.6); g.lineTo(0,-R+u*1.4); g.lineTo(u*2.4,-R-u*1.6); g.closePath(); g.stroke(); g.restore(); }
  /* bearing pointer (NDB) */
  if(v.brgOk){ g.save(); g.rotate(v.brg*D2R); g.strokeStyle='#7FCBE8'; g.lineWidth=Math.max(1.2,u*0.45); g.beginPath(); g.moveTo(-u*0.7,R*0.92); g.lineTo(-u*0.7,R*0.35); g.moveTo(u*0.7,R*0.92); g.lineTo(u*0.7,R*0.35); g.moveTo(-u*0.7,-R*0.35); g.lineTo(-u*0.7,-R*0.72); g.moveTo(u*0.7,-R*0.35); g.lineTo(u*0.7,-R*0.72); g.stroke();
    g.fillStyle='#7FCBE8'; g.beginPath(); g.moveTo(0,-R*0.92); g.lineTo(-u*1.8,-R*0.7); g.lineTo(u*1.8,-R*0.7); g.closePath(); g.fill(); g.restore(); }
  /* course pointer and deviation bar */
  if(v.crsOk){ g.save(); g.rotate(v.crs*D2R); const dd=R*0.18; g.strokeStyle='#fff'; g.lineWidth=1; for(const i of [-2,-1,1,2]){ g.beginPath(); g.arc(i*dd,0,u*0.75,0,TAU); g.stroke(); }
    g.strokeStyle='#F06BB4'; g.fillStyle='#F06BB4'; g.lineWidth=Math.max(2,u*0.9);
    g.beginPath(); g.moveTo(0,-R*0.48); g.lineTo(0,-R*0.78); g.stroke(); g.beginPath(); g.moveTo(0,-R*0.9); g.lineTo(-u*1.8,-R*0.76); g.lineTo(u*1.8,-R*0.76); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0,R*0.48); g.lineTo(0,R*0.88); g.stroke();
    if(v.flag!=='OFF'){ const bx=clamp(v.dev,-2.5,2.5)*dd; g.beginPath(); g.moveTo(bx,-R*0.44); g.lineTo(bx,R*0.44); g.stroke();
      if(!v.ils){ const up=v.flag==='TO'; g.beginPath(); g.moveTo(R*0.28,up?-R*0.3:R*0.3); g.lineTo(R*0.28-u*1.4,up?-R*0.2:R*0.2); g.lineTo(R*0.28+u*1.4,up?-R*0.2:R*0.2); g.closePath(); g.fill(); } }
    g.restore(); }
  g.restore();
  /* aircraft symbol and lubber line */
  g.strokeStyle='#fff'; g.lineWidth=Math.max(1.5,u*0.5); g.beginPath(); g.moveTo(0,-R*0.16); g.lineTo(0,R*0.14); g.moveTo(-R*0.14,-R*0.03); g.lineTo(R*0.14,-R*0.03); g.moveTo(-R*0.06,R*0.12); g.lineTo(R*0.06,R*0.12); g.stroke();
  g.fillStyle='#000'; g.strokeStyle='#fff'; g.lineWidth=1; rr(g,-u*5,-R-u*5.6,u*10,u*4.4,u*0.6); g.fill(); g.stroke();
  g.fillStyle='#fff'; g.font=`600 ${u*3.2}px ${FM}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(d3(PF.hdg),0,-R-u*3.3);
  if(v.flag==='OFF'&&v.crsOk){ g.fillStyle='#EF6450'; g.font=`700 ${u*2.8}px ${FM}`; g.fillText(v.ils?'LOC':'NAV',-R*0.45,-R*0.25); }
  g.restore();
  /* side texts */
  g.textBaseline='alphabetic'; g.font=`500 ${u*2.7}px ${FM}`; g.textAlign='left';
  const lyy=hy-R*0.55; g.fillStyle='#F06BB4'; g.fillText(v.src,u*3,lyy); g.fillText((no()?'KRS ':'CRS ')+d3(v.crs),u*3,lyy+u*3.8);
  if(v.dmeOk){ g.fillStyle='#fff'; g.fillText('DME '+nf1(v.dme),u*3,lyy+u*7.6); }
  g.textAlign='right'; g.fillStyle='#57C7F5'; g.fillText('HDG '+d3(v.bug),Wp-u*3,lyy);
  if(v.brgOk){ g.fillStyle='#7FCBE8'; g.fillText('ADF '+v.adfId,Wp-u*3,lyy+u*3.8); }
  if(v.wind){ g.fillStyle='#9EADB7'; g.fillText(d3(v.wind.dir)+'/'+Math.round(v.wind.spd),Wp-u*3,lyy+u*7.6); }
}
function feedPFD(dt){ if(S.inst!=='pfd'||S.ex==='math') return; const s=stateNow(), r=readNow(), X=S.X, obs=s.obs!==undefined&&S.step!=='fly'?s.obs:X.obs, bug=s.bug!==undefined?s.bug:(s.sel?s.sel.hdg:s.hdg);
  const nav=A().ST[X.nav], gps=X.nav==='GPS', ad=X.adf&&A().ST[X.adf], vs=s.vs||0, gs=s.gs||120, tas=I.tasOf(s.ias||120,s.alt);
  const T=X.task, mins=T.da||T.mda||T.mins||null, tg=targetsNow();
  drawPFD({hdg:s.hdg,ias:s.ias||120,alt:s.alt,salt:s.salt!==undefined?s.salt:(s.sel?s.sel.alt:s.alt),vs,gs,spd:s.sel?s.sel.spd:(s.ias||120),bank:s.bank||0,pitch:2+Math.asin(clamp(vs/(tas*101.27),-1,1))*R2D,
    bug,crs:obs,dev:r.hsiDots||0,flag:r.flag||'OFF',ils:r.ils,crsOk:!!nav||gps,tgt:tg&&tg.hdg!=null?tg.hdg:null,gsOk:!!r.gsOk,gsDots:r.gsDots||0,locDots:r.dots||0,brgOk:!!ad,brg:r.qdmA||0,adfId:ad?ad.id:'',
    dme:r.dme,dmeOk:r.dme!=null&&r.dmeOk,src:gps?'GPS '+(X.leg?X.leg.id:''):nav?(nav.type==='ILS'?'LOC '+(nav.id):nav.type==='RNP'?(X.rnp||'').toUpperCase():'VOR '+nav.id):'',mins,wind:(!X.wind.hidden&&X.wind.spd&&S.lv<4)?X.wind:null},dt); }

/* ---------- the run ---------- */
function tick(h){ const X=S.X, s=S.sim, ex=EXo(), Ar=A(); const act=S.pendingAct; S.pendingAct=null; const qi0=S.J.qi||0;
  const f=I.frame(X,Ar,s,act,h,S.J); I.trackTurn(S.J,f,h); S.J.nNow=0; ex.judge(S.J,f,X);
  if(S.J.reposition){ s.x=S.J.reposition.x; s.y=S.J.reposition.y; s.hdg=s.sel.hdg=S.J.reposition.hdg; S.J.reposition=null; S.J.pd=Infinity; S.GP={}; renderBrief(); fitView(X.box); }
  if(S.watch.on) S.watch.t+=h;
  const last=S.log[S.log.length-1];
  if(!last||s.t-last.t>=0.5){ S.log.push({t:s.t,x:s.x,y:s.y,h:s.hdg,alt:s.alt,vs:s.vs,gs:s.gs,trk:s.trk,ias:s.ias,obs:X.obs,bug:s.sel.hdg,salt:s.sel.alt,n:S.J.nNow||0,ph:S.J.phase,bank:s.bank,qi:S.J.qi||0}); }
  if((S.J.qi||0)!==qi0){ quizKey=''; renderQuiz(); renderBrief(); if(S.ex==='orient'){ S.GP={}; } }
  if(S.J.done){ finish(false); return; }
  if(s.t>(ex.tmax||900)){ S.J.ev.push({code:'timeout',sev:'err',cat:'proc',p:{},t:s.t,x:s.x,y:s.y}); finish(false); return; }
  /* the instructor: flying (Show me), or only advising (the guide) */
  const c=ex.pilot(S.demo?S.P:S.GP,f,X,S.demo&&S.mistake);
  if(S.demo){ if(c&&c.act) S.pendingAct=c.act; I.apply(s,X,c); }
  S.gc=c;
  I.step(s,h); keepInView(s.x,s.y);
  checkMoment(); }
function finish(early){ S.run=false; S.started=false; const ex=EXo(); if(S.pause) resumePause();
  if(early&&!S.J.done){ S.J.ev.push({code:'timeout',sev:'err',cat:'proc',p:{},t:S.sim.t,x:S.sim.x,y:S.sim.y}); }
  const g=I.grade(S.J,ex); S.res={g,demo:S.demo&&!S.mistake,first:g.first};
  if(!S.demo&&!S.mistake){ const p=PROG.ex[S.item]=PROG.ex[S.item]||{lv:0,best:{}}; p.best[S.lv]=Math.max(p.best[S.lv]||0,g.total); if(g.pass) p.lv=Math.max(p.lv||0,S.lv); save(PK,PROG); }
  const app=isApp(S.ex), ok=S.J.done;
  el('doneB').textContent= ok? (app?tx('Missed approach complete.','Missed approach fullført.'):tx('Exercise complete.','Øvelsen er ferdig.')) : tx('Run ended.','Øvelsen avsluttet.');
  el('doneS').textContent=tx('Here is your debrief.','Her er debriefen.');
  const dt=el('doneT'); dt.hidden=false; dt.classList.remove('fade'); clearTimeout(dt._t); dt._t=setTimeout(()=>{ dt.classList.add('fade'); dt._t=setTimeout(()=>{ dt.hidden=true; },700); },2200);
  go('debrief'); }

/* ---------- instrument values ---------- */
function sampleAt(t){ const L0=S.log; if(!L0.length) return null; let lo=0,hi=L0.length-1; if(t<=L0[0].t) return L0[0]; if(t>=L0[hi].t) return L0[hi];
  while(hi-lo>1){ const m=(lo+hi)>>1; if(L0[m].t<=t) lo=m; else hi=m; } return L0[lo]; }
function stateNow(){ if(S.step==='understand'&&S.u) return S.u;
  if(S.step==='debrief'){ const p=sampleAt(S.scrub); return p?{x:p.x,y:p.y,hdg:p.h,alt:p.alt,gs:p.gs,trk:p.trk,vs:p.vs,ias:p.ias,bank:p.bank,obs:p.obs,bug:p.bug,salt:p.salt,t:p.t}:S.sim; }
  if(S.step==='think') return Object.assign({},S.u||S.sim,{obs:S.X.obs});
  return S.sim; }
function readNow(){ const s=stateNow(), X=S.X; const obs=s.obs!==undefined&&S.step!=='fly'?s.obs:X.obs;
  return I.read(Object.assign({gs:120,trk:s.hdg,t:0},s),A(),{nav:X.nav,obs,adf:X.adf,dme:X.dme,rnp:X.rnp,nogs:X.nogs,leg:X.leg}); }
function feedGauges(){ const s=stateNow(), r=readNow(), X=S.X, obs=s.obs!==undefined&&S.step!=='fly'?s.obs:X.obs, bug=s.bug!==undefined?s.bug:(s.sel?s.sel.hdg:s.hdg);
  const k=kindsNow();
  if(k.indexOf('cdi')>=0) GA.cdi.set({obs,dots:r.flag?r.dots:0,flag:r.flag||'OFF',ils:r.ils,gsValid:!!r.gsOk,gsDots:r.gsDots||0});
  if(k.indexOf('hsi')>=0) GA.hsi.set({hdg:s.hdg,crs:obs,hsiDots:r.hsiDots||0,flag:r.flag||'OFF',ils:r.ils,gsValid:!!r.gsOk,gsDots2:clamp((r.gsDots||0)*0.4,-2.4,2.4),bug});
  if(k.indexOf('rmi')>=0) GA.rmi.set({hdg:s.hdg,qdmV:r.qdmV||0,qdmA:r.qdmA||0,vorOk:!!r.vorOk&&!r.ils,adfOk:!!r.adfOk});
  if(k.indexOf('adf')>=0) GA.adf.set({movable:false,card:0,rb:r.rb||0,adfOk:!!r.adfOk});
  if(k.indexOf('dg')>=0) GA.dg.set({hdg:s.hdg,bug});
  if(k.indexOf('cmp')>=0) drawCompass(r.cmp);
  return {s,r}; }
/* the magnetic compass (partial panel): a card seen edge-on, swinging */
let CMP=null;
function drawCompass(h){ const g=cmpG, Wc=cmpW, Hc=cmpH; if(!Wc) return; CMP=CMP===null||reduced()?h:norm(CMP+diff(h,CMP)*0.12);
  g.clearRect(0,0,Wc,Hc); g.fillStyle='#0b0f13'; g.beginPath(); g.roundRect?g.roundRect(0,0,Wc,Hc,8):g.rect(0,0,Wc,Hc); g.fill();
  const cx=Wc/2, pp=Wc/70; g.save(); g.beginPath(); g.rect(6,6,Wc-12,Hc-12); g.clip();
  g.fillStyle='#E9E2C8'; g.fillRect(6,Hc*0.22,Wc-12,Hc*0.56);
  g.strokeStyle='#13202A'; g.fillStyle='#13202A'; g.textAlign='center'; g.textBaseline='middle';
  for(let a=Math.floor((CMP-40)/5)*5;a<=CMP+40;a+=5){ const x=cx+diff(a,CMP)*pp; g.lineWidth=a%10===0?1.6:1; g.beginPath(); g.moveTo(x,Hc*0.22); g.lineTo(x,Hc*0.22+(a%10===0?Hc*0.16:Hc*0.09)); g.stroke();
    if(a%30===0){ const n=norm(a); g.font=`700 ${Math.round(Hc*0.2)}px ${FD}`; g.fillText(n===0?'N':n===90?'E':n===180?'S':n===270?'W':String(n/10),x,Hc*0.58); } }
  g.restore(); g.strokeStyle='#F39A3D'; g.lineWidth=2.5; g.beginPath(); g.moveTo(cx,4); g.lineTo(cx,Hc-4); g.stroke();
  g.fillStyle='#9EADB7'; g.font=`500 11px ${FB}`; g.textAlign='left'; g.fillText(tx('Compass','Kompass'),10,Hc-8); }
/* the instructor's targets on the instrument: a hollow cyan heading mark (rotating cards), the course to set (CDI, HSI) */
function drawTargets(){ const T=targetsNow(); for(const k of ['cdi','hsi','rmi','dg']){ const c=q(`[data-g="${k}"] canvas.tg`); if(!c||c.parentNode.hidden) continue; const g=c.getContext('2d'), d=c.width/(parseFloat(c.style.width)||1), s=parseFloat(c.style.width)||0; g.setTransform(d,0,0,d,0,0); g.clearRect(0,0,s,s);
    if(!T||!s) continue; const C2=s/2, r=s*0.43, G=GA[k];
    const mark=(ang,rad,col,fill)=>{ g.save(); g.translate(C2,C2); g.rotate(ang*D2R); g.strokeStyle=col; g.lineWidth=Math.max(2,s*0.008); g.fillStyle=fill||'transparent'; g.beginPath(); g.moveTo(-s*0.03,-rad-s*0.035); g.lineTo(0,-rad+s*0.012); g.lineTo(s*0.03,-rad-s*0.035); g.closePath(); if(fill) g.fill(); g.stroke(); g.restore(); };
    if(T.hdg!=null&&k!=='cdi'){ const hd=G.sp.hdg.x, a=diff(T.hdg,hd); mark(a,r*1.02,'#7FE0FF');
      if(Math.abs(a)>4){ g.save(); g.translate(C2,C2); g.strokeStyle='rgba(127,224,255,.55)'; g.lineWidth=Math.max(2,s*0.01); g.setLineDash([s*0.012,s*0.012]); g.beginPath(); g.arc(0,0,r*1.08,-Math.PI/2,(a-90)*D2R,a<0); g.stroke(); g.restore(); } }
    if(T.crs!=null&&(k==='cdi'||k==='hsi')){ const base=k==='cdi'?G.sp.obs.x:G.sp.hdg.x, a=diff(T.crs,base); mark(a,k==='cdi'?r*0.86:r*0.92,'#F06BB4','rgba(240,107,180,.25)');
      if(k==='cdi'&&Math.abs(a)>2){ g.save(); g.translate(C2,C2); g.strokeStyle='rgba(240,107,180,.55)'; g.lineWidth=Math.max(2,s*0.01); g.setLineDash([s*0.012,s*0.012]); g.beginPath(); g.arc(0,0,r*0.92,-Math.PI/2,(a-90)*D2R,a<0); g.stroke(); g.restore(); } } } }

/* ---------- map drawing ---------- */
function drawBaseLayer(){ const g=baseG, Ar=A(), X=S.X; g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,MW,MH);
  if(Ar.real){ if(map.region!==S.area) map.setRegion(S.area); }
  map.drawBase(g,MW,MH,{}); if(!Ar.real) drawCoast(map,g,Ar);
  if(S.ex!=='math') drawGeom(map,g,X,Ar,S.ex,MW,MH);
  map.reserveEl(el('legend')); map.reserve(MW-90,0,90,96);
  map.drawNorth(g,MH); map.drawScaleBar(g,MH); map.flushLabels(g,MW,MH);
  baseDirty=false; }
function trailPath(g,pts,tmax,colFn,i0){ if(pts.length<2) return; g.lineWidth=2.4; g.lineCap='round'; g.lineJoin='round';
  let prev=null; for(let i=i0||0;i<pts.length;i++){ const p=pts[i]; if(p.t>tmax) break; map.P(p.x,p.y); if(prev){ g.strokeStyle=colFn?colFn(p):COL.trail; g.beginPath(); g.moveTo(prev[0],prev[1]); g.lineTo(map.sx,map.sy); g.stroke(); } prev=[map.sx,map.sy]; } }
const nCol=p=>p.n>1?COL.bad:p.n>0.6?COL.mid:p.n>0?COL.good:'rgba(255,255,255,.7)';
function drawIdeal(g,alpha,i0,i1){ const P=S.ideal; if(!P||P.length<2) return; g.save(); g.strokeStyle=`rgba(127,224,255,${alpha||0.7})`; g.lineWidth=1.8; g.setLineDash([7,6]); g.beginPath();
  for(let i=i0||0;i<=(i1===undefined?P.length-1:i1);i++){ const p=P[i]; map.P(p.x,p.y); if(i===(i0||0)) g.moveTo(map.sx,map.sy); else g.lineTo(map.sx,map.sy); } g.stroke(); g.restore(); }
/* the next turn on the instructor's path, seen from where you are */
function nextTurn(){ const P=S.ideal, s=S.sim; if(!P||P.length<4) return null; let bi=S.gIdx, bd=Infinity;
  for(let i=Math.max(0,S.gIdx-5);i<Math.min(P.length,S.gIdx+90);i++){ const d=Math.hypot(P[i].x-s.x,P[i].y-s.y); if(d<bd){ bd=d; bi=i; } } S.gIdx=bi;
  let j=-1; for(let i=bi+1;i<Math.min(P.length-1,bi+240);i++){ if(Math.abs(diff(P[i+1].h,P[i].h))>0.6){ j=i; break; } } if(j<0) return null;
  let e=j; let calm=0; for(let i=j;i<Math.min(P.length-1,j+200);i++){ if(Math.abs(diff(P[i+1].h,P[i].h))<0.3){ if(++calm>=3){ e=i; break; } } else { calm=0; e=i; } }
  const tot=diff(P[e].h,P[j].h); if(Math.abs(tot)<12) return null; return {j,e,dir:Math.sign(tot),h:P[e].h,p:P[j]}; }
function drawMap(){ if(MW<80||MH<80||!(map.v.k>0)) return; const g=mapG; if(baseDirty) drawBaseLayer();
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,mapC.width,mapC.height); g.drawImage(baseC,0,0); g.setTransform(dpr,0,0,dpr,0,0);
  const X=S.X, Ar=A(), T=X.task;
  if(S.ex==='math'){ drawProfile(); return; }
  if(S.step==='understand'||S.step==='think') drawLesson(g);
  if(S.step==='fly'){ const help=S.started&&showHelp();
    if((S.started?help:S.help!=='off')&&S.ex==='holdEntry'&&S.J.phase!=='entry'&&S.J.phase!=='entryleg'&&S.J.phase!=='back') drawSectors(map,g,I.fixOf(Ar,T),T.inb,T.dir,Math.min(4,70/map.v.k));
    if(help||(!S.started&&S.help==='guided')){ drawIdeal(g,0.55); const nt=S.started?nextTurn():null;
      if(nt){ drawIdealSeg(g,nt.j,nt.e); map.P(nt.p.x,nt.p.y); g.strokeStyle=COL.tgt; g.lineWidth=2; g.beginPath(); g.arc(map.sx,map.sy,9,0,TAU); g.stroke();
        const lab=`${tx('Turn','Sving')} ${turnW(nt.dir)} ${d3(nt.h)}`; g.font=`600 12px ${FB}`; const w=g.measureText(lab).width+12; let lx=map.sx+14, ly=map.sy-26; if(lx+w>MW-8) lx=map.sx-14-w; if(ly<6) ly=map.sy+14;
        g.fillStyle='rgba(9,13,17,.88)'; map.rrect(g,lx,ly,w,20,3); g.fill(); g.strokeStyle=COL.tgt; g.lineWidth=1; map.rrect(g,lx,ly,w,20,3); g.stroke(); g.fillStyle=COL.tgt; g.textAlign='left'; g.textBaseline='middle'; g.fillText(lab,lx+6,ly+10.5); } }
    trailPath(g,S.log,Infinity); const s=S.sim; map.drawAircraft(g,s.x,s.y,s.hdg,{size:15}); }
  if(S.step==='debrief'){ drawIdeal(g,0.75); trailPath(g,S.log,Infinity,p=>p.t<=S.scrub?nCol(p):'rgba(255,255,255,.18)');
    const f=S.res&&S.res.first; S.J.ev.filter(e=>e.sev==='err'||e.sev==='warn').forEach(e=>{ map.P(e.x,e.y); g.strokeStyle=e===f?COL.bad:e.sev==='err'?'rgba(239,100,80,.6)':'rgba(240,180,64,.7)'; g.lineWidth=e===f?3:1.6; g.beginPath(); g.arc(map.sx,map.sy,e===f?13:7,0,TAU); g.stroke(); });
    if(f){ map.P(f.x,f.y); const lab=tx('First mistake ','Første feil ')+mmss(f.t); g.font=`600 12px ${FB}`; const w=g.measureText(lab).width+14; let lx=map.sx+16, ly=map.sy-28; if(lx+w>MW-8) lx=map.sx-16-w; if(ly<8) ly=map.sy+16;
      g.fillStyle='rgba(239,100,80,.95)'; map.rrect(g,lx,ly,w,20,3); g.fill(); g.fillStyle='#fff'; g.textAlign='left'; g.textBaseline='middle'; g.fillText(lab,lx+7,ly+10.5); }
    const p=sampleAt(S.scrub); if(p) map.drawAircraft(g,p.x,p.y,p.h,{size:15}); }
  if(S.step!=='debrief'&&!X.wind.hidden&&!(S.lv>=4)&&X.wind.spd>0){ const w=S.step==='fly'&&S.sim.wnow?S.sim.wnow:X.wind; map.drawWind(g,MW,w.dir,w.spd); }
  drawProfile(); }
function drawIdealSeg(g,a,b){ const P=S.ideal; g.save(); g.strokeStyle=COL.tgt; g.lineWidth=3; g.lineCap='round'; g.beginPath(); for(let i=a;i<=b;i++){ map.P(P[i].x,P[i].y); if(i===a) g.moveTo(map.sx,map.sy); else g.lineTo(map.sx,map.sy); } g.stroke(); g.restore(); }
/* the walk-through picture */
function drawLesson(g){ const X=S.X, Ar=A(), T=X.task, u=S.u||{x:X.ac.x,y:X.ac.y,hdg:X.ac.hdg}, st=Ar.ST[T.st||X.nav]; const steps=uSteps(), cur=steps[S.uStep]||{}, show=cur.show||(uwFor(S.item)[0]||{}).show;
  if(S.step==='think'){ map.drawAircraft(g,X.ac.x,X.ac.y,X.ac.hdg,{size:15}); return; }
  if(show==='radials'&&st){ g.font=`500 10.5px ${FM}`; for(let a=0;a<360;a+=30){ const p=I.at(st,a,30); line(map,g,st,p,'rgba(99,217,160,.22)',1); const lp=I.at(st,a,11); map.P(lp.x,lp.y); g.fillStyle='rgba(99,217,160,.75)'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('R'+d3(a),map.sx,map.sy); }
    const rad=N.radial(st,u); line(map,g,st,I.at(st,rad,Math.hypot(u.x-st.x,u.y-st.y)+6),COL.vor,2.4); }
  if(show==='brg'&&st){ line(map,g,u,st,'rgba(245,188,76,.8)',1.8,[5,4]); }
  if((show==='wedge'||show==='arrows')&&st&&T.crs!==undefined){ const crs=S.ex==='trackIn'||S.ex==='intIn'||S.ex==='pass'||S.ex==='ndb'?norm(T.crs+180):T.crs;
    g.fillStyle='rgba(240,107,180,.10)'; g.beginPath(); map.P(st.x,st.y); g.moveTo(map.sx,map.sy); for(let a=-10;a<=10;a+=2){ const p=I.at(st,crs+a,30); map.P(p.x,p.y); g.lineTo(map.sx,map.sy); } g.closePath(); g.fill(); }
  if(show==='arrows'&&st&&T.crs!==undefined){ const l=I.lineRel(st,T.crs,u); for(const [ang,col] of [[30,'#E6EBEF'],[45,'rgba(230,235,239,.55)']]){ const hh=I.interceptHdg(T.crs,l.xt,ang), p=I.at(u,hh,3.2); line(map,g,u,p,col,1.6,[4,4]); map.P(p.x,p.y); map.arrowHead(g,map.sx,map.sy,map.sa(hh),7,col); map.label(map.sx,map.sy,d3(hh)+' ('+ang+'°)',col); } }
  if(show==='homing'&&st){ const w=X.wind.spd?X.wind:{dir:norm(T.crs+90),spd:25}; let p={x:X.ac.x,y:X.ac.y}; g.strokeStyle='rgba(245,188,76,.9)'; g.lineWidth=2; g.setLineDash([6,5]); g.beginPath(); map.P(p.x,p.y); g.moveTo(map.sx,map.sy);
    for(let i=0;i<900;i++){ const b=N.bearing(st.x-p.x,st.y-p.y), wt=N.windTriangle(120,b,w.dir,w.spd); p.x+=wt.vx/3600*2; p.y+=wt.vy/3600*2; map.P(p.x,p.y); g.lineTo(map.sx,map.sy); if(Math.hypot(st.x-p.x,st.y-p.y)<0.3) break; } g.stroke(); g.setLineDash([]); }
  if(show==='arc'&&st&&T.R){ g.strokeStyle='rgba(240,107,180,.35)'; g.lineWidth=1; map.P(st.x,st.y); g.beginPath(); g.arc(map.sx,map.sy,T.R*map.v.k,0,TAU); g.stroke(); line(map,g,u,st,'rgba(99,217,160,.6)',1.4,[3,4]); }
  if(show==='sectors'){ drawSectors(map,g,I.fixOf(Ar,T),T.inb,T.dir,Math.min(4,80/map.v.k)); }
  if(cur.try){ if(S.ideal) drawIdeal(g,0.35); }
  else if(S.ideal&&S.useg){ drawIdeal(g,0.28); const P=S.ideal, a=S.useg.i0; g.save(); g.strokeStyle='rgba(127,224,255,.95)'; g.lineWidth=2.6; g.lineCap='round'; g.beginPath(); map.P(P[a].x,P[a].y); g.moveTo(map.sx,map.sy);
    for(let i=a+1;i<=S.useg.i1&&P[i].t<=(u.t||Infinity);i++){ map.P(P[i].x,P[i].y); g.lineTo(map.sx,map.sy); } map.P(u.x,u.y); g.lineTo(map.sx,map.sy); g.stroke(); g.restore(); }
  map.drawAircraft(g,u.x,u.y,u.hdg,{size:16,ring:!!cur.try,handle:!!cur.try});
  const live=el('uLive'); if(live) live.innerHTML=lessonLive(u,readNow()); }
function lessonLive(u,r){ const X=S.X, T=X.task, Ar=A(), st=Ar.ST[T.st||X.nav];
  switch(S.ex){
    case 'orient': return T.kind==='rbi'?`${tx('Needle','Nål')} <b>${Math.round(norm(r.rb))}°</b> + ${tx('heading','kurs')} <b>${d3(u.hdg)}</b> = <b>${d3(r.qdmA)}</b>`:`${tx('You are on radial','Du er på radial')} <b>${d3(N.radial(st,u))}</b> · ${tx('heading','kurs')} ${d3(u.hdg)}`;
    case 'holdEntry': { const e=H.entry(T.inb,T.dir,u.hdg); return `${tx('Heading','Kurs')} <b>${d3(u.hdg)}</b> → <b>${esc(L(W.entry[e.entry]))}</b>${e.alt?` ${tx('(or','(eller')} ${esc(L(W.entry[e.alt]))})`:''}`; }
    case 'ndb': case 'ndbOut': return `${tx('Needle','Nål')} <b>${Math.round(diff(r.rb,0))>0?'+':''}${Math.round(diff(r.rb,0))}°</b> · ${tx('heading + needle =','kurs + nål =')} QDM <b>${d3(r.qdmA)}</b>`;
    case 'dme': return `DME <b>${nf1(r.dme)}</b> · ${tx('radial','radial')} <b>${d3(N.radial(st,u))}</b>`;
    case 'tts': return `${tx('Radial','Radial')} <b>${d3(r.radial||0)}</b> · DME <b>${nf1(r.dme)}</b>`;
    case 'ils': case 'locInt': return `LOC <b>${nf1(r.dots)}</b> ${tx('dots','prikker')} · GS <b>${r.gsOk?nf1(r.gsDots):'—'}</b> · ${Math.round(u.alt)} ft`;
    case 'sid': case 'star': return `${Math.round(u.alt/10)*10} ft · ${tx('heading','kurs')} ${d3(u.hdg)}`;
    case 'math': return '';
    default: if(isApp(S.ex)) return `${Math.round(u.alt/10)*10} ft${r.dme!=null?` · ${nf1(r.dme)} NM`:''}`;
      return `${r.flag||''} · ${tx('needle','nål')} <b>${nf1(Math.abs(r.dots||0))}</b> ${tx('dots','prikker')} ${(r.dots||0)>0.05?tx('right','høyre'):(r.dots||0)<-0.05?tx('left','venstre'):''} · OBS <b>${d3(u.obs!==undefined?u.obs:S.X.obs)}</b>`;
  } }

/* approach profile strip */
const profC=el('prof'), profG=profC.getContext('2d'); let PW=0,PH=0;
function sizeProf(){ const r=profC.getBoundingClientRect(); PW=Math.round(r.width); PH=Math.round(r.height); const d=Math.min(devicePixelRatio||1,2); profC.width=Math.round(PW*d); profC.height=Math.round(PH*d); profG.setTransform(d,0,0,d,0,0); }
const hasProf=()=>isApp(S.ex);
function profGeom(){ const X=S.X, T=X.task, Ar=A();
  if(S.ex==='vordme'){ const st=Ar.ST[T.st]; return {dT:p=>Math.max(0,Math.hypot(p.x-st.x,p.y-st.y)-T.k),max:T.ifD-T.k+2,top:T.fafAlt+600,elev:T.elev,mins:T.mda,faf:T.fafD-T.k,tbl:T.table.map(q=>({d:q.dme-T.k,alt:q.alt}))}; }
  const ils=Ar.ST[T.ils]; if(S.ex==='ils') return {dT:p=>Math.max(0,-I.lineRel(ils.thr,T.crs,p).along),max:14,top:T.alt+700,elev:T.elev,mins:T.da,faf:(T.alt-T.elev-50)/318.4,tbl:[]};
  return {dT:p=>Math.max(0,-I.lineRel(ils.thr,T.crs,p).along),max:T.fafD+5,top:T.fafAlt+600,elev:T.elev,mins:T.mins,faf:T.fafD,tbl:T.table.map(q=>({d:q.d,alt:q.alt}))}; }
function drawProfile(){ const show=hasProf(); if(el('profw').hidden===show){ el('profw').hidden=!show; sizeProf(); sizeMap(); } if(!show) return; if(!PW) sizeProf(); if(PW<80||PH<40) return;
  const g=profG, G0=profGeom(), l=46, r=12, t=12, b=20, w=PW-l-r, h=PH-t-b;
  const X_=d=>l+w*(1-d/G0.max), Y_=a=>t+h*(1-(a-G0.elev)/(G0.top-G0.elev));
  g.clearRect(0,0,PW,PH); g.fillStyle='#0c141a'; g.fillRect(0,0,PW,PH);
  g.strokeStyle='rgba(255,255,255,.06)'; g.lineWidth=1; g.font=`500 10px ${FM}`; g.fillStyle='#6B7C86'; g.textAlign='right'; g.textBaseline='middle';
  for(let a=Math.ceil(G0.elev/500)*500;a<=G0.top;a+=500){ const y=Y_(a); g.beginPath(); g.moveTo(l,y); g.lineTo(PW-r,y); g.stroke(); g.fillText(String(a),l-6,y); }
  g.textAlign='center'; g.textBaseline='top'; for(let d=0;d<=G0.max;d+=2){ g.fillText(String(d),X_(d),PH-b+4); }
  g.fillStyle='#22313c'; g.fillRect(l,Y_(G0.elev),w,2);
  g.strokeStyle=COL.crs; g.lineWidth=2; g.beginPath(); g.moveTo(X_(0),Y_(I.profileAlt(0,G0.elev))); g.lineTo(X_(G0.faf),Y_(I.profileAlt(G0.faf,G0.elev))); g.lineTo(X_(G0.max),Y_(I.profileAlt(G0.faf,G0.elev))); g.stroke();
  g.strokeStyle='rgba(240,180,64,.85)'; g.setLineDash([5,4]); g.beginPath(); g.moveTo(l,Y_(G0.mins)); g.lineTo(PW-r,Y_(G0.mins)); g.stroke(); g.setLineDash([]);
  g.fillStyle='#F0B440'; g.textAlign='left'; g.textBaseline='bottom'; g.fillText((S.X.task.da?'DA ':'MDA ')+G0.mins,l+4,Y_(G0.mins)-2);
  g.fillStyle='#E6EBEF'; G0.tbl.forEach(q=>{ g.beginPath(); g.arc(X_(q.d),Y_(q.alt),2.5,0,TAU); g.fill(); });
  g.fillStyle='#9EADB7'; g.textAlign='center'; g.textBaseline='bottom'; g.fillText('FAF',X_(G0.faf),Y_(I.profileAlt(G0.faf,G0.elev))-5);
  const pts=S.step==='fly'||S.step==='debrief'?S.log:[]; const tmax=S.step==='debrief'?S.scrub:Infinity;
  g.lineWidth=2; let prev=null; for(const p of pts){ if(p.t>tmax) break; const x=X_(G0.dT(p)), y=Y_(p.alt); if(prev){ g.strokeStyle=S.step==='debrief'?nCol(p):'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(prev[0],prev[1]); g.lineTo(x,y); g.stroke(); } prev=[x,y]; }
  const s=stateNow(); if(s){ const x=X_(G0.dT(s)), y=Y_(s.alt); g.fillStyle='#fff'; g.beginPath(); g.arc(clamp(x,l,PW-r),clamp(y,t,PH-b),5,0,TAU); g.fill(); g.strokeStyle='#0c141a'; g.lineWidth=1.5; g.stroke(); }
  g.fillStyle='#6B7C86'; g.textAlign='right'; g.textBaseline='top'; g.fillText(tx('NM to the threshold','NM til terskelen'),PW-r,t-2); }

/* timeline (debrief) */
const tlC=el('tl'), tlG=tlC.getContext('2d',{willReadFrequently:true}); let TW=0,TH=0;
function sizeTl(){ const r=tlC.getBoundingClientRect(); TW=Math.round(r.width); TH=Math.round(r.height); const d=Math.min(devicePixelRatio||1,2); tlC.width=Math.round(TW*d); tlC.height=Math.round(TH*d); tlG.setTransform(d,0,0,d,0,0); }
function drawTl(){ if(S.step!=='debrief') return; if(!TW) sizeTl(); if(TW<80) return; const g=tlG, Lg=S.log; g.clearRect(0,0,TW,TH); if(!Lg.length) return;
  const t1=Lg[Lg.length-1].t||1, x0=10, x1=TW-10, X_=t=>x0+(x1-x0)*t/t1, y=TH*0.58;
  for(let i=1;i<Lg.length;i++){ const p=Lg[i]; g.fillStyle=p.n>1?COL.bad:p.n>0.6?COL.mid:p.n>0?'rgba(99,217,160,.75)':'rgba(255,255,255,.14)'; g.fillRect(X_(Lg[i-1].t),y-3,Math.max(1,X_(p.t)-X_(Lg[i-1].t)+0.5),6); }
  g.font=`500 10px ${FM}`; g.fillStyle='#6B7C86'; g.textAlign='left'; g.textBaseline='alphabetic'; g.fillText('0:00',x0,TH-6); g.textAlign='right'; g.fillText(mmss(t1),x1,TH-6);
  const f=S.res&&S.res.first;
  S.J.ev.filter(e=>e.sev!=='info').forEach(e=>{ const x=X_(e.t); g.fillStyle=e.sev==='err'?COL.bad:e.sev==='warn'?COL.mid:COL.good; g.beginPath(); g.arc(x,y,e===f?6:3.5,0,TAU); g.fill(); });
  if(f){ const x=X_(f.t); g.strokeStyle=COL.bad; g.lineWidth=2; g.beginPath(); g.moveTo(x,y-8); g.lineTo(x,12); g.stroke(); g.font=`600 11px ${FB}`; const lab=tx('First mistake','Første feil'); const w=g.measureText(lab).width+12; const lx=clamp(x-w/2,0,TW-w);
    g.fillStyle=COL.bad; map.rrect(g,lx,2,w,16,3); g.fill(); g.fillStyle='#fff'; g.textAlign='left'; g.textBaseline='middle'; g.fillText(lab,lx+6,10.5); }
  const sx=X_(S.scrub); g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.moveTo(sx,y-12); g.lineTo(sx,y+12); g.stroke(); g.fillStyle='#fff'; g.beginPath(); g.arc(sx,y,5,0,TAU); g.fill();
  g.font=`500 11px ${FM}`; g.textAlign=sx>TW-60?'right':'left'; g.textBaseline='alphabetic'; g.fillStyle='#fff'; g.fillText(mmss(S.scrub),sx+(sx>TW-60?-8:8),TH-6); }
(function(){ let dn=false; const set=e=>{ const r=tlC.getBoundingClientRect(); const Lg=S.log; if(!Lg.length) return; const t1=Lg[Lg.length-1].t; S.scrub=clamp((e.clientX-r.left-10)/(r.width-20),0,1)*t1; S.replay=false; renderPlay(); };
  tlC.addEventListener('pointerdown',e=>{ dn=true; tlC.setPointerCapture(e.pointerId); set(e); }); tlC.addEventListener('pointermove',e=>{ if(dn) set(e); }); tlC.addEventListener('pointerup',()=>dn=false); tlC.addEventListener('pointercancel',()=>dn=false);
  tlC.tabIndex=0; tlC.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ e.preventDefault(); S.scrub=Math.max(0,S.scrub+(e.key==='ArrowRight'?5:-5)); S.replay=false; renderPlay(); } }); })();
el('play').onclick=()=>{ const Lg=S.log; if(!Lg.length) return; if(!S.replay&&S.scrub>=Lg[Lg.length-1].t-0.5) S.scrub=0; S.replay=!S.replay; renderPlay(); };
function debriefPts(){ const P=S.log.map(p=>({x:p.x,y:p.y})); if(S.ideal) S.ideal.forEach((p,i)=>{ if(i%6===0) P.push({x:p.x,y:p.y}); }); return P.length?P.concat(S.X.box):S.X.box; }
function renderIcap(){ const c=el('icap'); if(S.step!=='debrief'){ c.textContent=''; return; } const f=S.res&&S.res.first, at=mmss(S.scrub);
  if(S.ex==='math'){ const p=sampleAt(S.scrub), Q=p&&S.X.task.qs[Math.min(p.qi||0,S.X.task.n-1)]; c.innerHTML=Q?`<b>${esc(tx('The question at ','Spørsmålet ved ')+at)}</b>${esc(fmt(MATHQ[Q.kind].q,mathParams(Q)))}`:''; return; }
  c.innerHTML=`<b>${esc(tx('The instrument at ','Instrumentet ved ')+at)}</b>${esc(f&&Math.abs(S.scrub-f.t)<1?tx('This is what you saw at the first mistake.','Dette så du da den første feilen skjedde.'):tx('Drag the timeline to replay the flight.','Dra i tidslinjen for å se hele flygingen.'))}`; }

/* map interaction: drag the aircraft in the walk-through's last step; hold to peek */
(function(){ let drag=null;
  const hit=e=>{ const p=map.evPx(e), u=S.u; if(!u) return null; map.P(u.x,u.y); const ax=map.sx, ay=map.sy, a=map.sa(u.hdg), hx=ax+Math.sin(a)*34, hy=ay-Math.cos(a)*34;
    if(Math.hypot(p.x-hx,p.y-hy)<16) return 'hdg'; return 'pos'; };
  const tryOn=()=>S.step==='understand'&&uSteps()[S.uStep]&&uSteps()[S.uStep].try;
  mapC.addEventListener('pointerdown',e=>{ if(!tryOn()) return; drag=hit(e); if(!drag) return; mapC.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
  const move=e=>{ if(!drag||!S.u) return; const n=map.evNm(e); if(drag==='pos'){ S.u.x=n.x; S.u.y=n.y;
      if(S.ex==='holdEntry'){ const F=I.fixOf(A(),S.X.task); S.u.hdg=Math.round(N.bearing(F.x-n.x,F.y-n.y))||360; } } else { map.P(S.u.x,S.u.y); const p=map.evPx(e); S.u.hdg=norm(Math.round(N.bearing(p.x-map.sx,-(p.y-map.sy))+map.v.rot))||360; } };
  mapC.addEventListener('pointermove',e=>{ if(drag) move(e); else if(tryOn()){ const h=hit(e); mapC.style.cursor=h==='hdg'?'grab':'move'; } else mapC.style.cursor='default'; });
  const up=()=>{ drag=null; }; mapC.addEventListener('pointerup',up); mapC.addEventListener('pointercancel',up);
  let pd=false; const pset=e=>{ if(!S.u) return; const r=profC.getBoundingClientRect(), G0=profGeom(), t=12, b=20, h=r.height-t-b; const a=G0.elev+(1-(e.clientY-r.top-t)/h)*(G0.top-G0.elev); S.u.alt=clamp(Math.round(a/10)*10,G0.elev,G0.top); };
  profC.addEventListener('pointerdown',e=>{ if(!tryOn()) return; pd=true; profC.setPointerCapture(e.pointerId); pset(e); }); profC.addEventListener('pointermove',e=>{ if(pd) pset(e); }); profC.addEventListener('pointerup',()=>pd=false);
  const pk=el('peek'); const on=e=>{ e.preventDefault(); if(!S.peek){ S.peek=true; S.peeks++; } el('veil').style.opacity='0'; }, off=()=>{ S.peek=false; el('veil').style.opacity=''; };
  pk.addEventListener('pointerdown',on); pk.addEventListener('pointerup',off); pk.addEventListener('pointerleave',off); pk.addEventListener('pointercancel',off);
  pk.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') on(e); }); pk.addEventListener('keyup',off); })();

/* legend */
function renderLegend(){ const items=[], s=S.step;
  if(s==='debrief') items.push(['#63D9A0',tx('inside limits','innenfor')],['#F0B440',tx('near the limit','nær grensen')],['#EF6450',tx('outside','utenfor')],['rgba(127,224,255,.9)',tx('instructor (dashed)','instruktøren (stiplet)')]);
  else if(s==='understand'&&S.ex==='ndb') items.push(['#F5BC4C',tx('homing in this wind (dashed)','homing i denne vinden (stiplet)')],['rgba(127,224,255,.9)',tx('tracking (instructor)','tracking (instruktøren)')]);
  else if(s==='understand'&&S.ex!=='math') items.push(['rgba(127,224,255,.9)',tx('the instructor’s path in this wind','instruktørens bane i denne vinden')]);
  else if(s==='fly'&&showHelp()&&S.ex!=='math') items.push(['rgba(127,224,255,.9)',tx('instructor’s path (dashed), next turn','instruktørens bane (stiplet), neste sving')]);
  el('legend').innerHTML=items.map(([c,t])=>`<span><i style="border-color:${c}${/dashed|stiplet/.test(t)?';border-top-style:dashed':''}"></i>${esc(t)}</span>`).join(''); el('legend').hidden=!items.length;
  el('mapNote').textContent=A().real?tx('Real navaid data · for training only, not for navigation','Ekte navigasjonsdata · kun for trening, ikke for navigasjon'):tx('Practice area · fictional stations','Øvingsområde · fiktive stasjoner'); baseDirty=true; }

/* ---------- render everything for a step ---------- */
function renderAll(){ renderBar(); renderBrief(); renderLegend();
  if(S.step==='understand') renderLesson();
  if(S.step==='think') renderThink();
  if(S.step==='debrief') renderDeb();
  if(S.step==='fly'){ renderCtl(); }
  renderQuiz(); renderTbar(); renderGuide(true); renderPlay(); renderRd(true);
  el('pausec').hidden=!S.pause;
  el('veil').hidden=!(S.step==='fly'&&S.X.hidden); el('veilB').textContent=tx('Map hidden','Kartet er skjult'); el('veilP').textContent=tx('Build the picture from the instruments. Where are you, and where is the course?','Bygg bildet fra instrumentene. Hvor er du, og hvor er kursen?'); el('peek').textContent=tx('Hold to peek','Hold for å kikke');
  if(S.ex==='math'&&S.step!=='fly') { el('mathcard').hidden=false; if(S.step==='understand'||S.step==='debrief'){ el('mathcard').innerHTML=`<h3>${tx('Rules of thumb','Tommelfingerregler')}</h3><ol>${MATHU.map(m=>`<li>${esc(L(m))}</li>`).join('')}</ol>`; } }
  else if(S.ex!=='math') el('mathcard').hidden=true;
  requestAnimationFrame(sizeAll); }
function sizeAll(){ layoutInst(); sizeMap(); sizeProf(); sizeTl(); }
let rdKey='';
function renderRd(force){ const box=el('rd'); if(S.step!=='fly'){ box.innerHTML=''; return; } const s=S.sim, r=readNow();
  const parts=[[S.X.pp?tx('CMP','KMP'):'HDG',S.X.pp?d3(r.cmp):d3(s.hdg)],[r.dme!=null&&r.dmeOk?(S.X.nav==='GPS'?r.wp||'WPT':S.X.rnp?'RW':'DME'):null,r.dme!=null&&r.dmeOk?nf1(r.dme):null],['GS',String(Math.round(s.gs))],['ALT',String(Math.round(s.alt/10)*10)]].filter(p=>p[0]);
  if(S.watch.on||S.watch.t>0) parts.push(['⏱',mmss(S.watch.t)]);
  const k=parts.map(p=>p.join(' ')).join('|'); if(!force&&k===rdKey) return; rdKey=k; box.innerHTML=parts.map(([a,b])=>`<span>${a} <b>${b}</b></span>`).join(''); }

/* ---------- the frame loop ---------- */
let lastT=performance.now(), lastUi=0;
function loop(ts){ const dt=Math.min(0.1,Math.max(0,(ts-lastT)/1000)); lastT=ts;
  if(document.body.classList.contains('v-trainer')){
    if(S.step==='fly'&&S.run&&!S.paused){ let rem=dt*S.speed; while(rem>1e-6&&S.run&&!S.paused){ const h=Math.min(0.1,rem); tick(h); rem-=h; } }
    if(S.step==='understand') animU(dt);
    if(S.step==='debrief'&&S.replay&&S.log.length){ S.scrub+=dt*8; const t1=S.log[S.log.length-1].t; if(S.scrub>=t1){ S.scrub=t1; S.replay=false; renderPlay(); } }
    if(S.step==='fly'&&S.run&&ts-lastUi>120){ lastUi=ts; renderGuide(false); renderRd(false); syncCtl(); const c=el('clk'); if(c) c.textContent=mmss(S.sim.t);
      if(S.tt){ const t=el('ttl'); if(t){ const rem=S.tt.dur-(S.sim.t-S.tt.t0); t.textContent=rem>0?`${S.tt.deg<0?tx('left','venstre'):tx('right','høyre')} ${Math.abs(S.tt.deg)}°: ${Math.ceil(rem)} s`:''; } }
      const sw=el('swv'); if(sw) sw.textContent=mmss(S.watch.t); const dsw=el('dsw'); if(dsw){ dsw.textContent=mmss(S.watch.t); dsw.classList.toggle('run',S.watch.on); } }
    if(S.ex!=='math'){ feedGauges(); for(const k of kindsNow()) if(GA[k]){ GA[k].tick(dt); GA[k].draw(); } feedPFD(dt); drawTargets(); }
    drawMap(); drawTl(); if(S.step==='debrief'&&S.scrub!==S._icapT){ S._icapT=S.scrub; renderIcap(); } }
  else if(bDirty) drawBPrev();
  requestAnimationFrame(loop); }

/* ---------- start ---------- */
LAB.start('ifr');
LAB.add({},{'Birdbird · Training':'Birdbird · Trening','IFR trainer':'IFR-trener','Training only · not for navigation':'Kun trening · ikke for navigasjon',
  'What the trainer models':'Hva treneren modellerer','Limits and tolerances':'Grenser og toleranser','Real and practice data':'Ekte data og øvingsdata',
  'Pick any instrument procedure and fly it with an instructor beside you: it tells you the next step, explains why, and shows your first mistake on the replay.':'Velg en instrumentprosedyre og fly den med en instruktør ved siden av deg: den sier neste steg, forklarer hvorfor, og viser den første feilen din i reprisen.'});
LAB.tx({n1:'Standardsvinger (høyst 25° krengning), stigning og sink til valgt høyde med valgt rate, sann fart som øker rundt 2 % per 1000 ft, og vind som er jevn eller byget og skiftende. Kursmarkøren virker som en enkel autopilot: flyet svinger mot den, samme vei som du vred den. Misvisningen er satt til null, så kart og instrumenter stemmer.',
  n2:'Poengene bruker grensene fra EASA IR-ferdighetsprøven: ±100 ft, kurs innenfor ±5°, halvt utslag på ILS, LOC og RNP, aldri under MDA. Holding følger ICAO PANS-OPS: høyresvinger om ikke annet er sagt, legg på 1 minutt til og med 14 000 ft, innganger bestemt av kurs med 5° slingringsmonn på hver side av en sektorlinje. Prosedyresvinger bruker Cat A/B-tiden på 1 minutt.',
  n3:'Bergen og Oslo bruker ekte posisjoner og frekvenser for navigasjonshjelpemidler (OurAirports), kun for trening. Prosedyrene som flys der er illustrasjoner, ikke publiserte kart. Øvingsområdet er fiktivt: Holmvik, Kvist, Fjell, Ravn, Holm og HV-waypointene finnes ikke. Bruk aldri treneren til navigasjon.'});
LAB.onLang(()=>{ quizKey=''; guideKey=''; if(document.body.classList.contains('v-trainer')) renderAll(); else { renderNudge(); renderCat(); renderBld(); } });
S.seed=Math.floor(Math.random()*9000)+1; S.item='orient'; S.ex='orient'; S.p=Object.assign({},I.ITEM.orient.p); setup();
renderNudge(); renderCat(); renderBld();
addEventListener('popstate',route); addEventListener('hashchange',route); route();
new ResizeObserver(()=>{ layoutInst(); }).observe(el('inst'));
new ResizeObserver(()=>{ sizeMap(); }).observe(mapC);
new ResizeObserver(()=>{ sizeProf(); }).observe(profC);
new ResizeObserver(()=>{ sizeTl(); }).observe(tlC);
let rzT=0; addEventListener('resize',()=>{ clearTimeout(rzT); rzT=setTimeout(()=>{ if(!document.body.classList.contains('v-trainer')) bPrev(); else renderCtl&&S.step==='fly'&&renderCtl(); },150); });
requestAnimationFrame(loop);
/* test hooks (used by the browser tests) */
window.__IFR={S,I,setup,go,start,finish,report,setCtl,act,AREAS,openItem,showHome,map,BLD,bldSet,startBuilder,bVals,hintMore,resumePause,action:()=>action(),
  /* a scripted student who does exactly what the guide says (the guide's command applied every tick) */
  followGuide(sec){ const end=S.sim.t+sec; let pauses=0; while(S.run&&S.step==='fly'&&S.sim.t<end){ if(S.pause){ pauses++; resumePause(); } const c=S.gc; if(c){ if(c.act) S.pendingAct=c.act; else if(S.ex==='orient'&&c.ans&&S.sim.t-(S._lr||-9)>4&&Math.abs(diff(S.X.obs,c.obs))<1){ S.pendingAct={type:'report',val:c.ans}; S._lr=S.sim.t; } I.apply(S.sim,S.X,c); } tick(0.1); } return pauses; },
  advance(sec){ const end=S.sim.t+sec; while(S.run&&S.step==='fly'&&S.sim.t<end){ if(S.pause) resumePause(); tick(0.1); } }};
})();
