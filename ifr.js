/* Birdbird – ifr.js: the IFR trainer page (ifr.html).
   Four steps per exercise: Understand (one interactive picture, two or three sentences), Think first (one question that
   builds the mental picture), Fly (instruments left, plan view right, a coach that says why), Debrief (score, the first
   mistake marked on the replay and on the timeline, what to do instead, the ideal path for comparison).
   All geometry, the flight model, the judges and the scripted pilot live in ifrcore.js (pure, tested in tests/ifr.test.mjs).
   Instruments: navgauges.js (CDI, HSI, RMI, ADF as a fixed-card RBI, heading indicator) and a glass PFD drawn here.
   Map: navmap.js (shared look with the radio navigation and holding labs). Strings EN/NO through LAB.L.
   Training model, not for navigation. */
(function(){
'use strict';
const N=window.NAVCORE, H=window.HOLDCORE, I=window.IFRCORE, NM=window.NAVMAP, {L,el}=LAB;
const t2=(en,no)=>({en,no});
const D2R=Math.PI/180, R2D=180/Math.PI, TAU=Math.PI*2, norm=N.norm, diff=N.diff, clamp=N.clamp, d3=N.d3;
const FM='"IBM Plex Mono", ui-monospace, monospace', FB='"Public Sans", system-ui, sans-serif', FD='Archivo, "Public Sans", system-ui, sans-serif';
const COL=Object.assign({},NM.COL,{crs:'#F06BB4',crs2:'rgba(240,107,180,.55)',ideal:'#7FCBE8',trail:'rgba(255,255,255,.78)',good:'#63D9A0',mid:'#F0B440',bad:'#EF6450',
  direct:'#71CC93',parallel:'#7FCBE8',teardrop:'#F0B440',bug:'#57C7F5',adf:'#F5BC4C'});
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const no=()=>LAB.lang==='no';
const nf1=v=>Number.isFinite(v)?v.toLocaleString(no()?'nb-NO':'en-GB',{minimumFractionDigits:1,maximumFractionDigits:1}):'–';
const mmss=t=>{ t=Math.max(0,Math.round(t)); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); };

/* ---------- words ---------- */
const W={
  side:{R:t2('right','høyre'),L:t2('left','venstre')},
  entry:{direct:t2('direct','direkte'),parallel:t2('parallel','parallell'),teardrop:t2('teardrop','teardrop'),unclear:t2('unclear','uklar')},
  inst:{cdi:'CDI',rmi:'RMI',rbi:'RBI',hsi:'HSI',pfd:'PFD'},
  group:{radials:t2('Radials','Radialer'),track:t2('Tracking','Følge kurs'),intercept:t2('Intercepts','Interception'),ndb:t2('NDB','NDB'),arc:t2('DME arc','DME-bue'),hold:t2('Holding','Holding'),pt:t2('Procedure turns','Prosedyresvinger'),app:t2('Approaches','Innflyginger')},
  level:[null,t2('Map, no wind','Kart, ingen vind'),t2('Map and wind','Kart og vind'),t2('Map hidden','Skjult kart'),t2('Hidden map, gusty hidden wind','Skjult kart, skjult byget vind')],
  area:{practice:t2('Practice','Øving'),bergen:t2('Bergen','Bergen'),oslo:t2('Oslo','Oslo')}
};
const sideW=s=>L(W.side[s]||W.side.R), dirW=d=>sideW(d>0||d==='R'?'R':'L');
/* scan hint per instrument: the procedure stays, the scan changes */
const SCAN={cdi:t2('Scan: needle, then the heading indicator','Skann: nålen, så kursindikatoren'),rmi:t2('Scan: the needle head points to the station, the tail is your radial','Skann: nålhodet peker mot stasjonen, halen er radialen din'),
  rbi:t2('Scan: heading + needle = bearing to the station','Skann: kurs + nål = peiling til stasjonen'),hsi:t2('Scan: one picture, the course bar against the aircraft','Skann: ett bilde, kursstreken mot flyet'),
  pfd:t2('Scan: attitude in the centre, navigation below','Skann: attityde i midten, navigasjon under')};

/* exercise texts: name, one-line goal, Understand (headline, 2–3 sentences, what to try) */
const EXT={
 orient:{n:t2('Orientation','Orientering'),g:t2('Which radial am I on?','Hvilken radial er jeg på?'),
  u:{h:t2('A radial is where you are from the station.','En radial er hvor du er fra stasjonen.'),
   p:[t2('A VOR sends 360 radials like the spokes of a wheel. Your radial depends only on where you are, never on where you point.','En VOR sender 360 radialer som eikene i et hjul. Radialen din avhenger bare av hvor du er, aldri av hvor du peker.'),
      t2('Turn the OBS until the needle centres with a FROM flag: the number at the top is your radial. On the RMI it is the tail of the needle.','Vri OBS til nålen står midt med FROM-flagg: tallet øverst er radialen din. På RMI er det halen av nålen.')],
   tr:t2('Drag the aircraft around the station, and turn it with the handle. The radial only changes when you move.','Dra flyet rundt stasjonen, og snu det med håndtaket. Radialen endrer seg bare når du flytter flyet.')}},
 trackIn:{n:t2('Track inbound','Følge kurs inn'),g:t2('Fly to the station on a course','Fly til stasjonen på en kurs'),
  u:{h:t2('The needle points to the course, not to the aircraft.','Nålen peker mot kursen, ikke mot flyet.'),
   p:[t2('Set the course you want to fly. Flying towards the station the flag shows TO.','Still inn kursen du vil fly. Når du flyr mot stasjonen, viser flagget TO.'),
      t2('Needle right: the course is to your right. Turn towards the needle, then find the heading that keeps it still.','Nål til høyre: kursen ligger til høyre. Sving mot nålen, og finn så kursen som holder den i ro.')],
   tr:t2('Drag the aircraft across the course. Inside the pink wedge the needle moves; outside it the needle is pinned at full scale.','Dra flyet over kursen. Inne i den rosa kilen beveger nålen seg; utenfor står den fast på fullt utslag.')}},
 trackOut:{n:t2('Track outbound','Følge kurs ut'),g:t2('Fly away from the station on a radial','Fly fra stasjonen på en radial'),
  u:{h:t2('Outbound, the same rule: set the course you fly.','Utgående gjelder samme regel: still inn kursen du flyr.'),
   p:[t2('Flying away with the radial set, the flag shows FROM and the needle still points to the course.','Når du flyr ut med radialen innstilt, viser flagget FROM, og nålen peker fortsatt mot kursen.'),
      t2('Wind shows up as a slow drift. When the heading that keeps the needle still differs from the course, that difference is your wind correction.','Vind viser seg som en langsom avdrift. Når kursen som holder nålen i ro er forskjellig fra kursen du skal følge, er forskjellen vindkorreksjonen din.')],
   tr:t2('Drag the aircraft to either side of the radial and watch the needle.','Dra flyet til hver side av radialen og se på nålen.')}},
 intIn:{n:t2('Intercept inbound','Interception inn'),g:t2('Join a course to the station','Komme inn på en kurs mot stasjonen'),
  u:{h:t2('Intercept: the course plus 30° to 45°, towards the needle.','Interception: kursen pluss 30° til 45°, mot nålen.'),
   p:[t2('The needle tells you which side the course is on. Point 30° to 45° across it.','Nålen forteller hvilken side kursen ligger på. Pek 30° til 45° inn mot den.'),
      t2('The needle stays at full scale until you are within 10°. When it starts to move, start the turn onto the course.','Nålen står på fullt utslag til du er innenfor 10°. Når den begynner å bevege seg, starter du svingen inn på kursen.')],
   tr:t2('Move the aircraft. The two arrows are the 30° and 45° intercept headings from where you are.','Flytt flyet. De to pilene er interceptkursene på 30° og 45° fra der du er.')}},
 intOut:{n:t2('Intercept outbound','Interception ut'),g:t2('Join a radial away from the station','Komme inn på en radial ut fra stasjonen'),
  u:{h:t2('Close to the station, the needle moves fast.','Nær stasjonen beveger nålen seg fort.'),
   p:[t2('Near the station one degree is only a few hundred metres, so the needle comes off the stop quickly.','Nær stasjonen er én grad bare noen hundre meter, så nålen slipper fort fra stoppen.'),
      t2('Set the radial, check FROM, turn 45° towards the needle, and start the turn onto the radial as soon as the needle moves.','Still inn radialen, sjekk FROM, sving 45° mot nålen, og start svingen inn på radialen så snart nålen beveger seg.')],
   tr:t2('Move the aircraft closer and further away: the pink wedge shows how narrow the needle range gets.','Flytt flyet nærmere og lenger unna: den rosa kilen viser hvor smalt nålens område blir.')}},
 ndb:{n:t2('NDB tracking','NDB-tracking'),g:t2('Homing versus tracking in wind','Homing mot tracking i vind'),
  u:{h:t2('Homing bends. Tracking holds a heading into the wind.','Homing bøyer av. Tracking holder en kurs opp mot vinden.'),
   p:[t2('The ADF needle always points at the beacon. Keep it on the nose in a crosswind and the wind bends your path into a curve: that is homing.','ADF-nålen peker alltid mot fyret. Holder du den på nesen i sidevind, bøyer vinden banen din til en kurve: det er homing.'),
      t2('To track, turn into the wind until the needle sits a few degrees off the nose, on the downwind side. Heading plus needle is the bearing to the beacon.','For å tracke svinger du opp mot vinden til nålen står noen grader fra nesen, på lesiden. Kurs pluss nål er peilingen til fyret.')],
   tr:t2('Move the aircraft. The amber curve is homing in this wind; the green line is the track you want.','Flytt flyet. Den gule kurven er homing i denne vinden; den grønne linjen er sporet du vil ha.')}},
 dme:{n:t2('DME arc','DME-bue'),g:t2('Join an arc, fly it, leave it for a radial','Inn på buen, fly den, ut på en radial'),
  u:{h:t2('On an arc, the station stays on your wingtip.','På en bue står stasjonen på vingetippen.'),
   p:[t2('Fly 90° to the radial. Flying straight, the station slides behind the wingtip and the DME grows: turn about 10° towards the station.','Fly 90° på radialen. Flyr du rett frem, glir stasjonen bak vingetippen og DME-en øker: sving rundt 10° mot stasjonen.'),
      t2('Join the arc one turn radius early, and leave it at a lead radial a few degrees before the one you want.','Gå inn på buen én svingradius før, og forlat den på en ledende radial noen grader før den du skal ha.')],
   tr:t2('Drag the aircraft around the arc: on the RMI the needle stays at the wingtip when you fly it right.','Dra flyet rundt buen: på RMI står nålen ved vingetippen når du flyr den riktig.')}},
 holdEntry:{n:t2('Holding entry','Inngang til holding'),g:t2('Direct, parallel or teardrop','Direkte, parallell eller teardrop'),
  u:{h:t2('Your heading at the fix picks the entry.','Kursen din over fiksen bestemmer inngangen.'),
   p:[t2('Draw the 70° line through the fix on the holding side. Direct covers half the circle, parallel 110° and teardrop 70°.','Tegn 70°-linjen gjennom fiksen på holdingsiden. Direkte dekker halve sirkelen, parallell 110° og teardrop 70°.'),
      t2('Within 5° of a sector line, either entry is fine.','Innenfor 5° av en sektorlinje er begge innganger greit.')],
   tr:t2('Drag the aircraft around the fix: it points at the fix, and the colour under it is the entry. Turn it with the handle to try any heading.','Dra flyet rundt fiksen: det peker mot fiksen, og fargen under det er inngangen. Snu det med håndtaket for å prøve en hvilken som helst kurs.')}},
 hold:{n:t2('Holding pattern','Holdingmønster'),g:t2('Wind correction and timing','Vindkorreksjon og timing'),
  u:{h:t2('Fly the inbound leg to learn the wind.','Fly inngående legg for å lære vinden.'),
   p:[t2('Outbound heading: three times the inbound correction, the other way. Start the clock abeam the fix, or when the turn is complete if that is later.','Utgående kurs: tre ganger den inngående korreksjonen, motsatt vei. Start klokken tvers av fiksen, eller når svingen er ferdig hvis det er senere.'),
      t2('If the inbound leg is shorter than 1 minute, fly longer outbound next time, and the other way round.','Er inngående legg kortere enn 1 minutt, flyr du lenger ut neste gang, og omvendt.')],
   tr:t2('The dashed shape is the hold flown in this wind. Move the aircraft to see the instruments at any point.','Den stiplede formen er holdingen fløyet i denne vinden. Flytt flyet for å se instrumentene hvor som helst.')}},
 pt:{n:t2('Procedure turn 45°/180°','Prosedyresving 45°/180°'),g:t2('Turn around to the final course','Snu inn mot sluttkursen'),
  u:{h:t2('Out, 45° away, then 180° back the other way.','Ut, 45° vekk, så 180° tilbake den andre veien.'),
   p:[t2('Overfly the station, fly outbound for the published time, then turn 45° to the side on the chart and fly 1 minute.','Overfly stasjonen, fly ut den publiserte tiden, sving så 45° til siden på kartet og fly 1 minutt.'),
      t2('Then turn 180° the opposite way. You roll out at 45° to the inbound course and intercept it.','Sving så 180° motsatt vei. Du ruller ut 45° på inngående kurs og fanger den.')],
   tr:t2('The dashed shape is the turn flown in this wind. Move the aircraft to see what the needle shows on each leg.','Den stiplede formen er svingen fløyet i denne vinden. Flytt flyet for å se hva nålen viser på hver legg.')}},
 base:{n:t2('Base turn','Base turn'),g:t2('One big turn onto final','Én stor sving inn på finalen'),
  u:{h:t2('Slightly off the reciprocal, then one big turn.','Litt til siden for motsatt kurs, så én stor sving.'),
   p:[t2('Fly outbound on the published radial. It is offset from the final course by about 36° divided by the outbound minutes.','Fly ut på den publiserte radialen. Den er forskjøvet fra sluttkursen med omtrent 36° delt på antall minutter ut.'),
      t2('When the time is up, turn towards the final course, through more than 180°, and intercept it.','Når tiden er ute, svinger du mot sluttkursen, mer enn 180°, og fanger den.')],
   tr:t2('The dashed shape is the base turn in this wind. Move the aircraft along it.','Den stiplede formen er base turn i denne vinden. Flytt flyet langs den.')}},
 vordme:{n:t2('VOR/DME approach','VOR/DME-innflyging'),g:t2('Descend on the profile to the MDA','Sink på profilen til MDA'),
  u:{h:t2('Descend on the profile and check it every mile.','Sink på profilen og sjekk den hver mil.'),
   p:[t2('Stay at the FAF altitude until the final approach fix. Then descend at about ground speed × 5 feet per minute.','Bli på FAF-høyden til final approach fix. Sink så med omtrent fart over bakken × 5 fot i minuttet.'),
      t2('Every DME has an altitude in the table: compare, then change the rate a little. The MDA is a floor, never below it.','Hver DME har en høyde i tabellen: sammenlign, og juster raten litt. MDA er et gulv, aldri under.')],
   tr:t2('The strip under the map is the profile. Drag the aircraft there to move it up and down.','Stripen under kartet er profilen. Dra flyet der for å flytte det opp og ned.')}},
 ils:{n:t2('ILS approach','ILS-innflyging'),g:t2('Localiser and glide slope to the DA','Localiser og glidebane til DA'),
  u:{h:t2('Two needles: left and right, up and down.','To nåler: venstre og høyre, opp og ned.'),
   p:[t2('The localiser is about four times as sensitive as a VOR: full scale is about 2.5°. Small heading changes, early.','Localiseren er omtrent fire ganger så følsom som en VOR: fullt utslag er rundt 2,5°. Små kursendringer, tidlig.'),
      t2('Take the glide slope from below: hold altitude until the needle comes down to the centre, then descend at about ground speed × 5.','Ta glidebanen nedenfra: hold høyden til nålen kommer ned til midten, og sink så med omtrent fart over bakken × 5.')],
   tr:t2('Drag the aircraft on the map and in the profile strip.','Dra flyet på kartet og i profilstripen.')}}
};

/* clearances, in plain ATC phrasing (callsign Student 12) */
function clearance(X,A){ const T=X.task, id=S.ex, st=A.ST[T.st||T.ils], c={en:'',no:''};
  const cs='Student 12, ';
  const alt=a=>`${Math.round(a)} ft`;
  switch(id){
    case 'orient': { const k=(S.J&&S.J.qi||0)+1; c.en=`${cs}report your radial from ${st.id}. Position ${k} of 3.`; c.no=`${cs}rapporter radialen din fra ${st.id}. Posisjon ${k} av 3.`; break; }
    case 'trackIn': c.en=`${cs}track inbound to ${st.id} on course ${d3(T.crs)}, maintain ${alt(T.alt)}.`; c.no=`${cs}følg kurs ${d3(T.crs)} inn til ${st.id}, hold ${alt(T.alt)}.`; break;
    case 'trackOut': c.en=`${cs}track outbound from ${st.id} on radial ${d3(T.crs)} to ${T.to} DME, maintain ${alt(T.alt)}.`; c.no=`${cs}følg radial ${d3(T.crs)} ut fra ${st.id} til ${T.to} DME, hold ${alt(T.alt)}.`; break;
    case 'intIn': c.en=`${cs}intercept course ${d3(T.crs)} inbound to ${st.id}, maintain ${alt(T.alt)}.`; c.no=`${cs}fang kurs ${d3(T.crs)} inn til ${st.id}, hold ${alt(T.alt)}.`; break;
    case 'intOut': c.en=`${cs}intercept radial ${d3(T.crs)} outbound from ${st.id}, maintain ${alt(T.alt)}.`; c.no=`${cs}fang radial ${d3(T.crs)} ut fra ${st.id}, hold ${alt(T.alt)}.`; break;
    case 'ndb': c.en=`${cs}track inbound to ${st.id} on QDM ${d3(T.crs)}, maintain ${alt(T.alt)}.`; c.no=`${cs}følg QDM ${d3(T.crs)} inn til ${st.id}, hold ${alt(T.alt)}.`; break;
    case 'dme': c.en=`${cs}track outbound radial ${d3(T.r0)}, join the ${T.R} DME arc ${T.dir>0?'clockwise':'anticlockwise'}, intercept radial ${d3(T.r1)} inbound.`;
      c.no=`${cs}følg radial ${d3(T.r0)} ut, gå inn på ${T.R} DME-buen ${T.dir>0?'med klokka':'mot klokka'}, fang radial ${d3(T.r1)} inn.`; break;
    case 'holdEntry': case 'hold': { const turns=T.dir>0?t2('right turns','høyresvinger'):t2('left turns','venstresvinger');
      c.en=`${cs}${id==='hold'?'hold':'proceed direct '+st.id+', hold'} on the ${d3(T.out)} radial, inbound course ${d3(T.inb)}, ${turns.en}, one-minute legs, maintain ${alt(T.alt)}.${id==='hold'?' Two patterns.':''}`;
      c.no=`${cs}${id==='hold'?'hold':'direkte '+st.id+', hold'} på radial ${d3(T.out)}, inngående kurs ${d3(T.inb)}, ${turns.no}, legg på ett minutt, hold ${alt(T.alt)}.${id==='hold'?' To runder.':''}`; break; }
    case 'pt': c.en=`${cs}outbound radial ${d3(T.out)} 1 min, procedure turn ${T.side>0?'right':'left'} ${d3(norm(T.out+T.side*45))}, inbound course ${d3(T.inb)}, maintain ${alt(T.alt)}.`;
      c.no=`${cs}radial ${d3(T.out)} ut 1 min, prosedyresving ${T.side>0?'høyre':'venstre'} ${d3(norm(T.out+T.side*45))}, inngående kurs ${d3(T.inb)}, hold ${alt(T.alt)}.`; break;
    case 'base': c.en=`${cs}outbound radial ${d3(T.ro)} 2 min, base turn ${T.turn>0?'right':'left'}, inbound course ${d3(T.inb)}, maintain ${alt(T.alt)}.`;
      c.no=`${cs}radial ${d3(T.ro)} ut 2 min, base turn ${T.turn>0?'høyre':'venstre'}, inngående kurs ${d3(T.inb)}, hold ${alt(T.alt)}.`; break;
    case 'vordme': c.en=`${cs}cleared VOR/DME approach, final course ${d3(T.crs)}. MDA ${T.mda} ft.`; c.no=`${cs}klarert VOR/DME-innflyging, sluttkurs ${d3(T.crs)}. MDA ${T.mda} ft.`; break;
    case 'ils': c.en=`${cs}fly heading ${d3(X.ac.hdg)}, maintain ${alt(T.alt)} until established, cleared ILS, course ${d3(T.crs)}. DA ${T.da} ft.`;
      c.no=`${cs}fly kurs ${d3(X.ac.hdg)}, hold ${alt(T.alt)} til etablert, klarert ILS, kurs ${d3(T.crs)}. DA ${T.da} ft.`; break;
  }
  return c; }

/* live coach lines (code → one line) and their "Why?" */
const CO={
 'orient.ask':t2('Position {n} of 3: find your radial, then report it.','Posisjon {n} av 3: finn radialen din og rapporter den.'),
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
 'pt.turn45':t2('Turn {dir} 45° to {hdg}, and start the clock.','Sving 45° til {dir} til {hdg}, og start klokken.'),
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
 'ils.fly.why':t2('Fly the needles with small changes: 2° to 3° of heading for the localiser, 100 to 200 ft/min for the glide slope.','Fly nålene med små endringer: 2° til 3° kurs for localiseren, 100 til 200 ft/min for glidebanen.')
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
 timeout:{h:t2('Out of time','Tiden ute'),w:t2('The run ended before the task was done.','Øvelsen tok slutt før oppgaven var ferdig.'),d:t2('Follow the coach line step by step, or watch “Show me” first.','Følg coach-linjen steg for steg, eller se «Vis meg» først.')}
};

/* parameters → words */
function pw(p){ const o=Object.assign({},p);
  if(o.side) o.side=sideW(o.side);
  if(o.dir!==undefined) o.dir=dirW(o.dir);
  if(o.entry) o.entry=L(W.entry[o.entry]||W.entry.unclear);
  if(o.flown) o.flown=L(W.entry[o.flown]||W.entry.unclear);
  if(o.alt===null) o.alt=''; else if(typeof o.alt==='string'&&W.entry[o.alt]) o.alt=no()?` (eller ${L(W.entry[o.alt])})`:` (or ${L(W.entry[o.alt])})`;
  if(o.wca!==undefined&&typeof o.wca==='number'){ const w=o.wca; o.wca= Math.abs(w)<1? '' : no()? `, ${Math.abs(w)}° til ${sideW(w>0?'R':'L')} for kursen: det er vindkorreksjonen` : `, ${Math.abs(w)}° ${sideW(w>0?'R':'L')} of the course: that is your wind correction`; }
  ['obs','crs','val','truth','hdg','qdm','r1','inb','out','ro','td','a','b'].forEach(k=>{ if(typeof o[k]==='number') o[k]=d3(o[k]); });
  if(typeof o.e==='number') o.e=String(Math.abs(o.e)).replace('.',no()?',':'.');
  if(typeof o.lead==='number') o.lead=String(o.lead).replace('.',no()?',':'.');
  if(typeof o.D==='number') o.D=String(o.D).replace('.',no()?',':'.');
  if(typeof o.adj==='number') o.adj=Math.abs(o.adj);
  return o; }
const fmt=(o,p)=>L(o).replace(/\{(\w+)\}/g,(m,k)=>{ const v=p[k]; return v===undefined||v===null?'':String(v); });

/* ---------- areas, progress ---------- */
const AREAS={practice:I.practiceArea(),bergen:I.realArea('bergen',NM.build('bergen')),oslo:I.realArea('oslo',NM.build('oslo'))};
const PK='bb-ifr-v1';
function loadP(){ try{ return JSON.parse(localStorage.getItem(PK)||'{}')||{}; }catch(e){ return {}; } }
function saveP(p){ try{ localStorage.setItem(PK,JSON.stringify(p)); }catch(e){} }
let PROG=loadP(); PROG.ex=PROG.ex||{};
const passed=id=>(PROG.ex[id]&&PROG.ex[id].lv)||0;

/* ---------- state ---------- */
const S={ex:'orient',lv:1,area:'practice',step:'understand',inst:null,seed:1,X:null,sim:null,J:null,P:null,run:false,started:false,paused:false,speed:1,demo:false,
  log:[],watch:{on:false,t:0},coach:true,peeks:0,peek:false,think:null,res:null,ideal:null,scrub:0,replay:false,mapOpen:false,u:null,showWhy:false,done:null};
if(PROG.last){ const l=PROG.last; if(I.EX[l.ex]) S.ex=l.ex; if(l.lv>=1&&l.lv<=4) S.lv=l.lv; if(AREAS[l.area]) S.area=l.area; }
const A=()=>AREAS[S.area], EXo=()=>I.EX[S.ex];
const allowed=(id,ar)=>{ const ex=I.EX[id]; return !ex.needs||!!AREAS[ar].plan[ex.needs]; };

/* ---------- gauges ---------- */
const GA={}; ['cdi','hsi','rmi','adf','dg'].forEach(k=>{ GA[k]=NAVG.make(q(`[data-g="${k}"] canvas`),k); });
const pfdC=q('[data-g="pfd"] canvas'), pfdG=pfdC.getContext('2d');
const SET={cdi:['cdi','dg'],rbi:['adf','dg'],hsi:['hsi'],rmi:['rmi'],pfd:['pfd']};
function layoutInst(){ const box=el('inst'), narrow=innerWidth<980; const kinds=SET[S.inst]||['cdi'];
  qa('#inst .g').forEach(g=>g.hidden=kinds.indexOf(g.dataset.g)<0);
  const W=box.clientWidth; let Hh=box.clientHeight;
  const phone=narrow&&W<520; box.classList.toggle('stack',phone&&kinds.length>1);
  if(narrow){ Hh= S.inst==='pfd'? Math.min(560,W*1.12) : kinds.length>1? (phone? Math.min(W,330)+12+Math.min(W*0.56,190) : Math.min(W/1.62,380)) : Math.min(W,440); if(S.step==='debrief') Hh=Math.min(Hh,phone?420:300); if(innerHeight<560) Hh=Math.min(Hh,Math.max(220,innerHeight-110)); box.style.height=Math.round(Hh)+'px'; }
  else box.style.height='';
  if(!W||!Hh) return;
  const set=(k,w,h)=>{ const c=q(`[data-g="${k}"] canvas`); c.style.width=Math.floor(w)+'px'; c.style.height=Math.floor(h||w)+'px'; };
  if(S.inst==='pfd'){ const w=Math.min(W,Hh/1.12); set('pfd',w,w*1.12); sizePFD(w,w*1.12); }
  else if(kinds.length>1&&phone){ const s1=Math.min(W,330,(Hh-12)/1.56); set(kinds[0],s1); set(kinds[1],s1*0.56); }
  else if(kinds.length>1){ let s1,s2; if(W<560||narrow){ s1=Math.min(Hh,(W-12)/1.62); s2=s1*0.62; } else { s1=Math.min(Hh,(W-16)/2); s2=s1*0.8; s1=Math.min(Hh,(W-16)/1.8); s2=Math.min(s1*0.8,W-16-s1); } set(kinds[0],s1); set(kinds[1],s2); }
  else set(kinds[0],Math.min(W,Hh));   /* navgauges resizes itself (ResizeObserver) */
}
let pfdW=0,pfdH=0,pfdDpr=1;
function sizePFD(w,h){ pfdDpr=Math.min(devicePixelRatio||1,2.5); pfdW=w; pfdH=h; pfdC.width=Math.round(w*pfdDpr); pfdC.height=Math.round(h*pfdDpr); }

/* ---------- map ---------- */
const mapC=el('map'), mapG=mapC.getContext('2d'), baseC=document.createElement('canvas'), baseG=baseC.getContext('2d');
const map=NM.create(mapC,{onLoad:()=>{ baseDirty=true; }});
let MW=0,MH=0,dpr=1,baseDirty=true;
function sizeMap(){ const r=mapC.getBoundingClientRect(); MW=Math.max(1,Math.round(r.width)); MH=Math.max(1,Math.round(r.height)); dpr=Math.min(devicePixelRatio||1,2);
  for(const c of [mapC,baseC]){ c.width=Math.round(MW*dpr); c.height=Math.round(MH*dpr); }
  fitView(); baseDirty=true; }
let viewPts=null;
function fitView(pts){ if(pts) viewPts=pts; const P=viewPts||(S.X?S.X.box:[{x:0,y:0}]); if(MW<80||MH<80) return;
  const b={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity}; P.forEach(p=>{ b.x0=Math.min(b.x0,p.x); b.x1=Math.max(b.x1,p.x); b.y0=Math.min(b.y0,p.y); b.y1=Math.max(b.y1,p.y); });
  const v=NM.fit(b,MW,MH,{l:40,r:40,t:46,b:40},{pad:1.6,min:7,maxK:220}); map.set(v); baseDirty=true; }
/* keep the aircraft on the map: refit when it nears the edge */
function keepInView(x,y){ if(MW<80||MH<80) return; map.P(x,y); if(map.sx<24||map.sy<24||map.sx>MW-24||map.sy>MH-24){ fitView((viewPts||S.X.box).concat([{x,y}])); } }

/* ---------- steps and setup ---------- */
const STEPS=[['understand',t2('Understand','Forstå')],['think',t2('Think first','Tenk først')],['fly',t2('Fly','Fly')],['debrief',t2('Debrief','Debrief')]];
function setup(seed){ if(seed!==undefined) S.seed=seed;
  if(!allowed(S.ex,S.area)) S.area='practice';
  const ex=EXo(); S.X=ex.setup(A(),S.lv,S.seed); S.X.dme=S.X.dme||null;
  if(!S.inst||ex.inst.indexOf(S.inst)<0) S.inst=ex.def;
  S.sim=I.newSim(Object.assign({},S.X.ac,{wind:S.X.wind})); S.J=I.newJudge(); S.P={}; S.log=[]; S.run=false; S.started=false; S.paused=false; S.demo=false;
  S.watch={on:false,t:0}; S.peeks=0; S.res=null; S.done=null; S.u={x:S.X.ac.x,y:S.X.ac.y,hdg:S.X.ac.hdg,alt:S.X.ac.alt,ias:S.X.ac.ias,gs:S.X.ac.ias,trk:S.X.ac.hdg,obs:S.X.obs};
  S.coach=S.lv<=2; S.ideal=null; viewPts=null; fitView(); baseDirty=true;
  PROG.last={ex:S.ex,lv:S.lv,area:S.area}; saveP(PROG);
  S.think=ex.think?ex.think(S.X,A()):null; S.thinkAns=null;
  /* the ideal path, flown by the scripted pilot from the same start (for the Understand picture and the debrief) */
  try{ const r=I.run(S.ex,A(),S.lv,S.seed); S.ideal=r.path; }catch(e){ S.ideal=null; }
}
function go(step){ if(step==='debrief'&&!S.res) return; S.step=step; el('trainer').dataset.step=step;
  if(step==='fly'&&!S.started){ /* fresh run */ }
  if(step==='debrief'){ S.scrub=S.res?S.res.first?S.res.first.t:(S.log.length?S.log[S.log.length-1].t:0):0; S.replay=false; fitView(debriefPts()); }
  else if(step!=='fly'||!S.started){ fitView(S.X.box); }
  renderAll(); }
function newExercise(id){ S.ex=id; S.inst=null; S.seed=Math.floor(Math.random()*9000)+1; setup(); go('understand'); renderLegs(); }

/* ---------- rendering: chrome ---------- */
function renderLegs(){ const ol=el('legs'); ol.innerHTML=I.ORDER.map((id,i)=>{ const ex=I.EX[id], t=EXT[id], p=passed(id);
  return `<li class="leg${id===S.ex?' on':''}"><button type="button" data-ex="${id}" aria-current="${id===S.ex?'step':'false'}"><span class="wp"><svg viewBox="0 0 30 30" aria-hidden="true"><path d="M15 2.5 27.5 15 15 27.5 2.5 15Z" fill="${id===S.ex?'#9A1E68':'#EDF1EE'}" stroke="${id===S.ex?'#9A1E68':'#13202A'}" stroke-width="1.6"/></svg><b>${String(i+1).padStart(2,'0')}</b></span>
    <span class="nm">${esc(L(t.n))}</span><span class="gp">${i===0||I.EX[I.ORDER[i-1]].group!==ex.group?esc(L(W.group[ex.group])):'&nbsp;'}</span><span class="pips" title="${esc(no()?'Bestått nivå':'Levels passed')}: ${p}/4">${[1,2,3,4].map(k=>`<i class="${k<=p?'on':''}"></i>`).join('')}</span></button></li>`; }).join('');
  ol.querySelectorAll('button').forEach(b=>b.onclick=()=>{ newExercise(b.dataset.ex); el('trainer').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'}); }); }
function renderBar(){ const ex=EXo(), i=I.ORDER.indexOf(S.ex);
  el('exNo').textContent=String(i+1).padStart(2,'0'); el('exName').textContent=L(EXT[S.ex].n);
  el('steps').innerHTML=STEPS.map(([k,n],j)=>`<button type="button" data-s="${k}" class="${k===S.step?'on':''}" ${k==='debrief'&&!S.res?'disabled':''} aria-current="${k===S.step?'step':'false'}"><i>${j+1}</i>${esc(L(n))}</button>`).join('');
  el('steps').querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.dataset.s==='fly'&&S.step==='debrief'){ setup(S.seed); } go(b.dataset.s); });
  el('lvK').textContent=no()?'Nivå':'Level';
  el('lvSeg').innerHTML=[1,2,3,4].map(k=>`<button type="button" data-l="${k}" class="${k===S.lv?'on':''}" title="${esc(L(W.level[k]))}" aria-pressed="${k===S.lv}">${k}</button>`).join('');
  el('lvSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{ S.lv=+b.dataset.l; setup(); go(S.step==='debrief'||S.step==='fly'?'fly':S.step); });
  el('lvLab').textContent=S.ex==='ndb'&&S.lv===1?(no()?'Kart, jevn vind':'Map, steady wind'):L(W.level[S.lv]);
  el('arSeg').innerHTML=['practice','bergen','oslo'].map(k=>`<button type="button" data-a="${k}" class="${k===S.area?'on':''}" ${allowed(S.ex,k)?'':'disabled'} title="${esc(k==='practice'?(no()?'Fiktive stasjoner':'Fictional stations'):(no()?'Ekte navigasjonsdata, kun for trening':'Real navaid data, for training only'))}" aria-pressed="${k===S.area}">${esc(L(W.area[k]))}</button>`).join('');
  el('arSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.disabled) return; S.area=b.dataset.a; const r=AREAS[S.area]; map.region=null; if(r.real) map.setRegion(S.area); setup(); go(S.step==='debrief'?'fly':S.step); });
  el('mapBtn').textContent=no()?(S.mapOpen?'Skjul kart':'Kart'):(S.mapOpen?'Hide map':'Map'); el('mapBtn').setAttribute('aria-pressed',S.mapOpen);
  el('itabs').innerHTML=`<span class="k">${no()?'Instrument':'Instrument'}</span>`+['cdi','rmi','rbi','hsi','pfd'].map(k=>`<button type="button" data-i="${k}" class="${k===S.inst?'on':''}" ${ex.inst.indexOf(k)<0?'disabled title="'+esc(no()?'Viser ikke det denne øvelsen trenger':'Does not show what this exercise needs')+'"':''} aria-pressed="${k===S.inst}">${W.inst[k]}</button>`).join('')+`<span class="scan">${esc(L(SCAN[S.inst]))}</span>`;
  el('itabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(b.disabled) return; S.inst=b.dataset.i; renderBar(); layoutInst(); });
}
function windSvg(dir){ return `<svg viewBox="-8 -8 16 16" aria-hidden="true"><g transform="rotate(${dir+180})"><path d="M0 -6.5 3 -1.5 0.9 -1.5 0.9 6.5 -0.9 6.5 -0.9 -1.5 -3 -1.5Z" fill="#7FCBE8"/></g></svg>`; }
function renderBrief(){ const X=S.X, c=clearance(X,A());
  let extra='';
  if(S.ex==='vordme'){ const T=X.task; extra=`<span class="tbl">${T.table.slice(0,6).map(r=>`<span>D${r.dme} <b>${r.alt}</b></span>`).join('')}</span>`; }
  el('clr').innerHTML=`<span>${esc(L(c))}</span>${extra}`;
  const w=X.wind, hid=w.hidden||S.lv>=4;
  el('meta').innerHTML=`<span class="wind">${hid?`${no()?'Vind':'Wind'} <b>${no()?'skjult':'hidden'}</b>`: w.spd? `${windSvg(w.dir)}<b>${d3(w.dir)}/${Math.round(w.spd)}</b>`:`${no()?'Vind':'Wind'} <b>${no()?'stille':'calm'}</b>`}</span><span>TAS <b>${Math.round(I.tasOf(X.ac.ias,X.ac.alt))}</b></span>${A().real?`<span title="${esc(no()?'Ekte navigasjonsdata, kun for trening':'Real navaid data, for training only')}">${no()?'Ekte data':'Real data'}</span>`:''}`;
}
function renderLesson(){ const t=EXT[S.ex].u;
  el('lesson').innerHTML=`<h3>${esc(L(t.h))}</h3>${t.p.map(p=>`<p>${esc(L(p))}</p>`).join('')}<p class="try">${esc(L(t.tr))}</p><div class="live" id="uLive"></div>`;
  el('uActs').innerHTML='';
}
function renderThink(){ const T=S.think, box=el('think'); if(!T){ box.innerHTML=''; return; }
  const cap=x=>x.charAt(0).toUpperCase()+x.slice(1);
  const ans=S.thinkAns, X=S.X, opt=v=>typeof v==='number'?(T.kind==='arclead'?nf1(v)+' NM':T.kind==='profile'?v+' ft':T.kind==='rod'?v+' ft/min':d3(v)):cap(T.kind==='entry'?L(W.entry[v]):sideW(v));
  let qx='';
  switch(T.kind){
    case 'radial': qx=no()?`RMI-nålen peker på <b>${d3(T.qdm)}</b>. Hvilken radial er du på?`:`The RMI needle points to <b>${d3(T.qdm)}</b>. Which radial are you on?`; break;
    case 'needle': qx=no()?`Inn mot stasjonen med TO står nålen til høyre. Hvor ligger kursen?`:`Flying inbound with TO, the needle is right of centre. Where is the course?`; break;
    case 'wca': qx=no()?`Kurs <b>${d3(T.crs)}</b>, TAS <b>${T.tas}</b> kt, vind <b>${d3(T.w.dir)}/${T.w.spd}</b>. Hvilken kurs holder sporet?`:`Course <b>${d3(T.crs)}</b>, TAS <b>${T.tas}</b> kt, wind <b>${d3(T.w.dir)}/${T.w.spd}</b>. Which heading tracks the course?`; break;
    case 'intercept': qx=no()?`Du er på radial <b>${d3(T.radial)}</b> og skal fange kurs <b>${d3(T.crs)}</b> ${T.inbound?'inn':'ut'}. Interceptkurs?`:`You are on radial <b>${d3(T.radial)}</b>, cleared to intercept <b>${d3(T.crs)}</b> ${T.inbound?'inbound':'outbound'}. Intercept heading?`; break;
    case 'arclead': qx=no()?`Inn på en <b>${T.R} DME</b>-bue i <b>${T.tas}</b> kt: hvor langt før buen starter du svingen på 90°?`:`Joining a <b>${T.R} DME</b> arc at <b>${T.tas}</b> kt: how far before the arc do you start the 90° turn?`; break;
    case 'entry': qx=no()?`Inngående <b>${d3(T.inb)}</b>, ${T.dir>0?'høyresvinger':'venstresvinger'}. Du krysser fiksen på kurs <b>${d3(T.hdg)}</b>. Hvilken inngang?`:`Inbound <b>${d3(T.inb)}</b>, ${T.dir>0?'right':'left'} turns. You will cross the fix heading <b>${d3(T.hdg)}</b>. Which entry?`; break;
    case 'holdwca': qx=no()?`Inn trenger du <b>${Math.abs(T.wca)}°</b> korreksjon (kurs <b>${d3(T.hdgIn)}</b>). Hvilken kurs flyr du ut?`:`Inbound you need <b>${Math.abs(T.wca)}°</b> of correction (heading <b>${d3(T.hdgIn)}</b>). Which heading outbound?`; break;
    case 'ptdir': qx=no()?`Etter 45°-svingen til ${T.side>0?'høyre':'venstre'} og 1 minutt: hvilken vei går 180°-svingen?`:`After the 45° turn ${T.side>0?'right':'left'} and 1 minute, which way is the 180° turn?`; break;
    case 'basedir': qx=no()?`Når tiden ut er ferdig: hvilken vei svinger du inn på kurs <b>${d3(X.task.inb)}</b>?`:`When the outbound time is up, which way do you turn onto course <b>${d3(X.task.inb)}</b>?`; break;
    case 'profile': qx=no()?`På 3°-profilen: hvilken høyde ved <b>${T.dme} DME</b>?`:`On the 3° profile, what altitude at <b>${T.dme} DME</b>?`; break;
    case 'rod': qx=no()?`Fart over bakken <b>${T.gs}</b> kt på en glidebane på 3°. Sink?`:`Ground speed <b>${T.gs}</b> kt on a 3° glide slope. Rate of descent?`; break;
  }
  const why=()=>{ const a=opt(T.ans);
    switch(T.kind){
      case 'radial': return no()?`Radialen er halen: ${d3(T.qdm)} ± 180 = ${a}.`:`The radial is the tail: ${d3(T.qdm)} ± 180 = ${a}.`;
      case 'needle': return no()?'Nål til høyre, kurs til høyre. Sving mot nålen.':'Needle right, course right. Turn towards the needle.';
      case 'wca': return no()?`Vinden kommer fra ${sideW(T.wca>0?'R':'L')}: hold opp mot den, rundt ${Math.abs(T.wca)}°, kurs ${a}.`:`The wind is from the ${sideW(T.wca>0?'R':'L')}: point into it, about ${Math.abs(T.wca)}°, heading ${a}.`;
      case 'intercept': return no()?`Kursen ligger mot nålen; kursen ± ${T.inbound?30:45}° mot den gir ${a}.`:`The course lies towards the needle; the course ± ${T.inbound?30:45}° towards it gives ${a}.`;
      case 'arclead': return no()?`Omtrent én svingradius: ${a} i denne farten.`:`About one turn radius: ${a} at this speed.`;
      case 'entry': return no()?`${a}${T.alt?` (innenfor 5° av en linje, også ${L(W.entry[T.alt])})`:''}. Se for deg kursen din over fiksen og 70°-linjen.`:`${a}${T.alt?` (within 5° of a line, so ${L(W.entry[T.alt])} is fine too)`:''}. Picture your heading on the fix and the 70° line.`;
      case 'holdwca': return no()?`Tre ganger, motsatt vei: ${a}.`:`Three times, the other way: ${a}.`;
      case 'ptdir': return no()?`Motsatt vei av 45°-svingen: ${a}, vekk fra stasjonen.`:`The opposite way to the 45° turn: ${a}, away from the station.`;
      case 'basedir': return no()?`Mot sluttkursen: ${a}.`:`Towards the final course: ${a}.`;
      case 'profile': return no()?`Fra tabellen: ${a}.`:`From the table: ${a}.`;
      case 'rod': return no()?`Fart over bakken × 5 ≈ ${T.gs*5}; nøyaktig ${a}.`:`Ground speed × 5 ≈ ${T.gs*5}; exactly ${a}.`;
    } return ''; };
  const isTxt=typeof T.opts[0]==='string';
  box.innerHTML=`<h3>${no()?'Tenk først':'Think first'}</h3><p class="q">${qx}</p><div class="opts">${T.opts.map((v,i)=>`<button type="button" data-i="${i}" class="${isTxt?'txt':''} ${ans!==null&&ans!==undefined?(v===T.ans||v===T.alt?'right':(i===ans?'wrong':'')):''}" ${ans!==null&&ans!==undefined?'disabled':''}>${esc(opt(v))}</button>`).join('')}</div>`+
    (ans!==null&&ans!==undefined?`<p class="fb ${T.opts[ans]===T.ans||T.opts[ans]===T.alt?'':'no'}">${esc((T.opts[ans]===T.ans||T.opts[ans]===T.alt?(no()?'Riktig. ':'Right. '):(no()?'Ikke helt. ':'Not quite. '))+why())}</p>`:'');
  box.querySelectorAll('.opts button').forEach(b=>b.onclick=()=>{ S.thinkAns=+b.dataset.i; renderThink(); renderTbar(); });
}
function scoreCls(v){ return v>=80?'':v>=55?'mid':'low'; }
function renderDeb(){ const R=S.res, box=el('deb'); if(!R){ box.innerHTML=''; return; }
  const g=R.g, f=g.first, ev=S.J.ev;
  const timeTxt={established:t2('time to get established','tid til etablert'),decision:t2('time to choose an intercept heading','tid til valgt interceptkurs'),answer:t2('time per answer','tid per svar'),arcjoin:t2('lead onto the arc','ledning inn på buen'),arcleave:t2('lead radial off the arc','ledende radial ut av buen'),
    entryleg:t2('entry leg time','tid på inngangslegget'),inleg:t2('inbound leg times','tid på inngående legg'),ptout:t2('outbound time','tid ut'),pt45:t2('45° leg time','tid på 45°-legget'),baseout:t2('outbound time','tid ut'),descent:t2('descent started at the FAF','nedstigning startet ved FAF'),gsdescent:t2('descent started on the glide slope','nedstigning startet på glidebanen')};
  const tk=[...new Set(S.J.times.map(x=>x.k))].map(k=>L(timeTxt[k]||t2(k,k))).join(', ');
  const verdict=R.demo?(no()?'Demonstrasjon':'Demonstration'):g.pass?(no()?`Bestått nivå ${S.lv}`:`Level ${S.lv} passed`):(no()?'Ikke helt ennå':'Not yet');
  const sub=R.demo?(no()?'Slik flyr instruktøren den. Nå er det din tur.':'This is how the instructor flies it. Your turn now.'):g.pass?(S.lv<4?(no()?`Prøv nivå ${S.lv+1}: ${L(W.level[S.lv+1])}.`:`Try level ${S.lv+1}: ${L(W.level[S.lv+1])}.`):(no()?'Alle nivåer bestått.':'All levels passed.')):(no()?'75 eller mer og ingen prosedyrefeil for å bestå.':'75 or more and no procedure error to pass.');
  let card;
  if(f){ const E=EV[f.code]||EV.outside, p=pw(f.p);
    card=`<div class="mist ${f.sev==='warn'?'warn':''}" id="mistCard" role="button" tabindex="0" aria-label="${esc(no()?'Vis på kartet':'Show on the map')}"><div class="h"><b>${esc((f.sev==='err'?(no()?'Første feil: ':'First mistake: '):(no()?'Å rydde opp i: ':'To tidy up: '))+L(E.h))}</b><span>${mmss(f.t)}</span></div><p>${esc(fmt(E.w,p))}</p>${L(E.d)?`<p class="do">${esc(fmt(E.d,p))}</p>`:''}</div>`; }
  else card=`<div class="mist clean"><div class="h"><b>${no()?'Ren runde':'Clean run'}</b><span>${mmss(S.sim.t)}</span></div><p>${esc(no()?'Ingen feil. Den stiplede linjen er instruktørens bane: sammenlign formen.':'No mistakes. The dashed line is the instructor’s path: compare the shapes.')}</p></div>`;
  const others=ev.filter(e=>e!==f&&e.sev!=='info'&&!(e.code==='orient.ok')).slice(0,5);
  box.innerHTML=`<div class="res"><div class="tot">${g.total}<small>/100</small></div><div class="verdict ${g.pass||R.demo?'':'no'}">${esc(verdict)}</div><div class="sub">${esc(sub)}</div></div>
    <div class="bars">
      <span>${no()?'Nøyaktighet':'Accuracy'}</span><div class="b"><i class="${scoreCls(g.acc)}" style="width:${g.acc}%"></i></div><b>${g.acc}</b><em>${esc(no()?'Tid innenfor grensene, vektet mot hvor langt ute du var':'Time inside the limits, weighted by how far out you were')}</em>
      <span>${no()?'Timing':'Timing'}</span><div class="b"><i class="${scoreCls(g.time??100)}" style="width:${g.time??0}%"></i></div><b>${g.time===null?'–':g.time}</b><em>${esc(tk||(no()?'Ingen tidskrav i denne øvelsen':'No timing items in this exercise'))}</em>
      <span>${no()?'Prosedyre':'Procedure'}</span><div class="b"><i class="${scoreCls(g.proc)}" style="width:${g.proc}%"></i></div><b>${g.proc}</b><em>${esc(no()?'Riktig retning, inngang, rekkefølge og høyder':'Right direction, entry, order and altitudes')}</em>
    </div>${card}
    ${others.length?`<ul class="evs">${others.map(e=>{ const E=EV[e.code]||EV.outside; return `<li data-t="${e.t}"><span class="t">${mmss(e.t)}</span><i class="${e.sev}"></i><span>${esc(L(E.h))}</span></li>`; }).join('')}</ul>`:''}
    ${S.peeks?`<p class="sub">${esc(no()?`Du kikket på kartet ${S.peeks} gang${S.peeks>1?'er':''}.`:`You peeked at the map ${S.peeks} time${S.peeks>1?'s':''}.`)}</p>`:''}`;
  const mc=el('mistCard'); if(mc){ const goT=()=>{ S.scrub=f.t; S.replay=false; renderPlay(); }; mc.onclick=goT; mc.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); goT(); } }; }
  box.querySelectorAll('.evs li').forEach(li=>li.onclick=()=>{ S.scrub=+li.dataset.t; S.replay=false; renderPlay(); });
}
const ICON={play:'<svg viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>',pause:'<svg viewBox="0 0 14 14"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>',
  again:'<svg viewBox="0 0 14 14"><path d="M11.5 7A4.5 4.5 0 1 1 7 2.5h2.5M8 .8l1.8 1.7L8 4.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  dice:'<svg viewBox="0 0 14 14"><rect x="1.5" y="1.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="4.7" cy="4.7" r="1.1" fill="currentColor"/><circle cx="9.3" cy="9.3" r="1.1" fill="currentColor"/><circle cx="9.3" cy="4.7" r="1.1" fill="currentColor"/><circle cx="4.7" cy="9.3" r="1.1" fill="currentColor"/></svg>',
  eye:'<svg viewBox="0 0 14 14"><path d="M1 7s2.3-4 6-4 6 4 6 4-2.3 4-6 4-6-4-6-4z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="7" r="1.8" fill="currentColor"/></svg>',
  stop:'<svg viewBox="0 0 14 14"><rect x="2.5" y="2.5" width="9" height="9" rx="1" fill="currentColor"/></svg>'};
function renderPlay(){ el('play').innerHTML=S.replay?ICON.pause:ICON.play; el('play').setAttribute('aria-label',S.replay?(no()?'Pause':'Pause'):(no()?'Spill av':'Play the replay')); }
function renderTbar(){ const tb=el('tbar'); let h='';
  if(S.step==='understand'){ h=`<span class="hint">${esc(no()?'Dra flyet. Snu det med håndtaket foran nesen.':'Drag the aircraft. Turn it with the handle in front of the nose.')}</span>
    ${S.think?`<button class="dbtn" data-a="think">${no()?'Tenk først':'Think first'}</button>`:''}<button class="dbtn pri" data-a="fly">${no()?'Fly den':'Fly it'}</button>`; }
  else if(S.step==='think'){ h=`<span class="sp"></span><button class="dbtn q" data-a="understand">${no()?'Tilbake':'Back'}</button><button class="dbtn ${S.thinkAns!=null?'pri':''}" data-a="fly">${S.thinkAns!=null?(no()?'Fly den':'Fly it'):(no()?'Hopp over og fly':'Skip and fly')}</button>`; }
  else if(S.step==='fly'){
    if(!S.started) h=`<button class="dbtn pri" data-a="start">${ICON.play}${no()?'Start':'Start'}</button><button class="ib" data-a="demo">${ICON.eye}<span class="tx">${no()?'Vis meg':'Show me'}</span></button><span class="hint">${esc(no()?'Les klareringen. Mellomrom starter.':'Read the clearance. Space starts.')}</span>`;
    else h=`<button class="ib" data-a="pause" aria-pressed="${S.paused}">${S.paused?ICON.play:ICON.pause}<span class="tx">${S.paused?(no()?'Fortsett':'Resume'):(no()?'Pause':'Pause')}</span></button>
      <div class="dseg" role="group" aria-label="${no()?'Tidsfaktor':'Time'}">${[1,2,4].map(k=>`<button type="button" data-sp="${k}" class="${k===S.speed?'on':''}" aria-pressed="${k===S.speed}">×${k}</button>`).join('')}</div>
      <span class="clock">${no()?'Tid':'Time'} <b id="clk">${mmss(S.sim.t)}</b>${S.demo?`<span class="dm"> · ${no()?'instruktøren flyr':'the instructor is flying'}</span>`:''}</span><span class="sp"></span>
      <button class="ib ${S.coach?'on':''}" data-a="coach" aria-pressed="${S.coach}"><span>${no()?'Coach':'Coach'}</span></button>
      <button class="ib" data-a="repo" title="${esc(no()?'Ny tilfeldig start':'New random start')}">${ICON.dice}<span class="tx">${no()?'Ny start':'Reposition'}</span></button>
      <button class="ib" data-a="restart">${ICON.again}<span class="tx">${no()?'Start på nytt':'Restart'}</span></button>
      <button class="ib" data-a="end">${ICON.stop}<span class="tx">${no()?'Avslutt':'End'}</span></button>`;
  }
  else if(S.step==='debrief'){ const g=S.res&&S.res.g, nextEx=I.ORDER[(I.ORDER.indexOf(S.ex)+1)%I.ORDER.length];
    h=`<button class="dbtn pri" data-a="again">${no()?'Fly igjen':'Fly again'}</button><button class="ib" data-a="repo">${ICON.dice}<span class="tx">${no()?'Ny start':'New start'}</span></button><button class="ib" data-a="demo">${ICON.eye}<span class="tx">${no()?'Vis meg':'Show me'}</span></button><span class="sp"></span>
      ${g&&g.pass&&S.lv<4&&!S.res.demo?`<button class="dbtn" data-a="nextlv">${no()?`Nivå ${S.lv+1}`:`Level ${S.lv+1}`}</button>`:''}<button class="dbtn q" data-a="nextex">${esc(no()?'Neste øvelse: ':'Next exercise: ')}${esc(L(EXT[nextEx].n))}</button>`; }
  tb.innerHTML=h;
  tb.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a));
  tb.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{ S.speed=+b.dataset.sp; renderTbar(); });
}
function act(a){
  switch(a){
    case 'think': go('think'); break;
    case 'understand': go('understand'); break;
    case 'fly': if(S.step==='debrief') setup(S.seed); go('fly'); scrollStage(); break;
    case 'start': start(false); break;
    case 'demo': setup(S.seed); go('fly'); start(true); scrollStage(); break;
    case 'pause': S.paused=!S.paused; renderTbar(); break;
    case 'coach': S.coach=!S.coach; renderTbar(); renderCoach(true); break;
    case 'repo': setup(Math.floor(Math.random()*9000)+1); go('fly'); renderAll(); break;
    case 'restart': setup(S.seed); go('fly'); break;
    case 'end': finish(true); break;
    case 'again': setup(S.seed); go('fly'); scrollStage(); break;
    case 'nextlv': S.lv=Math.min(4,S.lv+1); setup(Math.floor(Math.random()*9000)+1); go('fly'); scrollStage(); break;
    case 'nextex': newExercise(I.ORDER[(I.ORDER.indexOf(S.ex)+1)%I.ORDER.length]); break;
  } }
