/* Birdbird – the shared shell of the cockpit trainers (C172, DA42, King Air B200; 2D and 3D pages).
   One toolbar (the markup is the same on all six pages), the "…" menu, the Procedures drawer tabs and ONE notification area.
   - Toolbar order: aircraft · 2D/3D · ✈︎ Start · Auto-fly · Procedures · Pause · Restart · [Debrief, only after a flight] · …
     (narrow screens: the two selects shrink first, then Restart shows its icon only; nothing is ever clipped).
   - "…" menu, in this order: look ahead (3D) / outside view (2D), panel area · sound, touch controls, full screen ·
     debrief now, open debrief after landing · controls (the help sheet), performance meter.
   - Pause / Resume, Restart, Procedures, sound and full screen are wired here (chrome()), the same on every page: Restart
     goes back to the chosen ✈︎ Start, with no failures, auto-fly off and the simulator running.
   - Controls: one help sheet (a dialog) with the same three parts on every aircraft: keyboard (the page's own key table),
     touch, mouse.
   - Drawer tabs: Checklist (only the student's own) · Failures · Speeds. A page registers a render function per pane (drawn when shown).
   - Notifications (bottom centre, the page's #pill): one at a time. say() = a short message that fades; step() = the standing
     hint (next checklist item) shown when nothing else is; card() = the small "what to do now" card. A message that comes in
     while the card is up waits (only the newest) until the card goes.
   Nothing here runs per frame: timers only when a message is shown. */
(function(G){
'use strict';
const tr=(en,no)=>({en,no});
const L=x=>(G.LAB&&G.LAB.L)?G.LAB.L(x):(x&&x.en)||x;
/* the one footnote under every cockpit trainer (the page adds its own sentence about where its numbers come from) */
const NOTE_EN="Training aid, not a certified simulator or a substitute for the aircraft's approved documents. No procedures are included: use your school's checklist.",
      NOTE_NO="Treningshjelpemiddel, ikke en sertifisert simulator eller en erstatning for flyets godkjente dokumenter. Ingen prosedyrer følger med: bruk skolens sjekkliste.";
if(G.LAB&&G.LAB.add) G.LAB.add({},{
  '✈︎ Start':'✈︎ Start','Auto-fly':'Autofly','Procedures':'Prosedyrer','Pause':'Pause','Resume':'Fortsett','Debrief':'Debrief','More':'Mer',
  'Checklist':'Sjekkliste','Failures':'Feil','Speeds':'Farter',
  'Restart':'Start på nytt','Outside view':'Utsikt','Look ahead':'Se fremover','Panel area':'Panelområde',
  'Sound':'Lyd','Full screen':'Fullskjerm','Debrief now':'Debrief nå','Open debrief after landing':'Åpne debrief etter landing',
  'Controls':'Kontroller','Touch controls':'Berøringskontroller','Performance meter':'Ytelsesmåler','← Back':'← Tilbake',
  'Rotate your device to landscape to use the cockpit.':'Snu enheten til liggende for å bruke cockpiten.',
  [NOTE_EN]:NOTE_NO
});

const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let PILL=null, stepTxt=null, cur=null /* {kind:'say'|'card'} */, sayT=0, cardT=0, waiting=null, cardAct=null;
function pill(){ return PILL||(PILL=document.getElementById('pill')); }
function paint(html,cls,isHtml,interactive){ const p=pill(); if(!p) return;
  if(isHtml){ if(p._h!==html){ p._h=html; p.innerHTML=html; } } else { p._h=null; if(p.textContent!==html) p.textContent=html; }
  const c='pill show'+(cls?' '+cls:'')+(interactive?' act':''); if(p.className!==c) p.className=c; }
function blank(){ const p=pill(); if(p&&p.className!=='pill') p.className='pill'; }
function showStep(){ if(cur) return; if(stepTxt) paint(stepTxt,'',false,false); else blank(); }
/* a short message: replaces another message, waits behind the card */
function say(t,cls,ms,isHtml){ if(!t) return;
  if(cur&&cur.kind==='card'){ waiting={t,cls,ms,isHtml,at:performance.now()}; return; }
  clearTimeout(sayT); cur={kind:'say'}; paint(t,cls,isHtml,!!isHtml);
  sayT=setTimeout(()=>{ cur=null; showStep(); },ms||(cls==='bad'?4000:2400)); }
function step(t){ stepTxt=t||null; showStep(); }
function card(html,onAct,ms){ clearTimeout(sayT); clearTimeout(cardT); cardAct=onAct||null; cur={kind:'card'}; paint(html,'card',true,true);
  cardT=setTimeout(hideCard,ms||15000); }
function hideCard(){ if(!cur||cur.kind!=='card') return; clearTimeout(cardT); cur=null; cardAct=null;
  const w=waiting; waiting=null; if(w&&performance.now()-w.at<5000) say(w.t,w.cls,w.ms,w.isHtml); else showStep(); if(tipQ) setTimeout(flushTip,400); }
const cardOn=()=>!!(cur&&cur.kind==='card');
/* a one-time tip (first visit), shown when the area is free */
let tipQ=null;
function tip(html,key,ms){ try{ if(key&&localStorage.getItem(key)) return; }catch(e){ return; } tipQ={html,key,ms}; if(!cur) flushTip(); }
function flushTip(){ if(!tipQ||cur) return; const q=tipQ; tipQ=null; try{ if(q.key) localStorage.setItem(q.key,'1'); }catch(e){} say(q.html,'',q.ms||9000,true); }

/* ---------- "…" menu ---------- */
function menu(){ const b=document.getElementById('bMore'), m=document.getElementById('moreMenu'); if(!b||!m||b._sh) return; b._sh=1;
  const set=on=>{ m.hidden=!on; b.setAttribute('aria-expanded',on); };
  // opened from the keyboard (a click with no pointer): focus goes to the first item, and Esc brings it back to the button
  b.addEventListener('click',e=>{ set(m.hidden); e.stopPropagation(); if(!m.hidden&&e.detail===0){ const f=m.querySelector('button:not([hidden]),select'); if(f) f.focus(); } });
  document.addEventListener('click',e=>{ if(!m.hidden&&!e.target.closest('#moreMenu,#bMore')) set(false); });
  // Esc closes the menu and nothing else (the page's own Esc, back to the whole panel, comes after)
  window.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!m.hidden){ set(false); b.focus(); e.stopImmediatePropagation(); e.preventDefault(); } },true);
  // a plain menu command closes the menu; toggles (aria-pressed) and the area picker keep it open
  m.addEventListener('click',e=>{ const x=e.target.closest('button'); if(x&&!x.hasAttribute('aria-pressed')) setTimeout(()=>set(false),0); });
  ['pointerdown','pointerup','dblclick'].forEach(t=>m.addEventListener(t,e=>e.stopPropagation()));
  return {set}; }

