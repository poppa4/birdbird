/* Birdbird – shared 3D cockpit engine (beta). The cockpit (the Blender-built glTF model in models/, see "glTF cockpit" below; a
   procedural low-poly shell with baked lighting if the model cannot be loaded) is drawn by three.js on top of the
   otw.js outside world, and the page's real interactive SVG/HTML panel is placed in 3D with a projective CSS matrix, so every
   switch, knob and lever stays the live DOM control (no re-rasterising). Parts of the panel drawing can be lifted onto their own
   planes (side consoles, pedestal, upper panel): they stay inside the panel's DOM (same event handlers), placed with a 2D
   homography relative to the panel, so no preserve-3d context is needed. Things that sit in front of the panel (control wheels,
   levers) are drawn on a transparent foreground canvas above it.
   Per aircraft: a definition object (eye, panel mount, geometry builder, glb model and its controls, views) passed to CK3D.make(def).
   Cockpit frame: metres, x = right, y = up, z = aft (forward is −z), origin on the centre line at eye height. */
(function(G){
'use strict';
const D2R=Math.PI/180, THREE=G.THREE;
const CK={};
G.CK3D=CK;

/* ---------- WebGL check ---------- */
CK.supported=function(){ try{ const c=document.createElement('canvas'); return !!(G.WebGLRenderingContext&&(c.getContext('webgl')||c.getContext('experimental-webgl'))); }catch(e){ return false; } };
if(!THREE) return;
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const sm=t=>{ t=Math.max(0,Math.min(1,t)); return t*t*(3-2*t); };
const sp=(w,e)=>Math.sign(w)*Math.pow(Math.abs(w),e);
const hex=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];

/* ---------- mesh builder with baked lighting ---------- */
function Builder(){ this.P=[]; this.N=[]; this.C=[]; this.O=[]; }
Builder.prototype.tri=function(a,b,c,na,nb,nc,col,occ){ this.P.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z); this.N.push(na.x,na.y,na.z,nb.x,nb.y,nb.z,nc.x,nc.y,nc.z);
  for(let i=0;i<3;i++) this.C.push(col[0],col[1],col[2]); this.O.push(occ===false?0:1); };
// parametric grid: fn(u,v)->Vector3; normals from finite differences; o.toward: point the normals should face
Builder.prototype.grid=function(nu,nv,fn,col,o){ o=o||{}; const V=[], Nn=[], c=typeof col==='number'?hex(col):col;
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) V.push(fn(i/nu,j/nv));
  const at=(i,j)=>V[Math.max(0,Math.min(nv,j))*(nu+1)+Math.max(0,Math.min(nu,i))];
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++){ const du=new THREE.Vector3().subVectors(at(i+1,j),at(i-1,j)), dv=new THREE.Vector3().subVectors(at(i,j+1),at(i,j-1)); const n=new THREE.Vector3().crossVectors(du,dv); if(n.lengthSq()<1e-14) n.set(0,1,0); n.normalize(); if(o.flip) n.negate();
    if(o.toward){ const p=at(i,j); if(n.dot(new THREE.Vector3().subVectors(o.toward,p))<0) n.negate(); } Nn.push(n); }
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
// cylinder between two points
Builder.prototype.rod=function(a,b,r0,r1,col,seg){ const d=new THREE.Vector3().subVectors(b,a), L=d.length(); const g=new THREE.CylinderGeometry(r1,r0,L,seg||10,1);
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()); const m=new THREE.Matrix4().compose(a.clone().addScaledVector(d,0.5),q,new THREE.Vector3(1,1,1)); return this.geo(g,m,col); };
// rectangular frame member swept along a path; inward(i) gives the inward direction, axis = width direction
Builder.prototype.member=function(pts,inward,axis,width,depth,col){ const c=hex(col), n=pts.length; const ring=[];
  for(let i=0;i<n;i++){ const p=pts[i], d=inward(i), h=axis.clone().multiplyScalar(width/2);
    ring.push([p.clone().sub(h),p.clone().add(h),p.clone().add(h).addScaledVector(d,depth),p.clone().sub(h).addScaledVector(d,depth)]); }
  const fn=[(i)=>inward(i).clone().negate(),(i)=>axis.clone(),(i)=>inward(i).clone(),(i)=>axis.clone().negate()];
  for(let i=0;i<n-1;i++) for(let f=0;f<4;f++){ const a=ring[i][f], b=ring[i][(f+1)%4], cc=ring[i+1][(f+1)%4], d=ring[i+1][f];
    const na=fn[f](i), nb=fn[f](i+1);
    this.tri(a,b,cc,na,na,nb,c); this.tri(a,cc,d,na,nb,nb,c); }
  return this; };
// a frame member along a 3D polyline whose cross-section is oriented by a fixed "up" hint
Builder.prototype.bar=function(pts,width,depth,col,hint){ hint=hint||new THREE.Vector3(0,0,1); const n=pts.length;
  const tan=i=>new THREE.Vector3().subVectors(pts[Math.min(n-1,i+1)],pts[Math.max(0,i-1)]).normalize();
  const ax=i=>new THREE.Vector3().crossVectors(tan(i),hint).normalize(); const inw=i=>new THREE.Vector3().crossVectors(ax(i),tan(i)).normalize();
  const c=hex(col);
  for(let i=0;i<n-1;i++){ const A=[pts[i],pts[i+1]], X=[ax(i),ax(i+1)], Y=[inw(i),inw(i+1)];
    const q=(k,s,t)=>A[k].clone().addScaledVector(X[k],s*width/2).addScaledVector(Y[k],t*depth/2);
    const faces=[[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]],[[-1,-1],[1,-1]]];
    for(const [[s0,t0],[s1,t1]] of faces){ const a=q(0,s0,t0), b=q(0,s1,t1), cc=q(1,s1,t1), d=q(1,s0,t0);
      const nA=X[0].clone().multiplyScalar((s0+s1)/2).addScaledVector(Y[0],(t0+t1)/2).normalize(), nB=X[1].clone().multiplyScalar((s0+s1)/2).addScaledVector(Y[1],(t0+t1)/2).normalize();
      this.tri(a,b,cc,nA,nA,nB,c); this.tri(a,cc,d,nA,nB,nB,c); } }
  return this; };

/* ---------- baked ambient occlusion (voxel sky visibility) + soft light ---------- */
function bake(B,box){
  box=box||[-0.8,-1.15,-1.35,0.8,0.45,1.85];
  const X0=box[0],Y0=box[1],Z0=box[2], VS=0.035, NX=Math.ceil((box[3]-box[0])/VS), NY=Math.ceil((box[4]-box[1])/VS), NZ=Math.ceil((box[5]-box[2])/VS); const grid=new Uint8Array(NX*NY*NZ);
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
// simple light (no AO) for small moving parts
function lite(B){ const n=B.N; for(let v=0;v<B.P.length/3;v++){ const k=0.55+0.4*Math.max(0,n[v*3+1])+0.25*Math.max(0,-n[v*3+2]*0.6+n[v*3]*-0.3); B.C[v*3]*=k; B.C[v*3+1]*=k; B.C[v*3+2]*=k; } return B; }
function toMesh(B,mat){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(B.P,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(B.C,3)); g.computeBoundingSphere();
  return new THREE.Mesh(g,mat||new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})); }
// transparent glazing over a parametric surface fn(u,v) (u across, v along); top(): tinted band
function glass(fn,nu,nv,tint){
  const P=[], N=[]; const V=[];
  for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) V.push(fn(i/nu,j/nv));
  const at=(i,j)=>V[Math.max(0,Math.min(nv,j))*(nu+1)+Math.max(0,Math.min(nu,i))];
  const nrm=(i,j)=>{ const du=new THREE.Vector3().subVectors(at(i+1,j),at(i-1,j)), dv=new THREE.Vector3().subVectors(at(i,j+1),at(i,j-1)); return new THREE.Vector3().crossVectors(du,dv).normalize(); };
  for(let j=0;j<nv;j++) for(let i=0;i<nu;i++){ const q=[[i,j],[i+1,j],[i+1,j+1],[i,j],[i+1,j+1],[i,j+1]]; for(const [a,b] of q){ const p=at(a,b), n=nrm(a,b); P.push(p.x,p.y,p.z); N.push(n.x,n.y,n.z); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
  const mesh=new THREE.Mesh(g,glassMat(tint)); mesh.renderOrder=5; return mesh;
}
/* glazing shader: faint fresnel sheen, a tinted band along the top (T: y and z ramps in the cockpit frame), rare streaks */
function glassMat(tint){ const T=tint||{y0:0.16,y1:0.28,z0:-0.6,z1:-0.2,z2:0.9,z3:1.3};
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vV=-mv.xyz; vN=normalMatrix*normal; vP=position; gl_Position=projectionMatrix*mv; }',
    fragmentShader:'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f=1.0-abs(dot(normalize(vN),normalize(vV))); float top=smoothstep('+T.y0.toFixed(3)+','+T.y1.toFixed(3)+',vP.y)*smoothstep('+T.z0.toFixed(3)+','+T.z1.toFixed(3)+',vP.z)*(1.0-smoothstep('+T.z2.toFixed(3)+','+T.z3.toFixed(3)+',vP.z)); float a=0.025+0.20*pow(f,3.0)+0.16*top; vec3 c=mix(vec3(0.86,0.92,0.97),vec3(0.20,0.27,0.33),top); float streak=smoothstep(0.985,1.0,sin(vP.z*2.2+vP.x*1.4+vP.y*3.0)); a+=0.035*streak; gl_FragColor=vec4(c,a); }'}); }
Object.assign(CK,{Builder,bake,lite,toMesh,glass,glassMat,hex,sm,sp,V3});

/* ---------- glTF cockpit (models/<ac>-cockpit.glb with its .json sidecar, built in Blender) ----------
   Loaded after the page is up (the loader scripts too); until then a small progress card, and if it fails (or is very slow)
   the procedural cockpit above. The model is re-packed for speed, once, at load:
   - every mesh is baked into the cockpit frame and merged by texture set: about ten draw calls in all;
   - the moving controls stay in those merged meshes: each vertex carries a control index and a small matrix array moves it in
     the vertex shader (pivot, axes and travel from the sidecar);
   - what can never be seen from the eye (which turns but does not move) is dropped: two thirds of the triangles;
   - lighting is baked into the vertices, so the material is unlit: per pixel one texture read (ambient occlusion) and no
     colour-space maths. The tiling tint textures (leather, carpet grain) go into the vertex colours as their mean colour:
     a second texture read per pixel cost a tenth of the frame on a software renderer for a grain barely seen at cockpit
     distance (def.glb.detail:true draws them);
   - controls in front of the live panel are drawn on the foreground canvas over the DOM panel, each cut off behind its plane.
   Low tier (governor level 2 and below): one mesh per pass, ambient occlusion and the tint textures in its vertex colours. */
const scriptP={};
function loadScript(src){ return scriptP[src]||(scriptP[src]=new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=ok; s.onerror=()=>no(new Error('script '+src)); document.head.appendChild(s); })); }
function fetchBuf(url,onp){ return fetch(url).then(r=>{ if(!r.ok) throw new Error(url+' '+r.status); const n=+r.headers.get('content-length')||0;
  if(!r.body||!r.body.getReader||!n) return r.arrayBuffer(); const rd=r.body.getReader(), parts=[]; let got=0;
  const pump=()=>rd.read().then(({done,value})=>{ if(done){ const b=new Uint8Array(got); let k=0; for(const p of parts){ b.set(p,k); k+=p.length; } return b.buffer; } parts.push(value); got+=value.length; onp(Math.min(1,got/n)); return pump(); });
  return pump(); }); }
CK.loadGLB=function(cfg,onp){
  const base=cfg.base||'', v='?v='+(cfg.v||1);
  return Promise.all([fetchBuf(base+'models/'+cfg.id+'-cockpit.glb'+v,onp), fetch(base+'models/'+cfg.id+'-cockpit.json'+v).then(r=>{ if(!r.ok) throw new Error('sidecar '+r.status); return r.json(); }),
    loadScript(base+'vendor/three-r128/GLTFLoader.js?v=1').then(()=>loadScript(base+'vendor/three-r128/meshopt_decoder.js?v=1')).then(()=>G.MeshoptDecoder.ready)])
  .then(([buf,side])=>new Promise((ok,no)=>{ const L=new THREE.GLTFLoader(); L.setMeshoptDecoder(G.MeshoptDecoder); L.parse(buf,'',g=>ok({gltf:g,side}),no); })); };
// attribute value i, component c, as float (r128 does not denormalise normalized integer attributes itself)
const DIV=a=>{ const ar=(a.isInterleavedBufferAttribute?a.data.array:a.array); return !a.normalized?1:ar instanceof Int8Array?127:ar instanceof Uint8Array?255:ar instanceof Int16Array?32767:ar instanceof Uint16Array?65535:1; };
const GET=['getX','getY','getZ','getW'];
function attrF(a,i,c,d){ const v=a[GET[c]](i)/d; return a.normalized?Math.max(-1,v):v; }
/* re-pack the loaded model. Returns {units, byName, groups:{main, fg}, glass, faces} with merged accumulators keyed by texture
   set. cfg.fg: control nodes drawn in the foreground pass; unit 0 is the static cockpit. */
