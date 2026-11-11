/* Birdbird – 3D-utsikt ut av vinduet (three.js r128). Terreng, hav, rullebane med merking, lys, PAPI, trær, bygninger og skyer.
   Kamera følger flyets posisjon og attityde. Verden: x = øst, y = opp, z = −nord. */
(function(G){
'use strict';
const D2R=Math.PI/180;
let R=null, scene, cam, papi, papiCol, papiPos, ok=false, W=0, H=0, cv=null, rwyLights=null;

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

function init(canvas){
  if(!G.THREE){ return false; } cv=canvas;
  try{ R=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'}); }catch(e){ return false; }
  R.setPixelRatio(Math.min(G.devicePixelRatio||1,1.5));
  scene=new THREE.Scene(); scene.fog=new THREE.Fog(0xbfd3e6,6000,62000);
  cam=new THREE.PerspectiveCamera(58,2,1.2,140000); cam.rotation.order='YXZ';
  // himmel
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{},
    vertexShader:'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'varying vec3 vP; void main(){ float y=vP.y; vec3 top=vec3(0.20,0.42,0.78), hor=vec3(0.76,0.84,0.92), gnd=vec3(0.55,0.62,0.66); vec3 c= y>0.0 ? mix(hor,top,pow(clamp(y,0.0,1.0),0.55)) : mix(hor,gnd,clamp(-y*6.0,0.0,1.0)); gl_FragColor=vec4(c,1.0); }'});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(120000,32,16),skyMat); sky.renderOrder=-1; scene.add(sky); scene.userData.sky=sky;
  scene.add(new THREE.HemisphereLight(0xe6f0ff,0x4a5a3a,0.85));
  const sun=new THREE.DirectionalLight(0xfff4e0,0.75); sun.position.set(0.4,1,0.35); scene.add(sun);
  // terreng
  const T=G.TERRAIN, SZ=170000, SEG=220;
  const tg=new THREE.PlaneGeometry(SZ,SZ,SEG,SEG); tg.rotateX(-Math.PI/2);
  const pos=tg.attributes.position, col=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i), N=-z, E=x; const m=T.height(N,E); pos.setY(i,m<-1?-6:m-0.3);
    const c=T.color(m); const j=0.9+0.2*Math.random(); col[i*3]=c[0]/255*j; col[i*3+1]=c[1]/255*j; col[i*3+2]=c[2]/255*j; }
  tg.setAttribute('color',new THREE.BufferAttribute(col,3)); tg.computeVertexNormals();
  scene.add(new THREE.Mesh(tg,new THREE.MeshLambertMaterial({vertexColors:true})));
  // gress rundt flyplassen
  const grass=new THREE.Mesh(new THREE.PlaneGeometry(4200,5200),new THREE.MeshLambertMaterial({map:grassTex(),polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
  grass.rotation.x=-Math.PI/2; grass.position.set(0,0.02,-750); scene.add(grass);
  // rullebane, taksebane, apron
  const rwy=new THREE.Mesh(new THREE.PlaneGeometry(30,1500),new THREE.MeshLambertMaterial({map:runwayTex(),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-8})); rwy.rotation.x=-Math.PI/2; rwy.position.set(0,0.2,-750); scene.add(rwy);
  const asph=new THREE.MeshLambertMaterial({color:0x45484c,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-6});
  const tw=new THREE.Mesh(new THREE.PlaneGeometry(15,1500),asph); tw.rotation.x=-Math.PI/2; tw.position.set(110,0.15,-750); scene.add(tw);
  for(const n of [60,750,1440]){ const c=new THREE.Mesh(new THREE.PlaneGeometry(95,15),asph); c.rotation.x=-Math.PI/2; c.position.set(62,0.14,-n); scene.add(c); }
  const ap=new THREE.Mesh(new THREE.PlaneGeometry(160,220),asph); ap.rotation.x=-Math.PI/2; ap.position.set(200,0.13,-820); scene.add(ap);
  // bygninger
  const bm=[new THREE.MeshLambertMaterial({color:0xb9bfc6}),new THREE.MeshLambertMaterial({color:0x8e9aa6}),new THREE.MeshLambertMaterial({color:0xd6d1c4})];
  [[260,-760,60,14,40],[260,-860,50,12,36],[250,-940,30,9,24],[300,-700,18,22,18]].forEach(([x,z,w,h,d],i)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),bm[i%3]); b.position.set(x,h/2,z); scene.add(b); });
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(4,5,26,10),bm[2]); tower.position.set(300,13,-640); scene.add(tower);
  const cab=new THREE.Mesh(new THREE.CylinderGeometry(6,5,5,10),new THREE.MeshLambertMaterial({color:0x40566b})); cab.position.set(300,28,-640); scene.add(cab);
  // trær
  const treeG=new THREE.ConeGeometry(4,14,6); treeG.translate(0,7,0); const treeM=new THREE.MeshLambertMaterial({color:0x2f5a2e});
  const N_T=1600, trees=new THREE.InstancedMesh(treeG,treeM,N_T); const m4=new THREE.Matrix4(); let k=0;
  for(let i=0;i<N_T*3&&k<N_T;i++){ const x=(Math.random()-0.5)*9000, z=-750+(Math.random()-0.5)*9000; if(Math.abs(x)<220&&z<200&&z>-1700) continue; if(x>60&&x<420&&z<-500&&z>-1100) continue; if(Math.abs(x)<120&&z>0&&z<1200) continue;
    const s=0.7+Math.random()*0.8; m4.makeScale(s,s*(0.8+Math.random()*0.6),s); m4.setPosition(x,T.height(-z,x),z); trees.setMatrixAt(k++,m4); }
  trees.count=k; scene.add(trees);
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
  const cm=new THREE.SpriteMaterial({map:cloudT,transparent:true,depthWrite:false,fog:true});
  for(let i=0;i<70;i++){ const sp=new THREE.Sprite(cm); const s=1500+Math.random()*2500; sp.scale.set(s,s*0.45,1); sp.position.set((Math.random()-0.5)*90000,760+Math.random()*120,(Math.random()-0.5)*90000); scene.add(sp); }
  ok=true; return true;
}
/* 2D pages: horizontal field of view 76° across the stage width (about 45–52° vertical over a whole 16:9…3:2 desktop screen),
   and an optional frame from the page: lip = canvas row (CSS px) of the glareshield top on the centre line, nose = degrees the
   horizon sits above it with the fuselage level (the type's over-the-nose angle), cx = canvas column straight ahead of the pilot
   (the left seat is off the centre line). Without a frame: centred, with the old fixed 2.9° look-down. */
