/* NORDAP – ekte verden for simulatorene (world.js, three.js r128, WebGL2).
   Første område: ENTO Sandefjord Torp. Terreng fra Kartverket (Nasjonal detaljert høydemodell, CC BY 4.0),
   utenfor Norge Mapzen Terrain Tiles. Rullebane, lys og PAPI fra AIP Norge AD 2 ENTO.
   Lokalt koordinatsystem: origo = THR 35, E = øst, N = nord (sann), høyder i meter over havet.
   three.js-verden: x = E, y = opp, z = −N (samme som otw.js).

   Ytelse: terrenget er ett instansiert rutenett (CDLOD, ett draw call) som henter høyder fra teksturer i
   vertex-shaderen, så CPU-en gjør nesten ingenting per bilde. Rullebanemerking og taksebaner tegnes i
   terreng-shaderen (avstandsfelt), så de er skarpe på alle avstander uten egen geometri. Ingen sanntidsskygger.

   API:  WORLD.load(base) -> Promise · WORLD.attach(scene) · WORLD.update(camera, dt) · WORLD.tod('day'|'dusk'|'night')
         WORLD.height(E,N) bakkehøyde (DTM) · WORLD.ready · WORLD.stats() */
(function(G){
'use strict';
const T=()=>G.THREE;
const W={ready:false, loaded:{}, meta:null};
const LV=['far','mid','near'];
let lev={}, apt=null, group=null, terrain=null, tmat=null, sky=null, lights=null, bldg=null, inst=null, instAttr=null;
let shdCv=null, shdTex=null, casters=[], FLEETI=[], fleetMats=[], TRAF={}, tlights=null, detailTex=null, aptTex=null, digitTex=null, waterT=0, trees=null, treeAttr=null, treeBuf=null;
let TREE_R=1000, CARS_R=3200, carsMesh=null;                                  // 3D trees out to this distance (m); the forest canopy takes over beyond
const GRID=16;                                   // quads per patch side
const P0=160;                                    // finest patch size (m) -> 10 m vertex spacing
const NLEV=11;                                   // quadtree levels: root = 160*2^10 = 163.84 km
const ROOT={E:0, N:1000, S:P0*Math.pow(2,NLEV-1)};
const MAXI=2400;
const DATA_V=19;                                  // bump when anything under world/ento/ changes (files are cached as immutable)
const V=f=>f+'?v='+DATA_V;

/* ---------- loading ---------- */
async function bitmap(url){
  const r=await fetch(url); if(!r.ok) throw new Error(url+' '+r.status);
  const b=await r.blob();
  return await createImageBitmap(b,{premultiplyAlpha:'none',colorSpaceConversion:'none'});
}
function pixels(bm){
  const c=(typeof OffscreenCanvas!=='undefined')?new OffscreenCanvas(bm.width,bm.height):Object.assign(document.createElement('canvas'),{width:bm.width,height:bm.height});
  const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(bm,0,0); return g.getImageData(0,0,bm.width,bm.height).data;
}
function texFromBitmap(bm,srgb){
  const t=new (T().Texture)(bm); t.flipY=false; t.generateMipmaps=true; t.minFilter=T().LinearMipmapLinearFilter; t.magFilter=T().LinearFilter;
  t.wrapS=t.wrapT=T().ClampToEdgeWrapping; t.anisotropy=8; t.needsUpdate=true; return t;
}
async function loadLevel(base,name){
  const m=W.meta[name];
  const [hb,ab,wb]=await Promise.all([bitmap(base+V(name+'_h.png')),bitmap(base+V(name+'_a.jpg')),bitmap(base+V(name+'_w.png'))]);
  const px=pixels(hb), n=m.hw*m.hh, dtm=new Float32Array(n), rh=new Float32Array(n), hc=new Float32Array(n*2);
  for(let i=0;i<n;i++){ const o=i*4; const h=((px[o]<<8)|px[o+1])/10-100, c=px[o+2]/5; dtm[i]=h; rh[i]=h+c; hc[i*2]=h; hc[i*2+1]=c; }
  const L={name,m,dtm,rh,ext:[m.E0,m.N1,m.hres*(m.hw-1),m.hres*(m.hh-1)]};
  const tH=new (T().DataTexture)(hc,m.hw,m.hh,T().RGFormat,T().FloatType); tH.internalFormat='RG32F';
  tH.minFilter=tH.magFilter=T().NearestFilter; tH.flipY=false; tH.generateMipmaps=false; tH.needsUpdate=true;
  // normals from the rendered surface (terrain + forest canopy)
  // RG: normal of the visible surface (ground + forest canopy), BA: normal of the bare ground (used under 3D trees)
  const nr=new Uint8Array(n*4), w=m.hw, h=m.hh, d=m.hres;
  const put=(arr,i,x,y,o)=>{ const xl=x>0?i-1:i, xr=x<w-1?i+1:i, yu=y>0?i-w:i, yd=y<h-1?i+w:i;
    const dE=(arr[xr]-arr[xl])/(d*((x>0&&x<w-1)?2:1)), dN=(arr[yu]-arr[yd])/(d*((y>0&&y<h-1)?2:1));
    const k=1/Math.hypot(dE,1,dN); nr[i*4+o]=Math.round((-dE*k*0.5+0.5)*255); nr[i*4+o+1]=Math.round((dN*k*0.5+0.5)*255); };
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=y*w+x; put(rh,i,x,y,0); put(dtm,i,x,y,2); }
  const tN=new (T().DataTexture)(nr,w,h,T().RGBAFormat,T().UnsignedByteType);
  tN.minFilter=T().LinearMipmapLinearFilter; tN.magFilter=T().LinearFilter; tN.generateMipmaps=true; tN.flipY=false; tN.needsUpdate=true;
  L.tH=tH; L.tN=tN; L.tA=texFromBitmap(ab,true); L.tW=texFromBitmap(wb,false);
  L.aext=[m.E0,m.N1,m.ares*(m.aw-1),m.ares*(m.ah-1)];
  lev[name]=L; W.loaded[name]=true;
  if(tmat) bindLevel(name);
  return L;
}
W.load=async function(base){
  base=base||'world/ento/';
  W.base=base;
  W.meta=await (await fetch(base+V('meta.json'))).json();
  apt=await (await fetch(base+V('airport.json'))).json(); W.airport=apt;
  await loadLevel(base,'far');
  W.ready=true;
  build();
  // finer levels stream in while the far terrain is already drawn
  const p=loadLevel(base,'mid').then(()=>loadLevel(base,'near'));
  Promise.all([bitmap(base+V('apt.png')),bitmap(base+V('aptl.png'))]).then(([bm,bl])=>{ aptTex=texFromBitmap(bm,false);
    // line offsets must not be mip-averaged (opposite vectors would cancel and fatten the lines far away)
    const tl=texFromBitmap(bl,false); tl.generateMipmaps=false; tl.minFilter=T().LinearFilter;
    if(tmat){ tmat.uniforms.tApt.value=aptTex; tmat.uniforms.tAptL.value=tl; tmat.uniforms.aptOn.value=1; } });
  const mt=b=>{ const t=texFromBitmap(b,false); t.wrapS=t.wrapT=T().RepeatWrapping; t.anisotropy=8; return t; };
  Promise.all([bitmap(base+'../tex/mat_l.jpg?v=1'),bitmap(base+'../tex/mat_n.jpg?v=1')]).then(([a,b])=>{ if(tmat){ tmat.uniforms.tML.value=mt(a); tmat.uniforms.tMN.value=mt(b); tmat.uniforms.matOn.value=1; } }).catch(()=>{});
  W.full=p;
  return W;
};

/* ---------- CPU height (physics) ---------- */
function sampleArr(L,arr,E,N){
  const m=L.m, fx=(E-m.E0)/m.hres, fy=(m.N1-N)/m.hres;
  if(fx<0||fy<0||fx>m.hw-1||fy>m.hh-1) return null;
  const x=Math.min(m.hw-2,Math.floor(fx)), y=Math.min(m.hh-2,Math.floor(fy)), ax=fx-x, ay=fy-y, i=y*m.hw+x;
  return (arr[i]*(1-ax)+arr[i+1]*ax)*(1-ay)+(arr[i+m.hw]*(1-ax)+arr[i+m.hw+1]*ax)*ay;
}
W.height=function(E,N){
  // on the runway: the smoothed centreline profile, so the aircraft rolls on the same surface it sees
  if(apt){ const r=apt.rwy; const s=E*r.u[0]+N*r.u[1], t=E*r.u[1]-N*r.u[0];
    if(Math.abs(t)<r.width/2+3&&s>r.s0&&s<r.s1){ const p=r.profile, f=(s-p.s0)/p.step, i=Math.max(0,Math.min(p.h.length-2,Math.floor(f))), a=f-i; return p.h[i]*(1-a)+p.h[i+1]*a; } }
  for(const n of ['near','mid','far']){ const L=lev[n]; if(!L) continue; const h=sampleArr(L,L.dtm,E,N); if(h!==null) return Math.max(h,0); }
  return 0;
};
W.surface=function(E,N){ for(const n of ['near','mid','far']){ const L=lev[n]; if(!L) continue; const h=sampleArr(L,L.rh,E,N); if(h!==null) return Math.max(h,0); } return 0; };

/* ---------- textures made on the device (no download) ---------- */
function makeDetail(){
  const S=256, d=new Uint8Array(S*S*4);
  const rnd=(i)=>{ let h=(i*374761393)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; };
  const vn=(x,y,c,s)=>{ const X=x/c,Y=y/c, xi=Math.floor(X), yi=Math.floor(Y), fx=X-xi, fy=Y-yi, n=S/c;
    const g=(a,b)=>rnd(((a%n+n)%n)*7919+((b%n+n)%n)*104729+s*31);
    const u=fx*fx*(3-2*fx), v=fy*fy*(3-2*fy);
    return (g(xi,yi)*(1-u)+g(xi+1,yi)*u)*(1-v)+(g(xi,yi+1)*(1-u)+g(xi+1,yi+1)*u)*v; };
  for(let y=0;y<S;y++) for(let x=0;x<S;x++){
    const i=(y*S+x)*4;
    const grass=0.55*vn(x,y,4,1)+0.3*vn(x,y,16,2)+0.15*rnd(x*S+y+7);
    const canopy=0.6*vn(x,y,8,3)+0.4*vn(x,y,32,4);
    const asph=0.5*rnd(x*S+y+99)+0.3*vn(x,y,2,5)+0.2*vn(x,y,64,6);
    const wave=0.5*vn(x,y,32,7)+0.3*vn(x,y,16,8)+0.2*vn(x,y,8,9);
    d[i]=grass*255; d[i+1]=canopy*255; d[i+2]=asph*255; d[i+3]=wave*255;
  }
  const t=new (T().DataTexture)(d,S,S,T().RGBAFormat,T().UnsignedByteType);
  t.wrapS=t.wrapT=T().RepeatWrapping; t.minFilter=T().LinearMipmapLinearFilter; t.magFilter=T().LinearFilter; t.generateMipmaps=true; t.anisotropy=8; t.needsUpdate=true;
  return t;
}
function makeDigits(){
  // runway designators (ICAO font proportions approximated): '1','7','3','5' in a 4-cell strip, white on black
  const c=document.createElement('canvas'); c.width=512; c.height=256; const g=c.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,512,256); g.fillStyle='#fff';
  g.font='bold 236px "Arial Narrow", Arial, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  ['1','7','3','5'].forEach((ch,i)=>{ g.save(); g.translate(64+i*128,132); g.scale(0.78,1); g.fillText(ch,0,0); g.restore(); });
  const t=new (T().CanvasTexture)(c); t.flipY=false; t.minFilter=T().LinearMipmapLinearFilter; t.anisotropy=8; return t;
}

function makeStandDigits(){
  const c=document.createElement('canvas'); c.width=640; c.height=128; const g=c.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,640,128); g.fillStyle='#fff'; g.font='bold 118px Arial, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  for(let i=0;i<10;i++){ g.save(); g.translate(32+i*64,68); g.scale(0.62,1); g.fillText(String(i),0,0); g.restore(); }
  const t=new (T().CanvasTexture)(c); t.flipY=false; t.minFilter=T().LinearMipmapLinearFilter; t.anisotropy=8; return t;
}

/* ---------- time of day ---------- */
const TOD={
  day:  {sun:[0.42,0.62,-0.66], sunCol:[1.0,0.95,0.86], sunI:3.5, sky:[0.28,0.50,0.86], hor:[0.66,0.77,0.89], amb:0.47, fog:1/70000, lights:0.0, exp:1.0},
  dusk: {sun:[-0.80,0.07,-0.58],sunCol:[1.0,0.58,0.30], sunI:2.0, sky:[0.20,0.30,0.52], hor:[0.88,0.62,0.44], amb:0.40, fog:1/45000, lights:0.65, exp:1.15},
  night:{sun:[0.30,0.55,0.70], sunCol:[0.40,0.48,0.70], sunI:0.035,sky:[0.006,0.010,0.024],hor:[0.018,0.024,0.042],amb:0.03, fog:1/26000, lights:1.0, exp:1.2}
};
let todK='day';
W.tod=function(k){ if(!TOD[k]) return todK; todK=k; if(tmat) applyTod(); return k; };
function drawShadows(sun){
  // sun shadows of buildings, parked aircraft and masts (red) and soft contact shading (green), drawn once per
  // time of day at 1.5 m per pixel; one blur pass at the end, no per-shape filters (those are slow on phones)
  const sd=apt.rwy.sdf, R=1.5, w=Math.round(sd.w*sd.res/R), h=Math.round(sd.h*sd.res/R);
  const mk=()=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
  if(!shdCv){ shdCv=mk(); shdCv._t=mk(); }
  const t=shdCv._t, g=t.getContext('2d');
  g.globalCompositeOperation='source-over'; g.fillStyle='#000'; g.fillRect(0,0,w,h);
  const X=E=>(E-sd.E0)/R, Y=N=>(sd.N1-N)/R;
  const up=Math.max(sun.y,0.06), dE=-sun.x/up, dN=sun.z/up, lit=sun.y>0.02;
  const poly=(P,ox,oy)=>{ g.beginPath(); P.forEach((q,i)=>i?g.lineTo(X(q[0]+ox),Y(q[1]+oy)):g.moveTo(X(q[0]+ox),Y(q[1]+oy))); g.closePath(); g.fill(); };
  g.globalCompositeOperation='lighten';
  g.fillStyle='rgb(0,150,0)'; g.strokeStyle='rgb(0,110,0)'; g.lineWidth=4/R; g.lineJoin='round';
  for(const c of casters){ if(c.h<0.5||(c.z0||0)>0.5) continue; poly(c.p,0,0); g.stroke(); }
  if(lit){ g.fillStyle='rgb(255,0,0)';
    for(const c of casters){
      const ox=dE*c.h, oy=dN*c.h, z0=c.z0||0, bx=dE*z0, by=dN*z0, P=c.p, n=P.length;
      poly(P,ox,oy); poly(P,bx,by);
      for(let i=0;i<n;i++){ const a=P[i], b=P[(i+1)%n];
        g.beginPath(); g.moveTo(X(a[0]+bx),Y(a[1]+by)); g.lineTo(X(b[0]+bx),Y(b[1]+by)); g.lineTo(X(b[0]+ox),Y(b[1]+oy)); g.lineTo(X(a[0]+ox),Y(a[1]+oy)); g.closePath(); g.fill(); } } }
  const o=shdCv.getContext('2d'); o.globalCompositeOperation='copy';
  if(typeof o.filter==='string'){ o.filter='blur(1px)'; o.drawImage(t,0,0); o.filter='none'; } else o.drawImage(t,0,0);
  if(!shdTex){ shdTex=new (T().CanvasTexture)(shdCv); shdTex.flipY=false; shdTex.minFilter=T().LinearMipmapLinearFilter; shdTex.magFilter=T().LinearFilter; shdTex.anisotropy=8; }
  shdTex.needsUpdate=true;
  if(tmat){ tmat.uniforms.tShd.value=shdTex; }
}
function applyTod(){
  const p=TOD[todK], v=new (T().Vector3)(...p.sun).normalize();
  if(apt&&casters.length) drawShadows(v);
  for(const m of [tmat,sky&&sky.material,bldg&&bldg.material,lights&&lights.material,trees&&trees.material,...fleetMats]){ if(!m) continue; const u=m.uniforms;
    if(u.sunDir) u.sunDir.value.copy(v); if(u.sunCol) u.sunCol.value.setRGB(p.sunCol[0]*p.sunI,p.sunCol[1]*p.sunI,p.sunCol[2]*p.sunI);
    if(u.skyCol) u.skyCol.value.setRGB(...p.sky); if(u.horCol) u.horCol.value.setRGB(...p.hor); if(u.amb) u.amb.value=p.amb;
    if(u.fogD) u.fogD.value=p.fog; if(u.night) u.night.value=p.lights; if(u.expo) u.expo.value=p.exp; }
}

