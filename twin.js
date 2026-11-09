/* Birdbird – twin.js: light-twin engine failure, the propeller as a wing, and the Try tasks for propeller.html.
   Uses VMC.LT / VMC.ltPoint / VMC.ltVmc / VMC.blade (vmc.js) and the drawing helpers of stab.js.
   Light-twin teaching model of our own design (no real type): both propellers turn clockwise seen from behind. */
(function(){
'use strict';
const {L,el,nf}=LAB, S=STAB, I=S.INK, M=VMC, LT=M.LT, D2R=Math.PI/180;
const txt=S.txt, arrow=S.arrow;
const BG='rgba(16,23,29,.78)';
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const hooks=[]; const on=f=>{ hooks.push(f); return f; };
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const kNm=v=>nf(v/1000,1)+' kN·m', kN=v=>nf(v/1000,2)+' kN', kt=v=>v==null?'–':nf(v,0)+' kt';
const narrow=st=>st.w<560;


/* =====================================================================
   P-factor / PAST cards
   ===================================================================== */
const svgP=()=>`<svg viewBox="0 0 200 90" aria-hidden="true"><line x1="10" y1="72" x2="190" y2="20" stroke="#7FCBE8" stroke-dasharray="4 4" stroke-width="1.2"/><text x="14" y="86" fill="#8B99A7" font-size="9" font-family="monospace">${L({en:'relative wind at high AoA',no:'relativ vind ved høy AoA'})}</text><circle cx="100" cy="44" r="30" fill="none" stroke="#2A3742" stroke-width="2"/><path d="M100 44 L130 44" stroke="#F0B440" stroke-width="5" stroke-linecap="round"/><path d="M100 44 L70 44" stroke="#5E6D7C" stroke-width="5" stroke-linecap="round"/><path d="M134 30 v24" stroke="#F0B440" stroke-width="2" marker-end="url(#ah)"/><text x="140" y="40" fill="#F0B440" font-size="10" font-family="sans-serif" font-weight="600">${L({en:'↓ more bite',no:'↓ større bit'})}</text><text x="22" y="40" fill="#8B99A7" font-size="10" font-family="sans-serif">${L({en:'↑ less',no:'↑ mindre'})}</text><circle cx="114" cy="44" r="3.5" fill="#E46BAE"/><defs><marker id="ah" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="#F0B440"/></marker></defs></svg>`;
const svgA=()=>`<svg viewBox="0 0 200 90" aria-hidden="true"><rect x="10" y="50" width="180" height="8" rx="3" fill="#2A3742"/><rect x="118" y="22" width="40" height="40" fill="rgba(127,203,232,.18)"/><path d="M118 22 v40 M158 22 v40" stroke="#7FCBE8" stroke-dasharray="3 3"/><path d="M138 46 v-26" stroke="#71CC93" stroke-width="3"/><path d="M132 24 l6 -8 l6 8z" fill="#71CC93"/><text x="16" y="80" fill="#8B99A7" font-size="9.5" font-family="sans-serif">${L({en:'fast air → more lift → roll',no:'rask luft → mer løft → rull'})}</text><text x="96" y="16" fill="#71CC93" font-size="10" font-weight="600" font-family="sans-serif">${L({en:'+ lift',no:'+ løft'})}</text></svg>`;
const svgS=()=>`<svg viewBox="0 0 200 90" aria-hidden="true"><path d="M20 45 C40 15 55 75 75 45 S110 15 128 45 S160 70 172 42" fill="none" stroke="#B9A6F0" stroke-width="2"/><rect x="172" y="22" width="8" height="40" fill="#D7E1E6"/><path d="M162 44 l10 -2 l-6 8z" fill="#B9A6F0"/><circle cx="20" cy="45" r="9" fill="none" stroke="#E46BAE" stroke-width="2"/><text x="10" y="82" fill="#8B99A7" font-size="9.5" font-family="sans-serif">${L({en:'left engine’s spiral hits the fin from the left',no:'spiralen fra venstre motor treffer finnen fra venstre'})}</text></svg>`;
const svgT=()=>`<svg viewBox="0 0 200 90" aria-hidden="true"><circle cx="100" cy="45" r="24" fill="none" stroke="#2A3742" stroke-width="2"/><path d="M100 21 A24 24 0 0 1 124 45" fill="none" stroke="#E46BAE" stroke-width="2.4"/><path d="M124 45 l-5 -8 l9 0z" fill="#E46BAE"/><path d="M58 60 A44 44 0 0 1 72 18" fill="none" stroke="#F0B440" stroke-width="2.4"/><path d="M72 18 l-1 9 l-7 -5z" fill="#F0B440"/><text x="130" y="24" fill="#E46BAE" font-size="10" font-family="sans-serif">${L({en:'prop: clockwise',no:'propell: med klokka'})}</text><text x="10" y="82" fill="#F0B440" font-size="10" font-family="sans-serif" font-weight="600">${L({en:'reaction: rolls the aircraft left',no:'reaksjon: ruller flyet til venstre'})}</text></svg>`;
on(()=>{
  el('pfLead').innerHTML=L({en:'On a twin, the <b>critical engine</b> is the one whose failure hurts most: it leaves the biggest yaw and roll, so the highest VMC. With both propellers turning clockwise seen from behind, four effects all point the same way and make the <b>left engine critical</b>. Remember them as <b>PAST</b>.',no:'På et tomotors fly er <b>kritisk motor</b> den som gjør mest skade når den stopper: den etterlater størst gir og rull, og dermed høyest VMC. Når begge propellene går med klokka sett bakfra, peker fire effekter samme vei og gjør <b>venstre motor kritisk</b>. Husk dem som <b>PAST</b>.'});
  const C=[['P',{en:'P-factor',no:'P-faktor'},{en:'At high angle of attack the descending blade (the right-hand side of each disc) meets the air at a bigger angle and gives more thrust. The right engine’s thrust line moves <b>out</b>, the left engine’s moves <b>in</b>. Lose the left engine and the right engine yaws you with the longer arm.',no:'Ved høy angrepsvinkel møter det nedadgående bladet (høyre side av hver propell) lufta med større vinkel og gir mer skyv. Skyvlinjen til høyre motor flytter seg <b>utover</b>, den til venstre motor <b>innover</b>. Mister du venstre motor, girer høyre motor deg med den lengste armen.'},svgP],
   ['A',{en:'Accelerated slipstream',no:'Akselerert slipstrøm'},{en:'The live propeller blows fast air over its part of the wing, so that wing makes more lift and the aircraft rolls toward the dead engine. P-factor puts the centre of that slipstream further out on the right wing: a longer roll arm when the left engine fails.',no:'Den gode propellen blåser rask luft over sin del av vingen, så den vingen lager mer løft og flyet ruller mot den døde motoren. P-faktoren legger sentrum av slipstrømmen lenger ut på høyre vinge: lengre rullarm når venstre motor stopper.'},svgA],
   ['S',{en:'Spiralling slipstream',no:'Spiralslipstrøm'},{en:'The slipstream twists around the fuselage. From the <b>left</b> engine it strikes the fin from the left and yaws the nose left, which <b>helps</b> when the right engine has failed. The right engine’s spiral goes away from the fin, so it gives no help when the left engine fails.',no:'Slipstrømmen vrir seg rundt flykroppen. Fra <b>venstre</b> motor treffer den halefinnen fra venstre og girer nesen til venstre, noe som <b>hjelper</b> når høyre motor har stoppet. Spiralen fra høyre motor går bort fra finnen, så den hjelper ikke når venstre motor stopper.'},svgS],
   ['T',{en:'Torque',no:'Dreiemoment'},{en:'A propeller turning clockwise rolls the aircraft the other way, to the left. With the left engine failed, the right engine’s torque adds to the roll toward the dead engine; with the right engine failed it works against it.',no:'En propell som går med klokka ruller flyet motsatt vei, til venstre. Med venstre motor ute legger dreiemomentet fra høyre motor seg til rullen mot den døde motoren; med høyre motor ute virker det mot den.'},svgT]];
  el('past').innerHTML=C.map(([k,t,d,svg])=>`<div class="box"><span class="lt">${k}</span><b class="t">${L(t)}</b>${svg()}<p>${L(d)}</p></div>`).join('');
  el('pfNote').innerHTML=L({en:'Counter-rotating propellers (the left turning clockwise, the right anticlockwise, seen from behind) put both descending blades inboard, so neither engine is critical. P-factor is not asymmetric thrust: it is there with both engines running. It only decides which failure is worst.',no:'Motroterende propeller (venstre med klokka, høyre mot klokka, sett bakfra) legger begge nedadgående blad innenfor, så ingen av motorene er kritisk. P-faktor er ikke asymmetrisk skyv: den er der også med begge motorene i gang. Den avgjør bare hvilken motorstans som er verst.'});
});

/* =====================================================================
   Light twin model
   ===================================================================== */
const T={fail:'L',v:80,phi:5,feather:false,cg:1,pw:1,m:1900,lay:{pf:true,as:false,ss:false,tq:false,rec:true}};
const opt=o=>Object.assign({fail:T.fail,m:T.m,cg:T.cg,phi:T.phi,pw:T.pw,feather:T.feather},o||{});
let C=null;
function calc(){ const o=opt(), P=M.ltPoint(o,T.v), vm=M.ltVmc(o), vmO=M.ltVmc(opt({fail:T.fail==='L'?'R':'L'})), vm0=M.ltVmc(opt({phi:0}));
  C={o,P,vm,vmO,vm0,ok:vm==null?false:T.v>=vm-1e-6,vs:P.vs}; }

/* geometry, metres: x = right wing, y = forward */
const G={ye:LT.ye,R:LT.R,yProp:2.45,yFin:-4.85,cg0:0.3};
const fusel=[[0,4.5],[0.34,4.1],[0.6,3.1],[0.66,1.4],[0.62,-0.6],[0.42,-3.0],[0.14,-5.25]];
const TW={wing:[[-5.9,0.82],[-0.6,1.05],[0.6,1.05],[5.9,0.82],[5.9,-0.25],[0.6,-0.72],[-0.6,-0.72],[-5.9,-0.25]],
  ailL:[[-5.9,-0.25],[-3.6,-0.46],[-3.6,-0.1],[-5.9,0.06]], ailR:[[5.9,-0.25],[3.6,-0.46],[3.6,-0.1],[5.9,0.06]],
  tail:[[-2.25,-4.25],[2.25,-4.25],[2.25,-4.95],[-2.25,-4.95]].map((p,i)=>[p[0],p[1]+(i<2?-Math.abs(p[0])*0.1:-Math.abs(p[0])*0.03)]),
  stripe:[[-0.07,2.4],[0.07,2.4],[0.07,-4.0],[-0.07,-4.0]]};
const TG={cx:NaN,cy:NaN,sc:NaN,ps:NaN,list:[],i:0};
function top(st,g,box,ps){
  const P=C.P, liveR=P.live==='R', sl=liveR?1:-1, n=narrow(st), fs=n?10:11;
  const sc=Math.min(box.w/14.2,box.h/15.4), cx=box.x+box.w/2, cy=box.y+box.h*0.47;
  const c=Math.cos(ps*D2R), s=Math.sin(ps*D2R);
  const X=(x,y)=>[cx+sc*(x*c+y*s), cy-sc*(-x*s+y*c)];
  const poly=(pts,fill,stroke,lw)=>{ g.beginPath(); pts.forEach((p,i)=>{ const q=X(p[0],p[1]); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); }); g.closePath(); if(fill){ g.fillStyle=fill; g.fill(); } if(stroke){ g.strokeStyle=stroke; g.lineWidth=lw||1; g.stroke(); } };
  const ln=(a,b,col,w,dash)=>{ const p=X(a[0],a[1]), q=X(b[0],b[1]); g.strokeStyle=col; g.lineWidth=w||1; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.stroke(); g.setLineDash([]); };
  const ar=(a,b,col,w,h)=>{ const p=X(a[0],a[1]), q=X(b[0],b[1]); arrow(g,p[0],p[1],q[0],q[1],col,w,h); return q; };
  /* shaded paint in the CG lab's visual language; gradients cached while the view does not move */
  const hit=TG.cx===cx&&TG.cy===cy&&TG.sc===sc&&TG.ps===ps; if(!hit){ TG.cx=cx; TG.cy=cy; TG.sc=sc; TG.ps=ps; TG.list.length=0; } TG.i=0;
  const gr=(x0,y0,x1,y1,a,m,b)=>{ if(hit&&TG.i<TG.list.length) return TG.list[TG.i++]; const p0=X(x0,y0), p1=X(x1,y1), q=g.createLinearGradient(p0[0],p0[1],p1[0],p1[1]); q.addColorStop(0,a); if(m) q.addColorStop(0.5,m); q.addColorStop(1,b); TG.list[TG.i++]=q; return q; };
  const EDGE='rgba(30,44,56,.65)';
  const tx=(t,x,y,o)=>{ const p=X(x,y); txt(g,t,p[0]+(o.dx||0),p[1]+(o.dy||0),Object.assign({size:fs,bg:BG},o)); };
  // flight path (straight, heading held) and relative wind with sideslip
  const fp=X(0,9), fq=X(0,-7.5); g.strokeStyle='rgba(127,203,232,.16)'; g.setLineDash([5,7]); g.lineWidth=1; g.beginPath(); g.moveTo(cx,box.y+4); g.lineTo(cx,box.y+box.h-4); g.stroke(); g.setLineDash([]);
  // accelerated slipstream over the live wing
  const xl=sl*G.ye, xT=xl+P.e;
  // wing
  poly(TW.wing,gr(0,1.05,0,-0.72,'#F2F5F8',null,'#A9B5BF'),EDGE,1);
  poly(TW.ailL,'#98A5B0',EDGE,0.8);poly(TW.ailR,'#98A5B0',EDGE,0.8);
  if(T.lay.as){ const xc=xl+P.e*0.9; g.save(); const gr=g.createLinearGradient(...X(0,G.yProp),...X(0,-1.6)); gr.addColorStop(0,'rgba(127,203,232,.30)'); gr.addColorStop(1,'rgba(127,203,232,.04)'); poly([[xc-G.R*0.95,G.yProp],[xc+G.R*0.95,G.yProp],[xc+G.R*1.05,-1.6],[xc-G.R*1.05,-1.6]],gr); g.restore();
    tx(L({en:'+ lift',no:'+ løft'}),xc+sl*1.25,-1.15,{col:I.green,al:'center',w:700}); }
  // tailplane
  poly(TW.tail,gr(0,-4.25,0,-5.0,'#EEF2F5',null,'#A9B5BF'),EDGE,1);
  // fuselage
  const fu=fusel.concat(fusel.slice().reverse().map(p=>[-p[0],p[1]]));
  poly(fu,gr(-0.7,0,0.7,0,'#A9B5BF','#F6F8FA','#A9B5BF'),EDGE,1.1);
  poly(TW.stripe,'rgba(228,107,174,.9)');
  poly([[-0.42,3.4],[0.42,3.4],[0.55,2.5],[-0.55,2.5]],gr(0,3.4,0,2.5,'#3E6380',null,'#16283A'),'rgba(226,232,238,.6)',0.8);
  // nacelles
  for(const sx of [-1,1]){ const x=sx*G.ye; poly([[x-0.34,2.25],[x+0.34,2.25],[x+0.38,0.4],[x+0.22,-1.5],[x-0.22,-1.5],[x-0.38,0.4]],gr(x-0.38,0,x+0.38,0,'#9EAAB4','#EEF2F5','#9EAAB4'),EDGE,1); const sp=X(x,2.38); g.fillStyle='#D7E1E6'; g.beginPath(); g.arc(sp[0],sp[1],Math.max(2,sc*0.14),0,7); g.fill(); }
  // fin and rudder
  const dr=T.lay.rec?clamp(P.dreq,0,LT.dmax):0;
  poly([[-0.09,-3.6],[0.09,-3.6],[0.11,-5.1],[-0.11,-5.1]],'#1D3A5C','rgba(226,232,238,.7)',0.8);
  const rd=sl*dr*D2R; poly([[-0.07,-5.1],[0.07,-5.1],[0.07*Math.cos(rd)+Math.sin(rd)*0.75*1,-5.1-0.75*Math.cos(rd)],[-0.07*Math.cos(rd)+Math.sin(rd)*0.75,-5.1-0.75*Math.cos(rd)]],I.cyan);
  // propellers: edge-on blades seen from above (projected length R·|cos θ|), descending half highlighted
  const t=RT.t;
  for(const sx of [-1,1]){ const x=sx*G.ye, live=(sx===sl), th=live?RT.live:RT.dead;
    const dis=X(x-G.R,G.yProp), dis2=X(x+G.R,G.yProp); g.strokeStyle='rgba(215,225,230,.18)'; g.lineWidth=Math.max(2,sc*0.1); g.beginPath(); g.moveTo(dis[0],dis[1]); g.lineTo(dis2[0],dis2[1]); g.stroke();
    if(T.lay.pf&&live){ const a=X(x,G.yProp), b=X(x+G.R,G.yProp); g.strokeStyle='rgba(240,180,64,.85)'; g.lineWidth=Math.max(3,sc*0.16); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); }
    const feath=!live&&T.feather;
    const bl=feath?0.12:Math.abs(Math.cos(th))*G.R; const ang=feath?0:th;
    ln([x-bl,G.yProp],[x+bl,G.yProp],live?I.white:(feath?'#8B99A7':'#C9D3DA'),Math.max(2.2,sc*0.12));
    if(feath){ for(const k of [-1,1]) ln([x+k*0.05,G.yProp+0.0],[x+k*0.05,G.yProp-0.02],'#8B99A7',2); }
    if(!live){ const p=X(x,G.yProp+1.0); txt(g,feath?L({en:'DEAD · feathered',no:'DØD · fløyet'}):L({en:'DEAD · windmilling',no:'DØD · vindmølle'}),p[0],p[1],{col:I.red,al:'center',size:fs-1,mono:1,bg:BG}); }
  }
  // spiralling slipstream of the live engine
  if(T.lay.ss){ g.strokeStyle='rgba(185,166,240,.85)'; g.lineWidth=1.8; g.beginPath();
    const N=80; for(let i=0;i<=N;i++){ const f=i/N, y=G.yProp-0.3-f*(liveR?6.6:6.9), amp=0.45*(1-f*0.3), ph=f*14-t*6;
      const xc=liveR? xl+f*f*1.6 : xl*(1-f*0.98); const q=X(xc+amp*Math.sin(ph),y); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); }
    g.stroke(); if(!liveR){ ar([-0.9,-4.1],[-0.16,-4.4],I.violet,2,7); tx(L({en:'hits the fin from the left: helps',no:'treffer finnen fra venstre: hjelper'}),-0.5,-6.0,{col:I.violet,al:'right',size:fs-1}); }
    else tx(L({en:'spirals away from the fin: no help',no:'spiraler bort fra finnen: hjelper ikke'}),3.4,-4.9,{col:I.violet,al:'center',size:fs-1}); }
  // thrust of the live engine along its (offset) thrust line
  const k=0.95e-3; // m per N
  ln([xT,-1.9],[xT,G.yProp+P.T*k+0.4],'rgba(228,107,174,.45)',1,[4,4]);
  const tq=ar([xT,G.yProp+0.15],[xT,G.yProp+0.15+P.T*k],I.mag,3.2,10);
  txt(g,'T '+nf(P.T/1000,1)+' kN',tq[0]+(sl>0?10:-10),tq[1]+34,{col:I.mag,al:sl>0?'left':'right',size:fs,bg:BG});
  // thrust arm from the centreline
  const ya=-2.6; ln([0,ya],[xT,ya],I.mag,1.2,[3,3]); ln([xT,ya-0.18],[xT,ya+0.18],I.mag,1.2);
  tx(L({en:'arm ',no:'arm '})+nf(Math.abs(xT),2)+' m',xT/2,ya-0.45,{col:I.mag,al:'center',size:fs-1,mono:1});
  if(T.lay.pf){ const p=X(xT,G.yProp+0.05); g.fillStyle=I.amber; g.beginPath(); g.arc(p[0],p[1],3.5,0,7); g.fill();
    tx((P.e>=0?'e +':'e ')+nf(P.e,2)+' m',xl+G.R*0.55,G.yProp-0.6,{col:I.amber,al:'center',size:fs-1,mono:1}); }
  // drag of the dead propeller
  const xd=-sl*G.ye; if(P.D>5){ const dq=ar([xd,G.yProp-0.05],[xd,G.yProp-0.05-Math.max(0.25,P.D*k*1.0)],I.red,2.6,8); txt(g,'D '+nf(P.D/1000,2)+' kN',dq[0]+(sl>0?-8:8),dq[1]+4,{col:I.red,al:sl>0?'right':'left',size:fs-1,bg:BG}); }
  // CG
  const ycg=G.cg0-T.cg*LT.cgRange, cgp=X(0,ycg); g.fillStyle=I.bg; g.strokeStyle=I.white; g.lineWidth=1.6; g.beginPath(); g.arc(cgp[0],cgp[1],4.5,0,7); g.fill(); g.stroke();
  g.fillStyle=I.white; g.beginPath(); g.moveTo(cgp[0],cgp[1]); g.arc(cgp[0],cgp[1],4.5,0,Math.PI/2); g.lineTo(cgp[0],cgp[1]); g.arc(cgp[0],cgp[1],4.5,Math.PI,Math.PI*1.5); g.fill();
  // recovery: fin force toward the dead engine, its arm to the CG
  if(T.lay.rec){ const Yr=Math.min(P.Yr,P.Ymax); if(Yr>20){ const fq2=ar([0,G.yFin-0.3],[-sl*(0.25+Yr*k*1.6),G.yFin-0.3],I.cyan,3,9); txt(g,L({en:'fin ',no:'finne '})+nf(Yr/1000,2)+' kN',fq2[0]+(sl>0?-6:6),fq2[1]+15,{col:I.cyan,al:sl>0?'right':'left',size:fs,bg:BG}); }
    const xa=-sl*0.95; ln([xa,ycg],[xa,G.yFin],I.cyan,1.1,[3,4]); ln([xa-0.15,ycg],[xa+0.15,ycg],I.cyan,1.1); ln([xa-0.15,G.yFin],[xa+0.15,G.yFin],I.cyan,1.1);
    tx('lv '+nf(P.lv,2)+' m',xa-sl*0.25,(ycg+G.yFin)/2,{col:I.cyan,al:sl>0?'right':'left',size:fs-1,mono:1}); }
  // yaw arcs at the nose
  const nose=X(0,5.4), r0=sc*1.15;
  const yawArc=(dir,col,frac,lab,off)=>{ if(frac<0.02) return; const a0=-Math.PI/2-ps*D2R*0, sweep=dir*clamp(frac,0.05,1)*0.9; const rr=r0+off;
    g.strokeStyle=col; g.lineWidth=2.4; g.beginPath(); g.arc(nose[0],nose[1]+rr,rr,a0,a0+sweep,sweep<0); g.stroke();
    const ae=a0+sweep, ex=nose[0]+rr*Math.cos(ae), ey=nose[1]+rr+rr*Math.sin(ae), tg=ae+(sweep>0?Math.PI/2:-Math.PI/2);
    arrow(g,ex-Math.cos(tg)*2,ey-Math.sin(tg)*2,ex+Math.cos(tg)*6,ey+Math.sin(tg)*6,col,2,8);
    if(lab) txt(g,lab,ex+(dir>0?10:-10),ey+4,{col,al:dir>0?'left':'right',size:fs-1,bg:BG}); };
  const big=Math.max(P.Nreq,P.Nav)||1;
  yawArc(-sl,I.mag,P.Nreq/big,L({en:'yaw: engines',no:'gir: motorer'}),0);
  if(T.lay.rec) yawArc(sl,I.cyan,Math.min(P.Nreq,P.Nav)/big,L({en:'rudder',no:'ror'}),0);
}

