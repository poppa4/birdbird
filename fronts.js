/* Birdbird – fronts.js: "Fronts and air masses" (fronts.html).
   Teaching model of textbook fronts in the northern hemisphere.
   Cross-section: x = distance from the surface front in km (+ ahead, − behind), z = altitude in ft.
     frontal surface height z = x / N × 3281 ft (slope 1:N, warm front about 1:150, cold front about 1:70);
     temperature T = T0(air mass at the surface) − 2 °C per 1000 ft, so the 0 °C level, the frontal inversion and the
     winter "warm nose" above the warm-front surface all follow from where each air mass is;
     cloud, precipitation, icing and turbulence come from a small table of typical textbook cloud bodies per front type
     and stability of the warm air. Precipitation falling through the column melts above 0 °C and becomes supercooled
     (freezing rain) if it falls back into sub-zero air.
   Plan view: an idealised frontal depression on a 1600 × 1000 km chart. Pressure = westerly background + low + V-shaped
     troughs along the fronts; isobars every 4 hPa by marching squares; surface wind = geostrophic direction turned 20°
     towards low pressure (friction). */
(function(){
'use strict';
const {L,el,nf}=LAB;
const t2=(en,no)=>({en,no});
const INK={bg:'#10171D',grid:'#1F2B35',rule:'#2A3742',ink:'#D7E1E6',mute:'#8B99A7',dim:'#5E6D7C',cyan:'#7FCBE8',mag:'#E46BAE',amber:'#F0B440',red:'#EC5A47',green:'#71CC93',violet:'#B9A6F0',white:'#EEF3F7',blue:'#5AA9E6'};
const FC={warm:'#EC5A47',cold:'#5AA9E6',occl:'#B98AE8'};
const MONO='"IBM Plex Mono", ui-monospace, monospace', BODY='"Public Sans", system-ui, sans-serif';
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hooks=[]; const on=f=>{ hooks.push(f); return f; };
const FT_KM=3281;

/* ---------------- state ---------------- */
const S={view:'sec',type:'warm',occ:'cold',stab:'stable',season:'summer',d:520,alt:9000,Nw:150,Nc:70,spd:20,t:24,
  show:{ice:true,turb:true,fz:true,jet:true,wind:true,rain:true},fly:false,run:false};
const KM0=-400, KM1=900, ZT=42000;

/* ---------------- air masses and geometry ---------------- */
/* mass codes: 0 warm, 1 cold air ahead, 2 cold air behind */
const T0TAB={summer:{warm:[20,15,12],cold:[20,15,12],occlcold:[18,14,10],occlwarm:[18,12,14]},
             winter:{warm:[6,-4,-6],cold:[6,-4,-6],occlcold:[4,-3,-8],occlwarm:[4,-8,-3]}};
const key=()=>S.type==='occl'?'occl'+S.occ:S.type;
let G={}; // current geometry (rebuilt on change)
function geo(){
  const k=key(), Nw=S.Nw, Nc=S.Nc;
  const g={k,Nw,Nc,T0:T0TAB[S.season][k]};
  if(k==='warm'){ g.mass=(x,z)=>x>0&&z<x/Nw*FT_KM?1:0; g.surfs=[[0,0,KM1,KM1/Nw*FT_KM,FC.warm]]; }
  else if(k==='cold'){ g.mass=(x,z)=>x<0&&z<-x/Nc*FT_KM?2:0; g.surfs=[[0,0,KM0,-KM0/Nc*FT_KM,FC.cold]]; }
  else if(k==='occlcold'){ const Jx=-40,Jz=8000; g.J=[Jx,Jz];
    const zA=x=>-x/40*Jz, zB=x=>Jz+(Jx-x)/Nc*FT_KM, zC=x=>Jz+(x-Jx)/Nw*FT_KM;
    g.mass=(x,z)=> x<=Jx? (z<zB(x)?2:0) : x<=0? (z<zA(x)?2:z<zC(x)?1:0) : (z<zC(x)?1:0);
    g.surfs=[[0,0,Jx,Jz,FC.occl],[Jx,Jz,KM0,zB(KM0),FC.cold],[Jx,Jz,KM1,zC(KM1),FC.warm]]; g.zW=zC; }
  else { const Jx=150,Jz=4000; g.J=[Jx,Jz];
    const zA=x=>x/Jx*Jz, zB=x=>Jz+(Jx-x)/Nc*FT_KM, zC=x=>Jz+(x-Jx)/Nw*FT_KM;
    g.mass=(x,z)=> x<0? (z<zB(x)?2:0) : x<Jx? (z<zA(x)?1:z<zB(x)?2:0) : (z<zC(x)?1:0);
    g.surfs=[[0,0,Jx,Jz,FC.occl],[Jx,Jz,KM0,zB(KM0),FC.cold],[Jx,Jz,KM1,zC(KM1),FC.warm]]; g.zW=zC; }
  if(!g.zW) g.zW=x=>Math.max(0,x)/Nw*FT_KM;
  g.T=(x,z)=>g.T0[g.mass(x,z)]-0.002*z;
  clouds(g); return g;
}
/* cloud bodies {k,x0,x1,b(x),t(x)} and precipitation bands {x0,x1,i,k} */
function clouds(g){
  const C=[], P=[], un=S.stab==='unstable', zW=g.zW, k=g.k;
  const hiSeq=(nsTop)=>{ // the warm-front sequence above the (upper) warm-front surface
    C.push({k:'ci',x0:620,x1:900,b:()=>26000,t:()=>29500});
    C.push({k:'cs',x0:430,x1:720,tl:60,tr:80,b:x=>Math.max(zW(x)+1200,19500),t:()=>25500});
    C.push({k:'as',x0:180,x1:490,tl:0,tr:70,b:x=>zW(x)+800,t:x=>nsTop-(x-180)*6});
    P.push({x0:225,x1:330,i:0.35,k:'ra'}); };
  if(k==='warm'){ hiSeq(21000);
    C.push({k:'ns',x0:-30,x1:235,tl:70,tr:40,b:x=>900+Math.max(0,x)*11,t:()=>21000}); P.push({x0:-15,x1:228,i:1,k:'ra'});
    if(un){ C.push({k:'emb',x0:48,x1:100,b:()=>1500,t:()=>31000}); C.push({k:'emb',x0:145,x1:190,b:()=>2500,t:()=>29000}); P.push({x0:57,x1:90,i:1.8,k:'sh'},{x0:152,x1:180,i:1.6,k:'sh'});
      C.push({k:'cu',x0:-400,x1:-40,b:()=>2500,t:()=>10000}); P.push({x0:-390,x1:-50,i:0.3,k:'sh'}); }
    else { C.push({k:'sc',x0:-400,x1:-25,b:()=>1200,t:()=>4500}); P.push({x0:-400,x1:-25,i:0.22,k:'dz'}); } }
  else if(k==='cold'){
    if(un){ C.push({k:'cb',x0:-25,x1:30,b:()=>2000,t:()=>34000}); C.push({k:'anv',x0:30,x1:160,b:x=>29000+(x-30)*12,t:()=>34000});
      C.push({k:'cu',x0:-400,x1:-90,b:()=>3000,t:()=>12000}); P.push({x0:-22,x1:28,i:2.2,k:'ts'},{x0:-385,x1:-100,i:0.35,k:'sh'}); }
    else { C.push({k:'ns',x0:-130,x1:15,b:x=>1000+Math.max(0,-x)*8,t:()=>16500}); C.push({k:'as',x0:-285,x1:-110,b:x=>Math.max(0,-x)/g.Nc*FT_KM+700,t:()=>16500});
      C.push({k:'cu',x0:-400,x1:-300,b:()=>3500,t:()=>8000}); P.push({x0:-130,x1:12,i:1.2,k:'ra'},{x0:-200,x1:-130,i:0.35,k:'ra'},{x0:-395,x1:-305,i:0.25,k:'sh'}); }
    C.push({k:'sc',x0:35,x1:900,b:()=>1500,t:()=>5000}); P.push({x0:40,x1:520,i:0.2,k:'dz'}); }
  else if(k==='occlcold'){ hiSeq(22000);
    C.push({k:'ns',x0:-45,x1:235,tl:30,tr:0,b:x=>900+Math.max(0,x)*11,t:()=>22000}); P.push({x0:-40,x1:228,i:1,k:'ra'});
    if(un){ C.push({k:'emb',x0:-40,x1:16,b:()=>1500,t:()=>30000}); P.push({x0:-30,x1:6,i:1.8,k:'sh'}); }
    C.push({k:'cu',x0:-400,x1:-95,b:()=>3000,t:()=>un?12000:8000}); P.push({x0:-385,x1:-105,i:0.35,k:'sh'}); }
  else { hiSeq(22000);
    C.push({k:'ns',x0:0,x1:250,tl:30,tr:0,b:x=>900+Math.max(0,x)*10,t:()=>22000}); P.push({x0:4,x1:245,i:1,k:'ra'});
    if(un){ C.push({k:'emb',x0:112,x1:172,b:()=>2500,t:()=>30000}); P.push({x0:120,x1:166,i:1.8,k:'sh'}); }
    C.push({k:'sc',x0:-320,x1:2,b:()=>2500,t:()=>7500}); P.push({x0:-120,x1:0,i:0.3,k:'ra'}); }
  g.C=C; g.P=P;
}
const PRI={ci:1,cs:2,anv:2,as:3,sc:3,cu:4,ns:5,emb:7,cb:8};
const hash=(n,s)=>{ const v=Math.sin(n*127.1+s*311.7)*43758.5453; return v-Math.floor(v); };
const CU_W=58;
function cuTop(c,x){ const n=Math.floor((x-c.x0)/CU_W), xc=c.x0+(n+0.5)*CU_W, w=(0.36+0.12*hash(n,c.x0))*CU_W, f=1-Math.abs(x-xc)/w;
  if(f<=0) return -1; return c.b()+(c.t()-c.b())*(0.45+0.55*hash(n+7,c.x0))*Math.sqrt(f); }
function taper(c,x){ const d=c.k==='emb'?12:c.k==='sc'?18:45, tl=c.tl!=null?c.tl:d, tr=c.tr!=null?c.tr:d; return Math.min(1,tl?(x-c.x0)/tl:1,tr?(c.x1-x)/tr:1); }
function ctop(c,x){ if(c.k==='cu') return cuTop(c,x); if(c.k==='ci'||c.k==='cb'||c.k==='anv') return c.t(x);
  const f=Math.max(0,taper(c,x)), b=c.b(x), tt=b+(c.t(x)-b)*Math.sqrt(f); if(c.k==='emb') return tt;
  return Math.max(b,tt+(Math.sin(x/16)*520+Math.sin(x/5.3)*230+Math.sin(x/2.1)*90)*Math.min(1,f*2)); }
function cloudAt(x,z){ let best=null;
  for(let i=0;i<G.C.length;i++){ const c=G.C[i]; if(x<c.x0||x>c.x1) continue; const b=c.b(x); if(z<b) continue;
    const t=ctop(c,x); if(z>t) continue; if(!best||PRI[c.k]>PRI[best.k]) best=c; }
  return best; }
function cloudBase(x){ let b=-1; for(let i=0;i<G.C.length;i++){ const c=G.C[i]; if(x<c.x0||x>c.x1||c.k==='ci'||c.k==='cs'||c.k==='anv') continue; if(c.k==='cu'&&cuTop(c,x)<0) continue; const v=c.b(x); if(b<0||v<b) b=v; } return b; }
function precipAt(x){ let p=null; for(let i=0;i<G.P.length;i++){ const q=G.P[i]; if(x>=q.x0&&x<=q.x1&&(!p||q.i>p.i)) p=q; } return p; }
/* the column under the cloud: where precipitation melts and where it becomes supercooled again */
const COL={melt:-1,frz:-1};
function precipTop(x){ let t=-1; for(let i=0;i<G.C.length;i++){ const c=G.C[i]; if(x<c.x0||x>c.x1||c.k==='ci'||c.k==='cs'||c.k==='anv') continue; const v=ctop(c,x); if(v>t) t=v; } return t; }
function column(x,top){ let liquid=G.T(x,top)>0, melt=liquid?top:-1, frz=-1;
  for(let z=top;z>=0;z-=100){ const t=G.T(x,z); if(!liquid&&t>0.5){ liquid=true; melt=z; } else if(liquid&&t<-1&&frz<0){ frz=z; } }
  COL.melt=melt; COL.frz=frz; return COL; }
/* hazards at a point: icing 0–3, turbulence 0–3 */
function icing(x,z,c){ const T=G.T(x,z);
  if(c){ if(T>0||T<-20) return 0; const k=c.k; if(k==='ci'||k==='cs'||k==='anv') return 0; if(k==='cb'||k==='emb') return 3; if(k==='ns'||k==='cu') return T>=-15?2:1; return 1; }
  const p=precipAt(x); if(!p||T>=0) return 0; const b=cloudBase(x); if(b<0||z>b) return 0; const cl=column(x,precipTop(x)); return cl.frz>=0&&z<=cl.frz&&cl.melt>=0?3:0; }
function jetPos(){ const k=G.k; return k==='warm'?[-150,30000,1]:k==='cold'?[-250,30000,-1]:[-210,31000,-1]; }
function turb(x,z,c){ let t=0;
  if(c){ if(c.k==='cb') t=3; else if(c.k==='emb') t=2; else if(c.k==='cu') t=1; else if(c.k==='anv') t=1; }
  for(let i=0;i<G.C.length;i++){ const q=G.C[i]; if(q.k!=='cb') continue; const ex=(x-(q.x0+q.x1)/2)/((q.x1-q.x0)/2+35), ez=(z-17500)/17500; if(ex*ex+ez*ez<1) t=Math.max(t,2); }
  if(G.k!=='warm'&&z<9000){ for(let i=0;i<G.surfs.length;i++){ const s=G.surfs[i]; if(s[4]!==FC.cold&&s[4]!==FC.occl) continue; const xa=Math.min(s[0],s[2]), xb=Math.max(s[0],s[2]); if(x<xa||x>xb) continue; const zs=s[1]+(s[3]-s[1])*(x-s[0])/(s[2]-s[0]); if(Math.abs(z-zs)<1500) t=Math.max(t,1); } }
  if(S.show.jet){ const j=jetPos(), dx=(x-(j[0]+j[2]*90))/170, dz=(z-(j[1]-3500))/3200; if(dx*dx+dz*dz<1) t=Math.max(t,1); }
  return t; }
/* surface weather along the route: piecewise-linear tables [x, value] */
const PW={
 warm:{dir:[[-400,235],[-15,225],[15,150],[300,145],[900,165]],spd:[[-400,15],[-15,18],[15,24],[300,18],[900,10]],q:[[-400,1002],[0,1003],[300,1009],[900,1016]],sp:[[-400,1],[0,1],[250,1.5],[500,4],[900,6]]},
 cold:{dir:[[-400,305],[-60,295],[-15,285],[20,220],[900,210]],spd:[[-400,16],[-60,24],[0,30],[30,22],[900,15]],q:[[-400,1016],[-60,1009],[0,1002],[120,1003],[900,1006]],sp:[[-400,9],[-60,7],[-10,2],[20,1],[900,2]]},
 occl:{dir:[[-400,290],[-20,260],[20,160],[300,140],[900,160]],spd:[[-400,15],[-20,22],[20,24],[300,18],[900,10]],q:[[-400,1007],[0,997],[300,1005],[900,1013]],sp:[[-400,6],[-80,4],[0,1],[250,1.5],[900,5]]}};
function pw(tab,x){ if(x<=tab[0][0]) return tab[0][1]; for(let i=1;i<tab.length;i++){ if(x<=tab[i][0]){ const a=tab[i-1],b=tab[i]; return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]); } } return tab[tab.length-1][1]; }
const sfc=()=>PW[S.type];
function windAt(x,z){ const T=sfc(); const d0=pw(T.dir,x), s0=pw(T.spd,x); let dir=d0+Math.min(1,z/4000)*30, spd=s0*1.4+z/1000*2;
  if(S.show.jet||true){ const j=jetPos(); const a=(x-j[0])/320, b=(z-j[1])/5000; spd+=70*Math.exp(-a*a-b*b); }
  return [((dir%360)+360)%360,spd]; }