function packGLB(gltf,side,cfg){
  const root=gltf.scene; root.updateMatrixWorld(true);
  const C=side.controls||{}, units=[{name:'',fg:false}], byName={};
  const addUnit=(name,info)=>{ const n=root.getObjectByName(name); if(!n) return; const p=new THREE.Vector3().setFromMatrixPosition(n.matrixWorld);
    byName[name]=units.length; units.push(Object.assign({name,pivot:p,fg:(cfg.fg||[]).includes(name),grab:(cfg.grab||[]).includes(name),min:new THREE.Vector3(1e9,1e9,1e9),max:new THREE.Vector3(-1e9,-1e9,-1e9)},info)); };
  const ax=a=>a?new THREE.Vector3(...a).normalize():null;
  for(const k in C){ const c=C[k];
    if(c.children){ for(const ch in c.children) addUnit(ch,{tAx:null,rAx:ax(c.children[ch].axis||(c.rotate&&c.rotate.axis)),rAx2:null,maxRot:c.rotate?Math.max(Math.abs(c.rotate.min||0),Math.abs(c.rotate.max||0)):90,range:[[0,0],c.rotate?[c.rotate.min||0,c.rotate.max||0]:[0,0],[0,0]]}); continue; }
    const rr=o=>{ if(!o) return 0; const v=[o.min,o.max].concat(o.positions?Object.values(o.positions):[]).filter(x=>typeof x==='number').map(Math.abs); return v.length?Math.max(...v):90; };
    const rg=o=>{ if(!o) return [0,0]; const v=[o.min,o.max].concat(o.positions?Object.values(o.positions):[]).filter(x=>typeof x==='number'); return v.length?[Math.min(0,...v),Math.max(0,...v)]:[0,0]; };
    addUnit(k,{tAx:ax(c.translate&&c.translate.axis),rAx:ax((c.rotate||c.rotate_pitch||{}).axis),rAx2:ax(c.rotate_roll&&c.rotate_roll.axis),maxRot:Math.min(90,rr(c.rotate||c.rotate_pitch)+rr(c.rotate_roll)),
      range:[rg(c.translate),rg(c.rotate||c.rotate_pitch),rg(c.rotate_roll)]}); }
  // propeller blades outside (cfg.blades: material names): their own unit per side, hidden once the propeller turns fast
  const blades={}; if(cfg.blades) for(const sd of ['L','R']){ const nm='blade_'+sd; byName[nm]=units.length; blades[sd]=units.length; units.push({name:nm,blade:true,pivot:new THREE.Vector3(),fg:false,grab:false,min:new THREE.Vector3(1e9,1e9,1e9),max:new THREE.Vector3(-1e9,-1e9,-1e9)}); }
  const unitOf=o=>{ for(let p=o;p;p=p.parent){ if(p.name in byName) return byName[p.name]; } return 0; };
  const under=(o,re)=>{ for(let p=o;p;p=p.parent) if(re.test(p.name||'')) return p.name; return null; };
  const groups={main:new Map(),fg:new Map()}, glassAcc=acc(), faceAcc=acc(), texId=new Map();
  const tid=t=>{ if(!t) return 0; const k=t.image||t; if(!texId.has(k)) texId.set(k,texId.size+1); return texId.get(k); };
  const v3=new THREE.Vector3(), n3=new THREE.Vector3(), nm=new THREE.Matrix3(), tintCache=new Map();
  root.traverse(o=>{ if(!o.isMesh) return;
    const m=o.material, g=o.geometry, P=g.attributes.position, Nn=g.attributes.normal, U0=g.attributes.uv, U1=g.attributes.uv2;
    if(cfg.noExterior&&under(o,/^exterior$/)) return;
    const face=under(o,/_face$/), isGlass=!face&&(m.transparent||under(o,/^glass/)); let u=face||isGlass?0:unitOf(o);
    if(!u&&cfg.blades&&cfg.blades.includes(m.name)){ if(!g.boundingSphere) g.computeBoundingSphere(); u=blades[g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld).x<0?'L':'R']; }
    const U=units[u];
    let A;
    if(isGlass) A=glassAcc;
    else if(face) A=faceAcc;
    else { const map=cfg.detail?m.map:null, ao=m.aoMap&&U1?m.aoMap:null; const key=tid(map)+'|'+tid(ao), sc=U.fg?'fg':'main';
      A=groups[sc].get(key); if(!A){ A=acc(); A.map=map; A.aoMap=ao; groups[sc].set(key,A); } }
    const mw=o.matrixWorld, flip=mw.determinant()<0, base=A.n, dP=DIV(P), dN=Nn?DIV(Nn):1, d0=U0?DIV(U0):1, d1=U1?DIV(U1):1; nm.getNormalMatrix(mw);
    const col=(m.color||new THREE.Color(1,1,1)).clone(), rough=m.roughness!==undefined?m.roughness:0.6, metal=m.metalness||0;
    if(!cfg.detail&&m.map&&!face&&!isGlass){ const t=meanLin(m.map,tintCache); col.r*=t[0]; col.g*=t[1]; col.b*=t[2]; } // the tint texture's mean colour
    for(let i=0;i<P.count;i++){ v3.set(attrF(P,i,0,dP),attrF(P,i,1,dP),attrF(P,i,2,dP)).applyMatrix4(mw); A.pos.push(v3.x,v3.y,v3.z);
      if(u){ U.min.min(v3); U.max.max(v3); }
      if(Nn){ n3.set(attrF(Nn,i,0,dN),attrF(Nn,i,1,dN),attrF(Nn,i,2,dN)).applyMatrix3(nm).normalize(); } else n3.set(0,1,0); A.nor.push(n3.x,n3.y,n3.z);
      A.uv.push(U0?attrF(U0,i,0,d0):0,U0?attrF(U0,i,1,d0):0); A.uv2.push(U1?attrF(U1,i,0,d1):0,U1?attrF(U1,i,1,d1):0);
      A.col.push(col.r,col.g,col.b); A.rmn.push(rough,metal,0); A.ctl.push(u); }
    A.n+=P.count;
    if(U.grab){ const T=U.tri||(U.tri={pos:[],idx:[],n:0}), b0=T.n; for(let i=0;i<P.count;i++){ T.pos.push(A.pos[(base+i)*3],A.pos[(base+i)*3+1],A.pos[(base+i)*3+2]); } T.n+=P.count;
      if(g.index){ const I=g.index; for(let i=0;i<I.count;i++) T.idx.push(I.getX(i)+b0); } else for(let i=0;i<P.count;i++) T.idx.push(b0+i); }
    if(g.index){ const I=g.index; for(let i=0;i<I.count;i+=3){ const a=I.getX(i)+base, b=I.getX(i+1)+base, c=I.getX(i+2)+base; if(flip) A.idx.push(a,c,b); else A.idx.push(a,b,c); } }
    else for(let i=0;i<P.count;i+=3){ if(flip) A.idx.push(base+i,base+i+2,base+i+1); else A.idx.push(base+i,base+i+1,base+i+2); }
  });
  units.forEach(u=>{ if(u.blade&&u.min.x<=u.max.x) u.pivot.addVectors(u.min,u.max).multiplyScalar(0.5); });
  // typed arrays from here on (the low tier is built from these later, on demand)
  const fin=A=>{ for(const k of ['pos','nor','uv','uv2','col','rmn','ctl']) A[k]=new Float32Array(A[k]); A.idx=new Uint32Array(A.idx); };
  groups.main.forEach(fin); groups.fg.forEach(fin);
  return {units,byName,groups,glass:glassAcc,faces:faceAcc};
}
function acc(){ return {pos:[],nor:[],uv:[],uv2:[],col:[],rmn:[],ctl:[],idx:[],n:0}; }
function accGeo(A,full){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(A.pos,3));
  if(full!==false){ g.setAttribute('color',new THREE.Float32BufferAttribute(A.lit||A.col,3)); g.setAttribute('ctl',new THREE.Float32BufferAttribute(A.ctl,1));
    if(full==='hq'){ g.setAttribute('spec',new THREE.Float32BufferAttribute(A.spec,3)); if(A.map) g.setAttribute('uv',new THREE.Float32BufferAttribute(A.uv,2)); if(A.aoMap) g.setAttribute('uv2',new THREE.Float32BufferAttribute(A.uv2,2)); } }
  else if(A.nor.length) g.setAttribute('normal',new THREE.Float32BufferAttribute(A.nor,3));
  g.setIndex(A.n>65535?new THREE.Uint32BufferAttribute(A.idx,1):new THREE.Uint16BufferAttribute(A.idx,1)); g.computeBoundingSphere(); return g; }
/* Static visibility from the eye. The eye turns but never moves, so a triangle of the fixed cockpit that cannot be seen from
   the eye point in any direction (backs of seats and panels, the inside of the nose, skin under the floor, everything behind
   the live panel planes) is never drawn. At load the static triangles are drawn once into the six faces of a cube around the
   eye, each in its own colour, single-sided as in the real pass, with the panel planes as occluders; the moving controls are
   left out (they neither hide anything nor are culled). Triangles that showed up are kept, with every triangle sharing a vertex
   with one (so slivers too thin for the sampling stay). Returns the number of triangles removed. */
