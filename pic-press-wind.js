/* NORDAP – pic-press-wind.js: "Why the wind blows along the isobars" for pressure.html (uses corepic.js).
   Northern hemisphere plan view: a parcel starts towards low pressure, Coriolis bends it right until the two forces balance
   (geostrophic wind along the isobars), friction near the ground turns it back towards the low (about 30° over land),
   then the circulation round a low and a high and Buys Ballot's law. Illustrative, not to scale. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'Air wants to go from high to low',no:'Luften vil fra høyt til lavt'},
  d:{en:'Closely spaced isobars mean a steep pressure slope. The <em>pressure gradient force</em> pushes the air straight across the isobars, from high towards low pressure.',
     no:'Tette isobarer betyr en bratt trykkskråning. <em>Trykkgradientkraften</em> skyver luften rett på tvers av isobarene, fra høyt mot lavt trykk.'}},
 {t:{en:'The Earth turns under it',no:'Jorden roterer under den'},
  d:{en:'As soon as the air moves, the <em>Coriolis effect</em> bends it to the <em>right</em> in the northern hemisphere. The faster it goes, the harder it is bent.',
     no:'Så snart luften beveger seg, bøyer <em>corioliseffekten</em> den mot <em>høyre</em> på den nordlige halvkule. Jo fortere den går, jo kraftigere bøyes den.'}},
 {t:{en:'Geostrophic wind · along the isobars',no:'Geostrofisk vind · langs isobarene'},
  d:{en:'The air turns until Coriolis exactly balances the pressure force. Now it blows <em>along the isobars</em>, faster where they are closer. This is the wind at about 2 000 ft and above.',
     no:'Luften svinger til corioliskraften akkurat balanserer trykkraften. Nå blåser den <em>langs isobarene</em>, sterkere der de ligger tett. Dette er vinden fra omtrent 2 000 ft og oppover.'}},
 {t:{en:'Friction near the ground',no:'Friksjon nær bakken'},
  d:{en:'Near the surface friction slows the wind, Coriolis weakens, and the air <em>backs</em> to cross the isobars towards low pressure: about <em>30° over land</em>, 10° over the sea, and slower. Climbing out of it, the wind <em>veers</em> and increases.',
     no:'Nær bakken bremser friksjonen vinden, corioliskraften svekkes, og luften <em>dreier mot venstre</em> og krysser isobarene mot lavt trykk: omtrent <em>30° over land</em>, 10° over sjø, og svakere. Stiger du ut av den, <em>dreier vinden mot høyre</em> og øker.'}},
 {t:{en:'Round a low and a high',no:'Rundt et lavtrykk og et høytrykk'},
  d:{en:'So in the northern hemisphere air flows <em>anticlockwise round a low</em> and <em>clockwise round a high</em>, spiralling in to the low and out of the high near the ground.',
     no:'Derfor strømmer luften på den nordlige halvkule <em>mot klokka rundt et lavtrykk</em> og <em>med klokka rundt et høytrykk</em>, i spiral inn mot lavtrykket og ut fra høytrykket nær bakken.'}},
 {t:{en:"Buys Ballot's law",no:'Buys Ballots lov'},
  d:{en:'Stand with your <em>back to the wind</em>: low pressure is on your <em>left</em> (northern hemisphere). Flying with drift to the right means you are heading towards lower pressure: <em>high to low, look out below</em>.',
     no:'Stå med <em>ryggen mot vinden</em>: lavtrykket er på <em>venstre</em> side (nordlige halvkule). Driver du til høyre under flyging, er du på vei mot lavere trykk: <em>fra høyt til lavt, se opp nedover</em>.'},
  go:{en:'Open the pressure and wind lab',no:'Åpne trykk- og vindlabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* the parcel's direction (screen angle, 0 = east, +ve = clockwise/down) and speed for the straight-isobar part.
   Isobars run west–east; low to the north (up), high to the south (down). PGF points up (−90°). */
