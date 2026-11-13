/* Birdbird – autoflight.js: the Automation and warnings lab (autoflight.html).
   One dark figure: a PFD with the flight mode annunciator on the left, a plan view and a side view on the right.
   Four modes: Autopilot & FD (light single two-axis AP or jet FD/AP/A-THR), Autothrust (jet, thrust levers), TCAS, EGPWS.
   All logic in afcore.js (AFC). */
(function(){
'use strict';
const {L,el,nf}=LAB, A=AFC, t2=(en,no)=>({en,no});
const D2R=Math.PI/180, clamp=A.clamp;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const MONO='"IBM Plex Mono", ui-monospace, monospace', SANS='"Public Sans", system-ui, sans-serif';
const C={txt:'#EEF2F5',mut:'#8E99A4',dim:'#5E6D7C',grn:'#3FE08A',cyn:'#7FDCEB',mag:'#E77FD6',amb:'#F0B440',red:'#F0503F',wht:'#F4F7F9',sky:'#2E6EA6',gnd:'#7A5530',ter:'#34493B',terL:'#5F8A69',sea:'rgba(60,110,150,.35)',grid:'rgba(200,215,225,.10)',own:'#F4F7F9',path:'#C9B6F2'};
const depth=()=>document.body.classList.contains('depth-short')?'short':document.body.classList.contains('depth-instructor')?'instructor':'deep';
const deepOn=()=>depth()!=='short';
const sg=v=>(v>0?'+':v<0?'−':'')+nf(Math.abs(v),0);
const ft=v=>nf(Math.round(v/10)*10,0)+' ft';

/* ---------------- state ---------------- */
const V={mode:'ap',run:false,tx:5,txw:4,pre:{ap:'appr',at:'cruise',tcas:'climb',gpws:'sink'}};
let S=null, script=null;                         // autopilot sim (ap and at modes)
const TC={alt:12000,r0:8,clo:420,dz0:-1000,vi:1000,vo:0,eq:'tcas',resp:'ra'}; let E=null, tT=0;
const GW={sc:'sink',rod:4000,spd:200,cfg:'clean',bank:0,la:true}; let GF=null, gT=0, pullT=null;

/* ---------------- canvas helpers ---------------- */
const cv=el('afv'); const ST=LAB.fit(cv,()=>draw(),2);
let FS=1;
function txt(g,s,x,y,col,al,sz,wt,font,bl){ g.font=`${wt||500} ${Math.round((sz||12)*FS*10)/10}px ${font||MONO}`; g.fillStyle=col||C.txt; g.textAlign=al||'left'; g.textBaseline=bl||'alphabetic'; g.fillText(s,x,y); g.textAlign='left'; g.textBaseline='alphabetic'; }
function line(g,x1,y1,x2,y2,col,w,dash){ g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]); }
function poly(g,pts,col,w,dash){ if(pts.length<2) return; g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y)); g.stroke(); g.setLineDash([]); }
function dot(g,x,y,r,fill,stroke,w){ g.beginPath(); g.arc(x,y,r,0,Math.PI*2); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=w||1.5; g.stroke(); } }
function rr(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }
function tag(g,s,x,y,col,o){ o=o||{}; const sz=(o.sz||11)*FS; g.font=`${o.wt||600} ${sz}px ${o.font||SANS}`; const w=g.measureText(s).width+10, h=sz+7;
  let bx=o.al==='right'?x-w:o.al==='center'?x-w/2:x; if(o.box){ bx=clamp(bx,o.box[0]+2,o.box[0]+o.box[2]-w-2); } const by=y-h/2;
  if(o.bg!==false){ g.fillStyle='rgba(10,14,18,.82)'; rr(g,bx,by,w,h,3); g.fill(); }
  g.fillStyle=col||C.txt; g.textBaseline='middle'; g.textAlign='left'; g.fillText(s,bx+5,y+0.5); g.textBaseline='alphabetic'; return [bx,by,bx+w,by+h]; }
function panel(g,b,title,right){ const [x,y,w,h]=b; g.fillStyle='rgba(6,9,12,.38)'; rr(g,x,y,w,h,6); g.fill(); g.strokeStyle='rgba(255,255,255,.06)'; g.lineWidth=1; g.stroke();
  if(title) txt(g,title,x+10,y+16,'#AEB8C1','left',10.5,600); if(right) txt(g,right,x+w-10,y+16,C.mut,'right',10.5); }
function planeTop(g,x,y,hdg,s,col){ g.save(); g.translate(x,y); g.rotate(hdg*D2R); g.scale(s/20,s/20); g.fillStyle=col; g.beginPath();
  g.moveTo(0,-11); g.lineTo(1.6,-7); g.lineTo(1.6,-2); g.lineTo(10,3); g.lineTo(10,5); g.lineTo(1.6,2.5); g.lineTo(1.2,8); g.lineTo(4,10); g.lineTo(4,11.5); g.lineTo(0,10.6); g.lineTo(-4,11.5); g.lineTo(-4,10); g.lineTo(-1.2,8); g.lineTo(-1.6,2.5); g.lineTo(-10,5); g.lineTo(-10,3); g.lineTo(-1.6,-2); g.lineTo(-1.6,-7); g.closePath(); g.fill(); g.restore(); }
function planeSide(g,x,y,s,col,pitch){ g.save(); g.translate(x,y); g.rotate(-(pitch||0)*D2R); g.scale(s/20,s/20); g.beginPath();
  g.moveTo(-20,-1); g.lineTo(-17,-7); g.lineTo(-14,-7); g.lineTo(-11,-2); g.lineTo(12,-2.5); g.quadraticCurveTo(19,-2,20,0.5); g.quadraticCurveTo(18,2.5,12,2.5); g.lineTo(-18,2); g.closePath(); g.fillStyle=col; g.fill(); g.restore(); }

/* ================= the PFD ================= */
/* P: {ias,alt,vs,hdg,pitch,bank,selSpd,selAlt,selHdg,vRed,vAmb,vMax,fma,ga,loc,gs,ra,warn,strip,bands,fd} */
function drawPFD(g,b,P){ const [x0,y0,w,h]=b, ph=ST.w<640;
  g.fillStyle='#05080B'; rr(g,x0,y0,w,h,6); g.fill();
  const fh=clamp(h*0.14,36,58); drawStrip(g,[x0+4,y0+4,w-8,fh],P);
  const top=y0+fh+10, hh=y0+h-top-(ph?30:36), bot=top+hh;
  const sw=w*0.16, aw=w*0.18, vw=w*0.085, ax0=x0+sw+8, ax1=x0+w-aw-vw-10, acx=(ax0+ax1)/2, acy=top+hh*0.47, ar=Math.min((ax1-ax0)/2,hh*0.5);
  /* attitude */
  g.save(); g.beginPath(); rr(g,ax0,top,ax1-ax0,hh,8); g.clip();
  const ppd=ar/22;   // px per degree of pitch
  g.translate(acx,acy); g.rotate(-(P.bank||0)*D2R);
  const py=(P.pitch||0)*ppd; g.fillStyle=C.sky; g.fillRect(-w,-h*2+py,w*2,h*2); g.fillStyle=C.gnd; g.fillRect(-w,py,w*2,h*2); line(g,-w,py,w,py,'#fff',1.4);
  for(let p=-30;p<=30;p+=2.5){ if(!p) continue; const yy=py-p*ppd; if(Math.abs(yy)>ar*0.6) continue; const L2=p%10===0?ar*0.32:p%5===0?ar*0.2:ar*0.09; line(g,-L2,yy,L2,yy,'rgba(255,255,255,.85)',1.1); if(p%10===0){ txt(g,String(Math.abs(p)),-L2-4,yy+4,'#fff','right',9.5); } }
  g.restore();
  /* bank scale and aircraft symbol */
  g.save(); g.beginPath(); rr(g,ax0,top,ax1-ax0,hh,8); g.clip();
  for(const a of [-30,-20,-10,0,10,20,30]){ const r1=ar*0.86, r2=r1-(a%30===0?10:6), aa=(a-90)*D2R; line(g,acx+Math.cos(aa)*r1,acy+Math.sin(aa)*r1,acx+Math.cos(aa)*r2,acy+Math.sin(aa)*r2,'#fff',1.3); }
  const ba=(-(P.bank||0)-90)*D2R, br=ar*0.86-12; g.fillStyle='#fff'; g.beginPath(); g.moveTo(acx+Math.cos(ba)*br,acy+Math.sin(ba)*br); g.lineTo(acx+Math.cos(ba+0.06)*(br-9),acy+Math.sin(ba+0.06)*(br-9)); g.lineTo(acx+Math.cos(ba-0.06)*(br-9),acy+Math.sin(ba-0.06)*(br-9)); g.fill();
  g.fillStyle='#000'; g.strokeStyle='#FFD34D'; g.lineWidth=3; const ws=ar*0.42; line(g,acx-ws,acy,acx-ws*0.35,acy,'#FFD34D',4); line(g,acx+ws*0.35,acy,acx+ws,acy,'#FFD34D',4); g.fillStyle='#FFD34D'; g.fillRect(acx-3,acy-3,6,6);
  if(P.fd){ const fp=clamp((P.fdP||0)*ppd,-ar*0.6,ar*0.6), fr=clamp((P.fdR||0)*ar/40,-ar*0.6,ar*0.6); line(g,acx-ar*0.45,acy-fp,acx+ar*0.45,acy-fp,C.grn,2.2); line(g,acx+fr,acy-ar*0.45,acx+fr,acy+ar*0.45,C.grn,2.2); }
  /* localiser and glide slope deviation */
  const dv=(v,horiz)=>{ const n=clamp(v,-2.3,2.3); if(horiz){ const yy=bot-14, sx=ar*0.32; for(const d of [-2,-1,1,2]) dot(g,acx+d*sx,yy,2.6,null,'#fff',1.2); g.fillStyle=C.mag; g.beginPath(); const xx=acx+n*sx; g.moveTo(xx,yy-6); g.lineTo(xx+6,yy); g.lineTo(xx,yy+6); g.lineTo(xx-6,yy); g.fill(); }
    else { const xx=ax1-12, sy=hh*0.12; for(const d of [-2,-1,1,2]) dot(g,xx,acy+d*sy,2.6,null,'#fff',1.2); g.fillStyle=C.mag; g.beginPath(); const yy=acy+n*sy; g.moveTo(xx-6,yy); g.lineTo(xx,yy-6); g.lineTo(xx+6,yy); g.lineTo(xx,yy+6); g.fill(); } };
  if(P.loc!=null) dv(P.loc,true); if(P.gs!=null) dv(P.gs,false);
  if(P.ra!=null&&P.ra<2500) txt(g,String(Math.round(P.ra/10)*10),acx,bot-(P.loc!=null?28:12),P.ra<500?C.amb:'#fff','center',13,700);
  if(P.warn){ const [s,c]=P.warn; g.font=`700 ${Math.round(clamp(ar*0.2,14,26)*FS)}px ${SANS}`; const tw=g.measureText(s).width+18, th=clamp(ar*0.2,14,26)*FS+12;
    g.fillStyle='rgba(0,0,0,.72)'; rr(g,acx-tw/2,acy+ar*0.3-th/2,tw,th,4); g.fill(); g.strokeStyle=c; g.lineWidth=2; g.stroke(); g.fillStyle=c; g.textAlign='center'; g.textBaseline='middle'; g.fillText(s,acx,acy+ar*0.3+1); g.textAlign='left'; g.textBaseline='alphabetic'; }
  g.restore();
  /* speed tape */
  tape(g,[x0+4,top,sw,hh],P.ias,4,10,v=>String(Math.round(v)),{bug:P.selSpd,bugCol:P.ga?null:C.mag,bands:[[0,P.vRed,C.red],[P.vRed,P.vAmb,C.amb],[P.vMax,999,C.red]],min:0,lab:P.ga?'KT':'KT',trend:P.trend});
  /* altitude tape */
  tape(g,[ax1+8,top,aw,hh],P.alt,100,500,v=>nf(Math.round(v/100)*100,0),{bug:P.selAlt,bugCol:C.cyn,min:-1000,alt:true,sel:P.selAlt,lab:'FT'});
  /* vertical speed */
  vsi(g,[x0+w-vw-2,top,vw,hh],P.vs,P.bands);
  /* heading */
  const hy=bot+6, hw=ax1-ax0, hcx=acx; g.save(); g.beginPath(); g.rect(ax0,hy,hw,ph?22:28); g.clip(); g.fillStyle='#1a2026'; g.fillRect(ax0,hy,hw,30);
  const ppdH=hw/60; for(let d=Math.floor(P.hdg/5)*5-35;d<=P.hdg+35;d+=5){ const xx=hcx+(d-P.hdg)*ppdH, n=((d%360)+360)%360; line(g,xx,hy,xx,hy+(n%10===0?7:4),'#fff',1); if(n%30===0&&xx-12>ax0&&xx+12<ax0+hw&&Math.abs(xx-hcx)>26) txt(g,String(n/10).padStart(2,'0'),xx,hy+(ph?18:20),'#fff','center',10); }
  if(P.selHdg!=null){ const xx=hcx+A.angDiff(P.selHdg,P.hdg)*ppdH; g.fillStyle=C.cyn; g.fillRect(clamp(xx,ax0,ax0+hw)-4,hy,8,5); }
  g.restore(); g.fillStyle='#000'; g.fillRect(hcx-19,hy,38,ph?16:18); g.strokeStyle='#fff'; g.lineWidth=1; g.strokeRect(hcx-19,hy,38,ph?16:18); txt(g,String(Math.round(P.hdg)%360).padStart(3,'0'),hcx,hy+(ph?12:13),'#fff','center',11,600);
}
function tape(g,b,v,minor,major,fmt,o){ const [x,y,w,h]=b, ppu=h/(o.alt?1400:90)*(o.alt?1:1), cy=y+h/2, ph=ST.w<640;
  g.save(); g.fillStyle='#2a3238'; g.fillRect(x,y,w,h); g.beginPath(); g.rect(x,y,w,h); g.clip();
  const span=o.alt?700:45, sc=h/(2*span);
  if(o.bands) for(const [a,bb,c] of o.bands){ if(bb==null||a==null||bb<=a) continue; const ya=cy-(a-v)*sc, yb=cy-(bb-v)*sc; g.fillStyle=c; const xx=o.alt?x:x+w-6; g.fillRect(xx,Math.min(ya,yb),5,Math.abs(ya-yb)); }
  const st=o.alt?100:5; for(let u=Math.floor((v-span)/st)*st;u<=v+span;u+=st){ if(u<o.min) continue; const yy=cy-(u-v)*sc, big=o.alt?u%500===0:u%10===0;
    if(o.alt){ line(g,x,yy,x+(big?9:5),yy,'#fff',1); if(big) txt(g,fmt(u),x+12,yy+4,'#fff','left',ph?9.5:10.5); }
    else { line(g,x+w-(big?9:5),yy,x+w,yy,'#fff',1); if(big) txt(g,fmt(u),x+w-12,yy+4,'#fff','right',ph?9.5:10.5); } }
  if(o.bug!=null&&o.bugCol){ const yy=clamp(cy-(o.bug-v)*sc,y+4,y+h-4); g.fillStyle=o.bugCol; const bx=o.alt?x:x+w-8; g.beginPath(); g.moveTo(bx,yy-6); g.lineTo(bx+8,yy-6); g.lineTo(bx+8,yy+6); g.lineTo(bx,yy+6); g.lineTo(o.alt?bx+4:bx+4,yy); g.closePath(); g.fill(); }
  if(o.trend&&Math.abs(o.trend)>1){ const yy=cy-o.trend*10*sc; line(g,x+w-2,cy,x+w-2,yy,C.grn,2); }
  g.restore();
  g.fillStyle='#000'; const bh=ph?18:22; g.fillRect(x-1,cy-bh/2,w+2,bh); g.strokeStyle='#fff'; g.lineWidth=1.2; g.strokeRect(x-1,cy-bh/2,w+2,bh);
  txt(g,o.alt?nf(Math.round(v/10)*10,0):String(Math.round(v)),x+w/2,cy+5,'#fff','center',ph?11:13,600);
  if(o.sel!=null) txt(g,nf(o.sel,0),x+w/2,y-3,C.cyn,'center',ph?10:11,600); }
function vsi(g,b,vs,bands){ const [x,y,w,h]=b, cy=y+h/2, ph=ST.w<640, Y=v=>cy-Math.sign(v)*Math.sqrt(Math.min(Math.abs(v),6000)/6000)*(h/2-6);
  g.fillStyle='#2a3238'; g.fillRect(x,y,w,h);
  if(bands) for(const [a,bb,c] of bands){ const ya=Y(a), yb=Y(bb); g.fillStyle=c; g.fillRect(x+1,Math.min(ya,yb),w*0.42,Math.abs(ya-yb)); }
  for(const v of [-6000,-4000,-2000,-1000,-500,0,500,1000,2000,4000,6000]){ const yy=Y(v); line(g,x+w*0.45,yy,x+w*0.62,yy,'#fff',1); if(v&&Math.abs(v)!==500&&Math.abs(v)!==4000&&!ph) txt(g,String(Math.abs(v)/1000),x+w*0.66,yy+4,'#C9D2DA','left',9); }
  line(g,x+w*0.98,cy,x+w*0.45,Y(vs),'#fff',2.2);
  if(Math.abs(vs)>=200) txt(g,(vs>0?'+':'−')+nf(Math.abs(Math.round(vs/50)*50),0),x+w/2,y+h+14,C.grn,'center',ph?9:10,600); }
/* the annunciator strip on top of the PFD */
function drawStrip(g,b,P){ const [x,y,w,h]=b; g.fillStyle='#0b0f13'; g.fillRect(x,y,w,h); g.strokeStyle='#3A444C'; g.lineWidth=1; g.strokeRect(x+0.5,y+0.5,w-1,h-1);
  const fs=clamp(w/(ST.w<640?30:34),9.5,14)/FS;
  if(P.strip){ const [s,c,sub]=P.strip; if(!s){ txt(g,P.idle||'',x+w/2,y+h/2,C.dim,'center',fs*0.85,500,SANS,'middle'); return; } txt(g,s,x+w/2,y+h*0.45,c,'center',fs*1.15,700,MONO,'middle'); if(sub) txt(g,sub,x+w/2,y+h*0.8,C.mut,'center',fs*0.8,500,SANS,'middle'); return; }
  const F=P.fma; if(!F) return;
  if(P.ga){ /* light aircraft autopilot: one row of boxes, armed modes in white */
    const cw=[0.15,0.31,0.31,0.23]; let xx=x; const cells=[[F.ap?'AP':'',C.grn,''],[F.lat,C.grn,F.lArm],[F.vert,C.grn,F.vArm.join(' ')],[P.gaTgt||'',C.cyn,'']];
    cells.forEach(([a,c,arm],i)=>{ const cx=xx+cw[i]*w/2; if(i) line(g,xx,y+5,xx,y+h-5,'#3A444C',1);
      if(a) txt(g,a,arm?cx-cw[i]*w*0.2:cx,y+h/2,c,'center',fs,700,MONO,'middle'); if(arm) txt(g,arm,cx+cw[i]*w*0.2,y+h/2,'#E8EEF2','center',fs*0.92,600,MONO,'middle'); xx+=cw[i]*w; });
    if(P.boxV) { /* no box on the light AP strip */ } return; }
  const cw=[0.24,0.27,0.21,0.28]; let xx=x; const xs=cw.map(c=>{ const a=xx; xx+=c*w; return a; });
  for(let i=1;i<4;i++) line(g,xs[i],y+4,xs[i],y+h-4,'#3A444C',1);
  const row=r=>y+h*(r===0?0.3:0.72);
  const cell=(i,r,s,c,box)=>{ if(!s) return; const cx=xs[i]+cw[i]*w/2; txt(g,s,cx,row(r),c,'center',r?fs*0.88:fs,600,MONO,'middle');
    if(box){ g.font=`600 ${fs*FS}px ${MONO}`; const tw=g.measureText(s).width+8; g.strokeStyle='#E8EEF2'; g.lineWidth=1.2; g.strokeRect(cx-tw/2,row(r)-fs*0.75,tw,fs*1.5); } };
  const nb=k=>S&&S.chg[k]!=null&&S.t-S.chg[k]<10&&S.t>0.5;
  cell(0,0,F.thr,F.thr.startsWith('MAN')?'#E8EEF2':C.grn,nb('a')); if(P.thrMsg) cell(0,1,P.thrMsg,C.amb);
  cell(1,0,F.vert,C.grn,nb('v')); cell(1,1,F.vArm.join(' '),C.cyn); if(P.prot) cell(1,1,'SPD PROT',C.amb);
  cell(2,0,F.lat,C.grn,nb('l')); cell(2,1,F.lArm,C.cyn);
  const st=[F.ap?'AP':'',F.fd?'FD':''].filter(Boolean).join(' · '); cell(3,0,st||'',C.wht);
  cell(3,1,F.athr==='off'?'':'A/THR',F.athr==='arm'?C.cyn:C.wht); }