function pvsCull(groups,occ,eye,res){
  const R=G.OTW&&G.OTW.renderer&&G.OTW.renderer(); if(!R) return 0;
  const tris=[]; groups.forEach(A=>{ for(let t=0;t<A.idx.length;t+=3){ const a=A.idx[t], b=A.idx[t+1], c=A.idx[t+2]; if(A.ctl[a]||A.ctl[b]||A.ctl[c]) continue; tris.push(A,t); } });
  const n=tris.length/2; if(!n||n>=16777215) return 0;
  const P=new Float32Array(n*9), C=new Uint8Array(n*9); let k=0;
  for(let i=0;i<n;i++){ const A=tris[i*2], t=tris[i*2+1], id=i+1, r=id&255, g=(id>>8)&255, b=(id>>16)&255;
    for(let j=0;j<3;j++){ const v=A.idx[t+j]; P[k*3]=A.pos[v*3]; P[k*3+1]=A.pos[v*3+1]; P[k*3+2]=A.pos[v*3+2]; C[k*3]=r; C[k*3+1]=g; C[k*3+2]=b; k++; } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(P,3)); g.setAttribute('color',new THREE.BufferAttribute(C,3,true));
  const vs='attribute vec3 color; varying vec3 vC; void main(){ vC=color; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
  const mat=new THREE.ShaderMaterial({vertexShader:vs,fragmentShader:'varying vec3 vC; void main(){ gl_FragColor=vec4(vC,1.0); }'});
  const og=new THREE.BufferGeometry(); og.setAttribute('position',new THREE.Float32BufferAttribute(occ.pos,3)); og.setIndex(Array.from(occ.idx));
  const omat=new THREE.ShaderMaterial({vertexShader:'void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:'void main(){ gl_FragColor=vec4(0.0,0.0,0.0,1.0); }',side:THREE.DoubleSide});
  const sc=new THREE.Scene(), m1=new THREE.Mesh(g,mat), m2=new THREE.Mesh(og,omat); m1.frustumCulled=m2.frustumCulled=false; sc.add(m2); sc.add(m1);
  const rt=new THREE.WebGLRenderTarget(res,res,{depthBuffer:true,stencilBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,generateMipmaps:false});
  const cam=new THREE.PerspectiveCamera(90,1,0.03,40); cam.position.copy(eye);
  const prevRT=R.getRenderTarget(), prevAC=R.autoClear, cc=new THREE.Color(), ca=R.getClearAlpha(); R.getClearColor(cc);
  const buf=new Uint8Array(res*res*4), seen=new Uint8Array(n+1);
  try{ R.setClearColor(0x000000,1); R.autoClear=true;
    for(const [d,u] of [[[1,0,0],[0,1,0]],[[-1,0,0],[0,1,0]],[[0,1,0],[0,0,1]],[[0,-1,0],[0,0,-1]],[[0,0,1],[0,1,0]],[[0,0,-1],[0,1,0]]]){
      cam.up.set(u[0],u[1],u[2]); cam.lookAt(eye.x+d[0],eye.y+d[1],eye.z+d[2]); cam.updateMatrixWorld(true);
      R.setRenderTarget(rt); R.render(sc,cam); R.readRenderTargetPixels(rt,0,0,res,res,buf);
      for(let i=0;i<buf.length;i+=4){ const id=buf[i]|(buf[i+1]<<8)|(buf[i+2]<<16); if(id&&id<=n) seen[id]=1; } } }
  finally{ R.setRenderTarget(prevRT); R.autoClear=prevAC; R.setClearColor(cc,ca); rt.dispose(); g.dispose(); og.dispose(); mat.dispose(); omat.dispose(); }
  /* keep what was seen, and those of its neighbours that face the eye (back faces are never drawn from a fixed eye) and are
     small enough to have slipped between the samples (a few sample pixels); controls untouched */
  let removed=0; const keepV=new Map(), small=8*Math.pow(Math.PI/2/res,2);
  for(let i=0;i<n;i++) if(seen[i+1]){ const A=tris[i*2], t=tris[i*2+1]; let s=keepV.get(A); if(!s){ s=new Uint8Array(A.n); keepV.set(A,s); } s[A.idx[t]]=s[A.idx[t+1]]=s[A.idx[t+2]]=1; }
  const isSeen=new Map(); for(let i=0;i<n;i++) if(seen[i+1]){ const A=tris[i*2]; let q=isSeen.get(A); if(!q){ q=new Set(); isSeen.set(A,q); } q.add(tris[i*2+1]); }
  groups.forEach(A=>{ const s=keepV.get(A)||new Uint8Array(A.n), q=isSeen.get(A)||new Set(), out=[]; for(let t=0;t<A.idx.length;t+=3){ const a=A.idx[t], b=A.idx[t+1], c=A.idx[t+2];
      if(A.ctl[a]||A.ctl[b]||A.ctl[c]||q.has(t)||((s[a]||s[b]||s[c])&&facing(A,a,b,c,eye)>-0.02&&solid(A,a,b,c,eye)<small)) out.push(a,b,c); else removed++; } A.idx=new Uint32Array(out); });
  pvsCull.stat={static:n,seen:seen.reduce((x,y)=>x+y,0),removed}; return removed; }
// solid angle (sr, small-angle) a triangle covers from the eye
function solid(A,a,b,c,eye){ const P=A.pos, ux=P[b*3]-P[a*3], uy=P[b*3+1]-P[a*3+1], uz=P[b*3+2]-P[a*3+2], vx=P[c*3]-P[a*3], vy=P[c*3+1]-P[a*3+1], vz=P[c*3+2]-P[a*3+2];
  const ar=0.5*Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx), ex=(P[a*3]+P[b*3]+P[c*3])/3-eye.x, ey=(P[a*3+1]+P[b*3+1]+P[c*3+1])/3-eye.y, ez=(P[a*3+2]+P[b*3+2]+P[c*3+2])/3-eye.z;
  return ar/Math.max(1e-6,ex*ex+ey*ey+ez*ez); }
// cosine between a triangle's front normal (counter-clockwise) and the direction to the eye
function facing(A,a,b,c,eye){ const P=A.pos, ax=P[a*3], ay=P[a*3+1], az=P[a*3+2], ux=P[b*3]-ax, uy=P[b*3+1]-ay, uz=P[b*3+2]-az, vx=P[c*3]-ax, vy=P[c*3+1]-ay, vz=P[c*3+2]-az;
  const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx, nl=Math.hypot(nx,ny,nz); if(nl<1e-14) return -1;
  const ex=eye.x-(ax+P[b*3]+P[c*3])/3, ey=eye.y-(ay+P[b*3+1]+P[c*3+1])/3, ez=eye.z-(az+P[b*3+2]+P[c*3+2])/3, el=Math.hypot(ex,ey,ez)||1; return (nx*ex+ny*ey+nz*ez)/(nl*el); }
/* matrix of a control unit for values c = [travel m, angle°, angle°] (pivot, axes from the sidecar) */
const _pv=new THREE.Vector3(), _R1=new THREE.Matrix4(), _R2=new THREE.Matrix4(), _Tb=new THREE.Matrix4();
function unitMatrix(u,c,M){ _pv.copy(u.pivot); if(u.tAx) _pv.addScaledVector(u.tAx,c[0]||0);
  M.makeTranslation(_pv.x,_pv.y,_pv.z); if(u.rAx&&c[1]) M.multiply(_R1.makeRotationAxis(u.rAx,c[1]*D2R)); if(u.rAx2&&c[2]) M.multiply(_R2.makeRotationAxis(u.rAx2,c[2]*D2R));
  return M.multiply(_Tb.makeTranslation(-u.pivot.x,-u.pivot.y,-u.pivot.z)); }
/* the same for the controls with a limited travel: their triangles are drawn, with an id each, in the rest pose and at the ends
   of their travel (all at once), behind the static cockpit and the panel planes drawn in black; triangles never seen in any
   of those poses are not drawn (a control behind the pedestal, the pedals under the panel). Controls that turn far (trim
   wheels, selectors) and the propellers are left alone. */
function pvsControls(ctlGroups,staticGroups,occ,units,eye,res){
  const R=G.OTW&&G.OTW.renderer&&G.OTW.renderer(); if(!R) return 0;
  const ok=u=>u&&u.range&&!u.blade&&(u.maxRot||0)<=60, tris=[];
  ctlGroups.forEach(A=>{ for(let t=0;t<A.idx.length;t+=3){ const u=A.ctl[A.idx[t]]; if(u&&ok(units[u])&&A.ctl[A.idx[t+1]]===u&&A.ctl[A.idx[t+2]]===u) tris.push(A,t); } });
  const n=tris.length/2; if(!n) return 0;
  // black: static triangles (single-sided, as drawn) and the panel planes
  const bp=[]; staticGroups.forEach(A=>{ for(let t=0;t<A.idx.length;t+=3){ if(A.ctl[A.idx[t]]||A.ctl[A.idx[t+1]]||A.ctl[A.idx[t+2]]) continue; for(let j=0;j<3;j++){ const v=A.idx[t+j]; bp.push(A.pos[v*3],A.pos[v*3+1],A.pos[v*3+2]); } } });
  const op=[]; for(let j=0;j<occ.idx.length;j++){ const v=occ.idx[j]; op.push(occ.pos[v*3],occ.pos[v*3+1],occ.pos[v*3+2]); }
  const mk=(P,side,fs,col)=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); if(col) g.setAttribute('color',new THREE.BufferAttribute(col,3,true));
    const m=new THREE.Mesh(g,new THREE.ShaderMaterial({side,vertexShader:(col?'attribute vec3 color; varying vec3 vC; ':'')+'void main(){ '+(col?'vC=color; ':'')+'gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:fs})); m.frustumCulled=false; return m; };
  const black='void main(){ gl_FragColor=vec4(0.0,0.0,0.0,1.0); }';
  const sc=new THREE.Scene(); sc.add(mk(bp,THREE.FrontSide,black)); sc.add(mk(op,THREE.DoubleSide,black));
  const C=new Uint8Array(n*9), P=new Float32Array(n*9);
  for(let i=0;i<n;i++){ const id=i+1; for(let j=0;j<3;j++){ C[i*9+j*3]=id&255; C[i*9+j*3+1]=(id>>8)&255; C[i*9+j*3+2]=(id>>16)&255; } }
  const cm=mk(P,THREE.FrontSide,'varying vec3 vC; void main(){ gl_FragColor=vec4(vC,1.0); }',C); sc.add(cm);
  const rt=new THREE.WebGLRenderTarget(res,res,{depthBuffer:true,stencilBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,generateMipmaps:false});
  const cam=new THREE.PerspectiveCamera(90,1,0.03,40); cam.position.copy(eye);
  const prevRT=R.getRenderTarget(), prevAC=R.autoClear, cc=new THREE.Color(), ca=R.getClearAlpha(); R.getClearColor(cc);
  const buf=new Uint8Array(res*res*4), seen=new Uint8Array(n+1), M=new THREE.Matrix4(), v=new THREE.Vector3();
  const poses=[u=>[0,0,0],u=>u.range.map(r=>r[0]),u=>u.range.map(r=>r[1]),u=>[u.range[0][0],u.range[1][1],u.range[2][0]],u=>[u.range[0][1],u.range[1][0],u.range[2][1]]];
  try{ R.setClearColor(0x000000,1); R.autoClear=true;
    for(const pose of poses){ const mats=units.map(u=>ok(u)?unitMatrix(u,pose(u),new THREE.Matrix4()):null), pa=cm.geometry.attributes.position;
      for(let i=0;i<n;i++){ const A=tris[i*2], t=tris[i*2+1], Mu=mats[A.ctl[A.idx[t]]]; for(let j=0;j<3;j++){ const q=A.idx[t+j]; v.set(A.pos[q*3],A.pos[q*3+1],A.pos[q*3+2]).applyMatrix4(Mu); pa.array[i*9+j*3]=v.x; pa.array[i*9+j*3+1]=v.y; pa.array[i*9+j*3+2]=v.z; } }
      pa.needsUpdate=true;
      for(const [d,u] of [[[1,0,0],[0,1,0]],[[-1,0,0],[0,1,0]],[[0,1,0],[0,0,1]],[[0,-1,0],[0,0,-1]],[[0,0,1],[0,1,0]],[[0,0,-1],[0,1,0]]]){
        cam.up.set(u[0],u[1],u[2]); cam.lookAt(eye.x+d[0],eye.y+d[1],eye.z+d[2]); cam.updateMatrixWorld(true);
        R.setRenderTarget(rt); R.render(sc,cam); R.readRenderTargetPixels(rt,0,0,res,res,buf);
        for(let i=0;i<buf.length;i+=4){ const id=buf[i]|(buf[i+1]<<8)|(buf[i+2]<<16); if(id&&id<=n) seen[id]=1; } } } }
  finally{ R.setRenderTarget(prevRT); R.autoClear=prevAC; R.setClearColor(cc,ca); rt.dispose(); sc.children.forEach(m=>{ m.geometry.dispose(); m.material.dispose(); }); }
  // keep the seen triangles and their small neighbours (shared vertex), as above
  const keepV=new Map(), isSeen=new Map(), small=8*Math.pow(Math.PI/2/res,2); let removed=0;
  for(let i=0;i<n;i++) if(seen[i+1]){ const A=tris[i*2], t=tris[i*2+1]; let s=keepV.get(A); if(!s){ s=new Uint8Array(A.n); keepV.set(A,s); } s[A.idx[t]]=s[A.idx[t+1]]=s[A.idx[t+2]]=1; let q=isSeen.get(A); if(!q){ q=new Set(); isSeen.set(A,q); } q.add(t); }
  const cand=new Map(); for(let i=0;i<n;i++){ const A=tris[i*2]; let q=cand.get(A); if(!q){ q=new Set(); cand.set(A,q); } q.add(tris[i*2+1]); }
  ctlGroups.forEach(A=>{ const c=cand.get(A); if(!c) return; const s=keepV.get(A)||new Uint8Array(A.n), q=isSeen.get(A)||new Set(), out=[];
    for(let t=0;t<A.idx.length;t+=3){ const a=A.idx[t], b=A.idx[t+1], d=A.idx[t+2]; if(!c.has(t)||q.has(t)||((s[a]||s[b]||s[d])&&solid(A,a,b,d,eye)<small)) out.push(a,b,d); else removed++; } A.idx=new Uint32Array(out); });
  return removed; }
/* the controls: triangles facing away from the eye over the control's whole travel are never drawn either. A rotation by up to
   θ turns a face by at most θ, so a triangle stays a back face while its facing cosine is below −sin(θ + 8°) */
function cullControlBacks(groups,units,eye){ let removed=0;
  groups.forEach(A=>{ const out=[]; for(let t=0;t<A.idx.length;t+=3){ const a=A.idx[t], b=A.idx[t+1], c=A.idx[t+2], u=units[A.ctl[a]];
      if(u&&u.maxRot!=null&&A.ctl[b]===A.ctl[a]&&A.ctl[c]===A.ctl[a]&&facing(A,a,b,c,eye)< -Math.sin(Math.min(89,u.maxRot+8)*D2R)){ removed++; continue; } out.push(a,b,c); } A.idx=new Uint32Array(out); });
  return removed; }
/* the glazing with its sheen baked per vertex (the eye does not move): the same fresnel and top tint as glassMat, no texture
   and no per-pixel maths */
function glassBaked(A,eye,tint){ const T=tint||{y0:0.16,y1:0.28,z0:-0.6,z1:-0.2,z2:0.9,z3:1.3}, n=A.n, C=new Float32Array(n*4), ss=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
  for(let i=0;i<n;i++){ const px=A.pos[i*3], py=A.pos[i*3+1], pz=A.pos[i*3+2]; let vx=eye.x-px, vy=eye.y-py, vz=eye.z-pz; const l=Math.hypot(vx,vy,vz)||1;
    const f=1-Math.abs((A.nor[i*3]*vx+A.nor[i*3+1]*vy+A.nor[i*3+2]*vz)/l), top=ss(T.y0,T.y1,py)*ss(T.z0,T.z1,pz)*(1-ss(T.z2,T.z3,pz));
    C[i*4]=0.86+(0.20-0.86)*top; C[i*4+1]=0.92+(0.27-0.92)*top; C[i*4+2]=0.97+(0.33-0.97)*top; C[i*4+3]=0.025+0.20*f*f*f+0.16*top; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(A.pos,3)); g.setAttribute('gc',new THREE.BufferAttribute(C,4)); g.setIndex(A.n>65535?new THREE.Uint32BufferAttribute(A.idx,1):new THREE.Uint16BufferAttribute(A.idx,1));
  const m=new THREE.Mesh(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:'attribute vec4 gc; varying vec4 vC; void main(){ vC=gc; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:'varying vec4 vC; void main(){ gl_FragColor=vC; }'}));
  m.renderOrder=5; m.frustumCulled=false; m.matrixAutoUpdate=false; return m; }
/* Shading in display (sRGB) values, like the outside world in this renderer: no sRGB decode per texel and no encode per pixel
   (each is a pow per channel, a large part of the cost on a software renderer). A product of colours encodes as the product
   of the encoded colours (sRGB is close to a power law), so the lit vertex colour, the tint texture and the occlusion are each
   encoded once (vertices and the occlusion map at load; the tint textures are already sRGB), and the gloss is added as the
   difference it makes on the encoded mean colour of the group. */
const AOK=1.25; // occlusion a little deeper than the bake: the cabin is lit through its windows only
const enc=x=>x<=0.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-0.055, dec=x=>x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4);
function toDisplay(A,cache){ const n=A.n, m=A.map?meanLin(A.map,cache):[1,1,1];
  for(let i=0;i<n*3;i++){ const c=i%3, l=A.lit[i], s=A.spec[i], lg=enc(Math.min(1,l)); A.lit[i]=lg; A.spec[i]=Math.max(0,enc(Math.min(1,l*m[c]+s))-enc(Math.min(1,l*m[c]))); }
  if(A.map){ A.map.encoding=THREE.LinearEncoding; A.map.minFilter=THREE.LinearMipmapNearestFilter; A.map.needsUpdate=true; }
  if(A.aoMap){ if(!cache.has(A.aoMap)) cache.set(A.aoMap,aoDisplay(A.aoMap)); A.aoMap=cache.get(A.aoMap); } }
function meanLin(t,cache){ const k='m'+t.uuid; if(!cache.has(k)){ const d=texPixels(t,16); let r=0,g=0,b=0; if(d){ for(let i=0;i<d.length;i+=4){ r+=dec(d[i]/255); g+=dec(d[i+1]/255); b+=dec(d[i+2]/255); } const n=d.length/4; cache.set(k,[r/n,g/n,b/n]); } else cache.set(k,[1,1,1]); } return cache.get(k); }
function aoDisplay(t){ const im=t.image; if(!im||!im.width) return t; try{ const w=im.width, h=im.height, c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.drawImage(im,0,0); const d=x.getImageData(0,0,w,h), p=d.data, lut=new Uint8Array(256);
    for(let i=0;i<256;i++) lut[i]=Math.round(enc(Math.pow(i/255,AOK))*255); for(let i=0;i<p.length;i+=4){ const v=lut[p[i]]; p[i]=p[i+1]=p[i+2]=v; } x.putImageData(d,0,0);
    const T=new THREE.CanvasTexture(c); T.flipY=t.flipY; T.wrapS=t.wrapS; T.wrapT=t.wrapT; T.minFilter=THREE.LinearMipmapNearestFilter; T.magFilter=THREE.LinearFilter; T.encoding=THREE.LinearEncoding; return T; }catch(e){ return t; } }
/* near triangles first (the eye is fixed): what is behind them then fails the depth test before it is shaded */
function sortNear(A,eye){ const nt=A.idx.length/3, d=new Float32Array(nt), o=new Uint32Array(nt);
  for(let t=0;t<nt;t++){ let s=0; for(let j=0;j<3;j++){ const v=A.idx[t*3+j]; const x=A.pos[v*3]-eye.x, y=A.pos[v*3+1]-eye.y, z=A.pos[v*3+2]-eye.z; s+=x*x+y*y+z*z; } d[t]=s; o[t]=t; }
  o.sort((a,b)=>d[a]-d[b]); const I=new Uint32Array(A.idx.length); for(let t=0;t<nt;t++){ const q=o[t]*3; I[t*3]=A.idx[q]; I[t*3+1]=A.idx[q+1]; I[t*3+2]=A.idx[q+2]; } A.idx=I; }
/* Lighting is baked into the vertices once, at load: the cockpit's lights are fixed in the cockpit frame and the eye only
   turns, never moves, so even the view-dependent gloss is constant per vertex (the moving controls keep their rest-pose
   light, which is not noticeable over their small travel). Sky and floor bounce (hemisphere), the sun, a Blinn-Phong
   highlight and a sky/floor reflection from roughness and metalness, scaled like three's standard material.
   The material is then three's unlit MeshBasic: per pixel only the ambient occlusion map (and the tint texture with
   def.glb.detail), plus the control matrices in the vertex shader and the gloss added after the occlusion. */
const LIGHT={sky:new THREE.Color(0xdfeaff),gnd:new THREE.Color(0x5a5246),sun:new THREE.Color(0xfff4e0),dir:new THREE.Vector3(-0.35,1,-0.45).normalize()};
// outside (the airframe: the parts without an occlusion map) a little less light than inside, so a white wing in the sun keeps
// its shape instead of clipping to flat white next to the outside world
function bakeLight(A,eye,cfg){ const out=!A.aoMap, n=A.n, lit=new Float32Array(n*3), sp=new Float32Array(n*3), hi=out?0.65:cfg.hemi||1.0, si=out?0.5:cfg.sun||0.95, L=LIGHT.dir, aoD=out?0:cfg.dirAO!=null?cfg.dirAO:0.85;
  const S=LIGHT.sky, Gd=LIGHT.gnd, Sn=LIGHT.sun;
  for(let i=0;i<n;i++){ const nx=A.nor[i*3], ny=A.nor[i*3+1], nz=A.nor[i*3+2]; let vx=eye.x-A.pos[i*3], vy=eye.y-A.pos[i*3+1], vz=eye.z-A.pos[i*3+2]; const vl=Math.hypot(vx,vy,vz)||1; vx/=vl; vy/=vl; vz/=vl;
    const r=A.col[i*3], g=A.col[i*3+1], b=A.col[i*3+2], rg=Math.max(0.08,Math.min(1,A.rmn[i*3])), mt=A.rmn[i*3+1];
    const hw=ny*0.5+0.5, nl=Math.max(0,nx*L.x+ny*L.y+nz*L.z)*(1-0.5*aoD); // the sun reaches into the cabin only partly (no shadows)
    const kd=1-0.85*mt;
    lit[i*3]=r*kd*(hi*(Gd.r+(S.r-Gd.r)*hw)+si*Sn.r*nl); lit[i*3+1]=g*kd*(hi*(Gd.g+(S.g-Gd.g)*hw)+si*Sn.g*nl); lit[i*3+2]=b*kd*(hi*(Gd.b+(S.b-Gd.b)*hw)+si*Sn.b*nl);
    const f0r=0.04+(r-0.04)*mt, f0g=0.04+(g-0.04)*mt, f0b=0.04+(b-0.04)*mt, sh=Math.min(1024,Math.max(1,2/(rg*rg*rg*rg)-2));
    let hx=L.x+vx, hy=L.y+vy, hz=L.z+vz; const hl=Math.hypot(hx,hy,hz)||1; const nh=Math.max(0,(nx*hx+ny*hy+nz*hz)/hl);
    const ks=si*Math.pow(nh,sh)*(sh+2)/8*nl; const dv=nx*vx+ny*vy+nz*vz, ry=2*dv*ny-vy, up=ry*0.5+0.5, ke=hi*(1-0.75*rg);
    sp[i*3]=f0r*(Sn.r*ks+ke*(Gd.r+(S.r-Gd.r)*up)); sp[i*3+1]=f0g*(Sn.g*ks+ke*(Gd.g+(S.g-Gd.g)*up)); sp[i*3+2]=f0b*(Sn.b*ks+ke*(Gd.b+(S.b-Gd.b)*up)); }
  A.lit=lit; A.spec=sp; }
function ckMat(lo,A,U,N,cut){
  const m=new THREE.MeshBasicMaterial({vertexColors:true,map:lo?null:A.map||null,aoMap:lo?null:A.aoMap||null});
  m.onBeforeCompile=sh=>{ sh.uniforms.uCtl=U.uCtl; if(cut) sh.uniforms.uPl=U.uPl;
    sh.vertexShader='attribute float ctl;\nuniform mat4 uCtl['+N+'];\n'+(cut?'uniform vec4 uPl['+N+'];\nvarying float vPd;\n':'')+(lo?'':'attribute vec3 spec;\nvarying vec3 vSpec;\n')+sh.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\n\tint ci=int(ctl+0.5);\n\ttransformed=(uCtl[ci]*vec4(transformed,1.0)).xyz;'+(cut?'\n\tvPd=dot(uPl[ci].xyz,transformed)+uPl[ci].w;':'')+(lo?'':'\n\tvSpec=spec;'));
    if(cut) sh.fragmentShader='varying float vPd;\n'+sh.fragmentShader.replace('void main() {','void main() {\n\tif(vPd>0.0) discard;');
    if(!lo) sh.fragmentShader='varying vec3 vSpec;\n'+sh.fragmentShader
      .replace('#include <aomap_fragment>','float sAO=1.0;\n'+THREE.ShaderChunk.aomap_fragment.replace('reflectedLight.indirectDiffuse *= ambientOcclusion;','reflectedLight.indirectDiffuse *= ambientOcclusion; sAO=ambientOcclusion;'))
      .replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;','vec3 outgoingLight = reflectedLight.indirectDiffuse + vSpec*sAO;'); };
  m.customProgramCacheKey=()=>'ck3d'+N+(lo?'L':'H')+(cut?'c':''); return m; }
/* low tier: one geometry for a pass, the tint texture's mean colour and the ambient occlusion folded into the vertex colours
   (all display values, as above) */
function texPixels(t,w){ const im=t&&t.image; if(!im) return null; try{ const c=document.createElement('canvas'); c.width=c.height=w; const x=c.getContext('2d'); x.drawImage(im,0,0,w,w); return x.getImageData(0,0,w,w).data; }catch(e){ return null; } }
function loAcc(list){ const out=acc(), cache=new Map();
  for(const A of list){ let mean=[1,1,1]; if(A.map){ if(!cache.has(A.map)){ const d=texPixels(A.map,16); let r=0,g=0,b=0; if(d){ for(let i=0;i<d.length;i+=4){ r+=d[i]/255; g+=d[i+1]/255; b+=d[i+2]/255; } const n=d.length/4; cache.set(A.map,[r/n,g/n,b/n]); } else cache.set(A.map,[1,1,1]); } mean=cache.get(A.map); }
    let ao=null, aw=256; if(A.aoMap){ if(!cache.has(A.aoMap)) cache.set(A.aoMap,texPixels(A.aoMap,aw)); ao=cache.get(A.aoMap); }
    const base=out.n; for(const x of A.pos) out.pos.push(x); for(const x of A.nor) out.nor.push(x); for(const x of A.ctl) out.ctl.push(x);
    for(let i=0;i<A.n;i++){ let k=1; if(ao){ const x=Math.min(aw-1,Math.max(0,Math.floor(A.uv2[i*2]*aw))), y=Math.min(aw-1,Math.max(0,Math.floor(A.uv2[i*2+1]*aw))); k=ao[(y*aw+x)*4]/255; }
      out.col.push((A.lit[i*3]*mean[0]+A.spec[i*3])*k,(A.lit[i*3+1]*mean[1]+A.spec[i*3+1])*k,(A.lit[i*3+2]*mean[2]+A.spec[i*3+2])*k); }
    for(const j of A.idx) out.idx.push(j+base); out.n+=A.n; }
  out.lit=out.col; return out; }

/* ---------- shared CSS (sub-planes, foreground canvas, view bar) ---------- */
let cssDone=false;
function css(){ if(cssDone) return; cssDone=true; const s=document.createElement('style'); s.textContent=
  '.stage.d3 .psvg text{text-rendering:geometricPrecision}.d3sub{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;will-change:transform}.d3sub>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.d3sub>svg>*{pointer-events:visiblePainted}'+
  '.stage>canvas.d3fg{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:block}'+
  '.d3v{position:absolute;left:10px;bottom:10px;z-index:8;display:flex;gap:4px;flex-wrap:wrap-reverse;max-width:max(160px,calc(50% - 190px));pointer-events:none}'+
  '.d3v button{pointer-events:auto;font:600 11.5px/1 system-ui,sans-serif;color:#dfe7ee;background:rgba(14,17,20,.78);border:1px solid rgba(255,255,255,.16);border-radius:7px;padding:6px 9px;cursor:pointer}'+
  '.d3v button:hover{border-color:rgba(255,255,255,.4)}.d3v button.on{background:#ffcf3a;color:#0d1319;border-color:#ffcf3a}'+
  '@media (max-height:520px){.d3v{bottom:6px;left:6px;gap:3px}.d3v button{padding:5px 7px;font-size:10.5px}}'+
  '.d3ld{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:8;pointer-events:none;min-width:190px;background:rgba(14,17,20,.84);border:1px solid rgba(255,255,255,.14);border-radius:9px;padding:9px 13px 10px;color:#dfe7ee;font:600 12px/1.2 system-ui,sans-serif;letter-spacing:.01em;transition:opacity .35s;box-shadow:0 6px 20px rgba(0,0,0,.35)}'+
  '.stage>.d3veil{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,rgba(11,13,16,0) 0,rgba(11,13,16,0) 34%,rgba(11,13,16,.88) 48%,#0b0d10 70%);transition:opacity .5s}'+
  '.d3ld i{display:block;height:3px;margin-top:8px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden}.d3ld b{display:block;height:100%;width:0;background:#ffcf3a;transition:width .25s}';
  document.head.appendChild(s); }

/* ---------- one cockpit per page ---------- */
CK.make=function(def){
const D3={on:false,dragging:false,supported:CK.supported,def};
const EYE=V3(...def.eye);
const PNL=def.panel, PS=PNL.ps, TILT=(PNL.tilt||0)*D2R, PW=PNL.w, PH=PNL.h;
const EX=V3(PS,0,0), EY=V3(0,-PS*Math.cos(TILT),PS*Math.sin(TILT));
const PN=new THREE.Vector3().crossVectors(EX,EY).normalize(); // into the panel (away from pilot)
const PO=PNL.o?V3(...PNL.o):V3(...PNL.at[2]).addScaledVector(EX,-PNL.at[0]).addScaledVector(EY,-PNL.at[1]); // panel unit (0,0)
const pp=(u,v,o)=>new THREE.Vector3().copy(PO).addScaledVector(EX,u).addScaledVector(EY,v).addScaledVector(PN,o||0);
const K={THREE,D2R,EYE,EX,EY,PN,PO,PS,PW,PH,pp,Builder,bake,lite,toMesh,glass,hex,sm,sp,V3};
// upper outline of a drawn path (panel units): n samples between u0 and u1, the smallest v found near each
K.topEdge=function(sel,u0,u1,n,fb){ const out=[]; for(let i=0;i<=n;i++) out.push([u0+(u1-u0)*i/n,Infinity]);
  try{ const p=K.svg&&K.svg.querySelector(sel); if(p&&p.getTotalLength){ const L=p.getTotalLength(), st=(u1-u0)/n; for(let s=0;s<=L;s+=2){ const q=p.getPointAtLength(s); const i=Math.round((q.x-u0)/st); if(i>=0&&i<=n&&Math.abs(q.x-out[i][0])<st*0.75) out[i][1]=Math.min(out[i][1],q.y); } } }catch(e){}
  out.forEach(o=>{ if(!isFinite(o[1])) o[1]=fb?fb(o[0]):0; }); return out; };
// planes: the panel plus optional sub-planes lifted out of the panel drawing
const MAIN={id:'main',O:PO,EX,EY,PN,ps:PS,rect:[0,0,PW,PH],el:null};
const PLANES=[MAIN];
(def.subs||[]).forEach(s=>{ const ps=s.ps||PS, e=new THREE.Euler((s.pitch||0)*D2R,(s.yaw||0)*D2R,(s.roll||0)*D2R,'YXZ'), q=new THREE.Quaternion().setFromEuler(e);
  const ex=V3(1,0,0).applyQuaternion(q).multiplyScalar(ps), ey=V3(0,-1,0).applyQuaternion(q).multiplyScalar(ps), pn=new THREE.Vector3().crossVectors(ex,ey).normalize();
  const r=s.rect, cu=r[0]+r[2]/2, cv=r[1]+r[3]/2; const O=V3(...s.pos).addScaledVector(ex,-cu).addScaledVector(ey,-cv);
  PLANES.push({id:s.id,O,EX:ex,EY:ey,PN:pn,ps,rect:r,sel:s.sel,skip:s.skip,el:null,hid:null,str:''}); });
const planeAt=(u,v)=>{ for(let i=1;i<PLANES.length;i++){ const r=PLANES[i].rect; if(u>=r[0]&&u<=r[0]+r[2]&&v>=r[1]&&v<=r[1]+r[3]) return PLANES[i]; } return MAIN; };
const pAt=(pl,u,v)=>new THREE.Vector3().copy(pl.O).addScaledVector(pl.EX,u).addScaledVector(pl.EY,v);
K.planeAt=planeAt; K.pAt=pAt; K.PLANES=PLANES;

/* ---------- state ---------- */
let o=null, scene=null, fgScene=null, fgR=null, fgCv=null, fgDirty=true, cam=null, built={}, grabs=[], fgGrabs=[], stage=null, world=null, W=0, H=0, matStr='', ready=false, bar=null;
const AHEAD=def.views.ahead, SHORT=def.views.short||def.views.ahead;
const view={yaw:AHEAD[0],pitch:AHEAD[1],zoom:1,vy:0,vp:0,glide:null};
const LIM=Object.assign({yaw:[-150,150],pitch:[-40,60]},def.limits||{});
const qHead=new THREE.Quaternion(), eH=new THREE.Euler(0,0,0,'YXZ');
const A=new THREE.Matrix4().set(EX.x,EY.x,PN.x*PS,PO.x, EX.y,EY.y,PN.y*PS,PO.y, EX.z,EY.z,PN.z*PS,PO.z, 0,0,0,1);
const M=new THREE.Matrix4(), SC=new THREE.Matrix4(), MS=new THREE.Matrix4(), AS=new THREE.Matrix4(), HM=new THREE.Matrix3(), HS=new THREE.Matrix3();
const lastV=[0,0,0]; let frz=false, stillT=0, lastT=0, idle=0, needs=3, qLevel=0, qWin=0, qSum=0, qN=0, toastShown=false, keysHeld=new Set(), scaleT=0, lastScale=0, lastR=0, t0=0, snapK='panel';
const mobile=matchMedia('(pointer:coarse)').matches;
const portrait=matchMedia('(orientation:portrait) and (max-width:900px)');
/* frame governor: level 0 full rate at up to 1.5 (phones) / 1.75 device pixels; 1: 1 pixel; 2: 30 Hz; 3: 20 Hz at 0.75 pixel;
   4: 15 Hz at 0.75 pixel. It steps down while the average frame interval stays over 21 ms (2 s windows), never back up. */
const LV=[[0,0],[1,0],[1,1/30],[0.75,1/20],[0.75,1/15]];
const dprNow=()=>{ const d=G.devicePixelRatio||1, l=LV[qLevel]; let r=l[0]?Math.min(d,l[0]):Math.min(d,mobile?1.5:1.75); const ol=(G.OTW&&G.OTW.lvl)||0; if(ol) r=Math.min(r,ol===2?0.75:1); return r; };
D3.levels=LV;

function baseFov(){ const asp=W/Math.max(1,H); let f=2*Math.atan(Math.tan((def.fovH||46)*D2R)/asp)/D2R; return Math.max(50,Math.min(def.fovMax||76,f)); }
function fov(){ return baseFov()*view.zoom; }

/* the cockpit in the scenes: a procedural build (def.build) or the glTF model (glbBuild) */
let glbOn=false, procObj=null, ldEl=null; const GI={main:0,fg:0};
function ensureFg(){ if(fgR||fgCv) return; fgCv=document.createElement('canvas'); fgCv.className='d3fg'; fgCv.setAttribute('aria-hidden','true');
  const wl=world.parentNode; wl.parentNode.insertBefore(fgCv,wl.nextSibling);
  try{ fgR=new THREE.WebGLRenderer({canvas:fgCv,alpha:true,antialias:true,premultipliedAlpha:true}); fgR.setClearColor(0x000000,0); }catch(e){ fgR=null; fgCv.remove(); fgCv=null; } fgDirty=true; }
function useBuilt(b){ built=b;
  (b.meshes||[]).forEach(m=>scene.add(m)); (b.fg||[]).forEach(m=>fgScene.add(m));
  grabs=b.grab||[]; fgGrabs=grabs.filter(m=>(b.fg||[]).includes(m)); grabs=grabs.filter(m=>!fgGrabs.includes(m));
  if(fgScene.children.length) ensureFg(); needs=3; fgDirty=true; }
function dropBuilt(b){ (b.meshes||[]).forEach(m=>scene.remove(m)); (b.fg||[]).forEach(m=>fgScene.remove(m)); }
function buildProc(){ if(!procObj){ procObj=def.build(K)||{}; } return procObj; }
/* while the model loads: a progress card, and a dark veil over the outside view below the windshield line (between the world
   canvas and the live panel), so the panel does not float in the sky; the veil goes as soon as any cockpit is drawn */
let veil=null;
function unveil(){ if(veil){ const e=veil; veil=null; e.style.opacity='0'; setTimeout(()=>e.remove(),500); } }
function loading(p){ if(p===null){ unveil(); if(ldEl){ const e=ldEl; ldEl=null; e.style.opacity='0'; setTimeout(()=>e.remove(),400); } return; }
  if(!veil&&!built.meshes){ veil=document.createElement('div'); veil.className='d3veil'; const wl=world.parentNode; wl.parentNode.insertBefore(veil,wl); }
  if(!ldEl){ const T=o.T||(s=>s); ldEl=document.createElement('div'); ldEl.className='d3ld'; ldEl.setAttribute('role','status'); ldEl.innerHTML=`<span>${T('Loading 3D cockpit')}</span><i><b></b></i>`; stage.appendChild(ldEl); }
  ldEl.querySelector('b').style.width=Math.round(p*100)+'%'; }
D3.glb={state:def.glb?'loading':'none',progress:0,ms:0};
function startGLB(){ const cfg=def.glb, t0=performance.now(); loading(0);
  // very slow network: the procedural cockpit meanwhile, swapped out when the model arrives
  const slow=setTimeout(()=>{ if(D3.glb.state==='loading'){ D3.glb.state='loading-proc'; useBuilt(buildProc()); unveil(); } },cfg.slowMs||6000);
  CK.loadGLB(cfg,p=>{ D3.glb.progress=p; loading(p*0.85); }).then(({gltf,side})=>glbBuild(packGLB(gltf,side,cfg),side)).then(b=>{ clearTimeout(slow);
    if(built===procObj&&procObj) dropBuilt(procObj);
    glbOn=true; useBuilt(b); D3.glb.state='ready'; D3.glb.ms=Math.round(performance.now()-t0); loading(null);
    stage.classList.add('d3glb'); hideCss();
  }).catch(e=>{ clearTimeout(slow); console.warn('3D cockpit model: using the built-in cockpit',e); D3.glb.state='failed'; loading(null); if(built!==procObj) useBuilt(buildProc()); }); }
function hideCss(){ const h=def.glb.hide||[]; if(!h.length) return; const s=document.createElement('style');
  s.textContent=h.map(x=>`.stage.d3glb ${x},.stage.d3glb ${x} *`).join(',')+'{fill-opacity:0!important;stroke-opacity:0!important}'; document.head.appendChild(s); }
/* the glTF cockpit: merged meshes for the two passes (and the low tier), the control matrices, the grab proxies. In steps with
   a pause between them, so the page stays responsive while it is put together */
const pause=()=>new Promise(r=>setTimeout(r,0));
async function glbBuild(pk,side){ loading(0.9); await pause();
  const cfg=def.glb, N=pk.units.length, U={uCtl:{value:pk.units.map(()=>new THREE.Matrix4())}};
  const mk=(A,lo,cut)=>{ const m=new THREE.Mesh(accGeo(A,lo?true:'hq'),ckMat(lo,A,U,N,cut)); m.frustumCulled=false; m.matrixAutoUpdate=false; return m; };
  // the panel planes: dark matte backing in the main pass (seen through gaps of the drawing and when a plane is parked)
  const F=pk.faces, fc=new THREE.Color(cfg.face||0x0b0c0e);
  for(let i=0;i<F.n;i++){ F.col[i*3]=fc.r; F.col[i*3+1]=fc.g; F.col[i*3+2]=fc.b; F.rmn[i*3]=0.8; F.rmn[i*3+1]=0; F.rmn[i*3+2]=1; F.ctl[i]=0; }
  const back=new THREE.Mesh(accGeo(F,false),new THREE.MeshBasicMaterial({color:fc,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-4})); back.renderOrder=-1; back.frustumCulled=false; back.matrixAutoUpdate=false;
  // the panel planes as occluders for the visibility passes: the face meshes plus sub-planes the model has no face for
  const O=acc(); { for(const x of F.pos) O.pos.push(x); for(const j of F.idx) O.idx.push(j); O.n=F.n;
    for(const id of cfg.occ||[]){ const pl=PLANES.find(p=>p.id===id); if(!pl) continue; const r=pl.rect, b=O.n;
      for(const [u,v] of [[r[0],r[1]],[r[0]+r[2],r[1]],[r[0]+r[2],r[1]+r[3]],[r[0],r[1]+r[3]]]){ const p=pAt(pl,u,v).addScaledVector(pl.PN,0.0005); O.pos.push(p.x,p.y,p.z); } O.idx.push(b,b+1,b+2,b,b+2,b+3); O.n+=4; } }
  /* the foreground controls are drawn over the live panel, so each is cut off behind the panel plane it stands on (in its vertex
     and fragment shader: no depth-only copy of the planes to fill, which cost as much as the controls) */
  // the plane: a sub-plane (pedestal, side console, trim or fuel inset) the control's middle lies over and near, else the panel
  U.uPl={value:pk.units.map(u=>{ const v=new THREE.Vector4(0,0,0,-1); if(!u.fg||!(u.min.x<=u.max.x)) return v; const c=new THREE.Vector3().addVectors(u.min,u.max).multiplyScalar(0.5); let best=null, bd=1e9;
    for(const pl of PLANES){ if(pl===MAIN) continue; const ps2=pl.ps*pl.ps, rel=new THREE.Vector3().subVectors(c,pl.O), uu=rel.dot(pl.EX)/ps2, vv=rel.dot(pl.EY)/ps2, r=pl.rect, mx=Math.max(r[2],r[3])*0.1;
      if(uu<r[0]-mx||uu>r[0]+r[2]+mx||vv<r[1]-mx||vv>r[1]+r[3]+mx) continue; const d=Math.abs(rel.dot(pl.PN)); if(d<0.08&&d<bd){ bd=d; best=pl; } }
    if(!best&&Math.abs(new THREE.Vector3().subVectors(c,MAIN.O).dot(MAIN.PN))<0.4) best=MAIN;
    if(best){ v.set(best.PN.x,best.PN.y,best.PN.z,-best.PN.dot(best.O)-0.0008); u.plane=best.id; } return v; })};
  if(cfg.pvs!==false){ const t0=performance.now(); try{ D3.glb.culled=pvsCull([...pk.groups.main.values()],O,EYE,cfg.pvsRes||1024); }catch(e){ console.warn('3D cockpit visibility',e); } D3.glb.pvsMs=Math.round(performance.now()-t0); D3.glb.pvs=pvsCull.stat; }
  await pause(); loading(0.95);
  if(cfg.pvs!==false){ try{ D3.glb.ctlCulled=pvsControls([...pk.groups.main.values(),...pk.groups.fg.values()],[...pk.groups.main.values()],O,pk.units,EYE,cfg.pvsRes2||640); }catch(e){ console.warn('3D cockpit visibility',e); } }
  D3.glb.ctlBacks=cullControlBacks([...pk.groups.main.values(),...pk.groups.fg.values()],pk.units,EYE);
  await pause(); loading(1);
  pk.groups.main.forEach(A=>sortNear(A,EYE)); pk.groups.fg.forEach(A=>sortNear(A,EYE));
  pk.groups.main.forEach(A=>bakeLight(A,EYE,cfg)); pk.groups.fg.forEach(A=>bakeLight(A,EYE,cfg));
  const gam=new Map(); [...pk.groups.main.values(),...pk.groups.fg.values()].forEach(A=>toDisplay(A,gam));
  const hq={main:[...pk.groups.main.values()].map(A=>mk(A,false)),fg:[...pk.groups.fg.values()].map(A=>mk(A,false,true))}; let lo=null;
  const gl=pk.glass.n?glassBaked(pk.glass,EYE,cfg.tint):null; if(gl){ gl.renderOrder=5; gl.frustumCulled=false; gl.matrixAutoUpdate=false; }
  // grab proxies for the pointer: invisible copies of the control wheels' / sticks' own triangles, moved with them
  const proxies=[], holders=[];
  pk.units.forEach((u,i)=>{ if(!u.grab||!u.tri) return; const h=new THREE.Object3D(); h.matrixAutoUpdate=false;
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(u.tri.pos,3)); g.setIndex(u.tri.n>65535?new THREE.Uint32BufferAttribute(u.tri.idx,1):new THREE.Uint16BufferAttribute(u.tri.idx,1)); g.computeBoundingSphere(); g.computeBoundingBox(); delete u.tri;
    // a point to grab it by (tests): the middle of the front-facing triangle nearest the middle of the control
    { const c=g.boundingBox.getCenter(new THREE.Vector3()), P=g.attributes.position.array, I=g.index.array, F={pos:P}; let bd=1e9;
      for(let t=0;t<I.length;t+=3){ if(facing(F,I[t],I[t+1],I[t+2],EYE)<0.3) continue; const x=(P[I[t]*3]+P[I[t+1]*3]+P[I[t+2]*3])/3, y=(P[I[t]*3+1]+P[I[t+1]*3+1]+P[I[t+2]*3+1])/3, z=(P[I[t]*3+2]+P[I[t+1]*3+2]+P[I[t+2]*3+2])/3, d=(x-c.x)**2+(y-c.y)**2+(z-c.z)**2; if(d<bd){ bd=d; g.userData.at=new THREE.Vector3(x,y,z); } } }
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide})); h.add(m); h.userData.u=i; holders.push(h); proxies.push(m); u.proxy=m; u.holder=h; });
  const mainHolders=holders.filter(h=>!pk.units[h.userData.u].fg), fgHolders=holders.filter(h=>pk.units[h.userData.u].fg);
  const b={meshes:[back,...hq.main,...(gl?[gl]:[]),...mainHolders],fg:[...hq.fg,...fgHolders],grab:proxies,glb:true,lod:0};
  // level of detail: governor level 2 and below draw one mesh per pass
  b.setLod=function(l){ if(l===b.lod) return; const cur=b.lod?lo:hq; if(l&&!lo){ lo={main:[mk(loAcc([...pk.groups.main.values()]),true)],fg:pk.groups.fg.size?[mk(loAcc([...pk.groups.fg.values()]),true,true)]:[]}; }
    const nx=l?lo:hq; cur.main.forEach(m=>scene.remove(m)); cur.fg.forEach(m=>fgScene.remove(m)); nx.main.forEach(m=>scene.add(m)); nx.fg.forEach(m=>fgScene.add(m)); b.lod=l; needs=3; };
  // controls: per frame, values from the sim (cfg.drive), eased for the levers, straight for wheels, sticks and pedals
  const M=new THREE.Matrix4(), R1=new THREE.Matrix4(), Tb=new THREE.Matrix4(), D2=D2R, direct=new Set(cfg.direct||[]);
  const val={}; pk.units.forEach(u=>{ if(u.name) val[u.name]=[0,0,0]; });
  b.anim=function(st,dt){ const io=o.io, get=io&&io.get?k=>{ try{ return io.get(k); }catch(e){ return undefined; } }:()=>undefined;
    let tg; try{ tg=cfg.drive(get,st||{},side.controls)||{}; }catch(e){ tg={}; }
    let ch=false; const k=1-Math.exp(-(dt||0.016)*14);
    pk.units.forEach((u,i)=>{ if(!i) return; const t=tg[u.name]; if(!t) return; const c=val[u.name]; let mv=false;
      for(let j=0;j<3;j++){ const want=+t[j]||0; if(!isFinite(want)) continue; const nv=direct.has(u.name)||u.blade?want:Math.abs(want-c[j])<1e-5?want:c[j]+(want-c[j])*k; if(Math.abs(nv-c[j])>1e-6){ c[j]=nv; mv=true; } }
      if(u.blade){ u.spin=((u.spin||0)+(+t[1]||0)*6*(dt||0.016))%360; if(!c[0]&&(+t[1]||0)>0) mv=true; }
      if(!mv&&u.done) return; u.done=true; ch=true;
      if(u.blade){ if(c[0]) M.makeScale(0,0,0); else { M.makeTranslation(u.pivot.x,u.pivot.y,u.pivot.z).multiply(R1.makeRotationZ(-u.spin*D2)).multiply(Tb.makeTranslation(-u.pivot.x,-u.pivot.y,-u.pivot.z)); } U.uCtl.value[i].copy(M); return; }
      unitMatrix(u,c,M); U.uCtl.value[i].copy(M);
      if(u.holder){ u.holder.matrix.copy(M); u.holder.matrixWorldNeedsUpdate=true; } });
    return ch; };
  b.units=pk.units; b.U=U; b.vals=val;
  { const per={}; [...pk.groups.main.values(),...pk.groups.fg.values()].forEach(A=>{ for(let t=0;t<A.idx.length;t+=3){ const nm=pk.units[A.ctl[A.idx[t]]].name||'static'; per[nm]=(per[nm]||0)+1; } }); D3.glb.trisPerUnit=per; D3.glb.planes=Object.fromEntries(pk.units.filter(u=>u.fg).map(u=>[u.name,u.plane||'-'])); }
  return b; }
D3.controls=()=>built&&built.vals?JSON.parse(JSON.stringify(built.vals)):null; // test helper: current control positions [travel m, angle°, angle°]
D3._dbg=()=>({scene,fgScene,built,fgR,fgCv,cam,drawCk,glbOn:()=>glbOn});
D3.glInfo=()=>({mainCalls:GI.main,fgCalls:GI.fg,lod:built&&built.glb?built.lod:-1,glb:D3.glb.state});
D3.init=function(opt){
  o=opt; stage=opt.stage; world=opt.world; css();
  scene=new THREE.Scene(); fgScene=new THREE.Scene();
  K.svg=opt.svg||null;
  cam=new THREE.PerspectiveCamera(60,1,0.03,def.far||12); cam.position.copy(EYE); cam.rotation.order='YXZ';
  if(def.glb&&!/[?&]ck=proc(&|$)/.test(location.search)&&G.fetch&&G.Promise) startGLB(); else { D3.glb.state='none'; useBuilt(buildProc()); }
  D3.on=true; stage.classList.add('d3'); if(def.cls) stage.classList.add(def.cls);
  if(PLANES.length>1&&opt.svg) splitWhenReady(); else ready=true;
  if(opt.bar!==false&&def.snaps) drawBar();
  bindInput(); resize(); needs=3; t0=performance.now();
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ needs=3; lastT=0; } });
  return true;
};
function resize(){ if(!stage) return; W=stage.clientWidth; H=stage.clientHeight; needs=3; fgDirty=true; }
D3.resize=resize;