function parcel(p){ const a1=at(p,1,1), a2=at(p,2,.9), a3=at(p,3,.8);
  // starts at −90° (towards the low), turns right towards 0° (east, geostrophic), friction backs it 30° towards the low
  const ang=lerp(-90,0,ease(Math.max(a1*0.55,a2)))-30*a3; const spd=lerp(.5,1,Math.max(a1*.6,a2))*(1-.3*a3);
  return {ang,spd}; }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const circ=at(p,4,.9), str=1-circ;
  if(str>0.01){ g.save(); g.globalAlpha=str;
    const y0=H*.18, y1=H*.86, n=5, x0=W*(sm?.04:.04), x1=W*(sm?.96:.66);
    // pressure field: low (cool, top) to high (warm, bottom)
    const pf=g.createLinearGradient(0,y0-H*.1,0,y1+H*.1); pf.addColorStop(0,'rgba(236,90,71,.13)'); pf.addColorStop(.5,'rgba(20,30,40,0)'); pf.addColorStop(1,'rgba(127,198,238,.13)');
    g.fillStyle=pf; g.fillRect(0,0,W,H);
    // the flow: streaks moving with the current wind direction
    { const P0=parcel(p), ua=P0.ang*Math.PI/180, ux=Math.cos(ua), uy=Math.sin(ua);
      g.save(); g.lineCap='round';
      for(let k=0;k<46;k++){ const ph=((tm*.11*P0.spd+k*.0731)%1), bx=x0+((k*137.5)%(x1-x0)), by=y0-H*.08+((k*71.3)%(y1-y0+H*.16));
        const x=bx+ux*(ph-.5)*W*.22, y=by+uy*(ph-.5)*W*.22, a=.22*Math.sin(ph*Math.PI);
        const gr=g.createLinearGradient(x-ux*22,y-uy*22,x,y); gr.addColorStop(0,'rgba(220,235,245,0)'); gr.addColorStop(1,`rgba(220,235,245,${a})`);
        g.strokeStyle=gr; g.lineWidth=1.6; g.beginPath(); g.moveTo(x-ux*22,y-uy*22); g.lineTo(x,y); g.stroke(); }
      g.restore(); }
    for(let i=0;i<n;i++){ const y=lerp(y0,y1,i/(n-1)); g.strokeStyle='rgba(255,255,255,.45)'; g.lineWidth=1.2; g.beginPath(); for(let x=x0;x<=x1;x+=8){ const yy=y+Math.sin(x*.008+i)*4; x===x0?g.moveTo(x,yy):g.lineTo(x,yy); } g.stroke();
      txt(g,`${1000+4*i} hPa`,x1+6,y+4,{mono:1,size:10*fs,col:'#AEB8C1'}); }
    txt(g,'L',x0+10,y0-16,{size:28*fs,col:C.red,w:700}); txt(g,L({en:'low',no:'lavt'}),x0+36,y0-22,{size:11*fs,col:'#FF8A78'});
    txt(g,'H',x0+10,y1+34,{size:28*fs,col:C.blue,w:700}); txt(g,L({en:'high',no:'høyt'}),x0+36,y1+28,{size:11*fs,col:'#9FD4F2'});
    // parcel trajectory traced from the start
    const P=parcel(p), cx=(x0+x1)/2, cy=(y0+y1)/2, F=Math.min(W,H)*.16;
    // trail: integrate from a start point using the angle history
    const tr=[[0,0]]; let tx=0, ty=0; const stp=Math.min(W,H)*.012;
    for(let q=0;q<=Math.min(p,3.99);q+=0.04){ const pp=parcel(q); tx+=Math.cos(pp.ang*Math.PI/180)*pp.spd*stp; ty+=Math.sin(pp.ang*Math.PI/180)*pp.spd*stp; tr.push([tx,ty]); }
    const px=cx+F*.2, py=cy+F*.15, dx=px-tx, dy=py-ty;
    g.strokeStyle='rgba(255,255,255,.35)'; g.lineWidth=2; g.setLineDash([2,5]); g.beginPath(); tr.forEach((q,i)=>{ const x=q[0]+dx, y=q[1]+dy; i?g.lineTo(x,y):g.moveTo(x,y); }); g.stroke(); g.setLineDash([]);
    // forces on the parcel
    const pgf=F*.9, cor=F*.9*Math.max(at(p,1,1)*.6,at(p,2,.9))*(1-.35*at(p,3,.8));
    arrow(g,px,py,px,py-pgf,C.red,{lw:3,head:11}); pill(g,L({en:'pressure force',no:'trykkraft'}),px-10,py-pgf+6,{size:11*fs,col:'#FF8A78',al:'right'});
    if(cor>2){ const ca=(P.ang+90)*Math.PI/180; arrow(g,px,py,px+Math.cos(ca)*cor,py+Math.sin(ca)*cor,C.violet,{lw:3,head:11}); pill(g,'Coriolis',px+Math.cos(ca)*cor+8,py+Math.sin(ca)*cor+10,{size:11*fs,col:C.violet,fit:W}); }
    if(at(p,3,.8)>0.05){ const fa=(P.ang+180)*Math.PI/180, fl=F*.45*at(p,3,.8); arrow(g,px,py,px+Math.cos(fa)*fl,py+Math.sin(fa)*fl,C.amber,{lw:2.6,head:10}); pill(g,L({en:'friction',no:'friksjon'}),px+Math.cos(fa)*fl-8,py+Math.sin(fa)*fl+16,{size:11*fs,col:C.amber,al:'right'}); }
    // the air parcel
    { const hal=g.createRadialGradient(px,py,0,px,py,22); hal.addColorStop(0,'rgba(255,255,255,.35)'); hal.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=hal; g.beginPath(); g.arc(px,py,22,0,7); g.fill();
      g.fillStyle='#fff'; g.beginPath(); g.arc(px,py,4.5,0,7); g.fill(); }
    // wind arrow
    const wa=P.ang*Math.PI/180, wl=F*1.1*P.spd; arrow(g,px,py,px+Math.cos(wa)*wl,py+Math.sin(wa)*wl,'#fff',{lw:4,head:13});
    pill(g,L({en:'wind',no:'vind'}),px+Math.cos(wa)*wl+10,py+Math.sin(wa)*wl-12,{size:11.5*fs,col:'#fff',fit:W});
    // angle to the isobars (friction)
    if(at(p,3,.8)>0.3){ g.strokeStyle='rgba(240,180,64,.7)'; g.lineWidth=1.3; g.beginPath(); g.arc(px,py,F*.55,wa,0); g.stroke(); txt(g,'≈ 30°',px+F*.6,py-F*.12,{mono:1,size:11*fs,col:C.amber}); }
    // height tag
    const hTag=at(p,3,.8)>.5?L({en:'surface wind (over land)',no:'bakkevind (over land)'}):at(p,2,.8)>.5?L({en:'2 000 ft and above: geostrophic',no:'2 000 ft og over: geostrofisk'}):null;
    if(hTag) pill(g,hTag,sm?W/2:W*.82,sm?H*.05:H*.12,{size:11*fs,col:'#fff',al:'center',fit:W});
    g.restore(); }
  if(circ>0.01){ g.save(); g.globalAlpha=circ;
    const cL=[W*(sm?.28:.22),H*.5], cH=[W*(sm?.72:.56),H*.5], R=Math.min(W*(sm?.2:.15),H*.36);
    const tint=(c,rgb)=>{ const gr=g.createRadialGradient(c[0],c[1],0,c[0],c[1],R*1.25); gr.addColorStop(0,`rgba(${rgb},.22)`); gr.addColorStop(1,`rgba(${rgb},0)`); g.fillStyle=gr; g.beginPath(); g.arc(c[0],c[1],R*1.25,0,7); g.fill(); };
    tint(cL,'236,90,71'); tint(cH,'127,198,238');
    const rings=(c,col,sd,lab)=>{ for(let i=1;i<=4;i++){ const ri=R*i/4; g.strokeStyle=col; g.lineWidth=i===4?1.4:1.1; g.beginPath();
        for(let q=0;q<=72;q++){ const a=q/72*Math.PI*2, rr2=ri*(1+.06*Math.sin(2*a+sd+i*.7)+.03*Math.sin(3*a+sd*2)); const x=c[0]+Math.cos(a)*rr2*1.05, y=c[1]+Math.sin(a)*rr2*.9; q?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
        if(!sm&&(i===2||i===4)){ const a=-Math.PI*.5, rr2=ri*(1+.06*Math.sin(2*a+sd+i*.7)+.03*Math.sin(3*a+sd*2)); const v=lab[i===2?0:1]; g.fillStyle='#141C24'; g.fillRect(c[0]-15,c[1]+Math.sin(a)*rr2*.9-7,30,13); txt(g,v,c[0],c[1]+Math.sin(a)*rr2*.9+4,{mono:1,size:9,col:'#AEB8C1',al:'center'}); } } };
    rings(cL,'rgba(255,255,255,.38)',.3,['996','1004']); rings(cH,'rgba(255,255,255,.38)',1.7,['1028','1020']);
    txt(g,'L',cL[0],cL[1]+10,{size:30*fs,col:C.red,w:700,al:'center'}); txt(g,'H',cH[0],cH[1]+10,{size:30*fs,col:C.blue,w:700,al:'center'});
    // particles spiralling: anticlockwise in to the low, clockwise out of the high (screen y down: anticlockwise = decreasing angle)
    for(let k=0;k<26;k++){ const ph=((tm*.07+k/26)%1);
      const comet=(c,sgn,inw,col)=>{ const al=.85*Math.sin(ph*Math.PI); g.strokeStyle=`rgba(${col},${al*.55})`; g.lineWidth=2; g.lineCap='round'; g.beginPath();
          for(let j=0;j<=8;j++){ const q=Math.max(0,ph-j*.012), a=sgn*(q*Math.PI*2*1.3)+k*1.3, r=R*(inw?1.0-0.55*q:0.45+0.55*q); const x=c[0]+Math.cos(a)*r*1.05, y=c[1]+Math.sin(a)*r*.9; j?g.lineTo(x,y):g.moveTo(x,y); } g.stroke();
          const a=sgn*(ph*Math.PI*2*1.3)+k*1.3, r=R*(inw?1.0-0.55*ph:0.45+0.55*ph); g.fillStyle=`rgba(${col},${al})`; g.beginPath(); g.arc(c[0]+Math.cos(a)*r*1.05,c[1]+Math.sin(a)*r*.9,2.4,0,7); g.fill(); };
      comet(cL,-1,true,'159,212,242'); comet(cH,1,false,'240,180,64'); }
    // direction arrows on the rings
    const ringArrow=(c,cw,col)=>{ for(let q=0;q<4;q++){ const a=q*Math.PI/2+.4, r=R*.78, x=c[0]+Math.cos(a)*r*1.05, y=c[1]+Math.sin(a)*r*.9, t=a+(cw?Math.PI/2:-Math.PI/2)-0.35; arrow(g,x,y,x+Math.cos(t)*18,y+Math.sin(t)*18,col,{lw:2.4,head:8}); } };
    ringArrow(cL,false,C.blue); ringArrow(cH,true,C.amber);
    pill(g,L({en:'anticlockwise, in',no:'mot klokka, inn'}),cL[0],cL[1]+R+18,{size:11*fs,col:'#9FD4F2',al:'center'});
    pill(g,L({en:'clockwise, out',no:'med klokka, ut'}),cH[0],cH[1]+R+18,{size:11*fs,col:C.amber,al:'center'});
    // Buys Ballot
    const bb=at(p,5,.8);
    if(bb>0.01){ g.globalAlpha=circ*bb; const bx=sm?W*.5:W*.88, by=sm?H*.16:H*.5;
      // person seen from above with the wind at the back
      arrow(g,bx,by+70,bx,by+24,'#fff',{lw:3,head:10}); txt(g,L({en:'wind',no:'vind'}),bx+10,by+60,{size:11*fs,col:'#fff'});
      g.fillStyle='#E2E8EE'; g.beginPath(); g.arc(bx,by,10,0,7); g.fill(); g.fillStyle='#9AA6B0'; g.beginPath(); g.ellipse(bx,by,18,7,0,0,7); g.fill(); g.fillStyle='#E2E8EE'; g.beginPath(); g.arc(bx,by,8,0,7); g.fill();
      arrow(g,bx-14,by,bx-60,by,C.red,{lw:3,head:10}); txt(g,L({en:'low on your left',no:'lavt på venstre side'}),sm?bx-30:bx-12,by+(sm?-16:24),{size:11*fs,col:'#FF8A78',al:sm?'center':'right',w:600});
      if(!sm) txt(g,L({en:'back to the wind',no:'ryggen mot vinden'}),bx,by-26,{size:10.5*fs,col:'#AEB8C1',al:'center'});
      g.globalAlpha=circ; }
    g.restore(); }
  txt(g,L({en:'northern hemisphere · not to scale',no:'nordlige halvkule · ikke i skala'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.1,dwell:6.5,
    title:{en:'Why the wind blows along the isobars',no:'Hvorfor vinden blåser langs isobarene'},
    sub:{en:'Two forces, then a third near the ground. Together they explain every wind on the weather chart.',no:'To krefter, og en tredje nær bakken. Sammen forklarer de hver vind på værkartet.'},
    label:{en:'Animated plan view of a parcel of air turned by the pressure force, Coriolis and friction, then the circulation round a low and a high.',no:'Animert planbilde av en luftpakke som påvirkes av trykkraft, coriolis og friksjon, deretter sirkulasjonen rundt et lavtrykk og et høytrykk.'},
    foot:{en:'Northern hemisphere. Surface wind about 30° across the isobars over land, 10° over the sea. Schematic.',no:'Nordlige halvkule. Bakkevind omtrent 30° på tvers av isobarene over land, 10° over sjø. Skjematisk.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
