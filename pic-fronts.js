/* NORDAP – pic-fronts.js: "Fronts in cross-section" for fronts.html (uses corepic.js).
   A side cross-section that morphs from a warm front (gentle slope, layer cloud ahead) to a cold front (steep slope, CB),
   with the weather sequence an aircraft or a station meets, then the occlusion. Slopes illustrative (warm ≈ 1:150,
   cold ≈ 1:80), vertical scale exaggerated. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT,cumulus,deck}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'A front is a boundary between air masses',no:'En front er en grense mellom luftmasser'},
  d:{en:'Warm, moist air meets cold, dense air. The cold air stays low as a wedge; the warm air is forced <em>up over it</em>. The slope of that boundary decides the weather.',
     no:'Varm, fuktig luft møter kald, tung luft. Den kalde luften blir liggende lavt som en kile; den varme luften tvinges <em>opp over den</em>. Helningen på grensen avgjør været.'}},
 {t:{en:'Warm front · a long, gentle slope',no:'Varmfront · en lang, slak skråning'},
  d:{en:'Warm air glides slowly up the cold wedge (about <em>1 : 150</em>). Cloud spreads far ahead: cirrus 500–800 km before the surface front, then cirrostratus, altostratus, and <em>nimbostratus with steady rain</em>.',
     no:'Varm luft glir sakte opp kilen (omtrent <em>1 : 150</em>). Skyene sprer seg langt foran: cirrus 500–800 km før bakkefronten, så cirrostratus, altostratus og <em>nimbostratus med jevnt regn</em>.'}},
 {t:{en:'Under the warm front',no:'Under varmfronten'},
  d:{en:'Long periods of <em>low cloud and poor visibility</em>, rain falling into the cold air below can become <em>freezing rain</em>. Pressure falls steadily; the wind <em>veers</em> as the front passes.',
     no:'Lange perioder med <em>lave skyer og dårlig sikt</em>; regn som faller ned i kald luft under kan bli <em>underkjølt regn</em>. Trykket faller jevnt; vinden <em>dreier mot høyre</em> når fronten passerer.'}},
 {t:{en:'Cold front · a steep, fast slope',no:'Kaldfront · en bratt, rask skråning'},
  d:{en:'Cold air pushes under the warm air like a plough (about <em>1 : 80</em>). The warm air is thrown up fast: <em>cumulonimbus</em>, a narrow band of heavy showers, gusts and turbulence, possibly a squall line ahead.',
     no:'Kald luft presser seg inn under den varme som en plog (omtrent <em>1 : 80</em>). Den varme luften kastes raskt opp: <em>cumulonimbus</em>, et smalt belte med kraftige byger, kast og turbulens, kanskje en bygelinje foran.'}},
 {t:{en:'After the cold front',no:'Etter kaldfronten'},
  d:{en:'Sharp veer of the wind, pressure starts to rise, temperature and dew point drop. Then <em>good visibility in cold, unstable air</em> with scattered cumulus and showers.',
     no:'Brå vinddreining mot høyre, trykket begynner å stige, temperatur og duggpunkt faller. Så <em>god sikt i kald, ustabil luft</em> med spredte cumulus og byger.'}},
 {t:{en:'Occlusion · the cold front catches up',no:'Okklusjon · kaldfronten tar igjen'},
  d:{en:'The faster cold front catches the warm front and lifts the warm sector off the ground. Weather of both kinds is mixed together, often with <em>embedded CBs</em> hidden in layer cloud.',
     no:'Den raskere kaldfronten tar igjen varmfronten og løfter den varme sektoren opp fra bakken. Været fra begge blandes, ofte med <em>innleirede CB-er</em> skjult i lagskyer.'},
  go:{en:'Fly through a front in the lab',no:'Fly gjennom en front i labben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function _blob(g,x,y,r,a,dark){ const gr=g.createRadialGradient(x-r*.3,y-r*.35,r*.1,x,y,r); gr.addColorStop(0,`rgba(${dark?'200,208,216':'240,244,247'},${a})`); gr.addColorStop(1,`rgba(${dark?'110,122,134':'170,182,194'},${a*.85})`); g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }

function rain(g,x0,x1,y0,y1,tm,n,col,sp,len){ for(let k=0;k<n;k++){ const ph=((tm*sp+k*.618)%1), x=x0+((k*37.3)%1000)/1000*(x1-x0), y=lerp(y0,y1,ph); g.strokeStyle=col; g.lineWidth=1.1; g.beginPath(); g.moveTo(x,y); g.lineTo(x-len*.25,y+len); g.stroke(); } }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const gy=H*(sm?.86:.8), top=H*.06, X0=0, X1=W;
  const cold=at(p,3,.9), occ=at(p,5,.9), warm=1-cold;
  const sky=g.createLinearGradient(0,top,0,gy); sky.addColorStop(0,'#131d27'); sky.addColorStop(1,'#2a3b50'); g.fillStyle=sky; g.fillRect(0,0,W,gy);
  const gr0=g.createLinearGradient(0,gy,0,H); gr0.addColorStop(0,'#203226'); gr0.addColorStop(1,'#111a14'); g.fillStyle=gr0; g.fillRect(0,gy,W,H-gy);
  // ---------- warm front ----------
  if(warm*(1-occ)>0.01){ g.save(); g.globalAlpha=warm*(1-occ);
    const fx=W*(sm?.22:.2), L0=X1-fx, hT=gy-top-20, sl=x=>x<fx?0:Math.min(hT,(x-fx)/L0*hT*.78);   // frontal surface height
    // cold wedge
    const cw=g.createLinearGradient(0,top,0,gy); cw.addColorStop(0,'rgba(127,198,238,.06)'); cw.addColorStop(1,'rgba(127,198,238,.2)'); g.fillStyle=cw;
    g.beginPath(); g.moveTo(fx,gy); for(let x=fx;x<=X1;x+=8) g.lineTo(x,gy-sl(x)); g.lineTo(X1,gy); g.closePath(); g.fill();
    // cloud deck along the surface: thick nimbostratus near the front, thinning up the slope
    const thick=x=>{ const u=(x-fx)/L0; return (u<0?0:u<.2?lerp(90,70,u/.2)*(sm?.7:1):u<.45?lerp(70,26,(u-.2)/.25)*(sm?.7:1):u<.7?lerp(26,10,(u-.45)/.25):lerp(10,4,(u-.7)/.3))*clamp(u/.04,0,1); };
    deck(g,fx+4,X1,x=>gy-sl(x)-2,x=>gy-sl(x)-2-thick(x),{alpha:.95,billow:16,dark:'96,108,122',light:'214,222,229'});
    // cirrus wisps far ahead
    for(let x=fx+L0*.72;x<X1;x+=22){ const y=gy-sl(x)-10; g.strokeStyle='rgba(240,244,247,.6)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(x,y); g.bezierCurveTo(x+8,y-10,x+18,y-12,x+24,y-6); g.stroke(); }
    // frontal surface line with warm-front symbols (semicircles on the ground)
    g.strokeStyle=C.red; g.lineWidth=2.4; g.beginPath(); for(let x=fx;x<=X1;x+=8) x===fx?g.moveTo(x,gy-sl(x)):g.lineTo(x,gy-sl(x)); g.stroke();
    for(let k=0;k<4;k++){ const x=fx+10+k*20; g.fillStyle=C.red; g.beginPath(); g.arc(x,gy,6,Math.PI,0); g.fill(); }
    // warm air gliding up the slope
    for(let k=0;k<5;k++){ const ph=((tm*.12+k/5)%1), x=lerp(fx-W*.15,X1-W*.06,ph), y=gy-sl(x)-thick(x)*.4-26; g.save(); g.globalAlpha*=Math.sin(ph*Math.PI); arrow(g,x-30,y+(x>fx?30*hT*.78/L0:0),x,y,'#FF8A78',{lw:2.2,head:8}); g.restore(); }
    // steady rain under the thick part
    rain(g,fx+4,fx+L0*.3,gy-sl(fx+L0*.15),gy,tm,46,'rgba(127,198,238,.5)',1.1,9);
    // cloud labels
    const lab=(u,t,dy)=>{ const x=fx+L0*u; pill(g,t,x,gy-sl(x)-thick(x)-(dy||14),{mono:1,size:10.5*fs,col:'#fff',al:'center'}); };
    lab(.09,'Ns'); lab(.32,'As'); lab(.55,'Cs'); lab(.84,'Ci',18);
    pill(g,L({en:'WARM AIR',no:'VARM LUFT'}),W*.12,top+40,{mono:1,size:11*fs,col:'#FF8A78',al:'center'});
    pill(g,L({en:'COLD AIR',no:'KALD LUFT'}),X1-W*.1,gy-18,{mono:1,size:11*fs,col:'#9FD4F2',al:'center'});
    txt(g,'≈ 1 : 150',fx+L0*.62,gy-sl(fx+L0*.62)+20,{mono:1,size:11*fs,col:'#FF8A78'});
    txt(g,L({en:'← cloud spreads 500–800 km ahead of the surface front',no:'← skyene sprer seg 500–800 km foran bakkefronten'}),X1-8,top+14,{mono:1,size:10*fs,col:'#AEB8C1',al:'right'});
    const fr=at(p,2,.7); if(fr>0){ g.globalAlpha=warm*(1-occ)*fr; pill(g,L({en:'freezing rain into the cold air',no:'underkjølt regn ned i kald luft'}),fx+L0*.17,gy-14,{size:10.5*fs,col:'#9FD4F2',al:'center',fit:W}); pill(g,L({en:'low cloud · poor visibility',no:'lave skyer · dårlig sikt'}),fx+L0*.17,gy-40,{size:10.5*fs,col:'#fff',al:'center',fit:W}); }
    g.restore(); }
  // ---------- cold front ----------
  if(cold*(1-occ)>0.01){ g.save(); g.globalAlpha=cold*(1-occ);
    const fx=W*(sm?.6:.56), back=W*(sm?.2:.17), hT=gy-top;
    const sl=x=>x>fx?0:Math.min(hT*.7,Math.pow((fx-x)/back,.7)*hT*.42);
    const cw=g.createLinearGradient(0,top,0,gy); cw.addColorStop(0,'rgba(127,198,238,.08)'); cw.addColorStop(1,'rgba(127,198,238,.22)'); g.fillStyle=cw;
    g.beginPath(); g.moveTo(X0,gy); for(let x=X0;x<=fx;x+=6) g.lineTo(x,gy-sl(x)); g.lineTo(fx,gy); g.closePath(); g.fill();
    g.strokeStyle=C.blue; g.lineWidth=2.6; g.beginPath(); for(let x=X0;x<=fx;x+=6) x===X0?g.moveTo(x,gy-sl(x)):g.lineTo(x,gy-sl(x)); g.stroke();
    for(let k=0;k<4;k++){ const x=fx-12-k*20; g.fillStyle=C.blue; g.beginPath(); g.moveTo(x-6,gy); g.lineTo(x+6,gy); g.lineTo(x,gy-10); g.closePath(); g.fill(); }
    // the CB right on the front
    const cbx=fx-W*.02, cbw=W*(sm?.2:.13);
    cumulus(g,cbx,gy-H*.12,top+H*.1,cbw,{dark:1,anvil:W*(sm?.26:.2),seed:3});
    rain(g,cbx-cbw*.45,cbx+cbw*.35,gy-H*.12,gy,tm,60,'rgba(127,198,238,.75)',1.9,12);
    pill(g,'CB',cbx,top+H*.2,{mono:1,size:12*fs,col:'#fff',al:'center'});
    // gust front
    for(let k=0;k<3;k++){ const ph=((tm*.55+k/3)%1); g.save(); g.globalAlpha*=Math.sin(ph*Math.PI); arrow(g,fx+ph*W*.14-30,gy-8,fx+ph*W*.14,gy-8,C.amber,{lw:2.4,head:8}); g.restore(); }
    pill(g,L({en:'gusts · turbulence · heavy showers',no:'kast · turbulens · kraftige byger'}),fx+W*.16,gy-30,{size:10.5*fs,col:C.amber,al:'center',fit:W});
    // warm air thrown up ahead of the front
    for(let k=0;k<3;k++){ const ph=((tm*.35+k/3)%1); const x=fx+W*.06-ph*W*.05, y=gy-30-ph*hT*.55; g.save(); g.globalAlpha*=Math.sin(ph*Math.PI); arrow(g,x+12,y+30,x,y,'#FF8A78',{lw:2.2,head:8}); g.restore(); }
    txt(g,'≈ 1 : 80',fx-back*.75,gy-sl(fx-back*.75)-10,{mono:1,size:11*fs,col:'#9FD4F2',al:'right'});
    pill(g,L({en:'COLD AIR',no:'KALD LUFT'}),W*.1,gy-18,{mono:1,size:11*fs,col:'#9FD4F2',al:'center'});
    pill(g,L({en:'WARM AIR',no:'VARM LUFT'}),X1-W*.12,top+40,{mono:1,size:11*fs,col:'#FF8A78',al:'center'});
    const af=at(p,4,.7); if(af>0){ g.save(); g.globalAlpha*=af; [[.08,.12],[.22,.16],[.34,.11]].forEach(([u,hh],i)=>cumulus(g,W*u,gy-H*.36+i*6,gy-H*.36-H*hh,W*(sm?.1:.06),{seed:i+7}));
      pill(g,L({en:'behind: cold, unstable · good visibility · showers',no:'bak: kald, ustabil · god sikt · byger'}),W*.22,top+H*.18,{size:10.5*fs,col:'#fff',al:'center',fit:W}); g.restore(); }
    g.restore(); }
  // ---------- occlusion ----------
  if(occ>0.01){ g.save(); g.globalAlpha=occ; const cx=W*.5, hT=gy-top;
    const ap=[cx,gy-hT*.42];                                                      // apex of the lifted warm sector
    // cold (left) and cool (right) air
    g.fillStyle='rgba(127,198,238,.2)'; g.beginPath(); g.moveTo(0,gy); g.lineTo(0,top+20); g.lineTo(cx-W*.3,top+20); g.lineTo(ap[0],ap[1]); g.lineTo(cx,gy); g.closePath(); g.fill();
    g.fillStyle='rgba(127,198,238,.11)'; g.beginPath(); g.moveTo(W,gy); g.lineTo(W,top+20); g.lineTo(cx+W*.42,top+20); g.lineTo(ap[0],ap[1]); g.lineTo(cx,gy); g.closePath(); g.fill();
    // lifted warm sector
    g.fillStyle='rgba(236,90,71,.16)'; g.beginPath(); g.moveTo(cx-W*.3,top+20); g.lineTo(ap[0],ap[1]); g.lineTo(cx+W*.42,top+20); g.closePath(); g.fill();
    g.strokeStyle=C.violet; g.lineWidth=2.6; g.beginPath(); g.moveTo(cx-W*.3,top+20); g.lineTo(ap[0],ap[1]); g.lineTo(cx+W*.42,top+20); g.moveTo(ap[0],ap[1]); g.lineTo(ap[0],gy); g.stroke();
    // layer cloud in the lifted warm air with an embedded CB
    deck(g,cx-W*.22,cx+W*.34,x=>{ const u=Math.abs(x-cx)/(x<cx?W*.3:W*.42); return lerp(ap[1],top+20,u)-4; },x=>{ const u=Math.abs(x-cx)/(x<cx?W*.3:W*.42); return lerp(ap[1],top+20,u)-4-lerp(46,14,u); },{alpha:.9,billow:12,dark:'96,108,122'});
    cumulus(g,cx+W*.07,ap[1]+10,top+H*.08,W*(sm?.14:.09),{dark:1,seed:11});
    rain(g,cx-W*.12,cx+W*.16,ap[1],gy,tm,40,'rgba(127,198,238,.55)',1.3,10);
    pill(g,L({en:'warm air lifted off the ground',no:'varm luft løftet fra bakken'}),cx-W*.12,top+28,{size:10.5*fs,col:'#FF8A78',al:'center',fit:W});
    pill(g,L({en:'embedded CB',no:'innleiret CB'}),cx+W*.07,top+H*.06,{size:10.5*fs,col:'#fff',al:'center',fit:W});
    pill(g,L({en:'cold',no:'kald'}),W*.1,gy-18,{mono:1,size:11*fs,col:'#9FD4F2',al:'center'}); pill(g,L({en:'cool',no:'kjølig'}),W*.9,gy-18,{mono:1,size:11*fs,col:'#9FD4F2',al:'center'});
    for(let k=0;k<3;k++){ const x=ap[0]-24+k*24; g.fillStyle=C.violet; g.beginPath(); g.arc(x,gy,5,Math.PI,0); g.fill(); g.beginPath(); g.moveTo(x+6,gy); g.lineTo(x+18,gy); g.lineTo(x+12,gy-9); g.closePath(); g.fill(); }
    g.restore(); }
  // station chips
  const ch=p<3?[L({en:'pressure falling',no:'trykket faller'}),L({en:'wind veers at the front',no:'vinden dreier høyre ved fronten'}),L({en:'warmer behind it',no:'varmere bak den'})]
          :p<5?[L({en:'pressure rises behind',no:'trykket stiger bak'}),L({en:'sharp veer',no:'brå dreining mot høyre'}),L({en:'temperature and dew point fall',no:'temperatur og duggpunkt faller'})]:null;
  if(ch&&!sm){ ch.forEach((t,i)=>pill(g,t,W*.03+i*W*.31,gy+(H-gy)/2,{size:10.5*fs,col:'#C9D2DA',bg:'rgba(10,15,20,.75)'})); }
  txt(g,L({en:'cross-section · heights ×100',no:'tverrsnitt · høyder ×100'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.2,aspectSm:1/1.0,dwell:6.5,
    title:{en:'Fronts in cross-section: warm, cold and occluded',no:'Fronter i tverrsnitt: varm, kald og okkludert'},
    sub:{en:'The slope of the boundary decides the weather. Gentle and slow means layer cloud and steady rain; steep and fast means CBs.',no:'Helningen på grensen avgjør været. Slak og langsom gir lagskyer og jevnt regn; bratt og rask gir CB-er.'},
    label:{en:'Animated cross-section of a warm front with layer cloud and rain, a cold front with a cumulonimbus and gusts, and an occlusion with the warm air lifted.',no:'Animert tverrsnitt av en varmfront med lagskyer og regn, en kaldfront med cumulonimbus og vindkast, og en okklusjon med den varme luften løftet.'},
    foot:{en:'Illustrative slopes: warm front about 1 : 150, cold front about 1 : 80. Heights exaggerated about 100 times.',no:'Illustrerende helninger: varmfront omtrent 1 : 150, kaldfront omtrent 1 : 80. Høyder overdrevet omtrent 100 ganger.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