const qnh=x=>pw(sfc().q,x), tSfc=x=>G.T(x,0), tdSfc=x=>G.T(x,0)-pw(sfc().sp,x);

/* ---------------- section view: layout ---------------- */
const cv=el('fxCv');
const LY={W:0,H:0,L0:40,R0:8,T0:8,yG:0,yS0:0,yS1:0};
const X=km=>LY.L0+(km-KM0)/(KM1-KM0)*(LY.W-LY.L0-LY.R0);
const Y=ft=>LY.yG-ft/ZT*(LY.yG-LY.T0);
const XI=px=>KM0+(px-LY.L0)/(LY.W-LY.L0-LY.R0)*(KM1-KM0);
const YI=py=>(LY.yG-py)/(LY.yG-LY.T0)*ZT;
const NX=220, NZ=96;
const fT=new Float32Array(NX*NZ), fI=new Float32Array(NX*NZ), fU=new Float32Array(NX*NZ);
const loA=document.createElement('canvas'); loA.width=NX; loA.height=NZ;
const imA=loA.getContext('2d').createImageData(NX,NZ);
/* hatch patterns for the hazard areas */
function hatch(col,gap,dir,w){ const c=document.createElement('canvas'); c.width=c.height=gap; const x=c.getContext('2d'); x.strokeStyle=col; x.lineWidth=w||1; x.beginPath();
  if(dir>0){ x.moveTo(0,gap); x.lineTo(gap,0); x.moveTo(-1,1); x.lineTo(1,-1); x.moveTo(gap-1,gap+1); x.lineTo(gap+1,gap-1); } else { x.moveTo(0,0); x.lineTo(gap,gap); x.moveTo(gap-1,-1); x.lineTo(gap+1,1); x.moveTo(-1,gap-1); x.lineTo(1,gap+1); } x.stroke(); return x.createPattern(c,'repeat'); }
const PAT={ice:hatch('rgba(127,203,232,.55)',8,1),ice2:hatch('rgba(170,225,245,.85)',4,1),tu:hatch('rgba(240,180,64,.55)',8,-1),tu2:hatch('rgba(240,180,64,.85)',4,-1)};
const stat=document.createElement('canvas'); const sg=stat.getContext('2d');
const NS=260; const sT=new Float32Array(NS), sTd=new Float32Array(NS), sQ=new Float32Array(NS);
/* rain drops: preallocated */
const ND=520; const dX=new Float32Array(ND), dTop=new Float32Array(ND), dPh=new Float32Array(ND), dMelt=new Float32Array(ND), dFrz=new Float32Array(ND), dSp=new Float32Array(ND); let nd=0;
const C=LAB.fit(cv,()=>{ layout(); rebuild(); },2);
function layout(){ const W=C.w,H=C.h; LY.W=W; LY.H=H; const narrow=W<560; LY.L0=narrow?34:44; LY.R0=narrow?6:10;
  const sh=Math.max(64,Math.round(H*0.2)); LY.yS1=H-6; LY.yS0=H-sh; LY.yG=LY.yS0-(narrow?22:24); LY.T0=8; }
/* marching squares: one level of a grid, segments appended to the current path */
function iso(g,F,nx,ny,lev,X0,Y0,dx,dy){
  for(let j=0;j<ny-1;j++) for(let i=0;i<nx-1;i++){
    const a=F[j*nx+i], b=F[j*nx+i+1], c=F[(j+1)*nx+i+1], d=F[(j+1)*nx+i];
    const code=(a>lev?1:0)|(b>lev?2:0)|(c>lev?4:0)|(d>lev?8:0); if(code===0||code===15) continue;
    const e0x=X0+(i+(lev-a)/(b-a))*dx, e0y=Y0+j*dy, e1x=X0+(i+1)*dx, e1y=Y0+(j+(lev-b)/(c-b))*dy,
          e2x=X0+(i+(lev-d)/(c-d))*dx, e2y=Y0+(j+1)*dy, e3x=X0+i*dx, e3y=Y0+(j+(lev-a)/(d-a))*dy;
    switch(code){
      case 1: case 14: g.moveTo(e3x,e3y); g.lineTo(e0x,e0y); break;
      case 2: case 13: g.moveTo(e0x,e0y); g.lineTo(e1x,e1y); break;
      case 3: case 12: g.moveTo(e3x,e3y); g.lineTo(e1x,e1y); break;
      case 4: case 11: g.moveTo(e1x,e1y); g.lineTo(e2x,e2y); break;
      case 6: case 9: g.moveTo(e0x,e0y); g.lineTo(e2x,e2y); break;
      case 7: case 8: g.moveTo(e3x,e3y); g.lineTo(e2x,e2y); break;
      case 5: g.moveTo(e3x,e3y); g.lineTo(e0x,e0y); g.moveTo(e1x,e1y); g.lineTo(e2x,e2y); break;
      case 10: g.moveTo(e0x,e0y); g.lineTo(e1x,e1y); g.moveTo(e2x,e2y); g.lineTo(e3x,e3y); break; } } }
/* label in a small dark box with a coloured edge (the wind tunnel's callout tags) */
function tag(g,s,x,y,col,al,sz){ const n=C.w<560; sz=sz||(n?10.5:12); g.font=`500 ${sz}px ${BODY}`; const w=g.measureText(s).width+12, h=sz+8; let x0=al==='center'?x-w/2:al==='right'?x-w:x; x0=Math.max(4,Math.min(C.w-w-4,x0)); const y0=y-h+4;
  g.fillStyle='rgba(14,18,22,.86)'; g.fillRect(x0,y0,w,h); g.strokeStyle='rgba(255,255,255,.14)'; g.lineWidth=1; g.strokeRect(x0+0.5,y0+0.5,w-1,h-1); g.fillStyle=col||INK.amber; g.fillRect(x0,y0,2,h); g.fillStyle='#EEF3F7'; g.textAlign='left'; g.fillText(s,x0+7,y0+h-5.5); }
function txt(g,s,x,y,col,al,sz,wt){ g.font=`${wt||500} ${sz||11}px ${MONO}`; g.textAlign=al||'left'; g.lineWidth=3; g.strokeStyle='rgba(12,17,22,.78)'; g.strokeText(s,x,y); g.fillStyle=col||INK.ink; g.fillText(s,x,y); g.textAlign='left'; }
const CLAB={ci:'Ci',cs:'Cs',as:'As',ns:'Ns',sc:'Sc',cu:'Cu',cb:'CB',emb:'CB',anv:''};
/* front symbol along a horizontal ground line, pointing in the direction of motion (right) */
function groundSym(g,x,y,k,len){ g.save(); const col=k==='warm'?FC.warm:k==='cold'?FC.cold:FC.occl; g.strokeStyle=col; g.fillStyle=col; g.lineWidth=2.4;
  g.beginPath(); g.moveTo(x-len/2,y); g.lineTo(x+len/2,y); g.stroke(); const n=Math.max(2,Math.round(len/26));
  for(let i=0;i<n;i++){ const cx=x-len/2+(i+0.5)*len/n; const w=k==='warm'||(k==='occl'&&i%2===1);
    g.beginPath(); if(w){ g.arc(cx,y,5.5,Math.PI,0); } else { g.moveTo(cx-6,y); g.lineTo(cx,y-9); g.lineTo(cx+6,y); g.closePath(); } g.fill(); } g.restore(); }
