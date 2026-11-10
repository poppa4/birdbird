/* Birdbird – DA42 3D cockpit (beta). A low-poly cockpit shell with baked lighting, drawn by three.js on top of the
   otw.js outside world, and the real interactive SVG/HTML panel placed in 3D with a projective CSS matrix (so every
   switch, knob and lever is the live DOM control – no re-rasterising). Generic training model drawn by Birdbird.
   Cockpit frame: metres, x = right, y = up, z = aft (forward is −z), origin between the pilots at eye height. */
(function(G){
'use strict';
const D2R=Math.PI/180, THREE=G.THREE;
const D3={on:false,dragging:false};
G.DA42_3D=D3;

/* ---------- WebGL check ---------- */
D3.supported=function(){ try{ const c=document.createElement('canvas'); return !!(G.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl'))); }catch(e){ return false; } };
if(!THREE) return;

/* ---------- geometry constants ---------- */
const EYE=new THREE.Vector3(-0.27,0,0);           // left seat, pilot eye
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

/* ---------- mesh builder with baked lighting ---------- */
function Builder(){ this.P=[]; this.N=[]; this.C=[]; this.O=[]; }
Builder.prototype.tri=function(a,b,c,na,nb,nc,col,occ){ this.P.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z); this.N.push(na.x,na.y,na.z,nb.x,nb.y,nb.z,nc.x,nc.y,nc.z);
  for(let i=0;i<3;i++) this.C.push(col[0],col[1],col[2]); this.O.push(occ===false?0:1); };
const hex=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
// parametric grid: fn(u,v)->Vector3; normals from finite differences; orient: point the normals should face, or 'out' flag
Builder.prototype.grid=function(nu,nv,fn,col,o){ o=o||{}; const V=[], Nn=[], c=typeof col==='number'?hex(col):col;
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) V.push(fn(i/nu,j/nv));
  const at=(i,j)=>V[Math.max(0,Math.min(nv,j))*(nu+1)+Math.max(0,Math.min(nu,i))];
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++){ const du=new THREE.Vector3().subVectors(at(i+1,j),at(i-1,j)), dv=new THREE.Vector3().subVectors(at(i,j+1),at(i,j-1)); const n=new THREE.Vector3().crossVectors(du,dv); if(n.lengthSq()<1e-14) n.set(0,1,0); n.normalize(); if(o.flip) n.negate();
    if(o.toward){ const p=at(i,j); if(n.dot(new THREE.Vector3().subVectors(o.toward,p))<0) n.negate(); } Nn.push(n); }
  if(o.flat){ // one normal per quad (low-poly look)
  }
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const k=j*(nu+1)+i, a=k, b=k+1, cc=k+nu+1, d=k+nu+2;
    this.tri(V[a],V[b],V[d],Nn[a],Nn[b],Nn[d],c,o.occ); this.tri(V[a],V[d],V[cc],Nn[a],Nn[d],Nn[cc],c,o.occ); }
  return this; };
// superquadric (rounded box) with analytic normals, transformed by matrix m
Builder.prototype.sq=function(a,b,c,e,m,col,seg){ seg=seg||12; const nm=new THREE.Matrix3().getNormalMatrix(m), cc=typeof col==='number'?hex(col):col; const V=[],Nn=[]; const nu=seg*2, nv=seg;
  for(let j=0;j<=nv;j++){ const th=-Math.PI/2+j/nv*Math.PI; for(let i=0;i<=nu;i++){ const ph=-Math.PI+i/nu*2*Math.PI; const ct_=Math.cos(th), st=Math.sin(th), cp=Math.cos(ph), sn=Math.sin(ph);
    V.push(new THREE.Vector3(a*sp(ct_,e)*sp(cp,e),b*sp(st,e),c*sp(ct_,e)*sp(sn,e)).applyMatrix4(m));
    Nn.push(new THREE.Vector3(sp(ct_,2-e)*sp(cp,2-e)/a,sp(st,2-e)/b,sp(ct_,2-e)*sp(sn,2-e)/c).applyMatrix3(nm).normalize()); } }
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const k=j*(nu+1)+i, p=k+1, q=k+nu+1, r=k+nu+2; this.tri(V[k],V[r],V[p],Nn[k],Nn[r],Nn[p],cc); this.tri(V[k],V[q],V[r],Nn[k],Nn[q],Nn[r],cc); }
  return this; };
