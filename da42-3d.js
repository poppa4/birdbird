/* Birdbird – DA42 3D cockpit (beta): aircraft definition for the shared 3D cockpit engine (cockpit3d.js).
   A low-poly cockpit shell with baked lighting, drawn by three.js on top of the otw.js outside world, and the real interactive
   SVG/HTML panel placed in 3D with a projective CSS matrix (so every switch, knob and lever is the live DOM control – no
   re-rasterising). Generic training model drawn by Birdbird.
   Cockpit frame: metres, x = right, y = up, z = aft (forward is −z), origin between the pilots at eye height. */
(function(G){
'use strict';
const D2R=Math.PI/180, THREE=G.THREE, CK=G.CK3D;
if(!CK) return;
if(!THREE){ G.DA42_3D={on:false,supported:()=>false}; return; }
const {Builder,bake,toMesh}=CK;

/* ---------- geometry constants ---------- */
const PS=0.00074, TILT=10*D2R;                     // panel: metres per panel unit, top leans away 10°
const PO=new THREE.Vector3(-0.592,-0.010,-0.79);   // panel unit (0,0)
const EX=new THREE.Vector3(PS,0,0), EY=new THREE.Vector3(0,-PS*Math.cos(TILT),PS*Math.sin(TILT));
const PN=new THREE.Vector3().crossVectors(EX,EY).normalize(); // into the panel (away from pilot)
const pp=(u,v,o)=>new THREE.Vector3().copy(PO).addScaledVector(EX,u).addScaledVector(EY,v).addScaledVector(PN,o||0);
const ZF=-1.15, ZR=1.65, YS=-0.33, YF=-1.05, WW=0.62;
const sm=t=>{ t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); };
const sp=(w,e)=>Math.sign(w)*Math.pow(Math.abs(w),e);
function cw(z){ return z<-0.85?0.5+0.12*sm((z-ZF)/0.3):z>1.0?WW-0.1*sm((z-1.0)/0.65):WW; }
function ct(z){ if(z<-0.2){ const t=Math.max(0,(z-ZF)/0.95); return -0.06+0.34*(1-(1-t)*(1-t)); } if(z<0.7) return 0.28; return 0.28-0.36*Math.pow(Math.min(1,(z-0.7)/0.95),1.7); }
function canopy(z,a){ const th=a*Math.PI/2, w=cw(z), t=ct(z); return new THREE.Vector3(w*sp(Math.sin(th),0.75),YS+(t-YS)*Math.pow(Math.cos(th),0.75),z); }

/* ---------- the cockpit ---------- */
const COL={trim:0xd3cec4,trim2:0xbdb8ad,frame:0xdedbd3,hood:0x17191c,carpet:0x3a3b3e,dark:0x24272b,console:0x2c3035,seat:0x3c4148,seat2:0x4b5058,strap:0x6a6f76,buckle:0xb9bec4,shell:0xcac5ba,well:0x1e2023,red:0xb3261b,black:0x141518};
function buildShell(){
  const B=new Builder(), cab=new THREE.Vector3(0,-0.35,0.2);
  // floor
  B.grid(12,28,(u,v)=>new THREE.Vector3(-0.6+u*1.2,YF,ZF+v*(ZR-ZF)),COL.carpet,{toward:cab});
  // side walls with sill ledge (both sides)
  for(const sd of [-1,1]){
    const prof=[[0.60,YF],[0.585,-0.80],[0.565,-0.55],[0.55,-0.40],[0.55,YS]];
    B.grid(28,8,(u,v)=>{ const z=ZF+u*(ZR-ZF); const f=v*(prof.length-1), i=Math.min(prof.length-2,Math.floor(f)), t=f-i; return new THREE.Vector3(sd*(prof[i][0]+(prof[i+1][0]-prof[i][0])*t),prof[i][1]+(prof[i+1][1]-prof[i][1])*t,z); },COL.trim,{toward:cab});
    // ledge from the wall to past the canopy edge
    B.grid(28,2,(u,v)=>{ const z=ZF+u*(ZR-ZF); const x0=Math.min(0.55,cw(z)-0.005); return new THREE.Vector3(sd*(x0+(0.68-x0)*v),YS,z); },COL.trim2,{toward:new THREE.Vector3(0,0.4,0)});
    // armrest pad and map pocket
    B.sq(0.03,0.025,0.22,0.3,new THREE.Matrix4().makeTranslation(sd*0.53,-0.40,0.12),COL.seat2,8);
    B.grid(6,3,(u,v)=>new THREE.Vector3(sd*0.574,-0.86+v*0.24,-0.5+u*0.42),0x9d988e,{toward:cab});
    B.box(sd*0.57,-0.62,-0.29,0.012,0.012,0.42,0x8f8a80);
    // sill rail of the canopy (frame)
    const rail=[]; for(let i=0;i<=28;i++){ const z=ZF+0.02+i/28*(ZR-ZF-0.04); rail.push(new THREE.Vector3(sd*(cw(z)+0.005),YS+0.0,z)); }
    B.member(rail,()=>new THREE.Vector3(-sd,0,0),new THREE.Vector3(0,1,0),0.05,0.035,COL.frame);
  }
  // footwell and nose bulkhead
  B.grid(12,8,(u,v)=>new THREE.Vector3(-0.6+u*1.2,YF+v*(YS-YF+0.05),ZF),COL.well,{toward:cab});
  for(const xc of [-0.27,0.27]){ for(const dx of [-0.09,0.09]){ const m=new THREE.Matrix4().makeRotationX(-0.55).premultiply(new THREE.Matrix4().makeTranslation(xc+dx,-0.95,-0.86)); B.box(0,0,0,0.075,0.16,0.022,0x2b2e33,m); B.box(0,0.05,-0.012,0.08,0.012,0.006,0x6d7379,m); B.box(0,-0.03,-0.012,0.08,0.012,0.006,0x6d7379,m); B.box(0,-0.09,0.03,0.025,0.05,0.04,0x1c1e21,m); }
    B.grid(4,6,(u,v)=>new THREE.Vector3(xc-0.19+u*0.38,YF+0.006,-0.95+v*0.62),0x2a2b2d,{toward:new THREE.Vector3(0,0,0)}); }
  // panel backing (dark silhouette of the panel face, 1 cm behind the live panel)
  const sh=new THREE.Shape(); sh.moveTo(18,770); sh.lineTo(18,250); sh.quadraticCurveTo(18,140,130,118); sh.quadraticCurveTo(800,46,1470,118); sh.quadraticCurveTo(1582,140,1582,250); sh.lineTo(1582,770); sh.lineTo(18,770);
  const cs=new THREE.Shape(); cs.moveTo(560,760); cs.lineTo(1040,760); cs.lineTo(1040,980); cs.lineTo(560,980); cs.lineTo(560,760);
  const pm=new THREE.Matrix4().set(EX.x,EY.x,PN.x,PO.x+PN.x*0.012, EX.y,EY.y,PN.y,PO.y+PN.y*0.012, EX.z,EY.z,PN.z,PO.z+PN.z*0.012, 0,0,0,1);
  B.geo(new THREE.ShapeGeometry(sh,8),pm,0x2a2e33,false); B.geo(new THREE.ShapeGeometry(cs,2),pm,0x23262a,false);
  // under-panel (knee roll) from the face bottom forward
  B.grid(14,2,(u,v)=>{ const p=pp(18+u*1564,770); p.z-=v*0.32; p.y+=v*0.06; return p; },COL.dark,{toward:new THREE.Vector3(0,-1.0,0.2)});
  // glareshield hood: from the panel lip forward to the windshield base
  const lip=[]; const q=(p0,c,p1,t)=>[(1-t)*(1-t)*p0[0]+2*(1-t)*t*c[0]+t*t*p1[0],(1-t)*(1-t)*p0[1]+2*(1-t)*t*c[1]+t*t*p1[1]];
  for(let i=0;i<=4;i++) lip.push(q([18,250],[18,140],[130,118],i/4)); for(let i=1;i<=16;i++) lip.push(q([130,118],[800,46],[1470,118],i/16)); for(let i=1;i<=4;i++) lip.push(q([1470,118],[1582,140],[1582,250],i/4));
  const L3=lip.map(([u,v])=>pp(u,v,-0.003)), F3=lip.map(([u])=>{ const a=(u-800)/782; const p=canopy(ZF+0.01,a*0.985); p.y-=0.004; return p; });
  B.grid(lip.length-1,6,(u,v)=>{ const f=u*(lip.length-1), i=Math.min(lip.length-2,Math.floor(f)), t=f-i; const A=L3[i].clone().lerp(L3[i+1],t), Bq=F3[i].clone().lerp(F3[i+1],t); const p=A.lerp(Bq,v); p.y+=Math.sin(v*Math.PI)*0.012; return p; },COL.hood,{toward:new THREE.Vector3(-0.27,0.6,0)});
  // hood cheeks down to the sill beside the panel
  for(const sd of [-1,1]) B.grid(6,6,(u,v)=>{ const z=-0.76-u*0.39; const top=sd<0?L3[0]:L3[L3.length-1]; const y=(top.y+(F3[0].y-top.y)*u)*(1-v)+YS*v; return new THREE.Vector3(sd*(0.585+0.03*u),y,z); },COL.trim,{toward:cab});
  // windshield base seal and canopy hinges
  { const pts=[]; for(let i=0;i<=24;i++) pts.push(canopy(ZF+0.015,-1+i/12)); B.member(pts,(i)=>{ const p=pts[i]; return new THREE.Vector3(-p.x,-(p.y-YS)-0.2,0).normalize(); },new THREE.Vector3(0,0,1),0.03,0.018,COL.black); }
  // canopy bows: roll-over bar behind the heads, rear bow
  const bow=(z,w,dp,col)=>{ const pts=[]; for(let i=0;i<=30;i++) pts.push(canopy(z,-1+i/15)); B.member(pts,(i)=>{ const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)]; const t=new THREE.Vector3().subVectors(b,a).normalize(); return new THREE.Vector3(t.y,-t.x,0).normalize(); },new THREE.Vector3(0,0,1),w,dp,col); };
  bow(0.47,0.09,0.06,COL.frame); bow(1.60,0.07,0.05,COL.frame);
  // overhead: canopy handle on the roll bar, small rear-view mirror
  { const top=canopy(0.47,0); B.box(0,top.y-0.075,0.40,0.16,0.022,0.028,COL.black); B.box(-0.06,top.y-0.055,0.42,0.02,0.03,0.02,COL.black); B.box(0.06,top.y-0.055,0.42,0.02,0.03,0.02,COL.black); }
  // left canopy lock lever on the sill
  B.box(-0.575,-0.305,-0.02,0.022,0.02,0.10,0x3a3d42); B.box(-0.575,-0.296,0.035,0.024,0.028,0.02,0x54585e);
  // rear bulkhead
  { const s=new THREE.Shape(); s.moveTo(-cw(ZR),YF); s.lineTo(-cw(ZR),YS); for(let i=0;i<=20;i++){ const p=canopy(ZR,-1+i/10); s.lineTo(p.x,p.y-0.01); } s.lineTo(cw(ZR),YF); s.lineTo(-cw(ZR),YF);
    B.geo(new THREE.ShapeGeometry(s,6),new THREE.Matrix4().makeTranslation(0,0,ZR-0.02),COL.trim2); }
  // centre console (between the seats, behind the panel console)
  { const s=new THREE.Shape(); const w=0.15, r=0.04; s.moveTo(-w,YF); s.lineTo(-w,-0.72-r); s.quadraticCurveTo(-w,-0.72,-w+r,-0.72); s.lineTo(w-r,-0.72); s.quadraticCurveTo(w,-0.72,w,-0.72-r); s.lineTo(w,YF); s.lineTo(-w,YF);
    const g=new THREE.ExtrudeGeometry(s,{depth:0.98,bevelEnabled:false,curveSegments:4}); B.geo(g,new THREE.Matrix4().makeTranslation(0,0,-0.67),COL.console);
    B.box(0,-0.715,-0.05,0.2,0.012,0.5,0x3a3f45); }
  // seats
  const seat=(xc,z0,front)=>{
    const rec=front?12*D2R:15*D2R;
    B.box(xc,(YF-0.89)/2,z0+0.02,0.4,0.89+YF<0?-(0.89+YF):0.16,0.46,COL.shell); // shell pedestal
    B.sq(0.205,0.055,0.225,0.28,new THREE.Matrix4().makeRotationX(0.07).premultiply(new THREE.Matrix4().makeTranslation(xc,-0.845,z0)),COL.seat,12);
    for(const s of [-1,1]) B.sq(0.03,0.06,0.22,0.35,new THREE.Matrix4().makeTranslation(xc+s*0.2,-0.82,z0),COL.seat2,8);
    const bm=new THREE.Matrix4().makeRotationX(rec).premultiply(new THREE.Matrix4().makeTranslation(xc,front?-0.43:-0.5,z0+(front?0.31:0.36)));
    B.sq(0.215,0.36,0.06,0.28,bm,COL.seat,12);
    for(const s of [-1,1]) B.sq(0.035,0.33,0.05,0.35,new THREE.Matrix4().makeTranslation(s*0.205,0,-0.02).premultiply(bm),COL.seat2,8);
    B.box(0,0,0.06,0.42,0.7,0.03,COL.shell,bm);                                   // shell back
    if(front){
      const hm=new THREE.Matrix4().makeTranslation(0,0.47,0.0).premultiply(bm); B.sq(0.13,0.09,0.055,0.3,hm,COL.seat,10);
      B.box(-0.06,0.38,0.02,0.02,0.07,0.02,0x8d9196,bm); B.box(0.06,0.38,0.02,0.02,0.07,0.02,0x8d9196,bm);
      // harness
      for(const s of [-1,1]){ const m=new THREE.Matrix4().makeRotationZ(s*0.12).premultiply(new THREE.Matrix4().makeTranslation(s*0.085,0.05,-0.064)).premultiply(bm); B.box(0,0,0,0.045,0.6,0.008,COL.strap,m); }
      B.box(0,-0.3,-0.07,0.32,0.045,0.008,COL.strap,bm); B.box(0,-0.3,-0.078,0.06,0.06,0.012,COL.buckle,bm);
    } else { const hm=new THREE.Matrix4().makeTranslation(0,0.43,0.0).premultiply(bm); B.sq(0.12,0.08,0.05,0.3,hm,COL.seat,8); }
  };
  seat(-0.27,-0.12,true); seat(0.27,-0.12,true); seat(-0.27,0.98,false); seat(0.27,0.98,false);
  // stick boots (sticks themselves are animated separately)
  for(const xc of [-0.27,0.27]) B.geo(new THREE.CylinderGeometry(0.03,0.075,0.08,12),new THREE.Matrix4().makeTranslation(xc,YF+0.04,-0.42),COL.black);
  bake(B);
  return B;
}
// the canopy: one bubble from the windshield base to the rear bow
function buildGlass(){ return CK.glass((u,v)=>canopy(ZF+0.005+v*(ZR-ZF-0.01),-1+2*u),40,60); }
function buildStick(xc){
  const B=new Builder();
  B.geo(new THREE.CylinderGeometry(0.010,0.012,0.36,10),new THREE.Matrix4().makeTranslation(0,0.18,0),0x34373b);
  B.sq(0.021,0.058,0.025,0.4,new THREE.Matrix4().makeRotationX(0.12).premultiply(new THREE.Matrix4().makeTranslation(0,0.40,0.004)),COL.black,10);
  B.box(-0.012,0.452,-0.004,0.012,0.008,0.012,COL.red); B.box(0.008,0.457,0.004,0.012,0.006,0.012,0x6a7077);
  // simple light (no AO): top light
  const n=B.N; for(let v=0;v<B.P.length/3;v++){ const k=0.55+0.4*Math.max(0,n[v*3+1])+0.25*Math.max(0,-n[v*3+2]*0.6+n[v*3]*-0.3); B.C[v*3]*=k; B.C[v*3+1]*=k; B.C[v*3+2]*=k; }
  const m=toMesh(B,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})); m.position.set(xc,YF+0.05,-0.42); return m;
}


