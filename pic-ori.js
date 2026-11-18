/* NORDAP – pic-ori.js: "Why your inner ear lies" for orientation.html (uses corepic.js).
   The semicircular canal with its fluid lagging and catching up (turn entry, steady turn, roll-out), the leans,
   the somatogravic illusion on a go-around (acceleration feels like pitch-up), and the cure: the attitude indicator. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT,jet}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'The canal senses a change in rotation',no:'Buegangen merker endring i rotasjon'},
  d:{en:'Roll into a turn: the canal turns, the fluid lags behind and bends the hair cells. You <em>feel the roll</em>. The ear only senses <em>changes</em> — not steady rotation.',
     no:'Rull inn i en sving: buegangen roterer, væsken henger etter og bøyer hårcellene. Du <em>kjenner rullingen</em>. Øret merker bare <em>endringer</em> — ikke jevn rotasjon.'}},
 {t:{en:'Steady turn · the feeling fades',no:'Jevn sving · følelsen forsvinner'},
  d:{en:'After about <em>10–20 seconds</em> the fluid catches up and the hair cells stand straight. You now feel <em>level</em>, though you are still banked. A slow roll (below about 2°/s) is never felt at all.',
     no:'Etter omtrent <em>10–20 sekunder</em> tar væsken igjen buegangen, og hårcellene retter seg opp. Nå føler du deg <em>rett</em>, selv om du fortsatt krenger. En langsom rulling (under omtrent 2°/s) merkes aldri.'}},
 {t:{en:'Roll out · the leans',no:'Rett ut · leans'},
  d:{en:'Level the wings: the fluid keeps moving and the ear reports a roll the <em>other way</em>. You feel banked although you are level — and want to lean or roll back into the turn. That is the <em>leans</em>.',
     no:'Rett opp vingene: væsken fortsetter å bevege seg, og øret melder en rulling <em>andre veien</em>. Du føler at du krenger selv om du er rett — og vil lene deg eller rulle tilbake i svingen. Det er <em>leans</em>.'}},
 {t:{en:'Go-around · acceleration feels like pitch-up',no:'Gå rundt · akselerasjon føles som stigning'},
  d:{en:'TOGA pushes you back in the seat. The otoliths cannot tell <em>acceleration</em> from <em>tilting back</em>, so it feels like a steep climb. Pushing the nose down to "correct" it has led aircraft into the ground (<em>somatogravic illusion</em>).',
     no:'TOGA presser deg bakover i setet. Otolittene kan ikke skille <em>akselerasjon</em> fra å <em>vippe bakover</em>, så det føles som en bratt stigning. Å presse nesen ned for å «rette opp» har ført fly i bakken (<em>somatogravisk illusjon</em>).'}},
 {t:{en:'The cure · trust the instruments',no:'Kuren · stol på instrumentene'},
  d:{en:'Your body will be confident and wrong. Look at the <em>attitude indicator</em>, say what it shows, and fly that. Cross-check with the second pilot. Avoid quick head movements in turns.',
     no:'Kroppen din vil være sikker og ta feil. Se på <em>holdningsindikatoren</em>, si hva den viser, og fly etter den. Kryssjekk med den andre piloten. Unngå raske hodebevegelser i svinger.'},
  go:{en:'Feel against reality in the lab',no:'Følelse mot virkelighet i labben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function ai(g,cx,cy,r,bank,pitch,lab,col){
  g.save(); g.beginPath(); g.arc(cx,cy,r,0,7); g.clip();
  g.translate(cx,cy); g.rotate(-bank*Math.PI/180); const py=pitch*r/30;
  g.fillStyle='#2F6FB0'; g.fillRect(-r*2,-r*2+py,r*4,r*2); g.fillStyle='#7A5634'; g.fillRect(-r*2,py,r*4,r*2);
  g.strokeStyle='#fff'; g.lineWidth=1.5; g.beginPath(); g.moveTo(-r*2,py); g.lineTo(r*2,py); g.stroke();
  for(let d=-20;d<=20;d+=10){ if(!d) continue; const y=py-d*r/30; g.beginPath(); g.moveTo(-r*.2,y); g.lineTo(r*.2,y); g.stroke(); }
  g.restore();
  g.strokeStyle='rgba(255,255,255,.3)'; g.lineWidth=1.5; g.beginPath(); g.arc(cx,cy,r,0,7); g.stroke();
  g.strokeStyle=col||C.amber; g.lineWidth=4; g.beginPath(); g.moveTo(cx-r*.55,cy); g.lineTo(cx-r*.18,cy); g.lineTo(cx-r*.1,cy+r*.08); g.moveTo(cx+r*.55,cy); g.lineTo(cx+r*.18,cy); g.lineTo(cx+r*.1,cy+r*.08); g.stroke(); g.fillStyle=col||C.amber; g.fillRect(cx-3,cy-3,6,6);
  if(lab) txt(g,lab,cx,cy+r+18,{mono:1,size:11,col:'#AEB8C1',al:'center'}); }

function canal(g,cx,cy,r,rot,fluid,tm){
  // the ring rotates with the head; the fluid marker lags
  g.save(); g.translate(cx,cy);
  g.strokeStyle='rgba(127,198,238,.85)'; g.lineWidth=r*.22; g.beginPath(); g.arc(0,0,r,0,7); g.stroke();
  g.strokeStyle='rgba(15,22,29,1)'; g.lineWidth=r*.12; g.beginPath(); g.arc(0,0,r,0,7); g.stroke();
  // fluid dots move with angle fluid
  for(let k=0;k<12;k++){ const a=fluid+k*Math.PI/6; g.fillStyle='rgba(159,212,242,.9)'; g.beginPath(); g.arc(Math.cos(a)*r,Math.sin(a)*r,r*.045,0,7); g.fill(); }
  // cupula on the ring at angle rot, bent by the relative motion
  const bend=clamp((fluid-rot)*2.2,-0.9,0.9);
  g.rotate(rot); g.fillStyle='#E46BAE'; g.beginPath(); g.moveTo(r-r*.1,0); g.quadraticCurveTo(r,-bend*r*.25,r+r*.1,0); g.lineTo(r+r*.1,r*.02); g.quadraticCurveTo(r,-bend*r*.25+r*.04,r-r*.1,r*.02); g.closePath(); g.fill();
  g.strokeStyle='#E46BAE'; g.lineWidth=3; g.beginPath(); g.moveTo(r-r*.11,0); g.lineTo(r+r*.11,0); g.stroke();
  for(let k=-2;k<=2;k++){ g.strokeStyle='#fff'; g.lineWidth=1.4; g.beginPath(); g.moveTo(r+k*r*.04,r*.01); g.quadraticCurveTo(r+k*r*.04+bend*r*.12,-r*.06,r+k*r*.04+bend*r*.2,-r*.12); g.stroke(); }
  g.restore(); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const ga=at(p,3,.7)*(1-at(p,4,.7)), cure=at(p,4,.7), can=1-ga;
  if(can>0.01){ g.save(); g.globalAlpha=can*(1-cure*.0);
    // real bank vs felt bank over the steps
    // one state per step: [real bank, felt bank, cupula bend (+ = sensing a roll right)]
    const SS=[[20,20,.8],[30,0,0],[0,-12,-.8],[0,0,0]], i0=clamp(Math.floor(p),0,2), kk=ease(clamp(p-i0,0,1)), A=SS[i0], B=SS[i0+1];
    const real=lerp(A[0],B[0],kk), felt=lerp(A[1],B[1],kk), bendS=lerp(A[2],B[2],kk);
    const rot=real*Math.PI/180*1.5, fl=rot+bendS*.4;
    const cr=Math.min(W*(sm?.14:.1),H*.18), cx=W*(sm?.5:.22), cy=H*(sm?.2:.42);
    canal(g,cx,cy,cr,rot,fl,tm);
    txt(g,L({en:'SEMICIRCULAR CANAL',no:'BUEGANG'}),cx,cy-cr-20,{mono:1,size:10*fs,col:'#AEB8C1',al:'center'});
    const bent=Math.abs(real-felt)>0.5||Math.abs(felt)>0.5;
    pill(g,Math.abs(bendS)<.15?L({en:'hair cells straight: "no rotation"',no:'hårcellene rette: «ingen rotasjon»'}):bendS>0?L({en:'hair cells bent: "rolling right"',no:'hårcellene bøyd: «ruller til høyre»'}):L({en:'bent the other way: "rolling left"',no:'bøyd andre veien: «ruller til venstre»'}),cx,cy+cr+(sm?20:26),{size:10.5*fs,col:Math.abs(bendS)<.15?'#fff':'#F29AC8',al:'center',fit:W});
    // two attitude indicators: reality and feeling
    const r2=Math.min(W*(sm?.16:.1),H*.17), y2=sm?H*.68:H*.42, xa=sm?W*.27:W*.52, xb=sm?W*.73:W*.8;
    ai(g,xa,y2,r2,real,0,L({en:'REALITY',no:'VIRKELIGHET'}),C.amber);
    ai(g,xb,y2,r2,felt,0,L({en:'WHAT YOU FEEL',no:'DET DU FØLER'}),'#E46BAE');
    pill(g,`${nf(Math.abs(real))}° ${real>0.5?L({en:'right',no:'høyre'}):''}`,xa,y2-r2-14,{mono:1,size:11*fs,col:C.amber,al:'center'});
    pill(g,`${nf(Math.abs(felt))}° ${felt>0.5?L({en:'right',no:'høyre'}):felt<-0.5?L({en:'left',no:'venstre'}):''}`,xb,y2-r2-14,{mono:1,size:11*fs,col:'#F29AC8',al:'center'});
    if(p>=1.6&&p<2.6) pill(g,L({en:'level, but it feels like a left bank',no:'rett, men det føles som krengning til venstre'}),W*(sm?.5:.66),y2+r2+44,{size:11*fs,col:'#FF8A78',al:'center',fit:W});
    g.restore(); }
  if(ga>0.01){ g.save(); g.globalAlpha=ga;
    const gy=H*.85; g.fillStyle='#1b2a22'; g.fillRect(0,gy,W,H-gy);
    const s=Math.max(2,W/300), ax=W*.42, ay=H*.55;
    jet(g,{x:ax,y:ay,s,pitch:8,gear:0,tm});
    // the head: acceleration vector + gravity = resultant tilted back
    const hx=W*(sm?.5:.78), hy=H*.4, F=Math.min(W,H)*.2;
    arrow(g,hx,hy,hx,hy+F,'#fff',{lw:3,head:10}); txt(g,'g',hx+8,hy+F,{mono:1,size:12*fs,col:'#fff'});
    arrow(g,hx,hy,hx-F*.45,hy,C.amber,{lw:3,head:10}); txt(g,L({en:'acceleration',no:'akselerasjon'}),hx-F*.45,hy-10,{size:11*fs,col:C.amber,al:'center'});
    arrow(g,hx,hy,hx-F*.45,hy+F,'#E46BAE',{lw:3.4,head:11}); pill(g,L({en:'felt "down": tilted back',no:'følt «ned»: vippet bakover'}),hx-F*.45,hy+F+20,{size:11*fs,col:'#F29AC8',al:'center',fit:W});
    pill(g,L({en:'feels like 20°+ nose up',no:'føles som 20°+ nese opp'}),ax,ay-H*.18,{size:11*fs,col:'#FF8A78',al:'center',fit:W});
    pill(g,L({en:'real pitch 8°',no:'faktisk stigning 8°'}),ax,ay+H*.12,{size:11*fs,col:C.amber,al:'center'});
    g.restore(); }
  if(cure>0.01){ g.save(); g.globalAlpha=cure; const r=Math.min(W*(sm?.28:.16),H*.3); ai(g,W*.5,H*.48,r,0,0,null,C.amber);
    pill(g,L({en:'look · say · fly',no:'se · si · fly'}),W*.5,H*.48+r+24,{size:12*fs,col:'#fff',al:'center'}); g.restore(); }
  txt(g,L({en:'schematic',no:'skjematisk'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.2,aspectSm:1/1.1,dwell:7,
    title:{en:'Why your inner ear lies, and what to do about it',no:'Hvorfor det indre øret lyver, og hva du gjør med det'},
    sub:{en:'Reality on one instrument, your feeling on the other. Watch them drift apart in a turn and on a go-around.',no:'Virkeligheten på ett instrument, følelsen din på det andre. Se dem gli fra hverandre i en sving og ved en avbrutt innflyging.'},
    label:{en:'Animated semicircular canal with fluid and hair cells, beside two attitude indicators for reality and feeling through a turn and a roll-out, then the go-around illusion and the attitude indicator.',no:'Animert buegang med væske og hårceller, ved siden av to holdningsindikatorer for virkelighet og følelse gjennom en sving og utretting, deretter go-around-illusjonen og holdningsindikatoren.'},
    foot:{en:'Schematic. Thresholds and times vary between people; fatigue and head movement make them worse.',no:'Skjematisk. Terskler og tider varierer mellom mennesker; tretthet og hodebevegelser gjør dem verre.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
