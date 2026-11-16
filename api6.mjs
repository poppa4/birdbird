const keep=setInterval(()=>{},1000);
for (const u of ['https://birdbird.eu/api/me','https://birdbird.eu/api/atc','https://birdbird.eu/api/sync']) { try{ const r=await fetch(u,{signal:AbortSignal.timeout(30000)}); console.log('API',r.status,u,(await r.text()).slice(0,200)); }catch(e){ console.log('API ERR',u,e.message);} }
clearInterval(keep);
