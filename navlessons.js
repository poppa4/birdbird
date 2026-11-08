/* Birdbird – navlessons.js: Learn (10 lessons), Practice (10 task types), Explore, Instructor (scenarios),
   the Guide strip with next-step hints, and the "Why?" sentences after every action. Plugs into navsim.js (NSIM). */
window.NAVLESSONS=function(A){
'use strict';
const {S,D,N,t2,L,d3,nf}=A, el=id=>document.getElementById(id);
const norm=N.norm, diff=N.diff, abs=Math.abs;
const side=v=>v>0?t2('right','høyre'):t2('left','venstre');
const sideL=v=>L(side(v));
const F=(en,no)=>()=>({en:typeof en==='function'?en():en,no:typeof no==='function'?no():no});
const sim=()=>S.t;

/* =====================================================================
   "Why?": one cause-and-effect sentence after each action
   ===================================================================== */
function snap(){ A.derive(); return {rad:D.rad,qdm:D.qdm,flag:D.flag,why:D.why,dev:D.dev,dots:D.dots,mh:D.mh,trk:D.trk,gs:D.gs,drift:D.drift,rb:D.rb,qdmA:D.qdmA,slant:D.slant,dist:D.dist,locDots:D.locDots,gsDots:D.gsDots,obs:S.obs,ap:S.ap,ils:D.ils}; }
function needleText(){ /* the needle, in words, for the current state */
  if(D.ils){ if(!D.locOk) return t2('The localiser is out of coverage, so the flag is in view.','Localizeren er utenfor dekning, så flagget vises.');
    const back=D.back?t2(' You are behind the antenna (back course): the sense is reversed if you fly towards the airport.',' Du er bak antennen (baksiden): visningen blir omvendt hvis du flyr mot flyplassen.'):t2('','');
    if(abs(D.locDots)<0.3) return {en:'Localiser centred: you are on the centreline.'+back.en,no:'Localizeren er sentrert: du er på senterlinjen.'+back.no};
    return {en:`Localiser needle ${nf(abs(D.locDots),1)} dots ${sideL(D.locDots)}: you are ${nf(abs(D.locDev),1)}° ${D.locDots>0?'left':'right'} of the centreline, so it lies to your ${D.locDots>0?'right':'left'} when you fly the front course.${back.en}`,
            no:`Localizernålen ${nf(abs(D.locDots),1)} prikker til ${D.locDots>0?'høyre':'venstre'}: du er ${nf(abs(D.locDev),1)}° ${D.locDots>0?'til venstre':'til høyre'} for senterlinjen, så den ligger til ${D.locDots>0?'høyre':'venstre'} når du flyr frontkursen.${back.no}`}; }
  if(D.flag==='OFF'){ if(D.why==='abeam') return {en:`Flag OFF: course ${d3(S.obs)} is about 90° from your bearing to the station (QDM ${d3(D.qdm)}), so you are abeam and the receiver cannot tell TO from FROM.`,no:`Flagget viser OFF: kurs ${d3(S.obs)} er omtrent 90° fra peilingen til stasjonen (QDM ${d3(D.qdm)}), så du er tvers av den, og mottakeren kan ikke skille TO fra FROM.`};
    if(D.why==='cone') return t2('Flag OFF: you are in the cone of confusion above the station, where the radials converge and the signal is unusable.','Flagget viser OFF: du er i forvirringskjeglen over stasjonen, der radialene møtes og signalet er ubrukelig.');
    return t2('Flag OFF: you are beyond line-of-sight range of the VOR. Climb or get closer.','Flagget viser OFF: du er utenfor siktlinjen til VOR-en. Stig eller kom nærmere.'); }
  const fl=D.flag==='TO'?t2('TO: the course leads to the station','TO: kursen fører til stasjonen'):t2('FROM: the course leads away from the station','FROM: kursen fører bort fra stasjonen');
  if(abs(D.dev)<0.6) return {en:`Needle centred, ${fl.en}. You are on the ${d3(S.obs)} course (radial ${d3(D.rad)}).`,no:`Nålen er sentrert, ${fl.no}. Du er på ${d3(S.obs)}-kursen (radial ${d3(D.rad)}).`};
  const fs=abs(D.dev)>=10?t2(' That is beyond full scale (10°).',' Det er mer enn fullt utslag (10°).'):t2('','');
  return {en:`Needle ${nf(abs(D.dots),1)} dots ${sideL(D.dev)}: you are on radial ${d3(D.rad)}, ${nf(abs(D.dev),0)}° from the ${d3(S.obs)} course, so the course is to your ${sideL(D.dev)} when you fly ${d3(S.obs)}.${fs.en} ${fl.en}.`,
          no:`Nålen ${nf(abs(D.dots),1)} prikker til ${sideL(D.dev)}: du er på radial ${d3(D.rad)}, ${nf(abs(D.dev),0)}° fra ${d3(S.obs)}-kursen, så kursen ligger til ${sideL(D.dev)} når du flyr ${d3(S.obs)}.${fs.no} ${fl.no}.`}; }
function why(kind,b){
  let w=null;
  const flagCh=b.flag!==D.flag&&!D.ils;
  const flagS=flagCh?(D.flag==='OFF'?t2('',''):{en:` The flag changed to ${D.flag} because the ${d3(S.obs)} course now points ${D.flag==='TO'?'towards':'away from'} the station from where you are.`,no:` Flagget skiftet til ${D.flag} fordi ${d3(S.obs)}-kursen nå peker ${D.flag==='TO'?'mot':'bort fra'} stasjonen der du er.`}):t2('','');
  const n=needleText();
  switch(kind){
    case 'pos': w={en:(D.ils?'':`You are now on radial ${d3(D.rad)} at ${nf(D.dist,1)} NM (QDM ${d3(D.qdm)}). `)+n.en+flagS.en,no:(D.ils?'':`Du er nå på radial ${d3(D.rad)}, ${nf(D.dist,1)} NM ut (QDM ${d3(D.qdm)}). `)+n.no+flagS.no}; break;
    case 'hdg': w={en:`Heading ${d3(D.mh)}. ${D.ils?'The localiser needle':'The CDI needle'} did not move: it shows where you are, not where you point. The RMI and HSI cards turned; the RMI needles still point at the stations (QDM ${d3(D.vorQdm)}). ADF relative bearing is now ${d3(D.rb)} (QDM ${d3(D.qdmA)} − heading).`+(abs(diff(D.mh,S.obs))>90&&!D.ils?' With the course behind you, the CDI now reverse-senses; the HSI does not.':''),
                     no:`Kurs ${d3(D.mh)}. ${D.ils?'Localizernålen':'CDI-nålen'} flyttet seg ikke: den viser hvor du er, ikke hvor du peker. RMI- og HSI-skivene dreide; RMI-nålene peker fortsatt mot stasjonene (QDM ${d3(D.vorQdm)}). ADF relativ peiling er nå ${d3(D.rb)} (QDM ${d3(D.qdmA)} − kurs).`+(abs(diff(D.mh,S.obs))>90&&!D.ils?' Med kursen bak deg viser CDI-en nå omvendt; HSI-en gjør ikke det.':'')}; break;
    case 'obs': w={en:`Course ${d3(S.obs)} selected. `+n.en+flagS.en,no:`Kurs ${d3(S.obs)} valgt. `+n.no+flagS.no}; if(D.ils) w=t2('A localiser has one fixed course; the OBS does not move its needle. The HSI course pointer should still be set to the front course so the picture is right.','En localizer har én fast kurs; OBS flytter ikke nålen. Kurspekeren på HSI-en bør likevel settes til frontkursen så bildet blir riktig.'); break;
    case 'wind': w= S.wind.spd<0.5? t2('No wind: track = heading and ground speed = TAS.','Ingen vind: track = kurs og fart over bakken = TAS.') : {en:`Wind ${d3(S.wind.dir)}/${Math.round(S.wind.spd)}: it pushes you ${nf(abs(D.drift),0)}° ${sideL(D.drift)} of your heading (drift), so the track is ${d3(D.trk)} and the ground speed ${Math.round(D.gs)} kt.`,no:`Vind ${d3(S.wind.dir)}/${Math.round(S.wind.spd)}: den skyver deg ${nf(abs(D.drift),0)}° til ${sideL(D.drift)} for kursen (avdrift), så tracken er ${d3(D.trk)} og farten over bakken ${Math.round(D.gs)} kt.`}; break;
    case 'tas': w={en:`TAS ${Math.round(S.ac.tas)} kt: ground speed ${Math.round(D.gs)} kt, drift ${nf(abs(D.drift),0)}°. The same wind matters less at a higher TAS. Rate-one turn: ${nf(N.turnRate(S.ac.tas),1)}°/s.`,no:`TAS ${Math.round(S.ac.tas)} kt: fart over bakken ${Math.round(D.gs)} kt, avdrift ${nf(abs(D.drift),0)}°. Samme vind betyr mindre ved høyere TAS. Standardsving: ${nf(N.turnRate(S.ac.tas),1)}°/s.`}; break;
    case 'alt': w=D.ils&&D.gsOk? {en:`Altitude ${Math.round(S.ac.alt)} ft; the glide path here is at ${Math.round(D.pathFt)} ft, so you are ${S.ac.alt>D.pathFt?'above':'below'} it and the GS needle points ${S.ac.alt>D.pathFt?'down':'up'}: fly towards the needle.`,no:`Høyde ${Math.round(S.ac.alt)} ft; glidebanen er her i ${Math.round(D.pathFt)} ft, så du er ${S.ac.alt>D.pathFt?'over':'under'} den, og GS-nålen peker ${S.ac.alt>D.pathFt?'ned':'opp'}: fly mot nålen.`}
      : {en:`Altitude ${Math.round(S.ac.alt)} ft: the DME reads the slant range ${nf(D.slant,1)} NM against ${nf(D.dist,1)} NM over the ground.`,no:`Høyde ${Math.round(S.ac.alt)} ft: DME viser skrådistansen ${nf(D.slant,1)} NM mot ${nf(D.dist,1)} NM over bakken.`}; break;
    case 'nav': w={en:`NAV 1 tuned to ${A.nav1().name}. `+n.en,no:`NAV 1 er stilt inn på ${A.nav1().name}. `+n.no}; break;
    case 'adf': case 'adfcard': w=S.adfMov? {en:`Movable card set to ${d3(S.adfCard)}. When it matches your heading (${d3(D.mh)}) the needle head reads the QDM directly: ${d3(D.qdmA)}.`,no:`Den bevegelige skiven står på ${d3(S.adfCard)}. Når den stemmer med kursen (${d3(D.mh)}), viser nålespissen QDM direkte: ${d3(D.qdmA)}.`}
      : {en:`ADF on ${A.adfSt().id}: relative bearing ${d3(D.rb)}. Add the heading: ${d3(D.mh)} + ${d3(D.rb)} = QDM ${d3(D.qdmA)}.`,no:`ADF på ${A.adfSt().id}: relativ peiling ${d3(D.rb)}. Legg til kursen: ${d3(D.mh)} + ${d3(D.rb)} = QDM ${d3(D.qdmA)}.`}; break;
    case 'ap': w=({HDG:t2('HDG: the autopilot holds the heading bug. In a crosswind you will drift off the line.','HDG: autopiloten holder kursmerket. I sidevind driver du av linjen.'),
       TRK:{en:`TRK: the autopilot holds track ${d3(S.sel.trk)} by flying heading ${d3(norm(S.sel.trk+D.wca))} (${nf(abs(D.wca),0)}° into the wind).`,no:`TRK: autopiloten holder track ${d3(S.sel.trk)} ved å fly kurs ${d3(norm(S.sel.trk+D.wca))} (${nf(abs(D.wca),0)}° opp mot vinden).`},
       NAV:t2('NAV: armed. The autopilot holds the heading bug until the needle comes off the stop, then captures and tracks the OBS course (or the localiser) with the wind correction it needs.','NAV: armert. Autopiloten holder kursmerket til nålen slipper stoppen, og fanger og følger så OBS-kursen (eller localizeren) med den vindkorreksjonen den trenger.'),
       APP:t2('APP: localiser and glide slope coupled. The descent rate follows ground speed: about GS × 5 ft/min on a 3° path.','APP: localizer og glidebane koblet inn. Synkeraten følger farten over bakken: rundt GS × 5 ft/min på en 3°-bane.'),
       HOLD:{en:`HOLD: the autopilot flies to the fix and enters the hold. Arriving on heading ${d3(D.mh)} now would give a ${L({direct:t2('direct','direkte'),teardrop:t2('teardrop','dråpe'),parallel:t2('parallel','parallell')}[D.holdEntry]||t2('',''))} entry.`,no:`HOLD: autopiloten flyr til fiksen og går inn i holdingen. Kommer du inn på kurs ${d3(D.mh)} nå, blir det ${L({direct:t2('direkte','direkte'),teardrop:t2('dråpe','dråpe'),parallel:t2('parallell','parallell')}[D.holdEntry]||t2('',''))} innflyging.`},
       HOME:t2('HOME: the autopilot keeps the ADF needle on the nose. In a crosswind that makes a curved path, arriving into wind.','HOME: autopiloten holder ADF-nålen på nesen. I sidevind gir det en buet bane, og du kommer inn mot vinden.')})[S.ap]; break;
    case 'var': w=S.varE? {en:`Variation ${S.varE}° E: magnetic = true − ${S.varE}. Radials, the OBS and headings are magnetic; the map's rose turns with magnetic north.`,no:`Misvisning ${S.varE}° Ø: magnetisk = rettvisende − ${S.varE}. Radialer, OBS og kurser er magnetiske; rosen på kartet dreier med magnetisk nord.`}:t2('No variation: true and magnetic are the same here.','Ingen misvisning: rettvisende og magnetisk er det samme her.'); break;
    default: w=null;
  }
  if(w) setWhy(w);
  progress();
}
A.snap=snap; A.why=why;
A.onFlag=(a,b)=>{ if(a!=='OFF'&&b!=='OFF'&&a!==b) setWhy({en:`Station passage: the flag flipped from ${a} to ${b}. The course is the same line, but it now leads away from the station.`,no:`Stasjonspassering: flagget skiftet fra ${a} til ${b}. Kursen er den samme linjen, men den fører nå bort fra stasjonen.`});
  else if(b==='OFF'&&D.why==='cone') setWhy(t2('Over the station: the cone of confusion. Hold your heading; the flag comes back in a few seconds.','Over stasjonen: forvirringskjeglen. Hold kursen; flagget kommer tilbake om noen sekunder.')); };

/* =====================================================================
   Learn: ten lessons, one concept each
   ===================================================================== */
const ent=e=>({direct:t2('direct','direkte'),teardrop:t2('teardrop','dråpe'),parallel:t2('parallel','parallell')}[e]||t2('',''));
const LESSONS=[
 {k:'position',t:t2('Position, bearings and VOR radials','Posisjon, peilinger og VOR-radialer'),
  setup:()=>A.base({area:'bergen',nav1:'FLS',obs:90,rad:45,dme:12,hdg:90,course:false}),
  steps:[
   {focus:['map','rmi'],do:t2('FLS is a VOR. It sends out 360 radials like the spokes of a wheel: each one is a magnetic bearing FROM the station. Drag the aircraft to the east of the station, onto a radial between 060 and 120.','FLS er en VOR. Den sender ut 360 radialer som eikene i et hjul: hver av dem er en magnetisk peiling FRA stasjonen. Dra flyet øst for stasjonen, til en radial mellom 060 og 120.'),
    hint:t2('Grab the aircraft on the map, or type a radial in Aircraft → Radial. With north up, east is to the right.','Ta tak i flyet på kartet, eller skriv en radial i Fly → Radial. Med nord opp er øst til høyre.'),
    check:()=>D.rad>=60&&D.rad<=120, show:()=>A.act('pos',()=>A.placeRel('FLS',90,12)),
    ok:()=>({en:`Radial ${d3(D.rad)}: the line from FLS to you points ${d3(D.rad)}°. The green dashed line on the map is that radial.`,no:`Radial ${d3(D.rad)}: linjen fra FLS til deg peker ${d3(D.rad)}°. Den grønne stiplede linjen på kartet er radialen.`})},
   {focus:['map','rmi'],do:t2('Now put the aircraft on radial 180, due south of the station, at any distance.','Plasser nå flyet på radial 180, rett sør for stasjonen, i hvilken som helst avstand.'),
    hint:t2('Type 180 in Aircraft → Radial, or drag the aircraft straight below FLS until the label reads R180.','Skriv 180 i Fly → Radial, eller dra flyet rett under FLS til etiketten viser R180.'),
    check:()=>abs(diff(D.rad,180))<=2.5, show:()=>A.act('pos',()=>A.placeRel('FLS',180,12)),
    ok:()=>t2('On R180. Notice the RMI: the head of the green needle points to the station (360), the tail shows your radial (180).','På R180. Se på RMI-en: spissen av den grønne nålen peker mot stasjonen (360), halen viser radialen din (180).')},
   {focus:['map','rmi','dg'],do:t2('Turn the aircraft: change the heading by at least 90°. Watch the radial.','Drei flyet: endre kursen minst 90°. Følg med på radialen.'),
    hint:t2('Use Heading + / −, the ← → keys, or drag the blue dot in front of the aircraft’s nose.','Bruk Kurs + / −, piltastene ← →, eller dra den blå prikken foran nesen på flyet.'),
    begin:c=>{ c.mh=D.mh; }, check:c=>abs(diff(D.mh,c.mh))>=88&&abs(diff(D.rad,180))<=3, show:()=>A.act('hdg',()=>A.setHdg(D.mh+120)),
    ok:()=>t2('The radial did not change. A radial is where you are, not where you point. On the RMI the card turned under the needle, but the needle still points at FLS.','Radialen endret seg ikke. En radial er hvor du er, ikke hvor du peker. På RMI-en dreide skiven under nålen, men nålen peker fortsatt mot FLS.')},
   {focus:['map','rmi','dg'],do:t2('QDM is the magnetic bearing TO the station: radial ± 180. Point the aircraft straight at FLS (heading = QDM).','QDM er den magnetiske peilingen TIL stasjonen: radial ± 180. Pek flyet rett mot FLS (kurs = QDM).'),
    hint:()=>({en:`You are on radial ${d3(D.rad)}, so QDM = ${d3(D.rad)} ± 180 = ${d3(D.qdm)}. Set heading ${d3(D.qdm)}; the RMI needle will sit under the top index.`,no:`Du er på radial ${d3(D.rad)}, så QDM = ${d3(D.rad)} ± 180 = ${d3(D.qdm)}. Sett kurs ${d3(D.qdm)}; RMI-nålen legger seg under indeksen øverst.`}),
    check:()=>abs(diff(D.mh,D.qdm))<=3, show:()=>A.act('hdg',()=>A.setHdg(Math.round(D.qdm))),
    ok:()=>t2('Heading = QDM: the RMI needle points straight up. Fly this in still air and you arrive over the station.','Kurs = QDM: RMI-nålen peker rett opp. Fly dette i stille luft, og du kommer over stasjonen.')}]},
 {k:'obs',t:t2('OBS, CDI and TO/FROM','OBS, CDI og TO/FROM'),
  setup:()=>A.base({nav1:'FLS',obs:0,rad:250,dme:20,hdg:70}),
  steps:[
   {focus:['cdi','map'],do:t2('Turn the OBS until the needle centres with a TO flag. That course takes you to the station.','Drei OBS til nålen er sentrert med TO-flagg. Den kursen tar deg til stasjonen.'),
    hint:t2('Drag or scroll the OBS knob, use the ◂ ▸ buttons under the CDI, the [ ] keys, or type a course in Radios → OBS. You are on radial 250, so the course TO FLS is 070.','Dra eller rull OBS-knappen, bruk ◂ ▸ under CDI-en, tastene [ ], eller skriv en kurs i Radioer → OBS. Du er på radial 250, så kursen TIL FLS er 070.'),
    check:()=>D.flag==='TO'&&abs(D.dev)<=1, show:()=>A.act('obs',()=>{ S.obs=Math.round(D.qdm); }),
    ok:()=>t2('Centred with TO on 070: fly 070 and you reach FLS.','Sentrert med TO på 070: fly 070, og du kommer til FLS.')},
   {focus:['cdi','map'],do:t2('Now set the reciprocal, 250. The needle centres again, but the flag shows FROM.','Sett nå motsatt kurs, 250. Nålen blir sentrert igjen, men flagget viser FROM.'),
    hint:t2('Turn the OBS 180° (Shift + scroll or the field: type 250).','Drei OBS 180° (Shift + rull, eller skriv 250 i feltet).'),
    check:()=>D.flag==='FROM'&&abs(D.dev)<=1, show:()=>A.act('obs',()=>{ S.obs=Math.round(D.rad); }),
    ok:()=>t2('Same line, opposite direction. FROM means the course leads away from the station; with FROM and the needle centred, the OBS shows the radial you are on.','Samme linje, motsatt retning. FROM betyr at kursen fører bort fra stasjonen; med FROM og nålen sentrert viser OBS radialen du er på.')},
   {focus:['cdi','map'],do:t2('Keep OBS 250. Drag the aircraft a little north of the line, onto a radial between 258 and 285. Which way does the needle go?','Behold OBS 250. Dra flyet litt nord for linjen, til en radial mellom 258 og 285. Hvilken vei går nålen?'),
    hint:t2('North of the 250 radial is up and to the right of the magenta course line.','Nord for 250-radialen er opp og til høyre for den magentafargede kurslinjen.'),
    check:()=>D.flag==='FROM'&&D.rad>=258&&D.rad<=285&&abs(diff(S.obs,250))<=2, show:()=>A.act('pos',()=>A.placeRel('FLS',265,20)),
    ok:()=>({en:`Needle left: flying 250 outbound, the course line is now to your left (south). Fly towards the needle. ${nf(abs(D.dev),0)}° off means ${nf(abs(D.dots),1)} dots, 2° per dot.`,no:`Nålen til venstre: når du flyr 250 utover, ligger kurslinjen nå til venstre (sør). Fly mot nålen. ${nf(abs(D.dev),0)}° av betyr ${nf(abs(D.dots),1)} prikker, 2° per prikk.`})},
   {focus:['cdi','map'],do:t2('Find the edge: move the aircraft round the station until the flag shows OFF, about 90° from the course.','Finn kanten: flytt flyet rundt stasjonen til flagget viser OFF, omtrent 90° fra kursen.'),
    hint:t2('With OBS 250 the abeam radials are 160 and 340. The TO/FROM regions are now on the map; the dashed amber line is the boundary.','Med OBS 250 er radialene tvers av 160 og 340. TO/FROM-områdene vises nå på kartet; den stiplede gule linjen er grensen.'),
    begin:()=>{ S.view.tofrom=true; A.redraw(); }, check:()=>D.flag==='OFF'&&D.why==='abeam', show:()=>A.act('pos',()=>A.placeRel('FLS',340,15)),
    ok:()=>t2('Abeam the course the receiver cannot tell TO from FROM, so the flag drops. The CDI never knows your heading: it only compares your radial with the course you set.','Tvers av kursen kan ikke mottakeren skille TO fra FROM, så flagget faller. CDI-en vet aldri hvilken kurs du har: den sammenligner bare radialen din med kursen du har satt.')}]},
 {k:'track',t:t2('Intercepting and tracking with wind','Avskjære og følge en kurs med vind'),
  setup:()=>A.base({nav1:'FLS',obs:360,rad:170,dme:25,hdg:360,tas:120,range:20}),
  steps:[
   {focus:['cdi','hsi','map'],do:t2('You want the 360 course to FLS (inbound on R180). The needle is left: the course is to your left. Select an intercept heading 30° towards it: 330.','Du vil fly 360-kursen til FLS (inngående på R180). Nålen står til venstre: kursen er til venstre. Velg en avskjæringskurs 30° mot den: 330.'),
    hint:t2('Heading field: 330, or press ← six times (5° each).','Kursfeltet: 330, eller trykk ← seks ganger (5° hver).'),
    check:()=>abs(diff(S.sel.hdg,330))<=8&&abs(diff(D.mh,330))<=8, show:()=>A.act('hdg',()=>A.setHdg(330)),
    ok:()=>t2('330 converges on the course at 30°. The needle will start to move as you get within 10° (full scale).','330 nærmer seg kursen med 30°. Nålen begynner å bevege seg når du kommer innenfor 10° (fullt utslag).')},
   {focus:['cdi','hsi','map'],do:t2('Press ▶ Fly (×4 helps). When the needle comes off the stop and reaches about 2 dots, turn to 360 so you roll out on the course.','Trykk ▶ Fly (×4 hjelper). Når nålen slipper stoppen og er rundt 2 prikker ute, sving til 360 så du ruller ut på kursen.'),
    hint:()=>S.run? (abs(D.dots)>2.5?t2('Wait: the needle is still more than 2 dots out.','Vent: nålen er fortsatt mer enn 2 prikker ute.'):t2('Now: set heading 360 (→ key six times).','Nå: sett kurs 360 (→ seks ganger).')) : t2('Press ▶ Fly (Space).','Trykk ▶ Fly (mellomrom).'),
    check:()=>S.run&&abs(D.dots)<=0.8&&abs(diff(D.mh,360))<=6&&D.flag==='TO', show:()=>{ A.act('ap',()=>{ S.ap='NAV'; }); A.apSync(); if(!S.run) A.run(true); },
    ok:()=>t2('Established: needle centred, TO flag, heading 360. Leading the turn stops you overshooting.','Etablert: nålen sentrert, TO-flagg, kurs 360. Ved å lede svingen unngår du å skyte over.')},
   {focus:['cdi','map','dg'],do:t2('A wind from 270 at 25 kt is now blowing. Keep heading 360 (HDG mode) and watch the needle.','Nå blåser det en vind fra 270 med 25 kt. Behold kurs 360 (HDG-modus) og følg med på nålen.'),
    hint:t2('Just watch. The needle drifts left: the wind is pushing you right of the course.','Bare følg med. Nålen driver til venstre: vinden skyver deg til høyre for kursen.'),
    begin:()=>{ S.wind.dir=270; S.wind.spd=25; S.ap='HDG'; A.setHdg(360); A.apSync(); if(!S.run) A.run(true); A.fieldsSync(true); },
    check:()=>abs(D.dots)>=1.2, show:()=>{ if(!S.run) A.run(true); S.speed=8; A.segsSync(); },
    ok:()=>({en:`Drifting: wind from the left pushes you right, so the course moves to your left. Drift here is ${nf(abs(D.drift),0)}°.`,no:`Avdrift: vind fra venstre skyver deg mot høyre, så kursen flytter seg til venstre for deg. Avdriften her er ${nf(abs(D.drift),0)}°.`})},
   {focus:['cdi','map','dg'],do:t2('Correct for it: turn towards the needle to get back, then settle on a heading into the wind (about 10–15° left) that keeps the needle centred for 15 seconds.','Korriger for den: sving mot nålen for å komme tilbake, og finn så en kurs opp mot vinden (rundt 10–15° til venstre) som holder nålen sentrert i 15 sekunder.'),
    hint:()=>abs(D.dots)>1?t2('First regain the course: heading about 330 until the needle comes back near the centre.','Først tilbake til kursen: kurs rundt 330 til nålen er nær midten igjen.'):t2('Now about 348: asin(25 / 120) ≈ 12° into the wind. If the needle creeps left, take 2° more.','Nå rundt 348: asin(25 / 120) ≈ 12° opp mot vinden. Kryper nålen mot venstre, ta 2° til.'),
    begin:c=>{ c.hold=0; }, tick:(c,dt)=>{ if(S.run&&abs(D.dots)<=0.75&&diff(D.mh,360)<-6&&diff(D.mh,360)>-18) c.hold+=dt*S.speed; else c.hold=0; },
    check:c=>c.hold>=15, show:()=>{ A.act('ap',()=>{ S.ap='NAV'; }); A.apSync(); if(!S.run) A.run(true); },
    ok:()=>({en:`Heading ${d3(D.mh)}, track ${d3(D.trk)}: a ${nf(abs(diff(D.mh,D.trk)),0)}° wind correction angle. With a 25 kt crosswind at TAS 120: asin(25/120) = 12°.`,no:`Kurs ${d3(D.mh)}, track ${d3(D.trk)}: en vindkorreksjonsvinkel på ${nf(abs(diff(D.mh,D.trk)),0)}°. Med 25 kt sidevind og TAS 120: asin(25/120) = 12°.`})}]},
 {k:'wind',t:t2('The wind triangle','Vindtrekanten'),
  setup:()=>A.base({nav1:'FLS',obs:360,rad:200,dme:14,hdg:360,tas:120,tri:true,range:20}),
  steps:[
   {focus:['map','dg'],do:t2('The white arrow is heading and TAS, the blue one the wind, the green one track and ground speed. Set a wind from 270 at 30 kt.','Den hvite pilen er kurs og TAS, den blå vinden, den grønne track og fart over bakken. Sett en vind fra 270 med 30 kt.'),
    hint:t2('Wind → From 270, Speed 30.','Vind → Fra 270, Fart 30.'),
    check:()=>abs(diff(S.wind.dir,270))<=5&&abs(S.wind.spd-30)<=2, show:()=>A.act('wind',()=>{ S.wind.dir=270; S.wind.spd=30; }),
    ok:()=>({en:`Heading 360, but the track is ${d3(D.trk)}: the wind blows you ${nf(abs(D.drift),0)}° right. Ground speed ${Math.round(D.gs)} kt.`,no:`Kurs 360, men tracken er ${d3(D.trk)}: vinden blåser deg ${nf(abs(D.drift),0)}° til høyre. Fart over bakken ${Math.round(D.gs)} kt.`})},
   {focus:['map','dg','hsi'],do:t2('Make good a track of 360 again: switch the autopilot to TRK and select 360. It works out the heading.','Fly track 360 igjen: sett autopiloten til TRK og velg 360. Den regner ut kursen.'),
    hint:t2('Aircraft → Autopilot → TRK, then Selected track 360.','Fly → Autopilot → TRK, deretter Valgt track 360.'),
    check:()=>S.ap==='TRK'&&abs(diff(S.sel.trk,360))<=2, show:()=>{ A.act('ap',()=>{ S.ap='TRK'; S.sel.trk=360; }); A.apSync(); if(!S.run) A.run(true); },
    begin:()=>{},
    ok:()=>({en:`Heading ${d3(norm(360+D.wca))}: ${nf(abs(D.wca),0)}° into the wind. Track 360, ground speed ${Math.round(N.headingFor(S.ac.tas,360,S.wind.dir,S.wind.spd).gs)} kt. Press ▶ Fly to see it hold.`,no:`Kurs ${d3(norm(360+D.wca))}: ${nf(abs(D.wca),0)}° opp mot vinden. Track 360, fart over bakken ${Math.round(N.headingFor(S.ac.tas,360,S.wind.dir,S.wind.spd).gs)} kt. Trykk ▶ Fly for å se at den holder.`})},
   {focus:['map','dg'],do:t2('Turn the wind into a headwind: from 360 at 30 kt. What happens to drift and ground speed?','Gjør vinden til motvind: fra 360 med 30 kt. Hva skjer med avdrift og fart over bakken?'),
    hint:t2('Wind → From 360.','Vind → Fra 360.'),
    check:()=>abs(diff(S.wind.dir,360))<=5&&S.wind.spd>=25, show:()=>A.act('wind',()=>{ S.wind.dir=0; S.wind.spd=30; }),
    ok:()=>({en:`No crosswind, no drift: heading = track. All the wind subtracts from TAS: ground speed ${Math.round(N.windTriangle(S.ac.tas,N.toTrue(360,S.varE),S.wind.dir,S.wind.spd).gs)} kt.`,no:`Ingen sidevind, ingen avdrift: kurs = track. Hele vinden trekkes fra TAS: fart over bakken ${Math.round(N.windTriangle(S.ac.tas,N.toTrue(360,S.varE),S.wind.dir,S.wind.spd).gs)} kt.`})},
   {focus:['map','dg'],do:t2('A strong crosswind: from 090 at 60 kt, TAS 120. Read the correction angle.','En sterk sidevind: fra 090 med 60 kt, TAS 120. Les korreksjonsvinkelen.'),
    hint:t2('Wind → From 090, Speed 60.','Vind → Fra 090, Fart 60.'),
    check:()=>abs(diff(S.wind.dir,90))<=5&&S.wind.spd>=55&&abs(S.ac.tas-120)<=10, show:()=>A.act('wind',()=>{ S.wind.dir=90; S.wind.spd=60; S.ac.tas=120; }),
    ok:()=>t2('WCA = asin(60 / 120) = 30°. The ground speed drops as well (cos 30° × 120 = 104 kt): a crosswind costs speed, not only direction.','WCA = asin(60 / 120) = 30°. Farten over bakken faller også (cos 30° × 120 = 104 kt): sidevind koster fart, ikke bare retning.')}]},
 {k:'dme',t:t2('DME: distance, ground speed, time and slant range','DME: avstand, fart, tid og skrådistanse'),
  setup:()=>A.base({nav1:'FLS',obs:270,rad:90,dme:30,hdg:270,tas:150,alt:5000,profile:true,range:40}),
  steps:[
   {focus:['dme','map'],do:t2('The DME box shows slant range (NM), the rate it changes (KT) and the time to the station (MIN). Press ▶ Fly towards FLS and read them.','DME-boksen viser skrådistanse (NM), hvor fort den endrer seg (KT) og tiden til stasjonen (MIN). Trykk ▶ Fly mot FLS og les dem.'),
    hint:t2('▶ Fly (Space). Let it run for a moment.','▶ Fly (mellomrom). La den gå en liten stund.'),
    begin:c=>{ c.t=0; }, tick:(c,dt)=>{ if(S.run) c.t+=dt*S.speed; }, check:c=>c.t>=20, show:()=>A.run(true),
    ok:()=>({en:`Flying straight at the station the DME speed is your ground speed (${Math.round(D.gs)} kt), and time = distance / GS × 60 = ${nf(D.slant,1)} / ${Math.round(D.gs)} × 60 ≈ ${Math.round(D.slant/Math.max(1,D.gs)*60)} min.`,no:`Når du flyr rett mot stasjonen er DME-farten lik farten over bakken (${Math.round(D.gs)} kt), og tid = avstand / GS × 60 = ${nf(D.slant,1)} / ${Math.round(D.gs)} × 60 ≈ ${Math.round(D.slant/Math.max(1,D.gs)*60)} min.`})},
   {focus:['dme','map'],do:t2('Turn 90° (heading 360 or 180) so you pass the station abeam. Watch the DME speed.','Sving 90° (kurs 360 eller 180) så du passerer tvers av stasjonen. Følg med på DME-farten.'),
    hint:t2('Heading 360. Keep flying.','Kurs 360. Fortsett å fly.'),
    check:()=>S.run&&(abs(diff(D.mh,0))<=10||abs(diff(D.mh,180))<=10)&&abs(D.dmeGs)<60, show:()=>{ A.act('hdg',()=>A.setHdg(360)); if(!S.run) A.run(true); },
    ok:()=>({en:`DME speed ${Math.round(abs(D.dmeGs))} kt, but you still do ${Math.round(D.gs)} kt. Abeam, the distance hardly changes. DME speed and time are only right flying directly to or from the station.`,no:`DME-farten er ${Math.round(abs(D.dmeGs))} kt, men du flyr fortsatt ${Math.round(D.gs)} kt. Tvers av stasjonen endrer avstanden seg nesten ikke. DME-fart og tid stemmer bare når du flyr rett mot eller fra stasjonen.`})},
   {focus:['dme','map'],do:t2('Slant range: pause, then put the aircraft overhead FLS at 6000 ft (Distance 0, Altitude 6000). What does the DME read?','Skrådistanse: pause, og plasser flyet rett over FLS i 6000 ft (Avstand 0, Høyde 6000). Hva viser DME-en?'),
    hint:t2('Pause (Space). Aircraft → Distance 0, Altitude 6000. The profile view shows the slant line.','Pause (mellomrom). Fly → Avstand 0, Høyde 6000. Profilvisningen viser skrålinjen.'),
    check:()=>D.dist<0.3&&S.ac.alt>=5800, show:()=>{ A.run(false); A.act('pos',()=>{ A.placeRel('FLS',90,0.01); A.setAlt(6000); }); },
    ok:()=>({en:`Overhead at 6000 ft the DME reads ${nf(D.slant,1)} NM, not zero: it measures the straight line to the station, and (6000 − 213 ft elevation) ≈ 0.95 NM.`,no:`Rett over i 6000 ft viser DME-en ${nf(D.slant,1)} NM, ikke null: den måler den rette linjen til stasjonen, og (6000 − 213 ft elevasjon) ≈ 0,95 NM.`})},
   {focus:['dme','map'],do:t2('Move out until slant and ground distance agree within 0.1 NM.','Flytt deg ut til skrådistanse og bakkeavstand er like innen 0,1 NM.'),
    hint:t2('Distance field: try 5, then 8.','Avstandsfeltet: prøv 5, så 8.'),
    check:()=>D.slant-D.dist<0.1&&D.dist>1, show:()=>A.act('pos',()=>A.placeRel('FLS',D.rad,8)),
    ok:()=>({en:`At ${nf(D.dist,1)} NM the error is ${nf(D.slant-D.dist,2)} NM. Rule of thumb: slant error is small when you are more than 1 NM away for every 1000 ft of height.`,no:`På ${nf(D.dist,1)} NM er feilen ${nf(D.slant-D.dist,2)} NM. Tommelfingerregel: feilen er liten når du er mer enn 1 NM unna for hver 1000 ft høyde.`})}]},
 {k:'adf',t:t2('ADF and RMI: relative and magnetic bearings','ADF og RMI: relativ og magnetisk peiling'),
  setup:()=>A.base({nav1:'FLS',adf:'ASK',at:'ASK',rad:160,dme:12,hdg:30,obs:0,course:false,range:20}),
  steps:[
   {focus:['adf','rmi','dg'],do:t2('The ADF needle points at the NDB, measured from the nose: the relative bearing (RB). MB (QDM) = MH + RB. Turn to heading 060 and compare the ADF and the RMI.','ADF-nålen peker mot NDB-en, målt fra nesen: relativ peiling (RB). MB (QDM) = MH + RB. Sving til kurs 060 og sammenlign ADF og RMI.'),
    hint:t2('Heading 060. Read RB on the ADF, add 060, and check it against the RMI’s amber needle.','Kurs 060. Les RB på ADF-en, legg til 060, og sjekk mot den gule nålen på RMI-en.'),
    check:()=>abs(diff(D.mh,60))<=3, show:()=>A.act('hdg',()=>A.setHdg(60)),
    ok:()=>({en:`RB ${d3(D.rb)} + MH ${d3(D.mh)} = ${d3(D.qdmA)}: the bearing to ASK. The RMI shows it directly because its card turns with the heading.`,no:`RB ${d3(D.rb)} + MH ${d3(D.mh)} = ${d3(D.qdmA)}: peilingen til ASK. RMI-en viser den direkte fordi skiven dreier med kursen.`})},
   {focus:['adf','rmi','dg'],do:t2('Turn towards the station: put the ADF needle on the nose (RB 000).','Sving mot stasjonen: legg ADF-nålen på nesen (RB 000).'),
    hint:()=>({en:`Heading = QDM: ${d3(D.qdmA)}. The needle is ${D.rb<180?'right':'left'} of the nose, so turn ${D.rb<180?'right':'left'}.`,no:`Kurs = QDM: ${d3(D.qdmA)}. Nålen står til ${D.rb<180?'høyre':'venstre'} for nesen, så sving til ${D.rb<180?'høyre':'venstre'}.`}),
    check:()=>D.rb<=3||D.rb>=357, show:()=>A.act('hdg',()=>A.setHdg(Math.round(D.qdmA))),
    ok:()=>t2('RB 000: heading = QDM. Keep the needle on the nose and you are homing.','RB 000: kurs = QDM. Hold nålen på nesen, så homer du.')},
   {focus:['adf','map'],do:t2('Homing in a crosswind: wind 270/30 is set and the autopilot keeps the needle on the nose (HOME). Press ▶ Fly and watch the path.','Homing i sidevind: vind 270/30 er satt, og autopiloten holder nålen på nesen (HOME). Trykk ▶ Fly og se på banen.'),
    hint:t2('▶ Fly, speed ×4 or ×8.','▶ Fly, hastighet ×4 eller ×8.'),
    begin:c=>{ c.t=0; S.wind.dir=270; S.wind.spd=30; S.ap='HOME'; A.apSync(); A.fieldsSync(true); }, tick:(c,dt)=>{ if(S.run) c.t+=dt*S.speed; }, check:c=>c.t>=120, show:()=>{ S.speed=8; A.segsSync(); A.run(true); },
    ok:()=>t2('The path curves downwind: you always point at the station, so the wind keeps pushing you sideways and you arrive into wind, on a longer path. That is homing, not tracking.','Banen bøyer av med vinden: du peker alltid mot stasjonen, så vinden skyver deg hele tiden sidelengs, og du kommer inn mot vinden på en lengre vei. Det er homing, ikke tracking.')},
   {focus:['adf','map','dg'],do:t2('Tracking instead: hold a straight line by heading into wind. Switch to TRK with the track = the current QDM, and watch where the ADF needle sits.','Tracking i stedet: hold en rett linje ved å legge kursen opp mot vinden. Velg TRK med track = nåværende QDM, og se hvor ADF-nålen legger seg.'),
    hint:()=>({en:`Autopilot TRK, selected track ${d3(D.qdmA)}.`,no:`Autopilot TRK, valgt track ${d3(D.qdmA)}.`}),
    begin:c=>{ c.t=0; }, tick:(c,dt)=>{ if(S.run&&S.ap==='TRK') c.t+=dt*S.speed; }, check:c=>c.t>=20&&abs(diff(S.sel.trk,D.qdmA))<=6, show:()=>{ A.act('ap',()=>{ S.ap='TRK'; S.sel.trk=Math.round(D.qdmA); }); A.apSync(); if(!S.run) A.run(true); },
    ok:()=>({en:`Tracking: the needle sits ${nf(abs(diff(D.rb,0)),0)}° off the nose, on the downwind side, equal to the drift. Heading into wind + needle offset = a straight track to the NDB.`,no:`Tracking: nålen ligger ${nf(abs(diff(D.rb,0)),0)}° fra nesen, på lesiden, like mye som avdriften. Kurs opp mot vinden + nåleavvik = en rett track til NDB-en.`})}]},
 {k:'hsi',t:t2('The HSI','HSI-en'),
  setup:()=>A.base({nav1:'FLS',obs:20,rad:200,dme:15,hdg:20}),
  steps:[
   {focus:['hsi','cdi'],do:t2('The HSI is a CDI laid over a heading card. Turn the course to 030 with the CRS knob and watch the bar.','HSI-en er en CDI lagt over en kursskive. Drei kursen til 030 med CRS-knappen og følg med på streken.'),
    hint:t2('Drag or scroll the CRS knob (bottom left of the HSI), or the ◂ ▸ CRS buttons.','Dra eller rull CRS-knappen (nede til venstre på HSI-en), eller ◂ ▸ CRS-knappene.'),
    check:()=>abs(diff(S.obs,30))<=1, show:()=>A.act('obs',()=>{ S.obs=30; }),
    ok:()=>({en:`The course arrow turned to 030 and the bar moved ${sideL(D.dev)}: from radial ${d3(D.rad)}, the 030 course passes to your ${sideL(D.dev)}. The bar sits where the course really is.`,no:`Kurspilen dreide til 030, og streken flyttet seg til ${sideL(D.dev)}: fra radial ${d3(D.rad)} går 030-kursen til ${sideL(D.dev)} for deg. Streken ligger der kursen faktisk er.`})},
   {focus:['hsi','cdi'],do:t2('Turn the aircraft to heading 210, away from the course direction. Compare the CDI and the HSI.','Sving flyet til kurs 210, bort fra kursretningen. Sammenlign CDI og HSI.'),
    hint:t2('Heading 210.','Kurs 210.'),
    check:()=>abs(diff(D.mh,210))<=5, show:()=>A.act('hdg',()=>A.setHdg(210)),
    ok:()=>t2('The CDI needle stayed where it was: with the course behind you, flying towards it would now take you away (reverse sensing). The HSI turned with the card, so its bar still lies on the side where the course is.','CDI-nålen ble stående: med kursen bak deg ville du nå fly bort fra den om du fløy mot nålen (omvendt visning). HSI-en dreide med skiven, så streken ligger fortsatt på den siden kursen er.')},
   {focus:['hsi','dg'],do:t2('Set the heading bug to 090 with the HDG knob.','Sett kursmerket til 090 med HDG-knappen.'),
    hint:t2('HDG knob (bottom right of the HSI), or the Heading field.','HDG-knappen (nede til høyre på HSI-en), eller kursfeltet.'),
    check:()=>abs(diff(S.sel.hdg,90))<=2, show:()=>A.act('hdg',()=>A.setHdg(90)),
    ok:()=>t2('The cyan bug marks the heading HDG mode flies. Press ▶ Fly and the aircraft turns to it.','Det blå merket viser kursen HDG-modus flyr. Trykk ▶ Fly, så svinger flyet dit.')},
   {focus:['hsi','cdi'],do:t2('Scale: on this HSI one dot is 5° for a VOR (2 dots = full scale, ±10°); on the CDI one dot is 2°. Put the aircraft where the HSI bar shows one dot off (between 0.8 and 1.2 dots).','Skala: på denne HSI-en er én prikk 5° for VOR (2 prikker = fullt utslag, ±10°); på CDI-en er én prikk 2°. Plasser flyet der HSI-streken viser én prikk ut (mellom 0,8 og 1,2 prikker).'),
    hint:()=>({en:`You need to be 5° off the 030 course: radial ${d3(205)} or ${d3(215)} instead of 210.`,no:`Du må være 5° fra 030-kursen: radial ${d3(205)} eller ${d3(215)} i stedet for 210.`}),
    begin:()=>{ S.obs=30; A.fieldsSync(true); }, check:()=>abs(D.hsiDots)>=0.8&&abs(D.hsiDots)<=1.2&&D.flag!=='OFF', show:()=>A.act('pos',()=>A.placeRel('FLS',215,15)),
    ok:()=>({en:`HSI ${nf(abs(D.hsiDots),1)} dot, CDI ${nf(abs(D.dots),1)} dots: the same ${nf(abs(D.dev),0)}° on two scales.`,no:`HSI ${nf(abs(D.hsiDots),1)} prikk, CDI ${nf(abs(D.dots),1)} prikker: de samme ${nf(abs(D.dev),0)}° på to skalaer.`})}]},
 {k:'holding',t:t2('Holding: entry and wind','Holding: innflyging og vind'),
  setup:()=>A.base({nav1:'FLS',obs:360,rad:30,dme:4.4,hdg:120,sectors:true,tas:140,range:5,hold:{fix:'st',inb:360,dir:1,leg:1}}),
  steps:[
   {focus:['map','hsi'],do:t2('Hold at FLS, inbound 360, right turns. Turn the aircraft to fly directly to FLS. Which entry sector does your heading fall in?','Holding over FLS, inngående 360, høyresvinger. Sving flyet så det flyr rett mot FLS. Hvilken entry-sektor havner kursen din i?'),
    hint:()=>({en:`Heading = QDM ${d3(D.qdm)}.`,no:`Kurs = QDM ${d3(D.qdm)}.`}),
    check:()=>abs(diff(D.mh,D.qdm))<=4, show:()=>A.act('hdg',()=>A.setHdg(Math.round(D.qdm))),
    ok:()=>({en:`Heading ${d3(D.mh)}. The sector names on the map show where you arrive from.`,no:`Kurs ${d3(D.mh)}. Sektornavnene på kartet viser hvor du kommer fra.`})},
   {focus:['map'],do:t2('Which entry do you use?','Hvilken innflyging bruker du?'),
    choice:{opts:[['direct',t2('Direct','Direkte')],['teardrop',t2('Teardrop','Dråpe')],['parallel',t2('Parallel','Parallell')]],ans:()=>N.holdEntry(N.toTrue(S.hold.inb,S.varE),S.hold.dir,S.ac.th),
      fb:(pick,r)=>({en:`Your heading ${d3(D.mh)} is ${Math.round(r.rel)}° from the outbound course 180, measured towards the non-holding side: ${r.rel<70?'0–70° is teardrop':r.rel>=250?'250–360° is parallel':'70–250° is direct'}.${pick===r.entry?'':' So it is '+L(ent(r.entry))+', not '+L(ent(pick))+'.'}${r.near?' Within 5° of a boundary either entry is acceptable.':''}`,
                     no:`Kursen din ${d3(D.mh)} er ${Math.round(r.rel)}° fra utgående kurs 180, målt mot ikke-holdingsiden: ${r.rel<70?'0–70° er dråpe':r.rel>=250?'250–360° er parallell':'70–250° er direkte'}.${pick===r.entry?'':' Altså '+L(ent(r.entry))+', ikke '+L(ent(pick))+'.'}${r.near?' Innenfor 5° av en grense er begge innflygingene greie.':''}`})},
    ok:()=>t2('Right.','Riktig.')},
   {focus:['map','hsi'],do:t2('Fly it: switch the autopilot to HOLD and press ▶ Fly (×8 is fine). Watch the entry and one full lap.','Fly den: sett autopiloten til HOLD og trykk ▶ Fly (×8 går fint). Se innflygingen og én hel runde.'),
    hint:t2('Autopilot → HOLD, then ▶ Fly.','Autopilot → HOLD, så ▶ Fly.'),
    check:()=>A.HS.laps>=2, show:()=>{ A.act('ap',()=>{ S.ap='HOLD'; A.holdReset(); }); A.apSync(); S.speed=8; A.segsSync(); if(!S.run) A.run(true); },
    ok:()=>({en:`Entry flown: ${L(ent(A.HS.entry))}. In a parallel entry you go outbound on the non-holding side, then turn back more than 180° towards the holding side to rejoin.`,no:`Innflyging: ${L(ent(A.HS.entry))}. Ved parallell innflyging flyr du ut på ikke-holdingsiden og svinger mer enn 180° tilbake mot holdingsiden for å komme inn igjen.`})},
   {focus:['map','hsi'],do:t2('Add wind from 270 at 30 kt and keep holding. Watch the corrections.','Legg inn vind fra 270 med 30 kt og fortsett å holde. Følg med på korreksjonene.'),
    hint:t2('Wind → From 270, Speed 30.','Vind → Fra 270, Fart 30.'),
    begin:c=>{ c.l=A.HS.laps; }, check:c=>S.wind.spd>=20&&A.HS.laps>=c.l+1&&S.run, show:()=>{ A.act('wind',()=>{ S.wind.dir=270; S.wind.spd=30; }); if(!S.run) A.run(true); },
    ok:()=>({en:`Inbound heading ${d3(N.toMag(A.HS.hIn,S.varE))}, outbound ${d3(N.toMag(A.HS.hOut,S.varE))} (three times the inbound correction), outbound time ${Math.round(A.HS.tOut)} s so the inbound leg stays about 1 minute.`,no:`Inngående kurs ${d3(N.toMag(A.HS.hIn,S.varE))}, utgående ${d3(N.toMag(A.HS.hOut,S.varE))} (tre ganger inngående korreksjon), utgående tid ${Math.round(A.HS.tOut)} s så inngående legg holder seg rundt 1 minutt.`})}]},
 {k:'ils',t:t2('ILS: localiser and glide slope','ILS: localizer og glidebane'),
  setup:()=>{ A.base({area:'bergen',nav1:'I17',obs:174,hdg:174,tas:120,alt:3500,profile:true,range:10}); const i=A.nav1(); placeOnApp(i,8,1); A.derive(); A.redraw(); A.fieldsSync(true); },
  steps:[
   {focus:['cdi','hsi','map'],do:t2('ILS RWY 17 at Bergen is tuned. The localiser is about four times as sensitive as a VOR: full scale is about 2.5°. You are 1 NM east of the centreline. Move the aircraft until the localiser needle is centred.','ILS RWY 17 på Bergen er stilt inn. Localizeren er omtrent fire ganger så følsom som en VOR: fullt utslag er rundt 2,5°. Du er 1 NM øst for senterlinjen. Flytt flyet til localizernålen er sentrert.'),
    hint:t2('Drag the aircraft west onto the dashed centreline, or fly heading 150 for a while.','Dra flyet vestover inn på den stiplede senterlinjen, eller fly kurs 150 en stund.'),
    check:()=>D.locOk&&abs(D.locDots)<=0.5, show:()=>{ A.act('pos',()=>placeOnApp(A.nav1(),Math.max(4,alongThr()),0)); },
    ok:()=>t2('Centred. At 8 NM one dot (0.5°) is only about 0.07 NM sideways, and it gets tighter towards the runway: small corrections only.','Sentrert. På 8 NM er én prikk (0,5°) bare rundt 0,07 NM sidelengs, og det blir trangere mot rullebanen: bare små korreksjoner.')},
   {focus:['cdi','hsi'],do:t2('The horizontal needle is the glide slope. You are too high. Set the altitude so the GS needle centres (about 300 ft per NM from the threshold).','Den vannrette nålen er glidebanen. Du er for høyt. Still høyden så GS-nålen blir sentrert (rundt 300 ft per NM fra terskelen).'),
    hint:()=>({en:`About ${Math.round(D.pathFt/100)*100} ft here (${nf(alongThr(),1)} NM out). Altitude field, or drag the aircraft down in the profile view.`,no:`Rundt ${Math.round(D.pathFt/100)*100} ft her (${nf(alongThr(),1)} NM ute). Høydefeltet, eller dra flyet ned i profilvisningen.`}),
    check:()=>D.gsOk&&abs(D.gsDots)<=0.6, show:()=>A.act('alt',()=>A.setAlt(Math.round(D.pathFt/10)*10)),
    ok:()=>t2('Above the path the needle points down, below it points up: fly towards the needle. On a 3° path, height ≈ 300 ft per NM.','Over banen peker nålen ned, under den peker den opp: fly mot nålen. På en 3°-bane er høyden ≈ 300 ft per NM.')},
   {focus:['cdi','hsi','map'],do:t2('Fly the approach: autopilot APP, then ▶ Fly. Watch both needles stay centred down to 2 NM.','Fly innflygingen: autopilot APP, så ▶ Fly. Se at begge nålene holder seg sentrert ned til 2 NM.'),
    hint:t2('Aircraft → Autopilot → APP, then ▶ Fly (×4).','Fly → Autopilot → APP, så ▶ Fly (×4).'),
    check:()=>D.thrDist<2.2&&abs(D.gsDots)<1.2&&abs(D.locDots)<1.2, show:()=>{ A.act('ap',()=>{ S.ap='APP'; }); A.apSync(); S.speed=4; A.segsSync(); if(!S.run) A.run(true); },
    ok:()=>({en:`On the path at ${nf(D.thrDist,1)} NM. The descent rate is about GS × 5: ${Math.round(D.gs)} kt → about ${Math.round(D.gs*5.3/10)*10} ft/min.`,no:`På banen ${nf(D.thrDist,1)} NM ute. Synkeraten er rundt GS × 5: ${Math.round(D.gs)} kt → rundt ${Math.round(D.gs*5.3/10)*10} ft/min.`})},
   {focus:['cdi','map'],do:t2('Reverse sensing: put the aircraft south of the airport, beyond the localiser antenna at the far end of runway 17, heading 354 towards the airport (the back course), a little east of the line, so the line is to your left. Which way does the needle point?','Omvendt visning: plasser flyet sør for flyplassen, forbi localizerantennen i enden av rullebane 17, på kurs 354 mot flyplassen (baksiden), litt øst for linjen, så linjen er til venstre for deg. Hvilken vei peker nålen?'),
    hint:t2('Drag the aircraft below (south of) the airport on the map, slightly to the right (east) of the extended centreline, and set heading 354.','Dra flyet under (sør for) flyplassen på kartet, litt til høyre (øst) for den forlengede senterlinjen, og sett kurs 354.'),
    begin:()=>{ A.run(false); S.ap='HDG'; A.apSync(); }, check:()=>D.back&&D.lat<-0.15&&abs(diff(D.mh,354))<=12&&D.locOk, show:()=>{ A.act('pos',()=>{ const i=A.nav1(), u=[Math.sin(i.crs*Math.PI/180),Math.cos(i.crs*Math.PI/180)]; A.setPos(i.x+u[0]*6+0.4,i.y+u[1]*6); S.ac.alt=2500; }); A.act('hdg',()=>A.setHdg(354)); },
    ok:()=>t2('The line is to your left, but the needle points right: behind the antenna the sense is reversed, so “fly towards the needle” takes you further away. On an HSI with the front course (174) set, the bar shows the right side again.','Linjen er til venstre for deg, men nålen peker mot høyre: bak antennen er visningen omvendt, så «fly mot nålen» tar deg lenger bort. På en HSI med frontkursen (174) satt viser streken riktig side igjen.')}]},
 {k:'scenario',t:t2('Putting it together: intercept and hold','Alt sammen: avskjær og hold'),
  setup:()=>A.base({nav1:'FLS',obs:90,rad:135,dme:30,hdg:270,tas:140,alt:5000,wdir:230,wspd:20,range:40,sectors:true,hold:{fix:'dme',rad:180,dme:10,inb:360,dir:1,leg:1}}),
  steps:[
   {focus:['cdi','hsi','map'],do:t2('Clearance: “Intercept the FLS 180 radial inbound, hold at 10 DME, inbound 360, right turns.” First set the course on the OBS.','Klarering: «Avskjær FLS 180-radialen inngående, hold på 10 DME, inngående 360, høyresvinger.» Sett først kursen på OBS.'),
    hint:t2('Inbound on R180 is course 360 TO.','Inngående på R180 er kurs 360 TO.'),
    check:()=>abs(diff(S.obs,360))<=1, show:()=>A.act('obs',()=>{ S.obs=360; }),
    ok:()=>t2('Course 360 set. The needle shows where the radial is.','Kurs 360 satt. Nålen viser hvor radialen er.')},
   {focus:['cdi','hsi','map'],do:t2('Intercept and establish on the course: choose an intercept heading towards the needle and press ▶ Fly. Use NAV once the needle is alive, or fly it by hand.','Avskjær og etabler deg på kursen: velg en avskjæringskurs mot nålen og trykk ▶ Fly. Bruk NAV når nålen er levende, eller fly for hånd.'),
    hint:()=>D.flag==='OFF'?t2('Flag OFF: you are abeam. Fly towards the station first.','Flagget viser OFF: du er tvers av. Fly mot stasjonen først.'):({en:`Needle ${sideL(D.dots)}: the course is to your ${sideL(D.dots)}. Steer about ${d3(norm(360+(D.dots>0?90:-90)))} to cross it south of the station, then NAV: it holds your heading until the needle comes alive.`,no:`Nålen til ${sideL(D.dots)}: kursen ligger til ${sideL(D.dots)}. Styr rundt ${d3(norm(360+(D.dots>0?90:-90)))} så du krysser den sør for stasjonen, så NAV: den holder kursen din til nålen blir levende.`}),
    check:()=>S.run&&D.flag==='TO'&&abs(D.dots)<=1&&abs(diff(D.rad,180))<=5&&abs(diff(D.trk,360))<=10, show:()=>{ A.act('hdg',()=>A.setHdg(270)); A.act('ap',()=>{ S.ap='NAV'; S.sel.hdg=270; }); A.apSync(); S.speed=8; A.segsSync(); if(!S.run) A.run(true); },
    ok:()=>({en:`Established inbound on R180 at ${nf(D.dist,0)} DME, heading ${d3(D.mh)} for track ${d3(D.trk)} in the ${d3(S.wind.dir)}/${Math.round(S.wind.spd)} wind.`,no:`Etablert inngående på R180 på ${nf(D.dist,0)} DME, kurs ${d3(D.mh)} for track ${d3(D.trk)} i vinden ${d3(S.wind.dir)}/${Math.round(S.wind.spd)}.`})},
   {focus:['dme','hsi','map'],do:t2('Before 10 DME, switch the autopilot to HOLD. It enters at the fix (FLS R180 / 10 DME) and holds.','Før 10 DME, sett autopiloten til HOLD. Den går inn på fiksen (FLS R180 / 10 DME) og holder.'),
    hint:()=>({en:`DME ${nf(D.slant,1)}. Autopilot → HOLD.`,no:`DME ${nf(D.slant,1)}. Autopilot → HOLD.`}),
    check:()=>A.HS.laps>=1, show:()=>{ A.act('ap',()=>{ S.ap='HOLD'; A.holdReset(); }); A.apSync(); if(!S.run) A.run(true); },
    ok:()=>A.HS.entry==='direct'?t2('In the hold after a direct entry: you arrived along the inbound course, so you simply crossed the fix and turned right onto the outbound leg.','I holdingen etter direkte innflyging: du kom inn langs inngående kurs, så du passerte fiksen og svingte rett til høyre ut på utgående legg.')
      :({en:`In the hold after a ${L(ent(A.HS.entry))} entry: you were past the fix when HOLD was engaged, so the autopilot turned back and arrived on a different heading. Engage it before the fix for a direct entry.`,no:`I holdingen etter ${L(ent(A.HS.entry))} innflyging: du var forbi fiksen da HOLD ble koblet inn, så autopiloten snudde og kom inn på en annen kurs. Koble den inn før fiksen for direkte innflyging.`})},
   {focus:[],do:t2('Established. Pause (Space) and read the picture: radial, DME and heading on the instruments.','Etablert. Pause (mellomrom) og les bildet: radial, DME og kurs på instrumentene.'),
    hint:t2('Space pauses.','Mellomrom pauser.'),
    check:()=>!S.run, show:()=>A.run(false),
    ok:()=>({en:`Radial ${d3(D.rad)}, DME ${nf(D.slant,1)}, heading ${d3(D.mh)}. That is the whole course: well done.`,no:`Radial ${d3(D.rad)}, DME ${nf(D.slant,1)}, kurs ${d3(D.mh)}. Det var hele kurset: godt jobbet.`})}]}
];
function alongThr(){ const i=A.nav1(); if(i.type!=='ILS') return 0; const u=[Math.sin(i.crs*Math.PI/180),Math.cos(i.crs*Math.PI/180)]; return -((S.ac.x-i.thr.x)*u[0]+(S.ac.y-i.thr.y)*u[1]); }
function placeOnApp(i,dist,off){ const u=[Math.sin(i.crs*Math.PI/180),Math.cos(i.crs*Math.PI/180)]; A.setPos(i.thr.x-u[0]*dist+u[1]*off,i.thr.y-u[1]*dist-u[0]*off); }
const LKEY={position:0,obs:1,track:2,intercept:2,wind:3,dme:4,adf:5,ndb:5,rmi:5,hsi:6,holding:7,hold:7,ils:8,scenario:9};

/* =====================================================================
   Practice: short tasks with specific feedback
   ===================================================================== */
const R=(a,b)=>a+Math.random()*(b-a), RI=(a,b)=>Math.round(R(a,b)), R5=(a,b)=>Math.round(R(a,b)/5)*5, R10=(a,b)=>Math.round(R(a,b)/10)*10;
const PRACT=[
 {k:'radial',t:t2('Which radial?','Hvilken radial?'),kind:'num',unit:'°',focus:['cdi','rmi','hsi','dg'],
  gen(){ A.base({nav1:'FLS',obs:R10(0,350),rad:RI(1,360),dme:R(6,30),hdg:R5(0,355),hideMap:true}); this.a=Math.round(D.rad); },
  q(){ return t2('The map is hidden. Read the instruments: which FLS radial are you on?','Kartet er skjult. Les instrumentene: hvilken FLS-radial er du på?'); },
  check(v){ const e=abs(diff(v,this.a)); if(e<=4) return {ok:1,m:{en:`Yes: radial ${d3(this.a)}. The RMI tail shows it, or centre the CDI with FROM.`,no:`Ja: radial ${d3(this.a)}. Halen på RMI-nålen viser den, eller sentrer CDI-en med FROM.`}};
    if(abs(diff(v,this.a+180))<=5) return {ok:0,m:{en:`${d3(v)} is the QDM, the bearing TO the station (the RMI needle head). The radial is FROM the station: QDM ± 180 = ${d3(this.a)}.`,no:`${d3(v)} er QDM, peilingen TIL stasjonen (spissen på RMI-nålen). Radialen er FRA stasjonen: QDM ± 180 = ${d3(this.a)}.`}};
    if(abs(diff(v,D.mh))<=5) return {ok:0,m:{en:`${d3(v)} is your heading. A radial does not depend on heading: read the RMI tail, or turn the OBS until the needle centres with FROM.`,no:`${d3(v)} er kursen din. En radial avhenger ikke av kursen: les halen på RMI-nålen, eller drei OBS til nålen er sentrert med FROM.`}};
    return {ok:0,m:t2('Not quite. Turn the OBS until the needle centres with a FROM flag: the OBS then shows your radial.','Ikke helt. Drei OBS til nålen er sentrert med FROM-flagg: da viser OBS radialen din.')}; },
  reveal(){ return {en:`Radial ${d3(this.a)}.`,no:`Radial ${d3(this.a)}.`}; }},
 {k:'qdm',t:t2('ADF: bearing to the NDB','ADF: peiling til NDB-en'),kind:'num',unit:'°',focus:['adf','dg'],mask:['rmi','map'],
  gen(){ const st=Math.random()<0.5?'ASK':'BTA'; A.base({nav1:'FLS',adf:st,at:st,rad:RI(1,360),dme:R(5,20),hdg:R5(0,355),hideMap:true,brg:false}); this.a=Math.round(D.qdmA); this.rb=Math.round(D.rb); this.mh=Math.round(D.mh); this.st=st; },
  q(){ return {en:`Fixed-card ADF and heading indicator only (the RMI is covered). What is the QDM, the magnetic bearing to ${this.st}?`,no:`Bare ADF med fast skive og kursindikator (RMI-en er dekket). Hva er QDM, den magnetiske peilingen til ${this.st}?`}; },
  check(v){ const e=abs(diff(v,this.a)); if(e<=4) return {ok:1,m:{en:`Yes: MH ${d3(this.mh)} + RB ${d3(this.rb)} = ${d3(this.a)}.`,no:`Ja: MH ${d3(this.mh)} + RB ${d3(this.rb)} = ${d3(this.a)}.`}};
    if(abs(diff(v,this.rb))<=4) return {ok:0,m:{en:`${d3(v)} is the relative bearing (from the nose). Add the heading: ${d3(this.mh)} + ${d3(this.rb)} = ${d3(this.a)}.`,no:`${d3(v)} er relativ peiling (fra nesen). Legg til kursen: ${d3(this.mh)} + ${d3(this.rb)} = ${d3(this.a)}.`}};
    if(abs(diff(v,this.a+180))<=5) return {ok:0,m:{en:`That is the bearing FROM the NDB (QDR). QDM points to it: ${d3(this.a)}.`,no:`Det er peilingen FRA NDB-en (QDR). QDM peker mot den: ${d3(this.a)}.`}};
    if(abs(diff(v,this.mh-this.rb))<=5) return {ok:0,m:{en:`You subtracted. MB = MH + RB (add, then remove 360 if needed): ${d3(this.a)}.`,no:`Du trakk fra. MB = MH + RB (legg sammen, og trekk fra 360 om nødvendig): ${d3(this.a)}.`}};
    return {ok:0,m:{en:`MB = MH + RB = ${d3(this.mh)} + ${d3(this.rb)}.`,no:`MB = MH + RB = ${d3(this.mh)} + ${d3(this.rb)}.`}}; },
  reveal(){ return {en:`QDM ${d3(this.a)} (${d3(this.mh)} + ${d3(this.rb)}).`,no:`QDM ${d3(this.a)} (${d3(this.mh)} + ${d3(this.rb)}).`}; }},
 {k:'centre',t:t2('Centre the CDI','Sentrer CDI-en'),kind:'do',focus:['cdi'],
  gen(){ A.base({nav1:'FLS',rad:RI(1,360),dme:R(8,30),hdg:R5(0,355)}); S.obs=norm(Math.round(D.qdm)+R10(60,120)*(Math.random()<0.5?-1:1)); A.fieldsSync(true); A.redraw(); },
  q(){ return t2('Turn the OBS until the needle is centred with a TO flag: the course to FLS.','Drei OBS til nålen er sentrert med TO-flagg: kursen til FLS.'); },
  check(){ A.derive(); if(D.flag==='TO'&&abs(D.dev)<=1.5) return {ok:1,m:{en:`Yes: course ${d3(S.obs)} TO. Fly it and you reach FLS.`,no:`Ja: kurs ${d3(S.obs)} TO. Fly den, så kommer du til FLS.`}};
    if(D.flag==='FROM'&&abs(D.dev)<=1.5) return {ok:0,m:{en:`Centred, but FROM: ${d3(S.obs)} is the radial you are on. Turn the OBS 180° to ${d3(D.qdm)} for the course TO the station.`,no:`Sentrert, men FROM: ${d3(S.obs)} er radialen du er på. Drei OBS 180° til ${d3(D.qdm)} for kursen TIL stasjonen.`}};
    return {ok:0,m:{en:`Not centred yet (${nf(abs(D.dots),1)} dots, ${D.flag}). The needle only moves within 10° of the right course; keep turning.`,no:`Ikke sentrert ennå (${nf(abs(D.dots),1)} prikker, ${D.flag}). Nålen beveger seg bare innenfor 10° av riktig kurs; fortsett å dreie.`}}; },
  reveal(){ A.derive(); return {en:`OBS ${d3(D.qdm)} with TO.`,no:`OBS ${d3(D.qdm)} med TO.`}; }},
 {k:'intercept',t:t2('Intercept heading','Avskjæringskurs'),kind:'num',unit:'°',focus:['cdi','hsi'],mask:['map'],
  gen(){ const c=R10(0,350), sd=Math.random()<0.5?-1:1; A.base({nav1:'FLS',obs:c,hdg:c,rad:norm(c+180+sd*R(15,35)),dme:R(15,25),hideMap:true}); this.c=c; this.a=norm(c+(D.dev>0?30:-30)); this.dv=D.dev; },
  q(){ return {en:`You want course ${d3(this.c)} TO FLS, heading ${d3(this.c)}. The needle is ${sideL(this.dv)}. Which heading gives a 30° intercept?`,no:`Du vil fly kurs ${d3(this.c)} TIL FLS, kurs ${d3(this.c)}. Nålen står til ${sideL(this.dv)}. Hvilken kurs gir 30° avskjæring?`}; },
  check(v){ if(abs(diff(v,this.a))<=3) return {ok:1,m:{en:`Yes: needle ${sideL(this.dv)} → course to the ${sideL(this.dv)} → ${d3(this.c)} ${this.dv>0?'+':'−'} 30 = ${d3(this.a)}.`,no:`Ja: nålen til ${sideL(this.dv)} → kursen til ${sideL(this.dv)} → ${d3(this.c)} ${this.dv>0?'+':'−'} 30 = ${d3(this.a)}.`}};
    if(abs(diff(v,this.c-(this.a-this.c)))<=3||abs(diff(v,norm(2*this.c-this.a)))<=3) return {ok:0,m:{en:`That turns away from the course. With the course direction matching your heading, fly towards the needle: ${d3(this.a)}.`,no:`Det svinger bort fra kursen. Når kursen stemmer med retningen du flyr, fly mot nålen: ${d3(this.a)}.`}};
    if(abs(diff(v,this.c+(this.dv>0?45:-45)))<=3) return {ok:0,m:{en:`45° is a good intercept too, but this task asked for 30°: ${d3(this.a)}.`,no:`45° er også en god avskjæring, men oppgaven ba om 30°: ${d3(this.a)}.`}};
    return {ok:0,m:{en:`Add or subtract 30° from the course, towards the needle: ${d3(this.a)}.`,no:`Legg til eller trekk fra 30° fra kursen, mot nålen: ${d3(this.a)}.`}}; },
  reveal(){ return {en:`Heading ${d3(this.a)}.`,no:`Kurs ${d3(this.a)}.`}; }},
 {k:'wind',t:t2('Heading for a track','Kurs for en track'),kind:'num',unit:'°',focus:['map'],
  gen(){ this.tas=R10(90,180); this.trk=R10(0,350); this.wd=R10(0,350); this.ws=RI(15,40); const h=N.headingFor(this.tas,this.trk,this.wd,this.ws); this.a=h.hdg; this.wca=h.wca;
    A.base({nav1:'FLS',hdg:Math.round(this.trk),tas:this.tas,wdir:this.wd,wspd:this.ws,tri:false}); },
  q(){ return {en:`TAS ${this.tas} kt, wind ${d3(this.wd)}/${this.ws} (no variation). What heading makes good track ${d3(this.trk)}?`,no:`TAS ${this.tas} kt, vind ${d3(this.wd)}/${this.ws} (ingen misvisning). Hvilken kurs gir track ${d3(this.trk)}?`}; },
  check(v){ const xw=N.windComp(this.trk,this.wd,this.ws).cross;
    if(abs(diff(v,this.a))<=2) return {ok:1,m:{en:`Yes: crosswind ${nf(abs(xw),0)} kt from the ${xw>0?'right':'left'}, WCA = asin(${nf(abs(xw),0)} / ${this.tas}) = ${nf(abs(this.wca),0)}°: heading ${d3(this.a)}. TRK mode in the model shows it.`,no:`Ja: sidevind ${nf(abs(xw),0)} kt fra ${xw>0?'høyre':'venstre'}, WCA = asin(${nf(abs(xw),0)} / ${this.tas}) = ${nf(abs(this.wca),0)}°: kurs ${d3(this.a)}. TRK-modus i modellen viser det.`}};
    if(abs(diff(v,this.trk-this.wca))<=2.5&&abs(this.wca)>3) return {ok:0,m:{en:`You corrected downwind. The wind comes from the ${xw>0?'right':'left'} of the track, so turn ${xw>0?'right':'left'} into it: ${d3(this.a)}.`,no:`Du korrigerte med vinden. Vinden kommer fra ${xw>0?'høyre':'venstre'} for tracken, så sving ${xw>0?'til høyre':'til venstre'} mot den: ${d3(this.a)}.`}};
    if(abs(diff(v,this.trk))<=1&&abs(this.wca)>3) return {ok:0,m:{en:`No correction: you would drift ${nf(abs(this.wca),0)}° off. WCA ≈ asin(crosswind / TAS).`,no:`Ingen korreksjon: du ville drevet ${nf(abs(this.wca),0)}° av. WCA ≈ asin(sidevind / TAS).`}};
    return {ok:0,m:{en:`Crosswind = ${this.ws} × sin(${Math.round(abs(diff(this.wd,this.trk)))}°) = ${nf(abs(xw),0)} kt; WCA = asin(${nf(abs(xw),0)} / ${this.tas}) = ${nf(abs(this.wca),0)}°.`,no:`Sidevind = ${this.ws} × sin(${Math.round(abs(diff(this.wd,this.trk)))}°) = ${nf(abs(xw),0)} kt; WCA = asin(${nf(abs(xw),0)} / ${this.tas}) = ${nf(abs(this.wca),0)}°.`}}; },
  reveal(){ return {en:`Heading ${d3(this.a)} (WCA ${this.wca>0?'+':'−'}${nf(abs(this.wca),0)}°).`,no:`Kurs ${d3(this.a)} (WCA ${this.wca>0?'+':'−'}${nf(abs(this.wca),0)}°).`}; },
  after(){ A.act('ap',()=>{ S.ap='TRK'; S.sel.trk=this.trk; S.view.tri=true; }); A.apSync(); }},
 {k:'dme',t:t2('DME: time or slant','DME: tid eller skrå'),kind:'num',unit:'',focus:['dme'],
  gen(){ this.v=Math.random()<0.6; if(this.v){ this.d=RI(10,40); this.gs=R10(100,220); this.a=this.d/this.gs*60; A.base({nav1:'FLS',rad:90,dme:this.d,hdg:270,tas:this.gs,alt:2000,obs:270}); }
    else { this.alt=R5(30,120)*100; this.a=(this.alt-213)/6076.12; A.base({nav1:'FLS',rad:90,dme:0.01,hdg:270,alt:this.alt,profile:true}); } },
  q(){ return this.v? {en:`DME ${this.d} NM, ground speed ${this.gs} kt directly towards the station, no wind. How many minutes to the station?`,no:`DME ${this.d} NM, fart over bakken ${this.gs} kt rett mot stasjonen, ingen vind. Hvor mange minutter til stasjonen?`}
    : {en:`You are directly over FLS (elevation 213 ft) at ${this.alt} ft. What does the DME read (NM)?`,no:`Du er rett over FLS (elevasjon 213 ft) i ${this.alt} ft. Hva viser DME-en (NM)?`}; },
  check(v){ const tol=this.v?Math.max(0.3,this.a*0.04):0.15; if(abs(v-this.a)<=tol) return {ok:1,m:this.v?{en:`Yes: ${this.d} / ${this.gs} × 60 = ${nf(this.a,1)} min.`,no:`Ja: ${this.d} / ${this.gs} × 60 = ${nf(this.a,1)} min.`}:{en:`Yes: about ${nf(this.a,1)} NM. 6076 ft is 1 NM.`,no:`Ja: rundt ${nf(this.a,1)} NM. 6076 ft er 1 NM.`}};
    if(this.v&&abs(v-this.d/this.gs)<0.05) return {ok:0,m:t2('That is hours. Multiply by 60 for minutes.','Det er timer. Gang med 60 for minutter.')};
    if(!this.v&&v<0.1) return {ok:0,m:{en:`DME measures slant range, not ground distance: overhead it shows your height in NM, about ${nf(this.a,1)}.`,no:`DME måler skrådistanse, ikke bakkeavstand: rett over viser den høyden din i NM, rundt ${nf(this.a,1)}.`}};
    return {ok:0,m:this.v?{en:`Time (min) = distance ÷ GS × 60 = ${this.d} ÷ ${this.gs} × 60 = ${nf(this.a,1)}.`,no:`Tid (min) = avstand ÷ GS × 60 = ${this.d} ÷ ${this.gs} × 60 = ${nf(this.a,1)}.`}:{en:`Height above the station in NM: (${this.alt} − 213) / 6076 = ${nf(this.a,2)}.`,no:`Høyde over stasjonen i NM: (${this.alt} − 213) / 6076 = ${nf(this.a,2)}.`}}; },
  reveal(){ return this.v?{en:`${nf(this.a,1)} min.`,no:`${nf(this.a,1)} min.`}:{en:`${nf(this.a,2)} NM.`,no:`${nf(this.a,2)} NM.`}; }},
 {k:'hold',t:t2('Holding entry','Holding-innflyging'),kind:'choice',focus:['map'],
  opts:[['direct',t2('Direct','Direkte')],['teardrop',t2('Teardrop','Dråpe')],['parallel',t2('Parallel','Parallell')]],
  gen(){ let r; do{ this.I=R10(0,350); this.dir=Math.random()<0.7?1:-1; this.H=R5(0,355); r=N.holdEntry(this.I,this.dir,this.H); } while(r.near);
    this.r=r; const b=norm(this.H+180); A.base({nav1:'FLS',obs:this.I,hdg:this.H,rad:b,dme:7,range:10,sectors:false,hold:{fix:'st',inb:this.I,dir:this.dir,leg:1}}); S.view.sectors=false; A.redraw(); },
  q(){ return {en:`Hold at FLS, inbound ${d3(this.I)}, ${this.dir>0?'right':'left'} turns. You fly to the fix on heading ${d3(this.H)}. Which entry?`,no:`Holding over FLS, inngående ${d3(this.I)}, ${this.dir>0?'høyresvinger':'venstresvinger'}. Du flyr til fiksen på kurs ${d3(this.H)}. Hvilken innflyging?`}; },
  check(v){ const r=this.r, out=norm(this.I+180); const m={en:`Heading ${d3(this.H)} is ${Math.round(r.rel)}° from the outbound course ${d3(out)}, measured towards the non-holding side: ${r.rel<70?'0–70° teardrop':r.rel>=250?'250–360° parallel':'70–250° direct'}.`,no:`Kurs ${d3(this.H)} er ${Math.round(r.rel)}° fra utgående kurs ${d3(out)}, målt mot ikke-holdingsiden: ${r.rel<70?'0–70° dråpe':r.rel>=250?'250–360° parallell':'70–250° direkte'}.`};
    return v===r.entry?{ok:1,m:{en:'Yes. '+m.en,no:'Ja. '+m.no}}:{ok:0,m:{en:`Not ${L(ent(v))}. `+m.en,no:`Ikke ${L(ent(v))}. `+m.no}}; },
  reveal(){ return ent(this.r.entry); }, after(){ S.view.sectors=true; A.redraw(); }},
 {k:'ils',t:t2('ILS: which way?','ILS: hvilken vei?'),kind:'choice',focus:['cdi','hsi'],mask:['map'],
  opts:[['ul',t2('Up and left','Opp og til venstre')],['ur',t2('Up and right','Opp og til høyre')],['dl',t2('Down and left','Ned og til venstre')],['dr',t2('Down and right','Ned og til høyre')]],
  gen(){ A.base({area:'bergen',nav1:'I17',obs:174,hdg:174,hideMap:true,range:10}); const i=A.nav1(); const lr=Math.random()<0.5?-1:1, ud=Math.random()<0.5?-1:1;
    placeOnApp(i,R(4,7),lr*R(0.15,0.35)); A.derive(); A.setAlt(Math.round(D.pathFt+ud*R(150,280))); A.derive(); A.redraw(); this.a=(D.gsDots>0?'u':'d')+(D.locDots>0?'r':'l'); },
  q(){ return t2('Front course, heading 174, map hidden. Read the CDI or the HSI: which way to the ILS path?','Frontkurs, kurs 174, kartet er skjult. Les CDI-en eller HSI-en: hvilken vei er det til ILS-banen?'); },
  check(v){ const up=D.gsDots>0, rt=D.locDots>0, m={en:`LOC needle ${rt?'right':'left'} → the centreline is ${rt?'right':'left'}; GS needle ${up?'up':'down'} → the path is ${up?'above':'below'} you. Fly towards both needles.`,no:`LOC-nålen til ${rt?'høyre':'venstre'} → senterlinjen er til ${rt?'høyre':'venstre'}; GS-nålen ${up?'opp':'ned'} → banen er ${up?'over':'under'} deg. Fly mot begge nålene.`};
    return v===this.a?{ok:1,m:{en:'Yes. '+m.en,no:'Ja. '+m.no}}:{ok:0,m:{en:(v[0]!==this.a[0]&&v[1]!==this.a[1]?'Both reversed: the needles point to the path, not to you. ':'')+m.en,no:(v[0]!==this.a[0]&&v[1]!==this.a[1]?'Begge omvendt: nålene peker mot banen, ikke mot deg. ':'')+m.no}}; },
  reveal(){ return ({ul:t2('Up and left','Opp og til venstre'),ur:t2('Up and right','Opp og til høyre'),dl:t2('Down and left','Ned og til venstre'),dr:t2('Down and right','Ned og til høyre')})[this.a]; }},
 {k:'fix',t:t2('Fly to a fix','Finn en fiks'),kind:'do',focus:['map','dme','rmi'],
  gen(){ this.r=R10(0,350); this.d=RI(6,25); A.base({nav1:'FLS',rad:norm(this.r+R(60,180)),dme:R(8,25),hdg:90,obs:0,range:40}); },
  q(){ return {en:`Put the aircraft at FLS R${d3(this.r)} / ${this.d} DME (drag it, or use the Radial and Distance fields).`,no:`Plasser flyet på FLS R${d3(this.r)} / ${this.d} DME (dra det, eller bruk feltene Radial og Avstand).`}; },
  check(){ A.derive(); const v=A.refVor(), b=N.toTrue(this.r,v.var)*Math.PI/180, fx=v.x+Math.sin(b)*this.d, fy=v.y+Math.cos(b)*this.d, e=Math.hypot(S.ac.x-fx,S.ac.y-fy);
    if(e<=1) return {ok:1,m:{en:`Yes: R${d3(D.rad)} / ${nf(D.dist,1)} NM, ${nf(e,1)} NM from the fix.`,no:`Ja: R${d3(D.rad)} / ${nf(D.dist,1)} NM, ${nf(e,1)} NM fra fiksen.`}};
    const rr=diff(D.rad,this.r), dd=D.dist-this.d; return {ok:0,m:{en:`You are on R${d3(D.rad)} / ${nf(D.dist,1)}: ${nf(e,1)} NM away${abs(rr)>2?`, ${nf(abs(rr),0)}° ${rr>0?'clockwise':'anticlockwise'} of the radial`:''}${abs(dd)>0.5?`, ${nf(abs(dd),1)} NM too ${dd>0?'far':'close'}`:''}.`,no:`Du er på R${d3(D.rad)} / ${nf(D.dist,1)}: ${nf(e,1)} NM unna${abs(rr)>2?`, ${nf(abs(rr),0)}° ${rr>0?'med klokka':'mot klokka'} fra radialen`:''}${abs(dd)>0.5?`, ${nf(abs(dd),1)} NM for ${dd>0?'langt ute':'nær'}`:''}.`}}; },
  reveal(){ A.act('pos',()=>A.placeRel('FLS',this.r,this.d)); return {en:`R${d3(this.r)} / ${this.d} DME: the aircraft is there now.`,no:`R${d3(this.r)} / ${this.d} DME: flyet står der nå.`}; }},
 {k:'sense',t:t2('Reverse sensing','Omvendt visning'),kind:'choice',focus:['cdi'],mask:['hsi','map'],
  opts:[['l',t2('To my left','Til venstre for meg')],['r',t2('To my right','Til høyre for meg')]],
  gen(){ const c=R10(0,350), sd=Math.random()<0.5?-1:1; A.base({nav1:'FLS',obs:c,rad:norm(c+sd*R(4,8)),dme:R(10,20),hdg:norm(c+180),hideMap:true}); this.c=c; /* flying the reciprocal: the course lies on the side opposite the needle */ this.a=D.dev>0?'l':'r'; this.dv=D.dev; },
  q(){ return {en:`OBS ${d3(this.c)}, heading ${d3(norm(this.c+180))}, needle ${sideL(this.dv)}. Where is the course line? (HSI and map covered)`,no:`OBS ${d3(this.c)}, kurs ${d3(norm(this.c+180))}, nålen til ${sideL(this.dv)}. Hvor er kurslinjen? (HSI og kart er dekket)`}; },
  check(v){ const m={en:`You are flying the reciprocal of the course set, so the CDI reverse-senses: needle ${sideL(this.dv)} means the line is to your ${this.a==='l'?'left':'right'}. Set the OBS to the direction you fly, or use an HSI.`,no:`Du flyr motsatt av kursen som er satt, så CDI-en viser omvendt: nålen til ${sideL(this.dv)} betyr at linjen er til ${this.a==='l'?'venstre':'høyre'} for deg. Sett OBS til retningen du flyr, eller bruk en HSI.`};
    return v===this.a?{ok:1,m:{en:'Yes. '+m.en,no:'Ja. '+m.no}}:{ok:0,m:{en:'Not quite. '+m.en,no:'Ikke helt. '+m.no}}; },
  reveal(){ return this.a==='l'?t2('To your left','Til venstre'):t2('To your right','Til høyre'); }}
];
const PKEY=Object.fromEntries(PRACT.map((p,i)=>[p.k,i]));

/* =====================================================================
   Scenarios (Explore and Instructor)
   ===================================================================== */
const SCEN=[
 {k:'int',t:t2('Intercept FLS R180 inbound, hold at 10 DME','Avskjær FLS R180 inngående, hold på 10 DME'),go:()=>LESSONS[9].setup()},
 {k:'ils',t:t2('ILS 17 Bergen, 10 NM, crosswind 240/20','ILS 17 Bergen, 10 NM, sidevind 240/20'),go:()=>{ A.base({area:'bergen',nav1:'I17',obs:174,hdg:200,tas:120,alt:3000,wdir:240,wspd:20,profile:true,range:20}); placeOnApp(A.nav1(),10,1.5); A.derive(); A.redraw(); A.fieldsSync(true); }},
 {k:'ndb',t:t2('Track to ASK NDB in a 30 kt crosswind','Track til ASK NDB i 30 kt sidevind'),go:()=>A.base({nav1:'FLS',adf:'ASK',at:'ASK',rad:180,dme:15,hdg:360,wdir:270,wspd:30,obs:0,course:false})},
 {k:'pass',t:t2('Station passage at FL100','Stasjonspassering i FL100'),go:()=>A.base({nav1:'FLS',obs:90,rad:270,dme:8,hdg:90,alt:10000,tas:200,profile:true,range:10})},
 {k:'grm',t:t2('Gardermoen: GRM R010 outbound','Gardermoen: GRM R010 utgående'),go:()=>A.base({area:'oslo',nav1:'GRM',adf:'SLB',obs:10,rad:40,dme:12,hdg:300,wdir:300,wspd:15,range:20})},
 {k:'rev',t:t2('Reverse sensing trap','Felle: omvendt visning'),go:()=>A.base({nav1:'FLS',obs:360,rad:175,dme:12,hdg:180})},
 {k:'wh',t:t2('Windy hold: GRM inbound 190, left turns, 250/45','Vind i holding: GRM inngående 190, venstresvinger, 250/45'),go:()=>A.base({area:'oslo',nav1:'GRM',obs:190,rad:100,dme:12,hdg:280,wdir:250,wspd:45,range:20,sectors:true,tas:160,hold:{fix:'st',inb:190,dir:-1,leg:1}})},
 {k:'free',t:t2('Free flight: everything reset','Fri flyging: alt tilbakestilt'),go:()=>A.base({nav1:'FLS',obs:270,rad:90,dme:15,hdg:270})}
];

/* =====================================================================
   Guide strip and the mode-specific panel block
   ===================================================================== */
const G={li:0,si:0,ctx:{},done:false,why:null,pi:0,pt:null,fb:null,ans:'',revealed:false,picked:null};
const box=el('nsGuide');
function setWhy(w){ G.why=w; drawWhy(); }
function drawWhy(){ const e=box.querySelector('.nsg-why'); if(!e) return; const show=G.why&&(S.guide||S.mode==='learn'); e.hidden=!show; if(show) e.innerHTML=`<b>${L(t2('Why','Hvorfor'))}</b> ${L(G.why)}`; }
const Lx=o=>typeof o==='function'?L(o()):L(o);
function stepObj(){ return LESSONS[G.li].steps[G.si]; }
function startStep(){ const st=stepObj(); G.ctx={}; G.done=false; G.picked=null; if(st.begin) st.begin(G.ctx); A.focus(st.focus); drawGuide(); progress(); }
function startLesson(i){ G.li=(i+LESSONS.length)%LESSONS.length; G.si=0; G.why=null; LESSONS[G.li].setup(); startStep(); drawTop(); }
function progress(){ if(S.mode!=='learn'||G.done) return; const st=stepObj(); if(st.choice) return; if(st.check&&st.check(G.ctx)){ G.done=true; G.why=st.ok(); drawGuide(); } }
let hintT=0;
A.onTick=dt=>{ if(S.mode==='learn'){ const st=stepObj(); if(st.tick&&!G.done) st.tick(G.ctx,dt*(S.run?1:0)); progress(); hintT+=dt; if(hintT>0.4){ hintT=0; const h=box.querySelector('.nsg-hint'); if(h&&S.guide&&typeof st.hint==='function'){ const t=Lx(st.hint); if(h.dataset.t!==t){ h.dataset.t=t; h.innerHTML=`<b>${L(t2('Next step','Neste steg'))}</b> ${t}`; } } } } };
function guideHead(k,t,extra){ return `<div class="nsg-h"><span class="nsg-k">${k}</span><span class="nsg-t">${t}</span>${extra||''}<button type="button" class="nsg-gt" aria-pressed="${S.guide}" title="G">${L(t2('Guide','Veileder'))}: ${S.guide?L(t2('on','på')):L(t2('off','av'))}</button></div>`; }
function drawGuide(){
  box.dataset.mode=S.mode;
  if(S.mode==='learn'){ const ls=LESSONS[G.li], st=stepObj(), n=ls.steps.length, last=G.si===n-1;
    const dots=ls.steps.map((_,i)=>`<i class="${i<G.si||(i===G.si&&G.done)?'d':i===G.si?'c':''}"></i>`).join('');
    let html=guideHead(`${L(t2('Lesson','Leksjon'))} ${G.li+1}/${LESSONS.length} · ${L(t2('Step','Steg'))} ${G.si+1}/${n}`,L(ls.t),`<span class="nsg-dots" aria-hidden="true">${dots}</span>`);
    html+=`<p class="nsg-do${G.done?' ok':''}">${G.done?'<span class="nsg-ck" aria-hidden="true">✓</span>':''}${Lx(st.do)}</p>`;
    if(st.choice){ const r=st.choice.ans(); html+=`<div class="nsg-opts">${st.choice.opts.map(([k,t])=>`<button type="button" class="btn sm${G.picked?(k===r.entry?' right':k===G.picked?' wrong':''):''}" data-pick="${k}"${G.picked?' disabled':''}>${L(t)}</button>`).join('')}</div>`;
      if(G.picked) G.why=st.choice.fb(G.picked,r); }
    if(st.hint) html+=`<p class="nsg-hint"${S.guide&&!G.done?'':' hidden'} data-t="${Lx(st.hint).replace(/"/g,'&quot;')}"><b>${L(t2('Next step','Neste steg'))}</b> ${Lx(st.hint)}</p>`;
    html+=`<p class="nsg-why" hidden></p>`;
    html+=`<div class="nsg-act"><button type="button" class="btn sm quiet" data-a="back"${G.si===0&&G.li===0?' disabled':''}>← ${L(t2('Back','Tilbake'))}</button><button type="button" class="btn sm" data-a="show"${G.done?' disabled':''}>${L(t2('Show me','Vis meg'))}</button><button type="button" class="btn sm quiet" data-a="restart">${L(t2('Restart step','Start steget på nytt'))}</button><button type="button" class="btn sm pri" data-a="next"${G.done?'':' disabled'}>${last?(G.li<LESSONS.length-1?L(t2('Next lesson','Neste leksjon'))+' →':L(t2('Finish','Ferdig'))):L(t2('Next','Neste'))+' →'}</button></div>`;
    box.innerHTML=html; drawWhy(); if(G.done){ const nb=box.querySelector('[data-a="next"]'); if(nb&&box.contains(document.activeElement)===false){} } return; }
  if(S.mode==='practice'){ const p=G.pt; if(!p){ box.innerHTML=guideHead(L(t2('Practice','Øving')),'')+`<p class="nsg-do">${L(t2('Pick a task in the panel, or press New task.','Velg en oppgave i panelet, eller trykk Ny oppgave.'))}</p>`; return; }
    let html=guideHead(L(t2('Practice','Øving')),L(p.t));
    html+=`<p class="nsg-do">${L(p.q())}</p>`;
    if(p.kind==='num') html+=`<div class="nsg-in"><input id="nsgAns" inputmode="decimal" autocomplete="off" aria-label="${L(t2('Your answer','Svaret ditt'))}" value="${G.ans}"><span>${p.unit||''}</span><button type="button" class="btn sm pri" data-a="check">${L(t2('Check','Sjekk'))}</button></div>`;
    else if(p.kind==='choice') html+=`<div class="nsg-opts">${p.opts.map(([k,t])=>`<button type="button" class="btn sm${G.fb&&G.fb.v===k?(G.fb.ok?' right':' wrong'):''}" data-pick="${k}">${L(t)}</button>`).join('')}</div>`;
    else html+=`<div class="nsg-in"><button type="button" class="btn sm pri" data-a="check">${L(t2('Check my answer','Sjekk svaret'))}</button></div>`;
    if(G.fb) html+=`<p class="nsg-fb ${G.fb.ok?'ok':'no'}"><b>${G.fb.ok?L(t2('Correct','Riktig')):L(t2('Not quite','Ikke helt'))}.</b> ${L(G.fb.m)}</p>`;
    if(G.revealed) html+=`<p class="nsg-fb"><b>${L(t2('Answer','Svar'))}:</b> ${L(G.revealed)}</p>`;
    html+=`<p class="nsg-hint"${S.guide&&!G.fb?'':' hidden'}><b>${L(t2('Tip','Tips'))}</b> ${L(t2('The dimmed instruments are not needed; covered ones are hidden on purpose.','De dempede instrumentene trengs ikke; de dekkede er skjult med vilje.'))}</p><p class="nsg-why" hidden></p>`;
    html+=`<div class="nsg-act"><button type="button" class="btn sm quiet" data-a="reveal">${L(t2('Show the answer','Vis svaret'))}</button><button type="button" class="btn sm pri" data-a="new">${L(t2('New task','Ny oppgave'))} →</button></div>`;
    box.innerHTML=html; drawWhy(); return; }
  if(S.mode==='instructor'){ box.innerHTML=guideHead(L(t2('Instructor','Instruktør')),L(t2('Presenter mode','Presentasjonsmodus')))+`<p class="nsg-do">${L(t2('Pick a scenario in the panel. Hide the answers or the map, ask the class to read the instruments, then reveal.','Velg et scenario i panelet. Skjul svarene eller kartet, la klassen lese instrumentene, og vis så svaret.'))}</p><p class="nsg-why" hidden></p><div class="nsg-act"><button type="button" class="btn sm" data-a="hideAns" aria-pressed="${S.view.hideAns}">${L(t2('Hide answers','Skjul svar'))}</button><button type="button" class="btn sm" data-a="hideMap" aria-pressed="${S.view.hideMap}">${L(t2('Hide the map','Skjul kartet'))}</button><button type="button" class="btn sm pri" data-a="revealAll">${L(t2('Reveal','Vis'))}</button></div>`; drawWhy(); return; }
  box.innerHTML=guideHead(L(t2('Explore','Utforsk')),L(t2('Everything is free','Alt er fritt')))+`<p class="nsg-do">${L(t2('Drag the aircraft, turn the knobs, type any value, press ▶ Fly. Turn on the Guide to get a “why” after each change.','Dra flyet, drei på knappene, skriv inn verdier, trykk ▶ Fly. Slå på veilederen for å få et «hvorfor» etter hver endring.'))}</p><p class="nsg-why" hidden></p>`; drawWhy(); }
box.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.classList.contains('nsg-gt')){ guideToggle(); return; }
  const a=b.dataset.a, pk=b.dataset.pick;
  if(S.mode==='learn'){ const st=stepObj();
    if(pk&&st.choice&&!G.picked){ G.picked=pk; const r=st.choice.ans(); G.done=true; G.why=st.choice.fb(pk,r); drawGuide(); return; }
    if(a==='next'){ if(G.si<LESSONS[G.li].steps.length-1){ G.si++; startStep(); } else if(G.li<LESSONS.length-1){ startLesson(G.li+1); } else { G.why=t2('All ten lessons done. Try Practice, or set up your own flight in Explore.','Alle ti leksjonene er ferdige. Prøv Øv, eller sett opp din egen flyging i Utforsk.'); drawGuide(); } focusNext(); }
    else if(a==='back'){ if(G.si>0){ G.si--; startStep(); } else if(G.li>0){ startLesson(G.li-1); } }
    else if(a==='show'){ if(st.choice){ const r=st.choice.ans(); G.picked=r.entry; G.done=true; G.why=st.choice.fb(r.entry,r); drawGuide(); } else { st.show(); A.derive(); progress(); } }
    else if(a==='restart'){ const keep=G.si; LESSONS[G.li].setup(); for(let i=0;i<keep;i++){ const s=LESSONS[G.li].steps[i]; if(s.begin) s.begin({}); if(s.show&&!s.choice) s.show(); } G.si=keep; A.run(false); startStep(); }
    return; }
  if(S.mode==='practice'){ const p=G.pt; if(!p&&a!=='new') return;
    if(a==='new'){ newTask(G.pi); return; }
    if(a==='check'){ let r; if(p.kind==='num'){ const inp=el('nsgAns'); G.ans=inp.value; const v=parseFloat(String(inp.value).replace(',','.')); if(!Number.isFinite(v)){ G.fb={ok:0,m:t2('Type a number first.','Skriv inn et tall først.')}; drawGuide(); return; } r=p.check(v); } else r=p.check(); G.fb=r; if(r.ok){ if(p.after) p.after(); unmask(); } drawGuide(); return; }
    if(pk){ const r=p.check(pk); G.fb=Object.assign({v:pk},r); if(p.after) p.after(); unmask(); drawGuide(); return; }
    if(a==='reveal'){ G.revealed=p.reveal(); unmask(); drawGuide(); return; } return; }
  if(S.mode==='instructor'){ if(a==='hideAns'){ S.view.hideAns=!S.view.hideAns; } if(a==='hideMap'){ S.view.hideMap=!S.view.hideMap; } if(a==='revealAll'){ S.view.hideAns=false; S.view.hideMap=false; } A.redraw(); drawGuide(); drawTop(); } });
