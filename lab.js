/* Birdbird Virtual Lab – felles: språk, navigasjon, kontroller, quiz.
   Kildetekst i HTML og kode er norsk; engelsk er standard i grensesnittet. */
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
  const NO={};
  let lang='en'; try{ const l=localStorage.getItem('vlab-lang'); if(l==='no'||l==='en') lang=l; }catch(e){}
  const hooks=[];
  const T=s=> lang==='en' ? (D[s]!==undefined? D[s] : s) : (NO[s]!==undefined? NO[s] : s);
  const L=o=> (o && typeof o==='object' && 'en' in o) ? (lang==='en'? o.en : o.no) : T(o);
  const nf=(v,d)=> Number.isFinite(v)? v.toLocaleString(lang==='en'?'en-GB':'nb-NO',{minimumFractionDigits:d,maximumFractionDigits:d}) : '–';
  const el=id=>document.getElementById(id);

  // statisk tekst
  const nodes=[];
  function scan(root){
    const w=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT); let n;
    while((n=w.nextNode())){ const t=n.nodeValue.trim(); if(t && (D[t]!==undefined||NO[t]!==undefined) && !n.parentElement.closest('script,style,[data-tx]')) nodes.push({n,orig:t,raw:n.nodeValue}); }
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
  }
  function setLang(l){ lang=l; try{ localStorage.setItem('vlab-lang',l); }catch(e){} apply(); hooks.forEach(f=>f()); }

  // header: lab-navigasjon + språk
  /* Virtual Labs information architecture ("Atlas"): seven subject areas, then "More" (not an area card).
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
   {k:'inst',en:'Instruments',no:'Instrumenter',d:t2('What the altimeter, airspeed and attitude references really measure, and how they mislead you.','Hva høydemåler, fartsmåler og attitydereferanser egentlig måler, og hvordan de kan lure deg.'),
    c:[t2('Altimeter settings and errors','Høydemålerinnstillinger og feil'),t2('Pitot-static faults','Feil i pitot-statisk system'),t2('Compass and gyros','Kompass og gyroer'),t2('ADIRS','ADIRS')],
    labs:[['airdata.html','air','Air data: pressure, altitude and airspeed','Luftdata: trykk, høyde og fart',''],['gyros.html','gyro','Compass, gyros and ADIRS','Kompass, gyroer og ADIRS','jet']]},
   {k:'sys',en:'Aircraft and engine systems',no:'Fly- og motorsystemer',d:t2('Piston, turboprop and jet engines, then hydraulics, electrics and pressurisation, and the autoflight that ties them together.','Stempel-, turboprop- og jetmotorer, deretter hydraulikk, elektrisk og trykkabin, og autoflighten som binder dem sammen.'),
    c:[t2('Piston, turboprop and jet','Stempel, turboprop og jet'),t2('Hydraulics and fly-by-wire','Hydraulikk og fly-by-wire'),t2('Cabin altitude and hypoxia','Kabinhøyde og hypoksi'),t2('FMA and autoflight modes','FMA og autoflight-moduser')],
    labs:[['engines.html','engines','Powerplant: piston, turboprop and jet','Motorer: stempel, turboprop og jet',''],['jetsystems.html','jets','Jet transport systems','Systemer på jetfly','jet'],['pressurisation.html','press','Pressurisation and hypoxia','Trykkabin og hypoksi','jet'],['autoflight.html','af','Autoflight and warnings','Autoflight og varsling','jet']]},
   {k:'perf',en:'Performance',no:'Ytelse',d:t2('Take-off, climb, cruise and landing numbers, and the fuel you plan to carry.','Tall for start, stigning, cruise og landing, og drivstoffet du planlegger å ha med.'),
    c:[t2('V1 and runway limits','V1 og rullebanebegrensninger'),t2('Climb and cruise','Stigning og cruise'),t2('Landing distance','Landingsdistanse'),t2('Fuel planning','Drivstoffplanlegging')],
    labs:[['performance.html','perf','Performance','Ytelse','jet'],['flightplanning.html','fpl','Flight planning and fuel','Flyplanlegging og drivstoff','jet']]},
   {k:'mb',en:'Mass and balance',no:'Masse og balanse',d:t2('Masses, limits and the centre of gravity, through to a finished load sheet.','Masser, grenser og tyngdepunkt, helt fram til et ferdig lasteark.'),
    c:[t2('Structural mass limits','Strukturelle massegrenser'),t2('Centre of gravity','Tyngdepunkt'),t2('Load sheet','Lasteark'),t2('Trim setting','Trimsetting')],
    labs:[['massbalance.html','mb','Mass and balance','Masse og balanse','jet']]},
   /* not one of the seven areas: reachable from "More" at the bottom of lab.html */
   {k:'hf',more:true,en:'Human factors',no:'Menneskelige faktorer',d:t2('Spatial orientation, attention, workload, error and fatigue.','Romlig orientering, oppmerksomhet, arbeidsbelastning, feil og tretthet.'),c:[],
    labs:[['orientation.html','ori','Spatial orientation','Romlig orientering',''],['humanperf.html','hp','Attention, workload, error and fatigue','Oppmerksomhet, arbeidsbelastning, feil og tretthet','']]}];
  const AREAS=PATH.filter(m=>!m.more), MORE=PATH.filter(m=>m.more);
  const FLAT=PATH.flatMap((m,mi)=>m.labs.map((l,li)=>({m,mi,li,f:l[0],k:l[1],en:l[2],no:l[3],lv:l[4]})));
  /* Sections of every lab: [anchor id, EN, NO, type]  type: sim | drill | read | quiz  (also used by lab.html's topic search) */
  const TOP=/*TOPICS*/{"airdata.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The air data lab","Luftdatalabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"wxreports.html":[["concepts","Key concepts","Nøkkelbegreper","read"],["explore","Weather report decoder","Værrapport-dekoder","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"forces.html":[["four","The four forces","De fire kreftene","read"],["model","Forces in flight lab","Kraftlab","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"tunnel.html":[["concepts","Key concepts","Nøkkelbegreper","read"],["profil","Aerofoil section and stall","Profilsnitt og stall","sim"],["tunnel","3D wind tunnel","3D-vindtunnel","sim"],["stall","Stall and stall speed","Stall og stallfart","sim"],["try","Things to try","Prøv dette","drill"],["wake","Wingtip vortices","Vingetippvirvler","sim"],["ground","Ground effect","Bakkeeffekt","sim"],["debrief","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"stability.html":[["understand","CG, lift and the tail","CG, løft og halen","read"],["basics","CG and mass model","CG- og massemodell","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["long","Longitudinal stability","Lengdestabilitet","sim"],["lat","Lateral and directional","Tverr- og retningsstabilitet","sim"],["vn","Load factor","Lastfaktor","sim"],["controls","Flight controls","Flykontroller","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"propeller.html":[["pfactor","P-factor and the critical engine","P-faktor og kritisk motor","read"],["lt","Light twin: engine failure","Lett tomotors: motorstans","sim"],["pwing","Propeller as a wing","Propellen som vinge","sim"],["single","VMCA lab (A320)","VMCA-lab (A320)","sim"],["try","Try it","Prøv selv","drill"],["cert","Certification and speeds","Sertifisering og farter","read"],["ops","Failure after V1","Motorstans etter V1","read"],["quiz","Test yourself","Test deg selv","quiz"]],"highspeed.html":[["understand","Two limits: drag and Mach","To grenser: motstand og Mach","read"],["explore","The flight envelope lab","Flykonvoluttlabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"clouds.html":[["understand","Key concepts","Nøkkelbegreper","read"],["lift","Clouds and stability lab","Sky- og stabilitetslabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"pressure.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","Build the wind","Bygg vinden","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"fronts.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","Fly through a front","Fly gjennom en front","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"storms.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The storm lab","Stormlabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"hazards.html":[["concepts","Key concepts","Nøkkelbegreper","read"],["explore","Hazards lab","Farelab","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"engines.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The engine lab","Motorlabben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"jetsystems.html":[["hyd","Hydraulics","Hydraulikk","sim"],["fbw","Fly-by-wire","Fly-by-wire","sim"],["elec","Electrics","Elektrisk","sim"],["gear","Gear and brakes","Understell og bremser","sim"],["fuelbleed","Fuel, bleed and fire","Drivstoff, bleed og brann","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"pressurisation.html":[["cabin","Cabin altitude","Kabinhøyde","sim"],["decomp","Decompression","Dekompresjon","sim"],["hypoxia","Hypoxia","Hypoksi","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"gyros.html":[["compass","Magnetic compass","Magnetkompass","sim"],["gyro","Gyroscopes","Gyroskoper","sim"],["irs","From gyros to ADIRS","Fra gyro til ADIRS","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"autoflight.html":[["fma","Reading the FMA","Lese FMA-en","sim"],["traps","Mode traps","Modusfeller","drill"],["tcas","TCAS","TCAS","sim"],["gpws","EGPWS","EGPWS","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"massbalance.html":[["masses","Masses and limits","Masser og grenser","sim"],["cg","Centre of gravity","Tyngdepunkt","sim"],["loadsheet","Load sheet","Lasteark","drill"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"performance.html":[["takeoff","Take-off and V1","Start og V1","sim"],["limits","Take-off mass limits","Begrensninger for startvekt","sim"],["climb","Climb and cruise","Stigning og cruise","sim"],["enroute","Engine failure en route","Motorstans underveis","sim"],["landing","Landing distance","Landingsdistanse","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"gennav.html":[["triangle","Wind triangle","Vindtrekanten","sim"],["sixty","1 in 60","1 av 60","sim"],["earth","Earth and directions","Jorden og retninger","sim"],["charts","Chart projections","Kartprojeksjoner","sim"],["time","Time","Tid","sim"],["pet","PET and PNR","PET og PNR","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"radionav.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","The navigation simulator","Navigasjonssimulatoren","sim"],["try","Try it","Prøv selv","drill"],["radar","Radar and ADS-B","Radar og ADS-B","sim"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"gnss.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","GNSS and RNP lab","GNSS- og RNP-labben","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"holding.html":[["understand","Key concepts","Nøkkelbegreper","read"],["explore","Hold and approach lab","Holding- og innflygingslab","sim"],["try","Try it","Prøv selv","drill"],["debrief","Key points","Det viktigste","read"],["quiz","Test yourself","Test deg selv","quiz"]],"flightplanning.html":[["fuel","Fuel make-up","Drivstoffsammensetning","sim"],["alternates","Alternates and minima","Alternativer og minima","sim"],["inflight","In-flight fuel","Drivstoff under flyging","drill"],["tanker","Tankering","Tankering","sim"],["cruise","Level and cost index","Høyde og kostindeks","sim"],["atc","ATC flight plan","ATC-færdselsplan","read"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]],"orientation.html":[["senses","The three senses","De tre sansene","read"],["ear","Inner ear simulator","Indre øre-simulator","sim"],["trainer","Trainer","Trener","drill"],["approach","Approach illusions","Illusjoner på innflyging","sim"],["other","Other illusions","Andre illusjoner","read"],["quiz","Test yourself","Test deg selv","quiz"]],"humanperf.html":[["info","Information processing","Informasjonsbehandling","sim"],["workload","Workload","Arbeidsbelastning","sim"],["fatigue","Fatigue","Tretthet","sim"],["tem","Threat and error","Trusler og feil","drill"],["vision","Vision","Syn","sim"],["ops","In the aircraft","I flyet","read"],["quiz","Test yourself","Test deg selv","quiz"]]}/*END*/;
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
    const me=FLAT.find(x=>x.k===page);
    const nav=document.querySelector('.labnav');
    if(nav&&me) nav.hidden=true;   /* replaced by the Atlas sidebar */
    else if(nav) legacyNav(nav,page,me);
    pageHeader(page,me);
    if(me) atlas(me); else inPageNav();
    pathbar(page);
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
        `<b><a href="lab.html#${area.k}">${esc(Lx(area))}</a></b></div>`+
        `<ol class="atl-topics">${area.labs.map((l,i)=>{ const on=l[1]===me.k; return `<li class="${on?'on':''}"><a href="${l[0]}"${on?' aria-current="page"':''}><i>${i+1}</i><span>${esc(lang==='en'?l[2]:l[3])}</span></a>${on?secs:''}</li>`; }).join('')}</ol>`+
        `<div class="atl-other"><span class="h">${esc(Lx(t2('Other areas','Andre områder')))}</span>${AREAS.filter(a=>a!==area).map(a=>`<a href="${a.labs[0][0]}"><i>${String(areaNo(a)).padStart(2,'0')}</i>${esc(Lx(a))}</a>`).join('')}</div></div>`;
      side.classList.toggle('open',open); spy(); };
    const drawBar=()=>{
      bar.setAttribute('aria-label',Lx(t2('Steps in this lab','Steg i denne labben')));
      bar.innerHTML=`<div class="atl-steps">${STEPS.map(([k,n],i)=>{ const tg=k==='check'?(steps.find(s=>s.id==='quiz')||steps.find(s=>s.step===k)):steps.find(s=>s.step===k); /* Test yourself goes to the quiz, like the sidebar */
        return tg?`<a href="#${esc(tg.id)}" data-step-link="${k}"><i>${i+1}</i>${esc(Lx(n))}</a>`:`<span class="off" data-step-link="${k}" aria-disabled="true" title="${esc(Lx(t2('Not yet in this lab','Ikke i denne labben ennå')))}"><i>${i+1}</i>${esc(Lx(n))}</span>`; }).join('')}</div>${depthHTML('d-bar')}`;
      spy(); };
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
    let raf=0; addEventListener('scroll',()=>{ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; spy(); }); },{passive:true});
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
    const st=hd.querySelector('.hright .status');
    let stw=null; if(st){ stw=document.createElement('span'); stw.className='mi mst'; stw.innerHTML='<span class="k"></span>'; stw.appendChild(st); }
    const draw=()=>{ const lv=LVX[me.lv]||LVX[''], n=areaNo(me.m), foot=document.querySelector('.page p.foot');
      eb.innerHTML=`<a href="lab.html">Virtual Labs</a> · ${me.m.more?esc(Lx(t2('More','Mer'))):`${esc(Lx(t2('Area','Område')))} ${n}`} · <a href="lab.html#${me.m.k}">${esc(Lx(me.m))}</a>`;
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
    let raf=0; addEventListener('scroll',()=>{ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; mark(); }); },{passive:true}); mark();
  }
  /* "Next" at the end of every lab (the step bar's last step): next topic in the area, then the next area */
  function pathbar(page){
    const i=FLAT.findIndex(x=>x.k===page); if(i<0) return;
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
  // glidebryter
  function slider(box,o){
    const w=document.createElement('div'); w.className='ctl';
    const id=o.id||('s'+Math.random().toString(36).slice(2));
    w.innerHTML=`<label for="${id}"><span></span><output></output></label><input type="range" id="${id}" min="${o.min}" max="${o.max}" step="${o.step}">`+(o.hint?'<div class="hint"></div>':'');
    box.appendChild(w);
    const inp=w.querySelector('input'), sp=w.querySelector('span'), out=w.querySelector('output'), h=w.querySelector('.hint');
    const api={ get v(){ return parseFloat(inp.value); }, set(v){ inp.value=v; render(); }, el:w, inp };
    function render(){ sp.textContent=T(o.label); out.textContent=o.f(parseFloat(inp.value)); if(h) h.textContent=T(o.hint); }
    inp.value=o.v; render();
    inp.addEventListener('input',()=>{ render(); o.on&&o.on(parseFloat(inp.value)); });
    hooks.push(render);
    return api;
  }
  // segmentvalg
  function seg(box,items,v,on){
    box.classList.add('seg');
    const draw=()=>{ box.innerHTML=items.map(([k,t])=>`<button data-v="${k}" class="${String(k)===String(api.v)?'on':''}">${T(t)}</button>`).join(''); };
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
    const mq=matchMedia('(max-width:980px)'), ps=()=>document.querySelectorAll('details.xpanel');
    const sync=first=>ps().forEach(d=>{ if(!mq.matches) d.open=true; else if(first) d.open=false; });
    sync(true); if(mq.addEventListener) mq.addEventListener('change',()=>sync(false));
    document.addEventListener('click',e=>{ if(e.target.closest('.tasks [data-go]')) ps().forEach(d=>{ d.open=true; }); });
  })();

  window.LAB={ PATH, AREAS, MORE, FLAT, TOP, LV, LVX, LVTIP, done, get depth(){ return depth; }, setDepth:d=>setDepth(d,true), T, L, nf, el, add(dict,no){ Object.assign(D,dict); if(no) Object.assign(NO,no); }, start(page){ header(page); scan(); apply(); }, head(page){ header(page); const n=document.querySelector('.labnav'); if(n) scan(n); apply(); },
    onLang(f){ hooks.push(f); }, tx(dict){ Object.assign(TXD,dict); txApply(); }, get lang(){ return lang; }, slider, seg, fit, visible, quiz, shuffle };
})();