function scrollStage(){ const st=el('trainer'), r=st.getBoundingClientRect(); if(innerWidth>=980&&Math.abs(r.top)>4) st.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'}); }
function start(demo,mistake){ S.started=true; S.run=true; S.paused=false; S.demo=!!demo; S.mistake=mistake||false; renderTbar(); renderCoach(true); }

/* ---------- controls ---------- */
const CTL=[{k:'hdg',l:'HDG',step:[1,10],get:()=>S.sim.sel.hdg,fmt:v=>d3(v)},{k:'crs',l:'CRS',step:[1,10],get:()=>S.X.obs,fmt:v=>d3(v)},
  {k:'alt',l:'ALT',step:[100,1000],lab:['100','1k'],get:()=>S.sim.sel.alt,fmt:v=>String(Math.round(v))},{k:'vs',l:'VS',step:[50,100],get:()=>S.sim.sel.vs,fmt:v=>String(Math.round(v))},{k:'spd',l:'SPD',step:[1,10],get:()=>S.sim.sel.spd,fmt:v=>String(Math.round(v))}];
function setCtl(k,v,delta){ const s=S.sim;
  if(k==='hdg'){ if(delta!==undefined){ const off=I.hdgErr(s)+delta; s.sel.hdg=norm(s.sel.hdg+delta)||360; s.sel.dir=Math.abs(off)>180?Math.sign(off):0; } else { s.sel.hdg=norm(v)||360; s.sel.dir=0; } }
  else if(k==='crs'){ S.X.obs=norm(delta!==undefined?S.X.obs+delta:v)||360; if(S.step==='understand') S.u.obs=S.X.obs; }
  else if(k==='alt') s.sel.alt=clamp(delta!==undefined?Math.round((s.sel.alt+delta)/10)*10:v,0,20000);
  else if(k==='vs') s.sel.vs=clamp(delta!==undefined?s.sel.vs+delta:v,100,2000);
  else if(k==='spd') s.sel.spd=clamp(delta!==undefined?s.sel.spd+delta:v,80,200);
  if(S.demo&&S.run){ S.demo=false; renderTbar(); }
  syncCtl(); }
function renderCtl(){ const list=S.ex==='orient'?CTL.filter(c=>c.k==='hdg'||c.k==='crs'):CTL;
  el('ctl').innerHTML=list.map(c=>`<div class="c" data-k="${c.k}"><div class="top"><label for="in-${c.k}">${c.l}</label><input id="in-${c.k}" inputmode="numeric" autocomplete="off" aria-label="${c.l}"></div>
  <div class="st">${[-c.step[1],-c.step[0],c.step[0],c.step[1]].map((d,j)=>`<button type="button" data-d="${d}" aria-label="${c.l} ${d>0?'+':'−'}${Math.abs(d)}">${d>0?'+':'−'}${c.lab?c.lab[j===0||j===3?1:0]:Math.abs(d)}</button>`).join('')}</div></div>`).join('')+
    (S.ex==='orient'?`<div class="c rep"><div class="top"><label for="in-rep">${no()?'Din radial':'Your radial'}</label><input id="in-rep" inputmode="numeric" autocomplete="off" placeholder="—"></div><div class="st" style="grid-template-columns:1fr 1fr"><button type="button" id="repObs">${no()?'Bruk OBS':'Use OBS'}</button><button type="button" id="repGo" class="go">${no()?'Rapporter':'Report'}</button></div></div>`:'');
  if(!S.X.nav){ const c=el('ctl').querySelector('[data-k="crs"]'); if(c){ c.setAttribute('aria-disabled','true'); c.title=no()?'Ingen VOR i denne øvelsen':'No VOR in this exercise'; } }
  el('ctl').querySelectorAll('.c[data-k]').forEach(box=>{ const k=box.dataset.k, inp=box.querySelector('input');
    box.querySelectorAll('button').forEach(b=>{ let tm=null, iv=null; const fire=()=>setCtl(k,null,+b.dataset.d);
      b.addEventListener('pointerdown',e=>{ e.preventDefault(); fire(); tm=setTimeout(()=>{ iv=setInterval(fire,90); },420); });
      const stop=()=>{ clearTimeout(tm); clearInterval(iv); }; b.addEventListener('pointerup',stop); b.addEventListener('pointerleave',stop); b.addEventListener('pointercancel',stop);
      b.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fire(); } }); });
    inp.addEventListener('focus',()=>{ box.classList.add('hot'); inp.select(); });
    inp.addEventListener('blur',()=>{ box.classList.remove('hot'); const v=parseFloat(inp.value); if(Number.isFinite(v)) setCtl(k,v); else syncCtl(); });
    inp.addEventListener('keydown',e=>{ const c=CTL.find(x=>x.k===k); if(e.key==='Enter'){ inp.blur(); }
      if(e.key==='ArrowUp'||e.key==='ArrowDown'){ e.preventDefault(); e.stopPropagation(); setCtl(k,null,(e.key==='ArrowUp'?1:-1)*c.step[e.shiftKey?1:0]); inp.select(); } }); });
  if(S.ex==='orient'){ const ri=el('in-rep'); const send=()=>{ const v=parseFloat(ri.value); if(!Number.isFinite(v)){ ri.focus(); return; } report(norm(Math.round(v))||360); ri.value=''; };
    el('repGo').onclick=send; el('repObs').onclick=()=>{ ri.value=d3(S.X.obs); }; ri.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); send(); } }); }
  el('keys').innerHTML=no()?'<kbd>←</kbd><kbd>→</kbd> kurs · <kbd>↑</kbd><kbd>↓</kbd> høyde · <kbd>,</kbd><kbd>.</kbd> CRS · <kbd>Shift</kbd> ×10 · <kbd>T</kbd> klokke · <kbd>Mellomrom</kbd> pause · dra i knappene':
    '<kbd>←</kbd><kbd>→</kbd> heading · <kbd>↑</kbd><kbd>↓</kbd> altitude · <kbd>,</kbd><kbd>.</kbd> course · <kbd>Shift</kbd> ×10 · <kbd>T</kbd> stopwatch · <kbd>Space</kbd> pause · drag the instrument knobs';
  syncCtl(); }