box.addEventListener('keydown',e=>{ if(e.target.id==='nsgAns'&&e.key==='Enter'){ e.preventDefault(); const c=box.querySelector('[data-a="check"]'); if(c) c.click(); } e.stopPropagation(); });
box.addEventListener('input',e=>{ if(e.target.id==='nsgAns') G.ans=e.target.value; });
function focusNext(){ const b=box.querySelector('[data-a="next"],[data-a="show"]'); if(b&&document.activeElement&&box.contains(document.activeElement)) b.focus(); }
function unmask(){ A.focus(G.pt?G.pt.focus:null,null); S.view.hideMap=false; S.view.hideAns=false; A.redraw(); A.fieldsSync(true); }
function guideToggle(){ S.guide=!S.guide; drawGuide(); }
A.guideToggle=guideToggle;
function newTask(i){ G.pi=i==null?Math.floor(Math.random()*PRACT.length):i; const p=PRACT[G.pi]; G.pt=p; G.fb=null; G.ans=''; G.revealed=false; G.why=null; p.gen(); A.focus(p.focus,p.mask); drawGuide(); drawTop();
  const inp=el('nsgAns'); if(inp&&matchMedia('(hover:hover)').matches) inp.focus({preventScroll:true}); }
A.practice=newTask;

const top=el('nsTop');
function drawTop(){ const sum=top.closest('details').querySelector('summary');
  if(S.mode==='learn'){ sum.textContent=L(t2('Lessons','Leksjoner'));
    top.innerHTML=`<ol class="ns-list">${LESSONS.map((l,i)=>`<li><button type="button" data-l="${i}" class="${i===G.li?'on':''}" aria-current="${i===G.li?'step':'false'}"><i>${i+1}</i><span>${L(l.t)}</span></button></li>`).join('')}</ol>`; }
  else if(S.mode==='practice'){ sum.textContent=L(t2('Practice tasks','Øvingsoppgaver'));
    top.innerHTML=`<ol class="ns-list">${PRACT.map((p,i)=>`<li><button type="button" data-p="${i}" class="${G.pt===p?'on':''}"><i>${i+1}</i><span>${L(p.t)}</span></button></li>`).join('')}</ol><div class="btns" style="margin-top:8px"><button type="button" class="btn sm pri" data-p="r">${L(t2('Random task','Tilfeldig oppgave'))}</button></div>`; }
  else { sum.textContent=L(t2('Scenarios','Scenarier'));
    top.innerHTML=`<ol class="ns-list">${SCEN.map((s,i)=>`<li><button type="button" data-s="${i}"><i>${i+1}</i><span>${L(s.t)}</span></button></li>`).join('')}</ol>`+(S.mode==='instructor'?`<div class="xtogs" style="margin-top:8px"><button type="button" class="xtog" data-t="hideAns" aria-pressed="${S.view.hideAns}">${L(t2('Hide answers','Skjul svar'))}</button><button type="button" class="xtog" data-t="hideMap" aria-pressed="${S.view.hideMap}">${L(t2('Hide the map','Skjul kartet'))}</button></div>`:''); } }
