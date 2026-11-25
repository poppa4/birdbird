/* NORDAP – radio trainer UI (radio-drills.html). Engine: radiocore.js + radioscen.js (works without AI).
   Voice out: speechSynthesis with ICAO pronunciation, squelch and band-limited static from WebAudio (optional).
   Voice in: SpeechRecognition (Chrome, Edge, Safari) with hold-to-talk (button or space bar); typing is fully equivalent.
   Progress: naeroson-radio-* keys (synced by account.js as "progress"). */
(function(){
'use strict';
const {L,el}=LAB, R=RADIOCORE, S=RADIOSCEN, tr=R.tr;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=sel=>document.querySelector(sel);

/* ---------------- storage ---------------- */
const K={prefs:'naeroson-radio-prefs',srs:'naeroson-radio-srs',stats:'naeroson-radio-stats',guide:'naeroson-radio-guide',coach:'naeroson-radio-coach'};
const jget=(k,d)=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'null'); return v==null?d:v; }catch(e){ return d; } };
const jset=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
const P=Object.assign({level:'intermediate',callsign:'LN-NAE',voice:true,rate:1,fx:true,auto:true,mic:'en-GB'},jget(K.prefs,{}));
const saveP=()=>jset(K.prefs,P);
const best=k=>{ try{ return +(localStorage.getItem('naeroson-radio-'+k)||0); }catch(e){ return 0; } };

/* ---------------- texts ---------------- */
const GROUPS={
  basic:{t:tr('Basics','Grunnleggende'),d:tr('Phonetic alphabet, numbers, callsigns, standard words','Fonetisk alfabet, tall, kallesignaler, standardord'),ic:'M5 6h14M5 12h14M5 18h9'},
  vfr:{t:tr('VFR flight','VFR-tur'),d:tr('Taxi, zones, FIS, AFIS, circuits, uncontrolled fields','Taksing, soner, FIS, AFIS, landingsrunder, ukontrollerte plasser'),ic:'M3 15l9-9 9 9M12 6v14'},
  ifr:{t:tr('IFR flight','IFR-tur'),d:tr('Clearance, SID, levels, holds, vectors, approach','Klarering, SID, nivåer, venting, vektorer, innflyging'),ic:'M4 20l8-16 8 16M8 13h8'},
  emerg:{t:tr('Emergencies','Nødsituasjoner'),d:tr('MAYDAY, PAN PAN, radio failure, lost, fuel, diversion','MAYDAY, PAN PAN, radiosvikt, usikker posisjon, drivstoff, mål-endring'),ic:'M12 4l9 16H3zM12 10v4M12 17v.5'},
  airline:{t:tr('Airline: A320 crew','Flyselskap: A320-besetning'),d:tr('Two pilots: who says what, to whom, after which checklist','To piloter: hvem sier hva, til hvem, etter hvilken sjekkliste'),ic:'M2 13l8-2 5-7h2l-2 7 5-1 2-2h2l-1 4 1 4h-2l-2-2-5-1 2 7h-2l-5-7-8-2z'},
  quick:{t:tr('Quick drill','Kjapp drill'),d:tr('2 minutes · six readbacks, your weak ones first','2 minutter · seks tilbakelesinger, de svake først'),ic:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2'}
};
const LEVELS={beginner:{t:tr('Learning','Lære'),d:tr('New to the radio: slow controller, the items to include are shown, three tries per call.','Ny på radio: rolig flygeleder, elementene du skal ta med vises, tre forsøk per oppkall.')},
  intermediate:{t:tr('Refresher','Oppfriskning'),d:tr('You have flown before: normal pace, a hint only if you ask, two tries.','Du har flydd før: normalt tempo, hint bare om du ber om det, to forsøk.')},
  check:{t:tr('Check-ready','Klar for sjekk'),d:tr('Fast, more static, controller text hidden until you answer, strict readbacks.','Raskt, mer støy, flygelederens tekst skjult til du svarer, strenge tilbakelesinger.')}};
const CAT={rb:tr('Readbacks','Tilbakelesinger'),call:tr('Calls and reports','Oppkall og meldinger'),copy:tr('Copying','Notering'),emerg:tr('Emergency calls','Nødmeldinger'),basic:tr('Basics','Grunnleggende')};
const KIND={cs:tr('Callsign','Kallesignal'),stn:tr('Station called','Stasjon'),rwy:tr('Runway','Rullebane'),qnh:tr('QNH','QNH'),alt:tr('Altitude (QNH)','Høyde (QNH)'),fl:tr('Flight level','Flygenivå'),hdg:tr('Heading','Kurs'),turn:tr('Turn direction','Svingretning'),
  sq:tr('Squawk','Squawk'),freq:tr('Frequency','Frekvens'),info:tr('ATIS letter','ATIS-bokstav'),letter:tr('ATIS letter','ATIS-bokstav'),hp:tr('Holding point','Holdepunkt'),hs:tr('Hold short','Hold short'),fix:tr('Fixes and routes','Punkter og ruter'),
  spd:tr('Speed','Fart'),trk:tr('Inbound track','Innkommende kurs'),num:tr('Numbers','Tall'),wind:tr('Wind','Vind'),phr:tr('Key phrases','Nøkkelfraser'),last:tr('Ending a blind call','Avslutning av blindmelding'),
  spell:tr('Phonetic alphabet','Fonetisk alfabet'),say:tr('Numbers spoken','Tall uttalt'),abbr:tr('Abbreviation','Forkorting')};
const SYM={ok:'✓',warn:'!',wrong:'✕',miss:'✕'};

/* ---------------- audio: squelch and static ---------------- */
const AU={ctx:null,hiss:null,
  init(){ if(this.ctx) { if(this.ctx.state==='suspended') this.ctx.resume(); return this.ctx; } const A=window.AudioContext||window.webkitAudioContext; if(!A) return null; try{ this.ctx=new A(); }catch(e){ return null; }
    const n=this.ctx.sampleRate*2, b=this.ctx.createBuffer(1,n,this.ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; this.buf=b; return this.ctx; },
  src(gain,f,q){ const c=this.ctx, s=c.createBufferSource(); s.buffer=this.buf; s.loop=true; const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f||1600; bp.Q.value=q||0.6; const g=c.createGain(); g.gain.value=gain; s.connect(bp); bp.connect(g); g.connect(c.destination); s.start(); return {s,g}; },
  burst(ms,gain){ if(!P.fx||!this.init()) return; const c=this.ctx, x=this.src(0,1900,0.8); x.g.gain.setValueAtTime(gain||0.16,c.currentTime); x.g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+ms/1000); x.s.stop(c.currentTime+ms/1000+0.02); },
  on(level){ if(!P.fx||!this.init()) return; this.off(); this.burst(70,0.2); this.hiss=this.src(level,1500,0.5); },
  off(){ if(this.hiss){ try{ const c=this.ctx; this.hiss.g.gain.setTargetAtTime(0,c.currentTime,0.02); this.hiss.s.stop(c.currentTime+0.1); }catch(e){} this.hiss=null; this.burst(140,0.12); } },
  click(){ if(!P.fx||!this.init()) return; const c=this.ctx, o=c.createOscillator(), g=c.createGain(); o.frequency.value=1200; g.gain.setValueAtTime(0.05,c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.05); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+0.06); }
};

