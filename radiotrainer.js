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
const P=Object.assign({level:'beginner',callsign:'LN-NAE',voice:true,rate:1,fx:true,auto:true,mic:'en-GB'},jget(K.prefs,{}));
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
const LEVELS={beginner:{t:tr('Beginner','Nybegynner'),d:tr('New to the radio: slow controller, the items to include are shown, three tries per call.','Ny på radio: rolig flygeleder, elementene du skal ta med vises, tre forsøk per oppkall.')},
  intermediate:{t:tr('Intermediate','Middels'),d:tr('You have flown before: normal pace, a hint only if you ask, two tries.','Du har flydd før: normalt tempo, hint bare om du ber om det, to forsøk.')},
  check:{t:tr('Check-ready','Klar for sjekk'),d:tr('Fast, more static, controller text hidden until you answer, strict readbacks.','Raskt, mer støy, flygelederens tekst skjult til du svarer, strenge tilbakelesinger.')}};
const CAT={crew:tr('Crew and ground crew calls','Kall i besetningen og til bakkemannskap'),rb:tr('Readbacks','Tilbakelesinger'),call:tr('Calls and reports','Oppkall og meldinger'),copy:tr('Copying','Notering'),emerg:tr('Emergency calls','Nødmeldinger'),basic:tr('Basics','Grunnleggende')};
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
/* while the natural voice downloads, the session says so: otherwise the browser voice is taken for the real one */
function vnote(t){ const v=el('voiceNote'); if(v){ v.textContent=t||''; v.hidden=!t; } }
function nvLoad(){
  const n=el('ttsEngNote'); const ready=()=>{ vnote(''); if(n) n.textContent=L({en:'Natural voice ready. Generated on this device.',no:'Naturlig stemme klar. Lages på denne enheten.'}); };
  if(NV.ready){ ready(); return Promise.resolve(); }
  if(n) n.textContent=L({en:'Downloading the natural voice (about 90 MB, once). The browser voice speaks meanwhile.',no:'Laster ned den naturlige stemmen (omtrent 90 MB, én gang). Nettleserstemmen snakker så lenge.'});
  return NV.load(f=>{ const t=L({en:'Downloading the natural voice',no:'Laster ned den naturlige stemmen'})+` ${Math.round(f*100)} %`; if(n) n.textContent=t; vnote(t+' · '+L({en:'the browser voice speaks until then',no:'nettleserstemmen snakker så lenge'})); }).then(ready)
    .catch(()=>{ const t=L({en:'The natural voice could not be downloaded here. The browser voice is used.',no:'Den naturlige stemmen kunne ikke lastes ned her. Nettleserstemmen brukes.'}); if(n) n.textContent=t; vnote(t); });
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
const DESK=!!(window.matchMedia&&matchMedia('(pointer:fine)').matches);
const wantWhisper=()=>WH.supported&&(P.engine==='whisper'||(P.engine!=='browser'&&(!SR||DESK)));
const useWhisper=()=>wantWhisper()&&(WH.ready||!SR);
/* what Whisper is told came before: the callsign spelled out, the station, the controller's last words without
   numbers, and the standard words. It steers the recogniser to ICAO words without putting numbers in its mouth. */
function vocabPrompt(){ if(!ses) return '';
  const c=R.parseCallsign(P.callsign), sp=t=>R.spoken(t).replace(/\bQ N H\b/g,'QNH');
  const atc=String(ses.lastAtc||'').replace(/[0-9]+([.,][0-9]+)?/g,' ').replace(/\s+/g,' ').trim();
  const stn=(ses.unit&&ses.unit.n)||(ses.step&&ses.step.unit&&ses.step.unit.n)||'';
  return [stn, sp(c.full), sp(c.abbr), atc, 'runway, QNH, squawk, information, holding point, wilco, roger, affirm, negative, say again, decimal, niner, thousand, feet, flight level, heading, cleared, ready for departure, Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey X-ray Yankee Zulu.'].filter(Boolean).join('. ');
}
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
  MIC.wh=useWhisper(); if(MIC.wh) return whStart();
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
  try{ const t=await WH.stop(vocabPrompt()); finishVoice([t]); }
  catch(e){ note(tr('On-device speech recognition could not start here. Type your call, or switch to the browser recogniser in the settings.','Talegjenkjenning på enheten kunne ikke starte her. Skriv oppkallet, eller bytt til nettleserens gjenkjenning i innstillingene.')); }
  finally{ whBusy=false; ta.placeholder=PH(); }
}
function whPreload(){
  const n=el('engNote'); if(WH.ready){ if(n) n.textContent=L({en:'More accurate, and your voice never leaves this device. Ready.',no:'Mer nøyaktig, og stemmen din forlater aldri denne enheten. Klar.'}); return Promise.resolve(); }
  if(n) n.textContent=L({en:'Downloading the speech model (about 80 MB, once)…',no:'Laster ned talemodellen (omtrent 80 MB, én gang) …'});
  return WH.load(f=>{ if(n) n.textContent=L({en:'Downloading the speech model',no:'Laster ned talemodellen'})+` ${Math.round(f*100)} %`; })
    .then(()=>{ if(n) n.textContent=L({en:'More accurate, and your voice never leaves this device. Ready.',no:'Mer nøyaktig, og stemmen din forlater aldri denne enheten. Klar.'}); })
    .catch(()=>{ if(n) n.textContent=L({en:'The speech model could not be downloaded. Check the connection, or use the browser recogniser.',no:'Talemodellen kunne ikke lastes ned. Sjekk forbindelsen, eller bruk nettleserens gjenkjenning.'}); });
}
function micStop(){ if(MIC.wh){ whStop(); return; } const r=MIC.rec; if(r&&MIC.active){ setTimeout(()=>{ try{ r.stop(); }catch(e){} },350); } }
function setTx(on){ const t=$('#txi'), b=el('ptt'); if(t) t.classList.toggle('on',on); if(b){ b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); const s=b.querySelector('.pl'); if(s) s.textContent=on?L({en:'Release to send',no:'Slipp for å sende'}):L({en:'Hold to talk',no:'Hold for å snakke'}); } }

/* ---------------- views ---------------- */
const VIEWS=['home','pick','sess','deb'];
function goHome(){ drawHome(); show('home'); window.scrollTo({top:0,behavior:'auto'}); }
function show(v){ VIEWS.forEach(x=>{ const e=el('v-'+x); if(e) e.hidden=x!==v; }); if(v!=='sess'){ hush(); if(WH.close) WH.close(); if(MAPON&&window.NMAP&&v!=='deb') NMAP.stop(); } document.body.classList.toggle('rt-live',v==='sess'); document.body.classList.toggle('rt-in',v!=='home'); }
let ses=null, cur=null, group='vfr';

/* ---------------- home: the same system as the IFR trainer (trainhome.js, trainhome.css) ----------------
   head (track switch, three steps, Start · Guide me · All lessons) → refresher check or Start here → all lessons →
   more ways to practise (quick drill, whole trip, open practice with the AI) → level and voice */
const PATH=['basic','vfr','ifr','emerg','airline'];
let MODE=(()=>{ const q=new URLSearchParams(location.search).get('m'); return q==='refresh'||q==='basics'? q : (P.track==='refresh'?'refresh':'basics'); })();
document.body.classList.toggle('mode-refresh',MODE==='refresh');
const inGroup=k=>S.ALL.filter(s=>s.group===k&&(k!=='airline'||s.map)).sort((a,b)=>(a.full?1:0)-(b.full?1:0)||a.lvl-b.lvl);
const cnt=k=>{ const l=inGroup(k); return [l.filter(s=>best(s.k)>0).length,l.length]; };
const tried=k=>{ const [a,b]=cnt(k); return b>0&&a>=Math.ceil(b/2); };
const anyDone=()=>S.ALL.some(s=>best(s.k)>0);
const recGroup=()=>PATH.find(k=>!tried(k))||'vfr';
const nextIn=k=>{ const l=inGroup(k); return l.find(x=>!best(x.k))||l[0]; };
const LVN=[null,tr('Easy','Lett'),tr('Medium','Middels'),tr('Hard','Krevende')];
const difH=d=>`<span class="dif" aria-hidden="true"><i class="on"></i><i class="${d>1?'on':''}"></i><i class="${d>2?'on':''}"></i></span>`;
function openGroup(k){ if(k==='airline'){ group='airline'; drawPick(); show('pick'); el('pickBack').focus(); return; } startScenario(nextIn(k)); }
function setMode(m,user){ MODE=m; P.track=m;
  if(user){ if(m==='refresh'&&P.level==='beginner') P.level='intermediate'; if(m==='basics'&&P.level!=='beginner'&&!anyDone()) P.level='beginner'; }
  saveP(); const u=new URL(location.href); u.searchParams.set('m',m); history.replaceState(null,'',u.pathname+u.search+u.hash);
  document.body.classList.toggle('mode-refresh',m==='refresh'); drawHome(); }
function setLevel(v){ P.level=v; saveP(); if(LVSEG) LVSEG.set(v); el('lvlTip').textContent=L(LEVELS[v].d); }
let LVSEG=null;

