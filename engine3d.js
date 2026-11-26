/* NORDAP – engine3d.js: the Engines lab in 3D (three.js r128, no external assets).
   Core: renderer, studio lighting, materials, quarter cutaway, orbit camera, gas-path particles coloured by temperature,
   labels, a guided walk along the gas path, and "Take it apart" in 3D.
   The engines themselves are built in engine3d-models.js (window.E3M); their modules carry the same part ids as
   engparts.js, so the 2D parts list and its texts work unchanged.
   API: ENG3D.ok · ENG3D.mount(host,o) · ENG3D.active(on) · ENG3D.refresh() · ENG3D.step(i) · ENG3D.view() */
(function(){
'use strict';
const THREE=window.THREE;
const canGL=(()=>{ try{ const c=document.createElement('canvas'); return !!(c.getContext('webgl2')||c.getContext('webgl')); }catch(e){ return false; } })();
if(!THREE||!canGL||!window.E3M){ window.ENG3D={ok:false}; return; }

const t2=(en,no)=>({en,no}), TAU=Math.PI*2, D2R=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const SC=['#9fb0bd','#7EC8F2','#6FD3C0','#F5B85C','#F2A08C','#C9B6F2'];
const SN=[t2('',''),t2('Intake','Innsug'),t2('Compression','Kompresjon'),t2('Combustion','Forbrenning'),t2('Exhaust','Eksos'),t2('Drive','Drivverk')];
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const V3=(x,y,z)=>new THREE.Vector3(x||0,y||0,z||0);

/* ---------- temperature colour (kelvin), the same scale as the 2D lab ---------- */
const TST=[[230,[61,127,208]],[330,[94,192,216]],[560,[232,212,106]],[850,[240,154,62]],[1250,[232,80,58]],[1900,[255,236,214]]];
function tcol(K,o){ let i=0; while(i<TST.length-2&&K>TST[i+1][0]) i++; const [k0,c0]=TST[i],[k1,c1]=TST[i+1], f=clamp((K-k0)/(k1-k0),0,1);
  o[0]=(c0[0]+(c1[0]-c0[0])*f)/255; o[1]=(c0[1]+(c1[1]-c0[1])*f)/255; o[2]=(c0[2]+(c1[2]-c0[2])*f)/255; return o; }

/* ---------- materials ---------- */
const MP={ screen:{color:0xb9c0c6,metalness:0.9,roughness:0.35},
  paint:{color:0xdfe3e7,metalness:0.04,roughness:0.38}, liner:{color:0x59616a,metalness:0.25,roughness:0.75},
  alu:{color:0xa9b1b9,metalness:0.78,roughness:0.36}, case:{color:0x828b94,metalness:0.82,roughness:0.4},
  dark:{color:0x394047,metalness:0.6,roughness:0.55}, ti:{color:0xb6bdc4,metalness:0.94,roughness:0.22},
  steel:{color:0xc6ccd2,metalness:0.96,roughness:0.2}, blade:{color:0xc2c9cf,metalness:0.95,roughness:0.21},
  hot:{color:0xa98d70,metalness:0.86,roughness:0.34}, tbc:{color:0xc9c0ae,metalness:0.12,roughness:0.62}, flame:{color:0x9c8f7f,metalness:0.7,roughness:0.45},
  exh:{color:0x7d7066,metalness:0.8,roughness:0.44}, cast:{color:0x949ca3,metalness:0.5,roughness:0.62},
  iron:{color:0x4b5157,metalness:0.72,roughness:0.48}, black:{color:0x1d2125,metalness:0.25,roughness:0.5},
  white:{color:0xeef0f2,metalness:0.08,roughness:0.32}, copper:{color:0xb87a45,metalness:0.92,roughness:0.34},
  rubber:{color:0x22262a,metalness:0.0,roughness:0.85}, brass:{color:0xc4a466,metalness:0.9,roughness:0.3},
  blue:{color:0x3d6fa8,metalness:0.3,roughness:0.45}
};
const CUTCOL=0x8a3322;

/* ---------- geometry helpers (engine axis = +x) ---------- */
function latheGeo(loop,segs,phi0,phiLen,cols){
  const pts=loop.map(p=>new THREE.Vector2(Math.max(0,p[1]),p[0]));
  const g=new THREE.LatheGeometry(pts,segs||96,phi0||0,phiLen||TAU); g.rotateZ(-Math.PI/2);
  if(cols){ const n=pts.length, cnt=g.attributes.position.count, a=new Float32Array(cnt*3), c=new THREE.Color();
    for(let v=0;v<cnt;v++){ c.set(cols[v%n]).convertSRGBToLinear(); a[v*3]=c.r; a[v*3+1]=c.g; a[v*3+2]=c.b; }
    g.setAttribute('color',new THREE.BufferAttribute(a,3)); }
  return g; }
/* closed wall section from an outer and an inner line, both listed front to back; corners kept sharp */
function ringLoop(outer,inner){ const o=outer.slice(), i=inner.slice().reverse();
  return [o[0],...o,o[o.length-1],i[0],...i,i[i.length-1],o[0]]; }
function wallLoop(line,t){ return ringLoop(line.map(p=>[p[0],p[1]+t/2]),line.map(p=>[p[0],Math.max(0,p[1]-t/2)])); }
/* NACA-like aerofoil blade; local frame: x axial, y radial (span), z tangential */
function bladeGeo(o){ const nc=o.nc||8, ns=o.ns||5, rings=[];
  const thick=x=>5*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1036*x*x*x*x);
  for(let j=0;j<=ns;j++){ const f=j/ns, r=lerp(o.r0,o.r1,f), c=lerp(o.c0,o.c1??o.c0,f), st=lerp(o.s0,o.s1??o.s0,f)*D2R, th=lerp(o.t0??0.08,o.t1??o.t0??0.08,f), cm=lerp(o.m0??0.05,o.m1??o.m0??0.05,f);
    const cs=Math.cos(st), sn=Math.sin(st), sw=(o.sw||0)*f*f, ln=(o.ln||0)*f*f, sec=[];
    const P=(xc,yv)=>{ const u=(xc-0.5)*c, v=yv*c; sec.push([u*cs-v*sn+sw, r, u*sn+v*cs+ln]); };
    for(let i=0;i<=nc;i++){ const xc=(1-Math.cos(Math.PI*i/nc))/2; P(xc,cm*4*xc*(1-xc)+thick(xc)*th); }
    for(let i=nc-1;i>=1;i--){ const xc=(1-Math.cos(Math.PI*i/nc))/2; P(xc,cm*4*xc*(1-xc)-thick(xc)*th); }
    rings.push(sec); }
  const m=rings[0].length, pos=[], idx=[];
  rings.forEach(s=>s.forEach(p=>pos.push(p[0],p[1],p[2])));
  for(let j=0;j<ns;j++) for(let i=0;i<m;i++){ const a=j*m+i, b=j*m+(i+1)%m, c=(j+1)*m+i, d=(j+1)*m+(i+1)%m; idx.push(a,b,d,a,d,c); }
  for(const j of [0,ns]){ const s=rings[j]; let cx=0,cy=0,cz=0; s.forEach(p=>{ cx+=p[0]; cy+=p[1]; cz+=p[2]; }); const ci=pos.length/3; pos.push(cx/m,cy/m,cz/m);
    for(let i=0;i<m;i++){ const a=j*m+i, b=j*m+(i+1)%m; j?idx.push(ci,a,b):idx.push(ci,b,a); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
  if(o.tip){ const cnt=g.attributes.position.count, a=new Float32Array(cnt*3), c0=new THREE.Color(o.col||0x1d2125).convertSRGBToLinear(), c1=new THREE.Color(o.tip).convertSRGBToLinear();
    for(let v=0;v<cnt;v++){ const y=g.attributes.position.getY(v), tf=(y-o.r0)/(o.r1-o.r0), c=tf>o.tipAt?c1:c0; a[v*3]=c.r; a[v*3+1]=c.g; a[v*3+2]=c.b; }
    g.setAttribute('color',new THREE.BufferAttribute(a,3)); }
  return g; }
function gearGeo(r,z,w,hole){ const s=new THREE.Shape(), h=Math.min(r*0.16,0.022), rr=r-h;
  for(let k=0;k<z;k++){ const a=k*TAU/z, d=TAU/z;
    const pts=[[rr,a],[rr,a+d*0.18],[r,a+d*0.32],[r,a+d*0.58],[rr,a+d*0.72]];
    pts.forEach(([R,A],i)=>{ const x=R*Math.cos(A), y=R*Math.sin(A); (k===0&&i===0)?s.moveTo(x,y):s.lineTo(x,y); }); }
  s.closePath(); if(hole){ const p=new THREE.Path(); p.absarc(0,0,hole,0,TAU,true); s.holes.push(p); }
  const g=new THREE.ExtrudeGeometry(s,{depth:w,bevelEnabled:false,curveSegments:6}); g.translate(0,0,-w/2); g.rotateY(Math.PI/2); return g; }

/* ---------- studio environment (reflections only) ---------- */
function envMap(renderer){
  const sc=new THREE.Scene();
  const sg=new THREE.SphereGeometry(40,48,24), pc=sg.attributes.position, col=new Float32Array(pc.count*3), top=new THREE.Color(0.78,0.83,0.88), hor=new THREE.Color(0.42,0.47,0.53), bot=new THREE.Color(0.1,0.12,0.14), c=new THREE.Color();
  for(let i=0;i<pc.count;i++){ const y=pc.getY(i)/40; if(y>0) c.copy(hor).lerp(top,Math.pow(y,0.6)); else c.copy(hor).lerp(bot,Math.pow(-y,0.45)); col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; }
  sg.setAttribute('color',new THREE.BufferAttribute(col,3));
  const sky=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false}));
  sc.add(sky);
  const box=(w,h,x,y,z,i)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(i,i,i),side:THREE.DoubleSide})); m.position.set(x,y,z); m.lookAt(0,0,0); sc.add(m); };
  box(26,8,0,30,10,3.2); box(10,30,-34,6,-8,1.6); box(10,24,32,4,14,1.9); box(30,4,0,-6,-36,0.9); box(18,6,10,14,-30,1.2);
  const pm=new THREE.PMREMGenerator(renderer); const rt=pm.fromScene(sc,0.035); pm.dispose(); return rt.texture; }
