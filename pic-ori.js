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

function canal(g,cx,cy,r,rot,bend,tm,fs){
  // enlarged semicircular canal: the ring turns with the head, the fluid lags, the cupula bends
  g.save(); g.translate(cx,cy);
  // soft glow behind the callout
  const gl=g.createRadialGradient(0,0,r*.3,0,0,r*1.6); gl.addColorStop(0,'rgba(127,198,238,.10)'); gl.addColorStop(1,'rgba(127,198,238,0)');
  g.fillStyle=gl; g.beginPath(); g.arc(0,0,r*1.6,0,7); g.fill();
  g.strokeStyle='rgba(127,198,238,.25)'; g.lineWidth=1; g.setLineDash([3,4]); g.beginPath(); g.arc(0,0,r*1.42,0,7); g.stroke(); g.setLineDash([]);
  g.rotate(rot);
  const tw=r*.24;
  // tube wall and fluid
  g.strokeStyle='#5E9FC6'; g.lineWidth=tw+4; g.beginPath(); g.arc(0,0,r,0,7); g.stroke();
  const fl=g.createRadialGradient(0,0,r-tw/2,0,0,r+tw/2); fl.addColorStop(0,'#0F2433'); fl.addColorStop(.5,'#163447'); fl.addColorStop(1,'#0F2433');
  g.strokeStyle=fl; g.lineWidth=tw; g.beginPath(); g.arc(0,0,r,0,7); g.stroke();
  // ampulla bulge at the top
  const aA=-Math.PI/2;
  g.fillStyle='#5E9FC6'; g.beginPath(); g.ellipse(0,-r,tw*1.05,tw*.95,0,0,7); g.fill();
  g.fillStyle='#163447'; g.beginPath(); g.ellipse(0,-r,tw*.85,tw*.75,0,0,7); g.fill();
  // fluid particles: lag behind the ring when bend != 0 (relative drift)
  const drift=-bend*.9;
  for(let k=0;k<26;k++){ const a=k/26*Math.PI*2+drift+(k%3)*.05, rr2=r+((k*37)%7-3)/3*tw*.25;
    if(Math.abs(Math.atan2(Math.sin(a-aA),Math.cos(a-aA)))<.22) continue;
    g.fillStyle=`rgba(159,212,242,${.45+.35*((k*13)%5)/5})`; g.beginPath(); g.arc(Math.cos(a)*rr2,Math.sin(a)*rr2,Math.max(1.2,r*.028),0,7); g.fill(); }
  // flow arrows inside the tube, showing the fluid moving relative to the canal
  if(Math.abs(bend)>.12){ const dir=bend>0?-1:1, al=Math.min(1,Math.abs(bend)*1.4);
    g.strokeStyle=`rgba(159,212,242,${.85*al})`; g.lineWidth=2; g.lineCap='round';
    for(const c of [Math.PI*.15,Math.PI*.85]){ const a0=c-dir*.35, a1=c+dir*.35;
      g.beginPath(); g.arc(0,0,r,Math.min(a0,a1),Math.max(a0,a1)); g.stroke();
      const hx=Math.cos(a1)*r, hy=Math.sin(a1)*r, tx=-Math.sin(a1)*dir, ty=Math.cos(a1)*dir;
      g.beginPath(); g.moveTo(hx,hy); g.lineTo(hx-tx*7+ty*4,hy-ty*7-tx*4); g.moveTo(hx,hy); g.lineTo(hx-tx*7-ty*4,hy-ty*7+tx*4); g.stroke(); } }
  // cupula: a gelatinous flap across the ampulla, with hair cells at its base
  const b=clamp(bend,-1,1)*tw*.9, base=-r+tw*.78, top=-r-tw*.78;
  g.fillStyle='rgba(228,107,174,.55)'; g.strokeStyle='#E46BAE'; g.lineWidth=1.6;
  g.beginPath(); g.moveTo(-tw*.22,base); g.quadraticCurveTo(-tw*.22+b*.3,(base+top)/2,b-tw*.12,top+2);
  g.quadraticCurveTo(b,top-2,b+tw*.12,top+2); g.quadraticCurveTo(tw*.22+b*.3,(base+top)/2,tw*.22,base); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle='#fff'; g.lineWidth=1.3;
  for(let k=-2;k<=2;k++){ const x0=k*tw*.09; g.beginPath(); g.moveTo(x0,base); g.quadraticCurveTo(x0+b*.15,base-tw*.35,x0+b*.45,base-tw*.7); g.stroke(); }
  g.fillStyle='#F29AC8'; g.fillRect(-tw*.3,base,tw*.6,3);
  g.restore(); }

