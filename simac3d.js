/* Birdbird Route Explorer: the aircraft in the 3D simulation (simac3d.js)
   Loaded on demand by route.html (after three.min.js, r128). Procedural, low-poly but smooth-shaded models of the three
   lab aircraft (Diamond DA42 NG, Beechcraft King Air B200, Airbus A320) at their published size, drawn into the MapLibre
   map as a custom 3D layer that shares the terrain's depth buffer. Model frame: metres, x = right wing, y = nose, z = up,
   origin at the wing root. Nothing is fetched: geometry and colours are made here. */
(function(){
'use strict';
const D2R=Math.PI/180;
/* published dimensions (m): length, span, fuselage radius, wing (root/tip chord, LE sweep, dihedral, z), tail, engines */
const TYPES={
  da42:{name:'Diamond DA42',len:8.56,span:13.55,fr:0.62,nose:2.75,wrc:1.55,wtc:0.92,wsw:2,wdi:5,wz:-0.32,wy:0.55,
    fin:{h:1.55,rc:1.35,tc:0.85,sw:28,y:-4.55},ht:{s:2.2,rc:0.85,tc:0.6,sw:8,t:true},
    nac:[{x:2.3,L:2.7,r:0.33,dy:1.45,dz:-0.05,prop:{d:1.9,n:3}}],canopy:true,col:{body:0xF3F4F2,trim:0x9A1E68}},
  b200:{name:'King Air B200',len:13.34,span:16.61,fr:0.82,nose:4.6,wrc:2.15,wtc:1.05,wsw:3,wdi:6,wz:-0.5,wy:0.9,
    fin:{h:2.35,rc:2.2,tc:1.15,sw:38,y:-6.6},ht:{s:2.8,rc:1.25,tc:0.8,sw:12,t:true},
    nac:[{x:2.65,L:4.3,r:0.45,dy:2.35,dz:0.0,prop:{d:2.5,n:4}}],col:{body:0xF4F5F6,trim:0x1F3B66}},
  a320:{name:'Airbus A320',len:37.57,span:35.8,fr:1.98,nose:15.6,wrc:6.2,wtc:1.55,wsw:27,wdi:5.5,wz:-1.25,wy:2.0,
    fin:{h:5.9,rc:5.6,tc:2.0,sw:36,y:-14.6},ht:{s:6.2,rc:3.6,tc:1.25,sw:31,t:false,y:-16.4,z:0.55},
    nac:[{x:5.75,L:4.4,r:1.05,dy:2.6,dz:-1.75,fan:true}],sharklet:2.4,col:{body:0xF5F6F7,trim:0x1F3B66}}
};
// symmetric 12 % section (NACA 00xx thickness), closed ring of [chord 0..1, thickness ±] from the trailing edge round the nose
function ring(th){ const n=9, top=[], bot=[]; for(let i=0;i<=n;i++){ const x=(1-Math.cos(Math.PI*i/n))/2, t=5*th*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1036*x*x*x*x); top.push([x,t]); bot.push([x,-t]); }
  return top.reverse().concat(bot.slice(1,-1)); }
// loft closed rings (arrays of THREE.Vector3, same length) into a smooth surface with end caps
function loft(THREE,secs){ const M=secs[0].length, pos=[], idx=[]; secs.forEach(s=>s.forEach(v=>pos.push(v.x,v.y,v.z)));
  for(let i=0;i<secs.length-1;i++) for(let j=0;j<M;j++){ const a=i*M+j, b=i*M+(j+1)%M, c=a+M, d=b+M; idx.push(a,c,b,b,c,d); }
  [0,secs.length-1].forEach(k=>{ const s=secs[k], c=s.reduce((o,v)=>o.add(v),new THREE.Vector3()).multiplyScalar(1/M), ci=pos.length/3; pos.push(c.x,c.y,c.z); for(let j=0;j<M;j++) idx.push(ci,k*M+j,k*M+(j+1)%M); });
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
/* lifting surface: o = {x0 spanwise start, s span (one side), rc, tc, sw LE sweep°, di dihedral°, y LE at root, z, th, vert} */
function surf(THREE,o,sg){ const R=ring(o.th||0.12), secs=[]; for(let k=0;k<=4;k++){ const f=k/4, c=o.rc+(o.tc-o.rc)*f, p=o.x0+o.s*f, le=o.y-Math.tan((o.sw||0)*D2R)*o.s*f, zz=(o.z||0)+Math.tan((o.di||0)*D2R)*o.s*f;
    secs.push(R.map(([u,t])=>o.vert? new THREE.Vector3(t*c,le-u*c,(o.z||0)+p) : new THREE.Vector3(sg*p,le-u*c,zz+t*c))); }
  return loft(THREE,secs); }
// body of revolution along y (profile: [radius, y]), squashed in width/height
function lathe(THREE,prof,sx,sz,seg){ const g=new THREE.LatheGeometry(prof.map(([r,y])=>new THREE.Vector2(Math.max(1e-4,r),y)),seg||28); g.scale(sx||1,1,sz||1); g.computeVertexNormals(); return g; }
function build(THREE,type){ const A=TYPES[type]||TYPES.da42, root=new THREE.Group(), props=[], lights=[];
  const mt=(c,o)=>new THREE.MeshPhongMaterial(Object.assign({color:c,shininess:60,specular:0x404040,side:THREE.DoubleSide},o||{}));
  const body=mt(A.col.body), trim=mt(A.col.trim,{shininess:30}), dark=mt(0x18232E,{shininess:120,specular:0x8899aa}), metal=mt(0x9AA3AB,{shininess:90}), blk=mt(0x202326,{shininess:20});
  const add=(g,m)=>{ const o=new THREE.Mesh(g,m); o.frustumCulled=false; root.add(o); return o; };
  // fuselage: rounded nose, cylindrical cabin, tapered and upswept tail cone
  const L=A.len, r=A.fr, yN=A.nose, yT=yN-L, prof=[]; for(let i=0;i<=40;i++){ const y=yT+L*i/40, u=(y-yT)/L; let rr;
    if(u>0.86){ const q=(u-0.86)/0.14; rr=r*Math.sqrt(Math.max(0,1-q*q*q)); } else if(u>0.5) rr=r; else { const q=(0.5-u)/0.5; rr=r*(1-0.82*Math.pow(q,1.5)); }
    prof.push([rr,y]); }
  const fg=lathe(THREE,prof.reverse(),1,type==='a320'?1:0.92,36); { const p=fg.attributes.position; for(let i=0;i<p.count;i++){ const y=p.getY(i), u=(y-yT)/L; if(u<0.45) p.setZ(i,p.getZ(i)+(0.45-u)*L*(type==='a320'?0.12:0.1)*(type==='a320'?1:1.2)); } fg.computeVertexNormals(); }
  add(fg,body);
  // cockpit glazing / canopy
  if(A.canopy){ const c=new THREE.SphereGeometry(1,24,14); c.scale(r*0.78,1.55,r*0.62); add(c,dark).position.set(0,yN-2.1,r*0.42); }
  else { const c=new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI*0.5); c.scale(r*0.82,r*1.1,r*0.42); const w=add(c,dark); w.position.set(0,yN-r*1.25,r*0.32); w.rotation.x=-0.35; }
  // cheat line along the cabin
  { const s=new THREE.CylinderGeometry(r*1.006,r*1.006,L*0.62,30,1,true,Math.PI*0.45,Math.PI*0.1); const m=add(s,trim); m.position.set(0,yN-L*0.45,0); const m2=m.clone(); m2.rotation.y=Math.PI; m2.position.copy(m.position); root.add(m2); m2.frustumCulled=false; }
  // wings
  const half=A.span/2, ws={x0:r*0.6,s:half-r*0.6,rc:A.wrc,tc:A.wtc,sw:A.wsw,di:A.wdi,y:A.wy,z:A.wz,th:type==='a320'?0.11:0.14};
  [-1,1].forEach(sg=>add(surf(THREE,ws,sg),body));
  { const c=new THREE.BoxGeometry(r*1.4,A.wrc,A.wrc*0.15); add(c,body).position.set(0,A.wy-A.wrc/2,A.wz); }
  if(A.sharklet) [-1,1].forEach(sg=>{ const tipY=A.wy-Math.tan(A.wsw*D2R)*ws.s, tipZ=A.wz+Math.tan(A.wdi*D2R)*ws.s; add(surf(THREE,{x0:0,s:A.sharklet,rc:A.wtc*0.95,tc:0.45,sw:40,y:tipY,z:tipZ,vert:true,th:0.1}),trim).position.x=sg*half; });
  // fin and stabiliser (T-tail on the twins)
  const F=A.fin, fz=r*0.55; add(surf(THREE,{x0:0,s:F.h,rc:F.rc,tc:F.tc,sw:F.sw,y:F.y+F.rc*0.25,z:fz,vert:true,th:0.12}),type==='a320'?trim:body);
  const H=A.ht, hy=H.t? F.y+F.rc*0.25-Math.tan(F.sw*D2R)*F.h+0.1 : H.y, hz=H.t? fz+F.h-0.05 : (H.z||0);
  [-1,1].forEach(sg=>add(surf(THREE,{x0:H.t?0:r*0.35,s:H.s,rc:H.rc,tc:H.tc,sw:H.sw,di:H.t?0:6,y:hy,z:hz,th:0.1},sg),body));
  // engines: turboprop nacelles with spinning propellers, or high-bypass fans under the wing
  (A.nac||[]).forEach(n=>[-1,1].forEach(sg=>{ const yLE=A.wy-Math.tan(A.wsw*D2R)*(n.x-r*0.6), zW=A.wz+Math.tan(A.wdi*D2R)*(n.x-r*0.6), y0=yLE+n.dy, z0=zW+n.dz;
    if(n.fan){ const pr=[]; for(let i=0;i<=20;i++){ const u=i/20; pr.push([n.r*(u<0.12?0.92+0.08*Math.sin(u/0.12*Math.PI/2):1-0.38*Math.pow((u-0.12)/0.88,1.6)),y0-u*n.L]); }
      const g=add(lathe(THREE,pr,1,1,30),metal); g.position.x=sg*n.x; g.position.z=z0;
      const inl=new THREE.CircleGeometry(n.r*0.9,30); const f=add(inl,blk); f.rotation.x=-Math.PI/2; f.position.set(sg*n.x,y0-0.05,z0);
      const py=new THREE.BoxGeometry(0.35,n.L*0.9,Math.abs(n.dz)); add(py,body).position.set(sg*n.x,y0-n.L*0.6,z0+Math.abs(n.dz)/2); return; }
    const pr=[]; for(let i=0;i<=20;i++){ const u=i/20; pr.push([n.r*(u<0.15?0.75+0.25*Math.sin(u/0.15*Math.PI/2):1-0.7*Math.pow((u-0.15)/0.85,2)),y0-u*n.L]); }
    const g=add(lathe(THREE,pr,1,1.05,24),body); g.position.set(sg*n.x,0,z0);
    const sp=add(lathe(THREE,[[0.001,y0+n.r*1.0],[n.r*0.5,y0+n.r*0.6],[n.r*0.72,y0+0.05],[n.r*0.72,y0]],1,1,20),metal); sp.position.x=sg*n.x; sp.position.z=z0;
    const P=new THREE.Group(); P.position.set(sg*n.x,y0+0.08,z0); root.add(P);
    const bl=new THREE.Group(); P.add(bl); for(let b=0;b<n.prop.n;b++){ const bg=new THREE.BoxGeometry(0.16,0.04,n.prop.d/2); bg.translate(0,0,n.prop.d/4); const m=new THREE.Mesh(bg,blk); m.rotation.z=0.35; m.frustumCulled=false; const tw=new THREE.Group(); tw.rotation.y=b*2*Math.PI/n.prop.n; tw.add(m); bl.add(tw); }
    const disc=new THREE.Mesh(new THREE.CircleGeometry(n.prop.d/2,40),new THREE.MeshBasicMaterial({color:0x2A2E33,transparent:true,opacity:0.16,side:THREE.DoubleSide,depthWrite:false})); disc.rotation.x=Math.PI/2; disc.frustumCulled=false; P.add(disc);
    props.push({g:bl,dir:sg}); }));
  // navigation lights (red left, green right) and a white strobe on each tip
  const tipY=A.wy-Math.tan(A.wsw*D2R)*ws.s-A.wtc*0.3, tipZ=A.wz+Math.tan(A.wdi*D2R)*ws.s;
  [[-1,0xFF2A2A],[1,0x2AFF6A]].forEach(([sg,c])=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.07,A.span*0.006),8,6),new THREE.MeshBasicMaterial({color:c})); m.position.set(sg*(half+0.02),tipY,tipZ); m.frustumCulled=false; root.add(m);
    const s=new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.09,A.span*0.008),8,6),new THREE.MeshBasicMaterial({color:0xFFFFFF})); s.position.set(sg*(half+0.02),tipY-A.wtc*0.5,tipZ); s.visible=false; s.frustumCulled=false; root.add(s); lights.push(s); });
  return {root,props,lights,A}; }