/* ---------- shared shader code: sky colour, fog, tone mapping ---------- */
const COMMON=`
uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 skyCol; uniform vec3 horCol; uniform float amb; uniform float fogD; uniform float expo;
vec3 skyAt(vec3 d){
  float y=max(d.y,0.0);
  vec3 c=mix(horCol,skyCol,pow(y,0.45));
  float s=max(dot(d,sunDir),0.0);
  c+=sunCol*0.045*pow(s,6.0)+sunCol*0.10*pow(s,64.0);
  if(d.y<0.0) c=mix(horCol,horCol*0.82,clamp(-d.y*6.0,0.0,1.0));
  return c;
}
vec3 aerial(vec3 col,vec3 wpos,vec3 cam){
  vec3 v=wpos-cam; float dist=length(v); vec3 dir=v/max(dist,1e-3);
  // height-dependent haze: thinner with altitude (scale height 2.2 km)
  float h0=max(cam.y,0.0), h1=max(wpos.y,0.0), H=2200.0;
  float dh=h1-h0; float k=abs(dh)>1.0? (exp(-h0/H)-exp(-h1/H))/(dh/H) : exp(-h0/H);
  float f=1.0-exp(-dist*fogD*k);
  vec3 fc=skyAt(vec3(dir.x,max(dir.y,0.0)*0.6,dir.z));
  return mix(col,fc,f);
}
vec3 tone(vec3 c){ c*=expo*0.80;
  c=clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14),0.0,1.0);          // ACES filmic (Narkowicz)
  float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=max(mix(vec3(l),c,1.04),0.0);
  return pow(c,vec3(1.0/2.2)); }
vec3 lin(vec3 c){ return pow(c,vec3(2.2)); }
`;