function behind(st,g,box){
  const P=C.P, liveR=P.live==='R', sl=liveR?1:-1, n=narrow(st), fs=n?10:11;
  const sc=Math.min(box.w/12.2,box.h/(n?7.4:6.6)), cx=box.x+box.w/2, cy=box.y+box.h*(n?0.43:0.47);
  const ph=sl*T.phi*D2R; // screen rotation: right wing down = clockwise
  const c=Math.cos(ph), s=Math.sin(ph);
  const B=(x,z)=>[cx+sc*(x*c-z*s), cy-sc*(x*s+z*c)];
  // horizon (level), sky gradient band
  txt(g,L({en:'From behind',no:'Bakfra'}),box.x+8,box.y+16,{col:I.mute,size:fs,mono:1});
  const seg=(a,b,col,w)=>{ const p=B(a[0],a[1]), q=B(b[0],b[1]); g.strokeStyle=col; g.lineWidth=w; g.lineCap='round'; g.beginPath(); g.moveTo(p[0],p[1]); g.lineTo(q[0],q[1]); g.stroke(); g.lineCap='butt'; };
  // tailplane and fin
  seg([-2.25,0.55],[2.25,0.55],'#AEB9C2',Math.max(2,sc*0.12));
  seg([0,0.5],[0,2.1],'#1D3A5C',Math.max(2.5,sc*0.16)); seg([0,0.5],[0,2.1],'rgba(226,232,238,.35)',1);
  // wings (low wing, slight dihedral)
  seg([-5.9,-0.05],[0,-0.42],'#C9D3DA',Math.max(3,sc*0.2)); seg([0,-0.42],[5.9,-0.05],'#C9D3DA',Math.max(3,sc*0.2));
  seg([-5.9,-0.05],[0,-0.42],'rgba(255,255,255,.55)',Math.max(1,sc*0.05)); seg([0,-0.42],[5.9,-0.05],'rgba(255,255,255,.55)',Math.max(1,sc*0.05));
  // accelerated slipstream: extra lift on the live wing
  if(T.lay.as){ const xa=sl*G.ye+P.e; const a=B(xa,-0.2), b=B(xa-0*s,1.6); const L1=B(xa,0.1), L2=B(xa,1.5); arrow(g,L1[0],L1[1],L2[0],L2[1],I.green,2.6,9); txt(g,L({en:'+ lift',no:'+ løft'}),L2[0]+sl*8,L2[1]+12,{col:I.green,al:sl>0?'left':'right',size:fs-1,bg:BG}); }
  // fuselage
  const fc=B(0,0); g.fillStyle='#E3E9EE'; g.strokeStyle='rgba(30,44,56,.7)'; g.lineWidth=1.2; g.beginPath(); g.arc(fc[0],fc[1],sc*0.68,0,7); g.fill(); g.stroke();
  g.fillStyle='rgba(138,152,164,.55)'; g.beginPath(); g.arc(fc[0],fc[1],sc*0.68,0.15*Math.PI+ph,0.85*Math.PI+ph); g.closePath(); g.fill();
  { const cp=B(0,0.38); g.fillStyle='#22405A'; g.beginPath(); g.arc(cp[0],cp[1],sc*0.34,Math.PI+ph,2*Math.PI+ph); g.closePath(); g.fill(); }
  // nacelles + propellers (clockwise from behind = clockwise on screen)
  for(const sx of [-1,1]){ const x=sx*G.ye, live=sx===sl, nc=B(x,-0.1); g.fillStyle='#C9D3DA'; g.beginPath(); g.arc(nc[0],nc[1],sc*0.36,0,7); g.fill();
    g.strokeStyle=live?'rgba(215,225,230,.22)':'rgba(236,90,71,.25)'; g.lineWidth=1; g.beginPath(); g.arc(nc[0],nc[1],sc*G.R,0,7); g.stroke();
    if(T.lay.pf&&live){ g.fillStyle='rgba(240,180,64,.16)'; g.beginPath(); g.moveTo(nc[0],nc[1]); g.arc(nc[0],nc[1],sc*G.R,-Math.PI/2+ph,Math.PI/2+ph); g.closePath(); g.fill();
      txt(g,L({en:'↓ descending blade',no:'↓ nedadgående blad'}),nc[0]+sc*G.R*0.4,nc[1]+sc*G.R+14,{col:I.amber,al:'center',size:fs-1.5,bg:BG}); }
    const feath=!live&&T.feather, th=(live?RT.live:RT.dead)+ph;
    for(const k of [0,Math.PI]){ const a=th+k; g.strokeStyle=live?I.white:(feath?'#8B99A7':'#C9D3DA'); g.lineWidth=feath?2:Math.max(2.5,sc*0.13); g.lineCap='round'; g.beginPath(); g.moveTo(nc[0],nc[1]); g.lineTo(nc[0]+Math.cos(a)*sc*G.R*0.95,nc[1]+Math.sin(a)*sc*G.R*0.95); g.stroke(); g.lineCap='butt'; }
    // rotation arrow
    if(live||!feath){ const rr=sc*G.R*1.12; g.strokeStyle=live?'rgba(228,107,174,.8)':'rgba(236,90,71,.6)'; g.lineWidth=1.4; g.beginPath(); g.arc(nc[0],nc[1],rr,-2.2,-1.2); g.stroke(); const ex=nc[0]+rr*Math.cos(-1.2), ey=nc[1]+rr*Math.sin(-1.2); arrow(g,ex-3,ey-3,ex+3,ey+2,live?I.mag:I.red,1.4,6); }
  }
  // torque reaction (rolls left)
  if(T.lay.tq){ const rr=sc*1.55; g.strokeStyle=I.amber; g.lineWidth=2.2; g.beginPath(); g.arc(fc[0],fc[1],rr,-Math.PI*0.95,-Math.PI*0.55); g.stroke();
    const a=-Math.PI*0.95, ex=fc[0]+rr*Math.cos(a), ey=fc[1]+rr*Math.sin(a); arrow(g,ex+4,ey-6,ex-1,ey+5,I.amber,2.2,8);
    txt(g,L({en:'torque reaction',no:'reaksjonsmoment'}),fc[0]-rr*0.8,fc[1]-rr-6,{col:I.amber,al:'center',size:fs-1,bg:BG}); }
  // forces: weight, lift and its horizontal part (×4), fin force
  if(T.lay.rec){ const Wl=2.6, wd=[fc[0],fc[1]+sc*Wl]; arrow(g,fc[0],fc[1],wd[0],wd[1],I.white,2.2,8); txt(g,'W',wd[0]+6,wd[1],{col:I.white,size:fs,bg:BG});
    const Lt=B(0,Wl); arrow(g,fc[0],fc[1],Lt[0],Lt[1],I.white,2.6,9); txt(g,'L',Lt[0]+(sl>0?-14:8),Lt[1]+4,{col:I.ink,size:fs,bg:BG});
    if(T.phi>0.2){ const hx=Lt[0]+sl*sc*Wl*Math.sin(T.phi*D2R)*4; arrow(g,Lt[0],Lt[1],hx,Lt[1],I.green,2.4,8); txt(g,'L·sin φ ×4',hx+(sl>0?6:-6),Lt[1]+4,{col:I.green,al:sl>0?'left':'right',size:fs-1,bg:BG}); }
    const fp=B(0,1.45), Yr=Math.min(P.Yr,P.Ymax); if(Yr>20){ const fx=fp[0]-sl*sc*Yr*0.0011*1.6; arrow(g,fp[0],fp[1],fx,fp[1],I.cyan,2.4,8); txt(g,L({en:'fin',no:'finne'}),fx+(sl>0?-6:6),fp[1]+4,{col:I.cyan,al:sl>0?'right':'left',size:fs-1,bg:BG}); } }
  // bank readout + inclinometer (ball)
  txt(g,'φ '+nf(T.phi,1)+'° '+L({en:'toward live',no:'mot god'}),n?box.x+8:box.x+box.w-8,n?box.y+31:box.y+16,{col:I.green,al:n?'left':'right',size:fs,mono:1});
  const bw=Math.min(box.w*0.5,170), bx=cx-bw/2, by=Math.min(box.y+box.h-(n?34:24),cy+sc*3.4), bh=16;
  g.fillStyle='#18232C'; g.strokeStyle='#2A3742'; g.lineWidth=1; g.beginPath(); g.roundRect?g.roundRect(bx,by,bw,bh,8):g.rect(bx,by,bw,bh); g.fill(); g.stroke();
  const ballW=bh-3; g.strokeStyle='#5E6D7C'; for(const k of [-1,1]){ g.beginPath(); g.moveTo(cx+k*(ballW/2+1.5),by+1); g.lineTo(cx+k*(ballW/2+1.5),by+bh-1); g.stroke(); }
  const off=clamp(T.phi/10,0,1.6)*sl*ballW; g.fillStyle='#EEF3F7'; g.beginPath(); g.arc(cx+off,by+bh/2,ballW/2,0,7); g.fill();
  txt(g,L({en:'roll to the dead side ',no:'rull mot død side '})+kNm(P.Lroll),cx,by+bh+17,{col:I.mute,al:'center',size:fs-1.5,mono:1}); txt(g,L({en:'held with aileron',no:'holdes med balanseror'}),cx,by+bh+31,{col:I.dim,al:'center',size:fs-1.5,mono:1});
  txt(g,T.phi>0.2?L({en:'ball ',no:'kula '})+nf(T.phi/10,1)+L({en:' width toward the live engine',no:' bredde mot god motor'}):L({en:'ball centred',no:'kula i midten'}),cx,by-6,{col:I.mute,al:'center',size:fs-1.5,mono:1});
}