/* MapLibre custom layer. set({la,lo,ft,hd,bank,pitch,type,sun:{az,el},spin,on}) — ft = altitude (feet, unexaggerated);
   the terrain exaggeration is read from the map, so the aircraft sits on the drawn flight path. */
function layer(){ const THREE=window.THREE;
  const L={id:'bb-ac3d',type:'custom',renderingMode:'3d',s:null,model:null,type0:null,ang:0,P:new Float64Array(16),
    onAdd(map,gl){ this.map=map; this.scene=new THREE.Scene(); this.cam=new THREE.Camera(); this.frame=new THREE.Group(); this.frame.scale.set(1,-1,1); this.scene.add(this.frame);
      this.ac=new THREE.Group(); this.ac.rotation.order='ZXY'; this.frame.add(this.ac);
      this.sun=new THREE.DirectionalLight(0xFFF4E2,1.0); this.scene.add(this.sun); this.hemi=new THREE.HemisphereLight(0xE4EEF8,0x7A7060,0.95); this.hemi.position.set(0,0,1); this.scene.add(this.hemi); this.scene.add(new THREE.AmbientLight(0xFFFFFF,0.22));
      this.r=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true}); this.r.autoClear=false; },
    onRemove(){ try{ this.scene.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); this.r.dispose(); }catch(e){} },
    set(s){ this.s=s; if(s&&s.type&&s.type!==this.type0){ if(this.model){ this.ac.remove(this.model.root); this.model.root.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); } this.model=build(THREE,s.type); this.ac.add(this.model.root); this.type0=s.type; }
      if(this.map) this.map.triggerRepaint(); },
    render(gl,args){ const s=this.s, map=this.map; if(!s||!s.on||!this.model) return;
      const tr=map.getTerrain&&map.getTerrain(), ex=tr?(tr.exaggeration||1):1, M0=args&&args.modelViewProjectionMatrix?args.modelViewProjectionMatrix:args; if(!M0) return;
      const mc=maplibregl.MercatorCoordinate.fromLngLat([s.lo,s.la],0), ws=map.transform.worldSize, ppm=ws*mc.meterInMercatorCoordinateUnits(), tx=mc.x*ws, ty=mc.y*ws, tz=s.ft*0.3048*ex, P=this.P;
      for(let r=0;r<4;r++){ P[r]=M0[r]*ppm; P[4+r]=M0[4+r]*ppm; P[8+r]=M0[8+r]; P[12+r]=M0[r]*tx+M0[4+r]*ty+M0[8+r]*tz+M0[12+r]; }
      this.cam.projectionMatrix.fromArray(P);
      this.ac.rotation.set((s.pitch||0)*D2R,(s.bank||0)*D2R,-(s.hd||0)*D2R);
      const sun=s.sun||{az:180,el:35}, ce=Math.cos(sun.el*D2R); this.sun.position.set(Math.sin(sun.az*D2R)*ce,-Math.cos(sun.az*D2R)*ce,Math.max(0.05,Math.sin(sun.el*D2R)));
      const lo=Math.max(0,Math.min(1,(sun.el-3)/30)); this.sun.color.setRGB(1,0.82+0.16*lo,0.62+0.32*lo); this.sun.intensity=0.75+0.35*lo;
      const now=performance.now(); if(s.spin){ const dt=this.t?Math.min(0.1,(now-this.t)/1000):0; this.ang+=dt*2*Math.PI*7.3; } this.t=now;
      this.model.props.forEach(p=>{ p.g.rotation.y=this.ang*p.dir; });
      const blink=s.spin&&(now%1200)<70; this.model.lights.forEach(l=>{ l.visible=blink; });
      this.r.resetState(); this.r.render(this.scene,this.cam); if(s.spin) map.triggerRepaint(); } };
  return L; }
window.SIMAC={layer,build,TYPES};
})();