/* ---------- terrain ---------- */
function levUniforms(){
  const U={};
  for(const n of LV){ const k=n[0].toUpperCase();
    U['tH'+k]={value:null}; U['tN'+k]={value:null}; U['tA'+k]={value:null}; U['tW'+k]={value:null};
    U['ext'+k]={value:new (T().Vector4)(0,0,1,1)}; U['aext'+k]={value:new (T().Vector4)(0,0,1,1)}; U['sz'+k]={value:new (T().Vector2)(2,2)}; U['on'+k]={value:0}; }
  return U;
}
function bindLevel(n){
  const L=lev[n], k=n[0].toUpperCase(), u=tmat.uniforms;
  u['tH'+k].value=L.tH; u['tN'+k].value=L.tN; u['tA'+k].value=L.tA; u['tW'+k].value=L.tW;
  u['ext'+k].value.set(...L.ext); u['aext'+k].value.set(...L.aext); u['sz'+k].value.set(L.m.hw,L.m.hh); u['on'+k].value=1;
}
const TVS=`
precision highp float; precision highp sampler2D;
attribute vec4 inst;            // E0, N0 (south-west corner), size, level
uniform vec3 camW; uniform vec4 morph[${NLEV}]; uniform float treeR;
uniform sampler2D tHF, tHM, tHN; uniform vec4 extF, extM, extN; uniform vec2 szF, szM, szN; uniform float onF, onM, onN;
varying vec3 vW; varying vec2 vEN; varying float vSp; varying float vCan;
vec2 hFetch(sampler2D t,vec2 sz,vec4 e,vec2 EN){
  vec2 p=vec2((EN.x-e.x)/e.z*(sz.x-1.0),(e.y-EN.y)/e.w*(sz.y-1.0));
  p=clamp(p,vec2(0.0),sz-1.001); ivec2 i=ivec2(floor(p)); vec2 f=p-vec2(i);
  vec2 a=texelFetch(t,i,0).rg, b=texelFetch(t,i+ivec2(1,0),0).rg, c=texelFetch(t,i+ivec2(0,1),0).rg, d=texelFetch(t,i+ivec2(1,1),0).rg;
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float inside(vec4 e,vec2 EN,float m){ vec2 d=min(EN-vec2(e.x,e.y-e.w),vec2(e.x+e.z,e.y)-EN); return clamp(min(d.x,d.y)/m,0.0,1.0); }
vec2 H2(vec2 EN,float sp){
  vec2 h=hFetch(tHF,szF,extF,EN);
  float km=onM*inside(extM,EN,1200.0)*clamp((330.0-sp)/170.0,0.0,1.0);
  if(km>0.0) h=mix(h,hFetch(tHM,szM,extM,EN),km);
  float kn=onN*inside(extN,EN,300.0)*clamp((85.0-sp)/45.0,0.0,1.0);
  if(kn>0.0) h=mix(h,hFetch(tHN,szN,extN,EN),kn);
  return vec2(max(h.x,-0.5),h.y);
}
float H(vec2 EN,float sp){ vec2 h=H2(EN,sp); return h.x+h.y; }
void main(){
  float size=inst.z; int l=int(inst.w+0.5); float sp=size/${GRID}.0;
  vec2 g=position.xz*${GRID}.0;
  vec2 EN=inst.xy+g*sp;
  float h0=H(EN,sp*2.0);
  float dist=distance(vec3(EN.x,h0,-EN.y),camW);
  vec4 mr=morph[l]; float k=clamp((dist-mr.x)*mr.y,0.0,1.0);
  vec2 fr=fract(g*0.5)*2.0; g-=fr*k; EN=inst.xy+g*sp;
  vec2 ha=mix(H2(EN,sp),H2(EN,sp*2.0),k); ha.y*=0.55;                       // forest canopy relief: enough to read as forest, not as hills
  float dxz=distance(EN,vec2(camW.x,-camW.z)); ha.y*=smoothstep(treeR*0.72,treeR,dxz);
  float h=ha.x+ha.y;
  vEN=EN; vSp=sp; vCan=ha.y;
  vec3 w=vec3(EN.x,h,-EN.y); vW=w;
  gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0);
}`;
const TFS=`
precision highp float; precision highp sampler2D;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
${COMMON}
uniform vec3 camW; uniform float night; uniform float wt; uniform float treeR;
uniform sampler2D tNF,tNM,tNN, tAF,tAM,tAN, tWF,tWM,tWN, tDet, tApt, tAptL, tShd, tML, tMN;
uniform vec4 extF,extM,extN, aextF,aextM,aextN; uniform float onM,onN, aptOn, matOn;
uniform vec4 aptE; uniform vec2 rwyU; uniform vec4 rwyS; uniform float rwyAim;
uniform sampler2D tSD; uniform vec4 stands[16]; uniform int nStands; uniform vec4 holdA[8]; uniform vec4 holdB[8]; uniform int nHolds; uniform vec3 masts[40]; uniform int nMasts;
varying vec3 vW; varying vec2 vEN; varying float vSp; varying float vCan;
vec2 uvOf(vec4 e,vec2 EN){ return vec2((EN.x-e.x)/e.z,(e.y-EN.y)/e.w); }
float inside(vec4 e,vec2 EN,float m){ vec2 d=min(EN-vec2(e.x,e.y-e.w),vec2(e.x+e.z,e.y)-EN); return clamp(min(d.x,d.y)/m,0.0,1.0); }
float cov1(float x,float h,float a){ a=max(a,1e-3); return clamp((min(x+a,h)-max(x-a,-h))/(2.0*a),0.0,1.0); }
vec2 AA;   // filter half-width along s and t, set per pixel
float box(vec2 p,vec2 c,vec2 hs,float aa){ vec2 q=p-c; return cov1(q.x,hs.x,AA.x)*cov1(q.y,hs.y,AA.y); }
void main(){
  vec2 EN=vEN;
  vec2 uF=uvOf(aextF,EN), uM=uvOf(aextM,EN), uN=uvOf(aextN,EN);
  vec3 alb=texture2D(tAF,uF).rgb; vec4 nrm=texture2D(tNF,uvOf(extF,EN)); float wat=texture2D(tWF,uF).r; float fr=0.0, pv=0.0;
  float km=onM*inside(extM,EN,1500.0), kn=onN*inside(extN,EN,350.0);
  if(km>0.0){ alb=mix(alb,texture2D(tAM,uM).rgb,km); nrm=mix(nrm,texture2D(tNM,uvOf(extM,EN)),km); wat=mix(wat,texture2D(tWM,uM).r,km); }
  float rA=0.0, rG=0.0;
  if(kn>0.0){ vec4 w4=texture2D(tWN,uN); vec3 w3=w4.rgb;
    vec2 rd=texture2D(tWN,uN,-2.0).ba; float sA=(rd.y*255.0-128.0)*0.1, sG=(rd.x*255.0-128.0)*0.1;   // sharper mip: distance fields stay exact        // NVDB road edges, signed metres
    float fA=max(fwidth(sA),0.08), fG=max(fwidth(sG),0.08);
    rA=smoothstep(-1.0,1.0,sA/(fA*0.75))*clamp(3.5/fA,0.0,1.0)*kn; rG=smoothstep(-1.0,1.0,sG/(fG*0.75))*clamp(2.5/fG,0.0,1.0)*kn; vec3 an=texture2D(tAN,uN).rgb; vec3 ab=texture2D(tAN,uN,1.0).rgb;
    an=clamp(an+(an-ab)*0.22,0.0,1.0);                  // unsharp mask: the 10 m satellite colours read crisper up close
    alb=mix(alb,an,kn); nrm=mix(nrm,texture2D(tNN,uvOf(extN,EN)),kn); wat=mix(wat,w3.r,kn); fr=w3.g*kn*(1.0-max(rA,rG)); pv=max(rA,rG); }
  float nearT=1.0-smoothstep(treeR*0.72,treeR,distance(EN,vec2(camW.x,-camW.z)));
  vec2 nxz=mix(nrm.rg,nrm.ba,nearT)*2.0-1.0;
  vec3 N=vec3(nxz.x,0.0,nxz.y); N.y=sqrt(max(0.0,1.0-N.x*N.x-N.z*N.z)); N=normalize(N);
  vec3 c=lin(alb); { float lu=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(lu),c,0.80)*vec3(1.0,0.98,0.95); }
  float fz=smoothstep(1.0,5.0,vCan);
  if(fz>0.0){ vec4 df=texture2D(tDet,EN/9.0); vec3 fc=lin(vec3(0.14,0.20,0.12))*(0.75+0.5*df.g);
    float side=1.0-N.y; fc*=1.0-0.45*smoothstep(0.25,0.8,side);
    c=mix(c,mix(c,fc,0.55+0.45*smoothstep(0.2,0.6,side)),fz); fr=max(fr,fz); }
  vec3 V=camW-vW; float dist=length(V); V/=dist;
  float under=fr*(1.0-smoothstep(treeR*0.72,treeR,distance(EN,vec2(camW.x,-camW.z))));
  if(under>0.0){ vec4 dfl=texture2D(tDet,EN/3.0); c=mix(c,lin(vec3(0.11,0.13,0.08))*(0.7+0.6*dfl.g),under*0.85); }
  // close-up detail (fades out by 2 km)
  float dk=1.0-smoothstep(500.0,3200.0,dist);
  if(dk>0.0){
    vec4 d1=texture2D(tDet,EN/5.0), d2=texture2D(tDet,EN/41.0), d3=texture2D(tDet,EN/1.3);
    float g=(d1.r-0.5)*0.40+(d2.r-0.5)*0.34+(d3.r-0.5)*0.22, f=(d1.g-0.5)*0.55+(d2.g-0.5)*0.35;
    float m=mix(g,f,fr);
    // open farmland: crop rows / mowing lanes, one direction per 160 m block, filtered so they never shimmer
    float open_=clamp(1.0-fr-wat-pv,0.0,1.0)*kn;
    if(open_>0.0){
      vec2 cell=floor(EN/160.0); float hr=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
      float a=hr*3.14159; vec2 dir=vec2(cos(a),sin(a)); float x=dot(EN,dir)/(2.2+hr*1.6);
      float fw=fwidth(x); float rows=sin(x*6.2832)*(1.0-smoothstep(0.25,0.6,fw));
      m+=rows*0.07*open_;
    }
    c*=1.0+m*dk;
    float ov=clamp(1.0-fr-wat-pv,0.0,1.0)*dk;
    if(matOn>0.5){ float lg=texture2D(tML,EN/2.0).b, lg2=texture2D(tML,EN/7.3+0.37).b; c*=mix(1.0,(0.55+0.9*lg)*(0.8+0.4*lg2),ov*(1.0-smoothstep(150.0,900.0,dist))); }
    c*=mix(vec3(1.0),mix(vec3(1.06,1.02,0.86),vec3(0.90,1.0,1.06),d2.g),0.55*ov);
  }
  if(rA+rG>0.0){                                        // roads: asphalt and gravel, a little tone from the detail map
    vec4 dr=texture2D(tDet,EN/3.1);
    vec3 asp=lin(vec3(0.215,0.22,0.225))*(0.88+0.24*dr.b), grv=lin(vec3(0.50,0.46,0.39))*(0.85+0.3*dr.r);
    c=mix(c,grv,rG*0.92); c=mix(c,asp,rA*0.95);
  }
  // airport pavement (signed distance field) and taxiway centrelines
  float paved=0.0; vec3 pc=vec3(0.0);
  if(aptOn>0.5){
    vec2 ua=vec2((EN.x-aptE.x)/aptE.z,(aptE.y-EN.y)/aptE.w);
    if(ua.x>0.0&&ua.y>0.0&&ua.x<1.0&&ua.y<1.0){
      vec3 s=texture2D(tApt,ua).rgb;
      float sd=(s.r*255.0-128.0)/16.0; float aa=max(fwidth(sd),0.02);
      paved=smoothstep(-aa,aa,sd);
      { // airside grass: mowing stripes along the runway, tufts, a worn strip at the pavement edge
        float gz=(1.0-paved)*clamp(1.0-fr-wat-rA-rG,0.0,1.0)*(1.0-smoothstep(300.0,1800.0,dist));
        if(gz>0.0){ float t=dot(EN,vec2(rwyU.y,-rwyU.x))/7.0; float ft=fwidth(t); float st=sin(t*3.14159)*(1.0-smoothstep(0.3,0.7,ft));
          float tu=texture2D(tDet,EN/11.0+0.21).g-0.5; float edge=1.0-smoothstep(0.0,1.8,-sd);
          c*=1.0+(0.13*st*(1.0-smoothstep(250.0,900.0,dist))+0.30*tu)*gz; c=mix(c,c*vec3(0.90,0.86,0.74),edge*gz*0.75); } }
      float concrete=s.b;
      vec4 dd=texture2D(tDet,EN/2.3);
      float la=0.5, lc=0.5;
      if(matOn>0.5){ la=texture2D(tML,EN/2.1).r; lc=texture2D(tML,EN/2.5).g; }
      vec3 asph=lin(vec3(0.27,0.28,0.29))*(0.90+0.16*dd.b)*(0.55+0.9*la);
      vec3 conc=lin(vec3(0.42,0.415,0.40))*(0.92+0.12*dd.b)*(0.70+0.60*lc);
      { float w1=texture2D(tDet,EN/37.0).r, w2=texture2D(tDet,EN/91.0+0.3).g, st=texture2D(tDet,EN/6.3+0.7).r;
        conc*=(0.86+0.22*w1)*(0.92+0.14*w2); conc*=1.0-0.18*smoothstep(0.62,0.80,st)*w2;
        asph*=(0.90+0.18*w1); }
      pc=mix(asph,conc,concrete);
      // shoulder darkening near the edge, rubber-free look
      pc*=0.92+0.08*smoothstep(0.0,3.0,sd);
      if(concrete>0.02){
        // 5 m concrete slabs: joints, a slight tone per slab, tyre and oil marks at the stands
        vec2 sl=EN/5.0; vec2 sid=floor(sl); float hs=fract(sin(dot(sid,vec2(12.9898,78.233)))*43758.5453);
        vec2 fj=abs(fract(sl)-0.5); vec2 jw=fwidth(sl);
        float joint=max(1.0-smoothstep(0.0,jw.x*1.2+0.004,0.5-fj.x),1.0-smoothstep(0.0,jw.y*1.2+0.004,0.5-fj.y));
        joint*=1.0-smoothstep(0.08,0.3,max(jw.x,jw.y));
        vec3 cc=pc*(0.95+0.08*hs)*(0.9+0.2*texture2D(tDet,EN/13.0).r);
        cc*=1.0-0.20*joint*concrete;
        for(int i=0;i<16;i++){ if(i>=nStands) break; vec4 st=stands[i]; vec2 dq=EN-st.xy; if(dot(dq,dq)>3000.0) continue;   // only the stands within 55 m
          vec2 f=vec2(sin(st.z),cos(st.z)); vec2 r=vec2(f.y,-f.x); vec2 q=EN-st.xy; float a=dot(q,f), b=dot(q,r);
          if(abs(a)<45.0&&abs(b)<30.0){
            float stain=exp(-pow(b/2.2,2.0)-pow((a+1.5)/3.0,2.0))*0.55            // nose gear position
                       +exp(-pow((abs(b)-3.8)/2.0,2.0)-pow((a+12.5)/4.0,2.0))*0.45  // main gear
                       +exp(-pow((abs(b)-5.8)/3.0,2.0)-pow((a+10.0)/5.0,2.0))*0.30; // engines (oil drips)
            stain*=0.6+0.8*texture2D(tDet,EN/1.7).r;
            cc*=1.0-0.42*clamp(stain,0.0,1.0);
          } }
        pc=mix(pc,cc,concrete);
      }
      vec2 ofs=(texture2D(tAptL,ua).rg*255.0-128.0)/20.0; float cd=length(ofs); float caa=max(fwidth(cd),0.02);
      float line=1.0-smoothstep(0.075-caa,0.075+caa,cd);
      vec3 yel=lin(vec3(0.88,0.68,0.10))*(0.85+0.2*texture2D(tDet,EN/1.1).r);
      pc=mix(pc,yel,line);
      if(paved>0.001){                                    // markings only on pavement: the loops cost every airport pixel otherwise
      // runway holding positions, pattern A: two solid lines on the taxiway side, two dashed lines on the runway side
      for(int i=0;i<8;i++){ if(i>=nHolds) break; vec2 A=holdA[i].xy, Bp=holdB[i].xy; vec2 dq=EN-A; if(dot(dq,dq)>1600.0) continue; vec2 dv=Bp-A; float Lh=length(dv); dv/=Lh;
        vec2 nr=vec2(dv.y,-dv.x); vec2 tw=-holdA[i].z*vec2(rwyU.y,-rwyU.x); if(dot(nr,tw)<0.0) nr=-nr;     // nr points to the runway
        vec2 q=EN-A; float al=dot(q,dv), ac=dot(q,nr);
        if(al>-1.0&&al<Lh+1.0&&abs(ac)<2.0){ float w=max(fwidth(ac),0.01);
          float ln=0.0; for(int k=0;k<4;k++){ float c0=-0.525+float(k)*0.3; float on=1.0-smoothstep(0.075-w,0.075+w,abs(ac-c0)); if(k>=2) on*=step(fract(al/1.8),0.5); ln=max(ln,on); }
          pc=mix(pc,yel,ln*step(0.0,al)*step(al,Lh)); } }
      // stand stop bars and painted stand numbers (read from the cockpit as the aircraft taxies in)
      for(int i=0;i<16;i++){ if(i>=nStands) break; vec4 st=stands[i]; vec2 dq=EN-st.xy; if(dot(dq,dq)>3000.0) continue;   // only the stands within 55 m
        vec2 f=vec2(sin(st.z),cos(st.z)); vec2 r=vec2(f.y,-f.x); vec2 q=EN-st.xy; float a=dot(q,f), b=dot(q,r);
        if(st.w<20.0&&a>-40.0&&a<7.0&&abs(b)<20.0){
          // equipment restraint area: red line around the aircraft envelope
          vec2 aw2=vec2(max(fwidth(a),0.01),max(fwidth(b),0.01));
          float era=max(max(1.0-smoothstep(0.0,0.1+aw2.x,abs(a-6.0)),1.0-smoothstep(0.0,0.1+aw2.x,abs(a+39.5)))*step(abs(b),19.0),
                        (1.0-smoothstep(0.0,0.1+aw2.y,abs(abs(b)-19.0)))*step(-39.5,a)*step(a,6.0));
          era*=step(0.35,fract((a+b)/1.2))*0.0+1.0;
          pc=mix(pc,lin(vec3(0.70,0.10,0.08)),era*concrete);
        }
        if(abs(a)<20.0&&abs(b)<10.0){
          vec2 aw=vec2(max(fwidth(a),0.01),max(fwidth(b),0.01));
          float bar=clamp((min(a+0.15+aw.x,0.15)-max(a+0.15-aw.x,-0.15))/(2.0*aw.x),0.0,1.0)*clamp((min(b+aw.y,2.5)-max(b-aw.y,-2.5))/(2.0*aw.y),0.0,1.0);
          pc=mix(pc,yel,bar);
          // number: 3 m tall, 9 m before the stop point, upright for a pilot taxiing in
          float id=st.w; float n2=id>=10.0?2.0:1.0; float cw=1.9;
          vec2 p=vec2(b+n2*cw*0.5, -(a+9.0)+1.5);
          if(p.y>0.0&&p.y<3.0&&p.x>0.0&&p.x<n2*cw){
            float k=floor(p.x/cw); float dgt=n2>1.5?(k<0.5?floor(id/10.0):mod(id,10.0)):id;
            vec2 du=vec2((dgt+0.1+fract(p.x/cw)*0.8)/10.0,1.0-p.y/3.0);
            float g=texture2D(tSD,du).r; pc=mix(pc,yel,smoothstep(0.35,0.65,g));
          }
        } }
      }
    }
  }
  // runway: surface and ICAO markings computed analytically in runway coordinates
  vec2 rp=vec2(dot(EN,rwyU),EN.x*rwyU.y-EN.y*rwyU.x);   // s along RWY 35, t to the right
  float rw=rwyS.z*0.5;
  AA=vec2(max(fwidth(rp.x),0.02),max(fwidth(rp.y),0.02))*0.75; float onR=box(rp,vec2((rwyS.x+rwyS.y)*0.5,0.0),vec2((rwyS.y-rwyS.x)*0.5,rw),0.0);
  if(onR>0.0){
    vec4 dd=texture2D(tDet,EN/2.0); vec4 de=texture2D(tDet,EN/27.0);
    float lr=matOn>0.5?texture2D(tML,EN/2.1).r:0.5;
    vec3 rc=lin(vec3(0.20,0.21,0.22))*(0.88+0.14*dd.b)*(0.92+0.16*de.a)*(0.55+0.9*lr);
    float L=rwyS.w; float s=rp.x, t=rp.y; AA=vec2(max(fwidth(s),0.02),max(fwidth(t),0.02))*0.75; float aa=AA.y;
    // rubber deposits in both touchdown zones
    float tz=smoothstep(200.0,350.0,s)*(1.0-smoothstep(650.0,900.0,s))+smoothstep(200.0,350.0,L-s)*(1.0-smoothstep(650.0,900.0,L-s));
    rc*=1.0-0.35*tz*smoothstep(10.0,2.0,abs(t+(de.r-0.5)*4.0))*(0.6+0.4*dd.r);
    float mk=0.0;
    // side stripes (0.9 m) and centreline (30 m dashes, 30 m gaps, 0.9 m wide)
    mk=max(mk,box(vec2(s,abs(t)),vec2((rwyS.x+rwyS.y)*0.5,rw-0.45-0.5),vec2((rwyS.y-rwyS.x)*0.5,0.45),aa)*step(0.0,s+0.01)*step(s,L+0.01));
    float sm=mod(s-33.0,60.0);
    mk=max(mk,box(vec2(sm,t),vec2(15.0,0.0),vec2(15.0,0.45),aa)*step(70.0,s)*step(s,L-70.0));
    for(int e=0;e<2;e++){
      float d=e==0?s:L-s; float tt=e==0?t:-t;            // d: metres past this threshold, towards the other end
      if(d>930.0) continue;                               // all end markings lie within 930 m of the threshold
      // threshold: 12 stripes, 30 m long, 1.8 m wide, 1.8 m spacing; double gap at the centre
      float ts=0.0;
      for(int k=0;k<6;k++){ float x=1.8+float(k)*3.6+0.9; ts=max(ts,box(vec2(d,abs(tt)),vec2(6.0+15.0,x),vec2(15.0,0.9),aa)); }
      mk=max(mk,ts);
      // transverse stripe at the displaced threshold
      mk=max(mk,box(vec2(d,tt),vec2(-0.9,0.0),vec2(0.9,rw-0.5),aa));
      // aiming point: 400 m, 60 m x 10 m, inner edges 9 m from the centreline
      mk=max(mk,box(vec2(d,abs(tt)),vec2(rwyAim+30.0,9.0+5.0),vec2(30.0,5.0),aa));
      // touchdown zone pairs: 22.5 m x 3 m, 1.5 m spacing
      for(int p=0;p<5;p++){ float at=p==0?150.0:p==1?300.0:p==2?600.0:p==3?750.0:900.0; int nn=p<2?3:(p<4?2:1);
        for(int q=0;q<3;q++){ if(q<nn){ float x=9.0+1.5+float(q)*4.5; mk=max(mk,box(vec2(d,abs(tt)),vec2(at+11.25,x),vec2(11.25,1.5),aa)); } } }
      // displaced-threshold arrows on the paved area before the threshold
      float pre=e==0?-rwyS.x:rwyS.y-L;
      if(d<-10.0&&d>-pre){ float ac=mod(-d,30.0); float sh=abs(tt); mk=max(mk,box(vec2(ac,tt),vec2(15.0,0.0),vec2(9.0,0.45),aa));
        mk=max(mk,cov1(abs(tt)-(ac-4.0)*0.35+0.0,0.0,AA.y)*0.0+(1.0-smoothstep(-AA.y,AA.y,abs(tt)-(ac-4.0)*0.35))*step(4.0,ac)*step(ac,10.0)); }
      // designator: '17'/'35' read from the approach, 9 m tall, starting 12 m after the threshold stripes
      vec2 q=vec2(tt,d-(6.0+30.0+12.0));
      if(q.y>0.0&&q.y<9.0&&abs(q.x)<4.6){
        float dgt=q.x<0.0?(e==0?3.0:1.0):(e==0?5.0:7.0);
        float lx=(fract((q.x+4.6)/4.6)) ; vec2 du=vec2((dgt+0.06+lx*0.88)/10.0, 1.0-q.y/9.0);
        float dg=texture2D(tSD,du).r; mk=max(mk,smoothstep(0.35,0.65,dg));
      }
    }
    vec3 paint=lin(vec3(0.86,0.87,0.86))*(0.90+0.1*dd.r);
    rc=mix(rc,paint,mk*0.94);
    pc=mix(pc,rc,onR); paved=max(paved,onR);
  }
  if(paved>0.0){ c=mix(c,pc,paved); fr*=1.0-paved; wat*=1.0-paved; N=normalize(mix(N,vec3(0,1,0),paved*0.8));
    if(matOn>0.5){ vec2 nb=texture2D(tMN,EN/2.1).rg*2.0-1.0; float bk=paved*(1.0-smoothstep(40.0,250.0,dist));
      N=normalize(N+vec3(nb.x,0.0,-nb.y)*0.55*bk); } }
  // lighting: sun, sky ambient, bounce; baked shadows and contact shading around the airport's buildings and aircraft
  float ndl=max(dot(N,sunDir),0.0);
  float sunVis=smoothstep(-0.05,0.08,sunDir.y);
  float shS=0.0, shA=0.0;
  { vec2 ua3=vec2((EN.x-aptE.x)/aptE.z,(aptE.y-EN.y)/aptE.w);
    if(aptOn>0.5&&ua3.x>0.0&&ua3.y>0.0&&ua3.x<1.0&&ua3.y<1.0){ vec2 sh=texture2D(tShd,ua3).rg; shS=sh.r; shA=sh.g; } }
  vec3 lit=sunCol*ndl*sunVis*(1.0-0.25*fr)*(1.0-0.88*shS) + (skyCol*amb*(0.55+0.45*N.y)*2.0 + horCol*amb*0.25*(1.0-N.y))*(1.0-0.55*shA);
  lit*=1.0-0.18*fr*(1.0-ndl);
  vec3 col=c*lit;
  if(night>0.05&&aptOn>0.5){
    vec2 ua2=vec2((EN.x-aptE.x)/aptE.z,(aptE.y-EN.y)/aptE.w);
    if(ua2.x>0.0&&ua2.y>0.0&&ua2.x<1.0&&ua2.y<1.0){
      vec3 fl=vec3(0.0);
      for(int i=0;i<40;i++){ if(i>=nMasts) break; vec3 m=masts[i]; vec2 d=EN-m.xy; float r2=dot(d,d);
        if(r2<9000.0){ float hh=22.0; fl+=vec3(1.0,0.82,0.6)*hh*hh/(r2+hh*hh)*smoothstep(9000.0,2500.0,r2); } }
      col+=c*fl*1.4*night;
    } }
  // water: Fresnel sky reflection, sun glint, ripples
  if(wat>0.02){
    vec4 w1=texture2D(tDet,EN/61.0+vec2(wt*0.004,wt*0.002)), w2=texture2D(tDet,EN/23.0-vec2(wt*0.003,-wt*0.005));
    vec3 Nw=normalize(vec3((w1.a-0.5)*0.10+(w2.a-0.5)*0.07,1.0,(w1.b-0.5)*0.06+(w2.r-0.5)*0.05));
    float fres=0.02+0.98*pow(1.0-max(dot(Nw,V),0.0),5.0);
    vec3 R=reflect(-V,Nw); vec3 refl=skyAt(normalize(vec3(R.x,abs(R.y),R.z)));
    vec3 body=lin(vec3(0.05,0.11,0.13))*(skyCol*amb*2.0+sunCol*max(sunDir.y,0.0)*0.6);
    vec3 wc=mix(body,refl,clamp(fres,0.0,1.0));
    float gl=pow(max(dot(R,sunDir),0.0),280.0)*6.0+pow(max(dot(R,sunDir),0.0),40.0)*0.25;
    wc+=sunCol*gl*sunVis;
    col=mix(col,wc,smoothstep(0.02,0.5,wat));
  }
  col=aerial(col,vW,camW);
  gl_FragColor=vec4(tone(col),1.0);
}`;
function patchGeometry(){
  const g=new (T().InstancedBufferGeometry)(), n=GRID+1, pos=new Float32Array(n*n*3), idx=[];
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){ const i=(y*n+x)*3; pos[i]=x/GRID; pos[i+1]=0; pos[i+2]=y/GRID; }
  for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++){ const a=y*n+x, b=a+1, c=a+n, d=c+1;
    if((x+y)%2){ idx.push(a,b,c, b,d,c); } else { idx.push(a,b,d, a,d,c); } }
  g.setIndex(idx); g.setAttribute('position',new (T().BufferAttribute)(pos,3));
  inst=new Float32Array(MAXI*4); instAttr=new (T().InstancedBufferAttribute)(inst,4); instAttr.setUsage(T().DynamicDrawUsage);
  g.setAttribute('inst',instAttr); g.instanceCount=0;
  g.boundingSphere=new (T().Sphere)(new (T().Vector3)(0,0,0),1e7);
  return g;
}
function build(){
  group=new (T().Group)(); group.name='WORLD';
  detailTex=makeDetail(); digitTex=makeDigits();
  const U=Object.assign(levUniforms(),{
    camW:{value:new (T().Vector3)()}, morph:{value:[]}, treeR:{value:TREE_R}, tDet:{value:detailTex}, tApt:{value:null}, tAptL:{value:null}, tShd:{value:null}, tML:{value:null}, tMN:{value:null}, matOn:{value:0}, aptOn:{value:0}, tDig:{value:digitTex},
    aptE:{value:new (T().Vector4)(apt.rwy.sdf.E0,apt.rwy.sdf.N1,apt.rwy.sdf.w*apt.rwy.sdf.res,apt.rwy.sdf.h*apt.rwy.sdf.res)},
    rwyU:{value:new (T().Vector2)(apt.rwy.u[0],apt.rwy.u[1])}, tSD:{value:makeStandDigits()},
    holdA:{value:(()=>{ const a=(apt.rwy.holds||[]).slice(0,8).map(h=>new (T().Vector4)(h.a[0],h.a[1],h.side,0)); while(a.length<8) a.push(new (T().Vector4)()); return a; })()},
    holdB:{value:(()=>{ const a=(apt.rwy.holds||[]).slice(0,8).map(h=>new (T().Vector4)(h.b[0],h.b[1],0,0)); while(a.length<8) a.push(new (T().Vector4)()); return a; })()}, nHolds:{value:Math.min(8,(apt.rwy.holds||[]).length)},
    stands:{value:(()=>{ const a=(apt.rwy.stands||[]).slice(0,16).map(st=>new (T().Vector4)(st.E,st.N,st.hdg*Math.PI/180,+st.id)); while(a.length<16) a.push(new (T().Vector4)(0,0,0,0)); return a; })()}, nStands:{value:Math.min(16,(apt.rwy.stands||[]).length)},
    masts:{value:(()=>{ const a=(apt.rwy.masts||[]).slice(0,40).map(m=>new (T().Vector3)(m[0],m[1],m[2])); while(a.length<40) a.push(new (T().Vector3)(0,0,-9999)); return a; })()}, nMasts:{value:Math.min(40,(apt.rwy.masts||[]).length)}, rwyS:{value:new (T().Vector4)(apt.rwy.s0,apt.rwy.s1,apt.rwy.width,apt.rwy.lthr)}, rwyAim:{value:apt.rwy.aiming},
    sunDir:{value:new (T().Vector3)(0,1,0)}, sunCol:{value:new (T().Color)()}, skyCol:{value:new (T().Color)()}, horCol:{value:new (T().Color)()},
    amb:{value:0.5}, fogD:{value:1/30000}, expo:{value:1}, night:{value:0}, wt:{value:0}
  });
  for(let l=0;l<NLEV;l++) U.morph.value.push(new (T().Vector4)());
  tmat=new (T().ShaderMaterial)({uniforms:U,vertexShader:TVS,fragmentShader:TFS,glslVersion:T().GLSL3});
  tmat.extensions={derivatives:true};
  terrain=new (T().Mesh)(patchGeometry(),tmat); terrain.frustumCulled=false; terrain.name='terrain';
  group.add(terrain);
  for(const n of LV) if(lev[n]) bindLevel(n);
  buildSky(); buildBuildings(); buildFleet(); buildDetails(); buildLights(); buildTrees(); buildTraffic(); buildTrafficLights();
  setRanges();
  applyTod();
}
W.attach=function(scene){ if(group&&!group.parent) scene.add(group); return group; };

