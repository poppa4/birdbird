/* NORDAP – pic-gnav.js: "The wind triangle and 1 in 60" for gennav.html (uses corepic.js).
   Plan view: the track to fly, the wind blowing the aircraft off it, the crab angle that keeps it on track, the triangle of
   velocities (heading/TAS + wind = track/GS), then a track error corrected with the 1 in 60 rule.
   Example: track 090°, TAS 120 kt, wind 030°/30 kt → WCA ≈ 12° left (heading 078°), GS ≈ 103 kt. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const TRK=90, TAS=120, WD=30, WS=30;
const r2d=180/Math.PI, d2r=Math.PI/180;
// wind blowing FROM WD → vector towards WD+180
const wx=WS*Math.sin((WD+180)*d2r), wy=-WS*Math.cos((WD+180)*d2r);
const xw=WS*Math.sin((TRK-WD)*d2r);                      // crosswind component from the left (+)
const WCA=Math.asin(xw/TAS)*r2d;                         // into wind (to the left here)
const HDG=TRK-WCA;
const GS=TAS*Math.cos(WCA*d2r)-WS*Math.cos((WD-TRK)*d2r);

const steps=[
 {t:{en:'Point the nose where you want to go…',no:'Pek nesen dit du vil…'},
  d:{en:'Fly heading 090° with no correction and the air mass carries you sideways. You end up <em>right of the track</em>, on a course the wind chose for you.',
     no:'Fly kurs 090° uten korreksjon, og luftmassen fører deg sidelengs. Du havner <em>til høyre for sporet</em>, på en kurs vinden valgte for deg.'}},
 {t:{en:'Crab into the wind',no:'Hold opp mot vinden'},
  d:{en:`Turn the nose <em>into the wind</em> by the wind correction angle. Now the sideways drift is cancelled and the <em>track</em> stays on the line. Here: heading ${Math.round(HDG).toString().padStart(3,'0')}° for track 090°.`,
     no:`Drei nesen <em>mot vinden</em> med vindkorreksjonsvinkelen. Nå oppheves avdriften, og <em>sporet</em> blir liggende på linjen. Her: kurs ${Math.round(HDG).toString().padStart(3,'0')}° for spor 090°.`}},
 {t:{en:'The triangle of velocities',no:'Hastighetstrekanten'},
  d:{en:'Three arrows, nose to tail: <em>heading and TAS</em> (where the aircraft points, how fast through the air) plus the <em>wind</em> gives <em>track and groundspeed</em>. Know any two and the third follows.',
     no:'Tre piler, spiss mot hale: <em>kurs og TAS</em> (der flyet peker, hvor fort gjennom luften) pluss <em>vinden</em> gir <em>spor og groundspeed</em>. Kjenner du to, følger den tredje.'}},
 {t:{en:'Quick numbers',no:'Raske tall'},
  d:{en:`Crosswind ≈ wind × sin(angle) → WCA ≈ crosswind ÷ (TAS/60). Here ${nf(xw,0)} kt ÷ 2 ≈ <em>${nf(WCA,0)}°</em>. Headwind part ≈ wind × cos(angle) → GS ≈ <em>${nf(GS,0)} kt</em>. Time = distance ÷ GS.`,
     no:`Sidevind ≈ vind × sin(vinkel) → WCA ≈ sidevind ÷ (TAS/60). Her ${nf(xw,0)} kt ÷ 2 ≈ <em>${nf(WCA,0)}°</em>. Motvindsdel ≈ vind × cos(vinkel) → GS ≈ <em>${nf(GS,0)} kt</em>. Tid = distanse ÷ GS.`}},
 {t:{en:'1 in 60 · off track',no:'1 av 60 · utenfor sporet'},
  d:{en:'After 30 NM you find yourself <em>3 NM right</em> of track. 1 NM off after 60 NM is 1°, so 3 NM after 30 NM is a <em>track error of 6°</em>.',
     no:'Etter 30 NM ser du at du er <em>3 NM til høyre</em> for sporet. 1 NM ute etter 60 NM er 1°, så 3 NM etter 30 NM er et <em>sporavvik på 6°</em>.'}},
 {t:{en:'Correct · parallel, then home in',no:'Korriger · parallelt, så inn'},
  d:{en:'Turn left 6° to fly parallel. To regain the destination with 30 NM to go, add the <em>closing angle</em>: 3 NM in 30 NM = 6°. Total <em>12° left</em>. Then 6° back right when you are on the line.',
     no:'Sving 6° til venstre for å fly parallelt. For å nå destinasjonen med 30 NM igjen, legg til <em>lukkevinkelen</em>: 3 NM på 30 NM = 6°. Til sammen <em>12° til venstre</em>. Sving 6° tilbake til høyre når du er på linjen.'},
  go:{en:'Open the navigation lab',no:'Åpne navigasjonslabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function plane(g,x,y,hdg,col,sc){ g.save(); g.translate(x,y); g.rotate(hdg*d2r); const s=sc||1; g.fillStyle=col||'#fff';
  g.beginPath(); g.moveTo(0,-11*s); g.lineTo(1.8*s,-4*s); g.lineTo(10*s,1*s); g.lineTo(10*s,3*s); g.lineTo(1.8*s,1*s); g.lineTo(1.4*s,7*s); g.lineTo(4*s,9.5*s); g.lineTo(4*s,11*s); g.lineTo(0,10*s); g.lineTo(-4*s,11*s); g.lineTo(-4*s,9.5*s); g.lineTo(-1.4*s,7*s); g.lineTo(-1.8*s,1*s); g.lineTo(-10*s,3*s); g.lineTo(-10*s,1*s); g.lineTo(-1.8*s,-4*s); g.closePath(); g.fill(); g.restore(); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const nav=at(p,4,.9), tri=1-nav;
  const A=[W*.08,H*(sm?.42:.5)], B=[W*(sm?.92:.66),A[1]];
  const tw=B[0]-A[0];
  // map grid
  g.strokeStyle='rgba(255,255,255,.04)'; g.lineWidth=1; for(let x=0;x<W;x+=40){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,H); g.stroke(); } for(let y=0;y<H;y+=40){ g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
  // wind streaks
  const wdir=(WD+180)*d2r, ux=Math.sin(wdir), uy=-Math.cos(wdir);
  for(let k=0;k<26;k++){ const ph=((tm*.08+k*.137)%1), bx=(k*97%W), by=(k*53%H); const x=bx+ux*ph*160-80*ux, y=by+uy*ph*160-80*uy; g.strokeStyle=`rgba(127,198,238,${.18*Math.sin(ph*Math.PI)})`; g.lineWidth=1.3; g.beginPath(); g.moveTo(x,y); g.lineTo(x+ux*18,y+uy*18); g.stroke(); }
  // wind arrow legend
  const lx=W*(sm?.8:.86), ly=H*.14; arrow(g,lx-ux*26,ly-uy*26,lx+ux*26,ly+uy*26,C.blue,{lw:3,head:10}); txt(g,`${L({en:'wind',no:'vind'})} ${String(WD).padStart(3,'0')}°/${WS} kt`,lx,ly+44,{mono:1,size:10.5*fs,col:'#9FD4F2',al:'center'});
  // A and B
  const pt=(q,l)=>{ g.fillStyle='#fff'; g.beginPath(); g.arc(q[0],q[1],5,0,7); g.fill(); txt(g,l,q[0],q[1]-12,{mono:1,size:12*fs,col:'#fff',al:'center',w:600}); };
  // planned track
  g.strokeStyle='rgba(228,107,174,.8)'; g.lineWidth=2.2; g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(B[0],B[1]); g.stroke();
  pill(g,L({en:'track 090°',no:'spor 090°'}),A[0]+tw*.82,A[1]-18,{mono:1,size:10.5*fs,col:'#F29AC8',al:'center',a:tri});
  pt(A,'A'); pt(B,'B');
  if(tri>0.01){ g.save(); g.globalAlpha=tri;
    // step 1: drifting path without correction (track = heading + drift to the right)
    const k=(tm*.12)%1, t1=1-at(p,1,.6);
    if(t1>0.01){ const drift=Math.atan2(TAS*Math.sin(TRK*d2r)+wx,-(TAS*Math.cos(TRK*d2r))+wy*-1); const dAng=Math.atan2(wy+(-TAS*Math.cos(TRK*d2r)),wx+TAS*Math.sin(TRK*d2r));
      const len=tw*1.0, ex=A[0]+Math.cos(dAng)*len, ey=A[1]+Math.sin(dAng)*len; g.globalAlpha=tri*t1; g.strokeStyle='rgba(236,90,71,.8)'; g.setLineDash([6,5]); g.lineWidth=2; g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(ex,ey); g.stroke(); g.setLineDash([]);
      const px=lerp(A[0],ex,k), py=lerp(A[1],ey,k); plane(g,px,py,TRK,'#fff',1.2*fs); pill(g,L({en:'heading 090°: drifts right',no:'kurs 090°: driver til høyre'}),ex,ey+18,{size:10.5*fs,col:'#FF8A78',al:'right',fit:W}); g.globalAlpha=tri; }
    // step 2+: crabbed, on track
    const t2=at(p,1,.6);
    if(t2>0.01){ g.globalAlpha=tri*t2; const px=lerp(A[0],B[0],k), py=A[1]; plane(g,px,py,HDG,'#fff',1.3*fs);
      g.strokeStyle='rgba(255,255,255,.55)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(px,py); g.lineTo(px+Math.sin(HDG*d2r)*70,py-Math.cos(HDG*d2r)*70); g.stroke(); g.setLineDash([]);
      txt(g,`HDG ${String(Math.round(HDG)).padStart(3,'0')}°`,px+Math.sin(HDG*d2r)*76,py-Math.cos(HDG*d2r)*76-4,{mono:1,size:11*fs,col:'#fff',al:'center'});
      pill(g,`WCA ${nf(WCA,0)}° ${L({en:"left",no:"venstre"})}`,px+20,py+30,{mono:1,size:10.5*fs,col:C.amber,fit:W});
      g.globalAlpha=tri; }
    // step 3+: the triangle
    const t3=at(p,2,.8);
    if(t3>0.01){ g.globalAlpha=tri*t3; const S=(sm?1.05:1.5)*fs, o=[W*(sm?.12:.08),H*(sm?.84:.86)];
      const h=[o[0]+TAS*Math.sin(HDG*d2r)*S, o[1]-TAS*Math.cos(HDG*d2r)*S], w=[h[0]+wx*S, h[1]+wy*S];
      rr(g,o[0]-16,Math.min(h[1],o[1])-44,Math.max(h[0],w[0])-o[0]+40,Math.abs(o[1]-Math.min(h[1],o[1]))+70,10); g.fillStyle='rgba(10,15,20,.82)'; g.fill(); g.strokeStyle='rgba(255,255,255,.1)'; g.stroke();
      arrow(g,o[0],o[1],h[0],h[1],'#fff',{lw:3,head:11}); arrow(g,h[0],h[1],w[0],w[1],C.blue,{lw:3,head:11}); arrow(g,o[0],o[1],w[0],w[1],C.mag,{lw:3.2,head:12});
      pill(g,`HDG/TAS ${String(Math.round(HDG)).padStart(3,'0')}°/${TAS}`,(o[0]+h[0])/2-8,Math.min(o[1],h[1])-24,{mono:1,size:10*fs,col:'#fff',al:'center'});
      pill(g,`W/V ${String(WD).padStart(3,'0')}/${WS}`,Math.max(h[0],w[0])+8,(h[1]+w[1])/2,{mono:1,size:10*fs,col:'#9FD4F2'});
      pill(g,`TR/GS 090°/${nf(GS,0)}`,(o[0]+w[0])/2,o[1]+14,{mono:1,size:10*fs,col:'#F29AC8',al:'center'});
      g.globalAlpha=tri; }
    // step 4: numbers card
    const t4=at(p,3,.7);
    if(t4>0.01&&!sm){ g.globalAlpha=tri*t4; const x=W*.6, y=H*.66; rr(g,x,y,W*.36,H*.28,8); g.fillStyle='rgba(10,15,20,.85)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
      const ln=[[L({en:'angle wind–track',no:'vinkel vind–spor'}),`${Math.abs(WD-TRK)}°`],[L({en:'crosswind',no:'sidevind'}),`${WS} × sin ${Math.abs(WD-TRK)}° ≈ ${nf(xw,0)} kt`],['WCA',`${nf(xw,0)} ÷ ${TAS/60} ≈ ${nf(WCA,0)}°`],[L({en:'headwind',no:'motvind'}),`${WS} × cos ${Math.abs(WD-TRK)}° ≈ ${nf(WS*Math.cos((WD-TRK)*d2r),0)} kt`],['GS',`≈ ${nf(GS,0)} kt`]];
      ln.forEach(([a,b],i)=>{ txt(g,a,x+14,y+26+i*22,{size:12,col:'#AEB8C1'}); txt(g,b,x+W*.36-14,y+26+i*22,{mono:1,size:12,col:i===2||i===4?C.amber:'#fff',al:'right'}); });
      g.globalAlpha=tri; }
    g.restore(); }
  if(nav>0.01){ g.save(); g.globalAlpha=nav;
    const D=60, X=d=>A[0]+tw*d/D, off=3, Y=n=>A[1]+n*(tw/D)*1.0*2.2;         // cross-track exaggerated ×2.2
    const fix=[X(30),Y(off)];
    // actual track so far (6° right)
    g.strokeStyle='rgba(236,90,71,.85)'; g.lineWidth=2.4; g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(fix[0],fix[1]); g.stroke();
    g.fillStyle='#fff'; g.beginPath(); g.arc(fix[0],fix[1],4,0,7); g.fill(); pill(g,L({en:'position fix after 30 NM',no:'posisjon etter 30 NM'}),fix[0],fix[1]+20,{size:10.5*fs,col:'#fff',al:'center'});
    g.strokeStyle='rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(fix[0],A[1]); g.lineTo(fix[0],fix[1]); g.stroke(); txt(g,'3 NM',fix[0]+6,(A[1]+fix[1])/2+4,{mono:1,size:10.5*fs,col:'#fff'});
    // TE angle arc
    g.strokeStyle=C.amber; g.lineWidth=1.5; g.beginPath(); g.arc(A[0],A[1],tw*.18,0,Math.atan2(fix[1]-A[1],fix[0]-A[0])); g.stroke(); pill(g,`TE 6°`,A[0]+tw*.2,A[1]+14,{mono:1,size:10.5*fs,col:C.amber});
    const c=at(p,5,.8);
    // parallel and closing
    if(c>0.01){ g.globalAlpha=nav*c; g.strokeStyle='rgba(127,198,238,.5)'; g.setLineDash([5,5]); g.beginPath(); g.moveTo(fix[0],fix[1]); g.lineTo(X(60),fix[1]); g.stroke(); g.setLineDash([]);
      txt(g,L({en:'parallel: 6° left',no:'parallelt: 6° venstre'}),X(52),fix[1]+16,{size:10.5*fs,col:'#9FD4F2',al:'center'});
      g.strokeStyle=C.green; g.lineWidth=2.6; g.beginPath(); g.moveTo(fix[0],fix[1]); g.lineTo(fix[0]+(B[0]-fix[0])*ease(c),fix[1]+(B[1]-fix[1])*ease(c)); g.stroke();
      g.strokeStyle=C.green; g.lineWidth=1.5; g.beginPath(); g.arc(fix[0],fix[1],tw*.14,Math.atan2(B[1]-fix[1],B[0]-fix[0]),0); g.stroke();
      pill(g,L({en:'+ closing 6° = 12° left',no:'+ lukke 6° = 12° venstre'}),X(46),Y(1.2),{size:10.5*fs,col:C.green,al:'center',fit:W});
      g.globalAlpha=nav; }
    // rule card
    const x=sm?W*.06:W*.7, y=sm?H*.64:H*.56; rr(g,x,y,sm?W*.88:W*.27,sm?H*.28:H*.36,8); g.fillStyle='rgba(10,15,20,.85)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
    txt(g,'1 IN 60',x+12,y+20,{mono:1,size:10*fs,col:'#8E99A4'});
    txt(g,'TE = off × 60 ÷ gone',x+12,y+46,{mono:1,size:12.5*fs,col:'#fff'}); txt(g,'   = 3 × 60 ÷ 30 = 6°',x+12,y+66,{mono:1,size:12.5*fs,col:C.amber});
    txt(g,'CA = off × 60 ÷ to go',x+12,y+94,{mono:1,size:12.5*fs,col:'#fff'}); txt(g,'   = 3 × 60 ÷ 30 = 6°',x+12,y+114,{mono:1,size:12.5*fs,col:C.green});
    g.restore(); }
  txt(g,L({en:'not to scale',no:'ikke i skala'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.15,dwell:6.5,
    title:{en:'The wind triangle and the 1 in 60 rule',no:'Vindtrekanten og 1 av 60-regelen'},
    sub:{en:'Why you point the nose somewhere else than you want to go, and how to fix it when you drift off anyway.',no:'Hvorfor du peker nesen et annet sted enn dit du skal, og hvordan du retter opp når du likevel driver av.'},
    label:{en:'Animated plan view of an aircraft drifting off track in a crosswind, then crabbing to stay on it, the triangle of velocities and a 1 in 60 track correction.',no:'Animert planbilde av et fly som driver av sporet i sidevind, deretter holder opp mot vinden, hastighetstrekanten og en 1 av 60-korreksjon.'},
    foot:{en:'Example: track 090°, TAS 120 kt, wind 030°/30 kt. Cross-track distances drawn ×2 in the 1 in 60 part.',no:'Eksempel: spor 090°, TAS 120 kt, vind 030°/30 kt. Sideavvik tegnet ×2 i 1 av 60-delen.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
