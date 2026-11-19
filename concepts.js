/* NORDAP – concepts.js: the "Key concepts" card grid from the wind tunnel, shared by the other labs.
   KCS.render(gridEl, items) with items {k, t, d, dd, ill, click, to, dp}:
   t, d, dd are {en,no}; d is one or two sentences (the first is shown, the rest goes under "More" with dd);
   ill() returns a 200×64 SVG (KCS.sv / KCS.ar / KCS.tx help); click is a CSS selector of a control to press
   (a preset button) or a function; to is the selector of the model to scroll to and highlight.
   dp: true puts the card in .deep (hidden in Short). Same look as tunnel.html's .kc cards.
   Cards are numbered 01, 02 … in order (CSS counter, so hidden deep cards leave no gap): order them basics first.
   see ({en,no}): what to look at in the model; shown in the caption that follows the card into the model (KCS.spot).
   href + hl ({en,no}) instead of click/to: the button links to the place in another lab that shows it (use other.html#kc-<key>).
   An item {grp:{en,no}, sub?:{en,no}} is a full-width group heading inside the ladder; it is not numbered. */
(function(){
'use strict';
if(window.KCS) return;
const css=`
.kcgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(156px,1fr));gap:8px;margin-top:12px;counter-reset:kc}
.kcgrid>.kc{counter-increment:kc}
.kc .kh{display:flex;align-items:baseline;gap:7px;margin-top:2px}
.kc .kn{flex:none;font-family:var(--f-mono);font-size:11px;font-weight:600;color:var(--smoke,#9A1E68);min-width:1.6em;letter-spacing:.02em}
.kc .kn::before{content:counter(kc,decimal-leading-zero)}
.kc .kh h3{margin:0}
.kcgrid>.kgrp{grid-column:1/-1;display:flex;align-items:baseline;gap:10px;margin:12px 0 0;padding-top:10px;border-top:1px solid var(--rule-2,#DCE3E6);font-family:var(--f-mono);font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-2,#4C5B66)}
.kcgrid>.kgrp:first-child{margin-top:2px;padding-top:0;border-top:0}
.kcgrid>.kgrp small{font-family:var(--f-body);font-size:12.5px;font-weight:400;letter-spacing:0;text-transform:none;color:var(--ink-3,#6A7884)}
.kladder{margin:6px 0 0;color:var(--ink-2,#4C5B66);font-size:13px;max-width:80ch}
.kladder b{color:var(--ink,#13202A);font-weight:600}
.kc{background:var(--panel-2,#F6F8F6);border:1px solid var(--line,#C6D0D3);border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:5px;min-width:0}
.kc svg{display:block;width:100%;height:auto;aspect-ratio:200/64;background:#0f161d;border-radius:4px}
.kc h3{font-family:var(--f-display);font-stretch:92%;font-weight:650;font-size:14.5px;margin:2px 0 0;color:var(--fg,#13202A);line-height:1.2}
.kc p{margin:0;font-size:12.5px;color:var(--muted,#4C5B66);line-height:1.45}
.kc p b{color:var(--fg,#13202A);font-weight:600}
.kc .kgo{align-self:flex-start;margin-top:auto;font-family:var(--f-body);font-size:12px;font-weight:600;background:none;border:0;color:var(--smoke,#9A1E68);padding:2px 0;cursor:pointer}
.kc .kgo:hover{text-decoration:underline}
.kc a.kgo{text-decoration:none}
.kc .kmore summary{cursor:pointer;font-size:12px;color:var(--muted,#4C5B66);list-style:none}
.kc .kmore summary::-webkit-details-marker{display:none}
.kc .kmore summary::before{content:"▸ ";color:var(--smoke,#9A1E68)}.kc .kmore[open] summary::before{content:"▾ "}
.kc .kmore p{font-size:12px;color:var(--fg,#13202A);margin:5px 0 0}
.kintro{margin:0;color:var(--muted,#4C5B66);font-size:13px;max-width:80ch}
.kfull{margin-top:14px}
.kfull>summary{cursor:pointer;font-size:13.5px;color:var(--ink-2);width:max-content;list-style:none}
.kfull>summary::-webkit-details-marker{display:none}
.kfull>summary::before{content:"▸ ";color:var(--accent)}.kfull[open]>summary::before{content:"▾ "}
.kfull>summary:hover{color:var(--ink)}
.kfull>div{margin-top:12px}
@keyframes kcflash{0%{box-shadow:0 0 0 0 rgba(255,214,102,.0)}20%{box-shadow:0 0 0 3px rgba(255,214,102,.95)}100%{box-shadow:0 0 0 3px rgba(255,214,102,0)}}
.kc-flash{animation:kcflash 1.8s ease-out 1}
/* the caption that follows a card into the model: which card, and what to look at */
.kc-spot{position:fixed;z-index:60;display:flex;align-items:flex-start;gap:12px;box-sizing:border-box;padding:10px 12px 10px 14px;background:#fff;border:1px solid var(--rule,#C6D0D3);border-left:4px solid var(--accent,#9A1E68);border-radius:0 8px 8px 0;box-shadow:0 8px 28px rgba(16,28,38,.22)}
.kc-spot[hidden]{display:none}
.kc-spot .n{flex:none;font-family:var(--f-mono);font-size:12px;font-weight:600;color:#fff;background:var(--accent,#9A1E68);border-radius:4px;padding:3px 6px;margin-top:1px}
.kc-spot .tx{min-width:0;flex:1}
.kc-spot .k{display:block;font-family:var(--f-mono);font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3,#6A7884)}
.kc-spot b.t{display:block;font-family:var(--f-display);font-stretch:92%;font-weight:700;font-size:16px;line-height:1.25;color:var(--ink,#13202A);margin:1px 0 2px}
.kc-spot p{margin:0;font-size:14px;line-height:1.45;color:var(--ink,#13202A)}
.kc-spot p b{font-weight:600}
.kc-spot .x{flex:none;background:none;border:0;font-size:20px;line-height:1;color:var(--ink-2,#4C5B66);cursor:pointer;padding:2px 6px;min-width:32px;min-height:32px}
.kc-spot .x:hover{color:var(--ink,#13202A)}
@keyframes kcspot{0%{transform:translateY(-6px);opacity:0}100%{transform:none;opacity:1}}
.kc-spot.in{animation:kcspot .22s ease-out 1}
@media (max-width:640px){.kc-spot{padding:8px 8px 8px 10px;gap:8px}.kc-spot b.t{font-size:15px}.kc-spot p{font-size:13.5px}}
@media (prefers-reduced-motion:reduce){.kc-spot.in{animation:none}}
/* the ring a card puts round its item in the model (a label the model itself drew) */
.kc-ring{position:absolute;z-index:40;box-sizing:border-box;pointer-events:none;border:2px solid #FFD666;border-radius:9px;box-shadow:0 0 0 3px rgba(255,214,102,.28),0 0 14px 2px rgba(255,214,102,.45)}
.kc-ring[hidden]{display:none}
@keyframes kcring{0%,100%{box-shadow:0 0 0 3px rgba(255,214,102,.28),0 0 14px 2px rgba(255,214,102,.45)}50%{box-shadow:0 0 0 7px rgba(255,214,102,.14),0 0 22px 4px rgba(255,214,102,.6)}}
.kc-ring{animation:kcring 1.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.kc-ring{animation:none}}
`;
const sty=document.createElement('style'); sty.textContent=css; document.head.appendChild(sty);
const L=o=>window.LAB?LAB.L(o):o.en;
/* the card shows one short sentence; the rest goes under "More". A first sentence over about 26 words is cut at its first semicolon. */
const split=s=>{ const i=s.search(/\.\s/); let a=i>0&&i<s.length-2?s.slice(0,i+1):s, b=i>0&&i<s.length-2?s.slice(i+2):'';
  if(a.replace(/<[^>]+>/g,'').split(/\s+/).length>26){ const j=a.indexOf('; '); if(j>20){ const r=a.slice(j+2); b=r.charAt(0).toUpperCase()+r.slice(1)+(b?' '+b:''); a=a.slice(0,j)+'.'; } }
  return [a,b]; };
/* SVG helpers (same vocabulary as the tunnel's illustrations) */
const sv=b=>`<svg viewBox="0 0 200 64" aria-hidden="true">${b}</svg>`;
const tx=(x,y,s,c,a,sz)=>`<text x="${x}" y="${y}" fill="${c||'#c9d2da'}" font-size="${sz||8}" font-family="IBM Plex Mono, monospace" text-anchor="${a||'start'}">${s}</text>`;
const ar=(x1,y1,x2,y2,c,w)=>{ const a=Math.atan2(y2-y1,x2-x1), h=5; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w||1.6}"/><path d="M${x2},${y2} L${(x2-h*Math.cos(a-0.45)).toFixed(1)},${(y2-h*Math.sin(a-0.45)).toFixed(1)} L${(x2-h*Math.cos(a+0.45)).toFixed(1)},${(y2-h*Math.sin(a+0.45)).toFixed(1)} Z" fill="${c}"/>`; };
function render(grid,items){
  if(!grid) return;
  const draw=()=>{ grid.innerHTML=items.map(it=>{ if(it.grp) return `<div class="kgrp${it.dp?' deep':''}" role="presentation">${L(it.grp)}${it.sub?` <small>${L(it.sub)}</small>`:''}</div>`; const [a,b]=split(L(it.d));
    return `<div class="kc${it.dp?' deep':''}">${it.ill?it.ill():''}<div class="kh"><span class="kn" aria-hidden="true"></span><h3>${L(it.t)}</h3></div><p>${a}</p>${b||it.dd?`<details class="deep kmore"><summary>${L({en:'More',no:'Mer'})}</summary>${b?`<p>${b}</p>`:''}${it.dd?`<p>${L(it.dd)}</p>`:''}</details>`:''}${it.href?`<a class="kgo" href="${it.href}">${L(it.hl)} →</a>`:it.click||it.to?`<button class="kgo" type="button" data-k="${it.k}">${L({en:'Show in the model →',no:'Vis i modellen →'})}</button>`:''}</div>`; }).join(''); };
  grid.classList.add('kcgrid'); draw(); if(window.LAB) LAB.onLang(draw);
  ladder(grid);
  /* a link like lab.html#kc-<key> (from another lab's card) opens that card's place in this model */
  const m=/^#kc-([\w-]+)$/.exec(location.hash); if(m){ const go=()=>{ const b=grid.querySelector(`.kgo[data-k="${m[1]}"]`); if(b) b.click(); }; setTimeout(go,400); }
  grid.addEventListener('click',e=>{ const b=e.target.closest('.kgo'); if(!b) return; const it=items.find(x=>x.k===b.dataset.k); if(!it) return;
    if(typeof it.click==='function') it.click(); else if(it.click){ const c=document.querySelector(it.click); if(c) c.click(); }
    const t=it.to?document.querySelector(it.to):null; { const sx=it.see||seeOf(it.k); spot(b.closest('.kc'),t?(t.closest('.view')||t):null,sx?L(sx):'',it); } if(!t) return;
    const tg=t.closest('.view')||t; tg.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:tg.getBoundingClientRect().height>innerHeight-120?'start':'center'}); /* a model taller than the screen: show its top (tabs) below the sticky step bar */
    tg.classList.remove('kc-flash'); void tg.offsetWidth; tg.classList.add('kc-flash'); });
}
/* What to look at in the model, for cards that open the same picture as another card (key: page file, card key).
   A card may also carry its own see:{en,no}. Without either, the caption repeats the card's first sentence. */