/* ================= Autopilot & FD, Autothrust ================= */
const AP_PRE={
 appr:{t:t2('Intercept and approach','Avskjæring og innflyging'),f:ac=>ac==='jet'?{x:-20,y:-5,hdg:60,selHdg:60,alt:5000,hold:5000,vm:'VS',selVs:-1000,selAlt:3000,ias:180,selSpd:180}:{x:-18,y:-4,hdg:60,selHdg:60,alt:3000,hold:3000,vm:'ALT',selAlt:3000,ias:110,pwr:0.58,selVs:-500}},
 climb:{t:t2('Climb to the selected altitude','Stigning til valgt høyde'),f:ac=>ac==='jet'?{x:-60,y:0,hdg:90,selHdg:90,alt:3000,hold:3000,vm:'LVL',lvlDir:1,selAlt:9000,ias:250,selSpd:250}:{x:-40,y:0,hdg:90,selHdg:90,alt:2000,hold:2000,vm:'VS',selVs:500,selAlt:5000,ias:90,pwr:1}},
 vs:{trap:1,t:t2('Trap: V/S beyond the engines','Felle: V/S over det motorene klarer'),f:ac=>ac==='jet'?{x:-80,y:0,hdg:90,selHdg:90,alt:5000,vm:'VS',selVs:3000,selAlt:15000,ias:250,selSpd:250}:{x:-40,y:0,hdg:90,selHdg:90,alt:3000,vm:'VS',selVs:1200,selAlt:8000,ias:100,pwr:1}},
 behind:{trap:1,t:t2('Trap: selected altitude behind you','Felle: valgt høyde bak deg'),f:ac=>Object.assign({x:-60,y:0,hdg:90,selHdg:90,alt:5000,vm:'VS',selAlt:6000,msa:2500},ac==='jet'?{selVs:-1000,ias:220,selSpd:220}:{selVs:-500,ias:100,pwr:0.3})},
 altstar:{trap:1,t:t2('Trap: new altitude during the capture','Felle: ny høyde under innfangingen'),f:ac=>Object.assign({x:-60,y:0,hdg:90,selHdg:90,alt:4000,vm:'VS',selAlt:5000},ac==='jet'?{selVs:1500,ias:250,selSpd:250}:{selVs:500,ias:90,pwr:1}),
   script:{cond:s=>s.vm==='CAP',act:s=>{ A.setSel(s,'alt',4500); s.ev.push({t:s.t,x:s.x,alt:s.alt,txt:'ATC 4500'}); }}},
 loc:{trap:1,t:t2('Trap: LOC (NAV) instead of approach','Felle: LOC (NAV) i stedet for innflyging'),f:ac=>ac==='jet'?{x:-20,y:-5,hdg:60,selHdg:60,alt:3000,hold:3000,vm:'ALT',selAlt:3000,ias:180,selSpd:180,lArm:true}:{x:-18,y:-4,hdg:60,selHdg:60,alt:3000,hold:3000,vm:'ALT',selAlt:3000,ias:110,pwr:0.58,lArm:true}}};
const AT_PRE={
 cruise:{t:t2('Level: SPEED and ALT','Planflukt: SPEED og ALT'),f:()=>({x:-80,y:0,hdg:90,selHdg:90,alt:5000,hold:5000,vm:'ALT',selAlt:5000,ias:250,selSpd:250,lever:'cl'})},
 climb:{t:t2('Climb: THR CLB and LVL CHG','Stigning: THR CLB og LVL CHG'),f:()=>({x:-80,y:0,hdg:90,selHdg:90,alt:5000,vm:'LVL',lvlDir:1,selAlt:12000,ias:250,selSpd:250,lever:'cl'})},
 idle:{t:t2('Descent: THR IDLE','Nedstigning: THR IDLE'),f:()=>({x:-80,y:0,hdg:90,selHdg:90,alt:12000,vm:'LVL',lvlDir:-1,selAlt:5000,ias:250,selSpd:250,lever:'cl'})},
 mid:{trap:1,t:t2('Trap: levers pulled out of the CL detent','Felle: hendlene trukket ut av CL-hakket'),f:()=>({x:-80,y:0,hdg:90,selHdg:90,alt:5000,hold:5000,vm:'ALT',selAlt:5000,ias:250,selSpd:250,lever:'mid'})},
 toga:{trap:1,t:t2('Trap: go-around, levers left in TOGA','Felle: go-around, hendlene står i TOGA'),f:()=>({x:-80,y:0,hdg:90,selHdg:90,alt:1500,vm:'VS',selVs:2000,selAlt:3000,ias:165,selSpd:165,lever:'toga',vmax:230})}};
function loadAP(k,ac){ const PR=V.mode==='at'?AT_PRE:AP_PRE; if(!PR[k]) k=Object.keys(PR)[0]; V.pre[V.mode]=k; const p=PR[k];
  ac=V.mode==='at'?'jet':(ac||(S&&S.ac)||'jet'); S=A.apMake(Object.assign({ac},p.f(ac))); if(S.lArm&&k==='loc'){ S.lArm=false; A.press(S,ac==='jet'?'LOC':'NAV'); }
  script=p.script?Object.assign({done:false},p.script):null; S.hist=[]; syncKnobs(); V.run=true; runBtn(); upd(); }
function apStepUI(dt){ if(!S) return; const n=Math.ceil(dt/0.1); for(let i=0;i<n;i++){ A.apStep(S,dt/n); if(script&&!script.done&&script.cond(S)){ script.done=true; script.act(S); sl.alt.set(S.selAlt); } }
  if(S.stall||S.ground){ V.run=false; runBtn(); } }
function apPFD(){ const F=A.fma(S), jet=S.ac==='jet', P=A.AC[S.ac], vmax=S.vmax||P.vmax, gd=A.gsDots(S.x,S.alt), ld=A.locDots(S.x,S.y);
  const warn=S.stall?['STALL',C.red]:S.ground&&!S.landed?['TERRAIN',C.red]:S.overspd?['OVERSPEED',C.red]:(S.stallW||S.ias<(jet?P.vls:P.vsw))&&!S.ground?[jet?'SPEED LOW':'STALL WARNING',C.amb]:S.msa&&S.alt<S.msa?[L(t2('BELOW MSA','UNDER MSA')),C.amb]:null;
  const hist=S.hist, tr=hist.length>3?(S.ias-hist[hist.length-3].ias)/Math.max(1,S.t-hist[hist.length-3].t):0;
  return {ias:S.ias,alt:S.alt,vs:S.vs,hdg:S.hdg,pitch:S.pitch||0,bank:S.bank||0,selSpd:jet?S.selSpd:null,selAlt:S.selAlt,selHdg:S.lm==='HDG'?S.selHdg:null,
    vRed:jet?P.vsw:P.vs1,vAmb:jet?P.vls:P.vsw,vMax:vmax,fma:F,ga:!jet,gaTgt:S.vm==='VS'?F.vert.replace('VS ','')+' FPM':'ALT '+nf(S.selAlt,0),prot:S.prot,thrMsg:S.lim?'A/THR LIMITED':'',
    loc:(S.lm==='TRK'||S.lArm||S.apr)&&S.x<1?ld:null,gs:(S.apr||S.vm==='GS')&&S.x<0?gd:null,ra:S.alt<2500?S.alt:null,warn,trend:tr,fd:jet&&S.fd,fdP:0,fdR:0}; }
/* plan view: the localiser course and the track */
function drawPlan(g,b){ const [x0,y0,w,h]=b, ph=ST.w<640; panel(g,b,L(t2('PLAN VIEW','KARTBILDE')),L(t2('localiser course 090','localiserkurs 090')));
  const xmin=Math.min(-24,S.x-2), xmax=2.5, ymid=-2, span=(xmax-xmin), pad=14, sc=Math.min((w-2*pad)/span,(h-40)/12), X=x=>x0+pad+(x-xmin)*sc, Y=y=>y0+26+(h-40)/2-(y-ymid)*sc;
  g.save(); g.beginPath(); g.rect(x0,y0+22,w,h-22); g.clip();
  for(let gx=Math.ceil(xmin/5)*5;gx<=xmax;gx+=5) line(g,X(gx),y0+22,X(gx),y0+h,C.grid,1);
  /* localiser: centreline and the beam (±2.5°) */
  const lx=A.LOC_X, far=xmin; g.fillStyle='rgba(231,127,214,.07)'; g.beginPath(); g.moveTo(X(lx),Y(0)); g.lineTo(X(far),Y((lx-far)*Math.tan(2.5*D2R))); g.lineTo(X(far),Y(-(lx-far)*Math.tan(2.5*D2R))); g.closePath(); g.fill();
  line(g,X(far),Y(0),X(lx),Y(0),'rgba(231,127,214,.7)',1.2,[6,4]);
  g.fillStyle='#C9D2DA'; g.fillRect(X(0),Y(0)-2.5,X(1.6)-X(0),5); txt(g,L(t2('runway','rullebane')),X(0.8),Y(0)+16,C.mut,'center',9.5);
  const gsx=-3000/(Math.tan(3*D2R)*6076.1)+A.GS_X; line(g,X(gsx),Y(0)-6,X(gsx),Y(0)+6,C.mut,1.5); if(!ph) txt(g,L(t2('G/S at 3 000 ft','G/S i 3 000 ft')),X(gsx),Y(0)-10,C.mut,'center',9.5);
  /* track flown and the heading bug */
  poly(g,S.hist.map(p=>[X(p.x),Y(p.y)]).concat([[X(S.x),Y(S.y)]]),C.path,2);
  if(S.lm==='HDG'){ const L3=40*FS, a=S.selHdg*D2R; line(g,X(S.x),Y(S.y),X(S.x)+Math.sin(a)*L3,Y(S.y)-Math.cos(a)*L3,C.cyn,1.3,[4,3]); }
  for(const e of S.ev) if(['LOC','NAV'].includes(e.txt)){ const p=S.hist.find(q=>q.t>=e.t)||S; dot(g,X(p.x),Y(p.y),3.5,C.grn); tag(g,e.txt+' '+L(t2('captured','fanget')),X(p.x),Y(p.y)+16,C.grn,{sz:10,al:'center',box:b}); }
  planeTop(g,X(S.x),Y(S.y),S.hdg,ph?16:20,C.own);
  g.restore(); }
/* side view: altitude against distance */
function drawSide(g,b){ const [x0,y0,w,h]=b, ph=ST.w<640; panel(g,b,L(t2('SIDE VIEW','SIDEBILDE')),L(t2('altitude against distance','høyde mot avstand')));
  const xmin=Math.min(-24,S.x-2), xmax=1.5, hi=Math.max(S.selAlt,S.alt,...S.hist.map(p=>p.alt),5000), top=Math.ceil((hi+800)/1000)*1000;
  const pl=x0+(ph?36:46), pr=x0+w-10, pt=y0+28, pb=y0+h-(ph?18:22), X=x=>pl+(x-xmin)/(xmax-xmin)*(pr-pl), Yf=a=>pb-a/top*(pb-pt);
  const stp=top<=6000?1000:top<=12000?2000:5000; for(let a=0;a<=top;a+=stp){ line(g,pl,Yf(a),pr,Yf(a),C.grid,1); txt(g,a?nf(a/1000,0)+'k':'0',pl-5,Yf(a)+4,C.dim,'right',9.5); }
  g.fillStyle=C.sea; g.fillRect(pl,Yf(0),pr-pl,pb-Yf(0)+2);
  g.fillStyle='#C9D2DA'; g.fillRect(X(0),Yf(0)-3,X(1.5)-X(0),3);
  /* glide slope and selected altitude */
  if(S.ac==='jet'||S.apr||true){ const xs=Math.max(xmin,-12); poly(g,[[X(xs),Yf(A.gsIdeal(xs))],[X(A.GS_X),Yf(0)]],'rgba(231,127,214,.75)',1.3,[6,4]); if(!ph) txt(g,L(t2('glide slope 3°','glidebane 3°')),X(-9),Yf(A.gsIdeal(-9))-8,C.mag,'center',9.5); }
  line(g,pl,Yf(S.selAlt),pr,Yf(S.selAlt),C.cyn,1.1,[3,4]); txt(g,L(t2('selected ','valgt '))+nf(S.selAlt,0),pr-4,Yf(S.selAlt)-5,C.cyn,'right',9.5);
  if(S.msa){ line(g,pl,Yf(S.msa),pr,Yf(S.msa),C.red,1,[2,3]); txt(g,'MSA '+nf(S.msa,0),pl+6,Yf(S.msa)-5,C.red,'left',9.5); }
  poly(g,S.hist.map(p=>[X(p.x),Yf(p.alt)]).concat([[X(S.x),Yf(S.alt)]]),C.path,2);
  let lastY=-99, lastX=-99; for(const e of S.ev){ if(['LOC','NAV','AP','AP OFF'].includes(e.txt)) continue; if(e.txt==='ALT'&&S.ac==='ga'&&S.ev.some(q=>q!==e&&q.txt==='ALT'&&q.t<e.t&&e.t-q.t<30)) continue;
    const xx=X(e.x), yy=Yf(e.alt); dot(g,xx,yy,3.2,e.txt==='STALL'||e.txt==='GROUND'?C.red:e.txt.startsWith('ATC')?C.amb:C.grn); const ty=Math.abs(xx-lastX)<70&&Math.abs(yy-14-lastY)<16?yy+18:yy-14;
    tag(g,e.txt==='CAP'?'ALT*':e.txt.startsWith('ATC')?L(t2('ATC: 4 500','ATC: 4 500')):e.txt,xx,ty,e.txt==='STALL'||e.txt==='GROUND'?C.red:e.txt.startsWith('ATC')?C.amb:C.grn,{sz:9.5,al:'center',box:b}); lastX=xx; lastY=ty; }
  planeSide(g,X(S.x),Yf(S.alt),ph?16:20,C.own,clamp(S.vs/200,-8,12)); }
/* autothrust: thrust quadrant and the thrust gauge */
function drawQuad(g,b){ const [x0,y0,w,h]=b, ph=ST.w<640; panel(g,b,L(t2('THRUST LEVERS AND THRUST','SKYVEHENDLER OG SKYVEKRAFT')),'');
  const qx=x0+w*0.08, qw=Math.min(w*0.22,90), qt=y0+34, qb=y0+h-16, pos={idle:0,mid:0.28,cl:0.55,mct:0.75,toga:1}, Yq=p=>qb-p*(qb-qt);
  g.fillStyle='#161c21'; rr(g,qx,qt-6,qw,qb-qt+12,6); g.fill(); g.fillStyle='#05080b'; g.fillRect(qx+qw/2-4,qt,8,qb-qt);
  for(const [k,lab] of [['idle','IDLE'],['cl','CL'],['mct','MCT'],['toga','TOGA']]){ const yy=Yq(pos[k]); line(g,qx+qw*0.18,yy,qx+qw*0.82,yy,'#6F7E8B',2); txt(g,lab,qx+qw+6,yy+4,k==='cl'?C.grn:C.mut,'left',ph?9.5:10.5,600); }
  const zone=[Yq(pos.cl),Yq(0)]; g.fillStyle='rgba(63,224,138,.08)'; g.fillRect(qx+2,zone[0],qw-4,zone[1]-zone[0]); txt(g,L(t2('A/THR active range','A/THR aktivt område')),qx+qw/2,zone[1]+12,'rgba(63,224,138,.7)','center',8.5);
  const ly=Yq(pos[S.lever]); g.fillStyle='#D9DEE2'; rr(g,qx+qw*0.12,ly-7,qw*0.76,14,4); g.fill(); g.fillStyle='#333'; g.fillRect(qx+qw*0.2,ly-1.5,qw*0.6,3);
  /* gauge: thrust as % of TOGA, with the limit the lever gives the autothrust */
  const gx=qx+qw+70*FS, gw=Math.max(80,x0+w-gx-16), gy=y0+h*0.36, gh=16, tog=1.2*A.tCl(S.alt), pc=v=>clamp(v/tog,0,1);
  txt(g,L(t2('THRUST (% of TOGA)','SKYVEKRAFT (% av TOGA)')),gx,gy-12,C.mut,'left',10,600);
  g.fillStyle='#161c21'; g.fillRect(gx,gy,gw,gh); g.fillStyle=athrA()?C.grn:'#E8EEF2'; g.fillRect(gx,gy,gw*pc(S.thr),gh);
  const limv=A.LEV[S.lever]<=1?Math.max(0.005,A.LEV[S.lever]*A.tCl(S.alt)):A.LEV[S.lever]*A.tCl(S.alt); const lx=gx+gw*pc(limv); line(g,lx,gy-5,lx,gy+gh+5,C.amb,2); txt(g,L(t2('lever','hendel')),lx,gy+gh+16,C.amb,'center',9.5);
  const cx=gx+gw*pc(A.tCl(S.alt)); line(g,cx,gy-3,cx,gy+gh+3,'#6F7E8B',1,[2,2]); txt(g,'CL',cx,gy-5,C.mut,'center',9);
  txt(g,nf(Math.round(pc(S.thr)*100),0)+' %',gx+gw,gy-12,C.txt,'right',12,600);
  const st=athrA()?(A.fma(S).thr==='SPEED'?L(t2('Autothrust holds the speed (SPEED)','Autothrust holder farten (SPEED)')):L(t2('Autothrust holds a fixed thrust; pitch holds the speed','Autothrust holder fast skyvekraft; pitch holder farten'))):A.LEV[S.lever]>1?L(t2('Manual thrust: the lever sets it, the speed is free','Manuell skyvekraft: hendelen bestemmer, farten er fri')):L(t2('Autothrust off: thrust follows the lever','Autothrust av: skyvekraften følger hendelen'));
  const yy=wrap(g,st,gx,gy+gh+40,gw,athrA()?C.grn:C.amb,ph?10:11,600);
  if(S.lim) wrap(g,L(t2('The lever is below CL: the autothrust cannot give more than the lever.','Hendelen står under CL: autothrust kan ikke gi mer enn hendelen.')),gx,yy+4,gw,C.amb,ph?9.5:10.5,500); }
function wrap(g,s,x,y,w,col,sz,wt){ g.font=`${wt} ${sz*FS}px ${SANS}`; const words=s.split(' '); let ln='', yy=y; for(const wd of words){ const t=ln?ln+' '+wd:wd; if(g.measureText(t).width>w&&ln){ txt(g,ln,x,yy,col,'left',sz,wt,SANS); g.font=`${wt} ${sz*FS}px ${SANS}`; ln=wd; yy+=sz*FS*1.35; } else ln=t; } if(ln) txt(g,ln,x,yy,col,'left',sz,wt,SANS); return yy+sz*FS*1.35; }
const athrA=()=>A.athrActive(S);
/* autothrust: speed and altitude against time */
function drawTime(g,b){ const [x0,y0,w,h]=b, ph=ST.w<640; panel(g,b,L(t2('SPEED AND ALTITUDE OVER TIME','FART OG HØYDE OVER TID')),L(t2('last 3 minutes','siste 3 minutter')));
  const H=S.hist.concat([{t:S.t,ias:S.ias,alt:S.alt}]), t1=Math.max(180,S.t), t0=t1-180, pl=x0+(ph?40:48), pr=x0+w-12, X=t=>pl+(t-t0)/180*(pr-pl);
  const hS=(h-46)*0.55, sT=y0+28, sB=sT+hS, aT=sB+14, aB=y0+h-14, vmax=S.vmax||A.AC.jet.vmax;
  const vs=H.map(p=>p.ias).concat([S.selSpd,A.AC.jet.vls]), vlo=Math.floor((Math.min(...vs)-15)/10)*10, vhi=Math.ceil((Math.max(...vs,vmax-Math.max(...vs)<90?vmax+10:0)+10)/10)*10, Ys=v=>sB-(v-vlo)/(vhi-vlo)*hS;
  for(let v=Math.ceil(vlo/20)*20;v<=vhi;v+=20){ line(g,pl,Ys(v),pr,Ys(v),C.grid,1); txt(g,String(v),pl-5,Ys(v)+4,C.dim,'right',9.5); }
  if(vmax<vhi){ g.fillStyle='rgba(240,80,63,.14)'; g.fillRect(pl,sT,pr-pl,Ys(vmax)-sT); txt(g,(S.vmax?L(t2('flap limit ','klaffgrense ')):'VMO ')+vmax,pr-4,Ys(vmax)-4,C.red,'right',9.5); }
  const vls=A.AC.jet.vls; if(vls>vlo){ g.fillStyle='rgba(240,180,64,.12)'; g.fillRect(pl,Ys(vls),pr-pl,sB-Ys(vls)); txt(g,L(t2('minimum speed ','minstefart '))+vls,pr-4,Ys(vls)+12,C.amb,'right',9.5); }
  line(g,pl,Ys(S.selSpd),pr,Ys(S.selSpd),C.mag,1.1,[4,3]); txt(g,L(t2('selected ','valgt '))+S.selSpd+' kt',pl+6,Ys(S.selSpd)-5,C.mag,'left',9.5);
  poly(g,H.filter(p=>p.t>=t0).map(p=>[X(p.t),Ys(p.ias)]),C.wht,2); txt(g,'IAS',pl+6,sT+12,C.wht,'left',10,600);
  const as=H.map(p=>p.alt).concat([S.selAlt]), alo=Math.floor((Math.min(...as)-500)/1000)*1000, ahi=Math.ceil((Math.max(...as)+500)/1000)*1000, Ya=a=>aB-(a-alo)/(ahi-alo)*(aB-aT);
  line(g,pl,aT-7,pr,aT-7,'rgba(255,255,255,.08)',1);
  for(let a=alo;a<=ahi;a+=(ahi-alo)>6000?2000:1000){ line(g,pl,Ya(a),pr,Ya(a),C.grid,1); txt(g,nf(a/1000,0)+'k',pl-5,Ya(a)+4,C.dim,'right',9.5); }
  line(g,pl,Ya(S.selAlt),pr,Ya(S.selAlt),C.cyn,1.1,[3,4]);
  poly(g,H.filter(p=>p.t>=t0).map(p=>[X(p.t),Ya(p.alt)]),C.path,2); txt(g,L(t2('ALTITUDE','HØYDE')),pl+6,aT+10,C.path,'left',10,600); }

