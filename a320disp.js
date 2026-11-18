/* NORDAP – A320 cockpit displays (a320.html): PFD, ND, E/WD (upper ECAM), SD (lower ECAM, all pages), ISIS and MCDU.
   Our own drawing of the display formats the FCOM describes; every display draws into a 1000 × 1000 box. The page calls a
   display only when it is on screen and at its own rate (PFD / ND 30 Hz, ECAM 12 Hz, MCDU on change), so the frame budget goes
   to what moves. Colours: green = normal, cyan = selectable / action, amber = caution, red = warning, magenta = managed target. */
(function(G){
'use strict';
const D2R=Math.PI/180, C={g:'#2bff4a',c:'#29e4ff',a:'#ffa21a',r:'#ff2a2a',m:'#ff58ff',w:'#ffffff',y:'#ffff32',k:'#000',gr:'#7d8a96',sky:'#2c86e0',gnd:'#8c4a1e',dk:'#10161c'};
const clamp=(x,a,b)=>x<a?a:x>b?b:x, w360=a=>{ a%=360; return a<0?a+360:a; }, w180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const FONT='Archivo,"Archivo fb",Arial,sans-serif';
function F(g,px,w){ g.font=(w||600)+' '+px+'px '+FONT; }
function T(g,s,x,y,col,px,al,w){ F(g,px||30,w); g.fillStyle=col||C.w; g.textAlign=al||'left'; g.fillText(s,x,y); }
function L(g,x1,y1,x2,y2,col,lw){ g.strokeStyle=col; g.lineWidth=lw||3; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); }
function R(g,x,y,w,h,col,lw){ g.strokeStyle=col; g.lineWidth=lw||3; g.strokeRect(x,y,w,h); }
function FR(g,x,y,w,h,col){ g.fillStyle=col; g.fillRect(x,y,w,h); }
function begin(g,cv){ const s=cv.width/1000; g.setTransform(s,0,0,s,0,0); try{ g.fontStretch='condensed'; }catch(e){} FR(g,0,0,1000,1000,'#000'); g.lineCap='butt'; g.lineJoin='miter'; }
function dark(g,txt){ FR(g,0,0,1000,1000,'#000'); if(txt) T(g,txt,500,500,'#333',34,'center'); }
function tri(g,x,y,s,dir,col,fill){ g.beginPath(); if(dir==='d'){ g.moveTo(x-s,y-s); g.lineTo(x+s,y-s); g.lineTo(x,y+s*0.6); } else if(dir==='u'){ g.moveTo(x-s,y+s); g.lineTo(x+s,y+s); g.lineTo(x,y-s*0.6); } else if(dir==='l'){ g.moveTo(x+s,y-s); g.lineTo(x+s,y+s); g.lineTo(x-s*0.6,y); } else { g.moveTo(x-s,y-s); g.lineTo(x-s,y+s); g.lineTo(x+s*0.6,y); } g.closePath(); if(fill){ g.fillStyle=col; g.fill(); } else { g.strokeStyle=col; g.lineWidth=3; g.stroke(); } }

/* ================= PFD ================= */
function pfd(g,cv,D){
  begin(g,cv);
  if(!D.pwr) return dark(g);
  const att=D.attOK, cx=440, cy=470, ppd=13.5; // pixels per degree of pitch
  // ---- attitude ----
  g.save(); g.beginPath(); g.moveTo(255,215); g.lineTo(625,215); g.quadraticCurveTo(665,470,625,730); g.lineTo(255,730); g.quadraticCurveTo(215,470,255,215); g.clip();
  if(att){
    g.translate(cx,cy); g.rotate(-D.phi*D2R); const off=D.th*ppd;
    FR(g,-800,-1400+off,1600,1400,C.sky); FR(g,-800,off,1600,1400,C.gnd); L(g,-800,off,800,off,C.w,3);
    for(let p=-30;p<=30;p+=2.5){ if(!p) continue; const y=off-p*ppd, maj=p%10===0, mid=p%5===0; if(y<-250||y>270) continue; const w=maj?95:(mid?50:20); L(g,-w/2,y,w/2,y,C.w,3); if(maj){ T(g,String(Math.abs(p)),-w/2-12,y+11,C.w,30,'right'); T(g,String(Math.abs(p)),w/2+12,y+11,C.w,30,'left'); } }
    // heading marks on the horizon
    for(let k=-30;k<=30;k+=10){ const hd=w360(Math.round((D.hdg+k)/10)*10), x=w180(hd-D.hdg)*ppd*0.8; L(g,x,off,x,off+14,C.w,3); }
    // ground reference (radio altitude below 570 ft)
    g.setTransform(cv.width/1000,0,0,cv.width/1000,0,0);
  } else { FR(g,200,200,500,560,'#000'); }
  g.restore();
  if(!att){ T(g,'ATT',cx,cy+15,C.r,48,'center',700); }
  else {
    // bank scale (fixed) and roll index
    g.save(); g.translate(cx,cy);
    for(const a of [-45,-30,-20,-10,0,10,20,30,45]){ const r=232, l=Math.abs(a)%30===0?28:16; g.save(); g.rotate(a*D2R); if(a===0) tri(g,0,-r-12,14,'d',C.y,true); else if(Math.abs(a)===45){ L(g,0,-r,0,-r-l,C.w,3); } else L(g,0,-r,0,-r-l,C.w,3); g.restore(); }
    g.save(); g.rotate(-D.phi*D2R); g.beginPath(); g.moveTo(0,-226); g.lineTo(-15,-202); g.lineTo(15,-202); g.closePath(); g.strokeStyle=Math.abs(D.phi)>45?C.a:C.y; g.lineWidth=3; g.stroke();
    // sideslip index (beta target in blue with an engine out at T.O)
    const bx=clamp(D.beta*8,-40,40); g.beginPath(); g.moveTo(-18+bx,-196); g.lineTo(18+bx,-196); g.lineTo(22+bx,-184); g.lineTo(-22+bx,-184); g.closePath(); g.strokeStyle=D.betaTgt?C.c:C.y; g.stroke();
    // bank limit marks (67°)
    g.save(); g.rotate(67*D2R); L(g,-6,-240,6,-226,C.g,3); L(g,6,-240,-6,-226,C.g,3); g.restore(); g.save(); g.rotate(-67*D2R); L(g,-6,-240,6,-226,C.g,3); L(g,6,-240,-6,-226,C.g,3); g.restore();
    g.restore(); g.restore();
    // pitch limit marks
    // flight director bars (green), or the FPV / FPD in TRK/FPA
    if(D.fd&&D.fdOn&&!D.fpv){ const dx=clamp(D.fdRoll*4.5,-120,120), dy=clamp(D.fdPitch*ppd,-150,150); L(g,cx+dx,cy-150,cx+dx,cy+150,C.g,5); L(g,cx-150,cy+dy,cx+150,cy+dy,C.g,5); }
    if(D.fpv){ const x=cx+clamp(D.drift*ppd,-150,150), y=cy-D.gam*ppd+D.th*ppd*0-(D.gam-D.th)*ppd*0; const yy=cy-(D.gam-D.th)*ppd*-1; g.save(); g.translate(x,cy+(D.th-D.gam)*ppd); g.rotate(-D.phi*D2R); g.beginPath(); g.arc(0,0,14,0,7); g.strokeStyle=C.g; g.lineWidth=3; g.stroke(); L(g,-40,0,-14,0,C.g,3); L(g,14,0,40,0,C.g,3); L(g,0,-14,0,-30,C.g,3); g.restore(); }
    // aircraft symbol (fixed)
    g.fillStyle='#000'; g.strokeStyle=C.y; g.lineWidth=4;
    const wing=(s)=>{ g.beginPath(); g.moveTo(cx+s*165,cy-6); g.lineTo(cx+s*85,cy-6); g.lineTo(cx+s*85,cy+26); g.lineTo(cx+s*72,cy+26); g.lineTo(cx+s*72,cy+6); g.lineTo(cx+s*165,cy+6); g.closePath(); g.fill(); g.stroke(); };
    wing(-1); wing(1); FR(g,cx-7,cy-7,14,14,'#000'); R(g,cx-7,cy-7,14,14,C.y,4);
  }
  // sidestick order indicator (on the ground with an engine running): a white cross in its box
  if(D.stick&&att){ const s=110; g.strokeStyle=C.w; g.lineWidth=3; for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ L(g,cx+a*s,cy+b*s,cx+a*s*0.82,cy+b*s,C.w,3); L(g,cx+a*s,cy+b*s,cx+a*s,cy+b*s*0.82,C.w,3); }
    const x=cx+clamp(D.stick.x,-1,1)*s, y=cy+clamp(D.stick.y,-1,1)*s; L(g,x-22,y,x+22,y,C.w,4); L(g,x,y-22,x,y+22,C.w,4); }
  // ---- speed tape ----
  speedTape(g,D);
  altTape(g,D); vsScale(g,D); hdgTape(g,D);
  // ---- FMA ----
  fma(g,D);
  // ---- LS deviation scales ----
  if(D.ls){ // LOC (horizontal, below the attitude) and G/S (vertical, right of it)
    for(const k of [-2,-1,1,2]){ g.beginPath(); g.arc(cx+k*55,760,7,0,7); g.strokeStyle=C.w; g.lineWidth=3; g.stroke(); g.beginPath(); g.arc(680,cy+k*55,7,0,7); g.stroke(); }
    L(g,cx,748,cx,772,C.y,4); L(g,668,cy,692,cy,C.y,4);
    if(D.loc.valid){ const x=cx+clamp(D.loc.dev,-2.2,2.2)*55; g.beginPath(); g.moveTo(x-16,760); g.lineTo(x,748); g.lineTo(x+16,760); g.lineTo(x,772); g.closePath(); g.fillStyle=C.m; g.fill(); }
    if(D.gs.valid){ const y=cy-clamp(D.gs.dev,-2.2,2.2)*55; g.beginPath(); g.moveTo(668,y); g.lineTo(680,y-16); g.lineTo(692,y); g.lineTo(680,y+16); g.closePath(); g.fillStyle=C.m; g.fill(); }
    T(g,D.lsId||'IASN',30,850,C.m,28); T(g,D.lsFreq||'110.30',30,885,C.m,28); if(D.dme!=null) T(g,D.dme.toFixed(1)+'NM',30,920,C.m,28);
  }
  // radio altitude
  if(att&&D.ra<2500){ const s=D.ra<5?String(Math.round(D.ra)):D.ra<50?String(Math.round(D.ra)):D.ra<500?String(Math.round(D.ra/5)*5):String(Math.round(D.ra/10)*10); T(g,s,cx,cy+205,D.ra<D.dh?C.a:C.g,40,'center',700); }
  // ---- messages (amber or red on the attitude) ----
  if(D.pfdMsg) T(g,D.pfdMsg,cx,330,D.pfdMsgC||C.a,36,'center',700);
}
function speedTape(g,D){
  const x0=48,x1=178,top=185,bot=755,cy=470,ppk=4.6, v=Math.max(30,D.ias);
  FR(g,x0,top,x1-x0,bot-top,'#4b5866');
  if(!D.adrOK){ T(g,'SPD',113,cy,C.r,40,'center',700); return; }
  g.save(); g.beginPath(); g.rect(x0,top,x1-x0+30,bot-top); g.clip();
  for(let s=Math.floor((v-70)/10)*10;s<=v+70;s+=10){ if(s<30) continue; const y=cy-(s-v)*ppk; L(g,x1-18,y,x1,y,C.w,3); if(s%20===0) T(g,String(s).padStart(3,'0'),x1-24,y+11,C.w,32,'right'); }
  // VMAX barber pole (red / black)
  if(D.vmax){ const y=cy-(D.vmax-v)*ppk; for(let yy=y;yy>top-20;yy-=20){ FR(g,x1-2,yy-10,12,10,C.r); FR(g,x1-2,yy-20,12,10,'#000'); } }
  // α protection (amber / black) and α max (red)
  if(D.vaprot&&!D.gnd){ const y1=cy-(D.vaprot-v)*ppk, y2=cy-(D.vamax-v)*ppk; for(let yy=y1;yy<y2;yy+=20){ FR(g,x1-2,yy,12,10,C.a); FR(g,x1-2,yy+10,12,10,'#000'); } FR(g,x1-2,y2,12,bot-y2+20,C.r); }
  // VLS (amber strip)
  if(D.vls&&!D.gnd){ const y=cy-(D.vls-v)*ppk, y2=D.vaprot?cy-(D.vaprot-v)*ppk:y+200; L(g,x1+2,y,x1+2,y2,C.a,4); L(g,x1+2,y,x1+14,y,C.a,4); }
  // green dot, F, S, V1, VR/V2 marks
  const mk=(sp,f)=>{ if(sp==null) return; const y=cy-(sp-v)*ppk; if(y<top||y>bot) return; f(y); };
  if(!D.gnd) mk(D.gd&&D.conf===0?D.gd:null,y=>{ g.beginPath(); g.arc(x1+12,y,8,0,7); g.strokeStyle=C.g; g.lineWidth=4; g.stroke(); });
  if(D.conf>=2&&D.conf<=4) mk(D.F,y=>{ L(g,x1,y,x1+14,y,C.g,3); T(g,'F',x1+18,y+11,C.g,28); });
  if(D.conf===1||D.conf===2) mk(D.S,y=>{ L(g,x1,y,x1+14,y,C.g,3); T(g,'S',x1+18,y+11,C.g,28); });
  if(D.gnd&&D.v1) mk(D.v1,y=>T(g,'1',x1+6,y+11,C.c,30));
  if(D.gnd&&D.vr) mk(D.vr,y=>{ g.beginPath(); g.arc(x1+12,y,7,0,7); g.strokeStyle=C.c; g.lineWidth=3; g.stroke(); });
  // VFE next (amber =)
  if(D.vfeN&&!D.gnd&&D.alt<15000) mk(D.vfeN,y=>{ L(g,x1-10,y-4,x1+4,y-4,C.a,3); L(g,x1-10,y+4,x1+4,y+4,C.a,3); });
  // speed target (magenta managed, cyan selected)
  if(D.spdTgt!=null){ const y=cy-(D.spdTgt-v)*ppk; if(y>top&&y<bot){ tri(g,x1+14,y,13,'l',D.spdMan?C.c:C.m,false); } else T(g,String(Math.round(D.spdTgt)),113,y<top?top-6:bot+34,D.spdMan?C.c:C.m,30,'center'); }
  g.restore();
  // speed trend arrow (10 s)
  if(Math.abs(D.trend)>2&&!D.gnd){ const y=cy-D.trend*ppk; L(g,x1-2,cy,x1-2,y,C.y,4); tri(g,x1-2,y,8,D.trend>0?'u':'d',C.y,false); }
  // reference line (yellow)
  L(g,x0-10,cy,x1+8,cy,C.y,5); tri(g,x1+20,cy,14,'l',C.y,true);
  L(g,x0,top,x1,top,C.w,3); L(g,x0,bot,x1,bot,C.w,3);
  // Mach
  if(D.mach>0.5) T(g,'.'+String(Math.round(D.mach*1000)).padStart(3,'0').slice(0,3),113,800,C.g,32,'center');
}
function altTape(g,D){
  const x0=710,x1=815,top=185,bot=755,cy=470,ppf=0.2, a=D.alt;
  FR(g,x0,top,x1-x0,bot-top,'#4b5866');
  if(!D.adrOK){ T(g,'ALT',760,cy,C.r,40,'center',700); return; }
  g.save(); g.beginPath(); g.rect(x0-20,top,x1-x0+40,bot-top); g.clip();
  for(let s=Math.floor((a-1600)/100)*100;s<=a+1600;s+=100){ const y=cy-(s-a)*ppf; L(g,x0,y,x0+14,y,C.w,3); if(s%500===0) T(g,String(Math.abs(Math.round(s/100))).padStart(3,'0'),x0+20,y+11,C.w,30); }
  // selected altitude (cyan) on the tape
  const ys=cy-(D.selAlt-a)*ppf; if(ys>top&&ys<bot){ R(g,x0+2,ys-28,40,56,C.c,3); }
  // ground (landing elevation) ribbon
  if(D.ra<600){ const yg=cy+(D.ra)*ppf; FR(g,x0,yg,14,bot-yg,C.r); }
  g.restore();
  // selected altitude above / below the tape
  if(ys<=top) T(g,D.std?'FL'+Math.round(D.selAlt/100):String(D.selAlt),770,top-8,C.c,32,'center'); else if(ys>=bot) T(g,D.std?'FL'+Math.round(D.selAlt/100):String(D.selAlt),770,bot+36,C.c,32,'center');
  // drum window
  FR(g,x0-4,cy-36,118,72,'#000'); R(g,x0-4,cy-36,118,72,C.y,4);
  const hund=Math.floor(Math.abs(a)/100), rem=Math.abs(a)%100;
  T(g,String(hund).padStart(3,' '),x0+66,cy+14,D.altAlert?C.a:C.g,42,'right',700);
  g.save(); g.beginPath(); g.rect(x0+66,cy-34,44,68); g.clip();
  for(let k=-1;k<=1;k++){ const v=(Math.floor(rem/20)*20+k*20+100)%100, y=cy+14+((rem%20)/20)*30-k*30; T(g,String(v).padStart(2,'0'),x0+70,y,C.g,32,'left',700); }
  g.restore();
  L(g,x0-20,cy,x0,cy,C.y,5);
  // baro setting
  if(D.std){ R(g,720,795,100,44,C.y,3); T(g,'STD',770,830,C.c,34,'center'); } else { T(g,'QNH',700,830,C.w,28); T(g,String(D.qnh),790,830,C.c,32); }
}
function vsScale(g,D){
  const x=855, cy=470;
  FR(g,x,230,60,480,'#4b5866');
  const yOf=v=>{ const s=Math.sign(v), m=Math.abs(v); const d=m<=1000?m/1000*110:m<=2000?110+(m-1000)/1000*60:m<=6000?170+(m-2000)/4000*55:225; return cy-s*d; };
  for(const v of [-6000,-2000,-1000,-500,500,1000,2000,6000]){ const y=yOf(v); L(g,x,y,x+12,y,C.w,3); if(Math.abs(v)!==500&&Math.abs(v)!==6000) T(g,String(Math.abs(v)/1000),x+15,y+10,C.w,26); }
  L(g,x,cy,x+18,cy,C.y,4);
  if(!D.adrOK||!D.irOK){ T(g,'V/S',x+30,cy,C.r,30,'center',700); return; }
  const y=yOf(clamp(D.vs,-6000,6000)); const col=Math.abs(D.vs)>6000||(D.ra<1000&&D.vs<-2000)?C.a:C.g;
  L(g,x+60,cy,x+16,y,col,5);
  if(Math.abs(D.vs)>=200){ FR(g,x+6,y+(D.vs>0?-46:8),50,36,'#000'); T(g,String(Math.round(Math.abs(D.vs)/100)).padStart(2,'0'),x+31,y+(D.vs>0?-18:36),col,30,'center',700); }
}
function hdgTape(g,D){
  const cx=440, y0=800, ppd=9;
  FR(g,250,y0,380,70,'#4b5866');
  if(!D.irOK){ T(g,'HDG',cx,y0+48,C.r,40,'center',700); return; }
  g.save(); g.beginPath(); g.rect(250,y0,380,90); g.clip();
  for(let d=Math.floor((D.hdg-25)/5)*5;d<=D.hdg+25;d+=5){ const x=cx+w180(w360(d)-D.hdg)*ppd; L(g,x,y0,x,y0+(d%10===0?20:12),C.w,3); if(d%10===0){ const n=w360(d)/10; T(g,String(Math.round(n)===0?0:Math.round(n)),x,y0+52,C.w,(n%3===0)?34:28,'center'); } }
  // track diamond and selected heading
  const xt=cx+w180(D.trk-D.hdg)*ppd; g.beginPath(); g.moveTo(xt,y0+4); g.lineTo(xt+10,y0+16); g.lineTo(xt,y0+28); g.lineTo(xt-10,y0+16); g.closePath(); g.strokeStyle=C.g; g.lineWidth=3; g.stroke();
  if(D.selHdg!=null){ const xh=cx+w180(D.selHdg-D.hdg)*ppd; if(Math.abs(xh-cx)<185) tri(g,xh,y0+8,10,'d',C.c,false); else T(g,String(Math.round(D.selHdg)).padStart(3,'0'),xh<cx?280:600,y0-8,C.c,28,'center'); }
  if(D.ls&&D.loc) { const xc=cx+w180(D.lsCrs-D.hdg)*ppd; if(Math.abs(xc-cx)<185){ L(g,xc,y0+30,xc,y0+70,C.m,4); } }
  g.restore();
  L(g,cx,y0-14,cx,y0+24,C.y,5);
}
function fma(g,D){
  const F=D.fma||{}, ys=[42,84,126];
  for(const x of [195,395,590,785]) L(g,x,8,x,150,C.w,2);
  const box=(x,w,on)=>{ if(on) R(g,x+4,10,w-8,40,C.w,3); };
  const t=(s,x,row,col,al)=>{ if(s) T(g,s,x,ys[row],col||C.g,34,al||'center',600); };
  // col 1: A/THR
  if(F.thr){ const col=F.thr.startsWith('MAN')||F.thr==='A.FLOOR'||F.thr==='TOGA LK'?C.w:C.g; t(F.thr==='MAN FLX'?'MAN':F.thr==='MAN TOGA'?'MAN':F.thr==='MAN MCT'?'MAN':F.thr,97,0,col); if(F.thr==='MAN FLX'){ t('FLX '+(F.flx>0?'+'+F.flx:''),97,1,C.w); } if(F.thr==='MAN TOGA') t('TOGA',97,1,C.w); if(F.thr==='MAN MCT') t('MCT',97,1,C.w); box(0,195,F.boxThr); }
  if(F.lvr) t(F.lvr,97,2,C.w); else if(F.athrArmMsg) {}
  // col 2: vertical
  t(F.vert,295,0,C.g); if(F.vertArm) t(F.vertArm,295,1,C.c); box(195,200,F.boxVert);
  // col 3: lateral
  t(F.lat,492,0,C.g); if(F.latArm) t(F.latArm,492,1,C.c); box(395,195,F.boxLat);
  if(F.common) { g.fillStyle='#000'; FR(g,200,12,385,38,'#000'); t(F.common,392,0,C.g); }
  // col 4: approach capability and DH/MDA
  if(F.cat){ t(F.cat,687,0,C.w); if(F.cat2) t(F.cat2,687,1,C.w); }
  if(F.mins) T(g,F.mins,605,ys[2],C.w,28,'left');
  // col 5: AP / FD / A/THR
  t(F.ap,892,0,C.w); t(F.fd,892,1,C.w); t(F.athr,892,2,F.athrArm?C.c:C.w);
  if(F.msg) T(g,F.msg,392,ys[2],F.msgC||C.w,30,'center');
}