/* small pictures for the five parts, drawn like the IFR exercise diagrams */
function thumbR(k){ const I='var(--ink)', A='var(--accent)', D='var(--ink-3)', F='font-family="IBM Plex Mono,monospace"';
  const ac=(x,y,r)=>`<g transform="translate(${x} ${y}) rotate(${r}) scale(.9)"><path d="M0-8 1.4-3.6V-1.4L8 1.8V3.2L1.4 2.2 1 5.4 3.6 6.8V7.9L0 7.2-3.6 7.9V6.8L-1 5.4-1.4 2.2-8 3.2V1.8L-1.4-1.4V-3.6Z" fill="${I}"/></g>`;
  let b='';
  if(k==='basic') b=`<text x="20" y="44" ${F} font-size="20" font-weight="600" fill="${I}">ALFA</text><text x="20" y="70" ${F} font-size="20" font-weight="600" fill="${D}">BRAVO</text><path d="M96 56c4-14 8 14 12 0s8 14 12 0 8 14 12 0 8 14 12 0" fill="none" stroke="${A}" stroke-width="2" stroke-linecap="round"/><text x="98" y="86" ${F} font-size="11" fill="${D}">1-1-8·3</text>`;
  if(k==='vfr') b=`<rect x="40" y="47" width="80" height="7" fill="${D}" opacity=".45"/><text x="44" y="68" ${F} font-size="9" fill="${D}">RWY 36</text><rect x="24" y="26" width="112" height="48" rx="12" fill="none" stroke="${A}" stroke-width="2" stroke-dasharray="1 0"/>${ac(80,26,90)}<text x="80" y="18" ${F} font-size="10" fill="${D}" text-anchor="middle">downwind</text><text x="80" y="90" ${F} font-size="10" fill="${D}" text-anchor="middle">final</text>`;
  if(k==='ifr') b=`<path d="M18 80 64 46 108 46" fill="none" stroke="${A}" stroke-width="2"/><path d="M108 46H134A10 10 0 0 0 134 26H108A10 10 0 0 0 108 46" fill="none" stroke="${I}" stroke-width="1.6"/><path d="M108 40l6 6-6 6-6-6z" fill="var(--paper,#fff)" stroke="${I}" stroke-width="1.4"/>${ac(46,59,54)}<text x="12" y="92" ${F} font-size="10" fill="${D}">SID</text><text x="148" y="66" ${F} font-size="10" fill="${D}" text-anchor="end">HOLD FL90</text>`;
  if(k==='emerg') b=`<rect x="22" y="30" width="62" height="34" rx="3" fill="#0F171D"/><text x="53" y="54" ${F} font-size="18" font-weight="600" fill="#F5C94A" text-anchor="middle">7700</text><text x="96" y="42" ${F} font-size="12" font-weight="600" fill="${A}">MAYDAY</text><text x="96" y="58" ${F} font-size="12" font-weight="600" fill="${D}">PAN PAN</text><text x="22" y="84" ${F} font-size="10" fill="${D}">7600 · radio failure</text>`;
  if(k==='airline') b=`<rect x="18" y="34" width="38" height="28" rx="3" fill="none" stroke="${I}" stroke-width="1.6"/><text x="37" y="53" ${F} font-size="13" font-weight="600" fill="${I}" text-anchor="middle">PF</text><rect x="66" y="34" width="38" height="28" rx="3" fill="${I}"/><text x="85" y="53" ${F} font-size="13" font-weight="600" fill="var(--paper,#fff)" text-anchor="middle">PM</text><path d="M108 48h22" stroke="${A}" stroke-width="2"/><path d="M126 43l6 5-6 5" fill="none" stroke="${A}" stroke-width="2"/><text x="134" y="52" ${F} font-size="11" fill="${D}">ATC</text><text x="18" y="84" ${F} font-size="10" fill="${D}">A320 · who says what</text>`;
  return `<svg class="thumb" viewBox="0 0 160 100" role="img" aria-label="${esc(L(GROUPS[k].t))}">${b}</svg>`; }
const PICS=k=>`<svg class="pic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${(GROUPS[k]||GROUPS.quick).ic}"/></svg>`;