let GRID=null; function gridTex(){ if(GRID) return GRID; const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); g.fillStyle='#000'; g.fillRect(0,0,64,64); g.fillStyle='#fff'; for(let i=0;i<64;i+=8){ g.fillRect(i,0,2,64); g.fillRect(0,i,64,2); }
  GRID=new THREE.CanvasTexture(c); GRID.wrapS=GRID.wrapT=THREE.RepeatWrapping; GRID.repeat.set(28,6); return GRID; }
function shadowTex(){ const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d'), gr=g.createRadialGradient(128,128,8,128,128,128);
  gr.addColorStop(0,'rgba(0,0,0,.55)'); gr.addColorStop(0.55,'rgba(0,0,0,.22)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,256,256); return new THREE.CanvasTexture(c); }
function dotTex(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'), gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.35,'rgba(255,240,210,.85)'); gr.addColorStop(1,'rgba(255,170,80,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); }

/* ======================================================================= */
const R={host:null,o:null,on:false,type:null,lay:null,built:{},cur:null,need:true,last:0,t:0,slow:false,cut:true,flow:true,labels:true,step:-1,play:false,playT:0,dirtyUI:true};

function init(){
  const host=R.host;
  const cv=document.createElement('canvas'); cv.className='e3cv'; cv.tabIndex=0; cv.setAttribute('role','img'); host.appendChild(cv); R.cv=cv;
  const rd=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'});
  rd.setPixelRatio(Math.min(2,window.devicePixelRatio||1)); rd.outputEncoding=THREE.sRGBEncoding; rd.toneMapping=THREE.ACESFilmicToneMapping; rd.toneMappingExposure=1.0;
  rd.localClippingEnabled=true; rd.setClearColor(0x000000,0); R.rd=rd;
  const sc=new THREE.Scene(); sc.environment=envMap(rd); R.sc=sc;
  R.cam=new THREE.PerspectiveCamera(32,1.6,0.05,200);
  sc.add(new THREE.HemisphereLight(0xdde6ee,0x1a2026,0.55));
  const k=new THREE.DirectionalLight(0xffffff,1.35); k.position.set(-4,7,6); sc.add(k);
  const f=new THREE.DirectionalLight(0xbfd6ec,0.45); f.position.set(6,2,-5); sc.add(f);
  const rim=new THREE.DirectionalLight(0xffffff,0.35); rim.position.set(2,-3,8); sc.add(rim);
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false,opacity:0.7}));
  sh.rotation.x=-Math.PI/2; sc.add(sh); R.shadow=sh;
  /* clipping: a quarter (y>0 and z>0) or the top half, switched by moving the planes */
  R.clip=[new THREE.Plane(V3(0,-1,0),0),new THREE.Plane(V3(0,0,-1),0)];
  R.capMat=new THREE.MeshBasicMaterial({color:new THREE.Color(CUTCOL).convertSRGBToLinear(),side:THREE.BackSide,clippingPlanes:R.clip,clipIntersection:true,toneMapped:false});
  /* particles */
  R.flowPts=mkPoints(3200); sc.add(R.flowPts.obj);
  R.tracer=mkPoints(90); R.tracer.obj.renderOrder=5; R.tracer.mat.depthTest=false; R.tracer.mat.uniforms.mx.value=26; sc.add(R.tracer.obj);
  /* flame/spark sprites */
  R.dot=dotTex();
  /* overlay */
  const tags=document.createElement('div'); tags.className='e3tags'; host.appendChild(tags); R.tags=tags;
  const tools=document.createElement('div'); tools.className='e3tools'; host.appendChild(tools); R.tools=tools;
  const hint=document.createElement('div'); hint.className='e3hint'; host.appendChild(hint); R.hint=hint;
  const walk=document.createElement('div'); walk.className='e3walk'; host.parentNode.insertBefore(walk,host.nextSibling); R.walk=walk;
  tools.addEventListener('click',onTool); walk.addEventListener('click',onWalk);
  orbitInit(cv);
  new ResizeObserver(()=>{ resize(); }).observe(host);
  document.addEventListener('visibilitychange',()=>{ R.last=0; });
  resize(); requestAnimationFrame(loop); }