/* ---------- sub-planes: move the drawing and the controls inside a rectangle onto their own plane ---------- */
function splitWhenReady(){ const svg=o.svg; let n=0; const go=()=>{ n++; if(!svg.querySelector('g.hits')&&n<30){ requestAnimationFrame(go); return; } try{ split(svg); }catch(e){ console.warn('3D panel split',e); } ready=true; needs=3; }; requestAnimationFrame(go); }
function inside(b,r,tol){ return b.x>=r[0]-tol&&b.y>=r[1]-tol&&b.x+b.width<=r[0]+r[2]+tol&&b.y+b.height<=r[1]+r[3]+tol; }
function split(svg){
  const NS='http://www.w3.org/2000/svg', L=svg._pl, nq=Element.prototype.querySelector, host=nq.call(svg,'g.ctls'), hits=nq.call(svg,'g.hits');
  const subs=[];
  for(let i=1;i<PLANES.length;i++){ const pl=PLANES[i], r=pl.rect;
    const d=document.createElement('div'); d.className='d3sub d3sub-'+pl.id; d.style.width=r[2]+'px'; d.style.height=r[3]+'px'; d.style.transform=OFF;
    const s=document.createElementNS(NS,'svg'); s.setAttribute('class',svg.getAttribute('class')||'psvg'); s.setAttribute('viewBox',r.join(' ')); s.setAttribute('xmlns',NS);
    const gc=document.createElementNS(NS,'g'); gc.setAttribute('class','ctls'); const gh=document.createElementNS(NS,'g'); gh.setAttribute('class','hits'); gc.appendChild(gh);
    d.appendChild(s); world.appendChild(d); pl.el=d; pl.svg=s; pl.gc=gc; pl.gh=gh; pl.ck={}; subs.push(pl); }
  const pick=(n,b)=>{ for(const pl of subs){ if(pl.skip&&n.matches&&n.matches(pl.skip)) continue; if((pl.sel&&n.matches&&n.matches(pl.sel))||(b&&inside(b,pl.rect,2))) return pl; } return null; };
  const box=(b,m)=>{ const xs=[b.x,b.x+b.width], ys=[b.y,b.y+b.height]; let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; xs.forEach(x=>ys.forEach(y=>{ const X=m.a*x+m.c*y+m.e, Y=m.b*x+m.d*y+m.f; x0=Math.min(x0,X); y0=Math.min(y0,Y); x1=Math.max(x1,X); y1=Math.max(y1,Y); })); return {x:x0,y:y0,width:x1-x0,height:y1-y0}; };
  const bb=n=>{ try{ const b=n.getBBox(); if(!b.width&&!b.height) return null; const t=n.transform&&n.transform.baseVal&&n.transform.baseVal.consolidate(); return t?box(b,t.matrix):b; }catch(e){ return null; } };
  // static drawing: nodes fully inside a rectangle (or matching its selector); plain groups that straddle rectangles are
  // opened up, and what moves out of them keeps their transform in a wrapper group
  const mat=n=>{ const t=n.transform&&n.transform.baseVal&&n.transform.baseVal.consolidate(); return t?t.matrix:null; };
  const walk=(n,acc,depth)=>{ const tg=n.tagName.toLowerCase(); if(tg==='defs'||tg==='style'||tg==='clippath'||n===host||(n.classList&&n.classList.contains('mags'))) return;
    let b=bb(n); if(b&&acc) b=box(b,acc);
    const pl=pick(n,b); if(pl){ if(acc){ const w=document.createElementNS(NS,'g'); w.setAttribute('transform',`matrix(${acc.a} ${acc.b} ${acc.c} ${acc.d} ${acc.e} ${acc.f})`); w.appendChild(n); pl.svg.appendChild(w); } else pl.svg.appendChild(n); return; }
    if(tg==='g'&&depth<3&&!n.getAttribute('clip-path')&&!n.getAttribute('filter')&&!n.getAttribute('mask')&&!(n.classList&&(n.classList.contains('ctl')||n.classList.contains('an')))){
      const m=mat(n); let a2=acc; if(m){ const M2=svg.createSVGMatrix(); Object.assign(M2,{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f}); a2=acc?acc.multiply(M2):M2; }
      [...n.children].forEach(c=>walk(c,a2,depth+1)); } };
  [...svg.children].forEach(n=>walk(n,null,0));
  // layered panel (panellayers.js): a moving unit's own SVG layer goes whole onto the plane its unit belongs to
  if(L) L.dyn.forEach(d=>{ const u=d._unit; if(!u) return; let acc=null; const anc=[]; for(let p=u.parentNode;p&&p!==d;p=p.parentNode) anc.unshift(p);
    anc.forEach(a=>{ const m=mat(a); if(!m) return; const M2=svg.createSVGMatrix(); Object.assign(M2,{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f}); acc=acc?acc.multiply(M2):M2; });
    let b=bb(u); if(b&&acc) b=box(b,acc); let pl=null; for(const a of anc.concat([u])){ pl=subs.find(p=>p.sel&&a.matches(p.sel)&&!(p.skip&&a.matches(p.skip))); if(pl) break; } if(!pl) pl=pick(u,b);
    if(pl){ d.setAttribute('viewBox',pl.rect.join(' ')); pl.el.appendChild(d); } });
  // controls by their centre, with their hit zones
  const moved={};
  const place=g=>{ const b=bb(g); if(!b) return null; let pl=null; for(const p of subs){ if(p.sel&&g.matches(p.sel)){ pl=p; break; } const r=p.rect, cx=b.x+b.width/2, cy=b.y+b.height/2; if(cx>=r[0]&&cx<=r[0]+r[2]&&cy>=r[1]&&cy<=r[1]+r[3]){ pl=p; break; } }
    return pl&&!(pl.skip&&g.matches(pl.skip))?pl:null; };
  if(L) L.chunks.forEach((ch,i)=>{ [...ch._g.children].forEach(g=>{ if(!g.matches('g.ctl')) return; const pl=place(g); if(!pl) return;
    let t=pl.ck[i]; if(!t){ const s=document.createElementNS(NS,'svg'); s.setAttribute('class',ch.getAttribute('class')); s.setAttribute('viewBox',pl.rect.join(' ')); const w=document.createElementNS(NS,'g'); w.setAttribute('class',ch._g.getAttribute('class')); s.appendChild(w); pl.el.appendChild(s); t=pl.ck[i]=w; }
    t.appendChild(g); moved[g.dataset.id]=pl; }); });
  else [...host.querySelectorAll(':scope > g.ctl')].forEach(g=>{ const pl=place(g); if(pl){ pl.gc.appendChild(g); moved[g.dataset.id]=pl; } });
  if(hits) [...hits.children].forEach(h=>{ const pl=moved[h.dataset.for]; if(pl) pl.gh.appendChild(h); });
  subs.forEach(pl=>pl.svg.appendChild(pl.gc));
  D3.subs=subs;
  if(L) return; // the layered panel's lookups already search the whole .world, sub-planes included
  // lookups on the panel SVG still find what moved
  const qs=Element.prototype.querySelector, qsa=Element.prototype.querySelectorAll;
  svg.querySelector=function(s){ const r=qs.call(this,s); if(r) return r; for(const p of subs){ const x=qs.call(p.svg,s); if(x) return x; } return null; };
  svg.querySelectorAll=function(s){ const a=[...qsa.call(this,s)]; subs.forEach(p=>a.push(...qsa.call(p.svg,s))); return a; };
}