function drawHero(){
  const last=P.last&&S.byKey(P.last)?S.byKey(P.last):null, rg=recGroup(), rn=PATH.indexOf(rg)+1, rl=rg==='airline'?null:nextIn(rg);
  TRAINHOME.track(el('modeSw'),MODE,{basics:tr('New to the radio, or still learning','Ny på radio, eller lærer fortsatt'),refresh:tr('You fly, and want to stay sharp','Du flyr og vil holde deg skarp')},m=>setMode(m,true));
  if(MODE==='refresh'){
    el('lead').textContent=L({en:'For pilots who want to stay sharp. Fly the readbacks at check pace with the controller text hidden, then a whole flight, and see exactly which items slip.',no:'For piloter som vil holde seg skarpe. Ta tilbakelesingene i sjekktempo med flygelederens tekst skjult, så en hel tur, og se nøyaktig hvilke elementer som glipper.'});
    el('heroCta').innerHTML=`<button class="btn2 pri lg" type="button" id="hcCheck">${L({en:'Start the refresher check',no:'Start oppfriskningssjekken'})}</button>`+(last?`<button class="btn2 lg" type="button" id="hcCont"><span class="k">${L({en:'Continue',no:'Fortsett'})}</span>${esc(L(last.t))}</button>`:'')+TRAINHOME.guideBtn()+`<a class="btn2 q lg" href="#all" id="hcAll">${L({en:'Practise one lesson',no:'Øv på én leksjon'})}</a>`;
    el('hcCheck').onclick=startCheck;
  } else {
    el('lead').textContent=L({en:'Talk to a controller by voice or keyboard, one call at a time. Start with the phonetic alphabet and work up to a whole IFR flight. Every call is checked item by item against EASA SERA.',no:'Snakk med en flygeleder med stemme eller tastatur, ett oppkall om gangen. Start med det fonetiske alfabetet og jobb deg opp til en hel IFR-tur. Hvert oppkall sjekkes element for element mot EASA SERA.'});
    TRAINHOME.promise(el('promise'),[[tr('Pick it','Velg'),tr('A short lesson of a few calls, in the order an instructor would teach.','En kort leksjon på noen få oppkall, i den rekkefølgen en instruktør ville lært bort.')],[tr('Say it','Si det'),tr('Hold the talk button and speak, or type. Both are graded the same.','Hold snakkeknappen og snakk, eller skriv. Begge vurderes likt.')],[tr('See it','Se det'),tr('Every item marked right or missing, with the rule behind it.','Hvert element merket riktig eller manglende, med regelen bak.')]]);
    const first=!anyDone();
    el('heroCta').innerHTML=(last?`<button class="btn2 pri lg" type="button" id="hcCont"><span class="k">${L({en:'Continue',no:'Fortsett'})}</span>${esc(L(last.t))}</button>`:'')+
      (!last||!rl||last.k!==rl.k?`<button class="btn2 ${last?'':'pri'} lg" type="button" id="hcNext"><span class="k">${first?L({en:'Start with step 1',no:'Start med steg 1'}):L({en:`Next on the path: step ${rn}`,no:`Neste på veien: steg ${rn}`})}</span>${esc(rl?L(rl.t):L(GROUPS[rg].t))}</button>`:'')+
      TRAINHOME.guideBtn()+`<a class="btn2 q lg" href="#all" id="hcAll">${L({en:'All lessons',no:'Alle leksjonene'})}</a>`;
    if(el('hcNext')) el('hcNext').onclick=()=>openGroup(rg);
  }
  if(el('hcCont')) el('hcCont').onclick=()=>startScenario(last);
  el('thGuide').onclick=openGuide;
  el('hcAll').onclick=e=>{ e.preventDefault(); el('all').scrollIntoView({behavior:'smooth',block:'start'}); };
  el('figCap').innerHTML=`<b>${L({en:'Cleared to land',no:'Klarert for landing'})}</b><span>${L({en:'Short final at dusk, Tower on the radio. Every call from the apron to here is one you can practise.',no:'Kort finale i skumringen, Tower på radioen. Hvert oppkall fra apron og hit kan du øve på.'})}</span>`;
  { const im=document.querySelector('.rt-head .hero-img'); if(im) im.alt=L({en:'View from the cockpit on short final at dusk: the approach and runway lights ahead, the tower beacon to the right, and the radio panel tuned to NORDAP Tower 118.300.',no:'Utsikt fra cockpit på kort finale i skumringen: innflygings- og banelysene foran, tårnets fyr til høyre og radioen stilt inn på NORDAP Tower 118.300.'}); }
}
function drawCheck(){
  el('chkSub').textContent=L({en:'Six readbacks in a row from all over the VFR and IFR lessons, at Check-ready level: normal pace, more static, the controller text hidden until you answer, strict readbacks. The items you got wrong before come first. About five minutes, then a whole flight if you want more.',no:'Seks tilbakelesinger etter hverandre fra hele VFR- og IFR-delen, på nivået Klar for sjekk: normalt tempo, mer støy, flygelederens tekst skjult til du svarer, strenge tilbakelesinger. Det du har bommet på før, kommer først. Omtrent fem minutter, og så en hel tur hvis du vil ha mer.'});
  el('chkList').innerHTML=[tr('Taxi and runway','Taksing og bane'),tr('Line-up and take-off','Oppstilling og avgang'),tr('Zone, FIS and AFIS','Sone, FIS og AFIS'),tr('IFR clearance and SID','IFR-klarering og SID'),tr('Levels and headings','Nivåer og kurser'),tr('Holds and approach','Venting og innflyging')].map(t=>`<li>${esc(L(t))}</li>`).join('');
  el('chkGo').innerHTML=`<button class="btn2 pri lg" type="button" id="chkStart">${L({en:'Start the check',no:'Start sjekken'})}</button><small>${L({en:'You can stop at any time.',no:'Du kan stoppe når som helst.'})}</small>`;
  el('chkStart').onclick=startCheck;
  el('fullRow').innerHTML=['vfrfull','ifrfull'].map(k=>{ const sc=S.byKey(k), b=best(k); return `<div class="xcard"><span class="k">${L({en:'Then a whole flight',no:'Så en hel tur'})}</span><h3>${esc(L(sc.t))}</h3><p>${esc(L(sc.d))}</p><button class="btn2" type="button" data-full="${k}">${L({en:'Start',no:'Start'})}${b?` · ${L({en:'best',no:'beste'})} ${b} %`:''}</button></div>`; }).join('');
  el('fullRow').querySelectorAll('[data-full]').forEach(b=>b.onclick=()=>startScenario(S.byKey(b.dataset.full)));
}
function startCheck(){ startScenario('quick',{level:'check',title:tr('Radio refresher check','Radio-oppfriskningssjekk')}); }
function drawPath(){
  const rg=recGroup(), done=PATH.filter(tried).length;
  el('pathSub').textContent=L({en:'Five parts, in the order an instructor would teach them. Each lesson is a short session of a few calls with a real controller.',no:'Fem deler, i den rekkefølgen en instruktør ville lært dem bort. Hver leksjon er en kort økt på noen få oppkall med en ekte flygeleder.'});
  el('pathProg').innerHTML=done?`<b>${done}</b> ${L({en:'of 5 parts done',no:'av 5 deler tatt'})}`:'';
  el('path').innerHTML=PATH.map((k,i)=>{ const g=GROUPS[k], r=k===rg, [a,n]=cnt(k), t=tried(k);
    const lv=Math.round(inGroup(k).reduce((s,x)=>s+(x.lvl||1),0)/Math.max(1,n));
    return `<li class="pstep${r?' rec':''}${t?' done':''}"><div class="pn"><i>${t?'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>':i+1}</i>${r?`<em>${anyDone()?L({en:'Next for you',no:'Neste for deg'}):L({en:'Start here',no:'Start her'})}</em>`:''}</div>
      <div class="pth">${thumbR(k)}</div><h3>${esc(L(g.t))}</h3><p>${esc(L(g.d))}</p>
      <div class="pm">${difH(lv)}<span>${esc(L(LVN[lv]))}</span><span class="pg${a?'':' none'}">${k==='airline'?L({en:'Departure or arrival',no:'Avgang eller ankomst'}):a?`${a}/${n} ${L({en:'done',no:'tatt'})}`:`${n} ${L({en:'lessons',no:'leksjoner'})}`}</span></div>
      <button class="btn2 ${r?'pri':''}" type="button" data-grp="${k}">${k==='airline'?L({en:'Choose',no:'Velg'}):a?L({en:'Continue',no:'Fortsett'}):L({en:'Start',no:'Start'})}<span class="sr">: ${esc(L(g.t))}</span></button></li>`; }).join('');
  el('path').querySelectorAll('[data-grp]').forEach(b=>b.onclick=()=>openGroup(b.dataset.grp));
  const due=R.SRS.due(jget(K.srs,{})).filter(id=>S.QUICK_POOL().includes(id)).length;
  el('warm').innerHTML=`${L(anyDone()?{en:'Back for two minutes? The quick drill gives you six readbacks, your weak ones first.',no:'Tilbake for to minutter? Kjapp drill gir deg seks tilbakelesinger, de svake først.'}:{en:'New to the radio? Start with the phonetic alphabet in Basics, then go in order.',no:'Ny på radio? Start med det fonetiske alfabetet i Grunnleggende, og gå så i rekkefølge.'})}${anyDone()?` <button type="button" class="lk" id="warmQ">${L({en:'Start the quick drill',no:'Start kjapp drill'})}</button>${due?` · ${due} ${L({en:'due for review',no:'til repetisjon'})}`:''}`:''}`;
  if(el('warmQ')) el('warmQ').onclick=()=>startScenario('quick');
}
let OPEN=null;
function drawAll(){
  el('allSub').textContent=L({en:'Every lesson, grouped like the path. Open a part to see its lessons.',no:'Alle leksjonene, gruppert som veien. Åpne en del for å se leksjonene.'});
  const cards=PATH.map(k=>{ const [a,n]=cnt(k), on=OPEN===k;
    return `<button type="button" class="gcard${on?' on':''}" data-g="${k}" aria-expanded="${on}">${PICS(k)}<b>${esc(L(GROUPS[k].t))}</b><span class="gs">${esc(L(GROUPS[k].d))}</span>
      <span class="gm"><span>${k==='airline'?L({en:'4 sessions',no:'4 økter'}):`${n} ${L({en:'lessons',no:'leksjoner'})}`}</span><span class="gbar" aria-hidden="true"><i style="width:${n?Math.round(a/n*100):0}%"></i></span><span>${a?`${a} ${L({en:'done',no:'tatt'})}`:L({en:'none done yet',no:'ingen tatt ennå'})}</span></span>
      <svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`; });
  cards.push(`<a class="gcard build" href="radio.html"><svg class="pic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h18M6 17l3-7h6l3 7M9 10V6h6v4"/></svg><b>${L({en:'Fly a whole trip',no:'Fly en hel tur'})}</b><span class="gs">${L({en:'DA42 gate to gate: flows, checklists, briefings and every call in order.',no:'DA42 gate to gate: flows, sjekklister, briefinger og hvert oppkall i rekkefølge.'})}</span><span class="gm"><span class="go">${L({en:'Open gate to gate',no:'Åpne gate to gate'})}</span></span></a>`);
  const cols=Math.max(1,getComputedStyle(el('groups')).gridTemplateColumns.split(' ').filter(Boolean).length||1), gi=PATH.indexOf(OPEN);
  if(gi>=0){ const k=OPEN, rg=nextIn(k), at=Math.min(cards.length,(Math.floor(gi/cols)+1)*cols);
    const rows=k==='airline'? `<p class="note">${L({en:'Choose departure or arrival, your seat (PM or PF) and whether to show the live airport map.',no:'Velg avgang eller ankomst, setet ditt (PM eller PF) og om du vil se det levende flyplasskartet.'})}</p><p><button class="btn2 pri sm" type="button" data-al>${L({en:'Choose the A320 session',no:'Velg A320-økten'})}</button></p>`
      : `<ol class="rows">${inGroup(k).map(x=>{ const b=best(x.k), r=rg&&x.k===rg.k; return `<li class="row${r?' rec':''}">${PICS(k)}<div class="tx"><b>${esc(L(x.t))}${r?`<em>${L({en:'Next for you',no:'Neste for deg'})}</em>`:''}</b><span>${esc(L(x.d))}</span></div>
        <div class="st"><span class="dl">${difH(x.lvl||1)}${esc(L(LVN[x.lvl||1]))}</span><span class="pg${b?'':' none'}">${b?`${L({en:'Best',no:'Beste'})} ${b} %`:L({en:'Not flown yet',no:'Ikke tatt ennå'})}</span></div>
        <div class="acts"><button class="btn2 sm ${r?'pri':''}" type="button" data-k="${x.k}">${b?L({en:'Again',no:'Igjen'}):L({en:'Start',no:'Start'})}<span class="sr">: ${esc(L(x.t))}</span></button></div></li>`; }).join('')}</ol>`;
    cards.splice(at,0,`<section class="gpanel" id="gpanel" aria-label="${esc(L(GROUPS[k].t))}"><header><h3>${esc(L(GROUPS[k].t))}</h3><p>${esc(L(GROUPS[k].d))}</p><button type="button" class="btn2 sm q" id="gClose">${L({en:'Close',no:'Lukk'})}</button></header>${rows}</section>`); }
  el('groups').innerHTML=cards.join('');
  el('groups').querySelectorAll('.gcard[data-g]').forEach(b=>b.onclick=()=>{ const k=b.dataset.g; OPEN=OPEN===k?null:k; drawAll(); const nb=document.querySelector(`.gcard[data-g="${k}"]`); if(nb) nb.focus({preventScroll:true}); });
  el('groups').querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>startScenario(S.byKey(b.dataset.k)));
  const al=el('groups').querySelector('[data-al]'); if(al) al.onclick=()=>openGroup('airline');
  if(el('gClose')) el('gClose').onclick=()=>{ const k=OPEN; OPEN=null; drawAll(); const nb=document.querySelector(`.gcard[data-g="${k}"]`); if(nb) nb.focus({preventScroll:true}); };
}
/* open practice with the AI controller: a few set situations instead of an empty box */
const AISIT=[
  ['vjoin',tr('VFR: join the circuit','VFR: inn i landingsrunden'),'VFR, DA42, 10 NM north of NORDAP at 2000 ft, inbound to land runway 36, information Bravo received.'],
  ['vafis',tr('VFR: through an AFIS zone','VFR: gjennom en AFIS-sone'),'VFR, DA42, 8 NM west of Skarvik (AFIS, Skarvik Information) at 1500 ft, want to cross the TIZ eastbound to NORDAP.'],
  ['iarr',tr('IFR: arrival and ILS','IFR: ankomst og ILS'),'IFR, DA42, 30 NM south of NORDAP at flight level 90, first call to NORDAP Approach, expect the ILS runway 36.'],
  ['epan',tr('Emergency: rough engine','Nød: motoren går ujevnt'),'VFR, DA42, 12 NM south of NORDAP at 2500 ft, the left engine is running rough: decide PAN PAN or MAYDAY and divert to NORDAP.']];