/* ---------------- speech out ---------------- */
const TTS='speechSynthesis' in window;
let VOICE=null;
function pickVoice(){ if(!TTS) return; const vs=speechSynthesis.getVoices(); if(!vs.length) return;
  const pref=[/Google UK English Male/,/Daniel/,/Arthur/,/Ryan/,/George/,/Google UK English Female/,/Serena|Kate|Martha/];
  for(const p of pref){ const v=vs.find(v=>p.test(v.name)&&/^en/i.test(v.lang)); if(v){ VOICE=v; return; } }
  VOICE=vs.find(v=>/en-GB/i.test(v.lang))||vs.find(v=>/en-(IE|AU|IN)/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null; }
if(TTS){ pickVoice(); try{ speechSynthesis.addEventListener('voiceschanged',pickVoice); }catch(e){} }
let speakId=0, NVcur=null;
const NV=window.NVOICE||{supported:false};
const natural=()=>NV.supported&&P.tts!=='browser';
function hush(){ speakId++; if(TTS) try{ speechSynthesis.cancel(); }catch(e){} if(NVcur){ NVcur.stop(); NVcur=null; } AU.off(); rx(false); }
/* natural voice: downloaded once (about 90 MB), the browser voice speaks until it is ready */
let nvP=null;
function nvPreload(){ if(nvP) return nvP; nvP=nvLoad().finally(()=>{ if(!NV.ready) nvP=null; }); return nvP; }
function nvLoad(){
  const n=el('ttsEngNote'); const ready=()=>{ if(n) n.textContent=L({en:'Natural voice ready. Generated on this device.',no:'Naturlig stemme klar. Lages på denne enheten.'}); };
  if(NV.ready){ ready(); return Promise.resolve(); }
  if(n) n.textContent=L({en:'Downloading the natural voice (about 90 MB, once). The browser voice speaks meanwhile.',no:'Laster ned den naturlige stemmen (omtrent 90 MB, én gang). Nettleserstemmen snakker så lenge.'});
  return NV.load(f=>{ if(n) n.textContent=L({en:'Downloading the natural voice',no:'Laster ned den naturlige stemmen'})+` ${Math.round(f*100)} %`; }).then(ready)
    .catch(()=>{ if(n) n.textContent=L({en:'The natural voice could not be downloaded here. The browser voice is used.',no:'Den naturlige stemmen kunne ikke lastes ned her. Nettleserstemmen brukes.'}); });
}
function speak(text,o){ o=o||{}; const id=++speakId;
  return new Promise(res=>{
    if(!P.voice||!text||!(TTS||NV.ready)){ if(natural()&&P.voice&&text) nvPreload(); res(false); return; }
    try{ if(TTS) speechSynthesis.cancel(); }catch(e){}
    const parts=R.spoken(text).split(/(?<=\.)\s+/).filter(Boolean); let k=0;
    const lvl=R.LEVELS[ses&&ses.level||P.level]||R.LEVELS.intermediate;
    const noise=o.atis?0.05:({beginner:0.014,intermediate:0.026,check:0.045})[ses&&ses.level||P.level]||0.02;
    rx(true); if(!o.crew) AU.on(noise);
    const done=()=>{ if(id!==speakId){ res(false); return; } AU.off(); rx(false); res(true); };
    if(natural()&&NV.ready&&AU.init()){
      const sp=Math.max(0.7,Math.min(1.5,P.rate*lvl.rate*(o.atis?1.05:1)));
      const h=NV.say(AU.ctx,parts,{atis:o.atis,speed:sp,radio:P.fx&&!o.crew,voice:o.voice||(o.unit&&!o.atis?NV.voiceFor(o.unit.n):undefined)}); NVcur=h;
      h.done.then(()=>{ if(NVcur===h) NVcur=null; done(); },()=>{ if(NVcur===h) NVcur=null; done(); });
      return; }
    if(natural()) nvPreload();
    if(!TTS){ done(); return; }
    const next=()=>{ if(id!==speakId) return res(false); if(k>=parts.length) return done();
      const u=new SpeechSynthesisUtterance(parts[k++]); if(VOICE) u.voice=VOICE; u.lang=(VOICE&&VOICE.lang)||'en-GB';
      u.rate=Math.max(0.6,Math.min(1.6,P.rate*lvl.rate*(o.atis?1.05:1))); u.pitch=0.92; u.onend=next; u.onerror=next; speechSynthesis.speak(u); };
    // safety net: some browsers (and headless ones) never fire onend
    const words=String(text).split(/\s+/).length; setTimeout(()=>{ if(id===speakId){ try{ speechSynthesis.cancel(); }catch(e){} done(); } },2500+words*700/Math.max(0.6,P.rate*lvl.rate));
    setTimeout(next,P.fx?120:0);
  }); }
function rx(on){ const r=$('#rxi'); if(r) r.classList.toggle('rx',!!on); }

/* ---------------- speech in ---------------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const MIC={rec:null,active:false,base:'',alts:[],heard:null};
const WH=window.NWHISPER||{supported:false};
/* which recogniser: the browser's own, or Whisper on the device (more accurate, audio stays on the device) */
const useWhisper=()=>WH.supported&&(P.engine==='whisper'||(!SR&&P.engine!=='browser'));
/* the candidates (the recogniser's alternatives) are graded against this call; the best one, with a merged
   repeated ICAO word restored (R.voiceFix), is what gets sent. What was actually heard is shown with it. */
function finishVoice(cands){
  const ta=el('say'); cands=cands.map(c=>String(c||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  if(!cands.length){ ta.value=''; return; }
  let txt=cands[0], heard=cands[0];
  if(ses&&ses.step){ const o={V:ses.V,abbrOK:ses.abbrOK,level:ses.level}; let best=-1;
    cands.forEach(c=>{ const f=R.voiceFix(ses.step,c,o); const g=R.grade(ses.step,f.text,o); const v=g.frac+(f.fixed?0:1e-6); if(v>best){ best=v; txt=f.text; heard=c; } }); }
  ta.value=txt; MIC.heard= heard.toLowerCase()!==txt.toLowerCase()? heard : null; MIC.said=txt;
  AU.click(); if(txt&&P.auto) transmit(true);
}
function micStart(){
  if(MIC.active||!ses||ses.done) return;
  if(useWhisper()) return whStart();
  if(!SR) return; hush(); AU.click();
  const ta=el('say'); MIC.active=true; MIC.alts=[]; MIC.base=''; MIC.heard=null; ta.value='';
  const rec=new SR(); MIC.rec=rec; rec.lang=P.mic||'en-GB'; rec.interimResults=true; rec.continuous=true; rec.maxAlternatives=3;
  let fin=[];
  rec.onresult=e=>{ let interim=''; fin=[]; for(let i=0;i<e.results.length;i++){ const r=e.results[i]; if(r.isFinal) fin.push(Array.from(r).map(a=>a.transcript)); else interim+=r[0].transcript; }
    ta.value=(fin.map(a=>a[0]).join(' ')+' '+interim).replace(/\s+/g,' ').trim(); MIC.fin=fin; };
  rec.onerror=e=>{ if(e.error==='not-allowed'||e.error==='service-not-allowed') note(tr('The microphone is blocked. Allow it in the browser settings, or type your call.','Mikrofonen er blokkert. Tillat den i nettleserinnstillingene, eller skriv oppkallet.')); else if(e.error==='network') note(tr('Speech recognition needs a network connection here. Type your call instead, or switch to on-device recognition in the settings.','Talegjenkjenning trenger nettforbindelse her. Skriv oppkallet i stedet, eller bytt til talegjenkjenning på enheten i innstillingene.')); };
  rec.onend=()=>{ MIC.active=false; setTx(false);
    const fin=MIC.fin||[]; MIC.fin=null; const typed=ta.value.trim();
    // every combination of one segment's alternatives with the others' first choice
    const cands=fin.length? [fin.map(a=>a[0]).join(' ')] : [typed];
    fin.forEach((alts,i)=>alts.slice(1).forEach(a=>cands.push(fin.map((x,j)=>j===i?a:x[0]).join(' '))));
    finishVoice(cands); };
  try{ rec.start(); setTx(true); }catch(e){ MIC.active=false; }
}
/* Whisper: record while the button is held, transcribe on release */
let whBusy=false;
async function whStart(){
  if(whBusy) return; hush(); AU.click(); const ta=el('say'); MIC.heard=null; ta.value='';
  MIC.active=true; setTx(true);
  if(!WH.ready) whPreload();
  try{ await WH.start(); if(!MIC.active) whStop(); }
  catch(e){ MIC.active=false; setTx(false); note(tr('The microphone is blocked. Allow it in the browser settings, or type your call.','Mikrofonen er blokkert. Tillat den i nettleserinnstillingene, eller skriv oppkallet.')); }
}
async function whStop(){
  if(!MIC.active) return; MIC.active=false; setTx(false); whBusy=true; const ta=el('say');
  ta.placeholder=L({en:'Listening to what you said…',no:'Hører på det du sa …'});
  try{ const t=await WH.stop(); finishVoice([t]); }
  catch(e){ note(tr('On-device speech recognition could not start here. Type your call, or switch to the browser recogniser in the settings.','Talegjenkjenning på enheten kunne ikke starte her. Skriv oppkallet, eller bytt til nettleserens gjenkjenning i innstillingene.')); }
  finally{ whBusy=false; ta.placeholder=L({en:'Type your call, or hold the talk button (space bar) and speak…',no:'Skriv oppkallet, eller hold snakkeknappen (mellomrom) og snakk …'}); }
}
function whPreload(){
  const n=el('engNote'); if(WH.ready){ if(n) n.textContent=L({en:'More accurate, and your voice never leaves this device. Ready.',no:'Mer nøyaktig, og stemmen din forlater aldri denne enheten. Klar.'}); return Promise.resolve(); }
  if(n) n.textContent=L({en:'Downloading the speech model (about 80 MB, once)…',no:'Laster ned talemodellen (omtrent 80 MB, én gang) …'});
  return WH.load(f=>{ if(n) n.textContent=L({en:'Downloading the speech model',no:'Laster ned talemodellen'})+` ${Math.round(f*100)} %`; })
    .then(()=>{ if(n) n.textContent=L({en:'More accurate, and your voice never leaves this device. Ready.',no:'Mer nøyaktig, og stemmen din forlater aldri denne enheten. Klar.'}); })
    .catch(()=>{ if(n) n.textContent=L({en:'The speech model could not be downloaded. Check the connection, or use the browser recogniser.',no:'Talemodellen kunne ikke lastes ned. Sjekk forbindelsen, eller bruk nettleserens gjenkjenning.'}); });
}
function micStop(){ if(useWhisper()){ whStop(); return; } if(MIC.rec&&MIC.active){ try{ MIC.rec.stop(); }catch(e){} } }
function setTx(on){ const t=$('#txi'), b=el('ptt'); if(t) t.classList.toggle('on',on); if(b){ b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); const s=b.querySelector('.pl'); if(s) s.textContent=on?L({en:'Release to send',no:'Slipp for å sende'}):L({en:'Hold to talk',no:'Hold for å snakke'}); } }

/* ---------------- views ---------------- */
const VIEWS=['home','pick','sess','deb'];
function show(v){ VIEWS.forEach(x=>{ const e=el('v-'+x); if(e) e.hidden=x!==v; }); if(v!=='sess'){ hush(); if(MAPON&&window.NMAP&&v!=='deb') NMAP.stop(); } document.body.classList.toggle('rt-live',v==='sess'); }
let ses=null, cur=null, group='vfr';

function drawHome(){
  const db=jget(K.srs,{}); const pool=S.QUICK_POOL(); const due=R.SRS.due(db).filter(id=>pool.includes(id));
  /* the learning path: basics → VFR → IFR → emergencies → airline; "Start here" on the first one not tried yet */
  const tried=k=>S.ALL.some(s=>s.group===k&&best(s.k)>0);
  const path=Object.keys(GROUPS).filter(k=>k!=='quick'); const next=path.find(k=>!tried(k));
  el('goals').innerHTML=path.map((k,i)=>{ const g=GROUPS[k], t=tried(k);
    return `<button class="goal${k===next?' next':''}" data-g="${k}"><span class="stepn">${i+1}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${g.ic}"/></svg><span><b>${esc(L(g.t))}</b><small>${esc(L(g.d))}</small>${k===next?`<span class="here">${L({en:'Start here',no:'Start her'})}</span>`:t?`<span class="tried">✓ ${L({en:'Practised',no:'Øvd'})}</span>`:''}</span></button>`; }).join('');
  const anyTried=path.some(tried);
  el('quickRow').innerHTML=`<b>${esc(L(GROUPS.quick.t))}</b><span>${esc(L(anyTried?{en:'Back for two minutes? Six readbacks, your weak ones first.',no:'Tilbake for to minutter? Seks tilbakelesinger, de svake først.'}:{en:'Two minutes, six readbacks from all over the trainer. Good once you have done a few lessons.',no:'To minutter, seks tilbakelesinger fra hele treneren. Fint når du har tatt noen leksjoner.'}))}</span>${due.length?`<em>${due.length} ${L({en:'due for review',no:'til repetisjon'})}</em>`:''}<button class="btn${anyTried?' pri':''}" id="quickGo" type="button">${L({en:'Start quick drill',no:'Start kjapp drill'})}</button>`;
  el('quickGo').onclick=()=>startScenario('quick');
  drawGuide();
  el('lvlTip').textContent=L(LEVELS[P.level].d);
  const st=jget(K.stats,{}); const weak=Object.entries(st).filter(([k,o])=>o.n>=3&&KIND[k]).map(([k,o])=>[k,o.ok/o.n]).sort((a,b)=>a[1]-b[1]).slice(0,3);
  el('homeStats').innerHTML= weak.length? `<b>${L({en:'Your weakest items so far',no:'Dine svakeste elementer så langt'})}:</b> `+weak.map(([k,v])=>`<span class="pill ${v<0.6?'bad':v<0.85?'mid':'good'}">${esc(L(KIND[k]))} ${Math.round(v*100)} %</span>`).join(' ') : '';
}
function drawGuide(force){
  const g=el('guide'); const seen=jget(K.guide,0); if(!force&&seen){ g.hidden=true; return; }
  g.hidden=false;
  g.innerHTML=`<h3>${L({en:'How the radio trainer works',no:'Slik virker radiotreneren'})}</h3><ol>
    <li><i>1</i><div><b>${L({en:'Pick a lesson',no:'Velg en leksjon'})}</b><span>${L({en:'New to the radio? Start with Basics and go in order. Each lesson is a short session with a real controller.',no:'Ny på radio? Start med Grunnleggende og gå i rekkefølge. Hver leksjon er en kort økt med en ekte flygeleder.'})}</span></div></li>
    <li><i>2</i><div><b>${L({en:'Talk or type',no:'Snakk eller skriv'})}</b><span>${L({en:'Hold the talk button (or the space bar), say your call, let go. Or type it and press Transmit. Both are graded the same.',no:'Hold snakkeknappen (eller mellomromstasten), si oppkallet, slipp. Eller skriv det og trykk Transmit. Begge vurderes likt.'})}</span></div></li>
    <li><i>3</i><div><b>${L({en:'Read the feedback',no:'Les tilbakemeldingen'})}</b><span>${L({en:'Every item of your call is checked, with the rule behind it. If something is missing, the controller asks for it and you try again.',no:'Hvert element i oppkallet sjekkes, med regelen bak. Mangler noe, ber flygelederen om det, og du prøver igjen.'})}</span>
      <div class="keys"><span class="k ok">✓ ${L({en:'right',no:'riktig'})}</span><span class="k mid">! ${L({en:'note',no:'merknad'})}</span><span class="k bad">✕ ${L({en:'missing or wrong',no:'mangler eller feil'})}</span></div></div></li></ol>
    <div class="gfoot"><button class="btn pri" id="guideOk" type="button">${L({en:'Got it',no:'Skjønner'})}</button><span>${L({en:'Level sets the pace: Beginner shows what to include, Check-ready hides the controller text until you answer.',no:'Nivået styrer tempoet: Nybegynner viser hva du skal ta med, Klar for sjekk skjuler flygelederens tekst til du har svart.'})}</span></div>`;
  el('guideOk').onclick=()=>{ jset(K.guide,1); g.hidden=true; el('guideBtn').focus(); };
}
/* airline: three plain choices instead of eight cards */
function drawAirline(){
  const A=Object.assign({ph:'dep',seat:'PM',map:true},P.al||{}); P.al=A;
  const opt=(grp,v,t,d)=>`<button class="opt" type="button" data-grp="${grp}" data-v="${v}" aria-pressed="${String(A[grp])===String(v)}"><b>${esc(L(t))}</b><small>${esc(L(d))}</small></button>`;
  const key=(A.map?(A.ph==='dep'?'a320live-':'a320livearr-'):(A.ph==='dep'?'a320dep-':'a320arr-'))+A.seat.toLowerCase();
  const sc=S.byKey(key), b=best(key);
  el('pickL').innerHTML=`<div class="alc">
    <div class="row"><span>${L({en:'Flight',no:'Tur'})}</span><div class="opts">${opt('ph','dep',{en:'Departure',no:'Avgang'},{en:'Stand to the climb: clearance, push and start, taxi, take-off.',no:'Stand til stigning: klarering, push og start, taksing, avgang.'})}${opt('ph','arr',{en:'Arrival',no:'Ankomst'},{en:'Top of descent to the stand: ATIS, descent, ILS, landing, taxi in.',no:'Top of descent til stand: ATIS, nedstigning, ILS, landing, taksing inn.'})}</div></div>
    <div class="row"><span>${L({en:'Your seat',no:'Ditt sete'})}</span><div class="opts">${opt('seat','PM',{en:'PM – pilot monitoring',no:'PM – pilot monitoring'},{en:'You talk to ATC. Best place to start.',no:'Du snakker med ATC. Beste sted å starte.'})}${opt('seat','PF',{en:'PF – pilot flying',no:'PF – pilot flying'},{en:'You ask PM for the calls and talk to the ground crew.',no:'Du ber PM om kallene og snakker med bakkemannskapet.'})}</div></div>
    <div class="row"><span>${L({en:'Airport map',no:'Flyplasskart'})}</span><div class="opts">${opt('map',true,{en:'Live map on',no:'Live kart på'},{en:'See your aircraft move as your calls are accepted.',no:'Se flyet ditt bevege seg når kallene godkjennes.'})}${opt('map',false,{en:'Radio only',no:'Bare radio'},{en:'Just the calls, faster.',no:'Bare kallene, raskere.'})}</div></div>
    <div class="go"><button class="btn pri" id="alGo" type="button">${L({en:'Start',no:'Start'})}</button><p>${esc(L(sc.d))}${b?` · ${L({en:'Best',no:'Beste'})} ${b} %`:''}</p></div></div>`;
  el('pickL').querySelectorAll('.opt').forEach(x=>x.onclick=()=>{ const v=x.dataset.v; A[x.dataset.grp]= v==='true'?true:v==='false'?false:v; saveP(); drawAirline(); });
  el('alGo').onclick=()=>startScenario(sc);
}
function drawPick(){
  el('pickT').textContent=L(GROUPS[group].t);
  if(group==='airline'){ el('pickL').className='alwrap'; drawAirline(); return; }
  el('pickL').className='sclist';
  const list=S.ALL.filter(s=>s.group===group);
  el('pickL').innerHTML=list.map(s=>{ const b=best(s.k); return `<button class="sc${s.full?' full':''}" data-k="${s.k}"><span class="lv" aria-label="${L({en:'Level',no:'Nivå'})} ${s.lvl}">${'●'.repeat(s.lvl)}${'○'.repeat(3-s.lvl)}</span><b>${esc(L(s.t))}</b><small>${esc(L(s.d))}</small>${b?`<i>${L({en:'Best',no:'Beste'})} ${b} %</i>`:''}</button>`; }).join('');
}

/* ---------------- session ---------------- */
function startScenario(sc){ if(natural()&&P.voice) nvPreload();
  AU.init(); hush();
  if(sc==='quick'){ const db=jget(K.srs,{}); const pool=S.QUICK_POOL(); const ids=R.SRS.due(db).concat(R.SRS.weak(db)).filter(id=>pool.includes(id));
    const seed=(Date.now()>>>0)^0x5bd1; const V=S.vars(seed,{callsign:P.callsign});
    cur={k:'quick',t:GROUPS.quick.t,group:'quick',basis:['SERA.8015(e)','AMC1 SERA.14001']}; ses=new R.Session(cur,{level:P.level,V,steps:S.quick(V,R.rng(seed),ids),callsign:P.callsign}); }
  else if(sc&&sc.k==='retry'){ cur=sc; ses=new R.Session(cur,{level:P.level,V:sc.V,steps:sc.steps}); }
  else { cur=sc; ses=new R.Session(sc,{level:P.level,callsign:P.callsign}); }
  el('sessT').textContent=L(cur.t); drawBasis(); el('log').innerHTML=''; el('fbBox').innerHTML=`<p class="muted">${L({en:'Feedback on each call appears here: what was right, what was missing, and why.',no:'Tilbakemelding på hvert oppkall kommer her: hva som var riktig, hva som manglet, og hvorfor.'})}</p>`;
  el('sitBox').innerHTML=''; el('fq').textContent='———.———'; el('stn').textContent='';
  MAPON=!!(cur.map&&window.NMAP); el('amapBox').hidden=!MAPON; el('v-sess').classList.toggle('hasmap',MAPON);
  if(MAPON){ if(!mapInit){ NMAP.init(el('amap')); mapInit=true; } NMAP.reset(cur.map,ses.V.dep,ses.V.arr); } else if(window.NMAP) NMAP.stop();
  show('sess'); run(ses.start());
  el('say').focus({preventScroll:true}); window.scrollTo({top:el('trainer').offsetTop-70,behavior:'smooth'});
}
/* "Based on": the rules and documents the scenario's calls and readbacks are checked against (radioscen.js BASIS) */
function drawBasis(){ const b=el('sessBasis'); if(!b) return; const list=(cur&&cur.basis)||[];
  b.hidden=!list.length; b.innerHTML=list.length? `${L({en:'Based on',no:'Basert på'})}: ${list.map(esc).join(' · ')} <a href="#sources">${L({en:'Sources',no:'Kilder'})}</a>` : ''; }
let queue=Promise.resolve(), MAPON=false, mapInit=false;
function run(ev){ queue=queue.then(()=>play(ev)).then(()=>{ drawTurn(); }); return queue; }
async function play(ev){
  for(const e of ev){
    if(e.t==='tune'){ el('fq').textContent=e.unit.f; el('stn').textContent=e.unit.n; if(/^(CREW|INT|PA)$/.test(e.unit.f)) continue; addMsg('sys','',`${L({en:'Tuned',no:'Stilt inn'})} <b>${esc(e.unit.n)}</b> ${esc(e.unit.f)}`); AU.click(); }
    else if(e.t==='act'){ if(MAPON&&window.NMAP){ const pr=NMAP.act(e.a); if(e.wait) await pr; } }
    else if(e.t==='say'){ if(e.atc){ await atcMsg(e); continue; }
      addMsg('crew ch-'+(e.ch||'crew'),L(e.label||{en:e.who,no:e.who})+(e.ch==='int'?' · interphone':e.ch==='pa'?' · PA':''),esc(e.text));
      await speak(e.text,{voice:e.voice,crew:e.ch!=='int'&&e.ch!=='pa'}); }
    else if(e.t==='sit'){ addMsg('sys sit','',esc(L(e.text))); el('sitBox').innerHTML=`<b>${L({en:'Situation',no:'Situasjon'})}</b><p>${esc(L(e.text))}</p>`; el('sitBox').classList.remove('open'); el('sitBox').onclick=()=>el('sitBox').classList.toggle('open'); }
    else if(e.t==='prompt'){ addMsg('sys prompt','',L(e.text)); }
    else if(e.t==='note'){ addMsg('sys','',esc(L(e.text))); }
    else if(e.t==='model'){ if(e.fail&&document.querySelector('#log .fb.full')) addMsg('sys','',L({en:'Moving on to the next call.',no:'Vi går videre til neste oppkall.'})); else addMsg('sys model','',`${e.fail?L({en:'Moving on. A good call:',no:'Vi går videre. Et godt oppkall:'}):L({en:'A good call:',no:'Et godt oppkall:'})} <span class="mono">${esc(e.text)}</span>`); }
    else if(e.t==='atc'){ await atcMsg(e); }
    else if(e.t==='end'){ setTimeout(debrief,700); }
  }
}
function hideAtc(e){ const lv=ses?ses.level:P.level; return (e.listen||(e.atis&&lv!=='beginner')||(ses&&ses.L.hideAtc&&!e.atis))&&(TTS||NV.supported)&&P.voice; }
async function atcMsg(e){
  const who=e.atis?(e.unit?e.unit.n:'ATIS'):(e.unit?e.unit.n:'ATC');
  const hid=hideAtc(e);
  const d=addMsg('atc'+(e.atis?' atis':'')+(e.corr?' corr':''),who,hid?`<span class="hid">${L({en:'Listen…',no:'Lytt…'})}</span><button class="reveal" type="button">${L({en:'Show text',no:'Vis tekst'})}</button><span class="tx" hidden>${esc(e.text)}</span>`:esc(e.text));
  if(hid){ d.classList.add('hidden-tx'); d.querySelector('.reveal').onclick=()=>reveal(d,true); }
  await speak(e.text,{atis:e.atis,unit:e.unit});
}
function reveal(d,peek){ const t=d.querySelector('.tx'); if(!t) return; t.hidden=false; const h=d.querySelector('.hid'); if(h) h.remove(); const b=d.querySelector('.reveal'); if(b) b.remove(); d.classList.remove('hidden-tx'); if(peek&&ses) ses.peekAtc=true; }
function revealAll(){ document.querySelectorAll('#log .msg.hidden-tx').forEach(d=>reveal(d,false)); }
function addMsg(cls,who,html){ const log=el('log'); const d=document.createElement('div'); d.className='msg '+cls; d.innerHTML=(who?`<span class="who">${esc(who)}</span>`:'')+html; log.appendChild(d); log.scrollTop=log.scrollHeight; return d; }
/* progress: one pip per call in the top bar, and the list of calls on the flight strip */
function drawCalls(){ if(!ses) return; const st=ses.steps.map((s,i)=>{ const r=ses.results.find(x=>x.n===i); return r? (r.pass&&r.first?'ok':r.pass?'part':'bad') : i===ses.i&&!ses.done?'now':''; });
  el('pips').innerHTML=st.map((c,i)=>`<li class="${c}" title="${esc(L(ses.steps[i].task)||'')}"></li>`).join('');
  const sym={ok:'✓',part:'✓',bad:'✕',now:'›','':'·'};
  el('calls').innerHTML=ses.steps.map((s,i)=>`<li class="${st[i]}"><i>${sym[st[i]]}</i><span>${esc(L(s.task)||'')}</span></li>`).join('');
  const cur2=el('calls').querySelector('li.now'); if(cur2&&cur2.scrollIntoView&&el('calls').closest('.rs-strip').scrollHeight>el('calls').closest('.rs-strip').clientHeight) cur2.scrollIntoView({block:'nearest'});
  el('stripCs').textContent=ses.V.c||P.callsign; el('stripTy').textContent=(ses.V.type||'')+(cur&&cur.group&&/^(vfr|ifr)$/.test(cur.group)?' · '+cur.group.toUpperCase():''); }
function drawTurn(){
  const s=ses&&ses.step; const box=el('turn'); drawCalls();
  el('prog').textContent= ses&&!ses.done? `${L({en:'Call',no:'Oppkall'})} ${Math.min(ses.i+1,ses.steps.length)} / ${ses.steps.length}` : '';
  const sm=ses?ses.summary():null; el('score').textContent= sm&&sm.n? sm.score+' %' : '';
  if(!s||ses.done){ box.innerHTML=''; return; }
  const req=(s.els||[]).filter(e=>!e.opt), opt=(s.els||[]).filter(e=>e.opt);
  const chip=e=>`<span class="ichip${e.opt?' opt':''}">${esc(L(e.l||R.label(e,ses.V)))}</span>`;
  const showList=ses.L.hints||box.dataset.hint==='1';
  if(need&&need.length&&ses.tries>0){ box.innerHTML=`<div class="tk"><b>${L({en:'Your turn',no:'Din tur'})}</b> ${esc(L({en:'The controller asked for ',no:'Flygelederen ba om '}))}<b class="need">${esc(need.join(', '))}</b>${esc(L({en:'. Give just that, with your callsign.',no:'. Gi bare det, med kallesignalet ditt.'}))}</div>`; el('btnAgain').disabled=!ses.lastAtc; return; }
  if(!ses.tries) need=null;
  const coach=!jget(K.coach,0)? `<div class="coach">${L({en:'Hold the talk button (or the space bar) and speak, or type your call and press Transmit.',no:'Hold snakkeknappen (eller mellomromstasten) og snakk, eller skriv oppkallet og trykk Transmit.'})}</div>` : '';
  box.innerHTML=`<div class="tk"><b>${L({en:'Your turn',no:'Din tur'})}</b> ${esc(L(s.task))}</div>`+coach+
    (showList? `<div class="inc"><span>${L({en:'Include',no:'Ta med'})}:</span> ${req.map(chip).join('')}${opt.map(chip).join('')}</div>` : ses.level==='intermediate'? `<button class="lnk" id="hintBtn" type="button">${L({en:'Hint: what to include',no:'Hint: hva du skal ta med'})}</button>`:'');
  const hb=el('hintBtn'); if(hb) hb.onclick=()=>{ box.dataset.hint='1'; drawTurn(); };
  box.dataset.hint='';
  el('btnAgain').disabled=!ses.lastAtc;
}
/* compact version for the pilot's bubble in the log: only what was wrong or missing (the full list is in the side panel) */
function fbShort(g){
  const bad=g.res.filter(r=>r.st!=='ok'&&!r.opt);
  if(!bad.length&&!g.flags.length) return `<ul class="els"><li class="ok"><span class="sy">✓</span><span>${L({en:'Everything that had to be in it',no:'Alt som måtte være med'})}</span></li></ul>`;
  return `<ul class="els">${bad.map(r=>`<li class="${r.st}"><span class="sy">${SYM[r.st]}</span><span>${esc(L(r.label))}${r.st==='wrong'&&r.got?` <em>${L({en:'you said',no:'du sa'})} “${esc(r.got)}”</em>`:''}</span></li>`).join('')}${g.flags.map(f=>`<li class="warn"><span class="sy">!</span><span>${esc(L(f))}</span></li>`).join('')}</ul>`;
}
function fbHtml(g,s,kind){
  const rows=g.res.map(r=>`<li class="${r.st}${r.opt&&r.st!=='ok'?' opt':''}"><span class="sy">${r.opt&&r.st!=='ok'?'○':SYM[r.st]}</span><span>${esc(L(r.label))}${r.st==='wrong'&&r.got?` <em>${L({en:'you said',no:'du sa'})} “${esc(r.got)}”</em>`:''}${r.st==='warn'&&r.got?` <em>“${esc(r.got)}”</em>`:''}${r.opt&&r.st!=='ok'?` <em>${L({en:'good to include',no:'bra å ta med'})}</em>`:''}${r.carried?` <em>${L({en:'from your last call',no:'fra forrige oppkall'})}</em>`:''}</span></li>`).join('');
  const fl=g.flags.map(f=>`<li class="warn"><span class="sy">!</span><span>${esc(L(f))}</span></li>`).join('');
  return `<ul class="els">${rows}${fl}</ul>`;
}
function whyHtml(g,s){
  const bad=g.res.filter(r=>!r.opt&&r.st!=='ok'); const seen=new Set(); const whys=[];
  bad.forEach(r=>{ const w=L(r.why); if(!seen.has(w)){ seen.add(w); whys.push(w); } });
  if(s.why&&!seen.has(L(s.why))) whys.push(L(s.why));
  return whys.length? `<div class="why"><b>${L({en:'Why',no:'Hvorfor'})}</b>${whys.slice(0,3).map(w=>`<p>${esc(w)}</p>`).join('')}</div>` : '';
}
let lastVoice=null, need=null;
async function transmit(byVoice){
  if(!ses||ses.done) return; const ta=el('say'); const txt=ta.value.trim(); if(!txt) return; jset(K.coach,1);
  hush(); ta.value=''; revealAll();
  const s=ses.step; const r=ses.submit(txt);
  if(!r.g||r.g.empty) return;
  const heard=MIC.heard&&MIC.said===txt? MIC.heard : null; MIC.heard=null;
  const me=addMsg('me',ses.V.cs.full,esc(txt)+(heard?`<div class="heard">${esc(L({en:'Heard',no:'Hørt'}))}: <span class="mono">${esc(heard.replace(/[.,;\s]+$/,""))}</span>. ${esc(L({en:'A repeated word the recogniser merged was restored.',no:'Et gjentatt ord som gjenkjenningen slo sammen, ble lagt tilbake.'}))}</div>`:''));
  if(r.kind==='sayagain'||r.kind==='standby'){ await run(r.ev); return; }
  const g=r.g, ok=r.kind==='pass';
  document.querySelectorAll('#log .fb.full').forEach(x=>{ x.innerHTML=x._short||''; x.classList.remove('full'); });
  const fb=document.createElement('div'); fb.className='fb full'; fb._short=fbShort(g); me.appendChild(fb);
  me.classList.add(ok?'good':r.kind==='fail'?'bad':'try');
  const head= ok? (g.flags.length? L({en:'Accepted, with a note',no:'Godkjent, med en merknad'}) : L({en:'Correct',no:'Riktig'})) : r.kind==='retry'? L({en:'Not yet: the controller corrects you',no:'Ikke ennå: flygelederen korrigerer deg'}) : L({en:'Missed',no:'Bommet'});
  /* on a retry the answer is not shown yet: the controller has asked for the missing part, so the pilot gets one more go */
  need= r.kind==='retry'? g.res.filter(x=>x.st!=='ok'&&!x.opt).map(x=>L(x.label)) : null;
  const ask= need&&need.length? `<div class="model"><b>${L({en:'Reply with',no:'Svar med'})}</b><span>${esc(need.join(', '))}${L({en:', and your callsign. You do not need to repeat the rest.',no:', og kallesignalet ditt. Resten trenger du ikke gjenta.'})}</span></div>` : '';
  const full=`<div class="fbh ${ok?'good':r.kind==='fail'?'bad':'try'}">${esc(head)}</div>${ok&&!g.flags.length?fb._short:fbHtml(g,s,r.kind)}${r.kind==='retry'?ask:(!ok||g.flags.length?`<div class="model"><b>${L({en:'Correct call',no:'Riktig oppkall'})}</b><span class="mono">${esc(s.model)}</span></div>`:'')}${ok&&!g.flags.length?'':whyHtml(g,s)}`;
  el('fbBox').innerHTML=full; fb.innerHTML=`<div class="fbx">${full}</div>`; el('log').scrollTop=el('log').scrollHeight;
  lastVoice= byVoice&&r.kind==='retry'? me : null;
  el('btnUndo').hidden=!lastVoice;
  await run(r.ev);
}
function undoVoice(){ if(!lastVoice||!ses) return; if(!ses.undo()) return;
  // remove the pilot message and everything after it
  let n=lastVoice; while(n){ const x=n.nextSibling; n.remove(); n=x; } lastVoice=null; el('btnUndo').hidden=true;
  el('say').focus(); note(tr('Removed. Correct the text or say it again: no penalty.','Fjernet. Rett teksten eller si det på nytt: ingen trekk.')); drawTurn(); }
function note(t){ addMsg('sys','',esc(L(t))); }

/* ---------------- debrief ---------------- */
function debrief(){
  if(!ses) return; hush(); const sm=ses.summary(); show('deb');
  if(!ses._saved){ ses._saved=true; save(sm); }
  drawDeb(sm);
}
function save(sm){
  // storage: best, progress, spaced repetition, element statistics
  if(cur.k!=='retry'&&cur.k!=='quick'){ try{ if(sm.score>best(cur.k)) localStorage.setItem('naeroson-radio-'+cur.k,String(sm.score)); }catch(e){} if(window.NPROG&&cur.award) NPROG.award(cur.award,sm.score); }
  jset(K.srs,R.SRS.update(jget(K.srs,{}),ses.results.filter(r=>/^[a-z]+:\d+$/.test(r.id||'')&&!/^b-/.test(r.id))));
  const st=jget(K.stats,{}); Object.entries(sm.kinds).forEach(([k,o])=>{ const x=st[k]=st[k]||{n:0,ok:0}; x.n+=o.n; x.ok+=o.ok; }); jset(K.stats,st);
}
function drawDeb(sm){
  const kinds=Object.entries(sm.kinds).filter(([k])=>KIND[k]).sort((a,b)=>a[1].ok/a[1].n-b[1].ok/b[1].n);
  const verdict= sm.score>=90? tr('Clean, complete radio work. Try the next level up.','Ren og fullstendig radiobruk. Prøv neste nivå.') : sm.score>=70? tr('Good. Practise the red items below once more.','Bra. Øv på de røde punktene under én gang til.') : tr('Keep going: practise the weak items, then fly it again. New values every time.','Fortsett: øv på de svake punktene, og fly den igjen. Nye verdier hver gang.');
  el('debBody').innerHTML=`<div class="dtop"><div class="big">${sm.score}<small>%</small></div><div><h3>${esc(L(cur.t))}</h3><p>${esc(L(verdict))}</p><p class="muted">${esc(L(LEVELS[ses.level].t))} · ${sm.n} ${L({en:'calls',no:'oppkall'})}</p></div></div>
    <div class="kpis">${Object.entries(sm.cats).map(([k,v])=>`<div class="kpi"><span>${esc(L(CAT[k]||tr(k)))}</span><b>${v} %</b></div>`).join('')}</div>
    ${kinds.length?`<h4>${L({en:'Element by element',no:'Element for element'})}</h4><table class="ktab"><tbody>${kinds.map(([k,o])=>{ const p=Math.round(o.ok/o.n*100); return `<tr><td>${esc(L(KIND[k]))}</td><td><span class="bar"><i style="width:${p}%" class="${p<60?'bad':p<85?'mid':'good'}"></i></span></td><td>${o.ok}/${o.n}</td></tr>`; }).join('')}</tbody></table>`:''}
    ${sm.weak.length?`<h4>${L({en:'Practise these again',no:'Øv på disse igjen'})}</h4><div class="weak">${sm.weak.slice(0,5).map(w=>`<div class="wi"><b>${Math.round(w.score*100)} %</b><div><p>${esc(L(w.task))}</p><span class="mono">${esc(w.model)}</span></div></div>`).join('')}</div>`:`<p class="muted">${L({en:'No weak items in this session.',no:'Ingen svake punkter i denne økten.'})}</p>`}`;
  el('btnWeak').hidden=!sm.weak.length;
}

/* ---------------- AI free talk (optional) ---------------- */
function aiSetup(){
  if(!window.NAI) return;
  let wired=false; NAI.onMode(mode=>{ const box=el('ai'); if(!mode){ box.hidden=true; return; } box.hidden=false; if(wired) return; wired=true;
    let turns=[]; const log=el('aiLog');
    const add=(cls,who,h)=>{ const d=document.createElement('div'); d.className='msg '+cls; d.innerHTML=(who?`<span class="who">${esc(who)}</span>`:'')+h; log.appendChild(d); log.scrollTop=log.scrollHeight; return d; };
    const rules=()=>`You are an air traffic controller in a radiotelephony training simulator for pilots training under EASA in Norway. Fictional aerodrome NORDAP, runway 36/18, Tower 118.300, Ground 121.700, Approach 119.250, transition altitude 7000 ft. The pilot is ${P.callsign}, a DA42. Situation: ${el('aiSit').value||'infer it from the first call'}. Reply as ATC with ICAO Doc 4444/9432 and SERA phraseology, then judge only the pilot's last transmission. Reply with JSON only: {"atc":"…","ok":true|false,"notes":["max 3, in ${NAI.langName()}"],"better":"ideal pilot transmission"}`;
    async function send(){ const t=el('aiSay').value.trim(); if(!t) return; el('aiSay').value=''; const me=add('me',P.callsign,esc(t)); turns.push({role:'user',content:'PILOT: '+t}); const w=add('atc','ATC','…');
      try{ const r=await NAI.json([{role:'user',content:rules()},...turns.slice(-20)]); const a=String(r&&r.atc||'Say again.'); w.innerHTML=`<span class="who">ATC</span>${esc(a)}`; turns.push({role:'assistant',content:JSON.stringify({atc:a})});
        const fb=document.createElement('div'); fb.className='fb'; fb.innerHTML=`<ul class="els">${(r.notes||[]).slice(0,3).map(n=>`<li class="${r.ok?'warn':'wrong'}"><span class="sy">${r.ok?'!':'✕'}</span><span>${esc(n)}</span></li>`).join('')}${r.ok&&!(r.notes||[]).length?`<li class="ok"><span class="sy">✓</span><span>${L({en:'Correct and complete',no:'Riktig og fullstendig'})}</span></li>`:''}</ul>${!r.ok&&r.better?`<div class="model"><span class="mono">${esc(r.better)}</span></div>`:''}`; me.appendChild(fb); speak(a); }
      catch(e){ w.remove(); turns.pop(); el('aiNote').textContent=NAI.errText(e); if(NAI.fatal(e)) el('ai').hidden=true; } }
    el('aiSend').onclick=send; el('aiSay').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }); el('aiReset').onclick=()=>{ turns=[]; log.innerHTML=''; };
  });
}

