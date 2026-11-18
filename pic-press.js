/* NORDAP – pic-press.js: "Two altitudes" for pressurisation.html (uses corepic.js).
   A cabin cut-away with the air coming in from the packs and leaving through the outflow valve, beside two altitude columns
   (aircraft and cabin) and the differential pressure between them; then a rapid decompression and the time of useful
   consciousness. ISA. Illustrative airliner (max ΔP 8.6 psi, cabin ≤ 8 000 ft, CS 25.841). TUC: typical values at rest. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const isaP=h=>h<36089?101325*Math.pow(1-6.8756e-6*h,5.25588):22632*Math.exp(-(h-36089)/20806);
const PSI=6894.76;
/* step key frames: aircraft ft, cabin ft, outflow valve open 0..1, hole 0..1 */
const K=[{a:37000,c:6500,o:.18,x:0},{a:37000,c:6500,o:.18,x:0},{a:37000,c:6500,o:.18,x:0},{a:37000,c:6500,o:.18,x:0},{a:37000,c:37000,o:0,x:1},{a:37000,c:37000,o:0,x:1},{a:10000,c:10000,o:0,x:1}];
function st(p){ const i=clamp(Math.floor(p),0,K.length-2), k=clamp(p-i,0,1), e=ease(k), a=K[i], b=K[i+1];
  const ck=i===3?Math.pow(k,0.35):e;   // the decompression is fast
  return {a:lerp(a.a,b.a,e),c:lerp(a.c,b.c,ck),o:lerp(a.o,b.o,e),x:lerp(a.x,b.x,clamp(k*3,0,1))}; }
const TUC=[[18000,'20–30 min'],[25000,'3–5 min'],[30000,'1–2 min'],[35000,'30–60 s'],[40000,'15–20 s']];