/* ================= ND ================= */
function nd(g,cv,D){
  begin(g,cv);
  if(!D.pwr) return dark(g);
  if(!D.irOK){ T(g,'HDG',500,480,C.r,46,'center',700); T(g,'MAP NOT AVAIL',500,560,C.r,34,'center'); return; }
  const mode=D.mode, rose=mode==='ROSE NAV'||mode==='ROSE ILS'||mode==='ROSE VOR', plan=mode==='PLAN';
  const cx=500, cy=rose||plan?500:820, R0=rose||plan?330:640;
  const up=plan?0:D.hdg;
  const ppm=R0/(D.range*1852);
  const toXY=(N,E)=>{ const dN=N-D.N, dE=E-D.E, a=-up*D2R, x=dE*Math.cos(a)+dN*Math.sin(a), y=-dE*Math.sin(a)+dN*Math.cos(a); return [cx+x*ppm,cy-y*ppm]; };
  g.save(); g.beginPath(); if(rose||plan) g.arc(cx,cy,R0+6,0,7); else { g.moveTo(cx,cy); g.arc(cx,cy,R0+10,-Math.PI/2-1.0,-Math.PI/2+1.0); g.closePath(); g.rect(0,cy-200,1000,200); } g.clip();
  // map: runway, ILS course, fixes, VOR, flight plan
  const rw=[toXY(0,0),toXY(D.rwyLen,0)]; L(g,rw[0][0],rw[0][1],rw[1][0],rw[1][1],C.w,Math.max(4,45*ppm));
  if(D.lsOn||mode==='ROSE ILS'){ const p1=toXY(0,0), p2=toXY(-18*1852,0); g.setLineDash([16,12]); L(g,p1[0],p1[1],p2[0],p2[1],C.m,3); g.setLineDash([]); }
  if(D.fixes){ for(const f of D.fixes){ const [x,y]=toXY(f.N,f.E); if(x<-50||x>1050||y<-50||y>1050) continue; const act=f.id===D.toWpt;
    if(f.vor){ g.strokeStyle=C.m; g.lineWidth=3; g.beginPath(); g.moveTo(x-12,y); g.lineTo(x+12,y); g.moveTo(x,y-12); g.lineTo(x,y+12); g.stroke(); if(D.filt.vord) T(g,f.id,x+16,y+26,C.m,26); continue; }
    if(!D.filt.wpt&&!f.fp) continue; g.save(); g.translate(x,y); g.rotate(Math.PI/4); R(g,-8,-8,16,16,f.fp?(act?C.w:C.g):C.m,3); g.restore(); T(g,f.id,x+16,y+26,f.fp?(act?C.w:C.g):C.m,26); } }
  if(D.fpln&&D.fpln.length>1){ g.strokeStyle=C.g; g.lineWidth=3; g.beginPath(); D.fpln.forEach((p,i)=>{ const [x,y]=toXY(p.N,p.E); i?g.lineTo(x,y):g.moveTo(x,y); }); g.stroke(); }
  // traffic would go here (TCAS); weather radar is off on the ground
  g.restore();
  // compass
  g.strokeStyle=C.w; g.lineWidth=3;
  if(rose||plan){ g.beginPath(); g.arc(cx,cy,R0,0,7); g.stroke(); g.setLineDash([10,14]); g.beginPath(); g.arc(cx,cy,R0/2,0,7); g.stroke(); g.setLineDash([]); }
  else { g.beginPath(); g.arc(cx,cy,R0,-Math.PI/2-0.9,-Math.PI/2+0.9); g.stroke(); g.setLineDash([10,14]); for(const f of [0.25,0.5,0.75]){ g.beginPath(); g.arc(cx,cy,R0*f,-Math.PI/2-0.9,-Math.PI/2+0.9); g.stroke(); } g.setLineDash([]); }
  if(!plan){
    for(let d=0;d<360;d+=5){ const a=(w360(d-D.hdg))*D2R; if(!(rose)&&Math.abs(w180(d-D.hdg))>52) continue; const r1=R0, r2=R0+(d%10===0?20:11), s=Math.sin(a), c=Math.cos(a); L(g,cx+s*r1,cy-c*r1,cx+s*r2,cy-c*r2,C.w,3);
      if(d%30===0){ g.save(); g.translate(cx+s*(R0+44),cy-c*(R0+44)); g.rotate(a); T(g,String(d/10),0,12,C.w,d%90===0?36:30,'center'); g.restore(); } }
    // lubber line, selected heading, track
    FR(g,cx-3,cy-R0-36,6,30,C.y);
    if(D.selHdg!=null){ const a=w180(D.selHdg-D.hdg)*D2R; if(rose||Math.abs(a)<0.92){ g.save(); g.translate(cx,cy); g.rotate(a); tri(g,0,-R0-14,12,'d',C.c,false); g.restore(); } }
    { const a=w180(D.trk-D.hdg)*D2R; g.save(); g.translate(cx,cy); g.rotate(a); g.beginPath(); g.moveTo(0,-R0+4); g.lineTo(9,-R0+18); g.lineTo(0,-R0+32); g.lineTo(-9,-R0+18); g.closePath(); g.strokeStyle=C.g; g.lineWidth=3; g.stroke(); g.restore(); }
    if(mode==='ROSE ILS'||D.lsOn){ const a=w180(D.lsCrs-D.hdg)*D2R; g.save(); g.translate(cx,cy); g.rotate(a); L(g,0,-R0+40,0,-R0*0.35,C.m,5); L(g,0,R0*0.35,0,R0-40,C.m,5); if(mode==='ROSE ILS'&&D.loc.valid){ const dx=clamp(D.loc.dev,-2.3,2.3)*60; L(g,dx,-R0*0.3,dx,R0*0.3,C.m,5); for(const k of [-2,-1,1,2]){ g.beginPath(); g.arc(k*60,0,7,0,7); g.strokeStyle=C.w; g.lineWidth=3; g.stroke(); } } g.restore(); }
  }
  // range labels
  if(!rose&&!plan){ T(g,String(D.range/2),cx-R0*0.5*0.7-20,cy-R0*0.5*0.75+10,C.c,24,'right'); }
  else T(g,String(D.range/2),cx-R0*0.5*0.71-14,cy-R0*0.5*0.71,C.c,24,'right');
  // aircraft symbol
  g.strokeStyle=C.y; g.lineWidth=5; L(g,cx-36,cy,cx+36,cy,C.y,6); L(g,cx,cy-22,cx,cy+50,C.y,6); L(g,cx-14,cy+38,cx+14,cy+38,C.y,6);
  // top left: GS / TAS / wind
  T(g,'GS',20,46,C.w,28); T(g,String(Math.round(D.gs)),66,46,C.g,34); T(g,'TAS',140,46,C.w,28); T(g,D.tas>60?String(Math.round(D.tas)):'---',198,46,C.g,34);
  if(D.tas>100){ T(g,String(Math.round(D.windDir)).padStart(3,'0')+'/'+String(Math.round(D.windSpd)).padStart(2,' '),20,86,C.g,32); if(D.windSpd>=2){ const a=w180(D.windDir+180-D.hdg)*D2R; g.save(); g.translate(46,140); g.rotate(a); L(g,0,-26,0,26,C.g,4); tri(g,0,26,9,'d',C.g,true); g.restore(); } }
  else T(g,'---/---',20,86,C.w,32);
  // top right: TO waypoint / LS
  if(mode==='ROSE ILS'){ T(g,'ILS1',830,46,C.w,30); T(g,D.lsFreq||'110.30',990,46,C.m,32,'right'); T(g,'CRS',830,86,C.w,30); T(g,String(D.lsCrs).padStart(3,'0')+'°',990,86,C.c,32,'right'); T(g,D.lsId||'IASN',990,126,C.m,32,'right'); }
  else if(D.toWpt){ T(g,D.toWpt,770,46,C.w,32); T(g,D.toBrg!=null?String(Math.round(D.toBrg)).padStart(3,'0')+'°':'',990,46,C.g,32,'right'); T(g,D.toDist!=null?D.toDist.toFixed(D.toDist<20?1:0)+' NM':'',990,86,C.g,32,'right'); }
  // mode messages
  if(D.ndMsg) T(g,D.ndMsg,500,900,C.g,30,'center');
  if(D.range&&mode!=='PLAN'&&D.selHdg==null){}
  // bottom: VOR / ADF pointers selection labels
  if(D.vor1) { T(g,'VOR1',20,940,C.w,28); T(g,D.vor1,20,980,C.g,28); }
  if(D.vor2) { T(g,'VOR2',990,940,C.w,28,'right'); T(g,D.vor2,990,980,C.g,28,'right'); }
}