top.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.l!=null) startLesson(+b.dataset.l);
  else if(b.dataset.p!=null) newTask(b.dataset.p==='r'?null:+b.dataset.p);
  else if(b.dataset.s!=null){ SCEN[+b.dataset.s].go(); A.focus(null); G.why=null; drawGuide(); }
  else if(b.dataset.t){ S.view[b.dataset.t]=!S.view[b.dataset.t]; A.redraw(); drawTop(); drawGuide(); } });

function setMode(m){ S.mode=m; A.run(false); A.focus(null); document.querySelectorAll('#nsModes [data-m]').forEach(b=>{ b.classList.toggle('on',b.dataset.m===m); b.setAttribute('aria-selected',String(b.dataset.m===m)); });
  el('nsvp').dataset.mode=m;
  A.panel();
  if(m==='learn'){ S.guide=true; S.view.hideAns=false; S.view.hideMap=false; startLesson(G.li); }
  else if(m==='practice'){ S.guide=true; S.view.hideAns=false; newTask(G.pt?G.pi:0); }
  else if(m==='explore'){ S.guide=false; S.view.hideAns=false; S.view.hideMap=false; G.why=null; A.redraw(); }
  else { S.guide=false; G.why=null; A.redraw(); }
  if(m!=='learn'&&m!=='practice') drawTop(); drawGuide(); }