function resize(){ if(!R.rd) return; const w=R.host.clientWidth, h=R.host.clientHeight; if(!w||!h) return; R.rd.setSize(w,h,false); R.cam.aspect=w/h; R.cam.updateProjectionMatrix(); R.W=w; R.H=h; R.flowPts.mat.uniforms.px.value=h*R.rd.getPixelRatio(); R.tracer.mat.uniforms.px.value=h*R.rd.getPixelRatio(); R.need=true; }

/* ---------- points (particles) ---------- */
function mkPoints(n){ const g=new THREE.BufferGeometry();
  const P=new Float32Array(n*3), C=new Float32Array(n*3), S=new Float32Array(n), A=new Float32Array(n);
  g.setAttribute('position',new THREE.BufferAttribute(P,3)); g.setAttribute('color',new THREE.BufferAttribute(C,3)); g.setAttribute('size',new THREE.BufferAttribute(S,1)); g.setAttribute('alpha',new THREE.BufferAttribute(A,1));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{px:{value:600},mx:{value:9}},
    vertexShader:'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float px; uniform float mx; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(size*px/(-mv.z),1.5,mx); vC=color; vA=alpha; }',
    fragmentShader:'varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-.5; float r=length(d); if(r>.5) discard; float a=smoothstep(.5,.08,r); gl_FragColor=vec4(mix(vC,vec3(1.),smoothstep(.22,.0,r)*.35),a*vA); }'});
  const obj=new THREE.Points(g,mat); obj.frustumCulled=false; g.setDrawRange(0,0);
  return {obj,g,mat,P,C,S,A,n}; }

/* ======================= building an engine ======================= */
function builder(key){
  const root=new THREE.Group(), parts={}, spin=[], gates={}, fx=[], tick=[]; let cur=null;
  const B={THREE,TAU,D2R,lerp,clamp,V3,latheGeo,ringLoop,wallLoop,bladeGeo,gearGeo,root,parts,spin,fx,tick,gates};
  B.part=(id,st,ex,o)=>{ const g=new THREE.Group(); g.name=id; root.add(g); cur=parts[id]={id,st,ex:V3(...(ex||[0,0,0])),g,mats:{},list:[],anchor:V3(...((o&&o.at)||[0,0,0])),noclip:!!(o&&o.noclip)}; return g; };
  B.use=id=>{ cur=parts[id]; return cur.g; };
  B.at=(x,y,z)=>{ cur.anchor.set(x,y,z); };
  B.mat=(k,o)=>{ o=o||{}; const key=k+(o.vc?':vc':'')+(o.ds?':ds':'')+(o.em?':em':''); if(cur.mats[key]) return cur.mats[key];
    const p=Object.assign({},MP[k]||MP.alu); if(o.vc){ p.vertexColors=true; p.color=0xffffff; }
    const m=new THREE.MeshStandardMaterial(p); m.color.convertSRGBToLinear(); m.envMapIntensity=0.95; if(o.ds) m.side=THREE.DoubleSide;
    if(k==='screen'){ m.alphaMap=gridTex(); m.alphaTest=0.5; m.side=THREE.DoubleSide; }
    if(!cur.noclip){ m.clippingPlanes=R.clip; m.clipIntersection=true; }
    m.userData.base={color:m.color.clone(),em:m.emissive.clone()}; cur.mats[key]=m; cur.list.push(m); return m; };
  B.add=(obj,par)=>{ (par||cur.g).add(obj); obj.traverse(o=>{ if(o.isMesh){ o.userData.part=cur.id; } }); return obj; };
  B.mesh=(geo,k,o,par)=>{ o=o||{}; const m=new THREE.Mesh(geo,B.mat(k,{vc:!!geo.attributes.color,ds:o.ds})); if(o.pos) m.position.set(...o.pos); if(o.rot) m.rotation.set(...o.rot); B.add(m,par);
    if(o.cap!==false&&!cur.noclip&&!o.ds){ const c=new THREE.Mesh(geo,R.capMat); c.userData.cap=1; c.raycast=()=>{}; m.add(c); } return m; };
  B.lathe=(loop,k,o,par)=>{ o=o||{}; return B.mesh(latheGeo(loop,o.segs||96,o.phi0,o.phiLen,o.cols),k,o,par); };
  B.wall=(line,t,k,o,par)=>B.lathe(wallLoop(line,t),k,o,par);
  B.rotor=(spool,par)=>{ const g=new THREE.Group(); g.userData.spool=spool; (par||cur.g).add(g); spin.push(g); return g; };
  /* a blade row: o {x,n,r0,r1,c0,c1,s0,s1,t0,t1,m0,m1,k (material),phase,nc,ns,sw,ln} */
  B.row=(o,par)=>{ const g=bladeGeo(o), m=new THREE.InstancedMesh(g,B.mat(o.k||'blade',{ds:true,vc:!!g.attributes.color}),o.n), M=new THREE.Matrix4();
    for(let i=0;i<o.n;i++){ M.makeRotationX((o.phase||0)+i*TAU/o.n); M.setPosition(o.x,o.y||0,o.z||0); m.setMatrixAt(i,M); }
    m.instanceMatrix.needsUpdate=true; return B.add(m,par); };
  /* repeated objects round the axis */
  B.around=(geo,k,n,place,par,o)=>{ const m=new THREE.InstancedMesh(geo,B.mat(k,o),n), M=new THREE.Matrix4(), q=new THREE.Quaternion(), s=V3(1,1,1), p=V3(), e=new THREE.Euler();
    for(let i=0;i<n;i++){ const r=place(i,p,e,s); q.setFromEuler(e); M.compose(p,q,s); m.setMatrixAt(i,M); void r; } m.instanceMatrix.needsUpdate=true; return B.add(m,par); };
  B.cyl=(r0,r1,len,k,o,par)=>{ o=o||{}; const g=new THREE.CylinderGeometry(r1,r0,len,o.seg||32,1,!!o.open); g.rotateZ(-Math.PI/2); return B.mesh(g,k,o,par); }; // along +x (r0 at -x end)
  B.box=(w,h,d,k,o,par)=>B.mesh(new THREE.BoxGeometry(w,h,d),k,o,par);
  B.sphere=(r,k,o,par)=>B.mesh(new THREE.SphereGeometry(r,24,16),k,o,par);
  B.tube=(pts,r,k,o,par)=>{ o=o||{}; const cu=new THREE.CatmullRomCurve3(pts.map(p=>V3(...p)),false,'catmullrom',0.4); return B.mesh(new THREE.TubeGeometry(cu,o.seg||48,r,o.rs||14,false),k,Object.assign({cap:false},o),par); };
  B.gear=(r,z,w,k,o,par)=>B.mesh(gearGeo(r,z,w,o&&o.hole),k,Object.assign({cap:true},o||{}),par);
  /* glowing volume (flame, charge in a cylinder); additive, clipped like the rest */
  B.glow=(geo,col,par,o)=>{ o=o||{}; const m=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0,blending:o.normal?THREE.NormalBlending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    if(!o.noclip){ m.clippingPlanes=R.clip; m.clipIntersection=true; } const me=new THREE.Mesh(geo,m); me.raycast=()=>{}; me.renderOrder=3; (par||cur.g).add(me); fx.push(me); return me; };
  B.sprite=(col,size,par)=>{ const m=new THREE.SpriteMaterial({map:R.dot,color:col,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,opacity:0}); const s=new THREE.Sprite(m); s.scale.set(size,size,size); s.renderOrder=6; (par||cur.g).add(s); return s; };
  return B; }