const RT={t:0,live:0,dead:0,ps:0,last:0};
const ltS=LAB.fit(el('ltCv'),()=>drawLT(),2);
function drawLT(){ const st=ltS; if(!st.w||!C) return; const g=S.clear(st), W=st.w, H=st.h, n=narrow(st);
  let a,b; if(n){ a={x:4,y:4,w:W-8,h:H*0.56}; b={x:4,y:H*0.56,w:W-8,h:H*0.44-4}; } else { a={x:6,y:6,w:W*0.55,h:H-12}; b={x:W*0.55+6,y:6,w:W*0.45-12,h:H-12}; }
  g.strokeStyle='#1F2B35'; g.lineWidth=1; g.beginPath(); if(n){ g.moveTo(10,b.y); g.lineTo(W-10,b.y); } else { g.moveTo(b.x-3,14); g.lineTo(b.x-3,H-14); } g.stroke();
  top(st,g,a,RT.ps); behind(st,g,b);
  if(!C.ok){ txt(g,L({en:'NOT CONTROLLABLE · heading lost toward the dead engine',no:'IKKE STYRBART · kursen går mot den døde motoren'}),a.x+a.w/2,a.y+a.h-10,{col:I.red,al:'center',size:n?10.5:12,bg:BG,w:700}); }
}
// animation: propellers turn, an uncontrollable aircraft yaws toward the dead engine
let raf=0, vis=false;
function tick(now){ raf=0; const dt=Math.min(0.05,(now-(RT.last||now))/1000); RT.last=now; RT.t+=dt;
  const liveRate=reduce?0:22*(0.6+0.4*T.pw), deadRate=reduce||T.feather?0:9*clamp(T.v/90,0.4,1.3);
  RT.live+=liveRate*dt; RT.dead+=deadRate*dt;
  const tgt=C&&!C.ok?(C.P.live==='R'?-1:1)*clamp(8+(C.vm-T.v)*1.4,8,24):0; RT.ps+=(tgt-RT.ps)*Math.min(1,dt*(reduce?50:1.8));
  drawLT(); if(vis) raf=requestAnimationFrame(tick); }