/* ---------- camera & panel transform ---------- */
function updCam(){ eH.set(view.pitch*D2R,-view.yaw*D2R,0,'YXZ'); qHead.setFromEuler(eH); cam.quaternion.copy(qHead); cam.fov=fov(); cam.aspect=W/Math.max(1,H); cam.near=0.03; cam.far=def.far||12; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); }
// screen visibility of a projected rectangle (matrix elements e, local w×h): 0 hidden, 1 shown
function onScreen(e,w,h){ let front=0, minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  for(const [u,v] of [[0,0],[w,0],[0,h],[w,h]]){ const ww=e[3]*u+e[7]*v+e[15]; if(ww>0.02){ front++; const x=(e[0]*u+e[4]*v+e[12])/ww, y=(e[1]*u+e[5]*v+e[13])/ww; minx=Math.min(minx,x); maxx=Math.max(maxx,x); miny=Math.min(miny,y); maxy=Math.max(maxy,y); } }
  return !(front===0||(front===4&&(maxx<0||minx>W||maxy<0||miny>H))); }
const fx=x=>+x.toPrecision(9), OFF='translate(-200000px,-200000px) scale(.001)';
function placePanel(){
  SC.set(W/2,0,0,W/2, 0,-H/2,0,H/2, 0,0,0,0, 0,0,0,1);
  M.copy(SC).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse).multiply(A);
  const e=M.elements; e[2]=0; e[6]=0; e[10]=1; e[14]=0;
  const show=ready&&onScreen(e,PW,PH); let anySub=false;
  // sub-planes: homography from the sub's local pixels to panel pixels, so world(M) × child = the sub's own projection
  if(D3.subs){ HM.set(e[0],e[4],e[12], e[1],e[5],e[13], e[3],e[7],e[15]); const HMi=HM.clone().invert();
    for(const pl of D3.subs){ const r=pl.rect;
      AS.set(pl.EX.x,pl.EY.x,pl.PN.x*pl.ps,pl.O.x+pl.EX.x*r[0]+pl.EY.x*r[1], pl.EX.y,pl.EY.y,pl.PN.y*pl.ps,pl.O.y+pl.EX.y*r[0]+pl.EY.y*r[1], pl.EX.z,pl.EY.z,pl.PN.z*pl.ps,pl.O.z+pl.EX.z*r[0]+pl.EY.z*r[1], 0,0,0,1);
      MS.copy(SC).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse).multiply(AS); const f=MS.elements;
      // a plane out of view is parked far off screen rather than hidden: with a hidden (visibility or display) plane inside the
      // moving panel, Chrome lays out every SVG text in the panel again on every frame while the head turns
      const vis=onScreen(f,r[2],r[3]); if(vis!==pl.hid){ pl.hid=vis; if(!vis){ pl.str=OFF; pl.el.style.transform=OFF; } }
      if(!vis) continue; anySub=true;
      HS.set(f[0],f[4],f[12], f[1],f[5],f[13], f[3],f[7],f[15]); const h=HMi.clone().multiply(HS).elements; // column-major 3×3
      const s='matrix3d('+[h[0],h[1],0,h[2], h[3],h[4],0,h[5], 0,0,1,0, h[6],h[7],0,h[8]].map(fx).join(',')+')';
      if(s!==pl.str){ pl.str=s; pl.el.style.transform=s; } } }
  const hide=!show;
  if(hide!==world._hid){ world._hid=hide; world.style.visibility=hide?'hidden':''; }
  if(show||anySub){ const s='matrix3d('+Array.from(e,x=>+x.toFixed(6)).join(',')+')'; if(s!==matStr){ matStr=s; world.style.transform=s; } }
}
// panel units under a screen point (for the panel's own drag maths and for double-click)
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(), tmp=new THREE.Vector3();
function rayAt(cx,cy){ const r=stage.getBoundingClientRect(); ndc.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height*2-1)); ray.setFromCamera(ndc,cam); return ray.ray; }
let activePl=null;
function planeOf(e){ if(activePl) return activePl; const t=e&&e.target&&e.target.closest&&e.target.closest('.d3sub'); if(t&&D3.subs){ for(const p of D3.subs) if(p.el===t) return p; } return MAIN; }
D3.toWorld=function(e){ const pl=planeOf(e); const rr=rayAt(e.clientX,e.clientY); const den=rr.direction.dot(pl.PN); if(Math.abs(den)<1e-6) return {x:-1e4,y:-1e4};
  const t=tmp.subVectors(pl.O,rr.origin).dot(pl.PN)/den; if(t<0) return {x:-1e4,y:-1e4}; const p=rr.at(t,new THREE.Vector3()).sub(pl.O); return {x:p.dot(pl.EX)/(pl.ps*pl.ps),y:p.dot(pl.EY)/(pl.ps*pl.ps)}; };
