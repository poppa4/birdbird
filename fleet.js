/* NORDAP – parked aircraft for world.js (fleet.js). A320-family airliner and a high-wing single, built here from
   published dimensions (A320: length 37.57 m, span 35.80 m incl. sharklets, height 11.76 m, fuselage 3.95 x 4.14 m,
   wheelbase 12.64 m, track 7.59 m; C172: length 8.28 m, span 11.0 m). No third-party model files.
   One geometry per type, drawn instanced (one draw call per type). Liveries are fictional.
   Local frame: x forward (nose gear at x = 0), y up from the ground, z to the right. */
(function(G){
'use strict';
const T=()=>G.THREE;
function Builder(){ this.P=[]; this.N=[]; this.A=[]; }      // A: part id, local x, local y (for windows/paint in the shader)
Builder.prototype.tri=function(a,b,c,na,nb,nc,part){
  for(const [p,n] of [[a,na],[b,nb],[c,nc]]){ this.P.push(p[0],p[1],p[2]); const k=1/(Math.hypot(n[0],n[1],n[2])||1); this.N.push(n[0]*k,n[1]*k,n[2]*k); this.A.push(part,p[0],p[1]); } };
// grid of points rows x cols (closed around cols if wrap), normals averaged from faces
Builder.prototype.grid=function(V,rows,cols,wrap,part,flip){
  const idx=(r,c)=>V[r][wrap?((c%cols)+cols)%cols:c];
  const nrm=[]; for(let r=0;r<rows;r++){ nrm.push([]); for(let c=0;c<cols;c++) nrm[r].push([0,0,0]); }
  const cc=wrap?cols:cols-1;
  const fn=(a,b,c)=>{ const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]]; return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]; };
  for(let r=0;r<rows-1;r++) for(let c=0;c<cc;c++){ const c1=wrap?(c+1)%cols:c+1;
    const a=idx(r,c), b=idx(r+1,c), d=idx(r,c1), e=idx(r+1,c1); let n1=fn(a,b,e), n2=fn(a,e,d); if(flip){ n1=n1.map(x=>-x); n2=n2.map(x=>-x); }
    for(const [rr,ccx] of [[r,c],[r+1,c],[r+1,c1],[r,c1]]){ const t=nrm[rr][ccx]; t[0]+=n1[0]+n2[0]; t[1]+=n1[1]+n2[1]; t[2]+=n1[2]+n2[2]; } }
  for(let r=0;r<rows-1;r++) for(let c=0;c<cc;c++){ const c1=wrap?(c+1)%cols:c+1;
    const a=idx(r,c), b=idx(r+1,c), d=idx(r,c1), e=idx(r+1,c1), na=nrm[r][c], nb=nrm[r+1][c], nd=nrm[r][c1], ne=nrm[r+1][c1];
    if(flip){ this.tri(a,e,b,na,ne,nb,part); this.tri(a,d,e,na,nd,ne,part); } else { this.tri(a,b,e,na,nb,ne,part); this.tri(a,e,d,na,ne,nd,part); } } };
Builder.prototype.cap=function(ring,center,part,flip){ const n=ring.length; for(let i=0;i<n;i++){ const a=ring[i], b=ring[(i+1)%n];
  const u=[a[0]-center[0],a[1]-center[1],a[2]-center[2]], v=[b[0]-center[0],b[1]-center[1],b[2]-center[2]]; let nn=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]; if(flip) nn=nn.map(x=>-x);
  if(flip) this.tri(center,b,a,nn,nn,nn,part); else this.tri(center,a,b,nn,nn,nn,part); } };
// body of revolution / loft along x: sections [x, yc, halfW, halfH, squareness]
Builder.prototype.loft=function(S,seg,part){
  const V=S.map(([x,yc,w,h,sq])=>{ const ring=[]; for(let i=0;i<seg;i++){ const t=i/seg*Math.PI*2, c=Math.cos(t), s=Math.sin(t), e=2/(sq||2);
    ring.push([x, yc+Math.sign(s)*Math.pow(Math.abs(s),e)*h, Math.sign(c)*Math.pow(Math.abs(c),e)*w]); } return ring; });
  this.grid(V,V.length,seg,true,part,false); return V; };
// airfoil (NACA 4-digit thickness + small camber), chord along -x from the leading edge
function airfoil(n,t,camber){ const up=[],lo=[]; for(let i=0;i<=n;i++){ const x=0.5*(1-Math.cos(Math.PI*i/n));
  const yt=5*t*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1036*x*x*x*x); const yc=camber*4*x*(1-x);
  up.push([x,yc+yt]); lo.push([x,yc-yt]); } return up.concat(lo.reverse().slice(1,-1)); }