/* ================= TCAS ================= */
function tcRun(){ E=A.encounter(Object.assign({dt:0.25},TC)); tT=clamp(tT,0,E.fr[E.fr.length-1].t); if(sl.tT){ sl.tT.inp.max=E.fr[E.fr.length-1].t; sl.tT.set(tT); } }
const fAt=t=>E.at(t);
function tcBands(f){ if(!f.ra) return null; const ra=f.ra, s=ra.sense; const R='rgba(240,80,63,.85)', Gr='rgba(63,224,138,.9)';
  if(ra.kind==='mon') return [[s>0?-6000:ra.vt,s>0?ra.vt:6000,R]];
  if(ra.kind==='lvl') return [[s>0?-6000:250,s>0?-250:6000,R],[-250,250,Gr]];
  const v=Math.abs(ra.vt); return s>0?[[-6000,v,R],[v,v+500,Gr]]:[[-v,6000,R],[-v-500,-v,Gr]]; }
function tcPFD(f){ const st=f.st, ra=f.ra;
  const strip=st==='ra'?[A.raText(ra),C.red,L(t2('aural: resolution advisory','lyd: unnvikelsesråd'))]:st==='coc'?['CLEAR OF CONFLICT',C.grn,'']:st==='ta'?['TRAFFIC, TRAFFIC',C.amb,L(t2('aural: traffic advisory','lyd: trafikkråd'))]:['',C.mut,''];
  return {ias:250,alt:f.zo,vs:f.vo,hdg:90,pitch:2.5+f.vo/400,bank:0,selSpd:null,selAlt:null,selHdg:null,vRed:150,vAmb:170,vMax:340,strip,idle:L(t2('TCAS: no advisory','TCAS: ingen råd')),bands:tcBands(f),warn:st==='ra'?['RA',C.red]:st==='ta'?['TA',C.amb]:null}; }
function tcSym(g,x,y,st,s){ s=s||7; if(st==='ra'){ g.fillStyle=C.red; g.fillRect(x-s,y-s,2*s,2*s); } else if(st==='ta'){ dot(g,x,y,s,C.amb); }
  else { g.beginPath(); g.moveTo(x,y-s*1.2); g.lineTo(x+s,y); g.lineTo(x,y+s*1.2); g.lineTo(x-s,y); g.closePath(); if(st==='prox'){ g.fillStyle=C.cyn; g.fill(); } else { g.strokeStyle=C.cyn; g.lineWidth=1.6; g.stroke(); } } }
const tcCol=st=>st==='ra'?C.red:st==='ta'?C.amb:C.cyn;
function drawTraffic(g,b,f){ const [x0,y0,w,h]=b, ph=ST.w<640; panel(g,b,L(t2('TRAFFIC DISPLAY','TRAFIKKSKJERM')),L(t2('range 10 NM','rekkevidde 10 NM')));
  const cx=x0+w/2, cy=y0+h-18, R=Math.min(h-64,w*0.5-14), sc=R/10;
  g.save(); g.beginPath(); g.rect(x0,y0+22,w,h-22); g.clip();
  g.strokeStyle='rgba(255,255,255,.22)'; g.lineWidth=1; g.beginPath(); g.arc(cx,cy,R,Math.PI*1.12,Math.PI*1.88); g.stroke();
  g.setLineDash([2,4]); g.beginPath(); g.arc(cx,cy,5*sc,Math.PI*1.08,Math.PI*1.92); g.stroke(); g.setLineDash([]);
  for(let a=0;a<12;a++){ const aa=a/12*2*Math.PI; dot(g,cx+Math.sin(aa)*2*sc,cy-Math.cos(aa)*2*sc,1.3,'rgba(255,255,255,.6)'); }
  txt(g,'5',cx+5*sc*Math.sin(-0.62)-6,cy-5*sc*Math.cos(0.62),C.dim,'right',9); txt(g,'10',cx+R*Math.sin(-0.55)-6,cy-R*Math.cos(0.55),C.dim,'right',9);
  /* the intruder on a constant bearing, 30° right */
  const brg=30*D2R, r=f.r, ix=cx+Math.sin(brg)*r*sc, iy=cy-Math.cos(brg)*r*sc;
  if(r<=11){ line(g,cx+Math.sin(brg)*TC.r0*sc,cy-Math.cos(brg)*TC.r0*sc,cx,cy,'rgba(127,220,235,.18)',1,[3,4]);
    tcSym(g,ix,iy,f.st,ph?6:7); const rel=Math.round(f.dz/100), lab=(rel>=0?'+':'−')+String(Math.abs(rel)).padStart(2,'0'), col=tcCol(f.st);
    txt(g,lab,ix,f.dz>=0?iy-12:iy+20,col,'center',11,700); if(Math.abs(f.vi)>=500) txt(g,f.vi>0?'↑':'↓',ix+14,iy+5,col,'left',13,700); }
  planeTop(g,cx,cy-6,0,ph?16:20,C.own);
  if(!ph||deepOn()) txt(g,L(t2('constant bearing, decreasing range: a collision course','konstant peiling, minkende avstand: kollisjonskurs')),x0+10,y0+34,C.dim,'left',9.5,500,SANS);
  g.restore(); }
function drawTcSide(g,b,f){ const [x0,y0,w,h]=b, ph=ST.w<640; panel(g,b,L(t2('SIDE VIEW','SIDEBILDE')),L(t2('relative to your start altitude, against time','i forhold til din starthøyde, mot tid')));
  const fr=E.fr, T=fr[fr.length-1].t, rel=z=>z-TC.alt, all=fr.map(q=>rel(q.zo)).concat(fr.map(q=>rel(q.zi))).concat([TC.dz0+(TC.vi)*T/60,TC.vo*T/60]);
  let lo=Math.min(...all,-800), hi=Math.max(...all,800); const pad=(hi-lo)*0.12; lo-=pad; hi+=pad;
  const pl=x0+(ph?40:50), pr=x0+w-12, pt=y0+28, pb=y0+h-(ph?20:24), X=t=>pl+10+t/T*(pr-pl-10), Y=z=>pb-(z-lo)/(hi-lo)*(pb-pt);
  const stp=(hi-lo)>3000?1000:500; for(let z=Math.ceil(lo/stp)*stp;z<=hi;z+=stp){ line(g,pl,Y(z),pr,Y(z),C.grid,1); txt(g,sg(z),pl-5,Y(z)+4,C.dim,'right',9.5); }
  /* no-response paths */
  poly(g,[[X(0),Y(0)],[X(T),Y(TC.vo*T/60)]],'rgba(244,247,249,.25)',1,[4,4]); poly(g,[[X(0),Y(TC.dz0)],[X(T),Y(TC.dz0+TC.vi*T/60)]],'rgba(127,220,235,.25)',1,[4,4]);
  /* CPA */
  const xc=X(E.tCPA); line(g,xc,pt,xc,pb,'rgba(255,255,255,.25)',1,[2,3]); txt(g,'CPA',xc,pb+(ph?13:15),C.mut,'center',9.5);
  /* the flown paths up to the cursor */
  const upto=fr.filter(q=>q.t<=tT+1e-6); poly(g,upto.map(q=>[X(q.t),Y(rel(q.zo))]),C.own,2.2);
  let seg=[], cur=null; for(const q of upto){ const c=tcCol(q.st); if(c!==cur&&seg.length){ poly(g,seg,cur,2.2); seg=[seg[seg.length-1]]; } cur=c; seg.push([X(q.t),Y(rel(q.zi))]); } if(seg.length) poly(g,seg,cur,2.2);
  planeSide(g,X(f.t),Y(rel(f.zo)),ph?14:17,C.own,clamp(f.vo/250,-8,10)); tcSym(g,X(f.t),Y(rel(f.zi)),f.st,ph?5:6);
  /* TA and RA markers */
  const mk=(t,lab,col,up)=>{ if(t==null) return; const q=fAt(t); line(g,X(t),pt,X(t),pb,col,1,[1,3]); tag(g,lab,X(t),pt+(up?8:24),col,{sz:9.5,al:'center',box:b}); };
  mk(E.taT,'TA',C.amb,true); mk(E.raT,E.ra0?A.raText(E.ra0).split(',')[0]:'RA',C.red,false);
  /* the miss at CPA */
  if(tT>=E.tCPA-0.1){ const q=fAt(E.tCPA), a=Y(rel(q.zo)), c=Y(rel(q.zi)), m=Math.abs(q.dz), col=m<E.S0.alim?C.red:C.grn; line(g,xc+8,a,xc+8,c,col,2); line(g,xc+4,a,xc+12,a,col,2); line(g,xc+4,c,xc+12,c,col,2);
    tag(g,nf(Math.round(m/10)*10,0)+' ft',xc+14,(a+c)/2,col,{sz:10.5,box:b}); }
  /* tau at the cursor */
  if(f.st!=='coc'&&f.t<E.tCPA&&!ph){ const tau=A.tau(f.r,TC.clo); txt(g,`τ = ${nf(f.r,1)} NM ÷ ${TC.clo} kt = ${nf(tau,0)} s`,pr-4,pb-6,C.txt,'right',10.5,600); } }

/* ================= EGPWS ================= */
const GSC={
 sink:{t:t2('Mode 1 · sink rate','Mode 1 · synkrate'),ter:()=>0,alt0:2400,spd:200,rod:4000,cfg:'clean',T:60},
 ridge:{t:t2('Mode 2 · rising terrain','Mode 2 · stigende terreng'),ter:x=>x<5?0:x<8.5?3300*Math.pow(Math.sin((x-5)/3.5*Math.PI/2),2):x<11?3300-(x-8.5)*400:2300,alt0:2600,spd:240,rod:0,cfg:'clean',T:150},
 to:{t:t2('Mode 3 · sink after take-off','Mode 3 · synk etter avgang'),ter:()=>0,alt0:0,spd:160,rod:900,cfg:'gear',T:70},
 low:{t:t2('Mode 4 · too low, wrong configuration','Mode 4 · for lavt, feil konfigurasjon'),ter:()=>0,alt0:1300,spd:170,rod:700,cfg:'clean',T:120},
 app:{t:t2('Mode 5 · below the glide slope','Mode 5 · under glidebanen'),ter:()=>0,alt0:1500,spd:140,rod:1100,cfg:'land',T:120},
 bank:{t:t2('Mode 6 · callouts and bank angle','Mode 6 · utrop og krengning'),ter:()=>0,alt0:1200,spd:140,rod:743,cfg:'land',T:100}};
const ter2=(sc,x,y)=>{ const b=GSC[sc].ter(x); if(sc==='ridge') return b*clamp(1-Math.pow(Math.abs(y-0.6*Math.sin(x*0.8))/6,2),0.35,1)+ (x>2?260*(1+Math.sin(x*1.7+y*1.1)):0); return 40+30*Math.sin(x*0.9+y*0.7); };
function gRun(){ const s=GSC[GW.sc], ter=s.ter, land=GW.cfg==='land', gear=GW.cfg!=='clean', dt=0.25;
  let alt=s.alt0, vs=GW.sc==='to'?1500:-GW.rod, x=0, maxA=0, f=[], prevRa=alt-ter(0), climbT=null;
  const rwyX=GW.sc==='app'||GW.sc==='bank'?(s.alt0-50)/(Math.tan(3*D2R)*6076.1)+0.16:null;
  for(let t=0;t<=s.T;t+=dt){ let tgtVs;
    if(pullT!=null&&t>=pullT+1) tgtVs=3000; else if(GW.sc==='to'){ tgtVs=alt<700&&climbT==null?1500:-GW.rod; if(alt>=700&&climbT==null) climbT=t; } else tgtVs=-GW.rod;
    const m=600*dt; vs+=clamp(tgtVs-vs,-m,m); if(pullT!=null&&t<pullT+1) vs=vs;
    const ra=alt-ter(x), ra1=(alt+vs*dt/60)-ter(x+GW.spd*dt/3600), clos=Math.max(0,(ra-ra1)/dt*60);
    maxA=Math.max(maxA,ra);
    const al=[]; const rod=-vs;
    const a1=A.m1(ra,rod); if(a1) al.push(['1',a1,a1==='PULL UP'?'w':'c']);
    const a2=A.m2(ra,clos,land,GW.spd); if(a2&&!(GW.sc==='app'||GW.sc==='bank')) al.push(['2',a2,a2==='PULL UP'?'w':'w']);
    if(GW.sc==='to'&&climbT!=null){ const a3=A.m3(ra,maxA-ra,maxA); if(a3) al.push(['3',a3,'c']); }
    if(GW.sc!=='to'){ const a4=A.m4(ra,GW.spd,gear,land); if(a4) al.push(['4',a4,'c']); }
    let dots=null; if(rwyX!=null){ dots=A.gsDots(x-rwyX+0.16-0.16+0,alt); dots=A.gsDots(x-rwyX,alt); const a5=A.m5(ra,-dots,gear); if(a5) al.push(['5',a5,'c']); }
    if(GW.sc==='bank'){ const a6=A.m6bank(ra,GW.bank); if(a6) al.push(['6',a6,'c']); const co=A.callout(prevRa,ra); if(co) al.push(['6',co,'i']); }
    let la=null; if(GW.la&&GW.sc==='ridge'){ la=A.lookAhead(x,alt,vs,GW.spd,ter); const lv=A.laLevel(la); if(lv) al.push(['TA',lv,la<=A.LA_WARN?'w':'c']); }
    f.push({t,x,alt,vs,ra,clos,al,dots,la});
    prevRa=ra; if(ra<=0&&t>3){ f[f.length-1].impact=true; break; } if(rwyX!=null&&x>=rwyX-0.02) break;
    alt+=vs*dt/60; x+=GW.spd*dt/3600; if(alt<0&&GW.sc==='to'&&t<2) alt=0; }
  GF={f,ter,rwyX,dt}; gT=clamp(gT,0,f[f.length-1].t); if(sl.tT){ sl.tT.inp.max=f[f.length-1].t; sl.tT.set(gT); } }
const gAt=t=>GF.f[clamp(Math.round(t/GF.dt),0,GF.f.length-1)];
const gTop=q=>{ const w=q.al.find(a=>a[2]==='w'); if(w) return w; const c=q.al.find(a=>a[2]==='c'); if(c) return c; return q.al.find(a=>a[2]==='i')||null; };
/* the alert heard at the cursor: callouts linger for 2 s */
function gHeard(t){ const q=gAt(t), a=gTop(q); if(a&&a[2]!=='i') return a; for(let k=0;k<8;k++){ const p=gAt(t-k*0.25); const c=p.al.find(z=>z[2]==='i'); if(c) return c; } return a; }
function gPFD(q){ const a=gHeard(q.t), sc=GSC[GW.sc];
  const strip=a?[a[1],a[2]==='w'?C.red:a[2]==='i'?C.wht:C.amb,L(t2('aural: mode ','lyd: mode '))+a[0].replace('TA',L(t2('look-ahead','fremoverkikk')))]:['',C.mut,''];
  const pu=a&&/PULL UP/.test(a[1]), terr=a&&a[0]==='TA'&&!pu;
  return {ias:GW.spd,alt:q.alt,vs:q.vs,hdg:90,pitch:2+q.vs/350,bank:GW.sc==='bank'?GW.bank:0,selSpd:null,selAlt:null,selHdg:null,vRed:sc.spd-40,vAmb:sc.spd-25,vMax:sc.spd+80,strip,idle:L(t2('EGPWS: no alert','EGPWS: ingen varsel')),
    gs:q.dots!=null?q.dots:null,ra:q.ra,warn:pu?['PULL UP',C.red]:terr?['TERRAIN',C.amb]:a&&a[1].startsWith('GLIDESLOPE')?['G/S',C.amb]:null}; }
const BCOL={red:'#C8261B',yel2:'#C9A62A',yel1:'rgba(201,166,42,.45)',grn2:'#2F8F3C',grn1:'rgba(47,143,60,.45)'};
function drawTAD(g,b,q){ const [x0,y0,w,h]=b, ph=ST.w<640; panel(g,b,L(t2('TERRAIN DISPLAY','TERRENGSKJERM')),L(t2('colours relative to your altitude','farger i forhold til din høyde')));
  const cx=x0+w/2, cy=y0+h-14, R=Math.min(h-44,w*0.5-14), rng=GW.sc==='ridge'?12:6, sc=R/rng, gear=GW.cfg!=='clean', cell=Math.max(5,Math.round(R/26));
  g.save(); g.beginPath(); g.moveTo(cx,cy); g.arc(cx,cy,R,Math.PI*1.12,Math.PI*1.88); g.closePath(); g.clip();
  const sol=q.la!=null&&GW.la?(q.la<=A.LA_WARN?'red':'yel'):null, dLA=GW.spd*A.LA_CAUT/3600;
  for(let py=cy-R;py<cy;py+=cell) for(let px=cx-R;px<cx+R;px+=cell){ const ax=(cy-py-cell/2)/sc, ay=(px+cell/2-cx)/sc, X=q.x+ax, el2=ter2(GW.sc,X,ay), dh=el2-q.alt, band=A.tadBand(dh,gear);
    let col=BCOL[band]; if(sol&&Math.abs(ay)<1.2&&ax>0&&ax<dLA&&dh>-A.LA_FLOOR) col=sol==='red'?'#E8321F':'#F0C21F';
    if(col){ g.fillStyle=col; g.fillRect(px,py,cell-0.5,cell-0.5); } }
  g.restore();
  g.strokeStyle='rgba(255,255,255,.3)'; g.lineWidth=1; g.beginPath(); g.arc(cx,cy,R,Math.PI*1.12,Math.PI*1.88); g.stroke(); g.setLineDash([2,4]); g.beginPath(); g.arc(cx,cy,R/2,Math.PI*1.1,Math.PI*1.9); g.stroke(); g.setLineDash([]);
  txt(g,String(rng/2),cx-R/2*Math.sin(0.6)-4,cy-R/2*Math.cos(0.6),C.dim,'right',9); planeTop(g,cx,cy-6,0,ph?14:18,C.own);
  if(GW.sc!=='ridge') txt(g,L(t2('flat ground: nothing near your altitude','flatt terreng: ingenting nær din høyde')),cx,y0+40,C.mut,'center',10,500,SANS); }
