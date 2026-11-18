/* NORDAP – ATR 72-500 instruments (atr72.html): EADI and EHSI, the AFCS display unit (ADU), the round airspeed, altimeter
   and vertical speed indicators, RMI, clock, standby instruments, the engine gauges (torque, NP, ITT, NH, fuel flow, oil),
   the crew alerting panel, flaps and trim indicators, cabin pressure and the small displays. Our own drawing of the
   -500 instruments; every instrument draws into a 1000-wide box (height 1000 × its aspect), called only when on screen. */
(function(G){
'use strict';
const D2R=Math.PI/180, C={g:'#3dff4e',c:'#38e8ff',a:'#ffb21a',r:'#ff2a22',m:'#ff4cff',w:'#ffffff',k:'#000',sky:'#3aa0e8',gnd:'#9c6a2a',y:'#ffe53a',dim:'#7c8590',face:'#0b0c0d',bez:'#1b1e21'};
const clamp=(x,a,b)=>x<a?a:x>b?b:x, w360=a=>{ a%=360; return a<0?a+360:a; };
const FONT='Archivo,"Archivo fb",Arial,sans-serif', MONO='"IBM Plex Mono","DejaVu Sans Mono",monospace';
function T(g,s,x,y,col,px,al,w,mono){ g.font=(w||600)+' '+px+'px '+(mono?MONO:FONT); g.fillStyle=col||C.w; g.textAlign=al||'left'; g.fillText(s,x,y); }
function L(g,x1,y1,x2,y2,col,lw){ g.strokeStyle=col; g.lineWidth=lw||3; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); }
function FR(g,x,y,w,h,col){ g.fillStyle=col; g.fillRect(x,y,w,h); }
function begin(g,cv,bg){ const s=cv.width/1000; g.setTransform(s,0,0,s,0,0); const h=1000*cv.height/cv.width; FR(g,0,0,1000,h,bg||'#000'); g.lineCap='butt'; g.textBaseline='alphabetic'; return h; }
function poly(g,p,col,fill,lw){ g.beginPath(); g.moveTo(p[0],p[1]); for(let i=2;i<p.length;i+=2) g.lineTo(p[i],p[i+1]); g.closePath(); if(fill){ g.fillStyle=col; g.fill(); } else { g.strokeStyle=col; g.lineWidth=lw||3; g.stroke(); } }
/* a round gauge: v on a scale from lo to hi swept over a0..a1 degrees (0 = up, clockwise), ticks and labels */
function dial(g,cv,o){
  const h=begin(g,cv,C.bez), cx=500, cy=h/2, r=Math.min(470,h/2-20);
  g.fillStyle=C.face; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill();
  const ang=v=>(o.a0+(clamp(v,o.lo,o.hi)-o.lo)/(o.hi-o.lo)*(o.a1-o.a0))*D2R;
  const P=(a,rr)=>[cx+Math.sin(a)*rr,cy-Math.cos(a)*rr];
  for(const z of o.zones||[]){ g.strokeStyle=z[2]; g.lineWidth=z[3]||34; g.beginPath(); g.arc(cx,cy,r*0.86,ang(z[0])-Math.PI/2,ang(z[1])-Math.PI/2); g.stroke(); }
  for(let v=o.lo;v<=o.hi+1e-6;v+=o.minor){ const a=ang(v), maj=Math.abs(v/o.major-Math.round(v/o.major))<1e-6; const [x1,y1]=P(a,r*0.97), [x2,y2]=P(a,r*(maj?0.8:0.88)); L(g,x1,y1,x2,y2,C.w,maj?12:6);
    if(maj&&o.lab!==false){ const [tx,ty]=P(a,r*0.64); T(g,o.fmt?o.fmt(v):String(v),tx,ty+o.lpx*0.36,C.w,o.lpx||90,'center',600); } }
  for(const m of o.marks||[]){ const a=ang(m[0]); const [x1,y1]=P(a,r*1.0), [x2,y2]=P(a,r*0.74); L(g,x1,y1,x2,y2,m[1],20); }
  if(o.title) T(g,o.title,cx,cy+r*0.8,C.w,o.tpx||62,'center',700);
  if(o.pwr&&o.v!=null){ const a=ang(o.v); g.save(); g.translate(cx,cy); g.rotate(a); poly(g,[-22,40,22,40,9,-r*0.9,-9,-r*0.9],o.ncol||C.w,true); g.restore(); g.fillStyle='#2b2f33'; g.beginPath(); g.arc(cx,cy,56,0,7); g.fill(); }
  if(o.dig&&o.pwr){ FR(g,cx-o.dig.w/2,cy+r*0.12,o.dig.w,o.dig.h||120,'#000'); T(g,o.dig.t,cx+o.dig.w/2-14,cy+r*0.12+(o.dig.h||120)*0.8,o.dig.col||C.w,o.dig.px||100,'right',600,true); }
  return {cx,cy,r,ang,P};
}
/* ================= EADI ================= */
function eadi(g,cv,D){
  const h=begin(g,cv); if(!D.pwr) return;
  const cx=500, cy=h*0.52, ppd=12;
  g.save(); g.beginPath(); g.rect(170,h*0.12,660,h*0.8); g.clip();
  if(D.attOK){ g.translate(cx,cy); g.rotate(-D.phi*D2R); const off=D.th*ppd;
    FR(g,-1000,-1600+off,2000,1600,C.sky); FR(g,-1000,off,2000,1600,C.gnd); L(g,-1000,off,1000,off,C.w,4);
    for(let p=-40;p<=40;p+=2.5){ if(!p) continue; const y=off-p*ppd, maj=p%10===0, mid=p%5===0, w=maj?150:mid?80:36; L(g,-w/2,y,w/2,y,C.w,maj?4:3); if(maj){ T(g,String(Math.abs(p)),-w/2-12,y+13,C.w,38,'right'); T(g,String(Math.abs(p)),w/2+12,y+13,C.w,38,'left'); } }
    g.setTransform(cv.width/1000,0,0,cv.width/1000,0,0);
  } else { T(g,'ATT',cx,cy,C.a,70,'center',700); }
  g.restore();
  // roll scale
  g.save(); g.translate(cx,cy); for(const a of [-60,-45,-30,-20,-10,0,10,20,30,45,60]){ g.save(); g.rotate(a*D2R); L(g,0,-h*0.36,0,-h*0.36-(a%30===0?40:22),C.w,4); g.restore(); }
  if(D.attOK){ g.rotate(-D.phi*D2R); poly(g,[0,-h*0.36+4,-16,-h*0.36+30,16,-h*0.36+30],C.w,true); } g.restore();
  // aircraft symbol and flight director
  L(g,cx-220,cy,cx-80,cy,C.y,14); L(g,cx-80,cy,cx-80,cy+30,C.y,14); L(g,cx+80,cy,cx+220,cy,C.y,14); L(g,cx+80,cy,cx+80,cy+30,C.y,14); FR(g,cx-9,cy-9,18,18,C.y);
  if(D.fd&&D.attOK){ const px=clamp(D.fdR*6,-200,200), py=clamp(-D.fdP*12,-180,180); L(g,cx+px,cy-190,cx+px,cy+190,C.m,8); L(g,cx-190,cy+py,cx+190,cy+py,C.m,8); }
  // fast / slow (speed deviation in IAS mode) on the left, localizer and glide slope on the right / bottom
  T(g,'F',95,h*0.32,C.w,52,'center',700); T(g,'S',95,h*0.78,C.w,52,'center',700);
  for(let k=-2;k<=2;k++){ if(!k) continue; g.strokeStyle=C.w; g.lineWidth=4; g.beginPath(); g.arc(95,cy+k*60,12,0,7); g.stroke(); } L(g,70,cy,120,cy,C.w,5);
  if(D.spdDev!=null){ const y=cy-clamp(D.spdDev,-20,20)*6; poly(g,[78,y,112,y-16,112,y+16],C.m,true); }
  if(D.ls){ for(let k=-2;k<=2;k++){ if(!k) continue; g.strokeStyle=C.w; g.lineWidth=4; g.beginPath(); g.arc(905,cy+k*60,12,0,7); g.stroke(); g.beginPath(); g.arc(cx+k*80,h*0.9,12,0,7); g.stroke(); }
    if(D.gs&&D.gs.valid) poly(g,[890,cy-D.gs.dev*120,920,cy-D.gs.dev*120-18,920,cy-D.gs.dev*120+18],C.m,true);
    if(D.loc&&D.loc.valid){ const x=cx+clamp(D.loc.dev,-2.5,2.5)*80; poly(g,[x,h*0.9-20,x+18,h*0.9,x,h*0.9+20,x-18,h*0.9],C.m,true); } }
  // modes along the top (as repeated from the ADU): lateral left, vertical right
  const f=D.afcs; if(f){ T(g,f.lat,230,h*0.085,C.g,48,'left',700); if(f.latA) T(g,f.latA,230+g.measureText(f.lat).width+20,h*0.085,C.w,48,'left',700); T(g,f.vert,770,h*0.085,C.g,48,'right',700); if(f.vertA) T(g,f.vertA,770-g.measureText(f.vert).width-20,h*0.085,C.w,48,'right',700); }
  if(D.ra<2500&&!D.gnd){ T(g,String(Math.round(D.ra/10)*10),cx,h*0.82,D.ra<D.dh?C.a:C.w,58,'center',700,true); if(D.ra<D.dh+100) T(g,'DH',cx+130,h*0.82,C.a,46,'left',700); }
  if(D.stall){ T(g,'STALL',cx,h*0.3,C.r,80,'center',800); }
}
/* ================= EHSI ================= */
function ehsi(g,cv,D){
  const h=begin(g,cv); if(!D.pwr) return;
  const cx=500, cy=h*0.55, r=h*0.36, hd=D.hdg;
  if(!D.hdgOK){ T(g,'HDG',cx,cy,C.a,70,'center',700); return; }
  g.save(); g.translate(cx,cy); g.rotate(-hd*D2R);
  g.strokeStyle=C.w; g.lineWidth=4; g.beginPath(); g.arc(0,0,r,0,7); g.stroke();
  for(let a=0;a<360;a+=5){ g.save(); g.rotate(a*D2R); L(g,0,-r,0,-r+(a%10===0?36:20),C.w,4); if(a%30===0){ T(g,a===0?'N':a===90?'E':a===180?'S':a===270?'W':String(a/10),0,-r+86,C.w,52,'center',600); } g.restore(); }
  // heading bug
  g.save(); g.rotate(D.selHdg*D2R); poly(g,[-22,-r-4,22,-r-4,22,-r+20,10,-r+20,0,-r+8,-10,-r+20,-22,-r+20],C.c,true); g.restore();
  // course pointer and deviation bar
  g.save(); g.rotate(D.crs*D2R); L(g,0,-r+60,0,-r*0.42,C.y,10); poly(g,[0,-r+40,-24,-r+90,24,-r+90],C.y,true); L(g,0,r*0.42,0,r-60,C.y,10);
  for(let k=-2;k<=2;k++){ if(!k) continue; g.strokeStyle=C.w; g.lineWidth=4; g.beginPath(); g.arc(k*r*0.25,0,12,0,7); g.stroke(); }
  if(D.loc&&D.loc.valid){ const dx=clamp(D.loc.dev,-2.5,2.5)*r*0.25; L(g,dx,-r*0.38,dx,r*0.38,C.y,10); } g.restore();
  // route in MAP-like dots (the FMS route, if any, as small magenta points)
  if(D.fpln&&D.mode!==1){ const nm=D.range, k=r/nm; g.fillStyle=C.m; for(const p of D.fpln){ const dn=(p.N-D.N)/1852, de=(p.E-D.E)/1852; if(Math.hypot(dn,de)>nm) continue; g.save(); g.rotate(hd*D2R); g.restore(); const x=de*k, y=-dn*k; g.beginPath(); g.arc(x,y,9,0,7); g.fill(); } }
  g.restore();
  // lubber line and aircraft
  poly(g,[cx,cy-r-6,cx-18,cy-r-40,cx+18,cy-r-40],C.w,true);
  L(g,cx,cy-46,cx,cy+60,C.w,8); L(g,cx-50,cy-6,cx+50,cy-6,C.w,8); L(g,cx-22,cy+50,cx+22,cy+50,C.w,6);
  // corners
  T(g,'CRS '+String(Math.round(D.crs)).padStart(3,'0'),40,h*0.1,C.y,50,'left',600); T(g,'HDG '+String(Math.round(D.selHdg)).padStart(3,'0'),40,h*0.95,C.c,50,'left',600);
  T(g,D.navId,960,h*0.1,C.g,50,'right',600); T(g,D.dme!=null?D.dme.toFixed(1)+' NM':'--- NM',960,h*0.17,C.w,50,'right',600,true);
  T(g,'GS '+Math.round(D.gs_),960,h*0.95,C.w,46,'right',600);
  if(D.gs&&D.gs.valid){ const y=cy-clamp(D.gs.dev,-2,2)*r*0.22; poly(g,[cx+r+40,y,cx+r+70,y-16,cx+r+70,y+16],C.m,true); }
}
/* ================= ADU: AFCS modes ================= */
function adu(g,cv,D){
  const h=begin(g,cv); if(!D.pwr) return; const f=D.f;
  T(g,f.lat,30,h*0.3,C.g,120,'left',700,true); T(g,f.latA,30,h*0.62,C.w,100,'left',700,true);
  T(g,f.vert,970,h*0.3,C.g,120,'right',700,true); T(g,f.vertA,970,h*0.62,C.w,100,'right',700,true);
  T(g,(f.ap?'AP':'  ')+' '+(f.yd?'YD':'  ')+(f.bank?' LO BANK':''),30,h*0.92,C.g,80,'left',700,true);
  T(g,'ALT SEL '+f.altSel,970,h*0.92,C.c,80,'right',600,true);
  if(f.apOff){ T(g,'AP OFF',500,h*0.62,C.r,90,'center',800,true); }
}
/* ================= round flight instruments ================= */
function asi(g,cv,D){ const o=dial(g,cv,{lo:40,hi:300,a0:-150,a1:150,major:20,minor:10,lpx:76,title:'KNOTS',pwr:D.pwr,v:D.ias<40?40:D.ias,zones:[[D.vmo,300,C.r,40]],fmt:v=>v%40===0?String(v):''});
  for(const b of D.bugs||[]){ const a=o.ang(b), [x,y]=o.P(a,o.r*0.98); g.save(); g.translate(x,y); g.rotate(a); FR(g,-10,-6,20,50,C.c); g.restore(); }
  if(D.sel){ const a=o.ang(D.sel), [x,y]=o.P(a,o.r*0.98); g.save(); g.translate(x,y); g.rotate(a); FR(g,-14,-6,28,60,C.m); g.restore(); } }
function alt(g,cv,D){ const a=D.alt, h=begin(g,cv,C.bez), cx=500, cy=h/2, r=Math.min(470,h/2-20);
  g.fillStyle=C.face; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill();
  for(let i=0;i<50;i++){ const an=i/50*2*Math.PI, maj=i%5===0; L(g,cx+Math.sin(an)*r*0.97,cy-Math.cos(an)*r*0.97,cx+Math.sin(an)*r*(maj?0.8:0.88),cy-Math.cos(an)*r*(maj?0.8:0.88),C.w,maj?12:6); if(maj) T(g,String(i/5),cx+Math.sin(an)*r*0.64,cy-Math.cos(an)*r*0.64+32,C.w,90,'center',600); }
  FR(g,cx-230,cy-r*0.36,460,130,'#000'); const s=String(Math.max(0,Math.round(a/20)*20)).padStart(5,' '); T(g,s,cx+200,cy-r*0.36+105,C.w,110,'right',600,true);
  T(g,D.qnh,cx,cy+r*0.62,C.c,70,'center',600,true);
  const an=(a%1000)/1000*2*Math.PI; g.save(); g.translate(cx,cy); g.rotate(an); poly(g,[-20,40,20,40,8,-r*0.9,-8,-r*0.9],C.w,true); g.restore(); g.fillStyle='#2b2f33'; g.beginPath(); g.arc(cx,cy,50,0,7); g.fill();
  const sa=(D.sel%1000)/1000*2*Math.PI; g.save(); g.translate(cx,cy); g.rotate(sa); FR(g,-14,-r*0.99,28,50,C.c); g.restore(); }
function vsi(g,cv,D){ const v=clamp(D.vs/1000,-6,6), f=x=>Math.sign(x)*Math.sqrt(Math.abs(x)/6)*6; dial(g,cv,{lo:-6,hi:6,a0:-170+90,a1:170+90,major:1,minor:0.5,lpx:84,title:'VS',pwr:D.pwr,v:f(v),fmt:x=>Math.abs(Math.round(x))%2===0||Math.abs(x)<1.5?String(Math.abs(Math.round(x))):''}); }
function rmi(g,cv,D){ const h=begin(g,cv,C.bez), cx=500, cy=h/2, r=Math.min(470,h/2-20); g.fillStyle=C.face; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill(); if(!D.pwr){ T(g,'HDG',cx,cy,C.a,90,'center',700); return; }
  g.save(); g.translate(cx,cy); g.rotate(-D.hdg*D2R); for(let a=0;a<360;a+=5){ g.save(); g.rotate(a*D2R); L(g,0,-r*0.97,0,-r*(a%10===0?0.82:0.88),C.w,a%10===0?10:6); if(a%30===0) T(g,a===0?'N':a===90?'E':a===180?'S':a===270?'W':String(a/10),0,-r*0.62,C.w,80,'center',600); g.restore(); }
  for(const [b,col,w] of [[D.b1,C.y,26],[D.b2,C.g,14]]){ g.save(); g.rotate(b*D2R); L(g,0,r*0.75,0,-r*0.75,col,w); poly(g,[0,-r*0.86,-36,-r*0.64,36,-r*0.64],col,true); g.restore(); } g.restore();
  poly(g,[cx,cy-r,cx-24,cy-r-30,cx+24,cy-r-30],C.w,true); }
function clock(g,cv,D){ const d=new Date(D.t), m=d.getUTCMinutes()+d.getUTCSeconds()/60, hr=(d.getUTCHours()%12)+m/60; const o=dial(g,cv,{lo:0,hi:60,a0:0,a1:360,major:5,minor:1,lpx:80,pwr:false,fmt:v=>v===60?'':String(v)});
  const {cx,cy,r}=o; g.save(); g.translate(cx,cy); g.rotate(hr/12*2*Math.PI); FR(g,-14,-r*0.5,28,r*0.5,C.w); g.restore(); g.save(); g.translate(cx,cy); g.rotate(m/60*2*Math.PI); FR(g,-10,-r*0.8,20,r*0.8,C.w); g.restore(); }
function tat(g,cv,D){ const h=begin(g,cv,'#101214'); if(!D.pwr) return; FR(g,20,20,460,h-40,'#000'); FR(g,520,20,460,h-40,'#000'); T(g,(D.sat>0?'+':'')+Math.round(D.sat)+'°',460,h*0.72,C.r,h*0.55,'right',600,true); T(g,String(Math.round(D.tas)),960,h*0.72,C.r,h*0.55,'right',600,true); }
/* ================= standby ================= */
function stbyH(g,cv,D){ const h=begin(g,cv,C.bez), cx=500, cy=h/2, r=Math.min(470,h/2-20); g.save(); g.beginPath(); g.arc(cx,cy,r,0,7); g.clip();
  g.translate(cx,cy); g.rotate(-D.phi*D2R); const off=D.th*10; FR(g,-600,-1200+off,1200,1200,'#2f7fbf'); FR(g,-600,off,1200,1200,'#3b2a1a'); L(g,-600,off,600,off,C.w,6);
  for(let p=-30;p<=30;p+=10){ if(!p) continue; L(g,-60,off-p*10,60,off-p*10,C.w,5); } g.restore(); L(g,cx-200,cy,cx-60,cy,C.y,16); L(g,cx+60,cy,cx+200,cy,C.y,16); FR(g,cx-10,cy-10,20,20,C.y); }
function stbyA(g,cv,D){ dial(g,cv,{lo:40,hi:300,a0:-150,a1:150,major:40,minor:20,lpx:90,pwr:D.pwr,v:Math.max(40,D.ias)}); }
function stbyAlt(g,cv,D){ alt(g,cv,{alt:D.alt,qnh:'',sel:-1e9}); }
/* ================= engine gauges ================= */
function tq(g,cv,D){ const o=dial(g,cv,{lo:0,hi:120,a0:-135,a1:135,major:20,minor:10,lpx:78,title:'TQ %',pwr:D.pwr,v:D.v,zones:[[0,100,'#1d7a2a',22],[100,106.3,C.y,22],[106.3,120,C.r,22]],dig:D.pwr?{t:D.v.toFixed(1),w:380,px:100}:null});
  if(D.pwr){ const a=o.ang(D.ref), [x,y]=o.P(a,o.r*1.0); g.save(); g.translate(x,y); g.rotate(a); poly(g,[0,0,-22,-40,22,-40],C.c,true); g.restore(); } }
function np(g,cv,D){ dial(g,cv,{lo:0,hi:120,a0:-135,a1:135,major:20,minor:10,lpx:78,title:'NP %',pwr:D.pwr,v:D.v,zones:[[70.8,100,'#1d7a2a',22],[100,120,C.r,22]],dig:D.pwr?{t:D.v.toFixed(1),w:380,px:100}:null}); }
function itt(g,cv,D){ dial(g,cv,{lo:0,hi:1200,a0:-135,a1:135,major:200,minor:100,lpx:72,title:'ITT °C',pwr:D.pwr,v:D.v,zones:[[300,765,'#1d7a2a',22],[765,800,C.y,22],[800,1200,C.r,22]],fmt:v=>String(v/100),dig:D.pwr?{t:String(Math.round(D.v)),w:300,px:100}:null}); }
function nh(g,cv,D){ dial(g,cv,{lo:0,hi:110,a0:-135,a1:135,major:20,minor:10,lpx:78,title:'NH %',pwr:D.pwr,v:D.v,zones:[[60,103.6,'#1d7a2a',22],[103.6,110,C.r,22]],dig:D.pwr?{t:D.v.toFixed(1),w:380,px:100}:null}); }
function ff(g,cv,D){ dial(g,cv,{lo:0,hi:1000,a0:-120,a1:120,major:200,minor:100,lpx:72,title:'FF',pwr:D.pwr,v:D.v,fmt:v=>String(v/100),dig:D.pwr?{t:String(Math.round(D.fu)),w:380,px:96,col:C.w}:null}); }
function oil(g,cv,D){ const h=begin(g,cv,C.bez); g.fillStyle=C.face; g.fillRect(30,30,940,h-60);
  const bar=(x,v,lo,hi,col,lab)=>{ FR(g,x,h*0.2,120,h*0.6,'#222'); const f=clamp((v-lo)/(hi-lo),0,1); FR(g,x,h*0.8-h*0.6*f,120,h*0.6*f,col); T(g,lab,x+60,h*0.95,C.w,80,'center',600); };
  if(!D.pwr) return; bar(200,D.p,0,100,'#3dbb4a','PSI'); bar(680,D.t,-20,140,'#3dbb4a','°C'); }
function ftemp(g,cv,D){ dial(g,cv,{lo:-50,hi:100,a0:-120,a1:120,major:50,minor:25,lpx:110,pwr:D.pwr,v:D.v,lab:true}); }
/* ================= crew alerting panel ================= */
function cap(g,cv,D){ const h=begin(g,cv,'#111315'); const L_=D.lbl, cols=3, rows=Math.ceil(L_.length/cols), cw=1000/cols, rh=(h-40)/rows;
  L_.forEach((t,i)=>{ const x=(i%cols)*cw, y=20+Math.floor(i/cols)*rh, s=D.pwr?D.l[t]:0; FR(g,x+12,y+8,cw-24,rh-16,s===3?'#8c1410':s===2?'#7a5410':'#1c1f22');
    T(g,t,x+cw/2,y+rh*0.62,s===3?'#ffd2cc':s===2?'#ffe1a8':'#5d646b',t.length>7?70:86,'center',700); }); }
function flaps(g,cv,D){ const o=dial(g,cv,{lo:0,hi:30,a0:-60,a1:90,major:15,minor:15,lpx:110,title:'FLAPS',pwr:D.pwr,v:D.v}); }
function trim(g,cv,D){ const h=begin(g,cv,C.bez); if(!D.pwr) return; g.fillStyle=C.face; g.fillRect(20,20,960,h-40);
  T(g,'PITCH',250,h*0.16,C.w,70,'center',600); FR(g,230,h*0.2,40,h*0.62,'#333'); FR(g,230,h*0.2+h*0.62*0.25,40,h*0.62*0.4,'#1d7a2a'); const py=h*0.2+h*0.62*(0.5-clamp(D.p,-2,6)/8*0.5+0.0); poly(g,[180,py,225,py-22,225,py+22],C.w,true);
  T(g,'ROLL',700,h*0.16,C.w,70,'center',600); FR(g,500,h*0.3,400,30,'#333'); const rx=700+clamp(D.r,-5,5)*36; poly(g,[rx,h*0.3+35,rx-22,h*0.3+80,rx+22,h*0.3+80],C.w,true);
  T(g,'YAW',700,h*0.66,C.w,70,'center',600); FR(g,500,h*0.72,400,30,'#333'); const yx=700+clamp(D.y,-10,10)*18; poly(g,[yx,h*0.72+35,yx-22,h*0.72+80,yx+22,h*0.72+80],C.w,true); }
function cab(g,cv,D){ const h=begin(g,cv,C.bez); if(!D.pwr) return; g.fillStyle=C.face; g.fillRect(30,30,940,h-60);
  T(g,'CAB ALT',500,h*0.12,C.w,90,'center',600); T(g,String(Math.round(D.alt/10)*10),500,h*0.28,C.g,130,'center',600,true);
  T(g,'CAB V/S',500,h*0.45,C.w,90,'center',600); T(g,String(Math.round(D.vs/50)*50),500,h*0.61,C.g,130,'center',600,true);
  T(g,'ΔP PSI',500,h*0.78,C.w,90,'center',600); T(g,D.dp.toFixed(1),500,h*0.93,C.g,130,'center',600,true); }
function accu(g,cv,D){ dial(g,cv,{lo:0,hi:4,a0:-120,a1:120,major:1,minor:0.5,lpx:110,title:'PSI×1000',tpx:60,pwr:true,v:D.v/1000}); }
function gearl(g,cv,D){ const h=begin(g,cv,'#111'); if(!D.pwr) return; for(let i=0;i<3;i++){ const x=40+i*320; FR(g,x,10,280,h-20,D.green?'#22a83a':D.red?'#c41e18':'#1c1f22'); } }
function btemp(g,cv,D){ const h=begin(g,cv,'#111'); if(!D.pwr) return; FR(g,20,20,960,h-40,D.hot?'#c47a10':'#1c1f22'); T(g,'HOT',500,h*0.7,D.hot?'#000':'#4a5056',h*0.5,'center',800); }
function batamp(g,cv,D){ dial(g,cv,{lo:-300,hi:300,a0:-120,a1:120,major:100,minor:50,lpx:140,pwr:D.pwr,v:D.v,fmt:v=>v%200?'':String(v/100),title:'DC A×100',tpx:90}); }
function fuelq(g,cv,D){ const h=begin(g,cv,C.bez); if(!D.pwr) return; g.fillStyle=C.face; g.fillRect(20,20,960,h-40); const q=v=>D.test?'8888':String(Math.round(v/10)*10);
  T(g,'L',250,h*0.3,C.w,90,'center',600); T(g,q(D.l),250,h*0.7,C.g,120,'center',600,true); T(g,'R',750,h*0.3,C.w,90,'center',600); T(g,q(D.r),750,h*0.7,C.g,120,'center',600,true); }
function radio(g,cv,D){ const h=begin(g,cv,'#111315'); if(!D.pwr) return; FR(g,40,h*0.18,920,h*0.34,'#050505'); T(g,D.t,920,h*0.44,'#ff9a2a',Math.min(h*0.24,920/D.t.length*1.55),'right',600,true); }
function fmc(g,cv,D){ const h=begin(g,cv,'#020403'); if(!D.pwr) return; const K=D.K, nav=D.M.nav&&D.M.nav.fp;
  const has=K.fpln&&K.fpln.length; const rows=[['ACT FPL','1/1'],[has?'ENRD-ENRD':'NO FPL',''],[nav&&nav.toWpt?'TO '+nav.toWpt:'',''],[nav&&nav.toDist!=null?'DIST '+nav.toDist.toFixed(1)+'NM':'',''],['CRZ FL'+String(D.crz||170).padStart(3,'0'),''],['GNSS NAV','']];
  rows.forEach((r,i)=>{ T(g,r[0],40,h*0.17+i*h*0.19,i===0?C.c:C.g,h*0.13,'left',600,true); T(g,r[1],960,h*0.17+i*h*0.19,C.w,h*0.13,'right',600,true); }); }
G.ATR72DISP={eadi,ehsi,adu,asi,alt,vsi,rmi,clock,tat,stbyH,stbyA,stbyAlt,tq,np,itt,nh,ff,oil,ftemp,cap,flaps,trim,cab,accu,gearl,btemp,batamp,fuelq,radio,fmc,C};
})(window);