function build(key){ if(R.built[key]) return R.built[key];
  const def=window.E3M[key], B=builder(key); def.build(B);
  const box=new THREE.Box3().setFromObject(B.root), c=box.getCenter(V3()), sz=box.getSize(V3());
  const exBox=box.clone(); for(const id in B.parts){ const p=B.parts[id]; if(p.exf) p.exf(1); const pb=new THREE.Box3().setFromObject(p.g); if(p.exf) p.exf(0); if(!pb.isEmpty()){ pb.translate(p.ex); exBox.union(pb); } }
  if(def.cut!=='top') for(const id in B.parts){ const p=B.parts[id], pb=new THREE.Box3().setFromObject(p.g); if(pb.isEmpty()) continue; const pc=pb.getCenter(V3()), ps=pb.getSize(V3());
    const r=Math.max(ps.y,ps.z)/2, ax=Math.abs(pc.y)<0.05&&Math.abs(pc.z)<0.05; p.anchor.copy(ax?V3(pc.x,r*0.62,r*0.62):V3(pc.x,pc.y+ps.y*0.3,pc.z+ps.z*0.3)); }
  const E={key,def,root:B.root,parts:B.parts,spin:B.spin,tick:B.tick,center:c,size:sz,box,exBox,streams:compile(def.streams||[])};
  B.root.visible=false; R.sc.add(B.root); R.built[key]=E; return E; }

/* ---------- gas-path streams ---------- */
/* stream: {axi:true, p:[[x,r,key,w,v?]...]} round the axis, or {p:[[x,y,z,key,w,v?]...]} along a 3D line.
   optional: n (particles), sp (speed, units/s at full power), swirl, stacks:[angles], from (point index where the stacks pull starts), gate (key) */
function compile(list){ return list.map(s=>{ const pts=s.p.map(q=>s.axi?{x:q[0],r:q[1],k:q[2],w:q[3]||0.04,v:q[4]||1}:{x:q[0],y:q[1],z:q[2],k:q[3],w:q[4]||0.03,v:q[5]||1});
  const len=[0]; for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i]; const d=s.axi?Math.hypot(b.x-a.x,b.r-a.r):Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z); len.push(len[i-1]+d/((a.v+b.v)/2)); }
  return Object.assign({},s,{pts,len,tot:len[len.length-1],T:pts.map(()=>288)}); }); }
function seg(S,u){ const L=u*S.tot; let i=1; while(i<S.len.length-1&&S.len[i]<L) i++; const f=clamp((L-S.len[i-1])/((S.len[i]-S.len[i-1])||1),0,1); return [i-1,f]; }
const _c=[0,0,0];
function place(S,u,th,j,k,out){ const [i,f]=seg(S,u), a=S.pts[i], b=S.pts[i+1]||a;
  if(S.axi){ const x=lerp(a.x,b.x,f), r=Math.max(0,lerp(a.r,b.r,f)+j*lerp(a.w,b.w,f)); let t=th;
    if(S.stacks&&i>=S.from){ const tgt=S.stacks.reduce((best,s)=>Math.abs(angDiff(s,th))<Math.abs(angDiff(best,th))?s:best,S.stacks[0]); const g=clamp((i-S.from+f)/(S.pts.length-1-S.from),0,1); t=th+angDiff(tgt,th)*Math.min(1,g*1.6+0.25); }
    out.set(x,r*Math.cos(t),r*Math.sin(t)); }
  else { const w=lerp(a.w,b.w,f); out.set(lerp(a.x,b.x,f),lerp(a.y,b.y,f)+j*w,lerp(a.z,b.z,f)+k*w); }
  return lerp(S.T[i],S.T[i+1]??S.T[i],f); }
const angDiff=(a,b)=>{ let d=a-b; while(d>Math.PI) d-=TAU; while(d<-Math.PI) d+=TAU; return d; };

let PART=[];
function seedFlow(E){ PART=[]; const tot=E.streams.reduce((s,x)=>s+(x.n||400),0), f=Math.min(1,R.flowPts.n/Math.max(1,tot))*(R.W&&R.W<640?0.7:1);
  E.streams.forEach((S,idx)=>{ const m=Math.round((S.n||400)*f); for(let i=0;i<m;i++) PART.push({s:idx,u:Math.random(),th:Math.random()*TAU,j:Math.random()-0.5,k:Math.random()-0.5,sz:0.6+Math.random()*0.7}); });
  R.flowPts.g.setDrawRange(0,PART.length); }
