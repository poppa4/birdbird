/* Birdbird – simulatorens terreng (simterrain.js). Ikke forveksle med terrain.js, som er Europa-terrenget i ruteprofilen.
   Terreng for regionen rundt Birdbird. Deterministisk høydefelt (meter) i lokale koordinater (N, E).
   Brukes av 3D-utsikten, kartet og bakkekollisjon. Fjord og hav i vest, åser i øst og nord, flatt rundt flyplassen og under finalen. */
(function(G){
'use strict';
function hash(x,y){ let h=(x*374761393+y*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; }
function vnoise(x,y){ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi; const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  const a=hash(xi,yi), b=hash(xi+1,yi), c=hash(xi,yi+1), d=hash(xi+1,yi+1); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
function fbm(x,y){ let s=0,a=0.5,f=1; for(let i=0;i<5;i++){ s+=a*vnoise(x*f,y*f); a*=0.5; f*=2.03; } return s; }
const ss=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
const cache=new Map();
function height(N,E){
  const k=(Math.round(N/50))+','+(Math.round(E/50));
  const c=cache.get(k); if(c!==undefined) return c;
  const x=E/9000, y=N/9000;
  let h=fbm(x+11.3,y-7.1); h=Math.max(0,h-0.38)*1.9; // 0..~1
  let m=h*520;
  // høyere fjell i nordøst
  m*=0.7+0.9*ss(-20000,40000,N+E*0.6);
  // fjord/hav i vest
  const coast=-26000+fbm(y*0.7,3.3)*9000;
  const sea=ss(coast+3000,coast-1500,E);
  m=m*(1-sea)-sea*3;
  // flatt rundt flyplassen og under finalen (RWY 36)
  const dA=Math.hypot(N-750,E);
  m*=ss(2200,6500,dA);
  const corr=Math.abs(E)<2500 && N<0 && N>-30000 ? 1-ss(-30000,-26000,N) : 0;
  const corrW=ss(1500,3800,Math.abs(E));
  if(N<0&&N>-34000) m*=Math.max(corrW, 1-0.85*(1-ss(-34000,-28000,N)));
  // finalkorridor skal holde seg godt under 3°-banen
  if(N<0&&Math.abs(E)<3800){ const lim=(-N)*Math.tan(3*Math.PI/180)*0.45; if(m>lim) m=lim+(m-lim)*corrW; }
  cache.set(k,m); if(cache.size>200000) cache.clear();
  return m;
}
function color(m){ // topografiske farger (r,g,b 0..255)
  if(m<-1) return [34,78,128];
  if(m<15) return [62,104,52];
  if(m<80) return [74,118,58];
  if(m<180) return [96,124,64];
  if(m<280) return [126,128,78];
  if(m<380) return [138,118,82];
  return [150,140,128];
}
/* forhåndstegnede topografiske bilder til kartet: fint nær, grovt langt ut */
const IM={}; const R=90000, PX=600;
function mapImage(R,PX){ R=R||90000; PX=PX||600; const key=R+'_'+PX;
  if(IM[key]) return IM[key]; if(typeof document==='undefined') return null;
  const c=document.createElement('canvas'); c.width=c.height=PX; const g=c.getContext('2d'); const id=g.createImageData(PX,PX);
  for(let j=0;j<PX;j++) for(let i=0;i<PX;i++){ const E=-R+(i+0.5)/PX*2*R, N=R-(j+0.5)/PX*2*R; const m=height(N,E); let [r,gg,b]=color(m);
    // skyggelegging
    const dx=height(N,E+300)-m, sh=Math.max(-25,Math.min(25,-dx*0.25)); if(m>-1){ r+=sh; gg+=sh; b+=sh; }
    const o=(j*PX+i)*4; id.data[o]=r*0.55; id.data[o+1]=gg*0.55; id.data[o+2]=b*0.55; id.data[o+3]=255; }
  g.putImageData(id,0,0); IM[key]={canvas:c,R,PX}; return IM[key];
}
function mapImages(){ return [mapImage(25000,600),mapImage(90000,600)].filter(Boolean); }
G.TERRAIN={height,color,mapImage,mapImages,R};
})(window);