function syncCtl(){ CTL.forEach(c=>{ const inp=el('in-'+c.k); if(inp&&document.activeElement!==inp) inp.value=c.fmt(c.get()); }); }

/* keyboard: arrows fly the aircraft (when not typing) */
document.addEventListener('keydown',e=>{ if(S.step!=='fly') return; const t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable)) return;
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  const big=e.shiftKey; let used=true;
  switch(e.key){
    case 'ArrowLeft': setCtl('hdg',null,big?-10:-1); break; case 'ArrowRight': setCtl('hdg',null,big?10:1); break;
    case 'ArrowUp': setCtl('alt',null,big?1000:100); break; case 'ArrowDown': setCtl('alt',null,big?-1000:-100); break;
    case ',': case '<': setCtl('crs',null,big?-10:-1); break; case '.': case '>': setCtl('crs',null,big?10:1); break;
    case ' ': if(t&&t.tagName==='BUTTON') { used=false; break; } if(!S.started) start(false); else { S.paused=!S.paused; renderTbar(); } break;
    case 't': case 'T': toggleWatch(); break;
    default: used=false; }
  if(used) e.preventDefault(); });
function toggleWatch(){ S.watch.on=!S.watch.on; renderData(true); }

/* drag on instrument knobs (and wheel) */
function knobDrag(kind){ const cv=q(`[data-g="${kind}"] canvas`), G=GA[kind];
  const target=(x,y)=>{ const ks=G?G.knobs:[]; const kn=ks.find(k=>Math.hypot(x-k.x,y-k.y)<k.r*1.25); if(kn) return kn.id==='obs'||kn.id==='crs'?'crs':kn.id==='hdg'?'hdg':kn.id==='card'?'hdg':null;
    if(kind==='cdi') return 'crs'; if(kind==='dg'||kind==='adf'||kind==='rmi') return 'hdg'; if(kind==='hsi') return x<cv.clientWidth/2?'crs':'hdg'; return null; };
  let drag=null;
  cv.addEventListener('pointerdown',e=>{ if(S.step==='debrief') return; const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, k=target(x,y); if(!k) return;
    drag={k,y:e.clientY,x:e.clientX,acc:0}; cv.setPointerCapture(e.pointerId); e.preventDefault(); });
  cv.addEventListener('pointermove',e=>{ if(!drag) return; const d=(e.clientX-drag.x)-(e.clientY-drag.y); drag.x=e.clientX; drag.y=e.clientY; drag.acc+=d/3;
    const n=Math.trunc(drag.acc); if(n){ drag.acc-=n; if(S.step==='fly'||drag.k==='crs') setCtl(drag.k,null,n); else if(S.step==='understand'&&drag.k==='hdg'){ S.u.hdg=norm(S.u.hdg+n); } } });
  const up=()=>{ drag=null; }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ if(S.step==='debrief') return; const r=cv.getBoundingClientRect(), k=target(e.clientX-r.left,e.clientY-r.top); if(!k) return; e.preventDefault(); const n=e.deltaY<0?1:-1;
    if(S.step==='fly'||k==='crs') setCtl(k,null,n*(e.shiftKey?10:1)); else S.u.hdg=norm(S.u.hdg+n); },{passive:false});
  cv.style.cursor='grab'; }
