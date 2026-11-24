/* NORDAP – A320 checklist panel for the cockpit trainer (a320.html, a320-3d.html): the Checklist tab of the Procedures drawer.
   Two sources, one panel:
   - "Standard": a generic A320 normal checklist in the usual Airbus challenge–response layout, written for NORDAP. Each list says
     when it is read (the trigger) and who answers (PF / PM / both). Items the trainer can see tick themselves the moment the
     control is set; the rest are ticked by a tap. "Show me" turns the view to the control of the next item. Order is never
     enforced. Operators customise their checklists, so the student's own checklist always takes precedence.
   - "My own": the shared own-checklist panel (ownck.js), with the A320 control names in its dictionary.
   Nothing runs per frame: tick() returns at once except four times a second, and then tests only the open list's unticked items. */
(function(G){
'use strict';
const T=(en,no)=>({en,no:no==null?en:no});
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ---------- what the trainer can see: key -> test on the page's state X {A,M,K,UI} ---------- */
const sw=X=>X.A.sw;
const signsOn=X=>sw(X).seatB===2&&sw(X).noSmk===2;
const P={
  seatB:X=>sw(X).seatB===2,
  adirsNav:X=>sw(X).irM1===1&&sw(X).irM2===1&&sw(X).irM3===1,
  park:X=>!!sw(X).park,
  parkOff:X=>!sw(X).park,
  toData:X=>!!(X.K&&X.K.d&&X.K.d.v1&&X.K.d.vr&&X.K.d.v2),
  doors:X=>{ const d=X.A.doors||{}; return !d.fwd&&!d.aft&&!d.cargoF&&!d.cargoA&&!d.fwdL; },
  beacon:X=>sw(X).beacon===1,
  rudTrim0:X=>Math.abs(sw(X).rudTrim||0)<0.05,
  flapsTO:X=>sw(X).flapLv>=1&&sw(X).flapLv<=3,
  toMemo:X=>{ const S=sw(X), E=X.A.ecam; return S.abrk===3&&signsOn(X)&&!!E.cabinReady&&!!S.spArm&&S.flapLv>=1&&S.flapLv<=3&&E.cfgOK!==false; },
  tcasTARA:X=>sw(X).tcas===2,
  baroQnh:X=>!X.UI.efis.std,
  mins:X=>!!(X.K&&X.K.d&&(X.K.d.dh||X.K.d.mda)),
  abrkSet:X=>sw(X).abrk>0,
  ldgMemo:X=>{ const S=sw(X), E=X.A.ecam, fl=S.ldgF3?S.flapLv>=3:S.flapLv===4; return !!X.M.gearDown&&signsOn(X)&&!!E.cabinReady&&!!S.spArm&&fl; },
  flaps0:X=>sw(X).flapLv===0,
  engsOff:X=>!sw(X).mst1&&!sw(X).mst2,
  pumpsOff:X=>{ const S=sw(X); return !S.fL1&&!S.fL2&&!S.fC1&&!S.fC2&&!S.fR1&&!S.fR2; },
  yElecOff:X=>!sw(X).hyY,
  oxyOff:X=>!sw(X).crewOxy,
  emerExitOff:X=>sw(X).emerExit===0,
  batsOff:X=>!sw(X).bat1&&!sw(X).bat2
};
/* the control each key turns to (Show me) */
const CTL={seatB:'SIGNS|SEAT BELTS',adirsNav:'ADIRS|IR MODE 1',park:'PARKING BRK|PARKING BRAKE',parkOff:'PARKING BRK|PARKING BRAKE',toData:'MCDU 1',
  beacon:'EXT LT|BEACON',rudTrim0:'RUD TRIM|RUD TRIM RESET',flapsTO:'FLAPS|FLAPS LEVER',toMemo:'ECAM CONTROL|T.O CONFIG',tcasTARA:'ATC / TCAS|TCAS MODE',
  abrkSet:'LDG GEAR / BRAKES|AUTO BRK LO',ldgMemo:'GEAR LEVER|GEAR LEVER',flaps0:'FLAPS|FLAPS LEVER',engsOff:'ENGINE|ENG MASTER 1',
  pumpsOff:'FUEL|L TK PUMP 1',yElecOff:'HYD|YELLOW ELEC PUMP',oxyOff:'OXYGEN|CREW SUPPLY',emerExitOff:'SIGNS|EMER EXIT LT',batsOff:'ELEC|BAT 1',
  mins:'MCDU 1',baroQnh:null,doors:'ECAM CONTROL|DOOR'};

/* ---------- the standard checklist: [challenge, response, who, key|null] ---------- */
const CK=[
 {id:'prep',t:'COCKPIT PREPARATION',ph:[1],when:T('After the cockpit preparation flows and the FMGS check, with the departure briefing done.','Etter flowene for cockpitforberedelse og FMGS-sjekken, når avgangsbriefingen er gjort.'),it:[
  ['Gear pins and covers','REMOVED','PF',null],['Fuel quantity','___ KG','PF',null],['Seat belts','ON','PF','seatB'],['ADIRS','NAV','PF','adirsNav'],['Baro reference','___','BOTH',null]]},
 {id:'bstart',t:'BEFORE START',ph:[1],when:T('Start-up and push-back clearance received, before-start flows done.','Klarering for oppstart og pushback mottatt, flowene før start gjort.'),it:[
  ['Parking brake','SET','PF','park'],['T.O speeds and thrust','___','BOTH','toData'],['Windows / doors','CLOSED','BOTH','doors'],['Beacon','ON','PF','beacon']]},
 {id:'astart',t:'AFTER START',ph:[2],when:T('Both engines stabilised at idle, after-start flows done.','Begge motorer stabile på tomgang, flowene etter start gjort.'),it:[
  ['Anti-ice','AS RQRD','PF',null],['ECAM status','CHECKED','PF',null],['Pitch trim','___ %','PF',null],['Rudder trim','NEUTRAL','PF','rudTrim0']]},
 {id:'taxi',t:'TAXI',ph:[2],when:T('Clear of the apron with low workload: flight control check and taxi flows done.','Fri av oppstillingsplassen med lav arbeidsmengde: sjekk av flykontroller og taxe-flowene gjort.'),it:[
  ['Flight controls','CHECKED','BOTH',null],['Flaps setting','CONF ___','BOTH','flapsTO'],['Radar and PWS','ON and AUTO','PF',null],['Engine mode selector','AS RQRD','PF',null],['ECAM T.O memo','NO BLUE','PF','toMemo']]},
 {id:'lineup',t:'LINE-UP',ph:[2],when:T('Cleared to line up, line-up flows done.','Klarert til å stille opp på rullebanen, flowene for line-up gjort.'),it:[
  ['T.O runway','___','BOTH',null],['TCAS','TA/RA','PF','tcasTARA'],['Take-off clearance','RECEIVED / NEGATIVE','BOTH',null]]},
 {id:'depchg',t:'DEPARTURE CHANGE',ph:[],when:T('Only when the runway, SID or take-off data change after the before-start checklist.','Bare når rullebane, SID eller startdata endres etter sjekklisten før start.'),it:[
  ['Runway and SID','___ / ___','PF',null],['Flaps setting','CONF ___','BOTH','flapsTO'],['T.O speeds and thrust','___','BOTH','toData'],['FCU altitude','___','PF',null]]},
 {id:'appr',t:'APPROACH',ph:[5,6],when:T('Below the transition level with QNH set, approach briefing done.','Under transisjonsnivå med QNH satt, innflygingsbriefingen gjort.'),it:[
  ['Baro reference','___','BOTH','baroQnh'],['Seat belts','ON','PF','seatB'],['Minimum','___','PF','mins'],['Auto brake','___','PF','abrkSet'],['Engine mode selector','AS RQRD','PF',null]]},
 {id:'ldg',t:'LANDING',ph:[6],when:T('In the landing configuration, once the LDG memo shows (below 2,000 ft RA).','I landingskonfigurasjon, når LDG-memoen vises (under 2 000 ft RA).'),it:[
  ['ECAM LDG memo','NO BLUE','PF','ldgMemo']]},
 {id:'aldg',t:'AFTER LANDING',ph:[8],when:T('Runway vacated, after-landing flows done.','Rullebanen forlatt, flowene etter landing gjort.'),it:[
  ['Flaps','RETRACTED','PF','flaps0'],['Radar and PWS','OFF','PF',null]]},
 {id:'park',t:'PARKING',ph:[9,10],when:T('Parking brake set on the stand, engines shut down.','Parkeringsbremsen satt på oppstillingsplassen, motorene stanset.'),it:[
  ['Park brake or chocks','SET','PF','park'],['Engines','OFF','PF','engsOff'],['Exterior lights','SET','PF',null],['Fuel pumps','OFF','PF','pumpsOff'],['Yellow electric pump','OFF','PF','yElecOff']]},
 {id:'secure',t:'SECURING THE AIRCRAFT',ph:[],when:T('Last flight of the day, before leaving the aircraft.','Siste flyging for dagen, før du forlater flyet.'),it:[
  ['Oxygen','OFF','PF','oxyOff'],['Emergency exit light','OFF','PF','emerExitOff'],['Parking brake','AS RQRD','PF',null],['Batteries','OFF','PF','batsOff']]}
];
const START={cold:'prep',ready:'lineup',air:'appr',appr:'appr',stand:'taxi',climb:'appr',down:'appr'};

const TX={std:T('Standard','Standard'),own:T('My own','Min egen'),
  src:T('Generic A320 normal checklist in the Airbus layout, written by NORDAP for practice. Your operator’s checklist takes precedence: switch to “My own” to use it.','Generell A320-sjekkliste for normale prosedyrer i Airbus-oppsett, skrevet av NORDAP for trening. Operatørens sjekkliste går foran: bytt til «Min egen» for å bruke den.'),
  when:T('When:','Når:'),show:T('Show me','Vis meg'),prev:T('Previous checklist','Forrige sjekkliste'),about:T('About this checklist','Om denne sjekklisten'),autoT:T('Ticks itself when the control is set','Krysses av selv når bryteren står riktig'),next:T('Next checklist','Neste sjekkliste'),done:T('completed','fullført'),
  clear:T('Clear ticks','Fjern kryss'),hint:T('Items marked ● tick themselves when the control is set; tap any item to tick it.','Punkter merket ● krysses av selv når bryteren står riktig; trykk på et punkt for å krysse av.'),
  auto:T('auto','auto'),both:T('both','begge'),list:T('Checklist','Sjekkliste')};

/* the A320 control names for the student's own checklist (ownck.js): the same tests as above */
const OWNDICT=[
  {id:'seatb',kw:/seat ?belt/,st:[[/\bon\b/,'seatB']]},
  {id:'adirs',kw:/adirs|\bir\w* mode|\birs\b/,st:[[/\bnav\b/,'adirsNav']]},
  {id:'park',kw:/park\w* (brake|brk)/,st:[[/releas|\boff\b/,'parkOff'],[/\bset\b|\bon\b/,'park']]},
  {id:'beacon',kw:/beacon/,st:[[/\bon\b/,'beacon']]},
  {id:'rtrim',kw:/rudder trim|rud trim/,st:[[/neutral|zero|\b0\b/,'rudTrim0']]},
  {id:'flaps',kw:/\bflaps?\b/,st:[[/retract|\bup\b|\b0\b|zero/,'flaps0'],[/conf|t\.?\/?o|take-?off|set/,'flapsTO']]},
  {id:'tomemo',kw:/t\.?o\.? memo/,any:'toMemo'},
  {id:'ldgmemo',kw:/ldg memo|landing memo/,any:'ldgMemo'},
  {id:'tcas',kw:/tcas/,st:[[/ta\/?ra/,'tcasTARA']]},
  {id:'abrk',kw:/auto ?br/,any:'abrkSet'},
  {id:'engs',kw:/^engines?\b|eng\w* master/,st:[[/\boff\b/,'engsOff']]},
  {id:'pumps',kw:/fuel pump/,st:[[/\boff\b/,'pumpsOff']]},
  {id:'yelec',kw:/yellow elec/,st:[[/\boff\b/,'yElecOff']]},
  {id:'oxy',kw:/oxygen/,st:[[/\boff\b/,'oxyOff']]},
  {id:'emerx',kw:/emer\w* exit/,st:[[/\boff\b/,'emerExitOff']]},
  {id:'bats',kw:/batter|^bat\b/,st:[[/\boff\b/,'batsOff']]}
];
if(G.OWNCK&&G.OWNCK.DICT) G.OWNCK.DICT.A320=OWNDICT;

const CSS=`
.a3ck .seg{display:flex;gap:3px;margin:2px 0 8px}.a3ck .seg button{flex:1;font:600 12px var(--f-body);padding:7px 4px;border-radius:7px;border:1px solid #333a42;background:#1b2026;color:#dfe5ea;cursor:pointer}
.a3ck .seg button.on{background:#e8edf1;color:#0d1319;border-color:#e8edf1}
.a3ck .src{font-size:11px;color:#8e9aa5;line-height:1.4;margin:0 0 8px;padding:7px 9px;border-radius:8px;background:#141a1f}
.a3ck .nav{display:flex;gap:4px;margin:0 0 8px;align-items:stretch}
.a3ck .nav select{flex:1;min-width:0;font:800 12px var(--f-body);letter-spacing:.04em;padding:7px 8px;border-radius:7px;border:1px solid #333a42;background:#1b2026;color:#fff}
.a3ck .nav button{flex:0 0 32px;font:700 15px/1 var(--f-body);border-radius:7px;border:1px solid #333a42;background:#1b2026;color:#dfe5ea;cursor:pointer}
.a3ck .nav button:disabled{opacity:.35;cursor:default}.a3ck .nav .inf{flex-basis:28px;font:italic 700 13px Georgia,serif;color:#9aa7b2}.a3ck .nav .inf[aria-expanded=true]{background:#e8edf1;color:#0d1319}
.a3ck .card{border:1px solid #2a3139;border-radius:10px;background:#12171c;padding:8px 8px 9px}.a3ck .card.dn{border-color:#245a36}
.a3ck .when{font-size:11.5px;color:#9aa7b2;margin:0 2px 7px;line-height:1.35}.a3ck .when b{color:#7fcbe8;font-weight:700}
.a3ck ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.a3ck li{display:flex;align-items:baseline;gap:6px;padding:6px 6px;border-radius:6px;border:1px solid transparent;cursor:pointer;font:600 12.5px/1.3 var(--f-body);color:#e6ebef}
.a3ck li>i{flex:0 0 14px;height:14px;align-self:center;border-radius:4px;border:1.5px solid #4a5560;font:800 10px/11px var(--f-body);text-align:center;font-style:normal;color:#0d1319;box-sizing:border-box}
.a3ck li .c{flex:0 1 auto;min-width:0}.a3ck li .dt{flex:1 1 12px;min-width:12px;border-bottom:1.5px dotted #4a5560;transform:translateY(-3px)}
.a3ck li .r{flex:0 1 auto;font-weight:800;color:#fff;letter-spacing:.02em;text-align:right;max-width:48%}
.a3ck li .w{flex:0 0 auto;font:700 9px var(--f-body);letter-spacing:.04em;color:#6f7c87;min-width:30px;text-align:right}.a3ck li .w.a{color:#7fcbe8}
.a3ck li.ok>i{background:#3cdc6e;border-color:#3cdc6e}.a3ck li.ok .c,.a3ck li.ok .r{color:#7d8a95}.a3ck li.ok .dt{border-color:#2a3139}
.a3ck li.now{border-color:#7fcbe8;background:#162531}
.a3ck .acts{display:flex;gap:6px;margin-top:8px;align-items:center}.a3ck .acts button{font:600 12px var(--f-body);padding:6px 10px;border-radius:7px;border:1px solid #333a42;background:#1b2026;color:#dfe5ea;cursor:pointer}
.a3ck .acts button.pri{background:#2fd17b;color:#05170c;border-color:#2fd17b;font-weight:700}.a3ck .acts .sp{flex:1}.a3ck .acts .cnt{font:700 11px var(--f-body);color:#8e9aa5}.a3ck .card.dn .cnt{color:#3cdc6e}
.a3ck .ownw[hidden]{display:none}
/* full screen: the checklist slides over the cockpit instead of narrowing it */
#cockpit.a320:fullscreen .cbody>.drawer{position:absolute;right:0;top:0;bottom:0;z-index:12;background:rgba(17,21,26,.94);box-shadow:-10px 0 28px rgba(0,0,0,.4)}
@media (max-height:500px){.a3ck li{padding:4px 5px;font-size:12px}.a3ck .when{margin-bottom:4px;font-size:11px}.a3ck .seg button{padding:5px 4px}}
.ckp .a3ring{position:absolute;pointer-events:none;border:2.5px solid #7fcbe8;border-radius:8px;box-shadow:0 0 0 3px rgba(127,203,232,.25),0 0 18px rgba(127,203,232,.6);z-index:9;animation:a3ring 1.1s ease-in-out 3}
@keyframes a3ring{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.18)}}
@media (prefers-reduced-motion:reduce){.ckp .a3ring{animation:none}}
`;

/* o: {box, L(tr)->string, X (page state getter object), show(ctlId, text), start()->start kind, onOpen()} */
function mount(o){
  const L=o.L, X=o.X, KEY='nordap.a320ck';
  if(!document.getElementById('a3ckcss')){ const s=document.createElement('style'); s.id='a3ckcss'; s.textContent=CSS; document.head.appendChild(s); }
  let pref={src:'std'}; try{ pref=Object.assign(pref,JSON.parse(localStorage.getItem(KEY))||{}); }catch(e){}
  const st={sec:Math.max(0,CK.findIndex(c=>c.id===(START[o.start()]||'prep'))),ticks:{},acc:0,done:{}};
  const root=document.createElement('div'); root.className='a3ck'; o.box.appendChild(root);
  root.innerHTML=`<div class="seg" role="group"><button type="button" data-src="std"></button><button type="button" data-src="own"></button></div><div class="stdw"></div><div class="ownw"><div id="ownck"></div></div>`;
  const stdW=root.querySelector('.stdw'), ownW=root.querySelector('.ownw');
  let OCK=null;
  function ensureOwn(){ if(OCK||!G.OWNCK) return; OCK=G.OWNCK.mount({type:'A320',box:ownW.querySelector('#ownck'),L,pred:k=>P[k]?!!P[k](X):false,ctl:k=>CTL[k]||null,hl:()=>{},clock:()=>X.UI.t}); }
  const kk=(s,i)=>s+':'+i;
  const cur=()=>{ const s=CK[st.sec]; return s?s.it.findIndex((x,i)=>!st.ticks[kk(st.sec,i)]):-1; };
  const showIdx=()=>{ const s=CK[st.sec]; return s?s.it.findIndex((x,i)=>!st.ticks[kk(st.sec,i)]&&x[3]&&CTL[x[3]]):-1; };
  const secDone=si=>CK[si].it.every((x,i)=>st.ticks[kk(si,i)]);
  function draw(){
    root.querySelectorAll('.seg button').forEach(b=>{ b.textContent=L(TX[b.dataset.src]); b.classList.toggle('on',b.dataset.src===pref.src); b.setAttribute('aria-pressed',b.dataset.src===pref.src); });
    stdW.hidden=pref.src!=='std'; ownW.hidden=pref.src!=='own'; if(pref.src==='own'){ ensureOwn(); if(OCK) OCK.render(); return; }
    const s=CK[st.sec], ci=cur(), dn=secDone(st.sec), nx=CK[st.sec+1], pv=CK[st.sec-1];
    const canShow=showIdx()>=0, nOk=s.it.filter((x,i)=>st.ticks[kk(st.sec,i)]).length;
    stdW.innerHTML=`<div class="nav"><button type="button" class="ar" data-mv="-1" aria-label="${esc(L(TX.prev))}"${pv?'':' disabled'}>‹</button>
<select data-secsel aria-label="${esc(L(TX.list))}">${CK.map((c,i)=>`<option value="${i}"${i===st.sec?' selected':''}>${secDone(i)?'✓ ':''}${esc(c.t)}</option>`).join('')}</select>
<button type="button" class="ar" data-mv="1" aria-label="${esc(L(TX.next))}"${nx?'':' disabled'}>›</button><button type="button" class="inf" data-inf aria-expanded="${!!st.inf}" aria-label="${esc(L(TX.about))}">i</button></div>
${st.inf?`<p class="src">${esc(L(TX.src))} ${esc(L(TX.hint))}</p>`:''}
<div class="card${dn?' dn':''}"><p class="when"><b>${esc(L(TX.when))}</b> ${esc(L(s.when))}</p>
<ul>${s.it.map((x,i)=>{ const d=st.ticks[kk(st.sec,i)]; return `<li data-i="${i}" class="${d?'ok':''}${i===ci?' now':''}"><i>${d?'✓':''}</i><span class="c">${esc(x[0])}</span><span class="dt"></span><span class="r">${esc(x[1])}</span><span class="w${x[3]?' a':''}" title="${x[3]?esc(L(TX.autoT)):''}">${x[2]==='BOTH'?'PF/PM':x[2]}${x[3]?' ●':''}</span></li>`; }).join('')}</ul>
<div class="acts"><span class="cnt">${dn?'✓ '+esc(s.t)+' '+esc(L(TX.done)):nOk+' / '+s.it.length}</span><span class="sp"></span>${canShow?`<button type="button" data-show>${esc(L(TX.show))}</button>`:''}${dn&&nx?`<button type="button" class="pri" data-next>${esc(nx.t)} ›</button>`:`<button type="button" data-clr aria-label="${esc(L(TX.clear))}" title="${esc(L(TX.clear))}">↺</button>`}</div></div>`;
  }
  root.addEventListener('click',e=>{ const t=e.target;
    const sb=t.closest('[data-src]'); if(sb){ pref.src=sb.dataset.src; try{ localStorage.setItem(KEY,JSON.stringify(pref)); }catch(x){} draw(); return; }
    const mv=t.closest('[data-mv]'); if(mv){ const n=st.sec+(+mv.dataset.mv); if(CK[n]){ st.sec=n; draw(); } return; }
    if(t.closest('[data-inf]')){ st.inf=!st.inf; draw(); return; }
    const li=t.closest('li[data-i]'); if(li&&stdW.contains(li)){ const k=kk(st.sec,+li.dataset.i); if(st.ticks[k]) delete st.ticks[k]; else st.ticks[k]=1; draw(); return; }
    if(t.closest('[data-show]')){ const x=CK[st.sec].it[showIdx()]; if(x&&CTL[x[3]]) o.show(CTL[x[3]],x[0]+' — '+x[1]); return; }
    if(t.closest('[data-clr]')){ CK[st.sec].it.forEach((x,i)=>delete st.ticks[kk(st.sec,i)]); draw(); return; }
    if(t.closest('[data-next]')){ if(st.sec<CK.length-1){ st.sec++; draw(); } } });
  root.addEventListener('change',e=>{ if(e.target.matches('[data-secsel]')){ st.sec=+e.target.value; draw(); } });
  return {
    tick(dt){ if(pref.src==='own'){ if(OCK) OCK.tick(dt); return; } st.acc+=dt; if(st.acc<0.25) return; st.acc=0;
      const s=CK[st.sec]; let ch=false; s.it.forEach((x,i)=>{ const k=kk(st.sec,i); if(st.ticks[k]||!x[3]) return; let ok=false; try{ ok=!!P[x[3]](X); }catch(e){} if(ok){ st.ticks[k]=1; ch=true; } });
      if(ch) draw(); },
    open(id){ const i=CK.findIndex(c=>c.id===id); if(i>=0&&i!==st.sec){ st.sec=i; draw(); } },
    reset(kind){ st.ticks={}; const i=CK.findIndex(c=>c.id===START[kind]); st.sec=i<0?0:i; if(OCK) OCK.reset(); draw(); },
    render:draw
  };
}
G.A320CK={mount,CK,P,CTL};
})(window);
