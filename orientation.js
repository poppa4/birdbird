/* Birdbird – orientation.js: the Spatial orientation lab (orientation.html).
   One dark figure with four modes: the leans, the graveyard spiral and the somatogravic go-around (two attitude spheres, real against felt,
   over a time chart you can play and scrub), and approach illusions (your view through the windscreen, the familiar picture, and the side view).
   All maths in hfcore.js (HFC). */
(function(){
'use strict';
const {L,el,nf}=LAB, H=HFC, t2=(en,no)=>({en,no});
const D2R=Math.PI/180;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const MONO='"IBM Plex Mono", ui-monospace, monospace', SANS='"Public Sans", system-ui, sans-serif';
const C={real:'#F4F7F9',felt:'#C9B6F2',alt:'#F0C470',txt:'#EEF2F5',mut:'#8E99A4',dim:'#5E6D7C',red:'#EC5A47',ok:'#71CC93',amb:'#F0C470',grid:'rgba(200,215,225,.10)',sky:'#3D7FB8',gnd:'#7A5230',gs:'#71CC93'};
const clamp=H.clamp;
const depth=()=>document.body.classList.contains('depth-short')?'short':document.body.classList.contains('depth-instructor')?'instructor':'deep';
const deepOn=()=>depth()!=='short';
const sg=v=>(v>0.05?'+':v<-0.05?'−':'')+nf(Math.abs(v),Math.abs(v)<10?1:0);
const bankTxt=b=>Math.abs(b)<1?L(t2('wings level','vinger vannrett')):nf(Math.abs(b),0)+'° '+(b>0?L(t2('right','høyre')):L(t2('left','venstre')));
const pitchTxt=p=>Math.abs(p)<0.5?'0°':nf(Math.abs(p),0)+'° '+(p>0?L(t2('nose up','nese opp')):L(t2('nose down','nese ned')));
const ft=v=>nf(Math.round(v/10)*10,0)+' ft';

/* ---------------- state ---------------- */
const S={mode:'leans',rate:1,bank:20,turn:40,acc:0.3,by:'inst',slope:0,width:45,night:'lit',path:'eye',dist:2,t:0,playing:false};
const SPEED={leans:4,spiral:5,soma:2};
let SIM=null;
function resim(){ if(S.mode==='app'){ SIM=null; return; }
  SIM=H.simulate(S.mode,S.mode==='leans'?{rate:S.rate,bank:S.bank}:S.mode==='spiral'?{turn:S.turn,by:S.by}:{acc:S.acc,by:S.by});
  S.t=clamp(S.t,0,simT()); }
const simT=()=>SIM?SIM.rows[SIM.rows.length-1].t:0;
function row(){ if(!SIM) return null; const i=clamp(Math.round(S.t/SIM.dt),0,SIM.rows.length-1); return SIM.rows[i]; }
/* the approach */
const RL=2500;                                   // runway length (m)
function appModel(){ const s=H.pct2deg(S.slope), gEye=H.eyeAngle(s,S.width), d=S.dist, m=d*1852;
  const h3=m*Math.tan(3*D2R)/0.3048, hEye=eyeH(d);
  const h=S.path==='eye'?Math.max(10,hEye):h3; const papiA=Math.atan((h*0.3048-300*Math.tan(s*D2R))/(m+300))/D2R;
  return {s,gEye,h3,hEye,h,papiA,lights:H.papi(papiA),diff:h-h3}; }
function eyeH(d){ const s=H.pct2deg(S.slope), g=H.eyeAngle(s,S.width), m=d*1852, h3=m*Math.tan(3*D2R)/0.3048; let h=m*Math.tan(g*D2R)/0.3048; if(S.night==='bh') h*=H.blackHoleH(d)/h3; return Math.max(0,h); }

/* ---------------- canvas helpers ---------------- */
const cv=el('orv'); const ST=LAB.fit(cv,()=>draw(),2);
let FS=1;
function txt(g,s,x,y,col,al,sz,wt,font){ g.font=`${wt||500} ${Math.round((sz||12)*FS*10)/10}px ${font||MONO}`; g.fillStyle=col||C.txt; g.textAlign=al||'left'; g.textBaseline='alphabetic'; g.fillText(s,x,y); g.textAlign='left'; }
function line(g,x1,y1,x2,y2,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]); }
function poly(g,pts,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.setLineDash([]); }
function dot(g,x,y,r,fill,stroke,w){ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=w||1.5; g.stroke(); } }
function rr(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }
function tag(g,s,x,y,col,o){ o=o||{}; const sz=(o.sz||11.5)*FS; g.font=`${o.wt||600} ${sz}px ${o.font||SANS}`; const w=g.measureText(s).width+10, h=sz+7;
  let bx=o.al==='right'?x-w:o.al==='center'?x-w/2:x; bx=clamp(bx,2,ST.w-w-2); const by=y-h/2;
  if(o.bg!==false){ g.fillStyle='rgba(10,14,18,.82)'; rr(g,bx,by,w,h,3); g.fill(); }
  g.fillStyle=col||C.txt; g.textBaseline='middle'; g.textAlign='left'; g.fillText(s,bx+5,y+0.5); g.textBaseline='alphabetic'; return [bx,by,bx+w,by+h]; }

/* an attitude sphere: bank + right, pitch + up. felt: the picture in your head (violet, dashed rim) */
function adi(g,cx,cy,r,bank,pitch,felt){ const k=r/32;
  g.save(); g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.clip(); g.translate(cx,cy); g.rotate(-bank*D2R);
  const off=pitch*k, sky=felt?'#5B5A92':C.sky, gnd=felt?'#5E4766':C.gnd;
  const gs=g.createLinearGradient(0,-r*2,0,off); gs.addColorStop(0,felt?'#3c3a6a':'#245E92'); gs.addColorStop(1,sky); g.fillStyle=gs; g.fillRect(-r*2,-r*3,r*4,r*3+off);
  const gg=g.createLinearGradient(0,off,0,r*2); gg.addColorStop(0,gnd); gg.addColorStop(1,felt?'#3a2a40':'#4A3020'); g.fillStyle=gg; g.fillRect(-r*2,off,r*4,r*3);
  line(g,-r*2,off,r*2,off,'#F4F7F9',1.6);
  for(const p of [-20,-10,10,20]){ const y=off-p*k, w=r*(Math.abs(p)===10?0.28:0.42); line(g,-w,y,w,y,'rgba(244,247,249,.75)',1.1); if(Math.abs(y)<r*0.14) continue; g.font=`500 ${Math.max(8,r*0.13)}px ${MONO}`; g.fillStyle='rgba(244,247,249,.75)'; g.textAlign='left'; g.fillText(String(Math.abs(p)),w+3,y+3); }
  g.restore();
  /* bank scale (fixed) and the sky pointer (moves with the horizon) */
  for(const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){ const q=a*D2R, l=a%30===0?0.13:0.08; line(g,cx+Math.sin(q)*r*0.98,cy-Math.cos(q)*r*0.98,cx+Math.sin(q)*r*(0.98-l),cy-Math.cos(q)*r*(0.98-l),'rgba(244,247,249,.8)',a%30===0?1.6:1); }
  const q=-bank*D2R, px=cx+Math.sin(q)*r*0.82, py=cy-Math.cos(q)*r*0.82; g.save(); g.translate(px,py); g.rotate(q); g.beginPath(); g.moveTo(0,-1); g.lineTo(-r*0.06,r*0.1); g.lineTo(r*0.06,r*0.1); g.closePath(); g.fillStyle=felt?C.felt:C.amb; g.fill(); g.restore();
  /* the aircraft symbol */
  const w=r*0.42; g.strokeStyle=felt?C.felt:C.amb; g.lineWidth=Math.max(2.5,r*0.05); g.lineCap='round'; g.beginPath(); g.moveTo(cx-w,cy); g.lineTo(cx-w*0.35,cy); g.lineTo(cx-w*0.18,cy+r*0.1); g.moveTo(cx+w,cy); g.lineTo(cx+w*0.35,cy); g.lineTo(cx+w*0.18,cy+r*0.1); g.stroke(); g.lineCap='butt'; dot(g,cx,cy,Math.max(2,r*0.035),felt?C.felt:C.amb);
  g.strokeStyle=felt?C.felt:'rgba(255,255,255,.28)'; g.lineWidth=felt?2:1.5; g.setLineDash(felt?[6,4]:[]); g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.stroke(); g.setLineDash([]); }

/* ---------------- the figure ---------------- */
function chipLeft(){ const chip=el('chip'); if(ST.w<640||!chip||getComputedStyle(chip).position!=='absolute'||!chip.offsetWidth) return 0; return chip.offsetLeft+chip.offsetWidth+10; }
function draw(){ if(!ST.w) return; const g=ST.ctx, W=ST.w, Hh=ST.h; g.setTransform(ST.dpr,0,0,ST.dpr,0,0); g.clearRect(0,0,W,Hh);
  FS=depth()==='instructor'?1.15:W<420?0.9:1;
  if(S.mode==='app') drawApp(g,W,Hh); else drawVest(g,W,Hh); }

function drawVest(g,W,Hh){ const R=row(), ph=W<640, cl=chipLeft(), soma=S.mode==='soma';
  const topH=ph?Hh*0.44:Hh*0.56, x0=ph?8:Math.max(cl,12), aw=W-x0-12;
  const r=Math.max(30,Math.min(aw*0.2,(topH-(ph?84:96))/2,150)), cy=(ph?14:18)+24+r, xa=x0+aw*0.27, xb=x0+aw*0.73;
  txt(g,L(t2('REAL · the attitude indicator','VIRKELIG · holdningsindikatoren')),xa,cy-r-14,'#AEB8C1','center',ph?9.5:11,600);
  txt(g,L(t2('FELT · what your inner ear says','FØLT · det det indre øret sier')),xb,cy-r-14,C.felt,'center',ph?9.5:11,600);
  adi(g,xa,cy,r,soma?0:R.real,soma?R.real:0,false); adi(g,xb,cy,r,soma?0:R.felt,soma?R.felt:0,true);
  const vr=soma?pitchTxt(R.real):bankTxt(R.real), vf=soma?pitchTxt(R.felt):bankTxt(R.felt);
  txt(g,vr,xa,cy+r+20,C.real,'center',ph?11:13,600); txt(g,vf,xb,cy+r+20,C.felt,'center',ph?11:13,600);
  const diff=R.felt-R.real; if(Math.abs(diff)>3){ tag(g,'≠ '+nf(Math.abs(diff),0)+'°',(xa+xb)/2,cy,C.amb,{al:'center',sz:ph?11:13}); }
  /* a second line under the spheres: what else is going on */
  let sub='';
  if(S.mode==='leans') sub=L(t2('canal signal ','buesignal '))+nf(Math.abs(R.canal),1)+' °/s '+(Math.abs(R.canal)>H.THR?L(t2('> 2: felt','> 2: kjennes')):L(t2('< 2: not felt','< 2: kjennes ikke')));
  if(S.mode==='spiral') sub=L(t2('height ','høyde '))+ft(R.alt)+(Math.abs(R.turnFelt)>0.05?' · '+L(R.turnFelt>0?t2('you feel a turn right','du kjenner en sving til høyre'):t2('you feel a turn left','du kjenner en sving til venstre')):'');
  if(soma) sub=L(t2('height ','høyde '))+ft(R.h)+' · '+nf(R.V,0)+' kt · '+L(t2('acceleration ','akselerasjon '))+nf(Math.max(0,R.acc),2)+' g';
  if(sub) txt(g,sub,(xa+xb)/2,cy+r+(ph?38:42),soma&&R.crashed?C.red:C.mut,'center',ph?9.5:11,500,SANS);
  if(soma&&R.crashed) tag(g,L(t2('IMPACT WITH THE GROUND','KOLLISJON MED BAKKEN')),xa,cy,C.red,{al:'center',sz:ph?12:14,wt:700});
  drawChart(g,[ph?8:12,topH+(ph?18:8),W-(ph?16:24),Hh-topH-(ph?26:20)],R); }

