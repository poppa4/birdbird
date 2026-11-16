const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u,o={}){ const r=await fetch(u,Object.assign({headers:{'user-agent':UA},signal:AbortSignal.timeout(25000)},o)); return {r,t:await r.text()}; }
function anchors(t){ return [...t.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)].map(m=>[m[1],m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()]); }
const base='https://aip.dfs.de/BasicIFR/2026OCT29/chapter/';
let x=await get(base+'eef52a76059e9d3d2b94ece22c513aa6.html'); console.log('DBG FRA',x.t.length, x.t.match(/myPermalink = "[^"]+"/)?.[0]); anchors(x.t).slice(0,25).forEach(a=>console.log('DBG   '+a.join(' :: ').slice(0,200)));
let y=await get(base+'6b25793de854caaf804cf4fcea40f577.html'); console.log('DBG AD2perm', y.t.match(/myPermalink = "[^"]+"/)?.[0]);
for (const u of ['https://aip.dfs.de/BasicIFR/pages/C00001.html','https://aip.dfs.de/basicIFR/pages/C00001.html','https://aip.dfs.de/BasicIFR/'+(x.t.match(/myPermalink = "([^"]+)"/)||[])[1]]) { try{ const z=await get(u,{redirect:'manual'}); console.log('DBG PERM',u,z.r.status,z.r.headers.get('location'),z.t.length,z.t.slice(0,300).replace(/\s+/g,' ')); }catch(e){console.log('DBG PERM ERR',u,e.message);} }
const a=await get('https://aim.naviair.dk/js/app.min.js'); console.log('DBG EKAPP',a.t.slice(0,4600));
const ro=await get('https://www.aisro.ro/aip/2026-10-29/html/en/toc.html'); console.log('DBG ROTOC',ro.t.length); anchors(ro.t).filter(a=>/AD|LROP/i.test(a.join(' '))).slice(0,30).forEach(a=>console.log('DBG   '+a.join(' :: ').slice(0,200)));
const lq=await get('https://eaip.bhansa.gov.ba/'); console.log('DBG LQ0',lq.t.replace(/\s+/g,' ').slice(0,1000)); console.log('DBG LQS',[...lq.t.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[0].slice(0,600)).join(' || '));
clearInterval(keep);