/* ---------- CDLOD selection ---------- */
let ranges=[];
function setRanges(){
  ranges=[]; let r=P0*4.0;                          // finest level used out to 640 m
  for(let l=0;l<NLEV;l++){ ranges.push(r); r*=2; }
  for(let l=0;l<NLEV;l++){ const end=ranges[l], start=end*0.62; tmat.uniforms.morph.value[l].set(start,1/(end-start),0,0); }
}
function dataRes(E0,N0,S){
  const inExt=(L,m)=>L&&!(E0>L.ext[0]+L.ext[2]-m||E0+S<L.ext[0]+m||N0>L.ext[1]-m||N0+S<L.ext[1]-L.ext[3]+m);
  if(inExt(lev.near,350)) return 10; if(inExt(lev.mid,1500)) return 40; return 200;
}
const _fr=new (G.THREE?G.THREE.Frustum:Object)(), _m4=G.THREE?new G.THREE.Matrix4():null, _bx=G.THREE?new G.THREE.Box3():null;
let nI=0, hmin=-50, hmax=1900;
function nodeH(E0,N0,S){
  // cheap height bounds from the far grid (5x5 samples) + canopy margin
  const L=lev.far; if(!L) return [-50,1900]; let lo=1e9, hi=-1e9;
  for(let j=0;j<=4;j++) for(let i=0;i<=4;i++){ const h=sampleArr(L,L.rh,E0+S*i/4,N0+S*j/4); if(h===null) continue; if(h<lo) lo=h; if(h>hi) hi=h; }
  if(lo>hi) return [-50,50]; const m=Math.min(220,30+S*0.02); return [lo-m,hi+m];
}
const HC=new Map();
function sel(E0,N0,S,l,cam){
  const key=E0+','+N0+','+S; let hb=HC.get(key); if(!hb){ hb=nodeH(E0,N0,S); HC.set(key,hb); }
  _bx.min.set(E0,hb[0],-(N0+S)); _bx.max.set(E0+S,hb[1],-N0);
  if(!_fr.intersectsBox(_bx)) return;
  const dx=Math.max(E0-cam.x,0,cam.x-(E0+S)), dz=Math.max(-(N0+S)-cam.z,0,cam.z-(-N0)), dy=Math.max(hb[0]-cam.y,0,cam.y-hb[1]);
  const d=Math.hypot(dx,dy,dz);
  const sp=S/GRID;
  if(l===0||d>ranges[l-1]||sp<=dataRes(E0,N0,S)*0.99){ if(nI<MAXI){ const o=nI*4; inst[o]=E0; inst[o+1]=N0; inst[o+2]=S; inst[o+3]=l; nI++; } return; }
  const h=S/2;
  sel(E0,N0,h,l-1,cam); sel(E0+h,N0,h,l-1,cam); sel(E0,N0+h,h,l-1,cam); sel(E0+h,N0+h,h,l-1,cam);
}
let tris=0;
W.update=function(camera,dt){
  if(!tmat) return;
  camera.updateMatrixWorld(); _m4.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_m4);
  const c=camera.getWorldPosition(new (T().Vector3)());
  tmat.uniforms.camW.value.copy(c);
  nI=0; sel(ROOT.E-ROOT.S/2,ROOT.N-ROOT.S/2,ROOT.S,NLEV-1,c);
  terrain.geometry.instanceCount=nI; instAttr.needsUpdate=true; instAttr.updateRange={offset:0,count:nI*4};
  tris=nI*GRID*GRID*2;
  waterT+=dt||0.016; tmat.uniforms.wt.value=waterT;
  if(sky){ sky.position.copy(c); sky.material.uniforms.time.value=waterT; }
  for(const m of [bldg&&bldg.material,lights&&lights.material,trees&&trees.material,...fleetMats]) if(m){ m.uniforms.camW.value.copy(c); if(m.uniforms.time) m.uniforms.time.value=waterT; }
  if(carsMesh) carsMesh.visible=Math.hypot(c.x+300,-c.z-500)<CARS_R&&c.y<1200;          // cars: only near the airport (they are sub-pixel further out)
  if(trees) updateTrees(c);
  updateTraffic(W.__t!==undefined?W.__t+(waterT-(W.__t0??(W.__t0=waterT))):waterT);
  if(lights) lights.material.uniforms.pxs.value=(G.innerHeight||800)/(2*Math.tan((camera.fov||60)*Math.PI/360));
};
W.stats=()=>({patches:nI,tris,trees:trees?trees.geometry.instanceCount:0,levels:Object.keys(W.loaded)});
W.quality=function(q){ TREE_R=q==='low'?550:q==='high'?1400:1000; CARS_R=q==='low'?1500:q==='high'?4000:3200; if(tmat) tmat.uniforms.treeR.value=lev.near?TREE_R:0; if(trees){ trees.material.uniforms.treeR.value=TREE_R; lastTC=null; } };