// any three.js geometry
Builder.prototype.geo=function(g,m,col,occ){ if(m) g.applyMatrix4(m); g=g.index?g.toNonIndexed():g; g.computeVertexNormals(); const p=g.attributes.position, n=g.attributes.normal, c=typeof col==='number'?hex(col):col;
  const v=i=>new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)), w=i=>new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i));
  for(let i=0;i<p.count;i+=3) this.tri(v(i),v(i+1),v(i+2),w(i),w(i+1),w(i+2),c,occ); return this; };
// box from centre/size with optional matrix (flat faces)
Builder.prototype.box=function(cx,cy,cz,sx,sy,sz,col,m){ const g=new THREE.BoxGeometry(sx,sy,sz); const t=new THREE.Matrix4().makeTranslation(cx,cy,cz); if(m) t.premultiply(m); return this.geo(g,t,col); };
// rectangular frame member swept along a path; inward(i) gives the inward direction, along = sweep direction width axis
Builder.prototype.member=function(pts,inward,axis,width,depth,col){ const c=hex(col), n=pts.length; const ring=[];
  for(let i=0;i<n;i++){ const p=pts[i], d=inward(i), h=axis.clone().multiplyScalar(width/2);
    ring.push([p.clone().sub(h),p.clone().add(h),p.clone().add(h).addScaledVector(d,depth),p.clone().sub(h).addScaledVector(d,depth)]); }
  const fn=[(i)=>inward(i).clone().negate(),(i)=>axis.clone(),(i)=>inward(i).clone(),(i)=>axis.clone().negate()];
  for(let i=0;i<n-1;i++) for(let f=0;f<4;f++){ const a=ring[i][f], b=ring[i][(f+1)%4], cc=ring[i+1][(f+1)%4], d=ring[i+1][f];
    const na=f===0?fn[0](i):f===1?fn[1](i):f===2?fn[2](i):fn[3](i), nb=f===0?fn[0](i+1):f===1?fn[1](i+1):f===2?fn[2](i+1):fn[3](i+1);
    // faces: 0 outer(towards canopy), 1 +axis side, 2 inner (visible), 3 −axis side; use averaged corner normals for a soft bevel look
    const nA=na.clone(), nB=nb.clone(); this.tri(a,b,cc,nA,nA,nB,c); this.tri(a,cc,d,nA,nB,nB,c); }
  return this; };

