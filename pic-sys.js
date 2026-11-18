/* NORDAP – pic-sys.js: "Systems: where the power comes from, and what you lose" for jetsystems.html (uses corepic.js).
   One schematic of a generic twin-jet: engines drive generators and hydraulic pumps; electrical buses and three hydraulic
   systems feed the users; then an engine failure and a hydraulic loss show the redundancy, and the RAT as the last resort.
   Generic Airbus-style architecture (three hydraulic systems, two AC generators, APU, RAT); illustrative, not a type's FCOM. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const HYD={G:'#71CC93',B:'#7FC6EE',Y:'#F0D060'};

const steps=[
 {t:{en:'The engines power everything',no:'Motorene driver alt'},
  d:{en:'Each engine drives an <em>AC generator</em> and a <em>hydraulic pump</em> through its gearbox, and supplies <em>bleed air</em>. On the ground or as a back-up, the <em>APU</em> does the same job.',
     no:'Hver motor driver en <em>AC-generator</em> og en <em>hydraulikkpumpe</em> via girkassen, og leverer <em>tappeluft</em>. På bakken eller som reserve gjør <em>APU</em> den samme jobben.'}},
 {t:{en:'Electrics · buses',no:'Elektrisk · samleskinner'},
  d:{en:'Each generator feeds its own <em>AC bus</em>; transformer-rectifiers make DC; the batteries hold the essential DC. If one generator fails, the other (or the APU) takes over its bus through a <em>bus tie</em>.',
     no:'Hver generator forsyner sin egen <em>AC-skinne</em>; transformator-likerettere lager DC; batteriene holder den viktigste DC-en. Svikter én generator, tar den andre (eller APU) over skinnen via en <em>bus tie</em>.'}},
 {t:{en:'Hydraulics · three independent systems',no:'Hydraulikk · tre uavhengige systemer'},
  d:{en:'Flight controls, gear, brakes and flaps are spread over <em>three systems</em> so that no single failure takes away control. Each control surface has more than one actuator on different systems.',
     no:'Flykontroller, understell, bremser og flaps er fordelt på <em>tre systemer</em> slik at ingen enkeltfeil tar bort kontrollen. Hver rorflate har mer enn én aktuator på ulike systemer.'}},
 {t:{en:'Engine failure · what is left',no:'Motorstans · hva er igjen'},
  d:{en:'Lose the left engine: its generator and its pump go. The bus tie powers the left side from the right generator; the <em>PTU</em> or an electric pump keeps that hydraulic system alive. You keep everything that matters.',
     no:'Mister du venstre motor, forsvinner generatoren og pumpen. Bus tie forsyner venstre side fra høyre generator; <em>PTU</em> eller en elektrisk pumpe holder det hydrauliske systemet i live. Du beholder alt som betyr noe.'}},
 {t:{en:'Both engines out · the RAT',no:'Begge motorer ute · RAT'},
  d:{en:'Lose both engines: the <em>ram air turbine</em> drops out into the airflow and drives the blue hydraulic system and an emergency generator for the essential bus. Just enough for the essential instruments and the flight controls.',
     no:'Mister du begge motorene, faller <em>ram air-turbinen</em> ut i luftstrømmen og driver det blå hydraulikksystemet og en nødgenerator for den essensielle skinnen. Akkurat nok til de viktigste instrumentene og flykontrollene.'},
  go:{en:'Open the systems lab',no:'Åpne systemlabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function box(g,x,y,w,h,lab,col,on,sub){ rr(g,x,y,w,h,6); g.fillStyle=on?'rgba(18,26,34,.95)':'rgba(18,26,34,.5)'; g.fill(); g.strokeStyle=on?col:'rgba(236,90,71,.7)'; g.lineWidth=on?1.6:1.6; g.stroke();
  txt(g,lab,x+w/2,y+h/2+(sub?-2:4),{mono:1,size:Math.min(12,h*.32),col:on?'#fff':'#FF8A78',al:'center',w:600}); if(sub) txt(g,sub,x+w/2,y+h/2+12,{size:Math.min(10,h*.24),col:'#8E99A4',al:'center'});
  if(!on){ g.strokeStyle='rgba(236,90,71,.85)'; g.lineWidth=2; g.beginPath(); g.moveTo(x+4,y+4); g.lineTo(x+w-4,y+h-4); g.stroke(); } }
function line(g,pts,col,on,tm,w){ g.strokeStyle=on?col:'rgba(120,130,140,.35)'; g.lineWidth=w||2.4; g.setLineDash(on?[]:[4,5]); g.beginPath(); pts.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])); g.stroke(); g.setLineDash([]);
  if(!on) return; let len=0; const seg=[]; for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(d); len+=d; }
  for(let k=0;k<Math.max(2,Math.round(len/40));k++){ let u=((tm*.5+k/Math.max(2,Math.round(len/40)))%1)*len, i=0; while(i<seg.length&&u>seg[i]){ u-=seg[i]; i++; } if(i>=seg.length) continue; const a=pts[i], b=pts[i+1], t=u/seg[i];
    g.fillStyle='#fff'; g.globalAlpha*=.8; g.beginPath(); g.arc(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,2,0,7); g.fill(); g.globalAlpha/=.8; } }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const engL=p<3.5||p>=4.5?(p>=4.5?0:1):0, engR=p>=4.5?0:1;
  const lost=at(p,3,.6), rat=at(p,4,.6);
  const eL=lost<.5, eR=rat<.5;
  const elA=Math.max(p<1?.5:0,at(p,1,.6)), hyA=Math.max(p<1?.5:0,at(p,2,.6));
  const cx=W*.5, ey=H*.16, ew=W*(sm?.24:.13), eh=H*.12;
  // the aircraft seen from above, faint, behind the schematic: wings across, engines under the boxes, APU in the tail cone
  { g.save(); g.globalAlpha=.16; g.translate(0,H*.94); g.scale(1,-1); const fy=H*.08, fl=H*.86, fw=W*(sm?.1:.07), wy=H*.44;   // drawn nose down, so the tail cone (APU) is at the top
    const fg=g.createLinearGradient(cx-fw,0,cx+fw,0); fg.addColorStop(0,'#5B6B78'); fg.addColorStop(.5,'#C9D3DB'); fg.addColorStop(1,'#5B6B78'); g.fillStyle=fg;
    g.beginPath(); g.moveTo(cx,fy-H*.04); g.quadraticCurveTo(cx+fw,fy,cx+fw,fy+H*.08); g.lineTo(cx+fw,fl-H*.1); g.lineTo(cx+fw*.3,fl); g.lineTo(cx-fw*.3,fl); g.lineTo(cx-fw,fl-H*.1); g.lineTo(cx-fw,fy+H*.08); g.quadraticCurveTo(cx-fw,fy,cx,fy-H*.04); g.closePath(); g.fill();
    g.fillStyle='#9AA8B3'; g.beginPath(); g.moveTo(cx-fw,wy); g.lineTo(W*.02,wy+H*.2); g.lineTo(W*.02,wy+H*.26); g.lineTo(cx-fw,wy+H*.16); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx+fw,wy); g.lineTo(W*.98,wy+H*.2); g.lineTo(W*.98,wy+H*.26); g.lineTo(cx+fw,wy+H*.16); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx-fw*.6,fl-H*.12); g.lineTo(cx-W*.16,fl-H*.02); g.lineTo(cx-W*.16,fl+H*.02); g.lineTo(cx-fw*.3,fl-H*.04); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx+fw*.6,fl-H*.12); g.lineTo(cx+W*.16,fl-H*.02); g.lineTo(cx+W*.16,fl+H*.02); g.lineTo(cx+fw*.3,fl-H*.04); g.closePath(); g.fill();
    g.restore(); }
  // engines and APU
  box(g,W*.08,ey,ew,eh,L({en:'ENG 1',no:'MOTOR 1'}),'#fff',eL); box(g,W*.92-ew,ey,ew,eh,L({en:'ENG 2',no:'MOTOR 2'}),'#fff',eR);
  box(g,cx-ew*(sm?.32:.4),ey,ew*(sm?.64:.8),eh,'APU','#AEB8C1',true,sm?null:L({en:'back-up',no:'reserve'}));
  if(p<1){ const bl=(x)=>{ for(let k=0;k<3;k++){ const ph=((tm*.6+k/3)%1); g.save(); g.globalAlpha=Math.sin(ph*Math.PI); arrow(g,x,ey+eh*.5,x+(x<cx?1:-1)*ph*W*.08,ey+eh*.5,'#C9D2DA',{lw:2,head:7}); g.restore(); } };
    bl(W*.08+ew); bl(W*.92-ew); pill(g,L({en:'bleed air',no:'tappeluft'}),cx,ey+eh+16,{size:10.5*fs,col:'#C9D2DA',al:'center'}); }
  // generators and pumps on each engine
  const gy=ey+eh+H*.08, gw=W*(sm?.2:.1), gh=H*.08;
  const g1=[W*.08,gy], g2=[W*.92-gw,gy];
  if(elA>0.01){ g.save(); g.globalAlpha=elA;
    box(g,g1[0],g1[1],gw,gh,'GEN 1',C.amber,eL); box(g,g2[0],g2[1],gw,gh,'GEN 2',C.amber,eR);
    line(g,[[g1[0]+gw/2,ey+eh],[g1[0]+gw/2,g1[1]]],C.amber,eL,tm); line(g,[[g2[0]+gw/2,ey+eh],[g2[0]+gw/2,g2[1]]],C.amber,eR,tm);
    const by=gy+gh+H*.07, bw=W*(sm?.3:.2), bh=H*.07, b1=[W*.08,by], b2=[W*.92-bw,by];
    const on1=eL||eR, on2=eR||eL;
    box(g,b1[0],b1[1],bw,bh,rat>.5?'AC ESS':'AC BUS 1',C.amber,on1||rat>.5,rat>.5?L({en:'from the RAT generator',no:'fra RAT-generatoren'}):null); box(g,b2[0],b2[1],bw,bh,'AC BUS 2',C.amber,on2&&rat<.5);
    line(g,[[g1[0]+gw/2,g1[1]+gh],[g1[0]+gw/2,by]],C.amber,eL,tm); line(g,[[g2[0]+gw/2,g2[1]+gh],[g2[0]+gw/2,by]],C.amber,eR,tm);
    // bus tie
    const tieOn=lost>.5&&rat<.5; if(rat<.5) line(g,[[b1[0]+bw,by+bh/2],[b2[0],by+bh/2]],C.amber,tieOn,tm,tieOn?2.6:1.2);
    if(rat<.5) txt(g,'BUS TIE',cx,by+bh/2-8,{mono:1,size:9.5*fs,col:tieOn?C.amber:'#7F8B96',al:'center'});
    if(tieOn) pill(g,L({en:'GEN 2 feeds both sides',no:'GEN 2 forsyner begge sider'}),cx,by+bh/2+20,{size:10.5*fs,col:C.amber,al:'center'});
    g.restore(); }
  // hydraulics
  if(hyA>0.01){ g.save(); g.globalAlpha=hyA; const hy=H*(sm?.66:.68), hw=W*(sm?.26:.17), hh=H*.09, xs=[W*.08,cx-hw/2,W*.92-hw];
    const okG=eL||rat>.5, okY=eR||(lost>.5&&rat<.5), okB=true;
    const sysOn=[okG&&!(rat>.5&&false), true, okY];
    box(g,xs[0],hy,hw,hh,'GREEN',HYD.G,rat>.5?false:eL||lost>.5,lost>.5&&rat<.5?L({en:'via PTU',no:'via PTU'}):rat>.5?null:L({en:'ENG 1 pump',no:'pumpe motor 1'}));
    box(g,xs[1],hy,hw,hh,'BLUE',HYD.B,true,rat>.5?L({en:'via RAT',no:'via RAT'}):L({en:'electric pump',no:'elektrisk pumpe'}));
    box(g,xs[2],hy,hw,hh,'YELLOW',HYD.Y,eR||rat<.5,rat>.5?null:L({en:'ENG 2 pump',no:'pumpe motor 2'}));
    line(g,[[W*.08+ew/2,ey+eh],[W*.08+ew*.15,ey+eh+H*.04],[W*.08+ew*.15,hy]],HYD.G,eL,tm,1.8);
    line(g,[[W*.92-ew/2,ey+eh],[W*.92-ew*.15,ey+eh+H*.04],[W*.92-ew*.15,hy]],HYD.Y,eR,tm,1.8);
    if(lost>.5&&rat<.5){ const py=hy+hh+12; line(g,[[xs[2]+hw*.3,hy+hh],[xs[2]+hw*.3,py],[xs[0]+hw*.7,py],[xs[0]+hw*.7,hy+hh]],'#B9A3F2',true,tm,2); pill(g,L({en:'PTU: yellow drives green',no:'PTU: gul driver grønn'}),cx,py+16,{size:10.5*fs,col:'#B9A3F2',al:'center'}); }
    // users
    const uy=hy+hh+H*.12; txt(g,L({en:'flight controls · gear · brakes · flaps',no:'flykontroller · understell · bremser · flaps'}),cx,Math.min(H-14,uy+10),{size:10.5*fs,col:'#AEB8C1',al:'center'});
    g.restore(); }
  // RAT
  if(rat>0.01){ g.save(); g.globalAlpha=rat; const rx=cx, ry=ey+eh+H*.12, r=Math.min(W,H)*.06;
    g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.moveTo(rx,ry-r*1.6); g.lineTo(rx,ry); g.stroke();
    for(let k=0;k<2;k++){ const a=tm*12+k*Math.PI; g.strokeStyle='#E2E8EE'; g.lineWidth=3; g.beginPath(); g.moveTo(rx+Math.cos(a)*r,ry+Math.sin(a)*r*.3); g.lineTo(rx-Math.cos(a)*r,ry-Math.sin(a)*r*.3); g.stroke(); }
    pill(g,'RAT',rx+r+10,ry,{mono:1,size:11*fs,col:'#fff'});
    const hyY=H*(sm?.66:.68); line(g,[[rx,ry+r*.4],[rx,hyY]],HYD.B,true,tm,2); line(g,[[rx-6,ry],[W*.08+W*(sm?.3:.2),ry],[W*.08+W*(sm?.3:.2)-W*(sm?.06:.04),ey+eh+H*.08+H*.08+H*.07]],C.amber,true,tm,2);
    g.restore(); }
  txt(g,L({en:'generic twin-jet · schematic',no:'generisk tomotors jet · skjematisk'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.6,aspectSm:1/1.15,dwell:7,
    title:{en:'Where the power comes from, and what you keep when it fails',no:'Hvor kraften kommer fra, og hva du beholder når den svikter'},
    sub:{en:'One schematic for electrics and hydraulics. Fail an engine, then everything, and watch the back-ups take over.',no:'Ett skjema for elektrisk og hydraulikk. Ta ut en motor, så alt, og se reservene ta over.'},
    label:{en:'Animated schematic of a twin-jet: engines driving generators and pumps, AC buses with a bus tie, three hydraulic systems, then an engine failure with the PTU and finally the RAT.',no:'Animert skjema av et tomotors jetfly: motorer som driver generatorer og pumper, AC-skinner med bus tie, tre hydraulikksystemer, deretter motorstans med PTU og til slutt RAT.'},
    foot:{en:'Generic architecture in the style of a modern twin-jet. Real aircraft differ in detail; use the type\'s FCOM.',no:'Generisk arkitektur i stil med et moderne tomotors jetfly. Virkelige fly varierer i detaljer; bruk typens FCOM.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