A.setMode=setMode;
A.reset=()=>{ if(S.mode==='learn') startLesson(G.li); else if(S.mode==='practice') newTask(G.pi); else SCEN[SCEN.length-1].go(); };
A.lesson=i=>{ if(S.mode!=='learn'){ S.mode='learn'; } setMode('learn'); startLesson(i); };
A.G=G; A.LESSONS=LESSONS; A.PRACT=PRACT; A.SCEN=SCEN; A.step=()=>stepObj();
LAB.onLang(()=>{ drawGuide(); drawTop(); });

/* Try it: the practice tasks as boxes under the model (template step "Try") */
const tasksEl=el('nsTasks');
if(tasksEl){ const pick=[0,1,4,6,7,9]; const draw=()=>{ tasksEl.innerHTML=pick.map((pi,j)=>`<li class="task"><span class="n">${L(t2('Task','Oppgave'))} ${j+1}</span><p class="q">${L(PRACT[pi].t)}</p><p>${L(({radial:t2('Map hidden: read your radial from the instruments.','Kartet er skjult: les radialen fra instrumentene.'),qdm:t2('Fixed-card ADF and heading only: find the QDM.','Bare ADF med fast skive og kurs: finn QDM.'),wind:t2('Work out the heading for a track in a crosswind.','Regn ut kursen for en track i sidevind.'),hold:t2('Pick the ICAO entry, then see the sectors.','Velg ICAO-innflygingen, og se sektorene.'),ils:t2('Two needles, map hidden: which way to the path?','To nåler, kartet er skjult: hvilken vei til banen?'),sense:t2('Flying away from the course on a CDI: where is the line?','Du flyr bort fra kursen med en CDI: hvor er linjen?')})[PRACT[pi].k])}</p><div class="btns"><button type="button" class="btn pri sm" data-go="${pi}">${L(t2('Do it in the simulator','Gjør det i simulatoren'))} ↑</button></div></li>`).join(''); };
  draw(); LAB.onLang(draw);
  tasksEl.addEventListener('click',e=>{ const b=e.target.closest('[data-go]'); if(!b) return; setMode('practice'); newTask(+b.dataset.go); el('explore').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'}); }); }

/* start: ?lesson=holding (or a number) opens that lesson; ?mode=explore|practice|instructor */
const q=new URLSearchParams(location.search), lq=q.get('lesson'), mq=q.get('mode');
if(lq!=null){ const i=LKEY[lq]!=null?LKEY[lq]:clampI(parseInt(lq,10)-1); G.li=i; setMode('learn'); }
else if(mq&&['learn','practice','explore','instructor'].includes(mq)) setMode(mq);
else setMode('learn');
function clampI(v){ return Number.isFinite(v)?Math.max(0,Math.min(LESSONS.length-1,v)):0; }
};
if(window.NSIM&&!window.NSIM.LESSONS) window.NAVLESSONS(window.NSIM);
