// resolves one sample aerodrome per state, live
import { resolve, STATES } from './functions/_lib/aipres.js';
const S={EN:['ENTO','ENGM','ENZV'],ES:['ESSA','ESGG'],EF:['EFHK'],BI:['BIRK','BIKF'],EG:['EGLL','EGKK'],EB:['EBBR'],EL:['ELLX'],EP:['EPWA'],EE:['EETN'],EV:['EVRA'],LH:['LHBP'],LP:['LPPT'],LZ:['LZIB'],LK:['LKPR'],LO:['LOWW'],LE:['LEMD'],GC:['GCLP']};
const fetchT=(u,o)=>fetch(u,Object.assign({signal:AbortSignal.timeout(40000)},o));
const keep=setInterval(()=>{},1000);
for(const [p,list] of Object.entries(S)) for(const i of list){ const t=Date.now(); const r=await resolve(i,{fetch:fetchT,cache:null,log:m=>console.log('  log',m)});
  let st=''; if(r.ok){ try{ const x=await fetchT(r.url,{method:'GET',headers:{'user-agent':'Mozilla/5.0'}}); st=x.status+' '+(x.headers.get('content-type')||''); }catch(e){ st='ERR '+e.message; } }
  console.log((r.ok?'OK  ':'--  ')+i+' '+(Date.now()-t)+'ms '+r.kind+' eff='+r.eff+' '+r.url+' -> '+st); }
clearInterval(keep);
