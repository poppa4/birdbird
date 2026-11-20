/* NORDAP Virtual Labs · GNSS and RNAV: the satellites and the Earth (three.js r128, no build step).
   Two views on one 3D globe:
   - Constellations: GPS, GLONASS and Galileo in their real orbits (radius, inclination, period, planes), EGNOS over the equator,
     the Earth turning under them, and the lines of sight from Bergen to the satellites above the 5° mask.
   - WGS-84 and the geoid: the smooth reference ellipsoid against real mean sea level (EGM96, data/geoid-egm96.json),
     heights exaggerated so the lumps can be seen; tap the globe to read N anywhere.
   Exposes window.GNSSGLOBE = { show(view, opts) } for the key-concept cards. */
(function(){
'use strict';
const root=document.getElementById('ogVp'); if(!root) return;
const {L,el}=LAB; const t2=(en,no)=>({en,no});
const fmt=(v,d)=>LAB.nf?LAB.nf(v,d):v.toFixed(d);
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const R_E=6371;                                  /* km, one scene unit */
const OMEGA=7.2921159e-5;                        /* Earth's rotation, rad/s */
const MU=398600.4418;                            /* km³/s² */
const D2R=Math.PI/180;

/* ---------- the constellations (nominal design; the counts drawn are the design slots, not today's exact fleet) ---------- */
const CON=[
 {k:'gps',n:'GPS',c:'#F0B440',alt:20180,inc:55,planes:6,per:5,F:1,tilt:-0.15,
  who:t2('USA','USA'),datum:'WGS-84',drawn:t2('6 planes × 5 drawn (24 slots + spares)','6 baneplan × 5 tegnet (24 plasser + reserver)')},
 {k:'glo',n:'GLONASS',c:'#EC5A47',alt:19100,inc:64.8,planes:3,per:8,F:1,
  who:t2('Russia','Russland'),datum:'PZ-90.11',drawn:t2('3 planes × 8 (24 slots)','3 baneplan × 8 (24 plasser)')},
 {k:'gal',n:'Galileo',c:'#63D9A0',alt:23222,inc:56,planes:3,per:8,F:1,
  who:t2('EU','EU'),datum:'GTRF',drawn:t2('3 planes × 8 drawn (24 slots + spares)','3 baneplan × 8 tegnet (24 plasser + reserver)')}];
CON.forEach(c=>{ c.a=R_E+c.alt; c.r=c.a/R_E; c.T=2*Math.PI*Math.sqrt(c.a**3/MU); c.nmo=2*Math.PI/c.T; c.sats=[];
  for(let p=0;p<c.planes;p++) for(let s=0;s<c.per;s++){ const raan=p*2*Math.PI/c.planes+(c.k==='glo'?0.3:c.k==='gal'?0.9:0);
    const u0=s*2*Math.PI/c.per+p*c.F*2*Math.PI/(c.planes*c.per)+(c.tilt||0)*p; c.sats.push({p,raan,u0}); } });
const GEO_R=42164/R_E;
const EGNOS=[{lon:5,n:'EGNOS'},{lon:31.5,n:'EGNOS'}];   /* the European SBAS sits on geostationary satellites over Africa; positions illustrative */
const HOME={n:'Bergen',lat:60.29,lon:5.22};
const MASK=5;                                         /* elevation mask, degrees */
const PLACES=[
 ['bgo',t2('Bergen','Bergen'),60.29,5.22],['tos',t2('Tromsø','Tromsø'),69.68,18.92],['kef',t2('Iceland','Island'),64.0,-19.0],
 ['png',t2('New Guinea','Ny-Guinea'),-4.0,141.0],['ind',t2('Indian Ocean','Indiahavet'),5.0,78.0]];

/* ---------- state ---------- */
const S={view:'orb',speed:1200,show:{gps:true,glo:true,gal:true,egnos:false,orbits:true,los:true,grid:true},ex:6000,place:'bgo'};
const S0=JSON.parse(JSON.stringify(S));
let tSim=0;                                            /* seconds since start */
const CAM={az:0.30,el:0.42,dist:14.5,tAz:0.30,tEl:0.42,tDist:14.5,vAz:0,vEl:0};
const VIEWDIST={orb:14.5,geo:4.1};
let pick=null;                                         /* {lat,lon} picked by tapping in the geoid view */

/* ---------- DOM ---------- */
const stage=el('ogStage'), cv=el('ogCv'), lbl=el('ogLbl'), chipE=el('ogChip'), loadE=el('ogLoad');
function fail(msg){ loadE.hidden=false; loadE.textContent=L(msg); }
if(!window.THREE){ fail(t2('The 3D view could not load.','3D-visningen kunne ikke lastes.')); return; }
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'}); }
catch(e){ fail(t2('This browser cannot show the 3D view (WebGL is off).','Denne nettleseren kan ikke vise 3D-visningen (WebGL er av).')); return; }
renderer.setClearColor(0x000000,0);
const gl=renderer.getContext(), maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE)||2048;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,1,0.05,400);

/* ---------- textures ---------- */
const TL=new THREE.TextureLoader();
const big=maxTex>=4096&&Math.min(screen.width,screen.height)*(devicePixelRatio||1)>=1100;
let pending=3; const ready=()=>{ if(--pending<=0){ loadE.hidden=true; dirty=true; kick(); } };
const tex=(src)=>{ const t=TL.load(src,ready,undefined,()=>{ ready(); }); t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()); return t; };
const dayT=tex(big?'img/globe/earth-day-4k.webp':'img/globe/earth-day-2k.webp');
const nightT=tex('img/globe/earth-night-2k.webp');
const maskT=tex('img/globe/earth-mask-2k.webp');      /* R = water, G = relief */
[dayT,nightT].forEach(t=>{ t.encoding=THREE.sRGBEncoding; });
renderer.outputEncoding=THREE.sRGBEncoding;