/* ---------------- wiring ---------------- */
function init(){
  const lvl=LAB.seg(el('lvlSeg'),[['beginner','Beginner'],['intermediate','Intermediate'],['check','Check-ready']],P.level,v=>{ P.level=v; saveP(); el('lvlTip').textContent=L(LEVELS[v].d); });
  el('guideBtn').onclick=()=>{ drawGuide(true); el('guide').scrollIntoView({behavior:'smooth',block:'nearest'}); };
  el('goals').addEventListener('click',e=>{ const b=e.target.closest('.goal'); if(!b) return; const g=b.dataset.g; if(g==='quick'){ startScenario('quick'); return; } group=g; drawPick(); show('pick'); el('pickBack').focus(); });
  el('pickL').addEventListener('click',e=>{ const b=e.target.closest('.sc'); if(!b) return; startScenario(S.byKey(b.dataset.k)); });
  el('pickBack').onclick=()=>{ drawHome(); show('home'); };
  el('sessBack').onclick=()=>{ if(ses&&ses.results.length&&!ses.done&&!confirm(L({en:'Leave this session? Your answers so far are not saved.',no:'Forlate økten? Svarene så langt lagres ikke.'}))) return; hush(); ses=null; drawHome(); show('home'); };
  el('debHome').onclick=()=>{ drawHome(); show('home'); };
  el('debAgain').onclick=()=>{ if(cur.k==='quick') startScenario('quick'); else if(cur.k==='retry') startScenario(cur); else startScenario(cur); };
  el('btnWeak').onclick=()=>{ const sm=ses.summary(); const steps=sm.weak.map(w=>ses.steps[w.n]).filter(Boolean).map(s=>Object.assign({},s,{abbrOK:true}));
    if(!steps.length) return; const V=ses.V; startScenario({k:'retry',t:tr('Practise these again','Øv på disse igjen'),basis:cur&&cur.basis,steps:R.prep(steps.map(s=>Object.assign({},s)),V),V}); };
  el('btnTx').onclick=()=>transmit(false);
  el('say').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); transmit(false); } });
  el('btnAgain').onclick=()=>{ if(ses) run(ses.sayAgain()); };
  el('btnModel').onclick=()=>{ if(ses) run(ses.showModel()); };
  el('btnSkip').onclick=()=>{ if(ses&&!ses.done){ revealAll(); run(ses.skip()); } };
  el('btnUndo').onclick=undoVoice;
  // push to talk
  const ptt=el('ptt');
  if(SR||WH.supported){ ptt.addEventListener('pointerdown',e=>{ e.preventDefault(); try{ ptt.setPointerCapture(e.pointerId); }catch(x){} micStart(); });
    ['pointerup','pointercancel'].forEach(t=>ptt.addEventListener(t,micStop)); ptt.addEventListener('keydown',e=>{ if((e.key===' '||e.key==='Enter')&&!e.repeat){ e.preventDefault(); micStart(); } }); ptt.addEventListener('keyup',e=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); micStop(); } });
    window.addEventListener('keydown',e=>{ if(e.code!=='Space'||e.repeat||el('v-sess').hidden) return; const a=document.activeElement; if(a&&/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(a.tagName)) return; e.preventDefault(); micStart(); });
    window.addEventListener('keyup',e=>{ if(e.code==='Space'&&MIC.active){ e.preventDefault(); micStop(); } });
  } else { ptt.disabled=true; el('micNote').textContent=L({en:'Voice input works in Chrome, Edge and Safari. Here you type your calls: the grading is the same.',no:'Taleinndata virker i Chrome, Edge og Safari. Her skriver du oppkallene: vurderingen er den samme.'}); }
  // settings
  el('setCs').value=P.callsign; el('setCs').addEventListener('change',()=>{ const v=el('setCs').value.trim().toUpperCase(); if(v.length>=3&&v.length<=12){ P.callsign=v; saveP(); } else el('setCs').value=P.callsign; });
  el('setVoice').checked=P.voice; el('setVoice').onchange=()=>{ P.voice=el('setVoice').checked; saveP(); if(!P.voice) hush(); };
  el('setFx').checked=P.fx; el('setFx').onchange=()=>{ P.fx=el('setFx').checked; saveP(); };
  el('setAuto').checked=P.auto; el('setAuto').onchange=()=>{ P.auto=el('setAuto').checked; saveP(); };
  el('setRate').value=P.rate; const rt=()=>el('setRateV').textContent=(+P.rate).toFixed(2)+'×'; rt(); el('setRate').oninput=()=>{ P.rate=+el('setRate').value; saveP(); rt(); };
  el('setMic').value=P.mic; el('setMic').onchange=()=>{ P.mic=el('setMic').value; saveP(); };
  const eng=el('setEng'); if(eng){
    if(!WH.supported) eng.querySelector('[value=whisper]').disabled=true; if(!SR) eng.querySelector('[value=browser]').disabled=true;
    eng.value=useWhisper()?'whisper':'browser';
    const sync=()=>{ el('setMic').closest('label').hidden=eng.value==='whisper'; if(eng.value==='whisper'){ if(P.engine==='whisper'||WH.ready) whPreload(); else el('engNote').textContent=L({en:'More accurate, and your voice never leaves this device. Downloads about 80 MB the first time you talk.',no:'Mer nøyaktig, og stemmen din forlater aldri denne enheten. Laster ned omtrent 80 MB første gang du snakker.'}); } else el('engNote').textContent=L({en:'Uses the browser’s own recogniser (Chrome and Edge send the audio to Google, Safari to Apple).',no:'Bruker nettleserens egen gjenkjenning (Chrome og Edge sender lyden til Google, Safari til Apple).'}); };
    eng.onchange=()=>{ P.engine=eng.value; saveP(); sync(); }; sync(); }
  el('setTest').onclick=()=>{ AU.init(); speak(`${R.parseCallsign(P.callsign).full}, NORDAP Tower, wind 340 degrees 8 knots, runway 36, cleared to land.`); };
  const te=el('setTts'); if(te){ if(!NV.supported){ te.value='browser'; te.disabled=true; } else te.value=natural()?'natural':'browser';
    const sync=()=>{ if(te.value==='natural'){ if(NV.ready||P.tts==='natural') nvPreload(); else el('ttsEngNote').textContent=L({en:'Sounds like a person, generated on this device. Downloads about 90 MB the first time.',no:'Høres ut som et menneske, laget på denne enheten. Laster ned omtrent 90 MB første gang.'}); }
      else el('ttsEngNote').textContent=L({en:'The browser’s built-in voice: starts at once, sounds synthetic.',no:'Nettleserens innebygde stemme: starter med en gang, høres syntetisk ut.'}); };
    te.onchange=()=>{ P.tts=te.value; saveP(); hush(); sync(); }; sync(); }
  if(!TTS&&!NV.supported){ el('setVoice').disabled=true; el('ttsNote').textContent=L({en:'This browser has no speech synthesis: the controller is shown as text.',no:'Denne nettleseren har ikke talesyntese: flygelederen vises som tekst.'}); }
  drawHome(); show('home'); aiSetup();
  LAB.onLang(()=>{ drawHome(); if(!el('v-pick').hidden) drawPick(); if(ses&&!el('v-sess').hidden){ el('sessT').textContent=L(cur.t); drawBasis(); drawTurn(); } if(!el('v-deb').hidden&&ses) drawDeb(ses.summary()); });
  // test hooks (headless browsers cannot speak): type and transmit
  window.__radio={get ses(){ return ses; },voice:c=>finishVoice(c),micStart,micStop,say(t){ el('say').value=t; return transmit(false); },model(){ return ses&&ses.step?ses.step.model:''; },start:k=>startScenario(k==='quick'?'quick':S.byKey(k)),idle:()=>queue};
}
init();
})();