LAB.visible(el('ltCv'),v=>{ vis=v; if(v&&!raf){ RT.last=0; raf=requestAnimationFrame(tick); } });

/* chart: rudder moment needed vs available against airspeed */
const chS=LAB.fit(el('ltCh'),()=>drawCh(),2);
if(window.CN) CN.add(el('ltCh'),{read:{en:'Across: airspeed. Up: yawing moment. Pink is the turn the dead engine forces on you; blue is what full rudder can give back.',no:'Bortover: fart. Oppover: girmoment. Rosa er giringen den døde motoren påfører deg; blå er det fullt sideror kan gi tilbake.'},
  take:{en:'Rudder power grows with speed, the engine’s pull does not. Below VMCA (where the lines cross) full rudder is not enough: keep the speed above it.',no:'Rorkraften vokser med farten, motorens drag gjør det ikke. Under VMCA (der linjene krysser) er ikke fullt sideror nok: hold farten over den.'},
  full:()=>drawCh()});
function drawCh(){ const st=chS; if(!st.w||!C) return; const g=S.clear(st), W=st.w, H=st.h, n=narrow(st);
  const box={x:n?40:52,y:24,w:W-(n?52:72),h:H-(n?50:52)}, v0=45, v1=130;
  const o=opt(), oO=opt({fail:T.fail==='L'?'R':'L'}); const pts=[], ptsO=[], av=[]; let ymax=0;
  for(let v=v0;v<=v1;v+=1){ const p=M.ltPoint(o,v), q=M.ltPoint(oO,v); pts.push([v,p.Nreq]); ptsO.push([v,q.Nreq]); av.push([v,p.Nav]); ymax=Math.max(ymax,p.Nreq); }
  ymax=Math.ceil(Math.max(ymax*1.35,12000)/4000)*4000; const step=ymax>24000?8000:4000;
  const yt=[]; for(let y=0;y<=ymax;y+=step) yt.push(y);
  const ax=S.axes(g,box,[v0,v1],[0,ymax],{xt:[50,60,70,80,90,100,110,120,130].filter(x=>!n||x%20===10),yt,yf:v=>nf(v/1000,0)});
  txt(g,L({en:'Yawing moment, kN·m',no:'Girmoment, kN·m'}),box.x,14,{col:I.mute,size:10.5,mono:1});
  txt(g,'KIAS',box.x+box.w,box.y+box.h+(n?26:26),{col:I.mute,al:'right',size:10,mono:1});
  // stall zone
  const xs=ax.X(clamp(C.vs,v0,v1)); g.fillStyle='rgba(236,90,71,.08)'; g.fillRect(box.x,box.y,xs-box.x,box.h);
  txt(g,'VS '+nf(C.vs,0),xs-4,box.y+box.h-6,{col:I.red,al:'right',size:10,mono:1});
  // not-controllable zone
  if(C.vm!=null&&C.vm>v0){ const xv=ax.X(C.vm); g.fillStyle='rgba(228,107,174,.06)'; g.fillRect(box.x,box.y,xv-box.x,box.h); }
  const P=pts.map(p=>[ax.X(p[0]),ax.Y(p[1])]), PO=ptsO.map(p=>[ax.X(p[0]),ax.Y(p[1])]), PA=av.map(p=>[ax.X(p[0]),ax.Y(Math.min(p[1],ymax*1.2))]);
  g.save(); g.beginPath(); g.rect(box.x,box.y,box.w,box.h); g.clip();
  const det=window.CN&&CN.full('ltCh');
  if(det) S.line(g,PO,'rgba(139,153,167,.75)',1.5,[5,4]); S.line(g,PA,I.cyan,2.4); S.line(g,P,I.mag,2.6); g.restore();
  const lab=(pp,t,col,dy)=>{ const p=pp[Math.floor(pp.length*0.86)]; txt(g,t,p[0],p[1]+(dy||-8),{col,al:'right',size:10.5,bg:BG}); };
  lab(P,L({en:'rudder moment needed · ',no:'rormoment som trengs · '})+(T.fail==='L'?L({en:'left failed',no:'venstre ute'}):L({en:'right failed',no:'høyre ute'})),I.mag,-8);
  if(det) lab(PO,L({en:'other engine failed',no:'den andre motoren ute'}),I.mute,14);
  const pa=n?[PA[Math.min(PA.length-1,55)][0]+14,PA[Math.min(PA.length-1,55)][1]+10]:(PA.find(p=>p[1]<=box.y+18)||PA[PA.length-1]); txt(g,det?L({en:'available ∝ V²',no:'tilgjengelig ∝ V²'}):n?L({en:'rudder available',no:'ror tilgjengelig'}):L({en:'rudder available (grows with speed²)',no:'ror tilgjengelig (vokser med fart²)'}),pa[0]-6,Math.max(box.y+14,pa[1]+4),{col:I.cyan,al:n?'left':'right',size:10.5,bg:BG});
  if(C.vm!=null){ const xv=ax.X(C.vm); S.line(g,[[xv,box.y],[xv,box.y+box.h]],I.mag,1.2,[3,3]); txt(g,'VMCA '+nf(C.vm,0),xv+5,box.y+12,{col:I.mag,size:11,mono:1,bg:BG});
    if(!det){ const fz=n?9.5:10.5, yy=box.y+box.h*(n?0.62:0.58);
      const zl=Math.max(xs,box.x), zw=xv-zl, zl2=zw>(n?66:96)?zl:box.x, zc=(zl2+xv)/2;
      if(xv-zl2>(n?66:96)) [L({en:'rudder can’t',no:'roret klarer'}),L({en:'hold the yaw',no:'ikke å holde'}),...(n?[]:[L({en:'= not controllable',no:'= ikke kontrollerbart'})])].forEach((t,i)=>txt(g,t,zc,yy+i*(fz+3),{col:'#E79BC4',al:'center',size:fz,w:500,bg:BG}));
      if(!n){ const yx=ax.Y(Math.min(M.ltPoint(o,C.vm).Nreq,ymax)); txt(g,L({en:'← here the rudder can no longer hold the yaw',no:'← her klarer ikke roret lenger å holde giringen'}),xv+6,Math.min(box.y+box.h-24,yx+30),{col:I.mag,size:10,w:500,bg:BG}); }
      if(box.x+box.w-xv>110) txt(g,L({en:'rudder wins: controllable',no:'roret vinner: kontrollerbart'}),box.x+box.w-6,box.y+box.h-8,{col:I.green,al:'right',size:fz,w:500}); } }
  const xc=ax.X(clamp(T.v,v0,v1)); S.line(g,[[xc,box.y],[xc,box.y+box.h]],'rgba(238,243,247,.5)',1,[2,3]);
  const p=M.ltPoint(o,T.v); const yc=ax.Y(Math.min(p.Nreq,ymax)); g.fillStyle=C.ok?I.green:I.red; g.beginPath(); g.arc(xc,yc,5,0,7); g.fill(); g.strokeStyle=I.bg; g.lineWidth=1.5; g.stroke();
}

/* controls */
const feS=LAB.seg(el('ltFe'),[['L','Left engine failed'],['R','Right engine failed']],T.fail,v=>{ T.fail=v; all(); });
const ftSeg=LAB.seg(el('ltFt'),[['w','Windmilling'],['f','Feathered']],'w',v=>{ T.feather=v==='f'; all(); });
const sl=o=>LAB.slider(el('ltCtl'),o), sl2=o=>LAB.slider(el('ltCtl2'),o);
const S_v=sl({label:'Indicated airspeed (KIAS)',min:50,max:125,step:1,v:T.v,f:v=>v+' kt',on:v=>{ T.v=v; all(); }});
const S_p=sl({label:'Bank (° toward the live engine)',min:0,max:5,step:0.5,v:T.phi,f:v=>nf(v,1)+'°',on:v=>{ T.phi=v; all(); }});
const S_w=sl2({label:'Power on the live engine (%)',min:40,max:100,step:5,v:T.pw*100,f:v=>v+' %',on:v=>{ T.pw=v/100; all(); }});
const S_c=sl2({label:'CG position',min:0,max:100,step:5,v:T.cg*100,f:v=>v<=0?L({en:'fwd limit',no:'fremre grense'}):v>=100?L({en:'aft limit',no:'bakre grense'}):v+' %',on:v=>{ T.cg=v/100; all(); },hint:'Aft CG = shorter arm to the fin'});
// layers
const LAY=[['pf',{en:'P-factor',no:'P-faktor'}],['as',{en:'Slipstream',no:'Slipstrøm'}],['ss',{en:'Spiral',no:'Spiral'}],['tq',{en:'Torque',no:'Dreiemoment'}],['rec',{en:'Recovery',no:'Gjenoppretting'}]];
function drawLay(){ el('ltLay').innerHTML=LAY.map(([k,t])=>`<button class="xtog${T.lay[k]?' on':''}" type="button" data-k="${k}" aria-pressed="${!!T.lay[k]}">${L(t)}</button>`).join(''); }
el('ltLay').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; T.lay[b.dataset.k]=!T.lay[b.dataset.k]; drawLay(); drawLT(); });
// presets
const PRE=[['crit',{en:'Left engine fails',no:'Venstre motor stopper'},{fail:'L',v:80,phi:5,feather:false,cg:1,pw:1}],
  ['right',{en:'Right engine fails',no:'Høyre motor stopper'},{fail:'R',v:80,phi:5,feather:false,cg:1,pw:1}],
  ['level',{en:'Wings level',no:'Vingene vannrett'},{fail:'L',v:80,phi:0,feather:false,cg:1,pw:1}],
  ['slow',{en:'Too slow',no:'For sakte'},{fail:'L',v:68,phi:5,feather:false,cg:1,pw:1}],
  ['fix',{en:'Recover: feather, 5° bank',no:'Gjenopprett: fløy, 5° krengning'},{fail:'L',v:85,phi:5,feather:true,cg:1,pw:1}],
  ['fwd',{en:'Forward CG',no:'Fremre CG'},{fail:'L',v:80,phi:5,feather:false,cg:0,pw:1}]];
let curPre='crit';
function drawPre(){ el('ltPre').innerHTML=PRE.map(([k,t])=>`<button class="btn sm${k===curPre?' on':''}" type="button" data-k="${k}">${L(t)}</button>`).join(''); }
function setLT(o,k){ Object.assign(T,o); curPre=k||null; S_v.set(T.v); S_p.set(T.phi); S_w.set(T.pw*100); S_c.set(T.cg*100); ftSeg.set(T.feather?'f':'w');
  feS.set(T.fail); all(); }