/* ================= E/WD ================= */
function dial(g,cx,cy,r,v,min,max,red,amber,txt,col,cmd){
  const a0=-210*D2R+Math.PI/2, span=210*D2R, ang=x=>(-200+((clamp(x,min,max)-min)/(max-min))*200)*D2R;
  g.lineWidth=4; g.strokeStyle=C.w; g.beginPath(); g.arc(cx,cy,r,ang(min)-Math.PI/2+Math.PI/2*0,ang(red||max)); g.stroke();
  if(red!=null){ g.strokeStyle=C.r; g.lineWidth=6; g.beginPath(); g.arc(cx,cy,r,ang(red),ang(max)); g.stroke(); }
  if(v!=null&&isFinite(v)){ const a=ang(v); g.strokeStyle=col||C.g; g.lineWidth=5; L(g,cx+Math.cos(a)*r*0.15,cy+Math.sin(a)*r*0.15,cx+Math.cos(a)*(r+6),cy+Math.sin(a)*(r+6),col||C.g,6); }
  if(cmd!=null){ const a=ang(cmd); g.beginPath(); g.arc(cx+Math.cos(a)*(r+14),cy+Math.sin(a)*(r+14),6,0,7); g.strokeStyle=C.c; g.lineWidth=3; g.stroke(); }
  if(txt!=null){ R(g,cx+4,cy+6,r*0.95,r*0.55,C.gr,2); T(g,txt,cx+r*0.92,cy+r*0.5,col||C.g,40,'right',700); }
}
function ewd(g,cv,D){
  begin(g,cv);
  if(!D.pwr) return dark(g);
  const E=D.eng;
  // N1 and EGT dials
  for(let i=0;i<2;i++){ const e=E[i], x=i?590:230, avail=e.n2>2||e.run||(D.fadec&&D.fadec[i]);
    if(avail){ dial(g,x,120,95,e.n1,0,110,104.5,null,e.n1.toFixed(1),e.n1>104?C.r:C.g,D.n1Cmd?D.n1Cmd[i]:null);
      dial(g,x,325,72,e.egt,0,1100,1060,null,String(Math.round(e.egt)),e.egt>1060?C.r:e.egt>950?C.a:C.g);
      T(g,e.n2.toFixed(1),x+50,470,e.n2>2?C.g:C.a,38,'right',700); T(g,String(Math.round(e.ff/10)*10),x+50,520,C.g,38,'right',700);
      if(e.st>0&&e.st<4) T(g,'AVAIL'===''?'':'',x,250,C.g,28,'center');
      if(e.avail&&e.availT<10) R(g,x-70,200,140,40,C.g,2),T(g,'AVAIL',x,232,C.g,30,'center');
    } else { T(g,'XX',x+40,150,C.a,44,'right',700); T(g,'XX',x+30,350,C.a,44,'right',700); T(g,'XX',x+50,470,C.a,38,'right',700); T(g,'XX',x+50,520,C.a,38,'right',700); }
    if(e.rev>0.05) T(g,'REV',x,180,e.rev>0.9?C.g:C.a,34,'center',700); }
  T(g,'N1',410,110,C.w,30,'center'); T(g,'%',410,145,C.c,26,'center'); T(g,'EGT',410,320,C.w,30,'center'); T(g,'°C',410,352,C.c,26,'center');
  T(g,'N2',410,462,C.w,30,'center'); T(g,'%',410,492,C.c,26,'center'); T(g,'F.F',410,515,C.w,28,'center'); T(g,'KG/H',410,545,C.c,24,'center');
  // A/THR limit (top right) and FLX temp
  if(D.thrLim){ T(g,D.thrLim,790,60,C.c,30,'left'); T(g,D.thrLimN1!=null?D.thrLimN1.toFixed(1)+'%':'',980,60,C.g,30,'right'); }
  // FOB
  T(g,'FOB :',740,150,C.w,30); T(g,String(Math.round(D.fob/10)*10),940,150,C.g,36,'right',700); T(g,'KG',950,150,C.c,26);
  // slats / flaps
  slatFlap(g,D,760,280);
  // separation line
  L(g,20,570,980,570,C.w,3); L(g,610,590,610,980,C.w,3);
  // warnings, procedures, memos
  let y=620;
  const list=(D.alerts||[]).filter(a=>!a.clr);
  if(list.length){
    for(const a of list.slice(0,4)){ const col=a.lvl===3?C.r:C.a; T(g,a.title,25,y,col,32,'left',700); const tw=g.measureText(a.title).width; g.fillStyle=col; T(g,a.text,25+tw+14,y,col,32,'left',700); y+=40;
      for(const s of a.steps.slice(0,6)){ if(y>975) break; T(g,s[0],45,y,C.c,30); y+=36; } if(y>975) break; }
  } else if(D.memo&&D.memo.length){
    for(const [k,items] of D.memo){ T(g,k,25,y,C.w,32,'left',700); const ty=y; items.forEach((it,i)=>{ const yy=ty+i*40, parts=it.t.split(' '), lab=parts.slice(0,-1).join(' ')||it.t, val=parts.length>1?parts[parts.length-1]:'';
      if(it.ok) T(g,it.t,120,yy,C.g,30); else { T(g,lab,120,yy,C.c,30); if(val){ const w=g.measureText(lab).width; T(g,' '+'.'.repeat(Math.max(2,18-lab.length))+val,120+w,yy,C.c,30); } } }); }
  }
  // right memo
  let yr=620; for(const r of (D.memoR||[]).slice(0,9)){ T(g,r.t,630,yr,r.c==='a'?C.a:C.g,30); yr+=40; }
  if(list.length>4||D.stsRem) T(g,'↓',600,985,C.g,28,'center');
}
function slatFlap(g,D,x,y){
  const s=D.slat/27, f=D.flap/35;
  T(g,'S',x-110,y-30,C.w,30); T(g,'F',x+150,y-30,C.w,30);
  // slat (left) and flap (right) tracks
  for(const k of [0,0.5,0.67,1]) { g.fillStyle=C.w; g.beginPath(); g.arc(x-20-k*120,y+k*36,4,0,7); g.fill(); }
  for(const k of [0,0.29,0.43,0.57,1]){ g.fillStyle=C.w; g.beginPath(); g.arc(x+40+k*130,y+k*40,4,0,7); g.fill(); }
  L(g,x-20,y-8,x+40,y-8,C.w,3);
  const moving=D.flapMoving;
  if(D.slat>0.2||D.flap>0.2||moving){ L(g,x-20,y,x-20-s*120,y+s*36,moving?C.c:C.g,7); L(g,x+40,y,x+40+f*130,y+f*40,moving?C.c:C.g,7); }
  const lab=D.confTxt; if(lab) T(g,lab,x+10,y+90,moving?C.c:C.g,34,'center',700);
}