const SEE={
 forces:{lift:{en:'Find the arrow marked <b>L</b>. It stands at right angles to the dashed flight path, not straight up.',no:'Finn pilen merket <b>L</b>. Den står vinkelrett på den stiplede flygebanen, ikke rett opp.'},
  weight:{en:'Find the arrow marked <b>W</b>. It points straight down to the ground, whatever the aircraft does.',no:'Finn pilen merket <b>W</b>. Den peker rett ned mot bakken, uansett hva flyet gjør.'},
  td:{en:'Find <b>T</b> (forwards) and <b>D</b> (backwards) along the flight path. In steady level flight they are the same length.',no:'Finn <b>T</b> (framover) og <b>D</b> (bakover) langs flygebanen. I stabil, vannrett flyging er de like lange.'},
  steady:{en:'Look at the small <b>force polygon</b> at the top right. When it closes, the four forces balance and the flight is steady.',no:'Se på den lille <b>kraftpolygonen</b> øverst til høyre. Når den lukker seg, er de fire kreftene i balanse og flygingen stabil.'},
  glide:{en:'Power is at zero. Read <b>Glide ratio</b> under the picture: it is the same number as lift ÷ drag.',no:'Effekten står på null. Les <b>Glidetall</b> under bildet: det er samme tall som løft ÷ motstand.'},
  gwind:{en:'A 20 kt headwind is set. The glide through the air is unchanged, but the <b>distance over the ground</b> under the picture is shorter.',no:'20 kt motvind er satt. Glidet gjennom luften er uendret, men <b>distansen over bakken</b> under bildet er kortere.'}},
 stability:{cg:{en:'Find the <b>diamond</b> on the chord line under the aircraft: that is the CG. Drag it and watch the tail force change.',no:'Finn <b>diamanten</b> på kordelinjen under flyet: det er CG. Dra den og se halekraften endre seg.'},
  mac:{en:'Look at the <b>scale under the aircraft</b>: 0 % is the leading edge of the mean chord, 100 % the trailing edge. The CG is read on it.',no:'Se på <b>skalaen under flyet</b>: 0 % er forkanten av middelkorden, 100 % bakkanten. CG leses av på den.'},
  tail:{en:'Three arrows: wing lift up, weight down at the CG, and a small <b>tail down-force</b> at the back that balances the two.',no:'Tre piler: vingeløft opp, vekt ned i CG, og en liten <b>nedadrettet halekraft</b> bak som balanserer de to.'}},
 pressure:{height:{en:'The aircraft follows <b>one pressure level</b> (the pink line). Pressure falls about 1 hPa for every 27 ft, so that level lies lower where the pressure is low.',no:'Flyet følger <b>ett trykknivå</b> (den rosa linjen). Trykket faller omtrent 1 hPa for hver 27 ft, så nivået ligger lavere der trykket er lavt.'},
  q:{en:'Compare <b>indicated</b> with <b>true</b> at the destination: with the departure QNH still set, the altimeter reads too high.',no:'Sammenlign <b>indikert</b> med <b>virkelig</b> ved destinasjonen: med avgangens QNH fortsatt satt, viser høydemåleren for høyt.'},
  grad:{en:'Only the <b>pressure gradient force</b> is switched on: the air is pushed straight from high to low, across the isobars.',no:'Bare <b>trykkgradientkraften</b> er slått på: luften skyves rett fra høyt til lavt trykk, på tvers av isobarene.'},
  cor:{en:'<b>Coriolis</b> is added: the moving air is turned to the right (northern hemisphere) until it flows along the isobars.',no:'<b>Coriolis</b> er lagt til: luften i bevegelse dreies mot høyre (nordlige halvkule) til den strømmer langs isobarene.'},
  geo:{en:'The pink arrow at the probe is the <b>geostrophic wind</b>: along the isobars, low pressure on its left, faster where the isobars are closer.',no:'Den rosa pilen ved sonden er den <b>geostrofiske vinden</b>: langs isobarene, lavtrykk til venstre, raskere der isobarene ligger tettere.'}},
 clouds:{dalr:{en:'Follow the <b>rising parcel</b> line from the ground up to the cloud base: on that stretch it cools 3 °C per 1000 ft.',no:'Følg linjen for den <b>stigende luftpakken</b> fra bakken opp til skybasen: på den strekningen kjøles den 3 °C per 1000 ft.'},
  salr:{en:'<b>Above the cloud base</b> the parcel line bends: in cloud it cools more slowly, about 1.8 °C per 1000 ft.',no:'<b>Over skybasen</b> knekker pakkelinjen: i sky kjøles den saktere, omtrent 1,8 °C per 1000 ft.'},
  forms:{en:'Compare the shapes: the <b>heaped</b> clouds (CU, CB) grow upwards, the <b>layer</b> clouds (ST, AS, CS) spread sideways.',no:'Sammenlign formene: <b>haugskyene</b> (CU, CB) vokser oppover, <b>lagskyene</b> (ST, AS, CS) brer seg sidelengs.'},
  lev:{en:'Read the <b>three bands</b>: high above about 20 000 ft, middle 6 500–20 000 ft, low below 6 500 ft.',no:'Les de <b>tre båndene</b>: høye over omtrent 20 000 ft, middels 6 500–20 000 ft, lave under 6 500 ft.'},
  radfog:{en:'Press <b>Run the night</b>: the temperature line sinks to the dew point line, and fog forms around sunrise.',no:'Trykk <b>Kjør natten</b>: temperaturlinjen synker ned til duggpunktlinjen, og tåken dannes rundt soloppgang.'},
  vis:{en:'Read <b>Visibility</b> and <b>Weather</b> in the strip at the top: mist (BR) first, fog (FG) once it is below 1000 m.',no:'Les <b>Sikt</b> og <b>Vær</b> i stripen øverst: tåkedis (BR) først, tåke (FG) når den er under 1000 m.'}},
 hazards:{scw:{en:'The pale blue part of the cloud holds <b>supercooled drops</b>: liquid water that is colder than 0 °C.',no:'Den lyseblå delen av skyen inneholder <b>underkjølte dråper</b>: flytende vann som er kaldere enn 0 °C.'},
  band:{en:'Find the two dashed lines, <b>0 °C and −20 °C</b>. Most icing happens in cloud between them.',no:'Finn de to stiplede linjene, <b>0 °C og −20 °C</b>. Mest ising skjer i sky mellom dem.'},
  clear:{en:'Large drops run back before they freeze: glossy <b>clear ice</b> builds on and behind the leading edge.',no:'Store dråper renner bakover før de fryser: blank <b>klaris</b> bygger seg på og bak forkanten.'},
  where:{en:'The ice starts on the <b>leading edge</b>, the thinnest part, and reaches back past the protected area.',no:'Isen starter på <b>forkanten</b>, den tynneste delen, og når bakover forbi det beskyttede området.'},
  aero:{en:'Compare the <b>two lift curves</b> on the right: with ice the curve peaks lower and earlier, so the wing can stall before the warning.',no:'Sammenlign de <b>to løftkurvene</b> til høyre: med is topper kurven lavere og tidligere, så vingen kan stalle før varselet.'},
  deice:{en:'Read the table <b>Ground de-icing and anti-icing</b>: Type I removes the ice, Type II and IV protect for the holdover time.',no:'Les tabellen <b>Avising og anti-ising på bakken</b>: Type I fjerner isen, Type II og IV beskytter i holdover-tiden.'},
  scale:{en:'Read the table <b>Turbulence intensity</b>: light, moderate, severe and extreme, by what happens in the aircraft.',no:'Les tabellen <b>Turbulensintensitet</b>: lett, moderat, kraftig og ekstrem, etter hva som skjer i flyet.'},
  ttypes:{en:'One section, three kinds: bumps under the <b>cumulus</b>, waves and a rotor behind the <b>ridge</b>, and CAT beside the <b>jet core</b> at the top.',no:'Ett snitt, tre typer: humper under <b>cumulusen</b>, bølger og rotor bak <b>fjellryggen</b>, og CAT ved <b>jetkjernen</b> øverst.'},
  wave:{en:'Behind the ridge the air goes up and down in <b>waves</b>, with lens-shaped clouds on the crests and a <b>rotor</b> underneath.',no:'Bak fjellryggen går luften opp og ned i <b>bølger</b>, med linseformede skyer på toppene og en <b>rotor</b> under.'}},
 gennav:{tmc:{en:'Read down the left column: heading <b>true</b>, <b>magnetic</b> and <b>compass</b>. Each differs from the one above by variation, then deviation.',no:'Les nedover venstre kolonne: kurs <b>sann</b>, <b>magnetisk</b> og <b>kompass</b>. Hver avviker fra den over med variasjon, så deviasjon.'},
  var:{en:'Move the <b>Variation</b> slider: the magnetic heading changes, the true heading does not. East is least, west is best.',no:'Flytt glideren <b>Variasjon</b>: magnetisk kurs endres, sann kurs gjør det ikke. Øst trekkes fra, vest legges til.'},
  gc:{en:'Pink is the <b>great circle</b> (shortest), dashed is the <b>rhumb line</b> (constant track). Read the two distances at the top left.',no:'Rosa er <b>storsirkelen</b> (kortest), stiplet er <b>loksodromen</b> (konstant kurs). Les de to distansene øverst til venstre.'},
  proj:{en:'Switch <b>Globe, Mercator, Lambert, Polar</b> above the chart: on Mercator the rhumb line is straight, on Lambert the great circle nearly is.',no:'Bytt mellom <b>Globe, Mercator, Lambert, Polar</b> over kartet: på Mercator er loksodromen rett, på Lambert er storsirkelen det nesten.'},
  conv:{en:'On the Lambert chart the meridians lean towards each other. Read <b>Convergency</b> at the top left: the great-circle track changes by that much.',no:'På Lambert-kartet heller meridianene mot hverandre. Les <b>Konvergens</b> øverst til venstre: storsirkelkursen endres med så mye.'},
  time:{en:'Count the <b>meridians</b> between the two places: every 15° of longitude is one hour of local time, every degree four minutes.',no:'Tell <b>meridianene</b> mellom de to stedene: hver 15° lengde er én time lokal tid, hver grad fire minutter.'}},
 gnss:{cdi:{en:'Approach phase: read <b>CDI full scale</b> above the map: 0.30 NM here, against 1 NM in terminal and 2 NM en route.',no:'Innflygingsfase: les <b>CDI fullt utslag</b> over kartet: 0,30 NM her, mot 1 NM i terminalområdet og 2 NM underveis.'},
  min:{en:'Under <b>Approach</b> choose LNAV, LNAV/VNAV or LPV and watch the profile gain or lose its glide path.',no:'Under <b>Innflyging</b> velger du LNAV, LNAV/VNAV eller LPV og ser profilen få eller miste glidebanen.'}},
 holding:{ils:{en:'Upper instrument: the <b>localiser</b> needle. Lower instrument: the <b>glide slope</b>. In the profile the aircraft follows the 3° line.',no:'Øvre instrument: <b>localiser</b>-nålen. Nedre instrument: <b>glidebanen</b>. I profilen følger flyet 3°-linjen.'},
  min:{en:'Find the dashed line marked <b>DA</b> in the profile at the bottom: at that altitude you either see the runway or go around.',no:'Finn den stiplede linjen merket <b>DA</b> i profilen nederst: i den høyden ser du enten banen eller går rundt.'},
  cdfa:{en:'In the profile the straight 3° line is the <b>CDFA</b>. Press <b>Compare: step-down descent</b> to see what it replaces.',no:'I profilen er den rette 3°-linjen <b>CDFA</b>. Trykk <b>Sammenlign: trinnvis nedstigning</b> for å se hva den erstatter.'},
  type:{en:'Read <b>Type</b> in the box on the left: 2D or 3D, Type A or B, for the approach that is selected.',no:'Les <b>Type</b> i boksen til venstre: 2D eller 3D, Type A eller B, for innflygingen som er valgt.'}},
 airdata:{press:{en:'Follow the two pipes from the left: the <b>pitot</b> line feeds only the airspeed indicator, the <b>static</b> line feeds all three instruments.',no:'Følg de to rørene fra venstre: <b>pitot</b>-linjen går bare til fartsmåleren, den <b>statiske</b> linjen går til alle tre instrumentene.'},
  vsi:{en:'The right-hand instrument is the <b>VSI</b>. Press <b>Climb +1,000</b> and watch it take a few seconds to settle.',no:'Instrumentet til høyre er <b>variometeret</b>. Trykk <b>Stig +1 000</b> og se at det bruker noen sekunder på å stabilisere seg.'},
  set:{en:'Switch between <b>QNH, QFE and STD 1013</b> on the left and watch what the altimeter reads for the same aircraft.',no:'Bytt mellom <b>QNH, QFE og STD 1013</b> til venstre og se hva høydemåleren viser for det samme flyet.'},
  ta:{en:'<b>STD 1013</b> is set above the transition altitude: the altimeter reads FL 080 while the real altitude is 7,500 ft.',no:'<b>STD 1013</b> er satt over overgangshøyden: høydemåleren viser FL 080 mens den virkelige høyden er 7 500 ft.'},
  spd:{en:'Compare the two bars: <b>IAS</b> is what the instrument shows, <b>TAS</b> is how fast you really move through the air.',no:'Sammenlign de to stolpene: <b>IAS</b> er det instrumentet viser, <b>TAS</b> er hvor fort du faktisk beveger deg gjennom luften.'},
  da:{en:'<b>+25 °C</b> is set. The IAS is the same, but the TAS bar is longer: thin, warm air means a higher density altitude.',no:'<b>+25 °C</b> er satt. IAS er den samme, men TAS-stolpen er lengre: tynn, varm luft gir høyere tetthetshøyde.'}},
 orientation:{eyes:{en:'Switch <b>The pilot flies by</b> between Instruments and Feel: with no outside view, only the instruments tell the truth.',no:'Bytt <b>Piloten flyr etter</b> mellom Instrumenter og Følelse: uten utsyn er det bare instrumentene som forteller sannheten.'},
  canal:{en:'The roll is slower than the canals can feel, so the <b>felt bank</b> stays near level while the real bank grows.',no:'Rullingen er langsommere enn buegangene kan merke, så den <b>følte krengningen</b> holder seg nær null mens den virkelige øker.'},
  leans:{en:'Press <b>Play</b>: after the slow roll the pilot corrects quickly, and the body now feels a bank the other way. That false bank is the leans.',no:'Trykk <b>Spill av</b>: etter den langsomme rullingen retter piloten raskt opp, og kroppen føler nå krengning motsatt vei. Den falske krengningen er «the leans».'}},
 humanperf:{att:{en:'Watch what the pilot is attending to through the flight: <b>one thing at a time</b>. When the tasks pile up, something is dropped.',no:'Se hva piloten har oppmerksomheten på gjennom flygingen: <b>én ting om gangen</b>. Når oppgavene hoper seg opp, faller noe ut.'},
  wl:{en:'Follow the <b>workload line</b> against the <b>capacity line</b>: where workload crosses capacity, things get missed.',no:'Følg <b>arbeidsbelastningen</b> mot <b>kapasitetslinjen</b>: der belastningen krysser kapasiteten, blir ting oversett.'},
  fat:{en:'The <b>alertness curve</b> dips in the early morning and falls with every hour awake. Move Sleep and The duty to see it.',no:'<b>Årvåkenhetskurven</b> dykker tidlig om morgenen og faller for hver time du er våken. Flytt Søvn og Tjenesten for å se det.'},
  alc:{en:'Read the <b>alcohol comparison</b> in the fatigue view: many hours awake impair you as much as a blood alcohol level.',no:'Les <b>alkoholsammenligningen</b> i tretthetsvisningen: mange timer våken svekker deg like mye som en promille.'}},
 gyros:{rlg:{en:'Choose <b>Ring-laser IRS</b> or <b>MEMS AHRS</b> on the left and compare what each one needs and how it drifts.',no:'Velg <b>Ringlaser-IRS</b> eller <b>MEMS AHRS</b> til venstre og sammenlign hva hver trenger og hvordan den driver.'},
  align:{en:'Press <b>Start alignment</b> with the aircraft still, then try it with the aircraft moved: the alignment fails.',no:'Trykk <b>Start oppretting</b> med flyet i ro, og prøv så med flyet flyttet: opprettingen feiler.'}},
 engines:{fan:{en:'The turbofan is selected: most of the air goes <b>round the core</b> through the fan duct and gives most of the thrust.',no:'Turbofanen er valgt: det meste av luften går <b>rundt kjernen</b> gjennom vifteløpet og gir det meste av skyvekraften.'},
  gauges:{en:'Look at the <b>gauges under the engine</b>: green is normal, red is the limit, and each engine type has its own set.',no:'Se på <b>instrumentene under motoren</b>: grønt er normalt, rødt er grensen, og hver motortype har sitt eget sett.'}},
 pressurisation:{cab:{en:'Chart on the right: the <b>aircraft</b> line climbs to cruise while the <b>cabin</b> line stays low, near 6–8,000 ft.',no:'Diagrammet til høyre: linjen for <b>flyet</b> stiger til marsjhøyde mens linjen for <b>kabinen</b> holder seg lavt, rundt 6–8 000 ft.'},
  ovf:{en:'In the fuselage picture, air comes in from the <b>packs</b> and leaves through the <b>outflow valve</b>. How far it is open sets the cabin pressure.',no:'I skrogbildet kommer luften inn fra <b>pakkene</b> og går ut gjennom <b>utstrømningsventilen</b>. Hvor åpen den er, bestemmer kabintrykket.'}},
 flightplanning:{wind:{en:'A headwind is set: the <b>best-range point</b> on the curve moves to a higher speed. With a tailwind it moves lower.',no:'Motvind er satt: punktet for <b>best rekkevidde</b> på kurven flytter seg til høyere fart. Med medvind flytter det seg lavere.'},
  high:{en:'The jet at altitude: read <b>fuel per NM</b>. Thin air gives a higher TAS for the same drag, so every kilo of fuel takes you further.',no:'Jetflyet i høyden: les <b>drivstoff per NM</b>. Tynn luft gir høyere TAS for samme motstand, så hver kilo drivstoff tar deg lenger.'}},
 propeller:{pf:{en:'Right-hand picture, from behind: the <b>descending blade</b> takes the bigger bite, so each engine’s thrust line sits to the right of its centre.',no:'Høyre bilde, sett bakfra: det <b>nedadgående bladet</b> tar det største taket, så hver motors skyvekraftlinje ligger til høyre for midten.'},
  crit:{en:'The left engine has failed. The right engine’s thrust line is the one <b>furthest from the centreline</b>, so the yaw is strongest: the left engine is critical.',no:'Venstre motor har stanset. Høyre motors skyvekraftlinje er den som ligger <b>lengst fra senterlinjen</b>, så giringen er sterkest: venstre motor er kritisk.'}}
};
const PAGE=(location.pathname.split('/').pop()||'').replace(/\.html$/,'');
const seeOf=(k)=>{ const m=SEE[PAGE]; return m&&m[k]?m[k]:null; };
/* ---- In-model highlight ------------------------------------------------------------------------------------
   Every lab model draws its own labels on a canvas. We note where each label lands (a light wrapper round
   fillText), so a card can ring "its" label in the model without the model knowing about cards: the ring follows
   redraws, the language and the screen size, because it always uses the position the model drew last.
   RING[page][cardKey] = the English label, or a list of up to four (the start of the label text; numbers after it may change).
   Where the Norwegian label is not a straight translation, give {en:'…',no:'…'}. A card may instead carry ring:'label' or ring:[...]. No entry = no ring: the caption alone tells the reader what to look at. */