['cdi','hsi','dg','rmi','adf'].forEach(knobDrag);
/* PFD: drag the lower half (HSI) to set the heading bug, left part for the course */
(function(){ let drag=null; pfdC.addEventListener('pointerdown',e=>{ if(S.step==='debrief') return; const r=pfdC.getBoundingClientRect(), y=e.clientY-r.top, x=e.clientX-r.left; if(y<r.height*0.55) return;
  drag={k:x<r.width*0.3?'crs':'hdg',x:e.clientX,y:e.clientY,acc:0}; pfdC.setPointerCapture(e.pointerId); e.preventDefault(); });
  pfdC.addEventListener('pointermove',e=>{ if(!drag) return; const d=(e.clientX-drag.x)-(e.clientY-drag.y); drag.x=e.clientX; drag.y=e.clientY; drag.acc+=d/3; const n=Math.trunc(drag.acc); if(n){ drag.acc-=n; if(S.step==='fly'||drag.k==='crs') setCtl(drag.k,null,n); else S.u.hdg=norm(S.u.hdg+n); } });
  const up=()=>{ drag=null; }; pfdC.addEventListener('pointerup',up); pfdC.addEventListener('pointercancel',up); pfdC.style.cursor='grab'; })();

/* ---------- the run ---------- */
function tick(h){ const X=S.X, s=S.sim, ex=EXo(), Ar=A(); const act=S.pendingAct; S.pendingAct=null;
  const f=I.frame(X,Ar,s,act,h); I.trackTurn(S.J,f,h); S.J.nNow=0; ex.judge(S.J,f,X);
  if(S.J.reposition){ s.x=S.J.reposition.x; s.y=S.J.reposition.y; s.hdg=s.sel.hdg=S.J.reposition.hdg; S.J.reposition=null; S.J.pd=Infinity; S.u=null; renderBrief(); fitView(X.box); }
  if(S.watch.on) S.watch.t+=h;
  const last=S.log[S.log.length-1];
  if(!last||s.t-last.t>=0.5){ S.log.push({t:s.t,x:s.x,y:s.y,h:s.hdg,alt:s.alt,vs:s.vs,gs:s.gs,trk:s.trk,ias:s.ias,obs:X.obs,bug:s.sel.hdg,salt:s.sel.alt,n:S.J.nNow||0,ph:S.J.phase,bank:s.bank}); }
  if(S.J.done){ finish(false); return; }
  if(s.t>(ex.tmax||900)){ S.J.ev.push({code:'timeout',sev:'err',cat:'proc',p:{},t:s.t,x:s.x,y:s.y}); finish(false); return; }
  if(S.demo){ const c=ex.pilot(S.P,f,X,S.mistake||false); if(c&&c.act) S.pendingAct=c.act; I.apply(s,X,c); }
  I.step(s,h); keepInView(s.x,s.y); }