function drawChart(g,b,R){ const [x0,y0,w,h]=b, ph=ST.w<640, rows=SIM.rows, T=SIM.T||simT(), soma=S.mode==='soma', sp=S.mode==='spiral';
  g.fillStyle='rgba(6,9,12,.35)'; rr(g,x0,y0,w,h,6); g.fill();
  const pl=x0+(ph?34:44), pr=x0+w-(sp||soma?(ph?40:52):12), pt=y0+(ph?20:24), pb=y0+h-(ph?18:22);
  const lo=soma?-20:S.mode==='leans'?-25:-25, hi=soma?30:S.mode==='leans'?Math.max(25,S.bank+5):65;
  const X=t=>pl+t/T*(pr-pl), Y=v=>pb-(clamp(v,lo,hi)-lo)/(hi-lo)*(pb-pt);
  /* phase shading and labels */
  const band=(t1,t2_,lab,col)=>{ g.fillStyle=col; g.fillRect(X(t1),pt,X(t2_)-X(t1),pb-pt); if(lab) txt(g,lab,X(t1)+4,pt+11,C.mut,'left',ph?8.5:9.5,500,SANS); };
  if(S.mode==='leans'){ band(0,SIM.tIn,L(t2('slow roll','sakte rull')),'rgba(201,182,242,.06)'); band(SIM.tFix,SIM.tFix+S.bank/10,'',`rgba(240,196,112,.12)`); txt(g,L(t2('roll level','rull vannrett')),X(SIM.tFix)+4,pt+11,C.amb,'left',ph?8.5:9.5,500,SANS); }
  if(sp){ band(0,SIM.rollIn,'','rgba(201,182,242,.06)'); band(SIM.rollIn,SIM.tOut,L(t2('steady turn','jevn sving')),'rgba(201,182,242,.06)'); txt(g,L(t2('roll out','rull ut')),X(SIM.tOut)+4,pt+11,C.amb,'left',ph?8.5:9.5,500,SANS); line(g,X(SIM.tOut),pt,X(SIM.tOut),pb,'rgba(240,196,112,.35)',1,[3,3]); }
  if(soma){ txt(g,L(t2('go-around power','pådrag for avbrutt landing')),X(1)+4,pt+11,C.amb,'left',ph?8.5:9.5,500,SANS); line(g,X(1),pt,X(1),pb,'rgba(240,196,112,.35)',1,[3,3]); }
  /* grid */
  const step=hi-lo>60?20:10; for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step){ line(g,pl,Y(v),pr,Y(v),v===0?'rgba(200,215,225,.25)':C.grid,1); txt(g,(v>0?'+':'')+v+'°',pl-5,Y(v)+3.5,C.dim,'right',9); }
  for(let t=0;t<=T;t+=T>80?20:10) txt(g,t+' s',X(t),pb+13,C.dim,'center',9);
  txt(g,soma?L(t2('pitch','pitch')):L(t2('bank (+ right)','krengning (+ høyre)')),pl,y0+13,'#AEB8C1','left',ph?9:10,600);
  /* the secondary curve: height */
  if(sp||soma){ const key=sp?'alt':'h', top=sp?4200:Math.max(1200,Math.ceil(Math.max(...rows.map(r=>r[key]))/500)*500), bot=sp?Math.min(2500,Math.floor(Math.min(...rows.map(r=>r[key]))/500)*500):0, YA=v=>pb-(v-bot)/(top-bot)*(pb-pt);
    poly(g,rows.filter((_,i)=>i%4===0).map(r=>[X(r.t),YA(r[key])]),'rgba(240,196,112,.75)',1.6,[5,3]);
    txt(g,nf(top,0),pr+5,YA(top)+4,C.alt,'left',9); txt(g,nf(bot,0),pr+5,YA(bot),C.alt,'left',9); txt(g,L(t2('height, ft','høyde, ft')),x0+w-6,y0+13,C.alt,'right',ph?9:10,600);
    if(soma){ const c=rows.find(r=>r.crashed); if(c){ dot(g,X(c.t),YA(0),5,C.red); } } }
  /* real and felt */
  poly(g,rows.filter((_,i)=>i%2===0).map(r=>[X(r.t),Y(r.real)]),C.real,2.2);
  poly(g,rows.filter((_,i)=>i%2===0).map(r=>[X(r.t),Y(r.felt)]),C.felt,2.2,[6,4]);
  /* the playhead */
  line(g,X(S.t),pt-4,X(S.t),pb,'rgba(255,255,255,.55)',1.2); dot(g,X(S.t),Y(R.real),4.5,C.real); dot(g,X(S.t),Y(R.felt),4.5,'#0c1217',C.felt,2);
  if(S.mode==='soma'&&!R.crashed){ line(g,pl,Y(15),pr,Y(15),'rgba(113,204,147,.35)',1,[2,4]); txt(g,L(t2('target 15°','mål 15°')),pr-4,Y(15)-4,C.ok,'right',9); } }

/* ---- the approach: perspective view, the familiar picture, and the side view ---- */
let LIGHTS=null; function lights(){ if(LIGHTS) return LIGHTS; let s=7; const rnd=()=>{ s=(s*16807)%2147483647; return s/2147483647; }; LIGHTS=[]; for(let i=0;i<420;i++){ const x=600+rnd()*14000, y=(rnd()-0.5)*14000; if(Math.abs(y)<220&&x<17000) continue; LIGHTS.push([x,y,rnd()]); } return LIGHTS; }
function view(g,b,o){ const [x0,y0,w,h]=b, m=o.d*1852, hc=o.h*0.3048, s=o.s*D2R, f=w/(2*Math.tan(4.5*D2R)), xc=x0+w/2, yc=y0+h*0.64, tc=Math.tan(3*D2R);
  g.save(); rr(g,x0,y0,w,h,6); g.clip();
  const P=(x,y,z)=>{ if(x<5) return null; return [xc+f*y/x, yc+f*((hc-z)/x-tc)]; };
  const hy=yc-f*tc;
  /* sky and ground */
  g.fillStyle=o.bh?'#05070a':'#0b1420'; g.fillRect(x0,y0,w,h);
  if(!o.bh){ const gr=g.createLinearGradient(0,hy,0,y0+h); gr.addColorStop(0,'#1b2418'); gr.addColorStop(1,'#0e140d'); g.fillStyle=gr; g.fillRect(x0,hy,w,y0+h-hy);
    const sk=g.createLinearGradient(0,y0,0,hy); sk.addColorStop(0,'#0b1420'); sk.addColorStop(1,'#26364a'); g.fillStyle=sk; g.fillRect(x0,y0,w,hy-y0);
    for(const [lx,ly,k] of lights()){ const p=P(m+lx-2500,ly,0); if(!p||p[1]<hy) continue; const rs=Math.max(0.6,Math.min(2.4,f*0.4/(m+lx))); g.fillStyle=k>0.7?'rgba(255,214,150,.85)':'rgba(255,236,200,.6)'; g.fillRect(p[0],p[1],rs,rs); } }
  else { g.fillStyle='#030405'; g.fillRect(x0,hy,w,y0+h-hy); }
  /* the runway: from the threshold (x = m) to the far end, sloping s */
  const z=xr=>xr*Math.tan(s), W2=o.w/2, Lr=RL;
  const q=[P(m,-W2,0),P(m,W2,0),P(m+Lr,W2,z(Lr)),P(m+Lr,-W2,z(Lr))];
  if(q.every(Boolean)){ g.fillStyle=o.bh?'#16181b':'#2a2d31'; g.beginPath(); q.forEach(([a,c],i)=>i?g.lineTo(a,c):g.moveTo(a,c)); g.closePath(); g.fill();
    /* centreline and aiming point */
    for(let xr=60;xr<Lr-60;xr+=60){ const a=P(m+xr,0,z(xr)), c=P(m+xr+30,0,z(xr+30)); if(a&&c) line(g,a[0],a[1],c[0],c[1],'rgba(240,240,240,.75)',Math.max(0.6,f*0.9/(m+xr))); }
    for(const sd of [-1,1]){ const a=[P(m+300,sd*W2*0.35,z(300)),P(m+300,sd*W2*0.62,z(300)),P(m+360,sd*W2*0.62,z(360)),P(m+360,sd*W2*0.35,z(360))]; if(a.every(Boolean)){ g.fillStyle='rgba(240,240,240,.8)'; g.beginPath(); a.forEach(([u,v],i)=>i?g.lineTo(u,v):g.moveTo(u,v)); g.closePath(); g.fill(); } }
    /* edge lights, threshold lights (green), end lights (red) */
    for(let xr=0;xr<=Lr;xr+=60) for(const sd of [-1,1]){ const p=P(m+xr,sd*(W2+1),z(xr)); if(p){ const rs=clamp(f*1.1/(m+xr),0.8,3); dot(g,p[0],p[1],rs,'rgba(255,240,200,.95)'); } }
    for(let y=-W2;y<=W2;y+=3){ const p=P(m,y,0); if(p) dot(g,p[0],p[1],clamp(f*0.9/m,0.7,2.4),'#7CF29A'); const e=P(m+Lr,y,z(Lr)); if(e) dot(g,e[0],e[1],clamp(f*0.7/(m+Lr),0.5,1.8),'#FF6A5A'); }
    /* approach lights */
    for(let xa=30;xa<=900;xa+=30){ const p=P(m-xa,0,0); if(p) dot(g,p[0],p[1],clamp(f*1.2/(m-xa),0.6,2.6),'rgba(255,248,225,.9)'); if(xa%300===0) for(let y=-15;y<=15;y+=3){ const c=P(m-xa,y,0); if(c) dot(g,c[0],c[1],clamp(f*0.8/(m-xa),0.5,2),'rgba(255,248,225,.85)'); } }
    /* PAPI: four units left of the runway, 300 m in */
    const pl=H.papi(o.papiA); for(let i=0;i<4;i++){ const p=P(m+300,-(W2+15+i*9),z(300)); if(p){ const rs=clamp(f*2.6/(m+300),1.4,4.5); dot(g,p[0],p[1],rs,pl[i]?'#FFFFFF':'#FF4B3A'); g.fillStyle=pl[i]?'rgba(255,255,255,.25)':'rgba(255,75,58,.25)'; g.beginPath(); g.arc(p[0],p[1],rs*2.2,0,Math.PI*2); g.fill(); } } }
  /* the glare shield */
  g.fillStyle='rgba(14,18,22,.95)'; g.beginPath(); g.moveTo(x0,y0+h); g.lineTo(x0,y0+h*0.9); g.quadraticCurveTo(x0+w/2,y0+h*0.84,x0+w,y0+h*0.9); g.lineTo(x0+w,y0+h); g.closePath(); g.fill();
  g.restore(); g.strokeStyle=o.ref?'rgba(113,204,147,.6)':'rgba(255,255,255,.22)'; g.lineWidth=1.2; rr(g,x0,y0,w,h,6); g.stroke();
  tag(g,o.title,x0+8,y0+14,o.ref?C.ok:C.txt,{sz:ST.w<640?9.5:10.5}); }

