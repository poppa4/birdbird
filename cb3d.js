/* Birdbird – cb3d.js: the 3D thunderstorm scene for storms.html (three.js r128, no external assets).
   One renderer, three views that share the craft of the wind tunnel (tunnel.html):
   - storm: a cumulonimbus built from a few thousand lit soft sprites (cauliflower towers, overshooting top, anvil,
     mammatus, flanking line, shelf cloud), rain shafts, levels, and live layers (air motion coloured by vertical
     speed, hail loop, gust front, microburst ring vortex, lightning, icing, turbulence, avoidance distances);
   - mb: the approach through a microburst (runway, glide path, flown path, outflow, aircraft);
   - wx: three storms ahead of an aircraft, the radar beam (tilt, curvature, attenuation) drawn on a vertical curtain.
   Cloud lighting: each sprite gets a sun transmittance from a coarse density grid (self-shadowing) and a local
   occlusion term; the fragment shader adds a sphere normal for soft directional shading. Sprites are sorted back to
   front when the camera moves. LOW quality (phones, ≤4 cores): fewer sprites and particles, pixel ratio ≤1.25.
   No per-frame allocations: every buffer is made once. API on window.CB3D.init(opts). */
(function(){
'use strict';
const CB3D={};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function cv(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function prng(seed){ let s=(seed>>>0)||1; return ()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; return ((s>>>0)%1000003)/1000003; }; }

/* stub when WebGL or three.js is missing: the page keeps working, the viewport says so in plain words */
function stub(o,msg){ const n=document.createElement('div'); n.className='nogl'; n.setAttribute('role','status'); n.textContent=msg; (o.host||document.body).appendChild(n);
  const f=()=>{}; return {ok:false,setView:f,setStorm:f,setShow:f,setLook:f,cam:f,setMB:f,mbK:f,setRadar:f,tick:f,labels:f,resize:f,presets:()=>[],relabel:f,flash:f}; }

CB3D.init=function(o){
  const T=o.T||(s=>s);
  if(!window.THREE) return stub(o,T('nogl'));
  const host=o.host, canvas=o.canvas, labelsEl=o.labels;
  const COARSE=matchMedia('(pointer:coarse)').matches, HQ=/[?&]hq\b/.test(location.search);
  const LOW=!HQ&&(innerWidth<760||COARSE||(navigator.hardwareConcurrency||4)<=4);
  const Q=LOW?0.45:1;
  let renderer;
  try{ renderer=new THREE.WebGLRenderer({canvas,antialias:!LOW,alpha:true,powerPreference:'high-performance'}); if(!renderer.getContext()) throw new Error('no context'); }
  catch(e){ console.warn('Storm 3D: WebGL unavailable',e); return stub(o,T('nogl')); }
  const DPR=Math.min(devicePixelRatio||1,2);
  renderer.setPixelRatio(LOW?Math.min(DPR,1.25):Math.min(DPR,1.6));
  renderer.setClearColor(0x000000,0);
  renderer.outputEncoding=THREE.sRGBEncoding; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,0.05,3000);
  const M=window.CBM, FT2KM=M.FT2KM, TROPO=M.TROPO;
  const VEX={storm:1.5,wx:2.2};
  let view='storm', look='sky';
  const ST={E:null,cells:[],cond:null,show:{},rcells:M.radarCells(),gfx:0};

  /* ---------------- lights (for the aircraft) ---------------- */
  const hemi=new THREE.HemisphereLight(0xdfe8f2,0x4a4f48,0.75); scene.add(hemi);
  const sunL=new THREE.DirectionalLight(0xfff1de,1.25); scene.add(sunL); scene.add(sunL.target);
  const SUN={storm:new THREE.Vector3(-0.55,0.55,0.62).normalize(),mb:new THREE.Vector3(-0.45,0.62,0.64).normalize(),wx:new THREE.Vector3(-0.35,0.6,0.72).normalize()};

  /* ---------------- palettes ---------------- */
  const PAL={
    sky:{sun:[1.08,1.0,0.9],amb:[0.5,0.56,0.67],base:[0.27,0.3,0.36],fog:[0.72,0.79,0.87],fd:0.0036,zen:[0.16,0.34,0.62],hor:[0.72,0.79,0.87],gnd:[0.30,0.33,0.31],exp:1.05,gl:0.86},
    night:{sun:[0.13,0.14,0.19],amb:[0.08,0.09,0.13],base:[0.03,0.035,0.05],fog:[0.035,0.045,0.07],fd:0.0045,zen:[0.008,0.014,0.035],hor:[0.05,0.065,0.1],gnd:[0.02,0.025,0.03],exp:1.0,gl:0.13},
    mb:{sun:[0.8,0.8,0.8],amb:[0.4,0.44,0.5],base:[0.18,0.2,0.24],fog:[0.5,0.55,0.6],fd:0.026,zen:[0.30,0.36,0.44],hor:[0.55,0.6,0.65],gnd:[0.25,0.28,0.26],exp:1.0,gl:0.62},
    dark:{sun:[0.97,0.97,0.99],amb:[0.4,0.45,0.53],base:[0.2,0.23,0.27],fog:[0.09,0.12,0.16],fd:0.0036,zen:[0,0,0],hor:[0,0,0],gnd:[0,0,0],exp:1.0,gl:0.86}};

  /* ---------------- sky dome ---------------- */
  const skyU={zen:{value:new THREE.Color()},hor:{value:new THREE.Color()},gnd:{value:new THREE.Color()},sun:{value:new THREE.Vector3()},fl:{value:0}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(1500,32,16),new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,depthTest:false,
    vertexShader:'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform vec3 zen,hor,gnd,sun; uniform float fl; varying vec3 vD;
      void main(){ float h=vD.y; vec3 c=mix(hor,zen,pow(smoothstep(-0.02,0.55,h),0.7)); c=mix(c,gnd,smoothstep(0.0,-0.06,h));
        float s=max(0.0,dot(vD,sun)); c+=vec3(1.0,0.86,0.62)*(pow(s,9.0)*0.22+pow(s,90.0)*0.35)*step(0.0,h+0.02); c+=vec3(0.75,0.8,1.0)*fl*0.18;
        gl_FragColor=vec4(c,1.0); }`}));
  sky.renderOrder=-10; sky.frustumCulled=false; scene.add(sky);

  /* ---------------- ground ---------------- */
  const fieldTex=(function(){ const N=512,c=cv(N,N),g=c.getContext('2d'),r=prng(11); g.fillStyle='#55634a'; g.fillRect(0,0,N,N);
    const pal=['#58684b','#61704c','#6c7252','#4c5c46','#73755a','#5b6851','#687259','#7a7a5c','#4f6048'];
    for(let i=0;i<150;i++){ const w=20+r()*90,h=20+r()*90,x=r()*N,y=r()*N; g.fillStyle=pal[Math.floor(r()*pal.length)]; g.globalAlpha=0.9; for(const dx of [0,-N,N]) for(const dy of [0,-N,N]) g.fillRect(x+dx,y+dy,w,h); }
    g.globalAlpha=1; g.strokeStyle='rgba(30,36,28,.35)'; g.lineWidth=1; for(let i=0;i<40;i++){ const x=r()*N; g.beginPath(); g.moveTo(x,0); g.lineTo(x+r()*40-20,N); g.stroke(); const y=r()*N; g.beginPath(); g.moveTo(0,y); g.lineTo(N,y+r()*40-20); g.stroke(); }
    g.strokeStyle='rgba(140,140,130,.45)'; g.lineWidth=2; for(let i=0;i<4;i++){ g.beginPath(); g.moveTo(r()*N,0); g.bezierCurveTo(r()*N,N*0.3,r()*N,N*0.6,r()*N,N); g.stroke(); }
    for(let i=0;i<9000;i++){ g.fillStyle=r()<0.5?'rgba(0,0,0,.05)':'rgba(255,255,255,.035)'; g.fillRect(r()*N,r()*N,1.5,1.5); }
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; return t; })();
  const gU={tex:{value:fieldTex},rep:{value:14},fogC:{value:new THREE.Color()},fogD:{value:0.005},dark:{value:0},light:{value:0.85},
    sh:{value:Array.from({length:8},()=>new THREE.Vector4(0,0,0,0))},sha:{value:new Float32Array(8)},wet:{value:new THREE.Vector4(0,0,0,0)},grid:{value:10},fl:{value:0}};
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600,1,1),new THREE.ShaderMaterial({uniforms:gU,
    vertexShader:'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader:`uniform sampler2D tex; uniform float rep,fogD,dark,light,grid,fl; uniform vec3 fogC; uniform vec4 sh[8]; uniform float sha[8]; uniform vec4 wet; varying vec3 vW;
      void main(){ float d=length(vW-cameraPosition);
        vec3 c=texture2D(tex,vW.xz/rep).rgb; c=mix(c,vec3(0.36,0.41,0.33),clamp(d/260.0,0.0,0.85));
        float s=0.0; for(int i=0;i<8;i++){ vec4 q=sh[i]; if(q.z>0.0){ vec2 p=(vW.xz-q.xy)/q.zw; s=max(s,sha[i]*(1.0-smoothstep(0.35,1.0,length(p)))); } }
        if(wet.z>0.0){ float w=1.0-smoothstep(0.4,1.0,length(vW.xz-wet.xy)/wet.z); c=mix(c,c*0.7+vec3(0.02,0.03,0.05),w*wet.w); }
        c*=light*(1.0-0.55*s);
        if(dark>0.5){ vec2 g=abs(fract(vW.xz/grid-0.5)-0.5)/fwidth(vW.xz/grid); float l=1.0-min(min(g.x,g.y),1.0); vec2 g2=abs(fract(vW.xz/(grid*5.0)-0.5)-0.5)/fwidth(vW.xz/(grid*5.0)); float l2=1.0-min(min(g2.x,g2.y),1.0);
          c=vec3(0.07,0.095,0.12)*(1.0-0.5*s)+vec3(0.55,0.65,0.75)*(0.07*l+0.16*l2)*(1.0-clamp(d/420.0,0.0,1.0)); }
        c+=vec3(0.6,0.65,0.8)*fl*0.12;
        float f=1.0-exp(-pow(d*fogD,2.0)); c=mix(c,fogC,f); gl_FragColor=vec4(c,1.0); }`,extensions:{derivatives:true}}));
  ground.material.extensions.derivatives=true;
  ground.rotation.x=-Math.PI/2; ground.renderOrder=-5; scene.add(ground);

  /* ---------------- cloud sprites ---------------- */
  const MAXP=LOW?1700:3600;
  const blobTex=(function(){ const N=256,H=128,c=cv(N,N),g=c.getContext('2d'),r=prng(5); g.fillStyle='#000'; g.fillRect(0,0,N,N);
    for(let v=0;v<4;v++){ const ox=(v%2)*H, oy=Math.floor(v/2)*H, cx=ox+H/2, cy=oy+H/2;
      g.save(); g.beginPath(); g.rect(ox,oy,H,H); g.clip(); g.globalCompositeOperation='lighter';
      const big=g.createRadialGradient(cx,cy,0,cx,cy,H*0.42); big.addColorStop(0,'rgba(255,255,255,.55)'); big.addColorStop(0.6,'rgba(255,255,255,.3)'); big.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=big; g.fillRect(ox,oy,H,H);
      for(let k=0;k<26;k++){ const a=r()*Math.PI*2, d=Math.pow(r(),0.6)*H*0.27, rr=H*(0.07+0.11*r()), x=cx+Math.cos(a)*d, y=cy+Math.sin(a)*d;
        const gr=g.createRadialGradient(x,y,0,x,y,rr); gr.addColorStop(0,'rgba(255,255,255,.34)'); gr.addColorStop(0.55,'rgba(255,255,255,.2)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(x-rr,y-rr,2*rr,2*rr); }
      g.restore(); }
    const img=g.getImageData(0,0,N,N), d=img.data; for(let i=0;i<d.length;i+=4){ const v=Math.min(255,d[i]*1.05); d[i]=d[i+1]=d[i+2]=v; d[i+3]=255; } g.putImageData(img,0,0);
    const t=new THREE.CanvasTexture(c); t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true; return t; })();
  const cU={map:{value:blobTex},sunV:{value:new THREE.Vector3()},upV:{value:new THREE.Vector3()},cSun:{value:new THREE.Color()},cAmb:{value:new THREE.Color()},cBase:{value:new THREE.Color()},
    fogC:{value:new THREE.Color()},fogD:{value:0.005},op:{value:1},flash:{value:new THREE.Vector4(0,0,0,0)},flR:{value:7}};
  const cloudMat=new THREE.ShaderMaterial({uniforms:cU,transparent:true,depthWrite:false,premultipliedAlpha:true,
    vertexShader:`attribute vec3 iPos; attribute vec4 iA; attribute vec2 iB; attribute vec2 iC; uniform float fogD; uniform vec4 flash; uniform float flR;
      varying vec2 vP; varying vec2 vT; varying vec4 vA; varying float vDk; varying float vFog; varying float vFl; varying float vY; varying vec2 vC;
      void main(){ vec4 mv=viewMatrix*vec4(iPos,1.0); float a=iB.y*6.2831853, c=cos(a), s=sin(a); vec2 p=position.xy; mv.xy+=p*iA.x;
        vP=p; vec2 t=vec2(c*p.x-s*p.y,s*p.x+c*p.y)*0.48+0.5; float v=floor(fract(iB.y*7.13)*4.0); vT=t*0.5+vec2(mod(v,2.0),floor(v*0.5))*0.5;
        vA=iA; vDk=iB.x; float d=length(mv.xyz); vFog=1.0-exp(-pow(d*fogD,2.0)); vFl=flash.w*exp(-pow(distance(iPos,flash.xyz)/flR,2.0));
        vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]); vY=iPos.y+dot(up,vec3(0.0,1.0,0.0))*p.y*iA.x+vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]).y*p.x*iA.x; vC=iC;
        gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform sampler2D map; uniform vec3 sunV,upV,cSun,cAmb,cBase,fogC; uniform float op;
      varying vec2 vP; varying vec2 vT; varying vec4 vA; varying float vDk; varying float vFog; varying float vFl; varying float vY; varying vec2 vC;
      void main(){ float r2=dot(vP,vP); if(r2>1.0) discard; float t=texture2D(map,vT).r; float a=t*vA.y*op*(1.0-smoothstep(0.7,1.0,r2)); float fe=max(0.04,vA.x*0.05); a*=smoothstep(vC.x,vC.x+fe,vY)*(1.0-smoothstep(vC.y-fe,vC.y,vY)); if(a<0.003) discard;
        float bb=1.0-smoothstep(vC.x,vC.x+vA.x*0.6,vY);
        vec3 n=normalize(vec3(vP*0.85,sqrt(1.0-r2)+0.15)); float lam=clamp(dot(n,sunV)*0.72+0.36,0.0,1.0); float sky=dot(n,upV)*0.5+0.5;
        vec3 col=cAmb*vA.w*(0.5+0.5*sky)+cSun*vA.z*lam; col+=cSun*vA.z*pow(1.0-n.z,2.0)*max(0.0,-sunV.z)*0.55;
        col*=0.72+0.44*t; col=mix(col,cBase*(0.55+0.45*vA.w),max(vDk,bb*0.55*step(-500.0,vC.x))); col+=vec3(0.82,0.86,1.0)*vFl*(0.6+0.4*t);
        col=mix(col,fogC,vFog*0.88); gl_FragColor=vec4(col*a,a); }`});
  const cGeo=new THREE.InstancedBufferGeometry(); { const b=new THREE.PlaneGeometry(2,2); cGeo.index=b.index; cGeo.setAttribute('position',b.attributes.position); }
  const iC=new THREE.InstancedBufferAttribute(new Float32Array(MAXP*2),2); iC.setUsage(THREE.DynamicDrawUsage);
  const iPos=new THREE.InstancedBufferAttribute(new Float32Array(MAXP*3),3), iA=new THREE.InstancedBufferAttribute(new Float32Array(MAXP*4),4), iB=new THREE.InstancedBufferAttribute(new Float32Array(MAXP*2),2);
  iPos.setUsage(THREE.DynamicDrawUsage); iA.setUsage(THREE.DynamicDrawUsage); iB.setUsage(THREE.DynamicDrawUsage);
  cGeo.setAttribute('iPos',iPos); cGeo.setAttribute('iA',iA); cGeo.setAttribute('iB',iB); cGeo.setAttribute('iC',iC); cGeo.instanceCount=0;
  const clouds=new THREE.Mesh(cGeo,cloudMat); clouds.frustumCulled=false; clouds.renderOrder=3; scene.add(clouds);
  /* source arrays (unsorted) */
  const PF=new Float32Array(MAXP),PC=new Float32Array(MAXP),PX=new Float32Array(MAXP),PY=new Float32Array(MAXP),PZ=new Float32Array(MAXP),PS=new Float32Array(MAXP),PA=new Float32Array(MAXP),PL=new Float32Array(MAXP),PO=new Float32Array(MAXP),PD=new Float32Array(MAXP),PR=new Float32Array(MAXP);
  const KIND=new Uint8Array(MAXP),CI=new Uint8Array(MAXP),R1=new Float32Array(MAXP),R2=new Float32Array(MAXP),R3=new Float32Array(MAXP),R4=new Float32Array(MAXP),SUB=new Uint8Array(MAXP);
  { const r=prng(77); for(let i=0;i<MAXP;i++){ R1[i]=r(); R2[i]=r(); R3[i]=r(); R4[i]=r(); PR[i]=r(); } }
  let NPF=0; const ORD=new Uint32Array(MAXP), KEY=new Float32Array(MAXP); const cmpKey=(a,b)=>KEY[b]-KEY[a];
  const K={TOWER:1,DOME:2,ANVIL:3,MAMMA:4,FLANK:5,SHELF:6,LAYER:7,SLAB:8,DECK:9,FOOT:10,SHELFL:11};
  let layoutKey='';
  function addComp(kind,ci,n,sub){ n=Math.round(n*Q); for(let k=0;k<n&&NPF<MAXP;k++){ KIND[NPF]=kind; CI[NPF]=ci; SUB[NPF]=sub?k%sub:0; NPF++; } }
  function layout(){ const ty=ST.cond?ST.cond.type:'single', key=view+':'+(view==='storm'?ty:''); if(key===layoutKey) return; layoutKey=key; NPF=0;
    if(view==='storm'){
      if(ty==='multi'){ for(let c=0;c<4;c++){ addComp(K.TOWER,c,360); addComp(K.DOME,c,30); addComp(K.ANVIL,c,240); addComp(K.MAMMA,c,30); addComp(K.SHELF,c,90); } }
      else if(ty==='squall'){ for(let c=0;c<7;c++){ addComp(K.TOWER,c,170); addComp(K.DOME,c,16); } addComp(K.SLAB,0,1000); addComp(K.SHELFL,3,420); }
      else { addComp(K.TOWER,0,1000); addComp(K.DOME,0,90); addComp(K.ANVIL,0,760); addComp(K.MAMMA,0,190); addComp(K.FLANK,0,320,4); addComp(K.SHELF,0,300); if(ty==='emb') addComp(K.LAYER,0,820); } }
    else if(view==='wx'){ addComp(K.TOWER,0,620); addComp(K.DOME,0,50); addComp(K.ANVIL,0,420); addComp(K.TOWER,1,560); addComp(K.DOME,1,40); addComp(K.ANVIL,1,360); addComp(K.TOWER,2,360); }
    else { addComp(K.DECK,0,1500); addComp(K.FOOT,0,220); } }

  /* cumulus-like tower shape (shared by the main towers and the flanking line) */
  function towerPuff(i,cx0,cz,hb,ht,R,mat,tilt,seed,vx,al,soft,glac){
    const f=R1[i], H=ht-hb, th=R2[i]*6.2831853;
    let Rf; if(!mat){ Rf=R*(0.72+0.36*Math.sin(Math.PI*Math.min(1,f*1.3))); if(f>0.68) Rf*=0.18+0.82*Math.sqrt(Math.max(0,1-Math.pow((f-0.68)/0.32,2))); }
    else Rf=R*(0.86+0.22*f);
    const lump=1+0.17*Math.sin(3*th+f*11+seed*2.1)+0.08*Math.sin(7*th-f*17+seed);
    const rr=Rf*lump*(0.45+0.55*Math.sqrt(R3[i])), h=hb+f*H, cx=cx0+tilt*(h-hb);
    PX[i]=cx+rr*Math.cos(th); PZ[i]=cz+rr*Math.sin(th); PY[i]=h*vx;
    PS[i]=Math.max(0.35,Rf*(0.42+0.26*R4[i]))*(soft?1+0.4*soft:1); PA[i]=al*(soft?1-0.35*soft:1); PD[i]=clamp(1-(h-hb)/1.1,0,1)*0.55;
    if(glac&&f>0.72){ const k=glac*(f-0.72)/0.28; PS[i]*=1+0.55*k; PA[i]*=1-0.25*k; } if(!mat) PS[i]*=f>0.6?0.68:0.8; }
  const DC={x:0,z:0};
  function place(){ layout(); const E=ST.E, cells=view==='wx'?ST.rcells:ST.cells, vx=VEX[view]||1;
    const hbS=view==='wx'?3000*FT2KM:(E?E.base*FT2KM:1), tilt=view==='wx'?0.12:(E?E.tilt:0.2), tropoK=TROPO*FT2KM, anvL=view==='wx'?30:(E?E.anvL:30);
    for(let i=0;i<NPF;i++){ const k=KIND[i]; PA[i]=0; PS[i]=0; PD[i]=0; PF[i]=-1000; PC[i]=1000;
      if(k===K.DECK||k===K.FOOT){ placeMB(i,k); continue; }
      if(k===K.LAYER){ const x=-50+108*R1[i], z=-44+88*R2[i]; let h; if(R4[i]<0.66){ h=(22000+1000*Math.sin(x/4.3)*Math.cos(z/5.1)-1600*R3[i])*FT2KM; } else h=(3500+18000*R3[i])*FT2KM;
        PF[i]=3500*FT2KM*vx; PX[i]=x; PZ[i]=z; PY[i]=h*vx; PS[i]=3.0+1.3*PR[i]; const ex=Math.min(1,Math.min(x+50,58-x,z+44,44-z)/8); PA[i]=0.92*ex; PD[i]=clamp(1-(h-3500*FT2KM)/4,0,1)*0.45; continue; }
      if(k===K.SLAB){ const c3=cells[3]; if(!c3||c3.st==='none') continue; const x=-30+44*R1[i], z=(2*R2[i]-1)*40, trail=x<-6; const top=(trail?27000:TROPO)*FT2KM+(trail?0:0.3*Math.exp(-x*x/30)), th=(trail?2.6:2.2)*(0.5+0.5*R3[i]);
        PX[i]=x; PZ[i]=z; PY[i]=(top-R3[i]*th*0.9)*vx; PS[i]=2.3+1.2*R4[i]; PA[i]=0.85*Math.min(1,(40-Math.abs(z))/7)*Math.min(1,(x+30)/6); PD[i]=trail?0.15:0; continue; }
      if(k===K.SHELFL){ const c=cells[3]; if(!c||c.gust<3) continue; const s=R2[i], z=(2*R1[i]-1)*36, rho=1.5+c.gust*0.97-s*Math.min(5,c.gust*0.5), h=0.4+s*(hbS-0.4)*0.95+0.12*Math.sin(z*0.9+s*6);
        PX[i]=rho; PZ[i]=z; PY[i]=h*vx; PS[i]=0.6+0.45*R3[i]+s*0.4; PA[i]=0.95*clamp((c.gust-3)/3,0,1)*Math.min(1,(36-Math.abs(z))/5); PD[i]=0.5*(1-s*0.5); continue; }
      const c=cells[CI[i]]; if(!c||c.st==='none'||c.al<=0.01) continue;
      const mat=c.st!=='cu', soft=c.st==='dis'?clamp((c.age-(E?E.matEnd:35))/25,0,1):0, ht=Math.min(c.top,TROPO)*FT2KM;
      if(k===K.TOWER){ if(ht-hbS<0.15) continue; towerPuff(i,c.x,c.z,hbS,ht,c.R,mat,tilt,c.seed||0,vx,c.al,soft,c.glac||0); PF[i]=hbS*vx; if(c.anv>0.3) PC[i]=(tropoK+0.45)*vx; continue; }
      if(k===K.DOME){ if(!(c.over>400)) continue; const rho=Math.sqrt(R1[i]), th=R2[i]*6.2831853, rd=c.R*0.55, cx=c.x+tilt*(tropoK-hbS);
        PX[i]=cx+rd*rho*Math.cos(th); PZ[i]=c.z+rd*rho*Math.sin(th); PY[i]=(tropoK+c.over*FT2KM*Math.sqrt(1-rho*rho)*(0.55+0.45*R3[i]))*vx; PS[i]=rd*(0.42+0.22*R4[i]); PA[i]=c.al; continue; }
      if(k===K.ANVIL||k===K.MAMMA){ if(!(c.anv>0)||!mat) continue; const L=anvL*c.anv, cxT=c.x+tilt*(tropoK-hbS);
        if(k===K.ANVIL){ const a=Math.pow(R1[i],0.85), b=2*R2[i]-1, edge=1-b*b, W=c.R*1.05+a*L*0.42;
          const thick=(2.6-1.5*a)*(0.35+0.65*Math.sqrt(edge))*(0.5+0.5*c.anv), top=tropoK+0.35*(1-a)*(c.over>0?1:0.4);
          PX[i]=cxT-c.R*0.9+a*(L+c.R*0.9); PZ[i]=c.z+b*W; PY[i]=(top-R3[i]*thick)*vx; PS[i]=(1.5+1.05*R4[i])*(1-0.32*a)*(0.6+0.4*Math.sqrt(edge));
          PA[i]=c.al*(0.95-0.55*a*a)*(0.45+0.55*edge); PD[i]=0; PC[i]=(top+0.12)*vx; }
        else { if(c.anv<0.55) continue; const a=0.12+0.46*R1[i], b=(2*R2[i]-1)*0.68, edge=1-b*b, W=c.R*1.05+a*L*0.42, thick=(2.6-1.5*a)*(0.35+0.65*Math.sqrt(edge))*(0.5+0.5*c.anv), top=tropoK+0.35*(1-a)*(c.over>0?1:0.4);
          const h=top-thick-(0.2+0.42*R3[i]); PX[i]=cxT-c.R*0.9+a*(L+c.R*0.9)+0.3*Math.sin(i); PZ[i]=c.z+b*W; PY[i]=h*vx; PS[i]=0.5+0.38*R4[i]; PA[i]=c.al*clamp((c.anv-0.55)/0.3,0,1)*0.92; PD[i]=0.18; }
        continue; }
      if(k===K.FLANK){ if(!(c.dev==='incus'||c.dev==='dis')) continue; const j=SUB[i], fr=[0.42,0.3,0.21,0.14][j], rr=[0.42,0.36,0.3,0.25][j], hf=hbS+(ht-hbS)*fr, gr=c.dev==='incus'?clamp((c.age-20)/6,0,1):1;
        towerPuff(i,c.x-3.2-3.4*j,c.z+2.6+3.6*j,hbS,hbS+(hf-hbS)*gr,c.R*rr*(0.6+0.4*gr),false,tilt*0.5,j+5,vx,c.al*(c.st==='dis'?0.6:1),0); PF[i]=hbS*vx; continue; }
      if(k===K.SHELF){ if(!(c.gust>4)||!(c.rain>0)) continue; M.downCentre(E,c,DC); const ang=(2*R1[i]-1)*1.2, s=R2[i], rho=c.gust*0.97-s*Math.min(5,c.gust*0.5), h=0.38+s*(hbS-0.38)*0.95+0.12*Math.sin(ang*9+s*6);
        PX[i]=DC.x+rho*Math.cos(ang); PZ[i]=DC.z+rho*Math.sin(ang); PY[i]=h*vx; PS[i]=0.38+0.3*R3[i]+s*0.3; PC[i]=(hbS+0.1)*vx; PA[i]=c.al*clamp((c.gust-4)/3,0,1)*(1-Math.pow(Math.abs(2*R1[i]-1),3))*0.95*(E&&E.base>4500?0.5:1); PD[i]=0.48*(1-s*0.5); continue; } }
    shade(); sortDirty=true; }
  /* approach: cloud base over the microburst and the rain foot */
  function placeMB(i,k){ const MB=M.MB, xc=-2*MB.xc, Rw=MB.R*2;
    if(k===K.DECK){ const x=-18+24*R1[i], z=-10+20*R2[i], dx=x-xc, yb=3.1-0.4*Math.exp(-(dx*dx+z*z)/10), y=yb+Math.pow(R3[i],1.6)*1.7+0.1*Math.sin(x*1.3+z);
      PF[i]=yb; PX[i]=x; PZ[i]=z; PY[i]=y; PS[i]=0.8+0.6*R4[i]; PA[i]=0.95*Math.min(1,Math.min(x+18,6-x,z+10,10-z)/2.5); PD[i]=0.62*clamp(1-(y-yb)/1.6,0,1); }
    else { const a=R1[i]*6.2831853, r=Rw*(1.05+0.6*R2[i]); PX[i]=xc+r*Math.cos(a); PZ[i]=r*Math.sin(a); PY[i]=0.1+0.32*R3[i]*(1.2-R2[i]); PS[i]=0.3+0.3*R4[i]; PA[i]=0.2*(MB.dv/60); PD[i]=0.65; } }

  /* self-shadowing: splat into a coarse density grid, march towards the sun */
  const GMAX=70000, GD=new Float32Array(GMAX); const G={x0:0,y0:0,z0:0,cs:1,nx:1,ny:1,nz:1};
  const GB={storm:[-55,0,-48,75,22,48,1.7],wx:[-10,0,-40,150,32,90,3.0],mb:[-19,0,-11,7,6,11,0.5]};
  function shade(){ const b=GB[view]; G.x0=b[0]; G.y0=b[1]; G.z0=b[2]; G.cs=b[6]; G.nx=Math.ceil((b[3]-b[0])/G.cs); G.ny=Math.ceil((b[4]-b[1])/G.cs); G.nz=Math.ceil((b[5]-b[2])/G.cs);
    const nx=G.nx,ny=G.ny,nz=G.nz,n=nx*ny*nz; GD.fill(0,0,Math.min(n,GMAX)); const cs3=G.cs*G.cs*G.cs;
    for(let i=0;i<NPF;i++){ if(PA[i]<=0.01) continue; const gx=Math.floor((PX[i]-G.x0)/G.cs), gy=Math.floor((PY[i]-G.y0)/G.cs), gz=Math.floor((PZ[i]-G.z0)/G.cs);
      if(gx<0||gy<0||gz<0||gx>=nx||gy>=ny||gz>=nz) continue; const o=(gy*nz+gz)*nx+gx; if(o<GMAX) GD[o]+=PA[i]*Math.min(3,PS[i]*PS[i]*PS[i]*0.5/cs3); }
    const s=SUN[view==='mb'?'mb':view], st=G.cs*0.9, sig=view==='mb'?0.45:0.4;
    for(let i=0;i<NPF;i++){ if(PA[i]<=0.01) continue; let x=PX[i],y=PY[i],z=PZ[i],acc=0;
      for(let j=0;j<16;j++){ x+=s.x*st; y+=s.y*st; z+=s.z*st; const gx=Math.floor((x-G.x0)/G.cs), gy=Math.floor((y-G.y0)/G.cs), gz=Math.floor((z-G.z0)/G.cs); if(gx<0||gy<0||gz<0||gx>=nx||gy>=ny||gz>=nz) break; acc+=GD[(gy*nz+gz)*nx+gx]; }
      PL[i]=0.16+0.84*Math.exp(-sig*acc); const gx=Math.floor((PX[i]-G.x0)/G.cs), gy=Math.floor((PY[i]-G.y0)/G.cs), gz=Math.floor((PZ[i]-G.z0)/G.cs); let loc=0;
      if(gx>0&&gy>0&&gz>0&&gx<nx-1&&gy<ny-1&&gz<nz-1){ const o=(gy*nz+gz)*nx+gx; loc=GD[o]+0.5*(GD[o+1]+GD[o-1]+GD[o+nx*nz]+GD[o-nx*nz]+GD[o+nx]+GD[o-nx]); }
      PO[i]=0.55+0.45*Math.exp(-0.12*loc); } }
  let sortDirty=true; const lastCam=new THREE.Vector3(1e9,0,0);
  function sortPuffs(){ const cx=camera.position.x, cy=camera.position.y, cz=camera.position.z; let n=0;
    for(let i=0;i<NPF;i++){ if(PA[i]<=0.01||PS[i]<=0) continue; const dx=PX[i]-cx,dy=PY[i]-cy,dz=PZ[i]-cz; KEY[i]=dx*dx+dy*dy+dz*dz; ORD[n++]=i; }
    const sub=ORD.subarray(0,n); sub.sort(cmpKey);
    const p=iPos.array, a=iA.array, b=iB.array, cc=iC.array;
    for(let j=0;j<n;j++){ const i=sub[j]; p[3*j]=PX[i]; p[3*j+1]=PY[i]; p[3*j+2]=PZ[i]; a[4*j]=PS[i]; a[4*j+1]=PA[i]; a[4*j+2]=PL[i]; a[4*j+3]=PO[i]; b[2*j]=PD[i]; b[2*j+1]=PR[i]; cc[2*j]=PF[i]; cc[2*j+1]=PC[i]; }
    cGeo.instanceCount=n; iPos.needsUpdate=true; iA.needsUpdate=true; iB.needsUpdate=true; iC.needsUpdate=true; lastCam.copy(camera.position); sortDirty=false; }

  /* ---------------- rain shafts ---------------- */
  const streakTex=(function(){ const c=cv(64,256),g=c.getContext('2d'),r=prng(3); g.fillStyle='#000'; g.fillRect(0,0,64,256); for(let i=0;i<90;i++){ const x=r()*64,y=r()*256,l=20+r()*60; const gr=g.createLinearGradient(0,y,0,y+l); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(0.5,'rgba(255,255,255,'+(0.3+0.5*r())+')'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(x,y,1.2,l); if(y+l>256) g.fillRect(x,y-256,1.2,l); }
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; })();
  const rainGeo=new THREE.CylinderGeometry(0.82,1.12,1,40,1,true); rainGeo.translate(0,0.5,0);
  const RAIN=[]; for(let k=0;k<8;k++){ const u={t:{value:0},op:{value:0},col:{value:new THREE.Color(0.3,0.34,0.41)},tex:{value:streakTex},rep:{value:new THREE.Vector2(8,3)},hail:{value:0}};
    const m=new THREE.Mesh(rainGeo,new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,premultipliedAlpha:true,
      vertexShader:'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader:`uniform float t,op,hail; uniform vec3 col; uniform sampler2D tex; uniform vec2 rep; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
        void main(){ float f=abs(dot(normalize(vN),normalize(vV))); float a=op*pow(f,0.6)*smoothstep(0.0,0.12,vUv.y+0.05)*(1.0-smoothstep(0.8,1.0,vUv.y));
          float s=texture2D(tex,vec2(vUv.x*rep.x,vUv.y*rep.y+t*1.6)).r; a*=0.55+0.7*s; vec3 c=mix(col,vec3(0.86,0.9,0.95),hail*s*0.6)*(0.85+0.3*s);
          gl_FragColor=vec4(c*a,a); }`}));
    m.renderOrder=2; m.visible=false; m.frustumCulled=false; scene.add(m); RAIN.push({m,u}); }

  /* ---------------- levels: cloud base, 0 °C, −20 °C ---------------- */
  const lvGeo=new THREE.PlaneGeometry(1,1); lvGeo.rotateX(-Math.PI/2);
  function lvMat(c){ return new THREE.ShaderMaterial({uniforms:{col:{value:new THREE.Color(c)},op:{value:0.5}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform vec3 col; uniform float op; varying vec2 vUv; void main(){ vec2 p=abs(vUv-0.5)*2.0; float e=max(p.x,p.y); float r=length(vUv-0.5)*2.0;
      float g=abs(fract(vUv.x*24.0)-0.5)<0.03||abs(fract(vUv.y*24.0)-0.5)<0.03?1.0:0.0; float a=op*(0.06+0.08*g)*(1.0-smoothstep(0.55,1.0,r)); a+=op*0.5*smoothstep(0.985,1.0,e)*(1.0-smoothstep(0.75,1.2,r));
      gl_FragColor=vec4(col,a); }`}); }
  const LV={base:new THREE.Mesh(lvGeo,lvMat(0xc9d2da)),fz:new THREE.Mesh(lvGeo,lvMat(0x9fe0ff)),m20:new THREE.Mesh(lvGeo,lvMat(0x6fb8f0))};
  for(const k in LV){ LV[k].renderOrder=1; LV[k].visible=false; scene.add(LV[k]); }

  /* ---------------- thick lines (segment quads): air-motion trails, lightning ---------------- */
  function Seg(max,w,add){ const v=max*4, pa=new Float32Array(v*3), pb=new Float32Array(v*3), q=new Float32Array(v*2), col=new Float32Array(v*4), idx=new Uint32Array(max*6);
    for(let s=0;s<max;s++){ const o=s*4; q.set([0,-1,0,1,1,-1,1,1],o*2); idx.set([o,o+2,o+1,o+1,o+2,o+3],s*6); }
    const g=new THREE.BufferGeometry(); const A=new THREE.BufferAttribute(pa,3), B=new THREE.BufferAttribute(pb,3), C=new THREE.BufferAttribute(col,4); A.setUsage(THREE.DynamicDrawUsage); B.setUsage(THREE.DynamicDrawUsage); C.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position',A); g.setAttribute('pb',B); g.setAttribute('q',new THREE.BufferAttribute(q,2)); g.setAttribute('col',C); g.setIndex(new THREE.BufferAttribute(idx,1)); g.setDrawRange(0,0);
    const u={res:{value:new THREE.Vector2(800,500)},w:{value:w}};
    const m=new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending,
      vertexShader:`attribute vec3 pb; attribute vec2 q; attribute vec4 col; uniform vec2 res; uniform float w; varying vec4 vC; varying float vS;
        void main(){ vec4 A=projectionMatrix*viewMatrix*vec4(position,1.0), B=projectionMatrix*viewMatrix*vec4(pb,1.0); vec2 a=A.xy/A.w, b=B.xy/B.w; vec2 d=(b-a)*res; float l=length(d); vec2 dir=l>1e-5?d/l:vec2(1.0,0.0);
          vec2 n=vec2(-dir.y,dir.x); vec4 P=mix(A,B,q.x); P.xy+=n*q.y*w/res*P.w; vC=col; vS=q.y; gl_Position=P; }`,
      fragmentShader:'varying vec4 vC; varying float vS; void main(){ float e=1.0-abs(vS); gl_FragColor=vec4(vC.rgb,vC.a*smoothstep(0.0,0.7,e)); }'});
    const mesh=new THREE.Mesh(g,m); mesh.frustumCulled=false; mesh.renderOrder=6; scene.add(mesh);
    return {mesh,u,pa,pb,col,A,B,C,g,max,n:0,
      set(s,ax,ay,az,bx,by,bz,r,gg,bb,al){ const o=s*4; for(let k=0;k<4;k++){ const j=(o+k)*3; pa[j]=ax; pa[j+1]=ay; pa[j+2]=az; pb[j]=bx; pb[j+1]=by; pb[j+2]=bz; const c=(o+k)*4; col[c]=r; col[c+1]=gg; col[c+2]=bb; col[c+3]=al; } },
      done(n){ this.n=n; g.setDrawRange(0,n*6); A.needsUpdate=true; B.needsUpdate=true; C.needsUpdate=true; } }; }

  /* vertical-speed colour scale (ft/min): blue down, white near zero, amber to red up */
  const WMIN=-5000, WMAX=8000, LUT=new Float32Array(64*3);
  { const st=[[-5000,0.22,0.5,1.0],[-1500,0.55,0.78,1.0],[0,0.9,0.92,0.94],[2000,1.0,0.86,0.42],[5000,1.0,0.55,0.2],[8000,0.94,0.22,0.24]];
    for(let i=0;i<64;i++){ const w=WMIN+(WMAX-WMIN)*i/63; let k=0; while(k<st.length-2&&w>st[k+1][0]) k++; const a=st[k],b=st[k+1],t=clamp((w-a[0])/(b[0]-a[0]),0,1); LUT[i*3]=a[1]+(b[1]-a[1])*t; LUT[i*3+1]=a[2]+(b[2]-a[2])*t; LUT[i*3+2]=a[3]+(b[3]-a[3])*t; } }
  CB3D.wcol=w=>{ const i=clamp(Math.round((w-WMIN)/(WMAX-WMIN)*63),0,63); return `rgb(${Math.round(LUT[i*3]*255)},${Math.round(LUT[i*3+1]*255)},${Math.round(LUT[i*3+2]*255)})`; };
  CB3D.WMIN=WMIN; CB3D.WMAX=WMAX;

  /* ---------------- air motion: particles with trails ---------------- */
  const NP=LOW?320:900, TL=9;
  const fx=new Float32Array(NP),fh=new Float32Array(NP),fz=new Float32Array(NP),fa=new Float32Array(NP),fl=new Float32Array(NP),fw=new Float32Array(NP);
  const HX=new Float32Array(NP*TL),HY=new Float32Array(NP*TL),HZ=new Float32Array(NP*TL);
  const flow=Seg(NP*(TL-1),2.2,false); const rnd=Math.random, gauss=()=>(rnd()+rnd()+rnd()-1.5)*1.15;
  function spawnStorm(i){ const cs=ST.cells, E=ST.E; let c=null, tries=0; while(!c&&tries<8){ const q=cs[Math.floor(rnd()*cs.length)]; if(q&&q.st!=='none'&&q.al>0.25) c=q; tries++; }
    if(!c){ fa[i]=-1; return; } const hb=E.base*FT2KM, r=rnd();
    if(c.up>0&&(r<0.5||!(c.dd>0))){ fx[i]=c.x+gauss()*c.R*0.42; fz[i]=c.z+gauss()*c.R*0.42; fh[i]=0.15+rnd()*hb*1.1; }
    else if(c.dd>0&&r<0.85){ M.downCentre(E,c,DC); fx[i]=DC.x+gauss()*c.R*0.4; fz[i]=DC.z+gauss()*c.R*0.4; fh[i]=1.5+rnd()*6; }
    else { const a=rnd()*6.2831853, rr=c.R*(1.4+2*rnd()); fx[i]=c.x+rr*Math.cos(a); fz[i]=c.z+rr*Math.sin(a); fh[i]=0.1+rnd()*0.7; }
    fa[i]=0; fl[i]=2.5+rnd()*3.5; for(let k=0;k<TL;k++){ HX[i*TL+k]=fx[i]; HY[i*TL+k]=fh[i]; HZ[i*TL+k]=fz[i]; } }
  function spawnMB(i){ const MB=M.MB, xc=MB.xc, R=MB.R, r=rnd();
    if(r<0.55){ const a=rnd()*6.2831853, rr=Math.abs(gauss())*R*0.7; fx[i]=xc+rr*Math.cos(a); fz[i]=rr*Math.sin(a)*1.3; fh[i]=1200+rnd()*1300; }
    else { const a=rnd()*6.2831853, rr=R*(0.4+1.8*rnd()); fx[i]=xc+rr*Math.cos(a); fz[i]=rr*Math.sin(a)*1.3; fh[i]=30+rnd()*500; }
    fa[i]=0; fl[i]=2+rnd()*3; for(let k=0;k<TL;k++){ HX[i*TL+k]=fx[i]; HY[i*TL+k]=fh[i]; HZ[i*TL+k]=fz[i]; } }
  let histT=0; const KT=160, KMB=38;
  function stepFlow(dt){ const n=NP, E=ST.E; let s=0; histT+=dt; const push=histT>=0.08; if(push) histT=0;
    for(let i=0;i<n;i++){ if(fa[i]<0||fa[i]>fl[i]){ if(view==='mb') spawnMB(i); else spawnStorm(i); if(fa[i]<0) continue; }
      let w;
      if(view==='mb'){ const MB=M.MB, dx=fx[i]-MB.xc, dz=fz[i], r=Math.sqrt(dx*dx+dz*dz)+1e-4, ur=MB.ur(r,fh[i]); w=MB.wv(r,fh[i]);
        fx[i]+=dx/r*ur/3600*dt*KMB; fz[i]+=dz/r*ur/3600*dt*KMB; fh[i]=Math.max(25,fh[i]+w/60*dt*KMB); if(fh[i]<=26&&ur<4) fa[i]=99; }
      else { const v=M.vel(E,ST.cells,fx[i],fh[i],fz[i]); w=v.w*M.MS2FPM; fx[i]+=v.u*dt*KT/1000; fz[i]+=v.v*dt*KT/1000; fh[i]=Math.max(0.06,fh[i]+v.w*dt*KT/1000);
        if(Math.abs(v.w)<0.6&&Math.abs(v.u)+Math.abs(v.v)<2.5&&fa[i]>0.6) fa[i]+=dt*3; if(fh[i]>17||Math.abs(fx[i])>70||Math.abs(fz[i])>60) fa[i]=99; }
      fw[i]=fw[i]*0.8+w*0.2; fa[i]+=dt;
      const o=i*TL; if(push){ for(let k=TL-1;k>1;k--){ HX[o+k]=HX[o+k-1]; HY[o+k]=HY[o+k-1]; HZ[o+k]=HZ[o+k-1]; } HX[o+1]=HX[o]; HY[o+1]=HY[o]; HZ[o+1]=HZ[o]; } HX[o]=fx[i]; HY[o]=fh[i]; HZ[o]=fz[i];
      const li=clamp(Math.round((fw[i]-WMIN)/(WMAX-WMIN)*63),0,63), r=LUT[li*3], g=LUT[li*3+1], b=LUT[li*3+2], fade=Math.min(1,fa[i]/0.4)*Math.min(1,(fl[i]-fa[i])/0.5);
      for(let k=0;k<TL-1;k++){ const al=fade*(1-k/(TL-1))*0.95; if(al<=0.01) continue; let ax,ay,az,bx,by,bz;
        if(view==='mb'){ ax=-2*HX[o+k+1]; ay=HY[o+k+1]/1000; az=2*HZ[o+k+1]; bx=-2*HX[o+k]; by=HY[o+k]/1000; bz=2*HZ[o+k]; }
        else { const vx=VEX.storm; ax=HX[o+k+1]; ay=HY[o+k+1]*vx; az=HZ[o+k+1]; bx=HX[o+k]; by=HY[o+k]*vx; bz=HZ[o+k]; }
        if(ax===bx&&ay===by&&az===bz) continue; flow.set(s++,ax,ay,az,bx,by,bz,r,g,b,al); } }
    flow.done(s); }

  /* ---------------- hail loop ---------------- */
  const NH=LOW?26:54, hP=new Float32Array(NH*3), hS=new Float32Array(NH), hPh=new Float32Array(NH), hL=new Uint8Array(NH), hZ=new Float32Array(NH), hF=new Float32Array(NH);
  const hailGeo=new THREE.BufferGeometry(); hailGeo.setAttribute('position',new THREE.BufferAttribute(hP,3).setUsage(THREE.DynamicDrawUsage)); hailGeo.setAttribute('sz',new THREE.BufferAttribute(hS,1).setUsage(THREE.DynamicDrawUsage));
  const hailU={scale:{value:400},op:{value:1}};
  const hail=new THREE.Points(hailGeo,new THREE.ShaderMaterial({uniforms:hailU,transparent:true,depthWrite:false,
    vertexShader:'attribute float sz; uniform float scale; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(2.0,sz*scale/-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader:'uniform float op; void main(){ vec2 p=gl_PointCoord*2.0-1.0; float r=dot(p,p); if(r>1.0) discard; float l=0.55+0.45*clamp(dot(normalize(vec3(p.x,-p.y,sqrt(1.0-r))),normalize(vec3(-0.5,0.6,0.6))),0.0,1.0); vec3 c=vec3(0.86,0.93,1.0)*l+vec3(0.25)*pow(max(0.0,1.0-length(p-vec2(-0.35,-0.35))*2.2),2.0); gl_FragColor=vec4(c,op*(1.0-smoothstep(0.75,1.0,r))); }'}));
  hail.frustumCulled=false; hail.renderOrder=7; hail.visible=false; scene.add(hail);
  for(let i=0;i<NH;i++){ hPh[i]=Math.random(); hL[i]=Math.floor(Math.random()*3); hZ[i]=(Math.random()-0.5); hF[i]=0; }
  let hailCell=null;
  function stepHail(dt){ const c=hailCell, E=ST.E; if(!c) return; const vx=VEX.storm, hb=E.base*FT2KM, fz=E.fzl*FT2KM, top=Math.min(E.m40,E.m20+5000)*FT2KM, cx=c.x+E.tilt*((fz+top)/2-hb), R=c.R;
    const yc=(fz+top)/2, ry=(top-fz)/2*0.95, rx=R*0.42, maxS=Math.max(0.6,E.hail);
    const fall=c.anv>0.4, L=E.anvL*c.anv, cxT=c.x+E.tilt*(TROPO*FT2KM-hb), tk=TROPO*FT2KM;
    for(let i=0;i<NH;i++){ let x,y,z=c.z+hZ[i]*R*0.9;
      if(fall&&(i&1)){ const a=0.12+0.42*(hZ[i]+0.5), W=c.R*1.05+a*L*0.42, bot=tk+0.35*(1-a)*(c.over>0?1:0.4)-(2.6-1.5*a)*(0.5+0.5*c.anv); hPh[i]+=dt*0.22; if(hPh[i]>=1) hPh[i]-=1;
        x=cxT-c.R*0.9+a*(L+c.R*0.9); z=c.z+(((hZ[i]*7.3+10)%1)-0.5)*W*0.9; y=bot*(1-hPh[i]); hP[i*3]=x; hP[i*3+1]=y*vx; hP[i*3+2]=z; hS[i]=0.45; continue; }
      if(hF[i]>0){ hF[i]+=dt*0.55; const h=fz-(fz)*hF[i]; x=cx+rx*1.3+R*0.3; y=h; if(hF[i]>=1){ hF[i]=0; hL[i]=0; hPh[i]=0.75; } }
      else { hPh[i]+=dt*0.16; if(hPh[i]>=1){ hPh[i]-=1; hL[i]++; if(hL[i]>=3){ hF[i]=0.001; } } const a=hPh[i]*6.2831853; x=cx+rx*0.25+rx*Math.sin(a); y=yc-ry*Math.cos(a); }
      hP[i*3]=x; hP[i*3+1]=y*vx; hP[i*3+2]=z; hS[i]=0.3+0.22*Math.min(3,hL[i]+hPh[i])*Math.min(maxS,5)/3; }
    hailGeo.attributes.position.needsUpdate=true; hailGeo.attributes.sz.needsUpdate=true; }

  /* ---------------- gust front (the leading edge of the cold outflow) ---------------- */
  const gfGeo=(function(){ const NA=64,NPp=12, pos=new Float32Array(NA*NPp*3), gg=new Float32Array(NA*NPp*2), idx=[]; for(let a=0;a<NA;a++) for(let p=0;p<NPp;p++){ const o=a*NPp+p; gg[o*2]=a/(NA-1)*2-1; gg[o*2+1]=p/(NPp-1); }
    for(let a=0;a<NA-1;a++) for(let p=0;p<NPp-1;p++){ const o=a*NPp+p; idx.push(o,o+NPp,o+1,o+1,o+NPp,o+NPp+1); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('g',new THREE.BufferAttribute(gg,2)); g.setIndex(idx); return g; })();
  const gfU={c:{value:new THREE.Vector2()},rad:{value:10},lin:{value:0},hlf:{value:1.2},len:{value:36},hh:{value:1.6},dep:{value:6},t:{value:0},op:{value:0.9}};
  const gust=new THREE.Mesh(gfGeo,new THREE.ShaderMaterial({uniforms:gfU,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`attribute vec2 g; uniform vec2 c; uniform float rad,lin,hlf,len,hh,dep; varying vec2 vG; varying vec3 vW;
      void main(){ float p=g.y; float rho=rad-dep*p; float y=hh*sin(min(p*2.6,1.0)*1.5708)*(1.0-0.45*smoothstep(0.3,1.0,p)); vec3 P;
        if(lin>0.5) P=vec3(c.x+rho,y,g.x*len); else { float f=g.x*hlf; P=vec3(c.x+cos(f)*rho,y,c.y+sin(f)*rho); }
        vG=g; vW=P; gl_Position=projectionMatrix*viewMatrix*vec4(P,1.0); }`,
    fragmentShader:`uniform float t,op; varying vec2 vG; varying vec3 vW;
      void main(){ vec3 n=normalize(cross(dFdx(vW),dFdy(vW))); vec3 v=normalize(cameraPosition-vW); float fr=1.0-abs(dot(n,v));
        float s=smoothstep(0.85,1.0,fract(vG.y*5.0+t*0.9)); float edge=1.0-smoothstep(0.0,0.08,vG.y); float side=1.0-smoothstep(0.85,1.0,abs(vG.x));
        float a=op*side*(0.10+0.25*pow(fr,2.0)+0.18*s*(1.0-vG.y)+0.6*edge); gl_FragColor=vec4(mix(vec3(0.62,0.78,0.95),vec3(0.95,0.98,1.0),edge),a); }`}));
  gust.material.extensions.derivatives=true; gust.frustumCulled=false; gust.renderOrder=5; gust.visible=false; scene.add(gust);

  /* ---------------- microburst ring vortex ---------------- */
  const NRV=LOW?360:900, rvPhi=new Float32Array(NRV), rvPsi=new Float32Array(NRV), rvJ=new Float32Array(NRV);
  for(let i=0;i<NRV;i++){ rvPhi[i]=Math.random()*6.2831853; rvPsi[i]=Math.random()*6.2831853; rvJ[i]=Math.random(); }
  const rvGeo=new THREE.BufferGeometry(); rvGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(NRV*3),3)); rvGeo.setAttribute('phi',new THREE.BufferAttribute(rvPhi,1)); rvGeo.setAttribute('psi',new THREE.BufferAttribute(rvPsi,1)); rvGeo.setAttribute('jj',new THREE.BufferAttribute(rvJ,1));
  const rvU={c:{value:new THREE.Vector3()},R:{value:2},rc:{value:0.6},h:{value:0.7},t:{value:0},om:{value:1.8},op:{value:1},sz:{value:4}};
  const ring=new THREE.Points(rvGeo,new THREE.ShaderMaterial({uniforms:rvU,transparent:true,depthWrite:false,
    vertexShader:`attribute float phi,psi,jj; uniform vec3 c; uniform float R,rc,h,t,om,sz; varying float vU; varying float vA;
      void main(){ float s=psi+om*t*(0.7+0.6*jj); float rr=rc*(0.3+0.7*jj); float rad=R+rr*cos(s); vec3 P=c+vec3(cos(phi)*rad,h+rr*sin(s)*1.0,sin(phi)*rad);
        vU=cos(s); vA=0.55+0.45*sin(s*3.0+phi*7.0); vec4 mv=viewMatrix*vec4(P,1.0); gl_PointSize=max(1.5,sz*60.0/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`uniform float op; varying float vU; varying float vA; void main(){ vec2 p=gl_PointCoord*2.0-1.0; float r=dot(p,p); if(r>1.0) discard;
      vec3 up=vec3(1.0,0.62,0.25), dn=vec3(0.4,0.7,1.0); vec3 col=mix(dn,up,smoothstep(-0.3,0.3,vU)); gl_FragColor=vec4(col,op*vA*(1.0-r)); }`}));
  ring.frustumCulled=false; ring.renderOrder=7; ring.visible=false; scene.add(ring);

  /* ---------------- lightning ---------------- */
  const bolt=Seg(220,2.6,true), glow=Seg(220,11,true); bolt.mesh.renderOrder=8; glow.mesh.renderOrder=8;
  const BL={t:0,life:0,next:1.2,n:0,x:new Float32Array(240),y:new Float32Array(240),z:new Float32Array(240),par:new Int16Array(240),cg:false,fx:0,fy:0,fz:0};
  function makeBolt(){ const E=ST.E; let c=null; for(const q of ST.cells) if(q.st==='mat'&&q.ltg>0.5&&(!c||q.top>c.top)) c=q; if(!c&&view==='wx') c=ST.rcells[0]; if(!c) return false;
    const vx=VEX[view], fz=(view==='wx'?M.RFZL:E.fzl)*FT2KM, cg=Math.random()<0.45; BL.cg=cg; let n=0; const R=c.R;
    const dc=view==='wx'?{x:c.x+R*0.4,z:c.z}:M.downCentre(E,c,DC);
    let x=dc.x+(Math.random()-0.5)*R*0.6, y=cg?fz+1.5+Math.random()*2.5:fz+3+Math.random()*4, z=dc.z+(Math.random()-0.5)*R*0.6;
    const main=cg?26:22, tx=x+(Math.random()-0.5)*R*1.2, tz=z+(Math.random()-0.5)*R*1.2, dirx=(Math.random()<0.8?1:-1);
    BL.x[n]=x; BL.y[n]=y; BL.z[n]=z; BL.par[n]=-1; n++;
    for(let k=1;k<=main;k++){ const f=k/main; if(cg){ x+=(tx-x)/(main-k+1)+(Math.random()-0.5)*0.9; y=Math.max(0,y-(y)/(main-k+1)*(0.8+0.4*Math.random())); z+=(tz-z)/(main-k+1)+(Math.random()-0.5)*0.9; if(k===main) y=0; }
      else { x+=dirx*(0.25+Math.random()*0.45)+(Math.random()-0.5)*0.3; y+=(Math.random()-0.45)*0.45; z+=(Math.random()-0.5)*0.6; }
      BL.x[n]=x; BL.y[n]=y; BL.z[n]=z; BL.par[n]=n-1; n++; void f; }
    for(let b=0;b<4;b++){ let p=1+Math.floor(Math.random()*(main-4)); let bx=BL.x[p],by=BL.y[p],bz=BL.z[p]; const ln=4+Math.floor(Math.random()*6), dx=(Math.random()-0.5)*1.4, dz=(Math.random()-0.5)*1.4;
      for(let k=0;k<ln&&n<230;k++){ bx+=dx+(Math.random()-0.5)*0.5; by=Math.max(0.05,by-(cg?0.35+Math.random()*0.4:(Math.random()-0.5)*0.4)); bz+=dz+(Math.random()-0.5)*0.5; BL.x[n]=bx; BL.y[n]=by; BL.z[n]=bz; BL.par[n]=p; p=n; n++; } }
    BL.n=n; BL.fx=dc.x; BL.fy=(fz+2)*vx; BL.fz=dc.z;
    let s=0; for(let k=1;k<n;k++){ const p=BL.par[k]; if(p<0) continue; const tr=k<=main?1:0.55; bolt.set(s,BL.x[p],BL.y[p]*vx,BL.z[p],BL.x[k],BL.y[k]*vx,BL.z[k],1,0.97,0.9,tr); glow.set(s,BL.x[p],BL.y[p]*vx,BL.z[p],BL.x[k],BL.y[k]*vx,BL.z[k],0.55,0.6,1,0.32*tr); s++; }
    bolt.done(s); glow.done(s); BL.t=0; BL.life=0.32; return true; }
  let flashV=0;
  function stepBolt(dt,on){ if(!on){ if(bolt.n){ bolt.done(0); glow.done(0); } flashV=0; return; }
    BL.next-=dt; if(BL.next<=0){ BL.next=0.9+Math.random()*2.4; makeBolt(); }
    if(BL.life>0){ BL.t+=dt; const k=BL.t/BL.life, fl=(k<0.25?1:k<0.4?0.25:k<0.55?0.9:Math.max(0,1-(k-0.55)/0.45)); bolt.mesh.material.opacity=1; flashV=fl; bolt.u.w.value=2.6; glow.mesh.visible=bolt.mesh.visible=fl>0.05;
      if(BL.t>=BL.life){ BL.life=0; bolt.done(0); glow.done(0); flashV=0; } } else flashV=0; }

  /* ---------------- icing and turbulence volumes ---------------- */
  const icGeo=new THREE.CylinderGeometry(1,1,1,48,1,true); icGeo.translate(0,0.5,0);
  const icMat=new THREE.ShaderMaterial({uniforms:{t:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader:`varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vec3 v=normalize(cameraPosition-vW); float fr=1.0-abs(dot(normalize(vN),v));
      float h=step(0.55,fract((vW.x+vW.y+vW.z)*0.9)); float e=1.0-smoothstep(0.0,0.04,min(vUv.y,1.0-vUv.y)); float a=0.07+0.13*h+0.32*pow(fr,2.0)+0.6*e; gl_FragColor=vec4(0.55,0.88,1.0,a*0.85); }`});
  const tbMat=new THREE.ShaderMaterial({uniforms:{t:{value:0}},transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader:`uniform float t; varying vec3 vW; varying vec3 vN; void main(){ vec3 v=normalize(cameraPosition-vW); float fr=1.0-abs(dot(normalize(vN),v));
      float b=0.5+0.5*sin(vW.y*1.6+t*2.2+sin(vW.x*0.35+t)*2.0+cos(vW.z*0.4)*1.5); float a=0.012+0.26*pow(fr,3.0)+0.045*b*pow(fr,0.8); gl_FragColor=vec4(0.96,0.68,0.22,a); }`});
  const ICE=[], TURB=[]; for(let k=0;k<7;k++){ const a=new THREE.Mesh(icGeo,icMat); a.visible=false; a.renderOrder=5; scene.add(a); ICE.push(a); const b=new THREE.Mesh(new THREE.SphereGeometry(1,40,24),tbMat); b.visible=false; b.renderOrder=4; scene.add(b); TURB.push(b); }

  /* ---------------- avoidance distances ---------------- */
  function dashLine(col,dash,gap){ const N=200, g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3)); g.setAttribute('lineDistance',new THREE.BufferAttribute(new Float32Array(N),1));
    const l=new THREE.Line(g,new THREE.LineDashedMaterial({color:col,dashSize:dash,gapSize:gap,transparent:true,opacity:0.95,depthWrite:false})); l.renderOrder=6; l.visible=false; l.frustumCulled=false; scene.add(l); return l; }
  const AV=[dashLine(0xe46bae,1.6,1.1),dashLine(0xe46bae,0.6,1.4),dashLine(0xe46bae,1.6,1.1),dashLine(0xe46bae,0.6,1.4)];
  function capsule(line,x0,z0,x1,z1,d,y){ const p=line.geometry.attributes.position.array, ld=line.geometry.attributes.lineDistance.array, N=200; let px=0,pz=0,acc=0;
    for(let i=0;i<N;i++){ const a=i/(N-1)*6.2831853, cx=Math.cos(a)>=0?x1:x0, cz=Math.cos(a)>=0?z1:z0, x=cx+d*Math.cos(a), z=cz+d*Math.sin(a); if(i) acc+=Math.hypot(x-px,z-pz); px=x; pz=z; p[i*3]=x; p[i*3+1]=y; p[i*3+2]=z; ld[i]=acc; }
    line.geometry.attributes.position.needsUpdate=true; line.geometry.attributes.lineDistance.needsUpdate=true; line.geometry.computeBoundingSphere(); }

  /* ---------------- aircraft ---------------- */
  function makeJet(){ const g=new THREE.Group(); const white=new THREE.MeshStandardMaterial({color:0xf3f5f7,roughness:0.32,metalness:0.06}), grey=new THREE.MeshStandardMaterial({color:0xa9b2bb,roughness:0.45,metalness:0.25}), dark=new THREE.MeshStandardMaterial({color:0x1b2530,roughness:0.25,metalness:0.4}), acc=new THREE.MeshStandardMaterial({color:0x9a1e68,roughness:0.4,metalness:0.1});
    const pr=[]; const L=1, N=28; for(let i=0;i<=N;i++){ const t=i/N; let r; if(t<0.13) r=0.056*Math.sqrt(Math.sin(Math.PI/2*t/0.13)); else if(t<0.7) r=0.056; else r=0.056*(1-Math.pow((t-0.7)/0.3,1.5)*0.8); pr.push(new THREE.Vector2(Math.max(0.004,r),(0.5-t)*L)); }
    const fus=new THREE.Mesh(new THREE.LatheGeometry(pr,36),white); fus.rotation.z=-Math.PI/2; fus.scale.set(1,1,0.98); g.add(fus);
    const wind=new THREE.Mesh(new THREE.SphereGeometry(0.05,20,10,0,Math.PI*2,0,Math.PI/3),dark); wind.position.set(0.39,0.012,0); wind.rotation.z=-1.0; wind.scale.set(0.9,0.55,0.8); g.add(wind);
    const wingShape=new THREE.Shape(); wingShape.moveTo(0.06,0.04); wingShape.lineTo(-0.15,0.5); wingShape.lineTo(-0.215,0.5); wingShape.lineTo(-0.19,0.04); wingShape.closePath();
    const ex={depth:0.014,bevelEnabled:true,bevelThickness:0.004,bevelSize:0.004,bevelSegments:2};
    for(const s of [1,-1]){ const w=new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape,ex),white); w.rotation.x=s*Math.PI/2; w.position.y=-0.025+(s>0?0.007:-0.007); g.add(w);
      const e=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.026,0.13,24,1,true),grey); e.rotation.z=Math.PI/2; e.position.set(0.03,-0.06,s*0.17); g.add(e);
      const ei=new THREE.Mesh(new THREE.CircleGeometry(0.029,20),dark); ei.rotation.y=Math.PI/2; ei.position.set(0.095,-0.06,s*0.17); g.add(ei);
      const st=new THREE.Shape(); st.moveTo(-0.39,0.02); st.lineTo(-0.47,0.19); st.lineTo(-0.51,0.19); st.lineTo(-0.48,0.02); st.closePath(); const h=new THREE.Mesh(new THREE.ExtrudeGeometry(st,{depth:0.008,bevelEnabled:false}),white); h.rotation.x=s*Math.PI/2; h.position.y=0.02; g.add(h); }
    const fs=new THREE.Shape(); fs.moveTo(-0.3,0.04); fs.lineTo(-0.44,0.22); fs.lineTo(-0.5,0.22); fs.lineTo(-0.49,0.04); fs.closePath(); const fin=new THREE.Mesh(new THREE.ExtrudeGeometry(fs,{depth:0.008,bevelEnabled:false}),white); fin.position.z=-0.004; g.add(fin);
    const fsx=new THREE.Mesh(new THREE.ExtrudeGeometry(fs,{depth:0.0085,bevelEnabled:false}),acc); fsx.position.z=-0.00425; fsx.scale.set(1,1,1); fsx.position.y=0; g.add(fsx); fsx.visible=false;
    g.traverse(o=>{ if(o.isMesh){ o.renderOrder=0; } }); return g; }
  const jet=makeJet(); scene.add(jet); jet.visible=false;
  const PLN={on:false};
  function line2(col,op){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3)); const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false})); l.frustumCulled=false; l.renderOrder=7; l.visible=false; scene.add(l); return l; }
  const drop=line2(0xffffff,0.55), ruler=line2(0xe46bae,0.95);
  const mark=new THREE.Mesh(new THREE.RingGeometry(0.55,0.85,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.7,depthWrite:false,side:THREE.DoubleSide})); mark.rotation.x=-Math.PI/2; mark.visible=false; mark.renderOrder=7; scene.add(mark);
  function setL(l,ax,ay,az,bx,by,bz){ const a=l.geometry.attributes.position.array; a[0]=ax;a[1]=ay;a[2]=az;a[3]=bx;a[4]=by;a[5]=bz; l.geometry.attributes.position.needsUpdate=true; }
  function planeVis(){ const on=PLN.on&&view==='storm'; drop.visible=ruler.visible=mark.visible=on; if(view==='storm') jet.visible=on; }

  /* ---------------- approach (mb) objects ---------------- */
  const rwyTex=(function(){ const W=1024,H=64,c=cv(W,H),g=c.getContext('2d'); g.fillStyle='#2f3437'; g.fillRect(0,0,W,H); for(let i=0;i<2500;i++){ g.fillStyle=Math.random()<0.5?'rgba(0,0,0,.12)':'rgba(255,255,255,.05)'; g.fillRect(Math.random()*W,Math.random()*H,2,1); }
    g.fillStyle='#e9ecee'; for(let k=0;k<8;k++){ g.fillRect(8,6+k*7,30,4); } for(let x=70;x<W-40;x+=46) g.fillRect(x,H/2-1.5,26,3); g.fillRect(90,14,40,6); g.fillRect(90,H-20,40,6); g.fillRect(150,12,22,4); g.fillRect(150,H-16,22,4); g.fillStyle='#d9dde0'; g.fillRect(0,1,W,1.5); g.fillRect(0,H-2.5,W,1.5);
    const t=new THREE.CanvasTexture(c); t.anisotropy=8; t.encoding=THREE.sRGBEncoding; return t; })();
  const mbG=new THREE.Group(); scene.add(mbG); mbG.visible=false;
  const rwy=new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.24),new THREE.MeshStandardMaterial({map:rwyTex,roughness:0.85})); rwy.rotation.x=-Math.PI/2; rwy.position.set(1.7,0.004,0); mbG.add(rwy);
  const apl=new THREE.Points((()=>{ const g=new THREE.BufferGeometry(), a=[]; for(let i=1;i<=12;i++) a.push(-i*0.075,0.01,0); for(const s of [-1,1]) for(let i=0;i<5;i++) a.push(-0.3,0.01,s*(0.03+i*0.02)); g.setAttribute('position',new THREE.Float32BufferAttribute(a,3)); return g; })(),new THREE.PointsMaterial({color:0xfff2c4,size:3,sizeAttenuation:false})); mbG.add(apl);
  const gpLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:0x71cc93,dashSize:0.25,gapSize:0.18,transparent:true,opacity:0.95})); { const a=[]; for(let i=0;i<=60;i++){ const d=6*i/60; a.push(-2*d,M.MB.gs(d)/1000,0); } gpLine.geometry.setAttribute('position',new THREE.Float32BufferAttribute(a,3)); gpLine.computeLineDistances(); } mbG.add(gpLine);
  const pathGeo=new THREE.BufferGeometry(); pathGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(M.MB.MAXN*3),3)); pathGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(M.MB.MAXN*3),3));
  const pathSeg=Seg(M.MB.MAXN,2.4,false); pathSeg.mesh.visible=false;
  const shadowJ=new THREE.Mesh(new THREE.CircleGeometry(0.22,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.25,depthWrite:false})); shadowJ.rotation.x=-Math.PI/2; shadowJ.scale.set(2.2,1,0.9); mbG.add(shadowJ);

  /* ---------------- radar (wx) objects ---------------- */
  const wxG=new THREE.Group(); scene.add(wxG); wxG.visible=false;
  const curC=cv(512,256), curG=curC.getContext('2d'), curTex=new THREE.CanvasTexture(curC); curTex.encoding=THREE.sRGBEncoding;
  const curtain=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:curTex,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})); curtain.renderOrder=6; wxG.add(curtain);
  const swU={op:{value:0.5},len:{value:100}};
  const sweepGeo=new THREE.ConeGeometry(1,1,24,1,true); sweepGeo.translate(0,-0.5,0); sweepGeo.rotateZ(Math.PI/2);
  const sweep=new THREE.Mesh(sweepGeo,new THREE.ShaderMaterial({uniforms:swU,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:'varying float vX; void main(){ vX=position.x; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'uniform float op; varying float vX; void main(){ gl_FragColor=vec4(0.9,0.42,0.68,op*(0.35+0.65*(1.0-vX))*smoothstep(0.0,0.03,vX)); }'}));
  sweep.renderOrder=7; wxG.add(sweep);
  const SWP={a:0,dir:1};

  /* ---------------- shared state ---------------- */
  const show={flow:false,hail:false,gust:false,ring:false,ltg:true,ice:false,turb:false,avoid:false,levels:true,labels:true,cloud:'solid'};
  let mbK=0;

  /* ---------------- labels with leader lines (as in the wind tunnel) ---------------- */
  let LBL=[], lsvg=null; const tv=new THREE.Vector3();
  function lbl(t,x,y,z,cls,ox,oy,pri){ LBL.push({t,p:new THREE.Vector3(x,y,z),cls:cls||'',ox:ox||0,oy:oy==null?-30:oy,pri:pri||1,x:0,y:0,ax:0,ay:0,w:0,h:0,vis:false,el:null,ln:null,dot:null,follow:null}); return LBL[LBL.length-1]; }
  function buildLabels(){ LBL=[]; labelsEl.innerHTML=''; lsvg=null; if(!show.labels) return; const narrow=host.clientWidth<560; (o.labelSet||(()=>{}))(lbl,api,narrow);
    const cap=narrow?4:6; if(LBL.length>cap){ LBL.forEach((l,i)=>l.ord=i); LBL.sort((a,b)=>b.pri-a.pri||a.ord-b.ord); LBL=LBL.slice(0,cap); }
    const ns='http://www.w3.org/2000/svg'; lsvg=document.createElementNS(ns,'svg'); labelsEl.appendChild(lsvg);
    for(const l of LBL){ l.ln=document.createElementNS(ns,'line'); l.dot=document.createElementNS(ns,'circle'); l.dot.setAttribute('r','2.6'); lsvg.appendChild(l.ln); lsvg.appendChild(l.dot); const d=document.createElement('div'); d.className='lbl '+l.cls; d.textContent=l.t; labelsEl.appendChild(d); l.el=d; } }
  const LOB={t:0,top:8,lx:1e9,ly:1e9};
  function placeLabels(){ const n=LBL.length; if(!n) return; const W=host.clientWidth, H=canvas.clientHeight;
    if(LOB.t<performance.now()-500){ LOB.t=performance.now(); const vr=host.getBoundingClientRect(), ch=o.chip, lg=o.legend; LOB.top=6; LOB.chB=0; LOB.chR=0;
      if(ch&&ch.offsetWidth&&getComputedStyle(ch).position==='absolute'){ const r=ch.getBoundingClientRect(); LOB.chB=r.bottom-vr.top+4; LOB.chR=r.right-vr.left+4; }
      if(lg&&!lg.hidden&&lg.offsetWidth){ const r=lg.getBoundingClientRect(); LOB.lx=r.left-vr.left-4; LOB.ly=r.top-vr.top-4; } else LOB.lx=1e9; }
    for(let i=0;i<n;i++){ const l=LBL[i]; if(l.follow) l.follow(l.p); if(l.txt){ const t=l.txt(); if(t!==l.t){ l.t=t; l.el.textContent=t; l.w=0; } } tv.copy(l.p).project(camera); l.vis=tv.z<1&&Math.abs(tv.x)<1.05&&Math.abs(tv.y)<1.05;
      if(!l.w){ l.w=l.el.offsetWidth||80; l.h=l.el.offsetHeight||20; }
      l.ax=(tv.x*0.5+0.5)*W; l.ay=(-tv.y*0.5+0.5)*H; l.x=clamp(l.ax+l.ox-l.w/2,6,W-l.w-6); l.y=clamp(l.ay+l.oy-l.h/2,LOB.top,H-l.h-6);
      if(l.x<LOB.chR&&l.y<LOB.chB) l.y=LOB.chB; if(l.x+l.w>LOB.lx&&l.y+l.h>LOB.ly) l.y=LOB.ly-l.h-2; }
    for(let it=0;it<8;it++){ let mv=false; for(let i=0;i<n;i++){ const a=LBL[i]; if(!a.vis) continue; for(let j=i+1;j<n;j++){ const b=LBL[j]; if(!b.vis) continue;
      const ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)+6, oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)+4; if(ox>0&&oy>0){ const d=oy/2+0.5, up=a.y<=b.y; a.y+=up?-d:d; b.y+=up?d:-d; mv=true; } } } if(!mv) break; }
    for(let i=0;i<n;i++){ const l=LBL[i]; if(!l.vis){ if(l.el.style.display!=='none'){ l.el.style.display='none'; l.ln.setAttribute('visibility','hidden'); l.dot.setAttribute('visibility','hidden'); } continue; }
      if(l.el.style.display==='none'){ l.el.style.display=''; l.ln.setAttribute('visibility','visible'); l.dot.setAttribute('visibility','visible'); }
      l.y=clamp(l.y,LOB.top,H-l.h-4); if(l.x<LOB.chR&&l.y<LOB.chB) l.y=LOB.chB; l.el.style.transform=`translate(${l.x.toFixed(1)}px,${l.y.toFixed(1)}px)`;
      const ex=clamp(l.ax,l.x,l.x+l.w), ey=clamp(l.ay,l.y,l.y+l.h); l.ln.setAttribute('x1',l.ax.toFixed(1)); l.ln.setAttribute('y1',l.ay.toFixed(1)); l.ln.setAttribute('x2',ex.toFixed(1)); l.ln.setAttribute('y2',ey.toFixed(1));
      l.dot.setAttribute('cx',l.ax.toFixed(1)); l.dot.setAttribute('cy',l.ay.toFixed(1)); } }

  /* ---------------- camera: orbit with damping, presets per view ---------------- */
  const cam={th:1.95,ph:1.3,r:100,tth:1.95,tph:1.3,tr:100,tx:6,ty:9,tz:0,ttx:6,tty:9,ttz:0,vth:0,vph:0,follow:false,minY:0.3};
  const PRE={storm:{q:[1.95,1.33,60,8,8,-3],multi:[1.95,1.3,95,-2,8,0],side:[Math.PI/2,1.5,70,10,9.5,0],top:[Math.PI/2,0.06,96,8,0,0],cockpit:null},
    mb:{q:[2.4,1.49,14,-4.6,1.1,0],side:[Math.PI/2,1.55,13,-5.4,1.2,0],chase:null},
    wx:{q:[2.25,1.2,118,62,9,10],side:[Math.PI/2,1.5,150,74,14,0],top:[Math.PI/2,0.06,215,76,0,16],cockpit:null}};
  let preset='q';
  function setTarget(th,ph,r,x,y,z,inst){ cam.tth=th+2*Math.PI*Math.round((cam.th-th)/(2*Math.PI)); cam.tph=ph; cam.tr=r; cam.ttx=x; cam.tty=y; cam.ttz=z; cam.vth=cam.vph=0; if(inst){ cam.th=cam.tth; cam.ph=cam.tph; cam.r=cam.tr; cam.tx=x; cam.ty=y; cam.tz=z; } }
  function fromPos(px,py,pz,x,y,z,inst){ const dx=px-x,dy=py-y,dz=pz-z, r=Math.sqrt(dx*dx+dy*dy+dz*dz); setTarget(Math.atan2(dz,dx),Math.acos(dy/r),r,x,y,z,inst); }
  const E0=()=>ST.E?ST.E.anvL:30;
  function camTo(k,inst){ preset=k; cam.follow=false; interacted=false; const P=PRE[view];
    if(view==='storm'&&k==='cockpit'){ const c=M.main(ST.cells)||ST.cells[0]; const E=ST.E; let gx=c?(c.x+Math.max(c.gust||8,8)+(c.R||4)):14; if(E&&E.type==='squall') gx=Math.max(c?c.gust:10,10)+14; if(E&&E.type==='multi') gx=26; fromPos(gx+10,0.35,6,(c?c.x:0)+2,7,0,inst); return; }
    if(view==='wx'&&k==='cockpit'){ const y=M.RD.fl*FT2KM*VEX.wx; fromPos(-6,y+1.2,0,90,y-4,6,inst); return; }
    if(view==='mb'&&k==='chase'){ cam.follow=true; setTarget(Math.PI+0.45,1.32,3.4,-8,1.5,0,inst); return; }
    const p=(view==='storm'&&k==='q'&&ST.cond&&(ST.cond.type==='multi'||ST.cond.type==='squall'))?P.multi:(P[k]||P.q); setTarget(p[0],p[1],p[2],p[3],p[4],p[5],inst); }
  const ptrs=new Map(); let pinch0=0, r0=0, lastMove=0, interacted=false;
  canvas.addEventListener('pointerdown',e=>{ if(e.pointerType==='touch'&&!o.touchOrbit) {} canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); cam.vth=cam.vph=0; if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch0=Math.hypot(a.x-b.x,a.y-b.y); r0=cam.tr; } });
  canvas.addEventListener('pointermove',e=>{ if(!ptrs.has(e.pointerId)) return; const p=ptrs.get(e.pointerId), dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY;
    if(ptrs.size===1){ cam.tth+=dx*0.0062; cam.tph=clamp(cam.tph-dy*0.0062,0.05,1.75); cam.vth=dx*0.0062; cam.vph=-dy*0.0062; lastMove=performance.now(); interacted=true; }
    else if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if(pinch0>0) cam.tr=clamp(r0*pinch0/d,cam.rmin||2,cam.rmax||400); } });
  const up=e=>{ ptrs.delete(e.pointerId); pinch0=0; if(performance.now()-lastMove>80) cam.vth=cam.vph=0; };
  canvas.addEventListener('pointerup',up); canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',e=>{ if(!e.ctrlKey&&!host.matches(':hover')) return; e.preventDefault(); interacted=true; cam.tr=clamp(cam.tr*Math.exp(e.deltaY*0.0011),cam.rmin||2,cam.rmax||400); },{passive:false});
  canvas.addEventListener('dblclick',()=>camTo(preset));
  const camPrev=new THREE.Vector3();
  function updCam(){ if(!ptrs.size&&(Math.abs(cam.vth)>1e-4||Math.abs(cam.vph)>1e-4)){ cam.tth+=cam.vth; cam.tph=clamp(cam.tph+cam.vph,0.05,1.75); cam.vth*=0.92; cam.vph*=0.92; }
    if(cam.follow&&view==='mb'){ const i=clamp(Math.floor(mbK),0,Math.max(0,M.MB.n-1)); cam.ttx=-2*M.MB.sD[i]+0.6; cam.tty=M.MB.sH[i]/1000; cam.ttz=0; }
    const k=0.1; cam.th+=(cam.tth-cam.th)*k; cam.ph+=(cam.tph-cam.ph)*k; cam.r+=(cam.tr-cam.r)*k; cam.tx+=(cam.ttx-cam.tx)*k; cam.ty+=(cam.tty-cam.ty)*k; cam.tz+=(cam.ttz-cam.tz)*k;
    const asp=Math.max(0.4,camera.aspect), rr=cam.r*Math.max(1,Math.pow(1.55/asp,0.75));
    camera.position.set(cam.tx+rr*Math.sin(cam.ph)*Math.cos(cam.th),cam.ty+rr*Math.cos(cam.ph),cam.tz+rr*Math.sin(cam.ph)*Math.sin(cam.th));
    if(camera.position.y<cam.minY) camera.position.y=cam.minY; camera.lookAt(cam.tx,cam.ty,cam.tz);
    const moved=camPrev.distanceToSquared(camera.position)>1e-6; camPrev.copy(camera.position); return moved; }

  /* ---------------- look ---------------- */
  function applyLook(){ const p=look==='dark'?PAL.dark:look==='night'?PAL.night:(view==='mb'?PAL.mb:PAL.sky), s=SUN[view];
    cU.cSun.value.setRGB(...p.sun); cU.cAmb.value.setRGB(...p.amb); cU.cBase.value.setRGB(...p.base); cU.fogC.value.setRGB(...p.fog); cU.fogD.value=view==='wx'?p.fd*0.55:p.fd;
    gU.fogC.value.setRGB(...p.fog); gU.fogD.value=cU.fogD.value; gU.dark.value=look==='dark'?1:0; gU.light.value=look==='night'?0.12:p.gl; gU.grid.value=view==='mb'?1:(view==='wx'?20:10); gU.rep.value=view==='mb'?3:(view==='wx'?26:14);
    skyU.zen.value.setRGB(...p.zen); skyU.hor.value.setRGB(...p.hor); skyU.gnd.value.setRGB(...p.gnd); skyU.sun.value.copy(s); sky.visible=look!=='dark';
    sunL.position.copy(s).multiplyScalar(100); sunL.intensity=look==='night'?0.12:view==='mb'?0.75:1.2; hemi.intensity=look==='night'?0.12:view==='mb'?0.55:0.75; renderer.toneMappingExposure=p.exp;
    host.classList.toggle('dk',look==='dark'); }

  /* ---------------- rebuild of the storm-dependent objects ---------------- */
  const CEN={x:0,z:0}; let mainC=null;
  function rebuildStorm(){ const E=ST.E, cells=view==='wx'?ST.rcells:ST.cells, vx=VEX[view]||1, hb=view==='wx'?3000*FT2KM:(E?E.base*FT2KM:1); if(!E) return;
    place();
    /* rain shafts */
    let k=0; const isW=view==='wx';
    for(const c of cells){ if(k>=RAIN.length) break; if(view==='mb') break; if(!(c.rain>0.05)||c.st==='none') continue; const R=RAIN[k++]; if(isW){ DC.x=c.x+c.R*0.4; DC.z=c.z; } else M.downCentre(E,c,DC); const rr=c.R*(c.st==='dis'?0.9:0.72);
      R.m.position.set(DC.x,0,DC.z); R.m.scale.set(rr,hb*vx*1.3,rr); R.u.op.value=0.95*c.rain*(look==='night'?0.4:1)*(ST.cond&&ST.cond.type==='emb'&&!isW?0.85:1); R.u.hail.value=c.hail>=2?1:0; R.u.rep.value.set(Math.max(3,Math.round(rr*2)),2.5); R.m.visible=true; }
    if(view==='mb'){ const MB=M.MB, R=RAIN[k++], rr=MB.R*2*0.75; R.m.position.set(-2*MB.xc,0,0); R.m.scale.set(rr,3.0,rr); R.u.op.value=0.36+0.004*MB.dv; R.u.hail.value=0; R.u.rep.value.set(6,2); R.m.visible=true; }
    for(;k<RAIN.length;k++) RAIN[k].m.visible=false;
    /* ground shadows and wet ground */
    for(let i=0;i<8;i++){ gU.sh.value[i].set(0,0,0,0); gU.sha.value[i]=0; } gU.wet.value.set(0,0,0,0);
    if(view!=='mb'){ const s=SUN[view]; let j=0; for(const c of cells){ if(c.st==='none'||j>=7) continue; const ht=Math.min(c.top,TROPO)*FT2KM*vx;
        const hm=ht*0.5, x=c.x-s.x/s.y*hm, z=c.z-s.z/s.y*hm; gU.sh.value[j].set(x,z,c.R*1.6,c.R*1.6+hm*0.15); gU.sha.value[j]=0.75*c.al; j++;
        if(c.anv>0.2&&c.st!=='cu'&&j<8&&!(ST.cond&&ST.cond.type==='squall')){ const L=(view==='wx'?30:E.anvL)*c.anv, ya=TROPO*FT2KM*vx; gU.sh.value[j].set(c.x+L*0.45-s.x/s.y*ya,c.z-s.z/s.y*ya,L*0.6+c.R,c.R*1.2+L*0.25); gU.sha.value[j]=0.4*c.al; j++; } }
      if(ST.cond&&ST.cond.type==='squall'&&view==='storm'){ gU.sh.value[7].set(-10-s.x/s.y*16,-s.z/s.y*16,26,44); gU.sha.value[7]=0.6; }
      if(ST.cond&&ST.cond.type==='emb'&&view==='storm'){ gU.sh.value[7].set(4,0,62,52); gU.sha.value[7]=0.7; } }
    else { gU.sh.value[0].set(-2*M.MB.xc,0,9,9); gU.sha.value[0]=0.35; gU.wet.value.set(-2*M.MB.xc,0,M.MB.R*2*1.6,0.8); }
    /* levels */
    if(view==='storm'){ const sz=view==='storm'?(E.type==='squall'?90:64):60; mainC=M.main(cells); const cx=mainC?mainC.x+6:6;
      LV.base.position.set(cx,E.base*FT2KM*vx,0); LV.fz.position.set(cx,E.fzl*FT2KM*vx,0); LV.m20.position.set(cx,E.m20*FT2KM*vx,0); for(const q in LV){ LV[q].scale.set(sz,1,sz); LV[q].visible=show.levels; } }
    else if(view==='wx'){ LV.fz.position.set(75,M.RFZL*FT2KM*vx,10); LV.fz.scale.set(170,1,130); LV.fz.visible=show.levels; LV.base.visible=LV.m20.visible=false; }
    else for(const q in LV) LV[q].visible=false;
    /* hazard volumes */
    let ii=0, tt=0; mainC=M.main(cells);
    for(const c of cells){ if(view!=='storm') break; if(c.st==='none'||c.al<0.2) continue; const ht=Math.min(c.top,TROPO)*FT2KM;
      if(show.ice&&c.st!=='cu'&&ii<ICE.length&&c.top>E.fzl){ const m=ICE[ii++]; const h0=E.fzl*FT2KM, h1=Math.min(E.m20*FT2KM,ht), mid=(h0+h1)/2; m.position.set(c.x+E.tilt*(mid-hb),h0*vx,c.z); m.scale.set(c.R*0.95,(h1-h0)*vx,c.R*0.95); m.visible=true; }
      if(show.ice&&c.st==='cu'&&c.top>E.fzl+2000&&ii<ICE.length){ const m=ICE[ii++]; const h0=E.fzl*FT2KM, h1=Math.min(E.m20*FT2KM,ht), mid=(h0+h1)/2; m.position.set(c.x+E.tilt*(mid-hb),h0*vx,c.z); m.scale.set(c.R*0.8,(h1-h0)*vx,c.R*0.8); m.visible=true; }
      if(show.turb&&(c.st==='mat'||c.st==='dis')&&tt<TURB.length){ const m=TURB[tt++]; const L=E.anvL*c.anv*(E.type==='squall'?0.3:1), top=ht+c.over*FT2KM+1.5; m.position.set(c.x+L*0.32+E.tilt*4,top*vx*0.5,c.z); m.scale.set(c.R+5+L*0.4,top*vx*0.55,c.R+5+L*0.1); m.visible=true; } }
    for(;ii<ICE.length;ii++) ICE[ii].visible=false; for(;tt<TURB.length;tt++) TURB[tt].visible=false;
    /* gust front */
    gust.visible=false;
    if(view==='storm'&&show.gust){ let c=null; for(const q of cells) if(q.gust>2&&q.st!=='none'&&(!c||q.gust>c.gust)) c=q; if(c){ if(E.type==='squall'){ gfU.lin.value=1; gfU.c.value.set(1.5,0); gfU.rad.value=c.gust; gfU.len.value=34; } else { M.downCentre(E,c,DC); gfU.lin.value=0; gfU.c.value.set(DC.x,DC.z); gfU.rad.value=c.gust; gfU.hlf.value=E.type==='multi'?1.5:1.3; } gfU.dep.value=Math.min(6,c.gust*0.6); gfU.hh.value=1.3*vx*(c.st==='dis'?0.75:1); gust.visible=true; } }
    /* microburst ring */
    ring.visible=false;
    if(view==='storm'&&show.ring){ let c=null; for(const q of cells) if(q.mb>0.05&&(!c||q.mb>c.mb)) c=q; if(c){ M.downCentre(E,c,DC); rvU.c.value.set(DC.x,0,DC.z); rvU.R.value=1.7; rvU.rc.value=0.75; rvU.h.value=0.85; rvU.op.value=0.4+0.6*c.mb; rvU.sz.value=2.6; ring.visible=true; } }
    if(view==='mb'&&show.ring){ const MB=M.MB; rvU.c.value.set(-2*MB.xc,0,0); rvU.R.value=MB.R*2*0.9; rvU.rc.value=0.5; rvU.h.value=0.55; rvU.op.value=0.9; rvU.sz.value=0.32; ring.visible=true; }
    /* hail */
    hailCell=null; if(view==='storm'&&show.hail){ for(const c of cells) if(c.st==='mat'&&c.hail>0&&(!hailCell||c.top>hailCell.top)) hailCell=c; } hail.visible=!!hailCell;
    /* avoidance */
    for(const l of AV) l.visible=false;
    if(show.avoid&&view==='storm'&&mainC&&mainC.st!=='cu'){ let x0,z0,x1,z1; if(E.type==='squall'){ x0=x1=1; z0=-28; z1=28; } else { x0=mainC.x; z0=z1=mainC.z; x1=mainC.x+E.anvL*mainC.anv*0.55; if(E.type==='multi'){ let mn=1e9,mx=-1e9,zn=1e9,zx=-1e9; for(const q of cells){ if(q.st==='none'||q.st==='cu') continue; mn=Math.min(mn,q.x); mx=Math.max(mx,q.x); zn=Math.min(zn,q.z); zx=Math.max(zx,q.z); } x0=mn; x1=Math.max(mx,mn)+8; z0=zn; z1=zx; } }
      capsule(AV[0],x0,z0,x1,z1,18.5,0.08); capsule(AV[1],x0,z0,x1,z1,37,0.08); AV[0].visible=AV[1].visible=true;
      const yc=(Math.min(mainC.top,TROPO)*FT2KM-1.2)*vx; capsule(AV[2],x0,z0,x1,z1,18.5,yc); AV[2].visible=true; AV[2].material.opacity=0.5; }
    buildLabels(); }

  /* radar curtain: the vertical slice along the track, what the beam sees (and, faint, what is really there) */
  function drawCurtain(){ const RD=M.RD, W=curC.width, H=curC.height, R=RD.rng, Rkm=R*1.852, HTOP=50000; const g=curG; g.clearRect(0,0,W,H);
    const E=RD.E, cs=ST.rcells, bi=60, NR=RD.NR, truth=show.truth;
    for(let px=0;px<W;px+=2){ const r=(px+1)/W*R, x=r*1.852, hc=RD.beamC(r), hw=RD.beamHW(r), k=Math.min(NR-1,Math.floor(r/R*NR)); const att=RD.ATT?RD.ATT[bi*NR+k]:0;
      for(let py=0;py<H;py+=2){ const h=(1-(py+1)/H)*HTOP; const inB=Math.abs(h-hc)<=hw; if(!inB&&!truth) continue; let z=M.dbz(E,cs,x,h,0); if(z<12) continue;
        if(inB){ z=z-att+RD.GAIN[RD.gain]; const c=M.zcol(z,0.9); if(c){ g.fillStyle=c; g.fillRect(px,py,2,2); } else { g.fillStyle='rgba(120,140,160,.18)'; g.fillRect(px,py,2,2); } }
        else { const c=M.zcol(z,0.22); if(c){ g.fillStyle=c; g.fillRect(px,py,2,2); } } } }
    g.lineWidth=2; g.strokeStyle='rgba(240,140,200,.95)'; for(const s of [-1,1]){ g.beginPath(); for(let px=0;px<=W;px+=4){ const r=px/W*R, h=RD.beamC(r)+s*RD.beamHW(r), y=(1-h/HTOP)*H; if(px) g.lineTo(px,y); else g.moveTo(px,y); } g.stroke(); }
    g.setLineDash([6,5]); g.lineWidth=1.2; g.strokeStyle='rgba(240,140,200,.7)'; g.beginPath(); for(let px=0;px<=W;px+=4){ const r=px/W*R, y=(1-RD.beamC(r)/HTOP)*H; if(px) g.lineTo(px,y); else g.moveTo(px,y); } g.stroke(); g.setLineDash([]);
    curTex.needsUpdate=true; const vx=VEX.wx, hT=HTOP*FT2KM*vx; curtain.scale.set(Rkm,hT,1); curtain.position.set(Rkm/2,hT/2,0); swU.len.value=Rkm; }

  /* ---------------- API ---------------- */
  const api={ok:true,LOW,camera,
    setView(v){ view=v; layoutKey=''; jet.visible=v!=='storm'; planeVis(); mbG.visible=v==='mb'; wxG.visible=v==='wx'; pathSeg.mesh.visible=v==='mb'; flow.mesh.visible=false; applyLook();
      cam.rmin=v==='mb'?1.2:v==='wx'?20:10; cam.rmax=v==='mb'?40:v==='wx'?420:260; cam.minY=v==='mb'?0.08:0.25;
      if(v==='wx'){ const s=4.5; jet.scale.set(s,s,s); } else if(v==='mb'){ jet.scale.set(0.75,0.75,0.75); }
      for(let i=0;i<NP;i++) fa[i]=99; camTo('q',true); },
    frame(){ if(view!=='storm'||interacted||!(preset==='q'||preset==='side')||(ST.cond&&(ST.cond.type==='multi'||ST.cond.type==='squall'))) return; const c=M.main(ST.cells); if(!c) return; const top=(Math.min(c.top,TROPO)+c.over)*FT2KM*VEX.storm, wide=c.anv>0.2?E0():0;
      const p=PRE.storm[preset]; const k=clamp((top+wide*0.4)/22,0.32,1); cam.tr=p[2]*(0.35+0.65*k); cam.tty=Math.max(2.5,p[4]*(0.25+0.75*k)); cam.ttx=c.x+(p[3]-0)*(c.anv>0.2?1:0.3); },
    setStorm(E,cells,cond){ ST.E=E; ST.cells=cells; ST.cond=cond; ST.ltg=false; for(const c of cells) if(c.st==='mat'&&c.ltg>0.5) ST.ltg=true; if(view==='storm'){ rebuildStorm(); api.frame(); } },
    rebuild(){ rebuildStorm(); },
    setShow(s){ Object.assign(show,s); cU.op.value=show.cloud==='off'?0:show.cloud==='see'?0.32:1; rebuildStorm(); if(view==='wx') drawCurtain(); },
    setLook(l){ look=l; applyLook(); rebuildStorm(); },
    cam(k){ camTo(k); if(view==='storm') api.frame(); setTimeout(buildLabels,50); }, get preset(){ return preset; },
    presets(){ return view==='mb'?['q','side','chase']:['q','side','cockpit','top']; },
    setMB(){ const MB=M.MB, n=MB.n; let s=0; for(let i=1;i<n;i++){ const dv=MB.sV[i]-MB.vapp; let r=0.93,g=0.95,b=0.97; if(dv<-5){ const t=clamp((-dv-5)/20,0,1); r=0.94+0.0*t; g=0.85-0.55*t; b=0.45-0.2*t; } else if(dv>5){ const t=clamp((dv-5)/15,0,1); r=0.55-0.1*t; g=0.85; b=0.6; }
        pathSeg.set(s++,-2*MB.sD[i-1],MB.sH[i-1]/1000,0,-2*MB.sD[i],MB.sH[i]/1000,0,r,g,b,0.95); } pathSeg.done(s); if(view==='mb') rebuildStorm(); },
    mbK(k){ mbK=k; },
    setPlane(p){ PLN.on=!!p.on; planeVis(); if(!PLN.on||view!=='storm') return; const vx=VEX.storm, y=p.h*FT2KM*vx; jet.scale.set(3.2,3.2,3.2); jet.position.set(p.x,y,p.z); jet.rotation.set(0,-(p.hdg||0),0);
      setL(drop,p.x,y,p.z,p.x,0.05,p.z); mark.position.set(p.x,0.06,p.z); setL(ruler,p.x,0.08,p.z,p.cx,0.08,p.cz); ruler.visible=p.cx!=null; },
    setRadar(){ if(view!=='wx') return; drawCurtain(); const y=M.RD.fl*FT2KM*VEX.wx; jet.position.set(0,y,0); jet.rotation.set(0,0,0); sweep.position.set(0,y,0); buildLabels(); },
    relabel(){ buildLabels(); },
    resize(){ const w=host.clientWidth, h=canvas.clientHeight; if(!w||!h) return; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); for(const S of [flow,bolt,glow,pathSeg]) S.u.res.value.set(w,h); hailU.scale.value=h*0.9; LOB.t=0; buildLabels(); },
    W:(x,hft,z,o2)=>{ const vx=VEX[view]||1; o2.set(x,hft*FT2KM*vx,z); return o2; },
    get view(){ return view; }, get show(){ return show; }, VEX,
    tick(dt,t,anim){ const moved=updCam(); if(moved&&(camera.position.distanceToSquared(lastCam)>(view==='mb'?0.04:1))) sortDirty=true; if(sortDirty) sortPuffs();
      sky.position.copy(camera.position);
      const sv=SUN[view]; cU.sunV.value.copy(sv).transformDirection(camera.matrixWorldInverse); cU.upV.value.set(0,1,0).transformDirection(camera.matrixWorldInverse);
      for(const R of RAIN) if(R.m.visible&&anim) R.u.t.value=t;
      if(anim){ gfU.t.value=t; rvU.t.value=t; tbMat.uniforms.t.value=t; }
      const fOn=show.flow&&(view==='storm'||view==='mb'); flow.mesh.visible=fOn; if(fOn&&anim) stepFlow(Math.min(dt,0.05)); else if(fOn&&!flow.n) stepFlow(0.016);
      if(hail.visible&&anim) stepHail(Math.min(dt,0.05));
      stepBolt(Math.min(dt,0.05),anim&&show.ltg&&((view==='storm'&&ST.ltg)||view==='wx'));
      cU.flash.value.set(BL.fx,BL.fy,BL.fz,flashV*(look==='night'?2.6:1.4)); cU.flR.value=view==='wx'?14:9; skyU.fl.value=flashV*(look==='dark'?0.3:look==='night'?1.6:1); gU.fl.value=flashV*(look==='night'?2:1);
      if(view==='mb'){ const MB=M.MB, i=clamp(Math.floor(mbK),0,Math.max(0,MB.n-1)); const x=-2*MB.sD[i], y=MB.sH[i]/1000; jet.position.set(x,y,0); jet.rotation.set(0,0,MB.sTh[i]*Math.PI/180*1.6); shadowJ.position.set(x+0.0,0.006,0); shadowJ.material.opacity=0.28*clamp(1-y/2.5,0,1); }
      if(view==='wx'&&anim){ SWP.a+=dt*SWP.dir*1.15; if(SWP.a>1.047){ SWP.a=1.047; SWP.dir=-1; } if(SWP.a<-1.047){ SWP.a=-1.047; SWP.dir=1; } const Rk=swU.len.value, w=Rk*Math.tan(1.75*Math.PI/180); sweep.scale.set(Rk,w,w); sweep.rotation.set(0,-SWP.a,M.RD.tilt*Math.PI/180); }
      renderer.render(scene,camera); placeLabels(); }
  };
  new ResizeObserver(()=>api.resize()).observe(canvas);
  return api; };
window.CB3D=CB3D;
})();