function rebuild(){ if(!C.w) return; G=geo(); const W=C.w,H=C.h, dpr=C.dpr; stat.width=Math.round(W*dpr); stat.height=Math.round(H*dpr); const g=sg; g.setTransform(dpr,0,0,dpr,0,0);
  const narrow=W<560;
  /* background */
  const bg=g.createLinearGradient(0,0,0,LY.yG); bg.addColorStop(0,'#141d26'); bg.addColorStop(1,'#1d2833'); g.fillStyle=bg; g.fillRect(0,0,W,H);
  /* fields on a coarse grid */
  const dxk=(KM1-KM0)/(NX-1), dz=ZT/(NZ-1); const A=imA.data;
  for(let j=0;j<NZ;j++){ const z=ZT-j*dz; for(let i=0;i<NX;i++){ const x=KM0+i*dxk, o=j*NX+i, m=G.mass(x,z), c=cloudAt(x,z);
    fT[o]=G.T(x,z); const ic=icing(x,z,c), tu=turb(x,z,c); fI[o]=ic; fU[o]=tu; const p=o*4;
    if(m===0){ A[p]=240;A[p+1]=172;A[p+2]=84;A[p+3]=26; } else if(m===1){ A[p]=96;A[p+1]=160;A[p+2]=230;A[p+3]=30; } else { A[p]=70;A[p+1]=130;A[p+2]=225;A[p+3]=44; }
  } }
  loA.getContext('2d').putImageData(imA,0,0);
  const px0=X(KM0), pdx=(X(KM1)-X(KM0))/(NX-1), py0=Y(ZT), pdy=(Y(0)-Y(ZT))/(NZ-1);
  g.imageSmoothingEnabled=true; g.drawImage(loA,0,0,NX,NZ,px0-pdx/2,py0-pdy/2,NX*pdx,NZ*pdy);
  /* clouds */
  for(const c of G.C) drawCloud(g,c);
  /* static precipitation haze */
  for(const p of G.P){ const x0=X(Math.max(KM0,p.x0)), x1=X(Math.min(KM1,p.x1)); if(x1<=x0) continue; const ym=Y(Math.max(800,cloudBase((p.x0+p.x1)/2)));
    const gr=g.createLinearGradient(0,ym,0,LY.yG); const a=Math.min(0.22,0.08+p.i*0.07); gr.addColorStop(0,`rgba(120,160,200,${a})`); gr.addColorStop(1,`rgba(120,160,200,${a*0.5})`); g.fillStyle=gr; g.fillRect(x0,ym,x1-x0,LY.yG-ym); }
  /* hazards: hatched areas with smooth outlines */
  const hz=(F,lev,pat)=>{ g.save(); g.beginPath(); for(let j=0;j<NZ;j++){ let i=0; while(i<NX){ if(F[j*NX+i]>=lev){ let k=i; while(k<NX&&F[j*NX+k]>=lev) k++; g.rect(px0+(i-0.5)*pdx,py0+(j-0.5)*pdy,(k-i)*pdx,pdy+0.5); i=k; } else i++; } } g.clip(); g.fillStyle=pat; g.fillRect(0,0,W,LY.yG); g.restore(); };
  if(S.show.ice){ hz(fI,0.5,PAT.ice); hz(fI,2.5,PAT.ice2); g.lineWidth=1; g.strokeStyle='rgba(127,203,232,.8)'; g.beginPath(); iso(g,fI,NX,NZ,0.5,px0,py0,pdx,pdy); g.stroke(); }
  if(S.show.turb){ hz(fU,0.5,PAT.tu); hz(fU,2.5,PAT.tu2); g.lineWidth=1; g.strokeStyle='rgba(240,180,64,.85)'; g.beginPath(); iso(g,fU,NX,NZ,0.5,px0,py0,pdx,pdy); g.stroke(); }
  /* frontal surfaces */
  g.lineWidth=2.2; for(const s of G.surfs){ g.strokeStyle=s[4]; g.beginPath(); g.moveTo(X(s[0]),Y(s[1])); const z2=Math.min(ZT,s[3]); const x2=s[0]+(s[2]-s[0])*(z2-s[1])/(s[3]-s[1]||1); g.lineTo(X(x2),Y(z2)); g.stroke(); }
  /* 0 °C */
  if(S.show.fz){ g.strokeStyle='#CFEFFF'; g.lineWidth=1.6; g.setLineDash([5,4]); g.beginPath(); iso(g,fT,NX,NZ,0,px0,py0,pdx,pdy); g.stroke(); g.setLineDash([]);
    let zl=-1; for(let z=0;z<ZT;z+=100){ if(G.T(KM0+30,z)<=0){ zl=z; break; } } if(zl>=0) txt(g,'0 °C',X(KM0)+4,Y(zl)-5,'#CFEFFF','left',10.5);
    const zr=(()=>{ for(let z=0;z<ZT;z+=100) if(G.T(KM1-20,z)<=0) return z; return -1; })(); if(zr>=0) txt(g,'0 °C',X(KM1)-4,Y(zr)-5,'#CFEFFF','right',10.5); }
  /* jet stream core */
  if(S.show.jet){ const j=jetPos(), x=X(j[0]), y=Y(j[1]); g.strokeStyle=INK.cyan; g.lineWidth=1.6; g.beginPath(); g.arc(x,y,7,0,Math.PI*2); g.moveTo(x-5,y-5); g.lineTo(x+5,y+5); g.moveTo(x+5,y-5); g.lineTo(x-5,y+5); g.stroke();
    tag(g,L(t2('jet core','jetkjerne')),x+12,y+8,INK.cyan,'left'); if(S.show.turb) txt(g,'CAT',X(j[0]+j[2]*90),Y(j[1]-3600)+4,INK.amber,'center',10); }
  /* cloud labels */
  for(const c of G.C){ const lab=CLAB[c.k]; if(!lab) continue; const x0=Math.max(KM0,c.x0), x1=Math.min(KM1,c.x1); if(X(x1)-X(x0)<(narrow?14:20)) continue; const xm=(x0+x1)/2;
    let z=c.k==='cu'?(c.b()+c.t())/2*0.8:(c.b(xm)+c.t(xm))/2; if(c.k==='cb') z=17000; if(c.k==='emb') z=c.t()-3500; if(c.k==='ci') z=c.t()+900;
    txt(g,c.k==='emb'?L(t2('emb CB','innl. CB')):lab,X(xm),Y(z)+4,c.k==='cb'||c.k==='emb'?'#FFD7A0':'#F3F7FA','center',narrow?10:11,600); }
  /* air-mass labels */
  const AL={warm:[[-250,15000,t2('warm air (mT)','varm luft (mT)'),INK.amber],[640,2600,t2('cold air','kald luft'),INK.blue]],
            cold:[[420,15000,t2('warm air (mT)','varm luft (mT)'),INK.amber],[-320,13000,t2('cold air (mP)','kald luft (mP)'),INK.blue]],
            occlcold:[[170,29000,t2('warm air lifted aloft','varm luft løftet opp'),INK.amber],[-320,13000,t2('cold air (colder)','kald luft (kaldest)'),INK.blue],[620,4500,t2('cool air ahead','kjølig luft foran'),INK.blue]],
            occlwarm:[[170,29000,t2('warm air lifted aloft','varm luft løftet opp'),INK.amber],[-320,13000,t2('cool air behind','kjølig luft bak'),INK.blue],[620,4500,t2('cold air ahead (colder)','kald luft foran (kaldest)'),INK.blue]]}[G.k];
  for(const a of AL) tag(g,L(a[2]),X(a[0]),Y(a[1]),a[3],'center');
  /* ground, front symbol, axes */
  g.fillStyle='#2a2f2a'; g.fillRect(LY.L0,LY.yG,W-LY.L0-LY.R0,4); g.strokeStyle='#55626e'; g.lineWidth=1; g.beginPath(); g.moveTo(LY.L0,LY.yG+0.5); g.lineTo(W-LY.R0,LY.yG+0.5); g.stroke();
  groundSym(g,X(0),LY.yG-1,S.type,narrow?40:70);
  g.font=`10px ${MONO}`; g.fillStyle=INK.dim; g.textAlign='right';
  for(const a of [5000,10000,20000,30000]){ const y=Y(a); g.fillText(a>=10000?'FL'+a/100:String(a),LY.L0-4,y+3); g.strokeStyle='rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(LY.L0,y); g.lineTo(W-LY.R0,y); g.stroke(); }
  g.textAlign='center'; const st=narrow?400:200; for(let k=-400;k<=800;k+=st){ g.fillText((k>0?'+':k<0?'−':'')+Math.abs(k)+(k===0?' km':''),X(k)+(k===-400?10:k===800?-8:0),LY.yG+15); }
  if(!narrow){ g.fillStyle=INK.mute; g.fillText(L(t2('← behind','← bak')),X(-300),LY.yG+15); g.fillText(L(t2('ahead →','foran →')),X(700),LY.yG+15); } g.textAlign='left';
  /* the surface strip */
  strip(g,narrow);
  /* rain drops */
  seedDrops();
  readout(); frame();
}
function drawCloud(g,c){ const x0=Math.max(KM0,c.x0), x1=Math.min(KM1,c.x1); if(x1<=x0) return; const step=(KM1-KM0)/(LY.W-LY.L0-LY.R0)*5;
  if(c.k==='ci'){ g.strokeStyle='rgba(225,235,242,.75)'; g.lineWidth=1.3; for(let x=x0+8;x<x1-14;x+=34){ const z=c.b()+(c.t()-c.b())*hash(Math.round(x),3); const px=X(x), py=Y(z); g.beginPath(); g.moveTo(px,py+5); g.quadraticCurveTo(px+10,py+3,px+18,py-8); g.stroke(); } return; }
  if(c.k==='cu'){ for(let n=0;;n++){ const xc=c.x0+(n+0.5)*CU_W; if(xc>c.x1) break; if(xc<KM0) continue; const w=(0.36+0.12*hash(n,c.x0))*CU_W, top=c.b()+(c.t()-c.b())*(0.45+0.55*hash(n+7,c.x0));
      const xa=X(xc-w), xb=X(xc+w), yb=Y(c.b()), yt=Y(top), h=yb-yt; const gr=g.createLinearGradient(0,yt,0,yb); gr.addColorStop(0,'rgba(236,241,245,.92)'); gr.addColorStop(1,'rgba(160,175,188,.9)'); g.fillStyle=gr;
      g.beginPath(); g.moveTo(xa,yb); g.quadraticCurveTo(xa-2,yb-h*0.55,xa+(xb-xa)*0.25,yb-h*0.72); g.quadraticCurveTo(xa+(xb-xa)*0.35,yt,xa+(xb-xa)*0.55,yt+h*0.08); g.quadraticCurveTo(xa+(xb-xa)*0.8,yb-h*0.85,xb-(xb-xa)*0.1,yb-h*0.5); g.quadraticCurveTo(xb+2,yb-h*0.3,xb,yb); g.closePath(); g.fill(); } return; }
  if(c.k==='cb'){ const xa=X(c.x0), xb=X(c.x1), yb=Y(c.b()), yt=Y(c.t()), w=xb-xa, yab=Y(c.t()-5500), aw=X(c.x0-30), ax=X(Math.min(KM1,c.x1+140));
    const gr=g.createLinearGradient(0,yt,0,yb); gr.addColorStop(0,'rgba(238,242,246,.96)'); gr.addColorStop(0.55,'rgba(196,206,215,.95)'); gr.addColorStop(1,'rgba(104,118,131,.96)'); g.fillStyle=gr;
    g.beginPath(); g.moveTo(xa,yb);
    for(let k=1;k<=5;k++){ const y=yb-(yb-yab)*k/5, x=xa-w*(0.04+0.06*(k%2)); g.quadraticCurveTo(x-w*0.12,y+(yb-yab)/10,x,y); }
    g.lineTo(aw,yab+3); g.quadraticCurveTo(aw-6,yt+6,aw+6,yt+2); g.quadraticCurveTo((xa+xb)/2,yt-16,xb+w*0.4,yt); g.lineTo(ax,yt+1); g.quadraticCurveTo(ax+8,yt+5,ax,yt+9); g.quadraticCurveTo((xb+ax)/2,yab-2,xb+w*0.1,yab+6);
    for(let k=1;k<=5;k++){ const y=yab+(yb-yab)*k/5, x=xb+w*(0.04+0.06*(k%2)); g.quadraticCurveTo(x+w*0.12,y-(yb-yab)/10,x,y); }
    g.lineTo(xa,yb); g.closePath(); g.fill(); return; }
  if(c.k==='anv') return; // drawn with the CB
  const col={cs:['rgba(214,226,235,.30)','rgba(200,214,226,.22)'],as:['rgba(205,216,226,.70)','rgba(160,175,190,.62)'],ns:['rgba(176,189,200,.92)','rgba(112,126,140,.92)'],sc:['rgba(196,207,216,.78)','rgba(140,155,168,.72)'],emb:['rgba(232,226,214,.55)','rgba(190,180,165,.40)']}[c.k];
  let ztop=0, zbot=ZT; for(let x=x0;x<=x1;x+=step){ ztop=Math.max(ztop,c.t(x)); zbot=Math.min(zbot,c.b(x)); }
  const gr=g.createLinearGradient(0,Y(ztop),0,Y(zbot)); gr.addColorStop(0,col[0]); gr.addColorStop(1,col[1]); g.fillStyle=gr;
  g.beginPath(); let first=true;
  for(let x=x0;x<=x1+0.01;x+=step){ const y=Y(ctop(c,x)); if(first){ g.moveTo(X(x),y); first=false; } else g.lineTo(X(x),y); }
  for(let x=x1;x>=x0-0.01;x-=step){ g.lineTo(X(x),Y(c.b(x)+(c.k==='ns'?Math.sin(x/5)*120:0))); }
  g.closePath(); g.fill();
  if(c.k==='emb'){ g.setLineDash([3,3]); g.strokeStyle='rgba(255,215,160,.8)'; g.lineWidth=1.1; g.stroke(); g.setLineDash([]); } }
function strip(g,narrow){ const W=LY.W, y0=LY.yS0, y1=LY.yS1, xa=X(KM0), xb=X(KM1);
  g.fillStyle='rgba(8,12,16,.45)'; g.fillRect(xa,y0,xb-xa,y1-y0); g.strokeStyle='rgba(255,255,255,.07)'; g.strokeRect(xa+0.5,y0+0.5,xb-xa-1,y1-y0-1);
  let tmin=99,tmax=-99,qmin=2000,qmax=0; for(let i=0;i<NS;i++){ const x=KM0+i*(KM1-KM0)/(NS-1); sT[i]=tSfc(x); sTd[i]=tdSfc(x); sQ[i]=qnh(x); tmin=Math.min(tmin,sTd[i]); tmax=Math.max(tmax,sT[i]); qmin=Math.min(qmin,sQ[i]); qmax=Math.max(qmax,sQ[i]); }
  tmin-=2; tmax+=2; qmin-=2; qmax+=2; const yT=v=>y1-6-(v-tmin)/(tmax-tmin)*(y1-y0-22), yQ=v=>y1-6-(v-qmin)/(qmax-qmin)*(y1-y0-22);
  const line=(arr,f,col,dash)=>{ g.strokeStyle=col; g.lineWidth=1.7; g.setLineDash(dash||[]); g.beginPath(); for(let i=0;i<NS;i++){ const x=X(KM0+i*(KM1-KM0)/(NS-1)), y=f(arr[i]); if(i) g.lineTo(x,y); else g.moveTo(x,y); } g.stroke(); g.setLineDash([]); };
  line(sQ,yQ,'rgba(238,243,247,.75)',[4,3]); line(sTd,yT,INK.green); line(sT,yT,INK.red);
  /* wind arrows along the top of the strip: drawn as the arrow the wind blows along, north up */
  if(S.show.wind){ g.strokeStyle=INK.mute; g.fillStyle=INK.mute; g.lineWidth=1.2; const st=narrow?200:100;
    for(let k=-350;k<=850;k+=st){ const d=pw(sfc().dir,k)*Math.PI/180, x=X(k), y=y0+10, r=7; const ux=-Math.sin(d)*r, uy=Math.cos(d)*r; // blowing towards dir+180
      g.beginPath(); g.moveTo(x-ux,y-uy); g.lineTo(x+ux,y+uy); g.stroke(); const a=Math.atan2(uy,ux); g.beginPath(); g.moveTo(x+ux,y+uy); g.lineTo(x+ux-4*Math.cos(a-0.5),y+uy-4*Math.sin(a-0.5)); g.lineTo(x+ux-4*Math.cos(a+0.5),y+uy-4*Math.sin(a+0.5)); g.closePath(); g.fill(); } }
  txt(g,L(t2('surface','bakken')),xa+4,y0+12,INK.dim,'left',9.5);
  txt(g,'T',xb-4,yT(sT[NS-1])-4,INK.red,'right',10,600); txt(g,'Td',xb-4,yT(sTd[NS-1])+12,INK.green,'right',10,600); txt(g,'QNH',xa+4,yQ(sQ[0])-5,'#EEF3F7','left',10,600);
  LY.yT=yT; }
function seedDrops(){ nd=0; let tot=0; for(const p of G.P) tot+=Math.max(0,Math.min(KM1,p.x1)-Math.max(KM0,p.x0))*p.i; if(tot<=0) return;
  for(const p of G.P){ const w=Math.max(0,Math.min(KM1,p.x1)-Math.max(KM0,p.x0)); let n=Math.round(ND*w*p.i/tot); for(let k=0;k<n&&nd<ND;k++){ const x=Math.max(KM0,p.x0)+Math.random()*w, b=cloudBase(x); if(b<=0) continue;
      const cl=column(x,precipTop(x)); dX[nd]=x; dTop[nd]=b; dPh[nd]=Math.random(); dMelt[nd]=cl.melt; dFrz[nd]=cl.frz; dSp[nd]=p.k==='dz'?0.35:p.k==='ts'?1.15:0.8; nd++; } } }

/* ---------------- per frame: blit, drops, aircraft, cursor ---------------- */
let tNow=0;
function drawJet(g,x,y,s){ g.save(); g.translate(x,y); g.scale(-s,s); // nose to the left (flying towards the front from ahead)
  g.fillStyle='#E8EEF2'; g.strokeStyle='rgba(10,14,18,.9)'; g.lineWidth=0.8/s;
  g.beginPath(); g.moveTo(-17,-1.2); g.bezierCurveTo(-14,-3.4,-6,-3.6,8,-3.4); g.bezierCurveTo(13,-3.3,16.5,-2,18,0); g.bezierCurveTo(16.5,1.8,13,2.6,8,2.7); g.lineTo(-12,2.6); g.bezierCurveTo(-15,2.4,-17,1.4,-17,-1.2); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-11,-3.2); g.lineTo(-16.5,-10.5); g.lineTo(-13.6,-10.5); g.lineTo(-6.5,-3.4); g.closePath(); g.fill(); g.stroke();
  g.fillStyle='#B7C3CC'; g.beginPath(); g.moveTo(-2,0.6); g.lineTo(5,0.6); g.lineTo(-4,4.6); g.lineTo(-7,4.6); g.closePath(); g.fill();
  g.fillStyle='#9AA8B3'; g.beginPath(); g.ellipse(1,3.6,3.6,1.3,0,0,Math.PI*2); g.fill();
  g.fillStyle='#2B4A63'; g.beginPath(); g.moveTo(13.2,-2.4); g.lineTo(15.4,-1.4); g.lineTo(13.2,-1.2); g.closePath(); g.fill();
  g.restore(); }
function frame(){ if(!C.w) return; const g=C.ctx, W=C.w, H=C.h; g.setTransform(1,0,0,1,0,0); g.drawImage(stat,0,0); g.setTransform(C.dpr,0,0,C.dpr,0,0);
  /* drops */
  const t=tNow; g.lineWidth=1;
  for(let pass=0;pass<3;pass++){ g.beginPath(); for(let i=0;i<nd;i++){ const top=dTop[i]; let f=(dPh[i]+t*dSp[i]*0.32)%1; const z=top*(1-f); const x=X(dX[i]), y=Y(z);
      const kind=dMelt[i]<0||z>dMelt[i]?2:(dFrz[i]>=0&&z<dFrz[i]?1:0); if(kind!==pass) continue;
      if(pass===2){ g.rect(x,y,1.8,1.8); } else { g.moveTo(x,y); g.lineTo(x-1.2,y+6); } }
    if(pass===2){ g.fillStyle='rgba(225,236,245,.85)'; g.fill(); } else { g.strokeStyle=pass===1?'rgba(255,120,170,.95)':'rgba(140,190,235,.75)'; g.stroke(); } }
  /* aircraft and cursor */
  const ax=X(S.d), ay=Y(S.alt); g.strokeStyle='rgba(228,107,174,.75)'; g.setLineDash([2,4]); g.lineWidth=1; g.beginPath(); g.moveTo(ax,ay+6); g.lineTo(ax,LY.yG); g.stroke(); g.setLineDash([]);
  g.strokeStyle=INK.mag; g.lineWidth=1.2; g.beginPath(); g.moveTo(ax,LY.yS0); g.lineTo(ax,LY.yS1); g.stroke();
  if(LY.yT){ g.fillStyle=INK.red; g.beginPath(); g.arc(ax,LY.yT(tSfc(S.d)),3,0,Math.PI*2); g.fill(); g.fillStyle=INK.green; g.beginPath(); g.arc(ax,LY.yT(tdSfc(S.d)),3,0,Math.PI*2); g.fill(); }
  drawJet(g,ax,ay,W<560?1.05:1.3);
}
/* ---------------- readout ---------------- */
const HZ=[t2('nil','ingen'),t2('light','lett'),t2('moderate','moderat'),t2('severe','kraftig')];
const CNAME={ci:t2('cirrus','cirrus'),cs:t2('cirrostratus','cirrostratus'),as:t2('altostratus','altostratus'),ns:t2('nimbostratus','nimbostratus'),sc:t2('stratocumulus','stratocumulus'),cu:t2('cumulus','cumulus'),cb:t2('cumulonimbus','cumulonimbus'),emb:t2('embedded CB','innleiret CB'),anv:t2('CB anvil','CB-ambolt')};
let RO={};
function readout(){ if(!G.C) return; const x=S.d, z=S.alt, c=cloudAt(x,z), T=G.T(x,z), w=windAt(x,z), ic=icing(x,z,c), tu=turb(x,z,c), p=precipAt(x);
  const b=cloudBase(x); let pr=null, fzra=false; if(p&&b>0&&z<=b){ const cl=column(x,precipTop(x)); const snow=cl.melt<0||z>cl.melt; fzra=!snow&&cl.frz>=0&&z<cl.frz; pr=fzra?t2('freezing rain','underkjølt regn'):snow?t2('snow','snø'):p.k==='dz'?t2('drizzle','yr'):p.k==='ra'?t2('rain','regn'):t2('showers','byger'); }
  const qx=qnh(x), dq=qnh(x-10)-qx; const tr=Math.abs(dq)<0.05?t2('steady','jevnt'):dq>0?t2('rising','stiger'):t2('falling','faller');
  const hrs=Math.abs(x)/(S.spd*1.852);
  RO={x,z,c,T,w,ic,tu,pr,fzra,qx,tr,hrs};
  const pos=(x>0?'+':x<0?'−':'')+Math.abs(Math.round(x))+' km', alt=z>=10000?'FL'+Math.round(z/100):nf(z,0)+' ft';
  const inn=c?L(CNAME[c.k])+(pr?' · '+L(pr):''):pr?L(t2('below cloud','under skyen'))+' · '+L(pr):L(t2('clear air','klar luft'));
  const passTxt=Math.abs(x)<5?L(t2('passing now','passerer nå')):x>0?L(t2('in','om'))+' '+nf(hrs,0)+' h':L(t2('passed','passert'))+' '+nf(hrs,0)+' h '+L(t2('ago','siden'));
  el('chip').innerHTML=`<span><i>${L(t2('AIRCRAFT','FLY'))}</i><b>${pos} · ${alt}</b></span><span><i>OAT</i><b class="${T<=0?'':'a'}">${T>0?'+':T<0?'−':''}${nf(Math.abs(T),0)} °C</b></span><span><i>${L(t2('WIND','VIND'))}</i><b>${String(Math.round(w[0]/10)*10||360).padStart(3,'0')}°/${nf(w[1],0)} kt</b></span><span class="hx"><i>QNH (${L(tr)})</i><b>${nf(qx,0)} hPa</b></span><span><i>${L(t2('IN','I'))}</i><b class="${c&&(c.k==='cb'||c.k==='emb')?'r':''}">${inn}</b></span><span><i>${L(t2('ICING · TURB','ISING · TURB'))}</i><b class="${ic>=3||tu>=3?'r':ic||tu?'a':'g'}">${L(HZ[ic])} · ${L(HZ[tu])}</b></span><span class="hx"><i>${L(t2('FRONT','FRONT'))}</i><b>${passTxt}</b></span>`;
  el('xsv').textContent=L(FN[S.type])+' · '+(S.view==='sec'?pos+' · '+alt:'+'+nf(S.t,0)+' h');
  see(); live(); }