// lifting surface through stations [xLE, y, z, chord, thickness]; axis: 'z' (wing/stab span) or 'y' (fin)
Builder.prototype.surface=function(ST,part,nAf,camber,closeTip){
  const af=airfoil(nAf||12,1,camber||0); const rows=[];
  for(const s of ST){ const [xl,y,z,ch,th,vert]=s; rows.push(af.map(([u,v])=>vert?[xl-u*ch, y, z+v*th*ch]:[xl-u*ch, y+v*th*ch, z])); }
  this.grid(rows,rows.length,af.length,true,part,false);
  if(closeTip){ const last=rows[rows.length-1]; let c=[0,0,0]; last.forEach(p=>{ c[0]+=p[0]/last.length; c[1]+=p[1]/last.length; c[2]+=p[2]/last.length; }); this.cap(last,c,part,ST[0][2]>ST[ST.length-1][2]?false:true);
    const first=rows[0]; let c0=[0,0,0]; first.forEach(p=>{ c0[0]+=p[0]/first.length; c0[1]+=p[1]/first.length; c0[2]+=p[2]/first.length; }); this.cap(first,c0,part,ST[0][2]>ST[ST.length-1][2]?true:false); }
  return rows; };
Builder.prototype.cyl=function(x0,x1,y,z,r0,r1,seg,part,caps){ const V=[[],[]]; for(let i=0;i<seg;i++){ const t=i/seg*Math.PI*2; V[0].push([x0,y+Math.sin(t)*r0,z+Math.cos(t)*r0]); V[1].push([x1,y+Math.sin(t)*r1,z+Math.cos(t)*r1]); }
  this.grid(V,2,seg,true,part,x1>x0); if(caps){ this.cap(V[0],[x0,y,z],part,x1<x0); this.cap(V[1],[x1,y,z],part,x1>x0); } };
// wheel: cylinder along z
Builder.prototype.wheel=function(x,y,z,r,w,part){ const seg=14, V=[[],[]]; for(let i=0;i<seg;i++){ const t=i/seg*Math.PI*2; V[0].push([x+Math.cos(t)*r,y+Math.sin(t)*r,z-w/2]); V[1].push([x+Math.cos(t)*r,y+Math.sin(t)*r,z+w/2]); }
  this.grid(V,2,seg,true,part,true); this.cap(V[0],[x,y,z-w/2],part,false); this.cap(V[1],[x,y,z+w/2],part,true); };
Builder.prototype.box=function(x0,x1,y0,y1,z0,z1,part){ const C=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  const F=[[0,3,2,1,[0,0,-1]],[4,5,6,7,[0,0,1]],[0,1,5,4,[0,-1,0]],[3,7,6,2,[0,1,0]],[0,4,7,3,[-1,0,0]],[1,2,6,5,[1,0,0]]];
  for(const [a,b,c,d,n] of F){ this.tri(C[a],C[b],C[c],n,n,n,part); this.tri(C[a],C[c],C[d],n,n,n,part); } };
Builder.prototype.geometry=function(){ const g=new (T().InstancedBufferGeometry)();
  g.setAttribute('position',new (T().Float32BufferAttribute)(this.P,3)); g.setAttribute('normal',new (T().Float32BufferAttribute)(this.N,3)); g.setAttribute('pa',new (T().Float32BufferAttribute)(this.A,3)); return g; };
