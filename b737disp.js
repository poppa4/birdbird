/* NORDAP – Boeing 737-800 cockpit displays (b737.html): PFD, ND, upper DU (primary engine indications and fuel), lower DU
   (secondary engine indications, hydraulics), CDU screen, flap position indicator and the landing gear lights.
   Our own drawing of the 737NG display formats as the FCOM describes them; every display draws into a 1000-wide box (height
   1000 × the screen's aspect). Called only when on screen and at its own rate by the page. Colours as on the aircraft: white
   = current values and scales, magenta = targets / FMC, green = engaged modes and references, cyan = selectable data and
   armed, amber = cautions, red = warnings and limits. */
(function(G){
'use strict';
const D2R=Math.PI/180, C={g:'#3dff4e',c:'#38e8ff',a:'#ffb21a',r:'#ff2a22',m:'#ff4cff',w:'#ffffff',k:'#000',gr:'#4c525c',sky:'#2e8fe0',gnd:'#9a5a22',y:'#fff23a',dim:'#7c8590'};
const clamp=(x,a,b)=>x<a?a:x>b?b:x, w360=a=>{ a%=360; return a<0?a+360:a; }, w180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const FONT='Archivo,"Archivo fb",Arial,sans-serif', MONO='"IBM Plex Mono","DejaVu Sans Mono",monospace';
function F(g,px,w,mono){ g.font=(w||600)+' '+px+'px '+(mono?MONO:FONT); }
function T(g,s,x,y,col,px,al,w,mono){ F(g,px||30,w,mono); g.fillStyle=col||C.w; g.textAlign=al||'left'; g.fillText(s,x,y); }
function L(g,x1,y1,x2,y2,col,lw){ g.strokeStyle=col; g.lineWidth=lw||3; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); }
function R(g,x,y,w,h,col,lw){ g.strokeStyle=col; g.lineWidth=lw||3; g.strokeRect(x,y,w,h); }
function FR(g,x,y,w,h,col){ g.fillStyle=col; g.fillRect(x,y,w,h); }
function begin(g,cv){ const s=cv.width/1000; g.setTransform(s,0,0,s,0,0); try{ g.fontStretch='condensed'; }catch(e){} FR(g,0,0,1000,1000*cv.height/cv.width,'#000'); g.lineCap='butt'; g.lineJoin='miter'; g.textBaseline='alphabetic'; return 1000*cv.height/cv.width; }
function dark(g){ }
function poly(g,pts,col,fill,lw){ g.beginPath(); g.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2) g.lineTo(pts[i],pts[i+1]); g.closePath(); if(fill){ g.fillStyle=col; g.fill(); } else { g.strokeStyle=col; g.lineWidth=lw||3; g.stroke(); } }
function rrect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r); g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h); g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r); g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y); g.closePath(); }
const pad=(n,w,c)=>String(n).padStart(w,c||'0');