function finish(early){ S.run=false; S.started=false; const ex=EXo();
  if(early&&!S.J.done){ S.J.ev.push({code:'timeout',sev:'err',cat:'proc',p:{},t:S.sim.t,x:S.sim.x,y:S.sim.y}); }
  const g=I.grade(S.J,ex); S.res={g,demo:S.demo&&!S.mistake,first:g.first};
  if(!S.demo&&!S.mistake){ const p=PROG.ex[S.ex]=PROG.ex[S.ex]||{lv:0,best:{}}; p.best[S.lv]=Math.max(p.best[S.lv]||0,g.total); if(g.pass) p.lv=Math.max(p.lv||0,S.lv); saveP(PROG); renderLegs(); }
  /* a short closing line over the map, then it fades */
  const app=S.ex==='vordme'||S.ex==='ils', ok=S.J.done;
  el('doneB').textContent= ok? (app?(no()?'Minima. Rullebanen i sikte.':'Minimums. Runway in sight.'):(no()?'Øvelsen er ferdig.':'Exercise complete.')) : (no()?'Øvelsen avsluttet.':'Run ended.');
  el('doneS').textContent= no()?'Her er debriefen.':'Here is your debrief.';
  const dt=el('doneT'); dt.hidden=false; dt.classList.remove('fade'); clearTimeout(dt._t); dt._t=setTimeout(()=>{ dt.classList.add('fade'); dt._t=setTimeout(()=>{ dt.hidden=true; },700); },2200);
  go('debrief'); }
function report(val){ S.pendingAct={type:'report',val}; }

/* ---------- coach line ---------- */
let coachShown={k:null,t:0}, coachTxt='';
function renderCoach(force){ const box=el('coach'), J=S.J;
  const cls=c=>{ box.className='coach fly-only '+c; };
  if(!S.started&&S.step==='fly'){ cls('off'); el('coachT').textContent=no()?'Coachen snakker når du flyr.':'The coach talks once you are flying.'; el('why').hidden=true; el('whyT').hidden=true; return; }
  if(!S.coach&&!S.demo){ cls('off'); const w=J&&J.coach&&J.coach.sev==='warn'; el('coachT').textContent= w? fmt(CO[J.coach.k]||t2('',''),pw(J.coach.p)) : (no()?'Coach av. Du får fortsatt advarsler.':'Coach off. You still get warnings.'); if(w) cls('warn'); el('why').hidden=true; el('whyT').hidden=true; return; }
  const c=J&&J.coach; if(!c) return;
  const now=performance.now(), sevUp=c.sev==='warn'&&coachShown.sev!=='warn';
  if(!force&&c.k!==coachShown.k&&now-coachShown.t<2200&&!sevUp) return;  /* hold a line long enough to read it */
  const txt=fmt(CO[c.k]||t2(c.k,c.k),pw(c.p));
  if(c.k!==coachShown.k){ S.showWhy=false; }
  if(txt!==coachTxt||force||c.k!==coachShown.k){ el('coachT').textContent=txt; coachTxt=txt; }
  if(c.k!==coachShown.k) coachShown={k:c.k,t:now,sev:c.sev};
  cls(c.sev); const why=c.why&&CO[c.why]; el('why').hidden=!why; el('why').textContent=no()?'Hvorfor?':'Why?';
  el('whyT').hidden=!(why&&S.showWhy); if(why&&S.showWhy) el('whyT').textContent=fmt(CO[c.why],pw(Object.assign({rod:Math.round(I.rodFor(S.sim.gs)/10)*10},c.p))); }
el('why').onclick=()=>{ S.showWhy=!S.showWhy; renderCoach(true); };

