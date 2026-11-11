/* Birdbird – King Air B200 3D flight deck (beta): aircraft definition for the shared 3D cockpit engine (cockpit3d.js).
   Two-crew flight deck: two-piece windshield with a centre post, side windows with their frames, the upper panel at the top of
   the windshield, the pedestal with the power, propeller and condition levers, the fuel panel on the left side console and the
   circuit breakers on the right, both crew seats, the control wheels and, outside, the long nose, nacelles and wing.
   Generic training model drawn by Birdbird (no registration or marks). Panel drawing: b200panel.js (2000 × 1780 units).
   Cockpit frame: metres, x right, y up, z aft. */
(function(G){
'use strict';
const THREE=G.THREE, CK=G.CK3D;
if(!CK) return;
if(!THREE){ G.B200_3D={on:false,supported:()=>false}; return; }
const {Builder,bake,toMesh,lite,V3}=CK, D2R=Math.PI/180;
const PS=0.00058, PV=1266;                                   // metres per panel unit, bottom of the main panel
const YF=-1.12, YR=0.36, YS=-0.20, XW=0.68, ZWB=-1.24, ZWT=-0.80, ZB=0.18, ZR=0.80;
const YK=[[323,1047],[1657,1026]];                           // control wheel hubs on the panel drawing
const COL={trim:0xc3c1bb,trim2:0xaeaca5,head:0xd8d6d0,frame:0xbfbdb7,hood:0x2a2624,carpet:0x3d4046,well:0x2c2e31,seat:0x4b4e54,seat2:0x5b5f66,
  skin:0xeeeeea,skin2:0xd9d9d4,dark:0x26282b,black:0x151618,cons:0x2f2d2e,metal:0x9a9ea3,prop:0x1b1c1e};
// windshield (two panes): a across (−1 … 1), t from the base (0) to the top (1)
function ws(a,t){ const b=V3(a*0.60,-0.035+0.02*a*a,ZWB+0.16*a*a), p=V3(a*0.64,YR-0.06+0.02*(1-a*a),ZWT+0.07*a*a); const q=b.lerp(p,t); q.z-=0.03*Math.sin(Math.PI*t); return q; }
const zFront=y=>y<-0.015?ZWB+0.16:ZWB+0.16+(ZWT+0.07-(ZWB+0.16))*Math.min(1,(y+0.015)/(YR-0.04+0.015));

function buildShell(K){
  const B=new Builder(), cab=V3(0,-0.3,0.1), pp=K.pp;
  // floor and footwells
  B.grid(12,20,(u,v)=>{ const z=-1.24+v*(ZR+1.24); const y=z<-1.0?YF+0.12*Math.min(1,(-1.0-z)/0.2):YF; return V3((-XW-0.02)+u*2*(XW+0.02),y,z); },COL.carpet,{toward:cab});
  B.grid(12,6,(u,v)=>V3((-XW-0.02)+u*2*(XW+0.02),YF+0.12+v*(-0.62-YF-0.12),-1.24-0.03*v),COL.well,{toward:cab});
  // side walls, sill, armrests
  for(const sd of [-1,1]){
    B.grid(24,6,(u,v)=>{ const z=-1.26+u*(ZR+1.26); return V3(sd*(XW+0.012*Math.sin(Math.PI*v)),YF+v*(YS-YF),z); },COL.trim,{toward:cab});
    B.grid(24,1,(u,v)=>{ const z=-1.26+u*(ZR+1.26); return V3(sd*(XW-0.05*(1-v)),YS+0.002,z); },COL.trim2,{toward:V3(0,0.4,0)});
    B.sq(0.035,0.03,0.22,0.3,new THREE.Matrix4().makeTranslation(sd*(XW-0.06),-0.36,0.12),COL.seat2,8);
    B.grid(4,4,(u,v)=>V3(sd*XW,YS+v*(-0.015-YS),-1.26+u*0.17),COL.trim,{toward:cab});
    // window posts: A-post along the windshield edge, the post between the side windows, the rear post; upper and sill rails
    const ap=[]; for(let i=0;i<=10;i++) ap.push(ws(sd,i/10).add(V3(sd*0.004,0,0))); B.bar(ap,0.075,0.05,COL.frame,V3(sd,0,0.3).normalize());
    B.box(sd*(XW+0.004),(YS+YR-0.04)/2,-0.30,0.034,YR-0.04-YS,0.07,COL.frame);
    B.box(sd*(XW+0.004),(YS+YR-0.04)/2,ZB,0.034,YR-0.04-YS,0.07,COL.frame);
    B.box(sd*(XW+0.004),YR-0.055,(ZWT+ZR)/2,0.034,0.04,ZR-ZWT,COL.frame);
    B.box(sd*(XW+0.003),YS+0.012,(ZWT+ZR)/2,0.03,0.024,ZR-ZWT+0.2,COL.frame);
    // side console under the fuel panel (left) and the circuit breakers (right): sloped top under the panel plane
    { const s=new THREE.Shape(); let P=[[-0.70,YF],[-0.70,-0.387],[-0.574,-0.604],[-0.574,YF]]; if(sd>0) P=P.map(([x,y])=>[-x,y]).reverse(); s.moveTo(P[0][0],P[0][1]); for(let i=1;i<P.length;i++) s.lineTo(P[i][0],P[i][1]); s.lineTo(P[0][0],P[0][1]);
      const g=new THREE.ExtrudeGeometry(s,{depth:0.50,bevelEnabled:false,curveSegments:2}); B.geo(g,new THREE.Matrix4().makeTranslation(0,0,-0.90),COL.cons); }
  }
  // headliner, header over the windshield, centre post between the panes
  B.grid(12,16,(u,v)=>{ const x=-XW+u*2*XW, z=ZWT+0.03+v*(ZR-ZWT-0.03); return V3(x,YR-0.06+0.06*(1-(x*x)/(XW*XW)),z); },COL.head,{toward:cab});
  { const pts=[]; for(let i=0;i<=16;i++) pts.push(ws(-1+i/8,1).add(V3(0,-0.006,0.012))); B.bar(pts,0.07,0.05,COL.frame,V3(0,0.3,1).normalize());
    const cp=[]; for(let i=0;i<=8;i++) cp.push(ws(0,i/8).add(V3(0,0,0.008))); B.bar(cp,0.06,0.045,COL.frame,V3(0,0,1)); }
  // upper panel housing (the live upper panel sits on its face)
  { const c=V3(0,0.27,-0.74), q=new THREE.Quaternion().setFromEuler(new THREE.Euler(35*D2R,0,0,'YXZ'));
    const m=new THREE.Matrix4().compose(c.clone().add(V3(0,0.02,-0.035).applyQuaternion(q)),q,V3(1,1,1)); B.box(0,0,0,0.32,0.21,0.06,COL.cons,m);
    B.box(0,YR-0.02-0.05,-0.80,0.22,0.07,0.10,COL.cons); }
  // cockpit divider behind the seats with an opening to the cabin
  for(const sd of [-1,1]) B.grid(4,8,(u,v)=>V3(sd*(0.26+u*(XW-0.26)),YF+v*(YR-YF),ZR),COL.trim2,{toward:cab});
  B.grid(4,2,(u,v)=>V3(-0.26+u*0.52,0.1+v*(YR-0.1),ZR),COL.trim2,{toward:cab});
  // panel backing, end caps to the walls, knee roll under the panel
  { const top=K.topEdge('path.glare',20,1980,40,()=>300); const sh=new THREE.Shape(); sh.moveTo(20,PV); top.forEach(([u,v])=>sh.lineTo(u,v+10)); sh.lineTo(1980,PV); sh.lineTo(20,PV);
    const EX=K.EX, EY=K.EY, PN=K.PN, PO=K.PO; const pm=new THREE.Matrix4().set(EX.x,EY.x,PN.x,PO.x+PN.x*0.012, EX.y,EY.y,PN.y,PO.y+PN.y*0.012, EX.z,EY.z,PN.z,PO.z+PN.z*0.012, 0,0,0,1);
    B.geo(new THREE.ShapeGeometry(sh,4),pm,0x232222,false);
    for(const sd of [-1,1]){ const u0=sd<0?20:1980, v0=sd<0?top[0][1]:top[top.length-1][1]; B.grid(1,8,(u,v)=>{ const p=pp(u0,v0+v*(PV-v0)); return V3(sd*(Math.abs(p.x)+u*(XW-Math.abs(p.x))),p.y,p.z+u*0.02); },COL.trim2,{toward:cab}); }
    B.grid(14,2,(u,v)=>{ const p=pp(20+u*1960,PV); p.z-=v*0.32; p.y+=v*0.03; return p; },COL.dark,{toward:V3(0,-1.0,0.2)});
    // glareshield: from the top of the panel drawing forward to the windshield base
    const n=top.length-1, L3=top.map(([u,v])=>pp(u,v,-0.004)), F3=top.map(([u])=>{ const f=ws(Math.max(-1,Math.min(1,(u-1000)/980)),0); f.y-=0.004; return f; });
    B.grid(n,6,(u,v)=>{ const f=u*n, i=Math.min(n-1,Math.floor(f)), t=f-i; const A=L3[i].clone().lerp(L3[i+1],t), Bq=F3[i].clone().lerp(F3[i+1],t); const p=A.lerp(Bq,v); p.y+=Math.sin(v*Math.PI)*0.01; return p; },COL.hood,{toward:V3(-0.37,0.6,0)}); }
  // pedestal body under the power quadrant (top face under the live pedestal plane)
  { const s=new THREE.Shape(), P=[[-0.90,-0.64],[-0.862,-0.648],[-0.628,-0.783],[-0.30,-0.80],[-0.30,YF],[-0.90,YF]];
    s.moveTo(P[0][0],P[0][1]); for(let i=1;i<P.length;i++) s.lineTo(P[i][0],P[i][1]); s.lineTo(P[0][0],P[0][1]);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.36,bevelEnabled:false,curveSegments:2}); B.geo(g,new THREE.Matrix4().makeTranslation(0.18,0,0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI/2)),COL.cons); }
  // rudder pedals
  for(const xc of [-0.37,0.37]){ for(const dx of [-0.09,0.09]){ const m=new THREE.Matrix4().makeRotationX(-0.5).premultiply(new THREE.Matrix4().makeTranslation(xc+dx,-0.98,-1.08));
      B.box(0,0,0,0.08,0.17,0.022,0x2b2e33,m); B.box(0,0.05,-0.012,0.085,0.012,0.006,0x6d7379,m); B.box(0,-0.03,-0.012,0.085,0.012,0.006,0x6d7379,m); }
    B.grid(4,6,(u,v)=>V3(xc-0.2+u*0.4,YF+0.006,-1.05+v*0.6),0x34363a,{toward:V3(0,0,0)}); }
  // crew seats with headrests and inboard armrests
  const seat=(xc,z0)=>{
    B.box(xc,YF+0.13,z0+0.02,0.36,0.26,0.42,0x3a3c40);
    B.sq(0.24,0.065,0.25,0.28,new THREE.Matrix4().makeRotationX(0.06).premultiply(new THREE.Matrix4().makeTranslation(xc,-0.80,z0)),COL.seat,12);
    const bm=new THREE.Matrix4().makeRotationX(13*D2R).premultiply(new THREE.Matrix4().makeTranslation(xc,-0.38,z0+0.30));
    B.sq(0.24,0.36,0.07,0.3,bm,COL.seat,12); B.box(0,0,0.07,0.46,0.68,0.03,COL.seat2,bm);
    B.sq(0.14,0.10,0.06,0.3,new THREE.Matrix4().makeTranslation(0,0.47,0.01).premultiply(bm),COL.seat,10);
    for(const s of [-1,1]) B.sq(0.035,0.035,0.2,0.3,new THREE.Matrix4().makeTranslation(xc+s*0.26,-0.56,z0+0.06),COL.seat2,8);
    for(const s of [-1,1]){ const m=new THREE.Matrix4().makeRotationZ(s*0.1).premultiply(new THREE.Matrix4().makeTranslation(s*0.09,0.03,-0.075)).premultiply(bm); B.box(0,0,0,0.045,0.6,0.008,0x5f6369,m); }
  };
  seat(-0.37,0.24); seat(0.37,0.24);
  // control-column boots on the panel
  for(const [u,v] of YK){ const p=pp(u,v,-0.002); B.geo(new THREE.CylinderGeometry(0.034,0.038,0.012,16),new THREE.Matrix4().makeRotationX(Math.PI/2).premultiply(new THREE.Matrix4().makeTranslation(p.x,p.y,p.z)),COL.black,false); }
  bake(B,[-0.75,-1.18,-1.35,0.75,0.42,0.9]);
  return B;
}
// outside: the long nose ahead of the windshield, the nacelles and propellers, the wing roots
function buildOutside(){
  const B=new Builder();
  // nose: top and sides tapering forward
  B.grid(12,10,(u,v)=>{ const a=-1+2*u, z=ZWB-0.02-v*2.1, w=0.62*(1-0.55*v*v); return V3(a*w,-0.05-0.10*v-0.16*a*a*(1+v)-0.25*v*v,z); },COL.skin,{toward:V3(0,2,0)});
  for(const sd of [-1,1]){
    // nacelle (cylinder + tapered nose), spinner and a faint propeller disc
    const nx=sd*2.45, ny=-0.95;
    B.geo(new THREE.CylinderGeometry(0.42,0.36,2.4,16,1,true),new THREE.Matrix4().makeRotationX(Math.PI/2).premultiply(new THREE.Matrix4().makeTranslation(nx,ny,-0.2)),COL.skin);
    B.geo(new THREE.CylinderGeometry(0.30,0.42,0.6,16,1,true),new THREE.Matrix4().makeRotationX(Math.PI/2).premultiply(new THREE.Matrix4().makeTranslation(nx,ny,-1.7)),COL.skin2);
    B.geo(new THREE.ConeGeometry(0.16,0.35,14),new THREE.Matrix4().makeRotationX(-Math.PI/2).premultiply(new THREE.Matrix4().makeTranslation(nx,ny,-2.17)),0x222324);
    // wing: root aft of the cockpit, out past the nacelle
    B.grid(14,6,(u,v)=>{ const x=sd*(0.75+u*7.6), ch=2.3-1.2*u, le=0.35+0.5*u; return V3(x,-1.28+u*7.6*0.05+0.10*Math.sin(Math.PI*Math.min(1,v*1.3)),le+v*ch); },COL.skin,{toward:V3(sd*2,3,0)});
    // fuselage side under the windows
    B.grid(10,3,(u,v)=>V3(sd*(XW+0.08),YS-0.02-v*0.9,-1.3+u*2.4),COL.skin,{toward:V3(sd*2,0,0)});
  }
  // roof outside the headliner
  B.grid(8,6,(u,v)=>V3(-0.72+u*1.44,YR+0.06,ZWT-0.05+v*1.7),COL.skin2,{toward:V3(0,-1,0)});
  lite(B); return B;
}
// control wheel on its column (the column tube lengthens instead of entering the panel)
function buildYoke(K,u,v){
  const p0=K.pp(u,v,-0.004); const g=new THREE.Group(); const B=new Builder();
  const black=0x1f2022, hub=0x34373b;
  B.sq(0.05,0.04,0.03,0.35,new THREE.Matrix4(),hub,10);
  B.box(0,0.004,0.031,0.052,0.036,0.004,0xd6d3cb);
  const arm=[]; for(let i=0;i<=12;i++){ const a=-1+i/6; arm.push(V3(a*0.17,-0.03+0.035*a*a,0.008)); } B.bar(arm,0.022,0.024,hub,V3(0,0,1));
  for(const s of [-1,1]){ const m=new THREE.Matrix4().makeRotationZ(-s*0.18).premultiply(new THREE.Matrix4().makeTranslation(s*0.185,0.035,0.01)); B.sq(0.016,0.072,0.019,0.4,m,black,10);
    B.box(s*0.18,0.105,0.014,0.016,0.012,0.015,s<0?0x8b2a20:0x3a3c3f,new THREE.Matrix4().makeRotationZ(-s*0.18));
    B.box(s*0.17,0.06,0.03,0.012,0.012,0.008,0x6a6e73,new THREE.Matrix4().makeRotationZ(-s*0.18)); }
  g.add(toMesh(lite(B)));
  const T=new Builder(); T.geo(new THREE.CylinderGeometry(0.014,0.014,1,14,1),new THREE.Matrix4().makeRotationX(Math.PI/2).premultiply(new THREE.Matrix4().makeTranslation(0,0,0.5)),0x8f9499);
  const tube=toMesh(lite(T)); tube.position.copy(p0);
  g.position.set(p0.x,p0.y,p0.z+0.20); g.userData={p0,z0:p0.z+0.20};
  return {g,tube};
}

