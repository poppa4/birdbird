/* Birdbird – 3D-utsikt ut av vinduet (three.js r128). Terreng, hav, rullebane med merking, lys, PAPI, trær, bygninger og skyer.
   Kamera følger flyets posisjon og attityde. Verden: x = øst, y = opp, z = −nord. */
(function(G){
'use strict';
const D2R=Math.PI/180;
let R=null, scene, cam, papi, papiCol, papiPos, ok=false, W=0, H=0, cv=null, rwyLights=null, clouds=[], trees=null, treeN=0;
/* canvas size from a ResizeObserver: reading clientWidth every frame forced a synchronous layout whenever the page had
   changed anything earlier in the frame (status text, panel), so layout ran twice per frame */
let CW=-1, CH=-1, lastKey='';
function watch(){ if(!G.ResizeObserver||CW>=0) return; CW=0; new ResizeObserver(es=>{ const r=es[es.length-1].contentRect; CW=Math.round(r.width); CH=Math.round(r.height); lastKey=''; }).observe(cv); }
const cw=()=>CW>0?CW:cv.clientWidth, ch=()=>CH>0?CH:cv.clientHeight;

function canvasTex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.anisotropy=8; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); } return t; }

function runwayTex(){
  return canvasTex(128,4096,(g,w,h)=>{
    // 30 m bred, 1500 m lang -> 4.27 px/m i bredde, 2.73 px/m i lengde
    g.fillStyle='#3b3e42'; g.fillRect(0,0,w,h);
    for(let i=0;i<9000;i++){ const v=50+Math.random()*28; g.fillStyle=`rgb(${v},${v+2},${v+5})`; g.fillRect(Math.random()*w,Math.random()*h,2,3); }
    const py=m=>h-m/1500*h, px=m=>m/30*w;
    g.fillStyle='#e9ecef';
    g.fillRect(px(0.6),0,px(0.9),h); g.fillRect(w-px(1.5),0,px(0.9),h);          // kantlinjer
    for(let m=60;m<1440;m+=60) g.fillRect(w/2-px(0.45),py(m+30),px(0.9),30/1500*h); // senterlinje
    const bars=(m0,flip)=>{ for(let k=0;k<8;k++){ const x=px(1.8+k*1.6+(k>=4?3:0)); g.fillRect(x,flip?py(1500-m0)-30/1500*h:py(m0+30),px(1.0),30/1500*h); } };
    bars(6,false); bars(6,true);
    const num=(t,m,flip)=>{ g.save(); g.translate(w/2,py(m)); if(flip) g.rotate(Math.PI); g.scale(1,2.6); g.font='bold 44px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,0,0); g.restore(); };
    num('36',58,false); num('18',1442,true);
    const blk=(m,flip)=>{ const y=flip?py(1500-m):py(m); g.fillRect(px(6),y-45/1500*h,px(2.2),45/1500*h); g.fillRect(w-px(8.2),y-45/1500*h,px(2.2),45/1500*h); };
    blk(300,false); blk(300,true);
    for(const m of [150,450,600]){ for(const flip of [false,true]){ const y=flip?py(1500-m):py(m); g.fillRect(px(7),y-22/1500*h,px(1),22/1500*h); g.fillRect(px(8.6),y-22/1500*h,px(1),22/1500*h); g.fillRect(w-px(8),y-22/1500*h,px(1),22/1500*h); g.fillRect(w-px(9.6),y-22/1500*h,px(1),22/1500*h); } }
  });
}
function grassTex(){
  return canvasTex(512,512,(g,w,h)=>{ g.fillStyle='#3f6935'; g.fillRect(0,0,w,h);
    for(let i=0;i<60;i++){ const c=[ '#44703a','#3c6332','#4a763e','#527a40','#5a7d45','#3a6131' ][i%6]; g.fillStyle=c; g.globalAlpha=0.28; g.fillRect(Math.random()*w,Math.random()*h,40+Math.random()*160,40+Math.random()*160); }
    g.globalAlpha=0.25; for(let i=0;i<6000;i++){ g.fillStyle=Math.random()<0.5?'#36592d':'#557d45'; g.fillRect(Math.random()*w,Math.random()*h,2,2); } g.globalAlpha=1; },[40,40]);
}

/* merge static meshes that share a material into one draw call: parts = [geometry, matrix, colour|null] (position, normal, colour) */
function merge(parts,withCol){ const gs=parts.map(([g,m,c])=>{ const q=g.index?g.toNonIndexed():g.clone(); q.applyMatrix4(m); return [q,c]; });
  const n=gs.reduce((a,[q])=>a+q.attributes.position.count,0), P=new Float32Array(n*3), Nn=new Float32Array(n*3), C=withCol?new Float32Array(n*3):null; let o=0;
  for(const [q,c] of gs){ const k=q.attributes.position.count; P.set(q.attributes.position.array,o*3); Nn.set(q.attributes.normal.array,o*3); if(C){ const cc=new THREE.Color(c); for(let i=0;i<k;i++){ C[(o+i)*3]=cc.r; C[(o+i)*3+1]=cc.g; C[(o+i)*3+2]=cc.b; } } o+=k; q.dispose(); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(P,3)); g.setAttribute('normal',new THREE.BufferAttribute(Nn,3)); if(C) g.setAttribute('color',new THREE.BufferAttribute(C,3)); g.computeBoundingSphere(); return g; }
let _o3=null, _v=null, _f=null, _P=null;
const mat=(x,y,z,rx)=>{ _o3.position.set(x,y,z); _o3.rotation.set(rx||0,0,0); _o3.scale.set(1,1,1); _o3.updateMatrix(); return _o3.matrix.clone(); };
/* fog evaluated per vertex (large, distant triangles: the same smoothstep as three's linear fog, without the per-pixel cost) */
function vertexFog(m){ m.onBeforeCompile=sh=>{
  sh.vertexShader='varying float vFogF;\nuniform float fogNear;\nuniform float fogFar;\n'+sh.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\n\tvFogF=smoothstep(fogNear,fogFar,-mvPosition.z);');
  sh.fragmentShader='varying float vFogF;\n'+sh.fragmentShader.replace('#include <fog_fragment>','gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,vFogF);'); };
  m.customProgramCacheKey=()=>'vfog'; return m; }

let offM=[], is3D=false, cloudMesh=null, cloudIdx=null, cloudPos=null, cloudN=0;
function init(canvas){
  if(!G.THREE){ return false; } cv=canvas; _o3=new THREE.Object3D(); _v=new THREE.Vector3(); _f=new THREE.Vector3(); _P=new THREE.Matrix4();
  /* the canvas keeps MSAA: a 2D canvas within its pixel budget is drawn straight into it exactly as before (without MSAA a 1.5x
     screen shows stair-stepped runway edges and horizon; a multisampled target plus a copy costs more), and the 3D cockpit
     (cockpit3d.js draws its cockpit into this renderer after the world) needs it. The budget path's compose pass draws one
     full-screen triangle, so the canvas MSAA adds only its resolve there. */
  is3D=!!G.CK3D; const dpr0=G.devicePixelRatio||1; aaCtx=true;
  try{ R=new THREE.WebGLRenderer({canvas,antialias:aaCtx,powerPreference:'high-performance',preserveDrawingBuffer:false,stencil:false}); }catch(e){ return false; }
  R.setPixelRatio(Math.min(dpr0,1.5));
  scene=new THREE.Scene(); scene.fog=new THREE.Fog(0xbfd3e6,6000,62000);
  cam=new THREE.PerspectiveCamera(58,2,1.2,140000); cam.rotation.order='YXZ';
  // himmel: drawn last of the opaque objects, at the far plane, so it is only shaded where no terrain covers it
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{},
    vertexShader:'varying vec3 vP; void main(){ vP=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position=vec4(p.xy,p.w*0.999999,p.w); }',
    fragmentShader:'varying vec3 vP; void main(){ float y=vP.y; vec3 top=vec3(0.20,0.42,0.78), hor=vec3(0.76,0.84,0.92), gnd=vec3(0.55,0.62,0.66); vec3 c= y>0.0 ? mix(hor,top,pow(clamp(y,0.0,1.0),0.55)) : mix(hor,gnd,clamp(-y*6.0,0.0,1.0)); gl_FragColor=vec4(c,1.0); }'});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(120000,32,16),skyMat); sky.renderOrder=100; sky.frustumCulled=false; scene.add(sky); scene.userData.sky=sky;
  scene.add(new THREE.HemisphereLight(0xe6f0ff,0x4a5a3a,0.85));
  const sun=new THREE.DirectionalLight(0xfff4e0,0.75); sun.position.set(0.4,1,0.35); scene.add(sun);
  // terreng: one shared vertex buffer, drawn as 4×4 tiles with their own bounds so the ones outside the view are culled
  const T=G.TERRAIN, SZ=170000, SEG=220;
  const tg=new THREE.PlaneGeometry(SZ,SZ,SEG,SEG); tg.rotateX(-Math.PI/2);
  const pos=tg.attributes.position, col=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i), N=-z, E=x; const m=T.height(N,E); pos.setY(i,m<-1?-6:m-0.3);
    const c=T.color(m); const j=0.9+0.2*Math.random(); col[i*3]=c[0]/255*j; col[i*3+1]=c[1]/255*j; col[i*3+2]=c[2]/255*j; }
  tg.setAttribute('color',new THREE.BufferAttribute(col,3)); tg.computeVertexNormals();
  { const terrM=vertexFog(new THREE.MeshLambertMaterial({vertexColors:true})), TL=4, idx=tg.index.array, step=SEG/TL;
    for(let ty=0;ty<TL;ty++) for(let tx=0;tx<TL;tx++){ const y0=Math.round(ty*step), y1=Math.round((ty+1)*step), x0=Math.round(tx*step), x1=Math.round((tx+1)*step);
      const ix=[], bb=new THREE.Box3();
      for(let iy=y0;iy<y1;iy++) for(let jx=x0;jx<x1;jx++){ const c6=(iy*SEG+jx)*6; for(let q=0;q<6;q++){ const v=idx[c6+q]; ix.push(v); } }
      for(const v of ix){ _v.set(pos.getX(v),pos.getY(v),pos.getZ(v)); bb.expandByPoint(_v); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',pos); g.setAttribute('normal',tg.attributes.normal); g.setAttribute('color',tg.attributes.color);
      g.setIndex(new THREE.BufferAttribute(pos.count>65535?new Uint32Array(ix):new Uint16Array(ix),1)); g.boundingSphere=bb.getBoundingSphere(new THREE.Sphere()); g.boundingBox=bb;
      scene.add(new THREE.Mesh(g,terrM)); } }
  // gress rundt flyplassen
  const grass=new THREE.Mesh(new THREE.PlaneGeometry(4200,5200),new THREE.MeshLambertMaterial({map:grassTex(),polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
  grass.rotation.x=-Math.PI/2; grass.position.set(0,0.02,-750); scene.add(grass);
  // rullebane, taksebane, apron (the asphalt pieces share one draw call)
  const rwy=new THREE.Mesh(new THREE.PlaneGeometry(30,1500),new THREE.MeshLambertMaterial({map:runwayTex(),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8})); rwy.rotation.x=-Math.PI/2; rwy.position.set(0,0.2,-750); scene.add(rwy);
  const asph=new THREE.MeshLambertMaterial({color:0x45484c,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-6}), H2=-Math.PI/2;
  const ap=[[new THREE.PlaneGeometry(15,1500),mat(110,0.15,-750,H2)]];
  for(const n of [60,750,1440]) ap.push([new THREE.PlaneGeometry(95,15),mat(62,0.14,-n,H2)]);
  ap.push([new THREE.PlaneGeometry(160,220),mat(200,0.13,-820,H2)]);
  scene.add(new THREE.Mesh(merge(ap,false),asph));
  // bygninger (one draw call, colour per vertex)
  const bc=[0xb9bfc6,0x8e9aa6,0xd6d1c4], bp=[];
  [[260,-760,60,14,40],[260,-860,50,12,36],[250,-940,30,9,24],[300,-700,18,22,18]].forEach(([x,z,w,h,d],i)=>{ bp.push([new THREE.BoxGeometry(w,h,d),mat(x,h/2,z),bc[i%3]]); });
  bp.push([new THREE.CylinderGeometry(4,5,26,10),mat(300,13,-640),bc[2]]);
  bp.push([new THREE.CylinderGeometry(6,5,5,10),mat(300,28,-640),0x40566b]);
  scene.add(new THREE.Mesh(merge(bp,true),new THREE.MeshLambertMaterial({vertexColors:true})));
  // trær: instanced in a 3×3 grid of patches, each with its own bounds (one shared cone's bounds would cull them all
  // whenever the runway threshold left the view)
  const treeG=new THREE.ConeGeometry(4,14,6); treeG.translate(0,7,0); const treeM=new THREE.MeshLambertMaterial({color:0x2f5a2e});
  const N_T=1600, m4=new THREE.Matrix4(), TP=3, cells=Array.from({length:TP*TP},()=>[]); let k=0;
  for(let i=0;i<N_T*3&&k<N_T;i++){ const x=(Math.random()-0.5)*9000, z=-750+(Math.random()-0.5)*9000; if(Math.abs(x)<220&&z<200&&z>-1700) continue; if(x>60&&x<420&&z<-500&&z>-1100) continue; if(Math.abs(x)<120&&z>0&&z<1200) continue;
    const s=0.7+Math.random()*0.8; m4.makeScale(s,s*(0.8+Math.random()*0.6),s); m4.setPosition(x,T.height(-z,x),z);
    const cx=Math.min(TP-1,Math.floor((x+4500)/9000*TP)), cz=Math.min(TP-1,Math.floor((z+750+4500)/9000*TP)); cells[cz*TP+cx].push(m4.clone()); k++; }
  trees=[]; treeN=k;
  for(const list of cells){ if(!list.length) continue; const g=treeG.clone(), bb=new THREE.Box3();
    const im=new THREE.InstancedMesh(g,treeM,list.length); list.forEach((m,i)=>{ im.setMatrixAt(i,m); _v.setFromMatrixPosition(m); bb.expandByPoint(_v); });
    bb.max.y+=32; bb.expandByScalar(8); g.boundingSphere=bb.getBoundingSphere(new THREE.Sphere()); im.userData.n=list.length; scene.add(im); trees.push(im); }
  // lys: kantlys, terskel, innflygingslys
  const lp=[], lc=[]; const addL=(x,y,z,c)=>{ lp.push(x,y,z); lc.push(c[0],c[1],c[2]); };
  for(let m=0;m<=1500;m+=60){ addL(-16,0.5,-m,[1,0.95,0.8]); addL(16,0.5,-m,[1,0.95,0.8]); }
  for(let x=-15;x<=15;x+=3){ addL(x,0.5,1,[0.2,1,0.3]); addL(x,0.5,-1501,[1,0.2,0.15]); }
  for(let m=30;m<=720;m+=30){ for(let x=-2;x<=2;x+=2) addL(x,0.6,m,[1,1,0.92]); if(m===300) for(let x=-15;x<=15;x+=2.5) addL(x,0.6,m,[1,1,0.92]); }
  const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3)); lg.setAttribute('color',new THREE.Float32BufferAttribute(lc,3));
  rwyLights=new THREE.Points(lg,new THREE.PointsMaterial({size:1.1,sizeAttenuation:true,vertexColors:true,fog:true,transparent:true,opacity:0.85,depthWrite:false})); scene.add(rwyLights);
  // PAPI på venstre side, 300 m inn
  papiPos=[]; const pp=[]; for(let i=0;i<4;i++){ const x=-22-i*9; pp.push(x,1.2,-300); papiPos.push(x); }
  const pg=new THREE.BufferGeometry(); pg.setAttribute('position',new THREE.Float32BufferAttribute(pp,3)); papiCol=new Float32Array(12); pg.setAttribute('color',new THREE.BufferAttribute(papiCol,3));
  papi=new THREE.Points(pg,new THREE.PointsMaterial({size:2.4,sizeAttenuation:true,vertexColors:true,fog:true,depthWrite:false})); scene.add(papi);
  // skyer (FEW 2500 ft)
  // Cloud texture: alpha-only mask so colour stays pure white. (Drawing white with alpha on a 2D canvas and
  // uploading it un-premultiplied quantises the faint edge pixels into coloured noise: the "rainbow" fringe.)
  const cloudT=(()=>{ const w=256,h=128, c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
    g.fillStyle='#000'; g.fillRect(0,0,w,h);
    for(let i=0;i<14;i++){ const x=40+Math.random()*(w-80), y=50+Math.random()*30, r=22+Math.random()*30; const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,.95)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
    const src=g.getImageData(0,0,w,h).data, d=new Uint8Array(w*h*4);
    for(let i=0;i<w*h;i++){ const a=src[i*4]; d[i*4]=246; d[i*4+1]=248; d[i*4+2]=250; d[i*4+3]=a; }
    const t=new THREE.DataTexture(d,w,h,THREE.RGBAFormat); t.flipY=true; t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter; t.magFilter=THREE.LinearFilter; t.needsUpdate=true; return t; })();
  /* all 70 cloud billboards in one draw call (they were 70 sprites): view-aligned quads exactly like THREE.Sprite, fog per
     vertex, texels with no alpha discarded, and the quads re-sorted back to front through the index buffer before each frame */
  cloudN=70; const cP=new Float32Array(cloudN*12), cC=new Float32Array(cloudN*8), cU=new Float32Array(cloudN*8); cloudIdx=new Uint16Array(cloudN*6); cloudPos=[];
  for(let i=0;i<cloudN;i++){ const s=1500+Math.random()*2500; const x=(Math.random()-0.5)*90000, y=760+Math.random()*120, z=(Math.random()-0.5)*90000; cloudPos.push([x,y,z]);
    [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]].forEach(([a,b],q)=>{ cP.set([x,y,z],(i*4+q)*3); cC.set([a*s,b*s*0.45],(i*4+q)*2); cU.set([a+0.5,b+0.5],(i*4+q)*2); }); }
  const cg=new THREE.BufferGeometry(); cg.setAttribute('position',new THREE.BufferAttribute(cP,3)); cg.setAttribute('crn',new THREE.BufferAttribute(cC,2)); cg.setAttribute('uv',new THREE.BufferAttribute(cU,2));
  cg.setIndex(new THREE.BufferAttribute(cloudIdx,1)); cg.index.setUsage(THREE.DynamicDrawUsage);
  const cm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:true,uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{map:{value:cloudT}}]),
    vertexShader:'attribute vec2 crn; varying vec2 vUv; varying float vFogF; uniform float fogNear; uniform float fogFar; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); mv.xy+=crn; gl_Position=projectionMatrix*mv; vFogF=smoothstep(fogNear,fogFar,-mv.z); }',
    fragmentShader:'uniform sampler2D map; uniform vec3 fogColor; varying vec2 vUv; varying float vFogF; void main(){ vec4 t=texture2D(map,vUv); if(t.a<0.002) discard; gl_FragColor=vec4(mix(t.rgb,fogColor,vFogF),t.a); }'});
  cloudMesh=new THREE.Mesh(cg,cm); cloudMesh.frustumCulled=false; scene.add(cloudMesh); sortClouds();
  scene.traverse(o=>{ if(o.material&&o.material.polygonOffset) offM.push([o.material,o.material.polygonOffsetFactor]); });
  ok=true; watch(); return true;
}
/* back-to-front order of the cloud quads for the current camera (what three.js did for the separate sprites); the lowest quality level draws every 2nd cloud */
let _cd=null;
function sortClouds(){ if(!cloudMesh) return; _cd=_cd||cloudPos.map((p,i)=>({i,d:0})); const c=cam.position; cam.getWorldDirection(_f);
  for(const o of _cd){ const p=cloudPos[o.i]; o.d=(p[0]-c.x)*_f.x+(p[1]-c.y)*_f.y+(p[2]-c.z)*_f.z; }
  _cd.sort((a,b)=>b.d-a.d); let n=0; const lv=G.OTW.lvl||0;
  for(const o of _cd){ if(lv===2&&o.i%2) continue; const b=o.i*4; cloudIdx.set([b,b+1,b+2,b,b+2,b+3],n); n+=6; }
  cloudMesh.geometry.setDrawRange(0,n); cloudMesh.geometry.index.needsUpdate=true; }

