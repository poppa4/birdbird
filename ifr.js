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
  instLong:{cdi:t2('CDI: the VOR needle','CDI: VOR-nålen'),rmi:t2('RMI: needles that point to the stations','RMI: nåler som peker mot stasjonene'),rbi:t2('RBI: the ADF needle on a card that does not turn','RBI: ADF-nålen på en skive som ikke dreier'),hsi:t2('HSI: compass and course needle in one','HSI: kompass og kursnål i ett'),pfd:t2('PFD: the glass cockpit screen','PFD: skjermen i en glasscockpit')},
  group:{basics:t2('Basics','Grunnlag'),track:t2('Tracking','Følge en kurs'),intercept:t2('Intercepts','Skjære inn på en kurs'),ndb:t2('NDB','NDB'),arc:t2('DME arcs','DME-buer'),hold:t2('Holding','Holding'),
    rev:t2('Reversals','Snuprosedyrer'),app:t2('Approaches','Innflyginger'),route:t2('Departures and arrivals','Ut- og innflygingsruter'),math:t2('Mental maths','Hoderegning'),pp:t2('Partial panel','Delvis panel')},
  groupSub:{basics:t2('Where am I? Read your position off the instruments.','Hvor er jeg? Les posisjonen din av instrumentene.'),track:t2('Stay on a line in wind, and know when you pass the station.','Bli på en linje i vind, og vit når du passerer stasjonen.'),
    intercept:t2('Get onto a course from the side and turn at the right moment.','Kom inn på en kurs fra siden og sving i riktig øyeblikk.'),ndb:t2('Fly straight lines to and from a beacon.','Fly rette linjer til og fra et fyr.'),
    arc:t2('Fly round a station at a fixed distance.','Fly rundt en stasjon i fast avstand.'),hold:t2('Entries, wind and timing in the racetrack pattern.','Innganger, vind og tid i holdingmønsteret.'),
    rev:t2('Turn round and come back on the final course.','Snu og kom tilbake på sluttkursen.'),app:t2('Down to the minimum, then land or climb away.','Ned til minimum, og så land eller stig ut.'),
    route:t2('Follow a GPS route and cross each waypoint at its altitude.','Følg en GPS-rute og kryss hvert waypoint i riktig høyde.'),math:t2('The rules of thumb, with the method shown.','Tommelfingerreglene, med metoden vist.'),
    pp:t2('The heading indicator has failed: compass and clock.','Kursgyroen har sviktet: kompass og klokke.')},
  level:[null,t2('Map, no wind','Kart, ingen vind'),t2('Map and wind','Kart og vind'),t2('Map hidden','Skjult kart'),t2('Hidden map, gusty hidden wind','Skjult kart, skjult vind med kast')],
  area:{practice:t2('Practice area','Øvingsområde'),bergen:t2('Bergen','Bergen'),oslo:t2('Oslo','Oslo')},
  help:{guided:t2('Guided','Veiledet'),hints:t2('Hints','Hint'),off:t2('On my own','På egen hånd')},
  helpSub:{guided:t2('The instructor tells you each step and pauses before the key moments.','Instruktøren sier hvert steg og stopper før de viktige øyeblikkene.'),
    hints:t2('You fly. Ask for a hint when you are stuck.','Du flyr selv. Be om et hint når du står fast.'),
    off:t2('No help while you fly. The debrief shows how it went.','Ingen hjelp mens du flyr. Debriefen viser hvordan det gikk.')},
  diff:[null,t2('Easy','Lett'),t2('Medium','Middels'),t2('Hard','Krevende')]
};
const sideW=s=>L(W.side[s]||W.side.R), dirW=d=>sideW(d>0||d==='R'?'R':'L');
const SCAN={cdi:t2('Look at the needle first, then the heading below','Se på nålen først, så headingen under'),rmi:t2('The head of the needle points to the station; the tail is your radial','Hodet på nålen peker mot stasjonen; halen er radialen din'),
  rbi:t2('Heading + needle = bearing to the beacon','Heading + nål = peiling til fyret'),hsi:t2('The course bar shows where the course is, seen from the aircraft','Kursstreken viser hvor kursen ligger, sett fra flyet'),pfd:t2('Attitude in the centre, navigation below','Flystilling i midten, navigasjon under')};

/* ---------- the glossary: every abbreviation and piece of jargon, one tap away ----------
   The data, the chips and the pop-up live in glossary.js (shared with the Virtual Labs). gl(text) escapes the text and
   turns the first mention of each term into a small button (a "chip"); glH does the same for text with simple markup. */
const GL=window.GLOSS, GLO=GL.G;
const gl=(s,max,skip)=>GL.chips(s,max,skip);
const glH=(h,max)=>GL.chipsH(h,max);
const glClose=()=>GL.close();

/* ---------- the catalogue: name and one plain sentence per item ---------- */
const IT={
 orient:{n:t2('Which radial am I on?','Hvilken radial er jeg på?'),s:t2('Centre the VOR needle and read which line from the station you are on.','Sentrer VOR-nålen og les hvilken linje fra stasjonen du er på.')},
 orientRmi:{n:t2('Read your radial on the RMI','Les radialen på RMI'),s:t2('The RMI needle points to the station. Its tail shows your radial.','RMI-nålen peker mot stasjonen. Halen viser radialen din.')},
 orientRbi:{n:t2('Bearing to a beacon (RBI)','Peiling til et fyr (RBI)'),s:t2('Add your heading and the needle to get the direction to the NDB.','Legg sammen headingen og nålen, så har du retningen til NDB-en.')},
 orientDrill:{n:t2('Ten positions against the clock','Ti posisjoner på tid'),s:t2('Ten quick radial readings on the HSI. Do not mix up TO and FROM.','Ti raske radialavlesninger på HSI. Ikke bland TO og FROM.')},
 trackIn:{n:t2('Track to the station','Følg en kurs inn til stasjonen'),s:t2('Follow one course to a VOR and hold it against the wind.','Følg én kurs inn til en VOR og hold den mot vinden.')},
 trackOut:{n:t2('Track away from the station','Følg en radial ut fra stasjonen'),s:t2('Follow a radial away from the VOR and correct for the wind.','Følg en radial bort fra VOR-en og korriger for vinden.')},
 pass:{n:t2('Station passage','Stasjonspassering'),s:t2('Spot the moment you fly over the VOR: the flag changes from TO to FROM.','Se øyeblikket du flyr over VOR-en: flagget skifter fra TO til FROM.')},
 tts:{n:t2('Time to the station','Tid til stasjonen'),s:t2('No DME? Time a 10° change of bearing and work out the minutes to the station.','Ingen DME? Ta tiden på 10° endring i peilingen og regn ut minuttene til stasjonen.')},
 intIn:{n:t2('Intercept a course inbound','Skjær inn på en kurs mot stasjonen'),s:t2('Fly towards the course at an angle, then turn onto it as the needle moves in.','Fly mot kursen på skrå, og sving inn på den når nålen kommer inn mot midten.')},
 intOut:{n:t2('Intercept a radial outbound','Skjær inn på en radial ut'),s:t2('Join a radial that leads away from the station. Close in, the needle moves fast.','Kom inn på en radial som går bort fra stasjonen. Nær stasjonen går nålen fort.')},
 int90:{n:t2('Intercept at 90°','Skjær inn med 90°'),s:t2('Meet the course at a right angle and start the turn early enough.','Møt kursen i rett vinkel og start svingen tidlig nok.')},
 intPass:{n:t2('New radial after the station','Ny radial etter stasjonen'),s:t2('Fly over the station first. Then join a new radial on the other side.','Fly over stasjonen først. Kom så inn på en ny radial på den andre siden.')},
 intNdbIn:{n:t2('Intercept a course to a beacon (QDM)','Skjær inn på en kurs til et fyr (QDM)'),s:t2('Join a line that leads to an NDB, using the RMI.','Kom inn på en linje som fører til en NDB, med RMI.')},
 intNdbOut:{n:t2('Intercept a course from a beacon (QDR)','Skjær inn på en kurs fra et fyr (QDR)'),s:t2('Join a line that leads away from an NDB, using the fixed-card ADF (RBI).','Kom inn på en linje som går bort fra en NDB, med ADF med fast skive (RBI).')},
 locInt:{n:t2('Intercept the localiser','Skjær inn på localiseren'),s:t2('Turn onto the runway centre line. The needle is four times as sensitive as a VOR.','Sving inn på rullebanens senterlinje. Nålen er fire ganger så følsom som en VOR.')},
 ndb:{n:t2('Track to a beacon (NDB)','Følg en kurs inn til et fyr (NDB)'),s:t2('Fly a straight line to an NDB in a crosswind, not a curve.','Fly en rett linje til en NDB i sidevind, ikke en bue.')},
 ndbOut:{n:t2('Track away from a beacon (NDB)','Følg en kurs ut fra et fyr (NDB)'),s:t2('Fly a straight line away from an NDB. The tail of the needle shows where you are.','Fly en rett linje bort fra en NDB. Halen på nålen viser hvor du er.')},
 dmeJoin:{n:t2('Join a DME arc','Inn på en DME-bue'),s:t2('Turn from a radial onto a circle round the station at a fixed distance.','Sving fra en radial inn på en sirkel rundt stasjonen i fast avstand.')},
 dme:{n:t2('Fly a DME arc','Fly en DME-bue'),s:t2('Out on a radial, round the station at a fixed distance, back in on another radial.','Ut på en radial, rundt stasjonen i fast avstand, inn igjen på en annen radial.')},
 dmeLeave:{n:t2('Leave a DME arc','Ut av en DME-bue'),s:t2('Turn off the arc a few degrees early, so the turn ends on the new radial.','Sving av buen noen grader før, så svingen ender på den nye radialen.')},
 holdEntry:{n:t2('Holding entry','Inngang til holding'),s:t2('Direct, parallel or teardrop: your heading as you reach the fix decides.','Direkte, parallell eller teardrop: headingen din når du kommer til fiksen, bestemmer.')},
 hold:{n:t2('Holding pattern','Holdingmønster'),s:t2('Fly the racetrack in wind: correct the heading and adjust the time each lap.','Fly mønsteret i vind: korriger headingen og juster tiden for hver runde.')},
 holdLeft:{n:t2('Left-hand hold','Holding med venstresvinger'),s:t2('The same pattern mirrored: every turn goes left.','Samme mønster speilvendt: alle svinger går til venstre.')},
 holdNdb:{n:t2('Hold at a beacon (NDB)','Holding ved et fyr (NDB)'),s:t2('Enter and fly a hold over an NDB, using the RMI needle.','Gå inn i og fly en holding over en NDB, med RMI-nålen.')},
 holdDme:{n:t2('Hold at a DME fix','Holding ved en DME-fiks'),s:t2('The fix is a point in the air: one radial and one DME distance.','Fiksen er et punkt i lufta: én radial og én DME-avstand.')},
 holdDmeLim:{n:t2('Hold with a DME limit','Holding med DME-grense'),s:t2('End the outbound leg at a DME distance instead of after one minute.','Avslutt legget ut ved en DME-avstand i stedet for etter ett minutt.')},
 pt:{n:t2('Procedure turn 45°/180°','Prosedyresving 45°/180°'),s:t2('Turn round to come back on the same line: 45° off for a minute, then 180° back.','Snu for å komme tilbake på samme linje: 45° ut i ett minutt, så 180° tilbake.')},
 pt80:{n:t2('Procedure turn 80°/260°','Prosedyresving 80°/260°'),s:t2('Turn round with two turns and no straight leg: 80° one way, 260° the other.','Snu med to svinger uten rett legg: 80° den ene veien, 260° den andre.')},
 base:{n:t2('Base turn','Base turn'),s:t2('Fly out at an angle to the final course, then make one long turn back onto it.','Fly ut på skrå i forhold til sluttkursen, og gjør én lang sving tilbake inn på den.')},
 racetrack:{n:t2('Racetrack procedure','Racetrack-prosedyre'),s:t2('Enter like a hold and fly one lap. It ends on the final course.','Gå inn som i en holding og fly én runde. Den ender på sluttkursen.')},
 vorApp:{n:t2('VOR approach','VOR-innflyging'),s:t2('No DME: a beacon marks where the descent starts, then you check altitude against time.','Ingen DME: et fyr viser hvor nedstigningen starter, og så sjekker du høyden mot tiden.')},
 vordme:{n:t2('VOR/DME approach','VOR/DME-innflyging'),s:t2('Descend along the final course and check your altitude against the DME every mile.','Gå ned langs sluttkursen og sjekk høyden mot DME for hver nautiske mil.')},
 ndbApp:{n:t2('NDB approach','NDB-innflyging'),s:t2('Track to the beacon, cross it, and descend on the line away from it.','Følg kursen til fyret, kryss det, og gå ned på linjen bort fra det.')},
 locApp:{n:t2('Localiser approach','Localiser-innflyging'),s:t2('An ILS without the glide slope: you control the descent yourself.','En ILS uten glidebane: du styrer nedstigningen selv.')},
 ils:{n:t2('ILS approach','ILS-innflyging'),s:t2('Follow two needles down to the runway. No runway in sight at the minimum: climb away.','Følg to nåler ned mot rullebanen. Ser du ikke banen ved minimum, stiger du ut igjen.')},
 lnav:{n:t2('RNP approach (LNAV)','RNP-innflyging (LNAV)'),s:t2('GPS shows left and right only. You control the descent yourself.','GPS viser bare venstre og høyre. Du styrer nedstigningen selv.')},
 lnavVnav:{n:t2('RNP approach (LNAV/VNAV)','RNP-innflyging (LNAV/VNAV)'),s:t2('GPS left and right, plus a glide path worked out from the altimeter.','GPS sideveis, pluss en glidebane regnet ut fra høydemåleren.')},
 lpv:{n:t2('RNP approach (LPV)','RNP-innflyging (LPV)'),s:t2('Satellite needles that look and fly like an ILS.','Satellittnåler som ser ut og flys som en ILS.')},
 sid:{n:t2('Departure (SID)','Utflygingsrute (SID)'),s:t2('Climb out from waypoint to waypoint and cross each one high enough.','Stig ut fra waypoint til waypoint og kryss hvert av dem høyt nok.')},
 star:{n:t2('Arrival (STAR)','Innflygingsrute (STAR)'),s:t2('Descend from waypoint to waypoint and cross each one at the right altitude.','Gå ned fra waypoint til waypoint og kryss hvert av dem i riktig høyde.')},
 math:{n:t2('Mental maths: everything','Hoderegning: alt'),s:t2('Short sums with one rule of thumb each. The method is shown when you need it.','Korte regnestykker med én tommelfingerregel hver. Metoden vises når du trenger den.')},
 mathNav:{n:t2('Mental maths: navigation','Hoderegning: navigasjon'),s:t2('Intercept headings, wind correction, track error and when to start a turn.','Heading for å skjære inn, vindkorreksjon, sporfeil og når du starter en sving.')},
 mathApp:{n:t2('Mental maths: descents','Hoderegning: nedstigning'),s:t2('How fast to descend on a 3° path, and how far out to start.','Hvor fort du går ned på en bane på 3°, og hvor langt ute du starter.')},
 ppTrack:{n:t2('Partial panel: track to the station','Delvis panel: følg en kurs inn'),s:t2('The heading indicator has failed. Turn by the clock and check the compass.','Kursgyroen har sviktet. Sving etter klokka og sjekk kompasset.')},
 ppNdb:{n:t2('Partial panel: track to a beacon','Delvis panel: inn til et fyr'),s:t2('Only the ADF needle and the compass: add them to get the direction to the beacon.','Bare ADF-nålen og kompasset: legg dem sammen, så har du retningen til fyret.')},
 ppHold:{n:t2('Partial panel: holding','Delvis panel: holding'),s:t2('Fly the hold with turns by the clock: 3° every second.','Fly holdingen med svinger på tid: 3° i sekundet.')}
};
const itemName=id=>L((IT[id]||IT.trackIn).n);

/* ---------- Understand: a short animated walk-through per exercise ----------
   Each step: one or two short sentences, a part of the instructor's path to animate (fractions of the run, or the judge's
   phases) and what to draw (one or more of: radials, brg, wedge, arrows, homing, arc, sectors). Every one of the 46 exercises
   has its own three steps. The last step is always "Your turn": drag the aircraft and watch the instrument.
   Plain words first, the term second in brackets. */
