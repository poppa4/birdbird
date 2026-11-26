/* NORDAP – engine3d-models.js: the turbofan and the turbojet for engine3d.js.
   Generic engines drawn to consistent proportions (not a specific make). Units: the fan/compressor casing radius ≈ 1 (turbofan) or 0.5 (turbojet).
   Every module is a part with the id, stage and explode direction used by engparts.js.
   A model: {title, intro, build(B), streams, tour, marks, order, home, cut, psize}.
   Stream points carry a station key (in, fan, comp, burn, hpt, itt, egt, exh) whose temperature comes live from the lab's engine model. */
(function(){
'use strict';
const E3M=window.E3M=window.E3M||{};
const t2=(en,no)=>({en,no});
const TAU=Math.PI*2;
/* piecewise-linear r(x) and slices of a profile */
const f=(pts,x)=>{ if(x<=pts[0][0]) return pts[0][1]; for(let i=0;i<pts.length-1;i++){ const a=pts[i],b=pts[i+1]; if(x<=b[0]){ const t=(x-a[0])/((b[0]-a[0])||1); return a[1]+(b[1]-a[1])*t; } } return pts[pts.length-1][1]; };
const sl=(pts,xa,xb)=>[[xa,f(pts,xa)],...pts.filter(p=>p[0]>xa+1e-4&&p[0]<xb-1e-4),[xb,f(pts,xb)]];
const H=E3M.H={f,sl,t2,
  /* casing of a module between xa and xb: outside line OUT, gas-path line IN */
  casing(B,xa,xb,OUT,IN,k,o){ return B.lathe(B.ringLoop(sl(OUT,xa,xb),sl(IN,xa,xb)),k||'case',o); },
  /* drum (hub) under the blades, wall thickness t */
  drum(B,xa,xb,IN,t,k,par){ const a=sl(IN,xa,xb); return B.lathe(B.ringLoop(a,a.map(p=>[p[0],p[1]-t])),k||'alu',{},par); },
  /* a bolted flange ring */
  flange(B,x,r,k){ return B.lathe(B.ringLoop([[x-0.009,r+0.022],[x+0.009,r+0.022]],[[x-0.009,r-0.002],[x+0.009,r-0.002]]),k||'case'); },
  /* a turbine/compressor disc: bore rb, rim rr, width w */
  disc(B,x,w,rb,rr,k,par){ const h=w/2, web=w*0.16;
    return B.lathe([[x-h,rb],[x+h,rb],[x+h,rb+0.012],[x+web,rb+0.03],[x+web,rr-0.025],[x+h,rr-0.012],[x+h,rr],[x-h,rr],[x-h,rr-0.012],[x-web,rr-0.025],[x-web,rb+0.03],[x-h,rb+0.012],[x-h,rb]],k||'alu',{},par); },
  /* one blade row between the hub line IN and the casing line OUT */
  row(B,x,IN,OUT,o,par){ const rot=o.rot, r0=f(IN,x)+(rot?0.001:0.004), r1=f(OUT,x)-(rot?0.004:0.001);
    return B.row(Object.assign({x,r0,r1,nc:7,ns:4},o),par); },
  /* dilution holes as dark dots on a liner */
  holes(B,x,r,n,size,par){ const g=new B.THREE.CylinderGeometry(size,size,0.004,10); return B.around(g,'dark',n,(i,p,e)=>{ const a=i*TAU/n+(x*37%1); p.set(x,r*Math.cos(a),r*Math.sin(a)); e.set(a,0,0); },par); },
  C:(M,k)=>{ const s=(M.stations||[]).find(q=>q[0]===k); return s?Math.round(s[1]-273.15)+' °C':'–'; },
  nf:(v,d)=>v==null||isNaN(v)?'–':Number(v).toLocaleString(document.documentElement.lang==='no'?'nb-NO':'en-GB',{minimumFractionDigits:d||0,maximumFractionDigits:d||0})
};
const {C,nf}=H;
const pct=v=>nf(v,1)+' %';

/* =========================================================================
   TURBOFAN – high bypass, two spools (generic A320-class engine)
   ========================================================================= */
const FCO=[[0.86,0.575],[0.95,0.612],[1.1,0.628],[1.3,0.615],[1.6,0.578],[2.0,0.545],[2.3,0.532],[2.7,0.512],[3.0,0.478],[3.3,0.43]];
const FGO=[[0.86,0.552],[1.0,0.53],[1.24,0.47],[1.3,0.425],[1.7,0.362],[2.12,0.305],[2.2,0.33],[2.26,0.44],[2.58,0.44],[2.62,0.345],[2.74,0.345],[2.8,0.36],[3.22,0.43],[3.32,0.405]];
const FGI=[[0.6,0.29],[0.86,0.37],[1.24,0.385],[1.3,0.245],[2.12,0.262],[2.2,0.235],[2.26,0.2],[2.58,0.2],[2.62,0.25],[2.74,0.25],[2.8,0.255],[3.22,0.29],[3.3,0.282]];
E3M.fan={
  title:t2('high-bypass turbofan','turbofan med høyt omløpsforhold'),
  intro:t2('A two-spool turbofan of the A320 class with a quarter cut away. The dots are the air: blue is cold, yellow and red are hot, white is the flame. Press <b>Start the walk-through</b> to follow one parcel of air from the inlet to the nozzle, one stage at a time. Drag to turn the engine, pinch or scroll to zoom.',
    'En turbofan med to spoler i A320-klassen, med en firedel skåret bort. Prikkene er luften: blått er kaldt, gult og rødt er varmt, hvitt er flammen. Trykk <b>Start gjennomgangen</b> for å følge én luftpakke fra innløpet til dysen, ett trinn om gangen. Dra for å snu motoren, klyp eller rull for å zoome.'),
  order:['inlet','fan','duct','lpc','hpc','diff','comb','hpt','lpt','noz','sh2','agb'],
  home:[0,0.05,0,54,18], fit:1.0, apAz:62, apEl:24, psize:0.024,
  v:(M)=>[['N1',pct(M.n1)],['N2',pct(M.n2)],['EGT',nf(M.egt,0)+' °C'],[t2('Fuel flow','Drivstoffstrøm'),nf(M.ffkg,0)+' kg/h'],[t2('Thrust','Skyv'),nf(M.thrust/1000,1)+' kN']],
  build(B){ const {THREE}=B;
    /* inlet: anti-ice lip, acoustic lining inside */
    B.part('inlet',1,[-1.55,0,0],{at:[0.15,0.85,0.75]});
    { const o=[[0,0.995],[0.012,1.04],[0.05,1.1],[0.15,1.165],[0.32,1.215],[0.5,1.235]], i=[[0,0.995],[0.025,0.965],[0.09,0.952],[0.3,0.962],[0.5,0.982]];
      const cols=[...[o[0],...o,o[o.length-1]].map(p=>p[0]<0.06?'#c9ced3':'#e3e7eb'),...[i[i.length-1],...i.slice().reverse(),i[0]].map(p=>p[0]<0.035?'#c9ced3':'#59616a'),'#c9ced3'];
      B.lathe(B.ringLoop(o,i),'paint',{cols}); }
    /* fan: spinner, disc, 24 wide-chord swept blades */
    B.part('fan',5,[-0.95,0,0],{at:[0.66,0.62,0.62]});
    { const R=B.rotor('a');
      B.lathe([[0.27,0],[0.3,0.06],[0.38,0.15],[0.5,0.235],[0.62,0.282],[0.74,0.295],[0.79,0.295],[0.79,0]],'steel',{},R);
      H.disc(B,0.67,0.11,0.05,0.285,'ti',R);
      B.row({x:0.665,n:24,r0:0.285,r1:0.958,c0:0.22,c1:0.36,s0:28,s1:60,t0:0.1,t1:0.035,m0:0.1,m1:0.035,sw:0.055,ln:-0.03,nc:14,ns:12,k:'ti'},R); }
    /* fan case, bypass duct, outlet guide vanes, nacelle */
    B.part('duct',5,[0.35,1.85,0],{at:[1.5,1.1,0.55]});
    { const o=[[0.5,1.235],[0.9,1.262],[1.3,1.25],[1.7,1.19],[2.1,1.085],[2.45,0.935]], i=[[0.5,0.982],[0.95,0.982],[1.15,0.976],[1.6,0.952],[2.1,0.9],[2.45,0.876]];
      const cols=[...[o[0],...o,o[o.length-1]].map(()=>'#e3e7eb'),...[i[i.length-1],...i.slice().reverse(),i[0]].map(p=>p[0]<0.98?'#8a939b':'#59616a'),'#e3e7eb'];
      B.lathe(B.ringLoop(o,i),'paint',{cols}); }
    B.row({x:1.25,n:44,r0:f(FCO,1.25)-0.004,r1:0.978,c0:0.12,c1:0.13,s0:-6,s1:4,t0:0.09,m0:0.12,nc:8,ns:5,k:'alu'});
    /* booster (LP compressor) and splitter */
    B.part('lpc',2,[-0.5,0,0],{at:[1.05,0.45,0.32]});
    H.casing(B,0.86,1.26,FCO,FGO,'case');
    B.lathe([[0.84,0.565],[0.86,0.552],[0.86,0.575],[0.84,0.565]],'steel');
    { const R=B.rotor('a'); H.drum(B,0.86,1.25,FGI,0.035,'alu',R);
      [0.92,1.04,1.16].forEach((x,k)=>H.row(B,x,FGI,FGO,{n:64+8*k,c0:0.06,c1:0.055,s0:35,s1:52,m0:0.06,rot:1},R)); }
    [0.975,1.095,1.215].forEach((x,k)=>H.row(B,x,FGI,FGO,{n:80+8*k,c0:0.045,s0:-18,s1:-22,m0:0.08}));
    /* HP compressor: inlet guide vanes + nine stages; variable-vane rings outside */
    B.part('hpc',2,[-0.12,0,0],{at:[1.7,0.36,0.3]});
    H.casing(B,1.26,2.15,FCO,FGO,'case');
    [1.5,1.8,2.0].forEach(x=>H.flange(B,x,f(FCO,x)));
    for(let k=0;k<4;k++){ const x=1.375+k*0.088, r=f(FCO,x)+0.012; B.lathe(B.ringLoop([[x-0.006,r+0.008],[x+0.006,r+0.008]],[[x-0.006,r],[x+0.006,r]]),'brass',{segs:72}); }
    H.row(B,1.3,FGI,FGO,{n:42,c0:0.035,s0:-8,s1:-12,m0:0.05});
    { const R=B.rotor('b'); H.drum(B,1.28,2.14,FGI,0.03,'alu',R);
      for(let k=0;k<9;k++){ const x=1.345+k*0.088; H.disc(B,x,0.03,0.11,f(FGI,x)-0.02,'alu',R); H.row(B,x,FGI,FGO,{n:38+5*k,c0:0.05-k*0.002,s0:38,s1:56,m0:0.06,t0:0.07,rot:1},R); } }
    for(let k=0;k<9;k++){ const x=1.39+k*0.088; H.row(B,x,FGI,FGO,{n:50+5*k,c0:0.04-k*0.0015,s0:-16,s1:-24,m0:0.08}); }
    /* diffuser */
    B.part('diff',2,[0.18,0,0],{at:[2.18,0.32,0.22]});
    H.casing(B,2.15,2.26,FCO,FGO,'case'); H.drum(B,2.14,2.26,FGI,0.025,'case');
    H.row(B,2.18,FGI,FGO,{n:64,c0:0.035,s0:-6,s1:-6,m0:0.1});
    /* combustor: case, outer and inner liners, dome, 20 fuel nozzles, dilution holes, the flame */
    B.part('comb',3,[0.5,0,0],{at:[2.42,0.34,0.34]});
    H.casing(B,2.26,2.6,FCO,FGO,'case'); H.drum(B,2.26,2.6,FGI,0.02,'case');
    B.wall([[2.3,0.397],[2.4,0.408],[2.5,0.4],[2.58,0.352]],0.012,'flame');
    B.wall([[2.3,0.248],[2.4,0.242],[2.5,0.248],[2.58,0.272]],0.012,'flame');
    B.lathe([[2.28,0.243],[2.28,0.402],[2.3,0.402],[2.3,0.243],[2.28,0.243]],'flame');
    H.holes(B,2.42,0.414,40,0.011); H.holes(B,2.49,0.41,40,0.009); H.holes(B,2.42,0.236,32,0.01);
    { const stem=new THREE.CylinderGeometry(0.008,0.008,0.17,10); stem.translate(0,0.17/2,0); B.around(stem,'steel',20,(i,p,e)=>{ const a=i*TAU/20; p.set(2.268,0.33*Math.cos(a),0.33*Math.sin(a)); e.set(a,0,0); });
      const tip=new THREE.CylinderGeometry(0.016,0.02,0.03,14); tip.rotateZ(-Math.PI/2); B.around(tip,'brass',20,(i,p,e)=>{ const a=i*TAU/20; p.set(2.285,0.322*Math.cos(a),0.322*Math.sin(a)); e.set(a,0,0); });
      const ig=new THREE.CylinderGeometry(0.012,0.012,0.2,10); ig.translate(0,0.1,0); B.around(ig,'brass',2,(i,p,e)=>{ const a=(i?0.6:-0.4)+Math.PI; p.set(2.34,0.37*Math.cos(a),0.37*Math.sin(a)); e.set(a,0,0); }); }
    { const g1=B.glow(B.latheGeo([[2.3,0.26],[2.3,0.385],[2.56,0.36],[2.57,0.28],[2.3,0.26]],72),0xff5a14), g2=B.glow(B.latheGeo([[2.31,0.29],[2.31,0.355],[2.46,0.34],[2.46,0.3],[2.31,0.29]],72),0xffb050);
      B.tick.push((dt,run,st,t)=>{ const on=st.mode==='walk'?run.fire||0:0, fl=0.85+0.15*Math.sin(t*23)+0.08*Math.sin(t*41); g1.material.opacity=0.2*on*fl; g2.material.opacity=0.22*on*fl; }); }
    /* HP turbine: cooled nozzle guide vanes (ceramic coated) + one rotor stage */
    B.part('hpt',4,[0.85,0,0],{at:[2.68,0.32,0.3]});
    H.casing(B,2.6,2.76,FCO,FGO,'case');
    H.row(B,2.625,FGI,FGO,{n:42,c0:0.04,s0:42,s1:44,m0:0.2,t0:0.16,k:'tbc'});
    { const R=B.rotor('b'); H.disc(B,2.69,0.05,0.1,0.245,'alu',R); H.row(B,2.69,FGI,FGO,{n:80,c0:0.038,s0:-30,s1:-38,m0:0.22,t0:0.15,k:'hot',rot:1},R); }
    /* LP turbine: four stages */
    B.part('lpt',4,[1.22,0,0],{at:[3.0,0.42,0.3]});
    H.casing(B,2.76,3.26,FCO,FGO,'case'); [2.9,3.05].forEach(x=>H.flange(B,x,f(FCO,x)));
    for(let k=0;k<4;k++) H.row(B,2.8+k*0.12,FGI,FGO,{n:72+8*k,c0:0.045,s0:36,s1:40,m0:0.18,t0:0.12,k:'hot'});
    { const R=B.rotor('a'); for(let k=0;k<4;k++){ const x=2.86+k*0.12; H.disc(B,x,0.04,0.07,f(FGI,x)-0.01,'alu',R); H.row(B,x,FGI,FGO,{n:100+10*k,c0:0.045,s0:-30,s1:-40,m0:0.2,t0:0.12,k:'hot',rot:1},R); } }
    /* core nozzle, rear frame struts, plug */
    B.part('noz',4,[1.65,0,0],{at:[3.5,0.38,0.2]});
    H.casing(B,3.26,3.32,FCO,FGO,'case');
    B.wall([[3.31,0.42],[3.45,0.395],[3.55,0.375]],0.014,'exh');
    B.lathe([[3.26,0],[3.26,0.288],[3.45,0.27],[3.65,0.21],[3.82,0.12],[3.95,0.02],[3.96,0]],'exh');
    B.row({x:3.3,n:14,r0:0.28,r1:0.41,c0:0.06,s0:0,s1:0,t0:0.18,m0:0,k:'case'});
    /* shafts: N1 inside N2 */
    B.part('sh2',5,[0,-1.05,0],{at:[1.9,0.12,0.25]});
    { const A=B.rotor('a'); B.cyl(0.04,0.04,2.7,'steel',{pos:[1.95,0,0]},A);
      const Bb=B.rotor('b'); B.wall([[1.29,0.09],[2.72,0.09]],0.022,'steel',{},Bb);
      [[0.8,0.06],[1.29,0.115],[2.72,0.115],[3.25,0.06]].forEach(([x,r])=>B.lathe(B.ringLoop([[x-0.02,r+0.03],[x+0.02,r+0.03]],[[x-0.02,r],[x+0.02,r]]),'dark')); }
    /* accessory gearbox on the fan case, tower shaft from the HP spool */
    B.part('agb',5,[0,-1.05,0],{at:[0.86,-1.12,0.2]});
    B.lathe(B.ringLoop([[0.66,1.15],[1.08,1.15]],[[0.66,1.0],[1.08,1.0]]),'cast',{phi0:Math.PI/2-0.42,phiLen:0.84,segs:24});
    /* starter, generator, fuel pump, hydraulic pump: drums on the front face of the gearbox */
    [[-0.26,0.075,0.22],[-0.08,0.062,0.18],[0.1,0.07,0.2],[0.27,0.05,0.14]].forEach(([a,r,l])=>B.cyl(r,r,l,'cast',{pos:[0.66-l/2,-1.075*Math.cos(a),1.075*Math.sin(a)]}));
    B.cyl(0.018,0.018,0.86,'steel',{pos:[0.9,-0.56,0],rot:[0,0,Math.PI/2]});
  },
  streams:[
    {axi:true,n:1000,sp:1.4,swirl:0.4,p:[[-0.8,0.42,'in',0.12],[0.0,0.45,'in',0.12],[0.5,0.46,'in',0.1],[0.66,0.44,'fan',0.1],[0.86,0.46,'fan',0.07],[1.0,0.45,'fan',0.06],[1.24,0.428,'fan',0.07],[1.3,0.335,'fan',0.07],[2.12,0.285,'comp',0.03],[2.2,0.29,'comp',0.06],[2.3,0.322,'burn',0.09,0.55],[2.56,0.318,'burn',0.08,0.55],[2.62,0.3,'burn',0.07],[2.74,0.3,'hpt',0.07],[2.8,0.31,'hpt',0.08],[3.22,0.36,'egt',0.1],[3.32,0.34,'egt',0.09],[3.6,0.3,'exh',0.1],[4.7,0.34,'exh',0.2]]},
    {axi:true,n:1900,sp:1.3,alpha:0.75,p:[[-0.8,0.78,'in',0.3],[0.0,0.76,'in',0.3],[0.5,0.77,'in',0.3],[0.66,0.78,'fan',0.3],[1.25,0.8,'fan',0.3],[1.8,0.77,'fan',0.26],[2.45,0.73,'fan',0.24],[3.2,0.66,'fan',0.3],[4.7,0.7,'fan',0.45]]}
  ],
  marks:[[0.25,0.6,0.6,1,t2('Inlet','Innløp')],[0.72,0.56,0.56,5,t2('Fan','Fan')],[1.7,0.23,0.23,2,t2('Compressor','Kompressor')],[2.43,0.23,0.23,3,t2('Combustor','Brennkammer')],[2.95,0.24,0.24,4,t2('Turbines','Turbiner')],[3.7,0.2,0.2,4,t2('Exhaust','Eksos')],[1.7,0.6,0.6,5,t2('Bypass','Omløp')]],
  tour:[
    {st:1,mk:0,p:['inlet'],cam:[0.25,0.3,0.25,28,16,3.6],trace:[0,0,3],t:t2('Inlet: slow the air down','Innløp: brems luften'),
      d:t2('Air arrives at flight speed. The inlet widens slightly, so the air slows to about Mach 0.5 at the fan face and its pressure rises: in cruise that ram rise is free compression before any blade has touched it. The thick, rounded lip lets the engine swallow air from the side at take-off without the flow separating.',
        'Luften kommer inn med flyfart. Innløpet vider seg litt ut, så luften bremses til rundt Mach 0,5 foran fanen og trykket stiger: i marsj er den ram-økningen gratis kompresjon før noe blad har rørt luften. Den tykke, avrundede leppen lar motoren svelge luft fra siden ved avgang uten at strømmen river seg løs.'),
      x:t2('Engine anti-ice heats the lip with bleed air. Ice that breaks off the lip goes straight into the fan.','Engine anti-ice varmer leppen med bleed-luft. Is som løsner fra leppen, går rett inn i fanen.'),
      v:(M)=>[[t2('Air at the fan face','Luft foran fanen'),C(M,'in')],['N1',pct(M.n1)]]},
    {st:5,mk:1,p:['fan','duct'],cam:[0.7,0.5,0.45,42,18,3.0],trace:[1,0,5],t:t2('Fan: most of the thrust','Fan: det meste av skyvet'),
      d:t2('The fan is a ducted propeller on the LP spool (N1). It raises the pressure only about 1.5 times, but it moves an enormous mass of air. Behind it the flow splits: roughly 5–6 kg goes <b>around</b> the core in the bypass duct for every kilogram that goes <b>into</b> it. That cold bypass air makes around 80 % of the take-off thrust.',
        'Fanen er en propell i kanal på LP-spolen (N1). Den øker trykket bare rundt 1,5 ganger, men flytter en enorm luftmengde. Bak den deles strømmen: rundt 5–6 kg går <b>utenom</b> kjernen i omløpskanalen for hver kilo som går <b>inn</b> i den. Den kalde omløpsluften lager rundt 80 % av startskyvet.'),
      x:t2('Why: thrust is mass flow × speed change, and the energy you waste is in the speed of the jet you leave behind. Accelerating a lot of air a little is far more efficient than a little air a lot. The outlet guide vanes behind the fan take the swirl out so the bypass air leaves straight back.','Hvorfor: skyv er massestrøm × fartsendring, og energien du kaster bort, ligger i farten til strålen du etterlater. Å akselerere mye luft litt er langt mer effektivt enn lite luft mye. Utløpsledeskovlene bak fanen fjerner virvelen så omløpsluften går rett bakover.'),
      v:(M)=>[['N1',pct(M.n1)],[t2('Thrust','Skyv'),nf(M.thrust/1000,1)+' kN'],[t2('Bypass air','Omløpsluft'),C(M,'fan')]]},
    {st:2,mk:2,p:['lpc','hpc'],cam:[1.65,0.28,0.22,72,24,2.15],trace:[0,5,8],t:t2('Compressor: squeeze it','Kompressor: klem den sammen'),
      d:t2('The core air goes through three booster stages on the LP shaft, then nine stages of the HP compressor (N2). Each stage is a row of spinning blades that speeds the air up and a row of fixed vanes that slows it again and turns that speed into pressure. Each stage adds only 1.2–1.4 times, but together the pressure rises about 30 times. The passage gets narrower because the air gets denser.',
        'Kjerneluften går gjennom tre boostertrinn på LP-akselen og så ni trinn i HP-kompressoren (N2). Hvert trinn er en rad med roterende blader som øker farten, og en rad med faste skovler som bremser den igjen og gjør farten om til trykk. Hvert trinn gir bare 1,2–1,4 ganger, men til sammen stiger trykket rundt 30 ganger. Kanalen blir smalere fordi luften blir tettere.'),
      x:t2('The front vanes (brass rings outside) are variable: the FADEC turns them with rpm so each blade row meets the air at the right angle of attack. A row at too high an angle stalls like a wing; if the whole compressor breaks down, it surges: a bang, EGT up, N1/N2 fluctuating.','De fremste skovlene (messingringene utenpå) er variable: FADEC dreier dem med turtallet så hver bladrad møter luften med riktig anstigningsvinkel. En rad med for høy vinkel staller som en vinge; bryter hele kompressoren sammen, får du surge: et smell, EGT opp, N1/N2 som svinger.'),
      v:(M)=>[[t2('Leaves the compressor','Ut av kompressoren'),C(M,'comp')],['N2',pct(M.n2)],[t2('Heated by squeezing alone','Varmet bare av kompresjonen'),'✓']]},
    {st:3,mk:3,p:['diff','comb'],cam:[2.43,0.26,0.24,78,26,1.35],trace:[0,8,12],t:t2('Combustor: add the heat','Brennkammer: tilfør varmen'),
      d:t2('The diffuser slows the air so the flame is not blown out. Twenty fuel nozzles spray kerosene into the annular liner. Only about a quarter of the air burns, near the nozzles, at close to 2 000 °C. The rest flows outside the liner, comes in through the rows of holes, cools the walls and dilutes the gas to a temperature the turbine can survive.',
        'Diffusoren bremser luften så flammen ikke blåses ut. Tjue dyser sprayer parafin inn i det ringformede flammerøret. Bare rundt en firedel av luften brenner, ved dysene, på nesten 2 000 °C. Resten strømmer utenfor flammerøret, kommer inn gjennom hullradene, kjøler veggene og blander ut gassen til en temperatur turbinen tåler.'),
      x:t2('The pressure stays almost the same through the combustor: heat is added at constant pressure (the Brayton cycle). Two igniters light it for the start and run continuously in heavy rain, icing and severe turbulence.','Trykket er nesten det samme gjennom brennkammeret: varmen tilføres ved konstant trykk (Brayton-syklusen). To tennplugger tenner ved start og går kontinuerlig i kraftig regn, ising og kraftig turbulens.'),
      v:(M)=>[[t2('Fuel flow','Drivstoffstrøm'),nf(M.ffkg,0)+' kg/h'],[t2('Gas into the turbine','Gass inn i turbinen'),C(M,'burn')]]},
    {st:4,mk:4,p:['hpt'],cam:[2.68,0.24,0.22,84,24,1.05],trace:[0,12,14],t:t2('HP turbine: drive the compressor','HP-turbin: driv kompressoren'),
      d:t2('The nozzle guide vanes speed the hot gas up and aim it at the single row of HP turbine blades. Those blades take out tens of megawatts and drive the HP compressor through the HP shaft (N2). The gas is hotter than the melting point of the blade metal: the blades survive because they are single crystals, cooled from inside by compressor air that leaves as a film over the surface, and coated with ceramic.',
        'Ledeskovlene øker farten på den varme gassen og retter den mot den ene raden med HP-turbinblader. Bladene henter ut titalls megawatt og driver HP-kompressoren gjennom HP-akselen (N2). Gassen er varmere enn smeltepunktet til metallet: bladene overlever fordi de er enkeltkrystaller, kjølt innenfra med kompressorluft som går ut som en film over overflaten, og belagt med keramikk.'),
      v:(M)=>[[t2('Turbine inlet','Turbininnløp'),C(M,'burn')],[t2('After the HP turbine','Etter HP-turbinen'),C(M,'hpt')],['N2',pct(M.n2)]]},
    {st:4,mk:4,p:['lpt'],cam:[3.0,0.3,0.28,86,24,1.6],trace:[0,14,16],t:t2('LP turbine: drive the fan','LP-turbin: driv fanen'),
      d:t2('Four larger stages take most of the energy that is left and drive the fan and booster through the LP shaft (N1), which runs inside the hollow HP shaft. The blades grow towards the back because the pressure falls and the gas expands. EGT is measured here: it is the pilot’s window on how hot the engine runs.',
        'Fire større trinn henter ut det meste av energien som er igjen, og driver fanen og boosteren gjennom LP-akselen (N1), som går inne i den hule HP-akselen. Bladene vokser bakover fordi trykket faller og gassen utvider seg. EGT måles her: den er pilotens vindu inn til hvor varm motoren går.'),
      v:(M)=>[['EGT',nf(M.egt,0)+' °C'],['N1',pct(M.n1)]]},
    {st:4,mk:5,p:['noz'],cam:[3.6,0.15,0.2,108,18,2.6],trace:[0,15,18],t:t2('Exhaust: the hot jet','Eksos: den varme strålen'),
      d:t2('What pressure is left is turned into speed in the core nozzle around the plug. The hot core jet gives only about 20 % of the thrust here; the cold bypass jet around it gives the rest. Behind the engine the two streams mix.',
        'Det trykket som er igjen, gjøres om til fart i kjernedysen rundt pluggen. Den varme kjernestrålen gir bare rundt 20 % av skyvet her; den kalde omløpsstrålen rundt den gir resten. Bak motoren blandes de to strømmene.'),
      v:(M)=>[[t2('Core exhaust','Kjerneeksos'),C(M,'exh')],[t2('Thrust','Skyv'),nf(M.thrust/1000,1)+' kN']]},
    {st:5,p:['sh2','agb','fan','lpt','hpc','hpt'],cam:[1.95,0.1,0.15,62,32,3.4],t:t2('Two spools and the gearbox','To spoler og girkassen'),
      d:t2('Two shafts, one inside the other, not connected: the LP spool (fan, booster, LP turbine: N1) and the HP spool (HP compressor and turbine: N2). Only the air couples them, so each runs at its own best speed. A tower shaft takes power from the HP spool down to the accessory gearbox: starter, fuel pump, oil pumps, hydraulic pump and generator.',
        'To aksler, den ene inni den andre, ikke koblet: LP-spolen (fan, booster, LP-turbin: N1) og HP-spolen (HP-kompressor og -turbin: N2). Bare luften kobler dem, så hver går med sitt beste turtall. En tårnaksel tar kraft fra HP-spolen ned til tilbehørsgirkassen: starter, drivstoffpumpe, oljepumper, hydraulikkpumpe og generator.'),
      v:(M)=>[['N1',pct(M.n1)],['N2',pct(M.n2)]]}
  ]
};

/* =========================================================================
   TURBOJET – single spool, can-annular combustor
   ========================================================================= */
const JCO=[[0.45,0.52],[1.4,0.43],[1.55,0.56],[2.18,0.58],[2.2,0.5],[2.5,0.5]];
const JGO=[[0.42,0.465],[1.4,0.33],[1.55,0.35],[2.18,0.36],[2.5,0.38]];
const JGI=[[0.42,0.18],[1.4,0.25],[1.55,0.24],[2.18,0.24],[2.5,0.24]];
E3M.jet={
  title:t2('turbojet','turbojet'),
  intro:t2('A single-spool turbojet with a quarter cut away. All the air goes through the core: squeezed by the compressor, heated in eight flame cans, partly expanded in the turbine that drives the compressor, and blown out as one fast, hot jet. Press <b>Start the walk-through</b> to follow it.',
    'En turbojet med én spole, med en firedel skåret bort. All luften går gjennom kjernen: klemt av kompressoren, varmet i åtte brennkamre, delvis ekspandert i turbinen som driver kompressoren, og blåst ut som én rask, varm stråle. Trykk <b>Start gjennomgangen</b> for å følge den.'),
  order:['inlet','comp','diff','comb','jturb','jpipe','jnoz','sh1','agb'],
  home:[0,0,0,54,18], fit:1.0, apAz:62, apEl:24, psize:0.018,
  v:(M)=>[['RPM',pct(M.n1)],['EGT',nf(M.egt,0)+' °C'],[t2('Fuel flow','Drivstoffstrøm'),nf(M.ffkg,0)+' kg/h'],[t2('Thrust','Skyv'),nf(M.thrust/1000,1)+' kN']],
  build(B){ const {THREE}=B;
    B.part('inlet',1,[-1.15,0,0],{at:[0.12,0.5,0.4]});
    B.lathe(B.ringLoop([[0,0.52],[0.02,0.55],[0.1,0.585],[0.42,0.6]],[[0,0.52],[0.04,0.495],[0.15,0.48],[0.42,0.465]]),'alu');
    B.lathe([[0.06,0],[0.1,0.06],[0.2,0.13],[0.34,0.17],[0.42,0.18],[0.42,0]],'alu');
    B.around(new THREE.BoxGeometry(0.12,0.3,0.022).translate(0,0.32,0),'alu',6,(i,p,e)=>{ p.set(0.3,0,0); e.set(i*TAU/6+0.26,0,0); });
    H.row(B,0.39,JGI,JGO,{n:30,c0:0.05,s0:4,s1:10,m0:0.08});
    B.part('comp',2,[-0.5,0,0],{at:[0.9,0.4,0.25]});
    H.casing(B,0.42,1.4,JCO.map(p=>p),JGO,'case'); [0.7,1.0,1.2].forEach(x=>H.flange(B,x,f(JCO,x)));
    { const R=B.rotor('a'); H.drum(B,0.44,1.4,JGI,0.03,'alu',R);
      for(let k=0;k<8;k++){ const x=0.47+k*0.115; H.disc(B,x,0.035,0.07,f(JGI,x)-0.02,'alu',R); H.row(B,x,JGI,JGO,{n:22+3*k,c0:0.058-k*0.002,s0:36,s1:54,m0:0.06,rot:1},R); } }
    for(let k=0;k<8;k++){ const x=0.53+k*0.115; H.row(B,x,JGI,JGO,{n:30+3*k,c0:0.045,s0:-16,s1:-22,m0:0.08}); }
    B.part('diff',2,[-0.15,0,0],{at:[1.47,0.4,0.3]});
    H.casing(B,1.4,1.55,JCO,JGO,'case'); H.drum(B,1.4,1.55,JGI,0.02,'case');
    H.row(B,1.43,JGI,JGO,{n:56,c0:0.035,s0:-6,s1:-6,m0:0.1});
    /* eight flame cans with fuel nozzles and cross-fire tubes */
    B.part('comb',3,[0.22,0,0],{at:[1.85,0.5,0.35]});
    B.wall([[1.55,0.57],[2.18,0.57]],0.022,'case'); B.wall([[1.55,0.235],[2.18,0.235]],0.02,'case');
    { const can=B.latheGeo(B.wallLoop([[1.58,0.025],[1.61,0.07],[1.68,0.098],[2.02,0.1],[2.15,0.085]],0.008),40), gl=B.latheGeo([[1.62,0.02],[1.66,0.085],[2.05,0.085],[2.12,0.06],[2.12,0.0],[1.62,0]],32);
      const R0=0.405;
      for(let i=0;i<8;i++){ const a=i*TAU/8+TAU/16, y=R0*Math.cos(a), z=R0*Math.sin(a);
        B.mesh(can,'flame',{pos:[0,y,z]});
        const nz=B.cyl(0.012,0.02,0.05,'brass',{pos:[1.57,y,z],cap:false}); void nz;
        const g=B.glow(gl,0xff5a14); g.position.set(0,y,z); g.userData.i=i; }
      const ct=new THREE.CylinderGeometry(0.014,0.014,2*R0*Math.sin(TAU/16)-0.19,10); ct.rotateX(Math.PI/2);
      B.around(ct,'flame',8,(i,p,e)=>{ const a=i*TAU/8; p.set(1.75,R0*Math.cos(TAU/16)*Math.cos(a),R0*Math.cos(TAU/16)*Math.sin(a)); e.set(a,0,0); });
      const fx=B.fx.filter(m=>m.userData.i!=null);
      B.tick.push((dt,run,st,t)=>{ const on=st.mode==='walk'?run.fire||0:0; fx.forEach((m,k)=>{ m.material.opacity=0.24*on*(0.85+0.15*Math.sin(t*21+k*1.7)); }); }); }
    B.part('jturb',4,[0.58,0,0],{at:[2.34,0.42,0.3]});
    H.casing(B,2.18,2.5,JCO,JGO,'case');
    H.row(B,2.22,JGI,JGO,{n:36,c0:0.05,s0:42,s1:44,m0:0.2,t0:0.16,k:'tbc'}); H.row(B,2.36,JGI,JGO,{n:40,c0:0.05,s0:40,s1:42,m0:0.18,t0:0.14,k:'hot'});
    { const R=B.rotor('a'); [2.29,2.43].forEach((x,k)=>{ H.disc(B,x,0.05,0.07,0.235,'alu',R); H.row(B,x,JGI,JGO,{n:60+8*k,c0:0.05,s0:-32,s1:-40,m0:0.22,t0:0.14,k:'hot',rot:1},R); }); }
    B.part('jpipe',4,[1.0,0,0],{at:[2.85,0.46,0.25]});
    B.wall([[2.5,0.49],[3.2,0.475]],0.018,'exh');
    B.lathe([[2.5,0],[2.5,0.24],[2.7,0.2],[2.95,0.09],[3.06,0.01],[3.07,0]],'exh');
    B.row({x:2.58,n:5,r0:0.22,r1:0.48,c0:0.09,s0:0,s1:0,t0:0.15,m0:0,k:'exh'});
    B.part('jnoz',4,[1.4,0,0],{at:[3.35,0.43,0.2]});
    B.wall([[3.2,0.475],[3.48,0.37]],0.014,'exh');
    B.around(new THREE.BoxGeometry(0.29,0.006,0.012),'dark',16,(i,p,e)=>{ const a=i*TAU/16; p.set(3.34,0.43*Math.cos(a),0.43*Math.sin(a)); e.set(a,0,-0.36); });
    B.part('sh1',5,[0,-0.85,0],{at:[1.5,0.1,0.22]});
    { const R=B.rotor('a'); B.cyl(0.05,0.05,2.05,'steel',{pos:[1.45,0,0]},R); }
    [[0.45,0.06],[1.42,0.075],[2.47,0.075]].forEach(([x,r])=>B.lathe(B.ringLoop([[x-0.02,r+0.03],[x+0.02,r+0.03]],[[x-0.02,r],[x+0.02,r]]),'dark'));
    B.part('agb',5,[0,-0.75,0],{at:[0.88,-0.72,0.2]});
    B.box(0.5,0.12,0.32,'cast',{pos:[0.9,-0.6,0]});
    [[0.6,0.06,0.16,-0.08],[1.12,0.05,0.14,0.08],[0.9,0.045,0.12,0]].forEach(([x,r,l,z])=>B.mesh(new THREE.CylinderGeometry(r,r,l,24),'cast',{pos:[x,-0.6-0.06-l/2,z]}));
    B.mesh(new THREE.CylinderGeometry(0.016,0.016,0.52,12),'steel',{pos:[0.62,-0.3,0]});
  },
  streams:[
    {axi:true,n:1500,sp:1.5,swirl:0.35,p:[[-0.7,0.33,'in',0.18],[0.0,0.34,'in',0.16],[0.42,0.32,'in',0.13],[1.4,0.29,'comp',0.04],[1.55,0.3,'comp',0.06],[1.62,0.405,'burn',0.12,0.55],[2.08,0.405,'burn',0.12,0.55],[2.18,0.3,'burn',0.06],[2.5,0.31,'egt',0.07],[2.9,0.34,'egt',0.1],[3.45,0.3,'exh',0.08],[4.6,0.34,'exh',0.16]]}
  ],
  marks:[[0.2,0.25,0.25,1,t2('Inlet','Innløp')],[0.95,0.2,0.2,2,t2('Compressor','Kompressor')],[1.85,0.29,0.29,3,t2('Flame cans','Brennkamre')],[2.35,0.22,0.22,4,t2('Turbine','Turbin')],[3.1,0.25,0.25,4,t2('Jet pipe and nozzle','Jetrør og dyse')]],
  tour:[
    {st:1,mk:0,p:['inlet'],cam:[0.25,0.22,0.2,30,16,2.1],trace:[0,0,2],t:t2('Inlet','Innløp'),
      d:t2('All the air the engine will use comes in here and goes straight into the compressor. The inlet guide vanes set the angle at which it meets the first blade row.','All luften motoren skal bruke, kommer inn her og går rett inn i kompressoren. Innløpsledeskovlene setter vinkelen den møter første bladrad med.'),
      v:(M)=>[[t2('Air in','Luft inn'),C(M,'in')],['RPM',pct(M.n1)]]},
    {st:2,mk:1,p:['comp','diff'],cam:[0.95,0.22,0.2,70,24,1.6],trace:[0,2,4],t:t2('Axial compressor','Aksialkompressor'),
      d:t2('Eight stages on one shaft squeeze the air about eight times. Each rotor row adds speed, each stator row turns it into pressure; the passage narrows as the air gets denser. The diffuser at the end slows the air down for the flame.','Åtte trinn på én aksel klemmer luften rundt åtte ganger. Hver rotorrad gir fart, hver statorrad gjør den om til trykk; kanalen blir smalere når luften blir tettere. Diffusoren til slutt bremser luften for flammen.'),
      v:(M)=>[[t2('Leaves the compressor','Ut av kompressoren'),C(M,'comp')],['RPM',pct(M.n1)]]},
    {st:3,mk:2,p:['comb'],cam:[1.86,0.3,0.3,80,30,1.45],trace:[0,4,7],t:t2('Flame cans','Brennkamre'),
      d:t2('Eight separate flame tubes (a can-annular combustor), each with its own fuel nozzle. Small cross-fire tubes join them, so the two igniters light all eight at the start. Air not used for burning cools the can walls and dilutes the gas before the turbine.','Åtte separate flammerør (et can-annular brennkammer), hvert med sin egen dyse. Små overtenningsrør kobler dem, så de to tennpluggene tenner alle åtte ved start. Luft som ikke brukes til forbrenning, kjøler veggene og blander ut gassen før turbinen.'),
      v:(M)=>[[t2('Fuel flow','Drivstoffstrøm'),nf(M.ffkg,0)+' kg/h'],[t2('Gas into the turbine','Gass inn i turbinen'),C(M,'burn')]]},
    {st:4,mk:3,p:['jturb'],cam:[2.34,0.22,0.22,84,24,1.05],trace:[0,7,9],t:t2('Turbine','Turbin'),
      d:t2('Two stages take out just enough energy to drive the compressor through the shaft. Everything they leave in the gas is for the jet. That is the difference from a turbofan or turboprop, where more turbine stages take almost all of it out to drive a fan or a propeller.','To trinn henter ut akkurat nok energi til å drive kompressoren gjennom akselen. Alt de lar være igjen i gassen, er til strålen. Det er forskjellen fra en turbofan eller turboprop, der flere turbintrinn henter ut nesten alt for å drive en fan eller en propell.'),
      v:(M)=>[['EGT',nf(M.egt,0)+' °C'],['RPM',pct(M.n1)]]},
    {st:4,mk:4,p:['jpipe','jnoz'],cam:[3.2,0.2,0.22,104,20,2.0],trace:[0,9,11],t:t2('Jet pipe and nozzle','Jetrør og dyse'),
      d:t2('The jet pipe straightens the gas; the converging nozzle turns its remaining pressure into speed. All the thrust comes from this one fast, hot jet. It is simple and slim, but the fast jet wastes energy at airliner speeds, so a turbojet burns much more fuel than a turbofan.','Jetrøret retter opp gassen; den konvergerende dysen gjør det gjenværende trykket om til fart. Alt skyvet kommer fra denne ene raske, varme strålen. Den er enkel og slank, men den raske strålen kaster bort energi ved trafikkflyfart, så en turbojet bruker mye mer drivstoff enn en turbofan.'),
      v:(M)=>[[t2('Exhaust','Eksos'),C(M,'exh')],[t2('Thrust','Skyv'),nf(M.thrust/1000,1)+' kN']]},
    {st:5,p:['sh1','agb','comp','jturb'],cam:[1.4,0.05,0.1,62,34,2.6],t:t2('One spool','Én spole'),
      d:t2('One shaft joins the turbine to the compressor: one rotating assembly, one rpm. The accessory gearbox underneath is driven from it by a tower shaft (starter, fuel pump, oil pump, generator).','Én aksel kobler turbinen til kompressoren: én roterende enhet, ett turtall. Tilbehørsgirkassen under drives fra den med en tårnaksel (starter, drivstoffpumpe, oljepumpe, generator).'),
      v:(M)=>[['RPM',pct(M.n1)]]}
  ]
};
})();