const _p=V3();
function stepFlow(E,dt,run){ const F=R.flowPts, on=R.flow&&R.o.state().mode==='walk'; F.obj.visible=on&&PART.length>0; if(!F.obj.visible) return;
  const sp=(R.slow?0.16:1)*(0.18+0.82*run.pwr), base=(E.def.psize||0.028)*1.45, ts=R.step>=0&&E.def.tour[R.step].trace, keep=ts?ts[0]:-1;
  for(let n=0;n<PART.length;n++){ const q=PART[n], S=E.streams[q.s], gate=S.gate?run.gates[S.gate]??0:1;
    q.u+=dt*sp*(S.sp||1.2)/S.tot*gate; if(q.u>=1){ q.u-=1; q.th=Math.random()*TAU; q.j=Math.random()-0.5; q.k=Math.random()-0.5; }
    if(S.swirl) q.th+=dt*sp*S.swirl;
    const T=place(S,q.u,q.th,q.j,q.k,_p); F.P[n*3]=_p.x; F.P[n*3+1]=_p.y; F.P[n*3+2]=_p.z;
    tcol(T,_c); F.C[n*3]=_c[0]; F.C[n*3+1]=_c[1]; F.C[n*3+2]=_c[2];
    F.S[n]=base*q.sz*(S.size||1); F.A[n]=(S.alpha||0.9)*Math.min(1,q.u*25)*Math.min(1,(1-q.u)*14)*(keep>=0&&q.s!==keep&&!S.gate?0.3:1); }
  F.g.attributes.position.needsUpdate=true; F.g.attributes.color.needsUpdate=true; F.g.attributes.size.needsUpdate=true; F.g.attributes.alpha.needsUpdate=true; }
/* the tracer: one bright parcel of air, with a tail, moving through the part of the path the current step is about */
const TRC={u:0,hist:[]};
function stepTracer(E,dt){ const T=R.tracer, st=R.step>=0&&E.def.tour[R.step], on=st&&st.trace&&R.o.state().mode==='walk'&&!reduce; T.obj.visible=!!on; if(!on){ TRC.hist=[]; return; }
  const [si,i0,i1]=st.trace, S=E.streams[si]; if(!S){ T.obj.visible=false; return; }
  const u0=S.len[i0]/S.tot, u1=S.len[Math.min(i1,S.len.length-1)]/S.tot, dur=Math.max(2.2,(u1-u0)*S.tot*2.2);
  TRC.u+=dt/dur; if(TRC.u>1.35){ TRC.u=0; TRC.hist=[]; }
  const u=lerp(u0,u1,Math.min(1,TRC.u)), th=E.def.traceTh??0.78; const K=place(S,u,th,0,0,_p);
  if(TRC.u<=1){ TRC.hist.unshift([_p.x,_p.y,_p.z,K]); if(TRC.hist.length>60) TRC.hist.pop(); } else if(TRC.hist.length) TRC.hist.pop();
  const n=TRC.hist.length, fade=TRC.u>1?Math.max(0,1-(TRC.u-1)/0.35):1; T.g.setDrawRange(0,n);
  for(let k=0;k<n;k++){ const h=TRC.hist[k]; T.P[k*3]=h[0]; T.P[k*3+1]=h[1]; T.P[k*3+2]=h[2]; tcol(h[3],_c); const w=k?0.25:0; T.C[k*3]=lerp(_c[0],1,w); T.C[k*3+1]=lerp(_c[1],1,w); T.C[k*3+2]=lerp(_c[2],1,w);
    T.S[k]=(E.def.psize||0.028)*(k?2.6*(1-k/n):5.2); T.A[k]=(k?0.75*(1-k/n):1)*fade; }
  T.g.attributes.position.needsUpdate=true; T.g.attributes.color.needsUpdate=true; T.g.attributes.size.needsUpdate=true; T.g.attributes.alpha.needsUpdate=true; }

/* ======================= camera ======================= */
const CAM={tgt:V3(),az:55,el:22,dist:6,goal:null,user:0};
function camPos(){ const a=CAM.az*D2R, e=CAM.el*D2R; R.cam.position.set(CAM.tgt.x-Math.cos(e)*Math.cos(a)*CAM.dist,CAM.tgt.y+Math.sin(e)*CAM.dist,CAM.tgt.z+Math.cos(e)*Math.sin(a)*CAM.dist); R.cam.lookAt(CAM.tgt); }
function camGo(g,inst){ const E=R.cur; const t=V3(g[0],g[1],g[2]).add(E.root.position); const goal={tgt:t,az:g[3],el:g[4],dist:g[5]*(R.W<640?1.35:1)};
  if(inst||reduce){ CAM.tgt.copy(goal.tgt); CAM.az=goal.az; CAM.el=goal.el; CAM.dist=goal.dist; CAM.goal=null; } else CAM.goal=goal; R.need=true; }
function camHome(inst){ const E=R.cur; if(!E) return; const ap=R.o.state().mode==='apart', h=E.def.home||[0,0,0,52,20];
  const b=ap?E.exBox:E.box, c=b.getCenter(V3()), sz=b.getSize(V3()), asp=Math.max(1,(R.W||800)/(R.H||480));
  const span=Math.max(sz.x/Math.min(asp,1.7)*1.25,sz.y,sz.z)*(E.def.fit||1.0);
  camGo([c.x+h[0],c.y+h[1],c.z+h[2],ap?(E.def.apAz??h[3]):h[3],ap?(E.def.apEl??h[4]):h[4],span*(ap?2.2:2.45)],inst); }
function camStep(dt){ if(!CAM.goal) return false; const k=1-Math.exp(-dt*3.4), G=CAM.goal;
  CAM.tgt.lerp(G.tgt,k); CAM.az+=angDiff(G.az*D2R,CAM.az*D2R)/D2R*k; CAM.el=lerp(CAM.el,G.el,k); CAM.dist=lerp(CAM.dist,G.dist,k);
  if(CAM.tgt.distanceTo(G.tgt)<0.002&&Math.abs(G.dist-CAM.dist)<0.004&&Math.abs(angDiff(G.az*D2R,CAM.az*D2R))<0.002&&Math.abs(G.el-CAM.el)<0.05) CAM.goal=null; return true; }

