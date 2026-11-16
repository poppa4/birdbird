const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u){ const r=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(25000)}); return {r,t:await r.text()}; }
const J=s=>JSON.stringify(s);
const hrefs=t=>[...new Set([...t.matchAll(/(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)].map(m=>m[1]))];
for (const u of ['https://www.kans-ks.org/eAIP/AIRAC%20AMDT%2011-2026_2026_10_29/index.html','https://www.kans-ks.org/eAIP/AIRAC%20AMDT%2011-2026_2026_10_29/eAIP/menu.html','https://www.kans-ks.org/eAIP/AIRAC%20AMDT%2011-2026_2026_10_29/toc-frameset.html',
 'https://armats.am/wp-content/uploads/html-uploads/03-26-29OCT2026/','https://armats.am/wp-content/uploads/html-uploads/03-26-29OCT2026/index.html']) { try{ const {r,t}=await get(u); const h=hrefs(t); console.log('DBG',r.status,u,t.length,J(h.filter(x=>/AD|BKPR|UDYZ|menu|toc|eAIP/i.test(x)).slice(0,25))); if(t.length<3000) console.log('DBG T',J(t.replace(/\s+/g,' ').slice(0,1500))); }catch(e){ console.log('DBG ERR',u,e.message);} }
clearInterval(keep);
