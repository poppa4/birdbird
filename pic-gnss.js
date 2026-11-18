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

function sat(g,x,y,col){ g.save(); g.translate(x,y); g.fillStyle=col||'#E2E8EE'; g.fillRect(-4,-4,8,8); g.fillStyle='rgba(127,198,238,.85)'; g.fillRect(-16,-2.5,10,5); g.fillRect(6,-2.5,10,5); g.restore(); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const geo=1-at(p,4,.8);
  if(geo>0.01){ g.save(); g.globalAlpha=geo;
    const me=[W*(sm?.5:.4),H*(sm?.62:.6)];
    const good=[[me[0]-W*(sm?.36:.26),H*.12],[me[0]+W*(sm?.34:.28),H*.16],[me[0]+W*.02,H*.06],[me[0]-W*.04,H*(sm?.98:.98)]];
    const bad=[[me[0]-W*.05,H*.08],[me[0]+W*.03,H*.07],[me[0]+W*.1,H*.1],[me[0]-W*.12,H*.11]];
    const gk=at(p,2,.7);
    const S=good.map((q,i)=>i<3?[lerp(q[0],bad[i][0],0),q[1]]:q);
    const nShow=p<1?1:p<2?3:3;
    // ground / earth arc
    g.fillStyle='rgba(27,42,34,.6)'; g.beginPath(); g.ellipse(me[0],H*1.55,W*.9,H*.8,0,Math.PI,0); g.fill();
    // circles
    const show=(sats,a,band)=>{ sats.forEach((q,i)=>{ if(i>=nShow) return; const r=Math.hypot(q[0]-me[0],q[1]-me[1]); sat(g,q[0],q[1]);
      g.save(); g.globalAlpha*=a; if(band){ g.strokeStyle='rgba(127,198,238,.2)'; g.lineWidth=band; g.beginPath(); g.arc(q[0],q[1],r,0,7); g.stroke(); }
      g.strokeStyle=i===0&&p<1?C.amber:'rgba(127,198,238,.75)'; g.lineWidth=1.6; g.beginPath(); g.arc(q[0],q[1],r*(p<1&&i===0?ease(clamp((tm*.35)%1.4,0,1)):1),0,7); g.stroke(); g.restore();
      if(p<1&&i===0){ g.setLineDash([3,4]); g.strokeStyle='rgba(240,180,64,.7)'; g.beginPath(); g.moveTo(q[0],q[1]); g.lineTo(me[0],me[1]); g.stroke(); g.setLineDash([]); pill(g,L({en:'range = time × c',no:'avstand = tid × c'}),(q[0]+me[0])/2-10,(q[1]+me[1])/2,{size:10.5*fs,col:C.amber,al:'right',fit:W}); } }); };
    show(good,1-gk*.9,0);
    if(gk>0.02){ g.save(); g.globalAlpha*=gk*(1-at(p,3,.6));
      // two panels: two range bands crossing at a wide angle (spread) and at a narrow angle (bunched)
      const pw=sm?W*.44:W*.3, ph=H*.46, py=H*.3, pxs=[W*(sm?.04:.2),W*(sm?.52:.54)];
      [[70,'rgb(113,204,147)',L({en:'satellites spread: small error',no:'satellittene spredt: liten feil'})],[14,'rgb(240,180,64)',L({en:'bunched: long error (high DOP)',no:'samlet: lang feil (høy DOP)'})]].forEach(([ang,col,lab],k)=>{
        const x=pxs[k], cx=x+pw/2, cy=py+ph/2; rr(g,x,py,pw,ph,8); g.fillStyle='rgba(10,15,20,.9)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
        g.save(); g.beginPath(); g.rect(x,py,pw,ph); g.clip(); const bw=ph*.09;
        [-ang/2,ang/2].forEach(a=>{ g.save(); g.translate(cx,cy); g.rotate(a*Math.PI/180); g.fillStyle='rgba(127,198,238,.22)'; g.fillRect(-pw,-bw/2,pw*2,bw); g.strokeStyle='rgba(127,198,238,.8)'; g.lineWidth=1.4; g.beginPath(); g.moveTo(-pw,0); g.lineTo(pw,0); g.stroke(); g.restore(); });
        // overlap (the error box) as a rhombus
        const a1=-ang/2*Math.PI/180, a2=ang/2*Math.PI/180, d=bw/2/Math.sin(Math.abs(a2-a1));
        const v=(sa,sb)=>[cx+sa*d*Math.cos(a2)+sb*d*Math.cos(a1),cy+sa*d*Math.sin(a2)+sb*d*Math.sin(a1)];
        const pts=[v(1,1),v(1,-1),v(-1,-1),v(-1,1)]; g.fillStyle=col.replace('rgb','rgba').replace(')',',.55)'); g.strokeStyle=col; g.lineWidth=2; g.beginPath(); pts.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])); g.closePath(); g.fill(); g.stroke();
        g.restore(); pill(g,lab,cx,py+ph+18,{size:10.5*fs,col,al:'center',fit:W}); });
      g.restore(); }
    // the fix
    if(p>=1.4&&(p<2||p>=3.4)){ g.fillStyle='#fff'; g.beginPath(); g.arc(me[0],me[1],5,0,7); g.fill(); g.strokeStyle=C.mag; g.lineWidth=2; g.beginPath(); g.arc(me[0],me[1],10+2*Math.sin(tm*3),0,7); g.stroke(); }
    if(p>=1.2&&p<1.8) pill(g,L({en:'+ 1 more for the clock = 4 for a 3D fix',no:'+ 1 til for klokken = 4 for 3D-posisjon'}),W*(sm?.5:.4),H*.92,{size:11*fs,col:'#fff',al:'center',fit:W});
    // RAIM / SBAS
    const rm=at(p,3,.7);
    if(rm>0.01){ g.save(); g.globalAlpha*=rm; sat(g,me[0]+W*(sm?.3:.22),H*.4,'#E2E8EE'); txt(g,L({en:'5th: RAIM check',no:'5.: RAIM-sjekk'}),me[0]+W*(sm?.3:.22),H*.4-14,{size:10.5*fs,col:'#fff',al:'center'});
      const gx=W*(sm?.12:.08), gyy=H*.2; g.fillStyle='#B9A3F2'; g.fillRect(gx-6,gyy-6,12,12); g.fillStyle='rgba(185,163,242,.6)'; g.fillRect(gx-22,gyy-3,14,6); g.fillRect(gx+8,gyy-3,14,6);
      for(let k=0;k<4;k++){ const ph=((tm*.6+k/4)%1); g.strokeStyle=`rgba(185,163,242,${.6*(1-ph)})`; g.beginPath(); g.moveTo(lerp(gx,me[0],ph),lerp(gyy,me[1],ph)); g.lineTo(lerp(gx,me[0],ph+.04),lerp(gyy,me[1],ph+.04)); g.lineWidth=3; g.stroke(); }
      pill(g,'SBAS / EGNOS',gx,gyy+22,{mono:1,size:10.5*fs,col:'#B9A3F2',al:'center'}); g.restore(); }
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
  txt(g,L({en:'schematic · illustrative minima',no:'skjematisk · illustrerende minima'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
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
