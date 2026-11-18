/* NORDAP – pic-ice.js: "Where ice forms, and what it does to the wing" for hazards.html (uses corepic.js).
   A temperature–height column with the 0 °C level and the −20 °C level, cloud types and the icing risk band; then rime,
   mixed and clear ice on a wing section; then freezing rain under a warm layer; then the lift curve with ice
   (CLmax lower, stall at a lower angle). Illustrative values. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT,cumulus,deck}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'Ice needs liquid water below 0 °C',no:'Is trenger flytende vann under 0 °C'},
  d:{en:'Cloud droplets stay liquid well below freezing: <em>supercooled water</em>. They freeze the moment they hit the aircraft. The risk is greatest from <em>0 °C down to about −20 °C</em>; below −40 °C there is almost only ice crystals.',
     no:'Skydråper forblir flytende godt under frysepunktet: <em>underkjølt vann</em>. De fryser i det øyeblikket de treffer flyet. Risikoen er størst fra <em>0 °C ned til omtrent −20 °C</em>; under −40 °C er det nesten bare iskrystaller.'}},
 {t:{en:'Small drops · rime',no:'Små dråper · rimis'},
  d:{en:'In layer cloud with small drops and cold temperatures, drops freeze <em>instantly</em> where they hit, trapping air: white, brittle, rough <em>rime</em> on the leading edge. Easy to remove, but it ruins the shape.',
     no:'I lagskyer med små dråper og lave temperaturer fryser dråpene <em>umiddelbart</em> der de treffer og fanger luft: hvit, sprø, ru <em>rimis</em> på forkanten. Lett å fjerne, men den ødelegger formen.'}},
 {t:{en:'Big drops · clear ice',no:'Store dråper · klaris'},
  d:{en:'In cumulus near 0 °C, large drops <em>flow back</em> before they freeze: clear, hard, heavy <em>glaze</em> that spreads aft of the protected area and can form <em>horns</em>. The most dangerous kind.',
     no:'I cumulus nær 0 °C <em>renner</em> store dråper bakover før de fryser: klar, hard, tung <em>klaris</em> som sprer seg bak det beskyttede området og kan danne <em>horn</em>. Den farligste typen.'}},
 {t:{en:'Freezing rain · under a warm layer',no:'Underkjølt regn · under et varmt lag'},
  d:{en:'Snow melts in a warm layer aloft, then falls as rain into cold air below. The drops are big and supercooled: <em>severe clear ice in seconds</em>. Typical ahead of a warm front. Climb into the warm air or leave the area.',
     no:'Snø smelter i et varmt lag høyere oppe og faller så som regn ned i kald luft. Dråpene er store og underkjølte: <em>kraftig klaris på sekunder</em>. Typisk foran en varmfront. Stig opp i den varme luften eller forlat området.'}},
 {t:{en:'What ice does · less lift, earlier stall',no:'Hva isen gjør · mindre løft, tidligere stall'},
  d:{en:'Even a thin rough layer can cut <em>CLmax by 25 % or more</em> and make the wing stall at a <em>lower angle of attack</em> — before the stall warning, which is set for a clean wing. Drag and weight go up.',
     no:'Selv et tynt, ruglete lag kan redusere <em>CLmax med 25 % eller mer</em> og få vingen til å stalle ved <em>lavere innfallsvinkel</em> — før stallvarselet, som er satt for en ren vinge. Motstand og vekt øker.'},
  go:{en:'Open the icing and turbulence lab',no:'Åpne ising- og turbulenslabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* NACA 2412 section, chord 0..1 */