function drawGSide(g,b,q){ const [x0,y0,w,h]=b, ph=ST.w<640, s=GSC[GW.sc], fr=GF.f, xe=Math.max(fr[fr.length-1].x,GW.sc==='ridge'?12:0.5)*1.04;
  panel(g,b,L(t2('SIDE VIEW','SIDEBILDE')),L(s.t));
  const top=Math.max(1200,...fr.map(p=>p.alt),GW.sc==='ridge'?4000:0)*1.12, pl=x0+(ph?40:48), pr=x0+w-12, pt=y0+28, pb=y0+h-(ph?18:22), X=x=>pl+x/xe*(pr-pl), Y=a=>pb-a/top*(pb-pt);
  const stp=top>3000?1000:top>1500?500:250; for(let a=0;a<=top;a+=stp){ line(g,pl,Y(a),pr,Y(a),C.grid,1); txt(g,a>=1000?nf(a/1000,a%1000?1:0)+'k':String(a),pl-5,Y(a)+4,C.dim,'right',9.5); }
  g.fillStyle=C.ter; g.beginPath(); g.moveTo(pl,pb); for(let i=0;i<=160;i++){ const xx=xe*i/160; g.lineTo(X(xx),Y(Math.max(0,s.ter(xx)))); } g.lineTo(pr,pb); g.closePath(); g.fill();
  poly(g,Array.from({length:161},(_,i)=>[X(xe*i/160),Y(Math.max(0,s.ter(xe*i/160)))]),C.terL,1.2);
  if(GF.rwyX!=null){ g.fillStyle='#C9D2DA'; g.fillRect(X(GF.rwyX),Y(0)-3,X(Math.min(xe,GF.rwyX+1))-X(GF.rwyX),3); poly(g,[[X(0),Y(A.gsIdeal(-GF.rwyX+0.16))],[X(GF.rwyX),Y(50)]],'rgba(231,127,214,.75)',1.2,[6,4]); }
  /* look-ahead envelope from the aircraft */
  if(GW.la&&GW.sc==='ridge'&&!q.impact){ const x1=q.x+GW.spd*A.LA_CAUT/3600, a1=q.alt+q.vs, x2=q.x+GW.spd*A.LA_WARN/3600, a2=q.alt+q.vs/2;
    g.fillStyle='rgba(240,180,64,.14)'; g.beginPath(); g.moveTo(X(q.x),Y(q.alt)); g.lineTo(X(x1),Y(a1)); g.lineTo(X(x1),Y(a1-A.LA_FLOOR)); g.lineTo(X(q.x),Y(q.alt-A.LA_FLOOR)); g.closePath(); g.fill();
    g.fillStyle='rgba(240,80,63,.18)'; g.beginPath(); g.moveTo(X(q.x),Y(q.alt)); g.lineTo(X(x2),Y(a2)); g.lineTo(X(x2),Y(a2-A.LA_FLOOR)); g.lineTo(X(q.x),Y(q.alt-A.LA_FLOOR)); g.closePath(); g.fill();
    if(!ph) { txt(g,L(t2('60 s','60 s')),X(x1),Y(a1)-5,C.amb,'center',9.5); txt(g,'30 s',X(x2),Y(a2)-5,C.red,'center',9.5); } }
  /* the path: flown solid, the rest dashed; without a pull-up for comparison */
  const fl=fr.filter(p=>p.t<=q.t+1e-6), rest=fr.filter(p=>p.t>=q.t-1e-6);
  poly(g,rest.map(p=>[X(p.x),Y(p.alt)]),'rgba(201,182,242,.45)',1.3,[5,4]); poly(g,fl.map(p=>[X(p.x),Y(p.alt)]),C.path,2.2);
  /* where each alert started */
  let lastX=-99; const seen={}; for(const p of fl){ for(const a of p.al){ const k=a[0]+a[1]; if(seen[k]||a[2]==='i') continue; seen[k]=1; const col=a[2]==='w'?C.red:C.amb; dot(g,X(p.x),Y(p.alt),3,col); const xx=X(p.x);
    tag(g,(a[0]==='TA'?'':L(t2('mode ','mode '))+a[0]+': ')+a[1],xx,Y(p.alt)-(Math.abs(xx-lastX)<90?30:14),col,{sz:9.5,al:'center',box:b}); lastX=xx; } }
  const end=fr[fr.length-1]; if(end.impact&&q.t>=end.t-0.3){ tag(g,L(t2('impact','treff')),X(end.x),Y(end.alt)-14,C.red,{sz:10.5,al:'center',box:b}); }
  /* radio altitude */
  line(g,X(q.x),Y(q.alt),X(q.x),Y(Math.max(0,s.ter(q.x))),'rgba(255,255,255,.5)',1,[2,3]); if(q.ra<2500&&!ph) txt(g,'RA '+nf(Math.round(q.ra/10)*10,0),X(q.x)+6,(Y(q.alt)+Y(Math.max(0,s.ter(q.x))))/2,C.txt,'left',9.5);
  planeSide(g,X(q.x),Y(q.alt),ph?14:18,C.own,clamp(q.vs/250,-10,14)); }

/* ================= the figure ================= */
function layout(){ const W=ST.w, H=ST.h, ph=W<640;
  if(ph){ const a=H*0.44; return {pfd:[6,6,W-12,a],top:[6,a+12,W-12,H*0.27],bot:[6,a+18+H*0.27,W-12,H-a-24-H*0.27]}; }
  const pw=Math.min(W*0.42,H*1.02); return {pfd:[10,10,pw,H-20],top:[pw+20,10,W-pw-30,(H-30)*0.47],bot:[pw+20,10+(H-30)*0.47+10,W-pw-30,(H-30)*0.53]}; }
function draw(){ if(!ST.w) return; const g=ST.ctx, W=ST.w, H=ST.h; g.setTransform(ST.dpr,0,0,ST.dpr,0,0); g.clearRect(0,0,W,H);
  FS=depth()==='instructor'?1.12:W<420?0.9:1; const Lo=layout();
  if(V.mode==='ap'||V.mode==='at'){ drawPFD(g,Lo.pfd,apPFD()); if(V.mode==='ap'){ drawPlan(g,Lo.top); drawSide(g,Lo.bot); } else { drawQuad(g,Lo.top); drawTime(g,Lo.bot); } }
  else if(V.mode==='tcas'){ const f=fAt(tT); drawPFD(g,Lo.pfd,tcPFD(f)); drawTraffic(g,Lo.top,f); drawTcSide(g,Lo.bot,f); }
  else { const q=gAt(gT); drawPFD(g,Lo.pfd,gPFD(q)); drawTAD(g,Lo.top,q); drawGSide(g,Lo.bot,q); } }

/* ---------------- readout chip, legend, "what you're seeing" ---------------- */
const ch=(i,b,cls)=>`<span><i>${i}</i><b${cls?` class="${cls}"`:''}>${b}</b></span>`;
function readout(){ let h='';
  if(V.mode==='ap'||V.mode==='at'){ const jet=S.ac==='jet', P=A.AC[S.ac];
    h=ch('IAS',Math.round(S.ias)+' kt',S.overspd||S.ias<(jet?P.vls:P.vsw)?'r':'')+ch(L(t2('Altitude','Høyde')),ft(S.alt))+ch('V/S',sg(Math.round(S.vs/50)*50)+' fpm');
    if(V.mode==='ap') h+=ch(L(t2('Heading','Kurs')),String(Math.round(S.hdg)%360).padStart(3,'0')+'°');
    if(jet) h+=ch(L(t2('Thrust','Skyvekraft')),nf(Math.round(S.thr/(1.2*A.tCl(S.alt))*100),0)+' %',S.lim?'a':''); else h+=ch(L(t2('Power','Effekt')),Math.round(S.pwr*100)+' %');
    h+=ch(L(t2('Time','Tid')),Math.floor(S.t/60)+':'+String(Math.floor(S.t%60)).padStart(2,'0')); }
  else if(V.mode==='tcas'){ const f=fAt(tT), S0=A.sens(f.zo); h=ch('SL',String(S0.sl))+ch(L(t2('Range','Avstand')),nf(f.r,1)+' NM')+ch('τ',f.t<E.tCPA?nf(A.tau(f.r,TC.clo),0)+' s':'—')+ch(L(t2('Relative altitude','Relativ høyde')),sg(Math.round(f.dz/10)*10)+' ft')
    +ch(L(t2('Status','Status')),f.st==='ra'?A.raText(f.ra).split(',')[0]+' RA':f.st==='ta'?'TA':f.st==='coc'?L(t2('clear','klar')):f.st==='prox'?L(t2('proximate','nær')):L(t2('other traffic','annen trafikk')),f.st==='ra'?'r':f.st==='ta'?'a':'');
    if(deepOn()) h+=ch(L(t2('TA/RA τ','TA/RA τ')),S0.tauTA+' / '+(S0.tauRA??'—')+' s')+ch('ALIM',S0.alim?S0.alim+' ft':'—'); }
  else { const q=gAt(gT), a=gHeard(gT); h=ch(L(t2('Radio altitude','Radiohøyde')),ft(Math.max(0,q.ra)))+ch(L(t2('Descent rate','Synkrate')),nf(Math.max(0,Math.round(-q.vs/50)*50),0)+' fpm')+ch(L(t2('Terrain closure','Terrengnærming')),nf(Math.round(q.clos/50)*50,0)+' fpm')
    +(q.dots!=null?ch('G/S',(q.dots<0?nf(-q.dots,1)+' '+L(t2('dots low','prikker lavt')):nf(q.dots,1)+' '+L(t2('dots high','prikker høyt'))),q.dots<-1.3?'a':''):'')+ch(L(t2('Alert','Varsel')),a?a[1]:'—',a?(a[2]==='w'?'r':a[2]==='c'?'a':''):''); }
  el('chip').innerHTML=h; }
function legend(){ const lg=(c,t,k)=>`<span><i class="${k||''}" style="--c:${c}"></i>${L(t)}</span>`; let s='';
  if(V.mode==='ap'||V.mode==='at') s=lg(C.grn,t2('active mode','aktiv modus'),'sq')+lg(S&&S.ac==='ga'?'#E8EEF2':C.cyn,t2('armed mode','armert modus'),'sq')+(V.mode==='ap'?lg(C.mag,t2('localiser and glide slope','localiser og glidebane'),'ln')+lg(C.cyn,t2('selected altitude and heading','valgt høyde og kurs'),'ln'):lg(C.mag,t2('selected speed','valgt fart'),'ln'))+lg(C.path,t2('flown path','flydd bane'),'ln');
  else if(V.mode==='tcas') s=lg(C.cyn,t2('other / proximate traffic','annen / nær trafikk'),'d')+lg(C.amb,t2('traffic advisory (TA)','trafikkråd (TA)'))+lg(C.red,t2('resolution advisory (RA)','unnvikelsesråd (RA)'),'sq')+lg('rgba(63,224,138,.9)',t2('fly-to zone','fly-til-sone'),'sq')+lg('rgba(240,80,63,.85)',t2('avoid zone','unngå-sone'),'sq');
  else s=lg(BCOL.red,t2('terrain > 2 000 ft above you','terreng > 2 000 ft over deg'),'sq')+lg(BCOL.yel2,t2('1 000–2 000 ft above','1 000–2 000 ft over'),'sq')+lg('#C9A62A99',t2('just below to 1 000 ft above','like under til 1 000 ft over'),'sq')+lg(BCOL.grn2,t2('500–1 000 ft below','500–1 000 ft under'),'sq')+lg(C.amb,t2('caution','advarsel'),'ln')+lg(C.red,t2('warning','varsel'),'ln');
  el('vleg').innerHTML=s; }
function see(){ let t;
  if(V.mode==='ap'){ const F=A.fma(S), jet=S.ac==='jet';
    if(S.stall) t=t2('<b>Stall.</b> The light autopilot flew the vertical speed you asked for and let the speed go: it has no autothrottle and it does not watch the speed. The autopilot disconnected. You fly the power, always.','<b>Steiling.</b> Den lette autopiloten fløy vertikalfarten du ba om og lot farten gå: den har ingen autothrottle og passer ikke på farten. Autopiloten koblet ut. Du styrer effekten, alltid.');
    else if(S.landed) t=t2('<b>Minimums.</b> The approach was flown on the localiser and glide slope. The lab stops here: land by hand, or follow the autoland rules of your type.','<b>Minima.</b> Innflygingen ble flydd på localiser og glidebane. Labben stopper her: land manuelt, eller følg autoland-reglene for typen.');
    else if(S.ground) t=t2('<b>Ground contact.</b> Nothing was armed to stop the descent. A capture only arms when the selected altitude is in front of you.','<b>Bakkekontakt.</b> Ingenting var armert for å stoppe nedstigningen. En innfanging armeres bare når den valgte høyden ligger foran deg.');
    else if(S.msg==='altstar') t=t2(`<b>Reversion.</b> You changed the selected altitude during the capture: the capture is dropped and the autopilot reverts to ${jet?'V/S':'VS'} at the current rate. The new altitude is ${S.selAlt<S.alt?'below you, behind the climb':'ahead'}, so ${S.selAlt<S.alt?'<b>nothing is armed</b> and the climb goes on':'it is armed again'}. Read the FMA after every change.`,`<b>Reversjon.</b> Du endret valgt høyde under innfangingen: innfangingen forsvinner, og autopiloten går tilbake til ${jet?'V/S':'VS'} med den raten den har. Den nye høyden er ${S.selAlt<S.alt?'under deg, bak stigningen':'foran deg'}, så ${S.selAlt<S.alt?'<b>ingenting er armert</b> og stigningen fortsetter':'den armeres igjen'}. Les FMA-en etter hver endring.`);
    else if(S.msg==='lvlrev') t=t2('<b>Reversion.</b> The selected altitude is now behind the level change, so the autopilot dropped it and holds the current vertical speed.','<b>Reversjon.</b> Den valgte høyden ligger nå bak nivåendringen, så autopiloten slapp den og holder vertikalfarten den har.');
    else if(S.prot) t=t2('<b>Speed protection.</b> In V/S the elevator flies the vertical speed and the autothrust holds the speed only up to climb thrust. The rest came out of the speed until the protection reduced the V/S. Many jets do this; some only warn.','<b>Fartsbeskyttelse.</b> I V/S flyr høyderoret vertikalfarten, og autothrust holder farten bare opp til stigeskyvekraft. Resten ble tatt fra farten til beskyttelsen reduserte V/S. Mange jetfly gjør dette; noen varsler bare.');
    else if(!jet&&S.vm==='VS'&&S.vs>0&&S.ias<75) t=t2('<b>The speed is going.</b> The two-axis autopilot holds the vertical speed with the elevator. With full power and too much climb, the only thing left to give is the speed.','<b>Farten forsvinner.</b> Tokanals-autopiloten holder vertikalfarten med høyderoret. Med full effekt og for mye stigning er farten det eneste som kan gi seg.');
    else if(!jet&&S.vm==='GS'&&S.ias>118) t=t2('<b>Glide slope captured, and the speed is rising.</b> A light autopilot does not touch the throttle: reduce the power (about 20 %) as the descent starts.','<b>Glidebanen fanget, og farten øker.</b> En lett autopilot rører ikke gassen: reduser effekten (rundt 20 %) når nedstigningen starter.');
    else if(S.msa&&S.vm==='VS'&&S.vs<0&&!A.altArmed(S)) t=t2(`<b>Nothing armed.</b> You are descending, but the selected altitude (${nf(S.selAlt,0)} ft) is above you, so no capture can arm. The ${jet?'V/S':'VS'} goes on until someone notices.`,`<b>Ingenting armert.</b> Du synker, men valgt høyde (${nf(S.selAlt,0)} ft) er over deg, så ingen innfanging kan armeres. ${jet?'V/S':'VS'} fortsetter til noen merker det.`);
    else if(S.lm==='TRK'&&!S.apr&&S.vm==='ALT'&&S.x>-9.5) t=t2('<b>Localiser only.</b> The aircraft tracks the course but holds the altitude: the glide slope was never armed, so the aircraft is now above it and getting higher on the path.','<b>Bare localiser.</b> Flyet følger kursen, men holder høyden: glidebanen ble aldri armert, så flyet er nå over den og kommer stadig høyere over banen.');
    else if(S.vm==='CAP') t=t2('<b>Capture.</b> The vertical speed is being reduced to level at the selected altitude. ALT* is a transition, not a hold: leave the altitude alone until ALT.','<b>Innfanging.</b> Vertikalfarten reduseres for å flate ut i valgt høyde. ALT* er en overgang, ikke et hold: ikke rør høyden før ALT.');
    else if(S.lArm||S.gsArm) t=t2('<b>Armed, not yet active.</b> The armed mode waits in the second row (or white on the light autopilot) and becomes active by itself when the aircraft reaches the beam. Until then the active mode still flies.','<b>Armert, ikke aktiv ennå.</b> Den armerte modusen venter i andre rad (eller hvit på den lette autopiloten) og blir aktiv av seg selv når flyet når strålen. Til da flyr den aktive modusen.');
    else t=jet?t2('<b>Jet: pitch and thrust are a pair.</b> In ALT, V/S and G/S the elevator flies the path and the autothrust (SPEED) holds the speed. In LVL CHG the thrust is fixed and the elevator holds the speed. Read the first two FMA columns together.','<b>Jetfly: pitch og skyvekraft hører sammen.</b> I ALT, V/S og G/S flyr høyderoret banen og autothrust (SPEED) holder farten. I LVL CHG er skyvekraften fast og høyderoret holder farten. Les de to første FMA-kolonnene sammen.')
      :t2('<b>Light single: a two-axis autopilot.</b> It moves the ailerons (HDG, NAV) and the elevator (ALT, VS, GS). Nothing moves the throttle: the speed is whatever your power setting gives.','<b>Lett enmotors: en tokanals autopilot.</b> Den beveger balanserorene (HDG, NAV) og høyderoret (ALT, VS, GS). Ingenting rører gassen: farten blir det effekten din gir.'); }
  else if(V.mode==='at'){ const m=A.fma(S).thr;
    if(S.overspd) t=t2('<b>Overspeed.</b> The levers are above the climb detent, so the thrust is manual and nothing holds the speed. After a go-around, bring the levers back to CL when the FMA calls for it, so the autothrust takes over again.','<b>Overfart.</b> Hendlene står over stigehakket, så skyvekraften er manuell og ingenting holder farten. Etter en go-around, ta hendlene tilbake til CL når FMA-en ber om det, så tar autothrust over igjen.');
    else if(S.lim) t=t2('<b>The lever is a limit.</b> With fixed (non-moving) levers the lever position is the most thrust the autothrust may use. Out of the CL detent and below it, SPEED cannot hold the speed: it bleeds away.','<b>Hendelen er en grense.</b> Med faste (ikke-bevegelige) hendler er hendelposisjonen den største skyvekraften autothrust kan bruke. Ute av CL-hakket og under det kan ikke SPEED holde farten: den forsvinner.');
    else if(S.ias<A.AC.jet.vls+3) t=t2('<b>Speed low.</b> The autothrust is not giving enough thrust. Check the levers and the FMA thrust column.','<b>Lav fart.</b> Autothrust gir ikke nok skyvekraft. Sjekk hendlene og skyvekraftkolonnen i FMA-en.');
    else if(m==='THR CLB'||m==='THR IDLE') t=t2(`<b>${m}: the thrust is fixed.</b> The autothrust sets ${m==='THR CLB'?'climb thrust':'idle'} and the elevator holds the selected speed. The vertical speed is whatever is left over.`,`<b>${m}: skyvekraften er fast.</b> Autothrust setter ${m==='THR CLB'?'stigeskyvekraft':'tomgang'}, og høyderoret holder valgt fart. Vertikalfarten blir det som er til overs.`);
    else if(m==='SPEED') t=t2('<b>SPEED: the autothrust holds the speed</b> between idle and climb thrust, while the elevator holds the altitude or vertical speed.','<b>SPEED: autothrust holder farten</b> mellom tomgang og stigeskyvekraft, mens høyderoret holder høyden eller vertikalfarten.');
    else t=t2('<b>Manual thrust.</b> The autothrust is armed but not active: the speed is yours.','<b>Manuell skyvekraft.</b> Autothrust er armert, men ikke aktiv: farten er din.'); }
  else if(V.mode==='tcas'){ const f=fAt(tT);
    if(f.st==='ra'&&TC.resp==='atc') t=t2('<b>Manoeuvring against the RA.</b> The intruder follows its coordinated RA, you go the other way: both aircraft now move towards each other and TCAS strengthens the RA. Always follow the RA, even against an ATC instruction, and report “TCAS RA”.','<b>Manøvrerer mot RA.</b> Det andre flyet følger sitt koordinerte RA, du går motsatt vei: begge flyene beveger seg mot hverandre, og TCAS forsterker RA-en. Følg alltid RA, også mot en ATC-instruks, og meld «TCAS RA».');
    else if(f.st==='ra') t=(TC.eq==='tcas'?t2('<b>Coordinated RA.</b> The two TCAS units agree over Mode S which way each goes, so the senses are always opposite. Fly the green, smoothly and promptly (about 5 s, 0.25 g), then report.','<b>Koordinert RA.</b> De to TCAS-enhetene avtaler via Mode S hvilken vei hver skal, så retningene er alltid motsatte. Fly det grønne, mykt og raskt (rundt 5 s, 0,25 g), og meld.'):t2('<b>RA against a transponder-only intruder.</b> It reports its altitude, so you get an RA, but it gets no advisory: only you manoeuvre.','<b>RA mot et fly med bare transponder.</b> Det rapporterer høyde, så du får RA, men det får ingen råd: bare du manøvrerer.'));
    else if(f.st==='ta') t=t2('<b>Traffic advisory.</b> Look for the traffic and get ready for an RA, but do not manoeuvre on a TA alone.','<b>Trafikkråd.</b> Se etter trafikken og gjør deg klar for en RA, men ikke manøvrer på en TA alene.');
    else if(f.st==='coc') t=t2('<b>Clear of conflict.</b> Return promptly to the clearance and tell ATC you are returning.','<b>Clear of conflict.</b> Gå raskt tilbake til klareringen og si til ATC at du går tilbake.');
    else if(TC.eq==='modea') t=t2('<b>No altitude from the intruder.</b> Without altitude reporting TCAS can only give a TA, and the symbol has no altitude tag.','<b>Ingen høyde fra det andre flyet.</b> Uten høyderapportering kan TCAS bare gi TA, og symbolet har ingen høydemerking.');
    else if(TC.alt<1000) t=t2('<b>Below 1 000 ft above the ground</b> TCAS gives TAs only: no RAs this close to the ground.','<b>Under 1 000 ft over bakken</b> gir TCAS bare TA: ingen RA så nær bakken.');
    else t=t2('<b>Tau, not distance.</b> TCAS works in seconds to the closest point of approach: range divided by closure rate. Press Play and watch the intruder go from other traffic to TA and then RA.','<b>Tau, ikke avstand.</b> TCAS regner i sekunder til nærmeste punkt: avstand delt på nærmingsfart. Trykk Spill av og se det andre flyet gå fra annen trafikk til TA og så RA.'); }
  else { const q=gAt(gT), a=gHeard(gT), end=GF.f[GF.f.length-1];
    if(pullT!=null) t=end.impact?t2('<b>Too late.</b> The pull-up started, but the terrain came first. With the look-ahead on, react at the first caution.','<b>For sent.</b> Oppstigningen startet, men terrenget kom først. Med fremoverkikket på, reager på første advarsel.'):t2('<b>Escape manoeuvre.</b> Autopilot off, wings level, full thrust, pitch up firmly to the stick shaker or pitch limit, speedbrakes in, and keep the configuration until the warning stops and the terrain is clear.','<b>Unnamanøver.</b> Autopilot av, vingene rett, full skyvekraft, løft nesen bestemt til stick shaker eller pitchgrensen, luftbremser inn, og behold konfigurasjonen til varselet stopper og terrenget er klart.');
    else if(GW.sc==='ridge') t=GW.la?t2('<b>Look-ahead.</b> The enhanced function compares the path ahead with a terrain database: CAUTION TERRAIN about 60 s out, TERRAIN AHEAD, PULL UP about 30 s out. Mode 2 only sees the ground under you rise, so it speaks much later. Untick the look-ahead to compare.','<b>Fremoverkikk.</b> Den forbedrede funksjonen sammenligner banen foran med en terrengdatabase: CAUTION TERRAIN rundt 60 s før, TERRAIN AHEAD, PULL UP rundt 30 s før. Mode 2 ser bare bakken under deg stige, så den sier fra mye senere. Ta bort fremoverkikket for å sammenligne.')
      :t2('<b>Mode 2 alone.</b> Radio altimeter only: it waits until the ground under you rises fast. Over a steep slope that can be too late to outclimb the ridge.','<b>Mode 2 alene.</b> Bare radiohøydemåler: den venter til bakken under deg stiger raskt. Over en bratt skråning kan det være for sent til å stige over ryggen.');
    else t=({sink:t2('<b>Mode 1, excessive descent rate.</b> Radio altitude against the descent rate: SINK RATE first, then PULL UP. Lower and faster is worse.','<b>Mode 1, for høy synkrate.</b> Radiohøyde mot synkrate: SINK RATE først, så PULL UP. Lavere og raskere er verre.'),
      to:t2("<b>Mode 3, altitude loss after take-off.</b> It remembers the highest height and warns DON'T SINK when you lose about 10 % of it close to the ground.","<b>Mode 3, høydetap etter avgang.</b> Den husker den høyeste høyden og varsler DON'T SINK når du mister rundt 10 % av den nær bakken."),
      low:t2('<b>Mode 4, unsafe terrain clearance.</b> Close to the ground without the gear down: TOO LOW, GEAR. Gear down but flaps not set for landing: TOO LOW, FLAPS. Faster gives TOO LOW, TERRAIN.','<b>Mode 4, utrygg terrengklaring.</b> Nær bakken uten understellet ute: TOO LOW, GEAR. Understell ute, men klaff ikke satt for landing: TOO LOW, FLAPS. Raskere gir TOO LOW, TERRAIN.'),
      app:t2('<b>Mode 5, below the glide slope.</b> Below 1 000 ft and more than about 1.3 dots low: GLIDESLOPE, louder below 300 ft. Fly steeper than the 3° path and watch it come.','<b>Mode 5, under glidebanen.</b> Under 1 000 ft og mer enn rundt 1,3 prikker lavt: GLIDESLOPE, høyere under 300 ft. Fly brattere enn 3°-banen og se det komme.'),
      bank:t2('<b>Mode 6, advisories.</b> Height callouts from the radio altimeter (FIVE HUNDRED, MINIMUMS, ONE HUNDRED, FIFTY…) and BANK ANGLE when the bank is too steep for the height.','<b>Mode 6, råd.</b> Høydeutrop fra radiohøydemåleren (FIVE HUNDRED, MINIMUMS, ONE HUNDRED, FIFTY…) og BANK ANGLE når krengningen er for bratt for høyden.')})[GW.sc]; void q; void a; }
  el('xsee').innerHTML=L(t); }

