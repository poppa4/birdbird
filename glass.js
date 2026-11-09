/* Birdbird – glass cockpit (PFD og MFD) tegnet i canvas. Virtuell skjerm 1024×768.
   Stilen følger vanlige glass-cockpit-konvensjoner; dette er ikke et Garmin-produkt. */
(function(G){
'use strict';
const VW=1024, VH=768;
const COL={ sky1:'#0d4fae', sky2:'#2a7fe0', gnd1:'#7a4a1f', gnd2:'#4a2c10', white:'#ffffff', tape:'rgba(30,34,40,.62)', box:'#000000',
  cyan:'#13e0ff', mag:'#ff3cf0', grn:'#29e05a', yel:'#ffd400', red:'#ff2a2a', gray:'#9aa3ad', bar:'#14181d', line:'#5d6670', txt:'#e9eef2' };
const F=(w,s)=>`${w} ${s<16?Math.round(s*1.22):s}px "IBM Plex Sans", "Segoe UI", system-ui, sans-serif`;
const FM=(w,s)=>`${w} ${s}px "IBM Plex Mono", ui-monospace, monospace`;
const D2R=Math.PI/180;
const pad3=n=>String(Math.round(((n%360)+360)%360)||360).padStart(3,'0');

function begin(st){ const g=st.ctx, k=st.w/VW; g.setTransform(st.dpr*k,0,0,st.dpr*k,0,0); g.textBaseline='middle'; g.lineJoin='round'; g.lineCap='round'; return g; }
function txt(g,t,x,y,c,font,al){ g.font=font; g.fillStyle=c; g.textAlign=al||'left'; g.fillText(t,x,y); }
function box(g,x,y,w,h,fill,stroke){ g.fillStyle=fill; g.fillRect(x,y,w,h); if(stroke){ g.strokeStyle=stroke; g.lineWidth=1.5; g.strokeRect(x+.75,y+.75,w-1.5,h-1.5); } }

/* ---------- toppfelt ---------- */
function topBar(g,d,center){
  box(g,0,0,VW,40,COL.bar); g.fillStyle='#2b323a'; g.fillRect(0,39,VW,1);
  if(d.avOff){ [0,1].forEach(i=>{ const y=i?30:12; txt(g,'NAV'+(i+1),8,y,COL.txt,F(600,12)); txt(g,'---.--',56,y,COL.gray,F(500,13)); txt(g,'COM'+(i+1),VW-8,y,COL.txt,F(600,12),'right'); txt(g,'---.---',VW-60,y,COL.gray,F(500,13),'right'); }); if(center) center(); return; }
  const R=d.radio, cdi=d.cdiKey;
  [0,1].forEach(i=>{ const y=i?30:12, n=R.nav[i], sel=R.navSel===i, used=(cdi==='NAV'+(i+1));
    txt(g,'NAV'+(i+1),8,y,COL.txt,F(600,12));
    if(sel){ g.strokeStyle=COL.cyan; g.lineWidth=1.5; g.strokeRect(52,y-8,58,16); }
    txt(g,n.stby,56,y,sel?COL.cyan:COL.txt,F(500,13)); txt(g,'⇄',116,y,COL.gray,F(500,11));
    txt(g,n.act,132,y,used?COL.grn:COL.txt,F(700,14)); const st=d.navIds[i]; if(st) txt(g,st,192,y,used?COL.grn:COL.gray,F(600,11)); });
  [0,1].forEach(i=>{ const y=i?30:12, c=R.com[i], sel=R.comSel===i;
    txt(g,'COM'+(i+1),VW-8,y,COL.txt,F(600,12),'right');
    // aktiv frekvens mot midten, standby ytterst 
    txt(g,c.act,VW-146,y,sel?COL.grn:COL.txt,F(700,14),'right'); txt(g,'⇄',VW-132,y,COL.gray,F(500,11),'left');
    if(sel){ g.strokeStyle=COL.cyan; g.lineWidth=1.5; g.strokeRect(VW-124,y-8,66,16); }
    txt(g,c.stby,VW-60,y,sel?COL.cyan:COL.txt,F(500,13),'right'); });
  if(center) center();
}
function navField(g,d){
  const gp=d.gps, o=d.o;
  if(gp&&gp.valid){ let x=262; txt(g,(gp.from&&gp.from!=='D→'?gp.from+' ':'')+(d.fp.dto&&!d.fp.vtfLeg?'D→ ':'→ ')+gp.to,x,20,COL.mag,F(700,14)); x+=150;
    [['DIS',gp.dis.toFixed(1)+'NM'],['DTK',pad3(gp.dtk)+'°'],['TRK',pad3(o.trk)+'°']].forEach(([a,b])=>{ txt(g,a,x,20,COL.txt,F(600,12)); txt(g,b,x+g.measureText(a).width+6,20,COL.mag,F(600,14)); x+=108; }); return; }
  const items=[['GS',Math.round(o.gs)+'KT'],['TRK',pad3(o.trk)+'°']];
  let x=330; items.forEach(([a,b])=>{ txt(g,a,x,20,COL.txt,F(600,12)); txt(g,b,x+g.measureText(a).width+6,20,COL.mag,F(600,14)); x+=130; });
}
function mfdField(g,d){
  const gp=d.gps, o=d.o; let x=262;
  const items=[['GS',Math.round(o.gs)+'KT'],['DTK',gp&&gp.valid?pad3(gp.dtk)+'°':'___°'],['TRK',pad3(o.trk)+'°'],['ETE',gp&&gp.ete!=null?Math.floor(gp.ete/60)+':'+String(Math.floor(gp.ete%60)).padStart(2,'0'):'__:__']];
  items.forEach(([a,b])=>{ txt(g,a,x,20,COL.txt,F(600,12)); txt(g,b,x+g.measureText(a).width+6,20,COL.mag,F(600,14)); x+=118; });
}

/* ---------- AFCS-stripe ---------- */
function afcs(g,d){
  const ap=d.ap; const y=40, h=26, x0=262, w=500;
  box(g,x0,y,w,h,'rgba(10,12,14,.82)'); g.fillStyle='#2b323a'; g.fillRect(x0,y+h,w,1);
  if(ap.msgT>0){ const blink=(d.time*2)%1<0.6; if(blink) txt(g,ap.msg,x0+w/2,y+h/2,COL.yel,F(700,15),'center'); }
  if(!(ap.on||ap.fd)) return;
  txt(g,ap.lat,x0+50,y+h/2,COL.grn,F(700,15),'center');
  txt(g,ap.latArm,x0+130,y+h/2,COL.txt,F(600,14),'center');
  if(ap.on) txt(g,'AP',x0+w/2,y+h/2,COL.grn,F(700,15),'center');
  let vt=ap.vert; if(vt==='VS') vt='VS '+(ap.vsRef>0?'↑':ap.vsRef<0?'↓':'')+Math.abs(ap.vsRef)+'FPM'; if(vt==='FLC') vt='FLC '+ap.iasRef+'KT'; if(vt==='ALT') vt='ALT '+Math.round(ap.altHold)+'FT';
  txt(g,vt,x0+w-170,y+h/2,COL.grn,F(700,15),'center');
  txt(g,ap.vertArm,x0+w-50,y+h/2,COL.txt,F(600,14),'center');
}

/* ---------- attitude ---------- */
const ACX=455, ACY=262, PPD=7.2;
function attitude(g,d){
  const o=d.o; const p=o.pitch, r=o.roll*D2R;
  g.save(); g.beginPath(); g.rect(0,40,VW,VH-40-24); g.clip();
  g.translate(ACX,ACY); g.rotate(-r); g.translate(0,p*PPD);
  let gr=g.createLinearGradient(0,-500,0,0); gr.addColorStop(0,COL.sky1); gr.addColorStop(1,COL.sky2); g.fillStyle=gr; g.fillRect(-1400,-1400,2800,1400);
  gr=g.createLinearGradient(0,0,0,500); gr.addColorStop(0,COL.gnd1); gr.addColorStop(1,COL.gnd2); g.fillStyle=gr; g.fillRect(-1400,0,2800,1400);
  g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.moveTo(-1400,0); g.lineTo(1400,0); g.stroke();
  // pitch-stige (klippet til et vindu)
  g.save(); g.translate(0,-p*PPD); g.beginPath(); g.rect(-120,-150,240,250); g.clip(); g.translate(0,p*PPD);
  g.strokeStyle='#fff'; g.fillStyle='#fff'; g.lineWidth=2;
  for(let a=-90;a<=90;a+=2.5){ if(a===0) continue; const y=-a*PPD; const big=a%10===0, mid=a%5===0; const w=big?60:mid?30:14;
    if(Math.abs(a-p)>22) continue;
    g.beginPath(); g.moveTo(-w/2,y); g.lineTo(w/2,y); g.stroke();
    if(big){ g.font=F(600,14); g.textAlign='right'; g.fillText(Math.abs(a),-w/2-6,y); g.textAlign='left'; g.fillText(Math.abs(a),w/2+6,y); } }
  g.restore();
  g.restore();
  // rullskala (fast) og himmelpeker
  g.save(); g.beginPath(); g.rect(0,40,VW,VH-64); g.clip();
  g.translate(ACX,ACY); const R=150;
  g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.arc(0,0,R,(-90-60)*D2R,(-90+60)*D2R); g.stroke();
  [10,20,30,45,60].forEach(a=>[-1,1].forEach(sg=>{ const t=(-90+a*sg)*D2R, L=(a===30||a===60)?18:(a===45?0:10);
    if(a===45){ g.save(); g.rotate(a*sg*D2R); g.beginPath(); g.moveTo(0,-R); g.lineTo(-5,-R-10); g.lineTo(5,-R-10); g.closePath(); g.stroke(); g.restore(); return; }
    g.beginPath(); g.moveTo(Math.cos(t)*R,Math.sin(t)*R); g.lineTo(Math.cos(t)*(R+L),Math.sin(t)*(R+L)); g.stroke(); }));
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(0,-R); g.lineTo(-9,-R-14); g.lineTo(9,-R-14); g.closePath(); g.fill();
  g.rotate(-r);
  const warnBank=Math.abs(o.roll)>45; g.fillStyle=warnBank?COL.yel:'#fff';
  g.beginPath(); g.moveTo(0,-R+2); g.lineTo(-9,-R+16); g.lineTo(9,-R+16); g.closePath(); g.fill();
  // glid/skrens-trapes
  const sx=-o.slip*22; g.beginPath(); g.moveTo(-10+sx,-R+19); g.lineTo(10+sx,-R+19); g.lineTo(13+sx,-R+25); g.lineTo(-13+sx,-R+25); g.closePath(); g.fill();
  g.restore();
  // flight director
  const ap=d.ap;
  if(ap.fd && ap.lat){ g.save(); g.translate(ACX,ACY); g.rotate(-(ap.phiCmd-o.roll)*D2R); g.translate(0,-(ap.thCmd-p)*PPD);
    g.fillStyle=COL.mag; g.strokeStyle='#000'; g.lineWidth=1;
    for(const sg of [-1,1]){ g.beginPath(); g.moveTo(0,0); g.lineTo(sg*92,26); g.lineTo(sg*92,34); g.lineTo(sg*70,30); g.closePath(); g.fill(); g.stroke(); }
    g.restore(); }
  // flysymbol
  g.save(); g.translate(ACX,ACY); g.fillStyle=COL.yel; g.strokeStyle='#000'; g.lineWidth=1.5;
  for(const sg of [-1,1]){ g.beginPath(); g.moveTo(0,0); g.lineTo(sg*80,26); g.lineTo(sg*52,26); g.closePath(); g.fill(); g.stroke(); }
  g.fillRect(-150,-3,40,6); g.strokeRect(-150,-3,40,6); g.fillRect(110,-3,40,6); g.strokeRect(110,-3,40,6);
  g.restore();
  // stall
  if(d.s.buffet>0.05 && !d.s.ground){ box(g,ACX-52,ACY+50,104,28,COL.red); txt(g,'STALL',ACX,ACY+64,'#fff',F(700,18),'center'); }
}

/* ---------- fartstape ---------- */
function speedTape(g,d){
  const o=d.o, V=d.V, x=138, w=90, y0=100, h=330, cy=ACY, ppk=4.8;
  box(g,x,y0,w,h,COL.tape);
  g.save(); g.beginPath(); g.rect(x,y0,w,h); g.clip();
  const ias=Math.max(20,o.ias);
  const Y=v=>cy-(v-ias)*ppk;
  // fartsbånd
  const band=(a,b,c,wd,off)=>{ g.fillStyle=c; const y1=Y(b), y2=Y(a); g.fillRect(x+w-(off||0)-wd,y1,wd,y2-y1); };
  band(V.s1,V.no,COL.grn,7); band(V.no,V.ne,COL.yel,7); band(V.ne,400,COL.red,7); band(0,V.s0,COL.red,7);
  band(V.s0,V.fe2,'#fff',4,9);
  // Vmc og Vyse
  g.fillStyle=COL.red; g.fillRect(x+w-20,Y(V.mc)-2,20,4); g.fillStyle='#2f8bff'; g.fillRect(x+w-20,Y(V.yse)-2,20,4);
  g.strokeStyle='#fff'; g.fillStyle='#fff'; g.lineWidth=2; g.font=F(600,17); g.textAlign='right';
  for(let v=Math.floor((ias-40)/5)*5; v<=ias+40; v+=5){ if(v<20) continue; const y=Y(v); g.beginPath(); g.moveTo(x+w-12-(v%10?10:16),y); g.lineTo(x+w-12,y); g.stroke(); if(v%10===0) g.fillText(v,x+w-34,y); }
  // trend (6 s)
  const tr=d.iasTrend*6; if(Math.abs(tr)>1){ g.strokeStyle=COL.mag; g.lineWidth=4; g.beginPath(); g.moveTo(x+w-2,cy); g.lineTo(x+w-2,cy-tr*ppk); g.stroke(); }
  if(d.vspd){ [['R',V.r],['Y',V.y]].forEach(([l,v])=>{ const y=Y(v); g.fillStyle=COL.cyan; g.beginPath(); g.moveTo(x+w,y); g.lineTo(x+w+6,y-7); g.lineTo(x+w+18,y-7); g.lineTo(x+w+18,y+7); g.lineTo(x+w+6,y+7); g.closePath(); g.fill(); txt(g,l,x+w+12,y,'#000',F(700,10),'center'); }); }
  // valgt fart (FLC)
  if(d.ap.vert==='FLC'){ const y=Y(d.ap.iasRef); g.fillStyle=COL.cyan; g.fillRect(x+w-10,y-8,10,16); }
  g.restore();
  // avlesningsboks med rullende siffer
  g.save(); const bx=x+6, bw=w-14, bh=40;
  g.fillStyle='#000'; g.strokeStyle='#fff'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(bx,cy-bh/2); g.lineTo(bx+bw-14,cy-bh/2); g.lineTo(bx+bw-14,cy-8); g.lineTo(bx+bw,cy); g.lineTo(bx+bw-14,cy+8); g.lineTo(bx+bw-14,cy+bh/2); g.lineTo(bx,cy+bh/2); g.closePath(); g.fill(); g.stroke();
  const low=o.ias<V.s1 && !d.s.ground && o.ias>20;
  const c=low||o.ias>V.ne?COL.red:'#fff';
  const tens=Math.floor(ias/10); txt(g,ias<20?'––':String(tens),bx+bw-36,cy,c,F(700,24),'right');
  if(ias>=20){ g.beginPath(); g.rect(bx+bw-36,cy-bh/2+2,22,bh-4); g.clip(); const f=ias%10, base=Math.floor(f), fr=f-base; g.font=F(700,24); g.textAlign='left'; g.fillStyle=c;
    for(let k=-1;k<=2;k++){ const dg=((base+k)%10+10)%10; g.fillText(dg,bx+bw-35,cy-(k-fr)*26); } }
  g.restore();
  // TAS
  box(g,x,y0+h,w,24,'#000','#4a535d'); txt(g,'TAS',x+6,y0+h+12,COL.txt,F(600,12)); txt(g,Math.round(o.tas)+'KT',x+w-6,y0+h+12,COL.txt,F(600,14),'right');
  if(d.ap.vert==='FLC'){ box(g,x,y0-24,w,24,'#000','#4a535d'); txt(g,d.ap.iasRef+'KT',x+w/2,y0-12,COL.cyan,F(700,15),'center'); }
}

/* ---------- høydetape og VSI ---------- */
function altTape(g,d){
  const o=d.o, x=650, w=96, y0=100, h=330, cy=ACY, ppf=0.55;
  box(g,x,y0,w,h,COL.tape);
  g.save(); g.beginPath(); g.rect(x,y0,w,h); g.clip();
  const alt=o.alt, Y=a=>cy-(a-alt)*ppf;
  g.strokeStyle='#fff'; g.fillStyle='#fff'; g.lineWidth=2; g.textAlign='left';
  for(let a=Math.floor((alt-320)/20)*20; a<=alt+320; a+=20){ const y=Y(a); const big=a%100===0; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(big?16:8),y); g.stroke();
    if(big){ g.font=F(600,17); g.fillText(a,x+20,y); } }
  // bakken
  const gy=Y(d.groundAlt); if(gy<y0+h){ g.fillStyle='rgba(122,74,31,.85)'; g.fillRect(x,gy,w,y0+h-gy); g.strokeStyle='#ffd27a'; g.beginPath(); for(let i=-20;i<w;i+=10){ g.moveTo(x+i,gy+10); g.lineTo(x+i+10,gy); } g.stroke(); }
  if(d.mins&&d.mins.on){ const ym=Y(d.mins.ft), near=o.alt-d.mins.ft; const mc=near<0?COL.yel:near<100?COL.yel:COL.cyan; g.strokeStyle=mc; g.lineWidth=3; g.beginPath(); g.moveTo(x,ym); g.lineTo(x+w,ym); g.stroke(); txt(g,'MIN',x+w-6,ym-9,mc,F(700,10),'right'); }
  // valgt høyde-merke
  const ys=Y(d.ap.alt); g.fillStyle=COL.cyan; g.beginPath(); g.moveTo(x,ys-12); g.lineTo(x+10,ys-12); g.lineTo(x+10,ys-4); g.lineTo(x+4,ys); g.lineTo(x+10,ys+4); g.lineTo(x+10,ys+12); g.lineTo(x,ys+12); g.closePath(); g.fill();
  // trend
  const tr=o.vs/10; if(Math.abs(tr)>20){ g.strokeStyle=COL.mag; g.lineWidth=4; g.beginPath(); g.moveTo(x+2,cy); g.lineTo(x+2,cy-tr*ppf); g.stroke(); }
  g.restore();
  // valgt høyde-boks
  box(g,x,y0-26,w,26,'#000','#4a535d'); txt(g,Math.round(d.ap.alt)+'FT',x+w/2,y0-13,COL.cyan,F(700,16),'center');
  // baro
  box(g,x,y0+h,w,24,'#000','#4a535d'); txt(g,d.baroStd?'STD BARO':Math.round(d.baro)+'HPA',x+w/2,y0+h+12,COL.cyan,F(700,14),'center');
  if(d.mins&&d.mins.on){ const near=o.alt-d.mins.ft; if(near<100&&near>-300&&!d.s.ground){ box(g,x-160,y0+h-26,150,22,'#000',COL.yel); txt(g,'MINIMUMS',x-85,y0+h-15,COL.yel,F(700,13),'center'); } box(g,x,y0+h+24,w,20,'#000','#4a535d'); txt(g,'BARO MIN '+d.mins.ft+'FT',x+w/2,y0+h+34,COL.cyan,F(600,10),'center'); }
  // avlesning med rullende 20-fot
  g.save(); const bx=x+8, bw=w+2, bh=40;
  g.fillStyle='#000'; g.strokeStyle='#fff'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(bx-12,cy); g.lineTo(bx,cy-8); g.lineTo(bx,cy-bh/2); g.lineTo(bx+bw,cy-bh/2); g.lineTo(bx+bw,cy+bh/2); g.lineTo(bx,cy+bh/2); g.lineTo(bx,cy+8); g.closePath(); g.fill(); g.stroke();
  const a=Math.max(-1000,alt), neg=a<0, A=Math.abs(a);
  const hund=Math.floor(A/100); txt(g,(neg?'-':'')+hund,bx+bw-38,cy,'#fff',F(700,24),'right');
  g.beginPath(); g.rect(bx+bw-38,cy-bh/2+2,36,bh-4); g.clip(); const r=A%100, base=Math.floor(r/20)*20, fr=(r-base)/20; g.font=F(700,19); g.textAlign='left'; g.fillStyle='#fff';
  for(let k=-1;k<=2;k++){ let v=(base+20*k+100)%100; g.fillText(String(v).padStart(2,'0'),bx+bw-36,cy-(k-fr)*22); }
  g.restore();
  // glidebane
  const gs=d.nav1.gs, isGP=d.nav1.src==='GPS'&&d.nav1.lpv; if((d.nav1.src==='LOC' && d.nav1.valid)||isGP){ const gx=x-22, gy0=cy; box(g,gx-9,cy-86,18,172,'rgba(30,34,40,.62)');
    g.strokeStyle='#fff'; g.lineWidth=1.5; for(const k of [-2,-1,1,2]){ g.beginPath(); g.arc(gx,gy0+k*36,4,0,7); g.stroke(); } g.fillStyle='#fff'; g.fillRect(gx-9,cy-1,18,2);
    txt(g,isGP?'GP':'G',gx,cy-96,isGP?COL.mag:COL.grn,F(700,11),'center');
    if(gs){ const yy=gy0+Math.max(-1.2,Math.min(1.2,gs.dev))*72; g.fillStyle=isGP?COL.mag:COL.grn; g.beginPath(); g.moveTo(gx,yy-9); g.lineTo(gx+7,yy); g.lineTo(gx,yy+9); g.lineTo(gx-7,yy); g.closePath(); g.fill(); }
    else if(!isGP) txt(g,'NO GS',gx,cy+100,COL.yel,F(600,10),'center'); }
  // VSI
  const vx=752, vy=140, vh=250, vc=vy+vh/2;
  g.fillStyle=COL.tape; g.beginPath(); g.moveTo(vx,vy); g.lineTo(vx+34,vy); g.lineTo(vx+34,vy+vh); g.lineTo(vx,vy+vh); g.closePath(); g.fill();
  const VY=v=>vc-Math.max(-2000,Math.min(2000,v))/2000*(vh/2-8);
  g.strokeStyle='#fff'; g.fillStyle='#fff'; g.lineWidth=2;
  for(let v=-2000;v<=2000;v+=500){ const y=VY(v); g.beginPath(); g.moveTo(vx,y); g.lineTo(vx+(v%1000===0?12:7),y); g.stroke(); if(v&&v%1000===0) txt(g,Math.abs(v/1000),vx+16,y,'#fff',F(600,14)); }
  if(d.ap.vert==='VS'){ const y=VY(d.ap.vsRef); g.fillStyle=COL.cyan; g.fillRect(vx,y-6,8,12); }
  const py=VY(o.vs); g.fillStyle='#000'; g.strokeStyle='#fff'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(vx+2,py); g.lineTo(vx+14,py-11); g.lineTo(vx+62,py-11); g.lineTo(vx+62,py+11); g.lineTo(vx+14,py+11); g.closePath(); g.fill(); g.stroke();
  if(Math.abs(o.vs)>=100) txt(g,String(Math.round(o.vs/50)*50),vx+60,py,'#fff',F(600,13),'right');
}

/* ---------- HSI ---------- */
function hsi(g,d){
  const o=d.o, cx=ACX, cy=612, R=118, hdg=o.hdg;
  g.save(); g.fillStyle='rgba(20,24,28,.82)'; g.beginPath(); g.arc(cx,cy,R+4,0,7); g.fill();
  g.translate(cx,cy);
  // svingrate (6 s)
  const tr=d.turnRate*6; if(Math.abs(tr)>0.5){ g.strokeStyle=COL.mag; g.lineWidth=4; g.beginPath(); g.arc(0,0,R+10,-Math.PI/2,(-90+Math.max(-25,Math.min(25,tr)))*D2R,tr<0); g.stroke(); }
  g.strokeStyle='#fff'; g.lineWidth=1.5; g.beginPath(); g.arc(0,0,R+10,(-90-27)*D2R,(-90+27)*D2R); g.stroke();
  for(const a of [-18,-9,9,18]){ g.save(); g.rotate(a*D2R); g.beginPath(); g.moveTo(0,-R-10); g.lineTo(0,-R-16); g.stroke(); g.restore(); }
  g.save(); g.rotate(-hdg*D2R);
  g.strokeStyle='#fff'; g.fillStyle='#fff';
  for(let a=0;a<360;a+=5){ g.save(); g.rotate(a*D2R); g.lineWidth=2; g.beginPath(); g.moveTo(0,-R); g.lineTo(0,-R+(a%10?8:15)); g.stroke();
    if(a%30===0){ const lab={0:'N',90:'E',180:'S',270:'W'}[a]||String(a/10); g.font=F(700,a%90?17:20); g.textAlign='center'; g.fillText(lab,0,-R+30); }
    g.restore(); }
  // kursnål
  const n=d.nav1, crs=d.crs, col=n.color==='mag'?COL.mag:COL.grn;
  g.save(); g.rotate(crs*D2R);
  g.strokeStyle=col; g.fillStyle=col; g.lineWidth=5;
  g.beginPath(); g.moveTo(0,-R+36); g.lineTo(0,-46); g.stroke();
  g.beginPath(); g.moveTo(0,-R+22); g.lineTo(-10,-R+40); g.lineTo(10,-R+40); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0,R-36); g.lineTo(0,46); g.stroke();
  // prikker
  g.strokeStyle='#fff'; g.lineWidth=1.5; for(const k of [-2,-1,1,2]){ g.beginPath(); g.arc(k*30,0,5,0,7); g.stroke(); }
  if(n.valid){ const dev=Math.max(-1.2,Math.min(1.2,n.dev))*60; g.strokeStyle=col; g.lineWidth=5; g.beginPath(); g.moveTo(dev,-42); g.lineTo(dev,42); g.stroke();
    g.fillStyle=col; if(n.toFrom==='TO'){ g.beginPath(); g.moveTo(dev+0,-30); g.lineTo(dev+-14,-14); g.lineTo(dev+14,-14); g.closePath(); g.fill(); } else if(n.toFrom==='FROM'){ g.beginPath(); g.moveTo(dev,30); g.lineTo(dev-14,14); g.lineTo(dev+14,14); g.closePath(); g.fill(); } }
  g.restore();
  // bearing-pekere
  (d.brgs||[]).forEach((b,i)=>{ if(!b||b.brg==null) return; g.save(); g.rotate(b.brg*D2R); g.strokeStyle=COL.cyan; g.fillStyle=COL.cyan; g.lineWidth=2;
    if(i===0){ g.beginPath(); g.moveTo(0,-R+8); g.lineTo(0,R-8); g.stroke(); g.beginPath(); g.moveTo(0,-R+8); g.lineTo(-7,-R+20); g.moveTo(0,-R+8); g.lineTo(7,-R+20); g.stroke(); }
    else { for(const o2 of [-3,3]){ g.beginPath(); g.moveTo(o2,-R+16); g.lineTo(o2,R-8); g.stroke(); } g.beginPath(); g.moveTo(0,-R+6); g.lineTo(-8,-R+20); g.lineTo(8,-R+20); g.closePath(); g.stroke(); }
    g.restore(); });
  // kursmarkør (spor)
  g.save(); g.rotate(o.trk*D2R); g.fillStyle=COL.mag; g.beginPath(); g.moveTo(0,-R+2); g.lineTo(-6,-R+10); g.lineTo(0,-R+18); g.lineTo(6,-R+10); g.closePath(); g.fill(); g.restore();
  // heading bug
  g.save(); g.rotate(d.hdgBug*D2R); g.fillStyle=COL.cyan; g.beginPath(); g.moveTo(-12,-R-2); g.lineTo(12,-R-2); g.lineTo(12,-R+8); g.lineTo(5,-R+8); g.lineTo(0,-R+2); g.lineTo(-5,-R+8); g.lineTo(-12,-R+8); g.closePath(); g.fill(); g.restore();
  g.restore();
  // fly i senter
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(0,-20); g.lineTo(3,-8); g.lineTo(18,2); g.lineTo(18,6); g.lineTo(3,2); g.lineTo(2,14); g.lineTo(8,19); g.lineTo(-8,19); g.lineTo(-2,14); g.lineTo(-3,2); g.lineTo(-18,6); g.lineTo(-18,2); g.lineTo(-3,-8); g.closePath(); g.fill();
  // lubber line og kursboks
  g.fillStyle='#fff'; g.beginPath(); g.moveTo(0,-R-2); g.lineTo(-8,-R-14); g.lineTo(8,-R-14); g.closePath(); g.fill();
  box(g,-30,-R-44,60,28,'#000','#fff'); txt(g,pad3(hdg)+'°',0,-R-30,'#fff',F(700,18),'center');
  g.restore();
  // HDG og CRS
  box(g,cx-R-130,cy-R-24,110,26,'#000','#4a535d'); txt(g,'HDG',cx-R-122,cy-R-11,COL.txt,F(600,13)); txt(g,pad3(d.hdgBug)+'°',cx-R-28,cy-R-11,COL.cyan,F(700,17),'right');
  box(g,cx+R+20,cy-R-24,110,26,'#000','#4a535d'); txt(g,n.src==='GPS'?'DTK':'CRS',cx+R+28,cy-R-11,COL.txt,F(600,13)); txt(g,n.valid||n.src!=='GPS'?pad3(d.crs)+'°':'___°',cx+R+122,cy-R-11,col,F(700,17),'right');
  // NAV-kilde
  txt(g,n.label||'',cx-46,cy-26,col,F(700,12),'center'); if(n.src==='GPS'&&n.obs) txt(g,'OBS',cx+46,cy+30,COL.mag,F(700,12),'center');
  if(n.src==='GPS'){ txt(g,d.fp.susp?'SUSP':n.mode,cx+46,cy-26,d.fp.susp?COL.yel:COL.mag,F(700,12),'center'); }
  (d.brgs||[]).forEach((b,i)=>{ if(!b) return; const bx=i?cx+R+20:cx-R-130, by=VH-66; box(g,bx,by,110,40,'rgba(0,0,0,.78)'); txt(g,(i?'BRG2 ':'BRG1 ')+b.src,bx+6,by+11,COL.cyan,F(700,11)); txt(g,b.id||'',bx+104,by+11,COL.cyan,F(700,11),'right'); txt(g,b.dist!=null?b.dist.toFixed(1)+'NM':'NO DATA',bx+6,by+29,COL.cyan,F(600,12)); });
  // innfelt kart eller DME/vind
  if(d.inset){ drawMap(g,d,{x:8,y:470,w:250,h:228},{range:Math.min(d.mapRange,10),inset:true}); }
  else {
    if(d.dme){ const ix=cx-R-170; box(g,ix,cy-60,140,58,'rgba(0,0,0,.75)'); const dm=d.dmeInfo;
      txt(g,'DME',ix+8,cy-46,COL.txt,F(700,12)); txt(g,'NAV1',ix+132,cy-46,COL.txt,F(600,12),'right');
      txt(g,dm.freq,ix+8,cy-28,COL.grn,F(600,13)); txt(g,dm.dist!=null&&dm.valid?dm.dist.toFixed(1)+'NM':'––.–NM',ix+132,cy-28,COL.grn,F(700,13),'right'); }
    if(d.windOn){ const wx=cx-R-170, wy=cy+20; box(g,wx,wy,140,44,'rgba(0,0,0,.75)');
      if(d.wind.spd>0.5){ const rel=(d.wind.dir+180-o.hdg)*D2R; g.save(); g.translate(wx+22,wy+22); g.rotate(rel); g.strokeStyle='#fff'; g.fillStyle='#fff'; g.lineWidth=2.5; g.beginPath(); g.moveTo(0,12); g.lineTo(0,-10); g.stroke(); g.beginPath(); g.moveTo(0,-14); g.lineTo(-6,-4); g.lineTo(6,-4); g.closePath(); g.fill(); g.restore();
        txt(g,pad3(d.wind.dir)+'°',wx+46,wy+14,'#fff',F(600,13)); txt(g,Math.round(d.wind.spd)+'KT',wx+46,wy+31,'#fff',F(600,13)); }
      else txt(g,'NO WIND',wx+64,wy+22,'#fff',F(600,12),'center'); }
  }
}

