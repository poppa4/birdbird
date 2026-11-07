/* Birdbird – grovt terreng (høyeste punkt per celle, fot).
   Data: terrain/index.json + terrain/t_<lat0>_<lon0>.png (5°×5°, høyde i fot = R·256 + G, rad 0 = nord).
   Hver celle er høyeste terreng i cellen, avrundet opp. Uten hindre. Kun til planlegging. */
(function(G){
'use strict';
let IDX=null; const T={}; const loading={};
const ready=fetch('terrain/index.json').then(r=>r.ok?r.json():null).then(j=>{ IDX=j; return !!(j&&j.tiles&&j.tiles.length); }).catch(()=>false);
const tileOf=(la,lo)=>{ const a=Math.floor(la/5)*5, o=Math.floor(lo/5)*5; return a+'_'+o; };
async function load(keys){ await ready; if(!IDX) return; const have=new Set(IDX.tiles);
  await Promise.all(keys.filter(k=>have.has(k)&&!(k in T)).map(k=>loading[k]||(loading[k]=decode('terrain/t_'+k+'.png').then(a=>{ T[k]=a; }).catch(()=>{ T[k]=null; })))); }
async function decode(url){ const r=await fetch(url); if(!r.ok) return null; const b=await r.blob(); const bm=await createImageBitmap(b,{colorSpaceConversion:'none',premultiplyAlpha:'none'}); const c=document.createElement('canvas'); c.width=bm.width; c.height=bm.height; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(bm,0,0); const d=g.getImageData(0,0,c.width,c.height).data; const out=new Uint16Array(c.width*c.height); for(let i=0;i<out.length;i++) out[i]=(d[i*4]<<8)|d[i*4+1]; return out; }
function get(la,lo){ if(!IDX) return null; const k=tileOf(la,lo); if(!(k in T)){ return IDX.tiles.includes(k)? null : 0; } const a=T[k]; if(!a) return null; const n=IDX.n; const [a0,o0]=k.split('_').map(Number);
  const r=Math.min(n-1,Math.max(0,Math.floor((a0+5-la)/5*n))), c=Math.min(n-1,Math.max(0,Math.floor((lo-o0)/5*n))); return a[r*n+c]; }
function status(){ if(!IDX) return (document.documentElement.lang==='nb')?'Terrengdata er ikke lastet inn ennå. Du kan skrive inn høyeste terreng per etappe selv.':'Terrain data is not loaded yet. You can type the highest terrain per leg yourself.';
  const nb=document.documentElement.lang==='nb'; return (nb?'Terreng: ':'Terrain: ')+(IDX.src||'')+' · '+((nb&&IDX.res_no)||IDX.res||''); }
G.TERRAIN={ready,tileOf,load,get,status,raw:k=>T[k]||null,has:k=>!!(IDX&&IDX.tiles.includes(k)),n:()=>IDX?IDX.n:0};
})(window);
