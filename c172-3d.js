/* Birdbird – Cessna 172 3D cockpit (beta): aircraft definition for the shared 3D cockpit engine (cockpit3d.js).
   High-wing cabin: one-piece windshield with door posts, door and rear side windows, the wing root and strut outside,
   headliner, front and rear seats, rudder pedals, pedestal with the trim wheel and the fuel selector on the floor, and the
   two control wheels in front of the live panel. Generic training model drawn by Birdbird (no registration or marks).
   Panel drawing: c172panel.js (2000 × 1320 units, ~1.9 units per mm). Cockpit frame: metres, x right, y up, z aft. */
(function(G){
'use strict';
const THREE=G.THREE, CK=G.CK3D;
if(!CK) return;
if(!THREE){ G.C172_3D={on:false,supported:()=>false}; return; }
const {Builder,bake,toMesh,lite,V3}=CK, D2R=Math.PI/180;
const PS=1/1900, PT=296, LB=1080, COLY=812, YKX=[480,1528];
const YF=-1.0, YR=0.31, YS=-0.21, ZWB=-1.06, ZWT=-0.60, ZB=0.40, ZR=1.25, XW=0.545;
const COL={trim:0xbcb5a7,trim2:0xa8a193,head:0xd9d4c8,frame:0xcbc5b8,hood:0x1c1c1d,carpet:0x45423d,well:0x2a2b2c,seat:0x58544d,seat2:0x67625a,
  skin:0xedebe5,skin2:0xd7d5ce,dark:0x2a2b2d,black:0x151517,ped:0x2d2c2a,metal:0x9a9ea3,grip:0x1d1d1f,stripe:0x5d6f86};
// windshield: a across (−1 left … 1 right), t from base (0) to the roof (1)
function ws(a,t){ const b=V3(a*0.50,-0.098+0.02*a*a,ZWB+0.10*a*a), p=V3(a*0.535,YR-0.004,ZWT+0.04*a*a); const q=b.lerp(p,t); q.z-=0.035*Math.sin(Math.PI*t)*(1-0.5*a*a); return q; }
const zFront=y=>y<-0.078?-0.96:-0.96+0.395*Math.min(1,(y+0.078)/0.385); // door window front edge (along the A-post)
const OATP=(()=>{ const p=ws(-0.62,0.66); return [p.x,p.y,p.z+0.025]; })();
const lipV=u=>{ const t=Math.max(0,Math.min(1,(u-30)/1940)); return PT-14-92*t*(1-t); };

function buildShell(K){
  const B=new Builder(), cab=V3(0,-0.3,0.2), pp=K.pp;
  // floor with the footwell rising to the firewall
  B.grid(10,24,(u,v)=>{ const z=-1.12+v*(ZR+1.12); const y=z<-0.98?YF+0.11*Math.min(1,(-0.98-z)/0.14):YF; return V3((-XW-0.02)+u*2*(XW+0.02),y,z); },COL.carpet,{toward:cab});
  B.grid(10,6,(u,v)=>V3((-XW-0.02)+u*2*(XW+0.02),YF+0.11+v*(-0.53-YF-0.11),-1.12-0.04*v),COL.well,{toward:cab});
  // side walls (door panels to the sill), sill ledge, armrests and door handles
  for(const sd of [-1,1]){
    B.grid(26,6,(u,v)=>{ const z=-1.12+u*(ZR+1.12); return V3(sd*(XW+0.01*Math.sin(Math.PI*v)),YF+v*(YS-YF),z); },COL.trim,{toward:cab});
    B.grid(26,1,(u,v)=>{ const z=-1.12+u*(ZR+1.12); return V3(sd*(XW-0.035*(1-v)),YS+0.002,z); },COL.trim2,{toward:V3(0,0.4,0)});
    B.sq(0.03,0.028,0.20,0.3,new THREE.Matrix4().makeTranslation(sd*(XW-0.04),-0.40,0.05),COL.seat2,8);
    B.box(sd*(XW-0.012),-0.29,-0.16,0.016,0.022,0.10,COL.metal);
    B.grid(4,3,(u,v)=>V3(sd*(XW-0.004),-0.86+v*0.22,-0.42+u*0.36),0x948d80,{toward:cab});
    // window frame: B-post, rear post, upper rail, sill rail, A-post along the windshield edge
    B.box(sd*(XW+0.005),(YS+YR)/2,ZB,0.035,YR-YS,0.06,COL.frame);
    B.box(sd*(XW+0.005),(YS+YR)/2,ZR-0.08,0.035,YR-YS,0.07,COL.frame);
    B.box(sd*(XW+0.004),YR-0.018,(ZWT+ZR)/2,0.032,0.036,ZR-ZWT,COL.frame);
    B.box(sd*(XW+0.004),YS+0.012,(ZWT-0.02+ZR)/2,0.03,0.024,ZR-ZWT+0.04,COL.frame);
    const ap=[]; for(let i=0;i<=10;i++) ap.push(ws(sd,i/10).add(V3(sd*0.004,0,0))); B.bar(ap,0.07,0.045,COL.frame,V3(sd,0,0.25).normalize());
    // wall beside the glareshield, ahead of the door window, up to the windshield corner
    B.grid(4,4,(u,v)=>V3(sd*XW,YS+v*(-0.078-YS),-1.12+u*0.16),COL.trim,{toward:cab});
  }
  // headliner with a shallow dome, front header over the windshield
  B.grid(10,18,(u,v)=>{ const x=-XW+u*2*XW, z=ZWT+0.02+v*(ZR-ZWT-0.02); return V3(x,YR+0.025*(1-(x*x)/(XW*XW)),z); },COL.head,{toward:cab});
  { const pts=[]; for(let i=0;i<=16;i++) pts.push(ws(-1+i/8,1).add(V3(0,-0.008,0.012))); B.bar(pts,0.06,0.05,COL.frame,V3(0,0.3,1).normalize()); }
  // rear baggage bulkhead
  B.grid(8,6,(u,v)=>V3(-XW+u*2*XW,YF+v*(YR+0.02-YF),ZR),COL.trim2,{toward:cab});
  // panel backing (behind the live panel), end caps to the walls, knee roll under the panel
  { const sh=new THREE.Shape(); sh.moveTo(34,LB); sh.lineTo(34,lipV(34)+8); for(let i=0;i<=20;i++){ const u=34+i*1932/20; sh.lineTo(u,lipV(u)+6); } sh.lineTo(1966,LB); sh.lineTo(34,LB);
    const EX=K.EX, EY=K.EY, PN=K.PN, PO=K.PO; const pm=new THREE.Matrix4().set(EX.x,EY.x,PN.x,PO.x+PN.x*0.01, EX.y,EY.y,PN.y,PO.y+PN.y*0.01, EX.z,EY.z,PN.z,PO.z+PN.z*0.01, 0,0,0,1);
    B.geo(new THREE.ShapeGeometry(sh,4),pm,0x34322f,false); }
  for(const sd of [-1,1]){ const u0=sd<0?34:1966; B.grid(1,8,(u,v)=>{ const p=pp(u0,lipV(u0)+v*(LB-lipV(u0))); return V3(sd*(Math.abs(p.x)+u*(XW-Math.abs(p.x))),p.y,p.z+u*0.02); },COL.trim2,{toward:cab}); }
  B.grid(14,2,(u,v)=>{ const p=pp(34+u*1932,LB); p.z-=v*0.30; p.y+=v*0.04; return p; },COL.dark,{toward:V3(0,-1.0,0.2)});
  // glareshield: from the padded lip of the panel forward to the windshield base
  { const n=24, L3=[], F3=[]; for(let i=0;i<=n;i++){ const u=30+i*1940/n; L3.push(pp(u,lipV(u),-0.004)); const f=ws((u-1000)/970,0); f.y-=0.004; F3.push(f); }
    B.grid(n,6,(u,v)=>{ const f=u*n, i=Math.min(n-1,Math.floor(f)), t=f-i; const A=L3[i].clone().lerp(L3[i+1],t), Bq=F3[i].clone().lerp(F3[i+1],t); const p=A.lerp(Bq,v); p.y+=Math.sin(v*Math.PI)*0.008; return p; },COL.hood,{toward:V3(-0.25,0.6,0)}); }
  // rudder pedals and their arms
  for(const xc of [-0.27,0.27]){ for(const dx of [-0.085,0.085]){ const m=new THREE.Matrix4().makeRotationX(-0.55).premultiply(new THREE.Matrix4().makeTranslation(xc+dx,-0.86,-0.96));
      B.box(0,0,0,0.07,0.15,0.02,0x2b2e33,m); B.box(0,0.045,-0.011,0.075,0.01,0.006,0x6d7379,m); B.box(0,-0.03,-0.011,0.075,0.01,0.006,0x6d7379,m); B.box(0,-0.1,0.02,0.022,0.07,0.035,0x1c1e21,m); }
    B.grid(4,6,(u,v)=>V3(xc-0.18+u*0.36,YF+0.006,-0.95+v*0.55),0x34322f,{toward:V3(0,0,0)}); }
  // pedestal: under the panel centre, the sloped trim face, a low step carrying the fuel selector on the floor
  { const s=new THREE.Shape(), P=[[-0.80,-0.53],[-0.748,-0.538],[-0.588,-0.735],[-0.588,-0.838],[-0.385,-0.892],[-0.385,YF],[-0.80,YF]];
    s.moveTo(P[0][0],P[0][1]); for(let i=1;i<P.length;i++) s.lineTo(P[i][0],P[i][1]); s.lineTo(P[0][0],P[0][1]);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.15,bevelEnabled:false,curveSegments:2}); B.geo(g,new THREE.Matrix4().makeTranslation(0.075,0,0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI/2)),COL.ped);
    B.box(0,-0.887,-0.487,0.17,0.006,0.215,0x3a3936,new THREE.Matrix4().makeRotationX(0).premultiply(new THREE.Matrix4())); }
  // seats: front pilot seats on rails, rear bench
  const seat=(xc,z0,w,front)=>{
    B.box(xc,YF+0.12,z0+0.02,w*0.85,0.24,0.40,0x3b3d40);
    B.sq(w/2,0.06,0.23,0.28,new THREE.Matrix4().makeRotationX(0.06).premultiply(new THREE.Matrix4().makeTranslation(xc,-0.80,z0)),COL.seat,12);
    const bm=new THREE.Matrix4().makeRotationX((front?12:14)*D2R).premultiply(new THREE.Matrix4().makeTranslation(xc,front?-0.42:-0.46,z0+(front?0.27:0.30)));
    B.sq(w/2,front?0.33:0.30,0.065,0.3,bm,COL.seat,12);
    B.box(0,0,0.065,w*0.96,(front?0.62:0.56),0.025,COL.seat2,bm);
    if(front){ const hm=new THREE.Matrix4().makeTranslation(0,0.42,0.0).premultiply(bm); B.sq(0.12,0.08,0.05,0.3,hm,COL.seat,10);
      for(const s of [-1,1]){ const m=new THREE.Matrix4().makeRotationZ(s*0.1).premultiply(new THREE.Matrix4().makeTranslation(s*0.08,0.02,-0.07)).premultiply(bm); B.box(0,0,0,0.04,0.56,0.007,0x5f6369,m); } }
  };
  seat(-0.27,0.16,0.44,true); seat(0.27,0.16,0.44,true); seat(0,1.02,1.02,false);
  // seat rails
  for(const xc of [-0.27,0.27]) for(const dx of [-0.15,0.15]) B.box(xc+dx,YF+0.008,0.05,0.025,0.016,0.9,0x6f7377);
  // control-column boots on the panel
  for(const u of YKX){ const p=K.pp(u,COLY,-0.002); B.geo(new THREE.CylinderGeometry(0.03,0.034,0.012,16),new THREE.Matrix4().makeRotationX(Math.PI/2).premultiply(new THREE.Matrix4().makeTranslation(p.x,p.y,p.z)),COL.black,false); }
  // compass bracket from the windshield header
  B.box(0,YR-0.03,-0.66,0.03,0.07,0.03,COL.black);
  bake(B,[-0.62,-1.05,-1.2,0.62,0.4,1.3]);
  return B;
}
// outside: the wing (root over the cabin, out to the tips), struts, cowling top, fuselage sides below the windows
function buildOutside(){
  const B=new Builder(); const up=V3(0,1,0);
  const wing=(sd)=>{ const span=5.0, yr=YR+0.075, dih=1.7*D2R; // root 0.5 m off the centre line: 11.0 m span
    B.grid(16,6,(u,v)=>{ const x=sd*(0.50+u*span), ch=1.62-0.45*Math.max(0,(u*span-2.6)/2.8), le=-0.80+0.06*Math.max(0,(u*span-2.6)/2.8); const y=yr+(u*span)*Math.tan(dih); const z=le+v*ch; const th=0.10*(1-v)*(1-0.4*u)*Math.sin(Math.PI*Math.min(1,v*1.4)); return V3(x,y-th*0.3,z); },COL.skin,{toward:V3(sd*2,-2,0)});
    B.grid(16,6,(u,v)=>{ const x=sd*(0.50+u*span), ch=1.62-0.45*Math.max(0,(u*span-2.6)/2.8), le=-0.80+0.06*Math.max(0,(u*span-2.6)/2.8); const y=yr+(u*span)*Math.tan(dih); const z=le+v*ch; const th=0.16*(1-0.4*u)*Math.sin(Math.PI*Math.min(1,v*1.25)); return V3(x,y+th,z); },COL.skin2,{toward:V3(sd*2,3,0)});
    // strut
    B.rod(V3(sd*0.62,-0.92,-0.02),V3(sd*2.55,yr+2.05*Math.tan(dih)-0.01,-0.24),0.035,0.03,COL.skin2,8);
    // fuselage skin below and behind the side window
    B.grid(10,3,(u,v)=>V3(sd*(XW+0.07),YS-0.02-v*0.75,-1.15+u*2.5),COL.skin,{toward:V3(sd*2,0,0)});
    B.grid(10,2,(u,v)=>V3(sd*(XW+0.07-0.02*v),YS-0.02+v*0.02,-1.15+u*2.5),COL.stripe,{toward:V3(sd*2,1,0)});
  };
  wing(-1); wing(1);
  // cabin roof under the wing centre section and the cowling ahead of the windshield
  B.grid(8,8,(u,v)=>V3(-0.62+u*1.24,YR+0.07,-0.75+v*1.6),COL.skin2,{toward:V3(0,-1,0)});
  B.grid(10,8,(u,v)=>{ const a=-1+2*u, z=ZWB-0.03-v*1.2; return V3(a*0.48*(1-0.25*v),-0.09-0.04*v-0.10*a*a*(1+v),z); },COL.skin,{toward:V3(0,2,0)});
  lite(B); return B;
}
// a control wheel on its column: ram's-horn yoke; the column tube is a separate mesh so it can lengthen without entering the panel
function buildYoke(K,u){
  const p0=K.pp(u,COLY,-0.004); const g=new THREE.Group(); const B=new Builder();
  const black=0x1f2022, hub=0x2e3033;
  B.sq(0.036,0.026,0.024,0.35,new THREE.Matrix4(),hub,10);                     // hub
  B.box(0,0.01,0.025,0.04,0.02,0.003,0xcfcac0);                               // hub plate
  const arm=[]; for(let i=0;i<=12;i++){ const a=-1+i/6; arm.push(V3(a*0.15,-0.01+0.022*a*a,0.006)); } B.bar(arm,0.018,0.02,hub,V3(0,0,1));
  for(const s of [-1,1]){ const m=new THREE.Matrix4().makeRotationZ(-s*0.22).premultiply(new THREE.Matrix4().makeTranslation(s*0.163,0.04,0.008)); B.sq(0.0135,0.058,0.016,0.4,m,black,10);
    B.box(s*0.155,0.096,0.01,0.014,0.01,0.013,s<0?0x8b2a20:0x3a3c3f,new THREE.Matrix4().makeRotationZ(-s*0.22)); }
  const yk=toMesh(lite(B)); g.add(yk);
  const T=new Builder(); T.geo(new THREE.CylinderGeometry(0.011,0.011,1,14,1),new THREE.Matrix4().makeRotationX(Math.PI/2).premultiply(new THREE.Matrix4().makeTranslation(0,0,0.5)),0xb9bdc1);
  const tube=toMesh(lite(T)); tube.position.copy(p0);
  g.position.set(p0.x,p0.y,p0.z+0.17); g.userData={p0,z0:p0.z+0.17,tube};
  return {g,tube};
}

