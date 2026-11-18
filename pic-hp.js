/* NORDAP – pic-hp.js: "Capacity, workload and the body clock" for humanperf.html (uses corepic.js).
   A flight's workload curve against the pilot's capacity: peaks at take-off and approach, capacity lowered by fatigue at
   night (window of circadian low, about 02–06), the gap where errors slip through, and threat and error management
   (anticipate, trap, mitigate). Schematic. */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);

const steps=[
 {t:{en:'Workload rises and falls',no:'Arbeidsbelastningen går opp og ned'},
  d:{en:'A flight is quiet in cruise and busy at both ends: <em>take-off, approach and landing</em> pile tasks on top of each other in a few minutes.',
     no:'En flytur er rolig i marsj og travel i begge ender: <em>avgang, innflyging og landing</em> legger oppgaver oppå hverandre på noen få minutter.'}},
 {t:{en:'Capacity is limited',no:'Kapasiteten er begrenset'},
  d:{en:'Your mental capacity is the ceiling. Below it you have <em>spare capacity</em> for monitoring and for the unexpected. Where workload goes above it, something is <em>dropped</em>: a check, a callout, the big picture.',
     no:'Den mentale kapasiteten din er taket. Under den har du <em>ledig kapasitet</em> til overvåking og det uventede. Der arbeidsbelastningen går over, faller noe <em>ut</em>: en sjekk, en utrop, helhetsbildet.'}},
 {t:{en:'Fatigue lowers the ceiling',no:'Tretthet senker taket'},
  d:{en:'Long duty, short sleep and the <em>window of circadian low</em> (about 02–06 body time) all pull capacity down. The same approach that fits in the daytime may not fit at 04:00.',
     no:'Lang tjeneste, lite søvn og <em>døgnrytmens lavpunkt</em> (omtrent 02–06 kroppstid) trekker alle kapasiteten ned. Den samme innflygingen som passer om dagen, passer kanskje ikke klokka 04.'}},
 {t:{en:'Push work out of the peaks',no:'Flytt arbeid ut av toppene'},
  d:{en:'Brief early, set up the FMS in cruise, use the automation and the other pilot. <em>Move tasks to quiet phases</em> so the peaks stay under the ceiling.',
     no:'Brief tidlig, sett opp FMS i marsj, bruk automatikken og den andre piloten. <em>Flytt oppgaver til rolige faser</em> slik at toppene holder seg under taket.'}},
 {t:{en:'Threat and error management',no:'Trussel- og feilhåndtering'},
  d:{en:'<em>Anticipate</em> threats (weather, fatigue, a late runway change), <em>trap</em> errors with checklists and cross-checks before they matter, and <em>mitigate</em> anything that gets through before it becomes an undesired state.',
     no:'<em>Forutse</em> trusler (vær, tretthet, sent baneskifte), <em>fang</em> feil med sjekklister og kryssjekk før de får betydning, og <em>begrens</em> det som slipper gjennom før det blir en uønsket tilstand.'},
  go:{en:'Open the human performance lab',no:'Åpne labben for menneskelig ytelse',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const x0=W*.07, x1=W*.95, y0=H*.12, y1=H*.78, X=u=>x0+(x1-x0)*u, Y=v=>y1-(y1-y0)*v;
  const tem=at(p,4,.8), chart=1-tem*.0;
  const ph=[[0,L({en:'pre-flight',no:'før flyging'})],[.12,L({en:'take-off',no:'avgang'})],[.24,L({en:'climb',no:'stigning'})],[.45,L({en:'cruise',no:'marsj'})],[.72,L({en:'descent',no:'nedstigning'})],[.84,L({en:'approach',no:'innflyging'})],[.94,L({en:'landing',no:'landing'})]];
  ph.forEach(([u,l],i)=>{ g.strokeStyle='rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(X(u),y0); g.lineTo(X(u),y1); g.stroke(); if(!sm||i%2===0) txt(g,l,X(u)+4,y1+16,{size:10*fs,col:'#7F8B96'}); });
  g.strokeStyle='rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x0,y1); g.lineTo(x1,y1); g.stroke();
  // workload
  const shift=at(p,3,.8);
  const wl=u=>{ const base=.18+.08*Math.sin(u*9); const pk=(c,w,h)=>h*Math.exp(-Math.pow((u-c)/w,2));
    return base+pk(.13,.035,.55*(1-.35*shift))+pk(.88,.06,.66*(1-.32*shift))+pk(.5,.18,.12*shift)+pk(.08,.05,.15*shift); };
  const prog=clamp(p*1.4+.25,0,1);
  // capacity
  const capA=at(p,1,.6), fat=at(p,2,.8);
  const cap=u=>lerp(.78,.78-.22*Math.max(0,Math.sin((u-.2)*Math.PI*1.1))*1.0,fat)-.04*fat;
  if(capA>0.01){ g.save(); g.globalAlpha=capA; g.fillStyle='rgba(113,204,147,.08)'; g.beginPath(); g.moveTo(x0,y1); for(let u=0;u<=1;u+=.01) g.lineTo(X(u),Y(cap(u))); g.lineTo(x1,y1); g.closePath(); g.fill();
    g.strokeStyle=C.green; g.lineWidth=2.4; g.setLineDash([8,5]); g.beginPath(); for(let u=0;u<=1;u+=.01) u?g.lineTo(X(u),Y(cap(u))):g.moveTo(X(u),Y(cap(u))); g.stroke(); g.setLineDash([]);
    pill(g,fat>.5?L({en:'capacity at night, tired',no:'kapasitet om natten, trett'}):L({en:'your capacity',no:'din kapasitet'}),X(.4),Y(cap(.4))-14,{size:11*fs,col:'#8EDDB0',al:'center'});
    if(fat>.3){ g.save(); g.globalAlpha*=fat; g.fillStyle='rgba(185,163,242,.1)'; g.fillRect(X(.6),y0,X(.98)-X(.6),y1-y0); txt(g,L({en:'02–06 body time',no:'02–06 kroppstid'}),X(.66),y0+14,{mono:1,size:10*fs,col:'#B9A3F2',al:'center'}); g.restore(); }
    g.restore(); }
  // overload areas
  if(capA>0.3){ g.save(); g.globalAlpha=capA; g.fillStyle='rgba(236,90,71,.35)'; let inn=false; g.beginPath();
    for(let u=0;u<=prog;u+=.004){ const w=wl(u), c=cap(u); if(w>c){ if(!inn){ g.moveTo(X(u),Y(c)); inn=true; } g.lineTo(X(u),Y(w)); } else if(inn){ g.lineTo(X(u),Y(c)); g.closePath(); inn=false; } }
    if(inn){ g.lineTo(X(prog),Y(cap(prog))); g.closePath(); } g.fill(); g.restore(); }
  // workload line
  g.strokeStyle='#fff'; g.lineWidth=2.6; g.beginPath(); for(let u=0;u<=prog;u+=.004){ const y=Y(wl(u)); u?g.lineTo(X(u),y):g.moveTo(X(u),y); } g.stroke();
  pill(g,L({en:'workload',no:'arbeidsbelastning'}),X(.3),Y(wl(.3))+18,{size:11*fs,col:'#fff',al:'center'});
  const over=[.13,.88].filter(u=>wl(u)>cap(u));
  if(capA>.5&&over.length) over.forEach(u=>pill(g,L({en:'errors slip through',no:'feil slipper gjennom'}),X(u),Y(wl(u))-18,{size:10.5*fs,col:'#FF8A78',al:'center',fit:W}));
  if(shift>.3){ g.save(); g.globalAlpha=shift; arrow(g,X(.86),Y(.75),X(.55),Y(.42),C.amber,{lw:2,head:9,dash:[5,4]}); pill(g,L({en:'brief and set up in cruise',no:'brief og forbered i marsj'}),X(.62),Y(.5),{size:10.5*fs,col:C.amber,al:'center',fit:W}); g.restore(); }
  // TEM chain overlay
  if(tem>0.01){ g.save(); g.globalAlpha=tem; const bx=W*(sm?.04:.12), by=H*(sm?.06:.2), bw=W*(sm?.92:.76), bh=H*(sm?.8:.5);
    rr(g,bx,by,bw,bh,10); g.fillStyle='rgba(10,15,20,.93)'; g.fill(); g.strokeStyle='rgba(255,255,255,.14)'; g.stroke();
    const items=[[L({en:'THREAT',no:'TRUSSEL'}),L({en:'weather, fatigue, runway change',no:'vær, tretthet, baneskifte'}),C.amber,L({en:'anticipate',no:'forutse'})],[L({en:'ERROR',no:'FEIL'}),L({en:'wrong altitude set',no:'feil høyde valgt'}),'#FF8A78',L({en:'trap',no:'fang'})],[L({en:'UNDESIRED STATE',no:'UØNSKET TILSTAND'}),L({en:'level bust',no:'overskredet høyde'}),C.red,L({en:'mitigate',no:'begrens'})]];
    const n=items.length;
    if(!sm){ const cw=(bw-40)/n; items.forEach(([h,d,c,act],i)=>{ const x=bx+20+i*cw, cx=x+cw/2-10, y=by+bh*.42;
      rr(g,x,y-34,cw-30,68,8); g.fillStyle='rgba(255,255,255,.04)'; g.fill(); g.strokeStyle=c; g.stroke();
      txt(g,h,cx,y-8,{mono:1,size:12*fs,col:c,al:'center',w:600}); txt(g,d,cx,y+14,{size:11*fs,col:'#AEB8C1',al:'center'});
      pill(g,act,cx,y+56,{size:11.5*fs,col:'#fff',al:'center'});
      if(i<n-1) arrow(g,x+cw-26,y,x+cw-4,y,'rgba(255,255,255,.5)',{lw:2,head:8}); }); }
    else { const rh=(bh-40)/n; items.forEach(([h,d,c,act],i)=>{ const y=by+14+i*rh, x=bx+12, w=bw-24;
      rr(g,x,y,w,rh-14,8); g.fillStyle='rgba(255,255,255,.04)'; g.fill(); g.strokeStyle=c; g.stroke();
      txt(g,h,x+10,y+18,{mono:1,size:10.5,col:c,w:600}); txt(g,d,x+10,y+34,{size:10,col:'#AEB8C1'}); pill(g,act,x+w-8,y+(rh-14)/2,{size:10.5,col:'#fff',al:'right'});
      if(i<n-1) arrow(g,x+w/2,y+rh-14,x+w/2,y+rh,'rgba(255,255,255,.5)',{lw:2,head:6}); }); }
    txt(g,L({en:'the earlier you catch it, the cheaper it is',no:'jo tidligere du fanger den, jo billigere er det'}),bx+bw/2,by+bh-16,{size:11*fs,col:'#8EDDB0',al:'center',w:600});
    g.restore(); }
  txt(g,L({en:'schematic',no:'skjematisk'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8,aspectSm:1/1.0,dwell:7,
    title:{en:'Workload against capacity, and how errors get through',no:'Arbeidsbelastning mot kapasitet, og hvordan feil slipper gjennom'},
    sub:{en:'One flight, one curve for the work and one for what you can handle. Then what fatigue does, and what you can do about it.',no:'Én flytur, én kurve for arbeidet og én for hva du klarer. Så hva tretthet gjør, og hva du kan gjøre med det.'},
    label:{en:'Animated chart of workload through a flight against mental capacity, with overload at take-off and approach, lower capacity at night, workload moved to cruise, and the threat-error-undesired state chain.',no:'Animert diagram over arbeidsbelastning gjennom en flytur mot mental kapasitet, med overbelastning ved avgang og innflyging, lavere kapasitet om natten, arbeid flyttet til marsj, og kjeden trussel–feil–uønsket tilstand.'},
    foot:{en:'Schematic, not measured data. Threat and error management as used in ICAO and EASA CRM training.',no:'Skjematisk, ikke målte data. Trussel- og feilhåndtering slik den brukes i ICAO- og EASA-CRM-opplæring.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