/* ================= PFD ================= */
const P={cx:468,cy:452,ppd:8.6,tx0:46,tx1:178,ax0:770,ax1:900,y0:170,y1:735};
function pfd(g,cv,D){
  begin(g,cv);
  if(!D.pwr) return;
  const {cx,cy,ppd}=P;
  // ---- attitude (rounded rectangle) ----
  g.save(); rrect(g,236,186,464,532,44); g.clip();
  if(D.attOK){
    g.translate(cx,cy); g.rotate(-D.phi*D2R); const off=D.th*ppd;
    FR(g,-900,-1500+off,1800,1500,C.sky); FR(g,-900,off,1800,1500,C.gnd); L(g,-900,off,900,off,C.w,3);
    for(let p=-90;p<=90;p+=2.5){ if(!p) continue; const y=off-p*ppd; if(y<-235||y>215) continue; const maj=p%10===0, mid=p%5===0; const w=maj?120:mid?62:26; L(g,-w/2,y,w/2,y,C.w,maj?3.4:2.6); if(maj){ T(g,String(Math.abs(p)),-w/2-10,y+11,C.w,31,'right'); T(g,String(Math.abs(p)),w/2+10,y+11,C.w,31,'left'); } }
    // pitch limit indicator (amber, flaps out or near the stick shaker)
    if(D.pli!=null){ const y=off-D.pli*ppd; if(y>-230){ g.strokeStyle=C.a; g.lineWidth=4; g.beginPath(); g.moveTo(-70,y+14); g.lineTo(-52,y); g.lineTo(-22,y); g.moveTo(22,y); g.lineTo(52,y); g.lineTo(70,y+14); g.stroke(); L(g,-6,y-12,6,y-12,C.a,4); L(g,0,y-12,0,y-24,C.a,4); } }
    g.setTransform(cv.width/1000,0,0,cv.width/1000,0,0);
  } else { FR(g,236,186,464,532,'#000'); }
  g.restore();
  if(!D.attOK){ R(g,410,410,116,56,C.a,4); T(g,'ATT',cx,452,C.a,44,'center',700); }
  else {
    // bank scale (fixed) and the sky pointer / slip indicator (rotate with the bank)
    g.save(); g.translate(cx,cy);
    for(const a of [-60,-45,-30,-20,-10,10,20,30,45,60]){ const r=240, l=Math.abs(a)===30||Math.abs(a)===60?30:18; g.save(); g.rotate(a*D2R); if(Math.abs(a)===45) poly(g,[0,-r,-6,-r-14,6,-r-14],C.w,false,2.5); else L(g,0,-r,0,-r-l,C.w,3.2); g.restore(); }
    poly(g,[0,-240,-15,-268,15,-268],C.w,false,3);
    g.rotate(-D.phi*D2R); const bad=Math.abs(D.phi)>35, pc=bad?C.a:C.w;
    poly(g,[0,-238,-15,-212,15,-212],pc,bad,3);
    const sl=clamp(D.beta*-9,-36,36); poly(g,[-20+sl,-206,20+sl,-206,24+sl,-194,-24+sl,-194],pc,bad,3);
    g.restore();
    // flight director (magenta bars)
    if(D.fd){ const fx=clamp(D.fdRoll*6,-150,150), fy=clamp(-D.fdPitch*ppd,-150,150); g.strokeStyle=C.m; g.lineWidth=7; g.beginPath(); g.moveTo(cx+fx,cy-150); g.lineTo(cx+fx,cy+150); g.moveTo(cx-150,cy+fy); g.lineTo(cx+150,cy+fy); g.stroke(); }
    // airplane symbol: black wings outlined in white, centre square
    const wing=s=>{ const x=cx+s*62; poly(g,[x,cy-7,x+s*108,cy-7,x+s*108,cy+7,x+s*14,cy+7,x+s*14,cy+38,x,cy+38],C.k,true); poly(g,[x,cy-7,x+s*108,cy-7,x+s*108,cy+7,x+s*14,cy+7,x+s*14,cy+38,x,cy+38],C.w,false,3.5); };
    wing(-1); wing(1); FR(g,cx-9,cy-9,18,18,C.k); R(g,cx-9,cy-9,18,18,C.w,3.5);
  }
  // ---- ILS: localizer below, glideslope right ----
  if(D.ls){
    const dot=46;
    for(const k of [-2,-1,1,2]){ g.beginPath(); g.arc(cx+k*dot,676,7,0,7); g.strokeStyle=C.w; g.lineWidth=3; g.stroke(); g.beginPath(); g.arc(682,cy+k*dot,7,0,7); g.stroke(); }
    L(g,cx,664,cx,688,C.w,3); L(g,670,cy,694,cy,C.w,3);
    if(D.loc&&D.loc.valid){ const x=cx+clamp(D.loc.dev,-2.4,2.4)*dot; poly(g,[x,662,x+15,676,x,690,x-15,676],C.m,Math.abs(D.loc.dev)<2.4,3); }
    if(D.gs&&D.gs.valid){ const y=cy+clamp(-D.gs.dev,-2.4,2.4)*dot; poly(g,[682,y-15,697,y,682,y+15,667,y],C.m,Math.abs(D.gs.dev)<2.4,3); }
    T(g,D.lsId+'/'+D.lsFreq,250,222,C.w,28); if(D.dme!=null) T(g,'DME '+D.dme.toFixed(1),250,254,C.w,28);
  }
  // ---- radio altitude, minimums ----
  if(D.ra<2500&&D.attOK){ const ra=D.ra<100?Math.round(D.ra/2)*2:D.ra<500?Math.round(D.ra/10)*10:Math.round(D.ra/20)*20; const below=D.mins&&D.minsRA&&D.ra<D.mins; T(g,String(Math.max(0,ra)),cx,700,below?C.a:C.w,44,'center',700); }
  if(D.mins){ T(g,D.minsRA?'RADIO':'BARO',700,738,C.g,26,'right'); T(g,String(D.mins),700,770,C.g,32,'right'); }
  // ---- speed tape ----
  speedTape(g,D);
  altTape(g,D);
  vsi(g,D);
  hdgArc(g,D);
  fma(g,D);
  // AFDS status
  if(D.afds){ T(g,D.afds,cx,160,D.afdsC||C.g,46,'center',700); if(D.afdsBox) R(g,cx-g.measureText(D.afds).width/2-10,118,g.measureText(D.afds).width+20,52,C.g,3); }
  if(D.msg){ T(g,D.msg,cx,560,D.msgC||C.a,40,'center',700); }
}
function speedTape(g,D){
  const {tx0,tx1,y0,y1,cy}=P, k=4.3, top=y0+16, bot=y1-16;
  FR(g,tx0,y0+16,tx1-tx0,y1-y0-32,C.gr);
  if(!D.adrOK){ T(g,'SPD',(tx0+tx1)/2,cy+12,C.a,40,'center',700); R(g,tx0+16,cy-28,tx1-tx0-32,56,C.a,3); return; }
  const v=Math.max(30,D.ias), Y=s=>cy-(s-v)*k;
  g.save(); g.beginPath(); g.rect(tx0,top,tx1-tx0+30,bot-top); g.clip();
  for(let s=Math.floor((v-70)/10)*10;s<=v+70;s+=10){ if(s<30) continue; const y=Y(s); L(g,tx1-20,y,tx1,y,C.w,3); if(s%20===0) T(g,String(s),tx1-28,y+11,C.w,32,'right'); }
  // maximum speed (red / black barber pole) and minimum manoeuvre (amber), stick shaker (red / black)
  const pole=(a,b,x)=>{ const ya=Math.max(top,Y(b)), yb=Math.min(bot,Y(a)); if(yb<=ya) return; FR(g,x,ya,10,yb-ya,C.k); for(let y=ya-((ya)%20);y<yb;y+=20){ FR(g,x,Math.max(ya,y),10,Math.min(10,yb-Math.max(ya,y)),C.r); } };
  if(D.vmax) pole(D.vmax,D.vmax+200,tx1-4);
  if(D.shaker) pole(0,D.shaker,tx1-4);
  if(D.vmin&&!D.gnd){ g.strokeStyle=C.a; g.lineWidth=4; g.beginPath(); g.moveTo(tx1-4,Y(D.vmin)); g.lineTo(tx1+2,Y(D.vmin)); g.lineTo(tx1+2,Math.min(bot,Y(D.shaker||0))); g.stroke(); }
  // reference bugs (green): V1, VR on the ground; flap manoeuvre speeds; VREF
  if(D.bugs) for(const b of D.bugs){ if(b.v==null) continue; const y=Y(b.v); if(y<top-10||y>bot+10) continue; L(g,tx1,y,tx1+12,y,C.g,3); T(g,b.t,tx1+14,y+10,C.g,26); }
  // selected speed bug (magenta)
  if(D.spdTgt!=null){ const y=clamp(Y(D.spdTgt),top,bot); poly(g,[tx1,y,tx1+18,y-14,tx1+30,y-14,tx1+30,y+14,tx1+18,y+14],C.m,false,3.5); }
  // speed trend vector (10 s)
  if(Math.abs(D.trend)>1){ const yt=clamp(Y(v+D.trend),top,bot); L(g,tx1-8,cy,tx1-8,yt,C.g,4); poly(g,[tx1-8,yt,tx1-18,yt+(D.trend>0?18:-18),tx1+2,yt+(D.trend>0?18:-18)],C.g,false,3); }
  g.restore();
  // current speed readout
  const bx=tx0+4, bw=tx1-tx0-26; poly(g,[bx,cy-34,bx+bw,cy-34,bx+bw,cy-12,bx+bw+16,cy,bx+bw,cy+12,bx+bw,cy+34,bx,cy+34],C.k,true); poly(g,[bx,cy-34,bx+bw,cy-34,bx+bw,cy-12,bx+bw+16,cy,bx+bw,cy+12,bx+bw,cy+34,bx,cy+34],C.w,false,3);
  T(g,String(Math.round(D.ias<45?0:D.ias)).padStart(3,' '),bx+bw-8,cy+18,C.w,50,'right',700,true);
  // selected speed above, Mach below
  if(D.spdSel!=null) T(g,D.spdSel,(tx0+tx1)/2,y0+4,C.m,38,'center',700);
  if(D.mach>=0.4) T(g,'.'+pad(Math.round(D.mach*1000),3),(tx0+tx1)/2,y1+30,C.w,36,'center',700); else if(D.gsTxt) T(g,D.gsTxt,(tx0+tx1)/2,y1+30,C.w,32,'center',600);
}
function altTape(g,D){
  const {ax0,ax1,y0,y1,cy}=P, k=0.56, top=y0+16, bot=y1-16;
  FR(g,ax0,top,ax1-ax0,bot-top,C.gr);
  if(!D.adrOK){ T(g,'ALT',(ax0+ax1)/2,cy+12,C.a,40,'center',700); R(g,ax0+16,cy-28,ax1-ax0-32,56,C.a,3); return; }
  const a=D.alt, Y=h=>cy-(h-a)*k;
  g.save(); g.beginPath(); g.rect(ax0-30,top,ax1-ax0+40,bot-top); g.clip();
  for(let h=Math.floor((a-520)/100)*100;h<=a+520;h+=100){ const y=Y(h); L(g,ax0,y,ax0+18,y,C.w,3); if(h%200===0){ T(g,(h<0?'-':'')+String(Math.abs(h)),ax1-8,y+11,C.w,30,'right'); if(h%1000===0){ L(g,ax0+24,y-22,ax1,y-22,C.w,2.5); L(g,ax0+24,y+22,ax1,y+22,C.w,2.5); } } }
  // minimums (baro) and the ground (amber hatch)
  if(D.mins&&!D.minsRA){ const y=Y(D.mins); L(g,ax0-30,y,ax0+40,y,C.g,5); }
  if(D.ra<1500){ const y=Y(a-D.ra); if(y<bot){ FR(g,ax0,y,8,bot-y,C.a); } }
  // selected altitude bug (magenta)
  if(D.selAlt!=null){ const y=clamp(Y(D.selAlt),top,bot); poly(g,[ax0,y-30,ax0+16,y-30,ax0+16,y-10,ax0+4,y,ax0+16,y+10,ax0+16,y+30,ax0,y+30],C.m,false,4); }
  g.restore();
  // readout: thousands large, hundreds smaller
  const bx=ax0+4, bw=ax1-ax0+2; poly(g,[bx-16,cy,bx,cy-14,bx,cy-38,bx+bw,cy-38,bx+bw,cy+38,bx,cy+38,bx,cy+14],C.k,true); poly(g,[bx-16,cy,bx,cy-14,bx,cy-38,bx+bw,cy-38,bx+bw,cy+38,bx,cy+38,bx,cy+14],C.w,false,3);
  const ar=Math.round(a/20)*20, th=Math.trunc(ar/1000), hu=Math.abs(ar%1000);
  if(ar<0) T(g,'NEG',bx+6,cy-18,C.w,20);
  T(g,String(Math.abs(th)||''),bx+58,cy+18,C.w,50,'right',700,true); if(Math.abs(th)<10&&Math.abs(th)>0){}
  if(Math.abs(th)<10) FR(g,bx+10,cy-10,0,0,C.k);
  T(g,pad(hu,3),bx+bw-6,cy+15,C.w,40,'right',700,true);
  // selected altitude above, barometric setting below
  if(D.selAlt!=null) T(g,String(D.selAlt),(ax0+ax1)/2+6,y0+4,C.m,38,'center',700);
  T(g,D.std?'STD':String(D.qnh)+' HPA',(ax0+ax1)/2+6,y1+30,C.g,32,'center',700);
  if(D.std&&D.preset) T(g,D.preset,(ax0+ax1)/2+6,y1+62,C.w,26,'center');
}
function vsi(g,D){
  const x0=912, x1=990, cy=P.cy;
  g.fillStyle=C.gr; g.beginPath(); g.moveTo(x0,cy-230); g.lineTo(x0+40,cy-230); g.lineTo(x1,cy-150); g.lineTo(x1,cy+150); g.lineTo(x0+40,cy+230); g.lineTo(x0,cy+230); g.lineTo(x0,cy+30); g.lineTo(x0+14,cy); g.lineTo(x0,cy-30); g.closePath(); g.fill();
  const f=v=>{ const a=Math.abs(v); const y=a<=1000?a*0.11:a<=2000?110+(a-1000)*0.06:a<=6000?170+(a-2000)*0.0115:216; return cy-Math.sign(v)*y; };
  for(const [v,t] of [[500,''],[1000,'1'],[1500,''],[2000,'2'],[6000,'6']]){ for(const s of [1,-1]){ const y=f(v*s); L(g,x0+24,y,x0+38,y,C.w,t?3.5:2.5); if(t) T(g,t,x0+20,y+10,C.w,26,'right'); } }
  L(g,x0+18,cy,x0+40,cy,C.w,4);
  if(!D.adrOK) return;
  const y=f(clamp(D.vs,-6500,6500)); L(g,x1+10,cy,x0+26,y,C.w,5);
  if(Math.abs(D.vs)>=400){ const t=String(Math.round(Math.abs(D.vs)/50)*50); T(g,t,958,D.vs>0?cy-244:cy+268,C.w,30,'center',700); }
  if(D.vsSel!=null){ const ys=f(clamp(D.vsSel,-6500,6500)); L(g,x0+22,ys,x0+40,ys,C.m,7); }
}
function hdgArc(g,D){
  const cx=P.cx, cy=1182, r=340;
  g.save(); g.beginPath(); g.rect(200,778,560,240); g.clip();
  g.fillStyle=C.gr; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill();
  if(D.hdgOK){
    for(let d=-60;d<=60;d+=5){ const hd=w360(Math.round(D.hdg/5)*5+d), a=w180(hd-D.hdg)*D2R; const maj=hd%10===0; g.save(); g.translate(cx,cy); g.rotate(a); L(g,0,-r,0,-r+(maj?26:14),C.w,3); if(hd%10===0){ const lab=String(Math.round(hd/10)%36); T(g,lab,0,-r+(hd%30===0?62:56),C.w,hd%30===0?36:28,'center',hd%30===0?700:600); } g.restore(); }
    // selected heading bug (magenta)
    if(D.selHdg!=null){ const a=clamp(w180(D.selHdg-D.hdg),-46,46)*D2R; g.save(); g.translate(cx,cy); g.rotate(a); poly(g,[-22,-r,22,-r,22,-r-14,8,-r-14,0,-r-4,-8,-r-14,-22,-r-14],C.m,false,4); g.restore(); }
    // track line
    const ta=w180(D.trk-D.hdg)*D2R; g.save(); g.translate(cx,cy); g.rotate(ta); L(g,0,-r+8,0,-r+150,C.w,3); L(g,-12,-r+90,12,-r+90,C.w,3); g.restore();
  }
  g.restore();
  // heading pointer and readout
  poly(g,[cx,cy-r+2,cx-14,cy-r-20,cx+14,cy-r-20],C.w,false,3);
  if(D.hdgOK){ FR(g,cx-48,cy-r-66,96,44,C.k); R(g,cx-48,cy-r-66,96,44,C.w,3); T(g,pad(Math.round(w360(D.hdg))||360,3),cx,cy-r-30,C.w,38,'center',700,true); T(g,'MAG',cx+62,cy-r-32,C.g,26); if(D.selHdg!=null){ T(g,pad(Math.round(D.selHdg),3)+' H',cx-62,cy-r-32,C.m,28,'right',700); } }
  else T(g,'HDG',cx,cy-r-30,C.a,36,'center',700);
}
function fma(g,D){
  const F_=D.fma||{}, cols=[[150,383],[383,616],[616,850]], keys=['at','roll','pitch'];
  for(let i=0;i<3;i++){ const [x0,x1]=cols[i], k=keys[i], cx=(x0+x1)/2; if(i) L(g,x0,10,x0,92,C.w,2.5);
    const e=F_[k]||'', a=F_[k+'Arm']||''; if(e){ T(g,e,cx,48,F_[k+'C']||C.g,36,'center',700); if(F_[k+'Box']){ F(g,36,700); const w=g.measureText(e).width; R(g,cx-w/2-8,16,w+16,42,C.g,3); } } if(a) T(g,a,cx,86,C.w,28,'center',600); }
}

