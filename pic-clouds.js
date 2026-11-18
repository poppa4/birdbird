/* NORDAP – pic-clouds.js: "Stable or unstable: lift a parcel" for clouds.html (uses corepic.js).
   A tephigram-lite: temperature against height with the environment (ELR), a rising parcel that cools at the dry rate
   (3 °C/1 000 ft) until it is saturated (cloud base, spread ÷ 2.5 × 1 000 ft) and then at the saturated rate (about 1.5 °C/1 000 ft),
   and a side view of the cloud that results: flat layer cloud when stable, towering cumulus when unstable. Illustrative values. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const T0=20, D0=12, DALR=3, SALR=1.5, HMAX=20000;
const BASE=(T0-D0)/2.5*1000;                       // 3 200 ft
const parcelT=h=>h<=BASE?T0-DALR*h/1000:T0-DALR*BASE/1000-SALR*(h-BASE)/1000;
const ELR_ST=1.2, ELR_UN=2.5;                       // °C per 1 000 ft (stable, conditionally unstable)
const env=(h,elr,inv)=>T0-elr*h/1000+(inv?Math.max(0,Math.min(1,(h-6000)/600))*4-Math.max(0,(h-6600)/1000)*0:0);

const steps=[
 {t:{en:'Lift a parcel of air',no:'Løft en luftpakke'},
  d:{en:'Take a bubble of air near the ground and push it up. The pressure falls, it expands and <em>cools</em>. Unsaturated air cools at the <em>dry rate: 3 °C per 1 000 ft</em>.',
     no:'Ta en boble luft nær bakken og skyv den opp. Trykket synker, den utvider seg og <em>avkjøles</em>. Umettet luft avkjøles med <em>tørr rate: 3 °C per 1 000 ft</em>.'}},
 {t:{en:'Cloud base',no:'Skybase'},
  d:{en:`The dew point falls only slowly, so the gap closes at about 2.5 °C per 1 000 ft. Cloud base ≈ <em>spread ÷ 2.5 × 1 000 ft</em>. Here (20 − 12) ÷ 2.5 × 1 000 ≈ <em>${nf(Math.round(BASE/100)*100)} ft</em>.`,
     no:`Duggpunktet synker bare litt, så gapet lukkes med omtrent 2,5 °C per 1 000 ft. Skybase ≈ <em>spredning ÷ 2,5 × 1 000 ft</em>. Her (20 − 12) ÷ 2,5 × 1 000 ≈ <em>${nf(Math.round(BASE/100)*100)} ft</em>.`}},
 {t:{en:'Inside the cloud · it cools slower',no:'Inne i skyen · den avkjøles saktere'},
  d:{en:'Once saturated, condensation releases latent heat. The parcel now cools at the <em>saturated rate, about 1.5 °C per 1 000 ft</em> (more at low levels in warm air, less high up).',
     no:'Når den er mettet, frigjør kondensasjonen latent varme. Pakken avkjøles nå med <em>mettet rate, omtrent 1,5 °C per 1 000 ft</em> (mer i lav høyde i varm luft, mindre høyt oppe).'}},
 {t:{en:'Stable · it sinks back',no:'Stabil · den synker tilbake'},
  d:{en:'Compare with the air around it (the <em>environment</em>). If the surroundings cool slowly with height, the lifted parcel ends up <em>colder and heavier</em>: it sinks back. Result: flat layer cloud, smooth air, poor visibility under it.',
     no:'Sammenlign med luften rundt (<em>omgivelsene</em>). Avkjøles omgivelsene sakte med høyden, blir den løftede pakken <em>kaldere og tyngre</em>: den synker tilbake. Resultat: flate lagskyer, rolig luft, dårlig sikt under.'}},
 {t:{en:'Unstable · it keeps rising',no:'Ustabil · den fortsetter å stige'},
  d:{en:'If the surroundings cool <em>faster</em> than the parcel, it stays <em>warmer and lighter</em> and accelerates upwards. Result: cumulus, showers, turbulence, good visibility between them — and possibly a CB.',
     no:'Avkjøles omgivelsene <em>raskere</em> enn pakken, forblir den <em>varmere og lettere</em> og akselererer oppover. Resultat: cumulus, byger, turbulens, god sikt mellom dem — og kanskje en CB.'}},
 {t:{en:'Read it in one line',no:'Les det på én linje'},
  d:{en:'ELR less than 1.5 °C/1 000 ft: <em>absolutely stable</em>. More than 3: <em>absolutely unstable</em>. In between: <em>conditionally unstable</em> — stable until the air is saturated, then unstable. Most cumulus days are like that.',
     no:'ELR under 1,5 °C/1 000 ft: <em>absolutt stabil</em>. Over 3: <em>absolutt ustabil</em>. Mellom: <em>betinget ustabil</em> — stabil til luften er mettet, deretter ustabil. De fleste cumulusdager er slik.'},
  go:{en:'Open the clouds and stability lab',no:'Åpne sky- og stabilitetslabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function puff(g,x,y,r,a){ g.fillStyle=`rgba(236,241,245,${a})`; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
/* a cumulus with a flat base, built from shaded lobes (deterministic) */
function cumulus(g,x,base,top,w){ const h=base-top; if(h<4) return; const lobes=[];
  let seed=Math.round(x*7+w); const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280; };
  const n=Math.max(6,Math.round(h/10));
  for(let i=0;i<n;i++){ const k=i/(n-1), y=base-h*k*.86, ww=w*(0.55+0.45*Math.sin(Math.PI*Math.min(1,k*1.25)))*(k>.8?0.8:1); const m=2+Math.round(rnd()*2);
    for(let j=0;j<m;j++){ lobes.push([x+(rnd()-.5)*ww*.9, y-(rnd()*h*.06), ww*(0.28+rnd()*.2)]); } }
  lobes.push([x,top+w*.22,w*.32]); lobes.push([x-w*.18,top+w*.3,w*.26]); lobes.push([x+w*.2,top+w*.28,w*.27]);
  g.save(); g.beginPath(); g.rect(x-w*2,top-w,w*4,base-top+w*1.0+0.5); g.clip(); g.beginPath(); g.rect(x-w*2,top-w*2,w*4,base-top+w*2); g.clip();
  // keep the base flat
  g.beginPath(); g.rect(x-w*2,top-w*2,w*4,base-(top-w*2)); g.clip();
  lobes.forEach(([lx,ly,r])=>{ const gr=g.createRadialGradient(lx-r*.35,ly-r*.45,r*.1,lx,ly,r); gr.addColorStop(0,'rgba(250,252,253,.96)'); gr.addColorStop(.7,'rgba(214,222,229,.92)'); gr.addColorStop(1,'rgba(150,163,175,.85)'); g.fillStyle=gr; g.beginPath(); g.arc(lx,ly,r,0,7); g.fill(); });
  g.restore();
  const bg=g.createLinearGradient(0,base-12,0,base); bg.addColorStop(0,'rgba(120,134,148,0)'); bg.addColorStop(1,'rgba(110,124,138,.6)'); g.fillStyle=bg; g.fillRect(x-w*.7,base-12,w*1.4,12); }