function drawApp(g,W,Hh){ const ph=W<640, cl=chipLeft(), M=appModel();
  const x0=ph?8:Math.max(cl,12), aw=W-x0-12; let topH;
  if(ph){ topH=Hh*0.56; const vh=topH/2-6; view(g,[x0,8,aw,vh],{d:S.dist,h:M.h,s:M.s,w:S.width,bh:S.night==='bh',papiA:M.papiA,title:L(t2('YOUR VIEW','DIN UTSIKT'))});
    view(g,[x0,8+vh+6,aw,vh],{d:S.dist,h:M.h3,s:0,w:45,bh:false,papiA:3,ref:true,title:L(t2('FAMILIAR: 45 m, flat, on 3°','KJENT: 45 m, flat, på 3°'))}); }
  else { const w1=aw*0.6-6, w2=aw-w1-10, vh=Math.min(Hh*0.56,w1*0.6);
    view(g,[x0,8,w1,vh],{d:S.dist,h:M.h,s:M.s,w:S.width,bh:S.night==='bh',papiA:M.papiA,title:L(t2('YOUR VIEW','DIN UTSIKT'))});
    const vh2=Math.min(vh-24,w2*0.66); view(g,[x0+w1+10,8,w2,vh2],{d:S.dist,h:M.h3,s:0,w:45,bh:false,papiA:3,ref:true,title:L(t2('FAMILIAR PICTURE','KJENT BILDE'))});
    txt(g,L(t2('45 m wide, flat, on the 3° path','45 m bred, flat, på 3°-banen')),x0+w1+10+w2/2,8+vh2+16,C.mut,'center',10,500,SANS); topH=8+vh+2; }
  /* side view */
  const sb=[ph?8:12,topH+(ph?10:12),W-(ph?16:24),Hh-topH-(ph?18:20)], [sx,sy,sw,sh]=sb;
  g.fillStyle='rgba(6,9,12,.35)'; rr(g,sx,sy,sw,sh,6); g.fill();
  const pl=sx+(ph?36:48), pr=sx+sw-(ph?40:70), pt=sy+(ph?22:24), pb=sy+sh-(ph?18:22), DM=8, hmax=2600;
  const X=d=>pr-(d/DM)*(pr-pl), Y=v=>pb-v/hmax*(pb-pt);
  for(let v=0;v<=hmax;v+=500) { line(g,pl,Y(v),pr,Y(v),C.grid,1); txt(g,nf(v,0),pl-5,Y(v)+3.5,C.dim,'right',9); }
  for(let d=0;d<=DM;d+=1) txt(g,String(d),X(d),pb+13,C.dim,'center',9);
  txt(g,L(t2('distance to the threshold, NM','avstand til terskelen, NM')),sx+sw-10,sy+14,C.dim,'right',ph?8.5:9.5);
  txt(g,L(t2('SIDE VIEW · height above the threshold (ft)','SIDEBILDE · høyde over terskelen (ft)')),sx+10,sy+14,'#AEB8C1','left',ph?9:10.5,600);
  /* ground and the runway (slope drawn 4× for visibility) */
  g.fillStyle=S.night==='bh'?'rgba(20,24,30,.9)':'rgba(52,73,59,.55)'; g.fillRect(pl,Y(0),pr-pl,pb-Y(0)+1);
  const rwPx=Math.min(sx+sw-pr-8,(RL/1852)/DM*(pr-pl)*3); const rise=Math.tan(M.s*D2R)*RL/0.3048*4;
  g.strokeStyle='#E6ECF0'; g.lineWidth=3; g.beginPath(); g.moveTo(pr,Y(0)); g.lineTo(pr+rwPx,Y(rise)); g.stroke();
  if(Math.abs(S.slope)>0.1) txt(g,L(S.slope>0?t2('upslope','oppoverbakke'):t2('downslope','nedoverbakke'))+' ×4',pr+rwPx/2,Y(Math.max(0,rise))-8,C.mut,'center',9);
  /* the 3° path and the path your eyes fly */
  poly(g,[[X(0),Y(0)],[X(DM),Y(DM*1852*Math.tan(3*D2R)/0.3048)]],C.gs,2,[7,4]);
  const ep=[]; for(let d=0.2;d<=DM;d+=0.1) ep.push([X(d),Y(eyeH(d))]); ep.unshift([X(0),Y(0)]); poly(g,ep,C.felt,2.2);
  txt(g,L(t2('3° path (PAPI / ILS)','3°-bane (PAPI / ILS)')),X(DM*0.8),Y(DM*0.8*1852*Math.tan(3*D2R)/0.3048)-8,C.gs,'left',ph?9:10,600,SANS);
  const ey=eyeH(DM*0.8); txt(g,L(t2('what your eyes fly','det øynene dine flyr')),X(DM*0.8),Y(ey)+(ey<DM*0.8*1852*Math.tan(3*D2R)/0.3048-60?18:ey>DM*0.8*1852*Math.tan(3*D2R)/0.3048+60?-8:24),C.felt,'right',ph?9:10,600,SANS);
  /* the aircraft */
  const ax=X(S.dist), ay=Y(M.h); g.save(); g.translate(ax,ay); g.rotate(3*D2R); g.fillStyle=C.real; g.beginPath(); g.moveTo(9,0); g.lineTo(-7,-2.5); g.lineTo(-9,-6); g.lineTo(-10,-1); g.lineTo(-7,2); g.closePath(); g.fill(); g.restore();
  if(S.path==='eye'&&Math.abs(M.diff)>20){ const y3=Y(M.h3), col=M.diff<0?C.red:C.amb; line(g,ax,ay,ax,y3,col,1.6); tag(g,nf(Math.abs(Math.round(M.diff/10)*10),0)+' ft '+L(M.diff<0?t2('below the 3° path','under 3°-banen'):t2('above the 3° path','over 3°-banen')),ax+8,(ay+y3)/2,col,{sz:ph?10:11}); } }

/* ---------------- readout chip, legend, "what you're seeing" ---------------- */
const ch=(i,b,cls)=>`<span><i>${i}</i><b${cls?` class="${cls}"`:''}>${b}</b></span>`;
function papiTxt(l){ const n=l.filter(Boolean).length; return n===2?L(t2('2 white 2 red: on path','2 hvite 2 røde: på banen')):n===0?L(t2('4 red: far too low','4 røde: altfor lavt')):n===4?L(t2('4 white: far too high','4 hvite: altfor høyt')):n===1?L(t2('1 white 3 red: low','1 hvit 3 røde: lavt')):L(t2('3 white 1 red: high','3 hvite 1 rød: høyt')); }
function readout(){ let h='';
  if(S.mode==='app'){ const M=appModel(); h=ch(L(t2('Path angle flown','Banevinkel fløyet')),S.path==='eye'?(S.night==='bh'?L(t2('sagging','synkende')):nf(M.gEye,1)+'°'):'3.0°','p')+ch(L(t2('Height','Høyde')),ft(M.h))+ch(L(t2('Against 3°','Mot 3°')),Math.abs(M.diff)<20?L(t2('on path','på banen')):sg(Math.round(M.diff/10)*10)+' ft',M.diff<-150?'r':M.diff<-20?'a':'g')+ch('PAPI',papiTxt(M.lights),M.lights.filter(Boolean).length<2?'r':M.lights.filter(Boolean).length>2?'a':'g'); }
  else { const R=row(), soma=S.mode==='soma'; h=ch(L(t2('Time','Tid')),nf(R.t,0)+' s')+ch(L(t2('Real','Virkelig')),soma?pitchTxt(R.real):bankTxt(R.real))+ch(L(t2('Felt','Følt')),soma?pitchTxt(R.felt):bankTxt(R.felt),'p');
    if(S.mode==='leans') h+=ch(L(t2('Canal signal','Buesignal')),nf(Math.abs(R.canal),1)+' °/s',Math.abs(R.canal)>H.THR?'a':'');
    if(S.mode==='spiral') h+=ch(L(t2('Height','Høyde')),ft(R.alt),R.alt<3700?'r':'');
    if(soma) h+=ch(L(t2('Height','Høyde')),R.crashed?L(t2('ground','bakken')):ft(R.h),R.crashed||R.h<500?'r':''); }
  el('chip').innerHTML=h; const v=VIEWS.find(v=>v[0]===S.mode); el('xsv').textContent=v?L(v[1]):''; }
function legend(){ const lg=(c,t,k)=>`<span><i class="${k||''}" style="--c:${c}"></i>${L(t)}</span>`; let s='';
  if(S.mode==='app') s=lg(C.gs,t2('3° glide path (PAPI / ILS)','3° glidebane (PAPI / ILS)'),'ln')+lg(C.felt,t2('path flown by eye','bane fløyet etter øyet'),'ln')+lg(C.real,t2('the aircraft','flyet'),'sq');
  else s=lg(C.real,t2('real: what the aircraft does','virkelig: det flyet gjør'),'ln')+lg(C.felt,t2('felt: what the inner ear says','følt: det det indre øret sier'),'ln')+(S.mode!=='leans'?lg(C.alt,t2('height','høyde'),'ln'):'');
  el('vleg').innerHTML=s; }