/* ---------- baked ambient occlusion (voxel sky visibility) + soft light ---------- */
function bake(B){
  const X0=-0.8,Y0=-1.15,Z0=-1.35, VS=0.035, NX=Math.ceil(1.6/VS), NY=Math.ceil(1.6/VS), NZ=Math.ceil(3.2/VS); const grid=new Uint8Array(NX*NY*NZ);
  const idx=(x,y,z)=>{ const i=Math.floor((x-X0)/VS), j=Math.floor((y-Y0)/VS), k=Math.floor((z-Z0)/VS); if(i<0||j<0||k<0||i>=NX||j>=NY||k>=NZ) return -1; return (k*NY+j)*NX+i; };
  const P=B.P, n=P.length/9; const a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3();
  for(let t=0;t<n;t++){ if(!B.O[t]) continue; a.fromArray(P,t*9); b.fromArray(P,t*9+3); c.fromArray(P,t*9+6);
    const L=Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a)), s=Math.max(1,Math.ceil(L/(VS*0.6)));
    for(let i=0;i<=s;i++) for(let j=0;j<=s-i;j++){ const u=i/s, v=j/s, w=1-u-v; const k=idx(a.x*w+b.x*u+c.x*v,a.y*w+b.y*u+c.y*v,a.z*w+b.z*u+c.z*v); if(k>=0) grid[k]=1; } }
  // fixed cosine-weighted hemisphere set
  const DIRS=[]; for(let i=0;i<18;i++){ const r=Math.sqrt((i+0.5)/18), ph=i*2.39996; DIRS.push([r*Math.cos(ph),Math.sqrt(1-r*r),r*Math.sin(ph)]); }
  const STEPS=[0.045,0.075,0.11,0.16,0.23,0.32,0.45];
  const sun=new THREE.Vector3(-0.35,1,-0.45).normalize(), sun2=new THREE.Vector3(0.5,0.6,0.2).normalize();
  const N=B.N, C=B.C, cache=new Map(), t1=new THREE.Vector3(), t2=new THREE.Vector3(), nn=new THREE.Vector3(), d=new THREE.Vector3();
  for(let v=0;v<P.length/3;v++){
    const px=P[v*3],py=P[v*3+1],pz=P[v*3+2]; nn.set(N[v*3],N[v*3+1],N[v*3+2]);
    const key=Math.round(px*400)+','+Math.round(py*400)+','+Math.round(pz*400)+','+Math.round(nn.x*8)+','+Math.round(nn.y*8)+','+Math.round(nn.z*8);
    let ao=cache.get(key);
    if(ao===undefined){
      // tangent frame
      t1.set(Math.abs(nn.y)<0.9?0:1,Math.abs(nn.y)<0.9?1:0,0).cross(nn).normalize(); t2.crossVectors(nn,t1);
      let occ=0;
      for(const q of DIRS){ d.set(0,0,0).addScaledVector(t1,q[0]).addScaledVector(nn,q[1]).addScaledVector(t2,q[2]);
        for(let s=0;s<STEPS.length;s++){ const r=STEPS[s]; const k=idx(px+nn.x*0.03+d.x*r,py+nn.y*0.03+d.y*r,pz+nn.z*0.03+d.z*r); if(k>=0&&grid[k]){ occ+=1-s/(STEPS.length+2); break; } } }
      ao=1-Math.min(1,occ/DIRS.length)*0.92; cache.set(key,ao);
    }
    const sky=0.42+0.38*Math.max(0,nn.y)+0.08*(1-Math.abs(nn.y));
    const dif=0.30*Math.max(0,nn.dot(sun))+0.12*Math.max(0,nn.dot(sun2));
    const k=Math.min(1.25,(sky*ao+dif*(0.35+0.65*ao)+0.05));
    C[v*3]=Math.min(1,C[v*3]*k); C[v*3+1]=Math.min(1,C[v*3+1]*k); C[v*3+2]=Math.min(1,C[v*3+2]*k);
  }
}
function toMesh(B,mat){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(B.P,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(B.C,3)); g.computeBoundingSphere(); return new THREE.Mesh(g,mat); }

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
function buildGlass(){
  const nu=40, nv=60, P=[], N=[]; const V=[];
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) V.push(canopy(ZF+0.005+j/nv*(ZR-ZF-0.01),-1+2*i/nu));
  const at=(i,j)=>V[Math.max(0,Math.min(nv,j))*(nu+1)+Math.max(0,Math.min(nu,i))];
  const nrm=(i,j)=>{ const du=new THREE.Vector3().subVectors(at(i+1,j),at(i-1,j)), dv=new THREE.Vector3().subVectors(at(i,j+1),at(i,j-1)); return new THREE.Vector3().crossVectors(du,dv).normalize(); };
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const q=[[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]]; for(const [a,b] of q){ const p=at(a,b), n=nrm(a,b); P.push(p.x,p.y,p.z); N.push(n.x,n.y,n.z); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vN=normalMatrix*normal; vP=position; gl_Position=projectionMatrix*mv; }',
    fragmentShader:'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f=1.0-abs(dot(normalize(vN),normalize(vV))); float top=smoothstep(0.16,0.28,vP.y)*smoothstep(-0.6,-0.2,vP.z)*(1.0-smoothstep(0.9,1.3,vP.z)); float a=0.025+0.20*pow(f,3.0)+0.16*top; vec3 c=mix(vec3(0.86,0.92,0.97),vec3(0.20,0.27,0.33),top); float streak=smoothstep(0.985,1.0,sin(vP.z*2.2+vP.x*1.4+vP.y*3.0)); a+=0.035*streak; gl_FragColor=vec4(c,a); }'});
  const mesh=new THREE.Mesh(g,m); mesh.renderOrder=5; return mesh;
}
function buildStick(xc){
  const B=new Builder();
  B.geo(new THREE.CylinderGeometry(0.010,0.012,0.36,10),new THREE.Matrix4().makeTranslation(0,0.18,0),0x34373b);
  B.sq(0.021,0.058,0.025,0.4,new THREE.Matrix4().makeRotationX(0.12).premultiply(new THREE.Matrix4().makeTranslation(0,0.40,0.004)),COL.black,10);
  B.box(-0.012,0.452,-0.004,0.012,0.008,0.012,COL.red); B.box(0.008,0.457,0.004,0.012,0.006,0.012,0x6a7077);
  // simple light (no AO): top light
  const n=B.N; for(let v=0;v<B.P.length/3;v++){ const k=0.55+0.4*Math.max(0,n[v*3+1])+0.25*Math.max(0,-n[v*3+2]*0.6+n[v*3]*-0.3); B.C[v*3]*=k; B.C[v*3+1]*=k; B.C[v*3+2]*=k; }
  const m=toMesh(B,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})); m.position.set(xc,YF+0.05,-0.42); return m;
}