const FN={warm:t2('Warm front','Varmfront'),cold:t2('Cold front','Kaldfront'),occl:t2('Occlusion','Okklusjon')};

/* ---------------- plan view: a frontal depression over 72 h ---------------- */
const cp=el('fpCv'); const CP=LAB.fit(cp,()=>planDraw(),2);
const NP=32, PWf=new Float32Array(2*NP), PCf=new Float32Array(2*NP), POf=new Float32Array(2*NP), PSf=new Float32Array(2*NP);
const NXp=92, NYp=58, pF=new Float32Array(NXp*NYp), rF=new Float32Array(NXp*NYp);
const loP=document.createElement('canvas'); loP.width=NXp; loP.height=NYp; const imP=loP.getContext('2d').createImageData(NXp,NYp);
const PG={stat:true,cu:0,cv:0,tu:0,tv:0,q:0,gg:0,occ:0,dp:0,pmin:0,hasO:false,tr:0};
const UW=1600, VW=1000, D2R=Math.PI/180;
function quad(a,ax,ay,bx,by,bulge){ const dx=bx-ax, dy=by-ay, l=Math.hypot(dx,dy)||1, nx=-dy/l, ny=dx/l, cx=(ax+bx)/2+nx*bulge*l, cy=(ay+by)/2+ny*bulge*l;
  for(let i=0;i<NP;i++){ const t=i/(NP-1), u=1-t; a[2*i]=u*u*ax+2*u*t*cx+t*t*bx; a[2*i+1]=u*u*ay+2*u*t*cy+t*t*by; } }
function planGeo(){ const s=S.t/72; PG.cu=560+380*s; PG.cv=470+170*s;
  if(s<0.12){ PG.stat=true; const a=80*s/0.12; for(let i=0;i<NP;i++){ const u=40+i*(1520/(NP-1)); PSf[2*i]=u; PSf[2*i+1]=480+(u-800)*0.04+a*Math.exp(-Math.pow((u-PG.cu)/170,2)); }
    PG.dp=2+20*s; PG.tr=1.5; PG.hasO=false; PG.q=0; PG.gg=0; PG.occ=0; PG.tu=PG.cu; PG.tv=PG.cv; return; }
  PG.stat=false; const q=(s-0.12)/0.88, occ=clamp((q-0.42)/0.58,0,1), gg=clamp(q/0.35,0,1); PG.q=q; PG.occ=occ; PG.gg=gg;
  const Lo=occ*430, to=-62*D2R; PG.tu=PG.cu+Lo*Math.cos(to); PG.tv=PG.cv+Lo*Math.sin(to); PG.hasO=Lo>60;
  if(PG.hasO) quad(POf,PG.cu,PG.cv,PG.tu,PG.tv,0.12);
  const tw=(-4-10*gg-14*occ)*D2R, tc=(-176+56*gg+30*occ)*D2R, Lw=700-220*gg, Lc=720-60*gg;
  quad(PWf,PG.tu,PG.tv,PG.tu+Lw*Math.cos(tw),PG.tv+Lw*Math.sin(tw),0.10*gg);
  quad(PCf,PG.tu,PG.tv,PG.tu+Lc*Math.cos(tc),PG.tv+Lc*Math.sin(tc),-0.12*gg);
  PG.dp=5+27*Math.min(1,q/0.6)-16*Math.max(0,(q-0.75)/0.25); PG.tr=2+4*gg; }
/* signed distance to a polyline (+ on the left, the direction the front moves); NaN past the ends */
const SD={d:0,s:0,inside:true,ext:0};
function sdist(a,u,v){ let best=1e9, sg=1, ext=0;
  for(let i=0;i<NP-1;i++){ const ax=a[2*i],ay=a[2*i+1],bx=a[2*i+2],by=a[2*i+3], dx=bx-ax, dy=by-ay, l2=dx*dx+dy*dy||1; let t=((u-ax)*dx+(v-ay)*dy)/l2; const raw=t; t=clamp(t,0,1);
    const px=ax+t*dx-u, py=ay+t*dy-v, d=Math.hypot(px,py); if(d<best){ best=d; sg=(dx*(v-ay)-dy*(u-ax))>=0?1:-1; const l=Math.sqrt(l2); ext=i===0&&raw<0?-raw*l:i===NP-2&&raw>1?(raw-1)*l:0; } }
  SD.d=best; SD.s=sg; SD.ext=ext; SD.inside=ext<=0; return SD; }
const band=(sd,a,b,soft)=>clamp(Math.min(sd-a,b-sd)/soft,0,1);
function planField(){ let mn=2000; for(let j=0;j<NYp;j++){ const v=VW-j*VW/(NYp-1); for(let i=0;i<NXp;i++){ const u=i*UW/(NXp-1), o=j*NXp+i; let r=0, dmin=1e9;
      const r2=(u-PG.cu)*(u-PG.cu)+(v-PG.cv)*(v-PG.cv); const base=1013+0.012*(500-v)-PG.dp*Math.exp(-r2/(380*380))+10*Math.exp(-((u-250)*(u-250)+(v-120)*(v-120))/(420*420));
      if(PG.stat){ const d=sdist(PSf,u,v); dmin=d.d; r=0.3*band(d.d*d.s,-40,160,50)*clamp(1-d.ext/80,0,1); }
      else { let d=sdist(PWf,u,v), sd=d.d*d.s; dmin=d.d; r=Math.max(r,(0.2+0.35*(1-clamp(sd,0,280)/280))*band(sd,-30,280,50)*clamp(1-d.ext/90,0,1));
        d=sdist(PCf,u,v); sd=d.d*d.s; dmin=Math.min(dmin,d.d); r=Math.max(r,0.6*band(sd,-55,55,25)*clamp(1-d.ext/60,0,1));
        if(PG.hasO){ d=sdist(POf,u,v); sd=d.d*d.s; dmin=Math.min(dmin,d.d); r=Math.max(r,0.45*band(sd,-90,210,50)*clamp((260-d.d)/50,0,1)); } }
      pF[o]=base-PG.tr*Math.max(0,1-dmin/220); if(pF[o]<mn) mn=pF[o];
      rF[o]=r; const p=o*4; imP.data[p]=90; imP.data[p+1]=200; imP.data[p+2]=130; imP.data[p+3]=Math.round(r*120); } }
  PG.pmin=mn; loP.getContext('2d').putImageData(imP,0,0); }
const PL={s:1,ox:0,oy:0};
const PX=u=>PL.ox+u*PL.s, PY=v=>PL.oy+(VW-v)*PL.s;
function frontLine(g,a,k,full){ g.strokeStyle=k==='stat'?'#C9D2DA':FC[k]; g.lineWidth=2.6; g.beginPath(); for(let i=0;i<NP;i++){ const x=PX(a[2*i]), y=PY(a[2*i+1]); if(i) g.lineTo(x,y); else g.moveTo(x,y); } g.stroke();
  /* symbols every ~28 px on the side the front moves to */
  let acc=14, n=0; const sp=PL.s*1600<560?22:30;
  for(let i=0;i<NP-1;i++){ const x0=PX(a[2*i]),y0=PY(a[2*i+1]),x1=PX(a[2*i+2]),y1=PY(a[2*i+3]), l=Math.hypot(x1-x0,y1-y0); if(!l) continue; const tx=(x1-x0)/l, ty=(y1-y0)/l, nx=ty, ny=-tx; // left of travel in screen coords (y down)
    while(acc<l){ const px=x0+tx*acc, py=y0+ty*acc; let kind=k==='warm'?'w':k==='cold'?'c':(n%2?'w':'c'); let sx=nx, sy=ny;
      if(k==='stat'){ kind=n%2?'w':'c'; if(kind==='c'){ sx=-nx; sy=-ny; } }
      g.fillStyle=k==='stat'?(kind==='w'?FC.warm:FC.cold):FC[k];
      g.beginPath(); if(kind==='w'){ const a0=Math.atan2(ty,tx); g.arc(px,py,5.5,a0+Math.PI,a0,sx===nx?false:true); }
      else { g.moveTo(px-tx*6,py-ty*6); g.lineTo(px+sx*9,py+sy*9); g.lineTo(px+tx*6,py+ty*6); g.closePath(); } g.fill(); acc+=sp; n++; }
    acc-=l; } }
function planDraw(){ planGeo(); if(!CP.w){ planField(); live(); return; } const g=CP.ctx, W=CP.w, H=CP.h; planField();
  PL.s=Math.min(W/UW,H/VW); PL.ox=(W-UW*PL.s)/2; PL.oy=(H-VW*PL.s)/2;
  const bg=g.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#16202a'); bg.addColorStop(1,'#111921'); g.fillStyle=bg; g.fillRect(0,0,W,H);
  g.save(); g.beginPath(); g.rect(PX(0),PY(VW),UW*PL.s,VW*PL.s); g.clip();
  /* faint lat/long grid */
  g.strokeStyle='rgba(255,255,255,.04)'; g.lineWidth=1; g.beginPath(); for(let u=0;u<=UW;u+=200){ g.moveTo(PX(u),PY(0)); g.lineTo(PX(u),PY(VW)); } for(let v=0;v<=VW;v+=200){ g.moveTo(PX(0),PY(v)); g.lineTo(PX(UW),PY(v)); } g.stroke();
  /* warm sector */
  if(!PG.stat&&PG.gg>0.15){ const n=NP-1, wx=PWf[2*n], wy=PWf[2*n+1], cx=PCf[2*n], cy=PCf[2*n+1];
    const wdx=wx-PG.tu, wdy=wy-PG.tv, wl=Math.hypot(wdx,wdy), cdx=cx-PG.tu, cdy=cy-PG.tv, cl=Math.hypot(cdx,cdy);
    g.fillStyle='rgba(240,172,84,.08)'; g.beginPath(); g.moveTo(PX(PG.tu),PY(PG.tv)); for(let i=1;i<NP;i++) g.lineTo(PX(PWf[2*i]),PY(PWf[2*i+1]));
    g.lineTo(PX(wx+wdy/wl*320),PY(wy-wdx/wl*320)); g.lineTo(PX(cx-cdy/cl*320),PY(cy+cdx/cl*320)); for(let i=NP-1;i>=0;i--) g.lineTo(PX(PCf[2*i]),PY(PCf[2*i+1])); g.closePath(); g.fill(); }
  /* rain areas */
  if(S.show.rain){ g.imageSmoothingEnabled=true; const dx=UW*PL.s/(NXp-1), dy=VW*PL.s/(NYp-1); g.drawImage(loP,0,0,NXp,NYp,PX(0)-dx/2,PY(VW)-dy/2,NXp*dx,NYp*dy); }
  /* isobars */
  const dx=UW*PL.s/(NXp-1), dy=VW*PL.s/(NYp-1); let pmin=2000,pmax=0; for(let i=0;i<pF.length;i++){ pmin=Math.min(pmin,pF[i]); pmax=Math.max(pmax,pF[i]); } PG.pmin=pmin;
  g.strokeStyle='rgba(200,212,222,.55)'; g.lineWidth=1.1; g.beginPath(); for(let lev=Math.ceil(pmin/4)*4;lev<=pmax;lev+=4) iso(g,pF,NXp,NYp,lev,PX(0),PY(VW),dx,dy); g.stroke();
  g.font=`10px ${MONO}`; g.fillStyle='rgba(200,212,222,.75)'; g.textAlign='left';
  for(let lev=Math.ceil(pmin/4)*4;lev<=pmax;lev+=(W<560?8:4)){ for(let j=0;j<NYp-1;j++){ const a=pF[j*NXp+1], b=pF[(j+1)*NXp+1]; if((a-lev)*(b-lev)<0){ const y=PY(VW)+(j+(lev-a)/(b-a))*dy; g.fillText(String(lev),PX(0)+4,y-2); break; } } }
  /* jet stream */
  if(S.show.jet&&!PG.stat){ const n=NP-1; const ax=PCf[2*n]-260, ay=PCf[2*n+1]-40, bx=PG.tu-170, by=PG.tv+120, ex=PWf[2*n]-60, ey=PWf[2*n+1]+330;
    g.strokeStyle='rgba(127,203,232,.20)'; g.lineWidth=12; g.lineCap='round'; g.beginPath(); g.moveTo(PX(ax),PY(ay)); g.quadraticCurveTo(PX(bx),PY(by),PX(ex),PY(ey)); g.stroke(); g.lineCap='butt';
    const a=Math.atan2(PY(ey)-PY(by),PX(ex)-PX(bx)); g.fillStyle='rgba(127,203,232,.55)'; g.beginPath(); g.moveTo(PX(ex)+10*Math.cos(a),PY(ey)+10*Math.sin(a)); g.lineTo(PX(ex)+10*Math.cos(a+2.4),PY(ey)+10*Math.sin(a+2.4)); g.lineTo(PX(ex)+10*Math.cos(a-2.4),PY(ey)+10*Math.sin(a-2.4)); g.closePath(); g.fill();
    txt(g,L(t2('jet ~FL300','jet ~FL300')),PX(bx)-6,PY(by)-12,INK.cyan,'right',10.5); }
  /* fronts */
  if(PG.stat) frontLine(g,PSf,'stat'); else { frontLine(g,PCf,'cold'); frontLine(g,PWf,'warm'); if(PG.hasO) frontLine(g,POf,'occl'); }
  /* wind arrows */
  if(S.show.wind){ g.strokeStyle='rgba(238,243,247,.55)'; g.fillStyle='rgba(238,243,247,.55)'; g.lineWidth=1.1; const st=W<560?9:7;
    for(let j=4;j<NYp-2;j+=st) for(let i=4;i<NXp-2;i+=st){ const o=j*NXp+i; const dpu=(pF[o+1]-pF[o-1])/(2*UW/(NXp-1)), dpv=(pF[o-NXp]-pF[o+NXp])/(2*VW/(NYp-1));
      let ue=-dpv, vn=dpu; const c=Math.cos(20*D2R), s2=Math.sin(20*D2R); const ur=ue*c-vn*s2, vr=ue*s2+vn*c; const m=Math.hypot(ur,vr); if(m<1e-6) continue;
      const len=clamp(m*900,5,15), x=PX(i*UW/(NXp-1)), y=PY(VW-j*VW/(NYp-1)), ux=ur/m*len, uy=-vr/m*len;
      g.beginPath(); g.moveTo(x-ux/2,y-uy/2); g.lineTo(x+ux/2,y+uy/2); g.stroke(); const a=Math.atan2(uy,ux); g.beginPath(); g.moveTo(x+ux/2,y+uy/2); g.lineTo(x+ux/2-4*Math.cos(a-0.5),y+uy/2-4*Math.sin(a-0.5)); g.lineTo(x+ux/2-4*Math.cos(a+0.5),y+uy/2-4*Math.sin(a+0.5)); g.closePath(); g.fill(); } }
  /* cross-section line through the chosen front, with the aircraft */
  const fa=S.type==='warm'?(PG.stat?null:PWf):S.type==='cold'?(PG.stat?null:PCf):(PG.hasO?POf:null);
  PG.secOk=!!fa; if(fa){ const m=Math.round((NP-1)*(fa===POf?0.6:0.35)), ax=fa[2*m], ay=fa[2*m+1], tx=fa[2*m+2]-fa[2*m-2], ty=fa[2*m+3]-fa[2*m-1], tl=Math.hypot(tx,ty), nx=-ty/tl, ny=tx/tl;
    g.strokeStyle='rgba(228,107,174,.8)'; g.lineWidth=1.3; g.setLineDash([5,4]); g.beginPath(); g.moveTo(PX(ax-400*nx),PY(ay-400*ny)); g.lineTo(PX(ax+900*nx),PY(ay+900*ny)); g.stroke(); g.setLineDash([]);
    g.fillStyle=INK.mag; g.beginPath(); g.arc(PX(ax+S.d*nx),PY(ay+S.d*ny),4.5,0,Math.PI*2); g.fill();
    { let k=880; while(k>200&&(ax+k*nx<60||ax+k*nx>UW-60||ay+k*ny<40||ay+k*ny>VW-40)) k-=40; txt(g,L(t2('cross-section','snitt')),PX(ax+k*nx),PY(ay+k*ny)-8,INK.mag,'center',10); } }
  /* air labels, L and H */
  const n2=W<560?10:11.5;
  if(PG.stat){ txt(g,L(t2('cold air (mP)','kald luft (mP)')),PX(800),PY(760),INK.blue,'center',n2,600); txt(g,L(t2('warm air (mT)','varm luft (mT)')),PX(800),PY(220),INK.amber,'center',n2,600); }
  else { txt(g,L(t2('cold air','kald luft')),PX(PG.cu-360),PY(PG.cv+240),INK.blue,'center',n2,600); txt(g,L(t2('cold air','kald luft')),PX(PG.cu+420),PY(PG.cv+260),INK.blue,'center',n2,600);
    if(PG.gg>0.25){ const n=NP-1; const wx=(PG.tu+PWf[2*n]*0.5+PCf[2*n]*0.5)/2, wy=(PG.tv+PWf[2*n+1]*0.5+PCf[2*n+1]*0.5)/2; txt(g,L(t2('warm sector (mT)','varm sektor (mT)')),PX(wx+60),PY(wy-30),INK.amber,'center',n2,600); } }
  g.font=`700 ${W<560?17:22}px ${BODY}`; g.textAlign='center'; g.fillStyle='#FF8A7A'; g.fillText('L',PX(PG.cu),PY(PG.cv)+7); txt(g,nf(pmin,0),PX(PG.cu),PY(PG.cv)+22,'#FFB4A8','center',10);
  if(PX(250)>PX(0)){ g.font=`700 ${W<560?15:19}px ${BODY}`; g.fillStyle='#8FD3A8'; g.fillText('H',PX(250),PY(120)+7); }
  g.restore();
  planRO(); }
