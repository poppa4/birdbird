/* NORDAP – pic-vmc.js: "Engine failure and VMCA" for propeller.html (uses corepic.js).
   A light twin seen from above: the live engine's thrust and the dead engine's drag yaw the aircraft; the fin and rudder
   push back with a force that grows with V². VMCA is the speed where full rudder (and up to 5° of bank) just holds it.
   Illustrative light twin: VMCA 73 kt, Vyse 85 kt. Not AFM data. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const VMCA=73, VYSE=85, VSTART=110;
/* speed for each step */
const SPD=[VSTART,VSTART,92,VMCA,VMCA,64,VMCA];
const spd=p=>{ const i=clamp(Math.floor(p),0,SPD.length-2), k=ease(clamp(p-i,0,1)); return lerp(SPD[i],SPD[i+1],k); };

const steps=[
 {t:{en:'One engine stops',no:'Én motor stopper'},
  d:{en:'The live engine still pulls on its side; the dead one now <em>drags</em> on the other (a windmilling propeller is a big disc of drag). Together they swing the nose towards the dead engine: <em>yaw</em>.',
     no:'Den levende motoren drar fortsatt på sin side; den døde <em>bremser</em> på den andre (en propell som vindmøller er en stor skive av motstand). Sammen svinger de nesen mot den døde motoren: <em>gir</em>.'}},
 {t:{en:'The rudder pushes back',no:'Sideroret presser tilbake'},
  d:{en:'Full rudder makes a side force on the fin, far behind the CG. That force grows with the <em>square of the speed</em>. At 110 kt there is plenty; the bar shows what the rudder can give against what the engine asks for.',
     no:'Fullt sideror gir en sidekraft på halefinnen, langt bak tyngdepunktet. Kraften øker med <em>farten i annen</em>. Ved 110 kt er det godt med margin; søylen viser hva sideroret kan gi mot det motoren krever.'}},
 {t:{en:'Slow down · the margin shrinks',no:'Senk farten · marginen krymper'},
  d:{en:'The engine yaw stays almost the same, but the rudder loses power fast as the speed falls. Climbing slowly on one engine is exactly where this bites.',
     no:'Giringen fra motoren holder seg nesten lik, men sideroret mister kraft raskt når farten synker. Langsom stigning på én motor er akkurat der dette biter.'}},
 {t:{en:'VMCA · the edge of control',no:'VMCA · grensen for kontroll'},
  d:{en:'The slowest speed where full rudder, with <em>up to 5° of bank towards the live engine</em>, still holds a straight line. On a light twin it is the <em>red line</em> on the airspeed indicator.',
     no:'Den laveste farten der fullt sideror, med <em>inntil 5° krengning mot den levende motoren</em>, fortsatt holder flyet rett. På et lett tomotors fly er det den <em>røde streken</em> på fartsmåleren.'}},
 {t:{en:'Bank 5° towards the live engine',no:'Krenge 5° mot den levende motoren'},
  d:{en:'Wings level, the aircraft slips and the fin works against you. A few degrees of bank towards the live engine (<em>ball half out</em> to that side) cancel the slip and lower VMCA. More bank does not help.',
     no:'Med vingene rett glir flyet sidelengs, og finnen jobber mot deg. Noen få graders krengning mot den levende motoren (<em>kula en halv bredde ut</em> mot den siden) fjerner glidningen og senker VMCA. Mer krengning hjelper ikke.'}},
 {t:{en:'Below VMCA · it yaws and rolls',no:'Under VMCA · det girer og ruller'},
  d:{en:'Slower than VMCA the rudder cannot hold it: the aircraft yaws and rolls towards the dead engine. The only cure is to <em>reduce power on the live engine</em> and lower the nose to regain speed.',
     no:'Saktere enn VMCA klarer ikke sideroret å holde: flyet girer og ruller mot den døde motoren. Eneste kur er å <em>redusere effekten på den levende motoren</em> og senke nesen for å få tilbake farten.'}},
 {t:{en:'What moves VMCA',no:'Hva som flytter VMCA'},
  d:{en:'Higher with more thrust (low and cold), an <em>aft CG</em> (shorter rudder arm), a windmilling propeller and wings level. Lower with a feathered propeller and 5° of bank. Fly <em>Vyse (blue line)</em> to climb.',
     no:'Høyere med mer skyvekraft (lavt og kaldt), <em>bakre tyngdepunkt</em> (kortere rorarm), vindmøllende propell og vingene rett. Lavere med fjæret propell og 5° krengning. Fly <em>Vyse (blå strek)</em> for å stige.'},
  go:{en:'Open the engine failure lab',no:'Åpne motorstanslabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* light twin from above, nose up; s = px per m; yaw in deg (positive nose right); dead: which engine is out ('L') */
function twinTop(g,x,y,s,yaw,prop,tm){
  g.save(); g.translate(x,y); g.rotate(yaw*Math.PI/180);
  const P=v=>v*s;
  g.fillStyle='#E4E9ED'; g.strokeStyle='rgba(10,16,21,.6)'; g.lineWidth=1;
  // wing
  g.beginPath(); g.moveTo(P(-6.8),P(-0.4)); g.lineTo(P(6.8),P(-0.4)); g.lineTo(P(6.8),P(0.7)); g.lineTo(P(-6.8),P(0.7)); g.closePath(); g.fill(); g.stroke();
  // tailplane
  g.beginPath(); g.moveTo(P(-2.3),P(5.2)); g.lineTo(P(2.3),P(5.2)); g.lineTo(P(2.3),P(5.9)); g.lineTo(P(-2.3),P(5.9)); g.closePath(); g.fill(); g.stroke();
  // fuselage
  g.beginPath(); g.moveTo(0,P(-4.2)); g.quadraticCurveTo(P(0.75),P(-3.7),P(0.65),P(-2.2)); g.lineTo(P(0.5),P(3.5)); g.lineTo(P(0.18),P(6.2)); g.lineTo(P(-0.18),P(6.2)); g.lineTo(P(-0.5),P(3.5)); g.lineTo(P(-0.65),P(-2.2)); g.quadraticCurveTo(P(-0.75),P(-3.7),0,P(-4.2)); g.closePath(); g.fill(); g.stroke();
  g.fillStyle='#2B3B4A'; g.beginPath(); g.ellipse(0,P(-2.9),P(.42),P(.7),0,0,7); g.fill();
  // fin (seen from above: a line)
  g.strokeStyle='#9A1E68'; g.lineWidth=Math.max(2,P(.2)); g.beginPath(); g.moveTo(0,P(4.4)); g.lineTo(0,P(6.3)); g.stroke();
  // nacelles and propellers
  [-2.2,2.2].forEach((ex,i)=>{ g.fillStyle='#CBD3DA'; g.strokeStyle='rgba(10,16,21,.6)'; g.lineWidth=1; g.beginPath(); g.ellipse(P(ex),P(-0.6),P(.45),P(1.7),0,0,7); g.fill(); g.stroke();
    const dead=i===0, ph=dead?(prop.wm?tm*3:0):tm*40; g.strokeStyle=dead?(prop.feather?'rgba(200,210,220,.9)':'rgba(236,90,71,.85)'):'rgba(230,236,240,.35)'; g.lineWidth=Math.max(1.5,P(.16));
    if(!dead){ g.fillStyle='rgba(230,236,240,.12)'; g.beginPath(); g.ellipse(P(ex),P(-2.5),P(1.0),P(.12),0,0,7); g.fill(); }
    else { const w=prop.feather?0.12:0.6; g.beginPath(); g.moveTo(P(ex-1.0*Math.cos(ph)),P(-2.5)); g.lineTo(P(ex+1.0*Math.cos(ph)),P(-2.5)); g.stroke(); g.globalAlpha*=1; g.fillStyle=g.strokeStyle; g.fillRect(P(ex)-P(1),P(-2.5)-P(w)/2*0.2,0,0); }
    g.fillStyle='#8C98A2'; g.beginPath(); g.arc(P(ex),P(-2.5),P(.2),0,7); g.fill(); });
  g.restore(); }

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const V=spd(p), below=at(p,5,.7)*(1-at(p,6,.7));
  const bank=at(p,4,.8)*(1-below)*5;
  const s=Math.max(9,Math.min(W*(sm?.055:.034),H*.062)), cx=W*(sm?.5:.33), cy=H*(sm?.42:.52);
  // the yaw the aircraft takes: none while controlled; grows below VMCA
  const yawUn=below>0.01?-(Math.min(1,((tm*.6)%2.2)/2.2))*24*below:0;
  // background: drifting ground lines to show motion
  g.save(); g.strokeStyle='rgba(255,255,255,.05)'; g.lineWidth=1; const off=(tm*V*.6)%40; for(let y=-40;y<H+40;y+=40){ g.beginPath(); g.moveTo(0,y+off); g.lineTo(W,y+off); g.stroke(); } g.restore();
  // heading line
  g.strokeStyle='rgba(127,198,238,.3)'; g.setLineDash([6,6]); g.beginPath(); g.moveTo(cx,H*.04); g.lineTo(cx,H*.96); g.stroke(); g.setLineDash([]);
  twinTop(g,cx,cy,s,yawUn,{wm:p<6.5,feather:p>6.5},tm);
  // forces in the aircraft frame
  g.save(); g.translate(cx,cy); g.rotate(yawUn*Math.PI/180);
  const ex=2.2*s, T=s*4.4, Dd=s*1.6;
  const a0=at(p,0,.6);
  // live (right) engine thrust, dead (left) engine drag
  arrow(g,ex,-2.6*s,ex,-2.6*s-T,C.mag,{lw:3.4,head:12}); pill(g,L({en:'live engine: thrust',no:'levende motor: skyvekraft'}),ex+12,-2.6*s-T+8,{size:11*fs,col:C.mag});
  arrow(g,-ex,-1.2*s,-ex,-1.2*s+Dd,C.red,{lw:3.2,head:10}); pill(g,L({en:'dead engine: drag',no:'død motor: motstand'}),-ex-12,-1.2*s+Dd+10,{size:11*fs,col:'#FF8A78',al:'right'});
  // yaw moment arc
  g.strokeStyle=C.amber; g.lineWidth=2.5; g.beginPath(); g.arc(0,0,s*3.2,-Math.PI*0.95,-Math.PI*0.62); g.stroke();
  arrow(g,s*3.2*Math.cos(-Math.PI*0.66),s*3.2*Math.sin(-Math.PI*0.66),s*3.2*Math.cos(-Math.PI*0.95),s*3.2*Math.sin(-Math.PI*0.95),C.amber,{lw:2.5,head:10});
  pill(g,L({en:'yaw towards the dead engine',no:'gir mot den døde motoren'}),-s*3.4,-s*3.6,{size:11*fs,col:C.amber,al:'right',fit:W});
  // rudder side force at the fin (grows with V²) — pushes the tail left (nose right)
  const rud=at(p,1,.7), Fr=(V/VMCA)*(V/VMCA)*s*2.4;
  if(rud>0.01){ g.save(); g.globalAlpha*=rud; arrow(g,0.1*s,5.6*s,0.1*s-Fr,5.6*s,C.blue,{lw:3.4,head:11}); pill(g,L({en:'full rudder: side force ∝ V²',no:'fullt sideror: sidekraft ∝ V²'}),-Fr-8,5.6*s+18,{size:11*fs,col:C.blue,al:'right',fit:W}); g.restore(); }
  g.restore();
  // bank / ball (step 5)
  if(bank>0.1){ const bx=sm?W*.2:W*.12, by=H*.12; g.save(); g.globalAlpha=Math.min(1,bank/5);
    pill(g,`${L({en:'bank',no:'krengning'})} ${nf(bank)}° → ${L({en:'live engine',no:'levende motor'})}`,bx,by-20,{size:11*fs,col:C.green,al:'center',fit:W});
    rr(g,bx-44,by-6,88,16,8); g.fillStyle='#0b1116'; g.fill(); g.strokeStyle='rgba(255,255,255,.3)'; g.stroke(); g.strokeStyle='rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(bx-9,by-6); g.lineTo(bx-9,by+10); g.moveTo(bx+9,by-6); g.lineTo(bx+9,by+10); g.stroke();
    g.fillStyle='#fff'; g.beginPath(); g.arc(bx+8*bank/5,by+2,6,0,7); g.fill(); txt(g,L({en:'ball ½ out',no:'kula ½ ut'}),bx,by+26,{size:10*fs,col:'#AEB8C1',al:'center'}); g.restore(); }
  // the authority bar
  const bx=W*(sm?.08:.64), by=H*(sm?.78:.18), bw=W*(sm?.84:.3), bh=sm?H*.18:H*.62;
  rr(g,bx,by,bw,bh,8); g.fillStyle='rgba(10,15,20,.85)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
  txt(g,L({en:'RUDDER AGAINST ENGINE',no:'SIDEROR MOT MOTOR'}),bx+12,by+18,{mono:1,size:9.5*fs,col:'#8E99A4'});
  // speed tape (vertical on desktop)
  const need=1-0.06*bank/5;                        // yaw to cancel, in units of what full rudder gives at VMCA (bank lowers it)
  const have=Math.pow(V/VMCA,2)*(1-0.0);           // what full rudder gives
  const ok=have>=need-1e-6;
  if(!sm){ const tx=bx+20, ty0=by+44, ty1=by+bh-24, Vlo=55, Vhi=120, Y=v=>ty1-(ty1-ty0)*(v-Vlo)/(Vhi-Vlo);
    g.fillStyle='rgba(255,255,255,.05)'; g.fillRect(tx,ty0,30,ty1-ty0);
    // red line and blue line
    g.fillStyle=C.red; g.fillRect(tx,Y(VMCA)-1.5,30,3); g.fillStyle='#4E8FE0'; g.fillRect(tx,Y(VYSE)-1.5,30,3);
    for(let v=60;v<=120;v+=10){ txt(g,String(v),tx+36,Y(v)+4,{mono:1,size:10,col:'#7F8B96'}); }
    g.fillStyle='#fff'; g.beginPath(); g.moveTo(tx-2,Y(V)); g.lineTo(tx-12,Y(V)-6); g.lineTo(tx-12,Y(V)+6); g.closePath(); g.fill();
    txt(g,`${nf(V)} kt`,tx-14,Y(V)-10,{mono:1,size:11,col:'#fff',al:'right'});
    txt(g,'VMCA',tx+60,Y(VMCA)+4,{mono:1,size:10,col:'#FF8A78'}); txt(g,'Vyse',tx+60,Y(VYSE)+4,{mono:1,size:10,col:'#7FB0F0'});
    // the two bars
    const b0=bx+bw*.55, bW=bw*.16, base=ty1, scale=(ty1-ty0)/2.4;
    g.fillStyle='rgba(240,180,64,.85)'; g.fillRect(b0,base-need*scale,bW,need*scale);
    g.fillStyle=ok?'rgba(127,198,238,.9)':'rgba(236,90,71,.9)'; g.fillRect(b0+bW+10,base-Math.min(2.4,have)*scale,bW,Math.min(2.4,have)*scale);
    txt(g,L({en:'engine',no:'motor'}),b0+bW/2,base+14,{size:10,col:C.amber,al:'center'}); txt(g,L({en:'rudder',no:'sideror'}),b0+bW*1.5+10,base+14,{size:10,col:ok?C.blue:'#FF8A78',al:'center'});
    pill(g,ok?(Math.abs(have-need)<.04?L({en:'just enough',no:'akkurat nok'}):L({en:'controllable',no:'styrbart'})):L({en:'not enough',no:'ikke nok'}),b0+bW+5,ty0+4,{size:11,col:ok?C.green:'#FF8A78',al:'center'}); }
  else { const tx=bx+12, ty=by+bh*.62, tw=bw-24, Vlo=55, Vhi=120, X=v=>tx+tw*(v-Vlo)/(Vhi-Vlo);
    g.fillStyle='rgba(255,255,255,.06)'; g.fillRect(tx,ty-6,tw,12); g.fillStyle=C.red; g.fillRect(X(VMCA)-1.5,ty-8,3,16); g.fillStyle='#4E8FE0'; g.fillRect(X(VYSE)-1.5,ty-8,3,16);
    g.fillStyle='#fff'; g.beginPath(); g.moveTo(X(V),ty-8); g.lineTo(X(V)-6,ty-16); g.lineTo(X(V)+6,ty-16); g.closePath(); g.fill();
    txt(g,`${nf(V)} kt · ${ok?L({en:'controllable',no:'styrbart'}):L({en:'not enough rudder',no:'ikke nok sideror'})}`,tx,ty+24,{mono:1,size:11,col:ok?'#8EDDB0':'#FF8A78'}); }
  txt(g,L({en:'illustrative light twin · not AFM data',no:'illustrerende lett tomotors · ikke AFM-data'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.6,aspectSm:1/1.2,dwell:6.5,
    title:{en:'Engine failure: why there is a minimum control speed',no:'Motorstans: hvorfor det finnes en minste kontrollfart'},
    sub:{en:'A tug of war between the live engine and the rudder. Slow down and watch the rudder lose.',no:'En dragkamp mellom den levende motoren og sideroret. Senk farten og se sideroret tape.'},
    label:{en:'Animated top view of a light twin with the left engine failed: thrust, drag, yaw and the rudder force, with a bar comparing rudder authority with the engine yaw as the speed falls to VMCA.',no:'Animert ovenfra-bilde av et lett tomotors fly med venstre motor ute: skyvekraft, motstand, giring og siderorskraft, med en søyle som sammenligner siderorets kraft med giringen fra motoren når farten synker til VMCA.'},
    foot:{en:'Illustrative light twin (VMCA 73 kt, Vyse 85 kt); rudder side force ∝ V². CS-23/25 allow up to 5° of bank towards the live engine when VMCA is set. Not AFM data.',no:'Illustrerende lett tomotors fly (VMCA 73 kt, Vyse 85 kt); siderorets sidekraft ∝ V². CS-23/25 tillater inntil 5° krengning mot den levende motoren når VMCA fastsettes. Ikke AFM-data.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
