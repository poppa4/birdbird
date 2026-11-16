const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
const L=[['EKc','https://aim.naviair.dk/charts/','a'],['LQ','https://eaip.bhansa.gov.ba/','a'],['LR','https://www.aisro.ro/aip/2026-10-29/index.html','a'],['LD','http://aim.crocontrol.hr/','a'],
['ED','https://aip.dfs.de/BasicIFR/2026OCT29/chapter/7ff963e82459855d134478ddd7ee41db.html','a'],['UKp','https://www.aisukraine.net/publications/eng/publ(eng).htm','a'],['EKda','https://aim.naviair.dk/da/','a'],['EH','https://www.lvnl.nl/diensten/aip','a']];
for (const [tag,u] of L){ try{ const r=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(25000)}); const t=await r.text(); console.log('DBG ===',tag,r.status,r.url,t.length);
 const as=[...t.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)].map(m=>m[1]+' :: '+m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).filter(x=>!/facebook|twitter|linkedin|instagram|youtube/i.test(x));
 console.log(as.slice(0,70).map(x=>'DBG   '+x.slice(0,200)).join('\n'));
 const fr=[...t.matchAll(/<(?:frame|iframe)[^>]*src=["']([^"']+)/gi)].map(m=>m[1]); if(fr.length) console.log('DBG  frames',fr.join(' | '));
 }catch(e){ console.log('DBG ===',tag,'ERR',e.message); } }
clearInterval(keep);
