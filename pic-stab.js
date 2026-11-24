/* NORDAP – pic-stab.js: "CG, the tail and stability" for stability.html (uses corepic.js).
   Side view of the twin-jet with CG, centre of lift and tail force; a gust pitches the nose up and the aircraft either returns
   (CG ahead of the neutral point) or diverges (CG behind it); then the CG envelope trade-off.
   Illustrative A320-size values: CG limits about 15–40 % MAC, neutral point about 50 % MAC. Not AFM data. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,jet,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
/* CG position (% MAC) per step */
const CG=[25,25,25,25,58,25,33];
const cgAt=p=>{ const i=clamp(Math.floor(p),0,CG.length-2), k=ease(clamp(p-i,0,1)); return lerp(CG[i],CG[i+1],k); };

const steps=[
 {t:{en:'Three forces along the fuselage',no:'Tre krefter langs flykroppen'},
  d:{en:'Weight acts at the <em>CG</em>. The wing\'s lift acts a little <em>behind</em> it. That pair pitches the nose down, so the tailplane pushes <em>down</em> to balance. Every trimmed aircraft flies like this.',
     no:'Vekten virker i <em>tyngdepunktet (CG)</em>. Vingeløftet virker litt <em>bak</em> det. Det paret vil senke nesen, så haleflaten presser <em>nedover</em> for å balansere. Alle trimmede fly flyr slik.'}},
 {t:{en:'A gust lifts the nose',no:'Et vindkast løfter nesen'},
  d:{en:'Angle of attack goes up for a moment. Both the wing and the tail make more lift. The question is which one wins the tug of war about the CG.',
     no:'Innfallsvinkelen øker et øyeblikk. Både vingen og halen lager mer løft. Spørsmålet er hvem som vinner dragkampen om tyngdepunktet.'}},
 {t:{en:'Stable · the nose comes back',no:'Stabilt · nesen kommer tilbake'},
  d:{en:'With the CG <em>ahead of the neutral point</em>, the extra tail lift (long arm) wins. The nose drops back on its own. The distance between the CG and the neutral point is the <em>static margin</em>.',
     no:'Med CG <em>foran nøytralpunktet</em> vinner det ekstra haleløftet (lang arm). Nesen faller tilbake av seg selv. Avstanden mellom CG og nøytralpunktet er den <em>statiske marginen</em>.'}},
 {t:{en:'The neutral point',no:'Nøytralpunktet'},
  d:{en:'The point where the extra lift from a gust acts for the whole aircraft. CG on it: no restoring tendency at all. CG <em>behind</em> it: unstable.',
     no:'Punktet der det ekstra løftet fra et vindkast virker for hele flyet. CG akkurat der: ingen tendens til å rette seg opp. CG <em>bak</em> det: ustabilt.'}},
 {t:{en:'CG too far aft · it diverges',no:'CG for langt bak · det løper løpsk'},
  d:{en:'Now the wing\'s extra lift wins: the nose keeps going up after the gust. The aircraft is light and twitchy on the controls and can be hard to recover from a stall.',
     no:'Nå vinner vingens ekstra løft: nesen fortsetter opp etter vindkastet. Flyet er lett og nervøst på rorene og kan være vanskelig å få ut av en stall.'}},
 {t:{en:'CG forward · stable but heavy',no:'CG langt frem · stabilt men tungt'},
  d:{en:'More stability, but the tail must push down harder: more trim drag, a <em>higher stall speed</em> and heavier forces to rotate and flare. That sets the forward limit.',
     no:'Mer stabilitet, men halen må presse hardere ned: mer trimmotstand, <em>høyere stallfart</em> og tyngre krefter for å rotere og flate ut. Det setter den fremre grensen.'}},
 {t:{en:'The envelope is the compromise',no:'Konvolutten er kompromisset'},
  d:{en:'<em>Forward limit</em>: elevator power to rotate and flare. <em>Aft limit</em>: enough static margin to stay stable. Load the aircraft so the CG stays inside, at every mass from take-off to landing.',
     no:'<em>Fremre grense</em>: nok høyderor til å rotere og flate ut. <em>Bakre grense</em>: nok statisk margin til å være stabil. Last flyet slik at CG holder seg innenfor, ved alle masser fra avgang til landing.'},
  go:{en:'Open the CG and stability lab',no:'Åpne CG- og stabilitetslabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const cg=cgAt(p), NP=50;
  const s=Math.max(2.6,Math.min(W/(sm?46:70),H/30)), cx=W*(sm?.52:.44), cy=H*(sm?.3:.36);
  // MAC: the wing root chord sits between x = 4.6 (LE) and −3.4 m relative to the main gear in jet(); MAC ≈ 4.2 m from x 3.9 to −0.3
  const LE=3.9, MAC=4.2, xOf=pc=>LE-MAC*pc/100;           // aircraft x (m) of a % MAC point
  // pitch response
  const gust=at(p,1,.7);
  const stab=(NP-cg)/25;                                    // >0 stable
  let pitch=0;
  if(p>=1&&p<2) pitch=6*Math.sin(Math.min(1,(p-1))*Math.PI/2);
  else if(p>=2&&p<4){ const t=(tm*0.8)%4; pitch=6*Math.exp(-t*0.9)*Math.cos(t*2.4); }
  else if(p>=4&&p<5){ const t=(tm*0.8)%3.5; pitch=Math.min(18,2+3*Math.exp(t*0.75)-3); }
  // ground-free side view: rotate about the CG
  const xcg=xOf(cg), zcg=4;                                 // CG roughly on the centreline (4 m above the gear contact)
  const th=pitch*Math.PI/180;
  // screen position of an aircraft point (x forward, z up) when pitched about the CG
  const P=(x,z)=>{ const dx=(x-xcg)*s, dz=(z-zcg)*s; return [cx+dx*Math.cos(th)-dz*Math.sin(th), cy-dx*Math.sin(th)-dz*Math.cos(th)]; };
  const o=P(0,0);
  // relative wind / gust arrows
  for(let k=0;k<6;k++){ const ph=((tm*.5+k/6)%1), y=cy-H*.28+k*H*.1; g.strokeStyle=`rgba(255,255,255,${.06+.06*Math.sin(ph*Math.PI)})`; g.lineWidth=1; g.beginPath(); g.moveTo(W-ph*W,y); g.lineTo(W-ph*W-40,y); g.stroke(); }
  if(gust>0.01&&p<2.6){ g.save(); g.globalAlpha=gust*(1-at(p,2.2,.4)); for(let k=0;k<3;k++){ const x=cx+W*(sm?.36:.32)-k*16, y=cy+H*(sm?.12:.3); arrow(g,x,y,x-24,y-24,C.amber,{lw:2,head:8}); } pill(g,L({en:'gust: α ↑',no:'vindkast: α ↑'}),cx+W*(sm?.3:.28),cy+H*(sm?.2:.38),{size:11*fs,col:C.amber,al:'center'}); g.restore(); }
  jet(g,{x:o[0],y:o[1],s,pitch,gear:0,tm});
  // enlarged MAC ruler at the bottom, with leaders from the wing's mean chord
  const R0=W*(sm?.08:.1), R1=W*(sm?.92:.62), RY=H*(sm?.62:.78), RX=pc=>R0+(R1-R0)*pc/100;
  { const a=P(xOf(0),2.3), b=P(xOf(100),2.3); g.save(); g.strokeStyle='rgba(255,255,255,.18)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(R0,RY-14); g.moveTo(b[0],b[1]); g.lineTo(R1,RY-14); g.stroke(); g.setLineDash([]);
    g.strokeStyle='rgba(255,255,255,.7)'; g.lineWidth=2; g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); g.restore();
    g.fillStyle='rgba(255,255,255,.06)'; rr(g,R0,RY-10,R1-R0,20,4); g.fill();
    for(let pc=0;pc<=100;pc+=10){ const x=RX(pc); g.strokeStyle='rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(x,RY-10); g.lineTo(x,RY-(pc%50?4:0)); g.stroke(); if(pc%25===0) txt(g,pc+' %',x,RY+24,{mono:1,size:10*fs,col:'#8E99A4',al:'center'}); }
    txt(g,L({en:'MEAN AERODYNAMIC CHORD (enlarged)',no:'MIDLERE AERODYNAMISK KORDE (forstørret)'}),R0,RY-44,{mono:1,size:9.5*fs,col:'#8E99A4'});
    txt(g,L({en:'leading edge',no:'forkant'}),R0,RY+40,{size:10*fs,col:'#7F8B96'}); txt(g,L({en:'trailing edge',no:'bakkant'}),R1,RY+40,{size:10*fs,col:'#7F8B96',al:'right'});
    const env=at(p,6,.8); if(env>0){ g.save(); g.globalAlpha=env; g.fillStyle='rgba(113,204,147,.35)'; g.fillRect(RX(15),RY-10,RX(40)-RX(15),20); txt(g,L({en:'CG envelope',no:'CG-konvolutt'}),(RX(15)+RX(40))/2,RY+4,{size:10.5*fs,col:'#fff',al:'center',w:600}); g.restore(); }
    const npA2=Math.max(at(p,3,.7),at(p,2,.7)*.6); if(npA2>0){ g.save(); g.globalAlpha=npA2; g.fillStyle=C.violet; g.beginPath(); g.moveTo(RX(NP),RY-12); g.lineTo(RX(NP)-6,RY-22); g.lineTo(RX(NP)+6,RY-22); g.closePath(); g.fill(); txt(g,L({en:'neutral point',no:'nøytralpunkt'}),RX(NP),RY-28,{size:10.5*fs,col:C.violet,al:'center',w:600}); g.restore(); }
    // CG marker
    const xc=RX(cg); g.fillStyle=cg>NP?C.red:'#fff'; g.beginPath(); g.arc(xc,RY,7,0,7); g.fill(); g.fillStyle='#13181D'; g.beginPath(); g.moveTo(xc,RY); g.arc(xc,RY,7,0,Math.PI/2); g.closePath(); g.fill(); g.beginPath(); g.moveTo(xc,RY); g.arc(xc,RY,7,Math.PI,Math.PI*1.5); g.closePath(); g.fill();
    // static margin bracket on the ruler
    const smA=at(p,2,.7)*(1-at(p,4,.6)); if(smA>0&&cg<NP){ g.save(); g.globalAlpha=smA; g.strokeStyle=C.green; g.lineWidth=2; g.beginPath(); g.moveTo(xc,RY+12); g.lineTo(RX(NP),RY+12); g.stroke(); pill(g,`${L({en:'static margin',no:'statisk margin'})} ${nf(NP-cg)} %`,(xc+RX(NP))/2,RY+52,{size:10.5*fs,col:C.green,al:'center'}); g.restore(); }
  }
  // forces
  const F=s*5.2, cgp=P(xcg,zcg);
  const lw=P(xcg-2.4,zcg), tl=P(-19.2,6.0);   // lift drawn 2.4 m aft of the CG (exaggerated so the gap shows)
  const extra=gust*(p<4.95?1:0)*(p<2?1:0.6);
  // weight
  arrow(g,cgp[0],cgp[1],cgp[0],cgp[1]+F,'#F4F7F9',{lw:3.2,head:11}); pill(g,L({en:'Weight',no:'Vekt'}),cgp[0]+10,cgp[1]+F-4,{size:11*fs,col:'#fff'});
  // CG symbol
  g.save(); g.translate(cgp[0],cgp[1]); g.fillStyle='#fff'; g.beginPath(); g.arc(0,0,8,0,7); g.fill(); g.fillStyle='#13181D'; g.beginPath(); g.moveTo(0,0); g.arc(0,0,8,0,Math.PI/2); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0,0); g.arc(0,0,8,Math.PI,Math.PI*1.5); g.closePath(); g.fill(); g.restore();
  pill(g,`CG ${nf(cg)} % MAC`,cgp[0]+12,cgp[1]+s*2.2,{mono:1,size:11*fs,col:cg>NP?'#FF8A78':'#fff',fit:W});
  // wing lift (a bit aft of CG)
  arrow(g,lw[0],lw[1],lw[0],lw[1]-F*(1.05+0.35*extra),C.blue,{lw:3.2,head:11}); pill(g,L({en:'Wing lift',no:'Vingeløft'}),lw[0]+10,lw[1]-F*(1.05+0.35*extra),{size:11*fs,col:C.blue});
  // tail: down normally; in a gust the tail gets an upward increment
  const tailF=-0.18+0.55*extra*(p<4?1:0.4);
  if(Math.abs(tailF)>0.02){ arrow(g,tl[0],tl[1],tl[0],tl[1]-F*tailF,tailF<0?C.mag:C.green,{lw:3,head:10}); pill(g,tailF<0?L({en:'tail pushes down',no:'halen presser ned'}):L({en:'extra tail lift',no:'ekstra haleløft'}),tl[0]-10,tl[1]-F*tailF+(tailF<0?14:-6),{size:10.5*fs,col:tailF<0?'#9CC6EE':'#8EDDB0',al:'right',fit:W}); }
  // pitch readout and verdict
  const verdict=p<1.5?null:p<3.5?[L({en:'returns: stable',no:'kommer tilbake: stabilt'}),C.green]:p<4.6&&p>3.6?[L({en:'keeps pitching up: unstable',no:'fortsetter opp: ustabilt'}),C.red]:null;
  pill(g,`${L({en:'pitch',no:'stigning'})} ${pitch>=0?'+':''}${nf(pitch,1)}°`,16,22,{mono:1,size:11*fs,col:'#fff'});
  if(verdict) pill(g,verdict[0],16,48,{size:11.5*fs,col:verdict[1]});
  // forward CG consequences (step 6)
  const fw=at(p,5,.7)*(1-at(p,6,.6));
  if(fw>0){ g.save(); g.globalAlpha=fw; const x=sm?W*.06:W*.68, y=sm?H*.08:H*.56; rr(g,x,y,sm?W*.88:W*.3,sm?H*.26:H*.3,8); g.fillStyle='rgba(10,15,20,.85)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
    txt(g,L({en:'CG FORWARD',no:'CG LANGT FREM'}),x+12,y+18,{mono:1,size:9.5*fs,col:'#8E99A4'});
    [[L({en:'more tail down-force',no:'mer halekraft nedover'}),'↑'],[L({en:'higher stall speed',no:'høyere stallfart'}),'↑'],[L({en:'more trim drag, fuel',no:'mer trimmotstand, drivstoff'}),'↑'],[L({en:'heavier rotation and flare',no:'tyngre rotasjon og utflating'}),'↑']].forEach(([t,a],i)=>{ txt(g,`${a}  ${t}`,x+14,y+42+i*20*fs,{size:12*fs,col:'#fff'}); });
    g.restore(); }
  txt(g,L({en:'illustrative twin-jet · not to scale',no:'illustrerende tomotors jet · ikke i skala'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.2,aspectSm:1/1.05,dwell:6.5,
    title:{en:'CG, the tail and why an aircraft is stable',no:'CG, halen og hvorfor et fly er stabilt'},
    sub:{en:'A gust lifts the nose. Where the CG sits decides whether the aircraft comes back by itself or keeps going.',no:'Et vindkast løfter nesen. Hvor tyngdepunktet ligger, avgjør om flyet kommer tilbake av seg selv eller fortsetter.'},
    label:{en:'Animated side view of a jet with weight, wing lift and tail force, pitching after a gust with the CG ahead of and behind the neutral point.',no:'Animert sidebilde av et jetfly med vekt, vingeløft og halekraft, som stiger etter et vindkast med CG foran og bak nøytralpunktet.'},
    foot:{en:'Illustrative A320-size values: CG limits about 15–40 % MAC, neutral point about 50 % MAC. Not AFM data.',no:'Illustrerende verdier i A320-størrelse: CG-grenser omtrent 15–40 % MAC, nøytralpunkt omtrent 50 % MAC. Ikke AFM-data.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