/* ---------- 2D pages: render-at-budget + sharpened upscale ----------
   When the canvas (device pixels, at most 1.5 / 1 / 0.75 per CSS pixel for quality levels 0 / 1 / 2) holds more pixels than the
   level's budget (1.5×; 1.25× at level 2: below that the extra passes cost more than they save), the world is drawn in three
   parts and put together by one full-screen pass:
   - a low-res pass (multisampled) of the whole view, sized so the total stays near the budget. The sky gradient, the soft clouds and
     the near ground come from it, sharpened (contrast-adaptive, AMD CAS style) at its own size and then upscaled;
   - a full-resolution band along the horizon (1.6° above to 4.5° below it: the far terrain line, the runway, PAPI and approach lights
     on a 3° path), drawn with the camera's bank taken out so the band follows a banked horizon at the same cost, and turned back
     into place in the final pass;
   - a full-resolution box around the runway, its lights and the approach lights when they reach below the band (short final).
   Both full-res parts blend in over a soft edge and are masked out of the low-res pass (depth written first, so nothing is shaded
   twice). Dynamic resolution: during fast rotation (roll, quick turns) the low-res pass drops to at most 72 % of its size and grows
   back smoothly once the view steadies; the full-res parts never change. A smaller canvas is drawn whole at full size (multisampled). */