const U=(s,seg,show)=>({s,seg,show});
const UW={
 orient:[U(t2('A VOR station sends out 360 lines, like the spokes of a wheel. Each line is called a radial.','En VOR-stasjon sender ut 360 linjer, som eikene i et hjul. Hver linje kalles en radial.'),[0,0.02],'radials'),
   U(t2('Your radial depends only on where you are. It does not change when you turn the nose.','Radialen din avhenger bare av hvor du er. Den endrer seg ikke når du snur nesen.'),[0,0.3],'radials'),
   U(t2('To find it, turn the course knob (OBS) until the needle is in the middle and the flag shows FROM. The number at the top is your radial.','For å finne den vrir du kursknappen (OBS) til nålen står i midten og flagget viser FROM. Tallet øverst er radialen din.'),[0.3,0.6],'radials')],
 orientRmi:[U(t2('The RMI is a compass card with a needle on it. The needle always points to the station.','RMI er en kompasskive med en nål. Nålen peker alltid mot stasjonen.'),[0,0.02],'radials'),
   U(t2('The head of the needle shows the direction to the station. The tail shows the direction from the station to you.','Hodet på nålen viser retningen til stasjonen. Halen viser retningen fra stasjonen til deg.'),[0,0.3],'radials'),
   U(t2('So the number under the tail is your radial. There is nothing to turn: just read it.','Tallet under halen er altså radialen din. Du trenger ikke vri på noe: bare les av.'),[0.3,0.6],'radials')],
 orientRbi:[U(t2('The ADF needle points at the beacon (NDB). Its number is counted clockwise from the nose: the relative bearing.','ADF-nålen peker mot fyret (NDB). Tallet telles med klokka fra nesen: den relative peilingen.'),[0,0.02],'brg'),
   U(t2('Add that number to your heading. The sum is the direction to the beacon (QDM).','Legg det tallet til headingen din. Summen er retningen til fyret (QDM).'),[0,0.3],'brg'),
   U(t2('Is the sum more than 360? Take 360 away. That is the bearing you report.','Ble summen over 360? Trekk fra 360. Det er peilingen du rapporterer.'),[0.3,0.6],'brg')],
 orientDrill:[U(t2('The same task, ten times, on the HSI. The HSI shows the compass and the course needle in one picture.','Samme oppgave, ti ganger, på HSI. HSI viser kompasset og kursnålen i ett bilde.'),[0,0.02],'radials'),
   U(t2('Turn the course knob until the middle part of the needle lines up with the rest. The small white triangle must point to the tail of the arrow: that means FROM.','Vri kursknappen til den midtre delen av nålen står på linje med resten. Den lille hvite trekanten skal peke mot halen på pilen: det betyr FROM.'),[0,0.3],'radials'),
   U(t2('If the triangle points to the arrowhead, you have TO. Then the number is 180° wrong. Check the triangle every time.','Peker trekanten mot pilspissen, har du TO. Da er tallet 180° feil. Sjekk trekanten hver gang.'),[0.3,0.6],'radials')],
 trackIn:[U(t2('Set the course you want to fly with the course knob. On the way to the station the flag shows TO.','Still inn kursen du vil fly, med kursknappen. På vei mot stasjonen viser flagget TO.'),[0,0.25],'wedge'),
   U(t2('The needle shows where the course is. Needle to the right: the course is on your right, so turn right.','Nålen viser hvor kursen ligger. Nålen til høyre: kursen ligger til høyre for deg, så sving til høyre.'),[0.15,0.55],'wedge'),
   U(t2('Then find the heading that keeps the needle still in the middle. In a crosswind it is a few degrees off the course: that is your wind correction.','Finn så headingen som holder nålen i ro i midten. I sidevind er den noen grader ved siden av kursen: det er vindkorreksjonen din.'),[0.55,1],'wedge')],
 trackOut:[U(t2('Flying away from the station, set the radial you want to follow. The flag shows FROM.','Når du flyr bort fra stasjonen, stiller du inn radialen du vil følge. Flagget viser FROM.'),[0,0.3],'wedge'),
   U(t2('The rule is the same: turn towards the needle. Wind shows up as a needle that slowly drifts to one side.','Regelen er den samme: sving mot nålen. Vind ser du som en nål som sakte driver til én side.'),[0.3,0.7],'wedge'),
   U(t2('Turn 10° towards the needle and wait until it is back in the middle. Then take off half the correction and see if the needle stays still (bracketing).','Sving 10° mot nålen og vent til den er tilbake i midten. Ta så bort halve korreksjonen og se om nålen står i ro (bracketing).'),[0.7,1],'wedge')],
 pass:[U(t2('Close to the station the needle gets nervous and swings. Hold your heading. Do not chase the needle.','Nær stasjonen blir nålen urolig og slår ut. Hold headingen. Ikke jag etter nålen.'),[0.55,0.85],'wedge'),
   U(t2('Right over the station the flag changes from TO to FROM. That change is station passage.','Rett over stasjonen skifter flagget fra TO til FROM. Det skiftet er stasjonspasseringen.'),[0.85,0.97],'wedge'),
   U(t2('Press “Station passage” the moment the flag changes. In a real procedure this is where you start the clock.','Trykk «Stasjonspassering» i det flagget skifter. I en ekte prosedyre er det her du starter klokka.'),[0.9,1],'wedge')],
 tts:[U(t2('Turn until the station is straight out to the side, on your wingtip. The needle then points 90° left or right.','Sving til stasjonen ligger rett ut til siden, på vingetippen. Nålen peker da 90° til venstre eller høyre.'),[0,0.05],'brg'),
   U(t2('Start the stopwatch and fly straight ahead. The needle slowly moves backwards.','Start stoppeklokka og fly rett frem. Nålen flytter seg sakte bakover.'),[0,0.6],'brg'),
   U(t2('When it has moved 10°, read the clock. Minutes to the station = seconds ÷ degrees. Example: 90 seconds ÷ 10° = 9 minutes.','Når den har flyttet seg 10°, leser du av klokka. Minutter til stasjonen = sekunder ÷ grader. Eksempel: 90 sekunder ÷ 10° = 9 minutter.'),[0.6,1],'brg')],
 intIn:[U(t2('You are beside the course, not on it. The needle shows which side the course is on.','Du er ved siden av kursen, ikke på den. Nålen viser hvilken side kursen ligger på.'),[0,0.15],'arrows'),
   U(t2('Turn to a heading that crosses the course at 30° to 45°, towards the needle. This is the intercept heading.','Sving til en heading som krysser kursen med 30° til 45°, mot nålen. Dette er headingen du skjærer inn med.'),[0.1,0.5],'arrows'),
   U(t2('Hold that heading. When the needle starts to move towards the middle, turn onto the course. Then the turn ends on the line, not past it.','Hold den headingen. Når nålen begynner å gå mot midten, svinger du inn på kursen. Da ender svingen på linjen, ikke forbi den.'),[0.5,1],'wedge')],
 intOut:[U(t2('This course leads away from the station. Set the radial with the course knob and check that the flag shows FROM.','Denne kursen går bort fra stasjonen. Still inn radialen med kursknappen og sjekk at flagget viser FROM.'),[0,0.2],'wedge'),
   U(t2('Turn to a heading that crosses the radial at 45°, towards the needle.','Sving til en heading som krysser radialen med 45°, mot nålen.'),[0.1,0.5],'arrows'),
   U(t2('Close to the station the radials lie close together, so the needle moves fast. Turn onto the radial as soon as the needle moves.','Nær stasjonen ligger radialene tett, så nålen går fort. Sving inn på radialen så snart nålen rører seg.'),[0.5,1],'wedge')],
 int90:[U(t2('Here you meet the course at a right angle, 90°. The needle stays at the side for a long time.','Her møter du kursen i rett vinkel, 90°. Nålen står lenge helt ute på siden.'),[0,0.4],'wedge'),
   U(t2('Then it crosses to the middle in a few seconds. A 90° turn needs room: about 0.6 NM at 120 kt.','Så går den til midten på få sekunder. En sving på 90° trenger plass: rundt 0,6 NM i 120 kt.'),[0.35,0.65],'wedge'),
   U(t2('So start the turn the moment the needle leaves the side. If you wait for the middle, you fly through the course.','Start derfor svingen i det nålen slipper siden. Venter du til den står i midten, flyr du gjennom kursen.'),[0.6,1],'wedge')],
 intPass:[U(t2('First fly to the station on your course. Over it the needle swings: hold the heading.','Fly først til stasjonen på kursen din. Over den slår nålen ut: hold headingen.'),[0,0.35],'wedge'),
   U(t2('When the flag has changed to FROM, set the new radial with the course knob.','Når flagget har skiftet til FROM, stiller du inn den nye radialen med kursknappen.'),[0.3,0.5],'wedge'),
   U(t2('Then join it like any radial away from the station: turn 45° towards the needle and turn onto it early.','Kom så inn på den som på enhver radial ut: sving 45° mot nålen og sving inn tidlig.'),[0.5,1],'wedge')],
 intNdbIn:[U(t2('An NDB has no course knob and no flag. The RMI needle simply points to the beacon.','En NDB har ingen kursknapp og ikke noe flagg. RMI-nålen peker ganske enkelt mot fyret.'),[0,0.15],'wedge brg'),
   U(t2('The number under the head of the needle is your bearing to the beacon (QDM). You want it to show the course in the clearance.','Tallet under hodet på nålen er peilingen din til fyret (QDM). Du vil at det skal vise kursen i klareringen.'),[0.1,0.5],'wedge brg'),
   U(t2('Fly a heading 30° to 45° across the line. The needle head creeps towards the number you want. Just before it gets there, turn onto the course.','Fly en heading 30° til 45° på skrå mot linjen. Nålhodet kryper mot tallet du vil ha. Like før det er fremme, svinger du inn på kursen.'),[0.5,1],'wedge brg')],
 intNdbOut:[U(t2('This line leads away from the beacon, and the ADF card does not turn (RBI). The needle points behind you.','Denne linjen går bort fra fyret, og ADF-skiven dreier ikke (RBI). Nålen peker bak deg.'),[0,0.2],'wedge brg'),
   U(t2('Heading + needle − 180 is your bearing from the beacon (QDR). You want it to show the course in the clearance.','Heading + nål − 180 er peilingen din fra fyret (QDR). Du vil at den skal vise kursen i klareringen.'),[0.1,0.5],'wedge brg'),
   U(t2('Fly a heading 45° across the line. When the QDR is a few degrees from the one you want, turn onto the course.','Fly en heading 45° på skrå mot linjen. Når QDR er noen grader fra den du vil ha, svinger du inn på kursen.'),[0.5,1],'wedge brg')],
 locInt:[U(t2('You fly a heading towards the runway centre line (the localiser). Its needle stays at the side for a long time.','Du flyr en heading mot rullebanens senterlinje (localiseren). Nålen står lenge helt ute på siden.'),[0,0.4],'loc'),
   U(t2('From side to side the scale is only about 2.5°, a quarter of a VOR. So when the needle moves, it moves fast. The red GS flag only means: no glide slope in this exercise.','Fra side til side er skalaen bare rundt 2,5°, en firedel av en VOR. Når nålen rører seg, går det derfor fort. Det røde GS-flagget betyr bare: ingen glidebane i denne øvelsen.'),[0.35,0.65],'loc'),
   U(t2('Turn onto the runway course as soon as the needle starts to move. Then correct with only 2° at a time.','Sving inn på rullebanekursen så snart nålen begynner å røre seg. Korriger deretter med bare 2° om gangen.'),[0.6,1],'loc')],
 ndb:[U(t2('The ADF needle always points at the beacon (NDB).','ADF-nålen peker alltid mot fyret (NDB).'),[0,0.2],'homing'),
   U(t2('If you just keep the needle on the nose, a crosswind pushes you sideways and you fly a curve. That is called homing.','Holder du bare nålen på nesen, skyver sidevinden deg ut, og du flyr en bue. Det kalles homing.'),[0,0.4],'homing'),
   U(t2('Better: turn a little into the wind and hold that heading. The needle then sits a few degrees off the nose and stays there. You fly a straight line (tracking).','Bedre: sving litt opp mot vinden og hold den headingen. Da står nålen noen grader ved siden av nesen og blir der. Du flyr en rett linje (tracking).'),[0.4,1],'homing')],
 ndbOut:[U(t2('Flying away from the beacon, the needle points behind you. Look at its tail.','Når du flyr bort fra fyret, peker nålen bak deg. Se på halen.'),[0,0.3],'wedge'),
   U(t2('The tail shows your bearing from the beacon (QDR). On the RMI you read it under the tail. On the RBI: heading + needle − 180.','Halen viser peilingen din fra fyret (QDR). På RMI leser du den under halen. På RBI: heading + nål − 180.'),[0.3,0.6],'wedge'),
   U(t2('Is the QDR bigger than the one you want? Then you are right of the line: turn left. Smaller: turn right.','Er QDR større enn den du vil ha? Da er du til høyre for linjen: sving til venstre. Mindre: sving til høyre.'),[0.6,1],'wedge')],
 dme:[U(t2('A DME arc is part of a circle round the station, at a fixed distance. Fly out on the radial and turn 90° onto the arc about half a mile before you reach it.','En DME-bue er en del av en sirkel rundt stasjonen, i fast avstand. Fly ut på radialen og sving 90° inn på buen rundt en halv nautisk mil før du når den.'),[0,0.3],'arc'),
   U(t2('On the arc the station stays out to the side, on your wingtip. Flying straight, the DME slowly grows. Then turn about 10° towards the station.','På buen ligger stasjonen ute til siden, på vingetippen. Flyr du rett frem, øker DME sakte. Sving da rundt 10° mot stasjonen.'),[0.3,0.7],'arc'),
   U(t2('A few degrees before the radial you want, start the turn towards the station. That earlier radial is called the lead radial.','Noen grader før radialen du skal ha, starter du svingen mot stasjonen. Den tidligere radialen kalles lead-radialen.'),[0.7,1],'arc')],
 dmeJoin:[U(t2('Fly out on the radial and watch the DME count up towards the distance of the arc.','Fly ut på radialen og se DME telle opp mot avstanden til buen.'),[0,0.35],'arc'),
   U(t2('A 90° turn takes room: about 0.6 NM at 120 kt. Start the turn that much before the arc.','En sving på 90° tar plass: rundt 0,6 NM i 120 kt. Start svingen så mye før buen.'),[0.3,0.6],'arc'),
   U(t2('End the turn with the station on your wingtip. Then use small turns of about 10° to keep the DME steady.','Avslutt svingen med stasjonen på vingetippen. Bruk så små svinger på rundt 10° for å holde DME jevn.'),[0.6,1],'arc')],
 dmeLeave:[U(t2('On the arc you cross one radial after another. Watch them count towards the one you want.','På buen krysser du den ene radialen etter den andre. Se dem telle mot den du skal ha.'),[0,0.4],'arc'),
   U(t2('Start the turn a few degrees early, on the lead radial. On a 10 NM arc at 120 kt that is about 4° before.','Start svingen noen grader før, på lead-radialen. På en bue på 10 NM i 120 kt er det rundt 4° før.'),[0.4,0.7],'arc'),
   U(t2('Turn towards the station there. The turn then ends on the course to the station instead of past it.','Sving mot stasjonen der. Da ender svingen på kursen inn til stasjonen i stedet for forbi den.'),[0.7,1],'arc')],
 holdEntry:[U(t2('There are three ways into a hold: direct, parallel and teardrop. The coloured sectors round the fix show which one applies.','Det er tre måter å gå inn i en holding på: direkte, parallell og teardrop. De fargede sektorene rundt fiksen viser hvilken som gjelder.'),['tofix'],'sectors'),
   U(t2('Your heading as you cross the fix decides. Look at which coloured sector you arrive through.','Headingen din i det du krysser fiksen, bestemmer. Se hvilken farget sektor du kommer inn gjennom.'),['tofix','entry'],'sectors'),
   U(t2('Then fly that entry. Here the instructor flies it in today’s wind and ends on the leg towards the fix.','Fly så den inngangen. Her flyr instruktøren den i dagens vind og ender på legget inn mot fiksen.'),['entry','entryleg','back','outbound','turnIn','inbound','turnOut'],'sectors')],
 hold:[U(t2('A hold is a racetrack at a fix: two straight legs and two half-circle turns. Standard turns are to the right.','En holding er et ovalt mønster ved en fiks: to rette legg og to halvsirkler. Standard er høyresvinger.'),['turnOut','outbound','turnIn','inbound'],'race'),
   U(t2('Fly the leg towards the fix (inbound) first. The heading that keeps you on it shows the wind correction.','Fly legget inn mot fiksen først. Headingen som holder deg på det, viser vindkorreksjonen.'),['tofix'],'race'),
   U(t2('Flying away from the fix (outbound), use three times that correction, on the other side. Start the clock when the fix is level with your wingtip (abeam).','På legget bort fra fiksen bruker du tre ganger den korreksjonen, til den andre siden. Start klokka når fiksen ligger rett ut for vingetippen (tvers).'),['turnOut','outbound'],'race')],
 holdLeft:[U(t2('In a standard hold every turn goes right. This hold is non-standard: every turn goes left.','I en standard holding går alle svinger til høyre. Denne holdingen er ikke-standard: alle svinger går til venstre.'),['tofix'],'race'),
   U(t2('The whole pattern is mirrored. The holding side is now on the left of the course to the fix.','Hele mønsteret er speilvendt. Holdingsiden ligger nå til venstre for kursen inn mot fiksen.'),['turnOut','outbound'],'race'),
   U(t2('The wind rules do not change: three times the correction on the leg away from the fix, and one minute towards it.','Vindreglene endrer seg ikke: tre ganger korreksjonen på legget bort fra fiksen, og ett minutt inn mot den.'),['turnIn','inbound'],'race')],
 holdNdb:[U(t2('This fix is an NDB. There is no course needle: the RMI needle points to the beacon.','Denne fiksen er en NDB. Det er ingen kursnål: RMI-nålen peker mot fyret.'),['tofix'],'sectors'),
   U(t2('The entry rules do not change. Your heading as you cross the beacon decides: direct, parallel or teardrop.','Reglene for inngang endrer seg ikke. Headingen din i det du krysser fyret, bestemmer: direkte, parallell eller teardrop.'),['tofix','entry'],'sectors'),
   U(t2('On the leg towards the beacon, keep the head of the needle on the inbound course (QDM). When the needle swings round, you are over the beacon.','På legget inn mot fyret holder du hodet på nålen på kursen inn (QDM). Når nålen slår rundt, er du over fyret.'),['entry','entryleg','back','outbound','turnIn','inbound','turnOut'],'sectors')],
 holdDme:[U(t2('This fix is not a station. It is a point on a radial, at a DME distance from the VOR.','Denne fiksen er ikke en stasjon. Den er et punkt på en radial, i en DME-avstand fra VOR-en.'),['tofix'],'sectors'),
   U(t2('You are over the fix when the needle is centred and the DME shows the distance of the fix.','Du er over fiksen når nålen står i midten og DME viser avstanden til fiksen.'),['tofix','entry'],'sectors'),
   U(t2('The entry rules are the same as at a station: your heading at the fix decides.','Reglene for inngang er de samme som ved en stasjon: headingen din over fiksen bestemmer.'),['entry','entryleg','back','outbound','turnIn','inbound','turnOut'],'sectors')],
 holdDmeLim:[U(t2('Fly the leg towards the fix first. It shows you the wind.','Fly legget inn mot fiksen først. Det viser deg vinden.'),['tofix'],'race'),
   U(t2('In this hold the leg away from the fix does not end after one minute. It ends at a DME distance.','I denne holdingen slutter ikke legget bort fra fiksen etter ett minutt. Det slutter ved en DME-avstand.'),['turnOut','outbound'],'race'),
   U(t2('When the DME reaches the limit, turn back towards the fix at once, whatever the clock says.','Når DME når grensen, svinger du tilbake mot fiksen med en gang, uansett hva klokka sier.'),['turnIn','inbound'],'race')],
 racetrack:[U(t2('A racetrack procedure is one lap of a hold. You use it to turn round onto the final course.','En racetrack-prosedyre er én runde i en holding. Du bruker den til å snu inn på sluttkursen.'),['tofix'],'sectors'),
   U(t2('You enter it exactly like a hold: direct, parallel or teardrop.','Du går inn akkurat som i en holding: direkte, parallell eller teardrop.'),['entry','entryleg','back'],'sectors'),
   U(t2('Then fly one lap: away from the fix, the turn, and you are on the final course.','Fly så én runde: bort fra fiksen, svingen, og du er på sluttkursen.'),['turnOut','outbound','turnIn','inbound'],'race')],
 pt:[U(t2('A procedure turn reverses your direction, so you come back on the same line. First fly over the station and away from it for the published time.','En prosedyresving snur deg, så du kommer tilbake på samme linje. Fly først over stasjonen og bort fra den i den publiserte tiden.'),['tofix','out'],'pt'),
   U(t2('Then turn 45° to the side shown on the chart and fly for 1 minute.','Sving så 45° til den siden kartet viser, og fly i 1 minutt.'),['t45'],'pt'),
   U(t2('Now turn 180° the other way. You come out at 45° to the course back to the station and intercept it.','Sving nå 180° den andre veien. Du kommer ut 45° på kursen tilbake til stasjonen og skjærer inn på den.'),['t180','in'],'pt')],
 pt80:[U(t2('The 80°/260° turn is another way to reverse your direction. First fly over the station and away from it for the published time.','80°/260°-svingen er en annen måte å snu på. Fly først over stasjonen og bort fra den i den publiserte tiden.'),['tofix','out'],'pt'),
   U(t2('Then turn 80° to the side shown on the chart.','Sving så 80° til den siden kartet viser.'),['t45'],'pt'),
   U(t2('As soon as you reach that heading, turn 260° the other way. There is no straight leg in between. You come out on the course back to the station.','Så snart du har nådd den headingen, svinger du 260° den andre veien. Det er ikke noe rett legg imellom. Du kommer ut på kursen tilbake til stasjonen.'),['t180','in'],'pt')],
 base:[U(t2('A base turn is a quick way to turn round. Fly over the station and out on a radial that points a little to one side of the final course.','En base turn er en rask måte å snu på. Fly over stasjonen og ut på en radial som peker litt til siden for sluttkursen.'),['tofix','out'],'base'),
   U(t2('The angle between the two lines is about 36° divided by the minutes you fly out. Here: 2 minutes, so 18°.','Vinkelen mellom de to linjene er rundt 36° delt på minuttene du flyr ut. Her: 2 minutter, altså 18°.'),['out'],'base'),
   U(t2('When the time is up, make one long turn towards the final course, more than 180°, and intercept it.','Når tiden er ute, gjør du én lang sving mot sluttkursen, mer enn 180°, og skjærer inn på den.'),['turn','in'],'base')],
 vordme:[U(t2('An approach brings you down along the final course in steps you can check. Stay level until the final approach fix (FAF).','En innflyging tar deg ned langs sluttkursen i steg du kan sjekke. Hold høyden til final approach fix (FAF).'),['initial'],'prof'),
   U(t2('At the FAF start down. A 3° path needs about ground speed × 5 in feet per minute: 90 kt gives 450.','Ved FAF starter du ned. En bane på 3° krever rundt fart over bakken × 5 i fot per minutt: 90 kt gir 450.'),['final'],'prof'),
   U(t2('Every mile, compare your altitude with the DME table and adjust a little. Never go below the minimum altitude (MDA). No runway in sight there: climb away on the missed approach.','For hver nautiske mil sammenligner du høyden med DME-tabellen og justerer litt. Gå aldri under minstehøyden (MDA). Ser du ikke rullebanen der, stiger du ut på avbrutt innflyging.'),['min','miss'],'prof')],
 vorApp:[U(t2('This approach has no DME. A small beacon (locator) on the final course marks the final approach fix (FAF). Fly towards the VOR and stay level.','Denne innflygingen har ingen DME. Et lite fyr (lokator) på sluttkursen markerer final approach fix (FAF). Fly mot VOR-en og hold høyden.'),['initial'],'prof'),
   U(t2('When the ADF needle swings from ahead to behind, you are over the locator. Start the clock and descend at ground speed × 5.','Når ADF-nålen slår fra foran til bak, er du over lokatoren. Start klokka og gå ned med fart over bakken × 5.'),['final'],'prof'),
   U(t2('Check your altitude against the time table. At the minimum altitude (MDA) with no runway in sight: fly the missed approach.','Sjekk høyden mot tidstabellen. Ved minstehøyden (MDA) uten rullebanen i sikte: fly avbrutt innflyging.'),['min','miss'],'prof')],
 ndbApp:[U(t2('The beacon sits on the final course. Fly to it on the bearing to the beacon (QDM) and stay level.','Fyret ligger på sluttkursen. Fly til det på peilingen til fyret (QDM) og hold høyden.'),['initial'],'prof'),
   U(t2('Over the beacon the needle swings round. Now follow the bearing from the beacon (QDR) and start down.','Over fyret slår nålen rundt. Følg nå peilingen fra fyret (QDR) og start ned.'),['final'],'prof'),
   U(t2('Keep the tail of the needle on the final course. At the minimum altitude (MDA) with no runway in sight: fly the missed approach.','Hold halen på nålen på sluttkursen. Ved minstehøyden (MDA) uten rullebanen i sikte: fly avbrutt innflyging.'),['min','miss'],'prof')],
 locApp:[U(t2('The localiser gives ILS precision left and right. There is no glide slope here, so the red GS flag stays on.','Localiseren gir ILS-presisjon sideveis. Her er det ingen glidebane, så det røde GS-flagget blir stående.'),['initial'],'prof'),
   U(t2('At the final approach fix (FAF) you start down yourself. Check the DME table every mile.','Ved final approach fix (FAF) starter du ned selv. Sjekk DME-tabellen for hver nautiske mil.'),['final'],'prof'),
   U(t2('The minimum altitude (MDA) is a floor: level off there. No runway in sight: fly the missed approach.','Minstehøyden (MDA) er et gulv: flat ut der. Ser du ikke rullebanen: fly avbrutt innflyging.'),['min','miss'],'prof')],
 ils:[U(t2('An ILS has two needles. The localiser shows left and right of the runway line. The glide slope shows above and below the 3° path.','En ILS har to nåler. Localiseren viser venstre og høyre for rullebanelinjen. Glidebanen viser over og under banen på 3°.'),[0,0.35],'prof'),
   U(t2('Get onto the localiser first and stay level. The glide slope needle comes down from above. When it reaches the middle, descend at ground speed × 5.','Kom inn på localiseren først og hold høyden. Glidebanenålen kommer ned ovenfra. Når den når midten, går du ned med fart over bakken × 5.'),[0.35,0.75],'prof'),
   U(t2('At the decision altitude (DA) you decide. Runway in sight: land. Not in sight: go around and fly the missed approach.','På beslutningshøyden (DA) bestemmer du deg. Rullebanen i sikte: land. Ikke i sikte: avbryt og fly avbrutt innflyging.'),['miss'],'prof')],
 lnav:[U(t2('An RNP approach uses GPS instead of a station on the ground. LNAV shows left and right only. The needle gets more sensitive as you near the FAF.','En RNP-innflyging bruker GPS i stedet for en stasjon på bakken. LNAV viser bare venstre og høyre. Nålen blir mer følsom når du nærmer deg FAF.'),['initial'],'prof'),
   U(t2('There is no glide path. At the final approach fix (FAF) start down and check the distance table.','Det er ingen glidebane. Ved final approach fix (FAF) starter du ned og sjekker avstandstabellen.'),['final'],'prof'),
   U(t2('The minimum altitude (MDA) is a floor. No runway in sight there: fly the missed approach.','Minstehøyden (MDA) er et gulv. Ser du ikke rullebanen der: fly avbrutt innflyging.'),['min','miss'],'prof')],
 lnavVnav:[U(t2('LNAV/VNAV adds a needle for up and down. Its glide path is worked out from your altimeter (baro-VNAV).','LNAV/VNAV legger til en nål for opp og ned. Glidebanen regnes ut fra høydemåleren din (baro-VNAV).'),['initial'],'prof'),
   U(t2('Stay level until that needle comes down to the middle. Then follow it down, like a glide slope.','Hold høyden til den nålen kommer ned til midten. Følg den så ned, som en glidebane på en ILS.'),['final'],'prof'),
   U(t2('This approach has a decision altitude (DA). No runway in sight there: go around at once.','Denne innflygingen har en beslutningshøyde (DA). Ser du ikke rullebanen der: avbryt med en gang.'),['min','miss'],'prof')],
 lpv:[U(t2('LPV is the most precise GPS approach. The needles come from satellites, but look and behave like an ILS.','LPV er den mest presise GPS-innflygingen. Nålene kommer fra satellitter, men ser ut og oppfører seg som på en ILS.'),['initial'],'prof'),
   U(t2('Stay level until the glide path needle reaches the middle. Then follow both needles with small corrections.','Hold høyden til glidebanenålen når midten. Følg så begge nålene med små korreksjoner.'),['final'],'prof'),
   U(t2('The decision altitude (DA) can be as low as 200 ft above the runway. No runway in sight: go around.','Beslutningshøyden (DA) kan være så lav som 200 ft over rullebanen. Ser du ikke rullebanen: avbryt.'),['min','miss'],'prof')],
 sid:[U(t2('A departure route (SID) is a chain of straight legs between waypoints. The needle shows the leg you are on.','En utflygingsrute (SID) er en kjede av rette legg mellom waypoints. Nålen viser legget du er på.'),[0,0.3],'route'),
   U(t2('Some waypoints have a lowest altitude. “At or above 3000” means: cross it at 3000 ft or higher. So climb early.','Noen waypoints har en laveste høyde. «I eller over 3000» betyr: kryss det i 3000 ft eller høyere. Stig derfor tidlig.'),[0.25,0.6],'route'),
   U(t2('At each waypoint the course changes. Start the turn just before the waypoint and follow the new leg.','Ved hvert waypoint endrer kursen seg. Start svingen like før waypointet og følg det nye legget.'),[0.6,1],'route')],
 star:[U(t2('An arrival route (STAR) leads you from the en-route airway down to the approach.','En innflygingsrute (STAR) fører deg fra luftleden og ned til innflygingen.'),[0,0.3],'route'),
   U(t2('Waypoints can have altitudes: “at or below”, or exactly “at”. Plan ahead: you need about 3 NM for every 1000 ft down.','Waypoints kan ha høyder: «i eller under», eller nøyaktig «i». Planlegg fremover: du trenger rundt 3 NM for hver 1000 ft ned.'),[0.25,0.65],'route'),
   U(t2('Turn at each waypoint and reach the last one at its altitude.','Sving ved hvert waypoint og kom til det siste i riktig høyde.'),[0.65,1],'route')],
 ppTrack:[U(t2('The heading indicator has failed. Only the magnetic compass shows your heading now, and it swings in turns.','Kursgyroen har sviktet. Bare magnetkompasset viser headingen din nå, og det svinger i svinger.'),[0,0.3],'wedge'),
   U(t2('So turn by the clock. A standard turn is 3° every second: 30° takes 10 seconds.','Sving derfor etter klokka. En standardsving er 3° i sekundet: 30° tar 10 sekunder.'),[0.3,0.65],'wedge'),
   U(t2('Make small timed turns. Then let the needle tell you whether the turn was enough.','Gjør små svinger på tid. La så nålen fortelle deg om svingen var nok.'),[0.65,1],'wedge')],
 ppNdb:[U(t2('No heading indicator. Read your heading from the compass when you fly straight and it has settled.','Ingen kursgyro. Les headingen av kompasset når du flyr rett frem og det har roet seg.'),[0,0.3],'homing'),
   U(t2('Compass heading + ADF needle = the bearing to the beacon (QDM).','Kompassheading + ADF-nål = peilingen til fyret (QDM).'),[0.3,0.65],'homing'),
   U(t2('Correct with short timed turns: 3° every second. Then check the sum again.','Korriger med korte svinger på tid: 3° i sekundet. Sjekk så summen på nytt.'),[0.65,1],'homing')],
 ppHold:[U(t2('A hold without the heading indicator. Every turn is flown by the clock.','En holding uten kursgyro. Hver sving flys etter klokka.'),['tofix'],'race'),
   U(t2('A half turn of 180° takes one minute at the standard rate. Stop the turn on time, then check the compass.','En halv sving på 180° tar ett minutt som standardsving. Stopp svingen på tid, og sjekk så kompasset.'),['turnOut','outbound'],'race'),
   U(t2('On the leg towards the fix, the needle shows how well the timing worked. Adjust the next lap.','På legget inn mot fiksen viser nålen hvor godt tiden stemte. Juster neste runde.'),['turnIn','inbound'],'race')]
};
const uwFor=id=>UW[id]||UW[(I.ITEM[id]||{}).ex]||UW.trackIn;
/* "Your turn": one concrete thing to try, per kind of exercise */
const TRYX={
 radial:t2('Your turn. Drag the aircraft: the radial changes. Turn it with the handle: the radial stays the same.','Din tur. Dra flyet: radialen endrer seg. Snu det med håndtaket: radialen er den samme.'),
 rbi:t2('Your turn. Turn the aircraft with the handle. The needle number changes, but heading + needle stays the same.','Din tur. Snu flyet med håndtaket. Tallet på nålen endrer seg, men heading + nål er det samme.'),
 line:t2('Your turn. Drag the aircraft to each side of the course line. Watch the needle point back towards the line.','Din tur. Dra flyet til hver side av kurslinjen. Se at nålen peker tilbake mot linjen.'),
 cross:t2('Your turn. Drag the aircraft slowly across the course line. See how the needle moves in as you get close.','Din tur. Dra flyet sakte over kurslinjen. Se hvordan nålen kommer inn når du nærmer deg.'),
 ndb:t2('Your turn. Turn the aircraft with the handle. The needle moves, but heading + needle still points at the beacon.','Din tur. Snu flyet med håndtaket. Nålen flytter seg, men heading + nål peker fortsatt mot fyret.'),
 arc:t2('Your turn. Drag the aircraft along the arc. The DME stays the same and the station stays on the wingtip.','Din tur. Dra flyet langs buen. DME er den samme, og stasjonen blir liggende på vingetippen.'),
 entry:t2('Your turn. Drag the aircraft round the fix. The entry changes when you move from one coloured sector to the next.','Din tur. Dra flyet rundt fiksen. Inngangen skifter når du går fra én farget sektor til den neste.'),
 hold:t2('Your turn. Drag the aircraft round the pattern and turn it with the handle. Watch what the instrument shows on each leg.','Din tur. Dra flyet rundt mønsteret og snu det med håndtaket. Se hva instrumentet viser på hvert legg.'),
 app:t2('Your turn. Drag the aircraft along the final course. Drag the white dot in the profile up and down to see “too high” and “too low”.','Din tur. Dra flyet langs sluttkursen. Dra den hvite prikken i profilen opp og ned for å se «for høyt» og «for lavt».'),
 any:t2('Your turn. Drag the aircraft and turn it with the handle. Watch how the instrument answers.','Din tur. Dra flyet og snu det med håndtaket. Se hvordan instrumentet svarer.')
};
function tryFor(id){ const it=I.ITEM[id]||{}, ex=it.ex, p=it.p||{};
  if(ex==='orient') return p.kind==='rbi'?TRYX.rbi:TRYX.radial; if(ex==='trackIn'&&!p.pp||ex==='trackOut'||ex==='pass') return TRYX.line;
  if(ex==='intIn'||ex==='intOut'||ex==='intPass'||ex==='locInt') return p.ndb?TRYX.ndb:TRYX.cross; if(ex==='ndb'||ex==='ndbOut') return TRYX.ndb; if(ex==='dme') return TRYX.arc;
  if(ex==='holdEntry') return TRYX.entry; if(ex==='hold') return TRYX.hold; if(isApp(ex)) return TRYX.app; return TRYX.any; }
/* mental maths: the methods, also the walk-through (one set per topic) */
const MATH1=t2('Each question uses one rule of thumb. Learn the rule, and the number comes by itself.','Hvert spørsmål bruker én tommelfingerregel. Lær regelen, så kommer tallet av seg selv.');
const MATHR={
 int:t2('Intercept heading: the course plus or minus 30° or 45°, towards the needle.','Heading for å skjære inn: kursen pluss eller minus 30° eller 45°, mot nålen.'),
 wca:t2('Wind: crosswind × 60 ÷ your true airspeed (TAS) gives the correction in degrees.','Vind: sidevind × 60 ÷ den sanne flyhastigheten (TAS) gir korreksjonen i grader.'),
 r160:t2('1 in 60: being 1 NM off after 60 NM is an error of 1°.','1 av 60: 1 NM ute etter 60 NM er en feil på 1°.'),
 tts:t2('Time to the station: seconds ÷ degrees of bearing change = minutes.','Tid til stasjonen: sekunder ÷ grader peilingsendring = minutter.'),
 lead:t2('A 90° turn needs one turn radius: about ground speed ÷ 200, in NM. On an arc that is 60 × radius ÷ DME degrees.','En sving på 90° trenger én svingradius: rundt fart over bakken ÷ 200, i NM. På en bue er det 60 × radius ÷ DME grader.'),
 rod:t2('On a 3° path: ground speed × 5 gives the rate of descent in feet per minute. 100 kt gives 500.','På en bane på 3°: fart over bakken × 5 gir synkehastigheten i fot per minutt. 100 kt gir 500.'),
 tod:t2('To lose 1000 ft on a 3° path you need 3 NM. So 3000 ft takes 9 NM.','For å tape 1000 ft på en bane på 3° trenger du 3 NM. 3000 ft krever altså 9 NM.')};
const cat2=(a,b)=>({en:a.en+' '+b.en,no:a.no+' '+b.no});
function mathU(id){ const mk=((I.ITEM[id]||{}).p||{}).mk, nav=Array.isArray(mk)&&mk.indexOf('int')>=0, app=Array.isArray(mk)&&mk.indexOf('rod')>=0;
  if(nav) return [MATH1,cat2(MATHR.int,MATHR.wca),cat2(MATHR.r160,MATHR.lead)]; if(app) return [MATH1,MATHR.rod,MATHR.tod];
  return [MATH1,cat2(MATHR.wca,MATHR.r160),cat2(MATHR.rod,MATHR.tod)]; }
function mathRules(id){ const mk=((I.ITEM[id]||{}).p||{}).mk, nav=Array.isArray(mk)&&mk.indexOf('int')>=0, app=Array.isArray(mk)&&mk.indexOf('rod')>=0;
  return app?[MATHR.rod,MATHR.tod]:nav?[MATHR.int,MATHR.wca,MATHR.r160,MATHR.tts,MATHR.lead]:[MATHR.int,MATHR.wca,MATHR.r160,MATHR.tts,MATHR.lead,MATHR.rod,MATHR.tod]; }