/* sun: fixed in space, lighting Europe from the front-left at the start */
const SUN=new THREE.Vector3(-0.55,0.32,0.77).normalize();

/* ---------- the Earth (Earth-fixed group, turned by the sidereal angle) ---------- */
const earthG=new THREE.Group(); scene.add(earthG);
const earthMat=new THREE.ShaderMaterial({
 uniforms:{dayT:{value:dayT},nightT:{value:nightT},maskT:{value:maskT},sun:{value:SUN},dim:{value:1}},
 vertexShader:`varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
 fragmentShader:`uniform sampler2D dayT,nightT,maskT; uniform vec3 sun; uniform float dim; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  vec3 toLin(vec3 c){ return pow(c,vec3(2.2)); }
  void main(){ vec3 N=normalize(vN), V=normalize(cameraPosition-vP); float d=dot(N,sun);
   float day=smoothstep(-0.12,0.22,d);
   vec3 dc=toLin(texture2D(dayT,vUv).rgb), nc=toLin(texture2D(nightT,vUv).rgb);
   vec4 m=texture2D(maskT,vUv); float water=m.r;
   vec3 lit=dc*(0.06+1.05*max(d,0.));
   vec3 H=normalize(sun+V); float sp=pow(max(dot(N,H),0.),90.)*water*0.28*day;
   vec3 night=nc*vec3(1.,.78,.5)*1.6+dc*0.012;
   vec3 col=mix(night,lit,day)+sp*vec3(1.,.93,.8);
   float fr=pow(1.-max(dot(N,V),0.),2.6); col+=vec3(.22,.5,1.)*fr*(.12+.55*day);
   col*=dim; gl_FragColor=vec4(pow(col,vec3(1./2.2)),1.); }`});
const earth=new THREE.Mesh(new THREE.SphereGeometry(1,128,64),earthMat); earthG.add(earth);
/* atmosphere glow */
const atm=new THREE.Mesh(new THREE.SphereGeometry(1.06,64,32),new THREE.ShaderMaterial({
 uniforms:{sun:{value:SUN},k:{value:1}},transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
 vertexShader:`varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
 fragmentShader:`uniform vec3 sun; uniform float k; varying vec3 vN; varying vec3 vP; void main(){ vec3 V=normalize(cameraPosition-vP); float r=dot(vN,V);
  float g=pow(clamp(1.0+r*1.05,0.,1.),5.0); float d=clamp(dot(normalize(vP),sun)*.8+.35,0.08,1.);
  gl_FragColor=vec4(vec3(.32,.62,1.)*g*d*1.15*k,g*d*k); }`}));
scene.add(atm);
/* the spin axis, faint */
{ const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-1.35,0),new THREE.Vector3(0,1.35,0)]);
  earthG.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x7FCBE8,transparent:true,opacity:.55}))); }

/* stars */
{ const n=1800, p=new Float32Array(n*3), c=new Float32Array(n*3); let s=7;
  const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for(let i=0;i<n;i++){ const u=rnd()*2-1, th=rnd()*Math.PI*2, r=120+rnd()*60, q=Math.sqrt(1-u*u);
    p[i*3]=r*q*Math.cos(th); p[i*3+1]=r*u; p[i*3+2]=r*q*Math.sin(th); const b=.45+rnd()*.55, w=rnd(); c[i*3]=b*(w<.15?.8:1); c[i*3+1]=b*(w<.15?.88:1); c[i*3+2]=b; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(p,3)); g.setAttribute('color',new THREE.BufferAttribute(c,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({size:1.1,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.85,depthWrite:false}))); }

/* ---------- coordinates: Earth-fixed (lat, lon) ↔ scene. Scene y is the spin axis, lon 0 is +x, lon 90°E is −z (three's sphere UVs) ---------- */
const llToV=(lat,lon,r)=>{ const a=lat*D2R, b=lon*D2R; return new THREE.Vector3(r*Math.cos(a)*Math.cos(b),r*Math.sin(a),-r*Math.cos(a)*Math.sin(b)); };
const vToLl=v=>{ const n=v.clone().normalize(); return {lat:Math.asin(Math.max(-1,Math.min(1,n.y)))/D2R,lon:Math.atan2(-n.z,n.x)/D2R}; };
/* inertial position on a circular orbit */
const orbPos=(r,inc,raan,u,out)=>{ const cu=Math.cos(u), su=Math.sin(u), cO=Math.cos(raan), sO=Math.sin(raan), ci=Math.cos(inc), si=Math.sin(inc);
  const x=r*(cu*cO-su*ci*sO), y=r*(cu*sO+su*ci*cO), z=r*su*si; return out.set(x,z,-y); };
const orbNormal=(inc,raan,out)=>out.set(Math.sin(raan)*Math.sin(inc),Math.cos(inc),Math.cos(raan)*Math.sin(inc)).normalize();

/* ---------- constellations group (inertial) ---------- */
const conG=new THREE.Group(); scene.add(conG);
const lineMat=c=>new THREE.LineBasicMaterial({color:new THREE.Color(c),transparent:true,opacity:.5,depthWrite:false});
CON.forEach(c=>{ c.g=new THREE.Group(); conG.add(c.g); c.rings=new THREE.Group(); c.g.add(c.rings);
  for(let p=0;p<c.planes;p++){ const raan=c.sats.find(s=>s.p===p).raan, pts=[]; for(let i=0;i<=192;i++) pts.push(orbPos(c.r,c.inc*D2R,raan,i/192*Math.PI*2,new THREE.Vector3()));
    c.rings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat(c.c))); }
  /* satellites: body in the constellation colour, two blue solar wings */
  const n=c.sats.length;
  c.body=new THREE.InstancedMesh(new THREE.BoxGeometry(.075,.075,.11),new THREE.MeshStandardMaterial({color:new THREE.Color(c.c),emissive:new THREE.Color(c.c),emissiveIntensity:.55,metalness:.6,roughness:.35}),n);
  c.wing=new THREE.InstancedMesh(new THREE.BoxGeometry(.34,.006,.07),new THREE.MeshStandardMaterial({color:0x2C5BE0,emissive:0x163a9e,emissiveIntensity:.7,metalness:.35,roughness:.3}),n);
  c.g.add(c.body,c.wing); c.pos=c.sats.map(()=>new THREE.Vector3()); c.vis=new Array(n).fill(false); });