const CLASSIC=!/[?&]otwpipe=1(&|$)/.test(location.search); // budget pipeline is opt-in (?otwpipe=1) until it is measured faster on real GPUs; scene optimisations apply either way
const BUD=[2.2e6,1.2e6,0.7e6];             // pixels per frame (low-res pass + full-res parts) for governor levels 0, 1, 2
const BAND_UP=1.6*D2R, BAND_DN=4.5*D2R, KMIN=0.72;
let PIPE=null, Wd=0, Hd=0, kCur=1, prevS=null, prevT=0, ms=1, hudX='', post=null, mask=null, aaCtx=false;
const RWP=[]; // runway, approach-light and PAPI outline points (world), for the full-res box
for(let m=-720;m<=1500;m+=60) RWP.push([-17,0,-m],[17,0,-m]); RWP.push([-50,1.2,-300],[-17,0,-1501],[17,0,-1501]);
/* stencilBuffer: three r128 gives a depth-only renderbuffer 16 bits, far too coarse for this 1.2 m…140 km camera (the grass plane
   would cover the trees kilometres out); with stencil it is 24-bit depth + 8 stencil, as the canvas has */
function makeRT(w,h,msaa){ const o={depthBuffer:true,stencilBuffer:true,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false,format:THREE.RGBAFormat};
  let t; if(msaa&&R.capabilities.isWebGL2&&THREE.WebGLMultisampleRenderTarget){ t=new THREE.WebGLMultisampleRenderTarget(w,h,o); t.samples=4; } else t=new THREE.WebGLRenderTarget(w,h,o);
  t.texture.generateMipmaps=false; return t; }
