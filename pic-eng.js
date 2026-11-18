/* NORDAP – pic-eng.js: "Suck, squeeze, bang, blow" for engines.html (uses corepic.js).
   A turbofan section with the same numbered stages the lab uses (1 intake, 2 compression, 3 combustion, 4 turbine and exhaust),
   the gas path coloured by temperature, a pressure/temperature trace along the engine, then the bypass split and what
   altitude and temperature do to the thrust. Generic, illustrative values (OPR about 30, TIT about 1 500 °C, BPR about 6). */
(function(){
'use strict';
if(!window.CORE) return;
const {C,clamp,lerp,ease,at,txt,pill,arrow,rr,FONT}=CORE.U;
const L=o=>LAB.L(o), nf=(v,d)=>LAB.nf(v,d||0);
/* stations along the core, x 0..1: intake, fan, LPC, HPC, combustor, HPT, LPT, nozzle */
const ST=[0,.12,.22,.42,.56,.66,.76,1];
const TEMP=[15,40,120,560,1500,1050,700,520];       // °C along the core (take-off, illustrative)
const PRES=[1,1.5,4,30,29,9,2.2,1.1];               // × ambient
const lerpArr=(xs,ys,x)=>{ for(let i=1;i<xs.length;i++){ if(x<=xs[i]){ const k=(x-xs[i-1])/(xs[i]-xs[i-1]); return ys[i-1]+(ys[i]-ys[i-1])*k; } } return ys[ys.length-1]; };
function tcol(t){ const st=[[15,[70,120,190]],[200,[120,170,220]],[560,[240,200,120]],[1000,[240,140,60]],[1500,[255,240,200]]];
  if(t<=st[0][0]) return st[0][1]; for(let i=1;i<st.length;i++){ if(t<=st[i][0]){ const k=(t-st[i-1][0])/(st[i][0]-st[i-1][0]); return st[i-1][1].map((c,j)=>c+(st[i][1][j]-c)*k); } } return st[st.length-1][1]; }

const steps=[
 {t:{en:'Intake: suck',no:'Innløp: sug'},
  d:{en:'The intake slows the air down smoothly and hands it to the fan with as little loss as possible. At take-off the engine <em>pulls</em> the air in; in cruise the ram air helps.',
     no:'Innløpet bremser luften mykt og gir den videre til viften med minst mulig tap. Ved avgang <em>suger</em> motoren luften inn; i marsj hjelper fartstrykket.'}},
 {t:{en:'Compression: squeeze',no:'Kompresjon: klem'},
  d:{en:'Rows of rotating blades and fixed vanes squeeze the air into a smaller and smaller space: about <em>30 times the pressure</em>, and it gets hot (around 550 °C) just from being squeezed.',
     no:'Rader med roterende blader og faste ledeskovler klemmer luften inn i et stadig mindre rom: omtrent <em>30 ganger trykket</em>, og den blir varm (rundt 550 °C) bare av å bli klemt.'}},
 {t:{en:'Combustion: bang',no:'Forbrenning: smell'},
  d:{en:'Fuel burns continuously in the squeezed air at almost constant pressure. The gas leaving the combustor is the hottest thing in the engine: the <em>turbine inlet temperature</em>, about 1 500 °C — hotter than the blades\' metal can stand without cooling.',
     no:'Drivstoffet brenner kontinuerlig i den komprimerte luften ved nesten konstant trykk. Gassen ut av brennkammeret er det varmeste i motoren: <em>turbininnløpstemperaturen</em>, rundt 1 500 °C — varmere enn bladmetallet tåler uten kjøling.'}},
 {t:{en:'Turbine and exhaust: blow',no:'Turbin og utløp: blås'},
  d:{en:'The hot gas expands through the turbines, which take out just enough work to <em>drive the compressor and fan</em> on the same shafts. What is left leaves the nozzle fast. What you watch in the cockpit is the <em>EGT</em> after the turbine.',
     no:'Den varme gassen ekspanderer gjennom turbinene, som tar ut akkurat nok arbeid til å <em>drive kompressoren og viften</em> på de samme akslene. Resten forlater dysen i høy fart. Det du følger med på i cockpit, er <em>EGT</em> etter turbinen.'}},
 {t:{en:'Bypass · most of the thrust is the fan',no:'Bypass · mesteparten av skyvekraften er viften'},
  d:{en:'A turbofan sends most of the air <em>around the core</em> (about 6 : 1). Moving a lot of air a little faster is more efficient than a little air very fast: quieter, and less fuel. Thrust = mass flow × speed increase.',
     no:'En turbofan sender mesteparten av luften <em>utenom kjernen</em> (omtrent 6 : 1). Å flytte mye luft litt fortere er mer effektivt enn lite luft svært fort: stillere, og mindre drivstoff. Skyvekraft = massestrøm × fartsøkning.'}},
 {t:{en:'Thin air, hot day · less thrust',no:'Tynn luft, varm dag · mindre skyvekraft'},
  d:{en:'Thrust depends on the <em>mass</em> of air through the engine. High aerodromes and hot days mean thinner air: less thrust, and the EGT limit is reached sooner. That is why take-off performance falls with altitude and temperature.',
     no:'Skyvekraften avhenger av <em>massen</em> av luft gjennom motoren. Høytliggende flyplasser og varme dager betyr tynnere luft: mindre skyvekraft, og EGT-grensen nås før. Derfor faller startytelsen med høyde og temperatur.'},
  go:{en:'Open the engine lab',no:'Åpne motorlabben',fn:()=>{ const v=document.querySelector('[data-lab-model],.atl-model'); if(v) v.scrollIntoView({behavior:'smooth',block:'start'}); }}}];

function draw(g,W,H,p,tm){
  const sm=W<640, fs=sm?.86:1;
  const ex0=W*.06, ex1=W*.94, ecy=H*(sm?.36:.4), R=Math.min(H*(sm?.17:.2),W*(sm?.2:.13));
  const X=u=>ex0+(ex1-ex0)*u;
  const hot=at(p,5,.8);
  const thrK=1-.28*hot;                                      // thrust factor on a hot/high day
  // stage highlight
  const stg=clamp(Math.round(p),0,3), hl=p<4?stg:-1;
  // nacelle (outer)
  const nac=(u)=>{ if(u<0.02) return R*1.12; if(u<.35) return R*(1.12+0.04*Math.sin(u/.35*Math.PI)); if(u<.62) return lerp(R*1.12,R*.86,(u-.35)/.27); return R*.86; };
  const fanEnd=.62;
  // core radius (outer) and hub
  const core=u=>u<.12?R*.32:u<.22?lerp(R*.62,R*.56,(u-.12)/.1):u<.42?lerp(R*.56,R*.4,(u-.22)/.2):u<.56?R*.42:u<.76?lerp(R*.42,R*.56,(u-.56)/.2):lerp(R*.56,R*.38,(u-.76)/.24);
  const hub=u=>(u<.12?R*.2*Math.sin(clamp(u/.12,0,1)*Math.PI/2):u<.42?lerp(R*.24,R*.3,(u-.12)/.3):u<.56?R*.3:u<.76?lerp(R*.3,R*.24,(u-.56)/.2):lerp(R*.24,R*.06,(u-.76)/.24))*.62;
  // bypass duct air (cool blue streaks)
  const bpA=Math.max(.35,at(p,4,.8));
  g.save(); g.globalAlpha=bpA;
  for(const sgn of [-1,1]){ g.fillStyle='rgba(70,120,190,.22)'; g.beginPath(); for(let u=.12;u<=fanEnd+.001;u+=.01){ const y=ecy+sgn*nac(u)*.96; u===.12?g.moveTo(X(u),y):g.lineTo(X(u),y); } for(let u=fanEnd;u>=.12;u-=.01) g.lineTo(X(u),ecy+sgn*core(u)*1.04); g.closePath(); g.fill(); }
  for(let k=0;k<14;k++){ const ph=((tm*.9+k/14)%1), u=lerp(.1,fanEnd+.1,ph), sgn=k%2?1:-1, r=lerp(core(Math.min(u,fanEnd)),nac(Math.min(u,fanEnd)),.5+.3*Math.sin(k)); g.strokeStyle=`rgba(159,212,242,${.55*Math.sin(ph*Math.PI)})`; g.lineWidth=1.6; g.beginPath(); g.moveTo(X(u)-16,ecy+sgn*r); g.lineTo(X(u),ecy+sgn*r); g.stroke(); }
  g.restore();
  // core gas path, coloured by temperature
  for(let u=.12;u<1;u+=.004){ const t=lerpArr(ST,TEMP,u)*(u>=.56?(1+.06*hot):1), c=tcol(t), x=X(u), w=X(u+.0045)-x;
    g.fillStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`; g.fillRect(x,ecy-core(u),w+.5,core(u)-hub(u)); g.fillRect(x,ecy+hub(u),w+.5,core(u)-hub(u)); }
  // compressor and turbine blades (animated stripes)
  const spin=tm*6;
  const blades=(u0,u1,n,col)=>{ for(let i=0;i<n;i++){ const u=lerp(u0,u1,(i+.5)/n), x=X(u); g.strokeStyle=col; g.lineWidth=Math.max(1.2,(X(u1)-X(u0))/n*.35); const off=((spin+i*.7)%1)*4;
      g.beginPath(); g.moveTo(x+off-2,ecy-core(u)+1); g.lineTo(x-off+2,ecy-hub(u)-1); g.moveTo(x+off-2,ecy+hub(u)+1); g.lineTo(x-off+2,ecy+core(u)-1); g.stroke(); } };
  blades(.22,.42,10,'rgba(20,28,36,.55)'); blades(.56,.76,5,'rgba(20,28,36,.55)');
  // fan
  const fanAt=()=>{ const x=X(.125), rf=nac(.12)*.95, rh=R*.14; g.save();
    // fan disc seen edge-on: a band of blades from the spinner to the casing, turning
    const dg=g.createLinearGradient(0,ecy-rf,0,ecy+rf); dg.addColorStop(0,'rgba(170,184,196,.25)'); dg.addColorStop(.5,'rgba(220,228,235,.08)'); dg.addColorStop(1,'rgba(170,184,196,.25)');
    g.fillStyle=dg; g.fillRect(x-7,ecy-rf,16,rf*2);
    const n=22; for(let i=0;i<n;i++){ const ph=((spin*.25+i/n)%1)*Math.PI*2, yr=Math.cos(ph)*rf, y=ecy+yr, vis=Math.sin(ph); if(Math.abs(yr)<rh) continue;
      const w=2+Math.abs(vis)*3.5, a=.35+.55*Math.max(0,vis); g.fillStyle=`rgba(232,238,243,${a})`;
      g.beginPath(); g.moveTo(x-6,y-w/2); g.lineTo(x+7,y-w/2+(yr>0?-2:2)); g.lineTo(x+7,y+w/2+(yr>0?-2:2)); g.lineTo(x-6,y+w/2); g.closePath(); g.fill(); }
    g.strokeStyle='rgba(214,226,236,.5)'; g.lineWidth=1; g.strokeRect(x-7,ecy-rf,16,rf*2); g.restore(); };
  // combustor flame flicker
  for(let k=0;k<10;k++){ const u=lerp(.43,.55,k/9), r=lerp(hub(u),core(u),.5); const f=Math.sin(tm*9+k*1.7)*.5+.5; g.fillStyle=`rgba(255,${200+40*f|0},${120+80*f|0},${.5+.3*f})`; for(const sgn of [-1,1]){ g.beginPath(); g.ellipse(X(u),ecy+sgn*r,6+3*f,(core(u)-hub(u))*.32,0,0,7); g.fill(); } }
  // hardware: shaft and hub, core casing (splitter), nacelle with thickness
  const metal=(y0,y1)=>{ const gr=g.createLinearGradient(0,y0,0,y1); gr.addColorStop(0,'#4A5763'); gr.addColorStop(.5,'#8D9AA6'); gr.addColorStop(1,'#3A4550'); return gr; };
  g.fillStyle=metal(ecy-R*.3,ecy+R*.3); g.beginPath(); for(let u=.06;u<=1;u+=.01) g.lineTo(X(u),ecy-hub(u)); for(let u=1;u>=.06;u-=.01) g.lineTo(X(u),ecy+hub(u)); g.closePath(); g.fill();
  // spinner
  g.fillStyle=metal(ecy-R*.22,ecy+R*.22); g.beginPath(); g.moveTo(X(.03),ecy); g.quadraticCurveTo(X(.05),ecy-R*.2,X(.125),ecy-R*.22); g.lineTo(X(.125),ecy+R*.22); g.quadraticCurveTo(X(.05),ecy+R*.2,X(.03),ecy); g.closePath(); g.fill();
  for(const sgn of [-1,1]){ const th=R*.06;
    g.fillStyle='#2E3944'; g.beginPath(); for(let u=.13;u<=1;u+=.01) g.lineTo(X(u),ecy+sgn*core(u)); for(let u=1;u>=.13;u-=.01) g.lineTo(X(u),ecy+sgn*(core(u)+(u<fanEnd+.02?th:th*.6))); g.closePath(); g.fill();
    g.strokeStyle='rgba(214,226,236,.45)'; g.lineWidth=1; g.beginPath(); for(let u=.13;u<=1;u+=.01){ const y=ecy+sgn*(core(u)+(u<fanEnd+.02?th:th*.6)); u>.13?g.lineTo(X(u),y):g.moveTo(X(u),y); } g.stroke();
    const nt=R*.14; const ng=g.createLinearGradient(0,ecy+sgn*nac(.3),0,ecy+sgn*(nac(.3)+nt)); ng.addColorStop(0,'#55636F'); ng.addColorStop(1,'#B9C3CB');
    g.fillStyle=ng; g.beginPath(); for(let u=0;u<=fanEnd+.001;u+=.01) g.lineTo(X(u),ecy+sgn*nac(u)); for(let u=fanEnd;u>=0;u-=.01) g.lineTo(X(u),ecy+sgn*(nac(u)+nt*(u<.04?u/.04*.8+.2:1))); g.closePath(); g.fill();
    g.strokeStyle='rgba(10,16,21,.6)'; g.lineWidth=1; g.stroke(); }
  fanAt();
  // stage bands and numbers
  const bands=[[0,.12],[.12,.42],[.42,.56],[.56,1]], cols=['#9FD4F2','#7FC6EE','#F0B440','#EC5A47'];
  bands.forEach(([a,b],i)=>{ const on=i===hl; g.fillStyle=on?'rgba(255,255,255,.07)':'rgba(255,255,255,0)'; g.fillRect(X(a),ecy-R*1.3,X(b)-X(a),R*2.6);
    const cx=(X(a)+X(b))/2, y=ecy-R*1.22-14; g.fillStyle=on?cols[i]:'rgba(13,20,27,.9)'; g.strokeStyle=cols[i]; g.lineWidth=1.5; g.beginPath(); g.arc(cx,y,11,0,7); g.fill(); g.stroke();
    txt(g,String(i+1),cx,y+4,{mono:1,size:11.5,col:on?'#13181D':cols[i],al:'center',w:600}); });
  // incoming air
  for(let k=0;k<6;k++){ const ph=((tm*.8+k/6)%1); g.strokeStyle=`rgba(159,212,242,${.6*Math.sin(ph*Math.PI)})`; g.lineWidth=1.6; const y=ecy+(k-2.5)/2.5*R*.8; g.beginPath(); g.moveTo(X(-.05)+ph*X(.1)-W*.04,y); g.lineTo(X(-.05)+ph*X(.1),y); g.stroke(); }
  // exhaust jet
  for(let k=0;k<8;k++){ const ph=((tm*1.6+k/8)%1); g.strokeStyle=`rgba(255,${180-60*ph|0},120,${.5*(1-ph)})`; g.lineWidth=2; const y=ecy+(k-3.5)/3.5*R*.3; g.beginPath(); g.moveTo(X(1)+ph*W*.04,y); g.lineTo(X(1)+ph*W*.04+14,y); g.stroke(); }
  // trace panel: pressure (white) and temperature (amber) along the engine
  const ty0=sm?H*.7:H*.79, ty1=sm?H*.95:H*.95, trA=p<4.5?1:(sm?0:.5);
  if(trA>0){ g.save(); g.globalAlpha=trA; g.strokeStyle='rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(X(0),ty1); g.lineTo(X(1),ty1); g.stroke();
    const prog=p<4?clamp((p+.9)/4,0,1):1;
    g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); for(let u=0;u<=prog;u+=.005){ const y=ty1-(ty1-ty0)*lerpArr(ST,PRES,u)/32; u?g.lineTo(X(u),y):g.moveTo(X(u),y); } g.stroke();
    g.strokeStyle=C.amber; g.lineWidth=2; g.beginPath(); for(let u=0;u<=prog;u+=.005){ const y=ty1-(ty1-ty0)*lerpArr(ST,TEMP,u)/1600; u?g.lineTo(X(u),y):g.moveTo(X(u),y); } g.stroke();
    txt(g,L({en:'pressure',no:'trykk'}),X(.36),ty0+4,{mono:1,size:10*fs,col:'#fff',al:'right'}); txt(g,L({en:'temperature',no:'temperatur'}),X(.7),ty0+14,{mono:1,size:10*fs,col:C.amber});
    if(p>=1.5&&p<4.5) pill(g,'× 30',X(.42),ty1-(ty1-ty0)*30/32,{mono:1,size:10*fs,col:'#fff',al:'center'});
    if(p>=2.5&&p<4.5) pill(g,'≈ 1 500 °C',X(.56),ty1-(ty1-ty0)*1500/1600-10,{mono:1,size:10*fs,col:C.amber,al:'center'});
    if(p>=3.5&&p<4.5) pill(g,'EGT',X(.8),ty1-(ty1-ty0)*640/1600-12,{mono:1,size:10*fs,col:'#FF8A78',al:'center'});
    g.restore(); }
  // bypass ratio (step 5)
  const bp=at(p,4,.7)*(1-hot*.6);
  if(bp>0.01){ g.save(); g.globalAlpha=bp; pill(g,L({en:'bypass air ≈ 6 parts',no:'bypassluft ≈ 6 deler'}),X(.36),ecy-R*.92,{size:11*fs,col:'#9FD4F2',al:'center'}); pill(g,L({en:'core ≈ 1 part',no:'kjerne ≈ 1 del'}),X(.36),ecy,{size:11*fs,col:'#fff',al:'center'});
    if(!sm) pill(g,L({en:'thrust = mass flow × Δ speed',no:'skyvekraft = massestrøm × Δ fart'}),X(.82),ecy-R*1.0,{mono:1,size:11*fs,col:'#fff',al:'center'}); g.restore(); }
  // hot and high (step 6)
  if(hot>0.01){ g.save(); g.globalAlpha=hot; const bx=sm?W*.06:W*.66, by=sm?H*.66:H*.72, bw=sm?W*.88:W*.3;
    rr(g,bx,by,bw,sm?H*.28:H*.24,8); g.fillStyle='rgba(10,15,20,.9)'; g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.stroke();
    txt(g,L({en:'ELEVATION 5 000 FT · ISA +25',no:'HØYDE 5 000 FT · ISA +25'}),bx+12,by+18,{mono:1,size:9.5*fs,col:'#8E99A4'});
    txt(g,L({en:'air density',no:'lufttetthet'}),bx+12,by+42,{size:12*fs,col:'#fff'}); txt(g,'−21 %',bx+bw-12,by+42,{mono:1,size:12*fs,col:'#FF8A78',al:'right'});
    txt(g,L({en:'take-off thrust',no:'startskyvekraft'}),bx+12,by+64,{size:12*fs,col:'#fff'}); txt(g,'≈ −20 %',bx+bw-12,by+64,{mono:1,size:12*fs,col:'#FF8A78',al:'right'});
    txt(g,L({en:'EGT margin',no:'EGT-margin'}),bx+12,by+86,{size:12*fs,col:'#fff'}); txt(g,L({en:'smaller',no:'mindre'}),bx+bw-12,by+86,{mono:1,size:12*fs,col:C.amber,al:'right'});
    g.restore(); }
  txt(g,L({en:'generic turbofan · illustrative',no:'generisk turbofan · illustrerende'}),W-10,H-6,{mono:1,size:9*fs,col:'#5F6D77',al:'right'});
}

function mount(){
  const host=document.getElementById('corePic'); if(!host) return;
  CORE.mount(host,{id:'essentials',steps,draw,aspect:16/8.4,aspectSm:1/1.15,dwell:6.5,
    title:{en:'Suck, squeeze, bang, blow: how a jet engine makes thrust',no:'Sug, klem, smell, blås: slik lager en jetmotor skyvekraft'},
    sub:{en:'The same four numbered stages as the engine lab. Follow the air through the core, see where the pressure and heat go, then why the fan does most of the work.',no:'De samme fire nummererte stadiene som i motorlabben. Følg luften gjennom kjernen, se hvor trykket og varmen går, og så hvorfor viften gjør mesteparten av jobben.'},
    label:{en:'Animated turbofan section with the gas path coloured by temperature, numbered stages, a pressure and temperature trace, the bypass flow and a hot-and-high comparison.',no:'Animert turbofansnitt med gassveien farget etter temperatur, nummererte stadier, en trykk- og temperaturkurve, bypassluften og en sammenligning for høy og varm flyplass.'},
    foot:{en:'Generic turbofan, illustrative values: overall pressure ratio about 30, turbine inlet about 1 500 °C, bypass ratio about 6.',no:'Generisk turbofan, illustrerende verdier: totalt trykkforhold omtrent 30, turbininnløp rundt 1 500 °C, bypassforhold omtrent 6.'}});
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
