const keep=setInterval(()=>{},1000);
await new Promise(r=>setTimeout(r,150000));
for (const u of ['https://birdbird.eu/api/clouds?tile=55,10','https://birdbird.eu/cloudcol.js?v=1','https://birdbird.eu/route.html']) { try{ const t=Date.now(); const r=await fetch(u,{signal:AbortSignal.timeout(60000)}); const x=await r.text(); console.log('API',r.status,Date.now()-t+'ms',u,x.length, u.includes('clouds?')?x.slice(0,300):(x.includes('Clouds here')?'has Clouds here':'NO Clouds here')); }catch(e){ console.log('API ERR',u,e.message);} }
clearInterval(keep);