/* ---------- 3D trees near the camera (instanced cones from the lidar canopy) ---------- */
const TILE=250, MAXT=30000; const TC=new Map(); let lastTC=null;
function j0(a,b){ return a*977+b*131; }
function hsh(a,b){ let h=(a*374761393+b*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; }
function tileTrees(ti,tj){
  const key=ti+','+tj; let t=TC.get(key); if(t) return t;
  const L=lev.near; const out=[]; if(!L){ return out; }
  const m=L.m, E0=ti*TILE, N0=tj*TILE, step=m.hres;
  for(let N=N0+step/2;N<N0+TILE;N+=step) for(let E=E0+step/2;E<E0+TILE;E+=step){
    const c=sampleArr(L,L.rh,E,N), g=sampleArr(L,L.dtm,E,N); if(c===null) continue; const can=c-g; if(can<3.0) continue;
    const n=can>6?4:3;
    for(let k=0;k<n;k++){ const r1=hsh(Math.round(E*7)+k*131,Math.round(N*13)), r2=hsh(Math.round(N*11)+k*71,Math.round(E*3)), r3=hsh(Math.round(E+N)+k,k*977);
      const e=E+(r1-0.5)*step, nn=N+(r2-0.5)*step; const gg=sampleArr(L,L.dtm,e,nn); if(gg===null) continue;
      const cc=sampleArr(L,L.rh,e,nn)-gg; if(cc<2.5) continue;
      const ht=Math.max(4,cc*(0.80+0.35*r3)); const decid=hsh(Math.round(e/90),Math.round(nn/90))>0.78?1:0;
      out.push(e,nn,gg-0.3,ht*(1+0.05*decid)+decid*0.0, decid?ht*0.40:ht*(0.25+0.07*r1), r2+decid*2.0); } }
  // shuffle (deterministic) so any prefix is an even thinning of the tile
  const cnt=out.length/6; for(let i=cnt-1;i>0;i--){ const j=Math.floor(hsh(i*31+ti,j0(tj,i))*(i+1)); for(let q=0;q<6;q++){ const tmp=out[i*6+q]; out[i*6+q]=out[j*6+q]; out[j*6+q]=tmp; } }
  t=new Float32Array(out); TC.set(key,t); if(TC.size>900) TC.delete(TC.keys().next().value); return t;
}
const _tb=G.THREE?new G.THREE.Box3():null;
function updateTrees(c){
  if(!lev.near){ trees.geometry.instanceCount=0; tmat.uniforms.treeR.value=0; return; }
  if(tmat.uniforms.treeR.value!==TREE_R) tmat.uniforms.treeR.value=TREE_R;
  const E=c.x, N=-c.z; const agl=c.y-(sampleArr(lev.near,lev.near.dtm,E,N)||0);
  // high above the trees the canopy relief is enough: no 3D trees above 1200 m AGL
  if(agl>1200){ trees.geometry.instanceCount=0; tmat.uniforms.treeR.value=0; return; }
  const key=Math.round(E/40)+','+Math.round(N/40)+','+Math.round(c.y/40)+','+_fr.planes[0].normal.x.toFixed(2)+_fr.planes[0].normal.z.toFixed(2)+_fr.planes[1].normal.x.toFixed(2);
  if(key===lastTC) return; lastTC=key;
  const R=TREE_R, t0=Math.floor((E-R)/TILE), t1=Math.floor((E+R)/TILE), u0=Math.floor((N-R)/TILE), u1=Math.floor((N+R)/TILE);
  let n=0; const buf=treeBuf;
  for(let tj=u0;tj<=u1;tj++) for(let ti=t0;ti<=t1;ti++){
    const cx=Math.max(ti*TILE,Math.min(E,(ti+1)*TILE)), cz=Math.max(tj*TILE,Math.min(N,(tj+1)*TILE)); if(Math.hypot(cx-E,cz-N)>R) continue;
    _tb.min.set(ti*TILE,-100,-(tj+1)*TILE); _tb.max.set((ti+1)*TILE,2500,-tj*TILE); if(!_fr.intersectsBox(_tb)) continue;
    const a=tileTrees(ti,tj); const td=Math.hypot((ti+0.5)*TILE-E,(tj+0.5)*TILE-N), fr=td<R*0.45?1:td<R*0.7?0.6:0.4;
    const k=Math.min(Math.floor(a.length/6*fr)*6,(MAXT-n)*6); buf.set(a.subarray(0,k),n*6); n+=k/6; if(n>=MAXT) break; }
  treeAttr.needsUpdate=true; treeAttr.updateRange={offset:0,count:n*6};
  trees.geometry.instanceCount=n;
}
function buildTrees(){
  // two-tier cone, 6 sides: 12 triangles; unit height, unit radius at the base
  const P=[], Nm=[], sides=5, tiers=[[0.05,1.0,0.62,0.55],[0.42,0.70,1.0,0.0]];
  for(const [y0,r0,y1,r1] of tiers) for(let i=0;i<sides;i++){
    const a0=i/sides*Math.PI*2, a1=(i+1)/sides*Math.PI*2, am=(a0+a1)/2, ny=(r0-r1)/(y1-y0)*0.5;
    const v=[[Math.cos(a0)*r0,y0,Math.sin(a0)*r0],[Math.cos(a1)*r0,y0,Math.sin(a1)*r0],[Math.cos(a1)*r1,y1,Math.sin(a1)*r1],[Math.cos(a0)*r1,y1,Math.sin(a0)*r1]];
    const nr=[Math.cos(am),ny,Math.sin(am)];
    P.push(...v[0],...v[2],...v[1]); Nm.push(...nr,...nr,...nr);
    if(r1>0){ P.push(...v[0],...v[3],...v[2]); Nm.push(...nr,...nr,...nr); }
  }
  const g=new (T().InstancedBufferGeometry)();
  g.setAttribute('position',new (T().Float32BufferAttribute)(P,3)); g.setAttribute('normal',new (T().Float32BufferAttribute)(Nm,3));
  treeBuf=new Float32Array(MAXT*6); treeAttr=new (T().InstancedInterleavedBuffer)(treeBuf,6); treeAttr.setUsage(T().DynamicDrawUsage);
  g.setAttribute('tp',new (T().InterleavedBufferAttribute)(treeAttr,3,0)); g.setAttribute('ts',new (T().InterleavedBufferAttribute)(treeAttr,3,3));
  g.instanceCount=0; g.boundingSphere=new (T().Sphere)(new (T().Vector3)(),1e7);
  const m=new (T().ShaderMaterial)({uniforms:{camW:{value:new (T().Vector3)()},treeR:{value:TREE_R},sunDir:{value:new (T().Vector3)()},sunCol:{value:new (T().Color)()},skyCol:{value:new (T().Color)()},horCol:{value:new (T().Color)()},amb:{value:0.5},fogD:{value:0},expo:{value:1},night:{value:0}},
    vertexShader:`attribute vec3 tp; attribute vec3 ts; uniform vec3 camW; uniform float treeR; varying vec3 vN; varying vec3 vW; varying float vY; varying float vV; varying float vD;
      void main(){
        vec3 base=vec3(tp.x,tp.z,-tp.y); float d=distance(base.xz,camW.xz);
        float grow=smoothstep(treeR,treeR*0.72,d);
        float a=fract(ts.z)*6.2831; float ca=cos(a), sa=sin(a);
        vec3 p=position; p.xz=mat2(ca,-sa,sa,ca)*p.xz;
        float dec=step(1.5,ts.z);
        if(dec>0.5){ p.y=0.12+p.y*0.88; p.xz*=1.0+0.35*sin(p.y*3.1416); }       // rounder crown for broadleaf trees
        vec3 w=base+vec3(p.x*ts.y,p.y*ts.x*grow,p.z*ts.y);
        vN=normal; vN.xz=mat2(ca,-sa,sa,ca)*vN.xz; vW=w; vY=position.y; vV=fract(ts.z*7.31)+dec*2.0; vD=d;
        gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0);
      }`,
    fragmentShader:`${COMMON} uniform vec3 camW; varying vec3 vN; varying vec3 vW; varying float vY; varying float vV; varying float vD;
      void main(){
        vec3 N=normalize(vN); float dec=step(1.5,vV); float v=fract(vV);
        vec3 c=mix(lin(vec3(0.10,0.17,0.10))*(0.8+0.4*v), lin(vec3(0.20,0.28,0.12))*(0.8+0.4*v), dec);
        float ndl=max(dot(N,sunDir)*0.8+0.2,0.0);
        float ao=0.45+0.55*smoothstep(0.0,0.9,vY);
        vec3 lit=(sunCol*ndl*smoothstep(-0.05,0.08,sunDir.y)*0.85+skyCol*amb*2.0*(0.6+0.4*N.y)+horCol*amb*0.3)*ao;
        gl_FragColor=vec4(tone(aerial(c*lit,vW,camW)),1.0);
      }`});
  trees=new (T().Mesh)(g,m); trees.frustumCulled=false; trees.name='trees'; group.add(trees);
}

/* ---------- sky ---------- */
function buildSky(){
  const g=new (T().SphereGeometry)(1,48,24);
  const m=new (T().ShaderMaterial)({uniforms:{sunDir:{value:new (T().Vector3)()},sunCol:{value:new (T().Color)()},skyCol:{value:new (T().Color)()},horCol:{value:new (T().Color)()},amb:{value:0},fogD:{value:0},expo:{value:1},night:{value:0},
      tDet:{value:detailTex}, time:{value:0}, cover:{value:0.535}},
    vertexShader:`varying vec3 vD; void main(){ vD=position; vec4 p=projectionMatrix*viewMatrix*vec4(position*200000.0+cameraPosition,1.0); gl_Position=p.xyww; }`,
    fragmentShader:`${COMMON} uniform sampler2D tDet; uniform float time; uniform float cover; uniform float night; varying vec3 vD;
      float cl(vec2 p){ float n=texture2D(tDet,p/52000.0).a*0.50+texture2D(tDet,p/17000.0+0.31).r*0.30+texture2D(tDet,p/5200.0+0.73).g*0.14+texture2D(tDet,p/1500.0+0.19).r*0.06; return n; }
      void main(){ vec3 d=normalize(vD); vec3 c=skyAt(d); float s=dot(d,sunDir);
        c+=sunCol*smoothstep(0.9996,0.99985,s)*8.0*step(0.0,sunDir.y+0.02);
        if(d.y>0.015){
          // a cumulus layer at ~1 800 m: two lookups for density, one towards the sun for light and shade
          float t=(1800.0-cameraPosition.y)/d.y; vec2 p=cameraPosition.xz+d.xz*t+vec2(time*4.0,time*1.5);
          float n=cl(p); float dens=smoothstep(cover,cover+0.16,n);
          if(dens>0.0){
            float ns=cl(p+normalize(sunDir.xz+1e-4)*350.0); float shade=clamp((n-ns)*4.0+0.55,0.0,1.0);
            float sv=smoothstep(-0.08,0.1,sunDir.y);
            vec3 lit=sunCol*(0.35+0.65*shade)*sv*0.55+skyCol*amb*1.6+horCol*amb*0.6;
            vec3 base=mix(vec3(0.62,0.66,0.74),vec3(1.0),shade)*(0.25+0.75*sv)+vec3(0.02,0.025,0.04)*night;
            vec3 cc=base*lit*1.25;
            cc+=sunCol*pow(max(s,0.0),12.0)*0.35*sv*(1.0-dens*0.5);                   // silver lining towards the sun
            float far=smoothstep(0.015,0.25,d.y);
            c=mix(c,mix(horCol*0.9+cc*0.2,cc,far),dens*(0.55+0.45*far));
          }
        }
        gl_FragColor=vec4(tone(c),1.0); }`,
    side:T().BackSide,depthWrite:false,depthTest:true});
  sky=new (T().Mesh)(g,m); sky.frustumCulled=false; sky.renderOrder=-10; sky.name='sky'; group.add(sky);
}

/* ---------- buildings: chart footprints + lidar houses, one merged mesh ---------- */
function buildBuildings(){
  const P=[],Nn=[],Cc=[],K=[];
  const tri=(a,b,c,col,k,base)=>{ const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2], vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const q=1/(Math.hypot(nx,ny,nz)||1); nx*=q;ny*=q;nz*=q;
    for(const p of [a,b,c]){ P.push(p[0],p[1],p[2]); Nn.push(nx,ny,nz); Cc.push(col[0],col[1],col[2]); K.push(k,base); } };
  const W3=(E,h,N)=>[E,h,-N];
  const walls=[[0.78,0.78,0.76],[0.70,0.71,0.72],[0.62,0.64,0.66],[0.82,0.80,0.74],[0.55,0.57,0.60]];
  const houseW=[[0.86,0.84,0.78],[0.62,0.22,0.16],[0.88,0.86,0.80],[0.80,0.70,0.48],[0.40,0.44,0.40]];
  const roofs=[[0.24,0.24,0.26],[0.42,0.20,0.16],[0.34,0.35,0.36],[0.30,0.18,0.14]];
  casters=[];
  const stands=(apt.rwy.stands||[]).filter(st=>+st.id<20);
  const near=(x,y,dmax)=>stands.some(st=>Math.hypot(st.E-x,st.N-y)<dmax);
  apt.buildings.forEach((b,bi)=>{
    const p=b.p, n=p.length; let kind=b.k||0;
    if(kind===1){ let cx=0,cy=0,ar=0; for(let i=0;i<n;i++){ cx+=p[i][0]/n; cy+=p[i][1]/n; const a=p[i],c=p[(i+1)%n]; ar+=a[0]*c[1]-c[0]*a[1]; } ar=Math.abs(ar)/2;
      const ht=b.e-b.b; kind=near(cx,cy,95)&&ar>250?5:(ar>1400&&ht<17?4:1); }
    if(b.p.length>=3) casters.push({p:b.p,h:Math.max(0,(b.r+b.e)/2-b.b-0.3)}); let area=0; for(let i=0;i<n;i++){ const a=p[i],c=p[(i+1)%n]; area+=a[0]*c[1]-c[0]*a[1]; }
    const ccw=area>0, wall=kind===5?[0.62,0.64,0.66]:kind===4?[0.86,0.87,0.88]:kind?walls[bi%walls.length]:houseW[bi%houseW.length], roof=kind?[0.30,0.31,0.32]:roofs[(bi*7)%roofs.length];
    for(let i=0;i<n;i++){ let a=p[i], c=p[(i+1)%n]; if(!ccw){ const t=a; a=c; c=t; }
      tri(W3(a[0],b.b,a[1]),W3(c[0],b.b,c[1]),W3(c[0],b.e,c[1]),wall,kind,b.b); tri(W3(a[0],b.b,a[1]),W3(c[0],b.e,c[1]),W3(a[0],b.e,a[1]),wall,kind,b.b); }
    if(kind===5){                                                         // flat roof cantilevered 3.5 m beyond the glass wall, dark fascia
      const OV=3.5, T0=b.e-0.75, CC=[0.28,0.29,0.31];
      for(let i=0;i<n;i++){ let a=p[i], c=p[(i+1)%n]; if(!ccw){ const t=a; a=c; c=t; }
        const dx=c[0]-a[0], dy=c[1]-a[1], L=Math.hypot(dx,dy); if(L<4) continue; const ox=dy/L*OV, oy=-dx/L*OV;     // outward (right of a ccw edge)
        const q=[a,c,[c[0]+ox,c[1]+oy],[a[0]+ox,a[1]+oy]];
        tri(W3(q[0][0],b.e,q[0][1]),W3(q[1][0],b.e,q[1][1]),W3(q[2][0],b.e,q[2][1]),CC,-1,b.b); tri(W3(q[0][0],b.e,q[0][1]),W3(q[2][0],b.e,q[2][1]),W3(q[3][0],b.e,q[3][1]),CC,-1,b.b);
        tri(W3(q[2][0],T0,q[2][1]),W3(q[1][0],T0,q[1][1]),W3(q[0][0],T0,q[0][1]),[0.55,0.56,0.58],-1,b.b); tri(W3(q[3][0],T0,q[3][1]),W3(q[2][0],T0,q[2][1]),W3(q[0][0],T0,q[0][1]),[0.55,0.56,0.58],-1,b.b);
        tri(W3(q[3][0],T0,q[3][1]),W3(q[2][0],T0,q[2][1]),W3(q[2][0],b.e,q[2][1]),CC,-1,b.b); tri(W3(q[3][0],T0,q[3][1]),W3(q[2][0],b.e,q[2][1]),W3(q[3][0],b.e,q[3][1]),CC,-1,b.b);
        casters.push({p:q,h:b.e-b.b,z0:b.e-b.b-0.75}); }
    }
    let L01_=n===4?Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]):0, L12_=n===4?Math.hypot(p[2][0]-p[1][0],p[2][1]-p[1][1]):0;
    if(b.a&&n===4){                             // hangar: barrel roof across the short side, white gable ends
      const q=L01_>=L12_?[0,1,2,3]:[1,2,3,0]; const A=p[q[0]],B=p[q[1]],C=p[q[2]],D=p[q[3]];
      const rise=b.a, S=14, RC=[0.30,0.31,0.33];
      const at=(P0,P1,t)=>[P0[0]+(P1[0]-P0[0])*t,P0[1]+(P1[1]-P0[1])*t], zt=t=>b.e+rise*Math.sin(Math.PI*t);
      for(let i=0;i<S;i++){ const t0=i/S, t1=(i+1)/S; const a0=at(A,D,t0), a1=at(A,D,t1), b0=at(B,C,t0), b1=at(B,C,t1);
        const x=W3(a0[0],zt(t0),a0[1]), y=W3(b0[0],zt(t0),b0[1]), z=W3(b1[0],zt(t1),b1[1]), w=W3(a1[0],zt(t1),a1[1]);
        tri(x,y,z,RC,-1,b.b); tri(x,z,w,RC,-1,b.b); tri(z,y,x,RC,-1,b.b); tri(w,z,x,RC,-1,b.b);
        for(const [P0,P1] of [[A,D],[B,C]]){ const m=at(P0,P1,0.5), e0=at(P0,P1,t0), e1=at(P0,P1,t1);
          const u=W3(m[0],b.e,m[1]), g0=W3(e0[0],zt(t0),e0[1]), g1=W3(e1[0],zt(t1),e1[1]); tri(u,g0,g1,wall,4,b.b); tri(g1,g0,u,wall,4,b.b); } }
      casters.push({p:[A,B,C,D],h:b.e-b.b+rise*0.7});
    }
    else if(b.r>b.e+0.2&&n===4){
      const L01=Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]), L12=Math.hypot(p[2][0]-p[1][0],p[2][1]-p[1][1]);
      const q=L01>=L12?[0,1,2,3]:[1,2,3,0]; const A=p[q[0]],B=p[q[1]],C=p[q[2]],D=p[q[3]];
      const m1=[(A[0]+D[0])/2,(A[1]+D[1])/2], m2=[(B[0]+C[0])/2,(B[1]+C[1])/2];
      for(const [a,bb,r2,r1] of [[A,B,m2,m1],[C,D,m1,m2]]){
        const x=W3(a[0],b.e,a[1]), y=W3(bb[0],b.e,bb[1]), z=W3(r2[0],b.r,r2[1]), w=W3(r1[0],b.r,r1[1]);
        tri(x,y,z,roof,-1,b.b); tri(x,z,w,roof,-1,b.b); tri(z,y,x,roof,-1,b.b); tri(w,z,x,roof,-1,b.b); }
      tri(W3(A[0],b.e,A[1]),W3(D[0],b.e,D[1]),W3(m1[0],b.r,m1[1]),wall,-2,b.b); tri(W3(m1[0],b.r,m1[1]),W3(D[0],b.e,D[1]),W3(A[0],b.e,A[1]),wall,-2,b.b);
      tri(W3(B[0],b.e,B[1]),W3(C[0],b.e,C[1]),W3(m2[0],b.r,m2[1]),wall,-2,b.b); tri(W3(m2[0],b.r,m2[1]),W3(C[0],b.e,C[1]),W3(B[0],b.e,B[1]),wall,-2,b.b);
    } else {
      const shape=p.map(v=>new (T().Vector2)(v[0],v[1])); const tris=T().ShapeUtils.triangulateShape(shape,[]);
      for(const t of tris){ const a=p[t[0]],bb=p[t[1]],c=p[t[2]]; tri(W3(a[0],b.e,a[1]),W3(bb[0],b.e,bb[1]),W3(c[0],b.e,c[1]),roof,-1,b.b); tri(W3(c[0],b.e,c[1]),W3(bb[0],b.e,bb[1]),W3(a[0],b.e,a[1]),roof,-1,b.b); }
    }
  });
  // apron flood-light masts: 0.45 m pole, 2.4 m wide head at 22 m
  const box=(E,N,h0,h1,hw,col,k)=>{ const c=[[E-hw,N-hw],[E+hw,N-hw],[E+hw,N+hw],[E-hw,N+hw]];
    for(let i=0;i<4;i++){ const a=c[i], d=c[(i+1)%4]; tri(W3(a[0],h0,a[1]),W3(d[0],h0,d[1]),W3(d[0],h1,d[1]),col,k,h0); tri(W3(a[0],h0,a[1]),W3(d[0],h1,d[1]),W3(a[0],h1,a[1]),col,k,h0); }
    tri(W3(c[0][0],h1,c[0][1]),W3(c[2][0],h1,c[2][1]),W3(c[1][0],h1,c[1][1]),col,-1,h0); tri(W3(c[0][0],h1,c[0][1]),W3(c[3][0],h1,c[3][1]),W3(c[2][0],h1,c[2][1]),col,-1,h0);
    tri(W3(c[0][0],h0,c[0][1]),W3(c[1][0],h0,c[1][1]),W3(c[2][0],h0,c[2][1]),col,3,h0); tri(W3(c[0][0],h0,c[0][1]),W3(c[2][0],h0,c[2][1]),W3(c[3][0],h0,c[3][1]),col,3,h0); };
  const strut=(a,b2,w,col)=>{ const dx=b2[0]-a[0], dz=b2[2]-a[2], L=Math.hypot(dx,dz)||1; const ox=-dz/L*w, oz=dx/L*w;     // thin two-sided ribbon
    const p1=[a[0]+ox,a[1],a[2]+oz], p2=[a[0]-ox,a[1],a[2]-oz], p3=[b2[0]-ox,b2[1],b2[2]-oz], p4=[b2[0]+ox,b2[1],b2[2]+oz];
    tri(p1,p2,p3,col,2,0); tri(p1,p3,p4,col,2,0); tri(p3,p2,p1,col,2,0); tri(p4,p3,p1,col,2,0);
    const q1=[a[0],a[1]-w,a[2]], q2=[a[0],a[1]+w,a[2]], q3=[b2[0],b2[1]+w,b2[2]], q4=[b2[0],b2[1]-w,b2[2]];
    tri(q1,q2,q3,col,2,0); tri(q1,q3,q4,col,2,0); tri(q3,q2,q1,col,2,0); tri(q4,q3,q1,col,2,0); };
  for(const m of (apt.rwy.masts||[])){ casters.push({p:[[m[0]-0.5,m[1]-0.5],[m[0]+0.5,m[1]-0.5],[m[0]+0.5,m[1]+0.5],[m[0]-0.5,m[1]+0.5]],h:22});
    const MC=[0.50,0.50,0.49], H=21.6, leg=(i,z)=>{ const hw=0.75-0.4*z/H, sx=(i&1)?1:-1, sy=(i&2)?1:-1; return [m[0]+sx*hw, m[2]+z, -(m[1]+sy*hw)]; };
    for(let i=0;i<4;i++) strut(leg(i,0),leg(i,H),0.05,MC);
    const ring=[0,1,3,2]; for(let k=0;k<8;k++){ const z0=k*H/8, z1=(k+1)*H/8;
      for(let j=0;j<4;j++){ const i0=ring[j], i1=ring[(j+1)%4]; strut(leg(i0,z0),leg(i1,z1),0.025,MC); if(k%2===0) strut(leg(i0,z1),leg(i1,z1),0.025,MC); } }
    box(m[0],m[1],m[2]+21.6,m[2]+22.4,1.2,[0.30,0.31,0.33],2); }
  { const TE=-393, TN=850, segs=12; let tg=W.height(TE,TN);                // ground: the lidar base of the buildings around it (fine terrain may not be loaded yet)
    { const nb=apt.buildings.filter(b=>b.p.some(q=>Math.hypot(q[0]-TE,q[1]-TN)<45)).map(b=>b.b); if(nb.length) tg=Math.min(...nb)+0.3; }
    const ring=(r,h0,h1,col,k)=>{ for(let i=0;i<segs;i++){ const a0=i/segs*Math.PI*2, a1=(i+1)/segs*Math.PI*2;
      const A=[TE+Math.cos(a0)*r,TN+Math.sin(a0)*r], B=[TE+Math.cos(a1)*r,TN+Math.sin(a1)*r];
      tri(W3(A[0],h0,A[1]),W3(B[0],h0,B[1]),W3(B[0],h1,B[1]),col,k,h0); tri(W3(A[0],h0,A[1]),W3(B[0],h1,B[1]),W3(A[0],h1,A[1]),col,k,h0);
      tri(W3(B[0],h1,B[1]),W3(B[0],h0,B[1]),W3(A[0],h0,A[1]),col,k,h0); } };
    const disc=(r,h,col)=>{ for(let i=0;i<segs;i++){ const a0=i/segs*Math.PI*2, a1=(i+1)/segs*Math.PI*2;
      tri(W3(TE,h,TN),W3(TE+Math.cos(a1)*r,h,TN+Math.sin(a1)*r),W3(TE+Math.cos(a0)*r,h,TN+Math.sin(a0)*r),col,-1,h);
      tri(W3(TE,h,TN),W3(TE+Math.cos(a0)*r,h,TN+Math.sin(a0)*r),W3(TE+Math.cos(a1)*r,h,TN+Math.sin(a1)*r),col,-1,h); } };
    ring(3.2,tg,tg+21,[0.82,0.82,0.80],1); ring(5.2,tg+21,tg+21.8,[0.30,0.31,0.33],-1); disc(5.2,tg+21.8,[0.30,0.31,0.33]);
    ring(4.8,tg+21.8,tg+25.4,[0.25,0.28,0.30],6); ring(5.4,tg+25.4,tg+26.3,[0.30,0.31,0.33],-1); disc(5.4,tg+26.3,[0.34,0.35,0.36]);
    box(TE,TN,tg+26.3,tg+31,0.08,[0.7,0.7,0.7],2);
    casters.push({p:[[TE-3.2,TN-3.2],[TE+3.2,TN-3.2],[TE+3.2,TN+3.2],[TE-3.2,TN+3.2]],h:26}); }
  // ---- apron life: parked aircraft, ground equipment, roof plant (simple geometry, ~6k triangles in all) ----
  const hAt=(E,N)=>W.height(E,N);
  // oriented box in an aircraft/stand frame: centre (a forward, b right, z up), size (L along f, Wd across, Ht)
  const obox=(o,f,a,b,z,L,Wd,Ht,col,pitch)=>{ const r=[f[1],-f[0]]; pitch=pitch||0;
    const P8=[]; for(const sx of [-1,1]) for(const sy of [-1,1]) for(const sz of [-1,1]){ const la=a+sx*L/2, lb=b+sy*Wd/2, lz=z+sz*Ht/2+sx*L/2*Math.tan(pitch);
      P8.push(W3(o[0]+f[0]*la+r[0]*lb, o[2]+lz, o[1]+f[1]*la+r[1]*lb)); }
    const F=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
    for(const q of F){ tri(P8[q[0]],P8[q[1]],P8[q[2]],col,-1,0); tri(P8[q[0]],P8[q[2]],P8[q[3]],col,-1,0); } };
  // tube along the aircraft axis from a0 to a1 (forward metres), radius r0->r1, centre height z, optional vertical offset at the ends
  const tube=(o,f,a0,a1,r0,r1,z0,z1,seg,col,b,ry)=>{ const r=[f[1],-f[0]]; b=b||0; ry=ry||1;
    const ring=(a,rad,z)=>{ const out=[]; for(let i=0;i<seg;i++){ const t=i/seg*Math.PI*2; const lb=b+Math.cos(t)*rad, lz=z+Math.sin(t)*rad*ry;
      out.push(W3(o[0]+f[0]*a+r[0]*lb, o[2]+lz, o[1]+f[1]*a+r[1]*lb)); } return out; };
    const A=ring(a0,r0,z0), B=ring(a1,r1,z1);
    const nrm=i=>{ const t=i/seg*Math.PI*2; const lb=Math.cos(t), lz=Math.sin(t)*ry; return [r[0]*lb, lz, -(r[1]*lb)]; };
    const triS=(p1,p2,p3,n1,n2,n3)=>{ for(const [pp,nn] of [[p1,n1],[p2,n2],[p3,n3]]){ P.push(pp[0],pp[1],pp[2]); const k=1/Math.hypot(nn[0],nn[1],nn[2]); Nn.push(nn[0]*k,nn[1]*k,nn[2]*k); Cc.push(col[0],col[1],col[2]); K.push(-1,0); } };
    for(let i=0;i<seg;i++){ const j=(i+1)%seg, ni=nrm(i), nj=nrm(j);
      triS(A[i],B[j],B[i],ni,nj,ni); triS(A[i],A[j],B[j],ni,nj,nj); } };
  const wing=(o,f,aRoot,span,chordR,chordT,sweep,z,dih,col,side,thick)=>{ const r=[f[1],-f[0]];
    const P=(a,b,zz)=>W3(o[0]+f[0]*a+r[0]*b, o[2]+zz, o[1]+f[1]*a+r[1]*b);
    const b0=side*1.7, b1=side*span; const zt=z+span*Math.tan(dih);
    const LR=P(aRoot,b0,z), TR=P(aRoot-chordR,b0,z), LT=P(aRoot-sweep,b1,zt), TT=P(aRoot-sweep-chordT,b1,zt);
    const up=(p)=>[p[0],p[1]+thick,p[2]];
    for(const [a,b2,c,d] of [[LR,LT,TT,TR],[up(LR),up(TR),up(TT),up(LT)]]){ tri(a,b2,c,col,-1,0); tri(a,c,d,col,-1,0); tri(c,b2,a,col,-1,0); tri(d,c,a,col,-1,0); } };
  FLEETI=[];
  const airliner=(st,ci)=>{ const h=st.hdg*Math.PI/180, f=[Math.sin(h),Math.cos(h)];
    const g=st.elev!=null?st.elev:hAt(st.E,st.N); const o=[st.E,st.N,g];   // nose gear on the stop point; lidar elevation (the fine terrain may not be loaded yet)
    FLEETI.push({type:'a320',E:st.E,N:st.N,g,h,liv:ci});
    { const r=[f[1],-f[0]], L=(a,b)=>[o[0]+f[0]*a+r[0]*b,o[1]+f[1]*a+r[1]*b];
      casters.push({p:[L(5.0,0),L(3.0,-1.7),L(0.0,-1.98),L(-27,-1.98),L(-32.5,-0.3),L(-32.5,0.3),L(-27,1.98),L(0,1.98),L(3.0,1.7)],h:6.0,z0:2.0});
      for(const sd of [-1,1]){ casters.push({p:[L(-8.6,sd*1.5),L(-17.2,sd*16.4),L(-18.75,sd*16.4),L(-15.8,sd*1.5)],h:3.2,z0:2.6});
        casters.push({p:[L(-6.3,sd*4.7),L(-6.3,sd*6.8),L(-10.6,sd*6.8),L(-10.6,sd*4.7)],h:2.6,z0:0.6});
        casters.push({p:[L(-28.6,sd*0.6),L(-31.9,sd*6.2),L(-33.25,sd*6.2),L(-32.3,sd*0.6)],h:5.0,z0:4.6}); }
      casters.push({p:[L(-27.4,-0.2),L(-33.4,-0.2),L(-34.7,0.2),L(-27.4,0.2)],h:11.8,z0:5.9}); }
    // ground equipment: stairs at L1, tug ahead, GPU at the nose, belt loader + carts at the aft hold, fuel truck clear of the wing
    const WH=[0.06,0.06,0.07], HUB=[0.55,0.56,0.58], GL=[0.08,0.10,0.12], BLK=[0.10,0.10,0.11], ORG=[1.0,0.45,0.05];
    // cylinder across the vehicle (axis = right vector): tyres, hubs
    const cylX=(a,b,z,rad,wd,col,seg)=>{ seg=seg||10; const r=[f[1],-f[0]];
      const pt=(t,lb)=>W3(o[0]+f[0]*(a+Math.cos(t)*rad)+r[0]*lb, o[2]+z+Math.sin(t)*rad, o[1]+f[1]*(a+Math.cos(t)*rad)+r[1]*lb);
      for(let i=0;i<seg;i++){ const t0=i/seg*Math.PI*2, t1=(i+1)/seg*Math.PI*2;
        tri(pt(t0,b-wd/2),pt(t1,b-wd/2),pt(t1,b+wd/2),col,-1,0); tri(pt(t0,b-wd/2),pt(t1,b+wd/2),pt(t0,b+wd/2),col,-1,0);
        tri(pt(t1,b+wd/2),pt(t1,b-wd/2),pt(t0,b-wd/2),col,-1,0); tri(pt(t0,b+wd/2),pt(t1,b+wd/2),pt(t0,b-wd/2),col,-1,0);
        for(const sd of [-1,1]){ const c=W3(o[0]+f[0]*a+r[0]*(b+sd*wd/2), o[2]+z, o[1]+f[1]*a+r[1]*(b+sd*wd/2));
          tri(c,pt(t0,b+sd*wd/2),pt(t1,b+sd*wd/2),WH,-1,0); tri(pt(t1,b+sd*wd/2),pt(t0,b+sd*wd/2),c,WH,-1,0); } }
      for(const sd of [-1,1]) obox(o,f,a,b+sd*(wd/2+0.01),z,rad*0.9,0.02,rad*0.9,HUB); };
    const wheels=(a,b,L,Wd,r)=>{ for(const sa of [-1,1]) for(const sb of [-1,1]) cylX(a+sa*L*0.32,b+sb*(Wd/2-0.14),r,r,0.3,WH); };
    const beacon=(a,b,z)=>obox(o,f,a,b,z,0.22,0.22,0.16,ORG);
    const rail=(a,b,z,L,ht,pitch)=>{ obox(o,f,a,b,z+ht,L,0.05,0.05,[0.80,0.80,0.80],pitch); for(let k=0;k<4;k++){ const da=-L/2+k*L/3; obox(o,f,a+da,b,z+ht/2+da*Math.tan(pitch||0),0.04,0.04,ht,[0.80,0.80,0.80]); } };
    const veh=(type,a,b,col)=>{
      if(type==='tug'){ wheels(a,b,4.4,2.2,0.45); obox(o,f,a,b,0.95,4.4,2.2,0.85,col); obox(o,f,a,b,1.40,4.5,2.25,0.06,BLK);
        obox(o,f,a+2.25,b,0.75,0.12,2.0,0.35,BLK);                                       // push bumper
        obox(o,f,a-1.3,b,1.90,1.5,2.0,1.0,col); obox(o,f,a-0.62,b,2.05,0.08,1.84,0.62,GL); obox(o,f,a-1.3,b,2.05,1.3,2.04,0.55,GL);
        obox(o,f,a-1.3,b,2.44,1.6,2.1,0.08,col); beacon(a-1.3,b,2.56); }
      if(type==='gpu'){ wheels(a,b,1.8,1.3,0.27); obox(o,f,a,b,1.0,2.0,1.25,1.05,col); obox(o,f,a,b,1.56,2.1,1.32,0.08,[0.25,0.25,0.26]);
        obox(o,f,a+1.05,b,0.55,0.5,0.08,0.06,BLK); for(const sb of [-1,1]) obox(o,f,a,b+sb*0.63,1.0,1.5,0.02,0.7,[0.22,0.22,0.24]);
        obox(o,f,a+1.4,b+0.5,0.04,2.4,0.07,0.07,BLK); obox(o,f,a+2.65,b+1.3,0.04,0.07,1.6,0.07,BLK); }          // cable to the nose
      if(type==='stairs'){ wheels(a,b,5.0,2.0,0.42); obox(o,f,a,b,0.95,5.2,2.0,0.9,col); obox(o,f,a+1.7,b,1.95,1.5,1.9,1.1,col); obox(o,f,a+2.2,b,2.1,0.08,1.7,0.6,GL); obox(o,f,a+1.7,b,2.1,1.2,1.92,0.5,GL);
        beacon(a+1.7,b,2.58);
        for(let k=0;k<9;k++){ const da=-1.9+k*0.42; obox(o,f,a+da,b+0.9,1.55+k*0.27,0.30,1.2,0.05,[0.62,0.62,0.64]); }
        obox(o,f,a-0.2,b+0.9,2.45,3.9,1.2,0.12,[0.48,0.48,0.50],-0.62);
        for(const sb of [0.28,1.52]) rail(a-0.2,b+sb,2.5,3.6,0.95,-0.62);
        obox(o,f,a-2.6,b+0.9,4.05,1.3,1.4,0.12,[0.62,0.62,0.64]); rail(a-2.6,b+1.6,4.05,1.3,1.0,0); }
      if(type==='cart'){ wheels(a,b,2.6,1.6,0.24); obox(o,f,a,b,0.56,3.0,1.6,0.10,[0.35,0.36,0.38]); obox(o,f,a,b,2.05,3.1,1.7,0.06,col);
        for(const sa of [-1,1]) for(const sb of [-1,1]) obox(o,f,a+sa*1.48,b+sb*0.8,1.3,0.06,0.06,1.5,[0.5,0.5,0.52]);
        obox(o,f,a-1.5,b,1.3,0.04,1.62,1.4,col); obox(o,f,a,b+0.8,1.55,3.0,0.03,0.95,[0.20,0.30,0.55]);           // tarp on one side
        obox(o,f,a,b-0.1,0.95,1.2,0.8,0.7,[0.25,0.22,0.20]); obox(o,f,a+0.9,b+0.3,0.85,0.7,0.6,0.5,[0.15,0.18,0.30]);  // bags
        obox(o,f,a+1.95,b,0.45,1.0,0.07,0.06,BLK); }
      if(type==='belt'){ wheels(a,b,4.2,1.9,0.36); obox(o,f,a,b,0.8,4.4,1.9,0.7,col); obox(o,f,a+0.6,b,1.6,6.2,0.9,0.12,BLK,0.25);
        for(const sb of [-0.48,0.48]) obox(o,f,a+0.6,b+sb,1.78,6.2,0.05,0.2,[0.75,0.75,0.75],0.25);
        obox(o,f,a-1.4,b+0.55,1.75,1.1,0.85,1.1,col); obox(o,f,a-1.0,b+0.55,1.95,0.06,0.75,0.6,GL); beacon(a-1.4,b+0.55,2.36); }
      if(type==='fuel'){ wheels(a,b,9.0,2.5,0.52); cylX(a-0.9,b,0.52,0.52,2.2,WH);
        obox(o,f,a+3.7,b,1.55,2.1,2.5,1.9,col); obox(o,f,a+4.7,b,2.0,0.08,2.3,0.8,GL); obox(o,f,a+3.7,b,2.05,1.7,2.52,0.6,GL); beacon(a+3.6,b,2.6);
        obox(o,f,a-1.0,b,0.75,7.4,2.0,0.3,BLK); tube(o,f,-1.0+a+3.0,a-4.6,1.15,1.15,2.1,2.1,14,[0.92,0.92,0.90],b,1.0);
        obox(o,f,a+2.05,b,2.1,0.12,2.2,2.2,[0.88,0.88,0.86]); obox(o,f,a-1.0,b,3.3,6.6,0.7,0.08,[0.7,0.7,0.72]); obox(o,f,a-4.4,b,1.6,0.5,2.3,1.5,[0.5,0.5,0.52]);
        for(const sb of [-1,1]) obox(o,f,a-1.0,b+sb*1.18,1.0,7.0,0.04,0.25,col); }
    };
    // safety cones (nose, wingtips, tail) and wheel chocks
    const cone=(a,b)=>{ obox(o,f,a,b,0.03,0.42,0.42,0.06,ORG); obox(o,f,a,b,0.3,0.24,0.24,0.5,ORG); obox(o,f,a,b,0.38,0.2,0.2,0.1,[0.95,0.95,0.95]); obox(o,f,a,b,0.6,0.12,0.12,0.08,ORG); };
    cone(2.2,0); cone(-17.5,-18.2); cone(-17.5,18.2); cone(-34.8,0); cone(-13.0,-7.5); cone(-13.0,7.5);
    for(const [ca,cb] of [[0.75,0],[-0.75,0],[-13.0,-3.8],[-13.0,3.8]]) obox(o,f,ca,cb,0.12,0.25,0.9,0.22,[0.85,0.75,0.10]);
    veh('stairs',-1.0,-4.3,[0.92,0.92,0.90]);
    veh('tug',6.8,0,[0.86,0.68,0.10]);
    veh('gpu',3.6,-2.6,[0.84,0.60,0.12]);
    veh('belt',-21.0,3.6,[0.86,0.68,0.10]);
    for(let k=0;k<3;k++) veh('cart',-25.5-k*3.8,6.4,[0.45,0.50,0.58]);
    if(ci%3===0) veh('fuel',-9.5,10.5,[0.85,0.12,0.10]);
  };
  const ga=(st)=>{ const h=st.hdg*Math.PI/180, g=st.elev!=null?st.elev:hAt(st.E,st.N); FLEETI.push({type:'c172',E:st.E,N:st.N,g,h,liv:5});
    const f=[Math.sin(h),Math.cos(h)], r=[f[1],-f[0]], L=(a,b)=>[st.E+f[0]*a+r[0]*b,st.N+f[1]*a+r[1]*b];
    casters.push({p:[L(-0.25,-5.5),L(-0.25,5.5),L(-1.6,5.5),L(-1.6,-5.5)],h:2.4,z0:2.2}); casters.push({p:[L(1.6,-0.5),L(1.6,0.5),L(-6.6,0.15),L(-6.6,-0.15)],h:1.9,z0:0.8}); };
  const occ=['2','4','5','11','13','15'];
  let ci=0; for(const st of (apt.rwy.stands||[])){ if(occ.includes(st.id)) airliner(st,ci++); if(st.id==='33'||st.id==='34') ga(st); }
  // parked cars found in the lidar (car parks only), simple body + glasshouse; their own mesh, hidden from a distance
  const carA=P.length/3;
  { const CARC=[[0.84,0.84,0.83],[0.07,0.07,0.08],[0.58,0.59,0.61],[0.32,0.33,0.35],[0.12,0.17,0.28],[0.42,0.10,0.10],[0.17,0.22,0.20],[0.62,0.60,0.55]], GLC=[0.07,0.08,0.10], TY=[0.05,0.05,0.05];
    for(const cr of (apt.cars||[])){ const g=cr[2]; const o=[cr[0],cr[1],g], f=[Math.cos(cr[3]),Math.sin(cr[3])], col=CARC[cr[4]%8];
      const L=4.2+((cr[4]*7)%5)*0.12;
      obox(o,f,0,0,0.55,L,1.76,0.72,col); obox(o,f,-0.2,0,1.15,L*0.46,1.52,0.50,GLC); obox(o,f,-0.2,0,1.42,L*0.40,1.46,0.05,col);
      casters.push({p:[[cr[0]+f[0]*L/2+f[1]*0.9,cr[1]+f[1]*L/2-f[0]*0.9],[cr[0]+f[0]*L/2-f[1]*0.9,cr[1]+f[1]*L/2+f[0]*0.9],[cr[0]-f[0]*L/2-f[1]*0.9,cr[1]-f[1]*L/2+f[0]*0.9],[cr[0]-f[0]*L/2+f[1]*0.9,cr[1]-f[1]*L/2-f[0]*0.9]],h:1.5}); } }
  const carB=P.length/3;
  // roof plant on the larger airport buildings
  apt.buildings.forEach((b,bi)=>{ if(!b.k||b.p.length<4) return; let cx=0,cy=0; for(const q of b.p){ cx+=q[0]; cy+=q[1]; } cx/=b.p.length; cy/=b.p.length;
    let area=0; for(let i=0;i<b.p.length;i++){ const a=b.p[i],c=b.p[(i+1)%b.p.length]; area+=a[0]*c[1]-c[0]*a[1]; } area=Math.abs(area)/2; if(area<500) return;
    const n=Math.min(4,1+Math.floor(area/1500)); const f=[1,0];
    for(let k=0;k<n;k++){ const da=((bi*37+k*53)%17-8)*0.9, db=((bi*11+k*29)%13-6)*0.9; obox([cx,cy,b.e],f,da,db,0.9,4.0,2.6,1.8,[0.62,0.63,0.64]); } });
  const geo=(ranges)=>{ const gg=new (T().BufferGeometry)(), cut=(A,n)=>{ const out=[]; for(const [a,b] of ranges) for(let i=a*n;i<b*n;i++) out.push(A[i]); return out; };
    gg.setAttribute('position',new (T().Float32BufferAttribute)(cut(P,3),3)); gg.setAttribute('normal',new (T().Float32BufferAttribute)(cut(Nn,3),3));
    gg.setAttribute('color',new (T().Float32BufferAttribute)(cut(Cc,3),3)); gg.setAttribute('bk',new (T().Float32BufferAttribute)(cut(K,2),2)); gg.computeBoundingSphere(); return gg; };
  const nV=P.length/3, g=geo([[0,carA],[carB,nV]]), gCars=carB>carA?geo([[carA,carB]]):null;
  const m=new (T().ShaderMaterial)({uniforms:{camW:{value:new (T().Vector3)()},sunDir:{value:new (T().Vector3)()},sunCol:{value:new (T().Color)()},skyCol:{value:new (T().Color)()},horCol:{value:new (T().Color)()},amb:{value:0.5},fogD:{value:0},expo:{value:1},night:{value:0}},
    vertexShader:`attribute vec3 color; attribute vec2 bk; varying vec3 vC; varying vec3 vN; varying vec3 vW; varying vec2 vK; void main(){ vC=color; vN=normal; vW=position; vK=bk; gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0); }`,
    fragmentShader:`${COMMON} uniform vec3 camW; uniform float night; varying vec3 vC; varying vec3 vN; varying vec3 vW; varying vec2 vK;
      float h1(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 N=normalize(vN); vec3 c=lin(vC); float kind=vK.x; float y=vW.y-vK.y;
        vec3 V=normalize(camW-vW);
        float glass=0.0, lit=0.0;
        if(abs(N.y)<0.3&&kind>-0.5){
          float u=dot(vW.xz,vec2(-N.z,N.x));
          vec2 fu=vec2(fwidth(u),fwidth(y));
          if(kind>1.5&&kind<2.5){ c*=0.95; }                                   // masts: plain metal
          else if(kind>5.5){ glass=1.0; lit=1.0; }                              // tower cab: all glass
          else if(kind>4.5){                                                    // terminal: glass curtain wall, mullions 1.5 m, transoms per storey, fascia
            float mu=fract(u/1.5), v=fract(y/4.5), top=vW.y-vK.y;
            float mull=smoothstep(0.0,0.018+fu.x/1.5*1.5,mu)*(1.0-smoothstep(0.982-fu.x/1.5*1.5,1.0,mu));
            float tr=smoothstep(0.0,0.02+fu.y/4.5*1.5,v)*(1.0-smoothstep(0.94-fu.y/4.5*1.5,0.96,v));
            float hb=vW.y-vK.y;                                              // height above the building base
            float col9=1.0-smoothstep(0.0,0.02+fu.x/9.0*1.5,abs(fract(u/9.0)-0.5)*9.0-0.0)*0.0;
            float pier=step(abs(fract(u/9.0+0.5)-0.5)*9.0,0.35);                 // solid cladding column every 9 m
            glass=mull*tr*(1.0-pier)*step(0.6,hb);                               // dark plinth at the foot
            c=lin(vec3(0.30,0.31,0.33))*(1.0-0.45*step(hb,0.6));
            lit=step(0.45,h1(vec2(floor(u/1.5),floor(y/4.5))));
          }
          else if(kind>3.5){                                                    // hangar: vertical ribbed cladding, a band of clerestory windows
            float rib=0.5+0.5*sin(u*6.2832/0.6); c*=0.86+0.14*smoothstep(0.3,0.7,rib)*(1.0-smoothstep(0.3,0.8,fu.x/0.6));
            float hgt=y; glass=step(0.0,hgt-0.0)*smoothstep(0.0,0.02,fract((hgt+0.0)/1000.0))*0.0;
            float band=step(abs(y-(vK.y>0.0?0.0:0.0)-0.0),9999.0); float topBand=smoothstep(1.4,1.2,abs(vW.y-vK.y-10.5));
            glass=topBand*step(0.15,fract(u/2.4))*step(fract(u/2.4),0.85);
            lit=1.0;
          }
          else if(kind>0.5){                                                    // terminal / hangars: storeys of 3.8 m, window bands
            float fl=floor(y/3.8), v=fract(y/3.8), mu=fract(u/1.6);
            float band=smoothstep(0.30,0.30+fu.y/3.8*2.0,v)*(1.0-smoothstep(0.86-fu.y/3.8*2.0,0.86,v));
            float mull=smoothstep(0.0,0.06+fu.x/1.6*2.0,mu)*(1.0-smoothstep(0.94-fu.x/1.6*2.0,1.0,mu));
            glass=band*mull*step(y,vK.y+999.0);
            if(fl<0.5){ glass=max(glass,smoothstep(0.05,0.08,v)*(1.0-smoothstep(0.80,0.83,v))*mull*step(0.55,h1(vec2(floor(u/4.8),7.0)))); }
            float top=smoothstep(-0.6,-0.4,y-(floor(y/3.8+0.0001)*3.8)); c*=0.92+0.08*h1(vec2(fl,floor(u/9.6)));
            lit=step(0.45,h1(vec2(floor(u/1.6),fl)));
          } else {                                                              // houses: windows 1.2 m, every 3 m, one per storey
            float v=fract((y-0.4)/2.8), mu=fract(u/3.0);
            glass=step(0.35,v)*step(v,0.78)*step(0.32,mu)*step(mu,0.68);
            glass*=1.0-smoothstep(0.3,0.6,max(fu.x,fu.y));
            lit=step(0.6,h1(vec2(floor(u/3.0),floor(y/2.8))));
          }
          // soft dark band at the foot of every wall (contact with the ground)
          c*=0.75+0.25*smoothstep(0.0,1.2,y);
        }
        float ndl=max(dot(N,sunDir),0.0);
        vec3 lt=sunCol*ndl*smoothstep(-0.05,0.08,sunDir.y)+skyCol*amb*(0.55+0.45*N.y)*2.0+horCol*amb*0.3;
        vec3 col=c*lt;
        if(glass>0.0){
          vec3 R=reflect(-V,N); float fres=0.06+0.94*pow(1.0-max(dot(N,V),0.0),5.0);
          float pv=h1(floor(vW.xz/1.5)+floor(vW.y/4.2));
          vec3 gc=mix(lin(vec3(0.03,0.045,0.06))*(skyCol*amb*2.0+sunCol*0.10)*(0.85+0.3*pv),skyAt(normalize(vec3(R.x,abs(R.y),R.z)))*(0.93+0.07*pv),clamp(fres*0.9+0.14,0.0,1.0));
          gc+=sunCol*pow(max(dot(R,sunDir),0.0),200.0)*1.5*smoothstep(-0.05,0.08,sunDir.y);
          gc+=vec3(1.0,0.78,0.48)*lit*night*(kind>4.5?0.16:kind>3.5?0.10:0.45);
          col=mix(col,gc,glass);
        }
        if(kind>2.5&&kind<3.5) col+=vec3(1.0,0.86,0.66)*night*3.0;                    // underside of the mast heads
        gl_FragColor=vec4(tone(aerial(col,vW,camW)),1.0); }`});
  bldg=new (T().Mesh)(g,m); bldg.name='buildings'; group.add(bldg);
  if(gCars){ carsMesh=new (T().Mesh)(gCars,m); carsMesh.name='cars'; group.add(carsMesh); }
}