/* ---------------- controls ---------------- */
const VIEWS=[['ap',t2('Autopilot & FD','Autopilot og FD')],['at',t2('Autothrust','Autothrust')],['tcas',t2('TCAS','TCAS')],['gpws',t2('EGPWS','EGPWS')]];
function drawTabs(){ el('vtabs').innerHTML=VIEWS.map(([k,t])=>`<button type="button" role="tab" data-v="${k}" class="${k===V.mode?'on':''}" aria-selected="${k===V.mode}">${L(t)}</button>`).join(''); }
el('vtabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) setMode(b.dataset.v); });
function setMode(m,keep){ if(!VIEWS.some(v=>v[0]===m)) m='ap'; const prev=V.mode; V.mode=m;
  document.querySelectorAll('.xsec[data-pv]').forEach(d=>{ d.hidden=!d.dataset.pv.split(' ').includes(m); });
  if((m==='ap'||m==='at')&&(!keep||prev!==m)) loadAP(V.pre[m],m==='at'?'jet':(S&&prev==='ap'?S.ac:acSeg.v));
  if(m==='tcas'){ tcRun(); if(!keep){ tT=0; sl.tT.set(0); } } if(m==='gpws'){ gRun(); if(!keep){ gT=0; sl.tT.set(0); } }
  sl.tT.el.hidden=!(m==='tcas'||m==='gpws'); el('pullup').hidden=m!=='gpws'; el('mcpT').textContent=L(m==='at'?t2('Autopilot panel (jet)','Autopilotpanel (jet)'):t2('Autopilot panel','Autopilotpanel'));
  V.run=true; runBtn(); drawTabs(); drawPre(); drawMcp(); drawSpd(); upd(); }
LAB.add({},{'Selected altitude':'Valgt høyde','Selected heading':'Valgt kurs','Selected V/S':'Valgt V/S','Selected speed':'Valgt fart','Power':'Effekt','Your altitude':'Din høyde','Range at the start':'Avstand ved start','Closure rate':'Nærmingsfart','Intruder relative altitude':'Det andre flyets relative høyde','Intruder vertical speed':'Det andre flyets vertikalfart','Your vertical speed':'Din vertikalfart','Time':'Tid','Rate of descent':'Synkrate','Speed':'Fart','Bank angle':'Krengning'});
LAB.add({},Object.assign({'Light single':'Lett enmotors','Jet transport':'Jet transportfly','Follow the RA':'Følg RA','Opposite (ATC)':'Motsatt (ATC)','No response':'Ingen reaksjon','Gear up':'Understell inne','Gear down':'Understell ute','Landing':'Landing'},Object.fromEntries(Object.values(GSC).map(s=>[s.t.en,s.t.no]))));
const sl={};
const kn=el('knobs');
sl.alt=LAB.slider(kn,{label:'Selected altitude',min:1000,max:15000,step:100,v:3000,f:v=>nf(v,0)+' ft',on:v=>{ A.setSel(S,'alt',v); upd(); }});
sl.hdg=LAB.slider(kn,{label:'Selected heading',min:0,max:355,step:5,v:60,f:v=>String(v).padStart(3,'0')+'°',on:v=>{ A.setSel(S,'hdg',v); upd(); }});
sl.vs=LAB.slider(kn,{label:'Selected V/S',min:-3000,max:3000,step:100,v:-700,f:v=>sg(v)+' fpm',on:v=>{ A.setSel(S,'vs',v); upd(); }});
sl.spd=LAB.slider(kn,{label:'Selected speed',min:140,max:340,step:5,v:180,f:v=>v+' kt',on:v=>{ A.setSel(S,'spd',v); upd(); }});
sl.pwr=LAB.slider(kn,{label:'Power',min:0,max:100,step:1,v:51,f:v=>v+' %',on:v=>{ A.setSel(S,'pwr',v/100); upd(); }});
function syncKnobs(){ if(!S) return; const jet=S.ac==='jet'; sl.alt.set(S.selAlt); sl.hdg.set(S.selHdg); sl.vs.inp.min=jet?-3000:-1500; sl.vs.inp.max=jet?3000:1500; sl.vs.set(S.selVs); sl.spd.set(S.selSpd); sl.pwr.set(Math.round(S.pwr*100));
  sl.spd.el.hidden=!jet; sl.pwr.el.hidden=jet; sl.hdg.el.hidden=V.mode==='at'; if(levSeg) levSeg.set(S.lever); if(acSeg) acSeg.set(S.ac); drawMcp(); }
const acSeg=LAB.seg(el('acSeg'),[['ga','Light single'],['jet','Jet transport']],'jet',v=>{ loadAP(V.pre.ap,v); drawAc(); });
function drawAc(){ el('acH').textContent=L(S&&S.ac==='ga'?t2('Two-axis autopilot: roll and pitch. No autothrottle: you set the power.','Tokanals autopilot: rull og pitch. Ingen autothrottle: du setter effekten.'):t2('Flight director, autopilot and autothrust, with a four-column FMA.','Flight director, autopilot og autothrust, med en FMA med fire kolonner.')); }
const levSeg=LAB.seg(el('levSeg'),[['idle','IDLE'],['mid','↕'],['cl','CL'],['mct','MCT'],['toga','TOGA']],'cl',v=>{ A.setSel(S,'lever',v); upd(); });
function drawMcp(){ if(!S) return; const jet=S.ac==='jet', F=A.fma(S);
  const keys=jet?[['AP','AP',S.ap],['FD','FD',S.fd],['ATHR','A/THR',F.athr==='on'?1:F.athr==='arm'?2:0],['HDG','HDG',S.lm==='HDG'],['LOC','LOC',S.lm==='TRK'&&!S.apr?1:S.lArm&&!S.apr?2:0],['APR','APPR',S.apr?(S.vm==='GS'?1:2):0],['ALT','ALT',S.vm==='ALT'||S.vm==='CAP'?1:A.altArmed(S)?2:0],['VS','V/S',S.vm==='VS'],['LVL','LVL CHG',S.vm==='LVL']]
    :[['AP','AP',S.ap],['HDG','HDG',S.lm==='HDG'],['NAV','NAV',S.lm==='TRK'&&!S.apr?1:S.lArm&&!S.apr?2:0],['APR','APR',S.apr?(S.vm==='GS'?1:2):0],['ALT','ALT',S.vm==='ALT'||S.vm==='CAP'?1:A.altArmed(S)?2:0],['VS','VS',S.vm==='VS']];
  el('mcp').innerHTML=keys.map(([k,lab,on])=>`<button type="button" data-k="${k}" class="${on===2?'arm':on?'act':''}" aria-pressed="${!!on}">${lab}</button>`).join(''); }
el('mcp').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b||!S) return; A.press(S,b.dataset.k); if(b.dataset.k==='VS') sl.vs.set(S.selVs); if(S.stall&&S.ap){ S.stall=false; } if(!V.run&&!S.ground){ V.run=true; runBtn(); } upd(); });
/* TCAS controls */
const tc=el('tcCtl');
sl.tAlt=LAB.slider(tc,{label:'Your altitude',min:500,max:41000,step:500,v:TC.alt,f:v=>nf(v,0)+' ft',on:v=>{ TC.alt=v; tcRun(); upd(); }});
sl.tR0=LAB.slider(tc,{label:'Range at the start',min:3,max:12,step:0.5,v:TC.r0,f:v=>nf(v,1)+' NM',on:v=>{ TC.r0=v; tcRun(); upd(); }});
sl.tClo=LAB.slider(tc,{label:'Closure rate',min:120,max:900,step:10,v:TC.clo,f:v=>v+' kt',on:v=>{ TC.clo=v; tcRun(); upd(); }});
sl.tDz=LAB.slider(tc,{label:'Intruder relative altitude',min:-2500,max:2500,step:50,v:TC.dz0,f:v=>sg(v)+' ft',on:v=>{ TC.dz0=v; tcRun(); upd(); }});
sl.tVi=LAB.slider(tc,{label:'Intruder vertical speed',min:-3000,max:3000,step:100,v:TC.vi,f:v=>sg(v)+' fpm',on:v=>{ TC.vi=v; tcRun(); upd(); }});
sl.tVo=LAB.slider(tc,{label:'Your vertical speed',min:-3000,max:3000,step:100,v:TC.vo,f:v=>sg(v)+' fpm',on:v=>{ TC.vo=v; tcRun(); upd(); }});
const tcEq=LAB.seg(el('tcEq'),[['tcas','TCAS II'],['modec','Mode C/S'],['modea','Mode A']],TC.eq,v=>{ TC.eq=v; tcRun(); upd(); });
const tcResp=LAB.seg(el('tcResp'),[['ra','Follow the RA'],['atc','Opposite (ATC)'],['none','No response']],TC.resp,v=>{ TC.resp=v; tcRun(); upd(); });
function syncTc(){ sl.tAlt.set(TC.alt); sl.tR0.set(TC.r0); sl.tClo.set(TC.clo); sl.tDz.set(TC.dz0); sl.tVi.set(TC.vi); sl.tVo.set(TC.vo); tcEq.set(TC.eq); tcResp.set(TC.resp); }
/* EGPWS controls */
const gwSeg=LAB.seg(el('gwSeg'),Object.keys(GSC).map(k=>[k,GSC[k].t.en]),GW.sc,v=>loadG(v));
el('gwSeg').classList.add('wrap');
const gc=el('gwCtl');
sl.gRod=LAB.slider(gc,{label:'Rate of descent',min:0,max:7000,step:100,v:GW.rod,f:v=>nf(v,0)+' fpm',on:v=>{ GW.rod=v; pullT=null; gRun(); upd(); }});
sl.gSpd=LAB.slider(gc,{label:'Speed',min:120,max:320,step:5,v:GW.spd,f:v=>v+' kt',on:v=>{ GW.spd=v; pullT=null; gRun(); upd(); }});
sl.gBank=LAB.slider(gc,{label:'Bank angle',min:0,max:50,step:1,v:0,f:v=>v+'°',on:v=>{ GW.bank=v; gRun(); upd(); }});
const gwCfg=LAB.seg(el('gwCfg'),[['clean','Gear up'],['gear','Gear down'],['land','Landing']],GW.cfg,v=>{ GW.cfg=v; pullT=null; gRun(); upd(); });
el('laOn').addEventListener('change',e=>{ GW.la=e.target.checked; gRun(); upd(); });
function loadG(k,o){ const s=GSC[k]; GW.sc=k; GW.rod=s.rod; GW.spd=s.spd; GW.cfg=s.cfg; GW.bank=k==='bank'?0:0; if(o) Object.assign(GW,o); pullT=null; gT=0; V.pre.gpws=k;
  gwSeg.set(k); sl.gRod.set(GW.rod); sl.gSpd.set(GW.spd); sl.gBank.set(GW.bank); gwCfg.set(GW.cfg); el('laOn').checked=GW.la; sl.gBank.el.hidden=k!=='bank'; el('laOn').parentElement.hidden=k!=='ridge';
  sl.gRod.el.querySelector('span').textContent=L(k==='to'?t2('Sink after reaching 700 ft','Synk etter 700 ft'):t2('Rate of descent','Synkrate'));
  gRun(); if(V.mode==='gpws'){ V.run=true; runBtn(); } upd(); }
/* run controls */
sl.tT=LAB.slider(el('tCtl'),{label:'Time',min:0,max:100,step:0.25,v:0,f:v=>nf(v,0)+' s',on:v=>{ if(V.mode==='tcas') tT=v; else gT=v; V.run=false; runBtn(); upd(); }});
function drawSpd(){ const opts=V.mode==='ap'||V.mode==='at'?[[2,'×2'],[5,'×5'],[10,'×10']]:[[1,'×1'],[4,'×4'],[8,'×8']], cur=V.mode==='ap'||V.mode==='at'?V.tx:V.txw;
  const box=el('spdSeg'); box.className='seg'; box.innerHTML=opts.map(([k,t])=>`<button type="button" data-v="${k}" class="${k===cur?'on':''}">${L(t2('Time','Tid'))} ${t}</button>`).join(''); }
el('spdSeg').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(V.mode==='ap'||V.mode==='at') V.tx=+b.dataset.v; else V.txw=+b.dataset.v; drawSpd(); });
function runBtn(){ el('play').textContent=V.run?L(t2('Pause','Pause')):L(t2('Play','Spill av')); el('reset').textContent=L(t2('Restart','Start på nytt')); el('pullup').textContent=L(t2('Pull up now','Trekk opp nå')); if(V.run) kick(); }
el('play').onclick=()=>{ if(V.mode==='tcas'&&tT>=E.fr[E.fr.length-1].t-0.1) tT=0; if(V.mode==='gpws'&&gT>=GF.f[GF.f.length-1].t-0.1) gT=0; if((V.mode==='ap'||V.mode==='at')&&S&&(S.ground||S.stall)) loadAP(V.pre[V.mode]); V.run=!V.run; runBtn(); };
el('reset').onclick=()=>{ if(V.mode==='ap'||V.mode==='at') loadAP(V.pre[V.mode]); else if(V.mode==='tcas'){ tT=0; V.run=true; runBtn(); } else { pullT=null; gT=0; gRun(); V.run=true; runBtn(); } upd(); };
el('pullup').onclick=()=>{ if(V.mode!=='gpws') return; pullT=gT; gRun(); V.run=true; runBtn(); upd(); };
/* scenarios */
const TC_PRE={climb:[t2('Intruder below, climbing','Fly under deg, i stigning'),{alt:12000,r0:8,clo:420,dz0:-1000,vi:1000,vo:0,eq:'tcas',resp:'ra'}],
 level:[t2('Both level, 300 ft apart','Begge i planflukt, 300 ft fra hverandre'),{alt:12000,r0:8,clo:420,dz0:300,vi:0,vo:0,eq:'tcas',resp:'ra'}],
 prev:[t2('Preventive RA','Forebyggende RA'),{alt:12000,r0:8,clo:420,dz0:-500,vi:0,vo:0,eq:'tcas',resp:'ra'}],
 atc:[t2('Trap: ATC says the opposite','Felle: ATC sier det motsatte'),{alt:12000,r0:8,clo:420,dz0:-1000,vi:1000,vo:0,eq:'tcas',resp:'atc'},1],
 modec:[t2('Intruder without TCAS','Fly uten TCAS'),{alt:12000,r0:8,clo:420,dz0:-1000,vi:1000,vo:0,eq:'modec',resp:'ra'}],
 modea:[t2('Intruder without altitude','Fly uten høyderapportering'),{alt:12000,r0:8,clo:420,dz0:-300,vi:0,vo:0,eq:'modea',resp:'ra'}],
 low:[t2('Close to the ground','Nær bakken'),{alt:900,r0:4,clo:240,dz0:200,vi:0,vo:0,eq:'tcas',resp:'ra'}],
 fast:[t2('Twice the closure rate','Dobbel nærmingsfart'),{alt:12000,r0:12,clo:840,dz0:-1000,vi:1000,vo:0,eq:'tcas',resp:'ra'},0,1]};
function loadTC(k){ Object.assign(TC,TC_PRE[k][1]); V.pre.tcas=k; syncTc(); tT=0; tcRun(); V.run=true; runBtn(); upd(); }
function drawPre(){ let items=[];
  if(V.mode==='ap') items=Object.entries(AP_PRE).map(([k,p])=>[k,p.t,p.trap]);
  else if(V.mode==='at') items=Object.entries(AT_PRE).map(([k,p])=>[k,p.t,p.trap]);
  else if(V.mode==='tcas') items=Object.entries(TC_PRE).filter(([,p])=>!p[3]||deepOn()).map(([k,p])=>[k,p[0],p[2]]);
  else items=[];
  el('pre').innerHTML=items.map(([k,t,trap])=>`<button type="button" class="btn${trap?' trap':''}${V.pre[V.mode]===k?' pri':''}" data-s="${k}">${L(t)}</button>`).join('')||`<p class="hint">${L(t2('Pick a mode under “The flight”, then press Play.','Velg en modus under «Flygingen», og trykk Spill av.'))}</p>`; }
