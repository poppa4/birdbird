/* Birdbird – holdlab.js: the Explore model of the holding and instrument approach lab (holding.html).
   One figure: a plan view over Bergen (relief and coastline from the radio navigation simulator's data,
   FLS VOR/DME and ILS RWY 17 geometry as in navsim.js), the side profile of the approach under it, and an HSI and
   a CDI (navgauges.js) beside it. Paths are computed in advance by holdcore.js / navcore.js and played back,
   so the scrubber can move freely. Strings are EN/NO through LAB.L. Training model, not for navigation. */
(function(){
'use strict';
const N=window.NAVCORE, H=window.HOLDCORE, {L,el,nf}=LAB, t2=(en,no)=>({en,no});
const tr=o=>{ LAB.add({},{[o.en]:o.no}); return o.en; };
const D2R=Math.PI/180, TAU=Math.PI*2, FT_NM=N.K.FT_NM, norm=N.norm, diff=N.diff, clamp=N.clamp, d3=N.d3;
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const FM='"IBM Plex Mono", ui-monospace, monospace', FB='"Public Sans", system-ui, sans-serif';
const COL={bg0:'#0d151c',bg1:'#121d26',ink:'#E6EBEF',ink2:'#AEB8C1',ink3:'#7D8B95',vor:'#63D9A0',ils:'#7FCBE8',hold:'#C9A6F5',ac:'#FFFFFF',
  direct:'#71CC93',parallel:'#7FCBE8',teardrop:'#F0B440',entry:'#F0B440',flown:'#F06BB4',wind:'#7FCBE8',warn:'#F0B440',bad:'#EC5A47',fix:'#E6EBEF',ga:'#EC8A5A'};

/* ---------- Bergen: FLS VOR/DME and ILS RWY 17 (same data and geometry as navsim.js AREAS.bergen) ---------- */
const REF=[60.3113,5.2122];
const FLS={id:'FLS',f:115.55,x:0,y:0,elev:213,var:0};
const ILS=(()=>{ const p=N.proj(60.2934,5.2181,REF[0],REF[1]), crs=174, len=1.614, u=[Math.sin(crs*D2R),Math.cos(crs*D2R)], h=len/2;
  const thr={x:p.x-u[0]*h,y:p.y-u[1]*h}, end={x:p.x+u[0]*h,y:p.y+u[1]*h};
  return {crs,elev:170,thr,end,u,x:end.x+u[0]*0.16,y:end.y+u[1]*0.16,gp:{x:thr.x+u[0]*0.16,y:thr.y+u[1]*0.16},gpa:3}; })();
/* a point on the extended centreline d NM out from the threshold */
const onCl=d=>({x:ILS.thr.x-ILS.u[0]*d,y:ILS.thr.y-ILS.u[1]*d});
/* the illustrative procedure (not the published Bergen chart) */
const APP={iaf:14,if_:10,iafAlt:3000,fafAlt:2000,dh:200,mda:600,maAlt:3000,maGrad:4,maMin:2.5};
APP.fap=H.pathDist(APP.fafAlt,ILS.elev); APP.da=ILS.elev+APP.dh;

/* ---------- state ---------- */
const S={sc:'entry',inb:90,dir:1,hdg:210,wdir:180,wspd:0,lvl:'low',tas:140,sectors:true,gs:140,vis:true,cmp:false,play:false,k:0,spd:16};
const SC=[['entry',t2('Hold entry','Holdinginnflyging')],['wind',t2('Hold with wind','Holding i vind')],['ils',t2('ILS approach','ILS-innflyging')],['npa',t2('Non-precision (CDFA)','Ikke-presisjon (CDFA)')],['missed',t2('Missed approach','Avbrutt innflyging')]];
const isHold=()=>S.sc==='entry'||S.sc==='wind';
const altHold=()=>S.lvl==='low'?5000:15000;
const legS=()=>H.legSec(altHold());

/* ---------- the path ---------- */
let PA=null;   /* {t,x,y,h,a,ph,n, ...} */
const PHN={tofix:t2('To the fix','Mot fiksen'),e_back:t2('Back to the fix','Tilbake til fiksen'),turnOut:t2('Turn outbound','Sving utgående'),outbound:t2('Outbound','Utgående'),turnIn:t2('Turn inbound','Sving inngående'),inbound:t2('Inbound','Inngående'),done:t2('Holding','Holder'),
  e_out_teardrop:t2('Offset leg: 30° towards the holding side','Forskjøvet legg: 30° mot holdingsiden'),e_out_parallel:t2('Parallel leg, non-holding side','Parallell legg, ikke-holdingsiden'),
  e_turn_teardrop:t2('Turn onto the inbound course','Sving inn på inngående kurs'),e_turn_parallel:t2('Turn over 180° towards the holding side','Sving over 180° mot holdingsiden'),
  init:t2('Initial segment (IAF → IF)','Initialsegment (IAF → IF)'),inter:t2('Intermediate segment (IF → FAF)','Mellomsegment (IF → FAF)'),final:t2('Final approach','Sluttinnflyging'),visual:t2('Visual: continue to land','Visuelt: fortsett til landing'),landed:t2('Landed','Landet'),ga:t2('Missed approach: climb straight ahead','Avbrutt innflyging: stig rett fram'),ma_turn:t2('Missed approach: turn back to FLS','Avbrutt innflyging: sving tilbake til FLS')};
function holdPath(){ const r=H.flyHold({fix:FLS,inb:S.inb,dir:S.dir,tas:S.tas,wdir:S.wdir,wspd:S.wspd,legS:legS(),arrive:{hdg:S.hdg,dist:4},laps:2,dt:0.5});
  const a=new Float32Array(r.n).fill(altHold()), ph=r.ph.map(i=>{ const p=H.PH[i]; return p==='e_out'||p==='e_turn'?p+'_'+r.entry:p; });
  return Object.assign(r,{a,phs:ph,kind:'hold'}); }
function approachPath(){ const gs=S.gs, dt=0.5, step=gs/3600*dt, el=ILS.elev, out={t:[],x:[],y:[],h:[],a:[],phs:[],kind:'app'};
  const miss= S.sc==='missed'||!S.vis, mina= S.sc==='npa'?H.dda(APP.mda):APP.da;
  let t=0, d=S.sc==='missed'?APP.fap+1.2:APP.iaf, alt=S.sc==='missed'?APP.fafAlt:APP.iafAlt;
  const push=(p,hdg,ph)=>{ out.t.push(t); out.x.push(p.x); out.y.push(p.y); out.h.push(hdg); out.a.push(alt); out.phs.push(ph); t+=dt; };
  /* initial and intermediate: down to 2000 ft by the IF, then level to the FAF/FAP */
  while(d>APP.fap){ const ph=d>APP.if_?'init':'inter'; alt= d>APP.if_? APP.iafAlt-(APP.iafAlt-APP.fafAlt)*(APP.iaf-d)/(APP.iaf-APP.if_) : APP.fafAlt; push(onCl(d),ILS.crs,ph); d-=step; }
  /* final: on the 3° path (glide slope, or the published angle flown as a CDFA) down to the minimum */
  while(true){ alt=H.pathAlt(d,el); if(alt<=mina) break; push(onCl(d),ILS.crs,'final'); d-=step; }
  out.iMin=out.t.length;
  if(!miss){ while(d>-0.16){ alt=Math.max(el,H.pathAlt(d,el)-(d<0.05?(0.05-d)*260:0)); push(onCl(d),ILS.crs,'visual'); d-=step; }
    alt=el; for(let i=0;i<10;i++){ push(onCl(d),ILS.crs,'landed'); d-=step*0.6; } }
  else { /* go around: climb straight ahead, then back to the FLS hold (inbound 354, left turns) */
    const g=APP.maGrad/100*FT_NM; let p=onCl(d);
    while(d>-2.6){ alt=Math.min(APP.maAlt,alt+g*step); push(p,ILS.crs,'ga'); d-=step; p=onCl(d); }
    const r=H.flyHold({fix:FLS,inb:354,dir:-1,tas:gs,wdir:0,wspd:0,legS:60,start:{x:p.x,y:p.y,hdg:ILS.crs},turnDir:1,laps:1,dt});
    for(let i=0;i<r.n;i++){ alt=Math.min(APP.maAlt,alt+g*step); out.t.push(t); out.x.push(r.x[i]); out.y.push(r.y[i]); out.h.push(r.h[i]); out.a.push(alt); const p2=H.PH[r.ph[i]]; out.phs.push(p2==='tofix'?'ma_turn':p2); t+=dt; }
    out.maHold={inb:354,dir:-1,tas:gs}; }
  out.n=out.t.length; out.mina=mina; out.miss=miss;
  /* distance from the threshold along the centreline, for the profile */
  out.dd=new Float32Array(out.n); out.gaD=0; let ga=false;
  for(let i=0;i<out.n;i++){ out.dd[i]=-((out.x[i]-ILS.thr.x)*ILS.u[0]+(out.y[i]-ILS.thr.y)*ILS.u[1]); if(!ga&&out.phs[i]==='ga'){ out.gaD=out.dd[i]; ga=true; } }
  return out; }
function build(keepK){ PA=isHold()?holdPath():approachPath(); if(!keepK) S.k=0; S.k=Math.min(S.k,PA.n-1); fitView(); sync(); }

/* ---------- canvases ---------- */
const mapCv=el('hlMap'), profCv=el('hlProf');
const MC=LAB.fit(mapCv,()=>{ fitView(); drawMap(); },2.5), PC=LAB.fit(profCv,()=>drawProf(),2.5);
const V={k:1,ox:0,oy:0,cx:0,cy:0};
let SX=0, SY=0; function P(x,y){ SX=V.cx+(x-V.ox)*V.k; SY=V.cy-(y-V.oy)*V.k; }
function unP(sx,sy){ return {x:V.ox+(sx-V.cx)/V.k,y:V.oy-(sy-V.cy)/V.k}; }
function fitView(){ if(!PA||!MC.w) return; let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9; const inc=(x,y)=>{ x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); };
  for(let i=0;i<PA.n;i+=4) inc(PA.x[i],PA.y[i]);
  if(isHold()&&S.sc==='entry'){ const r=ringR(); inc(FLS.x-r,FLS.y-r); inc(FLS.x+r,FLS.y+r); }
  if(!isHold()){ inc(ILS.end.x,ILS.end.y); inc(ILS.thr.x-1.5,ILS.thr.y); inc(ILS.thr.x+1.5,ILS.thr.y); }
  const W=MC.w, Hh=MC.h, ml=isHold()?60:24, mr=isHold()?72:24, top=18, bot=28; const k=Math.min((W-ml-mr)/Math.max(1,x1-x0),(Hh-top-bot)/Math.max(1,y1-y0));
  V.k=Math.min(k,140); V.ox=(x0+x1)/2; V.oy=(y0+y1)/2; V.cx=ml+(W-ml-mr)/2; V.cy=top+(Hh-top-bot)/2; }
const ringR=()=>{ const rt=H.racetrack(S.tas,legS()); return Math.max(4.6,rt.leg+2*rt.R+1.2); };

/* relief and coastline: the radio navigation simulator's prepared files (data/navsim-bergen.*) */
const TER={cv:null,path:null,R:62}, TLO=[19,29,37], THI=[56,69,78];
fetch('data/navsim-bergen.json').then(r=>r.ok?r.json():null).then(j=>{ if(!j) return; const u=j.unit, p=new Path2D();
  for(const q of j.rings){ for(let i=0;i<q.length;i+=2){ const x=q[i]*u, y=-q[i+1]*u; if(i) p.lineTo(x,y); else p.moveTo(x,y); } p.closePath(); } TER.path=p; TER.R=j.R; drawMap(); }).catch(()=>{});
{ const im=new Image(); im.onload=()=>{ try{ const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(im,0,0);
    const id=g.getImageData(0,0,c.width,c.height), d=id.data; for(let i=0;i<d.length;i+=4){ const v=d[i], t=v?Math.min(1,(v-6)/249):0; d[i]=TLO[0]+(THI[0]-TLO[0])*t; d[i+1]=TLO[1]+(THI[1]-TLO[1])*t; d[i+2]=TLO[2]+(THI[2]-TLO[2])*t; d[i+3]=255; }
    g.putImageData(id,0,0); TER.cv=c; drawMap(); }catch(e){} }; im.src='data/navsim-bergen.png'; }

/* ---------- drawing helpers ---------- */
function arrowHead(g,x,y,ang,sz,col){ g.fillStyle=col; g.beginPath(); g.moveTo(x+Math.sin(ang)*sz,y-Math.cos(ang)*sz); g.lineTo(x+Math.sin(ang+2.6)*sz*0.8,y-Math.cos(ang+2.6)*sz*0.8); g.lineTo(x+Math.sin(ang-2.6)*sz*0.8,y-Math.cos(ang-2.6)*sz*0.8); g.closePath(); g.fill(); }
function tag(g,x,y,txt,col,al,bg){ g.font=`600 11px ${FM}`; const w=g.measureText(txt).width+10, h=17; let bx= al==='l'?x-w-6 : al==='c'?x-w/2 : x+8; const by=y-h/2;
  bx=clamp(bx,2,MC.w-w-2); g.fillStyle=bg||'rgba(9,13,17,.8)'; rr(g,bx,by,w,h,3); g.fill(); g.fillStyle=col; g.textAlign='left'; g.textBaseline='middle'; g.fillText(txt,bx+5,by+h/2+0.5); }
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function vorSym(g,x,y){ g.save(); g.translate(x,y); g.strokeStyle=COL.vor; g.lineWidth=1.6; g.fillStyle='rgba(10,16,20,.9)'; g.beginPath(); for(let i=0;i<6;i++){ const t=i*Math.PI/3; if(i) g.lineTo(Math.cos(t)*7,Math.sin(t)*7); else g.moveTo(7,0); } g.closePath(); g.fill(); g.stroke(); g.strokeRect(-9,-7,18,14); g.fillStyle=COL.vor; g.beginPath(); g.arc(0,0,1.6,0,TAU); g.fill(); g.restore(); }
function fixSym(g,x,y,col){ g.fillStyle=col; g.strokeStyle='rgba(9,13,17,.9)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(x,y-7); g.lineTo(x+6,y+4.5); g.lineTo(x-6,y+4.5); g.closePath(); g.fill(); g.stroke(); }
function acShape(g,sz){ const s=sz/12; g.beginPath(); g.moveTo(0,-11*s); g.bezierCurveTo(1.4*s,-10.5*s,1.6*s,-8*s,1.6*s,-5*s); g.lineTo(1.6*s,-2.4*s); g.lineTo(12*s,-0.6*s); g.lineTo(12*s,1.2*s); g.lineTo(1.6*s,1.6*s);
  g.lineTo(1.1*s,7*s); g.lineTo(4.6*s,8.2*s); g.lineTo(4.6*s,9.6*s); g.lineTo(0,9.2*s); g.lineTo(-4.6*s,9.6*s); g.lineTo(-4.6*s,8.2*s); g.lineTo(-1.1*s,7*s); g.lineTo(-1.6*s,1.6*s); g.lineTo(-12*s,1.2*s); g.lineTo(-12*s,-0.6*s); g.lineTo(-1.6*s,-2.4*s); g.lineTo(-1.6*s,-5*s); g.bezierCurveTo(-1.6*s,-8*s,-1.4*s,-10.5*s,0,-11*s); g.closePath(); }
/* racetrack (still air) with the inbound leg ending at the fix */
function racetrack(g,f,inb,dir,tas,ls,col,dash,lw){ const R=N.turnRadius(tas), Lg=tas/3600*ls, u=[Math.sin(inb*D2R),Math.cos(inb*D2R)], nn=[u[1]*dir,-u[0]*dir];
  const p1={x:f.x-u[0]*Lg,y:f.y-u[1]*Lg}, c1={x:f.x+nn[0]*R,y:f.y+nn[1]*R}, c2={x:p1.x+nn[0]*R,y:p1.y+nn[1]*R};
  g.save(); g.strokeStyle=col; g.lineWidth=lw||1.6; g.setLineDash(dash||[]); g.lineJoin='round'; g.beginPath(); P(p1.x,p1.y); g.moveTo(SX,SY); P(f.x,f.y); g.lineTo(SX,SY);
  for(let i=1;i<=24;i++){ const t=i/24*Math.PI; P(c1.x-nn[0]*R*Math.cos(t)+u[0]*R*Math.sin(t),c1.y-nn[1]*R*Math.cos(t)+u[1]*R*Math.sin(t)); g.lineTo(SX,SY); }
  P(c2.x+nn[0]*R,c2.y+nn[1]*R); g.lineTo(SX,SY);
  for(let i=1;i<=24;i++){ const t=i/24*Math.PI; P(c2.x+nn[0]*R*Math.cos(t)-u[0]*R*Math.sin(t),c2.y+nn[1]*R*Math.cos(t)-u[1]*R*Math.sin(t)); g.lineTo(SX,SY); }
  g.closePath(); g.stroke(); g.restore();
  P(f.x-u[0]*Lg*0.5,f.y-u[1]*Lg*0.5); arrowHead(g,SX,SY,inb*D2R,7,col);
  return {mid:{x:f.x-u[0]*Lg*0.5+nn[0]*R,y:f.y-u[1]*Lg*0.5+nn[1]*R},nn,u,R,Lg}; }

/* ---------- plan view ---------- */
function drawMap(){ const g=MC.ctx, W=MC.w, Hh=MC.h; if(!W||!PA) return;
  const gr=g.createRadialGradient(W*0.5,Hh*0.4,0,W*0.5,Hh*0.5,Math.max(W,Hh)*0.75); gr.addColorStop(0,COL.bg1); gr.addColorStop(1,COL.bg0); g.fillStyle=gr; g.fillRect(0,0,W,Hh);
  if(TER.path){ g.save(); g.translate(V.cx,V.cy); g.scale(V.k,V.k); g.translate(-V.ox,V.oy);
    if(TER.cv){ g.save(); g.clip(TER.path,'evenodd'); g.imageSmoothingEnabled=true; g.drawImage(TER.cv,-TER.R,-TER.R,2*TER.R,2*TER.R); g.restore(); } else { g.fillStyle='#1a2833'; g.fill(TER.path,'evenodd'); }
    g.strokeStyle='rgba(150,182,204,.38)'; g.lineWidth=1/V.k; g.stroke(TER.path); g.restore();
    g.fillStyle='rgba(13,21,28,.35)'; g.fillRect(0,0,W,Hh); }
  /* runway */
  P(ILS.thr.x,ILS.thr.y); const rx=SX, ry=SY; P(ILS.end.x,ILS.end.y); g.strokeStyle='#C9D2D8'; g.lineWidth=Math.max(3,0.035*V.k); g.lineCap='butt'; g.beginPath(); g.moveTo(rx,ry); g.lineTo(SX,SY); g.stroke();
  const cur=Math.round(S.k);
  if(isHold()) holdLayer(g,W,Hh); else appLayer(g,W,Hh);
  /* the whole path faint, the flown part bright */
  g.save(); g.lineCap='round'; g.lineJoin='round'; g.strokeStyle='rgba(230,235,239,.22)'; g.setLineDash([3,5]); g.lineWidth=1.4; g.beginPath();
  for(let i=0;i<PA.n;i+=2){ P(PA.x[i],PA.y[i]); if(i) g.lineTo(SX,SY); else g.moveTo(SX,SY); } g.stroke(); g.setLineDash([]);
  let pc=null; g.lineWidth=2.6; for(let i=0;i<=cur;i+=1){ const c=phCol(PA.phs[i]); if(c!==pc){ if(pc) g.stroke(); g.strokeStyle=c; g.beginPath(); P(PA.x[Math.max(0,i-1)],PA.y[Math.max(0,i-1)]); g.moveTo(SX,SY); pc=c; } P(PA.x[i],PA.y[i]); g.lineTo(SX,SY); } if(pc) g.stroke(); g.restore();
  /* VOR */
  P(FLS.x,FLS.y); vorSym(g,SX,SY); if(!isHold()) tag(g,SX-8,SY+18,'FLS VOR/DME',COL.vor,'l');
  /* aircraft */
  P(PA.x[cur],PA.y[cur]); g.save(); g.translate(SX,SY); g.rotate(PA.h[cur]*D2R); g.shadowColor='rgba(0,0,0,.6)'; g.shadowBlur=6; g.shadowOffsetY=2; g.fillStyle=COL.ac; acShape(g,14); g.fill(); g.shadowBlur=0; g.shadowOffsetY=0; g.strokeStyle='rgba(13,21,28,.8)'; g.lineWidth=0.8; g.stroke(); g.restore();
  windBadge(g,W);
  /* north and scale */
  g.fillStyle=COL.ink2; g.beginPath(); g.moveTo(20,Hh-46); g.lineTo(25,Hh-30); g.lineTo(20,Hh-33); g.lineTo(15,Hh-30); g.closePath(); g.fill(); g.font=`600 10px ${FM}`; g.textAlign='center'; g.fillText('N',20,Hh-54);
  const nmL=V.k>60?1:V.k>25?2:5, px=nmL*V.k; g.strokeStyle=COL.ink2; g.lineWidth=1.4; g.beginPath(); g.moveTo(12,Hh-14); g.lineTo(12+px,Hh-14); g.moveTo(12,Hh-18); g.lineTo(12,Hh-10); g.moveTo(12+px,Hh-18); g.lineTo(12+px,Hh-10); g.stroke(); g.textAlign='left'; g.fillText(nmL+' NM',18+px,Hh-13);
}
function phCol(p){ if(!p) return COL.ink; if(p.startsWith('e_')) return COL.entry; if(p==='tofix'||p==='init'||p==='inter') return 'rgba(230,235,239,.85)'; if(p==='final'||p==='visual'||p==='landed') return COL.ils; if(p==='ga'||p==='ma_turn') return COL.ga; return COL.flown; }
function windBadge(g,W){ if(!isHold()) return; const x=W-40, y=44; g.fillStyle='rgba(9,13,17,.72)'; g.beginPath(); g.arc(x,y,24,0,TAU); g.fill(); g.strokeStyle='rgba(127,203,232,.25)'; g.lineWidth=1; g.stroke();
  if(S.wspd>0){ const an=(S.wdir+180)*D2R; g.strokeStyle=COL.wind; g.lineWidth=2; g.beginPath(); g.moveTo(x-Math.sin(an)*14,y+Math.cos(an)*14); g.lineTo(x+Math.sin(an)*10,y-Math.cos(an)*10); g.stroke(); arrowHead(g,x+Math.sin(an)*14,y-Math.cos(an)*14,an,7,COL.wind); }
  g.fillStyle=COL.ink; g.font=`600 10.5px ${FM}`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(S.wspd>0?d3(S.wdir)+'/'+Math.round(S.wspd):L(t2('CALM','STILLE')),x,y+36); g.fillStyle=COL.ink3; g.font=`500 9px ${FM}`; g.fillText(L(t2('WIND','VIND')),x,y-32); }
function holdLayer(g){ const f=FLS, I=S.inb, d=S.dir;
  if(S.sc==='entry'&&S.sectors){ /* entry sectors: a ring coloured by the entry for an aircraft arriving from that side */
    const r1=ringR()*0.8*V.k, r2=ringR()*V.k; P(f.x,f.y); const cx=SX, cy=SY;
    for(let b=0;b<360;b+=2){ const e=H.entryFrom(I,d,b+1), a0=(b-90)*D2R, a1=(b+2-90)*D2R; g.fillStyle=e.alt?'rgba(160,172,182,.22)':hexA(COL[e.entry],0.34);
      g.beginPath(); g.arc(cx,cy,r2,a0,a1+0.004); g.arc(cx,cy,r1,a1+0.004,a0,true); g.closePath(); g.fill(); }
    /* boundaries: the inbound course line and the 70° line through the fix */
    g.save(); g.strokeStyle='rgba(230,235,239,.5)'; g.setLineDash([5,5]); g.lineWidth=1.1;
    for(const an of [I,norm(I+180-d*70)]){ const s=Math.sin(an*D2R), c=Math.cos(an*D2R); g.beginPath(); g.moveTo(cx-s*r2,cy+c*r2); g.lineTo(cx+s*r2,cy-c*r2); g.stroke(); } g.restore();
    /* names in the middle of each sector (by the bearing the aircraft comes from) */
    const out=norm(I+180), rm=(r1+r2)/2, put=(hd,txt,col)=>{ const b=norm(hd+180)*D2R; tag(g,cx+Math.sin(b)*rm,cy-Math.cos(b)*rm,txt,col,'c','rgba(9,13,17,.82)'); };
    put(norm(out-d*35),L(t2('TEARDROP 70°','DRÅPE 70°')),COL.teardrop); put(norm(out+d*55),L(t2('PARALLEL 110°','PARALLELL 110°')),COL.parallel); put(norm(out-d*160),L(t2('DIRECT 180°','DIREKTE 180°')),COL.direct);
    const hb=norm(I+180-d*70); tag(g,cx+Math.sin(hb*D2R)*(r2+2),cy-Math.cos(hb*D2R)*(r2+2),'70°','#E6EBEF','c'); }
  const rt=racetrack(g,f,I,d,S.tas,legS(),'rgba(201,166,245,.85)',[6,4],1.6);
  P(f.x,f.y); fixSym(g,SX,SY,COL.hold);
  P(f.x,f.y); tag(g,SX-10,SY+16,'FLS · '+L(t2('inbound','inngående'))+' '+d3(I)+' '+(d>0?'R':'L'),COL.hold);
  }
function hexA(h,a){ const n=parseInt(h.slice(1),16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`; }
function appLayer(g){ /* centreline, localiser feather, fixes, missed approach hold */
  P(ILS.thr.x,ILS.thr.y); const tx=SX, ty=SY, far=onCl(16); P(far.x,far.y);
  g.save(); g.strokeStyle='rgba(127,203,232,.55)'; g.setLineDash([8,6]); g.lineWidth=1.1; g.beginPath(); g.moveTo(tx,ty); g.lineTo(SX,SY); g.stroke(); g.setLineDash([]);
  const an=(ILS.crs+180)*D2R, sp=2.5*D2R, fl=12*V.k; P(ILS.x,ILS.y); const lx=SX, ly=SY;
  g.fillStyle='rgba(127,203,232,.10)'; g.beginPath(); g.moveTo(lx,ly); g.lineTo(lx+Math.sin(an-sp)*fl,ly-Math.cos(an-sp)*fl); g.lineTo(lx+Math.sin(an)*fl*0.94,ly-Math.cos(an)*fl*0.94); g.lineTo(lx+Math.sin(an+sp)*fl,ly-Math.cos(an+sp)*fl); g.closePath(); g.fill(); g.restore();
  const fx=[[APP.iaf,'IAF'],[APP.if_,'IF'],[APP.fap,S.sc==='npa'?'FAF':'FAP']];
  for(const [dd,n] of fx){ const p=onCl(dd); P(p.x,p.y); fixSym(g,SX,SY,COL.fix); tag(g,SX+6,SY,n+' · '+nf(dd,1)+' NM',COL.ink); }
  if(S.sc==='npa'){ P(ILS.thr.x,ILS.thr.y); tag(g,SX-12,SY-4,'MAPt',COL.warn,'l'); }
  tag(g,tx+10,ty+16,'RWY 17 · ENBR',COL.ink2);
  if(PA.miss) racetrack(g,FLS,354,-1,S.gs,60,'rgba(236,138,90,.75)',[6,4],1.4); }

/* ---------- profile (approach) ---------- */
function drawProf(){ const g=PC.ctx, W=PC.w, Hh=PC.h; if(!W||!PA) return; g.clearRect(0,0,W,Hh);
  const gr=g.createLinearGradient(0,0,0,Hh); gr.addColorStop(0,'#14212b'); gr.addColorStop(1,'#0e161d'); g.fillStyle=gr; g.fillRect(0,0,W,Hh);
  if(isHold()) return;
  const el=ILS.elev, dMax=S.sc==='missed'?APP.fap+1.4:APP.iaf+0.5, dMin=PA.miss?-3:-1, aMax=3400, x0=40, x1=W-14, yt=26, yb=Hh-22;
  const X=d=>x0+(dMax-d)/(dMax-dMin)*(x1-x0), Y=a=>yb-a/aMax*(yb-yt);
  g.font=`500 10px ${FM}`; g.textBaseline='middle';
  /* altitude grid */
  g.textAlign='right'; for(let a=0;a<=3000;a+=1000){ g.strokeStyle='rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x0,Y(a)); g.lineTo(x1,Y(a)); g.stroke(); g.fillStyle=COL.ink3; g.fillText(a?nf(a,0):'0 ft',x0-4,Y(a)); }
  /* ground, runway */
  g.fillStyle='rgba(60,80,95,.35)'; g.fillRect(x0,Y(el),x1-x0,yb-Y(el)+22); g.strokeStyle='#C9D2D8'; g.lineWidth=4; g.beginPath(); g.moveTo(X(0),Y(el)); g.lineTo(X(-1.614),Y(el)); g.stroke();
  /* segments along the top */
  const segs=S.sc==='missed'?[[dMax,APP.fap,t2('Inter.','Mellom')],[APP.fap,0,t2('Final','Slutt')]]:[[APP.iaf,APP.if_,t2('Initial','Initial')],[APP.if_,APP.fap,t2('Intermediate','Mellom')],[APP.fap,0,t2('Final','Slutt')]]; if(PA.miss) segs.push([0,dMin,t2('Missed','Avbrutt')]);
  g.textAlign='center'; for(const [a,b,n] of segs){ g.strokeStyle='rgba(230,235,239,.35)'; g.lineWidth=1; g.beginPath(); g.moveTo(X(a)+2,12); g.lineTo(X(b)-2,12); g.stroke(); g.fillStyle=COL.ink2; g.fillText(L(n),(X(a)+X(b))/2,6+12); }
  for(const [dd,n] of (S.sc==='missed'?[[APP.fap,'FAP']]:[[APP.iaf,'IAF'],[APP.if_,'IF'],[APP.fap,S.sc==='npa'?'FAF':'FAP']])){ g.strokeStyle='rgba(230,235,239,.18)'; g.setLineDash([2,4]); g.beginPath(); g.moveTo(X(dd),24); g.lineTo(X(dd),yb); g.stroke(); g.setLineDash([]); g.fillStyle=COL.ink; g.fillText(n,X(dd),yb+11); }
  if(S.sc==='npa'){ g.fillStyle=COL.warn; g.fillText('MAPt',X(0),yb+11); } else { g.fillStyle=COL.ink3; g.fillText('THR',X(0),yb+11); }
  /* 3° path */
  g.strokeStyle=S.sc==='npa'?'rgba(127,203,232,.65)':COL.ils; g.lineWidth=1.6; if(S.sc==='npa') g.setLineDash([6,4]); g.beginPath(); g.moveTo(X(APP.fap),Y(H.pathAlt(APP.fap,el))); g.lineTo(X(0),Y(H.pathAlt(0,el))); g.stroke(); g.setLineDash([]);
  g.fillStyle=COL.ils; g.textAlign='left'; const lab=S.sc==='npa'?L(t2('3° CDFA','3° CDFA')):L(t2('3° glide slope','3° glidebane')); g.fillText(W<520?lab:lab+' · 300 ft/NM',X(APP.fap)+8,Y(H.pathAlt(APP.fap,el))-6);
  /* the minimum */
  const mn=PA.mina, mc=S.sc==='npa'?COL.warn:'#F06BB4'; g.strokeStyle=mc; g.setLineDash([5,4]); g.lineWidth=1.2; g.beginPath(); g.moveTo(X(4),Y(mn)); g.lineTo(X(dMin),Y(mn)); g.stroke(); g.setLineDash([]);
  g.fillStyle=mc; const mt=S.sc==='npa'?'MDA '+APP.mda+' ft'+(W<520?'':' (DDA)'):'DA '+APP.da+' ft'+(W<520?'':' (DH '+APP.dh+')'); if(W<520){ g.textAlign='right'; g.fillText(mt,X(0.9),Y(mn)-9); } else { g.textAlign='left'; g.fillText(mt,X(Math.min(4,dMax-1))+2,Y(mn)-9); }
  /* step-down comparison */
  if(S.sc==='npa'&&S.cmp){ const r=1000/(S.gs/60), dm=APP.fap-(APP.fafAlt-APP.mda)/r; g.strokeStyle='rgba(236,90,71,.8)'; g.lineWidth=1.4; g.setLineDash([2,3]); g.beginPath(); g.moveTo(X(APP.fap),Y(APP.fafAlt)); g.lineTo(X(dm),Y(APP.mda)); g.lineTo(X(0),Y(APP.mda)); g.stroke(); g.setLineDash([]);
    g.fillStyle=COL.bad; g.textAlign='left'; g.fillText(L(t2('step-down: level at MDA, long and low','trinnvis: flatt på MDA, lenge og lavt')),X(dm)+4,Y(APP.mda)+12); }
  /* missed approach: minimum 2.5 % gradient from the go-around point */
  if(PA.miss){ const g25=H.climbFtNm(APP.maMin); const sx=PA.gaD; g.strokeStyle='rgba(236,138,90,.55)'; g.setLineDash([3,3]); g.beginPath(); g.moveTo(X(sx),Y(mn)); g.lineTo(X(dMin),Y(mn+g25*(sx-dMin))); g.stroke(); g.setLineDash([]);
    g.fillStyle=COL.ga; g.textAlign='right'; g.fillText(L(t2('min 2.5 %','min 2,5 %')),X(dMin)-2,Y(mn+g25*(sx-dMin))+10); }
  /* flown trace and aircraft */
  const cur=Math.round(S.k); g.lineWidth=2.4; g.lineCap='round'; let pc=null;
  for(let i=0;i<=cur;i++){ const p=PA.phs[i]; if(p!=='init'&&p!=='inter'&&p!=='final'&&p!=='visual'&&p!=='landed'&&p!=='ga') break; const dd=PA.dd[i]; const c=phCol(p);
    if(c!==pc){ if(pc) g.stroke(); g.strokeStyle=c; g.beginPath(); const j=Math.max(0,i-1); g.moveTo(X(PA.dd[j]),Y(PA.a[j])); pc=c; } g.lineTo(X(dd),Y(PA.a[i])); } if(pc) g.stroke();
  const p=PA.phs[cur]; if(PA.dd[cur]!=null&&(p==='init'||p==='inter'||p==='final'||p==='visual'||p==='landed'||p==='ga')){ const px=X(PA.dd[cur]), py=Y(PA.a[cur]);
    g.strokeStyle='rgba(230,235,239,.3)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(px,py); g.lineTo(px,Y(el)); g.stroke(); g.setLineDash([]);
    const j=Math.max(0,cur-2), ang=Math.atan2(-(PA.a[cur]-PA.a[j])/FT_NM*6, (PA.dd[j]-PA.dd[cur])||1e-6);
    g.save(); g.translate(px,py); g.rotate(clamp(ang,-0.5,0.5)); g.fillStyle=COL.ac; g.beginPath(); g.moveTo(9,0); g.lineTo(-7,-1.5); g.lineTo(-9,-7); g.lineTo(-10,-7); g.lineTo(-9,1.5); g.lineTo(7,2); g.closePath(); g.fill(); g.restore(); }
}

/* ---------- gauges ---------- */
const GA={hsi:NAVG.make(el('hlHsi'),'hsi'),cdi:NAVG.make(el('hlCdi'),'cdi')}, GV={hsi:{},cdi:{}};
function gauges(i){ const x=PA.x[i], y=PA.y[i], h=PA.h[i], a=PA.a[i], ac={x,y};
  const p=PA.phs[i], onLoc=!isHold()&&p!=='ma_turn'&&!/^(turnOut|outbound|turnIn|inbound|done|e_)/.test(p);
  if(!onLoc){ const obs=isHold()?S.inb:PA.maHold.inb, v=N.vor(FLS,ac,obs,{alt:a});
    Object.assign(GV.cdi,{obs,dots:v.flag==='OFF'&&v.why==='cone'?v.dots*0.3:v.dots,flag:v.flag,ils:false,gsValid:false,gsDots:0});
    Object.assign(GV.hsi,{hdg:h,crs:obs,hsiDots:clamp(v.dev/5,-2.5,2.5),flag:v.flag,ils:false,gsValid:false,gsDots2:0,bug:Math.round(h)}); }
  else { const lc=N.loc(ILS,ac), gsl=N.gs(ILS,ac,a), gsOn=S.sc!=='npa'&&gsl.valid;
    Object.assign(GV.cdi,{obs:ILS.crs,dots:lc.valid?lc.dots:0,flag:lc.valid?'TO':'OFF',ils:true,gsValid:gsOn,gsDots:gsl.dots});
    Object.assign(GV.hsi,{hdg:h,crs:ILS.crs,hsiDots:clamp(lc.dev/1.25,-2.5,2.5),flag:lc.valid?'TO':'OFF',ils:true,gsValid:gsOn,gsDots2:clamp(gsl.dots*0.4,-2.4,2.4),bug:Math.round(h)}); }
  GA.hsi.set(GV.hsi); GA.cdi.set(GV.cdi);
  el('hlCdiC').textContent= onLoc? (S.sc==='npa'?L(t2('LOC only · GS not used','Bare LOC · GS brukes ikke')):L(t2('ILS: LOC and GS','ILS: LOC og GS'))) : 'VOR · OBS '+d3(GV.cdi.obs); }

/* ---------- readouts ---------- */
const mmss=s=>{ s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
function phStart(i){ const p=PA.phs[i]; let j=i; while(j>0&&PA.phs[j-1]===p) j--; return PA.t[j]; }
function chip(){ const i=Math.round(S.k), p=PA.phs[i], sp=(a,b,c,hx)=>`<span${hx?' class="hx"':''}><i>${a}</i><b class="${c||''}">${b}</b></span>`; let h='';
  if(isHold()){ const en=PA.entry, nm={direct:t2('Direct','Direkte'),teardrop:t2('Offset (teardrop)','Forskjøvet (dråpe)'),parallel:t2('Parallel','Parallell')}[en];
    h+=sp(L(t2('ENTRY','INNFLYGING')),L(nm))+sp(L(t2('NOW','NÅ')),L(PHN[p]||t2('',''))); const timed=p==='outbound'||p==='inbound'||p.startsWith('e_out');
    h+=sp(L(t2('CLOCK','KLOKKE')),timed?mmss(PA.t[i]-phStart(i)):'–')+sp('HDG',d3(PA.h[i]));
    if(S.sc==='wind'&&PA.legIn.length) h+=sp(L(t2('INBOUND LEG','INNGÅENDE LEGG')),mmss(PA.legIn[PA.legIn.length-1]),'',1); }
  else { const dd=PA.dd[i]; const onApp=p==='init'||p==='inter'||p==='final'||p==='visual';
    h+=sp(L(t2('NOW','NÅ')),L(PHN[p]||PHN.ga)); if(onApp) h+=sp(L(t2('TO THRESHOLD','TIL TERSKEL')),nf(Math.max(0,dd),1)+' NM');
    h+=sp('ALT',nf(Math.round(PA.a[i]/10)*10,0)+' ft');
    if(p==='final'||p==='visual') h+=sp(L(t2('3° PATH','3°-BANE')),nf(Math.round(H.pathAlt(dd,ILS.elev)/10)*10,0)+' ft','',1)+sp(L(t2('DESCENT','SINK')),nf(Math.round(H.rod(S.gs)/10)*10,0)+' ft/min');
    if(p==='ga'||p==='ma_turn') h+=sp(L(t2('CLIMB','STIGNING')),nf(Math.round(H.climbFpm(S.gs,APP.maGrad)/10)*10,0)+' ft/min'); }
  const c=el('hlChip'); if(c.innerHTML!==h) c.innerHTML=h;
  el('hlTime').textContent=mmss(PA.t[i])+' / '+mmss(PA.t[PA.n-1]); }

/* ---------- controls panel ---------- */
const PN=el('hlPanel');
function card(){ const c=el('hlCard'); let h='';
  if(isHold()){ const e=H.entry(S.inb,S.dir,S.hdg), W=H.holdWind(S.inb,S.tas,S.wdir,S.wspd,legS()), side=S.dir>0, out=norm(S.inb+180), off=norm(out-S.dir*30), ls=legS()===60?'1 min':L(t2('1.5 min','1,5 min'));
    const nm={direct:t2('Direct','Direkte'),teardrop:t2('Offset (teardrop)','Forskjøvet (dråpe)'),parallel:t2('Parallel','Parallell')};
    const R=L(t2(side?'right':'left',side?'høyre':'venstre')), Lx=L(t2(side?'left':'right',side?'venstre':'høyre'));
    const st={direct:[t2(`Over the fix, turn ${side?'right':'left'} to the outbound heading.`,`Over fiksen: sving ${R} til utgående kurs.`),t2(`Start the clock abeam the fix; fly outbound ${ls}.`,`Start klokka tvers av fiksen; fly utgående ${ls}.`),t2(`Turn ${side?'right':'left'} onto the inbound course ${d3(S.inb)}.`,`Sving ${R} inn på inngående kurs ${d3(S.inb)}.`)],
      teardrop:[t2(`Over the fix, turn to ${d3(off)}: 30° off the outbound course, towards the holding side.`,`Over fiksen: sving til ${d3(off)}: 30° fra utgående kurs, mot holdingsiden.`),t2(`Fly ${ls}.`,`Fly ${ls}.`),t2(`Turn ${side?'right':'left'} onto the inbound course ${d3(S.inb)}.`,`Sving ${R} inn på inngående kurs ${d3(S.inb)}.`)],
      parallel:[t2(`Over the fix, turn to ${d3(out)}: parallel to the inbound course, on the non-holding side.`,`Over fiksen: sving til ${d3(out)}: parallelt med inngående kurs, på ikke-holdingsiden.`),t2(`Fly ${ls}.`,`Fly ${ls}.`),t2(`Turn ${side?'left':'right'}, towards the holding side, through more than 180°, back to the fix.`,`Sving ${Lx}, mot holdingsiden, over 180°, tilbake til fiksen.`)]}[e.entry];
    h+=`<div class="ent ${e.entry}"><span class="k">${L(t2('Your entry','Din innflyging'))}</span><b>${L(nm[e.entry])}</b><ol>${st.map(s=>`<li>${L(s)}</li>`).join('')}</ol>${e.alt?`<p class="flex">${L(t2('Within 5° of a sector line: ','Innenfor 5° av en sektorlinje: '))}${L(nm[e.alt])} ${L(t2('is also allowed.','er også tillatt.'))}</p>`:''}</div>`;
    if(S.sc==='wind'||S.wspd>0){ const sg=v=>(v>=0?'+':'−')+nf(Math.abs(v),0)+'°';
      h+=`<div class="ro"><div class="rrow"><span>${L(t2('Inbound: drift correction','Inngående: avdriftskorreksjon'))}</span><b>${sg(W.wca)} → ${d3(W.hdgIn)}</b></div><div class="rrow"><span>${L(t2('Outbound: 3 × the correction','Utgående: 3 × korreksjonen'))}</span><b class="hl">${d3(W.hdgOut)}</b></div><div class="rrow"><span>${L(t2('Outbound time for a','Utgående tid for'))} ${ls} ${L(t2('inbound','inngående'))}</span><b class="hl">${mmss(W.tOut)}</b></div><div class="rrow deep"><span>${L(t2('Rule of thumb (1 s per kt)','Tommelfingerregel (1 s per kt)'))}</span><b>${mmss(W.tRule)}</b></div></div>`; }
    const sp=H.holdSpeed(altHold()); h+=`<p class="hint deep">${L(t2('Max holding speed at this level:','Maks holdingfart i dette nivået:'))} <b>${sp.kt?sp.kt+' kt IAS':'M'+sp.mach}</b>${S.lvl==='low'?L(t2(' (170 kt if the hold is for Cat A/B only).',' (170 kt hvis holdingen bare er for kat. A/B).')):'.'}</p>`; }
  else { const npa=S.sc==='npa', cl=H.classify(npa?APP.mda-ILS.elev:APP.dh,!npa);
    h+=`<div class="ro"><div class="rrow"><span>${L(t2('Rate of descent, GS × 5','Sinkrate, GS × 5'))}</span><b class="hl">${nf(H.rodRule(S.gs),0)} ft/min</b></div><div class="rrow deep"><span>${L(t2('Exact on 3° (GS × 5.3)','Nøyaktig på 3° (GS × 5,3)'))}</span><b>${nf(Math.round(H.rod(S.gs)),0)} ft/min</b></div>`
      +`<div class="rrow"><span>${npa?L(t2('Minimum: MDA, flown as DDA','Minimum: MDA, flydd som DDA')):L(t2('Minimum: decision altitude','Minimum: beslutningshøyde'))}</span><b>${npa?APP.mda+' ft':APP.da+' ft'}</b></div>`
      +`<div class="rrow"><span>${L(t2('Type','Type'))}</span><b>${cl.dim} · Type ${cl.type}${npa?'':' · '+H.ilsCat(APP.dh)}</b></div>`
      +(S.sc==='missed'?`<div class="rrow"><span>${L(t2('Min climb gradient 2.5 %','Min stigegradient 2,5 %'))}</span><b>${nf(Math.round(H.climbFpm(S.gs,2.5)/10)*10,0)} ft/min</b></div>`:'')+`</div>`; }
  if(c.innerHTML!==h) c.innerHTML=h; }
let CT={};
function panel(){ const hold=isHold(), b=el('hlCtl'), cs=el('hlCard').parentNode; cs.remove(); b.innerHTML=''; CT={};
  const sec=(t,deep)=>{ const d=document.createElement('details'); d.className='xsec'+(deep?' deep':''); d.open=true; d.innerHTML=`<summary>${L(t)}</summary>`; b.appendChild(d); return d; };
  const box=p=>{ const d=document.createElement('div'); p.appendChild(d); return d; };
  if(hold){ const s1=sec(t2('The hold','Holdingen'));
    CT.inb=LAB.slider(s1,{label:tr(t2('Inbound course','Inngående kurs')),min:5,max:360,step:5,v:S.inb,f:v=>d3(v)+'°',on:v=>{ S.inb=v; changed(); }});
    CT.dir=LAB.seg(box(s1),[['1',tr(t2('Right turns (standard)','Høyresvinger (standard)'))],['-1',tr(t2('Left turns','Venstresvinger'))]],String(S.dir),v=>{ S.dir=+v; changed(); });
    const s2=sec(t2('Your arrival','Din ankomst'));
    CT.hdg=LAB.slider(s2,{label:tr(t2('Your heading to the fix','Din kurs mot fiksen')),min:5,max:360,step:5,v:S.hdg,f:v=>d3(v)+'°',on:v=>{ S.hdg=v; changed(); }});
    const nt=document.createElement('p'); nt.className='hint'; nt.textContent=L(t2('Or tap the map where you come from.','Eller trykk på kartet der du kommer fra.')); s2.appendChild(nt);
    const s3=sec(t2('Wind','Vind'));
    CT.wdir=LAB.slider(s3,{label:tr(t2('From (°)','Fra (°)')),min:0,max:355,step:5,v:S.wdir,f:v=>d3(v)+'°',on:v=>{ S.wdir=v; changed(); }});
    CT.wspd=LAB.slider(s3,{label:tr(t2('Speed','Styrke')),min:0,max:50,step:1,v:S.wspd,f:v=>v+' kt',on:v=>{ S.wspd=v; changed(); }});
    const s4=sec(t2('Level and speed','Nivå og fart'),true);
    CT.lvl=LAB.seg(box(s4),[['low',tr(t2('At or below FL140: 1 min','Til og med FL140: 1 min'))],['high',tr(t2('Above FL140: 1.5 min','Over FL140: 1,5 min'))]],S.lvl,v=>{ S.lvl=v; changed(); });
    CT.tas=LAB.slider(s4,{label:tr(t2('True airspeed','Sann fart')),min:100,max:260,step:10,v:S.tas,f:v=>v+' kt',on:v=>{ S.tas=v; changed(); }});
    if(S.sc==='entry'){ const tg=document.createElement('div'); tg.className='xtogs'; tg.style.marginTop='10px'; tg.innerHTML=`<button type="button" class="xtog" aria-pressed="${S.sectors}">${L(t2('Entry sectors','Innflygingssektorer'))}</button>`; s1.appendChild(tg);
      tg.firstChild.onclick=()=>{ S.sectors=!S.sectors; tg.firstChild.setAttribute('aria-pressed',S.sectors); fitView(); drawMap(); legend(); }; }
    /* the result card right after the controls that decide it */
    if(S.sc==='wind') b.append(s1,s3,cs,s2,s4); else b.append(s1,s2,cs,s3,s4); }
  else { const s1=sec(t2('Approach','Innflyging'));
    CT.gs=LAB.slider(s1,{label:tr(t2('Ground speed','Fart over bakken')),min:90,max:180,step:5,v:S.gs,f:v=>v+' kt',on:v=>{ S.gs=v; changed(true); }});
    if(S.sc!=='missed'){ const g=document.createElement('div'); g.className='grp'; g.textContent=L(t2('At the minimum, the runway is…','Ved minimum er rullebanen …')); s1.appendChild(g);
      CT.vis=LAB.seg(box(s1),[['1',tr(t2('In sight: land','I sikte: land'))],['0',tr(t2('Not in sight: go around','Ikke i sikte: gå rundt'))]],S.vis?'1':'0',v=>{ S.vis=v==='1'; changed(); }); }
    if(S.sc==='npa'){ const tg=document.createElement('div'); tg.className='xtogs'; tg.style.marginTop='8px'; tg.innerHTML=`<button type="button" class="xtog" aria-pressed="${S.cmp}">${L(t2('Compare: step-down descent','Sammenlign: trinnvis nedstigning'))}</button>`; s1.appendChild(tg);
      tg.firstChild.onclick=()=>{ S.cmp=!S.cmp; tg.firstChild.setAttribute('aria-pressed',S.cmp); drawProf(); legend(); }; }
    b.appendChild(cs); }
  card(); }
function changed(keepK){ build(!!keepK); card(); sum(); if(HL.onChange) HL.onChange(); }
function sum(){ const s=el('hlSv'); if(!s) return; s.textContent= isHold()? d3(S.inb)+' '+(S.dir>0?'R':'L')+' · HDG '+d3(S.hdg)+(S.wspd?' · '+d3(S.wdir)+'/'+S.wspd:'') : 'GS '+S.gs+' kt'; }

/* ---------- view tabs, playback ---------- */
function tabs(){ el('hlTabs').innerHTML=SC.map(([k,n])=>`<button type="button" role="tab" data-s="${k}" class="${S.sc===k?'on':''}" aria-selected="${S.sc===k}">${L(n)}</button>`).join(''); }
el('hlTabs').addEventListener('click',e=>{ const b=e.target.closest('[data-s]'); if(b) HL.set(b.dataset.s); });
const SPD=[2,4,8,16,32];
function playUI(){ const b=el('hlPlay'); b.textContent=S.play?L(t2('❚❚ Pause','❚❚ Pause')):(S.k>=PA.n-1?L(t2('↺ Fly again','↺ Fly igjen')):L(t2('▶ Fly','▶ Fly'))); b.setAttribute('aria-pressed',String(S.play)); el('hlSpd').textContent='×'+S.spd; }
el('hlPlay').onclick=()=>{ if(S.k>=PA.n-1){ S.k=0; } S.play=!S.play; playUI(); kick(); };
el('hlSpd').onclick=()=>{ S.spd=SPD[(SPD.indexOf(S.spd)+1)%SPD.length]; playUI(); };
const scrub=el('hlScrub'); scrub.addEventListener('input',()=>{ S.k=+scrub.value/1000*(PA.n-1); S.play=false; playUI(); sync(); });
function legend(){ const lg=(c,t,cls)=>`<span><i class="${cls||''}" style="--c:${c}"></i>${L(t)}</span>`; let s='';
  if(isHold()){ if(S.sc==='entry'&&S.sectors) s+=lg(COL.direct,t2('direct','direkte'),'sq')+lg(COL.teardrop,t2('offset (teardrop)','forskjøvet (dråpe)'),'sq')+lg(COL.parallel,t2('parallel','parallell'),'sq')+lg('#A0ACB6',t2('±5°: either','±5°: begge'),'sq');
    s+=lg(COL.hold,t2('the hold (still air)','holdingen (stille luft)'),'d')+lg(COL.entry,t2('entry','innflyging'))+lg(COL.flown,t2('in the hold','i holdingen')); }
  else { s+=lg(COL.ils,t2(S.sc==='npa'?'localiser and 3° CDFA':'localiser and glide slope',S.sc==='npa'?'localizer og 3° CDFA':'localizer og glidebane'))+lg(S.sc==='npa'?COL.warn:'#F06BB4',t2(S.sc==='npa'?'MDA (DDA)':'decision altitude',S.sc==='npa'?'MDA (DDA)':'beslutningshøyde'),'d');
    if(PA.miss) s+=lg(COL.ga,t2('missed approach and hold','avbrutt innflyging og holding')); if(S.sc==='npa'&&S.cmp) s+=lg(COL.bad,t2('step-down','trinnvis'),'d'); }
  el('hlLeg').innerHTML=s; }
const SEE={entry:t2('the hold at the FLS VOR and the three entry sectors around it. Your heading to the fix decides the entry: set it, or tap the map, then press Fly. The HSI and the VOR CDI show the same flight.','holdingen ved FLS VOR og de tre innflygingssektorene rundt den. Kursen din mot fiksen avgjør innflygingen: still den, eller trykk på kartet, og trykk Fly. HSI-en og VOR-CDI-en viser den samme flygingen.'),
  wind:t2('the same hold in wind. The dashed racetrack is the still-air shape; the pink path is what the aircraft flies with three times the drift correction outbound and an adjusted outbound time. Change the wind and see the outbound heading and time move.','den samme holdingen i vind. Den stiplede banen er formen i stille luft; den rosa banen er det flyet flyr med tre ganger avdriftskorreksjonen utgående og justert utgående tid. Endre vinden og se utgående kurs og tid endre seg.'),
  ils:t2('an ILS to runway 17 at Bergen from above and from the side. Level at 2000 ft, the aircraft meets the glide slope at the final approach point and follows it down to the decision altitude. The descent rate follows the ground speed.','en ILS til bane 17 på Bergen sett ovenfra og fra siden. I 2000 ft flatt møter flyet glidebanen ved final approach point og følger den ned til beslutningshøyden. Sinkraten følger farten over bakken.'),
  npa:t2('the same final flown on the localiser only: no glide slope, so the minimum is an MDA. Flown as a CDFA, the aircraft keeps a steady 3° descent from the FAF and goes around at the MDA (the derived decision altitude) if the runway is not in sight.','den samme finalen flydd bare på localizeren: ingen glidebane, så minimum er en MDA. Flydd som CDFA holder flyet en jevn 3° nedstigning fra FAF og går rundt ved MDA (avledet beslutningshøyde) hvis rullebanen ikke er i sikte.'),
  missed:t2('the runway is not in sight at the decision altitude: go around, climb straight ahead, turn back to FLS and enter the hold. The profile shows the minimum 2.5 % climb gradient the procedure is designed for.','rullebanen er ikke i sikte ved beslutningshøyden: gå rundt, stig rett fram, sving tilbake til FLS og gå inn i holdingen. Profilen viser minste stigegradient på 2,5 % som prosedyren er laget for.')};
function see(){ el('hlSee').innerHTML='<b>'+L(t2('What you are seeing:','Dette ser du:'))+'</b> '+L(SEE[S.sc]); }

/* map tap: come from there */
mapCv.addEventListener('click',e=>{ if(!isHold()) return; const r=mapCv.getBoundingClientRect(), p=unP(e.clientX-r.left,e.clientY-r.top);
  const b=N.bearing(p.x-FLS.x,p.y-FLS.y); S.hdg=(Math.round(norm(b+180)/5)*5)||360; if(CT.hdg) CT.hdg.set(S.hdg); S.play=false; changed(); playUI(); });

/* ---------- loop ---------- */
let raf=0, last=0, vis=true;
LAB.visible(el('hlVp'),v=>{ vis=v; if(v) kick(); });
function kick(){ if(!raf) raf=requestAnimationFrame(frame); }
function sync(){ if(!PA) return; const i=Math.round(S.k); gauges(i); chip(); scrub.value=String(Math.round(S.k/(PA.n-1||1)*1000)); drawMap(); drawProf(); legend(); kick(); }
function frame(t){ raf=0; const dt=Math.min(0.1,last?(t-last)/1000:0.016); last=t; if(!vis){ last=0; return; }
  let moving=false;
  if(S.play){ S.k=Math.min(PA.n-1,S.k+dt*S.spd/0.5); if(S.k>=PA.n-1){ S.play=false; playUI(); } sync(); }
  for(const k in GA){ if(GA[k].tick(dt)) moving=true; if(GA[k].dirty||moving) GA[k].draw(); }
  if(S.play||moving) kick(); else last=0; }

/* ---------- API (tasks, key concept cards) ---------- */
const DEF={entry:{inb:90,dir:1,hdg:210,wspd:0,wdir:180,lvl:'low',tas:140,sectors:true,spd:16},wind:{inb:90,dir:1,hdg:90,wspd:30,wdir:180,lvl:'low',tas:140,spd:16},
  ils:{gs:140,vis:true,spd:8},npa:{gs:140,vis:true,cmp:false,spd:8},missed:{gs:140,vis:false,spd:8}};
const HL={S,APP,ILS,FLS,
  set(sc,o){ S.sc=sc; Object.assign(S,DEF[sc],o||{}); S.play=false; profCv.parentNode.hidden=isHold(); el('hlVp').classList.toggle('hl-app',!isHold()); tabs(); panel(); build(); see(); sum(); playUI(); if(o&&o.fly){ S.play=true; playUI(); kick(); } if(o&&o.at!=null){ S.k=o.at*(PA.n-1); sync(); } if(HL.onChange) HL.onChange(); },
  get path(){ return PA; }, entryNow:()=>H.entry(S.inb,S.dir,S.hdg), windNow:()=>H.holdWind(S.inb,S.tas,S.wdir,S.wspd,legS()), legS, onChange:null};
window.HLAB=HL;
LAB.onLang(()=>{ tabs(); panel(); see(); legend(); playUI(); sync(); });
HL.set('entry');
})();