/* ---------- parked aircraft (fleet.js): one instanced draw per type ---------- */
function fleetUniforms(){ return {camW:{value:new (T().Vector3)()},sunDir:{value:new (T().Vector3)()},sunCol:{value:new (T().Color)()},skyCol:{value:new (T().Color)()},horCol:{value:new (T().Color)()},amb:{value:0.5},fogD:{value:0},expo:{value:1},night:{value:0},xn:{value:5.07},yc:{value:4.0}}; }
function buildFleet(){
  const F=G.FLEET; if(!F||!FLEETI.length) return;
  const api={uniforms:fleetUniforms,COMMON};
  for(const type of ['a320','c172']){
    const list=FLEETI.filter(a=>a.type===type); if(!list.length) continue;
    const extra=type==='a320'?2:0, n=list.length+extra;
    const m=F[type](), g=m.g, io=new Float32Array(n*4), il=new Float32Array(n*3), ip=new Float32Array(n*2);
    list.forEach((a,i)=>{ io.set([a.E,a.g,-a.N,a.h],i*4); il.set(F.LIV[a.liv%F.LIV.length],i*3); });
    for(let k=0;k<extra;k++){ const i=list.length+k; io.set([0,-2000,0,0],i*4); il.set(F.LIV[(k*3+1)%F.LIV.length],i*3); }
    const ioA=new (T().InstancedBufferAttribute)(io,4), ipA=new (T().InstancedBufferAttribute)(ip,2); ioA.setUsage(T().DynamicDrawUsage); ipA.setUsage(T().DynamicDrawUsage);
    g.setAttribute('io',ioA); g.setAttribute('il',new (T().InstancedBufferAttribute)(il,3)); g.setAttribute('ip',ipA);
    if(extra){ TRAF.io=ioA; TRAF.ip=ipA; TRAF.base=list.length; }
    g.instanceCount=n; g.boundingSphere=new (T().Sphere)(new (T().Vector3)(),1e7);
    const mat=F.material(api); if(type==='c172'){ mat.uniforms.xn.value=1.6; mat.uniforms.yc.value=1.35; }
    const mesh=new (T().Mesh)(g,mat); mesh.frustumCulled=false; mesh.name='fleet-'+type; group.add(mesh); fleetMats.push(mat);
  }
}