/* ---------- drawer tabs ---------- */
const PANES={ck:'tabCk',fl:'tabFl',sp:'tabSp'};
const R={}; let curTab='ck';
function pane(k,render){ R[k]=render; if(k===curTab) draw(k); }
function draw(k){ const box=document.getElementById(PANES[k]); if(box&&R[k]) R[k](box); }
function tab(k){ if(!PANES[k]) return; curTab=k; const d=document.getElementById('drawer'); if(!d) return;
  d.querySelectorAll('.tabs button').forEach(b=>{ const on=b.dataset.t===k; b.classList.toggle('on',on); b.setAttribute('aria-selected',on); b.tabIndex=on?0:-1; });
  for(const t in PANES){ const e=document.getElementById(PANES[t]); if(e) e.hidden=t!==k; } draw(k); }
function tabs(){ const d=document.getElementById('drawer'); if(!d||d._sh) return; d._sh=1;
  const tl=d.querySelector('.tabs'), bs=[...tl.querySelectorAll('button[data-t]')];
  bs.forEach(b=>{ const p=document.getElementById(PANES[b.dataset.t]); b.type='button'; b.id=b.id||'tabB-'+b.dataset.t; b.tabIndex=b.classList.contains('on')?0:-1;
    if(p){ b.setAttribute('aria-controls',p.id); p.setAttribute('role','tabpanel'); p.setAttribute('aria-labelledby',b.id); } });
  tl.addEventListener('click',e=>{ const b=e.target.closest('button[data-t]'); if(b) tab(b.dataset.t); });
  tl.addEventListener('keydown',e=>{ const i=bs.indexOf(document.activeElement); if(i<0) return;
    const j=e.key==='ArrowRight'?(i+1)%bs.length:e.key==='ArrowLeft'?(i+bs.length-1)%bs.length:e.key==='Home'?0:e.key==='End'?bs.length-1:-1;
    if(j<0) return; e.preventDefault(); e.stopPropagation(); tab(bs[j].dataset.t); bs[j].focus(); });
  if(G.LAB&&G.LAB.onLang) G.LAB.onLang(()=>{ if(curTab!=='ck') draw(curTab); }); }