el('ltPre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const p=PRE.find(x=>x[0]===b.dataset.k); if(p) setLT(Object.assign({},p[2]),p[0]); });

function read(){ const P=C.P, lv=P.live==='R';
  const kp=(a)=>`<div class="kpi"><span>${L(a[0])}</span><b class="${a[2]||''}">${a[1]}</b>${a[3]?`<small>${L(a[3])}</small>`:''}</div>`;
  el('ltK').innerHTML=[
    [{en:'At this speed',no:'Ved denne farten'},`<span class="stat ${C.ok?'ok':'ko'}">${C.ok?L({en:'Controllable',no:'Styrbart'}):L({en:'Not controllable',no:'Ikke styrbart'})}</span>`,'', C.ok?{en:`rudder ${nf(P.dreq,0)}° of ${LT.dmax}°`,no:`ror ${nf(P.dreq,0)}° av ${LT.dmax}°`}:{en:'full rudder is not enough',no:'fullt ror er ikke nok'}],
    [{en:'VMCA, this set-up',no:'VMCA, dette oppsettet'},kt(C.vm),'hl',{en:`${T.fail==='L'?'left':'right'} engine failed`,no:`${T.fail==='L'?'venstre':'høyre'} motor ute`}],
    [{en:'VMCA, other engine failed',no:'VMCA, den andre motoren ute'},kt(C.vmO),'',{en:C.vmO!=null&&C.vm!=null?(C.vm>C.vmO?'lower: this one is critical':'higher: the other is critical'):'',no:C.vmO!=null&&C.vm!=null?(C.vm>C.vmO?'lavere: denne er kritisk':'høyere: den andre er kritisk'):''}],
    [{en:'Stall speed (1 g)',no:'Steilefart (1 g)'},kt(C.vs),C.vm!=null&&C.vm<C.vs?'warn':'',C.vm!=null&&C.vm<C.vs?{en:'VMCA below the stall: stall comes first',no:'VMCA under steilefarten: steiling kommer først'}:{en:`clean, ${nf(T.m,0)} kg`,no:`rent, ${nf(T.m,0)} kg`}]].map(kp).join('');
  const mx=Math.max(P.Neng,P.Nreq,P.Nav)*1.05;
  const bar=(lab,v,cls)=>`<div><span>${L(lab)}</span><i class="${cls||''}"><u style="width:${clamp(v/mx*100,0,100)}%"></u></i></div>`;
  el('ltBal').innerHTML=bar({en:'Engines',no:'Motorer'},P.Neng,'ko')+bar({en:'Rudder needed',no:'Ror som trengs'},Math.max(0,P.Nreq))+bar({en:'Rudder available',no:'Tilgjengelig ror'},P.Nav,'av');
  const rows=[
    [{en:'Live-engine thrust',no:'Skyv, god motor'},kN(P.T)],
    [{en:'Thrust arm (P-factor offset)',no:'Skyvarm (P-faktorforskyvning)'},nf(P.armT,2)+' m ('+(lv?'+':'−')+nf(P.e,2)+')'],
    [{en:'Dead propeller drag',no:'Motstand, død propell'},kN(P.D)+' · '+(T.feather?L({en:'feathered',no:'fløyet'}):L({en:'windmilling',no:'vindmølle'}))],
    [{en:'Engine yawing moment',no:'Girmoment fra motorene'},kNm(P.Neng)],
    [{en:'Rudder moment needed / available',no:'Rormoment som trengs / tilgjengelig'},kNm(Math.max(0,P.Nreq))+' / '+kNm(P.Nav),P.Nreq>P.Nav?'bad':''],
    [{en:'Sideslip β',no:'Sideslip β'},nf(Math.abs(P.beta),1)+'° '+(Math.abs(P.beta)<0.5?'':P.beta<0?L({en:'from the dead side',no:'fra død side'}):L({en:'from the live side',no:'fra god side'}))],
    [{en:'Bank for zero sideslip',no:'Krengning for null sideslip'},nf(P.phi0,1)+'°'],
    [{en:'Roll toward the dead engine',no:'Rull mot den døde motoren'},kNm(P.Lroll)+(T.lay.as||T.lay.tq?'':''),''],
  ];
  const rr=r=>`<div class="rrow"><span>${L(r[0])}</span><b class="${r[2]||''}">${r[1]}</b></div>`;
  el('ltR').innerHTML=[rows[3],rows[4],rows[5]].map(rr).join('')+`<div class="deep">${[rows[0],rows[1],rows[2],rows[6],rows[7]].map(rr).join('')}</div>`;
  { const H2=(k,v,c,hx)=>`<span${hx?' class="hx"':''}><i>${k}</i><b${c?` class="${c}"`:''}>${v}</b></span>`;
    el('ltOv').innerHTML=H2(L({en:'Failed',no:'Ute'}),T.fail==='L'?L({en:'LEFT engine',no:'VENSTRE motor'}):L({en:'RIGHT engine',no:'HØYRE motor'}),'',1)+H2('IAS',nf(T.v,0)+' kt')+H2('φ',nf(T.phi,1)+'°')+H2('VMCA',kt(C.vm),'',1)+H2(L({en:'Status',no:'Status'}),C.ok?L({en:'controllable',no:'styrbart'}):L({en:'not controllable',no:'ikke styrbart'}),C.ok?'g':'r'); }
}
function all(){ calc(); read(); drawLT(); drawCh(); if(curPre&&!PRE.some(p=>p[0]===curPre&&match(p[2]))) curPre=null; drawPre(); if(typeof live==='function') live(); }
const match=o=>Object.keys(o).every(k=>T[k]===o[k]);
on(()=>{
  el('ltLead').innerHTML=L({en:'A light twin of our own design for teaching: 1,900 kg, 200 hp per engine, both propellers turning <b>clockwise seen from behind</b>. Fail an engine, slow down and watch the engine yaw (magenta) grow as the rudder moment (cyan) falls with V². Switch on the layers to see <b>why the left engine is critical</b>, then recover: rudder, <b>5° of bank toward the live engine</b> (ball half out toward it) and <b>feather</b>.',no:'Et lett tomotors fly av eget design til undervisning: 1 900 kg, 200 hk per motor, begge propellene går <b>med klokka sett bakfra</b>. Stopp en motor, senk farten og se giret fra motoren (magenta) vokse mens rormomentet (cyan) faller med V². Slå på lagene for å se <b>hvorfor venstre motor er kritisk</b>, og gjenopprett så: sideror, <b>5° krengning mot den gode motoren</b> (kula en halv bredde ut mot den) og <b>fløying</b>.'});
  const ex=[{en:'<b>Left engine critical:</b> with clockwise propellers, P-factor moves the right engine’s thrust line out (longer arm), the accelerated slipstream centre moves out on the right wing (more roll), the left engine’s spiral would have helped the fin, and torque rolls the aircraft left. All four make losing the left engine worse.',no:'<b>Venstre motor er kritisk:</b> med propeller som går med klokka flytter P-faktoren skyvlinjen til høyre motor utover (lengre arm), sentrum av den akselererte slipstrømmen flytter seg utover på høyre vinge (mer rull), spiralen fra venstre motor ville ha hjulpet finnen, og dreiemomentet ruller flyet til venstre. Alle fire gjør det verre å miste venstre motor.'},
    {en:'<b>Up to 5° of bank toward the live engine lowers VMCA.</b> Lift tilts and its horizontal part, W·sin φ, carries the fin’s side force instead of sideslip. Close to zero sideslip the ball sits about half a width toward the live engine. Wings level the aircraft slips and VMCA in this model rises by about '+'{d0}'+' kt.',no:'<b>Inntil 5° krengning mot den gode motoren senker VMCA.</b> Løftet heller, og den vannrette delen, W·sin φ, tar finnens sidekraft i stedet for sideslip. Nær null sideslip ligger kula omtrent en halv bredde mot den gode motoren. Med vingene vannrett glir flyet, og VMCA i denne modellen øker med omtrent {d0} kt.'},
    {en:'<b>Feather the dead propeller.</b> A windmilling propeller at flat pitch is a disc of drag on the dead side: it adds yaw and costs climb. Feathered, the blades turn edge-on and the drag almost disappears.',no:'<b>Fløy den døde propellen.</b> En propell som vindmøller med fin stigning er en motstandsskive på den døde siden: den gir mer gir og koster stigeevne. Fløyet står bladene med kanten mot vinden, og motstanden nesten forsvinner.'},
    {en:'<b>VMCA (the red radial line) is set with the critical engine windmilling (or feathered if automatic), take-off power, aft CG, up to 5° of bank and maximum take-off mass, or less if that is more critical</b> (CS-23 / FAR 23). Every other condition gives a lower real VMC. Below VMC, reduce power on the live engine and lower the nose.',no:'<b>VMCA (den røde radiallinjen) settes med kritisk motor i vindmølle (eller fløyet hvis automatisk), starteffekt, bakre CG, inntil 5° krengning og maks startmasse, eller mindre hvis det er mer kritisk</b> (CS-23 / FAR 23). Alle andre forhold gir lavere reell VMC. Under VMC: reduser effekten på den gode motoren og senk nesen.'}];
  const d0=C?Math.round((C.vm0||0)-(M.ltVmc(opt({phi:5}))||0)):0;
  el('ltE').innerHTML=`<span class="ct">${L({en:'What the examiner wants you to know',no:'Dette vil sensor at du skal kunne'})}</span><ul>${ex.map(x=>`<li>${L(x).replace('{d0}',String(Math.max(0,d0)))}</li>`).join('')}</ul><p class="a3"><span class="tag lt">${L({en:'Light twin',no:'Lett tomotors'})}</span>${L({en:'Aft CG shortens the fin arm lv. With bank, the weight component then acts with a shorter lever against the fin, so VMCA rises. Wings level, the fin and the sideslip force form a pure couple and CG matters little; that is why certification fixes both the CG and the bank.',no:'Bakre CG gjør finnearmen lv kortere. Med krengning virker vektkomponenten da med kortere arm mot finnen, så VMCA øker. Med vingene vannrett danner finnen og sideslipkraften et rent kraftpar, og CG betyr lite; derfor låser sertifiseringen både CG og krengning.'})}</p>`;
  el('ltJet').innerHTML=`<span class="ct">${L({en:'And on the A320?',no:'Og på A320?'})}</span>`+L({en:'The same balance applies to a jet, but the turbofans hang under the wing far from the centreline, so the arm is longer and the thrust much bigger. There is no P-factor, no propeller slipstream over the wing and almost no torque reaction, so neither engine is critical in the light-twin sense: both failures give practically the same VMCA. A failed turbofan windmills with much less drag than a flat-pitch propeller and cannot be feathered. The A320 lab below works the same sums with a fin of 21.5 m² and 120 kN per engine.',no:'Den samme balansen gjelder et jetfly, men turbofanene henger under vingen langt fra senterlinjen, så armen er lengre og skyvet mye større. Det er ingen P-faktor, ingen propellslipstrøm over vingen og nesten ikke noe reaksjonsmoment, så ingen motor er kritisk på samme måte som på et lett tomotors fly: begge motorstansene gir i praksis samme VMCA. En død turbofan vindmøller med mye mindre motstand enn en propell med fin stigning, og den kan ikke fløyes. A320-labben under regner de samme summene med en finne på 21,5 m² og 120 kN per motor.'});
});

/* =====================================================================
   Propeller as a wing: blade element at 0.75 R
   ===================================================================== */
const B={mode:'fp',rpm:2500,tas:90,beta:24};
const pwS=LAB.fit(el('pwCv'),()=>drawPW(),2);
const aerofoil=(()=>{ const pts=[]; for(let i=0;i<=24;i++){ const x=i/24, t=0.12*5*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x**3-0.1036*x**4), cmb=0.04*(x<0.4?(0.8*x-x*x)/0.16:(0.2+0.8*x-x*x)/0.36); pts.push([x,cmb+t]); } for(let i=24;i>=0;i--){ const x=i/24, t=0.12*5*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x**3-0.1036*x**4), cmb=0.04*(x<0.4?(0.8*x-x*x)/0.16:(0.2+0.8*x-x*x)/0.36); pts.push([x,cmb-t]); } return pts; })();
function bState(){ const o=Object.assign({},B); if(B.mode==='cs'){ const ph=Math.atan2(B.tas*M.KT,Math.max(1e-6,B.rpm*2*Math.PI/60*0.75*LT.R))/D2R; o.beta=clamp(ph+5,8,60); } return Object.assign(M.blade(o),{beta:o.beta}); }
function drawPW(){ const st=pwS; if(!st.w) return; const g=S.clear(st), W=st.w, H=st.h, n=narrow(st), fs=n?10:11.5, b=bState();
  const Ox=W*(n?0.38:0.40), Oy=H*(n?0.64:0.62);
  // plane of rotation and the direction of flight
  g.strokeStyle='#2A3742'; g.lineWidth=1; g.setLineDash([6,6]); g.beginPath(); g.moveTo(10,Oy); g.lineTo(W-10,Oy); g.stroke(); g.setLineDash([]);
  txt(g,L({en:'plane of rotation',no:'rotasjonsplanet'}),12,Oy-6,{col:I.dim,size:fs-1,mono:1});
  arrow(g,24,H-18,24,H-62,I.mute,1.6,7); txt(g,L({en:'flight',no:'flyretning'}),32,H-44,{col:I.mute,size:fs-1,mono:1});
  arrow(g,W-120,H-22,W-60,H-22,I.mute,1.6,7); txt(g,L({en:'blade moves',no:'bladet går'}),W-120,H-30,{col:I.mute,size:fs-1,mono:1});
  // velocity triangle: U (rotation) and V (TAS) → relative wind W
  const vmax=230, k=Math.min(W*(n?0.5:0.44),H*0.7)/vmax;
  const U=b.U*k, V=b.V*k, A=[Ox+U,Oy-V];
  if(U>2){ arrow(g,A[0],A[1],Ox,A[1],I.cyan,1.6,7); txt(g,'U '+nf(b.U/M.KT,0)+' kt',(A[0]+Ox)/2,A[1]-7,{col:I.cyan,al:'center',size:fs-1,mono:1,bg:BG}); }
  if(V>2){ arrow(g,Ox,A[1],Ox,Oy,I.green,1.6,7); txt(g,'V '+nf(B.tas,0)+' kt',Ox-6,(A[1]+Oy)/2,{col:I.green,al:'right',size:fs-1,mono:1,bg:BG}); }
  if(U+V>2){ arrow(g,A[0],A[1],Ox+(A[0]-Ox)*0.06,Oy+(A[1]-Oy)*0.06,I.white,2.6,10); txt(g,L({en:'relative wind',no:'relativ vind'}),A[0]+6,A[1]-4,{col:I.white,size:fs,bg:BG}); }
  // blade section, chord at β above the plane of rotation, leading edge toward the motion (right) and forward (up)
  const ch=Math.min(W,H)*(n?0.34:0.3), be=b.beta*D2R;
  const Pc=([x,y])=>{ const u=(0.25-x)*ch, v=y*ch; return [Ox+u*Math.cos(be)-v*Math.sin(be), Oy-(u*Math.sin(be)+v*Math.cos(be))]; };
  g.beginPath(); aerofoil.forEach((p,i)=>{ const q=Pc(p); i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); }); g.closePath(); g.fillStyle='#8B99A7'; g.fill(); g.strokeStyle='#D7E1E6'; g.lineWidth=1; g.stroke();
  // chord line extended
  const c0=Pc([-0.9,0]), c1=Pc([1.5,0]); g.strokeStyle='rgba(215,225,230,.35)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(c0[0],c0[1]); g.lineTo(c1[0],c1[1]); g.stroke(); g.setLineDash([]);
  // angle arcs: β from plane, φ from plane, α between
  const arc=(r,a0,a1,col,lab,dx)=>{ if(Math.abs(a1-a0)<0.3*D2R) return; g.strokeStyle=col; g.lineWidth=1.6; g.beginPath(); g.arc(Ox,Oy,r,-Math.max(a0,a1),-Math.min(a0,a1)); g.stroke(); const am=(a0+a1)/2; if(lab) txt(g,lab,Ox+(r+(dx||10))*Math.cos(am),Oy-(r+(dx||10))*Math.sin(am)+4,{col,size:fs,mono:1,bg:BG}); };
  const ph=b.phi*D2R;
  arc(ch*1.05,0,be,'#C9D3DA','',14); { const r=ch*1.05+16, a=be+5*D2R; txt(g,'β '+nf(b.beta,0)+'°',Ox+r*Math.cos(a),Oy-r*Math.sin(a),{col:'#C9D3DA',size:fs,mono:1,bg:BG}); }
  if(U+V>2){ arc(ch*1.38,0,ph,I.cyan,'φ '+nf(b.phi,0)+'°',16); arc(ch*0.62,ph,be,b.al<0?I.red:I.amber,'α '+nf(b.al,1)+'°',12); }
  // aerodynamic forces on the section (normalised), resolved into thrust and torque force
  if(U+V>2){ const qd=b.W*b.W, sc2=Math.min(W,H)*0.46/(1.2*200*200); const Lm=b.cl*qd*sc2, Dm=b.cd*qd*sc2;
    const lx=-Math.sin(ph)*Lm, ly=Math.cos(ph)*Lm, dx=-Math.cos(ph)*Dm, dy=-Math.sin(ph)*Dm, Rx=lx+dx, Ry=ly+dy;
    const cp=Pc([0.25,0]);
    if(Math.abs(Lm)>3) arrow(g,cp[0],cp[1],cp[0]+lx,cp[1]-ly,I.green,2.2,8);
    if(Math.abs(Lm)>3) txt(g,L({en:'lift',no:'løft'}),cp[0]+lx+(lx<0?-6:6),cp[1]-ly-4,{col:I.green,al:lx<0?'right':'left',size:fs-1,bg:BG});
    if(Math.abs(Ry)>3){ arrow(g,cp[0]+0,cp[1],cp[0],cp[1]-Ry,I.mag,3,10); txt(g,(Ry>0?L({en:'thrust',no:'skyv'}):L({en:'drag (negative thrust)',no:'motstand (negativt skyv)'})),cp[0]+8,cp[1]-Ry+(Ry>0?6:12),{col:I.mag,size:fs,w:700,bg:BG}); }
    if(Math.abs(Rx)>3){ arrow(g,cp[0],cp[1]+0,cp[0]+Rx,cp[1],I.amber,2.4,8); txt(g,Rx<0?L({en:'torque force (resists rotation)',no:'dreiemomentkraft (bremser rotasjonen)'}):L({en:'air drives the blade',no:'lufta driver bladet'}),cp[0]+Rx+(Rx<0?-6:6),cp[1]+16,{col:I.amber,al:Rx<0?'right':'left',size:fs-1,bg:BG}); }
  }
  txt(g,L({en:'Blade section at 75 % radius',no:'Bladsnitt ved 75 % radius'}),W-10,18,{col:I.mute,al:'right',size:fs,mono:1});
}
function bRead(){ const b=bState();
  let s, cls='good';
  if(B.rpm<50&&b.beta>78){ s={en:'Feathered: the blade is edge-on to the airflow, it hardly turns and makes very little drag.',no:'Fløyet: bladet står med kanten mot luftstrømmen, går nesten ikke rundt og gir svært lite motstand.'}; }
  else if(B.rpm<50){ s={en:'Stopped at a flat blade angle: the blade is broadside to the airflow, a lot of drag. Feather it.',no:'Stoppet med flat bladvinkel: bladet står på tvers av luftstrømmen og gir mye motstand. Fløy den.'}; cls='bad'; }
  else if(b.al< -0.5){ s={en:'Windmilling: the relative wind meets the blade from in front of the chord. Negative angle of attack, negative thrust (drag), and the air drives the propeller round.',no:'Vindmølle: den relative vinden treffer bladet forfra i forhold til korden. Negativ angrepsvinkel, negativt skyv (motstand), og lufta driver propellen rundt.'}; cls='bad'; }
  else if(b.al>15){ s={en:'The blade is stalled: too much angle of attack. Typical of a fixed-pitch propeller at low speed and high RPM.',no:'Bladet har steilet: for stor angrepsvinkel. Typisk for en propell med fast stigning i lav fart og høyt turtall.'}; cls='warn'; }
  else if(b.al<2){ s={en:'Little angle of attack, little thrust. With fixed pitch, more speed does this: the RPM rises and the thrust falls away.',no:'Liten angrepsvinkel, lite skyv. Med fast stigning gjør mer fart dette: turtallet øker og skyvet faller bort.'}; cls='warn'; }
  else s={en:'Making thrust: a healthy angle of attack, the lift tilts forward.',no:'Gir skyv: sunn angrepsvinkel, løftet heller framover.'};
  const rows=[[{en:'Helix angle φ = atan(V / U)',no:'Spiralvinkel φ = atan(V / U)'},nf(b.phi,1)+'°'],[{en:'Blade angle β',no:'Bladvinkel β'},nf(b.beta,1)+'°'],[{en:'Angle of attack α = β − φ',no:'Angrepsvinkel α = β − φ'},nf(b.al,1)+'°',b.al<-0.5?'bad':b.al>15?'warn':'hl'],
    [{en:'Advance ratio J = V / (n·D)',no:'Fremdriftstall J = V / (n·D)'},B.rpm<50?'–':nf(b.adv,2)],[{en:'Tip Mach number',no:'Mach-tall i tuppen'},nf(b.tipMach,2),b.tipMach>0.88?'warn':''],[{en:'Section thrust',no:'Skyv fra snittet'},b.thrust>0?L({en:'positive',no:'positivt'}):L({en:'negative (drag)',no:'negativt (motstand)'}),b.thrust>0?'good':'bad']];
  el('pwR').innerHTML=rows.map(r=>`<div class="rrow"><span>${L(r[0])}</span><b class="${r[2]||''}">${r[1]}</b></div>`).join('')+`<p class="callout ${cls==='good'?'info':''}" id="pwX" style="margin-top:10px;font-size:14px">${L(s)}</p>`;
  el('pwOv').innerHTML=`${B.mode==='cs'?L({en:'Constant speed',no:'Konstant turtall'}):L({en:'Fixed pitch',no:'Fast stigning'})} · <b>${nf(B.rpm,0)} RPM</b> · ${nf(B.tas,0)} kt`;
}
function bAll(){ const b=bState(); if(B.mode==='cs') S_b.set(Math.round(b.beta)); S_b.inp.disabled=B.mode==='cs'; bRead(); drawPW(); drawBP(); if(typeof live==='function') live(); }
const pwSeg=LAB.seg(el('pwMode'),[['fp','Fixed pitch'],['cs','Constant speed']],B.mode,v=>{ B.mode=v; curB=null; bAll(); });
const bs=o=>LAB.slider(el('pwCtl'),o);
const S_r=bs({label:'RPM',min:0,max:2700,step:50,v:B.rpm,f:v=>nf(v,0),on:v=>{ B.rpm=v; curB=null; bAll(); }});
const S_t=bs({label:'True airspeed (kt)',min:0,max:200,step:5,v:B.tas,f:v=>v+' kt',on:v=>{ B.tas=v; curB=null; bAll(); }});
const S_b=bs({label:'Blade angle β (°)',min:5,max:88,step:1,v:B.beta,f:v=>v+'°',on:v=>{ B.beta=v; curB=null; bAll(); },hint:'Set by the governor in constant-speed mode'});
const BP=[['run',{en:'Run-up, fixed pitch',no:'Run-up, fast stigning'},{mode:'fp',rpm:2300,tas:0,beta:24}],['climb',{en:'Climb 75 kt',no:'Stigning 75 kt'},{mode:'fp',rpm:2500,tas:75,beta:24}],['cruise',{en:'Cruise 140 kt',no:'Cruise 140 kt'},{mode:'cs',rpm:2400,tas:140,beta:30}],['wm',{en:'Windmilling',no:'Vindmølle'},{mode:'fp',rpm:1800,tas:120,beta:14}],['fe',{en:'Feathered',no:'Fløyet'},{mode:'fp',rpm:0,tas:120,beta:86}]];
let curB='climb';
function drawBP(){ el('pwPre').innerHTML=BP.map(([k,t])=>`<button class="btn sm${k===curB?' on':''}" type="button" data-k="${k}">${L(t)}</button>`).join(''); }
el('pwPre').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; const p=BP.find(x=>x[0]===b.dataset.k); if(!p) return; Object.assign(B,p[2]); pwSeg.set(B.mode); S_r.set(B.rpm); S_t.set(B.tas); S_b.set(B.beta); curB=p[0]; bAll(); });
on(()=>{
  el('pwLead').innerHTML=L({en:'Each blade is a small wing flying in a spiral. Its speed through the air is the rotational speed <b>U = ω·r</b> combined with the true airspeed <b>V</b>. The <b>blade angle β</b> is set by the hub; the <b>angle of attack α = β − φ</b> depends on how fast you fly and how fast it turns. Lift on the blade tilts forward to give thrust, and backward to resist rotation (the torque the engine must supply).',no:'Hvert blad er en liten vinge som flyr i en spiral. Farten gjennom lufta er rotasjonsfarten <b>U = ω·r</b> satt sammen med sann fart <b>V</b>. <b>Bladvinkelen β</b> settes av navet; <b>angrepsvinkelen α = β − φ</b> avhenger av hvor fort du flyr og hvor fort den går rundt. Løftet på bladet heller framover og gir skyv, og bakover og bremser rotasjonen (dreiemomentet motoren må levere).'});
  const cc=[[{en:'Fixed pitch',no:'Fast stigning'},{en:'β is fixed: a compromise. At low speed α is large (the blade may stall, little static thrust); at high speed α falls, RPM rises and thrust fades. The throttle sets RPM.',no:'β er fast: et kompromiss. I lav fart er α stor (bladet kan steile, lite statisk skyv); i høy fart faller α, turtallet øker og skyvet avtar. Gassen styrer turtallet.'}],
    [{en:'Constant speed',no:'Konstant turtall'},{en:'A governor changes β to hold the RPM you select with the propeller lever: fine pitch for take-off, coarser as TAS rises, so α stays near its best. The throttle then sets manifold pressure (power).',no:'En regulator endrer β for å holde turtallet du velger med propellhendelen: fin stigning ved avgang, grovere når TAS øker, så α holder seg nær det beste. Gassen styrer da manifoldtrykket (effekten).'}],
    [{en:'Windmilling and feathering',no:'Vindmølle og fløying'},{en:'With the engine dead and the governor driving to fine pitch, the relative wind hits the blade at a negative α: negative thrust, and the air turns the engine. Feathering turns the blades to about 85–90°, edge-on to the airflow: the propeller stops and most of the drag goes.',no:'Med død motor og regulatoren mot fin stigning treffer den relative vinden bladet med negativ α: negativt skyv, og lufta driver motoren rundt. Fløying vrir bladene til omtrent 85–90°, med kanten mot luftstrømmen: propellen stopper og det meste av motstanden forsvinner.'}],
    [{en:'Torque and slipstream',no:'Dreiemoment og slipstrøm'},{en:'The backward part of the blade force is the torque: the engine turns the propeller one way, the propeller pushes the aircraft the other way (roll). The air thrown back by the propeller rotates with it: the spiralling slipstream that hits the fin.',no:'Den bakovervendte delen av bladkraften er dreiemomentet: motoren vrir propellen én vei, propellen dytter flyet den andre veien (rull). Lufta som kastes bakover roterer med propellen: spiralslipstrømmen som treffer finnen.'}]];
  el('pwCards').innerHTML=cc.map(([t,d])=>`<div class="box"><b class="t">${L(t)}</b><p>${L(d)}</p></div>`).join('');
});

