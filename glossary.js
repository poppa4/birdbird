/* Birdbird – glossary.js: one shared glossary for the IFR trainer and the Virtual Labs.
   G: id → [term, short (what it stands for, plain words), one or two plain sentences, lab page that explains it (optional)].
   Terms and texts are EN/NO ({en,no}); a term that is the same in both languages is a plain string.
   PAT: what to look for in a text, in order (the first alternative that matches at a position wins).
   UI: chips(text) → escaped HTML with the first mention of each term as a small button (IFR trainer, class "gl");
   mark(root) marks the first mention per section of known abbreviations in lab body text (class "glt", dotted underline);
   one shared popover (#glPop) opens on tap or click, and on hover for the lab marks. EASA / ICAO terminology.
   Teaching text, not for operational use. Also loads in Node (module.exports) for the data test. */
(function(G0){
'use strict';
const t2=(en,no)=>({en,no});
const G={
 /* ---------- the IFR trainer set ---------- */
 vor:['VOR',t2('radio station for navigation','radiostasjon for navigasjon'),t2('A station on the ground that sends out 360 lines (radials). The VOR needle shows whether the line you chose is to your left or right.','En stasjon på bakken som sender ut 360 linjer (radialer). VOR-nålen viser om linjen du har valgt, ligger til venstre eller høyre for deg.'),'radionav.html'],
 ndb:['NDB',t2('non-directional radio beacon','radiofyr uten retningsinformasjon'),t2('A simple beacon on the ground. The ADF needle in the aircraft points straight at it.','Et enkelt fyr på bakken. ADF-nålen i flyet peker rett mot det.'),'radionav.html'],
 adf:['ADF',t2('the receiver for NDB beacons','mottakeren for NDB-fyr'),t2('Automatic direction finder: the instrument whose needle points at the beacon you have tuned.','Automatisk radiopeiler: instrumentet med nålen som peker mot fyret du har stilt inn.'),'radionav.html'],
 dme:['DME',t2('distance to the station','avstand til stasjonen'),t2('Distance measuring equipment. Shows how far you are from the station in nautical miles (NM). It measures slant distance, so high above the station it reads more than the distance over the ground.','Avstandsmåleutstyr. Viser hvor langt du er fra stasjonen, i nautiske mil (NM). Den måler skrådistanse, så høyt over stasjonen viser den mer enn avstanden over bakken.'),'radionav.html'],
 cdi:['CDI',t2('course deviation indicator','kursavviksindikator'),t2('The VOR needle. It moves left or right to show which side the course you set is on.','VOR-nålen. Den går til venstre eller høyre og viser hvilken side kursen du har stilt inn, ligger på.'),'radionav.html'],
 hsi:['HSI',t2('horizontal situation indicator','horisontal situasjonsindikator'),t2('A compass card and the course needle in one instrument. You see the course as a line, the way it lies seen from the aircraft.','En kompasskive og kursnålen i ett instrument. Du ser kursen som en strek, slik den ligger sett fra flyet.'),'radionav.html'],
 rmi:['RMI',t2('radio magnetic indicator','radiomagnetisk indikator'),t2('A compass card with needles that point to the stations. Head of the needle: direction to the station. Tail: direction from it.','En kompasskive med nåler som peker mot stasjonene. Hodet på nålen: retningen til stasjonen. Halen: retningen fra den.'),'radionav.html'],
 rbi:['RBI',t2('relative bearing indicator','relativ peileindikator'),t2('An ADF whose card does not turn. The needle shows the beacon counted from the nose, so you add your heading yourself.','En ADF der skiven ikke dreier. Nålen viser fyret målt fra nesen, så du må legge til headingen selv.'),'radionav.html'],
 pfd:['PFD',t2('primary flight display','hovedskjerm for flyging'),t2('The main screen in a glass cockpit: attitude, speed, altitude and navigation together.','Hovedskjermen i en glasscockpit: flystilling, fart, høyde og navigasjon samlet.'),'gyros.html'],
 obs:['OBS',t2('the course knob','kursknappen'),t2('Omni bearing selector: the knob that sets the course on a VOR instrument. On some instruments it is labelled CRS.','Omni bearing selector: knappen som stiller inn kursen på et VOR-instrument. På noen instrumenter heter den CRS.'),'radionav.html'],
 crs:['CRS',t2('course','kurs'),t2('The course you have set with the course knob: the line you want to fly along.','Kursen du har stilt inn med kursknappen: linjen du vil fly langs.'),'radionav.html'],
 hdg:['HDG',t2('heading','heading (styrekurs)'),t2('The direction the nose points. It is not always the direction you move: wind pushes you sideways.','Retningen nesen peker. Det er ikke alltid retningen du beveger deg: vinden skyver deg sideveis.'),'gennav.html'],
 heading:['heading',t2('where the nose points','dit nesen peker (styrekurs)'),t2('The direction the nose points, in degrees. Course is the line you want to follow. In wind the two differ by a few degrees.','Retningen nesen peker, i grader. Kurs er linjen du vil følge. I vind skiller de to seg med noen grader.'),'gennav.html'],
 qdm:['QDM',t2('magnetic bearing to the station','magnetisk peiling til stasjonen'),t2('The direction to fly to get to the station. For an NDB: heading + ADF needle = QDM.','Retningen du må fly for å komme til stasjonen. For en NDB: heading + ADF-nål = QDM.'),'radionav.html'],
 qdr:['QDR',t2('magnetic bearing from the station','magnetisk peiling fra stasjonen'),t2('The direction from the station to you. For a VOR this is your radial. QDR = QDM ± 180.','Retningen fra stasjonen til deg. For en VOR er dette radialen din. QDR = QDM ± 180.'),'radionav.html'],
 radial:['radial',t2('a line out from a VOR','en linje ut fra en VOR'),t2('One of 360 lines that leave a VOR station. It is named after its magnetic direction from the station: radial 090 points east.','Én av 360 linjer som går ut fra en VOR-stasjon. Den har navn etter den magnetiske retningen fra stasjonen: radial 090 peker østover.'),'radionav.html'],
 flag:['TO / FROM',t2('the flag on the VOR instrument','flagget på VOR-instrumentet'),t2('TO: the course you set leads to the station. FROM: it leads away from the station.','TO: kursen du har stilt inn, fører til stasjonen. FROM: den fører bort fra stasjonen.'),'radionav.html'],
 faf:['FAF',t2('final approach fix','final approach fix'),t2('The fix where the final descent towards the runway starts on a non-precision approach. On an ILS the same job is done by the FAP.','Fiksen der den siste nedstigningen mot rullebanen starter på en ikke-presisjonsinnflyging. På en ILS gjør FAP samme jobben.'),'holding.html'],
 mda:['MDA',t2('minimum descent altitude','minste nedstigningshøyde'),t2('The lowest altitude on an approach without a glide path (2D). Level off there. Never go below it unless you see the runway.','Laveste høyde på en innflyging uten glidebane (2D). Flat ut der. Gå aldri under den uten at du ser rullebanen.'),'holding.html'],
 da:['DA',t2('decision altitude','beslutningshøyde (altitude)'),t2('On an approach with a glide path (3D): the altitude, above mean sea level, where you decide. Runway in sight: land. If not: go around at once.','På en innflyging med glidebane (3D): høyden over havet der du bestemmer deg. Rullebanen i sikte: land. Hvis ikke: avbryt med en gang.'),'holding.html'],
 ils:['ILS',t2('instrument landing system','instrumentlandingssystem'),t2('Two radio beams to the runway: the localiser (left and right) and the glide slope (up and down).','To radiostråler mot rullebanen: localiseren (venstre og høyre) og glidebanen (opp og ned).'),'holding.html'],
 loc:['localiser',t2('the beam along the runway (LOC)','strålen langs rullebanen (LOC)'),t2('The part of an ILS that shows left and right of the runway centre line. Its needle is about four times as sensitive as a VOR needle.','Den delen av en ILS som viser venstre og høyre for rullebanens senterlinje. Nålen er rundt fire ganger så følsom som en VOR-nål.'),'holding.html'],
 gs:['glide slope',t2('the beam down to the runway','strålen ned mot rullebanen'),t2('The part of an ILS that slopes down to the runway at about 3°. Its needle shows whether you are above or below that path.','Den delen av en ILS som skrår ned mot rullebanen med rundt 3°. Nålen viser om du er over eller under banen.'),'holding.html'],
 gp:['glide path',t2('the path down to the runway','banen ned mot rullebanen'),t2('A sloping path to the runway, about 3°. On an ILS it is a radio beam (the glide slope). On a GNSS approach it is calculated.','En skrå bane ned mot rullebanen, rundt 3°. På en ILS er den en radiostråle (glide slope). På en GNSS-innflyging er den beregnet.'),'holding.html'],
 lnav:['LNAV',t2('lateral navigation','sideveis navigasjon'),t2('A GNSS approach with guidance left and right only, no glide path. You manage the descent yourself, down to an MDA.','En GNSS-innflyging med veiledning bare sideveis, uten glidebane. Du styrer nedstigningen selv, ned til en MDA.'),'gnss.html'],
 vnav:['VNAV',t2('vertical navigation','vertikal navigasjon'),t2('A glide path worked out by the aircraft, here from the altimeter (baro-VNAV). Flown down to a DA.','En glidebane som flyet regner ut, her fra høydemåleren (baro-VNAV). Flys ned til en DA.'),'gnss.html'],
 lpv:['LPV',t2('localiser performance with vertical guidance','localiser-ytelse med vertikal veiledning'),t2('The most precise GNSS approach, using SBAS. Needles for left/right and up/down that behave like an ILS. Flown down to a DA.','Den mest presise GNSS-innflygingen, med SBAS. Nåler for venstre/høyre og opp/ned som oppfører seg som en ILS. Flys ned til en DA.'),'gnss.html'],
 rnp:['RNP',t2('required navigation performance','påkrevd navigasjonsytelse'),t2('Navigation to a set accuracy that the aircraft monitors itself, normally with GNSS. An RNP approach can have LNAV, LNAV/VNAV and LPV minima.','Navigasjon med en fastsatt nøyaktighet som flyet selv overvåker, vanligvis med GNSS. En RNP-innflyging kan ha LNAV-, LNAV/VNAV- og LPV-minima.'),'gnss.html'],
 rnav:['RNAV',t2('area navigation','områdenavigasjon'),t2('Flying straight lines between waypoints instead of from station to station.','Å fly rette linjer mellom waypoints i stedet for fra stasjon til stasjon.'),'gnss.html'],
 sid:['SID',t2('standard instrument departure','standard utflygingsrute'),t2('A published route from the runway out to the en-route structure.','En publisert rute fra rullebanen og ut til rutenettet.'),'gnss.html'],
 star:['STAR',t2('standard instrument arrival','standard innflygingsrute'),t2('A published route from the en-route structure in to the approach.','En publisert rute fra rutenettet og inn til innflygingen.'),'gnss.html'],
 tas:['TAS',t2('true airspeed','sann flyhastighet'),t2('Your real speed through the air. Higher than the indicated airspeed, more so the higher and warmer you fly.','Den virkelige farten din gjennom lufta. Høyere enn indikert fart, mer jo høyere og varmere du flyr.'),'airdata.html'],
 gsp:['ground speed',t2('speed over the ground','fart over bakken'),t2('Your true airspeed plus or minus the wind. It decides how fast you must descend on an approach.','Sann flyhastighet pluss eller minus vinden. Den bestemmer hvor fort du må gå ned på en innflyging.'),'gennav.html'],
 vs:['VS',t2('vertical speed','vertikal hastighet'),t2('How fast you climb or descend, in feet per minute.','Hvor fort du stiger eller går ned, i fot per minutt.'),'airdata.html'],
 abeam:['abeam',t2('straight out to the side','rett ut til siden (tvers)'),t2('A point is abeam when it is level with your wingtip, 90° from the nose.','Et punkt er tvers når det ligger rett ut for vingetippen, 90° fra nesen.'),'holding.html'],
 homing:['homing',t2('following the needle','å følge nålen'),t2('Keeping the nose pointed at the beacon. In a crosswind you fly a curve, not a line.','Å holde nesen pekende mot fyret. I sidevind flyr du en bue, ikke en linje.'),'radionav.html'],
 tracking:['tracking',t2('flying a straight line over the ground','å fly en rett linje over bakken'),t2('Holding a heading a little into the wind so that your path over the ground is straight.','Å holde en heading litt opp mot vinden, slik at banen din over bakken blir rett.'),'radionav.html'],
 bracketing:['bracketing',t2('finding the heading for the wind','å finne headingen for vinden'),t2('Try a correction, watch the needle, then halve the change. Repeat until the needle stays still.','Prøv en korreksjon, se på nålen, og halver endringen. Gjenta til nålen står i ro.'),'radionav.html'],
 lead:['lead radial',t2('the radial where you start the turn','radialen der du starter svingen'),t2('A radial a few degrees before the one you want. Start the turn there and you finish it on the course.','En radial noen grader før den du skal ha. Start svingen der, så ender den på kursen.'),'radionav.html'],
 rate1:[t2('standard turn','standardsving'),t2('3° every second','3° i sekundet'),t2('The normal turn in instrument flying (rate one). Half a circle, 180°, takes 1 minute.','Den vanlige svingen i instrumentflyging (rate one). En halv sirkel, 180°, tar 1 minutt.'),'holding.html'],
 teardrop:['teardrop',t2('an entry shaped like a drop','en inngang formet som en dråpe'),t2('A holding entry. Fly out 30° off the outbound course for 1 minute, then turn back onto the inbound course.','En inngang til holding. Fly ut 30° fra kursen ut i 1 minutt, og sving så tilbake inn på kursen inn.'),'holding.html'],
 dot:[t2('dot','prikk'),t2('a mark on the needle scale','et merke på nålens skala'),t2('On a VOR each dot is 2°, and five dots (the needle at the side) is 10°. On a localiser each dot is only about 0.5°.','På en VOR er hver prikk 2°, og fem prikker (nålen helt ute) er 10°. På en localiser er hver prikk bare rundt 0,5°.'),'radionav.html'],
 fix:[t2('fix','fiks'),t2('a named point in the air','et navngitt punkt i lufta'),t2('A position you can find with your instruments: over a station, or on a radial at a DME distance.','En posisjon du kan finne med instrumentene: over en stasjon, eller på en radial i en DME-avstand.'),'holding.html'],
 waypoint:['waypoint',t2('a point in the navigation system','et punkt i navigasjonssystemet'),t2('A named position stored in the navigation database. Routes are flown from waypoint to waypoint.','En navngitt posisjon lagret i navigasjonsdatabasen. Ruter flys fra waypoint til waypoint.'),'gnss.html'],
 flyby:['fly-by',t2('turn before the waypoint','sving før waypointet'),t2('You start the turn just before the waypoint and cut the corner, so the turn ends on the next leg.','Du starter svingen like før waypointet og kutter hjørnet, så svingen ender på neste legg.'),'gnss.html'],
 inbound:[t2('inbound','inn'),t2('towards the station or fix','mot stasjonen eller fiksen'),t2('Flying towards the station or the fix. The inbound course is the line that leads to it.','Å fly mot stasjonen eller fiksen. Kursen inn er linjen som fører dit.'),'holding.html'],
 outbound:[t2('outbound','ut'),t2('away from the station or fix','bort fra stasjonen eller fiksen'),t2('Flying away from the station or the fix.','Å fly bort fra stasjonen eller fiksen.'),'holding.html'],
 missed:[t2('missed approach','avbrutt innflyging'),t2('the route you climb away on','ruten du stiger ut på'),t2('What you fly when you reach the minimum and cannot see the runway: climb straight ahead, then turn as published.','Det du flyr når du når minimum og ikke ser rullebanen: stig rett frem, og sving så som publisert.'),'holding.html'],
 intercept:[t2('intercept','skjære inn'),t2('get onto a course from the side','komme inn på en kurs fra siden'),t2('Fly towards the course at an angle, usually 30° to 45°, and turn onto it when you get there.','Fly mot kursen på skrå, vanligvis 30° til 45°, og sving inn på den når du er fremme.'),'radionav.html'],
 locator:[t2('locator','lokator'),t2('a small NDB near the runway','en liten NDB nær rullebanen'),t2('A low-power beacon on the final course. Passing it tells you where you are on the approach.','Et svakt fyr på sluttkursen. Når du passerer det, vet du hvor du er på innflygingen.'),'holding.html'],
 clearance:[t2('clearance','klarering'),t2('the instruction from air traffic control','instruksen fra flygelederen'),t2('What the controller authorises you to fly. In the IFR trainer it is the task for the exercise.','Det flygelederen gir deg tillatelse til å fly. I IFR-treneren er det oppgaven for øvelsen.')],

 /* ---------- added for the labs: altimetry and speeds ---------- */
 qnh:['QNH',t2('altimeter setting for altitude','høydemålerinnstilling for høyde over havet'),t2('Set QNH and the altimeter shows altitude above mean sea level; on the runway it reads the aerodrome elevation.','Med QNH innstilt viser høydemåleren høyde over havet; på rullebanen viser den flyplassens høyde.'),'airdata.html'],
 qfe:['QFE',t2('altimeter setting for height','høydemålerinnstilling for høyde over flyplassen'),t2('Set QFE and the altimeter shows height above the aerodrome (or runway threshold); on the runway it reads zero.','Med QFE innstilt viser høydemåleren høyde over flyplassen (eller terskelen); på rullebanen viser den null.'),'airdata.html'],
 qne:['QNE',t2('standard setting 1013.25 hPa','standardinnstilling 1013,25 hPa'),t2('With 1013.25 hPa set, the altimeter shows pressure altitude. Above the transition altitude you fly flight levels on this setting.','Med 1013,25 hPa innstilt viser høydemåleren trykkhøyde. Over overgangshøyden flyr du flygenivåer med denne innstillingen.'),'airdata.html'],
 fl:['FL',t2('flight level','flygenivå'),t2('Pressure altitude in hundreds of feet, with 1013.25 hPa set: FL100 is 10 000 ft on the standard setting.','Trykkhøyde i hundre fot, med 1013,25 hPa innstilt: FL100 er 10 000 ft på standardinnstillingen.'),'airdata.html'],
 isa:['ISA',t2('international standard atmosphere','internasjonal standardatmosfære'),t2('The reference atmosphere: 1013.25 hPa and +15 °C at sea level, cooling about 2 °C per 1000 ft. Instruments are calibrated to it.','Referanseatmosfæren: 1013,25 hPa og +15 °C ved havet, med rundt 2 °C kaldere per 1000 ft. Instrumentene er kalibrert etter den.'),'airdata.html'],
 oat:['OAT',t2('outside air temperature','utetemperatur'),t2('The temperature of the air around the aircraft. With pressure altitude it gives density altitude and true airspeed.','Temperaturen i lufta rundt flyet. Sammen med trykkhøyden gir den tetthetshøyde og sann flyhastighet.'),'airdata.html'],
 ias:['IAS',t2('indicated airspeed','indikert fart'),t2('What the airspeed indicator shows, from the difference between total and static pressure. Stall and limit speeds are given in IAS.','Det fartsmåleren viser, fra forskjellen mellom totaltrykk og statisk trykk. Stallfart og grensefarter oppgis i IAS.'),'airdata.html'],
 cas:['CAS',t2('calibrated airspeed','kalibrert fart'),t2('IAS corrected for instrument and position error. In normal flight it is within a few knots of IAS.','IAS korrigert for instrument- og posisjonsfeil. I normal flyging er den innenfor noen knop av IAS.'),'airdata.html'],
 eas:['EAS',t2('equivalent airspeed','ekvivalent fart'),t2('CAS corrected for compressibility. It matters at high speed and altitude; the structure feels EAS.','CAS korrigert for kompressibilitet. Den betyr noe i høy fart og høyde; strukturen kjenner EAS.'),'airdata.html'],

 /* ---------- approach and minimum altitudes ---------- */
 dh:['DH',t2('decision height','beslutningshøyde (height)'),t2('Like DA, but measured above the runway threshold. Used mainly for Category II and III approaches, read from the radio altimeter.','Som DA, men målt over terskelen. Brukes mest på kategori II- og III-innflyginger og leses av radiohøydemåleren.'),'holding.html'],
 msa:['MSA',t2('minimum sector altitude','minste sektorhøyde'),t2('The lowest safe altitude within 25 NM of a navigation aid or waypoint on the approach chart, with at least 1000 ft clearance above obstacles.','Laveste sikre høyde innenfor 25 NM fra et navigasjonshjelpemiddel eller waypoint på innflygingskartet, med minst 1000 ft klaring over hindringer.'),'holding.html'],
 mea:['MEA',t2('minimum en-route altitude','minste rutehøyde'),t2('The lowest altitude on a route segment that gives both obstacle clearance and adequate navigation signal reception.','Laveste høyde på et rutesegment som gir både hindringsklaring og god nok mottak av navigasjonssignaler.'),'gennav.html'],
 moca:['MOCA',t2('minimum obstacle clearance altitude','minste hindringsklaringshøyde'),t2('The lowest altitude on a route segment that gives the required obstacle clearance. Navigation signal reception is not guaranteed there.','Laveste høyde på et rutesegment som gir påkrevd hindringsklaring. Mottak av navigasjonssignaler er ikke sikret der.'),'gennav.html'],
 iaf:['IAF',t2('initial approach fix','initial approach fix'),t2('The fix where the approach procedure begins, coming from the route or a hold.','Fiksen der innflygingsprosedyren begynner, fra ruten eller en holding.'),'holding.html'],
 if:['IF',t2('intermediate fix','intermediate fix'),t2('The fix between the initial and the final segment, where you settle on the final course and configure.','Fiksen mellom det innledende og det siste segmentet, der du etablerer deg på sluttkursen og gjør flyet klart.'),'holding.html'],
 fap:['FAP',t2('final approach point','final approach point'),t2('On a precision approach: where the final descent starts, at the glide slope intercept altitude.','På en presisjonsinnflyging: der den siste nedstigningen starter, i høyden der du fanger glidebanen.'),'holding.html'],
 mapt:['MAPt',t2('missed approach point','punkt for avbrutt innflyging'),t2('On a non-precision approach: the point where you must start the missed approach if you do not see the runway.','På en ikke-presisjonsinnflyging: punktet der du må starte avbrutt innflyging hvis du ikke ser rullebanen.'),'holding.html'],
 cdfa:['CDFA',t2('continuous descent final approach','kontinuerlig nedstigning på sluttinnflygingen'),t2('Flying a non-precision approach on one steady descent path to the minimum, with no level-off before it.','Å fly en ikke-presisjonsinnflyging på én jevn nedstigningsbane ned til minimum, uten å flate ut før.'),'holding.html'],
 rvr:['RVR',t2('runway visual range','rullebanesikt'),t2('How far along the runway a pilot on the centre line can see the runway markings or lights. Approach minima are often given in RVR.','Hvor langt en flyger på senterlinjen kan se rullebanemerkingen eller lysene. Innflygingsminima gis ofte i RVR.'),'wxreports.html'],

 /* ---------- satellite navigation ---------- */
 gnss:['GNSS',t2('global navigation satellite system','globalt satellittnavigasjonssystem'),t2('Satellite navigation in general: GPS, Galileo and others. The receiver works out its position from the time the signals take to arrive.','Satellittnavigasjon generelt: GPS, Galileo og andre. Mottakeren regner ut posisjonen fra tiden signalene bruker.'),'gnss.html'],
 gps:['GPS',t2('the US satellite navigation system','det amerikanske satellittnavigasjonssystemet'),t2('One GNSS constellation. In everyday speech "GPS" often means any satellite navigation.','Én GNSS-konstellasjon. I dagligtale betyr «GPS» ofte all satellittnavigasjon.'),'gnss.html'],
 sbas:['SBAS',t2('satellite-based augmentation system','satellittbasert forbedringssystem'),t2('Corrections and integrity data sent from geostationary satellites (EGNOS in Europe). Needed for LPV approaches.','Korreksjoner og integritetsdata sendt fra geostasjonære satellitter (EGNOS i Europa). Trengs for LPV-innflyginger.'),'gnss.html'],
 raim:['RAIM',t2('receiver autonomous integrity monitoring','integritetsovervåking i mottakeren'),t2('The receiver checks the satellites against each other and warns you if the position may be wrong.','Mottakeren sjekker satellittene mot hverandre og varsler deg hvis posisjonen kan være feil.'),'gnss.html'],
 pbn:['PBN',t2('performance-based navigation','ytelsesbasert navigasjon'),t2('The ICAO concept where a route or approach states the accuracy it needs (RNAV or RNP), not which equipment to use.','ICAO-konseptet der en rute eller innflyging sier hvilken nøyaktighet den krever (RNAV eller RNP), ikke hvilket utstyr som skal brukes.'),'gnss.html'],

 /* ---------- planning and performance ---------- */
 tod:['TOD',t2('top of descent','toppen av nedstigningen'),t2('Where you start the descent. Rule of thumb on a 3° path: distance in NM = height to lose in thousands of feet × 3.','Der du starter nedstigningen. Tommelfingerregel på en 3°-bane: avstand i NM = høyde som skal tapes i tusen fot × 3.'),'flightplanning.html'],
 nm:['NM',t2('nautical mile','nautisk mil'),t2('1852 m: one minute of latitude. Distances in aviation are given in NM, speeds in knots (NM per hour).','1852 m: ett breddeminutt. Avstander i luftfart oppgis i NM, farter i knop (NM per time).'),'gennav.html'],
 v1:['V1',t2('take-off decision speed','beslutningsfart ved start'),t2('The highest speed at which you can still start to stop, and the lowest at which you can continue the take-off after an engine failure.','Den høyeste farten der du fortsatt kan begynne å stoppe, og den laveste der du kan fortsette starten etter motorstans.'),'performance.html'],
 vr:['VR',t2('rotation speed','rotasjonsfart'),t2('The speed at which you raise the nose to lift off.','Farten der du løfter nesen for å lette.'),'performance.html'],
 v2:['V2',t2('take-off safety speed','sikker startfart'),t2('The speed to reach by 35 ft and to hold in the climb with one engine failed.','Farten du skal ha innen 35 ft og holde i stigningen med én motor ute.'),'performance.html'],
 vref:['VREF',t2('reference landing speed','referansefart for landing'),t2('The speed at 50 ft over the threshold in the landing configuration: at least 1.23 × the stall speed in that configuration (1.3 on older types).','Farten 50 ft over terskelen i landingskonfigurasjon: minst 1,23 × stallfarten i den konfigurasjonen (1,3 på eldre typer).'),'performance.html'],
 vmca:['VMCA',t2('minimum control speed in the air','minste kontrollfart i lufta'),t2('The lowest speed at which you can keep straight with the critical engine failed, full rudder and up to 5° bank towards the live engine.','Den laveste farten der du kan holde retningen med kritisk motor ute, fullt sideror og inntil 5° krengning mot motoren som går.'),'propeller.html'],

 /* ---------- instruments, automation and operations ---------- */
 ahrs:['AHRS',t2('attitude and heading reference system','referansesystem for holdning og kurs'),t2('Solid-state sensors that replace the spinning gyros: they measure turn rates and accelerations and work out attitude and heading.','Elektroniske sensorer som erstatter de roterende gyroene: de måler dreiehastighet og akselerasjon og regner ut holdning og kurs.'),'gyros.html'],
 ap:['AP',t2('autopilot','autopilot'),t2('Flies the aircraft to the modes you select: heading, altitude, vertical speed or a navigation source.','Flyr flyet etter modusene du velger: heading, høyde, vertikal hastighet eller en navigasjonskilde.'),'autoflight.html'],
 fd:['FD',t2('flight director','flight director'),t2('Command bars on the attitude display that show the pitch and bank to fly to follow the selected modes.','Kommandostreker på holdningsinstrumentet som viser hvilken stigning og krengning du skal fly for å følge de valgte modusene.'),'autoflight.html'],
 tcas:['TCAS',t2('traffic collision avoidance system','antikollisjonssystem'),t2('Warns of nearby transponder traffic: a traffic advisory first, then a resolution advisory telling you to climb or descend. Follow the RA.','Varsler om trafikk med transponder i nærheten: først et trafikkråd, så et unnvikelsesråd som ber deg stige eller sige. Følg RA.'),'autoflight.html'],
 egpws:['EGPWS',t2('enhanced ground proximity warning system','utvidet bakkenærhetsvarsling'),t2('Warns when you get too close to terrain, using a terrain database ahead of the aircraft as well as the radio altimeter.','Varsler når du kommer for nær terrenget, med en terrengdatabase foran flyet i tillegg til radiohøydemåleren.'),'autoflight.html'],
 imc:['IMC',t2('instrument meteorological conditions','instrumentværforhold'),t2('Weather below the minima for visual flight: you fly by the instruments, and spatial disorientation is the main human hazard.','Vær under minima for visuell flyging: du flyr etter instrumentene, og romlig desorientering er den største menneskelige faren.'),'orientation.html'],
 atc:['ATC',t2('air traffic control','flygekontroll'),t2('The service that separates aircraft and issues clearances.','Tjenesten som holder fly atskilt og gir klareringer.')],
 metar:['METAR',t2('routine aerodrome weather report','rutinemessig værrapport for flyplass'),t2('The observed weather at an aerodrome, normally every 30 or 60 minutes: wind, visibility, weather, cloud, temperature and QNH.','Observert vær på en flyplass, vanligvis hvert 30. eller 60. minutt: vind, sikt, vær, skyer, temperatur og QNH.'),'wxreports.html'],
 taf:['TAF',t2('terminal aerodrome forecast','flyplassvarsel'),t2('The forecast for an aerodrome, with changes marked BECMG, TEMPO and PROB.','Værvarselet for en flyplass, med endringer merket BECMG, TEMPO og PROB.'),'wxreports.html'],
 cg:['CG',t2('centre of gravity','tyngdepunkt'),t2('The point the weight acts through. Forward CG: more stable, heavier controls, higher stall speed. Aft CG: less stable, lighter controls.','Punktet vekten virker gjennom. Fremre tyngdepunkt: mer stabilt, tyngre ror, høyere stallfart. Bakre: mindre stabilt, lettere ror.'),'stability.html'],
 mac:['MAC',t2('mean aerodynamic chord','midlere aerodynamisk korde'),t2('The average chord of the wing. CG positions are often given in % MAC.','Vingens gjennomsnittlige korde. Tyngdepunktet oppgis ofte i % MAC.'),'stability.html']
};
/* what to look for. The IFR trainer list first, in its order; then the added terms. Ids with no pattern never auto-mark (IF, ATC). */
const PAT=[['VOR','vor'],['NDB','ndb'],['ADF','adf'],['DME','dme'],['CDI','cdi'],['HSI','hsi'],['RMI','rmi'],['RBI','rbi'],['PFD','pfd'],['OBS','obs'],['CRS','crs'],['HDG','hdg'],['QDM','qdm'],['QDR','qdr'],
  ['FROM','flag'],['FAF','faf'],['MDA','mda'],['DA','da'],['ILS','ils'],['LNAV','lnav'],['VNAV','vnav'],['LPV','lpv'],['RNP','rnp'],['RNAV','rnav'],['SID','sid'],['STAR','star'],['TAS','tas'],['VS','vs'],
  ['[Ll]ead radial|[Ll]ead-radial(?:en)?','lead'],['[Rr]adial(?:s|en|er|ene)?','radial'],['[Ll]ocali[sz]er(?:en)?','loc'],['[Gg]lide slope|[Gg]lidebanenål(?:en)?','gs'],['[Gg]lide path|[Gg]lidebane(?:n)?','gp'],
  ['[Gg]round speed|[Ff]art over bakken','gsp'],['[Aa]beam|[Tt]vers','abeam'],['[Hh]oming','homing'],['[Tt]racking','tracking'],['[Bb]racketing','bracketing'],
  ['[Ss]tandard turns?|[Ss]tandardsving(?:er|en)?','rate1'],['[Tt]eardrop(?:-inngang)?','teardrop'],['dots?|prikk(?:er|en)?','dot'],['[Ff]ly-by','flyby'],['[Ww]aypoints?|[Ww]aypoint(?:et|ene)','waypoint'],
  ['[Mm]issed approach|[Aa]vbrutt innflyging','missed'],['[Ll]ocator(?:en)?|[Ll]okator(?:en)?','locator'],['[Hh]eading(?:en)?','heading'],['[Ii]ntercept(?:s|ed)?|[Ss]kjær(?:e|er)? inn','intercept'],
  ['[Ii]nbound','inbound'],['[Oo]utbound','outbound'],['[Ff]ix|[Ff]iks(?:en)?','fix'],['[Cc]learance|[Kk]larering(?:en)?','clearance'],
  ['QNH','qnh'],['QFE','qfe'],['QNE','qne'],['FL(?:\\s?\\d{2,3})?','fl'],['ISA','isa'],['OAT','oat'],['IAS','ias'],['CAS','cas'],['EAS','eas'],['DH','dh'],['MSA','msa'],['MEA','mea'],['MOCA','moca'],
  ['IAF','iaf'],['FAP','fap'],['MAPt','mapt'],['CDFA','cdfa'],['RVR','rvr'],['LOC','loc'],['GNSS','gnss'],['GPS','gps'],['SBAS','sbas'],['RAIM','raim'],['PBN','pbn'],['TOD','tod'],['NM','nm'],
  ['V1','v1'],['VR','vr'],['V2','v2'],['VREF','vref'],['VMCA','vmca'],['AHRS','ahrs'],['AP','ap'],['FD','fd'],['TCAS','tcas'],['EGPWS','egpws'],['IMC','imc'],
  ['METAR','metar'],['TAF','taf'],['CG','cg'],['MAC','mac']];
const BD='A-Za-zÆØÅæøåÄÖäö0-9';
const mkRe=list=>new RegExp('(^|[^'+BD+'])(?:'+list.map(p=>'('+p[0]+')').join('|')+')(?!['+BD+'])','g');
const RE=mkRe(PAT);
/* lab body text: abbreviations only (a term in capitals); words like heading, fix or dot stay plain there */
const isAbbr=id=>{ const t=G[id]&&G[id][0]; return typeof t==='string'&&/^[A-Z][A-Za-z0-9]*[A-Z0-9]$/.test(t)&&(t.match(/[A-Z]/g)||[]).length>=2||id==='loc'||id==='v1'||id==='v2'||id==='mapt'; };
const PAT_LAB=PAT.filter(p=>isAbbr(p[1])&&/^[A-Z]/.test(p[0])&&p[1]!=='flag'&&p[1]!=='ap'&&p[1]!=='fd'&&p[1]!=='nm');
const RE_LAB=mkRe(PAT_LAB);

const API={G,PAT,PAT_LAB};
if(typeof module!=='undefined'&&module.exports){ module.exports=API; return; }

/* ---------- browser UI ---------- */
const lang=()=>(G0.LAB&&G0.LAB.lang)||(document.documentElement.lang==='nb'?'no':'en');
const L=o=>o&&typeof o==='object'?(lang()==='no'?o.no:o.en):(o==null?'':String(o));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const term=id=>{ const g=G[id]; return g?L(g[0]):''; };
const LABN={'radionav.html':t2('Radio navigation','Radionavigasjon'),'holding.html':t2('Holding and instrument approach','Holding og instrumentinnflyging'),'gnss.html':t2('GNSS and RNAV','GNSS og RNAV'),
  'airdata.html':t2('Air data','Luftdata'),'gennav.html':t2('General navigation','Generell navigasjon'),'gyros.html':t2('Attitude and heading','Holdning og kurs'),'performance.html':t2('Take-off and landing performance','Start- og landingsytelse'),
  'flightplanning.html':t2('Climb, cruise and fuel','Stigning, marsj og drivstoff'),'propeller.html':t2('Engine failure and VMCA','Motorstans og VMCA'),'autoflight.html':t2('Automation and warnings','Automatikk og varsling'),
  'orientation.html':t2('Spatial orientation','Romlig orientering'),'wxreports.html':t2('Reading the weather','Les værmeldingen'),'stability.html':t2('Stability and CG','Stabilitet og CG')};
const pick=(m,list)=>{ for(let j=0;j<list.length;j++) if(m[j+2]!==undefined) return j; return -1; };
/* text → HTML with chips: the first mention of each term, at most max in one text. skip: ids not to mark. cls: chip class */
/* NM is everywhere in the trainer texts: no chip there, it would take a slot from the terms that matter */
const CHIP_SKIP={nm:1};
function chips(s,max,skip,cls){ s=String(s==null?'':s); const seen=Object.assign({},CHIP_SKIP,skip||{}); let out='', i=0, n=0, m; max=max===undefined?3:max; cls=cls||'gl'; RE.lastIndex=0;
  while(n<max&&(m=RE.exec(s))){ const k=pick(m,PAT); if(k<0) continue; const id=PAT[k][1], w=m[k+2], at=m.index+m[1].length;
    RE.lastIndex=at+w.length; if(seen[id]) continue; seen[id]=1; n++;
    out+=esc(s.slice(i,at))+`<button type="button" class="${cls}" data-gl="${id}" aria-haspopup="dialog">${esc(w)}</button>`; i=at+w.length; }
  return out+esc(s.slice(i)); }
/* the same for text that already holds simple markup (<b>…</b>): only the text between the tags is searched */
function chipsH(h,max,cls){ const seen=Object.assign({},CHIP_SKIP); let n=0; max=max===undefined?3:max; cls=cls||'gl'; return String(h).split(/(<[^>]+>)/).map(part=>{ if(part.charAt(0)==='<'||n>=max) return part;
    let out='', i=0, m; RE.lastIndex=0;
    while(n<max&&(m=RE.exec(part))){ const k=pick(m,PAT); if(k<0) continue; const id=PAT[k][1], w=m[k+2], at=m.index+m[1].length;
      RE.lastIndex=at+w.length; if(seen[id]) continue; seen[id]=1; n++; out+=part.slice(i,at)+`<button type="button" class="${cls}" data-gl="${id}" aria-haspopup="dialog">${w}</button>`; i=at+w.length; }
    return out+part.slice(i); }).join(''); }

/* one shared popover; it lives in <body>, or inside the open dialog so it is not hidden behind it */
let cur=null, hovT=0, outT=0;
function close(){ const p=document.getElementById('glPop'); if(p) p.hidden=true; if(cur){ cur.setAttribute('aria-expanded','false'); cur=null; } }
function open(b){ const id=b.dataset.gl, g=G[id]; if(!g) return; let p=document.getElementById('glPop');
  if(!p){ p=document.createElement('div'); p.id='glPop'; p.className='glpop'; p.setAttribute('role','dialog'); p.setAttribute('aria-live','polite');
    p.addEventListener('mouseenter',()=>clearTimeout(outT)); p.addEventListener('mouseleave',()=>{ if(cur&&cur.classList.contains('glt')) outT=setTimeout(close,250); }); }
  const host=b.closest('dialog')||document.body; if(p.parentNode!==host) host.appendChild(p);
  const here=(location.pathname.split('/').pop()||'index.html'), lab=g[3]&&g[3]!==here?g[3]:null;
  p.innerHTML=`<div class="gh"><b>${esc(term(id))}</b><button type="button" class="gx" aria-label="${esc(lang()==='no'?'Lukk':'Close')}">×</button></div><span class="gn">${esc(L(g[1]))}</span><p>${esc(L(g[2]))}</p>`+
    (lab?`<a class="glab" href="${esc(lab)}">${esc(lang()==='no'?'Lær mer':'Learn more')}: ${esc(L(LABN[lab]||t2('Virtual Lab','Virtual Lab')))} <span aria-hidden="true">→</span></a>`:'');
  p.hidden=false; cur=b; b.setAttribute('aria-expanded','true'); p.querySelector('.gx').onclick=e=>{ e.stopPropagation(); const f=cur; close(); if(f) f.focus({preventScroll:true}); };
  const r=b.getBoundingClientRect(), pw0=Math.min(320,innerWidth-16); p.style.width=pw0+'px'; const ph=p.offsetHeight;
  let x=Math.round(r.left+r.width/2-pw0/2); x=Math.max(8,Math.min(innerWidth-pw0-8,x)); let y=r.bottom+8; if(y+ph>innerHeight-8&&r.top-ph-8>8) y=r.top-ph-8;
  p.style.left=x+'px'; p.style.top=Math.round(y)+'px'; }
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('.gl[data-gl],.glt[data-gl]'); if(b){ e.preventDefault(); e.stopPropagation(); clearTimeout(hovT); if(cur===b&&!b._hov) close(); else { close(); open(b); } b._hov=false; return; }
  if(cur&&!(e.target.closest&&e.target.closest('#glPop'))) close(); },true);
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&cur){ const f=cur; close(); f.focus({preventScroll:true}); e.stopPropagation(); } },true);
addEventListener('scroll',()=>{ if(cur) close(); },{passive:true}); addEventListener('resize',()=>{ if(cur) close(); });
/* hover (mouse only) opens the lab marks after a short pause */
const fine=()=>matchMedia('(hover:hover) and (pointer:fine)').matches;
document.addEventListener('mouseover',e=>{ const b=e.target.closest&&e.target.closest('.glt[data-gl]'); if(!b||!fine()) return; clearTimeout(outT); if(cur===b) return;
  clearTimeout(hovT); hovT=setTimeout(()=>{ close(); open(b); b._hov=true; },350); });