/* ---------- settings in the … menu that every page shares ---------- */
function perfLabel(b){ const on=!!(G.OTW&&G.OTW.hudOn&&G.OTW.hudOn()); b.setAttribute('aria-pressed',on); b.textContent=L(tr('Performance meter','Ytelsesmåler')); }
function settings(){
  const k=document.getElementById('bKeys'); if(k&&!k._sh){ k._sh=1; k.onclick=help; }
  const p=document.getElementById('bPerf'); if(p&&!p._sh){ p._sh=1; perfLabel(p); p.onclick=()=>{ if(G.OTW&&G.OTW.hud) G.OTW.hud(!(G.OTW.hudOn&&G.OTW.hudOn())); perfLabel(p); };
    if(G.LAB&&G.LAB.onLang) G.LAB.onLang(()=>perfLabel(p)); }
}

/* ---------- the controls every page shares: Pause / Resume, Restart, Procedures, sound, full screen ----------
   o: {paused:()=>bool, pause:()=>void (the page's own toggle; it calls sync()), restart:()=>void, sound:()=>bool, setSound:on=>void,
       refit:()=>void (the panel refits after the drawer has moved), wheel:bool (a control wheel on the panel can be dragged)} */
let CH=null;
function chrome(o){ const $=id=>document.getElementById(id), bP=$('bPause'), bR=$('bReset'), bS=$('bSound'), bF=$('bFull'), bD=$('bDrawer'), dr=$('drawer'), root=$('cockpit');
  const sync=()=>{ if(bP){ const t=L(o.paused()?tr('Resume','Fortsett'):tr('Pause','Pause')); if(bP.textContent!==t) bP.textContent=t; }
    if(bS){ bS.textContent=L(tr('Sound','Lyd')); bS.setAttribute('aria-pressed',!!o.sound()); }
    if(bR){ const t=L(tr('Restart','Start på nytt')); bR.title=t; bR.setAttribute('aria-label',t); } };
  const setDrawer=on=>{ if(!dr) return; on=!!on; dr.classList.toggle('open',on); dr.inert=!on; if(bD){ bD.setAttribute('aria-pressed',on); bD.setAttribute('aria-expanded',on); }
    if(o.refit) setTimeout(o.refit,320); };
  if(bP) bP.onclick=()=>o.pause();
  if(bR) bR.onclick=()=>o.restart();
  if(bS) bS.onclick=()=>{ o.setSound(!o.sound()); sync(); };
  if(bF) bF.onclick=()=>{ try{ if(document.fullscreenElement) document.exitFullscreen(); else if(root&&root.requestFullscreen) root.requestFullscreen().catch(()=>say(L(tr('Full screen is blocked here. Open the page in its own tab.','Fullskjerm er blokkert her. Åpne siden i en egen fane.')),'bad',5000)); }catch(e){} };
  if(bD&&dr){ bD.setAttribute('aria-controls','drawer'); bD.onclick=()=>setDrawer(!dr.classList.contains('open')); dr.inert=!dr.classList.contains('open');
    // Esc inside the drawer closes it and gives the focus back to its button
    dr.addEventListener('keydown',e=>{ if(e.key==='Escape'){ setDrawer(false); bD.focus(); e.stopPropagation(); e.preventDefault(); } });
    bD.addEventListener('keydown',e=>{ if(e.key==='Escape'&&dr.classList.contains('open')){ setDrawer(false); e.stopPropagation(); e.preventDefault(); } }); }
  if(G.LAB&&G.LAB.onLang) G.LAB.onLang(sync);
  sync(); CH={o,sync,setDrawer}; return CH; }

