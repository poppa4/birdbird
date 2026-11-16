const keep=setInterval(()=>{},1000);
await new Promise(r=>setTimeout(r,120000));
for (const i of ['EHAM','EHRD','EDDF','EKCH','LOWW','LJLJ','LYBE','LQSA','LATI','ENTO','EBBR','BIRK']) { try{ const t=Date.now(); const r=await fetch('https://birdbird.eu/api/aip?icao='+i,{signal:AbortSignal.timeout(60000)}); console.log('API',i,r.status,Date.now()-t+'ms',(await r.text()).slice(0,240)); }catch(e){ console.log('API',i,'ERR',e.message); } }
clearInterval(keep);
