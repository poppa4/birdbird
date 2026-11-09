/* Birdbird – toppmeny og bunntekst på alle sider. Følger sidens språk (html lang). */
(function(){
  'use strict';
  const NO={'Home':'Hjem','Virtual Lab':'Virtual Lab','Virtual Labs':'Virtual Labs','Simulators':'Simulatorer','Weather':'Vær','METAR and TAF':'METAR og TAF','About':'Om','soon':'snart','Open the lab':'Åpne labben','Menu':'Meny',
    'Interactive aviation training, built by pilots.':'Interaktiv flyopplæring, laget av piloter.','Lab':'Lab','Wind tunnel':'Vindtunnel','Propeller effects':'Propelleffekter','CG and stability':'CG og stabilitet','Pressure & altitude':'Trykk og høyde','Spatial orientation':'Romlig orientering','Holding':'Holding','Pitot-static':'Pitot-statisk','All labs':'Alle labber','Learning path':'Læringsløp','Subject areas':'Fagområder','All topics':'Alle emner','Performance':'Ytelse','Jet transport systems':'Systemer på jetfly','Autoflight':'Autoflight','Type rating trainer':'Typeratingtrener','Weather and fronts':'Vær og fronter','Clouds and fog':'Skyer og tåke','Thunderstorms':'Tordenvær','Weather hazards':'Værfarer','Instrument approach':'Instrumentinnflyging','Radio navigation':'Radionavigasjon','GNSS and RNAV':'GNSS og RNAV',
    'Coming':'Kommer','Check preparation':'Kontrollforberedelse','My page':'Min side','My training':'Min trening','For flight schools':'For flyskoler','Privacy':'Personvern','Data sources':'Datakilder','A320 sim assessment':'A320 simulatortest','Aviation training':'Flyopplæring','Train':'Tren','Simulator':'Simulator','Flight planning':'Flyplanlegging','Radio':'Radio','G1000 trainer':'G1000-trener','Glass cockpit trainer':'Glass cockpit-trener','DA42 simulator':'DA42-simulator','AI radio trainer':'AI-radiotrener','Ranks':'Rangering','Flight training':'Flytrening','Your documents':'Dine dokumenter','Topics to revise':'Emner å repetere','Procedures':'Prosedyrer','Training':'Trening','Type rating':'Typerating','Ask the instructor':'Spør instruktøren','Your progress':'Din progresjon','More labs':'Flere labber','Interactive theory for pilots: from the first IR lesson to the A320 sim check.':'Interaktiv teori for piloter: fra første IR-time til A320-simulatorsjekken.','Briefing pack':'Briefingpakke','Route Explorer':'Route Explorer','Navigation log':'Navigasjonslogg','Kneeboard sheets':'Kneeboard-ark','VFR and IFR essentials':'Det viktigste i VFR og IFR','Plan':'Planlegg','Gate to gate':'Gate to gate','Briefings':'Briefinger','Radio drills':'Radiodriller','Checkride prep':'Checkride-forberedelse',
    'Birdbird':'Birdbird','About me':'Om meg','Made by Daniel Nilsson, pilot, for everyone learning to fly.':'Laget av Daniel Nilsson, pilot, for alle som lærer å fly.',"Daniel's tip":'Daniels tips','Your rank and progress':'Din rang og progresjon','Progress':'Progresjon','Training material only. Always follow the AIP, the flight manual and your operator’s procedures.':'Kun opplæringsmateriell. Følg alltid AIP, flyhåndboken og operatørens prosedyrer.'};
  const t=s=> document.documentElement.lang==='nb'? (NO[s]||s) : s;
  let page=(location.pathname.split('/').pop()||'index.html').replace(/\?.*/,''); if(!/\.html$/.test(page)) page=page+'.html';
  const lab=['lab.html','forces.html','engines.html','tunnel.html','propeller.html','stability.html','airdata.html','orientation.html','holding.html','pressure.html','fronts.html','clouds.html','storms.html','hazards.html','wxreports.html','approach.html','radionav.html','gnss.html','performance.html','highspeed.html','massbalance.html','autoflight.html','gyros.html','jetsystems.html','pressurisation.html','gennav.html','flightplanning.html','humanperf.html'].includes(page);
  /* Training hub: one sub-nav, same order everywhere */
  const TRN=[['radio.html','Gate to gate'],['briefing.html','Briefings'],['radio-drills.html','Radio drills'],['cockpit.html','DA42 simulator'],['b200.html','King Air B200'],['simcheck.html','A320 sim assessment'],['typerating.html','Type rating'],['checkride.html','Check preparation']];
  const checkMode=page==='fi.html'&&/[?&]mode=check/.test(location.search);
  const PLN=[['prep.html','Briefing pack'],['essentials.html','VFR and IFR essentials'],['weather.html','METAR and TAF'],['sheets.html','Kneeboard sheets'],['planning.html','Navigation log']];
  const trn=TRN.some(x=>x[0]===page)||checkMode, pln=PLN.some(x=>x[0]===page);
  const trnOn=h=> h===page || (checkMode&&h==='checkride.html');
  /* page-family classes for the design system (set early, before first paint) */
  document.documentElement.classList.add(page==='lab.html'?'vlab-home':(lab?'vlab':'site-page'));
  /* Virtual Labs depth (Short / Deep dive / Instructor) as a body class before first paint; lab.js keeps it in sync */
  if(lab&&page!=='lab.html'&&document.body){ let d='deep'; try{ const v=localStorage.getItem('vlab-depth'); if(v==='short'||v==='instructor') d=v; }catch(e){} document.body.classList.add('depth-'+d); }
  /* favicon (logo mark) */
  if(!document.querySelector('link[rel~="icon"]')){ const fl=document.createElement('link'); fl.rel='icon'; fl.type='image/svg+xml'; fl.href='favicon.svg'; document.head.appendChild(fl); }
  const logo='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12.5" fill="none" stroke="#9A1E68" stroke-width="2.6"/><rect x="14" y="4.5" width="4" height="23" rx="0.6" fill="#13202A"/></svg>';

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
    ['lab','quiz:flightplanning',150,'flightplanning.html#quiz',{en:'Flight planning and fuel test',no:'Test: flyplanlegging og drivstoff'}],
    ['lab','quiz:humanperf',150,'humanperf.html#quiz',{en:'Human performance test',no:'Test: menneskelige faktorer'}],
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
  const head=document.createElement('header'); head.className='site';
  const foot=document.createElement('footer'); foot.className='sitefoot';
  function render(){
    const keep=head.querySelector('.hright')||Object.assign(document.createElement('div'),{className:'hright'});
    head.innerHTML=`<div class="in"><a class="logo" href="index.html" aria-label="Birdbird">${logo}<span>Birdbird</span></a>
      <button class="menu" aria-expanded="false"><i aria-hidden="true"></i>${t('Menu')}</button>
      <nav aria-label="Birdbird"><a href="index.html" class="${page==='index.html'?'on':''}">${t('Home')}</a><a href="lab.html" class="${lab?'on':''}">${t('Virtual Labs')}</a><a href="prep.html" class="${pln?'on':''}">${t('Briefing pack')}</a><a href="route.html" class="${page==='route.html'?'on':''}">${t('Route Explorer')}</a><a href="radio.html" class="${trn?'on':''}">${t('Training')}</a><a href="fi.html" class="${(page==='fi.html'&&!checkMode)?'on':''}">${t('Flight Intelligence')}</a><a href="profile.html" class="mob ${page==='profile.html'?'on':''}">${t('My page')}</a></nav></div>`;
    head.firstElementChild.appendChild(keep);
    if(page!=='index.html'&&page!=='') { if(!keep.querySelector('.mytr')) keep.insertAdjacentHTML('afterbegin',`<a class="mytr ${page==='profile.html'?'on':''}" href="profile.html">${t('My page')}</a>`); else { const m=keep.querySelector('.mytr'); m.textContent=t('My page'); m.classList.toggle('on',page==='profile.html'); } }
    if(trn||pln){ let sn=document.querySelector('nav.trnav'); if(!sn){ sn=document.createElement('nav'); sn.className='trnav'; head.insertAdjacentElement('afterend',sn); }
      sn.setAttribute('aria-label',trn?'Training':'Briefing pack');
      sn.innerHTML='<div class="in">'+(trn?TRN:PLN).map(([h,l])=>`<a href="${h}" class="${(trn?trnOn(h):h===page)?'on':''}"${(trn?trnOn(h):h===page)?' aria-current="page"':''}>${t(l)}</a>`).join('')+'</div>'; }
    head.querySelector('.menu').onclick=()=>{ const o=head.classList.toggle('open'); head.querySelector('.menu').setAttribute('aria-expanded',o); };
    foot.innerHTML=`<div class="fb"><a class="logo" href="index.html">${logo}<span>Birdbird</span></a><p>${t('Interactive theory for pilots: from the first IR lesson to the A320 sim check.')}</p><p>${t('Made by Daniel Nilsson, pilot, for everyone learning to fly.')}</p><a href="profile.html">${t('My page')}</a><a href="about.html">${t('About')}</a><a href="schools.html">${t('For flight schools')}</a><a href="privacy.html">${t('Privacy')}</a><a href="sources.html">${t('Data sources')}</a></div>
      <div><b>${t('Virtual Labs')}</b><a href="lab.html">${t('Subject areas')}</a><a href="lab.html#all">${t('All topics')}</a><a href="tunnel.html">${t('Wind tunnel')}</a><a href="performance.html">${t('Performance')}</a><a href="jetsystems.html">${t('Jet transport systems')}</a><a href="approach.html">${t('Instrument approach')}</a></div>
      <div><b>${t('Briefing pack')}</b><a href="prep.html">${t('Briefing pack')}</a><a href="route.html">${t('Route Explorer')}</a><a href="planning.html">${t('Navigation log')}</a><a href="weather.html">${t('METAR and TAF')}</a><a href="essentials.html">${t('VFR and IFR essentials')}</a><a href="sheets.html">${t('Kneeboard sheets')}</a></div>
      <div><b>${t('Training')}</b>${TRN.map(([h,l])=>`<a href="${h}">${t(l)}</a>`).join('')}</div>
      <div><b>${t('Flight Intelligence')}</b><a href="fi.html">${t('Ask the instructor')}</a><a href="fi.html#docs">${t('Your documents')}</a><a href="fi.html#progress">${t('Topics to revise')}</a></div>
      <div class="copy"><span>© 2026 Daniel Nilsson</span><span>${t('Training material only. Always follow the AIP, the flight manual and your operator’s procedures.')}</span></div>`;
  }
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
  function mount(){ document.body.insertBefore(head,document.body.firstChild); render(); if(!document.querySelector('script[src^="search.js"]')){ const sj=document.createElement('script'); sj.src='search.js?v=31'; document.head.appendChild(sj); }
    const addFoot=()=>document.body.appendChild(foot); if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addFoot); else addFoot();
    const tipNow=()=>tip(); if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tipNow); else tipNow();
    new MutationObserver(()=>{ render(); tip(); }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']}); }
  /* accounts and sync (account.js): header state, passkey sign-in, sync of progress and briefing packs */ if(!/[?&]embed=1/.test(location.search)&&!document.querySelector('script[src^="account.js"]')){ const aj=document.createElement('script'); aj.src='account.js?v=1'; document.head.appendChild(aj); }
  const EMBED=/[?&]embed=1/.test(location.search);
  if(EMBED){ const st=document.createElement('style'); st.textContent='.labnav,.site,.sitefoot,.nsearch,.trnav,.fab{display:none!important} .page{padding-top:6px} .lhead{margin-top:6px}'; document.head.appendChild(st); document.documentElement.classList.add('embed'); }
  else if(document.body) mount(); else document.addEventListener('DOMContentLoaded',mount);
})();