/* ---------- data tiles ---------- */
let dataKey='';
function renderData(force){ const s=S.sim, r=readNow(), X=S.X;
  const tiles=[[no()?'Kurs':'Heading',d3(s.hdg),'bug '+d3(s.sel.hdg)],['DME',r.dme!=null&&r.dmeOk?nf1(r.dme):'—',r.dme!=null&&r.dmeOk?'NM':(X.adf?'NDB':'')],[no()?'Fart o. bakken':'Ground speed',String(Math.round(s.gs)),'kt'],
    [no()?'Høyde':'Altitude',String(Math.round(s.alt/10)*10),'sel '+Math.round(s.sel.alt)],['VS',(s.vs>=0?'+':'−')+Math.abs(Math.round(s.vs/10)*10),'ft/min'],[no()?'Stoppeklokke':'Stopwatch',mmss(S.watch.t),S.watch.on?(no()?'går · T':'running · T'):(no()?'trykk for å starte':'tap to start')]];
  const key=tiles.map(t=>t[1]+t[2]).join('|')+S.watch.on;
  if(!force&&key===dataKey) return; dataKey=key;
  if(!el('data').children.length||force){ el('data').innerHTML=tiles.map((t,i)=>`<div class="${i===5?'sw'+(S.watch.on?' run':''):''}" ${i===5?'role="button" tabindex="0" aria-label="'+esc(no()?'Start eller stopp stoppeklokken (T). Dobbeltklikk nullstiller.':'Start or stop the stopwatch (T). Double-click resets.')+'"':''}><i>${t[0]}</i><b>${t[1]}</b><small>${t[2]}</small></div>`).join('');
    const sw=el('data').children[5]; sw.onclick=toggleWatch; sw.ondblclick=()=>{ S.watch={on:false,t:0}; renderData(true); }; sw.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggleWatch(); } }; return; }
  tiles.forEach((t,i)=>{ const d=el('data').children[i]; d.children[1].textContent=t[1]; d.children[2].textContent=t[2]; if(i===5) d.className='sw'+(S.watch.on?' run':''); }); }

/* ---------- instrument values ---------- */
function stateNow(){ if(S.step==='understand'&&S.u) return S.u;
  if(S.step==='debrief'){ const p=sampleAt(S.scrub); return p?{x:p.x,y:p.y,hdg:p.h,alt:p.alt,gs:p.gs,trk:p.trk,vs:p.vs,ias:p.ias,bank:p.bank,obs:p.obs,bug:p.bug,salt:p.salt}:S.sim; }
  if(S.step==='think') return Object.assign({},S.u||S.sim,{obs:S.X.obs});
  return S.sim; }
function readNow(){ const s=stateNow(), X=S.X; const obs=s.obs!==undefined&&S.step!=='fly'?s.obs:X.obs;
  return I.read(Object.assign({gs:120,trk:s.hdg},s),A(),{nav:X.nav,obs,adf:X.adf,dme:X.dme}); }
function sampleAt(t){ const L0=S.log; if(!L0.length) return null; let lo=0,hi=L0.length-1; if(t<=L0[0].t) return L0[0]; if(t>=L0[hi].t) return L0[hi];
  while(hi-lo>1){ const m=(lo+hi)>>1; if(L0[m].t<=t) lo=m; else hi=m; } return L0[lo]; }
function renderIcap(){ const c=el('icap'); if(S.step!=='debrief'){ c.textContent=''; return; } const f=S.res&&S.res.first, at=mmss(S.scrub);
  c.innerHTML=`<b>${esc(no()?'Instrumentet ved '+at:'The instrument at '+at)}</b>${esc(f&&Math.abs(S.scrub-f.t)<1?(no()?'Dette så du da den første feilen skjedde.':'This is what you saw at the first mistake.'):(no()?'Dra i tidslinjen for å se hele flygingen.':'Drag the timeline to replay the flight.'))}`; }
function feedGauges(){ const s=stateNow(), r=readNow(), X=S.X, obs=s.obs!==undefined&&S.step!=='fly'?s.obs:X.obs, bug=s.bug!==undefined?s.bug:(s.sel?s.sel.hdg:s.hdg);
  const k=SET[S.inst]||[];
  if(k.indexOf('cdi')>=0) GA.cdi.set({obs,dots:r.flag?r.dots:0,flag:r.flag||'OFF',ils:r.ils,gsValid:!!r.gsOk,gsDots:r.gsDots||0});
  if(k.indexOf('hsi')>=0) GA.hsi.set({hdg:s.hdg,crs:obs,hsiDots:r.hsiDots||0,flag:r.flag||'OFF',ils:r.ils,gsValid:!!r.gsOk,gsDots2:clamp((r.gsDots||0)*0.4,-2.4,2.4),bug});
  if(k.indexOf('rmi')>=0) GA.rmi.set({hdg:s.hdg,qdmV:r.qdmV||0,qdmA:r.qdmA||0,vorOk:!!r.vorOk&&!r.ils,adfOk:!!r.adfOk});
  if(k.indexOf('adf')>=0) GA.adf.set({movable:false,card:0,rb:r.rb||0,adfOk:!!r.adfOk});
  if(k.indexOf('dg')>=0) GA.dg.set({hdg:s.hdg,bug});
  return {s,r,obs,bug}; }

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
function feedPFD(dt){ if(S.inst!=='pfd') return; const s=stateNow(), r=readNow(), X=S.X, obs=s.obs!==undefined&&S.step!=='fly'?s.obs:X.obs, bug=s.bug!==undefined?s.bug:(s.sel?s.sel.hdg:s.hdg);
  const nav=A().ST[X.nav], ad=X.adf&&A().ST[X.adf], vs=s.vs||0, gs=s.gs||120, tas=I.tasOf(s.ias||120,s.alt);
  const T=X.task, mins=S.ex==='vordme'?T.mda:S.ex==='ils'?T.da:null;
  drawPFD({hdg:s.hdg,ias:s.ias||120,alt:s.alt,salt:s.salt!==undefined?s.salt:(s.sel?s.sel.alt:s.alt),vs,gs,spd:s.sel?s.sel.spd:(s.ias||120),bank:s.bank||0,pitch:2+Math.asin(clamp(vs/(tas*101.27),-1,1))*R2D,
    bug,crs:obs,dev:r.hsiDots||0,flag:r.flag||'OFF',ils:r.ils,crsOk:!!nav,gsOk:!!r.gsOk,gsDots:r.gsDots||0,locDots:r.dots||0,brgOk:!!ad,brg:r.qdmA||0,adfId:ad?ad.id:'',
    dme:r.dme,dmeOk:r.dme!=null&&r.dmeOk,src:nav?(nav.type==='ILS'?'LOC '+(nav.id):'VOR '+nav.id):'',mins,wind:(!X.wind.hidden&&X.wind.spd&&S.lv<4)?X.wind:null},dt); }

/* ---------- map drawing ---------- */
function drawStation(g,s,sel){ map.drawNavaid(g,s,sel); map.P(s.x,s.y); map.label(map.sx,map.sy,`${s.id} ${s.type==='NDB'?s.f:s.f.toFixed(2)}`,s.type==='NDB'?COL.ndb:COL.vor); }
function line(g,a,b,col,w,dash){ map.P(a.x,a.y); const x1=map.sx,y1=map.sy; map.P(b.x,b.y); g.strokeStyle=col; g.lineWidth=w||2; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(map.sx,map.sy); g.stroke(); g.setLineDash([]); }
/* a course line along the bearing brg from the station, between from and to NM; the arrow shows the direction flown (fly) */
function crsLine(g,st,brg,from,to,col,lab,fly){ const a=I.at(st,brg,from), b=I.at(st,brg,to); line(g,a,b,col,2.2); const m=I.at(st,brg,from+(to-from)*0.45); map.P(m.x,m.y); map.arrowHead(g,map.sx,map.sy,map.sa(fly===undefined?brg:fly),8,col); if(lab){ map.label(map.sx,map.sy,lab,col); } }
function drawBaseLayer(){ const g=baseG, Ar=A(), X=S.X, T=X.task; g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,MW,MH);
  if(Ar.real){ if(map.region!==S.area) map.setRegion(S.area); }
  map.drawBase(g,MW,MH,{});
  if(!Ar.real){ g.fillStyle='#16242e'; g.strokeStyle='rgba(150,182,204,.32)'; g.lineWidth=1; for(const poly of Ar.coast){ g.beginPath(); for(let i=0;i<poly.length;i+=2){ map.P(poly[i],poly[i+1]); if(i) g.lineTo(map.sx,map.sy); else g.moveTo(map.sx,map.sy); } g.closePath(); g.fill(); g.stroke(); } }
  const st=Ar.ST[T.st||X.nav];
  /* DME rings round the station in use */
  if(st&&st.dme&&['orient','dme','vordme','trackIn','trackOut','intIn','intOut'].indexOf(S.ex)>=0) map.drawRings(g,st.x,st.y,5,30,135);
  /* exercise geometry, in chart colours */
  const C=COL.crs;
  switch(S.ex){
    case 'trackIn': case 'intIn': crsLine(g,st,norm(T.crs+180),22,0,C,d3(T.crs)+'°',T.crs); break;
    case 'trackOut': case 'intOut': crsLine(g,st,T.crs,0,(T.to||14)+2,C,'R'+d3(T.crs)); break;
    case 'ndb': crsLine(g,st,norm(T.crs+180),20,0,C,'QDM '+d3(T.crs),T.crs); break;
    case 'dme': { crsLine(g,st,T.r0,0,T.R,C,'R'+d3(T.r0)); const sw=diff(T.r1,T.r0); g.strokeStyle=C; g.lineWidth=2.2; g.beginPath(); for(let i=0;i<=48;i++){ const p=I.at(st,T.r0+sw*i/48,T.R); map.P(p.x,p.y); if(i) g.lineTo(map.sx,map.sy); else g.moveTo(map.sx,map.sy); } g.stroke();
      const b=I.at(st,T.r1,T.R); line(g,b,st,C,2.2); const m=I.at(st,T.r1,T.R*0.5); map.P(m.x,m.y); map.arrowHead(g,map.sx,map.sy,map.sa(T.crsIn),8,C); map.label(map.sx,map.sy,'R'+d3(T.r1),C);
      const ma=I.at(st,T.r0+sw/2,T.R); map.P(ma.x,ma.y); map.label(map.sx,map.sy,`${T.R} DME`,C); break; }
    case 'holdEntry': case 'hold': { const tas=I.tasOf(120,T.alt); map.racetrack(g,st,T.inb,T.dir,N.turnRadius(tas),tas/60*T.legS/60,{col:COL.hold,lw:2,arrow:'mid'}); break; }
    case 'pt': { crsLine(g,st,T.out,0,6,C,'R'+d3(T.out)); const p0=I.at(st,T.out,3.2), p1=I.at(p0,norm(T.out+T.side*45),2); line(g,p0,p1,C,2); map.P(p1.x,p1.y); map.arrowHead(g,map.sx,map.sy,map.sa(norm(T.out+T.side*45)),7,C);
      const p2=I.at(p1,norm(T.inb+T.side*45),1.6); line(g,p1,p2,C,1.6,[5,4]); map.P(p2.x,p2.y); map.arrowHead(g,map.sx,map.sy,map.sa(norm(T.inb+T.side*45)),7,C); map.P(p1.x,p1.y); map.label(map.sx,map.sy,d3(norm(T.out+T.side*45))+'°',C); break; }
    case 'base': { crsLine(g,st,T.ro,0,6.5,C,'R'+d3(T.ro)); crsLine(g,st,norm(T.inb+180),6,0,'rgba(240,107,180,.6)',d3(T.inb)+'°',T.inb); break; }
    case 'vordme': { const ils=Ar.ST[T.ils]; map.drawRunway(g,ils.thr,ils.end); const a=I.at(st,norm(T.crs+180),T.ifD+2); line(g,a,ils.thr,C,2.2);
      for(const [d,lab] of [[T.fafD,'FAF D'+T.fafD+' '+T.fafAlt],[T.ifD,'IF D'+T.ifD]]){ const p=I.at(st,norm(T.crs+180),d); map.P(p.x,p.y); map.drawFix(g,map.sx,map.sy,'#E6EBEF'); map.label(map.sx,map.sy,lab,'#E6EBEF'); } break; }
    case 'ils': { const ils=Ar.ST[T.ils]; map.drawRunway(g,ils.thr,ils.end); map.drawIls(g,ils,true,{cl:16,label:'LOC '+d3(T.crs)}); const gi=I.at(ils.thr,norm(T.crs+180),(T.alt-T.elev-50)/318.4); map.P(gi.x,gi.y); map.drawFix(g,map.sx,map.sy,'#7FCBE8'); map.label(map.sx,map.sy,'GS '+T.alt,COL.ils); break; }
  }
  /* runways and ILS of the area (when not drawn above) */
  if(S.ex!=='vordme'&&S.ex!=='ils') Ar.ILS.forEach(i=>{ map.drawRunway(g,i.thr,i.end); });
  Ar.APT.forEach(a=>{ map.P(a.x,a.y); map.drawAirport(g,map.sx,map.sy); });
  Ar.NAV.forEach(n=>{ if(n.type!=='ILS') drawStation(g,n,n.id===X.nav||n.id===X.adf||n.id===(T&&T.st)); });
  map.reserve(0,0,Math.min(MW,360),40); map.reserve(MW-90,0,90,96);
  map.drawNorth(g,MH); map.drawScaleBar(g,MH); map.flushLabels(g,MW,MH);
  baseDirty=false; }
function trailPath(g,pts,tmax,colFn){ if(pts.length<2) return; g.lineWidth=2.4; g.lineCap='round'; g.lineJoin='round';
  let prev=null; for(const p of pts){ if(p.t>tmax) break; map.P(p.x,p.y); if(prev){ g.strokeStyle=colFn?colFn(p):COL.trail; g.beginPath(); g.moveTo(prev[0],prev[1]); g.lineTo(map.sx,map.sy); g.stroke(); } prev=[map.sx,map.sy]; } }
