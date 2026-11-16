const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u){ const r=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(25000)}); return {r,t:await r.text()}; }
const J=s=>JSON.stringify(s);
const hrefs=t=>[...new Set([...t.matchAll(/(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)].map(m=>m[1]))];
const L=[
['RO1','https://www.aisro.ro/aip/2026-10-29/html/en/aip_top_frame.html'],
['RO2','https://www.aisro.ro/aip/2026-10-29/html/en/aip_toc_gen.html'],
['RO3','https://www.aisro.ro/aip/2026-10-29/html/en/aip_toc_ad.html'],
['LD1','https://aim.crocontrol.hr/'],
['LB1','https://b-flip.bulatsa.com/publications/aip/home'],
['EI1','https://www.airnav.ie/air-traffic-management/aeronautical-information-management/aip-package'],
['UG','https://airnav.ge/eaip/'],['UG2','https://www.airnav.ge/en/aip'],
['UD','https://www.armats.am/activities/ais/eaip'],['UD2','https://armats.am/'],
['UB','https://www.azans.az/en/aip'],['BK','https://www.ashna-ks.org/'],
['LM','https://www.maltats.com/aim/'],['LC','https://www.mcw.gov.cy/mcw/dca/dca.nsf/All/'],
['LW','https://www.mnavigation.mk/'],['LW2','https://mnav.mk/'],
['LG','https://aisgr.hasp.gov.gr/'],['EY','https://www.ans.lt/'],['LU','https://www.moldatsa.md/'],
['UM','https://www.ban.by/en/'],['LT','https://www.dhmi.gov.tr/Sayfalar/aipturkey.aspx']];
for (const [tag,u] of L){ try{ const {r,t}=await get(u); console.log('DBG ===',tag,r.status,r.url,t.length);
  const h=hrefs(t).filter(x=>/aip|airac|ead|\/ad|toc|ad_|ad-2|api/i.test(x)).slice(0,40); console.log('DBG   H',J(h));
  if(t.length<4000 || /^(RO|LD1|LB1)/.test(tag)) console.log('DBG   T',J(t.replace(/\s+/g,' ').slice(0,1800)));
 }catch(e){ console.log('DBG ===',tag,'ERR',e.message, e.cause&&e.cause.code); } }
clearInterval(keep);