const HF=38; let FR=null;
function frame(f){ FR=f&&isFinite(f.lip)?f:null; }
function size(){ if(!cv) return; const w=cv.clientWidth, h=cv.clientHeight; if(!w||!h) return; if(w!==W||h!==H){ W=w; H=h; R.setSize(w,h,false); cam.aspect=w/h; cam.fov=2*Math.atan(Math.tan(HF*D2R)/cam.aspect)/D2R; cam.updateProjectionMatrix(); } }
function lookDown(view){ if(view) return 0.08; if(!FR||!W) return 0.05; const f=(W/2)/Math.tan(HF*D2R), hy=FR.lip-f*Math.tan(FR.nose*D2R); return Math.atan((H/2-hy)/f); }
function render(S,view){
  if(!ok) return; size(); if(!W) return;
  const eye=1.55;
  cam.position.set(S.E,(S.h||0)+eye,-S.N);
  const yawOff=view==='L'?60:view==='R'?-60:0;
  // straight ahead of the pilot (FR.cx: canvas column above the pilot's own attitude indicator), not the middle of the screen
  cam.projectionMatrix.elements[8]=(FR&&FR.cx!=null&&!view&&W)?1-2*FR.cx/W:0;
  cam.rotation.set((S.th||0)-lookDown(view),-(S.psi||0)+yawOff*D2R,-(S.phi||0)*(view?0.3:1),'YXZ');
  scene.userData.sky.position.copy(cam.position);
  // PAPI: farge etter vinkel fra PAPI-lysene
  const d=Math.hypot(S.N-300,S.E+30), ang=Math.atan2((S.h||0)+eye-1.2,Math.max(1,d))/D2R;
  const th=[3.5,3.17,2.83,2.5]; for(let i=0;i<4;i++){ const white=ang>th[i]; papiCol[i*3]=1; papiCol[i*3+1]=white?1:0.12; papiCol[i*3+2]=white?1:0.1; }
  papi.geometry.attributes.color.needsUpdate=true;
  R.render(scene,cam);
}
/* 3D-cockpit (da42-3d.html): same world, camera = aircraft attitude × head rotation; `after` draws the cockpit on top */
let _e3=null;
function render3d(S,qHead,fov,dpr,after){
  if(!ok||!cv) return false; const w=cv.clientWidth, h=cv.clientHeight; if(!w||!h) return false;
  if(Math.abs(R.getPixelRatio()-dpr)>1e-3){ R.setPixelRatio(dpr); W=0; }
  if(w!==W||h!==H){ W=w; H=h; R.setSize(w,h,false); }
  if(cam.aspect!==w/h||cam.fov!==fov){ cam.aspect=w/h; cam.fov=fov; cam.updateProjectionMatrix(); } cam.projectionMatrix.elements[8]=0;
  const eye=1.55; cam.position.set(S.E,(S.h||0)+eye,-S.N);
  _e3=_e3||new THREE.Euler(0,0,0,'YXZ'); _e3.set(S.th||0,-(S.psi||0),-(S.phi||0),'YXZ'); cam.quaternion.setFromEuler(_e3).multiply(qHead);
  scene.userData.sky.position.copy(cam.position);
  const d=Math.hypot(S.N-300,S.E+30), ang=Math.atan2((S.h||0)+eye-1.2,Math.max(1,d))/D2R;
  const th=[3.5,3.17,2.83,2.5]; for(let i=0;i<4;i++){ const white=ang>th[i]; papiCol[i*3]=1; papiCol[i*3+1]=white?1:0.12; papiCol[i*3+2]=white?1:0.1; }
  papi.geometry.attributes.color.needsUpdate=true;
  R.autoClear=true; R.render(scene,cam);
  if(after){ R.autoClear=false; R.clearDepth(); after(R,cam); R.autoClear=true; }
  return true;
}
// quality(false|true|2): normal (device pixels, at most 1.5 per CSS pixel), low (1 per CSS pixel), very low (0.75 per CSS pixel)
function quality(low){ if(!R) return; const lv=low===2?2:low?1:0; if(lv===G.OTW.lvl) return; G.OTW.lvl=lv; G.OTW.low=lv>0; R.setPixelRatio(lv===2?0.75:lv?1:Math.min(G.devicePixelRatio||1,1.5)); W=0; }
G.OTW={init,render,render3d,quality,frame,get fov(){ return cam?{h:2*HF,v:cam.fov,w:W,h_:H}:null; },low:false,lvl:0,renderer:()=>R};
})(window);