const nCol=p=>p.n>1?COL.bad:p.n>0.6?COL.mid:p.n>0?COL.good:'rgba(255,255,255,.7)';
function drawIdeal(g){ const P=S.ideal; if(!P||P.length<2) return; g.save(); g.strokeStyle='rgba(127,203,232,.75)'; g.lineWidth=1.8; g.setLineDash([7,6]); g.beginPath(); P.forEach((p,i)=>{ map.P(p.x,p.y); if(i) g.lineTo(map.sx,map.sy); else g.moveTo(map.sx,map.sy); }); g.stroke(); g.restore(); }
function drawMap(){ if(MW<80||MH<80||!(map.v.k>0)) return; const g=mapG; if(baseDirty) drawBaseLayer();
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,mapC.width,mapC.height); g.drawImage(baseC,0,0); g.setTransform(dpr,0,0,dpr,0,0);
  const X=S.X, Ar=A(), T=X.task;
  if(S.step==='understand'||S.step==='think') drawLesson(g);
  if(S.step==='fly'){ trailPath(g,S.log,Infinity); const s=S.sim; map.drawAircraft(g,s.x,s.y,s.hdg,{size:15}); }
  if(S.step==='debrief'){ drawIdeal(g); trailPath(g,S.log,Infinity,p=>p.t<=S.scrub?nCol(p):'rgba(255,255,255,.18)');
    const f=S.res&&S.res.first; S.J.ev.filter(e=>e.sev==='err'||e.sev==='warn').forEach(e=>{ map.P(e.x,e.y); g.strokeStyle=e===f?COL.bad:e.sev==='err'?'rgba(239,100,80,.6)':'rgba(240,180,64,.7)'; g.lineWidth=e===f?3:1.6; g.beginPath(); g.arc(map.sx,map.sy,e===f?13:7,0,TAU); g.stroke(); });
    if(f){ map.P(f.x,f.y); const lab=(no()?'Første feil ':'First mistake ')+mmss(f.t); g.font=`600 12px ${FB}`; const w=g.measureText(lab).width+14; let lx=map.sx+16, ly=map.sy-28; if(lx+w>MW-8) lx=map.sx-16-w; if(ly<8) ly=map.sy+16;
      g.fillStyle='rgba(239,100,80,.95)'; map.rrect(g,lx,ly,w,20,3); g.fill(); g.fillStyle='#fff'; g.textAlign='left'; g.textBaseline='middle'; g.fillText(lab,lx+7,ly+10.5); }
    const p=sampleAt(S.scrub); if(p) map.drawAircraft(g,p.x,p.y,p.h,{size:15}); }
  /* wind badge */
  if(S.step!=='debrief'&&!X.wind.hidden&&!(S.lv>=4)&&X.wind.spd>0){ const w=S.step==='fly'&&S.sim.wnow?S.sim.wnow:X.wind; map.drawWind(g,MW,w.dir,w.spd); }
  drawProfile(); }
/* the lesson picture on the map (Understand and Think first) */
function drawLesson(g){ const X=S.X, Ar=A(), T=X.task, u=S.u||{x:X.ac.x,y:X.ac.y,hdg:X.ac.hdg}, st=Ar.ST[T.st||X.nav];
  const r=readNow();
  if(S.step==='understand'){
    if(S.ex==='orient'){ g.font=`500 10.5px ${FM}`; for(let a=0;a<360;a+=30){ const p=I.at(st,a,30); line(g,st,p,'rgba(99,217,160,.22)',1); const lp=I.at(st,a,11); map.P(lp.x,lp.y); g.fillStyle='rgba(99,217,160,.75)'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('R'+d3(a),map.sx,map.sy); }
      const rad=N.radial(st,u); line(g,st,I.at(st,rad,Math.hypot(u.x-st.x,u.y-st.y)+6),COL.vor,2.4); }
    if(['trackIn','trackOut','intIn','intOut','pt','base','vordme'].indexOf(S.ex)>=0&&st){ const crs=S.ex==='vordme'||S.ex==='trackIn'||S.ex==='intIn'?norm(T.crs+180):S.ex==='pt'?T.out:S.ex==='base'?T.ro:T.crs;
      /* the needle's live range: ±10° round the course line (beyond it the needle is pinned) */
      g.fillStyle='rgba(240,107,180,.10)'; g.beginPath(); map.P(st.x,st.y); g.moveTo(map.sx,map.sy); for(let a=-10;a<=10;a+=2){ const p=I.at(st,crs+a,30); map.P(p.x,p.y); g.lineTo(map.sx,map.sy); } g.closePath(); g.fill(); }
    if(S.ex==='intIn'||S.ex==='intOut'){ const l=I.lineRel(st,T.crs,u); for(const [ang,col] of [[30,'#E6EBEF'],[45,'rgba(230,235,239,.55)']]){ const h=I.interceptHdg(T.crs,l.xt,ang), p=I.at(u,h,3.2); line(g,u,p,col,1.6,[4,4]); map.P(p.x,p.y); map.arrowHead(g,map.sx,map.sy,map.sa(h),7,col); map.label(map.sx,map.sy,d3(h)+' ('+ang+'°)',col); } }
    if(S.ex==='ndb'){ const w=X.wind.spd?X.wind:{dir:norm(T.crs+90),spd:25}; const tas=120; let p={x:u.x,y:u.y}; g.strokeStyle='rgba(245,188,76,.9)'; g.lineWidth=2; g.setLineDash([6,5]); g.beginPath(); map.P(p.x,p.y); g.moveTo(map.sx,map.sy);
      for(let i=0;i<900;i++){ const b=N.bearing(st.x-p.x,st.y-p.y), wt=N.windTriangle(tas,b,w.dir,w.spd); p.x+=wt.vx/3600*2; p.y+=wt.vy/3600*2; map.P(p.x,p.y); g.lineTo(map.sx,map.sy); if(Math.hypot(st.x-p.x,st.y-p.y)<0.3) break; } g.stroke(); g.setLineDash([]);
      const tl=I.at(st,norm(T.crs+180),Math.max(2,Math.hypot(u.x-st.x,u.y-st.y))); line(g,tl,st,'rgba(99,217,160,.95)',2.4); if(!X.wind.spd){ map.drawWind(g,MW,w.dir,w.spd); } }
    if(S.ex==='dme'){ g.strokeStyle='rgba(240,107,180,.35)'; g.lineWidth=1; map.P(st.x,st.y); g.beginPath(); g.arc(map.sx,map.sy,T.R*map.v.k,0,TAU); g.stroke(); line(g,u,st,'rgba(99,217,160,.6)',1.4,[3,4]); }
    if(S.ex==='holdEntry'){ const R=4.2, d=T.dir, rng=[['teardrop',0,70],['direct',70,250],['parallel',250,360]];
      for(const [en,a,b] of rng){ g.fillStyle=COL[en]; g.globalAlpha=0.16; g.beginPath(); map.P(st.x,st.y); g.moveTo(map.sx,map.sy); for(let rel=a;rel<=b;rel+=3){ const brg=norm(T.inb-d*rel); const p=I.at(st,brg,R); map.P(p.x,p.y); g.lineTo(map.sx,map.sy); } g.closePath(); g.fill(); g.globalAlpha=1;
        const mid=I.at(st,norm(T.inb-d*(a+b)/2),R*0.75); map.P(mid.x,mid.y); g.font=`600 12px ${FB}`; g.fillStyle=COL[en]; g.textAlign='center'; g.textBaseline='middle'; g.fillText(L(W.entry[en]),map.sx,map.sy); }
      /* the 70° line */
      const a70=I.at(st,norm(T.inb-d*70),R+1), b70=I.at(st,norm(T.inb-d*70+180),R+1); line(g,a70,b70,'rgba(230,235,239,.55)',1.2,[4,4]); }
    if(S.ideal&&['hold','pt','base','dme','holdEntry'].indexOf(S.ex)>=0) drawIdeal(g);
    if(S.ex==='vordme'||S.ex==='ils') drawIdeal(g);
    map.drawAircraft(g,u.x,u.y,u.hdg,{size:16,ring:true,handle:true});
    /* live readout in the lesson panel */
    const live=el('uLive'); if(live) live.innerHTML=lessonLive(u,r);
  } else { map.drawAircraft(g,X.ac.x,X.ac.y,X.ac.hdg,{size:15}); }
}
function lessonLive(u,r){ const X=S.X, T=X.task, Ar=A(), st=Ar.ST[T.st||X.nav];
  switch(S.ex){
    case 'orient': return `${no()?'Du er på radial':'You are on radial'} <b>${d3(N.radial(st,u))}</b> · ${no()?'kurs':'heading'} ${d3(u.hdg)}`;
    case 'holdEntry': { const e=H.entry(T.inb,T.dir,u.hdg); return `${no()?'Kurs':'Heading'} <b>${d3(u.hdg)}</b> → <b>${esc(L(W.entry[e.entry]))}</b>${e.alt?` ${no()?'(eller':'(or'} ${esc(L(W.entry[e.alt]))})`:''}`; }
    case 'ndb': return `${no()?'Nål':'Needle'} <b>${Math.round(diff(r.rb,0))>0?'+':''}${Math.round(diff(r.rb,0))}°</b> · ${no()?'kurs + nål =':'heading + needle ='} QDM <b>${d3(r.qdmA)}</b>`;
    case 'dme': return `DME <b>${nf1(r.dme)}</b> · ${no()?'radial':'radial'} <b>${d3(N.radial(st,u))}</b>`;
    case 'ils': return `LOC <b>${nf1(r.dots)}</b> ${no()?'prikker':'dots'} · GS <b>${r.gsOk?nf1(r.gsDots):'—'}</b> · ${Math.round(u.alt)} ft`;
    case 'vordme': { const D=r.dme, pa=I.profileAlt(D-T.k,T.elev); return `DME <b>${nf1(D)}</b> · ${no()?'profil':'profile'} <b>${Math.round(pa/10)*10}</b> ft · ${no()?'du':'you'} <b>${Math.round(u.alt)}</b> ft`; }
    default: return `${r.flag||''} · ${no()?'nål':'needle'} <b>${nf1(Math.abs(r.dots||0))}</b> ${no()?'prikker':'dots'} ${(r.dots||0)>0.05?(no()?'høyre':'right'):(r.dots||0)<-0.05?(no()?'venstre':'left'):''} · OBS <b>${d3(S.X.obs)}</b>`;
  } }

/* approach profile strip (VOR/DME and ILS) */
const profC=el('prof'), profG=profC.getContext('2d'); let PW=0,PH=0;
function sizeProf(){ const r=profC.getBoundingClientRect(); PW=Math.round(r.width); PH=Math.round(r.height); const d=Math.min(devicePixelRatio||1,2); profC.width=Math.round(PW*d); profC.height=Math.round(PH*d); profG.setTransform(d,0,0,d,0,0); }
function profGeom(){ const X=S.X, T=X.task, Ar=A();
  if(S.ex==='vordme'){ const st=Ar.ST[T.st]; return {dT:p=>Math.max(0,Math.hypot(p.x-st.x,p.y-st.y)-T.k),max:T.ifD-T.k+2,top:T.fafAlt+600,elev:T.elev,mins:T.mda,faf:T.fafD-T.k,tbl:T.table.map(q=>({d:q.dme-T.k,alt:q.alt,lab:'D'+q.dme}))}; }
  const ils=Ar.ST[T.ils]; return {dT:p=>Math.max(0,-I.lineRel(ils.thr,T.crs,p).along),max:14,top:T.alt+700,elev:T.elev,mins:T.da,faf:(T.alt-T.elev-50)/318.4,tbl:[]}; }