/* ---------- pointer ---------- */
function orbitInit(cv){ const P=new Map(); let down=null, pinch=null, lastHover=0;
  const rel=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); P.set(e.pointerId,[e.clientX,e.clientY]); CAM.user=performance.now(); CAM.goal=null;
    if(P.size===1) down={x:e.clientX,y:e.clientY,t:performance.now(),b:e.button,sh:e.shiftKey||e.button===2,moved:false};
    if(P.size===2){ const [a,b]=[...P.values()]; pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),m:[(a[0]+b[0])/2,(a[1]+b[1])/2]}; if(down) down.moved=true; } });
  cv.addEventListener('pointermove',e=>{ if(!P.has(e.pointerId)){ if(e.pointerType==='mouse'&&R.o.state().mode==='apart'){ const now=performance.now(); if(now-lastHover>60){ lastHover=now; const id=pick(...rel(e)); cv.style.cursor=id?'pointer':'grab'; R.o.hover&&R.o.hover(id); } } return; }
    const prev=P.get(e.pointerId); P.set(e.pointerId,[e.clientX,e.clientY]); const dx=e.clientX-prev[0], dy=e.clientY-prev[1];
    if(P.size===2&&pinch){ const [a,b]=[...P.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]), m=[(a[0]+b[0])/2,(a[1]+b[1])/2]; zoom(pinch.d/d); pan(m[0]-pinch.m[0],m[1]-pinch.m[1]); pinch={d,m}; }
    else if(down){ if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>4) down.moved=true; if(down.sh) pan(dx,dy); else { CAM.az+=dx*0.35; CAM.el=clamp(CAM.el+dy*0.3,-70,80); } }
    R.need=true; CAM.user=performance.now(); });
  const up=e=>{ P.delete(e.pointerId); if(P.size<2) pinch=null;
    if(down&&!down.moved&&P.size===0&&performance.now()-down.t<450&&e.type==='pointerup'){ const id=pick(...rel(e)); R.o.pick&&R.o.pick(id,R.o.state().mode); }
    if(P.size===0) down=null; };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('dblclick',()=>{ camHome(); });
  cv.addEventListener('pointerleave',()=>{ if(R.o.state().mode==='apart') R.o.hover&&R.o.hover(null); });
  let armed=0; cv.addEventListener('pointerdown',()=>{ armed=performance.now(); });
  cv.addEventListener('wheel',e=>{ const now=performance.now(); if(document.fullscreenElement||now-armed<6000||now-CAM.user<6000){ e.preventDefault(); zoom(Math.exp(e.deltaY*0.0012)); CAM.goal=null; CAM.user=now; R.need=true; }
    else showHint(L(t2('Click the model first, then scroll to zoom','Klikk på modellen først, og rull for å zoome'))); },{passive:false});
  cv.addEventListener('keydown',e=>{ const k=e.key; let h=true; if(k==='ArrowLeft') CAM.az-=6; else if(k==='ArrowRight') CAM.az+=6; else if(k==='ArrowUp') CAM.el=clamp(CAM.el+5,-70,80); else if(k==='ArrowDown') CAM.el=clamp(CAM.el-5,-70,80); else if(k==='+'||k==='=') zoom(0.88); else if(k==='-') zoom(1.13); else if(k==='0') camHome(); else h=false; if(h){ e.preventDefault(); CAM.goal=null; R.need=true; } }); }
function zoom(f){ const E=R.cur; const mx=E?Math.max(E.size.x,E.size.y)*4:20; CAM.dist=clamp(CAM.dist*f,0.25,mx); }
function pan(dx,dy){ const s=CAM.dist*0.0016*(700/Math.max(300,R.H||500)); const right=V3().setFromMatrixColumn(R.cam.matrix,0), upv=V3().setFromMatrixColumn(R.cam.matrix,1); CAM.tgt.addScaledVector(right,-dx*s).addScaledVector(upv,dy*s); }
let hintT=0; function showHint(s){ R.hint.textContent=s; R.hint.classList.add('on'); clearTimeout(hintT); hintT=setTimeout(()=>R.hint.classList.remove('on'),1800); }

/* ---------- picking (ignores what the cutaway has removed) ---------- */
const ray=new THREE.Raycaster();
function clipped(p){ if(!R.cut) return false; return R.clip.every(pl=>pl.distanceToPoint(p)<0); }
function pick(x,y){ const E=R.cur; if(!E) return null; ray.setFromCamera({x:x/R.W*2-1,y:-(y/R.H)*2+1},R.cam);
  const hits=ray.intersectObject(E.root,true); for(const h of hits){ if(h.object.userData.cap) continue; const id=h.object.userData.part; if(!id) continue; const p=E.parts[id]; if(!p.noclip&&clipped(h.point)) continue; if(p.nopick) return null; return id; } return null; }

/* ======================= state per frame ======================= */
function L(o){ return R.o.L(o); }
function setCut(on){ R.cut=on; clipFollow(); R.need=true; }
function show(key){ const E=build(key); if(R.cur&&R.cur!==E) R.cur.root.visible=false; R.cur=E; E.root.visible=true;
  E.root.position.set(-E.center.x,-E.center.y,-E.center.z);
  R.shadow.position.set(0,-E.size.y*0.5-0.08-E.center.y*0,0); R.shadow.scale.set(E.size.x*1.6,Math.max(E.size.z,E.size.y)*1.6,1);
  /* clip planes live in world space: move them with the root so the cut stays on the engine axis */
  setCut(R.cut); seedFlow(E); temps(E,R.o.state().M); R.step=-1; TRC.hist=[]; camHome(true); R.dirtyUI=true; }
function clipFollow(){ const E=R.cur; if(!E) return; const o=E.root.position, q=E.def.cut==='top';
  if(!R.cut){ R.clip[0].constant=1e4; R.clip[1].constant=1e4; return; }
  if(q){ R.clip[0].set(V3(0,-1,0),(E.def.cutY||0)+o.y); R.clip[1].set(V3(0,0,-1),-1e4); }
  else { R.clip[0].set(V3(0,-1,0),o.y); R.clip[1].set(V3(0,0,-1),o.z); } }

function apply(st,dt){ const E=R.cur; if(!E) return;
  /* explode */
  const e=st.mode==='apart'?st.e:0; for(const id in E.parts){ const p=E.parts[id]; p.g.position.copy(p.ex).multiplyScalar(e); if(p.exf) p.exf(e); if(p.exa) p.exa(e); }
  /* highlight: selection dims the rest; hover glows */
  const sel=st.mode==='apart'?st.sel:null, hov=st.mode==='apart'?st.hov:null, tourIds=st.mode==='walk'&&R.step>=0?(E.def.tour[R.step].p||[]):null, pulse=0.5+0.5*Math.sin(R.t*3.2);
  for(const id in E.parts){ const p=E.parts[id], dim=(sel&&sel!==id)||(tourIds&&tourIds.length&&!tourIds.includes(id)&&E.def.dimTour!==false), hl=sel===id||hov===id||(tourIds&&tourIds.includes(id));
    const col=new THREE.Color(SC[p.st]);
    p.list.forEach(m=>{ const b=m.userData.base; const want=dim?(sel?0.16:0.42):1;
      if(sel){ if(m.transparent!==(want<1)){ m.transparent=want<1; m.depthWrite=want>=1; m.needsUpdate=true; } m.opacity=want; m.color.copy(b.color); }
      else { if(m.transparent){ m.transparent=false; m.depthWrite=true; m.opacity=1; m.needsUpdate=true; } m.color.copy(b.color).multiplyScalar(dim?0.5:1); }
      m.emissive.copy(b.em); if(hl) m.emissive.copy(col).multiplyScalar(sel===id?0.2:tourIds?0.1+0.12*pulse:0.16); }); }
  /* spin */
  const run=st.run||{};
  const sf=(R.slow?0.12:1)*(st.mode==='walk'&&!reduce?1:0);
  E.spin.forEach(g=>{ const w=run[g.userData.spool]||0; if(w) g.rotation.x-=dt*w*sf*TAU; });
  E.tick.forEach(f=>f(dt*sf,run,st,R.t));
  clipFollow(); }

