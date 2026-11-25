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
const CF3=G.SIMAC&&G.SIMAC.d3; // another aircraft (b737.js): its views, eye, shell and looks
const VIEWS=CF3?CF3.VIEWS:{
  ovh:{c:[0.385,1.10,0],n:[-0.362,0.932,0],up:[0.932,0.362,0],W:0.66,H:1.30,r:[298.8,0,402.4,792.7]},
  front:{c:[-0.478,0.229,0],n:[-0.955,-0.297,0],up:[0,1,0],W:1.64,H:0.54,r:[0,800.8,1000,329.3],
    /* the dark render background above the glareshield (traced from the picture): see-through, so no black box shows in the windshield */
    cut:[[[0,800.8],[0,840.5],[5,840.3],[10,840.1],[15,839.9],[20,839.6],[25,839.4],[30,838.4],[35,838.1],[40,837.4],[45,837.1],[50,836.1],[55,835.7],[60,834.4],[65,834.4],[70,834.1],[75,833.4],[80,833.1],[85,831.7],[90,831.4],[95,830.1],[100,830.1],[105,830.1],[110,829.1],[115,828.7],[120,828.4],[125,827.4],[130,827.1],[135,826.4],[140,826.1],[145,825.4],[150,824.7],[155,824.4],[160,823.4],[165,823.1],[170,822.4],[175,822.1],[180,821.1],[185,820.7],[190,819.4],[195,819.4],[200,818.7],[205,818.1],[210,818.1],[215,817.4],[220,816.7],[225,816.4],[230,815.7],[235,814.4],[240,814.1],[245,813.7],[250,812.7],[255,812.7],[260,812.1],[265,811.4],[270,811.1],[275,810.1],[280,809.1],[285,808.7],[290,808.7],[295,808.1],[300,807.4],[305,806.4],[310,806.1],[315,805.7],[320,804.7],[325,804.7],[330,803.7],[335,803.4],[340,802.1],[345,802.1],[350,802.1],[355,801.4],[360,800.7],[365,800.4],[370,800.4],[375,800.4],[380,800.4],[385,800.4],[390,800.4],[395,800.4],[400,800.4],[405,800.4],[410,800.4],[415,800.4],[420,800.4],[425,800.4],[430,800.4],[435,800.4],[440,800.4],[445,800.4],[450,800.4],[455,800.4],[460,800.4],[465,800.4],[470,800.4],[475,800.4],[480,800.4],[485,800.4],[490,800.4],[495,800.4],[500,800.4],[505,800.4],[510,800.4],[515,800.4],[520,800.4],[525,800.4],[530,800.4],[535,800.4],[540,800.4],[545,800.4],[550,800.4],[555,800.4],[560,800.4],[565,800.4],[570,800.4],[575,800.4],[580,800.4],[585,800.4],[590,800.4],[595,800.4],[600,800.4],[605,800.4],[610,800.4],[615,800.4],[620,800.4],[625,800.4],[630,800.4],[635,800.7],[640,801.4],[645,801.7],[650,801.7],[655,802.1],[660,803.7],[665,803.7],[670,805.1],[675,805.4],[680,806.1],[685,806.7],[690,807.1],[695,807.7],[700,808.4],[705,808.4],[710,809.4],[715,810.4],[720,810.7],[725,811.4],[730,811.7],[735,812.7],[740,813.4],[745,813.7],[750,813.7],[755,814.1],[760,815.1],[765,816.1],[770,816.7],[775,817.4],[780,817.7],[785,818.7],[790,819.1],[795,819.7],[800,820.4],[805,820.4],[810,821.7],[815,822.4],[820,822.4],[825,823.4],[830,823.4],[835,824.7],[840,825.4],[845,825.7],[850,825.7],[855,826.1],[860,827.7],[865,828.1],[870,828.7],[875,829.4],[880,830.1],[885,830.4],[890,831.1],[895,831.7],[900,832.1],[905,832.4],[910,833.4],[915,834.1],[920,834.7],[925,835.1],[930,835.4],[935,836.7],[940,837.1],[945,837.4],[950,837.7],[955,838.4],[960,839.7],[965,840.1],[970,840.7],[975,840.9],[980,841.0],[985,841.2],[990,841.3],[995,841.4],[999,841.5],[1000,841.5],[1000,800.8]]]},
  ped:{c:[-0.02289,-0.07831,0],n:[-0.13,-0.99,0],up:[-1,0,0],W:0.58,H:0.886,r:[323.2,1138.2,353.7,540.2]},
  sideL:{c:[-0.22,0.08,0.95],n:[0,-0.62,0.78],up:[-1,0,0],W:0.44,H:0.40,r:[24.4,1243.9,118.1,107.3]},
  sideR:{c:[-0.22,0.08,-0.95],n:[0,-0.62,-0.78],up:[-1,0,0],W:0.44,H:0.40,r:[857.5,1243.9,118.1,107.3]}};