el('pre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const k=b.dataset.s; if(V.mode==='tcas') loadTC(k); else loadAP(k); drawPre(); });
/* one call from outside (concept cards, tasks) */
function setS(o){ if(!o) return; if(o.mode&&o.mode!==V.mode) setMode(o.mode,true);
  if(o.mode==='ap'||o.mode==='at'){ loadAP(o.pre,o.ac); if(o.run===false){ V.run=false; runBtn(); } if(o.secs){ apStepUI(o.secs); } }
  if(o.mode==='tcas'){ if(o.pre) loadTC(o.pre); if(o.tc){ Object.assign(TC,o.tc); syncTc(); tcRun(); } if(o.t!=null){ tT=o.t; sl.tT.set(tT); V.run=false; runBtn(); } }
  if(o.mode==='gpws'){ loadG(o.sc||'sink',o.gw); if(o.t!=null){ gT=o.t; sl.tT.set(gT); V.run=false; runBtn(); } }
  drawPre(); upd(); }

/* ---------------- animation ---------------- */
let raf=0, last=0, vis=true;
LAB.visible(el('afVp'),v=>{ vis=v; if(v) kick(); });
function kick(){ if(!raf){ last=performance.now(); raf=requestAnimationFrame(tick); } }
function tick(now){ raf=0; const dt=Math.min(0.1,(now-last)/1000); last=now; if(!V.run||!vis) return;
  if(V.mode==='ap'||V.mode==='at'){ apStepUI(dt*V.tx); }
  else if(V.mode==='tcas'){ const T=E.fr[E.fr.length-1].t; tT=Math.min(T,tT+dt*V.txw); sl.tT.set(tT); if(tT>=T){ V.run=false; runBtn(); } }
  else { const T=GF.f[GF.f.length-1].t; gT=Math.min(T,gT+dt*V.txw); sl.tT.set(gT); if(gT>=T){ V.run=false; runBtn(); } }
  if(reduce&&(V.mode==='tcas'||V.mode==='gpws')){ /* reduced motion: jump to the end */ }
  upd(true); if(V.run) raf=requestAnimationFrame(tick); }
let slow=0;
function upd(fromTick){ if((V.mode==="ap"||V.mode==="at")&&!S) return; if(!fromTick||++slow%6===0){ readout(); see(); drawMcp(); } if(!fromTick) legend(); draw(); if(!fromTick) kick(); }

/* ---------------- Try it: one task at a time ---------------- */
let ti=0; const ansv={}, done={};
const goModel=()=>{ const t=el('afVp'); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'}); };
const NUM=(lab,v,tol)=>({lab,v,tol});
const TASKS=[
 {k:'appr',q:t2('Jet, intercept heading 060 towards the localiser. Arm the approach so the autopilot captures both the localiser and the glide slope, then let it run until G/S is active. Press Check when it is.','Jetfly, avskjæringskurs 060 mot localiseren. Armer innflygingen så autopiloten fanger både localiser og glidebane, og la den fly til G/S er aktiv. Trykk Sjekk når den er det.'),
  live:()=>{ if(V.mode!=='ap'||S.ac!=='jet') return [0,t2('Open "Autopilot & FD", pick the jet and the "Intercept and approach" scenario.','Åpne «Autopilot og FD», velg jetfly og scenarioet «Avskjæring og innflyging».')];
    if(!S.apr) return [0,t2('LOC alone gives the localiser only. Which button arms both?','LOC alene gir bare localiseren. Hvilken knapp armerer begge?')];
    if(S.vm!=='GS') return [0,t2(S.lm==='TRK'?'LOC is green: now wait for G/S to go from blue to green.':'APPR is armed: LOC and G/S are blue in the second row. Let it run.',S.lm==='TRK'?'LOC er grønn: vent nå til G/S går fra blått til grønt.':'APPR er armert: LOC og G/S er blå i andre rad. La den fly.')];
    return [1,t2('Yes. Armed modes (blue) became active (green) one at a time: LOC first, then G/S from below.','Ja. Armerte moduser (blå) ble aktive (grønne) én etter én: LOC først, så G/S nedenfra.')]; },
  pre:{mode:'ap',pre:'appr',ac:'jet'}},
 {k:'gavs',q:t2('Light single, full power, VS mode. You select +1 200 fpm because ATC wants a good rate. What happens?','Lett enmotors, full effekt, VS-modus. Du velger +1 200 fpm fordi ATC vil ha god rate. Hva skjer?'),
  opts:[t2('The speed decays until the aircraft stalls','Farten synker til flyet steiler'),t2('The autopilot reduces the climb to protect the speed','Autopiloten reduserer stigningen for å beskytte farten'),t2('The engine gives more power','Motoren gir mer effekt'),t2('It reverts to ALT','Den går over til ALT')],c:0,pre:{mode:'ap',pre:'vs',ac:'ga'},
  e:t2('A two-axis autopilot holds the vertical speed with the elevator and has no autothrottle and, in most light aircraft, no speed protection. The speed is the only thing left to give. Ask for a rate the engine can give, and watch the airspeed.','En tokanals autopilot holder vertikalfarten med høyderoret og har ingen autothrottle, og i de fleste lette fly ingen fartsbeskyttelse. Farten er det eneste som kan gi seg. Be om en rate motoren klarer, og følg med på farten.')},
 {k:'behind',q:t2('You descend in V/S from 5 000 ft to 3 000 ft, but the selected altitude still shows 6 000 ft. What is armed in the FMA?','Du synker i V/S fra 5 000 ft til 3 000 ft, men valgt høyde viser fortsatt 6 000 ft. Hva er armert i FMA-en?'),
  opts:[t2('Nothing: the descent goes on through 3 000 ft','Ingenting: nedstigningen fortsetter gjennom 3 000 ft'),t2('ALT, it will level at 3 000 ft','ALT, den flater ut i 3 000 ft'),t2('ALT, it will climb back to 6 000 ft','ALT, den stiger tilbake til 6 000 ft'),t2('G/S','G/S')],c:0,pre:{mode:'ap',pre:'behind',ac:'jet'},
  e:t2('A capture only arms when the selected altitude is in front of the aircraft. The autopilot does not know what ATC said: set the cleared altitude first, then start the descent, and check that ALT is armed.','En innfanging armeres bare når valgt høyde ligger foran flyet. Autopiloten vet ikke hva ATC sa: sett klarert høyde først, start så nedstigningen, og sjekk at ALT er armert.')},
 {k:'altstar',q:t2('Climbing to 5 000 ft, ALT* is showing. ATC: “stop the climb at 4 500 ft.” You set 4 500. Run the scenario: what does the aircraft do?','I stigning til 5 000 ft vises ALT*. ATC: «stop climb at 4 500 ft.» Du setter 4 500. Kjør scenarioet: hva gjør flyet?'),
  opts:[t2('Reverts to V/S and climbs on through 5 000 ft','Går over til V/S og stiger videre gjennom 5 000 ft'),t2('Levels at 4 500 ft','Flater ut i 4 500 ft'),t2('Levels at 5 000 ft','Flater ut i 5 000 ft'),t2('Descends back to 4 500 ft at once','Synker straks tilbake til 4 500 ft')],c:0,pre:{mode:'ap',pre:'altstar',ac:'jet'},
  e:t2('Changing the selected altitude during a capture drops the capture, and the autopilot reverts to V/S at the current rate. 4 500 is now behind the climb, so nothing is armed. Fix: select the new altitude and engage a mode towards it (V/S down or level change), then check the FMA.','Endrer du valgt høyde under innfanging, forsvinner innfangingen, og autopiloten går over til V/S med raten den har. 4 500 ligger nå bak stigningen, så ingenting er armert. Løsning: velg ny høyde og koble inn en modus mot den (V/S ned eller nivåendring), og sjekk FMA-en.')},
 {k:'lever',q:t2('Level at 5 000 ft, SPEED and ALT, 250 kt. The thrust levers are pulled back out of the CL detent (fixed-lever autothrust). What happens?','Planflukt i 5 000 ft, SPEED og ALT, 250 kt. Skyvehendlene trekkes ut av CL-hakket (autothrust med faste hendler). Hva skjer?'),
  opts:[t2('The speed decays: the lever is now the thrust limit','Farten synker: hendelen er nå grensen for skyvekraft'),t2('Nothing: the autothrust ignores the levers','Ingenting: autothrust overser hendlene'),t2('The autothrust goes to TOGA','Autothrust går til TOGA'),t2('The aircraft descends to hold the speed','Flyet synker for å holde farten')],c:0,pre:{mode:'at',pre:'mid'},
  e:t2('With fixed levers the lever position limits what the autothrust may use. In SPEED the elevator holds the altitude, so the missing thrust comes out of the speed. Keep the levers in the CL detent in flight.','Med faste hendler begrenser hendelposisjonen hva autothrust kan bruke. I SPEED holder høyderoret høyden, så skyvekraften som mangler, tas fra farten. Hold hendlene i CL-hakket i flyging.')},
 {k:'toga',q:t2('Go-around: the aircraft is levelling at 3 000 ft with the levers still in TOGA and flaps out (limit 230 kt). Stop the overspeed and give the speed back to the autothrust, then press Check.','Go-around: flyet flater ut i 3 000 ft med hendlene fortsatt i TOGA og klaffene ute (grense 230 kt). Stopp overfarten og gi farten tilbake til autothrust, og trykk Sjekk.'),
  live:()=>{ if(V.mode!=='at') return [0,t2('Open "Autothrust" and the go-around scenario.','Åpne «Autothrust» og go-around-scenarioet.')]; if(A.LEV[S.lever]>1) return [0,t2('The levers are still above CL: the thrust is manual (MAN TOGA in the FMA).','Hendlene står fortsatt over CL: skyvekraften er manuell (MAN TOGA i FMA-en).')];
    if(!A.athrActive(S)) return [0,t2('Is the autothrust on?','Er autothrust på?')]; if(S.lever!=='cl') return [0,t2('Put the levers in the CL detent, not below it.','Sett hendlene i CL-hakket, ikke under.')];
    return [1,t2('Yes: levers to CL, the FMA shows SPEED, and the autothrust holds the selected speed again.','Ja: hendlene til CL, FMA-en viser SPEED, og autothrust holder valgt fart igjen.')]; },
  pre:{mode:'at',pre:'toga'}},
 {k:'tau',q:t2('An intruder is 4 NM away on a collision course and the closure rate is 480 kt. What is the range tau?','Et fly er 4 NM unna på kollisjonskurs, og nærmingsfarten er 480 kt. Hva er avstands-tau?'),ins:[NUM(t2('Tau (s)','Tau (s)'),30,1)],pre:{mode:'tcas',tc:{alt:12000,r0:8,clo:480,dz0:-1000,vi:1000,vo:0,eq:'tcas',resp:'ra'},t:30},
  e:t2('Tau = range ÷ closure rate = 4 ÷ 480 h = 0.00833 h = 30 s. At FL120 (SL 6) the RA threshold is 30 s, so this is about when the RA comes (a little earlier with DMOD).','Tau = avstand ÷ nærmingsfart = 4 ÷ 480 t = 0,00833 t = 30 s. I FL120 (SL 6) er RA-grensen 30 s, så det er omtrent nå RA-en kommer (litt tidligere med DMOD).')},
 {k:'ra',q:t2('CLIMB, CLIMB while ATC has just told you to descend. You…','CLIMB, CLIMB mens ATC nettopp har bedt deg synke. Du…'),
  opts:[t2('Follow the RA and report “TCAS RA” to ATC','Følger RA og melder «TCAS RA» til ATC'),t2('Follow ATC: they see the whole picture','Følger ATC: de ser hele bildet'),t2('Level off as a compromise','Flater ut som et kompromiss'),t2('Wait for a second RA','Venter på en ny RA')],c:0,pre:{mode:'tcas',pre:'atc'},
  e:t2('The RA is coordinated with the other aircraft and ATC does not know about it. Manoeuvring against it can put both aircraft on the same side (Überlingen, 2002). Follow the RA promptly, report, and return to the clearance after CLEAR OF CONFLICT.','RA-en er koordinert med det andre flyet, og ATC vet ikke om den. Manøvrerer du mot den, kan begge fly havne på samme side (Überlingen, 2002). Følg RA raskt, meld, og gå tilbake til klareringen etter CLEAR OF CONFLICT.')},
 {k:'ridge',q:t2('Rising terrain ahead, level at 2 600 ft. With the look-ahead on, press “Pull up now” as soon as TERRAIN AHEAD, PULL UP sounds, and clear the ridge. Then press Check.','Stigende terreng foran, planflukt i 2 600 ft. Med fremoverkikket på, trykk «Trekk opp nå» så snart TERRAIN AHEAD, PULL UP høres, og kom over ryggen. Trykk så Sjekk.'),
  live:()=>{ if(V.mode!=='gpws'||GW.sc!=='ridge') return [0,t2('Open "EGPWS" and pick "Mode 2 · rising terrain".','Åpne «EGPWS» og velg «Mode 2 · stigende terreng».')]; if(!GW.la) return [0,t2('Turn the look-ahead on.','Slå på fremoverkikket.')];
    if(pullT==null) return [0,t2('Play, and press “Pull up now” at the warning.','Spill av, og trykk «Trekk opp nå» ved varselet.')]; const end=GF.f[GF.f.length-1]; if(end.impact) return [0,t2('Too late: start the escape at the first PULL UP.','For sent: start unnamanøveren ved første PULL UP.')];
    const q=GF.f.find(p=>p.t>=pullT); const lv=q&&q.al.find(a=>a[0]==='TA'); if(!lv) return [0,t2('Wait for the look-ahead alert before you pull up; here you reacted before any warning.','Vent på varselet fra fremoverkikket før du trekker opp; her reagerte du før noe varsel.')];
    const minC=Math.min(...GF.f.filter(p=>p.t>pullT).map(p=>p.ra)); return [1,t2(`Cleared. Lowest height over the terrain after the pull-up: about ${nf(Math.round(minC/10)*10,0)} ft. Mode 2 alone would have spoken far later.`,`Klarert. Laveste høyde over terrenget etter oppstigningen: rundt ${nf(Math.round(minC/10)*10,0)} ft. Mode 2 alene ville sagt fra mye senere.`)]; },
  pre:{mode:'gpws',sc:'ridge'}}];
const tasks=()=>TASKS.filter(t=>!t.dp||deepOn());
function drawTask(){ const TS=tasks(); ti=clamp(ti,0,TS.length-1); const t=TS[ti], n=TS.length, a=ansv[t.k];
  let h=`<div class="th"><span class="n">${L(t2('Task','Oppgave'))} ${ti+1} ${L(t2('of','av'))} ${n}</span><span class="dots">${TS.map((x,i)=>`<button type="button" data-i="${i}" class="${i===ti?'on':''}" aria-label="${L(t2('Task','Oppgave'))} ${i+1}"></button>`).join('')}</span></div><p class="q">${L(t.q)}</p>`;
  if(t.ins){ h+=`<div class="ins">${t.ins.map((x,j)=>{ const v=a&&a[j]; const ok=v!=null&&v!==''&&Math.abs(parseFloat(String(v).replace(',','.').replace(/\s/g,''))-x.v)<=x.tol; return `<label>${L(x.lab)}<input type="text" inputmode="decimal" data-j="${j}" value="${v??''}" class="${done[t.k]?(ok?'right':'wrong'):''}" autocomplete="off"></label>`; }).join('')}<button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div>`;
    h+=`<span class="fb${done[t.k]===1?' ok':''}">${done[t.k]?'<b>'+L(done[t.k]===1?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
  else if(t.opts){ h+=`<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${a!=null?'<b>'+L(a===t.c?t2('Right.','Riktig.'):t2('Not quite.','Ikke helt.'))+'</b> '+L(t.e):''}</span>`; }
  else { h+=`<div class="ins"><button type="button" class="btn pri sm" data-chk="1">${L(t2('Check','Sjekk'))}</button></div><span class="fb${done[t.k]&&done[t.k][0]?' ok':''}">${done[t.k]?(done[t.k][0]?'<b>✓</b> ':'')+L(done[t.k][1]):''}</span>`; }
  h+=`<div class="nav"><button type="button" class="btn sm" data-go="1">${L(t.live?t2('Set it up in the model','Sett det opp i modellen'):t2('See it in the model','Se det i modellen'))} ↑</button><span class="sp"></span><button type="button" class="btn sm" data-p="1" ${ti===0?'disabled':''}>← ${L(t2('Previous','Forrige'))}</button><button type="button" class="btn sm" data-n="1" ${ti===n-1?'disabled':''}>${L(t2('Next','Neste'))} →</button></div>`;
  el('tstep').innerHTML=h; }
el('tstep').addEventListener('input',e=>{ const i=e.target.closest('input'); if(!i) return; const t=tasks()[ti]; (ansv[t.k]=ansv[t.k]||[])[+i.dataset.j]=i.value; });
el('tstep').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.closest('input')){ const b=el('tstep').querySelector('[data-chk]'); if(b) b.click(); } });
el('tstep').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const TS=tasks(), t=TS[ti];
  if(b.dataset.i!=null){ ti=+b.dataset.i; drawTask(); return; } if(b.dataset.p){ ti--; drawTask(); return; } if(b.dataset.n){ ti++; drawTask(); return; }
  if(b.dataset.go){ setS(t.pre); document.querySelectorAll('details.xpanel').forEach(d=>{ d.open=true; }); goModel(); return; }
  if(b.dataset.o!=null){ ansv[t.k]=+b.dataset.o; drawTask(); return; }
  if(b.dataset.chk){ if(t.live){ done[t.k]=t.live(); drawTask(); return; }
    const a=ansv[t.k]||[]; done[t.k]=t.ins.every((x,j)=>a[j]!=null&&a[j]!==''&&Math.abs(parseFloat(String(a[j]).replace(',','.').replace(/\s/g,''))-x.v)<=x.tol)?1:2; drawTask(); } });

/* ---------------- Understand: key concept cards ---------------- */
const {sv,tx,ar}=KCS;
const go=o=>({click:()=>setS(o),to:'#afVp'});
const fmaIll=(cells)=>sv(`<rect x="8" y="14" width="184" height="36" rx="3" fill="#0b0f13" stroke="#3a444c"/>${cells.map(([x,s,c,y])=>tx(x,y||30,s,c,'middle',8.5)).join('')}<line x1="54" y1="18" x2="54" y2="46" stroke="#3a444c"/><line x1="104" y1="18" x2="104" y2="46" stroke="#3a444c"/><line x1="146" y1="18" x2="146" y2="46" stroke="#3a444c"/>`);
const KC=[
 Object.assign({k:'fma',t:t2('Armed and active','Armert og aktiv'),d:t2('The annunciator shows what the automation does now (<b>active</b>, green) and what it will do by itself later (<b>armed</b>, blue or white). It is the only true answer to “what is it doing?”.','Annunciatoren viser hva automatikken gjør nå (<b>aktiv</b>, grønn) og hva den vil gjøre av seg selv senere (<b>armert</b>, blå eller hvit). Den er det eneste sanne svaret på «hva gjør den?».'),
  dd:t2('A white box around a mode means it has just changed. Read every change aloud; the other pilot checks it.','En hvit ramme rundt en modus betyr at den nettopp har endret seg. Les hver endring høyt; den andre piloten sjekker den.'),
  ill:()=>fmaIll([[31,'SPEED','#3fe08a'],[79,'ALT*','#3fe08a',26],[79,'G/S','#7fdceb',42],[125,'LOC','#3fe08a',26],[169,'AP FD','#eef3f7']])},go({mode:'ap',pre:'appr',ac:'jet'})),
 Object.assign({k:'ga',t:t2('A two-axis light autopilot','En tokanals lett autopilot'),d:t2('Roll (HDG, NAV) and pitch (ALT, VS, GS), and nothing else. <b>No autothrottle</b>: the power, and so the speed, stays yours.','Rull (HDG, NAV) og pitch (ALT, VS, GS), og ikke noe mer. <b>Ingen autothrottle</b>: effekten, og dermed farten, er fortsatt din.'),
  dd:t2('A one-axis autopilot (wing leveller) only holds the wings level or a heading. Most light autopilots have no speed protection: a VS the engine cannot give ends in a stall.','En enkanals autopilot (vingeretter) holder bare vingene rett eller en kurs. De fleste lette autopiloter har ingen fartsbeskyttelse: en VS motoren ikke klarer, ender i steiling.'),
  ill:()=>sv(`<rect x="8" y="16" width="184" height="30" rx="3" fill="#0b0f13" stroke="#3a444c"/>${tx(26,35,'AP','#3fe08a','middle',9)}${tx(70,35,'HDG','#3fe08a','middle',9)}${tx(104,35,'NAV','#eef3f7','middle',9)}${tx(140,35,'VS','#3fe08a','middle',9)}${tx(172,35,'ALTS','#eef3f7','middle',9)}${tx(100,60,'power: your hand','#f0b440','middle',8)}`)},go({mode:'ap',pre:'climb',ac:'ga'})),
 Object.assign({k:'pair',t:t2('Pitch and thrust are a pair','Pitch og skyvekraft hører sammen'),d:t2('In a jet either the <b>autothrust holds the speed</b> and the elevator flies a path (SPEED with ALT, V/S, G/S), or the <b>thrust is fixed</b> and the elevator holds the speed (THR CLB or THR IDLE with a level change).','I et jetfly holder enten <b>autothrust farten</b> og høyderoret flyr en bane (SPEED med ALT, V/S, G/S), eller så er <b>skyvekraften fast</b> og høyderoret holder farten (THR CLB eller THR IDLE med nivåendring).'),
  dd:t2('Names differ between types (level change, open climb, FLCH), the principle does not.','Navnene varierer mellom typer (level change, open climb, FLCH), prinsippet gjør ikke det.'),
  ill:()=>fmaIll([[31,'THR CLB','#3fe08a'],[79,'LVL CHG','#3fe08a'],[125,'HDG','#3fe08a'],[169,'AP FD','#eef3f7']])},go({mode:'ap',pre:'climb',ac:'jet'})),
 Object.assign({k:'cap',t:t2('Captures arm only ahead','Innfanging armeres bare foran'),d:t2('ALT arms only when the selected altitude is in front of the climb or descent; LOC and G/S capture when the aircraft reaches the beam. An altitude behind you arms <b>nothing</b>.','ALT armeres bare når valgt høyde ligger foran stigningen eller nedstigningen; LOC og G/S fanges når flyet når strålen. En høyde bak deg armerer <b>ingenting</b>.'),
  ill:()=>sv(`<line x1="10" y1="20" x2="190" y2="20" stroke="#7fdceb" stroke-dasharray="3 3"/>${tx(186,15,'selected','#7fdceb','end',7.5)}<path d="M14 30 L120 54" stroke="#c9b6f2" stroke-width="2" fill="none"/>${ar(120,54,160,63,'#f0503f')}${tx(60,56,'nothing armed','#f0503f','middle',8)}`)},go({mode:'ap',pre:'behind',ac:'jet'})),
 Object.assign({k:'rev',t:t2('Mode reversions','Modusreversjoner'),d:t2('Some actions drop a mode on their own: a new altitude during the capture, a speed limit, an altitude set behind a level change. The autopilot falls back to a <b>basic mode</b>, often V/S.','Noen handlinger fjerner en modus av seg selv: ny høyde under innfanging, en fartsgrense, en høyde satt bak en nivåendring. Autopiloten faller tilbake til en <b>grunnmodus</b>, ofte V/S.'),
  ill:()=>fmaIll([[31,'SPEED','#3fe08a'],[79,'ALT*','#3fe08a',24],[79,'V/S +900','#3fe08a',42],[125,'HDG','#3fe08a'],[169,'AP FD','#eef3f7']])},go({mode:'ap',pre:'altstar',ac:'jet'})),
 Object.assign({k:'lev',t:t2('The levers and the autothrust','Hendlene og autothrust'),d:t2('With fixed levers the lever is a <b>limit</b>: in the CL detent the autothrust works up to climb thrust, below it less, above it the thrust is manual. Moving levers are driven by the autothrust instead.','Med faste hendler er hendelen en <b>grense</b>: i CL-hakket arbeider autothrust opp til stigeskyvekraft, under det mindre, over det er skyvekraften manuell. Bevegelige hendler drives i stedet av autothrust.'),
  ill:()=>sv(`<rect x="20" y="8" width="26" height="50" rx="4" fill="#161c21"/><rect x="31" y="12" width="4" height="42" fill="#05080b"/><rect x="22" y="30" width="22" height="7" rx="2" fill="#d9dee2"/>${tx(52,14,'TOGA','#8e99a4','start',7.5)}${tx(52,34,'CL','#3fe08a','start',8)}${tx(52,56,'IDLE','#8e99a4','start',7.5)}<rect x="96" y="28" width="90" height="9" fill="#161c21"/><rect x="96" y="28" width="52" height="9" fill="#3fe08a"/>`)},go({mode:'at',pre:'mid'})),
 Object.assign({k:'tau',t:t2('TCAS works in time','TCAS regner i tid'),d:t2('<b>Tau</b> = range ÷ closure rate: the seconds to the closest point. A traffic advisory (TA) comes at about 20–48 s, a resolution advisory (RA) at 15–35 s, more the higher you are.','<b>Tau</b> = avstand ÷ nærmingsfart: sekundene til nærmeste punkt. Et trafikkråd (TA) kommer ved rundt 20–48 s, et unnvikelsesråd (RA) ved 15–35 s, mer jo høyere du er.'),
  dd:t2('Close in, a minimum distance (DMOD) takes over, so a slow intruder is not missed. Altitude is tested the same way, with a vertical tau and a fixed band (ZTHR).','Tett inne tar en minsteavstand (DMOD) over, så et sakte fly ikke blir oversett. Høyden testes på samme måte, med en vertikal tau og et fast bånd (ZTHR).'),
  ill:()=>sv(`<circle cx="40" cy="44" r="5" fill="#eef3f7"/>${ar(170,20,62,40,'#f0b440')}<circle cx="170" cy="20" r="6" fill="#f0b440"/>${tx(110,58,'τ = r ÷ closure','#eef3f7','middle',9)}`)},go({mode:'tcas',pre:'climb',t:24})),
 Object.assign({k:'ra',t:t2('Follow the RA','Følg RA'),d:t2('RAs are <b>vertical only</b> and coordinated between two TCAS aircraft. Fly the green promptly, never against the RA, even if ATC says otherwise, and report “TCAS RA”.','RA er <b>bare vertikale</b> og koordinert mellom to TCAS-fly. Fly det grønne raskt, aldri mot RA, selv om ATC sier noe annet, og meld «TCAS RA».'),
  dd:t2('An intruder with only an altitude-reporting transponder still triggers RAs, but only you manoeuvre. Without altitude reporting you get a TA only. Below 1 000 ft above the ground there are no RAs.','Et fly med bare høyderapporterende transponder utløser fortsatt RA, men bare du manøvrerer. Uten høyderapportering får du bare TA. Under 1 000 ft over bakken er det ingen RA.'),
  ill:()=>sv(`<rect x="150" y="6" width="22" height="52" fill="#2a3238"/><rect x="151" y="30" width="9" height="27" fill="#f0503f"/><rect x="151" y="16" width="9" height="13" fill="#3fe08a"/>${tx(80,26,'CLIMB, CLIMB','#f0503f','middle',10)}${tx(80,44,'fly the green','#3fe08a','middle',8)}`)},go({mode:'tcas',pre:'climb',t:46})),
 Object.assign({k:'gpws',t:t2('EGPWS modes 1–6','EGPWS mode 1–6'),d:t2('The basic modes look <b>down</b> with the radio altimeter: 1 sink rate, 2 terrain closure, 3 sink after take-off, 4 too low in the wrong configuration, 5 below the glide slope, 6 callouts and bank angle.','Grunnmodusene ser <b>ned</b> med radiohøydemåleren: 1 synkrate, 2 terrengnærming, 3 synk etter avgang, 4 for lavt i feil konfigurasjon, 5 under glidebanen, 6 utrop og krengning.'),
  dd:t2('Mode 7 is the reactive windshear warning (see the storms lab). Cautions (amber) need a correction; a warning (red, PULL UP) needs the escape manoeuvre.','Mode 7 er det reaktive vindskjærvarselet (se tordenværlabben). Advarsler (gule) krever en korreksjon; et varsel (rødt, PULL UP) krever unnamanøveren.'),
  ill:()=>sv(`<rect x="0" y="48" width="200" height="16" fill="#34493b"/>${ar(30,10,120,44,'#c9b6f2')}<line x1="120" y1="44" x2="120" y2="48" stroke="#eef3f7" stroke-dasharray="2 2"/>${tx(150,28,'SINK RATE','#f0b440','middle',9)}`)},go({mode:'gpws',sc:'sink',t:14})),
 Object.assign({k:'la',t:t2('Look ahead, then pull up','Se forover, så trekk opp'),d:t2('The enhanced function compares the path <b>ahead</b> with a terrain database: CAUTION TERRAIN about 60 s out, TERRAIN AHEAD, PULL UP about 30 s out. At PULL UP: autopilot off, full thrust, pitch up, wings level, speedbrakes in.','Den forbedrede funksjonen sammenligner banen <b>foran</b> med en terrengdatabase: CAUTION TERRAIN rundt 60 s før, TERRAIN AHEAD, PULL UP rundt 30 s før. Ved PULL UP: autopilot av, full skyvekraft, nesen opp, vingene rett, luftbremser inn.'),
  dd:t2('It is only as good as the database and the aircraft position (normally GNSS). With GNSS interference the terrain picture can be wrong; modes 1–6 still work from the radio altimeter.','Den er bare så god som databasen og flyets posisjon (normalt GNSS). Med GNSS-forstyrrelser kan terrengbildet bli feil; mode 1–6 virker fortsatt fra radiohøydemåleren.'),
  ill:()=>sv(`<path d="M0 64 L90 64 Q130 10 160 18 L200 30 L200 64Z" fill="#34493b"/><path d="M20 30 L120 30" stroke="#c9b6f2" stroke-width="2"/><path d="M20 30 L120 30 L120 38 L20 38Z" fill="rgba(240,80,63,.3)"/>${tx(70,24,'60 s · 30 s','#f0b440','middle',8)}`)},go({mode:'gpws',sc:'ridge',t:12}))];
KCS.render(el('kcGrid'),KC);

/* ---------------- deep-dive folds ---------------- */
const P=s=>`<p>${s}</p>`;
const tbl=rows=>`<div class="wrapx"><table class="ftab">${rows.map((r,j)=>`<tr>${r.map(c=>j?`<td>${L(c)}</td>`:`<th>${L(c)}</th>`).join('')}</tr>`).join('')}</table></div>`;
const DD=[
 ['ga',t2('Light aircraft against jet transport','Lett fly mot jet transportfly'),t2('what each system can do','hva hvert system kan'),()=>tbl([
  [t2('','') ,t2('Light single (two-axis AP)','Lett enmotors (tokanals AP)'),t2('Jet transport (FD/AP/A-THR)','Jet transportfly (FD/AP/A-THR)')],
  [t2('Axes','Akser'),t2('Roll and pitch; some have yaw damper and electric trim','Rull og pitch; noen har girdemper og elektrisk trim'),t2('Roll, pitch, autothrust; yaw damper; autoland on some','Rull, pitch, autothrust; girdemper; autoland på noen')],
  [t2('Speed','Fart'),t2('Your power lever, always','Din gasshendel, alltid'),t2('Autothrust (SPEED) or pitch (level change)','Autothrust (SPEED) eller pitch (nivåendring)')],
  [t2('Annunciation','Annunsiering'),t2('One line: active green, armed white','Én linje: aktiv grønn, armert hvit'),t2('FMA columns: thrust, vertical, lateral, status; armed blue','FMA-kolonner: skyvekraft, vertikal, lateral, status; armert blå')],
  [t2('Flight director','Flight director'),t2('Optional','Valgfritt'),t2('Standard; you can fly the FD with the AP off','Standard; du kan fly FD med AP av')],
  [t2('Protections','Beskyttelser'),t2('Usually none: a VS it cannot fly ends in a stall','Vanligvis ingen: en VS den ikke klarer, ender i steiling'),t2('Speed limits on V/S, last-ditch thrust protection on some','Fartsgrenser i V/S, nødbeskyttelse med skyvekraft på noen')],
  [t2('Disconnect','Utkobling'),t2('Button on the yoke; check trim first (out of trim = a jump)','Knapp på rattet; sjekk trim først (ute av trim = et rykk)'),t2('Instinctive button; aural and visual warning','Instinktiv knapp; lyd- og lysvarsel')]])],
 ['fma',t2('Reading the FMA in practice','Lese FMA-en i praksis'),t2('callouts and levels of automation','utrop og automasjonsnivåer'),()=>P(L(t2('Typical SOP: the pilot flying announces every FMA change from left to right (for example “SPEED, ALT star, LOC blue”) and the pilot monitoring checks it. Check the FMA after every input on the autopilot panel: a knob pushed when you meant to pull, or a mode that did not engage, is only visible there.','Typisk SOP: pilot flying leser hver FMA-endring fra venstre mot høyre (for eksempel «SPEED, ALT star, LOC blå»), og pilot monitoring sjekker den. Sjekk FMA-en etter hver handling på autopilotpanelet: en knapp som ble trykket når du mente å trekke, eller en modus som ikke ble koblet inn, synes bare der.')))+P(L(t2('<b>Fly the aircraft, then the automation.</b> If it does not do what you expect, go down a level: from managed to selected modes, from autopilot to the flight director, and if needed fly by hand with the flight directors off. Do not reprogram while the flight path is wrong.','<b>Fly flyet, så automatikken.</b> Gjør det ikke det du venter, gå ned et nivå: fra styrte til valgte moduser, fra autopilot til flight director, og om nødvendig fly manuelt med flight directorene av. Ikke programmer om mens flybanen er feil.')))],
 ['lev',t2('Autothrust and the thrust levers','Autothrust og skyvehendlene'),t2('fixed and moving levers','faste og bevegelige hendler'),()=>P(L(t2('<b>Moving (back-driven) levers:</b> a servo moves the levers to the thrust the autothrust commands, so their position always shows the thrust. You can override by hand; in some phases (HOLD after take-off thrust is set) the servo lets go.','<b>Bevegelige hendler:</b> en servo flytter hendlene til skyvekraften autothrust ber om, så posisjonen viser alltid skyvekraften. Du kan overstyre for hånd; i noen faser (HOLD etter at startskyvekraft er satt) slipper servoen.')))
   +P(L(t2('<b>Fixed levers with detents:</b> the levers stay put and their position is the <b>upper limit</b>. In the climb detent the autothrust works between idle and climb thrust. Below it the limit is lower and the speed can decay (an amber message asks for the levers back). Above it the thrust is manual: in MCT or TOGA the autothrust is only armed and the speed is not held. Pulling both levers to idle typically disconnects the autothrust.','<b>Faste hendler med hakk:</b> hendlene står stille, og posisjonen er <b>øvre grense</b>. I stigehakket arbeider autothrust mellom tomgang og stigeskyvekraft. Under det er grensen lavere, og farten kan synke (en gul melding ber om hendlene tilbake). Over det er skyvekraften manuell: i MCT eller TOGA er autothrust bare armert, og farten holdes ikke. Å trekke begge hendlene til tomgang kobler vanligvis ut autothrust.')))
   +P(L(t2('A last-ditch protection on some types sets full thrust on its own at a very high angle of attack. It is not a speed mode and not available in every configuration: do not count on it.','En nødbeskyttelse på noen typer setter full skyvekraft av seg selv ved svært høy angrepsvinkel. Den er ikke en fartsmodus og ikke tilgjengelig i alle konfigurasjoner: ikke regn med den.')))],
 ['tcas',t2('TCAS II version 7.1 in numbers','TCAS II versjon 7.1 i tall'),t2('sensitivity levels, RA types, inhibitions','følsomhetsnivåer, RA-typer, sperrer'),()=>tbl([[t2('Own altitude','Egen høyde'),t2('SL','SL'),t2('τ TA','τ TA'),t2('τ RA','τ RA'),t2('DMOD TA/RA','DMOD TA/RA'),t2('ALIM','ALIM')],
  [t2('below 1 000 ft AGL','under 1 000 ft AGL'),t2('2','2'),t2('20 s','20 s'),t2('— (TA only)','— (bare TA)'),t2('0.30 NM / —','0,30 NM / —'),t2('—','—')],
  [t2('1 000–2 350 ft AGL','1 000–2 350 ft AGL'),t2('3','3'),t2('25 s','25 s'),t2('15 s','15 s'),t2('0.33 / 0.20 NM','0,33 / 0,20 NM'),t2('300 ft','300 ft')],
  [t2('2 350–5 000 ft','2 350–5 000 ft'),t2('4','4'),t2('30 s','30 s'),t2('20 s','20 s'),t2('0.48 / 0.35 NM','0,48 / 0,35 NM'),t2('300 ft','300 ft')],
  [t2('5 000–10 000 ft','5 000–10 000 ft'),t2('5','5'),t2('40 s','40 s'),t2('25 s','25 s'),t2('0.75 / 0.55 NM','0,75 / 0,55 NM'),t2('350 ft','350 ft')],
  [t2('10 000–20 000 ft','10 000–20 000 ft'),t2('6','6'),t2('45 s','45 s'),t2('30 s','30 s'),t2('1.00 / 0.80 NM','1,00 / 0,80 NM'),t2('400 ft','400 ft')],
  [t2('20 000–42 000 ft','20 000–42 000 ft'),t2('7','7'),t2('48 s','48 s'),t2('35 s','35 s'),t2('1.30 / 1.10 NM','1,30 / 1,10 NM'),t2('600 ft','600 ft')]])
   +P(L(t2('<b>RA types.</b> Corrective: CLIMB or DESCEND (1 500 fpm), INCREASE CLIMB or DESCENT (2 500 fpm), CROSSING when your path crosses the intruder’s altitude, and LEVEL OFF, the only weakening RA in version 7.1 (it replaced the four “adjust vertical speed” RAs of 7.0). Preventive: MONITOR VERTICAL SPEED, keep out of the red. Reversals (CLIMB, CLIMB NOW) come when the geometry changes. TCAS assumes a response within about 5 s at 0.25 g, 2.5 s and 0.35 g for a strengthened or reversed RA.','<b>RA-typer.</b> Korrigerende: CLIMB eller DESCEND (1 500 fpm), INCREASE CLIMB eller DESCENT (2 500 fpm), CROSSING når banen din krysser det andre flyets høyde, og LEVEL OFF, den eneste svekkende RA-en i versjon 7.1 (den erstattet de fire «adjust vertical speed»-RA-ene i 7.0). Forebyggende: MONITOR VERTICAL SPEED, hold deg ute av det røde. Reverseringer (CLIMB, CLIMB NOW) kommer når geometrien endrer seg. TCAS forutsetter reaksjon innen rundt 5 s med 0,25 g, 2,5 s og 0,35 g for en forsterket eller reversert RA.')))
   +P(L(t2('<b>Inhibitions (typical):</b> all RAs below 1 000 ft above the ground, DESCEND below about 1 100 ft, INCREASE DESCENT below about 1 450 ft, all aural alerts below about 500 ft; CLIMB RAs can be inhibited at high altitude or in configurations with too little performance. Select TA ONLY when you cannot follow an RA, for example with an engine failure.','<b>Sperrer (typisk):</b> alle RA under 1 000 ft over bakken, DESCEND under rundt 1 100 ft, INCREASE DESCENT under rundt 1 450 ft, alle lydvarsler under rundt 500 ft; CLIMB-RA kan sperres i stor høyde eller i konfigurasjoner med for liten ytelse. Velg TA ONLY når du ikke kan følge en RA, for eksempel ved motorstans.')))
   +P(L(t2('<b>The RA procedure:</b> disconnect the autopilot and flight directors (unless the aircraft has an AP/FD TCAS mode), fly the green smoothly and promptly, do not manoeuvre opposite to the RA, and do not exceed it. Report “TCAS RA” to ATC; after CLEAR OF CONFLICT return to the clearance and report it. ATC is not responsible for separation with that aircraft during the RA. TCAS I (some smaller aircraft) gives TAs only.','<b>RA-prosedyren:</b> koble ut autopilot og flight directorer (med mindre flyet har en AP/FD TCAS-modus), fly det grønne mykt og raskt, ikke manøvrer motsatt av RA, og ikke gjør mer enn den ber om. Meld «TCAS RA» til ATC; etter CLEAR OF CONFLICT, gå tilbake til klareringen og meld det. ATC er ikke ansvarlig for separasjon til det flyet under RA-en. TCAS I (noen mindre fly) gir bare TA.')))],
 ['gpws',t2('EGPWS modes and the terrain display','EGPWS-moduser og terrengskjermen'),t2('what each mode looks at','hva hver modus ser på'),()=>tbl([[t2('Mode','Mode'),t2('Looks at','Ser på'),t2('Alerts','Varsler')],
  [t2('1 Excessive descent rate','1 For høy synkrate'),t2('radio altitude, barometric descent rate','radiohøyde, barometrisk synkrate'),t2('SINK RATE, PULL UP','SINK RATE, PULL UP')],
  [t2('2 Excessive terrain closure','2 For rask terrengnærming'),t2('rate of change of radio altitude','endringen i radiohøyde'),t2('TERRAIN, TERRAIN, PULL UP (2B with landing flaps: TERRAIN)','TERRAIN, TERRAIN, PULL UP (2B med landingsklaff: TERRAIN)')],
  [t2('3 Altitude loss after take-off','3 Høydetap etter avgang'),t2('height lost since the highest point','høyde tapt siden høyeste punkt'),t2("DON'T SINK","DON'T SINK")],
  [t2('4 Unsafe terrain clearance','4 Utrygg terrengklaring'),t2('radio altitude, speed, gear and flaps','radiohøyde, fart, understell og klaff'),t2('TOO LOW, GEAR / FLAPS / TERRAIN','TOO LOW, GEAR / FLAPS / TERRAIN')],
  [t2('5 Below glide slope','5 Under glidebanen'),t2('glide slope deviation below 1 000 ft','glidebaneavvik under 1 000 ft'),t2('GLIDESLOPE','GLIDESLOPE')],
  [t2('6 Advisories','6 Råd'),t2('radio altitude, bank angle, minimums','radiohøyde, krengning, minima'),t2('height callouts, MINIMUMS, BANK ANGLE','høydeutrop, MINIMUMS, BANK ANGLE')],
  [t2('Enhanced: look-ahead and terrain clearance floor','Forbedret: fremoverkikk og terrain clearance floor'),t2('terrain and runway database, GNSS position','terreng- og rullebanedatabase, GNSS-posisjon'),t2('CAUTION TERRAIN, TERRAIN AHEAD PULL UP, TOO LOW TERRAIN','CAUTION TERRAIN, TERRAIN AHEAD PULL UP, TOO LOW TERRAIN')]])
   +P(L(t2('<b>Terrain display colours</b> are relative to your altitude: red more than 2 000 ft above you, dense yellow 1 000–2 000 ft above, light yellow from just below (500 ft, 250 ft with the gear down) to 1 000 ft above, green 500 to 2 000 ft below, black lower. When the look-ahead alerts, the threatening terrain turns solid yellow (caution) or solid red (warning).','<b>Fargene på terrengskjermen</b> er i forhold til din høyde: rødt mer enn 2 000 ft over deg, tett gult 1 000–2 000 ft over, lyst gult fra like under (500 ft, 250 ft med understellet ute) til 1 000 ft over, grønt 500 til 2 000 ft under, svart lavere. Når fremoverkikket varsler, blir det truende terrenget helt gult (advarsel) eller helt rødt (varsel).')))
   +P(L(t2('<b>Response to PULL UP</b> (or TERRAIN AHEAD, PULL UP) at night or in IMC: at once, no discussion. Autopilot off, wings level, full thrust, pitch up firmly to the stick shaker or the pitch limit indicator (on aircraft with envelope protection, full back stick), speedbrakes retracted, and do not change the configuration until the warning stops and the terrain is clear. Cautions are corrected at once.','<b>Reaksjon på PULL UP</b> (eller TERRAIN AHEAD, PULL UP) om natten eller i IMC: straks, ingen diskusjon. Autopilot av, vingene rett, full skyvekraft, løft nesen bestemt til stick shaker eller pitchgrense-indikatoren (på fly med konvoluttbeskyttelse, fullt bakover), luftbremser inn, og ikke endre konfigurasjon før varselet stopper og terrenget er klart. Advarsler korrigeres straks.')))],
 ['ra',t2('The radio altimeter','Radiohøydemåleren'),t2('what it measures, who uses it','hva den måler, hvem som bruker den'),()=>P(L(t2('It measures the height of the antenna above whatever is directly below (ground, trees, buildings or sea) by timing a signal in the 4.2–4.4 GHz band down and back, typically up to 2 500 ft. It is not referenced to sea level, so it jumps over a ridge or a building.','Den måler antennens høyde over det som er rett under (bakke, trær, bygninger eller sjø) ved å ta tiden på et signal i 4,2–4,4 GHz-båndet ned og tilbake, typisk opp til 2 500 ft. Den er ikke referert til havnivå, så den hopper over en rygg eller en bygning.')))
   +P(L(t2('GPWS modes 1–6, the height callouts, autoland (flare and retard), TCAS (its low-level inhibitions) and CAT II/III decision heights all use it. A faulty radio altimeter can fool the automation: in a 2009 accident near Amsterdam a wrong reading of −8 ft put the autothrust into its landing retard mode at about 2 000 ft, and the speed decayed unnoticed.','GPWS mode 1–6, høydeutropene, autoland (flare og retard), TCAS (sperrene nær bakken) og beslutningshøyder for CAT II/III bruker den. En feil radiohøydemåler kan lure automatikken: i en ulykke ved Amsterdam i 2009 satte en feil visning på −8 ft autothrust i landingsmodusen (retard) i rundt 2 000 ft, og farten forsvant uten at noen merket det.')))]];
function drawDD(){ const open=[...document.querySelectorAll('#ddList details[open]')].map(d=>d.id);
  el('ddList').innerHTML=DD.map(([id,t,s,f])=>`<details class="dfold" id="dd-${id}"><summary>${L(t)} <small>${L(s)}</small></summary><div>${f()}</div></details>`).join('');
  open.forEach(i=>{ const d=el(i); if(d) d.open=true; }); }

/* ---------------- Test yourself ---------------- */
function drawTake(){ const TK=[
  t2('<b>The FMA is the truth.</b> Green is active, blue (or white on a light autopilot) is armed. Read every change, and check it after every input.','<b>FMA-en er sannheten.</b> Grønt er aktivt, blått (eller hvitt på en lett autopilot) er armert. Les hver endring, og sjekk den etter hver handling.'),
  t2('<b>A light two-axis autopilot</b> flies roll and pitch only: you fly the power and watch the speed. A <b>jet</b> adds the flight director and the autothrust.','<b>En lett tokanals autopilot</b> flyr bare rull og pitch: du styrer effekten og passer farten. Et <b>jetfly</b> legger til flight director og autothrust.'),
  t2('<b>Pitch and thrust are a pair:</b> SPEED with a path mode (ALT, V/S, G/S), or fixed thrust (THR CLB, THR IDLE) with the speed on the elevator.','<b>Pitch og skyvekraft hører sammen:</b> SPEED med en banemodus (ALT, V/S, G/S), eller fast skyvekraft (THR CLB, THR IDLE) med farten på høyderoret.'),
  t2('<b>A capture arms only ahead of you.</b> Set the altitude first, then climb or descend. Changing it during ALT* reverts to V/S.','<b>En innfanging armeres bare foran deg.</b> Sett høyden først, stig eller synk så. Endrer du den under ALT*, går den tilbake til V/S.'),
  t2('<b>APPR arms LOC and G/S; LOC alone</b> leaves you at the altitude, above the glide path.','<b>APPR armerer LOC og G/S; LOC alene</b> lar deg bli i høyden, over glidebanen.'),
  t2('<b>Fixed thrust levers are a limit:</b> keep them in the climb detent; above it the thrust is manual and the speed is free.','<b>Faste skyvehendler er en grense:</b> hold dem i stigehakket; over det er skyvekraften manuell, og farten er fri.'),
  t2('<b>TCAS: tau = range ÷ closure rate.</b> TA: look and prepare. RA: follow it promptly, never against it, and report “TCAS RA”.','<b>TCAS: tau = avstand ÷ nærmingsfart.</b> TA: se og forbered deg. RA: følg den raskt, aldri mot den, og meld «TCAS RA».'),
  t2('<b>EGPWS modes 1–6 look down</b> with the radio altimeter; the <b>look-ahead</b> warns of terrain ahead about 60 s and 30 s out. PULL UP: escape manoeuvre at once.','<b>EGPWS mode 1–6 ser ned</b> med radiohøydemåleren; <b>fremoverkikket</b> varsler om terreng foran rundt 60 s og 30 s før. PULL UP: unnamanøver straks.')];
  el('take').innerHTML=TK.map(x=>`<li>${L(x)}</li>`).join(''); }

LAB.quiz(el('qbox'),'autoflight',()=>LAB.shuffle([
 {q:t2('The FMA shows THR IDLE | LVL CHG | HDG. What holds the speed?','FMA-en viser THR IDLE | LVL CHG | HDG. Hva holder farten?'),a:[t2('The elevator, through pitch','Høyderoret, gjennom pitch'),t2('The autothrust','Autothrust'),t2('Nothing: speed is free in a descent','Ingenting: farten er fri i nedstigning'),t2('The pilot, with the levers','Piloten, med hendlene')],c:0,e:t2('With the thrust fixed at idle, the autopilot holds the speed with pitch; the rate of descent is whatever results.','Med skyvekraften fast på tomgang holder autopiloten farten med pitch; synkraten blir det som blir.')},
 {q:t2('Which does a typical two-axis light-aircraft autopilot NOT control?','Hva styrer en typisk tokanals autopilot i et lett fly IKKE?'),a:[t2('The power and the airspeed','Effekten og farten'),t2('The heading','Kursen'),t2('The vertical speed','Vertikalfarten'),t2('The glide slope','Glidebanen')],c:0,e:t2('Two axes: roll and pitch. There is no autothrottle, so the speed follows the power you set.','To akser: rull og pitch. Det er ingen autothrottle, så farten følger effekten du setter.')},
 {q:t2('A blue (cyan) ALT under the vertical mode means…','En blå (cyan) ALT under den vertikale modusen betyr…'),a:[t2('Altitude capture is armed','Høydeinnfanging er armert'),t2('The aircraft is holding altitude','Flyet holder høyden'),t2('The altitude is wrong','Høyden er feil'),t2('The autopilot is off','Autopiloten er av')],c:0,e:t2('Armed modes wait in the second row and engage by themselves; green is active.','Armerte moduser venter i andre rad og kobles inn av seg selv; grønt er aktivt.')},
 {q:t2('You are in V/S descent with the selected altitude above you. What happens at the altitude you wanted?','Du er i V/S-nedstigning med valgt høyde over deg. Hva skjer ved høyden du ville ha?'),a:[t2('Nothing: no capture is armed, the descent continues','Ingenting: ingen innfanging er armert, nedstigningen fortsetter'),t2('It levels off','Den flater ut'),t2('It climbs back','Den stiger tilbake'),t2('The autopilot disconnects','Autopiloten kobler ut')],c:0,e:t2('Capture arms only towards a selected altitude ahead of the vertical motion.','Innfanging armeres bare mot en valgt høyde foran den vertikale bevegelsen.')},
 {q:t2('During ALT* you change the selected altitude by 2 000 ft. Typically the FMA shows…','Under ALT* endrer du valgt høyde med 2 000 ft. Typisk viser FMA-en…'),a:[t2('V/S at the current vertical speed','V/S med vertikalfarten den har'),t2('ALT at the old altitude','ALT i den gamle høyden'),t2('LVL CHG towards the new altitude','LVL CHG mot den nye høyden'),t2('G/S','G/S')],c:0,e:t2('The capture is dropped and the autopilot reverts to a basic mode. Re-engage a climb or descent deliberately.','Innfangingen forsvinner, og autopiloten går tilbake til en grunnmodus. Koble inn stigning eller nedstigning med vilje.')},
 {q:t2('Fixed-lever autothrust, levers in TOGA after a go-around, aircraft levelling off. The FMA thrust column shows MAN TOGA. The speed…','Autothrust med faste hendler, hendlene i TOGA etter en go-around, flyet flater ut. Skyvekraftkolonnen viser MAN TOGA. Farten…'),a:[t2('Is not controlled and will increase','Styres ikke og vil øke'),t2('Is held by the autothrust','Holdes av autothrust'),t2('Is held by pitch','Holdes av pitch'),t2('Is limited to the flap limit automatically','Begrenses automatisk til klaffgrensen')],c:0,e:t2('Above the climb detent the thrust is manual. Bring the levers to CL so the autothrust becomes active.','Over stigehakket er skyvekraften manuell. Ta hendlene til CL så autothrust blir aktiv.')},
 {q:t2('TCAS tau is…','TCAS-tau er…'),a:[t2('Range divided by closure rate: the time to the closest point','Avstand delt på nærmingsfart: tiden til nærmeste punkt'),t2('The distance at which TCAS warns','Avstanden der TCAS varsler'),t2('The vertical miss distance','Den vertikale avstanden ved passering'),t2('The time since the TA','Tiden siden TA')],c:0,e:t2('Thresholds are times, so a faster closure triggers the alert at a longer range.','Grensene er tider, så raskere nærming gir varsel på lengre avstand.')},
 {q:t2('An intruder has a Mode A transponder (no altitude reporting). What can TCAS II give?','Et fly har Mode A-transponder (ingen høyderapportering). Hva kan TCAS II gi?'),a:[t2('A TA only','Bare TA'),t2('TA and RA','TA og RA'),t2('A coordinated RA','En koordinert RA'),t2('Nothing','Ingenting')],c:0,e:t2('RAs need the intruder’s altitude. Mode C or S gives RAs; coordination needs TCAS in both.','RA krever det andre flyets høyde. Mode C eller S gir RA; koordinering krever TCAS i begge.')},
 {q:t2('You get CLIMB, CLIMB while ATC instructs a descent. You…','Du får CLIMB, CLIMB mens ATC ber deg synke. Du…'),a:[t2('Follow the RA and report “TCAS RA”','Følger RA og melder «TCAS RA»'),t2('Follow ATC','Følger ATC'),t2('Level off','Flater ut'),t2('Turn away instead','Svinger unna i stedet')],c:0,e:t2('The RA is coordinated and vertical only; ATC does not know about it. Never manoeuvre against it.','RA-en er koordinert og bare vertikal; ATC vet ikke om den. Manøvrer aldri mot den.')},
 {q:t2('Below what height does TCAS II give no RAs at all?','Under hvilken høyde gir TCAS II ingen RA i det hele tatt?'),a:[t2('About 1 000 ft above the ground','Rundt 1 000 ft over bakken'),t2('About 2 500 ft above the ground','Rundt 2 500 ft over bakken'),t2('About 500 ft above the ground','Rundt 500 ft over bakken'),t2('It always gives RAs','Den gir alltid RA')],c:0,e:t2('Sensitivity level 2, below about 1 000 ft AGL, is TA only. Descend RAs are inhibited below about 1 100 ft.','Følsomhetsnivå 2, under rundt 1 000 ft AGL, er bare TA. Descend-RA er sperret under rundt 1 100 ft.')},
 {q:t2("DON'T SINK comes from which GPWS mode?","DON'T SINK kommer fra hvilken GPWS-modus?"),a:[t2('Mode 3, altitude loss after take-off or go-around','Mode 3, høydetap etter avgang eller go-around'),t2('Mode 1','Mode 1'),t2('Mode 5','Mode 5'),t2('Mode 6','Mode 6')],c:0,e:t2('Mode 3 remembers the highest height and warns of a loss close to the ground in the climb-out.','Mode 3 husker høyeste høyde og varsler om tap nær bakken i utgangsstigningen.')},
 {q:t2('Why does the EGPWS look-ahead protect better than mode 2 against a steep ridge?','Hvorfor beskytter EGPWS-fremoverkikket bedre enn mode 2 mot en bratt rygg?'),a:[t2('It compares the path ahead with a terrain database instead of waiting for the radio altimeter to see the ground rise','Det sammenligner banen foran med en terrengdatabase i stedet for å vente på at radiohøydemåleren ser bakken stige'),t2('It uses a stronger radio altimeter','Det bruker en sterkere radiohøydemåler'),t2('It is only active with landing flaps','Det er bare aktivt med landingsklaff'),t2('It uses TCAS','Det bruker TCAS')],c:0,e:t2('Mode 2 only sees what is under you. The look-ahead typically gives a caution about 60 s and a warning about 30 s ahead.','Mode 2 ser bare det som er under deg. Fremoverkikket gir typisk advarsel rundt 60 s og varsel rundt 30 s før.')},
 {q:t2('TOO LOW, GEAR is a mode 4 alert. What triggers it?','TOO LOW, GEAR er et mode 4-varsel. Hva utløser det?'),a:[t2('Low radio altitude at low speed with the gear up','Lav radiohøyde i lav fart med understellet inne'),t2('A high descent rate with the gear down','Høy synkrate med understellet ute'),t2('Gear extended above VLE','Understell ute over VLE'),t2('Bank angle near the ground','Krengning nær bakken')],c:0,e:t2('Mode 4 protects against being close to the ground in the wrong configuration; faster, the same envelope gives TOO LOW, TERRAIN.','Mode 4 beskytter mot å være nær bakken i feil konfigurasjon; raskere gir samme konvolutt TOO LOW, TERRAIN.')}]).slice(0,10));

/* ---------------- static strings, text, start ---------------- */
LAB.add({},{'Automation and Warnings':'Automatikk og varsling','Automation and warnings: autopilot, TCAS and EGPWS':'Automatikk og varsling: autopilot, TCAS og EGPWS','Birdbird Virtual Labs · Instruments':'Birdbird Virtual Labs · Instrumenter',
 '1 · Understand':'1 · Forstå','2 · Explore':'2 · Utforsk','3 · Test yourself':'3 · Test deg selv','Key concepts':'Nøkkelbegreper','Deep dive':'Dypdykk','The automation lab':'Automatikklabben','Try it':'Prøv selv','Key points':'Det viktigste','Test yourself':'Test deg selv',
 'Controls':'Kontroller','Aircraft':'Fly','Autopilot panel':'Autopilotpanel','Thrust levers':'Skyvehendler','The encounter':'Møtet','Intruder equipment':'Utstyr i det andre flyet','Your crew':'Din besetning','The flight':'Flygingen','Run':'Kjør','Scenarios':'Scenarier','Mode':'Modus','Sections':'Seksjoner',
 'Gear up':'Understell inne','Gear down':'Understell ute','Landing':'Landing','Terrain look-ahead (enhanced)':'Terrengvarsling forover (forbedret)',
 'Primary flight display with the flight mode annunciator, next to a plan view and a side view of the flight.':'Primær flyskjerm med flight mode annunciator, ved siden av et kartbilde og et sidebilde av flygingen.'});
LAB.tx({lead:'Autopiloten flyr det modusannunsiatoren sier, ikke det du mente. Sammenlign en enkel tokanals autopilot i et lett fly med flight director, autopilot og autothrust i et jetfly, se hvordan moduser armeres, fanges og går tilbake, og så hvordan TCAS og EGPWS bestemmer når de skal varsle deg, og hva du gjør når de gjør det.'});
function texts(){
  el('kin').textContent=L(t2('Ten ideas that carry the automation and the warning systems. “Show in the model” sets the lab up so you can see it.','Ti ideer som bærer automatikken og varslingssystemene. «Vis i modellen» setter opp labben så du kan se det.'));
  el('xLead').textContent=L(deepOn()?t2('Pick a mode above the figure. In Autopilot & FD, switch between the light single and the jet, press the autopilot buttons and watch the FMA, the plan view and the side view; the orange-bordered scenarios set up the classic traps. Autothrust shows what the thrust levers do to it. TCAS and EGPWS play an encounter or a flight you can scrub through.','Velg modus over figuren. I Autopilot og FD, bytt mellom lett enmotors og jetfly, trykk på autopilotknappene og følg FMA-en, kartbildet og sidebildet; scenariene med oransje kant setter opp de klassiske fellene. Autothrust viser hva skyvehendlene gjør med den. TCAS og EGPWS spiller av et møte eller en flyging du kan spole i.')
    :t2('Pick a mode above the figure, then a scenario, and press the autopilot buttons. The FMA on top of the PFD tells you what the automation is doing.','Velg modus over figuren, så et scenario, og trykk på autopilotknappene. FMA-en øverst på PFD-en forteller hva automatikken gjør.'));
  el('tryLead').textContent=L(t2('Predict first, then check. "See it in the model" sets it up for you.','Tenk først, sjekk så. «Se det i modellen» setter det opp for deg.'));
  el('tcEqL').textContent=L(t2('Intruder equipment','Utstyr i det andre flyet')); el('tcRsL').textContent=L(t2('Your crew','Din besetning')); el('laOnL').textContent=L(t2('Terrain look-ahead (enhanced)','Terrengvarsling forover (forbedret)'));
  el('levH').textContent=L(t2('Fixed levers with detents (no servo). ↕ is a position between idle and CL.','Faste hendler med hakk (ingen servo). ↕ er en posisjon mellom tomgang og CL.'));
  el('foot').innerHTML=L(t2('<b>Model and limitations.</b> Teaching model, not for flight. The aircraft are generic: a light single with a two-axis autopilot and no autothrottle, and a jet with a flight director, autopilot and fixed-lever autothrust; performance, speeds and mode names are typical and simplified (names differ between types). The runway is at sea level with a 3° glide slope and the localiser course 090; there is no wind. TCAS follows the version 7.1 sensitivity-level table (FAA, Introduction to TCAS II Version 7.1) on a collision course with zero horizontal miss distance, with a simplified RA choice (no reversals), a 5 s pilot response at 0.25 g and 2.5 s at 0.35 g for a strengthened RA. EGPWS envelopes and look-ahead times are typical shapes, not certified data. Always follow the aircraft documentation and your operator’s procedures.','<b>Modell og begrensninger.</b> Pedagogisk modell, ikke for flyging. Flyene er generiske: et lett enmotors fly med tokanals autopilot og ingen autothrottle, og et jetfly med flight director, autopilot og autothrust med faste hendler; ytelse, farter og modusnavn er typiske og forenklede (navnene varierer mellom typer). Rullebanen ligger ved havnivå med 3° glidebane og localiserkurs 090; det er ingen vind. TCAS følger tabellen over følsomhetsnivåer for versjon 7.1 (FAA, Introduction to TCAS II Version 7.1) på kollisjonskurs uten horisontal passeringsavstand, med et forenklet RA-valg (ingen reverseringer), 5 s pilotreaksjon med 0,25 g og 2,5 s med 0,35 g for en forsterket RA. EGPWS-konvoluttene og tidene for fremoverkikk er typiske former, ikke sertifiserte data. Følg alltid flyets dokumentasjon og operatørens prosedyrer.'));
  el('ddH').textContent=L(t2('Deep dive','Dypdykk')); }
function all(){ texts(); drawTabs(); drawPre(); drawMcp(); drawAc(); drawSpd(); runBtn(); drawTask(); drawDD(); drawTake(); upd(); }
LAB.onLang(all);
document.addEventListener('labdepth',all);
LAB.start('af');
loadG('sink'); tcRun(); setMode('ap'); all();
/* Reset (the shell's button in the viewport bar): starting values, same mode */
LAB.reset(()=>{ const m=V.mode; V.tx=5; V.txw=4;
  if(m==='ap'){ V.pre.ap='appr'; loadAP('appr','jet'); drawAc(); } else if(m==='at'){ V.pre.at='cruise'; loadAP('cruise'); }
  else if(m==='tcas') loadTC('climb'); else { GW.la=true; loadG('sink'); }
  V.run=true; drawSpd(); drawPre(); runBtn(); upd(); });
/* old anchors */
const HM={'#fma':'ap','#traps':'ap','#autothrust':'at','#tcas':'tcas','#gpws':'gpws'}, HD={'#radalt':'dd-ra','#ops':'dd-tcas'};
if(HM[location.hash]){ setMode(HM[location.hash]); requestAnimationFrame(()=>el('afVp').scrollIntoView({block:'start'})); }
if(HD[location.hash]){ if(depth()==='short') LAB.setDepth('deep'); requestAnimationFrame(()=>{ const d=el(HD[location.hash]); if(d){ d.open=true; d.scrollIntoView({block:'center'}); } }); }
})();
