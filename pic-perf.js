/* NORDAP – pic-perf.js: "Take-off speeds in one picture" for performance.html (uses corepic.js).
   One certified take-off with an engine failure, from brake release to 35 ft: the speed line on top (CAS),
   the runway below, and a leader from each speed to the place it happens.
   Illustrative, rounded jet values near 70 t on a 2 000 m dry runway, chosen to satisfy CS-25.107/149:
   VEF ≥ VMCG, V1 ≥ VEF + recognition, V1 ≤ VR, V1 ≤ VMBE, VR ≥ 1.05 VMCA, VLOF ≥ 1.10 VMU, V2 ≥ 1.13 VSR and ≥ 1.10 VMCA.
   Distances from constant accelerations (2.0 m/s² all engines, 1.35 m/s² one out, 2.9 m/s² braking after 2 s). Not AFM data. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,jet,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const KT=0.514444;
const SP={vmcg:108,vmca:112,vsr:124,vmu:124,vef:124,v1:127,vr:133,vlof:138,v2:142,vmbe:160};
const TORA=2000, TODA=2250, CLR=TODA-TORA;
const dAEO=v=>Math.pow(v*KT,2)/(2*2.0);
const D={vmcg:dAEO(SP.vmcg),vef:dAEO(SP.vef)};
D.v1=D.vef+(Math.pow(SP.v1*KT,2)-Math.pow(SP.vef*KT,2))/(2*1.35);
D.vr=D.v1+(Math.pow(SP.vr*KT,2)-Math.pow(SP.v1*KT,2))/(2*1.35);
D.vlof=D.vr+(Math.pow(SP.vlof*KT,2)-Math.pow(SP.vr*KT,2))/(2*1.35);
D.v2=D.vlof+480;
D.stop=D.v1+2*SP.v1*KT+Math.pow(SP.v1*KT,2)/(2*2.9);
/* key frames, one per step: distance m, CAS kt, height ft, pitch deg, engine (near) 1 running 0 failed */
const K=[
  {d:dAEO(84),v:84,h:0,th:0,e:1},
  {d:D.vmcg,v:SP.vmcg,h:0,th:0,e:1},
  {d:D.vef,v:SP.vef,h:0,th:0,e:0},
  {d:D.v1,v:SP.v1,h:0,th:0,e:0},
  {d:D.vr,v:SP.vr,h:0,th:1.5,e:0},
  {d:D.vlof,v:SP.vlof,h:0,th:8.5,e:0},
  {d:D.v2,v:SP.v2,h:35,th:12,e:0},
  {d:D.v2+330,v:SP.v2,h:58,th:12,e:0}];
function state(p){ const i=clamp(Math.floor(p),0,K.length-2), k=clamp(p-i,0,1), a=K[i], b=K[i+1], e=ease(k);
  // ground roll speeds up over distance: interpolate v² linearly in distance for a natural acceleration
  const d=lerp(a.d,b.d,e), v2=lerp(a.v*a.v,b.v*b.v,e), v=Math.sqrt(v2);
  return {d,v,h:lerp(a.h,b.h,e),th:lerp(a.th,b.th,e),e:lerp(a.e,b.e,clamp(k*1.6,0,1))}; }