/* ---------- Controls: the one help sheet (built when first opened; costs nothing until then) ---------- */
const HT={title:tr('Controls','Kontroller'),close:tr('Close','Lukk'),kb:tr('Keyboard','Tastatur'),touch:tr('Touch','Berøring'),mouse:tr('Mouse','Mus'),
  z2:tr('Tap an area of the panel to zoom to it. Pinch to zoom in and out, drag to move when zoomed. ← Back or a double tap returns to the whole panel.','Trykk på et område av panelet for å zoome inn på det. Knip for å zoome inn og ut, dra for å flytte når du har zoomet. ← Tilbake eller et dobbelttrykk tar deg tilbake til hele panelet.'),
  z3:tr('Drag to look around and pinch to zoom. Tap a part of the panel to look at it; Look ahead in the … menu faces forward again.','Dra for å se deg rundt og knip for å zoome. Trykk på en del av panelet for å se på den; Se fremover i …-menyen ser rett frem igjen.'),
  tf:tr('With Touch controls on (… menu), a drag that starts on bare panel in the left third of the screen flies the aircraft.','Med Berøringskontroller på (…-menyen) flyr du med et drag som starter på bart panel i venstre tredjedel av skjermen.'),
  tr_:tr('A sideways drag in the right third moves the rudder.','Et drag sidelengs i høyre tredjedel beveger sideroret.'),
  t2f:tr('A second finger always zooms; it never moves a control.','En finger nummer to zoomer alltid; den flytter aldri en kontroll.'),
  mc:tr('Click a switch or a button. Scroll on a knob, or drag across it.','Klikk på en bryter eller en knapp. Rull på en knott, eller dra over den.'),
  mz2:tr('Click an area of the panel to zoom to it; ← Back or Esc returns to the whole panel.','Klikk på et område av panelet for å zoome inn på det; ← Tilbake eller Esc tar deg tilbake til hele panelet.'),
  mz3:tr('Drag anywhere that is not a control to look around; scroll to zoom.','Dra hvor som helst utenom en kontroll for å se deg rundt; rull for å zoome.'),
  mw:tr('Drag a control wheel on the panel to fly, or use the pad under “Flight controls” further down the page.','Dra i et ratt på panelet for å fly, eller bruk flaten under «Flykontroller» lenger ned på siden.'),
  mp:tr('Fly with the pad under “Flight controls” further down the page.','Fly med flaten under «Flykontroller» lenger ned på siden.')};
let HD=null;
function help(){ const root=document.getElementById('cockpit'); if(!root) return;
  if(!HD){ HD=document.createElement('dialog'); HD.className='shelp'; HD.id='simHelp'; HD.setAttribute('aria-labelledby','simHelpT'); root.appendChild(HD);
    HD.addEventListener('click',e=>{ if(e.target===HD||e.target.closest('[data-x]')) HD.close(); });
    // the sheet's own Esc: nothing behind it reacts
    HD.addEventListener('keydown',e=>{ if(e.key==='Escape') e.stopPropagation(); });
    HD.addEventListener('close',()=>{ const b=document.getElementById('bMore'); if(b) b.focus(); }); }
  const d3=!!document.body.dataset.d3, kt=document.querySelector('table.keys'), li=a=>'<ul>'+a.map(x=>'<li>'+esc(L(x))+'</li>').join('')+'</ul>';
  const touchL=[d3?HT.z3:HT.z2,HT.tf].concat(TC&&TC.o.rud?[HT.tr_]:[],[HT.t2f]);
  const mouseL=[HT.mc,d3?HT.mz3:HT.mz2,CH&&CH.o.wheel?HT.mw:HT.mp];
  HD.innerHTML=`<div class="hd"><h2 id="simHelpT">${esc(L(HT.title))}</h2><button type="button" class="x" data-x aria-label="${esc(L(HT.close))}">×</button></div>
<div class="bd"><section><h3>${esc(L(HT.kb))}</h3>${kt?'<table class="keys">'+kt.innerHTML+'</table>':''}</section>
<section><h3>${esc(L(HT.touch))}</h3>${li(touchL)}<h3>${esc(L(HT.mouse))}</h3>${li(mouseL)}</section></div>`;
  if(HD.showModal){ if(!HD.open) HD.showModal(); } else HD.setAttribute('open','');
  const x=HD.querySelector('.x'); if(x) x.focus(); }