D3.project=function(u,v){ updCam(); const p=pAt(planeAt(u,v),u,v).project(cam); const r=stage.getBoundingClientRect(); return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height}; };
D3.scale=function(){ const pxPerRad=(H/2)/Math.tan(fov()*D2R/2); return pxPerRad*PS/0.82; };

/* ---------- looking around ---------- */
const clampV=()=>{ view.yaw=Math.max(LIM.yaw[0],Math.min(LIM.yaw[1],view.yaw)); view.pitch=Math.max(LIM.pitch[0],Math.min(LIM.pitch[1],view.pitch)); view.zoom=Math.max(0.3,Math.min(1.25,view.zoom)); };
D3.lookAhead=function(instant){ const short=H&&H<520, v=short?SHORT:AHEAD; glideTo(v[0],v[1],v[2]||1,instant); setSnap('panel'); }; // phones: a little closer and lower so the panel is usable
D3.lookAt=function(r,instant){ if(!r) return D3.lookAhead(instant);
  const pl=planeAt(r[0]+r[2]/2,r[1]+r[3]/2);
  const c=pAt(pl,r[0]+r[2]/2,r[1]+r[3]/2).sub(EYE); const yaw=Math.atan2(c.x,-c.z)/D2R, pitch=Math.atan2(c.y,Math.hypot(c.x,c.z))/D2R, d=c.length();
  const angW=2*Math.atan(r[2]*pl.ps/2/d), angH=2*Math.atan(r[3]*pl.ps/2/d); const asp=W/Math.max(1,H);
  const need=Math.max(2*Math.atan(Math.tan(angW/2)/asp),angH)/D2R*1.14; glideTo(yaw,pitch,Math.max(0.3,Math.min(1,need/baseFov())),instant); setSnap(null); };
