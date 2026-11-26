/* NORDAP on-device speech recognition (Whisper), for the radio trainer.
   Why: the browser's own recogniser (Web Speech API) sends audio to the browser maker, is missing in Firefox, and
   often merges repeated words ("November November"). Whisper runs in the browser with transformers.js: the audio
   never leaves the device, and it is far better at ICAO words and digits.
   Cost: the model (about 80 MB) and runtime are downloaded once from the jsDelivr and Hugging Face CDNs and kept in
   the browser cache. Nothing runs or downloads until the user picks it in the settings.
   API: NWHISPER.supported, .ready, .load(onProgress) -> Promise, .start() -> Promise, .stop() -> Promise<text>, .cancel() */
(function(G){
'use strict';
const LIB='https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/transformers.min.js';
const MODEL='onnx-community/whisper-base.en';
const supported=!!(G.navigator&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&G.MediaRecorder&&(G.AudioContext||G.webkitAudioContext));
let asr=null, loading=null, rec=null, stream=null, chunks=[], startedAt=0;

async function load(onProgress){
  if(asr) return asr; if(loading) return loading;
  loading=(async()=>{
    const T=await import(LIB);
    T.env.allowLocalModels=false;
    const files={}; const prog=p=>{ if(!onProgress||!p||!p.file) return; if(p.status==='progress'){ files[p.file]=[p.loaded||0,p.total||0]; }
      else if(p.status==='done'&&files[p.file]) files[p.file][0]=files[p.file][1];
      let a=0,b=0; for(const k in files){ a+=files[k][0]; b+=files[k][1]; } if(b) onProgress(Math.min(1,a/b)); };
    const gpu=!!(navigator.gpu&&await navigator.gpu.requestAdapter().catch(()=>null));
    try{
      asr= gpu? await T.pipeline('automatic-speech-recognition',MODEL,{device:'webgpu',dtype:{encoder_model:'fp32',decoder_model_merged:'q4'},progress_callback:prog})
               : await T.pipeline('automatic-speech-recognition',MODEL,{device:'wasm',dtype:'q8',progress_callback:prog});
    }catch(e){ if(!gpu) throw e; asr=await T.pipeline('automatic-speech-recognition',MODEL,{device:'wasm',dtype:'q8',progress_callback:prog}); }
    return asr;
  })();
  try{ return await loading; }catch(e){ loading=null; throw e; }
}

/* the microphone stays open for the whole session, so recording starts the instant the button is pressed:
   reopening it for every call cost a few hundred ms and the first word ("Lima" became "lia"). close() ends it. */
async function start(){
  if(rec) return;
  if(!stream||!stream.active) stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  chunks=[]; rec=new MediaRecorder(stream); rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
  rec.start(); startedAt=Date.now();
}
function close(){ if(stream) stream.getTracks().forEach(t=>t.stop()); stream=null; }
function release(){ rec=null; }
function cancel(){ try{ if(rec&&rec.state!=='inactive') rec.stop(); }catch(e){} release(); chunks=[]; }

/* decode whatever the browser recorded (webm/opus, mp4/aac) and resample to 16 kHz mono, which Whisper expects */
async function toPcm16k(blob){
  const AC=G.AudioContext||G.webkitAudioContext; const ac=new AC();
  try{
    const buf=await ac.decodeAudioData(await blob.arrayBuffer());
    const len=Math.max(1,Math.ceil(buf.duration*16000));
    const off=new OfflineAudioContext(1,len,16000); const src=off.createBufferSource(); src.buffer=buf; src.connect(off.destination); src.start();
    const out=await off.startRendering(); return out.getChannelData(0);
  } finally { try{ ac.close(); }catch(e){} }
}

/* prompt: words the pilot is likely to use here (callsign spelled out, station names, standard words). Whisper
   takes it as the text that came before, which steers it to "Lima Alfa Echo" instead of "lia malcom". No numbers go
   in the prompt, so a wrong number in a readback is still heard as said. */
async function stop(prompt){
  if(!rec) return '';
  const r=rec, held=Date.now()-startedAt;
  await new Promise(res=>setTimeout(res,250)); // the last word is often still being spoken as the button is released
  const done=new Promise(res=>{ r.onstop=res; });
  try{ r.stop(); }catch(e){} await done; const type=r.mimeType; release();
  if(held<300||!chunks.length) return '';
  const pcm=await toPcm16k(new Blob(chunks,{type})); chunks=[];
  return transcribe(pcm,prompt);
}
async function transcribe(pcm,prompt){
  const m=await load();
  if(prompt&&m.model&&m.tokenizer&&m.processor){ try{
    const tk=m.tokenizer, id=t=>tk.model.tokens_to_ids.get(t);
    const sop=id('<|startofprev|>'), sot=id('<|startoftranscript|>'), nt=id('<|notimestamps|>');
    if(sop!=null&&sot!=null&&nt!=null){
      const p=tk.encode(' '+String(prompt).replace(/\s+/g,' ').trim(),{add_special_tokens:false}).slice(-150);
      const ids=[sop,...p,sot,nt];
      const feats=(await m.processor(pcm)).input_features;
      const out=await m.model.generate({inputs:feats,decoder_input_ids:ids,max_new_tokens:110});
      const seq=(out.sequences||out)[0].tolist().map(Number);
      const t=clean(tk.decode(seq.slice(seq.lastIndexOf(nt)+1),{skip_special_tokens:true}));
      /* a prompted Whisper can repeat the prompt on near-silence: more words than anyone says in that time means it did */
      const words=t?t.split(' ').length:0, secs=pcm.length/16000;
      if(t&&words<=secs*4.5+3) return t;
    } }catch(e){ /* fall through to the plain transcription */ } }
  const out=await m(pcm,{chunk_length_s:30});
  return clean(out&&out.text||'');
}
/* Whisper writes punctuation and sometimes a bracketed noise tag ("[BLANK_AUDIO]", "(static)") */
function clean(t){ t=String(t).replace(/\[[^\]]*\]|\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
  /* what Whisper says for silence or a click of the button */
  return /^(you|thank you|thanks for watching|bye)[.!]?$/i.test(t)? '' : t; }

G.NWHISPER={supported, get ready(){ return !!asr; }, load, start, stop, cancel, close, clean, toPcm16k, transcribe, MODEL};
})(typeof window!=='undefined'?window:globalThis);