const yt=x=>.6*(.2969*Math.sqrt(Math.max(0,x))-.126*x-.3516*x*x+.2843*x*x*x-.1015*x*x*x*x);
const yc=x=>x<.4?.02/.16*(.8*x-x*x):.02/.36*(.2+.8*x-x*x);
const yU=x=>yc(x)+yt(x), yL=x=>yc(x)-yt(x);
function foil(g,ax,ay,ch,iceType,k,tm){
  const PX=x=>ax+x*ch, PY=y=>ay-y*ch;
  if(k>0.01&&iceType){ g.save();
    if(iceType==='rime'){ // feathery white accretion growing forward into the flow, only around the stagnation point
      const n=60; for(let i=0;i<n;i++){ const u=i/(n-1), a=lerp(-1.15,1.15,u), base=[PX(.004)-Math.cos(a)*ch*.012,PY(.0)-Math.sin(a)*ch*.03]; const len=ch*.045*k*Math.cos(a*1.1)*(0.75+.5*Math.abs(Math.sin(i*2.7)));
        g.strokeStyle=`rgba(240,245,250,${.9})`; g.lineWidth=Math.max(1.5,ch*.006); g.beginPath(); g.moveTo(base[0],base[1]); g.lineTo(base[0]-len,base[1]-len*Math.sin(a)*.25); g.stroke(); }
      g.fillStyle='rgba(236,242,248,.92)'; g.beginPath(); g.ellipse(PX(0)-ch*.012*k,PY(0),ch*.022*k+2,ch*.035*k+2,0,0,7); g.fill(); }
    else { // glaze: clear, spreads aft, two horns
      const hk=k; g.fillStyle='rgba(170,215,245,.55)'; g.strokeStyle='rgba(225,242,255,.95)'; g.lineWidth=1.4;
      g.beginPath(); g.moveTo(PX(.16),PY(yU(.16)+.003));
      g.bezierCurveTo(PX(.06),PY(yU(.06)+.01*hk),PX(.01),PY(.05*hk),PX(-.05*hk),PY(.085*hk));
      g.lineTo(PX(-.065*hk),PY(.072*hk)); g.quadraticCurveTo(PX(-.02*hk),PY(.03*hk),PX(-.03*hk),PY(0));
      g.quadraticCurveTo(PX(-.02*hk),PY(-.03*hk),PX(-.055*hk),PY(-.06*hk)); g.lineTo(PX(-.04*hk),PY(-.07*hk));
      g.bezierCurveTo(PX(.0),PY(-.05*hk),PX(.05),PY(yL(.05)-.008*hk),PX(.13),PY(yL(.13)-.002)); g.closePath(); g.fill(); g.stroke();
      // runback rivulets
      for(let r=0;r<4;r++){ const x0=.1+r*.035; g.strokeStyle='rgba(200,232,252,.7)'; g.lineWidth=1.2; g.beginPath(); g.moveTo(PX(x0),PY(yU(x0)+.004)); g.lineTo(PX(x0+.05*hk),PY(yU(x0+.05*hk)+.004)); g.stroke(); } }
    g.restore(); }
  // the wing section (metal) with a leading-edge protection strip
  const gr=g.createLinearGradient(0,PY(.1),0,PY(-.06)); gr.addColorStop(0,'#AEB9C2'); gr.addColorStop(.5,'#7D8A95'); gr.addColorStop(1,'#4C5862');
  g.fillStyle=gr; g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=1.4; g.beginPath();
  for(let x=0;x<=1.0001;x+=0.005){ const X=PX(x), Y=PY(yU(x)); x?g.lineTo(X,Y):g.moveTo(X,Y); }
  for(let x=1;x>=0;x-=0.005) g.lineTo(PX(x),PY(yL(x))); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle='rgba(113,204,147,.8)'; g.lineWidth=3; g.beginPath(); for(let x=.06;x>=0;x-=.005) g.lineTo(PX(x),PY(yU(x))); for(let x=0;x<=.05;x+=.005) g.lineTo(PX(x),PY(yL(x))); g.stroke();
  return {PX,PY}; }
/* droplet paths towards the leading edge: small drops follow the air round the nose, big ones keep going straight */
function drops(g,ax,ay,ch,big,tm){ const PX=x=>ax+x*ch, PY=y=>ay-y*ch, n=big?16:22;
  for(let i=0;i<n;i++){ const y0=lerp(-.16,.18,i/(n-1)), ph=((tm*(big?.35:.5)+i*.37)%1), x=lerp(-.6,0,ph);
    // deflection: small drops are pushed away from the nose more strongly
    const reach=Math.abs(y0)<(big?.11:.035), defl=big?.15:.85, k=clamp((x+.25)/.25,0,1), yy=y0+(y0>=0?1:-1)*defl*Math.pow(k,2)*Math.max(0,.09-Math.abs(y0)*.3)*(reach?0:1);
    if(reach&&x>-.01) continue;
    const yAt=reach?y0*(1-k*.6):yy;
    g.fillStyle=big?'rgba(127,198,238,.9)':'rgba(200,230,250,.85)'; g.beginPath(); g.arc(PX(x),PY(yAt+.01),big?3.4:1.8,0,7); g.fill(); } }
