/* Birdbird – airdata.js: the Air data lab (airdata.html).
   One dark figure: the pitot-static system wired to the ASI, altimeter and VSI (and a Mach meter in Deep dive),
   next to a side view of the aircraft over the terrain (real altitude against what the altimeter says) or, for airspeeds,
   the IAS → CAS → EAS → TAS ladder. Four modes: altimeter settings, pressure and temperature errors, airspeeds, blockages.
   All physics in airdatacore.js (ADC). */
(function(){
'use strict';
const {L,el,nf}=LAB, A=ADC, t2=(en,no)=>({en,no});
const D2R=Math.PI/180;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const MONO='"IBM Plex Mono", ui-monospace, monospace', SANS='"Public Sans", system-ui, sans-serif';
const C={tot:'#F0B440',st:'#7FCBE8',ind:'#C9B6F2',txt:'#EEF2F5',mut:'#8E99A4',dim:'#5E6D7C',red:'#EC5A47',ok:'#71CC93',amb:'#F0C470',ter:'#34493B',terL:'#5F8A69',grid:'rgba(200,215,225,.10)'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const depth=()=>document.body.classList.contains('depth-short')?'short':document.body.classList.contains('depth-instructor')?'instructor':'deep';
const deepOn=()=>depth()!=='short';
const ft=v=>nf(Math.round(v/10)*10,0)+' ft';
const hp=v=>nf(v,v%1?2:0)+' hPa';
const sg=v=>(v>0?'+':v<0?'−':'')+nf(Math.abs(v),0);
const ELEV=700, RIDGE=3300, TAU=3, TIMEX=4, ALTDP=1.5;   // aerodrome elevation, ridge top (ft), VSI lag (s), time speed-up, alternate static suction (hPa)

/* ---------------- state ---------------- */
const S={mode:'set',qnhA:1013,qnhSet:1013,set:'qnh',dT:0,alt:3000,vs:0,ias:120,pe:0,fault:'none',altSt:false,trap:null,ice:false};
let lag=null;                                  // VSI: the lagged (pressure) altitude in the case
function setting(){ return S.set==='std'?1013.25:S.set==='qfe'?A.qfe(ELEV,S.qnhA,S.dT):S.qnhSet; }
function model(){ const p=A.pAtTrue(S.alt,S.qnhA,S.dT), pa=A.pressAlt(p), cas=Math.max(0,S.ias+S.pe), qc=A.qcFromCas(cas), pt=p+qc;
  const trap=S.trap||{ps:p,pt}, sen=A.sensed({ps:p,pt,fault:S.fault,trap,alt:S.altSt,altDp:ALTDP}), set=setting();
  const ind=A.indicated(sen.ps,set), indOk=A.indicated(p,set), sp=A.speeds(cas,pa,S.dT);
  const iasShown=Math.max(0,A.casFromQc(sen.qc)-S.pe), machShown=A.machFromQc(sen.qc,sen.ps), altSeen=A.pressAlt(sen.ps);
  const vsi=lag==null?0:A.vsiRead(lag,altSeen,TAU);
  /* what the pilot thinks: the reading on its own datum (sea level for QNH, the aerodrome for QFE, the 1013 level for STD = pressure altitude) */
  const think=S.set==='qfe'?ELEV+ind:ind;
  return {p,pa,cas,qc,pt,sen,set,ind,indOk,sp,iasShown,machShown,altSeen,vsi,think,clear:S.alt-RIDGE,oat:sp.T}; }
/* the pilot flies the altimeter: change something, keep the reading */
function altForInd(ind){ const p=A.pressAt(A.pressAlt(setting())+ind); return clamp(A.trueFromP(p,S.qnhA,S.dT),-500,41000); }
function holdInd(fn){ const ind=model().indOk; fn(); S.alt=altForInd(ind); }
function snapVsi(){ lag=model().altSeen; }

/* ---------------- canvas helpers ---------------- */
const cv=el('adv'); const ST=LAB.fit(cv,()=>draw(),2);
let FS=1;
function txt(g,s,x,y,col,al,sz,wt,font){ g.font=`${wt||500} ${Math.round((sz||12)*FS*10)/10}px ${font||MONO}`; g.fillStyle=col||C.txt; g.textAlign=al||'left'; g.textBaseline='alphabetic'; g.fillText(s,x,y); g.textAlign='left'; }
function line(g,x1,y1,x2,y2,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]); }
function poly(g,pts,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.setLineDash([]); }
function dot(g,x,y,r,fill,stroke,w){ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=w||1.5; g.stroke(); } }
function rr(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }
function tag(g,s,x,y,col,o){ o=o||{}; const sz=(o.sz||11.5)*FS; g.font=`${o.wt||600} ${sz}px ${o.font||SANS}`; const w=g.measureText(s).width+10, h=sz+7;
  let bx=o.al==='right'?x-w:o.al==='center'?x-w/2:x; bx=clamp(bx,2,ST.w-w-2); const by=y-h/2;
  if(o.bg!==false){ g.fillStyle='rgba(10,14,18,.8)'; rr(g,bx,by,w,h,3); g.fill(); }
  g.fillStyle=col||C.txt; g.textBaseline='middle'; g.textAlign='left'; g.fillText(s,bx+5,y+0.5); g.textBaseline='alphabetic'; return [bx,by,bx+w,by+h]; }
function cross(g,x,y,s,col){ line(g,x-s,y-s,x+s,y+s,col||C.red,2.4); line(g,x-s,y+s,x+s,y-s,col||C.red,2.4); }
function plane(g,x,y,s,col,dash){ /* side view, nose right */ g.save(); g.translate(x,y); g.scale(s/20,s/20); g.beginPath();
  g.moveTo(-20,-1); g.lineTo(-17,-7); g.lineTo(-14,-7); g.lineTo(-11,-2); g.lineTo(12,-2.5); g.quadraticCurveTo(19,-2,20,0.5); g.quadraticCurveTo(18,2.5,12,2.5); g.lineTo(-18,2); g.closePath();
  if(dash){ g.setLineDash([3,2.5]); g.strokeStyle=col; g.lineWidth=1.4*20/s; g.stroke(); g.setLineDash([]); } else { g.fillStyle=col; g.fill(); }
  g.beginPath(); g.moveTo(-2,0.5); g.lineTo(5,0.5); g.lineTo(-1,5.5); g.lineTo(-4,5.5); g.closePath(); if(dash){ g.setLineDash([3,2.5]); g.stroke(); g.setLineDash([]); } else g.fill(); g.restore(); }

/* ---------------- the gauges ---------------- */
function face(g,cx,cy,r){ const gr=g.createRadialGradient(cx,cy-r*0.3,r*0.2,cx,cy,r*1.08); gr.addColorStop(0,'#3a434b'); gr.addColorStop(1,'#11161b');
  dot(g,cx,cy,r*1.08,gr); dot(g,cx,cy,r,'#090C0F','rgba(255,255,255,.12)',1); }