/* =====================================================================
   Try tasks
   ===================================================================== */
const go=id=>{ const t=el(id); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); };
const t2=(en,no)=>({en,no});
let active=null; const ans={}, touched={};
const near=(o,v)=>Math.abs(T.v-v)<=2;
const TASKS=[
 {k:'crit',q:t2('Both propellers turn clockwise seen from behind. Which engine is critical?','Begge propellene går med klokka sett bakfra. Hvilken motor er kritisk?'),
  opts:[t2('The left engine','Venstre motor'),t2('The right engine','Høyre motor'),t2('Neither: they are the same','Ingen: de er like'),t2('Whichever fails first','Den som stopper først')],c:0,
  e:()=>{ const a=M.ltVmc(opt({fail:'L'})), b=M.ltVmc(opt({fail:'R'})); return [t2(`Right. VMCA ${kt(a)} with the left engine failed, ${kt(b)} with the right. P-factor gives the live right engine the longer thrust arm, its slipstream rolls you harder, the left engine’s spiral no longer helps the fin, and torque adds roll toward the dead side.`,`Riktig. VMCA ${kt(a)} med venstre motor ute, ${kt(b)} med høyre. P-faktoren gir den gode høyre motoren lengst skyvarm, slipstrømmen ruller deg hardere, spiralen fra venstre motor hjelper ikke finnen lenger, og dreiemomentet gir rull mot den døde siden.`),
    t2(`Not quite. The descending blade is on the right of each disc, so the right engine’s thrust line sits further out. Losing the left engine leaves that longer arm: VMCA ${kt(a)} against ${kt(b)}.`,`Ikke helt. Det nedadgående bladet sitter til høyre på hver propell, så skyvlinjen til høyre motor ligger lenger ut. Mister du venstre motor, står du igjen med den lengste armen: VMCA ${kt(a)} mot ${kt(b)}.`)]; },
  show:()=>{ T.lay={pf:true,as:true,ss:true,tq:true,rec:true}; drawLay(); setLT({fail:'L',v:80,phi:5,feather:false,cg:1,pw:1},'crit'); go('lt'); }},
 {k:'v0',model:'lt',q:t2('Left engine failed, windmilling, aft CG, full power, wings level. Slow down until the rudder runs out: find VMCA.','Venstre motor ute, vindmølle, bakre CG, full effekt, vingene vannrett. Senk farten til roret ikke strekker til: finn VMCA.'),
  setup:()=>setLT({fail:'L',v:95,phi:0,feather:false,cg:1,pw:1},null),
  check:()=>{ if(T.fail!=='L'||T.feather||T.cg<1||T.pw<1) return {ok:0,m:t2('Set left engine failed, windmilling, aft CG and full power (Advanced).','Sett venstre motor ute, vindmølle, bakre CG og full effekt (Avansert).')}; if(T.phi!==0) return {ok:0,m:t2('Wings level: bank 0°.','Vingene vannrett: krengning 0°.')};
    const v=M.ltVmc(opt()); return near(0,v)?{ok:1,m:t2(`Yes: about ${kt(v)}. Below it the heading goes even with full rudder. Now try task 3.`,`Ja: omtrent ${kt(v)}. Under den går kursen selv med fullt ror. Prøv så oppgave 3.`)}:{ok:0,m:t2(`${nf(T.v,0)} kt: ${C.ok?'still controllable, slow down':'not controllable, speed up'} until the status just changes.`,`${nf(T.v,0)} kt: ${C.ok?'fortsatt styrbart, senk farten':'ikke styrbart, øk farten'} til statusen akkurat skifter.`)}; }},
 {k:'v5',model:'lt',q:t2('Same set-up, now with 5° of bank toward the live engine. Find VMCA again. How much lower is it?','Samme oppsett, nå med 5° krengning mot den gode motoren. Finn VMCA igjen. Hvor mye lavere er den?'),
  setup:()=>setLT({fail:'L',v:85,phi:5,feather:false,cg:1,pw:1},null),
  check:()=>{ if(T.fail!=='L'||T.feather||T.cg<1||T.pw<1) return {ok:0,m:t2('Set left engine failed, windmilling, aft CG and full power.','Sett venstre motor ute, vindmølle, bakre CG og full effekt.')}; if(T.phi!==5) return {ok:0,m:t2('Bank 5° toward the live engine.','Krengning 5° mot den gode motoren.')};
    const v=M.ltVmc(opt()), v0=M.ltVmc(opt({phi:0})); return near(0,v)?{ok:1,m:t2(`Yes: about ${kt(v)}, ${nf(v0-v,0)} kt lower than wings level. W·sin φ now carries the fin’s side force, the sideslip is near zero and the ball sits half out toward the live engine.`,`Ja: omtrent ${kt(v)}, ${nf(v0-v,0)} kt lavere enn med vingene vannrett. W·sin φ tar nå finnens sidekraft, sideslipen er nær null, og kula ligger en halv bredde ut mot den gode motoren.`)}:{ok:0,m:t2(`${nf(T.v,0)} kt: ${C.ok?'still controllable, slow down':'not controllable, speed up'}.`,`${nf(T.v,0)} kt: ${C.ok?'fortsatt styrbart, senk farten':'ikke styrbart, øk farten'}.`)}; }},
 {k:'feath',q:t2('You feather the dead propeller. What happens to VMCA?','Du fløyer den døde propellen. Hva skjer med VMCA?'),
  opts:[t2('It goes down','Den går ned'),t2('It goes up','Den går opp'),t2('No change','Ingen endring'),t2('VMCA no longer applies','VMCA gjelder ikke lenger')],c:0,
  e:()=>{ const a=M.ltVmc(opt({fail:'L',phi:5,feather:false})), b=M.ltVmc(opt({fail:'L',phi:5,feather:true})); return [t2(`Right: ${kt(a)} → ${kt(b)}. Feathered blades stand edge-on, the drag on the dead side almost disappears, and you get climb performance back too.`,`Riktig: ${kt(a)} → ${kt(b)}. Fløyede blad står med kanten mot vinden, motstanden på den døde siden nesten forsvinner, og du får tilbake stigeevne også.`),t2(`Not quite. A windmilling propeller is a disc of drag on the dead side that adds to the yaw. Feathered: ${kt(a)} → ${kt(b)}.`,`Ikke helt. En vindmøllende propell er en motstandsskive på den døde siden som øker giret. Fløyet: ${kt(a)} → ${kt(b)}.`)]; },
  show:()=>{ setLT({fail:'L',v:75,phi:5,feather:true,cg:1,pw:1},null); go('lt'); }},
 {k:'wm',model:'pw',q:t2('Fixed pitch at 120 kt and 20° blade angle: lower the RPM until the blade windmills (thrust turns negative).','Fast stigning ved 120 kt og 20° bladvinkel: senk turtallet til bladet vindmøller (skyvet blir negativt).'),
  setup:()=>{ Object.assign(B,{mode:'fp',rpm:2400,tas:120,beta:20}); pwSeg.set('fp'); S_r.set(B.rpm); S_t.set(B.tas); S_b.set(B.beta); curB=null; bAll(); },
  check:()=>{ const b=bState(); if(B.mode!=='fp'||Math.abs(B.tas-120)>5||B.beta!==20) return {ok:0,m:t2('Fixed pitch, 120 kt, β 20°.','Fast stigning, 120 kt, β 20°.')};
    return b.al<0&&B.rpm>0?{ok:1,m:t2(`Yes: at ${nf(B.rpm,0)} RPM α is ${nf(b.al,1)}°. The relative wind now meets the blade from in front of the chord: negative thrust, and the air turns the engine. Feather it to stop that.`,`Ja: ved ${nf(B.rpm,0)} RPM er α ${nf(b.al,1)}°. Den relative vinden treffer nå bladet forfra i forhold til korden: negativt skyv, og lufta driver motoren. Fløy for å stoppe det.`)}:{ok:0,m:t2(`α is ${nf(b.al,1)}°: still making thrust. Lower the RPM.`,`α er ${nf(b.al,1)}°: gir fortsatt skyv. Senk turtallet.`)}; }},
 {k:'a320',q:t2('On the A320, which engine is critical for VMCA?','Hvilken motor er kritisk for VMCA på A320?'),
  opts:[t2('ENG 1, because of P-factor','ENG 1, på grunn av P-faktor'),t2('ENG 2','ENG 2'),t2('Practically neither: the turbofans are symmetric','I praksis ingen: turbofanene er symmetriske'),t2('Whichever has more thrust','Den med mest skyv')],c:2,
  e:()=>{ const A=window.PROPA320, a=A?A.vmc({phi:5,thr:1}):null, b=A?A.vmc({phi:0,thr:1}):null; return [t2(`Right. Same balance as the twin, but no P-factor, slipstream or torque to favour one side. In the model VMCA is ${kt(a)} with 5° of bank and ${kt(b)} wings level, whichever engine fails.`,`Riktig. Samme balanse som på tomotorsflyet, men ingen P-faktor, slipstrøm eller dreiemoment som favoriserer én side. I modellen er VMCA ${kt(a)} med 5° krengning og ${kt(b)} med vingene vannrett, uansett hvilken motor som stopper.`),t2('Not quite. P-factor is a propeller effect. The A320’s turbofans are practically symmetric, so either failure gives almost the same VMCA.','Ikke helt. P-faktor er en propelleffekt. Turbofanene på A320 er i praksis symmetriske, så stans i hvilken som helst gir nesten samme VMCA.')]; },
  show:()=>{ if(window.PROPA320) PROPA320.set({phi:5,v:125}); go('single'); }}];