function postPass(){ if(post) return post;
  const V2=()=>({value:new THREE.Vector2()}), V4=()=>({value:new THREE.Vector4()});
  const u={tLow:{value:null},tHi:{value:null},tBox:{value:null},lowMax:V2(),lowTex:V2(),lowScale:V2(),outSize:V2(),hiSize:V2(),boxSize:V2(),pp:V2(),rot:V2(),fe:{value:8},
    b1:V4(),b2:V4(),on:V2()};
  const m=new THREE.ShaderMaterial({uniforms:u,depthTest:true,depthWrite:false,
    // the low-res texture coordinate and q (the same pixel in the level, unbanked image) are affine in the pixel: done per vertex
    vertexShader:'uniform vec2 outSize, lowScale, pp, rot; varying vec2 vUv, vQ; void main(){ vec2 p=(position.xy*0.5+0.5)*outSize, d=p-pp; vUv=p/outSize*lowScale; vQ=vec2(rot.x*d.x-rot.y*d.y,rot.y*d.x+rot.x*d.y)+pp; gl_Position=vec4(position.xy,0.0,1.0); }', // depth 0.5: skipped where the full-res copy below wrote depth
    fragmentShader:[
    'uniform sampler2D tLow; uniform sampler2D tHi; uniform sampler2D tBox; uniform vec2 lowMax, lowTex, hiSize, boxSize, on; uniform float fe; uniform vec4 b1, b2; varying vec2 vUv, vQ;',
    'float E(float a,float lo,float hi){ return clamp(min(a-lo,hi-a)/fe,0.0,1.0); }', // soft edge: linear over fe pixels
    'void main(){ vec2 q=vQ;',
    ' float w1=on.x>0.5?E(q.y,b1.y,b1.w):0.0, w2=on.y>0.5?E(q.x,b2.x,b2.z)*E(q.y,b2.y,b2.w):0.0; vec3 col=vec3(0.0);',
    ' if(max(w1,w2)<0.999) col=texture2D(tLow,clamp(vUv,lowTex*0.5,lowMax)).rgb;',
    ' if(w2>0.0) col=mix(col,texture2D(tBox,(q-b2.xy)/boxSize).rgb,w2);',
    ' if(w1>0.0) col=mix(col,texture2D(tHi,(q-b1.xy)/hiSize).rgb,w1);',
    ' gl_FragColor=vec4(col,1.0); }'].join('\n')});
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const mesh=new THREE.Mesh(g,m); mesh.frustumCulled=false; mesh.renderOrder=1; const sc=new THREE.Scene(); sc.add(mesh);
  // drawn first: the inner parts of the band and box (full weight) copied 1:1 with one tap, writing depth so the pass above skips them
  const inner=[[u.tHi,u.hiSize],[u.tBox,u.boxSize]].map(([t,sz])=>{ const ig=new THREE.BufferGeometry(); ig.setAttribute('position',new THREE.BufferAttribute(new Float32Array(18),3));
    const im=new THREE.Mesh(ig,new THREE.ShaderMaterial({uniforms:{outSize:u.outSize,pp:u.pp,rot:u.rot,t,sz,off:{value:new THREE.Vector2()}},depthTest:true,depthWrite:true,depthFunc:THREE.AlwaysDepth,
      vertexShader:'uniform vec2 outSize, pp, rot, sz, off; varying vec2 vS; void main(){ vec2 p=(position.xy*0.5+0.5)*outSize, d=p-pp; vS=(vec2(rot.x*d.x-rot.y*d.y,rot.y*d.x+rot.x*d.y)+pp-off)/sz; gl_Position=vec4(position.xy,-1.0,1.0); }',
      fragmentShader:'uniform sampler2D t; varying vec2 vS; void main(){ gl_FragColor=vec4(texture2D(t,vS).rgb,1.0); }'}));
    im.frustumCulled=false; im.renderOrder=0; im.visible=false; sc.add(im); return im; });
  /* contrast-adaptive sharpening (AMD CAS, 5 taps one texel apart) run on the low-res image itself, before the bilinear upscale
     (the taps are one low-res texel apart either way, and it shades the low-res pixel count, not the canvas's): strong in flat
     areas, held back at high-contrast edges so it does not ring; one luma-based weight for all channels, so no colour fringes */
  const su={t:{value:null},tx:{value:new THREE.Vector2()},mx:{value:new THREE.Vector2()},sharp:{value:0}};
  const sm=new THREE.ShaderMaterial({uniforms:su,depthTest:false,depthWrite:false,vertexShader:'void main(){ gl_Position=vec4(position.xy,0.0,1.0); }',
    fragmentShader:['uniform sampler2D t; uniform vec2 tx, mx; uniform float sharp;',
    'vec3 L(vec2 u){ return texture2D(t,clamp(u,tx*0.5,mx)).rgb; }',
    'void main(){ vec2 uv=gl_FragCoord.xy*tx; vec3 e=L(uv), b=L(uv-vec2(0.0,tx.y)), d=L(uv-vec2(tx.x,0.0)), f=L(uv+vec2(tx.x,0.0)), h=L(uv+vec2(0.0,tx.y));',
    ' const vec3 Y=vec3(0.299,0.587,0.114); float yb=dot(b,Y), yd=dot(d,Y), yf=dot(f,Y), yh=dot(h,Y), ye=dot(e,Y);',
    ' float mn=min(min(min(yb,yd),min(yf,yh)),ye), mx_=max(max(max(yb,yd),max(yf,yh)),ye);',
    ' float amp=sqrt(clamp(min(mn,1.0-mx_)/max(mx_,1e-4),0.0,1.0)), w=amp*(-1.0/mix(8.0,5.0,sharp));',
    ' gl_FragColor=vec4(clamp((e+(b+d+f+h)*w)/(1.0+4.0*w),0.0,1.0),1.0); }'].join('\n')});
  const sMesh=new THREE.Mesh(g,sm); sMesh.frustumCulled=false; const ssc=new THREE.Scene(); ssc.add(sMesh);
  post={sc,cam:new THREE.OrthographicCamera(-1,1,1,-1,0,1),u,inner,ssc,su};
  // depth-only mask (drawn first in the low-res pass, at the near plane) over the parts the full-res passes cover
  const mg=new THREE.BufferGeometry(); mg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(36),3));
  mask=new THREE.Mesh(mg,new THREE.ShaderMaterial({colorWrite:false,depthWrite:true,depthTest:true,depthFunc:THREE.AlwaysDepth,
    vertexShader:'void main(){ gl_Position=vec4(position.xy,-1.0,1.0); }',fragmentShader:'void main(){ gl_FragColor=vec4(0.0); }'}));
  mask.frustumCulled=false; mask.renderOrder=-1e9; mask.visible=false; scene.add(mask);
  return post; }
