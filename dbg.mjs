const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const keep=setInterval(()=>{},1000);
async function get(u,o={}){ const r=await fetch(u,Object.assign({headers:{'user-agent':UA},signal:AbortSignal.timeout(40000)},o)); return {r,t:await r.text()}; }
function anchors(t){ return [...t.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)].map(m=>[m[1],m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()]); }
const J=s=>JSON.stringify(s);
// DFS IFR crawl: AD 2 + MIL-AD 2
async function dfs(kind, rootHash){
  const root=`https://aip.dfs.de/${kind}/`; const r0=await get(root); const base=r0.r.url.replace(/[^/]*$/,''); console.log('DBG DFS',kind,r0.r.url);
  const lvl1=anchors(r0.t); console.log('DBG L1',J(lvl1.slice(0,12)));
  const out={};
  async function walk(url,depth,path){ if(depth>4) return; const p=await get(url); const perm=(p.t.match(/myPermalink = "pages\/(C[0-9A-F]+)\.html"/)||[])[1];
    const kids=anchors(p.t).filter(a=>/^[0-9a-f]{32}\.html$/.test(a[0])&&/&raquo;|»/.test(a[1]+'»'));
    const body=p.t.slice(p.t.indexOf('<body'));
    const ids=[...new Set((body.slice(0,200000).match(/\b(E[DT][A-Z]{2})\b/g)||[]))];
    return {perm,kids,ids,len:p.t.length}; }
  return {base,walk,lvl1};
}
const I=await dfs('BasicIFR'); const ad=I.lvl1.find(a=>/^AD\b/.test(a[1])); console.log('DBG ad',J(ad));
const adp=await get(new URL(ad[0],I.base).href); const subs=anchors(adp.t).filter(a=>/^(MIL-)?AD 2\b/.test(a[1])); console.log('DBG subs',J(subs));
const map={};
for(const s of subs){ const lp=await get(new URL(s[0],I.base).href); const airports=anchors(lp.t).filter(a=>/^[0-9a-f]{32}\.html$/.test(a[0])&&!/^(AIP|AD|AD 2|MIL-AD 2)$/.test(a[1]));
  console.log('DBG n',s[1],airports.length);
  for(const a of airports){ try{ const pg=await get(new URL(a[0],I.base).href); const perm=(pg.t.match(/myPermalink = "pages\/(C[0-9A-F]+)\.html"/)||[])[1]; const b=pg.t.slice(pg.t.indexOf('<body')); const cand=(b.match(/\b(E[DT][A-Z]{2})\b/g)||[]); const cnt={}; cand.slice(0,3000).forEach(c=>cnt[c]=(cnt[c]||0)+1); const top=Object.entries(cnt).sort((x,y)=>y[1]-x[1]).slice(0,3);
    console.log('DBG AP',a[1].slice(0,40),perm,J(top)); }catch(e){ console.log('DBG AP ERR',a[1],e.message); } } }
const V=await get('https://aip.dfs.de/BasicVFR/'); console.log('DBG VFR',V.r.url, J(anchors(V.t).slice(0,15)));
const a=await get('https://aim.naviair.dk/js/app.min.js'); console.log('DBG EKAPP',J(a.t.slice(0,4600)));
const ro=await get('https://www.aisro.ro/aip/2026-10-29/html/en/toc.html'); console.log('DBG ROTOC',J(ro.t.slice(0,2800)));
const lq=await get('https://eaip.bhansa.gov.ba/script.js'); console.log('DBG LQJS',J(lq.t.slice(0,2500)));
clearInterval(keep);
