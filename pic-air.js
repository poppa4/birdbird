/* NORDAP – pic-air.js: "What the altimeter and the airspeed indicator really measure" for airdata.html (uses corepic.js).
   Scene 1 (steps 1–4): a side view with the pressure surfaces over the terrain; the altimeter follows a pressure surface,
   so a fall in pressure or a cold day puts you lower than it shows. Scene 2 (steps 5–6): the pitot-static system.
   ISA; 1 hPa ≈ 27 ft near sea level (rule of thumb 30 ft); cold error ≈ 4 % of height per 10 °C below ISA. Illustrative values. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const FT_HPA=27, ELEV=700, IND=3000;

const steps=[
 {t:{en:'The altimeter is a barometer',no:'Høydemåleren er et barometer'},
  d:{en:'It measures only the <em>static pressure</em> outside and turns it into feet with the standard atmosphere: about <em>27–30 ft per hPa</em> near the ground. Fly a constant reading and you follow a pressure surface, not the ground.',
     no:'Den måler bare det <em>statiske trykket</em> utenfor og gjør det om til fot med standardatmosfæren: omtrent <em>27–30 ft per hPa</em> nær bakken. Flyr du konstant visning, følger du en trykkflate, ikke bakken.'}},
 {t:{en:'QNH, QFE and 1013',no:'QNH, QFE og 1013'},
  d:{en:'Set <em>QNH</em> and on the runway it shows the aerodrome elevation (altitude above sea level). <em>QFE</em> shows zero (height above the aerodrome). <em>1013</em> gives pressure altitude: flight levels above the transition altitude.',
     no:'Still inn <em>QNH</em>, og på banen viser den flyplassens høyde over havet (altitude). <em>QFE</em> viser null (høyde over flyplassen). <em>1013</em> gir trykkhøyde: flygenivåer over overgangshøyden.'}},
 {t:{en:'From high to low, look out below',no:'Fra høyt til lavt, se opp nedover'},
  d:{en:'Fly from 1 020 hPa towards 1 000 hPa without resetting QNH: the pressure surface you follow sinks by 20 × 27 ≈ <em>540 ft</em>. The altimeter still shows 3 000 ft. The ground does not move.',
     no:'Fly fra 1 020 hPa mot 1 000 hPa uten å stille om QNH: trykkflaten du følger, synker med 20 × 27 ≈ <em>540 ft</em>. Høydemåleren viser fortsatt 3 000 ft. Bakken flytter seg ikke.'}},
 {t:{en:'Cold air · lower than you think',no:'Kald luft · lavere enn du tror'},
  d:{en:'Cold air is denser, so the pressure layers squeeze together. On a day 20 °C below ISA you are about <em>8 % lower</em> above the station than the altimeter shows (4 % per 10 °C). Correct the minimum altitudes.',
     no:'Kald luft er tettere, så trykklagene presses sammen. En dag 20 °C under ISA er du omtrent <em>8 % lavere</em> over stasjonen enn høydemåleren viser (4 % per 10 °C). Korriger minstehøydene.'}},
 {t:{en:'Airspeed · total minus static',no:'Fart · total minus statisk'},
  d:{en:'The <em>pitot tube</em> feels total pressure (static + ram air); the <em>static port</em> feels static only. The airspeed indicator shows the difference: dynamic pressure, read as IAS. TAS is higher: about +2 % per 1 000 ft.',
     no:'<em>Pitotrøret</em> merker totaltrykk (statisk + fartstrykk); <em>den statiske porten</em> merker bare statisk. Fartsmåleren viser forskjellen: dynamisk trykk, lest som IAS. TAS er høyere: omtrent +2 % per 1 000 ft.'}},
 {t:{en:'Blocked pitot or static',no:'Blokkert pitot eller statisk'},
  d:{en:'Pitot <em>and</em> its drain blocked: the trapped air makes the ASI act like an altimeter (over-reads as you climb). Static blocked: altimeter frozen, VSI at zero, ASI under-reads in a climb. Use the alternate static.',
     no:'Pitot <em>og</em> dreneringshull blokkert: den innestengte luften gjør at fartsmåleren oppfører seg som en høydemåler (viser for mye når du stiger). Statisk blokkert: høydemåleren står, VSI viser null, fartsmåleren viser for lite i stigning. Bruk alternativ statisk.'},
  go:{en:'Open the air data lab',no:'Åpne luftdatalabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function dial(g,cx,cy,r,ft,sub,o){ o=o||{};
  g.save(); g.fillStyle='#0b1116'; g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1.5; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill(); g.stroke();
  for(let i=0;i<50;i++){ const a=i/50*Math.PI*2-Math.PI/2, maj=i%5===0; g.strokeStyle=maj?'#cfd6dc':'rgba(255,255,255,.35)'; g.lineWidth=maj?1.6:1;
    g.beginPath(); g.moveTo(cx+Math.cos(a)*(r-2),cy+Math.sin(a)*(r-2)); g.lineTo(cx+Math.cos(a)*(r-(maj?9:5)),cy+Math.sin(a)*(r-(maj?9:5))); g.stroke();
    if(maj) txt(g,String(i/5),cx+Math.cos(a)*(r-17),cy+Math.sin(a)*(r-17)+4,{mono:1,size:r*.17,col:'#E2E8EE',al:'center'}); }
  // Kollsman window
  rr(g,cx+r*.18,cy-r*.12,r*.56,r*.26,3); g.fillStyle='#000'; g.fill(); txt(g,sub,cx+r*.46,cy+r*.07,{mono:1,size:r*.17,col:o.subCol||C.amber,al:'center'});
  const hand=(v,len,w,col)=>{ const a=v*Math.PI*2-Math.PI/2; g.strokeStyle=col; g.lineWidth=w; g.lineCap='round'; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len); g.stroke(); };
  hand((ft%10000)/10000,r*.45,4,'#E2E8EE'); hand((ft%1000)/1000,r*.78,2.4,'#fff');
  g.fillStyle='#fff'; g.beginPath(); g.arc(cx,cy,3,0,7); g.fill();
  txt(g,`${nf(ft)} ft`,cx,cy+r+15,{mono:1,size:11,col:'#fff',al:'center',w:600}); g.restore(); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const s2=at(p,4,.9), s1=1-s2;
  if(s1>0.01){ g.save(); g.globalAlpha=s1;
    // scene 1: side view
    const yG=H*.86, top=H*.08, hMax=4400, Y=h=>yG-(yG-top)*h/hMax;
    const x0=W*(sm?.16:.2), x1=W*.97;
    const mov=at(p,2,.95), cold=at(p,3,.9)*(1-0);
    const ac=lerp(x0+W*.06,x1-W*(sm?.3:.2),mov);              // aircraft x
    const qnhAt=x=>lerp(1020,1000,clamp((x-x0)/(x1-x0),0,1))*mov+1013*(1-mov);  // sea-level pressure along the line
    const terrain=x=>{ const u=(x-x0)/(x1-x0); return ELEV+Math.max(0,1600*Math.exp(-Math.pow((u-.78)/.09,2)))+Math.max(0,600*Math.exp(-Math.pow((u-.45)/.12,2))); };
    // sky
    const sky=g.createLinearGradient(0,0,0,yG); sky.addColorStop(0,cold>.3?'#1a2638':'#16212c'); sky.addColorStop(1,cold>.3?'#2a3f5c':'#26364a'); g.fillStyle=sky; g.fillRect(0,0,W,yG);
    // true height of the indicated surface at x (QNH set at the start = 1020 when moving, 1013 otherwise)
    const setQ=mov>0?lerp(1013,1020,mov):1013;
    const coldF=1-0.08*cold;                                               // −20 °C: 8 % lower above the station
    const surf=(x,ind)=>{ const drop=(setQ-qnhAt(x))*FT_HPA; return ELEV+((ind-drop)-ELEV)*coldF; };
    // pressure surfaces
    for(let ind=1000;ind<=4000;ind+=1000){ const isAc=ind===IND; g.strokeStyle=isAc?'rgba(127,198,238,.85)':'rgba(127,198,238,.28)'; g.lineWidth=isAc?2:1; g.setLineDash(isAc?[]:[6,6]);
      g.beginPath(); for(let x=x0;x<=x1;x+=6){ const y=Y(surf(x,ind)); x===x0?g.moveTo(x,y):g.lineTo(x,y); } g.stroke(); g.setLineDash([]);
      txt(g,`${nf(Math.round(setQ-(ind)/FT_HPA))} hPa`,x1-4,Y(surf(x1,ind))-5,{mono:1,size:9.5*fs,col:isAc?'#9FD4F2':'rgba(159,212,242,.6)',al:'right'}); }
    // terrain
    g.fillStyle='#1d2b22'; g.beginPath(); g.moveTo(0,H); g.lineTo(0,Y(ELEV)); for(let x=0;x<=W;x+=4) g.lineTo(x,Y(x<x0?ELEV:terrain(x))); g.lineTo(W,H); g.closePath(); g.fill();
    g.strokeStyle='rgba(120,170,130,.5)'; g.lineWidth=1; g.beginPath(); for(let x=0;x<=W;x+=4){ const y=Y(x<x0?ELEV:terrain(x)); x?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
    // sea level reference
    g.strokeStyle='rgba(255,255,255,.18)'; g.setLineDash([2,4]); g.beginPath(); g.moveTo(0,Y(0)); g.lineTo(W,Y(0)); g.stroke(); g.setLineDash([]);
    txt(g,L({en:'mean sea level',no:'middelvannstand'}),W-8,Y(0)-4,{mono:1,size:9*fs,col:'#7F8B96',al:'right'});
    // aerodrome
    const ax0=x0-W*.02; g.fillStyle='#3A444C'; g.fillRect(ax0-W*.07,Y(ELEV)-3,W*.12,4); txt(g,`${L({en:'aerodrome',no:'flyplass'})} ${ELEV} ft`,ax0-W*.07,Y(ELEV)-8*fs,{mono:1,size:9.5*fs,col:'#AEB8C1'});
    // high / low
    if(mov>0.05){ g.save(); g.globalAlpha*=mov; txt(g,'H',x0+10,top+30,{size:28*fs,col:C.blue,w:700}); txt(g,'1020',x0+34,top+28,{mono:1,size:10*fs,col:C.blue});
      txt(g,'L',x1-60,top+30,{size:28*fs,col:C.red,w:700}); txt(g,'1000',x1-36,top+28,{mono:1,size:10*fs,col:C.red}); arrow(g,x0+90,top+22,x1-80,top+22,'rgba(255,255,255,.35)',{lw:1.2,dash:[4,4]}); g.restore(); }
    // QNH / QFE / 1013 at the aerodrome (step 2)
    const a1=at(p,1,.7)*(1-at(p,2,.6));
    if(a1>0){ g.save(); g.globalAlpha*=a1; const bx=ax0-W*.01, ry=Y(ELEV);
      const tag=(lab,y,col,val)=>{ g.strokeStyle=col; g.lineWidth=1.5; g.beginPath(); g.moveTo(bx,ry); g.lineTo(bx,y); g.stroke(); g.beginPath(); g.moveTo(bx-5,y); g.lineTo(bx+5,y); g.stroke(); pill(g,`${lab} → ${val}`,bx+10,(ry+y)/2,{mono:1,size:10.5*fs,col}); };
      tag('QNH',Y(0),C.green,`${ELEV} ft`); pill(g,`QFE → 0 ft`,bx+10,ry-16,{mono:1,size:10.5*fs,col:C.amber});
      pill(g,`1013 → ${L({en:'pressure altitude',no:'trykkhøyde'})}`,bx+10,ry-40,{mono:1,size:10.5*fs,col:C.violet}); g.restore(); }
    // the aircraft follows the indicated surface
    const ah=surf(ac,IND), ay=Y(ah);
    CORE.U.jet(g,{x:ac,y:ay+2.4*Math.max(2,W/420),s:Math.max(1.6,W/420),pitch:0,gear:0,tm});
    // true altitude bracket and the gap
    const gapK=Math.max(mov,cold);
    if(gapK>0.02){ const yTrue=Y(ah), yInd=Y(IND); g.save(); g.globalAlpha*=gapK; g.strokeStyle='rgba(255,255,255,.5)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(ac-60,yInd); g.lineTo(ac+60,yInd); g.stroke(); g.setLineDash([]);
      txt(g,L({en:'where the altimeter says you are',no:'der høydemåleren sier du er'}),ac-64,yInd+4,{size:10.5*fs,col:'#AEB8C1',al:'right'});
      arrow(g,ac+30,yInd,ac+30,yTrue-2,C.red,{lw:2,head:7}); pill(g,`${L({en:'true',no:'virkelig'})} ${nf(Math.round(ah/10)*10)} ft`,ac+40,(yInd+yTrue)/2+6,{mono:1,size:10.5*fs,col:'#FF8A78',fit:W}); g.restore(); }
    // terrain clearance under the aircraft's path ahead (step 3+)
    if(mov>.6){ const xr=x0+(x1-x0)*.78, clr=surf(xr,IND)-terrain(xr); g.save(); g.globalAlpha*=clamp((mov-.6)*2.5,0,1); pill(g,`${L({en:'clearance over the ridge',no:'klaring over ryggen'})} ${nf(Math.round(clr/10)*10)} ft`,xr,Y(terrain(xr))+22*fs,{mono:1,size:10*fs,col:clr<500?'#FF8A78':'#8EDDB0',al:'center',fit:W}); g.restore(); }
    // thermometer when cold
    if(cold>0.02){ g.save(); g.globalAlpha*=cold; pill(g,`OAT ISA −20 °C`,x0+12,top+64,{mono:1,size:10.5*fs,col:C.blue}); g.restore(); }
    // the altimeter
    const dr=sm?30:Math.min(54,H*.11); dial(g,(sm?dr+10:W*.1),sm?H*.47:H*.32,dr,IND,`${nf(Math.round(setQ))}`);
    g.restore(); }
  if(s2>0.01){ g.save(); g.globalAlpha=s2;
    // scene 2: pitot-static
    const cx=W*.5, fy=H*.24, fw=W*(sm?.86:.62), fx=cx-fw/2, fh=H*.17;
    // fuselage nose section
    g.fillStyle='#C9D1D8'; g.strokeStyle='rgba(10,16,21,.6)'; g.beginPath(); g.moveTo(fx,fy+fh*.2); g.lineTo(fx+fw*.82,fy+fh*.2); g.quadraticCurveTo(fx+fw,fy+fh*.2,fx+fw,fy+fh*.6); g.quadraticCurveTo(fx+fw,fy+fh,fx+fw*.82,fy+fh); g.lineTo(fx,fy+fh); g.closePath(); g.fill(); g.stroke();
    // pitot tube under the nose, pointing forward (right)
    const px=fx+fw*.72, py=fy+fh+16; g.strokeStyle='#8C98A2'; g.lineWidth=4; g.beginPath(); g.moveTo(px,fy+fh); g.lineTo(px,py); g.lineTo(px+fw*.14,py); g.stroke();
    // static port on the side
    const sx=fx+fw*.45, sy=fy+fh*.6; g.fillStyle='#1A2128'; g.beginPath(); g.arc(sx,sy,5,0,7); g.fill(); g.strokeStyle='#8C98A2'; g.lineWidth=1.5; g.stroke();
    // ram air
    for(let k=0;k<5;k++){ const ph=((tm*1.2+k/5)%1); g.strokeStyle=`rgba(240,180,64,${.6*(1-ph)})`; g.lineWidth=1.5; g.beginPath(); g.moveTo(px+fw*.3-ph*fw*.14,py-4+k*2); g.lineTo(px+fw*.3-ph*fw*.14-16,py-4+k*2); g.stroke(); }
    txt(g,L({en:'ram air',no:'fartsluft'}),px+fw*.22,py-12,{size:10.5*fs,col:C.amber,w:600});
    pill(g,L({en:'pitot: total pressure',no:'pitot: totaltrykk'}),px+fw*.07,py+20,{size:10.5*fs,col:C.amber,al:'center',fit:W});
    pill(g,L({en:'static port',no:'statisk port'}),sx,fy-12,{size:10.5*fs,col:C.blue,al:'center'});
    // instruments
    const iy=H*.74, ir=sm?26:Math.min(46,H*.1), xs=[cx-ir*3.3,cx,cx+ir*3.3];
    const blk=at(p,5,.8);
    // lines
    const busY=iy-ir-26;
    g.lineWidth=2.5; g.strokeStyle=C.amber; g.beginPath(); g.moveTo(px,py); g.lineTo(px,busY-16); g.lineTo(xs[0]-10,busY-16); g.lineTo(xs[0]-10,iy-ir); g.stroke();
    g.strokeStyle=C.blue; g.beginPath(); g.moveTo(sx,sy); g.lineTo(sx,busY); g.lineTo(xs[0]+10,busY); g.lineTo(xs[0]+10,iy-ir); g.moveTo(xs[0]+10,busY); g.lineTo(xs[2],busY); g.lineTo(xs[2],iy-ir); g.moveTo(xs[1],busY); g.lineTo(xs[1],iy-ir); g.stroke();
    // flowing dots
    const flow=(pts,col,sp)=>{ let len=0; const seg=[]; for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(d); len+=d; }
      for(let k=0;k<6;k++){ let u=((tm*sp+k/6)%1)*len, i=0; while(i<seg.length&&u>seg[i]){ u-=seg[i]; i++; } if(i>=seg.length) continue; const a=pts[i], b=pts[i+1], t=u/seg[i];
        g.fillStyle=col; g.beginPath(); g.arc(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,2.4,0,7); g.fill(); } };
    flow([[px,py],[px,busY-16],[xs[0]-10,busY-16],[xs[0]-10,iy-ir]],'#FFE2A8',.35*(1-blk));
    flow([[sx,sy],[sx,busY],[xs[2],busY],[xs[2],iy-ir]],'#CFEAF9',.3*(1-blk));
    // instrument faces
    const lab=[['ASI',L({en:'total − static',no:'total − statisk'})],[L({en:'ALT',no:'HØYDE'}),L({en:'static',no:'statisk'})],['VSI',L({en:'static, rate',no:'statisk, endring'})]];
    xs.forEach((x,i)=>{ g.fillStyle='#0b1116'; g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1.5; g.beginPath(); g.arc(x,iy,ir,0,7); g.fill(); g.stroke();
      const wob=blk>.5?(i===0?0.35+0.25*Math.sin(tm*.7):i===1?0.3:0.0):(i===0?0.5:i===1?0.3+0.01*Math.sin(tm):0.02*Math.sin(tm*1.3));
      const a=wob*Math.PI*1.6-Math.PI*1.3; g.strokeStyle='#fff'; g.lineWidth=2.5; g.beginPath(); g.moveTo(x,iy); g.lineTo(x+Math.cos(a)*ir*.78,iy+Math.sin(a)*ir*.78); g.stroke();
      txt(g,lab[i][0],x,iy+ir+16*fs,{mono:1,size:11*fs,col:'#fff',al:'center',w:600}); txt(g,lab[i][1],x,iy+ir+30*fs,{size:10*fs,col:'#AEB8C1',al:'center'}); });
    // dynamic pressure note
    if(blk<.5){ pill(g,L({en:'IAS = what the difference reads',no:'IAS = det forskjellen viser'}),xs[0],iy-ir-50,{size:10.5*fs,col:'#fff',al:'center',fit:W,a:1-blk*2}); }
    // blockages
    if(blk>0.01){ g.save(); g.globalAlpha*=blk;
      g.fillStyle='#DDEBF5'; g.beginPath(); g.arc(px+fw*.14,py,7,0,7); g.fill(); pill(g,L({en:'ice: pitot + drain blocked',no:'is: pitot + drenering blokkert'}),px+fw*.14,py+44,{size:10.5*fs,col:'#DDEBF5',al:'center',fit:W});
      g.fillStyle=C.red; g.beginPath(); g.arc(sx,sy,6,0,7); g.fill();
      pill(g,L({en:'acts like an altimeter',no:'oppfører seg som høydemåler'}),xs[0],iy-ir-50,{size:10.5*fs,col:'#FF8A78',al:'center',fit:W});
      pill(g,L({en:'frozen',no:'står fast'}),xs[1],iy-ir-12,{size:10.5*fs,col:'#FF8A78',al:'center'}); pill(g,L({en:'zero',no:'null'}),xs[2],iy-ir-12,{size:10.5*fs,col:'#FF8A78',al:'center'});
      g.restore(); }
    g.restore(); }
  txt(g,L({en:'schematic · heights not to scale',no:'skjematisk · høyder ikke i skala'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.15,dwell:6.5,
    title:{en:'What the altimeter and the airspeed indicator really measure',no:'Hva høydemåleren og fartsmåleren egentlig måler'},
    sub:{en:'Both are pressure gauges. Follow the pressure surface the altimeter flies, then the two pipes that feed the airspeed.',no:'Begge er trykkmålere. Følg trykkflaten høydemåleren flyr, så de to rørene som gir farten.'},
    label:{en:'Animated side view of pressure surfaces over terrain with an aircraft following one of them, then the pitot-static system feeding the airspeed indicator, altimeter and VSI.',no:'Animert sidebilde av trykkflater over terreng med et fly som følger en av dem, deretter pitot-statisk system som forsyner fartsmåler, høydemåler og VSI.'},
    foot:{en:'ISA; 1 hPa ≈ 27 ft near sea level; cold error ≈ 4 % of the height above the station per 10 °C below ISA. Schematic, illustrative values.',no:'ISA; 1 hPa ≈ 27 ft nær havnivå; kuldefeil ≈ 4 % av høyden over stasjonen per 10 °C under ISA. Skjematisk, illustrerende verdier.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