const MATHQ={
 int:{q:t2('Course {crs}, the needle is to the {side}. You want to cross the course at {ang}°. Which heading?','Kurs {crs}, nålen står til {side}. Du vil krysse kursen med {ang}°. Hvilken heading?'),m:[t2('The course is on the same side as the needle: {side}.','Kursen ligger på samme side som nålen: {side}.'),t2('Turn towards it: course {sgn} {ang}°.','Sving mot den: kurs {sgn} {ang}°.'),t2('{crs} {sgn} {ang} = {ans}.','{crs} {sgn} {ang} = {ans}.')]},
 wca:{q:t2('Crosswind {xw} kt from the {side}, true airspeed (TAS) {tas} kt. How many degrees of wind correction?','Sidevind {xw} kt fra {side}, sann flyhastighet (TAS) {tas} kt. Hvor mange grader vindkorreksjon?'),m:[t2('Rule: crosswind × 60 ÷ TAS.','Regel: sidevind × 60 ÷ TAS.'),t2('{xw} × 60 = {p60}.','{xw} × 60 = {p60}.'),t2('{p60} ÷ {tas} ≈ {ans}°, into the wind.','{p60} ÷ {tas} ≈ {ans}°, opp mot vinden.')]},
 r160:{q:t2('After {dist} NM you are {off} NM to the side of your track. How many degrees off?','Etter {dist} NM er du {off} NM til siden for sporet. Hvor mange grader feil?'),m:[t2('1 in 60: 1 NM off at 60 NM is 1°.','1 av 60: 1 NM ute etter 60 NM er 1°.'),t2('Error = 60 × distance off ÷ distance flown.','Feil = 60 × avstand ute ÷ fløyet avstand.'),t2('60 × {off} ÷ {dist} = {ans}°.','60 × {off} ÷ {dist} = {ans}°.')]},
 tts:{q:t2('The station is on your wingtip. The bearing changes {deg}° in {sec} s. How many minutes to the station?','Stasjonen ligger på vingetippen. Peilingen endrer seg {deg}° på {sec} s. Hvor mange minutter til stasjonen?'),m:[t2('Minutes = seconds ÷ degrees.','Minutter = sekunder ÷ grader.'),t2('{sec} ÷ {deg}.','{sec} ÷ {deg}.'),t2('= {ans} minutes.','= {ans} minutter.')]},
 rod:{q:t2('Ground speed {gs} kt on a 3° path. How fast do you descend, in ft/min?','Fart over bakken {gs} kt på en bane på 3°. Hvor fort går du ned, i ft/min?'),m:[t2('Rule: ground speed × 5.','Regel: fart over bakken × 5.'),t2('{gs} × 5.','{gs} × 5.'),t2('= {ans} ft/min (the exact figure is about {ex}).','= {ans} ft/min (det nøyaktige tallet er rundt {ex}).')]},
 tod:{q:t2('You must descend from {from} ft to {to} ft on a 3° path. How many NM before the point do you start?','Du skal ned fra {from} ft til {to} ft på en bane på 3°. Hvor mange NM før punktet starter du?'),m:[t2('Rule: 3 NM for every 1000 ft.','Regel: 3 NM for hver 1000 ft.'),t2('{from} − {to} = {dh} ft.','{from} − {to} = {dh} ft.'),t2('{dh} ÷ 1000 × 3 = {ans} NM.','{dh} ÷ 1000 × 3 = {ans} NM.')]},
 lead:{q:t2('You fly a {dme} DME arc at a ground speed of {gs} kt. How many degrees before your radial do you start the 90° turn?','Du flyr en {dme} DME-bue med {gs} kt fart over bakken. Hvor mange grader før radialen din starter du svingen på 90°?'),m:[t2('Turn radius ≈ ground speed ÷ 200 = {R} NM.','Svingradius ≈ fart over bakken ÷ 200 = {R} NM.'),t2('Degrees = 60 × radius ÷ DME.','Grader = 60 × radius ÷ DME.'),t2('60 × {R} ÷ {dme} ≈ {ans}°.','60 × {R} ÷ {dme} ≈ {ans}°.')]},
 leadd:{q:t2('Ground speed {gs} kt. How many NM before a line do you start a 90° turn onto it?','Fart over bakken {gs} kt. Hvor mange NM før en linje starter du en sving på 90° inn på den?'),m:[t2('A 90° turn needs one turn radius.','En sving på 90° trenger én svingradius.'),t2('Radius ≈ ground speed ÷ 200.','Radius ≈ fart over bakken ÷ 200.'),t2('{gs} ÷ 200 = {ans} NM.','{gs} ÷ 200 = {ans} NM.')]}
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
 'orient.ask':t2('Position {n} of {of}. Turn the course knob until the needle is centred and the flag shows FROM. Then report your radial.','Posisjon {n} av {of}. Vri kursknappen til nålen står i midten og flagget viser FROM. Rapporter så radialen din.'),
 'orient.askr':t2('Position {n} of {of}. Read the number under the tail of the green needle. That is your radial: report it.','Posisjon {n} av {of}. Les tallet under halen på den grønne nålen. Det er radialen din: rapporter den.'),
 'orient.askq':t2('Position {n} of {of}. Add your heading and the needle. Report the bearing to the beacon.','Posisjon {n} av {of}. Legg sammen headingen og nålen. Rapporter peilingen til fyret.'),
 'orient.rmi.why':t2('The head of the RMI needle points to the station. So the tail points from the station to you: that is your radial.','Hodet på RMI-nålen peker mot stasjonen. Halen peker altså fra stasjonen til deg: det er radialen din.'),
 'orient.rbi.why':t2('The needle is counted from the nose of the aircraft. Add your heading to get a compass bearing. Take 360 away if the sum is over 360.','Nålen telles fra nesen på flyet. Legg til headingen for å få en kompasspeiling. Trekk fra 360 hvis summen blir over 360.'),
 'orient.to':t2('Centred, but the flag shows TO. That number is the course to the station. Keep turning the knob until the flag shows FROM.','I midten, men flagget viser TO. Det tallet er kursen til stasjonen. Vri videre på knappen til flagget viser FROM.'),
 'orient.to.why':t2('With TO, the number at the top is the course that takes you to the station. Your radial is the direction from the station to you: 180° different.','Med TO er tallet øverst kursen som tar deg til stasjonen. Radialen din er retningen fra stasjonen til deg: 180° forskjell.'),
 'orient.centred':t2('Needle centred with FROM: you are on radial {obs}. Report it.','Nålen i midten med FROM: du er på radial {obs}. Rapporter den.'),
 'track.reverse':t2('The flag shows FROM while you fly to the station, so the needle works the wrong way round. Set the course to {crs}.','Flagget viser FROM mens du flyr mot stasjonen, så nålen virker motsatt vei. Still inn kurs {crs}.'),
 'track.reverse.why':t2('Always set the course you are flying. Towards the station that gives TO. Then a needle on the right always means: the course is on your right.','Still alltid inn kursen du flyr. Mot stasjonen gir det TO. Da betyr nål til høyre alltid: kursen ligger til høyre.'),
 'track.setcrs':t2('First set the course: turn the course knob to {crs}.','Still inn kursen først: vri kursknappen til {crs}.'),
 'track.setcrs.why':t2('The needle only makes sense when the course knob shows the course you want to fly.','Nålen gir bare mening når kursknappen viser kursen du vil fly.'),
 'track.good':t2('On the course. Hold this heading{wca}.','På kursen. Hold denne headingen{wca}.'),
 'track.small':t2('The needle is a little to the {side}. Turn 5° {side}, then hold and watch.','Nålen står litt til {side}. Sving 5° til {side}, hold, og se.'),
 'track.small.why':t2('Use small corrections: 5° when the needle is one dot off or less. Wait until the needle stops moving before you correct again.','Bruk små korreksjoner: 5° når nålen er én prikk ute eller mindre. Vent til nålen står stille før du korrigerer igjen.'),
 'track.big':t2('The needle is far to the {side}. Turn towards it: heading {hdg}.','Nålen står langt til {side}. Sving mot den: heading {hdg}.'),
 'track.big.why':t2('Turn towards the needle. The further off it is, the bigger the turn: up to 30° to 45° from the course.','Sving mot nålen. Jo lenger ute den står, jo større sving: opptil 30° til 45° fra kursen.'),
 'track.wind':t2('Your heading is the same as the course, but the needle drifts {side}. That is the wind. Hold a few degrees into it.','Headingen er lik kursen, men nålen driver til {side}. Det er vinden. Hold noen grader opp mot den.'),
 'track.wind.why':t2('Find the heading that keeps the needle still. The difference between that heading and the course is your wind correction.','Finn headingen som holder nålen i ro. Forskjellen mellom den headingen og kursen er vindkorreksjonen din.'),
 'track.cone':t2('Over the station the needle cannot be trusted. Hold the heading until the flag changes.','Over stasjonen kan du ikke stole på nålen. Hold headingen til flagget skifter.'),
 'int.pickA':t2('The course is on your {side}. Turn to heading {a}: it crosses the course at {ang}°.','Kursen ligger til {side} for deg. Sving til heading {a}: den krysser kursen med {ang}°.'),
 'int.pick':t2('The course is on your {side}. Turn to heading {a} (30° across) or {b} (45° across).','Kursen ligger til {side} for deg. Sving til heading {a} (30° på skrå) eller {b} (45° på skrå).'),
 'int.pick.why':t2('Intercept heading = the course plus or minus 30° to 45°, towards the needle. Far from the course use 45°. Close to it, 30° is enough.','Heading for å skjære inn = kursen pluss eller minus 30° til 45°, mot nålen. Langt fra kursen bruker du 45°. Nær den holder det med 30°.'),
 'int.wait':t2('Hold this heading. The needle will start to move in from the side.','Hold denne headingen. Nålen begynner snart å komme inn fra siden.'),
 'int.wait.why':t2('A needle at the side means you are 10° or more from the course. There is nothing to do yet except hold the heading.','En nål helt ute på siden betyr at du er 10° eller mer fra kursen. Det er ingenting å gjøre ennå, annet enn å holde headingen.'),
 'int.lead':t2('The needle is moving: start the turn onto {crs} now.','Nålen rører seg: start svingen inn på {crs} nå.'),
 'int.lead.why':t2('A turn takes room. Start it when the needle passes the second or third dot. Then the turn ends on the course instead of past it.','En sving tar plass. Start den når nålen passerer andre eller tredje prikk. Da ender svingen på kursen i stedet for forbi den.'),
 'ndb.homing':t2('You are homing: the nose follows the needle and the wind bends your path.','Du flyr homing: nesen følger nålen, og vinden bøyer banen din.'),
 'ndb.homing.why':t2('Pointing the nose at the beacon only works without wind. In wind, hold a heading a little into the wind and let the needle sit a few degrees off the nose.','Å peke nesen mot fyret virker bare uten vind. I vind holder du en heading litt opp mot vinden og lar nålen stå noen grader ved siden av nesen.'),
 'ndb.good':t2('On the line. The needle sits {rb}° {side} of the nose: that is your wind correction.','På linjen. Nålen står {rb}° til {side} for nesen: det er vindkorreksjonen din.'),
 'ndb.good.why':t2('When you correct for wind, the nose does not point at the beacon. The needle shows the beacon a few degrees to one side, and it stays there.','Når du korrigerer for vind, peker ikke nesen mot fyret. Nålen viser fyret noen grader til siden, og den blir der.'),
 'ndb.off':t2('Your bearing to the beacon is {qdm}. You want {crs}. Turn {side} to get back on the line.','Peilingen din til fyret er {qdm}. Du vil ha {crs}. Sving til {side} for å komme tilbake på linjen.'),
 'ndb.off.why':t2('Bearing to the beacon (QDM) = heading + needle. Is it bigger than the one you want? Then you are left of the line: turn right. Smaller: turn left.','Peiling til fyret (QDM) = heading + nål. Er den større enn den du vil ha? Da er du til venstre for linjen: sving til høyre. Mindre: sving til venstre.'),
 'arc.out':t2('Follow the radial away from the station. At {lead} DME turn {dir} onto the arc, to a heading of about {hdg}.','Følg radialen bort fra stasjonen. Ved {lead} DME svinger du til {dir} inn på buen, til en heading på rundt {hdg}.'),
 'arc.turnsoon':t2('The arc is close. Turn {dir} at {lead} DME, so the turn ends at {R} DME.','Buen er nær. Sving til {dir} ved {lead} DME, så svingen ender på {R} DME.'),
 'arc.lead.why':t2('A 90° turn takes about one turn radius. Start that much early and the turn ends on the arc, not outside it.','En sving på 90° tar omtrent én svingradius. Start så mye før, så ender svingen på buen og ikke utenfor.'),
 'arc.good':t2('On the arc. Keep the station on your wingtip. When the DME changes, turn about 10°.','På buen. Hold stasjonen på vingetippen. Når DME endrer seg, svinger du rundt 10°.'),
 'arc.outside':t2('You are {e} NM outside the arc. Turn 10° to 20° towards the station.','Du er {e} NM utenfor buen. Sving 10° til 20° mot stasjonen.'),
 'arc.inside':t2('You are {e} NM inside the arc. Turn about 10° away from the station.','Du er {e} NM innenfor buen. Sving rundt 10° bort fra stasjonen.'),
 'arc.fly.why':t2('An arc is flown as a row of short straight lines. Keep the needle that points to the station near your wingtip, and correct about 10° at a time.','En bue flys som en rekke korte rette linjer. Hold nålen som peker mot stasjonen, nær vingetippen, og korriger rundt 10° om gangen.'),
 'arc.leadradial':t2('Start the turn onto {crs} about {lead}° before radial {r1}. That point is the lead radial.','Start svingen inn på {crs} rundt {lead}° før radial {r1}. Det punktet er lead-radialen.'),
 'arc.leadradial.why':t2('The turn from the arc onto the radial is 90° and takes room. Start a few degrees early: about 60 × turn radius ÷ DME.','Svingen fra buen inn på radialen er 90° og tar plass. Start noen grader før: rundt 60 × svingradius ÷ DME.'),
 'hold.tofix':t2('Fly to the fix. With this heading you get a {entry} entry.','Fly til fiksen. Med denne headingen får du {entry} inngang.'),
 'hold.entry.why':t2('The heading you cross the fix with decides the entry. Picture the 70° line through the fix on the holding side.','Headingen du krysser fiksen med, bestemmer inngangen. Se for deg 70°-linjen gjennom fiksen på holdingsiden.'),
 'hold.entry.direct':t2('Direct entry: over the fix, turn {dir} to heading {out}.','Direkte inngang: over fiksen svinger du til {dir} til heading {out}.'),
 'hold.entry.direct.why':t2('Direct: you already point roughly along the hold. Cross the fix and turn straight into the pattern.','Direkte: du peker allerede omtrent langs holdingen. Kryss fiksen og sving rett inn i mønsteret.'),
 'hold.entry.parallel':t2('Parallel entry: over the fix, turn to heading {out} and fly 1 minute beside the inbound course.','Parallell inngang: over fiksen svinger du til heading {out} og flyr 1 minutt ved siden av kursen inn.'),
 'hold.entry.parallel.why':t2('Parallel: fly away from the fix next to the inbound course, on the side without the hold. Then turn back through the holding side to the fix.','Parallell: fly bort fra fiksen ved siden av kursen inn, på siden uten holding. Sving så tilbake gjennom holdingsiden til fiksen.'),
 'hold.entry.teardrop':t2('Teardrop entry: over the fix, turn to heading {td} and fly 1 minute.','Teardrop-inngang: over fiksen svinger du til heading {td} og flyr 1 minutt.'),
 'hold.entry.teardrop.why':t2('Teardrop: fly away from the fix 30° off the outbound course, into the holding side. Then make one turn, in the hold direction, onto the inbound course.','Teardrop: fly bort fra fiksen 30° fra kursen ut, inn i holdingsiden. Gjør så én sving, i holdingens retning, inn på kursen inn.'),
 'hold.entryleg':t2('Entry leg: {s} s left.','Inngangslegget: {s} s igjen.'),
 'hold.entryturn':t2('Time is up: turn {dir}, back towards the fix.','Tiden er ute: sving til {dir}, tilbake mot fiksen.'),
 'hold.entryturn.why':t2('After a teardrop, turn in the hold direction onto the inbound course. After a parallel entry, turn towards the holding side, more than 180°, back to the fix.','Etter en teardrop svinger du i holdingens retning inn på kursen inn. Etter en parallell inngang svinger du mot holdingsiden, mer enn 180°, tilbake til fiksen.'),
 'hold.back':t2('Fly back to the fix on course {inb}.','Fly tilbake til fiksen på kurs {inb}.'),
 'hold.inbound':t2('Towards the fix on course {inb}. Hold a heading of about {hdg} to stay on the course.','Inn mot fiksen på kurs {inb}. Hold en heading på rundt {hdg} for å bli på kursen.'),
 'hold.inbound.why':t2('The leg towards the fix shows you the wind. The heading that keeps the needle centred gives the correction you need for the whole hold.','Legget inn mot fiksen viser deg vinden. Headingen som holder nålen i midten, gir korreksjonen du trenger i hele holdingen.'),
 'hold.turnout':t2('Over the fix: turn {dir} to heading {hdg}, away from the fix.','Over fiksen: sving til {dir} til heading {hdg}, bort fra fiksen.'),
 'hold.turnout.why':t2('Heading away from the fix = the outbound course with three times the wind correction, on the other side. Three times, because you cannot correct during the two turns.','Heading bort fra fiksen = kursen ut med tre ganger vindkorreksjonen, til den andre siden. Tre ganger, fordi du ikke kan korrigere i de to svingene.'),
 'hold.outbound':t2('Away from the fix on heading {hdg}. Start the clock when the fix is level with your wingtip (abeam).','Bort fra fiksen på heading {hdg}. Start klokka når fiksen ligger rett ut for vingetippen (tvers).'),
 'hold.outbound.why':t2('The time away from the fix starts abeam the fix. If the turn is not finished by then, it starts when the wings are level.','Tiden bort fra fiksen starter tvers av fiksen. Er ikke svingen ferdig da, starter den når vingene er i vater.'),
 'hold.timing':t2('Away from the fix: {s} s of about {want} s.','Bort fra fiksen: {s} s av rundt {want} s.'),
 'hold.timing.why':t2('Choose the time away from the fix so that the leg back takes 1 minute. Was the leg back too short? Fly longer away from the fix next lap.','Velg tiden bort fra fiksen slik at legget tilbake tar 1 minutt. Ble legget tilbake for kort? Fly lenger bort fra fiksen neste runde.'),
 'hold.turnin':t2('Turn back towards the fix, onto course {inb}. Watch the needle as the turn ends.','Sving tilbake mot fiksen, inn på kurs {inb}. Følg nålen når svingen ender.'),
 'pt.tofix':t2('Fly over the station, then away from it on radial {out}.','Fly over stasjonen, og så bort fra den på radial {out}.'),
 'pt.tofix.why':t2('Start the clock over the station. The time to fly away from it is on the chart.','Start klokka over stasjonen. Tiden du skal fly bort fra den, står på kartet.'),
 'pt.out':t2('Away from the station: {s} s to the {a}° turn.','Bort fra stasjonen: {s} s til svingen på {a}°.'),
 'pt.turn45':t2('Turn {dir} {a}° to heading {hdg}{clk}.','Sving {a}° til {dir} til heading {hdg}{clk}.'),
 'pt.turn45.why':t2('The first turn makes room for the turn back. Turn to the side shown on the chart: only that side is kept clear of obstacles.','Den første svingen gir plass til svingen tilbake. Sving til den siden kartet viser: bare den siden er holdt fri for hindringer.'),
 'pt.leg45':t2('{s} s left on the 45° leg.','{s} s igjen på 45°-legget.'),
 'pt.turn180':t2('Turn {dir} through 180° to heading {hdg}. Then intercept the course back to the station.','Sving 180° til {dir} til heading {hdg}. Skjær så inn på kursen tilbake til stasjonen.'),
 'pt.turn180.why':t2('The 180° turn goes the opposite way to the 45° turn, away from the station. That keeps you inside the protected area.','Svingen på 180° går motsatt vei av svingen på 45°, bort fra stasjonen. Da blir du innenfor det beskyttede området.'),
 'pt.intercept':t2('Intercept course {inb} back to the station: turn onto it when the needle moves in.','Skjær inn på kurs {inb} tilbake til stasjonen: sving inn når nålen kommer inn.'),
 'base.tofix':t2('Fly over the station, then away from it on radial {ro}.','Fly over stasjonen, og så bort fra den på radial {ro}.'),
 'base.why':t2('A base turn: fly out a little to one side of the final course, then make one turn of more than 180° onto it.','En base turn: fly ut litt til siden for sluttkursen, og gjør så én sving på mer enn 180° inn på den.'),
 'base.out':t2('Away from the station: {s} s to the base turn.','Bort fra stasjonen: {s} s til base turn.'),
 'base.turn':t2('Turn {dir} now, onto course {inb} back to the station.','Sving til {dir} nå, inn på kurs {inb} tilbake til stasjonen.'),
 'base.turn.why':t2('Turn towards the final course. The leg away from the station is set off to that side, so one turn brings you onto it.','Sving mot sluttkursen. Legget bort fra stasjonen ligger forskjøvet til den siden, så én sving tar deg inn på den.'),
 'vor.initial':t2('Stay level at {alt} ft until the final approach fix (FAF) at {faf} DME. The minimum altitude (MDA) is {mda} ft.','Hold {alt} ft til final approach fix (FAF) ved {faf} DME. Minstehøyden (MDA) er {mda} ft.'),
 'vor.initial.why':t2('You may not descend below the published altitude before the final approach fix.','Du kan ikke gå under den publiserte høyden før final approach fix.'),
 'vor.faf':t2('At the FAF: start down at about {rod} ft/min.','Ved FAF: start ned med rundt {rod} ft/min.'),
 'vor.faf.why':t2('From the FAF you descend on a 3° path. The rate is about ground speed × 5, in ft/min.','Fra FAF går du ned på en bane på 3°. Synkehastigheten er rundt fart over bakken × 5, i ft/min.'),
 'vor.onprofile':t2('On the path. Next check: {dme} DME, {alt} ft.','På banen. Neste sjekk: {dme} DME, {alt} ft.'),
 'vor.high':t2('{pa} ft too high. Descend a little faster.','{pa} ft for høyt. Gå ned litt fortere.'),
 'vor.low':t2('{pa} ft too low. Descend more slowly.','{pa} ft for lavt. Gå ned saktere.'),
 'vor.profile.why':t2('Every mile, compare your altitude with the table. Too high or too low: change the rate a little, then check again at the next mile.','For hver nautiske mil sammenligner du høyden med tabellen. For høyt eller for lavt: endre synkehastigheten litt, og sjekk igjen ved neste mil.'),
 'app.minimums':t2('You are at the minimum and the runway is in sight: land.','Du er på minimum og har rullebanen i sikte: land.'),
 'ils.vector':t2('Hold the heading. The localiser needle has not started to move yet.','Hold headingen. Localiser-nålen har ikke begynt å røre seg ennå.'),
 'ils.vector.why':t2('The localiser is narrow: only about 2.5° from side to side. The needle starts to move late, and then it moves fast.','Localiseren er smal: bare rundt 2,5° fra side til side. Nålen begynner å røre seg sent, og da går det fort.'),
 'ils.alive':t2('The localiser needle is moving: turn onto {crs} now.','Localiser-nålen rører seg: sving inn på {crs} nå.'),
 'ils.waitgs':t2('On the localiser. Stay at {alt} ft until the glide slope needle comes down to the middle.','På localiseren. Hold {alt} ft til glidebanenålen kommer ned til midten.'),
 'ils.waitgs.why':t2('You meet the glide slope from below. When its needle is centred, descend at about {rod} ft/min.','Du møter glidebanen nedenfra. Når nålen står i midten, går du ned med rundt {rod} ft/min.'),
 'ils.good':t2('Both needles centred. Keep the corrections small.','Begge nålene i midten. Hold korreksjonene små.'),
 'ils.low':t2('Below the glide slope: descend more slowly.','Under glidebanen: gå ned saktere.'),
 'ils.high':t2('Above the glide slope: descend a little faster.','Over glidebanen: gå ned litt fortere.'),
 'ils.loc':t2('The localiser needle is to the {side}: turn 2° to 3° towards it.','Localiser-nålen står til {side}: sving 2° til 3° mot den.'),
 'ils.fly.why':t2('Fly the needles with small changes: 2° to 3° of heading for the localiser, 100 to 200 ft/min for the glide slope.','Fly nålene med små endringer: 2° til 3° heading for localiseren, 100 til 200 ft/min for glidebanen.'),
 'pt.turn260':t2('Turn {dir} through 260° to heading {hdg}, onto the course back to the station.','Sving 260° til {dir} til heading {hdg}, inn på kursen tilbake til stasjonen.'),
 'pt.turn260.why':t2('In the 80°/260° there is no straight leg between the turns. The 260° turn goes the other way and ends on the course back to the station.','I 80°/260° er det ikke noe rett legg mellom svingene. Svingen på 260° går den andre veien og ender på kursen tilbake til stasjonen.'),
 'hold.dmeout':t2('Away from the fix on heading {hdg}. Turn back at {D} DME (now {now}).','Bort fra fiksen på heading {hdg}. Sving tilbake ved {D} DME (nå {now}).'),
 'hold.dmeout.why':t2('In this hold the leg away from the fix ends at the DME limit, whatever the clock says.','I denne holdingen slutter legget bort fra fiksen ved DME-grensen, uansett hva klokka sier.'),
 'miss.climb':t2('Go around: climb and follow {crs}. At {ta} ft turn {dir} to heading {hdg}.','Avbryt: stig og følg {crs}. Ved {ta} ft svinger du til {dir} til heading {hdg}.'),
 'miss.turn':t2('Turn {dir} to heading {hdg} and climb to {alt} ft.','Sving til {dir} til heading {hdg} og stig til {alt} ft.'),
 'miss.why':t2('At the minimum without the runway in sight you go around at once: full power, nose up, climb straight ahead, then the published turn.','På minimum uten rullebanen i sikte avbryter du med en gang: full motor, nesen opp, stig rett frem, og så den publiserte svingen.'),
 'app.init':t2('Stay level at {alt} ft until the final approach fix (FAF). The minimum is {mins} ft.','Hold {alt} ft til final approach fix (FAF). Minimum er {mins} ft.'),
 'app.init.cdfa.why':t2('You may not descend below the published altitude before the FAF. After it you descend at a steady rate to the minimum altitude (MDA).','Du kan ikke gå under den publiserte høyden før FAF. Etter den går du jevnt ned til minstehøyden (MDA).'),
 'app.init.gp.why':t2('Stay level and let the glide path come down to you. You always meet it from below.','Hold høyden og la glidebanen komme ned til deg. Du møter den alltid nedenfra.'),
 'app.faf':t2('At the FAF ({fix}): start down at about {rod} ft/min.','Ved FAF ({fix}): start ned med rundt {rod} ft/min.'),
 'app.gpfaf':t2('The glide path needle is coming down. When it is centred, descend at about {rod} ft/min.','Glidebanenålen kommer ned. Når den står i midten, går du ned med rundt {rod} ft/min.'),
 'app.ontime':t2('On the path. Next check: {t} s after the FAF, {alt} ft.','På banen. Neste sjekk: {t} s etter FAF, {alt} ft.'),
 'rt.next':t2('Follow course {crs} to {wp}, {d} NM.','Følg kurs {crs} til {wp}, {d} NM.'),
 'rt.alt':t2('Check your altitude: cross {wp} {cw} {alt} ft.','Sjekk høyden: kryss {wp} {cw} {alt} ft.'),
 'rt.turn':t2('{wp} is just ahead: turn {dir} onto course {crs}.','{wp} er like foran: sving til {dir} inn på kurs {crs}.'),
 'rt.next.why':t2('Each leg is a straight line between two waypoints. Keep the needle centred and cross each waypoint at its altitude.','Hvert legg er en rett linje mellom to waypoints. Hold nålen i midten og kryss hvert waypoint i riktig høyde.'),
 'rt.turn.why':t2('Start the turn just before the waypoint (fly-by). Then the turn ends on the next leg.','Start svingen like før waypointet (fly-by). Da ender svingen på neste legg.'),
 'pass.watch':t2('The station is close. Hold the heading and watch the flag.','Stasjonen er nær. Hold headingen og følg med på flagget.'),
 'pass.after':t2('You have passed the station. Report it if you have not done so.','Du har passert stasjonen. Rapporter hvis du ikke har gjort det.'),
 'pass.why':t2('Over a VOR the needle swings and the flag changes from TO to FROM. The change of the flag is the passage.','Over en VOR slår nålen ut, og flagget skifter fra TO til FROM. Flaggskiftet er passeringen.'),
 'tts.time':t2('The station is on your wingtip. The bearing has changed {ch}° in {s} s.','Stasjonen ligger på vingetippen. Peilingen har endret seg {ch}° på {s} s.'),
 'tts.report':t2('10° in {s} s. Work out the minutes and report.','10° på {s} s. Regn ut minuttene og rapporter.'),
 'tts.why':t2('Minutes to the station = the seconds it took ÷ the degrees the bearing changed.','Minutter til stasjonen = sekundene det tok ÷ gradene peilingen endret seg.'),
 'ndbo.good':t2('On the line: your bearing from the beacon is {qdr}.','På linjen: peilingen din fra fyret er {qdr}.'),
 'ndbo.off':t2('Your bearing from the beacon is {qdr}. You want {crs}. Turn {side}.','Peilingen din fra fyret er {qdr}. Du vil ha {crs}. Sving til {side}.'),
 'ndbo.why':t2('Bearing from the beacon (QDR) = heading + needle − 180. Is it bigger than the one you want? Then you are right of the line: turn left. Smaller: turn right.','Peiling fra fyret (QDR) = heading + nål − 180. Er den større enn den du vil ha? Da er du til høyre for linjen: sving til venstre. Mindre: sving til høyre.'),
 'ip.inbound':t2('Follow {c0} to the station. After it, intercept radial {crs} away from the station.','Følg {c0} til stasjonen. Etter den skjærer du inn på radial {crs} ut.'),
 'ip.wait':t2('Hold {c0} through the station. Turn only when the flag shows FROM.','Hold {c0} gjennom stasjonen. Sving først når flagget viser FROM.'),
 'ip.why':t2('Over the station the needle cannot be trusted. Hold the heading until the flag changes, then intercept.','Over stasjonen kan du ikke stole på nålen. Hold headingen til flagget skifter, og skjær så inn.'),
 'loc.good':t2('On the localiser. Stay on it with changes of 2° at a time.','På localiseren. Bli på den med endringer på 2° om gangen.'),
 'math.ask':t2('Question {n} of {of}.','Spørsmål {n} av {of}.'),
 'math.int.why':t2('Intercept heading = the course plus or minus 30° or 45°, towards the needle.','Heading for å skjære inn = kursen pluss eller minus 30° eller 45°, mot nålen.'),
 'math.wca.why':t2('Wind correction ≈ crosswind × 60 ÷ true airspeed (TAS).','Vindkorreksjon ≈ sidevind × 60 ÷ sann flyhastighet (TAS).'),
 'math.r160.why':t2('1 in 60: being 1 NM off after 60 NM is 1°.','1 av 60: 1 NM ute etter 60 NM er 1°.'),
 'math.tts.why':t2('Time to the station in minutes = seconds ÷ degrees of bearing change.','Tid til stasjonen i minutter = sekunder ÷ grader peilingsendring.'),
 'math.rod.why':t2('On a 3° path: rate of descent ≈ ground speed × 5.','På en bane på 3°: synkehastighet ≈ fart over bakken × 5.'),
 'math.tod.why':t2('On a 3° path you need 3 NM for every 1000 ft.','På en bane på 3° trenger du 3 NM for hver 1000 ft.'),
 'math.lead.why':t2('Degrees before the radial ≈ 60 × turn radius ÷ DME. Turn radius ≈ ground speed ÷ 200.','Grader før radialen ≈ 60 × svingradius ÷ DME. Svingradius ≈ fart over bakken ÷ 200.'),
 'math.leadd.why':t2('A 90° turn needs one turn radius ≈ ground speed ÷ 200, in NM.','En sving på 90° trenger én svingradius ≈ fart over bakken ÷ 200, i NM.')
};
/* debrief: what happened, and what to do instead */
const EV={
 reverse:{h:t2('The needle worked backwards','Nålen virket motsatt vei'),w:t2('The course knob was set to {obs}, the opposite of your course, while you flew towards the station. The flag showed FROM, so the needle pointed away from the course (reverse sensing).','Kursknappen sto på {obs}, motsatt av kursen din, mens du fløy mot stasjonen. Flagget viste FROM, så nålen pekte bort fra kursen (reverse sensing).'),
  d:t2('Set the course you are flying, {crs}. Towards the station that gives TO, and the needle points to the course.','Still inn kursen du flyr, {crs}. Mot stasjonen gir det TO, og nålen peker mot kursen.')},
 nocrs:{h:t2('Course not set','Kursen var ikke stilt inn'),w:t2('For a long time the course knob did not show the course in the clearance.','Lenge viste ikke kursknappen kursen i klareringen.'),d:t2('Set the course before anything else. Only then does the needle tell you something.','Still inn kursen før du gjør noe annet. Først da forteller nålen deg noe.')},
 outside:{h:t2('Off the course','Utenfor kursen'),w:t2('You were {e}° from the course. The limit is 5°.','Du var {e}° fra kursen. Grensen er 5°.'),
  d:t2('Correct early, when the needle is one dot off: turn 5° to 10° towards the needle, then hold and watch.','Korriger tidlig, når nålen er én prikk ute: sving 5° til 10° mot nålen, hold, og se.')},
 drift:{h:t2('The wind pushed you off','Vinden skjøv deg ut'),w:t2('Your heading was the same as the course. The wind carried you {e}° off the line.','Headingen din var lik kursen. Vinden tok deg {e}° ut fra linjen.'),
  d:t2('Hold a heading a few degrees into the wind. When the needle stays still, you have found the right heading.','Hold en heading noen grader opp mot vinden. Når nålen står i ro, har du funnet riktig heading.')},
 away:{h:t2('Turned away from the needle','Svingte bort fra nålen'),w:t2('The needle was to the {side}, and you flew further away from the course.','Nålen sto til {side}, og du fløy lenger bort fra kursen.'),
  d:t2('Turn towards the needle: needle {side}, turn {side}.','Sving mot nålen: nål til {side}, sving til {side}.')},
 alt:{h:t2('Altitude','Høyde'),w:t2('You were {e} ft away from {target} ft. The limit is 100 ft.','Du var {e} ft fra {target} ft. Grensen er 100 ft.'),d:t2('Look at the altimeter every time your eyes go round the instruments. Correct when it is 50 ft off.','Se på høydemåleren hver gang blikket går rundt instrumentene. Korriger når den er 50 ft ute.')},
 'orient.recip':{h:t2('180° wrong','180° feil'),w:t2('You reported {val}. That is the direction to the station. You were on radial {truth}.','Du rapporterte {val}. Det er retningen til stasjonen. Du var på radial {truth}.'),
  d:t2('Centre the needle with the flag on FROM, or read the tail of the RMI needle.','Sentrer nålen med flagget på FROM, eller les halen på RMI-nålen.')},
 'orient.wrong':{h:t2('Wrong radial','Feil radial'),w:t2('You reported {val}. You were on radial {truth}.','Du rapporterte {val}. Du var på radial {truth}.'),d:t2('Centre the needle with the flag on FROM, then read the number at the top.','Sentrer nålen med flagget på FROM, og les så tallet øverst.')},
 'orient.ok':{h:t2('Correct','Riktig'),w:t2('Radial {truth}.','Radial {truth}.'),d:t2('','')},
 'int.away':{h:t2('Turned away from the course','Svingte bort fra kursen'),w:t2('The needle was to the {side}, so the course was on your {side}. You turned the other way.','Nålen sto til {side}, altså lå kursen til {side} for deg. Du svingte den andre veien.'),
  d:t2('Turn towards the needle: the course plus or minus 30° to 45°, on the side of the needle.','Sving mot nålen: kursen pluss eller minus 30° til 45°, til den siden nålen står.')},
 'int.slow':{h:t2('Slow to decide','Brukte lang tid på å bestemme deg'),w:t2('It took a long time before you turned to a heading across the course.','Det tok lang tid før du svingte til en heading på skrå mot kursen.'),d:t2('Decide within 10 seconds: which side is the needle on? Then the course plus or minus 30° or 45°.','Bestem deg innen 10 sekunder: hvilken side står nålen på? Så kursen pluss eller minus 30° eller 45°.')},
 'int.steep':{h:t2('Too steep an angle','For bratt vinkel'),w:t2('You crossed towards the course at {ang}°.','Du fløy mot kursen med {ang}°.'),d:t2('Keep the angle at 30° to 45°. With a steeper angle there is no time to turn onto the course.','Hold vinkelen på 30° til 45°. Med brattere vinkel rekker du ikke å svinge inn på kursen.')},
 'int.overshoot':{h:t2('Flew through the course','Fløy gjennom kursen'),w:t2('You went through the course and ended {e}° on the other side.','Du fløy gjennom kursen og endte {e}° på den andre siden.'),
  d:t2('Start the turn when the needle starts to move, at the second or third dot. Do not wait until it is centred.','Start svingen når nålen begynner å røre seg, ved andre eller tredje prikk. Ikke vent til den står i midten.')},
 'ndb.homing':{h:t2('Followed the needle instead of a line','Fulgte nålen i stedet for en linje'),w:t2('You kept the nose on the needle (homing). The wind pushed you {e}° off the line and you flew a curve.','Du holdt nesen på nålen (homing). Vinden skjøv deg {e}° ut fra linjen, og du fløy en bue.'),
  d:t2('Turn to get back on the line. Then hold a heading into the wind, with the needle a few degrees off the nose.','Sving for å komme tilbake på linjen. Hold så en heading opp mot vinden, med nålen noen grader ved siden av nesen.')},
 'arc.wrongdir':{h:t2('Wrong way onto the arc','Feil vei inn på buen'),w:t2('You turned the wrong way when you reached the arc.','Du svingte feil vei da du kom til buen.'),d:t2('Turn {dir} off the radial. Clockwise round the station the radial numbers go up. Anticlockwise they go down.','Sving til {dir} fra radialen. Med klokka rundt stasjonen øker radialtallene. Mot klokka minker de.')},
 'arc.late':{h:t2('Late onto the arc','Sent inn på buen'),w:t2('You were at {D} NM before you turned. That is past the arc.','Du var på {D} NM før du svingte. Det er forbi buen.'),d:t2('Start the turn about one turn radius early: about 0.6 NM at 120 kt.','Start svingen omtrent én svingradius før: rundt 0,6 NM i 120 kt.')},
 'arc.out':{h:t2('Off the arc','Utenfor buen'),w:t2('You were {e} NM away from the {R} DME arc. The limit is 1 NM.','Du var {e} NM fra {R} DME-buen. Grensen er 1 NM.'),
  d:t2('Keep the station on your wingtip. When the DME grows, turn 10° to 20° towards the station.','Hold stasjonen på vingetippen. Når DME øker, svinger du 10° til 20° mot stasjonen.')},
 'arc.missed':{h:t2('Flew past the radial','Fløy forbi radialen'),w:t2('You flew past radial {r1} before you turned towards the station.','Du fløy forbi radial {r1} før du svingte mot stasjonen.'),d:t2('Start the turn a few degrees before the radial (the lead radial).','Start svingen noen grader før radialen (lead-radialen).')},
 'hold.wrongentry':{h:t2('Wrong entry','Feil inngang'),w:t2('You crossed the fix on heading {hdg} and flew a {flown} entry. That heading calls for {entry}{alt}.','Du krysset fiksen på heading {hdg} og fløy {flown} inngang. Den headingen krever {entry}{alt}.'),
  d:t2('Before the fix, picture your heading and the 70° line, and say the entry out loud.','Før fiksen: se for deg headingen din og 70°-linjen, og si inngangen høyt.')},
 'hold.entryok':{h:t2('Entry','Inngang'),w:t2('{flown} entry.','{flown} inngang.'),d:t2('','')},
 'hold.entrytime':{h:t2('Time on the entry leg','Tid på inngangslegget'),w:t2('The entry leg lasted {v} s. It should be about {want} s.','Inngangslegget varte {v} s. Det skal være rundt {want} s.'),d:t2('Start the clock over the fix and turn back after 1 minute.','Start klokka over fiksen og sving tilbake etter 1 minutt.')},
 'hold.wrongturn':{h:t2('Turned the wrong way','Svingte feil vei'),w:t2('This hold uses {dir} turns. You turned the other way.','Denne holdingen bruker svinger til {dir}. Du svingte den andre veien.'),
  d:t2('Every turn in a hold goes the way the clearance says. Standard is right turns.','Alle svinger i en holding går den veien klareringen sier. Standard er høyresvinger.')},
 'hold.nowca':{h:t2('No wind correction away from the fix','Ingen vindkorreksjon bort fra fiksen'),w:t2('On the leg away from the fix your heading did not allow for the wind.','På legget bort fra fiksen tok ikke headingen din hensyn til vinden.'),d:t2('Away from the fix, use three times the correction you needed towards it, on the other side: about {hdg}.','Bort fra fiksen bruker du tre ganger korreksjonen du trengte inn mot den, til den andre siden: rundt {hdg}.')},
 'hold.legshort':{h:t2('The leg towards the fix was short','Legget inn mot fiksen ble kort'),w:t2('The leg towards the fix took {v} s. It should take {want} s.','Legget inn mot fiksen tok {v} s. Det skal ta {want} s.'),d:t2('Fly about {adj} s longer away from the fix next lap.','Fly rundt {adj} s lenger bort fra fiksen neste runde.')},
 'hold.leglong':{h:t2('The leg towards the fix was long','Legget inn mot fiksen ble langt'),w:t2('The leg towards the fix took {v} s. It should take {want} s.','Legget inn mot fiksen tok {v} s. Det skal ta {want} s.'),d:t2('Fly about {adj} s shorter away from the fix next lap.','Fly rundt {adj} s kortere bort fra fiksen neste runde.')},
 'pt.wrong45':{h:t2('First turn to the wrong side','Første sving til feil side'),w:t2('The first turn went to the side that is not on the chart.','Den første svingen gikk til den siden som ikke står på kartet.'),d:t2('Turn {dir}, to the side shown on the chart. Only that side is kept clear of obstacles.','Sving til {dir}, til den siden kartet viser. Bare den siden er holdt fri for hindringer.')},
 'pt.wrong180':{h:t2('Turned back the wrong way','Svingte tilbake feil vei'),w:t2('The turn back went towards the station, out of the protected area.','Svingen tilbake gikk mot stasjonen, ut av det beskyttede området.'),d:t2('Turn {dir}: the opposite way to the first turn.','Sving til {dir}: motsatt vei av den første svingen.')},
 'base.wrongturn':{h:t2('Base turn the wrong way','Base turn feil vei'),w:t2('You turned away from the final course.','Du svingte bort fra sluttkursen.'),d:t2('Turn {dir}: towards the side the leg away from the station is set off to.','Sving til {dir}: mot den siden legget bort fra stasjonen ligger forskjøvet til.')},
 'app.early':{h:t2('Started down too early','Startet ned for tidlig'),w:t2('You went below {alt} ft before you were allowed to.','Du gikk under {alt} ft før du hadde lov.'),
  d:t2('Hold the published altitude until the FAF. On an ILS, hold it until the glide slope needle is centred. Then descend.','Hold den publiserte høyden til FAF. På en ILS holder du den til glidebanenålen står i midten. Gå så ned.')},
 'app.low':{h:t2('Below the path','Under banen'),w:t2('You were {pa} ft below the planned path.','Du var {pa} ft under den planlagte banen.'),d:t2('Check the table every mile. When you are low, descend more slowly.','Sjekk tabellen for hver nautiske mil. Når du er lav, går du ned saktere.')},
 'app.high':{h:t2('Above the path','Over banen'),w:t2('You were {pa} ft above the planned path.','Du var {pa} ft over den planlagte banen.'),d:t2('Start down at the FAF, at about ground speed × 5 ft/min.','Start ned ved FAF, med rundt fart over bakken × 5 ft/min.')},
 'app.belowmda':{h:t2('Below the minimum altitude','Under minstehøyden'),w:t2('You went below the minimum altitude (MDA) of {mda} ft.','Du gikk under minstehøyden (MDA) på {mda} ft.'),d:t2('The MDA is a floor. Level off at it or just above it, never below.','MDA er et gulv. Flat ut på den eller like over, aldri under.')},
 'app.mapt':{h:t2('Too high at the end','For høyt ved slutten'),w:t2('You reached the end of the approach (the missed approach point) still above the minimum altitude.','Du nådde slutten av innflygingen (punktet for avbrutt innflyging) og var fortsatt over minstehøyden.'),d:t2('Start down at the FAF and use about ground speed × 5 ft/min.','Start ned ved FAF og bruk rundt fart over bakken × 5 ft/min.')},
 'ils.overshoot':{h:t2('Flew through the localiser','Fløy gjennom localiseren'),w:t2('You flew through the runway centre line.','Du fløy gjennom rullebanens senterlinje.'),d:t2('Turn onto the course as soon as the needle starts to move. It moves fast.','Sving inn på kursen så snart nålen begynner å røre seg. Den går fort.')},
 'ils.loclimit':{h:t2('Too far off the localiser','For langt fra localiseren'),w:t2('The localiser needle reached {d} dots. The limit is half scale, 2.5 dots.','Localiser-nålen nådde {d} prikker. Grensen er halvt utslag, 2,5 prikker.'),d:t2('Correct early, with 2° to 3° of heading at a time.','Korriger tidlig, med 2° til 3° heading om gangen.')},
 'ils.gslimit':{h:t2('Too far off the glide slope','For langt fra glidebanen'),w:t2('The glide slope needle reached {d} dots. The limit is half scale, 2.5 dots.','Glidebanenålen nådde {d} prikker. Grensen er halvt utslag, 2,5 prikker.'),d:t2('Change the rate of descent by 100 to 200 ft/min and watch the needle.','Endre synkehastigheten med 100 til 200 ft/min og følg nålen.')},
 'int.angle':{h:t2('A different angle than asked for','En annen vinkel enn oppgaven ba om'),w:t2('You crossed towards the course at {ang}°. The task asked for {want}°.','Du fløy mot kursen med {ang}°. Oppgaven ba om {want}°.'),d:t2('The course plus or minus {want}°, on the side of the needle.','Kursen pluss eller minus {want}°, til den siden nålen står.')},
 'hold.dmepast':{h:t2('Past the DME limit','Forbi DME-grensen'),w:t2('The leg away from the fix went past {D} DME.','Legget bort fra fiksen gikk forbi {D} DME.'),d:t2('Watch the DME on the leg away from the fix and start the turn at the limit.','Følg DME på legget bort fra fiksen og start svingen ved grensen.')},
 'miss.late':{h:t2('Late go-around','Avbrøt for sent'),w:t2('You did not start to climb within about 10 seconds of reaching the minimum.','Du begynte ikke å stige innen rundt 10 sekunder etter at du nådde minimum.'),d:t2('At the minimum without the runway: full power, nose up, climb. Say “go around” out loud.','På minimum uten rullebanen: full motor, nesen opp, stig. Si «go around» høyt.')},
 'miss.below':{h:t2('Below the minimum','Under minimum'),w:t2('You went well below {mins} ft before you climbed.','Du gikk godt under {mins} ft før du steg.'),d:t2('Start the go-around at the minimum, not after it.','Avbryt på minimum, ikke etter.')},
 'miss.early':{h:t2('Turned too early','Svingte for tidlig'),w:t2('You turned before {ta} ft.','Du svingte før {ta} ft.'),d:t2('Climb straight ahead to the turn altitude first.','Stig rett frem til svinghøyden først.')},
 'miss.wrongturn':{h:t2('Missed approach: turned the wrong way','Avbrutt innflyging: svingte feil vei'),w:t2('The missed approach turns {dir}. You turned the other way.','Avbrutt innflyging svinger til {dir}. Du svingte den andre veien.'),d:t2('Go through the missed approach before the FAF: which way to turn, which heading, which altitude.','Gå gjennom avbrutt innflyging før FAF: hvilken vei du svinger, hvilken heading, hvilken høyde.')},
 'miss.incomplete':{h:t2('Missed approach not finished','Avbrutt innflyging ikke fullført'),w:t2('You never made the turn in the missed approach.','Du gjorde aldri svingen i avbrutt innflyging.'),d:t2('When you reach the turn altitude, turn to the published heading.','Når du når svinghøyden, svinger du til den publiserte headingen.')},
 'rt.off':{h:t2('Off the route','Utenfor ruten'),w:t2('You were {e} NM {side} of the leg. The limit is 0.5 NM.','Du var {e} NM til {side} for legget. Grensen er 0,5 NM.'),d:t2('Keep the needle centred with small corrections towards it.','Hold nålen i midten med små korreksjoner mot den.')},
 'rt.constraint':{h:t2('Wrong altitude at a waypoint','Feil høyde ved et waypoint'),w:t2('You crossed {wp} at {was} ft. It had to be {cw} {alt} ft.','Du krysset {wp} i {was} ft. Det skulle være {cw} {alt} ft.'),d:t2('Set the next altitude early and check the distance: 3 NM for every 1000 ft down, about 2 NM for every 1000 ft up.','Still inn neste høyde tidlig og sjekk avstanden: 3 NM for hver 1000 ft ned, rundt 2 NM for hver 1000 ft opp.')},
 'pass.early':{h:t2('Reported too early','Rapporterte for tidlig'),w:t2('You reported station passage {d} NM before the station.','Du rapporterte stasjonspassering {d} NM før stasjonen.'),d:t2('Wait until the flag changes from TO to FROM. A nervous needle alone is not passage.','Vent til flagget skifter fra TO til FROM. En urolig nål alene er ikke passering.')},
 'pass.late':{h:t2('Passage not reported','Passeringen ble ikke rapportert'),w:t2('You passed the station and did not report it.','Du passerte stasjonen uten å rapportere.'),d:t2('Keep an eye on the flag when the DME gets small.','Følg med på flagget når DME blir liten.')},
 'pass.ok':{h:t2('Passage','Passering'),w:t2('Reported.','Rapportert.'),d:t2('','')},
 'pass.turnearly':{h:t2('Turned before the station','Svingte før stasjonen'),w:t2('You left the course before you had passed the station.','Du forlot kursen før du hadde passert stasjonen.'),d:t2('Hold the heading until the flag shows FROM. Then intercept the new radial.','Hold headingen til flagget viser FROM. Skjær så inn på den nye radialen.')},
 'tts.wrong':{h:t2('Time to the station','Tid til stasjonen'),w:t2('You reported {val} min. It was about {truth} min.','Du rapporterte {val} min. Det var rundt {truth} min.'),d:t2('Minutes = seconds ÷ degrees. 90 s for 10° is 9 min, not 90.','Minutter = sekunder ÷ grader. 90 s for 10° er 9 min, ikke 90.')},
 'tts.ok':{h:t2('Time to the station','Tid til stasjonen'),w:t2('{val} min (about {truth}).','{val} min (rundt {truth}).'),d:t2('','')},
 'tts.slow':{h:t2('No report','Ingen rapport'),w:t2('The bearing changed 40° and you did not report a time.','Peilingen endret seg 40° uten at du rapporterte en tid.'),d:t2('Start the stopwatch at once. Report when the bearing has changed 10°.','Start stoppeklokka med en gang. Rapporter når peilingen har endret seg 10°.')},
 'math.wrong':{h:t2('Wrong answer','Feil svar'),w:t2('You answered {val}. The answer is {ans}.','Du svarte {val}. Svaret er {ans}.'),d:t2('','')},
 'math.ok':{h:t2('Right','Riktig'),w:t2('{ans}.','{ans}.'),d:t2('','')},
 timeout:{h:t2('The exercise was not finished','Øvelsen ble ikke fullført'),w:t2('The run ended before the task was done.','Runden tok slutt før oppgaven var ferdig.'),d:t2('Fly it with Guided help, or press “Watch the instructor” first.','Fly den med veiledning, eller trykk «Se instruktøren» først.')}
};