const steps=[
 {t:{en:'Two altitudes',no:'To høyder'},
  d:{en:'The aircraft climbs to FL 370, but the people inside live at the <em>cabin altitude</em>: about 6 000–8 000 ft at most (the certification limit is 8 000 ft). The cabin climbs slowly and gently on its own schedule.',
     no:'Flyet stiger til FL 370, men menneskene inni lever i <em>kabinhøyden</em>: høyst omtrent 6 000–8 000 ft (sertifiseringsgrensen er 8 000 ft). Kabinen stiger sakte og mykt etter sin egen plan.'}},
 {t:{en:'Air in, air out',no:'Luft inn, luft ut'},
  d:{en:'The packs push a steady flow of conditioned air in. The <em>outflow valve</em> lets it out. Close the valve a little and the cabin pressure rises (cabin goes down); open it and the cabin climbs. That is the whole controller.',
     no:'Pakkene presser en jevn strøm av kondisjonert luft inn. <em>Utløpsventilen</em> slipper den ut. Lukker du ventilen litt, øker kabintrykket (kabinen går ned); åpner du den, stiger kabinen. Det er hele regulatoren.'}},
 {t:{en:'Differential pressure',no:'Differansetrykk'},
  d:{en:'The difference between inside and outside, <em>ΔP</em>, loads the fuselage like a balloon. Its maximum (about 8–9 psi on an airliner) sets how low the cabin can be kept at high level. Safety valves open before the structure is at risk.',
     no:'Forskjellen mellom innsiden og utsiden, <em>ΔP</em>, belaster flykroppen som en ballong. Maksimum (omtrent 8–9 psi på et trafikkfly) bestemmer hvor lav kabinen kan holdes høyt oppe. Sikkerhetsventiler åpner før strukturen er i fare.'}},
 {t:{en:'Rapid decompression',no:'Rask trykkavlastning'},
  d:{en:'A hole: the cabin air rushes out in seconds and the <em>cabin altitude jumps to the aircraft altitude</em>. Fog, cold, a bang. The masks drop when the cabin passes about 14 000 ft.',
     no:'Et hull: kabinluften fosser ut på sekunder, og <em>kabinhøyden hopper opp til flyets høyde</em>. Tåke, kulde, et smell. Maskene faller når kabinen passerer omtrent 14 000 ft.'}},
 {t:{en:'Time of useful consciousness',no:'Tid med handlekraft'},
  d:{en:'Without oxygen you have only seconds to act: about <em>30–60 s at FL 350</em> and 15–20 s at FL 400 (less if you are working). You will not feel it coming. <em>Mask on first</em>, then everything else.',
     no:'Uten oksygen har du bare sekunder til å handle: omtrent <em>30–60 s på FL 350</em> og 15–20 s på FL 400 (mindre hvis du jobber). Du merker ikke at det kommer. <em>Masken på først</em>, så alt annet.'}},
 {t:{en:'Emergency descent',no:'Nøddykk'},
  d:{en:'With the masks on, descend to <em>10 000 ft</em> or the minimum safe altitude, whichever is higher. Below 10 000 ft the air holds enough oxygen to stay useful without a mask.',
     no:'Med maskene på dykker du til <em>10 000 ft</em> eller minste sikre høyde, det som er høyest. Under 10 000 ft har luften nok oksygen til at du er handlekraftig uten maske.'},
  go:{en:'Open the pressurisation lab',no:'Åpne trykkabinlabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1, S=st(p);
  const dP=(isaP(S.c)-isaP(S.a))/PSI;
  // ---- the cabin cut-away ----
  const fx=W*(sm?.04:.04), fw=W*(sm?.92:.55), fy=H*(sm?.08:.2), fh=sm?H*.3:H*.5;
  const cx0=fx+fw*.06, cx1=fx+fw*.94, cy0=fy, cy1=fy+fh;
  const fog=S.x*(1-at(p,5.5,.5)*.6);
  // skin
  g.save(); g.beginPath(); g.moveTo(cx0,cy0+fh*.12); g.quadraticCurveTo(cx0,cy0,cx0+fh*.3,cy0); g.lineTo(cx1-fh*.2,cy0); g.quadraticCurveTo(cx1+fh*.25,cy0,cx1+fh*.25,cy0+fh*.5); g.quadraticCurveTo(cx1+fh*.25,cy1,cx1-fh*.2,cy1); g.lineTo(cx0+fh*.3,cy1); g.quadraticCurveTo(cx0,cy1,cx0,cy1-fh*.12); g.closePath();
  // the skin bulges a little with ΔP
  const bul=clamp(dP/8.6,0,1);
  const inner=g.createLinearGradient(0,cy0,0,cy1); inner.addColorStop(0,`rgba(${lerp(40,70,bul)|0},${lerp(60,110,bul)|0},${lerp(80,150,bul)|0},.55)`); inner.addColorStop(1,'rgba(20,30,40,.6)'); g.fillStyle=inner; g.fill();
  g.strokeStyle=`rgba(226,232,238,${.5+.4*bul})`; g.lineWidth=2+2*bul; g.stroke(); g.clip();
  // floor and seats
  const flY=cy0+fh*.72; g.fillStyle='rgba(255,255,255,.08)'; g.fillRect(cx0,flY,cx1-cx0,3);
  for(let x=cx0+fh*.45;x<cx1-fh*.2;x+=fh*.16){ g.fillStyle='rgba(160,175,190,.35)'; rr(g,x,flY-fh*.2,fh*.08,fh*.2,3); g.fill(); g.fillStyle='rgba(230,236,240,.55)'; g.beginPath(); g.arc(x+fh*.05,flY-fh*.28,fh*.045,0,7); g.fill();
    if(S.x>0.5&&S.c>14000){ const my=flY-fh*.29; g.strokeStyle='rgba(240,180,64,.7)'; g.lineWidth=1; g.beginPath(); g.moveTo(x+fh*.05,cy0+fh*.12); g.lineTo(x+fh*.05,my-fh*.05); g.stroke(); g.fillStyle=C.amber; rr(g,x+fh*.05-fh*.03,my-fh*.015,fh*.06,fh*.045,3); g.fill(); } }
  // air in from the packs (left, under the floor) and out through the outflow valve (right)
  const inA=1-S.x;
  for(let k=0;k<10;k++){ const ph=((tm*.35+k/10)%1); const x=lerp(cx0+fh*.2,cx1-fh*.1,ph), y=cy0+fh*.3+Math.sin(ph*9+k)*fh*.12;
    g.fillStyle=`rgba(127,198,238,${.65*inA*Math.sin(ph*Math.PI)})`; g.beginPath(); g.arc(x,y,2.3,0,7); g.fill(); }
  if(fog>0.01){ g.fillStyle=`rgba(220,230,238,${.35*fog})`; g.fillRect(cx0,cy0,cx1-cx0,fh); }
  g.restore();
  // packs (under the floor, middle)
  const pkx=fx+fw*.3, pky=cy1+8;
  rr(g,pkx-34,pky,68,20,4); g.fillStyle='rgba(18,26,34,.95)'; g.fill(); g.strokeStyle='rgba(127,198,238,.6)'; g.stroke(); txt(g,'PACKS',pkx,pky+14,{mono:1,size:10*fs,col:'#9FD4F2',al:'center'});
  arrow(g,pkx,pky,pkx,cy1-6,C.blue,{lw:2.5,head:8,a:inA});
  // outflow valve (aft, lower)
  const ovx=cx1-fh*.05, ovy=cy1-fh*.22; g.save(); g.translate(ovx,ovy); g.strokeStyle='#fff'; g.lineWidth=3; g.rotate(-S.o*1.2); g.beginPath(); g.moveTo(-9,0); g.lineTo(9,0); g.stroke(); g.restore();
  if(S.o>0.03&&inA>0.1) arrow(g,ovx+6,ovy+4,ovx+30,ovy+18+10*S.o,C.amber,{lw:2+3*S.o,head:8,a:inA});
  pill(g,`${L({en:'outflow valve',no:'utløpsventil'})} ${nf(S.o*100)} %`,ovx,cy1+22,{mono:1,size:10*fs,col:C.amber,al:'center',a:at(p,1,.6)*(1-S.x)+0.0});
  // hole
  if(S.x>0.01){ const hx=fx+fw*.62, hy=cy0+fh*.08; g.fillStyle='#0f151b'; g.beginPath(); g.ellipse(hx,hy,10*S.x,6*S.x,0,0,7); g.fill(); g.strokeStyle=C.red; g.lineWidth=2; g.stroke();
    for(let k=0;k<6;k++){ const ph=((tm*1.8+k/6)%1); g.strokeStyle=`rgba(220,230,238,${.6*(1-ph)*S.x*(1-at(p,5.5,.5))})`; g.beginPath(); g.moveTo(hx-6+k*2,hy); g.lineTo(hx-10+k*4,hy-ph*fh*.6); g.stroke(); }
    pill(g,L({en:'hole',no:'hull'}),hx+18,hy-6,{size:10.5*fs,col:'#FF8A78'}); }
  // ΔP readout on the skin
  const a2=at(p,2,.7);
  if(a2>0.01&&S.x<.98){ g.save(); g.globalAlpha=a2*(1-S.x);
    for(let k=0;k<9;k++){ const x=lerp(cx0+fh*.4,cx1-fh*.3,k/8); arrow(g,x,cy0+10,x,cy0-8-12*bul,'rgba(236,90,71,.85)',{lw:1.8,head:6}); arrow(g,x,cy1-10,x,cy1+6+10*bul,'rgba(236,90,71,.6)',{lw:1.4,head:5}); }
    pill(g,`ΔP ${nf(dP,1)} psi`,fx+fw*.5,cy0-30,{mono:1,size:12*fs,col:'#FF8A78',al:'center'}); g.restore(); }

  // ---- the two altitude columns ----
  const bx=sm?W*.1:W*.66, bw=sm?W*.8:W*.31, by0=sm?H*.52:H*.08, by1=sm?H*.93:H*.9;
  const hMax=40000, Y=h=>by1-(by1-by0-18)*h/hMax;
  const colA=bx+bw*.18, colC=bx+bw*.58, cw=bw*.18;
  g.strokeStyle='rgba(255,255,255,.07)'; g.lineWidth=1;
  for(let h=0;h<=40000;h+=10000){ const y=Y(h); g.beginPath(); g.moveTo(bx,y); g.lineTo(bx+bw,y); g.stroke(); txt(g,h?`${h/1000}k`:'0',bx-4,y+3,{mono:1,size:9*fs,col:'#7F8B96',al:'right'}); }
  // 10 000 ft and 14 000 ft lines
  [[10000,L({en:'10 000 ft',no:'10 000 ft'}),'rgba(113,204,147,.6)'],[14000,L({en:'masks ≈ 14 000',no:'masker ≈ 14 000'}),'rgba(240,180,64,.6)']].forEach(([h,l,c],i)=>{ if(i===1&&at(p,3,.6)<.1) return; const y=Y(h); g.strokeStyle=c; g.setLineDash([3,4]); g.beginPath(); g.moveTo(bx,y); g.lineTo(bx+bw,y); g.stroke(); g.setLineDash([]); txt(g,l,bx+bw,y-4,{mono:1,size:9*fs,col:c,al:'right'}); });
  const col=(x,h,c,lab)=>{ const y=Y(h); const gr=g.createLinearGradient(0,y,0,by1); gr.addColorStop(0,c); gr.addColorStop(1,'rgba(255,255,255,.04)'); g.fillStyle=gr; rr(g,x,y,cw,by1-y,4); g.fill();
    g.fillStyle='#fff'; g.fillRect(x-4,y-1,cw+8,2); txt(g,lab,x+cw/2,by1+14,{size:10.5*fs,col:'#C9D2DA',al:'center',w:600}); txt(g,h>=18000?`FL${nf(h/100)}`:`${nf(Math.round(h/100)*100)} ft`,x+cw/2,y-8,{mono:1,size:11*fs,col:'#fff',al:'center'}); };
  col(colA,S.a,'rgba(127,198,238,.55)',L({en:'aircraft',no:'flyet'}));
  col(colC,S.c,S.c>14000?'rgba(236,90,71,.7)':S.c>10000?'rgba(240,180,64,.6)':'rgba(113,204,147,.55)',L({en:'cabin',no:'kabin'}));
  // ΔP bracket between the tops
  if(a2>0.05&&S.a-S.c>2000){ const xA=colA+cw+6, xC=colC-6, yA=Y(S.a), yC=Y(S.c); g.save(); g.globalAlpha=a2; g.strokeStyle='#FF8A78'; g.lineWidth=1.5; g.beginPath(); g.moveTo(xA,yA); g.lineTo((xA+xC)/2,yA); g.lineTo((xA+xC)/2,yC); g.lineTo(xC,yC); g.stroke();
    pill(g,`ΔP ${nf(dP,1)} psi`,(xA+xC)/2,(yA+yC)/2,{mono:1,size:10.5*fs,col:'#FF8A78',al:'center'}); g.restore(); }
  // TUC clock (step 5)
  const a4=at(p,4,.7)*(1-at(p,5,.6)*.6);
  if(a4>0.01){ const tx=sm?W*.72:fx+fw*.55, ty=sm?H*.45:cy1+H*.17, r=sm?H*.045:H*.075; g.save(); g.globalAlpha=a4;
    g.fillStyle='rgba(10,15,20,.9)'; g.beginPath(); g.arc(tx,ty,r,0,7); g.fill(); g.strokeStyle='rgba(255,255,255,.25)'; g.stroke();
    const fr=((tm%12)/12); g.fillStyle='rgba(236,90,71,.35)'; g.beginPath(); g.moveTo(tx,ty); g.arc(tx,ty,r-3,-Math.PI/2,-Math.PI/2+fr*Math.PI*2); g.closePath(); g.fill();
    txt(g,sm?'30–60s':'30–60 s',tx,ty+4,{mono:1,size:(sm?9.5:14)*fs,col:'#fff',al:'center',w:600}); if(sm) txt(g,'FL350',tx,ty+r+12,{mono:1,size:9.5,col:'#AEB8C1',al:'center'});
    if(!sm){ TUC.forEach(([h,t],i)=>{ const on=h===35000; txt(g,`FL${h/100}`,tx+r+18,ty-r+8+i*17,{mono:1,size:10.5,col:on?'#fff':'#8E99A4'}); txt(g,t,tx+r+70,ty-r+8+i*17,{mono:1,size:10.5,col:on?'#FF8A78':'#8E99A4'}); }); }
    g.restore(); }
  txt(g,L({en:'illustrative airliner · ISA',no:'illustrerende trafikkfly · ISA'}),sm?W-10:W*.62,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.25,dwell:6.5,
    title:{en:'Two altitudes: the aircraft and the cabin',no:'To høyder: flyet og kabinen'},
    sub:{en:'Pressurisation keeps the people low while the aircraft flies high. Watch the valve, the pressure difference, and what happens when it fails.',no:'Trykkabinen holder menneskene lavt mens flyet flyr høyt. Se på ventilen, trykkforskjellen, og hva som skjer når det svikter.'},
    label:{en:'Animated cabin cut-away with air in from the packs and out through the outflow valve, beside columns for aircraft and cabin altitude, then a rapid decompression.',no:'Animert kabinsnitt med luft inn fra pakkene og ut gjennom utløpsventilen, ved siden av søyler for flyets og kabinens høyde, deretter en rask trykkavlastning.'},
    foot:{en:'Illustrative airliner: max ΔP about 8.6 psi, cabin at most 8 000 ft (CS 25.841). Time of useful consciousness: typical values at rest.',no:'Illustrerende trafikkfly: maks ΔP omtrent 8,6 psi, kabin høyst 8 000 ft (CS 25.841). Tid med handlekraft: typiske verdier i hvile.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