/* ---------- traffic: a departure on RWY 35 from W1 and an arrival on RWY 17 that vacates at W2 and taxies to stand 12 ---------- */
function polyPath(pts){ // Catmull-Rom smoothed path, resampled every 2 m: [{E,N,d}]
  const out=[]; const P=pts;
  for(let i=0;i<P.length-1;i++){ const p0=P[Math.max(0,i-1)], p1=P[i], p2=P[i+1], p3=P[Math.min(P.length-1,i+2)];
    const L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]), n=Math.max(2,Math.ceil(L/2));
    for(let k=0;k<n;k++){ const t=k/n, t2=t*t, t3=t2*t;
      const f=(a,b,c,d)=>0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
      out.push([f(p0[0],p1[0],p2[0],p3[0]),f(p0[1],p1[1],p2[1],p3[1])]); } }
  out.push(P[P.length-1]);
  let d=0; return out.map((q,i)=>{ if(i) d+=Math.hypot(q[0]-out[i-1][0],q[1]-out[i-1][1]); return {E:q[0],N:q[1],d}; });
}
function atDist(path,d){ d=Math.max(0,Math.min(path[path.length-1].d,d)); let lo=0,hi=path.length-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(path[m].d<d) lo=m; else hi=m; }
  const a=path[lo], b=path[hi], t=(d-a.d)/Math.max(1e-6,b.d-a.d); return {E:a.E+(b.E-a.E)*t, N:a.N+(b.N-a.N)*t, h:Math.atan2(b.E-a.E,b.N-a.N)}; }
function buildTraffic(){
  const r=apt.rwy, U=r.u, R=(s,t)=>[U[0]*s+U[1]*t, U[1]*s-U[0]*t];
  const st12=(r.stands||[]).find(x=>x.id==='12'); if(!st12) return;
  // departure: hold W1 -> line up at s=60 -> roll north
  const dep=polyPath([[-103.6,188.2],[-62,118],[-30,82],R(60,0),R(140,0),R(3200,0),R(30000,0)]);
  // arrival: final RWY 17 from the north -> touchdown 400 m past THR 17 -> W2 -> T -> taxilane -> stand 12
  const arr=polyPath([R(r.lthr+12000,0),R(r.lthr-400,0),R(880,0),R(800,0),[-40,760],[-98,684],[-150,620],[-205,563],[-245,536],[-320,533],[st12.E,534],[st12.E,505],[st12.E,st12.N]]);
  TRAF.dep=dep; TRAF.arr=arr; TRAF.cycle=600;
  // departure timeline by distance along the path: taxi 8 m/s to the line-up point, wait, then accelerate 2.1 m/s^2
  const dLine=dep.find(q=>Math.abs(q.E-R(140,0)[0])<2&&Math.abs(q.N-R(140,0)[1])<2)||dep[0];
  TRAF.depLine=atDistIndex(dep,R(140,0));
  TRAF.arrTd=atDistIndex(arr,R(r.lthr-400,0)); TRAF.arrExit=atDistIndex(arr,R(800,0));
}
function atDistIndex(path,p){ let best=0,bd=1e18; for(const q of path){ const d=Math.hypot(q.E-p[0],q.N-p[1]); if(d<bd){ bd=d; best=q.d; } } return best; }
function updateTraffic(t){
  if(!TRAF.io||!TRAF.dep) return;
  const io=TRAF.io.array, ip=TRAF.ip.array, base=TRAF.base, r=apt.rwy, c=t%TRAF.cycle, L=[];
  const put=(k,E,N,alt,h,pit,bank,show)=>{ const i=base+k; io[i*4]=E; io[i*4+1]=show?alt:-2000; io[i*4+2]=-N; io[i*4+3]=h; ip[i*2]=pit; ip[i*2+1]=bank; };
  // ---- departure (0..230 s)
  { const D=TRAF.dep, dl=TRAF.depLine; let d=0, alt=0, pit=0, v=0, show=c<230;
    if(c<dl/8){ d=c*8; v=8; } else if(c<dl/8+12){ d=dl; v=0; }
    else { const tr=c-dl/8-12; const vr=72; const tRot=vr/2.1;
      if(tr<tRot){ d=dl+0.5*2.1*tr*tr; v=2.1*tr; }
      else { const ta=tr-tRot; const d0=dl+0.5*2.1*tRot*tRot; v=vr+Math.min(ta,10)*0.8; d=d0+vr*ta+0.4*Math.min(ta,10)**2+(ta>10?8*(ta-10):0);
        pit=Math.min(1,ta/3)*8*Math.PI/180; alt=Math.max(0,ta-3)*Math.min(9,(ta-3)*3); } }
    const p=atDist(D,d), g=W.height(p.E,p.N); put(0,p.E,p.N,g+alt,p.h,pit,0,show);
    if(show) L.push({E:p.E,N:p.N,g:g+alt,h:p.h,pit,land:c>dl/8,strobe:c>dl/8+8,air:alt>1}); }
  // ---- arrival (250..600 s): 70 m/s on a 3 deg path, flare, roll-out to 12 m/s, taxi 8 m/s to stand 12
  { const A=TRAF.arr, td=TRAF.arrTd, ex=TRAF.arrExit, ta=c-250; let d=0, alt=0, pit=0, show=ta>0;
    const tFin=td/70;
    if(ta<tFin){ d=ta*70; const dist=td-d; alt=dist*Math.tan(3*Math.PI/180); pit=(dist<180?2.5+3.0*(1-dist/180):2.5)*Math.PI/180; if(dist<180) alt=Math.max(0,alt*(dist/180)*0.8+alt*0.2*(dist/180)); }
    else { const tr=ta-tFin; const tDec=(70-12)/2.2; if(tr<tDec){ d=td+70*tr-0.5*2.2*tr*tr; pit=Math.max(0,5-tr*2)*Math.PI/180; }
      else { const d1=td+70*tDec-0.5*2.2*tDec*tDec; const tt=tr-tDec; d=d1+Math.min(tt*10,Math.max(0,A[A.length-1].d-d1)); } }
    const p=atDist(A,d), g=W.height(p.E,p.N); put(1,p.E,p.N,g+alt,p.h,pit,0,show);
    if(show) L.push({E:p.E,N:p.N,g:g+alt,h:p.h,pit,land:d<ex+200,strobe:d<ex,air:alt>1}); }
  TRAF.io.needsUpdate=true; TRAF.ip.needsUpdate=true;
  updateTrafficLights(L,t);
}
function updateTrafficLights(L,t){
  if(!tlights) return; const P=tlights.geometry.attributes.position.array, C=tlights.geometry.attributes.lcol.array, D=tlights.geometry.attributes.ldir.array; let n=0;
  const add=(a,x,y,z,col,dir,spread,size)=>{ const f=[Math.sin(a.h),Math.cos(a.h)], r=[f[1],-f[0]]; const yy=y+x*Math.sin(a.pit);
    P[n*3]=a.E+f[0]*x+r[0]*z; P[n*3+1]=a.g+yy; P[n*3+2]=-(a.N+f[1]*x+r[1]*z); C.set(col,n*3);
    const dd=dir?[f[0]*dir[0]+r[0]*dir[1],f[1]*dir[0]+r[1]*dir[1]]:[0,0]; D.set([dd[0],-dd[1],Math.cos(spread*Math.PI/180),size],n*4); n++; };
  const beacon=(Math.sin(t*Math.PI*2*1.0)>0.6)?1:0, strobe=(t%1.2<0.06||(t%1.2>0.14&&t%1.2<0.2))?1:0;
  for(const a of L){
    add(a,-12,8.3,0,[beacon,0,0],null,180,1.4); add(a,-14,1.85,0,[beacon,0,0],null,180,1.4);
    add(a,-17.4,3.4,-16.6,[1,0.05,0.03],[0.4,-1],110,1.2); add(a,-17.4,3.4,16.6,[0.1,1,0.25],[0.4,1],110,1.2); add(a,-32.9,5.3,0,[1,1,1],[-1,0],140,1.0);
    if(a.strobe){ add(a,-17.6,3.4,-16.6,[strobe,strobe,strobe],null,180,2.2); add(a,-17.6,3.4,16.6,[strobe,strobe,strobe],null,180,2.2); }
    if(a.land){ add(a,-8.5,2.7,-2.6,[1,0.97,0.9],[1,0],18,3.2); add(a,-8.5,2.7,2.6,[1,0.97,0.9],[1,0],18,3.2); add(a,0.3,1.4,0,[1,0.97,0.9],[1,0],25,2.0); }
  }
  for(let i=n;i<tlights.userData.max;i++){ C.set([0,0,0],i*3); P[i*3+1]=-5000; }
  tlights.geometry.attributes.position.needsUpdate=true; tlights.geometry.attributes.lcol.needsUpdate=true; tlights.geometry.attributes.ldir.needsUpdate=true;
}

