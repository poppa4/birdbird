/* NORDAP – pic-af.js: "Automation and the safety nets" for autoflight.html (uses corepic.js).
   FMA reading (what the autopilot is doing now and what is armed), a mode change at capture, then TCAS (TA and RA with
   the vertical speed band) and EGPWS (terrain ahead, pull up). Generic Airbus-style FMA; illustrative values. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT,jet}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'Read the FMA first',no:'Les FMA først'},
  d:{en:'The flight mode annunciator tells you what the automation is <em>doing now</em> (green, top line) and what is <em>armed</em> (blue, below). Columns: thrust, vertical, lateral. Always <em>read it out</em> after a change.',
     no:'Flygemodusvisningen forteller hva automatikken <em>gjør nå</em> (grønt, øverste linje) og hva som er <em>armert</em> (blått, under). Kolonner: skyvekraft, vertikalt, sideveis. <em>Les det høyt</em> etter hver endring.'}},
 {t:{en:'Armed becomes active',no:'Armert blir aktiv'},
  d:{en:'Climbing in CLB with ALT armed: approaching the selected level the vertical mode changes to <em>ALT*</em> (capture), then <em>ALT</em>. Nothing you did — so you only know if you look.',
     no:'Stigning i CLB med ALT armert: nær valgt nivå bytter vertikalmodus til <em>ALT*</em> (fangst), så <em>ALT</em>. Ingenting du gjorde — så du vet det bare hvis du ser.'}},
 {t:{en:'TCAS · traffic advisory',no:'TCAS · trafikkråd'},
  d:{en:'TCAS interrogates other transponders and predicts the closest point. About <em>40 s</em> before it: "TRAFFIC, TRAFFIC". Look, but <em>do not manoeuvre</em> on a TA alone.',
     no:'TCAS spør andre transpondere og forutsier nærmeste punkt. Omtrent <em>40 s</em> før: «TRAFFIC, TRAFFIC». Se etter, men <em>ikke manøvrer</em> bare på en TA.'}},
 {t:{en:'TCAS · resolution advisory',no:'TCAS · unnvikelsesråd'},
  d:{en:'About <em>25 s</em> before: a vertical order such as "CLIMB, CLIMB". Autopilot off, follow the green band <em>promptly</em> (within about 5 s), even against an ATC instruction. Tell ATC: "TCAS RA".',
     no:'Omtrent <em>25 s</em> før: en vertikal ordre som «CLIMB, CLIMB». Autopilot av, følg det grønne feltet <em>raskt</em> (innen omtrent 5 s), selv mot en ATC-instruks. Si til ATC: «TCAS RA».'}},
 {t:{en:'EGPWS · terrain ahead',no:'EGPWS · terreng foran'},
  d:{en:'EGPWS compares your position and path with a terrain database and looks ahead. "TERRAIN AHEAD" first, then <em>"PULL UP"</em>: full thrust, pitch up to the stick shaker or the limit, wings level, until the warning stops.',
     no:'EGPWS sammenligner posisjon og bane med en terrengdatabase og ser fremover. Først «TERRAIN AHEAD», så <em>«PULL UP»</em>: full skyvekraft, nesen opp til stick shaker eller grensen, vingene rett, til varselet stopper.'},
  go:{en:'Open the automation lab',no:'Åpne automatikklabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function fma(g,x,y,w,h,cols,hl){
  rr(g,x,y,w,h,6); g.fillStyle='#05080b'; g.fill(); g.strokeStyle='rgba(255,255,255,.18)'; g.stroke();
  const cw=w/cols.length; cols.forEach((c,i)=>{ if(i){ g.strokeStyle='rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x+i*cw,y+6); g.lineTo(x+i*cw,y+h-6); g.stroke(); }
    if(hl===i){ g.strokeStyle='#fff'; g.lineWidth=1.5; rr(g,x+i*cw+cw*.18,y+h*.1,cw*.64,h*.36,2); g.stroke(); g.lineWidth=1; }
    txt(g,c[0],x+i*cw+cw/2,y+h*.38,{mono:1,size:Math.min(16,h*.28),col:C.green,al:'center',w:600});
    if(c[1]) txt(g,c[1],x+i*cw+cw/2,y+h*.78,{mono:1,size:Math.min(14,h*.24),col:'#7FC6EE',al:'center',w:600}); }); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const fmaA=1-at(p,2,.7), tcA=at(p,2,.7)*(1-at(p,4,.7)), gpA=at(p,4,.7);
  if(fmaA>0.01){ g.save(); g.globalAlpha=fmaA;
    // side profile: climbing to FL120
    const x0=W*.06, x1=W*.94, y0=H*.62, y1=H*.92, lvl=y0+18;
    const cyc=clamp(((tm*.11)%1.35)/1.1,0,1), prog=p<.6?.3:lerp(.2,1,ease(cyc));
    g.strokeStyle='rgba(255,255,255,.25)'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(x0,lvl); g.lineTo(x1,lvl); g.stroke(); g.setLineDash([]); txt(g,'FL120 '+L({en:'selected',no:'valgt'}),x1,lvl-6,{mono:1,size:10*fs,col:'#7FC6EE',al:'right'});
    const path=u=>{ const x=lerp(x0,x1,u), cap=.62, y=u<cap?lerp(y1,lvl+16,u/cap):lerp(lvl+16,lvl,1-Math.pow(1-(u-cap)/(1-cap),3)); return [x,y]; };
    g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=2; g.beginPath(); for(let u=0;u<=prog;u+=.01){ const q=path(u); u?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]); } g.stroke();
    const q=path(prog); g.fillStyle='#fff'; g.beginPath(); g.arc(q[0],q[1],4,0,7); g.fill();
    // FMA columns for the current state
    const st=prog<.6?[['THR CLB',''],['CLB','ALT'],['NAV','']]:prog<.95?[['THR CLB',''],['ALT*',''],['NAV','']]:[['SPEED',''],['ALT',''],['NAV','']];
    const fw=Math.min(W*.86,560), fx=(W-fw)/2, fy=H*.1, fh=sm?H*.16:H*.2;
    fma(g,fx,fy,fw,fh,st,prog>=.6&&prog<.95?1:prog>=.95?0:-1);
    const cw=fw/3; ['THRUST','VERTICAL','LATERAL'].forEach((t,i)=>txt(g,L({en:t,no:['SKYV','VERTIKALT','SIDEVEIS'][i]}),fx+cw*i+cw/2,fy+fh+16,{mono:1,size:9.5*fs,col:'#8E99A4',al:'center'}));
    if(p<1){ pill(g,L({en:'green: active now',no:'grønt: aktiv nå'}),fx+cw*1.5,fy+fh+44,{size:10.5*fs,col:C.green,al:'center'}); pill(g,L({en:'blue: armed, next',no:'blått: armert, neste'}),fx+cw*1.5,fy+fh+70,{size:10.5*fs,col:'#7FC6EE',al:'center'}); }
    else if(prog>=.6&&prog<.95) pill(g,L({en:'mode change: boxed for 10 s',no:'modusbytte: innrammet i 10 s'}),fx+cw*1.5,fy+fh+44,{size:10.5*fs,col:'#fff',al:'center'});
    g.restore(); }
  if(tcA>0.01){ g.save(); g.globalAlpha=tcA;
    const cx=W*(sm?.5:.34), cy=H*.52, R=Math.min(W*(sm?.36:.22),H*.4);
    // ND-style TCAS display
    g.strokeStyle='rgba(255,255,255,.2)'; g.setLineDash([2,4]); g.beginPath(); g.arc(cx,cy,R*.5,0,7); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(cx,cy,R,Math.PI*1.1,Math.PI*1.9); g.stroke();
    g.fillStyle='#F0B440'; g.beginPath(); g.moveTo(cx,cy-8); g.lineTo(cx+7,cy+8); g.lineTo(cx,cy+4); g.lineTo(cx-7,cy+8); g.closePath(); g.fill();
    const ra=at(p,3,.6), k=(tm*.12)%1, tx=cx+R*lerp(.75,.2,ra?clamp(k*1.4,0,1):k), ty=cy-R*lerp(.65,.18,ra?clamp(k*1.4,0,1):k);
    const col=ra>.5?C.red:C.amber;
    if(ra>.5){ g.fillStyle=col; g.fillRect(tx-6,ty-6,12,12); } else { g.fillStyle=col; g.beginPath(); g.arc(tx,ty,6.5,0,7); g.fill(); }
    txt(g,ra>.5?'−02 ↑':'−04 ↑',tx+10,ty-8,{mono:1,size:11*fs,col});
    pill(g,ra>.5?'"CLIMB, CLIMB"':'"TRAFFIC, TRAFFIC"',cx,cy+R*.75,{mono:1,size:12*fs,col,al:'center'});
    txt(g,ra>.5?L({en:'≈ 25 s to closest point',no:'≈ 25 s til nærmeste punkt'}):L({en:'≈ 40 s to closest point',no:'≈ 40 s til nærmeste punkt'}),cx,cy+R*.75+26,{size:10.5*fs,col:'#AEB8C1',al:'center'});
    // VSI with RA bands
    if(!sm||ra>.5){ const vx=sm?W*.86:W*.74, vy=cy, vh=R*1.4, Y=v=>vy-v/6000*vh*.5;
      rr(g,vx-26,vy-vh/2,52,vh,6); g.fillStyle='#05080b'; g.fill(); g.strokeStyle='rgba(255,255,255,.2)'; g.stroke();
      if(ra>.01){ g.save(); g.globalAlpha*=ra; g.fillStyle='rgba(236,90,71,.7)'; g.fillRect(vx-24,Y(1500),12,Y(-6000)-Y(1500)); g.fillStyle='rgba(113,204,147,.8)'; g.fillRect(vx-24,Y(2500),12,Y(1500)-Y(2500)); g.restore(); }
      [-6,-2,0,2,6].forEach(v=>txt(g,String(Math.abs(v)),vx+12,Y(v*1000)+4,{mono:1,size:10*fs,col:'#AEB8C1'}));
      const vs=ra>.5?lerp(0,1800,clamp((tm%6)/3,0,1)):0; g.strokeStyle='#fff'; g.lineWidth=2.5; g.beginPath(); g.moveTo(vx+4,vy); g.lineTo(vx-20,Y(vs)); g.stroke();
      if(ra>.5) txt(g,L({en:'fly the green',no:'fly i det grønne'}),vx,vy+vh/2+16,{size:10.5*fs,col:'#8EDDB0',al:'center',w:600}); }
    g.restore(); }
  if(gpA>0.01){ g.save(); g.globalAlpha=gpA;
    const gy=H*.88, terr=x=>gy-H*(.12+.55*Math.exp(-Math.pow((x/W-.72)/.1,2))+.15*Math.exp(-Math.pow((x/W-.5)/.12,2)));
    g.fillStyle='#2a3a2e'; g.beginPath(); g.moveTo(0,H); for(let x=0;x<=W;x+=4) g.lineTo(x,terr(x)); g.lineTo(W,H); g.closePath(); g.fill();
    // EGPWS colouring near the aircraft altitude
    const alt=H*.42; g.save(); g.beginPath(); g.moveTo(0,H); for(let x=0;x<=W;x+=4) g.lineTo(x,terr(x)); g.lineTo(W,H); g.closePath(); g.clip();
    g.fillStyle='rgba(236,90,71,.55)'; g.fillRect(0,0,W,alt); g.fillStyle='rgba(240,180,64,.4)'; g.fillRect(0,alt,W,H*.1); g.restore();
    txt(g,L({en:'red: above you',no:'rødt: over deg'}),W*.72,terr(W*.72)+20,{size:10.5*fs,col:'#fff',al:'center',w:600});
    const k=(tm*.1)%1, ax=lerp(W*.08,W*.5,k), pull=ax>W*.36, ay=pull?alt-Math.pow((ax-W*.36)/(W*.14),1.6)*H*.22:alt, pa=pull?14:0;
    // look-ahead envelope
    g.strokeStyle='rgba(240,180,64,.6)'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(ax,ay); g.lineTo(ax+W*.22,ay+H*.06); g.stroke(); g.setLineDash([]);
    jet(g,{x:ax,y:ay+2.4*Math.max(1.4,W/450),s:Math.max(1.4,W/450),pitch:pa,gear:0,tm});
    pill(g,pull?'"PULL UP"':'"TERRAIN AHEAD"',W*.5,H*.1,{mono:1,size:13*fs,col:pull?C.red:C.amber,al:'center'});
    if(pull) pill(g,L({en:'TOGA · pitch up · wings level',no:'TOGA · nesen opp · vingene rett'}),W*.5,H*.1+30,{size:11*fs,col:'#fff',al:'center',fit:W});
    pill(g,L({en:'look-ahead: database terrain',no:'ser fremover: terrengdatabase'}),ax+W*.22,ay+H*.06+18,{size:10*fs,col:C.amber,al:'center',fit:W});
    g.restore(); }
  txt(g,L({en:'generic display · illustrative',no:'generisk visning · illustrerende'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.1,dwell:7,
    title:{en:'Automation and the two safety nets',no:'Automatikk og de to sikkerhetsnettene'},
    sub:{en:'Know what the autopilot is doing by reading the FMA, then the two warnings that tell you to take over: TCAS and EGPWS.',no:'Vit hva autopiloten gjør ved å lese FMA, og så de to varslene som sier at du skal ta over: TCAS og EGPWS.'},
    label:{en:'Animated FMA through a climb and level capture, a TCAS display with a traffic and a resolution advisory and the vertical speed band, then terrain ahead and a pull-up.',no:'Animert FMA gjennom en stigning og nivåfangst, en TCAS-visning med trafikkråd og unnvikelsesråd og vertikalfartsfeltet, deretter terreng foran og en pull-up.'},
    foot:{en:'Generic Airbus-style FMA; TCAS II times are typical values that vary with altitude. Follow your operator\'s procedures.',no:'Generisk FMA i Airbus-stil; TCAS II-tidene er typiske verdier som varierer med høyden. Følg operatørens prosedyrer.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