function drawTasks(){ el('tasks').innerHTML=TASKS.map((t,i)=>`<li class="task" id="task-${t.k}"><span class="n">${L(t2('Task','Oppgave'))} ${i+1}</span><p class="q">${L(t.q)}</p>`+
   (t.model?`<div class="btns"><button type="button" class="btn pri sm" data-go="${t.k}">${L(t2('Do it in the model','Gjør det i modellen'))} ↑</button></div><span class="fb" id="fb-${t.k}"></span>`:'')+
   (t.opts?(()=>{ const a=ans[t.k], e=a!=null?t.e():null; return `<div class="opts">${t.opts.map((o,j)=>`<button type="button" data-t="${t.k}" data-o="${j}" class="${a!=null&&j===t.c?'right':''}${a===j&&j!==t.c?' wrong':''}">${L(o)}</button>`).join('')}</div><span class="fb${a===t.c?' ok':''}">${e?L(e[a===t.c?0:1]):''}</span><div class="btns"><button type="button" class="btn sm" data-show="${t.k}">${L(t2('Show it in the model','Vis i modellen'))} ↑</button></div>`; })():'')+`</li>`).join('');
  live(); drawTbox(); }
function drawTbox(){ for(const [id,m] of [['tbox','lt'],['tbox2','pw']]){ const b=el(id), t=TASKS.find(x=>x.k===active);
    if(!t||t.model!==m){ b.hidden=true; continue; } const i=TASKS.indexOf(t);
    b.hidden=false; b.innerHTML=`<span class="k">${L(t2('Task','Oppgave'))} ${i+1}<button type="button" aria-label="${L(t2('Close the task','Lukk oppgaven'))}" data-close="1">×</button></span>${L(t.q)}<span class="fb" data-tfb="1"></span>`;
    b.querySelector('[data-close]').onclick=()=>{ active=null; drawTbox(); }; } live(); }