/* ======================= labels ======================= */
const _v=V3();
function tagsUI(){ const E=R.cur, st=R.o.state(); if(!E) return;
  let h='';
  if(st.mode==='apart'){ (E.def.order||Object.keys(E.parts)).forEach(id=>{ const p=E.parts[id], q=R.o.partInfo(id); if(!p||!q) return; h+=`<button type="button" class="e3tag ap${st.sel===id?' on':''}" data-p="${id}" style="--c:${SC[p.st]}"><b>${q.letter||''}</b><span>${L(q.s||q.n)}</span></button>`; }); }
  else if(R.labels){ (E.def.marks||[]).forEach((m,i)=>{ h+=`<button type="button" class="e3tag mk" data-m="${i}" style="--c:${SC[m[3]]}"><b>${m[3]}</b><span>${L(m[4])}</span></button>`; });
    (E.def.live||[]).forEach((m,i)=>{ h+=`<span class="e3tag lv" data-l="${i}" style="--c:${SC[m[3]||3]}"><span></span></span>`; }); }
  R.tags.innerHTML=h; R.dirtyUI=false; }
function tagsPos(){ const E=R.cur, st=R.o.state(); if(!E) return; const W=R.W, H=R.H;
  R.tags.querySelectorAll('.e3tag').forEach(el=>{ let p;
    if(el.dataset.p){ const P=E.parts[el.dataset.p]; p=_v.copy(P.anchor).add(P.g.position).add(E.root.position); if(P.aoff) p.add(P.aoff); }
    else if(el.dataset.m){ const m=E.def.marks[+el.dataset.m]; p=_v.set(m[0],m[1],m[2]).add(E.root.position); }
    else { const m=E.def.live[+el.dataset.l]; p=_v.set(m[0],m[1],m[2]).add(E.root.position); const s=m[4](st.run||{},st,R.t); el.firstChild.textContent=s?L(s):''; el.style.display=s&&st.mode==='walk'?'':'none'; if(s&&s.c!=null) el.style.setProperty('--c',SC[s.c]); }
    p.project(R.cam); const x=(p.x+1)/2*W, y=(1-p.y)/2*H, vis=p.z<1&&x>-40&&x<W+40&&y>-20&&y<H+20; el._x=Math.round(x); el._y=Math.round(y); el.style.transform=`translate(${el._x}px,${el._y}px)`; el.style.visibility=vis?'':'hidden'; });
  /* spread apart labels vertically so they do not sit on top of each other */
  { const els=[...R.tags.querySelectorAll('.e3tag')].filter(el=>el.style.display!=='none'&&el.style.visibility!=='hidden').map(el=>({el,x:el._x,y:el._y,h:24,w:el.offsetWidth||90})).sort((a,b)=>a.y-b.y);
    for(let i=0;i<els.length;i++) for(let j=0;j<i;j++){ const a=els[j], b=els[i]; if(b.x<a.x+a.w+6&&a.x<b.x+b.w+6&&b.y-a.y<a.h) b.y=a.y+a.h; }
    els.forEach(o=>{ o.el.style.transform=`translate(${o.x}px,${o.y}px)`; }); } }

/* ======================= tools and the walk panel ======================= */
function toolsUI(){ const st=R.o.state(), w=st.mode==='walk', E=R.cur;
  const B=(k,on,t,title)=>`<button type="button" data-k="${k}" class="${on?'on':''}" aria-pressed="${!!on}" title="${L(title||t)}">${L(t)}</button>`;
  R.tools.innerHTML=B('cut',R.cut,t2('Cutaway','Snitt'),t2('Cut a quarter away to see inside','Skjær bort en firedel for å se inn'))
    +(w?B('flow',R.flow,t2('Airflow','Luftstrøm'))+B('slow',R.slow,t2('Slow motion','Sakte film'))+B('lab',R.labels,t2('Labels','Merker')):'')
    +B('home',false,t2('Reset view','Tilbakestill visning'))+B('fs',!!document.fullscreenElement,t2('Full screen','Fullskjerm'));
  R.cv.setAttribute('aria-label',L(t2('3D model of the ','3D-modell av '))+L(E?E.def.title:t2('engine','motoren'))+'. '+L(t2('Drag to turn, pinch or scroll to zoom, double-click to reset.','Dra for å snu, klyp eller rull for å zoome, dobbeltklikk for å tilbakestille.'))); }
function onTool(e){ const b=e.target.closest('button'); if(!b) return; const k=b.dataset.k;
  if(k==='cut') setCut(!R.cut); else if(k==='flow') R.flow=!R.flow; else if(k==='slow') R.slow=!R.slow; else if(k==='lab'){ R.labels=!R.labels; R.dirtyUI=true; }
  else if(k==='home') camHome(); else if(k==='fs'){ const t=R.o.fsEl||R.host; if(document.fullscreenElement) document.exitFullscreen(); else if(t.requestFullscreen) t.requestFullscreen().catch(()=>{}); setTimeout(()=>{ resize(); toolsUI(); },250); }
  toolsUI(); R.need=true; }
document.addEventListener('fullscreenchange',()=>{ if(R.rd){ setTimeout(resize,60); toolsUI(); } });