/* parameters → words */
function pw(p,raw){ const o=Object.assign({},p);
  if(o.side) o.side=sideW(o.side);
  if(o.dir!==undefined) o.dir=dirW(o.dir);
  if(o.entry) o.entry=L(W.entry[o.entry]||W.entry.unclear);
  if(o.flown) o.flown=L(W.entry[o.flown]||W.entry.unclear);
  if(o.alt===null) o.alt=''; else if(typeof o.alt==='string'&&W.entry[o.alt]) o.alt=no()?` (eller ${L(W.entry[o.alt])})`:` (or ${L(W.entry[o.alt])})`;
  if(o.wca!==undefined&&typeof o.wca==='number'){ const w=o.wca; o.wca= Math.abs(w)<1? '' : no()? `, ${Math.abs(w)}° til ${sideW(w>0?'R':'L')} for kursen: det er vindkorreksjonen din` : `, ${Math.abs(w)}° ${sideW(w>0?'R':'L')} of the course: that is your wind correction`; }
  if(!raw) ['obs','crs','val','truth','hdg','qdm','r1','inb','out','ro','td','b'].forEach(k=>{ if(typeof o[k]==='number') o[k]=d3(o[k]); });
  if(typeof o.e==='number') o.e=String(Math.abs(o.e)).replace('.',no()?',':'.');
  if(typeof o.lead==='number') o.lead=String(o.lead).replace('.',no()?',':'.');
  if(typeof o.D==='number') o.D=String(o.D).replace('.',no()?',':'.');
  if(typeof o.adj==='number') o.adj=Math.abs(o.adj);
  if(o.a!==undefined&&o.s!==undefined&&o.hdg!==undefined) o.clk=+o.a===45?(no()?', og start klokka':', and start the clock'):(no()?'. Gå rett over i neste sving':'. Then go straight into the next turn');
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
    case 'intIn': c.en=`${cs}intercept ${T.ndb?'QDM':'course'} ${d3(T.crs)} inbound to ${st.id}${T.ang?`, ${T.ang}° intercept`:''}, maintain ${alt(T.alt)}.`; c.no=`${cs}skjær inn på ${T.ndb?'QDM':'kurs'} ${d3(T.crs)} inn til ${st.id}${T.ang?`, med ${T.ang}° vinkel`:''}, hold ${alt(T.alt)}.`; break;
    case 'intOut': c.en=`${cs}intercept ${T.ndb?'QDR':'radial'} ${d3(T.crs)} outbound from ${st.id}${T.ang?`, ${T.ang}° intercept`:''}, maintain ${alt(T.alt)}.`; c.no=`${cs}skjær inn på ${T.ndb?'QDR':'radial'} ${d3(T.crs)} ut fra ${st.id}${T.ang?`, med ${T.ang}° vinkel`:''}, hold ${alt(T.alt)}.`; break;
    case 'intPass': c.en=`${cs}track ${d3(T.c0)} to ${st.id}, after ${st.id} intercept radial ${d3(T.crs)} outbound, maintain ${alt(T.alt)}.`; c.no=`${cs}følg ${d3(T.c0)} til ${st.id}, etter ${st.id} skjær inn på radial ${d3(T.crs)} ut, hold ${alt(T.alt)}.`; break;
    case 'locInt': c.en=`${cs}fly heading ${d3(X.ac.hdg)}, maintain ${alt(T.alt)}, intercept the localiser ${d3(T.crs)}.`; c.no=`${cs}fly heading ${d3(X.ac.hdg)}, hold ${alt(T.alt)}, skjær inn på localiseren ${d3(T.crs)}.`; break;
    case 'ndb': c.en=`${cs}track inbound to ${st.id} on QDM ${d3(T.crs)}, maintain ${alt(T.alt)}.`; c.no=`${cs}følg QDM ${d3(T.crs)} inn til ${st.id}, hold ${alt(T.alt)}.`; break;
    case 'ndbOut': c.en=`${cs}track outbound from ${st.id} on QDR ${d3(T.crs)} for ${T.to} NM, maintain ${alt(T.alt)}.`; c.no=`${cs}følg QDR ${d3(T.crs)} ut fra ${st.id} i ${T.to} NM, hold ${alt(T.alt)}.`; break;
    case 'dme': { const cw=T.dir>0?t2('clockwise','med klokka'):t2('anticlockwise','mot klokka');
      if(T.part==='leave'){ c.en=`${cs}continue the ${T.R} DME arc ${cw.en}, intercept radial ${d3(T.r1)} inbound.`; c.no=`${cs}fortsett ${T.R} DME-buen ${cw.no}, skjær inn på radial ${d3(T.r1)} inn.`; }
      else if(T.part==='join'){ c.en=`${cs}track outbound radial ${d3(T.r0)}, join the ${T.R} DME arc ${cw.en}.`; c.no=`${cs}følg radial ${d3(T.r0)} ut, gå inn på ${T.R} DME-buen ${cw.no}.`; }
      else { c.en=`${cs}track outbound radial ${d3(T.r0)}, join the ${T.R} DME arc ${cw.en}, intercept radial ${d3(T.r1)} inbound.`; c.no=`${cs}følg radial ${d3(T.r0)} ut, gå inn på ${T.R} DME-buen ${cw.no}, skjær inn på radial ${d3(T.r1)} inn.`; } break; }
    case 'holdEntry': case 'hold': { const turns=T.dir>0?t2('right turns','høyresvinger'):t2('left turns','venstresvinger'), leg=T.dmeLim?t2(`outbound limit ${T.dmeLim} DME`,`grense ut ${T.dmeLim} DME`):t2('one-minute legs','legg på ett minutt');
      const what=T.kind==='ndb'?t2(`on ${st.id}, inbound QDM ${d3(T.inb)}`,`ved ${st.id}, QDM inn ${d3(T.inb)}`):t2(`on the ${d3(T.out)} radial${T.fx?' at '+T.D+' DME':''}, inbound course ${d3(T.inb)}`,`på radial ${d3(T.out)}${T.fx?' ved '+T.D+' DME':''}, kurs inn ${d3(T.inb)}`);
      const head=T.race?t2(`proceed direct ${fx}, racetrack procedure`,`direkte ${fx}, racetrack-prosedyre`):id==='hold'?t2('hold','hold'):t2(`proceed direct ${fx}, hold`,`direkte ${fx}, hold`);
      c.en=`${cs}${head.en} ${what.en}, ${turns.en}, ${leg.en}, maintain ${alt(T.alt)}.${id==='hold'?` ${T.laps} pattern${T.laps>1?'s':''}.`:''}`;
      c.no=`${cs}${head.no} ${what.no}, ${turns.no}, ${leg.no}, hold ${alt(T.alt)}.${id==='hold'?` ${T.laps} runde${T.laps>1?'r':''}.`:''}`; break; }
    case 'pt': { const a=T.a||45, b=a===80?260:180; c.en=`${cs}outbound radial ${d3(T.out)} 1 min, procedure turn ${a}°/${b}° ${T.side>0?'right':'left'} ${d3(norm(T.out+T.side*a))}, inbound course ${d3(T.inb)}, maintain ${alt(T.alt)}.`;
      c.no=`${cs}radial ${d3(T.out)} ut 1 min, prosedyresving ${a}°/${b}° ${T.side>0?'høyre':'venstre'} ${d3(norm(T.out+T.side*a))}, kurs inn ${d3(T.inb)}, hold ${alt(T.alt)}.`; break; }
    case 'base': c.en=`${cs}outbound radial ${d3(T.ro)} 2 min, base turn ${T.turn>0?'right':'left'}, inbound course ${d3(T.inb)}, maintain ${alt(T.alt)}.`;
      c.no=`${cs}radial ${d3(T.ro)} ut 2 min, base turn ${T.turn>0?'høyre':'venstre'}, kurs inn ${d3(T.inb)}, hold ${alt(T.alt)}.`; break;
    case 'vordme': case 'ils': case 'vorApp': case 'ndbApp': case 'locApp': case 'lnav': case 'lnavVnav': case 'lpv': {
      const M=T.miss, nm={vordme:'VOR/DME',ils:'ILS',vorApp:'VOR',ndbApp:'NDB',locApp:'LOC',lnav:'RNP (LNAV)',lnavVnav:'RNP (LNAV/VNAV)',lpv:'RNP (LPV)'}[id], mins=T.da?`DA ${T.da} ft`:`MDA ${T.mda||T.mins} ft`;
      const mEn=M?` Missed approach: climb straight ahead to ${M.ta} ft, turn ${M.dir>0?'right':'left'} heading ${d3(M.hdg)}, climb ${M.alt} ft.`:'', mNo=M?` Avbrutt innflyging: stig rett frem til ${M.ta} ft, sving ${M.dir>0?'høyre':'venstre'} til heading ${d3(M.hdg)}, stig til ${M.alt} ft.`:'';
      if(id==='ils'){ c.en=`${cs}fly heading ${d3(X.ac.hdg)}, maintain ${alt(T.alt)} until established, cleared ILS, course ${d3(T.crs)}. ${mins}.${mEn}`; c.no=`${cs}fly heading ${d3(X.ac.hdg)}, hold ${alt(T.alt)} til etablert, klarert ILS, kurs ${d3(T.crs)}. ${mins}.${mNo}`; }
      else { c.en=`${cs}cleared ${nm} approach, final course ${d3(T.crs)}. ${mins}.${mEn}`; c.no=`${cs}klarert ${nm}-innflyging, sluttkurs ${d3(T.crs)}. ${mins}.${mNo}`; } break; }
    case 'sid': case 'star': { const wp=T.wps.map(w=>w.id+(w.c?` ${w.c.t==='ge'?'+':w.c.t==='le'?'−':''}${w.c.alt}`:'')).join(', ');
      c.en=`${cs}${id==='sid'?'cleared '+T.name+' departure, climb':'cleared '+T.name+' arrival, descend'} ${alt(T.alt)} (${wp}).`; c.no=`${cs}${id==='sid'?'klarert '+T.name+'-utflyging, stig til':'klarert '+T.name+'-innflygingsrute, gå ned til'} ${alt(T.alt)} (${wp}).`; break; }
    case 'math': c.en=`${T.n} quick questions. Work them out in your head, then type the answer.`; c.no=`${T.n} raske spørsmål. Regn i hodet, og skriv svaret.`; break;
  }
  return c; }