let AIOK=false;
function drawMore(){
  el('moreSub').textContent=L({en:'Short drills when you have two minutes, a whole trip when you have twenty.',no:'Korte driller når du har to minutter, en hel tur når du har tjue.'});
  const due=R.SRS.due(jget(K.srs,{})).filter(id=>S.QUICK_POOL().includes(id)).length;
  let h=`<div class="xcard"><span class="k">${L({en:'2 minutes',no:'2 minutter'})}${due?` · ${due} ${L({en:'due for review',no:'til repetisjon'})}`:''}</span><h3>${esc(L(GROUPS.quick.t))}</h3><p>${L({en:'Six readbacks from all over the trainer, the ones you got wrong before first. A good daily warm-up once you have done a few lessons.',no:'Seks tilbakelesinger fra hele treneren, de du har bommet på før først. En god daglig oppvarming når du har tatt noen leksjoner.'})}</p><button class="btn2" type="button" id="xQuick">${L({en:'Start quick drill',no:'Start kjapp drill'})}</button></div>
    <div class="xcard"><span class="k">${L({en:'5 minutes',no:'5 minutter'})}</span><h3>${L({en:'Test yourself',no:'Test deg selv'})}</h3><p>${L({en:'Ten questions on the rules: what to read back, the words to avoid, numbers and emergencies, with the reason behind each answer.',no:'Ti spørsmål om reglene: hva som skal leses tilbake, ord du bør unngå, tall og nødsituasjoner, med begrunnelsen bak hvert svar.'})}</p><a class="btn2" href="#quiz">${L({en:'Take the test',no:'Ta testen'})}</a></div>`;
  if(AIOK) h+=`<div class="xcard ai"><span class="k">${L({en:'Optional · AI',no:'Valgfritt · AI'})}</span><h3>${L({en:'Open practice with the AI controller',no:'Åpen trening med AI-flygeleder'})}</h3><p>${L({en:'When the lessons sit, try a situation without a script. Pick one; the AI answers like a controller and comments on each call.',no:'Når leksjonene sitter, prøv en situasjon uten manus. Velg en; AI-en svarer som en flygeleder og kommenterer hvert oppkall.'})}</p>
    <div class="pre">${AISIT.map(a=>`<button type="button" data-sit="${a[0]}">${esc(L(a[1]))}</button>`).join('')}<button type="button" data-sit="own">${L({en:'Your own situation',no:'Din egen situasjon'})}</button></div></div>`;
  el('xgrid').innerHTML=h;
  el('xQuick').onclick=()=>startScenario('quick');
  el('xgrid').querySelectorAll('[data-sit]').forEach(b=>b.onclick=()=>{ const a=AISIT.find(x=>x[0]===b.dataset.sit); el('aiSit').value=a?a[2]:''; el('ai').hidden=false; el('aiReset').click();
    el('ai').scrollIntoView({behavior:'smooth',block:'start'}); (a?el('aiSay'):el('aiSit')).focus({preventScroll:true}); });
  el('aiLead').textContent=L({en:'Make your first call as you would on the frequency. Change the situation at any time. The AI is a practice partner: the lessons above are the reference.',no:'Gjør det første oppkallet slik du ville gjort på frekvensen. Du kan endre situasjonen når som helst. AI-en er en treningspartner: leksjonene over er fasiten.'});
}
function drawSet(){
  el('setSub').textContent=L({en:'The level sets the pace for every lesson. Beginner shows what to include; Check-ready hides the controller text until you answer.',no:'Nivået styrer tempoet i alle leksjoner. Nybegynner viser hva du skal ta med; Klar for sjekk skjuler flygelederens tekst til du har svart.'});
  el('lvlTip').textContent=L(LEVELS[P.level].d);
  const st=jget(K.stats,{}); const weak=Object.entries(st).filter(([k,o])=>o.n>=2&&KIND[k]&&o.ok/o.n<0.9).map(([k,o])=>[k,o.ok/o.n]).sort((a,b)=>a[1]-b[1]).slice(0,3);
  el('homeStats').innerHTML= weak.length? `<b>${L({en:'Your weakest items so far',no:'Dine svakeste elementer så langt'})}:</b> `+weak.map(([k,v])=>`<span class="pill ${v<0.6?'bad':v<0.85?'mid':'good'}">${esc(L(KIND[k]))} ${Math.round(v*100)} %</span>`).join(' ') : '';
}
function drawHome(){ drawHero(); drawCheck(); drawPath(); drawAll(); drawMore(); drawSet(); }

/* Guide me: the same short dialog as on the IFR trainer */
function openGuide(){ TRAINHOME.guide({title:tr('Radio trainer · Guide me','Radiotrener · Guide meg'),
  steps:[
   {id:'who',q:tr('Where are you with the radio?','Hvor er du med radio?'),opts:[
     {v:'new',t:tr('New to it','Ny på det'),d:tr('I have hardly talked on the radio','Jeg har nesten ikke snakket på radio')},
     {v:'student',t:tr('In training','Under utdanning'),d:tr('PPL, CPL or IR course, learning the calls now','PPL-, CPL- eller IR-kurs, lærer oppkallene nå')},
     {v:'pilot',t:tr('I fly, and want to stay sharp','Jeg flyr og vil holde meg skarp'),d:tr('Licensed: a refresher or a check is coming','Har sertifikat: oppfriskning eller en sjekk nærmer seg')}]},
   {id:'what',when:a=>a.who!=='new',q:tr('What do you fly?','Hva flyr du?'),opts:[
     {v:'vfr',t:tr('VFR','VFR'),d:tr('Zones, FIS, AFIS fields and circuits','Soner, FIS, AFIS-plasser og landingsrunder')},
     {v:'ifr',t:tr('IFR','IFR'),d:tr('Clearances, SIDs, levels, holds and approaches','Klareringer, SID-er, nivåer, venting og innflyginger')},
     {v:'airline',t:tr('Airline, two-pilot crew','Flyselskap, to-pilotbesetning'),d:tr('A320: who says what, to whom','A320: hvem sier hva, til hvem')}]}],
  result(a){
    const gl=(k,lv)=>({label:{en:'Start: '+L(nextIn(k).t),no:'Start: '+L(nextIn(k).t)},run:()=>{ setLevel(lv); if(MODE!=='basics') setMode('basics',false); startScenario(nextIn(k)); }});
    if(a.who==='new') return {t:tr('Basics first, then VFR','Grunnleggende først, så VFR'),why:tr('Start with the phonetic alphabet and numbers, with the Beginner level on: a calm controller and the items to include shown on screen.','Start med det fonetiske alfabetet og tall, med nivået Nybegynner: en rolig flygeleder og elementene du skal ta med vist på skjermen.'),
      plan:[tr('Basics: alphabet, numbers, callsigns','Grunnleggende: alfabet, tall, kallesignaler'),tr('VFR flight: taxi, zones, circuits','VFR-tur: taksing, soner, landingsrunder'),tr('Then IFR and emergencies','Så IFR og nødsituasjoner')],go:gl('basic','beginner')};
    if(a.what==='airline') return {t:tr('A320 crew','A320-besetning'),why:tr('Choose departure or arrival and start in the PM seat: you talk to ATC, and the live map shows the aircraft move as your calls are accepted.','Velg avgang eller ankomst og start i PM-setet: du snakker med ATC, og det levende kartet viser flyet bevege seg når oppkallene godkjennes.'),
      go:{label:tr('Choose the A320 session','Velg A320-økten'),run:()=>{ setLevel(a.who==='pilot'?'check':'intermediate'); openGroup('airline'); }}};
    const k=a.what==='ifr'?'ifr':'vfr', full=S.byKey(k+'full');
    if(a.who==='student') return {t:{en:L(GROUPS[k].t),no:L(GROUPS[k].t)},why:tr('Go through the lessons in order at Intermediate level: normal pace, a hint only if you ask. Finish with the full flight.','Gå gjennom leksjonene i rekkefølge på nivået Middels: normalt tempo, hint bare om du ber om det. Avslutt med hele turen.'),
      go:gl(k,'intermediate'),alt:{label:{en:L(full.t),no:L(full.t)},run:()=>{ setLevel('intermediate'); startScenario(full); }}};
    return {t:tr('The refresher check, then a whole flight','Oppfriskningssjekken, så en hel tur'),why:tr('Six readbacks at check pace with the controller text hidden show what has slipped. Then fly the whole flight in one go.','Seks tilbakelesinger i sjekktempo med flygelederens tekst skjult viser hva som har glippet. Fly så hele turen i ett strekk.'),
      go:{label:tr('Start the refresher check','Start oppfriskningssjekken'),run:()=>{ if(MODE!=='refresh') setMode('refresh',false); startCheck(); }},
      alt:{label:{en:L(full.t),no:L(full.t)},run:()=>{ if(MODE!=='refresh') setMode('refresh',false); setLevel('check'); startScenario(full); }}};
  }}); }
/* the lessons in path order: basics, VFR, IFR, emergencies, airline; inside a section the easy ones first, full flights last */
function lessons(){ const order=['basic','vfr','ifr','emerg','airline']; const out=[];
  order.forEach(g=>{ S.ALL.filter(x=>x.group===g&&!(g==='airline'&&!x.map&&false)).sort((a,b)=>(a.full?1:0)-(b.full?1:0)||a.lvl-b.lvl).forEach(x=>out.push(x)); }); return out; }
