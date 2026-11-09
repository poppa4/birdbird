/* Birdbird – gyros.js: the Attitude and heading lab (gyros.html).
   One dark figure with four modes: the magnetic compass (variation, deviation, dip, turning and acceleration errors),
   gyroscopes (rigidity, precession with a rotor you can push, and the heading indicator's apparent drift),
   the instruments (classic analog panel in a light piston against AHRS / IRS glass in a turboprop or jet, with faults),
   and in Deep dive the inertial reference (alignment, drift, GNSS aiding). All maths in gyrocore.js (GYC). */
(function(){
'use strict';
const {L,el,nf}=LAB, Y=GYC, t2=(en,no)=>({en,no});
const D2R=Math.PI/180;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const MONO='"IBM Plex Mono", ui-monospace, monospace', SANS='"Public Sans", system-ui, sans-serif';
const C={txt:'#EEF2F5',mut:'#8E99A4',dim:'#5E6D7C',red:'#EC5A47',ok:'#71CC93',amb:'#F0C470',cy:'#7FCBE8',mag:'#E07BD0',vio:'#C9B6F2',grid:'rgba(200,215,225,.10)',sky:'#2F6EA5',gnd:'#7A5634'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const depth=()=>document.body.classList.contains('depth-short')?'short':document.body.classList.contains('depth-instructor')?'instructor':'deep';
const deepOn=()=>depth()!=='short';
const d3=v=>String(Math.round(Y.norm(v))%360||360).padStart(3,'0')+'°';
const sg=(v,d)=>(v>0.0001?'+':v<-0.0001?'−':'')+nf(Math.abs(v),d||0);
const latS=v=>Math.abs(v)+'° '+(v<0?'S':'N');
const KMAX=0.9;                                   // card tilt limit in the compass model
const TAS={pis:100,tp:200,jet:250};               // typical true airspeeds used for the turn rate (kt)

/* ---------------- state ---------------- */
const S={mode:'cmp',
  th:90,lat:60,vari:3,devB:0,man:'steady',ktps:2,bank:15,turn:0,accT:0,          // compass
  rpm:100,drive:'vac',spin:0,n:[1,0,0],push:null,dlat:60,vE:0,nut:'none',tmin:20,real:0,runT:0,  // gyros
  cls:'pis',ip:0,ib:0,slip:0,ihdg:90,fault:'none',failT:0,toT:0,src2:false,             // instruments
  rlat:60,move:'still',pos:'ok',ali:'off',prog:0,sens:'rlg',gnss:'on',hrs:2};           // inertial
const V={psi:0,ab:0,ap:0,hiE:0,tc:0};            // smoothed displayed values

/* compass */
const mhOf=()=>Y.norm(S.th-S.vari);
const devOf=mh=>deepOn()?Y.deviation(mh,S.devB,0):0;
function cmpModel(){ const mh=mhOf(), dev=devOf(mh), ch=Y.compFromMag(mh,dev);
  const o={man:S.man,lat:S.lat,ktps:S.ktps,bank:S.bank,kmax:KMAX}, psiT=S.man==='steady'?0:Y.wrap(mh-Y.compassReads(mh,o));
  return {mh,dev,ch,psiT,shown:Y.norm(ch-V.psi),err:-V.psi,dip:Y.dip(S.lat)}; }
/* gyros */
function diModel(){ const nutLat=S.nut==='none'?null:S.nut==='60'?60:S.dlat; const rate=Y.diDrift(S.dlat,S.vE,nutLat,deepOn()?S.real:0);
  return {er:Y.earthRate(S.dlat),tw:Y.transportWander(S.vE,S.dlat),nut:Y.latNut(nutLat),rate,err:rate*S.tmin/60}; }

/* ---------------- canvas helpers ---------------- */
const cv=el('gyv'); const ST=LAB.fit(cv,()=>draw(),2);
let FS=1;
function txt(g,s,x,y,col,al,sz,wt,font){ g.font=`${wt||500} ${Math.round((sz||12)*FS*10)/10}px ${font||MONO}`; g.fillStyle=col||C.txt; g.textAlign=al||'left'; g.textBaseline='alphabetic'; g.fillText(s,x,y); g.textAlign='left'; }
function line(g,x1,y1,x2,y2,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]); }
function poly(g,pts,col,w,dash,fill){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); if(fill){ g.closePath(); g.fillStyle=fill; g.fill(); } if(col) g.stroke(); g.setLineDash([]); }
function dot(g,x,y,r,fill,stroke,w){ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=w||1.5; g.stroke(); } }
function rr(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }
function tag(g,s,x,y,col,o){ o=o||{}; const sz=(o.sz||11.5)*FS; g.font=`${o.wt||600} ${sz}px ${o.font||SANS}`; const w=g.measureText(s).width+10, h=sz+7;
  let bx=o.al==='right'?x-w:o.al==='center'?x-w/2:x; bx=clamp(bx,2,ST.w-w-2); const by=y-h/2;
  if(o.bg!==false){ g.fillStyle='rgba(10,14,18,.82)'; rr(g,bx,by,w,h,3); g.fill(); }
  g.fillStyle=col||C.txt; g.textBaseline='middle'; g.textAlign='left'; g.fillText(s,bx+5,y+0.5); g.textBaseline='alphabetic'; return [bx,by,bx+w,by+h]; }
function arrow(g,x1,y1,x2,y2,col,w,head){ const a=Math.atan2(y2-y1,x2-x1), h=head||8; line(g,x1,y1,x2-Math.cos(a)*h*0.6,y2-Math.sin(a)*h*0.6,col,w||2);
  g.fillStyle=col; g.beginPath(); g.moveTo(x2,y2); g.lineTo(x2-h*Math.cos(a-0.42),y2-h*Math.sin(a-0.42)); g.lineTo(x2-h*Math.cos(a+0.42),y2-h*Math.sin(a+0.42)); g.closePath(); g.fill(); }
