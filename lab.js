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
    while((n=w.nextNode())){ const t=n.nodeValue.trim(); if(t && (D[t]!==undefined||NO[t]!==undefined) && !n.parentElement.closest('script,style')) nodes.push({n,orig:t,raw:n.nodeValue}); }
    (root||document).querySelectorAll('[aria-label]').forEach(e=>{ const t=e.getAttribute('aria-label'); if(D[t]!==undefined) nodes.push({e,orig:t}); });
  }
  function apply(){
    for(const x of nodes){ if(x.e) x.e.setAttribute('aria-label',T(x.orig)); else x.n.nodeValue=x.raw.replace(x.orig,T(x.orig)); }
    document.documentElement.lang= lang==='en'?'en':'nb';
    document.querySelectorAll('.langseg button').forEach(b=>b.classList.toggle('on',b.dataset.v===lang));
    if(document.body.dataset.title){ const dt=T(document.body.dataset.title); document.title=/Birdbird/.test(dt)?dt:dt+' · Birdbird'; }
  }
  function setLang(l){ lang=l; try{ localStorage.setItem('vlab-lang',l); }catch(e){} apply(); hooks.forEach(f=>f()); }

  // header: lab-navigasjon + språk
  /* Læringsløp: moduler i anbefalt rekkefølge. [fil, sidenøkkel, EN, NO, nivå] nivå: 'la' = småfly (DA42), 'jet' = tall fra A320-undervisningsmodell, 'mix' = A320 + lett tomotors, '' = gjelder alle fly */
  const PATH=[
   {k:'pof',en:'Principles of flight',no:'Aerodynamikk',labs:[['tunnel.html','tunnel','Wind tunnel','Vindtunnel','jet'],['stability.html','stab','Stability, controls and load factor','Stabilitet, ror og lastfaktor','jet'],['propeller.html','prop','Engine failure and minimum control speeds','Motorstans og minste kontrollfarter','mix'],['highspeed.html','hs','High-speed flight and drag','Høyfart og motstand','jet']]},
   {k:'air',en:'Atmosphere and air data',no:'Atmosfære og luftdata',labs:[['altimetry.html','alt','Pressure and altitude','Trykk og høyde',''],['pitot.html','pitot','Pitot-static and unreliable airspeed','Pitot-statisk og upålitelig fart','jet']]},
   {k:'met',en:'Meteorology',no:'Meteorologi',labs:[['clouds.html','clouds','Clouds, stability and fog','Skyer, stabilitet og tåke',''],['fronts.html','fronts','Pressure, fronts and wind','Trykk, fronter og vind',''],['storms.html','storms','Thunderstorms and weather radar','Tordenvær og værradar',''],['hazards.html','hazards','Icing, turbulence and de-icing','Ising, turbulens og avising','']]},
   {k:'sys',en:'Aircraft and engines',no:'Fly og motorer',labs:[['engines.html','engines','The turbofan engine','Turbofanmotoren','jet'],['jetsystems.html','jets','Jet transport systems','Systemer på jetfly','jet'],['pressurisation.html','press','Pressurisation and hypoxia','Trykkabin og hypoksi','jet']]},
   {k:'inst',en:'Instruments and automation',no:'Instrumenter og automatikk',labs:[['gyros.html','gyro','Compass, gyros and ADIRS','Kompass, gyroer og ADIRS','jet'],['autoflight.html','af','Autoflight and warnings','Autoflight og varsling','jet']]},
   {k:'perf',en:'Mass, balance and performance',no:'Masse, balanse og ytelse',labs:[['massbalance.html','mb','Mass and balance','Masse og balanse','jet'],['performance.html','perf','Performance','Ytelse','jet']]},
   {k:'nav',en:'Navigation',no:'Navigasjon',labs:[['gennav.html','gnav','General navigation','Generell navigasjon',''],['radionav.html','radionav','Radio navigation and radar','Radionavigasjon og radar',''],['gnss.html','gnss','GNSS and RNAV','GNSS og RNAV',''],['holding.html','hold','Holding','Holding',''],['approach.html','approach','Instrument approach and ILS','Instrumentinnflyging og ILS','']]},
   {k:'fpl',en:'Flight planning',no:'Flyplanlegging',labs:[['flightplanning.html','fpl','Flight planning and fuel','Flyplanlegging og drivstoff','jet']]},
   {k:'hf',en:'Human performance',no:'Menneskelige faktorer',labs:[['orientation.html','ori','Spatial orientation','Romlig orientering',''],['humanperf.html','hp','Attention, workload, error and fatigue','Oppmerksomhet, arbeidsbelastning, feil og tretthet','']]}];
  const FLAT=PATH.flatMap((m,mi)=>m.labs.map((l,li)=>({m,mi,li,f:l[0],k:l[1],en:l[2],no:l[3],lv:l[4]})));
  const LV={la:{en:'Light twin',no:'Småfly'},jet:{en:'A320 model',no:'A320-modell'},mix:{en:'A320 + light twin',no:'A320 + lett tomotors'},gen:{en:'All aircraft',no:'Alle fly'}};
  let curPage=null;
  const done=k=>{ try{ return parseInt(localStorage.getItem('vlab-done-'+k)||'0',10)||0; }catch(e){ return 0; } };
  const LVX={la:{en:'Light twin',no:'Småfly',c:'lt'},jet:{en:'A320 model',no:'A320-modell',c:'a320'},mix:{en:'A320 + light twin',no:'A320 + lett tomotors',c:'a320'},'':{en:'All aircraft',no:'Alle fly',c:'core'}};
  /* live status chips in the page header get a label (data-label on the chip wins) */
  const STLAB={alt:{en:'Terrain clearance at B',no:'Terrengklaring ved B'},tunnel:{en:'Airflow',no:'Luftstrøm'}};
  const Lx=o=>lang==='en'?o.en:o.no;
  function header(page){
    curPage=page;
    const me=FLAT.find(x=>x.k===page);
    const nav=document.querySelector('.labnav');
    if(nav){
      const draw=()=>{ const i=me?FLAT.indexOf(me):-1, p=i>0?FLAT[i-1]:null, n=i>=0&&i<FLAT.length-1?FLAT[i+1]:null, nm=x=>lang==='en'?x.en:x.no;
        const open=nav.querySelector('.lb-mod.open');
        nav.innerHTML=`<a class="lb-home" href="lab.html">Virtual Lab</a><span class="lb-sep" aria-hidden="true">/</span>`+
          `<div class="lb-mod"><button type="button" class="lb-btn" aria-expanded="false" aria-haspopup="true"><span class="n">${T('Modul')} ${me?me.mi+1:''}</span>${me?`<span class="nm">${Lx(me.m)}</span>`:''}<span class="car" aria-hidden="true"></span></button>`+
          `<div class="lb-menu" role="menu">${PATH.map((m,mi)=>`<div class="lb-g"><b><i>${String(mi+1).padStart(2,'0')}</i><a href="lab.html#${m.k}">${Lx(m)}</a></b>${m.labs.map(l=>`<a href="${l[0]}" class="${l[1]===page?'on':''}"${l[1]===page?' aria-current="page"':''}><span>${lang==='en'?l[2]:l[3]}</span>${done(l[1])>=60?'<i class="d" title="Done"></i>':(l[4]?`<span class="tag ${LVX[l[4]].c}">${Lx(LVX[l[4]])}</span>`:'')}</a>`).join('')}</div>`).join('')}</div></div>`+
          (me?`<span class="lb-cur">${T('Lab')} ${me.li+1} ${T('av')} ${me.m.labs.length}</span>`:'')+
          `<div class="lb-pn">${p?`<a href="${p.f}" title="${nm(p)}" aria-label="${T('Forrige')}: ${nm(p)}">←<span>${nm(p)}</span></a>`:''}${n?`<a class="nx" href="${n.f}" title="${nm(n)}" aria-label="${T('Neste')}: ${nm(n)}"><span>${T('Neste')}: ${nm(n)}</span>→</a>`:''}</div>`;
        if(open) setOpen(true); };
      const setOpen=o=>{ const g=nav.querySelector('.lb-mod'); if(!g) return; g.classList.toggle('open',o); g.querySelector('.lb-btn').setAttribute('aria-expanded',o); const mn=g.querySelector('.lb-menu'), on=mn&&mn.querySelector('a.on'); if(o&&on&&mn.scrollHeight>mn.clientHeight) mn.scrollTop=Math.max(0,on.offsetTop-90); };
      draw(); hooks.push(draw);
      nav.addEventListener('click',e=>{ if(e.target.closest('.lb-btn')){ setOpen(!nav.querySelector('.lb-mod').classList.contains('open')); } });
      document.addEventListener('click',e=>{ if(!nav.contains(e.target)) setOpen(false); });
      document.addEventListener('keydown',e=>{ if(e.key==='Escape') setOpen(false); }); }
    pageHeader(page,me);
    inPageNav();
    pathbar(page);
    const hr=document.querySelector('.hright');
    if(hr && !hr.querySelector('.langseg')) hr.insertAdjacentHTML('afterbegin','<div class="seg langseg" aria-label="Språk"><button data-v="en">EN</button><button data-v="no">NO</button></div>');
    document.querySelectorAll('.langseg').forEach(s=>s.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setLang(b.dataset.v); }));
  }
  /* PageHeader: eyebrow "Virtual Lab · Module N · <module>", H1, lead, meta row (level, sections, progress, live status) */
  function pageHeader(page,me){
    const hd=document.querySelector('.page header.lhead')||document.querySelector('header.lhead'); if(!hd||!me) return;
    const brand=hd.querySelector('.brand')||hd;
    let eb=brand.querySelector('.eyebrow'); if(!eb){ eb=document.createElement('div'); eb.className='eyebrow'; brand.insertBefore(eb,brand.firstChild); }
    eb.classList.add('vl-eb');
    let meta=brand.querySelector('.lmeta'); if(!meta){ meta=document.createElement('div'); meta.className='lmeta'; brand.appendChild(meta); }
    const st=hd.querySelector('.hright .status');
    let stw=null; if(st){ stw=document.createElement('span'); stw.className='mi mst'; stw.innerHTML='<span class="k"></span>'; stw.appendChild(st); }
    const nsec=document.querySelectorAll('.snav a').length;
    const draw=()=>{ const d=done(page), lv=LVX[me.lv]||LVX[''];
      eb.innerHTML=`<a href="lab.html">Virtual Lab</a> · ${T('Modul')} ${me.mi+1} · <a href="lab.html#${me.m.k}">${Lx(me.m)}</a>`;
      const keep=meta.querySelector('.mst'); meta.innerHTML=`<span class="mi"><span class="tag ${lv.c}">${Lx(lv)}</span></span>`+
        (nsec?`<span class="mi"><span class="v">${nsec}</span><span class="k">${lang==='en'?'sections':'seksjoner'}</span></span>`:'')+
        '';
      const w=keep||stw; if(w){ const lab=st&&st.dataset.label?{en:st.dataset.label,no:st.dataset.labelNo||st.dataset.label}:(STLAB[page]||{en:'Simulator',no:'Simulator'}); w.querySelector('.k').textContent=Lx(lab)+':'; meta.appendChild(w); } };
    draw(); hooks.push(draw); document.addEventListener('nprog',draw);
  }
  /* InPageNav: active section + compact "On this page" select on narrow screens */
  function inPageNav(){
    const sn=document.querySelector('.snav'); if(!sn||sn.dataset.ipn) return; sn.dataset.ipn='1';
    const links=[...sn.querySelectorAll('a[href^="#"]')]; if(!links.length) return;
    const wrap=document.createElement('label'); wrap.className='snsel'; wrap.innerHTML='<span></span><select></select>'; sn.appendChild(wrap); sn.classList.add('hassel');
    const sel=wrap.querySelector('select');
    const fill=()=>{ wrap.querySelector('span').textContent=lang==='en'?'On this page':'På denne siden'; const v=sel.value; sel.innerHTML=links.map(a=>`<option value="${a.getAttribute('href')}">${a.textContent.trim()}</option>`).join(''); if(v) sel.value=v; };
    fill(); hooks.push(()=>setTimeout(fill,0));
    sel.addEventListener('change',()=>{ const t=document.querySelector(sel.value); if(t) t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'}); history.replaceState(null,'',sel.value); });
    const secs=links.map(a=>{ try{ return document.querySelector(a.getAttribute('href')); }catch(e){ return null; } });
    const mark=()=>{ const y=sn.getBoundingClientRect().bottom+80; let k=-1; secs.forEach((s,i)=>{ if(s&&s.getBoundingClientRect().top<y) k=i; });
      links.forEach((a,i)=>a.classList.toggle('on',i===k)); if(k>=0&&sel.selectedIndex!==k) sel.selectedIndex=k; };
    let raf=0; addEventListener('scroll',()=>{ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; mark(); }); },{passive:true}); mark();
  }
  // forrige / neste i læringsløpet, nederst på hver lab
  function pathbar(page){
    const i=FLAT.findIndex(x=>x.k===page); if(i<0) return; const secs=document.querySelectorAll('section'); const pg=document.querySelector('.page')||(secs.length&&secs[secs.length-1].parentElement); if(!pg) return;
    let box=document.querySelector('.vlpath'); if(!box){ box=document.createElement('nav'); box.className='vlpath'; box.setAttribute('aria-label','Learning path'); pg.appendChild(box); }
    const draw=()=>{ const c=FLAT[i], p=FLAT[i-1], n=FLAT[i+1], nm=x=>lang==='en'?x.en:x.no;
      const ml=c.m.labs.length;
      box.innerHTML=`<div class="ph"><span>${T('Modul')} ${c.mi+1} · ${Lx(c.m)}</span><span>${T('Lab')} ${c.li+1} ${T('av')} ${ml}</span></div><div class="pr">${p?`<a href="${p.f}"><small>← ${T('Forrige')}</small><b>${nm(p)}</b></a>`:'<a class="x"></a>'}${n?`<a class="nx" href="${n.f}"><small>${n.mi!==c.mi?T('Neste modul')+': '+Lx(n.m):T('Neste')} →</small><b>${nm(n)}</b></a>`:`<a class="nx" href="lab.html"><small>${T('Ferdig')} →</small><b>Virtual Lab</b></a>`}</div><div class="steps" title="${T('Læringsløpet')}">${FLAT.map((x,j)=>`<i class="${j===i?'c':(done(x.k)>=60?'d':'')}"></i>`).join('')}</div>`; };
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

  window.LAB={ PATH, FLAT, LV, done, T, L, nf, el, add(dict,no){ Object.assign(D,dict); if(no) Object.assign(NO,no); }, start(page){ header(page); scan(); apply(); }, head(page){ header(page); const n=document.querySelector('.labnav'); if(n) scan(n); apply(); },
    onLang(f){ hooks.push(f); }, get lang(){ return lang; }, slider, seg, fit, visible, quiz, shuffle };
})();