function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const sceneA=1-at(p,1,.7), foilA=at(p,1,.7)*(1-at(p,3,.7)), frA=at(p,3,.7)*(1-at(p,4,.7)), clA=at(p,4,.7);
  const gy=H*.88, top=H*.06;
  // 1: the atmosphere with temperature levels
  if(sceneA>0.01){ g.save(); g.globalAlpha=sceneA; const Y=h=>gy-(gy-top)*h/30000, f0=6000, f20=16000, f40=26000;
    g.fillStyle='#1b2a22'; g.fillRect(0,gy,W,H-gy);
    g.fillStyle='rgba(236,90,71,.12)'; g.fillRect(0,Y(f20),W,Y(f0)-Y(f20));
    [[f0,'0 °C'],[f20,'−20 °C'],[f40,'−40 °C']].forEach(([h,l])=>{ g.strokeStyle='rgba(255,255,255,.35)'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(0,Y(h)); g.lineTo(W,Y(h)); g.stroke(); g.setLineDash([]); txt(g,l,W-10,Y(h)-5,{mono:1,size:11*fs,col:'#fff',al:'right'}); });
    pill(g,L({en:'icing risk: 0 to −20 °C',no:'isingsfare: 0 til −20 °C'}),W*(sm?.5:.78),(Y(f0)+Y(f20))/2,{size:11.5*fs,col:'#FF8A78',al:'center'});
    deck(g,W*.04,W*.4,x=>Y(9000),x=>Y(11500)+Math.sin(x*.05)*3,{alpha:.9,billow:12});
    txt(g,L({en:'layer cloud: small drops',no:'lagsky: små dråper'}),W*.22,Y(11500)-12,{size:10.5*fs,col:'#fff',al:'center'});
    cumulus(g,W*(sm?.62:.56),Y(3000),Y(21000),W*(sm?.2:.13),{seed:4});
    txt(g,L({en:'cumulus: big drops',no:'cumulus: store dråper'}),W*(sm?.62:.56),Y(22500),{size:10.5*fs,col:'#fff',al:'center'});
    // supercooled droplets drifting
    for(let k=0;k<30;k++){ const ph=((tm*.15+k*.37)%1), x=(k*71%W), y=lerp(Y(f20),Y(f0),((k*.29)%1))+Math.sin(tm+k)*4; g.fillStyle=`rgba(127,198,238,${.5+.3*Math.sin(tm*2+k)})`; g.beginPath(); g.arc(x,y,1.8,0,7); g.fill(); }
    g.restore(); }
  // 2–3: ice on the wing
  if(foilA>0.01){ g.save(); g.globalAlpha=foilA; const ch=Math.min(W*(sm?1.4:1.15),H*2.6), ax=W*(sm?.3:.36), ay=H*(sm?.4:.46);
    const type=p<1.6?'rime':'clear', k=type==='rime'?ease(clamp((p-.4)/.6,0,1)):ease(clamp((p-1.6)/.4,0,1));
    g.save(); g.beginPath(); g.rect(0,0,W,H); g.clip();
    // airflow streamlines around the nose
    for(let j=-4;j<=4;j++){ const y0=j*.04; g.strokeStyle='rgba(127,198,238,.22)'; g.lineWidth=1; g.beginPath();
      for(let x=-.6;x<=.8;x+=.01){ const env=x<0?Math.exp(x/.12):1, yy=j>=0?Math.max(y0,yU(clamp(x,0,1))+y0*.6+.012)*env+y0*(1-env):Math.min(y0,yL(clamp(x,0,1))+y0*.6-.012)*env+y0*(1-env); const X=ax+x*ch, Y=ay-yy*ch; x<=-.6?g.moveTo(X,Y):g.lineTo(X,Y); } g.stroke(); }
    drops(g,ax,ay,ch,type==='clear',tm);
    foil(g,ax,ay,ch,type,k,tm);
    g.restore();
    const big=type==='clear';
    pill(g,big?L({en:'CLEAR ICE · hard, heavy, runs back',no:'KLARIS · hard, tung, renner bakover'}):L({en:'RIME · white, rough, brittle',no:'RIMIS · hvit, ru, sprø'}),ax+ch*.18,ay-ch*.13,{mono:1,size:12*fs,col:'#fff',fit:W});
    if(big) pill(g,L({en:'horns',no:'horn'}),ax-ch*.07,ay-ch*.1,{size:10.5*fs,col:'#9FD4F2',al:'center'});
    pill(g,L({en:'protected area',no:'beskyttet område'}),ax+ch*.02,ay+ch*.08,{size:10.5*fs,col:'#8EDDB0',al:'center'});
    if(big) pill(g,L({en:'ice beyond the protection',no:'is bak beskyttelsen'}),ax+ch*.16,ay+ch*.05,{size:10.5*fs,col:'#FF8A78'});
    // the conditions card
    const cx0=sm?W*.05:W*.04, cy0=sm?H*.72:H*.7, cw=sm?W*.9:W*.37, chh=sm?H*.24:H*.24;
    rr(g,cx0,cy0,cw,chh,8); g.fillStyle='rgba(10,15,20,.88)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
    [[L({en:'drops',no:'dråper'}),big?L({en:'large (cumulus, freezing rain)',no:'store (cumulus, underkjølt regn)'}):L({en:'small (layer cloud)',no:'små (lagsky)'})],
     [L({en:'temperature',no:'temperatur'}),big?'0 … −10 °C':'−10 … −20 °C'],
     [L({en:'freezes',no:'fryser'}),big?L({en:'slowly, flows back first',no:'sakte, renner bakover først'}):L({en:'at once, traps air',no:'straks, fanger luft'})]].forEach(([a,b2],r)=>{ txt(g,a,cx0+12,cy0+22+r*20*fs,{size:11.5*fs,col:'#AEB8C1'}); txt(g,b2,cx0+cw-12,cy0+22+r*20*fs,{size:11.5*fs,col:'#fff',al:'right'}); });
    g.restore(); }
  // 4: freezing rain
  if(frA>0.01){ g.save(); g.globalAlpha=frA; const Y=h=>gy-(gy-top)*h/12000;
    g.fillStyle='#1b2a22'; g.fillRect(0,gy,W,H-gy);
    const band=(h0,h1,col,lab,tc)=>{ g.fillStyle=col; g.fillRect(0,Y(h1),W,Y(h0)-Y(h1)); txt(g,lab,12,Y(h1)+16,{mono:1,size:10.5*fs,col:tc}); };
    band(7000,12000,'rgba(127,198,238,.08)',L({en:'cold: snow',no:'kaldt: snø'}),'#9FD4F2');
    band(4000,7000,'rgba(236,90,71,.14)',L({en:'warm layer above 0 °C: snow melts',no:'varmt lag over 0 °C: snøen smelter'}),'#FF8A78');
    band(0,4000,'rgba(127,198,238,.14)',L({en:'cold below 0 °C: rain becomes supercooled',no:'kaldt under 0 °C: regnet blir underkjølt'}),'#9FD4F2');
    for(let k=0;k<70;k++){ const ph=((tm*.35+k*.618)%1), x=((k*53)%W), h=lerp(12000,0,ph), y=Y(h);
      if(h>7000){ g.fillStyle='rgba(240,244,247,.8)'; g.beginPath(); g.arc(x+Math.sin(tm*2+k)*3,y,2,0,7); g.fill(); }
      else { g.strokeStyle=h>4000?'rgba(127,198,238,.75)':'rgba(190,225,250,.95)'; g.lineWidth=h>4000?1.2:1.8; g.beginPath(); g.moveTo(x,y); g.lineTo(x-2,y+9); g.stroke(); } }
    const ax=W*.7, ay=Y(2200), s=Math.max(1.4,W/450); CORE.U.jet(g,{x:ax,y:ay+2.4*s,s,pitch:0,gear:0,tm});
    pill(g,L({en:'severe clear ice in seconds',no:'kraftig klaris på sekunder'}),ax,ay-H*.08,{size:11*fs,col:'#FF8A78',al:'center',fit:W});
    arrow(g,ax+W*.12,ay,ax+W*.12,Y(5500),C.green,{lw:2.4,head:9}); txt(g,L({en:'climb into the warm layer',no:'stig opp i det varme laget'}),ax+W*.12+8,Y(4600),{size:10.5*fs,col:'#8EDDB0'});
    g.restore(); }
  // 5: lift curve
  if(clA>0.01){ g.save(); g.globalAlpha=clA; const x0=W*(sm?.12:.12), x1=W*(sm?.94:.62), y0=H*.1, y1=H*.86, X=a=>x0+(x1-x0)*a/22, Y=c=>y1-(y1-y0)*c/1.8;
    g.strokeStyle='rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x0,y1); g.lineTo(x1,y1); g.stroke();
    for(let a=0;a<=20;a+=5) txt(g,a+'°',X(a),y1+14,{mono:1,size:9.5*fs,col:'#7F8B96',al:'center'}); txt(g,L({en:'angle of attack',no:'innfallsvinkel'}),x1,y1+28,{mono:1,size:9.5*fs,col:'#8E99A4',al:'right'}); txt(g,'CL',x0-8,y0+6,{mono:1,size:10*fs,col:'#8E99A4',al:'right'});
    const curve=(cl,am,col,lw)=>{ g.strokeStyle=col; g.lineWidth=lw; g.beginPath(); for(let a=0;a<=21;a+=.2){ const t=a/am, c=a<=am?cl*(1.5*t-.5*t*t*t):cl-Math.pow(a-am,1.25)*.045; const y=Y(Math.max(0,c)); a?g.lineTo(X(a),y):g.moveTo(X(a),y); } g.stroke(); };
    curve(1.6,16,'#fff',2.6); const k=at(p,4,.7); curve(lerp(1.6,1.15,k),lerp(16,11,k),'#9FD4F2',2.6);
    g.fillStyle='#fff'; g.beginPath(); g.arc(X(16),Y(1.6),4,0,7); g.fill(); pill(g,L({en:'clean CLmax',no:'ren CLmax'}),X(16)+10,Y(1.6)+16,{size:10.5*fs,col:'#fff'});
    g.fillStyle='#9FD4F2'; g.beginPath(); g.arc(X(lerp(16,11,k)),Y(lerp(1.6,1.15,k)),4,0,7); g.fill(); pill(g,L({en:'iced: −28 %, stalls 5° earlier',no:'iset: −28 %, staller 5° tidligere'}),X(lerp(16,11,k))-8,Y(lerp(1.6,1.15,k))+22,{size:10.5*fs,col:'#9FD4F2',al:'right',fit:W});
    g.strokeStyle=C.amber; g.setLineDash([4,4]); g.beginPath(); g.moveTo(X(14),y0); g.lineTo(X(14),y1); g.stroke(); g.setLineDash([]); pill(g,L({en:'stall warning (set for a clean wing)',no:'stallvarsel (satt for ren vinge)'}),X(14),y0+10,{size:10*fs,col:C.amber,al:'center',fit:W});
    if(!sm){ const ch=W*.24; g.save(); g.beginPath(); g.rect(W*.66,0,W*.34,H); g.clip(); foil(g,W*.72,H*.5,ch,'clear',1,tm); g.restore(); }
    g.restore(); }
  txt(g,L({en:'illustrative',no:'illustrerende'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.1,dwell:7,
    title:{en:'Where ice forms, and what it does to the wing',no:'Hvor isen dannes, og hva den gjør med vingen'},
    sub:{en:'Supercooled water, the temperature band to fear, the three kinds of ice, and the one number that matters: how much lift you lose.',no:'Underkjølt vann, temperaturbåndet du skal frykte, de tre istypene, og det ene tallet som teller: hvor mye løft du mister.'},
    label:{en:'Animated atmosphere with the icing band, rime and clear ice forming on a wing section, freezing rain under a warm layer, and a lift curve with and without ice.',no:'Animert atmosfære med isingsbåndet, rimis og klaris som dannes på et vingeprofil, underkjølt regn under et varmt lag, og en løftekurve med og uten is.'},
    foot:{en:'Illustrative values; the loss of CLmax and the stall angle with ice vary widely with the ice shape.',no:'Illustrerende verdier; tapet av CLmax og stallvinkelen med is varierer mye med isens form.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