const polar=(cx,cy,r,deg)=>[cx+Math.sin(deg*D2R)*r,cy-Math.cos(deg*D2R)*r];
function panel(g,x,y,w,h,title){ g.fillStyle='rgba(6,9,12,.32)'; rr(g,x,y,w,h,6); g.fill(); if(title) txt(g,title,x+10,y+16,'#AEB8C1','left',10.5,600); }
function face(g,cx,cy,r){ const gr=g.createRadialGradient(cx,cy-r*0.3,r*0.2,cx,cy,r*1.1); gr.addColorStop(0,'#3a434b'); gr.addColorStop(1,'#11161b'); dot(g,cx,cy,r*1.1,gr); dot(g,cx,cy,r,'#090C0F','rgba(255,255,255,.12)',1); }
function glassHi(g,cx,cy,r){ const gr=g.createLinearGradient(cx,cy-r,cx,cy); gr.addColorStop(0,'rgba(255,255,255,.07)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.beginPath(); g.ellipse(cx,cy-r*0.45,r*0.8,r*0.5,0,0,Math.PI*2); g.fill(); }
function flag(g,x,y,s,w){ g.save(); g.translate(x,y); g.rotate(-0.25); g.fillStyle='#D8392B'; rr(g,-(w||34)/2,-9,w||34,18,2); g.fill(); g.font=`700 ${11*FS}px ${SANS}`; g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(s,0,1); g.restore(); g.textAlign='left'; g.textBaseline='alphabetic'; }
/* aircraft seen from above, nose up, size s (half span) */
function planeTop(g,x,y,s,hdg,col){ g.save(); g.translate(x,y); g.rotate(hdg*D2R); g.scale(s/20,s/20); g.fillStyle=col; g.beginPath();
  g.moveTo(0,-20); g.quadraticCurveTo(2.4,-17,2.4,-10); g.lineTo(2.4,-4); g.lineTo(20,2); g.lineTo(20,5); g.lineTo(2.4,2); g.lineTo(1.8,12); g.lineTo(7,16); g.lineTo(7,18.5); g.lineTo(0,17); g.lineTo(-7,18.5); g.lineTo(-7,16); g.lineTo(-1.8,12); g.lineTo(-2.4,2); g.lineTo(-20,5); g.lineTo(-20,2); g.lineTo(-2.4,-4); g.lineTo(-2.4,-10); g.quadraticCurveTo(-2.4,-17,0,-20); g.fill(); g.restore(); }

/* ---------------- the figure ---------------- */
let GEO={};
function draw(){ if(!ST.w) return; const g=ST.ctx, W=ST.w, H=ST.h; g.setTransform(ST.dpr,0,0,ST.dpr,0,0); g.clearRect(0,0,W,H);
  FS=depth()==='instructor'?1.12:W<420?0.9:1; GEO={};
  const ph=H>W*1.1, top=ph?8:(el("chip").offsetHeight||40)+16;
  if(S.mode==='cmp') drawCmp(g,W,H,top,ph); else if(S.mode==='gyr') drawGyr(g,W,H,top,ph); else if(S.mode==='ins') drawIns(g,W,H,top,ph); else drawIrs(g,W,H,top,ph); }

/* ===== mode 1: the magnetic compass ===== */
function drawCmp(g,W,H,top,ph){ const M=cmpModel();
  let A,B,Cc; if(ph){ A=[8,top,W-16,H*0.46-top]; B=[8,H*0.47,W-16,H*0.26]; Cc=[8,H*0.745,W-16,H*0.245]; } else { const xs=W*0.52; A=[10,top,xs-16,H-top-10]; B=[xs,top,W-xs-10,(H-top)*0.56-6]; Cc=[xs,top+(H-top)*0.56+4,W-xs-10,(H-top)*0.44-14]; }
  /* top view: true and magnetic north, the aircraft, the acceleration and where the magnet points */
  panel(g,...A,L(t2('SEEN FROM ABOVE','SETT OVENFRA')));
  const cx=A[0]+A[2]/2, cy=A[1]+A[3]/2+8, r=Math.min(A[2]*0.4,A[3]*0.4);
  dot(g,cx,cy,r,null,'rgba(214,226,236,.16)',1);
  for(let d=0;d<360;d+=10){ const [x1,y1]=polar(cx,cy,r,d), [x2,y2]=polar(cx,cy,r*(d%90?0.96:0.9),d); line(g,x1,y1,x2,y2,'rgba(214,226,236,.3)',1); }
  ['N','E','S','W'].forEach((s,i)=>{ const [x,y]=polar(cx,cy,r+12,i*90); txt(g,s,x,y+4,'#AEB8C1','center',10.5,600,SANS); });
  /* true north (up) and magnetic north (rotated by the variation) */
  const [tnx,tny]=polar(cx,cy,r*0.98,0); line(g,cx,cy,tnx,tny,'rgba(238,242,245,.35)',1,[3,4]);
  const [mnx,mny]=polar(cx,cy,r*0.98,S.vari); line(g,cx,cy,mnx,mny,'rgba(127,203,232,.6)',1.2,[5,4]);
  if(Math.abs(S.vari)>=1) tag(g,L(t2('magnetic north','magnetisk nord'))+' · '+L(t2('var ','misv. '))+Math.abs(S.vari)+'° '+(S.vari>0?'E':'W'),mnx+(S.vari>0?6:-6),mny+14,C.cy,{sz:10,al:S.vari>0?'left':'right'});
  /* the acceleration */
  if(S.man!=='steady'){ const ad=Y.accDir(M.mh,S.man)+S.vari, [ax,ay]=polar(cx,cy,r*0.62,ad), [lx2,ly2]=polar(cx,cy,r*0.8,ad); arrow(g,cx,cy,ax,ay,C.mag,2.4,10);
    const lb=S.man==='tr'||S.man==='tl'?t2('towards the turn centre','mot svingsenteret'):S.man==='acc'?t2('acceleration','akselerasjon'):t2('deceleration','retardasjon');
    tag(g,L(lb),lx2,ly2,C.mag,{sz:10.5,al:Math.sin(ad*D2R)>0.3?'left':Math.sin(ad*D2R)<-0.3?'right':'center'}); }
  planeTop(g,cx,cy,r*0.2,S.th,'#F4F7F9');
  /* the magnet: its north end points along the swung field */
  const mdir=S.vari+V.psi, [m1x,m1y]=polar(cx,cy,r*0.86,mdir), [m2x,m2y]=polar(cx,cy,r*0.86,mdir+180);
  line(g,m2x,m2y,cx,cy,'rgba(160,170,180,.75)',3); line(g,cx,cy,m1x,m1y,C.red,3.4); dot(g,cx,cy,3.5,'#0c1217',C.txt,1.2);
  { const [lx,ly]=polar(cx,cy,r*0.55,mdir), sd=Math.cos(mdir*D2R)>=0?-1:1; tag(g,L(t2('compass magnet','kompassmagnet'))+(Math.abs(V.psi)>1?' · '+L(t2('swung ','svingt '))+nf(Math.abs(V.psi),0)+'°':''),lx+sd*10,ly,C.red,{sz:10.5,al:sd<0?'right':'left'}); }
  tag(g,L(t2('heading ','kurs '))+d3(S.th)+' T',A[0]+A[2]-8,A[1]+A[3]-14,C.txt,{sz:10.5,al:'right',bg:false});

  /* the compass as the pilot sees it */
  panel(g,...B,L(t2('WHAT THE COMPASS SHOWS','DET KOMPASSET VISER')));
  const ww=Math.min(B[2]-30,ph?320:380), wh=Math.min(B[3]*0.38,70), wx=B[0]+(B[2]-ww)/2, wy=B[1]+(ph?24:30);
  g.fillStyle='#0b0e11'; rr(g,wx-8,wy-8,ww+16,wh+16,12); g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1; g.stroke();
  g.save(); rr(g,wx,wy,ww,wh,8); g.clip(); g.fillStyle='#14181c'; g.fillRect(wx,wy,ww,wh);
  const ppd=ww/80, mid=wx+ww/2;
  for(let d=Math.floor(M.shown-45);d<=M.shown+45;d++){ const x=mid+(d-M.shown)*ppd; if(d%5===0) line(g,x,wy+wh*0.12,x,wy+wh*(d%10?0.3:0.42),'#E6ECF0',d%10?1:1.6);
    if(d%30===0){ const n=Y.norm(d), s={0:'N',90:'E',180:'S',270:'W'}[n]||String(n/10); txt(g,s,x,wy+wh*0.8,'#F4F7F9','center',ph?15:18,600,SANS); } }
  const sh=g.createLinearGradient(wx,0,wx+ww,0); sh.addColorStop(0,'rgba(0,0,0,.75)'); sh.addColorStop(0.18,'rgba(0,0,0,0)'); sh.addColorStop(0.82,'rgba(0,0,0,0)'); sh.addColorStop(1,'rgba(0,0,0,.75)'); g.fillStyle=sh; g.fillRect(wx,wy,ww,wh);
  g.restore(); line(g,mid,wy-6,mid,wy+wh+6,'#F09A3E',2.4);
  const ry=wy+wh+(ph?28:34), cw=B[2]/3, err=M.err, ec=Math.abs(err)<2?C.ok:Math.abs(err)<10?C.amb:C.red;
  [[L(t2('MAGNETIC','MAGNETISK')),d3(M.mh),C.txt],[L(t2('COMPASS SHOWS','KOMPASSET VISER')),d3(M.shown),C.amb],[L(t2('ERROR','FEIL')),(Math.abs(err)<0.5?'0':sg(err))+'°',ec]].forEach(([k,v,c],i)=>{
    txt(g,k,B[0]+cw*(i+0.5),ry,C.mut,'center',9.5,600,SANS); txt(g,v,B[0]+cw*(i+0.5),ry+(ph?18:22),c,'center',ph?15:18,600); });
  if(deepOn()&&Math.abs(M.dev)>=0.5) txt(g,L(t2('deviation ','deviasjon '))+nf(Math.abs(M.dev),1)+'° '+(M.dev>0?'E':'W')+' · '+L(t2('steady compass heading ','stabil kompasskurs '))+d3(M.ch),B[0]+B[2]/2,ry+(ph?36:44),C.mut,'center',10);

  /* dip: the field seen from the side */
  panel(g,...Cc,L(t2('THE FIELD FROM THE SIDE (DIP)','FELTET FRA SIDEN (INKLINASJON)')));
  const gy=Cc[1]+Cc[3]*0.42, gx0=Cc[0]+16, gx1=Cc[0]+Cc[2]-16, ox=Cc[0]+Cc[2]*(ph?0.4:0.36), len=Math.min(Cc[3]*0.5,Cc[2]*0.3), dp=M.dip;
  line(g,gx0,gy,gx1,gy,'rgba(214,226,236,.35)',1); txt(g,'S',gx0,gy+15,C.mut,'left',10,600,SANS); txt(g,'N',gx1,gy+15,C.mut,'right',10,600,SANS);
  const hx=ox+len*Math.cos(dp*D2R), hy=gy+len*Math.sin(dp*D2R);
  if(Math.abs(Math.cos(dp*D2R))*len>8) arrow(g,ox,gy,hx,gy,C.cy,2,7);
  if(Math.abs(hy-gy)>8) arrow(g,hx,gy,hx,hy,C.vio,2,7);
  arrow(g,ox,gy,hx,hy,'#F4F7F9',2.4,9);
  txt(g,'H',(ox+hx)/2,gy-6,C.cy,'center',11,700,SANS); if(Math.abs(hy-gy)>14) txt(g,'Z',hx+8,(gy+hy)/2+4,C.vio,'left',11,700,SANS);
  const tx0=Cc[0]+Cc[2]*(ph?0.62:0.6), tl=[[L(t2('latitude ','breddegrad '))+latS(S.lat),C.txt],[L(t2('dip ','inklinasjon '))+nf(Math.abs(dp),0)+'°',C.txt],['Z / H = '+nf(Math.abs(Math.tan(dp*D2R)),1),C.vio]];
  tl.forEach(([s,c],i)=>txt(g,s,tx0,Cc[1]+30+i*(ph?15:18),c,'left',ph?10:11));
  txt(g,L(Math.abs(S.lat)<5?t2('no dip: no turning or acceleration errors','ingen inklinasjon: ingen sving- eller akselerasjonsfeil'):Math.abs(S.lat)>70?t2('weak H: the compass becomes sluggish and unreliable','svak H: kompasset blir tregt og upålitelig'):t2('only H steers the magnet; Z causes the errors','bare H styrer magneten; Z gir feilene')),Cc[0]+Cc[2]/2,Cc[1]+Cc[3]-10,C.mut,'center',ph?9.5:10.5,500,SANS);
}

/* ===== mode 2: gyroscopes ===== */
const CAM={yaw:-32*D2R,pitch:18*D2R};
function proj(p,cx,cy,s){ const cy1=Math.cos(CAM.yaw), sy1=Math.sin(CAM.yaw); const x=p[0]*cy1+p[2]*sy1, z=-p[0]*sy1+p[2]*cy1; const cp=Math.cos(CAM.pitch), sp=Math.sin(CAM.pitch); const y=p[1]*cp-z*sp, z2=p[1]*sp+z*cp; return [cx+x*s,cy-y*s,z2]; }
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], nrm=a=>{ const l=Math.hypot(...a)||1; return a.map(v=>v/l); }, dotv=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function basis(n){ const up=Math.abs(n[1])>0.9?[0,0,1]:[0,1,0]; const e1=nrm(up.map((v,i)=>v-dotv(up,n)*n[i])); return [e1,cross(n,e1)]; }
const rimPt=(n,th)=>{ const [e1,e2]=basis(n); return e1.map((v,i)=>Math.cos(th*D2R)*v+Math.sin(th*D2R)*e2[i]); };
function drawGyr(g,W,H,top,ph){ let A,B; if(ph){ A=[8,top,W-16,H*0.5-top]; B=[8,H*0.51,W-16,H*0.49-8]; } else { const xs=W*0.5; A=[10,top,xs-16,H-top-10]; B=[xs,top,W-xs-10,H-top-10]; }
  panel(g,...A,L(ph?t2('THE ROTOR','ROTOREN'):t2('THE ROTOR · tap the rim to push it','ROTOREN · trykk på kanten for å dytte')));
  const cx=A[0]+A[2]*0.5, cy=A[1]+A[3]*0.52, s=Math.min(A[2]*0.3,A[3]*0.34), n=S.n, [e1,e2]=basis(n);
  /* the spin axis, back half */
  const ax0=proj(n.map(v=>-v*1.55),cx,cy,s), ax1=proj(n.map(v=>v*1.55),cx,cy,s), o=proj([0,0,0],cx,cy,s);
  line(g,ax0[0],ax0[1],o[0],o[1],'#9AA6B1',3);
  /* the disc */
  const rim=[]; for(let i=0;i<=72;i++){ rim.push(proj(rimPt(n,i*5),cx,cy,s)); }
  const gr=g.createLinearGradient(cx-s,cy-s,cx+s,cy+s); gr.addColorStop(0,'#5d6b78'); gr.addColorStop(1,'#26303a');
  poly(g,rim.map(p=>[p[0],p[1]]),'rgba(230,236,240,.75)',2,null,gr);
  const inner=[]; for(let i=0;i<=72;i++){ inner.push(proj(rimPt(n,i*5).map(v=>v*0.82),cx,cy,s)); } poly(g,inner.map(p=>[p[0],p[1]]),'rgba(230,236,240,.25)',1);
  /* spin markers turning with the rotor */
  const sp=S.rpm>2;
  for(let k=0;k<6;k++){ const th=S.spin+k*60, p=proj(rimPt(n,th).map(v=>v*0.91),cx,cy,s); dot(g,p[0],p[1],3.2,k?'#C9D2DA':C.amb); }
  /* direction of spin */
  if(sp){ const pts=[]; for(let a=20;a<=80;a+=4) pts.push(proj(rimPt(n,a).map(v=>v*1.12),cx,cy,s)); poly(g,pts.map(p=>[p[0],p[1]]),C.amb,1.8); const a1=pts[pts.length-2], a2=pts[pts.length-1]; arrow(g,a1[0],a1[1],a2[0],a2[1],C.amb,1.8,8); }
  line(g,o[0],o[1],ax1[0],ax1[1],'#E6ECF0',3.2); dot(g,ax1[0],ax1[1],4,'#E6ECF0');
  tag(g,L(t2('spin axis','spinnakse')),ax1[0]+8,ax1[1]-10,C.txt,{sz:10.5});
  /* the push and where it acts */
  if(S.push){ const P=S.push, a=proj(P.r,cx,cy,s), b=proj(P.r.map((v,i)=>v-n[i]*0.55),cx,cy,s); arrow(g,a[0]+(a[0]-b[0])*0.9,a[1]+(a[1]-b[1])*0.9,a[0],a[1],C.red,2.6,9);
    tag(g,L(t2('you push here','du dytter her')),a[0]+(a[0]-b[0])*0.9,a[1]+(a[1]-b[1])*0.9-14,C.red,{sz:10.5,al:'center'});
    if(P.eff){ const e=proj(P.eff,cx,cy,s), f=proj(P.eff.map((v,i)=>v-n[i]*0.55),cx,cy,s); arrow(g,e[0],e[1],f[0],f[1],C.ok,2.6,9); tag(g,L(P.spin?t2('it moves here, 90° on','den beveger seg her, 90° videre'):t2('no spin: it moves where you push','uten spinn: den beveger seg der du dytter')),f[0],f[1]+16,C.ok,{sz:10.5,al:'center'}); } }
  GEO.rim={cx,cy,s};
  /* drive */
  const dl=S.drive==='vac'?t2('driven by air: engine vacuum pump','drevet av luft: motordrevet vakuumpumpe'):t2('driven by an electric motor','drevet av en elektrisk motor');
  txt(g,L(dl)+' · '+nf(S.rpm,0)+' %',A[0]+10,A[1]+A[3]-12,S.rpm<60?C.amb:C.mut,'left',10,500,SANS);
  /* the heading indicator and its drift */
  panel(g,...B,L(t2('HEADING INDICATOR DRIFT','DRIFT I KURSGYROEN')));
  const D=diModel(), hdg=90, shown=Y.norm(hdg+D.err), r=Math.min(B[2]*(ph?0.2:0.22),B[3]*0.26), hx=B[0]+r*1.25+18, hy=B[1]+r*1.15+30;
  gHI(g,hx,hy,r,shown,hdg);
  const tx0=hx+r*1.3+14, rows=[[L(t2('real heading','virkelig kurs')),d3(hdg),C.cy],[L(t2('indicator shows','indikatoren viser')),d3(shown),C.amb],[L(t2('error after ','feil etter '))+nf(S.tmin,0)+' min',sg(D.err,1)+'°',Math.abs(D.err)>5?C.red:Math.abs(D.err)>2?C.amb:C.ok]];
  rows.forEach(([k,v,c],i)=>{ txt(g,k,tx0,hy-r*0.55+i*(ph?30:36),C.mut,'left',9.5,600,SANS); txt(g,v,tx0,hy-r*0.55+i*(ph?30:36)+(ph?15:17),c,'left',ph?13:15,600); });
  /* the rate budget, as bars */
  const by0=hy+r*1.25+16, bw=B[2]-28, bx0=B[0]+14, items=[[t2('earth rate','jordrotasjon'),-D.er,C.cy],[t2('transport wander','transportdrift'),-D.tw,C.vio],[t2('latitude nut','breddegradsmutter'),D.nut,C.ok]];
  if(deepOn()&&S.real) items.push([t2('real wander','virkelig drift'),S.real,'#AEB8C1']); items.push([t2('reading drifts','avlesningen driver'),D.rate,C.amb]);
  const rowH=Math.min(ph?22:26,(B[1]+B[3]-by0-10)/items.length), mx=Math.max(15,...items.map(i=>Math.abs(i[1]))), z=bx0+bw*0.55, sc=bw*0.42/mx;
  line(g,z,by0-4,z,by0+rowH*items.length-4,'rgba(214,226,236,.3)',1);
  items.forEach(([k,v,c],i)=>{ const y=by0+i*rowH, last=i===items.length-1; txt(g,L(k),z-bw*0.02-Math.max(0,-v*sc)-2,y+rowH*0.55,last?C.txt:C.mut,'right',ph?9.5:10.5,last?650:500,SANS);
    g.fillStyle=c; g.globalAlpha=last?0.95:0.75; rr(g,v<0?z+v*sc:z,y+rowH*0.18,Math.max(1.5,Math.abs(v)*sc),rowH*0.5,2); g.fill(); g.globalAlpha=1;
    txt(g,sg(v,1)+' °/h',v<0?z+4:z+Math.abs(v)*sc+6,y+rowH*0.55,c,'left',ph?9.5:10.5,600); });
  if(B[2]>520) txt(g,latS(S.dlat)+' · '+L(t2('E–W groundspeed ','Ø–V groundspeed '))+sg(S.vE)+' kt',B[0]+B[2]-10,B[1]+16,C.mut,'right',10);
}
/* heading indicator: rotating card, lubber line at the top, cyan bug at the real heading */
function gHI(g,cx,cy,r,shown,real,dead){ face(g,cx,cy,r);
  for(let d=0;d<360;d+=5){ const a=d-shown, [x1,y1]=polar(cx,cy,r*0.96,a), [x2,y2]=polar(cx,cy,r*(d%10?0.88:0.82),a); line(g,x1,y1,x2,y2,'#DDE4EA',d%10?1:1.4); }
  for(let d=0;d<360;d+=30){ const a=d-shown, [x,y]=polar(cx,cy,r*0.64,a); g.save(); g.translate(x,y); g.rotate(a*D2R); g.font=`600 ${Math.max(8,r*0.17)}px ${SANS}`; g.fillStyle='#F4F7F9'; g.textAlign='center'; g.textBaseline='middle'; g.fillText({0:'N',90:'E',180:'S',270:'W'}[d]||String(d/10),0,0); g.restore(); }
  if(real!=null){ const a=real-shown, [x,y]=polar(cx,cy,r*1.02,a), [x2,y2]=polar(cx,cy,r*0.86,a); arrow(g,x,y,x2,y2,C.cy,2.5,8); }
  line(g,cx,cy-r*1.08,cx,cy-r*0.8,'#F09A3E',2.6);
  planeTop(g,cx,cy,r*0.34,0,'#F09A3E'); if(dead) flag(g,cx+r*0.35,cy+r*0.35,'HDG',38); glassHi(g,cx,cy,r); g.textAlign='left'; g.textBaseline='alphabetic'; }

/* ===== mode 3: the instruments ===== */
function aiState(){ /* what the attitude reference shows (pitch, bank) and whether it is valid */
  let p=S.ip, b=S.ib; const glass=S.cls!=='pis';
  if(S.toT>0&&!glass){ p+=3*Math.min(1,S.toT/2); b+=2.5*Math.min(1,S.toT/2); }
  if(!glass&&S.fault==='vac'){ const k=clamp(S.failT/40,0,1); b+=k*k*35; p-=k*k*9; }
  if(!glass&&S.fault==='topple'){ const k=Math.exp(-S.failT/60); b+=k*70*Math.sin(S.failT*0.15+1); p+=k*30*Math.cos(S.failT*0.11); }
  return {p,b,bad:glass&&S.fault==='att'&&!S.src2}; }
function gAI(g,cx,cy,r,p,b){ face(g,cx,cy,r); const ppd=r*0.032;
  g.save(); g.beginPath(); g.arc(cx,cy,r*0.93,0,Math.PI*2); g.clip(); g.translate(cx,cy); g.rotate(-b*D2R); g.translate(0,p*ppd);
  g.fillStyle=C.sky; g.fillRect(-r*2,-r*3,r*4,r*3); g.fillStyle=C.gnd; g.fillRect(-r*2,0,r*4,r*3); line(g,-r*2,0,r*2,0,'#F4F7F9',1.6);
  for(const k of [-20,-10,10,20]){ const y=-k*ppd, w=r*(Math.abs(k)===10?0.22:0.32); line(g,-w,y,w,y,'rgba(244,247,249,.85)',1.2); }
  for(const k of [-15,-5,5,15]){ const y=-k*ppd; line(g,-r*0.1,y,r*0.1,y,'rgba(244,247,249,.6)',1); }
  g.restore();
  /* bank scale on the case, pointer turning with the horizon */
  for(const a of [-60,-30,-20,-10,0,10,20,30,60]){ const [x1,y1]=polar(cx,cy,r*0.98,a), [x2,y2]=polar(cx,cy,r*(Math.abs(a)%30?0.9:0.84),a); line(g,x1,y1,x2,y2,'#F4F7F9',a?1.4:2); }
  g.save(); g.translate(cx,cy); g.rotate(-b*D2R); g.fillStyle='#F4F7F9'; g.beginPath(); g.moveTo(0,-r*0.8); g.lineTo(-r*0.06,-r*0.7); g.lineTo(r*0.06,-r*0.7); g.closePath(); g.fill(); g.restore();
  /* miniature aircraft */
  g.strokeStyle='#F0B440'; g.lineWidth=Math.max(2.5,r*0.05); g.beginPath(); g.moveTo(cx-r*0.5,cy); g.lineTo(cx-r*0.16,cy); g.lineTo(cx,cy+r*0.1); g.lineTo(cx+r*0.16,cy); g.lineTo(cx+r*0.5,cy); g.stroke(); dot(g,cx,cy,r*0.04,'#F0B440');
  glassHi(g,cx,cy,r); }
function gTC(g,cx,cy,r,rate,slip,dead){ face(g,cx,cy,r);
  /* level marks and rate-one marks: the wing tip lines up with them at 3 °/s */
  for(const a of [-90,90,-105,105]){ const [x1,y1]=polar(cx,cy-r*0.05,r*0.95,a), [x2,y2]=polar(cx,cy-r*0.05,r*0.8,a); line(g,x1,y1,x2,y2,'#F4F7F9',2); }
  txt(g,'L',cx-r*0.72,cy+r*0.42,'#F4F7F9','center',Math.max(8,r*0.17)/FS,700,SANS); txt(g,'R',cx+r*0.72,cy+r*0.42,'#F4F7F9','center',Math.max(8,r*0.17)/FS,700,SANS);
  txt(g,'2 MIN',cx,cy+r*0.5,'#8E99A4','center',Math.max(7,r*0.11)/FS,600,SANS); txt(g,'NO PITCH INFO',cx,cy-r*0.48,'#5E6D7C','center',Math.max(6.5,r*0.09)/FS,600,SANS);
  const a=clamp(rate/3,-1.6,1.6)*15; g.save(); g.translate(cx,cy-r*0.05); g.rotate(a*D2R); g.strokeStyle='#F4F7F9'; g.lineWidth=Math.max(2.5,r*0.05); g.lineCap='round'; g.beginPath(); g.moveTo(-r*0.62,0); g.lineTo(r*0.62,0); g.moveTo(0,0); g.lineTo(0,-r*0.14); g.stroke(); dot(g,0,0,r*0.08,'#F4F7F9'); g.restore(); g.lineCap='butt';
  /* the ball */
  const tw=r*0.9, ty=cy+r*0.7; g.fillStyle='rgba(230,236,240,.12)'; rr(g,cx-tw/2,ty-r*0.09,tw,r*0.18,r*0.09); g.fill(); line(g,cx-r*0.1,ty-r*0.1,cx-r*0.1,ty+r*0.1,'#AEB8C1',1); line(g,cx+r*0.1,ty-r*0.1,cx+r*0.1,ty+r*0.1,'#AEB8C1',1);
  dot(g,cx+clamp(slip,-1,1)*tw*0.4,ty,r*0.075,'#0c0f12','#DDE4EA',1.2);
  if(dead) flag(g,cx-r*0.3,cy+r*0.15,'OFF',36); glassHi(g,cx,cy,r); }
function gSuction(g,cx,cy,r,v){ face(g,cx,cy,r); const ang=x=>-120+clamp(x,0,10)/10*240;
  for(let k=0;k<=10;k++){ const [x1,y1]=polar(cx,cy,r*0.95,ang(k)), [x2,y2]=polar(cx,cy,r*0.8,ang(k)); line(g,x1,y1,x2,y2,'#DDE4EA',1); }
  g.strokeStyle='#4FA36B'; g.lineWidth=r*0.1; g.beginPath(); g.arc(cx,cy,r*0.86,(ang(4.5)-90)*D2R,(ang(5.5)-90)*D2R); g.stroke();
  const [x,y]=polar(cx,cy,r*0.8,ang(v)); line(g,cx,cy,x,y,'#F4F7F9',2); txt(g,'inHg',cx,cy+r*0.55,'#8E99A4','center',Math.max(7,r*0.2)/FS,600,SANS); }
/* the glass primary flight display: attitude, slip, heading with a turn-rate trend */
function pfd(g,x,y,w,h,att,hdg,rate,slip,cls){ g.fillStyle='#05080b'; rr(g,x,y,w,h,6); g.fill(); g.strokeStyle='rgba(255,255,255,.14)'; g.lineWidth=1; g.stroke();
  const ah=h*0.66, cx=x+w/2, cy=y+ah*0.52, ppd=ah/48;
  g.save(); rr(g,x+6,y+6,w-12,ah,4); g.clip();
  if(att.bad){ g.fillStyle='#000'; g.fillRect(x,y,w,ah+6); line(g,x+20,y+16,x+w-20,y+ah-6,C.red,3); line(g,x+w-20,y+16,x+20,y+ah-6,C.red,3); g.restore(); tag(g,'ATT',cx,cy,C.red,{sz:16,al:'center'}); }
  else { g.translate(cx,cy); g.rotate(-att.b*D2R); g.translate(0,att.p*ppd); const sk=g.createLinearGradient(0,-ah,0,0); sk.addColorStop(0,'#0E4E91'); sk.addColorStop(1,'#3C8AD0'); g.fillStyle=sk; g.fillRect(-w*1.5,-h*2,w*3,h*2);
    const gd=g.createLinearGradient(0,0,0,ah); gd.addColorStop(0,'#8A5A2B'); gd.addColorStop(1,'#4A2F17'); g.fillStyle=gd; g.fillRect(-w*1.5,0,w*3,h*2); line(g,-w*1.5,0,w*1.5,0,'#fff',1.6);
    for(let k=-30;k<=30;k+=5){ if(!k) continue; const yy=-k*ppd, ww=k%10?w*0.06:w*0.12; line(g,-ww,yy,ww,yy,'#fff',1.2); if(k%10===0){ g.font=`600 ${10*FS}px ${MONO}`; g.fillStyle='#fff'; g.textAlign='right'; g.fillText(String(Math.abs(k)),-ww-4,yy+4); g.textAlign='left'; } }
    g.restore();
    /* bank arc and pointer, slip trapezoid under it */
    const br=ah*0.42; for(const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){ const [x1,y1]=polar(cx,cy,br,a), [x2,y2]=polar(cx,cy,br+(Math.abs(a)%30?6:10),a); line(g,x1,y1,x2,y2,'#fff',1.3); }
    g.save(); g.translate(cx,cy); g.rotate(-att.b*D2R); g.fillStyle='#fff'; g.beginPath(); g.moveTo(0,-br+1); g.lineTo(-7,-br+12); g.lineTo(7,-br+12); g.closePath(); g.fill(); g.fillRect(-8+clamp(slip,-1,1)*10,-br+14,16,4); g.restore();
    g.strokeStyle='#FFD34A'; g.lineWidth=4; g.beginPath(); g.moveTo(cx-w*0.24,cy); g.lineTo(cx-w*0.08,cy); g.moveTo(cx+w*0.08,cy); g.lineTo(cx+w*0.24,cy); g.stroke(); g.fillStyle='#FFD34A'; g.fillRect(cx-3,cy-3,6,6); }
  /* heading arc at the bottom */
  const hr=h*0.42, hcy=y+h+hr*0.5, hx=cx;
  g.save(); rr(g,x+6,y+ah+10,w-12,h-ah-14,4); g.clip();
  if(att.bad){ txt(g,'HDG',hx,y+ah+h*0.2,C.red,'center',14,700,SANS); }
  else { for(let d=0;d<360;d+=5){ const a=d-hdg; if(Math.abs(Y.wrap(a))>60) continue; const [x1,y1]=polar(hx,hcy,hr,a), [x2,y2]=polar(hx,hcy,hr-(d%10?5:9),a); line(g,x1,y1,x2,y2,'#E6ECF0',1.2);
      if(d%30===0){ const [tx,ty]=polar(hx,hcy,hr-20,a); txt(g,{0:'N',90:'E',180:'S',270:'W'}[d]||String(d/10),tx,ty+4,'#F4F7F9','center',11,600,SANS); } }
    /* turn-rate trend: where the heading will be in 6 s */
    const tr=clamp(rate*6,-60,60); if(Math.abs(tr)>0.5){ g.strokeStyle=C.mag; g.lineWidth=3; g.beginPath(); g.arc(hx,hcy,hr+3,-Math.PI/2,(-90+tr)*D2R,tr<0); g.stroke(); } }
  g.restore();
  g.fillStyle='#05080b'; rr(g,hx-24,y+ah+8,48,18,3); g.fill(); g.strokeStyle='#E6ECF0'; g.lineWidth=1; g.stroke(); txt(g,att.bad?'---':d3(hdg).replace('°',''),hx,y+ah+21,att.bad?C.red:'#F4F7F9','center',12,600);
  txt(g,cls==='jet'?(S.src2&&S.fault==='att'?'IR 3':'IR 1'):(S.src2&&S.fault==='att'?'AHRS 2':'AHRS 1'),x+10,y+h-8,S.src2&&S.fault==='att'?C.amb:'#71CC93','left',10,600); }
function drawIns(g,W,H,top,ph){ const glass=S.cls!=='pis', att=aiState(), rate=Y.turnRate(TAS[S.cls],S.ib), hdg=S.ihdg;
  const A=[ph?8:10,top,W-(ph?16:20),H-top-(ph?8:10)];
  if(!glass){ panel(g,...A,L(t2('LIGHT PISTON · CLASSIC GYRO INSTRUMENTS','SMÅFLY MED STEMPELMOTOR · KLASSISKE GYROINSTRUMENTER')));
    const n=3, gw=A[2]/n, capH=deepOn()?70:58, r=ph?Math.min(A[2]*0.22,(A[3]-150)/4.9):Math.max(30,Math.min(gw*0.38,(A[3]-capH-60)/2.25)), gy=A[1]+(ph?34:38)+r*1.1;
    const vacOk=S.fault!=='vac', elOk=S.fault!=='elec';
    const hiShown=Y.norm(hdg+V.hiE), tcRate=elOk?rate:rate*Math.exp(-S.failT/8);
    const cxs=ph?[A[0]+A[2]*0.27,A[0]+A[2]*0.73,A[0]+A[2]*0.5]:[0,1,2].map(i=>A[0]+gw*(i+0.5)), gys=ph?[gy,gy,gy+r*2.2+62]:[gy,gy,gy];
    gAI(g,cxs[0],gys[0],r,att.p,att.b); gHI(g,cxs[1],gys[1],r,hiShown,null); gTC(g,cxs[2],gys[2],r,tcRate,S.slip,!elOk);
    const caps=[[t2('ATTITUDE','HOLDNING'),t2('earth gyro, vertical spin axis','jordgyro, loddrett spinnakse'),t2('pitch and bank','pitch og krengning'),'vac'],[t2('HEADING','KURS'),t2('directional gyro, horizontal axis','retningsgyro, vannrett akse'),t2('heading, set from the compass','kurs, satt etter kompasset'),'vac'],[t2('TURN COORDINATOR','SVINGKOORDINATOR'),t2('rate gyro, axis canted ~30°','rategyro, akse vippet ~30°'),t2('rate of roll and yaw; ball: slip','rate av rull og gir; kula: skrens'),'elec']];
    caps.forEach(([a,b,c,pw],i)=>{ const x=cxs[i], y=gys[i]+r*1.1+16; txt(g,L(a),x,y,C.txt,'center',ph?9.5:11,650,SANS);
      if(!ph) txt(g,L(b),x,y+16,C.mut,'center',10,500,SANS); txt(g,L(c),x,y+(ph?14:32),C.mut,'center',ph?8.5:10,500,SANS);
      const ok=pw==='vac'?vacOk:elOk; txt(g,(pw==='vac'?L(t2('vacuum','vakuum')):L(t2('electric','elektrisk')))+(ok?'':' ✕'),x,gys[i]-r*1.1-8,ok?'#71CC93':C.red,'center',ph?8.5:9.5,600); });
    /* suction gauge and bus */
    const sr=Math.min(r*0.36,26), sx=A[0]+A[2]-sr-14, sy=A[1]+A[3]-sr-12;
    gSuction(g,sx,sy,sr,vacOk?5:Math.max(0,5-S.failT)); txt(g,L(t2('SUCTION','SUG')),sx-sr-10,sy+4,C.mut,'right',9.5,600,SANS);
    txt(g,L(t2('time ×4 · TAS ','tid ×4 · TAS '))+TAS.pis+' kt',A[0]+10,A[1]+A[3]-10,C.dim,'left',9.5);
  } else { panel(g,...A,L(S.cls==='tp'?t2('TURBOPROP · GLASS, AHRS-DRIVEN','TURBOPROP · GLASS, DREVET AV AHRS'):t2('JET · GLASS, IRS-DRIVEN (ADIRS)','JETFLY · GLASS, DREVET AV IRS (ADIRS)')));
    const pw=ph?A[2]-16:Math.min(A[2]*0.5,(A[3]-40)*1.05), ph2=ph?A[3]*0.55:A[3]-40, px=A[0]+(ph?8:14), py=A[1]+26;
    pfd(g,px,py,pw,ph2,att,hdg,rate,S.slip,S.cls);
    /* the sensor chain */
    const bx=ph?A[0]+8:px+pw+22, by=ph?py+ph2+12:py+4, bw=ph?A[2]-16:A[0]+A[2]-bx-12, bh=ph?A[1]+A[3]-by-6:ph2-4;
    const chain=S.cls==='tp'?[[t2('AHRS ×2','AHRS ×2'),t2('MEMS or fibre-optic gyros + accelerometers: attitude and turn rate','MEMS- eller fiberoptiske gyroer + akselerometre: holdning og svingrate'),S.fault==='att'?(S.src2?'sw':'bad'):'ok'],[t2('Magnetometer','Magnetometer'),t2('flux valve in the wing tip: slaves the heading to magnetic north','fluxventil i vingetuppen: slaver kursen mot magnetisk nord'),'ok'],[t2('Air data','Luftdata'),t2('TAS helps correct the attitude in accelerations','TAS hjelper å korrigere holdningen i akselerasjoner'),'ok'],[t2('GNSS','GNSS'),t2('optional aiding; the AHRS gives no position','valgfri hjelp; AHRS gir ingen posisjon'),S.fault==='gnss'?'lost':'ok']]
      :[[t2('ADIRU ×3','ADIRU ×3'),t2('ring-laser gyros + accelerometers: attitude, heading, position, groundspeed','ringlasergyroer + akselerometre: holdning, kurs, posisjon, groundspeed'),S.fault==='att'?(S.src2?'sw':'bad'):'ok'],[t2('No magnetometer','Ingen magnetometer'),t2('true heading from alignment; magnetic heading = true − variation table','rettvisende kurs fra innrettingen; magnetisk = rettvisende − misvisningstabell'),'ok'],[t2('Air data (ADR)','Luftdata (ADR)'),t2('in the same box: speeds, altitude, wind','i samme boks: farter, høyde, vind'),'ok'],[t2('GNSS','GNSS'),t2('mixed with the IRS position in the FMS (hybrid)','blandes med IRS-posisjonen i FMS (hybrid)'),S.fault==='gnss'?'lost':'ok']];
    const rh=Math.min((bh-(ph?6:50))/chain.length,ph?40:64);
    chain.forEach(([a,b,st],i)=>{ const y=by+i*rh, col=st==='ok'?'#71CC93':st==='sw'?C.amb:C.red; g.fillStyle='rgba(255,255,255,.04)'; rr(g,bx,y,bw,rh-6,5); g.fill(); g.fillStyle=col; g.fillRect(bx,y,3,rh-6);
      txt(g,L(a)+(st==='bad'?L(t2(' · no. 1 FAILED',' · nr. 1 FEILET')):st==='lost'?L(t2(' · LOST',' · TAPT')):st==='sw'?L(t2(' · 1 failed, source switched',' · 1 feilet, kilde byttet')):''),bx+12,y+(ph?14:18),st==='ok'?C.txt:col,'left',ph?10:11.5,650,SANS);
      wrapTxt(g,L(b),bx+12,y+(ph?27:34),bw-20,ph?9:10.5,ph?1:2,C.mut); });
    if(!ph){ const sx=bx, sy=by+chain.length*rh+4, sr=Math.min(30,(A[1]+A[3]-sy-14)/2.3); if(sr>18){ const scx=sx+sr*1.15, scy=sy+sr*1.15; gAI(g,scx,scy,sr,S.ip,S.ib); txt(g,L(t2('standby attitude: its own sensors and power','reserveinstrument: egne sensorer og egen strøm')),scx+sr*1.3,scy+4,C.mut,'left',10,500,SANS); } }
  }
}
function wrapTxt(g,s,x,y,w,sz,maxL,col){ g.font=`500 ${sz*FS}px ${SANS}`; const words=s.split(' '); let ln='', n=0, yy=y;
  for(const wd of words){ const t=ln?ln+' '+wd:wd; if(g.measureText(t).width>w&&ln){ g.fillStyle=col; g.fillText(n===maxL-1?ln+' …':ln,x,yy); n++; yy+=sz*1.35*FS; ln=wd; if(n>=maxL) return; } else ln=t; }
  if(ln&&n<maxL){ g.fillStyle=col; g.fillText(ln,x,yy); } }

/* ===== mode 4 (Deep dive): inertial reference ===== */
function drawIrs(g,W,H,top,ph){ let A,B; if(ph){ A=[8,top,W-16,H*0.5-top]; B=[8,H*0.51,W-16,H*0.49-8]; } else { const xs=W*0.46; A=[10,top,xs-16,H-top-10]; B=[xs,top,W-xs-10,H-top-10]; }
  panel(g,...A,L(t2('ALIGNMENT: FINDING NORTH FROM THE EARTH’S SPIN','INNRETTING: FINNE NORD FRA JORDROTASJONEN')));
  const R0=Math.min(A[2]*0.28,A[3]*0.27), cx=A[0]+A[2]*(ph?0.34:0.4), cy=A[1]+A[3]*0.5, la=S.rlat*D2R;
  const eg=g.createRadialGradient(cx-R0*0.3,cy-R0*0.3,R0*0.1,cx,cy,R0); eg.addColorStop(0,'#2d4d63'); eg.addColorStop(1,'#14242f'); dot(g,cx,cy,R0,eg,'rgba(127,203,232,.35)',1);
  line(g,cx-R0,cy,cx+R0,cy,'rgba(214,226,236,.2)',1,[3,4]); line(g,cx,cy+R0*1.05,cx,cy-R0*1.35,'rgba(214,226,236,.45)',1.2); arrow(g,cx,cy-R0*1.05,cx,cy-R0*1.38,'rgba(214,226,236,.7)',1.6,7);
  txt(g,'Ω 15.04 °/h',cx-8,cy-R0*1.22,'#AEB8C1','right',10);
  const px=cx+Math.cos(la)*R0, py=cy-Math.sin(la)*R0; line(g,cx,cy,px,py,'rgba(214,226,236,.25)',1); dot(g,px,py,4.5,C.amb);
  const vl=R0*0.75*Math.sin(la), hl=R0*0.75*Math.cos(la), ux=Math.cos(la), uy=-Math.sin(la), nx=-Math.sin(la), ny=-Math.cos(la);
  if(vl>3) arrow(g,px,py,px+ux*vl,py+uy*vl,C.vio,2.2,8); if(hl>3) arrow(g,px,py,px+nx*hl,py+ny*hl,C.cy,2.6,8);
  tag(g,L(t2('horizontal ','horisontal '))+nf(Y.earthRateH(S.rlat),1)+' °/h → '+L(t2('north','nord')),px+nx*hl-4,py+ny*hl-12,C.cy,{sz:10,al:'right'});
  if(vl>10) tag(g,L(t2('vertical ','vertikal '))+nf(Y.earthRate(S.rlat),1)+' °/h',px+ux*vl+6,py+uy*vl,C.vio,{sz:10});
  /* status */
  const st=S.ali, am=Y.alignMin(S.rlat), sx=A[0]+12, sy=A[1]+A[3]-(ph?46:58);
  const lab=st==='off'?[t2('IR OFF · press Start alignment','IR AV · trykk Start innretting'),C.mut]:st==='align'?[t2('ALIGN · ','ALIGN · '),C.amb]:st==='nav'?[t2('NAV · aligned','NAV · innrettet'),C.ok]:[t2('ALIGN FAULT','ALIGN FAULT'),C.red];
  txt(g,L(lab[0])+(st==='align'?nf(Math.max(0,am*(1-S.prog)),1)+' min':''),sx,sy,lab[1],'left',ph?11:12.5,650);
  g.fillStyle='rgba(255,255,255,.08)'; rr(g,sx,sy+8,A[2]-24,6,3); g.fill(); g.fillStyle=lab[1]; rr(g,sx,sy+8,(A[2]-24)*(st==='nav'?1:st==='off'?0:S.prog),6,3); g.fill();
  const why=st==='fault'?(S.fwhy==='pos'?t2('entered latitude disagrees with the one the IR measured','innlagt breddegrad stemmer ikke med den IR målte'):t2('the aircraft moved: alignment restarts','flyet beveget seg: innrettingen starter på nytt')):st==='off'&&am===Infinity?t2('beyond ~78° the horizontal earth rate is too small to align','over ~78° er den horisontale jordrotasjonen for liten til å innrette'):t2('typical alignment time here: ','typisk innrettingstid her: ');
  txt(g,L(why)+(st!=='fault'&&am!==Infinity&&st!=='fault'&&!(st==='off'&&am===Infinity)?nf(am,0)+' min':''),sx,sy+(ph?28:32),st==='fault'?C.red:C.mut,'left',ph?9.5:10.5,500,SANS);
  /* drift */
  panel(g,...B,L(t2('POSITION ERROR IN FLIGHT','POSISJONSFEIL I FLYGING')));
  const pl=B[0]+(ph?40:50), pr=B[0]+B[2]-14, pt=B[1]+34, pb=B[1]+B[3]-(ph?62:74), HM=10, rate=S.sens==='rlg'?1.5:0, ymax=S.sens==='rlg'?18:18;
  const X=h=>pl+h/HM*(pr-pl), Yy=e=>pb-clamp(e,0,ymax)/ymax*(pb-pt);
  for(let e=0;e<=ymax;e+=3){ line(g,pl,Yy(e),pr,Yy(e),C.grid,1); txt(g,String(e),pl-6,Yy(e)+4,C.dim,'right',9.5); } for(let h=0;h<=HM;h+=2) txt(g,h+' h',X(h),pb+14,C.dim,'center',9.5);
  txt(g,'NM',pl-6,pt-12,C.dim,'right',9.5);
  line(g,pl,Yy(1),pr,Yy(1),'rgba(240,196,112,.5)',1,[4,4]); txt(g,L(t2('1 NM (typical RNAV 1 need)','1 NM (typisk RNAV 1-krav)')),pr-2,Yy(1)-5,C.amb,'right',9.5,500,SANS);
  if(S.sens==='rlg'){ poly(g,Array.from({length:101},(_,i)=>{ const h=i/100*HM; return [X(h),Yy(Y.inertialErr(h,rate))]; }),'#F4F7F9',2.2);
    tag(g,L(t2('pure inertial ≈ 1–2 NM/h (Schuler wiggle 84 min)','rent treghet ≈ 1–2 NM/t (Schuler-svingning 84 min)')),X(HM*0.5),Yy(Y.inertialErr(HM*0.5,rate))-16,'#F4F7F9',{sz:10,al:'center'}); }
  else txt(g,L(t2('MEMS AHRS: no position at all; free-inertial error would pass 1 NM within minutes','MEMS AHRS: ingen posisjon; fritt treghetsfeil ville passert 1 NM på minutter')),pl+6,pt+14,C.amb,'left',ph?9.5:10.5,500,SANS);
  const gOn=S.gnss==='on'; if(gOn) poly(g,[[X(0),Yy(0.05)],[X(HM),Yy(0.05)]],C.ok,2.4);
  if(gOn&&!ph) txt(g,L(t2('GNSS-aided (hybrid) ≈ 0.05 NM','GNSS-hjulpet (hybrid) ≈ 0,05 NM')),S.hrs<5?X(S.hrs)+12:X(S.hrs)-12,Yy(0.05)-7,C.ok,S.hrs<5?'left':'right',10,600,SANS);
  const now=S.hrs, e=S.sens==='rlg'?(gOn?0.05:Y.inertialErr(now,rate)):null; line(g,X(now),pt,X(now),pb,'rgba(214,226,236,.4)',1,[2,3]);
  if(e!=null) dot(g,X(now),Yy(e),5,'#0c1217',gOn?C.ok:'#F4F7F9',2);
  txt(g,L(S.sens==='rlg'?t2('ring-laser IRS, typical jet','ringlaser-IRS, typisk jetfly'):t2('MEMS AHRS, typical turboprop or modern light aircraft','MEMS AHRS, typisk turboprop eller moderne småfly')),B[0]+10,B[1]+B[3]-(ph?34:38),C.mut,'left',ph?9.5:10.5,500,SANS);
  txt(g,L(t2('after ','etter '))+nf(now,1)+' h: '+(e==null?L(t2('attitude and heading only','bare holdning og kurs')):nf(e,e<1?2:1)+' NM'),B[0]+10,B[1]+B[3]-(ph?16:18),C.txt,'left',ph?10:11.5,600);
}

/* ---------------- readout chip, legend, "what you're seeing" ---------------- */
const ch=(i,b,cls)=>`<span><i>${i}</i><b${cls?` class="${cls}"`:''}>${b}</b></span>`;
function readout(){ let h='';
  if(S.mode==='cmp'){ const M=cmpModel(), e=M.err; h=ch(L(t2('True heading','Rettvisende kurs')),d3(S.th))+ch(L(t2('Magnetic','Magnetisk')),d3(M.mh))+ch(L(t2('Compass shows','Kompasset viser')),d3(M.shown),'a')+ch(L(t2('Error','Feil')),(Math.abs(e)<0.5?'0':sg(e))+'°',Math.abs(e)>10?'r':Math.abs(e)>2?'a':'g')+ch(L(t2('Dip','Inklinasjon')),nf(Math.abs(M.dip),0)+'°'); }
  else if(S.mode==='gyr'){ const D=diModel(), tilt=Math.acos(clamp(S.n[0],-1,1))/D2R; h=ch(L(t2('Rotor speed','Rotorturtall')),nf(S.rpm,0)+' %')+ch(L(t2('Rigidity','Stivhet')),nf(S.rpm,0)+' %')+ch(L(t2('Axis moved','Aksen flyttet')),nf(tilt,0)+'°')+ch(L(t2('Indicator drift','Drift i indikatoren')),sg(D.rate,1)+' °/h',Math.abs(D.rate)>3?'a':'g')+ch(L(t2('Error','Feil')),sg(D.err,1)+'°',Math.abs(D.err)>5?'r':Math.abs(D.err)>2?'a':'g'); }
  else if(S.mode==='ins'){ const a=aiState(), r=Y.turnRate(TAS[S.cls],S.ib); h=ch(L(t2('Real pitch / bank','Virkelig pitch / krengning')),sg(S.ip)+'° / '+sg(S.ib)+'°')+ch(L(t2('Attitude shows','Holdning viser')),a.bad?'—':sg(a.p)+'° / '+sg(a.b)+'°',a.bad||Math.abs(a.b-S.ib)>3||Math.abs(a.p-S.ip)>2?'r':'g')+ch(L(t2('Turn rate','Svingrate')),nf(Math.abs(r),1)+' °/s'+(Math.abs(Math.abs(r)-3)<0.3?' · '+L(t2('rate one','rate én')):''))+ch(L(t2('Heading','Kurs')),d3(S.ihdg)); }
  else { const am=Y.alignMin(S.rlat); h=ch(L(t2('Latitude','Breddegrad')),latS(S.rlat))+ch(L(t2('Horizontal earth rate','Horisontal jordrotasjon')),nf(Y.earthRateH(S.rlat),1)+' °/h')+ch(L(t2('Alignment','Innretting')),am===Infinity?L(t2('not possible','ikke mulig')):'≈ '+nf(am,0)+' min',am===Infinity?'r':'')+ch(L(t2('IR','IR')),S.ali.toUpperCase(),S.ali==='nav'?'g':S.ali==='fault'?'r':'a'); }
  el('chip').innerHTML=h; const v=VIEWS.find(v=>v[0]===S.mode); el('xsv').textContent=v?L(v[1]):''; }
function legend(){ const lg=(c,t,k)=>`<span><i class="${k||''}" style="--c:${c}"></i>${L(t)}</span>`; let s='';
  if(S.mode==='cmp') s=lg(C.red,t2('compass magnet (north end)','kompassmagnet (nordenden)'),'ln')+lg(C.cy,t2('magnetic north','magnetisk nord'),'ln')+lg(C.mag,t2('acceleration','akselerasjon'),'ln')+lg(C.vio,t2('Z: vertical field','Z: vertikalt felt'),'ln');
  else if(S.mode==='gyr') s=lg(C.red,t2('your push','ditt dytt'),'ln')+lg(C.ok,t2('where it acts','der det virker'),'ln')+lg(C.cy,t2('real heading','virkelig kurs'),'ln')+lg(C.amb,t2('what the indicator shows','det indikatoren viser'),'sq');
  else if(S.mode==='ins') s=S.cls==='pis'?lg('#71CC93',t2('power source working','kraftkilde virker'),'sq')+lg(C.red,t2('failed','feilet'),'sq')+lg('#F0B440',t2('miniature aircraft','miniatyrfly'),'ln'):lg('#FFD34A',t2('aircraft symbol','flysymbol'),'ln')+lg(C.mag,t2('turn trend: heading in 6 s','svingtrend: kurs om 6 s'),'ln')+lg(C.red,t2('failed','feilet'),'sq');
  else s=lg(C.cy,t2('horizontal earth rate: points north','horisontal jordrotasjon: peker nord'),'ln')+lg(C.vio,t2('vertical earth rate','vertikal jordrotasjon'),'ln')+lg('#F4F7F9',t2('pure inertial error','ren treghetsfeil'),'ln')+lg(C.ok,t2('GNSS-aided','GNSS-hjulpet'),'ln');
  el('vleg').innerHTML=s; }
function see(){ let t;
  if(S.mode==='cmp'){ const M=cmpModel(), mh=M.mh, e=M.err, ew=Math.abs(Math.sin(mh*D2R))>0.6, ns=Math.abs(Math.cos(mh*D2R))>0.6, sh=S.lat<0;
    if(Math.abs(S.lat)<3) t=t2('<b>At the magnetic equator there is no dip</b>, so the magnet has no offset weight and no turning or acceleration errors.','<b>Ved den magnetiske ekvator er det ingen inklinasjon</b>, så magneten har ingen forskjøvet vekt og ingen sving- eller akselerasjonsfeil.');
    else if(S.man==='steady') t=t2('<b>Straight and steady:</b> the compass shows the magnetic heading (plus deviation). Now accelerate on an east or west heading, or turn through north or south, and watch the card swing.','<b>Rett og jevnt:</b> kompasset viser magnetisk kurs (pluss deviasjon). Akselerer nå på øst- eller vestkurs, eller sving gjennom nord eller sør, og se kortet svinge.');
    else if(S.man==='acc'||S.man==='dec'){ t= ew? (S.man==='acc')!==sh? t2(`<b>Accelerating on an ${Math.sin(mh*D2R)>0?'easterly':'westerly'} heading:</b> the compass shows a turn towards <b>north</b> (${sg(e)}°). Accelerate, North.`,`<b>Akselerasjon på ${Math.sin(mh*D2R)>0?'østlig':'vestlig'} kurs:</b> kompasset viser en sving mot <b>nord</b> (${sg(e)}°). Accelerate, North.`)
        : t2(`<b>${S.man==='dec'?'Decelerating':'Accelerating (southern hemisphere)'}:</b> the compass shows a turn towards <b>south</b> (${sg(e)}°).`,`<b>${S.man==='dec'?'Retardasjon':'Akselerasjon (sørlige halvkule)'}:</b> kompasset viser en sving mot <b>sør</b> (${sg(e)}°).`)
        : ns? t2('<b>On a north or south heading</b> the acceleration acts along the line through the pivot and the weight: no turning moment, no error.','<b>På nord- eller sørkurs</b> virker akselerasjonen langs linjen gjennom opphenget og vekten: ikke noe dreiemoment, ingen feil.') : t2(`<b>Accelerating on ${d3(mh)}:</b> a smaller error (${sg(e)}°). It is largest on east and west.`,`<b>Akselerasjon på ${d3(mh)}:</b> en mindre feil (${sg(e)}°). Den er størst på øst og vest.`); }
    else { const thruN=Math.cos(mh*D2R)>0.6, thruS=Math.cos(mh*D2R)<-0.6;
      t= thruN? t2(`<b>Turning through north:</b> the compass lags behind the turn (${sg(e)}°) or even shows a turn the other way. Roll out before it reaches the heading you want.`,`<b>Sving gjennom nord:</b> kompasset henger etter svingen (${sg(e)}°) eller viser til og med sving andre veien. Rull ut før det når kursen du vil ha.`)
       : thruS? t2(`<b>Turning through south:</b> the compass runs ahead of the turn (${sg(e)}°). Roll out after it passes the heading you want.`,`<b>Sving gjennom sør:</b> kompasset ligger foran svingen (${sg(e)}°). Rull ut etter at det har passert kursen du vil ha.`)
       : t2('<b>Turning through east or west:</b> the turning error is close to zero here, so the compass is about right.','<b>Sving gjennom øst eller vest:</b> svingfeilen er nesten null her, så kompasset viser omtrent riktig.');
      if(sh&&(thruN||thruS)) t=t2('<b>Southern hemisphere:</b> the dip and the offset weight are reversed, so the turning errors are reversed too: the compass leads through north and lags through south.','<b>Sørlige halvkule:</b> inklinasjonen og den forskjøvne vekten er snudd, så svingfeilene er også snudd: kompasset ligger foran gjennom nord og henger etter gjennom sør.'); } }
  else if(S.mode==='gyr'){ const D=diModel();
    t= S.rpm<3? t2('<b>No spin, no rigidity:</b> push the rim and the disc simply tips where you push.','<b>Ikke spinn, ingen stivhet:</b> dytt på kanten og skiven vipper rett og slett der du dytter.')
     : S.push&&S.push.spin? t2('<b>Precession:</b> the push acts 90° further round in the direction of rotation. The faster the rotor, the less it moves for the same push: that is rigidity.','<b>Presesjon:</b> dyttet virker 90° lenger rundt i rotasjonsretningen. Jo fortere rotoren går, jo mindre flytter den seg for samme dytt: det er stivhet.')
     : t2(`<b>Fixed in space, not to the earth:</b> at ${latS(S.dlat)} the earth turns under the gyro at ${nf(Math.abs(D.er),1)} °/h, so the heading indicator drifts ${nf(Math.abs(D.rate),1)} °/h. Realign it with the compass every 10–15 minutes.`,`<b>Fast i rommet, ikke i forhold til jorden:</b> på ${latS(S.dlat)} dreier jorden under gyroen med ${nf(Math.abs(D.er),1)} °/t, så kursgyroen driver ${nf(Math.abs(D.rate),1)} °/t. Juster den etter kompasset hvert 10.–15. minutt.`); }
  else if(S.mode==='ins'){ const F={none:S.cls==='pis'?t2('<b>Three gyros, three jobs:</b> the attitude indicator shows pitch and bank, the heading indicator holds a heading you set from the compass, and the turn coordinator shows the rate of turn. Bank 15° at 100 kt is about rate one: 3° per second.','<b>Tre gyroer, tre jobber:</b> holdningsindikatoren viser pitch og krengning, kursgyroen holder en kurs du setter etter kompasset, og svingkoordinatoren viser svingraten. 15° krengning ved 100 kt er omtrent rate én: 3° per sekund.')
        :t2('<b>Glass:</b> one display, fed by solid-state sensors with no spinning parts. Nothing to topple, no drift to reset, and the heading is slaved automatically.','<b>Glass:</b> én skjerm, matet av sensorer uten bevegelige deler. Ingenting som kan velte, ingen drift å justere, og kursen slaves automatisk.'),
      vac:t2('<b>Vacuum pump failed:</b> the attitude and heading rotors slow down and the instruments lie <b>slowly</b>, often with no flag. The suction gauge and the electric turn coordinator give it away: cross-check, then cover the failed ones.','<b>Vakuumpumpen feilet:</b> rotorene i holdnings- og kursinstrumentet går saktere og instrumentene lyver <b>sakte</b>, ofte uten flagg. Sugemåleren og den elektriske svingkoordinatoren avslører det: kryssjekk, og dekk til de som har feilet.'),
      elec:t2('<b>Electrical failure:</b> the turn coordinator shows an OFF flag. The vacuum attitude and heading instruments keep working: that split is why a light aircraft has two power sources for its gyros.','<b>Elektrisk feil:</b> svingkoordinatoren viser OFF-flagg. Vakuuminstrumentene for holdning og kurs virker fortsatt: derfor har småfly to kraftkilder for gyroene.'),
      topple:t2('<b>Limits exceeded:</b> the gimbals hit their stops and the gyro topples. It shows nonsense and takes minutes to erect again; cage it if you can.','<b>Grensene overskredet:</b> opphengsringene treffer stopperne og gyroen velter. Den viser tull og bruker minutter på å reise seg; lås den (cage) om du kan.'),
      att:S.src2?t2('<b>Source switched:</b> the display is back, fed by the other unit. Tell the other pilot and check the standby.','<b>Kilde byttet:</b> skjermen er tilbake, matet av den andre enheten. Si fra til den andre piloten og sjekk reserveinstrumentet.'):t2('<b>Attitude source failed:</b> a red flag, not a quiet lie. Fly the standby instrument and select the other source.','<b>Holdningskilden feilet:</b> et rødt flagg, ikke en stille løgn. Fly etter reserveinstrumentet og velg den andre kilden.'),
      gnss:S.cls==='tp'?t2('<b>GNSS lost:</b> the AHRS keeps giving attitude and heading (air data and the magnetometer help it). Navigation needs another source.','<b>GNSS tapt:</b> AHRS gir fortsatt holdning og kurs (luftdata og magnetometeret hjelper). Navigasjonen trenger en annen kilde.'):t2('<b>GNSS lost:</b> the IRS carries on alone; its position now drifts about 1–2 NM per hour. Monitor it against radio aids.','<b>GNSS tapt:</b> IRS fortsetter alene; posisjonen driver nå rundt 1–2 NM per time. Overvåk den mot radiohjelpemidler.')};
    t=S.toT>0&&S.cls==='pis'?t2('<b>Take-off roll:</b> the classic attitude indicator shows a small false nose-up and right bank while you accelerate. It erects out afterwards. Glass with air-data aiding does not show this.','<b>Startrull:</b> den klassiske holdningsindikatoren viser litt falsk nese opp og høyre krengning mens du akselererer. Det retter seg etterpå. Glass med luftdatahjelp viser ikke dette.'):F[S.fault]||F.none; }
  else { const am=Y.alignMin(S.rlat);
    t= am===Infinity? t2('<b>Too close to the pole:</b> the horizontal part of the earth’s spin, which points to true north, is almost gone. The IRS cannot find north here.','<b>For nær polen:</b> den horisontale delen av jordrotasjonen, som peker mot rettvisende nord, er nesten borte. IRS kan ikke finne nord her.')
     : S.ali==='fault'? t2('<b>Alignment fault:</b> the IRS must stand still, and the position you enter must match the latitude it measures from the earth’s spin.','<b>Innrettingsfeil:</b> IRS må stå stille, og posisjonen du legger inn må stemme med breddegraden den måler fra jordrotasjonen.')
     : t2(`<b>Alignment:</b> the accelerometers find the vertical, then the gyros feel the earth’s spin. Its horizontal part, ${nf(Y.earthRateH(S.rlat),1)} °/h here, points to true north; the ratio of the two parts gives the latitude.`,`<b>Innretting:</b> akselerometrene finner loddlinjen, så føler gyroene jordrotasjonen. Den horisontale delen, ${nf(Y.earthRateH(S.rlat),1)} °/t her, peker mot rettvisende nord; forholdet mellom de to delene gir breddegraden.`); }
  el('xsee').innerHTML=L(t); }

/* ---------------- tabs ---------------- */
const VIEWS=[['cmp',t2('Magnetic compass','Magnetkompass')],['gyr',t2('Gyroscopes','Gyroskoper')],['ins',t2('Instruments','Instrumenter')],['irs',t2('Inertial and AHRS','Treghet og AHRS'),1]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t,dp])=>`<button type="button" role="tab" data-v="${k}" class="${k===S.mode?'on':''}${dp?' dp':''}" aria-selected="${k===S.mode}">${L(t)}</button>`).join(''); }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.v); });
function setMode(m){ if(!VIEWS.some(v=>v[0]===m)) m='cmp'; if(m==='irs'&&!deepOn()&&S.mode!=='irs') LAB.setDepth('deep');
  S.mode=m; el('xpanel').querySelectorAll('[data-pv]').forEach(d=>{ d.hidden=d.dataset.pv!==m; }); cv.classList.toggle('push',m==='gyr');
  drawTabs(); drawPre(); upd(); }

