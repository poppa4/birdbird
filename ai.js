/* Birdbird – felles AI og tale.
   AI: Claude via artifact-kapabiliteten «sample» (brukerens egen konto), eller /api/atc når siden ligger på eget domene.
   Tale: talesyntese for ATC og eksaminator, push-to-talk / diktering med nettleserens talegjenkjenning. */
(function(G){
'use strict';
let mode=null; // null | 'sample' | 'api'
let fn=null;
const waiters=[];
const ready=(async()=>{
  try{ if(G.claude&&G.claude.use){ fn=await G.claude.use('sample'); if(fn) mode='sample'; } }catch(e){ fn=null; }
  if(!mode && location.protocol.startsWith('http')){
    try{ const r=await fetch('/api/atc',{method:'GET'}); if(r.ok){ const j=await r.json(); if(j&&j.ok) mode='api'; } }catch(e){}
  }
  return mode;
})();

function lang(){ return document.documentElement.lang==='nb'?'no':'en'; }
function langName(){ return lang()==='no'?'Norwegian (bokmål)':'English'; }

async function apiCall(messages,signal){
  const res=await fetch('/api/atc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages}),signal})
    .catch(()=>{ throw {code:signal&&signal.aborted?'cancelled':'upstream_error'}; });
  if(res.status===429) throw {code:'rate_limited'}; if(!res.ok) throw {code:'upstream_error'};
  const j=await res.json(); return String(j.text||'');
}
function parseJson(t){
  try{ return JSON.parse(t); }catch(e){}
  const f=t.match(/```(?:json)?\s*([\s\S]*?)```/); if(f){ try{ return JSON.parse(f[1]); }catch(e){} }
  const a=Math.min(...['{','['].map(c=>{ const i=t.indexOf(c); return i<0?1e9:i; })), b=Math.max(t.lastIndexOf('}'),t.lastIndexOf(']'));
  if(a<1e9&&b>a){ try{ return JSON.parse(t.slice(a,b+1)); }catch(e){} }
  throw {code:'invalid_json',text:t};
}
/* input: string eller [{role,content}] som starter og slutter på user */
async function text(input,o){ o=o||{}; await ready;
  if(mode==='sample'){ const op={signal:o.signal,cache:false,modelTier:o.tier||'default',onText:o.onText}; if(o.images) op.images=o.images; return (await fn(input,op)).text; }
  if(mode==='api'){ const t=await apiCall(typeof input==='string'?[{role:'user',content:input}]:input,o.signal); o.onText&&o.onText({text:t,delta:t}); return t; }
  throw {code:'not_available'};
}
async function json(input,o){ o=o||{}; await ready;
  if(mode==='sample'){ const op={signal:o.signal,cache:false,modelTier:o.tier||'default'}; if(o.images) op.images=o.images; return await fn.json(input,op); }
  if(mode==='api') return parseJson(await apiCall(typeof input==='string'?[{role:'user',content:input}]:input,o.signal));
  throw {code:'not_available'};
}
const MSG={
  not_available:{en:'The AI is not available here. Open the page in Claude, or on a site with the AI service set up.',no:'AI-en er ikke tilgjengelig her. Åpne siden i Claude, eller på et nettsted der AI-tjenesten er satt opp.'},
  not_granted:{en:'Claude was not allowed for this page.',no:'Claude ble ikke tillatt for denne siden.'},
  sampling_disabled:{en:'Claude is not available for this account.',no:'Claude er ikke tilgjengelig for denne kontoen.'},
  rate_limited:{en:'Too many requests right now. Wait a moment and try again.',no:'For mange forespørsler akkurat nå. Vent litt og prøv igjen.'},
  invalid_json:{en:'The answer came back garbled. Try again.',no:'Svaret kom tilbake uleselig. Prøv igjen.'},
  prompt_too_large:{en:'Too much text at once. Pick fewer documents or a shorter answer.',no:'For mye tekst på en gang. Velg færre dokumenter eller et kortere svar.'},
  refused:{en:'The AI declined that request. Rephrase it.',no:'AI-en avslo den forespørselen. Formuler den annerledes.'},
  session_expired:{en:'Sign in to Claude again.',no:'Logg inn i Claude på nytt.'},
  other:{en:'No answer. Try again.',no:'Ikke noe svar. Prøv igjen.'}
};
function errText(e){ const m=MSG[e&&e.code]||MSG.other; return m[lang()]; }
function fatal(e){ if(e&&(e.code==='not_granted'||e.code==='sampling_disabled'||e.code==='not_declared'||e.code==='capability_disabled')){ mode=null; return true; } return false; }

/* ---------- tale ut ---------- */
let voice=null;
function pickVoice(){ try{ const vs=speechSynthesis.getVoices(); voice=vs.find(v=>/en-GB/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null; }catch(e){} }
try{ pickVoice(); speechSynthesis.onvoiceschanged=pickVoice; }catch(e){}
const DIG={'0':'zero','1':'one','2':'two','3':'tree','4':'four','5':'fife','6':'six','7':'seven','8':'eight','9':'niner'};
function radioSpeak(t){ // tall leses siffer for siffer, slik ATC gjør
  return String(t).replace(/\bFL\s?(\d{2,3})/g,(m,n)=>'flight level '+n.split('').map(d=>DIG[d]).join(' '))
    .replace(/(\d+)\.(\d+)/g,(m,a,b)=>a.split('').map(d=>DIG[d]).join(' ')+' decimal '+b.split('').map(d=>DIG[d]).join(' '))
    .replace(/\b(\d{1,2})000\b/g,(m,a)=>a.split('').map(d=>DIG[d]).join(' ')+' thousand')
    .replace(/\b(\d)(\d)00\b/g,(m,a,b)=>DIG[a]+' thousand '+DIG[b]+' hundred')
    .replace(/\d/g,d=>' '+DIG[d]+' ').replace(/\s+/g,' ');
}
function speak(t,o){ o=o||{}; return new Promise(res=>{
  if(!('speechSynthesis' in G)){ res(); return; }
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(o.radio===false?t:radioSpeak(t));
    if(o.lang==='no'){ u.lang='nb-NO'; } else { if(voice) u.voice=voice; u.lang='en-GB'; }
    u.rate=o.rate||1.05; u.pitch=o.pitch||0.95; u.onend=u.onerror=()=>res(); speechSynthesis.speak(u); }catch(e){ res(); } }); }
function hush(){ try{ speechSynthesis.cancel(); }catch(e){} }

/* ---------- tale inn ---------- */
const SR=G.SpeechRecognition||G.webkitSpeechRecognition;
/* push-to-talk: hold knappen (eller mellomrom når feltet ikke har fokus). onFinal(text) kalles når du slipper. */
function ptt(btn,ta,onFinal,o){ o=o||{};
  if(!SR){ btn.disabled=true; btn.title=lang()==='no'?'Taleinndata krever Chrome eller Edge':'Speech input needs Chrome or Edge'; return {supported:false}; }
  let rec=null, active=false, base='', fin='';
  const start=()=>{ if(active) return; hush(); active=true; btn.classList.add('on'); base=o.append?(ta.value?ta.value.trim()+' ':''):''; fin='';
    rec=new SR(); rec.lang=o.lang||'en-GB'; rec.interimResults=true; rec.continuous=true;
    rec.onresult=e=>{ let interim=''; for(let i=e.resultIndex;i<e.results.length;i++){ const r=e.results[i]; if(r.isFinal) fin+=r[0].transcript+' '; else interim+=r[0].transcript; } ta.value=(base+fin+interim).replace(/\s+/g,' ').trim(); };
    rec.onerror=e=>{ o.onError&&o.onError(e.error); };
    rec.onend=()=>{ const was=active; active=false; btn.classList.remove('on'); if(was!==null&&o.auto!==false&&ta.value.trim()&&!o.toggle) onFinal&&onFinal(ta.value.trim()); };
    try{ rec.start(); }catch(e){ active=false; btn.classList.remove('on'); } };
  const stop=()=>{ if(!active||!rec) return; try{ rec.stop(); }catch(e){} };
  if(o.toggle){ btn.addEventListener('click',()=>{ if(active){ active=false; try{ rec.stop(); }catch(e){} btn.classList.remove('on'); } else start(); }); }
  else {
    btn.addEventListener('pointerdown',e=>{ e.preventDefault(); start(); }); btn.addEventListener('pointerup',stop); btn.addEventListener('pointerleave',stop); btn.addEventListener('pointercancel',stop);
    if(o.space!==false) G.addEventListener('keydown',e=>{ if(e.code==='Space'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)&&btn.offsetParent){ e.preventDefault(); start(); } });
    if(o.space!==false) G.addEventListener('keyup',e=>{ if(e.code==='Space'&&active){ e.preventDefault(); stop(); } });
  }
  return {supported:true,stop};
}

const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

G.NAI={ ready, get mode(){ return mode; }, text, json, errText, fatal, speak, hush, ptt, sr:!!SR, lang, langName, esc, radioSpeak };
})(window);
