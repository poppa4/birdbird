import fs from 'fs';
const U=fs.readFileSync('urls.txt','utf8').split('\n').filter(Boolean);
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function one(tag,url,filt){ const ac=new AbortController(); const tm=setTimeout(()=>ac.abort(),25000);
  try{ const r=await fetch(url,{redirect:'follow',headers:{'user-agent':UA},signal:ac.signal}); const t=await r.text(); clearTimeout(tm);
    console.log(`\n=== ${tag} ${r.status} ${url} -> ${r.url} len=${t.length} ct=${r.headers.get('content-type')}`);
    const hrefs=[...new Set([...t.matchAll(/(?:href|src|action)\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]))].filter(h=>!/\.(css|png|jpg|svg|ico|woff2?|gif|js)(\?|$)/i.test(h));
    const f=filt?hrefs.filter(h=>new RegExp(filt,'i').test(h)):hrefs; console.log(f.slice(0,60).join('\n'));
    if(t.length<3000) console.log('--BODY:',t.replace(/\s+/g,' ').slice(0,1500));
    const airac=[...new Set([...t.matchAll(/[\w\-\/.%\\ ]{0,40}(?:AIRAC|currently|\d{4}[-_]\d{2}[-_]\d{2})[\w\-\/.%\\]{0,60}/g)].map(m=>m[0].trim()))].slice(0,25); console.log('--airac-like:',airac.join(' | '));
  }catch(e){ clearTimeout(tm); console.log(`\n=== ${tag} ERR ${url} ${e.name} ${e.message} ${e.cause&&e.cause.code}`); } }
for(const line of U){ const [tag,url,filt]=line.split(' '); await one(tag,url,filt); }
clearInterval(keep);