/* ---------------- controls ---------------- */
LAB.add({},{'True heading':'Rettvisende kurs','Latitude':'Breddegrad','Variation (east +)':'Misvisning (øst +)','Speed change':'Fartsendring','Bank angle':'Krengning','Deviation, coefficient B':'Deviasjon, koeffisient B',
 'Rotor speed':'Rotorturtall','Vacuum':'Vakuum','Electric':'Elektrisk','East–west groundspeed (east +)':'Groundspeed øst–vest (øst +)','Time since set':'Tid siden innstilling','No latitude nut':'Ingen breddegradsmutter','Nut set for 60° N':'Mutter satt for 60° N','Nut set for this latitude':'Mutter satt for denne breddegraden','Real wander (bearings)':'Virkelig drift (lagre)',
 'Light piston':'Småfly, stempel','Turboprop':'Turboprop','Jet':'Jetfly','Bank':'Krengning','Pitch':'Pitch','Slip (ball)':'Skrens (kula)',
 'None':'Ingen','Vacuum pump fails':'Vakuumpumpen feiler','Electrical failure':'Elektrisk feil','Limits exceeded':'Grensene overskredet','Attitude source fails':'Holdningskilden feiler','GNSS lost':'GNSS tapt',
 'Aircraft still':'Flyet står stille','Aircraft moved':'Flyet beveget seg','Position correct':'Riktig posisjon','Position 3° wrong':'Posisjon 3° feil','Ring-laser IRS':'Ringlaser-IRS','MEMS AHRS':'MEMS AHRS','GNSS on':'GNSS på','Time in flight':'Tid i lufta'});