/* ---------- bunn ---------- */
function bottom(g,d,soft){
  box(g,0,VH-64,148,24,'#000','#4a535d'); txt(g,'OAT',8,VH-52,COL.txt,F(600,12)); txt(g,Math.round(d.o.oat)+'°C',140,VH-52,'#fff',F(600,14),'right');
  box(g,VW-220,VH-64,220,24,'#000','#4a535d'); txt(g,'XPDR',VW-212,VH-52,COL.txt,F(600,12)); const xc=d.xpdr.mode==='STBY'?'#fff':COL.grn; txt(g,d.xpdr.entry!=null?(d.xpdr.entry+'____').slice(0,4):d.xpdr.code,VW-170,VH-52,d.xpdr.entry!=null?COL.cyan:xc,F(700,14)); txt(g,d.ident>0&&(d.time*2%1<0.6)?'IDNT':d.xpdr.mode,VW-128,VH-52,xc,F(600,12));
  txt(g,'LCL',VW-92,VH-52,COL.txt,F(600,12)); txt(g,d.clock,VW-8,VH-52,'#fff',F(600,14),'right');
  softkeys(g,soft);
}
function softkeys(g,soft){
  box(g,0,VH-24,VW,24,'#0b0d10'); const w=VW/12;
  soft.forEach((k,i)=>{ const x=i*w; g.fillStyle='#2b323a'; g.fillRect(x,VH-24,1,24); if(!k) return; const lab=typeof k==='string'?k:k.t;
    if(k.on){ g.fillStyle='#cfd6dc'; g.fillRect(x+3,VH-22,w-6,20); } txt(g,lab,x+w/2,VH-12,k.on?'#000':(k.dim?'#6b737c':'#fff'),F(600,12),'center'); });
}

