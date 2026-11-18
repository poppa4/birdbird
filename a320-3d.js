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
  const o_R=o.R;
  const mobile=(navigator.deviceMemory||8)<3; // only devices with very little memory get the light textures: phones zoom in to read, so they need full detail
  const scene=new THREE.Scene(), cam=new THREE.PerspectiveCamera(62,1,0.05,20);
  cam.position.copy(EYE);
  const head={yaw:0,pitch:-11*D2R,fov:62,tYaw:0,tPitch:-11*D2R,tFov:62,eye:EYE.clone(),tEye:EYE.clone()};
  const q=new THREE.Quaternion(), e=new THREE.Euler(0,0,0,'YXZ');
  /* ---- panels: one canvas texture each (picture + lit legends) ---- */
  const K=mobile?1.6:3.0; // texture pixels per sheet unit
  const P={};
  for(const k in VIEWS){ const v=VIEWS[k], r=v.r, cv=document.createElement('canvas'); cv.width=Math.round(r[2]*K); cv.height=Math.round(r[3]*K);
    const tex=new THREE.CanvasTexture(cv); tex.anisotropy=Math.min(8,o.R.capabilities.getMaxAnisotropy()); tex.minFilter=THREE.LinearMipmapLinearFilter; if(THREE.sRGBEncoding&&o.R.outputEncoding===THREE.sRGBEncoding) tex.encoding=THREE.sRGBEncoding;
    const pg=new THREE.PlaneGeometry(v.W,v.H,24,24); pg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(pg.attributes.position.count*3).fill(1),3));
    const mesh=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({map:tex,vertexColors:true,transparent:k.startsWith('side'),alphaTest:k.startsWith('side')?0.5:0}));
    mesh.matrixAutoUpdate=false; mesh.matrix.copy(basis(v)).setPosition(v.C); scene.add(mesh); P[k]={cv,g:cv.getContext('2d'),tex,mesh,v}; }
  /* ---- shell: one closed room around the panels (flat colours, double-sided, no gaps), with the windshield and side
     windows left open. Corners come from the panel planes themselves, so every piece meets its neighbour. ---- */
  const ROOM=new THREE.Group(); scene.add(ROOM);
  const M_=c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide});
  const C_={wall:M_(0x3e4a57),wallD:M_(0x2f3842),ceil:M_(0x46525f),frame:M_(0x1f252c),floor:M_(0x1a1f25),coam:M_(0x23292f)};
  const PTS=[], quads={};
  function quad(a,b,c,d,mat){ const k=mat.uuid; (quads[k]=quads[k]||{mat,p:[]}).p.push(a,b,c,a,c,d); }
  function bar(p0,p1,w,mat){ const ax=p1.clone().sub(p0), len=ax.length(); ax.normalize(); let side=new THREE.Vector3().crossVectors(ax,new THREE.Vector3(0,0,1)); if(side.lengthSq()<1e-4) side.set(1,0,0); side.normalize().multiplyScalar(w/2); const nrm=new THREE.Vector3().crossVectors(side,ax).normalize().multiplyScalar(w/2);
    const c=[p0.clone().add(side).add(nrm),p0.clone().sub(side).add(nrm),p0.clone().sub(side).sub(nrm),p0.clone().add(side).sub(nrm)], d=c.map(x=>x.clone().addScaledVector(ax,len));
    for(let i=0;i<4;i++){ const j=(i+1)%4; quad(c[i],c[j],d[j],d[i],mat); } }
  const v3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const ov=VIEWS.ovh, fv=VIEWS.front, pv=VIEWS.ped;
  const XW=1.04;                                        // side walls
  const yF=-0.62, zB=1.75;                              // floor, back wall
  const top=fv.C.clone().addScaledVector(fv.EY,fv.H/2); // top edge of the main panel (y .49, z -.56)
  const gz=top.z-0.40, gy=top.y+0.005;                  // windshield sill (front edge of the coaming)
  const cF=ov.C.clone().addScaledVector(ov.EY,-ov.H/2), cA=ov.C.clone().addScaledVector(ov.EY,ov.H/2); // overhead fwd / aft edge on the centre line
  const ceilAt=(x,z)=>{ const t=(z-cF.z)/(cA.z-cF.z); return cF.y+t*(cA.y-cF.y)+0.006; }; // ceiling: the overhead plane, a little above it
  const zF=cF.z-0.02, yT=ceilAt(0,zF);                  // windshield top line
  // ceiling: the overhead plane extended to the side walls and to the back wall
  quad(v3(-XW,ceilAt(0,zF),zF),v3(XW,ceilAt(0,zF),zF),v3(XW,ceilAt(0,zB),zB),v3(-XW,ceilAt(0,zB),zB),C_.ceil);
  // coaming (top of the glareshield) from the panel top edge forward to the windshield sill
  quad(v3(-XW,gy,gz),v3(XW,gy,gz),v3(XW,top.y,top.z),v3(-XW,top.y,top.z),C_.coam);
  // below the main panel (knee area) and beside it (outboard of the PFDs) down to the floor
  const bot=fv.C.clone().addScaledVector(fv.EY,-fv.H/2);
  quad(v3(-0.82,bot.y,bot.z),v3(0.82,bot.y,bot.z),v3(0.82,yF,bot.z+0.05),v3(-0.82,yF,bot.z+0.05),C_.wallD);
  for(const sg of [-1,1]){ quad(v3(sg*0.82,top.y,top.z),v3(sg*XW,top.y,top.z),v3(sg*XW,yF,bot.z+0.05),v3(sg*0.82,yF,bot.z+0.05),C_.wall); }
  // pedestal sides
  const pT=pv.C.clone().addScaledVector(pv.EY,pv.H/2), pB=pv.C.clone().addScaledVector(pv.EY,-pv.H/2);
  for(const sg of [-1,1]) quad(v3(sg*0.29,pT.y,pT.z),v3(sg*0.29,pB.y,pB.z),v3(sg*0.29,yF,pB.z),v3(sg*0.29,yF,pT.z),C_.wallD);
  quad(v3(-0.29,pB.y,pB.z),v3(0.29,pB.y,pB.z),v3(0.29,yF,pB.z),v3(-0.29,yF,pB.z),C_.wallD);
  // floor and back wall
  quad(v3(-XW,yF,bot.z),v3(XW,yF,bot.z),v3(XW,yF,zB),v3(-XW,yF,zB),C_.floor);
  quad(v3(-XW,yF,zB),v3(XW,yF,zB),v3(XW,ceilAt(0,zB),zB),v3(-XW,ceilAt(0,zB),zB),C_.wallD);
  // side walls with the side window (sill .52, top .90, from z -.70 to .62)
  const wS=0.52, wT=0.90, wZ0=-0.70, wZ1=0.62;
  for(const sg of [-1,1]){ const x=sg*XW;
    quad(v3(x,yF,gz),v3(x,yF,zB),v3(x,wS,zB),v3(x,wS,gz),C_.wall);                 // below the sill
    quad(v3(x,wT,wZ0),v3(x,wT,zB),v3(x,ceilAt(0,zB),zB),v3(x,ceilAt(0,wZ0),wZ0),C_.wall); // above the window
    quad(v3(x,wS,wZ1),v3(x,wS,zB),v3(x,wT,zB),v3(x,wT,wZ1),C_.wall);               // aft of the window
    quad(v3(x,wS,gz),v3(x,wS,wZ0),v3(x,ceilAt(0,wZ0),wZ0),v3(x,yT,zF),C_.wall);      // the corner piece between windshield and side window (approx.)
    // side console (top surface beside the seat)
    const sv=VIEWS[sg<0?'sideL':'sideR']; quad(v3(sg*0.80,0.02,-0.55),v3(x,0.10,-0.55),v3(x,0.10,1.1),v3(sg*0.80,0.02,1.1),C_.wallD);
    quad(v3(sg*0.80,0.02,-0.55),v3(sg*0.80,0.02,1.1),v3(sg*0.80,yF,1.1),v3(sg*0.80,yF,-0.55),C_.wall);
    // window frames
    bar(v3(x-sg*0.01,wS,wZ0),v3(x-sg*0.01,wT,wZ0),0.05,C_.frame); bar(v3(x-sg*0.01,wS,wZ1),v3(x-sg*0.01,wT,wZ1),0.05,C_.frame);
    bar(v3(x-sg*0.01,wS,wZ0),v3(x-sg*0.01,wS,wZ1),0.045,C_.frame); bar(v3(x-sg*0.01,wT,wZ0),v3(x-sg*0.01,wT,wZ1),0.045,C_.frame);
    bar(v3(x-sg*0.01,wS,(wZ0+wZ1)/2),v3(x-sg*0.01,wT,(wZ0+wZ1)/2),0.035,C_.frame);
  }
  // windshield: centre post, two side posts, the frame along the sill and along the top
  for(const x of [0,-0.80,0.80]) bar(v3(x,gy,gz),v3(x*1.08,yT,zF),x?0.05:0.04,C_.frame);
  for(const sg of [-1,1]) bar(v3(sg*XW*0.98,gy,gz),v3(sg*XW*0.98,yT,zF),0.06,C_.frame);
  bar(v3(-XW,gy+0.01,gz),v3(XW,gy+0.01,gz),0.03,C_.frame); bar(v3(-XW,yT-0.01,zF),v3(XW,yT-0.01,zF),0.05,C_.frame);
  for(const k in quads){ const q=quads[k], g=new THREE.BufferGeometry(), arr=new Float32Array(q.p.length*3); q.p.forEach((v,i)=>{ arr[i*3]=v.x; arr[i*3+1]=v.y; arr[i*3+2]=v.z; }); g.setAttribute('position',new THREE.BufferAttribute(arr,3)); ROOM.add(new THREE.Mesh(g,q.mat)); }
  /* ---- the real flight deck structure (models/a320-shell.bin, built by tools/render-a320/shell.py from the FlightGear
     A320-family model, GPL-2.0): replaces the simple room above once it has loaded. One draw call per texture, Lambert shading
     from a sky light and a sun, compact Int16 / Uint16 / Int8 buffers. ---- */
  fetch('models/a320-shell.bin').then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(buf=>{
    const dv=new DataView(buf), hl=dv.getUint32(0,true), hdr=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl))), base=4+hl, TL=new THREE.TextureLoader(), grp=new THREE.Group();
    for(const gr of hdr.groups){ let o=base+gr.off; const [sp,su,sn,si]=gr.sizes;
      const P=new Int16Array(buf,o,gr.nv*3); o+=sp; const UV=new Uint16Array(buf,o,gr.nv*2); o+=su; const N=new Int8Array(buf,o,gr.nv*4); o+=sn; const I=gr.i32?new Uint32Array(buf,o,gr.ni):new Uint16Array(buf,o,gr.ni);
      const g=new THREE.BufferGeometry(); const pa=new THREE.BufferAttribute(P,3,true); g.setAttribute('position',pa);
      const uv=new Float32Array(gr.nv*2); for(let i=0;i<gr.nv;i++){ uv[i*2]=gr.uv[0]+UV[i*2]/65535*gr.uv[2]; uv[i*2+1]=gr.uv[1]+UV[i*2+1]/65535*gr.uv[3]; } g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      g.setAttribute('color',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Uint8Array(buf,N.byteOffset,gr.nv*4),4),3,0,true)); g.setIndex(new THREE.BufferAttribute(I,1));
      const tex=TL.load('models/a320-shell-'+gr.tex+'.jpg'); tex.anisotropy=1; tex.flipY=false; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; if(THREE.sRGBEncoding&&o_R.outputEncoding===THREE.sRGBEncoding) tex.encoding=THREE.sRGBEncoding;
      const mat=new THREE.MeshBasicMaterial({map:tex,vertexColors:true,side:THREE.FrontSide}); mat.color.setScalar((hdr.lmax||1)*1.22); const mesh=new THREE.Mesh(g,mat); mesh.scale.setScalar(32767/hdr.S); mesh.matrixAutoUpdate=false; mesh.updateMatrix(); mesh.frustumCulled=false; grp.add(mesh); }
    if(hdr.panels) for(const k in hdr.panels){ const pb=hdr.panels[k], p=P[k]; if(!p) continue; const col=p.mesh.geometry.attributes.color, n=24;
      for(let j=0;j<=n;j++) for(let i=0;i<=n;i++){ const x=i/n*pb.nx, y=j/n*pb.ny, x0=Math.min(pb.nx-1,Math.floor(x)), y0=Math.min(pb.ny-1,Math.floor(y)), fx=x-x0, fy=y-y0, at=(a,b)=>pb.v[b*(pb.nx+1)+a];
        const L=(at(x0,y0)*(1-fx)+at(x0+1,y0)*fx)*(1-fy)+(at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx)*fy, c=Math.min(1,0.12+0.9*L); col.setXYZ(j*(n+1)+i,c,c,c*1.01); } col.needsUpdate=true; }
    scene.add(grp); ROOM.visible=false; for(const k of ['sideL','sideR']) if(P[k]) P[k].mesh.visible=false; if(o.onShell) o.onShell();
  }).catch(e=>console.warn('A320 shell',e));

  /* ---- screens: canvas textures on the panels ---- */
  const disp=[];
  for(const d of o.displays){ const [x,y,w,h]=d.r, c=toP(x+w/2,y+h/2,0.0015); const k=viewOf(x+w/2,y+h/2); if(!c||!k) continue; const v=VIEWS[k];
    const tex=new THREE.CanvasTexture(d.cv); tex.minFilter=THREE.LinearFilter; tex.generateMipmaps=false;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w/v.r[2]*v.W,h/v.r[3]*v.H),new THREE.MeshBasicMaterial({map:tex}));
    m.matrixAutoUpdate=false; m.matrix.copy(basis(v)).setPosition(c); scene.add(m); m.geometry.computeBoundingSphere(); disp.push({d,tex,m,c,wm:w/v.r[2]*v.W}); d.tex=tex; d.mesh=m; }
  /* ---- camera ---- */
  const frus=new THREE.Frustum(), pm=new THREE.Matrix4(), sph=new THREE.Sphere();
  function updCam(dt){
    const k=dt?1-Math.exp(-dt/0.12):1; head.yaw+=(head.tYaw-head.yaw)*k; head.pitch+=(head.tPitch-head.pitch)*k; head.fov+=(head.tFov-head.fov)*k; head.eye.lerp(head.tEye,k); cam.position.copy(head.eye);
    e.set(head.pitch,head.yaw,0,'YXZ'); q.setFromEuler(e); cam.quaternion.copy(q); cam.fov=head.fov; cam.aspect=o.aspect(); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    pm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse); frus.setFromProjectionMatrix(pm); }
  // how many screen pixels a display covers now (for its canvas size: sharp when zoomed in, cheap when far away)
  function pxSize(d,vh){ const x=disp.find(z=>z.d===d); if(!x) return 256; const dist=Math.max(0.2,x.c.distanceTo(cam.position)); return x.wm/dist/(2*Math.tan(cam.fov*D2R/2))*vh; }
  function visible(d){ const x=disp.find(z=>z.d===d); if(!x) return false; sph.center.copy(x.c); sph.radius=0.12; return frus.intersectsSphere(sph); }
  function lookAt(p,fov,lean){ head.tEye.copy(EYE); if(lean!=null) head.tEye.x=lean; const asp=o.aspect(); if(fov&&asp>1.9&&fov<50) fov*=Math.max(0.6,1.9/asp); /* wide phone screens: closer, so the labels are big enough to read */ const dv=p.clone().sub(head.tEye).normalize(); head.tYaw=Math.atan2(-dv.x,-dv.z); head.tPitch=Math.asin(Math.max(-1,Math.min(1,dv.y))); if(fov) head.tFov=fov; }
  // the overhead and the pedestal: the pilot leans in towards the centre line (as in the aircraft), so the panel is seen square
  const LOOK={main:()=>{ head.tEye.copy(EYE); head.tYaw=-0.04; head.tPitch=-11*D2R; head.tFov=62; },ovhd:()=>lookAt(toP(500,610),62,-0.02),aft:()=>lookAt(toP(500,230),64,-0.02),ped:()=>lookAt(toP(500,1300),58,-0.18),fcu:()=>lookAt(toP(500,845),26),ecam:()=>lookAt(toP(507,1000),32,-0.3),mcdu:()=>lookAt(toP(500,1196),33,-0.16),pfd:()=>lookAt(toP(225,955),36)};
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
  return {scene,cam,head,updCam,draw,pick,LOOK,visible,pxSize,setImage,repaint,K,disp,mobile,
    drag(dx,dy){ const s=head.fov/62*0.0042; head.tYaw+=dx*s; head.tPitch=Math.max(-80*D2R,Math.min(85*D2R,head.tPitch+dy*s)); head.yaw=head.tYaw; head.pitch=head.tPitch; },
    zoom(f){ head.tFov=Math.max(8,Math.min(80,head.tFov*f)); },
    qHead(){ return q; }, fov(){ return cam.fov; }};
}
G.A3D={init,VIEWS,toP,viewOf};
})(typeof window!=='undefined'?window:globalThis);