scene.add(new THREE.AmbientLight(0xffffff,.45)); { const d=new THREE.DirectionalLight(0xffffff,1.1); d.position.copy(SUN).multiplyScalar(10); scene.add(d); }

/* EGNOS: geostationary, so they live in the Earth-fixed group */
const geoG=new THREE.Group(); earthG.add(geoG);
{ const pts=[]; for(let i=0;i<=192;i++) pts.push(llToV(0,i/192*360,GEO_R)); const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0x7FCBE8,dashSize:.18,gapSize:.12,transparent:true,opacity:.6})); ln.computeLineDistances(); geoG.add(ln);
  EGNOS.forEach(e=>{ const m=new THREE.Group(); m.add(new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.14),new THREE.MeshStandardMaterial({color:0x7FCBE8,emissive:0x7FCBE8,emissiveIntensity:.6})));
    const w=new THREE.Mesh(new THREE.BoxGeometry(.006,.42,.08),new THREE.MeshStandardMaterial({color:0x2C5BE0,emissive:0x163a9e,emissiveIntensity:.7})); m.add(w);
    m.position.copy(llToV(0,e.lon,GEO_R)); m.lookAt(0,0,0); geoG.add(m); e.m=m; }); }

/* Bergen and the lines of sight */
const homeLocal=llToV(HOME.lat,HOME.lon,1.004);
const homeDot=new THREE.Mesh(new THREE.SphereGeometry(.022,16,12),new THREE.MeshBasicMaterial({color:0xF06BB4})); homeDot.position.copy(homeLocal); earthG.add(homeDot);
const MAXL=96, losPos=new Float32Array(MAXL*6), losCol=new Float32Array(MAXL*6);
const losGeo=new THREE.BufferGeometry(); losGeo.setAttribute('position',new THREE.BufferAttribute(losPos,3)); losGeo.setAttribute('color',new THREE.BufferAttribute(losCol,3));
const los=new THREE.LineSegments(losGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending})); scene.add(los);

/* ---------- the geoid (Earth-fixed) ---------- */
const geoidG=new THREE.Group(); earthG.add(geoidG);
let GRID=null, geoidMesh=null;
const nAt=(lat,lon)=>{ if(!GRID) return 0; const G=GRID; let x=(lon-G.lon0)/G.step; x=((x%(G.nlon-1))+(G.nlon-1))%(G.nlon-1); const y=Math.max(0,Math.min(G.nlat-1.0001,(G.lat0-lat)/G.step));
  const x0=Math.floor(x), y0=Math.floor(y), fx=x-x0, fy=y-y0, v=(i,j)=>G.n[j*G.nlon+i]/10;
  return (v(x0,y0)*(1-fx)+v(x0+1,y0)*fx)*(1-fy)+(v(x0,y0+1)*(1-fx)+v(x0+1,y0+1)*fx)*fy; };
