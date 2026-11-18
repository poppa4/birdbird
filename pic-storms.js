/* NORDAP – pic-storms.js: "A thunderstorm's life, and the microburst on final" for storms.html (uses corepic.js).
   Cumulus → mature → dissipating stage with updraughts/downdraughts, then a microburst on a 3° approach: headwind gain,
   downdraught, tailwind loss of airspeed, and the escape. Illustrative values (microburst about 4 km across, outflow ±30 kt). */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT,cumulus,jet}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'Cumulus stage · all updraught',no:'Cumulusstadiet · bare oppvind'},
  d:{en:'Warm, moist, unstable air rises and the cloud grows fast, <em>updraughts only</em>, up to thousands of feet per minute. No rain reaches the ground yet. About 10–15 minutes.',
     no:'Varm, fuktig, ustabil luft stiger, og skyen vokser raskt, <em>bare oppvind</em>, opptil tusenvis av fot i minuttet. Ennå når ingen nedbør bakken. Omtrent 10–15 minutter.'}},
 {t:{en:'Mature stage · up and down',no:'Modent stadium · opp og ned'},
  d:{en:'Rain and hail drag air down: <em>downdraughts beside updraughts</em>. Heavy rain, hail, lightning, severe turbulence and icing, an anvil at the tropopause. The most dangerous 15–30 minutes.',
     no:'Regn og hagl drar luft med seg ned: <em>nedvind ved siden av oppvind</em>. Kraftig regn, hagl, lyn, kraftig turbulens og ising, en ambolt ved tropopausen. De farligste 15–30 minuttene.'}},
 {t:{en:'Dissipating stage · all downdraught',no:'Oppløsningsstadiet · bare nedvind'},
  d:{en:'The downdraughts cut off the warm inflow. The storm rains itself out; the anvil drifts away. <em>Downdraughts only</em>, still turbulent.',
     no:'Nedvinden kutter tilførselen av varm luft. Uværet regner seg ut; ambolten driver bort. <em>Bare nedvind</em>, fortsatt turbulent.'}},
 {t:{en:'Microburst · a downdraught hits the ground',no:'Microburst · en nedvind treffer bakken'},
  d:{en:'A small, violent downdraught (under 4 km across) spreads out along the ground in all directions. On final you fly <em>into a headwind, then a downdraught, then a tailwind</em> — in less than a minute.',
     no:'En liten, voldsom nedvind (under 4 km tvers over) sprer seg langs bakken i alle retninger. På finale flyr du <em>inn i motvind, så nedvind, så medvind</em> — på under ett minutt.'}},
 {t:{en:'First it looks good, then it is not',no:'Først ser det bra ut, så er det ikke det'},
  d:{en:'The headwind makes the IAS rise and the aircraft float <em>above the glide path</em> — the trap is to reduce power. Then the downdraught and the tailwind take the airspeed away: <em>sink below the path</em>.',
     no:'Motvinden får IAS til å stige og flyet til å flyte <em>over glidebanen</em> — fellen er å trekke av effekt. Så tar nedvinden og medvinden farten: <em>synk under banen</em>.'}},
 {t:{en:'Escape · go around now',no:'Unngå · gå rundt nå'},
  d:{en:'Windshear warning or a big speed change: <em>maximum thrust, pitch up to the windshear attitude, do not change configuration</em> until clear. Better still: avoid the storm — 20 NM laterally from a severe CB, never under the anvil.',
     no:'Varsel om vindskjær eller stor fartsendring: <em>maks skyvekraft, løft nesen til vindskjær-holdning, ikke endre konfigurasjon</em> før du er ute. Enda bedre: unngå uværet — 20 NM sideveis fra en kraftig CB, aldri under ambolten.'},
  go:{en:'Open the storm lab',no:'Åpne stormlabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function rain(g,x0,x1,y0,y1,tm,n,col,sp,len){ for(let k=0;k<n;k++){ const ph=((tm*sp+k*.618)%1), x=x0+((k*37.3)%1000)/1000*(x1-x0), y=lerp(y0,y1,ph); g.strokeStyle=col; g.lineWidth=1.1; g.beginPath(); g.moveTo(x,y); g.lineTo(x-len*.25,y+len); g.stroke(); } }
function flow(g,x,y0,y1,tm,up,col,n){ for(let k=0;k<(n||4);k++){ const ph=((tm*.6+k/(n||4))%1), y=up?lerp(y0,y1,ph):lerp(y1,y0,ph); g.save(); g.globalAlpha*=Math.sin(ph*Math.PI); arrow(g,x+(k%2?8:-8),y+(up?18:-18),x+(k%2?8:-8),y,col,{lw:2.6,head:9}); g.restore(); } }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const gy=H*.86, top=H*.06;
  const mb=at(p,3,.9), life=1-mb;
  g.fillStyle='#1b2a22'; g.fillRect(0,gy,W,H-gy);
  if(life>0.01){ g.save(); g.globalAlpha=life;
    const cx=W*(sm?.46:.42), base=gy-H*.14;
    // stage blend
    const s1=at(p,1,.9), s2=at(p,2,.9);
    const topY=lerp(lerp(base-H*.34,top+H*.08,s1),top+H*.12,s2), w=W*(sm?.3:.18)*(1+.15*s1-.1*s2);
    const alpha=1-.35*s2;
    cumulus(g,cx,base,topY,w,{dark:s1>.3?1:0,anvil:s1>.3?W*(sm?.25:.2)*(1+.6*s2):0,alpha,seed:5});
    // tropopause
    if(s1>0.1){ g.strokeStyle='rgba(185,163,242,.35)'; g.setLineDash([3,5]); g.beginPath(); g.moveTo(0,top+H*.06); g.lineTo(W,top+H*.06); g.stroke(); g.setLineDash([]); txt(g,L({en:'tropopause',no:'tropopausen'}),W-8,top+H*.06-5,{mono:1,size:9.5*fs,col:'rgba(185,163,242,.8)',al:'right'}); }
    // draughts
    const upA=1-s2, dnA=s1;
    if(upA>0.02){ g.save(); g.globalAlpha*=upA; flow(g,cx-w*(s1>.5?.22:0),base-10,topY+40,tm,true,'#FF8A78',5); pill(g,L({en:'updraught',no:'oppvind'}),cx-w*(s1>.5?.22:0)-w*.32,base-H*.15,{size:10.5*fs,col:'#FF8A78',al:'right',fit:W}); g.restore(); }
    if(dnA>0.02){ g.save(); g.globalAlpha*=dnA; flow(g,cx+w*(s2>.5?0:.2),base+H*.02,topY+H*.18,tm,false,C.blue,5); rain(g,cx-w*(.1+.3*s2),cx+w*.45,base,gy,tm,60,'rgba(127,198,238,.7)',1.8,12);
      pill(g,L({en:'downdraught + rain, hail',no:'nedvind + regn, hagl'}),cx+w*.5,base-H*.1,{size:10.5*fs,col:'#9FD4F2',fit:W}); g.restore(); }
    // lightning in the mature stage
    if(s1>.6&&s2<.5&&((tm*1.3)%3)<.12){ g.strokeStyle='rgba(255,250,210,.95)'; g.lineWidth=2; g.beginPath(); let x=cx+w*.1, y=base-H*.05; g.moveTo(x,y); for(let k=0;k<6;k++){ x+=(k%2?-1:1)*10; y+=H*.05; g.lineTo(x,y); } g.stroke(); }
    // stage tags
    const tag=p<.6?L({en:'CUMULUS',no:'CUMULUS'}):p<1.6?L({en:'MATURE',no:'MODENT'}):L({en:'DISSIPATING',no:'OPPLØSNING'});
    pill(g,tag,16,22,{mono:1,size:11*fs,col:'#fff'});
    const time=p<.6?'0–15 min':p<1.6?'15–30 min':'30–60 min'; txt(g,time,16,46,{mono:1,size:10.5*fs,col:'#AEB8C1'});
    g.restore(); }
  if(mb>0.01){ g.save(); g.globalAlpha=mb;
    const cx=W*.48, base=top+H*.28, R=W*(sm?.3:.22);
    cumulus(g,cx,base,top+H*.02,W*(sm?.32:.2),{dark:1,seed:9});
    // the downdraught column and the outflow vortex rings
    rain(g,cx-R*.25,cx+R*.25,base,gy,tm,60,'rgba(127,198,238,.6)',2.0,12);
    for(let k=0;k<5;k++){ const ph=((tm*.7+k/5)%1), y=lerp(base+20,gy-30,ph); g.save(); g.globalAlpha*=Math.sin(ph*Math.PI); arrow(g,cx,y-20,cx,y,C.blue,{lw:3,head:10}); g.restore(); }
    for(const dir of [-1,1]){ for(let k=0;k<4;k++){ const ph=((tm*.5+k/4)%1); const x=cx+dir*lerp(R*.1,R*1.5,ph); g.save(); g.globalAlpha*=Math.sin(ph*Math.PI); arrow(g,x-dir*24,gy-14,x,gy-14,C.blue,{lw:3,head:10}); g.restore(); }
      g.strokeStyle='rgba(127,198,238,.35)'; g.lineWidth=2; g.beginPath(); g.ellipse(cx+dir*R*.55,gy-40,R*.35,34,0,0,7); g.stroke(); }
    // approach path: 3° to a runway on the right
    const rx=W*.94, gsY=x=>gy-(rx-x)*Math.tan(3*Math.PI/180)*(sm?5:4);
    g.fillStyle='#3A444C'; g.fillRect(rx-W*.08,gy-2,W*.1,4);
    g.strokeStyle='rgba(113,204,147,.6)'; g.setLineDash([6,5]); g.lineWidth=1.6; g.beginPath(); g.moveTo(W*.02,gsY(W*.02)); g.lineTo(rx,gy); g.stroke(); g.setLineDash([]);
    txt(g,L({en:'glide path 3°',no:'glidebane 3°'}),W*.06,gsY(W*.06)-8,{mono:1,size:10*fs,col:'#8EDDB0'});
    // aircraft flying left → right through it (towards the runway)
    const k=(tm*.075)%1, ax=lerp(W*.02,rx-W*.06,k);
    const dev=x=>{ const u=(x-cx)/R; return (u<-1.4?0:u<-.3?-Math.sin((u+1.4)/1.1*Math.PI/2)*22:u<.3?lerp(-22,30,(u+.3)/.6):u<1.4?30+20*(u-.3):52)*(sm?.8:1); };   // px above(-)/below(+) the path
    const esc=at(p,5,.6);
    const devE=x=>{ const d=dev(x); if(esc<0.01) return d; const u=(x-cx)/R; return u>-.1?lerp(d,lerp(d,-((u+.1)*140),esc),clamp((u+.1)*3,0,1)):d; };
    g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=2.2; g.beginPath(); for(let x=W*.02;x<=ax;x+=4){ const y=gsY(x)+devE(x); x===W*.02?g.moveTo(x,y):g.lineTo(x,y); } g.stroke();
    const ay=gsY(ax)+devE(ax), ad=Math.atan2(gsY(ax+4)+devE(ax+4)-ay,4)*180/Math.PI;
    jet(g,{x:ax,y:ay+2.2*Math.max(1.3,W/520),s:Math.max(1.3,W/520),pitch:-ad,gear:1,tm});
    // the three zones
    const z=at(p,4,.7);
    if(z>0.01){ g.save(); g.globalAlpha*=z; const zl=(x,t,c,dy)=>pill(g,t,x,Math.min(gy-60,gsY(x)+dy),{size:10.5*fs,col:c,al:'center',fit:W});
      zl(cx-R*1.0,L({en:'headwind: IAS ↑, above the path',no:'motvind: IAS ↑, over banen'}),C.amber,-48);
      zl(cx,L({en:'downdraught',no:'nedvind'}),C.blue,-60);
      zl(cx+R*.95,L({en:'tailwind: IAS ↓, sinks',no:'medvind: IAS ↓, synker'}),'#FF8A78',70);
      g.restore(); }
    if(esc>0.01){ g.save(); g.globalAlpha*=esc; pill(g,L({en:'WINDSHEAR · TOGA · pitch up · same configuration',no:'VINDSKJÆR · TOGA · nesen opp · samme konfigurasjon'}),W/2,H*.08,{mono:1,size:(sm?9.5:11.5)*fs,col:'#FF8A78',al:'center',fit:W}); g.restore(); }
    // IAS readout
    const u=(ax-cx)/R, ias=140+(u<-1.4?0:u<-.3?20*Math.sin((u+1.4)/1.1*Math.PI/2):u<.3?lerp(20,-5,(u+.3)/.6):u<1.4?lerp(-5,-28,(u-.3)/1.1):-28)*(1-esc*.6);
    pill(g,`IAS ${nf(ias)} kt`,16,22,{mono:1,size:11*fs,col:ias<128?'#FF8A78':ias>150?C.amber:'#fff'});
    g.restore(); }
  txt(g,L({en:'not to scale · illustrative',no:'ikke i skala · illustrerende'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.05,dwell:7,
    title:{en:'A thunderstorm\'s life, and the microburst on final',no:'Et tordenværs liv, og microbursten på finale'},
    sub:{en:'Three stages from first cumulus to rain-out, then the most dangerous thing a storm can do to an aircraft close to the ground.',no:'Tre stadier fra første cumulus til den regner ut, og så det farligste et uvær kan gjøre med et fly nær bakken.'},
    label:{en:'Animated cumulonimbus through its three stages with up- and downdraughts, then a microburst with an aircraft on a 3° approach meeting headwind, downdraught and tailwind.',no:'Animert cumulonimbus gjennom tre stadier med opp- og nedvind, deretter en microburst med et fly på 3° innflyging som møter motvind, nedvind og medvind.'},
    foot:{en:'Illustrative: microburst under 4 km across, outflow about ±30 kt. Avoid a severe CB by at least 20 NM; never fly under the anvil.',no:'Illustrerende: microburst under 4 km tvers over, utstrømning omtrent ±30 kt. Hold minst 20 NM fra en kraftig CB; fly aldri under ambolten.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