if(!CF3) delete VIEWS.front.cut; /* the panels are the model's own faces now: nothing is drawn where the picture is empty, and cutting the picture's background out made holes in the glareshield's lip (the ground showed through as green slivers) */
for(const k in VIEWS){ const v=VIEWS[k]; const n=new THREE.Vector3(...v.n).normalize(); let up=new THREE.Vector3(...v.up); up.addScaledVector(n,-up.dot(n)).normalize();
  const x=new THREE.Vector3().crossVectors(up,n.clone().negate());
  v.C=V(...v.c); v.N=V(n.x,n.y,n.z); v.EY=V(up.x,up.y,up.z); v.EX=V(x.x,x.y,x.z); v.FN=v.N.clone().negate(); }
const EYE=CF3?V(...CF3.eye):V(0.31,0.63,0.53); // captain's eye (model frame)
const P0=(CF3&&CF3.pitch||-11)*D2R;

/* the panels' surface (models/a320-panels.bin, tools/render-a320/panels.py): the faces of the flight-deck model the pictures were
   rendered from, and for each view a grid of heights of that surface out of the panel plane (for placing screens and levers and
   for clicks). */
const HM={}, HCL={sideL:[-0.04,0.04],sideR:[-0.04,0.04]};
function hAt(k,u,t){ const m=HM[k]; if(!m) return 0; const x=Math.max(0,Math.min(m.nx-1,u*(m.nx-1))), y=Math.max(0,Math.min(m.ny-1,t*(m.ny-1))), x0=Math.floor(x), y0=Math.floor(y), x1=Math.min(m.nx-1,x0+1), y1=Math.min(m.ny-1,y0+1), fx=x-x0, fy=y-y0, a=m.a, n=m.nx;
  return (a[y0*n+x0]*(1-fx)+a[y0*n+x1]*fx)*(1-fy)+(a[y1*n+x0]*(1-fx)+a[y1*n+x1]*fx)*fy; }
function viewOf(wx,wy){ for(const k in VIEWS){ const r=VIEWS[k].r; if(wx>=r[0]&&wx<=r[0]+r[2]&&wy>=r[1]&&wy<=r[1]+r[3]) return k; } return null; }
function toP(wx,wy,off){ const k=viewOf(wx,wy); if(!k) return null; const v=VIEWS[k], r=v.r, u=(wx-r[0])/r[2], t=(wy-r[1])/r[3]; off=(off||0)+hAt(k,u,t);
  return v.C.clone().addScaledVector(v.EX,(u-0.5)*v.W).addScaledVector(v.EY,(0.5-t)*v.H).addScaledVector(v.FN,off||0); }
function basis(v){ const m=new THREE.Matrix4(); m.makeBasis(v.EX,v.EY,v.FN); return m; }

