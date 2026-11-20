/* NORDAP – airspace3d.js: the 3D view of the airspace lab (airspace.html), on three.js r128 (three.min.js).
   ASP3D.mount(canvas, {fOf, onPick}) returns {update(state), layers(obj), select(key), view(name), resize()}.
   One unit = 1 NM horizontally; heights use the lab's stretched scale (fOf: altitude → 0..1) times HZ units, so the CTR
   and the TMA steps stay readable next to FL195 (marked "heights not to scale" in the page).
   Volumes are lathe solids (rings and cylinders) and boxes with MeshBasic transparent faces and their edges drawn as lines.
   Drag to orbit, wheel or pinch to zoom; tap a volume to pick it. Renders on demand. */
(function(){
'use strict';
if(!window.THREE) return;
const T=THREE, HZ=30;
const CC={C:0x5E9BD6,D:0x3FB6A8,E:0xB48AD8,R:0xEC5A47,RMZ:0xF0B440};
function mount(cv,o){
  const fOf=o.fOf, H=a=>fOf(a)*HZ;
  const ren=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true}); ren.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const scene=new T.Scene(), cam=new T.PerspectiveCamera(34,1,0.5,1000);
  const vols={};                         /* key → {mesh, edges, base opacity} */
  const labels=[];
  function sprite(text,o){ o=o||{}; const fs=o.fs||44, c=document.createElement('canvas'), g=c.getContext('2d'); g.font=`${o.w||700} ${fs}px "Public Sans", sans-serif`;
    const lines=String(text).split('\n'), w=Math.ceil(Math.max(...lines.map(l=>g.measureText(l).width)))+28, h=lines.length*fs*1.2+16; c.width=w; c.height=h;
    g.font=`${o.w||700} ${fs}px "Public Sans", sans-serif`; if(o.bg!==false){ g.fillStyle=o.bg||'rgba(12,16,20,.72)'; g.beginPath(); g.roundRect?g.roundRect(0,0,w,h,12):g.rect(0,0,w,h); g.fill(); }
    lines.forEach((l,i)=>{ g.fillStyle=i?(o.col2||'#C9D2DA'):(o.col||'#fff'); g.font=`${i?500:(o.w||700)} ${i?fs*.72:fs}px ${i?'"IBM Plex Mono", monospace':'"Public Sans", sans-serif'}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(l,w/2,8+fs*1.2*(i+.5)); });
    const tex=new T.CanvasTexture(c); tex.minFilter=T.LinearFilter; const m=new T.SpriteMaterial({map:tex,depthTest:false,transparent:true,sizeAttenuation:false}); const s=new T.Sprite(m);
    s.userData.pw=w*.3*(o.size||1); s.userData.ph=h*.3*(o.size||1); fitSprite(s); s.renderOrder=50; return s; }
  /* labels keep the same size on screen: CSS pixels over the canvas height */
  function fitSprite(s){ const hc=Math.max(200,cv.clientHeight||500), k=(cv.clientWidth<560?.8:1)*2*Math.tan(cam.fov*Math.PI/360)/hc; s.scale.set(s.userData.pw*k,s.userData.ph*k,1); }
  function label(text,x,y,z,o){ const s=sprite(text,o); s.position.set(x,y,z); scene.add(s); labels.push(s); return s; }
  function solid(key,geo,col,op,ord){ const m=new T.Mesh(geo,new T.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false,side:T.DoubleSide}));
    m.renderOrder=ord||1; const e=new T.LineSegments(new T.EdgesGeometry(geo,25),new T.LineBasicMaterial({color:col,transparent:true,opacity:.9}));
    m.userData.key=key; const grp=new T.Group(); grp.add(m); grp.add(e); scene.add(grp); vols[key]={grp,m,e,op}; return grp; }
  const ring=(r0,r1,a0,a1)=>{ const p=r0>0?[[r0,H(a0)],[r1,H(a0)],[r1,H(a1)],[r0,H(a1)],[r0,H(a0)]]:[[0,H(a0)],[r1,H(a0)],[r1,H(a1)],[0,H(a1)]]; return new T.LatheGeometry(p.map(([x,y])=>new T.Vector2(x,y)),72); };
  /* ground: disc, range rings, route, aerodromes */
  const gnd=new T.Mesh(new T.CircleGeometry(44,96),new T.MeshBasicMaterial({color:0x172019})); gnd.rotation.x=-Math.PI/2; gnd.position.y=-0.02; scene.add(gnd);
  const lineMat=(c,op,dash)=>dash?new T.LineDashedMaterial({color:c,transparent:true,opacity:op,dashSize:1,gapSize:.8}):new T.LineBasicMaterial({color:c,transparent:true,opacity:op});
  function circle(r,y,c,op,cx,dash){ const pts=[]; for(let i=0;i<=96;i++){ const a=i/96*Math.PI*2; pts.push(new T.Vector3((cx||0)+Math.cos(a)*r,y,Math.sin(a)*r)); } const l=new T.Line(new T.BufferGeometry().setFromPoints(pts),lineMat(c,op,dash)); if(dash) l.computeLineDistances(); scene.add(l); return l; }
  [10,20,30,40].forEach(r=>circle(r,0.01,0x8E99A4,.18));
  { const l=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-42,.03,0),new T.Vector3(42,.03,0)]),lineMat(0xE46BAE,.6,true)); l.computeLineDistances(); scene.add(l); }
  const rw=new T.Mesh(new T.PlaneGeometry(2.4,.35),new T.MeshBasicMaterial({color:0xE6EBEF})); rw.rotation.x=-Math.PI/2; rw.position.y=.04; scene.add(rw);
  /* the volumes (the same geometry as airspacecore.js) */
  solid('up',ring(0,40,19500,30000),CC.C,.035,1);
  solid('cta',ring(25,40,9500,19500),CC.E,.08,2);
  solid('tma3',ring(15,25,4500,19500),CC.C,.10,3);
  solid('tma2',ring(8,15,3500,19500),CC.C,.10,4);
  solid('tma1',ring(0,8,2500,19500),CC.C,.10,5);
  solid('ctr',ring(0,8,0,2500),CC.D,.34,6);
  solid('rmz',ring(0,4,0,2000),CC.RMZ,.18,7).position.x=33;
  { const g=new T.BoxGeometry(6,H(6500),10); g.translate(-31,H(6500)/2,0); solid('r',g,CC.R,.20,8); }
  /* labels inside the volumes */
  const L=o.L, t2=(en,no)=>({en,no});
  const LB={};
  function labelsDraw(){ Object.values(LB).forEach(s=>{ scene.remove(s); const i=labels.indexOf(s); if(i>=0) labels.splice(i,1); });
    LB.ad=label(L(t2('Aerodrome','Flyplass')),0,-.2,3.2,{fs:34,bg:false,w:600}); LB.af=label(L(t2('Airfield','Småflyplass')),33,-.2,2.6,{fs:30,bg:false,w:600,col:'#C9D2DA'});
    LB.ctr=label('D · CTR',-5,H(1500),6,{col:'#7FE0D3'});
    LB.tma=label('C · TMA',-3,H(14000),3,{col:'#9CC7F0'});
    LB.s2=label('3500 ft',11.5,H(3500)+.4,-0,{fs:30,col:'#9CC7F0',w:600});
    LB.s3=label('4500 ft',20,H(4500)+.4,0,{fs:30,col:'#9CC7F0',w:600});
    LB.cta=label('E · CTA',30,H(15000),-22,{col:'#D4B8F0'});
    LB.cta2=label('E',-34,H(14000),-12,{fs:40,bg:false,col:'#D4B8F0'});
    LB.up=label(L(t2('C · upper airspace','C · øvre luftrom'))+'\nFL195–FL660',0,H(27500),0,{col:'#9CC7F0',size:.85});
    LB.r=label('R-101',-31,H(6500)+1.4,0,{col:'#F5A196'});
    LB.rmz=label('RMZ',33,H(2000)+1.4,0,{col:'#F7D08A'});
    LB.g1=label('G',-12,H(1200),8,{fs:40,bg:false,col:'#9AA5AF'}); LB.g2=label('G',20,H(1500),-10,{fs:40,bg:false,col:'#9AA5AF'}); LB.g3=label('G',-36,H(4000),-14,{fs:40,bg:false,col:'#9AA5AF'});
    /* the altitude pole */
    [[0,'SFC'],[3000,'3000 ft'],[5000,'TA 5000 ft'],[10000,'FL100'],[19500,'FL195'],[30000,'FL300']].forEach(([a,s],i)=>{ LB['p'+i]=label(s,46,H(a),-32,{fs:34,w:600,col:a===10000?'#F0B440':a===19500?'#EC8A7C':a===5000?'#7FCBE8':'#C9D2DA'}); }); }
  { const pts=[new T.Vector3(44.5,0,-32),new T.Vector3(44.5,H(30000),-32)]; scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),lineMat(0xAEB8C1,.6)));
    [0,3000,5000,10000,19500,30000].forEach(a=>{ const y=H(a); scene.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(43.8,y,-32),new T.Vector3(45.2,y,-32)]),lineMat(0xAEB8C1,.9))); }); }
  labelsDraw();
  /* cloud layer */
  const cloud=new T.Mesh(new T.CylinderGeometry(42,42,1,72,1,true),new T.MeshBasicMaterial({color:0xDDE4EA,transparent:true,opacity:.05,depthWrite:false,side:T.DoubleSide}));
  const cloudTop=new T.Mesh(new T.CircleGeometry(42,72),new T.MeshBasicMaterial({color:0xDDE4EA,transparent:true,opacity:.05,depthWrite:false,side:T.DoubleSide})); cloudTop.rotation.x=-Math.PI/2;
  const cloudBot=cloudTop.clone(); cloudBot.material=cloudTop.material.clone(); cloudBot.material.opacity=.09;
  [cloud,cloudTop,cloudBot].forEach(m=>{ m.renderOrder=20; scene.add(m); });
  /* the aircraft */
  const ac=new T.Group(), acMat=new T.MeshBasicMaterial({color:0xE46BAE});
  { const f=new T.Mesh(new T.CylinderGeometry(.22,.12,2.6,10),acMat); f.rotation.z=Math.PI/2; ac.add(f);
    const w=new T.Mesh(new T.BoxGeometry(.6,.08,3),acMat); w.position.x=.1; ac.add(w);
    const t=new T.Mesh(new T.BoxGeometry(.4,.06,1.2),acMat); t.position.x=-1.1; ac.add(t);
    const fin=new T.Mesh(new T.BoxGeometry(.45,.7,.06),acMat); fin.position.set(-1.1,.35,0); ac.add(fin);
    const halo=new T.Mesh(new T.SphereGeometry(1.25,16,12),new T.MeshBasicMaterial({color:0xE46BAE,transparent:true,opacity:.18,depthWrite:false})); ac.add(halo); ac.userData.halo=halo; }
  ac.renderOrder=40; scene.add(ac);
  const drop=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),lineMat(0xE46BAE,.7,true)); scene.add(drop);
  const foot=new T.Mesh(new T.RingGeometry(.5,.8,24),new T.MeshBasicMaterial({color:0xE46BAE,transparent:true,opacity:.8,side:T.DoubleSide})); foot.rotation.x=-Math.PI/2; foot.position.y=.05; scene.add(foot);
  const acTag=label('',0,0,0,{fs:30});
  /* camera: orbit */
  const V={yaw:-0.5,pitch:0.34,dist:108,tx:0,ty:H(5000),tz:0};
  const VIEWS={iso:{yaw:-0.5,pitch:0.34,dist:108},side:{yaw:0,pitch:0.03,dist:132},top:{yaw:0,pitch:1.5,dist:120}};
  function place(){ const cp=Math.cos(V.pitch), d=V.dist*Math.max(1,1.15/Math.max(.3,cam.aspect)); cam.position.set(V.tx+d*cp*Math.sin(V.yaw),V.ty+d*Math.sin(V.pitch),V.tz+d*cp*Math.cos(V.yaw)); cam.lookAt(V.tx,V.ty,V.tz); }
  let raf=0; function render(){ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; place(); ren.render(scene,cam); }); }
  function resize(){ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return; ren.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); labels.forEach(fitSprite); render(); }
  new ResizeObserver(resize).observe(cv);
  /* pointer: orbit, pinch, tap to pick */
  const pts=new Map(); let moved=0, pinch0=0, d0=0;
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=0; if(pts.size===2){ const [a,b]=[...pts.values()]; pinch0=Math.hypot(a.x-b.x,a.y-b.y); d0=V.dist; } });
  cv.addEventListener('pointermove',e=>{ const p=pts.get(e.pointerId); if(!p) return; const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY; moved+=Math.abs(dx)+Math.abs(dy);
    if(pts.size===2){ const [a,b]=[...pts.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); if(pinch0) V.dist=Math.max(40,Math.min(200,d0*pinch0/d)); }
    else { V.yaw-=dx*0.008; V.pitch=Math.max(0.02,Math.min(1.5,V.pitch+dy*0.006)); } render(); });
  const up=e=>{ const p=pts.get(e.pointerId); pts.delete(e.pointerId); if(pts.size<2) pinch0=0; if(p&&moved<6&&pts.size===0) pick(e); };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',e=>pts.delete(e.pointerId));
  cv.addEventListener('wheel',e=>{ e.preventDefault(); V.dist=Math.max(40,Math.min(200,V.dist*(1+Math.sign(e.deltaY)*0.08))); render(); },{passive:false});
  const ray=new T.Raycaster();
  function pick(e){ const r=cv.getBoundingClientRect(); ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),cam);
    const hits=ray.intersectObjects(Object.values(vols).filter(v=>v.grp.visible).map(v=>v.m)); /* the smallest volume hit wins (CTR inside the TMA's lathe and so on) */
    const order=['ctr','rmz','r','tma1','tma2','tma3','cta','up']; const keys=[...new Set(hits.map(h=>h.object.userData.key))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));
    o.onPick&&o.onPick(keys[0]||null); }
  /* state */
  let sel=null, inKey=null;
  function paint(){ Object.entries(vols).forEach(([k,v])=>{ const on=k===sel||k===inKey; v.m.material.opacity=on?Math.min(.55,v.op*2.4+.08):v.op; v.e.material.opacity=on?1:.55; v.e.material.linewidth=1; }); render(); }
  function update(S){ const y=H(S.alt); ac.position.set(S.x,y,0); ac.scale.setScalar(S.small?2.2:1.7);
    acMat.color.setHex(S.col); ac.userData.halo.material.color.setHex(S.col);
    drop.geometry.setFromPoints([new T.Vector3(S.x,y,0),new T.Vector3(S.x,0,0)]); drop.computeLineDistances(); drop.material.color.setHex(S.col); foot.position.x=S.x; foot.material.color.setHex(S.col);
    scene.remove(acTag); const i=labels.indexOf(acTag); if(i>=0) labels.splice(i,1);
    const nt=sprite(S.tag,{fs:40,col:'#fff',bg:'rgba(154,30,104,.92)'}); acTag.material=nt.material; acTag.userData=nt.userData; fitSprite(acTag); acTag.position.set(S.x,y+3.4,0); acTag.renderOrder=60; scene.add(acTag);
    if(S.base==null){ [cloud,cloudTop,cloudBot].forEach(m=>m.visible=false); } else { const b=H(S.base), t=H(S.base+S.thick); [cloud,cloudTop,cloudBot].forEach(m=>m.visible=layersOn.cloud!==false); cloud.scale.y=t-b; cloud.position.y=(b+t)/2; cloudTop.position.y=t; cloudBot.position.y=b; }
    inKey=S.inKey; paint(); }
  const layersOn={};
  function layers(L2){ Object.assign(layersOn,L2); const map={ctr:['ctr'],tma:['tma1','tma2','tma3'],cta:['cta'],up:['up'],areas:['r','rmz']};
    Object.entries(map).forEach(([k,ks])=>ks.forEach(x=>{ if(vols[x]) vols[x].grp.visible=layersOn[k]!==false; }));
    const lv={ctr:['ctr'],tma:['tma','s2','s3'],cta:['cta','cta2'],up:['up'],areas:['r','rmz']}; Object.entries(lv).forEach(([k,ks])=>ks.forEach(x=>{ if(LB[x]) LB[x].visible=layersOn[k]!==false; }));
    [cloud,cloudTop,cloudBot].forEach(m=>{ if(layersOn.cloud===false) m.visible=false; }); render(); }
  function select(k){ sel=k; paint(); }
  function view(n){ const v=VIEWS[n]; if(v) Object.assign(V,v); render(); }
  function relabel(){ labelsDraw(); layers({}); }
  resize();
  return {update,layers,select,view,resize,render,relabel,get sel(){ return sel; }};
}
window.ASP3D={mount};
})();