const steps=[
 {t:{en:'One line of speeds, one runway',no:'Én fartslinje, én rullebane'},
  d:{en:'Every take-off speed is a <em>calibrated airspeed</em> (the scale on top) and each one happens at a place on the runway (below). The certified take-off plans for the worst case: <em>an engine fails</em>.',
     no:'Hver startfart er en <em>kalibrert fart</em> (skalaen øverst), og hver av dem skjer et bestemt sted på rullebanen (nederst). Den sertifiserte avgangen planlegger for det verste: <em>en motor stopper</em>.'}},
 {t:{en:'VMCG · minimum control speed on the ground',no:'VMCG · minste kontrollfart på bakken'},
  d:{en:'Below VMCG, a sudden engine failure would yaw you off the runway even with full rudder. At VMCG you can keep the aircraft within <em>30 ft (9 m)</em> of the centreline using the rudder alone.',
     no:'Under VMCG vil en plutselig motorstans gire flyet av banen selv med fullt sideror. Ved VMCG holder du flyet innenfor <em>30 ft (9 m)</em> fra senterlinjen med bare sideroret.'}},
 {t:{en:'VEF · engine failure speed',no:'VEF · motorstansfart'},
  d:{en:'The speed at which the critical engine is assumed to fail. It is <em>never below VMCG</em>, so whatever you decide next, you can keep the aircraft on the runway.',
     no:'Farten der den kritiske motoren antas å stoppe. Den er <em>aldri under VMCG</em>, så uansett hva du bestemmer deg for, holder du flyet på banen.'}},
 {t:{en:'V1 · the decision speed',no:'V1 · beslutningsfarten'},
  d:{en:'The <em>latest</em> speed to start stopping and the <em>earliest</em> to continue. Stop before V1: you stop within ASDA. Go from V1: you reach 35 ft within TODA. V1 includes the speed gained while you recognise the failure, and is never above VR or VMBE (brake energy).',
     no:'Den <em>seneste</em> farten for å begynne å stoppe og den <em>tidligste</em> for å fortsette. Stopp før V1: du står innenfor ASDA. Fortsett fra V1: du er 35 ft over banen innen TODA. V1 tar med farten du får mens du oppdager feilen, og er aldri over VR eller VMBE (bremseenergi).'}},
 {t:{en:'VR · rotation speed',no:'VR · rotasjonsfart'},
  d:{en:'You pull and the nose comes up at about <em>3° per second</em>. VR is never below V1 and never below <em>1.05 × VMCA</em>, so you are controllable in the air when the wheels leave.',
     no:'Du trekker, og nesen kommer opp med omtrent <em>3° i sekundet</em>. VR er aldri under V1 og aldri under <em>1,05 × VMCA</em>, så flyet er styrbart i luften når hjulene slipper.'}},
 {t:{en:'VLOF · lift-off speed',no:'VLOF · avløftingsfart'},
  d:{en:'The main wheels leave the runway. VLOF must be at least <em>1.10 × VMU</em> (1.05 × with one engine out): the wing really flies, with margin, and the tail stays clear of the runway.',
     no:'Hovedhjulene slipper banen. VLOF må være minst <em>1,10 × VMU</em> (1,05 × med én motor ute): vingen bærer virkelig, med margin, og halen går klar av banen.'}},
 {t:{en:'V2 · take-off safety speed',no:'V2 · sikker startfart'},
  d:{en:'Reached by <em>35 ft</em> above the runway with one engine out, no later than the end of TODA. V2 is at least <em>1.13 × VSR</em> (stall margin) and <em>1.10 × VMCA</em>. Hold V2 until the acceleration height.',
     no:'Nås senest <em>35 ft</em> over banen med én motor ute, ved enden av TODA. V2 er minst <em>1,13 × VSR</em> (stallmargin) og <em>1,10 × VMCA</em>. Hold V2 til akselerasjonshøyden.'}},
 {t:{en:'The order never changes',no:'Rekkefølgen er alltid den samme'},
  d:{en:'<em>VMCG ≤ VEF &lt; V1 ≤ VR &lt; VLOF &lt; V2.</em> VMBE caps V1 from above; VSR and VMCA set the floor for V2. Change the mass, wind and runway yourself in the runway lab.',
     no:'<em>VMCG ≤ VEF &lt; V1 ≤ VR &lt; VLOF &lt; V2.</em> VMBE setter taket for V1; VSR og VMCA setter gulvet for V2. Endre masse, vind og bane selv i rullebanelabben.'},
  go:{en:'Open the runway lab',no:'Åpne rullebanelabben',fn:()=>{ const v=document.getElementById('pfVp'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

/* colours of each speed */
const COL={vmcg:C.amber,vef:C.red,v1:C.mag,vr:C.blue,vlof:'#9FE0F5',v2:C.green,vmca:C.violet,vsr:'#8E99A4',vmbe:'#F08A78',vmu:'#8E99A4'};
const NM={vmcg:'VMCG',vef:'VEF',v1:'V1',vr:'VR',vlof:'VLOF',v2:'V2',vmca:'VMCA',vsr:'VSR',vmbe:'VMBE',vmu:'VMU'};
const LV={vmcg:0,vmca:1,vsr:2,vef:1,v1:0,vr:1,vlof:0,v2:1,vmbe:0};
const ORDER=[['vmcg',1],['vef',2],['v1',3],['vr',4],['vlof',5],['v2',6]];

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const yG=H*(sm?.79:.8), rx0=W*.055, rx1=W*.955, X=d=>rx0+(rx1-rx0)*d/TODA, hpx=h=>h/35*H*.17;
  const sx0=W*.07, sx1=W*.93, vLo=96, vHi=166, SX=v=>sx0+(sx1-sx0)*(v-vLo)/(vHi-vLo), sy=Math.max(74*fs,H*.16);
  const S=state(p), fin=at(p,7,.8);
  // sky and ground
  const sky=g.createLinearGradient(0,0,0,yG); sky.addColorStop(0,'#16212c'); sky.addColorStop(1,'#26364a'); g.fillStyle=sky; g.fillRect(0,0,W,yG);
  g.fillStyle='rgba(120,150,175,.10)'; g.beginPath(); g.moveTo(0,yG); for(let x=0;x<=W;x+=W/40){ g.lineTo(x,yG-6-10*Math.abs(Math.sin(x*.013+1.3))*Math.abs(Math.cos(x*.004))); } g.lineTo(W,yG); g.closePath(); g.fill();
  const gr=g.createLinearGradient(0,yG,0,H); gr.addColorStop(0,'#1b2a22'); gr.addColorStop(1,'#101813'); g.fillStyle=gr; g.fillRect(0,yG,W,H-yG);
  // runway (seen from the side: a thin band) + clearway
  const rh=Math.max(7,H*.022);
  g.fillStyle='#3A444C'; g.fillRect(X(0),yG,X(TORA)-X(0),rh);
  g.fillStyle='rgba(255,255,255,.05)'; g.fillRect(X(TORA),yG,X(TODA)-X(TORA),rh*.6);
  g.setLineDash([4,4]); g.strokeStyle='rgba(255,255,255,.28)'; g.lineWidth=1; g.strokeRect(X(TORA)+.5,yG+.5,X(TODA)-X(TORA)-1,rh*.6); g.setLineDash([]);
  g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=1.2; g.setLineDash([10,9]); g.beginPath(); g.moveTo(X(60),yG+rh/2); g.lineTo(X(TORA-60),yG+rh/2); g.stroke(); g.setLineDash([]);
  for(let i=0;i<6;i++){ g.fillStyle='rgba(255,255,255,.8)'; g.fillRect(X(6)+i*3,yG+1.5,1.6,rh-3); }
  for(let d=0;d<=TORA;d+=100){ g.fillStyle='rgba(255,236,190,.65)'; g.fillRect(X(d)-1,yG-1.5,2,2); }
  // declared distances under the runway
  const yd=yG+rh+16*fs;
  const dim=(x0,x1,y,col,s)=>{ g.strokeStyle=col; g.lineWidth=1; g.beginPath(); g.moveTo(x0,y); g.lineTo(x1,y); g.moveTo(x0,y-4); g.lineTo(x0,y+4); g.moveTo(x1,y-4); g.lineTo(x1,y+4); g.stroke();
    pill(g,s,(x0+x1)/2,y,{mono:1,size:10*fs,col,bg:'#121b16',bd:'rgba(255,255,255,.12)',al:'center',fit:W}); };
  dim(X(0),X(TORA),yd,'#AEB8C1',`TORA = ASDA ${nf(TORA)} m`);
  dim(X(0),X(TODA),yd+22*fs,'#7F8B96',sm?`TODA ${nf(TODA)} m`:`TODA ${nf(TODA)} m (${L({en:'incl. clearway',no:'inkl. clearway'})} ${nf(CLR)} m)`);

  // speed scale on top
  g.strokeStyle='rgba(255,255,255,.22)'; g.lineWidth=1; g.beginPath(); g.moveTo(sx0,sy); g.lineTo(sx1,sy); g.stroke();
  for(let v=100;v<=165;v+=5){ const x=SX(v), maj=v%10===0; g.beginPath(); g.moveTo(x,sy); g.lineTo(x,sy+(maj?7:4)); g.stroke(); if(maj) txt(g,String(v),x,sy+19*fs,{mono:1,size:10*fs,col:'#7F8B96',al:'center'}); }
  txt(g,'kt CAS',sx0,sy+34*fs,{mono:1,size:9.5*fs,col:'#7F8B96'});
  // current speed marker on the scale
  if(S.v>vLo-1){ const x=SX(clamp(S.v,vLo,vHi)); g.fillStyle='#fff'; g.beginPath(); g.moveTo(x,sy-2); g.lineTo(x-6,sy-11); g.lineTo(x+6,sy-11); g.closePath(); g.fill();
    g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=2; g.beginPath(); g.moveTo(SX(vLo),sy); g.lineTo(x,sy); g.stroke(); }
  else { txt(g,`← ${nf(S.v)} kt`,sx0,sy-9,{mono:1,size:10.5*fs,col:'#fff'}); }

  // speed bugs + leaders to the runway
  const ax=X(S.d), ay=yG-hpx(S.h);
  const bug=(k,a,o)=>{ if(a<=0.01) return; o=o||{}; const x=SX(SP[k]), col=COL[k];
    g.save(); g.globalAlpha=a; g.strokeStyle=col; g.lineWidth=2; g.beginPath(); g.moveTo(x,sy-14); g.lineTo(x,sy+4); g.stroke();
    pill(g,NM[k],x,sy-(26+18*(LV[k]||0))*fs,{mono:1,size:10.5*fs,col,w:600,bg:'rgba(13,20,27,.92)'}); g.restore(); };
  const leader=(k,d,h,a,lab)=>{ if(a<=0.01) return; const x0=SX(SP[k]), y0=sy+5, x1=X(d), y1=yG-hpx(h)-2; g.save(); g.globalAlpha=a*.55; g.strokeStyle=COL[k]; g.lineWidth=1; g.setLineDash([2,4]);
    g.beginPath(); g.moveTo(x0,y0); g.bezierCurveTo(x0,y0+(y1-y0)*.45,x1,y1-(y1-y0)*.45,x1,y1); g.stroke(); g.setLineDash([]); g.globalAlpha=a;
    g.fillStyle=COL[k]; g.beginPath(); g.arc(x1,y1+2,3.2,0,7); g.fill(); g.restore(); };
  ORDER.forEach(([k,i])=>{ const a=at(p,i,.7), dk=k==='v2'?D.v2:D[k], hk=k==='v2'?35:0; leader(k,dk,hk,a*(1-.45*fin)); bug(k,a); });
  // limits revealed with V1 (VMBE) and in the summary (VMCA, VSR)
  bug('vmbe',at(p,3,.7)); bug('vmca',fin); bug('vsr',fin);

  // VMCG: seen from above, the lateral excursion
  const aIn=at(p,1,.7)*(1-at(p,2.6,.6));
  if(aIn>0){ const bx=W*(sm?.05:.5), bw=W*(sm?.9:.45), by=sy+(sm?58:64)*fs, bh=Math.min(H*.3,yG-by-H*.22); g.save(); g.globalAlpha=aIn;
    rr(g,bx,by,bw,bh,8); g.fillStyle='rgba(10,15,20,.82)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
    txt(g,L({en:'SEEN FROM ABOVE',no:'SETT OVENFRA'}),bx+12,by+18*fs,{mono:1,size:9.5*fs,col:'#8E99A4'});
    const ry0=by+bh*.4, ry1=by+bh*.74, rcx=(ry0+ry1)/2, rl=bx+16, rrx=bx+bw-14;
    g.fillStyle='#3A444C'; g.fillRect(rl,ry0,rrx-rl,ry1-ry0); g.strokeStyle='rgba(255,255,255,.5)'; g.setLineDash([8,7]); g.beginPath(); g.moveTo(rl,rcx); g.lineTo(rrx,rcx); g.stroke(); g.setLineDash([]);
    const lim=(ry1-ry0)*.22; g.strokeStyle='rgba(113,204,147,.5)'; g.setLineDash([2,3]); g.beginPath(); g.moveTo(rl,rcx-lim); g.lineTo(rrx,rcx-lim); g.stroke(); g.setLineDash([]);
    const fx=rl+(rrx-rl)*.18, kk=clamp((p-1)*1.4,0,1);
    // below VMCG: off the side
    g.strokeStyle=C.red; g.lineWidth=2.2; g.beginPath(); g.moveTo(rl,rcx+1); g.lineTo(fx,rcx+1); g.bezierCurveTo(fx+(rrx-rl)*.2,rcx,fx+(rrx-rl)*.32,ry0-6,fx+(rrx-rl)*.42*kk+(rrx-rl)*.02,ry0-22*kk); g.stroke();
    // at VMCG: held within 30 ft
    g.strokeStyle=C.green; g.beginPath(); g.moveTo(rl,rcx-1); g.lineTo(fx,rcx-1); g.bezierCurveTo(fx+(rrx-rl)*.18,rcx-1,fx+(rrx-rl)*.24,rcx-lim,fx+(rrx-rl)*.36,rcx-lim); g.lineTo(rl+(rrx-rl)*(.4+.6*kk),rcx-lim*.9); g.stroke();
    g.fillStyle=C.red; g.beginPath(); g.arc(fx,rcx,3.5,0,7); g.fill();
    txt(g,L({en:'below VMCG: off the runway',no:'under VMCG: av banen'}),rrx,by+18*fs,{size:11*fs,col:'#FF8A78',w:600,al:'right'});
    txt(g,L({en:'at VMCG: ≤ 30 ft (9 m), rudder only',no:'ved VMCG: ≤ 30 ft (9 m), bare sideror'}),rrx,ry1+15*fs,{size:11*fs,col:'#8EDDB0',w:600,al:'right'});
    g.restore(); }

  // V1: the two outcomes from the same point
  const a1=at(p,3,.8), fade1=1-.55*at(p,4.4,.8);
  if(a1>0){ const x1=X(D.v1); g.save(); g.globalAlpha=a1*fade1;
    // stop
    const xs=X(lerp(D.v1,D.stop,ease(a1))); g.strokeStyle=C.red; g.lineWidth=4; g.lineCap='butt'; g.beginPath(); g.moveTo(x1,yG+rh*.5); g.lineTo(xs,yG+rh*.5); g.stroke();
    g.fillStyle=C.red; g.fillRect(xs-1.5,yG-6,3,rh+12);
    pill(g,`${L({en:'STOP',no:'STOPP'})} · ${nf(D.stop)} m ≤ ASDA`,xs,yG-18*fs,{mono:1,size:10*fs,col:'#FF8A78',al:'right',fit:W});
    // go (one engine)
    g.strokeStyle=C.amber; g.lineWidth=2; g.setLineDash([6,5]); g.beginPath(); g.moveTo(x1,yG-3);
    const N=40; for(let i=1;i<=N;i++){ const d=lerp(D.v1,D.v2,i/N*ease(a1)); const h=d<D.vlof?0:35*Math.pow((d-D.vlof)/(D.v2-D.vlof),1.25); g.lineTo(X(d),yG-3-hpx(h)); }
    g.stroke(); g.setLineDash([]);
    if(a1>.9){ pill(g,`${L({en:'GO',no:'FORTSETT'})} · 35 ft ${L({en:'at',no:'ved'})} ${nf(D.v2)} m ≤ TODA`,X(D.v2)+8,yG-hpx(35)-22*fs,{mono:1,size:10*fs,col:C.amber,al:'center',fit:W}); }
    // recognition bracket VEF → V1
    const xe=X(D.vef); g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=1; const yb=yG+rh+4; g.beginPath(); g.moveTo(xe,yb); g.lineTo(xe,yb+5); g.lineTo(x1,yb+5); g.lineTo(x1,yb); g.stroke();
    g.restore(); }

  // 35 ft screen at the end of the go
  const a6=Math.max(at(p,3,.8)*.5,at(p,6,.8));
  if(a6>0){ const xs=X(D.v2), ys=yG-hpx(35); g.save(); g.globalAlpha=a6; g.strokeStyle='rgba(113,204,147,.75)'; g.setLineDash([3,4]); g.lineWidth=1;
    g.beginPath(); g.moveTo(xs-40,ys); g.lineTo(X(TODA)+6,ys); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(X(TODA),yG); g.lineTo(X(TODA),ys-8); g.stroke();
    txt(g,'35 ft',X(TODA)-4,ys-5,{mono:1,size:10*fs,col:'#8EDDB0',al:'right'}); g.restore(); }

  // the aircraft
  const s=Math.max(2.1,W/215);
  if(at(p,4,.6)>0&&at(p,4,.6)<1||(p>3.6&&p<4.9)){ const a=at(p,4,.6)*(1-at(p,5.2,.6)); if(a>0){ g.save(); g.globalAlpha=a; g.strokeStyle=C.blue; g.lineWidth=2;
      const cx=ax, cy=ay-3*s; g.beginPath(); g.arc(cx,cy,15*s,-0.55,-0.12); g.stroke(); arrow(g,cx+15*s*Math.cos(-0.5),cy+15*s*Math.sin(-0.5),cx+15*s*Math.cos(-0.62),cy+15*s*Math.sin(-0.62),C.blue,{head:8});
      pill(g,L({en:'rotate ≈ 3°/s',no:'roter ≈ 3°/s'}),cx+16*s,cy-15*s,{size:10.5*fs,col:C.blue}); g.restore(); } }
  jet(g,{x:ax,y:ay,s,pitch:S.th,gear:1,eng:[S.e,1],tm});
  // engine failure flash
  const fl=at(p,2,.5)*(1-at(p,2.9,.5)); if(fl>0){ const ex=ax+5.6*s, ey=ay-1.5*s; g.save(); g.globalAlpha=fl; g.strokeStyle=C.red; g.lineWidth=2; for(let r=0;r<2;r++){ g.beginPath(); g.arc(ex,ey,(10+r*9)*s/4*(1+.3*Math.sin(tm*8)),0,7); g.stroke(); }
    pill(g,L({en:'engine fails',no:'motoren stopper'}),ex,ey-34*fs,{size:11*fs,col:'#FF8A78',al:'center'}); g.restore(); }
  // lift-off cue
  const lo=at(p,5,.5)*(1-at(p,5.9,.5)); if(lo>0){ g.save(); g.globalAlpha=lo; pill(g,L({en:'wheels off',no:'hjulene slipper'}),X(D.vlof),yG+rh+40*fs,{size:10.5*fs,col:'#9FE0F5',al:'center'}); g.restore(); }

  // read-out chip
  const onG=S.h<0.3, eng=S.e<0.5?L({en:'one engine',no:'én motor'}):L({en:'all engines',no:'alle motorer'});
  const chip=`CAS ${nf(S.v)} kt · ${nf(S.d)} m · ${onG?L({en:'on the ground',no:'på bakken'}):nf(S.h)+' ft'} · ${eng}`;
  pill(g,chip,W-10,sy+42*fs,{mono:1,size:10.5*fs,col:'#C9D2DA',al:'right',r:6,fit:W});

  // summary: the ladder
  if(fin>0){ const items=[['VMCG','vmcg'],['≤'],['VEF','vef'],['<'],['V1','v1'],['≤'],['VR','vr'],['<'],['VLOF','vlof'],['<'],['V2','v2']];
    const ps=(sm?12:15)*fs, sep=sm?16:24; g.save(); g.globalAlpha=fin; g.font=`600 ${ps}px ${FONT.mono}`;
    const ws=items.map(it=>it[1]?g.measureText(it[0]).width+16:sep), w=ws.reduce((a,b)=>a+b,0);
    const cx=sm?W/2:W*.4, y=sy+(sm?70:84)*fs, x0=cx-w/2, bh=(sm?76:88)*fs;
    rr(g,x0-18,y-24*fs,w+36,bh,10); g.fillStyle='rgba(10,15,20,.9)'; g.fill(); g.strokeStyle='rgba(255,255,255,.14)'; g.stroke();
    let x=x0; items.forEach((it,i)=>{ if(it[1]) pill(g,it[0],x+ws[i]/2,y,{mono:1,size:ps,col:COL[it[1]],bg:'rgba(255,255,255,.04)',pad:16,al:'center'}); else txt(g,it[0],x+ws[i]/2,y+ps*.36,{mono:1,size:ps+2,col:'#8E99A4',al:'center'}); x+=ws[i]; });
    const l2=L({en:'V1 ≤ VMBE · VR ≥ 1.05 VMCA',no:'V1 ≤ VMBE · VR ≥ 1,05 VMCA'}), l3=L({en:'VLOF ≥ 1.10 VMU · V2 ≥ 1.13 VSR and ≥ 1.10 VMCA',no:'VLOF ≥ 1,10 VMU · V2 ≥ 1,13 VSR og ≥ 1,10 VMCA'});
    txt(g,l2,cx,y+30*fs,{mono:1,size:(sm?9.5:11)*fs,col:'#AEB8C1',al:'center'}); txt(g,l3,cx,y+46*fs,{mono:1,size:(sm?9.5:11)*fs,col:'#AEB8C1',al:'center'});
    g.restore(); }
  txt(g,L({en:'not to scale · heights ×20',no:'ikke i skala · høyder ×20'}),W-10,H-8,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.6,aspectSm:1/1.05,dwell:6,
    title:{en:'The take-off speeds, in the order you meet them',no:'Startfartene, i den rekkefølgen du møter dem'},
    sub:{en:'Press Play, or step through. Each speed lights up on the speed line and on the runway where it happens.',no:'Trykk Spill av, eller gå steg for steg. Hver fart lyser opp på fartslinjen og på rullebanen der den skjer.'},
    label:{en:'Animated side view of a jet take-off with an engine failure, with the take-off speeds on a speed scale and their places on the runway.',no:'Animert sidebilde av en jetavgang med motorstans, med startfartene på en fartsskala og stedene på rullebanen der de skjer.'},
    foot:{en:'Illustrative jet near 70 t, 2 000 m dry runway, rounded values that meet the CS-25 rules shown. Not AFM data.',no:'Illustrerende jetfly på rundt 70 t, 2 000 m tørr bane, avrundede verdier som oppfyller CS-25-reglene som vises. Ikke AFM-data.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