function glassHi(g,cx,cy,r){ const gr=g.createLinearGradient(cx,cy-r,cx,cy); gr.addColorStop(0,'rgba(255,255,255,.07)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.beginPath(); g.ellipse(cx,cy-r*0.45,r*0.8,r*0.5,0,0,Math.PI*2); g.fill(); }
function ticks(g,cx,cy,r,list,angOf,lab){ for(const [v,big] of list){ const a=angOf(v)*D2R, l=big?0.15:0.08; line(g,cx+Math.sin(a)*r*0.97,cy-Math.cos(a)*r*0.97,cx+Math.sin(a)*r*(0.97-l),cy-Math.cos(a)*r*(0.97-l),big?'#E6ECF0':'#9AA6B1',big?1.6:1); }
  for(const [v,s] of lab){ const a=angOf(v)*D2R; g.font=`600 ${Math.max(8,r*0.2)}px ${SANS}`; g.fillStyle='#EEF2F5'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(s,cx+Math.sin(a)*r*0.66,cy-Math.cos(a)*r*0.66); } g.textAlign='left'; g.textBaseline='alphabetic'; }
function hand(g,cx,cy,a,len,w,col,tail){ const s=Math.sin(a*D2R), c=-Math.cos(a*D2R); g.strokeStyle=col; g.lineCap='round'; g.lineWidth=w; g.beginPath(); g.moveTo(cx-s*(tail||0),cy-c*(tail||0)); g.lineTo(cx+s*len,cy+c*len); g.stroke(); g.lineCap='butt'; }
const asiA=v=>-150+300*Math.sqrt(clamp(v,0,400)/400);
const vsiA=v=>-90+clamp(v,-2000,2000)/2000*170;
const machA=m=>-150+300*(clamp(m,0.2,1)-0.2)/0.8;
function gASI(g,cx,cy,r,v){ face(g,cx,cy,r);
  const L1=[]; for(let k=10;k<=200;k+=10) L1.push([k,k%50===0]); for(let k=250;k<=400;k+=50) L1.push([k,true]);
  ticks(g,cx,cy,r,L1,asiA,[[50,'50'],[100,'100'],[150,'150'],[200,'200'],[300,'300'],[400,'400']]);
  txt(g,'KT',cx,cy+r*0.42,'#8E99A4','center',Math.max(7,r*0.13)/FS,600,SANS); hand(g,cx,cy,asiA(v),r*0.86,Math.max(2,r*0.06),'#F4F7F9',r*0.15); dot(g,cx,cy,r*0.08,'#2a3036'); glassHi(g,cx,cy,r); }
function gALT(g,cx,cy,r,v,set){ face(g,cx,cy,r);
  const L1=[]; for(let k=0;k<1000;k+=20) L1.push([k,k%100===0]); ticks(g,cx,cy,r,L1,x=>x/1000*360,[0,1,2,3,4,5,6,7,8,9].map(i=>[i*100,String(i)]));
  /* Kollsman window */
  const kw=r*0.56, kh=r*0.24, kx=cx+r*0.12, ky=cy-kh/2+r*0.02; g.fillStyle='#000'; rr(g,kx,ky,kw,kh,2); g.fill(); g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1; g.stroke();
  g.font=`600 ${Math.max(8,r*0.16)}px ${MONO}`; g.fillStyle=C.amb; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(Math.round(set)),kx+kw/2,ky+kh/2+0.5); g.textAlign='left'; g.textBaseline='alphabetic';
  const w=((v%100000)+100000)%100000;
  hand(g,cx,cy,w/100000*360,r*0.9,Math.max(1,r*0.025),'#C9D2DA');                  // 10 000 ft
  hand(g,cx,cy,w/10000*360,r*0.5,Math.max(3,r*0.1),'#F4F7F9');                       // 1 000 ft
  hand(g,cx,cy,w/1000*360,r*0.86,Math.max(2,r*0.055),'#F4F7F9',r*0.15);             // 100 ft
  if(v<0){ g.fillStyle='rgba(236,90,71,.85)'; g.fillRect(cx-r*0.48,cy+r*0.3,r*0.3,r*0.14); }
  dot(g,cx,cy,r*0.08,'#2a3036'); glassHi(g,cx,cy,r); }
function gVSI(g,cx,cy,r,v){ face(g,cx,cy,r);
  const L1=[]; for(let k=-2000;k<=2000;k+=100) L1.push([k,k%500===0]); ticks(g,cx,cy,r,L1,vsiA,[[0,'0'],[500,'5'],[1000,'10'],[1500,'15'],[-500,'5'],[-1000,'10'],[-1500,'15']]);
  txt(g,'UP',cx-r*0.32,cy-r*0.32,'#8E99A4','center',Math.max(7,r*0.13)/FS,600,SANS); txt(g,'DN',cx-r*0.32,cy+r*0.42,'#8E99A4','center',Math.max(7,r*0.13)/FS,600,SANS);
  hand(g,cx,cy,vsiA(v),r*0.86,Math.max(2,r*0.06),'#F4F7F9',r*0.15); dot(g,cx,cy,r*0.08,'#2a3036'); glassHi(g,cx,cy,r); }
function gMACH(g,cx,cy,r,m){ face(g,cx,cy,r);
  const L1=[]; for(let k=0.2;k<=1.001;k+=0.05) L1.push([k,Math.round(k*100)%10===0]); ticks(g,cx,cy,r,L1,machA,[[0.3,'.3'],[0.5,'.5'],[0.7,'.7'],[0.9,'.9']]);
  g.font=`600 ${Math.max(8,r*0.17)}px ${MONO}`; g.fillStyle=C.txt; g.textAlign='center'; g.fillText('M '+m.toFixed(2).replace(/^0/,''),cx,cy+r*0.48); g.textAlign='left';
  hand(g,cx,cy,machA(m),r*0.86,Math.max(2,r*0.06),'#F4F7F9',r*0.15); dot(g,cx,cy,r*0.08,'#2a3036'); glassHi(g,cx,cy,r); }

/* displayed needle values (smoothed so the needles move) */
const D={ias:null,alt:null,vsi:null,m:null};

/* ---------------- the figure ---------------- */
let GEO=null;
function draw(){ if(!ST.w) return; const g=ST.ctx, W=ST.w, H=ST.h; g.setTransform(ST.dpr,0,0,ST.dpr,0,0); g.clearRect(0,0,W,H);
  FS=depth()==='instructor'?1.15:W<420?0.9:1; const M=model(), ph=W<640;
  if(D.ias==null){ D.ias=M.iasShown; D.alt=M.ind; D.vsi=M.vsi; D.m=M.machShown; }
  const chip=el('chip'); let cl=0; if(!ph&&chip&&getComputedStyle(chip).position==='absolute'&&chip.offsetWidth) cl=chip.offsetLeft+chip.offsetWidth+10;
  /* layout */
  let sch, ins, side;
  if(ph){ sch=[8,6,W-16,H*0.17]; ins=[8,H*0.19,W-16,H*0.31]; side=[8,H*0.53,W-16,H*0.47-8]; }
  else { const xs=W*0.6; sch=[cl||12,10,xs-(cl||12)-14,H*0.36]; ins=[8,H*0.42,xs-16,H*0.58-10]; side=[xs+6,10,W-xs-16,H-20]; }
  const n=deepOn()?4:3, gw=ins[2]/n, r=Math.max(26,Math.min(gw*0.4,ins[3]*0.38,(ins[3]-50)/2.16));
  const gy0=ins[1]+Math.max(12,(ins[3]-(2.16*r+50))*(ph?0.3:0.42))+r*1.08, gs=[]; for(let i=0;i<n;i++) gs.push([ins[0]+gw*(i+0.5),gy0]);
  drawSchematic(g,M,sch,ins,gs,r);
  const fl=flags(M);
  gASI(g,gs[0][0],gs[0][1],r,D.ias); gALT(g,gs[1][0],gs[1][1],r,D.alt,M.set); gVSI(g,gs[2][0],gs[2][1],r,D.vsi); if(n===4) gMACH(g,gs[3][0],gs[3][1],r,D.m);
  const cap=(i,name,val,bad,real)=>{ const [x,y]=gs[i]; txt(g,name,x,y+r*1.08+14,C.mut,'center',10,600,SANS); txt(g,val,x,y+r*1.08+29,bad?C.amb:C.txt,'center',ph?11:12.5,600);
    if(bad&&real) txt(g,real,x,y+r*1.08+43,C.dim,'center',10); };
  cap(0,L(t2('AIRSPEED','FART')),Math.round(M.iasShown)+' kt',fl.asi,L(t2('real ','virkelig '))+Math.round(S.ias)+' kt');
  cap(1,L(t2('ALTIMETER','HØYDEMÅLER')),S.set==='std'?'FL '+String(Math.max(0,Math.round(M.ind/100))).padStart(3,'0'):ft(M.ind),fl.alt,L(t2('should read ','skulle vist '))+ft(M.indOk));
  cap(2,'VSI',sg(Math.round(M.vsi/10)*10)+' ft/min',fl.vsi,L(t2('real ','virkelig '))+sg(S.vs));
  if(n===4) cap(3,'MACH','M '+M.machShown.toFixed(2),fl.asi,null);
  if(S.mode==='spd') drawSpeeds(g,M,side); else drawProfile(g,M,side);
}
function flags(M){ return {asi:Math.abs(M.iasShown-S.ias)>3,alt:Math.abs(M.ind-M.indOk)>30,vsi:(S.fault==='static'||S.fault==='both')&&Math.abs(S.vs)>100}; }

/* the pitot-static schematic: fuselage nose on the left, pitot probe under it, static port on the side, pipes down to the gauges */
function drawSchematic(g,M,b,ins,gs,r){ const [x0,y0,w,h]=b, ph=ST.w<640;
  const fy=y0+h*0.42, fh=Math.min(h*0.5,64), nx=x0+w*0.04, fx1=x0+w*0.98;
  /* fuselage */
  g.fillStyle='#26313b'; g.strokeStyle='rgba(214,226,236,.35)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(fx1,fy-fh/2); g.lineTo(nx+fh*0.9,fy-fh/2); g.bezierCurveTo(nx+fh*0.2,fy-fh/2,nx,fy-fh*0.1,nx,fy+fh*0.05); g.bezierCurveTo(nx,fy+fh*0.35,nx+fh*0.4,fy+fh/2,nx+fh,fy+fh/2); g.lineTo(fx1,fy+fh/2); g.fill(); g.stroke();
  g.fillStyle='rgba(127,203,232,.25)'; g.beginPath(); g.moveTo(nx+fh*0.55,fy-fh*0.12); g.lineTo(nx+fh*0.95,fy-fh*0.4); g.lineTo(nx+fh*1.5,fy-fh*0.4); g.lineTo(nx+fh*1.5,fy-fh*0.12); g.closePath(); g.fill();
  /* pitot probe under the nose, pointing forward */
  const py=fy+fh/2+Math.min(14,h*0.12), pxT=nx-Math.min(10,w*0.02), pxB=nx+fh*1.3;
  line(g,pxB,fy+fh/2,pxB,py,'#AEB8C1',3); line(g,pxT,py,pxB,py,'#AEB8C1',4.5);
  const pBlk=S.fault==='pitot'||S.fault==='pitotDrain'||S.fault==='both', dBlk=S.fault==='pitotDrain'||S.fault==='both';
  if(S.ice&&pBlk){ g.fillStyle='rgba(225,240,255,.9)'; g.beginPath(); g.arc(pxT,py,5.5,0,Math.PI*2); g.fill(); } else if(pBlk) cross(g,pxT-1,py,5);
  const dx=pxT+(pxB-pxT)*0.35; dot(g,dx,py+2.6,1.8,'#0c1217','#AEB8C1',1); if(dBlk) cross(g,dx,py+8,3.5);
  /* static port on the fuselage side, and the alternate static valve inside */
  const sx=x0+w*(ph?0.62:0.58), sy=fy+fh*0.1; const sBlk=S.fault==='static'||S.fault==='both';
  dot(g,sx,sy,4.5,'#0c1217','#AEB8C1',1.5); dot(g,sx,sy,1.6,'#AEB8C1'); if(sBlk) cross(g,sx,sy,6);
  const ax=x0+w*(ph?0.82:0.8), ay=fy-fh*0.12; const showAlt=S.mode==='blk'||S.altSt;
  /* pipe routing */
  const man=ins[1]-6, mT=man-10, gTop=i=>gs[i][1]-r*1.08;
  const tCol=pBlk?'rgba(240,180,64,.45)':C.tot, sCol=sBlk&&!S.altSt?'rgba(127,203,232,.45)':C.st;
  /* total pressure: probe → down → to the ASI (and the Mach meter) */
  const tx=pxB+8; poly(g,[[pxB,py],[tx,py],[tx,mT],[gs[0][0]-r*0.35,mT],[gs[0][0]-r*0.35,gTop(0)+r*0.12]],tCol,2.6,pBlk?[5,4]:null);
  if(gs[3]) poly(g,[[tx,mT],[tx,mT-4]],tCol,2.6);
  if(gs[3]){ poly(g,[[gs[0][0]-r*0.35,mT],[gs[3][0]-r*0.35,mT],[gs[3][0]-r*0.35,gTop(3)+r*0.12]],tCol,2.2,pBlk?[5,4]:null); }
  /* static: port → down → manifold → each gauge */
  const sOut=[[sx,sy],[sx,man]]; poly(g,sOut,sCol,2.6,sBlk&&!S.altSt?[5,4]:null);
  const xs=gs.map(p=>p[0]+r*0.35); poly(g,[[Math.min(...xs,sx),man],[Math.max(...xs,sx),man]],sCol,2.6,sBlk&&!S.altSt?[5,4]:null);
  xs.forEach((x,i)=>poly(g,[[x,man],[x,gTop(i)+r*0.12]],sCol,2.2,sBlk&&!S.altSt?[5,4]:null));
  if(showAlt){ const open=S.altSt; line(g,ax,ay,ax,man,open?C.st:'rgba(127,203,232,.3)',2,open?null:[3,3]); line(g,Math.min(ax,Math.max(...xs,sx)),man,Math.max(ax,Math.max(...xs,sx)),man,open?C.st:'rgba(127,203,232,.3)',2,open?null:[3,3]);
    g.fillStyle=open?'#1f3a4a':'#1a2027'; rr(g,ax-9,ay-7,18,14,3); g.fill(); g.strokeStyle=open?C.st:'#6F7E8B'; g.lineWidth=1.3; g.stroke(); line(g,ax-5,ay,ax+5,ay,open?C.st:'#6F7E8B',1.6);
    if(!ph||deepOn()) tag(g,L(t2('alternate static','alternativ statisk')),ax,ay-16,open?C.st:C.mut,{sz:10,al:'center',bg:false}); }
  /* labels */
  const lt=deepOn()?' '+hp(Math.round(M.sen.pt)):'', ls=deepOn()?' '+hp(Math.round(M.sen.ps)):'';
  tag(g,L(t2('pitot: total pressure','pitot: totaltrykk'))+lt,pxT-2,py+(ph?16:18),C.tot,{sz:ph?10:11});
  if(!ph||true) tag(g,L(t2('drain','drenering')),dx+10,py+(ph?30:32),C.mut,{sz:9.5,bg:false});
  tag(g,L(t2('static port','statisk port'))+ls,sx-10,sy-13,C.st,{sz:ph?10:11,al:'right'});
  GEO={pitot:[pxT,py],stat:[sx,sy]};
}

/* side profile: terrain, sea level, the aerodrome and the ridge; the aircraft at its real altitude and a ghost where the altimeter says */
function drawProfile(g,M,b){ const [x0,y0,w,h]=b, ph=ST.w<640;
  g.fillStyle='rgba(6,9,12,.35)'; rr(g,x0,y0,w,h,6); g.fill();
  const hi=Math.max(S.alt,M.think,RIDGE+800), top=hi<6000?6000:hi<12000?Math.ceil((hi+1500)/2000)*2000:Math.ceil((hi*1.12)/5000)*5000, bot=-top*0.06;
  const pl=x0+(ph?40:48), pr=x0+w-10, pt=y0+(ph?30:26), pb=y0+h-(ph?16:22), Y=f=>pb-(f-bot)/(top-bot)*(pb-pt), X=u=>pl+u*(pr-pl);
  /* temperature tint */
  if(Math.abs(S.dT)>=3){ const a=Math.min(0.2,Math.abs(S.dT)/120); g.fillStyle=S.dT<0?`rgba(110,160,240,${a})`:`rgba(240,140,90,${a})`; g.fillRect(pl,pt,pr-pl,pb-pt); }
  /* grid and axis */
  const step=top<=6000?1000:top<=12000?2000:top<=25000?5000:10000;
  for(let f=0;f<=top;f+=step){ line(g,pl,Y(f),pr,Y(f),C.grid,1); txt(g,f>=1000?nf(f/1000,0)+'k':'0',pl-6,Y(f)+4,C.dim,'right',10); }
  
  /* sea and terrain */
  g.fillStyle='rgba(60,110,150,.35)'; g.fillRect(pl,Y(0),X(0.06)-pl,pb-Y(0)+1);
  const ter=u=>u<0.06?-200:u<0.1?(u-0.06)/0.04*ELEV:u<0.32?ELEV:u<0.55?ELEV+(RIDGE-ELEV)*Math.pow(Math.sin((u-0.32)/0.46*Math.PI),2):u<0.78?RIDGE*Math.pow(Math.cos((u-0.55)/0.46*Math.PI),2)+ELEV*0.6*(1-Math.pow(Math.cos((u-0.55)/0.46*Math.PI),2)):ELEV*0.6+(u-0.78)*400;
  g.fillStyle=C.ter; g.beginPath(); g.moveTo(pl,pb); for(let i=0;i<=120;i++){ const u=i/120; g.lineTo(X(u),Y(Math.max(bot,ter(u)))); } g.lineTo(pr,pb); g.closePath(); g.fill();
  poly(g,Array.from({length:121},(_,i)=>[X(i/120),Y(Math.max(bot,ter(i/120)))]),C.terL,1.3);
  line(g,pl,Y(0),pr,Y(0),'rgba(127,203,232,.45)',1,[5,4]); txt(g,L(t2('sea level','havnivå')),X(0.99),Y(0)+13,'rgba(127,203,232,.8)','right',9.5);
  /* runway */
  line(g,X(0.13),Y(ELEV),X(0.3),Y(ELEV),'#E6ECF0',3); txt(g,L(t2('aerodrome ','flyplass '))+nf(ELEV,0)+' ft',X(0.13),Y(ELEV)+15,C.mut,'left',9.5);
  const ux=0.55, ax=X(S.mode==='set'?0.215:ux), rx=X(ux);
  txt(g,L(t2('ridge ','ås '))+nf(RIDGE,0)+' ft',rx,Y(RIDGE)+16,C.mut,'center',9.5);
  /* datums: QFE (aerodrome) and the 1013 hPa level */
  if(S.set==='std'&&S.mode!=='blk'){ const z=-A.pressAlt(S.qnhA)*1; const zt=A.trueFromP(1013.25,S.qnhA,S.dT); line(g,pl,Y(zt),pr,Y(zt),'rgba(201,182,242,.55)',1,[2,4]); txt(g,'1013 hPa',pr-4,Y(zt)+(zt<0?12:-5),C.ind,'right',9.5); void z; }
  /* the ghost: where the altimeter says you are */
  const real=S.alt, th=M.think, gy=Y(clamp(th,bot,top)), ry=Y(real), size=ph?20:26;
  const diff=real-th;
  if(Math.abs(diff)>15){ line(g,ax-size*1.6,gy,ax+size*1.6,gy,'rgba(201,182,242,.55)',1,[4,4]); plane(g,ax,gy,size,C.ind,true); }
  /* clearance over the ridge */
  const cl=real-RIDGE, ccol=cl<0?C.red:cl<1000?C.amb:C.ok, showCl=S.mode!=='set'&&real>RIDGE-3000&&real<top;
  if(showCl){ line(g,ax+size*1.3,ry,ax+size*1.3,Y(RIDGE),ccol,1.2,[2,3]); }
  plane(g,ax,ry,size,'#F4F7F9');
  /* the error bracket */
  const bx=ax-size*1.5;
  if(Math.abs(diff)>15){ const col=diff<0?C.red:C.ok; line(g,bx,gy,bx,ry,col,2); line(g,bx-4,gy,bx+4,gy,col,2); line(g,bx-4,ry,bx+4,ry,col,2);
    tag(g,(diff<0?L(t2('','')):'')+nf(Math.abs(Math.round(diff/10)*10),0)+' ft '+(diff<0?L(t2('lower than you think','lavere enn du tror')):L(t2('higher than you think','høyere enn du tror'))),bx-8,(gy+ry)/2,col,{al:'right',sz:ph?10.5:11.5}); }
  /* labels for the aircraft and the ghost */
  const sep=Math.abs(gy-ry)<22, lab1=L(t2('real ','virkelig '))+ft(real), lab2=(S.set==='std'?L(t2('altimeter (STD) ','høydemåler (STD) ')):L(t2('altimeter ','høydemåler ')))+(S.set==='qfe'?ft(M.ind)+L(t2(' above aerodrome',' over flyplassen')):ft(M.ind));
  if(Math.abs(diff)>15){ tag(g,lab1,ax+size*1.6,ry+(sep?(diff<0?10:-10):0),C.txt,{sz:ph?10.5:11.5}); tag(g,lab2,ax+size*1.6,gy+(sep?(diff<0?-10:10):0),C.ind,{sz:ph?10.5:11.5}); }
  else tag(g,lab2+' = '+L(t2('real','virkelig')),ax+size*1.6,ry-(S.alt<ELEV+400?16:0),C.txt,{sz:ph?10.5:11.5});
  if(showCl) tag(g,L(t2('clearance ','klaring '))+sg(Math.round(cl/10)*10)+' ft',ax+size*1.3+4,(ry+Y(RIDGE))/2+(Math.abs(ry-Y(RIDGE))<40?16:0),ccol,{sz:ph?10:10.5,bg:false});
  /* header */
  const hdr=S.dT===0&&Math.abs(S.qnhA-1013.25)<0.5?'ISA':`QNH ${Math.round(S.qnhA)} · ISA ${S.dT>0?'+':S.dT<0?'−':'±'}${Math.abs(S.dT)} °C`;
  txt(g,L(t2('SIDE VIEW','SIDEBILDE')),x0+10,y0+16,'#AEB8C1','left',10.5,600); txt(g,hdr,pr,y0+16,C.mut,'right',10.5);
}

/* the speed ladder: IAS → CAS → EAS → TAS (and Mach) */
function drawSpeeds(g,M,b){ const [x0,y0,w,h]=b, ph=ST.w<640, d=deepOn();
  g.fillStyle='rgba(6,9,12,.35)'; rr(g,x0,y0,w,h,6); g.fill();
  const sp=M.sp, rows=[['IAS',S.ias,'#E6ECF0',t2('what the ASI shows','det fartsmåleren viser')]];
  if(d) rows.push(['CAS',M.cas,'#C9D2DA',t2('+ position and instrument error','+ posisjons- og instrumentfeil')]);
  if(d) rows.push(['EAS',sp.eas,'#7FCBE8',t2('− compressibility','− kompressibilitet')]);
  rows.push(['TAS',sp.tas,C.tot,t2('÷ √(density ratio)','÷ √(tetthetsforhold)')]);
  const mx=Math.max(...rows.map(r=>r[1]),60)*1.12, l=x0+(ph?44:56), rgt=x0+w-14, top=y0+(ph?26:44), rh=Math.min(ph?34:50,(h-(ph?70:110))/rows.length);
  txt(g,L(t2('FROM IAS TO TAS','FRA IAS TIL TAS')),x0+10,y0+(ph?14:18),'#AEB8C1','left',10.5,600);
  rows.forEach(([n,v,col,note],i)=>{ const y=top+i*rh, bw=(rgt-l)*v/mx;
    txt(g,n,l-8,y+rh*0.42,col,'right',12,700); g.fillStyle=col; g.globalAlpha=0.85; rr(g,l,y+rh*0.18,Math.max(2,bw),rh*0.36,3); g.fill(); g.globalAlpha=1;
    txt(g,Math.round(v)+' kt',Math.min(l+Math.max(bw,n==='TAS'?(rgt-l)*A.tasThumb(S.ias,M.pa)/mx:0)+8,rgt-46),y+rh*0.42,C.txt,'left',12,600);
    if(i>0) txt(g,L(note),l+2,y+rh*0.86,C.mut,'left',ph?9.5:10.5,500,SANS); else txt(g,L(note),l+2,y+rh*0.86,C.mut,'left',ph?9.5:10.5,500,SANS); });
  /* the rule of thumb */
  const thumb=A.tasThumb(S.ias,M.pa), tx=l+(rgt-l)*thumb/mx, ly=top+rows.length*rh;
  const lastY=top+(rows.length-1)*rh; line(g,tx,lastY+rh*0.1,tx,lastY+rh*0.62,'#F4F7F9',1.5,[3,2]);
  let y=ly+(ph?10:16);
  txt(g,L(t2('dashed: rule of thumb, IAS + 2 % per 1000 ft = ','stiplet: tommelfingerregel, IAS + 2 % per 1000 ft = '))+Math.round(thumb)+' kt',l,y,C.mut,'left',ph?9.5:10.5,500,SANS); y+=ph?16:20;
  txt(g,L(t2('pressure altitude ','trykkhøyde '))+ft(M.pa)+' · OAT '+nf(sp.T,0)+' °C · σ '+sp.sigma.toFixed(2),l,y,C.mut,'left',ph?9.5:10.5); y+=ph?16:20;
  if(d){ txt(g,'Mach '+sp.M.toFixed(2)+' · '+L(t2('speed of sound ','lydhastighet '))+Math.round(sp.a)+' kt',l,y,C.mut,'left',ph?9.5:10.5); y+=ph?16:20; }
  /* TAS against altitude at this IAS: why TAS grows as you climb */
  const cx0=l, cx1=rgt-8, cy0=y+(ph?14:22), cy1=y0+h-(ph?24:30); if(cy1-cy0<60) return;
  const amax=M.pa<9000?12000:M.pa<18000?24000:41000, pts=[]; for(let i=0;i<=60;i++){ const al=amax*i/60; pts.push([al,A.speeds(M.cas,al,S.dT).tas]); }
  const vmax=Math.max(...pts.map(q=>q[1]),A.tasThumb(S.ias,amax))*1.05, vmin=S.ias*0.9, XX=al=>cx0+al/amax*(cx1-cx0), YY=v=>cy1-(v-vmin)/(vmax-vmin)*(cy1-cy0);
  line(g,cx0,cy1,cx1,cy1,'rgba(214,226,236,.3)',1); line(g,cx0,cy0,cx0,cy1,'rgba(214,226,236,.3)',1);
  for(let al=0;al<=amax;al+=amax>20000?10000:amax>12000?5000:2000) txt(g,al?nf(al/1000,0)+'k':'0',XX(al),cy1+13,C.dim,'center',9.5);
  txt(g,L(t2('pressure altitude (ft)','trykkhøyde (ft)')),cx1,cy1+(ph?24:26),C.dim,'right',9.5);
  poly(g,[[XX(0),YY(S.ias)],[XX(amax),YY(A.tasThumb(S.ias,amax))]],'rgba(244,247,249,.5)',1.2,[3,3]);
  poly(g,pts.map(([al,v])=>[XX(al),YY(v)]),C.tot,2.4); line(g,cx0,YY(S.ias),cx1,YY(S.ias),'rgba(230,236,240,.35)',1,[2,4]);
  dot(g,XX(clamp(M.pa,0,amax)),YY(sp.tas),5,'#0c1217',C.tot,2);
  txt(g,L(t2(`TAS at ${Math.round(S.ias)} kt IAS`,`TAS ved ${Math.round(S.ias)} kt IAS`)),cx0+6,cy0+2,C.tot,'left',ph?10:11,600,SANS);
  txt(g,'IAS',cx1,YY(S.ias)-5,C.mut,'right',9.5);
}

/* ---------------- readout chip, legend, "what you're seeing" ---------------- */
const ch=(i,b,cls)=>`<span><i>${i}</i><b${cls?` class="${cls}"`:''}>${b}</b></span>`;
function readout(){ const M=model(), d=deepOn(); let h='';
  const setName=S.set==='std'?'STD 1013':S.set==='qfe'?'QFE '+Math.round(M.set):'QNH '+Math.round(S.qnhSet);
  if(S.mode==='set'){ h=ch(L(t2('Subscale','Innstilling')),setName,'a')+ch(L(t2('Altimeter reads','Høydemåleren viser')),S.set==='std'?'FL '+String(Math.max(0,Math.round(M.ind/100))).padStart(3,'0'):ft(M.ind))
     +ch(L(t2('Real altitude','Virkelig høyde')),ft(S.alt))+ch(L(t2('Height above aerodrome','Høyde over flyplassen')),ft(S.alt-ELEV))+(d?ch(L(t2('Pressure altitude','Trykkhøyde')),ft(M.pa)):''); }
  else if(S.mode==='err'){ const e=S.alt-M.think; h=ch(L(t2('Altimeter','Høydemåler')),ft(M.ind),'')+ch(L(t2('Real altitude','Virkelig høyde')),ft(S.alt))
     +ch(L(t2('Error','Feil')),Math.abs(e)<15?'0 ft':sg(Math.round(e/10)*10)+' ft',e<-15?'r':e>15?'g':'')+ch(L(t2('Clearance over the ridge','Klaring over åsen')),sg(Math.round(M.clear/10)*10)+' ft',M.clear<0?'r':M.clear<1000?'a':'g'); }
  else if(S.mode==='spd'){ const sp=M.sp; h=ch('IAS',Math.round(S.ias)+' kt')+(d?ch('CAS',Math.round(M.cas)+' kt')+ch('EAS',Math.round(sp.eas)+' kt'):'')+ch('TAS',Math.round(sp.tas)+' kt','a')+(d?ch('Mach',sp.M.toFixed(2)):ch('OAT',nf(sp.T,0)+' °C')); }
  else { const fl=flags(M); h=ch(L(t2('ASI shows','Fartsmåler viser')),Math.round(M.iasShown)+' kt',fl.asi?'a':'')+ch(L(t2('Real IAS','Virkelig IAS')),Math.round(S.ias)+' kt')
     +ch(L(t2('Altimeter shows','Høydemåler viser')),ft(M.ind),fl.alt?'a':'')+ch(L(t2('Real altitude','Virkelig høyde')),ft(S.alt))+ch(L(t2('VSI shows','VSI viser')),sg(Math.round(M.vsi/10)*10)+' ft/min',fl.vsi?'a':''); }
  el('chip').innerHTML=h;
  el('xsv').textContent=VIEWS.find(v=>v[0]===S.mode)?L(VIEWS.find(v=>v[0]===S.mode)[1]):''; }
function legend(){ const lg=(c,t,k)=>`<span><i class="${k||''}" style="--c:${c}"></i>${L(t)}</span>`;
  let s=lg(C.tot,t2('total (pitot) pressure','totaltrykk (pitot)'))+lg(C.st,t2('static pressure','statisk trykk'));
  if(S.mode!=='spd') s+=lg('#F4F7F9',t2('aircraft: real altitude','fly: virkelig høyde'),'sq')+lg(C.ind,t2('where the altimeter says you are','der høydemåleren sier du er'),'d');
  if(S.mode==='blk') s+=lg(C.amb,t2('wrong reading','feil visning'),'sq');
  el('vleg').innerHTML=s; }
function see(){ const M=model(); let t;
  if(S.mode==='set') t= S.set==='qnh'? t2('<b>QNH:</b> the altimeter reads your altitude above sea level, and the aerodrome elevation on the ground. Terrain and minimum altitudes on charts are given the same way.','<b>QNH:</b> høydemåleren viser høyden over havet, og flyplasshøyden på bakken. Terreng og minstehøyder på kartet er oppgitt på samme måte.')
    : S.set==='qfe'? t2('<b>QFE:</b> the altimeter reads height above the aerodrome, and zero on the runway.','<b>QFE:</b> høydemåleren viser høyde over flyplassen, og null på rullebanen.')
    : t2(`<b>Standard 1013:</b> the altimeter reads pressure altitude, ${ft(M.ind)}, which is flight level ${String(Math.max(0,Math.round(M.ind/100))).padStart(3,'0')}. Everyone above the transition altitude uses the same setting, so they are separated from each other, even though nobody reads their real altitude.`,`<b>Standard 1013:</b> høydemåleren viser trykkhøyde, ${ft(M.ind)}, som er flygenivå ${String(Math.max(0,Math.round(M.ind/100))).padStart(3,'0')}. Alle over overgangshøyden bruker samme innstilling, så de er separert fra hverandre selv om ingen leser sin virkelige høyde.`);
  else if(S.mode==='err'){ const e=S.alt-M.think; t= Math.abs(e)<15? t2('<b>No error:</b> the right QNH is set and the air is ISA, so the altimeter reads your real altitude. Lower the actual QNH or make the air colder: you keep the reading, the aircraft sinks.','<b>Ingen feil:</b> riktig QNH er satt og luften er ISA, så høydemåleren viser virkelig høyde. Senk faktisk QNH eller gjør luften kaldere: du holder visningen, flyet synker.')
    : e<0? t2(`<b>You are ${ft(-e)} lower than the altimeter says.</b> You fly the reading, so lower pressure or colder air than the altimeter assumes takes the aircraft down towards the ridge.`,`<b>Du er ${ft(-e)} lavere enn høydemåleren sier.</b> Du flyr etter visningen, så lavere trykk eller kaldere luft enn høydemåleren antar tar flyet ned mot åsen.`)
    : t2(`<b>You are ${ft(e)} higher than the altimeter says.</b> Higher pressure or warmer air than assumed: safe for terrain, but you are not where ATC thinks.`,`<b>Du er ${ft(e)} høyere enn høydemåleren sier.</b> Høyere trykk eller varmere luft enn antatt: trygt for terrenget, men du er ikke der ATC tror.`); }
  else if(S.mode==='spd') t=t2(`<b>What you're seeing:</b> the ASI measures dynamic pressure, ½ρV². Higher up the air is thinner, so to feel the same ${Math.round(S.ias)} kt the aircraft must move faster through it: TAS ${Math.round(M.sp.tas)} kt.`,`<b>Det du ser:</b> fartsmåleren måler dynamisk trykk, ½ρV². Høyere opp er luften tynnere, så for å kjenne de samme ${Math.round(S.ias)} kt må flyet bevege seg raskere gjennom den: TAS ${Math.round(M.sp.tas)} kt.`);
  else { const F={none:t2('<b>All healthy.</b> Pick a fault, then climb or descend with the buttons and watch which instruments go wrong.','<b>Alt virker.</b> Velg en feil, stig eller synk med knappene, og se hvilke instrumenter som viser feil.'),
      pitot:t2('<b>Pitot blocked, drain open:</b> the trapped air leaks out through the drain until the pitot side holds only static pressure. The ASI falls to zero. Altimeter and VSI still work.','<b>Pitot blokkert, drenering åpen:</b> den fangede luften lekker ut gjennom dreneringen til pitotsiden bare har statisk trykk. Fartsmåleren faller til null. Høydemåler og VSI virker fortsatt.'),
      pitotDrain:t2('<b>Pitot and drain blocked:</b> the total pressure is trapped. The ASI now works like an altimeter: it reads more as you climb and less as you descend, whatever your real speed.','<b>Pitot og drenering blokkert:</b> totaltrykket er fanget. Fartsmåleren virker nå som en høydemåler: den viser mer når du stiger og mindre når du synker, uansett virkelig fart.'),
      static:t2('<b>Static blocked:</b> the altimeter freezes and the VSI goes to zero. The ASI still gets the real pitot pressure but the old static: it reads low above the blockage altitude and high below it, so it over-reads in a descent.','<b>Statisk blokkert:</b> høydemåleren fryser og VSI går til null. Fartsmåleren får fortsatt riktig pitottrykk, men det gamle statiske: den viser for lite over blokkeringshøyden og for mye under, så den viser for høyt i nedstigning.'),
      both:t2('<b>Both blocked:</b> every pressure is trapped. All three instruments freeze. Fly pitch and power, and use GPS altitude and groundspeed as a cross-check.','<b>Begge blokkert:</b> alle trykk er fanget. Alle tre instrumentene fryser. Fly pitch og effekt, og bruk GPS-høyde og -groundspeed som kryssjekk.')};
    t=F[S.fault]; if(S.altSt) t=t2('<b>Alternate static open:</b> it takes static pressure from inside the cabin, which is a little lower than outside. The altimeter and ASI read slightly high, and the VSI showed a short climb when you opened it.','<b>Alternativ statisk åpen:</b> den tar statisk trykk fra kabinen, som er litt lavere enn ute. Høydemåler og fartsmåler viser litt for høyt, og VSI viste en kort stigning da du åpnet den.'); }
  el('xsee').innerHTML=L(t); }

/* ---------------- tabs ---------------- */
const VIEWS=[['set',t2('Altimeter settings','Høydemålerinnstillinger')],['err',t2('Pressure & temperature errors','Trykk- og temperaturfeil')],['spd',t2('Airspeeds','Farter')],['blk',t2('Blockages','Blokkeringer')]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t])=>`<button type="button" role="tab" data-v="${k}" class="${k===S.mode?'on':''}" aria-selected="${k===S.mode}">${L(t)}</button>`).join(''); }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.v); });
function setMode(m){ if(!VIEWS.some(v=>v[0]===m)) m='set'; if(m!=='set'&&!(S.ias>0)) S.ias=120; if(m!=='set'&&S.alt<ELEV+500) S.alt=Math.max(S.alt,3000); if(S.mode==='blk'&&m!=='blk'){ S.fault='none'; S.trap=null; S.altSt=false; S.ice=false; }
  if((m==='blk'||m==='spd')&&S.mode!==m){ S.qnhSet=Math.round(S.qnhA); S.set='qnh'; }
  S.mode=m; el('xpanel').querySelectorAll('[data-pv]').forEach(d=>{ d.hidden=!d.dataset.pv.split(' ').includes(m); });
  syncCtl(); drawTabs(); drawPre(); snapVsi(); upd(); }