const focal=()=>(Hd/2)/Math.tan(cam.fov*D2R/2);
function pipeSize(){ // canvas (display) size and the targets for the current quality level
  const lv=G.OTW.lvl||0, d=G.devicePixelRatio||1, prd=lv===2?0.75:lv?1:Math.min(d,1.5);
  R.setPixelRatio(prd); R.setSize(W,H,false); Wd=R.domElement.width; Hd=R.domElement.height;
  if(PIPE){ for(const k of ['main','hi','sharp','box']) PIPE[k]&&PIPE[k].dispose(); }
  const A=Wd*Hd, B=BUD[lv]; let mode='rt', s=1, bandN=0;
  // fits, or so close that three passes and the compose pass would cost more than they save: drawn at full size (multisampled)
  if(A<=B*(lv<2?1.5:1.25)||CLASSIC) mode=aaCtx?'direct':'full';
  else { bandN=lv<2?Math.min(Math.ceil(Hd*0.3),Math.ceil(focal()*(Math.tan(BAND_UP)+Math.tan(BAND_DN)))):0;
    if(Wd*bandN>0.55*B) bandN=0;
    s=Math.min(1,Math.sqrt(bandN?(B-Wd*bandN)/(A-Wd*bandN):B/A)); }
  const mw=Math.max(1,Math.ceil(Wd*s)), mh=Math.max(1,Math.ceil(Hd*s));
  // render targets sized tightly: a multisampled target is resolved (and cleared) whole, whatever part of it was drawn
  PIPE={lv,mode,s,bandN,boxMax:0.3*B,mw,mh,main:mode==='direct'?null:makeRT(mw,mh,true),sharp:mode==='rt'?makeRT(mw,mh,false):null,
    hi:bandN?makeRT(Math.ceil(Math.hypot(Wd,Hd))+2,bandN+2*feather()+2,true):null,box:null}; }
const feather=()=>Math.max(6,Math.round(Hd*0.012));
/* the runway box target: grown in 64-pixel steps when needed, made smaller when it is far bigger than the box */
function boxRT(P,w,h){ const b=P.box; if(b&&b.width>=w&&b.height>=h&&b.width*b.height<3*Math.max(w*h,64*64)) return b; if(b) b.dispose();
  return P.box=makeRT(Math.ceil(w/64)*64,Math.ceil(h/64)*64,true); }
/* render the scene into a rectangle [x0,x1]×[y0,y1] (pixels of the level image, may reach past the canvas) of target rt at row ty */
function subRender(rt,x0,y0,x1,y1,ty){ const pm=cam.projectionMatrix, e=pm.elements, keep=_P.copy(pm);
  const bx0=2*x0/Wd-1, bx1=2*x1/Wd-1, by0=2*y0/Hd-1, by1=2*y1/Hd-1, cx=(bx0+bx1)/2, hx=(bx1-bx0)/2, cy=(by0+by1)/2, hy=(by1-by0)/2;
  e[0]/=hx; e[4]/=hx; e[8]=(e[8]+cx)/hx; e[12]/=hx; e[1]/=hy; e[5]/=hy; e[9]=(e[9]+cy)/hy; e[13]/=hy;
  rt.viewport.set(0,ty,x1-x0,y1-y0); rt.scissor.copy(rt.viewport); rt.scissorTest=true; R.setRenderTarget(rt); R.render(scene,cam); pm.copy(keep); }