const STG=()=>{ const s=S.t/72; if(s<0.12) return t2('Polar front: a stationary front','Polarfronten: en stasjonær front'); const q=PG.q; return q<0.3?t2('A wave forms','En bølge dannes'):q<0.45?t2('Open wave: a clear warm sector','Åpen bølge: tydelig varm sektor'):q<0.75?t2('Occlusion forming: the cold front catches up','Okklusjon dannes: kaldfronten tar igjen'):t2('Occluded and filling','Okkludert og fylles opp'); };
function planRO(){ el('chipP').innerHTML=`<span><i>${L(t2('STAGE','STADIUM'))}</i><b>${L(STG())}</b></span><span><i>${L(t2('TIME','TID'))}</i><b>+${nf(S.t,0)} h</b></span><span><i>${L(t2('LOW CENTRE','SENTER'))}</i><b>${nf(PG.pmin,0)} hPa</b></span>`+(PG.secOk?'':`<span class="hx"><i>${L(t2('CROSS-SECTION','SNITT'))}</i><b class="a">${L(t2('no occlusion yet','ingen okklusjon ennå'))}</b></span>`);
  if(S.view==='plan') el('xsv').textContent=L(STG())+' · +'+nf(S.t,0)+' h'; see(); live(); }

/* ---------------- views, controls, scenarios ---------------- */
const VIEWS=[['sec',t2('Cross-section','Vertikalsnitt')],['plan',t2('Plan view: life cycle','Kart: livssyklus')]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t])=>`<button type="button" role="tab" data-v="${k}" class="${k===S.view?'on':''}" aria-selected="${k===S.view}">${L(t)}</button>`).join('');
  const playing=S.view==='sec'?S.fly:S.run; el('vtools').innerHTML=`<button type="button" class="${playing?'on':'go'}" id="flyB" aria-pressed="${playing}">${playing?'■ '+L(t2('Stop','Stopp')):S.view==='sec'?'▶ '+L(t2('Fly through','Fly gjennom')):'▶ '+L(t2('Run 72 h','Kjør 72 t'))}</button>`; }
function setView(v){ S.view=v; S.fly=false; S.run=false; el('vSec').hidden=v!=='sec'; el('vPlan').hidden=v!=='plan'; el('secCtl').hidden=v!=='sec'; el('planCtl').hidden=v!=='plan';
  drawTabs(); drawTogs(); legend(); if(v==='plan') planDraw(); else { readout(); dirty=true; } }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setView(b.dataset.v); });
el('vtools').addEventListener('click',e=>{ if(!e.target.closest('#flyB')) return;
  if(S.view==='sec'){ S.fly=!S.fly; if(S.fly&&S.d<=KM0+20){ S.d=KM1; } } else { S.run=!S.run; if(S.run&&S.t>=72) S.t=0; } drawTabs(); });
LAB.add({},{'Warm':'Varm','Cold':'Kald','Occluded':'Okkludert','Cold type':'Kald type','Warm type':'Varm type','Stable':'Stabil','Unstable':'Ustabil','Summer':'Sommer','Winter':'Vinter',
  'Aircraft position (km from the surface front)':'Flyets posisjon (km fra bakkefronten)','Altitude':'Høyde','Time (h)':'Tid (t)','Warm front slope (1:N)':'Helning varmfront (1:N)','Cold front slope (1:N)':'Helning kaldfront (1:N)','Front speed (kt)':'Frontens fart (kt)'});
const segF=LAB.seg(el('sFront'),[['warm','Warm'],['cold','Cold'],['occl','Occluded']],S.type,v=>{ S.type=v; changed(); });
const segO=LAB.seg(el('sOcc'),[['cold','Cold type'],['warm','Warm type']],S.occ,v=>{ S.occ=v; changed(); });
const segS=LAB.seg(el('sStab'),[['stable','Stable'],['unstable','Unstable']],S.stab,v=>{ S.stab=v; changed(); });
const segW=LAB.seg(el('sSeas'),[['summer','Summer'],['winter','Winter']],S.season,v=>{ S.season=v; changed(); });
const fmtAlt=v=>v>=10000?'FL'+Math.round(v/100):nf(v,0)+' ft';
const slD=LAB.slider(el('secCtl'),{label:'Aircraft position (km from the surface front)',min:KM0,max:KM1,step:10,v:S.d,f:v=>(v>0?'+':v<0?'−':'')+Math.abs(v)+' km '+(v>0?L(t2('ahead','foran')):v<0?L(t2('behind','bak')):''),on:v=>{ S.d=v; S.fly=false; drawTabs(); moved(); }});
const slA=LAB.slider(el('secCtl'),{label:'Altitude',min:500,max:34000,step:500,v:S.alt,f:fmtAlt,on:v=>{ S.alt=v; moved(); }});
const slT=LAB.slider(el('planCtl'),{label:'Time (h)',min:0,max:72,step:1,v:S.t,f:v=>'+'+v+' h',on:v=>{ S.t=v; S.run=false; drawTabs(); planDraw(); }});
const slNw=LAB.slider(el('adv'),{label:'Warm front slope (1:N)',min:100,max:250,step:10,v:S.Nw,f:v=>'1:'+v,on:v=>{ S.Nw=v; changed(); }});
const slNc=LAB.slider(el('adv'),{label:'Cold front slope (1:N)',min:50,max:120,step:5,v:S.Nc,f:v=>'1:'+v,on:v=>{ S.Nc=v; changed(); }});
const slV=LAB.slider(el('adv'),{label:'Front speed (kt)',min:10,max:40,step:5,v:S.spd,f:v=>v+' kt',on:v=>{ S.spd=v; readout(); }});
const TOGS=[['ice',t2('Icing','Ising'),'sec'],['turb',t2('Turbulence','Turbulens'),'sec'],['fz',t2('0 °C level','0 °C-nivå'),'sec'],['jet',t2('Jet stream','Jetstrøm'),'both'],['wind',t2('Wind arrows','Vindpiler'),'both'],['rain',t2('Rain areas','Nedbørsområder'),'plan']];
function drawTogs(){ el('togs').innerHTML=TOGS.filter(t=>t[2]==='both'||t[2]===S.view).map(([k,t])=>`<button type="button" class="xtog${S.show[k]?' on':''}" data-k="${k}" aria-pressed="${!!S.show[k]}">${L(t)}</button>`).join(''); }
el('togs').addEventListener('click',e=>{ const b=e.target.closest('[data-k]'); if(!b) return; S.show[b.dataset.k]=!S.show[b.dataset.k]; drawTogs(); legend(); if(S.view==='plan') planDraw(); else rebuild(); });
const PRE=[
 ['wsum',t2('Warm front: the sky lowers','Varmfront: himmelen senkes'),{view:'sec',type:'warm',stab:'stable',season:'summer',d:700,alt:9000}],
 ['fzra',t2('Winter: freezing rain','Vinter: underkjølt regn'),{view:'sec',type:'warm',stab:'stable',season:'winter',d:70,alt:1000}],
 ['cbl',t2('Cold front: CB line','Kaldfront: CB-linje'),{view:'sec',type:'cold',stab:'unstable',season:'summer',d:120,alt:10000}],
 ['cst',t2('Cold front, stable warm air','Kaldfront, stabil varm luft'),{view:'sec',type:'cold',stab:'stable',season:'summer',d:-60,alt:6000}],
 ['occ',t2('Occlusion: hidden CB','Okklusjon: skjulte CB'),{view:'sec',type:'occl',occ:'cold',stab:'unstable',season:'summer',d:-10,alt:14000}],
 ['life',t2('Life cycle: wave to occlusion','Livssyklus: bølge til okklusjon'),{view:'plan',t:0,run:true}]];