/* ---------- state ---------- */
let o=null, scene=null, cam=null, glass=null, sticks=[], stage=null, world=null, W=0, H=0, matStr='';
const view={yaw:12,pitch:-16,zoom:1,vy:0,vp:0,glide:null};
const DEF={yaw:12,pitch:-16};
const qHead=new THREE.Quaternion(), eH=new THREE.Euler(0,0,0,'YXZ');
const A=new THREE.Matrix4().set(EX.x,EY.x,PN.x*PS,PO.x, EX.y,EY.y,PN.y*PS,PO.y, EX.z,EY.z,PN.z*PS,PO.z, 0,0,0,1);
const M=new THREE.Matrix4(), SC=new THREE.Matrix4();
let lastT=0, idle=0, needs=3, ft=[], qLevel=0, qWin=0, qSum=0, qN=0, toastShown=false, keysHeld=new Set(), scaleT=0, lastScale=0;
const mobile=matchMedia('(pointer:coarse)').matches;
const portrait=matchMedia('(orientation:portrait) and (max-width:900px)');
const DPRS=()=>{ const d=G.devicePixelRatio||1; return [Math.min(d,mobile?1.5:1.75),Math.min(d,1),Math.min(d,0.75)]; };

function baseFov(){ const asp=W/Math.max(1,H); let f=2*Math.atan(Math.tan(46*D2R)/asp)/D2R; return Math.max(50,Math.min(76,f)); }
function fov(){ return baseFov()*view.zoom; }

D3.init=function(opt){
  o=opt; stage=opt.stage; world=opt.world;
  scene=new THREE.Scene();
  const shell=toMesh(buildShell(),new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})); scene.add(shell);
  glass=buildGlass(); scene.add(glass);
  sticks=[buildStick(-0.27),buildStick(0.27)]; sticks.forEach(s=>scene.add(s));
  cam=new THREE.PerspectiveCamera(60,1,0.03,12); cam.position.copy(EYE); cam.rotation.order='YXZ';
  D3.on=true; stage.classList.add('d3');
  bindInput(); resize(); needs=3;
  return true;
};
function resize(){ if(!stage) return; W=stage.clientWidth; H=stage.clientHeight; needs=3; }
D3.resize=resize;