function walkUI(){ const st=R.o.state(), E=R.cur; if(!E) return; const w=st.mode==='walk'; R.walk.hidden=!w; if(!w) return;
  const T=E.def.tour, i=R.step, s=i>=0?T[i]:null, n=T.length;
  const rail=T.map((x,k)=>`<button type="button" data-s="${k}" class="${k===i?'on':''}${k<i?' past':''}" style="--c:${SC[x.st]}" aria-label="${L(t2('Step','Steg'))} ${k+1}: ${L(x.t)}"><b>${x.st}</b></button>`).join('');
  let body;
  if(!s) body=`<div class="e3w-h"><span class="e3w-k">${L(t2('Follow the air','Følg luften'))} · ${L(E.def.title)}</span></div><p class="e3w-t">${L(E.def.intro)}</p><div class="e3w-v" id="e3wv"></div>`;
  else body=`<div class="e3w-h"><span class="e3w-k">${L(t2('Step','Steg'))} ${i+1} ${L(t2('of','av'))} ${n}</span><span class="e3w-st" style="--c:${SC[s.st]}"><b>${s.st}</b>${L(SN[s.st])}</span></div><h4>${L(s.t)}</h4><p class="e3w-t">${L(s.d)}</p>${s.x?`<p class="e3w-x">${L(s.x)}</p>`:''}<div class="e3w-v" id="e3wv"></div>`;
  R.walk.innerHTML=`<div class="e3w-rail" role="tablist" aria-label="${L(t2('Steps along the gas path','Steg langs gasstrømmen'))}">${rail}</div><div class="e3w-b">${body}</div>
    <div class="e3w-n"><button type="button" class="btn sm" data-a="prev" ${i<0?'disabled':''}>← ${L(t2('Back','Tilbake'))}</button>
    <button type="button" class="btn sm pri" data-a="${i<0?'start':'next'}" ${i>=n-1?'disabled':''}>${L(i<0?t2('Start the walk-through','Start gjennomgangen'):t2('Next','Neste'))} →</button>
    <button type="button" class="btn sm" data-a="play" aria-pressed="${R.play}">${L(R.play?t2('Pause','Pause'):t2('Play all','Spill av alt'))}</button>
    ${i>=0?`<button type="button" class="btn sm" data-a="end">${L(t2('Whole engine','Hele motoren'))}</button>`:''}</div>`;
  vals(); }
function vals(){ const v=R.walk.querySelector('#e3wv'); if(!v) return; const E=R.cur, s=R.step>=0?E.def.tour[R.step]:{v:E.def.v}; if(!s||!s.v){ v.innerHTML=''; return; }
  const st=R.o.state(), rows=s.v(st.M||{},st.run||{},L); v.innerHTML=rows.map(([k,x,c])=>`<span><i>${L(k)}</i><b${c?` style="color:${c}"`:''}>${x}</b></span>`).join(''); }
function onWalk(e){ const b=e.target.closest('button'); if(!b) return; const E=R.cur, n=E.def.tour.length;
  if(b.dataset.s!=null){ go(+b.dataset.s); return; }
  const a=b.dataset.a; if(a==='prev') go(R.step-1); else if(a==='next'||a==='start') go(R.step+1); else if(a==='end'){ R.play=false; go(-1); }
  else if(a==='play'){ R.play=!R.play; R.playT=0; if(R.play&&(R.step<0||R.step>=n-1)) go(0); else walkUI(); } }
function go(i){ const E=R.cur; if(!E) return; const n=E.def.tour.length; i=clamp(i,-1,n-1); R.step=i; TRC.u=0; TRC.hist=[]; R.playT=0;
  if(i<0){ camHome(); R.slow=false; } else { const s=E.def.tour[i]; if(s.cam){ const c=s.cam.slice(); c[5]*=E.def.camK||1.85; if(E.def.cut!=='top') c[3]=clamp(c[3],22,66); camGo(c); } if(s.slow!=null) R.slow=s.slow; if(R.o.onStep) R.o.onStep(s); }
  if(i>=n-1&&R.play){ R.play=false; } walkUI(); toolsUI(); R.need=true; }

/* ======================= loop ======================= */
let uiT=0;
function loop(ts){ requestAnimationFrame(loop); if(!R.on||document.hidden) { R.last=ts; return; }
  const dt=Math.min(0.05,(ts-R.last)/1000||0.016); R.last=ts; R.t+=dt;
  const st=R.o.state(); if(st.vis===false) return; const key=st.type==='tp'&&st.lay==='dir'?'tpd':st.type;
  if(!R.cur||R.cur.key!==key){ R.mode=st.mode; show(key); toolsUI(); walkUI(); }
  if(R.mode!==st.mode){ R.mode=st.mode; R.dirtyUI=true; R.play=false; if(st.mode!=='walk') R.step=-1; toolsUI(); camHome(); walkUI(); }
  if(R.dirtyUI) { tagsUI(); }
  const E=R.cur;
  /* play: advance after the step's time */
  if(R.play&&R.step>=0){ R.playT+=dt; if(R.playT>(E.def.tour[R.step].dur||7)) go(R.step+1); }
  apply(st,dt); camStep(dt); camPos();
  const run=st.run||{}; run.gates=run.gates||{};
  stepFlow(E,dt,run); stepTracer(E,dt);
  R.rd.render(R.sc,R.cam); tagsPos();
  uiT+=dt; if(uiT>0.3){ uiT=0; vals(); temps(E,st.M); } }
function temps(E,M){ const s={}; ((M&&M.stations)||[]).forEach(([k,v])=>{ s[k]=v; }); if(s.fan==null) s.fan=s.in; if(s.hpt==null) s.hpt=s.itt??s.burn; if(s.egt==null) s.egt=s.itt??s.exh; if(s.itt==null) s.itt=s.egt??s.burn;
  E.streams.forEach(S=>S.pts.forEach((p,i)=>{ S.T[i]=s[p.k]??288; })); }

/* ======================= API ======================= */
window.ENG3D={ok:true,SC,SN,tcol,
  mount(host,o){ R.host=host; R.o=o; init(); toolsUI();
    R.tags.addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.p) o.pick&&o.pick(b.dataset.p,'apart',true);
      if(b.dataset.m!=null){ const E=R.cur, m=E.def.marks[+b.dataset.m]; const k=E.def.tour.findIndex(s=>s.mk===+b.dataset.m); if(k>=0) go(k); else camGo([m[0],m[1],m[2],CAM.az,CAM.el,Math.max(1.2,CAM.dist*0.6)]); } }); },
  active(on){ R.on=!!on; if(R.host){ R.host.hidden=!on; if(R.walk) R.walk.hidden=!on||R.o.state().mode!=='walk'; } if(on){ R.last=0; requestAnimationFrame(()=>{ resize(); toolsUI(); walkUI(); R.dirtyUI=true; }); } },
  refresh(){ R.dirtyUI=true; toolsUI(); walkUI(); },
  step(i){ go(i); }, view(){ camHome(); }, stats(){ return R.rd?Object.assign({},R.rd.info.render,{geo:R.rd.info.memory.geometries}):null; },
  get stepIndex(){ return R.step; }
};
})();
