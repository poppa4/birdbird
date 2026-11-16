const keep=setInterval(()=>{},1000);
for (const u of ['https://birdbird.eu/api/atc','https://birdbird.eu/api/fi','https://birdbird.eu/api/ask','https://birdbird.eu/sitemap.xml','https://birdbird.eu/robots.txt','https://birdbird.eu/404-test-xyz']) { try{ const r=await fetch(u,{signal:AbortSignal.timeout(30000)}); console.log('API',r.status,u,(await r.text()).replace(/\s+/g,' ').slice(0,160)); }catch(e){ console.log('API ERR',u,e.message);} }
clearInterval(keep);