const sl={};
sl.th=LAB.slider(el('cCtl'),{label:'True heading',min:0,max:359,step:1,v:S.th,f:v=>d3(v),on:v=>{ S.th=v; S.turn=0; drawCBtns(); kick(); upd(); }});
sl.lat=LAB.slider(el('cCtl'),{label:'Latitude',min:-80,max:80,step:1,v:S.lat,f:latS,on:v=>{ S.lat=v; kick(); upd(); }});
sl.vari=LAB.slider(el('cCtl'),{label:'Variation (east +)',min:-20,max:20,step:1,v:S.vari,f:v=>Math.abs(v)+'° '+(v>=0?'E':'W'),on:v=>{ S.vari=v; upd(); }});
sl.ktps=LAB.slider(el('cCtl'),{label:'Speed change',min:0.5,max:4,step:0.5,v:S.ktps,f:v=>nf(v,1)+' kt/s',on:v=>{ S.ktps=v; kick(); upd(); }});
sl.bank=LAB.slider(el('cCtl'),{label:'Bank angle',min:5,max:30,step:1,v:S.bank,f:v=>v+'°',on:v=>{ S.bank=v; kick(); upd(); }});
sl.devB=LAB.slider(el('cAdv'),{label:'Deviation, coefficient B',min:-5,max:5,step:0.5,v:S.devB,f:v=>nf(Math.abs(v),1)+'° '+(v>=0?'E':'W')+' · 090',on:v=>{ S.devB=v; upd(); }});
const CB=[['acc',t2('Accelerate','Akselerer')],['dec',t2('Decelerate','Sakk ned')],['tl',t2('Turn left','Sving venstre')],['tr',t2('Turn right','Sving høyre')],['steady',t2('Straight and steady','Rett og jevnt')]];
function drawCBtns(){ el('cBtns').innerHTML=CB.map(([k,t])=>`<button type="button" class="btn sm${S.man===k?' pri':''}" data-m="${k}">${L(t)}</button>`).join('');
  el('cNote').textContent=L(t2('Turns run at 12° per second (rate one × 4) so you can watch a full circle; an acceleration lasts 6 s.','Svinger går med 12° per sekund (rate én × 4) så du kan se en hel runde; en akselerasjon varer i 6 s.')); }
el('cBtns').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; setMan(b.dataset.m); });
function setMan(m){ S.man=m; S.turn=m==='tr'?1:m==='tl'?-1:0; S.accT=m==='acc'||m==='dec'?6:0; drawCBtns(); kick(); upd(); }

sl.rpm=LAB.slider(el('gRot'),{label:'Rotor speed',min:0,max:100,step:5,v:S.rpm,f:v=>v+' %',on:v=>{ S.rpm=v; S.push=null; kick(); upd(); }});
const driveSeg=LAB.seg(el('gDrive'),[['vac','Vacuum'],['elec','Electric']],S.drive,v=>{ S.drive=v; upd(); });
function drawGBtns(){ el('gBtns').innerHTML=`<button type="button" class="btn sm" data-g="top">${L(t2('Push the top of the rim','Dytt på toppen av kanten'))}</button><button type="button" class="btn sm" data-g="reset">${L(t2('Reset the axis','Tilbakestill aksen'))}</button><button type="button" class="btn sm" data-g="down">${L(t2('Lose power: spin down','Mist kraft: spinn ned'))}</button>`;
  el('gDiBtns').innerHTML=`<button type="button" class="btn sm pri" data-g="run">${L(t2('Run 15 min','Kjør 15 min'))}</button><button type="button" class="btn sm" data-g="align">${L(t2('Realign with the compass','Juster etter kompasset'))}</button>`; }
