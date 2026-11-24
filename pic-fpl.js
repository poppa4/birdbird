/* NORDAP – pic-fpl.js: "Which speed for which job" for flightplanning.html (uses corepic.js).
   One drag curve that is built up (parasite + induced), then read for endurance, range, climb and wind,
   then the propeller version (power), and finally the fuel that goes in the tanks (EASA Part-CAT basic scheme).
   Normalised teaching model: D = (v² + v⁻²)/2 with v = V/Vmd, so Vmd = 1. Jet: endurance at Vmd, range at 3^¼ ≈ 1.32 Vmd;
   propeller: P = D·v, endurance at Vmp = 3^-¼ ≈ 0.76 Vmd, range at Vmd. Illustrative Vmd 220 kt IAS. Not AFM data. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
const VMD=220, TA=1.75;                      // illustrative jet Vmd (kt IAS) and a flat thrust available (in units of minimum drag)
const Dv=v=>(v*v+1/(v*v))/2, Pv=v=>Dv(v)*v;
const VR_=Math.pow(3,.25), VMP=Math.pow(3,-.25);
const argmax=(f,a,b)=>{ let bx=a,by=-1e9; for(let x=a;x<=b;x+=0.0005){ const y=f(x); if(y>by){ by=y; bx=x; } } return bx; };
const VY=argmax(v=>(TA-Dv(v))*v,0.8,2.2);
const WIND=0.25;                              // headwind as a fraction of Vmd (55 kt)
const VRW=argmax(v=>(v-WIND)/Dv(v),1,2.4);
const FUEL=[ // kg, illustrative short sector, A320-size
 {k:'taxi',kg:200,c:'#8E99A4',t:{en:'Taxi',no:'Taksing'},d:{en:'start-up and taxi',no:'oppstart og taksing'}},
 {k:'trip',kg:4200,c:'#7FC6EE',t:{en:'Trip',no:'Tur'},d:{en:'take-off to landing at destination',no:'avgang til landing på destinasjon'}},
 {k:'cont',kg:210,c:'#F0B440',t:{en:'Contingency',no:'Uforutsett'},d:{en:'5 % of trip, at least 5 min hold',no:'5 % av tur, minst 5 min holding'}},
 {k:'alt',kg:1300,c:'#B9A3F2',t:{en:'Alternate',no:'Alternativ'},d:{en:'missed approach and on to the alternate',no:'avbrutt innflyging og videre til alternativ'}},
 {k:'frf',kg:1100,c:'#EC5A47',t:{en:'Final reserve',no:'Endelig reserve'},d:{en:'30 min holding at 1 500 ft: land with it',no:'30 min holding på 1 500 ft: land med den'}},
 {k:'extra',kg:300,c:'#71CC93',t:{en:'Extra',no:'Ekstra'},d:{en:'expected delays, weather',no:'forventede forsinkelser, vær'}},
 {k:'disc',kg:200,c:'#7FB2E5',t:{en:'Discretionary',no:'Skjønnsmessig'},d:{en:"the commander's choice",no:'fartøysjefens valg'}}];

const steps=[
 {t:{en:'Drag has two parts',no:'Motstand har to deler'},
  d:{en:'<em>Parasite</em> drag grows with speed squared. <em>Induced</em> drag (the price of lift) falls as you speed up. Add them and you get one U-shaped curve: the thrust you need.',
     no:'<em>Parasittisk</em> motstand øker med farten i annen. <em>Indusert</em> motstand (prisen for løft) synker når du øker farten. Legg dem sammen, og du får én U-formet kurve: skyvekraften du trenger.'}},
 {t:{en:'Vmd · the bottom of the curve',no:'Vmd · bunnen av kurven'},
  d:{en:'Least drag, best lift/drag ratio, and both parts equal. For a jet, fuel flow follows thrust, so Vmd is also the <em>best endurance</em> speed: the longest time in the hold.',
     no:'Minst motstand, best løft/motstand-forhold, og de to delene er like store. For et jetfly følger forbruket skyvekraften, så Vmd er også farten for <em>lengst flytid</em>: lengst tid i holding.'}},
 {t:{en:'Best range · the tangent from zero',no:'Lengst rekkevidde · tangenten fra null'},
  d:{en:'Range wants the most miles per kg: speed divided by drag. Draw a line from the origin that just touches the curve. For a jet it touches at about <em>1.32 × Vmd</em>.',
     no:'Rekkevidde vil ha flest nautiske mil per kg: fart delt på motstand. Trekk en linje fra origo som akkurat berører kurven. For et jetfly berører den ved omtrent <em>1,32 × Vmd</em>.'}},
 {t:{en:'Climb · Vx and Vy',no:'Stigning · Vx og Vy'},
  d:{en:'Add the thrust available. The <em>biggest gap</em> to the drag curve gives the steepest climb (Vx). The biggest gap × speed gives the fastest climb (Vy), always faster than Vx.',
     no:'Legg til tilgjengelig skyvekraft. Det <em>største gapet</em> ned til motstandskurven gir brattest stigning (Vx). Størst gap × fart gir raskest stigning (Vy), alltid raskere enn Vx.'}},
 {t:{en:'Headwind · fly a little faster',no:'Motvind · fly litt fortere'},
  d:{en:'Into a headwind, draw the tangent from the <em>wind speed</em> instead of from zero. It touches the curve further right: the best-range speed goes up. A tailwind does the opposite.',
     no:'I motvind trekker du tangenten fra <em>vindfarten</em> i stedet for fra null. Den berører kurven lenger til høyre: farten for lengst rekkevidde øker. Medvind gjør det motsatte.'}},
 {t:{en:'Propeller aircraft · think in power',no:'Propellfly · tenk effekt'},
  d:{en:'A propeller engine burns fuel for <em>power</em> (drag × speed). The power curve has its bottom further left: endurance at <em>Vmp ≈ 0.76 Vmd</em>, and its tangent from zero touches at <em>Vmd</em> for best range.',
     no:'En propellmotor bruker drivstoff for <em>effekt</em> (motstand × fart). Effektkurven har bunnen lenger til venstre: lengst flytid ved <em>Vmp ≈ 0,76 Vmd</em>, og tangenten fra null berører ved <em>Vmd</em> for lengst rekkevidde.'}},
 {t:{en:'The fuel, block by block',no:'Drivstoffet, blokk for blokk'},
  d:{en:'Build it from the bottom: taxi, trip, contingency, alternate and <em>final reserve</em> are the minimum; extra and discretionary come on top. You plan to land with the final reserve still in the tanks.',
     no:'Bygg nedenfra: taksing, tur, uforutsett, alternativ og <em>endelig reserve</em> er minimum; ekstra og skjønnsmessig kommer på toppen. Du planlegger å lande med den endelige reserven fortsatt i tankene.'},
  go:{en:'Open the fuel lab',no:'Åpne drivstofflabben',fn:()=>{ const b=[...document.querySelectorAll('#vtabs button,.vtabs button')].find(x=>/fuel|drivstoff/i.test(x.textContent)); if(b) b.click(); const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const fuelK=at(p,6,.9), chartA=1-fuelK;
  // chart frame
  const cx0=W*(sm?.12:.08), cx1=W*(sm?.95:.9), cy0=H*(sm?.12:.1), cy1=H*(sm?.8:.83);
  const vLo=0, vHi=2.15, X=v=>cx0+(cx1-cx0)*(v-vLo)/(vHi-vLo);
  const propK=at(p,5,.9);
  const yMax=lerp(3.0,3.4,propK), Y=y=>cy1-(cy1-cy0)*y/yMax;
  if(chartA>0.01){ g.save(); g.globalAlpha=chartA;
    // axes
    g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=1; g.beginPath(); g.moveTo(cx0,cy0-6); g.lineTo(cx0,cy1); g.lineTo(cx1+6,cy1); g.stroke();
    for(let k=0;k<=450;k+=50){ const v=k/VMD; if(v<vLo||v>vHi) continue; const x=X(v); g.strokeStyle='rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x,cy0); g.lineTo(x,cy1); g.stroke();
      txt(g,String(k),x,cy1+16*fs,{mono:1,size:10*fs,col:'#7F8B96',al:'center'}); }
    txt(g,L({en:'speed · kt IAS',no:'fart · kt IAS'}),cx1,cy1+32*fs,{mono:1,size:10*fs,col:'#8E99A4',al:'right'});
    txt(g,propK>.5?L({en:'power needed (prop)',no:'effekt som trengs (propell)'}):L({en:'drag = thrust needed',no:'motstand = skyvekraft som trengs'}),cx0+6,cy0-10,{mono:1,size:10*fs,col:'#8E99A4'});
    // curve helpers
    const curve=(f,col,lw,a,v1,dash)=>{ g.save(); g.globalAlpha*=a; g.strokeStyle=col; g.lineWidth=lw; if(dash) g.setLineDash(dash); g.beginPath(); let st=0;
      for(let v=vLo;v<=Math.min(vHi,v1==null?vHi:v1);v+=0.01){ const y=f(v); if(y>yMax*1.05){ st=0; continue; } const x=X(v), yy=Y(y); st?g.lineTo(x,yy):g.moveTo(x,yy); st=1; } g.stroke(); g.restore(); };
    const dragA=1-propK*.75;
    // parasite and induced
    const pa=(1-at(p,1.6,.8))*.95+.05;
    curve(v=>v*v/2,'#7FC6EE',1.6,pa*dragA,null,[5,4]);
    curve(v=>1/(2*v*v),'#B9A3F2',1.6,pa*dragA,null,[5,4]);
    if(pa>.2){ const a=pa*dragA; g.save(); g.globalAlpha*=a; txt(g,L({en:'parasite ∝ V²',no:'parasittisk ∝ V²'}),X(2.0),Y(2.0*2.0/2)-8,{size:11*fs,col:'#7FC6EE',al:'right',w:600});
      txt(g,L({en:'induced ∝ 1/V²',no:'indusert ∝ 1/V²'}),X(0.62),Y(1/(2*.62*.62))-6,{size:11*fs,col:'#B9A3F2',w:600}); g.restore(); }
    // total drag
    curve(Dv,'#F4F7F9',2.6,dragA);
    if(dragA>.3){ g.save(); g.globalAlpha*=dragA; txt(g,L({en:'total drag',no:'total motstand'}),X(1.92),Y(Dv(1.92))+18*fs,{size:11.5*fs,col:'#fff',w:650,al:'right'}); g.restore(); }
    // 1: Vmd
    const a1=at(p,1,.7)*(1-propK);
    if(a1>0){ g.save(); g.globalAlpha*=a1; const x=X(1), y=Y(1);
      g.strokeStyle='rgba(113,204,147,.6)'; g.setLineDash([3,4]); g.beginPath(); g.moveTo(x,y); g.lineTo(x,cy1); g.stroke(); g.setLineDash([]);
      g.fillStyle=C.green; g.beginPath(); g.arc(x,y,5,0,7); g.fill();
      pill(g,`Vmd ${VMD} kt`,x,cy1-14*fs,{mono:1,size:10.5*fs,col:C.green,al:'center'});
      pill(g,L({en:'jet: best endurance',no:'jet: lengst flytid'}),x,y+22*fs,{size:10.5*fs,col:C.green,al:'center'});
      g.restore(); }
    // 2: best range tangent from the origin (jet), 4: from the headwind
    const a3c=at(p,3,.8)*(1-at(p,4,.6));
    const a2=at(p,2,.8)*(1-propK)*(1-a3c*.85);
    const tang=(v0,vt,col,lab,a)=>{ if(a<=0) return; g.save(); g.globalAlpha*=a; const x0=X(v0), y0=Y(0), m=(Dv(vt))/(vt-v0);
      const vE=Math.min(vHi,vt+.45), x1=X(vE), y1=Y(m*(vE-v0));
      g.strokeStyle=col; g.lineWidth=1.6; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x0+(x1-x0)*ease(a),y0+(y1-y0)*ease(a)); g.stroke();
      if(a>.85){ const x=X(vt), y=Y(Dv(vt)); g.fillStyle=col; g.beginPath(); g.arc(x,y,5,0,7); g.fill(); g.setLineDash([3,4]); g.beginPath(); g.moveTo(x,y); g.lineTo(x,cy1); g.stroke(); g.setLineDash([]);
        pill(g,lab,x,y-22*fs,{size:10.5*fs,col,al:'center',fit:W}); pill(g,`${nf(vt*VMD)} kt`,x,cy1-14*fs,{mono:1,size:10.5*fs,col,al:'center'}); }
      g.restore(); };
    const hw=at(p,4,.9)*(1-propK);
    tang(0,VR_,C.mag,L({en:'jet: best range ≈ 1.32 Vmd',no:'jet: lengst rekkevidde ≈ 1,32 Vmd'}),a2*(1-hw*.65));
    if(hw>0){ const w=WIND*ease(hw), vt=argmax(v=>(v-w)/Dv(v),1,2.4); tang(w,vt,C.amber,L({en:`headwind ${nf(w*VMD)} kt: faster`,no:`motvind ${nf(w*VMD)} kt: fortere`}),1);
      g.save(); g.globalAlpha*=hw; arrow(g,X(0)+2,cy1+0.5,X(w)-2,cy1+0.5,C.amber,{lw:2.5,head:8}); g.restore(); }
    // origin marker (v = 0 sits left of the axis; draw a stub)
    if(false){ g.save(); g.globalAlpha*=a2*(1-propK); txt(g,'0',cx0-6,cy1+4,{mono:1,size:10*fs,col:'#7F8B96',al:'right'}); g.restore(); }
    // 3: climb
    const a3=at(p,3,.8)*(1-at(p,4,.6)*.8)*(1-propK);
    if(a3>0){ g.save(); g.globalAlpha*=a3; const yT=Y(TA);
      g.fillStyle='rgba(113,204,147,.10)'; g.beginPath(); g.moveTo(X(vLo),yT); for(let v=vLo;v<=vHi;v+=.01){ const d=Dv(v); if(d<TA) g.lineTo(X(v),Y(d)); } g.lineTo(X(vHi),yT); g.closePath(); g.fill();
      g.strokeStyle=C.amber; g.lineWidth=2; g.beginPath(); g.moveTo(X(vLo),yT); g.lineTo(X(vHi),yT); g.stroke();
      txt(g,L({en:'thrust available',no:'tilgjengelig skyvekraft'}),X(.5),yT-8,{size:11*fs,col:C.amber,w:600});
      const gap=(v,col,lab,al)=>{ const x=X(v); g.strokeStyle=col; g.lineWidth=2.5; g.beginPath(); g.moveTo(x,yT); g.lineTo(x,Y(Dv(v))); g.stroke(); pill(g,lab,x+(al==='right'?-6:6),(yT+Y(Dv(v)))/2,{size:10.5*fs,col,al}); };
      gap(1,'#9FE0F5',L({en:'Vx: biggest gap (jet: Vmd)',no:'Vx: størst gap (jet: Vmd)'}),'right');
      gap(VY,C.green,L({en:'Vy: gap × speed',no:'Vy: gap × fart'}),'left');
      pill(g,`Vy ${nf(VY*VMD)} kt`,X(VY),cy1-38*fs,{mono:1,size:10.5*fs,col:C.green,al:'center'});
      g.restore(); }
    // 5: propeller power curve
    if(propK>0){ g.save(); curve(Pv,'#F0B440',2.6,propK);
      g.globalAlpha*=propK; const xm=X(VMP), ym=Y(Pv(VMP));
      txt(g,L({en:'power needed = drag × speed',no:'effekt som trengs = motstand × fart'}),X(1.75),Y(Pv(1.75))-10,{size:11.5*fs,col:C.amber,w:650,al:'right'});
      g.fillStyle=C.amber; g.beginPath(); g.arc(xm,ym,5,0,7); g.fill(); g.setLineDash([3,4]); g.strokeStyle='rgba(240,180,64,.6)'; g.beginPath(); g.moveTo(xm,ym); g.lineTo(xm,cy1); g.stroke();
      pill(g,L({en:'Vmp: best endurance',no:'Vmp: lengst flytid'}),xm,ym+22*fs,{size:10.5*fs,col:C.amber,al:'center',fit:W});
      pill(g,`${nf(VMP*VMD)} kt`,xm,cy1-14*fs,{mono:1,size:10.5*fs,col:C.amber,al:'center'});
      // tangent from origin to the power curve touches at Vmd
      const m=Pv(1)/1, xE=X(1.55); g.setLineDash([]); g.strokeStyle=C.mag; g.lineWidth=1.6; g.beginPath(); g.moveTo(X(0),Y(0)); g.lineTo(xE,Y(m*1.55)); g.stroke();
      g.fillStyle=C.mag; g.beginPath(); g.arc(X(1),Y(Pv(1)),5,0,7); g.fill();
      pill(g,L({en:'Vmd: best range (prop)',no:'Vmd: lengst rekkevidde (propell)'}),X(1),Y(Pv(1))-22*fs,{size:10.5*fs,col:C.mag,al:'center',fit:W});
      pill(g,`${VMD} kt`,X(1),cy1-14*fs,{mono:1,size:10.5*fs,col:C.mag,al:'center'});
      g.restore(); }
    g.restore(); }

  // 6: the fuel stack
  if(fuelK>0.01){ g.save(); g.globalAlpha=fuelK;
    const tot=FUEL.reduce((a,f)=>a+f.kg,0), bx=W*(sm?.12:.2), bw=W*(sm?.2:.16), by1=H*.9, by0=H*.1, hT=by1-by0;
    // tank outline
    rr(g,bx-6,by0-6,bw+12,hT+12,10); g.strokeStyle='rgba(255,255,255,.22)'; g.lineWidth=1.5; g.stroke();
    let y=by1; const fill=clamp((p-5.25)/0.75,0,1)*FUEL.length; let minTop=0;
    txt(g,L({en:'BLOCK FUEL',no:'BLOKKDRIVSTOFF'})+(fill>=FUEL.length-.05?` · ${nf(FUEL.reduce((a,f)=>a+f.kg,0))} kg`:''),bx+bw/2,by0-14,{mono:1,size:10.5*fs,col:'#C9D2DA',al:'center'});
    const gapL=(sm?27:32)*fs, LY=[]; { let yy=by1, prev=1e9; FUEL.forEach((f,i)=>{ const hf=hT*f.kg/tot, c=yy-hf/2; const v=Math.min(c,prev-gapL); LY.push(v); prev=v; yy-=hf; }); }
    FUEL.forEach((f,i)=>{ const k=clamp(fill-i,0,1); if(k<=0) return; const h=hT*f.kg/tot*Math.max(ease(k),.001), hf=hT*f.kg/tot, y0=y-h;
      const gr=g.createLinearGradient(bx,0,bx+bw,0); gr.addColorStop(0,f.c); gr.addColorStop(1,f.c+'AA'); g.fillStyle=gr; g.globalAlpha=fuelK*.92; g.fillRect(bx,y0,bw,h); g.globalAlpha=fuelK;
      g.strokeStyle='rgba(10,15,20,.8)'; g.lineWidth=1; g.beginPath(); g.moveTo(bx,y0); g.lineTo(bx+bw,y0); g.stroke();
      // label to the right with leader
      const yc=y-hf/2, ly=LY[i], lx=bx+bw+26;
      if(k>.6){ g.strokeStyle=f.c; g.globalAlpha=fuelK*.7; g.beginPath(); g.moveTo(bx+bw+2,yc); g.lineTo(bx+bw+12,yc); g.lineTo(lx-6,ly); g.stroke(); g.globalAlpha=fuelK;
        txt(g,`${L(f.t)}`,lx,ly-1,{size:(sm?11.5:13.5)*fs,col:'#fff',w:650});
        txt(g,sm?`${nf(f.kg)} kg`:`${nf(f.kg)} kg · ${L(f.d)}`,lx,ly+14*fs,{size:(sm?10:11.5)*fs,col:'#AEB8C1',w:500}); }
      if(f.k==='frf') minTop=y-hf;
      y-=hf; });
    // the minimum bracket
    if(fill>5){ const yb=by1, xb=bx-16; g.strokeStyle='#fff'; g.lineWidth=1.4; g.beginPath(); g.moveTo(xb+8,yb); g.lineTo(xb,yb); g.lineTo(xb,minTop); g.lineTo(xb+8,minTop); g.stroke();
      g.save(); g.translate(xb-8,(yb+minTop)/2); g.rotate(-Math.PI/2); txt(g,L({en:'minimum required',no:'minimum påkrevd'}),0,0,{size:11*fs,col:'#fff',w:650,al:'center'}); g.restore(); }
    // land-with marker
    g.restore(); }
  txt(g,L({en:'illustrative jet · not AFM data',no:'illustrerende jetfly · ikke AFM-data'}),W-10,H-8,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.6,aspectSm:1/1.05,dwell:6.5,
    title:{en:'Which speed for which job, and the fuel you carry',no:'Hvilken fart til hvilken jobb, og drivstoffet du har med'},
    sub:{en:'One drag curve answers most cruise and climb questions. Step through it, then build the fuel from the bottom up.',no:'Én motstandskurve svarer på de fleste spørsmål om marsj og stigning. Gå gjennom den, og bygg så drivstoffet nedenfra.'},
    label:{en:'Animated drag curve with the speeds for best endurance, best range, climb and headwind, the propeller power curve, and a fuel stack.',no:'Animert motstandskurve med fartene for lengst flytid, lengst rekkevidde, stigning og motvind, effektkurven for propellfly og en drivstoffstabel.'},
    foot:{en:'Normalised drag model with Vmd 220 kt; fuel figures for an illustrative short sector, EASA Part-CAT basic fuel scheme. Not AFM data.',no:'Normalisert motstandsmodell med Vmd 220 kt; drivstofftall for en illustrerende kort etappe, EASA Part-CAT grunnleggende drivstoffordning. Ikke AFM-data.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