function see(){ let t;
  if(S.mode==='app'){ const M=appModel();
    if(S.night==='bh') t=t2('<b>Black hole:</b> no lights between you and the runway, so there is no ground to judge height by. You feel high and tend to descend early: the typical path sags well below the 3° line a few miles out. Fly the PAPI, ILS or a constant-angle descent.','<b>Svart hull:</b> ingen lys mellom deg og rullebanen, så det finnes ingen bakke å bedømme høyden etter. Du føler deg høy og synker gjerne for tidlig: den typiske banen henger godt under 3°-linjen noen mil ute. Fly PAPI, ILS eller en nedstigning med fast vinkel.');
    else if(Math.abs(M.gEye-3)<0.1) t=t2('<b>A normal runway:</b> 45 m wide and flat, the picture matches what you know, and your eyes fly the 3° path. Now make it narrower, wider or sloping.','<b>En vanlig rullebane:</b> 45 m bred og flat, bildet stemmer med det du kjenner, og øynene dine flyr 3°-banen. Gjør den smalere, bredere eller skrånende.');
    else if(S.path==='eye') t=M.gEye<3?t2(`<b>Your view looks like the familiar picture, but you are ${ft(-M.diff)} low.</b> A narrow or upslope runway looks as if you are high, so by eye you fly a ${nf(M.gEye,1)}° path. The PAPI tells the truth.`,`<b>Utsikten ser ut som det kjente bildet, men du er ${ft(-M.diff)} for lavt.</b> En smal eller oppoverbakke rullebane ser ut som om du er høy, så etter øyet flyr du en ${nf(M.gEye,1)}°-bane. PAPI sier sannheten.`)
      :t2(`<b>Your view looks like the familiar picture, but you are ${ft(M.diff)} high.</b> A wide or downslope runway looks as if you are low, so by eye you fly a ${nf(M.gEye,1)}° path and land long.`,`<b>Utsikten ser ut som det kjente bildet, men du er ${ft(M.diff)} for høyt.</b> En bred eller nedoverbakke rullebane ser ut som om du er lav, så etter øyet flyr du en ${nf(M.gEye,1)}°-bane og lander langt.`);
    else t=t2('<b>On the 3° path:</b> compare your view with the familiar picture. This runway looks different from the right height, and that difference is what pulls your eyes off the path.','<b>På 3°-banen:</b> sammenlign utsikten med det kjente bildet. Denne rullebanen ser annerledes ut fra riktig høyde, og den forskjellen er det som drar øynene dine bort fra banen.'); }
  else { const R=row();
    if(S.mode==='leans'){ t= R.t<0.5? t2('<b>Press Play.</b> In cloud, the aircraft starts a slow roll to the right. Watch both spheres.','<b>Trykk Spill av.</b> I sky starter flyet en sakte rull til høyre. Følg med på begge kulene.')
      : R.phase==='roll'? (Math.abs(R.felt)<0.5? t2(`<b>The aircraft is rolling right at ${nf(S.rate,1)} °/s, and you feel nothing.</b> The canal signal is below the threshold of about 2 °/s.`,`<b>Flyet ruller til høyre med ${nf(S.rate,1)} °/s, og du kjenner ingenting.</b> Buesignalet er under terskelen på rundt 2 °/s.`):t2('<b>This roll is fast enough to feel</b>, at least at the start. Then the signal fades.','<b>Denne rullen er rask nok til å kjennes</b>, i det minste i starten. Så blekner signalet.'))
      : R.phase==='hold'? t2(`<b>Banked ${bankTxt(R.real)}, and you feel level.</b> Then you look at the attitude indicator…`,`<b>Krenget ${bankTxt(R.real)}, og du føler deg vannrett.</b> Så ser du på holdningsindikatoren …`)
      : Math.abs(R.felt)>3? t2(`<b>The leans:</b> you rolled level briskly. That roll was felt, the first one was not, so now the wings are level and you feel ${bankTxt(R.felt)}. You want to lean, or roll back. Believe the attitude indicator: the feeling fades.`,`<b>The leans:</b> du rullet vannrett med et bestemt rull. Den rullen kjentes, den første gjorde ikke det, så nå er vingene vannrette og du føler ${bankTxt(R.felt)}. Du vil lene deg, eller rulle tilbake. Tro på holdningsindikatoren: følelsen går over.`)
      : t2('<b>The false feeling has faded.</b> Feel and reality agree again.','<b>Den falske følelsen har gått over.</b> Følelse og virkelighet stemmer igjen.'); }
    else if(S.mode==='spiral'){ t= R.phase==='in'? t2('<b>Rolling into a 25° turn to the right.</b> The roll in is quick enough to feel.','<b>Ruller inn i en 25° sving til høyre.</b> Innrullingen er rask nok til å kjennes.')
      : R.phase==='turn'? t2('<b>A steady turn:</b> the canals stop signalling after 10–20 s, and the seat pushes straight up through you as in level flight. You feel wings level and no turn.','<b>En jevn sving:</b> buegangene slutter å signalisere etter 10–20 s, og setet presser rett opp gjennom deg som i planflyging. Du føler vingene vannrette og ingen sving.')
      : S.by==='feel'? t2(`<b>Flying by feel:</b> after the roll-out you feel a turn to the left, so you roll back into the right turn, which then feels level. The bank creeps on, the nose drops, and pulling back only tightens the spiral. Height ${ft(R.alt)}.`,`<b>Flyr etter følelsen:</b> etter utrullingen kjenner du en sving til venstre, så du ruller tilbake inn i høyresvingen, som da føles vannrett. Krengningen øker, nesen faller, og å trekke stikka bare strammer spiralen. Høyde ${ft(R.alt)}.`)
      : t2('<b>Flying by instruments:</b> you feel a turn the other way after the roll-out, but you keep the wings level on the attitude indicator and the height holds. The feeling fades.','<b>Flyr etter instrumentene:</b> du kjenner en sving den andre veien etter utrullingen, men du holder vingene vannrette på holdningsindikatoren og høyden holder. Følelsen går over.'); }
    else { t= R.t<1? t2('<b>A night go-around from 1 000 ft.</b> Press Play: go-around power, pitch 15°.','<b>En avbrutt landing om natten fra 1 000 ft.</b> Trykk Spill av: full kraft, pitch 15°.')
      : R.crashed? t2('<b>Flying by feel the aircraft flew into the ground</b>, with the pilot feeling a climb the whole way. This is the somatogravic illusion behind several night go-around and take-off accidents.','<b>Etter følelsen fløy flyet i bakken</b>, mens piloten hele tiden kjente en stigning. Dette er den somatogravale illusjonen bak flere ulykker ved avbrutt landing og start om natten.')
      : S.by==='feel'? t2(`<b>The acceleration feels like extra nose-up.</b> You feel ${pitchTxt(R.felt)} and lower the nose to "fix" it, which makes you accelerate more, which feels like even more nose-up. Real pitch: ${pitchTxt(R.real)}.`,`<b>Akselerasjonen kjennes som ekstra nese opp.</b> Du kjenner ${pitchTxt(R.felt)} og senker nesen for å «rette» det, noe som gir mer akselerasjon, som kjennes som enda mer nese opp. Virkelig pitch: ${pitchTxt(R.real)}.`)
      : t2(`<b>The acceleration feels like extra nose-up</b> (felt ${pitchTxt(R.felt)}, real ${pitchTxt(R.real)}), but you hold 15° on the attitude indicator and crosscheck the VSI and altimeter: climbing.`,`<b>Akselerasjonen kjennes som ekstra nese opp</b> (følt ${pitchTxt(R.felt)}, virkelig ${pitchTxt(R.real)}), men du holder 15° på holdningsindikatoren og kryssjekker VSI og høydemåler: stiger.`); } }
  el('xsee').innerHTML=L(t); }

/* ---------------- tabs ---------------- */
const VIEWS=[['leans',t2('The leans','The leans')],['spiral',t2('Graveyard spiral','Dødsspiral')],['soma',t2('False climb (go-around)','Falsk stigning (avbrutt landing)')],['app',t2('Approach illusions','Illusjoner på innflyging')]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t])=>`<button type="button" role="tab" data-v="${k}" class="${k===S.mode?'on':''}" aria-selected="${k===S.mode}">${L(t)}</button>`).join(''); }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.v); });
function setMode(m){ if(!VIEWS.some(v=>v[0]===m)) m='leans'; if(m!==S.mode){ S.t=0; stop(); }
  S.mode=m; el('xpanel').querySelectorAll('[data-pv]').forEach(d=>{ d.hidden=!d.dataset.pv.split(' ').includes(m); }); el('vplay').hidden=m==='app';
  resim(); syncCtl(); drawTabs(); drawPre(); upd(); }

/* ---------------- controls ---------------- */
LAB.add({},{'Roll rate':'Rullrate','Bank reached':'Krengning','Time in the turn':'Tid i svingen','Go-around acceleration (excess thrust)':'Akselerasjon (overskuddskraft)','Runway slope':'Rullebanehelling','Runway width':'Rullebanebredde','Distance to the threshold':'Avstand til terskelen',
 'Instruments':'Instrumentene','Feel':'Følelsen','Lit ground':'Opplyst bakke','Black hole':'Svart hull','By eye':'Etter øyet','PAPI / ILS':'PAPI / ILS'});
const sl={};
const chg=()=>{ resim(); upd(); };
sl.rate=LAB.slider(el('leCtl'),{label:'Roll rate',min:0.5,max:6,step:0.5,v:S.rate,f:v=>nf(v,1)+' °/s',on:v=>{ S.rate=v; S.t=0; chg(); }});
sl.bank=LAB.slider(el('leCtl'),{label:'Bank reached',min:10,max:30,step:5,v:S.bank,f:v=>v+'°',on:v=>{ S.bank=v; S.t=0; chg(); }});
sl.turn=LAB.slider(el('spCtl'),{label:'Time in the turn',min:10,max:60,step:5,v:S.turn,f:v=>v+' s',on:v=>{ S.turn=v; S.t=0; chg(); }});
sl.acc=LAB.slider(el('soCtl'),{label:'Go-around acceleration (excess thrust)',min:0.1,max:0.4,step:0.05,v:S.acc,f:v=>nf(v,2)+' g',on:v=>{ S.acc=v; S.t=0; chg(); }});
const bySeg=LAB.seg(el('bySeg'),[['inst','Instruments'],['feel','Feel']],S.by,v=>{ S.by=v; chg(); });
sl.slope=LAB.slider(el('rwCtl'),{label:'Runway slope',min:-3,max:3,step:0.5,v:S.slope,f:v=>(v>0?'+':v<0?'−':'')+nf(Math.abs(v),1)+' %',on:v=>{ S.slope=v; upd(); }});
sl.width=LAB.slider(el('rwCtl'),{label:'Runway width',min:20,max:60,step:5,v:S.width,f:v=>v+' m',on:v=>{ S.width=v; upd(); }});
const nightSeg=LAB.seg(el('nightSeg'),[['lit','Lit ground'],['bh','Black hole']],S.night,v=>{ S.night=v; upd(); });
const apSeg=LAB.seg(el('apSeg'),[['eye','By eye'],['papi','PAPI / ILS']],S.path,v=>{ S.path=v; upd(); });
sl.dist=LAB.slider(el('apCtl'),{label:'Distance to the threshold',min:0.5,max:7,step:0.1,v:S.dist,f:v=>nf(v,1)+' NM',on:v=>{ S.dist=v; upd(); }});
function syncCtl(){ sl.rate.set(S.rate); sl.bank.set(S.bank); sl.turn.set(S.turn); sl.acc.set(S.acc); bySeg.set(S.by); sl.slope.set(S.slope); sl.width.set(S.width); nightSeg.set(S.night); apSeg.set(S.path); sl.dist.set(S.dist); }

/* scenarios per mode */
const SCN={
 leans:[[t2('Slow roll, 1 °/s','Sakte rull, 1 °/s'),{rate:1,bank:20}],[t2('Brisk roll, 5 °/s','Rask rull, 5 °/s'),{rate:5,bank:20}],[t2('Very slow, 0.5 °/s to 30°','Svært sakte, 0,5 °/s til 30°'),{rate:0.5,bank:30}]],
 spiral:[[t2('Long turn, fly by instruments','Lang sving, fly etter instrumentene'),{turn:40,by:'inst'}],[t2('Long turn, fly by feel','Lang sving, fly etter følelsen'),{turn:40,by:'feel'}],[t2('Short turn, 10 s','Kort sving, 10 s'),{turn:10,by:'inst'}]],
 soma:[[t2('Night go-around, instruments','Avbrutt landing om natten, instrumenter'),{acc:0.3,by:'inst'}],[t2('Night go-around, by feel','Avbrutt landing om natten, etter følelsen'),{acc:0.3,by:'feel'}],[t2('Gentle go-around, by feel','Rolig avbrutt landing, etter følelsen'),{acc:0.15,by:'feel'}]],
 app:[[t2('Normal runway','Vanlig rullebane'),{slope:0,width:45,night:'lit',path:'eye'}],[t2('Narrow runway, 30 m','Smal rullebane, 30 m'),{slope:0,width:30,night:'lit',path:'eye'}],[t2('Upslope 2 %','Oppoverbakke 2 %'),{slope:2,width:45,night:'lit',path:'eye'}],[t2('Wide and downslope','Bred og nedoverbakke'),{slope:-2,width:60,night:'lit',path:'eye'}],[t2('Black hole','Svart hull'),{slope:0,width:45,night:'bh',path:'eye',dist:4.5}]]};