el('xpanel').addEventListener('click',e=>{ const b=e.target.closest('[data-g]'); if(!b) return; const k=b.dataset.g;
  if(k==='top') pushAt(0); else if(k==='reset'){ S.n=[1,0,0]; S.push=null; } else if(k==='down'){ S.spinDown=true; } else if(k==='run'){ S.runT=Math.min(60,S.tmin+15); } else if(k==='align'){ S.tmin=0; S.runT=0; sl.tmin.set(0); }
  kick(); upd(); });
sl.dlat=LAB.slider(el('gDi'),{label:'Latitude',min:-80,max:80,step:1,v:S.dlat,f:latS,on:v=>{ S.dlat=v; upd(); }});
sl.vE=LAB.slider(el('gDi'),{label:'East–west groundspeed (east +)',min:-500,max:500,step:10,v:S.vE,f:v=>sg(v)+' kt',on:v=>{ S.vE=v; upd(); }});
sl.tmin=LAB.slider(el('gDi'),{label:'Time since set',min:0,max:60,step:1,v:S.tmin,f:v=>v+' min',on:v=>{ S.tmin=v; S.runT=0; upd(); }});
const nutSeg=LAB.seg(el('gNut'),[['none','No latitude nut'],['60','Nut set for 60° N'],['lat','Nut set for this latitude']],S.nut,v=>{ S.nut=v; upd(); }); el('gNut').classList.add('wrap'); el('gNut').style.marginTop='6px';
sl.real=LAB.slider(el('gAdv'),{label:'Real wander (bearings)',min:-6,max:6,step:0.5,v:S.real,f:v=>sg(v,1)+' °/h',on:v=>{ S.real=v; upd(); }});

const clsSeg=LAB.seg(el('iCls'),[['pis','Light piston'],['tp','Turboprop'],['jet','Jet']],S.cls,v=>{ S.cls=v; S.fault='none'; S.failT=0; S.src2=false; V.hiE=0; drawFaults(); drawIBtns(); upd(); });
sl.ib=LAB.slider(el('iCtl'),{label:'Bank',min:-45,max:45,step:1,v:S.ib,f:v=>(v<0?'L ':v>0?'R ':'')+Math.abs(v)+'°',on:v=>{ S.ib=v; kick(); upd(); }});
sl.ip=LAB.slider(el('iCtl'),{label:'Pitch',min:-15,max:20,step:1,v:S.ip,f:v=>sg(v)+'°',on:v=>{ S.ip=v; upd(); }});
sl.slip=LAB.slider(el('iCtl'),{label:'Slip (ball)',min:-1,max:1,step:0.1,v:S.slip,f:v=>Math.abs(v)<0.05?'0':(v<0?'L ':'R ')+nf(Math.abs(v),1),on:v=>{ S.slip=v; upd(); }});
function drawIBtns(){ const r1=Math.round(Math.min(25,Y.rateOneBank(TAS[S.cls]))), lb=r1<25?t2('Rate one','Rate én'):t2('25° bank','25° krengning');
  el('iBtns').innerHTML=`<button type="button" class="btn sm" data-i="l">← ${L(lb)}</button><button type="button" class="btn sm" data-i="r">${L(lb)} →</button><button type="button" class="btn sm" data-i="lvl">${L(t2('Wings level','Vinger vannrett'))}</button><button type="button" class="btn sm" data-i="to">${L(t2('Take-off acceleration','Akselerasjon ved avgang'))}</button>`;
}
el('iBtns').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const k=b.dataset.i, r1=Math.round(Math.min(25,Y.rateOneBank(TAS[S.cls])));
  if(k==='l') S.ib=-r1; else if(k==='r') S.ib=r1; else if(k==='lvl'){ S.ib=0; S.slip=0; } else if(k==='to'){ S.ib=0; S.ip=0; S.toT=6; }
  sl.ib.set(S.ib); sl.ip.set(S.ip); sl.slip.set(S.slip); kick(); upd(); });
const fBoxP=document.createElement('div'), fBoxG=document.createElement('div'); el('iFault').append(fBoxP,fBoxG);
const fSegP=LAB.seg(fBoxP,[['none','None'],['vac','Vacuum pump fails'],['elec','Electrical failure'],['topple','Limits exceeded']],'none',v=>setFault(v)); fBoxP.classList.add('wrap');
const fSegG=LAB.seg(fBoxG,[['none','None'],['att','Attitude source fails'],['gnss','GNSS lost']],'none',v=>setFault(v)); fBoxG.classList.add('wrap');
function drawFaults(){ const pis=S.cls==='pis'; fBoxP.hidden=!pis; fBoxG.hidden=pis; (pis?fSegP:fSegG).set(S.fault);
  el('iFaultH').innerHTML=S.fault==='att'&&!S.src2?`<button type="button" class="btn sm pri" id="src2">${L(t2('Select the other source','Velg den andre kilden'))}</button>`:S.fault==='topple'?`<button type="button" class="btn sm" id="cage">${L(t2('Cage and re-erect','Lås og reis opp'))}</button>`:L(S.cls==='pis'?t2('Light piston: attitude and heading on vacuum, turn coordinator electric.','Småfly: holdning og kurs på vakuum, svingkoordinator elektrisk.'):t2('Glass: two or three independent sources, plus a standby.','Glass: to eller tre uavhengige kilder, pluss et reserveinstrument.')); }
el('iFaultH').addEventListener('click',e=>{ if(e.target.id==='src2'){ S.src2=true; drawFaults(); upd(); } if(e.target.id==='cage'){ S.fault='none'; S.failT=0; drawFaults(); upd(); } });
function setFault(v){ S.fault=v; S.failT=0; S.src2=false; V.hiE=0; drawFaults(); kick(); upd(); }

const sub=(p,mt)=>{ const d=document.createElement('div'); if(mt) d.style.marginTop=mt; el(p).appendChild(d); return d; };
const latR=LAB.slider(el('rAli'),{label:'Latitude',min:0,max:85,step:1,v:S.rlat,f:v=>v+'° N',on:v=>{ S.rlat=v; S.ali='off'; S.prog=0; upd(); }});
const moveSeg=LAB.seg(sub('rAli','6px'),[['still','Aircraft still'],['moved','Aircraft moved']],S.move,v=>{ S.move=v; upd(); });
const posSeg=LAB.seg(sub('rAli','6px'),[['ok','Position correct'],['wrong','Position 3° wrong']],S.pos,v=>{ S.pos=v; upd(); });
el('rBtns').innerHTML='<button type="button" class="btn sm pri" id="rGo"></button>';
el('rGo').onclick=()=>{ if(Y.alignMin(S.rlat)===Infinity){ S.ali='off'; upd(); return; } S.ali='align'; S.prog=0; S.fwhy=null; kick(); upd(); };
const sensSeg=LAB.seg(sub('rFly'),[['rlg','Ring-laser IRS'],['mems','MEMS AHRS']],S.sens,v=>{ S.sens=v; upd(); });
const gnssSeg=LAB.seg(sub('rFly','6px'),[['on','GNSS on'],['off','GNSS lost']],S.gnss,v=>{ S.gnss=v; upd(); });
sl.hrs=LAB.slider(el('rFly'),{label:'Time in flight',min:0,max:10,step:0.1,v:S.hrs,f:v=>nf(v,1)+' h',on:v=>{ S.hrs=v; upd(); }});

function syncCtl(){ sl.th.set(Math.round(S.th)); sl.lat.set(S.lat); sl.vari.set(S.vari); sl.ktps.set(S.ktps); sl.bank.set(S.bank); sl.devB.set(S.devB);
  sl.rpm.set(Math.round(S.rpm)); driveSeg.set(S.drive); sl.dlat.set(S.dlat); sl.vE.set(S.vE); sl.tmin.set(Math.round(S.tmin)); nutSeg.set(S.nut); sl.real.set(S.real);
  clsSeg.set(S.cls); sl.ib.set(S.ib); sl.ip.set(S.ip); sl.slip.set(S.slip); latR.set(S.rlat); moveSeg.set(S.move); posSeg.set(S.pos); sensSeg.set(S.sens); gnssSeg.set(S.gnss); sl.hrs.set(S.hrs);
  sl.ktps.el.hidden=!(S.man==='acc'||S.man==='dec'); sl.bank.el.hidden=!(S.man==='tr'||S.man==='tl');
  el('rGo').textContent=L(t2('Start alignment','Start innretting')); drawCBtns(); drawGBtns(); drawIBtns(); drawFaults(); }

/* push the rim at angle th (degrees in the rotor's own frame: 0 = top) */
function pushAt(th){ const n=S.n, r=rimPt(n,th), spin=S.rpm>=3, eff=spin?rimPt(n,th+90):r.slice();
  S.push={r,eff,spin,t:0.9,th}; kick(); }
cv.addEventListener('click',e=>{ if(S.mode!=='gyr'||!GEO.rim) return; const b=cv.getBoundingClientRect(), mx=e.clientX-b.left, my=e.clientY-b.top, {cx,cy,s}=GEO.rim;
  let best=null, bd=1e9; for(let a=0;a<360;a+=5){ const p=proj(rimPt(S.n,a),cx,cy,s), d=Math.hypot(p[0]-mx,p[1]-my); if(d<bd){ bd=d; best=a; } }
  if(bd<Math.max(28,s*0.25)) pushAt(best); });

/* scenarios per mode */
const SCN={
 cmp:[[t2('Accelerate on east','Akselerer på øst'),{th:93,lat:60,vari:3,man:'acc'}],[t2('Turn right through north','Sving høyre gjennom nord'),{th:303,lat:60,vari:3,man:'tr',bank:15}],[t2('Turn right through south','Sving høyre gjennom sør'),{th:123,lat:60,vari:3,man:'tr',bank:15}],[t2('At the equator','Ved ekvator'),{th:93,lat:0,vari:3,man:'acc'}],[t2('Southern hemisphere','Sørlige halvkule'),{th:93,lat:-45,vari:3,man:'acc',dp:1}]],
 gyr:[[t2('Push a spinning rotor','Dytt på en roterende rotor'),{rpm:100,n:[1,0,0],push:'top'}],[t2('Push with no spin','Dytt uten spinn'),{rpm:0,n:[1,0,0],push:'top'}],[t2('Parked at 60° N, 30 min','Parkert på 60° N, 30 min'),{dlat:60,vE:0,nut:'none',tmin:30}],[t2('Flying east at 60° N','Flyr østover på 60° N'),{dlat:60,vE:300,nut:'none',tmin:30}],[t2('Near the pole','Nær polen'),{dlat:78,vE:0,nut:'none',tmin:30,dp:1}]],
 ins:[[t2('Rate-one turn','Rate én-sving'),{cls:'pis',ib:15,ip:0,fault:'none'}],[t2('Take-off roll','Startrull'),{cls:'pis',ib:0,ip:0,fault:'none',to:1}],[t2('Vacuum failure in cloud','Vakuumfeil i sky'),{cls:'pis',ib:0,ip:0,fault:'vac'}],[t2('Glass: source fails','Glass: kilden feiler'),{cls:'tp',ib:0,ip:2,fault:'att'}]],
 irs:[[t2('Align at 60° N','Innrett på 60° N'),{rlat:60,move:'still',pos:'ok',go:1}],[t2('Moved during alignment','Beveget under innretting'),{rlat:60,move:'moved',pos:'ok',go:1}],[t2('78° N','78° N'),{rlat:78,move:'still',pos:'ok',go:1}],[t2('GNSS lost, 3 h','GNSS tapt, 3 t'),{sens:'rlg',gnss:'off',hrs:3}]]};