function glideTo(y,p,z,instant){ if(instant){ view.yaw=y; view.pitch=p; view.zoom=z; view.glide=null; clampV(); needs=2; return; } view.glide={y,p,z}; view.vy=view.vp=0; needs=2; }
function stepView(dt){
  let moved=false;
  if(view.glide){ const k=1-Math.exp(-dt*7), g=view.glide; view.yaw+=(g.y-view.yaw)*k; view.pitch+=(g.p-view.pitch)*k; view.zoom+=(g.z-view.zoom)*k; moved=true;
    if(Math.abs(g.y-view.yaw)<0.05&&Math.abs(g.p-view.pitch)<0.05&&Math.abs(g.z-view.zoom)<0.002){ view.yaw=g.y; view.pitch=g.p; view.zoom=g.z; view.glide=null; } }
  if(!D3.dragging&&(Math.abs(view.vy)>0.5||Math.abs(view.vp)>0.5)){ view.yaw+=view.vy*dt; view.pitch+=view.vp*dt; const f=Math.exp(-dt*5); view.vy*=f; view.vp*=f; moved=true; }
  if(keysHeld.size){ const sp=70*(view.zoom); let ky=0,kp=0; keysHeld.forEach(k=>{ if(k==='L') ky-=1; if(k==='R') ky+=1; if(k==='U') kp+=1; if(k==='D') kp-=1; }); if(ky||kp){ view.yaw+=ky*sp*dt; view.pitch+=kp*sp*dt; view.glide=null; moved=true; } }
  clampV(); return moved;
}
/* snap views (panel, left, right, upper panel or pedestal, outside) */
function setSnap(k){ snapK=k; if(bar) bar.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===k)); }
D3.snap=function(k,instant){ if(k==='panel'){ D3.lookAhead(instant); if(o&&o.onAhead) o.onAhead(); return; } const s=(def.snaps||[]).find(x=>x[0]===k); if(!s) return; glideTo(s[2],s[3],s[4]||1,instant); setSnap(k); if(o&&o.onAhead) o.onAhead(); };
function drawBar(){ bar=document.createElement('div'); bar.className='d3v'; bar.setAttribute('role','toolbar'); bar.setAttribute('aria-label',(o.T||(s=>s))('Views'));
  bar.addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) D3.snap(b.dataset.v); });
  stage.appendChild(bar); D3.relabel(); }