/* ================= SD ================= */
function sd(g,cv,D){
  begin(g,cv);
  if(!D.pwr) return dark(g);
  const p=D.page;
  (PAGES[p]||PAGES.door)(g,D);
  // permanent data
  L(g,0,860,1000,860,C.w,2);
  T(g,'TAT',20,905,C.w,28); T(g,(D.tat>=0?'+':'')+Math.round(D.tat),150,905,C.g,30,'right'); T(g,'°C',160,905,C.c,24);
  T(g,'SAT',20,950,C.w,28); T(g,(D.sat>=0?'+':'')+Math.round(D.sat),150,950,C.g,30,'right'); T(g,'°C',160,950,C.c,24);
  T(g,D.utc||'',500,935,C.g,36,'center'); T(g,'H',560,935,C.c,26);
  T(g,'GW',700,925,C.w,28); T(g,D.gwOK?String(Math.round(D.gw/100)*100):'---',930,925,C.g,32,'right'); T(g,'KG',940,925,C.c,24);
}
const title=(g,t,x)=>{ T(g,t,x||20,50,C.w,36,'left',700); L(g,x||20,58,(x||20)+g.measureText(t).width,58,C.w,3); };
const valveC=(g,x,y,open,col,vert)=>{ g.beginPath(); g.arc(x,y,24,0,7); g.strokeStyle=col||C.g; g.lineWidth=4; g.stroke(); if(open===vert) L(g,x-24,y,x+24,y,col||C.g,4); else L(g,x,y-24,x,y+24,col||C.g,4); };
const PAGES={
  eng(g,D){ title(g,'ENGINE');
    const lab=(t,y,u)=>{ T(g,t,500,y,C.w,28,'center'); if(u) T(g,u,500,y+30,C.c,22,'center'); };
    lab('F.USED',130,'KG'); lab('OIL',260,'QT'); lab('PSI',420); lab('°C',500); lab('VIB N1',600); lab('VIB N2',660);
    for(let i=0;i<2;i++){ const e=D.eng[i], x=i?720:280;
      T(g,String(Math.round(D.fused[i]/10)*10),x,150,C.g,34,'center',700);
      T(g,e.oilQ.toFixed(1),x,280,C.g,36,'center',700);
      T(g,String(Math.round(e.oilP)),x,430,e.run&&e.oilP<13?C.r:C.g,34,'center',700); T(g,String(Math.round(e.oilT)),x,510,C.g,34,'center',700);
      T(g,(e.run?0.8:0).toFixed(1),x,610,C.g,30,'center'); T(g,(e.run?0.9:0).toFixed(1),x,670,C.g,30,'center');
      if(D.showStart){ valveC(g,x,760,e.startV,e.startV?C.g:C.g,false); T(g,String(Math.round(D.duct[i])),x,830,C.g,30,'center'); T(g,(e.ignA?'A':'')+(e.ignB?'B':''),x+(i?80:-80),770,C.g,32,'center'); }
    }
    if(D.showStart){ T(g,'IGN',500,770,C.w,28,'center'); T(g,'PSI',500,830,C.c,22,'center'); }
  },
  bleed(g,D){ title(g,'BLEED');
    const X=D.air;
    for(let i=0;i<2;i++){ const x=i?750:250, p=D.duct[i];
      T(g,String(Math.round(p)),x,500,p<4?C.a:C.g,34,'center',700); T(g,'PSI',x,535,C.c,22,'center');
      valveC(g,x,600,X['v'+(i+1)],C.g,true); T(g,'IP',x-60,700,C.w,26,'center'); T(g,'HP',x+60,700,C.w,26,'center'); L(g,x,624,x,680,C.g,3);
      L(g,x,476,x,330,C.g,3);
      R(g,x-70,250,140,80,C.w,2); T(g,'PACK '+(i+1),x,240,C.w,28,'center'); T(g,X['pk'+(i+1)]>0.1?'':'',x,280,C.g,28,'center');
      T(g,String(Math.round(X['pk'+(i+1)]>0.1?18:0)),x,305,C.g,30,'center'); valveC(g,x,370,X['pk'+(i+1)]>0.1,X['pk'+(i+1)]>0.1?C.g:(D.sw['pk'+(i+1)]?C.a:C.g),false);
      T(g,'ENG',x,780,C.w,30,'center'); T(g,String(i+1),x,820,C.w,34,'center'); }
    // X bleed and APU
    L(g,250,430,750,430,C.g,3); valveC(g,500,430,X.xbo,C.g,true); T(g,'X BLEED',500,395,C.w,24,'center');
    L(g,420,430,420,560,C.g,3); valveC(g,420,600,D.apu.bleedOn,C.g,false); T(g,'APU',420,680,C.w,28,'center');
    T(g,'RAM AIR',500,170,C.w,26,'center'); valveC(g,500,210,D.sw.ram,C.g,true);
  },
  press(g,D){ title(g,'CAB PRESS');
    T(g,'LDG ELEV AUTO',460,50,C.g,30); T(g,String(Math.round(D.elev||0)),880,50,C.g,32,'right'); T(g,'FT',890,50,C.c,22);
    const a=D.air; T(g,'ΔP',150,150,C.w,30,'center'); T(g,a.dp.toFixed(1),150,250,a.dp>8.5?C.a:C.g,40,'center',700); T(g,'PSI',150,290,C.c,24,'center');
    T(g,'V/S',450,150,C.w,30,'center'); T(g,String(Math.round(a.cabVs/50)*50),450,250,Math.abs(a.cabVs)>1750?C.a:C.g,40,'center',700); T(g,'FT/MIN',450,290,C.c,24,'center');
    T(g,'CAB ALT',780,150,C.w,30,'center'); T(g,String(Math.round(a.cab/50)*50),780,250,a.cab>9550?C.r:C.g,40,'center',700); T(g,'FT',780,290,C.c,24,'center');
    T(g,'SYS 1',220,400,C.g,30,'center'); T(g,'MAN',520,400,D.sw.pressMode?'#000':C.g,30,'center');
    T(g,'OUTFLOW',780,480,C.w,26,'center'); const ang=(-90+a.ofv*0.9)*D2R; L(g,780,620,780+Math.cos(ang)*90,620+Math.sin(ang)*90,a.ofv>95&&!D.gnd?C.a:C.g,6);
    for(let i=0;i<2;i++){ T(g,'PACK '+(i+1),i?620:180,760,a['pk'+(i+1)]>0.1?C.w:C.a,28,'center'); }
    T(g,'VENT',400,680,C.w,26,'center'); T(g,'INLET',330,720,C.w,22,'center'); T(g,'EXTRACT',470,720,C.w,22,'center');
  },
  elec(g,D){ title(g,'ELEC');
    const B=D.bus, src=D.src;
    const box=(x,y,w,t,on,col)=>{ R(g,x,y,w,46,C.gr,2); T(g,t,x+w/2,y+35,on?(col||C.g):C.a,30,'center',700); };
    // batteries
    for(let i=0;i<2;i++){ const x=i?720:120; R(g,x,80,170,110,C.w,2); T(g,'BAT '+(i+1),x+85,110,C.w,28,'center'); T(g,D.batV[i].toFixed(0),x+105,145,D.batV[i]<25.5?C.a:C.g,30,'right'); T(g,'V',x+110,145,C.c,22); T(g,String(Math.round(Math.abs(D.batA[i]))),x+105,180,C.g,30,'right'); T(g,'A',x+110,180,C.c,22);
      if(D.batCtc[i]) L(g,x+85,190,x+85,250,C.g,3), tri(g,x+85,D.batA[i]>0?200:240,10,D.batA[i]>0?'u':'d',D.batA[i]>0?C.g:C.a,true); }
    box(30,250,200,'DC 1',B.dc1); box(400,250,200,'DC BAT',B.dcBat); box(770,250,200,'DC 2',B.dc2);
    box(400,350,200,'DC ESS',B.dcEss);
    box(30,450,200,'AC 1',B.ac1); box(400,450,200,'AC ESS',B.acEss); box(770,450,200,'AC 2',B.ac2);
    if(B.dc1&&B.dcBat) L(g,230,273,400,273,C.g,3); if(B.dc2&&B.dcBat&&!B.dc1) L(g,600,273,770,273,C.g,3);
    // TRs
    for(const [x,t,on] of [[60,'TR 1',B.ac1],[860,'TR 2',B.ac2]]){ R(g,x,330,100,90,C.w,2); T(g,t,x+50,360,C.w,26,'center'); T(g,on?'28':'0',x+60,390,C.g,26,'right'); T(g,'V',x+64,390,C.c,20); T(g,on?'60':'0',x+60,415,C.g,26,'right'); T(g,'A',x+64,415,C.c,20); }
    if(B.ac1) L(g,130,450,130,420,C.g,3); if(B.ac2) L(g,890,450,890,420,C.g,3);
    if(B.ac1&&src.acEss==='AC 1') L(g,230,473,400,473,C.g,3); if(B.ac2&&src.acEss==='AC 2') L(g,600,473,770,473,C.g,3);
    if(src.acEss==='STAT INV'||src.acEss==='EMER GEN') T(g,src.acEss,500,540,C.g,26,'center');
    // generators
    const gen=(x,t,on,v,hz,ld,avail,off)=>{ R(g,x,620,170,150,C.w,2); T(g,t,x+85,655,off?C.w:(on?C.w:C.a),28,'center'); if(off){ T(g,'OFF',x+85,700,C.w,28,'center'); return; } if(!avail){ T(g,'',x,0,C.w,1); return; }
      T(g,String(ld),x+110,700,C.g,28,'right'); T(g,'%',x+114,700,C.c,20); T(g,String(v),x+110,730,C.g,28,'right'); T(g,'V',x+114,730,C.c,20); T(g,String(hz),x+110,760,C.g,28,'right'); T(g,'HZ',x+114,760,C.c,20); };
    gen(30,'GEN 1',D.gen[0].on,D.gen[0].v,D.gen[0].hz,D.gen[0].load,D.gen[0].avail||D.gen[0].on,!D.sw.gen1);
    gen(800,'GEN 2',D.gen[1].on,D.gen[1].v,D.gen[1].hz,D.gen[1].load,D.gen[1].avail||D.gen[1].on,!D.sw.gen2);
    if(D.apu.n>5||D.apu.avail){ gen(320,'APU GEN',D.apuAv,D.apuAv?115:0,D.apuAv?400:0,D.apuGenLoad,true,!D.sw.apuGen); } else { T(g,'APU GEN',405,655,C.w,28,'center'); }
    if(D.gpu){ R(g,520,620,170,110,C.w,2); T(g,'EXT PWR',605,655,C.w,28,'center'); T(g,'115',630,700,C.g,28,'right'); T(g,'V',634,700,C.c,20); T(g,'400',630,725,C.g,28,'right'); T(g,'HZ',634,725,C.c,20); }
    if(src.ac1==='GEN 1') L(g,130,620,130,496,C.g,3); if(src.ac2==='GEN 2') L(g,890,620,890,496,C.g,3);
    if(src.ac1==='EXT PWR'||src.ac1==='APU GEN'||src.ac2==='EXT PWR'||src.ac2==='APU GEN'||src.ac1==='GEN 2'||src.ac2==='GEN 1'){ L(g,130,580,890,580,C.g,3); if(src.ac1!=='GEN 1') L(g,130,580,130,496,C.g,3); if(src.ac2!=='GEN 2') L(g,890,580,890,496,C.g,3); if(D.extOn) L(g,605,620,605,580,C.g,3); else if(D.apuAv&&!D.extOn) L(g,405,620,405,580,C.g,3); }
    T(g,'IDG 1',90,820,D.idgOK[0]?C.w:C.a,26,'center'); T(g,String(Math.round(D.idgT[0])),180,820,C.g,26,'center'); T(g,'IDG 2',850,820,D.idgOK[1]?C.w:C.a,26,'center'); T(g,String(Math.round(D.idgT[1])),940,820,C.g,26,'center');
    if(!D.sw.galy||!B.galy) T(g,'GALLEY SHED',500,820,C.w,26,'center');
  },
  hyd(g,D){ title(g,'HYD');
    const H=D.hyd, cols=[['GREEN',200,H.g,H.qg,14.5],['BLUE',500,H.b,H.qb,6.5],['YELLOW',800,H.y,H.qy,12.5]];
    for(const [n,x,p,q,qm] of cols){ const ok=p>1450; R(g,x-80,90,160,50,C.w,2); T(g,n,x,128,ok?C.w:C.a,30,'center',700); T(g,String(Math.round(p/50)*50),x,190,ok?C.g:C.a,38,'center',700); L(g,x,200,x,560,ok?C.g:C.a,4); tri(g,x,210,14,'u',ok?C.g:C.a,true);
      // reservoir
      L(g,x,620,x,800,C.w,3); FR(g,x-6,800-q/qm*180,12,q/qm*180,C.g); T(g,'RSVR',x+40,830,C.w,22,'center'); }
    // pumps
    const pump=(x,y,on,lbl,sel)=>{ R(g,x-40,y-40,80,80,on?C.g:C.a,3); if(on) L(g,x,y-40,x,y+40,C.g,4); else if(sel) L(g,x-30,y,x+30,y,C.a,4); else T(g,'OFF',x,y+10,C.a,24,'center'); if(lbl) T(g,lbl,x,y+70,C.w,26,'center'); };
    pump(200,420,H.edp[0],'1',D.sw.hyE1); pump(800,420,H.edp[1],'2',D.sw.hyE2);
    pump(500,420,H.bluePump,'ELEC',D.sw.hyB);
    // yellow elec pump, PTU
    T(g,'ELEC',920,330,C.w,24,'center'); R(g,890,350,60,40,H.yPump?C.g:C.w,2); if(H.yPump) tri(g,880,370,10,'l',C.g,true);
    T(g,'PTU',500,290,C.w,28,'center'); L(g,200,280,440,280,H.ptu?C.g:C.w,3); L(g,560,280,800,280,H.ptu?C.g:C.w,3); if(H.ptu){ tri(g,440,280,10,'r',C.g,true); tri(g,560,280,10,'l',C.g,true); }
    if(H.rat) { T(g,'RAT',500,620,C.g,30,'center'); }
  },
  fuel(g,D){ title(g,'FUEL');
    const F=D.fuel;
    T(g,'F.USED',500,60,C.w,26,'center'); T(g,'1+2',500,92,C.w,24,'center'); T(g,String(Math.round((D.fused[0]+D.fused[1])/10)*10),500,130,C.g,34,'center',700); T(g,'KG',560,130,C.c,22);
    T(g,'ENG 1',200,90,C.w,28,'center'); T(g,'ENG 2',800,90,C.w,28,'center'); T(g,'APU',500,200,D.apu.n>5?C.g:C.w,26,'center');
    // wing outline
    g.strokeStyle=C.w; g.lineWidth=3; g.beginPath(); g.moveTo(30,520); g.lineTo(380,360); g.lineTo(620,360); g.lineTo(970,520); g.lineTo(970,580); g.lineTo(620,470); g.lineTo(380,470); g.lineTo(30,580); g.closePath(); g.stroke();
    L(g,170,460,170,580,C.w,2); L(g,380,360,380,470,C.w,2); L(g,620,360,620,470,C.w,2); L(g,830,460,830,580,C.w,2);
    T(g,String(Math.round(F.lo/10)*10),100,540,C.g,32,'center',700); T(g,String(Math.round(F.li/10)*10),270,450,C.g,34,'center',700); T(g,String(Math.round(F.c/10)*10),500,430,C.g,34,'center',700); T(g,String(Math.round(F.ri/10)*10),730,450,C.g,34,'center',700); T(g,String(Math.round(F.ro/10)*10),900,540,C.g,32,'center',700);
    // pumps
    const pp=(x,y,on,sw)=>{ R(g,x-22,y-22,44,44,on?C.g:C.a,3); if(on) L(g,x,y-22,x,y+22,C.g,4); else L(g,x-16,y,x+16,y,C.a,4); };
    pp(230,330,D.sw.fL1&&D.bus.ac1); pp(310,330,D.sw.fL2&&D.bus.ac2); pp(450,330,F.ctrRun&&D.sw.fC1); pp(550,330,F.ctrRun&&D.sw.fC2); pp(690,330,D.sw.fR1&&D.bus.ac1); pp(770,330,D.sw.fR2&&D.bus.ac2);
    L(g,200,110,200,250,C.g,3); L(g,800,110,800,250,C.g,3); L(g,200,250,800,250,D.sw.fX?C.g:'#000',3); valveC(g,500,250,D.sw.fX,D.sw.fX?C.g:C.g,true);
    T(g,'FOB',60,760,C.w,30); T(g,String(Math.round(F.fob/10)*10),330,760,C.g,38,'right',700); T(g,'KG',340,760,C.c,24);
    if(F.mode==='man') T(g,'MAN',500,620,C.a,26,'center');
    T(g,'°C',880,760,C.c,22);
  },
  apu(g,D){ title(g,'APU');
    const P=D.apu;
    R(g,80,90,220,170,C.w,2); T(g,'APU GEN',190,125,C.w,28,'center');
    if(P.avail){ T(g,String(D.apuGenLoad),230,170,C.g,30,'right'); T(g,'%',240,170,C.c,22); T(g,'115',230,205,C.g,30,'right'); T(g,'V',240,205,C.c,22); T(g,'400',230,240,C.g,30,'right'); T(g,'HZ',240,240,C.c,22); }
    if(P.avail) T(g,'AVAIL',500,140,C.g,36,'center',700);
    T(g,'APU BLEED',780,125,C.w,28,'center'); R(g,680,90,200,80,C.w,2); T(g,String(Math.round(D.air.pa||0)),790,160,C.g,32,'right'); T(g,'PSI',800,160,C.c,22); valveC(g,780,240,P.bleedOn,C.g,false);
    dial(g,280,470,110,P.n,0,110,107,null,String(Math.round(P.n)),C.g); T(g,'N',120,520,C.w,30,'center'); T(g,'%',120,550,C.c,24,'center');
    dial(g,280,710,110,P.egt,300,1100,900,null,String(Math.round(P.egt/5)*5),C.g); T(g,'EGT',120,760,C.w,30,'center'); T(g,'°C',120,790,C.c,24,'center');
    T(g,'FLAP '+(P.flap>0.98?'OPEN':(P.flap<0.02?'':'')),800,520,P.flap>0.98?C.g:C.w,30,'center');
    if(P.st===2&&P.n<5) T(g,'',0,0,C.w,1);
    if(P.fault) T(g,'FUEL LO PR',800,600,C.a,30,'center');
  },
  cond(g,D){ title(g,'COND'); T(g,'TEMP:',650,50,C.w,28); T(g,'°C',880,50,C.c,22);
    const A=D.air; const z=(x,n,t,d)=>{ T(g,n,x,230,C.w,30,'center'); T(g,String(Math.round(t)),x,290,C.g,36,'center',700); T(g,String(Math.round(d)),x,560,C.g,30,'center'); };
    g.strokeStyle=C.w; g.lineWidth=3; g.beginPath(); g.moveTo(60,330); g.quadraticCurveTo(80,170,200,170); g.lineTo(940,170); g.lineTo(940,330); g.stroke();
    z(180,'CKPT',A.tCk,A.duct[0]); z(450,'FWD',A.tFwd,A.duct[1]); z(750,'AFT',A.tAft,A.duct[2]);
    T(g,'HOT AIR',500,700,C.w,26,'center'); valveC(g,500,760,D.sw.hotAir&&(A.pk1>0.1||A.pk2>0.1),C.g,true);
  },
  door(g,D){ title(g,'DOOR/OXY');
    g.strokeStyle=C.w; g.lineWidth=3; g.beginPath(); g.moveTo(500,120); g.quadraticCurveTo(410,160,410,260); g.lineTo(410,760); g.lineTo(470,820); g.lineTo(530,820); g.lineTo(590,760); g.lineTo(590,260); g.quadraticCurveTo(590,160,500,120); g.stroke();
    const door=(x,y,open,lbl,al)=>{ R(g,x-12,y-22,24,44,open?C.a:C.g,3); if(open) T(g,lbl,x+(al==='r'?30:-30),y+10,C.a,24,al==='r'?'left':'right'); };
    door(410,250,D.doors.fwdL,'CABIN','l'); door(590,250,false,'',''); door(410,720,false,'',''); door(590,720,false,'','');
    door(590,400,D.doors.cargoF,'CARGO','r'); door(590,620,D.doors.cargoA,'CARGO','r');
    T(g,'OXY',760,120,C.w,30); T(g,'1850',900,120,C.g,32,'right'); T(g,'PSI',910,120,C.c,22);
    if(!D.sw.crewOxy) T(g,'REGUL LO PR',760,170,C.a,26);
    T(g,'SLIDE',230,300,C.w,24,'center');
  },
  wheel(g,D){ title(g,'WHEEL');
    const gear=D.gear, dn=gear>0.99, up=gear<0.01;
    const leg=(x,y)=>{ if(up&&D.gearLv===0) return; const col=dn?C.g:C.r; g.strokeStyle=col; g.lineWidth=4; g.beginPath(); g.moveTo(x-30,y-30); g.lineTo(x+30,y-30); g.lineTo(x,y+20); g.closePath(); if(dn) { g.fillStyle=C.g; g.fill(); } else g.stroke(); };
    leg(500,170); leg(250,400); leg(750,400);
    if(D.gearLv===1&&!dn||D.gearLv===0&&!up) T(g,'UNLK',500,240,C.r,26,'center');
    T(g,'BRAKES',500,520,C.w,30,'center'); if(D.autoBrk) T(g,'AUTO BRK',500,580,C.g,28,'center'),T(g,['','LO','MED','MAX'][D.autoBrk],500,615,C.g,28,'center');
    for(let i=0;i<4;i++){ const x=[120,320,680,880][i]; T(g,String(Math.round(D.brkT[i]/5)*5),x,560,D.brkT[i]>300?C.a:C.g,32,'center',700); T(g,'°C',x,600,C.c,22,'center'); T(g,'REL',x,660,C.w,22,'center'); T(g,String(i+1),x,700,C.w,26,'center'); }
    T(g,'NORM BRK',500,700,D.hyd.g>1450?C.g:C.a,26,'center');
    // spoilers
    for(let i=0;i<5;i++){ const xl=420-i*60, xr=580+i*60; for(const x of [xl,xr]){ tri(g,x,80,12,D.sp>0.1?'u':'u',C.g,D.sp>0.1); } }
  },
  fctl(g,D){ title(g,'F/CTL');
    T(g,'PITCH TRIM',500,330,C.w,26,'center'); T(g,(D.ths>=0?D.ths.toFixed(1):(-D.ths).toFixed(1))+'°',500,370,C.g,32,'center'); T(g,D.ths>=0?'UP':'DN',560,370,C.g,24);
    const surf=(x,y,v,lbl)=>{ L(g,x,y-90,x,y+90,C.w,3); tri(g,x+(x<500?14:-14),y-clamp(v,-1,1)*80,10,x<500?'l':'r',C.g,true); T(g,lbl,x,y+130,C.w,24,'center'); };
    surf(150,560,D.ail,'L AIL'); surf(850,560,-D.ail,'R AIL'); surf(300,690,D.elev,'L ELEV'); surf(700,690,D.elev,'R ELEV');
    T(g,'RUD',500,600,C.w,26,'center'); L(g,420,700,580,700,C.w,3); tri(g,500+clamp(D.rud,-1,1)*70,720,10,'u',C.g,true);
    T(g,'ELAC',220,200,C.w,26,'center'); T(g,'SEC',780,200,C.w,26,'center');
    D.elac.forEach((o,i)=>{ R(g,170+i*60,215,44,44,o?C.g:C.a,2); T(g,String(i+1),192+i*60,248,o?C.g:C.a,28,'center'); });
    D.sec.forEach((o,i)=>{ R(g,700+i*60,215,44,44,o?C.g:C.a,2); T(g,String(i+1),722+i*60,248,o?C.g:C.a,28,'center'); });
    for(const [lbl,x,p] of [['G',420,D.hyd.g],['B',500,D.hyd.b],['Y',580,D.hyd.y]]) T(g,lbl,x,120,p>1450?C.g:C.a,30,'center',700);
    if(D.law!=='NORMAL') T(g,D.law+' LAW',500,450,C.a,30,'center');
  },
  crz(g,D){ title(g,'CRUISE',380);
    T(g,'ENG',40,120,C.g,30); T(g,'F.USED',500,120,C.w,26,'center'); T(g,String(Math.round(D.fused[0]/10)*10),300,160,C.g,32,'center',700); T(g,String(Math.round(D.fused[1]/10)*10),700,160,C.g,32,'center',700); T(g,'KG',500,160,C.c,22,'center');
    T(g,'OIL',500,230,C.w,26,'center'); T(g,D.eng[0].oilQ.toFixed(1),300,270,C.g,32,'center',700); T(g,D.eng[1].oilQ.toFixed(1),700,270,C.g,32,'center',700); T(g,'QT',500,270,C.c,22,'center');
    T(g,'AIR',40,420,C.g,30); const a=D.air; T(g,'LDG ELEV AUTO',300,420,C.g,26); T(g,String(Math.round(D.elev||0)),880,420,C.g,30,'right');
    T(g,'ΔP',650,500,C.w,26); T(g,a.dp.toFixed(1),830,500,C.g,32,'right'); T(g,'PSI',840,500,C.c,22);
    T(g,'CAB V/S',650,560,C.w,26); T(g,String(Math.round(a.cabVs/50)*50),830,560,C.g,32,'right');
    T(g,'CAB ALT',650,620,C.w,26); T(g,String(Math.round(a.cab/50)*50),830,620,C.g,32,'right');
    T(g,'CKPT '+Math.round(a.tCk)+'°C',40,560,C.g,28); T(g,'FWD '+Math.round(a.tFwd)+'°C',40,610,C.g,28); T(g,'AFT '+Math.round(a.tAft)+'°C',40,660,C.g,28);
  },
  sts(g,D){ title(g,'STATUS');
    let y=120; const lim=[], inop=[];
    (D.alerts||[]).forEach(a=>{ if(a.lvl>=2) inop.push(a.title+' '+a.text); });
    if(D.law!=='NORMAL') lim.push('MAX SPD.............320 KT');
    if(!inop.length&&!lim.length){ T(g,'NORMAL',500,420,C.g,40,'center',700); return; }
    lim.forEach(t=>{ T(g,t,30,y,C.c,30); y+=40; });
    T(g,'INOP SYS',620,120,C.a,30,'left',700); inop.slice(0,12).forEach((t,i)=>T(g,t.replace(/^(ELEC|HYD|FUEL|AIR|F\/CTL|NAV) /,'$1 '),620,165+i*38,C.a,24));
  }
};

