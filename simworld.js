/* NORDAP – the real world in the simulators (simworld.js).
   Loads the ENTO Sandefjord Torp world (world.js: Kartverket terrain, satellite colours, the real airport) into the
   outside view of every simulator that uses otw.js, in place of the generic terrain.
   The simulators fly in their own frame: runway 36 from N=0 (threshold) northwards, E to the right, height 0 on the
   runway. That frame is laid on runway 35 at Torp: N along the runway, E to its right, and heights over a datum that
   follows the real runway profile and blends to the threshold elevation away from the airport. So the runway is always
   at height 0 for the flight model, and the terrain the flight model sees (G.TERRAIN.height) is the real terrain.
   ?world=0 keeps the old generic world. */
(function(G){
'use strict';
if(/[?&]world=0(&|$)/.test(location.search)||!G.OTW||!G.WORLD) return;
const W=G.WORLD, OTW=G.OTW, D2R=Math.PI/180, BASE=(G.document&&document.currentScript&&document.currentScript.src)||location.href;
let U=[0,1], V=[1,0], bear=0, prof=null, e35=0, ready=false, started=false, tPrev=0, qY=null, _v=null;
/* sim (N,E) -> ENTO (E,N) */
function toEnto(N,E){ return [U[0]*N+V[0]*E, U[1]*N+V[1]*E]; }
/* runway datum: the runway profile along the centre line, blended to the threshold 35 elevation 1.5-3.5 km away */
function datum(Ee,Ne){
  if(!prof) return e35;
  const s=Ee*U[0]+Ne*U[1], t=Ee*V[0]+Ne*V[1];
  const i=(Math.max(prof.s0,Math.min(prof.s0+(prof.h.length-1)*prof.step,s))-prof.s0)/prof.step, i0=Math.floor(i), f=i-i0;
  const h=prof.h[i0]+(prof.h[Math.min(prof.h.length-1,i0+1)]-prof.h[i0])*f;
  const ds=s<prof.s0?prof.s0-s:s>prof.s0+(prof.h.length-1)*prof.step?s-(prof.s0+(prof.h.length-1)*prof.step):0;
  const d=Math.hypot(ds,t), k=Math.min(1,Math.max(0,(d-1500)/2000)), w=k*k*(3-2*k);
  return h+(e35-h)*w;
}
function start(){
  if(started) return; started=true;
  const R=OTW.renderer&&OTW.renderer(); if(!R||!R.capabilities.isWebGL2||!OTW.scene) return;
  W.load(new URL('world/ento/',BASE).href).then(()=>{
    const scene=OTW.scene(), cam=OTW.camera(), a=W.airport.rwy;
    U=a.u; V=[U[1],-U[0]]; bear=Math.atan2(U[0],U[1]); prof=a.profile; e35=a.elev35;
    qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-bear); _v=new THREE.Vector3();
    const old=scene.children.slice(); W.attach(scene);
    for(const o of old) if(o.isMesh||o.isPoints||o.isGroup||o.isInstancedMesh) o.visible=false;
    scene.fog=null; cam.far=250000; cam.updateProjectionMatrix();
    W.tod(OTW.tod()==='dusk'?'dusk':OTW.tod()==='night'?'night':'day');
    // the flight model sees the real terrain, over the runway datum
    if(G.TERRAIN){ const orig=G.TERRAIN.height; G.TERRAIN.height=(N,E)=>{ const p=toEnto(N,E), h=W.height(p[0],p[1]); return isFinite(h)?h-datum(p[0],p[1]):orig(N,E); }; }
    W.quality((OTW.lvl||0)===2?'low':(OTW.lvl||0)?'med':'high');
    ready=true; SW.ready=true; mapStart();
  }).catch(e=>{ console.warn('simworld: ENTO world not loaded',e); });
}
/* called by otw.js once the camera is placed in the simulator frame: move it into the ENTO frame, update the world */
OTW.xf=function(cam,S,eye){
  if(!ready) return;
  const p=toEnto(S.N||0,S.E||0);
  cam.position.set(p[0],(S.h||0)+eye+datum(p[0],p[1]),-p[1]);
  cam.quaternion.premultiply(qY);
  const now=performance.now(), dt=tPrev?Math.min(0.25,(now-tPrev)/1000):0.016; tPrev=now;
  W.update(cam,dt);
};
OTW.onTod=function(k){ if(ready) W.tod(k==='dusk'?'dusk':k==='night'?'night':'day'); };
/* ---------- the moving map's terrain (glass.js, G.TERRAIN.mapImages): drawn from the real heights, a few rows per idle slice ---------- */
const MAPS=[{R:25000,PX:600},{R:90000,PX:600}]; let mapsDone=null;
function mapStart(){ if(!G.TERRAIN||!G.document) return; const T=G.TERRAIN, col=T.color, mi0=T.mapImages;
  T.mapImages=()=>mapsDone||mi0();                                     // the old images until the new ones are ready
  const out=[]; let k=0, j=0, d=null;
  const idle=f=>setTimeout(f,40);                                      // not requestIdleCallback: a busy simulator page never goes idle
  const slice=()=>{ const t0=performance.now();
    while(k<MAPS.length&&performance.now()-t0<6){ const M=MAPS[k]; if(!d) d=new Uint8ClampedArray(M.PX*M.PX*4);
      const sp=2*M.R/M.PX, kx=Math.max(1,Math.round(300/sp)), row=new Float32Array(M.PX+kx);
      for(let n=0;n<6&&j<M.PX;n++,j++){ const N=M.R-(j+0.5)*sp;
        for(let i=0;i<M.PX+kx;i++){ const p=toEnto(N,-M.R+(i+0.5)*sp); row[i]=W.height(p[0],p[1]); }
        for(let i=0;i<M.PX;i++){ const h=row[i], dx=(row[i+kx]-h)*300/(kx*sp);
        const sea=!(h>0.6); let [r,g,b]=col(sea?-5:h); if(!sea){ const sh=Math.max(-25,Math.min(25,-dx*0.25)); r+=sh; g+=sh; b+=sh; }
        const o=(j*M.PX+i)*4; d[o]=r*0.55; d[o+1]=g*0.55; d[o+2]=b*0.55; d[o+3]=255; } }
      if(j>=M.PX){ const c=document.createElement('canvas'); c.width=c.height=M.PX; const g=c.getContext('2d'), id=g.createImageData(M.PX,M.PX); id.data.set(d); g.putImageData(id,0,0);
        out.push({canvas:c,R:M.R,PX:M.PX}); k++; j=0; d=null; } }
    if(k<MAPS.length) idle(slice); else mapsDone=out; };
  SW.mapState=()=>({k,j,done:!!mapsDone}); idle(slice); }
/* ---------- A320 (own flight model, a320fm.js): radio altitude and ground contact over the real terrain ---------- */
function hookA320step(){ const F=G.A320FM; if(!F||F.__swStep) return; F.__swStep=true; const s0=F.step;
  F.step=function(M,dt,sys){ const r=s0.apply(this,arguments);
    if(ready&&M&&!M.gnd&&!M.crash&&G.TERRAIN){ const th=G.TERRAIN.height(M.N,M.E);
      if(th>0){ M.ra=Math.max(0,M.h-th); if(th>5&&M.h<=th){ M.crash='Controlled flight into terrain'; M.h=th; } } }
    return r; }; }
const init0=OTW.init;
OTW.init=function(c){ const r=init0.apply(this,arguments); if(r) start(); return r; };
const q0=OTW.quality;
OTW.quality=function(low){ const r=q0.apply(this,arguments); if(ready) W.quality(low===2?'low':low?'med':'high'); return r; };
/* ---------- start positions at Torp ----------
   The simulators' own parking spots (fictional ramp south-west of the runway, a run-up bay) are moved to the real
   airport: light aircraft to GA stand 32 (facing the taxiway), the airliner just pushed back from stand 3 onto taxiway T
   (the simulators have no push-back), run-up to behind holding point W1. Fixed numbers from world/ento/airport.json,
   so this works before the world has loaded. Runway starts stay where they are (on the real runway). */
const U0=[-0.011793389153357746,0.9999304555679248], V0=[U0[1],-U0[0]], BEAR=Math.atan2(U0[0],U0[1])/D2R;
const sim=(Ee,Ne,hdgT)=>({N:Ee*U0[0]+Ne*U0[1], E:Ee*V0[0]+Ne*V0[1], hdg:((hdgT-BEAR)%360+360)%360});
const SPOT={ga:sim(-150.69,1114.29,96.8),
  airline:sim(-214.0,384.0,179.3),                                     // pushed back from stand 3 onto taxiway T, nose south (towards W1)
  runup:sim(-100.45-0.51*14,182.75+0.86*14,149.3)};
function remap(N,E,air){ if(air) return null; N=+N||0; E=+E||0;
  if(Math.abs(E)<40&&N>-300&&N<3200) return null;                      // on or by the runway: keep
  if(Math.abs(N-62)<20&&Math.abs(E-58)<20) return SPOT.runup;
  return air===false?SPOT.airline:SPOT.ga; }
function hookFDM(){ const F=G.FDM; if(!F||F.__sw) return; F.__sw=true; const p0=F.place;
  F.place=function(s,o){ const r=o&&o.ground?remap(o.N,o.E,null):null; return p0.call(this,s,r?Object.assign({},o,{N:r.N,E:r.E,hdg:r.hdg}):o); }; }
function hookA320(){ const F=G.A320FM; if(!F||F.__sw) return; F.__sw=true; const c0=F.create;
  F.create=function(o){ const r=o&&!o.air?remap(o.N,o.E,false):null; if(!r) return c0.apply(this,arguments);
    const M=c0.call(this,Object.assign({},o,{N:r.N,E:r.E})), H=r.hdg*D2R;
    for(const k of ['psi','chi']){ let v=M[k]; Object.defineProperty(M,k,{configurable:true,enumerable:true,get:()=>v,
      set:x=>{ Object.defineProperty(M,k,{value:H,writable:true,enumerable:true,configurable:true}); }}); }   // the page's first heading is the old ramp's
    return M; }; }
/* the flight models may load after this file: hook them the moment they are defined */
function when(name,hook){ if(G[name]){ hook(); return; } let v;
  try{ Object.defineProperty(G,name,{configurable:true,enumerable:true,get:()=>v,set:x=>{ Object.defineProperty(G,name,{value:x,writable:true,enumerable:true,configurable:true}); hook(); }}); }catch(e){} }
when('FDM',hookFDM); when('A320FM',()=>{ hookA320(); hookA320step(); });
/* stand 3 at Torp in the simulator frame: N, E, heading (deg) */
const SW={ready:false, toSim(Ee,Ne){ return {N:Ee*U[0]+Ne*U[1], E:Ee*V[0]+Ne*V[1]}; },
  stand(id){ if(!ready) return null; const st=(W.airport.rwy.stands||[]).find(x=>x.id===String(id)); if(!st) return null; const p=SW.toSim(st.E,st.N);
    return {N:p.N,E:p.E,hdg:((st.hdg-bear/D2R)%360+360)%360}; } };
G.SIMWORLD=SW;
})(window);