/* ---------- annunsiator ---------- */
function alerts(g,d){
  const L=d.alerts; if(!L.length) return; const x=ACX+120, y=74;
  L.forEach((a,i)=>{ const c=a.lvl==='w'?COL.red:COL.yel; box(g,x,y+i*24,170,22,'rgba(0,0,0,.8)',c); txt(g,a.t,x+85,y+i*24+11,c,F(700,13),'center'); });
}

/* ---------- FMS-vinduer ---------- */
function drawWin(g,v,r){
  if(!v) return; g.save(); box(g,r.x,r.y,r.w,r.h,'rgba(8,10,12,.96)','#7a838c');
  box(g,r.x,r.y,r.w,26,'#1d2228'); txt(g,v.title,r.x+r.w/2,r.y+13,COL.txt,F(700,13),'center');
  let y=r.y+42;
  if(v.type==='FPL'){
    txt(g,v.sub,r.x+12,y,COL.cyan,F(600,13)); txt(g,'DTK',r.x+r.w-160,y,COL.txt,F(600,11),'right'); txt(g,'DIS',r.x+r.w-92,y,COL.txt,F(600,11),'right'); txt(g,'ALT',r.x+r.w-16,y,COL.txt,F(600,11),'right'); y+=24;
    const rowH=24, maxRows=Math.floor((r.h-80)/rowH); let start=0; const si=v.rows.findIndex(x=>x.sel||x.act); if(si>maxRows-3) start=si-(maxRows-3);
    v.rows.slice(start,start+maxRows).forEach(row=>{
      if(row.hdr){ txt(g,row.hdr,r.x+12,y,'#fff',F(600,12)); g.fillStyle='#2b323a'; g.fillRect(r.x+8,y+10,r.w-16,1); y+=rowH; return; }
      if(row.sel){ g.strokeStyle=COL.cyan; g.lineWidth=2; g.strokeRect(r.x+30,y-10,90,20); g.fillStyle='rgba(19,224,255,.18)'; g.fillRect(r.x+30,y-10,90,20); }
      if(row.act){ g.strokeStyle=COL.mag; g.fillStyle=COL.mag; g.lineWidth=2.5; g.beginPath(); g.moveTo(r.x+12,y-rowH+2); g.lineTo(r.x+12,y); g.lineTo(r.x+24,y); g.stroke(); g.beginPath(); g.moveTo(r.x+26,y); g.lineTo(r.x+20,y-4); g.lineTo(r.x+20,y+4); g.closePath(); g.fill(); }
      const c=row.act?COL.mag:row.blank?COL.cyan:'#fff';
      txt(g,row.id||'',r.x+36,y,c,F(700,14));
      if(row.dtk!=null) txt(g,pad3(row.dtk)+'°',r.x+r.w-160,y,c,F(600,13),'right');
      if(row.dis!=null) txt(g,row.dis.toFixed(1)+'NM',r.x+r.w-92,y,c,F(600,13),'right');
      if(row.alt) txt(g,row.alt+'FT',r.x+r.w-16,y,COL.cyan,F(600,12),'right');
      y+=rowH; });
    if(v.susp) txt(g,'SUSP – sequencing suspended at the missed approach point',r.x+12,r.y+r.h-14,COL.yel,F(600,11));
  } else if(v.type==='DTO'||v.type==='WPT'){
    txt(g,'WPT',r.x+14,y,COL.txt,F(600,12)); const cw=22;
    v.chars.forEach((c,i)=>{ const x=r.x+60+i*cw; if(i===v.cur&&!v.activate){ g.fillStyle=COL.cyan; g.fillRect(x-2,y-12,cw-2,24); } txt(g,c===' '?'_':c,x+cw/2-2,y,i===v.cur&&!v.activate?'#000':COL.cyan,F(700,18),'center'); });
    y+=30; txt(g,v.name||'',r.x+14,y,'#fff',F(600,13)); txt(g,v.kind||'',r.x+r.w-14,y,COL.gray,F(600,12),'right');
    y+=26; if(v.brg!=null){ txt(g,'BRG '+pad3(v.brg)+'°',r.x+14,y,'#fff',F(600,13)); txt(g,'DIS '+v.dis.toFixed(1)+'NM',r.x+r.w-14,y,'#fff',F(600,13),'right'); }
    y+=34; if(v.type==='DTO'){ const on=v.activate; if(on){ g.fillStyle=COL.cyan; g.fillRect(r.x+r.w/2-60,y-12,120,24); } txt(g,'ACTIVATE?',r.x+r.w/2,y,on?'#000':COL.txt,F(700,14),'center'); }
    txt(g,'FMS inner: letter · outer: position · ENT',r.x+r.w/2,r.y+r.h-14,COL.gray,F(500,10),'center');
  } else if(v.type==='LIST'){
    v.items.forEach((it,i)=>{ const sel=i===v.idx; if(sel){ g.fillStyle=COL.cyan; g.fillRect(r.x+8,y-11,r.w-16,22); }
      txt(g,it.t,r.x+16,y,sel?'#000':(it.dis?'#6b737c':'#fff'),F(600,13)); y+=26; });
    if(v.foot) txt(g,v.foot,r.x+r.w/2,r.y+r.h-14,COL.gray,F(500,10),'center');
  }
  g.restore();
}