D3.relabel=function(){ if(!bar) return; const T=o.T||(s=>s); bar.setAttribute('aria-label',T('Views')); bar.innerHTML=def.snaps.map(s=>`<button type="button" data-v="${s[0]}"${s[0]===snapK?' class="on"':''}>${T(s[1])}</button>`).join(''); };

/* ---------- input ---------- */
const ptrs=new Map(); let drag=null, pinch=null, stickDrag=null;
function hitGrab(list,e){ if(!list.length) return null; const rr=rayAt(e.clientX,e.clientY); ray.ray.copy(rr); return ray.intersectObjects(list,true).find(h=>tmp.subVectors(h.point,PO).dot(PN)<0.002)||null; }
function startStick(e){ stickDrag={x:e.clientX,y:e.clientY,id:e.pointerId,pt:e.pointerType}; try{ stage.setPointerCapture(e.pointerId); }catch(_){} o.onStick({x:0,y:0}); }
function bindInput(){
  // capture phase: the foreground control wheels are drawn over the panel, so they take the pointer before any panel control
  stage.addEventListener('pointerdown',e=>{
    activePl=null; if(!D3.on||e.button>0) return;
    if(fgGrabs.length&&o.onStick&&!e.target.closest('.ctop,.more,.d3v,.d3t,.pill,.tz,.zback,button,a,select')){ const h=hitGrab(fgGrabs,e); if(h){ e.stopPropagation(); e.preventDefault(); startStick(e); return; } }
    const t=e.target.closest&&e.target.closest('.d3sub'); if(t&&D3.subs){ for(const p of D3.subs) if(p.el===t) activePl=p; }
  },true);
  stage.addEventListener('pointerdown',e=>{
    if(!D3.on||e.button>0||stickDrag) return;
    if(o.canLook&&!o.canLook(e)) return;
    const hit=hitGrab(grabs,e);
    if(hit&&o.onStick){ startStick(e); e.preventDefault(); return; }
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    try{ stage.setPointerCapture(e.pointerId); }catch(_){}
    if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:view.zoom}; drag=null; D3.dragging=true; return; }
    drag={x:e.clientX,y:e.clientY,t:performance.now(),moved:0}; view.glide=null; view.vy=view.vp=0; D3.dragging=true;
  });
  stage.addEventListener('pointermove',e=>{
    if(stickDrag&&e.pointerId===stickDrag.id){ const dx=e.clientX-stickDrag.x, dy=e.clientY-stickDrag.y; o.onStick(G.FK?G.FK.shapeDrag(dx,dy,stickDrag.pt):{x:Math.max(-1,Math.min(1,dx/90)),y:Math.max(-1,Math.min(1,dy/80))}); return; } // shared mouse/touch curve (flightkeys.js)
    if(!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&ptrs.size>=2){ const [a,b]=[...ptrs.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); view.zoom=pinch.z*pinch.d/Math.max(20,d); clampV(); needs=2; return; }
    if(!drag) return; const now=performance.now(), dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.moved+=Math.abs(dx)+Math.abs(dy);
    const k=fov()/Math.max(1,H); // degrees per pixel
    view.yaw-=dx*k; view.pitch+=dy*k; clampV(); if(drag.moved>6&&snapK) setSnap(null);
    const dt=Math.max(8,now-drag.t)/1000; view.vy=view.vy*0.6+(-dx*k/dt)*0.4; view.vp=view.vp*0.6+(dy*k/dt)*0.4;
    drag.x=e.clientX; drag.y=e.clientY; drag.t=now; needs=2;
  },{passive:true});
  const up=e=>{
    activePl=null;
    if(stickDrag&&e.pointerId===stickDrag.id){ stickDrag=null; o.onStick(null); return; }
    if(!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
    if(ptrs.size<2) pinch=null;
    if(ptrs.size===0){ if(drag&&performance.now()-drag.t>150){ view.vy=view.vp=0; } drag=null; D3.dragging=false; needs=2; }
  };
  stage.addEventListener('pointerup',up,{passive:true}); stage.addEventListener('pointercancel',up,{passive:true});
  // wheel zoom only where a wheel exists (a blocking wheel listener costs every repaint); none at all on phones
  const wheel=e=>{ if(!D3.on) return; if(o.canLook&&!o.canLook(e)) return; e.preventDefault();
    const d=(e.deltaMode?e.deltaY*40:e.deltaY)*(e.ctrlKey?3:1); view.zoom*=Math.exp(d*0.0012); view.glide=null; clampV(); setSnap(null); needs=2; };
  const mq=matchMedia('(any-pointer:fine)'); let won=false; const ws=()=>{ const on=mq.matches; if(on===won) return; won=on; if(on) stage.addEventListener('wheel',wheel,{passive:false}); else stage.removeEventListener('wheel',wheel,{passive:false}); };
  ws(); if(mq.addEventListener) mq.addEventListener('change',ws); else if(mq.addListener) mq.addListener(ws);
  addEventListener('keyup',e=>{ const k=lookKey(e); if(k) keysHeld.delete(k); },{passive:true});
  addEventListener('blur',()=>keysHeld.clear(),{passive:true});
  new ResizeObserver(resize).observe(stage);
}
const NOK=def.noKeys||[];
function lookKey(e){ const c=e.code; if(NOK.includes(c)) return null; if(c==='Numpad4'||c==='KeyU') return 'L'; if(c==='Numpad6'||c==='KeyO') return 'R'; if(c==='Numpad8'||c==='KeyI') return 'U'; if(c==='Numpad2'||c==='KeyM'||c==='KeyK') return 'D'; return null; }
// called from the page's keydown handler (after its typing checks); returns true if it was a look key
D3.key=function(e){ if(!D3.on) return false; if(e.code==='Numpad5'||e.code==='KeyC'){ D3.lookAhead(); if(o.onAhead) o.onAhead(); e.preventDefault(); return true; }
  const k=lookKey(e); if(!k) return false; keysHeld.add(k); view.glide=null; setSnap(null); e.preventDefault(); return true; };
D3.isLookKey=e=>!!lookKey(e)||e.code==='Numpad5'||e.code==='KeyC';

/* ---------- per-frame ---------- */
function renderFg(){ if(!fgR) return; const pr=dprNow(); if(Math.abs(fgR.getPixelRatio()-pr)>1e-3){ fgR.setPixelRatio(pr); fgDirty=true; }
  if(fgDirty){ fgR.setSize(W,H,false); fgDirty=false; } fgR.render(fgScene,cam); GI.fg=fgR.info.render.calls; }
// the cockpit pass, in the outside-world renderer after the world
function drawCk(R){ R.render(scene,cam); GI.main=R.info.render.calls; }
D3.frame=function(S,st){
  if(!D3.on||document.hidden) return;
  const now=performance.now(), dt=lastT?Math.min(0.1,(now-lastT)/1000):0.016; lastT=now;
  if(!W||!H) resize();
  const look=stepView(dt); D3.moving=look||view.yaw!==lastV[0]||view.pitch!==lastV[1]||view.zoom!==lastV[2]; lastV[0]=view.yaw; lastV[1]=view.pitch; lastV[2]=view.zoom;
  // frozen panel (see freeze()): a look drag stays frozen until released
  if(D3.moving||D3.dragging){ stillT=0; freeze(true); } else if(frz){ stillT+=dt; if(stillT>0.15) freeze(false); } const moved=D3.moving||needs>0; if(needs>0) needs--;
  if(built.setLod) built.setLod(D3.lodForce!=null?D3.lodForce:qLevel>=2?1:0);
  const ch=built.anim?built.anim(st||{},dt):false;
  const active=st&&st.active;
  if(portrait.matches) return; // the page shows 'rotate your device' over the stage
  if(!moved&&!active&&!D3.dragging&&!ch){ idle+=dt; if(idle>0.4){ return; } } else idle=0;
  // frame governor: render-rate cap at the lower levels (moving the head is never held back by more than one frame)
  const cap=LV[qLevel][1]; if(cap&&now-lastR<cap*1000-4&&!D3.dragging&&!view.glide) { meter(dt,true); return; }
  lastR=now;
  // draw first, then move the DOM planes: otw.js reads the canvas size, which would force a layout after a style change
  updCam();
  const ok=G.OTW.render3d(S,qHead,cam.fov,dprNow(),drawCk);
  renderFg(); placePanel();
  // scale for crisp displays (debounced)
  const s=D3.scale(); if(Math.abs(s-lastScale)/Math.max(0.01,lastScale)>0.12){ scaleT+=dt; if(scaleT>0.35&&!D3.dragging&&!view.glide){ scaleT=0; lastScale=s; o.onScale&&o.onScale(s); } } else scaleT=0;
  if(ok) meter(dt,false);
};
function meter(dt,skipped){ if(!(dt>0)||now0()-t0<2500) return; qSum+=dt; qN++; qWin+=dt; if(qWin>2){ const avg=qSum/qN*1000; D3.ft=avg; qWin=qSum=qN=0;
  if(avg>21&&qLevel<LV.length-1){ qLevel++; needs=2; fgDirty=true; } else if(avg>26&&qLevel===LV.length-1&&!toastShown){ toastShown=true; o.onSlow&&o.onSlow(); } } }
const now0=()=>performance.now();
// test helper: synchronous timing of n frames with glFinish, with and without the cockpit pass
D3.bench=function(S,n){ const R=G.OTW.renderer(), gl=R.getContext(); updCam(); const run=(ck)=>{ gl.finish(); const t=performance.now(); for(let i=0;i<n;i++){ R.info.reset(); G.OTW.render3d(S,qHead,cam.fov,dprNow(),ck?drawCk:null); if(ck&&fgR){ renderFg(); } } gl.finish(); if(fgR) fgR.getContext().finish(); return (performance.now()-t)/n; };
  R.info.autoReset=false; const w=run(false), c=run(true); const info={calls:R.info.render.calls,tris:R.info.render.triangles}; R.info.autoReset=true; return {worldOnly:+w.toFixed(2),worldPlusCockpit:+c.toFixed(2),lastFrame:info,px:[R.domElement.width,R.domElement.height]}; };
D3.cockpitInfo=()=>{ const cnt=sc=>{ let t=0,m=0; sc.traverse(x=>{ if(x.isMesh){ m++; t+=(x.geometry.index?x.geometry.index.count:x.geometry.attributes.position.count)/3; } }); return [t,m]; }; const a=cnt(scene), b=cnt(fgScene); return {tris:a[0]+b[0],meshes:a[1]+b[1],fgTris:b[0],planes:PLANES.length}; };
D3.quality=()=>({level:qLevel,dpr:dprNow(),cap:LV[qLevel][1]?Math.round(1/LV[qLevel][1]):0,ft:D3.ft||0});
D3.setQuality=l=>{ qLevel=Math.max(0,Math.min(LV.length-1,l)); needs=3; fgDirty=true; };
/* Frozen panel while the head turns. Once the panel's on-screen scale has changed, Chrome lays out every SVG text in the
   panel again (~2,900 objects on the B200, ~110 ms at 4x CPU throttle) on the next layout anywhere in the document: a needle,
   a transition step, a hover change or a status line. So while the view moves and until it has been still for 150 ms the panel
   is frozen: no instrument updates (panelDt) and the pages hold their status lines and tooltips (D3.frozen); class d3mv on the
   stage. The live panel stays on screen (nothing is swapped, so it is pixel-identical) and catches up as soon as the view stops.
   (Restyling the panel to block hover would itself re-lay out every label, so pointer events are left alone.) */
function freeze(on){ if(on===frz) return; frz=on; D3.frozen=on; if(stage) stage.classList.toggle('d3mv',on); if(!on) needs=2; }
D3.frozen=false;
D3.panelDt=base=>(D3.on&&frz)?1e9:base;
D3.view=view; D3.setView=function(y,p,z){ view.yaw=y; view.pitch=p; if(z) view.zoom=z; view.glide=null; view.vy=view.vp=0; clampV(); setSnap(null); needs=3; };
D3.wake=()=>{ needs=3; };
// test helper: screen position of a draggable control wheel / stick
D3.grabAt=function(i){ const m=[...fgGrabs,...grabs][i]; if(!m) return null; updCam(); m.updateMatrixWorld(true); const p=(m.geometry&&m.geometry.userData.at?m.geometry.userData.at.clone().applyMatrix4(m.matrixWorld):new THREE.Vector3().setFromMatrixPosition(m.matrixWorld)).project(cam); const r=stage.getBoundingClientRect(); return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height}; };
return D3;
};
})(window);