/* ================= ND ================= */
function star(g,x,y,s,col,fill){ g.beginPath(); for(let i=0;i<8;i++){ const a=i*Math.PI/4, rr=i%2?s*0.32:s; g.lineTo(x+Math.sin(a)*rr,y-Math.cos(a)*rr); } g.closePath(); if(fill){ g.fillStyle=col; g.fill(); } else { g.strokeStyle=col; g.lineWidth=3; g.stroke(); } }
function nd(g,cv,D){
  begin(g,cv);
  if(!D.pwr) return;
  if(!D.irOK){ T(g,'MAP',500,500,C.a,46,'center',700); T(g,'HDG',500,80,C.a,40,'center',700); return; }
  const mode=D.mode, ctr=!!D.ctr||mode==='PLN', ax=500, ay=ctr?520:820, rr=ctr?360:640, rng=D.range;
  const north=mode==='PLN', up=north?0:(mode==='MAP'?D.trk:D.hdg), ppm=rr/(rng*1852), sc=v=>v;
  const P_=(N,E)=>{ const dN=N-D.N, dE=E-D.E, a=-up*D2R; const x=dE*Math.cos(a)+dN*Math.sin(a)*-1, y=dN*Math.cos(a)+dE*Math.sin(a); return [ax+(dE*Math.cos(up*D2R)-dN*Math.sin(up*D2R))*ppm, ay-(dN*Math.cos(up*D2R)+dE*Math.sin(up*D2R))*ppm]; };
  // compass arc (expanded) or rose (centred)
  g.save(); g.beginPath(); g.rect(0,96,1000,904); g.clip();
  g.strokeStyle=C.w; g.lineWidth=3; g.beginPath(); g.arc(ax,ay,rr,0,7); g.stroke();
  for(let d=0;d<360;d+=5){ const a=(d-up)*D2R; if(!ctr&&Math.abs(w180(d-up))>62) continue; const maj=d%10===0; g.save(); g.translate(ax,ay); g.rotate(a); L(g,0,-rr,0,-rr+(maj?28:15),C.w,3); if(d%30===0||(maj&&!ctr)){ g.translate(0,-rr+(d%30===0?62:54)); g.rotate(-a*0); T(g,String(d/10),0,0,C.w,d%30===0?36:28,'center',d%30===0?700:600); } g.restore(); }
  // half-range arc (dashed) with its label
  g.setLineDash([16,14]); g.strokeStyle=C.w; g.lineWidth=2.5; g.beginPath(); g.arc(ax,ay,rr/2,0,7); g.stroke(); g.setLineDash([]);
  T(g,String(rng/2),ax-rr/2*Math.sin(40*D2R)-10,ay-rr/2*Math.cos(40*D2R),C.w,26,'right');
  // runway (practice field: threshold at 0 / 0, 3000 m, heading 360) and its extended centre line
  const r0=P_(0,0), r1=P_(D.rwyLen||3000,0); L(g,r0[0],r0[1],r1[0],r1[1],C.w,9); L(g,r0[0],r0[1],r0[0],r0[1],C.k,1);
  if(mode!=='MAP'||D.ls){ const e=P_(-14*1852,0); g.setLineDash([22,16]); L(g,r0[0],r0[1],e[0],e[1],C.w,2.5); g.setLineDash([]); }
  // fixes (cyan when the WPT filter is on), the route (magenta: active), waypoints
  if(D.fixes&&D.filt&&D.filt.wpt) for(const f of D.fixes){ if(f.fp) continue; const [x,y]=P_(f.N,f.E); if(x<-40||x>1040||y<90||y>1000) continue; star(g,x,y,13,C.c); T(g,f.id,x+18,y+24,C.c,26); }
  if(D.fixes&&D.filt&&D.filt.sta) for(const f of D.fixes){ if(!f.vor) continue; const [x,y]=P_(f.N,f.E); if(x<-40||x>1040||y<90||y>1000) continue; g.strokeStyle=C.c; g.lineWidth=3; g.beginPath(); g.arc(x,y,12,0,7); g.stroke(); T(g,f.id,x+18,y+24,C.c,26); }
  if(D.fpln&&mode!=='APP'&&mode!=='VOR'){ const pts=D.fpln.map(p=>P_(p.N,p.E));
    g.strokeStyle=C.m; g.lineWidth=4; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke();
    if(D.actLeg){ const a=P_(D.N,D.E); }
    D.fpln.forEach((p,i)=>{ const [x,y]=pts[i]; if(p.rwy) return; const act=i===D.actIdx; star(g,x,y,15,act?C.m:C.w,false); T(g,p.id,x+20,y+26,act?C.m:C.w,28); if(p.cst&&D.filt&&D.filt.data) T(g,p.cstTxt,x+20,y+54,C.w,24); }); }
  // selected heading (magenta bug and dashed line in HDG SEL)
  if(D.selHdg!=null&&mode!=='PLN'){ const a=w180(D.selHdg-up)*D2R; g.save(); g.translate(ax,ay); g.rotate(clamp(a,-1.08,1.08)); poly(g,[-24,-rr,24,-rr,24,-rr-16,9,-rr-16,0,-rr-4,-9,-rr-16,-24,-rr-16],C.m,false,4); if(D.hdgSel){ g.setLineDash([18,14]); L(g,0,-10,0,-rr,C.m,3); g.setLineDash([]); } g.restore(); }
  // ILS / VOR course and deviation (APP, VOR modes)
  if((mode==='APP'||mode==='VOR')&&D.loc){ const a=w180(D.lsCrs-up)*D2R; g.save(); g.translate(ax,ay); g.rotate(a);
    const R0=ctr?rr*0.62:rr*0.42; for(const k of [-2,-1,1,2]){ g.beginPath(); g.arc(k*R0*0.26,0,8,0,7); g.strokeStyle=C.w; g.lineWidth=3; g.stroke(); }
    L(g,0,-rr+20,0,-R0*0.85,C.m,5); poly(g,[0,-rr+6,-16,-rr+40,16,-rr+40],C.m,false,4); L(g,0,R0*0.85,0,rr-30,C.m,5);
    if(D.loc.valid){ const dx=clamp(D.loc.dev,-2.5,2.5)*R0*0.26; L(g,dx,-R0*0.8,dx,R0*0.8,C.m,6); }
    g.restore();
    if(D.gs&&D.gs.valid&&mode==='APP'){ for(const k of [-2,-1,1,2]){ g.beginPath(); g.arc(950,500+k*48,7,0,7); g.strokeStyle=C.w; g.lineWidth=3; g.stroke(); } L(g,936,500,964,500,C.w,3); const y=500+clamp(-D.gs.dev,-2.4,2.4)*48; poly(g,[950,y-15,965,y,950,y+15,935,y],C.m,true); }
    T(g,D.lsId,990,140,C.g,30,'right',700); T(g,'CRS '+pad(Math.round(D.lsCrs),3),990,174,C.w,28,'right'); if(D.dme!=null) T(g,'DME '+D.dme.toFixed(1),990,208,C.w,28,'right'); }
  g.restore();
  // aircraft symbol and heading pointer
  if(ctr) poly(g,[ax,ay-28,ax-20,ay+26,ax+20,ay+26],C.w,false,4); else { L(g,ax,ay-40,ax,ay+30,C.w,4); L(g,ax-26,ay-10,ax+26,ay-10,C.w,4); L(g,ax-12,ay+22,ax+12,ay+22,C.w,4); }
  if(!north){ const ha=w180(D.hdg-up)*D2R; g.save(); g.translate(ax,ay); g.rotate(ha); poly(g,[0,-rr+2,-14,-rr+30,14,-rr+30],C.w,false,3); g.restore(); if(mode==='MAP'){ g.setLineDash([]); L(g,ax,ay-44,ax,ay-rr+8,C.w,2.5); } }
  // heading / track box
  FR(g,ax-58,44,116,48,C.k); R(g,ax-58,44,116,48,C.w,3); T(g,pad(Math.round(w360(up))||360,3),ax,84,C.w,40,'center',700,true); T(g,north?'TRU':(mode==='MAP'?'TRK':'HDG'),ax-72,82,C.g,28,'right',700); T(g,'MAG',ax+72,82,C.g,28,'left',700);
  // top left: ground speed, true airspeed, wind
  T(g,'GS',16,40,C.w,26); T(g,String(Math.round(D.gs)),58,40,C.w,36,'left',700); T(g,'TAS',148,40,C.w,26); T(g,D.tas>100?String(Math.round(D.tas)):'---',196,40,C.w,36,'left',700);
  if(D.windSpd>=1&&D.tas>100){ T(g,pad(Math.round(D.windDir),3)+'°/'+Math.round(D.windSpd),16,78,C.w,30,'left',700); const a=(D.windDir+180-up)*D2R; g.save(); g.translate(60,124); g.rotate(a); L(g,0,-28,0,28,C.w,4); poly(g,[0,30,-9,14,9,14],C.w,true); g.restore(); }
  // top right: active waypoint, ETA, distance
  if(D.toWpt&&mode!=='APP'&&mode!=='VOR'){ T(g,D.toWpt,990,40,C.m,34,'right',700); T(g,(D.eta||'')+'z',990,74,C.w,28,'right'); T(g,(D.toDist!=null?D.toDist.toFixed(D.toDist<100?1:0):'')+' NM',990,108,C.w,30,'right',700); }
  // bottom: VOR / ADF selections
  if(D.vor1){ T(g,D.vor1.k,16,940,C.g,28,'left',700); T(g,D.vor1.id,16,974,C.g,28,'left',700); }
  if(D.vor2){ T(g,D.vor2.k,984,940,C.g,28,'right',700); T(g,D.vor2.id,984,974,C.g,28,'right',700); }
  if(D.ndMsg) T(g,D.ndMsg,500,960,C.a,30,'center',700);
}

