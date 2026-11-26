/* NORDAP natural controller voice (Kokoro-82M, on the device), for the radio trainer.
   The browser's built-in voices sound like a computer. Kokoro is a small neural voice model that runs in the
   browser with kokoro-js: free to run, nothing is sent anywhere. About 90 MB is downloaded once from the jsDelivr
   and Hugging Face CDNs and kept in the browser cache. Each controller unit has its own voice, so Tower, Ground and
   Approach sound like different people, and the audio goes through a VHF radio filter.
   API: NVOICE.supported, .ready, .load(onProgress) -> Promise, .say(ctx, parts, o) -> {done:Promise, stop()} */
(function(G){
'use strict';
const LIB='https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';
const supported=typeof WebAssembly==='object'&&!!(G.AudioContext||G.webkitAudioContext);
let tts=null, loading=null;

async function load(onProgress){
  if(tts) return tts; if(loading) return loading;
  loading=(async()=>{
    const K=await import(LIB);
    const files={}; const prog=p=>{ if(!onProgress||!p||!p.file) return; if(p.status==='progress') files[p.file]=[p.loaded||0,p.total||0];
      else if(p.status==='done'&&files[p.file]) files[p.file][0]=files[p.file][1];
      let a=0,b=0; for(const k in files){ a+=files[k][0]; b+=files[k][1]; } if(b) onProgress(Math.min(1,a/b)); };
    const gpu=!!(navigator.gpu&&await navigator.gpu.requestAdapter().catch(()=>null));
    try{ tts= gpu? await K.KokoroTTS.from_pretrained(MODEL,{dtype:'fp32',device:'webgpu',progress_callback:prog})
                 : await K.KokoroTTS.from_pretrained(MODEL,{dtype:'q8',device:'wasm',progress_callback:prog}); }
    catch(e){ if(!gpu) throw e; tts=await K.KokoroTTS.from_pretrained(MODEL,{dtype:'q8',device:'wasm',progress_callback:prog}); }
    return tts;
  })();
  try{ return await loading; }catch(e){ loading=null; throw e; }
}

/* one voice per unit, so the frequencies sound like different controllers. Kokoro's best-graded voices
   (af_heart and af_bella are the most natural; am_michael and am_fenrir the best male ones); the British
   male voices are among the weakest, so they are not used. */
function voiceFor(text,o){
  if(o&&o.atis) return 'bf_emma';
  const t=' '+String(text).toLowerCase()+' ';
  if(/ (ground|delivery|apron) /.test(t)) return 'af_bella';
  if(/ (approach|radar|director|control|centre|center) /.test(t)) return 'am_fenrir';
  if(/ (information|radio|afis|traffic) /.test(t)) return 'af_heart';
  return 'am_michael';
}

/* VHF radio: 300–3000 Hz, a little drive and compression, so it sounds like a headset, not a podcast */
function radioChain(ctx,on){
  const inp=ctx.createGain();
  if(!on){ inp.connect(ctx.destination); return inp; }
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=320; hp.Q.value=0.7;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2900; lp.Q.value=0.8;
  const pk=ctx.createBiquadFilter(); pk.type='peaking'; pk.frequency.value=1700; pk.gain.value=4; pk.Q.value=1;
  const sh=ctx.createWaveShaper(); const n=1024, c=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.tanh(2.2*x)/Math.tanh(2.2); } sh.curve=c;
  const cmp=ctx.createDynamicsCompressor(); cmp.threshold.value=-24; cmp.ratio.value=6; cmp.attack.value=0.003; cmp.release.value=0.15;
  const out=ctx.createGain(); out.gain.value=0.9;
  inp.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(sh); sh.connect(cmp); cmp.connect(out); out.connect(ctx.destination);
  return inp;
}

/* a transmission is spoken in as few pieces as possible (one breath per piece, ~230 characters), so the
   intonation runs across sentences like a real controller's; the next piece is generated while one plays.
   The model's silence before and after each piece is trimmed, leaving only a short natural gap. */
function chunks(parts){ const out=[]; let cur='';
  parts.forEach(p=>{ p=String(p).trim(); if(!p) return; if(cur&&(cur+' '+p).length>230){ out.push(cur); cur=p; } else cur=cur?cur+' '+p:p; });
  if(cur) out.push(cur); return out; }
function trim(a,sr,gap){ const th=0.012; let i=0, j=a.length-1; while(i<a.length&&Math.abs(a[i])<th) i++; while(j>i&&Math.abs(a[j])<th) j--;
  const pre=Math.round(sr*0.02), post=Math.round(sr*gap); i=Math.max(0,i-pre); j=Math.min(a.length-1,j+Math.round(sr*0.04));
  const o=new Float32Array(j-i+1+post); o.set(a.subarray(i,j+1)); return o; }
function say(ctx,parts,o){
  o=o||{}; let stopped=false, src=null;
  const voice=o.voice||voiceFor(parts.join(' '),o), speed=Math.max(0.7,Math.min(1.5,(o.speed||1)*(o.atis?1:1.06)));
  const chain=radioChain(ctx,o.radio!==false);
  const P=chunks(parts), gen=P.map(()=>null); const make=i=>gen[i]||(gen[i]=tts.generate(P[i],{voice,speed}));
  const done=(async()=>{
    let t=ctx.currentTime;
    for(let i=0;i<P.length&&!stopped;i++){
      const a=await make(i); if(i+1<P.length) make(i+1); if(stopped) break;
      const pcm=trim(a.audio,a.sampling_rate,i+1<P.length?0.12:0.02);
      const buf=ctx.createBuffer(1,pcm.length,a.sampling_rate); buf.copyToChannel(pcm,0);
      await new Promise(res=>{ src=ctx.createBufferSource(); src.buffer=buf; src.connect(chain); src.onended=res; src.start(Math.max(t,ctx.currentTime)); });
      t=ctx.currentTime;
    }
    try{ chain.disconnect(); }catch(e){}
    return !stopped;
  })();
  return {done, stop(){ stopped=true; try{ src&&src.stop(); }catch(e){} }};
}

G.NVOICE={supported, get ready(){ return !!tts; }, load, say, voiceFor, MODEL};
})(typeof window!=='undefined'?window:globalThis);