/* ---------- the drawer panes, the same component for every aircraft ---------- */
const LS=x=>typeof x==='string'?((G.LAB&&G.LAB.T)?G.LAB.T(x):x):L(x);
const TX={now:tr('Fail now','Feil nå'),scen:tr('Scenarios','Scenarier'),spd:tr('Speeds (KIAS)','Farter (KIAS)')};
/* rows: [abbr, label, value] or [label, value] */
function speedsHTML(o){ const rows=o.rows||[];
  return `<div class="sgrp">${esc(L(o.title||TX.spd))}</div>${rows.some(r=>r.length===3)?'<table class="pspd"><colgroup><col class="a"><col><col class="c"></colgroup>':'<table class="lim">'}${rows.map(r=>`<tr>${r.length===3?`<td>${esc(r[0])}</td>`:''}<td>${esc(LS(r[r.length-2]))}</td><td>${esc(LS(r[r.length-1]))}</td></tr>`).join('')}</table>`+
    (o.note?`<p class="pdisc">${esc(L(o.note))}</p>`:''); }
/* now: [{id,t,rs}] (data-fx) = fail on the flight you have; scen: [{k,t,d}] (data-sk) = a set-up flight where the failure comes */
function failHTML(o){ let h='';
  if(o.now&&o.now.length) h+=`<div class="sgrp">${esc(L(TX.now))}</div><div class="fbtns">${o.now.map(x=>`<button type="button" data-fx="${esc(x.id)}"${x.rs?' class="rs"':''}>${esc(L(x.t))}</button>`).join('')}</div>`;
  if(o.scen&&o.scen.length) h+=`<div class="sgrp">${esc(L(TX.scen))}</div><ul class="plist">${o.scen.map(x=>`<li><button type="button" data-sk="${esc(x.k)}"><span><b>${esc(L(x.t))}</b>${x.d?`<small>${esc(L(x.d))}</small>`:''}</span></button></li>`).join('')}</ul>`;
  return h; }

/* ---------- touch controls: invisible until used ----------
   With "Touch controls" on (… menu; default on phones only), a one-finger DRAG that starts on bare panel (not on a control)
   becomes the control wheel / stick under that finger: a ring appears where the finger went down and the stick deflects with it.
   The left third flies the stick; on the B200 the right third is the rudder (sideways only). The middle third stays pan / zoom
   (2D) or look-around (3D), the same on every page.
   A tap still zooms, a second finger cancels it (so a pinch always works), and nothing ever sits over the panel controls.
   o: {stage, emptyAt(e), stick(v|null), rud(v)|null, d3:()=>bool} */
const TKEY='bb-touchctl';
let TC=null;
function touchOn(){ try{ const v=localStorage.getItem(TKEY); if(v) return v==='1'; }catch(e){}
  const mm=q=>!!(G.matchMedia&&G.matchMedia(q).matches); return mm('(pointer:coarse)')&&Math.min(screen.width,screen.height)<=500; }
function zoneOf(o,e){ const r=o.stage.getBoundingClientRect(), f=(e.clientX-r.left)/Math.max(1,r.width);
  return f<0.35?'stick':f>0.65&&o.rud?'rud':null; } // the middle third stays pan / look-around, as in 3D