let cur=null;
function drawPre(){ el('pre').innerHTML=PRE.map(([k,t])=>`<button class="btn sm${k===cur?' on':''}" type="button" data-k="${k}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const p=PRE.find(x=>x[0]===b.dataset.k); if(p) setS(p[2],p[0]); });
function setS(o,k){ const run=o.run; Object.assign(S,o); cur=k||null; segF.set(S.type); segO.set(S.occ); segS.set(S.stab); segW.set(S.season); slD.set(S.d); slA.set(S.alt); slT.set(S.t);
  el('occBox').hidden=S.type!=='occl'; drawPre(); rebuild(); setView(S.view); if(run){ S.run=true; drawTabs(); } }
function changed(){ cur=null; drawPre(); el('occBox').hidden=S.type!=='occl'; rebuild(); if(S.view==='plan') planDraw(); legend(); }
function moved(){ cur=null; readout(); dirty=true; }
/* drag the aircraft (desktop) or tap to place it */
let drag=false;
function toModel(e){ const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top; return [x,y]; }
cv.addEventListener('pointerdown',e=>{ const [x,y]=toModel(e); if(Math.hypot(x-X(S.d),y-Y(S.alt))<30){ drag=true; cv.setPointerCapture(e.pointerId); e.preventDefault(); } });
cv.addEventListener('pointermove',e=>{ const [x,y]=toModel(e); if(!drag){ cv.style.cursor=Math.hypot(x-X(S.d),y-Y(S.alt))<30?'grab':''; return; } place(x,y); });
cv.addEventListener('pointerup',()=>{ drag=false; });
cv.addEventListener('click',e=>{ if(drag) return; const [x,y]=toModel(e); if(y<LY.yG&&y>LY.T0) place(x,y); });
function place(x,y){ S.d=clamp(Math.round(XI(x)/10)*10,KM0,KM1); S.alt=clamp(Math.round(YI(y)/500)*500,500,34000); S.fly=false; slD.set(S.d); slA.set(S.alt); drawTabs(); moved(); }
/* legend and the "what you're seeing" line */
function legend(){ const lg=(c,t,cls)=>`<span><i class="${cls||''}" style="--c:${c}"></i>${L(t)}</span>`;
  el('vleg').innerHTML=S.view==='sec'?
    lg(FC[S.type==='occl'?'occl':S.type],t2('frontal surface','frontflate'))+(S.show.fz?lg('#CFEFFF',t2('0 °C','0 °C'),'d'):'')+(S.show.ice?lg('#7FCBE8',t2('icing','ising'),'a'):'')+(S.show.turb?lg('#F0B440',t2('turbulence','turbulens'),'a'):'')+lg('#8CBEEB',t2('rain','regn'))+lg('#E1ECF5',t2('snow','snø'),'dot')+lg('#FF78AA',t2('freezing rain','underkjølt regn'))
   :lg(FC.warm,t2('warm front','varmfront'))+lg(FC.cold,t2('cold front','kaldfront'))+lg(FC.occl,t2('occlusion','okklusjon'))+lg('#C8D4DE',t2('isobars, 4 hPa','isobarer, 4 hPa'))+(S.show.rain?lg('#5AC882',t2('rain','nedbør'),'a'):'')+lg('#F0AC54',t2('warm sector','varm sektor'),'a')+(S.show.jet?lg(INK.cyan,t2('jet stream','jetstrøm'),'a'):''); }
function see(){ let s;
  if(S.view==='plan') s=t2('isobars around a low that deepens and then fills. The cold front moves faster than the warm front, the warm sector narrows and the occlusion grows from the low centre. The pink line is the cross-section in the other tab.','isobarer rundt et lavtrykk som blir dypere og så fylles opp. Kaldfronten går fortere enn varmfronten, den varme sektoren smalner, og okklusjonen vokser ut fra sentrum. Den rosa linjen er snittet i den andre fanen.');
  else s={warm:t2('the front comes towards you from the left. Fly in from the right: high thin cloud first, then the cloud lowers and thickens into steady rain. Under the cross-section the surface temperature, dew point, wind and QNH along the route.','fronten kommer mot deg fra venstre. Fly inn fra høyre: høye, tynne skyer først, så senkes og tykner skyene til vedvarende regn. Under snittet: temperatur, duggpunkt, vind og QNH ved bakken langs ruten.'),
    cold:t2('the steep cold front undercuts the warm air and lifts it fast. With unstable warm air a line of CB forms along the front; with stable warm air a narrower band of layer cloud and rain. Watch the wind veer and the temperature and dew point drop at the front.','den bratte kaldfronten skyver seg under den varme luften og løfter den raskt. Med ustabil varm luft dannes en linje med CB langs fronten; med stabil varm luft et smalere bånd med lagskyer og regn. Se vinden dreie og temperatur og duggpunkt falle ved fronten.'),
    occl:t2('the cold front has caught up with the warm front and lifted the warm air off the ground. You get the warm-front cloud sequence ahead and showers or embedded CB at the occlusion, hidden in the layer cloud.','kaldfronten har tatt igjen varmfronten og løftet den varme luften fra bakken. Du får varmfrontens skyrekkefølge foran og byger eller innleirede CB ved okklusjonen, skjult i lagskyene.')}[S.type];
  el('xsee').innerHTML='<b>'+L(t2('What you are seeing:','Dette ser du:'))+'</b> '+L(s); }

/* ---------------- animation loop ---------------- */
let vis=true, dirty=true, last=0, lastRO=0, accP=0;
LAB.visible(el('fxVp'),v=>{ vis=v; });
function loop(ts){ requestAnimationFrame(loop); const dt=Math.min(0.05,((ts||0)-last)/1000); last=ts||0; if(!vis||document.hidden) return;
  if(S.view==='sec'){ if(S.fly){ S.d=Math.max(KM0,S.d-dt*85); if(Math.abs(S.d-lastRO)>=8||S.d<=KM0){ lastRO=S.d; slD.set(Math.round(S.d/10)*10); readout(); } if(S.d<=KM0){ S.fly=false; drawTabs(); } dirty=true; }
    if(!reduce){ tNow+=dt; dirty=true; } if(dirty){ frame(); dirty=false; } }
  else if(S.run){ S.t=Math.min(72,S.t+dt*6); accP+=dt; if(accP>=0.033||S.t>=72){ accP=0; slT.set(Math.round(S.t)); planDraw(); } if(S.t>=72){ S.run=false; drawTabs(); } } }
requestAnimationFrame(loop);

/* ---------------- Try it ---------------- */
let active=null; const ans={}, touched={};
const go=()=>{ const t=el('fxVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const TASKS=[
 {k:'fz',model:1,q:t2('Winter warm front: find the freezing rain. Put the aircraft where rain is falling into sub-zero air.','Varmfront om vinteren: finn det underkjølte regnet. Sett flyet der regn faller ned i kuldegrader.'),
  pre:{view:'sec',type:'warm',stab:'stable',season:'winter',d:400,alt:6000},
  check:()=>{ if(S.season!=='winter') return {ok:0,m:t2('Choose Winter first.','Velg Vinter først.')}; if(S.type==='cold') return {ok:0,m:t2('Freezing rain needs warm air above cold air: try the warm front.','Underkjølt regn krever varm luft over kald: prøv varmfronten.')};
    if(RO.fzra) return {ok:1,m:t2(`Yes: OAT ${nf(RO.T,0)} °C, and the rain above you fell from the warm layer (pink drops). Here it freezes on impact. It sits under the warm nose, close ahead of the surface front, at low level: right where you climb out or descend to land.`,`Ja: OAT ${nf(RO.T,0)} °C, og regnet over deg falt fra det varme laget (rosa dråper). Her fryser det når det treffer. Det ligger under den varme «nesen», like foran bakkefronten, lavt: akkurat der du stiger ut eller går ned for landing.`)};
    if(RO.x>200) return {ok:0,m:t2('Further towards the front: the warm layer (where the 0 °C line bends up) is within about 150 km of the surface front.','Lenger mot fronten: det varme laget (der 0 °C-linjen bøyer opp) ligger innenfor rundt 150 km fra bakkefronten.')};
    return {ok:0,m:t2('Look for the pink drops: below the warm layer, under the frontal surface, at low altitude.','Se etter de rosa dråpene: under det varme laget, under frontflaten, lavt.')}; }},
 {k:'ice',q:t2('Winter, flying through a warm front at low level. Where along the route do you meet the worst icing?','Vinter, lavt gjennom en varmfront. Hvor langs ruten møter du verst ising?'),
  opts:[t2('In the cirrus far ahead','I cirrusen langt foran'),t2('In the Ns and the freezing rain just ahead of the surface front','I Ns og det underkjølte regnet like foran bakkefronten'),t2('In clear air in the warm sector','I klar luft i den varme sektoren'),t2('In the altostratus at FL150','I altostratusen i FL150')],c:1,
  e:t2('Ns holds a lot of supercooled water, and under the warm nose large supercooled drops (freezing rain) give clear ice fast. Cirrus is ice crystals: no airframe icing.','Ns har mye underkjølt vann, og under den varme nesen gir store underkjølte dråper (underkjølt regn) klaris raskt. Cirrus er iskrystaller: ingen ising på flyet.'),
  show:{view:'sec',type:'warm',stab:'stable',season:'winter',d:60,alt:1000}},
 {k:'wind',q:t2('A cold front passes your aerodrome (northern hemisphere). The surface wind before and after?','En kaldfront passerer flyplassen (nordlige halvkule). Bakkevinden før og etter?'),
  opts:[t2('SW before, veers to W–NW after, gusty','SV før, dreier til V–NV etter, kastevis'),t2('SW before, backs to SE after','SV før, dreier til SØ etter'),t2('NW before, backs to SW after','NV før, dreier til SV etter'),t2('No change, only the temperature drops','Ingen endring, bare temperaturen faller')],c:0,
  e:t2('At every front in the northern hemisphere the wind veers as it passes. Behind a cold front: W–NW, gusty, pressure rising sharply, temperature and dew point down, showers and good visibility.','Ved hver front på den nordlige halvkule dreier vinden med klokka når den passerer. Bak en kaldfront: V–NV, kastevis, trykket stiger brått, temperatur og duggpunkt faller, byger og god sikt.'),
  show:{view:'sec',type:'cold',stab:'unstable',season:'summer',d:250,alt:2000,fly:true}},
 {k:'rain',q:t2('Which gives a long period of steady rain at one place?','Hva gir lang tid med vedvarende regn på ett sted?'),
  opts:[t2('A warm front','En varmfront'),t2('A cold front with unstable warm air','En kaldfront med ustabil varm luft'),t2('The cold air behind a cold front','Den kalde luften bak en kaldfront'),t2('The warm sector','Den varme sektoren')],c:0,
  e:()=>t2(`The gentle slope spreads the rain band over about 250–300 km. At a front speed of ${S.spd} kt that is roughly ${nf(270/(S.spd*1.852),0)} hours of rain. The cold front gives heavy rain, but only for a short time.`,`Den slake helningen sprer regnbåndet over rundt 250–300 km. Med frontfart ${S.spd} kt er det omtrent ${nf(270/(S.spd*1.852),0)} timer med regn. Kaldfronten gir kraftig regn, men bare en kort stund.`),
  show:{view:'sec',type:'warm',stab:'stable',season:'summer',d:150,alt:3000}},
 {k:'occ',model:1,q:t2('Plan view: run the depression and stop when the cold front starts to catch up with the warm front.','Kartet: kjør lavtrykket og stopp når kaldfronten begynner å ta igjen varmfronten.'),
  pre:{view:'plan',t:10},
  check:()=>{ if(S.view!=='plan') return {ok:0,m:t2('Open the Plan view tab.','Åpne fanen Kart.')}; if(PG.stat||PG.occ<=0.005) return {ok:0,m:t2('Not yet: the warm sector is still open. Move the time on.','Ikke ennå: den varme sektoren er fortsatt åpen. Gå videre i tid.')};
    if(PG.occ<0.35) return {ok:1,m:t2(`Yes, at about +${nf(S.t,0)} h: a purple occluded front grows out from the low centre. The warm air is lifted off the ground, the low is near its deepest (${nf(PG.pmin,0)} hPa) and will now start to fill.`,`Ja, rundt +${nf(S.t,0)} t: en lilla okklusjonsfront vokser ut fra lavtrykkssenteret. Den varme luften løftes fra bakken, lavtrykket er nær sitt dypeste (${nf(PG.pmin,0)} hPa) og begynner snart å fylles opp.`)};
    return {ok:0,m:t2('A little earlier: the occlusion is already long. Go back to when it first appears.','Litt tidligere: okklusjonen er allerede lang. Gå tilbake til der den først dukker opp.')}; }}];
function drawTasks(){ el('tasks').innerHTML=TASKS.map((t,i)=>`<li class="task" id="task-${t.k}"><span class="n">${L(t2('Task','Oppgave'))} ${i+1}</span><p class="q">${L(t.q)}</p>`+
   (t.model?`<div class="btns"><button type="button" class="btn pri sm" data-go="${t.k}">${L(t2('Do it in the model','Gjør det i modellen'))} ↑</button></div><span class="fb" id="fb-${t.k}"></span>`:'')+
   (t.opts?(()=>{ const a=ans[t.k]; const e=typeof t.e==='function'?t.e():t.e; return `<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-t="${t.k}" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(e):''}</span><div class="btns"><button type="button" class="btn sm" data-show="${t.k}">${L(t2('Show it in the model','Vis i modellen'))} ↑</button></div>`; })():'')+`</li>`).join('');
  live(); drawTbox(); }
function drawTbox(){ const b=el('tbox'); if(!active){ b.hidden=true; return; } const i=TASKS.findIndex(t=>t.k===active);
  b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${i+1}<button type="button" aria-label="${L(t2('Close the task','Lukk oppgaven'))}" id="tclose">×</button></span>${L(TASKS[i].q)}<span class="fb" id="tfb"></span>`;
  el('tclose').onclick=()=>{ active=null; drawTbox(); }; live(); }
function live(){ if(!G.C) return; TASKS.filter(t=>t.model&&touched[t.k]).forEach(t=>{ const r=t.check(), html=L(r.m); const f=el('fb-'+t.k); if(f&&f.innerHTML!==html){ f.innerHTML=html; f.classList.toggle('ok',!!r.ok); } if(active===t.k){ const g=el('tfb'); if(g&&g.innerHTML!==html){ g.innerHTML=html; g.classList.toggle('ok',!!r.ok); } } }); }
el('tasks').addEventListener('click',e=>{ const gb=e.target.closest('[data-go]'), o=e.target.closest('[data-o]'), sh=e.target.closest('[data-show]');
  if(gb){ const t=TASKS.find(x=>x.k===gb.dataset.go); active=t.k; touched[active]=1; if(t.pre) setS(t.pre); drawTbox(); go(); return; }
  if(o){ ans[o.dataset.t]=+o.dataset.o; drawTasks(); return; }
  if(sh){ const t=TASKS.find(x=>x.k===sh.dataset.show); active=null; drawTbox(); const fly=t.show.fly; setS(Object.assign({},t.show,{fly:false})); if(fly){ S.fly=true; drawTabs(); } go(); } });

