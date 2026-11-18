/* NORDAP – A320 3D cockpit (beta), a320-3d.html.
   Fast by construction: the flight deck is the same rendered pictures as the 2D page, each panel (overhead, glareshield and main
   panel, pedestal, side consoles) put back on its own plane exactly where it sits in the 3D model it was rendered from
   (tools/render-a320: centre, normal and size of each orthographic view), plus a few flat-shaded shell pieces. That is about
   twenty draw calls on top of the outside world (otw.js render3d), with no lighting and no shadows. Lit legends and switch
   positions are painted into the panel texture only when one changes; the screens are small canvas textures updated at their
   own rate and only when in view. A click is a ray–plane hit turned back into panel units, so every control is the same control
   as on the 2D page.
   Model frame (FlightGear A320-family flight deck): x aft, y up, z left. three.js frame here: x right, y up, z aft. */
(function(G){
'use strict';
const THREE=G.THREE; if(!THREE) return;
const D2R=Math.PI/180;
const V=(x,y,z)=>new THREE.Vector3(-z,y,x); // model -> three
/* the orthographic views the sheet was rendered from: centre, view direction, up, size (m), and where they are on the sheet (units) */
const VIEWS={
  ovh:{c:[0.385,1.10,0],n:[-0.362,0.932,0],up:[0.932,0.362,0],W:0.66,H:1.30,r:[298.8,0,402.4,792.7]},
  front:{c:[-0.478,0.229,0],n:[-0.955,-0.297,0],up:[0,1,0],W:1.64,H:0.54,r:[0,800.8,1000,329.3]},
  ped:{c:[-0.02289,-0.07831,0],n:[-0.13,-0.99,0],up:[-1,0,0],W:0.58,H:0.886,r:[323.2,1138.2,353.7,540.2]},
  sideL:{c:[-0.22,0.08,0.95],n:[0,-0.62,0.78],up:[-1,0,0],W:0.44,H:0.40,r:[24.4,1243.9,118.1,107.3]},
  sideR:{c:[-0.22,0.08,-0.95],n:[0,-0.62,-0.78],up:[-1,0,0],W:0.44,H:0.40,r:[857.5,1243.9,118.1,107.3]}};
for(const k in VIEWS){ const v=VIEWS[k]; const n=new THREE.Vector3(...v.n).normalize(); let up=new THREE.Vector3(...v.up); up.addScaledVector(n,-up.dot(n)).normalize();
  const x=new THREE.Vector3().crossVectors(up,n.clone().negate());
  v.C=V(...v.c); v.N=V(n.x,n.y,n.z); v.EY=V(up.x,up.y,up.z); v.EX=V(x.x,x.y,x.z); v.FN=v.N.clone().negate(); }
const EYE=V(0.31,0.63,0.53); // captain's eye (model frame)

function viewOf(wx,wy){ for(const k in VIEWS){ const r=VIEWS[k].r; if(wx>=r[0]&&wx<=r[0]+r[2]&&wy>=r[1]&&wy<=r[1]+r[3]) return k; } return null; }
function toP(wx,wy,off){ const k=viewOf(wx,wy); if(!k) return null; const v=VIEWS[k], r=v.r, u=(wx-r[0])/r[2], t=(wy-r[1])/r[3];
  return v.C.clone().addScaledVector(v.EX,(u-0.5)*v.W).addScaledVector(v.EY,(0.5-t)*v.H).addScaledVector(v.FN,off||0); }
function basis(v){ const m=new THREE.Matrix4(); m.makeBasis(v.EX,v.EY,v.FN); return m; }

function init(o){
  const mobile=matchMedia('(pointer:coarse)').matches;
  const scene=new THREE.Scene(), cam=new THREE.PerspectiveCamera(62,1,0.05,20);
  cam.position.copy(EYE);
  const head={yaw:0,pitch:-11*D2R,fov:62,tYaw:0,tPitch:-11*D2R,tFov:62,eye:EYE.clone(),tEye:EYE.clone()};
  const q=new THREE.Quaternion(), e=new THREE.Euler(0,0,0,'YXZ');
  /* ---- panels: one canvas texture each (picture + lit legends) ---- */
  const K=mobile?1.6:3.0; // texture pixels per sheet unit
  const P={};
  for(const k in VIEWS){ const v=VIEWS[k], r=v.r, cv=document.createElement('canvas'); cv.width=Math.round(r[2]*K); cv.height=Math.round(r[3]*K);
    const tex=new THREE.CanvasTexture(cv); tex.anisotropy=Math.min(4,o.R.capabilities.getMaxAnisotropy()); tex.minFilter=THREE.LinearMipmapLinearFilter; if(THREE.sRGBEncoding&&o.R.outputEncoding===THREE.sRGBEncoding) tex.encoding=THREE.sRGBEncoding;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(v.W,v.H),new THREE.MeshBasicMaterial({map:tex,transparent:k.startsWith('side'),alphaTest:k.startsWith('side')?0.5:0}));
    mesh.matrixAutoUpdate=false; mesh.matrix.copy(basis(v)).setPosition(v.C); scene.add(mesh); P[k]={cv,g:cv.getContext('2d'),tex,mesh,v}; }
  /* ---- shell: glareshield coaming, windshield frame, side walls, floor, ceiling (flat colours) ---- */
  const dark=new THREE.MeshBasicMaterial({color:0x2a323b}), mid=new THREE.MeshBasicMaterial({color:0x3d4956}), floorM=new THREE.MeshBasicMaterial({color:0x1d2228});
  const add=(geo,mat,pos,rot)=>{ const m=new THREE.Mesh(geo,mat); m.position.copy(pos); if(rot) m.rotation.set(rot[0],rot[1],rot[2]); scene.add(m); return m; };
  const fv=VIEWS.front, top=fv.C.clone().addScaledVector(fv.EY,fv.H/2); // top edge of the main panel (three frame)
  // coaming: from the panel top edge forward to the windshield
  add(new THREE.BoxGeometry(1.66,0.02,0.40),dark,new THREE.Vector3(0,top.y-0.012,top.z-0.19));
  const wsZ=top.z-0.38, wsY=top.y+0.05, ceilY=1.02;
  // windshield posts (centre and two side posts) and the frame along the top
  const post=(x,lean)=>{ const h=ceilY-wsY; const m=add(new THREE.BoxGeometry(0.045,h,0.04),dark,new THREE.Vector3(x,wsY+h/2,wsZ+0.16)); m.rotation.x=-0.42; return m; };
  post(0); post(0.78); post(-0.78);
  add(new THREE.BoxGeometry(1.75,0.08,0.10),dark,new THREE.Vector3(0,ceilY+0.02,wsZ+0.38));
  // side windows: walls below and above the window line, frame posts behind
  for(const s of [-1,1]){
    add(new THREE.BoxGeometry(0.04,0.95,1.9),mid,new THREE.Vector3(s*1.02,-0.12,0.35));
    add(new THREE.BoxGeometry(0.04,0.30,1.9),mid,new THREE.Vector3(s*1.02,1.00,0.35));
    add(new THREE.BoxGeometry(0.05,0.55,0.07),dark,new THREE.Vector3(s*1.02,0.62,0.20));
    add(new THREE.BoxGeometry(0.05,0.55,0.07),dark,new THREE.Vector3(s*1.02,0.62,1.10));
    add(new THREE.BoxGeometry(0.06,0.06,1.9),dark,new THREE.Vector3(s*1.02,0.35,0.35));
    // outboard panel between the main panel edge and the side wall, below the window line
    add(new THREE.BoxGeometry(0.22,1.05,0.70),mid,new THREE.Vector3(s*0.93,-0.10,top.z+0.05));
    add(new THREE.BoxGeometry(0.22,0.06,0.70),dark,new THREE.Vector3(s*0.93,0.45,top.z+0.05));
    // side console under the side window
    add(new THREE.BoxGeometry(0.30,0.55,1.4),mid,new THREE.Vector3(s*0.88,-0.30,0.75));
  }
  add(new THREE.BoxGeometry(1.70,0.42,0.06),floorM,new THREE.Vector3(0,top.y-fv.H*0.98-0.20,top.z+0.08));
  add(new THREE.BoxGeometry(2.1,0.04,2.4),floorM,new THREE.Vector3(0,-0.62,0.4));
  add(new THREE.BoxGeometry(2.1,0.04,1.7),mid,new THREE.Vector3(0,1.40,0.75));
  // overhead console sides
  for(const s of [-1,1]) add(new THREE.BoxGeometry(0.05,0.32,1.4),dark,new THREE.Vector3(s*0.36,1.18,0.45)).rotation.x=0.37;
  /* ---- screens: canvas textures on the panels ---- */
  const disp=[];
  for(const d of o.displays){ const [x,y,w,h]=d.r, c=toP(x+w/2,y+h/2,0.0015); const k=viewOf(x+w/2,y+h/2); if(!c||!k) continue; const v=VIEWS[k];
    const tex=new THREE.CanvasTexture(d.cv); tex.minFilter=THREE.LinearFilter; tex.generateMipmaps=false;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w/v.r[2]*v.W,h/v.r[3]*v.H),new THREE.MeshBasicMaterial({map:tex}));
    m.matrixAutoUpdate=false; m.matrix.copy(basis(v)).setPosition(c); scene.add(m); m.geometry.computeBoundingSphere(); disp.push({d,tex,m,c}); d.tex=tex; d.mesh=m; }
  /* ---- camera ---- */
  const frus=new THREE.Frustum(), pm=new THREE.Matrix4(), sph=new THREE.Sphere();
  function updCam(dt){
    const k=dt?1-Math.exp(-dt/0.12):1; head.yaw+=(head.tYaw-head.yaw)*k; head.pitch+=(head.tPitch-head.pitch)*k; head.fov+=(head.tFov-head.fov)*k; head.eye.lerp(head.tEye,k); cam.position.copy(head.eye);
    e.set(head.pitch,head.yaw,0,'YXZ'); q.setFromEuler(e); cam.quaternion.copy(q); cam.fov=head.fov; cam.aspect=o.aspect(); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    pm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse); frus.setFromProjectionMatrix(pm); }
  function visible(d){ const x=disp.find(z=>z.d===d); if(!x) return false; sph.center.copy(x.c); sph.radius=0.12; return frus.intersectsSphere(sph); }
  function lookAt(p,fov,lean){ head.tEye.copy(EYE); if(lean!=null) head.tEye.x=lean; const dv=p.clone().sub(head.tEye).normalize(); head.tYaw=Math.atan2(-dv.x,-dv.z); head.tPitch=Math.asin(Math.max(-1,Math.min(1,dv.y))); if(fov) head.tFov=fov; }
  // the overhead and the pedestal: the pilot leans in towards the centre line (as in the aircraft), so the panel is seen square
  const LOOK={main:()=>{ head.tEye.copy(EYE); head.tYaw=-0.04; head.tPitch=-11*D2R; head.tFov=62; },ovhd:()=>lookAt(toP(500,610),62,-0.02),aft:()=>lookAt(toP(500,230),64,-0.02),ped:()=>lookAt(toP(500,1300),58,-0.18),fcu:()=>lookAt(toP(500,845),26),ecam:()=>lookAt(toP(507,1000),32,-0.3),mcdu:()=>lookAt(toP(500,1200),34,-0.25),pfd:()=>lookAt(toP(225,955),36)};
  /* ---- picking: ray from the eye through the pointer to the nearest panel ---- */
  const ray=new THREE.Ray(), hitP=new THREE.Vector3(), pl=new THREE.Plane();
  function pick(nx,ny){ // nx, ny in -1..1
    updCam(0); const dir=new THREE.Vector3(nx,ny,0.5).unproject(cam).sub(cam.position).normalize(); ray.set(cam.position,dir);
    let best=null, bt=1e9;
    for(const k in VIEWS){ const v=VIEWS[k]; pl.setFromNormalAndCoplanarPoint(v.FN,v.C); if(!ray.intersectPlane(pl,hitP)) continue; const t=hitP.distanceTo(cam.position); if(t>=bt) continue;
      const d=hitP.clone().sub(v.C), u=d.dot(v.EX)/v.W+0.5, w=0.5-d.dot(v.EY)/v.H; if(u<0||u>1||w<0||w>1) continue; bt=t; best=[v.r[0]+u*v.r[2],v.r[1]+w*v.r[3]]; }
    return best; }
  /* ---- textures: picture + painter callback ---- */
  let img=null; const pending=new Set(Object.keys(P));
  function setImage(im){ img=im; Object.keys(P).forEach(k=>pending.add(k)); }
  function repaint(painter){ if(!img) return; for(const k in P){ const p=P[k], r=p.v.r, sx=img.naturalWidth/1000; p.g.setTransform(1,0,0,1,0,0); p.g.clearRect(0,0,p.cv.width,p.cv.height); p.g.drawImage(img,r[0]*sx,r[1]*sx,r[2]*sx,r[3]*sx,0,0,p.cv.width,p.cv.height);
      p.g.setTransform(K,0,0,K,-r[0]*K,-r[1]*K); painter(p.g,r); p.tex.needsUpdate=true; } }
  function draw(R){ R.render(scene,cam); }
  return {scene,cam,head,updCam,draw,pick,LOOK,visible,setImage,repaint,K,disp,
    drag(dx,dy){ const s=head.fov/62*0.0042; head.tYaw+=dx*s; head.tPitch=Math.max(-80*D2R,Math.min(85*D2R,head.tPitch+dy*s)); head.yaw=head.tYaw; head.pitch=head.tPitch; },
    zoom(f){ head.tFov=Math.max(18,Math.min(80,head.tFov*f)); },
    qHead(){ return q; }, fov(){ return cam.fov; }};
}
G.A3D={init,VIEWS,toP,viewOf};
})(typeof window!=='undefined'?window:globalThis);