function layer(g,x0,x1,base,th){ g.save(); g.beginPath(); g.rect(x0,base-th*2,x1-x0,th*2); g.clip();
  for(let x=x0-10;x<x1+10;x+=th*.9){ const r=th*(0.7+0.25*Math.sin(x*.13)); const gr=g.createRadialGradient(x-r*.3,base-th*.6-r*.3,r*.1,x,base-th*.5,r); gr.addColorStop(0,'rgba(226,232,238,.85)'); gr.addColorStop(1,'rgba(150,163,175,.7)'); g.fillStyle=gr; g.beginPath(); g.arc(x,base-th*.5,r,0,7); g.fill(); }
  g.restore(); g.fillStyle='rgba(130,145,158,.75)'; g.fillRect(x0,base-3,x1-x0,3); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  // chart on the left, scene on the right
  const cx0=W*(sm?.12:.08), cx1=W*(sm?.94:.5), cy0=H*.08, cy1=H*(sm?.56:.88);
  const tLo=-20, tHi=24, X=t=>cx0+(cx1-cx0)*(t-tLo)/(tHi-tLo), Y=h=>cy1-(cy1-cy0)*h/HMAX;
  g.strokeStyle='rgba(255,255,255,.07)'; g.lineWidth=1;
  for(let h=0;h<=HMAX;h+=5000){ g.beginPath(); g.moveTo(cx0,Y(h)); g.lineTo(cx1,Y(h)); g.stroke(); txt(g,h?`${h/1000}k ft`:'0',cx0-4,Y(h)+3,{mono:1,size:9*fs,col:'#7F8B96',al:'right'}); }
  for(let t=-20;t<=20;t+=10){ g.beginPath(); g.moveTo(X(t),cy0); g.lineTo(X(t),cy1); g.stroke(); txt(g,`${t}°`,X(t),cy1+13,{mono:1,size:9*fs,col:'#7F8B96',al:'center'}); }
  g.strokeStyle='rgba(127,198,238,.5)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(X(0),cy0); g.lineTo(X(0),cy1); g.stroke();
  txt(g,L({en:'temperature',no:'temperatur'}),cx1,cy1+26,{mono:1,size:9.5*fs,col:'#8E99A4',al:'right'});
  // the parcel's height for this step
  const hP=p<1?lerp(0,BASE*.75,ease(p)):p<2?lerp(BASE*.75,BASE,ease(p-1)):p<3?lerp(BASE,9000,ease(p-2)):9000;
  // parcel curve (dry then saturated)
  const pc=(hTo,col,w)=>{ g.strokeStyle=col; g.lineWidth=w; g.beginPath(); for(let h=0;h<=hTo;h+=100){ const x=X(parcelT(h)), y=Y(h); h?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); };
  const showAll=p>=3, hTo=showAll?HMAX:hP;
  // dry part in amber, saturated in blue
  g.strokeStyle=C.amber; g.lineWidth=2.6; g.beginPath(); for(let h=0;h<=Math.min(hTo,BASE);h+=100){ const x=X(parcelT(h)), y=Y(h); h?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
  if(hTo>BASE){ g.strokeStyle=C.blue; g.beginPath(); for(let h=BASE;h<=hTo;h+=100){ const x=X(parcelT(h)), y=Y(h); h>BASE?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); }
  // dew point line to cloud base
  const dp=h=>D0-0.5*h/1000; g.strokeStyle='rgba(113,204,147,.7)'; g.setLineDash([4,4]); g.lineWidth=1.6; g.beginPath(); for(let h=0;h<=Math.min(Math.max(hP,BASE*0.0+hP),BASE);h+=100){ const x=X(dp(h)), y=Y(h); h?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); g.setLineDash([]);
  if(p<3.5){ txt(g,L({en:'dew point',no:'duggpunkt'}),X(dp(0))-6,Y(0)-8,{size:10.5*fs,col:'#8EDDB0',al:'right'}); }
  // labels for the rates
  const a0=at(p,0,.5); if(a0>0) pill(g,L({en:'dry 3 °C/1 000 ft',no:'tørr 3 °C/1 000 ft'}),X(parcelT(BASE*.5))+12,Y(BASE*.5),{size:10.5*fs,col:C.amber,fit:W});
  if(p>=1.6){ g.strokeStyle='rgba(255,255,255,.5)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(cx0,Y(BASE)); g.lineTo(cx1,Y(BASE)); g.stroke(); g.setLineDash([]); pill(g,`${L({en:'cloud base',no:'skybase'})} ≈ ${nf(Math.round(BASE/100)*100)} ft`,cx0+8,Y(BASE)-12,{mono:1,size:10.5*fs,col:'#fff',fit:W}); }
  if(p>=2.3) pill(g,L({en:'saturated ≈ 1.5 °C/1 000 ft',no:'mettet ≈ 1,5 °C/1 000 ft'}),X(parcelT(12000))+12,Y(12000),{size:10.5*fs,col:C.blue,fit:W});
  // environment curves (clipped to the chart)
  g.save(); g.beginPath(); g.rect(cx0,cy0-4,cx1-cx0,cy1-cy0+4); g.clip();
  const stA=at(p,3,.7)*(1-at(p,4,.5)), unA=at(p,4,.7), both=at(p,5,.7);
  const envLine=(elr,col,a,lab)=>{ if(a<=0) return; g.save(); g.globalAlpha=a; g.strokeStyle=col; g.lineWidth=3; g.beginPath(); g.moveTo(X(T0),Y(0)); g.lineTo(X(T0-elr*HMAX/1000),Y(HMAX)); g.stroke(); const hh=Math.min(HMAX*.82,(T0-tLo-2)/elr*1000*.92); pill(g,lab,X(T0-elr*hh/1000)+8,Y(hh),{size:10.5*fs,col,fit:W}); g.restore(); };
  envLine(ELR_ST,'#C9D2DA',Math.max(stA,both*.8),L({en:'environment: stable',no:'omgivelser: stabil'}));
  envLine(ELR_UN,C.red,Math.max(unA,both*.8),L({en:'environment: unstable',no:'omgivelser: ustabil'}));
  g.restore();
  // parcel dot and comparison
  const hD=p>=3?lerp(9000,9000,1):hP, tP=parcelT(hD);
  g.fillStyle='#fff'; g.beginPath(); g.arc(X(tP),Y(hD),6,0,7); g.fill(); g.strokeStyle=C.mag; g.lineWidth=2; g.beginPath(); g.arc(X(tP),Y(hD),10+2*Math.sin(tm*3),0,7); g.stroke();
  if(stA>0.2&&p<4.5){ const tE=T0-ELR_ST*hD/1000; g.strokeStyle='#fff'; g.lineWidth=1.2; g.beginPath(); g.moveTo(X(tP),Y(hD)); g.lineTo(X(tE),Y(hD)); g.stroke(); pill(g,`${L({en:'parcel',no:'pakke'})} ${nf(tE-tP,0)} °C ${L({en:'colder → sinks',no:'kaldere → synker'})}`,(X(tP)+X(tE))/2,Y(hD)-16,{size:10.5*fs,col:'#fff',al:'center',fit:W}); }
  if(unA>0.2){ const tE=T0-ELR_UN*hD/1000; g.strokeStyle='#fff'; g.lineWidth=1.2; g.beginPath(); g.moveTo(X(tP),Y(hD)); g.lineTo(X(tE),Y(hD)); g.stroke(); pill(g,`${L({en:'parcel',no:'pakke'})} ${nf(tP-tE,0)} °C ${L({en:'warmer → rises',no:'varmere → stiger'})}`,(X(tP)+X(tE))/2,Y(hD)+18,{size:10.5*fs,col:'#FF8A78',al:'center',fit:W}); }
  // scene on the right (or below on phones)
  const sx0=sm?W*.06:W*.56, sx1=sm?W*.94:W*.97, sy0=sm?H*.62:H*.08, sy1=sm?H*.95:H*.88, gy=sy1-14;
  rr(g,sx0,sy0,sx1-sx0,sy1-sy0,8); g.fillStyle='rgba(10,15,20,.35)'; g.fill(); g.strokeStyle='rgba(255,255,255,.08)'; g.stroke();
  g.fillStyle='#1b2a22'; g.fillRect(sx0+1,gy,sx1-sx0-2,sy1-gy-1);
  const SY=h=>gy-(gy-sy0-10)*h/HMAX, cb=SY(BASE);
  // the rising bubble
  const bubbleA=1-at(p,3,.6); if(bubbleA>0){ const bx=(sx0+sx1)/2, by=SY(hP); g.save(); g.globalAlpha=bubbleA; g.strokeStyle=hP>=BASE?'#fff':C.amber; g.lineWidth=2; g.beginPath(); g.arc(bx,by,10+hP/2000,0,7); g.stroke(); if(hP>=BASE*.98) puff(g,bx,by,10+hP/2000,.6); g.restore(); }
  // stable layer cloud
  if(stA>0.01){ g.save(); g.globalAlpha=stA*(1-both*.4); layer(g,sx0+6,sx1-6,cb,(sm?12:20)); txt(g,L({en:'stratus / stratocumulus',no:'stratus / stratocumulus'}),(sx0+sx1)/2,cb-30,{size:11*fs,col:'#fff',al:'center',w:600});
    g.fillStyle='rgba(200,210,220,.12)'; g.fillRect(sx0+1,cb,sx1-sx0-2,gy-cb); g.restore(); }
  // unstable towering cumulus
  if(unA>0.01||both>0.01){ const a=Math.max(unA,both*.9); g.save(); g.globalAlpha=a; const top=SY(lerp(BASE,16000,ease(clamp((tm*.12)%1.4,0,1)))), cxs=[(sx0*.7+sx1*.3),(sx0*.3+sx1*.7)];
    cxs.forEach((x,i)=>{ const tp=i?SY(9000):top; cumulus(g,x,cb,tp,(sx1-sx0)*(i?.14:.17));
      if(i===0){ for(let k=0;k<6;k++){ const ph=(tm*.9+k/6)%1; g.strokeStyle=`rgba(127,198,238,${.5*(1-ph)})`; g.beginPath(); g.moveTo(x-14+k*5,cb+ph*(gy-cb)); g.lineTo(x-16+k*5,cb+ph*(gy-cb)+8); g.stroke(); } } });
    txt(g,L({en:'cumulus, showers',no:'cumulus, byger'}),(sx0+sx1)/2,sy0+18,{size:11*fs,col:'#fff',al:'center',w:600}); g.restore(); }
  txt(g,`${nf(Math.round(BASE/100)*100)} ft`,sx1-6,cb+4,{mono:1,size:9.5*fs,col:'#AEB8C1',al:'right'});
  // stability key (last step)
  if(both>0.01&&!sm){ g.save(); g.globalAlpha=both; const kx=cx0+12, ky=cy0+10; rr(g,kx,ky,W*.24,74,8); g.fillStyle='rgba(10,15,20,.88)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
    [['< 1.5',L({en:'absolutely stable',no:'absolutt stabil'}),'#C9D2DA'],['1.5–3',L({en:'conditionally unstable',no:'betinget ustabil'}),C.amber],['> 3',L({en:'absolutely unstable',no:'absolutt ustabil'}),C.red]].forEach(([a,b,c],i)=>{ txt(g,`ELR ${a}`,kx+10,ky+20+i*20,{mono:1,size:11,col:c}); txt(g,b,kx+W*.24-10,ky+20+i*20,{size:11,col:'#fff',al:'right'}); }); g.restore(); }
  txt(g,L({en:'illustrative values',no:'illustrerende verdier'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.25,dwell:6.5,
    title:{en:'Stable or unstable: lift a parcel of air',no:'Stabil eller ustabil: løft en luftpakke'},
    sub:{en:'One bubble of air, two cooling rates, and the air around it. That is all it takes to predict the clouds you will meet.',no:'Én luftboble, to avkjølingsrater og luften rundt. Mer trengs ikke for å forutsi skyene du møter.'},
    label:{en:'Animated temperature–height chart with a rising parcel cooling at the dry and saturated rates against a stable and an unstable environment, beside the clouds that result.',no:'Animert temperatur–høyde-diagram med en stigende luftpakke som avkjøles med tørr og mettet rate mot stabile og ustabile omgivelser, ved siden av skyene som blir resultatet.'},
    foot:{en:'Surface 20 °C, dew point 12 °C; DALR 3 °C/1 000 ft, SALR about 1.5 °C/1 000 ft; cloud base ≈ spread ÷ 2.5 × 1 000 ft. Illustrative.',no:'Bakke 20 °C, duggpunkt 12 °C; DALR 3 °C/1 000 ft, SALR omtrent 1,5 °C/1 000 ft; skybase ≈ spredning ÷ 2,5 × 1 000 ft. Illustrerende.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