/* ---------------- Understand: key concept cards ---------------- */
if(window.KCS){ const {sv,tx,ar}=KCS;
  const gnd='<line x1="6" y1="58" x2="194" y2="58" stroke="#55626e"/>';
  const semis=(x,n,c)=>{ let s=''; for(let i=0;i<n;i++) s+=`<path d="M${x+i*12-4},58 A4,4 0 0 1 ${x+i*12+4},58 Z" fill="${c}"/>`; return s; };
  const tris=(x,n,c)=>{ let s=''; for(let i=0;i<n;i++) s+=`<path d="M${x+i*12-4},58 L${x+i*12},51 L${x+i*12+4},58 Z" fill="${c}"/>`; return s; };
  const cloud=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h,6)}" fill="${c||'#aebbc6'}"/>`;
  const sec=k=>({click:()=>setS(k),to:'#fxVp'});
  const KC=[
   Object.assign({k:'am',t:t2('Air mass and source region','Luftmasse og kildeområde'),d:t2('An <b>air mass</b> is a large body of air with nearly the same temperature and humidity across it. It takes these from its <b>source region</b>: a large, uniform surface such as an ocean or a continent where the air stays for days.','En <b>luftmasse</b> er et stort luftvolum med nesten samme temperatur og fuktighet overalt. Den får disse fra <b>kildeområdet</b>: en stor, ensartet overflate som et hav eller et kontinent der luften blir liggende i dager.'),
    ill:()=>sv(`${tx(28,16,'mP','#7fcbe8','middle',10)}${tx(172,16,'cP','#5aa9e6','middle',10)}${tx(28,56,'mT','#f0b440','middle',10)}${tx(172,56,'cT','#ec5a47','middle',10)}${ar(42,18,88,30,'#7fcbe8')}${ar(158,18,112,30,'#5aa9e6')}${ar(42,50,88,38,'#f0b440')}${ar(158,50,112,38,'#ec5a47')}<circle cx="100" cy="34" r="6" fill="none" stroke="#c9d2da"/>`)},sec({view:'sec',type:'cold',stab:'unstable',season:'summer',d:-250,alt:5000})),
   Object.assign({k:'mc',t:t2('Maritime or continental, polar or tropical','Maritim eller kontinental, polar eller tropisk'),d:t2('<b>Maritime</b> air is moist, <b>continental</b> dry; <b>polar</b> air is cold, <b>tropical</b> warm. Cold air over a warmer surface becomes unstable (Cu, showers, good visibility); warm air over a colder surface becomes stable (St, drizzle, fog).','<b>Maritim</b> luft er fuktig, <b>kontinental</b> tørr; <b>polar</b> luft er kald, <b>tropisk</b> varm. Kald luft over en varmere overflate blir ustabil (Cu, byger, god sikt); varm luft over en kaldere overflate blir stabil (St, yr, tåke).'),
    ill:()=>sv(`${gnd}${cloud(18,24,22,30,'#dfe6ec')}${cloud(46,30,18,24,'#dfe6ec')}${tx(42,14,'mP: Cu','#7fcbe8','middle',9)}${cloud(116,44,72,10,'#9fadb9')}${tx(152,30,'mT: St','#f0b440','middle',9)}`)},sec({view:'sec',type:'warm',stab:'stable',season:'summer',d:-250,alt:3000})),
   Object.assign({k:'wf',t:t2('Warm front','Varmfront'),d:t2('Warm air rides up over the cold air ahead along a <b>gentle slope</b>. The cloud lowers and thickens over several hundred km: Ci, Cs, As, Ns, with a wide band of steady rain or snow.','Varm luft glir opp over den kalde luften foran langs en <b>slak helning</b>. Skyene senkes og tykner over flere hundre km: Ci, Cs, As, Ns, med et bredt bånd av vedvarende regn eller snø.'),
    ill:()=>sv(`${gnd}<line x1="40" y1="58" x2="196" y2="14" stroke="#EC5A47" stroke-width="2"/>${semis(34,3,'#EC5A47')}${tx(70,40,'Ns','#c9d2da','middle',9)}${tx(110,28,'As','#c9d2da','middle',9)}${tx(146,18,'Cs','#c9d2da','middle',9)}${tx(184,9,'Ci','#c9d2da','middle',9)}`)},sec({view:'sec',type:'warm',stab:'stable',season:'summer',d:520,alt:9000})),
   Object.assign({k:'cf',t:t2('Cold front','Kaldfront'),d:t2('Cold air pushes under the warm air along a <b>steep slope</b> and lifts it fast. With unstable warm air: a line of CB, heavy showers, hail and gusts; the bad weather is short and violent.','Kald luft skyver seg under den varme luften langs en <b>bratt helning</b> og løfter den raskt. Med ustabil varm luft: en linje med CB, kraftige byger, hagl og kast; det dårlige været er kort og kraftig.'),
    ill:()=>sv(`${gnd}<line x1="120" y1="58" x2="70" y2="8" stroke="#5AA9E6" stroke-width="2"/>${tris(116,3,'#5AA9E6')}<path d="M112,56 C108,30 116,18 124,14 L104,10 L160,10 L138,16 C146,22 148,40 144,56 Z" fill="#cfd8df"/>${tx(128,36,'CB','#13202a','middle',9)}`)},sec({view:'sec',type:'cold',stab:'unstable',season:'summer',d:120,alt:10000})),
   Object.assign({k:'oc',t:t2('Occluded front','Okklusjonsfront'),d:t2('The faster cold front catches the warm front and <b>lifts the warm air off the ground</b>. Cold type: the air behind is colder than the air ahead. Warm type: it is less cold, and rides up over it.','Den raskere kaldfronten tar igjen varmfronten og <b>løfter den varme luften fra bakken</b>. Kald type: luften bak er kaldere enn luften foran. Varm type: den er mindre kald, og glir opp over den.'),
    dd:t2('Either way you get a long band of layer cloud and rain with showers or CB embedded in it, hard to see from outside.','Uansett får du et langt bånd med lagskyer og regn med byger eller CB innleiret, vanskelig å se utenfra.'),
    ill:()=>sv(`${gnd}<line x1="96" y1="58" x2="80" y2="34" stroke="#B98AE8" stroke-width="2"/><line x1="80" y1="34" x2="40" y2="6" stroke="#5AA9E6" stroke-width="2"/><line x1="80" y1="34" x2="196" y2="10" stroke="#EC5A47" stroke-width="2"/>${tx(90,20,L(t2('warm aloft','varm oppe')),'#f0b440','middle',9)}${semis(90,1,'#B98AE8')}${tris(102,1,'#B98AE8')}`)},sec({view:'sec',type:'occl',occ:'cold',stab:'unstable',season:'summer',d:-10,alt:14000})),
   Object.assign({k:'sl',t:t2('Frontal slope','Fronthelning'),d:t2('A front is a sloping surface, not a wall. A warm front rises about 1 km per 100–200 km (1:150); a cold front about 1 km per 50–100 km (1:70). That is why warm-front weather reaches so far ahead.','En front er en skrå flate, ikke en vegg. En varmfront stiger rundt 1 km per 100–200 km (1:150); en kaldfront rundt 1 km per 50–100 km (1:70). Derfor når varmfrontvær så langt foran.'),
    ill:()=>sv(`${gnd}<line x1="20" y1="58" x2="190" y2="28" stroke="#EC5A47" stroke-width="2"/><line x1="20" y1="58" x2="100" y2="8" stroke="#5AA9E6" stroke-width="2"/>${tx(186,22,'1:150','#EC5A47','end',9)}${tx(104,12,'1:70','#5AA9E6','start',9)}`),dp:true},{click:()=>{ setS({view:'sec'}); const d=el('xpanel').querySelector('details.xsec.deep'); if(d) d.open=true; },to:'#fxVp'}),
   Object.assign({k:'pf',t:t2('Polar front and the life cycle','Polarfronten og livssyklusen'),d:t2('Along the <b>polar front</b>, between polar and tropical air, a small wave can grow into a frontal depression: wave, open warm sector, occlusion, then filling. It takes about three to five days.','Langs <b>polarfronten</b>, mellom polar og tropisk luft, kan en liten bølge vokse til et frontlavtrykk: bølge, åpen varm sektor, okklusjon, så oppfylling. Det tar rundt tre til fem døgn.'),
    ill:()=>sv(`<path d="M8,40 L60,40" stroke="#c9d2da" stroke-width="1.6"/><path d="M70,44 L98,40 L116,46" stroke="#5AA9E6" stroke-width="1.6" fill="none"/><path d="M98,40 L118,30" stroke="#EC5A47" stroke-width="1.6"/><path d="M140,46 L166,34 L186,40" stroke="#5AA9E6" stroke-width="1.6" fill="none"/><path d="M166,34 L176,18" stroke="#B98AE8" stroke-width="1.6"/><path d="M176,18 L194,24" stroke="#EC5A47" stroke-width="1.6"/>${tx(34,56,L(t2('front','front')),'#8b99a7','middle',8)}${tx(98,56,L(t2('wave','bølge')),'#8b99a7','middle',8)}${tx(166,56,L(t2('occlusion','okklusjon')),'#8b99a7','middle',8)}`)},{click:()=>setS({view:'plan',t:0,run:true},'life'),to:'#fxVp'}),
   Object.assign({k:'ws',t:t2('Warm sector','Varm sektor'),d:t2('The tongue of warm, moist air between the warm front and the cold front. Typically low stratus or Sc, drizzle and poor visibility in tropical maritime air; it narrows as the cold front catches up.','Tungen av varm, fuktig luft mellom varmfronten og kaldfronten. Typisk lav stratus eller Sc, yr og dårlig sikt i maritim tropisk luft; den smalner når kaldfronten tar igjen.'),
    ill:()=>sv(`<path d="M90,14 L170,30 L120,60 Z" fill="rgba(240,172,84,.2)"/><path d="M90,14 L170,30" stroke="#EC5A47" stroke-width="2"/><path d="M90,14 L120,60" stroke="#5AA9E6" stroke-width="2"/>${tx(84,14,'L','#ff8a7a','end',11)}${tx(128,40,'mT','#f0b440','middle',9)}`)},{click:()=>setS({view:'plan',t:30,run:false}),to:'#fxVp'}),
   Object.assign({k:'jet',t:t2('Jet stream','Jetstrøm'),d:t2('A narrow band of strong wind, often 100–200 kt, just below the tropopause above the frontal zone, in the warm air and parallel to the front. Clear air turbulence is most likely on the cold side, below the core.','Et smalt bånd med sterk vind, ofte 100–200 kt, rett under tropopausen over frontsonen, i den varme luften og parallelt med fronten. Klarluftsturbulens er mest sannsynlig på den kalde siden, under kjernen.'),
    ill:()=>sv(`<circle cx="110" cy="20" r="7" fill="none" stroke="#7fcbe8" stroke-width="1.6"/><path d="M105,15 L115,25 M115,15 L105,25" stroke="#7fcbe8" stroke-width="1.6"/><ellipse cx="86" cy="36" rx="22" ry="8" fill="rgba(240,180,64,.3)" stroke="#f0b440"/>${tx(86,39,'CAT','#f0b440','middle',8)}<line x1="40" y1="60" x2="150" y2="4" stroke="#5AA9E6" stroke-width="1.4"/>${tx(124,24,'jet','#7fcbe8','start',9)}`)},sec({view:'sec',type:'cold',stab:'stable',season:'winter',d:-390,alt:27000})),
   Object.assign({k:'pass',t:t2('Frontal passage','Frontpassering'),d:t2('In the northern hemisphere the wind <b>veers</b> at every front. Pressure falls ahead and stops falling or rises behind; temperature and dew point rise after a warm front and drop after a cold front.','På den nordlige halvkule <b>dreier vinden med klokka</b> ved hver front. Trykket faller foran og slutter å falle eller stiger bak; temperatur og duggpunkt stiger etter en varmfront og faller etter en kaldfront.'),
    ill:()=>sv(`${ar(30,44,48,26,'#c9d2da')}${tx(40,58,'SW','#8b99a7','middle',9)}<line x1="100" y1="6" x2="100" y2="58" stroke="#5AA9E6" stroke-width="2"/>${ar(150,30,172,40,'#c9d2da')}${tx(162,58,'NW','#8b99a7','middle',9)}${tx(100,64,L(t2('veer','dreier')),'#71cc93','middle',8)}${tx(70,14,'QNH ▼','#eef3f7','middle',8)}${tx(150,14,'QNH ▲','#eef3f7','middle',8)}`)},sec({view:'sec',type:'cold',stab:'unstable',season:'summer',d:250,alt:2000})),
   Object.assign({k:'fz',t:t2('Freezing level and freezing rain','Frysenivå og underkjølt regn'),d:t2('Icing is worst in Ns and CB between 0 and −15 °C. In winter, ahead of a warm front, rain from the warm layer aloft falls into sub-zero air and becomes <b>freezing rain</b>: clear ice in seconds.','Ising er verst i Ns og CB mellom 0 og −15 °C. Om vinteren, foran en varmfront, faller regn fra det varme laget oppe ned i kuldegrader og blir <b>underkjølt regn</b>: klaris på sekunder.'),
    ill:()=>sv(`${gnd}<path d="M10,30 L190,22 L190,36 L10,44 Z" fill="rgba(236,90,71,.22)"/>${tx(100,32,'> 0 °C','#ec5a47','middle',9)}<path d="M40,46 l-2,6 M70,46 l-2,6 M100,46 l-2,6 M130,46 l-2,6 M160,46 l-2,6" stroke="#ff78aa" stroke-width="1.6"/>${tx(100,14,'< 0 °C: '+L(t2('snow','snø')),'#cfefff','middle',9)}`)},sec({view:'sec',type:'warm',stab:'stable',season:'winter',d:70,alt:1500}))];
  KCS.render(el('kcGrid'),KC);
}

/* ---------------- text: tables, key points, memory aid, deep dives ---------------- */
on(()=>{
  el('xLead').innerHTML=L(t2('One front, two views. In the <b>cross-section</b> you fly through the front and see what is where you are; drag the aircraft or press <b>Fly through</b>. The <b>plan view</b> shows how a frontal depression develops over three days. Choose the front, the stability of the warm air and the season in the controls.','Én front, to visninger. I <b>vertikalsnittet</b> flyr du gjennom fronten og ser hva som er der du er; dra flyet eller trykk <b>Fly gjennom</b>. <b>Kartet</b> viser hvordan et frontlavtrykk utvikler seg over tre døgn. Velg front, stabiliteten i den varme luften og årstid i kontrollene.'));
  el('tryLead').innerHTML=L(t2('Five short tasks. Two you do in the model, with live feedback; three you answer here and then see in the model.','Fem korte oppgaver. To gjør du i modellen, med fortløpende tilbakemelding; tre svarer du på her og ser så i modellen.'));
  el('amH').textContent=L(t2('Air masses that reach Northern Europe','Luftmasser som når Nord-Europa'));
  el('ftH').textContent=L(t2('The fronts side by side','Frontene side om side'));
  const AM=[['mP',t2('North Atlantic, near Greenland and Iceland','Nord-Atlanteren, ved Grønland og Island'),t2('Cold, moist','Kald, fuktig'),t2('Heated from below by the warmer sea: unstable. Cu and CB, showers (snow showers in winter), good visibility outside them, icing in Cu.','Varmes nedenfra av varmere hav: ustabil. Cu og CB, byger (snøbyger om vinteren), god sikt utenom, ising i Cu.')],
    ['mA',t2('Arctic Ocean','Polhavet'),t2('Very cold, fairly dry','Svært kald, ganske tørr'),t2('Over open sea in winter: heavy snow showers, polar lows, severe icing. Very good visibility between showers.','Over åpent hav om vinteren: kraftige snøbyger, polare lavtrykk, kraftig ising. Svært god sikt mellom bygene.')],
    ['cP',t2('Russia and Scandinavia in winter','Russland og Skandinavia om vinteren'),t2('Very cold, dry, stable','Svært kald, tørr, stabil'),t2('Winter: very cold, clear or a layer of St/Sc with haze under an inversion. Summer: warm and dry.','Vinter: svært kaldt, klart eller et lag St/Sc med dis under en inversjon. Sommer: varmt og tørt.')],
    ['mT',t2('Atlantic near the Azores','Atlanteren ved Asorene'),t2('Warm, moist','Varm, fuktig'),t2('Cooled from below by a colder sea or land: stable. Low St, drizzle, advection fog, poor visibility. Fills the warm sector.','Kjøles nedenfra av kaldere hav eller land: stabil. Lav St, yr, advektiv tåke, dårlig sikt. Fyller den varme sektoren.')],
    ['cT',t2('North Africa','Nord-Afrika'),t2('Hot, dry','Varm, tørr'),t2('Rare in the north: hot, hazy, dust. Thunderstorms where it meets moister air.','Sjelden i nord: varmt, disig, støv. Tordenvær der den møter fuktigere luft.')]];
  el('amTab').innerHTML=`<tr><th>${L(t2('Air mass','Luftmasse'))}</th><th>${L(t2('Source region','Kildeområde'))}</th><th>${L(t2('At the source','Ved kilden'))}</th><th>${L(t2('Typical weather when it arrives','Typisk vær når den kommer'))}</th></tr>`+AM.map(r=>`<tr><td><b>${r[0]}</b></td><td>${L(r[1])}</td><td>${L(r[2])}</td><td>${L(r[3])}</td></tr>`).join('');
  const FR=[[t2('Warm front','Varmfront'),t2('Gentle, about 1:150','Slak, rundt 1:150'),t2('Ci → Cs → As → Ns, low St in the rain','Ci → Cs → As → Ns, lav St i regnet'),t2('Wide band of steady rain or snow, up to about 300 km ahead','Bredt bånd med vedvarende regn eller snø, opptil rundt 300 km foran'),t2('Low ceilings and visibility for a long time; freezing rain in winter','Lav skybase og sikt lenge; underkjølt regn om vinteren')],
    [t2('Cold front','Kaldfront'),t2('Steep, about 1:70','Bratt, rundt 1:70'),t2('CB and Cu along the front (unstable), or a narrow Ns band (stable)','CB og Cu langs fronten (ustabil), eller et smalt Ns-bånd (stabil)'),t2('Narrow band of heavy showers, thunder, hail','Smalt bånd med kraftige byger, torden, hagl'),t2('Turbulence, wind shear, sudden wind shift, icing in CB','Turbulens, vindskjær, brå vinddreining, ising i CB')],
    [t2('Occlusion','Okklusjon'),t2('Mixed','Blandet'),t2('Layer cloud with embedded CB','Lagskyer med innleirede CB'),t2('Long band of rain with heavier showers inside','Langt bånd med regn og kraftigere byger inni'),t2('Hidden CB, icing, long periods in cloud','Skjulte CB, ising, lange perioder i sky')],
    [t2('Stationary front','Stasjonær front'),t2('Gentle','Slak'),t2('Like a warm front','Som en varmfront'),t2('Can rain in the same place for days','Kan regne på samme sted i dagevis'),t2('Persistent low cloud','Vedvarende lave skyer')]];
  el('frTab').innerHTML=`<tr><th>${L(t2('Front','Front'))}</th><th>${L(t2('Slope','Helning'))}</th><th>${L(t2('Cloud','Skyer'))}</th><th>${L(t2('Precipitation','Nedbør'))}</th><th>${L(t2('Main hazards','Viktigste farer'))}</th></tr>`+FR.map(r=>`<tr><td><b>${L(r[0])}</b></td>${r.slice(1).map(c=>`<td>${L(c)}</td>`).join('')}</tr>`).join('');
  const BG=[t2('<b>Jet streams.</b> Narrow bands of very strong wind, typically 100–200 kt, just below the tropopause where the temperature contrast between air masses is largest, as along the polar front. Strongest in winter. In cruise they decide ground speed, fuel and the best flight level; clear air turbulence is most likely on the cold (polar) side and just below the core.','<b>Jetstrømmer.</b> Smale bånd med svært sterk vind, typisk 100–200 kt, rett under tropopausen der temperaturforskjellen mellom luftmassene er størst, som langs polarfronten. Sterkest om vinteren. I cruise avgjør de groundspeed, drivstoff og beste flygenivå; klarluftsturbulens er mest sannsynlig på den kalde (polare) siden og like under kjernen.'),
    t2('<b>Tropopause.</b> The top of the weather, where the temperature stops falling with height: about FL250–300 over Scandinavia in winter, higher in summer and around FL500 in the tropics. CB tops spread out here, and breaks in the tropopause mark the jet streams.','<b>Tropopausen.</b> Toppen av været, der temperaturen slutter å falle med høyden: rundt FL250–300 over Skandinavia om vinteren, høyere om sommeren og rundt FL500 i tropene. CB-topper brer seg ut her, og brudd i tropopausen markerer jetstrømmene.'),
    t2('<b>Global circulation.</b> The sun heats the tropics most. Rising air at the equator (the ITCZ) and sinking air near 30° form the Hadley cells; the Ferrel and polar cells complete the picture. Where polar and tropical air meet, around 50–60°, lies the polar front, and with it the polar front jet and the frontal depressions of this lab.','<b>Global sirkulasjon.</b> Solen varmer tropene mest. Stigende luft ved ekvator (ITCZ) og synkende luft nær 30° danner Hadley-cellene; Ferrel- og polarcellene fullfører bildet. Der polar og tropisk luft møtes, rundt 50–60°, ligger polarfronten, og med den polarfrontjeten og frontlavtrykkene i denne labben.'),
    t2('<b>Charts.</b> On a surface analysis, red half-circles are warm fronts, blue triangles cold fronts and purple alternating symbols occlusions; the symbols point the way the front moves. The significant weather chart (SIGWX) shows fronts, jet streams with speed and height, tropopause heights, CAT areas, embedded CB and icing for your flight levels.','<b>Kart.</b> På et bakkeanalysekart er røde halvsirkler varmfronter, blå trekanter kaldfronter og lilla vekslende symboler okklusjoner; symbolene peker dit fronten beveger seg. Significant weather-kartet (SIGWX) viser fronter, jetstrømmer med fart og høyde, tropopausehøyder, CAT-områder, innleirede CB og ising for dine flygenivåer.')];
  el('bgBox').innerHTML=`<span class="k">${L(t2('Deep dive · jet streams, tropopause and charts','Dypdykk · jetstrømmer, tropopause og kart'))}</span>`+BG.map(p=>`<p>${L(p)}</p>`).join('');
  const TK=[t2('<b>Air masses carry their source with them.</b> Maritime is moist, continental dry; polar cold, tropical warm. Cold air over a warmer surface turns unstable (Cu, showers, good visibility); warm air over a colder surface turns stable (St, drizzle, fog).','<b>Luftmasser tar med seg kilden.</b> Maritim er fuktig, kontinental tørr; polar kald, tropisk varm. Kald luft over en varmere overflate blir ustabil (Cu, byger, god sikt); varm luft over en kaldere overflate blir stabil (St, yr, tåke).'),
    t2('<b>Warm front: slow and wide.</b> Gentle slope, cloud sequence Ci, Cs, As, Ns over 800–1000 km, steady rain up to about 300 km ahead. Low ceilings and poor visibility for many hours.','<b>Varmfront: langsom og bred.</b> Slak helning, skyrekkefølge Ci, Cs, As, Ns over 800–1000 km, vedvarende regn opptil rundt 300 km foran. Lav skybase og dårlig sikt i mange timer.'),
    t2('<b>Cold front: fast and narrow.</b> Steep slope. Unstable warm air gives a CB line with heavy showers, hail, turbulence and wind shear; stable warm air a narrower band of layer cloud and rain. Behind it: colder, showery, good visibility.','<b>Kaldfront: rask og smal.</b> Bratt helning. Ustabil varm luft gir en CB-linje med kraftige byger, hagl, turbulens og vindskjær; stabil varm luft et smalere bånd med lagskyer og regn. Bak den: kaldere, byget, god sikt.'),
    t2('<b>At every front in the northern hemisphere the wind veers.</b> Pressure falls ahead, then stops falling (warm front) or rises sharply (cold front). Temperature and dew point rise after a warm front and drop after a cold front.','<b>Ved hver front på den nordlige halvkule dreier vinden med klokka.</b> Trykket faller foran, så slutter det å falle (varmfront) eller stiger brått (kaldfront). Temperatur og duggpunkt stiger etter en varmfront og faller etter en kaldfront.'),
    t2('<b>Occlusions hide CB.</b> The warm air is lifted off the ground; you get warm-front layer cloud with showers or CB embedded in it. Use the weather radar, SIGMET and lightning data.','<b>Okklusjoner skjuler CB.</b> Den varme luften løftes fra bakken; du får varmfrontens lagskyer med byger eller CB innleiret. Bruk værradar, SIGMET og lyndata.'),
    t2('<b>Freezing level and icing.</b> Worst in Ns and CB between 0 and −15 °C, and in freezing rain under the warm layer ahead of a winter warm front. Do not linger in it: plan the level, the arrival and the alternate around it.','<b>Frysenivå og ising.</b> Verst i Ns og CB mellom 0 og −15 °C, og i underkjølt regn under det varme laget foran en varmfront om vinteren. Ikke bli værende i det: planlegg høyde, ankomst og alternativ rundt det.')];
  el('take').innerHTML=TK.map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.eyebrow').textContent=L(t2('Memory aid','Huskeregel')); m.querySelector('h3').textContent=L(t2('Ci, Cs, As, Ns: the sky lowers and thickens','Ci, Cs, As, Ns: himmelen senkes og tykner'));
  m.querySelector('p').innerHTML=L(t2('A warm front announces itself up to a day ahead: hooked <b>cirrus</b>, then a milky <b>cirrostratus</b> veil with a halo round the sun, then <b>altostratus</b> (the sun as through frosted glass), then <b>nimbostratus</b> and steady rain. When it passes, the wind veers.','En varmfront varsler seg opptil et døgn i forveien: krokete <b>cirrus</b>, så et melkehvitt slør av <b>cirrostratus</b> med halo rundt solen, så <b>altostratus</b> (solen som gjennom frostet glass), så <b>nimbostratus</b> og vedvarende regn. Når den passerer, dreier vinden med klokka.'));
  const EX=[t2('<b>Speeds.</b> A cold front moves faster (often 20–30 kt) than a warm front (10–20 kt); that is why it catches up and the depression occludes.','<b>Fart.</b> En kaldfront går fortere (ofte 20–30 kt) enn en varmfront (10–20 kt); derfor tar den igjen, og lavtrykket okkluderer.'),
    t2('<b>Ana and kata fronts.</b> At an ana-front the warm air rises along the frontal surface: thick cloud and rain. At a kata-front the warm air aloft sinks: little cloud, weak weather. The stable or unstable switch in the model shows the same idea for the warm air.','<b>Ana- og katafronter.</b> Ved en anafront stiger den varme luften langs frontflaten: tykke skyer og regn. Ved en katafront synker den varme luften oppe: lite skyer, svakt vær. Bryteren stabil eller ustabil i modellen viser samme idé for den varme luften.'),
    t2('<b>Warm and cold occlusion.</b> Cold type: the air behind is colder and pushes under the air ahead; the upper warm front lies ahead of the surface occlusion. Warm type: the air behind is less cold and rides up over the air ahead; the upper cold front lies ahead of the surface occlusion, and so do its showers.','<b>Varm og kald okklusjon.</b> Kald type: luften bak er kaldere og skyver seg under luften foran; den øvre varmfronten ligger foran bakkeokklusjonen. Varm type: luften bak er mindre kald og glir opp over luften foran; den øvre kaldfronten ligger foran bakkeokklusjonen, og bygene med den.'),
    t2('<b>Families of depressions.</b> New waves often form on the trailing cold front, so a series of lows runs north-east along the polar front, each a day or so behind the last.','<b>Lavtrykksfamilier.</b> Nye bølger dannes ofte på den etterslepende kaldfronten, så en rekke lavtrykk går nordøstover langs polarfronten, hvert omtrent et døgn bak det forrige.')];
  el('dbE').innerHTML=`<span class="k">${L(t2('Deep dive · what the examiner asks','Dypdykk · dette spør sensor om'))}</span>`+EX.map(p=>`<p>${L(p)}</p>`).join('');
  el('foot').innerHTML='<b>'+L(t2('Model and limitations.','Modell og begrensninger.'))+'</b> '+L(t2('Teaching model of textbook fronts in the northern hemisphere. The vertical scale is exaggerated about 50 times, so the frontal surfaces look much steeper than they are. Temperature falls 2 °C per 1000 ft in every air mass; the cloud, precipitation, icing and turbulence are typical textbook patterns, not a forecast; winds aloft are illustrative. The plan view is an idealised depression on a 1600 × 1000 km chart. Real fronts vary a lot: use the METAR, TAF, SIGMET, AIRMET and significant weather chart, and your operator’s procedures.','Opplæringsmodell av lærebokfronter på den nordlige halvkule. Den loddrette skalaen er overdrevet rundt 50 ganger, så frontflatene ser mye brattere ut enn de er. Temperaturen faller 2 °C per 1000 ft i alle luftmasser; skyer, nedbør, ising og turbulens er typiske lærebokmønstre, ikke en værvarsling; vind i høyden er illustrativ. Kartet er et idealisert lavtrykk på et kart på 1600 × 1000 km. Virkelige fronter varierer mye: bruk METAR, TAF, SIGMET, AIRMET og significant weather-kart, og operatørens prosedyrer.'));
  drawTasks(); drawPre(); drawTabs(); drawTogs(); legend(); see();
});