function buildTrafficLights(){
  const max=28, g=new (T().BufferGeometry)();
  g.setAttribute('position',new (T().BufferAttribute)(new Float32Array(max*3),3)); g.setAttribute('lcol',new (T().BufferAttribute)(new Float32Array(max*3),3));
  g.setAttribute('ldir',new (T().BufferAttribute)(new Float32Array(max*4),4)); g.setAttribute('lk',new (T().BufferAttribute)(new Float32Array(max*2),2));
  for(const k of ['position','lcol','ldir']) g.attributes[k].setUsage(T().DynamicDrawUsage);
  tlights=new (T().Points)(g,lights.material); tlights.frustumCulled=false; tlights.renderOrder=6; tlights.userData.max=max; group.add(tlights);
}

/* ---------- airfield details: taxiway signs at the holds, windsocks, perimeter fence ---------- */
function signAtlas(){
  // 8 sign faces in a 4x2 grid: mandatory (red/white) '35-17', '17-35'; location (black/yellow) A, B, C, W1, W2, W3
  const c=document.createElement('canvas'); c.width=1024; c.height=256; const g=c.getContext('2d');
  const faces=[['35-17','m'],['17-35','m'],['A','l'],['B','l'],['C','l'],['W1','l'],['W2','l'],['W3','l']];
  faces.forEach(([t,k],i)=>{ const x=(i%4)*256, y=Math.floor(i/4)*128;
    g.fillStyle=k==='m'?'#c8102e':'#111'; g.fillRect(x,y,256,128);
    g.strokeStyle=k==='m'?'#fff':'#f5c400'; g.lineWidth=k==='m'?0:8; if(k!=='m') g.strokeRect(x+14,y+14,228,100);
    g.fillStyle=k==='m'?'#fff':'#f5c400'; g.font='bold 78px Arial, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,x+128,y+68); });
  const t=new (T().CanvasTexture)(c); t.flipY=false; t.anisotropy=8; t.minFilter=T().LinearMipmapLinearFilter; return {t,idx:Object.fromEntries(faces.map((f,i)=>[f[0],i]))};
}
function buildDetails(){
  const P=[],Nn=[],UV=[],K=[];
  const W3=(E,h,N)=>[E,h,-N];
  const quad=(a,b,c,d,n,uv,k)=>{ for(const [p,u] of [[a,uv[0]],[b,uv[1]],[c,uv[2]],[a,uv[0]],[c,uv[2]],[d,uv[3]]]){ P.push(...p); Nn.push(...n); UV.push(...u); K.push(k); } };
  const box=(E,N,h0,h1,hx,hz,col)=>{ const c=[[E-hx,N-hz],[E+hx,N-hz],[E+hx,N+hz],[E-hx,N+hz]];
    for(let i=0;i<4;i++){ const a=c[i], d=c[(i+1)%4]; const n=[d[1]-a[1],0,d[0]-a[0]]; const L=Math.hypot(n[0],n[2])||1;
      quad(W3(a[0],h0,a[1]),W3(d[0],h0,d[1]),W3(d[0],h1,d[1]),W3(a[0],h1,a[1]),[n[0]/L,0,n[2]/L],[[col,0],[col,0],[col,0],[col,0]],0); }
    quad(W3(c[0][0],h1,c[0][1]),W3(c[1][0],h1,c[1][1]),W3(c[2][0],h1,c[2][1]),W3(c[3][0],h1,c[3][1]),[0,1,0],[[col,0],[col,0],[col,0],[col,0]],0); };
  const SA=signAtlas();
  // signs: on the left of a taxiing aircraft, 12 m from the taxiway centre, 1.1 m tall boards on two legs
  for(const h of (apt.rwy.holds||[])){
    const mid=[(h.a[0]+h.b[0])/2,(h.a[1]+h.b[1])/2]; const dv=[h.b[0]-h.a[0],h.b[1]-h.a[1]], L=Math.hypot(...dv); const u=[dv[0]/L,dv[1]/L];
    const ru=apt.rwy.u; let tw=[-h.side*ru[1],h.side*ru[0]];                                    // towards the runway
    let nr=[u[1],-u[0]]; if(nr[0]*tw[0]+nr[1]*tw[1]<0) nr=[-nr[0],-nr[1]];
    const left=[-nr[1],nr[0]];                                                                  // left of an aircraft facing the runway
    const g=W.height(mid[0],mid[1]);
    const faces=[h.side<0?'35-17':'17-35', h.twy||'A'];
    faces.forEach((f,j)=>{ const off=Math.max(L/2+6,13)+j*2.7; const cx=mid[0]+left[0]*off-nr[0]*1.5, cy=mid[1]+left[1]*off-nr[1]*1.5;
      const i=SA.idx[f]??2, u0=(i%4)/4, v0=Math.floor(i/4)/2, u1=u0+0.25, v1=v0+0.5;
      const hw=1.25, a=[cx-left[0]*hw,cy-left[1]*hw], b=[cx+left[0]*hw,cy+left[1]*hw];
      // front face (towards the taxiing aircraft, i.e. away from the runway) and back face
      // one board, both sides: the shader mirrors the face seen from behind so the text always reads correctly
      quad(W3(a[0],g+0.4,a[1]),W3(b[0],g+0.4,b[1]),W3(b[0],g+1.5,b[1]),W3(a[0],g+1.5,a[1]),[-nr[0],0,nr[1]],[[u1,v1],[u0,v1],[u0,v0],[u1,v0]],1);
      box(a[0],a[1],g,g+0.4,0.05,0.05,0.3); box(b[0],b[1],g,g+0.4,0.05,0.05,0.3); });
    // red stop bar: in-pavement lights across the taxiway, facing away from the runway
    for(let d=1.5; d<L-1; d+=3){ const q=[h.a[0]+u[0]*d+nr[0]*0.6,h.a[1]+u[1]*d+nr[1]*0.6], gg=W.height(q[0],q[1])+0.1;
      apt.lights.push([q[0],q[1],gg,1.0,0.1,0.05,-nr[0],-nr[1],50,0.8,0,0]); }
  }
  // windsocks: 6 m mast, striped cone pointing down-wind (wind from 240 deg)
  const wind=(240+180)*Math.PI/180, wd=[Math.sin(wind),Math.cos(wind)];
  for(const s of (apt.rwy.socks||[])){ const g=W.height(s[0],s[1]); box(s[0],s[1],g,g+6.2,0.07,0.07,0.55);
    for(let k=0;k<5;k++){ const r0=0.45-k*0.06, r1=0.45-(k+1)*0.06, x0=0.3+k*0.72, x1=x0+0.72, seg=10;
      for(let i=0;i<seg;i++){ const t0=i/seg*Math.PI*2, t1=(i+1)/seg*Math.PI*2; const pt=(x,r,t)=>{ const lat=Math.cos(t)*r; return W3(s[0]+wd[0]*x+wd[1]*lat, g+6.0+Math.sin(t)*r-x*0.08, s[1]+wd[1]*x-wd[0]*lat); };
        const col=k%2?0.97:0.62;                                     // 0.62 = orange, 0.97 = white (decoded in the shader)
        quad(pt(x0,r0,t0),pt(x1,r1,t0),pt(x1,r1,t1),pt(x0,r0,t1),[0,1,0],[[col,0],[col,0],[col,0],[col,0]],2);
        quad(pt(x0,r0,t1),pt(x1,r1,t1),pt(x1,r1,t0),pt(x0,r0,t0),[0,1,0],[[col,0],[col,0],[col,0],[col,0]],2); } }
    apt.lights.push([s[0],s[1],g+6.4,1.0,0.95,0.85,0,0,180,0.9,0,0]); }
  // perimeter fence: 2.4 m chain link on posts every 3 m (pattern in the shader), plus three strands of barbed wire
  const F=apt.rwy.fence||[];
  for(let i=0;i<F.length;i++){ const a=F[i], b=F[(i+1)%F.length]; const n=[b[1]-a[1],0,b[0]-a[0]]; const L=Math.hypot(n[0],n[2])||1;
    const L0=i*8.0; quad(W3(a[0],a[2],a[1]),W3(b[0],b[2],b[1]),W3(b[0],b[2]+2.4,b[1]),W3(a[0],a[2]+2.4,a[1]),[n[0]/L,0,n[2]/L],[[L0,0],[L0+L,0],[L0+L,2.4],[L0,2.4]],3); }
  const g=new (T().BufferGeometry)();
  g.setAttribute('position',new (T().Float32BufferAttribute)(P,3)); g.setAttribute('normal',new (T().Float32BufferAttribute)(Nn,3));
  g.setAttribute('uv',new (T().Float32BufferAttribute)(UV,2)); g.setAttribute('kk',new (T().Float32BufferAttribute)(K,1)); g.computeBoundingSphere();
  const m=new (T().ShaderMaterial)({uniforms:Object.assign(fleetUniforms(),{tSign:{value:SA.t}}),
    vertexShader:`attribute float kk; varying vec3 vN; varying vec3 vW; varying vec2 vU; varying float vK; void main(){ vN=normal; vW=position; vU=uv; vK=kk; gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0); }`,
    fragmentShader:`${COMMON} uniform vec3 camW; uniform float night; uniform sampler2D tSign; varying vec3 vN; varying vec3 vW; varying vec2 vU; varying float vK;
      void main(){ vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N; vec3 c; float a=1.0, glow=0.0;
        if(vK<0.5) c=vec3(vU.x);                                                   // grey legs and posts
        else if(vK<1.5){ vec2 cell=floor(vU*vec2(4.0,2.0)+1e-4), lc=vU*vec2(4.0,2.0)-cell; if(gl_FrontFacing) lc.x=1.0-lc.x; c=texture2D(tSign,(cell+clamp(lc,0.01,0.99))/vec2(4.0,2.0)).rgb; glow=0.9; }                      // sign face, lit at night
        else if(vK<2.5){ c=vU.x>0.8?vec3(0.95):vec3(0.95,0.42,0.08); }               // windsock bands
        else {                                                                       // chain-link fence
          vec2 q=vU; float post=step(fract(q.x/3.0),0.03); float top=step(2.25,q.y);
          vec2 d=abs(fract(vec2(q.x+q.y,q.x-q.y)/0.06)-0.5); float wfw=fwidth(q.x)/0.06;
          float wire=max(1.0-smoothstep(0.0,0.08+wfw,d.x),1.0-smoothstep(0.0,0.08+wfw,d.y));
          float cov=wfw>0.5?0.28:wire; a=max(max(post,top*step(fract(q.y/0.075),0.25)),cov*0.9); if(a<0.05) discard; c=vec3(0.45,0.47,0.48); }
        vec3 cl=lin(c);
        float ndl=abs(dot(N,sunDir)); vec3 lit=sunCol*ndl*smoothstep(-0.05,0.08,sunDir.y)+skyCol*amb*2.0+horCol*amb*0.3;
        vec3 col=cl*lit+cl*glow*night*1.2;
        gl_FragColor=vec4(tone(aerial(col,vW,camW)),a); }`,
    side:T().DoubleSide, transparent:true});
  const mesh=new (T().Mesh)(g,m); mesh.name='details'; mesh.renderOrder=2; group.add(mesh); fleetMats.push(m);
}

/* ---------- lights: approach, runway, PAPI, taxiway (points; sized and faded in the shader) ---------- */
function buildLights(){
  const L=apt.lights, n=L.length, P=new Float32Array(n*3), C=new Float32Array(n*3), D=new Float32Array(n*4), K=new Float32Array(n*2);
  L.forEach((l,i)=>{ P.set([l[0],l[2],-l[1]],i*3); C.set([l[3],l[4],l[5]],i*3);
    D.set([l[6],-l[7],Math.cos((l[8]||180)*Math.PI/180),l[9]],i*4); K.set([l[10],l[11]],i*2); });
  const g=new (T().BufferGeometry)();
  g.setAttribute('position',new (T().BufferAttribute)(P,3)); g.setAttribute('lcol',new (T().BufferAttribute)(C,3));
  g.setAttribute('ldir',new (T().BufferAttribute)(D,4)); g.setAttribute('lk',new (T().BufferAttribute)(K,2)); g.computeBoundingSphere();
  const m=new (T().ShaderMaterial)({
    uniforms:{camW:{value:new (T().Vector3)()},night:{value:0},time:{value:0},pxs:{value:700},sunDir:{value:new (T().Vector3)()},fogD:{value:0},expo:{value:1},sunCol:{value:new (T().Color)()},skyCol:{value:new (T().Color)()},horCol:{value:new (T().Color)()},amb:{value:0}},
    vertexShader:`attribute vec3 lcol; attribute vec4 ldir; attribute vec2 lk; uniform vec3 camW; uniform float night; uniform float time; uniform float pxs; uniform float fogD;
      varying vec3 vC; varying float vI;
      void main(){
        vec3 v=camW-position; float d=length(v); vec3 dir=v/d;
        float I=1.0;
        if(ldir.x!=0.0||ldir.y!=0.0){ vec2 f=normalize(ldir.xy); float c=dot(normalize(vec2(dir.x,dir.z)),f); I=smoothstep(ldir.z-0.15,ldir.z+0.05,c); I*=smoothstep(-0.02,0.03,dir.y); }
        vec3 col=lcol;
        if(lk.x>1.5){ // PAPI: white above the unit's angle, red below (narrow transition)
          float ang=degrees(asin(clamp(dir.y,-1.0,1.0))); float w=smoothstep(lk.y-0.03,lk.y+0.03,ang); col=mix(vec3(1.0,0.08,0.04),vec3(1.0,0.97,0.92),w); I*=1.6; }
        else if(lk.x>0.5){ // sequenced flashing: runs towards the threshold twice a second
          float ph=fract(time*2.0+lk.y/900.0); I*=smoothstep(0.06,0.0,abs(ph-0.5))*3.0; }
        float vis=max(night,0.12);
        float fog=exp(-d*fogD*0.5);
        I*=vis*fog*min(1.0,ldir.w)*clamp(2500.0/d,0.35,1.0);
        // a light is a point source: a fixed core of ~1.5 px, a little larger up close and for the bright approach lights
        float px=clamp(0.25*ldir.w*pxs/max(d,1.0)+1.3*ldir.w+1.2*night*clamp(400.0/d,0.0,1.0),1.0,18.0);
        gl_PointSize=I>0.002?px:0.0;
        vC=col; vI=I;
        gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`varying vec3 vC; varying float vI; void main(){ vec2 p=gl_PointCoord*2.0-1.0; float r=dot(p,p); if(r>1.0) discard;
      float core=exp(-r*7.0), halo=exp(-r*2.2)*0.45; float a=clamp((core+halo)*vI,0.0,1.0);
      gl_FragColor=vec4(mix(vC,vec3(1.0),core*0.55)*a,a); }`,
    transparent:true,depthWrite:false,blending:T().AdditiveBlending});
  lights=new (T().Points)(g,m); lights.frustumCulled=false; lights.renderOrder=5; lights.name='lights'; group.add(lights);
}

G.WORLD=W;
})(typeof window!=='undefined'?window:self);