// parts: 0 body paint, 1 wing/stab (grey), 2 fin (livery), 3 nacelle (livery 2), 4 dark metal/tyres, 5 bare metal, 6 belly (grey)
function a320(){
  const B=new Builder(); const XN=5.07;       // nose tip x (nose gear at 0)
  const yc=4.0;                               // fuselage centre height
  const S=[]; const prof=[[0,-0.55,0.0,0.0],[0.15,-0.50,0.32,0.30],[0.45,-0.42,0.62,0.60],[0.9,-0.32,0.92,0.92],[1.5,-0.22,1.2,1.22],[2.2,-0.12,1.45,1.5],
    [3.0,-0.05,1.68,1.74],[4.0,-0.01,1.85,1.93],[5.2,0,1.95,2.04],[6.5,0,1.975,2.07]];
  for(const [d,dy,w,h] of prof) S.push([XN-d,yc+dy,Math.max(w,0.005),Math.max(h,0.005),2.05]);
  for(let d=8;d<=25;d+=1.5) S.push([XN-d,yc,1.975,2.07,2.05]);
  const tail=[[26.5,0.06,1.95,2.0],[28.0,0.16,1.87,1.88],[29.5,0.30,1.74,1.70],[31.0,0.48,1.56,1.46],[32.5,0.68,1.32,1.18],[34.0,0.90,1.02,0.86],[35.3,1.10,0.72,0.56],[36.5,1.28,0.42,0.32],[37.57,1.40,0.18,0.16]];
  for(const [d,dy,w,h] of tail) S.push([XN-d,yc+dy,w,h,2.0]);
  const rings=B.loft(S,30,0); const last=rings[rings.length-1]; B.cap(last,[XN-37.6,yc+1.4,0],5,false);
  // belly fairing (wing-body)
  B.loft([[-6.0,yc-1.55,0.9,0.35,2],[-7.8,yc-1.62,1.7,0.5,2.2],[-11,yc-1.66,1.85,0.55,2.3],[-15,yc-1.64,1.8,0.52,2.3],[-18.5,yc-1.55,1.3,0.42,2.2],[-20.5,yc-1.45,0.5,0.25,2]],18,0);
  // wings: root (inside body), kink, tip; sharklet
  for(const sd of [-1,1]){
    const st=[[-8.6,yc-1.45,sd*1.5,7.2,0.15],[-10.6,yc-1.22,sd*6.3,4.8,0.13],[-17.2,yc-0.55,sd*16.4,1.55,0.10]];
    B.surface(st.map(([x,y,z,c,t])=>[x,y,z,c,t]),1,12,0.02,false);
    // sharklet: from the tip, canted up and slightly aft
    const tipx=-17.2, tipy=yc-0.55, tipz=sd*16.4;
    const sh=[[tipx,tipy,tipz,1.55,0.09,1],[tipx-0.7,tipy+0.55,tipz+sd*0.35,1.2,0.09,1],[tipx-1.6,tipy+2.35,tipz+sd*0.55,0.55,0.08,1]];
    const rows=sh.map(([x,y,z,c,t])=>airfoil(8,1,0).map(([u,v])=>[x-u*c,y,z+sd*v*t*c]));
    B.grid(rows,rows.length,rows[0].length,true,1,sd<0);
    // flap track fairings
    for(const [z,x] of [[4.3,-12.6],[8.2,-13.9],[11.9,-15.2]]){ const s0=B.P.length; B.loft([[x+0.3,yc-1.45+z*0.075-0.05,0.05,0.05,2],[x-0.6,yc-1.65+z*0.075,0.16,0.22,2],[x-2.3,yc-1.6+z*0.075,0.13,0.16,2],[x-3.0,yc-1.42+z*0.075,0.02,0.02,2]].map(q=>[q[0],q[1],q[2],q[3],q[4]]),8,5);
      // shift to span position
      for(let i=s0;i<B.P.length;i+=3) B.P[i+2]+=sd*z; }
    // engine: CFM56-class nacelle under the wing, pylon
    const ez=sd*5.75, ey=1.62, ex=-6.6;
    const nac=[[ex+0.25,ey,0.86,0.86,2],[ex+0.05,ey,0.98,0.98,2],[ex-0.5,ey,1.06,1.06,2],[ex-1.6,ey,1.07,1.07,2],[ex-2.7,ey,0.98,0.98,2],[ex-3.4,ey,0.80,0.80,2],[ex-3.9,ey,0.62,0.62,2]];
    const s1=B.P.length; B.loft(nac,24,3); for(let i=s1;i<B.P.length;i+=3) B.P[i+2]+=ez;
    B.cyl(ex+0.22,ex-0.25,ey,ez,0.82,0.82,24,4,false);                       // inlet (dark)
    B.cyl(ex-0.25,ex-0.25,ey,ez,0.82,0.001,24,5,false);                     // fan face
    B.cyl(ex-3.85,ex-4.9,ey,ez,0.42,0.06,16,5,false);                       // exhaust cone
    B.box(ex-3.6,ex-0.2,ey+0.9,ey+1.45+0.12*Math.abs(ez),ez-0.13,ez+0.13,1); // pylon
  }
  // horizontal stabiliser and fin
  for(const sd of [-1,1]) B.surface([[-28.6,yc+0.75,sd*0.6,3.7,0.10],[-31.9,yc+1.1,sd*6.2,1.35,0.09]],1,10,0,true);
  B.surface([[-27.4,yc+1.9,0,6.0,0.11,1],[-29.6,yc+4.6,0,4.0,0.10,1],[-32.6,yc+7.75,0,2.1,0.10,1]],2,12,0,false);
  B.surface([[-32.6,yc+7.75,0,2.1,0.10,1],[-32.62,yc+7.77,0,2.05,0.02,1]],2,12,0,false);
  // landing gear: nose (2 wheels), mains (2 + 2)
  B.cyl(0.0,0.0,0.4,0,0.09,0.09,8,4,false); B.box(-0.09,0.09,0.4,2.1,-0.09,0.09,4);
  for(const z of [-0.27,0.27]) B.wheel(0,0.38,z,0.38,0.22,4);
  for(const sd of [-1,1]){ const z=sd*3.795; B.box(-12.64-0.12,-12.64+0.12,0.57,yc-1.4,z-0.12,z+0.12,4); B.box(-12.64-0.05,-12.64+0.05,0.9,yc-1.6,z-0.9*sd*0.0-0.05,z+0.05,5);
    for(const dz of [-0.46,0.46]) B.wheel(-12.64,0.57,z+dz,0.57,0.36,4); }
  return {g:B.geometry(), xn:XN, yc};
}
function c172(){
  const B=new Builder(); const yc=1.35;
  B.loft([[1.55,yc-0.05,0.3,0.3,2],[1.3,yc-0.02,0.46,0.42,2.2],[0.6,yc+0.05,0.55,0.6,2.6],[-0.5,yc+0.2,0.56,0.72,2.6],[-1.6,yc+0.2,0.55,0.72,2.6],[-2.8,yc+0.18,0.42,0.52,2.4],[-4.5,yc+0.25,0.22,0.3,2.2],[-6.6,yc+0.42,0.08,0.12,2]],16,0);
  for(const sd of [-1,1]){ B.surface([[-0.25,yc+0.95,sd*0.4,1.62,0.13],[-0.35,yc+1.0,sd*5.5,1.15,0.12]],1,10,0.03,true);
    B.box(-0.7,-0.6,0.55,yc+0.95,sd*0.55-0.04,sd*2.8+0.04,5);
    B.surface([[-5.5,yc+0.35,sd*0.1,1.0,0.09],[-5.8,yc+0.35,sd*1.7,0.7,0.09]],1,8,0,true);
    B.wheel(-0.7,0.25,sd*1.15,0.25,0.15,4); B.box(-0.75,-0.65,0.25,0.75,sd*0.4,sd*1.15,5); }
  B.surface([[-5.0,yc+0.6,0,1.4,0.09,1],[-6.1,yc+1.9,0,0.75,0.09,1]],2,8,0,false);
  B.wheel(1.0,0.22,0,0.22,0.12,4); B.box(0.95,1.05,0.22,0.9,-0.04,0.04,5);
  B.box(1.58,1.62,yc-0.9,yc+0.85,-0.05,0.05,4);                              // propeller (stopped)
  return {g:B.geometry()};
}
const LIV=[[0.10,0.22,0.48],[0.62,0.08,0.10],[0.05,0.38,0.42],[0.92,0.50,0.08],[0.20,0.22,0.25],[0.80,0.80,0.82]];
function material(world){
  const T3=T();
  return new T3.ShaderMaterial({ uniforms:world.uniforms(),
    vertexShader:`attribute vec3 pa; attribute vec4 io; attribute vec3 il; attribute vec2 ip; uniform vec3 camW; varying vec3 vN; varying vec3 vW; varying vec3 vP; varying vec3 vL; varying float vSide;
      vec3 att(vec3 p,float pit,float bank,float pivot){ p.x-=pivot; float cp=cos(pit), sp=sin(pit); p=vec3(p.x*cp-p.y*sp, p.x*sp+p.y*cp, p.z); p.x+=pivot;
        float cb=cos(bank), sb=sin(bank); return vec3(p.x, p.y*cb-p.z*sb, p.y*sb+p.z*cb); }
      void main(){ float h=io.w; vec3 f=vec3(sin(h),0.0,-cos(h)), r=vec3(cos(h),0.0,sin(h));
        vec3 p=att(position,ip.x,ip.y,-12.64); vec3 nn=att(normal,ip.x,ip.y,0.0);
        vec3 w=io.xyz+f*p.x+vec3(0.0,p.y,0.0)+r*p.z;
        vN=f*nn.x+vec3(0.0,nn.y,0.0)+r*nn.z; vW=w; vP=vec3(pa.x,position.x,position.y); vL=il; vSide=position.z;
        gl_Position=projectionMatrix*viewMatrix*vec4(w,1.0); }`,
    fragmentShader:`${world.COMMON} uniform vec3 camW; uniform float night; uniform float xn; uniform float yc;
      varying vec3 vN; varying vec3 vW; varying vec3 vP; varying vec3 vL; varying float vSide;
      float rbox(vec2 p,vec2 hs,float r){ vec2 q=abs(p)-hs+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
      void main(){
        vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N; vec3 V=normalize(camW-vW);
        float part=floor(vP.x+0.5), x=vP.y, y=vP.z;
        vec3 base=vec3(0.92,0.93,0.94); float gloss=0.55;
        if(part<0.5){
          float d=xn-x;                                                       // metres aft of the nose
          if(y<yc-0.9) base=mix(base,vec3(0.70,0.72,0.75),smoothstep(yc-0.9,yc-1.15,y));
          // passenger windows (21 in pitch), doors and the cockpit windscreen
          float side=abs(vSide);
          if(side>1.2){
            float wy=y-(yc+0.28); float pit=0.533; float k=floor((d-7.3)/pit+0.5); float wx=d-7.3-k*pit;
            float okw=step(7.0,d)*step(d,28.6)*(1.0-step(abs(d-11.6),0.5))*(1.0-step(abs(d-12.9),0.45));
            float win=1.0-smoothstep(-0.01,0.01,rbox(vec2(wx,wy),vec2(0.11,0.16),0.07));
            base=mix(base,vec3(0.06,0.07,0.09),win*okw);
            for(int i=0;i<4;i++){ float dc=i==0?6.1:i==1?11.6:i==2?12.9:31.0; float hw=i==1||i==2?0.27:0.42; float hh=i==1||i==2?0.5:0.95;
              float dd=abs(rbox(vec2(d-dc,y-(yc+(i==1||i==2?0.1:-0.2))),vec2(hw,hh),0.12)); base*=1.0-0.55*(1.0-smoothstep(0.0,0.018,dd)); }
          }
          float ws=step(1.9,d)*step(d,3.65)*step(yc+0.62+(3.65-d)*0.18,y)*step(y,yc+1.32)*step(abs(vSide),1.45);
          base=mix(base,vec3(0.04,0.05,0.07),ws); gloss=mix(gloss,1.0,ws);
          // livery: coloured belly stripe forward and tail band
          base=mix(base,vL,smoothstep(28.0,29.0,d)*smoothstep(yc+0.6,yc+1.0,y)*0.9);
        } else if(part<1.5){ base=vec3(0.78,0.79,0.81); gloss=0.4; }
        else if(part<2.5){ base=vL; gloss=0.6; }
        else if(part<3.5){ base=mix(vec3(0.90,0.91,0.92),vL,0.85); gloss=0.6; }
        else if(part<4.5){ base=vec3(0.09,0.09,0.10); gloss=0.2; }
        else if(part<5.5){ base=vec3(0.55,0.56,0.58); gloss=0.8; }
        else { base=vec3(0.72,0.74,0.77); gloss=0.4; }
        vec3 c=lin(base);
        float ndl=max(dot(N,sunDir),0.0), sv=smoothstep(-0.05,0.08,sunDir.y);
        float ao=0.55+0.45*smoothstep(-0.8,0.6,N.y);                              // undersides darker
        ao*=0.6+0.4*smoothstep(0.3,2.2,vW.y-0.0+0.0*vSide);
        vec3 lit=sunCol*ndl*sv+(skyCol*amb*(0.55+0.45*N.y)*2.0+horCol*amb*0.3)*ao+vec3(1.0,0.84,0.62)*night*0.22*(0.5+0.5*N.y)*step(vW.y,140.0);
        vec3 col=c*lit;
        vec3 R=reflect(-V,N); float fres=0.04+0.96*pow(1.0-max(dot(N,V),0.0),5.0);
        col+=skyAt(normalize(vec3(R.x,abs(R.y),R.z)))*fres*gloss*0.6*ao;
        col+=sunCol*pow(max(dot(R,sunDir),0.0),60.0)*gloss*0.35*sv;
        gl_FragColor=vec4(tone(aerial(col,vW,camW)),1.0); }`,
    side:T3.DoubleSide });
}
G.FLEET={a320,c172,LIV,material};
})(typeof window!=='undefined'?window:self);