/* ---------------- controls ---------------- */
LAB.add({},{'Actual QNH':'Faktisk QNH','Temperature vs ISA':'Temperatur mot ISA','Real altitude':'Virkelig høyde','Altimeter reading you fly':'Høydemålervisningen du flyr','Vertical speed':'Vertikalfart','Airspeed (IAS)':'Fart (IAS)','QNH set in the window':'QNH satt i vinduet','Position error correction (CAS − IAS)':'Posisjonsfeilkorreksjon (CAS − IAS)',
 'None':'Ingen','Pitot blocked':'Pitot blokkert','Pitot + drain blocked':'Pitot + drenering blokkert','Static blocked':'Statisk blokkert','Both blocked':'Begge blokkert','QNH':'QNH','QFE':'QFE','STD 1013':'STD 1013'});
const sl={};
sl.qnhA=LAB.slider(el('wxCtl'),{label:'Actual QNH',min:960,max:1050,step:1,v:S.qnhA,f:v=>v+' hPa',on:v=>{ const f=()=>{ S.qnhA=v; }; if(S.mode==='err') holdInd(f); else f(); syncCtl(); snapVsi(); upd(); }});
sl.dT=LAB.slider(el('wxCtl'),{label:'Temperature vs ISA',min:-40,max:30,step:1,v:S.dT,f:v=>(v>0?'+':v<0?'−':'±')+Math.abs(v)+' °C',on:v=>{ const f=()=>{ S.dT=v; }; if(S.mode==='err') holdInd(f); else f(); syncCtl(); snapVsi(); upd(); }});
const setSeg=LAB.seg(el('setSeg'),[['qnh','QNH'],['qfe','QFE'],['std','STD 1013']],S.set,v=>{ const f=()=>{ S.set=v; }; if(S.mode==='err') holdInd(f); else f(); syncCtl(); snapVsi(); upd(); });
sl.qnhSet=LAB.slider(el('setCtl'),{label:'QNH set in the window',min:960,max:1050,step:1,v:S.qnhSet,f:v=>v+' hPa',on:v=>{ const f=()=>{ S.qnhSet=v; }; if(S.mode==='err') holdInd(f); else f(); syncCtl(); snapVsi(); upd(); }});
el('setQnh').onclick=()=>{ const f=()=>{ S.qnhSet=Math.round(S.qnhA); S.set='qnh'; }; if(S.mode==='err') holdInd(f); else f(); syncCtl(); snapVsi(); upd(); };
sl.alt=LAB.slider(el('flCtl'),{label:'Real altitude',min:0,max:41000,step:100,v:S.alt,f:v=>nf(v,0)+' ft',on:v=>{ S.alt=v; snapVsi(); upd(); }});
sl.ind=LAB.slider(el('flCtl'),{label:'Altimeter reading you fly',min:0,max:15000,step:100,v:S.alt,f:v=>nf(v,0)+' ft',on:v=>{ S.alt=altForInd(v); snapVsi(); upd(); }});
sl.vs=LAB.slider(el('flCtl'),{label:'Vertical speed',min:-2000,max:2000,step:100,v:S.vs,f:v=>sg(v)+' ft/min',on:v=>{ S.vs=v; drawVsBtns(); kick(); upd(); }});
sl.ias=LAB.slider(el('flCtl'),{label:'Airspeed (IAS)',min:0,max:350,step:5,v:S.ias,f:v=>v+' kt',on:v=>{ S.ias=v; upd(); }});
sl.pe=LAB.slider(el('adv2'),{label:'Position error correction (CAS − IAS)',min:-6,max:6,step:1,v:S.pe,f:v=>sg(v)+' kt',on:v=>{ S.pe=v; upd(); }});
const FAULTS=[['none','None'],['pitot','Pitot blocked'],['pitotDrain','Pitot + drain blocked'],['static','Static blocked'],['both','Both blocked']];
const faultSeg=LAB.seg(el('faultSeg'),FAULTS,S.fault,v=>setFault(v));
el('faultSeg').classList.add('wrap');
function setFault(v,ice){ const M=model(); S.trap=v==='none'?null:{ps:M.p,pt:M.pt}; S.fault=v; S.ice=!!ice; faultSeg.set(v); upd(); }
el('altSt').onchange=e=>{ S.altSt=e.target.checked; upd(); kick(); };   // no snap: the VSI shows the short jump
function syncCtl(){ /* the altitude slider: real altitude, or in "errors" the altimeter reading you hold */
  const M=model(), e=S.mode==='err'; sl.alt.el.hidden=e; sl.ind.el.hidden=!e;
  sl.alt.set(Math.round(S.alt/100)*100); sl.ind.set(Math.round(M.indOk/100)*100);
  sl.qnhSet.el.hidden=S.set!=='qnh'; el('setQnh').parentElement.hidden=S.set!=='qnh'; setSeg.set(S.set); sl.qnhA.set(S.qnhA); sl.dT.set(S.dT); sl.qnhSet.set(S.qnhSet); sl.ias.set(S.ias); sl.vs.set(S.vs); sl.pe.set(S.pe);
  el('altSt').checked=S.altSt; faultSeg.set(S.fault); drawVsBtns(); }