const geoMat=new THREE.ShaderMaterial({uniforms:{dayT:{value:dayT},maskT:{value:maskT},sun:{value:SUN},k:{value:S.ex/R_E/1000}},transparent:true,
 extensions:{derivatives:true},
 vertexShader:`attribute float nh; uniform float k; varying vec2 vUv; varying float vNh; varying vec3 vN; varying vec3 vP;
  void main(){ vUv=uv; vNh=nh; vec3 p=position*(1.+nh*k); vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(p,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
 fragmentShader:`uniform sampler2D dayT,maskT; uniform vec3 sun; varying vec2 vUv; varying float vNh; varying vec3 vN; varying vec3 vP;
  vec3 pal(float n){ float t=clamp((n+105.)/190.,0.,1.);
   vec3 a=vec3(.16,.32,.85), b=vec3(.30,.66,.95), c=vec3(.62,.92,.80), d=vec3(.98,.82,.42), e=vec3(.95,.40,.30);
   return t<.25?mix(a,b,t/.25):t<.553?mix(b,c,(t-.25)/.303):t<.78?mix(c,d,(t-.553)/.227):mix(d,e,(t-.78)/.22); }
  void main(){ vec3 N=normalize(vN), V=normalize(cameraPosition-vP); float w=texture2D(maskT,vUv).r;
   float coast=1.-smoothstep(.0,1.6,abs(w-.5)/max(fwidth(w),1e-4));
   vec3 col=pal(vNh); vec3 land=pow(texture2D(dayT,vUv).rgb,vec3(1.1));
   col=mix(col,col*.5+land*.55,.45+(1.-w)*.25);
   col=mix(col,vec3(1.),coast*.55);
   float l=.55+.5*max(dot(N,sun),0.); float fr=pow(1.-max(dot(N,V),0.),2.2);
   col=col*l+vec3(.6,.85,1.)*fr*.35;
   gl_FragColor=vec4(col,.92); }`});
/* the WGS-84 ellipsoid as a white graticule (drawn round: its 1/298 flattening is far too small to see at this scale) */
const ellG=new THREE.Group(); geoidG.add(ellG);
{ const mat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.62,depthWrite:false});
  for(let la=-75;la<=75;la+=15){ const pts=[]; for(let i=0;i<=144;i++) pts.push(llToV(la,i*2.5,1.0005)); ellG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat)); }
  for(let lo=0;lo<360;lo+=15){ const pts=[]; for(let i=0;i<=72;i++) pts.push(llToV(-90+i*2.5,lo,1.0005)); ellG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat)); } }
/* the place marker: a bar from the ellipsoid to the geoid */
const pinG=new THREE.Group(); geoidG.add(pinG);
const pinBar=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,1,8),new THREE.MeshBasicMaterial({color:0xF06BB4})); pinG.add(pinBar);
const pinTop=new THREE.Mesh(new THREE.SphereGeometry(.016,16,12),new THREE.MeshBasicMaterial({color:0xF06BB4})); pinG.add(pinTop);
const pinBase=new THREE.Mesh(new THREE.RingGeometry(.012,.022,24),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide})); pinG.add(pinBase);

function buildGeoid(){
  const g=new THREE.SphereGeometry(1,360,180), p=g.attributes.position, nh=new Float32Array(p.count), v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const ll=vToLl(v); nh[i]=nAt(ll.lat,ll.lon); }
  g.setAttribute('nh',new THREE.BufferAttribute(nh,1));
  geoidMesh=new THREE.Mesh(g,geoMat); geoidMesh.renderOrder=1; geoidG.add(geoidMesh); place(); dirty=true; kick(); }
fetch('data/geoid-egm96.json').then(r=>r.json()).then(j=>{ GRID=j; buildGeoid(); }).catch(()=>{});

/* ---------- labels (DOM pills, so the key-concept rings can find them) ---------- */
const PILL={};
function pill(k,cls){ if(!PILL[k]){ const e=document.createElement('span'); e.className='og-pill '+(cls||''); lbl.appendChild(e); PILL[k]=e; } return PILL[k]; }
const proj=new THREE.Vector3();
function toScreen(v,w,h){ proj.copy(v).project(camera); return {x:(proj.x*.5+.5)*w,y:(-proj.y*.5+.5)*h,z:proj.z}; }
function placePill(e,x,y,w,h){ const bw=e.offsetWidth||60, bh=e.offsetHeight||22; x=Math.max(6+bw/2,Math.min(w-6-bw/2,x)); y=Math.max(54+bh/2,Math.min(h-6-bh/2,y));
  e.style.transform=`translate(${(x-bw/2).toFixed(1)}px,${(y-bh/2).toFixed(1)}px)`; }
const tmpV=new THREE.Vector3(), tmpN=new THREE.Vector3(), tmpM=new THREE.Matrix4(), tmpX=new THREE.Vector3(), tmpY=new THREE.Vector3(), tmpZ=new THREE.Vector3();
function labels(w,h){
  const orb=S.view==='orb';
  CON.forEach((c,ci)=>{ const e=pill(c.k,'c-'+c.k); e.textContent=c.n; const on=orb&&S.show[c.k]; e.hidden=!on; if(!on) return;
    /* anchor: the point of the first orbit ring that lies furthest out on screen in this constellation's own direction */
    const dir=[[0,-1],[1,0.15],[-1,0.05]][ci]; let best=-1e9, bx=0, by=0; const raan=c.sats[0].raan;
    for(let i=0;i<96;i++){ orbPos(c.r,c.inc*D2R,raan,i/96*Math.PI*2,tmpV); const s=toScreen(tmpV,w,h); const sc=(s.x-w/2)*dir[0]+(s.y-h/2)*dir[1]; if(sc>best){ best=sc; bx=s.x; by=s.y; } }
    placePill(e,bx+dir[0]*34,by+dir[1]*26,w,h); });
  { const e=pill('egnos','c-egnos'); e.textContent='EGNOS · GEO'; const on=orb&&S.show.egnos; e.hidden=!on; if(on){ EGNOS[0].m.getWorldPosition(tmpV); const s=toScreen(tmpV,w,h); placePill(e,s.x,s.y-26,w,h); } }
  { const e=pill('home','c-home'); e.textContent=HOME.n; homeDot.getWorldPosition(tmpV); const s=toScreen(tmpV,w,h); const front=tmpV.clone().sub(camera.position).dot(tmpV)<0;
    e.hidden=!orb||!front; if(!e.hidden) placePill(e,s.x+30,s.y+16,w,h); }
  /* geoid view */
  const geo=S.view==='geo', ctr=toScreen(new THREE.Vector3(),w,h), rpx=h/2/(CAM.dist*Math.tan(camera.fov*D2R/2));
  { const e=pill('ell','g-ell'); e.textContent=L(t2('white: the smooth WGS-84 ellipsoid','hvit: den glatte WGS-84-ellipsoiden')); e.hidden=!geo||!S.show.grid; if(!e.hidden) placePill(e,ctr.x,ctr.y-rpx*1.18-8,w,h); }
  { const e=pill('geoid','g-geo'); e.textContent=L(t2(`colour: real sea level (the geoid), heights ×${fmt(S.ex,0)}`,`farge: virkelig havnivå (geoiden), høyder ×${fmt(S.ex,0)}`)); e.hidden=!geo; if(geo) placePill(e,ctr.x+rpx*.35,ctr.y+rpx*1.2+6,w,h); }
  { const e=pill('pin','g-pin'); const P=curPlace(); e.hidden=!geo||!GRID; if(!e.hidden){ e.textContent=`N = ${sg(nAt(P.lat,P.lon))} m · ${L(P.n)}`;
    pinTop.getWorldPosition(tmpV); const front=tmpV.clone().sub(camera.position).dot(tmpV.clone().normalize())<0; e.style.opacity=front?1:.35; const s=toScreen(tmpV,w,h); placePill(e,s.x+(s.x>ctr.x?1:-1)*70,s.y-22,w,h); } }
}
const sg=v=>(v>=0?'+':'−')+fmt(Math.abs(v),0);

/* ---------- places ---------- */
function curPlace(){ if(pick) return {n:t2('Here','Her'),lat:pick.lat,lon:pick.lon}; const p=PLACES.find(x=>x[0]===S.place)||PLACES[0]; return {n:p[1],lat:p[2],lon:p[3]}; }
function place(){ const P=curPlace(), N=nAt(P.lat,P.lon), k=S.ex/R_E/1000, up=llToV(P.lat,P.lon,1), top=1+N*k;
  const lo=Math.min(1,top), hi=Math.max(1,top), len=Math.max(.002,hi-lo)+.05;
  pinBar.scale.set(1,len,1); pinBar.position.copy(up).multiplyScalar((lo+hi)/2+.025); pinBar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);
  pinTop.position.copy(up).multiplyScalar(hi+.05); pinBase.position.copy(up).multiplyScalar(1.001); pinBase.lookAt(up.clone().multiplyScalar(2)); }
/* turn the camera so a place faces the viewer (geoid view, Earth not turning) */
function face(lat,lon){ const v=llToV(lat,lon,1).applyQuaternion(earthG.quaternion); CAM.tAz=Math.atan2(v.x,v.z); CAM.tEl=Math.max(-1.2,Math.min(1.2,Math.asin(v.y)*.85)); }

/* ---------- camera and input ---------- */
function camPos(){ const ce=Math.cos(CAM.el); camera.position.set(CAM.dist*ce*Math.sin(CAM.az),CAM.dist*Math.sin(CAM.el),CAM.dist*ce*Math.cos(CAM.az)); camera.lookAt(0,0,0); }
let drag=null, moved=0;
cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); drag={x:e.clientX,y:e.clientY,id:e.pointerId}; moved=0; cv.classList.add('drag'); CAM.vAz=CAM.vEl=0; ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
const ptrs=new Map(); let pinch=0;
cv.addEventListener('pointermove',e=>{ if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){ const [a,b]=[...ptrs.values()], d=Math.hypot(a.x-b.x,a.y-b.y); if(pinch) zoomBy(pinch/d); pinch=d; moved+=10; return; }
  if(!drag||drag.id!==e.pointerId) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY; moved+=Math.abs(dx)+Math.abs(dy);
  const k=2.6/Math.max(300,cv.clientWidth)*Math.min(1,CAM.dist/6+.25); CAM.vAz=-dx*k; CAM.vEl=dy*k; CAM.tAz+=CAM.vAz; CAM.tEl=Math.max(-1.35,Math.min(1.35,CAM.tEl+CAM.vEl)); dirty=true; kick(); });
const up=e=>{ ptrs.delete(e.pointerId); if(ptrs.size<2) pinch=0; if(!drag||drag.id!==e.pointerId) return; cv.classList.remove('drag'); drag=null;
  if(moved<6&&S.view==='geo'&&e.type==='pointerup') tap(e); };
cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{ if(!e.ctrlKey&&!stage.matches(':hover')) return; e.preventDefault(); zoomBy(Math.exp(e.deltaY*.0012)); },{passive:false});
cv.addEventListener('keydown',e=>{ const k=e.key, s=.08; let h=1;
  if(k==='ArrowLeft') CAM.tAz-=s; else if(k==='ArrowRight') CAM.tAz+=s; else if(k==='ArrowUp') CAM.tEl=Math.min(1.35,CAM.tEl+s); else if(k==='ArrowDown') CAM.tEl=Math.max(-1.35,CAM.tEl-s);
  else if(k==='+'||k==='=') zoomBy(.85); else if(k==='-') zoomBy(1/.85); else h=0; if(h){ e.preventDefault(); dirty=true; kick(); } });
const zLim=()=>S.view==='geo'?[1.6,6]:[2.4,30];
function zoomBy(f){ const [a,b]=zLim(); CAM.tDist=Math.max(a,Math.min(b,CAM.tDist*f)); dirty=true; kick(); }
el('ogZin').addEventListener('click',()=>zoomBy(.8)); el('ogZout').addEventListener('click',()=>zoomBy(1.25));
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function tap(e){ const r=cv.getBoundingClientRect(); ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1); ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObject(earth,false)[0]; if(!hit) return; const loc=earth.worldToLocal(hit.point.clone()); pick=vToLl(loc); S.place=''; placeSeg.set(''); place(); ui(); dirty=true; kick(); }

/* ---------- size ---------- */
let W=0,H=0;
function resize(){ const w=stage.clientWidth, h=stage.clientHeight; if(!w||!h) return; W=w; H=h; renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.setSize(w,h,false); camera.aspect=w/h;
  /* keep the whole picture in view on narrow screens */
  camera.fov=w/h<1?Math.min(62,34/(w/h)**.75):34; camera.updateProjectionMatrix(); dirty=true; kick(); }
new ResizeObserver(resize).observe(stage);

/* ---------- simulation ---------- */
const colV=c=>new THREE.Color(c);
const inView={gps:0,glo:0,gal:0};
function stepSats(){
  const th=S.view==='orb'?OMEGA*tSim:earthG.rotation.y; if(S.view==='orb') earthG.rotation.y=th0+th;
  earthG.updateMatrixWorld(true); const home=homeDot.getWorldPosition(new THREE.Vector3()), hn=home.clone().normalize();
  let nl=0; const sinMask=Math.sin(MASK*D2R);
  CON.forEach(c=>{ const on=S.show[c.k]&&S.view==='orb'; c.g.visible=on; c.rings.visible=S.show.orbits; inView[c.k]=0;
    const col=colV(c.c);
    c.sats.forEach((s,i)=>{ const u=s.u0+c.nmo*tSim; const p=orbPos(c.r,c.inc*D2R,s.raan,u,c.pos[i]);
      /* attitude: z to the Earth, wings across the orbit (along the orbit normal) */
      orbNormal(c.inc*D2R,s.raan,tmpN); tmpZ.copy(p).negate().normalize(); tmpX.copy(tmpN); tmpY.crossVectors(tmpZ,tmpX).normalize(); tmpX.crossVectors(tmpY,tmpZ);
      tmpM.makeBasis(tmpX,tmpY,tmpZ).setPosition(p); c.body.setMatrixAt(i,tmpM); c.wing.setMatrixAt(i,tmpM);
      const d=tmpV.copy(p).sub(home), el_=d.dot(hn)/d.length(); const vis=el_>sinMask; c.vis[i]=vis;
      if(vis){ inView[c.k]++; if(on&&S.show.los&&nl<MAXL){ const o=nl*6; losPos[o]=home.x; losPos[o+1]=home.y; losPos[o+2]=home.z; losPos[o+3]=p.x; losPos[o+4]=p.y; losPos[o+5]=p.z;
        losCol[o]=col.r*.25; losCol[o+1]=col.g*.25; losCol[o+2]=col.b*.25; losCol[o+3]=col.r; losCol[o+4]=col.g; losCol[o+5]=col.b; nl++; } } });
    c.body.instanceMatrix.needsUpdate=true; c.wing.instanceMatrix.needsUpdate=true; });
  losGeo.setDrawRange(0,nl*2); losGeo.attributes.position.needsUpdate=true; losGeo.attributes.color.needsUpdate=true; los.visible=S.view==='orb'&&S.show.los;
}
const th0=-(15)*D2R+0.3;   /* start with Europe and Africa towards the viewer */
earthG.rotation.y=th0;

/* ---------- loop ---------- */
let raf=0, last=0, vis=false, dirty=true, uiT=0;
LAB.visible(root,v=>{ vis=v; if(v){ dirty=true; kick(); } });
function kick(){ if(!raf&&vis) raf=requestAnimationFrame(frame); }
function frame(t){ raf=0; const dt=Math.min(.1,last?(t-last)/1000:.016); last=t; if(!vis){ last=0; return; }
  let more=false;
  const running=S.view==='orb'&&S.speed>0&&!document.hidden;
  if(running){ tSim+=dt*S.speed; more=true; }
  /* inertia and easing */
  if(!drag&&(Math.abs(CAM.vAz)>1e-4||Math.abs(CAM.vEl)>1e-4)){ CAM.tAz+=CAM.vAz; CAM.tEl=Math.max(-1.35,Math.min(1.35,CAM.tEl+CAM.vEl)); CAM.vAz*=.92; CAM.vEl*=.92; more=true; }
  const f=reduced()?1:1-Math.exp(-dt*9);
  CAM.az+=(CAM.tAz-CAM.az)*f; CAM.el+=(CAM.tEl-CAM.el)*f; CAM.dist=Math.exp(Math.log(CAM.dist)+(Math.log(CAM.tDist)-Math.log(CAM.dist))*f);
  if(Math.abs(CAM.tAz-CAM.az)>1e-4||Math.abs(CAM.tEl-CAM.el)>1e-4||Math.abs(CAM.tDist/CAM.dist-1)>1e-4) more=true;
  if(more||dirty){ camPos(); stepSats(); geoMat.uniforms.k.value=S.ex/R_E/1000; renderer.render(scene,camera); labels(W,H); dirty=false;
    uiT+=dt; if(uiT>.25){ uiT=0; chip(); cards(); see(); } }
  if(more) kick(); else last=0; }
document.addEventListener('visibilitychange',()=>{ last=0; kick(); });

/* ---------- view switching ---------- */
function setView(v){ S.view=v; const g=v==='geo';
  conG.visible=!g; geoG.visible=!g&&S.show.egnos; homeDot.visible=!g; geoidG.visible=g; ellG.visible=g&&S.show.grid;
  earth.visible=!g; atm.material.uniforms.k.value=g?.55:1;
  CAM.tDist=VIEWDIST[v]*(g?1:(S.show.egnos?1.3:1)); if(g){ const P=curPlace(); face(P.lat,P.lon); }
  root.dataset.view=v; ui(); dirty=true; kick(); }

/* ---------- controls ---------- */
const tabsE=el('ogTabs');
function tabs(){ tabsE.innerHTML=[['orb',t2('Constellations','Konstellasjoner')],['geo',t2('WGS-84 and the geoid','WGS-84 og geoiden')]].map(([k,n])=>`<button type="button" role="tab" data-v="${k}" class="${S.view===k?'on':''}" aria-selected="${S.view===k}">${L(n)}</button>`).join(''); }
tabsE.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b&&b.dataset.v!==S.view) setView(b.dataset.v); });
const toolsE=el('ogTools');
function tools(){ toolsE.innerHTML=S.view==='orb'?`<button type="button" id="ogPlay" aria-pressed="${S.speed>0}">${S.speed>0?L(t2('❚❚ Pause','❚❚ Pause')):L(t2('▶ Play','▶ Spill'))}</button>`:''; }
toolsE.addEventListener('click',e=>{ if(e.target.closest('#ogPlay')){ S.speed=S.speed>0?0:(lastSpeed||1200); spdSeg.set(String(S.speed)); ui(); kick(); } });
let lastSpeed=1200;
LAB.add({},{'Stop':'Stopp','Bergen':'Bergen','Tromsø':'Tromsø','Iceland':'Island','New Guinea':'Ny-Guinea','Indian Ocean':'Indiahavet','Height exaggeration':'Overdrivelse av høyder'});
const spdSeg=LAB.seg(el('ogSpd'),[['0','Stop'],['300','×300'],['1200','×1200'],['6000','×6000']],String(S.speed),v=>{ S.speed=+v; if(S.speed) lastSpeed=S.speed; ui(); kick(); });
const placeSeg=LAB.seg(el('ogPlace'),PLACES.map(p=>[p[0],p[1].en]),S.place,v=>{ S.place=v; pick=null; place(); const P=curPlace(); face(P.lat,P.lon); ui(); dirty=true; kick(); });
const exSl=LAB.slider(el('ogEx'),{label:'Height exaggeration',min:1,max:10000,step:1,v:S.ex,f:v=>'×'+fmt(v,0),on:v=>{ S.ex=Math.round(v); place(); ui(); dirty=true; kick(); }});
function togs(){ const b=el('ogShow'); const T=S.view==='orb'?[['gps','GPS'],['glo','GLONASS'],['gal','Galileo'],['egnos',t2('EGNOS (SBAS)','EGNOS (SBAS)')],['orbits',t2('Orbits','Baner')],['los',t2('Lines of sight from Bergen','Siktlinjer fra Bergen')]]
  :[['grid',t2('WGS-84 ellipsoid','WGS-84-ellipsoiden')]];
  b.innerHTML=T.map(([k,n])=>`<button type="button" class="xtog" data-k="${k}" aria-pressed="${!!S.show[k]}">${L(n)}</button>`).join(''); }
el('ogShow').addEventListener('click',e=>{ const b=e.target.closest('.xtog'); if(!b) return; const k=b.dataset.k; S.show[k]=!S.show[k];
  if(k==='egnos'){ geoG.visible=S.show.egnos&&S.view==='orb'; CAM.tDist=Math.max(CAM.tDist,S.show.egnos?22:0)||CAM.tDist; if(!S.show.egnos&&CAM.tDist>19) CAM.tDist=VIEWDIST.orb; }
  if(k==='grid') ellG.visible=S.show.grid&&S.view==='geo';
  ui(); dirty=true; kick(); });

/* ---------- readouts ---------- */
const hm=s=>{ const m=Math.round(s/60), h=Math.floor(m/60); return h?`${h} h ${String(m%60).padStart(2,'0')} min`:`${m} min`; };
const kmf=v=>fmt(v,0);
function chip(){ if(S.view==='orb'){ chipE.innerHTML=`<span><i>${L(t2('TIME','TID'))}</i><b>+${hm(tSim)}</b></span><span><i>${L(t2('SPEED','FART'))}</i><b>${S.speed?'×'+fmt(S.speed,0):L(t2('stopped','stoppet'))}</b></span><span><i>${L(t2('IN VIEW AT BERGEN','I SIKTE I BERGEN'))}</i><b class="g">${inView.gps*S.show.gps+inView.glo*S.show.glo+inView.gal*S.show.gal}</b></span>`; }
  else { const P=curPlace(), N=nAt(P.lat,P.lon); chipE.innerHTML=GRID?`<span><i>${L(t2('PLACE','STED'))}</i><b>${L(P.n)} ${fmt(Math.abs(P.lat),1)}°${P.lat>=0?'N':'S'} ${fmt(Math.abs(P.lon),1)}°${P.lon>=0?'E':L(t2('W','V'))}</b></span><span><i>${L(t2('GEOID HEIGHT N','GEOIDEHØYDE N'))}</i><b class="${N>=0?'a':'g'}">${sg(N)} m · ${sg(N*3.28084)} ft</b></span>`:''; } }
function cards(){ const box=el('ogCards');
  if(S.view==='orb'){ box.innerHTML=CON.map(c=>`<div class="og-card c-${c.k}${S.show[c.k]?'':' off'}"><span class="k">${c.n} · ${L(c.who)}</span><b><span>${c.planes}</span> · <span>${fmt(c.inc,c.inc%1?1:0)}°</span> · <span>${kmf(c.alt)}&nbsp;km</span> · <span>${hm(c.T).replace(' min','').replace(' h ','&nbsp;h&nbsp;')}</span></b><span class="s">${L(t2('planes · inclination · altitude · period','baneplan · inklinasjon · høyde · omløpstid'))}</span><span class="v">${L(t2('In view at Bergen','I sikte i Bergen'))}: <b>${S.show[c.k]?inView[c.k]:'–'}</b></span></div>`).join(''); }
  else { const P=curPlace(), N=nAt(P.lat,P.lon), ft=Math.round(N*3.28084);
    box.innerHTML=`<div class="og-card c-gps"><span class="k">${L(t2('GPS uses','GPS bruker'))}</span><b>WGS-84</b><span class="s">${L(t2('GLONASS: PZ-90.11 · Galileo: GTRF, all within a few cm of WGS-84 today','GLONASS: PZ-90.11 · Galileo: GTRF, alle innenfor noen cm av WGS-84 i dag'))}</span></div>`+
     `<div class="og-card c-glo"><span class="k">${L(t2('Sea level','Havnivå'))}</span><b>${L(t2('is not the ellipsoid','er ikke ellipsoiden'))}</b><span class="s">${L(t2('N runs from about −106 m (Indian Ocean) to +85 m (New Guinea)','N går fra omtrent −106 m (Indiahavet) til +85 m (Ny-Guinea)'))}</span></div>`+
     `<div class="og-card c-gal"><span class="k">${L(t2('So correct GNSS heights','Så korriger GNSS-høyder'))}</span><b>H = h − N</b><span class="s">${L(t2('height above MSL = ellipsoid height − geoid height','høyde over MSL = ellipsoidehøyde − geoidehøyde'))}</span></div>`+
     `<div class="og-card c-home"><span class="k">${L(t2('Here','Her'))}: ${L(P.n)}</span><b>${GRID?`N = ${sg(N)} m`:'…'}</b><span class="s">${GRID?L(t2(`At 3000 ft MSL the uncorrected GNSS height reads ${fmt(3000+ft,0)} ft (${sg(ft)} ft).`,`I 3000 ft MSL viser ukorrigert GNSS-høyde ${fmt(3000+ft,0)} ft (${sg(ft)} ft).`)):''}</span></div>`; } }
function see(){ const P=curPlace(), N=nAt(P.lat,P.lon);
  el('ogSee').innerHTML=S.view==='orb'?L(t2(
   `<b>What you're seeing:</b> GPS, GLONASS and Galileo in medium Earth orbit, 19 000–23 000 km up, with the Earth turning under them. The thin lines join Bergen to every satellite above the 5° mask: <b>${inView.gps*S.show.gps+inView.glo*S.show.glo+inView.gal*S.show.gal}</b> right now. At 60°N the orbits, tilted 55–65°, never pass overhead, so most satellites sit to the south.`,
   `<b>Dette ser du:</b> GPS, GLONASS og Galileo i middels høy bane, 19 000–23 000 km oppe, med jorden som roterer under dem. De tynne linjene går fra Bergen til hver satellitt over 5° maskevinkel: <b>${inView.gps*S.show.gps+inView.glo*S.show.glo+inView.gal*S.show.gal}</b> akkurat nå. På 60°N går banene, som heller 55–65°, aldri rett over, så de fleste satellittene står i sør.`))
  :L(t2(`<b>What you're seeing:</b> the white net is WGS-84, the smooth shape GNSS measures height from. The coloured glass is mean sea level (the geoid), blue below the ellipsoid, red above, exaggerated ×${fmt(S.ex,0)}. ${GRID?`At ${L(P.n)} it lies ${fmt(Math.abs(N),0)} m ${N>=0?'above':'below'} the ellipsoid.`:''} Tap anywhere on the globe to read N there.`,
   `<b>Dette ser du:</b> det hvite nettet er WGS-84, den glatte formen GNSS måler høyden fra. Det fargede glasset er middelvannstanden (geoiden), blått under ellipsoiden, rødt over, overdrevet ×${fmt(S.ex,0)}. ${GRID?`I ${L(P.n)} ligger den ${fmt(Math.abs(N),0)} m ${N>=0?'over':'under'} ellipsoiden.`:''} Trykk hvor som helst på kloden for å lese N der.`)); }
