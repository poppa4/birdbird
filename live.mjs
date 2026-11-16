const keep=setInterval(()=>{},1000);
await new Promise(r=>setTimeout(r,60000));
for (const i of ['ENTO','ESSA','BIRK','EBBR','LFPG','EDDF','LOWW','EGLL']) { try{ const r=await fetch('https://birdbird.eu/api/aip?icao='+i,{signal:AbortSignal.timeout(40000)}); console.log('API',i,r.status,(await r.text()).slice(0,260)); }catch(e){ console.log('API',i,'ERR',e.message); } }
clearInterval(keep);