function drawVsBtns(){ el('vsBtns').innerHTML=[[-1000,t2('Descend','Synk')],[0,t2('Level off','Flat ut')],[1000,t2('Climb','Stig')]].map(([v,t])=>`<button type="button" class="btn sm${S.vs===v?' pri':''}" data-vs="${v}">${L(t)}${v?' '+sg(v):''}</button>`).join(''); }
el('vsBtns').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; S.vs=+b.dataset.vs; sl.vs.set(S.vs); drawVsBtns(); kick(); upd(); });
function advRo(){ const M=model(); el('advRo').innerHTML=[[t2('Static pressure','Statisk trykk'),hp(Math.round(M.p*10)/10)],[t2('Pressure altitude','Trykkhøyde'),ft(M.pa)],[t2('Impact pressure (pt − ps)','Støttrykk (pt − ps)'),hp(Math.round(M.qc*10)/10)],[t2('1 hPa here','1 hPa her'),nf(A.ftPerHpa(M.p),0)+' ft'],[t2('Density altitude','Tetthetshøyde'),ft(A.densityAlt(M.p,M.oat))]].map(([k,v])=>`<div class="rrow"><span>${L(k)}</span><b>${v}</b></div>`).join(''); }

/* scenarios per mode. ind: an altimeter reading to hold (the real altitude follows from it) */
const SCN={
 set:[[t2('On the runway','På rullebanen'),{qnhA:1020,qnhSet:1020,set:'qnh',dT:0,alt:ELEV,vs:0,ias:0}],[t2('Runway, QFE','Rullebane, QFE'),{qnhA:1020,set:'qfe',dT:0,alt:ELEV,vs:0,ias:0}],[t2('Circuit, 1 000 ft above','Landingsrunde, 1 000 ft over'),{qnhA:1020,qnhSet:1020,set:'qnh',dT:0,alt:ELEV+1000,vs:0,ias:90}],[t2('Above transition, STD','Over overgangshøyden, STD'),{qnhA:995,qnhSet:995,set:'std',dT:0,alt:7500,vs:0,ias:140}]],
 err:[[t2('High to low','Fra høyt til lavt'),{qnhA:995,qnhSet:1025,set:'qnh',dT:0,ind:4500,ias:120}],[t2('Cold day','Kald dag'),{qnhA:1013,qnhSet:1013,set:'qnh',dT:-25,ind:4500,ias:120}],[t2('Both (worst case)','Begge (verst)'),{qnhA:990,qnhSet:1025,set:'qnh',dT:-25,ind:4500,ias:120}],[t2('Warm high','Varmt høytrykk'),{qnhA:1035,qnhSet:1013,set:'qnh',dT:20,ind:4500,ias:120}],[t2('Standard day','Standarddag'),{qnhA:1013,qnhSet:1013,set:'qnh',dT:0,ind:4500,ias:120}]],
 spd:[[t2('Light aircraft, 8 000 ft','Småfly, 8 000 ft'),{ias:120,alt:8000,dT:0,qnhA:1013,vs:0}],[t2('Hot day, same IAS','Varm dag, samme IAS'),{ias:120,alt:8000,dT:25,qnhA:1013,vs:0}],[t2('Jet climbing, FL200','Jet i stigning, FL200'),{ias:300,alt:20000,dT:0,qnhA:1013,vs:0}],[t2('Jet cruise, FL350','Jet i marsj, FL350'),{ias:270,alt:35000,dT:0,qnhA:1013,vs:0,dp:1}]],
 blk:[[t2('Pitot icing, heat off','Pitot-ising, varme av'),{fault:'pitot',ice:1,alt:5000,ias:120,vs:0}],[t2('Blocked pitot, then climb','Blokkert pitot, så stig'),{fault:'pitotDrain',alt:3000,ias:120,vs:1000}],[t2('Static blocked, then descend','Statisk blokkert, så synk'),{fault:'static',alt:6000,ias:120,vs:-1000}],[t2('Open the alternate static','Åpne alternativ statisk'),{fault:'static',alt:5000,ias:120,vs:0,altSt:1}]]};
function drawPre(){ el('pre').innerHTML=(SCN[S.mode]||[]).map(([t,o],i)=>o.dp&&!deepOn()?'':`<button type="button" class="btn" data-s="${i}">${L(t)}</button>`).join(''); }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setS(SCN[S.mode][+b.dataset.s][1]); });
function setS(o){ if(!o) return; const {mode,ind,fault,ice,altSt,dp,...r}=o; void dp;
  if(mode&&mode!==S.mode) setMode(mode);
  if(S.mode==='blk'){ S.fault='none'; S.trap=null; S.altSt=false; S.ice=false; }
  if(S.mode==='blk') Object.assign(S,{qnhA:1013,qnhSet:1013,set:'qnh',dT:0}); if(S.mode==='spd') Object.assign(S,{qnhSet:Math.round(r.qnhA??S.qnhA),set:'qnh'});
  Object.assign(S,r); if(ind!=null) S.alt=altForInd(ind);
  if(fault){ const M=model(); S.fault=fault; S.trap={ps:M.p,pt:M.pt}; S.ice=!!ice; }
  snapVsi(); if(altSt) S.altSt=true;
  syncCtl(); kick(); upd(); }