function nextLesson(c){ if(!c||!c.k) return null; const L0=lessons().filter(x=>x.group!=='airline'||x.map); const i=L0.findIndex(x=>x.k===c.k); if(i<0) return L0.find(x=>!best(x.k))||null;
  return L0.slice(i+1).find(x=>!best(x.k))||L0[i+1]||null; }
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
    <p class="note">${L({en:'ATC phraseology follows EASA SERA. The calls between the pilots, to the ground crew and to the cabin follow common A320 practice as an example: your operator’s SOP always comes first.',no:'ATC-fraseologien følger EASA SERA. Kallene mellom pilotene, til bakkemannskapet og til kabinen følger vanlig A320-praksis som eksempel: operatørens SOP gjelder alltid først.'})}</p>
    <div class="go"><button class="btn pri" id="alGo" type="button">${L({en:'Start',no:'Start'})}</button><p>${esc(L(sc.d))}${b?` · ${L({en:'Best',no:'Beste'})} ${b} %`:''}</p></div></div>`;
  el('pickL').querySelectorAll('.opt').forEach(x=>x.onclick=()=>{ const v=x.dataset.v; A[x.dataset.grp]= v==='true'?true:v==='false'?false:v; saveP(); drawAirline(); });
  el('alGo').onclick=()=>startScenario(sc);
}
function drawPick(){
  el('pickT').textContent=L(GROUPS[group].t);
  if(group==='airline'){ el('pickL').className='alwrap'; drawAirline(); return; }
  el('pickL').className='sclist';
  const list=S.ALL.filter(s=>s.group===group);
  list.sort((a,b)=>(a.full?1:0)-(b.full?1:0)||a.lvl-b.lvl);
  const dur=s=>{ try{ const n=s.build(Object.assign(S.vars(1),{})).length; return Math.max(1,Math.round(n*0.35)); }catch(e){ return null; } };
  const LV=[null,{en:'Easy',no:'Lett'},{en:'Medium',no:'Middels'},{en:'Hard',no:'Krevende'}];
  el('pickL').innerHTML=list.map(s=>{ const b=best(s.k), m=dur(s); return `<button class="sc${s.full?' full':''}" data-k="${s.k}"><span class="lv">${L(LV[s.lvl])}${m?` · ~${m} min`:''}</span><b>${esc(L(s.t))}</b><small>${esc(L(s.d))}</small>${b?`<i>${L({en:'Best',no:'Beste'})} ${b} %</i>`:''}</button>`; }).join('');
}

/* ---------------- session ---------------- */
let ttsUnlocked=false;
function unlockTts(){ if(ttsUnlocked||!TTS) return; ttsUnlocked=true; try{ const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); }catch(e){} }
function startScenario(sc,o){ o=o||{}; unlockTts(); if(natural()&&P.voice) nvPreload(); const lvl0=o.level||P.level;
  AU.init(); hush();
  if(sc==='quick'){ const db=jget(K.srs,{}); const pool=S.QUICK_POOL(); const ids=R.SRS.due(db).concat(R.SRS.weak(db)).filter(id=>pool.includes(id));
    const seed=(Date.now()>>>0)^0x5bd1; const V=S.vars(seed,{callsign:P.callsign});
    cur={k:'quick',t:o.title||GROUPS.quick.t,group:'quick',basis:['SERA.8015(e)','AMC1 SERA.14001']}; ses=new R.Session(cur,{level:lvl0,V,steps:S.quick(V,R.rng(seed),ids),callsign:P.callsign}); }
  else if(sc&&sc.k==='retry'){ cur=sc; ses=new R.Session(cur,{level:lvl0,V:sc.V,steps:sc.steps}); }
  else { cur=sc; ses=new R.Session(sc,{level:lvl0,callsign:P.callsign}); if(sc.k&&sc.group!=='airline'){ P.last=sc.k; saveP(); } }
  el('sessT').textContent=L(cur.t); drawBasis(); el('log').innerHTML=''; el('fbBox').innerHTML=`<p class="muted">${L({en:'Feedback on each call appears here: what was right, what was missing, and why.',no:'Tilbakemelding på hvert oppkall kommer her: hva som var riktig, hva som manglet, og hvorfor.'})}</p>`;
  el('sitBox').innerHTML=''; el('fq').textContent='———.———'; el('stn').textContent=''; sitReset();
  MAPON=!!(cur.map&&window.NMAP); el('amapBox').hidden=!MAPON; el('v-sess').classList.toggle('hasmap',MAPON);
  if(MAPON){ if(!mapInit){ NMAP.init(el('amap')); mapInit=true; } NMAP.reset(cur.map,ses.V.dep,ses.V.arr); } else if(window.NMAP) NMAP.stop();
  show('sess'); run(ses.start());
  el('say').focus({preventScroll:true}); window.scrollTo({top:Math.max(0,el('trainer').offsetTop-70),behavior:'auto'});
}
/* "Based on": the rules and documents the scenario's calls and readbacks are checked against (radioscen.js BASIS) */
function drawBasis(){ const b=el('sessBasis'); if(!b) return; const list=(cur&&cur.basis)||[];
  b.hidden=!list.length; b.innerHTML=list.length? `${L(cur&&cur.sop?{en:'ATC calls based on',no:'ATC-kall basert på'}:{en:'Based on',no:'Basert på'})}: ${list.map(esc).join(' · ')} <a href="#sources">${L({en:'Sources',no:'Kilder'})}</a>`+(cur&&cur.sop?`<br>${L({en:'Crew, ground crew and cabin calls are example A320 SOP, not regulation. Your operator’s SOP always comes first.',no:'Kall mellom piloter, til bakkemannskap og kabin er eksempel på A320-SOP, ikke regelverk. Operatørens SOP gjelder alltid først.'})}`:'') : ''; }
let queue=Promise.resolve(), MAPON=false, mapInit=false;
const PH=()=>L(window.matchMedia&&matchMedia('(max-width:640px)').matches? {en:'Type your call, or hold the mic button and speak…',no:'Skriv oppkallet, eller hold mikrofonknappen og snakk …'} : {en:'Type your call, or hold the talk button (space bar) and speak…',no:'Skriv oppkallet, eller hold snakkeknappen (mellomrom) og snakk …'});
let BUSY=false;
function busy(on){ BUSY=!!on; const b=el('btnTx'); if(b) b.disabled=!!on; const t0=el('say'); if(t0) t0.readOnly=!!on; const t=el('turn'); if(on&&t){ t.innerHTML=`<div class="tk listen"><b>${L({en:'Listen',no:'Lytt'})}</b> ${L({en:'Others are talking or the aircraft is moving. Your turn comes next.',no:'Andre snakker eller flyet beveger seg. Din tur kommer straks.'})}</div>`+(MAPON?`<button class="lnk skipf" id="skipFwd" type="button">${L({en:'Skip ahead ⏩',no:'Hopp fram ⏩'})}</button>`:'');
    const sk=el('skipFwd'); if(sk) sk.onclick=()=>{ if(window.NMAP) NMAP.speed=14; hush(); sk.disabled=true; }; }
  if(!on&&window.NMAP) NMAP.speed=4; }
function run(ev){ queue=queue.then(()=>{ if(ev.some(e=>e.t==='say'||e.t==='act'||e.t==='atc')) busy(true); return play(ev); }).then(()=>{ busy(false); drawTurn(); phoneView(); }); return queue; }
/* phone with the live map: after each exchange, show the map, the transcript and your answer together */
function phoneView(){ if(!window.matchMedia||!matchMedia('(max-width:640px)').matches) return; const m=MAPON? el('v-sess').querySelector('.rs-main') : (!el('sitMapW').hidden? el('v-sess').querySelector('.rs-strip') : el('v-sess').querySelector('.rs-main')); if(!m) return;
  const bar=document.querySelector('.rs-top'); const off=(bar?bar.getBoundingClientRect().height:50)+8;
  const top=m.getBoundingClientRect().top+window.scrollY-off; if(Math.abs(window.scrollY-top)>8) window.scrollTo({top,behavior:'smooth'}); }
async function play(ev){
  for(const e of ev){
    if(e.t==='tune'){ el('fq').textContent=e.unit.f; el('stn').textContent=e.unit.n; if(/^(CREW|INT|PA)$/.test(e.unit.f)) continue; addMsg('sys','',`${L({en:'Tuned',no:'Stilt inn'})} <b>${esc(e.unit.n)}</b> ${esc(e.unit.f)}`); AU.click(); }
    else if(e.t==='act'){ if(MAPON&&window.NMAP){ phoneView(); const pr=NMAP.act(e.a); if(e.wait) await pr; } }
    else if(e.t==='say'){ if(e.atc){ await atcMsg(e); continue; }
      addMsg('crew ch-'+(e.ch||'crew'),L(e.label||{en:e.who,no:e.who})+(e.ch==='int'?' · interphone':e.ch==='pa'?' · PA':''),esc(e.text));
      await speak(e.text,{voice:e.voice,crew:e.ch!=='int'&&e.ch!=='pa'}); }
    else if(e.t==='sit'){ addMsg('sys sit','',esc(L(e.text))); kbTake(e.text&&e.text.en,true); drawSit(); el('sitBox').innerHTML=`<b>${L({en:'What is happening',no:'Hva som skjer'})}</b><p>${esc(L(e.text))}</p>`; el('sitBox').classList.remove('open'); el('sitBox').onclick=()=>el('sitBox').classList.toggle('open'); }
    else if(e.t==='prompt'){ addMsg('sys prompt','',L(e.text)); }
    else if(e.t==='note'){ addMsg('sys','',esc(L(e.text))); }
    else if(e.t==='model'){ if(e.fail&&document.querySelector('#log .fb.full')) addMsg('sys','',L({en:'Moving on to the next call.',no:'Vi går videre til neste oppkall.'})); else addMsg('sys model','',`${e.fail?L({en:'Moving on. A good call:',no:'Vi går videre. Et godt oppkall:'}):L({en:'A good call:',no:'Et godt oppkall:'})} <span class="mono">${esc(e.text)}</span>`); }
    else if(e.t==='atc'){ await atcMsg(e); }
    else if(e.t==='end'){ setTimeout(debrief,700); }
  }
}
function hideAtc(e){ const lv=ses?ses.level:P.level; return (e.listen||(e.atis&&lv!=='beginner')||(ses&&ses.L.hideAtc&&!e.atis))&&(TTS||NV.supported)&&P.voice; }
async function atcMsg(e){ kbTake(e.text);
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
  const nm=s=>s.prompt? String(L(s.prompt)).replace(/<[^>]+>/g,'') : String(L(s.task)||'').replace(/^P[FM] → /,'');
  el('calls').innerHTML=ses.steps.map((s,i)=>`<li class="${st[i]}"><i>${sym[st[i]]}</i><span>${esc(nm(s))}</span></li>`).join('');
  const ol=el('calls'), cur2=ol.querySelector('li.now'); if(cur2&&ol.scrollHeight>ol.clientHeight) ol.scrollTop=Math.max(0,cur2.offsetTop-ol.offsetTop-ol.clientHeight/2);
  el('stripCs').textContent=ses.V.c||P.callsign; el('stripTy').textContent=(ses.V.type||'')+(cur&&cur.group&&/^(vfr|ifr)$/.test(cur.group)?' · '+cur.group.toUpperCase():''); }
/* ---------------- the situation panel: map, where you are, the plan, kneeboard, live score ---------------- */
const RS=window.RSIT||null;
let SIT={id:null,trk:[],zoom:null}, KB={}, KBnew=new Set(), PACE={}, T0=0;
function lang(){ return LAB.lang==='no'?'no':'en'; }
function sitReset(){ SIT={id:null,trk:[],zoom:null,last:null}; KB={}; KBnew=new Set(); PACE={}; T0=0; drawKb(); drawLive(); }
function isIfr(){ return !!(cur&&(cur.group==='ifr'||cur.k==='efuel')); }
function drawSit(){
  const s=ses&&ses.step, a=RS&&s? RS.at(s,ses.V) : null, mw=el('sitMapW'), now=el('sitNow');
  const useOwn=!!a&&!MAPON; mw.hidden=!useOwn; now.hidden=!s&&!SIT.last;
  if(a){ SIT.last=a; if(SIT.id!==s.id){ SIT.id=s.id; const t=SIT.trk[SIT.trk.length-1]; if(!t||t.x!==a.pos.x||t.y!==a.pos.y) SIT.trk.push({x:a.pos.x,y:a.pos.y,ground:a.ground}); } }
  const A=a||SIT.last, u=(s&&s.unit)||ses&&ses.unit;
  const rows=[];
  if(A){ rows.push([L({en:'Where',no:'Hvor'}),`<dd class="big">${esc(A.lost?L({en:'Uncertain of position',no:'Usikker på posisjonen'}):RS.where(A.pos,lang(),isIfr()))}</dd>`]);
    rows.push([L({en:'Height',no:'Høyde'}),`<dd>${esc(RS.altText(A.alt,lang()))}</dd>`]);
    const F=cur&&cur.group==='ifr'?RS.FL.ifr:A.flight; if(F) rows.push([L({en:'Flight',no:'Tur'}),`<dd>${esc(L(F))}</dd>`]); }
  if(u&&!/^(CREW|INT|PA)$/.test(u.f)) rows.push([L({en:'Talking to',no:'Snakker med'}),`<dd>${esc(u.n)} <span class="fq">${esc(u.f)}</span></dd>`]);
  now.innerHTML=rows.map(r=>{ const fl=r[0]===L({en:'Flight',no:'Tur'}); return `<dt${fl?' class="fl"':''}>${r[0]}</dt>${fl?r[1].replace('<dd>','<dd class="fl">'):r[1]}`; }).join(''); now.hidden=!rows.length;
  if(useOwn) drawMap();
}
function drawMap(){ const A=SIT.last; if(!A||!RS) return; const cv=el('sitMap');
  const groundAuto=A.ground||Math.hypot(A.pos.x,A.pos.y)<1.4, zoom=SIT.zoom==null?groundAuto:SIT.zoom==='ad';
  const ifr=isIfr();
  RS.draw(cv,{pos:A.pos,ground:zoom,hdg:A.hdg,lost:A.lost,track:SIT.trk,ifr,lang:lang()});
  const z=el('sitMapZ'); z.hidden=false; z.textContent=zoom?L({en:'Area map',no:'Områdekart'}):L({en:'Aerodrome',no:'Flyplass'});
  z.onclick=()=>{ SIT.zoom=zoom?'area':'ad'; drawMap(); }; }
window.addEventListener('resize',()=>{ if(ses&&!el('sitMapW').hidden) drawMap(); });
/* kneeboard: what the controller has given you so far, as you would write it down */
const KBF=[['info',{en:'ATIS',no:'ATIS'}],['rwy',{en:'Runway',no:'Bane'}],['qnh',{en:'QNH',no:'QNH'}],['sq',{en:'Squawk',no:'Squawk'}],['lvl',{en:'Cleared',no:'Klarert'}],['hdg',{en:'Heading',no:'Kurs'}],['wind',{en:'Wind',no:'Vind'}],['next',{en:'Next frequency',no:'Neste frekvens'},1],['clr',{en:'Clearance',no:'Klarering'},1]];
function kbTake(t,infoOnly){ t=String(t||''); KBnew=new Set(); const set=(k,v)=>{ if(v&&KB[k]!==v){ KB[k]=v; KBnew.add(k); } };
  let m;
  if((m=/\binformation ([A-Z][a-z]+)\b/.exec(t))) set('info',m[1]);
  if(infoOnly){ drawKb(); return; }
  if((m=/\bQNH (\d{3,4})/i.exec(t))) set('qnh',m[1]);
  if((m=/\bsquawk (\d{4})/i.exec(t))) set('sq',m[1]);
  if((m=/(?<!short of |cross |crossing |vacate |vacated )\brunway (\d{2})\b(?! vacated)/i.exec(t))) set('rwy',m[1]);
  if((m=/\bwind (\d{3}) degrees (\d+) knots/i.exec(t))) set('wind',m[1]+'/'+m[2]);
  if((m=/\bheading (\d{3})\b/i.exec(t))) set('hdg',m[1]);
  if((m=/\b(?:climb|descend|cross[^.,]*?|maintain)(?:ing)?(?: to)?,? (flight level \d+|altitude \d+ feet|\d+ feet)/i.exec(t))) set('lvl',m[1].replace(/flight level /i,'FL').replace(/altitude /i,'').replace(/ feet/i,' ft'));
  if((m=/\bcontact ((?:[A-Z][A-Za-z]+ ?){1,3}) (\d{3}\.\d{1,3})/.exec(t))) set('next',m[1].trim()+' '+m[2]);
  if((m=/\bcleared to ([A-Z]{3,}[^,]*?via [A-Z0-9 ]+?(?:departure|arrival))/.exec(t))) set('clr',m[1]);
  drawKb(); }
function drawKb(){ const box=el('kb'); if(!box) return; const f=KBF.filter(([k])=>KB[k]); box.hidden=!f.length;
  box.innerHTML=f.length? `<h4>${L({en:'Kneeboard',no:'Kneebrett'})}</h4><div class="g">${f.map(([k,l,w])=>`<div class="c${w?' wide':''}${KBnew.has(k)?' new':''}"><span>${esc(L(l))}</span><b>${esc(KB[k])}</b></div>`).join('')}</div>` : ''; }
/* the score, as you go: four things a check looks at */
function scores(){ if(!ses) return null; const rs=ses.results.filter(r=>!r.skipped&&r.cat!=='basic'); const all=ses.results.filter(r=>!r.skipped);
  if(!all.length) return null;
  let req=0,ok=0,nr=0,nok=0; const NUMK=['qnh','sq','freq','alt','fl','hdg','rwy','hp','hs','trk','spd','info','letter','wind','num','fix','turn'];
  all.forEach(r=>(r.res0||r.res).forEach(e=>{ if(e.opt) return; req++; if(e.st==='ok'||e.st==='warn') ok++; if(r.cat==='rb'&&NUMK.includes(e.k)){ nr++; if(e.st==='ok'||e.st==='warn') nok++; } }));
  const phr=all.filter(r=>!(r.flags||[]).length).length/all.length;
  const pv=Object.values(PACE); const pace=pv.length? pv.reduce((a,t)=>a+Math.max(.4,Math.min(1,1-(t-6)/32)),0)/pv.length : null;
  return {comp:req?ok/req:null, rb:nr?nok/nr:null, phr, pace, first:all.filter(r=>r.first).length/all.length}; }
const SCL=[['comp',{en:'Completeness',no:'Fullstendighet'},{en:'Every required item in the call',no:'Alle påkrevde elementer i oppkallet'}],['rb',{en:'Readback',no:'Tilbakelesing'},{en:'Numbers and clearances read back right',no:'Tall og klareringer riktig lest tilbake'}],['phr',{en:'Phraseology',no:'Fraseologi'},{en:'Standard words, no “repeat”, “yes” or “take-off” for ready',no:'Standardord, ikke «repeat», «yes» eller «take-off» for klar'}],['pace',{en:'Pace',no:'Tempo'},{en:'How quickly you answered',no:'Hvor raskt du svarte'}]];
const pc=v=>v==null?'–':Math.round(v*100)+'%';
function drawLive(){ const box=el('liveScore'); if(!box) return; const sc=scores(); box.hidden=!sc;
  if(!sc) return; box.innerHTML=`<h4>${L({en:'This session',no:'Denne økten'})}</h4>`+SCL.filter(([k])=>sc[k]!=null).map(([k,l])=>{ const v=sc[k]; return `<div class="r"><span>${esc(L(l))}</span><span class="bar"><i class="${v<.6?'bad':v<.85?'mid':''}" style="width:${Math.round(v*100)}%"></i></span><b>${pc(v)}</b></div>`; }).join(''); }
function drawTurn(){
  const s=ses&&ses.step; const box=el('turn'); drawCalls(); drawSit(); drawLive(); if(ses&&!ses.done&&SIT.clk!==ses.i){ SIT.clk=ses.i; T0=Date.now(); }
  el('prog').textContent= ses&&!ses.done? `${L({en:'Call',no:'Oppkall'})} ${Math.min(ses.i+1,ses.steps.length)} / ${ses.steps.length}` : '';
  const sm=ses?ses.summary():null; el('score').textContent= sm&&sm.n? sm.score+' %' : '';
  if(!s||ses.done){ box.innerHTML=''; return; }
  const req=(s.els||[]).filter(e=>!e.opt), opt=(s.els||[]).filter(e=>e.opt);
  const chip=e=>`<span class="ichip${e.opt?' opt':''}">${esc(L(e.l||R.label(e,ses.V)))}</span>`;
  const showList=(ses.L.hints||box.dataset.hint==='1')&&!(s.els||[]).some(e=>e.k==='spell'||e.k==='say'||e.k==='abbr');
  if(need&&need.length&&ses.tries>0){ const hc=(s.els||[]).some(e=>e.k==='cs'); box.innerHTML=hc? `<div class="tk"><b>${L({en:'Your turn',no:'Din tur'})}</b> ${esc(L({en:'The controller asked for ',no:'Flygelederen ba om '}))}<b class="need">${esc(need.join(', '))}</b>${esc(L({en:'. Give just that, with your callsign.',no:'. Gi bare det, med kallesignalet ditt.'}))}</div>` : `<div class="tk"><b>${L({en:'Try again',no:'Prøv igjen'})}</b> <b class="need">${esc(need.join(', '))}</b></div>`; el('btnAgain').disabled=!ses.lastAtc; return; }
  if(!ses.tries) need=null;
  const phone=window.matchMedia&&matchMedia('(max-width:640px)').matches;
  const coach=!jget(K.coach,0)? `<div class="coach">${L(phone?{en:'Hold the mic button and speak, or type your call and press Transmit.',no:'Hold mikrofonknappen og snakk, eller skriv oppkallet og trykk Transmit.'}:{en:'Hold the talk button (or the space bar) and speak, or type your call and press Transmit.',no:'Hold snakkeknappen (eller mellomromstasten) og snakk, eller skriv oppkallet og trykk Transmit.'})}</div>` : '';
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
  return `<ul class="els">${bad.map(r=>`<li class="${r.st}"><span class="sy">${SYM[r.st]}</span><span>${esc(L(r.label))}${r.st==='wrong'&&r.got?(r.k==='spell'?` <em>${L({en:'you said',no:'du sa'})} ${esc([].concat(r.got).map(x=>L(x)).join(', '))}</em>`:` <em>${L({en:'you said',no:'du sa'})} “${esc(r.got)}”</em>`):''}</span></li>`).join('')}${g.flags.map(f=>`<li class="warn"><span class="sy">!</span><span>${esc(L(f))}</span></li>`).join('')}</ul>`;
}
function fbHtml(g,s,kind){
  const rows=g.res.map(r=>`<li class="${r.st}${r.opt&&r.st!=='ok'?' opt':''}"><span class="sy">${r.opt&&r.st!=='ok'?'○':SYM[r.st]}</span><span>${esc(L(r.label))}${r.st==='wrong'&&r.got?(r.k==='spell'?` <em>${L({en:'you said',no:'du sa'})} ${esc([].concat(r.got).map(x=>L(x)).join(', '))}</em>`:` <em>${L({en:'you said',no:'du sa'})} “${esc(r.got)}”</em>`):''}${r.st==='warn'&&r.got?` <em>“${esc(r.got)}”</em>`:''}${r.opt&&r.st!=='ok'?` <em>${L({en:'good to include',no:'bra å ta med'})}</em>`:''}${r.carried?` <em>${L({en:'from your last call',no:'fra forrige oppkall'})}</em>`:''}</span></li>`).join('');
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
  if(!ses||ses.done||BUSY) return; const ta=el('say'); const txt=ta.value.trim(); if(!txt) return; jset(K.coach,1);
  hush(); ta.value=''; revealAll();
  const s=ses.step; if(T0&&PACE[ses.i]==null&&!ses.tries) PACE[ses.i]=(Date.now()-T0)/1000; const r=ses.submit(txt);
  if(!r.g||r.g.empty) return;
  const heard=MIC.heard&&MIC.said===txt? MIC.heard : null; MIC.heard=null;
  const chn=s.unit&&/^(CREW|INT|PA)$/.test(s.unit.f)? (s.unit.f==='INT'?' · interphone':s.unit.f==='PA'?' · PA':' · '+L({en:'to the other pilot',no:'til den andre piloten'})) : '';
  const meWho= cur&&cur.role? `${L({en:'You',no:'Du'})} (${cur.role})${chn}` : ses.V.cs.full;
  const me=addMsg('me',meWho,esc(txt)+(heard?`<div class="heard">${esc(L({en:'Heard',no:'Hørt'}))}: <span class="mono">${esc(heard.replace(/[.,;\s]+$/,""))}</span>. ${esc(L({en:'A repeated word the recogniser merged was restored.',no:'Et gjentatt ord som gjenkjenningen slo sammen, ble lagt tilbake.'}))}</div>`:''));
  if(r.kind==='sayagain'||r.kind==='standby'){ await run(r.ev); return; }
  const g=r.g, ok=r.kind==='pass';
  document.querySelectorAll('#log .fb.full').forEach(x=>{ x.innerHTML=x._short||''; x.classList.remove('full'); });
  const fb=document.createElement('div'); fb.className='fb full'; fb._short=fbShort(g); me.appendChild(fb);
  me.classList.add(ok?'good':r.kind==='fail'?'bad':'try');
  const head= ok? (g.flags.length? L({en:'Accepted, with a note',no:'Godkjent, med en merknad'}) : L({en:'Correct',no:'Riktig'})) : r.kind==='retry'? (s.noAtc? L({en:'Not quite: try again',no:'Ikke helt: prøv igjen'}) : L({en:'Not yet: the controller corrects you',no:'Ikke ennå: flygelederen korrigerer deg'})) : L({en:'Missed',no:'Bommet'});
  /* on a retry the answer is not shown yet: the controller has asked for the missing part, so the pilot gets one more go */
  need= r.kind==='retry'? g.res.filter(x=>x.st!=='ok'&&!x.opt&&x.k!=='cs').map(x=>String(L(x.label)).replace(/^(Station|Stasjon|Position|Posisjon|Intention|Hensikt|Condition|Betingelse): /,'')) : null; if(need&&!need.length) need=[L({en:'Your callsign',no:'Kallesignalet ditt'})];
  const hasCs=(s.els||[]).some(e=>e.k==='cs');
  const ask= need&&need.length? `<div class="model"><b>${L(hasCs?{en:'Reply with',no:'Svar med'}:{en:'Try again',no:'Prøv igjen'})}</b><span>${esc(need.join(', '))}${hasCs?L({en:', and your callsign. You do not need to repeat the rest.',no:', og kallesignalet ditt. Resten trenger du ikke gjenta.'}):''}</span></div>` : '';
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
  drawDeb(sm); const d=el('v-deb'); if(d){ const t=d.getBoundingClientRect().top+window.scrollY-80; window.scrollTo({top:Math.max(0,t),behavior:'smooth'}); }
}
function save(sm){
  // storage: best, progress, spaced repetition, element statistics
  if(cur.k!=='retry'&&cur.k!=='quick'){ try{ if(sm.score>best(cur.k)) localStorage.setItem('naeroson-radio-'+cur.k,String(sm.score)); }catch(e){} if(window.NPROG&&cur.award) NPROG.award(cur.award,sm.score); }
  jset(K.srs,R.SRS.update(jget(K.srs,{}),ses.results.filter(r=>/^[a-z]+:\d+$/.test(r.id||'')&&!/^b-/.test(r.id))));
  const st=jget(K.stats,{}); Object.entries(sm.kinds).forEach(([k,o])=>{ const x=st[k]=st[k]||{n:0,ok:0}; x.n+=o.n; x.ok+=o.ok; }); jset(K.stats,st);
}
function drawDeb(sm){
  const km={}; Object.entries(sm.kinds).filter(([k])=>KIND[k]).forEach(([k,o])=>{ const n=L(KIND[k]); const x=km[n]=km[n]||{n:0,ok:0,k}; x.n+=o.n; x.ok+=o.ok; });
  const kinds=Object.entries(km).map(([n,o])=>[o.k,o]).sort((a,b)=>a[1].ok/a[1].n-b[1].ok/b[1].n);
  const missed=w=>{ const r=(w.res0||w.res||[]).filter(e=>!e.opt&&e.st!=='ok'&&e.st!=='warn').map(e=>L(KIND[e.k]||{en:e.k,no:e.k})); return [...new Set(r)]; };
  const verdict= sm.score>=90&&!sm.retried? tr('Clean, complete radio work. Try the next level up.','Ren og fullstendig radiobruk. Prøv neste nivå.') : sm.score>=90? tr(`Strong session, but ${sm.retried} call${sm.retried>1?'s':''} needed a second try. Practise ${sm.retried>1?'them':'it'} below.`,`Sterk økt, men ${sm.retried} oppkall måtte tas på nytt. Øv på ${sm.retried>1?'dem':'det'} under.`) : sm.score>=70? tr('Good. Practise the red items below once more.','Bra. Øv på de røde punktene under én gang til.') : tr('Keep going: practise the weak items, then fly it again. New values every time.','Fortsett: øv på de svake punktene, og fly den igjen. Nye verdier hver gang.');
  el('debBody').innerHTML=`<div class="dtop"><div class="big">${sm.score}<small>%</small></div><div><h3>${esc(L(cur.t))}</h3><p>${esc(L(verdict))}</p><p class="muted">${esc(L(LEVELS[ses.level].t))} · ${sm.n} ${L({en:'calls',no:'oppkall'})}</p></div></div>
    ${(()=>{ const sc=scores(); return sc? `<div class="deb-sc">${SCL.filter(([k])=>sc[k]!=null).map(([k,l,d])=>`<div><span>${esc(L(l))}</span><b>${pc(sc[k])}</b><small>${esc(L(d))}</small></div>`).join('')}</div>` : ''; })()}
    <div class="kpis"${Object.keys(sm.cats).length<2?' hidden':''}>${Object.entries(sm.cats).map(([k,v])=>`<div class="kpi"><span>${esc(L(CAT[k]||tr(k)))}</span><b>${v} %</b></div>`).join('')}</div>
    ${kinds.length?`<h4>${L({en:'Element by element',no:'Element for element'})}</h4><table class="ktab"><tbody>${kinds.map(([k,o])=>{ const p=Math.round(o.ok/o.n*100); return `<tr><td>${esc(L(KIND[k]))}</td><td><span class="bar${p===0?' zero':''}"><i style="width:${Math.max(p,0)}%" class="${p<60?'bad':p<85?'mid':'good'}"></i></span></td><td>${o.ok}/${o.n}</td></tr>`; }).join('')}</tbody></table>`:''}
    ${sm.weak.length?`<h4>${L({en:'Practise these again',no:'Øv på disse igjen'})}</h4><div class="weak">${sm.weak.slice(0,5).map(w=>`<div class="wi"><b>${Math.round(w.score*100)} %</b><div><p>${esc(w.prompt? String(L(w.prompt)).replace(/<[^>]+>/g,'') : L(w.task))}</p>${missed(w).length?`<p class="miss">${L({en:'You missed',no:'Du bommet på'})}: <b>${esc(missed(w).join(', '))}</b></p>`:''}<span class="mono">${esc(w.model)}</span></div></div>`).join('')}</div>`:`<p class="muted">${L({en:'No weak items in this session.',no:'Ingen svake punkter i denne økten.'})}</p>`}`;
  el('btnWeak').hidden=!sm.weak.length;
  const nx=nextLesson(cur); const nb=el('debNext'); if(nb){ nb.hidden=!nx; if(nx){ nb.textContent=`${L({en:'Next lesson',no:'Neste leksjon'})}: ${L(nx.t)} →`; nb.onclick=()=>startScenario(nx); } }
  el('btnWeak').className= nx&&!sm.weak.length? 'btn' : 'btn pri'; if(nb) nb.className= sm.weak.length? 'btn' : 'btn pri';
}

/* ---------------- AI free talk (optional) ---------------- */
function aiSetup(){
  if(!window.NAI) return;
  let wired=false; NAI.onMode(mode=>{ AIOK=!!mode; drawMore(); if(!mode){ el('ai').hidden=true; return; } if(wired) return; wired=true;
    let turns=[]; const log=el('aiLog');
    const add=(cls,who,h)=>{ const d=document.createElement('div'); d.className='msg '+cls; d.innerHTML=(who?`<span class="who">${esc(who)}</span>`:'')+h; log.appendChild(d); log.scrollTop=log.scrollHeight; return d; };
    const rules=()=>`You are an air traffic controller in a radiotelephony training simulator for pilots training under EASA in Norway. Fictional aerodrome NORDAP, runway 36/18, Tower 118.300, Ground 121.700, Approach 119.250, transition altitude 7000 ft. The pilot is ${P.callsign}, a DA42. Situation: ${el('aiSit').value||'infer it from the first call'}. Reply as ATC with ICAO Doc 4444/9432 and SERA phraseology, then judge only the pilot's last transmission. Reply with JSON only: {"atc":"…","ok":true|false,"notes":["max 3, in ${NAI.langName()}"],"better":"ideal pilot transmission"}`;
    async function send(){ const t=el('aiSay').value.trim(); if(!t) return; el('aiSay').value=''; const me=add('me',P.callsign,esc(t)); turns.push({role:'user',content:'PILOT: '+t}); const w=add('atc','ATC','…');
      try{ const r=await NAI.json([{role:'user',content:rules()},...turns.slice(-20)]); const a=String(r&&r.atc||'Say again.'); w.innerHTML=`<span class="who">ATC</span>${esc(a)}`; turns.push({role:'assistant',content:JSON.stringify({atc:a})});
        const fb=document.createElement('div'); fb.className='fb'; fb.innerHTML=`<ul class="els">${(r.notes||[]).slice(0,3).map(n=>`<li class="${r.ok?'warn':'wrong'}"><span class="sy">${r.ok?'!':'✕'}</span><span>${esc(n)}</span></li>`).join('')}${r.ok&&!(r.notes||[]).length?`<li class="ok"><span class="sy">✓</span><span>${L({en:'Correct and complete',no:'Riktig og fullstendig'})}</span></li>`:''}</ul>${!r.ok&&r.better?`<div class="model"><span class="mono">${esc(r.better)}</span></div>`:''}`; me.appendChild(fb); speak(a); }
      catch(e){ w.remove(); turns.pop(); el('aiNote').textContent=NAI.errText(e); if(NAI.fatal(e)){ el('ai').hidden=true; AIOK=false; drawMore(); } } }
    el('aiSend').onclick=send; el('aiSay').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }); el('aiReset').onclick=()=>{ turns=[]; log.innerHTML=''; };
  });
}

