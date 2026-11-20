/* NORDAP – airspace-lab.js: "Airspace and the rules of the air" (airspace.html).
   One model (airspacecore.js), two views of it:
   side – a vertical section 40 NM either side of Nordvik, surface to FL300 (stretched low down so the CTR and the steps are readable)
   plan – the airspace from above at the aircraft's altitude, as a VFR chart shows it
   Drag the aircraft in either view; the panel says what applies there (SERA only). Drawn on change, no animation loop. */
(function(){
'use strict';
const {L,el,nf}=LAB, A=window.ASPC, t2=A.t2;
const isIns=()=>document.body.classList.contains('depth-instructor');
const MONO='IBM Plex Mono, monospace', SANS='"Public Sans", sans-serif';
const CC={C:'#5E9BD6',D:'#3FB6A8',E:'#B48AD8',F:'#9AA5AF',G:'#7D8B95',A:'#E46BAE',B:'#E46BAE'};
const COL={ac:'#E46BAE',r:'#EC5A47',rmz:'#F0B440',cloud:'#C9D2DA',ok:'#71CC93',bad:'#EC5A47',amb:'#F0B440',ink:'#E6EBEF',ink2:'#AEB8C1',ink3:'#7D8B95'};
const XMAX=40, HMAX=30000;

/* =====================================================================
   Strings (the page holds the English)
   ===================================================================== */
LAB.add({},{
 'Airspace and the rules of the air':'Luftrom og lufttrafikkregler','NORDAP Virtual Labs · Air law':'NORDAP Virtual Labs · Luftfartsrett',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Key points':'3 · Det viktigste','3 · Test yourself':'3 · Test deg selv',
 'Key concepts':'Nøkkelbegreper','The airspace lab':'Luftromslabben','Try it':'Prøv selv','Pilot takeaways':'Dette tar piloten med seg','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','What applies here':'Dette gjelder her','Your flight':'Din flyging','Flight rules':'Flygeregler','Time':'Tid','Weather':'Vær','Scenarios':'Scenarier','Airspace':'Luftrom',
 'ATC clearance':'ATC-klarering','Radio':'Radio','Separation':'Separasjon','Service':'Tjeneste','Speed limit':'Fartsgrense','VMC minima here':'VMC-minima her',
 'Restricted area R-101 active':'Restriksjonsområde R-101 aktivt',
 'One cloud layer, 2500 ft thick, over the whole area; its base is the ceiling at Nordvik.':'Ett skylag, 2500 ft tykt, over hele området; basen er skyhøyden (ceiling) på Nordvik.',
 'The two SERA tables: airspace classes and VMC minima':'De to SERA-tabellene: luftromsklasser og VMC-minima',
 'Position (NM, west − / east +)':'Posisjon (NM, vest − / øst +)','Altitude':'Høyde','Visibility':'Sikt','Cloud base':'Skybase','Day':'Dag','Night':'Natt'
});
LAB.tx({
 lead:'Hver bit av himmelen har en klasse, og klassen avgjør hva du trenger før du flyr inn: en klarering, en radio, en transponder, eller ingenting. Fly gjennom et trappetrinnsformet luftrom rundt en flyplass, sett fra siden og ovenfra, og se i hvert punkt hvilke regler som gjelder for deg, IFR eller VFR, i været du stiller inn. Alt her er fra EASAs lufttrafikkregler (SERA).',
 goal:'<span class="k">Læringsmål</span>Si hvilken klasse et luftrom har ut fra grensene, hva hver klasse gir og krever av IFR- og VFR-flyginger, bruke VMC-minima og reglene for CTR og spesiell VFR på dagens vær, og planlegge en VFR-rute som holder seg lovlig rundt kontrollert luftrom.',
 u0:'Luftrom er <b>kontrollert</b> (klasse A til E: ATC gir klareringer) eller <b>ukontrollert</b> (F og G). Fra A mot G gjør ATC mindre og du mer selv. En klasse sier tre ting: hvem som kan fly der, hva ATC gjør for deg, og hva du må gjøre: få klarering, snakke på radio, holde VMC-minima.',
 u3:'<span class="k">Dypdykk · slik henger delene sammen</span><p><b>Kontrollert luftrom har navn i tillegg til klasse.</b> En kontrollsone (CTR) starter ved bakken og beskytter ankomster og avganger. Et kontrollområde (CTA) starter på en nedre grense over bakken; et terminalområde (TMA) er et CTA der rutene møtes rundt én eller flere travle flyplasser, og en luftvei er et CTA formet som en korridor. Staten gir hvert av dem en klasse og publiserer det i AIP.</p><p><b>Grensene er en del av luftrommet.</b> Et volum beskrives med sideveis grense og med nedre og øvre grense, for eksempel «3500 ft – FL195». Under den nedre grensen er du ikke i det. Nedre grenser trappes opp bort fra flyplassen, så VFR-flyginger kan holde seg under dem. På og under overgangshøyden er grensene høyder på QNH; over den er de flygenivåer på 1013,25 hPa.</p><p><b>Spesielle områder ligger oppå klassen.</b> Forbudte (P) og restriksjonsområder (R) kan ikke flys inn i unntatt etter de publiserte vilkårene eller med tillatelse; et fareområde (D) varsler om aktivitet som kan være farlig for luftfartøy. En RMZ legger til et radiokrav og en TMZ et transponderkrav i luftrommet, uansett klasse.</p>',
 e1:'Ett fiktivt luftrom rundt flyplassen Nordvik, bygd slik ekte luftrom er: en kontrollsone fra bakken, et TMA i trinn over den, klasse G under, et kontrollområde lenger ute, et restriksjonsområde og en radiopliktig sone rundt en liten flyplass. Dra flyet, eller bruk glidebryterne. Fra siden viser lagene; Ovenfra viser luftrommet i din høyde, slik et VFR-kart gjør. Panelet sier hva som gjelder for deg der.',
 t1:'Fire korte oppgaver. To løser du i modellen, med direkte tilbakemelding; to svarer du på her, og ser dem så i modellen.',
 d1:'<div class="box"><b class="t"><i>1</i>Klassen avgjør hva du trenger</b><p>I A til D trenger alle flyginger klarering og radio. I E er det bare IFR som gjør det: en VFR-flyging kan fly der uten å snakke med noen. I F og G trenger ingen klarering. Separasjon følger samme mønster: jo lenger ned i alfabetet, jo mer er din egen jobb.</p></div><div class="box"><b class="t"><i>2</i>Les grensene, ikke bare strekene</b><p>En strek på kartet er bare en del av historien. Et TMA som starter på 3500 ft finnes ikke på 3000 ft, så VFR-trafikk flyr under det i klasse G. Kjenn den nedre grensen i hvert punkt på ruten, og hvilke som er høyder og hvilke som er flygenivåer.</p></div><div class="box"><b class="t"><i>3</i>VFR er luftrom og vær sammen</b><p>VMC-minima endrer seg med høyde og klasse: 8 km over FL100, 5 km under, og fri av skyer med bakken i sikte bare lavt i F og G. Inn i en CTR trenger du skyhøyde 1500 ft og 5 km, eller spesiell VFR-klarering.</p></div>',
 d2:'<li><b>Planlegg den vertikale profilen, ikke bare streken.</b> Merk den nedre grensen for hvert kontrollerte volum langs ruten og planlegg en høyde med margin under den. En høydemåler som står 10 hPa feil, viser rundt 300 ft feil.</li><li><b>Ring før grensen, ikke på den.</b> Klarering inn i en CTR eller et TMA trengs før du krysser streken. Planlegg et venteområde utenfor, og har du ikke klarering, hold deg ute.</li><li><b>Klasse E er delt luftrom.</b> IFR-trafikk der er bare separert fra annen IFR. VFR-flyginger kan være der uten klarering eller radio, og ofte uten transponder. Hold godt utkikk, og be om trafikkinformasjon når du kan.</li><li><b>Sjekk de spesielle områdene på dagen.</b> Restriksjons-, fare- og midlertidige områder slås av og på med NOTAM og AIP-tider. Et R-område som var inaktivt i går, kan være aktivt i dag.</li><li><b>Under CTR-minima: spør tidlig.</b> Med skyhøyde under 1500 ft eller sikt under 5 km trenger en VFR-ankomst eller -avgang spesiell VFR, om dagen, fri av skyer med bakken i sikte. Under 600 ft eller 1500 m gir ikke ATC det.</li>',
 d3:'<span class="k">Dypdykk · i rutefly</span><p><b>Inne i systemet hele veien.</b> Et IFR-rutefly er i kontrollert luftrom fra bane til bane: CTR, TMA på SID-en, luftveier eller øvre luftrom i marsj, og ned igjen gjennom TMA på STAR-en. I klasse C er det separert fra alle; i D og E bare fra annen IFR-trafikk, så besetningen holder fortsatt utkikk og bruker TCAS.</p><p><b>Fart.</b> Grensen på 250 kt under FL100 gjelder IFR i klasse D til G, ikke i C. Publiserte SID-er og STAR-er og ATC-instrukser begrenser ofte farten likevel, så les kartet og klareringen.</p><p><b>Ut av kontrollert luftrom.</b> Noen regionale flyplasser og øyflyplasser ligger i klasse G med en RMZ i stedet for en CTR. En IFR-innflyging der får flygeinformasjon, ikke ATC-separasjon: lytt, gi posisjonsrapporter, og regn med VFR-trafikk som ikke er separert fra deg.</p>',
 foot:'<b>Modell og begrensninger.</b> Et fiktivt luftrom for læring, ikke en ekte AIP. Flatt terreng ved havnivå, så 3000 ft AMSL er også 1000 ft over bakken, og en overgangshøyde på 5000 ft. Ett skylag, 2500 ft tykt, dekker hele området, og basen er skyhøyden på Nordvik. Reglene er fra EASAs lufttrafikkregler, SERA (gjennomføringsforordning (EU) nr. 923/2012): tillegg 4 for klassene, SERA.5001 og tabell S5-1 for VMC-minima, SERA.5005 for VFR (CTR-minima, natt, FL195), SERA.5010 for spesiell VFR, SERA.6005 for RMZ og TMZ og SERA.3145 for restriksjonsområder. Redusert sikt som myndigheten kan tillate i klasse F og G, og nasjonale regler, er ikke modellert. Sjekk alltid AIP og NOTAM for det virkelige luftrommet.'
});

/* =====================================================================
   State and the judgement
   ===================================================================== */
const S={x:12,alt:3000,fr:'VFR',night:false,vis:10,base:5500,rActive:true};
const NOCLOUD=12500;
let J=null;
function judge(){ J=A.judge({x:S.x,y:0,alt:S.alt,fr:S.fr,night:S.night,rActive:S.rActive,wx:{vis:S.vis,base:S.base>=NOCLOUD?null:S.base,thick:2500}}); return J; }
const fmtAlt=a=>a<=0?'SFC':a>A.TA?'FL'+String(Math.round(a/100)).padStart(3,'0'):Math.round(a/50)*50+' ft';
const fmtVis=v=>v>=10?L(t2('10 km or more','10 km eller mer')):v<1?Math.round(v*1000)+' m':nf(v,1)+' km';
const fmtBase=b=>b>=NOCLOUD?L(t2('No cloud','Ingen skyer')):b+' ft';
const clsTag=c=>`<span class="cl" style="background:${CC[c]}">${c}</span>`;

/* =====================================================================
   Viewport: tabs, chip, legend, "what you're seeing"
   ===================================================================== */
const VIEWS=[['side',t2('Side view','Fra siden')],['plan',t2('From above','Ovenfra')]];
let view='side';
function drawTabs(){ el('aTabs').innerHTML=VIEWS.map(([k,n])=>`<button type="button" role="tab" data-v="${k}" class="${k===view?'on':''}" aria-selected="${k===view}">${L(n)}</button>`).join('');
  el('tFr').textContent=S.fr==='VFR'?L(t2('Flying VFR','Flyr VFR')):L(t2('Flying IFR','Flyr IFR')); el('tFr').setAttribute('aria-pressed',String(S.fr==='IFR'));
  el('tFr').title=L(t2('Switch between VFR and IFR','Bytt mellom VFR og IFR'));
  el('xsv').textContent=L(VIEWS.find(x=>x[0]===view)[1]); }
function setView(v){ if(!VIEWS.some(x=>x[0]===v)) return; view=v;
  document.querySelectorAll('#avp .vv').forEach(e=>{ e.hidden=e.dataset.v!==v; }); drawTabs(); legend(); draw(); }
el('aTabs').addEventListener('click',e=>{ const b=e.target.closest('button[data-v]'); if(b) setView(b.dataset.v); });
el('tFr').addEventListener('click',()=>{ S.fr=S.fr==='VFR'?'IFR':'VFR'; segFr.set(S.fr); upd(); });
function legend(){ const it=[[CC.C,'C'],[CC.D,'D'],[CC.E,'E'],[CC.G,'G'],[COL.r,'R-101'],[COL.rmz,'RMZ'],...(view==='side'?[[COL.cloud,L(t2('Cloud','Sky'))]]:[]),[COL.ac,L(t2('You','Du'))]];
  const lines=view==='side'?[['#C9D2DA',t2('3000 ft: VMC minima change','3000 ft: VMC-minima endres')],['#7FCBE8',t2('TA: transition altitude','TA: overgangshøyde')],['#F0B440',t2('FL100: 8 km above, 250 kt below','FL100: 8 km over, 250 kt under')],['#EC8A7C',t2('FL195: top of VFR','FL195: øverst for VFR')]]:[];
  el('aLeg').innerHTML=it.map(([c,n],i)=>`<span><i class="${i>=4&&i<6?'d':''}" style="--c:${c};${i<4?'height:9px;width:12px;opacity:.85':''}"></i>${n}</span>`).join('')+lines.map(([c,n])=>`<span><i class="d" style="--c:${c}"></i>${L(n)}</span>`).join(''); }
const chipLast={}; function chip(id,items){ const h=items.map(([k,v,c])=>`<span><i>${L(k)}</i><b${c?` class="${c}"`:''}>${v}</b></span>`).join(''); if(chipLast[id]!==h){ chipLast[id]=h; el(id).innerHTML=h; } }

/* =====================================================================
   The panel
   ===================================================================== */
function out(){ const j=J, v=j.v, r=j.row;
  el('rAs').innerHTML=`${clsTag(v.c)}${L(v.name)}<small>${v.lims}${v.r?' · R-101':''}</small>`;
  const clr=S.fr==='VFR'&&!r?null:j.clr;
  el('rCl').innerHTML=clr==='no-vfr'?L(t2('VFR not allowed here','VFR ikke tillatt her')):clr==='svfr'?L(t2('Special VFR clearance','Spesiell VFR-klarering')):clr==='yes'?L(t2('Yes, before you enter','Ja, før du flyr inn')):L(t2('No','Nei'));
  el('rCl').className=clr==='yes'?'warn':clr==='svfr'?'warn':clr==='no-vfr'?'bad':'good';
  el('rRa').innerHTML=v.rmz&&S.fr==='VFR'?L(t2('Yes: RMZ, listening watch and call before entry','Ja: RMZ, lyttevakt og melding før innflyging')):v.rmz?L(t2('Yes: RMZ','Ja: RMZ')):L(r.radio)+(r.radio.en==='Yes'?L(t2(': continuous two-way',': kontinuerlig toveis')):'');
  el('rSe').textContent=L(r.sep); el('rSv').textContent=L(r.svc);
  const below=S.alt<A.FL100; el('rSp').textContent=/250/.test(r.spd.en)?(below?L(t2('250 kt IAS (you are below FL100)','250 kt IAS (du er under FL100)')):L(t2('None at or above FL100','Ingen på eller over FL100'))):L(r.spd);
  el('rowVm').hidden=S.fr!=='VFR';
  if(S.fr==='VFR'){ const b=j.band; el('rVm').innerHTML=!b?L(t2('No VFR above FL195','Ingen VFR over FL195')):b.clear?L(t2('5 km, clear of cloud, surface in sight','5 km, fri av skyer, bakken i sikte')):L(t2(`${b.vis} km; 1500 m and 1000 ft from cloud`,`${b.vis} km; 1500 m og 1000 ft fra skyer`)); }
  /* the checklist */
  const li=[];
  if(S.fr==='VFR'){ if(j.band&&!j.issues.some(i=>['cloud','vdist','vis','surf','nosvfr'].includes(i.k))) li.push(['ok',t2(`VMC: visibility ${fmtVis(S.vis)}, ${j.vDist===Infinity?'no cloud':Math.round(j.vDist)+' ft from cloud'}.`,`VMC: sikt ${fmtVis(S.vis)}, ${j.vDist===Infinity?'ingen skyer':Math.round(j.vDist)+' ft fra skyene'}.`)]); }
  else li.push(['nt',t2('IFR: the VMC minima do not apply; you need an IFR clearance in controlled airspace and must follow the minimum levels.','IFR: VMC-minima gjelder ikke; du trenger IFR-klarering i kontrollert luftrom og må følge minste flygehøyder.')]);
  j.issues.forEach(i=>li.push(['no',i.m])); j.notes.forEach(n=>li.push(['nt',n.m]));
  if(S.fr==='VFR'&&S.alt>=A.TA&&S.alt<A.FL195) li.push(['nt',t2('Above the transition altitude: fly flight levels on 1013.25 hPa.','Over overgangshøyden: fly flygenivåer på 1013,25 hPa.')]);
  el('chk').innerHTML=li.map(([c,m])=>`<li class="${c}">${L(m)}</li>`).join('');
  /* chip and the one-line summary */
  const st=!j.ok?['no',t2('Not OK','Ikke OK')]:j.clr==='svfr'?['sv',t2('OK with special VFR','OK med spesiell VFR')]:j.clr==='yes'?['sv',t2('OK with a clearance','OK med klarering')]:['ok',t2('OK','OK')];
  const ch=[[t2('Class','Klasse'),v.c],[t2('Airspace','Luftrom'),L(v.name).replace(/ \(.*\)/,'').replace(/ at Lia| ved Lia/,'')],[t2('Limits','Grenser'),v.lims],[t2('You','Du'),`${S.fr} · ${fmtAlt(S.alt)}`],[t2('Status','Status'),L(st[1]),st[0]==='ok'?'g':st[0]==='sv'?'a':'r']];
  chip('chipS',ch); chip('chipP',ch);
  el('aSee').innerHTML=see(j,st); live(); }
function see(j,st){ const v=j.v, fr=S.fr, nm=L(v.name);
  let s;
  if(fr==='VFR'&&S.alt>=A.FL195) s=t2('Above FL195 VFR is not allowed unless the authority allows it, whatever the class.','Over FL195 er VFR ikke tillatt med mindre myndigheten tillater det, uansett klasse.');
  else if(fr==='VFR'&&v.c==='C') s=t2(`VFR in <b>class C</b> (${nm}): you need a clearance and the radio. ATC separates you from IFR traffic and gives you traffic information on other VFR.`,`VFR i <b>klasse C</b> (${nm}): du trenger klarering og radio. ATC separerer deg fra IFR-trafikk og gir deg trafikkinformasjon om annen VFR.`);
  else if(fr==='VFR'&&v.c==='D') s=t2(`VFR in <b>class D</b> (${nm}): you need a clearance and the radio, but ATC does not separate you from anyone. You get traffic information and keep your own lookout.`,`VFR i <b>klasse D</b> (${nm}): du trenger klarering og radio, men ATC separerer deg ikke fra noen. Du får trafikkinformasjon og holder selv utkikk.`);
  else if(fr==='VFR'&&v.c==='E') s=t2(`VFR in <b>class E</b> (${nm}): controlled airspace, but you need no clearance and no radio. IFR traffic here has a clearance and is separated only from other IFR, not from you.`,`VFR i <b>klasse E</b> (${nm}): kontrollert luftrom, men du trenger verken klarering eller radio. IFR-trafikken her har klarering og er bare separert fra annen IFR, ikke fra deg.`);
  else if(fr==='VFR') s=v.rmz?t2(`VFR in <b>class G</b> inside an <b>RMZ</b>: still no clearance, but you must listen out and call before you enter.`,`VFR i <b>klasse G</b> inne i en <b>RMZ</b>: fortsatt ingen klarering, men du må lytte og melde deg før du flyr inn.`)
    :t2(`VFR in <b>class G</b>, under ${S.x>-25&&S.x<25&&Math.abs(S.x)>8?'the TMA':'the controlled airspace'}: no clearance and no radio needed. Nobody separates you; flight information if you ask for it.`,`VFR i <b>klasse G</b>, under ${S.x>-25&&S.x<25&&Math.abs(S.x)>8?'TMA-et':'det kontrollerte luftrommet'}: verken klarering eller radio trengs. Ingen separerer deg; flygeinformasjon hvis du ber om det.`);
  else if(A.CONTROLLED(v.c)) s=t2(`IFR in <b>class ${v.c}</b> (${nm}): a controlled flight with an IFR clearance. Separated ${v.c==='C'?'from IFR and VFR':'from other IFR only'}.`,`IFR i <b>klasse ${v.c}</b> (${nm}): en kontrollert flyging med IFR-klarering. Separert ${v.c==='C'?'fra IFR og VFR':'bare fra annen IFR'}.`);
  else s=t2(`IFR in <b>class G</b>: no clearance and no separation, only flight information. You must be able to talk to ATS${v.rmz?', and the RMZ makes the listening watch mandatory':''}.`,`IFR i <b>klasse G</b>: ingen klarering og ingen separasjon, bare flygeinformasjon. Du må kunne snakke med ATS${v.rmz?', og RMZ-en gjør lyttevakt påbudt':''}.`);
  return `<span class="${st[0]}">${L(st[1])}.</span> ${L(s)}`; }

/* =====================================================================
   Drawing helpers and geometry
   ===================================================================== */
const CS=LAB.fit(el('cvS'),()=>draw(),2), CP=LAB.fit(el('cvP'),()=>draw(),2);
const KN=[[0,0],[3000,.30],[5000,.44],[10000,.62],[20000,.84],[HMAX,1]];
function fOf(a){ for(let i=1;i<KN.length;i++){ if(a<=KN[i][0]){ const [a0,f0]=KN[i-1],[a1,f1]=KN[i]; return f0+(f1-f0)*(a-a0)/(a1-a0); } } return 1; }
function aOf(f){ for(let i=1;i<KN.length;i++){ if(f<=KN[i][1]){ const [a0,f0]=KN[i-1],[a1,f1]=KN[i]; return a0+(a1-a0)*(f-f0)/(f1-f0); } } return HMAX; }
let GS=null, GP=null;
const chipTop=id=>{ const c=el(id); return Math.max(40,(c&&c.offsetHeight?c.offsetTop+c.offsetHeight:52)+16); };
function geoS(){ const W=CS.w,H=CS.h, sm=W<560, pl=sm?50:62, pr=sm?8:14, top=chipTop('chipS'), yg=H-(sm?22:26);
  GS={W,H,pl,pr,top,yg,sm,fs:isIns()?1.15:sm?.86:1,X:nm=>pl+(nm+XMAX)/(2*XMAX)*(W-pl-pr),Y:a=>yg-fOf(a)*(yg-top),nm:px=>(px-pl)/(W-pl-pr)*2*XMAX-XMAX,alt:py=>aOf((yg-py)/(yg-top))}; return GS; }
function txt(g,s,x,y,o){ o=o||{}; g.font=`${o.w||600} ${Math.round((o.size||11)*(GS?GS.fs:1))}px ${o.mono?MONO:SANS}`; g.fillStyle=o.col||COL.ink; g.textAlign=o.al||'left'; g.textBaseline=o.bl||'alphabetic'; g.fillText(s,x,y); g.textBaseline='alphabetic'; return g.measureText(s).width; }
function hex(c,a){ const n=parseInt(c.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; }
function hatch(g,x,y,w,h,col){ g.save(); g.beginPath(); g.rect(x,y,w,h); g.clip(); g.strokeStyle=col; g.lineWidth=1; for(let i=-h;i<w;i+=7){ g.beginPath(); g.moveTo(x+i,y+h); g.lineTo(x+i+h,y); g.stroke(); } g.restore(); }
function plane(g,x,y,s,col,dir){ g.save(); g.translate(x,y); g.scale(dir||1,1); g.fillStyle=col; g.strokeStyle='#0d1319'; g.lineWidth=1.2;
  g.beginPath(); g.moveTo(11*s,0); g.lineTo(4*s,-2*s); g.lineTo(-1*s,-9*s); g.lineTo(-4*s,-9*s); g.lineTo(-1*s,-2*s); g.lineTo(-8*s,-2*s); g.lineTo(-11*s,-6*s); g.lineTo(-13*s,-6*s); g.lineTo(-11*s,0); g.lineTo(-13*s,2*s); g.lineTo(-8*s,2*s); g.lineTo(-1*s,2*s); g.lineTo(-4*s,9*s); g.lineTo(-1*s,9*s); g.lineTo(4*s,2*s); g.closePath(); g.stroke(); g.fill(); g.restore(); }

/* =====================================================================
   Side view
   ===================================================================== */
function drawSide(){ if(!CS.w) return; const g=CS.ctx, {W,H,pl,pr,top,yg,X,Y,sm}=geoS();
  g.clearRect(0,0,W,H);
  const sky=g.createLinearGradient(0,top,0,yg); sky.addColorStop(0,'#0E1722'); sky.addColorStop(1,'#203245'); g.fillStyle=sky; g.fillRect(pl,top-6,W-pl-pr,yg-top+6);
  const box=(x0,x1,a0,a1,c,al)=>{ g.fillStyle=hex(c,al); g.fillRect(X(x0),Y(a1),X(x1)-X(x0),Y(a0)-Y(a1)); };
  /* class G is the background: draw the controlled volumes on it */
  box(-XMAX,XMAX,A.FL195,HMAX,CC.C,.20);
  box(-XMAX,-25,9500,A.FL195,CC.E,.22); box(25,XMAX,9500,A.FL195,CC.E,.22);
  /* the TMA as one outline */
  const tp=[[-25,4500],[-15,4500],[-15,3500],[-8,3500],[-8,2500],[8,2500],[8,3500],[15,3500],[15,4500],[25,4500],[25,A.FL195],[-25,A.FL195]];
  g.beginPath(); tp.forEach(([x,a],i)=>i?g.lineTo(X(x),Y(a)):g.moveTo(X(x),Y(a))); g.closePath(); g.fillStyle=hex(CC.C,.26); g.fill(); g.strokeStyle=hex(CC.C,.95); g.lineWidth=1.6; g.stroke();
  box(-8,8,0,2500,CC.D,.34); g.strokeStyle=hex(CC.D,1); g.lineWidth=1.6; g.strokeRect(X(-8),Y(2500),X(8)-X(-8),Y(0)-Y(2500));
  g.strokeStyle=hex(CC.E,.9); g.lineWidth=1.2; [[-XMAX,-25],[25,XMAX]].forEach(([a,b])=>g.strokeRect(X(a),Y(A.FL195),X(b)-X(a),Y(9500)-Y(A.FL195)));
  /* R-101 and the RMZ */
  const rx0=X(A.RA.x0), rx1=X(A.RA.x1), ry=Y(A.RA.hi);
  g.globalAlpha=S.rActive?1:.35; g.fillStyle=hex(COL.r,.12); g.fillRect(rx0,ry,rx1-rx0,yg-ry); hatch(g,rx0,ry,rx1-rx0,yg-ry,hex(COL.r,.35)); g.strokeStyle=COL.r; g.lineWidth=1.5; g.strokeRect(rx0,ry,rx1-rx0,yg-ry); g.globalAlpha=1;
  const mx0=X(A.RMZ.x-A.RMZ.r), mx1=X(A.RMZ.x+A.RMZ.r), my=Y(A.RMZ.hi); g.setLineDash([5,4]); g.strokeStyle=COL.rmz; g.lineWidth=1.5; g.strokeRect(mx0,my,mx1-mx0,yg-my); g.setLineDash([]); g.fillStyle=hex(COL.rmz,.08); g.fillRect(mx0,my,mx1-mx0,yg-my);
  /* the cloud layer */
  if(S.base<NOCLOUD){ const y0=Y(S.base+2500), y1=Y(S.base); const cg=g.createLinearGradient(0,y0,0,y1); cg.addColorStop(0,'rgba(201,210,218,.18)'); cg.addColorStop(1,'rgba(201,210,218,.42)'); g.fillStyle=cg; g.fillRect(pl,y0,W-pl-pr,y1-y0);
    g.strokeStyle='rgba(225,232,238,.75)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(pl,y1); g.lineTo(W-pr,y1); g.stroke();
    const cl=L(t2('cloud base','skybase'))+' '+S.base+' ft'; g.font=`500 ${Math.round(10*GS.fs)}px ${MONO}`; const cw=g.measureText(cl).width+10; g.fillStyle='rgba(12,16,20,.75)'; g.fillRect(W-pr-cw-4,y1+2,cw,15); txt(g,cl,W-pr-9,y1+13,{al:'right',size:10,col:'#E6EBEF',mono:1,w:500}); }
  /* reference lines */
  const ref=(a,lab,col,dash)=>{ const y=Y(a); g.strokeStyle=col; g.lineWidth=1; g.setLineDash(dash||[3,4]); g.beginPath(); g.moveTo(pl,y); g.lineTo(W-pr,y); g.stroke(); g.setLineDash([]); };
  ref(3000,L(t2('3000 ft: VMC minima change','3000 ft: VMC-minima endres')),'rgba(174,184,193,.45)');
  ref(A.TA,L(t2('transition altitude 5000 ft','overgangshøyde 5000 ft')),'rgba(127,203,232,.5)',[1,3]);
  ref(A.FL100,L(t2('FL100: 8 km above, 250 kt below','FL100: 8 km over, 250 kt under')),'rgba(240,180,64,.6)');
  ref(A.FL195,L(t2('FL195: top of VFR','FL195: øverst for VFR')),'rgba(236,90,71,.55)');
  /* ground, aerodromes */
  const gg=g.createLinearGradient(0,yg,0,H); gg.addColorStop(0,'#3A4434'); gg.addColorStop(1,'#232a20'); g.fillStyle=gg; g.fillRect(pl,yg,W-pl-pr,H-yg);
  g.fillStyle='#E6EBEF'; g.fillRect(X(0)-10,yg-2,20,3); txt(g,'Nordvik',X(0),yg+15,{al:'center',size:10.5,col:'#DDE4EA'});
  g.fillStyle='#C9D2DA'; g.fillRect(X(A.RMZ.x)-5,yg-2,10,3); txt(g,'Lia',X(A.RMZ.x),yg+15,{al:'center',size:10.5,col:'#C9D2DA'});
  /* labels in the volumes */
  const lab=(x,a,cl,name,lim,col)=>{ const y=Y(a); txt(g,cl,X(x),y,{al:'center',size:sm?17:22,w:700,col}); if(name) txt(g,name,X(x),y+13*GS.fs,{al:'center',size:sm?9:10.5,col:'#C9D2DA',w:600}); if(lim&&!sm) txt(g,lim,X(x),y+26*GS.fs,{al:'center',size:9.5,col:'#9FB0BE',mono:1,w:500}); };
  lab(0,1250,'D','CTR','SFC–2500 ft',hex(CC.D,1));
  lab(0,13500,'C','TMA','2500 ft–FL195',hex(CC.C,1));
  lab(0,24500,'C',L(t2('upper airspace','øvre luftrom')),'FL195–FL660',hex(CC.C,1));
  lab(-33,14000,'E','CTA','FL95–FL195',hex(CC.E,1)); lab(33,14000,'E','CTA','FL95–FL195',hex(CC.E,1));
  lab(-12,1300,'G','','',hex(CC.G,1)); lab(12,1300,'G','','',hex(CC.G,1)); lab(20,1800,'G','','',hex(CC.G,1)); lab(-20,1800,'G','','',hex(CC.G,1)); lab(-37,3800,'G','','',hex(CC.G,1)); lab(36,3800,'G','','',hex(CC.G,1));
  txt(g,'R-101',(rx0+rx1)/2,ry-5,{al:'center',size:10,col:COL.r,w:700}); txt(g,'RMZ',(mx0+mx1)/2,my-5,{al:'center',size:10,col:COL.rmz,w:700});
  /* the TMA steps' lower limits */
  if(!sm) [[11.5,3500],[20,4500],[-11.5,3500],[-20,4500]].forEach(([x,a])=>txt(g,a+' ft',X(x),Y(a)-4,{al:'center',size:9.5,col:hex(CC.C,1),mono:1,w:600}));
  /* the altitude axis */
  g.fillStyle='#0f151b'; g.fillRect(0,top-10,pl,yg-top+12);
  [[0,'SFC'],[1000,'1000'],[2000,'2000'],[3000,'3000','#C9D2DA'],[4000,'4000'],[5000,'TA 5000','#7FCBE8'],[A.FL100,'FL100','#F0B440'],[15000,'FL150'],[A.FL195,'FL195','#EC8A7C'],[25000,'FL250'],[HMAX,'FL300']].forEach(([a,s,c])=>{ const y=Y(a); g.strokeStyle='rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(pl-4,y); g.lineTo(pl,y); g.stroke(); txt(g,sm&&s==='TA 5000'?'5000':s,pl-6,y+3.5,{al:'right',size:9.5,col:c||COL.ink2,mono:1,w:c?600:500}); });
  /* distance axis */
  for(let n=-XMAX+10;n<XMAX;n+=10){ txt(g,n===0?'0':(n>0?'+':'−')+Math.abs(n),X(n),H-4,{al:'center',size:9,col:COL.ink3,mono:1,w:500}); }
  txt(g,'NM',pl-6,H-4,{al:'right',size:9,col:COL.ink3,mono:1,w:500});
  /* the aircraft */
  const ax=X(S.x), ay=Y(S.alt), c=!J.ok?COL.bad:J.clr==='svfr'||J.clr==='yes'?COL.amb:COL.ac;
  g.strokeStyle=hex(c.startsWith('#')?c:'#E46BAE',.5); g.setLineDash([2,3]); g.beginPath(); g.moveTo(ax,ay+8); g.lineTo(ax,yg); g.stroke(); g.setLineDash([]);
  g.strokeStyle='rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(pl,ay); g.lineTo(pl+6,ay); g.stroke();
  plane(g,ax,ay,sm?.85:1,c,1);
  const tag=`${S.fr} ${fmtAlt(S.alt)}`; g.font=`600 ${Math.round(11*GS.fs)}px ${MONO}`; const tw=g.measureText(tag).width+12, tx0=Math.min(W-pr-tw-2,Math.max(pl+2,ax-tw/2)), ty=ay-24;
  g.fillStyle='rgba(12,16,20,.85)'; g.strokeStyle=c; g.lineWidth=1; g.beginPath(); g.roundRect?g.roundRect(tx0,ty-9,tw,18,9):g.rect(tx0,ty-9,tw,18); g.fill(); g.stroke(); txt(g,tag,tx0+tw/2,ty+4,{al:'center',size:11,mono:1,col:'#fff'}); }

/* =====================================================================
   Plan view: the airspace at your altitude
   ===================================================================== */
function drawPlan(){ if(!CP.w) return; const g=CP.ctx, W=CP.w, H=CP.h, sm=W<560; GS=GS||geoS();
  const pad=10, top=chipTop('chipP'), k=(W-2*pad)/(2*XMAX), cx=W/2, cy=top+(H-top-pad)/2, X=n=>cx+n*k, Yp=n=>cy-n*k;
  GP={cx,k,X}; const alt=S.alt;
  g.clearRect(0,0,W,H); g.fillStyle='#1a2420'; g.fillRect(0,0,W,H);
  const cAt=(x,y)=>A.at(x,y,alt);
  const fillCls=c=>c==='G'?'rgba(255,255,255,.03)':hex(CC[c],c==='C'?.30:c==='D'?.38:.28);
  /* outside 25 NM */
  const out=cAt(30,20); g.fillStyle=fillCls(out.c); g.fillRect(0,0,W,H);
  /* rings, outside in */
  [[25,20],[15,12],[8,5]].forEach(([r,inner])=>{ const c=cAt(inner+.5===r?r-.5:r-.5,0).c; g.beginPath(); g.arc(cx,cy,r*k,0,7); g.fillStyle='#1a2420'; g.fill(); g.fillStyle=fillCls(c); g.fill(); });
  /* ring outlines with the limits that start there */
  const ringLab=[[25,'TMA 4500 ft–FL195'],[15,'TMA 3500 ft–FL195'],[8,'CTR SFC–2500 ft · TMA 2500 ft–FL195']];
  ringLab.forEach(([r,s],i)=>{ const c=cAt(r-.5,0).c, on=c!=='G'; g.strokeStyle=on?hex(CC[c],.95):'rgba(174,184,193,.35)'; g.lineWidth=on?1.6:1; g.setLineDash(on?[]:[4,4]); g.beginPath(); g.arc(cx,cy,r*k,0,7); g.stroke(); g.setLineDash([]);
    if(!sm) txt(g,r+' NM',cx+r*k-3,cy-5,{al:'right',size:9,col:on?'#DDE4EA':'#8E99A4',mono:1,w:500}); });
  /* the chart's key: what starts where */
  { const rows=[[t2('Within 8 NM','Innenfor 8 NM'),'CTR SFC–2500 ft · TMA 2500 ft–FL195'],[t2('8–15 NM','8–15 NM'),'TMA 3500 ft–FL195'],[t2('15–25 NM','15–25 NM'),'TMA 4500 ft–FL195'],[t2('Beyond 25 NM','Utenfor 25 NM'),'CTA FL95–FL195'],[t2('Everywhere','Overalt'),'C FL195–FL660']];
    const fz=Math.round((sm?8.5:9.5)*GS.fs), lh=fz+5; g.font=`500 ${fz}px ${MONO}`; const w1=Math.max(...rows.map(r=>g.measureText(L(r[0])).width)), w2=Math.max(...rows.map(r=>g.measureText(r[1]).width));
    const bw=w1+w2+24, bh=rows.length*lh+10, bx=pad, by=H-pad-bh; { g.fillStyle='rgba(12,16,20,.82)'; g.fillRect(bx,by,bw,bh);
      rows.forEach((r,i)=>{ txt(g,L(r[0]),bx+8,by+6+lh*(i+1)-4,{size:fz/GS.fs,col:'#9FB0BE',mono:1,w:500}); txt(g,r[1],bx+16+w1,by+6+lh*(i+1)-4,{size:fz/GS.fs,col:'#E6EBEF',mono:1,w:500}); }); } }
  /* class letters */
  const L1=(x,y)=>{ const c=cAt(x,y).c; txt(g,c,X(x),Yp(y)+7,{al:'center',size:sm?16:20,w:700,col:c==='G'?hex(CC.G,1):hex(CC[c],1)}); };
  L1(0,4.5); L1(0,11.5); L1(0,-20); L1(-33,-12); L1(33,12);
  /* R-101 and the RMZ (only if they reach up to this altitude) */
  if(alt<A.RA.hi){ const x0=X(A.RA.x0), x1=X(A.RA.x1), y0=Yp(A.RA.y), y1=Yp(-A.RA.y); g.globalAlpha=S.rActive?1:.35; g.fillStyle=hex(COL.r,.14); g.fillRect(x0,y0,x1-x0,y1-y0); hatch(g,x0,y0,x1-x0,y1-y0,hex(COL.r,.35)); g.strokeStyle=COL.r; g.lineWidth=1.5; g.strokeRect(x0,y0,x1-x0,y1-y0); g.globalAlpha=1;
    txt(g,'R-101',(x0+x1)/2,y0-5,{al:'center',size:10,col:COL.r,w:700}); if(!sm) txt(g,'SFC–6500 ft'+(S.rActive?'':' · '+L(t2('inactive','inaktivt'))),(x0+x1)/2,y1+12,{al:'center',size:9.5,col:'#F0A49A',mono:1,w:500}); }
  else { const x0=X(A.RA.x0), x1=X(A.RA.x1), y0=Yp(A.RA.y), y1=Yp(-A.RA.y); g.setLineDash([2,4]); g.strokeStyle=hex(COL.r,.4); g.strokeRect(x0,y0,x1-x0,y1-y0); g.setLineDash([]); if(!sm) txt(g,L(t2('R-101 below you','R-101 under deg')),(x0+x1)/2,y1+12,{al:'center',size:9.5,col:hex(COL.r,.6),mono:1,w:500}); }
  const rr=A.RMZ.r*k; g.setLineDash(alt<A.RMZ.hi?[5,4]:[2,4]); g.strokeStyle=alt<A.RMZ.hi?COL.rmz:hex(COL.rmz,.4); g.lineWidth=1.5; g.beginPath(); g.arc(X(A.RMZ.x),cy,rr,0,7); g.stroke(); g.setLineDash([]);
  if(alt<A.RMZ.hi){ g.fillStyle=hex(COL.rmz,.10); g.fill(); } txt(g,alt<A.RMZ.hi?'RMZ SFC–2000 ft':L(t2('RMZ below you','RMZ under deg')),X(A.RMZ.x),cy-rr-5,{al:'center',size:9.5,col:alt<A.RMZ.hi?COL.rmz:hex(COL.rmz,.6),mono:1,w:600});
  /* aerodromes, route, scale */
  g.fillStyle='#fff'; g.beginPath(); g.arc(cx,cy,3.5,0,7); g.fill(); txt(g,'Nordvik',cx+6,cy+14,{size:10.5,col:'#fff'});
  g.fillStyle='#C9D2DA'; g.beginPath(); g.arc(X(A.RMZ.x),cy,2.5,0,7); g.fill(); txt(g,'Lia',X(A.RMZ.x)+5,cy+13,{size:10,col:'#C9D2DA'});
  g.strokeStyle='rgba(228,107,174,.55)'; g.setLineDash([6,5]); g.lineWidth=1.4; g.beginPath(); g.moveTo(X(-XMAX),cy); g.lineTo(X(XMAX),cy); g.stroke(); g.setLineDash([]);
  g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=1; const sx=W-pad-10*k-6, sy=H-14; g.beginPath(); g.moveTo(sx,sy); g.lineTo(sx+10*k,sy); g.stroke(); txt(g,'10 NM',sx+5*k,sy-4,{al:'center',size:9.5,col:'#C9D2DA',mono:1,w:500});
  txt(g,'N ↑',pad+4,top+12,{size:10,col:'#9FB0BE',mono:1,w:500});
  /* the altitude of this slice */
  const lbl=L(t2('Airspace at ','Luftrom i '))+fmtAlt(alt); g.font=`600 ${Math.round(12*GS.fs)}px ${SANS}`; const lw=g.measureText(lbl).width+16; g.fillStyle='rgba(12,16,20,.8)'; g.fillRect(W-pad-lw,top-2,lw,22); txt(g,lbl,W-pad-8,top+13,{al:'right',size:12,col:'#fff'});
  const c=!J.ok?COL.bad:J.clr==='svfr'||J.clr==='yes'?COL.amb:COL.ac; plane(g,X(S.x),cy,sm?.85:1,c,1); }

function draw(){ if(view==='side') drawSide(); else drawPlan(); }

/* dragging the aircraft */
function drag(cv,side){ let on=false;
  const mv=e=>{ const r=cv.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
    if(side){ const G=geoS(); S.x=Math.max(-XMAX,Math.min(XMAX,Math.round(G.nm(px)*2)/2)); S.alt=Math.max(0,Math.min(25000,Math.round(G.alt(py)/100)*100)); }
    else if(GP){ S.x=Math.max(-XMAX,Math.min(XMAX,Math.round(((px-GP.cx)/GP.k)*2)/2)); }
    sX.set(S.x); sA.set(S.alt); upd(); };
  cv.addEventListener('pointerdown',e=>{ on=true; cv.setPointerCapture(e.pointerId); mv(e); });
  cv.addEventListener('pointermove',e=>{ if(on) mv(e); });
  ['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,()=>{ on=false; })); }
drag(el('cvS'),true); drag(el('cvP'),false);

/* =====================================================================
   Controls
   ===================================================================== */
const segFr=LAB.seg(el('sFr'),[['VFR','VFR'],['IFR','IFR']],S.fr,v=>{ S.fr=v; upd(); });
const segDn=LAB.seg(el('sDn'),[['day','Day'],['night','Night']],'day',v=>{ S.night=v==='night'; upd(); });
const sX=LAB.slider(el('ctlF'),{label:'Position (NM, west − / east +)',min:-XMAX,max:XMAX,step:.5,v:S.x,f:v=>(v>0?'+':v<0?'−':'')+nf(Math.abs(v),1)+' NM',on:v=>{ S.x=v; upd(); }});
const sA=LAB.slider(el('ctlF'),{label:'Altitude',min:0,max:25000,step:100,v:S.alt,f:v=>fmtAlt(v),on:v=>{ S.alt=v; upd(); }});
const sV=LAB.slider(el('ctlW'),{label:'Visibility',min:.5,max:10,step:.1,v:S.vis,f:v=>fmtVis(v),on:v=>{ S.vis=v; upd(); }});
const sB=LAB.slider(el('ctlW'),{label:'Cloud base',min:500,max:NOCLOUD,step:100,v:S.base,f:v=>fmtBase(v),on:v=>{ S.base=v; upd(); }});
el('rAct').addEventListener('change',e=>{ S.rActive=e.target.checked; upd(); });
function sync(){ segFr.set(S.fr); segDn.set(S.night?'night':'day'); sX.set(S.x); sA.set(S.alt); sV.set(S.vis); sB.set(S.base); el('rAct').checked=S.rActive; }
const PRE=[
 ['circ',t2('VFR circuit at Nordvik','VFR-runde på Nordvik'),{fr:'VFR',x:1.5,alt:1000,vis:10,base:5500,night:false}],
 ['under',t2('VFR under the TMA','VFR under TMA-et'),{fr:'VFR',x:12,alt:3000,vis:10,base:5500,night:false}],
 ['bust',t2('Climbing into the TMA','Stiger inn i TMA-et'),{fr:'VFR',x:12,alt:3800,vis:10,base:6500,night:false}],
 ['e',t2('VFR in class E','VFR i klasse E'),{fr:'VFR',x:-37,alt:11500,vis:10,base:NOCLOUD,night:false}],
 ['svfr',t2('Low cloud: special VFR','Lavt skydekke: spesiell VFR'),{fr:'VFR',x:3,alt:700,vis:3,base:1100,night:false}],
 ['ifrg',t2('IFR in class G','IFR i klasse G'),{fr:'IFR',x:30,alt:3000,vis:10,base:2000,night:false}],
 ['r',t2('Restricted area active','Restriksjonsområde aktivt'),{fr:'VFR',x:-31,alt:3000,vis:10,base:5500,night:false,rActive:true}]];
function drawPre(){ el('pre').innerHTML=PRE.map(([k,n])=>`<button type="button" class="btn sm" data-p="${k}">${L(n)}</button>`).join(''); }
function preset(k){ const p=PRE.find(x=>x[0]===k); if(!p) return; Object.assign(S,{rActive:S.rActive},p[2]); sync(); upd(); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button[data-p]'); if(b) preset(b.dataset.p); });
function upd(){ judge(); drawTabs(); out(); draw(); }

/* =====================================================================
   Try it
   ===================================================================== */
let active=null; const ans={}, touched={}, fbLast={};
const TASKS=[
 {k:'high',v:'side',start:()=>{ Object.assign(S,{fr:'VFR',x:12,alt:2000,vis:10,base:NOCLOUD,night:false}); sync(); upd(); },
  q:t2('VFR, 12 NM east of Nordvik, no clearance and no radio call: climb as high as you legally can.','VFR, 12 NM øst for Nordvik, uten klarering og uten radiokontakt: stig så høyt du lovlig kan.'),
  check:()=>{ if(S.fr!=='VFR') return {ok:0,m:t2('Fly VFR.','Fly VFR.')}; if(Math.abs(S.x)<8||Math.abs(S.x)>15) return {ok:0,m:t2('Stay between 8 and 15 NM from Nordvik.','Hold deg mellom 8 og 15 NM fra Nordvik.')};
    if(J.v.c!=='G') return {ok:0,m:t2(`Now in class ${J.v.c} (${L(J.v.name)}): that needs a clearance. Go down below the TMA's lower limit here.`,`Nå i klasse ${J.v.c} (${L(J.v.name)}): det krever klarering. Gå ned under TMA-ets nedre grense her.`)};
    if(S.alt>=3000) return {ok:1,m:t2(`Yes: ${S.alt} ft in class G, under the TMA that starts at 3500 ft here. In real life keep a margin of a few hundred feet below the limit for altimeter and height-keeping errors.`,`Ja: ${S.alt} ft i klasse G, under TMA-et som starter på 3500 ft her. I virkeligheten holder du en margin på noen hundre fot under grensen for feil i høydemåler og høydeholding.`)};
    return {ok:0,m:t2(`Class G, but you can go higher: the TMA starts at 3500 ft here.`,`Klasse G, men du kan gå høyere: TMA-et starter på 3500 ft her.`)}; }},
 {k:'e',q:t2('You fly VFR in class E. What do you need from ATC?','Du flyr VFR i klasse E. Hva trenger du fra ATC?'),
  opts:[t2('Nothing: no clearance and no radio, unless it is an RMZ or TMZ','Ingenting: verken klarering eller radio, med mindre det er en RMZ eller TMZ'),t2('A clearance and continuous two-way radio','Klarering og kontinuerlig toveis radio'),t2('A clearance, but no radio','Klarering, men ikke radio'),t2('VFR is not allowed in class E','VFR er ikke tillatt i klasse E')],c:0,
  e:[t2('Yes. Class E is controlled airspace for IFR only; VFR flies there without a clearance and gets traffic information only as far as practical.','Ja. Klasse E er kontrollert luftrom bare for IFR; VFR flyr der uten klarering og får trafikkinformasjon bare så langt det er praktisk mulig.'),t2('Not quite. In class E only IFR needs a clearance and the radio. Show it in the model.','Ikke helt. I klasse E er det bare IFR som trenger klarering og radio. Se det i modellen.')],
  show:()=>{ preset('e'); setView('side'); }},
 {k:'svfr',v:'side',start:()=>{ Object.assign(S,{fr:'VFR',x:4,alt:800,vis:10,base:4000,night:false}); sync(); upd(); },
  q:t2('You are about to join the circuit at Nordvik. Set the weather so that you need special VFR, but special VFR is still possible.','Du skal inn i landingsrunden på Nordvik. Still inn været slik at du trenger spesiell VFR, men at spesiell VFR fortsatt er mulig.'),
  check:()=>{ if(J.v.k!=='ctr') return {ok:0,m:t2('Stay in the CTR, below 2500 ft within 8 NM.','Hold deg i CTR-en, under 2500 ft innenfor 8 NM.')}; if(S.fr!=='VFR'||S.night) return {ok:0,m:t2('VFR by day.','VFR om dagen.')};
    if(J.clr==='svfr'&&J.ok) return {ok:1,m:t2(`Yes: ceiling ${S.base} ft and visibility ${fmtVis(S.vis)}. Below 1500 ft or 5 km you need special VFR; at or above 600 ft and 1500 m ATC can give it. You stay clear of cloud with the surface in sight.`,`Ja: skyhøyde ${S.base} ft og sikt ${fmtVis(S.vis)}. Under 1500 ft eller 5 km trenger du spesiell VFR; på eller over 600 ft og 1500 m kan ATC gi det. Du holder deg fri av skyer med bakken i sikte.`)};
    if(J.clr==='yes'&&J.ok) return {ok:0,m:t2('The weather is good enough for normal VFR now: bring the cloud below 1500 ft or the visibility below 5 km.','Været er godt nok for vanlig VFR nå: få skyene under 1500 ft eller sikten under 5 km.')};
    return {ok:0,m:t2('Too bad even for special VFR: keep the ceiling at least 600 ft, visibility at least 1500 m, and fly below the cloud.','For dårlig selv for spesiell VFR: hold skyhøyden minst 600 ft, sikten minst 1500 m, og fly under skyene.')}; }},
 {k:'d',q:t2('You fly IFR in class D. Who does ATC separate you from?','Du flyr IFR i klasse D. Hvem separerer ATC deg fra?'),
  opts:[t2('Other IFR flights only; you get traffic information on VFR','Bare andre IFR-flyginger; du får trafikkinformasjon om VFR'),t2('All other flights','Alle andre flyginger'),t2('Nobody','Ingen'),t2('VFR flights only','Bare VFR-flyginger')],c:0,
  e:[t2('Yes. In class D IFR is separated from IFR only; VFR traffic is passed as traffic information, with avoidance advice on request.','Ja. I klasse D er IFR bare separert fra IFR; VFR-trafikk gis som trafikkinformasjon, med unnvikelsesråd på forespørsel.'),t2('Not quite. Class D separates IFR from IFR only. Separation from VFR starts in class C. Show it in the model.','Ikke helt. Klasse D separerer bare IFR fra IFR. Separasjon fra VFR starter i klasse C. Se det i modellen.')],
  show:()=>{ Object.assign(S,{fr:'IFR',x:-3,alt:1800,vis:10,base:5500,night:false}); sync(); upd(); setView('side'); }}];
function drawTasks(){ el('tasks').innerHTML=TASKS.map((t,i)=>{ let h=`<li class="task" id="task-${t.k}"><span class="n">${L(t2('Task','Oppgave'))} ${i+1}</span><p class="q">${L(t.q)}</p>`;
  if(t.check) h+=`<div class="btns"><button type="button" class="btn pri sm" data-go="${t.k}">${L(t2('Do it in the model','Gjør det i modellen'))} ↑</button></div><span class="fb" id="fb-${t.k}"></span>`;
  else { const a=ans[t.k]; h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?L(t.e[a===t.c?0:1]):''}</span><div class="btns"><button type="button" class="btn sm" data-show="${t.k}">${L(t2('Show it in the model','Vis det i modellen'))} ↑</button></div>`; }
  return h+'</li>'; }).join(''); for(const k in fbLast) delete fbLast[k]; live(); }
function drawTbox(){ const b=el('tbox'); if(!active){ b.hidden=true; return; } const i=TASKS.findIndex(t=>t.k===active);
  b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${i+1}<button type="button" id="tclose" aria-label="${L(t2('Close the task','Lukk oppgaven'))}">×</button></span>${L(TASKS[i].q)}<span class="fb" id="tfb"></span>`;
  el('tclose').onclick=()=>{ active=null; drawTbox(); }; delete fbLast._tb; live(); }
function live(){ if(!J) return; TASKS.filter(t=>t.check&&touched[t.k]).forEach(t=>{ const r=t.check(), h=L(r.m);
  if(fbLast[t.k]!==h){ fbLast[t.k]=h; const f=el('fb-'+t.k); if(f){ f.innerHTML=h; f.classList.toggle('ok',!!r.ok); } }
  if(active===t.k&&fbLast._tb!==h){ fbLast._tb=h; const f=el('tfb'); if(f){ f.innerHTML=h; f.classList.toggle('ok',!!r.ok); } } }); }
const toModel=()=>el('explore').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
el('tasks').addEventListener('click',e=>{ const go=e.target.closest('[data-go]'), o=e.target.closest('[data-o]'), sh=e.target.closest('[data-show]');
  if(go){ const t=TASKS.find(x=>x.k===go.dataset.go); active=t.k; touched[t.k]=1; t.start(); setView(t.v); drawTbox(); toModel(); return; }
  if(o){ const k=o.closest('.task').id.slice(5); ans[k]=+o.dataset.o; drawTasks(); return; }
  if(sh){ const t=TASKS.find(x=>x.k===sh.dataset.show); active=null; drawTbox(); t.show(); toModel(); } });

/* =====================================================================
   Understand: key concept cards and the two tables
   ===================================================================== */
(function(){ if(!window.KCS) return; const {sv,tx}=KCS;
  const go=(p,v)=>()=>{ preset(p); setView(v||'side'); };
  const at=(o,v)=>()=>{ Object.assign(S,o); sync(); upd(); setView(v||'side'); };
  const blk=(x,y,w,h,c,lab)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hex(c,.35)}" stroke="${c}"/>${lab?tx(x+w/2,y+h/2+4,lab,'#fff','middle'):''}`;
  const gnd='<line x1="6" y1="58" x2="194" y2="58" stroke="#5B6B78"/>';
  const K=[
   {grp:t2('The classes','Klassene')},
   {k:'ctl',t:t2('Controlled or uncontrolled','Kontrollert eller ukontrollert'),d:t2('Classes <b>A–E are controlled</b>: ATC gives clearances. <b>F and G are uncontrolled</b>. Each State decides which class each piece of its airspace gets.','Klasse <b>A–E er kontrollert</b>: ATC gir klareringer. <b>F og G er ukontrollert</b>. Hver stat bestemmer hvilken klasse hver del av luftrommet får.'),
    ill:()=>sv(`${gnd}${blk(14,10,100,26,CC.C,'A–E')}${blk(124,36,62,22,CC.G,'F G')}`),click:at({x:12,alt:3000,fr:'VFR'}),to:'#avp'},
   {k:'ab',t:t2('Classes A and B','Klasse A og B'),d:t2('<b>A</b>: IFR only, everyone separated. <b>B</b>: IFR and VFR, everyone separated from everyone. Both need a clearance and the radio.','<b>A</b>: bare IFR, alle separert. <b>B</b>: IFR og VFR, alle separert fra alle. Begge krever klarering og radio.'),
    dd:t2('Neither has the 250 kt limit. Many States use neither; this lab uses C, D, E and G.','Ingen av dem har 250 kt-grensen. Mange stater bruker ingen av dem; denne labben bruker C, D, E og G.'),
    ill:()=>sv(`${blk(20,12,70,40,CC.A,'A · IFR')}${blk(110,12,70,40,CC.A,'B · IFR+VFR')}`)},
   {k:'c',t:t2('Class C','Klasse C'),d:t2('IFR and VFR, both with a clearance and the radio. IFR is separated from <b>everyone</b>; VFR is separated from IFR and gets traffic information on other VFR.','IFR og VFR, begge med klarering og radio. IFR er separert fra <b>alle</b>; VFR er separert fra IFR og får trafikkinformasjon om annen VFR.'),
    dd:t2('250 kt below FL100 applies to VFR here, not to IFR. Typical for TMAs and upper airspace.','250 kt under FL100 gjelder VFR her, ikke IFR. Typisk for TMA og øvre luftrom.'),
    ill:()=>sv(`${blk(10,8,180,48,CC.C,'C')}`),click:go('bust'),to:'#avp'},
   {k:'d',t:t2('Class D','Klasse D'),d:t2('Clearance and radio for all, but only <b>IFR is separated, and only from IFR</b>. VFR gets traffic information on everyone. Typical for a CTR.','Klarering og radio for alle, men bare <b>IFR separeres, og bare fra IFR</b>. VFR får trafikkinformasjon om alle. Typisk for en CTR.'),
    ill:()=>sv(`${gnd}${blk(50,22,100,36,CC.D,'D · CTR')}`),click:go('circ'),to:'#avp'},
   {k:'e',t:t2('Class E','Klasse E'),d:t2('Controlled for <b>IFR only</b>. VFR needs no clearance and no radio, and nobody separates IFR from it.','Kontrollert <b>bare for IFR</b>. VFR trenger verken klarering eller radio, og ingen separerer IFR fra den.'),
    dd:t2('The class where a clearance-holding IFR flight and a silent VFR flight can meet. Lookout and traffic information matter most here.','Klassen der en IFR-flyging med klarering og en taus VFR-flyging kan møtes. Utkikk og trafikkinformasjon betyr mest her.'),
    ill:()=>sv(`${blk(10,8,180,48,CC.E,'E')}`),click:go('e'),to:'#avp'},
   {k:'fg',t:t2('Classes F and G','Klasse F og G'),d:t2('Uncontrolled: <b>no clearance, no separation</b>. Flight information if you ask; F adds an advisory service for IFR. IFR must be able to talk to ATS.','Ukontrollert: <b>ingen klarering, ingen separasjon</b>. Flygeinformasjon hvis du spør; F gir i tillegg rådgivningstjeneste for IFR. IFR må kunne snakke med ATS.'),
    ill:()=>sv(`${gnd}${blk(10,30,180,28,CC.G,'G')}`),click:go('ifrg'),to:'#avp'},
   {grp:t2('Shapes and limits','Former og grenser')},
   {k:'ctr',t:t2('Control zone (CTR)','Kontrollsone (CTR)'),d:t2('Controlled airspace from the <b>surface</b> up to an upper limit, around an aerodrome. It protects arrivals and departures.','Kontrollert luftrom fra <b>bakken</b> opp til en øvre grense, rundt en flyplass. Den beskytter ankomster og avganger.'),
    ill:()=>sv(`${gnd}${blk(60,26,80,32,CC.D,'CTR')}`),click:go('circ'),to:'#avp'},
   {k:'tma',t:t2('TMA and control areas','TMA og kontrollområder'),d:t2('A control area starts at a <b>lower limit</b> above the ground. A TMA is one around busy aerodromes, often <b>stepped</b> so its lower limit rises away from the field; an airway is one shaped as a corridor.','Et kontrollområde starter på en <b>nedre grense</b> over bakken. Et TMA ligger rundt travle flyplasser, ofte i <b>trinn</b> slik at den nedre grensen stiger bort fra flyplassen; en luftvei er et formet som en korridor.'),
    ill:()=>sv(`${gnd}<path d="M20,40 L50,40 L50,32 L80,32 L80,24 L120,24 L120,32 L150,32 L150,40 L180,40 L180,6 L20,6 Z" fill="${hex(CC.C,.35)}" stroke="${CC.C}"/>${blk(80,24,40,34,CC.D,'')}${tx(100,18,'TMA','#fff','middle')}`),click:go('under'),to:'#avp'},
   {k:'lim',t:t2('Reading the limits','Les grensene'),d:t2('“3500 ft – FL195”: the volume begins <b>at</b> 3500 ft. Fly under it and you are not in it. Below the transition altitude limits are altitudes; above it, flight levels.','«3500 ft – FL195»: volumet begynner <b>på</b> 3500 ft. Fly under, og du er ikke i det. Under overgangshøyden er grensene høyder; over den, flygenivåer.'),
    ill:()=>sv(`${gnd}${blk(10,8,180,24,CC.C,'3500 ft – FL195')}<line x1="10" y1="44" x2="190" y2="44" stroke="#E46BAE" stroke-dasharray="4 3"/>${tx(100,54,'3000 ft · G','#c9d2da','middle')}`),click:go('under'),to:'#avp'},
   {k:'fl195',dp:true,t:t2('FL195 and above','FL195 og over'),d:t2('No <b>VFR above FL195</b> unless the authority allows it, and never above FL285 where 1000 ft vertical separation is used above FL290.','Ingen <b>VFR over FL195</b> uten at myndigheten tillater det, og aldri over FL285 der 1000 ft vertikal separasjon brukes over FL290.'),
    ill:()=>sv(`<line x1="6" y1="30" x2="194" y2="30" stroke="#EC5A47" stroke-dasharray="4 3"/>${tx(100,24,'FL195','#EC5A47','middle')}${tx(100,48,'VFR','#c9d2da','middle')}`),click:at({fr:'VFR',x:0,alt:21000}),to:'#avp'},
   {grp:t2('VFR in the weather','VFR i været')},
   {k:'vmc',t:t2('VMC minima: three bands','VMC-minima: tre lag'),d:t2('At and above FL100: <b>8 km</b>, 1500 m and 1000 ft from cloud. Below that: <b>5 km</b>, 1500 m and 1000 ft. At or below 3000 ft in F and G: 5 km, <b>clear of cloud, surface in sight</b>.','På og over FL100: <b>8 km</b>, 1500 m og 1000 ft fra skyer. Under det: <b>5 km</b>, 1500 m og 1000 ft. På eller under 3000 ft i F og G: 5 km, <b>fri av skyer, bakken i sikte</b>.'),
    dd:t2('3000 ft is AMSL or 1000 ft above the terrain, whichever is higher. In F and G the authority may allow less visibility, not below 1500 m, at 140 kt or less.','3000 ft er AMSL eller 1000 ft over terrenget, det som er høyest. I F og G kan myndigheten tillate mindre sikt, ikke under 1500 m, ved 140 kt eller mindre.'),
    ill:()=>sv(`<line x1="6" y1="18" x2="194" y2="18" stroke="#F0B440" stroke-dasharray="3 3"/><line x1="6" y1="40" x2="194" y2="40" stroke="#AEB8C1" stroke-dasharray="3 3"/>${tx(10,14,'8 km','#F0B440')}${tx(10,34,'5 km · 1000 ft','#c9d2da')}${tx(10,56,'G: clear of cloud','#c9d2da')}`),click:at({fr:'VFR',x:20,alt:4200,base:5000,vis:10}),to:'#avp'},
   {k:'ctrwx',t:t2('VFR into a CTR: 1500 ft and 5 km','VFR inn i CTR: 1500 ft og 5 km'),d:t2('Without special VFR, no VFR take-off, landing or circuit in a CTR when the ceiling is <b>below 1500 ft</b> or the ground visibility <b>below 5 km</b>.','Uten spesiell VFR: ingen VFR-avgang, landing eller landingsrunde i en CTR når skyhøyden er <b>under 1500 ft</b> eller bakkesikten <b>under 5 km</b>.'),
    ill:()=>sv(`${gnd}<rect x="6" y="14" width="188" height="10" fill="rgba(201,210,218,.45)"/>${tx(100,40,'1500 ft · 5 km','#c9d2da','middle')}`),click:go('svfr'),to:'#avp'},
   {k:'svfr',t:t2('Special VFR','Spesiell VFR'),d:t2('A clearance to fly VFR in a CTR below those minima: <b>by day</b>, clear of cloud, surface in sight, at least <b>1500 m</b> flight visibility, <b>140 kt</b> or less. ATC will not give it below 600 ft ceiling or 1500 m ground visibility.','En klarering til å fly VFR i en CTR under de minima: <b>om dagen</b>, fri av skyer, bakken i sikte, minst <b>1500 m</b> flysikt, maks <b>140 kt</b>. ATC gir det ikke under 600 ft skyhøyde eller 1500 m bakkesikt.'),
    ill:()=>sv(`${gnd}<rect x="6" y="20" width="188" height="10" fill="rgba(201,210,218,.45)"/>${tx(100,48,'SVFR · 1500 m · 140 kt','#F0B440','middle')}`),click:go('svfr'),to:'#avp'},
   {k:'night',dp:true,t:t2('VFR at night','VFR om natten'),d:t2('Where it is allowed: a <b>ceiling of at least 1500 ft</b>, no reduced-visibility exceptions, and continuous sight of the surface at and below 3000 ft.','Der det er tillatt: <b>skyhøyde minst 1500 ft</b>, ingen unntak for redusert sikt, og kontinuerlig bakkesikt på og under 3000 ft.'),
    ill:()=>sv(`<rect x="0" y="0" width="200" height="64" fill="#0b1118"/>${[20,60,110,150,180].map(x=>`<circle cx="${x}" cy="${8+(x%3)*4}" r="1" fill="#fff"/>`).join('')}${tx(100,46,'ceiling ≥ 1500 ft','#c9d2da','middle')}`),click:at({fr:'VFR',night:true,x:12,alt:1000,base:1300,vis:10}),to:'#avp'},
   {k:'spd',t:t2('250 kt below FL100','250 kt under FL100'),d:t2('A speed limit of <b>250 kt IAS below 10 000 ft</b> (FL100 if the transition altitude is lower) for VFR in classes C–G and for IFR in D–G.','En fartsgrense på <b>250 kt IAS under 10 000 ft</b> (FL100 hvis overgangshøyden er lavere) for VFR i klasse C–G og for IFR i D–G.'),
    ill:()=>sv(`<line x1="6" y1="22" x2="194" y2="22" stroke="#F0B440" stroke-dasharray="3 3"/>${tx(10,18,'FL100','#F0B440')}${tx(100,46,'≤ 250 kt IAS','#c9d2da','middle')}`),click:at({fr:'IFR',x:-37,alt:8000}),to:'#avp'},
   {grp:t2('Zones and areas','Soner og områder')},
   {k:'rmz',t:t2('RMZ and TMZ','RMZ og TMZ'),d:t2('In a <b>radio mandatory zone</b> you keep a listening watch and call before you enter. In a <b>transponder mandatory zone</b> you carry and operate a Mode A/C or Mode S transponder.','I en <b>radiopliktig sone (RMZ)</b> holder du lyttevakt og melder deg før du flyr inn. I en <b>transponderpliktig sone (TMZ)</b> har du og bruker en transponder med Mode A/C eller Mode S.'),
    dd:t2('They add a requirement to the class underneath; an RMZ in class G is still class G: no clearance.','De legger et krav til klassen under; en RMZ i klasse G er fortsatt klasse G: ingen klarering.'),
    ill:()=>sv(`${gnd}<rect x="60" y="24" width="80" height="34" fill="${hex(COL.rmz,.12)}" stroke="${COL.rmz}" stroke-dasharray="4 3"/>${tx(100,44,'RMZ','#F0B440','middle')}`),click:at({fr:'VFR',x:33,alt:1500,base:5500,vis:10}),to:'#avp'},
   {k:'pra',t:t2('P, R and D areas','P-, R- og D-områder'),d:t2('<b>Prohibited</b> and <b>restricted</b> areas may not be entered except under their published conditions or with permission. A <b>danger</b> area warns of activity that may be dangerous to aircraft.','<b>Forbudte</b> og <b>restriksjonsområder</b> kan ikke flys inn i unntatt etter de publiserte vilkårene eller med tillatelse. Et <b>fareområde</b> varsler om aktivitet som kan være farlig for luftfartøy.'),
    ill:()=>sv(`${gnd}<rect x="70" y="16" width="60" height="42" fill="${hex(COL.r,.14)}" stroke="${COL.r}"/>${tx(100,40,'R','#EC5A47','middle')}`),click:go('r'),to:'#avp'}];
  KCS.render(el('kcGrid'),K); })();
function drawTables(){ const T=A.TAB, yn=o=>`<span class="${o.en==='No'?'n':'y'}">${L(o)}</span>`;
  const H=[t2('Class','Klasse'),t2('Flights','Flyginger'),t2('Separation','Separasjon'),t2('Service','Tjeneste'),t2('Speed limit','Fartsgrense'),t2('Radio','Radio'),t2('Clearance','Klarering')];
  let h=`<caption>${L(t2('Airspace classes','Luftromsklasser'))}<small>${L(t2('SERA Appendix 4. In an RMZ VFR (E, F, G) and IFR (F, G) must also keep a listening watch.','SERA tillegg 4. I en RMZ må VFR (E, F, G) og IFR (F, G) i tillegg holde lyttevakt.'))}</small></caption><tr>${H.map(x=>`<th>${L(x)}</th>`).join('')}</tr>`;
  'ABCDEFG'.split('').forEach(c=>{ ['IFR','VFR'].forEach((fr,i)=>{ const r=T[c][fr];
    h+=`<tr class="${i?'':'top'}">${i?'<td></td>':`<td class="cls" rowspan="1" style="color:${CC[c]}">${c}</td>`}<td>${fr}</td>`+(r?`<td>${L(r.sep)}</td><td>${L(r.svc)}</td><td>${L(r.spd)}</td><td>${yn(r.radio)}</td><td>${yn(r.clr)}</td>`:`<td colspan="5" class="n">${L(t2('Not permitted','Ikke tillatt'))}</td>`)+'</tr>'; }); });
  el('tCls').innerHTML=h;
  const V=[t2('Where','Hvor'),t2('Classes','Klasser'),t2('Flight visibility','Flysikt'),t2('Distance from cloud','Avstand fra skyer')];
  const rows=[[t2('At and above FL100','På og over FL100'),'A*** B C D E F G','8 km',t2('1500 m horizontally, 1000 ft vertically','1500 m horisontalt, 1000 ft vertikalt')],
   [t2('Below FL100, above 3000 ft AMSL or 1000 ft above terrain (the higher)','Under FL100, over 3000 ft AMSL eller 1000 ft over terrenget (det høyeste)'),'A*** B C D E F G','5 km',t2('1500 m horizontally, 1000 ft vertically','1500 m horisontalt, 1000 ft vertikalt')],
   [t2('At and below 3000 ft AMSL or 1000 ft above terrain (the higher)','På og under 3000 ft AMSL eller 1000 ft over terrenget (det høyeste)'),'A*** B C D E','5 km',t2('1500 m horizontally, 1000 ft vertically','1500 m horisontalt, 1000 ft vertikalt')],
   ['','F G',t2('5 km (the authority may allow down to 1500 m at 140 kt or less)','5 km (myndigheten kan tillate ned til 1500 m ved 140 kt eller mindre)'),t2('Clear of cloud and with the surface in sight','Fri av skyer og med bakken i sikte')]];
  el('tVmc').innerHTML=`<caption>${L(t2('VMC visibility and distance from cloud','VMC: sikt og avstand fra skyer'))}<small>${L(t2('SERA.5001, Table S5-1. *** VFR is not permitted in class A; the minima there are for guidance only.','SERA.5001, tabell S5-1. *** VFR er ikke tillatt i klasse A; minima der er bare veiledende.'))}</small></caption><tr>${V.map(x=>`<th>${L(x)}</th>`).join('')}</tr>`+rows.map(r=>`<tr>${r.map(c=>`<td>${typeof c==='string'?c:L(c)}</td>`).join('')}</tr>`).join(''); }
function drawMaid(){ el('maid').innerHTML=`<span class="k">${L(t2('The one thing to remember','Det ene du skal huske'))}</span><b>${L(t2('Before you enter, know the class, its limits and what it asks of you.','Før du flyr inn: kjenn klassen, grensene og hva den krever av deg.'))}</b><p>${L(t2('A to D: clearance and radio for everyone. E: only IFR needs them. F and G: nobody does, but in an RMZ you still call. Then check the weather against the VMC minima for that class and altitude.','A til D: klarering og radio for alle. E: bare IFR trenger dem. F og G: ingen gjør det, men i en RMZ melder du deg fortsatt. Sjekk så været mot VMC-minima for den klassen og høyden.'))}</p>`; }

/* =====================================================================
   Test yourself
   ===================================================================== */
LAB.quiz(el('qbox'),'airspace',()=>LAB.shuffle([
 {q:t2('Which airspace classes are controlled airspace?','Hvilke luftromsklasser er kontrollert luftrom?'),a:[t2('A, B, C, D and E','A, B, C, D og E'),t2('A, B and C only','Bare A, B og C'),t2('A to F','A til F'),t2('All classes when ATC is open','Alle klasser når ATC er åpen')],c:0,e:t2('ATC gives clearances in A to E. F and G are uncontrolled: an advisory service (F) and flight information at most.','ATC gir klareringer i A til E. F og G er ukontrollert: rådgivningstjeneste (F) og flygeinformasjon på det meste.')},
 {q:t2('VFR in class D. Which is true?','VFR i klasse D. Hva stemmer?'),a:[t2('You need a clearance and the radio, but ATC does not separate you from other traffic','Du trenger klarering og radio, men ATC separerer deg ikke fra annen trafikk'),t2('ATC separates you from IFR traffic','ATC separerer deg fra IFR-trafikk'),t2('No clearance is needed','Ingen klarering trengs'),t2('VFR is not permitted','VFR er ikke tillatt')],c:0,e:t2('Class D: clearance and radio for all; separation only IFR from IFR. VFR gets traffic information on IFR and other VFR.','Klasse D: klarering og radio for alle; separasjon bare IFR fra IFR. VFR får trafikkinformasjon om IFR og annen VFR.')},
 {q:t2('In which class does VFR first get separation from IFR?','I hvilken klasse får VFR først separasjon fra IFR?'),a:[t2('C','C'),t2('D','D'),t2('E','E'),t2('G','G')],c:0,e:t2('In class C VFR is separated from IFR. In D and E nobody separates VFR from anything.','I klasse C er VFR separert fra IFR. I D og E separerer ingen VFR fra noe.')},
 {q:t2('Where does the 250 kt IAS limit below FL100 NOT apply to IFR flights?','Hvor gjelder IKKE grensen på 250 kt IAS under FL100 for IFR-flyginger?'),a:[t2('Classes A, B and C','Klasse A, B og C'),t2('Classes D and E','Klasse D og E'),t2('Class G','Klasse G'),t2('It applies in all classes','Den gjelder i alle klasser')],c:0,e:t2('SERA Appendix 4: IFR has no speed limit in A, B and C; in D to G 250 kt below FL100 applies. For VFR it applies in C to G.','SERA tillegg 4: IFR har ingen fartsgrense i A, B og C; i D til G gjelder 250 kt under FL100. For VFR gjelder den i C til G.')},
 {q:t2('VFR at 6000 ft in class G. What are the VMC minima?','VFR på 6000 ft i klasse G. Hva er VMC-minima?'),a:[t2('5 km, 1500 m horizontally and 1000 ft vertically from cloud','5 km, 1500 m horisontalt og 1000 ft vertikalt fra skyer'),t2('5 km, clear of cloud and surface in sight','5 km, fri av skyer og bakken i sikte'),t2('8 km, 1500 m and 1000 ft from cloud','8 km, 1500 m og 1000 ft fra skyer'),t2('1500 m, clear of cloud','1500 m, fri av skyer')],c:0,e:t2('Above 3000 ft (or 1000 ft above terrain) and below FL100 every class has 5 km, 1500 m and 1000 ft. “Clear of cloud” is only for F and G at or below 3000 ft.','Over 3000 ft (eller 1000 ft over terrenget) og under FL100 har alle klasser 5 km, 1500 m og 1000 ft. «Fri av skyer» gjelder bare F og G på eller under 3000 ft.')},
 {q:t2('VFR at FL115 in class E. Minimum flight visibility?','VFR på FL115 i klasse E. Minste flysikt?'),a:[t2('8 km','8 km'),t2('5 km','5 km'),t2('1500 m','1500 m'),t2('10 km','10 km')],c:0,e:t2('At and above FL100 (10 000 ft) VMC needs 8 km, in every class.','På og over FL100 (10 000 ft) krever VMC 8 km, i alle klasser.')},
 {q:t2('METAR at your destination in a CTR: ceiling 1200 ft, visibility 8 km. You want to land VFR. What do you need?','METAR på destinasjonen i en CTR: skyhøyde 1200 ft, sikt 8 km. Du vil lande VFR. Hva trenger du?'),a:[t2('A special VFR clearance','En spesiell VFR-klarering'),t2('Nothing extra: the visibility is above 5 km','Ingenting ekstra: sikten er over 5 km'),t2('An IFR clearance','En IFR-klarering'),t2('It is not possible: below 1500 ft is IMC','Det er ikke mulig: under 1500 ft er IMC')],c:0,e:t2('Both conditions must be met for normal VFR in a CTR: ceiling 1500 ft and ground visibility 5 km. With 1200 ft you need special VFR, which ATC can give by day down to 600 ft and 1500 m.','Begge vilkårene må være oppfylt for vanlig VFR i en CTR: skyhøyde 1500 ft og bakkesikt 5 km. Med 1200 ft trenger du spesiell VFR, som ATC kan gi om dagen ned til 600 ft og 1500 m.')},
 {q:t2('Special VFR: which is NOT a condition?','Spesiell VFR: hva er IKKE et vilkår?'),a:[t2('At least 5 km flight visibility','Minst 5 km flysikt'),t2('Clear of cloud with the surface in sight','Fri av skyer med bakken i sikte'),t2('140 kt IAS or less','140 kt IAS eller mindre'),t2('An ATC clearance','En ATC-klarering')],c:0,e:t2('Special VFR needs at least 1500 m flight visibility (800 m for helicopters), not 5 km.','Spesiell VFR krever minst 1500 m flysikt (800 m for helikopter), ikke 5 km.')},
 {q:t2('A TMA has the limits 3500 ft – FL195. You fly VFR at 3000 ft under it on QNH. Which class are you in?','Et TMA har grensene 3500 ft – FL195. Du flyr VFR på 3000 ft under det på QNH. Hvilken klasse er du i?'),a:[t2('The class of the airspace below the TMA, for example G','Klassen til luftrommet under TMA-et, for eksempel G'),t2('The TMA’s class, because you are under its lateral boundary','TMA-ets klasse, fordi du er innenfor sidegrensen'),t2('Always class E','Alltid klasse E'),t2('Class A','Klasse A')],c:0,e:t2('A volume starts at its lower limit. Under it you are in whatever airspace lies below, often class G.','Et volum starter på den nedre grensen. Under den er du i det luftrommet som ligger under, ofte klasse G.')},
 {q:t2('You enter an RMZ in class G, VFR. What must you do?','Du flyr inn i en RMZ i klasse G, VFR. Hva må du gjøre?'),a:[t2('Call before entering and keep a continuous listening watch','Melde deg før du flyr inn og holde kontinuerlig lyttevakt'),t2('Get an ATC clearance','Få ATC-klarering'),t2('Squawk 7000 and nothing else','Sette 7000 og ingenting annet'),t2('Nothing: it is class G','Ingenting: det er klasse G')],c:0,e:t2('SERA.6005: in an RMZ you keep a continuous air-ground voice watch and make an initial call before entering. It is still class G: no clearance.','SERA.6005: i en RMZ holder du kontinuerlig lyttevakt og gir et første anrop før du flyr inn. Det er fortsatt klasse G: ingen klarering.')},
 {q:t2('What does a TMZ require?','Hva krever en TMZ?'),a:[t2('A working transponder with Mode A and C or Mode S','En fungerende transponder med Mode A og C eller Mode S'),t2('A clearance','En klarering'),t2('Continuous two-way radio','Kontinuerlig toveis radio'),t2('IFR only','Bare IFR')],c:0,e:t2('SERA.6005(b): all flights in a TMZ carry and operate an SSR transponder on Modes A and C or Mode S, unless other provisions are published.','SERA.6005(b): alle flyginger i en TMZ har og bruker en SSR-transponder med Mode A og C eller Mode S, med mindre andre bestemmelser er publisert.')},
 {q:t2('IFR in class G. Which is true?','IFR i klasse G. Hva stemmer?'),a:[t2('No clearance and no separation; flight information if requested','Ingen klarering og ingen separasjon; flygeinformasjon på forespørsel'),t2('An IFR clearance is required','IFR-klarering kreves'),t2('ATC separates IFR from IFR','ATC separerer IFR fra IFR'),t2('IFR is not permitted in class G','IFR er ikke tillatt i klasse G')],c:0,e:t2('Class G gives IFR and VFR flight information on request, nothing more. IFR flights must be able to talk to ATS.','Klasse G gir IFR og VFR flygeinformasjon på forespørsel, ikke mer. IFR-flyginger må kunne snakke med ATS.')},
 {q:t2('Above which level is VFR not allowed unless the authority allows it?','Over hvilket nivå er VFR ikke tillatt uten at myndigheten tillater det?'),a:[t2('FL195','FL195'),t2('FL100','FL100'),t2('FL285','FL285'),t2('FL245','FL245')],c:0,e:t2('SERA.5005: no VFR above FL195 unless in reserved airspace or authorised, and never above FL285 where 1000 ft separation applies above FL290.','SERA.5005: ingen VFR over FL195 uten i reservert luftrom eller med tillatelse, og aldri over FL285 der 1000 ft separasjon gjelder over FL290.')},
 {q:t2('A control zone (CTR) extends…','En kontrollsone (CTR) strekker seg …'),a:[t2('from the surface up to a specified upper limit','fra bakken opp til en fastsatt øvre grense'),t2('from a lower limit above the ground','fra en nedre grense over bakken'),t2('only above FL195','bare over FL195'),t2('as a corridor between aerodromes','som en korridor mellom flyplasser')],c:0,e:t2('A CTR starts at the surface. A control area (CTA, TMA, airway) starts at a lower limit above the ground; an airway is a CTA shaped as a corridor.','En CTR starter ved bakken. Et kontrollområde (CTA, TMA, luftvei) starter på en nedre grense over bakken; en luftvei er et CTA formet som en korridor.')},
 {q:t2('VFR at night where it is allowed. Minimum ceiling?','VFR om natten der det er tillatt. Minste skyhøyde?'),a:[t2('1500 ft','1500 ft'),t2('1000 ft','1000 ft'),t2('600 ft','600 ft'),t2('3000 ft','3000 ft')],c:0,e:t2('SERA.5005: at night the ceiling is at least 1500 ft, the reduced-visibility exceptions do not apply, and you keep the surface in sight at and below 3000 ft.','SERA.5005: om natten er skyhøyden minst 1500 ft, unntakene for redusert sikt gjelder ikke, og du har bakken i sikte på og under 3000 ft.')}
]),12);

/* =====================================================================
   Start
   ===================================================================== */
LAB.start('airsp');
judge(); sync(); drawPre(); drawTabs(); legend(); drawTasks(); drawTables(); drawMaid(); out();
{ const keepS=LAB.keep(S); LAB.reset(()=>{ keepS(); sync(); upd(); }); }
function fromHash(){ const h=location.hash.slice(1); if(h==='plan'){ setView('plan'); requestAnimationFrame(()=>el('explore').scrollIntoView({block:'start'})); } }
addEventListener('hashchange',fromHash); fromHash(); draw();
document.addEventListener('labdepth',()=>draw());
LAB.onLang(()=>{ drawPre(); drawTabs(); legend(); drawTasks(); drawTables(); drawMaid(); out(); draw(); });
})();