/* ---------------- time: the climb or descent, the VSI lag and the needles ---------------- */
let raf=0, last=0, slT=0;
function kick(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(tick); } }
function tick(now){ raf=0; const dt=Math.min(0.1,(now-last)/1000); last=now; const ds=dt*TIMEX;
  if(S.vs){ S.alt=clamp(S.alt+S.vs/60*ds,0,41000); if(S.alt<=0||S.alt>=41000){ S.vs=0; sl.vs.set(0); drawVsBtns(); } }
  const M=model(); if(lag==null) lag=M.altSeen; lag=A.vsiStep(lag,M.altSeen,ds,TAU);
  const k=reduce?1:1-Math.exp(-dt*9); let mv=false;
  for(const [key,tg] of [['ias',M.iasShown],['alt',M.ind],['vsi',A.vsiRead(lag,M.altSeen,TAU)],['m',M.machShown]]){ const d=tg-D[key]; D[key]+=d*k; if(Math.abs(d)>(key==='m'?0.001:0.5)) mv=true; else D[key]=tg; }
  const vsiMoving=Math.abs(lag-M.altSeen)>0.05;
  if(now-slT>150){ slT=now; if(S.vs){ sl.alt.set(Math.round(S.alt/100)*100); sl.ind.set(Math.round(M.indOk/100)*100); } readout(); see(); if(el('advRo').offsetParent) advRo(); }
  draw();
  if(S.vs||mv||vsiMoving) raf=requestAnimationFrame(tick); else { readout(); see(); }
}
function upd(){ readout(); legend(); see(); advRo(); kick(); draw(); }

