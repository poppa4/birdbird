import { resolve } from './functions/_lib/aipres.js';
const L=['EKCH','EKBI','EKRK','EKVG','BGSF','EDDF','EDFE','EDMA','ETNL','EDKB','LOWW','LOAG','LOWI','LJLJ','LJMB','LYBE','LYPG','LATI','LQSA','LQMO','ENTO','EGLL','EFHK','LFPG','LEMD'];
const tf=(u,o)=>fetch(u,Object.assign({signal:AbortSignal.timeout(40000)},o));
const keep=setInterval(()=>{},1000);
for(const i of L){ const t=Date.now(); const r=await resolve(i,{fetch:tf,cache:null,log:m=>console.log('  log',m)});
  let st=''; if(r.ok){ try{ const x=await tf(r.url,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) Chrome/124'}}); const tx=await x.text(); st=x.status+' '+(x.headers.get('content-type')||'')+' '+(tx.match(/url=([^"]+)"/)?.[1]||''); }catch(e){ st='ERR '+e.message; } }
  console.log((r.ok?'OK  ':'--  ')+i+' '+(Date.now()-t)+'ms '+r.kind+' eff='+r.eff+' '+r.url+' -> '+st); }
clearInterval(keep);