function drawPre(){ el('pre').innerHTML=(SCN[S.mode]||[]).map(([t],i)=>`<button type="button" class="btn" data-s="${i}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setS(Object.assign({mode:S.mode},SCN[S.mode][+b.dataset.s][1]),S.mode!=='app'); });
function setS(o,autoplay){ if(!o) return; const {mode,...r}=o; if(mode&&mode!==S.mode) setMode(mode); Object.assign(S,r); S.t=0; stop(); resim(); syncCtl(); upd(); if(autoplay) play(); }

/* ---------------- time ---------------- */
let raf=0, last=0;
function setPlayBtn(){ el('play').textContent=L(S.playing?t2('Pause','Pause'):S.t>=simT()-0.01&&SIM?t2('Play again','Spill av igjen'):t2('Play','Spill av')); }
function play(){ if(!SIM) return; if(S.t>=simT()-0.01) S.t=0; S.playing=true; setPlayBtn(); if(reduce){ S.t=simT(); S.playing=false; upd(); return; } last=performance.now(); if(!raf) raf=requestAnimationFrame(tick); }
function stop(){ S.playing=false; if(raf){ cancelAnimationFrame(raf); raf=0; } setPlayBtn(); }
function tick(now){ raf=0; const dt=Math.min(0.1,(now-last)/1000); last=now; if(!S.playing||!SIM) return;
  S.t=Math.min(simT(),S.t+dt*SPEED[S.mode]);
  if(S.t>=simT()){ S.playing=false; } upd(); if(S.playing) raf=requestAnimationFrame(tick); }
el('play').onclick=()=>{ if(S.playing) stop(); else play(); };
el('restart').onclick=()=>{ S.t=0; stop(); upd(); };
el('scrub').addEventListener('input',e=>{ stop(); S.t=simT()*(+e.target.value)/1000; upd(); });
function upd(){ if(SIM){ el('scrub').value=String(Math.round(S.t/simT()*1000)); el('tOut').textContent=nf(S.t,0)+' / '+nf(simT(),0)+' s'; setPlayBtn(); } readout(); legend(); see(); draw(); }

/* ---------------- Try it: one task at a time ---------------- */
let ti=0; const ansv={}, done={};
const goModel=()=>{ const t=el('orVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const NUM=(lab,v,tol)=>({lab,v,tol});
const feltInRoll=()=>SIM&&S.mode==='leans'?Math.max(...SIM.rows.filter(r=>r.t<=SIM.tIn+0.5).map(r=>Math.abs(r.felt))):0;
const TASKS=[
 {k:'thr',q:t2('Find the fastest roll the inner ear misses: set the roll rate as high as you can while the roll still goes unfelt (the violet sphere stays level during the roll). Then press Check.','Finn den raskeste rullen det indre øret ikke merker: sett rullraten så høyt du kan mens rullen fortsatt ikke kjennes (den fiolette kula holder seg vannrett under rullen). Trykk så Sjekk.'),
  live:()=>{ if(S.mode!=='leans') return [0,t2('Open "The leans".','Åpne «The leans».')]; const f=feltInRoll(); if(f>0.5) return [0,t2(`At ${nf(S.rate,1)} °/s the roll is felt (${nf(f,0)}°). Go slower.`,`Med ${nf(S.rate,1)} °/s kjennes rullen (${nf(f,0)}°). Gå saktere.`)];
    if(S.rate<2) return [0,t2(`${nf(S.rate,1)} °/s goes unfelt. Can you go faster and still fool the ear?`,`${nf(S.rate,1)} °/s kjennes ikke. Klarer du å gå raskere og fortsatt lure øret?`)];
    return [1,t2('Yes: about 2 °/s, the typical threshold. A slower roll, in cloud or on a dark night, is not felt at all.','Ja: rundt 2 °/s, den typiske terskelen. En saktere rull, i sky eller en mørk natt, kjennes ikke i det hele tatt.')]; },pre:{mode:'leans',rate:3,bank:20}},
 {k:'leans',q:t2('In cloud, the aircraft has rolled slowly to 20° right bank without you noticing. You see it on the attitude indicator and roll level briskly. What do you feel now?','I sky har flyet rullet sakte til 20° krengning til høyre uten at du merket det. Du ser det på holdningsindikatoren og ruller raskt vannrett. Hva kjenner du nå?'),
  opts:[t2('Banked to the left, so you want to lean right','Krenget til venstre, så du vil lene deg til høyre'),t2('Wings level','Vingene vannrette'),t2('Still banked to the right','Fortsatt krenget til høyre'),t2('A climb','En stigning')],c:0,pre:{mode:'leans',rate:1,bank:20},
  e:t2('Only the quick roll back was felt, so your inner ear says you went from level to left bank. Believe the attitude indicator: the feeling fades within a minute or so.','Bare den raske rullen tilbake ble kjent, så det indre øret sier at du gikk fra vannrett til venstre krengning. Tro på holdningsindikatoren: følelsen går over i løpet av et minutt eller så.')},
 {k:'turn',q:t2('After 40 s in a steady, coordinated turn in cloud, what does your body tell you?','Etter 40 s i en jevn, koordinert sving i sky, hva sier kroppen deg?'),
  opts:[t2('Wings level, not turning','Vingene vannrette, ingen sving'),t2('Turning, banked','Svinger, krenget'),t2('Turning the other way','Svinger den andre veien'),t2('Climbing','Stiger')],c:0,pre:{mode:'spiral',turn:40,by:'inst'},
  e:t2('The canals stop signalling after 10–20 s, and in a coordinated turn the seat pushes straight up through you. Nothing feels different from level flight.','Buegangene slutter å signalisere etter 10–20 s, og i en koordinert sving presser setet rett opp gjennom deg. Ingenting kjennes annerledes enn planflyging.')},
 {k:'spiral',q:t2('Make the long turn harmless: choose what the pilot flies by so the height holds after the roll-out, play it to the end, then press Check.','Gjør den lange svingen ufarlig: velg hva piloten flyr etter så høyden holder etter utrullingen, spill av til slutten, og trykk Sjekk.'),
  live:()=>{ if(S.mode!=='spiral') return [0,t2('Open "Graveyard spiral".','Åpne «Dødsspiral».')]; if(S.t<simT()-1) return [0,t2('Play it to the end first.','Spill av til slutten først.')];
    const R=row(); if(S.by==='feel') return [0,t2(`Flying by feel you lost ${ft(4000-R.alt)}, and the bank is ${bankTxt(R.real)}. Try the other choice.`,`Etter følelsen mistet du ${ft(4000-R.alt)}, og krengningen er ${bankTxt(R.real)}. Prøv det andre valget.`)];
    return [1,t2('Yes: on instruments the wings stay level and the height holds, even though you feel a turn the other way for a while.','Ja: på instrumentene holder vingene seg vannrette og høyden holder, selv om du kjenner en sving den andre veien en stund.')]; },pre:{mode:'spiral',turn:40,by:'feel'}},
 {k:'soma',q:t2('A go-around accelerates you forward at 0.25 g. About how many degrees of false nose-up does that add to what you feel?','En avbrutt landing akselererer deg fremover med 0,25 g. Omtrent hvor mange grader falsk nese opp legger det til det du kjenner?'),
  ins:[NUM(t2('False nose-up (°)','Falsk nese opp (°)'),14,1.6)],pre:{mode:'soma',acc:0.3,by:'inst'},
  e:t2('The otoliths feel the sum of gravity and the acceleration, tilted back by atan(0.25) ≈ 14°. The same thing as tilting your head back 14°.','Otolittene kjenner summen av tyngdekraften og akselerasjonen, vippet bakover atan(0,25) ≈ 14°. Det samme som å vippe hodet bakover 14°.')},
 {k:'ga',q:t2('Night go-around over dark water. You feel a very steep climb. The attitude indicator shows 15° nose-up. What do you do?','Avbrutt landing om natten over mørkt vann. Du kjenner en svært bratt stigning. Holdningsindikatoren viser 15° nese opp. Hva gjør du?'),
  opts:[t2('Hold 15° on the attitude indicator and crosscheck VSI and altimeter','Hold 15° på holdningsindikatoren og kryssjekk VSI og høydemåler'),t2('Lower the nose until it feels right','Senk nesen til det kjennes riktig'),t2('Look outside for the horizon','Se ut etter horisonten'),t2('Reduce power to stop the acceleration','Reduser kraften for å stoppe akselerasjonen')],c:0,pre:{mode:'soma',acc:0.3,by:'feel'},
  e:t2('The steep climb is the acceleration. Lowering the nose to match the feeling adds more acceleration and more illusion. Press Play on "by feel" to see where that ends.','Den bratte stigningen er akselerasjonen. Senker du nesen for å stemme med følelsen, gir det mer akselerasjon og mer illusjon. Trykk Spill av på «etter følelsen» for å se hvor det ender.')},
 {k:'narrow',q:t2('You approach a runway much narrower than the ones you are used to. Flying by eye, you are likely to be…','Du flyr inn mot en rullebane mye smalere enn de du er vant med. Etter øyet vil du sannsynligvis være …'),
  opts:[t2('Lower than the glide path','Lavere enn glidebanen'),t2('Higher than the glide path','Høyere enn glidebanen'),t2('On the glide path','På glidebanen'),t2('Off to one side','Ute til en side')],c:0,pre:{mode:'app',slope:0,width:30,night:'lit',path:'eye',dist:2},
  e:t2('A narrow runway looks longer and steeper, as if you were high, so you descend below the path. A wide runway does the opposite.','En smal rullebane ser lengre og brattere ut, som om du var høy, så du synker under banen. En bred rullebane gjør det motsatte.')},
 {k:'papi',q:t2('Upslope 2 %, a 30 m runway, flying by eye at 2 NM. What does the PAPI show?','Oppoverbakke 2 %, en 30 m rullebane, etter øyet på 2 NM. Hva viser PAPI?'),
  opts:[t2('4 red','4 røde'),t2('2 white, 2 red','2 hvite, 2 røde'),t2('4 white','4 hvite'),t2('3 white, 1 red','3 hvite, 1 rød')],c:0,pre:{mode:'app',slope:2,width:30,night:'lit',path:'eye',dist:2},
  e:t2('Both illusions say "you are high", so your eyes fly a path under 1°. The PAPI shows four red: far too low. Believe the lights.','Begge illusjonene sier «du er høy», så øynene dine flyr en bane under 1°. PAPI viser fire røde: altfor lavt. Tro på lysene.')},
 {k:'bh',dp:1,q:t2('A dark night, the runway on the shore with only water and unlit ground before it. What is the typical trap?','En mørk natt, rullebanen ved sjøen med bare vann og mørk mark foran. Hva er den typiske fella?'),
  opts:[t2('You feel high and descend too early, ending low several miles out','Du føler deg høy og synker for tidlig, og blir lav flere mil ute'),t2('You feel low and stay high','Du føler deg lav og blir liggende høyt'),t2('You overshoot the centreline','Du skyter over senterlinjen'),t2('Nothing: the runway lights are enough','Ingenting: rullebanelysene er nok')],c:0,pre:{mode:'app',slope:0,width:45,night:'bh',path:'eye',dist:4.5},
  e:t2('Without lights or terrain in front, you have only the runway lights to judge by, and the typical result is a path that sags low, often into terrain or water short of the runway. Use the ILS, the PAPI or a planned constant-angle descent.','Uten lys eller terreng foran har du bare rullebanelysene å bedømme etter, og det typiske resultatet er en bane som henger lavt, ofte inn i terreng eller vann før rullebanen. Bruk ILS, PAPI eller en planlagt nedstigning med fast vinkel.')}];
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
  if(b.dataset.go){ setS(t.pre,false); goModel(); return; }
  if(b.dataset.o!=null){ ansv[t.k]=+b.dataset.o; drawTask(); return; }
  if(b.dataset.chk){ if(t.live){ done[t.k]=t.live(); drawTask(); return; }
    const a=ansv[t.k]||[]; done[t.k]=t.ins.every((x,j)=>a[j]!=null&&a[j]!==''&&Math.abs(parseFloat(String(a[j]).replace(',','.').replace(/\s/g,''))-x.v)<=x.tol)?1:2; drawTask(); } });

/* ---------------- Understand: key concept cards ---------------- */
const {sv,tx,ar}=KCS;
const go=o=>({click:()=>setS(o,o.mode!=='app'),to:'#orVp'});
const ball=(x,bank,felt)=>{ const r=20, q=-bank*D2R, c=Math.cos(q), s=Math.sin(q); return `<clipPath id="cb${x}${felt?1:0}"><circle cx="${x}" cy="32" r="${r}"/></clipPath><g clip-path="url(#cb${x}${felt?1:0})"><rect x="${x-r}" y="${32-r}" width="${2*r}" height="${2*r}" fill="${felt?'#5e4766':'#7a5230'}"/><path d="M${x-30*c},${32-30*s} L${x+30*c},${32+30*s} L${x+30*c-40*s},${32+30*s-40*c} L${x-30*c-40*s},${32-30*s-40*c}Z" fill="${felt?'#5b5a92':'#3d7fb8'}"/></g><circle cx="${x}" cy="32" r="${r}" fill="none" stroke="${felt?'#c9b6f2':'#6f7e8b'}" ${felt?'stroke-dasharray="3 2"':''}/><path d="M${x-9},32 h6 M${x+3},32 h6" stroke="${felt?'#c9b6f2':'#f0c470'}" stroke-width="2"/>`; };
const KC=[
 Object.assign({k:'eyes',t:t2('Your eyes do most of the work','Øynene gjør mesteparten'),d:t2('Typically up to 90 % of your sense of orientation comes from <b>vision</b>. Lose the horizon, in cloud or on a dark night, and the inner ear and the "seat of the pants" take over. Both can be fooled.','Typisk kommer opptil 90 % av orienteringssansen fra <b>synet</b>. Mister du horisonten, i sky eller en mørk natt, tar det indre øret og «baken» over. Begge kan lures.'),
  ill:()=>sv(`<ellipse cx="44" cy="32" rx="22" ry="13" fill="none" stroke="#eef3f7"/><circle cx="44" cy="32" r="7" fill="#7fcbe8"/><line x1="90" y1="34" x2="190" y2="34" stroke="#7fcbe8"/>${tx(140,26,'horizon','#7fcbe8','middle',8)}${tx(140,52,'90 %','#f0c470','middle',10)}`)},go({mode:'leans',rate:1,bank:20})),
 Object.assign({k:'canal',t:t2('The canals miss slow rotation','Buegangene merker ikke sakte rotasjon'),d:t2('The semicircular canals feel <b>rotation</b>, but not below about <b>2 °/s</b> (typical), and a steady rotation fades from awareness in 10–20 s.','Buegangene kjenner <b>rotasjon</b>, men ikke under rundt <b>2 °/s</b> (typisk), og en jevn rotasjon forsvinner fra bevisstheten på 10–20 s.'),
  dd:t2('The fluid in the canals lags the head at the start of a rotation, bends a small gate (the cupula) and you feel it. In a steady rotation the fluid catches up and the signal stops.','Væsken i buegangene henger etter hodet i starten av en rotasjon, bøyer en liten port (cupula) og du kjenner det. I en jevn rotasjon tar væsken igjen, og signalet stopper.'),
  ill:()=>sv(`<circle cx="40" cy="32" r="18" fill="none" stroke="#c9b6f2" stroke-width="3"/><circle cx="40" cy="32" r="18" fill="none" stroke="#7fcbe8" stroke-width="1" stroke-dasharray="3 3"/>${ar(70,32,100,32,'#eef3f7')}${tx(150,28,'< 2 °/s','#c9b6f2','middle',10)}${tx(150,44,'not felt','#8b99a7','middle',8)}`)},go({mode:'leans',rate:1,bank:20})),
 Object.assign({k:'oto',t:t2('Tilt or acceleration?','Helling eller akselerasjon?'),d:t2('The otoliths feel <b>gravity and linear acceleration together</b> and cannot tell them apart. Accelerating forward feels like tilting back.','Otolittene kjenner <b>tyngdekraft og lineær akselerasjon sammen</b> og kan ikke skille dem. Å akselerere fremover kjennes som å vippe bakover.'),
  ill:()=>sv(`${ar(40,10,40,50,'#8b99a7')}${ar(40,50,80,50,'#f0c470')}${ar(40,10,80,50,'#c9b6f2',2)}${tx(30,30,'g','#8b99a7','end',9)}${tx(60,62,'a','#f0c470','middle',9)}${tx(120,30,'feels like','#8b99a7','start',8)}${tx(120,44,'nose up','#c9b6f2','start',9)}`)},go({mode:'soma',acc:0.3,by:'inst'})),
 Object.assign({k:'leans',t:t2('The leans','The leans'),d:t2('A slow, unfelt roll, then a brisk correction: now the wings are level but you <b>feel banked the other way</b>. The most common illusion.','En sakte rull du ikke merker, så en rask korreksjon: nå er vingene vannrette, men du <b>føler deg krenget den andre veien</b>. Den vanligste illusjonen.'),
  ill:()=>sv(`${ball(55,0,false)}${ball(145,-15,true)}${tx(55,62,'real','#8b99a7','middle',7.5)}${tx(145,62,'felt','#c9b6f2','middle',7.5)}`)},go({mode:'leans',rate:1,bank:20})),
 Object.assign({k:'spiral',t:t2('Graveyard spiral','Dødsspiral'),d:t2('In a long turn you feel level. Roll out and you feel a turn the other way, so you roll back in. The nose drops, and pulling back only <b>tightens the spiral</b>.','I en lang sving føler du deg vannrett. Ruller du ut, kjenner du en sving den andre veien, så du ruller inn igjen. Nesen faller, og å trekke stikka <b>strammer spiralen</b>.'),
  dd:t2('The graveyard spin is the same trap after a spin: on recovery you feel a spin the other way and re-enter the original one.','Dødsspinnet er den samme fella etter et spinn: når du retter ut, kjenner du et spinn den andre veien og går inn i det opprinnelige igjen.'),
  ill:()=>sv(`<path d="M30,12 C150,12 150,40 100,40 C60,40 70,26 100,26 C120,26 118,52 90,58" fill="none" stroke="#ec5a47" stroke-width="2"/>${tx(160,58,'height ↓','#f0c470','middle',8)}`)},go({mode:'spiral',turn:40,by:'feel'})),
 Object.assign({k:'soma',t:t2('False climb on a go-around','Falsk stigning ved avbrutt landing'),d:t2('Accelerating feels like <b>pitching up</b> (somatogravic illusion). At night or in cloud after take-off or a go-around, the urge to push the nose down can fly you into the ground.','Akselerasjon kjennes som å <b>stige</b> (somatograval illusjon). Om natten eller i sky etter start eller avbrutt landing kan trangen til å skyve nesen ned fly deg i bakken.'),
  dd:t2('Deceleration does the opposite: it feels like pitching down, and the urge is to pull up.','Retardasjon gjør det motsatte: det kjennes som nese ned, og trangen er å trekke opp.'),
  ill:()=>sv(`<line x1="10" y1="54" x2="190" y2="54" stroke="#34493b" stroke-width="3"/><path d="M20,44 L90,30" stroke="#c9b6f2" stroke-dasharray="4 3"/><path d="M20,44 L80,40 L130,52" stroke="#eef3f7" stroke-width="2"/>${tx(96,26,'felt','#c9b6f2','start',8)}${tx(136,48,'real','#ec5a47','start',8)}`)},go({mode:'soma',acc:0.3,by:'feel'})),
 Object.assign({k:'cor',dp:1,t:t2('Coriolis: never move your head in a turn','Coriolis: ikke beveg hodet i en sving'),d:t2('A quick head movement during a turn (looking down for a chart, back for a switch) stimulates two canals at once. The result is a <b>violent tumbling</b> sensation, the most disorienting of all.','En rask hodebevegelse i en sving (ned etter et kart, bak etter en bryter) stimulerer to buer samtidig. Resultatet er en <b>voldsom tumlefølelse</b>, den mest desorienterende av alle.'),
  ill:()=>sv(`<circle cx="60" cy="30" r="14" fill="none" stroke="#eef3f7"/>${ar(40,52,80,52,'#8b99a7')}${ar(60,10,60,26,'#f0c470')}<path d="M120,20 q20,-10 30,10 q10,20 -10,24 q-20,4 -16,-14" fill="none" stroke="#ec5a47" stroke-width="2"/>`)}),
 Object.assign({k:'rwy',t:t2('Runway slope and width','Rullebanens helling og bredde'),d:t2('An <b>upslope or narrow</b> runway looks as if you are high: you fly low. A <b>downslope or wide</b> runway looks as if you are low: you fly high.','En rullebane i <b>oppoverbakke eller smal</b> ser ut som om du er høy: du flyr lavt. En <b>nedoverbakke eller bred</b> rullebane ser ut som om du er lav: du flyr høyt.'),
  ill:()=>sv(`<path d="M60,58 L80,14 L92,14 L100,58Z" fill="#2a2d31" stroke="#eef3f7"/><path d="M130,58 L148,30 L166,30 L190,58Z" fill="#2a2d31" stroke="#eef3f7"/>${tx(80,10,'narrow: low','#ec5a47','middle',7.5)}${tx(160,24,'wide: high','#f0c470','middle',7.5)}`)},go({mode:'app',slope:0,width:30,night:'lit',path:'eye',dist:2})),
 Object.assign({k:'bh',t:t2('Black hole and featureless terrain','Svart hull og terreng uten detaljer'),d:t2('Over dark water, unlit ground, snow or calm sea there is nothing to judge height by. You tend to <b>feel high and fly low</b>.','Over mørkt vann, mørk mark, snø eller blankt hav finnes ingenting å bedømme høyden etter. Du har en tendens til å <b>føle deg høy og fly lavt</b>.'),
  ill:()=>sv(`<rect x="0" y="0" width="200" height="64" fill="#030405"/><path d="M150,40 L170,40 L186,54 L134,54Z" fill="#16181b" stroke="#ffe8b0" stroke-width=".8"/><path d="M10,10 C60,30 90,52 150,46" fill="none" stroke="#c9b6f2" stroke-width="1.6"/><path d="M10,10 L150,46" stroke="#71cc93" stroke-dasharray="4 3"/>`)},go({mode:'app',slope:0,width:45,night:'bh',path:'eye',dist:4.5})),
 Object.assign({k:'cure',t:t2('The cure: fly the instruments','Kuren: fly instrumentene'),d:t2('<b>Believe the attitude indicator</b>, keep a steady scan and crosscheck (altimeter, VSI, heading). Avoid quick head movements. If in doubt, wings level on the AI, and in a crew, hand over control.','<b>Tro på holdningsindikatoren</b>, hold et jevnt scan og kryssjekk (høydemåler, VSI, kurs). Unngå raske hodebevegelser. Er du i tvil, vingene vannrett på AI, og i en besetning, gi fra deg kontrollen.'),
  ill:()=>sv(`${ball(50,0,false)}${tx(90,26,'AI · ALT · VSI','#f0c470','start',9)}${tx(90,42,'scan, crosscheck','#8b99a7','start',8)}`)},go({mode:'spiral',turn:40,by:'inst'}))];
KCS.render(el('kcGrid'),KC);

/* ---------------- deep-dive folds ---------------- */
const P=s=>`<p>${s}</p>`;
const tab=(rows)=>`<div class="wrapx"><table class="ftab">${rows.map((r,j)=>`<tr>${r.map(c=>j?`<td>${L(c)}</td>`:`<th>${L(c)}</th>`).join('')}</tr>`).join('')}</table></div>`;
const VEST=[[t2('Illusion','Illusjon'),t2('What happens','Hva skjer'),t2('What you feel','Hva du kjenner'),t2('The danger','Faren')],
 [t2('The leans','The leans'),t2('Slow unfelt roll, then a brisk correction','Sakte rull som ikke kjennes, så en rask korreksjon'),t2('Banked the other way','Krenget den andre veien'),t2('Rolling back into the bank','Ruller tilbake inn i krengningen')],
 [t2('Graveyard spiral','Dødsspiral'),t2('Long coordinated turn, then roll-out','Lang koordinert sving, så utrulling'),t2('Level in the turn; turning the other way after','Vannrett i svingen; svinger andre veien etterpå'),t2('Steepening descending spiral','Brattere og brattere synkende spiral')],
 [t2('Graveyard spin','Dødsspinn'),t2('Recovery from a prolonged spin','Utretting fra et langt spinn'),t2('Spinning the other way','Spinner den andre veien'),t2('Re-entering the spin','Går inn i spinnet igjen')],
 [t2('Coriolis','Coriolis'),t2('Head movement during a turn','Hodebevegelse i en sving'),t2('Tumbling','Tumling'),t2('Total loss of orientation','Fullstendig tap av orientering')],
 [t2('Somatogravic','Somatograval'),t2('Forward acceleration (take-off, go-around)','Akselerasjon fremover (start, avbrutt landing)'),t2('Nose-up','Nese opp'),t2('Pushing into the ground','Skyver flyet i bakken')],
 [t2('Somatogravic (deceleration)','Somatograval (retardasjon)'),t2('Power off, speed brakes, flaps','Kraft av, luftbremser, klaff'),t2('Nose-down','Nese ned'),t2('Pulling up towards a stall','Trekker opp mot stall')],
 [t2('Inversion','Inversjon'),t2('Abrupt change from climb to level','Brå overgang fra stigning til planflyging'),t2('Tumbling backwards','Tumle bakover'),t2('Pushing the nose down hard','Skyver nesen kraftig ned')],
 [t2('Elevator','Heis'),t2('Updraft or downdraft','Oppvind eller nedvind'),t2('Climbing or descending','Stiger eller synker'),t2('Pitching to fight a movement that is not there','Pitcher for å motvirke en bevegelse som ikke finnes')]];
const VIS=[[t2('Situation','Situasjon'),t2('Looks like','Ser ut som'),t2('By eye you fly','Etter øyet flyr du')],
 [t2('Upslope runway','Rullebane i oppoverbakke'),t2('too high','for høyt'),t2('low','lavt')],[t2('Downslope runway','Rullebane i nedoverbakke'),t2('too low','for lavt'),t2('high','høyt')],
 [t2('Narrow runway','Smal rullebane'),t2('too high','for høyt'),t2('low','lavt')],[t2('Wide runway','Bred rullebane'),t2('too low','for lavt'),t2('high','høyt')],
 [t2('Black hole, featureless terrain, water, snow','Svart hull, terreng uten detaljer, vann, snø'),t2('too high','for høyt'),t2('low','lavt')],
 [t2('Rain on the windscreen','Regn på frontruten'),t2('too high','for høyt'),t2('low','lavt')],[t2('Haze','Dis'),t2('farther away','lenger unna'),t2('low (descending early)','lavt (synker for tidlig)')],
 [t2('Bright runway lights','Sterke rullebanelys'),t2('closer','nærmere'),t2('high (descending late)','høyt (synker for sent)')],[t2('Fog: the runway appears suddenly','Tåke: rullebanen dukker plutselig opp'),t2('nose pitching up','nesen går opp'),t2('steep (pushes over)','bratt (skyver nesen ned)')]];
const DD=[
 ['ear',t2('How the inner ear works','Hvordan det indre øret virker'),t2('canals, otoliths and their limits','buer, otolitter og grensene deres'),[
  t2(P('Each inner ear has three <b>semicircular canals</b>, roughly at right angles, one for each axis. They are filled with fluid. When the head starts to rotate, the fluid lags behind, bends a small gate (the cupula) and the nerve fires. In a steady rotation the fluid catches up after 10–20 s and the signal stops. When the rotation stops, the fluid keeps moving: you feel a rotation the other way.')+P('The <b>otoliths</b> (utricle and saccule) are small crystals on a gel bed. They sag with gravity and lag with linear acceleration, so they measure the sum of both: the "felt down" is the direction of the total force, not of gravity. In a coordinated turn the total force is straight through the seat, so a turn feels like level flight.')+P('Thresholds vary between people and with attention; the figures used here (about 2 °/s, fading in 10–20 s) are typical teaching values.'),
     P('Hvert indre øre har tre <b>buegangene</b>, omtrent vinkelrett på hverandre, én for hver akse. De er fylt med væske. Når hodet begynner å rotere, henger væsken etter, bøyer en liten port (cupula) og nerven fyrer. I en jevn rotasjon tar væsken igjen etter 10–20 s og signalet stopper. Når rotasjonen stopper, fortsetter væsken: du kjenner en rotasjon den andre veien.')+P('<b>Otolittene</b> (utriculus og sacculus) er små krystaller på en geléseng. De synker med tyngdekraften og henger etter ved lineær akselerasjon, så de måler summen av begge: «følt ned» er retningen på den totale kraften, ikke tyngdekraften. I en koordinert sving går den totale kraften rett gjennom setet, så en sving kjennes som planflyging.')+P('Tersklene varierer mellom personer og med oppmerksomhet; tallene her (rundt 2 °/s, borte etter 10–20 s) er typiske undervisningsverdier.'))]],
 ['vest',t2('Vestibular illusions','Vestibulære illusjoner'),t2('the table','tabellen'),['VEST']],
 ['vis',t2('Visual illusions','Synsillusjoner'),t2('approach, landing and night','innflyging, landing og natt'),['VIS',
  t2(P('Other visual traps: a <b>false horizon</b> (a sloping cloud top, a line of lights on a shore, the northern lights) makes you bank to match it. <b>Autokinesis</b>: stare at a single light on a dark night and it seems to move after a few seconds; keep your eyes moving. <b>Flicker vertigo</b>: light flickering at about 4–20 times a second through a propeller or rotor can cause nausea and, rarely, seizures.'),
     P('Andre synsfeller: en <b>falsk horisont</b> (en skrå skytopp, en rekke lys langs en strand, nordlyset) får deg til å krenge for å følge den. <b>Autokinese</b>: stirrer du på ett lys en mørk natt, ser det ut til å bevege seg etter noen sekunder; hold øynene i bevegelse. <b>Flimmersvimmelhet</b>: lys som flimrer rundt 4–20 ganger i sekundet gjennom en propell eller rotor kan gi kvalme og, sjelden, anfall.'))]],
 ['cure',t2('Prevention and recovery','Forebygging og gjenoppretting'),t2('what actually works','det som faktisk virker'),[
  t2(P('<b>Before:</b> get instrument practice and keep it current. Do not fly into cloud or a dark night without the rating and the recency. Brief the visual illusions of the aerodrome (slope, width, dark approach sector) as part of the approach brief.')+P('<b>In flight:</b> go onto instruments early, before you lose the horizon. Keep the scan going; avoid fixating on one instrument. Avoid quick head movements in turns; when you must look down, do it with the wings level. On a night or dark approach, fly the ILS, the PAPI or a planned constant-angle descent, and use the stabilised approach criteria. On a night take-off or go-around, fly the attitude and confirm a positive climb on the altimeter and VSI.')+P('<b>If disoriented:</b> trust the attitude indicator, roll wings level, then fix the pitch, then the power. In a crew, say so and hand over control; the pilot monitoring calls deviations ("bank", "sink rate"). The false sensations can last several minutes.'),
     P('<b>Før:</b> få instrumenttrening og hold den ved like. Ikke fly inn i sky eller en mørk natt uten rettighet og nylig trening. Gå gjennom flyplassens synsillusjoner (helling, bredde, mørk innflygingssektor) som del av innflygingsbriefen.')+P('<b>I lufta:</b> gå over på instrumentene tidlig, før du mister horisonten. Hold scannet i gang; unngå å henge fast i ett instrument. Unngå raske hodebevegelser i svinger; må du se ned, gjør det med vingene vannrett. På en natt- eller mørk innflyging, fly ILS, PAPI eller en planlagt nedstigning med fast vinkel, og bruk kriteriene for stabilisert innflyging. Ved start eller avbrutt landing om natten, fly attityden og bekreft positiv stigning på høydemåler og VSI.')+P('<b>Hvis du er desorientert:</b> tro på holdningsindikatoren, rull vingene vannrett, så pitch, så kraft. I en besetning, si det og gi fra deg kontrollen; den monitorerende piloten melder avvik («bank», «sink rate»). De falske følelsene kan vare flere minutter.'))]],
 ['mot',t2('Motion sickness','Reisesyke'),t2('when the senses disagree','når sansene er uenige'),[
  t2(P('Motion sickness comes from a conflict between what the eyes and the inner ear report. It is common in student pilots and passengers and usually gets better with exposure. Help: fresh air, look at the horizon, keep the head still, keep the flight smooth. Most anti-sickness medicines cause drowsiness and are not compatible with flying as crew; ask an aeromedical examiner.'),
     P('Reisesyke kommer av en konflikt mellom det øynene og det indre øret melder. Det er vanlig hos elever og passasjerer og blir oftest bedre med tilvenning. Hjelp: frisk luft, se på horisonten, hold hodet i ro, fly rolig. De fleste midler mot reisesyke gir døsighet og passer ikke med å fly som besetning; spør en flylege.'))]]];
function drawDD(){ const open=[...document.querySelectorAll('#ddList details[open]')].map(d=>d.id);
  el('ddList').innerHTML=DD.map(([id,t,s,ps])=>`<details class="dfold" id="dd-${id}"><summary>${L(t)} <small>${L(s)}</small></summary><div>${ps.map(p=>p==='VEST'?tab(VEST):p==='VIS'?tab(VIS):L(p)).join('')}</div></details>`).join('');
  open.forEach(i=>{ const d=el(i); if(d) d.open=true; }); }

/* ---------------- Test yourself ---------------- */
function drawTake(){ const TK=[
  t2('<b>Without a horizon, the inner ear takes over</b>, and it is wrong in exactly the situations that kill: cloud, dark nights, take-off and go-around.','<b>Uten horisont tar det indre øret over</b>, og det tar feil i nettopp de situasjonene som dreper: sky, mørke netter, start og avbrutt landing.'),
  t2('<b>Rotation slower than about 2 °/s is not felt</b>, and a steady turn fades in 10–20 s.','<b>Rotasjon saktere enn rundt 2 °/s kjennes ikke</b>, og en jevn sving blekner på 10–20 s.'),
  t2('<b>The leans:</b> after a slow unfelt roll and a brisk correction you feel banked the other way.','<b>The leans:</b> etter en sakte rull som ikke kjennes og en rask korreksjon føler du deg krenget den andre veien.'),
  t2('<b>Graveyard spiral:</b> the long turn feels level; the roll-out feels like a turn the other way. Roll level on the AI and stay there.','<b>Dødsspiral:</b> den lange svingen kjennes vannrett; utrullingen kjennes som en sving den andre veien. Rull vannrett på AI og bli der.'),
  t2('<b>Acceleration feels like pitch-up</b> (and deceleration like pitch-down). On a night take-off or go-around, fly the attitude and check the climb.','<b>Akselerasjon kjennes som nese opp</b> (og retardasjon som nese ned). Ved start eller avbrutt landing om natten, fly attityden og sjekk stigningen.'),
  {dp:1,...t2('<b>Coriolis:</b> no quick head movements in a turn.','<b>Coriolis:</b> ingen raske hodebevegelser i en sving.')},
  t2('<b>Upslope, narrow, black hole, featureless terrain</b>: you feel high and fly low. Downslope and wide: you fly high.','<b>Oppoverbakke, smal, svart hull, terreng uten detaljer</b>: du føler deg høy og flyr lavt. Nedoverbakke og bred: du flyr høyt.'),
  t2('<b>The cure is the same every time:</b> believe the instruments (AI, altimeter, VSI, PAPI, ILS), scan, crosscheck, and in a crew, speak up or hand over.','<b>Kuren er den samme hver gang:</b> tro på instrumentene (AI, høydemåler, VSI, PAPI, ILS), scan, kryssjekk, og i en besetning, si fra eller gi fra deg kontrollen.')];
  el('take').innerHTML=TK.filter(x=>!x.dp||deepOn()).map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.k').textContent=L(t2('Memory aid','Huskeregel'));
  m.querySelector('b').textContent=L(t2('Narrow or upslope: feel high, fly low','Smal eller oppoverbakke: føler deg høy, flyr lavt'));
  m.querySelector('p').textContent=L(t2('The same goes for a black hole, featureless terrain and rain on the windscreen. Wide or downslope does the opposite. On any unfamiliar runway at night, let the PAPI or the ILS decide your height.','Det samme gjelder svart hull, terreng uten detaljer og regn på frontruten. Bred eller nedoverbakke gjør det motsatte. På en ukjent rullebane om natten, la PAPI eller ILS bestemme høyden.')); }

LAB.quiz(el('qbox'),'orientation',()=>LAB.shuffle([
 {q:t2('Which sense gives the most reliable orientation in flight?','Hvilken sans gir den mest pålitelige orienteringen i flyging?'),a:[t2('Vision, outside or on the instruments','Synet, ute eller på instrumentene'),t2('The semicircular canals','Buegangene'),t2('The otoliths','Otolittene'),t2('The seat of the pants','Baken')],c:0,e:t2('Vision dominates. Without an outside horizon it must come from the instruments.','Synet dominerer. Uten horisont ute må det komme fra instrumentene.')},
 {q:t2('A roll slower than about … is typically not felt.','En rull saktere enn rundt … kjennes typisk ikke.'),a:[t2('2 °/s','2 °/s'),t2('10 °/s','10 °/s'),t2('20 °/s','20 °/s'),t2('0.1 °/s','0,1 °/s')],c:0,e:t2('About 2 °/s is the usual teaching figure.','Rundt 2 °/s er det vanlige tallet i undervisningen.')},
 {q:t2('After a slow unnoticed roll to the right and a brisk roll back to wings level, you feel…','Etter en sakte rull til høyre du ikke merket, og en rask rull tilbake til vannrett, kjenner du …'),a:[t2('banked to the left','krenget til venstre'),t2('banked to the right','krenget til høyre'),t2('wings level','vingene vannrette'),t2('a climb','en stigning')],c:0,e:t2('Only the brisk roll back was felt: the leans.','Bare den raske rullen tilbake ble kjent: the leans.')},
 {q:t2('In a graveyard spiral the pilot…','I en dødsspiral …'),a:[t2('feels level in the turn, and pulling back tightens the descending spiral','føler piloten seg vannrett i svingen, og å trekke stikka strammer den synkende spiralen'),t2('feels the turn strongly and overcorrects','kjenner piloten svingen tydelig og overkorrigerer'),t2('feels a steep climb','kjenner piloten en bratt stigning'),t2('feels tumbling','kjenner piloten tumling')],c:0,e:t2('The canals stop signalling in the steady turn; the roll-out feels like a turn the other way.','Buegangene slutter å signalisere i den jevne svingen; utrullingen kjennes som en sving den andre veien.')},
 {q:t2('A strong forward acceleration at night, with no visual horizon, typically feels like…','En kraftig akselerasjon fremover om natten, uten horisont, kjennes typisk som …'),a:[t2('a nose-up pitch','nese opp'),t2('a nose-down pitch','nese ned'),t2('a bank to the right','krengning til høyre'),t2('nothing','ingenting')],c:0,e:t2('The somatogravic illusion: the otoliths cannot tell acceleration from tilt.','Den somatogravale illusjonen: otolittene kan ikke skille akselerasjon fra helling.')},
 {q:t2('A sudden deceleration (power off, speed brakes) without visual references can feel like…','En plutselig retardasjon (kraft av, luftbremser) uten visuelle referanser kan kjennes som …'),a:[t2('pitching down','nese ned'),t2('pitching up','nese opp'),t2('a roll','en rull'),t2('a climb','en stigning')],c:0,e:t2('The opposite of the false climb; the urge is to pull up.','Det motsatte av den falske stigningen; trangen er å trekke opp.')},
 {q:t2('The Coriolis illusion is caused by…','Coriolis-illusjonen kommer av …'),a:[t2('a head movement during a turn','en hodebevegelse i en sving'),t2('a long straight climb','en lang rett stigning'),t2('a narrow runway','en smal rullebane'),t2('a flickering light','et flimrende lys')],c:0,e:t2('Two canals are stimulated at once: a violent tumbling feeling.','To buer stimuleres samtidig: en voldsom tumlefølelse.')},
 {q:t2('An upslope runway on approach makes you feel … and fly …','En rullebane i oppoverbakke på innflyging gjør at du føler deg … og flyr …'),a:[t2('high; low','høy; lavt'),t2('low; high','lav; høyt'),t2('fast; slow','rask; sakte'),t2('on path; on path','på banen; på banen')],c:0,e:t2('The runway looks steeper, as from above the path.','Rullebanen ser brattere ut, som fra over banen.')},
 {q:t2('A runway wider than you are used to makes you…','En rullebane bredere enn du er vant med gjør at du …'),a:[t2('fly high and land long','flyr høyt og lander langt'),t2('fly low','flyr lavt'),t2('land short','lander kort'),t2('drift sideways','driver sidelengs')],c:0,e:t2('It looks as if you are low, so you stay high.','Det ser ut som om du er lav, så du blir liggende høyt.')},
 {q:t2('On a black-hole approach, the typical error is…','På en svart hull-innflyging er den typiske feilen …'),a:[t2('flying too low, several miles out','å fly for lavt, flere mil ute'),t2('flying too high','å fly for høyt'),t2('flying too fast','å fly for fort'),t2('landing long','å lande langt')],c:0,e:t2('You feel high and descend early, with nothing in front to judge height by.','Du føler deg høy og synker tidlig, uten noe foran å bedømme høyden etter.')},
 {q:t2('Over calm water or fresh snow you are likely to…','Over blankt vann eller nysnø vil du sannsynligvis …'),a:[t2('think you are higher than you are','tro at du er høyere enn du er'),t2('think you are lower than you are','tro at du er lavere enn du er'),t2('judge height correctly','bedømme høyden riktig'),t2('feel a turn','kjenne en sving')],c:0,e:t2('Featureless terrain removes the detail you judge height by: you feel high and fly low.','Terreng uten detaljer fjerner detaljene du bedømmer høyde etter: du føler deg høy og flyr lavt.')},
 {q:t2('You become disoriented in cloud. The first thing to do is…','Du blir desorientert i sky. Det første du gjør er …'),a:[t2('believe the attitude indicator and roll wings level','tro på holdningsindikatoren og rulle vingene vannrett'),t2('do what feels right','gjøre det som kjennes riktig'),t2('look outside for a gap','se ut etter en åpning'),t2('shake your head to reset the inner ear','riste på hodet for å nullstille det indre øret')],c:0,e:t2('Instruments first; then pitch and power. In a crew, hand over.','Instrumentene først; så pitch og kraft. I en besetning, gi fra deg kontrollen.')}]),10);

/* ---------------- static strings, text, start ---------------- */
LAB.add({},{'Spatial Orientation':'Romlig orientering','Spatial orientation and illusions':'Romlig orientering og illusjoner','Birdbird Virtual Lab · Human factors':'Birdbird Virtual Lab · Menneskelige faktorer',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Key concepts':'Nøkkelbegreper','Deep dive':'Dypdykk','Feel against reality':'Følelse mot virkelighet','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','The roll':'Rullen','The turn':'Svingen','The go-around':'Den avbrutte landingen','The pilot flies by':'Piloten flyr etter','The runway':'Rullebanen','The approach':'Innflygingen','Scenarios':'Scenarier','Restart':'Start på nytt','Mode':'Modus','Sections':'Seksjoner','Time':'Tid',
 'Two attitude spheres, the real attitude and the attitude you feel, over a time chart; or, for approaches, the view through the windscreen and a side view of the approach path.':'To holdningskuler, den virkelige holdningen og den du kjenner, over et tidsdiagram; eller, for innflyginger, utsikten gjennom frontruten og et sidebilde av innflygingsbanen.'});
LAB.tx({lead:'Uten horisont kommer balansesansen fra det indre øret, og det indre øret kan lures. Se hva flyet faktisk gjør ved siden av det du kjenner, se hvordan en rullebane kan lure øynene på innflyging, og lær den ene kuren: fly instrumentene.'});
function texts(){
  el('kin').textContent=L(t2('The ideas that explain almost every disorientation accident. "Show in the model" plays it for you.','Ideene som forklarer nesten alle desorienteringsulykker. «Vis i modellen» spiller det av for deg.'));
  el('xLead').textContent=L(t2('Pick a mode above the figure and press Play. The left sphere is what the aircraft does, the violet one what your inner ear tells you. In Approach illusions, change the runway and compare your view with the familiar picture.','Velg modus over figuren og trykk Spill av. Kula til venstre er det flyet gjør, den fiolette det det indre øret sier. I Illusjoner på innflyging, endre rullebanen og sammenlign utsikten med det kjente bildet.'));
  el('tryLead').textContent=L(t2('Think first, then check. "Set it up in the model" shows you why.','Tenk først, og sjekk. «Sett det opp i modellen» viser deg hvorfor.'));
  el('byH').textContent=L(t2('Feel: the pilot flies what the inner ear says. Instruments: the pilot flies the attitude indicator.','Følelsen: piloten flyr det det indre øret sier. Instrumentene: piloten flyr holdningsindikatoren.'));
  el('foot').innerHTML=L(t2('<b>Model and limitations.</b> Teaching model, not physiology. The semicircular canals are a high-pass filter (time constant 6 s) with a detection threshold of 2 °/s; the felt vertical drifts back to what the otoliths say over about 25 s. The otoliths add atan(a/g) to the felt pitch with a 2.5 s lag. Thresholds and time constants vary between people; the values are typical. The approach model assumes you hold the runway shape you know from a flat 45 m runway on a 3° path; the black-hole path is a typical shape from night-approach studies, not a calculation. Runway 2 500 m, PAPI transitions 2.5°, 2.83°, 3.17°, 3.5°.','<b>Modell og begrensninger.</b> Undervisningsmodell, ikke fysiologi. Buegangene er et høypassfilter (tidskonstant 6 s) med en terskel på 2 °/s; den følte loddlinjen glir tilbake til det otolittene sier over rundt 25 s. Otolittene legger atan(a/g) til følt pitch med 2,5 s forsinkelse. Terskler og tidskonstanter varierer mellom personer; verdiene er typiske. Innflygingsmodellen antar at du holder rullebaneformen du kjenner fra en flat 45 m rullebane på 3°-bane; banen i svart hull er en typisk form fra studier av nattinnflyginger, ikke en beregning. Rullebane 2 500 m, PAPI-overganger 2,5°, 2,83°, 3,17°, 3,5°.'));
  el('ddH').textContent=L(t2('Deep dive','Dypdykk')); setPlayBtn(); }
function all(){ texts(); drawTabs(); drawPre(); drawTask(); drawDD(); drawTake(); syncCtl(); upd(); }
LAB.onLang(all);
document.addEventListener('labdepth',all);
LAB.start('ori');
setMode('leans'); all();
/* old anchors */
const HM={'#ear':'leans','#trainer':'spiral','#approach':'app'};
if(HM[location.hash]){ setMode(HM[location.hash]); requestAnimationFrame(()=>el('orVp').scrollIntoView({block:'start'})); }
if(/^#dd-/.test(location.hash)&&el(location.hash.slice(1))){ const id=location.hash.slice(1); if(depth()==='short') LAB.setDepth('deep'); setTimeout(()=>{ const d=el(id); if(d){ d.open=true; d.scrollIntoView({block:'center'}); } },350); }
if(location.hash==='#other'){ if(depth()==='short') LAB.setDepth('deep'); setTimeout(()=>{ const d=el('dd-vis'); if(d){ d.open=true; d.scrollIntoView({block:'center'}); } },350); }
})();