/* ================= upper DU: primary engine indications ================= */
function arcGauge(g,cx,cy,r,v,max,red,amber,txt,ref,cmd,valid){
  const a0=Math.PI, span=Math.PI*1.16, ang=x=>a0+clamp(x/max,0,1.06)*span;
  if(valid&&v>0.5){ g.fillStyle='#4f5560'; g.beginPath(); g.moveTo(cx,cy); g.arc(cx,cy,r,a0,ang(v)); g.closePath(); g.fill(); }
  g.strokeStyle=C.w; g.lineWidth=4; g.beginPath(); g.arc(cx,cy,r,a0,ang(red)); g.stroke();
  if(amber){ g.strokeStyle=C.a; g.beginPath(); g.arc(cx,cy,r,ang(amber),ang(red)); g.stroke(); }
  for(let i=0;i<=10;i+=2){ const a=ang(max*i/10); L(g,cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(a)*(r-16),cy+Math.sin(a)*(r-16),C.w,3); }
  const ar=ang(red); L(g,cx+Math.cos(ar)*(r-4),cy+Math.sin(ar)*(r-4),cx+Math.cos(ar)*(r+22),cy+Math.sin(ar)*(r+22),C.r,6);
  if(ref!=null){ const a=ang(ref); g.save(); g.translate(cx+Math.cos(a)*(r+12),cy+Math.sin(a)*(r+12)); g.rotate(a+Math.PI/2); poly(g,[-9,-10,9,-10,0,8],C.g,true); g.restore(); }
  if(cmd!=null){ const a=ang(cmd); L(g,cx+Math.cos(a)*(r+2),cy+Math.sin(a)*(r+2),cx+Math.cos(a)*(r+20),cy+Math.sin(a)*(r+20),C.w,5); }
  if(valid){ const a=ang(v), col=v>=red?C.r:amber&&v>=amber?C.a:C.w; L(g,cx,cy,cx+Math.cos(a)*(r-6),cy+Math.sin(a)*(r-6),col,6); }
  const bw=r*1.05, bh=r*0.5; FR(g,cx+6,cy-bh-8,bw,bh,C.k); R(g,cx+6,cy-bh-8,bw,bh,C.w,3); if(valid) T(g,txt,cx+bw,cy-14,v>=red?C.r:C.w,r*0.42,'right',700,true);
}
function eng(g,cv,D){
  begin(g,cv);
  if(!D.pwr) return;
  T(g,'TAT',22,44,C.c,28); T(g,(D.tat>=0?'+':'')+Math.round(D.tat)+'c',80,44,C.w,32,'left',700);
  if(D.mode){ T(g,D.mode,300,44,C.g,34,'left',700); }
  if(D.sel) T(g,D.sel,560,44,C.g,30,'left',600);
  const X=[245,640];
  for(let i=0;i<2;i++){ const e=D.eng[i], x=X[i];
    if(D.refN1!=null) T(g,D.refN1.toFixed(1),x+80,96,C.g,32,'right',700);
    arcGauge(g,x,240,112,e.n1,110,104,null,e.n1.toFixed(1),D.refN1,D.cmd?D.cmd[i]:null,true);
    if(e.rev) T(g,'REV',x-12,152,e.rev>1?C.g:C.a,30,'center',700);
    arcGauge(g,x,470,86,e.egt,1100,950,925,String(Math.round(e.egt)),null,null,true);
    if(e.startV) T(g,'START VALVE',x-30,592,C.a,24,'center',700),T(g,'OPEN',x-30,618,C.a,24,'center',700);
    if(e.oilLo) T(g,'LOW OIL',x+60,592,C.a,24,'center',700),T(g,'PRESSURE',x+60,618,C.a,24,'center',700);
  }
  T(g,'N1',442,252,C.c,30,'center'); T(g,'EGT',442,478,C.c,30,'center');
  // fuel flow (right column)
  T(g,'FF',890,160,C.c,28,'center'); T(g,D.eng[0].ff.toFixed(2),890,200,C.w,32,'center',700); T(g,D.eng[1].ff.toFixed(2),890,240,C.w,32,'center',700);
  // fuel quantity: tank 1, centre, tank 2
  const tank=(x,y,v,t,lo)=>{ g.strokeStyle=C.w; g.lineWidth=3; g.beginPath(); g.arc(x,y,62,0,7); g.stroke(); T(g,v.toFixed(2),x,y+12,lo?C.a:C.w,36,'center',700); T(g,t,x,y-74,C.w,26,'center'); };
  tank(310,830,D.fuel[0]/1000,'1',D.fuel[0]<453); tank(500,770,D.fuel[1]/1000,'CTR',false); tank(690,830,D.fuel[2]/1000,'2',D.fuel[2]<453);
  T(g,'FUEL KG X 1000',690,950,C.c,26,'center');
  if(D.cfg) { FR(g,22,680,250,0,C.k); }
  let my=700; for(const m of (D.msgs||[])){ T(g,m.t,22,my,m.c||C.a,28,'left',700); my+=34; }
}
/* ================= lower DU: secondary engine indications ================= */
function eng2(g,cv,D){
  begin(g,cv);
  if(!D.pwr) return;
  const X=[245,640];
  for(let i=0;i<2;i++){ const e=D.eng[i], x=X[i]; arcGauge(g,x,200,100,e.n2,110,105,null,e.n2.toFixed(1),null,null,true); }
  T(g,'N2',442,212,C.c,30,'center');
  const row=(y,lab,a,b,fmt,lo)=>{ T(g,lab,442,y,C.c,26,'center'); T(g,fmt(a),X[0]-20,y,lo&&lo(a)?C.a:C.w,34,'center',700); T(g,fmt(b),X[1]-20,y,lo&&lo(b)?C.a:C.w,34,'center',700); };
  const e=D.eng;
  row(400,'FF',e[0].ff,e[1].ff,v=>v.toFixed(2));
  row(480,'OIL PRESS',e[0].oilP,e[1].oilP,v=>String(Math.round(v)),v=>v<13&&D.anyRun);
  row(560,'OIL TEMP',e[0].oilT,e[1].oilT,v=>String(Math.round(v)));
  row(640,'OIL QTY %',e[0].oilQ,e[1].oilQ,v=>String(Math.round(v)));
  row(720,'VIB',e[0].vib,e[1].vib,v=>v.toFixed(1));
  T(g,'HYD P',880,160,C.c,26,'center'); T(g,'A '+Math.round(D.hydA),880,200,D.hydA<1300?C.a:C.w,30,'center',700); T(g,'B '+Math.round(D.hydB),880,236,D.hydB<1300?C.a:C.w,30,'center',700);
  T(g,'HYD Q %',880,300,C.c,26,'center'); T(g,'A 98',880,340,C.w,30,'center',700); T(g,'B 99',880,376,C.w,30,'center',700);
  T(g,'APU',880,470,C.c,26,'center'); T(g,'EGT',880,500,C.c,22,'center'); T(g,String(Math.round(D.apuEgt)),880,540,C.w,30,'center',700);
}

