import { resolve } from './functions/_lib/aipres.js';
const L=process.argv.slice(2);
const tf=(u,o)=>fetch(u,Object.assign({signal:AbortSignal.timeout(40000)},o));
const keep=setInterval(()=>{},1000);
for(const i of L){ const r=await resolve(i,{fetch:tf,cache:null,log:m=>console.log('  log',m)});
  let st=''; try{ const x=await tf(r.url,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) Chrome/124'}}); st=x.status+' '+(x.headers.get('content-type')||''); }catch(e){ st='ERR '+e.message; }
  console.log((r.ok?'OK  ':'--  ')+i+' '+r.kind+' eff='+r.eff+' '+r.url+' -> '+st+(r.why?' WHY '+r.why:'')); }
clearInterval(keep);
