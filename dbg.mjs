const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u,o={}){ const r=await fetch(u,Object.assign({headers:{'user-agent':UA},signal:AbortSignal.timeout(25000)},o)); return {r,t:await r.text()}; }
const J=s=>JSON.stringify(s);
const hrefs=t=>[...new Set([...t.matchAll(/(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)].map(m=>m[1]))];
for (const [tag,u] of [['BK','https://www.kans-ks.org/eAIP/default.html'],['UD','https://armats.am/category/eaip/']]) { try{ const {r,t}=await get(u); console.log('DBG ===',tag,r.status,r.url,t.length,J(hrefs(t).filter(x=>/aip|airac|\d{4}/i.test(x)).slice(0,30))); if(t.length<5000) console.log('DBG T',J(t.replace(/\s+/g,' ').slice(0,2500))); }catch(e){ console.log('DBG',tag,'ERR',e.message);} }
for (const [tag,home] of [['LD','https://aim.crocontrol.hr/'],['LB','https://b-flip.bulatsa.com/']]) { try{ const {t}=await get(home); const js=[...t.matchAll(/<script[^>]*src=["']([^"']+)/gi)].map(m=>m[1]); console.log('DBG',tag,'JS',J(js));
  for (const s of js.filter(x=>/main|app|chunk/i.test(x))) { const j=await get(new URL(s,home).href); const eps=[...new Set((j.t.match(/["'`][^"'`\s]{0,80}(?:api|\/aip|publication|airac|eaip)[^"'`\s]{0,120}["'`]/gi)||[]))].slice(0,60); console.log('DBG',tag,s,j.t.length,J(eps)); } }catch(e){ console.log('DBG',tag,'ERR',e.message);} }
clearInterval(keep);