G.B200_3D=CK.make({
  eye:[-0.37,0.12,0],   // left seat; 12 cm up so the glareshield and long nose sit ~7° below the horizon (runway in view on final)
  panel:{ps:PS,tilt:10,at:[1000,600,[0,-0.27,-0.93]],w:2000,h:1780},
  views:{ahead:[13,-19,0.92],short:[12,-24,0.82]},
  limits:{yaw:[-150,150],pitch:[-60,60]},
  snaps:[['panel','Panel'],['left','Left',-78,-10,1],['right','Right',74,-10,1],['up','Upper panel',22,28,0.75],['ped','Pedestal',26,-44,0.85],['fuel','Fuel panel',-24,-36,0.75],['cb','Breakers',56,-24,0.8],['out','Outside',0,-4,1]],
  cls:'d3b200',
  subs:[
    {id:'upper',rect:[814,0,366,242],ps:0.0008,pos:[0,0.27,-0.74],pitch:35},
    {id:'ped',rect:[664,1246,660,534],ps:0.0005,pos:[0,-0.7125,-0.7435],pitch:-60},
    {id:'fuel',rect:[4,1246,520,374],ps:0.0005,pos:[-0.632,-0.50,-0.66],yaw:90,pitch:-30},
    {id:'rside',rect:[1522,1246,476,534],ps:0.0005,pos:[0.632,-0.50,-0.62],yaw:-90,pitch:-30}
  ],
  build(K){
    const shell=toMesh(buildShell(K)), out=toMesh(buildOutside());
    const glass=CK.glass((u,v)=>ws(-1+2*u,0.01+v*0.98),24,12,{y0:0.22,y1:0.32,z0:-1.0,z1:-0.8,z2:1,z3:1.2});
    const side=[]; for(const sd of [-1,1]){ side.push(CK.glass((u,v)=>{ const y=YS+0.02+v*(YR-0.08-YS), zf=zFront(y)+0.02; return V3(sd*(XW+0.012),y,zf+u*(-0.33-zf)); },4,4,{y0:9,y1:10,z0:0,z1:0,z2:0,z3:0}));
      side.push(CK.glass((u,v)=>V3(sd*(XW+0.012),YS+0.02+v*(YR-0.08-YS),-0.27+u*(ZB-0.03+0.27)),3,2,{y0:9,y1:10,z0:0,z1:0,z2:0,z3:0})); }
    const y=YK.map(([u,v])=>buildYoke(K,u,v));
    return {meshes:[out,shell,glass,...side],fg:[...y.map(x=>x.g),...y.map(x=>x.tube)],grab:y.map(x=>x.g),
      anim(st){ const sx=st.stick?st.stick.x:0, sy=st.stick?st.stick.y:0; let ch=false;
        y.forEach(({g,tube})=>{ const z=g.userData.z0+sy*0.08, r=-sx*0.6; if(Math.abs(g.position.z-z)>1e-4||Math.abs(g.rotation.z-r)>1e-4) ch=true; g.position.z=z; g.rotation.z=r; tube.scale.z=Math.max(0.01,z-g.userData.p0.z-0.02); });
        return ch; }};
  }
});
})(window);
