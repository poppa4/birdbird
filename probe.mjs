const U=process.argv.slice(2).length?process.argv.slice(2):(await import('fs')).readFileSync('urls.txt','utf8').split('\n').filter(Boolean);
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
for(const line of U){ const [tag,url]=line.split(' ');
  try{ const r=await fetch(url,{redirect:'follow',headers:{'user-agent':UA},signal:AbortSignal.timeout(25000)}); const t=await r.text();
    console.log(`\n=== ${tag} ${r.status} ${url} -> ${r.url} len=${t.length}`);
    const hrefs=[...t.matchAll(/(?:href|src|action|location(?:\.href)?\s*=|url=)\s*=?\s*["']([^"']+)["']/gi)].map(m=>m[1]).filter(h=>!/\.(css|png|jpg|svg|ico|woff2?|gif)(\?|$)/i.test(h));
    const uniq=[...new Set(hrefs)]; console.log(uniq.slice(0,80).join('\n'));
    const airac=[...new Set([...t.matchAll(/[\w\-\/.%]*(?:AIRAC|eAIP|eaip|\d{4}-\d{2}-\d{2})[\w\-\/.%]*/g)].map(m=>m[0]))].slice(0,40); console.log('--airac-like:',airac.join(' | '));
  }catch(e){ console.log(`\n=== ${tag} ERR ${url} ${e.name} ${e.message} ${e.cause&&e.cause.code}`); } }
