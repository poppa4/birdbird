/* NORDAP – toppmeny og bunntekst på alle sider. Følger sidens språk (html lang). */
(function(){
  'use strict';
  const NO={'Beta':'Beta','Illustrative model':'Illustrativ modell','Fictional training data':'Fiktive treningsdata','Not for navigation':'Ikke for navigasjon','Checked against source':'Kontrollert mot kilde','Your own data':'Dine egne data','Open data, not the official AIP':'Åpne data, ikke offisiell AIP','Examples, not your SOP':'Eksempler, ikke din SOP','What this is, and is not':'Hva dette er, og ikke er','Model profiles':'Modellprofiler','How content is checked':'Slik kontrolleres innholdet','Home':'Hjem','Virtual Labs':'Virtual Labs','Simulators':'Simulatorer','Type rating and checks':'Typerating og sjekk','Weather':'Vær','METAR and TAF':'METAR og TAF','Weather forecast':'Værvarsel','About':'Om','soon':'snart','Open the lab':'Åpne labben','Menu':'Meny',
    'Interactive aviation training, built by pilots.':'Interaktiv flyopplæring, laget av piloter.','Lab':'Lab','Wind tunnel':'Vindtunnel','Propeller effects':'Propelleffekter','CG and stability':'CG og stabilitet','Pressure & altitude':'Trykk og høyde','Spatial orientation':'Romlig orientering','Holding':'Holding','Pitot-static':'Pitot-statisk','All labs':'Alle labber','Learning path':'Læringsløp','Subject areas':'Fagområder','All topics':'Alle emner','Performance':'Ytelse','Jet transport systems':'Systemer på jetfly','Autoflight':'Autoflight','Type rating trainer':'Typeratingtrener','Weather and fronts':'Vær og fronter','Clouds and fog':'Skyer og tåke','Thunderstorms':'Tordenvær','Weather hazards':'Værfarer','Instrument approach':'Instrumentinnflyging','Holding and approach':'Holding og innflyging','Radio navigation':'Radionavigasjon','GNSS and RNAV':'GNSS og RNAV',
    'Coming':'Kommer','Sun and twilight':'Sol og tussmørke','Aerodrome and AIP':'Flyplass og AIP','Check preparation':'Kontrollforberedelse','Admin':'Admin','Workspace':'Workspace','Account settings':'Kontoinnstillinger','Ask a question':'Still et spørsmål','Desk':'Arbeidsflate','Documents':'Dokumenter','Aircraft':'Fly','More':'Mer','Briefing packs':'Briefingpakker','Routes':'Ruter','Training progress':'Treningsprogresjon','Storage and backup':'Lagring og sikkerhetskopi','Trash':'Papirkurv','Notes':'Notater','Instructor training':'Instruktørtrening','EASA rules library':'EASA-regelbibliotek','Flow trainer':'Flow-trener','737 FMC trainer':'737 FMC-trener','GNS 530 trainer':'GNS 530-trener','How it works':'Slik virker det','Flow library':'Flow-bibliotek','My page':'Min side','My progress':'Min fremgang','Account and sync':'Konto og synkronisering','Account settings':'Kontoinnstillinger','My page and account':'Min side og konto','Create account':'Lag konto','Sign in':'Logg inn','Sign out':'Logg ut','Account':'Konto','Workspace':'Workspace','My training':'Min trening','For flight schools':'For flyskoler','Privacy':'Personvern','Data sources':'Datakilder','Rules we link to':'Regelverk vi lenker til','A320 sim assessment':'A320 simulatortest','Aviation training':'Flyopplæring','Train':'Tren','Simulator':'Simulator','Flight planning':'Flyplanlegging','Radio':'Radio','G1000 trainer':'G1000-trener','Glass cockpit trainer':'Glass cockpit-trener','DA42 simulator':'DA42-simulator','AI radio trainer':'AI-radiotrener','Ranks':'Rangering','Flight training':'Flytrening','Your documents':'Dine dokumenter','Topics to revise':'Emner å repetere','Procedures':'Prosedyrer','Training':'Trening','Training hub':'Treningshub','Type rating':'Typerating','Aircraft systems':'Flysystemer','Ask the instructor':'Spør instruktøren','Your progress':'Din progresjon','More labs':'Flere labber','Interactive theory for pilots: from the first IR lesson to the A320 sim check.':'Interaktiv teori for piloter: fra første IR-time til A320-simulatorsjekken.','Briefing pack':'Briefingpakke','Preflight':'Preflight','Tools':'Verktøy','Route Explorer':'Route Explorer','Navigation log':'Navigasjonslogg','Kneeboard sheets':'Kneeboard-ark','VFR and IFR essentials':'Det viktigste i VFR og IFR','Plan':'Planlegg','Gate to gate':'Gate to gate','Briefings':'Briefinger','Briefing':'Briefing','Radio drills':'Radiodriller','Flow trainer':'Flow-trener','Checkride prep':'Checkride-forberedelse','Overview':'Oversikt','Aerodynamics':'Aerodynamikk','Meteorology':'Meteorologi','Navigation':'Navigasjon','Instruments':'Instrumenter','Systems':'Systemer','Performance':'Ytelse','Air law':'Luftfartsrett','Human factors':'Menneskelige faktorer','Forces in flight':'Krefter i flyging','Stability, controls and load factor':'Stabilitet, ror og lastfaktor','Engine failure and minimum control speeds':'Motorstans og minste kontrollfarter','High-speed flight and drag':'Høyfart og motstand','Pressure and wind':'Trykk og vind','Clouds, stability and fog':'Skyer, stabilitet og tåke','Fronts and air masses':'Fronter og luftmasser','Thunderstorms and wind shear':'Tordenvær og vindskjær','Icing and turbulence':'Ising og turbulens','Reading the weather':'Les værmeldingen','General navigation':'Generell navigasjon','Radio navigation simulator':'Radionavigasjonssimulator','GNSS and RNAV':'GNSS og RNAV','Holding and instrument approach':'Holding og instrumentinnflyging','Air data: pressure, altitude and airspeed':'Luftdata: trykk, høyde og fart','Attitude and heading':'Holdning og kurs','Automation and warnings':'Automatikk og varsling','Powerplant: piston, turboprop and jet':'Motorer: stempel, turboprop og jet','Aircraft systems':'Flysystemer','Pressurisation and oxygen':'Trykkabin og oksygen','Take-off and landing performance':'Start- og landingsytelse','Climb, cruise and fuel planning':'Stigning, marsj og drivstoffplanlegging','Spatial orientation and illusions':'Romlig orientering og illusjoner','Human performance':'Menneskelig ytelse','IFR trainer':'IFR-trener','MCDU trainer':'MCDU-trener','Cessna 172':'Cessna 172','Cessna 172 3D (beta)':'Cessna 172 3D (beta)','King Air B200 3D (beta)':'King Air B200 3D (beta)','DA42 3D (beta)':'DA42 3D (beta)',
    'Ask or search…':'Spør eller søk …','Ask or search anything, e.g. ':'Spør eller søk etter hva som helst, f.eks. ','crosswind 270/15 rwy 24':'sidevind 270/15 bane 24','answers right here':'svar rett her',
    'Skip to content':'Hopp til innholdet','A preparation aid, not a source. Check every figure against the AIP, the flight manual, official weather and NOTAM, and your operator’s procedures.':'Et hjelpemiddel for forberedelse, ikke en kilde. Kontroller hvert tall mot AIP, flyhåndboken, offisielt vær og NOTAM, og operatørens prosedyrer.','From aviation theory and regulations to interactive training and flight preparation.':'Fra luftfartsteori og regelverk til interaktiv trening og flyforberedelse.','Built in Norway by Daniel Nilsson.':'Laget i Norge av Daniel Nilsson.','Contact':'Kontakt','Report an error':'Meld fra om en feil','Footer':'Bunntekst','Language':'Språk','Main':'Hovedmeny','Search or ask':'Søk eller spør','Page not found':'Fant ikke siden','NORDAP':'NORDAP','About me':'Om meg','Made by Daniel Nilsson, pilot, for everyone learning to fly.':'Laget av Daniel Nilsson, pilot, for alle som lærer å fly.',"Daniel's tip":'Daniels tips','Your rank and progress':'Din rang og progresjon','Progress':'Progresjon','Training material only. Always follow the AIP, the flight manual and your operator’s procedures.':'Kun opplæringsmateriell. Følg alltid AIP, flyhåndboken og operatørens prosedyrer.'};
  const t=s=> document.documentElement.lang==='nb'? (NO[s]||s) : s;
  /* the contact form (contactform.js) is loaded on the first click of a [data-contactform] link: the footer's Contact and Report an error */
  document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-contactform]'); if(!b||window.NDContactForm) return; e.preventDefault();
    const sc=document.createElement('script'); sc.src='contactform.js?v=1'; sc.onload=()=>{ if(window.NDContactForm) window.NDContactForm.open(b.dataset.topic); }; document.head.appendChild(sc); });
  const TRAIN='Training material only. Always follow the AIP, the flight manual and your operator’s procedures.';
  /* the briefing pack is used to prepare real flights: a preparation aid, not a source */
  const PREP='A preparation aid, not a source. Check every figure against the AIP, the flight manual, official weather and NOTAM, and your operator’s procedures.';
  const TRAIN_PAGES=['prep.html','sheets.html','essentials.html','radio.html','checkride.html','wxreports.html'];
  let page=(location.pathname.split('/').pop()||'index.html').replace(/\?.*/,''); if(!/\.html$/.test(page)) page=page+'.html';
  const lab=['lab.html','forces.html','engines.html','tunnel.html','propeller.html','stability.html','airdata.html','orientation.html','holding.html','pressure.html','fronts.html','clouds.html','storms.html','hazards.html','wxreports.html','approach.html','radionav.html','gnss.html','performance.html','highspeed.html','massbalance.html','autoflight.html','gyros.html','jetsystems.html','pressurisation.html','gennav.html','flightplanning.html','humanperf.html','airspace.html'].includes(page);
  /* Training hub: one sub-nav, same order everywhere */
  const TRG0=[['training.html','Overview'],{g:'Simulators',items:[['cockpit.html','DA42','da42-3d.html'],['b200.html','King Air B200','b200-3d.html'],['a320.html','Airbus A320','a320-3d.html']]},['ifr.html','IFR trainer'],['mcdu.html','MCDU trainer'],['briefing.html','Briefing'],['radio-drills.html','Radio'],{g:'Type rating and checks',items:[['typerating.html','Type rating'],['simcheck.html','A320 sim assessment'],['checkride.html','Check preparation']]}];
  const TRN=[['training.html','Overview'],['cockpit.html','DA42'],['b200.html','King Air B200'],['a320.html','Airbus A320'],['ifr.html','IFR trainer'],['mcdu.html','MCDU trainer'],['briefing.html','Briefing'],['radio-drills.html','Radio'],['radio.html','Radio: gate to gate'],['typerating.html','Type rating'],['simcheck.html','A320 sim assessment'],['checkride.html','Check preparation']];
  /* temporarily hidden simulators (owner's decision, Nov 2026): out of the menus, the aircraft selectors and every link or card;
     opening their pages goes to the training overview (?show=1 still opens them). Empty this list to bring them back. */
  const HIDDEN_SIMS=['b200.html','b200-3d.html'];
  TRG0.forEach(g=>{ if(g&&g.items) g.items=g.items.filter(x=>!HIDDEN_SIMS.includes(x[0])); });
  for(let i=TRN.length-1;i>=0;i--) if(HIDDEN_SIMS.includes(TRN[i][0])) TRN.splice(i,1);
  if(HIDDEN_SIMS.includes(page)&&!/[?&]show=1/.test(location.search)) location.replace('training.html');
  { const base=u=>(u||'').split(/[?#]/)[0].split('/').pop();
    const sweep=root=>{ if(!root.querySelectorAll) return; const L=[...root.querySelectorAll('a[href],option[value]')]; if(root.matches&&root.matches('a[href],option[value]')) L.push(root); L.forEach(el=>{ if(!HIDDEN_SIMS.includes(base(el.getAttribute(el.tagName==='OPTION'?'value':'href')))) return;
      if(el.tagName==='OPTION'){ el.remove(); return; } const card=el.closest('article,li,.sy,.tile,.card,[class*="tile"]'); (card||el).hidden=true; (card||el).style.display='none'; }); };
    const go=()=>{ sweep(document); new MutationObserver(ms=>{ for(const m of ms) m.addedNodes.forEach(n=>{ if(n.nodeType===1) sweep(n); }); }).observe(document.body,{childList:true,subtree:true}); };
    if(document.body) go(); else document.addEventListener('DOMContentLoaded',go); }
  const checkMode=page==='fi.html'&&/[?&]mode=check/.test(location.search);
  /* Preflight: the briefing pack and Route Explorer under one roof, with the same kind of sub-nav as the Training hub */
  const PLG=[['preflight.html','Overview'],['prep.html','Briefing pack'],['route.html','Route Explorer'],['weather.html','Weather'],['aerodrome.html','Aerodrome and AIP'],{g:'Tools',items:[['planning.html','Navigation log'],['sheets.html','Kneeboard sheets'],['essentials.html','VFR and IFR essentials']]}];
  const PLN=[['preflight.html','Overview'],['prep.html','Briefing pack'],['route.html','Route Explorer'],['weather.html','Weather'],['aerodrome.html','Aerodrome and AIP'],['sun.html','Sun and twilight'],['planning.html','Navigation log'],['sheets.html','Kneeboard sheets'],['essentials.html','VFR and IFR essentials']];
  /* Virtual Labs: the same kind of sub-nav as the Training hub and Preflight, one entry per subject area (same order as lab.js PATH) */
  const LBG=[['lab.html','Overview'],
    {g:'Aerodynamics',items:[['tunnel.html','Wind tunnel'],['forces.html','Forces in flight'],['stability.html','Stability, controls and load factor'],['propeller.html','Engine failure and minimum control speeds'],['highspeed.html','High-speed flight and drag']]},
    {g:'Meteorology',items:[['pressure.html','Pressure and wind'],['clouds.html','Clouds, stability and fog'],['fronts.html','Fronts and air masses'],['storms.html','Thunderstorms and wind shear'],['hazards.html','Icing and turbulence'],['wxreports.html','Reading the weather']]},
    {g:'Navigation',items:[['gennav.html','General navigation'],['radionav.html','Radio navigation simulator'],['gnss.html','GNSS and RNAV'],['holding.html','Holding and instrument approach']]},
    {g:'Instruments',items:[['airdata.html','Air data: pressure, altitude and airspeed'],['gyros.html','Attitude and heading'],['autoflight.html','Automation and warnings']]},
    {g:'Systems',items:[['engines.html','Powerplant: piston, turboprop and jet'],['jetsystems.html','Aircraft systems'],['pressurisation.html','Pressurisation and oxygen']]},
    {g:'Performance',items:[['performance.html','Take-off and landing performance'],['flightplanning.html','Climb, cruise and fuel planning']]},
    ['airspace.html','Air law'],
    {g:'Human factors',items:[['orientation.html','Spatial orientation and illusions'],['humanperf.html','Human performance']]}];
  /* Flight Intelligence: one hub (workspace.html and the instructor pages in fi.html), with the same kind of sub-nav as the other hubs */
  const FIG=[['workspace.html#/library','Home'],['workspace.html#/desk','Desk'],['workspace.html#/documents','Documents'],['workspace.html#/notes','Notes'],['workspace.html#/aircraft','Aircraft'],{g:'More',items:[['workspace.html#/packs','Briefing packs'],['workspace.html#/routes','Routes'],['fi.html#aircraft','Instructor training'],['fi.html#progress','Training progress'],['fi.html#easa','EASA rules library'],['workspace.html#/storage','Storage and backup'],['workspace.html#/trash','Trash']]}];
  const fih=(page==='workspace.html'||page==='fi.html')&&!checkMode;
  const fiOn=h=>{ const i=h.indexOf('#'), p=h.slice(0,i), k=h.slice(i+1); if(p!==page) return false; const cur=location.hash.replace(/^#\/?/,'').split(/[/?]/)[0];
    if(page==='fi.html') return '#'+k===(location.hash||'#aircraft')||(k==='aircraft'&&!/^#(progress|easa)$/.test(location.hash));
    const w=k.replace(/^\//,''); return w==='library'?['library','search','map'].includes(cur):w==='desk'?(cur===''||cur==='desk'||cur==='notebook'):cur===w; };
  const trn=TRN.some(x=>x[0]===page)||['c172-3d.html','da42-3d.html','b200-3d.html','a320-3d.html','b737-3d.html'].includes(page)||checkMode, pln=PLN.some(x=>x[0]===page)||page==='outlook.html';
  const D3={'c172.html':'c172-3d.html','cockpit.html':'da42-3d.html','b200.html':'b200-3d.html','a320.html':'a320-3d.html','b737.html':'b737-3d.html'}; try{ if(trn&&page!=='training.html'){ const hit=TRN.find(x=>x[0]===page||D3[x[0]]===page); if(hit) localStorage.setItem('bb-last-trn',JSON.stringify({h:page,l:hit[1]+(D3[hit[0]]===page?' 3D':''),at:Date.now()})); } }catch(e){} try{ if(lab&&page!=='lab.html') localStorage.setItem('bb-last-lab',JSON.stringify({h:page,at:Date.now()})); }catch(e){} const trnOn=h=> h===page || D3[h]===page || (checkMode&&h==='checkride.html') || (h==='radio-drills.html'&&page==='radio.html');
  /* language before first paint: the header, sub-nav and footer are written in the right language at once (lab.js keeps it in sync) */
  const HTML=document.documentElement; let NOW_NO=false; try{ NOW_NO=localStorage.getItem('vlab-lang')==='no'; }catch(e){} if(NOW_NO) HTML.lang='nb';
  /* Hold: every page is finished by its scripts (language, lab shell, lists, canvases). The header, search bar and section nav
     paint at once; the page below them stays unpainted (html.bb-hold, see site.css) until those scripts have run, so nothing
     jumps and the English source text never flashes in Norwegian. Released at DOMContentLoaded, or when a page that renders
     later calls the function BBHOLD.wait() gave it, and after 2.5 s at the latest. */
  { let n=1, t=0; const rel=()=>{ if(--n>0) return; n=0; clearTimeout(t); HTML.classList.remove('bb-hold'); };
    window.BBHOLD={ wait(){ if(!HTML.classList.contains('bb-hold')) return ()=>{}; n++; let d=false; return ()=>{ if(!d){ d=true; rel(); } }; } };
    if(document.readyState==='loading'&&!/[?&]embed=1/.test(location.search)){ HTML.classList.add('bb-hold');
      document.addEventListener('DOMContentLoaded',rel); t=setTimeout(()=>{ n=1; rel(); },1500); } }
  /* page-family classes for the design system (set early, before first paint) */
  document.documentElement.classList.add(page==='lab.html'?'vlab-home':(lab?'vlab':'site-page'));
  /* Virtual Labs depth (Short / Deep dive / Instructor) as a body class before first paint; lab.js keeps it in sync */
  if(lab&&page!=='lab.html'&&document.body){ let d='deep'; try{ const v=localStorage.getItem('vlab-depth'); if(v==='short'||v==='instructor') d=v; }catch(e){} document.body.classList.add('depth-'+d); }
  /* favicon (logo mark) */
  if(!document.querySelector('link[rel~="icon"]')){ const fl=document.createElement('link'); fl.rel='icon'; fl.type='image/svg+xml'; fl.href='favicon.svg?v=5'; document.head.appendChild(fl); }
  const logo='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15.5" fill="#13202A"/><circle cx="16" cy="16" r="12.6" fill="#F3EFE4"/><path d="M16 16L14.94 14.94L16.00 4.70Z" fill="#13202A"/><path d="M16 16L16.00 4.70L17.06 14.94Z" fill="#3B5670"/><path d="M16 16L17.06 14.94L27.30 16.00Z" fill="#13202A"/><path d="M16 16L27.30 16.00L17.06 17.06Z" fill="#3B5670"/><path d="M16 16L17.06 17.06L16.00 27.30Z" fill="#13202A"/><path d="M16 16L16.00 27.30L14.94 17.06Z" fill="#3B5670"/><path d="M16 16L14.94 17.06L4.70 16.00Z" fill="#13202A"/><path d="M16 16L4.70 16.00L14.94 14.94Z" fill="#3B5670"/><g transform="translate(16 16.6) rotate(-6) scale(0.27)"><path d="M-42 -2 Q-30 -23 -10 -11 Q-4 -7 0 2 Q5 -9 12 -14 Q34 -30 46 -6 Q32 -12 15 -1 Q6 4 0 14 Q-5 4 -12 0 Q-28 -8 -42 -2 Z" fill="#1F5A8F" stroke="#F3EFE4" stroke-width="4.5" stroke-linejoin="round"/></g></svg>';
  /* the full seal for larger places (footer); the mark above is for the header and small sizes. The earlier logo: logo-classic.svg */
  const seal='<img src="logo-seal.webp" width="64" height="64" alt="" class="seal" loading="lazy">';
  /* the header carries the same seal as the footer */
  const sealHead='<img src="logo-seal.webp" width="42" height="42" alt="" class="seal">';
  /* the NORDAP logo (2026-11-26): the seal (ring, globe and bird) beside the wordmark, with the line under the wordmark
     (as EASA sets its name). Navy on light pages; the white files are for navy backgrounds. Source: tools/logo/seal/build.py */
  const brand=(c)=>`<span class="lgx ${c||''}"><img class="lg-seal" src="img/brand/nordap-seal-navy.svg?v=5" width="38" height="38" alt=""><span class="lgt"><img class="lg lg-n" src="img/brand/nordap-word-navy.svg?v=5" width="136" height="15" alt=""><img class="lg lg-w" src="img/brand/nordap-word-white.svg?v=5" width="136" height="15" alt=""><small>Nordic Aviation Platform</small></span></span>`;

  /* ---------- rang og progresjon (lokalt; klar for synk mot konto senere) ---------- */
  const PK='naeroson-prog';
  const ITEMS=[
    ['lab','quiz:airdata',150,'airdata.html#quiz',{en:'Air data test',no:'Test: luftdata'}],
    ['lab','quiz:orientation',150,'orientation.html#quiz',{en:'Spatial orientation test',no:'Test: romlig orientering'}],
    ['lab','quiz:holding',150,'holding.html#quiz',{en:'Holding and approach test',no:'Test: holding og innflyging'}],
    ['lab','quiz:clouds',150,'clouds.html#quiz',{en:'Clouds, stability and fog test',no:'Test: skyer, stabilitet og tåke'}],
    ['lab','quiz:pressure',150,'pressure.html#quiz',{en:'Pressure and wind test',no:'Test: trykk og vind'}],
    ['lab','quiz:fronts',150,'fronts.html#quiz',{en:'Fronts and air masses test',no:'Test: fronter og luftmasser'}],
    ['lab','quiz:storms',150,'storms.html#quiz',{en:'Thunderstorms and wind shear test',no:'Test: tordenvær og vindskjær'}],
    ['lab','quiz:hazards',150,'hazards.html#quiz',{en:'Icing and turbulence test',no:'Test: ising og turbulens'}],
    ['lab','quiz:radionav',150,'radionav.html#quiz',{en:'Radio navigation test',no:'Test: radionavigasjon'}],
    ['lab','quiz:propeller',150,'propeller.html#quiz',{en:'Engine failure and minimum control speeds test',no:'Test: motorstans og minste kontrollfarter'}],
    ['lab','quiz:stability',150,'stability.html#quiz',{en:'CG and stability test',no:'Test: CG og stabilitet'}],
    ['lab','quiz:engines',150,'engines.html#quiz',{en:'Turbofan engine test',no:'Test: turbofanmotoren'}],
    ['lab','quiz:gnss',150,'gnss.html#quiz',{en:'GNSS and RNAV test',no:'Test: GNSS og RNAV'}],
    ['lab','quiz:tunnel',150,'tunnel.html#quiz',{en:'Wind tunnel test',no:'Test: vindtunnel'}],
    ['lab','quiz:highspeed',150,'highspeed.html#quiz',{en:'High-speed flight test',no:'Test: høyfart'}],
    ['lab','quiz:performance',150,'performance.html#quiz',{en:'Performance test',no:'Test: ytelse'}],
    ['lab','quiz:jetsystems',150,'jetsystems.html#quiz',{en:'Jet transport systems test',no:'Test: systemer på jetfly'}],
    ['lab','quiz:pressurisation',150,'pressurisation.html#quiz',{en:'Pressurisation and hypoxia test',no:'Test: trykkabin og hypoksi'}],
    ['lab','quiz:gyros',150,'gyros.html#quiz',{en:'Compass and gyros test',no:'Test: kompass og gyroer'}],
    ['lab','quiz:autoflight',150,'autoflight.html#quiz',{en:'Automation and warnings test',no:'Test: automatikk og varsling'}],
    ['lab','quiz:gennav',150,'gennav.html#quiz',{en:'General navigation test',no:'Test: generell navigasjon'}],
    ['lab','quiz:flightplanning',150,'flightplanning.html#quiz',{en:'Climb, cruise and fuel test',no:'Test: stigning, marsj og drivstoff'}],
    ['lab','quiz:humanperf',150,'humanperf.html#quiz',{en:'Human performance test',no:'Test: menneskelige faktorer'}],
    ['lab','quiz:airspace',150,'airspace.html#quiz',{en:'Airspace and rules of the air test',no:'Test: luftrom og lufttrafikkregler'}],
    ['radio','quiz:simcheck',200,'simcheck.html#quiz',{en:'A320 sim assessment test',no:'Test: A320 simulatortest'}],
    ['radio','b200:exam',400,'typerating.html#quiz',{en:'King Air B200 type rating exam',no:'King Air B200 typerating-eksamen'}],
    ['lab','tunnel:stall',100,'tunnel.html',{en:'Fly the wind tunnel into a stall',no:'Fly vindtunnelen inn i stall'}],
    ['lab','tunnel:lessons',150,'tunnel.html#try',{en:'Try five wind tunnel lessons',no:'Prøv fem vindtunnel-leksjoner'}],
    ['sim','sim:free',200,'cockpit.html',{en:'Simulator: autopilot basics',no:'Simulator: autopilot-grunnlag'}],
    ['sim','sim:takeoff',200,'cockpit.html',{en:'Simulator: take-off',no:'Simulator: avgang'}],
    ['sim','sim:ils',300,'cockpit.html',{en:'Simulator: ILS 36 to landing',no:'Simulator: ILS 36 til landing'}],
    ['sim','sim:efato',300,'cockpit.html',{en:'Simulator: engine failure',no:'Simulator: motorstans'}],
    ['sim','sim:steep',200,'cockpit.html',{en:'Simulator: steep turns',no:'Simulator: bratte svinger'}],
    ['sim','sim:stall',200,'cockpit.html',{en:'Simulator: stall recovery',no:'Simulator: stall og gjenvinning'}],
    ['sim','quiz:cockpit',150,'cockpit.html#quiz',{en:'Glass cockpit test',no:'Test: glass cockpit'}],
    ['plan','quiz:weather',150,'weather.html#quiz',{en:'METAR and TAF test',no:'Test: METAR og TAF'}],
    ['plan','fpl:clean',150,'planning.html#fpl',{en:'Fill in an error-free flight plan yourself',no:'Fyll ut en feilfri flyplan selv'}],
    ['plan','quiz:planning',150,'planning.html#quiz',{en:'Flight planning test',no:'Test: flyplanlegging'}],
    ['radio','radio:vfrdep',200,'radio-drills.html',{en:'Radio: VFR departure',no:'Radio: VFR-avgang'}],
    ['radio','radio:vfrarr',200,'radio-drills.html',{en:'Radio: VFR arrival',no:'Radio: VFR-ankomst'}],
    ['radio','radio:ifrclr',200,'radio-drills.html',{en:'Radio: IFR clearance',no:'Radio: IFR-klarering'}],
    ['radio','radio:ils',200,'radio-drills.html',{en:'Radio: IFR arrival and ILS',no:'Radio: IFR-ankomst og ILS'}],
    ['radio','radio:mayday',250,'radio-drills.html',{en:'Radio: MAYDAY',no:'Radio: MAYDAY'}],
    ['radio','g2g:ifr',400,'radio.html',{en:'Gate to gate: IFR training flight',no:'Gate to gate: IFR-treningstur'}],
    ['radio','g2g:vfr',300,'radio.html',{en:'Gate to gate: VFR local flight',no:'Gate to gate: VFR lokaltur'}],
    ['radio','brief:dep',200,'briefing.html#dep',{en:'Departure briefing scored 80 % or more',no:'Avgangsbriefing med 80 % eller mer'}],
    ['radio','brief:app',250,'briefing.html#app',{en:'Approach briefing scored 80 % or more',no:'Innflygingsbriefing med 80 % eller mer'}],
    ['radio','fi:oral',250,'fi.html',{en:'Flight Intelligence: oral exam',no:'Flight Intelligence: muntlig eksamen'}],
    ['radio','fi:scen',250,'fi.html',{en:'Flight Intelligence: scenario',no:'Flight Intelligence: scenario'}],
    ['radio','pc:oral',300,'fi.html?mode=check#aircraft',{en:'Check preparation with the instructor',no:'Kontrollforberedelse med instruktøren'}],
    ['radio','quiz:radio',150,'radio-drills.html#quiz',{en:'Radio phraseology test',no:'Test: radiofraseologi'}]
  ].map(([g,k,xp,href,t])=>({g,k,xp,href,t}));
  const RANKS=[[0,{en:'Getting started',no:'I gang'}],[200,{en:'First solo',no:'Første solo'}],[600,{en:'Private pilot',no:'Privatflyger'}],[1100,{en:'Night rating',no:'Mørkerettighet'}],[1600,{en:'Instrument rated',no:'Instrumentrettighet'}],[2200,{en:'Multi-engine IR',no:'Flermotor IR'}],[2800,{en:'Commercial pilot',no:'Trafikkflyger'}],[3300,{en:'First officer',no:'Styrmann'}],[3700,{en:'Captain',no:'Kaptein'}]];
  const lang=()=>document.documentElement.lang==='nb'?'no':'en';
  const Lx=o=>o[lang()]||o.en;
  function load(){ let d={}; try{ d=JSON.parse(localStorage.getItem(PK)||'{}')||{}; }catch(e){}
    ITEMS.forEach(it=>{ if(it.k.startsWith('quiz:')){ try{ const v=+(localStorage.getItem('aeroson-quiz-'+it.k.slice(5))||0); if(v>(d[it.k]||0)) d[it.k]=v; }catch(e){} }
      if(it.k.startsWith('radio:')){ try{ const v=+(localStorage.getItem('naeroson-radio-'+it.k.slice(6))||0); if(v>(d[it.k]||0)) d[it.k]=v; }catch(e){} } });
    return d; }
  function xpOf(d){ return Math.round(ITEMS.reduce((a,it)=>a+it.xp*Math.min(100,d[it.k]||0)/100,0)); }
  function rankOf(xp){ let i=0; RANKS.forEach((r,j)=>{ if(xp>=r[0]) i=j; }); const next=RANKS[i+1]; return {i,name:Lx(RANKS[i][1]),xp,next:next?next[0]:null,nextName:next?Lx(next[1]):null,base:RANKS[i][0],pct:next?(xp-RANKS[i][0])/(next[0]-RANKS[i][0]):1}; }
  let toastEl=null;
  function toast(html){ if(!toastEl){ toastEl=document.createElement('div'); toastEl.className='ntoast'; document.body.appendChild(toastEl); } toastEl.innerHTML=html; toastEl.classList.add('on'); clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>toastEl.classList.remove('on'),3800); }
  const NPROG={ items:ITEMS, ranks:RANKS, load, xpOf, rankOf, Lx,
    award(k,pct){ pct=Math.max(0,Math.min(100,Math.round(pct||0))); const d=load(); const old=d[k]||0; if(pct<=old) return 0;
      const r0=rankOf(xpOf(d)); d[k]=pct; try{ localStorage.setItem(PK,JSON.stringify(d)); }catch(e){} const r1=rankOf(xpOf(d)); const it=ITEMS.find(x=>x.k===k); const gain=it?Math.round(it.xp*(pct-old)/100):0;
      renderRank(); if(false&&gain>0) toast(r1.i>r0.i? `<b>${lang()==='no'?'Ny rang':'New rank'}: ${r1.name}</b><span>+${gain} XP</span>` : `<b>+${gain} XP</b><span>${it?Lx(it.t):''}</span>`);
      document.dispatchEvent(new CustomEvent('nprog')); return gain; },
    export(){ return btoa(unescape(encodeURIComponent(JSON.stringify({v:1,d:load()})))); },
    import(code){ const o=JSON.parse(decodeURIComponent(escape(atob(code.trim())))); if(!o||!o.d) throw new Error('bad'); const d=load(); for(const k in o.d){ const v=+o.d[k]; if(v>(d[k]||0)) d[k]=Math.min(100,v); } localStorage.setItem(PK,JSON.stringify(d)); renderRank(); document.dispatchEvent(new CustomEvent('nprog')); },
    reset(){ try{ localStorage.removeItem(PK); Object.keys(localStorage).filter(k=>/^(aeroson-quiz-|naeroson-radio-)/.test(k)).forEach(k=>localStorage.removeItem(k)); }catch(e){} renderRank(); document.dispatchEvent(new CustomEvent('nprog')); } };
  window.NPROG=NPROG;
  function renderRank(){ const a=head.querySelector('.rank'); if(a) a.remove(); return; const r=rankOf(xpOf(load()));
    a.innerHTML=`<span class="rn">${r.name}</span><span class="rb"><i style="width:${Math.round(r.pct*100)}%"></i></span><span class="rx">${r.xp} XP</span>`;
    a.title=r.next?`${r.next-r.xp} XP ${lang()==='no'?'til':'to'} ${r.nextName}`:''; }
  /* arrow keys, Home and End inside an open menu (account menu, section-nav menus) */
  function menuKeys(e){ if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return; const m=e.currentTarget.closest('.acm,.trnav')?e.target.closest('.acm,.tgm'):null; if(!m) return;
    const it=[...m.querySelectorAll('a,button')].filter(x=>!x.disabled); if(!it.length) return; e.preventDefault(); const i=it.indexOf(document.activeElement);
    it[e.key==='Home'?0:e.key==='End'?it.length-1:(i+(e.key==='ArrowDown'?1:-1)+it.length)%it.length].focus(); }
  /* the page's content is the main landmark: pages built on <div class="page"> get the role here, and the skip link goes to it */
  function landmark(){ let m=document.querySelector('main,[role="main"]'); if(!m){ m=document.querySelector('body>.page'); if(m){ m.setAttribute('role','main'); /* its page head is a plain block, not a second banner */ const hs=()=>m.querySelectorAll('header').forEach(h=>{ if(!h.closest('article,section,aside,nav')&&!h.hasAttribute('role')) h.setAttribute('role','none'); }); hs(); setTimeout(hs,0); } }
    if(m){ if(!m.id) m.id='main'; if(!m.hasAttribute('tabindex')) m.setAttribute('tabindex','-1'); const sk=document.querySelector('a.skip'); if(sk) sk.href='#'+m.id; } }
  const head=document.createElement('header'); head.className='site';
  const foot=document.createElement('footer'); foot.className='sitefoot';
  function render(){
    const keep=head.querySelector('.hright')||Object.assign(document.createElement('div'),{className:'hright'});
    head.innerHTML=`<div class="in"><a class="logo" href="index.html" aria-label="NORDAP · Nordic Aviation Platform">${brand()}</a>
      <button class="menu" aria-expanded="false" aria-controls="sitenav"><i aria-hidden="true"></i>${t('Menu')}</button>
      <nav id="sitenav" aria-label="${t('Main')}"><a href="index.html" class="${page==='index.html'?'on':''}"${page==='index.html'?' aria-current="page"':''}>${t('Home')}</a><a href="lab.html" class="${lab?'on':''}">${t('Virtual Labs')}</a><a href="flows.html" class="${page==='flows.html'?'on':''}"${page==='flows.html'?' aria-current="page"':''}>${t('Flows')}</a><a href="training.html" class="${trn?'on':''}">${t('Training hub')}</a><a href="preflight.html" class="${pln?'on':''}"${page==='preflight.html'?' aria-current="page"':''}>${t('Preflight')}</a><a href="workspace.html" class="nfi${((page==='fi.html'&&!checkMode)||page==='workspace.html')?' on':''}"${page==='workspace.html'?' aria-current="page"':''}>${t('Flight Intelligence')}</a><a href="profile.html" class="mob ${page==='profile.html'?'on':''}">${t('Account')}</a></nav></div>`;
    head.querySelectorAll('nav a').forEach(a=>{ a.dataset.l=a.textContent; });
    head.firstElementChild.appendChild(keep);
    { keep.querySelectorAll('a.mytr').forEach(x=>x.remove());
      if(!keep.querySelector('.acct')) keep.insertAdjacentHTML('afterbegin',`<div class="acct"><button type="button" class="mytr" aria-haspopup="menu" aria-expanded="false"></button><div class="acm" role="menu" hidden></div></div>`);
      keep.querySelectorAll('.myws').forEach(x=>x.remove());
      /* language switch: in the header from the first paint (lab.js wires it and keeps the current one marked) */
      if(!keep.querySelector('.langseg')) keep.insertAdjacentHTML('afterbegin',`<div class="seg langseg" role="group"><button type="button" data-v="en" lang="en" aria-label="EN – English"${HTML.lang==='nb'?'':' class="on"'}>EN</button><button type="button" data-v="no" lang="nb" aria-label="NO – Norsk"${HTML.lang==='nb'?' class="on"':''}>NO</button></div>`);
      { const ls=keep.querySelector('.langseg'); ls.setAttribute('aria-label',t('Language')); ls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.v==='no')===(HTML.lang==='nb')))); }
      const ac=keep.querySelector('.acct'), ab=ac.querySelector('.mytr'), am=ac.querySelector('.acm');
      const user=()=>{ const A=window.BBACCOUNT; if(A&&A.user) return A.user; try{ const m=JSON.parse(localStorage.getItem('birdbird-account')||'null'); return m&&m.signedIn?(m.user||{}):null; }catch(e){ return null; } };
      const paint=()=>{ const u=user(), nm=u&&u.name?String(u.name).trim():'';
        const ini=nm?nm.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase():'';
        const lbl=u?(ini||'•'):t('Sign in'); const uk=String(!!u)+(u&&u.admin?'a':''); if(ab.firstChild&&ab.dataset.l===lbl&&ab.dataset.u===uk) return; ab.dataset.l=lbl; ab.dataset.u=uk;
        ab.classList.toggle('ini',!!u); ab.classList.toggle('on',page==='profile.html'); ab.textContent=lbl;
        const nx=page&&page!=='profile.html'&&page!=='index.html'?'?next='+encodeURIComponent(page+location.search+location.hash):'';
        /* signed in: the two places you use, then sign out (account settings live on the Account page); signed out: one way in */
        am.innerHTML=u?`<p class="who">${nm?nm.replace(/[<>&"]/g,''):t('Account')}</p><a role="menuitem" href="workspace.html">${t('Flight Intelligence')}</a><a role="menuitem" href="profile.html">${t('Account settings')}</a>${u.admin?`<a role="menuitem" href="admin.html">${t('Admin')}</a>`:''}<hr><button type="button" role="menuitem" data-out>${t('Sign out')}</button>`
          :`<a role="menuitem" href="profile.html${nx}#account">${t('Sign in')}</a><a role="menuitem" href="profile.html${nx}#account">${t('Create account')}</a>`; };
      paint(); if(!ac.dataset.w){ ac.dataset.w='1'; document.addEventListener('bb-account',paint);
        const close=()=>{ am.hidden=true; ab.setAttribute('aria-expanded','false'); };
        ab.addEventListener('click',e=>{ e.stopPropagation(); const o=am.hidden; am.hidden=!o; ab.setAttribute('aria-expanded',String(o)); if(o){ const f=am.querySelector('a,button'); if(f) f.focus(); } });
        am.addEventListener('click',async e=>{ const b=e.target.closest('[data-out]'); if(!b) return; b.disabled=true; try{ await window.BBACCOUNT.logout(); }catch(_){ } close(); location.reload(); });
        am.addEventListener('keydown',menuKeys); ab.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'&&am.hidden){ e.preventDefault(); ab.click(); } });
        document.addEventListener('click',e=>{ if(!ac.contains(e.target)) close(); }); document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!am.hidden){ close(); ab.focus(); } }); } }
    if(trn||pln||fih||lab){ let sn=document.querySelector('nav.trnav'); if(!sn){ sn=document.createElement('nav'); sn.className='trnav'; head.insertAdjacentElement('afterend',sn); }
      sn.setAttribute('aria-label',t(trn?'Training hub':fih?'Flight Intelligence':lab?'Virtual Labs':'Preflight'));
      { const isOn=trn?trnOn:fih?fiOn:(h=>h===page||(h==='weather.html'&&(page==='outlook.html'||page==='sun.html'))), TRG=trn?TRG0:fih?FIG:lab?LBG:PLG; const on=h=>isOn(h)?' class="on" aria-current="page"':'';
        sn.innerHTML='<div class="in">'+TRG.map((x,i)=>{ if(Array.isArray(x)) return `<a href="${x[0]}"${on(x[0])}>${t(x[1])}</a>`;
          const act=x.items.some(it=>isOn(it[0])), cur=x.items.find(it=>isOn(it[0]));
          return `<button type="button" class="tg${act?' on':''}" aria-expanded="false" aria-haspopup="true" data-g="${i}">${t(x.g)}${cur?`<span class="cur">${t(cur[1])}</span>`:''}<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg></button>`; }).join('')+'</div>'+
          TRG.map((x,i)=>Array.isArray(x)?'':`<div class="tgm${x.items[0][2]?' sims':''}" data-m="${i}" role="menu" hidden>${x.items.map(it=>it[2]?`<div class="tgr"><a role="menuitem" href="${it[0]}"${isOn(it[0])?' class="on"':''}>${t(it[1])}</a><span class="md"><a href="${it[0]}"${it[0]===page?' class="on"':''}>2D</a><a href="${it[2]}"${it[2]===page?' class="on"':''}>3D<small>beta</small></a></span></div>`:x.items[0][2]?`<div class="tgr"><a role="menuitem" href="${it[0]}"${isOn(it[0])?' class="on"':''}>${t(it[1])}</a><span class="md"><a href="${it[0]}"${it[0]===page?' class="on"':''}>2D</a></span></div>`:`<a role="menuitem" href="${it[0]}"${on(it[0])}>${t(it[1])}</a>`).join('')}</div>`).join('');
        if(!sn.dataset.w){ sn.dataset.w='1'; let open=null;
          const shut=()=>{ if(!open) return; open.b.setAttribute('aria-expanded','false'); open.m.hidden=true; open=null; };
          sn.addEventListener('click',e=>{ const b=e.target.closest('button.tg'); if(!b) return; e.stopPropagation(); const m=sn.querySelector(`.tgm[data-m="${b.dataset.g}"]`), was=open&&open.b===b; shut(); if(was) return;
            const r=b.getBoundingClientRect(); m.hidden=false; const w=m.offsetWidth; m.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px'; m.style.top=(r.bottom+4)+'px'; b.setAttribute('aria-expanded','true'); open={b,m}; const f=m.querySelector('a'); if(f&&e.detail===0) f.focus(); });
          sn.addEventListener('click',e=>{ if(e.target.closest('.tgm a')) setTimeout(shut,0); });
          sn.addEventListener('keydown',e=>{ if(e.target.closest('.tgm')) return menuKeys(e); const b=e.target.closest('button.tg'); if(b&&e.key==='ArrowDown'){ e.preventDefault(); if(!(open&&open.b===b)) b.click(); const f=open&&open.m.querySelector('a'); if(f) f.focus(); } });
          sn.addEventListener('focusout',e=>{ if(open&&e.relatedTarget&&!open.m.contains(e.relatedTarget)&&e.relatedTarget!==open.b) shut(); });
          document.addEventListener('click',e=>{ if(open&&!open.m.contains(e.target)) shut(); }); document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&open){ const b=open.b; shut(); b.focus(); } });
          addEventListener('resize',shut); addEventListener('scroll',shut,{passive:true}); sn.querySelector('.in').addEventListener('scroll',shut,{passive:true}); } } }
    { const sn=document.querySelector('nav.trnav'); if(sn) sn.querySelectorAll('.in>a').forEach(a=>{ a.dataset.l=a.textContent; }); }
    head.querySelector('.menu').onclick=()=>{ const o=head.classList.toggle('open'); head.querySelector('.menu').setAttribute('aria-expanded',o); };
    if(head.classList.contains('open')) head.querySelector('.menu').setAttribute('aria-expanded','true');
    { const sk=document.querySelector('a.skip'); if(sk) sk.textContent=t('Skip to content'); const si=document.querySelector('.nsearch input'); if(si) si.setAttribute('aria-label',t('Search or ask')); }
    foot.innerHTML=`<div class="fb"><a class="logo" href="index.html" aria-label="NORDAP · Nordic Aviation Platform">${brand('lgx-ft')}</a><p>${t('From aviation theory and regulations to interactive training and flight preparation.')}</p><p>${t('Built in Norway by Daniel Nilsson.')}</p><a href="profile.html">${t('Account')}</a><a href="about.html">${t('About')}</a><a href="privacy.html">${t('Privacy')}</a><a href="about.html#contact" data-contactform>${t('Contact')}</a><a href="about.html#contact" data-contactform data-topic="content">${t('Report an error')}</a><a href="sources.html">${t('Data sources')}</a><a href="rules.html">${t('Rules we link to')}</a><a href="models.html">${t('Model profiles')}</a><a href="quality.html">${t('How content is checked')}</a></div>
      <nav aria-label="${t('Footer')} · ${t('Virtual Labs')}"><b>${t('Virtual Labs')}</b><a href="lab.html">${t('Subject areas')}</a><a href="lab.html#all">${t('All topics')}</a><a href="tunnel.html">${t('Wind tunnel')}</a><a href="performance.html">${t('Performance')}</a><a href="jetsystems.html">${t('Aircraft systems')}</a><a href="holding.html">${t('Holding and approach')}</a></nav>
      <nav aria-label="${t('Footer')} · ${t('Flows')}"><b>${t('Flows')}</b><a href="flows.html">${t('Flow trainer')}</a><a href="flows.html#how">${t('How it works')}</a><a href="flows.html#lib">${t('Flow library')}</a></nav>
      <nav aria-label="${t('Footer')} · ${t('Training hub')}"><b>${t('Training hub')}</b>${TRN.map(([h,l])=>`<a href="${h}">${t(l)}</a>`).join('')}</nav>
      <nav aria-label="${t('Footer')} · ${t('Preflight')}"><b>${t('Preflight')}</b>${PLN.map(([h,l])=>`<a href="${h}">${t(l)}</a>`).join('')}</nav>
      <nav aria-label="${t('Footer')} · ${t('Flight Intelligence')}"><b>${t('Flight Intelligence')}</b><a href="workspace.html">${t('Ask a question')}</a><a href="workspace.html#/documents">${t('Your documents')}</a><a href="workspace.html#/notes">${t('Notes')}</a><a href="fi.html#aircraft">${t('Instructor training')}</a><a href="fi.html#easa">${t('EASA rules library')}</a></nav>
      <div class="copy"><span>© 2026 Daniel Nilsson</span><span>${t(TRAIN)}</span></div>`;
    trainNote();
  }
  /* the footer's learning-only line, also where the footer is not seen: a quiet note under the title on the planning and check
     pages below, and (via the CSS variable --bb-train) at the bottom of each printed briefing-pack and kneeboard sheet */
  if(fih) addEventListener('hashchange',()=>{ const sn=document.querySelector('nav.trnav'); if(!sn) return; sn.querySelectorAll('a[href]').forEach(a=>{ const on=fiOn(a.getAttribute('href')); a.classList.toggle('on',on); if(on) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); }); sn.querySelectorAll('button.tg').forEach(b=>{ const m=sn.querySelector(`.tgm[data-m="${b.dataset.g}"]`); const cur=m&&[...m.querySelectorAll('a')].find(a=>fiOn(a.getAttribute('href'))); b.classList.toggle('on',!!cur); const c=b.querySelector('.cur'); if(c) c.remove(); if(cur) b.insertAdjacentHTML('beforeend',''); if(cur){ const sv=b.querySelector('svg'); sv.insertAdjacentHTML('beforebegin',`<span class="cur">${cur.textContent}</span>`); } }); });
  function trainNote(){ const txt=t(page==='prep.html'?PREP:TRAIN); HTML.style.setProperty('--bb-train',JSON.stringify(txt));
    if(!TRAIN_PAGES.includes(page)) return; let n=document.querySelector('p.bbtrain');
    if(!n){ const h=document.querySelector('header.lhead'); if(!h) return; n=document.createElement('p'); n.className='note bbtrain noprint'; const b=h.querySelector('.brand'); if(b) b.appendChild(n); else h.insertAdjacentElement('afterend',n); }
    if(n.textContent!==txt) n.textContent=txt; }
  const TIPS={
    'tunnel.html':{en:'Most training aircraft are built to stall at the wing root first, so the ailerons keep working. Pull the speed back and watch where the red starts on each aircraft.',no:'De fleste skolefly er bygget for å stalle ved vingeroten først, så balanserorene fortsatt virker. Ta farten av og se hvor det røde starter på hvert fly.'},
    'airdata.html':{en:'High to low, look out below. Set a cold day with low pressure and see how much lower you really are over the hill.',no:'Fra høyt til lavt, se deg for. Still inn en kald dag med lavt trykk, og se hvor mye lavere du egentlig er over åsen.'},
    'orientation.html':{en:'In cloud the leans feel completely real. Trust the attitude indicator, even when every part of you disagrees.',no:'I skyene føles «the leans» helt ekte. Stol på kunstig horisont, selv når hele kroppen er uenig.'},
    'holding.html':{en:'Don\u2019t calculate in the air. Picture your heading on the fix and use the 70\u00b0 line. Run the drill until the answer comes before you think.',no:'Ikke regn i lufta. Se for deg kursen din på fiksen og bruk 70\u00b0-linjen. Kjør drillen til svaret kommer før du rekker å tenke.'},
    'cockpit.html':{en:'Start with the ILS mission and let the autopilot fly it. Watch the modes change on the top bar. Then fly it again by hand.',no:'Start med ILS-oppdraget og la autopiloten fly. Følg med på modene som skifter på toppen. Fly den så igjen for hånd.'},
    'planning.html':{en:'Most rejected flight plans are small format errors. Fill in your own trip here first, then copy it into the real form.',no:'De fleste avviste flyplaner skyldes små formatfeil. Fyll inn din egen tur her først, og kopier den så inn i det ekte skjemaet.'},
    'weather.html':{en:'Read the METAR as a picture, not a code: where is the cloud base, which way is the windsock pointing, can I get back in if it gets worse? Then check the TAF for the time you land, not the time you leave.',no:'Les METAR-en som et bilde, ikke en kode: hvor er skybasen, hvilken vei peker vindposen, kommer jeg inn igjen hvis det blir verre? Sjekk så TAF-en for tiden du lander, ikke tiden du drar.'},
    'briefing.html':{en:'A briefing is a plan you say out loud, not a list you recite. Say the numbers you will actually use, and the one thing that is most likely to bite you today.',no:'En briefing er en plan du sier høyt, ikke en liste du ramser opp. Si tallene du faktisk skal bruke, og den ene tingen som mest sannsynlig kan bite deg i dag.'},
    'checkride.html':{en:'Upload the same documents your examiner uses: the AFM, your SOP and the checklist. The best preparation is explaining things out loud until it sounds boring.',no:'Last opp de samme dokumentene som eksaminatoren bruker: AFM, SOP og sjekklisten. Den beste forberedelsen er å forklare ting høyt til det høres kjedelig ut.'},
    'radio.html':{en:'Most pilots know every item. What goes wrong is the order. Fly the whole trip here a few times and the sequence starts to run on its own: flow, checklist, brief, call.',no:'De fleste piloter kan hvert punkt. Det som går galt, er rekkefølgen. Fly hele turen her noen ganger, så begynner rekkefølgen å sitte av seg selv: flow, sjekkliste, briefing, oppkall.'},
    'radio-drills.html':{en:'Read back the things that can bite you: runway, QNH, heading, altitude, squawk. Then your callsign. Say it out loud.',no:'Les tilbake det som kan bite deg: rullebane, QNH, kurs, høyde, squawk. Så kallesignalet. Si det høyt.'}
  };
  function tip(){ return; const T0=TIPS[page]; if(!T0) return; const h=document.querySelector('.lhead')||document.querySelector('header:not(.site)'); if(!h) return; let a=document.querySelector('aside.ntip');
    if(!a){ a=document.createElement('aside'); a.className='ntip'; h.insertAdjacentElement('afterend',a); }
    const no=document.documentElement.lang==='nb'; a.innerHTML=`<span class="nh">${t("Daniel's tip")}</span><p>${no?T0.no:T0.en}</p>`; }
  function mount(){ document.body.insertBefore(head,document.body.firstChild);
    { const sk=document.createElement('a'); sk.className='skip'; sk.href='#main'; sk.textContent=t('Skip to content'); document.body.insertBefore(sk,head);
      sk.addEventListener('click',e=>{ const m=document.getElementById(sk.hash.slice(1)); if(m){ e.preventDefault(); m.focus({preventScroll:true}); m.scrollIntoView({block:'start'}); } }); }
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&head.classList.contains('open')){ head.classList.remove('open'); const mb=head.querySelector('.menu'); mb.setAttribute('aria-expanded','false'); mb.focus(); } });
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',landmark); else landmark();
    render();
    /* the search bar's box is placed here, before first paint, so the page never jumps when search.js arrives and wires it */
    if(page!=='workspace.html'&&!document.querySelector('.nsearch')){ const sb=document.createElement('div'); sb.className='nsearch noprint'; sb.setAttribute('role','search');
      sb.innerHTML='<div class="in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" autocomplete="off" spellcheck="false" aria-label="'+t('Search or ask')+'"><span class="hint"></span></div><div class="res" hidden></div>';
      const sub=document.querySelector('nav.trnav'); (sub&&sub.previousElementSibling===head?sub:head).insertAdjacentElement('afterend',sb); }
    /* its first text is written here too (the same words search.js writes), so the bar is complete in the first paint */
    const sph=()=>{ const sb=document.querySelector('.nsearch'); if(!sb||sb.dataset.w) return; const i=sb.querySelector('input'), h=sb.querySelector('.hint'); if(!i) return;
      i.placeholder= innerWidth<=640? t('Ask or search…') : t('Ask or search anything, e.g. ')+t('crosswind 270/15 rwy 24'); if(h) h.textContent=t('answers right here'); };
    sph(); new MutationObserver(sph).observe(HTML,{attributes:true,attributeFilter:['lang']});
    /* links to the flow trainer from the cockpit pages: <a data-flowlink="b200"> gets its words here, in the page's language */
    const fl=()=>document.querySelectorAll('a[data-flowlink]').forEach(a=>{ a.href='flows.html#ac='+a.dataset.flowlink; a.innerHTML=lang()==='no'?'<b>Flow-trener</b> · tegn flowene for denne cockpiten, se dem spilt av og øv fra hukommelsen, alene eller med en partner →':'<b>Flow trainer</b> · draw the flows for this cockpit, watch them play and practise from memory, alone or with a partner →'; });
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fl); else fl(); new MutationObserver(fl).observe(HTML,{attributes:true,attributeFilter:['lang']});
    /* search.js wires the bar. It is not needed to draw the page, so it is fetched after the page's own scripts (it used to share the line with them) */
    later(()=>{ if(!document.querySelector('script[src^="search.js"]')){ const sj=document.createElement('script'); sj.src='search.js?v=81'; sj.onload=()=>{ const i=document.querySelector('.nsearch input'); if(i&&i.value) i.dispatchEvent(new Event('input')); }; document.head.appendChild(sj); } });
    const addFoot=()=>document.body.appendChild(foot); if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addFoot); else addFoot();
    const tipNow=()=>tip(); if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tipNow); else tipNow();
    later(trainNote);
    new MutationObserver(()=>{ render(); tip(); }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']}); }
  /* after the page's own scripts (DOMContentLoaded): the page is drawn first, then the helpers that are not needed to draw it are fetched */
  const later=f=>{ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',f); else f(); };
  /* Status line under the page heading: one vocabulary on every page. models.html says what each word means and what each
     tool is and is not; the first entry of a row is the anchor there. A page not listed here carries no status line. */
  const STAT={'c172.html':['c172','illus','fict'],'c172-3d.html':['c172','beta','illus','fict'],'cockpit.html':['da42','illus','fict'],'da42-3d.html':['da42','beta','illus','fict'],
    'b200.html':['b200','illus','fict'],'b200-3d.html':['b200','beta','illus','fict'],'typerating.html':['b200','illus'],'flows.html':['flows','ex'],
    'ifr.html':['ifr','illus','fict','nonav'],'radio.html':['g2g','fict','ex','nonav'],'radio-drills.html':['radio','src'],'briefing.html':['briefings','fict','nonav'],
    'prep.html':['pack','own']};
  const STL={beta:'Beta',illus:'Illustrative model',fict:'Fictional training data',nonav:'Not for navigation',src:'Checked against source',own:'Your own data',open:'Open data, not the official AIP',ex:'Examples, not your SOP'};
  function mstat(){ const s=STAT[page]; if(!s) return; const h=document.querySelector('h1:not(.sr)'); if(!h) return;
    let p=document.querySelector('p.mstat'); if(!p){ p=document.createElement('p'); p.className='mstat'; const n=h.nextElementSibling; (n&&n.tagName==='P'?n:h).insertAdjacentElement('afterend',p); }
    p.innerHTML=s.slice(1).map(k=>`<span class="stt ${k}">${t(STL[k])}</span>`).join('')+`<a href="models.html#${s[0]}">${t('What this is, and is not')}</a>`; }
  later(mstat); new MutationObserver(mstat).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  /* accounts and sync (account.js): header state, passkey sign-in, sync of progress and briefing packs. The Account page and Workspace
     draw from the account state, so they fetch it at once; every other page fetches it after its own scripts. */
  if(!/[?&]embed=1/.test(location.search)){ const acc=()=>{ if(!document.querySelector('script[src^="account.js"]')){ const aj=document.createElement('script'); aj.src='account.js?v=11'; document.head.appendChild(aj); } };
    if(page==='profile.html'||page==='workspace.html') acc(); else later(acc); }
  const EMBED=/[?&]embed=1/.test(location.search);
  if(EMBED){ const st=document.createElement('style'); st.textContent='.labnav,.site,.sitefoot,.nsearch,.trnav,.fab{display:none!important} .page{padding-top:6px} .lhead{margin-top:6px}'; document.head.appendChild(st); document.documentElement.classList.add('embed'); }
  else if(document.body) mount(); else document.addEventListener('DOMContentLoaded',mount);
  /* anonymous visit count (functions/_lib/stats.js): a page view, then a heartbeat each minute while the page is in view,
     for 'online now'. No cookie, nothing stored on the device; the server keeps a daily-changing hash, never the IP. */
  if(!EMBED&&/^https:$/.test(location.protocol)&&!/^(localhost|127\.)/.test(location.hostname)){
    const beat=v=>{ try{ fetch('/api/ping',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({p:location.pathname,v})}).catch(()=>{}); }catch(e){} };
    beat(1); let n=0; const iv=setInterval(()=>{ if(document.visibilityState==='visible'){ beat(0); if(++n>=120) clearInterval(iv); } },60000);
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') beat(0); });
  }
})();