function pfd(st,d){
  if(!st.w) return; const g=begin(st);
  g.fillStyle='#000'; g.fillRect(0,0,VW,VH);
  attitude(g,d); speedTape(g,d); altTape(g,d); hsi(g,d);
  topBar(g,d,()=>navField(g,d)); afcs(g,d); alerts(g,d); bottom(g,d,d.softPFD);
  if(d.winP) drawWin(g,d.winP,{x:600,y:458,w:416,h:244});
  if(d.crash){ box(g,262,ACY-50,500,100,'rgba(0,0,0,.85)',COL.red); txt(g,d.crash,512,ACY-14,'#fff',F(700,20),'center'); txt(g,d.crashHint,512,ACY+20,COL.gray,F(500,14),'center'); }
}

/* ---------- MFD ---------- */
function dial(g,cx,cy,r,v,min,max,bands,label,val,unit){
  const a0=-210*D2R, a1=30*D2R, A=x=>a0+(Math.max(min,Math.min(max,x))-min)/(max-min)*(a1-a0);
  g.lineWidth=7; bands.forEach(([a,b,c])=>{ g.strokeStyle=c; g.beginPath(); g.arc(cx,cy,r,A(a),A(b)); g.stroke(); });
  g.strokeStyle='#fff'; g.lineWidth=3; const t=A(v); g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(t)*(r+3),cy+Math.sin(t)*(r+3)); g.stroke();
  txt(g,val,cx+r-2,cy+16,'#fff',F(700,17),'right'); txt(g,label,cx,cy-r-12,COL.txt,F(600,11),'center');
}
function hbar(g,x,y,w,l,r,min,max,bands,label,vl,vr){
  // etikett øverst, verdier i hver ende, venstre peker over stripen og høyre under – ingenting overlapper
  txt(g,label,x+w/2,y-4,COL.txt,F(600,11),'center');
  const bx=x+32, bw=w-64, by=y+21, X=v=>bx+(Math.max(min,Math.min(max,v))-min)/(max-min)*bw;
  bands.forEach(([a,b,c])=>{ g.fillStyle=c; g.fillRect(X(a),by-2.5,X(b)-X(a),5); });
  const tri=(v,up,lab)=>{ const xx=X(v); g.fillStyle='#fff'; g.beginPath(); if(up){ g.moveTo(xx,by+3); g.lineTo(xx-6,by+14); g.lineTo(xx+6,by+14); } else { g.moveTo(xx,by-3); g.lineTo(xx-6,by-14); g.lineTo(xx+6,by-14); } g.closePath(); g.fill(); txt(g,lab,xx,up?by+10:by-10,'#000',F(700,8),'center'); };
  tri(l,false,'L'); tri(r,true,'R');
  txt(g,vl,x,by,'#fff',F(600,12)); txt(g,vr,x+w,by,'#fff',F(600,12),'right');
}
function eis(g,d){
  box(g,0,40,212,VH-64,'#0a0c0e'); g.fillStyle='#2b323a'; g.fillRect(211,40,1,VH-64);
  const E=d.s.eng, G2=COL.grn, Y=COL.yel, Rr=COL.red;
  txt(g,'LOAD %',106,58,COL.txt,F(600,12),'center');
  dial(g,56,118,38,E[0].load*100,0,110,[[0,100,G2],[100,110,Rr]],'L',Math.round(E[0].load*100),'');
  dial(g,156,118,38,E[1].load*100,0,110,[[0,100,G2],[100,110,Rr]],'R',Math.round(E[1].load*100),'');
  txt(g,'RPM',106,176,COL.txt,F(600,12),'center');
  dial(g,56,236,38,E[0].rpm,0,2600,[[900,2300,G2],[2300,2500,Y],[2500,2600,Rr]],'L',Math.round(E[0].rpm/10)*10,'');
  dial(g,156,236,38,E[1].rpm,0,2600,[[900,2300,G2],[2300,2500,Y],[2500,2600,Rr]],'R',Math.round(E[1].rpm/10)*10,'');
  let y=292; const W=180, x=16; const SP=52;
  hbar(g,x,y,W,E[0].ff,E[1].ff,0,14,[[0,14,G2]],'FUEL FLOW GPH',E[0].ff.toFixed(1),E[1].ff.toFixed(1)); y+=SP;
  hbar(g,x,y,W,E[0].oilP,E[1].oilP,0,6.5,[[0,0.9,Rr],[0.9,2.3,Y],[2.3,5.2,G2],[5.2,6.5,Rr]],'OIL PRES BAR',E[0].oilP.toFixed(1),E[1].oilP.toFixed(1)); y+=SP;
  hbar(g,x,y,W,E[0].oilT,E[1].oilT,-30,150,[[-30,50,Y],[50,125,G2],[125,140,Y],[140,150,Rr]],'OIL TEMP °C',Math.round(E[0].oilT),Math.round(E[1].oilT)); y+=SP;
  hbar(g,x,y,W,E[0].coolT,E[1].coolT,-30,120,[[-30,60,Y],[60,105,G2],[105,120,Rr]],'COOLANT °C',Math.round(E[0].coolT),Math.round(E[1].coolT)); y+=SP;
  hbar(g,x,y,W,E[0].gbT||40,E[1].gbT||40,-30,130,[[-30,0,Y],[0,115,G2],[115,130,Rr]],'GEARBOX °C',Math.round(E[0].gbT||40),Math.round(E[1].gbT||40)); y+=SP;
  hbar(g,x,y,W,E[0].fuel,E[1].fuel,0,26,[[0,3,Rr],[3,6,Y],[6,26,G2]],'FUEL QTY GAL',E[0].fuel.toFixed(1),E[1].fuel.toFixed(1)); y+=SP;
  hbar(g,x,y,W,E[0].fuelT||18,E[1].fuelT||18,-30,80,[[-30,-25,Rr],[-25,60,G2],[60,80,Rr]],'FUEL TEMP °C',Math.round(E[0].fuelT||18),Math.round(E[1].fuelT||18)); y+=SP;
  g.fillStyle='#2b323a'; g.fillRect(x,y-6,W,1); txt(g,'ELECTRICAL',x+W/2,y+6,COL.txt,F(600,11),'center');
  txt(g,'VOLTS',x,y+26,COL.txt,F(600,11)); txt(g,(E[0].volts||24).toFixed(1),x+92,y+26,'#fff',F(600,13),'right'); txt(g,(E[1].volts||24).toFixed(1),x+W,y+26,'#fff',F(600,13),'right');
  txt(g,'AMPS',x,y+46,COL.txt,F(600,11)); txt(g,Math.round(E[0].amps||0),x+92,y+46,'#fff',F(600,13),'right'); txt(g,Math.round(E[1].amps||0),x+W,y+46,'#fff',F(600,13),'right');
}
function drawMap(g,d,rect,opt){
  opt=opt||{}; const x0=rect.x, y0=rect.y, w=rect.w, h=rect.h, inset=!!opt.inset, RANGE=opt.range||d.mapRange;
  g.save(); g.beginPath(); g.rect(x0,y0,w,h); g.clip();
  g.fillStyle='#0f1d14'; g.fillRect(x0,y0,w,h);
  const s=d.s, o=d.o, trackUp=d.mapMode==='TRK';
  const cx=x0+w/2, cy=trackUp? y0+h*0.72 : y0+h/2;
  const rngM=RANGE*1852, ppm=(trackUp? h*0.66 : h/2)/rngM;
  const rot=trackUp? -o.trk*D2R : 0;
  const TIs=G.TERRAIN?G.TERRAIN.mapImages().slice().reverse():[]; for(const TI of TIs){ const k=2*TI.R/TI.PX; g.save(); g.translate(cx,cy); g.rotate(rot); g.translate(ppm*(-TI.R-s.E),ppm*(-TI.R+s.N)); g.scale(ppm*k,ppm*k); g.imageSmoothingEnabled=true; g.drawImage(TI.canvas,0,0); g.restore(); }
  const P=(N,E)=>{ const dn=N-s.N, de=E-s.E; const X=de*ppm, Yy=-dn*ppm; const cr=Math.cos(rot), sr=Math.sin(rot); return [cx+X*cr-Yy*sr, cy+X*sr+Yy*cr]; };
  // avstandsringer
  g.strokeStyle='rgba(255,255,255,.22)'; g.lineWidth=1; g.setLineDash([4,6]);
  for(const f of [0.5,1]){ g.beginPath(); g.arc(cx,cy,rngM*ppm*f,0,7); g.stroke(); }
  g.setLineDash([]);
  if(!inset) txt(g,(RANGE/2)+'',cx+rngM*ppm*0.5*0.71+4,cy-rngM*ppm*0.5*0.71-6,'rgba(255,255,255,.6)',F(600,12));
  // LOC-fjær
  const W=d.world, L=W.loc, c=L.crs*D2R;
  const far=10*1852, half=Math.tan(2.5*D2R*1.5)*far;
  const thrN=W.rwy.n0, thrE=W.rwy.e0;
  const a=P(thrN-Math.cos(c)*far+Math.sin(c)*half, thrE-Math.sin(c)*far-Math.cos(c)*half), b=P(thrN-Math.cos(c)*far-Math.sin(c)*half, thrE-Math.sin(c)*far+Math.cos(c)*half), t0=P(thrN,thrE), tm=P(thrN-Math.cos(c)*far*0.85,thrE-Math.sin(c)*far*0.85);
  g.strokeStyle='rgba(41,224,90,.7)'; g.lineWidth=1.5; g.beginPath(); g.moveTo(t0[0],t0[1]); g.lineTo(a[0],a[1]); g.lineTo(tm[0],tm[1]); g.lineTo(b[0],b[1]); g.closePath(); g.stroke();
  // rullebane
  const r1=P(thrN,thrE), r2=P(thrN+Math.cos(c)*W.rwy.len,thrE+Math.sin(c)*W.rwy.len);
  g.strokeStyle='#fff'; g.lineWidth=Math.max(3,W.rwy.wid*ppm); g.lineCap='butt'; g.beginPath(); g.moveTo(r1[0],r1[1]); g.lineTo(r2[0],r2[1]); g.stroke(); g.lineCap='round';
  txt(g,'NAER',r2[0]+10,r2[1]-8,'#fff',F(700,inset?10:13)); if(!inset) txt(g,'RWY 36',r1[0]+10,r1[1]+10,'rgba(255,255,255,.7)',F(600,11));
  // VOR
  const v=P(W.vor.N,W.vor.E); g.strokeStyle=COL.cyan; g.lineWidth=2;
  g.beginPath(); for(let i=0;i<6;i++){ const t=i*Math.PI/3; g.lineTo(v[0]+Math.cos(t)*8,v[1]+Math.sin(t)*8); } g.closePath(); g.stroke(); g.fillStyle=COL.cyan; g.fillRect(v[0]-2,v[1]-2,4,4);
  txt(g,'ASN',v[0]+12,v[1]-10,COL.cyan,F(700,13)); txt(g,W.vor.freq,v[0]+12,v[1]+6,COL.cyan,F(500,11));
  if(d.nav1.src==='VOR'&&d.nav1.id==='ASN'&&!inset){ const cr=d.crs*D2R, ln=40*1852; const p1=P(W.vor.N-Math.cos(cr)*ln,W.vor.E-Math.sin(cr)*ln), p2=P(W.vor.N+Math.cos(cr)*ln,W.vor.E+Math.sin(cr)*ln); g.strokeStyle='rgba(41,224,90,.55)'; g.setLineDash([10,8]); g.beginPath(); g.moveTo(p1[0],p1[1]); g.lineTo(p2[0],p2[1]); g.stroke(); g.setLineDash([]); }
  // flyplan
  if(d.fp&&d.fp.wps.length){ const fp=d.fp; g.lineWidth=inset?2:2.5;
    for(let i=1;i<fp.wps.length;i++){ const a2=fp.wps[i-1], b2=fp.wps[i]; if(a2.appr!==b2.appr&&!b2.appr&&false) continue; if(!a2.appr&&b2.appr) continue; const p1=P(a2.N,a2.E), p2=P(b2.N,b2.E);
      const act=i===fp.act&&!fp.dto&&!fp.vtfLeg; g.strokeStyle=act?COL.mag:'#fff'; if(b2.missed) g.setLineDash([8,6]); g.beginPath(); g.moveTo(p1[0],p1[1]); g.lineTo(p2[0],p2[1]); g.stroke(); g.setLineDash([]); }
    if(fp.act>=0&&(fp.dto||fp.vtfLeg)){ const B=fp.wps[fp.act]; let A=fp.dto; if(fp.vtfLeg){ const c=((fp.appr&&fp.appr.crs)||360)*D2R; A={N:B.N-Math.cos(c)*20*1852,E:B.E-Math.sin(c)*20*1852}; } const p1=P(A.N,A.E), p2=P(B.N,B.E); g.strokeStyle=COL.mag; g.beginPath(); g.moveTo(p1[0],p1[1]); g.lineTo(p2[0],p2[1]); g.stroke(); }
    fp.wps.forEach((wpt,i)=>{ if(wpt.type==='APT'&&wpt.appr) return; const q=P(wpt.N,wpt.E); g.fillStyle=i===fp.act?COL.mag:'#fff'; g.strokeStyle=g.fillStyle; g.lineWidth=1.5;
      if(wpt.type==='INT'||wpt.type==='RWY'){ g.beginPath(); g.moveTo(q[0],q[1]-6); g.lineTo(q[0]-5,q[1]+4); g.lineTo(q[0]+5,q[1]+4); g.closePath(); g.stroke(); }
      if(!d.dcltr||i===fp.act) txt(g,wpt.id,q[0]+8,q[1]-8,i===fp.act?COL.mag:'#fff',F(700,inset?10:12)); });
  }
  // andre databasepunkter
  if(!d.dcltr&&!inset&&d.db){ Object.values(d.db).forEach(p=>{ if(d.fp&&d.fp.wps.some(w=>w.id===p.id)) return; const q=P(p.N,p.E); if(q[0]<x0||q[0]>x0+w||q[1]<y0||q[1]>y0+h) return;
    if(p.type==='APT'){ g.strokeStyle=COL.cyan; g.lineWidth=1.5; g.beginPath(); g.arc(q[0],q[1],6,0,7); g.stroke(); txt(g,p.id,q[0]+9,q[1]-8,COL.cyan,F(600,11)); }
    else if(p.type==='INT'){ g.strokeStyle='rgba(255,255,255,.6)'; g.lineWidth=1; g.beginPath(); g.moveTo(q[0],q[1]-5); g.lineTo(q[0]-4,q[1]+3); g.lineTo(q[0]+4,q[1]+3); g.closePath(); g.stroke(); txt(g,p.id,q[0]+7,q[1]-7,'rgba(255,255,255,.6)',F(500,10)); }
    else if(p.type==='VOR'&&p.id!=='ASN'){ g.strokeStyle=COL.cyan; g.lineWidth=1.5; g.beginPath(); for(let k=0;k<6;k++){ const t=k*Math.PI/3; g.lineTo(q[0]+Math.cos(t)*7,q[1]+Math.sin(t)*7); } g.closePath(); g.stroke(); txt(g,p.id,q[0]+10,q[1]-8,COL.cyan,F(600,11)); } }); }
  // spor
  if(s.trail.length>1){ g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=2; g.setLineDash([2,5]); g.beginPath(); s.trail.forEach((pt,i)=>{ const q=P(pt[0],pt[1]); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); }); g.lineTo(cx,cy); g.stroke(); g.setLineDash([]); }
  // fartsvektor 60 s
  const vN=s.vN||0, vE=s.vE||0; if(Math.hypot(vN,vE)>3){ const e=P(s.N+vN*60,s.E+vE*60); g.strokeStyle=COL.mag; g.lineWidth=2; g.beginPath(); g.moveTo(cx,cy); g.lineTo(e[0],e[1]); g.stroke(); }
  // eget fly
  g.save(); g.translate(cx,cy); g.rotate(o.hdg*D2R+rot); g.fillStyle='#fff'; g.strokeStyle='#000'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(0,-14); g.lineTo(2.5,-5); g.lineTo(13,2); g.lineTo(13,5); g.lineTo(2.5,1); g.lineTo(2,9); g.lineTo(6,12); g.lineTo(-6,12); g.lineTo(-2,9); g.lineTo(-2.5,1); g.lineTo(-13,5); g.lineTo(-13,2); g.lineTo(-2.5,-5); g.closePath(); g.fill(); g.stroke(); g.restore();
  g.restore();
  // ramme-info
  if(inset){ box(g,x0+w-46,y0+h-20,44,18,'rgba(0,0,0,.7)'); txt(g,RANGE+'NM',x0+w-24,y0+h-11,'#fff',F(600,10),'center'); g.strokeStyle='#7a838c'; g.lineWidth=1.5; g.strokeRect(x0,y0,w,h); return; }
  box(g,x0+w-150,y0+8,140,26,'rgba(0,0,0,.7)'); txt(g,trackUp?'TRACK UP':'NORTH UP',x0+w-80,y0+21,'#fff',F(600,12),'center');
  if(!trackUp){ g.save(); g.translate(x0+w-34,y0+66); g.fillStyle='#fff'; g.beginPath(); g.moveTo(0,-14); g.lineTo(-7,6); g.lineTo(7,6); g.closePath(); g.fill(); txt(g,'N',0,16,'#fff',F(700,11),'center'); g.restore(); }
  box(g,x0+w-110,y0+h-34,100,26,'rgba(0,0,0,.7)'); txt(g,RANGE+' NM',x0+w-60,y0+h-21,'#fff',F(600,13),'center');
  // vind
  if(d.wind.spd>0.5){ box(g,x0+10,y0+10,110,40,'rgba(0,0,0,.7)'); g.save(); g.translate(x0+30,y0+30); g.rotate((d.wind.dir+180)*D2R+rot); g.strokeStyle='#fff'; g.fillStyle='#fff'; g.lineWidth=2; g.beginPath(); g.moveTo(0,10); g.lineTo(0,-8); g.stroke(); g.beginPath(); g.moveTo(0,-12); g.lineTo(-5,-3); g.lineTo(5,-3); g.closePath(); g.fill(); g.restore(); txt(g,pad3(d.wind.dir)+'° '+Math.round(d.wind.spd)+'KT',x0+48,y0+30,'#fff',F(600,12)); }
}
function mfd(st,d){
  if(!st.w) return; const g=begin(st);
  g.fillStyle='#000'; g.fillRect(0,0,VW,VH);
  drawMap(g,d,{x:212,y:40,w:VW-212,h:VH-64-40}); eis(g,d);
  topBar(g,d,()=>mfdField(g,d));
  if(d.winM) drawWin(g,d.winM,{x:VW-430,y:48,w:422,h:VH-64-56});
  box(g,212,VH-64,VW-212,40,'rgba(0,0,0,.8)');
  txt(g,d.mfdPage==='NRST'?'NRST – NEAREST AIRPORTS':'MAP – NAVIGATION MAP',230,VH-44,COL.txt,F(600,13));
  ['MAP','NRST'].forEach((pg,i)=>{ const x=VW-150+i*72; box(g,x,VH-56,64,22,pg===d.mfdPage?'#cfd6dc':'#1d2228'); txt(g,pg,x+32,VH-45,pg===d.mfdPage?'#000':COL.txt,F(600,11),'center'); });
  softkeys(g,d.softMFD);
}

function blank(st){ if(!st.w) return; const g=begin(st); g.fillStyle='#020303'; g.fillRect(0,0,VW,VH); }
function splash(st,t,line){ if(!st.w) return; const g=begin(st); g.fillStyle='#000'; g.fillRect(0,0,VW,VH);
  txt(g,'BIRDBIRD AVIONICS',VW/2,VH/2-60,'#cfd6dc',F(700,30),'center'); txt(g,'Training display system',VW/2,VH/2-22,COL.gray,F(500,16),'center');
  if(line){ txt(g,line,VW/2,VH/2+40,COL.cyan,F(700,18),'center'); return; }
  const w=360, p=Math.min(1,t/4); box(g,VW/2-w/2,VH/2+30,w,10,'#1d2228'); box(g,VW/2-w/2,VH/2+30,w*p,10,COL.cyan); txt(g,'SELF TEST',VW/2,VH/2+64,COL.gray,F(600,13),'center'); }
G.GLASS={pfd,mfd,blank,splash,VW,VH};
})(window);
