/* NORDAP – pic-gnss.js: "How GNSS finds you, and how far you can trust it" for gnss.html (uses corepic.js).
   Range circles from satellites (trilateration), the clock as the fourth unknown, geometry (DOP), RAIM and SBAS,
   then the RNP containment and the approach minima LNAV, LNAV/VNAV and LPV. Illustrative. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'Distance from one satellite',no:'Avstand fra én satellitt'},
  d:{en:'Each satellite sends its position and the exact time. The receiver measures how long the signal took: × speed of light = <em>range</em>. You are somewhere on a sphere around that satellite.',
     no:'Hver satellitt sender posisjonen sin og nøyaktig tid. Mottakeren måler hvor lang tid signalet brukte: × lysfarten = <em>avstand</em>. Du er et sted på en kule rundt satellitten.'}},
 {t:{en:'Where the circles cross',no:'Der sirklene krysser'},
  d:{en:'Two ranges cross in two places, three narrow it to one point. In 3D you need three for position — and a <em>fourth</em> to solve the receiver\'s cheap clock. So: <em>4 satellites for a 3D fix</em>.',
     no:'To avstander krysser på to steder, tre snevrer det inn til ett punkt. I 3D trenger du tre for posisjonen — og en <em>fjerde</em> for å løse mottakerens enkle klokke. Altså: <em>4 satellitter for en 3D-posisjon</em>.'}},
 {t:{en:'Geometry matters',no:'Geometrien teller'},
  d:{en:'Every range has an error band. Satellites spread across the sky cross at <em>sharp angles</em>: a small error box. Bunched together, the bands cross at shallow angles: a long, poor box (high DOP).',
     no:'Hver avstand har et feilbånd. Satellitter spredt over himmelen krysser i <em>skarpe vinkler</em>: en liten feilboks. Samlet på ett sted krysser båndene i slake vinkler: en lang, dårlig boks (høy DOP).'}},
 {t:{en:'RAIM and SBAS · can I trust it?',no:'RAIM og SBAS · kan jeg stole på den?'},
  d:{en:'With a <em>5th</em> satellite the receiver can check itself and warn you (<em>RAIM</em>); with a 6th it can throw out the bad one (FDE). <em>SBAS</em> (EGNOS in Europe) sends corrections and integrity from geostationary satellites.',
     no:'Med en <em>5.</em> satellitt kan mottakeren sjekke seg selv og varsle deg (<em>RAIM</em>); med en 6. kan den kaste ut den dårlige (FDE). <em>SBAS</em> (EGNOS i Europa) sender korreksjoner og integritet fra geostasjonære satellitter.'}},
 {t:{en:'RNP · a tunnel you must stay in',no:'RNP · en tunnel du må holde deg i'},
  d:{en:'RNP 1 means: stay within <em>1 NM of the path 95 % of the time</em>, with on-board monitoring and alerting. RNP 0.3 on final approach. RNAV has the accuracy, RNP adds the alert.',
     no:'RNP 1 betyr: hold deg innenfor <em>1 NM fra banen 95 % av tiden</em>, med overvåking og varsling om bord. RNP 0,3 på sluttinnflyging. RNAV har nøyaktigheten, RNP legger til varslingen.'}},
 {t:{en:'Three minima on one chart',no:'Tre minima på ett kart'},
  d:{en:'<em>LNAV</em>: lateral only, an MDA. <em>LNAV/VNAV</em>: with a vertical path (baro-VNAV), a DA. <em>LPV</em>: SBAS vertical guidance like an ILS, the lowest DA — often 200–250 ft.',
     no:'<em>LNAV</em>: bare sideveis, en MDA. <em>LNAV/VNAV</em>: med vertikal bane (baro-VNAV), en DA. <em>LPV</em>: SBAS-vertikalføring som en ILS, laveste DA — ofte 200–250 ft.'},
  go:{en:'Open the GNSS and RNP lab',no:'Åpne GNSS- og RNP-labben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function sat(g,x,y,col,o){ o=o||{}; g.save(); g.translate(x,y); if(o.rot) g.rotate(o.rot); const k=o.k||1;
  // solar panels with cell lines, gold body, antenna
  g.fillStyle='rgba(60,110,170,.95)'; g.strokeStyle='rgba(160,200,235,.8)'; g.lineWidth=.8;
  [-1,1].forEach(d=>{ g.fillRect(d<0?-24*k:7*k,-4*k,17*k,8*k); g.strokeRect(d<0?-24*k:7*k,-4*k,17*k,8*k); for(let c=1;c<4;c++){ const xx=(d<0?-24*k:7*k)+c*4.25*k; g.beginPath(); g.moveTo(xx,-4*k); g.lineTo(xx,4*k); g.stroke(); } });
  g.strokeStyle='rgba(200,210,220,.7)'; g.beginPath(); g.moveTo(-7*k,0); g.lineTo(7*k,0); g.stroke();
  g.fillStyle=col||'#D9B36A'; g.fillRect(-5*k,-5*k,10*k,10*k); g.fillStyle='rgba(255,255,255,.35)'; g.fillRect(-5*k,-5*k,10*k,3*k);
  g.strokeStyle='#E2E8EE'; g.lineWidth=1.2; g.beginPath(); g.moveTo(0,5*k); g.lineTo(0,9*k); g.stroke(); g.beginPath(); g.arc(0,10*k,2.2*k,0,Math.PI); g.stroke();
  if(o.bad){ g.strokeStyle=C.red; g.lineWidth=2.2; g.beginPath(); g.arc(0,0,15*k,0,7); g.stroke(); g.beginPath(); g.moveTo(-10*k,-10*k); g.lineTo(10*k,10*k); g.stroke(); }
  g.restore(); }

/* signal pulses travelling from a satellite to the receiver */
function pulses(g,a,b,tm,col,n){ const d=Math.hypot(b[0]-a[0],b[1]-a[1]); g.save(); g.strokeStyle=col; g.lineWidth=1; g.setLineDash([2,6]); g.globalAlpha*=.35; g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); g.setLineDash([]); g.restore();
  for(let k=0;k<(n||3);k++){ const ph=((tm*.45+k/(n||3))%1), x=a[0]+(b[0]-a[0])*ph, y=a[1]+(b[1]-a[1])*ph, ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
    g.save(); g.globalAlpha*=Math.sin(ph*Math.PI); g.strokeStyle=col; g.lineWidth=2; g.beginPath(); g.arc(x,y,7,ang-1.1,ang+1.1); g.stroke(); g.restore(); } }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const geo=1-at(p,4,.8);
  if(geo>0.01){ g.save(); g.globalAlpha=geo;
    // the Earth: a big curved limb with an atmosphere glow
    const ER=W*(sm?2.2:1.6), ecx=W*.5, ecy=H*(sm?.86:.93)+ER;
    const atm=g.createRadialGradient(ecx,ecy,ER*.995,ecx,ecy,ER*1.06); atm.addColorStop(0,'rgba(127,198,238,.35)'); atm.addColorStop(1,'rgba(127,198,238,0)'); g.fillStyle=atm; g.beginPath(); g.arc(ecx,ecy,ER*1.06,0,7); g.fill();
    const eg=g.createLinearGradient(0,ecy-ER,0,ecy-ER+H*.2); eg.addColorStop(0,'#2b4a5e'); eg.addColorStop(1,'#13222b'); g.fillStyle=eg; g.beginPath(); g.arc(ecx,ecy,ER,0,7); g.fill();
    // orbit arc
    const OR=ER+H*(sm?.6:.7); g.strokeStyle='rgba(255,255,255,.08)'; g.setLineDash([4,8]); g.beginPath(); g.arc(ecx,ecy,OR,Math.PI*1.25,Math.PI*1.75); g.stroke(); g.setLineDash([]);
    const onOrbit=a=>[ecx+OR*Math.cos(a),ecy+OR*Math.sin(a)];
    // receiver (an aircraft just above the surface)
    const me=[ecx+W*(sm?0:-.04),ecy-ER-H*.08];
    const wide=W/(ER*2.2);   // keep every satellite on the canvas
    const A=[-Math.PI/2-wide*1.05,-Math.PI/2-wide*.15,-Math.PI/2+wide*1.0,-Math.PI/2+wide*.55,-Math.PI/2-wide*.62];   // satellites along the orbit
    const S=A.map(onOrbit);
    const show=p<1?1:p<3?3:5, gk=at(p,2,.6)*(1-at(p,3,.6)), rm=at(p,3,.7);
    // range arcs: the part of each sphere near the receiver
    const ranges=k=>{ const q=S[k], r=Math.hypot(q[0]-me[0],q[1]-me[1]), a0=Math.atan2(me[1]-q[1],me[0]-q[0]);
      g.save(); g.strokeStyle='rgba(127,198,238,.85)'; g.lineWidth=2; g.shadowColor='rgba(127,198,238,.6)'; g.shadowBlur=6;
      const grow=p<1&&k===0?ease(clamp((tm*.35)%1.5,0,1)):1; g.beginPath(); g.arc(q[0],q[1],r*grow,a0-.22,a0+.22); g.stroke(); g.restore(); };
    for(let k=0;k<show;k++){ if(gk>.6&&k<3) continue; const bad=false;
      sat(g,S[k][0],S[k][1],null,{rot:A[k]+Math.PI/2,k:sm?.85:1,bad});
      if(!(gk>.3)){ pulses(g,S[k],me,tm+k*.37,bad?'rgba(236,90,71,.9)':'rgba(240,180,64,.9)',3); ranges(k); } }
    // labels
    if(p<1){ const mid=[(S[0][0]+me[0])/2,(S[0][1]+me[1])/2]; pill(g,L({en:'range = travel time × speed of light',no:'avstand = gangtid × lysfart'}),mid[0]-14,mid[1],{size:10.5*fs,col:C.amber,al:'right',fit:W}); }
    if(p>=.6&&p<2.3){ pill(g,L({en:'where the ranges cross: you',no:'der avstandene krysser: deg'}),me[0]+16,me[1]-26,{size:10.5*fs,col:'#fff',fit:W}); }
    if(p>=1.2&&p<2.2){ const cx=me[0]-W*(sm?.3:.22), cy=me[1]-H*.06; g.save(); g.strokeStyle='#fff'; g.lineWidth=1.6; g.beginPath(); g.arc(cx,cy,13,0,7); g.stroke(); const a=tm*2; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+9*Math.cos(a),cy+9*Math.sin(a)); g.stroke(); g.restore();
      pill(g,L({en:'4th satellite: solves the receiver clock',no:'4. satellitt: løser mottakerens klokke'}),cx+20,cy,{size:10.5*fs,col:'#fff',fit:W}); }
    // the receiver
    g.save(); g.translate(me[0],me[1]); g.fillStyle='#fff'; g.beginPath(); g.moveTo(12,0); g.lineTo(-6,-4); g.lineTo(-9,-11); g.lineTo(-12,-11); g.lineTo(-10,0); g.lineTo(-12,11); g.lineTo(-9,11); g.lineTo(-6,4); g.closePath(); g.fill(); g.restore();
    if(p>=1.4&&gk<.5){ g.strokeStyle=C.mag; g.lineWidth=2; g.beginPath(); g.arc(me[0],me[1],16+2*Math.sin(tm*3),0,7); g.stroke(); }
    // geometry panels
    if(gk>0.02){ g.save(); g.globalAlpha*=gk;
      const pw=sm?W*.44:W*.3, ph=H*.46, py=H*.2, pxs=[W*(sm?.04:.18),W*(sm?.52:.52)];
      [[70,'rgb(113,204,147)',L({en:'satellites spread: small error',no:'satellittene spredt: liten feil'})],[14,'rgb(240,180,64)',L({en:'bunched: long error (high DOP)',no:'samlet: lang feil (høy DOP)'})]].forEach(([ang,col,lab],k)=>{
        const x=pxs[k], cx=x+pw/2, cy=py+ph/2; rr(g,x,py,pw,ph,8); g.fillStyle='rgba(10,15,20,.92)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
        g.save(); g.beginPath(); g.rect(x,py,pw,ph); g.clip(); const bw=ph*.09;
        [-ang/2,ang/2].forEach(a=>{ g.save(); g.translate(cx,cy); g.rotate(a*Math.PI/180); g.fillStyle='rgba(127,198,238,.22)'; g.fillRect(-pw,-bw/2,pw*2,bw); g.strokeStyle='rgba(127,198,238,.8)'; g.lineWidth=1.4; g.beginPath(); g.moveTo(-pw,0); g.lineTo(pw,0); g.stroke(); g.restore(); });
        const a1=-ang/2*Math.PI/180, a2=ang/2*Math.PI/180, d=bw/2/Math.sin(Math.abs(a2-a1));
        const v=(sa,sb)=>[cx+sa*d*Math.cos(a2)+sb*d*Math.cos(a1),cy+sa*d*Math.sin(a2)+sb*d*Math.sin(a1)];
        const pts=[v(1,1),v(1,-1),v(-1,-1),v(-1,1)]; g.fillStyle=col.replace('rgb','rgba').replace(')',',.55)'); g.strokeStyle=col; g.lineWidth=2; g.beginPath(); pts.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])); g.closePath(); g.fill(); g.stroke();
        g.restore(); pill(g,lab,cx,py+ph+18,{size:10.5*fs,col,al:'center',fit:W}); });
      g.restore(); }
    // RAIM and SBAS
    if(rm>0.01){ g.save(); g.globalAlpha*=rm;
      pill(g,sm?L({en:'5 satellites: RAIM check',no:'5 satellitter: RAIM-sjekk'}):L({en:'5th satellite: RAIM checks the others; one that disagrees is thrown out',no:'5. satellitt: RAIM sjekker de andre; en som er uenig kastes ut'}),sm?W*.5:S[4][0],S[4][1]+30,{size:10.5*fs,col:'#fff',al:'center',fit:W});
      // SBAS: ground stations → master → GEO satellite → aircraft
      const gx=W*(sm?.86:.9), gy=H*.08; sat(g,gx,gy,'#B9A3F2',{k:sm?.85:1});
      const st=[[ecx+W*.18,ecy-ER-2],[ecx+W*.32,ecy-ER+H*.02],[ecx-W*.3,ecy-ER+H*.02]];
      st.forEach(q=>{ g.fillStyle='#B9A3F2'; g.beginPath(); g.moveTo(q[0],q[1]-9); g.lineTo(q[0]-5,q[1]); g.lineTo(q[0]+5,q[1]); g.closePath(); g.fill(); });
      pulses(g,st[1],[gx,gy],tm,'rgba(185,163,242,.9)',2); pulses(g,[gx,gy],me,tm+.5,'rgba(185,163,242,.9)',3);
      pill(g,L({en:'SBAS (EGNOS): corrections + integrity',no:'SBAS (EGNOS): korreksjoner + integritet'}),gx-30,gy,{size:10.5*fs,col:'#B9A3F2',al:'right',fit:W});
      txt(g,L({en:'reference stations',no:'referansestasjoner'}),st[0][0],st[0][1]+18,{size:10*fs,col:'#B9A3F2',al:'center'});
      g.restore(); }
    g.restore(); }
  // RNP tunnel and minima
  if(geo<0.99){ g.save(); g.globalAlpha=1-geo;
    const mins=at(p,5,.8);
    if(mins<0.99){ g.save(); g.globalAlpha*=1-mins;
      const x0=W*.06, x1=W*(sm?.94:.94), cy=H*.5, hw=H*.16;
      const path=x=>cy+Math.sin((x-x0)/(x1-x0)*Math.PI*1.2)*H*.12;
      g.fillStyle='rgba(113,204,147,.1)'; g.beginPath(); for(let x=x0;x<=x1;x+=6) g.lineTo(x,path(x)-hw); for(let x=x1;x>=x0;x-=6) g.lineTo(x,path(x)+hw); g.closePath(); g.fill();
      g.strokeStyle='rgba(113,204,147,.6)'; g.setLineDash([5,5]); [-1,1].forEach(sg=>{ g.beginPath(); for(let x=x0;x<=x1;x+=6) x===x0?g.moveTo(x,path(x)+sg*hw):g.lineTo(x,path(x)+sg*hw); g.stroke(); }); g.setLineDash([]);
      g.strokeStyle=C.mag; g.lineWidth=2.4; g.beginPath(); for(let x=x0;x<=x1;x+=6) x===x0?g.moveTo(x,path(x)):g.lineTo(x,path(x)); g.stroke();
      const k=(tm*.08)%1, ax=lerp(x0,x1,k), ay=path(ax)+Math.sin(tm*1.3)*hw*.35, an=Math.atan2(path(ax+3)-path(ax),3);
      g.save(); g.translate(ax,ay); g.rotate(an+Math.PI/2); g.fillStyle='#fff'; const s=1.2; g.beginPath(); g.moveTo(0,-11*s); g.lineTo(10*s,3*s); g.lineTo(0,0); g.lineTo(-10*s,3*s); g.closePath(); g.fill(); g.restore();
      pill(g,L({en:'RNP 1: within 1 NM, 95 % of the time',no:'RNP 1: innenfor 1 NM, 95 % av tiden'}),W*.5,cy-hw-H*.14,{size:11*fs,col:'#8EDDB0',al:'center',fit:W});
      pill(g,L({en:'+ on-board monitoring and alerting',no:'+ overvåking og varsling om bord'}),W*.5,cy+hw+H*.14,{size:11*fs,col:'#fff',al:'center',fit:W});
      g.restore(); }
    if(mins>0.01){ g.save(); g.globalAlpha*=mins; const rx=W*.92, gy=H*.86, X=d=>rx-d*W*(sm?.13:.1), Y=h=>gy-h*H*(sm?.0007:.00068);
      g.fillStyle='#1b2a22'; g.fillRect(0,gy,W,H-gy); g.fillStyle='#3A444C'; g.fillRect(rx-W*.06,gy-2,W*.08,4);
      g.strokeStyle='rgba(255,255,255,.7)'; g.lineWidth=2; g.beginPath(); g.moveTo(X(6.5),Y(2100)); g.lineTo(rx-W*.04,gy); g.stroke();
      const m=[[L({en:'LNAV · MDA 600 ft',no:'LNAV · MDA 600 ft'}),600,'#AEB8C1'],[L({en:'LNAV/VNAV · DA 400 ft',no:'LNAV/VNAV · DA 400 ft'}),400,C.amber],[L({en:'LPV · DA 250 ft',no:'LPV · DA 250 ft'}),250,C.green]];
      m.forEach(([lab,h,col],i)=>{ const y=Y(h); g.strokeStyle=col; g.lineWidth=2; g.setLineDash(i?[]:[6,4]); g.beginPath(); g.moveTo(W*.04,y); g.lineTo(rx-W*.06,y); g.stroke(); g.setLineDash([]); pill(g,lab,W*.05+i*W*(sm?.0:.24),y-14-(sm?i*0:0),{mono:1,size:10.5*fs,col,fit:W}); });
      if(sm){ /* stagger labels vertically on phones */ }
      txt(g,L({en:'lateral only',no:'bare sideveis'}),W*.05,Y(600)+16,{size:10*fs,col:'#AEB8C1'}); txt(g,L({en:'baro vertical path',no:'barometrisk vertikalbane'}),W*(sm?.05:.29),Y(400)+16,{size:10*fs,col:C.amber}); txt(g,L({en:'SBAS vertical, ILS-like',no:'SBAS vertikalt, som ILS'}),W*(sm?.05:.53),Y(250)+16,{size:10*fs,col:'#8EDDB0'});
      g.restore(); }
    g.restore(); }
  txt(g,L({en:'schematic · illustrative minima',no:'skjematisk · illustrerende minima'}),W-10,12,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.15,dwell:6.5,
    title:{en:'How GNSS finds you, and how far you can trust it',no:'Hvordan GNSS finner deg, og hvor mye du kan stole på den'},
    sub:{en:'Ranges to satellites cross at your position. Geometry and integrity decide how good that is, and that decides which minimum you may fly.',no:'Avstander til satellitter krysser i posisjonen din. Geometri og integritet avgjør hvor god den er, og det avgjør hvilket minimum du kan fly.'},
    label:{en:'Animated satellites with range circles crossing at the receiver, error boxes for good and poor geometry, RAIM and SBAS, an RNP tunnel and the LNAV, LNAV/VNAV and LPV minima.',no:'Animerte satellitter med avstandssirkler som krysser i mottakeren, feilbokser for god og dårlig geometri, RAIM og SBAS, en RNP-tunnel og minimaene LNAV, LNAV/VNAV og LPV.'},
    foot:{en:'Schematic, in 2D. Minima are illustrative examples; the real values are on the approach chart.',no:'Skjematisk, i 2D. Minimaene er illustrerende eksempler; de virkelige verdiene står på innflygingskartet.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