const REC=new WeakMap(); let FRAME=0;
(function tick(){ FRAME++; if(typeof requestAnimationFrame==='function') requestAnimationFrame(tick); })();
if(typeof CanvasRenderingContext2D!=='undefined'&&!CanvasRenderingContext2D.prototype.__kc){
  const P=CanvasRenderingContext2D.prototype, ft=P.fillText, cr=P.clearRect; P.__kc=true;
  P.fillText=function(str,x,y,mw){ try{ const c=this.canvas; if(c&&c.width&&typeof str==='string'&&str.trim().length&&str.length<80&&this.globalAlpha>0.2&&!(typeof this.fillStyle==='string'&&/^rgba\(.*,\s*0?\.[01]\d*\)$/.test(this.fillStyle))){
      let r=REC.get(c); if(!r){ r={f:FRAME,items:[]}; REC.set(c,r); } else if(r.f!==FRAME){ if(FRAME-r.f>1||r.cleared){ /* a later frame: start again */ } r.f=FRAME; r.items=r.items.slice(-400); }
      const m=this.getTransform(), w=this.measureText(str).width, fs=parseFloat((/([\d.]+)px/.exec(this.font)||[0,12])[1]), al=this.textAlign, bl=this.textBaseline;
      const x0=al==='center'?x-w/2:(al==='right'||al==='end')?x-w:x, y0=bl==='middle'?y-fs*.55:bl==='top'||bl==='hanging'?y:bl==='bottom'?y-fs:y-fs*.82;
      const X=m.a*x0+m.c*y0+m.e, Y=m.b*x0+m.d*y0+m.f, Wd=Math.hypot(m.a,m.b)*w, Ht=Math.hypot(m.c,m.d)*fs;
      r.items.push({t:str,x:X,y:Y,w:Wd,h:Ht,f:FRAME}); } }catch(e){}
    return mw===undefined?ft.call(this,str,x,y):ft.call(this,str,x,y,mw); };
  /* a model that paints its labels on an off-screen layer and then copies the layer in: the labels come along */
  const di=P.drawImage; P.drawImage=function(img){ try{ const src=img&&img.tagName==='CANVAS'||(typeof OffscreenCanvas!=='undefined'&&img instanceof OffscreenCanvas)?REC.get(img):null;
      if(src&&src.items.length){ const c=this.canvas, A=arguments, m=this.getTransform(); let sx=0,sy=0,sw=img.width,sh=img.height,dx=A[1],dy=A[2],dw=img.width,dh=img.height;
        if(A.length>=9){ sx=A[1]; sy=A[2]; sw=A[3]; sh=A[4]; dx=A[5]; dy=A[6]; dw=A[7]; dh=A[8]; } else if(A.length>=5){ dw=A[3]; dh=A[4]; }
        let r=REC.get(c); if(!r){ r={f:FRAME,items:[]}; REC.set(c,r); } r.f=FRAME; const kx=dw/sw, ky=dh/sh;
        src.items.slice(-300).forEach(it=>{ const ux=dx+(it.x-sx)*kx, uy=dy+(it.y-sy)*ky; r.items.push({t:it.t,x:m.a*ux+m.c*uy+m.e,y:m.b*ux+m.d*uy+m.f,w:it.w*kx*Math.hypot(m.a,m.b),h:it.h*ky*Math.hypot(m.c,m.d),f:FRAME}); });
        if(r.items.length>900) r.items=r.items.slice(-600); } }catch(e){}
    return di.apply(this,arguments); };
  P.clearRect=function(x,y,w,h){ try{ const c=this.canvas, r=REC.get(c); if(r&&w*h>=c.width*c.height*.2) r.items=[]; }catch(e){} return cr.call(this,x,y,w,h); };
}
const canvasesOf=t=>!t?[]:t.tagName==='CANVAS'?[t]:[...t.querySelectorAll('canvas')].filter(c=>c.offsetParent!==null);
/* the labels a model shows right now (also used by the mapping tool): canvas text, and short DOM labels inside the model */
const cssk=c=>c.clientWidth/c.width;
const domLabels=t=>{ if(!t||t.tagName==='CANVAS') return []; const out=[]; t.querySelectorAll('*').forEach(e=>{ if(e.children.length||e.offsetParent===null) return; if(e.closest('.xpanel,.kcgrid,.tstep,.tryblk,.cpic,details.kfull,.vtabs,.vbar,[role=tablist],.kc-spot')) return; const tx=(e.textContent||'').trim(); if(tx.length<1||tx.length>48) return; out.push(e); }); return out; };
function labels(target){ const out=[]; canvasesOf(target).forEach((c,ci)=>{ const r=REC.get(c); if(!r||!r.items.length) return; const k=cssk(c), seen=new Map(), newest=r.items[r.items.length-1].f; r.items.forEach(it=>{ if(it.f<newest-2) return; seen.set(it.t+'|'+Math.round(it.x/8)+'|'+Math.round(it.y/8),it); }); seen.forEach(it=>out.push({c:ci,t:it.t,x:Math.round(it.x*k),y:Math.round(it.y*k)})); });
  const tb=target&&target.getBoundingClientRect?target.getBoundingClientRect():{left:0,top:0}; domLabels(target).forEach(e=>{ const b=e.getBoundingClientRect(); out.push({c:'dom',t:e.textContent.trim(),x:Math.round(b.left-tb.left),y:Math.round(b.top-tb.top)}); }); return out; }
