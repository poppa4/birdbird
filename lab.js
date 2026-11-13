/* Birdbird Virtual Lab – felles: språk, navigasjon, kontroller, quiz.
   Kildetekst i HTML og kode er norsk; engelsk er standard i grensesnittet.

   THE LAB TEMPLATE (one shell for every lab; the page keeps only its own subject content and model)
   Header      eyebrow "Virtual Labs · Area N · <area>" · H1 · purpose (one paragraph) · "Learning goal" (p.goal; from the page,
               else GOAL below) · meta row (Applies to, Model and limitations, depth).
   Orientation sidebar (area topics + this lab's sections), sticky step bar 1 Understand · 2 Explore · 3 Test yourself, depth switch
               Short / Deep dive / Instructor. Section eyebrows are written by the shell from data-step, so they read the same everywhere.
   Order       Understand (key concepts) → Explore (.xapp: viewport with view tabs, read-out chip and legend; .xsee "what you are seeing";
               Controls panel; Try it) → Test yourself (Key points, then the quiz) → Practise it → Model and limitations → Next.
   Controls    LAB.slider (label left, value + unit right, arrow keys / Page / Home / End) and LAB.seg (pressed buttons).
               View tabs (.vtabs[role=tablist]) get tab roles and Left/Right keys from the shell.
   Reset       LAB.reset(fn[,viewport]) puts one "Reset" button at the right end of the viewport bar. fn returns the model to its starting
               values and keeps the current view, depth and language. LAB.keep(S) snapshots a state object for that.
   Phones      (≤900 px) viewport first, then the Controls tray: collapsed under the model, and it stays at the bottom edge while the model
               is on screen. Touch targets are at least 44 px.
   Canvas      every canvas with an aria-label is exposed as an image (role=img); live values are in the chip (aria-live). */