/* the same task in plain words, shown under the clearance before the start */
function plain(X,A,ex){ const T=X.task, st=A.ST[T.st||T.ils], id=st?st.id:'', c={en:'',no:''}, a=v=>Math.round(v)+' ft', fx=T.fx?T.fx.id:id;
  switch(ex){
    case 'orient': if(T.kind==='rbi'){ c.en=`Work out the direction to the beacon ${id} from your heading and the ADF needle. You do it ${T.n} times, from different places.`; c.no=`Finn retningen til fyret ${id} ut fra headingen din og ADF-nålen. Du gjør det ${T.n} ganger, fra forskjellige steder.`; }
      else { c.en=`Find out which line from ${id} you are on (your radial). You do it ${T.n} times, from different places.`; c.no=`Finn ut hvilken linje fra ${id} du er på (radialen din). Du gjør det ${T.n} ganger, fra forskjellige steder.`; } break;
    case 'trackIn': c.en=`Fly to ${id} along course ${d3(T.crs)} and stay on that line. Keep ${a(T.alt)}.`; c.no=`Fly til ${id} langs kurs ${d3(T.crs)} og bli på den linjen. Hold ${a(T.alt)}.`; break;
    case 'pass': c.en=`Fly to ${id} along course ${d3(T.crs)}. Press “Station passage” the moment you fly over the station.`; c.no=`Fly til ${id} langs kurs ${d3(T.crs)}. Trykk «Stasjonspassering» i det du flyr over stasjonen.`; break;
    case 'trackOut': c.en=`Fly away from ${id} along radial ${d3(T.crs)} and stay on that line until the DME shows ${T.to} NM.`; c.no=`Fly bort fra ${id} langs radial ${d3(T.crs)} og bli på den linjen til DME viser ${T.to} NM.`; break;
    case 'tts': c.en=`Work out how many minutes you are from ${id}. Use only the needle and the stopwatch.`; c.no=`Finn ut hvor mange minutter du er fra ${id}. Bruk bare nålen og stoppeklokka.`; break;
    case 'intIn': c.en=`You are to one side of the line that leads to ${id} on course ${d3(T.crs)}. Get onto that line, then follow it to the ${T.ndb?'beacon':'station'}.`; c.no=`Du er til siden for linjen som fører til ${id} på kurs ${d3(T.crs)}. Kom inn på den linjen, og følg den til ${T.ndb?'fyret':'stasjonen'}.`; break;
    case 'intOut': c.en=`You are to one side of the line that leaves ${id} in direction ${d3(T.crs)}. Get onto that line, then follow it away from the ${T.ndb?'beacon':'station'}.`; c.no=`Du er til siden for linjen som går ut fra ${id} i retning ${d3(T.crs)}. Kom inn på den linjen, og følg den bort fra ${T.ndb?'fyret':'stasjonen'}.`; break;
    case 'intPass': c.en=`Fly over ${id} on course ${d3(T.c0)}. After the station, get onto radial ${d3(T.crs)} and follow it away.`; c.no=`Fly over ${id} på kurs ${d3(T.c0)}. Etter stasjonen kommer du inn på radial ${d3(T.crs)} og følger den ut.`; break;
    case 'locInt': c.en=`Keep heading ${d3(X.ac.hdg)} until the localiser needle starts to move. Then turn onto the runway course ${d3(T.crs)}.`; c.no=`Hold heading ${d3(X.ac.hdg)} til localiser-nålen begynner å røre seg. Sving så inn på rullebanekursen ${d3(T.crs)}.`; break;
    case 'ndb': c.en=`Fly to the beacon ${id} along the line with bearing ${d3(T.crs)}. Hold a heading into the wind so that you fly straight.`; c.no=`Fly til fyret ${id} langs linjen med peiling ${d3(T.crs)}. Hold en heading opp mot vinden, så du flyr rett.`; break;
    case 'ndbOut': c.en=`Fly away from the beacon ${id} along the line with bearing ${d3(T.crs)}, for ${T.to} NM.`; c.no=`Fly bort fra fyret ${id} langs linjen med peiling ${d3(T.crs)}, i ${T.to} NM.`; break;
    case 'dme': { const cw=T.dir>0?t2('clockwise','med klokka'):t2('anticlockwise','mot klokka');
      if(T.part==='leave'){ c.en=`You are on a circle ${T.R} NM from ${id}. Follow it ${cw.en}. Just before radial ${d3(T.r1)}, turn towards the station.`; c.no=`Du er på en sirkel ${T.R} NM fra ${id}. Følg den ${cw.no}. Like før radial ${d3(T.r1)} svinger du mot stasjonen.`; }
      else if(T.part==='join'){ c.en=`Fly away from ${id} on radial ${d3(T.r0)}. Just before ${T.R} NM, turn onto the circle round the station and follow it ${cw.en}.`; c.no=`Fly bort fra ${id} på radial ${d3(T.r0)}. Like før ${T.R} NM svinger du inn på sirkelen rundt stasjonen og følger den ${cw.no}.`; }
      else { c.en=`Fly away from ${id} on radial ${d3(T.r0)}. Turn onto the circle ${T.R} NM from the station and follow it ${cw.en}. Just before radial ${d3(T.r1)}, turn towards the station.`; c.no=`Fly bort fra ${id} på radial ${d3(T.r0)}. Sving inn på sirkelen ${T.R} NM fra stasjonen og følg den ${cw.no}. Like før radial ${d3(T.r1)} svinger du mot stasjonen.`; } break; }
    case 'holdEntry': if(T.race){ c.en=`Fly to ${fx}. Enter the racetrack the way you would enter a hold, and fly one lap. You end on course ${d3(T.inb)}.`; c.no=`Fly til ${fx}. Gå inn i racetracken slik du ville gått inn i en holding, og fly én runde. Du ender på kurs ${d3(T.inb)}.`; }
      else { c.en=`Fly to ${fx}. Choose the right entry for the heading you arrive with, fly it, and come back to the fix on course ${d3(T.inb)}.`; c.no=`Fly til ${fx}. Velg riktig inngang for headingen du kommer med, fly den, og kom tilbake til fiksen på kurs ${d3(T.inb)}.`; } break;
    case 'hold': c.en=`Fly ${T.laps} lap${T.laps>1?'s':''} of the holding pattern at ${fx}, with ${T.dir>0?'right':'left'} turns. ${T.dmeLim?`The leg away from the fix ends at ${T.dmeLim} DME.`:'Correct for the wind, and make the leg towards the fix take one minute.'}`;
      c.no=`Fly ${T.laps} runde${T.laps>1?'r':''} i holdingmønsteret ved ${fx}, med ${T.dir>0?'høyresvinger':'venstresvinger'}. ${T.dmeLim?`Legget bort fra fiksen slutter ved ${T.dmeLim} DME.`:'Korriger for vinden, og få legget inn mot fiksen til å ta ett minutt.'}`; break;
    case 'pt': { const a0=T.a||45, b0=a0===80?260:180; c.en=`Fly over ${id} and away from it on radial ${d3(T.out)} for 1 minute. Turn round with the ${a0}°/${b0}° procedure turn and come back on course ${d3(T.inb)}.`; c.no=`Fly over ${id} og bort fra den på radial ${d3(T.out)} i 1 minutt. Snu med prosedyresvingen ${a0}°/${b0}° og kom tilbake på kurs ${d3(T.inb)}.`; break; }
    case 'base': c.en=`Fly over ${id} and away from it on radial ${d3(T.ro)} for 2 minutes. Then make one long ${T.turn>0?'right':'left'} turn and come back on course ${d3(T.inb)}.`; c.no=`Fly over ${id} og bort fra den på radial ${d3(T.ro)} i 2 minutter. Gjør så én lang ${T.turn>0?'høyresving':'venstresving'} og kom tilbake på kurs ${d3(T.inb)}.`; break;
    case 'ils': c.en=`Keep heading ${d3(X.ac.hdg)} until the localiser needle moves, then turn onto course ${d3(T.crs)}. Follow both needles down to ${T.da} ft. No runway in sight there: climb away on the missed approach.`;
      c.no=`Hold heading ${d3(X.ac.hdg)} til localiser-nålen rører seg, og sving så inn på kurs ${d3(T.crs)}. Følg begge nålene ned til ${T.da} ft. Ser du ikke rullebanen der: stig ut på avbrutt innflyging.`; break;
    case 'vordme': case 'vorApp': case 'ndbApp': case 'locApp': case 'lnav': case 'lnavVnav': case 'lpv': { const m=T.da||T.mda||T.mins;
      c.en=`Follow the final course ${d3(T.crs)} towards the runway. Stay level until the FAF, then descend. Do not go below ${m} ft unless you see the runway. No runway in sight there: climb away on the missed approach.`;
      c.no=`Følg sluttkursen ${d3(T.crs)} mot rullebanen. Hold høyden til FAF, og gå så ned. Gå ikke under ${m} ft uten at du ser rullebanen. Ser du den ikke der: stig ut på avbrutt innflyging.`; break; }
    case 'sid': c.en='Climb along the route, from waypoint to waypoint. The numbers are altitudes to cross at: + means at or above, − means at or below.'; c.no='Stig langs ruten, fra waypoint til waypoint. Tallene er høyder du skal krysse i: + betyr i eller over, − betyr i eller under.'; break;
    case 'star': c.en='Descend along the route, from waypoint to waypoint. The numbers are altitudes to cross at: + means at or above, − means at or below.'; c.no='Gå ned langs ruten, fra waypoint til waypoint. Tallene er høyder du skal krysse i: + betyr i eller over, − betyr i eller under.'; break;
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
const CORE=['trackIn','intIn','ndb','dme','holdEntry','hold','pt','ils'];

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
  line(m,g,a,b,'rgba(230,235,239,.55)',1.6,[6,4]); line(m,g,b,c,'rgba(230,235,239,.55)',1.6,[6,4]); m.P(c.x,c.y); m.arrowHead(g,m.sx,m.sy,m.sa(M.hdg),7,'rgba(230,235,239,.7)'); m.label(m.sx,m.sy,(no()?'Avbrutt ':'Missed ')+d3(M.hdg)+' / '+M.alt,'rgba(230,235,239,.8)'); g.restore(); }

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

/* ---------- home ----------
   Top: what this is (three steps) beside a live miniature of the guided screen, flown by the instructor.
   Then "Start here": the eight core exercises as a numbered path with a small chart diagram each.
   Then every exercise, grouped by topic as cards that open in place, with a search box.
   "Practise exactly this" (the builder) opens as a dialog from its card. */
const HS=Object.assign({g:null,q:''},load('bb-ifr-home2')||{}); HS.q='';
function recommended(){ return CORE.find(id=>!passed(id))||I.ITEMS.find(it=>!passed(it.id)&&I.itemOk(it,AREAS.practice))?.id||CORE[0]; }
const startBtnTxt=id=>best(id)===null?tx('Start','Start'):passed(id)>=4?tx('Fly again','Fly igjen'):tx('Continue','Fortsett');
/* the small chart diagrams of the eight core manoeuvres (SVG, 160 × 100) */
const THC={ink:'var(--ink)',dim:'var(--ink-3)',crs:'var(--accent)',fly:'var(--info)'};
const thAc=(x,y,r,c)=>`<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0-8 1.6-2.5 8 1.8v2L1.6 2 1.2 6 3.6 7.6V9L0 8-3.6 9V7.6L-1.2 6-1.6 2-8 3.8v-2L-1.6-2.5Z" fill="${c||THC.ink}"/></g>`;
const thVor=(x,y)=>`<g transform="translate(${x} ${y})"><path d="M-6.5 0-3.2-5.6h6.4L6.5 0 3.2 5.6h-6.4Z" fill="var(--sheet)" stroke="${THC.ink}" stroke-width="1.3"/><circle r="1.4" fill="${THC.ink}"/></g>`;
const thNdb=(x,y)=>`<g transform="translate(${x} ${y})">${[4.5,8,11.5].map(r=>`<circle r="${r}" fill="none" stroke="${THC.ink}" stroke-width="1.4" stroke-dasharray="0.1 3.1" stroke-linecap="round"/>`).join('')}<circle r="1.8" fill="${THC.ink}"/></g>`;
const thFix=(x,y)=>`<path d="M${x} ${y-5.5} ${x+5} ${y+3.5}h-10Z" fill="var(--sheet)" stroke="${THC.ink}" stroke-width="1.3" stroke-linejoin="round"/>`;
const thHead=(x,y,r,c)=>`<path d="M-4-3.2 3 0-4 3.2Z" transform="translate(${x} ${y}) rotate(${r})" fill="${c}"/>`;
const thLab=(x,y,t,a,c)=>`<text x="${x}" y="${y}" text-anchor="${a||'start'}" font-family="IBM Plex Mono, ui-monospace, monospace" font-size="8.5" font-weight="500" fill="${c||THC.dim}">${t}</text>`;
const thWind=(x,y,r)=>`<g transform="translate(${x} ${y}) rotate(${r})" stroke="${THC.dim}" stroke-width="1.2" fill="none" stroke-linecap="round"><path d="M-9-4h14M-9 0h18M-9 4h11"/><path d="M6-6.5 9-4 6-1.5M10-2.5 13 0l-3 2.5M3 1.5 6 4 3 6.5"/></g>`;
function thumb(id){ let b=''; const C=`fill="none" stroke="${THC.crs}" stroke-width="2.2" stroke-linecap="round"`, F=`fill="none" stroke="${THC.fly}" stroke-width="1.6" stroke-dasharray="4 3.5" stroke-linecap="round"`, K=`fill="none" stroke="${THC.ink}" stroke-width="1.2"`;
  switch(id){
    case 'trackIn': b=`<path d="M18 84 122 24" ${C}/>${thHead(74,51.7,-30,THC.crs)}${thVor(126,22)}${thAc(48,66.7,45)}${thWind(34,26,35)}${thLab(96,58,'090 TO')}`; break;
    case 'intIn': b=`<path d="M12 40H126" ${C}/>${thHead(96,40,0,THC.crs)}${thVor(134,40)}<path d="M30 86 58 58Q70 40 88 40" ${F}/>${thAc(34,82,45)}<path d="M52 40A14 14 0 0 0 47.9 49.9" ${K}/>${thLab(22,58,'30–45°')}`; break;
    case 'ndb': b=`<path d="M20 82 124 26" ${C}/><path d="M20 82Q92 78 124 26" fill="none" stroke="${THC.dim}" stroke-width="1.4" stroke-dasharray="2 3.5" stroke-linecap="round"/>${thNdb(126,25)}${thAc(62,59.4,43)}${thWind(40,24,35)}${thLab(84,84,'homing')}`; break;
    case 'dme': b=`<path d="M30 80H104" ${K} stroke-dasharray="3 3"/><path d="M30 80V16" ${K} stroke-dasharray="3 3"/><path d="M96 80A66 66 0 0 0 30 14" ${C}/>${thHead(54.5,18.7,-159,THC.crs)}${thVor(30,80)}${thAc(76.7,33.3,-45)}<path d="M72 38 36 74" fill="none" stroke="${THC.fly}" stroke-width="1.2" stroke-dasharray="2 3"/>${thLab(102,30,'10 DME')}`; break;
    case 'holdEntry': b=`<path d="M64 50 77.7 12.4A40 40 0 0 1 104 50Z" fill="var(--caution)" opacity=".2"/><path d="M64 50H104A40 40 0 0 1 50.3 87.6Z" fill="var(--info)" opacity=".14"/><path d="M64 50 50.3 87.6A40 40 0 1 1 77.7 12.4Z" fill="var(--ok)" opacity=".14"/>
      <path d="M50.3 87.6 77.7 12.4M24 50H104" fill="none" stroke="${THC.dim}" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="M122 50H64A9 9 0 0 1 64 32H122A9 9 0 0 1 122 50" ${C} stroke-width="1.8"/>${thHead(96,50,180,THC.crs)}${thFix(64,50)}${thAc(18,50,90)}
      ${thLab(44,45,'direct','middle',THC.ink)}${thLab(84,26,'teardrop','start',THC.ink)}${thLab(74,74,'parallel','start',THC.ink)}`; break;
    case 'hold': b=`<path d="M112 66H50A14 14 0 0 1 50 38H112A14 14 0 0 1 112 66" ${C}/>${thHead(78,66,180,THC.crs)}${thHead(84,38,0,THC.crs)}${thFix(50,66)}${thAc(104,66,-90)}${thLab(80,81,'1 min','middle')}${thLab(80,30,'wind × 3','middle')}${thWind(22,24,35)}`; break;
    case 'pt': b=`<path d="M18 70H88" ${C}/>${thHead(54,70,180,THC.crs)}${thVor(16,70)}<path d="M88 70 118 40" ${F}/><path d="M118 40A12 12 0 0 1 135 57L122 70H96" ${F}/>${thAc(108,50,45)}${thLab(96,42,'45°','end')}${thLab(142,38,'180°')}${thLab(52,86,'1 min','middle')}`; break;
    case 'ils': b=`<path d="M10 84H150" ${K}/><path d="M118 84h28" stroke="${THC.ink}" stroke-width="4"/><path d="M20 14 122 83 20 38Z" fill="${THC.crs}" opacity=".1"/><path d="M20 26 122 83" ${C}/>${thAc(62,49.5,119)}<path d="M98 68v16" ${K} stroke-dasharray="2 3"/>${thLab(101,64,'DA')}${thLab(40,30,'3°')}${thLab(132,96,'RWY','middle')}`; break; }
  return `<svg class="thumb" viewBox="0 0 160 100" role="img" aria-label="${esc(tx('Diagram: ','Diagram: ')+itemName(id))}">${b}</svg>`; }
const difHTML=d=>`<span class="dif" aria-hidden="true"><i class="on"></i><i class="${d>1?'on':''}"></i><i class="${d>2?'on':''}"></i></span>`;
function progHTML(id){ const p=passed(id), bs=best(id); if(bs===null) return `<span class="pg none">${tx('Not flown yet','Ikke fløyet ennå')}</span>`;
  return `<span class="pg"><span class="pips" role="img" aria-label="${esc(tx(`${p} of 4 levels passed`,`${p} av 4 nivåer bestått`))}">${[1,2,3,4].map(k=>`<i class="${k<=p?'on':''}"></i>`).join('')}</span>${tx('Best','Beste')} ${bs}</span>`; }
function renderHero(){ const L0=PROG.last&&I.ITEM[PROG.last.item]?PROG.last:null, rec=recommended(), n=CORE.indexOf(rec)+1;
  el('lead').textContent=tx('Learn one instrument procedure at a time. An instructor on screen tells you the next step, and the replay shows your first mistake.','Lær én instrumentprosedyre om gangen. En instruktør på skjermen sier neste steg, og reprisen viser den første feilen din.');
  el('promise').innerHTML=[[t2('Learn it','Lær den'),t2('A short animated walk-through in plain words.','En kort, animert gjennomgang med vanlige ord.')],[t2('Fly it','Fly den'),t2('The instructor tells you the next step, and why.','Instruktøren sier neste steg, og hvorfor.')],[t2('See it','Se den'),t2('Your first mistake, marked on the replay.','Den første feilen din, markert i reprisen.')]]
    .map(([a,b],i)=>`<li><i>${i+1}</i><b>${esc(L(a))}</b><span>${esc(L(b))}</span></li>`).join('');
  const first=!L0&&!Object.keys(PROG.ex).length;
  el('heroCta').innerHTML=(L0?`<button class="btn2 pri lg" type="button" data-go="continue"><span class="k">${tx('Continue','Fortsett')}</span>${esc(itemName(L0.item))}${L0.custom?` <small>${tx('(your setup)','(ditt oppsett)')}</small>`:''}</button>`:'')+
    ((!L0||L0.item!==rec)?`<button class="btn2 ${L0?'':'pri'} lg" type="button" data-go="${rec}"><span class="k">${first?tx('Start with step 1','Start med steg 1'):n>0?tx(`Next on the path: step ${n}`,`Neste på veien: steg ${n}`):tx('Next for you','Neste for deg')}</span>${esc(itemName(rec))}</button>`:'')+
    `<a class="btn2 q lg" href="#all" id="toAll">${tx(`All ${I.ITEMS.length} exercises`,`Alle ${I.ITEMS.length} øvelsene`)}</a>`;
  el('heroCta').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ if(b.dataset.go==='continue'){ const l=PROG.last; openItem(l.item,{p:l.custom?l.p:null,custom:l.custom,lv:l.lv,area:l.area,seed:l.custom?l.seed:undefined,step:'fly'}); } else openItem(b.dataset.go,{}); });
  el('toAll').onclick=e=>{ e.preventDefault(); el('all').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'}); };
  el('figCap').innerHTML=`<b>${tx('The guided screen','Den veiledede skjermen')}</b><span>${tx('Here the instructor flies a holding entry. When you fly, the line at the top tells you what to do next.','Her flyr instruktøren en inngang til holding. Når du flyr selv, sier linjen øverst hva du skal gjøre nå.')}</span>`;
  heroText(true); }
function renderPath(){ const rec=recommended(), done=CORE.filter(id=>passed(id)).length;
  el('pathH').textContent=tx('Start here','Start her');
  el('pathSub').textContent=tx('Eight core exercises, in the order an instructor would teach them. Each one takes five to ten minutes.','Åtte kjerneøvelser, i den rekkefølgen en instruktør ville lært dem bort. Hver av dem tar fem til ti minutter.');
  el('pathProg').innerHTML=done?`<b>${done}</b> ${tx('of 8 passed','av 8 bestått')}`:'';
  el('path').innerHTML=CORE.map((id,i)=>{ const it=I.ITEM[id], p=passed(id), r=id===rec;
    return `<li class="pstep${r?' rec':''}${p?' done':''}" data-id="${id}"><div class="pn"><i>${p?'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':i+1}</i>${r?`<em>${best(id)===null&&!Object.keys(PROG.ex).length?tx('Start here','Start her'):tx('Next for you','Neste for deg')}</em>`:''}</div>
      <div class="pth">${thumb(id)}</div><h3>${esc(itemName(id))}</h3><p>${gl(L(IT[id].s),2,{heading:1,fix:1,intercept:1})}</p>
      <div class="pm">${difHTML(it.d)}<span>${esc(L(W.diff[it.d]))}</span>${progHTML(id)}</div>
      <button class="btn2 ${r?'pri':''}" data-start="${id}" type="button">${startBtnTxt(id)}<span class="sr">: ${esc(itemName(id))}</span></button></li>`; }).join('');
  el('warm').innerHTML=`${tx('Never used a VOR needle before? Warm up with','Aldri brukt en VOR-nål før? Varm opp med')} <button type="button" class="lk" data-start="orient">${esc(itemName('orient'))}</button>.`;
  qa('#pathSec [data-start]').forEach(b=>b.onclick=()=>openItem(b.dataset.start,{})); }