const norm=t=>String(t).replace(/\s+/g,' ').trim().toLowerCase();
/* a pattern hits a label when the label is that text or starts with it; a one- or two-letter name (L, W, CG) must be followed by a number */
const hits=(t,p)=>t===p||(p.length<=2?new RegExp('^'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' [\\d+\\-−.]').test(t):(t.startsWith(p+' ')||t.startsWith(p+':')||(p.length>=4&&t.startsWith(p))));
/* RING holds the English label. In Norwegian the page has itself translated that label through LAB.L / LAB.T, so we note
   every translation it makes and look the pattern up there: no second list to keep in step. */
const TR=new Map();
if(window.LAB&&!LAB.__kc){ LAB.__kc=true; const oL=LAB.L, oT=LAB.T;
  const note=(no,en)=>{ if(typeof no==='string'&&typeof en==='string'&&no!==en&&no.length<90&&TR.size<6000) TR.set(norm0(no),en); };
  LAB.L=function(o){ const r=oL.apply(this,arguments); try{ if(o&&typeof o==='object'&&'en' in o) note(o.no,o.en); else if(typeof o==='string'&&r!==o) note(r,o); }catch(e){} return r; };
  if(typeof oT==='function') LAB.T=function(x){ const r=oT.apply(this,arguments); try{ if(typeof x==='string'&&r!==x) note(r,x); }catch(e){} return r; }; }