/* ---------------- wiring ---------------- */
function init(){
  LVSEG=LAB.seg(el('lvlSeg'),[['beginner','Beginner'],['intermediate','Intermediate'],['check','Check-ready']],P.level,v=>{ P.level=v; saveP(); el('lvlTip').textContent=L(LEVELS[v].d); });
  el('aiClose').onclick=()=>{ el('ai').hidden=true; };
  el('pickL').addEventListener('click',e=>{ const b=e.target.closest('.sc'); if(!b) return; startScenario(S.byKey(b.dataset.k)); });
  el('pickBack').onclick=()=>{ goHome(); };
  el('sessBack').onclick=()=>{ if(ses&&ses.results.length&&!ses.done&&!confirm(L({en:'Leave this session? Your answers so far are not saved.',no:'Forlate økten? Svarene så langt lagres ikke.'}))) return; hush(); ses=null; goHome(); };
  el('debHome').onclick=()=>{ goHome(); };
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
    eng.value=wantWhisper()?'whisper':'browser';
    const sync=()=>{ el('setMic').closest('label').hidden=eng.value==='whisper'&&!!WH.ready; if(eng.value==='whisper'){ if(P.engine==='whisper'||WH.ready) whPreload(); else el('engNote').textContent=L({en:'More accurate, and your voice never leaves this device. Downloads about 80 MB the first time you talk.',no:'Mer nøyaktig, og stemmen din forlater aldri denne enheten. Laster ned omtrent 80 MB første gang du snakker.'}); } else el('engNote').textContent=L({en:'Uses the browser’s own recogniser (Chrome and Edge send the audio to Google, Safari to Apple).',no:'Bruker nettleserens egen gjenkjenning (Chrome og Edge sender lyden til Google, Safari til Apple).'}); };
    eng.onchange=()=>{ P.engine=eng.value; saveP(); sync(); }; sync(); }
  el('setTest').onclick=()=>{ AU.init(); speak(`${R.parseCallsign(P.callsign).full}, NORDAP Tower, wind 340 degrees 8 knots, runway 36, cleared to land.`); };
  const te=el('setTts'); if(te){ if(!NV.supported){ te.value='browser'; te.disabled=true; } else te.value=natural()?'natural':'browser';
    const sync=()=>{ if(te.value==='natural'){ if(NV.ready||P.tts==='natural') nvPreload(); else el('ttsEngNote').textContent=L({en:'Sounds like a person, generated on this device. Downloads about 90 MB the first time.',no:'Høres ut som et menneske, laget på denne enheten. Laster ned omtrent 90 MB første gang.'}); }
      else el('ttsEngNote').textContent=L({en:'The browser’s built-in voice: starts at once, sounds synthetic.',no:'Nettleserens innebygde stemme: starter med en gang, høres syntetisk ut.'}); };
    te.onchange=()=>{ P.tts=te.value; saveP(); hush(); sync(); }; sync(); }
  if(!TTS&&!NV.supported){ el('setVoice').disabled=true; el('ttsNote').textContent=L({en:'This browser has no speech synthesis: the controller is shown as text.',no:'Denne nettleseren har ikke talesyntese: flygelederen vises som tekst.'}); }
  el('say').placeholder=PH();
  drawHome(); show('home'); aiSetup();
  { const c=navigator.connection||{}; const ok=!c.saveData&&!/2g/.test(c.effectiveType||'')&&c.type!=='cellular'&&window.matchMedia&&matchMedia('(pointer:fine)').matches;
    if(ok) setTimeout(()=>{ (window.requestIdleCallback||setTimeout)(()=>{ if(natural()&&P.voice&&!NV.ready) nvPreload(); if(wantWhisper()&&!WH.ready) whPreload(); }); },2500); }
  LAB.onLang(()=>{ const y=window.scrollY; requestAnimationFrame(()=>window.scrollTo(0,y)); drawHome(); if(!el('v-pick').hidden) drawPick(); if(ses&&!el('v-sess').hidden){ el('sessT').textContent=L(cur.t); drawBasis(); drawTurn(); } if(!el('v-deb').hidden&&ses) drawDeb(ses.summary()); });
  // test hooks (headless browsers cannot speak): type and transmit
  window.__radio={get ses(){ return ses; },vocab:()=>vocabPrompt(),voice:c=>finishVoice(c),micStart,micStop,say(t){ el('say').value=t; return transmit(false); },model(){ return ses&&ses.step?ses.step.model:''; },start:k=>startScenario(k==='quick'?'quick':S.byKey(k)),idle:()=>queue};
}
init();
})();