/* ================= ISIS (standby) ================= */
function isis(g,cv,D){
  begin(g,cv);
  if(!D.pwrIsis) return dark(g);
  const cx=500, cy=520, ppd=11;
  g.save(); g.beginPath(); g.rect(200,150,600,700); g.clip();
  g.translate(cx,cy); g.rotate(-D.phi*D2R); const off=D.th*ppd;
  FR(g,-800,-1400+off,1600,1400,C.sky); FR(g,-800,off,1600,1400,C.gnd); L(g,-800,off,800,off,C.w,4);
  for(let p=-20;p<=20;p+=5){ if(!p) continue; const y=off-p*ppd; L(g,-(p%10?30:70),y,(p%10?30:70),y,C.w,4); }
  g.restore();
  L(g,cx-150,cy,cx-60,cy,C.y,10); L(g,cx+60,cy,cx+150,cy,C.y,10); FR(g,cx-8,cy-8,16,16,C.y);
  // speed (left) and altitude (right) as numbers on tapes
  FR(g,0,150,190,700,'#3c4650'); FR(g,810,150,190,700,'#3c4650');
  T(g,String(Math.round(Math.max(30,D.ias))),150,cy+18,C.w,58,'right',700); T(g,String(Math.round(D.alt/10)*10),990,cy+18,C.w,50,'right',700);
  L(g,0,cy,190,cy,C.y,5); L(g,810,cy,1000,cy,C.y,5);
  T(g,String(D.qnh)+' HPA',500,960,C.c,44,'center');
  if(D.mach>0.45) T(g,'M.'+String(Math.round(D.mach*100)).padStart(2,'0'),100,120,C.w,44,'center');
}