/* ================= CDU screen (24 columns × 14 lines) ================= */
function cdu(g,cv,D){
  const H=begin(g,cv);
  if(!D.pwr) return;
  const P_=D.mcdu||{}, cw=1000/24, lh=H/14.2, big=Math.min(lh*0.94,cw*1.55), small=big*0.78;
  const row=r=>lh*(r+0.92);
  const put=(r,txt,col,al,sz)=>{ if(!txt) return; const s=sz||((r%2===1&&r<13)?small:big); g.font='700 '+s.toFixed(1)+'px '+MONO; g.fillStyle=col||C.w; g.textAlign='left';
    const n=txt.length, x=al==='r'?1000-6-n*cw:al==='c'?(1000-n*cw)/2:6;
    for(let i=0;i<n;i++){ const ch=txt[i]; if(ch!==' ') g.fillText(ch==='□'?'□':ch,x+i*cw+cw*0.08,row(r)); } };
  if(P_.title){ const t=P_.title; put(0,t,P_.titleC||C.w,'c',big); }
  if(P_.pg) put(0,P_.pg,C.w,'r',small);
  for(const l of (P_.lines||[])) put(l[0],l[1],l[2],l[3],l[4]==='s'?small:l[4]==='b'?big:null);
  if(P_.dash){ const y=row(11)-small*0.3; L(g,6,y,994,y,C.w,2); }
  put(13,P_.scratch||'',P_.scratchC||C.w,'l',big);
}