function drawPre(){ el('pre').innerHTML=(SCN[S.mode]||[]).map(([t,o],i)=>o.dp&&!deepOn()?'':`<button type="button" class="btn" data-s="${i}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setS(Object.assign({mode:S.mode},SCN[S.mode][+b.dataset.s][1])); });
function setS(o){ if(!o) return; const {mode,man,push,fault,to,go,dp,...r}=o; void dp;
  if(mode&&mode!==S.mode) setMode(mode);
  if(r.n) r.n=r.n.slice(); Object.assign(S,r); if(r.rpm!=null){ S.spinDown=false; S.push=null; } if(r.tmin!=null) S.runT=0;
  if(man) setMan(man); else if(S.mode==='cmp'&&o.th!=null) setMan('steady');
  if(S.mode==='ins'){ S.toT=to?6:0; setFault(fault||'none'); }
  syncCtl(); if(push) setTimeout(()=>pushAt(0),250); if(go) el('rGo').click(); kick(); upd(); }

/* ---------------- time ---------------- */
let raf=0, last=0, slT=0;
function kick(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(tick); } }
function tick(now){ raf=0; const dt=Math.min(0.1,(now-last)/1000); last=now; let busy=false;
  /* compass: turn, acceleration pulse, card swing with fluid damping */
  if(S.turn){ S.th=Y.norm(S.th+S.turn*12*dt); busy=true; }
  if(S.accT>0){ S.accT-=dt; busy=true; if(S.accT<=0){ S.accT=0; S.man='steady'; drawCBtns(); } }
  { const tgt=cmpModel().psiT, d=Y.wrap(tgt-V.psi); V.psi+=d*(reduce?1:1-Math.exp(-dt/0.45)); if(Math.abs(d)>0.05) busy=true; else V.psi=tgt; }
  /* gyros */
  if(S.rpm>0){ S.spin=(S.spin+dt*Math.max(20,S.rpm*6))%360; if(S.mode==='gyr') busy=true; }
  if(S.spinDown){ S.rpm=Math.max(0,S.rpm-dt*12); if(S.rpm<=0) S.spinDown=false; busy=true; }
  if(S.push){ const P=S.push; P.t-=dt; if(P.spin){ const H=S.rpm/100, f=14*D2R/0.9; S.n=Y.precess(S.n,P.r,S.n.map(v=>-v*f),Math.max(0.05,H),dt); }
    else { const d=nrm(P.r.map((v,i)=>v-dotv(P.r,S.n)*S.n[i])); S.n=nrm(S.n.map((v,i)=>v+d[i]*0.55*dt)); }
    if(Math.abs(S.n[1])>0.93){ S.n[1]=Math.sign(S.n[1])*0.93; S.n=nrm(S.n); }
    if(P.t<=0) S.push=Object.assign(P,{t:0,done:true}); else busy=true; }
  if(S.runT>S.tmin){ S.tmin=Math.min(S.runT,S.tmin+dt*5); if(S.tmin>=S.runT){ S.tmin=S.runT; S.runT=0; } busy=true; }
  /* instruments */
  if(S.mode==='ins'){ const rate=Y.turnRate(TAS[S.cls],S.ib); if(Math.abs(rate)>0.01){ S.ihdg=Y.norm(S.ihdg+rate*4*dt); busy=true; }
    if(S.fault!=='none'){ S.failT+=dt*4; busy=S.failT<400||busy; if(S.fault==='vac'&&S.cls==='pis') V.hiE+=dt*4*Math.min(1,S.failT/60)*0.5; }
    if(S.toT>0){ S.toT=Math.max(0,S.toT-dt); busy=true; } }
  /* alignment */
  if(S.ali==='align'){ const am=Y.alignMin(S.rlat); S.prog+=dt/(am*0.9); busy=true;
    if(S.move==='moved'&&S.prog>0.35){ S.ali='fault'; S.fwhy='move'; }
    else if(S.prog>=1){ S.prog=1; if(S.pos==='wrong'){ S.ali='fault'; S.fwhy='pos'; } else S.ali='nav'; } }
  if(now-slT>150){ slT=now; if(S.turn) sl.th.set(Math.round(S.th)); if(S.spinDown||S.rpm<100) sl.rpm.set(Math.round(S.rpm)); if(S.runT||S.tmin) sl.tmin.set(Math.round(S.tmin)); readout(); see(); }
  draw(); if(busy) raf=requestAnimationFrame(tick); else { readout(); see(); }
}
function upd(){ readout(); legend(); see(); kick(); draw(); }

/* ---------------- Try it: one task at a time ---------------- */
let ti=0; const ansv={}, done={};
const goModel=()=>{ const t=el('gyVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const NUM=(lab,v,tol)=>({lab,v,tol});
const TASKS=[
 {k:'tvmc',q:t2('True heading 100°, variation 6° E, deviation 2° W. What compass heading do you steer?','Rettvisende kurs 100°, misvisning 6° Ø, deviasjon 2° V. Hvilken kompasskurs styrer du?'),ins:[NUM(t2('Compass heading (°)','Kompasskurs (°)'),96,0.6)],pre:{mode:'cmp',th:100,vari:6,devB:-2,lat:60},
  e:t2('Subtract easterly, add westerly: 100 − 6 = 094° magnetic, 094 + 2 = 096° compass.','Trekk fra østlig, legg til vestlig: 100 − 6 = 094° magnetisk, 094 + 2 = 096° kompass.')},
 {k:'ands',q:t2('Northern hemisphere, heading 270°. You accelerate. What does the compass show?','Nordlige halvkule, kurs 270°. Du akselererer. Hva viser kompasset?'),opts:[t2('An apparent turn towards north','En tilsynelatende sving mot nord'),t2('An apparent turn towards south','En tilsynelatende sving mot sør'),t2('No error','Ingen feil'),t2('The card freezes','Kortet fryser')],c:0,pre:{mode:'cmp',th:273,lat:60,vari:3,man:'acc'},
  e:t2('ANDS: Accelerate, North; Decelerate, South. On 270° the reading increases, towards 360°.','ANDS: Accelerate, North; Decelerate, South. På 270° øker avlesningen, mot 360°.')},
 {k:'unos',q:t2('In Norway you turn right from 300° to 030° using only the compass. When do you roll out?','I Norge svinger du til høyre fra 300° til 030° bare etter kompasset. Når ruller du ut?'),opts:[t2('Before the compass shows 030°','Før kompasset viser 030°'),t2('After the compass has passed 030°','Etter at kompasset har passert 030°'),t2('Exactly at 030°','Nøyaktig på 030°'),t2('It does not matter on this heading','Det spiller ingen rolle på denne kursen')],c:0,pre:{mode:'cmp',th:303,lat:60,vari:3,man:'tr',bank:15},
  e:t2('Through north the compass lags behind the turn, so roll out early (undershoot). Through south it leads, so roll out late.','Gjennom nord henger kompasset etter svingen, så rull ut tidlig. Gjennom sør ligger det foran, så rull ut sent.')},
 {k:'big',q:t2('In the model, make the acceleration error as large as you can at 60° N: pick a heading, then accelerate or decelerate. Press Check while the card is swung.','I modellen, gjør akselerasjonsfeilen så stor du kan på 60° N: velg en kurs, og akselerer eller sakk ned. Trykk Sjekk mens kortet er svingt.'),
  live:()=>{ const M=cmpModel(); if(S.mode!=='cmp') return [0,t2('Open "Magnetic compass".','Åpne «Magnetkompass».')]; if(!(S.man==='acc'||S.man==='dec')) return [0,t2('Press Accelerate or Decelerate first, then Check within 6 s.','Trykk Akselerer eller Sakk ned først, og Sjekk innen 6 s.')];
    if(Math.abs(Math.sin(M.mh*D2R))<0.9) return [0,t2(`On ${d3(M.mh)} magnetic the error is ${nf(Math.abs(M.err),0)}°. Which headings give the biggest turning moment?`,`På ${d3(M.mh)} magnetisk er feilen ${nf(Math.abs(M.err),0)}°. Hvilke kurser gir størst dreiemoment?`)];
    return [1,t2(`Yes: on ${d3(M.mh)} the card swings about ${nf(Math.abs(M.psiT),0)}°. East and west give the largest acceleration error, north and south none.`,`Ja: på ${d3(M.mh)} svinger kortet rundt ${nf(Math.abs(M.psiT),0)}°. Øst og vest gir størst akselerasjonsfeil, nord og sør ingen.`)]; },pre:{mode:'cmp',th:30,lat:60,vari:3}},
 {k:'prec',q:t2('You push on the rim of a spinning gyro rotor. Where does the push take effect?','Du dytter på kanten av en roterende gyrorotor. Hvor virker dyttet?'),opts:[t2('90° further round, in the direction of rotation','90° lenger rundt, i rotasjonsretningen'),t2('Exactly where you push','Akkurat der du dytter'),t2('90° back, against the rotation','90° tilbake, mot rotasjonen'),t2('On the opposite side, 180° away','På motsatt side, 180° unna')],c:0,pre:{mode:'gyr',rpm:100,n:[1,0,0],push:'top'},
  e:t2('That is precession. Friction in the bearings does it to a heading indicator by accident; the erection system of an attitude indicator does it on purpose.','Det er presesjon. Friksjon i lagrene gjør det med en kursgyro ved et uhell; oppreisingssystemet i en holdningsindikator gjør det med vilje.')},
 {k:'er',q:t2('A heading indicator with no latitude nut is set on the ground at 60° N. By how many degrees has it drifted 30 minutes later?','En kursgyro uten breddegradsmutter settes på bakken på 60° N. Hvor mange grader har den drevet 30 minutter senere?'),ins:[NUM(t2('Drift (°)','Drift (°)'),6.5,0.6)],pre:{mode:'gyr',dlat:60,vE:0,nut:'none',tmin:30},
  e:t2('Earth rate = 15 °/h × sin 60° ≈ 13 °/h, so about 6.5° in half an hour. In the northern hemisphere the reading decreases.','Jordrotasjon = 15 °/t × sin 60° ≈ 13 °/t, så rundt 6,5° på en halvtime. På den nordlige halvkule minker avlesningen.')},
 {k:'nut',q:t2('Parked at 60° N: stop the heading indicator drifting in the model, then press Check.','Parkert på 60° N: få kursgyroen til å slutte å drive i modellen, og trykk Sjekk.'),
  live:()=>{ const D=diModel(); if(S.mode!=='gyr') return [0,t2('Open "Gyroscopes".','Åpne «Gyroskoper».')]; if(Math.abs(S.dlat-60)>1||Math.abs(S.vE)>5) return [0,t2('Set 60° N and zero groundspeed (parked).','Sett 60° N og null groundspeed (parkert).')];
    if(Math.abs(D.rate)>0.3) return [0,t2(`It still drifts ${sg(D.rate,1)} °/h. What can apply a fixed, opposite precession?`,`Den driver fortsatt ${sg(D.rate,1)} °/t. Hva kan gi en fast, motsatt presesjon?`)];
    return [1,t2('Yes: a latitude nut set for 60° N cancels the earth rate there. Fly to another latitude, or east or west, and it drifts again.','Ja: en breddegradsmutter satt for 60° N fjerner jordrotasjonen der. Fly til en annen breddegrad, eller øst eller vest, og den driver igjen.')]; },pre:{mode:'gyr',dlat:60,vE:0,nut:'none',tmin:30}},
 {k:'vac',q:t2('Light piston in cloud. The vacuum pump fails. Which gyro instrument can you still trust?','Småfly i sky. Vakuumpumpen feiler. Hvilket gyroinstrument kan du fortsatt stole på?'),opts:[t2('The electric turn coordinator','Den elektriske svingkoordinatoren'),t2('The attitude indicator','Holdningsindikatoren'),t2('The heading indicator','Kursgyroen'),t2('None of them','Ingen av dem')],c:0,pre:{mode:'ins',cls:'pis',ib:0,ip:0,fault:'vac'},
  e:t2('Attitude and heading run on vacuum and now lie slowly, often with no flag. The turn coordinator is electric: keep the wings level with it and the ball, and use the compass for heading.','Holdning og kurs går på vakuum og lyver nå sakte, ofte uten flagg. Svingkoordinatoren er elektrisk: hold vingene vannrett med den og kula, og bruk kompasset for kurs.')},
 {k:'hz',dp:1,q:t2('An IRS aligns at 60° N. What is the horizontal component of the earth’s rotation that it uses to find north?','En IRS innrettes på 60° N. Hvor stor er den horisontale komponenten av jordrotasjonen som den bruker for å finne nord?'),ins:[NUM(t2('Rate (°/h)','Rate (°/t)'),7.5,0.3)],pre:{mode:'irs',rlat:60},
  e:t2('15.04 °/h × cos 60° ≈ 7.5 °/h. It shrinks towards the pole, so alignment takes longer there and is impossible beyond about 78°.','15,04 °/t × cos 60° ≈ 7,5 °/t. Den blir mindre mot polen, så innrettingen tar lengre tid der og er umulig over rundt 78°.')}];
const tasks=()=>TASKS.filter(t=>!t.dp||deepOn());
function drawTask(){ const TS=tasks(); ti=clamp(ti,0,TS.length-1); const t=TS[ti], n=TS.length, a=ansv[t.k];
  let h=`<div class="th"><span class="n">${L(t2('Task','Oppgave'))} ${ti+1} ${L(t2('of','av'))} ${n}</span><span class="dots">${TS.map((x,i)=>`<button type="button" data-i="${i}" class="${i===ti?'on':''}" aria-label="${L(t2('Task','Oppgave'))} ${i+1}"></button>`).join('')}</span></div><p class="q">${L(t.q)}</p>`;
  if(t.ins){ h+=`<div class="ins">${t.ins.map((x,j)=>{ const v=a&&a[j]; const ok=v!=null&&v!==''&&Math.abs(parseFloat(String(v).replace(',','.').replace(/\s/g,''))-x.v)<=x.tol; return `<label>${L(x.lab)}<input type="text" inputmode="decimal" data-j="${j}" value="${v??''}" class="${done[t.k]?(ok?'right':'wrong'):''}" autocomplete="off"></label>`; }).join('')}<button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div>`;
    h+=`<span class="fb${done[t.k]===1?' ok':''}">${done[t.k]?'<b>'+L(done[t.k]===1?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
  else if(t.opts){ h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
  else { h+=`<div class="ins"><button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div><span class="fb${done[t.k]&&done[t.k][0]?' ok':''}">${done[t.k]?(done[t.k][0]?'<b>✓</b> ':'')+L(done[t.k][1]):''}</span>`; }
  h+=`<div class="nav"><button type="button" class="btn sm" data-go="1">${L(t.live?t2('Set it up in the model','Sett det opp i modellen'):t2('Check it in the model','Sjekk i modellen'))} ↑</button><span class="sp"></span><button type="button" class="btn sm" data-p="1" ${ti===0?'disabled':''}>← ${L(t2('Previous','Forrige'))}</button><button type="button" class="btn sm" data-n="1" ${ti===n-1?'disabled':''}>${L(t2('Next','Neste'))} →</button></div>`;
  el('tstep').innerHTML=h; }
el('tstep').addEventListener('input',e=>{ const i=e.target.closest('input'); if(!i) return; const t=tasks()[ti]; (ansv[t.k]=ansv[t.k]||[])[+i.dataset.j]=i.value; });
el('tstep').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.closest('input')){ const b=el('tstep').querySelector('[data-chk]'); if(b) b.click(); } });
el('tstep').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const TS=tasks(), t=TS[ti];
  if(b.dataset.i!=null){ ti=+b.dataset.i; drawTask(); return; } if(b.dataset.p){ ti--; drawTask(); return; } if(b.dataset.n){ ti++; drawTask(); return; }
  if(b.dataset.go){ setS(t.pre); goModel(); return; }
  if(b.dataset.o!=null){ ansv[t.k]=+b.dataset.o; drawTask(); return; }
  if(b.dataset.chk){ if(t.live){ done[t.k]=t.live(); drawTask(); return; }
    const a=ansv[t.k]||[]; done[t.k]=t.ins.every((x,j)=>a[j]!=null&&a[j]!==''&&Math.abs(parseFloat(String(a[j]).replace(',','.').replace(/\s/g,''))-x.v)<=x.tol)?1:2; drawTask(); } });

/* ---------------- Understand: key concept cards ---------------- */
const {sv,tx,ar}=KCS;
const go=o=>({click:()=>setS(o),to:'#gyVp'});
const dial=(x,a,c)=>`<circle cx="${x}" cy="30" r="19" fill="#090c0f" stroke="#6f7e8b"/><line x1="${x}" y1="30" x2="${(x+Math.sin(a*D2R)*15).toFixed(1)}" y2="${(30-Math.cos(a*D2R)*15).toFixed(1)}" stroke="${c||'#eef3f7'}" stroke-width="2"/>`;
const KC=[
 Object.assign({k:'tvmc',t:t2('True, magnetic, compass','Rettvisende, magnetisk, kompass'),d:t2('<b>Variation</b> is the angle between true and magnetic north, from the chart. <b>Deviation</b> is the aircraft’s own magnetism, from the card by the compass. Subtract easterly, add westerly.','<b>Misvisning</b> er vinkelen mellom rettvisende og magnetisk nord, fra kartet. <b>Deviasjon</b> er flyets egen magnetisme, fra kortet ved kompasset. Trekk fra østlig, legg til vestlig.'),
  dd:t2('T → V → M → D → C. Deviation is reduced by a compass swing and the rest is written on the deviation card.','T → V → M → D → C. Deviasjonen reduseres ved kompasskompensering, og resten skrives på deviasjonskortet.'),
  ill:()=>sv(`${ar(40,58,40,8,'#eef3f7')}${ar(40,58,58,10,'#7fcbe8')}${ar(40,58,72,14,'#f0c470')}${tx(34,12,'T','#eef3f7','end',8)}${tx(62,10,'M','#7fcbe8','start',8)}${tx(76,16,'C','#f0c470','start',8)}${tx(110,28,'var: earth','#7fcbe8','start',8)}${tx(110,44,'dev: aircraft','#f0c470','start',8)}`)},go({mode:'cmp',th:100,vari:6,devB:-2,lat:60})),
 Object.assign({k:'dip',t:t2('Dip','Inklinasjon'),d:t2('The earth’s field points down into the ground away from the equator. Only its <b>horizontal part H</b> steers the compass; the vertical part Z is what causes the errors.','Jordens magnetfelt peker ned i bakken bort fra ekvator. Bare den <b>horisontale delen H</b> styrer kompasset; den vertikale delen Z er det som gir feilene.'),
  dd:t2('Dip is about 70–80° over Scandinavia. Near the magnetic poles H is so weak that the compass is unusable.','Inklinasjonen er rundt 70–80° over Skandinavia. Nær de magnetiske polene er H så svak at kompasset er ubrukelig.'),
  ill:()=>sv(`<line x1="10" y1="22" x2="190" y2="22" stroke="#6f7e8b"/>${ar(60,22,90,56,'#eef3f7')}${ar(60,22,92,22,'#7fcbe8')}${ar(92,22,92,54,'#c9b6f2')}${tx(76,16,'H','#7fcbe8','middle',9)}${tx(98,44,'Z','#c9b6f2','start',9)}${tx(130,44,'dip 74°','#c9d2da','start',8)}`)},go({mode:'cmp',th:93,lat:70,man:'steady'})),
 Object.assign({k:'ands',t:t2('Acceleration errors','Akselerasjonsfeil'),d:t2('On east or west headings in the northern hemisphere, <b>accelerating</b> makes the compass show a turn towards <b>north</b>, decelerating towards south. None on north or south headings.','På øst- eller vestkurs på den nordlige halvkule får <b>akselerasjon</b> kompasset til å vise en sving mot <b>nord</b>, retardasjon mot sør. Ingen på nord- eller sørkurs.'),
  dd:t2('The magnet hangs with its weight on the equator side of the pivot to balance Z; an acceleration acts on that weight. Reversed in the southern hemisphere.','Magneten henger med vekten på ekvatorsiden av opphenget for å balansere Z; en akselerasjon virker på den vekten. Snudd på den sørlige halvkule.'),
  ill:()=>sv(`${ar(30,40,90,40,'#e07bd0')}${tx(60,54,'accelerate','#e07bd0','middle',8)}${ar(130,52,150,14,'#ec5a47')}${tx(156,16,'N','#ec5a47','start',10)}`)},go({mode:'cmp',th:93,lat:60,vari:3,man:'acc'})),
 Object.assign({k:'turn',t:t2('Turning errors','Svingfeil'),d:t2('Turning through <b>north</b> the compass lags (roll out early); through <b>south</b> it runs ahead (roll out late). Little or none through east and west.','Gjennom <b>nord</b> henger kompasset etter (rull ut tidlig); gjennom <b>sør</b> ligger det foran (rull ut sent). Lite eller ingen gjennom øst og vest.'),
  dd:t2('The error grows with bank angle and latitude, and swirl in the liquid adds to it. Use the compass only in straight, unaccelerated flight, or time the turn.','Feilen vokser med krengning og breddegrad, og virvler i væsken øker den. Bruk kompasset bare i rett, uakselerert flyging, eller ta tiden på svingen.'),
  ill:()=>sv(`<path d="M40,52 A40,40 0 0 1 120,52" fill="none" stroke="#eef3f7" stroke-dasharray="3 3"/>${ar(112,30,122,48,'#eef3f7')}${tx(80,10,'N: lags','#ec5a47','middle',8)}${tx(150,40,'S: leads','#f0c470','start',8)}`)},go({mode:'cmp',th:303,lat:60,vari:3,man:'tr',bank:15})),
 Object.assign({k:'rig',t:t2('Rigidity','Stivhet'),d:t2('A spinning rotor keeps its axis pointing the same way <b>in space</b>. More mass at the rim and more speed give more rigidity: angular momentum, I·ω.','En roterende rotor holder aksen pekende samme vei <b>i rommet</b>. Mer masse ute ved kanten og høyere turtall gir mer stivhet: spinn, I·ω.'),
  ill:()=>sv(`<ellipse cx="80" cy="32" rx="14" ry="26" fill="#3a4651" stroke="#c9d2da"/><line x1="30" y1="32" x2="150" y2="32" stroke="#eef3f7" stroke-width="2"/>${tx(160,36,'I·ω','#f0c470','start',10)}`)},go({mode:'gyr',rpm:100,n:[1,0,0]})),
 Object.assign({k:'prec',t:t2('Precession','Presesjon'),d:t2('Push the rim of a spinning gyro and it moves <b>90° further round</b> in the direction of rotation. The faster it spins, the less it moves.','Dytt på kanten av en roterende gyro, og den beveger seg <b>90° lenger rundt</b> i rotasjonsretningen. Jo fortere den spinner, jo mindre beveger den seg.'),
  dd:t2('Precession rate = torque ÷ angular momentum. Bearing friction causes unwanted precession (real wander); erection systems and latitude nuts use it on purpose.','Presesjonsrate = dreiemoment ÷ spinn. Friksjon i lagrene gir uønsket presesjon (virkelig drift); oppreisingssystemer og breddegradsmuttere bruker den med vilje.'),
  ill:()=>sv(`<ellipse cx="100" cy="32" rx="44" ry="18" fill="none" stroke="#c9d2da"/>${ar(100,2,100,12,'#ec5a47')}${ar(146,24,146,40,'#71cc93')}${tx(60,10,'push','#ec5a47','end',8)}${tx(160,52,'acts 90° on','#71cc93','middle',8)}`)},go({mode:'gyr',rpm:100,n:[1,0,0],push:'top'})),
 Object.assign({k:'drift',t:t2('Apparent drift','Tilsynelatende drift'),d:t2('The gyro stays fixed in space while the earth turns under it: <b>15 °/h × sin latitude</b>. So the heading indicator must be reset from the compass every 10–15 minutes.','Gyroen står fast i rommet mens jorden dreier under den: <b>15 °/t × sin breddegrad</b>. Derfor må kursgyroen justeres etter kompasset hvert 10.–15. minutt.'),
  dd:t2('Flying east or west adds transport wander, (E–W groundspeed ÷ 60) × tan latitude. A latitude nut cancels the earth rate at one latitude only.','Flyging øst eller vest gir i tillegg transportdrift, (Ø–V groundspeed ÷ 60) × tan breddegrad. En breddegradsmutter fjerner jordrotasjonen på én breddegrad.'),
  ill:()=>sv(`${dial(50,-14,'#f0c470')}${tx(84,26,'15°/h × sin φ','#c9d2da','start',9)}${tx(84,42,'60° N ≈ 13°/h','#8b99a7','start',8)}`)},go({mode:'gyr',dlat:60,vE:0,nut:'none',tmin:30})),
 Object.assign({k:'three',t:t2('Three gyro instruments','Tre gyroinstrumenter'),d:t2('<b>Attitude indicator</b>: pitch and bank. <b>Heading indicator</b>: heading, set from the compass. <b>Turn coordinator</b>: rate of turn; rate one is 3° per second, a full circle in 2 minutes.','<b>Holdningsindikator</b>: pitch og krengning. <b>Kursgyro</b>: kurs, satt etter kompasset. <b>Svingkoordinator</b>: svingrate; rate én er 3° per sekund, en hel runde på 2 minutter.'),
  dd:t2('Rate-one bank ≈ TAS ÷ 10 + 7: about 17° at 100 kt. The ball is not a gyro: it shows slip and skid.','Krengning for rate én ≈ TAS ÷ 10 + 7: rundt 17° ved 100 kt. Kula er ikke en gyro: den viser glidning og skrens.'),
  ill:()=>sv(`${dial(40,-20)}${dial(100,90)}${dial(160,-75)}`)},go({mode:'ins',cls:'pis',ib:15,ip:0,fault:'none'})),
 Object.assign({k:'vac',t:t2('Vacuum or electric','Vakuum eller elektrisk'),d:t2('In a typical light piston the attitude and heading gyros run on an <b>engine vacuum pump</b> and the turn coordinator is <b>electric</b>, so one failure never takes all three.','I et typisk småfly går holdnings- og kursgyroen på en <b>motordrevet vakuumpumpe</b>, og svingkoordinatoren er <b>elektrisk</b>, så én feil tar aldri alle tre.'),
  dd:t2('A vacuum failure is quiet: the rotors slow and the instruments drift off with no flag. Watch the suction gauge (about 4.5–5.5 inHg). Electric gyros show an OFF flag.','En vakuumfeil er stille: rotorene går saktere og instrumentene driver av uten flagg. Følg med på sugemåleren (rundt 4,5–5,5 inHg). Elektriske gyroer viser OFF-flagg.'),
  ill:()=>sv(`${dial(44,-110)}${tx(44,60,'suction','#8b99a7','middle',7.5)}<rect x="96" y="20" width="60" height="20" rx="3" fill="#d8392b" transform="rotate(-10 126 30)"/>${tx(126,34,'OFF','#ffffff','middle',10)}`)},go({mode:'ins',cls:'pis',ib:0,ip:0,fault:'vac'})),
 Object.assign({k:'glass',t:t2('Analog or glass','Analogt eller glass'),d:t2('A classic light piston has spinning gyros behind each dial. Turboprops and jets have <b>glass</b>: an <b>AHRS</b> or <b>IRS</b> with no spinning parts feeds one display.','Et klassisk småfly har roterende gyroer bak hver skive. Turboprop og jetfly har <b>glass</b>: en <b>AHRS</b> eller <b>IRS</b> uten bevegelige deler mater én skjerm.'),
  dd:t2('Typical: a turboprop has two AHRS (solid-state gyros, slaved to a magnetometer); a jet has three inertial reference units (ring-laser gyros) combined with the air data computers. Both keep an independent standby.','Typisk: en turboprop har to AHRS (halvledergyroer, slavet til et magnetometer); et jetfly har tre treghetsreferanseenheter (ringlasergyroer) kombinert med luftdatadatamaskinene. Begge har et uavhengig reserveinstrument.'),
  ill:()=>sv(`${dial(40,0)}<rect x="96" y="8" width="90" height="48" rx="3" fill="#0e4e91"/><rect x="96" y="32" width="90" height="24" fill="#7a5634"/><line x1="96" y1="32" x2="186" y2="32" stroke="#fff"/><path d="M126,32 h12 M148,32 h12" stroke="#ffd34a" stroke-width="3"/>`)},go({mode:'ins',cls:'tp',ib:10,ip:2,fault:'none'})),
 Object.assign({k:'rlg',dp:1,t:t2('Lasers and silicon','Laser og silisium'),d:t2('A <b>ring-laser gyro</b> measures rotation from two light beams going opposite ways round a closed path. A <b>MEMS</b> gyro is a vibrating silicon structure that feels the Coriolis force.','En <b>ringlasergyro</b> måler rotasjon fra to lysstråler som går hver sin vei rundt en lukket bane. En <b>MEMS</b>-gyro er en vibrerende silisiumstruktur som kjenner corioliskraften.'),
  dd:t2('Ring-laser gyros are accurate enough to navigate for hours (about 1–2 NM/h). MEMS gyros are small and cheap but drift too fast to navigate alone, so an AHRS gives attitude and heading only.','Ringlasergyroer er nøyaktige nok til å navigere i timevis (rundt 1–2 NM/t). MEMS-gyroer er små og billige, men driver for fort til å navigere alene, så en AHRS gir bare holdning og kurs.'),
  ill:()=>sv(`<path d="M60,8 L100,56 L20,56 Z" fill="none" stroke="#7fcbe8" stroke-width="2"/>${ar(40,40,52,22,'#ec5a47')}${ar(80,22,92,40,'#f0c470')}<rect x="130" y="18" width="40" height="28" rx="2" fill="#3a4651" stroke="#c9d2da"/>${tx(150,58,'MEMS','#8b99a7','middle',8)}`)},go({mode:'irs',sens:'rlg',gnss:'off',hrs:3})),
 Object.assign({k:'align',dp:1,t:t2('Alignment','Innretting'),d:t2('Standing still, the IRS finds the vertical with its accelerometers and <b>true north</b> from the horizontal part of the earth’s spin. Typically about 10 minutes; longer near the poles.','Mens flyet står stille finner IRS loddlinjen med akselerometrene og <b>rettvisende nord</b> fra den horisontale delen av jordrotasjonen. Typisk rundt 10 minutter; lengre nær polene.'),
  ill:()=>sv(`<circle cx="60" cy="34" r="24" fill="#1a2e3b" stroke="#7fcbe8"/><line x1="60" y1="4" x2="60" y2="62" stroke="#c9d2da"/>${ar(77,17,66,6,'#7fcbe8')}${tx(110,30,'Ω cos φ → N','#7fcbe8','start',9)}`)},go({mode:'irs',rlat:60,move:'still',pos:'ok',go:1}))];
