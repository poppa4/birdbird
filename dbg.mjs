const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u){ const r=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(25000)}); return {r,t:await r.text()}; }
function anchors(t){ return [...t.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)].map(m=>[m[1],m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()]); }
async function show(tag,u,n=60){ try{ const {r,t}=await get(u); console.log('DBG ===',tag,r.status,r.url,t.length); anchors(t).slice(0,n).forEach(a=>console.log('DBG   '+(a[0]+' :: '+a[1]).slice(0,220))); const fr=[...t.matchAll(/<(?:frame|iframe)[^>]*src=["']([^"']+)/gi)].map(m=>m[1]); if(fr.length) console.log('DBG  frames',fr.join(' | ')); return {r,t}; }catch(e){ console.log('DBG ===',tag,'ERR',e.message); return {t:''}; } }
// DFS crawl
const base='https://aip.dfs.de/BasicIFR/2026OCT29/chapter/';
let {t}=await show('ED1',base+'68c7dcb93e95b26dd5a4ea0e5bfdcd5e.html');
let a=anchors(t).find(x=>/AD 2\b/.test(x[1])); if(a){ ({t}=await show('ED2',new URL(a[0],base).href,40)); let b=anchors(t).find(x=>/EDDF/.test(x[1])); if(b){ ({t}=await show('ED3',new URL(b[0],base).href,40)); } }
await show('UA','https://www.aisukraine.net/_eaip/current/',30);
await show('RO','https://www.aisro.ro/aip/2026-10-29/html/en/index.html',30);
const lq=await get('https://eaip.bhansa.gov.ba/'); console.log('DBG LQRAW',lq.t.replace(/\s+/g,' ').slice(1000,2247));
const ld=await get('https://aim.crocontrol.hr/'); console.log('DBG LDRAW',ld.t.replace(/\s+/g,' ').match(/(eaip|aip)[^"'<]{0,120}/gi)?.slice(0,30).join(' | '));
const ek=await get('https://aim.naviair.dk/'); const js=[...ek.t.matchAll(/<script[^>]*src=["']([^"']+)/gi)].map(m=>m[1]); console.log('DBG EKJS',js.join(' | '));
for(const s of js.filter(x=>!/vendor|jquery|gtag/i.test(x)).slice(0,4)){ const j=await get(new URL(s,'https://aim.naviair.dk/').href); console.log('DBG EKAPI',s,j.t.length,(j.t.match(/["'][^"']*(?:api|umbraco|aip)[^"']*["']/gi)||[]).slice(0,40).join(' | ')); }
clearInterval(keep);