G.C172_3D=CK.make({
  eye:[-0.26,0.09,0],   // left seat; 9 cm above the cabin reference so the cowling sits ~7° below the horizon (over-the-nose view on final)
  panel:{ps:PS,tilt:6,at:[1000,PT,[0,-0.12,-0.80]],w:2000,h:1320},
  views:{ahead:[9,-16,1],short:[8,-21,0.86]},
  limits:{yaw:[-150,150],pitch:[-55,60]},
  snaps:[['panel','Panel'],['left','Left',-80,-6,1],['right','Right',72,-8,1],['ped','Pedestal',24,-52,0.8],['out','Outside',0,-3,1]],
  noKeys:['KeyM'], // M and N are the mixture keys in this aircraft: look down with K
  cls:'d3c172',
  /* glTF cockpit (models/c172-cockpit.glb): wheels, levers, key, trim wheel and fuel selector in front of the live panel, so on
     the foreground pass; the flat drawn knobs and levers they replace are hidden (their touch zones stay) */
  glb:{id:'c172',v:1,
    fg:['yoke_L','yoke_R','throttle','mixture','carb_heat','flap_lever','magneto_key','trim_wheel','fuel_selector'],
    grab:['yoke_L','yoke_R'], direct:['yoke_L','yoke_R','pedal_L_l','pedal_L_r','pedal_R_l','pedal_R_r'],
    occ:['trim','fuel'], tint:{y0:0.2,y1:0.3,z0:-0.8,z1:-0.62,z2:1,z3:1.2},
    hide:['g.ctl[data-id="thr"] .mv','g.ctl[data-id="mix"] .mv','g.ctl[data-id="carb"] .mv','g.ctl[data-id="flaps"] .mv','g.ctl[data-id="mag"] .mv','g.ctl[data-id="trim"] .mv.wr','g.ctl[data-id="fuelSel"] .mv'],
    drive(get,st,C){ const sx=st.stick?st.stick.x:0, sy=st.stick?st.stick.y:0, r=st.ctl?st.ctl.rud||0:0, n=v=>+v||0;
      const fl=C.flap_lever.translate.positions, mg=C.magneto_key.rotate.positions;
      return {yoke_L:[sy*0.075,-sx*45], yoke_R:[sy*0.075,-sx*45],
        throttle:[(1-n(get('thr')))*0.065], mixture:[(1-n(get('mix')))*0.065], carb_heat:[get('carb')?0.06:0],
        flap_lever:[fl[['UP','10','20','FULL'][n(get('flaps'))]]], magneto_key:[0,mg[['OFF','R','L','BOTH','START'][n(get('mag'))]]],
        trim_wheel:[0,n(get('trim'))*540], fuel_selector:[0,[90,0,-90,180][n(get('fuelSel'))]],
        pedal_L_l:[0,r*16], pedal_L_r:[0,-r*16], pedal_R_l:[0,r*16], pedal_R_r:[0,-r*16]}; }},
  subs:[
    {id:'compass',rect:[900,100,200,104],pos:[0,YR-0.115,-0.675],pitch:6,sel:'g[clip-path="url(#cCmp)"]'},
    {id:'oat',rect:[336,134,72,90],pos:OATP,yaw:-14,pitch:-12},
    {id:'trim',rect:[900,1084,200,114],ps:0.0009,pos:[0,-0.635,-0.666],pitch:-39},
    {id:'fuel',rect:[900,1200,200,120],ps:0.0008,pos:[0,-0.884,-0.487],pitch:-75}
  ],
  build(K){
    const shell=toMesh(buildShell(K)), out=toMesh(buildOutside());
    const glass=CK.glass((u,v)=>ws(-1+2*u,0.01+v*0.98),24,12,{y0:0.2,y1:0.3,z0:-0.8,z1:-0.62,z2:1,z3:1.2});
    const side=[]; for(const sd of [-1,1]){ side.push(CK.glass((u,v)=>{ const y=YS+0.02+v*(YR-YS-0.04), zf=zFront(y)+0.02; return V3(sd*(XW+0.012),y,zf+u*(ZB-0.03-zf)); },4,4,{y0:9,y1:10,z0:0,z1:0,z2:0,z3:0}));
      side.push(CK.glass((u,v)=>V3(sd*(XW+0.012),YS+0.02+v*(YR-YS-0.04),ZB+0.04+u*(ZR-ZB-0.16)),4,2,{y0:9,y1:10,z0:0,z1:0,z2:0,z3:0})); }
    const y=[buildYoke(K,YKX[0]),buildYoke(K,YKX[1])];
    return {meshes:[out,shell,glass,...side],fg:[...y.map(x=>x.g),...y.map(x=>x.tube)],grab:y.map(x=>x.g),
      anim(st){ const sx=st.stick?st.stick.x:0, sy=st.stick?st.stick.y:0; let ch=false;
        y.forEach(({g,tube})=>{ const z=g.userData.z0+sy*0.075, r=-sx*0.55; if(Math.abs(g.position.z-z)>1e-4||Math.abs(g.rotation.z-r)>1e-4) ch=true; g.position.z=z; g.rotation.z=r; tube.scale.z=Math.max(0.01,z-g.userData.p0.z-0.02); });
        return ch; }};
  }
});
})(window);
