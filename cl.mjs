import { handleClouds } from './functions/api/clouds.js';
const keep=setInterval(()=>{},1000);
for (const tile of ['55,5','55,10','45,5']) {
  const r = await handleClouds(new Request('https://x/api/clouds?tile='+tile), {}, { cache: null });
  const j = await r.json(); if (!j.ok) { console.log('CL', tile, JSON.stringify(j)); continue; }
  console.log('CL', tile, j.run, j.fh, j.valid, j.nx, j.ny, Object.keys(j).filter(k=>Array.isArray(j[k])).map(k=>k+':'+j[k].filter(v=>v!=null).length).join(' '));
  const i = Math.floor(j.ny/2)*j.nx + Math.floor(j.nx/2); console.log('CL mid', JSON.stringify(Object.fromEntries(['lc','lb','lt','mc','mb','mt','hc','hb','ht','ceil','frz','sfc','cape'].map(k=>[k,j[k]&&j[k][i]]))));
}
clearInterval(keep);