function ui(){ tabs(); tools(); togs(); chip(); cards(); see(); el('ogOrbCtl').hidden=S.view!=='orb'; el('ogGeoCtl').hidden=S.view!=='geo'; }

/* static text */
function txt(){ el('ogHint').textContent=L(t2('Drag to turn it','Dra for å snu')); el('ogZin').setAttribute('aria-label',L(t2('Zoom in','Zoom inn'))); el('ogZout').setAttribute('aria-label',L(t2('Zoom out','Zoom ut')));
  cv.setAttribute('aria-label',L(t2('3D globe with the GNSS constellations and the geoid. Drag to turn it, use + and − to zoom.','3D-klode med GNSS-konstellasjonene og geoiden. Dra for å snu den, bruk + og − for å zoome.')));
  loadE.textContent=L(t2('Loading the Earth…','Laster jorden …'));
  const X=[['ogH',t2('The satellites and the Earth','Satellittene og jorden')],
   ['ogLead',t2('Drag the globe to turn it. Under <b>Constellations</b>, watch GPS, GLONASS and Galileo fly their orbits and see which satellites Bergen can use. Under <b>WGS-84 and the geoid</b>, see why GNSS height is not height above sea level.','Dra i kloden for å snu den. Under <b>Konstellasjoner</b> ser du GPS, GLONASS og Galileo fly banene sine, og hvilke satellitter Bergen kan bruke. Under <b>WGS-84 og geoiden</b> ser du hvorfor GNSS-høyde ikke er høyde over havet.')],
   ['ogCtlS',t2('Controls','Kontroller')],['ogHTime',t2('Time','Tid')],['ogHShow1',t2('Show','Vis')],['ogHPlace',t2('Place','Sted')],['ogHScale',t2('Scale','Skala')],
   ['ogTimeHint',t2('×1200: one second on screen is 20 minutes. A GPS satellite goes round in just under 12 hours.','×1200: ett sekund på skjermen er 20 minutter. En GPS-satellitt går rundt på knapt 12 timer.')],
   ['ogPlaceHint',t2('Or tap anywhere on the globe.','Eller trykk hvor som helst på kloden.')],
   ['ogExHint',t2('At ×1 the bumps are under 0.002 % of the Earth’s radius and cannot be seen.','Ved ×1 er ujevnhetene under 0,002 % av jordradien og kan ikke sees.')]];
  X.forEach(([id,o])=>{ const e=el(id); if(e) e.innerHTML=L(o); }); }
LAB.onLang(()=>{ txt(); ui(); dirty=true; kick(); });
txt(); setView('orb');

/* Reset: back to the starting values, same view */
LAB.reset(()=>{ const v=S.view; Object.assign(S,JSON.parse(JSON.stringify(S0))); S.view=v; pick=null; tSim=0; earthG.rotation.y=th0;
  spdSeg.set(String(S.speed)); placeSeg.set(S.place); exSl.set(S.ex); CAM.tAz=.30; CAM.tEl=.42; setView(v); place(); },root);

if(reduced()){ S.speed=0; spdSeg.set('0'); ui(); }

/* for the key-concept cards */
window.GNSSGLOBE={ show(v,o){ o=o||{}; if(o.place){ S.place=o.place; pick=null; placeSeg.set(o.place); place(); }
  if(o.ex){ S.ex=o.ex; exSl.set(o.ex); place(); } if(o.show) Object.assign(S.show,o.show); setView(v); } };
})();