function head(g,cx,cy,hr,bank){
  // pilot seen from behind the seat: head, headset and shoulders, tilting with the aircraft
  g.save(); g.translate(cx,cy+hr*1.25); g.rotate(bank*Math.PI/180); g.translate(0,-hr*1.25);
  const sk=g.createLinearGradient(-hr,0,hr,0); sk.addColorStop(0,'#3A4855'); sk.addColorStop(.5,'#52626F'); sk.addColorStop(1,'#3A4855');
  // shoulders
  g.fillStyle='#2A3540'; g.beginPath(); g.moveTo(-hr*1.55,hr*2.05); g.quadraticCurveTo(-hr*1.5,hr*1.25,-hr*.4,hr*1.12); g.lineTo(hr*.4,hr*1.12); g.quadraticCurveTo(hr*1.5,hr*1.25,hr*1.55,hr*2.05); g.closePath(); g.fill();
  g.strokeStyle='rgba(228,107,174,.6)'; g.lineWidth=2; g.beginPath(); g.moveTo(-hr*1.1,hr*1.35); g.lineTo(-hr*1.0,hr*2.0); g.moveTo(hr*1.1,hr*1.35); g.lineTo(hr*1.0,hr*2.0); g.stroke();
  // neck and head
  g.fillStyle='#46545F'; g.fillRect(-hr*.3,hr*.7,hr*.6,hr*.5);
  g.fillStyle=sk; g.beginPath(); g.ellipse(0,0,hr*.78,hr,0,0,7); g.fill();
  const hair=g.createRadialGradient(-hr*.2,-hr*.4,hr*.1,0,0,hr); hair.addColorStop(0,'#3A3530'); hair.addColorStop(1,'#1E1B18'); g.fillStyle=hair; g.beginPath(); g.ellipse(0,-hr*.04,hr*.79,hr*.96,0,0,7); g.fill();
  // headset
  g.strokeStyle='#1C232A'; g.lineWidth=hr*.16; g.beginPath(); g.arc(0,-hr*.05,hr*.9,Math.PI*1.08,Math.PI*1.92); g.stroke();
  for(const sx of [-1,1]){ g.fillStyle='#1C232A'; g.beginPath(); g.ellipse(sx*hr*.86,hr*.05,hr*.2,hr*.3,0,0,7); g.fill();
    g.fillStyle='#9A1E68'; g.beginPath(); g.ellipse(sx*hr*.86,hr*.05,hr*.09,hr*.15,0,0,7); g.fill(); }
  // horizon reference through the head: a level line the head tilts against
  g.restore(); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const ga=at(p,3,.7)*(1-at(p,4,.7)), cure=at(p,4,.7), can=1-at(p,3,.7);
  if(can>0.01){ g.save(); g.globalAlpha=can;
    // one state per step: [real bank, felt bank, cupula bend (+ = sensing a roll right)]
    const SS=[[20,20,.85],[30,0,0],[0,-12,-.85],[0,0,0]], i0=clamp(Math.floor(p),0,2), kk=ease(clamp(p-i0,0,1)), A=SS[i0], B=SS[i0+1];
    const real=lerp(A[0],B[0],kk), felt=lerp(A[1],B[1],kk), bendS=lerp(A[2],B[2],kk);
    const hr=Math.min(H*(sm?.075:.1),W*(sm?.075:.05)), hx=W*(sm?.2:.13), hy=H*(sm?.22:.4);
    // a level horizon behind the head, so the tilt reads
    g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1; g.setLineDash([4,5]); g.beginPath(); g.moveTo(hx-hr*1.9,hy+hr*1.25); g.lineTo(hx+hr*1.9,hy+hr*1.25); g.stroke(); g.setLineDash([]);
    head(g,hx,hy,hr,real);
    txt(g,L({en:'PILOT',no:'PILOT'}),hx,hy-hr*1.35-8,{mono:1,size:10*fs,col:'#AEB8C1',al:'center'});
    const cr=Math.min(W*(sm?.13:.075),H*(sm?.13:.17)), cx=W*(sm?.64:.31), cy=hy;
    // leader from the ear to the enlarged canal
    const ex=hx+Math.cos(real*Math.PI/180)*hr*.86-Math.sin(real*Math.PI/180)*(-hr*1.2), ey=hy+hr*1.25+Math.sin(real*Math.PI/180)*hr*.86+Math.cos(real*Math.PI/180)*(-hr*1.2);
    g.strokeStyle='rgba(127,198,238,.45)'; g.lineWidth=1; g.setLineDash([2,3]); g.beginPath(); g.moveTo(ex,ey); g.lineTo(cx-cr*1.42,cy); g.stroke(); g.setLineDash([]);
    canal(g,cx,cy,cr,real*Math.PI/180,bendS,tm,fs);
    txt(g,L({en:'INNER EAR · enlarged',no:'INDREØRET · forstørret'}),cx,cy-cr*1.42-10,{mono:1,size:10*fs,col:'#AEB8C1',al:'center'});
    pill(g,Math.abs(bendS)<.15?L({en:'cupula straight: "no rotation"',no:'cupula rett: «ingen rotasjon»'}):bendS>0?L({en:'fluid lags, cupula bends: "rolling right"',no:'væsken henger etter, cupula bøyes: «ruller til høyre»'}):L({en:'bent the other way: "rolling left"',no:'bøyd andre veien: «ruller til venstre»'}),sm?W*.5:cx,cy+cr*1.42+(sm?16:20),{size:10.5*fs,col:Math.abs(bendS)<.15?'#fff':'#F29AC8',al:'center',fit:W});
    // two attitude indicators: reality and feeling
    const r2=Math.min(W*(sm?.16:.09),H*.17), y2=sm?H*.7:H*.42, xa=sm?W*.27:W*.6, xb=sm?W*.73:W*.85;
    ai(g,xa,y2,r2,real,0,L({en:'REALITY',no:'VIRKELIGHET'}),C.amber);
    ai(g,xb,y2,r2,felt,0,L({en:'WHAT YOU FEEL',no:'DET DU FØLER'}),'#E46BAE');
    pill(g,`${nf(Math.abs(real))}° ${real>0.5?L({en:'right',no:'høyre'}):''}`.trim(),xa,y2-r2-14,{mono:1,size:11*fs,col:C.amber,al:'center'});
    pill(g,`${nf(Math.abs(felt))}° ${felt>0.5?L({en:'right',no:'høyre'}):felt<-0.5?L({en:'left',no:'venstre'}):''}`.trim(),xb,y2-r2-14,{mono:1,size:11*fs,col:'#F29AC8',al:'center'});
    const mis=Math.abs(real-felt);
    if(mis>3) pill(g,`${L({en:'mismatch',no:'avvik'})} ${nf(mis)}°`,(xa+xb)/2,y2+r2+(sm?40:46),{mono:1,size:11*fs,col:'#FF8A78',al:'center'});
    if(p>=1.6&&p<2.6&&!sm) pill(g,L({en:'level, but it feels like a left bank → the leans',no:'rett, men føles som venstre krengning → «the leans»'}),(xa+xb)/2,y2+r2+74,{size:11*fs,col:'#FF8A78',al:'center',fit:W});
    g.restore(); }
  if(ga>0.01){ g.save(); g.globalAlpha=ga;
    const gy=H*.86; const gr=g.createLinearGradient(0,gy,0,H); gr.addColorStop(0,'#22362A'); gr.addColorStop(1,'#15211A'); g.fillStyle=gr; g.fillRect(0,gy,W,H-gy);
    g.strokeStyle='rgba(140,200,150,.25)'; g.beginPath(); g.moveTo(0,gy); g.lineTo(W,gy); g.stroke();
    const s=Math.max(2.2,W/(sm?170:230)), ax=W*(sm?.36:.24), ay=H*(sm?.34:.52);
    const k=ease(at(p,3,.45));
    jet(g,{x:ax,y:ay,s,pitch:8+17*k,gear:0,tm,alpha:.28*k*g.globalAlpha});
    jet(g,{x:ax,y:ay,s,pitch:8,gear:0,tm});
    // pitch lines from the aircraft: real (amber) and felt (pink)
    const Lr=Math.min(s*48,W*(sm?.56:.36)); g.lineWidth=2; g.setLineDash([7,5]);
    g.strokeStyle='rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(ax-s*4,ay); g.lineTo(ax+Lr,ay); g.stroke();
    g.strokeStyle=C.amber; g.beginPath(); g.moveTo(ax+s*16,ay-s*16*Math.tan(8*Math.PI/180)); g.lineTo(ax+Lr,ay-Lr*Math.tan(8*Math.PI/180)); g.stroke();
    const fp=(8+17*k)*Math.PI/180; g.strokeStyle='#E46BAE'; g.beginPath(); g.moveTo(ax+s*16*Math.cos(fp),ay-s*16*Math.sin(fp)); g.lineTo(ax+Lr*Math.cos(fp),ay-Lr*Math.sin(fp)); g.stroke(); g.setLineDash([]);
    g.strokeStyle='rgba(228,107,174,.6)'; g.lineWidth=1.5; g.beginPath(); g.arc(ax,ay,Lr*.82,-fp,-8*Math.PI/180); g.stroke();
    pill(g,L({en:'feels like 20°+ nose up',no:'føles som 20°+ nese opp'}),ax+Lr*Math.cos(fp),ay-Lr*Math.sin(fp)-16,{size:11*fs,col:'#F29AC8',al:'center',fit:W,a:k});
    pill(g,L({en:'real pitch 8°',no:'faktisk stigning 8°'}),ax+Lr*.98,ay-Lr*Math.tan(8*Math.PI/180)+20,{size:11*fs,col:C.amber,al:'center',fit:W});
    // the trap: pushing the nose down to "correct"
    const tr=at(p,3,.25);
    if(tr>0){ g.save(); g.globalAlpha*=tr; g.strokeStyle='#FF8A78'; g.lineWidth=2; g.setLineDash([6,5]);
      const x0=ax+s*17, y0=ay-s*1.2; g.beginPath(); g.moveTo(x0,y0+4); g.quadraticCurveTo(x0+W*.1,y0+H*.04,x0+W*(sm?.3:.17),gy); g.stroke(); g.setLineDash([]);
      txt(g,L({en:'nose down to "fix" it → terrain',no:'nese ned for å «rette» → bakken'}),Math.min(x0+W*(sm?.3:.17)+40,W-8),gy+16,{size:10.5*fs,col:'#FF8A78',al:'right'}); g.restore(); }
    // why: g plus the push back into the seat
    const vx=sm?W*.4:W*.8, vy=sm?H*.58:H*.24, F=Math.min(W,H)*(sm?.16:.22);
    txt(g,L({en:'WHAT THE OTOLITHS FEEL',no:'DET OTOLITTENE KJENNER'}),vx-F*.2,vy-16,{mono:1,size:10*fs,col:'#AEB8C1',al:'center'});
    arrow(g,vx,vy,vx,vy+F,'#fff',{lw:3,head:10}); txt(g,'g',vx+8,vy+F-4,{mono:1,size:12*fs,col:'#fff'});
    arrow(g,vx,vy,vx-F*.45,vy,C.amber,{lw:3,head:10}); txt(g,L({en:'push back',no:'press bakover'}),vx-F*.45-4,vy+4,{size:10.5*fs,col:C.amber,al:'right'});
    arrow(g,vx,vy,vx-F*.45,vy+F,'#E46BAE',{lw:3.4,head:11});
    txt(g,L({en:'felt "down"',no:'følt «ned»'}),vx-F*.45-6,vy+F+4,{size:10.5*fs,col:'#F29AC8',al:'right'});
    g.restore(); }
  if(cure>0.01){ g.save(); g.globalAlpha=cure; const r=Math.min(W*(sm?.28:.15),H*.3); ai(g,W*.5,H*.46,r,0,0,null,C.amber);
    txt(g,L({en:'ATTITUDE INDICATOR',no:'HOLDNINGSINDIKATOR'}),W*.5,H*.46-r-14,{mono:1,size:10.5*fs,col:'#AEB8C1',al:'center'});
    pill(g,L({en:'look · say · fly',no:'se · si · fly'}),W*.5,H*.46+r+24,{size:12*fs,col:'#fff',al:'center'}); g.restore(); }
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
