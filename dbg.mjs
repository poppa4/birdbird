const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u){ const r=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(40000)}); return {r,t:await r.text()}; }
for (const u of ['https://eaip.bhansa.gov.ba/2026-10-01-AIRAC/html/eAIP/LQ-AD-2.LQSA-en-GB.html','https://www.aisro.ro/aip/2026-10-29/html/en/aip_toc_gen.html']) { const x=await get(u); console.log('DBG',u,x.r.status,x.t.length, JSON.stringify([...x.t.matchAll(/href=["']([^"']+)["']/g)].map(m=>m[1]).filter(h=>/ad|LROP/i.test(h)).slice(0,30))); }
clearInterval(keep);