const _q=[[0,0],[0,0],[0,0],[0,0]];
function draw2d(){
  if(!PIPE||PIPE.lv!==(G.OTW.lvl||0)) pipeSize();
  const P=PIPE, u=postPass().u;
  if(P.mode==='direct'){ R.setRenderTarget(null); R.render(scene,cam); ms=1; hudX=''; return; }
  const k=P.mode==='rt'?kCur:1, sw=Math.max(1,Math.min(P.mw,Math.round(Wd*P.s*k))), sh=Math.max(1,Math.min(P.mh,Math.round(Hd*P.s*k))), rel=sw/Wd;
  // the level (bank taken out) image: pixel q = rot(φ)·(p − pp) + pp, pp = principal point
  const roll=cam.rotation.z, cr=Math.cos(roll), sr=Math.sin(roll), ppx=(0.5-0.5*cam.projectionMatrix.elements[8])*Wd, ppy=Hd/2;
  const toQ=(x,y,o)=>{ const dx=x-ppx, dy=y-ppy; o[0]=cr*dx-sr*dy+ppx; o[1]=sr*dx+cr*dy+ppy; return o; };
  const toP=(x,y,o)=>{ const dx=x-ppx, dy=y-ppy; o[0]=cr*dx+sr*dy+ppx; o[1]=-sr*dx+cr*dy+ppy; return o; };
  let b1=null, b2=null; const fe=feather();
  if(P.hi){ // canvas outline in the level image
    toQ(0,0,_q[0]); toQ(Wd,0,_q[1]); toQ(Wd,Hd,_q[2]); toQ(0,Hd,_q[3]);
    const qy0=Math.min(_q[0][1],_q[1][1],_q[2][1],_q[3][1]), qy1=Math.max(_q[0][1],_q[1][1],_q[2][1],_q[3][1]);
    const xAt=(ya,yb)=>{ let lo=1e9, hi=-1e9; for(let i=0;i<4;i++){ const a=_q[i], b=_q[(i+1)%4];
        for(const y of [ya,yb]) if((a[1]-y)*(b[1]-y)<=0&&a[1]!==b[1]){ const x=a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]); lo=Math.min(lo,x); hi=Math.max(hi,x); }
        if(a[1]>=ya&&a[1]<=yb){ lo=Math.min(lo,a[0]); hi=Math.max(hi,a[0]); } } return [Math.floor(lo)-2,Math.ceil(hi)+2]; };
    const rz=cam.rotation.z; cam.rotation.z=0; cam.updateMatrixWorld();
    // horizon row in the level image (a point 50 km out along the view's heading, at eye height)
    const yaw=cam.rotation.y, c=cam.position; _v.set(c.x-Math.sin(yaw)*50000,c.y-50000*0.0004,c.z-Math.cos(yaw)*50000).project(cam);
    const f=focal(), yh=(_v.y*0.5+0.5)*Hd, hiW=P.hi.width;
    let y0=Math.floor(yh-f*Math.tan(BAND_DN)), y1=Math.ceil(yh+f*Math.tan(BAND_UP)); y0=Math.max(y0,Math.floor(qy0)-fe); y1=Math.min(y1,Math.ceil(qy1)+fe);
    if(_v.z<1&&y1-y0>4){ if(y1-y0>P.bandN+2*fe) y0=y1-(P.bandN+2*fe); const [x0,x1]=xAt(y0,y1), xa=Math.max(x0,Math.round(ppx-hiW/2)); if(x1>x0) b1=[xa,y0,Math.min(x1,xa+hiW),y1]; }
    // runway / approach lights / PAPI box, where it reaches out of the band (short final): bounds of the points in front of the eye
    let lo=[1e9,1e9], hi=[-1e9,-1e9], n=0; const vm=cam.matrixWorldInverse;
    for(const w of RWP){ _v.set(w[0],w[1],w[2]).applyMatrix4(vm); if(_v.z>-8) continue; _v.applyMatrix4(cam.projectionMatrix);
      const x=(_v.x*0.5+0.5)*Wd, y=(_v.y*0.5+0.5)*Hd; if(x<-Wd*0.5||x>Wd*1.5||y<qy0-Hd||y>qy1) continue; n++;
      lo[0]=Math.min(lo[0],x); lo[1]=Math.min(lo[1],y); hi[0]=Math.max(hi[0],x); hi[1]=Math.max(hi[1],y); }
    if(n){ const m=12+fe; let x0=Math.floor(lo[0]-m), x1=Math.ceil(hi[0]+m), y0b=Math.floor(Math.max(lo[1]-m,qy0-fe)), y1b=Math.ceil(Math.min(hi[1]+m,qy1+fe));
      // only the part outside the band (below it on an approach), overlapping it by the soft edge
      if(b1){ if(y0b<b1[1]) y1b=Math.min(y1b,b1[1]+2*fe); else if(y1b>b1[3]) y0b=Math.max(y0b,b1[3]-2*fe); else y1b=y0b; }
      const [cx0,cx1]=xAt(Math.max(y0b,qy0),Math.min(y1b,qy1)); x0=Math.max(x0,cx0-fe); x1=Math.min(x1,cx1+fe, x0+hiW);
      x1=Math.min(x1,x0+Wd); const rows=Math.floor(P.boxMax/Math.max(1,x1-x0));
      if(y1b-y0b>rows) y0b=y1b-rows; // keep the part nearest the horizon
      if(x1-x0>2*fe+4&&y1b-y0b>2*fe+4) b2=[x0,y0b,x1,y1b]; }
    rwyLights.material.size=1.1; papi.material.size=2.4;
    if(b1) subRender(P.hi,b1[0],b1[1],b1[2],b1[3],0);
    if(b2) subRender(boxRT(P,b2[2]-b2[0],b2[3]-b2[1]),b2[0],b2[1],b2[2],b2[3],0);
    cam.rotation.z=rz; cam.updateMatrixWorld(); }
  // mask: the inner parts of the band and box (inside the soft edge and the sharpening taps), in canvas NDC
  const mp=mask.geometry.attributes.position.array; let mn=0; const mg=fe+2*Wd/sw+1;
  for(const r of [b1,b2]){ if(!r) continue; const x0=r[0]+(r===b1?-4:mg), x1=r[2]-(r===b1?-4:mg), y0=r[1]+mg, y1=r[3]-mg; if(x1<=x0||y1<=y0) continue;
    const c=[toP(x0,y0,[0,0]),toP(x1,y0,[0,0]),toP(x1,y1,[0,0]),toP(x0,y1,[0,0])].map(v=>[2*v[0]/Wd-1,2*v[1]/Hd-1]);
    for(const i of [0,1,2,0,2,3]){ mp[mn*3]=c[i][0]; mp[mn*3+1]=c[i][1]; mp[mn*3+2]=0; mn++; } }
  mask.geometry.setDrawRange(0,mn); mask.geometry.attributes.position.needsUpdate=true; mask.visible=mn>0;
  // full-weight parts for the one-tap copy in the compose pass (band: inside its soft edges; box: inside its edges and below the band)
  { const quad=(im,r,x0,y0,x1,y1)=>{ im.visible=false; if(!r||x1<=x0+1||y1<=y0+1) return; const ip=im.geometry.attributes.position.array, c=[toP(x0,y0,[0,0]),toP(x1,y0,[0,0]),toP(x1,y1,[0,0]),toP(x0,y1,[0,0])]; let n=0;
      for(const i of [0,1,2,0,2,3]){ ip[n*3]=2*c[i][0]/Wd-1; ip[n*3+1]=2*c[i][1]/Hd-1; ip[n*3+2]=0; n++; } im.geometry.attributes.position.needsUpdate=true; im.material.uniforms.off.value.set(r[0],r[1]); im.visible=true; };
    quad(post.inner[0],b1,b1&&b1[0]-4,b1&&b1[1]+fe+1,b1&&b1[2]+4,b1&&b1[3]-fe-1);
    quad(post.inner[1],b2,b2&&b2[0]+fe+1,b2&&b2[1]+fe+1,b2&&b2[2]-fe-1,b2&&Math.min(b2[3]-fe-1,b1?b1[1]:1e9)); }
  // low-res pass (points are sized in canvas pixels: scale them to this target)
  // polygon offset's slope term is per pixel: scaled with the target so the grass / asphalt edges against the terrain land where they do at full size
  rwyLights.material.size=1.1*rel; papi.material.size=2.4*rel; for(const [m,f] of offM) m.polygonOffsetFactor=f*rel;
  P.main.viewport.set(0,0,sw,sh); P.main.scissor.set(0,0,sw,sh); P.main.scissorTest=true;
  R.setRenderTarget(P.main); R.render(scene,cam);
  rwyLights.material.size=1.1; papi.material.size=2.4; mask.visible=false; for(const [m,f] of offM) m.polygonOffsetFactor=f;
  // compose
  const up=Wd/sw, sharp=up>1.03?Math.min(0.8,(up-1)*1.4):0; let low=P.main;
  if(sharp&&P.sharp){ const su=post.su; su.t.value=P.main.texture; su.tx.value.set(1/P.main.width,1/P.main.height); su.mx.value.set((sw-0.5)/P.main.width,(sh-0.5)/P.main.height); su.sharp.value=sharp;
    P.sharp.viewport.set(0,0,sw,sh); P.sharp.scissor.set(0,0,sw,sh); P.sharp.scissorTest=true; R.setRenderTarget(P.sharp); R.render(post.ssc,post.cam); low=P.sharp; }
  u.tLow.value=low.texture; u.lowScale.value.set(sw/low.width,sh/low.height); u.lowTex.value.set(1/low.width,1/low.height);
  u.lowMax.value.set((sw-0.5)/low.width,(sh-0.5)/low.height); u.outSize.value.set(Wd,Hd);
  u.fe.value=fe; u.pp.value.set(ppx,ppy); u.rot.value.set(cr,sr); u.on.value.set(b1?1:0,b2?1:0);
  if(P.hi){ u.tHi.value=P.hi.texture; u.hiSize.value.set(P.hi.width,P.hi.height); }
  if(b1) u.b1.value.set(b1[0],b1[1],b1[2],b1[3]);
  if(b2){ u.b2.value.set(b2[0],b2[1],b2[2],b2[3]); u.tBox.value=P.box.texture; u.boxSize.value.set(P.box.width,P.box.height); }
  R.setRenderTarget(null); R.render(post.sc,post.cam); ms=P.s*k; hudX=(b1?' band':'')+(b2?' box':''); }
