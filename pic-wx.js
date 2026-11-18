/* NORDAP – pic-wx.js: "Read a METAR in five chunks" for wxreports.html (uses corepic.js).
   One METAR string; each step lights up a chunk and draws what it means: wind on a runway, visibility and RVR,
   weather and cloud on a side view, temperature/dew point and QNH, then the trend. Example values only. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT,deck,cumulus}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const TOK=[['METAR',0],['ENZV',0],['181150Z',0],['24018G30KT',1],['210V270',1],['4000',2],['R18/P1500',2],['-SHRA',3],['BKN012',3],['SCT025CB',3],['08/06',4],['Q0998',4],['TEMPO',5],['1500',5],['SHRA',5],['BKN008',5]];

const steps=[
 {t:{en:'Wind · from where, how strong',no:'Vind · hvorfra, hvor sterk'},
  d:{en:'<em>24018G30KT</em>: from 240° (true), 18 kt, gusting 30. <em>210V270</em>: the direction varies. On runway 18 that is a strong <em>crosswind from the right</em> — use the gust for the crosswind check.',
     no:'<em>24018G30KT</em>: fra 240° (rettvisende), 18 kt, kast 30. <em>210V270</em>: retningen varierer. På bane 18 er det sterk <em>sidevind fra høyre</em> — bruk kastet når du sjekker sidevinden.'}},
 {t:{en:'Visibility and RVR',no:'Sikt og RVR'},
  d:{en:'<em>4000</em>: prevailing visibility 4 000 m. <em>R18/P1500</em>: runway visual range on runway 18 is <em>more than</em> 1 500 m. RVR is what you compare with approach minima.',
     no:'<em>4000</em>: dominerende sikt 4 000 m. <em>R18/P1500</em>: rullebanesikt på bane 18 er <em>mer enn</em> 1 500 m. Det er RVR du sammenligner med innflygingsminima.'}},
 {t:{en:'Weather and cloud',no:'Vær og skyer'},
  d:{en:'<em>-SHRA</em>: light showers of rain. <em>BKN012</em>: 5–7 oktas at 1 200 ft — that is the <em>ceiling</em>. <em>SCT025CB</em>: scattered cumulonimbus at 2 500 ft. Heights are above the aerodrome.',
     no:'<em>-SHRA</em>: svake regnbyger. <em>BKN012</em>: 5–7 oktas på 1 200 ft — det er <em>skyhøyden (ceiling)</em>. <em>SCT025CB</em>: spredt cumulonimbus på 2 500 ft. Høydene er over flyplassen.'}},
 {t:{en:'Temperature, dew point, QNH',no:'Temperatur, duggpunkt, QNH'},
  d:{en:'<em>08/06</em>: 8 °C, dew point 6 °C — only 2 °C apart, so moist air and low cloud. <em>Q0998</em>: QNH 998 hPa, set it before the approach.',
     no:'<em>08/06</em>: 8 °C, duggpunkt 6 °C — bare 2 °C fra hverandre, så fuktig luft og lave skyer. <em>Q0998</em>: QNH 998 hPa, still den inn før innflygingen.'}},
 {t:{en:'TEMPO · what may come',no:'TEMPO · hva som kan komme'},
  d:{en:'<em>TEMPO 1500 SHRA BKN008</em>: for periods of less than an hour, visibility 1 500 m in moderate showers and ceiling 800 ft. Plan for the worse condition when it matters.',
     no:'<em>TEMPO 1500 SHRA BKN008</em>: i perioder kortere enn en time, sikt 1 500 m i moderate byger og skyhøyde 800 ft. Planlegg for den dårligste tilstanden når det betyr noe.'},
  go:{en:'Decode your own METAR and TAF',no:'Dekod din egen METAR og TAF',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const cur=clamp(Math.round(p),0,4)+1;
  // the METAR line, with chunks highlighted
  g.font=`500 ${(sm?11:15)*fs}px ${FONT.mono}`; const sp=g.measureText(' ').width;
  let x=W*.04, y=H*.1; const maxX=W*.96;
  TOK.forEach(([t,grp])=>{ const w=g.measureText(t).width; if(x+w>maxX){ x=W*.04; y+=(sm?20:26)*fs; }
    const on=grp===cur, past=grp&&grp<cur;
    if(on){ rr(g,x-4,y-(sm?13:17)*fs,w+8,(sm?18:24)*fs,4); g.fillStyle='rgba(228,107,174,.22)'; g.fill(); g.strokeStyle='#E46BAE'; g.stroke(); }
    txt(g,t,x,y,{mono:1,size:(sm?11:15)*fs,col:on?'#fff':past?'#AEB8C1':'#5F6D77',w:on?600:500}); x+=w+sp*1.4; });
  const top=y+H*.06;
  // panel area
  const P={x:W*.04,y:top,w:W*.92,h:H-top-18};
  const a1=1-Math.min(1,Math.abs(p-0)*1.6), a2=1-Math.min(1,Math.abs(p-1)*1.6), a3=1-Math.min(1,Math.abs(p-2)*1.6), a4=1-Math.min(1,Math.abs(p-3)*1.6), a5=1-Math.min(1,Math.abs(p-4)*1.6);
  // 1: wind on runway 18
  if(a1>0.01){ g.save(); g.globalAlpha=a1; const cx=P.x+P.w*.35, cy=P.y+P.h*.5, R=Math.min(P.w*.22,P.h*.42);
    g.save(); g.translate(cx,cy); g.fillStyle='#3A444C'; g.fillRect(-R*.12,-R,R*.24,R*2); g.strokeStyle='rgba(255,255,255,.7)'; g.setLineDash([10,8]); g.beginPath(); g.moveTo(0,-R*.85); g.lineTo(0,R*.85); g.stroke(); g.setLineDash([]); txt(g,'18',0,-R*.9+14,{mono:1,size:12,col:'#fff',al:'center',w:600}); txt(g,'36',0,R*.9-4,{mono:1,size:12,col:'#fff',al:'center',w:600}); g.restore();
    // variable sector
    g.fillStyle='rgba(127,198,238,.12)'; g.beginPath(); g.moveTo(cx,cy); g.arc(cx,cy,R*1.05,(210-90)*Math.PI/180,(270-90)*Math.PI/180); g.closePath(); g.fill();
    const wa=(240-90)*Math.PI/180+Math.sin(tm*.8)*.15, gust=.75+.25*Math.max(0,Math.sin(tm*1.7));
    arrow(g,cx+Math.cos(wa)*R*1.2,cy+Math.sin(wa)*R*1.2,cx+Math.cos(wa)*R*(1.2-.75*gust),cy+Math.sin(wa)*R*(1.2-.75*gust),C.blue,{lw:4,head:13});
    txt(g,'240°',cx+Math.cos(wa)*R*1.32,cy+Math.sin(wa)*R*1.32+4,{mono:1,size:11*fs,col:'#9FD4F2',al:'center'});
    // components (runway heading 180)
    const ang=(240-180)*Math.PI/180, xw=30*Math.sin(ang), hw=30*Math.cos(ang);
    const bx=P.x+P.w*.62; txt(g,L({en:'with the gust, 30 kt',no:'med kastet, 30 kt'}),bx,cy-28,{size:12*fs,col:'#AEB8C1'});
    txt(g,`${L({en:'crosswind',no:'sidevind'})}  ${nf(xw)} kt`,bx,cy,{mono:1,size:15*fs,col:C.amber,w:600}); txt(g,`${L({en:'headwind',no:'motvind'})}  ${nf(hw)} kt`,bx,cy+24,{mono:1,size:15*fs,col:'#fff'});
    g.restore(); }
  // 2: visibility and RVR
  if(a2>0.01){ g.save(); g.globalAlpha=a2; const gy=P.y+P.h*.8, x0=P.x+20, x1=P.x+P.w-20, X=m=>x0+(x1-x0)*m/5000;
    g.fillStyle='#1b2a22'; g.fillRect(P.x,gy,P.w,P.h*.2); g.fillStyle='#3A444C'; g.fillRect(x0,gy-3,X(2400)-x0,6);
    for(let m=0;m<=2400;m+=60){ g.fillStyle=`rgba(255,236,190,${clamp(1-m/1700,0,1)*.9+.05})`; g.fillRect(X(m)-1,gy-6,2,2); }
    const fog=g.createLinearGradient(x0,0,x1,0); fog.addColorStop(0,'rgba(200,210,220,0)'); fog.addColorStop(.8,'rgba(200,210,220,.5)'); fog.addColorStop(1,'rgba(200,210,220,.65)'); g.fillStyle=fog; g.fillRect(x0,P.y+P.h*.1,x1-x0,gy-P.y-P.h*.1);
    const dim=(m,lab,col,yy)=>{ g.strokeStyle=col; g.lineWidth=1.5; g.beginPath(); g.moveTo(x0,yy); g.lineTo(X(m),yy); g.moveTo(X(m),yy-5); g.lineTo(X(m),yy+5); g.stroke(); pill(g,lab,(x0+X(m))/2,yy-14,{mono:1,size:11*fs,col,al:'center'}); };
    dim(4000,L({en:'visibility 4 000 m',no:'sikt 4 000 m'}),'#fff',P.y+P.h*.3); dim(1500,'RVR > 1 500 m',C.amber,gy-30);
    g.restore(); }
  // 3: weather and cloud side view
  if(a3>0.01){ g.save(); g.globalAlpha=a3; const gy=P.y+P.h*.9, Y=ft=>gy-(gy-P.y-10)*ft/3200;
    g.fillStyle='#1b2a22'; g.fillRect(P.x,gy,P.w,P.h*.1);
    deck(g,P.x+10,P.x+P.w*.6,x=>Y(1200),x=>Y(1650)+Math.sin(x*.04)*4,{alpha:.92,billow:12,dark:'96,108,122'});
    cumulus(g,P.x+P.w*.8,Y(2500),P.y+18,P.w*.13,{dark:1,anvil:P.w*.12,seed:2});
    for(let k=0;k<30;k++){ const ph=((tm*1.2+k*.618)%1), x=P.x+20+((k*37)%1000)/1000*P.w*.55, y=lerp(Y(1200),gy,ph); g.strokeStyle='rgba(127,198,238,.45)'; g.beginPath(); g.moveTo(x,y); g.lineTo(x-2,y+8); g.stroke(); }
    [[1200,'BKN012 · ceiling',C.amber],[2500,'SCT025CB','#FF8A78']].forEach(([h,l,c])=>{ g.strokeStyle=c; g.setLineDash([4,4]); g.beginPath(); g.moveTo(P.x,Y(h)); g.lineTo(P.x+P.w,Y(h)); g.stroke(); g.setLineDash([]); pill(g,l,P.x+P.w-8,Y(h)-12,{mono:1,size:10.5*fs,col:c,al:'right'}); });
    pill(g,L({en:'-SHRA: light rain showers',no:'-SHRA: svake regnbyger'}),P.x+P.w*.3,gy-16,{size:10.5*fs,col:'#9FD4F2',al:'center'});
    txt(g,L({en:'oktas: FEW 1–2 · SCT 3–4 · BKN 5–7 · OVC 8',no:'oktas: FEW 1–2 · SCT 3–4 · BKN 5–7 · OVC 8'}),P.x+8,P.y+14,{mono:1,size:10*fs,col:'#AEB8C1'});
    g.restore(); }
  // 4: temperature / dew point and QNH
  if(a4>0.01){ g.save(); g.globalAlpha=a4; const cx=P.x+P.w*.25, cy=P.y+P.h*.55, th=P.h*.7;
    const tY=t=>cy+th/2-(t+10)/30*th; g.fillStyle='rgba(255,255,255,.08)'; rr(g,cx-10,cy-th/2,20,th,10); g.fill();
    g.fillStyle=C.red; rr(g,cx-6,tY(8),12,cy+th/2-tY(8),6); g.fill(); g.fillStyle='#71CC93'; g.fillRect(cx-22,tY(6)-1,44,2);
    txt(g,'8 °C',cx+18,tY(8)+4,{mono:1,size:12*fs,col:'#FF8A78'}); txt(g,L({en:'dew point 6 °C',no:'duggpunkt 6 °C'}),cx+28,tY(6)+16,{mono:1,size:11*fs,col:'#8EDDB0'});
    pill(g,L({en:'spread 2 °C: moist, low cloud, mist risk',no:'spredning 2 °C: fuktig, lave skyer, fare for tåke'}),cx,cy+th/2+20,{size:10.5*fs,col:'#fff',al:'center',fit:W});
    const qx=P.x+P.w*.7; txt(g,'QNH',qx,cy-30,{mono:1,size:12*fs,col:'#AEB8C1',al:'center'}); txt(g,'998',qx,cy+10,{mono:1,size:(sm?30:42)*fs,col:C.amber,al:'center',w:600}); txt(g,'hPa',qx,cy+34,{mono:1,size:12*fs,col:'#AEB8C1',al:'center'});
    g.restore(); }
  // 5: TEMPO timeline
  if(a5>0.01){ g.save(); g.globalAlpha=a5; const x0=P.x+20, x1=P.x+P.w-20, y0=P.y+P.h*.3, y1=P.y+P.h*.7;
    g.strokeStyle='rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(x0,y1); g.lineTo(x1,y1); g.stroke();
    for(let h=0;h<=6;h++){ const x=lerp(x0,x1,h/6); g.beginPath(); g.moveTo(x,y1-4); g.lineTo(x,y1+4); g.stroke(); txt(g,`${12+h}Z`,x,y1+18,{mono:1,size:10*fs,col:'#7F8B96',al:'center'}); }
    g.fillStyle='rgba(113,204,147,.25)'; g.fillRect(x0,y0,x1-x0,y1-y0); txt(g,L({en:'mostly: 4 000 m, BKN012',no:'mest: 4 000 m, BKN012'}),x0+8,y0+18,{size:11*fs,col:'#8EDDB0',w:600});
    [[.8,1.5],[2.6,3.1],[4.2,4.8]].forEach(([a,b])=>{ const xa=lerp(x0,x1,a/6), xb=lerp(x0,x1,b/6); g.fillStyle='rgba(240,180,64,.55)'; g.fillRect(xa,y0+(y1-y0)*.4,xb-xa,(y1-y0)*.6); });
    pill(g,L({en:'TEMPO: < 1 h at a time — 1 500 m, BKN008',no:'TEMPO: < 1 t om gangen — 1 500 m, BKN008'}),(x0+x1)/2,y0-18,{size:11*fs,col:C.amber,al:'center',fit:W});
    g.restore(); }
  txt(g,L({en:'example report',no:'eksempelrapport'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.2,aspectSm:1/1.05,dwell:7,
    title:{en:'Read a METAR in five chunks',no:'Les en METAR i fem biter'},
    sub:{en:'One real-looking report. Each step lights up a chunk and draws what it means for your flight.',no:'Én realistisk rapport. Hvert steg lyser opp en bit og tegner hva den betyr for flyturen din.'},
    label:{en:'Animated METAR with each part highlighted in turn: wind on a runway with crosswind, visibility and RVR, cloud and weather in a side view, temperature, dew point and QNH, and a TEMPO timeline.',no:'Animert METAR der hver del lyser opp etter tur: vind på en bane med sidevind, sikt og RVR, skyer og vær i sidebilde, temperatur, duggpunkt og QNH, og en TEMPO-tidslinje.'},
    foot:{en:'Example report for illustration (ICAO Annex 3 format). Wind in a METAR is true; ATIS and tower give magnetic.',no:'Eksempelrapport for illustrasjon (ICAO Annex 3-format). Vinden i en METAR er rettvisende; ATIS og tårn gir magnetisk.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
