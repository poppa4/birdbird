const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u,o={}){ const r=await fetch(u,Object.assign({headers:{'user-agent':UA,accept:'application/json, text/html, */*'},signal:AbortSignal.timeout(25000)},o)); return {r,t:await r.text()}; }
const J=s=>JSON.stringify(s);
for (const u of ['https://aim.crocontrol.hr/rest/file_sharing/api/explorer','https://aim.crocontrol.hr/rest/file_sharing/api/folders','https://aim.crocontrol.hr/rest/file_sharing/api/files','https://aim.crocontrol.hr/rest/file_sharing/api/config']) { try{ const {r,t}=await get(u); console.log('DBG',r.status,u,J(t.slice(0,1200))); }catch(e){ console.log('DBG ERR',u,e.message);} }
{ const {t}=await get('https://b-flip.bulatsa.com/main-D5OUP5XC.js'); const ch=[...new Set(t.match(/chunk-[A-Z0-9]+\.js/g)||[])]; console.log('DBG LB chunks',J(ch));
  for (const c of ch.slice(0,20)) { const x=await get('https://b-flip.bulatsa.com/'+c); const eps=[...new Set((x.t.match(/["'`][^"'`\s]{0,60}(?:api|aip|publication)[^"'`\s]{0,100}["'`]/gi)||[]))].filter(e=>/\//.test(e)).slice(0,25); if(eps.length) console.log('DBG LB',c,J(eps)); } }
{ const {t}=await get('https://www.airnav.ie/air-traffic-management/aeronautical-information-management/aip-package'); const i=t.indexOf('AIP'); console.log('DBG EI', J([...t.matchAll(/(?:href|data-[a-z-]+|src)=["']([^"']*(?:aip|getattachment|iaip|pdf)[^"']*)["']/gi)].map(m=>m[1]).slice(0,30)), J(t.replace(/\s+/g,' ').match(/.{0,200}(?:Integrated|iAIP|eAIP).{0,300}/i)?.[0])); }
clearInterval(keep);