/* ---------- camera & panel transform ---------- */
function updCam(){ eH.set(view.pitch*D2R,-view.yaw*D2R,0,'YXZ'); qHead.setFromEuler(eH); cam.quaternion.copy(qHead); cam.fov=fov(); cam.aspect=W/Math.max(1,H); cam.near=0.03; cam.far=12; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); }
const CORN=[[0,0],[1600,0],[0,980],[1600,980]];
function placePanel(){
  SC.set(W/2,0,0,W/2, 0,-H/2,0,H/2, 0,0,0,0, 0,0,0,1);
  M.copy(SC).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse).multiply(A);
  const e=M.elements; e[2]=0; e[6]=0; e[10]=1; e[14]=0;
  // fully behind the eye or completely off-screen -> hide (saves compositing)
  let front=0, minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  for(const [u,v] of CORN){ const w=e[3]*u+e[7]*v+e[15]; if(w>0.02){ front++; const x=(e[0]*u+e[4]*v+e[12])/w, y=(e[1]*u+e[5]*v+e[13])/w; minx=Math.min(minx,x); maxx=Math.max(maxx,x); miny=Math.min(miny,y); maxy=Math.max(maxy,y); } }
  const hide=front===0||(front===4&&(maxx<0||minx>W||maxy<0||miny>H));
  const s=hide?'':'matrix3d('+Array.from(e,x=>+x.toFixed(6)).join(',')+')';
  if(hide!==world._hid){ world._hid=hide; world.style.visibility=hide?'hidden':''; }
  if(!hide&&s!==matStr){ matStr=s; world.style.transform=s; }
}
// panel units under a screen point (for the panel's own drag maths and for double-click)
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(), tmp=new THREE.Vector3();
function rayAt(cx,cy){ const r=stage.getBoundingClientRect(); ndc.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height*2-1)); ray.setFromCamera(ndc,cam); return ray.ray; }
D3.toWorld=function(e){ const rr=rayAt(e.clientX,e.clientY); const den=rr.direction.dot(PN); if(Math.abs(den)<1e-6) return {x:-1e4,y:-1e4};
  const t=tmp.subVectors(PO,rr.origin).dot(PN)/den; if(t<0) return {x:-1e4,y:-1e4}; const p=rr.at(t,new THREE.Vector3()).sub(PO); return {x:p.dot(EX)/(PS*PS),y:p.dot(EY)/(PS*PS)}; };
D3.project=function(u,v){ updCam(); const p=pp(u,v).project(cam); const r=stage.getBoundingClientRect(); return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height}; };
D3.scale=function(){ const pxPerRad=(H/2)/Math.tan(fov()*D2R/2); return pxPerRad*PS/0.82; };

/* ---------- looking around ---------- */
const clampV=()=>{ view.yaw=Math.max(-150,Math.min(150,view.yaw)); view.pitch=Math.max(-40,Math.min(60,view.pitch)); view.zoom=Math.max(0.3,Math.min(1.25,view.zoom)); };
D3.lookAhead=function(instant){ const short=H&&H<520; glideTo(short?10:DEF.yaw,short?-21:DEF.pitch,short?0.84:1,instant); }; // phones: a little closer and lower so the panel is usable
D3.lookAt=function(r,instant){ if(!r) return D3.lookAhead(instant);
  const c=pp(r[0]+r[2]/2,r[1]+r[3]/2).sub(EYE); const yaw=Math.atan2(c.x,-c.z)/D2R, pitch=Math.atan2(c.y,Math.hypot(c.x,c.z))/D2R, d=c.length();
  const angW=2*Math.atan(r[2]*PS/2/d), angH=2*Math.atan(r[3]*PS/2/d); const asp=W/Math.max(1,H);
  const need=Math.max(2*Math.atan(Math.tan(angW/2)/asp),angH)/D2R*1.14; glideTo(yaw,pitch,Math.max(0.3,Math.min(1,need/baseFov())),instant); };