/* ---------------- quiz ---------------- */
LAB.quiz(el('qbox'),'fronts',()=>LAB.shuffle([
 {q:t2('You fly towards an approaching warm front. In which order do you normally see the cloud?','Du flyr mot en varmfront som nærmer seg. I hvilken rekkefølge ser du normalt skyene?'),a:[t2('Ci, Cs, As, Ns','Ci, Cs, As, Ns'),t2('Cu, CB, Ci','Cu, CB, Ci'),t2('Ns, As, Cs, Ci','Ns, As, Cs, Ci')],c:0,e:t2('The gentle slope puts high cloud far ahead; the cloud lowers and thickens towards the surface front.','Den slake helningen legger høye skyer langt foran; skyene senkes og tykner mot bakkefronten.')},
 {q:t2('A typical slope of a warm front is about…','En typisk helning for en varmfront er rundt …'),a:[t2('1:150','1:150'),t2('1:15','1:15'),t2('1:1500','1:1500')],c:0,e:t2('Warm fronts about 1:100–1:200, cold fronts steeper, about 1:50–1:100.','Varmfronter rundt 1:100–1:200, kaldfronter brattere, rundt 1:50–1:100.')},
 {q:t2('After a cold front has passed (northern hemisphere), you expect…','Etter at en kaldfront har passert (nordlige halvkule), venter du …'),a:[t2('wind veering, pressure rising, temperature and dew point falling','vinden dreier med klokka, trykket stiger, temperatur og duggpunkt faller'),t2('wind backing, pressure falling, temperature rising','vinden dreier mot klokka, trykket faller, temperaturen stiger'),t2('wind veering, pressure falling, dew point rising','vinden dreier med klokka, trykket faller, duggpunktet stiger')],c:0,e:t2('Colder, drier air arrives behind the front; the wind veers to W–NW and pressure rises.','Kaldere, tørrere luft kommer bak fronten; vinden dreier til V–NV og trykket stiger.')},
 {q:t2('In winter, freezing rain is most likely…','Om vinteren er underkjølt regn mest sannsynlig …'),a:[t2('ahead of a warm front, below the frontal surface','foran en varmfront, under frontflaten'),t2('behind a cold front in showers','bak en kaldfront i byger'),t2('in the middle of the warm sector','midt i den varme sektoren')],c:0,e:t2('Rain from the warm air above the frontal surface falls into sub-zero air beneath it and freezes on impact.','Regn fra den varme luften over frontflaten faller ned i kuldegrader under den og fryser når det treffer.')},
 {q:t2('In a warm occlusion…','I en varm okklusjon …'),a:[t2('the air behind the cold front is less cold than the air ahead of the warm front','er luften bak kaldfronten mindre kald enn luften foran varmfronten'),t2('the air behind the cold front is colder than the air ahead of the warm front','er luften bak kaldfronten kaldere enn luften foran varmfronten'),t2('the warm air stays at the surface','blir den varme luften ved bakken')],c:0,e:t2('The less cold air rides up over the colder air ahead, so the upper cold front lies ahead of the surface occlusion.','Den mindre kalde luften glir opp over den kaldere luften foran, så den øvre kaldfronten ligger foran bakkeokklusjonen.')},
 {q:t2('The warm sector of a frontal depression lies…','Den varme sektoren i et frontlavtrykk ligger …'),a:[t2('between the warm front and the cold front','mellom varmfronten og kaldfronten'),t2('ahead of the warm front','foran varmfronten'),t2('behind the cold front','bak kaldfronten')],c:0,e:t2('It is the tongue of warm air between the two fronts, south of the low in the northern hemisphere.','Det er tungen av varm luft mellom de to frontene, sør for lavtrykket på den nordlige halvkule.')},
 {q:t2('Maritime polar air arriving over a warmer sea in winter typically gives…','Maritim polarluft som kommer inn over et varmere hav om vinteren gir typisk …'),a:[t2('Cu and showers, good visibility between them','Cu og byger, god sikt mellom dem'),t2('low stratus, drizzle and fog','lav stratus, yr og tåke'),t2('clear skies and haze','klar himmel og dis')],c:0,e:t2('Cold air heated from below becomes unstable: heaped cloud, showers, good visibility outside them.','Kald luft som varmes nedenfra blir ustabil: haugskyer, byger, god sikt utenfor dem.')},
 {q:t2('Tropical maritime air moving over a colder sea typically gives…','Maritim tropisk luft som beveger seg over et kaldere hav gir typisk …'),a:[t2('advection fog and low stratus','advektiv tåke og lav stratus'),t2('thunderstorms and hail','tordenvær og hagl'),t2('very good visibility','svært god sikt')],c:0,e:t2('Warm, moist air cooled from below becomes stable and saturated near the surface.','Varm, fuktig luft som kjøles nedenfra blir stabil og mettet nær overflaten.')},
 {q:t2('Near a polar front jet stream, clear air turbulence is most likely…','Nær en polarfrontjet er klarluftsturbulens mest sannsynlig …'),a:[t2('on the cold (polar) side, just below the core','på den kalde (polare) siden, like under kjernen'),t2('on the warm side, well above the core','på den varme siden, godt over kjernen'),t2('exactly in the core','nøyaktig i kjernen')],c:0,e:t2('The strongest wind shear is on the cold side and just below the core.','Det kraftigste vindskjæret ligger på den kalde siden og like under kjernen.')},
 {q:t2('Why does a frontal depression occlude?','Hvorfor okkluderer et frontlavtrykk?'),a:[t2('The cold front moves faster than the warm front and catches it up','Kaldfronten går fortere enn varmfronten og tar den igjen'),t2('The warm front speeds up and leaves the cold front behind','Varmfronten øker farten og forlater kaldfronten'),t2('The warm sector air sinks','Luften i den varme sektoren synker')],c:0,e:t2('The warm sector narrows until the warm air is lifted off the ground; the low then usually starts to fill.','Den varme sektoren smalner til den varme luften løftes fra bakken; lavtrykket begynner da vanligvis å fylles opp.')}
]),8);

/* ---------------- static strings, rich text, start ---------------- */
LAB.add({},{'Fronts and Air Masses':'Fronter og luftmasser','Fronts and air masses':'Fronter og luftmasser','Birdbird Virtual Labs · Meteorology':'Birdbird Virtual Labs · Meteorologi',
 'Key concepts':'Nøkkelbegreper','Fly through a front':'Fly gjennom en front','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Controls':'Kontroller','Conditions':'Forhold','Front':'Front','Occlusion type':'Okklusjonstype','Warm air':'Varm luft','Season':'Årstid','Show':'Vis','Scenarios':'Scenarioer','Advanced':'Avansert',
 'Virtual Labs':'Virtual Labs','Sections':'Seksjoner','View':'Visning',
 'Vertical cross-section through a front with cloud, precipitation, freezing level, icing and turbulence, the aircraft, and a strip with surface temperature, dew point, wind and QNH along the route':'Vertikalsnitt gjennom en front med skyer, nedbør, frysenivå, ising og turbulens, flyet, og en stripe med temperatur, duggpunkt, vind og QNH ved bakken langs ruten',
 'Plan view of a frontal depression with isobars and front symbols, developing from a wave to an occlusion':'Kart over et frontlavtrykk med isobarer og frontsymboler, som utvikler seg fra en bølge til en okklusjon'});
LAB.tx({lead:'Der to luftmasser møtes, løftes den varmeste luften, og det er der været skjer. Fly gjennom en varmfront, en kaldfront eller en okklusjon og se skyer, nedbør, frysenivå, ising og turbulens der du er, mens vind, temperatur og QNH endrer seg når du passerer. Se så et frontlavtrykk vokse fra en bølge til en okklusjon.',
 kin:'Ordene som brukes i modellen under. Hvert kort lenker til stedet i modellen der det vises.',kfs:'Luftmasser og fronter i sin helhet'});
el('occBox').hidden=S.type!=='occl';
function runHooks(){ hooks.forEach(f=>f()); }
runHooks(); LAB.onLang(()=>{ runHooks(); rebuild(); planDraw(); });
/* old anchors: #lab → the model, #table / #press / #global → the full reference under Key concepts */
if(/^#(table|press|global)$/.test(location.hash)){ el('full').open=true; }

/* Reset (the shell's button in the viewport bar): starting values, same view */
{ const keepS=LAB.keep(S); LAB.reset(()=>{ const v=S.view; keepS(); slNw.set(S.Nw); slNc.set(S.Nc); slV.set(S.spd); setS({view:v}); }); }

LAB.start('fronts');
})();