/* ================= MCDU ================= */
function mcdu(g,cv,D){
  begin(g,cv);
  if(!D.pwr){ return dark(g); }
  const P=D.mcdu; if(!P) return;
  // 14 lines × 24 characters: title, 6 pairs of label/data lines, scratchpad
  const cw=1000/24.5, x0=12, lh=[70,128,186,244,302,360,418,476,534,592,650,708,766,850];
  const put=(row,txt,col,al,size)=>{ if(!txt) return; F(g,size||(row%2&&row<13?40:52),600); g.fillStyle=col||C.w; g.textAlign='left';
    const s=String(txt); let x=al==='r'?1000-x0-s.length*cw:al==='c'?(1000-s.length*cw)/2:x0; for(let i=0;i<s.length;i++){ g.fillText(s[i],x+i*cw,lh[row]); } };
  put(0,P.title,P.titleC||C.w,'c');
  if(P.page) T(g,P.page,980,lh[0],C.w,40,'right');
  (P.lines||[]).forEach(l=>{ if(!l) return; put(l[0],l[1],l[2],l[3],l[4]); });
  put(13,P.scratch||'',P.scratchC||C.w,'l');
  if(P.arrows) T(g,'←→',980,lh[13],C.w,40,'right');
}

G.A320DISP={pfd,nd,ewd,sd,isis,mcdu,C,PAGES:Object.keys(PAGES)};
})(typeof window!=='undefined'?window:globalThis);