KCS.render(el('kcGrid'),KC);

/* ---------------- deep-dive folds ---------------- */
const P=s=>`<p>${s}</p>`, FX=s=>`<div class="fx">${s}</div>`;
const DD=[
 ['cmp',t2('The direct-reading compass','Det direkte kompasset'),t2('build, swing and limits','oppbygging, kompensering og grenser'),[
  t2(P('Two or more small magnets hang below a pivot in a bowl of liquid, with the card fixed to them and a lubber line on the bowl. The liquid damps the swings (it must be <b>aperiodic</b>: settle without overshooting), and the suspension must keep the magnets <b>horizontal</b> and <b>sensitive</b>.')+P('<b>Deviation</b> comes from the aircraft’s own iron and electrics. A <b>compass swing</b> on a compass base removes most of it with small compensating magnets; what is left goes on the deviation card. Swing it after a big repair, new radio or electrical equipment, a lightning strike, or when the card is out of date.')+FX('true ± variation = magnetic ± deviation = compass  ·  subtract E, add W')+P('Near the magnetic poles H becomes so weak that friction and errors dominate: the compass is unreliable there. Keep magnetic items (headsets, phones) away from it.'),
     P('To eller flere små magneter henger under et oppheng i en skål med væske, med kortet festet til dem og en styrestrek på skålen. Væsken demper svingningene (det må være <b>aperiodisk</b>: falle til ro uten å svinge forbi), og opphenget må holde magnetene <b>vannrette</b> og <b>følsomme</b>.')+P('<b>Deviasjon</b> kommer fra flyets eget jern og elektriske utstyr. En <b>kompasskompensering</b> på en kompassplass fjerner det meste med små kompenseringsmagneter; resten skrives på deviasjonskortet. Gjør det etter store reparasjoner, nytt radio- eller elektrisk utstyr, lynnedslag, eller når kortet er utdatert.')+FX('rettvisende ± misvisning = magnetisk ± deviasjon = kompass  ·  trekk fra Ø, legg til V')+P('Nær de magnetiske polene blir H så svak at friksjon og feil dominerer: kompasset er upålitelig der. Hold magnetiske ting (hodetelefoner, telefoner) unna det.'))]],
 ['err',t2('Why the compass lies','Hvorfor kompasset lyver'),t2('the offset weight and the swing equation','den forskjøvne vekten og svingligningen'),[
  t2(P('Z would pull the north end of the magnet down. To keep it level, its centre of gravity is placed on the <b>equator side</b> of the pivot, so its weight balances Z. Any horizontal acceleration then acts on that weight and turns the magnet, unless the acceleration lies along the magnet (north or south headings).')+P('In the model the magnet lines up with H plus Z × (acceleration ÷ g), so its north end swings by')+FX('ψ = atan2(k sin β, 1 + k cos β),  k = (a / g) · tan dip')+P('β is the direction of the acceleration from magnetic north: along the heading when speeding up, opposite when slowing down, and towards the turn centre (a = g tan bank) in a turn.')+`<div class="wrapx"><table class="ftab"><tr><th></th><th>N heading</th><th>E / W heading</th><th>S heading</th></tr><tr><td>accelerate</td><td>0</td><td>shows turn to N</td><td>0</td></tr><tr><td>decelerate</td><td>0</td><td>shows turn to S</td><td>0</td></tr><tr><td>turn</td><td>lags: roll out early</td><td>≈ 0</td><td>leads: roll out late</td></tr></table></div>`+P('All of this is for the northern hemisphere; in the southern hemisphere every error reverses, and at the magnetic equator there is none.'),
     P('Z ville trukket nordenden av magneten ned. For å holde den vannrett er tyngdepunktet plassert på <b>ekvatorsiden</b> av opphenget, så vekten balanserer Z. Enhver vannrett akselerasjon virker da på den vekten og dreier magneten, med mindre akselerasjonen ligger langs magneten (nord- eller sørkurs).')+P('I modellen legger magneten seg etter H pluss Z × (akselerasjon ÷ g), så nordenden svinger')+FX('ψ = atan2(k sin β, 1 + k cos β),  k = (a / g) · tan inklinasjon')+P('β er retningen til akselerasjonen fra magnetisk nord: langs kursen når farten øker, motsatt når den minker, og mot svingsenteret (a = g tan krengning) i en sving.')+`<div class="wrapx"><table class="ftab"><tr><th></th><th>nordkurs</th><th>øst-/vestkurs</th><th>sørkurs</th></tr><tr><td>akselerer</td><td>0</td><td>viser sving mot N</td><td>0</td></tr><tr><td>sakk ned</td><td>0</td><td>viser sving mot S</td><td>0</td></tr><tr><td>sving</td><td>henger etter: rull ut tidlig</td><td>≈ 0</td><td>ligger foran: rull ut sent</td></tr></table></div>`+P('Alt dette gjelder den nordlige halvkule; på den sørlige snur alle feilene, og ved den magnetiske ekvator er det ingen.'))]],
 ['gyro',t2('Gyro types and wander','Gyrotyper og drift'),t2('earth, tied and rate gyros; the drift sums','jord-, bundne og rategyroer; driftsregnestykket'),[
  t2(P('<b>Earth gyro</b> (attitude indicator): spin axis held vertical by gravity-sensing erection. <b>Tied gyro</b> (heading indicator): spin axis horizontal, tied to the aircraft’s yaw axis, no north-seeking. <b>Rate gyro</b> (turn indicator/coordinator): one gimbal held by a spring; the precession from a turn deflects it in proportion to the rate.')+FX('H = I · ω   ·   precession rate = torque / H')+P('<b>Real wander</b> is the axis really moving (friction, imbalance). <b>Apparent wander</b> is the axis staying fixed in space while the earth turns or the aircraft moves over it. For a heading indicator, change of reading per hour:')+FX('earth rate = −15.04 × sin lat  ·  transport wander = −(E–W groundspeed / 60) × tan lat  ·  latitude nut = +15.04 × sin (lat set)')+P('In the northern hemisphere the earth rate makes the reading <b>decrease</b>; flying east adds to it, flying west takes away. A latitude nut is a small weight that adds a fixed opposite precession: it is exact at one latitude only. In the southern hemisphere the signs reverse.'),
     P('<b>Jordgyro</b> (holdningsindikator): spinnaksen holdes loddrett av et oppreisingssystem som føler tyngden. <b>Bundet gyro</b> (kursgyro): spinnaksen vannrett, bundet til flyets giraksen, uten nordsøking. <b>Rategyro</b> (svingviser/-koordinator): én opphengsring holdt av en fjær; presesjonen fra en sving bøyer den i forhold til raten.')+FX('H = I · ω   ·   presesjonsrate = dreiemoment / H')+P('<b>Virkelig drift</b> er at aksen faktisk flytter seg (friksjon, ubalanse). <b>Tilsynelatende drift</b> er at aksen står fast i rommet mens jorden dreier eller flyet beveger seg over den. For en kursgyro, endring i avlesning per time:')+FX('jordrotasjon = −15,04 × sin bredde  ·  transportdrift = −(Ø–V groundspeed / 60) × tan bredde  ·  breddegradsmutter = +15,04 × sin (innstilt bredde)')+P('På den nordlige halvkule får jordrotasjonen avlesningen til å <b>minke</b>; flyging østover øker det, vestover trekker fra. En breddegradsmutter er en liten vekt som gir en fast motsatt presesjon: den er nøyaktig på én breddegrad. På den sørlige halvkule snur fortegnene.'))]],
 ['ai',t2('The attitude indicator','Holdningsindikatoren'),t2('erection, errors and limits','oppreising, feil og grenser'),[
  t2(P('The rotor spins about a vertical axis in two gimbals, so the aircraft can pitch and roll around it. An <b>erection system</b> keeps the axis vertical: in an air-driven instrument, pendulous vanes over the air outlets; in an electric one, gravity-sensing switches and torque motors. Typical erection rates are a few degrees per minute.')+P('Because it erects to the apparent vertical, a sustained acceleration fools it: a classic air-driven instrument shows a small false <b>nose-up and right bank</b> during the take-off acceleration, and long turns leave small errors that slowly erect out. Older instruments <b>topple</b> beyond their limits (typically about 60° of pitch and 100–110° of bank); modern ones have wider or no limits. A caging knob locks the gyro and resets it.')+P('<b>Failure signs:</b> low suction or an OFF flag, an attitude that does not match the other instruments, a slow drift into a bank with no turn on the turn coordinator. Cover a failed instrument and fly partial panel.'),
     P('Rotoren spinner om en loddrett akse i to opphengsringer, så flyet kan stampe og rulle rundt den. Et <b>oppreisingssystem</b> holder aksen loddrett: i et luftdrevet instrument pendelvinger over luftutløpene; i et elektrisk tyngdefølende brytere og momentmotorer. Typisk oppreising er noen grader per minutt.')+P('Fordi den reiser seg mot den tilsynelatende loddlinjen, lures den av vedvarende akselerasjon: et klassisk luftdrevet instrument viser litt falsk <b>nese opp og høyre krengning</b> under akselerasjonen ved avgang, og lange svinger etterlater små feil som sakte retter seg. Eldre instrumenter <b>velter</b> utenfor grensene (typisk rundt 60° pitch og 100–110° krengning); moderne har videre eller ingen grenser. En låseknapp (caging) låser gyroen og nullstiller den.')+P('<b>Tegn på feil:</b> lavt sug eller OFF-flagg, en holdning som ikke stemmer med de andre instrumentene, en sakte drift inn i krengning uten sving på svingkoordinatoren. Dekk til et feilet instrument og fly partial panel.'))]],
 ['tc',t2('Turn indicator, turn coordinator and slaved heading','Svingviser, svingkoordinator og slavet kurs'),t2('rate one, the ball, the flux valve','rate én, kula, fluxventilen'),[
  t2(P('A <b>turn indicator</b> has a rate gyro with its spin axis across the aircraft: it senses yaw rate only. A <b>turn coordinator</b> tilts the gimbal axis about 30°, so it also senses roll rate and responds as soon as you start to bank. Neither shows pitch. The ball next to it is a simple inclinometer: step on the ball.')+FX('rate one = 3 °/s  ·  bank = atan(V·ω / g)  ≈ TAS/10 + 7 (°)')+P('A <b>remote indicating compass</b> (slaved gyro) replaces manual resetting: a <b>flux valve</b> (flux gate) in the wing tip senses the earth’s field, and a slaving system precesses the heading gyro slowly towards it. The gyro gives short-term stability; the flux valve gives long-term north. Turboprop AHRS work the same way with a magnetometer.'),
     P('En <b>svingviser</b> har en rategyro med spinnaksen på tvers av flyet: den føler bare girrate. En <b>svingkoordinator</b> vipper opphengsaksen rundt 30°, så den også føler rullrate og reagerer så snart du begynner å krenge. Ingen av dem viser pitch. Kula ved siden av er et enkelt krengningsinstrument: tråkk på kula.')+FX('rate én = 3 °/s  ·  krengning = atan(V·ω / g)  ≈ TAS/10 + 7 (°)')+P('Et <b>fjernavlest kompass</b> (slavet gyro) erstatter manuell justering: en <b>fluxventil</b> (flux gate) i vingetuppen føler jordens felt, og et slavesystem presesserer kursgyroen sakte mot den. Gyroen gir kortsiktig stabilitet; fluxventilen gir langsiktig nord. AHRS i turboprop virker på samme måte med et magnetometer.'))]],
 ['ins',t2('Inertial reference and AHRS','Treghetsreferanse og AHRS'),t2('sensors, alignment, drift, aiding','sensorer, innretting, drift, hjelp'),[
  t2(P('<b>Ring-laser gyro</b>: two laser beams go opposite ways round a triangle of mirrors; rotation makes one path effectively longer (Sagnac effect) and the frequency difference measures the rate. At very low rates the beams lock together (<b>lock-in</b>), so the block is mechanically dithered. <b>Fibre-optic</b> gyros use the same effect in a coil of fibre. <b>MEMS</b> gyros are vibrating silicon structures. Accelerometers in three axes complete the unit.')+P('<b>Alignment</b> (aircraft still): levelling with the accelerometers, then <b>gyrocompassing</b>: the horizontal earth rate, 15.04 × cos lat, points to true north, and the ratio of vertical to horizontal rate gives the latitude, which is compared with the position entered. Typically about 10 minutes, up to about 17 at high latitude, and not possible beyond roughly 78°. Moving the aircraft during alignment spoils it.')+FX('latitude = atan(vertical rate / horizontal rate)  ·  Schuler period = 2π√(R/g) ≈ 84.4 min')+P('Errors oscillate with the <b>Schuler</b> period and grow overall about 1–2 NM per hour in pure inertial navigation. Mixed with GNSS (hybrid) the position stays within a few hundredths of a NM. A typical jet has three units combining inertial and air data (ADIRS); if one loses its navigation function it may still give attitude in <b>ATT</b> mode, with heading entered by hand. An <b>AHRS</b> uses MEMS or fibre-optic gyros aided by gravity, air data, a magnetometer and often GNSS: it gives attitude and heading, never position.'),
     P('<b>Ringlasergyro</b>: to laserstråler går hver sin vei rundt en trekant av speil; rotasjon gjør den ene veien effektivt lengre (Sagnac-effekten), og frekvensforskjellen måler raten. Ved svært lave rater låser strålene seg sammen (<b>lock-in</b>), så blokken vibreres mekanisk (dither). <b>Fiberoptiske</b> gyroer bruker samme effekt i en fiberspole. <b>MEMS</b>-gyroer er vibrerende silisiumstrukturer. Akselerometre i tre akser fullfører enheten.')+P('<b>Innretting</b> (flyet står stille): nivellering med akselerometrene, så <b>gyrokompassering</b>: den horisontale jordrotasjonen, 15,04 × cos bredde, peker mot rettvisende nord, og forholdet mellom vertikal og horisontal rate gir breddegraden, som sammenlignes med posisjonen som legges inn. Typisk rundt 10 minutter, opptil rundt 17 på høy breddegrad, og ikke mulig over omtrent 78°. Flytter du flyet under innrettingen, ødelegges den.')+FX('breddegrad = atan(vertikal rate / horisontal rate)  ·  Schuler-periode = 2π√(R/g) ≈ 84,4 min')+P('Feilene svinger med <b>Schuler</b>-perioden og vokser totalt rundt 1–2 NM per time i ren treghetsnavigasjon. Blandet med GNSS (hybrid) holder posisjonen seg innen noen hundredels NM. Et typisk jetfly har tre enheter som kombinerer treghet og luftdata (ADIRS); mister én navigasjonsfunksjonen, kan den fortsatt gi holdning i <b>ATT</b>-modus, med kurs lagt inn for hånd. En <b>AHRS</b> bruker MEMS- eller fiberoptiske gyroer hjulpet av tyngden, luftdata, et magnetometer og ofte GNSS: den gir holdning og kurs, aldri posisjon.'))]],
 ['cls',t2('Piston, turboprop and jet','Stempel, turboprop og jet'),t2('what typically sits behind the attitude display','hva som typisk sitter bak holdningsvisningen'),['CLS']]];