/* ================= flap position indicator, landing gear lights ================= */
function flapind(g,cv,D){
  begin(g,cv);
  const cx=500, cy=520, r=400, marks=[0,1,2,5,10,15,25,30,40], ang=v=>{ let i=0; while(i<marks.length-1&&marks[i+1]<v) i++; const f=i<marks.length-1?(v-marks[i])/(marks[i+1]-marks[i]):0; return (-135+(i+clamp(f,0,1))*270/8)*D2R; };
  g.fillStyle='#0b0c0e'; g.beginPath(); g.arc(cx,cy,470,0,7); g.fill();
  marks.forEach(m=>{ const a=ang(m); L(g,cx+Math.sin(a)*r,cy-Math.cos(a)*r,cx+Math.sin(a)*(r-60),cy-Math.cos(a)*(r-60),C.w,12); T(g,String(m),cx+Math.sin(a)*(r-130),cy-Math.cos(a)*(r-130)+30,C.w,84,'center',700); });
  T(g,'FLAPS',cx,cy+300,C.w,64,'center',700);
  for(const [v,col,len] of [[D.l,'#e9edf0',330],[D.r,'#e9edf0',300]]){ const a=ang(v); g.save(); g.translate(cx,cy); g.rotate(a); poly(g,[-18,30,18,30,6,-len,-6,-len],col,true); g.restore(); }
  g.fillStyle='#2a2e33'; g.beginPath(); g.arc(cx,cy,46,0,7); g.fill();
  if(D.le) T(g,D.le,cx,cy+400,D.le==='LE FLAPS EXT'?C.g:C.a,1,'center');
}
function gearl(g,cv,D){
  const H=begin(g,cv);
  FR(g,0,0,1000,H,'#15171a');
  const lt=(x,y,on,col,t1,t2)=>{ FR(g,x,y,290,200,on?(col===C.g?'#0d3a14':'#4a0b08'):'#1d2024'); R(g,x,y,290,200,'#05060a',10); g.fillStyle=on?col:'#3b4047'; g.font='700 64px '+FONT; g.textAlign='center'; g.fillText(t1,x+145,y+90); g.fillText(t2,x+145,y+160); };
  const pos=[[30,70],[355,70],[680,70]], nm=['LEFT','NOSE','RIGHT'];
  for(let i=0;i<3;i++){ lt(pos[i][0],pos[i][1],D.pwr&&D.red,C.r,nm[i],'GEAR'); lt(pos[i][0],pos[i][1]+520,D.pwr&&D.green,C.g,nm[i],'GEAR'); }
}

G.B737DISP={pfd,nd,eng,eng2,mcdu:cdu,flapind,gearl,C};
})(typeof window!=='undefined'?window:globalThis);