function touch(o){
  const st=o.stage, OFF='.zback,.more,.pill,.tip,.rot,.d3t,.d3v,.otwmsg,.afban,.efx,button,select,a,input';
  const ring=document.createElement('div'); ring.className='tring'; ring.hidden=true; ring.innerHTML='<i></i>'; st.appendChild(ring); const knob=ring.firstChild;
  const T={on:touchOn(),cand:null,act:null,ids:new Set()};
  const btn=document.getElementById('bTouch');
  const lab=()=>{ if(btn){ btn.setAttribute('aria-pressed',T.on); btn.textContent=L(tr('Touch controls','Berøringskontroller')); } };
  const R=()=>Math.max(50,Math.min(90,st.clientHeight*0.16));
  const shape=v=>{ const a=Math.abs(v), d=0.1, u=a<d?0:(a-d)/(1-d); return Math.sign(v)*(0.3*u+0.7*u*u*u)*0.8; };
  function apply(e){ const a=T.act, rr=R(); let dx=(e.clientX-a.x)/rr, dy=(e.clientY-a.y)/rr;
    if(a.zone==='rud'){ dx=Math.max(-1,Math.min(1,dx)); dy=0; o.rud(Math.abs(dx)<0.06?0:dx); }
    else { const m=Math.hypot(dx,dy); if(m>1){ dx/=m; dy/=m; } o.stick({x:shape(dx),y:shape(dy)}); }
    knob.style.transform=`translate(${(dx*rr).toFixed(1)}px,${(dy*rr).toFixed(1)}px)`; }
  function stop(){ if(T.act){ if(T.act.zone==='rud'){ if(o.rud) o.rud(0); } else o.stick(null); } T.act=null; T.cand=null; if(!ring.hidden) ring.hidden=true; }
  if(btn){ btn.onclick=()=>{ T.on=!T.on; try{ localStorage.setItem(TKEY,T.on?'1':'0'); }catch(e){} stop(); lab(); }; lab(); if(G.LAB&&G.LAB.onLang) G.LAB.onLang(lab); }
  const isT=e=>e.pointerType==='touch'||e.pointerType==='pen';
  st.addEventListener('pointerdown',e=>{ if(!isT(e)) return; T.ids.add(e.pointerId);
    if(T.ids.size>1){ stop(); return; } // a second finger: a pinch, never the stick
    if(!T.on||!o.emptyAt(e)||e.target.closest(OFF)) return; const z=zoneOf(o,e); if(!z) return;
    T.cand={id:e.pointerId,x:e.clientX,y:e.clientY,zone:z}; },true);
  st.addEventListener('pointermove',e=>{ if(T.act&&e.pointerId===T.act.id){ apply(e); return; }
    const c=T.cand; if(!c||e.pointerId!==c.id||T.ids.size>1) return;
    if(Math.hypot(e.clientX-c.x,e.clientY-c.y)<10) return; // a tap stays a tap (zoom)
    T.act=c; T.cand=null; const b=st.getBoundingClientRect();
    ring.className='tring'+(c.zone==='rud'?' rud':''); ring.style.left=(c.x-b.left)+'px'; ring.style.top=(c.y-b.top)+'px'; ring.style.setProperty('--r',R()+'px'); ring.hidden=false; apply(e); },{passive:true});
  const up=e=>{ T.ids.delete(e.pointerId); if((T.act&&T.act.id===e.pointerId)||(T.cand&&T.cand.id===e.pointerId)) stop(); };
  st.addEventListener('pointerup',up,true); st.addEventListener('pointercancel',up,true);
  TC={o,T};
  return {get on(){ return T.on; },get active(){ return !!T.act; }};
}
/* the 3D look-around asks this: a touch in a stick / rudder zone belongs to the touch controls */
function touchOwns(e){ if(!TC||!TC.T.on||!(e.pointerType==='touch'||e.pointerType==='pen')) return false; return !!zoneOf(TC.o,e); }

/* names of the shell's own controls for screen readers, in the page language (lab.js translates text, not labels) */
const AL=[['.ctop','Cockpit tools','Cockpitverktøy'],['#acSel','Aircraft','Fly'],['.ctop .dseg','View','Visning'],['#bMore','More','Mer'],['#moreMenu','Settings','Innstillinger'],
  ['#zoomSel','Panel area','Panelområde'],['#otw','View out of the window','Utsikt gjennom frontruta'],['#drawer','Procedures','Prosedyrer'],['#drawer .tabs','Procedures','Prosedyrer']];
function labels(){ const c=document.getElementById('cockpit'); if(!c) return; for(const [q,en,no] of AL){ const e=c.querySelector(q); if(e) e.setAttribute('aria-label',L(tr(en,no))); } }
function init(){ menu(); tabs(); settings(); labels(); if(G.LAB&&G.LAB.onLang) G.LAB.onLang(labels); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();

/* the card's buttons */
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('#pill.card button[data-a]'); if(!b) return; e.stopPropagation(); const f=cardAct; hideCard(); if(f) f(b.dataset.a); },true);

G.SIMSHELL={say,step,card,hideCard,cardOn,tip,tab,pane,draw:k=>draw(k||curTab),get curTab(){ return curTab; },init,chrome,help,touch,touchOwns,speedsHTML,failHTML,esc,NOTE:tr(NOTE_EN,NOTE_NO)};
})(window);
