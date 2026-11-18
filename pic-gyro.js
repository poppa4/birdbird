/* NORDAP – pic-gyro.js: "Why the compass lies, and what the gyros do instead" for gyros.html (uses corepic.js).
   A magnetic compass card beside a heading indicator: dip, the acceleration error (ANDS), the turning error (UNOS),
   gyro rigidity and precession, then drift and why the HI is reset to the compass in straight, steady flight.
   Northern hemisphere. Illustrative error sizes. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const wrap=h=>((h%360)+360)%360;

const steps=[
 {t:{en:'The compass needle dips',no:'Kompassnålen heller'},
  d:{en:'Earth\'s field points <em>down into the ground</em> as well as north (about 70° in Scandinavia). The needle is weighted to stay level, so its centre of gravity sits on the <em>south side</em> of the pivot. That is the root of both errors.',
     no:'Jordens magnetfelt peker <em>ned i bakken</em> i tillegg til nord (omtrent 70° i Skandinavia). Nålen er vektet for å ligge vannrett, så tyngdepunktet ligger på <em>sørsiden</em> av opphenget. Det er roten til begge feilene.'}},
 {t:{en:'Accelerating east or west · ANDS',no:'Akselerasjon øst eller vest · ANDS'},
  d:{en:'On an east or west heading, speeding up swings the weight back and the compass shows a turn to the <em>north</em>; slowing down shows a turn to the south. <em>A</em>ccelerate <em>N</em>orth, <em>D</em>ecelerate <em>S</em>outh. No error on north or south headings.',
     no:'På kurs øst eller vest svinger vekten bakover når du øker farten, og kompasset viser en sving mot <em>nord</em>; senker du farten, viser det sving mot sør. <em>A</em>kselerer <em>N</em>ord, <em>D</em>eselerer <em>S</em>ør (ANDS). Ingen feil på kurs nord eller sør.'}},
 {t:{en:'Turning through north or south · UNOS',no:'Sving gjennom nord eller sør · UNOS'},
  d:{en:'In a turn, the compass <em>lags</em> through north and <em>leads</em> through south. Roll out <em>early</em> on south, <em>late</em> on north — by about the latitude (60° N: up to ~30° at 15° bank). <em>U</em>ndershoot <em>N</em>orth, <em>O</em>vershoot <em>S</em>outh.',
     no:'I en sving <em>henger</em> kompasset etter gjennom nord og <em>ligger foran</em> gjennom sør. Rett ut <em>tidlig</em> på sør, <em>sent</em> på nord. <em>U</em>ndershoot <em>N</em>ord, <em>O</em>vershoot <em>S</em>ør (UNOS).'}},
 {t:{en:'A gyro stays put · rigidity',no:'En gyro står fast · stivhet'},
  d:{en:'A fast-spinning wheel keeps its axis fixed in space. The heading indicator uses that: the card stays still while the aircraft turns around it. <em>No turning or acceleration error</em>.',
     no:'Et hjul som spinner fort, holder aksen fast i rommet. Kursgyroen bruker det: skiven står stille mens flyet svinger rundt den. <em>Ingen svinge- eller akselerasjonsfeil</em>.'}},
 {t:{en:'But it drifts · precession',no:'Men den driver · presesjon'},
  d:{en:'Bearing friction and the Earth turning under it (up to <em>15° per hour × sin latitude</em>) make the gyro wander. A mechanical HI may drift a few degrees in 15 minutes.',
     no:'Friksjon i lagrene og jorden som roterer under den (opptil <em>15° per time × sin breddegrad</em>) får gyroen til å vandre. En mekanisk kursgyro kan drive noen grader på 15 minutter.'}},
 {t:{en:'Use each for what it is good at',no:'Bruk hver til det den er god på'},
  d:{en:'In <em>straight, level, unaccelerated</em> flight the compass is right: <em>set the HI to the compass</em> about every 15 minutes. Then fly headings on the HI. Modern AHRS do the same thing automatically with a magnetometer.',
     no:'I <em>rett, horisontal flyging uten akselerasjon</em> viser kompasset riktig: <em>still kursgyroen etter kompasset</em> omtrent hvert 15. minutt. Fly så kurser på kursgyroen. Moderne AHRS gjør det samme automatisk med et magnetometer.'},
  go:{en:'Open the attitude and heading lab',no:'Åpne holdnings- og kurslabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function card(g,cx,cy,r,hdg,o){ o=o||{};
  g.save(); g.fillStyle='#0b1116'; g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1.5; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill(); g.stroke();
  g.translate(cx,cy); g.rotate(-hdg*Math.PI/180);
  for(let d=0;d<360;d+=5){ const a=d*Math.PI/180-Math.PI/2, maj=d%30===0, mid=d%10===0; g.strokeStyle=maj?'#E2E8EE':'rgba(255,255,255,.4)'; g.lineWidth=maj?1.6:1; const l=maj?10:mid?7:4;
    g.beginPath(); g.moveTo(Math.cos(a)*(r-2),Math.sin(a)*(r-2)); g.lineTo(Math.cos(a)*(r-2-l),Math.sin(a)*(r-2-l)); g.stroke();
    if(maj){ const lab=d===0?'N':d===90?'E':d===180?'S':d===270?'W':String(d/10); g.save(); g.translate(Math.cos(a)*(r-22),Math.sin(a)*(r-22)); g.rotate(a+Math.PI/2); txt(g,lab,0,4,{mono:1,size:r*(lab.length===1&&isNaN(lab)?.17:.13),col:lab==='N'?'#FF8A78':'#E2E8EE',al:'center',w:600}); g.restore(); } }
  g.restore();
  // lubber line and aircraft symbol
  g.fillStyle=o.col||C.amber; g.beginPath(); g.moveTo(cx,cy-r+2); g.lineTo(cx-6,cy-r-8); g.lineTo(cx+6,cy-r-8); g.closePath(); g.fill();
  g.save(); g.translate(cx,cy); g.fillStyle='rgba(255,255,255,.85)'; const s=r/60; g.beginPath(); g.moveTo(0,-14*s); g.lineTo(2*s,-4*s); g.lineTo(14*s,2*s); g.lineTo(14*s,5*s); g.lineTo(2*s,2*s); g.lineTo(1.5*s,10*s); g.lineTo(5*s,13*s); g.lineTo(5*s,15*s); g.lineTo(0,14*s); g.lineTo(-5*s,15*s); g.lineTo(-5*s,13*s); g.lineTo(-1.5*s,10*s); g.lineTo(-2*s,2*s); g.lineTo(-14*s,5*s); g.lineTo(-14*s,2*s); g.lineTo(-2*s,-4*s); g.closePath(); g.fill(); g.restore();
  pill(g,String(Math.round(wrap(hdg))).padStart(3,'0')+'°',cx,cy+r+18,{mono:1,size:12,col:'#fff',al:'center'}); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const r=Math.min(W*(sm?.2:.13),H*.24);
  const c1=[W*(sm?.27:.3),H*(sm?.62:.56)], c2=[W*(sm?.73:.68),H*(sm?.62:.56)];
  let trueH=90, comp=90, hi=90, note=null, acc=0;
  const ph=(tm*.12)%1;
  if(p<0.5){ trueH=0; comp=0; hi=0; }
  else if(p<1.5){ // accelerate on east: compass swings north (towards 0 from 90 → shows lower number), then decelerate shows south
    trueH=90; const a=Math.sin(ph*Math.PI*2); acc=a; comp=90-a*14; hi=90; note=a>0?L({en:'accelerating: shows a turn north',no:'akselererer: viser sving mot nord'}):L({en:'decelerating: shows a turn south',no:'bremser: viser sving mot sør'}); }
  else if(p<2.5){ // standard rate turn right through 360; compass lags north, leads south
    trueH=wrap(ph*360); const lat=60, err=-lat*.5*Math.cos(trueH*Math.PI/180); comp=wrap(trueH+err); hi=trueH;
    note=Math.cos(trueH*Math.PI/180)>.5?L({en:'through north: compass lags',no:'gjennom nord: kompasset henger etter'}):Math.cos(trueH*Math.PI/180)<-.5?L({en:'through south: compass leads',no:'gjennom sør: kompasset ligger foran'}):null; }
  else if(p<3.5){ trueH=wrap(ph*360); comp=wrap(trueH-30*Math.cos(trueH*Math.PI/180)); hi=trueH; }
  else if(p<4.5){ trueH=90; comp=90; hi=90+lerp(0,6,ease(clamp((p-3.5)/.8,0,1)))+Math.sin(tm*.7)*.4; note=L({en:'HI has drifted 6° in 15 min',no:'kursgyroen har drevet 6° på 15 min'}); }
  else { trueH=90; comp=90; const k=clamp((p-5)*1.5,0,1); hi=lerp(96,90,ease(k)); note=k<1?L({en:'set HI to the compass',no:'still kursgyroen etter kompasset'}):L({en:'aligned: fly the HI',no:'stemmer: fly etter kursgyroen'}); }
  // labels
  txt(g,L({en:'MAGNETIC COMPASS',no:'MAGNETKOMPASS'}),c1[0],c1[1]-r-24,{mono:1,size:10*fs,col:'#AEB8C1',al:'center'});
  txt(g,L({en:'HEADING INDICATOR (gyro)',no:'KURSGYRO'}),c2[0],c2[1]-r-24,{mono:1,size:10*fs,col:'#AEB8C1',al:'center',a:at(p,1,.6)});
  card(g,c1[0],c1[1],r,comp,{col:C.amber}); { const dA=1-at(p,1,.6); g.save(); g.globalAlpha=1-dA; card(g,c2[0],c2[1],r,hi,{col:C.blue}); g.restore(); }
  // the true heading reference
  pill(g,`${L({en:'actual heading',no:'faktisk kurs'})} ${String(Math.round(wrap(trueH))).padStart(3,'0')}°`,W/2,H*.08,{mono:1,size:11.5*fs,col:'#8EDDB0',al:'center'});
  const err=((comp-trueH+540)%360)-180;
  if(Math.abs(err)>1.5&&p>=.5&&p<3.5) pill(g,`${L({en:'compass error',no:'kompassfeil'})} ${err>0?'+':''}${nf(err)}°`,c1[0],c1[1]+r+44,{mono:1,size:11*fs,col:'#FF8A78',al:'center'});
  if(note) pill(g,note,W/2,H*(sm?.18:.16),{size:11*fs,col:'#fff',al:'center',fit:W});
  // dip illustration (step 1), in place of the heading indicator
  const d0=1-at(p,1,.6);
  if(d0>0.01){ g.save(); g.globalAlpha=d0; const bx=c2[0], by=c2[1], L0=r*1.1;
    txt(g,L({en:'SIDE VIEW · looking west',no:'SIDEBILDE · mot vest'}),bx,by-r-6,{mono:1,size:9.5*fs,col:'#8E99A4',al:'center'});
    g.strokeStyle='rgba(255,255,255,.25)'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(bx-L0,by); g.lineTo(bx+L0,by); g.stroke(); g.setLineDash([]);
    txt(g,'S',bx-L0-10,by+4,{mono:1,size:12*fs,col:'#AEB8C1',al:'right'}); txt(g,'N',bx+L0+10,by+4,{mono:1,size:12*fs,col:'#FF8A78'});
    const dip=70*Math.PI/180; for(let k=-2;k<=2;k++){ const ox=bx+k*L0*.35; g.save(); g.globalAlpha*=.35; arrow(g,ox-Math.cos(dip)*r*.5,by-Math.sin(dip)*r*.5-r*.2,ox+Math.cos(dip)*r*.5,by+Math.sin(dip)*r*.5-r*.2,'#FF8A78',{lw:1.6,head:7}); g.restore(); }
    txt(g,L({en:"Earth's field: north and down, ≈ 70°",no:'jordens felt: nord og ned, ≈ 70°'}),bx,by+r*.95,{size:10.5*fs,col:'#FF8A78',al:'center'});
    // the needle: held level by a weight on the south side
    g.strokeStyle='#E2E8EE'; g.lineWidth=4; g.lineCap='round'; g.beginPath(); g.moveTo(bx-L0*.6,by); g.lineTo(bx+L0*.6,by); g.stroke(); g.fillStyle='#FF8A78'; g.beginPath(); g.moveTo(bx+L0*.6,by-5); g.lineTo(bx+L0*.75,by); g.lineTo(bx+L0*.6,by+5); g.closePath(); g.fill();
    g.fillStyle='#fff'; g.beginPath(); g.arc(bx,by,4,0,7); g.fill(); g.fillStyle=C.amber; g.beginPath(); g.arc(bx-L0*.35,by+7,7,0,7); g.fill();
    pill(g,L({en:'weight on the south side keeps it level',no:'vekt på sørsiden holder den vannrett'}),bx-L0*.35,by+30,{size:10.5*fs,col:C.amber,al:'center',fit:W});
    g.restore(); }
  // gyro rigidity illustration (step 4)
  const g4=at(p,3,.6)*(1-at(p,4,.6));
  if(g4>0.01&&!sm){ g.save(); g.globalAlpha=g4; const gx=W*.5, gy=H*.56, rr2=r*.45;
    g.strokeStyle='rgba(127,198,238,.8)'; g.lineWidth=2; g.beginPath(); g.ellipse(gx,gy,rr2,rr2*.35,0,0,7); g.stroke();
    for(let k=0;k<8;k++){ const a=tm*8+k*Math.PI/4; g.fillStyle='rgba(127,198,238,.6)'; g.beginPath(); g.arc(gx+Math.cos(a)*rr2,gy+Math.sin(a)*rr2*.35,2.5,0,7); g.fill(); }
    g.strokeStyle='#fff'; g.beginPath(); g.moveTo(gx,gy-rr2*1.2); g.lineTo(gx,gy+rr2*1.2); g.stroke(); txt(g,L({en:'axis fixed in space',no:'aksen står fast i rommet'}),gx,gy+rr2*1.6,{size:10.5*fs,col:'#9FD4F2',al:'center'}); g.restore(); }
  // memory aids
  if(p>=.8&&p<1.6) pill(g,'ANDS',c1[0],c1[1]-r-48,{mono:1,size:14*fs,col:C.amber,al:'center'});
  if(p>=1.8&&p<2.6) pill(g,'UNOS',c1[0],c1[1]-r-48,{mono:1,size:14*fs,col:C.amber,al:'center'});
  txt(g,L({en:'northern hemisphere · illustrative',no:'nordlige halvkule · illustrerende'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.2,aspectSm:1/1.0,dwell:7,
    title:{en:'Why the compass lies, and what the gyro does instead',no:'Hvorfor kompasset lyver, og hva gyroen gjør i stedet'},
    sub:{en:'The compass and the heading indicator side by side, in the same aircraft. Watch them disagree, then see which one to trust when.',no:'Kompasset og kursgyroen side om side, i samme fly. Se dem være uenige, og hvilken du skal stole på når.'},
    label:{en:'Animated magnetic compass and heading indicator side by side during acceleration on east, a turn through north and south, gyro drift and resetting the gyro.',no:'Animert magnetkompass og kursgyro side om side under akselerasjon på øst, en sving gjennom nord og sør, gyrodrift og omstilling av gyroen.'},
    foot:{en:'Northern hemisphere, about 60° N. Error sizes are illustrative; the turning error is largest near north and south and grows with latitude and bank.',no:'Nordlige halvkule, rundt 60° N. Feilstørrelsene er illustrerende; svingefeilen er størst nær nord og sør og øker med breddegrad og krengning.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