(function(){
  'use strict';
  const D={
    'Vindtunnel':'Wind tunnel','Flymotorer':'Aircraft engines','Drivstoff og elektrisk':'Fuel and electrics','Kompass og gyroer':'Compass and gyros','Flysystemer':'Aircraft systems','Propelleffekter (P-faktor)':'Propeller effects (P-factor)','CG og stabilitet':'CG and stability','Sideslip':'Sideslip','Trykk og høyde':'Pressure & altitude','Romlig orientering':'Spatial orientation','Holding':'Holding','Pitot-statisk':'Pitot-static','Aerodynamikk':'Aerodynamics','Meteorologi':'Meteorology','Instrumenter':'Instruments','Navigasjon og innflyging':'Navigation and approach','Menneskelige faktorer':'Human factors','Alle labber':'All labs','Alle emner':'All topics','Modul':'Module','Lab':'Lab','Forrige':'Previous','Neste modul':'Next module','Ferdig':'Done','Læringsløpet':'Learning path','Vær og fronter':'Weather and fronts','Skyer og tåke':'Clouds and fog','Fronter og trykksystemer':'Fronts and pressure systems','Trykk, fronter og vind':'Pressure, fronts and wind','Tordenvær og vindskjær':'Thunderstorms and wind shear','Tordenvær og CB':'Thunderstorms and CB','Ising og turbulens':'Icing and turbulence','Vind og vindskjær':'Wind and wind shear','Værfarer':'Weather hazards','Instrumentinnflyging':'Instrument approach','Radionavigasjon':'Radio navigation','GNSS og RNAV':'GNSS and RNAV',
    'Test deg selv':'Test yourself','Spørsmål':'Question','Riktig':'Correct','Feil':'Not quite','Neste':'Next','Se resultat':'See result',
    'Prøv igjen':'Try again','Ditt resultat':'Your result','Beste resultat':'Best score','av':'of','riktige':'correct',
    'Sterkt! Du har god kontroll på dette.':'Strong result. You have a good grip on this.','Godt jobbet. Les forklaringene på det du bommet på.':'Good work. Read the explanations for the ones you missed.',
    'Gå gjennom stoffet over og prøv igjen.':'Go through the material above and try again.','Seksjoner':'Sections','Språk':'Language',
    'Pedagogisk modell. Bruk tallene til å forstå sammenhenger, ikke til operative beslutninger. Følg alltid AIP, flygehåndbok og instruktør.':'Teaching model. Use the numbers to understand relationships, not for operational decisions. Always follow the AIP, the aircraft flight manual and your instructor.'
  };
  const NO={'Controls':'Kontroller','Key points':'Det viktigste','Key concepts':'Nøkkelbegreper','Try it':'Prøv selv'};
  let lang='en'; try{ const l=localStorage.getItem('vlab-lang'); if(l==='no'||l==='en') lang=l; }catch(e){}
  const hooks=[];
  const T=s=> lang==='en' ? (D[s]!==undefined? D[s] : s) : (NO[s]!==undefined? NO[s] : s);
  const L=o=> (o && typeof o==='object' && 'en' in o) ? (lang==='en'? o.en : o.no) : T(o);
  /* number formatters are kept per language and precision (the same output as toLocaleString, which builds a new one on every call) */
  const NFC={};
  const nf=(v,d)=>{ if(!Number.isFinite(v)) return '–'; const k=lang+'|'+d; return (NFC[k]||(NFC[k]=new Intl.NumberFormat(lang==='en'?'en-GB':'nb-NO',{minimumFractionDigits:d,maximumFractionDigits:d}))).format(v); };
  const el=id=>document.getElementById(id);

  // statisk tekst
  const nodes=[];
  function scan(root){
    const w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT); let n;
    while((n=w.nextNode())){ const t=n.nodeValue.trim(); if(t && (D[t]!==undefined||NO[t]!==undefined) && !n.parentElement.closest('script,style,[data-tx]')){ nodes.push({n,orig:t,raw:n.nodeValue}); n.parentElement.setAttribute('data-ltx',''); } }  /* data-ltx: translated node by node, so glossary.js leaves it alone */
    (root||document).querySelectorAll('[aria-label]').forEach(e=>{ const t=e.getAttribute('aria-label'); if(D[t]!==undefined) nodes.push({e,orig:t}); });
  }
  /* rich text: an element with data-tx="key" keeps its English HTML from the page; LAB.tx({key:'Norsk <b>HTML</b>'}) supplies the Norwegian */
  const TXD={};
  function txApply(){ document.querySelectorAll('[data-tx]').forEach(e=>{ if(e._txEn===undefined) e._txEn=e.innerHTML; const k=e.dataset.tx; e.innerHTML= lang==='no'&&TXD[k]!==undefined? TXD[k] : e._txEn; }); }
  function apply(){
    txApply();
    for(const x of nodes){ if(x.e) x.e.setAttribute('aria-label',T(x.orig)); else x.n.nodeValue=x.raw.replace(x.orig,T(x.orig)); }
    document.documentElement.lang= lang==='en'?'en':'nb';
    document.querySelectorAll('.langseg button').forEach(b=>b.classList.toggle('on',b.dataset.v===lang));
    if(document.body.dataset.title){ const dt=T(document.body.dataset.title); document.title=/Birdbird/.test(dt)?dt:dt+' · Birdbird'; }
    eyebrows();
  }
  function setLang(l){ lang=l; try{ localStorage.setItem('vlab-lang',l); }catch(e){} apply(); hooks.forEach(f=>f()); eyebrows(); }

  // header: lab-navigasjon + språk
  /* Virtual Labs information architecture ("Atlas"): six subject areas, then "More" (not an area card).
     Lab tuple: [file, page key, EN, NO, level]. level: 'jet' = numbers from the A320 teaching model, 'mix' = A320 + light twin, 'la' = light twin, '' = all aircraft.
     Area meta: d = one-line description, c = 3–4 concepts you learn (EN/NO). The first lab of an area is its recommended start. */
  const t2=(en,no)=>({en,no});
  const PATH=[
   {k:'pof',en:'Aerodynamics',no:'Aerodynamikk',d:t2('How a wing makes lift, what keeps the aircraft stable and controllable, and what changes at high speed.','Hvordan vingen lager løft, hva som holder flyet stabilt og styrbart, og hva som endrer seg i høy fart.'),
    c:[t2('Lift, drag and stall','Løft, motstand og stall'),t2('Stability and load factor','Stabilitet og lastfaktor'),t2('Engine failure and VMC','Motorstans og VMC'),t2('Mach and buffet','Mach og buffet')],
    labs:[['tunnel.html','tunnel','Wind tunnel','Vindtunnel','jet'],['forces.html','forces','Forces in flight','Krefter i flyging',''],['stability.html','stab','Stability, controls and load factor','Stabilitet, ror og lastfaktor','jet'],['propeller.html','prop','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter','mix'],['highspeed.html','hs','High-speed flight and drag','Høyfart og motstand','jet']]},
   {k:'met',en:'Meteorology and the atmosphere',no:'Meteorologi og atmosfæren',d:t2('Pressure and wind first, then the clouds, storms and hazards that shape every flight.','Trykk og vind først, så skyene, uværet og farene som former hver flytur.'),
    c:[t2('Pressure systems and wind','Trykksystemer og vind'),t2('Fronts and air masses','Fronter og luftmasser'),t2('Cloud, stability and fog','Skyer, stabilitet og tåke'),t2('Thunderstorms, icing and turbulence','Tordenvær, ising og turbulens')],
    labs:[['pressure.html','pressure','Pressure and wind','Trykk og vind',''],['fronts.html','fronts','Fronts and air masses','Fronter og luftmasser',''],['clouds.html','clouds','Clouds, stability and fog','Skyer, stabilitet og tåke',''],['storms.html','storms','Thunderstorms and wind shear','Tordenvær og vindskjær',''],['hazards.html','hazards','Icing and turbulence','Ising og turbulens',''],['wxreports.html','wxreports','Reading the weather','Les værmeldingen','']]},
   {k:'nav',en:'Navigation and instrument procedures',no:'Navigasjon og instrumentprosedyrer',d:t2('From the wind triangle to the ILS: knowing where you are and flying the published procedure.','Fra vindtrekanten til ILS: vite hvor du er og fly den publiserte prosedyren.'),
    c:[t2('Wind triangle and 1 in 60','Vindtrekanten og 1 av 60'),t2('VOR, DME and radar','VOR, DME og radar'),t2('GNSS and RNAV','GNSS og RNAV'),t2('Holding and approach','Holding og innflyging')],
    labs:[['radionav.html','radionav','Radio navigation simulator','Radionavigasjonssimulator',''],['gennav.html','gnav','General navigation','Generell navigasjon',''],['gnss.html','gnss','GNSS and RNAV','GNSS og RNAV',''],['holding.html','hold','Holding and instrument approach','Holding og instrumentinnflyging','']]},
   {k:'inst',en:'Instruments',no:'Instrumenter',d:t2('What the altimeter, airspeed and attitude references really measure, and how they mislead you, plus the automation and warnings built on them.','Hva høydemåler, fartsmåler og attitydereferanser egentlig måler, og hvordan de kan lure deg, pluss automatikken og varslingen bygget på dem.'),
    c:[t2('Altimeter settings and errors','Høydemålerinnstillinger og feil'),t2('Pitot-static faults','Feil i pitot-statisk system'),t2('Compass and gyros','Kompass og gyroer'),t2('Inertial and AHRS','Treghet og AHRS'),t2('Autopilot, TCAS and EGPWS','Autopilot, TCAS og EGPWS')],
    labs:[['airdata.html','air','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart',''],['gyros.html','gyro','Attitude and heading: compass, gyros and inertial systems','Holdning og kurs: kompass, gyroer og treghetssystemer',''],['autoflight.html','af','Automation and warnings: autopilot, TCAS and EGPWS','Automatikk og varsling: autopilot, TCAS og EGPWS','']]},
   {k:'sys',en:'Aircraft and engine systems',no:'Fly- og motorsystemer',d:t2('Piston, turboprop and jet engines, then hydraulics, electrics, fuel, landing gear and pressurisation.','Stempel-, turboprop- og jetmotorer, deretter hydraulikk, elektrisk, drivstoff, understell og trykkabin.'),
    c:[t2('Piston, turboprop and jet','Stempel, turboprop og jet'),t2('Hydraulics and fly-by-wire','Hydraulikk og fly-by-wire'),t2('Cabin altitude and hypoxia','Kabinhøyde og hypoksi'),t2('Electrics, fuel and landing gear','Elektrisk, drivstoff og understell')],
    labs:[['engines.html','engines','Powerplant: piston, turboprop and jet','Motorer: stempel, turboprop og jet',''],['jetsystems.html','jets','Aircraft systems: hydraulics, electrics, fuel, flight controls and landing gear','Flysystemer: hydraulikk, elektrisk, drivstoff, flykontroller og understell',''],['pressurisation.html','press','Pressurisation and oxygen','Trykkabin og oksygen','']]},
   {k:'perf',en:'Performance',no:'Ytelse',d:t2('Take-off, climb, cruise and landing numbers, and the fuel you plan to carry.','Tall for start, stigning, cruise og landing, og drivstoffet du planlegger å ha med.'),
    c:[t2('V1 and runway limits','V1 og rullebanebegrensninger'),t2('Climb and cruise','Stigning og cruise'),t2('Landing distance','Landingsdistanse'),t2('Fuel planning','Drivstoffplanlegging')],
    labs:[['performance.html','perf','Take-off and landing performance','Start- og landingsytelse',''],['flightplanning.html','fpl','Climb, cruise and fuel planning','Stigning, marsj og drivstoffplanlegging','']]},
   /* not one of the six areas: reachable from "More" at the bottom of lab.html */
   {k:'hf',more:true,en:'Human factors',no:'Menneskelige faktorer',d:t2('Spatial disorientation, attention, workload, error, fatigue and hypoxia.','Romlig desorientering, oppmerksomhet, arbeidsbelastning, feil, tretthet og hypoksi.'),c:[],
    labs:[['orientation.html','ori','Spatial orientation and illusions','Romlig orientering og illusjoner',''],['humanperf.html','hp','Human performance: attention, workload, error and fatigue','Menneskelig ytelse: oppmerksomhet, arbeidsbelastning, feil og tretthet','']]}];
  const AREAS=PATH.filter(m=>!m.more), MORE=PATH.filter(m=>m.more);
  const FLAT=PATH.flatMap((m,mi)=>m.labs.map((l,li)=>({m,mi,li,f:l[0],k:l[1],en:l[2],no:l[3],lv:l[4]})));
  /* A lab that is kept but not listed on lab.html (no area card, not counted): it still gets the same shell. */
  const UNLISTED=[{k:'mbx',more:true,en:'Mass and balance',no:'Masse og balanse',labs:[['massbalance.html','mb','Mass and balance','Masse og balanse','jet']]}]
    .flatMap(m=>m.labs.map((l,li)=>({m,mi:-1,li,f:l[0],k:l[1],en:l[2],no:l[3],lv:l[4],unlisted:true})));
  /* Sections of every lab: [anchor id, EN, NO, type]  type: sim | drill | read | quiz  (also used by lab.html's topic search) */
  const TOP=/*TOPICS*/{"airdata.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The air data lab","Luftdatalabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"wxreports.html":[["concepts","Key concepts","Nøkkelbegreper","read"],["explore","Weather report decoder","Værrapport-dekoder","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"forces.html":[["four","The four forces","De fire kreftene","read"],["model","Forces in flight lab","Kraftlab","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"tunnel.html":[["concepts","Key concepts","Nøkkelbegreper","read"],["profil","Aerofoil section and stall","Profilsnitt og stall","sim"],["tunnel","3D wind tunnel","3D-vindtunnel","sim"],["stall","Stall and stall speed","Stall og stallfart","sim"],["try","Things to try","Prøv dette","drill"],["wake","Wingtip vortices","Vingetippvirvler","sim"],["ground","Ground effect","Bakkeeffekt","sim"],["debrief","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"stability.html":[["understand","CG, lift and the tail","CG, løft og halen","read"],["basics","CG and mass model","CG- og massemodell","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["static","Static stability","Statisk stabilitet","sim"],["dynamic","Dynamic stability","Dynamisk stabilitet","sim"],["vn","Load factor","Lastfaktor","sim"],["controls","Flight controls","Flykontroller","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"propeller.html":[["pfactor","P-factor and the critical engine","P-faktor og kritisk motor","read"],["lt","Light twin: engine failure","Lett tomotors: motorstans","sim"],["pwing","Propeller as a wing","Propellen som vinge","sim"],["single","VMCA lab (A320)","VMCA-lab (A320)","sim"],["try","Try it","Prøv selv","drill"],["cert","Certification and speeds","Sertifisering og farter","read"],["ops","Failure after V1","Motorstans etter V1","read"],["quiz","Test yourself","Test deg selv","quiz"]],"highspeed.html":[["understand","Two limits: drag and Mach","To grenser: motstand og Mach","read"],["explore","The flight envelope lab","Flykonvoluttlabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"clouds.html":[["understand","Key concepts","Nøkkelbegreper","read"],["lift","Clouds and stability lab","Sky- og stabilitetslabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"pressure.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","Build the wind","Bygg vinden","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"fronts.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","Fly through a front","Fly gjennom en front","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"storms.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The storm lab","Stormlabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"hazards.html":[["concepts","Key concepts","Nøkkelbegreper","read"],["explore","Hazards lab","Farelab","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"engines.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The engine lab","Motorlabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"jetsystems.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The systems lab","Systemlabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"pressurisation.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The pressurisation lab","Trykkabinlabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"gyros.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The attitude and heading lab","Holdnings- og kurslabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"autoflight.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The automation lab","Automatikklabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"massbalance.html":[["masses","Masses and limits","Masser og grenser","sim"],["cg","Centre of gravity","Tyngdepunkt","sim"],["loadsheet","Load sheet","Lasteark","drill"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"performance.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The runway lab","Rullebanelabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"gennav.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The navigation lab","Navigasjonslabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"radionav.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The navigation simulator","Navigasjonssimulatoren","sim"],["try","Try it","Prøv selv","drill"],["radar","Radar and ADS-B","Radar og ADS-B","sim"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"gnss.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","GNSS and RNP lab","GNSS- og RNP-labben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"holding.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","Hold and approach lab","Holding- og innflygingslab","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"flightplanning.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The climb, cruise and fuel lab","Stigning-, marsj- og drivstofflabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"orientation.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","Feel against reality","Følelse mot virkelighet","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"humanperf.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The human performance lab","Labben for menneskelig ytelse","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]]}/*END*/;
  const LV={la:{en:'Light twin',no:'Småfly'},jet:{en:'A320 model',no:'A320-modell'},mix:{en:'A320 + light twin',no:'A320 + lett tomotors'},gen:{en:'All aircraft',no:'Alle fly'}};
  let curPage=null;
  const done=k=>{ try{ return parseInt(localStorage.getItem('vlab-done-'+k)||'0',10)||0; }catch(e){ return 0; } };
  const LVX={la:{en:'Light twin',no:'Småfly',c:'lt'},jet:{en:'A320 model',no:'A320-modell',c:'a320'},mix:{en:'A320 + light twin',no:'A320 + lett tomotors',c:'a320'},'':{en:'All aircraft',no:'Alle fly',c:'core'}};
  const LVTIP={jet:t2('Principles apply to every aircraft; the numbers come from an illustrative A320 teaching model, not manufacturer data.','Prinsippene gjelder alle fly; tallene kommer fra en illustrerende A320-undervisningsmodell, ikke produsentdata.'),
    mix:t2('Uses an illustrative A320 model and a light twin; the numbers are teaching values, not manufacturer data.','Bruker en illustrerende A320-modell og et lett tomotors fly; tallene er undervisningsverdier, ikke produsentdata.'),
    la:t2('Numbers from an illustrative light twin.','Tall fra et illustrerende lett tomotors fly.'),'':t2('General principles that apply to every aircraft.','Generelle prinsipper som gjelder alle fly.')};
  /* live status chips in the page header get a label (data-label on the chip wins) */
  const STLAB={alt:{en:'Terrain clearance at B',no:'Terrengklaring ved B'},tunnel:{en:'Airflow',no:'Luftstrøm'}};
  const Lx=o=>lang==='en'?o.en:o.no;
  /* Learning goal of each lab that does not carry its own p.goal in the page (one sentence: what you can do afterwards) */
  const GOAL={
   fronts:t2('Recognise a warm front, a cold front and an occlusion from the cloud, precipitation, wind and pressure changes, and predict the icing, turbulence and visibility you will meet when you fly through one.','Kjenne igjen en varmfront, en kaldfront og en okklusjon på skyer, nedbør, vind og trykkendring, og forutsi isingen, turbulensen og sikten du møter når du flyr gjennom en.'),
   storms:t2('Describe the three stages of a thunderstorm and the hazards in each, recognise a microburst on approach and what it does to airspeed and flight path, and use the weather radar to stay clear.','Beskrive de tre stadiene i et tordenvær og farene i hvert av dem, kjenne igjen en microburst under innflyging og hva den gjør med fart og flygebane, og bruke værradaren til å holde avstand.'),
   gnav:t2('Solve the wind triangle for heading and groundspeed, turn it into a magnetic heading, a time and the fuel for the leg, and correct a track error with the 1 in 60 rule.','Løse vindtrekanten for heading og groundspeed, gjøre den om til magnetisk heading, tid og drivstoff for leggen, og rette opp et kursavvik med 1 av 60-regelen.'),
   gnss:t2('Explain how GNSS finds a position and how RAIM and SBAS protect it, tell RNAV from RNP, and choose the right minimum (LNAV, LNAV/VNAV or LPV) for an RNP approach.','Forklare hvordan GNSS finner en posisjon og hvordan RAIM og SBAS beskytter den, skille RNAV fra RNP, og velge riktig minimum (LNAV, LNAV/VNAV eller LPV) for en RNP-innflyging.'),
   hold:t2('Choose the correct holding entry, fly the hold with wind correction and timing, and fly an ILS and a non-precision approach to the minimum, including the missed approach.','Velge riktig inngang til holding, fly holdingen med vindkorreksjon og tidtaking, og fly en ILS og en ikke-presisjonsinnflyging til minimum, inkludert avbrutt innflyging.'),
   air:t2('Explain what the altimeter, the airspeed indicator and the VSI measure, use QNH, QFE and 1013 correctly, correct for pressure and temperature errors, and recognise a blocked pitot tube or static port.','Forklare hva høydemåleren, fartsmåleren og VSI måler, bruke QNH, QFE og 1013 riktig, korrigere for trykk- og temperaturfeil, og kjenne igjen et blokkert pitotrør eller en blokkert statisk port.'),
   gyro:t2('Predict the turning and acceleration errors of the magnetic compass, explain gyro drift and topple, and know what you have left when a vacuum pump, an attitude source or an inertial system fails.','Forutsi sving- og akselerasjonsfeilene til magnetkompasset, forklare gyrodrift og velting, og vite hva du har igjen når en vakuumpumpe, en holdningskilde eller et treghetssystem svikter.'),
   af:t2('Read the mode annunciator and predict what the autopilot and autothrust will do next, recognise the common mode traps, and respond correctly to a TCAS advisory and an EGPWS warning.','Lese modusannunciatoren og forutsi hva autopiloten og autothrust gjør videre, kjenne igjen de vanlige modusfellene, og reagere riktig på et TCAS-råd og en EGPWS-advarsel.'),
   engines:t2('Explain how piston, turboprop and jet engines turn fuel into thrust, read their main gauges, and predict how altitude, temperature and speed change the power you get.','Forklare hvordan stempel-, turboprop- og jetmotorer gjør drivstoff om til skyvekraft, lese hovedinstrumentene deres, og forutsi hvordan høyde, temperatur og fart endrer effekten du får.'),
   jets:t2('Trace how electrics, hydraulics, fuel, flight controls and landing gear are built on a piston twin, a turboprop and a jet, and work out what you lose and what still works after a failure.','Følge hvordan elektrisk, hydraulikk, drivstoff, flykontroller og understell er bygget på et stempeltomotors fly, en turboprop og et jetfly, og finne ut hva du mister og hva som fortsatt virker etter en feil.'),
   press:t2('Explain how the cabin altitude is controlled, what happens in a slow and a rapid decompression, how long you stay useful without oxygen, and when oxygen is required.','Forklare hvordan kabinhøyden styres, hva som skjer ved langsomt og raskt trykkfall, hvor lenge du er handlekraftig uten oksygen, og når oksygen er påkrevd.'),
   perf:t2('Find what limits a take-off and a landing, explain how V1 balances stopping against continuing, and predict how mass, wind, slope, temperature and runway state change the distances.','Finne hva som begrenser en avgang og en landing, forklare hvordan V1 balanserer stopp mot fortsettelse, og forutsi hvordan masse, vind, helning, temperatur og banedekke endrer distansene.'),
   fpl:t2('Pick the speeds for best angle, best rate, best range and best endurance for a propeller aircraft and a jet, correct them for wind, and build the required fuel from taxi to final reserve.','Velge fartene for beste stigevinkel, beste stigehastighet, lengst rekkevidde og lengst utholdenhet for et propellfly og et jetfly, korrigere dem for vind, og bygge opp påkrevd drivstoff fra taksing til endelig reserve.'),
   ori:t2('Explain why the inner ear misleads you in a turn and during acceleration, recognise the leans, the graveyard spiral and the common approach illusions, and know why the instruments are the cure.','Forklare hvorfor det indre øret lurer deg i en sving og under akselerasjon, kjenne igjen leans, dødsspiralen og de vanlige innflygingsillusjonene, og vite hvorfor instrumentene er kuren.'),
   hp:t2('Recognise when workload is about to exceed capacity, estimate how sleep and the body clock affect alertness, and use threat and error management to trap errors before they matter.','Kjenne igjen når arbeidsbelastningen er i ferd med å overstige kapasiteten, anslå hvordan søvn og døgnrytme påvirker årvåkenheten, og bruke trussel- og feilhåndtering til å fange feil før de får betydning.'),
   mb:t2('Build up the masses from dry operating mass to landing mass, find the limit that decides the traffic load, keep the centre of gravity inside the envelope, and complete and correct a load sheet.','Bygge opp massene fra tom operativ masse til landingsmasse, finne grensen som bestemmer nyttelasten, holde tyngdepunktet innenfor konvolutten, og fylle ut og rette et lasteark.')};
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const areaNo=m=>{ const i=AREAS.indexOf(m); return i>=0?i+1:0; };
  const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
  /* a section hidden by the current depth (inside .deep in Short or Instructor) */
  const hidden=e=>depth!=='deep'&&!!(e&&e.closest('.deep'));

  /* ---------- Atlas shell: depth (Short / Deep dive / Instructor) ---------- */
  const DEPTHS=[['short',t2('Short','Kort')],['deep',t2('Deep dive','Dypdykk')],['instructor',t2('Instructor','Instruktør')]];
  /* Three steps: Try is part of Explore, Debrief ("the key points") opens Test yourself; Next is a link at the end, not a step. */
  const STEPS=[['understand',t2('Understand','Forstå')],['explore',t2('Explore','Utforsk')],['check',t2('Test yourself','Test deg selv')]];
  const STEP3={understand:'understand',explore:'explore',try:'explore',debrief:'check',check:'check'};
  let depth='short'; try{ const d=localStorage.getItem('vlab-depth'); if(DEPTHS.some(x=>x[0]===d)) depth=d; }catch(e){}
  function setDepth(d,save){ if(!DEPTHS.some(x=>x[0]===d)) return; depth=d; if(save){ try{ localStorage.setItem('vlab-depth',d); }catch(e){} }
    const b=document.body; if(!b) return; DEPTHS.forEach(([k])=>b.classList.toggle('depth-'+k,k===d));
    document.querySelectorAll('.atl-depth button').forEach(x=>{ x.classList.toggle('on',x.dataset.d===d); x.setAttribute('aria-pressed',String(x.dataset.d===d)); });
    if(save){ document.dispatchEvent(new CustomEvent('labdepth',{detail:d})); window.dispatchEvent(new Event('resize')); } }
  const depthHTML=cls=>`<div class="atl-depth ${cls}" role="group" aria-label="${esc(Lx(t2('Depth','Dybde')))}">${DEPTHS.map(([k,n])=>`<button type="button" data-d="${k}" class="${k===depth?'on':''}" aria-pressed="${k===depth}">${esc(Lx(n))}</button>`).join('')}</div>`;

  /* Sections of this page with their step. Explicit hook wins: any element with data-step="understand|explore|try|debrief|check".
     Otherwise the step comes from the section type in TOP: quiz → check, drill (or #try) → try, sim → explore,
     reading before the first sim → understand, reading after it → debrief. */
  function pageSections(me){
    const byId=id=>{ try{ return document.getElementById(id); }catch(e){ return null; } };
    let list=(TOP[me.f]||[]).map(([id,en,no,ty])=>({id,el:byId(id),n:id==='quiz'?t2('Test yourself','Test deg selv'):t2(en,no),ty}));
    if(!list.length) list=[...document.querySelectorAll('.snav a[href^="#"]')].map(a=>{ const id=a.getAttribute('href').slice(1), x=a.textContent.trim(); return {id,el:byId(id),n:t2(x,x),ty:id==='quiz'?'quiz':'read'}; });
    list=list.filter(s=>s.el);
    const explicit=[...document.querySelectorAll('[data-step]')].filter(e=>e.id&&!e.closest('.atl-bar'));
    let sim=false;
    list.forEach(s=>{ const d=s.el.dataset.step;
      if(d) s.step=d; else if(explicit.length) s.step=null;
      else if(s.ty==='quiz'||s.id==='quiz') s.step='check';
      else if(s.ty==='drill'||s.id==='try') s.step='try';
      else if(s.ty==='sim'){ s.step='explore'; sim=true; }
      else s.step=sim?'debrief':'understand'; });
    const steps=list.filter(s=>s.step&&STEP3[s.step]).map(s=>({step:STEP3[s.step],el:s.el,id:s.id}));
    explicit.forEach(e=>{ if(STEP3[e.dataset.step]&&!steps.some(s=>s.el===e)) steps.push({step:STEP3[e.dataset.step],el:e,id:e.id}); });
    steps.sort((a,b)=>a.el.compareDocumentPosition(b.el)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);
    return {list,steps};
  }

  function header(page){
    curPage=page;
    const me=FLAT.find(x=>x.k===page)||UNLISTED.find(x=>x.k===page);
    const nav=document.querySelector('.labnav');
    if(nav&&me) nav.hidden=true;   /* replaced by the Atlas sidebar */
    else if(nav) legacyNav(nav,page,me);
    pageHeader(page,me);
    if(me) atlas(me); else inPageNav();
    pathbar(page);
    if(me){ practise(me); glossary(me); a11y(); requestAnimationFrame(eyebrows); }
    const hr=document.querySelector('.hright');
    if(hr && !hr.querySelector('.langseg')) hr.insertAdjacentHTML('afterbegin','<div class="seg langseg" aria-label="Språk"><button data-v="en">EN</button><button data-v="no">NO</button></div>');
    document.querySelectorAll('.langseg').forEach(s=>s.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setLang(b.dataset.v); }));
  }
  /* old module dropdown, only for a page with a .labnav that is not one of the labs */
  function legacyNav(nav,page){
    const draw=()=>{ nav.innerHTML=`<a class="lb-home" href="lab.html">Virtual Labs</a>`; };
    draw(); hooks.push(draw);
  }

  /* The Atlas shell: left sidebar (area topics), sticky step bar + depth switch, model hook, limitations link. */
  function atlas(me){
    const pg=document.querySelector('.page'); if(!pg||pg.querySelector('.atl-main')) return;
    const main=document.createElement('div'); main.className='atl-main';
    while(pg.firstChild) main.appendChild(pg.firstChild);
    const side=document.createElement('aside'); side.className='atl-side';
    pg.appendChild(side); pg.appendChild(main); pg.classList.add('atlas');
    setDepth(depth,false);
    const {list,steps}=pageSections(me);
    /* primary model: [data-lab-model] wins, else the first instrument view outside the quiz */
    let model=document.querySelector('[data-lab-model]');
    if(!model) model=[...main.querySelectorAll('.lab-model,.view,.paper,.viewport')].find(e=>!e.closest('#quiz'));
    if(model){ model.classList.add('atl-model'); const sp=model.closest('.split'); if(sp) sp.classList.add('atl-split'); }
    /* model and limitations: the page footnote */
    const foot=main.querySelector('p.foot'); if(foot&&!foot.id) foot.id='limits';
    if(foot) foot.classList.add('atl-limits');
    /* step bar after the page header */
    const bar=document.createElement('nav'); bar.className='atl-bar'; bar.setAttribute('aria-label','Steps');
    const hd=main.querySelector('header.lhead'); if(hd) hd.after(bar); else main.insertBefore(bar,main.firstChild);
    let open=false;
    const drawSide=()=>{
      const area=me.m, n=areaNo(area);
      const secs=`<ul class="atl-secs">${list.filter(s=>!hidden(s.el)).map(s=>`<li><a href="#${esc(s.id)}" data-sec="${esc(s.id)}">${esc(Lx(s.n))}</a></li>`).join('')}</ul>`;
      side.setAttribute('aria-label',Lx(t2('Topics in this area','Emner i dette området')));
      side.innerHTML=`<a class="atl-all" href="lab.html"><span aria-hidden="true">←</span> ${esc(Lx(t2('All areas','Alle områder')))}</a>`+
        `<button type="button" class="atl-tog" aria-expanded="${open}"><span class="a">${esc(Lx(area))}</span><span class="t">${esc(Lx(me))}</span><span class="car" aria-hidden="true"></span></button>`+
        `<div class="atl-panel"><div class="atl-area"><span class="no">${area.more?esc(Lx(t2('More','Mer'))):`${esc(Lx(t2('Area','Område')))} ${String(n).padStart(2,'0')} / ${String(AREAS.length).padStart(2,'0')}`}</span>`+
        `<b><a href="lab.html${me.unlisted?'':'#'+area.k}">${esc(Lx(area))}</a></b></div>`+
        `<ol class="atl-topics">${area.labs.map((l,i)=>{ const on=l[1]===me.k; return `<li class="${on?'on':''}"><a href="${l[0]}"${on?' aria-current="page"':''}><i>${i+1}</i><span>${esc(lang==='en'?l[2]:l[3])}</span></a>${on?secs:''}</li>`; }).join('')}</ol>`+
        `<div class="atl-other"><span class="h">${esc(Lx(t2('Other areas','Andre områder')))}</span>${AREAS.filter(a=>a!==area).map(a=>`<a href="${a.labs[0][0]}"><i>${String(areaNo(a)).padStart(2,'0')}</i>${esc(Lx(a))}</a>`).join('')}</div></div>`;
      side.classList.toggle('open',open); spySoon(); };
    const drawBar=()=>{
      bar.setAttribute('aria-label',Lx(t2('Steps in this lab','Steg i denne labben')));
      bar.innerHTML=`<div class="atl-steps">${STEPS.map(([k,n],i)=>{ const tg=k==='check'?(steps.find(s=>s.id==='quiz')||steps.find(s=>s.step===k)):steps.find(s=>s.step===k); /* Test yourself goes to the quiz, like the sidebar */
        return tg?`<a href="#${esc(tg.id)}" data-step-link="${k}"><i>${i+1}</i>${esc(Lx(n))}</a>`:`<span class="off" data-step-link="${k}" aria-disabled="true" title="${esc(Lx(t2('Not yet in this lab','Ikke i denne labben ennå')))}"><i>${i+1}</i>${esc(Lx(n))}</span>`; }).join('')}</div>${depthHTML('d-bar')}`;
      spySoon(); };
    side.addEventListener('click',e=>{ if(e.target.closest('.atl-tog')){ open=!open; side.classList.toggle('open',open); side.querySelector('.atl-tog').setAttribute('aria-expanded',String(open)); return; }
      const a=e.target.closest('a[data-sec]'); if(a){ open=false; side.classList.remove('open'); const b=side.querySelector('.atl-tog'); if(b) b.setAttribute('aria-expanded','false'); } });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&open){ open=false; side.classList.remove('open'); } });
    document.addEventListener('click',e=>{ const b=e.target.closest('.atl-depth button'); if(b) setDepth(b.dataset.d,true); });
    /* scroll spy: current section (sidebar) and current step (bar) */
    const nextEl=()=>document.getElementById('next');
    document.addEventListener('labdepth',()=>drawSide());
    function spy(){
      const y=(bar.getBoundingClientRect().bottom||0)+90; let cur=null, st=null;
      list.forEach(s=>{ if(!hidden(s.el)&&s.el.getBoundingClientRect().top<y) cur=s; });
      steps.forEach(s=>{ if(!hidden(s.el)&&s.el.getBoundingClientRect().top<y) st=s.step; });
      const nx=nextEl(); if(nx&&(nx.getBoundingClientRect().top<y||innerHeight+scrollY>=document.documentElement.scrollHeight-4)) st=st||'check';
      side.querySelectorAll('a[data-sec]').forEach(a=>{ const on=!!cur&&a.dataset.sec===cur.id; a.classList.toggle('on',on); if(on) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); });
      bar.querySelectorAll('[data-step-link]').forEach(a=>{ const on=a.dataset.stepLink===st; a.classList.toggle('on',on); if(a.tagName==='A'){ if(on) a.setAttribute('aria-current','step'); else a.removeAttribute('aria-current'); } });
      const on=bar.querySelector('.atl-steps .on'), sc=bar.querySelector('.atl-steps');
      if(on&&sc&&sc.scrollWidth>sc.clientWidth){ const l=on.offsetLeft-sc.offsetLeft, r=l+on.offsetWidth; if(l<sc.scrollLeft||r>sc.scrollLeft+sc.clientWidth) sc.scrollLeft=Math.max(0,l-24); }
    }
    /* the spy reads positions, which lays the whole page out: once per frame, never in the middle of a script that is still building the page */
    let raf=0; const spySoon=()=>{ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; spy(); }); }; addEventListener('scroll',spySoon,{passive:true});
    drawSide(); drawBar(); hooks.push(drawSide,drawBar);
    /* smooth anchor jumps inside the shell */
    pg.addEventListener('click',e=>{ const a=e.target.closest('.atl-bar a[href^="#"],.atl-side a[href^="#"],.lmeta a[href^="#"]'); if(!a) return; const t=document.getElementById(a.getAttribute('href').slice(1)); if(!t) return; e.preventDefault(); t.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'}); history.replaceState(null,'','#'+t.id); });
  }

  /* PageHeader: eyebrow "Virtual Labs · Area N · <area>", H1, lead, meta row (applies to, model and limitations, depth, live status) */
  function pageHeader(page,me){
    const hd=document.querySelector('.page header.lhead')||document.querySelector('header.lhead'); if(!hd||!me) return;
    const brand=hd.querySelector('.brand')||hd;
    let eb=brand.querySelector('.eyebrow'); if(!eb){ eb=document.createElement('div'); eb.className='eyebrow'; brand.insertBefore(eb,brand.firstChild); }
    eb.classList.add('vl-eb');
    let meta=brand.querySelector('.lmeta'); if(!meta){ meta=document.createElement('div'); meta.className='lmeta'; brand.appendChild(meta); }
    /* learning goal: the page's own p.goal, else one built from GOAL; always right after the purpose paragraph */
    let goal=brand.querySelector('.goal'), goalOwn=!!goal;
    if(!goal&&GOAL[page]){ goal=document.createElement('p'); goal.className='goal'; goal.id='goal'; }
    if(goal&&goal.nextElementSibling!==meta) brand.insertBefore(goal,meta);
    const st=hd.querySelector('.hright .status');
    let stw=null; if(st){ stw=document.createElement('span'); stw.className='mi mst'; stw.innerHTML='<span class="k"></span>'; stw.appendChild(st); }
    const draw=()=>{ const lv=LVX[me.lv]||LVX[''], n=areaNo(me.m), foot=document.querySelector('.page p.foot');
      eb.innerHTML=`<a href="lab.html">Virtual Labs</a> · ${me.m.more?esc(Lx(t2('More','Mer'))):`${esc(Lx(t2('Area','Område')))} ${n}`} · <a href="lab.html${me.unlisted?'':'#'+me.m.k}">${esc(Lx(me.m))}</a>`;
      if(goal&&!goalOwn) goal.innerHTML=`<span class="k">${esc(Lx(t2('Learning goal','Læringsmål')))}</span>${esc(Lx(GOAL[page]))}`;
      const keep=meta.querySelector('.mst');
      meta.innerHTML=`<span class="mi"><span class="k">${esc(Lx(t2('Applies to','Gjelder')))}</span><span class="tag ${lv.c}" title="${esc(Lx(LVTIP[me.lv]||LVTIP['']))}">${esc(Lx(lv))}</span></span>`+
        (foot?`<span class="mi"><a class="atl-lim" href="#${foot.id||'limits'}">${esc(Lx(t2('Model and limitations','Modell og begrensninger')))} <span aria-hidden="true">↓</span></a></span>`:'')+
        depthHTML('d-meta');
      const w=keep||stw; if(w){ const lab=st&&st.dataset.label?{en:st.dataset.label,no:st.dataset.labelNo||st.dataset.label}:(STLAB[page]||{en:'Simulator',no:'Simulator'}); w.querySelector('.k').textContent=Lx(lab)+':'; meta.appendChild(w); } };
    draw(); hooks.push(draw); document.addEventListener('nprog',draw);
  }
  /* InPageNav (pages outside the Atlas shell): active section + compact "On this page" select on narrow screens */
  function inPageNav(){
    const sn=document.querySelector('.snav'); if(!sn||sn.dataset.ipn) return; sn.dataset.ipn='1';
    const links=[...sn.querySelectorAll('a[href^="#"]')]; if(!links.length) return;
    const wrap=document.createElement('label'); wrap.className='snsel'; wrap.innerHTML='<span></span><select></select>'; sn.appendChild(wrap); sn.classList.add('hassel');
    const sel=wrap.querySelector('select');
    const fill=()=>{ wrap.querySelector('span').textContent=lang==='en'?'On this page':'På denne siden'; const v=sel.value; sel.innerHTML=links.map(a=>`<option value="${a.getAttribute('href')}">${a.textContent.trim()}</option>`).join(''); if(v) sel.value=v; };
    fill(); hooks.push(()=>setTimeout(fill,0));
    sel.addEventListener('change',()=>{ const t=document.querySelector(sel.value); if(t) t.scrollIntoView({behavior:reduced()?'auto':'smooth'}); history.replaceState(null,'',sel.value); });
    const secs=links.map(a=>{ try{ return document.querySelector(a.getAttribute('href')); }catch(e){ return null; } });
    const mark=()=>{ const y=sn.getBoundingClientRect().bottom+80; let k=-1; secs.forEach((s,i)=>{ if(s&&s.getBoundingClientRect().top<y) k=i; });
      links.forEach((a,i)=>a.classList.toggle('on',i===k)); if(k>=0&&sel.selectedIndex!==k) sel.selectedIndex=k; };
    let raf=0; const markSoon=()=>{ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; mark(); }); }; addEventListener('scroll',markSoon,{passive:true}); markSoon();
  }
  /* "Practise it": fly what the lab explains. Lab key → [link, where, title, one line]. Only exercises that exist:
     IFR trainer items open with ifr.html?ex=<id>; the simulators take s=<scenario> or s=air&p=<procedure> (airproc.js; af=1 engages auto-fly).
     DA42 (cockpit.html): ils loc rnp_lpv rnp_lv rnp_ln sid star hold; C172: ils loc ndb sid star hold; B200: ils loc ndb rnp_ln sid star hold. */
  const PW={ifr:t2('IFR trainer','IFR-trener'),da42:t2('DA42 simulator','DA42-simulator'),c172:t2('C172 simulator','C172-simulator'),b200:t2('B200 simulator','B200-simulator')};
  const P_=(u,w,en,no,sen,sno)=>({u,w,n:t2(en,no),s:t2(sen,sno)});
  const PRAC={
   radionav:[P_('ifr.html?ex=ndb','ifr','Track to a beacon (NDB)','Følg en kurs inn til et fyr (NDB)','Heading + needle, then correct for the wind.','Heading + nål, og korriger så for vinden.'),
     P_('ifr.html?ex=dme','ifr','Fly a DME arc','Fly en DME-bue','Hold a fixed distance round the station.','Hold fast avstand rundt stasjonen.'),
     P_('c172.html?s=air&p=ndb','c172','NDB approach','NDB-innflyging','Fly the NDB 36 approach on the ADF.','Fly NDB 36-innflygingen på ADF-en.')],
   hold:[P_('ifr.html?ex=holdEntry','ifr','Holding entry','Inngang til holding','Pick direct, parallel or teardrop and fly it.','Velg direkte, parallell eller teardrop og fly den.'),
     P_('cockpit.html?s=air&p=hold','da42','Hold at RONAX','Holding ved RONAX','A full hold in the DA42, by hand or on autopilot.','En hel holding i DA42, for hånd eller på autopilot.'),
     P_('ifr.html?ex=ils','ifr','ILS approach','ILS-innflyging','Localiser, glide slope, DA and the missed approach.','Localiser, glidebane, DA og avbrutt innflyging.')],
   gnss:[P_('cockpit.html?s=air&p=rnp_lpv','da42','RNP approach (LPV)','RNP-innflyging (LPV)','Fly RNP 36 to the LPV minimum in the DA42.','Fly RNP 36 til LPV-minimum i DA42.'),
     P_('ifr.html?ex=lpv','ifr','RNP approach (LPV)','RNP-innflyging (LPV)','Angular needles that tighten towards the runway.','Vinkelnåler som strammes inn mot rullebanen.'),
     P_('ifr.html?ex=star','ifr','Arrival (STAR)','Innflygingsrute (STAR)','Waypoint to waypoint, each at its altitude.','Waypoint til waypoint, hver i riktig høyde.')],
   af:[P_('b200.html?s=air&p=ils&af=1','b200','ILS 36 on auto-fly','ILS 36 med autofly','Watch the modes arm and capture, then take over.','Se modusene armeres og fange, og ta så over.'),
     P_('cockpit.html?s=air&p=rnp_lv&af=1','da42','LNAV/VNAV on auto-fly','LNAV/VNAV med autofly','A baro-VNAV path flown by the automation.','En baro-VNAV-bane fløyet av automatikken.')],
   gyro:[P_('c172.html?s=vac','c172','Vacuum failure','Vakuumsvikt','The attitude and heading gyros run down: partial panel.','Holdnings- og kursgyroen spinner ned: delvis panel.'),
     P_('ifr.html?ex=ppTrack','ifr','Partial panel: track to the station','Delvis panel: følg en kurs inn','Compass and clock, no heading indicator.','Kompass og klokke, uten kursgyro.')],
   gnav:[P_('ifr.html?ex=mathNav','ifr','Mental maths: navigation','Hoderegning: navigasjon','1 in 60, wind correction and lead.','1 av 60, vindkorreksjon og forsprang.'),
     P_('ifr.html?ex=trackIn','ifr','Track to the station','Følg en kurs inn til stasjonen','The wind triangle, flown on a VOR needle.','Vindtrekanten, fløyet på en VOR-nål.')],
   fpl:[P_('ifr.html?ex=mathApp','ifr','Mental maths: descents','Hoderegning: nedstigning','Top of descent and rate of descent.','Toppen av nedstigningen og sinkrate.')],
   prop:[P_('cockpit.html?s=efato','da42','Engine failure after take-off','Motorstans etter avgang','Identify, verify, feather, and keep it straight.','Identifiser, verifiser, fjær, og hold retningen.'),
     P_('b200.html?s=efato','b200','Engine failure at rotation','Motorstans ved rotasjon','Autofeather, rudder and V2 in a turboprop twin.','Autofjæring, sideror og V2 i et turboprop-tomotors fly.')],
   perf:[P_('cockpit.html?s=takeoff','da42','Take-off','Avgang','Rotate, climb and clean up at the right speeds.','Roter, stig og rydd opp ved riktige farter.'),
     P_('b200.html?s=efato','b200','Engine failure at rotation','Motorstans ved rotasjon','Continue the take-off and hold V2.','Fortsett starten og hold V2.')],
   engines:[P_('c172.html?s=carbice','c172','Carburettor icing in cruise','Forgasserising i marsj','Spot the RPM drop and use carb heat.','Se turtallsfallet og bruk forgasservarme.'),
     P_('b200.html?s=start','b200','Engine start','Motorstart','A turboprop start: N1, ITT and fuel flow.','En turbopropstart: N1, ITT og drivstoffstrøm.')],
   jets:[P_('c172.html?s=alt','c172','Alternator failure','Generatorsvikt','Read the ammeter and shed the electrical load.','Les amperemeteret og kutt strømforbruket.')],
   press:[P_('b200.html?s=press','b200','Pressurisation loss','Tap av kabintrykk','Masks on, then the emergency descent.','Masker på, og så nøddnedstigning.')],
   hazards:[P_('c172.html?s=carbice','c172','Carburettor icing in cruise','Forgasserising i marsj','Icing you cannot see from the window.','Ising du ikke ser fra vinduet.')],
   tunnel:[P_('cockpit.html?s=stall','da42','Stall','Stall','Feel the buffet, then recover.','Kjenn buffeten, og ta deg ut.')],
   stab:[P_('cockpit.html?s=steep','da42','Steep turns','Krappe svinger','45° of bank: load factor and back pressure.','45° krengning: lastfaktor og baktrykk.')],
   forces:[P_('cockpit.html?s=steep','da42','Steep turns','Krappe svinger','More bank, more lift needed, higher stall speed.','Mer krengning, mer løft, høyere stallfart.')]};
  function practise(me){
    const list=PRAC[me.k]; if(!list||!list.length) return;
    const main=document.querySelector('.atl-main')||document.querySelector('.page'); if(!main||main.querySelector('.vlprac')) return;
    const box=document.createElement('aside'); box.className='vlprac'; box.id='practise';
    const foot=main.querySelector(':scope > p.foot'), nx=main.querySelector(':scope > .vlpath');
    if(foot) main.insertBefore(box,foot); else if(nx) main.insertBefore(box,nx); else main.appendChild(box);
    const draw=()=>{ box.setAttribute('aria-label',Lx(t2('Practise it','Øv på det')));
      box.innerHTML=`<div class="ph"><span>${esc(Lx(t2('Practise it','Øv på det')))}</span><span>${esc(Lx(t2('Fly what this lab explains.','Fly det denne labben forklarer.')))}</span></div>`+
        `<ul class="pl">${list.map(x=>`<li><a href="${esc(x.u)}"><small>${esc(Lx(PW[x.w]))}</small><b>${esc(Lx(x.n))}</b><span>${esc(Lx(x.s))}</span></a></li>`).join('')}</ul>`; };
    draw(); hooks.push(draw);
  }
  /* shared glossary in the lab text: the reading sections opt in (class "gloss"); glossary.js is loaded on demand */
  function glossary(me){
    (TOP[me.f]||[]).forEach(([id,,,ty])=>{ if(ty!=='read') return; const e=document.getElementById(id); if(e) e.classList.add('gloss'); });
    if(!document.querySelector('.gloss')) return;
    const go=()=>{ if(window.GLOSS) window.GLOSS.auto('.gloss'); };
    if(window.GLOSS){ setTimeout(go,0); return; }
    const sc=document.createElement('script'); sc.src='glossary.js?v=2'; sc.async=true; sc.onload=go; document.head.appendChild(sc);
  }
  /* "Next" at the end of every lab (the step bar's last step): next topic in the area, then the next area */
  function pathbar(page){
    const i=FLAT.findIndex(x=>x.k===page);
    if(i<0){ /* an unlisted lab ends with the way back to Virtual Labs */
      if(!UNLISTED.some(x=>x.k===page)) return; const pg=document.querySelector('.atl-main')||document.querySelector('.page'); if(!pg||document.querySelector('.vlpath')) return;
      const box=document.createElement('nav'); box.className='vlpath'; box.id='next'; pg.appendChild(box);
      const draw=()=>{ box.setAttribute('aria-label',Lx(t2('Next','Gå videre'))); box.innerHTML=`<div class="ph"><span>${esc(Lx(t2('Next','Gå videre')))}</span><span></span></div><div class="pr"><a class="x" aria-hidden="true" tabindex="-1"></a><a class="nx" href="lab.html"><small>${esc(Lx(t2('All areas','Alle områder')))} →</small><b>Virtual Labs</b></a></div>`; };
      draw(); hooks.push(draw); return; }
    const pg=document.querySelector('.atl-main')||document.querySelector('.page'); if(!pg) return;
    let box=document.querySelector('.vlpath'); if(!box){ box=document.createElement('nav'); box.className='vlpath'; box.id='next'; pg.appendChild(box); }
    const draw=()=>{ const c=FLAT[i], nm=x=>lang==='en'?x.en:x.no;
      const inA=FLAT.filter(x=>x.m===c.m), p=inA[c.li-1]||null;
      let n=inA[c.li+1]||null, nArea=null;
      if(!n&&!c.m.more){ const a=AREAS[areaNo(c.m)]; if(a){ nArea=a; n=FLAT.find(x=>x.m===a); } }
      box.setAttribute('aria-label',Lx(t2('Next','Gå videre')));
      box.innerHTML=`<div class="ph"><span>${esc(Lx(t2('Next','Gå videre')))}</span><span>${c.m.more?esc(Lx(t2('More','Mer'))):`${esc(Lx(t2('Area','Område')))} ${areaNo(c.m)}`} · ${esc(Lx(c.m))} · ${esc(Lx(t2('topic','emne')))} ${c.li+1} ${T('av')} ${inA.length}</span></div>`+
        `<div class="pr">${p?`<a href="${p.f}"><small>← ${esc(Lx(t2('Previous in this area','Forrige i området')))}</small><b>${esc(nm(p))}</b></a>`:'<a class="x" aria-hidden="true" tabindex="-1"></a>'}`+
        (n?`<a class="nx" href="${n.f}"><small>${nArea?esc(Lx(t2('Next area','Neste område')))+': '+esc(Lx(nArea)):esc(Lx(t2('Next in this area','Neste i området')))} →</small><b>${esc(nm(n))}</b></a>`:`<a class="nx" href="lab.html"><small>${esc(Lx(t2('All areas','Alle områder')))} →</small><b>Virtual Labs</b></a>`)+`</div>`; };
    draw(); hooks.push(draw);
  }
  /* Section eyebrows: "1 · Understand", "2 · Explore", "3 · Test yourself" from data-step, the same wording on every lab.
     Anything after the second "·" in the page's own eyebrow (for example "· A320 model") is kept. */
  const EBN={understand:0,explore:1,try:1,debrief:2,check:2};
  function eyebrows(){
    document.querySelectorAll('.atl-main section[data-step]>.eyebrow').forEach(e=>{ const k=EBN[e.parentElement.dataset.step]; if(k===undefined) return;
      const n=e.firstChild; if(!n||n.nodeType!==3||e.childNodes.length!==1) return;
      const parts=n.nodeValue.trim().split(' · '), want=[String(k+1),Lx(STEPS[k][1])].concat(parts.slice(2)).join(' · ');
      if(n.nodeValue!==want) n.nodeValue=want; });
  }
  /* Accessibility the shell adds to every lab, so the pages do not each do it their own way:
     canvases with a text alternative are images; view tabs are real tabs (roles, aria-selected, Left/Right/Home/End);
     pressed state on toggle buttons follows the "on" class. */
  function a11y(){
    const root=document.querySelector('.atl-main')||document.querySelector('.page'); if(!root) return;
    let cid=0;
    const canv=()=>{ root.querySelectorAll('canvas[aria-label]:not([role])').forEach(c=>c.setAttribute('role',c.hasAttribute('tabindex')?'application':'img'));
      /* a chart canvas with no label of its own is named by the heading of its card; colour bars are decoration (their ticks are text) */
      root.querySelectorAll('canvas:not([aria-label]):not([aria-labelledby]):not([aria-hidden])').forEach(c=>{
        if(c.closest('.cbar,.cbw')||c.classList.contains('wbar')){ c.setAttribute('aria-hidden','true'); return; }
        const box=c.closest('.chart,.stc,.xcard,figure'), h=box&&box.querySelector('h3,h4,figcaption'); if(!h) return;
        if(!h.id) h.id='cvh'+(++cid); c.setAttribute('role','img'); c.setAttribute('aria-labelledby',h.id); }); };
    const tabs=tl=>{ const bs=[...tl.querySelectorAll('button')]; const has=bs.some(b=>b.classList.contains('on'));
      bs.forEach(b=>{ const on=b.classList.contains('on'); if(b.getAttribute('role')!=='tab') b.setAttribute('role','tab');
        if(b.getAttribute('aria-selected')!==String(on)) b.setAttribute('aria-selected',String(on));
        const ti=(on||(!has&&b===bs[0]))?'0':'-1'; if(b.getAttribute('tabindex')!==ti) b.setAttribute('tabindex',ti); }); };
    const pressed=b=>{ const on=b.classList.contains('on'); if(b.getAttribute('aria-pressed')!==String(on)) b.setAttribute('aria-pressed',String(on)); };
    const sweep=()=>{ canv(); root.querySelectorAll('.vtabs[role=tablist]').forEach(tabs); root.querySelectorAll('.xtog,.vtools button.tg').forEach(pressed); };
    sweep(); setTimeout(sweep,1200);
    /* only the tab lists and the control panels are watched (not the model, which may redraw every frame) */
    let q=0; const mo=new MutationObserver(()=>{ if(!q) q=requestAnimationFrame(()=>{ q=0; sweep(); }); });
    root.querySelectorAll('.vbar,.xpanel').forEach(n=>mo.observe(n,{subtree:true,childList:true,attributes:true,attributeFilter:['class']}));
    root.addEventListener('keydown',e=>{ const b=e.target.closest&&e.target.closest('.vtabs[role=tablist] button'); if(!b) return;
      const k=e.key; if(k!=='ArrowLeft'&&k!=='ArrowRight'&&k!=='Home'&&k!=='End') return;
      const bs=[...b.parentElement.querySelectorAll('button')].filter(x=>!x.hidden&&!x.disabled&&x.getClientRects().length); const i=bs.indexOf(b); if(i<0) return;
      const j=k==='Home'?0:k==='End'?bs.length-1:(i+(k==='ArrowRight'?1:-1)+bs.length)%bs.length; e.preventDefault();
      const id=bs[j].id, dv=bs[j].dataset.v, dm=bs[j].dataset.m, tl=b.parentElement, ix=[...tl.querySelectorAll('button')].indexOf(bs[j]); bs[j].click();
      /* the lab may redraw the tab list on click: focus the same tab in the new list */
      requestAnimationFrame(()=>{ const nb=[...tl.querySelectorAll('button')]; const t=(id&&document.getElementById(id))||nb.find(x=>x.classList.contains('on'))||nb[ix]; if(t) t.focus(); }); });
  }
  /* Reset: one button, same place on every lab (right end of the viewport bar). fn puts the model back to its starting values
     and leaves the view, depth and language alone. vp = the viewport element or its id (default: the primary model). */
  const live=()=>{ let r=document.getElementById('labLive'); if(!r){ r=document.createElement('div'); r.id='labLive'; r.style.cssText='position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap'; r.setAttribute('role','status'); r.setAttribute('aria-live','polite'); document.body.appendChild(r); } return r; };
  function reset(fn,vp){
    let v=typeof vp==='string'?el(vp):vp; if(!v) v=document.querySelector('[data-lab-model]')||document.querySelector('.xvp'); if(!v) return null;
    let tools=v.matches('.vtools,.ov-tr')?v:null;   /* a tool row given directly (the wind tunnel's own viewport bar) */
    if(!tools){ const bar=v.matches('.vbar')?v:v.querySelector('.vbar'); if(!bar) return null;
      tools=bar.querySelector(':scope>.vtools'); if(!tools){ tools=document.createElement('div'); tools.className='vtools'; bar.appendChild(tools); } }
    let b=tools.querySelector('.xreset'); if(!b){ b=document.createElement('button'); b.type='button'; b.className='xreset'+(tools.querySelector('.camb')?' camb':''); tools.appendChild(b); }
    const draw=()=>{ if(b.parentElement!==tools||b!==tools.lastElementChild) tools.appendChild(b); b.textContent=Lx(t2('Reset','Nullstill')); b.title=Lx(t2('Back to the starting values','Tilbake til startverdiene')); b.setAttribute('aria-label',Lx(t2('Reset the model to its starting values','Nullstill modellen til startverdiene'))); };
    draw(); hooks.push(draw);
    /* labs that redraw their tool row keep the button: it is put back at the end */
    new MutationObserver(()=>{ if(b.parentElement!==tools||b!==tools.lastElementChild) tools.appendChild(b); }).observe(tools,{childList:true});
    b.addEventListener('click',()=>{ fn(); const r=live(); r.textContent=''; setTimeout(()=>{ r.textContent=Lx(t2('The model is back at its starting values.','Modellen er tilbake på startverdiene.')); },60); });
    return b;
  }
  /* snapshot of a plain state object; the returned function restores it (keys in keepKeys stay as they are now) */
  function keep(S){ const s0=JSON.stringify(S); return keepKeys=>{ const o=JSON.parse(s0); (keepKeys||[]).forEach(k=>{ if(k in S) o[k]=S[k]; }); Object.keys(S).forEach(k=>{ if(!(k in o)&&typeof S[k]!=='function') delete S[k]; }); Object.assign(S,o); return S; }; }
  // glidebryter
  function slider(box,o){
    const w=document.createElement('div'); w.className='ctl';
    const id=o.id||('s'+Math.random().toString(36).slice(2));
    w.innerHTML=`<label for="${id}"><span></span><output></output></label><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step}">`+(o.hint?'<div class="hint"></div>':'');
    box.appendChild(w);
    const inp=w.querySelector('input'), sp=w.querySelector('span'), out=w.querySelector('output'), h=w.querySelector('.hint');
    const api={ get v(){ return parseFloat(inp.value); }, set(v){ inp.value=v; render(); }, el:w, inp };
    function render(){ sp.textContent=T(o.label); const vt=o.f(parseFloat(inp.value)); out.textContent=vt; inp.setAttribute('aria-valuetext',String(vt)); if(h) h.textContent=T(o.hint); }
    inp.value=o.v; render();
    inp.addEventListener('input',()=>{ render(); o.on&&o.on(parseFloat(inp.value)); });
    hooks.push(render);
    return api;
  }
  // segmentvalg
  function seg(box,items,v,on){
    box.classList.add('seg');
    const draw=()=>{ box.innerHTML=items.map(([k,t])=>`<button type="button" data-v="${k}" class="${String(k)===String(api.v)?'on':''}"${box.getAttribute('role')==='tablist'?'':` aria-pressed="${String(k)===String(api.v)}"`}>${T(t)}</button>`).join(''); };
    const api={v, set(x){ api.v=x; draw(); }};
    box.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; api.v=b.dataset.v; draw(); on&&on(api.v); });
    draw(); hooks.push(draw); return api;
  }
  // lerret som følger størrelsen
  function fit(cv,draw,maxDpr){
    const st={w:0,h:0,dpr:1,ctx:cv.getContext('2d')};
    const rs=()=>{ if(!cv.clientWidth) return; st.dpr=Math.min(window.devicePixelRatio||1,maxDpr||2); st.w=cv.clientWidth; st.h=cv.clientHeight; cv.width=st.w*st.dpr; cv.height=st.h*st.dpr; st.ctx.setTransform(st.dpr,0,0,st.dpr,0,0); draw&&draw(); };
    new ResizeObserver(rs).observe(cv); return st;
  }
  function visible(elm,cb){ new IntersectionObserver(es=>cb(es[0].isIntersecting)).observe(elm); }

  // quiz
  function quiz(box,key,make,count){
    let qs=[], i=0, score=0, answered=false, picked=-1;
    const best=()=>{ try{ return parseInt(localStorage.getItem('aeroson-quiz-'+key)||'0',10); }catch(e){ return 0; } };
    function start(){ qs=make(); if(count) qs=qs.slice(0,count); qs=qs.map(q=>{ if(!q||!Array.isArray(q.a)) return q; const ix=shuffle(q.a.map((_,k)=>k)); return Object.assign({},q,{a:ix.map(k=>q.a[k]),c:ix.indexOf(q.c)}); }); i=0; score=0; answered=false; picked=-1; draw(); }
    function draw(){
      if(i>=qs.length){
        const pct=Math.round(score/qs.length*100); let b=best(); if(window.NPROG) NPROG.award('quiz:'+key,pct); if(curPage){ try{ if(pct>done(curPage)) localStorage.setItem('vlab-done-'+curPage,String(pct)); }catch(e){} } if(pct>b){ b=pct; try{ localStorage.setItem('aeroson-quiz-'+key,String(pct)); }catch(e){} }
        const msg= pct>=90? 'Sterkt! Du har god kontroll på dette.' : pct>=60? 'Godt jobbet. Les forklaringene på det du bommet på.' : 'Gå gjennom stoffet over og prøv igjen.';
        box.innerHTML=`<div class="qend"><span class="qtop">${T('Ditt resultat')}</span><span class="big">${score} / ${qs.length}</span><p class="note">${T(msg)}</p>${(()=>{ const i=FLAT.findIndex(x=>x.k===curPage), n=i>=0?FLAT[i+1]:null; return n?`<div class="btns"><a class="btn pri" href="${n.f}">${T('Neste')}: ${lang==='en'?n.en:n.no} →</a><button class="btn">${T('Prøv igjen')}</button></div>`:(i>=0?`<div class="btns"><a class="btn pri" href="lab.html">${T('Ferdig')}: ${T('Alle labber')} →</a><button class="btn">${T('Prøv igjen')}</button></div>`:`<button class="btn pri">${T('Prøv igjen')}</button>`); })()}</div>`;
        box.querySelector('button').onclick=start; return;
      }
      const q=qs[i];
      box.innerHTML=`<div class="quiz"><div class="qtop"><span>${T('Spørsmål')} ${i+1} ${T('av')} ${qs.length}</span><span>${score} ${T('riktige')}</span></div>
        <div class="qbar"><i style="width:${i/qs.length*100}%"></i></div>
        ${q.draw?'<div class="qfig"></div>':''}
        <p class="qq">${L(q.q)}</p>
        <div class="qopts">${q.a.map((a,k)=>`<button data-k="${k}" ${answered?'disabled':''} class="${answered? (k===q.c?'right':(k===picked?'wrong':'')) : ''}">${L(a)}</button>`).join('')}</div>
        ${answered?`<div class="qexp"><b class="${picked===q.c?'ok':'no'}">${T(picked===q.c?'Riktig':'Feil')}.</b> ${L(q.e)}</div><div><button class="btn pri qn">${T(i===qs.length-1?'Se resultat':'Neste')}</button></div>`:''}</div>`;
      if(q.draw) q.draw(box.querySelector('.qfig'));
      box.querySelectorAll('.qopts button').forEach(b=>b.onclick=()=>{ if(answered) return; picked=+b.dataset.k; answered=true; if(picked===q.c) score++; draw(); });
      const n=box.querySelector('.qn'); if(n) n.onclick=()=>{ i++; answered=false; picked=-1; draw(); };
    }
    hooks.push(()=>draw());
    start();
  }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  /* Explore app (lab.css .xapp): the control panel is always open on desktop; on phones it is a "Controls" sheet
     under the viewport that starts closed and opens when a Try-it task sends you to the model. */
  (function xpanels(){
    const mq=matchMedia('(max-width:900px)'), ps=()=>document.querySelectorAll('details.xpanel');
    const sync=first=>ps().forEach(d=>{ if(!mq.matches) d.open=true; else if(first) d.open=false; });
    sync(true); if(mq.addEventListener) mq.addEventListener('change',()=>sync(false));
    document.addEventListener('click',e=>{ if(e.target.closest('.tasks [data-go]')) ps().forEach(d=>{ d.open=true; }); });
  })();

  window.LAB={ PATH, AREAS, MORE, FLAT, TOP, PRAC, LV, LVX, LVTIP, done, get depth(){ return depth; }, setDepth:d=>setDepth(d,true), T, L, nf, el, add(dict,no){ Object.assign(D,dict); if(no) Object.assign(NO,no); }, start(page){ header(page); scan(); apply(); }, head(page){ header(page); const n=document.querySelector('.labnav'); if(n) scan(n); apply(); },
    onLang(f){ hooks.push(f); }, tx(dict){ Object.assign(TXD,dict); txApply(); }, get lang(){ return lang; }, slider, seg, fit, visible, quiz, shuffle, reset, keep, GOAL };
})();