function drawProfile(){ const show=S.ex==='vordme'||S.ex==='ils'; if(el('profw').hidden===show){ el('profw').hidden=!show; sizeProf(); sizeMap(); } if(!show) return; if(!PW) sizeProf(); if(PW<80||PH<40) return;
  const g=profG, G0=profGeom(), l=46, r=12, t=12, b=20, w=PW-l-r, h=PH-t-b;
  const X_=d=>l+w*(1-d/G0.max), Y_=a=>t+h*(1-(a-G0.elev)/(G0.top-G0.elev));
  g.clearRect(0,0,PW,PH); g.fillStyle='#0c141a'; g.fillRect(0,0,PW,PH);
  g.strokeStyle='rgba(255,255,255,.06)'; g.lineWidth=1; g.font=`500 10px ${FM}`; g.fillStyle='#6B7C86'; g.textAlign='right'; g.textBaseline='middle';
  for(let a=Math.ceil(G0.elev/500)*500;a<=G0.top;a+=500){ const y=Y_(a); g.beginPath(); g.moveTo(l,y); g.lineTo(PW-r,y); g.stroke(); g.fillText(String(a),l-6,y); }
  g.textAlign='center'; g.textBaseline='top'; for(let d=0;d<=G0.max;d+=2){ g.fillText(String(d),X_(d),PH-b+4); }
  /* ground, profile, minimums */
  g.fillStyle='#22313c'; g.fillRect(l,Y_(G0.elev),w,2);
  g.strokeStyle=COL.crs; g.lineWidth=2; g.beginPath(); g.moveTo(X_(0),Y_(I.profileAlt(0,G0.elev))); g.lineTo(X_(G0.faf),Y_(I.profileAlt(G0.faf,G0.elev))); g.lineTo(X_(G0.max),Y_(I.profileAlt(G0.faf,G0.elev))); g.stroke();
  g.strokeStyle='rgba(240,180,64,.85)'; g.setLineDash([5,4]); g.beginPath(); g.moveTo(l,Y_(G0.mins)); g.lineTo(PW-r,Y_(G0.mins)); g.stroke(); g.setLineDash([]);
  g.fillStyle='#F0B440'; g.textAlign='left'; g.textBaseline='bottom'; g.fillText((S.ex==='ils'?'DA ':'MDA ')+G0.mins,l+4,Y_(G0.mins)-2);
  g.fillStyle='#E6EBEF'; G0.tbl.forEach(q=>{ g.beginPath(); g.arc(X_(q.d),Y_(q.alt),2.5,0,TAU); g.fill(); });
  g.fillStyle='#9EADB7'; g.textAlign='center'; g.textBaseline='bottom'; g.fillText('FAF',X_(G0.faf),Y_(I.profileAlt(G0.faf,G0.elev))-5);
  /* the flight */
  const pts=S.step==='fly'||S.step==='debrief'?S.log:[]; const tmax=S.step==='debrief'?S.scrub:Infinity;
  g.lineWidth=2; let prev=null; for(const p of pts){ if(p.t>tmax) break; const x=X_(G0.dT(p)), y=Y_(p.alt); if(prev){ g.strokeStyle=S.step==='debrief'?nCol(p):'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(prev[0],prev[1]); g.lineTo(x,y); g.stroke(); } prev=[x,y]; }
  const s=stateNow(); if(s){ const x=X_(G0.dT(s)), y=Y_(s.alt); g.fillStyle='#fff'; g.beginPath(); g.arc(x,y,5,0,TAU); g.fill(); g.strokeStyle='#0c141a'; g.lineWidth=1.5; g.stroke(); }
  g.fillStyle='#6B7C86'; g.textAlign='right'; g.textBaseline='top'; g.fillText(no()?'NM til terskel':'NM to threshold',PW-r,t-2); }

/* ---------- timeline (debrief) ---------- */
const tlC=el('tl'), tlG=tlC.getContext('2d',{willReadFrequently:true}); let TW=0,TH=0;
function sizeTl(){ const r=tlC.getBoundingClientRect(); TW=Math.round(r.width); TH=Math.round(r.height); const d=Math.min(devicePixelRatio||1,2); tlC.width=Math.round(TW*d); tlC.height=Math.round(TH*d); tlG.setTransform(d,0,0,d,0,0); }
function drawTl(){ if(S.step!=='debrief') return; if(!TW) sizeTl(); if(TW<80) return; const g=tlG, Lg=S.log; g.clearRect(0,0,TW,TH); if(!Lg.length) return;
  const t1=Lg[Lg.length-1].t||1, x0=10, x1=TW-10, X_=t=>x0+(x1-x0)*t/t1, y=TH*0.58;
  /* accuracy band along the run */
  for(let i=1;i<Lg.length;i++){ const p=Lg[i]; g.fillStyle=p.n>1?COL.bad:p.n>0.6?COL.mid:p.n>0?'rgba(99,217,160,.75)':'rgba(255,255,255,.14)'; g.fillRect(X_(Lg[i-1].t),y-3,Math.max(1,X_(p.t)-X_(Lg[i-1].t)+0.5),6); }
  /* phase changes */
  g.font=`500 10px ${FM}`; g.fillStyle='#6B7C86'; g.textAlign='left'; g.textBaseline='alphabetic';
  g.fillText('0:00',x0,TH-6); g.textAlign='right'; g.fillText(mmss(t1),x1,TH-6);
  const f=S.res&&S.res.first;
  S.J.ev.filter(e=>e.sev!=='info').forEach(e=>{ const x=X_(e.t); g.fillStyle=e.sev==='err'?COL.bad:e.sev==='warn'?COL.mid:COL.good; g.beginPath(); g.arc(x,y,e===f?6:3.5,0,TAU); g.fill(); });
  if(f){ const x=X_(f.t); g.strokeStyle=COL.bad; g.lineWidth=2; g.beginPath(); g.moveTo(x,y-8); g.lineTo(x,12); g.stroke(); g.font=`600 11px ${FB}`; const lab=(no()?'Første feil':'First mistake'); const w=g.measureText(lab).width+12; const lx=clamp(x-w/2,0,TW-w);
    g.fillStyle=COL.bad; map.rrect(g,lx,2,w,16,3); g.fill(); g.fillStyle='#fff'; g.textAlign='left'; g.textBaseline='middle'; g.fillText(lab,lx+6,10.5); }
  /* scrub head */
  const sx=X_(S.scrub); g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.moveTo(sx,y-12); g.lineTo(sx,y+12); g.stroke(); g.fillStyle='#fff'; g.beginPath(); g.arc(sx,y,5,0,TAU); g.fill();
  g.font=`500 11px ${FM}`; g.textAlign=sx>TW-60?'right':'left'; g.textBaseline='alphabetic'; g.fillStyle='#fff'; g.fillText(mmss(S.scrub),sx+(sx>TW-60?-8:8),TH-6); }
(function(){ let dn=false; const set=e=>{ const r=tlC.getBoundingClientRect(); const Lg=S.log; if(!Lg.length) return; const t1=Lg[Lg.length-1].t; S.scrub=clamp((e.clientX-r.left-10)/(r.width-20),0,1)*t1; S.replay=false; renderPlay(); };
  tlC.addEventListener('pointerdown',e=>{ dn=true; tlC.setPointerCapture(e.pointerId); set(e); }); tlC.addEventListener('pointermove',e=>{ if(dn) set(e); }); tlC.addEventListener('pointerup',()=>dn=false); tlC.addEventListener('pointercancel',()=>dn=false);
  tlC.tabIndex=0; tlC.addEventListener('keydown',e=>{ if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ e.preventDefault(); S.scrub=Math.max(0,S.scrub+(e.key==='ArrowRight'?5:-5)); S.replay=false; renderPlay(); } }); })();
el('play').onclick=()=>{ const Lg=S.log; if(!Lg.length) return; if(!S.replay&&S.scrub>=Lg[Lg.length-1].t-0.5) S.scrub=0; S.replay=!S.replay; renderPlay(); };
function debriefPts(){ const P=S.log.map(p=>({x:p.x,y:p.y})); if(S.ideal) S.ideal.forEach((p,i)=>{ if(i%6===0) P.push({x:p.x,y:p.y}); }); return P.length?P.concat(S.X.box):S.X.box; }

/* ---------- map interaction (Understand: drag the aircraft and its heading; peek) ---------- */
(function(){ let drag=null;
  const hit=e=>{ const p=map.evPx(e), u=S.u; if(!u) return null; map.P(u.x,u.y); const ax=map.sx, ay=map.sy, a=map.sa(u.hdg), hx=ax+Math.sin(a)*34, hy=ay-Math.cos(a)*34;
    if(Math.hypot(p.x-hx,p.y-hy)<16) return 'hdg'; if(Math.hypot(p.x-ax,p.y-ay)<26) return 'pos'; return 'pos-far'; };
  mapC.addEventListener('pointerdown',e=>{ if(S.step!=='understand') return; const h=hit(e); if(!h) return; drag=h==='pos-far'?'pos':h; mapC.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
  const move=e=>{ if(!drag||!S.u) return; const n=map.evNm(e); if(drag==='pos'){ S.u.x=n.x; S.u.y=n.y;
      /* holding entry: proceeding direct, the aircraft points at the fix */
      if(S.ex==='holdEntry'){ const st=A().ST[S.X.task.st]; S.u.hdg=Math.round(N.bearing(st.x-n.x,st.y-n.y))||360; } } else { map.P(S.u.x,S.u.y); const p=map.evPx(e); S.u.hdg=norm(Math.round(N.bearing(p.x-map.sx,-(p.y-map.sy))+map.v.rot))||360; } };
  mapC.addEventListener('pointermove',e=>{ if(drag) move(e); else if(S.step==='understand'){ const h=hit(e); mapC.style.cursor=h==='hdg'?'grab':h==='pos'?'move':'crosshair'; } else mapC.style.cursor='default'; });
  const up=()=>{ drag=null; }; mapC.addEventListener('pointerup',up); mapC.addEventListener('pointercancel',up);
  /* profile strip: drag up and down in Understand */
  let pd=false; const pset=e=>{ if(!S.u) return; const r=profC.getBoundingClientRect(), G0=profGeom(), t=12, b=20, h=r.height-t-b; const a=G0.elev+(1-(e.clientY-r.top-t)/h)*(G0.top-G0.elev); S.u.alt=clamp(Math.round(a/10)*10,G0.elev,G0.top); };
  profC.addEventListener('pointerdown',e=>{ if(S.step!=='understand') return; pd=true; profC.setPointerCapture(e.pointerId); pset(e); }); profC.addEventListener('pointermove',e=>{ if(pd) pset(e); }); profC.addEventListener('pointerup',()=>pd=false);
  /* hold to peek at a hidden map */
  const pk=el('peek'); const on=e=>{ e.preventDefault(); if(!S.peek){ S.peek=true; S.peeks++; } el('veil').style.opacity='0'; }, off=()=>{ S.peek=false; el('veil').style.opacity=''; };
  pk.addEventListener('pointerdown',on); pk.addEventListener('pointerup',off); pk.addEventListener('pointerleave',off); pk.addEventListener('pointercancel',off);
  pk.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') on(e); }); pk.addEventListener('keyup',off); })();
el('mapBtn').onclick=()=>{ S.mapOpen=!S.mapOpen; el('trainer').classList.toggle('mapopen',S.mapOpen); renderBar(); requestAnimationFrame(()=>{ sizeMap(); sizeProf(); }); };

/* ---------- legend ---------- */
function renderLegend(){ const items=[]; const s=S.step;
  if(s==='debrief'){ items.push(['#63D9A0',no()?'innenfor':'inside limits'],['#F0B440',no()?'nær grensen':'near the limit'],['#EF6450',no()?'utenfor':'outside'],['rgba(127,203,232,.9)',no()?'instruktøren (stiplet)':'instructor (dashed)']); }
  else if(s==='understand'&&S.ex==='ndb') items.push(['#F5BC4C',no()?'homing i denne vinden (stiplet)':'homing in this wind (dashed)'],['#63D9A0','tracking'],['#F06BB4',no()?'ønsket spor':'wanted track']);
  else if(s==='understand'&&['hold','pt','base','dme','holdEntry','vordme','ils'].indexOf(S.ex)>=0) items.push(['rgba(127,203,232,.9)',no()?'flydd i denne vinden':'flown in this wind']);
  el('legend').innerHTML=items.map(([c,t])=>`<span><i style="border-color:${c}${/dashed|stiplet|vinden|wind/.test(t)?';border-top-style:dashed':''}"></i>${esc(t)}</span>`).join(''); el('legend').hidden=!items.length;
  el('mapNote').textContent=A().real?(no()?'Ekte navigasjonsdata · kun for trening, ikke for navigasjon':'Real navaid data · for training only, not for navigation'):(no()?'Øvingsområde · fiktive stasjoner':'Practice area · fictional stations'); }

/* ---------- render everything for a step ---------- */
function renderAll(){ renderBar(); renderBrief(); renderLegend();
  if(S.step==='understand') renderLesson();
  if(S.step==='think') renderThink();
  if(S.step==='debrief') renderDeb();
  if(S.step==='fly'){ renderCtl(); renderData(true); }
  renderTbar(); renderCoach(true); renderPlay();
  el('veil').hidden=!(S.step==='fly'&&S.X.hidden); el('veilB').textContent=no()?'Kartet er skjult':'Map hidden'; el('veilP').textContent=no()?'Bygg bildet fra instrumentene. Hvor er du, og hvor er kursen?':'Build the picture from the instruments. Where are you, and where is the course?'; el('peek').textContent=no()?'Hold for å kikke':'Hold to peek';
  requestAnimationFrame(()=>{ layoutInst(); sizeMap(); sizeProf(); sizeTl(); }); }

/* ---------- the frame loop ---------- */
let last=performance.now(), lastUi=0;
function loop(ts){ const dt=Math.min(0.1,Math.max(0,(ts-last)/1000)); last=ts;
  if(S.step==='fly'&&S.run&&!S.paused){ let rem=dt*S.speed; while(rem>1e-6&&S.run){ const h=Math.min(0.1,rem); tick(h); rem-=h; } }
  if(S.step==='debrief'&&S.replay&&S.log.length){ S.scrub+=dt*8; const t1=S.log[S.log.length-1].t; if(S.scrub>=t1){ S.scrub=t1; S.replay=false; renderPlay(); } }
  if(S.step==='fly'&&S.run&&ts-lastUi>120){ lastUi=ts; renderCoach(false); renderData(false); syncCtl(); const c=el('clk'); if(c) c.textContent=mmss(S.sim.t); }
  feedGauges(); for(const k of SET[S.inst]||[]) if(GA[k]){ GA[k].tick(dt); GA[k].draw(); }
  feedPFD(dt); drawMap(); drawTl(); if(S.step==='debrief'&&S.scrub!==S._icapT){ S._icapT=S.scrub; renderIcap(); }
  requestAnimationFrame(loop); }

/* ---------- start ---------- */
LAB.start('ifr');
LAB.add({},{'Birdbird · Training':'Birdbird · Trening','IFR trainer':'IFR-trener','Training only · not for navigation':'Kun trening · ikke for navigasjon','Thirteen exercises, easy to hard':'Tretten øvelser, fra lett til vanskelig',
  'Each one has four levels: map and no wind, then wind, then the map hidden, then hidden gusty wind. Pass a level to light its bar.':'Hver øvelse har fire nivåer: kart og ingen vind, så vind, så skjult kart, så skjult byget vind. Bestå et nivå for å tenne streken.',
  'What the trainer models':'Hva treneren modellerer','Limits and tolerances':'Grenser og toleranser','Real and practice data':'Ekte data og øvingsdata',
  'Radio navigation, one idea at a time. See the picture first, think it through, fly it with a coach that tells you why, then watch the replay with your first mistake marked and what to do instead.':'Radionavigasjon, én idé om gangen. Se bildet først, tenk gjennom det, fly med en coach som forteller hvorfor, og se så reprisen med den første feilen markert og hva du gjør i stedet.'});
LAB.tx({n1:'Standardsvinger (høyst 25° krengning), stigning og sink til valgt høyde med valgt rate, sann fart som øker rundt 2 % per 1000 ft, og vind som er jevn eller byget og skiftende. Kursmarkøren virker som en enkel autopilot: flyet svinger mot den, samme vei som du vred den. Misvisningen er satt til null, så kart og instrumenter stemmer.',
  n2:'Poengene bruker grensene fra EASA IR-ferdighetsprøven: ±100 ft, kurs innenfor ±5°, halvt utslag på ILS, aldri under MDA. Holding følger ICAO PANS-OPS: høyresvinger om ikke annet er sagt, legg på 1 minutt til og med 14 000 ft, innganger bestemt av kurs med 5° slingringsmonn på hver side av en sektorlinje. Prosedyresvingen bruker Cat A/B-tiden på 1 minutt.',
  n3:'Bergen og Oslo bruker ekte posisjoner og frekvenser for navigasjonshjelpemidler (OurAirports), kun for trening. Prosedyrene som flys der er illustrasjoner, ikke publiserte kart. Øvingsområdet er fiktivt: Holmvik, Kvist, Fjell og Ravn finnes ikke. Bruk aldri treneren til navigasjon.'});
LAB.onLang(()=>{ renderLegs(); renderAll(); });
/* a link can open an exercise: ifr.html#hold, ifr.html#ils */
const hashEx=(location.hash||'').slice(1); if(I.EX[hashEx]) S.ex=hashEx;
if(A().real) map.setRegion(S.area);
S.seed=Math.floor(Math.random()*9000)+1; setup(); renderLegs(); go('understand');
if(I.EX[hashEx]) requestAnimationFrame(()=>el('trainer').scrollIntoView({block:'start'}));
new ResizeObserver(()=>{ layoutInst(); }).observe(el('inst'));
new ResizeObserver(()=>{ sizeMap(); }).observe(mapC);
new ResizeObserver(()=>{ sizeProf(); }).observe(profC);
new ResizeObserver(()=>{ sizeTl(); }).observe(tlC);
addEventListener('hashchange',()=>{ const h=(location.hash||'').slice(1); if(I.EX[h]&&h!==S.ex){ newExercise(h); } });
requestAnimationFrame(loop);
/* test hooks (used by the browser tests) */
window.__IFR={S,I,setup,go,start,finish,report,setCtl,act,AREAS,newExercise,map,
  /* advance the running sim by `sec` seconds at once (tests) */
  advance(sec){ const end=S.sim.t+sec; while(S.run&&S.step==='fly'&&S.sim.t<end) tick(0.1); }};
})();