const CLS=[[t2('Light piston (classic)','Småfly (klassisk)'),t2('Vacuum attitude and heading gyros, electric turn coordinator, direct-reading compass. Heading reset by hand every 10–15 min. Failures are often quiet. (Newer light aircraft often have a glass display with a MEMS AHRS instead.)','Vakuumgyroer for holdning og kurs, elektrisk svingkoordinator, direkte kompass. Kursen justeres for hånd hvert 10.–15. min. Feil er ofte stille. (Nyere småfly har ofte en glasskjerm med MEMS AHRS i stedet.)')],
 [t2('Turboprop (typical)','Turboprop (typisk)'),t2('Two AHRS with solid-state gyros, heading slaved to a magnetometer or flux valve, air data aiding. Glass displays, an independent standby, red flags when a source fails.','To AHRS med halvledergyroer, kurs slavet til magnetometer eller fluxventil, hjelp fra luftdata. Glasskjermer, et uavhengig reserveinstrument, røde flagg når en kilde feiler.')],
 [t2('Jet (typical)','Jetfly (typisk)'),t2('Three inertial reference units with ring-laser gyros, combined with air data (ADIRS). True heading from alignment, position for the FMS mixed with GNSS, source switching, standby instrument and compass.','Tre treghetsreferanseenheter med ringlasergyroer, kombinert med luftdata (ADIRS). Rettvisende kurs fra innrettingen, posisjon til FMS blandet med GNSS, kildebytte, reserveinstrument og kompass.')]];
function drawDD(){ const open=[...document.querySelectorAll('#ddList details[open]')].map(d=>d.id);
  el('ddList').innerHTML=DD.map(([id,t,s,ps])=>`<details class="dfold" id="dd-${id}"><summary>${L(t)} <small>${L(s)}</small></summary><div>${ps.map(p=>p==='CLS'?`<div class="cls3">${CLS.map(([a,b])=>`<div><b>${L(a)}</b>${L(b)}</div>`).join('')}</div>`:L(p)).join('')}</div></details>`).join('');
  open.forEach(i=>{ const d=el(i); if(d) d.open=true; }); }

/* ---------------- Test yourself ---------------- */
function drawTake(){ const TK=[
  t2('<b>True → magnetic → compass:</b> subtract easterly variation and deviation, add westerly. Variation from the chart, deviation from the card.','<b>Rettvisende → magnetisk → kompass:</b> trekk fra østlig misvisning og deviasjon, legg til vestlig. Misvisning fra kartet, deviasjon fra kortet.'),
  t2('<b>Dip</b> makes the compass errors: they grow with latitude, vanish at the magnetic equator and reverse in the southern hemisphere.','<b>Inklinasjon</b> gir kompassfeilene: de vokser med breddegraden, forsvinner ved den magnetiske ekvator og snur på den sørlige halvkule.'),
  t2('<b>Acceleration errors</b> are largest on east and west: accelerate → shows a turn to north, decelerate → to south.','<b>Akselerasjonsfeil</b> er størst på øst og vest: akselerer → viser sving mot nord, sakk ned → mot sør.'),
  t2('<b>Turning errors</b> are largest through north and south: the compass lags through north (roll out early) and leads through south (roll out late).','<b>Svingfeil</b> er størst gjennom nord og sør: kompasset henger etter gjennom nord (rull ut tidlig) og ligger foran gjennom sør (rull ut sent).'),
  t2('<b>Rigidity</b> = I·ω. <b>Precession:</b> a push acts 90° further round in the direction of rotation.','<b>Stivhet</b> = I·ω. <b>Presesjon:</b> et dytt virker 90° lenger rundt i rotasjonsretningen.'),
  t2('<b>The heading indicator drifts</b>: earth rate 15 °/h × sin lat (about 13 °/h in southern Norway) plus transport wander. Reset it from the compass every 10–15 min.','<b>Kursgyroen driver</b>: jordrotasjon 15 °/t × sin bredde (rundt 13 °/t i Sør-Norge) pluss transportdrift. Juster den etter kompasset hvert 10.–15. min.'),
  t2('<b>Attitude</b> (earth gyro), <b>heading</b> (directional gyro), <b>turn coordinator</b> (rate gyro). Rate one = 3 °/s; bank ≈ TAS/10 + 7.','<b>Holdning</b> (jordgyro), <b>kurs</b> (retningsgyro), <b>svingkoordinator</b> (rategyro). Rate én = 3 °/s; krengning ≈ TAS/10 + 7.'),
  t2('<b>Light piston:</b> vacuum attitude and heading, electric turn coordinator; a vacuum failure is quiet. <b>Turboprop and jet:</b> AHRS or IRS glass, failures flagged, switch source and use the standby.','<b>Småfly:</b> vakuum for holdning og kurs, elektrisk svingkoordinator; en vakuumfeil er stille. <b>Turboprop og jet:</b> glass med AHRS eller IRS, feil flagges, bytt kilde og bruk reserveinstrumentet.'),
  {dp:1,...t2('<b>An IRS aligns</b> standing still by sensing the earth’s spin (15 °/h × cos lat towards true north); pure inertial drift is about 1–2 NM/h, GNSS aiding removes it. An AHRS gives no position.','<b>En IRS innrettes</b> stillestående ved å føle jordrotasjonen (15 °/t × cos bredde mot rettvisende nord); ren treghetsdrift er rundt 1–2 NM/t, GNSS-hjelp fjerner den. En AHRS gir ingen posisjon.')}];
  el('take').innerHTML=TK.filter(x=>!x.dp||deepOn()).map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.k').textContent=L(t2('Memory aid','Huskeregel'));
  m.querySelector('b').textContent='ANDS: Accelerate North, Decelerate South';
  m.querySelector('p').textContent=L(t2('Northern hemisphere, on an easterly or westerly heading: speed up and the compass shows a turn towards north; slow down and it shows a turn towards south. No error on north or south headings, and it all reverses in the southern hemisphere.','Nordlige halvkule, på østlig eller vestlig kurs: øk farten og kompasset viser en sving mot nord; senk farten og det viser en sving mot sør. Ingen feil på nord- eller sørkurs, og alt snur på den sørlige halvkule.')); }

LAB.quiz(el('qbox'),'gyros',()=>LAB.shuffle([
 {q:t2('Northern hemisphere, heading 090°. You accelerate. The compass shows…','Nordlige halvkule, kurs 090°. Du akselererer. Kompasset viser …'),a:[t2('an apparent turn towards north','en tilsynelatende sving mot nord'),t2('an apparent turn towards south','en tilsynelatende sving mot sør'),t2('no error','ingen feil')],c:0,e:t2('ANDS: Accelerate North, Decelerate South, on easterly and westerly headings.','ANDS: Accelerate North, Decelerate South, på østlige og vestlige kurser.')},
 {q:t2('On a heading of 360° you accelerate. The acceleration error is…','På kurs 360° akselererer du. Akselerasjonsfeilen er …'),a:[t2('zero','null'),t2('at its largest','størst'),t2('towards east','mot øst')],c:0,e:t2('On north and south headings the acceleration lies along the line through the pivot and the offset weight: no turning moment.','På nord- og sørkurs ligger akselerasjonen langs linjen gjennom opphenget og den forskjøvne vekten: ikke noe dreiemoment.')},
 {q:t2('Turning left onto 180° in the northern hemisphere using the compass, you should roll out…','Når du svinger til venstre inn på 180° på den nordlige halvkule etter kompasset, bør du rulle ut …'),a:[t2('after the compass has passed 180°','etter at kompasset har passert 180°'),t2('before the compass reaches 180°','før kompasset når 180°'),t2('exactly at 180°','nøyaktig på 180°')],c:0,e:t2('Through south the compass leads the turn, so roll out late.','Gjennom sør ligger kompasset foran svingen, så rull ut sent.')},
 {q:t2('Why are compass errors larger in northern Norway than in southern Spain?','Hvorfor er kompassfeilene større i Nord-Norge enn i Sør-Spania?'),a:[t2('The dip is greater, so Z is large compared with H','Inklinasjonen er større, så Z er stor i forhold til H'),t2('The variation is greater','Misvisningen er større'),t2('It is colder','Det er kaldere')],c:0,e:t2('Only H steers the magnet; the errors scale with tan dip.','Bare H styrer magneten; feilene skalerer med tan inklinasjon.')},
 {q:t2('Variation 6° E, deviation 2° W, true heading 100°. Compass heading?','Misvisning 6° Ø, deviasjon 2° V, rettvisende kurs 100°. Kompasskurs?'),a:[t2('096°','096°'),t2('092°','092°'),t2('104°','104°')],c:0,e:t2('100 − 6 = 094° M; 094 + 2 = 096° C.','100 − 6 = 094° M; 094 + 2 = 096° C.')},
 {q:t2('The rigidity of a gyro depends on…','Stivheten til en gyro avhenger av …'),a:[t2('its moment of inertia and its spin speed','treghetsmomentet og turtallet'),t2('the size of its gimbals','størrelsen på opphengsringene'),t2('the latitude','breddegraden')],c:0,e:t2('Angular momentum H = I·ω: more of either gives more rigidity and less precession for a given torque.','Spinn H = I·ω: mer av noen av dem gir mer stivhet og mindre presesjon for et gitt dreiemoment.')},
 {q:t2('A force is applied to the rim of a spinning gyro. It takes effect…','En kraft påføres kanten av en roterende gyro. Den virker …'),a:[t2('90° further round in the direction of rotation','90° lenger rundt i rotasjonsretningen'),t2('exactly where it is applied','akkurat der den påføres'),t2('180° away','180° unna')],c:0,e:t2('That is precession.','Det er presesjon.')},
 {q:t2('Earth-rate drift of a heading indicator at 60° N is about…','Drift på grunn av jordrotasjon for en kursgyro på 60° N er omtrent …'),a:[t2('13° per hour','13° per time'),t2('7.5° per hour','7,5° per time'),t2('15° per minute','15° per minutt')],c:0,e:t2('15° × sin 60° ≈ 13° per hour.','15° × sin 60° ≈ 13° per time.')},
 {q:t2('In the northern hemisphere, with no latitude nut, the heading indicator reading on the ground…','På den nordlige halvkule, uten breddegradsmutter, vil avlesningen på kursgyroen på bakken …'),a:[t2('decreases','minke'),t2('increases','øke'),t2('stays the same','holde seg lik')],c:0,e:t2('The earth turns anticlockwise under the gyro (seen from above the North Pole), so the reading falls.','Jorden dreier mot klokka under gyroen (sett ovenfra Nordpolen), så avlesningen faller.')},
 {q:t2('In a typical light piston, which gyro instrument is usually electric?','I et typisk småfly, hvilket gyroinstrument er vanligvis elektrisk?'),a:[t2('The turn coordinator','Svingkoordinatoren'),t2('The attitude indicator','Holdningsindikatoren'),t2('The heading indicator','Kursgyroen')],c:0,e:t2('Attitude and heading on vacuum, turn coordinator electric: one failure never takes all three.','Holdning og kurs på vakuum, svingkoordinator elektrisk: én feil tar aldri alle tre.')},
 {q:t2('Rate-one bank angle at 120 kt TAS is about…','Krengning for rate én ved 120 kt TAS er omtrent …'),a:[t2('18–19°','18–19°'),t2('12°','12°'),t2('30°','30°')],c:0,e:t2('TAS/10 + 7 = 19°; the exact value is about 18°.','TAS/10 + 7 = 19°; eksakt verdi er rundt 18°.')},
 {q:t2('During the take-off acceleration a classic air-driven attitude indicator typically shows…','Under akselerasjonen ved avgang viser en klassisk luftdrevet holdningsindikator typisk …'),a:[t2('a small false nose-up and right bank','litt falsk nese opp og høyre krengning'),t2('a false nose-down','falsk nese ned'),t2('nothing wrong','ingen feil')],c:0,e:t2('Its erection system senses the apparent vertical, which the acceleration tilts.','Oppreisingssystemet føler den tilsynelatende loddlinjen, som akselerasjonen vipper.')},
 {q:t2('How does a turboprop AHRS keep its heading on magnetic north?','Hvordan holder en AHRS i en turboprop kursen mot magnetisk nord?'),a:[t2('It is slaved to a magnetometer or flux valve','Den er slavet til et magnetometer eller en fluxventil'),t2('The pilot resets it every 15 minutes','Piloten justerer den hvert 15. minutt'),t2('It gyrocompasses on the earth’s rotation','Den gyrokompasserer på jordrotasjonen')],c:0,e:t2('The gyros give short-term stability, the magnetometer long-term north.','Gyroene gir kortsiktig stabilitet, magnetometeret langsiktig nord.')},
 {q:t2('Why does an IRS take longer to align at high latitude?','Hvorfor tar det lengre tid å innrette en IRS på høy breddegrad?'),a:[t2('The horizontal earth rate it uses to find north is smaller','Den horisontale jordrotasjonen den bruker for å finne nord, er mindre'),t2('GNSS is weaker there','GNSS er svakere der'),t2('The laser must warm up in the cold','Laseren må varmes opp i kulden')],c:0,e:t2('Horizontal earth rate = 15.04 °/h × cos lat.','Horisontal jordrotasjon = 15,04 °/t × cos bredde.')},
 {q:t2('GNSS is lost and there are no radio aids. The IRS position…','GNSS er tapt og det finnes ingen radiohjelpemidler. IRS-posisjonen …'),a:[t2('carries on, drifting about 1–2 NM per hour','fortsetter, men driver rundt 1–2 NM per time'),t2('freezes at the last GNSS position','fryser på siste GNSS-posisjon'),t2('is lost at once','forsvinner med en gang')],c:0,e:t2('Inertial navigation needs no outside signal, but its error grows with time.','Treghetsnavigasjon trenger ikke signaler utenfra, men feilen vokser med tiden.')}]),10);

/* ---------------- static strings, text, start ---------------- */
LAB.add({},{'Attitude and Heading':'Holdning og kurs','Attitude and heading: compass, gyros and inertial systems':'Holdning og kurs: kompass, gyroer og treghetssystemer','Birdbird Virtual Lab · Instruments':'Birdbird Virtual Lab · Instrumenter',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Key concepts':'Nøkkelbegreper','Deep dive':'Dypdykk','The attitude and heading lab':'Holdnings- og kurslabben','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','Fly it':'Fly','Conditions':'Forhold','Advanced':'Avansert','The rotor':'Rotoren','Heading indicator drift':'Drift i kursgyroen','Aircraft':'Fly','Faults':'Feil','Alignment':'Innretting','In flight':'I lufta','Scenarios':'Scenarier','Mode':'Modus','Sections':'Seksjoner',
 'Magnetic compass, gyroscope, flight instruments and inertial reference, one mode at a time.':'Magnetkompass, gyroskop, flyinstrumenter og treghetsreferanse, én modus om gangen.'});
LAB.tx({lead:'Hvor peker jeg, og hvilken vei er opp? Magnetkompasset svarer på det første, men lyver når du svinger eller akselererer. Roterende gyroer svarer på begge, men driver og velter. Treghetssystemer og AHRS gjør det med laser og silisium. Se hver av dem virke, og se hvor de svikter.'});
function texts(){
  el('kin').textContent=L(t2('The ideas that carry the compass and the gyro instruments. “Show in the model” sets the lab up so you can see it.','Ideene som bærer kompasset og gyroinstrumentene. «Vis i modellen» setter opp labben så du kan se det.'));
  el('xLead').textContent=L(deepOn()?t2('Pick a mode above the figure. Fly the compass through turns and speed changes, push a spinning rotor and let a heading indicator drift, compare a classic panel with glass and break things, and (Deep dive) align an inertial reference.','Velg modus over figuren. Fly kompasset gjennom svinger og fartsendringer, dytt på en roterende rotor og la en kursgyro drive, sammenlign et klassisk panel med glass og ødelegg ting, og (dypdykk) innrett en treghetsreferanse.')
    :t2('Pick a mode above the figure, then use the buttons and sliders on the left. Each mode shows one instrument family and how it goes wrong.','Velg modus over figuren, og bruk knappene og glidebryterne til venstre. Hver modus viser én instrumentfamilie og hvordan den tar feil.'));
  el('tryLead').textContent=L(t2('Work it out first, then check. "Check it in the model" shows you why.','Regn det ut først, og sjekk. «Sjekk i modellen» viser deg hvorfor.'));
  el('foot').innerHTML=L(t2('<b>Model and limitations.</b> Teaching model, not for flight. Dip uses a dipole field (tan dip = 2 tan latitude; real dip over Scandinavia is about 70–80°). The compass errors are the steady swing of a pendulous magnet, ψ = atan2(k sin β, 1 + k cos β) with k = (a/g)·tan dip, with the card tilt limited and a simple first-order damping; liquid swirl and the transient overshoot are not modelled, so the sizes are illustrative. Gyro drift uses the textbook earth-rate (15.04 °/h × sin lat) and transport-wander ((E–W groundspeed / 60) × tan lat) formulas. Precession is rigid-body 3-D motion of the spin axis under the push. Instrument errors and limits, alignment times (about 9–17 min, none beyond 78°) and drift rates (about 1.5 NM/h pure inertial) are typical values, not data for a particular instrument, AHRS or IRS. Aircraft classes are generic. Follow the aircraft documentation and your operator’s procedures.',
    '<b>Modell og begrensninger.</b> Pedagogisk modell, ikke for flyging. Inklinasjonen bruker et dipolfelt (tan inklinasjon = 2 tan breddegrad; virkelig inklinasjon over Skandinavia er rundt 70–80°). Kompassfeilene er det stabile utslaget til en pendelopphengt magnet, ψ = atan2(k sin β, 1 + k cos β) med k = (a/g)·tan inklinasjon, med begrenset korthelning og enkel førsteordens demping; virvler i væsken og forbisving er ikke modellert, så størrelsene er illustrative. Gyrodriften bruker lærebokformlene for jordrotasjon (15,04 °/t × sin bredde) og transportdrift ((Ø–V groundspeed / 60) × tan bredde). Presesjonen er 3D-bevegelse av spinnaksen under dyttet. Instrumentfeil og grenser, innrettingstider (rundt 9–17 min, ingen over 78°) og driftrater (rundt 1,5 NM/t ren treghet) er typiske verdier, ikke data for et bestemt instrument, AHRS eller IRS. Flyklassene er generiske. Følg flyets dokumentasjon og operatørens prosedyrer.'));
  el('ddH').textContent=L(t2('Deep dive','Dypdykk')); }
function all(){ texts(); drawTabs(); drawPre(); syncCtl(); drawTask(); drawDD(); drawTake(); upd(); }
LAB.onLang(all);
document.addEventListener('labdepth',()=>{ if(S.mode==='irs'&&!deepOn()) setMode('cmp'); all(); });
LAB.start('gyro');
setMode('cmp'); all();
/* old anchors */
const HM={'#compass':'cmp','#gyro':'gyr','#ops':'ins','#irs':'irs'};
if(HM[location.hash]){ setMode(HM[location.hash]); requestAnimationFrame(()=>el('gyVp').scrollIntoView({block:'start'})); }
})();