function init(o){
  const o_R=o.R;
  const mobile=(navigator.deviceMemory||8)<3; // only devices with very little memory get the light textures: phones zoom in to read, so they need full detail
  const scene=new THREE.Scene(), cam=new THREE.PerspectiveCamera(62,1,0.05,20);
  cam.position.copy(EYE);
  const head={yaw:CF3&&CF3.yaw||0,pitch:P0,fov:62,tYaw:CF3&&CF3.yaw||0,tPitch:P0,tFov:62,eye:EYE.clone(),tEye:EYE.clone()};
  const q=new THREE.Quaternion(), e=new THREE.Euler(0,0,0,'YXZ');
  /* ---- panels: one canvas texture each (picture + lit legends) ---- */
  const K=mobile?2.2:3.0; // texture pixels per sheet unit
  const P={};
  for(const k in VIEWS){ const v=VIEWS[k], r=v.r, cv=document.createElement('canvas'); cv.width=Math.round(r[2]*K); cv.height=Math.round(r[3]*K);
    const tex=new THREE.CanvasTexture(cv); tex.anisotropy=o.R.capabilities.getMaxAnisotropy(); tex.minFilter=THREE.LinearMipmapLinearFilter; if(THREE.sRGBEncoding&&o.R.outputEncoding===THREE.sRGBEncoding) tex.encoding=THREE.sRGBEncoding;
    const pg=new THREE.PlaneGeometry(v.W,v.H,24,24); pg.setAttribute('color',new THREE.BufferAttribute(new Float32Array(pg.attributes.position.count*3).fill(1),3));
    const cut=k.startsWith('side')||!!v.cut; const mesh=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({map:tex,vertexColors:true,transparent:cut,alphaTest:cut?0.5:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-6}) /* the shell has its own faces where the panels really are: the panel wins */);
    mesh.matrixAutoUpdate=false; mesh.matrix.copy(basis(v)).setPosition(v.C); scene.add(mesh); P[k]={cv,g:cv.getContext('2d'),tex,mesh,v}; }
  /* ---- shell: one closed room around the panels (flat colours, double-sided, no gaps), with the windshield and side
     windows left open. Corners come from the panel planes themselves, so every piece meets its neighbour. ---- */
  const ROOM=new THREE.Group(); scene.add(ROOM);
  const M_=c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide});
  const C_={wall:M_(0x8592a2),wallD:M_(0x5f6b7a),ceil:M_(0x8e9aa8),frame:M_(0x1f252c),floor:M_(0x1a1f25),coam:M_(0x23292f)};
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
  /* ---- backstop: the ceiling and the upper walls once more, a few centimetres outside the real structure. It stays on after
     the FlightGear shell has loaded and fills the gaps that model leaves between its pieces (the shell leaves out what sits on
     the panel planes), so no sky shows through the roof or the corners. The windows stay open. ---- */
  const BACK=new THREE.Group(); scene.add(BACK);
  const wT0=0.90, wZa=-0.70; // top of the side windows, their front edge
  { const bm=new THREE.MeshBasicMaterial({color:0x6d7a8a,side:THREE.DoubleSide}), bp=[], q4=(a,b,c,d)=>bp.push(a,b,c,a,c,d), d=0.14 /* well outside the structure: a backstop that lies in a wall of the model flickers through it */, X2=XW+d, cy=(z)=>ceilAt(0,z)+d;
    const XR=0.80; q4(v3(-XR,cy(zF-0.05),zF-0.05),v3(XR,cy(zF-0.05),zF-0.05),v3(XR,cy(zB),zB),v3(-XR,cy(zB),zB));   // roof (inboard of the side windows)
    q4(v3(-X2,yF,zB+d),v3(X2,yF,zB+d),v3(X2,cy(zB),zB+d),v3(-X2,cy(zB),zB+d));
    for(const sg of [-1,1]){ q4(v3(sg*XR,cy(zF-0.05),zF-0.05),v3(sg*X2,cy(zF-0.05),zF-0.05),v3(sg*X2,cy(zB),zB),v3(sg*XR,cy(zB),zB));      // roof, outboard part
      q4(v3(sg*X2,wT0+0.09,wZa),v3(sg*X2,wT0+0.09,zB),v3(sg*X2,cy(zB),zB),v3(sg*X2,cy(zF-0.05),wZa)); }                              // side walls above the side windows                                      // back wall
    /* a strip just outside the beams over the side and aft windows: the model has a slit between those beams and the ceiling
       lining, and the sky showed through it as a thin bright line */
    for(const sg of [-1,1]){ q4(v3(sg*0.80,0.86,-0.02),v3(sg*1.02,0.86,0.36),v3(sg*1.02,1.04,0.36),v3(sg*0.80,1.04,-0.02)); q4(v3(sg*1.02,0.86,0.36),v3(sg*1.03,0.86,0.97),v3(sg*1.03,1.04,0.97),v3(sg*1.02,1.04,0.36)); }
    const g=new THREE.BufferGeometry(), arr=new Float32Array(bp.length*3); bp.forEach((v,i)=>{ arr[i*3]=v.x; arr[i*3+1]=v.y; arr[i*3+2]=v.z; }); g.setAttribute('position',new THREE.BufferAttribute(arr,3)); BACK.add(new THREE.Mesh(g,bm));
    /* below the windshield sill: a dark tub (wall behind the main panel, side walls, floor) a little outside the structure, so a
       gap between two parts of the model shows dark lining and never the ground outside */
    const tp=[], t4=(a,b,c,d)=>tp.push(a,b,c,a,c,d), TX=XW+0.05, TY=yF-0.04, TZ=gz-0.03;
    t4(v3(-0.82,TY,TZ),v3(0.82,TY,TZ),v3(0.82,gy-0.26,TZ),v3(-0.82,gy-0.26,TZ));                                       // behind the main panel
    for(const sg of [-1,1]){ t4(v3(sg*0.82,TY,TZ),v3(sg*TX,TY,TZ),v3(sg*TX,gy-0.42,TZ),v3(sg*0.82,gy-0.26,TZ));          // outboard of it (the sill drops)
      t4(v3(sg*TX,TY,TZ),v3(sg*TX,TY,zB+0.03),v3(sg*TX,wS-0.12,zB+0.03),v3(sg*TX,gy-0.42,TZ)); }                      // side walls below the side windows
    t4(v3(-TX,TY,TZ),v3(TX,TY,TZ),v3(TX,TY,zB+0.03),v3(-TX,TY,zB+0.03));                                              // under the floor
    const tg=new THREE.BufferGeometry(), ta=new Float32Array(tp.length*3); tp.forEach((v,i)=>{ ta[i*3]=v.x; ta[i*3+1]=v.y; ta[i*3+2]=v.z; }); tg.setAttribute('position',new THREE.BufferAttribute(ta,3)); BACK.add(new THREE.Mesh(tg,new THREE.MeshBasicMaterial({color:0x2f3742,side:THREE.DoubleSide}))); }
  // windshield: centre post, two side posts, the frame along the sill and along the top
  for(const x of [0,-0.80,0.80]) bar(v3(x,gy,gz),v3(x*1.08,yT,zF),x?0.05:0.04,C_.frame);
  for(const sg of [-1,1]) bar(v3(sg*XW*0.98,gy,gz),v3(sg*XW*0.98,yT,zF),0.06,C_.frame);
  bar(v3(-XW,gy+0.01,gz),v3(XW,gy+0.01,gz),0.03,C_.frame); bar(v3(-XW,yT-0.01,zF),v3(XW,yT-0.01,zF),0.05,C_.frame);
  for(const k in quads){ const q=quads[k], g=new THREE.BufferGeometry(), arr=new Float32Array(q.p.length*3); q.p.forEach((v,i)=>{ arr[i*3]=v.x; arr[i*3+1]=v.y; arr[i*3+2]=v.z; }); g.setAttribute('position',new THREE.BufferAttribute(arr,3)); ROOM.add(new THREE.Mesh(g,q.mat)); }
  /* ---- the real flight deck structure (models/a320-shell.bin, built by tools/render-a320/shell.py from the FlightGear
     A320-family model, GPL-2.0): replaces the simple room above once it has loaded. One draw call per texture, Lambert shading
     from a sky light and a sun, compact Int16 / Uint16 / Int8 buffers. ---- */
  fetch(CF3?CF3.shell:'models/a320-shell.bin?v=22').then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(buf=>{
    const dv=new DataView(buf), hl=dv.getUint32(0,true), hdr=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl))), base=4+hl, TL=new THREE.TextureLoader(), grp=new THREE.Group();
    for(const gr of hdr.groups){ let o=base+gr.off; const [sp,su,sn,si]=gr.sizes;
      const P=new Int16Array(buf,o,gr.nv*3); o+=sp; const UV=new Uint16Array(buf,o,gr.nv*2); o+=su; const N=new Int8Array(buf,o,gr.nv*4); o+=sn; const I=gr.i32?new Uint32Array(buf,o,gr.ni):new Uint16Array(buf,o,gr.ni);
      const g=new THREE.BufferGeometry(); const pa=new THREE.BufferAttribute(P,3,true); g.setAttribute('position',pa);
      const uv=new Float32Array(gr.nv*2); for(let i=0;i<gr.nv;i++){ uv[i*2]=gr.uv[0]+UV[i*2]/65535*gr.uv[2]; uv[i*2+1]=gr.uv[1]+UV[i*2+1]/65535*gr.uv[3]; } g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
      g.setAttribute('color',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Uint8Array(buf,N.byteOffset,gr.nv*4),4),3,0,true)); g.setIndex(new THREE.BufferAttribute(I,1));
      const tex=gr.tex==='flat'?null:TL.load((CF3?CF3.shellTex:'models/a320-shell-')+gr.tex+'.jpg?v=5'); if(tex){ tex.anisotropy=Math.min(8,o_R.capabilities.getMaxAnisotropy()); tex.flipY=false; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; if(THREE.sRGBEncoding&&o_R.outputEncoding===THREE.sRGBEncoding) tex.encoding=THREE.sRGBEncoding; }
      const mat=new THREE.MeshBasicMaterial({map:gr.tex==='flat'?null:tex,vertexColors:true,side:THREE.DoubleSide /* the FlightGear surfaces are single-sided and many face outwards: seen from the seat they would vanish and leave holes */}); mat.color.setScalar((hdr.lmax||1)*1.22); const mesh=new THREE.Mesh(g,mat); mesh.scale.setScalar(32767/hdr.S); if(hdr.o) mesh.position.set(...hdr.o); mesh.matrixAutoUpdate=false; mesh.updateMatrix(); mesh.frustumCulled=false; grp.add(mesh); }
    if(hdr.panels) for(const k in hdr.panels){ const pb=hdr.panels[k], p=P[k]; if(!p) continue; const col=p.mesh.geometry.attributes.color, n=24;
      for(let j=0;j<=n;j++) for(let i=0;i<=n;i++){ const x=i/n*pb.nx, y=j/n*pb.ny, x0=Math.min(pb.nx-1,Math.floor(x)), y0=Math.min(pb.ny-1,Math.floor(y)), fx=x-x0, fy=y-y0, at=(a,b)=>pb.v[b*(pb.nx+1)+a];
        const L=(at(x0,y0)*(1-fx)+at(x0+1,y0)*fx)*(1-fy)+(at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx)*fy, c=Math.min(1,0.12+0.9*L); col.setXYZ(j*(n+1)+i,c,c,c*1.01); } col.needsUpdate=true; }
    scene.add(grp);
    ROOM.visible=false; for(const k of ['sideL','sideR']) if(P[k]){ P[k].mesh.visible=false; if(P[k].ov) P[k].ov.visible=false; } if(o.onShell) o.onShell();
  }).catch(e=>console.warn('A320 shell',e));

  /* ---- screens: canvas textures on the panels ---- */
  const disp=[];
  for(const d of o.displays){ const [x,y,w,h]=d.r, c=toP(x+w/2,y+h/2,0.0015); const k=viewOf(x+w/2,y+h/2); if(!c||!k) continue; const v=VIEWS[k];
    const tex=new THREE.CanvasTexture(d.cv); tex.minFilter=THREE.LinearFilter; tex.generateMipmaps=false;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w/v.r[2]*v.W,h/v.r[3]*v.H),new THREE.MeshBasicMaterial({map:tex,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-14}));
    m.matrixAutoUpdate=false; m.matrix.copy(basis(v)).setPosition(c); scene.add(m); m.geometry.computeBoundingSphere(); disp.push({d,tex,m,c,wm:w/v.r[2]*v.W}); d.tex=tex; d.mesh=m; }
  /* ---- the panels' depth: height fields from models/a320-relief.bin (see HM above); the screens move onto their surface ---- */
  const RELIEF=CF3?Promise.resolve(false):fetch('models/a320-panels.bin?v=4').then(r=>r.ok?r.arrayBuffer():Promise.reject(r.status)).then(buf=>{
    const dv=new DataView(buf), hl=dv.getUint32(0,true), hdr=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl))), base=4+hl;
    for(const k in hdr.views){ const p=P[k], hv=hdr.views[k]; if(!p) continue; let o=base+hv.off; const n=hv.nx*hv.ny, raw=new Int16Array(buf.slice(o,o+n*2)), a=new Float32Array(n);
      for(let i=0;i<n;i++) a[i]=raw[i]/hdr.hs;
      HM[k]={nx:hv.nx,ny:hv.ny,a}; HCL[k]=hv.hr; o+=hv.sizes[0];
      /* the drawn surface is the model's own faces (tools/render-a320/panels.py): every face the picture was rendered from, with
         the picture projected back onto it, so edges, corners and joints are real edges. Positions are in the view's frame. */
      const q=new Int16Array(buf.slice(o,o+hv.nv*6)); o+=hv.sizes[1]; const uq=new Uint16Array(buf.slice(o,o+hv.nv*4)); o+=hv.sizes[2]; const idx=new Uint32Array(buf.slice(o,o+hv.ni*4));
      const pos=new Float32Array(hv.nv*3), uvs=new Float32Array(hv.nv*2); for(let i=0;i<pos.length;i++) pos[i]=q[i]/hdr.ps; for(let i=0;i<uvs.length;i++) uvs[i]=uq[i]/65535;
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.BufferAttribute(uvs,2)); g.setIndex(new THREE.BufferAttribute(idx,1));
      g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(hv.nv*3).fill(1),3)); g.computeBoundingSphere(); p.mesh.material.side=THREE.DoubleSide; if(p.ov&&p.ov.material) p.ov.material.side=THREE.DoubleSide;
      const old=p.mesh.geometry; p.mesh.geometry=g; if(p.ov) p.ov.geometry=g; old.dispose(); }
    /* the screens follow the surface: a small grid whose points sit 1.5 mm above the height field (a flat screen on a sloped
       part of the panel, such as the MCDUs on the pedestal, stood out of the surface at one edge and sank into it at the other) */
    for(const x of disp){ const [dx,dy,dw,dh]=x.d.r, cx=dx+dw/2, cy=dy+dh/2, k=viewOf(cx,cy); if(!k||!HM[k]) continue; const v=VIEWS[k], r=v.r, sx=v.W/r[2], sy=v.H/r[3];
      const n=8, g=new THREE.PlaneGeometry(dw*sx,dh*sy,n,n), pa=g.attributes.position.array;
      /* a screen is flat: the plane through the surface under it (least squares over the grid), 1.5 mm in front */
      let S1=0,Sx=0,Sy=0,Sz=0,Sxx=0,Syy=0,Sxy=0,Sxz=0,Syz=0; const zs=[];
      for(let i=0;i<pa.length;i+=3){ const wx=cx+pa[i]*0.86/sx, wy=cy-pa[i+1]*0.86/sy, z=hAt(k,(wx-r[0])/r[2],(wy-r[1])/r[3]); zs.push(z); }
      const med=zs.slice().sort((p,q)=>p-q)[zs.length>>1];
      for(let i=0,j=0;i<pa.length;i+=3,j++){ const z=zs[j]; if(Math.abs(z-med)>0.012) continue; const X=pa[i], Y=pa[i+1]; S1++; Sx+=X; Sy+=Y; Sz+=z; Sxx+=X*X; Syy+=Y*Y; Sxy+=X*Y; Sxz+=X*z; Syz+=Y*z; }
      const mx_=Sx/S1, my_=Sy/S1, mz_=Sz/S1, cxx=Sxx/S1-mx_*mx_, cyy=Syy/S1-my_*my_, cxy=Sxy/S1-mx_*my_, cxz=Sxz/S1-mx_*mz_, cyz=Syz/S1-my_*mz_, det=cxx*cyy-cxy*cxy||1e-9, bx=(cxz*cyy-cyz*cxy)/det, by=(cyz*cxx-cxz*cxy)/det;
      for(let i=0;i<pa.length;i+=3) pa[i+2]=mz_+bx*(pa[i]-mx_)+by*(pa[i+1]-my_)+0.0015;
      g.computeBoundingSphere(); const old=x.m.geometry; x.m.geometry=g; old.dispose();
      const c0=toP(cx,cy,-hAt(k,(cx-r[0])/r[2],(cy-r[1])/r[3])); x.m.matrix.setPosition(c0); x.c=toP(cx,cy,0.0015); }
    return true; }).catch(e=>{ console.warn('A320 panel depth',e); return false; });
  /* ---- camera ---- */
  const frus=new THREE.Frustum(), pm=new THREE.Matrix4(), sph=new THREE.Sphere();
  function updCam(dt){
    const k=dt?1-Math.exp(-dt/0.12):1; head.yaw+=(head.tYaw-head.yaw)*k; head.pitch+=(head.tPitch-head.pitch)*k; head.fov+=(head.tFov-head.fov)*k; head.eye.lerp(head.tEye,k); cam.position.copy(head.eye);
    e.set(head.pitch,head.yaw,0,'YXZ'); q.setFromEuler(e); cam.quaternion.copy(q); cam.fov=head.fov; cam.aspect=o.aspect(); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    pm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse); frus.setFromProjectionMatrix(pm); }
  // how many screen pixels a display covers now (for its canvas size: sharp when zoomed in, cheap when far away)
  function pxSize(d,vh){ const x=disp.find(z=>z.d===d); if(!x) return 256; const dist=Math.max(0.2,x.c.distanceTo(cam.position)); return x.wm/dist/(2*Math.tan(cam.fov*D2R/2))*vh; }
  function visible(d){ const x=disp.find(z=>z.d===d); if(!x) return false; sph.center.copy(x.c); sph.radius=0.12; return frus.intersectsSphere(sph); }
  /* which seat the views are taken from: 1 = left (captain), -1 = right (first officer). The flight deck is symmetric, so the
     right seat's views are the left seat's mirrored: eye, lean and what each view looks at. */
  let SEAT=1; const mir=wx=>SEAT>0?wx:1000-wx;
  function lookAt(p,fov,lean){ head.tEye.copy(EYE); head.tEye.x*=SEAT; if(lean!=null) head.tEye.x=lean*SEAT; const asp=o.aspect(); if(fov&&asp>1.9&&fov<50) fov*=Math.max(0.6,1.9/asp); /* wide phone screens: closer, so the labels are big enough to read */ const dv=p.clone().sub(head.tEye).normalize(); head.tYaw=Math.atan2(-dv.x,-dv.z); head.tPitch=Math.asin(Math.max(-1,Math.min(1,dv.y))); if(fov) head.tFov=fov; }
  // the overhead and the pedestal: the pilot leans in towards the centre line (as in the aircraft), so the panel is seen square
  /* phones (short screens): the main view starts on the captain's PFD and ND, close enough to read; the whole panel is one pinch away */
  const phone=()=>Math.min(G.innerWidth||1e4,G.innerHeight||1e4)<520||(G.matchMedia&&G.matchMedia('(pointer:coarse)').matches&&Math.min(G.screen.width,G.screen.height)<600);
  const mainPh=CF3&&CF3.phoneMain||[300,955,44];
  /* the zoom follows the screen's shape: about 64° across, so the PFD and ND fill the width whichever way the phone is held */
  const phMain=()=>{ lookAt(toP(mir(mainPh[0]),mainPh[1])); const asp=Math.max(0.5,o.aspect()); head.tFov=Math.max(28,Math.min(58,2*Math.atan(Math.tan(32*D2R)/asp)/D2R)); };
  const LOOK=CF3?Object.fromEntries(Object.entries(CF3.look).map(([k,a])=>[k,k==='main'?()=>{ if(phone()){ phMain(); return; } head.tEye.copy(EYE); head.tYaw=CF3.yaw||-0.04; head.tPitch=P0; head.tFov=62; }:()=>lookAt(toP(a[0],a[1]),a[2],a[3])])):{main:()=>{ if(phone()){ phMain(); return; } head.tEye.copy(EYE); head.tEye.x*=SEAT; head.tYaw=-0.04*SEAT; head.tPitch=-11*D2R; head.tFov=62; },all:()=>{ head.tEye.set(0,0.75,0.95); head.tYaw=0; head.tPitch=-0.25; head.tFov=Math.max(62,Math.min(86,80*Math.sqrt(1.5/Math.max(0.8,o.aspect())))); },ovhd:()=>lookAt(toP(500,610),62,-0.02),aft:()=>lookAt(toP(500,230),64,-0.02),ped:()=>lookAt(toP(500,1300),58,0),fcu:()=>lookAt(toP(500,845),26),ecam:()=>lookAt(toP(mir(507),1000),32,-0.3),mcdu:()=>lookAt(toP(500,1196),33,0),pfd:()=>lookAt(toP(mir(225),955),36)};
  /* ---- picking: ray from the eye through the pointer to the nearest panel ---- */
  const ray=new THREE.Ray(), hitP=new THREE.Vector3(), pl=new THREE.Plane(), rc=new THREE.Raycaster();
  function pick(nx,ny){ // nx, ny in -1..1
    updCam(0); const dir=new THREE.Vector3(nx,ny,0.5).unproject(cam).sub(cam.position).normalize(); ray.set(cam.position,dir);
    let best=null, bt=1e9;
    /* panels with depth: march the ray through each height field in the panel's own frame (a few hundred lookups; the
       three.js raycaster against the full surfaces cost several milliseconds on every mouse move) */
    for(const k in HM){ const p=P[k]; if(!p||!p.mesh.visible) continue; const v=p.v, cl=HCL[k]||[-0.05,0.05];
      const o=ray.origin.clone().sub(v.C), oz=o.dot(v.FN), dz=ray.direction.dot(v.FN); if(dz>=-1e-4) continue; // only from the front
      const ox=o.dot(v.EX), oy=o.dot(v.EY), dx=ray.direction.dot(v.EX), dy=ray.direction.dot(v.EY);
      const t0=Math.max(0,(cl[1]+0.002-oz)/dz), t1=(cl[0]-0.002-oz)/dz; if(t1<=t0||t0>=bt) continue;
      const below=t=>{ const u=(ox+dx*t)/v.W+0.5, w=0.5-(oy+dy*t)/v.H; if(u<0||u>1||w<0||w>1) return null; return oz+dz*t<=hAt(k,u,w); };
      let a=t0, hitT=-1; const st=0.003;
      for(let t=t0;t<=t1&&t<bt;t+=st){ const b=below(t); if(b){ hitT=t; break; } if(b===false) a=t; }
      if(hitT<0) continue;
      for(let i=0;i<8;i++){ const m=(a+hitT)/2; if(below(m)) hitT=m; else a=m; }
      const u=(ox+dx*hitT)/v.W+0.5, w=0.5-(oy+dy*hitT)/v.H; bt=hitT; best=[v.r[0]+u*v.r[2],v.r[1]+w*v.r[3]]; }
    for(const k in VIEWS){ if(HM[k]) continue; const v=VIEWS[k]; pl.setFromNormalAndCoplanarPoint(v.FN,v.C); if(!ray.intersectPlane(pl,hitP)) continue; const t=hitP.distanceTo(cam.position); if(t>=bt) continue;
      const d=hitP.clone().sub(v.C), u=d.dot(v.EX)/v.W+0.5, w=0.5-d.dot(v.EY)/v.H; if(u<0||u>1||w<0||w>1) continue; bt=t; best=[v.r[0]+u*v.r[2],v.r[1]+w*v.r[3]]; }
    return best; }
  /* ---- textures: picture + painter callback ---- */
  let img=null; const pending=new Set(Object.keys(P));
  function setImage(im){ const first=!img; img=im; Object.keys(P).forEach(k=>pending.add(k)); if(first) setTimeout(loadHi,600); }
  function repaint(painter,only){ if(!img) return; lastPainter=painter; for(const k in P){ if(only&&k!==only) continue; const p=P[k], r=p.v.r, sx=img.naturalWidth/1000; p.g.setTransform(1,0,0,1,0,0); p.g.clearRect(0,0,p.cv.width,p.cv.height); if(!p.hi) p.g.drawImage(img,r[0]*sx,r[1]*sx,r[2]*sx,r[3]*sx,0,0,p.cv.width,p.cv.height);
      p.g.setTransform(K,0,0,K,-r[0]*K,-r[1]*K); painter(p.g,r);
      if(p.v.cut&&!p.hi){ /* parts of the picture that are background (the dark render behind the glareshield): see-through, so the 3D structure and the world show */
        p.g.save(); p.g.globalCompositeOperation='destination-out'; p.g.beginPath(); for(const poly of p.v.cut){ poly.forEach(([x,y],i)=>i?p.g.lineTo(x,y):p.g.moveTo(x,y)); p.g.closePath(); } p.g.fill(); p.g.restore(); }
      p.tex.needsUpdate=true; } }
  /* ---- sharp panels (desktop): each panel rendered on its own at 4000 px per metre (img/cockpits/<ac>-3d-<panel>.webp) becomes a
     static texture, uploaded once; the lit legends and switch positions move to a transparent layer just in front of it, so a
     switch press repaints only that light layer. Phones and small-memory devices keep the sheet. ---- */
  const HI=CF3?CF3.hi:{base:'img/cockpits/a320-3d-',keys:['ovh','front','ped'],v:5};
  let lastPainter=null;
  function loadHi(){ if(!HI||mobile||(navigator.deviceMemory&&navigator.deviceMemory<4)) return; const maxT=Math.min(o.R.capabilities.maxTextureSize||4096,phone()?4096:8192); /* phones: at most 4096 px a side (memory) */
    let chain=Promise.resolve();
    for(const k of HI.keys){ const p=P[k]; if(!p) continue;
      chain=chain.then(()=>new Promise(res=>{ const im=new Image(); im.decoding='async'; im.onerror=()=>res(); im.src=HI.base+k+'.webp?v='+(HI.v||1);
        im.decode().then(()=>{ let src=im; const sc=Math.min(1,maxT/Math.max(im.naturalWidth,im.naturalHeight));
          if(p.v.cut||sc<1){ const c=document.createElement('canvas'); c.width=Math.round(im.naturalWidth*sc); c.height=Math.round(im.naturalHeight*sc); const g=c.getContext('2d'); g.drawImage(im,0,0,c.width,c.height);
            if(p.v.cut){ const s2=c.width/p.v.r[2]; g.setTransform(s2,0,0,s2,-p.v.r[0]*s2,-p.v.r[1]*s2); g.globalCompositeOperation='destination-out'; g.beginPath(); for(const poly of p.v.cut){ poly.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.closePath(); } g.fill(); }
            src=c; }
          const t=new THREE.Texture(src); t.anisotropy=o.R.capabilities.getMaxAnisotropy(); t.minFilter=THREE.LinearMipmapLinearFilter; if(THREE.sRGBEncoding&&o.R.outputEncoding===THREE.sRGBEncoding) t.encoding=THREE.sRGBEncoding; t.needsUpdate=true;
          // the light layer: same plane, a hair in front, transparent
          const ov=new THREE.Mesh(p.mesh.geometry,new THREE.MeshBasicMaterial({map:p.tex,vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-10}));
          ov.matrixAutoUpdate=false; ov.matrix.copy(p.mesh.matrix); ov.renderOrder=1; ov.visible=p.mesh.visible; scene.add(ov);
          p.mesh.material.map=t; p.mesh.material.needsUpdate=true; p.hi=true; p.ov=ov; if(lastPainter) repaint(lastPainter,k); res(); }).catch(()=>res()); })); } }
  /* where a sheet point sits in 3D: position on the panel, the panel's frame (x right, y up, z out of the panel) and metres per sheet unit */
  function place(wx,wy){ const k=viewOf(wx,wy); if(!k) return null; const v=VIEWS[k]; return {k,p:toP(wx,wy,0),b:basis(v),s:v.W/v.r[2]}; }
  /* real 3D levers (thrust, flaps, speed brake, gear) from the flight-deck model; each turns about its own axis from the model.
     def: {url, g:{name:{p:[x,y,z] pivot, a:[x,y,z] axis}}} in model frame. Returns set(name, degrees, shift metres). */
  function addLevers(def){ const L={}; const ready=fetch(def.url).then(r=>r.arrayBuffer()).then(buf=>{ const dv=new DataView(buf), hl=dv.getUint32(0,true), hdr=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl))), base=4+hl;
      const mat=new THREE.MeshBasicMaterial({vertexColors:true}); /* no lights in the scene: the form is shaded into the colours below (soft light from the windshield and from above), and black parts are a dark grey so their shape reads */
      for(const g of hdr.groups){ const d=def.g[g.name]; if(!d||!g.nv) continue; let o=base+g.off; const P=new Float32Array(buf,o,g.nv*3); o+=g.sizes[0]; const N=new Int8Array(buf,o,g.nv*3); o+=g.sizes[1]; const C=new Uint8Array(buf,o,g.nv*3);
        const pos=new Float32Array(g.nv*3), nor=new Float32Array(g.nv*3), piv=V(...d.p);
        for(let i=0;i<g.nv;i++){ const x=P[i*3],y=P[i*3+1],z=P[i*3+2]; pos[i*3]=-z-piv.x; pos[i*3+1]=y-piv.y; pos[i*3+2]=x-piv.z; nor[i*3]=-N[i*3+2]/127; nor[i*3+1]=N[i*3+1]/127; nor[i*3+2]=N[i*3]/127; }
        const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('normal',new THREE.BufferAttribute(nor,3)); const col=new Float32Array(g.nv*3); for(let i=0;i<g.nv;i++){ const nx=nor[i*3], ny=nor[i*3+1], nz=nor[i*3+2], l=0.50+0.34*Math.max(0,ny)+0.30*Math.max(0,-nz*0.83+ny*0.55)+0.08*Math.abs(nx); for(let k=0;k<3;k++) col[i*3+k]=Math.min(1,(0.17+0.83*C[i*3+k]/255)*(0.35+0.75*l)); } geo.setAttribute('color',new THREE.BufferAttribute(col,3));
        const m=new THREE.Mesh(geo,mat), grp=new THREE.Group(); grp.position.copy(piv); grp.add(m); scene.add(grp);
        const ax=V(...d.a).normalize(), sh=d.s?V(...d.s).normalize():null; L[g.name]={grp,ax,sh,piv,deg:null,mv:null}; } });
    const qq=new THREE.Quaternion();
    return { ready, set(name,deg,mv){ const l=L[name]; if(!l) return; l.grp.visible=!!(P.ped&&P.ped.hi); /* the sheet picture still has the levers drawn in */ if(l.deg===deg&&l.mv===(mv||0)) return; l.deg=deg; l.mv=mv||0; qq.setFromAxisAngle(l.ax,-deg*D2R); l.grp.quaternion.copy(qq); l.grp.position.copy(l.piv); if(l.sh&&mv) l.grp.position.addScaledVector(l.sh,mv); } }; }
  function draw(R){ R.render(scene,cam); }
  const pv3=new THREE.Vector3();
  function proj(wx,wy){ const p=toP(wx,wy,0.002); if(!p) return null; pv3.copy(p).applyMatrix4(cam.matrixWorldInverse); if(pv3.z>-0.02) return null; pv3.applyMatrix4(cam.projectionMatrix); return [pv3.x,pv3.y]; }
  /* look closer at a point (double click / double tap), and back */
  function focus(wx,wy){ const p=toP(wx,wy); if(!p) return; const fov=head.tFov>40?Math.max(22,head.tFov*0.45):null; if(fov){ lookAt(p,null); head.tFov=fov; } else head.tFov=Math.min(66,head.tFov/0.45); }
  return {scene,cam,head,updCam,draw,pick,proj,focus,place,P,addLevers,relief:RELIEF,LOOK,setSeat:s=>{ SEAT=s<0?-1:1; },get seat(){ return SEAT; },visible,pxSize,setImage,repaint,K,disp,mobile,
    drag(dx,dy){ const s=head.fov/62*0.0042; head.tYaw+=dx*s; head.tPitch=Math.max(-80*D2R,Math.min(85*D2R,head.tPitch+dy*s)); head.yaw=head.tYaw; head.pitch=head.tPitch; },
    zoom(f){ head.tFov=Math.max(8,Math.min(80,head.tFov*f)); },
    qHead(){ return q; }, fov(){ return cam.fov; }};
}
G.A3D={init,VIEWS,toP,viewOf};
})(typeof window!=='undefined'?window:globalThis);