/* 2D pages: horizontal field of view 76° across the stage width (about 45–52° vertical over a whole 16:9…3:2 desktop screen),
   and an optional frame from the page: lip = canvas row (CSS px) of the glareshield top on the centre line, nose = degrees the
   horizon sits above it with the fuselage level (the type's over-the-nose angle), cx = canvas column straight ahead of the pilot
   (the left seat is off the centre line). Without a frame: centred, with the old fixed 2.9° look-down. */
const HF=38; let FR=null;
function frame(f){ FR=f&&isFinite(f.lip)?f:null; }
function size(){ if(!cv) return; const w=cw(), h=ch(); if(!w||!h) return; if(w!==W||h!==H){ W=w; H=h; cam.aspect=w/h; cam.fov=2*Math.atan(Math.tan(HF*D2R)/cam.aspect)/D2R; cam.updateProjectionMatrix(); pipeSize(); } }
function lookDown(view){ if(view) return 0.08; if(!FR||!W) return 0.05; const f=(W/2)/Math.tan(HF*D2R), hy=FR.lip-f*Math.tan(FR.nose*D2R); return Math.atan((H/2-hy)/f); }
function render(S,view){
  if(!ok) return; size(); if(!W) return;
  const eye=1.55;
  cam.position.set(S.E,(S.h||0)+eye,-S.N);
  const yawOff=view==='L'?60:view==='R'?-60:0;
  // straight ahead of the pilot (FR.cx: canvas column above the pilot's own attitude indicator), not the middle of the screen
  cam.projectionMatrix.elements[8]=(FR&&FR.cx!=null&&!view&&W)?1-2*FR.cx/W:0;
  cam.rotation.set((S.th||0)-lookDown(view),-(S.psi||0)+yawOff*D2R,-(S.phi||0)*(view?0.3:1),'YXZ');
  // nothing moved (paused, crashed, parked): the canvas keeps the last frame, once the resolution is back to full after a fast move
  const key=S.N+','+S.E+','+S.h+','+S.th+','+S.phi+','+S.psi+','+view+','+W+','+H+','+cam.projectionMatrix.elements[8]+','+(FR?FR.lip+','+FR.nose:'')+','+G.OTW.lvl;
  const now=performance.now(), dt=Math.min(0.25,Math.max(0.001,(now-prevT)/1000));
  if(key===lastKey&&kCur>=1) return;
  // dynamic resolution from the view's rotation rate (a jump, e.g. a reset or another view, is a cut, not motion)
  let kT=1;
  if(prevS&&key!==lastKey&&now-prevT<250){ const dp=Math.abs(Math.atan2(Math.sin(S.psi-prevS.psi),Math.cos(S.psi-prevS.psi))), r=(dp+Math.abs(S.th-prevS.th)+Math.abs(S.phi-prevS.phi))/dt;
    kT=view!==prevS.v||r>4?1:r<0.09?1:r>0.35?KMIN:1-(r-0.09)/0.26*(1-KMIN); if(view!==prevS.v||r>4) kCur=1; }
  kCur=kT<kCur?Math.max(kT,kCur-dt*2.5):Math.min(kT,kCur+dt*1.2); if(kCur>0.995) kCur=1;
  prevS={psi:S.psi||0,th:S.th||0,phi:S.phi||0,v:view}; prevT=now; lastKey=key;
  scene.userData.sky.position.copy(cam.position);
  // PAPI: farge etter vinkel fra PAPI-lysene
  const d=Math.hypot(S.N-300,S.E+30), ang=Math.atan2((S.h||0)+eye-1.2,Math.max(1,d))/D2R;
  const th=[3.5,3.17,2.83,2.5]; for(let i=0;i<4;i++){ const white=ang>th[i]; papiCol[i*3]=1; papiCol[i*3+1]=white?1:0.12; papiCol[i*3+2]=white?1:0.1; }
  papi.geometry.attributes.color.needsUpdate=true;
  cam.updateMatrixWorld(); sortClouds();
  draw2d();
}
/* 3D-cockpit (da42-3d.html): same world, camera = aircraft attitude × head rotation; `after` draws the cockpit on top */
let _e3=null;
function render3d(S,qHead,fov,dpr,after){
  if(!ok||!cv) return false; lastKey=''; const w=cw(), h=ch(); if(!w||!h) return false;
  if(Math.abs(R.getPixelRatio()-dpr)>1e-3){ R.setPixelRatio(dpr); W=0; }
  if(w!==W||h!==H){ W=w; H=h; R.setSize(w,h,false); }
  if(cam.aspect!==w/h||cam.fov!==fov){ cam.aspect=w/h; cam.fov=fov; cam.updateProjectionMatrix(); } cam.projectionMatrix.elements[8]=0;
  const eye=1.55; cam.position.set(S.E,(S.h||0)+eye,-S.N);
  _e3=_e3||new THREE.Euler(0,0,0,'YXZ'); _e3.set(S.th||0,-(S.psi||0),-(S.phi||0),'YXZ'); cam.quaternion.setFromEuler(_e3).multiply(qHead);
  scene.userData.sky.position.copy(cam.position);
  const d=Math.hypot(S.N-300,S.E+30), ang=Math.atan2((S.h||0)+eye-1.2,Math.max(1,d))/D2R;
  const th=[3.5,3.17,2.83,2.5]; for(let i=0;i<4;i++){ const white=ang>th[i]; papiCol[i*3]=1; papiCol[i*3+1]=white?1:0.12; papiCol[i*3+2]=white?1:0.1; }
  papi.geometry.attributes.color.needsUpdate=true;
  cam.updateMatrixWorld(); sortClouds();
  R.setRenderTarget(null); R.autoClear=true; R.render(scene,cam);
  if(after){ R.autoClear=false; R.clearDepth(); after(R,cam); R.autoClear=true; }
  return true;
}
/* quality(false|true|2): governor level 0, 1, 2. 2D: total pixel budget about 2.0 / 1.2 / 0.7 MP drawn per frame (low-res pass plus
   full-res horizon band), shown on a canvas of at most 1.5 / 1 / 0.75 device pixels per CSS pixel; the 3D cockpit sets its own
   pixel ratio (cockpit3d.js reads OTW.lvl) */
