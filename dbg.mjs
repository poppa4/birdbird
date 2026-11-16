const UA='Mozilla/5.0 (compatible; Birdbird/1.0; +https://birdbird.eu)';
const keep=setInterval(()=>{},1000);
for (const [u,k] of [['https://eaip.avians.is/A_10-2026_2026_10_29/eAIP/menu.html','BIRK'],['https://eaip.austrocontrol.at/lo/261030/ad.htm','LOWW'],['https://ops.skeyes.be/html/belgocontrol_static/eaip/eAIP_Main/html/eAIP/EB-menu-en-GB.html','EBBR']]){
 const r=await fetch(u,{headers:{'user-agent':UA},signal:AbortSignal.timeout(40000)}); const t=await r.text(); console.log('DBG',r.status,u,t.length);
 let i=0, n=0; while((i=t.indexOf(k,i+1))>0 && n<8){ console.log('DBG  ',JSON.stringify(t.slice(Math.max(0,i-200),i+120))); n++; i+=500; } }
clearInterval(keep);