function rowHTML(it,rec){ const ok=I.itemOk(it,AREAS.practice);
  return `<li class="row${rec?' rec':''}" data-id="${it.id}">${pic(it.id)}<div class="tx"><b>${esc(itemName(it.id))}${rec?`<em>${tx('Next for you','Neste for deg')}</em>`:''}</b><span>${gl(L(IT[it.id].s),2,{heading:1,fix:1,intercept:1})}</span></div>
    <div class="st"><span class="dl">${difHTML(it.d)}${esc(L(W.diff[it.d]))}</span>${progHTML(it.id)}</div>
    <div class="acts"><button class="btn2 sm ${rec?'pri':''}" data-start="${it.id}" type="button" ${ok?'':'disabled'}>${startBtnTxt(it.id)}<span class="sr">: ${esc(itemName(it.id))}</span></button><button class="btn2 sm q" data-setup="${it.id}" type="button" title="${esc(tx('Choose course, wind, start position …','Velg kurs, vind, startposisjon …'))}">${tx('Set up','Sett opp')}<span class="sr">: ${esc(itemName(it.id))}</span></button></div></li>`; }
const BLDICON='<svg class="pic" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 14h32M8 24h32M8 34h32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="14" r="4.5" fill="var(--sheet)" stroke="currentColor" stroke-width="2"/><circle cx="31" cy="24" r="4.5" fill="var(--sheet)" stroke="currentColor" stroke-width="2"/><circle cx="22" cy="34" r="4.5" fill="var(--sheet)" stroke="currentColor" stroke-width="2"/></svg>';
function gridCols(){ const g=el('groups'); const t=getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length; return Math.max(1,t||1); }
function renderCat(){ const rec=recommended(), box=el('groups'), res=el('catList'), q0=(HS.q||'').trim().toLowerCase();
  el('allH').textContent=tx(`All ${I.ITEMS.length} exercises`,`Alle ${I.ITEMS.length} øvelsene`);
  el('allSub').textContent=tx('Grouped by topic. Open a topic to see its exercises.','Gruppert etter emne. Åpne et emne for å se øvelsene.');
  const si=el('catQ'); si.placeholder=tx('Search, e.g. hold or NDB','Søk, f.eks. holding eller NDB'); si.setAttribute('aria-label',tx('Search exercises','Søk i øvelsene')); if(si.value!==HS.q) si.value=HS.q||'';
  el('catQx').hidden=!q0; el('catQx').setAttribute('aria-label',tx('Clear the search','Tøm søket'));
  if(q0){ const hit=I.ITEMS.filter(it=>(L(IT[it.id].n)+' '+L(IT[it.id].s)+' '+L(W.group[it.g])+' '+it.id).toLowerCase().indexOf(q0)>=0);
    box.hidden=true; res.hidden=false;
    res.innerHTML=hit.length?`<p class="rescount">${hit.length} ${hit.length===1?tx('exercise matches','øvelse passer'):tx('exercises match','øvelser passer')}</p><ol class="rows">${hit.map(it=>rowHTML(it,it.id===rec)).join('')}</ol>`:`<p class="cat-empty">${tx('No exercise matches that. Try another word, or clear the search.','Ingen øvelse passer til det. Prøv et annet ord, eller tøm søket.')}</p>`;
    wireRows(res); return; }
  res.hidden=true; res.innerHTML=''; box.hidden=false;
  const cards=I.GROUPS.map(g=>{ const its=I.ITEMS.filter(it=>it.g===g), np=its.filter(it=>passed(it.id)).length, open=HS.g===g;
    return `<button type="button" class="gcard${open?' on':''}" data-g="${g}" aria-expanded="${open}" aria-controls="gpanel">${pic(its[0].id)}<b>${esc(L(W.group[g]))}</b><span class="gs">${esc(L(W.groupSub[g]))}</span>
      <span class="gm"><span>${its.length} ${its.length===1?tx('exercise','øvelse'):tx('exercises','øvelser')}</span><span class="gbar" aria-hidden="true"><i style="width:${Math.round(np/its.length*100)}%"></i></span><span>${np?`${np} ${tx('passed','bestått')}`:tx('none passed yet','ingen bestått ennå')}</span></span>
      <svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`; });
  cards.push(`<button type="button" class="gcard build" id="openBld" aria-haspopup="dialog">${BLDICON}<b>${tx('Practise exactly this','Øv på akkurat dette')}</b><span class="gs">${tx('Choose the exercise, the course, the wind and where you start.','Velg øvelse, kurs, vind og hvor du starter.')}</span><span class="gm"><span class="go">${tx('Set up your own run','Sett opp din egen runde')}</span></span></button>`);
  /* the open topic's exercises sit right under its row of cards */
  const cols=gridCols(), gi=I.GROUPS.indexOf(HS.g);
  if(gi>=0){ const g=HS.g, its=I.ITEMS.filter(it=>it.g===g), at=Math.min(cards.length,(Math.floor(gi/cols)+1)*cols);
    cards.splice(at,0,`<section class="gpanel" id="gpanel" aria-label="${esc(L(W.group[g]))}"><header><h3>${esc(L(W.group[g]))}</h3><p>${esc(L(W.groupSub[g]))}</p><button type="button" class="btn2 sm q" id="gClose">${tx('Close','Lukk')}</button></header><ol class="rows">${its.map(it=>rowHTML(it,it.id===rec)).join('')}</ol></section>`); }
  box.innerHTML=cards.join(''); box.dataset.cols=cols;
  box.querySelectorAll('.gcard[data-g]').forEach(b=>b.onclick=()=>{ const g=b.dataset.g; HS.g=HS.g===g?null:g; save('bb-ifr-home2',{g:HS.g}); renderCat(); const nb=q(`.gcard[data-g="${g}"]`); if(nb) nb.focus({preventScroll:true});
    const gp=el('gpanel'); if(gp&&HS.g){ const r=gp.getBoundingClientRect(); if(r.top>innerHeight*0.72||r.top<0) (nb||gp).scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'}); } });
  if(el('gClose')) el('gClose').onclick=()=>{ const g=HS.g; HS.g=null; save('bb-ifr-home2',{g:null}); renderCat(); const nb=q(`.gcard[data-g="${g}"]`); if(nb) nb.focus({preventScroll:true}); };
  el('openBld').onclick=()=>openBld();
  wireRows(box); }
function wireRows(root){ root.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>openItem(b.dataset.start,{}));
  root.querySelectorAll('[data-setup]').forEach(b=>b.onclick=()=>{ bldSet(b.dataset.setup); openBld(); }); }
function renderHome(){ renderHero(); renderPath(); renderCat(); }
(function(){ const si=el('catQ'); si.addEventListener('input',()=>{ HS.q=si.value; renderCat(); }); el('catQx').onclick=()=>{ HS.q=''; si.value=''; renderCat(); si.focus(); };
  let c0=0; addEventListener('resize',()=>{ if(document.body.classList.contains('v-trainer')) return; const c=gridCols(); if(c!==c0){ c0=c; if(HS.g&&!HS.q) renderCat(); } }); })();

/* ---------- the live miniature at the top of the home page ----------
   The real instrument and the real map, fed by the instructor's own path through a holding entry (ifrcore's scripted pilot).
   The line at the top is the coach line for the phase the aircraft is in. Runs only while it is on screen. */
const HERO={ok:false,t:0,W:0,H:0,dpr:1,cap:'',vis:true,last:0,hold:0};
function heroInit(){ try{ const Ar=AREAS.practice; let r=null; for(const sd of [8,2,5,14]){ r=I.run('holdEntry',Ar,2,sd,{p:{}}); const e=H.entry(r.X.task.inb,r.X.task.dir,r.X.task.arr).entry; if(e==='teardrop'&&r.g.pass) break; }
    HERO.X=r.X; HERO.P=r.path; HERO.end=r.path[r.path.length-1].t; HERO.Ar=Ar; HERO.G=NAVG.make(el('miniG'),'hsi'); HERO.map=NM.create(el('miniM'),{}); HERO.map.region=null;
    HERO.entry=H.entry(r.X.task.inb,r.X.task.dir,r.X.task.arr).entry; { const F=I.fixOf(Ar,r.X.task), q0=r.path.find(p=>Math.hypot(p.x-F.x,p.y-F.y)<2.3); HERO.t0=q0?q0.t:0; } HERO.ok=true; HERO.t=reduced()?HERO.t0+(HERO.end-HERO.t0)*0.3:HERO.t0;
    new ResizeObserver(heroSize).observe(el('miniM')); if('IntersectionObserver' in window) new IntersectionObserver(es=>{ HERO.vis=es[0].isIntersecting; }).observe(el('heroFig')); heroSize(); heroText(true); }catch(e){ HERO.ok=false; } }
function heroSize(){ const c=el('miniM'), r=c.getBoundingClientRect(); HERO.W=Math.round(r.width); HERO.H=Math.round(r.height); if(HERO.W<40||HERO.H<40) return; HERO.dpr=Math.min(devicePixelRatio||1,2); c.width=Math.round(HERO.W*HERO.dpr); c.height=Math.round(HERO.H*HERO.dpr);
  const F0=I.fixOf(HERO.Ar,HERO.X.task), P=[{x:F0.x+3,y:F0.y+3},{x:F0.x-3,y:F0.y-3}].concat(HERO.P.filter((p,i)=>i%8===0&&p.t>=HERO.t0).map(p=>({x:p.x,y:p.y}))), b={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity}; P.forEach(p=>{ b.x0=Math.min(b.x0,p.x); b.x1=Math.max(b.x1,p.x); b.y0=Math.min(b.y0,p.y); b.y1=Math.max(b.y1,p.y); });
  HERO.map.set(NM.fit(b,HERO.W,HERO.H,{l:16,r:16,t:16,b:16},{pad:0.45,min:3,maxK:260})); HERO.base=null; }
function heroAt(t){ const P=HERO.P; let lo=0,hi=P.length-1; if(t<=P[0].t) return P[0]; if(t>=P[hi].t) return P[hi]; while(hi-lo>1){ const m=(lo+hi)>>1; if(P[m].t<=t) lo=m; else hi=m; } const a=P[lo], b=P[hi], k=(t-a.t)/Math.max(1e-6,b.t-a.t);
  return {t,x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,h:norm(a.h+diff(b.h,a.h)*k),ph:a.ph,obs:a.obs}; }
function heroText(force){ if(!HERO.ok) return; const T=HERO.X.task, p=heroAt(HERO.t), e=HERO.entry, dir=T.dir>0?'R':'L'; let k, prm={};
  switch(p.ph){ case 'tofix': k='hold.tofix'; prm={entry:e}; break; case 'entry': case 'entryleg': k='hold.entry.'+e; prm={out:T.out,td:norm(T.out-T.dir*30),dir}; break;
    case 'back': k='hold.back'; prm={inb:T.inb}; break; case 'turnOut': case 'outbound': k='hold.outbound'; prm={hdg:Math.round(p.h)||360}; break; case 'turnIn': k='hold.turnin'; prm={inb:T.inb}; break;
    default: k='hold.inbound'; prm={inb:T.inb,hdg:Math.round(p.h)||360}; }
  const cap=fmt(CO[k]||t2('',''),pw(prm)); if(!force&&cap===HERO.cap) return; HERO.cap=cap; el('miniBig').textContent=cap;
  if(force){ const c=clearance(HERO.X,HERO.Ar,'holdEntry'); el('miniClr').textContent=L(c); el('miniWhy').textContent=tx('Why?','Hvorfor?'); el('miniLab').textContent=tx('Guided','Veiledet'); el('miniName').textContent=itemName('holdEntry'); el('miniSteps').textContent=STEPS.map(x=>L(x[1])).join(' · '); } }
function heroDraw(ts){ if(!HERO.ok||!HERO.vis||document.hidden||HERO.W<40) return; if(ts-HERO.last<32) return; const dt=Math.min(0.1,(ts-HERO.last)/1000); HERO.last=ts;
  if(!reduced()){ if(HERO.hold>0){ HERO.hold-=dt; if(HERO.hold<=0) HERO.t=HERO.t0; } else { HERO.t+=dt*(HERO.end-HERO.t0)/36; if(HERO.t>=HERO.end){ HERO.t=HERO.end; HERO.hold=2.5; } } }
  const p=heroAt(HERO.t), X=HERO.X, Ar=HERO.Ar, T=X.task, m=HERO.map, c=el('miniM'), g=c.getContext('2d'), Wm=HERO.W, Hm=HERO.H;
  const s={x:p.x,y:p.y,hdg:p.h,alt:T.alt,gs:120,trk:p.h,t:0}, r=I.read(s,Ar,{nav:X.nav,obs:p.obs!==undefined?p.obs:X.obs,adf:X.adf,dme:X.dme,rnp:X.rnp,nogs:X.nogs,leg:X.leg});
  HERO.G.set({hdg:p.h,crs:p.obs!==undefined?p.obs:X.obs,hsiDots:r.hsiDots||0,flag:r.flag||'OFF',ils:false,gsValid:false,gsDots2:0,bug:p.h}); HERO.G.tick(dt); HERO.G.draw();
  if(!HERO.base){ HERO.base=document.createElement('canvas'); HERO.base.width=c.width; HERO.base.height=c.height; const bg=HERO.base.getContext('2d'); bg.setTransform(HERO.dpr,0,0,HERO.dpr,0,0);
    m.drawBase(bg,Wm,Hm,{}); drawCoast(m,bg,Ar); const F=I.fixOf(Ar,T), R=Math.min(3,48/m.v.k); m.P(F.x,F.y); m.reserve(m.sx-R*m.v.k,m.sy-R*m.v.k,2*R*m.v.k,2*R*m.v.k); drawGeom(m,bg,X,Ar,'holdEntry',Wm,Hm); m.flushLabels(bg,Wm,Hm); bg.globalAlpha=0.7; drawSectors(m,bg,F,T.inb,T.dir,R); bg.globalAlpha=1;
    bg.strokeStyle='rgba(127,224,255,.6)'; bg.lineWidth=1.6; bg.setLineDash([6,5]); bg.beginPath(); HERO.P.filter(q0=>q0.t>=HERO.t0).forEach((q0,i)=>{ m.P(q0.x,q0.y); if(i) bg.lineTo(m.sx,m.sy); else bg.moveTo(m.sx,m.sy); }); bg.stroke(); bg.setLineDash([]); }
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,c.width,c.height); g.drawImage(HERO.base,0,0); g.setTransform(HERO.dpr,0,0,HERO.dpr,0,0);
  g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=2.2; g.lineCap='round'; g.lineJoin='round'; g.beginPath(); let st=false; for(const q0 of HERO.P){ if(q0.t<HERO.t0) continue; if(q0.t>HERO.t) break; m.P(q0.x,q0.y); if(st) g.lineTo(m.sx,m.sy); else { g.moveTo(m.sx,m.sy); st=true; } } m.P(p.x,p.y); g.lineTo(m.sx,m.sy); g.stroke();
  m.drawAircraft(g,p.x,p.y,p.h,{size:13}); heroText(false); }

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
const FL={kind:t2('What to read','Hva du leser'),n:t2('Positions','Posisjoner'),st:t2('Station','Stasjon'),crs:t2('Course','Kurs'),radial:t2('Hold on the radial','Holding på radial'),entry:t2('Entry','Inngang'),dir:t2('Turns','Svinger'),
  fix:t2('Holding fix','Holdingfiks'),D:t2('DME of the fix','DME for fiksen'),dmeLim:t2('The outbound leg ends at a DME distance','Legget ut slutter ved en DME-avstand'),ang:t2('Angle towards the course','Vinkel inn mot kursen'),part:t2('Which part','Hvilken del'),R:t2('Arc distance (DME)','Buens avstand (DME)'),a:t2('Type','Type'),side:t2('First turn','Første sving'),mk:t2('Topic','Emne')};
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
const MATHN={int:t2('Intercept heading','Heading for å skjære inn'),wca:t2('Wind correction angle','Vindkorreksjonsvinkel'),r160:t2('1 in 60','1 av 60'),tts:t2('Time to station','Tid til stasjonen'),rod:t2('Rate of descent (3°)','Synkehastighet (3°)'),tod:t2('Top of descent','Start av nedstigning'),lead:t2('Lead radial','Lead-radial'),leadd:t2('Distance before a turn','Avstand før en sving')};
function renderBld(){ const box=el('bld'), it=I.ITEM[BLD.item], ex=it.ex, E=I.EX[ex], [f1,f2]=bFields();
  const opts=I.GROUPS.map(g=>`<optgroup label="${esc(L(W.group[g]))}">${I.ITEMS.filter(x=>x.g===g).map(x=>`<option value="${x.id}" ${x.id===BLD.item?'selected':''}>${esc(itemName(x.id))}</option>`).join('')}</optgroup>`).join('');
  const insts=E.inst.filter(k=>!(it.p.pp&&['hsi','rmi','pfd'].indexOf(k)>=0));
  const foc=document.activeElement&&box.contains(document.activeElement)?(document.activeElement.id||(document.activeElement.dataset.k?`[data-k="${document.activeElement.dataset.k}"]${document.activeElement.dataset.v!==undefined?`[data-v="${document.activeElement.dataset.v}"]`:''}`:'')):'';
  box.innerHTML=`<header class="bh"><div><h2 id="bldH">${tx('Practise exactly this','Øv på akkurat dette')}</h2><p class="lede">${tx('Choose the exercise and the things that matter to you. Everything you leave alone gets a sensible value.','Velg øvelsen og det som betyr noe for deg. Alt du lar stå, får en fornuftig verdi.')}</p></div><button type="button" class="bx" id="bClose" aria-label="${esc(tx('Close','Lukk'))}"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></header>
   <div class="bcols"><div class="bf">
    <label class="w"><span>${tx('Exercise','Øvelse')}</span><select data-k="item">${opts}</select></label>
    ${f1.map(fieldHTML).join('')}
    <div class="lab w"><span>${tx('Wind','Vind')}</span>${seg('wind',[['ex',t2('Exercise decides','Øvelsen bestemmer')],['calm',t2('Calm','Stille')],['set',t2('Choose','Velg')],['random',t2('Random','Tilfeldig')]])}</div>
    ${BLD.wind==='set'?`<div class="row3 w"><label><span>${tx('From (°)','Fra (°)')}</span><input type="number" data-k="wdir" min="1" max="360" value="${BLD.wdir}"></label><label><span>${tx('Speed (kt)','Fart (kt)')}</span><input type="number" data-k="wspd" min="0" max="60" value="${BLD.wspd}"></label><label class="chk"><input type="checkbox" data-k="gust" ${BLD.gust?'checked':''}><span>${tx('Gusts','Vindkast')}</span></label></div>`:''}
    <div class="lab w"><span>${tx('How much help?','Hvor mye hjelp?')}</span>${`<div class="bseg" role="group">${['guided','hints','off'].map(k=>`<button type="button" data-help="${k}" class="${BLD.help===k?'on':''}" aria-pressed="${BLD.help===k}">${esc(L(W.help[k]))}</button>`).join('')}</div>`}<span class="hint" style="margin:0">${esc(L(W.helpSub[BLD.help]))}</span></div>
    <div class="w bmore"><button type="button" class="btn3" id="bMore" aria-expanded="${!!BLD.more}">${BLD.more?tx('Fewer options','Færre valg'):tx('More options: area, instrument, level','Flere valg: område, instrument, nivå')}</button></div>
    ${BLD.more?`<div class="lab w"><span>${tx('Area','Område')}</span>${`<div class="bseg" role="group">${['practice','bergen','oslo'].map(a=>`<button type="button" data-area="${a}" class="${BLD.area===a?'on':''}" ${allowed(ex,a)?'':'disabled'} aria-pressed="${BLD.area===a}">${esc(L(W.area[a]))}</button>`).join('')}</div>`}</div>
    ${f2.map(fieldHTML).join('')}
    <div class="lab w"><span>${tx('Instrument','Instrument')}</span><div class="bseg" role="group">${['',...insts].map(k=>`<button type="button" data-k="inst" data-v="${k}" class="${(BLD.inst||'')===k?'on':''}" aria-pressed="${(BLD.inst||'')===k}" ${k?`title="${esc(L(W.instLong[k]))}"`:''}>${k?W.inst[k]:esc(L(AUTO))}</button>`).join('')}</div>${BLD.inst?`<span class="hint" style="margin:0">${esc(L(W.instLong[BLD.inst]))}</span>`:''}</div>
    <div class="lab w"><span>${tx('Level','Nivå')}</span>${`<div class="bseg" role="group">${[1,2,3,4].map(k=>`<button type="button" data-lv="${k}" class="${BLD.lv===k?'on':''}" aria-pressed="${BLD.lv===k}" title="${esc(L(W.level[k]))}">${k}</button>`).join('')}</div>`}<span class="hint" style="margin:0">${esc(L(W.level[BLD.lv]))}${BLD.wind!=='ex'?esc(tx('. Your wind choice replaces the level’s wind.','. Vindvalget ditt erstatter nivåets vind.')):''}</span></div>`:''}
   </div>
   <div class="bside"><span class="bl">${E.fixedStart?tx('What you will fly','Dette skal du fly'):tx('Where you start: drag the aircraft, turn it with the handle','Hvor du starter: dra flyet, snu det med håndtaket')}</span><div class="bmap" id="bmap"><canvas id="bmapC" aria-label="${esc(tx('Preview of the setup. Drag the aircraft to choose the start.','Forhåndsvisning av oppsettet. Dra flyet for å velge start.'))}"></canvas><span class="bm-note" id="bmNote"></span></div>
    <p class="bsum">${esc(itemName(BLD.item))}: ${esc(L(IT[BLD.item].s))}</p>${BLD.start?`<button type="button" class="btn3" id="bRstart">${tx('Random start again','Tilfeldig start igjen')}</button>`:''}</div></div>
   <div class="bacts"><button type="button" class="btn3 pri" id="bGo">${tx('Start this run','Start denne runden')}</button><button type="button" class="btn3" id="bRand" title="${esc(tx('A random exercise, start and wind','En tilfeldig øvelse, start og vind'))}"><svg viewBox="0 0 14 14" aria-hidden="true"><rect x="1.5" y="1.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="4.7" cy="4.7" r="1.1" fill="currentColor"/><circle cx="9.3" cy="9.3" r="1.1" fill="currentColor"/><circle cx="9.3" cy="4.7" r="1.1" fill="currentColor"/><circle cx="4.7" cy="9.3" r="1.1" fill="currentColor"/></svg>${tx('Surprise me','Overrask meg')}</button>${PROG.lastCustom?`<button type="button" class="btn3" id="bRep">${tx('Repeat my last run','Gjenta min siste runde')}</button>`:''}</div>`;
  el('bClose').onclick=()=>closeBld();
  if(foc){ try{ const f=foc.charAt(0)==='['?box.querySelector(foc):document.getElementById(foc); if(f) f.focus({preventScroll:true}); }catch(e){} }
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
  if(el('bRep')) el('bRep').onclick=()=>{ const l=PROG.lastCustom; closeBld(); openItem(l.item,{p:l.p,custom:true,lv:l.lv,area:l.area,seed:l.seed,help:l.help,inst:l.inst,step:'fly'}); };
  bPrev(); }
/* the builder lives in a dialog: opened from its card on the home page, from a row's "Set up", or from the trainer's Setup */
function openBld(){ const d=el('bldDlg'); if(!d.open){ if(d.showModal) d.showModal(); else d.setAttribute('open',''); } renderBld(); const f=el('bld').querySelector('select'); if(f) f.focus({preventScroll:true}); requestAnimationFrame(bPrev); }
function closeBld(){ const d=el('bldDlg'); glClose(); if(d.open){ if(d.close) d.close(); else d.removeAttribute('open'); } }
el('bldDlg').addEventListener('click',e=>{ if(e.target===el('bldDlg')) closeBld(); });
function startBuilder(){ closeBld(); const r=bVals(); PROG.lastCustom={item:BLD.item,p:r.p,lv:BLD.lv,area:BLD.area,seed:BLD.seed,help:BLD.help,inst:BLD.inst||null}; save(PK,PROG);
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
function openItem(id,o){ o=o||{}; const it=I.ITEM[id]; if(!it) return; closeBld(); glClose();
  S.item=id; S.ex=it.ex; S.p=Object.assign({},o.p||it.p); S.custom=!!o.custom;
  S.lv=o.lv||clamp(passed(id)+1,1,4); S.area=o.area&&allowed(it.ex,o.area)?o.area:(allowed(it.ex,S.area)?S.area:'practice');
  if(o.help) S.help=o.help; S.instWant=o.inst||null; S.inst=null;
  if(A().real) map.setRegion(S.area); else map.region=null;
  document.body.classList.add('v-trainer');
  setup(o.seed||Math.floor(Math.random()*9000)+1); if((location.hash||'').slice(1)!==id) history.pushState(null,'','#'+id);
  S.uStep=0; go(o.step||'understand'); requestAnimationFrame(()=>{ el('trainer').scrollIntoView({block:'start'}); sizeAll(); }); }
function showHome(push){ if(S.run){ S.run=false; S.started=false; } document.body.classList.remove('v-trainer'); closePops();
  if(push&&location.hash) history.pushState(null,'',location.pathname+location.search); renderHome(); scrollTo(0,0); }
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
  el('helpSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>setHelp(b.dataset.h));
  el('setT').textContent=tx('Setup','Oppsett');
  el('mapBtn').textContent=S.mapOpen?tx('Hide map','Skjul kart'):tx('Map','Kart'); el('mapBtn').setAttribute('aria-pressed',S.mapOpen);
  renderItabs(); }
function renderItabs(){ const ex=EXo(); const ks=['cdi','rmi','rbi','hsi','pfd'].filter(k=>ex.inst.indexOf(k)>=0);
  el('itabs').innerHTML=ks.map(k=>`<button type="button" data-i="${k}" class="${k===S.inst?'on':''}" ${instOk(k)?'':'disabled'} aria-pressed="${k===S.inst}" title="${esc(L(W.instLong[k]))}">${W.inst[k]}</button>`).join('');
  el('itabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.disabled) return; S.inst=S.instWant=b.dataset.i; renderItabs(); layoutInst(); });
  el('scan').innerHTML=S.X&&S.X.pp?esc(tx('The heading indicator has failed: use the compass','Kursgyroen har sviktet: bruk kompasset')):`${gl(W.inst[S.inst]||'CDI',1)}: ${esc(L(SCAN[S.inst]||SCAN.cdi))}`; }
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
  el('toBld').onclick=()=>{ bldSet(S.item); BLD.area=S.area; BLD.lv=S.lv; BLD.help=S.help; save(BK,BLD); showHome(true); openBld(); }; }
el('keysBtn').onclick=()=>{ const o=el('keysov'); if(!o.hidden){ o.hidden=true; return; } closePops();
  o.innerHTML=`<div class="kc" role="dialog" aria-labelledby="kh"><h3 id="kh">${tx('Keyboard','Tastatur')}</h3><dl>
   <dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>${tx('Heading 1° (with Shift 10°)','Heading 1° (med Shift 10°)')}</dd>
   <dt><kbd>,</kbd> <kbd>.</kbd></dt><dd>${tx('Course (CRS / OBS) 1° (with Shift 10°)','Kurs (CRS / OBS) 1° (med Shift 10°)')}</dd>
   <dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>${tx('Selected altitude 100 ft (with Shift 1000 ft)','Valgt høyde 100 ft (med Shift 1000 ft)')}</dd>
   <dt><kbd>Space</kbd></dt><dd>${tx('Start, pause and resume','Start, pause og fortsett')}</dd>
   <dt><kbd>H</kbd></dt><dd>${tx('Hint (when the help is set to Hints)','Hint (når hjelpen står på Hint)')}</dd>
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
function renderBrief(){ const c=clearance(S.X,A(),S.ex), pl=plain(S.X,A(),S.ex), tb=tblHTML(), cc=el('ccard'), strip=el('clr');
  const meta=`<span>${tx('Wind','Vind')} <b>${windTxt()}</b></span><span>${gl('TAS',1)} <b>${Math.round(I.tasOf(S.X.ac.ias,S.X.ac.alt))}</b></span>${A().real?`<span>${tx('Real navaid data','Ekte navigasjonsdata')}</span>`:''}`;
  if(S.step==='fly'&&!S.started){ strip.hidden=true; el('guide').hidden=true;
    cc.innerHTML=`<div class="ccard"><div class="cl"><div class="k">${S.ex==='math'?tx('The task','Oppgaven'):gl(tx('Your clearance','Klareringen din'),1)}</div><div class="ct">${gl(L(c),4,{clearance:1,heading:1,inbound:1,outbound:1,intercept:1,fix:1})}</div>${L(pl)?`<div class="pl"><b>${tx('In plain words','Med vanlige ord')}</b> ${gl(L(pl),2,{heading:1,fix:1,waypoint:1,intercept:1})}</div>`:''}${tb?`<div class="tbl">${tb}</div>`:''}<div class="meta">${meta}</div></div>
      <div class="hlp" role="radiogroup" aria-labelledby="hlpK"><div class="k" id="hlpK">${tx('How much help?','Hvor mye hjelp?')}</div>${['guided','hints','off'].map(k=>`<button type="button" role="radio" aria-checked="${S.help===k}" class="${S.help===k?'on':''}" data-hp="${k}"><b>${esc(L(W.help[k]))}</b><span>${esc(L(W.helpSub[k]))}</span></button>`).join('')}</div>
      <div class="go"><button class="dbtn pri" type="button" data-a="start"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>${tx('Start','Start')}</button>${S.ex!=='math'?`<button class="dbtn lt" type="button" data-a="demo">${tx('Watch the instructor first','Se instruktøren først')}</button>`:''}</div></div>`;
    cc.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a));
    cc.querySelectorAll('[data-hp]').forEach(b=>b.onclick=()=>setHelp(b.dataset.hp)); return; }
  cc.innerHTML=''; strip.hidden=S.step!=='fly'; el('guide').hidden=S.step!=='fly';
  strip.classList.toggle('open',S.clrOpen); strip.setAttribute('aria-expanded',S.clrOpen);
  strip.innerHTML=`<span class="ct">${gl(L(c),S.clrOpen?4:3,{clearance:1,heading:1,inbound:1,outbound:1,intercept:1,fix:1})}${S.clrOpen&&L(pl)?`<span class="tbl pl2">${esc(L(pl))}</span>`:''}${S.clrOpen&&tb?`<span class="tbl">${tb}</span>`:''}</span><span class="meta">${meta}</span>`; }
function setHelp(k){ S.help=k; PROG.help=S.help; save(PK,PROG); if(S.help!=='guided'&&S.pause) resumePause(); renderBar(); renderBrief(); renderGuide(true); if(S.step==='fly') renderCtl(); renderLegend(); renderQuiz(); }
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
  if(ex==='math') return {big:tx('Work it out in your head, then type the answer.','Regn det ut i hodet, og skriv inn svaret.'),sm:'',sev:'info'};
  if(ex==='orient'){ const k=X.task.kind;
    if(k==='rbi'){ const rb=Math.round(norm(r.rb)); return {big:tx(`Add them up: heading ${d3(s.hdg)} + needle ${rb}°`,`Legg sammen: heading ${d3(s.hdg)} + nål ${rb}°`),sm:tx('Over 360? Take 360 away. Type the bearing and press Report.','Over 360? Trekk fra 360. Skriv inn peilingen og trykk Rapporter.'),sev:'info'}; }
    if(k==='rmi') return {big:tx('Read the number under the tail of the green needle: that is your radial','Les tallet under halen på den grønne nålen: det er radialen din'),sm:tx('Type it in and press Report.','Skriv den inn og trykk Rapporter.'),sev:'info'};
    const want=c.obs, off=diff(want,X.obs);
    if(Math.abs(off)>2) return {big:tx(`Turn the course knob ${off>0?'up':'down'} until the needle is centred and the flag shows FROM`,`Vri kursknappen ${off>0?'opp':'ned'} til nålen står i midten og flagget viser FROM`),sm:tx('The pink mark on the card shows where to stop.','Det rosa merket på skiven viser hvor du stopper.'),tgt:{crs:want},sev:'info'};
    return {big:tx('Centred with FROM: the number at the top is your radial. Report it.','I midten med FROM: tallet øverst er radialen din. Rapporter den.'),sm:'',sev:'good'}; }
  if(ex==='tts'){ const st=A().ST[X.task.st], b=N.bearing(s.x-st.x,s.y-st.y), ch=J.b0===undefined?0:Math.abs(diff(b,J.b0));
    if(!S.watch.on&&S.watch.t<1) return {big:tx('Start the stopwatch now','Start stoppeklokka nå'),sm:tx('Press Stopwatch (or the T key), then fly straight ahead.','Trykk Stoppeklokke (eller tasten T), og fly rett frem.'),sev:'warn'};
    if(ch<10) return {big:tx(`Fly straight. The bearing has changed ${Math.round(ch)}° of 10°.`,`Fly rett frem. Peilingen har endret seg ${Math.round(ch)}° av 10°.`),sm:tx('Watch the needle slowly move backwards.','Se nålen flytte seg sakte bakover.'),sev:'info'};
    return {big:tx(`10° done: minutes = ${Math.round(S.watch.t)} s ÷ 10. Report it.`,`10° nådd: minutter = ${Math.round(S.watch.t)} s ÷ 10. Rapporter svaret.`),sm:'',sev:'warn'}; }
  /* course */
  const navT=X.nav&&A().ST[X.nav]?A().ST[X.nav].type:null;
  if((navT==='VOR'||navT==='ILS')&&c.obs!=null&&Math.abs(diff(c.obs,X.obs))>2) return {big:tx(`Set the course to ${d3(c.obs)}`,`Still inn kurs ${d3(c.obs)}`),sm:tx('Turn the course knob (CRS), or use the , and . keys.','Vri kursknappen (CRS), eller bruk tastene , og .'),tgt:{crs:c.obs},sev:'info'};
  if(ex==='pass'){ const st=A().ST[X.task.st]; if(Math.hypot(s.x-st.x,s.y-st.y)<2.6&&!J.rep) return {big:tx('Hold the heading and watch the flag: press Station passage when it shows FROM','Hold headingen og følg med på flagget: trykk Stasjonspassering når det viser FROM'),sm:'',sev:'warn'}; }
  /* heading */
  let th=Math.round(c.hdg)||360; if(S.gTh===null||Math.abs(diff(th,S.gTh))>=3) S.gTh=th; th=S.gTh;
  const toGo=diff(th,s.hdg), dir=(c.dir&&Math.abs(toGo)>=45)?c.dir:Math.sign(toGo)||1;
  const tgt={hdg:th};
  /* altitude and rate */
  let ta=c.alt!=null?Math.round(c.alt/10)*10:null; const mins=X.task.da||X.task.mda||X.task.mins; if(ta!=null&&mins&&isApp(ex)&&ta<mins&&!(J.miss)) ta=mins;
  const vsKey=ctlList().indexOf('vs')>=0, altNeed=ta!=null&&ctlList().indexOf('alt')>=0&&Math.abs(ta-s.sel.alt)>40, vsWant=Math.round((c.vs||0)/50)*50, vsNeed=vsKey&&ta!=null&&Math.abs(ta-s.alt)>150&&Math.abs(vsWant-s.sel.vs)>=100;
  if(altNeed) tgt.alt=ta; if(vsNeed) tgt.vs=vsWant;
  if(X.pp){ const deg=Math.round(toGo/10)*10; if(Math.abs(deg)>=10&&!(S.tt&&s.t-S.tt.t0<S.tt.dur+1)) return {big:tx(`Timed turn: ${Math.abs(deg)}° to the ${turnW(deg)} (${Math.round(Math.abs(deg)/3)} s)`,`Sving på tid: ${Math.abs(deg)}° til ${turnW(deg)} (${Math.round(Math.abs(deg)/3)} s)`),sm:cl,tgt:{},sev:'info'}; }
  else if(Math.abs(diff(th,s.sel.hdg))>=3) return {big:tx(`Turn ${turnW(dir)} to heading ${d3(th)}${Math.abs(toGo)>25?' now':''}`,`Sving til ${turnW(dir)} til heading ${d3(th)}${Math.abs(toGo)>25?' nå':''}`),sm:altNeed?altLine(ta,s):reasonTxt(r,co,cl),tgt,sev:Math.abs(toGo)>25?'warn':'info'};
  if(altNeed) return {big:ta<s.alt?tx(`Descend: set altitude ${ta} ft`,`Gå ned: still inn høyde ${ta} ft`):tx(`Climb: set altitude ${ta} ft`,`Stig: still inn høyde ${ta} ft`),sm:vsNeed?rateLine(vsWant,ta<s.alt):cl,tgt,sev:'warn'};
  if(vsNeed) return {big:rateLine(vsWant,ta<s.alt),sm:cl,tgt,sev:'info'};
  if(!X.pp&&Math.abs(toGo)>5) return {big:tx(`Turning ${turnW(dir)} to heading ${d3(th)}. Wait for the turn to finish.`,`Svinger til ${turnW(dir)} til heading ${d3(th)}. Vent til svingen er ferdig.`),sm:cl,tgt,sev:'info'};
  return {big:cl||tx('Hold this heading and altitude.','Hold denne headingen og høyden.'),sm:'',tgt,sev}; }
/* a short reason under a turn instruction, without a competing number */
function reasonTxt(r,co,cl){ if(co&&co.p&&co.p.hdg===undefined&&co.p.a===undefined) return cl;
  if(r&&Number.isFinite(r.dots)&&Math.abs(r.dots)>0.3&&r.flag!=='OFF'){ const sd=r.dots>0?'R':'L'; return tx(`The needle is to the ${sideW(sd)}: the course is on your ${sideW(sd)}.`,`Nålen står til ${sideW(sd)}: kursen ligger til ${sideW(sd)} for deg.`); }
  return tx('This is the heading the instructor would fly now.','Dette er headingen instruktøren ville fløyet nå.'); }
const altLine=(ta,s)=>ta<s.alt?tx(`Then descend: set ${ta} ft.`,`Gå så ned: still inn ${ta} ft.`):tx(`Then climb: set ${ta} ft.`,`Stig så: still inn ${ta} ft.`);
const rateLine=(v,down)=>down?tx(`Set the rate of descent (VS) to ${v} ft/min`,`Still inn synkehastigheten (VS) på ${v} ft/min`):tx(`Set the rate of climb (VS) to ${v} ft/min`,`Still inn stigehastigheten (VS) på ${v} ft/min`);
/* targets shown on the instrument and the controls: guided, a third hint, or the instructor flying */
const showHelp=()=>S.help==='guided'||S.demo||(S.help==='hints'&&S.hint>=3);
let ACT=null;
function targetsNow(){ if(S.step!=='fly'||!S.started||!showHelp()||!ACT) return null; return ACT.tgt||null; }
let guideKey='';
/* in the live instruction line only the abbreviations and the jargon become chips, not everyday words like heading */
const GSKIP={heading:1,fix:1,inbound:1,outbound:1,intercept:1,clearance:1,dot:1,waypoint:1};
function renderGuide(force){ const g=el('guide'); if(S.step!=='fly'||!S.started){ g.hidden=true; return; } g.hidden=false;
  ACT=action(); const co=S.J.coach;
  if(S.help==='hints'&&co&&co.k!==S.hintK){ S.hintK=co.k; S.hint=0; }
  let big='',sm='',cls='info',btns='';
  const why=whyTxt(), whyB=why?`<button type="button" class="pill" id="gWhy" aria-expanded="${S.showWhy}">${tx('Why?','Hvorfor?')}<kbd>W</kbd></button>`:'';
  if(S.demo){ big=ACT?tx('The instructor: ','Instruktøren: ')+ACT.big.charAt(0).toLowerCase()+ACT.big.slice(1):''; sm=coachTxt(); cls='info'; btns=whyB; }
  else if(S.help==='guided'){ if(ACT){ big=ACT.big; sm=ACT.sm; cls=ACT.sev||'info'; } btns=whyB; }
  else if(S.help==='hints'){ btns=`<button type="button" class="pill" id="gHint">${S.hint===0?tx('Hint','Hint'):S.hint<3?tx('More help','Mer hjelp'):tx('Hint','Hint')}<kbd>H</kbd></button>`+whyB;
    if(S.hint===0){ big=tx('You are flying. Stuck? Press Hint.','Du flyr selv. Står du fast? Trykk Hint.'); cls='quiet'; }
    else if(S.hint===1){ big=coachTxt()||tx('Hold this heading and altitude.','Hold denne headingen og høyden.'); cls=co?co.sev:'info'; }
    else { big=ACT?ACT.big:''; sm=coachTxt(); cls=ACT?ACT.sev:'info'; } }
  else { big=tx('You are flying on your own. “Why?” explains the current step.','Du flyr på egen hånd. «Hvorfor?» forklarer steget du er på.'); cls='quiet'; btns=whyB; }
  const key=[big,sm,cls,btns,S.showWhy,why].join('|'); if(!force&&key===guideKey) return; guideKey=key;
  g.className='guide '+cls;
  g.innerHTML=`<span class="mk" aria-hidden="true">${cls==='good'?ICON.check:cls==='warn'?ICON.warn:cls==='quiet'?ICON.solo:ICON.arrow}</span><div class="gx"><span class="big">${gl(big,2,GSKIP)}</span>${sm?`<span class="sm">${gl(sm,2,GSKIP)}</span>`:''}${S.showWhy&&why?`<span class="wt">${gl(why,3,GSKIP)}</span>`:''}</div><div class="gb">${btns}</div>`;
  if(el('gWhy')) el('gWhy').onclick=()=>{ S.showWhy=!S.showWhy; renderGuide(true); };
  if(el('gHint')) el('gHint').onclick=hintMore;
  /* the controls that need touching glow */
  qa('#ctl .c').forEach(c=>c.classList.remove('tgt')); qa('#ctl small[id^="tg-"]').forEach(s=>s.textContent='');
  const T=targetsNow(); if(T){ const mark=(k,v)=>{ const c=q(`#ctl .c[data-k="${k}"]`); if(c){ c.classList.add('tgt'); const s=el('tg-'+k); if(s) s.textContent='→ '+v; } };
    if(T.crs!=null&&Math.abs(diff(T.crs,S.X.obs))>2) mark('crs',d3(T.crs)); if(T.hdg!=null&&Math.abs(diff(T.hdg,S.sim.sel.hdg))>=3&&!S.X.pp) mark('hdg',d3(T.hdg)); if(T.alt!=null) mark('alt',T.alt); if(T.vs!=null) mark('vs',T.vs); }
  if(S.ex==='math') renderQuiz(); }
function hintMore(){ if(S.hint<3){ S.hint++; S.hintsUsed++; } S.hintK=S.J.coach&&S.J.coach.k; renderGuide(true); }

/* ---------- key moments: a short pause and the explanation (Guided) ---------- */
const MOM={'int.lead':t2('The needle is moving','Nålen beveger seg'),'arc.turnsoon':t2('Onto the arc','Inn på buen'),'arc.leadradial':t2('Time to leave the arc','På tide å forlate buen'),
  'hold.entryturn':t2('Turn back to the fix','Sving tilbake til fiksen'),'hold.turnout':t2('Over the fix','Over fiksen'),'pt.turn45':t2('The first turn','Den første svingen'),'pt.turn180':t2('The turn back','Svingen tilbake'),
  'pt.turn260':t2('The turn back','Svingen tilbake'),'base.turn':t2('Time is up','Tiden er ute'),'vor.faf':t2('The final approach fix (FAF)','Final approach fix (FAF)'),'app.faf':t2('The final approach fix (FAF)','Final approach fix (FAF)'),
  'app.gpfaf':t2('The glide path is coming down','Glidebanen kommer ned'),'ils.alive':t2('The localiser needle is moving','Localiser-nålen rører seg'),'ils.waitgs':t2('On the localiser','På localiseren'),
  'miss.climb':t2('At the minimum: no runway in sight','På minimum: ingen rullebane i sikte'),'rt.turn':t2('A waypoint just ahead','Et waypoint like foran'),'pass.watch':t2('Close to the station','Nær stasjonen'),'tts.report':t2('10° done','10° nådd'),
  'ip.wait':t2('Over the station','Over stasjonen'),'hold.near':t2('Before the fix: which entry?','Før fiksen: hvilken inngang?')};
function checkMoment(){ if(S.help!=='guided'||S.demo||S.pause||!S.J) return; const co=S.J.coach; let k=co&&MOM[co.k]?co.k:null;
  if(S.ex==='holdEntry'&&S.J.phase==='tofix'){ const F=I.fixOf(A(),S.X.task); if(Math.hypot(S.sim.x-F.x,S.sim.y-F.y)<1.7) k='hold.near'; }
  if(k&&!S.moments[k]){ S.moments[k]=1; pauseAt(k); } }
function pauseAt(k){ S.pause=k; S.paused=true; ACT=action(); const T=S.X.task;
  let txt=whyTxt(), doo=ACT?ACT.big:'';
  if(k==='hold.near'){ const e=H.entry(T.inb,T.dir,S.sim.hdg), nm=L(W.entry[e.entry]); txt=tx(`You will cross the fix on heading ${d3(S.sim.hdg)}. That puts you in the ${nm} sector.`,`Du krysser fiksen på heading ${d3(S.sim.hdg)}. Da er du i sektoren for ${nm} inngang.`)+' '+L(CO['hold.entry.'+e.entry+'.why']);
    doo=fmt(CO['hold.entry.'+e.entry],pw({out:T.out,td:norm(T.out-T.dir*30),dir:T.dir>0?'R':'L'})); }
  const p=el('pausec'); p.hidden=false;
  p.innerHTML=`<span class="k">${tx('Paused: a key moment','Pause: et viktig øyeblikk')}</span><b id="pauseB">${esc(L(MOM[k]))}</b>${txt?`<p>${gl(txt,3,GSKIP)}</p>`:''}${doo?`<p class="do">${gl(tx('Now: ','Nå: ')+doo,2,GSKIP)}</p>`:''}<div class="row2"><button type="button" class="dbtn pri" id="pGo">${tx('Continue','Fortsett')}</button><span style="font-size:12.5px;color:var(--ni3)">Enter</span></div>`;
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
  mc.innerHTML=`<h3>${tx('Rules of thumb','Tommelfingerregler')}</h3><ol>${mathRules(S.item).map(m=>`<li>${gl(L(m),2)}</li>`).join('')}</ol>`; }

/* ---------- Understand: the walk-through ---------- */
/* "Learn the theory": the Virtual Lab that explains each exercise (by group; a few items point elsewhere) */
const THEORY={basics:'radionav.html',track:'radionav.html',intercept:'radionav.html',ndb:'radionav.html',arc:'radionav.html',hold:'holding.html',rev:'holding.html',
  app:'holding.html',route:'gnss.html',math:'gennav.html',pp:'gyros.html'};
const THEORY_IT={lnav:'gnss.html',lnavVnav:'gnss.html',lpv:'gnss.html',locInt:'holding.html',mathApp:'holding.html'};
const theoryOf=id=>THEORY_IT[id]||THEORY[(I.ITEM[id]||{}).g]||'';
function theoryHTML(id){ const f=theoryOf(id); if(!f) return ''; const n=GL.labName(f)||f;
  return `<a class="uth" href="${f}"><span>${esc(tx('Learn the theory','Lær teorien'))}:</span> ${esc(n)} <span aria-hidden="true">→</span></a>`; }
const uSteps=()=>S.ex==='math'?mathU(S.item).map(s=>({s,static:true})):uwFor(S.item).concat([{s:tryFor(S.item),try:true}]);
function segIdx(st){ const P=S.ideal||[]; if(!P.length||!st.seg) return {i0:0,i1:Math.max(0,P.length-1)};
  if(typeof st.seg[0]==='number'){ const t1=P[P.length-1].t; const a=P.findIndex(p=>p.t>=st.seg[0]*t1), b=P.findIndex(p=>p.t>=st.seg[1]*t1); return {i0:Math.max(0,a),i1:b<0?P.length-1:Math.max(a+1,b)}; }
  let a=-1,b=-1; P.forEach((p,i)=>{ if(st.seg.indexOf(p.ph)>=0){ if(a<0) a=i; b=i; } }); if(a<0) return {i0:0,i1:P.length-1}; return {i0:a,i1:Math.max(a+1,b)}; }
function setUStep(i,quiet){ const st=uSteps(); S.uStep=clamp(i,0,st.length-1); S.uT=0; const cur=st[S.uStep];
  if(cur.try){ S.u={x:S.X.ac.x,y:S.X.ac.y,hdg:S.X.ac.hdg,alt:S.X.ac.alt,ias:S.X.ac.ias,gs:S.X.ac.ias,trk:S.X.ac.hdg,obs:S.X.obs}; }
  S.useg=segIdx(cur); if(!quiet){ renderLesson(); renderTbar(); renderLegend(); } }
function uNext(){ const n=uSteps().length; if(S.uStep<n-1) setUStep(S.uStep+1); else act(S.think?'think':'fly'); }
function renderLesson(){ const st=uSteps(), cur=st[S.uStep], n=st.length, last=S.uStep===n-1;
  el('lesson').innerHTML=`<div class="uh"><div class="udots" role="group" aria-label="${esc(tx('Steps','Steg'))}">${st.map((s,i)=>`<button type="button" data-u="${i}" class="${i===S.uStep?'on':i<S.uStep?'done':''}" aria-label="${tx('Step','Steg')} ${i+1}" aria-current="${i===S.uStep?'step':'false'}"></button>`).join('')}</div><span class="uc">${S.uStep+1} ${tx('of','av')} ${n}</span></div>
    <p class="us" aria-live="polite">${gl(L(cur.s),4)}</p><div class="live" id="uLive"></div>
    <div class="unav">${S.uStep>0?`<button type="button" class="dbtn q" id="uBack">${tx('Back','Tilbake')}</button>`:''}<span class="sp"></span><button type="button" class="dbtn pri" id="uNext">${last?(S.think?tx('Think first','Tenk først'):tx('Fly it','Fly den')):tx('Next','Neste')}</button></div>${theoryHTML(S.item)}`;
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
    :T.kind==='passq'?L({flag:t2('The flag changes from TO to FROM','Flagget skifter fra TO til FROM'),needle:t2('The needle swings','Nålen slår ut'),dme:t2('The DME shows 0','DME viser 0')}[v]):cap(T.kind==='entry'?L(W.entry[v]):sideW(v));
  let qx='';
  switch(T.kind){
    case 'radial': qx=tx(`The RMI needle points to <b>${d3(T.qdm)}</b>. Which radial are you on?`,`RMI-nålen peker på <b>${d3(T.qdm)}</b>. Hvilken radial er du på?`); break;
    case 'qdm': qx=tx(`Your heading is <b>${d3(T.hdg)}</b>. The ADF needle shows <b>${T.rb}°</b> from the nose. What is the bearing to the beacon?`,`Headingen din er <b>${d3(T.hdg)}</b>. ADF-nålen viser <b>${T.rb}°</b> fra nesen. Hva er peilingen til fyret?`); break;
    case 'needle': qx=tx('You fly towards the station and the flag shows TO. The needle is right of centre. Where is the course?','Du flyr mot stasjonen, og flagget viser TO. Nålen står til høyre for midten. Hvor ligger kursen?'); break;
    case 'wca': qx=tx(`Course <b>${d3(T.crs)}</b>, true airspeed (TAS) <b>${T.tas}</b> kt, wind from <b>${d3(T.w.dir)}</b> at <b>${T.w.spd}</b> kt. Which heading keeps you on the course?`,`Kurs <b>${d3(T.crs)}</b>, sann flyhastighet (TAS) <b>${T.tas}</b> kt, vind fra <b>${d3(T.w.dir)}</b> med <b>${T.w.spd}</b> kt. Hvilken heading holder deg på kursen?`); break;
    case 'intercept': qx=tx(`You are on radial <b>${d3(T.radial)}</b>. You must intercept course <b>${d3(T.crs)}</b> ${T.inbound?'to the station':'away from the station'}. Which heading do you turn to?`,`Du er på radial <b>${d3(T.radial)}</b>. Du skal skjære inn på kurs <b>${d3(T.crs)}</b> ${T.inbound?'inn mot stasjonen':'ut fra stasjonen'}. Hvilken heading svinger du til?`); break;
    case 'arclead': qx=tx(`You are about to turn onto a <b>${T.R} DME</b> arc at <b>${T.tas}</b> kt. How far before the arc do you start the 90° turn?`,`Du skal svinge inn på en <b>${T.R} DME</b>-bue i <b>${T.tas}</b> kt. Hvor langt før buen starter du svingen på 90°?`); break;
    case 'entry': qx=tx(`The hold has inbound course <b>${d3(T.inb)}</b> and ${T.dir>0?'right':'left'} turns. You will cross the fix on heading <b>${d3(T.hdg)}</b>. Which entry?`,`Holdingen har kurs inn <b>${d3(T.inb)}</b> og ${T.dir>0?'høyresvinger':'venstresvinger'}. Du krysser fiksen på heading <b>${d3(T.hdg)}</b>. Hvilken inngang?`); break;
    case 'holdwca': qx=tx(`Towards the fix you need <b>${Math.abs(T.wca)}°</b> of wind correction (heading <b>${d3(T.hdgIn)}</b>). Which heading do you fly away from the fix?`,`Inn mot fiksen trenger du <b>${Math.abs(T.wca)}°</b> vindkorreksjon (heading <b>${d3(T.hdgIn)}</b>). Hvilken heading flyr du bort fra fiksen?`); break;
    case 'ptdir': qx=tx(`You have made the first turn: ${T.a}° to the ${T.side>0?'right':'left'}. Which way is the turn back?`,`Du har gjort den første svingen: ${T.a}° til ${T.side>0?'høyre':'venstre'}. Hvilken vei går svingen tilbake?`); break;
    case 'basedir': qx=tx(`The time away from the station is up. Which way do you turn onto course <b>${d3(X.task.inb)}</b>?`,`Tiden bort fra stasjonen er ute. Hvilken vei svinger du inn på kurs <b>${d3(X.task.inb)}</b>?`); break;
    case 'profile': qx=tx(`You descend on the 3° path. Which altitude should you have at <b>${T.dme} DME</b>?`,`Du går ned på banen på 3°. Hvilken høyde skal du ha ved <b>${T.dme} DME</b>?`); break;
    case 'proftime': qx=tx(`You descend on the 3° path. Which altitude should you have <b>${T.t} s</b> after the FAF?`,`Du går ned på banen på 3°. Hvilken høyde skal du ha <b>${T.t} s</b> etter FAF?`); break;
    case 'rod': qx=tx(`Your ground speed is <b>${T.gs}</b> kt on a 3° path. How fast do you descend?`,`Farten din over bakken er <b>${T.gs}</b> kt på en bane på 3°. Hvor fort går du ned?`); break;
    case 'rtturn': qx=tx(`At <b>${T.wp}</b> the next leg has course <b>${d3(T.crs)}</b>. Which way do you turn?`,`Ved <b>${T.wp}</b> har neste legg kurs <b>${d3(T.crs)}</b>. Hvilken vei svinger du?`); break;
    case 'passq': qx=tx('How do you know that you have passed over a VOR?','Hvordan vet du at du har passert over en VOR?'); break;
    case 'ttsq': qx=tx('The station is on your wingtip. The bearing changes 10° in 90 seconds. How long to the station?','Stasjonen ligger på vingetippen. Peilingen endrer seg 10° på 90 sekunder. Hvor lenge er det til stasjonen?'); break;
    case 'locq': qx=tx('How many times more sensitive is a localiser needle than a VOR needle?','Hvor mange ganger mer følsom er en localiser-nål enn en VOR-nål?'); break;
  }
  const why=()=>{ const a=opt(T.ans);
    switch(T.kind){
      case 'radial': return tx(`Your radial is under the tail of the needle: ${d3(T.qdm)} ± 180 = ${a}.`,`Radialen din står under halen på nålen: ${d3(T.qdm)} ± 180 = ${a}.`);
      case 'qdm': return tx(`Heading + needle: ${d3(T.hdg)} + ${T.rb} = ${a}. Take 360 away if the sum is over 360.`,`Heading + nål: ${d3(T.hdg)} + ${T.rb} = ${a}. Trekk fra 360 hvis summen blir over 360.`);
      case 'needle': return tx('Needle right means the course is on your right. Turn towards the needle.','Nål til høyre betyr at kursen ligger til høyre for deg. Sving mot nålen.');
      case 'wca': return tx(`The wind comes from your ${sideW(T.wca>0?'R':'L')}. Point the nose about ${Math.abs(T.wca)}° into it: heading ${a}.`,`Vinden kommer fra ${sideW(T.wca>0?'R':'L')}. Pek nesen rundt ${Math.abs(T.wca)}° opp mot den: heading ${a}.`);
      case 'intercept': return tx(`Turn towards the course. The course plus or minus ${T.inbound?30:45}°, on the side where it lies, gives ${a}.`,`Sving mot kursen. Kursen pluss eller minus ${T.inbound?30:45}°, til den siden den ligger, gir ${a}.`);
      case 'arclead': return tx(`A 90° turn needs about one turn radius: ${a} at this speed.`,`En sving på 90° trenger omtrent én svingradius: ${a} i denne farten.`);
      case 'entry': return tx(`${a}${T.alt?` (you are within 5° of a sector line, so ${L(W.entry[T.alt])} is fine too)`:''}. Picture your heading over the fix and the 70° line.`,`${a}${T.alt?` (du er innenfor 5° av en sektorlinje, så ${L(W.entry[T.alt])} er også greit)`:''}. Se for deg headingen din over fiksen og 70°-linjen.`);
      case 'holdwca': return tx(`Three times the correction, on the other side: ${a}.`,`Tre ganger korreksjonen, til den andre siden: ${a}.`);
      case 'ptdir': return tx(`The opposite way to the first turn: ${a}. That is away from the station.`,`Motsatt vei av den første svingen: ${a}. Det er bort fra stasjonen.`);
      case 'basedir': return tx(`Towards the final course: ${a}.`,`Mot sluttkursen: ${a}.`);
      case 'profile': case 'proftime': return tx(`The table gives ${a}. A 3° path loses about 320 ft for every mile.`,`Tabellen gir ${a}. En bane på 3° taper rundt 320 ft for hver nautiske mil.`);
      case 'rod': return tx(`Ground speed × 5 ≈ ${T.gs*5}. The exact figure is ${a}.`,`Fart over bakken × 5 ≈ ${T.gs*5}. Det nøyaktige tallet er ${a}.`);
      case 'rtturn': return tx(`The new course is to your ${sideW(T.ans)}: turn ${sideW(T.ans)}.`,`Den nye kursen ligger til ${sideW(T.ans)} for deg: sving til ${sideW(T.ans)}.`);
      case 'passq': return tx('The flag changes from TO to FROM. The needle also swings before the station, so the needle alone is not enough.','Flagget skifter fra TO til FROM. Nålen slår også ut før stasjonen, så nålen alene er ikke nok.');
      case 'ttsq': return tx('Seconds ÷ degrees: 90 ÷ 10 = 9 minutes.','Sekunder ÷ grader: 90 ÷ 10 = 9 minutter.');
      case 'locq': return tx('From side to side the localiser scale is about 2.5°. A VOR scale is 10°. That is four times.','Fra side til side er localiser-skalaen rundt 2,5°. En VOR-skala er 10°. Det er fire ganger.');
    } return ''; };
  const isTxt=typeof T.opts[0]==='string', answered=ans!==null&&ans!==undefined;
  box.innerHTML=`<h3>${tx('Think first','Tenk først')}</h3><p class="q">${glH(qx,3)}</p><div class="opts">${T.opts.map((v,i)=>`<button type="button" data-i="${i}" class="${isTxt?'txt':''} ${answered?(v===T.ans||v===T.alt?'right':(i===ans?'wrong':'')):''}" ${answered?'disabled':''}>${esc(opt(v))}</button>`).join('')}</div>`+
    (answered?`<p class="fb ${T.opts[ans]===T.ans||T.opts[ans]===T.alt?'':'no'}">${gl((T.opts[ans]===T.ans||T.opts[ans]===T.alt?tx('Right. ','Riktig. '):tx('Not quite. ','Ikke helt. '))+why(),2)}</p>`:'');
  box.querySelectorAll('.opts button').forEach(b=>b.onclick=()=>{ S.thinkAns=+b.dataset.i; renderThink(); renderTbar(); }); }

/* ---------- Debrief ---------- */
function scoreCls(v){ return v>=80?'':v>=55?'mid':'low'; }
function renderDeb(){ const R=S.res, box=el('deb'); if(!R){ box.innerHTML=''; return; }
  const g=R.g, f=g.first, ev=S.J.ev;
  const timeTxt={established:t2('time until you were on the course','tid til du var på kursen'),decision:t2('time to choose a heading towards the course','tid til du valgte heading mot kursen'),answer:t2('time per answer','tid per svar'),arcjoin:t2('turn onto the arc started in time','svingen inn på buen startet i tide'),arcleave:t2('turn off the arc started in time','svingen ut av buen startet i tide'),
    entryleg:t2('entry leg time','tid på inngangslegget'),inleg:t2('time on the leg towards the fix','tid på legget inn mot fiksen'),ptout:t2('outbound time','tid ut'),pt45:t2('time on the first leg','tid på første legg'),baseout:t2('outbound time','tid ut'),descent:t2('descent started at the FAF','nedstigning startet ved FAF'),
    gsdescent:t2('descent started on the glide slope','nedstigning startet på glidebanen'),goaround:t2('go-around started at the minimums','go-around startet ved minima'),wp:t2('waypoints crossed on track','waypoints krysset på sporet'),passrep:t2('passage reported on time','passering rapportert i tide'),dmelim:t2('turn at the DME limit','sving ved DME-grensen')};
  const tk=[...new Set(S.J.times.map(x=>x.k))].map(k=>L(timeTxt[k]||t2(k,k))).join(', ');
  const verdict=R.demo?tx('Demonstration','Demonstrasjon'):g.pass?tx(`Level ${S.lv} passed`,`Nivå ${S.lv} bestått`):tx('Not passed yet','Ikke bestått ennå');
  const sub=R.demo?tx('This is how the instructor flies it. Your turn now.','Slik flyr instruktøren den. Nå er det din tur.'):g.pass?(S.lv<4?tx(`Try level ${S.lv+1}: ${L(W.level[S.lv+1])}.`,`Prøv nivå ${S.lv+1}: ${L(W.level[S.lv+1])}.`):tx('All levels passed.','Alle nivåer bestått.')):tx('To pass you need 75 points or more and no procedure mistake.','For å bestå trenger du 75 poeng eller mer og ingen prosedyrefeil.');
  let card;
  if(f){ const E=EV[f.code]||EV.outside, raw=/^(tts|math)\./.test(f.code), p=pw(f.p,raw);
    let extra=''; if(f.code==='math.wrong'){ const Q=S.X.task.qs[f.p.qi]; if(Q){ const P=mathParams(Q); extra=`<p>${esc(fmt(MATHQ[Q.kind].q,P))}</p><p class="do">${esc(MATHQ[Q.kind].m.map(m=>fmt(m,P)).join(' '))}</p>`; } }
    card=`<div class="mist ${f.sev==='warn'?'warn':''}" id="mistCard" role="button" tabindex="0" aria-label="${esc(tx('Show it on the map','Vis det på kartet'))}"><div class="h"><b>${esc((f.sev==='err'?tx('First mistake: ','Første feil: '):tx('To improve: ','Kan bli bedre: '))+L(E.h))}</b><span>${mmss(f.t)}</span></div><p>${gl(fmt(E.w,p),2,GSKIP)}</p>${extra||(L(E.d)?`<p class="do">${gl(fmt(E.d,p),2,GSKIP)}</p>`:'')}</div>`; }
  else card=`<div class="mist clean"><div class="h"><b>${tx('Clean run','Ren runde')}</b><span>${mmss(S.sim.t)}</span></div><p>${esc(S.ex==='math'?tx('Every answer right.','Alle svar riktige.'):tx('No mistakes. The dashed line is the instructor’s path: compare it with yours.','Ingen feil. Den stiplede linjen er instruktørens bane: sammenlign den med din.'))}</p></div>`;
  const others=ev.filter(e=>e!==f&&e.sev!=='info'&&!/\.(ok|entryok)$/.test(e.code)).slice(0,5);
  const help=R.demo?'':S.help==='guided'?tx('Flown with Guided help.','Fløyet med veiledning.'):S.help==='hints'?tx(`Flown with hints: ${S.hintsUsed} used.`,`Fløyet med hint: ${S.hintsUsed} brukt.`):tx('Flown on your own.','Fløyet på egen hånd.');
  box.innerHTML=`<div class="res"><div class="tot">${g.total}<small>/100</small></div><div class="verdict ${g.pass||R.demo?'':'no'}">${esc(verdict)}</div><div class="sub">${esc(sub)} ${esc(help)}</div></div>
    <div class="bars">
      <span>${tx('Accuracy','Nøyaktighet')}</span><div class="b"><i class="${scoreCls(g.acc)}" style="width:${g.acc}%"></i></div><b>${g.acc}</b><em>${esc(tx('How much of the time you were inside the limits, and how far outside','Hvor mye av tiden du var innenfor grensene, og hvor langt utenfor'))}</em>
      <span>${tx('Timing','Timing')}</span><div class="b"><i class="${scoreCls(g.time??100)}" style="width:${g.time??0}%"></i></div><b>${g.time===null?'–':g.time}</b><em>${esc(tk||tx('No timing items in this exercise','Ingen tidskrav i denne øvelsen'))}</em>
      <span>${tx('Procedure','Prosedyre')}</span><div class="b"><i class="${scoreCls(g.proc)}" style="width:${g.proc}%"></i></div><b>${g.proc}</b><em>${esc(tx('The right direction, entry, order and altitudes','Riktig retning, inngang, rekkefølge og høyder'))}</em>
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
  if(k.indexOf('cdi')>=0) GA.cdi.set({obs,dots:r.flag?r.dots:0,flag:r.flag||'OFF',ils:r.ils,gsValid:!!r.gsOk,gsDots:r.gsDots||0,gsHide:!r.ils});
  if(k.indexOf('hsi')>=0) GA.hsi.set({hdg:s.hdg,crs:obs,hsiDots:r.hsiDots||0,flag:r.flag||'OFF',ils:r.ils,gsValid:!!r.gsOk,gsDots2:clamp((r.gsDots||0)*0.4,-2.4,2.4),bug});
  if(k.indexOf('rmi')>=0) GA.rmi.set({hdg:s.hdg,qdmV:r.qdmV||0,qdmA:r.qdmA||0,vorOk:!!r.vorOk&&!r.ils,adfOk:!!r.adfOk,vorHide:!(X.nav&&A().ST[X.nav]&&A().ST[X.nav].type==='VOR'),adfHide:!X.adf});
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
  if(S.ex==='holdEntry'){ const F=I.fixOf(Ar,X.task), R=Math.min(4,(S.step==='fly'?70:80)/map.v.k)*map.v.k+4; map.P(F.x,F.y); map.reserve(map.sx-R,map.sy-R,2*R,2*R); }
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
        const lab=`${tx('Turn','Sving')} ${turnW(nt.dir)} ${d3(nt.h)}`; g.font=`600 12px ${FB}`; const w=g.measureText(lab).width+12, mx=map.sx, my=map.sy;
        /* keep clear of: the marker, the aircraft, and (holding entry) the sector disc round the fix */
        const keep=[[mx,my,13]]; map.P(S.sim.x,S.sim.y); keep.push([map.sx,map.sy,20]);
        if(S.ex==='holdEntry'||S.ex==='hold'){ const F=I.fixOf(Ar,T); map.P(F.x,F.y); keep.push([map.sx,map.sy,S.ex==='holdEntry'?Math.min(4,70/map.v.k)*map.v.k+8:14]); }
        let best=null; for(const dist of [22,40,64,96]){ for(let k=0;k<8;k++){ const an=(-45+k*45)*D2R, cx=mx+Math.sin(an)*(dist+w/2*Math.abs(Math.sin(an))), cy=my-Math.cos(an)*(dist+10*Math.abs(Math.cos(an))), lx=cx-w/2, ly=cy-10;
            if(lx<8||ly<8||lx+w>MW-8||ly+20>MH-8) continue; let bad=0; for(const [kx,ky,kr] of keep){ const nx=clamp(kx,lx,lx+w), ny=clamp(ky,ly,ly+20); if(Math.hypot(kx-nx,ky-ny)<kr) bad++; }
            if(!bad){ best=[lx,ly,cx,cy]; break; } } if(best) break; }
        if(!best) best=[clamp(mx+16,8,MW-w-8),clamp(my-30,8,MH-28),mx+16+w/2,my-20];
        const [lx,ly,lcx,lcy]=best; g.strokeStyle='rgba(127,224,255,.6)'; g.lineWidth=1; g.beginPath(); const la=Math.atan2(lcy-my,lcx-mx); g.moveTo(mx+Math.cos(la)*10,my+Math.sin(la)*10); g.lineTo(clamp(mx,lx,lx+w),clamp(my,ly,ly+20)); g.stroke();
        g.fillStyle='rgba(9,13,17,.92)'; map.rrect(g,lx,ly,w,20,3); g.fill(); g.strokeStyle=COL.tgt; g.lineWidth=1; map.rrect(g,lx,ly,w,20,3); g.stroke(); g.fillStyle=COL.tgt; g.textAlign='left'; g.textBaseline='middle'; g.fillText(lab,lx+6,ly+10.5); } }
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
function drawLesson(g){ const X=S.X, Ar=A(), T=X.task, u=S.u||{x:X.ac.x,y:X.ac.y,hdg:X.ac.hdg}, st=Ar.ST[T.st||X.nav]; const steps=uSteps(), cur=steps[S.uStep]||{}, show0=cur.show||(uwFor(S.item)[0]||{}).show||'', has=k=>(' '+show0+' ').indexOf(' '+k+' ')>=0;
  if(S.step==='think'){ map.drawAircraft(g,X.ac.x,X.ac.y,X.ac.hdg,{size:15}); return; }
  if(has('radials')&&st){ g.font=`500 10.5px ${FM}`; for(let a=0;a<360;a+=30){ const p=I.at(st,a,30); line(map,g,st,p,'rgba(99,217,160,.22)',1); const lp=I.at(st,a,11); map.P(lp.x,lp.y); g.fillStyle='rgba(99,217,160,.75)'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('R'+d3(a),map.sx,map.sy); }
    const rad=N.radial(st,u); line(map,g,st,I.at(st,rad,Math.hypot(u.x-st.x,u.y-st.y)+6),COL.vor,2.4); }
  if(has('brg')&&st){ line(map,g,u,st,'rgba(245,188,76,.8)',1.8,[5,4]); }
  if((has('wedge')||has('arrows'))&&st&&T.crs!==undefined){ const crs=S.ex==='trackIn'||S.ex==='intIn'||S.ex==='pass'||S.ex==='ndb'?norm(T.crs+180):T.crs;
    g.fillStyle='rgba(240,107,180,.10)'; g.beginPath(); map.P(st.x,st.y); g.moveTo(map.sx,map.sy); for(let a=-10;a<=10;a+=2){ const p=I.at(st,crs+a,30); map.P(p.x,p.y); g.lineTo(map.sx,map.sy); } g.closePath(); g.fill(); }
  if(has('arrows')&&st&&T.crs!==undefined){ const l=I.lineRel(st,T.crs,u); for(const [ang,col] of (T.ang?[[T.ang,'#E6EBEF']]:[[30,'#E6EBEF'],[45,'rgba(230,235,239,.55)']])){ const hh=I.interceptHdg(T.crs,l.xt,ang), p=I.at(u,hh,3.2); line(map,g,u,p,col,1.6,[4,4]); map.P(p.x,p.y); map.arrowHead(g,map.sx,map.sy,map.sa(hh),7,col); map.label(map.sx,map.sy,d3(hh)+' ('+ang+'°)',col); } }
  if(has('homing')&&st){ const w=X.wind.spd?X.wind:{dir:norm(T.crs+90),spd:25}; let p={x:X.ac.x,y:X.ac.y}; g.strokeStyle='rgba(245,188,76,.9)'; g.lineWidth=2; g.setLineDash([6,5]); g.beginPath(); map.P(p.x,p.y); g.moveTo(map.sx,map.sy);
    for(let i=0;i<900;i++){ const b=N.bearing(st.x-p.x,st.y-p.y), wt=N.windTriangle(120,b,w.dir,w.spd); p.x+=wt.vx/3600*2; p.y+=wt.vy/3600*2; map.P(p.x,p.y); g.lineTo(map.sx,map.sy); if(Math.hypot(st.x-p.x,st.y-p.y)<0.3) break; } g.stroke(); g.setLineDash([]); }
  if(has('arc')&&st&&T.R){ g.strokeStyle='rgba(240,107,180,.35)'; g.lineWidth=1; map.P(st.x,st.y); g.beginPath(); g.arc(map.sx,map.sy,T.R*map.v.k,0,TAU); g.stroke(); line(map,g,u,st,'rgba(99,217,160,.6)',1.4,[3,4]); }
  if(has('sectors')){ drawSectors(map,g,I.fixOf(Ar,T),T.inb,T.dir,Math.min(4,80/map.v.k)); }
  if(cur.try){ if(S.ideal) drawIdeal(g,0.35); }
  else if(S.ideal&&S.useg){ drawIdeal(g,0.28); const P=S.ideal, a=S.useg.i0; g.save(); g.strokeStyle='rgba(127,224,255,.95)'; g.lineWidth=2.6; g.lineCap='round'; g.beginPath(); map.P(P[a].x,P[a].y); g.moveTo(map.sx,map.sy);
    for(let i=a+1;i<=S.useg.i1&&P[i].t<=(u.t||Infinity);i++){ map.P(P[i].x,P[i].y); g.lineTo(map.sx,map.sy); } map.P(u.x,u.y); g.lineTo(map.sx,map.sy); g.stroke(); g.restore(); }
  map.drawAircraft(g,u.x,u.y,u.hdg,{size:16,ring:!!cur.try,handle:!!cur.try});
  const live=el('uLive'); if(live) live.innerHTML=lessonLive(u,readNow()); }
function lessonLive(u,r){ const X=S.X, T=X.task, Ar=A(), st=Ar.ST[T.st||X.nav];
  switch(S.ex){
    case 'orient': return T.kind==='rbi'?`${tx('Heading','Heading')} <b>${d3(u.hdg)}</b> + ${tx('needle','nål')} <b>${Math.round(norm(r.rb))}°</b> = <b>${d3(r.qdmA)}</b>`:`${tx('You are on radial','Du er på radial')} <b>${d3(N.radial(st,u))}</b> · ${tx('heading','heading')} ${d3(u.hdg)}`;
    case 'holdEntry': { const e=H.entry(T.inb,T.dir,u.hdg); return `${tx('Heading','Heading')} <b>${d3(u.hdg)}</b> → <b>${esc(L(W.entry[e.entry]))}</b> ${tx('entry','inngang')}${e.alt?` ${tx('(or','(eller')} ${esc(L(W.entry[e.alt]))})`:''}`; }
    case 'ndb': return `${tx('Needle','Nål')} <b>${Math.round(diff(r.rb,0))>0?'+':''}${Math.round(diff(r.rb,0))}°</b> ${tx('from the nose','fra nesen')} · ${tx('heading + needle = bearing to the beacon','heading + nål = peiling til fyret')} <b>${d3(r.qdmA)}</b>`;
    case 'ndbOut': return `${tx('Bearing from the beacon','Peiling fra fyret')} <b>${d3(norm(r.qdmA+180))}</b> · ${tx('you want','du vil ha')} <b>${d3(T.crs)}</b>`;
    case 'intIn': case 'intOut': if(T.ndb) return S.ex==='intIn'?`${tx('Bearing to the beacon','Peiling til fyret')} <b>${d3(r.qdmA)}</b> · ${tx('you want','du vil ha')} <b>${d3(T.crs)}</b>`:`${tx('Bearing from the beacon','Peiling fra fyret')} <b>${d3(norm(r.qdmA+180))}</b> · ${tx('you want','du vil ha')} <b>${d3(T.crs)}</b>`;
      return lessonLiveVor(u,r);
    case 'hold': return T.kind==='ndb'?`${tx('Bearing to the beacon','Peiling til fyret')} <b>${d3(r.qdmA)}</b> · ${tx('heading','heading')} <b>${d3(u.hdg)}</b>`:lessonLiveVor(u,r);
    case 'dme': return `DME <b>${nf1(r.dme)}</b> NM · ${tx('the arc is at','buen ligger på')} <b>${T.R}</b> · ${tx('radial','radial')} <b>${d3(N.radial(st,u))}</b>`;
    case 'tts': return `${tx('Radial','Radial')} <b>${d3(r.radial||0)}</b> · DME <b>${nf1(r.dme)}</b>`;
    case 'ils': case 'locInt': return `${tx('Localiser','Localiser')} <b>${nf1(Math.abs(r.dots))}</b> ${tx('dots','prikker')} ${r.dots>0.05?tx('right','til høyre'):r.dots<-0.05?tx('left','til venstre'):''}${S.ex==='ils'?` · ${tx('glide slope','glidebane')} <b>${r.gsOk?nf1(Math.abs(r.gsDots))+' '+(r.gsDots>0.05?tx('above you','over deg'):r.gsDots<-0.05?tx('below you','under deg'):''):'—'}</b>`:''} · ${Math.round(u.alt/10)*10} ft`;
    case 'sid': case 'star': return `${Math.round(u.alt/10)*10} ft · ${tx('heading','heading')} ${d3(u.hdg)}`;
    case 'math': return '';
    default: if(isApp(S.ex)) return `${Math.round(u.alt/10)*10} ft${r.dme!=null?` · ${nf1(r.dme)} NM`:''}`;
      return lessonLiveVor(u,r);
  } }
function lessonLiveVor(u,r){ const d=r.dots||0; if(!r.flag||r.flag==='OFF') return `${tx('heading','heading')} <b>${d3(u.hdg)}</b>`;
  return `${tx('Flag','Flagg')} <b>${r.flag}</b> · ${Math.abs(d)<0.15?tx('needle <b>centred</b>','nålen <b>i midten</b>'):`${tx('needle','nål')} <b>${nf1(Math.abs(d))}</b> ${tx(Math.abs(d)<1.05&&Math.abs(d)>0.95?'dot':'dots','prikker')} ${d>0?tx('right','til høyre'):tx('left','til venstre')}`} · ${tx('course set','kurs stilt inn')} <b>${d3(u.obs!==undefined?u.obs:S.X.obs)}</b>`; }

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
  if(S.ex==='math'&&S.step!=='fly') { el('mathcard').hidden=false; if(S.step==='understand'||S.step==='debrief'){ el('mathcard').innerHTML=`<h3>${tx('Rules of thumb','Tommelfingerregler')}</h3><ol>${mathRules(S.item).map(m=>`<li>${gl(L(m),2)}</li>`).join('')}</ol>`; } }
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
  else { if(bDirty&&el('bldDlg').open) drawBPrev(); heroDraw(ts); }
  requestAnimationFrame(loop); }

/* ---------- start ---------- */
LAB.start('ifr');
LAB.add({},{'Birdbird · Training':'Birdbird · Trening','IFR trainer':'IFR-trener','Training only · not for navigation':'Kun trening · ikke for navigasjon',
  'What the trainer models':'Hva treneren modellerer','Limits and tolerances':'Grenser og toleranser','Real and practice data':'Ekte data og øvingsdata',
  'All exercises':'Alle øvelser','Start here':'Start her'});
LAB.tx({n1:'Standardsvinger (høyst 25° krengning), stigning og sink til valgt høyde med valgt rate, sann fart som øker rundt 2 % per 1000 ft, og vind som er jevn eller byget og skiftende. Kursmarkøren virker som en enkel autopilot: flyet svinger mot den, samme vei som du vred den. Misvisningen er satt til null, så kart og instrumenter stemmer.',
  n2:'Poengene bruker grensene fra EASA IR-ferdighetsprøven: ±100 ft, kurs innenfor ±5°, halvt utslag på ILS, LOC og RNP, aldri under MDA. Holding følger ICAO PANS-OPS: høyresvinger om ikke annet er sagt, legg på 1 minutt til og med 14 000 ft, innganger bestemt av kurs med 5° slingringsmonn på hver side av en sektorlinje. Prosedyresvinger bruker Cat A/B-tiden på 1 minutt.',
  n3:'Bergen og Oslo bruker ekte posisjoner og frekvenser for navigasjonshjelpemidler (OurAirports), kun for trening. Prosedyrene som flys der er illustrasjoner, ikke publiserte kart. Øvingsområdet er fiktivt: Holmvik, Kvist, Fjell, Ravn, Holm og HV-waypointene finnes ikke. Bruk aldri treneren til navigasjon.'});
LAB.onLang(()=>{ quizKey=''; guideKey=''; glClose(); HERO.cap=''; if(document.body.classList.contains('v-trainer')) renderAll(); else { renderHome(); if(el('bldDlg').open) renderBld(); } });
S.seed=Math.floor(Math.random()*9000)+1; S.item='orient'; S.ex='orient'; S.p=Object.assign({},I.ITEM.orient.p); setup();
renderHome(); heroInit();
/* deep link: ifr.html?ex=<item id> opens that exercise directly (same as ifr.html#<id>); unknown ids fall back to the start screen */
{ const qx=(location.search.match(/[?&]ex=([A-Za-z0-9_]+)/)||[])[1]; if(qx&&I.ITEM[qx]) history.replaceState(null,'',location.pathname+'#'+qx); }
addEventListener('popstate',route); addEventListener('hashchange',route); route();
new ResizeObserver(()=>{ layoutInst(); }).observe(el('inst'));
new ResizeObserver(()=>{ sizeMap(); }).observe(mapC);
new ResizeObserver(()=>{ sizeProf(); }).observe(profC);
new ResizeObserver(()=>{ sizeTl(); }).observe(tlC);
let rzT=0; addEventListener('resize',()=>{ clearTimeout(rzT); rzT=setTimeout(()=>{ if(!document.body.classList.contains('v-trainer')){ if(el('bldDlg').open) bPrev(); } else renderCtl&&S.step==='fly'&&renderCtl(); },150); });
requestAnimationFrame(loop);
/* test hooks (used by the browser tests) */
window.__IFR={S,I,setup,go,start,finish,report,setCtl,act,AREAS,openItem,showHome,map,BLD,bldSet,startBuilder,bVals,hintMore,resumePause,action:()=>action(),
  IT,UW,CO,EV,GLO,CORE,gl,theoryOf,uSteps:()=>uSteps(),setUStep,coachTxt:()=>coachTxt(),whyTxt:()=>whyTxt(),clearance:()=>clearance(S.X,A(),S.ex),plain:()=>plain(S.X,A(),S.ex),lessonLive:()=>lessonLive(S.u,readNow()),fmt,pw,
  /* a scripted student who does exactly what the guide says (the guide's command applied every tick) */
  followGuide(sec){ const end=S.sim.t+sec; let pauses=0; while(S.run&&S.step==='fly'&&S.sim.t<end){ if(S.pause){ pauses++; resumePause(); } const c=S.gc; if(c){ if(c.act) S.pendingAct=c.act; else if(S.ex==='orient'&&c.ans&&S.sim.t-(S._lr||-9)>4&&Math.abs(diff(S.X.obs,c.obs))<1){ S.pendingAct={type:'report',val:c.ans}; S._lr=S.sim.t; } I.apply(S.sim,S.X,c); } tick(0.1); } return pauses; },
  advance(sec){ const end=S.sim.t+sec; while(S.run&&S.step==='fly'&&S.sim.t<end){ if(S.pause) resumePause(); tick(0.1); } }};
})();