function quality(low){ if(!R) return; const lv=low===2?2:low?1:0; if(lv===G.OTW.lvl) return; G.OTW.lvl=lv; G.OTW.low=lv>0; if(!is3D){ W=0; PIPE&&(PIPE.lv=-1); } lastKey='';
  // lowest level: half the clouds (sortClouds) and half the trees
  if(trees) trees.forEach(t=>{ t.count=lv===2?t.userData.n>>1:t.userData.n; }); }
/* ?perf=1: a small on-screen meter (bottom left, clear of the toolbar and the view buttons; never takes the pointer) (frame rate, frame time, worst frame, quality tier) for checking speed on a phone */
function hud(){ const d=document.createElement('div'); d.setAttribute('aria-hidden','true');
  d.style.cssText='position:fixed;left:6px;bottom:calc(46px + env(safe-area-inset-bottom,0px));z-index:2147483647;pointer-events:none;font:600 10px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#d8ffe0;background:rgba(0,0,0,.5);opacity:.8;padding:3px 6px;border-radius:5px;white-space:pre';
  const add=()=>document.body.appendChild(d); if(document.body) add(); else addEventListener('DOMContentLoaded',add);
  let n=0, sum=0, worst=0, last=0, t0=performance.now(), lt=0;
  try{ new PerformanceObserver(l=>{ lt+=l.getEntries().length; }).observe({type:'longtask'}); }catch(e){ lt=-1; }
  const tier=()=>{ const D=['C172_3D','DA42_3D','B200_3D'].map(k=>G[k]).find(x=>x&&x.on&&x.quality);
    if(D){ const q=D.quality(); return '3D L'+q.level+' dpr '+(+q.dpr).toFixed(2)+(q.cap?' cap '+q.cap+' Hz':'')+(D.moving?' moving':''); }
    const g=G.SIMGOV||G.GOV; return '2D gov '+(g?g.lvl:'-')+' otw '+(G.OTW.lvl||0)+' dpr '+(R?(+R.getPixelRatio()).toFixed(2):'-')+' res '+Math.round(ms*100)+'%'+hudX; };
  const f=t=>{ if(last){ const dt=t-last; n++; sum+=dt; if(dt>worst) worst=dt; } last=t;
    if(t-t0>=500){ const m=performance.memory?' · '+Math.round(performance.memory.usedJSHeapSize/1048576)+' MB':'';
      d.textContent=(n?Math.round(n*1000/(t-t0)):0)+' fps · '+(n?(sum/n).toFixed(1):'-')+' ms · max '+Math.round(worst)+' ms'+(lt>=0?' · long '+lt:'')+m+'\n'+tier();
      n=0; sum=0; worst=0; t0=t; }
    requestAnimationFrame(f); };
  requestAnimationFrame(f); }
if(/[?&]perf=1(&|$)/.test(location.search)) hud();
G.OTW={init,render,render3d,quality,frame,get fov(){ return cam?{h:2*HF,v:cam.fov,w:W,h_:H}:null; },low:false,lvl:0,renderer:()=>R};
})(window);
