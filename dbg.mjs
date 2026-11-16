const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u,o={}){ const r=await fetch(u,Object.assign({headers:{'user-agent':UA,accept:'application/json, text/html, */*'},signal:AbortSignal.timeout(40000)},o)); return {r,t:await r.text()}; }
function anchors(t){ return [...t.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)].map(m=>[m[1],m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()]); }
const J=s=>JSON.stringify(s);
for (const u of ['https://aim.naviair.dk/umbraco/api/naviairapi/getsearch?criterion=EKCH&skip=0&take=20','https://aim.naviair.dk/umbraco/api/naviairapi/getnodesforparent?parentId=0','https://aim.naviair.dk/umbraco/api/naviairapi/getnodesforparent']) { try{ const x=await get(u); console.log('DBG EK',u,x.r.status,J(x.t.slice(0,2500))); }catch(e){ console.log('DBG EK ERR',e.message);} }
const ek=await get('https://aim.naviair.dk/'); console.log('DBG EKHOME',J(ek.t.replace(/\s+/g,' ').slice(2000,7000)));
const ro=await get('https://www.aisro.ro/aip/2026-10-29/html/en/aip_frames.html'); console.log('DBG ROF',J(ro.t.slice(0,1500)));
const lq=await get('https://eaip.bhansa.gov.ba/updates.json'); console.log('DBG LQU',lq.r.status,J(lq.t.slice(0,800)));
for (const u of ['https://eaip.bhansa.gov.ba/2026-10-29-AIRAC/html/eAIP/LQ-AD-2.LQSA-en-GB.html','https://eaip.bhansa.gov.ba/2026-10-29-AIRAC/html/index.html']) { const x=await get(u); console.log('DBG LQT',u,x.r.status,x.t.length); }
// DFS VFR
const V=await get('https://aip.dfs.de/BasicVFR/'); const vb=V.r.url.replace(/[^/]*$/,'');
const adl=anchors(V.t).find(a=>/^AD\b/.test(a[1])); const A=await get(new URL(adl[0],vb).href); const k1=anchors(A.t).filter(a=>/^[0-9a-f]{32}\.html$/.test(a[0])&&/raquo/.test(a[1])); console.log('DBG V1',k1.length,J(k1.slice(0,15)));
if(k1[0]){ const B=await get(new URL(k1[0][0],vb).href); const k2=anchors(B.t).filter(a=>/^[0-9a-f]{32}\.html$/.test(a[0])&&/raquo/.test(a[1])); console.log('DBG V2',k2.length,J(k2.slice(0,10)), J(anchors(B.t).filter(a=>/pages\//.test(a[0])).slice(0,10)), B.t.match(/myPermalink = "[^"]+"/)?.[0]);
 if(k2[0]){ const C=await get(new URL(k2[0][0],vb).href); const k3=anchors(C.t).filter(a=>/^[0-9a-f]{32}\.html$/.test(a[0])&&/raquo/.test(a[1])); console.log('DBG V3',C.t.length,k3.length,J(k3.slice(0,10)),C.t.match(/myPermalink = "[^"]+"/)?.[0], J((C.t.match(/\bED[A-Z]{2}\b/g)||[]).slice(0,10)), J(anchors(C.t).slice(0,30))); } }
clearInterval(keep);