/* ---------- definition ---------- */
G.DA42_3D=CK.make({
  eye:[-0.27,0.09,0],                                // left seat, pilot eye: 9 cm up so the glareshield is ~9° below the horizon
  panel:{ps:PS,tilt:10,o:[PO.x,PO.y,PO.z],w:1600,h:980},
  views:{ahead:[12,-18,1],short:[10,-23,0.84]},
  noKeys:['KeyK'], // K and L set the selected altitude in this aircraft: look down with M
  snaps:[['panel','Panel'],['left','Left',-78,-14,1],['right','Right',78,-14,1],['ped','Console',14,-46,0.8],['out','Outside',0,-3,1]],
  /* glTF cockpit (models/da42-cockpit.glb): power levers, flap switch, gear handle and trim wheel sit on the panel, so on the
     foreground pass; the sticks and pedals are below it. The flat drawn levers they replace are hidden (touch zones stay) */
  glb:{id:'da42',v:1,
    fg:['power_L','power_R','flap_switch','gear_handle','trim_wheel'],
    grab:['stick_L','stick_R'], blades:['prop'], direct:['stick_L','stick_R','pedal_L_l','pedal_L_r','pedal_R_l','pedal_R_r'],
    hide:['g.ctl[data-id="pwr"] .lv0','g.ctl[data-id="pwr"] .lv1','g.ctl[data-id="gear"] .mv','g.ctl[data-id="flaps"] .mv','g.ctl[data-id="trim"] .mv.wr'],
    drive(get,st,C){ const sx=st.stick?st.stick.x:0, sy=st.stick?st.stick.y:0, r=st.ctl?st.ctl.rud||0:0, n=v=>+v||0;
      const bl=i=>{ const e=st.eng&&st.eng[i], r=e?+e.rpm||0:0; return [r>250?1:0,r]; }, pw=p=>-Math.atan((854-(906-104*Math.max(0,Math.min(1,n(p)))))*0.00074/0.09)/D2R, fl=C.flap_switch.translate.positions, gr=C.gear_handle.translate.positions;
      return {stick_L:[0,sy*18,sx*17], stick_R:[0,sy*18,sx*17], power_L:[0,pw(get('pwrL'))], power_R:[0,pw(get('pwrR'))],
        flap_switch:[fl[['UP','APP','LDG'][n(get('flaps'))]]], gear_handle:[gr[n(get('gear'))?'DOWN':'UP']], trim_wheel:[0,n(get('trim'))*540],
        pedal_L_l:[0,r*16], pedal_L_r:[0,-r*16], pedal_R_l:[0,r*16], pedal_R_r:[0,-r*16], blade_L:bl(0), blade_R:bl(1)}; }},
  build(){
    const shell=toMesh(buildShell()); const sticks=[buildStick(-0.27),buildStick(0.27)];
    return {meshes:[shell,buildGlass(),...sticks],grab:sticks,
      anim(st){ const sx=st.stick?st.stick.x:0, sy=st.stick?st.stick.y:0; sticks.forEach(m=>{ m.rotation.set(sy*0.32,0,-sx*0.30,'XYZ'); }); return false; }};
  }
});
})(window);