function glideTo(y,p,z,instant){ if(instant){ view.yaw=y; view.pitch=p; view.zoom=z; view.glide=null; clampV(); needs=2; return; } view.glide={y,p,z}; view.vy=view.vp=0; needs=2; }
function stepView(dt){
  let moved=false;
  if(view.glide){ const k=1-Math.exp(-dt*7), g=view.glide; view.yaw+=(g.y-view.yaw)*k; view.pitch+=(g.p-view.pitch)*k; view.zoom+=(g.z-view.zoom)*k; moved=true;
    if(Math.abs(g.y-view.yaw)<0.05&&Math.abs(g.p-view.pitch)<0.05&&Math.abs(g.z-view.zoom)<0.002){ view.yaw=g.y; view.pitch=g.p; view.zoom=g.z; view.glide=null; } }
  if(!D3.dragging&&(Math.abs(view.vy)>0.5||Math.abs(view.vp)>0.5)){ view.yaw+=view.vy*dt; view.pitch+=view.vp*dt; const f=Math.exp(-dt*5); view.vy*=f; view.vp*=f; moved=true; }
  if(keysHeld.size){ const sp=70*(view.zoom); let ky=0,kp=0; keysHeld.forEach(k=>{ if(k==='L') ky-=1; if(k==='R') ky+=1; if(k==='U') kp+=1; if(k==='D') kp-=1; }); if(ky||kp){ view.yaw+=ky*sp*dt; view.pitch+=kp*sp*dt; view.glide=null; moved=true; } }
  clampV(); return moved;
}

/* ---------- input ---------- */
const ptrs=new Map(); let drag=null, pinch=null, stickDrag=null;
function bindInput(){
  stage.addEventListener('pointerdown',e=>{
    if(!D3.on||e.button>0) return;
    if(o.canLook&&!o.canLook(e)) return;
    // the 3D sticks: drag to fly, like the panel stick
    const rr=rayAt(e.clientX,e.clientY); ray.ray.copy(rr); const hit=ray.intersectObjects(sticks,false)[0];
    if(hit&&o.onStick){ stickDrag={x:e.clientX,y:e.clientY,id:e.pointerId}; try{ stage.setPointerCapture(e.pointerId); }catch(_){} o.onStick({x:0,y:0}); e.preventDefault(); return; }
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    try{ stage.setPointerCapture(e.pointerId); }catch(_){}
    if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:view.zoom}; drag=null; D3.dragging=true; return; }
    drag={x:e.clientX,y:e.clientY,t:performance.now(),moved:0}; view.glide=null; view.vy=view.vp=0; D3.dragging=true;
  });
  stage.addEventListener('pointermove',e=>{
    if(stickDrag&&e.pointerId===stickDrag.id){ o.onStick({x:Math.max(-1,Math.min(1,(e.clientX-stickDrag.x)/90)),y:Math.max(-1,Math.min(1,(e.clientY-stickDrag.y)/80))}); return; }
    if(!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&ptrs.size>=2){ const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); view.zoom=pinch.z*pinch.d/Math.max(20,d); clampV(); needs=2; return; }
    if(!drag) return; const now=performance.now(), dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.moved+=Math.abs(dx)+Math.abs(dy);
    const k=fov()/Math.max(1,H); // degrees per pixel
    view.yaw-=dx*k; view.pitch+=dy*k; clampV();
    const dt=Math.max(8,now-drag.t)/1000; view.vy=view.vy*0.6+(-dx*k/dt)*0.4; view.vp=view.vp*0.6+(dy*k/dt)*0.4;
    drag.x=e.clientX; drag.y=e.clientY; drag.t=now; needs=2;
  });
  const up=e=>{
    if(stickDrag&&e.pointerId===stickDrag.id){ stickDrag=null; o.onStick(null); return; }
    if(!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
    if(ptrs.size<2) pinch=null;
    if(ptrs.size===0){ if(drag&&performance.now()-drag.t>150){ view.vy=view.vp=0; } drag=null; D3.dragging=false; needs=2; }
  };
  stage.addEventListener('pointerup',up); stage.addEventListener('pointercancel',up);
  stage.addEventListener('wheel',e=>{ if(!D3.on) return; if(o.canLook&&!o.canLook(e)) return; e.preventDefault();
    const d=(e.deltaMode?e.deltaY*40:e.deltaY)*(e.ctrlKey?3:1); view.zoom*=Math.exp(d*0.0012); view.glide=null; clampV(); needs=2; },{passive:false});
  addEventListener('keyup',e=>{ const k=lookKey(e); if(k) keysHeld.delete(k); });
  addEventListener('blur',()=>keysHeld.clear());
  new ResizeObserver(resize).observe(stage);
}
function lookKey(e){ const c=e.code; if(c==='Numpad4'||c==='KeyU') return 'L'; if(c==='Numpad6'||c==='KeyO') return 'R'; if(c==='Numpad8'||c==='KeyI') return 'U'; if(c==='Numpad2'||c==='KeyM') return 'D'; return null; }
// called from the page's keydown handler (after its typing checks); returns true if it was a look key
D3.key=function(e){ if(!D3.on) return false; if(e.code==='Numpad5'||e.code==='KeyC'){ D3.lookAhead(); if(o.onAhead) o.onAhead(); e.preventDefault(); return true; }
  const k=lookKey(e); if(!k) return false; keysHeld.add(k); view.glide=null; e.preventDefault(); return true; };