function live(){ if(!C) return; TASKS.filter(t=>t.model&&touched[t.k]).forEach(t=>{ const r=t.check(), html=L(r.m); const f=el('fb-'+t.k); if(f){ f.innerHTML=html; f.classList.toggle('ok',!!r.ok); }
    if(active===t.k){ const g=document.querySelector((t.model==='lt'?'#tbox':'#tbox2')+' [data-tfb]'); if(g){ g.innerHTML=html; g.classList.toggle('ok',!!r.ok); } } }); }
el('tasks').addEventListener('click',e=>{ const gb=e.target.closest('[data-go]'), o=e.target.closest('[data-o]'), sh=e.target.closest('[data-show]');
  if(gb){ const t=TASKS.find(x=>x.k===gb.dataset.go); active=t.k; touched[t.k]=1; t.setup(); drawTbox(); go(t.model==='lt'?'lt':'pwing'); return; }
  if(o){ ans[o.dataset.t]=+o.dataset.o; drawTasks(); return; }
  if(sh){ active=null; drawTbox(); TASKS.find(x=>x.k===sh.dataset.show).show(); } });
on(()=>{ el('tryLead').innerHTML=L({en:'Six short tasks. Some you do in the model above, with live feedback in a box next to it; the others you answer here, then see them in the model.',no:'Seks korte oppgaver. Noen gjør du i modellen over, med fortløpende tilbakemelding i en boks ved siden av; de andre svarer du på her, og ser dem så i modellen.'}); drawTasks();
  el('foot').innerHTML='<b>'+L({en:'Model and limitations.',no:'Modell og begrensninger.'})+'</b> '+L({en:`Two teaching models, illustrative only. <b>Light twin</b> (own design, no real type): 1,900 kg, 200 hp per engine, both propellers clockwise from behind, engine arm ${nf(LT.ye,2)} m, fin area ${nf(LT.Sv,1)} m², fin arm ${nf(LT.lv0,2)} m at the forward CG limit, rudder travel ${LT.dmax}°, P-factor offset ${nf(LT.kp*100,0)} % of the propeller radius per degree of angle of attack, stall at CL ${nf(LT.CLmax,2)}; sea level, CAS = TAS. The blade section uses thin-aerofoil lift with a simple stall. <b>A320-size twin-jet</b>: take-off thrust 120 kN per engine, engine arm 5.75 m, fin area 21.5 m², fin arm 16 m from a CG at 25 % MAC, rudder travel 25° up to 160 kt; calibrated so VMCA is near 110 kt at sea level, ISA, TOGA and 5° of bank. Not AFM, POH, FCOM or certification data.`,no:`To opplæringsmodeller, bare illustrative. <b>Lett tomotors</b> (eget design, ingen reell type): 1 900 kg, 200 hk per motor, begge propellene med klokka sett bakfra, motorarm ${nf(LT.ye,2)} m, finneareal ${nf(LT.Sv,1)} m², finnearm ${nf(LT.lv0,2)} m ved fremre CG-grense, rorutslag ${LT.dmax}°, P-faktorforskyvning ${nf(LT.kp*100,0)} % av propellradien per grad angrepsvinkel, steiling ved CL ${nf(LT.CLmax,2)}; havnivå, CAS = TAS. Bladsnittet bruker tynnprofil-løft med en enkel steiling. <b>Tomotors jetfly på A320-størrelse</b>: startskyv 120 kN per motor, motorarm 5,75 m, finneareal 21,5 m², finnearm 16 m fra en CG på 25 % MAC, rorutslag 25° opp til 160 kt; kalibrert slik at VMCA er nær 110 kt ved havnivå, ISA, TOGA og 5° krengning. Ikke AFM-, POH-, FCOM- eller sertifiseringsdata.`}); });

LAB.tx({lead:'Mist en motor på et lett tomotors fly og på A320, og senk farten til sideroret ikke strekker til. Den farten er VMCA. Se hvorfor én motor er kritisk, hva krengning, fløying, effekt og CG gjør, hvordan et propellblad virker som en vinge, og hvordan CS-25 gjør VMC om til VMCG, VMCL og grensene for V1, VR, V2 og VREF.',
  goal:'<span class="k">Læringsmål</span>Forklar hvorfor én motor er kritisk på et lett tomotors fly, hva som bestemmer VMCA og hvordan krengning, fløying, effekt og CG flytter den, og hvordan VMCA blir til VMCG, VMCL og startfartene på A320.'});


/* memory aid cards */
function maid(id,h,p){ const c=el(id); if(!c) return; c.querySelector('.eyebrow').textContent=L({en:'Memory aid',no:'Huskeregel'}); c.querySelector('h3').innerHTML=L(h); c.querySelector('p').innerHTML=L(p); }
on(()=>{ maid('maPast',{en:'PAST makes the left engine critical',no:'PAST gjør venstre motor kritisk'},{en:'<b>P</b>-factor, <b>A</b>ccelerated slipstream, <b>S</b>piralling slipstream, <b>T</b>orque: with both propellers turning clockwise from behind, all four make losing the left engine worse.',no:'<b>P</b>-faktor, <b>A</b>kselerert slipstrøm, <b>S</b>piralslipstrøm, <b>T</b> (dreiemoment): når begge propellene går med klokka sett bakfra, gjør alle fire det verre å miste venstre motor.'});
  maid('maDead',{en:'Dead foot, dead engine. Raise the dead.',no:'Død fot, død motor. Løft den døde.'},{en:'The foot that is <b>not</b> pushing the rudder is on the side of the failed engine. Then bank about 5° toward the live engine, so the dead engine’s wing comes up.',no:'Foten som <b>ikke</b> trykker på sideroret er på samme side som motoren som har stoppet. Krengt så omtrent 5° mot den gode motoren, slik at vingen med den døde motoren kommer opp.'}); });
on(()=>{ const sw=c=>`<i style="background:${c}"></i>`;
  el('cLt').innerHTML=L({en:'<b>Left:</b> from above, with the thrust line and its arm. <b>Right:</b> from behind, with bank, lift and the ball.',no:'<b>Venstre:</b> ovenfra, med skyvlinjen og armen. <b>Høyre:</b> bakfra, med krengning, løft og kula.'});
  { const lg=(c,t)=>`<span><i style="--c:${c}"></i>${L(t)}</span>`; el('ltLeg').innerHTML=lg(I.mag,{en:'engine thrust and yaw',no:'motorskyv og gir'})+lg(I.cyan,{en:'rudder and fin',no:'ror og finne'})+lg(I.red,{en:'dead propeller',no:'død propell'})+lg(I.amber,{en:'P-factor',no:'P-faktor'})+lg(I.green,{en:'lift',no:'løft'}); }
  el('cCh').innerHTML=sw(I.mag)+L({en:'rudder moment needed',no:'rormoment som trengs'})+sw(I.cyan)+L({en:'rudder moment available (∝ V²)',no:'tilgjengelig rormoment (∝ V²)'})+sw('#8B99A7')+L({en:'other engine failed',no:'den andre motoren ute'})+'. '+L({en:'They cross at VMCA; red shading is below the stall.',no:'De krysser ved VMCA; rød skravering er under steilefarten.'});
  el('cPw').innerHTML=L({en:'One blade section at 75 % of the radius. ',no:'Ett bladsnitt ved 75 % av radien. '})+sw(I.cyan)+L({en:'U rotation',no:'U rotasjon'})+sw(I.green)+L({en:'V true airspeed',no:'V sann fart'})+sw(I.white)+L({en:'relative wind',no:'relativ vind'})+sw(I.mag)+L({en:'thrust',no:'skyv'})+sw(I.amber)+L({en:'torque force',no:'dreiemomentkraft'})+'. α = β − φ.'; });
/* start */
all(); Object.assign(B,BP[1][2]); pwSeg.set(B.mode); S_r.set(B.rpm); S_t.set(B.tas); S_b.set(B.beta); bAll(); drawLay();
hooks.forEach(f=>f());
LAB.onLang(()=>{ hooks.forEach(f=>f()); drawLay(); read(); drawLT(); drawCh(); drawPre(); bRead(); drawPW(); drawBP(); });
})();