function norm0(t){ return String(t).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
const stem=t=>{ const m=/^[^\d]*/.exec(t), x=(m?m[0]:t).replace(/[\s·:=+−-]+$/,''); return x.length?x:t; };
const altCache=new Map();
function alts(pat){ const p=norm(pat), key=p+'|'+TR.size; if(altCache.has(key)) return altCache.get(key); const out=[p];
  TR.forEach((en,no)=>{ const e=norm0(en); if(e===p) out.push(no); else if(p.length>2&&hits(e,p)){ const st=norm(stem(no)); if(st.length>=3) out.push(st); } });
  altCache.clear(); altCache.set(key,out); return out; }
function findLabel(target,pat){ if(!pat) return null; const ps=alts(pat), hit=t=>ps.some(p=>hits(t,p)), exact=t=>ps.includes(t); let best=null;
  for(const c of canvasesOf(target)){ const r=REC.get(c); if(!r||!r.items.length) continue; const k=cssk(c), newest=r.items[r.items.length-1].f; for(let i=r.items.length-1;i>=0;i--){ const it=r.items[i], t=norm(it.t); if(it.f<newest-2) break;
      if(hit(t)){ const ex=exact(t); if(!best||it.f>best.f||(it.f===best.f&&ex&&!best.ex)){ best={f:it.f,ex,box:()=>{ const bb=c.getBoundingClientRect(), o={x:bb.left+it.x*k,y:bb.top+it.y*k,w:it.w*k,h:it.h*k}; const cx=o.x+o.w/2, cy=o.y+o.h/2; if(cx>0&&cy>0&&cx<innerWidth&&cy<innerHeight){ const top=document.elementFromPoint(cx,cy); if(top&&top!==c&&!top.contains(c)&&!(top.closest&&top.closest('.kc-spot'))) return null; }
          /* nothing readable where the label should be (painted over, or drawn transparent): no ring round an empty spot */
          if(it.v===undefined||FRAME-it.vf>20){ it.vf=FRAME; it.v=true; try{ const g2=c.getContext('2d'); if(g2){ const w=Math.max(4,Math.min(260,Math.round(it.w))), h=Math.max(4,Math.min(40,Math.round(it.h))), d=g2.getImageData(Math.max(0,Math.round(it.x)),Math.max(0,Math.round(it.y)),w,h).data; let lo=765, hi=0; for(let q=0;q<d.length;q+=16){ const v=d[q]+d[q+1]+d[q+2]; if(v<lo) lo=v; if(v>hi) hi=v; } it.v=hi-lo>110; } }catch(e){} }
          if(!it.v) return null; return o; }}; } if(ex) break; } } }
  if(best) return best;
  for(const e of domLabels(target)){ const t=norm(e.textContent); if(hit(t)) return {f:0,ex:exact(t),box:()=>{ const b=e.getBoundingClientRect(); return {x:b.left,y:b.top,w:b.width,h:b.height}; }}; }
  return null; }
let ringEls=[], ringOn=null, ringRaf=0;
function ringStop(){ ringOn=null; ringEls.forEach(e=>{ e.hidden=true; }); if(ringRaf){ cancelAnimationFrame(ringRaf); ringRaf=0; } }
function ringLoop(){ ringRaf=0; if(!ringOn) return;
  ringOn.pats.forEach((pat,i)=>{ let el=ringEls[i]; if(!el){ el=ringEls[i]=document.createElement('div'); el.className='kc-ring'; el.setAttribute('aria-hidden','true'); document.body.appendChild(el); }
    const hit=findLabel(ringOn.target,pat);
    const it=hit?hit.box():null; if(it){ const pad=7; el.hidden=false; el.style.left=(scrollX+it.x-pad)+'px'; el.style.top=(scrollY+it.y-pad)+'px'; el.style.width=(Math.max(it.w,10)+pad*2)+'px'; el.style.height=(Math.max(it.h,10)+pad*2)+'px'; }
    else el.hidden=true; });
  for(let i=ringOn.pats.length;i<ringEls.length;i++) ringEls[i].hidden=true;
  ringRaf=requestAnimationFrame(ringLoop); }
/* ring(target, pattern or [patterns]): ring those labels in the model until ringStop() */
function ring(target,pat){ ringStop(); if(!target||!pat) return; ringOn={target,pats:(Array.isArray(pat)?pat:[pat]).slice(0,4)}; ringRaf=requestAnimationFrame(ringLoop); }
const RING=/*RING*/{"forces":{"lift":"L","weight":"W","td":["T","D"],"steady":"closed: steady","climb":"W·sin γ","vxvy":"Vx","desc":"γ","glide":["L","D"],"gwind":"γ","dcurve":"total drag","turn":"n =","rate1":"r","vsturn":"n ="},"stability":{"static":"α after the gust","cg":"CG","mac":["leading edge","trailing edge"],"tail":"Tail down-force","np":"neutral point","fwd":"forward limit","aft":"aft limit","vn":"VA","gust":"VB","advyaw":"nose yaws","aerobal":"hinge","tabs":"stick force","flutter":"surface CG ahead","law":"THS"},"propeller":{"wing":"relative wind","blade":["β","α"],"fpcs":"β","wm":"α","feather":"β","pf":"↓ descending blade","crit":"DEAD","past":"arm","vmca":"VMCA","dead":"DEAD"},"highspeed":{"drag":"Vmd","stab":"back side","mach":"Mach held","xover":"crossover","mcrit":"Mcrit","shock":"shock wave","sweep":"V cos Λ","tuck":"Mach tuck","buffet":["← low-speed buffet","high-speed buffet"],"coffin":"Coffin corner","upset":"out of stall"},"pressure":{"hpa":"Probe","height":"indicated","hl":["L","H"],"grad":"Pressure gradient","cor":"Coriolis","geo":"wind","fr":"Friction","bb":"low on your left","q":["indicated","true"],"sea":"sea breeze","valley":"Sun-warmed slopes","foehn":"rotor"},"clouds":{"elr":"air around","dalr":{"en":"— dry adiabats","no":"— tørradiabater"},"salr":{"en":"— saturated adiabats","no":"— fuktigadiabater"},"stab":"stable","cond":"conditionally unstable","inv":"air around","dew":"dew point","base":"base","lifts":"parcel","forms":["CU","ST"],"lev":["CI","AC","ST"],"cb":"CB","prec":"NS","radfog":"sunrise","advfog":"warm, moist air","vis":"Visibility"},"fronts":{"am":"warm air","mc":"warm air","wf":"FRONT","cf":"FRONT","oc":"FRONT","sl":"FRONT","pf":"L","ws":"warm sector","jet":"jet core","fz":"below cloud"},"storms":{"ing":"CB ·","cu":"Cumulus humilis","tcu":"TCU","cb":"Cumulonimbus","ud":"Downdraft","hail":"HAIL","gf":"GUST FRONT","mb":"MICROBURST","ws":"headwind","wx":"Radar beam","emb":"CB ·"},"hazards":{"scw":"0 °C","band":["0 °C","−20 °C"],"rime":"Rime ice","clear":"Clear ice","sld":"freezing rain","where":"ice protection","aero":"stalls before","ttypes":["CAT","rotor"],"wave":["lenticular","rotor"],"cat":"CAT"},"wxreports":{"metar":"METAR","wind":"Wind","wx":"Present weather","cloud":"Cloud","cavok":"CAVOK","trend":"NOSIG","speci":"SPECI","taf":"TAF","chg":"TEMPO","wt":"Wind and temperature","cat":"SVFR"},"gennav":{"tmc":"HDG","var":"HDG","ht":["HDG","TRK"],"dr":"drift","gs":["TAS","GS"],"sixty":"TE","gc":["great circle","rhumb line"],"proj":"rhumb line","conv":"standard parallels","pet":["PET","PNR"]},"radionav":{"wt":"WIND","dme":"slant","ils":"LOC","psr":"PSR","ssr":"SSR","sq":"7700","adsb":"ADS-B"},"gnss":{"sbas":"EGNOS","min":"DA","jam":"Jammed","raim":"LOI"},"holding":{"anat":"FLS ·","sec":["TEARDROP","PARALLEL","DIRECT"],"wind":"WIND","segs":["Initial","Intermediate","Final"],"ils":"3° glide slope","rod":"3° glide slope","min":"DA","cdfa":"3° CDFA","ma":"Missed"},"airdata":{"press":"static port","isa":"ISA","baro":"ALTIMETER","set":"ALTIMETER","ta":"FL 080","hilo":"ALTIMETER","cold":"ALTIMETER","spd":"FROM IAS TO TAS","da":"÷ √(density ratio)","mach":"MACH","vsi":"VSI","pit":"Real IAS","stat":"static port","alts":"static port","uas":"Real IAS"},"gyros":{"tvmc":"MAGNETIC","dip":"dip","ands":"acceleration","turn":"COMPASS SHOWS","rig":"spin axis","prec":["you push here","it moves here"],"drift":"HEADING INDICATOR DRIFT","three":"ATTITUDE","vac":"ATTITUDE","glass":"AHRS 1","rlg":"POSITION ERRO","align":"ALIGNMENT"},"autoflight":{"ga":"AP","fma":"SPEED","pair":"THR CLB","rev":"V/S","lev":"A/THR","tau":"TA","ra":"RA","gpws":"SINK RATE","la":"TERRAIN DISPL"},"engines":{"four":"crankshaft","gt":["Compressor","Combustor","Turbine"],"tp":"Power turbine","mix":"EGT","cs":["MAP","RPM"],"beta":"Propeller","gauges":"N1","lapse":"Max power or thrust","flat":"flat-rating corner","start":"START"},"jetsystems":{"src":["GEN 1","AC BUS 1"],"dcac":"28 V DC","mag":["ALT 1","ALT 2"],"par":"AC ESS","emer":["RAT","EMER GEN"],"ptu":"PTU","fuel":"X-FEED","fc":"NORMAL LAW","gear":"free fall","brk":"ANTI-SKID"},"pressurisation":{"cab":"cabin","ovf":["PACK","outflow valve"],"ldg":"cabin controller","rel":"safety and negative","rate":"cabin","dec":"window lost","tuc":"Critical","oxy":"passenger O₂","rule":"10 000"},"flightplanning":{"vxvy":["Vx","Vy"],"range":["best range","best endurance"],"wind":"best range","high":"best range","stack":["Taxi","Trip","Contingency"],"frf":"Final reserve","nco":"Trip"},"orientation":{"eyes":["REAL","FELT"],"canal":"canal signal","oto":"go-around pow","leans":"≠","spiral":"≠","soma":"go-around pow","cor":"canal signal","rwy":"what your eye","bh":"what your eye","cure":"REAL"},"humanperf":{"att":"DEMAND ON YOU","wl":"DEMAND ON YOU","startle":"startle","fat":"WOCL","alc":"Like blood alcohol"},"performance":{"s-vs0":"VS0","s-vs1":"VS1","s-vsr":"VSR","s-vmcg":"VMCG","s-vmca":"VMCA","s-vmu":"VMU","s-vef":"VEF","s-v1":"V1","s-vr":"VR","s-vlof":"VLOF","s-v2":"V2","s-vfto":"VFTO","s-vx":"VX","s-vy":"VY","s-va":"VA","s-vfe":"VFE","s-vlo":"VLO","s-vle":"VLE","s-vno":"VNO","s-vne":"VNE","s-vmo":"VMO","s-vref":"VREF","s-vapp":"VAPP","dist":["TORA","ASDA","TODA"],"v1":"V1","climb":"net path","land":"LDA"}}/*RING*/;
const ringOf=(k,it)=>{ const r=(it&&it.ring)||(RING[PAGE]&&RING[PAGE][k])||null; return r&&!Array.isArray(r)&&typeof r==='object'?L(r):r; };
let spotEl=null, spotIO=null, spotT=0, lastSpot=null;
function spotHide(){ ringStop(); if(spotEl) spotEl.hidden=true; if(spotIO){ spotIO.disconnect(); spotIO=null; } clearTimeout(spotT); }
function spotPlace(){ if(!spotEl||spotEl.hidden) return; const bar=document.querySelector('.atl-bar'), main=document.querySelector('.atl-main')||document.body;
  const br=bar?bar.getBoundingClientRect():{bottom:0}, mr=main.getBoundingClientRect(), w=Math.min(mr.width,860);
  spotEl.style.top=Math.max(8,Math.min(br.bottom,120))+8+'px'; spotEl.style.left=Math.max(8,mr.left)+'px'; spotEl.style.width=Math.min(w,innerWidth-16)+'px'; }
/* KCS.spot(cardEl, targetEl, html): show the caption for this card while its place in the model is on screen */
function spot(card,target,html,item){ if(!card) return;
  { const bt=card.querySelector('.kgo'), k=bt&&bt.dataset?bt.dataset.k:null; lastSpot={k,target}; const rt=target&&!canvasesOf(target).length?(target.closest('.xvp,.view,.viewport,section')||target):target; ring(rt,ringOf(k,item)); }
  if(!spotEl){ spotEl=document.createElement('div'); spotEl.className='kc-spot'; spotEl.setAttribute('role','status'); document.body.appendChild(spotEl);
    spotEl.addEventListener('click',e=>{ if(e.target.closest('.x')) spotHide(); }); addEventListener('resize',spotPlace); document.addEventListener('keydown',e=>{ if(e.key==='Escape') spotHide(); }); }
  const grid=card.closest('.kcgrid'), vis=grid?[...grid.querySelectorAll('.kc')].filter(c=>c.offsetParent!==null):[card], n=Math.max(1,vis.indexOf(card)+1);
  const h=card.querySelector('h3'), p=card.querySelector(':scope > p');
  spotEl.innerHTML=`<span class="n" aria-hidden="true">${String(n).padStart(2,'0')}</span><div class="tx"><span class="k">${L({en:'Shown in the model',no:'Vist i modellen'})}</span><b class="t">${h?h.innerHTML:''}</b><p>${html||(p?p.innerHTML:'')}</p></div><button type="button" class="x" aria-label="${L({en:'Close',no:'Lukk'})}">×</button>`;
  spotEl.hidden=false; spotEl.classList.remove('in'); void spotEl.offsetWidth; spotEl.classList.add('in'); spotPlace();
  if(spotIO){ spotIO.disconnect(); spotIO=null; } clearTimeout(spotT);
  /* it stays while the model is on screen; scrolling the model away (or Esc, or ×) closes it */
  if(target&&'IntersectionObserver' in window){ spotT=setTimeout(()=>{ spotIO=new IntersectionObserver(es=>{ if(!es[es.length-1].isIntersecting) spotHide(); }); spotIO.observe(target); },1600); }
  else spotT=setTimeout(spotHide,16000); }
/* The same ladder line above the cards in every lab. */
const LADDER={en:'<b>Read them in order.</b> Card 1 is the foundation and each card builds on the one before. “Show in the model” sets the lab up so you see it.',
  no:'<b>Les dem i rekkefølge.</b> Kort 1 er grunnmuren, og hvert kort bygger på det før. «Vis i modellen» setter opp labben så du ser det.'};
function ladder(grid){ if(!grid||grid.previousElementSibling&&grid.previousElementSibling.classList.contains('kladder')) return;
  const p=document.createElement('p'); p.className='kladder'; grid.before(p); const w=()=>{ p.innerHTML=L(LADDER); }; w(); if(window.LAB) LAB.onLang(w); }
/* KCS.order(items, keys): the same cards in ladder order (keys first, in that order; any others keep their place after). */
const order=(items,keys)=>{ const by=k=>{ const i=keys.indexOf(k); return i<0?keys.length:i; }; return items.map((it,i)=>[it,i]).sort((a,b)=>by(a[0].k)-by(b[0].k)||a[1]-b[1]).map(x=>x[0]); };
window.KCS={render,sv,tx,ar,ladder,LADDER,order,spot,spotHide,SEE,RING,labels,ring,ringStop,get last(){ return lastSpot; }};
})();