/* ---------- per-frame ---------- */
D3.frame=function(S,st){
  if(!D3.on) return;
  const now=performance.now(), dt=lastT?Math.min(0.1,(now-lastT)/1000):0.016; lastT=now;
  if(!W||!H) resize();
  const moved=stepView(dt)||needs>0; if(needs>0) needs--;
  // stick animation
  const sx=st&&st.stick?st.stick.x:0, sy=st&&st.stick?st.stick.y:0;
  sticks.forEach(m=>{ m.rotation.set(sy*0.32,0,-sx*0.30,'XYZ'); });
  const active=st&&st.active;
  if(portrait.matches) return; // the page shows 'rotate your device' over the stage
  if(!moved&&!active&&!D3.dragging){ idle+=dt; if(idle>0.4){ return; } } else idle=0;
  updCam(); placePanel();
  const ok=G.OTW.render3d(S,qHead,cam.fov,DPRS()[qLevel],(R)=>{ R.render(scene,cam); });
  // scale for crisp PFD/MFD (debounced)
  const s=D3.scale(); if(Math.abs(s-lastScale)/Math.max(0.01,lastScale)>0.12){ scaleT+=dt; if(scaleT>0.35&&!D3.dragging&&!view.glide){ scaleT=0; lastScale=s; o.onScale&&o.onScale(s); } } else scaleT=0;
  // auto quality: frame interval while rendering
  if(ok&&dt>0){ qSum+=dt; qN++; qWin+=dt; if(qWin>2){ const avg=qSum/qN*1000; D3.ft=avg; qWin=qSum=qN=0;
    if(avg>21&&qLevel<2){ qLevel++; needs=2; } else if(avg>26&&qLevel===2&&!toastShown){ toastShown=true; o.onSlow&&o.onSlow(); } } }
};
// test helper: synchronous timing of n frames with glFinish, with and without the cockpit pass
D3.bench=function(S,n){ const R=G.OTW.renderer(), gl=R.getContext(); updCam(); const run=(ck)=>{ gl.finish(); const t=performance.now(); for(let i=0;i<n;i++){ R.info.reset(); G.OTW.render3d(S,qHead,cam.fov,DPRS()[qLevel],ck?(R)=>{ R.render(scene,cam); }:null); } gl.finish(); return (performance.now()-t)/n; };
  R.info.autoReset=false; const w=run(false), c=run(true); const info={calls:R.info.render.calls,tris:R.info.render.triangles}; R.info.autoReset=true; return {worldOnly:+w.toFixed(2),worldPlusCockpit:+c.toFixed(2),lastFrame:info,px:[R.domElement.width,R.domElement.height]}; };
D3.cockpitInfo=()=>({tris:scene.children.reduce((a,m)=>a+(m.geometry.attributes.position.count/3),0),meshes:scene.children.length});
D3.quality=()=>({level:qLevel,dpr:DPRS()[qLevel],ft:D3.ft||0});
D3.view=view; D3.setView=function(y,p,z){ view.yaw=y; view.pitch=p; if(z) view.zoom=z; view.glide=null; view.vy=view.vp=0; clampV(); needs=3; };
D3.wake=()=>{ needs=3; };
})(window);