/* ---------------- Try it: one task at a time ---------------- */
let ti=0; const ansv={}, done={};
const goModel=()=>{ const t=el('adVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const NUM=(lab,v,tol,unit)=>({lab,v,tol,unit});
const TASKS=[
 {k:'forgot',q:t2('The QNH is 1003 hPa but the window still shows 1013. The altimeter reads 3 000 ft. About how high are you really, above sea level?','QNH er 1003 hPa, men vinduet viser fortsatt 1013. Høydemåleren viser 3 000 ft. Omtrent hvor høyt er du egentlig over havet?'),
  ins:[NUM(t2('Real altitude (ft)','Virkelig høyde (ft)'),2725,60,'ft')],pre:{mode:'err',qnhA:1003,qnhSet:1013,set:'qnh',dT:0,ind:3000,vs:0,ias:120},
  e:t2('10 hPa too high in the window × about 27 ft per hPa ≈ 270 ft: you are at about 2 730 ft. High to low, look out below.','10 hPa for høyt i vinduet × omtrent 27 ft per hPa ≈ 270 ft: du er på rundt 2 730 ft. Fra høyt til lavt, se deg for.')},
 {k:'cold',q:t2('Correct QNH set, the altimeter reads 5 000 ft, and the air is 20 °C colder than ISA all the way down to sea level. Estimate your real altitude.','Riktig QNH satt, høydemåleren viser 5 000 ft, og luften er 20 °C kaldere enn ISA helt ned til havet. Anslå virkelig høyde.'),
  ins:[NUM(t2('Real altitude (ft)','Virkelig høyde (ft)'),4640,130,'ft')],pre:{mode:'err',qnhA:1013,qnhSet:1013,set:'qnh',dT:-20,ind:5000,vs:0,ias:120},
  e:t2('Rule of thumb: 4 % per 10 °C below ISA. 2 × 4 % of 5 000 ft = 400 ft, so about 4 600 ft. The exact hypsometric figure in the model is about 4 650 ft: the rule is a little on the safe side.','Tommelfingerregel: 4 % per 10 °C under ISA. 2 × 4 % av 5 000 ft = 400 ft, så rundt 4 600 ft. Den eksakte hypsometriske verdien i modellen er rundt 4 650 ft: regelen er litt på den sikre siden.')},
 {k:'qfe',q:t2('You are on the runway. Which setting makes the altimeter read zero?','Du står på rullebanen. Hvilken innstilling gjør at høydemåleren viser null?'),
  opts:[t2('QFE','QFE'),t2('QNH','QNH'),t2('1013.25 hPa','1013,25 hPa'),t2('None: it always shows the elevation','Ingen: den viser alltid flyplasshøyden')],c:0,pre:{mode:'set',qnhA:1020,qnhSet:1020,set:'qfe',dT:0,alt:ELEV,vs:0,ias:0},
  e:t2('QFE is the pressure at the aerodrome, so the altimeter measures from the runway. On QNH it would read the elevation, 700 ft here.','QFE er trykket på flyplassen, så høydemåleren måler fra rullebanen. På QNH ville den vist flyplasshøyden, her 700 ft.')},
 {k:'fl',q:t2('You climb through the transition altitude. Set the right subscale and level off at flight level 75. Then press Check.','Du stiger gjennom overgangshøyden. Sett riktig innstilling og flat ut på flygenivå 75. Trykk så Sjekk.'),
  live:()=>{ const M=model(); if(S.mode!=='set') return [0,t2('Open "Altimeter settings".','Åpne «Høydemålerinnstillinger».')]; if(S.set!=='std') return [0,t2('Above the transition altitude the subscale is the standard setting, 1013.','Over overgangshøyden er innstillingen standard, 1013.')];
    if(Math.abs(M.ind-7500)>60) return [0,t2(`The altimeter reads ${ft(M.ind)}. FL 75 is 7 500 ft on the standard setting.`,`Høydemåleren viser ${ft(M.ind)}. FL 75 er 7 500 ft på standardinnstillingen.`)];
    if(S.vs) return [0,t2('Level off: vertical speed zero.','Flat ut: vertikalfart null.')];
    return [1,t2(`Yes: FL 75. Your real altitude is ${ft(S.alt)}, because the QNH is ${Math.round(S.qnhA)}, not 1013.`,`Ja: FL 75. Virkelig høyde er ${ft(S.alt)}, fordi QNH er ${Math.round(S.qnhA)}, ikke 1013.`)]; },
  pre:{mode:'set',qnhA:995,qnhSet:995,set:'qnh',dT:0,alt:6000,vs:0,ias:140}},
 {k:'tas',q:t2('IAS 120 kt at 8 000 ft in ISA. What is the TAS, roughly?','IAS 120 kt i 8 000 ft i ISA. Hva er TAS, omtrent?'),ins:[NUM(t2('TAS (kt)','TAS (kt)'),137,4.5,'kt')],pre:{mode:'spd',ias:120,alt:8000,dT:0,qnhA:1013,vs:0},
  e:t2('Rule of thumb: +2 % per 1 000 ft → 120 × 1.16 ≈ 139 kt. The exact value is 135 kt (the density ratio at 8 000 ft is 0.79, and 120 ÷ √0.79 ≈ 135).','Tommelfingerregel: +2 % per 1 000 ft → 120 × 1,16 ≈ 139 kt. Eksakt verdi er 135 kt (tetthetsforholdet i 8 000 ft er 0,79, og 120 ÷ √0,79 ≈ 135).')},
 {k:'pitclimb',q:t2('Pitot tube and drain hole are blocked at 3 000 ft. You climb at the same real speed. What does the ASI do?','Pitotrør og dreneringshull er blokkert i 3 000 ft. Du stiger med samme virkelige fart. Hva gjør fartsmåleren?'),
  opts:[t2('It shows more and more speed','Den viser mer og mer fart'),t2('It drops to zero','Den faller til null'),t2('It stays correct','Den viser riktig'),t2('It freezes','Den fryser')],c:0,pre:{mode:'blk',fault:'pitotDrain',alt:3000,ias:120,vs:1000},
  e:t2('The trapped total pressure stays the same while the static pressure falls, so the difference, which the ASI reads as speed, grows. The ASI behaves like an altimeter. The risk: you raise the nose to "slow down" and stall.','Det fangede totaltrykket står stille mens det statiske faller, så differansen, som fartsmåleren leser som fart, øker. Fartsmåleren oppfører seg som en høydemåler. Faren: du løfter nesen for å «sakke ned» og staller.')},
 {k:'statdesc',q:t2('The static ports ice over at 6 000 ft and you start a descent. What do the instruments show?','De statiske portene ises over i 6 000 ft, og du starter en nedstigning. Hva viser instrumentene?'),
  opts:[t2('Altimeter stuck, VSI zero, ASI too high','Høydemåler fast, VSI null, fartsmåler for høyt'),t2('Altimeter stuck, VSI zero, ASI too low','Høydemåler fast, VSI null, fartsmåler for lavt'),t2('ASI zero, the rest correct','Fartsmåler null, resten riktig'),t2('Everything correct but delayed','Alt riktig, men forsinket')],c:0,pre:{mode:'blk',fault:'static',alt:6000,ias:120,vs:-1000},
  e:t2('Below the blockage the real total pressure is higher than at 6 000 ft, but the ASI compares it with the trapped, lower static pressure: the ASI over-reads, and you may overspeed.','Under blokkeringen er det virkelige totaltrykket høyere enn i 6 000 ft, men fartsmåleren sammenligner det med det fangede, lavere statiske trykket: den viser for høyt, og du kan få overfart.')},
 {k:'alts',q:t2('Your static ports are blocked. Restore the altimeter in the model, then press Check.','De statiske portene dine er blokkert. Få høydemåleren til å virke igjen i modellen, og trykk Sjekk.'),
  live:()=>{ const M=model(); if(S.mode!=='blk'||(S.fault!=='static')) return [0,t2('Go to "Blockages" and pick "Static blocked" (or press "Set it up in the model").','Gå til «Blokkeringer» og velg «Statisk blokkert» (eller trykk «Sett det opp i modellen»).')];
    if(!S.altSt) return [0,t2('Which source of static pressure is still open to you inside the cockpit?','Hvilken kilde til statisk trykk har du fortsatt tilgang til i cockpit?')];
    return [1,t2(`Yes: alternate static. The altimeter works again but reads about ${nf(Math.round((M.ind-M.indOk)/5)*5,0)} ft high, because the cabin pressure is a little lower than outside.`,`Ja: alternativ statisk. Høydemåleren virker igjen, men viser rundt ${nf(Math.round((M.ind-M.indOk)/5)*5,0)} ft for høyt, fordi trykket i kabinen er litt lavere enn ute.`)]; },
  pre:{mode:'blk',fault:'static',alt:5000,ias:120,vs:0}},
 {k:'mach',dp:1,q:t2('M 0.78 at FL350 in ISA (−54 °C). What is the TAS?','M 0,78 i FL350 i ISA (−54 °C). Hva er TAS?'),ins:[NUM(t2('TAS (kt)','TAS (kt)'),450,5,'kt')],pre:{mode:'spd',ias:270,alt:35000,dT:0,qnhA:1013,vs:0},
  e:t2('Speed of sound a = 38.97 × √(273 − 54) ≈ 577 kt. TAS = M × a = 0.78 × 577 ≈ 450 kt.','Lydhastigheten a = 38,97 × √(273 − 54) ≈ 577 kt. TAS = M × a = 0,78 × 577 ≈ 450 kt.')}];
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
const go=o=>({click:()=>setS(o),to:'#adVp'});
const gaugeIll=(x,lab,a)=>`<circle cx="${x}" cy="30" r="20" fill="#090c0f" stroke="#6f7e8b"/><line x1="${x}" y1="30" x2="${(x+Math.sin(a*D2R)*16).toFixed(1)}" y2="${(30-Math.cos(a*D2R)*16).toFixed(1)}" stroke="#eef3f7" stroke-width="2"/>${tx(x,60,lab,'#8b99a7','middle',7.5)}`;
const KC=[
 Object.assign({k:'press',t:t2('Static and total pressure','Statisk og totaltrykk'),d:t2('<b>Static</b> pressure is the still air around you, taken from ports on the side; <b>total</b> pressure is static plus the rammed air, taken by the pitot tube. Their difference is the dynamic pressure, ½ρV².','<b>Statisk</b> trykk er den stille luften rundt deg, tatt fra porter på siden; <b>totaltrykk</b> er statisk pluss den oppdemmede luften, tatt av pitotrøret. Differansen er dynamisk trykk, ½ρV².'),
  dd:t2('The ASI needs both pressures. The altimeter and the VSI need static only.','Fartsmåleren trenger begge trykkene. Høydemåleren og VSI trenger bare statisk.'),
  ill:()=>sv(`<rect x="70" y="18" width="120" height="22" rx="10" fill="#26313b"/><line x1="40" y1="44" x2="96" y2="44" stroke="#aeb8c1" stroke-width="3"/>${ar(6,44,34,44,'#f0b440')}<circle cx="150" cy="29" r="4" fill="#0c1217" stroke="#7fcbe8"/>${tx(36,58,'pitot','#f0b440','middle',8)}${tx(150,52,'static','#7fcbe8','middle',8)}`)},go({mode:'blk',vs:0})),
 Object.assign({k:'baro',t:t2('The altimeter is a barometer','Høydemåleren er et barometer'),d:t2('It measures static pressure and turns it into feet using the <b>ISA</b>: 1013.25 hPa and 15 °C at sea level, −2 °C per 1 000 ft. Near the ground 1 hPa is about 27 ft.','Den måler statisk trykk og gjør det om til fot med <b>ISA</b>: 1013,25 hPa og 15 °C ved havet, −2 °C per 1 000 ft. Nær bakken er 1 hPa omtrent 27 ft.'),
  dd:t2('Higher up a hectopascal is worth more feet: about 36 ft at 10 000 ft and 50 ft at FL200.','Høyere opp er en hektopascal verdt flere fot: rundt 36 ft i 10 000 ft og 50 ft i FL200.'),
  ill:()=>sv(`${gaugeIll(50,'ALT',120)}${tx(90,26,'1013.25 hPa · 15 °C','#c9d2da','start',8)}${tx(90,42,'−2 °C / 1000 ft','#8b99a7','start',8)}`)},go({mode:'set',set:'qnh',qnhA:1013,qnhSet:1013,dT:0,alt:3000,vs:0})),
 Object.assign({k:'set',t:t2('QNH, QFE and 1013','QNH, QFE og 1013'),d:t2('<b>QNH</b> gives altitude above sea level, <b>QFE</b> height above the aerodrome, and <b>1013</b> pressure altitude, used as flight levels above the transition altitude.','<b>QNH</b> gir høyde over havet, <b>QFE</b> høyde over flyplassen, og <b>1013</b> trykkhøyde, brukt som flygenivåer over overgangshøyden.'),
  dd:t2('Climbing, set 1013 passing the transition altitude; descending, set QNH passing the transition level. Do not level off in the transition layer between them.','I stigning setter du 1013 ved overgangshøyden; i nedstigning QNH ved overgangsnivået. Ikke flat ut i overgangslaget mellom dem.'),
  ill:()=>sv(`<line x1="10" y1="56" x2="190" y2="56" stroke="#7fcbe8" stroke-dasharray="3 3"/><rect x="60" y="44" width="50" height="12" fill="#34493b"/><line x1="10" y1="22" x2="190" y2="22" stroke="#c9b6f2" stroke-dasharray="2 3"/>${tx(14,52,'QNH: sea','#7fcbe8','start',7.5)}${tx(85,40,'QFE','#eef3f7','middle',7.5)}${tx(186,18,'1013: FL','#c9b6f2','end',7.5)}`)},go({mode:'set',set:'std',qnhA:995,qnhSet:995,dT:0,alt:7500,vs:0})),
 Object.assign({k:'hilo',t:t2('High to low, look out below','Fra høyt til lavt, se deg for'),d:t2('Fly towards lower pressure without resetting the QNH and the altimeter <b>over-reads</b>: you are lower than it says, about 27 ft per hPa.','Flyr du mot lavere trykk uten å sette ny QNH, viser høydemåleren <b>for høyt</b>: du er lavere enn den sier, omtrent 27 ft per hPa.'),
  ill:()=>sv(`<path d="M10,16 C70,16 130,30 190,40" stroke="#c9b6f2" fill="none" stroke-dasharray="4 3"/><line x1="10" y1="16" x2="190" y2="16" stroke="#eef3f7" stroke-opacity=".35"/>${tx(14,30,'H','#eef3f7','start',11)}${tx(186,58,'L','#ec5a47','end',11)}${ar(140,18,140,32,'#ec5a47')}`)},go({mode:'err',qnhA:995,qnhSet:1025,set:'qnh',dT:0,ind:4500,vs:0})),
 Object.assign({k:'cold',t:t2('Cold air: lower than indicated','Kald luft: lavere enn vist'),d:t2('In air colder than ISA the pressure levels lie closer together, so you are <b>lower than indicated</b>: about 4 % of your height for every 10 °C below ISA.','I luft kaldere enn ISA ligger trykkflatene tettere, så du er <b>lavere enn vist</b>: omtrent 4 % av høyden for hver 10 °C under ISA.'),
  dd:t2('Warm air does the opposite. Cold-temperature corrections are added to minimum altitudes on approach.','Varm luft gjør det motsatte. Kuldekorreksjoner legges til minstehøydene på innflyging.'),
  ill:()=>sv(`<rect x="10" y="6" width="80" height="52" fill="rgba(110,160,240,.15)"/><rect x="110" y="6" width="80" height="52" fill="rgba(240,140,90,.12)"/>${[0,1,2,3].map(i=>`<line x1="14" y1="${54-i*11}" x2="86" y2="${54-i*11}" stroke="#7fcbe8"/><line x1="114" y1="${54-i*15}" x2="186" y2="${54-i*15}" stroke="#f0b440"/>`).join('')}${tx(50,64,'cold','#7fcbe8','middle',7.5)}${tx(150,64,'warm','#f0b440','middle',7.5)}`)},go({mode:'err',qnhA:1013,qnhSet:1013,set:'qnh',dT:-25,ind:4500,vs:0})),
 Object.assign({k:'spd',t:t2('IAS, CAS, EAS, TAS','IAS, CAS, EAS, TAS'),d:t2('<b>IAS</b> is what the ASI shows; correct for position error to get <b>CAS</b>, for compressibility to get <b>EAS</b>, and for density to get <b>TAS</b>. TAS grows with altitude: about 2 % per 1 000 ft.','<b>IAS</b> er det fartsmåleren viser; korriger for posisjonsfeil og få <b>CAS</b>, for kompressibilitet og få <b>EAS</b>, og for tetthet og få <b>TAS</b>. TAS øker med høyden: omtrent 2 % per 1 000 ft.'),
  dd:t2('The wing and the ASI both feel dynamic pressure, so the stall happens at the same IAS at every altitude, while TAS and groundspeed are higher up high.','Vingen og fartsmåleren kjenner begge dynamisk trykk, så stallen skjer ved samme IAS i alle høyder, mens TAS og groundspeed er høyere høyt oppe.'),
  ill:()=>sv(`<rect x="34" y="8" width="100" height="8" rx="2" fill="#e6ecf0"/><rect x="34" y="24" width="102" height="8" rx="2" fill="#c9d2da"/><rect x="34" y="40" width="140" height="8" rx="2" fill="#f0b440"/>${tx(30,15,'IAS','#e6ecf0','end',8)}${tx(30,31,'CAS','#c9d2da','end',8)}${tx(30,47,'TAS','#f0b440','end',8)}`)},go({mode:'spd',ias:120,alt:8000,dT:0,qnhA:1013,vs:0})),
 Object.assign({k:'mach',dp:1,t:t2('The Mach meter','Machmeteret'),d:t2('<b>Mach</b> is TAS divided by the local speed of sound, which depends only on temperature. The Mach meter gets it from the pitot and static pressures alone, with no temperature input.','<b>Mach</b> er TAS delt på lydhastigheten der du er, som bare avhenger av temperaturen. Machmeteret finner den fra pitot- og statisk trykk alene, uten temperatur.'),
  dd:t2('At a constant CAS, the Mach number rises in a climb; at a constant Mach, the CAS falls. That is why jets climb at a CAS and change over to a Mach.','Med konstant CAS øker machtallet i stigning; med konstant mach faller CAS. Derfor stiger jetfly på en CAS og bytter til mach.'),
  ill:()=>sv(`${gaugeIll(50,'MACH',60)}${tx(90,28,'M = TAS / a','#f0b440','start',9)}${tx(90,44,'a ≈ 39 × √T(K)','#8b99a7','start',8)}`)},go({mode:'spd',ias:270,alt:35000,dT:0,qnhA:1013,vs:0})),
 Object.assign({k:'vsi',t:t2('The VSI and its lag','VSI og forsinkelsen'),d:t2('The <b>VSI</b> compares the static pressure now with the pressure in a case that leaks slowly: it shows the trend at once but the correct rate only after <b>6–9 seconds</b>.','<b>VSI</b> sammenligner det statiske trykket nå med trykket i et hus som lekker sakte: den viser trenden med en gang, men riktig rate først etter <b>6–9 sekunder</b>.'),
  dd:t2('An instantaneous VSI (IVSI) adds small accelerometer pistons to remove most of the lag.','En momentan VSI (IVSI) har små akselerometer-stempler som fjerner det meste av forsinkelsen.'),
  ill:()=>sv(`${gaugeIll(50,'VSI',-10)}<path d="M90,50 C110,50 115,14 150,14 L190,14" stroke="#eef3f7" fill="none"/><path d="M90,50 L104,50 L104,14 L190,14" stroke="#7fcbe8" fill="none" stroke-dasharray="3 3"/>${tx(150,30,'lag','#8b99a7','middle',8)}`)},go({mode:'blk',fault:undefined,alt:3000,vs:1000})),
 Object.assign({k:'pit',t:t2('Pitot blocked','Pitot blokkert'),d:t2('Inlet blocked, drain open: the ASI falls to <b>zero</b>. Inlet and drain blocked: the ASI acts like an <b>altimeter</b>, reading more in a climb and less in a descent.','Innløp blokkert, drenering åpen: fartsmåleren faller til <b>null</b>. Innløp og drenering blokkert: fartsmåleren oppfører seg som en <b>høydemåler</b>, viser mer i stigning og mindre i nedstigning.'),
  ill:()=>sv(`<line x1="30" y1="32" x2="110" y2="32" stroke="#aeb8c1" stroke-width="5"/><path d="M24,26 L36,38 M36,26 L24,38" stroke="#ec5a47" stroke-width="2.4"/>${gaugeIll(150,'ASI',-150)}`)},go({mode:'blk',fault:'pitotDrain',alt:3000,ias:120,vs:1000})),
 Object.assign({k:'stat',t:t2('Static blocked','Statisk blokkert'),d:t2('The altimeter <b>freezes</b>, the VSI shows <b>zero</b>, and the ASI over-reads in a descent. Open the <b>alternate static</b>: it then reads slightly high.','Høydemåleren <b>fryser</b>, VSI viser <b>null</b>, og fartsmåleren viser for høyt i nedstigning. Åpne <b>alternativ statisk</b>: da viser den litt for høyt.'),
  dd:t2('In a pressurised aircraft the alternate static cannot come from the cabin: airliners switch to another air data source instead.','I et fly med trykkabin kan ikke alternativ statisk komme fra kabinen: trafikkfly bytter heller til en annen luftdatakilde.'),
  ill:()=>sv(`<rect x="10" y="16" width="70" height="30" rx="12" fill="#26313b"/><circle cx="50" cy="31" r="5" fill="#0c1217" stroke="#7fcbe8"/><path d="M43,24 L57,38 M57,24 L43,38" stroke="#ec5a47" stroke-width="2.2"/>${gaugeIll(120,'ALT',40)}${gaugeIll(170,'VSI',-90)}`)},go({mode:'blk',fault:'static',alt:6000,ias:120,vs:-1000})),
 Object.assign({k:'uas',t:t2('Unreliable airspeed: pitch and power','Upålitelig fart: pitch og effekt'),d:t2('If the speeds make no sense, stop chasing them: set a known <b>pitch</b> and <b>power</b>, which give a known speed, and cross-check GPS groundspeed and altitude.','Gir fartene ingen mening, slutt å jage dem: sett kjent <b>pitch</b> og <b>effekt</b>, som gir en kjent fart, og kryssjekk GPS-groundspeed og -høyde.'),
  dd:t2('Attitude and engine power do not need the pitot-static system. Know your normal pitch and power for climb, cruise and descent.','Attityde og motoreffekt trenger ikke pitot-statisk system. Kjenn normal pitch og effekt for stigning, marsj og nedstigning.'),
  ill:()=>sv(`<rect x="20" y="10" width="64" height="44" rx="4" fill="#2b6cb0"/><rect x="20" y="34" width="64" height="20" fill="#7a4a22"/><line x1="36" y1="30" x2="68" y2="30" stroke="#f0b440" stroke-width="2.4"/>${tx(100,28,'pitch +','#eef3f7','start',9)}${tx(100,44,'power = speed','#f0b440','start',9)}`)},go({mode:'blk',fault:'both',alt:5000,ias:120,vs:0}))];
KCS.render(el('kcGrid'),KC);

/* ---------------- deep-dive folds ---------------- */
const P=s=>`<p>${s}</p>`, FX=s=>`<div class="fx">${s}</div>`;
const DD=[
 ['isa',t2('The standard atmosphere','Standardatmosfæren'),t2('ISA in numbers','ISA i tall'),[
  t2(P('ICAO Standard Atmosphere (Doc 7488): at sea level 1013.25 hPa, +15 °C and 1.225 kg/m³. The temperature falls 6.5 °C per km (1.98 °C per 1 000 ft) up to the tropopause at 11 km (36 089 ft), then stays at −56.5 °C.')+FX('p = 1013.25 × (1 − 0.0065 h / 288.15)^5.256 · h in metres')+P('The altimeter is built around this formula. It reads the right altitude only when the real atmosphere matches it.'),
     P('ICAOs standardatmosfære (Doc 7488): ved havet 1013,25 hPa, +15 °C og 1,225 kg/m³. Temperaturen faller 6,5 °C per km (1,98 °C per 1 000 ft) opp til tropopausen i 11 km (36 089 ft), og holder seg så på −56,5 °C.')+FX('p = 1013,25 × (1 − 0,0065 h / 288,15)^5,256 · h i meter')+P('Høydemåleren er bygget rundt denne formelen. Den viser riktig høyde bare når den virkelige atmosfæren stemmer med den.'))]],
 ['set',t2('Settings and transition','Innstillinger og overgang'),t2('TA, TL and the transition layer','TA, TL og overgangslaget'),[
  t2(P('<b>Transition altitude</b> (TA): at and below it you fly altitudes on QNH. <b>Transition level</b> (TL): the lowest flight level above it. The <b>transition layer</b> is the airspace between them. Climbing, set 1013 when you pass the TA; descending, set QNH when you pass the TL. Vertical position is given as altitude below the layer and as flight level above it.')+P('<b>QNE</b> is the reading on the runway with 1013 set: the pressure altitude of the aerodrome. On an airliner each pilot sets the baro reference on the EFIS panel (pull for STD, push for QNH), and the setting flashes if you pass the TA or TL without changing it.'),
     P('<b>Overgangshøyde</b> (TA): i og under den flyr du høyder på QNH. <b>Overgangsnivå</b> (TL): det laveste flygenivået over den. <b>Overgangslaget</b> er luftrommet mellom dem. I stigning setter du 1013 når du passerer TA; i nedstigning setter du QNH når du passerer TL. Vertikal posisjon oppgis som høyde under laget og som flygenivå over det.')+P('<b>QNE</b> er visningen på rullebanen med 1013 satt: flyplassens trykkhøyde. På et trafikkfly setter hver pilot baroreferansen på EFIS-panelet (trekk for STD, trykk for QNH), og innstillingen blinker hvis du passerer TA eller TL uten å endre den.'))]],
 ['cold',t2('Temperature error and cold-temperature correction','Temperaturfeil og kuldekorreksjon'),t2('the 4 % rule and the ICAO formula','4 %-regelen og ICAO-formelen'),['COLD',
  t2(P('Between two pressure levels the thickness of the air is proportional to its mean temperature (the hypsometric equation). In air 10 °C colder than ISA the layer is about 3.5–4 % thinner, so every 1 000 ft on the altimeter is only about 960 ft of real height. Count from the aerodrome or station whose QNH you use: the error grows with height above it.')+FX('error ≈ 4 % × height above the station × (ISA deviation / 10 °C)')+P('Published minimum altitudes assume ISA. In cold weather the correction is <b>added</b> to them (ICAO Doc 8168). Many operators apply it at aerodrome temperatures of 0 °C and below; the table uses the ICAO formula for an aerodrome at sea level.'),
     P('Mellom to trykkflater er tykkelsen på luftlaget proporsjonal med middeltemperaturen (den hypsometriske ligningen). I luft 10 °C kaldere enn ISA er laget rundt 3,5–4 % tynnere, så hver 1 000 ft på høydemåleren er bare rundt 960 ft virkelig høyde. Regn fra flyplassen eller stasjonen du har QNH fra: feilen vokser med høyden over den.')+FX('feil ≈ 4 % × høyde over stasjonen × (ISA-avvik / 10 °C)')+P('Publiserte minstehøyder forutsetter ISA. I kulde <b>legges</b> korreksjonen til (ICAO Doc 8168). Mange operatører bruker den ved flyplasstemperaturer på 0 °C og lavere; tabellen bruker ICAO-formelen for en flyplass ved havnivå.'))]],
 ['da',t2('Density altitude','Tetthetshøyde'),t2('what the wing and the engine feel','det vingen og motoren kjenner'),[
  t2(P('Density altitude is the altitude in the ISA that has the same density as the air you are in. Start from pressure altitude and add about 120 ft for every °C above ISA. Hot and high means thin air: a longer take-off run, a weaker climb and less engine power, even though the IAS for lift-off is the same.')+FX('DA ≈ PA + 120 × (OAT − ISA temperature)')+P('Under Advanced the lab gives the density altitude for the current conditions.'),
     P('Tetthetshøyde er høyden i ISA som har samme tetthet som luften du er i. Start med trykkhøyden og legg til rundt 120 ft for hver °C over ISA. Varmt og høyt betyr tynn luft: lengre startrull, svakere stigning og mindre motoreffekt, selv om IAS for lift-off er den samme.')+FX('DA ≈ PA + 120 × (OAT − ISA-temperatur)')+P('Under Avansert gir labben tetthetshøyden for forholdene du har satt.'))]],
 ['spd',t2('From IAS to TAS and Mach','Fra IAS til TAS og mach'),t2('the corrections','korreksjonene'),[
  t2(P('<b>IAS → CAS:</b> position (pressure) error and instrument error, from a table in the flight manual. Worst at high angles of attack and with flaps out. <b>CAS → EAS:</b> at high speed the air in the pitot tube is compressed, so the ASI over-reads; the compressibility correction is subtracted. It is small below about 200 kt and 10 000 ft. <b>EAS → TAS:</b> divide by the square root of the density ratio σ.')+FX('TAS = EAS / √σ · σ = ρ / 1.225')+FX('M = TAS / a · a ≈ 38.97 × √T(K) kt (661 kt at +15 °C)')+P('In a climb at a constant CAS, TAS and Mach rise. In a climb at constant Mach, CAS and TAS fall. Above the tropopause the temperature is constant, so at a constant Mach the TAS is constant too.'),
     P('<b>IAS → CAS:</b> posisjons- (trykk-) feil og instrumentfeil, fra en tabell i flyhåndboken. Størst ved høy angrepsvinkel og med klaff ute. <b>CAS → EAS:</b> i høy fart komprimeres luften i pitotrøret, så fartsmåleren viser for høyt; kompressibilitetskorreksjonen trekkes fra. Den er liten under rundt 200 kt og 10 000 ft. <b>EAS → TAS:</b> del på kvadratroten av tetthetsforholdet σ.')+FX('TAS = EAS / √σ · σ = ρ / 1,225')+FX('M = TAS / a · a ≈ 38,97 × √T(K) kt (661 kt ved +15 °C)')+P('I stigning med konstant CAS øker TAS og mach. I stigning med konstant mach faller CAS og TAS. Over tropopausen er temperaturen konstant, så med konstant mach er også TAS konstant.'))]],
 ['blk',t2('What each fault does','Hva hver feil gjør'),t2('the table, and wind and weather','tabellen, og vind og vær'),['FAULTS',
  t2(P('<b>Steady wind</b> never changes the IAS: the pitot measures the air, not the ground. A sudden gust or wind shear changes it briefly. <b>Icing</b>: visible moisture near or below 0 °C can ice the pitot tip; pitot heat on before entering it. <b>Heavy rain</b> can enter the tube; the drain lets it out. <b>On the ground</b> insects nest in uncovered tubes and tape from washing is left on static ports: covers off and ports checked on every walk-around, and the ASI checked alive early in the take-off roll.'),
     P('<b>Jevn vind</b> endrer aldri IAS: pitoten måler luften, ikke bakken. Et plutselig vindkast eller vindskjær endrer den kort. <b>Ising</b>: synlig fuktighet rundt eller under 0 °C kan ise pitotspissen; slå på pitotvarmen før du flyr inn i det. <b>Kraftig regn</b> kan komme inn i røret; dreneringen slipper det ut. <b>På bakken</b> bygger insekter reir i rør uten deksel, og tape fra vask blir sittende på statiske porter: deksler av og porter sjekket på hver walk-around, og fartsmåleren sjekket at den lever tidlig i startrullet.'))]],
 ['uas',t2('Unreliable airspeed on a jet','Upålitelig fart på jetfly'),t2('three air data sources are not three opinions','tre luftdatakilder er ikke tre meninger'),[
  t2(P('An airliner such as the A320 has three sets of probes and three air data computers (ADRs), voted by the flight control computers. Voting finds one independent fault. Ice crystals in a convective cloud can block two or three probes the same way, and two wrong sources that agree outvote the good one: only the crew can catch it.')+P('<b>Recognise it:</b> speeds that disagree or fluctuate, a speed that does not fit the attitude and thrust, autopilot or autothrust disconnecting, overspeed and stall warnings close together. <b>Fly it:</b> if the flight path is at risk (typically just after take-off), the memory items give a safe pitch and thrust (typically TOGA and about 15° below the thrust reduction altitude, then climb thrust with about 10° below FL100 and 5° above it). Once safe, level off and use the QRH pitch and N1 tables. GPS groundspeed and altitude, the flight path vector and the angle-of-attack based stall warning need no pitot.'),
     P('Et trafikkfly som A320 har tre sett med sonder og tre luftdatadatamaskiner (ADR), som flykontrolldatamaskinene stemmer over. Avstemning finner én uavhengig feil. Iskrystaller i en konvektiv sky kan blokkere to eller tre sonder på samme måte, og to feil kilder som er enige, stemmer ned den gode: bare besetningen kan fange det.')+P('<b>Kjenn det igjen:</b> farter som er uenige eller svinger, en fart som ikke passer med attityde og skyvekraft, autopilot eller autothrust som kobler ut, overspeed- og stallvarsler tett etter hverandre. <b>Fly det:</b> er flybanen i fare (typisk like etter avgang), gir memory items en trygg pitch og skyvekraft (typisk TOGA og rundt 15° under thrust reduction altitude, så stigeskyvekraft med rundt 10° under FL100 og 5° over). Når flyet er trygt, flat ut og bruk QRH-tabellene for pitch og N1. GPS-groundspeed og -høyde, flight path vector og stallvarslingen basert på angrepsvinkel trenger ingen pitot.'))]]];
const FROWS=[[t2('Fault','Feil'),t2('ASI','Fartsmåler'),t2('Altimeter','Høydemåler'),t2('VSI','VSI')],
 [t2('Pitot blocked, drain open','Pitot blokkert, drenering åpen'),t2('falls to zero','faller til null'),t2('correct','riktig'),t2('correct','riktig')],
 [t2('Pitot and drain blocked','Pitot og drenering blokkert'),t2('acts like an altimeter: high in a climb, low in a descent','som en høydemåler: høyt i stigning, lavt i nedstigning'),t2('correct','riktig'),t2('correct','riktig')],
 [t2('Static blocked','Statisk blokkert'),t2('low in a climb, high in a descent','lavt i stigning, høyt i nedstigning'),t2('frozen','fryst'),t2('zero','null')],
 [t2('Both blocked','Begge blokkert'),t2('frozen','fryst'),t2('frozen','fryst'),t2('zero','null')],
 [t2('Alternate static (unpressurised)','Alternativ statisk (uten trykkabin)'),t2('slightly high','litt høyt'),t2('slightly high','litt høyt'),t2('short climb, then correct','kort stigning, så riktig')]];
function coldTable(){ const rows=[500,1000,1500,2000,3000], temps=[0,-10,-20,-30,-40];
  return `<div class="wrapx"><table class="ftab"><tr><th>${L(t2('Height above aerodrome','Høyde over flyplassen'))}</th>${temps.map(t=>`<th>${t} °C</th>`).join('')}</tr>${rows.map(h=>`<tr><td>${nf(h,0)} ft</td>${temps.map(t=>`<td>+${nf(Math.ceil(A.icaoCold(h,t,0)/10)*10,0)} ft</td>`).join('')}</tr>`).join('')}</table></div>`; }
function drawDD(){ const open=[...document.querySelectorAll('#ddList details[open]')].map(d=>d.id);
  el('ddList').innerHTML=DD.map(([id,t,s,ps])=>`<details class="dfold" id="dd-${id}"><summary>${L(t)} <small>${L(s)}</small></summary><div>${ps.map(p=>p==='COLD'?'':p==='FAULTS'?`<div class="wrapx"><table class="ftab">${FROWS.map((r,j)=>`<tr>${r.map(c=>j?`<td>${L(c)}</td>`:`<th>${L(c)}</th>`).join('')}</tr>`).join('')}</table></div>`:L(p)).join('')}${ps[0]==='COLD'?coldTable():''}</div></details>`).join('');
  open.forEach(i=>{ const d=el(i); if(d) d.open=true; }); }

/* ---------------- Test yourself ---------------- */
function drawTake(){ const TK=[
  t2('<b>Static pressure</b> feeds the altimeter, the VSI and the ASI; <b>total (pitot) pressure</b> feeds only the ASI (and the Mach meter).','<b>Statisk trykk</b> går til høydemåler, VSI og fartsmåler; <b>totaltrykk (pitot)</b> går bare til fartsmåleren (og machmeteret).'),
  t2('<b>The altimeter is a barometer calibrated in ISA.</b> Near the ground 1 hPa ≈ 27 ft.','<b>Høydemåleren er et barometer kalibrert i ISA.</b> Nær bakken er 1 hPa ≈ 27 ft.'),
  t2('<b>QNH</b> → altitude above sea level, <b>QFE</b> → height above the aerodrome, <b>1013</b> → pressure altitude and flight levels above the transition altitude.','<b>QNH</b> → høyde over havet, <b>QFE</b> → høyde over flyplassen, <b>1013</b> → trykkhøyde og flygenivåer over overgangshøyden.'),
  t2('<b>Lower pressure or colder air than set or assumed</b> puts you lower than indicated: about 27 ft per hPa, and about 4 % per 10 °C below ISA.','<b>Lavere trykk eller kaldere luft enn satt eller antatt</b> gjør at du er lavere enn vist: omtrent 27 ft per hPa, og omtrent 4 % per 10 °C under ISA.'),
  t2('<b>IAS → CAS → EAS → TAS.</b> TAS grows with altitude, about 2 % per 1 000 ft; the wing stalls at the same IAS.','<b>IAS → CAS → EAS → TAS.</b> TAS øker med høyden, omtrent 2 % per 1 000 ft; vingen staller ved samme IAS.'),
  {dp:1,...t2('<b>Mach = TAS ÷ speed of sound.</b> The speed of sound depends on temperature only. Climbing at a constant CAS, the Mach number rises.','<b>Mach = TAS ÷ lydhastigheten.</b> Lydhastigheten avhenger bare av temperaturen. Stiger du med konstant CAS, øker machtallet.')},
  t2('<b>The VSI lags</b>: trend at once, correct rate after 6–9 s.','<b>VSI henger etter</b>: trenden med en gang, riktig rate etter 6–9 s.'),
  t2('<b>Pitot blocked:</b> drain open → ASI to zero; drain blocked too → ASI acts like an altimeter. <b>Static blocked:</b> altimeter frozen, VSI zero, ASI high in a descent. Alternate static reads slightly high.','<b>Pitot blokkert:</b> drenering åpen → fartsmåler til null; drenering også blokkert → fartsmåleren oppfører seg som en høydemåler. <b>Statisk blokkert:</b> høydemåler fryst, VSI null, fartsmåler høy i nedstigning. Alternativ statisk viser litt høyt.'),
  t2('<b>Unreliable airspeed:</b> fly pitch and power, and cross-check GPS.','<b>Upålitelig fart:</b> fly pitch og effekt, og kryssjekk GPS.')];
  el('take').innerHTML=TK.filter(x=>!x.dp||deepOn()).map(x=>`<li>${L(x)}</li>`).join('');
  const m=el('maid'); m.querySelector('.k').textContent=L(t2('Memory aid','Huskeregel'));
  m.querySelector('b').textContent=L(t2('High to low, look out below','Fra høyt til lavt, se deg for'));
  m.querySelector('p').textContent=L(t2('Flying from high pressure to low (or from warm air to cold) without resetting, the altimeter reads too high: you are lower than you think. The same goes for the wrong QNH in the window. Going from low to high, you are higher than indicated.','Flyr du fra høytrykk til lavtrykk (eller fra varm luft til kald) uten å stille om, viser høydemåleren for høyt: du er lavere enn du tror. Det samme gjelder feil QNH i vinduet. Fra lavt til høyt er du høyere enn vist.')); }

LAB.quiz(el('qbox'),'airdata',()=>LAB.shuffle([
 {q:t2('Which instruments use static pressure only?','Hvilke instrumenter bruker bare statisk trykk?'),a:[t2('The altimeter and the VSI','Høydemåleren og VSI'),t2('The ASI and the altimeter','Fartsmåleren og høydemåleren'),t2('Only the ASI','Bare fartsmåleren')],c:0,e:t2('The ASI needs both pitot and static pressure; the altimeter and VSI need static only.','Fartsmåleren trenger både pitot- og statisk trykk; høydemåleren og VSI trenger bare statisk.')},
 {q:t2('You fly from a high towards a low without changing the subscale. Your real altitude is…','Du flyr fra et høytrykk mot et lavtrykk uten å endre innstillingen. Virkelig høyde er …'),a:[t2('lower than indicated','lavere enn vist'),t2('higher than indicated','høyere enn vist'),t2('the same as indicated','den samme som vist')],c:0,e:t2('High to low, look out below: the altimeter over-reads by about 27 ft per hPa.','Fra høyt til lavt, se deg for: høydemåleren viser for høyt med omtrent 27 ft per hPa.')},
 {q:t2('The air is 20 °C colder than ISA and the altimeter (correct QNH) reads 3 000 ft above a sea-level aerodrome. Roughly how high are you?','Luften er 20 °C kaldere enn ISA, og høydemåleren (riktig QNH) viser 3 000 ft over en flyplass ved havet. Omtrent hvor høyt er du?'),a:[t2('2 760 ft','2 760 ft'),t2('3 240 ft','3 240 ft'),t2('3 000 ft','3 000 ft')],c:0,e:t2('4 % per 10 °C: 8 % of 3 000 ft ≈ 240 ft lower.','4 % per 10 °C: 8 % av 3 000 ft ≈ 240 ft lavere.')},
 {q:t2('With QFE set, the altimeter on the runway reads…','Med QFE satt viser høydemåleren på rullebanen …'),a:[t2('zero','null'),t2('the aerodrome elevation','flyplasshøyden'),t2('the pressure altitude','trykkhøyden')],c:0,e:t2('QFE is the pressure at the aerodrome, so the altimeter measures from it.','QFE er trykket på flyplassen, så høydemåleren måler fra den.')},
 {q:t2('Climbing out, when do you set 1013.25 hPa?','Når setter du 1013,25 hPa i stigning?'),a:[t2('Passing the transition altitude','Når du passerer overgangshøyden'),t2('Passing the transition level','Når du passerer overgangsnivået'),t2('At top of climb','På toppen av stigningen')],c:0,e:t2('Climbing: standard at the transition altitude. Descending: QNH at the transition level.','I stigning: standard ved overgangshøyden. I nedstigning: QNH ved overgangsnivået.')},
 {q:t2('The pitot inlet ices over but the drain hole stays open. The ASI…','Pitotinnløpet ises igjen, men dreneringshullet er åpent. Fartsmåleren …'),a:[t2('drops towards zero','faller mot null'),t2('reads high in a climb','viser høyt i stigning'),t2('freezes at the last value','fryser på siste verdi')],c:0,e:t2('The pitot side bleeds down to static pressure through the drain, so the difference, and the ASI, go to zero.','Pitotsiden lekker ned til statisk trykk gjennom dreneringen, så differansen, og fartsmåleren, går mot null.')},
 {q:t2('In a climb the airspeed slowly increases, although you have not changed power or attitude. The most likely cause?','I en stigning øker farten sakte, selv om du ikke har endret effekt eller attityde. Mest sannsynlig årsak?'),a:[t2('Pitot tube and drain blocked','Pitotrør og drenering blokkert'),t2('Static ports blocked','Statiske porter blokkert'),t2('A tailwind','Medvind')],c:0,e:t2('Trapped total pressure against falling static pressure: the ASI behaves like an altimeter.','Fanget totaltrykk mot fallende statisk trykk: fartsmåleren oppfører seg som en høydemåler.')},
 {q:t2('The altimeter is stuck and the VSI shows zero during a descent. The ASI…','Høydemåleren står fast og VSI viser null i en nedstigning. Fartsmåleren …'),a:[t2('reads too high','viser for høyt'),t2('reads too low','viser for lavt'),t2('falls to zero','faller til null')],c:0,e:t2('Static is blocked. Lower down the real total pressure is higher, but it is compared with the trapped static: the ASI over-reads.','Statisk er blokkert. Lenger ned er det virkelige totaltrykket høyere, men det sammenlignes med det fangede statiske: fartsmåleren viser for høyt.')},
 {q:t2('In an unpressurised aircraft you open the alternate static source in the cabin. Typically…','I et fly uten trykkabin åpner du alternativ statisk kilde i kabinen. Typisk …'),a:[t2('the altimeter and ASI read slightly high','viser høydemåler og fartsmåler litt for høyt'),t2('the altimeter and ASI read slightly low','viser høydemåler og fartsmåler litt for lavt'),t2('nothing changes','endres ingenting')],c:0,e:t2('Air flowing past the cabin lowers its pressure slightly, so both read a little high, and the VSI shows a brief climb.','Luften som strømmer forbi kabinen senker trykket litt, så begge viser litt for høyt, og VSI viser en kort stigning.')},
 {q:t2('At the same IAS, the TAS at 10 000 ft compared with sea level is…','Med samme IAS er TAS i 10 000 ft sammenlignet med ved havet …'),a:[t2('about 20 % higher','rundt 20 % høyere'),t2('about 20 % lower','rundt 20 % lavere'),t2('the same','den samme')],c:0,e:t2('The air is thinner, so the aircraft must move faster through it for the same dynamic pressure: about 2 % per 1 000 ft.','Luften er tynnere, så flyet må bevege seg raskere gjennom den for samme dynamiske trykk: omtrent 2 % per 1 000 ft.')},
 {q:t2('You change from a level flight to a 500 ft/min climb. The VSI…','Du går fra planflyging til 500 ft/min stigning. VSI …'),a:[t2('shows a climb at once, the correct rate after 6–9 s','viser stigning med en gang, riktig rate etter 6–9 s'),t2('shows nothing for 6–9 s','viser ingenting i 6–9 s'),t2('shows the exact rate at once','viser eksakt rate med en gang')],c:0,e:t2('The metered leak makes the case pressure lag: trend at once, rate after a few seconds.','Den kalibrerte lekkasjen gjør at trykket i huset henger etter: trenden med en gang, raten etter noen sekunder.')},
 {q:t2('What does a Mach meter need?','Hva trenger et machmeter?'),a:[t2('Pitot and static pressure only','Bare pitot- og statisk trykk'),t2('Pitot pressure and outside air temperature','Pitottrykk og utetemperatur'),t2('Static pressure and temperature','Statisk trykk og temperatur')],c:0,e:t2('Mach is a function of the ratio of impact pressure to static pressure; no temperature is needed.','Mach er en funksjon av forholdet mellom støttrykk og statisk trykk; temperatur trengs ikke.')},
 {q:t2('Climbing at a constant CAS, the Mach number…','I stigning med konstant CAS vil machtallet …'),a:[t2('increases','øke'),t2('decreases','minke'),t2('stays the same','holde seg likt')],c:0,e:t2('TAS rises and the speed of sound falls with the temperature, so Mach rises.','TAS øker og lydhastigheten faller med temperaturen, så mach øker.')},
 {q:t2('The speeds disagree and make no sense. What do you fly?','Fartene er uenige og gir ingen mening. Hva flyr du etter?'),a:[t2('A known pitch attitude and power setting','En kjent pitch og effektinnstilling'),t2('The highest of the airspeeds','Den høyeste farten'),t2('The VSI','VSI')],c:0,e:t2('Pitch and power need no pitot-static system, and together they give a known speed.','Pitch og effekt trenger ikke pitot-statisk system, og sammen gir de en kjent fart.')},
 {q:t2('Near sea level, 1 hPa of altimeter setting is worth about…','Nær havet er 1 hPa på høydemåleren verdt omtrent …'),a:[t2('27 ft','27 ft'),t2('10 ft','10 ft'),t2('100 ft','100 ft')],c:0,e:t2('About 27–30 ft per hPa near sea level, more higher up.','Omtrent 27–30 ft per hPa nær havet, mer høyere opp.')}]).map(q=>{ const o=LAB.shuffle(q.a.map((_,i)=>i)); return {...q,a:o.map(i=>q.a[i]),c:o.indexOf(q.c)}; }),10);

/* ---------------- static strings, text, start ---------------- */
LAB.add({},{'Air Data':'Luftdata','Air data: pressure, altitude and airspeed':'Luftdata: trykk, høyde og fart','Birdbird Virtual Labs · Instruments':'Birdbird Virtual Labs · Instrumenter',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Key concepts':'Nøkkelbegreper','Deep dive':'Dypdykk','The air data lab':'Luftdatalabben','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','Faults':'Feil','Altimeter':'Høydemåler','Conditions':'Forhold','The flight':'Flygingen','Scenarios':'Scenarier','Advanced':'Avansert','Set the actual QNH':'Sett faktisk QNH','Alternate static open':'Alternativ statisk åpen','Mode':'Modus','Sections':'Seksjoner',
 'Pitot-static system wired to the airspeed indicator, altimeter and VSI, with a side view of the aircraft over the terrain.':'Pitot-statisk system koblet til fartsmåler, høydemåler og VSI, med et sidebilde av flyet over terrenget.'});
LAB.tx({lead:'To trykk driver de grunnleggende flyinstrumentene. De statiske portene kjenner den stille luften rundt deg, pitotrøret kjenner luften som presses inn i det. Fra dem regner høydemåleren, fartsmåleren og VSI ut høyde, fart og stigning. Se hva hver innstilling betyr, hvor høydemåleren lyver, hvordan IAS blir TAS, og hva et blokkert rør gjør.'});
function texts(){
  el('kin').textContent=L(t2('Ten ideas that carry the air data instruments. “Show in the model” sets the lab up so you can see it.','Ti ideer som bærer luftdatainstrumentene. «Vis i modellen» setter opp labben så du kan se det.'));
  el('xLead').textContent=L(deepOn()?t2('Pick a mode above the figure. Change the weather, the setting in the altimeter window, the flight or a fault, and the instruments answer with the real physics. The side view shows your real altitude against what the altimeter says; in Airspeeds it becomes the IAS to TAS ladder. Deep dive adds the Mach meter, CAS and EAS and the pressures in the pipes.','Velg modus over figuren. Endre været, innstillingen i høydemålervinduet, flygingen eller en feil, så svarer instrumentene med virkelig fysikk. Sidebildet viser virkelig høyde mot det høydemåleren sier; i Farter blir det stigen fra IAS til TAS. Dypdykk legger til machmeteret, CAS og EAS og trykkene i rørene.')
    :t2('Pick a mode above the figure, then move the controls. The instruments are wired to the pitot tube and static port on the left; the side view shows where you really are and where the altimeter says you are.','Velg modus over figuren og flytt på kontrollene. Instrumentene er koblet til pitotrøret og den statiske porten til venstre; sidebildet viser hvor du egentlig er, og hvor høydemåleren sier du er.'));
  el('tryLead').textContent=L(t2('Work it out first, then check. "Set it up in the model" shows you why.','Regn det ut først, og sjekk. «Sett det opp i modellen» viser deg hvorfor.'));
  el('altStL').textContent=L(t2('Alternate static open','Alternativ statisk åpen'));
  el('faultH').textContent=L(t2('A blockage traps the pressure at the moment it happens. Then climb or descend.','En blokkering fanger trykket i øyeblikket den skjer. Stig eller synk etterpå.'));
  el('foot').innerHTML=L(t2('<b>Model and limitations.</b> Teaching model, not for flight. ICAO standard atmosphere (Doc 7488) to 41 000 ft. The real atmosphere has one sea-level pressure (actual QNH) and the ISA lapse rate shifted by a constant deviation; the real altitude comes from the hypsometric equation with that column, counted from sea level. The altimeter reads ISA pressure altitude minus the pressure altitude of the subscale setting. Airspeeds use subsonic compressible flow: CAS from impact pressure, Mach from impact over static pressure, TAS = Mach × speed of sound. The VSI is a first-order lag (3 s, about 9 s to settle). Alternate static is modelled as 1.5 hPa below outside pressure. Time runs four times faster than real time. The aerodrome and ridge are illustrative.','<b>Modell og begrensninger.</b> Undervisningsmodell, ikke for flyging. ICAOs standardatmosfære (Doc 7488) til 41 000 ft. Den virkelige atmosfæren har ett trykk ved havet (faktisk QNH) og ISA-temperaturgradienten forskjøvet med et fast avvik; virkelig høyde kommer fra den hypsometriske ligningen for den søylen, regnet fra havet. Høydemåleren viser ISA-trykkhøyde minus trykkhøyden til innstillingen. Fartene bruker subsonisk kompressibel strømning: CAS fra støttrykk, mach fra støttrykk delt på statisk trykk, TAS = mach × lydhastighet. VSI er en første ordens forsinkelse (3 s, rundt 9 s til den står). Alternativ statisk er modellert som 1,5 hPa under trykket ute. Tiden går fire ganger raskere enn virkelig tid. Flyplassen og åsen er illustrerende.'));
  el('ddH').textContent=L(t2('Deep dive','Dypdykk')); }
function all(){ texts(); drawTabs(); drawPre(); drawVsBtns(); drawTask(); drawDD(); drawTake(); syncCtl(); upd(); }
LAB.onLang(all);
document.addEventListener('labdepth',all);
LAB.start('air');
snapVsi(); setMode('set'); all();
/* old anchors from altimetry.html and pitot.html */
const HM={'#settings':'set','#errors':'err','#speeds':'spd','#blockages':'blk'}, HD={'#dd-da':'dd-da','#dd-cold':'dd-cold','#dd-blk':'dd-blk','#dd-uas':'dd-uas'};
if(HM[location.hash]){ setMode(HM[location.hash]); requestAnimationFrame(()=>el('adVp').scrollIntoView({block:'start'})); }
if(HD[location.hash]){ if(depth()==='short') LAB.setDepth('deep'); requestAnimationFrame(()=>{ const d=el(HD[location.hash]); if(d){ d.open=true; d.scrollIntoView({block:'center'}); } }); }
})();