document.addEventListener('mouseout',e=>{ const b=e.target.closest&&e.target.closest('.glt[data-gl]'); if(!b) return; clearTimeout(hovT); if(cur===b) outT=setTimeout(close,250); });

/* ---------- lab body text: mark the first mention per section ----------
   Opt in with class "gloss" on a container (a page section). Never inside headings, links, buttons, SVG, inputs, code,
   the quiz, or text that lab.js translates node by node (data-ltx). At most one mark per term per section, MAXSEC in all; NM is too common to mark. */
const NOPE='h1,h2,h3,h4,h5,h6,a,button,svg,input,select,textarea,code,pre,kbd,samp,label,summary,output,canvas,script,style,.glt,.gl,[data-ltx],.no-gloss,.quiz,.qopts,#qbox,.eyebrow,.tag,.vchip,.ctl,.seg,nav,figure svg';
const OK='p,li,dd,dt,td,figcaption,blockquote';
const MAXSEC=8;
function mark(sec){ if(!sec||!sec.isConnected) return 0;
  const seen={}; sec.querySelectorAll('.glt[data-gl]').forEach(b=>{ seen[b.dataset.gl]=1; }); let n=Object.keys(seen).length; if(n>=MAXSEC) return 0;
  const tw=document.createTreeWalker(sec,NodeFilter.SHOW_TEXT,{acceptNode(t){ const v=t.nodeValue; if(!v||v.length<2||!/[A-Z]/.test(v)) return NodeFilter.FILTER_REJECT;
    const pe=t.parentElement; if(!pe||pe.closest(NOPE)||!pe.closest(OK)) return NodeFilter.FILTER_REJECT; if(pe.closest('[hidden]')) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; }});
  const list=[]; let t; while((t=tw.nextNode())) list.push(t);
  let added=0;
  for(const node of list){ if(n>=MAXSEC) break; let s=node.nodeValue, m, at0=0; const frag=[]; RE_LAB.lastIndex=0;
    while(n<MAXSEC&&(m=RE_LAB.exec(s))){ const k=pick(m,PAT_LAB); if(k<0) continue; const id=PAT_LAB[k][1], w=m[k+2], at=m.index+m[1].length; RE_LAB.lastIndex=at+w.length;
      if(seen[id]) continue; seen[id]=1; n++; frag.push([at,w,id]); }
    if(!frag.length) continue;
    const df=document.createDocumentFragment(); let i=0;
    frag.forEach(([at,w,id])=>{ if(at>i) df.appendChild(document.createTextNode(s.slice(i,at))); const b=document.createElement('button'); b.type='button'; b.className='glt'; b.dataset.gl=id; b.setAttribute('aria-haspopup','dialog'); b.textContent=w; df.appendChild(b); i=at+w.length; });
    if(i<s.length) df.appendChild(document.createTextNode(s.slice(i)));
    node.parentNode.replaceChild(df,node); added+=frag.length; }
  return added; }
/* mark every opted-in section now, and again whenever its content is re-rendered (language switch, depth, dynamic text) */
const watched=new WeakSet();
function auto(sel){ const secs=[...document.querySelectorAll(sel||'.gloss')];
  secs.forEach(sec=>{ mark(sec); if(watched.has(sec)) return; watched.add(sec); let tm=0;
    const mo=new MutationObserver(()=>{
      clearTimeout(tm); tm=setTimeout(()=>{ mo.disconnect(); mark(sec); mo.observe(sec,{childList:true,subtree:true}); },120); });
    mo.observe(sec,{childList:true,subtree:true}); });
  if(G0.LAB&&!auto._hook){ auto._hook=1; G0.LAB.onLang(()=>{ close(); setTimeout(()=>document.querySelectorAll(sel||'.gloss').forEach(mark),0); }); } }

Object.assign(API,{term,chips,chipsH,open,close,mark,auto,L,labName:f=>LABN[f]?L(LABN[f]):''});
G0.GLOSS=API;
})(typeof window!=='undefined'?window:globalThis);
