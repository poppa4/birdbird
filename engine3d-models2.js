/* NORDAP – engine3d-models2.js: the turboprops (reverse flow and direct flow) and the four-cylinder piston engine for engine3d.js.
   Generic types, not a specific make. Same conventions as engine3d-models.js. */
(function(){
'use strict';
const E3M=window.E3M, H=E3M.H, {f,t2,C,nf}=H, TAU=Math.PI*2;
const pct=v=>nf(v,1)+' %';
const tpVals=(M,extra)=>[...(extra||[]),[t2('Torque','Moment'),nf(M.tq,0)+' %'],['ITT',nf(M.itt,0)+' °C'],['Ng',pct(M.ng)],['Np',nf(M.np,0)+' rpm']];

/* impeller vanes: a flat plate between the hub line and the shroud line (meridional plane x–r), copied round the axis */
function impeller(B,hub,shroud,n,par){ const {THREE}=B, s=new THREE.Shape();
  s.moveTo(hub[0][0],hub[0][1]); hub.slice(1).forEach(p=>s.lineTo(p[0],p[1])); shroud.slice().reverse().forEach(p=>s.lineTo(p[0],p[1])); s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:0.006,bevelEnabled:false}); g.translate(0,0,-0.003);
  return B.around(g,'blade',n,(i,p,e)=>{ p.set(0,0,0); e.set(i*TAU/n,0,0); },par,{ds:true}); }
/* planetary stage: sun on one spool, planets on a carrier (another spool), fixed ring */
function planetary(B,x,w,rs,zs,rp,zp,np,sunSpool,carSpool,k){ const S=B.rotor(sunSpool); B.gear(rs,zs,w,'steel',{pos:[x,0,0]},S);
  const Cr=B.rotor(carSpool); const rc=rs+rp; B.lathe(B.ringLoop([[x-w/2-0.018,rc+0.05],[x-w/2-0.006,rc+0.05]],[[x-w/2-0.018,0.03],[x-w/2-0.006,0.03]]),'alu',{segs:64},Cr);
  const pl=[]; for(let i=0;i<np;i++){ const a=i*TAU/np, g=new B.THREE.Group(); g.position.set(x,rc*Math.cos(a),rc*Math.sin(a)); Cr.add(g); B.gear(rp,zp,w*0.96,'steel',{},g); pl.push(g); }
  B.lathe(B.ringLoop([[x-w/2,rc+rp+0.034],[x+w/2,rc+rp+0.034]],[[x-w/2,rc+rp+0.004],[x+w/2,rc+rp+0.004]]),'steel',{segs:80});
  B.tick.push((dt,run)=>{ const ws=run[sunSpool]||0, wc=run[carSpool]||0, rel=-(zs/zp)*(ws-wc); pl.forEach(g=>{ g.rotation.x-=dt*rel*TAU; }); }); void k; }
function prop4(B,x,r1,n,par,o){ o=o||{}; return B.row(Object.assign({x,n,r0:0.165,r1,c0:0.17,c1:0.115,s0:34,s1:72,t0:0.14,t1:0.05,m0:0.05,m1:0.03,ln:0.03,nc:12,ns:10,k:'black',col:0x1d2125,tip:0xf2c230,tipAt:0.93},o),par); }

/* =========================================================================
   TURBOPROP – reverse flow, free power turbine (PT6-type layout)
   ========================================================================= */
const TIN=[[0.95,0.165],[1.48,0.17]], TOUT=[[0.95,0.29],[1.22,0.285],[1.48,0.283]];
E3M.tp={
  title:t2('free-turbine turboprop (reverse flow)','turboprop med fri turbin (motstrøm)'),
  intro:t2('The most common small turboprop layout, mounted “backwards”: the air goes in at the <b>back</b>, flows forward through the compressor, turns twice in the combustor, drives two separate turbines and leaves through the two stacks just behind the propeller. Press <b>Start the walk-through</b> to follow it.',
    'Den vanligste oppbygningen for små turboproper, montert «baklengs»: luften går inn <b>bak</b>, strømmer forover gjennom kompressoren, snur to ganger i brennkammeret, driver to separate turbiner og går ut gjennom de to eksosrørene like bak propellen. Trykk <b>Start gjennomgangen</b> for å følge den.'),
  order:['tinl','tax','imp','tdiff','tcomb','ct','pt','texh','rgb','prop','tsh','tagb'],
  home:[0.2,0.05,0,48,20], fit:0.95, apAz:58, apEl:22, psize:0.016, traceTh:0.75,
  v:(M)=>tpVals(M,[[t2('Shaft power','Akselkraft'),nf(M.shp,0)+' shp']]),
  build(B){ const {THREE}=B;
    /* propeller and spinner: never cut */
    B.part('prop',5,[-1.05,0,0],{at:[-0.08,1.0,0.3],noclip:true});
    { const P=B.rotor('p'); B.lathe([[-0.42,0],[-0.38,0.06],[-0.28,0.13],[-0.14,0.185],[0.0,0.205],[0.05,0.205],[0.05,0]],'white',{},P); prop4(B,-0.07,1.3,4,P); }
    /* reduction gearbox: two planetary stages, about 15 : 1 */
    B.part('rgb',5,[-0.62,0,0],{at:[0.3,0.32,0.18]});
    B.wall([[0.06,0.13],[0.1,0.2],[0.2,0.28],[0.35,0.312],[0.5,0.312],[0.56,0.305]],0.018,'cast');
    B.lathe([[0.548,0.05],[0.548,0.3],[0.562,0.3],[0.562,0.05],[0.548,0.05]],'cast');
    planetary(B,0.46,0.04,0.045,12,0.075,20,3,'a','m');
    planetary(B,0.29,0.05,0.06,14,0.065,16,3,'m','p');
    { const P=B.rotor('p'); B.cyl(0.055,0.055,0.32,'steel',{pos:[0.12,0,0]},P); B.lathe([[-0.01,0.05],[-0.01,0.13],[0.02,0.13],[0.02,0.05],[-0.01,0.05]],'steel',{},P); }
    /* exhaust duct and the two stacks */
    B.part('texh',4,[-0.3,0.55,0],{at:[0.78,0.05,0.62]});
    B.wall([[0.565,0.31],[0.64,0.37],[0.88,0.372],[0.97,0.32]],0.014,'exh');
    B.wall([[0.565,0.12],[0.8,0.13],[0.97,0.158]],0.012,'exh');
    { const st=B.latheGeo(B.wallLoop([[0,0.085],[0.16,0.09],[0.26,0.12],[0.3,0.128]],0.012),48); [1,-1].forEach(s=>B.mesh(st,'exh',{pos:[0.77,0,s*0.3],rot:[0,-s*65*Math.PI/180,0]})); }
    /* power turbine: two stages on the Np shaft (gas flows forward) */
    B.part('pt',4,[-0.18,0,0],{at:[1.1,0.27,0.18]});
    B.lathe(B.ringLoop([[0.97,0.305],[1.23,0.305]],H.sl(TOUT,0.97,1.23)),'case');
    [1.19,1.07].forEach(x=>H.row(B,x,TIN,TOUT,{n:34,c0:0.045,s0:-40,s1:-42,m0:0.2,t0:0.13,k:'hot'}));
    { const R=B.rotor('a'); [1.13,1.01].forEach(x=>{ H.disc(B,x,0.04,0.045,0.16,'alu',R); H.row(B,x,TIN,TOUT,{n:46,c0:0.042,s0:32,s1:40,m0:0.2,t0:0.12,k:'hot',rot:1},R); }); }
    /* compressor turbine: one stage on the Ng shaft */
    B.part('ct',4,[0.06,0,0],{at:[1.39,0.27,0.18]});
    B.lathe(B.ringLoop([[1.23,0.305],[1.47,0.305]],H.sl(TOUT,1.23,1.47)),'case');
    H.row(B,1.43,TIN,TOUT,{n:30,c0:0.05,s0:-42,s1:-44,m0:0.2,t0:0.16,k:'tbc'});
    { const R=B.rotor('b'); H.disc(B,1.37,0.05,0.05,0.16,'alu',R); H.row(B,1.37,TIN,TOUT,{n:52,c0:0.045,s0:32,s1:38,m0:0.22,t0:0.14,k:'hot',rot:1},R); }
    /* reverse-flow combustor: gas generator case, liners, dome with 14 nozzles, exit duct turning the gas 180° */
    B.part('tcomb',3,[0.34,0,0],{at:[1.25,0.47,0.3]});
    B.wall([[0.96,0.37],[1.03,0.5],[1.56,0.52],[1.62,0.505]],0.016,'case');
    B.wall([[1.045,0.441],[1.3,0.446],[1.48,0.447]],0.01,'flame'); B.wall([[1.045,0.329],[1.3,0.329],[1.465,0.33]],0.01,'flame');
    B.lathe([[1.03,0.324],[1.03,0.446],[1.046,0.446],[1.046,0.324],[1.03,0.324]],'flame');
    B.wall([[1.48,0.452],[1.53,0.44],[1.558,0.4],[1.555,0.335],[1.525,0.3],[1.48,0.292]],0.01,'flame');
    H.holes(B,1.2,0.452,36,0.01); H.holes(B,1.33,0.452,36,0.008); H.holes(B,1.25,0.323,30,0.009);
    { const stem=new THREE.CylinderGeometry(0.008,0.008,0.12,10); stem.translate(0,0.06,0); B.around(stem,'steel',14,(i,p,e)=>{ const a=i*TAU/14; p.set(1.02,0.385*Math.cos(a),0.385*Math.sin(a)); e.set(a,0,0); });
      const tip=new THREE.CylinderGeometry(0.012,0.016,0.026,12); tip.rotateZ(-Math.PI/2); B.around(tip,'brass',14,(i,p,e)=>{ const a=i*TAU/14; p.set(1.05,0.385*Math.cos(a),0.385*Math.sin(a)); e.set(a,0,0); });
      const g1=B.glow(B.latheGeo([[1.05,0.34],[1.05,0.435],[1.46,0.44],[1.54,0.39],[1.5,0.34],[1.05,0.34]],64),0xff5a14), g2=B.glow(B.latheGeo([[1.06,0.36],[1.06,0.415],[1.24,0.418],[1.24,0.36],[1.06,0.36]],64),0xffb050);
      B.tick.push((dt,run,st,t)=>{ const on=st.mode==='walk'?run.fire||0:0, fl=0.85+0.15*Math.sin(t*23)+0.08*Math.sin(t*37); g1.material.opacity=0.2*on*fl; g2.material.opacity=0.22*on*fl; }); }
    /* diffuser pipes from the impeller tip, then forward round the liner */
    B.part('tdiff',2,[0.58,0,0],{at:[1.68,0.5,0.15]});
    B.wall([[1.62,0.505],[1.7,0.5],[1.76,0.44],[1.785,0.38]],0.016,'case');
    { const cu=new THREE.CatmullRomCurve3([[1.748,0.37,0],[1.738,0.43,0.04],[1.71,0.475,0.07],[1.64,0.485,0.08]].map(p=>new THREE.Vector3(...p))); const g=new THREE.TubeGeometry(cu,20,0.017,10,false); B.around(g,'alu',15,(i,p,e)=>{ p.set(0,0,0); e.set(i*TAU/15,0,0); }); }
    /* centrifugal impeller and its shroud */
    B.part('imp',2,[0.78,0,0],{at:[1.79,0.32,0.18]});
    B.wall([[1.885,0.248],[1.84,0.262],[1.805,0.3],[1.787,0.372]],0.012,'case');
    { const R=B.rotor('b'); B.lathe([[1.86,0],[1.86,0.155],[1.82,0.18],[1.785,0.235],[1.76,0.3],[1.748,0.365],[1.738,0.372],[1.738,0]],'ti',{},R);
      impeller(B,[[1.86,0.156],[1.82,0.181],[1.785,0.236],[1.76,0.301],[1.749,0.368]],[[1.874,0.24],[1.835,0.258],[1.8,0.298],[1.778,0.368]],17,R); }
    /* three axial stages */
    const AI=[[1.86,0.15],[2.12,0.13]], AO=[[1.86,0.245],[2.12,0.245]];
    B.part('tax',2,[1.0,0,0],{at:[1.99,0.26,0.16]});
    B.lathe(B.ringLoop([[1.86,0.275],[2.12,0.275]],AO),'case');
    { const R=B.rotor('b'); H.drum(B,1.86,2.12,AI,0.025,'alu',R); [2.07,2.0,1.93].forEach((x,k)=>H.row(B,x,AI,AO,{n:26+4*k,c0:0.035,s0:-36,s1:-52,m0:0.06,rot:1},R)); }
    [2.035,1.965,1.895].forEach((x,k)=>H.row(B,x,AI,AO,{n:34+4*k,c0:0.03,s0:16,s1:22,m0:0.08}));
    /* inlet: scoop under the nose, duct along the bottom, plenum and screen at the back */
    B.part('tinl',1,[1.25,0,0],{at:[2.22,0.46,0.12]});
    B.wall([[2.12,0.452],[2.34,0.452]],0.016,'case');
    B.lathe([[2.335,0.1],[2.335,0.46],[2.35,0.46],[2.35,0.1],[2.335,0.1]],'case');
    B.lathe([[2.105,0.28],[2.105,0.46],[2.12,0.46],[2.12,0.28],[2.105,0.28]],'case');
    B.mesh(new THREE.CylinderGeometry(0.29,0.29,0.2,64,1,true).rotateZ(-Math.PI/2),'screen',{pos:[2.225,0,0],ds:true});
    B.lathe([[2.335,0],[2.335,0.1],[2.25,0.13],[2.16,0.15],[2.12,0.152],[2.12,0]],'alu');
    B.tube([[0.34,-0.57,0],[0.5,-0.53,0],[1.0,-0.52,0],[1.9,-0.52,0],[2.14,-0.505,0],[2.22,-0.44,0]],0.075,'case',{ds:true});
    B.mesh(new THREE.TorusGeometry(0.075,0.012,10,32).rotateY(Math.PI/2),'case',{pos:[0.34,-0.57,0],cap:false});
    /* accessory gearbox at the very back */
    B.part('tagb',5,[1.6,0,0],{at:[2.5,0.33,0.12]});
    B.lathe([[2.35,0],[2.35,0.32],[2.42,0.34],[2.56,0.31],[2.62,0.2],[2.64,0]],'cast');
    B.cyl(0.07,0.07,0.26,'cast',{pos:[2.77,0.12,0.1]}); B.box(0.16,0.12,0.12,'cast',{pos:[2.72,-0.15,-0.06]}); B.cyl(0.035,0.035,0.12,'cast',{pos:[2.7,0.02,-0.2]});
    B.mesh(new THREE.CylinderGeometry(0.04,0.04,0.12,20),'brass',{pos:[2.5,0.38,0]});
    /* shafts: Ng (compressor turbine → compressor → gearbox) and Np (power turbine → reduction gearbox), end to end */
    B.part('tsh',5,[0,-0.75,0],{at:[1.75,0.08,0.12]});
    { const R=B.rotor('b'); B.cyl(0.045,0.045,1.0,'steel',{pos:[1.85,0,0]},R); const A=B.rotor('a'); B.cyl(0.035,0.035,0.72,'steel',{pos:[0.79,0,0]},A); }
  },
  streams:[
    {n:300,sp:1.0,p:[[0.3,-0.58,0,'in',0.045],[0.5,-0.53,0,'in',0.045],[1.0,-0.52,0,'in',0.045],[1.9,-0.52,0,'in',0.045],[2.15,-0.5,0,'in',0.04],[2.23,-0.44,0,'in',0.03]]},
    {axi:true,n:1250,sp:0.9,stacks:[Math.PI/2,-Math.PI/2],from:22,p:[[2.23,0.44,'in',0.02],[2.24,0.36,'in',0.06],[2.22,0.25,'in',0.05],[2.13,0.2,'in',0.07],[1.88,0.195,'comp',0.07],[1.84,0.215,'comp',0.06],[1.77,0.3,'comp',0.05],[1.75,0.39,'comp',0.03],[1.69,0.48,'comp',0.03],[1.6,0.48,'comp',0.03],[1.1,0.475,'comp',0.035],[1.04,0.47,'comp',0.03],[1.06,0.39,'burn',0.08,0.55],[1.45,0.39,'burn',0.08,0.55],[1.53,0.385,'burn',0.06],[1.535,0.33,'itt',0.04],[1.48,0.235,'itt',0.08],[1.36,0.228,'itt',0.09],[1.25,0.228,'itt',0.09],[1.13,0.228,'exh',0.09],[0.99,0.23,'exh',0.09],[0.86,0.25,'exh',0.09],[0.78,0.29,'exh',0.06],[0.76,0.36,'exh',0.05],[0.79,0.5,'exh',0.06],[0.86,0.68,'exh',0.08],[0.97,0.95,'exh',0.14]]},
    {axi:true,n:500,sp:1.6,alpha:0.32,size:1.4,p:[[-1.2,0.85,'in',0.45],[-0.07,0.85,'in',0.45],[1.0,0.8,'in',0.42],[2.9,0.8,'in',0.45]]}
  ],
  marks:[[1.3,-0.52,0.1,1,t2('Inlet duct','Innløpskanal')],[2.23,0.3,0.3,1,t2('Screen','Gitter')],[1.86,0.16,0.16,2,t2('Compressor','Kompressor')],[1.26,0.28,0.28,3,t2('Combustor','Brennkammer')],[1.15,0.16,0.16,4,t2('Turbines','Turbiner')],[0.8,0,0.6,4,t2('Exhaust','Eksos')],[0.32,0.2,0.2,5,t2('Gearbox','Gir')],[-0.05,0.95,0.45,5,t2('Propeller','Propell')]],
  tour:[
    {st:1,mk:0,p:['tinl'],cam:[1.25,-0.42,0.05,74,-10,3.0],trace:[0,0,5],t:t2('In at the front, back to the rear','Inn foran, bakover til baksiden'),
      d:t2('Air enters the scoop just behind the propeller and is ducted <b>backward</b>, along the bottom of the engine, to the rear. The engine is mounted “backwards”: its cold inlet is at the back.','Luften kommer inn i inntaket like bak propellen og ledes <b>bakover</b> langs undersiden av motoren til baksiden. Motoren er montert «baklengs»: det kalde innløpet er bak.'),
      x:t2('An inertial separator in the duct can be opened in icing or on gravel: the air must turn sharply, and the heavy water, ice and stones carry straight on and are dumped overboard.','En treghetsseparator i kanalen kan åpnes i ising eller på grus: luften må svinge skarpt, og tungt vann, is og stein fortsetter rett fram og dumpes ut.'),
      v:(M)=>[[t2('Air in','Luft inn'),C(M,'in')],['Ng',pct(M.ng)]]},
    {st:1,mk:1,p:['tinl'],cam:[2.22,0.22,0.2,128,24,1.5],trace:[1,0,4],t:t2('Screen and plenum: turn 180°','Gitter og plenum: snu 180°'),
      d:t2('At the back the air fills a ring-shaped plenum, passes through the inlet screen (which stops debris) and turns 180° to flow <b>forward</b> into the compressor.','Bak fyller luften et ringformet plenum, går gjennom inntaksgitteret (som stopper rusk) og snur 180° for å strømme <b>forover</b> inn i kompressoren.'),
      v:(M)=>[[t2('Air in','Luft inn'),C(M,'in')]]},
    {st:2,mk:2,p:['tax','imp'],cam:[1.88,0.2,0.2,98,26,1.25],trace:[1,3,8],t:t2('Compressor: axial, then centrifugal','Kompressor: aksial, så sentrifugal'),
      d:t2('Three small axial stages squeeze the air first. Then the centrifugal impeller flings it outward at high speed; its own shape does much of the compressing. Together they raise the pressure about seven to nine times, all on the Ng spool.','Tre små aksialtrinn klemmer luften først. Så slynger sentrifugalimpelleren den utover med høy fart; formen gjør mye av kompresjonen. Til sammen øker de trykket rundt sju til ni ganger, alt på Ng-spolen.'),
      x:t2('A centrifugal stage does in one stage what takes several axial ones, and it shrugs off sand and small birds better. Its drawback is diameter, which is why big jets use axial compressors.','Et sentrifugaltrinn gjør med ett trinn det som krever flere aksiale, og det tåler sand og småfugl bedre. Ulempen er diameteren, og derfor bruker store jetmotorer aksialkompressorer.'),
      v:(M)=>[[t2('Leaves the compressor','Ut av kompressoren'),C(M,'comp')],['Ng',pct(M.ng)]]},
    {st:2,mk:3,p:['tdiff','tcomb'],cam:[1.52,0.36,0.3,88,28,1.4],trace:[1,7,12],t:t2('Diffuser: out and forward round the liner','Diffusor: ut og forover rundt flammerøret'),
      d:t2('The diffuser pipes catch the fast air from the impeller tip, slow it so its speed becomes pressure, and turn it again: it now flows <b>forward</b> outside the combustion liner, cooling it, and enters the liner through rows of holes.','Diffusorrørene fanger den raske luften fra impellertuppen, bremser den så farten blir trykk, og snur den igjen: den strømmer nå <b>forover</b> utenfor flammerøret, kjøler det, og går inn i flammerøret gjennom rader med hull.'),
      v:(M)=>[[t2('Compressor delivery','Kompressorluft'),C(M,'comp')]]},
    {st:3,mk:3,p:['tcomb'],cam:[1.27,0.33,0.3,82,30,1.2],trace:[1,11,16],t:t2('Reverse-flow combustor','Brennkammer med motstrøm'),
      d:t2('Fourteen nozzles at the front of the ring-shaped liner spray fuel; it burns while the gas flows <b>rearward</b>. At the back the exit duct turns it 180° once more, so it flows <b>forward</b> into the turbines. Folding the path makes the engine short.','Fjorten dyser foran i det ringformede flammerøret sprayer drivstoff; det brenner mens gassen strømmer <b>bakover</b>. Bak snur utløpskanalen den 180° én gang til, så den strømmer <b>forover</b> inn i turbinene. Å brette veien gjør motoren kort.'),
      v:(M)=>tpVals(M,[[t2('Fuel flow','Drivstoffstrøm'),nf(M.ffkg,0)+' kg/h']]).slice(0,3)},
    {st:4,mk:4,p:['ct'],cam:[1.4,0.22,0.2,86,24,0.95],trace:[1,15,18],t:t2('Compressor turbine (Ng)','Kompressorturbin (Ng)'),
      d:t2('The first turbine takes out just enough work to drive the compressor through the Ng shaft. Compressor, Ng shaft and this turbine together are the <b>gas generator</b>: their job is to make a stream of hot, fast gas.','Den første turbinen henter ut akkurat nok arbeid til å drive kompressoren gjennom Ng-akselen. Kompressor, Ng-aksel og denne turbinen er til sammen <b>gassgeneratoren</b>: jobben deres er å lage en strøm av varm, rask gass.'),
      x:t2('ITT is measured just after this turbine, between it and the power turbine. It is the temperature limit you watch.','ITT måles rett etter denne turbinen, mellom den og kraftturbinen. Det er temperaturgrensen du følger med på.'),
      v:(M)=>[['ITT',nf(M.itt,0)+' °C'],['Ng',pct(M.ng)]]},
    {st:4,mk:4,p:['pt','tsh'],cam:[1.1,0.22,0.2,82,24,1.05],trace:[1,18,21],t:t2('Free power turbine (Np)','Fri kraftturbin (Np)'),
      d:t2('Two more stages on their own shaft take the energy out of the gas and send it forward to the propeller. No shaft joins them to the gas generator: only the gas. That is the <b>free turbine</b>: the propeller can turn at its own speed while Ng varies, and the starter only has to turn the gas generator.','To trinn til på sin egen aksel henter energien ut av gassen og sender den fram til propellen. Ingen aksel kobler dem til gassgeneratoren: bare gassen. Det er den <b>frie turbinen</b>: propellen kan gå med sitt eget turtall mens Ng varierer, og starteren trenger bare å dreie gassgeneratoren.'),
      v:(M)=>[['Np',nf(M.np,0)+' rpm'],[t2('Shaft power','Akselkraft'),nf(M.shp,0)+' shp'],[t2('Torque','Moment'),nf(M.tq,0)+' %']]},
    {st:4,mk:5,p:['texh'],cam:[0.78,0.18,0.35,72,30,1.7],trace:[1,21,26],t:t2('Exhaust stacks','Eksosrør'),
      d:t2('The gas turns 90° and leaves through the two stacks just behind the propeller. It has given almost all its energy to the turbines, so the exhaust adds only a little thrust.','Gassen svinger 90° og går ut gjennom de to eksosrørene like bak propellen. Den har gitt nesten all energien til turbinene, så eksosen gir bare litt skyv.'),
      v:(M)=>[[t2('Exhaust','Eksos'),C(M,'exh')]]},
    {st:5,mk:6,p:['rgb','tsh'],cam:[0.32,0.18,0.15,58,26,1.15],t:t2('Reduction gearbox','Reduksjonsgir'),
      d:t2('The power turbine turns at around 30 000 rpm; a propeller tip must stay below the speed of sound. Two planetary stages in the nose gear it down about 15 : 1 to the 1 600–2 000 rpm of the propeller. Torque is measured here, and it is the limit you meet first low and cool.','Kraftturbinen går med rundt 30 000 o/min; en propelltupp må holde seg under lydhastigheten. To planetgir i nesen girer ned rundt 15 : 1 til propellens 1 600–2 000 o/min. Momentet måles her, og det er grensen du møter først lavt og kaldt.'),
      v:(M)=>[[t2('Torque','Moment'),nf(M.tq,0)+' %'],['Np',nf(M.np,0)+' rpm']]},
    {st:5,mk:7,p:['prop'],cam:[-0.1,0.05,0,32,14,3.7],trace:[2,0,3],t:t2('Propeller','Propell'),
      d:t2('The propeller makes the thrust: it accelerates a lot of air a little, which is very efficient at low and medium speed. A governor holds the rpm by changing the blade angle; below flight idle the pilot controls the angle directly (beta) down to reverse, and the blades can be feathered edge-on.','Propellen lager skyvet: den akselererer mye luft litt, og det er svært effektivt ved lav og middels fart. En governor holder turtallet ved å endre bladvinkelen; under flight idle styrer piloten vinkelen direkte (beta) ned til revers, og bladene kan fløyes med kanten mot luften.'),
      v:(M)=>[['Np',nf(M.np,0)+' rpm'],[t2('Thrust','Skyv'),nf(M.thrust/1000,1)+' kN']]}
  ]
};

/* =========================================================================
   TURBOPROP – direct flow, offset gearbox (larger regional turboprops)
   ========================================================================= */
const YP=0.26;
E3M.tpd={
  title:t2('free-turbine turboprop (direct flow)','turboprop med fri turbin (direkte strøm)'),
  intro:t2('The layout of larger regional turboprops: the air goes in under the nose and straight through, front to back. The power turbine shaft runs forward through the hollow gas-generator shaft to an offset gearbox. Press <b>Start the walk-through</b> to follow it.',
    'Oppbygningen på større regionale turboproper: luften går inn under nesen og rett gjennom, fra front til bak. Kraftturbinakselen går forover gjennom den hule gassgeneratorakselen til et forskjøvet gir. Trykk <b>Start gjennomgangen</b> for å følge den.'),
  order:['dinl','tax','imp','ddiff','dcomb','ct','pt','dexh','rgb','prop','dsh','dagb'],
  home:[0.1,0.05,0,48,20], fit:0.95, apAz:58, apEl:22, psize:0.016,
  v:(M)=>tpVals(M,[[t2('Shaft power','Akselkraft'),nf(M.shp,0)+' shp']]),
  build(B){ const {THREE}=B;
    B.part('prop',5,[-1.0,0,0],{at:[-0.08,1.25,0.3],noclip:true});
    { const P=B.rotor('p'); P.position.y=YP; B.lathe([[-0.42,0],[-0.38,0.06],[-0.28,0.13],[-0.14,0.185],[0.0,0.205],[0.05,0.205],[0.05,0]],'white',{},P); prop4(B,-0.07,1.35,6,P,{c0:0.15,c1:0.1}); }
    B.part('rgb',5,[-0.55,0.35,0],{at:[0.35,0.58,0.2]});
    { const G=new THREE.Group(); G.position.y=YP; B.add(G); B.wall([[0.06,0.14],[0.14,0.26],[0.3,0.36],[0.58,0.36],[0.63,0.3]],0.018,'cast',{},G);
      B.lathe([[0.62,0.04],[0.62,0.3],[0.635,0.3],[0.635,0.04],[0.62,0.04]],'cast',{},G);
      const P=B.rotor('p',G); B.gear(0.19,48,0.05,'steel',{pos:[0.48,0,0]},P); B.cyl(0.055,0.055,0.5,'steel',{pos:[0.23,0,0]},P);
      const A=B.rotor('a'); B.gear(0.064,16,0.05,'steel',{pos:[0.48,0,0]},A); }
    B.part('dinl',1,[-0.25,-0.55,0],{at:[0.45,-0.45,0.12]});
    B.tube([[0.12,-0.45,0],[0.4,-0.42,0],[0.6,-0.3,0],[0.7,-0.17,0]],0.08,'case',{ds:true});
    B.mesh(new THREE.TorusGeometry(0.08,0.013,10,32).rotateY(Math.PI/2),'case',{pos:[0.12,-0.45,0],cap:false});
    B.wall([[0.66,0.3],[0.74,0.29]],0.016,'case'); B.lathe([[0.645,0],[0.645,0.1],[0.74,0.13],[0.74,0]],'cast');
    const AI=[[0.74,0.13],[0.95,0.16]], AO=[[0.74,0.27],[0.95,0.25]];
    B.part('tax',2,[-0.05,0,0],{at:[0.85,0.3,0.15]});
    B.lathe(B.ringLoop([[0.74,0.3],[0.95,0.29]],AO),'case');
    { const R=B.rotor('b'); H.drum(B,0.74,0.95,AI,0.025,'alu',R); [0.78,0.86].forEach((x,k)=>H.row(B,x,AI,AO,{n:24+4*k,c0:0.04,s0:36,s1:52,m0:0.06,rot:1},R)); }
    [0.82,0.9].forEach((x,k)=>H.row(B,x,AI,AO,{n:32+4*k,c0:0.034,s0:-16,s1:-22,m0:0.08}));
    B.part('imp',2,[0.12,0,0],{at:[1.02,0.36,0.16]});
    B.wall([[0.93,0.262],[0.98,0.28],[1.02,0.33],[1.04,0.385]],0.012,'case');
    { const R=B.rotor('b'); B.lathe([[0.93,0],[0.93,0.165],[0.98,0.19],[1.03,0.26],[1.06,0.34],[1.075,0.38],[1.09,0.38],[1.09,0]],'ti',{},R);
      impeller(B,[[0.935,0.167],[0.98,0.192],[1.03,0.262],[1.06,0.342],[1.072,0.378]],[[0.935,0.252],[0.965,0.266],[0.995,0.29],[1.022,0.33],[1.042,0.378]],17,R); }
    B.part('ddiff',2,[0.3,0,0],{at:[1.12,0.46,0.18]});
    B.wall([[1.04,0.4],[1.1,0.46],[1.2,0.472]],0.016,'case');
    { const cu=new THREE.CatmullRomCurve3([[1.08,0.39,0],[1.1,0.43,0.04],[1.15,0.445,0.06],[1.22,0.44,0.06]].map(p=>new THREE.Vector3(...p))); B.around(new THREE.TubeGeometry(cu,16,0.017,10,false),'alu',15,(i,p,e)=>{ p.set(0,0,0); e.set(i*TAU/15,0,0); }); }
    B.part('dcomb',3,[0.5,0,0],{at:[1.4,0.46,0.25]});
    B.wall([[1.2,0.472],[1.58,0.462],[1.66,0.38]],0.016,'case'); B.wall([[1.2,0.235],[1.6,0.235]],0.016,'case');
    B.wall([[1.245,0.422],[1.55,0.402]],0.01,'flame'); B.wall([[1.245,0.3],[1.55,0.31]],0.01,'flame');
    B.lathe([[1.23,0.295],[1.23,0.427],[1.246,0.427],[1.246,0.295],[1.23,0.295]],'flame');
    H.holes(B,1.38,0.418,36,0.009); H.holes(B,1.4,0.295,30,0.008);
    { const stem=new THREE.CylinderGeometry(0.008,0.008,0.11,10); stem.translate(0,0.055,0); B.around(stem,'steel',14,(i,p,e)=>{ const a=i*TAU/14; p.set(1.22,0.36*Math.cos(a),0.36*Math.sin(a)); e.set(a,0,0); });
      const g1=B.glow(B.latheGeo([[1.25,0.31],[1.25,0.415],[1.54,0.4],[1.54,0.315],[1.25,0.31]],64),0xff5a14), g2=B.glow(B.latheGeo([[1.26,0.33],[1.26,0.395],[1.42,0.39],[1.42,0.335],[1.26,0.33]],64),0xffb050);
      B.tick.push((dt,run,st,t)=>{ const on=st.mode==='walk'?run.fire||0:0, fl=0.85+0.15*Math.sin(t*23)+0.08*Math.sin(t*37); g1.material.opacity=0.2*on*fl; g2.material.opacity=0.22*on*fl; }); }
    const DI=[[1.58,0.2],[1.72,0.19],[1.96,0.18]], DO=[[1.58,0.31],[1.72,0.3],[1.96,0.31]];
    B.part('ct',4,[0.72,0,0],{at:[1.66,0.33,0.15]});
    B.lathe(B.ringLoop([[1.6,0.33],[1.72,0.33]],H.sl(DO,1.6,1.72)),'case');
    H.row(B,1.62,DI,DO,{n:30,c0:0.04,s0:42,s1:44,m0:0.2,t0:0.16,k:'tbc'});
    { const R=B.rotor('b'); H.disc(B,1.67,0.04,0.07,0.18,'alu',R); H.row(B,1.67,DI,DO,{n:52,c0:0.04,s0:-32,s1:-38,m0:0.22,t0:0.14,k:'hot',rot:1},R); }
    B.part('pt',4,[0.95,0,0],{at:[1.84,0.34,0.15]});
    B.lathe(B.ringLoop([[1.72,0.335],[1.96,0.335]],H.sl(DO,1.72,1.96)),'case');
    [1.75,1.85].forEach(x=>H.row(B,x,DI,DO,{n:34,c0:0.042,s0:40,s1:42,m0:0.2,t0:0.13,k:'hot'}));
    { const R=B.rotor('a'); [1.8,1.9].forEach(x=>{ H.disc(B,x,0.04,0.04,0.17,'alu',R); H.row(B,x,DI,DO,{n:46,c0:0.042,s0:-32,s1:-40,m0:0.2,t0:0.12,k:'hot',rot:1},R); }); }
    B.part('dexh',4,[1.3,0,0],{at:[2.2,0.33,0.12]});
    B.wall([[1.96,0.33],[2.4,0.32]],0.016,'exh'); B.lathe([[1.96,0],[1.96,0.18],[2.15,0.13],[2.3,0.04],[2.32,0]],'exh');
    B.row({x:2.02,n:4,r0:0.17,r1:0.33,c0:0.07,s0:0,s1:0,t0:0.15,m0:0,k:'exh'});
    B.part('dsh',5,[0,-0.7,0],{at:[1.3,0.08,0.14]});
    { const A=B.rotor('a'); B.cyl(0.03,0.03,1.42,'steel',{pos:[1.19,0,0]},A); const R=B.rotor('b'); B.wall([[0.76,0.055],[1.67,0.055]],0.015,'steel',{},R); }
    B.part('dagb',5,[0,-0.55,0],{at:[0.95,-0.45,0.16]});
    B.box(0.36,0.1,0.26,'cast',{pos:[0.95,-0.42,0]}); [[0.82,0.05,0.12],[1.0,0.045,0.1],[1.1,0.04,0.1]].forEach(([x,r,l])=>B.mesh(new THREE.CylinderGeometry(r,r,l,20),'cast',{pos:[x,-0.47-l/2,0.03]}));
    B.mesh(new THREE.CylinderGeometry(0.014,0.014,0.27,10),'steel',{pos:[0.9,-0.235,0]});
  },
  streams:[
    {n:260,sp:1.0,p:[[0.02,-0.46,0,'in',0.05],[0.35,-0.42,0,'in',0.05],[0.58,-0.31,0,'in',0.045],[0.7,-0.18,0,'in',0.04]]},
    {axi:true,n:1150,sp:0.95,swirl:0.3,p:[[0.7,0.2,'in',0.08],[0.95,0.205,'comp',0.07],[1.0,0.24,'comp',0.06],[1.05,0.33,'comp',0.04],[1.1,0.43,'comp',0.03],[1.22,0.44,'comp',0.03],[1.27,0.36,'burn',0.09,0.55],[1.53,0.355,'burn',0.08,0.55],[1.6,0.26,'itt',0.08],[1.72,0.25,'itt',0.09],[1.96,0.25,'exh',0.1],[2.4,0.24,'exh',0.12],[3.2,0.28,'exh',0.2]]}
  ],
  marks:[[0.45,-0.42,0.1,1,t2('Inlet','Innløp')],[0.92,0.2,0.2,2,t2('Compressor','Kompressor')],[1.4,0.25,0.25,3,t2('Combustor','Brennkammer')],[1.8,0.18,0.18,4,t2('Turbines','Turbiner')],[2.25,0.2,0.2,4,t2('Exhaust','Eksos')],[0.35,0.55,0.25,5,t2('Gearbox','Gir')]],
  tour:[
    {st:1,mk:0,p:['dinl'],cam:[0.45,-0.25,0.1,60,4,2.0],trace:[0,0,3],t:t2('Inlet under the nose','Innløp under nesen'),
      d:t2('Air enters below the spinner and an S-shaped duct brings it up to the front of the compressor. From here it goes straight through, front to back.','Luften kommer inn under spinneren, og en S-formet kanal fører den opp til fronten av kompressoren. Herfra går den rett gjennom, fra front til bak.'),
      v:(M)=>[[t2('Air in','Luft inn'),C(M,'in')]]},
    {st:2,mk:1,p:['tax','imp','ddiff'],cam:[0.95,0.22,0.2,82,26,1.3],trace:[1,0,6],t:t2('Compressor and diffuser','Kompressor og diffusor'),
      d:t2('Axial stages, then a centrifugal impeller, squeeze the air; the diffuser pipes slow it and lead it rearward to the combustor.','Aksialtrinn og så en sentrifugalimpeller klemmer luften; diffusorrørene bremser den og leder den bakover til brennkammeret.'),
      v:(M)=>[[t2('Leaves the compressor','Ut av kompressoren'),C(M,'comp')],['Ng',pct(M.ng)]]},
    {st:3,mk:2,p:['dcomb'],cam:[1.4,0.3,0.28,84,28,1.25],trace:[1,5,8],t:t2('Straight-through combustor','Rett gjennomstrømmende brennkammer'),
      d:t2('Fuel burns in an annular liner while the gas keeps going the same way: it never turns back.','Drivstoffet brenner i et ringformet flammerør mens gassen fortsetter samme vei: den snur aldri.'),
      v:(M)=>[[t2('Fuel flow','Drivstoffstrøm'),nf(M.ffkg,0)+' kg/h'],['ITT',nf(M.itt,0)+' °C']]},
    {st:4,mk:3,p:['ct','pt'],cam:[1.8,0.22,0.2,86,24,1.1],trace:[1,7,10],t:t2('Two turbines, two shafts','To turbiner, to aksler'),
      d:t2('The compressor turbine (Ng) drives the compressor. Behind it the free power turbine (Np) takes out the rest and drives the propeller; its shaft runs forward <b>through</b> the hollow Ng shaft.','Kompressorturbinen (Ng) driver kompressoren. Bak den henter den frie kraftturbinen (Np) ut resten og driver propellen; akselen går forover <b>gjennom</b> den hule Ng-akselen.'),
      v:(M)=>tpVals(M)},
    {st:4,mk:4,p:['dexh'],cam:[2.2,0.15,0.2,104,20,1.6],trace:[1,9,12],t:t2('Exhaust at the back','Eksos bak'),
      d:t2('The gas leaves through the jet pipe at the rear, with little energy left.','Gassen går ut gjennom jetrøret bak, med lite energi igjen.'),
      v:(M)=>[[t2('Exhaust','Eksos'),C(M,'exh')]]},
    {st:5,mk:5,p:['rgb','dsh','prop'],cam:[0.35,0.3,0.2,52,24,2.0],t:t2('Offset gearbox and propeller','Forskjøvet gir og propell'),
      d:t2('The Np shaft drives a small pinion that turns a large gear above it: the propeller sits higher than the engine and turns far slower than the turbine. The propeller makes the thrust.','Np-akselen driver et lite tannhjul som dreier et stort tannhjul over seg: propellen sitter høyere enn motoren og går langt saktere enn turbinen. Propellen lager skyvet.'),
      v:(M)=>[[t2('Torque','Moment'),nf(M.tq,0)+' %'],['Np',nf(M.np,0)+' rpm']]}
  ]
};

/* =========================================================================
   PISTON – flat four, air cooled, carburettor, two magnetos (180 hp class)
   cylinder 1 front right (+z), 2 front left, 3 rear right, 4 rear left; firing order 1-3-2-4
   ========================================================================= */
const RC=0.11, LR=0.38, CR=0.085, FACE=0.605;
const CYL=[{n:1,x:0.4,d:1,a:0,off:0},{n:2,x:0.53,d:-1,a:Math.PI,off:360},{n:3,x:0.8,d:1,a:Math.PI,off:180},{n:4,x:0.93,d:-1,a:0,off:540}];
const SK=[[0,t2('Power','Arbeid'),3],[180,t2('Exhaust','Eksos'),4],[360,t2('Intake','Innsug'),1],[540,t2('Compression','Kompresjon'),2]];
const strokeOf=c=>SK[Math.floor(((c%720)+720)%720/180)];
const lift=(c,o,cl)=>{ c=((c%720)+720)%720; if(o>cl){ if(c<o&&c>cl) return 0; const span=720-o+cl, u=(c>=o?c-o:c+720-o)/span; return Math.sin(Math.PI*u); } return c>o&&c<cl?Math.sin(Math.PI*(c-o)/(cl-o)):0; };
const CYC={th:0,c:[0,0,0,0]};
function sidePart(B,id,st,ex,dz,at,nc){ const g=B.part(id,st,ex,{at,noclip:!!nc}), gP=new B.THREE.Group(), gM=new B.THREE.Group(); g.add(gP); g.add(gM); const p=B.parts[id];
  p.exf=e=>{ gP.position.z=dz*e; gM.position.z=-dz*e; }; p.aoff=new B.THREE.Vector3(); p.exa=e=>p.aoff.set(0,0,dz*e); return [gP,gM]; }
E3M.pist={
  title:t2('four-cylinder piston engine','firesylindret stempelmotor'),
  intro:t2('A flat-four, air-cooled aircraft engine with the top half cut away through the cylinders. Each cylinder sucks, squeezes, burns and blows in turn (the label on each cylinder shows which). Press <b>Start the walk-through</b> to follow the mixture through cylinder 1; slow motion helps.',
    'En firesylindret, luftkjølt flymotor med boksermotor-oppsett, der den øvre halvdelen er skåret bort gjennom sylindrene. Hver sylinder suger, klemmer, brenner og blåser etter tur (merket på hver sylinder viser hvilket). Trykk <b>Start gjennomgangen</b> for å følge blandingen gjennom sylinder 1; sakte film hjelper.'),
  order:['carb','iv','head','plug','mag','cyl','pist','ev','exh','rod','crank','cam','hub'],
  v:(M)=>[[t2('Power','Effekt'),nf(M.hp,0)+' hp'],['MAP',nf(M.map,1)+' inHg'],['RPM',nf(M.rpm,0)],['EGT',nf(M.egt,0)+' °C'],['CHT',nf(M.cht,0)+' °C'],[t2('Fuel flow','Drivstoffstrøm'),nf(M.ffl,0)+' L/h']],
  home:[0.1,-0.05,0,38,46], fit:0.72, camK:1.9, apAz:40, apEl:40, cut:'top', cutY:0, psize:0.014, dimTour:true,
  build(B){ const {THREE}=B;
    /* crankcase, sump, starter and alternator: the body (not a listed part) */
    B.part('case',0,[0,0,0],{at:[0.7,0.3,0]}); B.parts.case.nopick=true;
    B.lathe(B.ringLoop([[0.22,0.295],[1.12,0.295]],[[0.22,0.27],[1.12,0.27]]),'cast');
    B.lathe([[0.2,0.065],[0.2,0.3],[0.235,0.3],[0.235,0.065],[0.2,0.065]],'cast'); B.lathe([[1.1,0.065],[1.1,0.3],[1.135,0.3],[1.135,0.065],[1.1,0.065]],'cast');
    B.wall([[0.04,0.1],[0.12,0.13],[0.21,0.2]],0.025,'cast');
    { const pad=B.latheGeo(B.wallLoop([[0.25,0.165],[0.31,0.165]],0.03),48); CYL.forEach(c=>B.mesh(pad,'cast',{pos:[c.x,0,0],rot:[0,c.d>0?-Math.PI/2:Math.PI/2,0]})); }
    B.box(0.62,0.1,0.36,'cast',{pos:[0.68,-0.33,0]});
    B.cyl(0.06,0.06,0.2,'black',{pos:[0.14,-0.2,-0.22]}); B.cyl(0.07,0.07,0.16,'alu',{pos:[0.13,-0.2,0.23]});
    B.cyl(0.04,0.04,0.12,'blue',{pos:[1.2,-0.15,0]});
    /* crankshaft: four throws, pins of 1 and 4 opposite those of 2 and 3 */
    B.part('crank',5,[0,-0.62,0],{at:[0.66,-0.05,0.12],noclip:true});
    const CK=new THREE.Group(); B.add(CK);
    [[0.0,0.36],[0.442,0.488],[0.572,0.758],[0.842,0.888],[0.972,1.13]].forEach(([a,b])=>B.cyl(0.05,0.05,b-a,'steel',{pos:[(a+b)/2,0,0]},CK));
    CYL.forEach(c=>{ const zP=c.a?-RC:RC, sg=Math.sign(zP);
      B.cyl(0.046,0.046,0.06,'steel',{pos:[c.x,0,zP]},CK);
      [-1,1].forEach(s=>{ B.box(0.024,0.11,RC+0.1,'steel',{pos:[c.x+s*0.042,0,zP/2]},CK); B.box(0.024,0.19,0.075,'steel',{pos:[c.x+s*0.042,0,-sg*0.075]},CK); }); });
    /* connecting rods (positioned every frame) */
    B.part('rod',5,[0,-0.32,0],{at:[0.53,0.05,-0.3],noclip:true});
    const RODS=CYL.map(c=>{ const g=new THREE.Group(); B.add(g); B.box(0.026,0.036,LR-0.08,'steel',{},g); B.cyl(0.062,0.062,0.05,'steel',{pos:[0,0,-LR/2],cap:true},g); B.cyl(0.033,0.033,0.04,'steel',{pos:[0,0,LR/2]},g); return g; });
    /* pistons with rings and gudgeon pins; the charge inside the cylinder as a glow */
    const [pP,pM]=sidePart(B,'pist',2,[0,0,0],0.3,[0.4,0.1,0.48],1);
    const pg=B.latheGeo([[-0.065,0.108],[-0.065,0.124],[CR,0.124],[CR+0.004,0.11],[CR+0.006,0],[0.062,0],[0.062,0.108],[-0.065,0.108]],48);
    const PIS=CYL.map(c=>{ const g=new THREE.Group(); g.position.x=c.x; g.rotation.y=c.d>0?-Math.PI/2:Math.PI/2; (c.d>0?pP:pM).add(g);
      const m=B.mesh(pg,'alu',{},g); [0.05,0.064,0.076].forEach(x=>B.lathe(B.ringLoop([[x-0.003,0.1248],[x+0.003,0.1248]],[[x-0.003,0.118],[x+0.003,0.118]]),'dark',{segs:48},m));
      const pin=new THREE.CylinderGeometry(0.028,0.028,0.2,16); pin.rotateX(Math.PI/2); B.mesh(pin,'steel',{},m);
      const gl=B.glow(new THREE.CylinderGeometry(0.125,0.125,1,40,1,true).rotateZ(-Math.PI/2),0x7fcbe8,g,{normal:true}); const cap=B.glow(new THREE.CircleGeometry(0.125,40).rotateY(Math.PI/2),0x7fcbe8,g,{normal:true});
      return {g,m,gl,cap}; });
    /* cylinders (barrels with cooling fins) */
    const [cP,cM]=sidePart(B,'cyl',2,[0,0,0],0.55,[0.4,0.2,0.46]);
    const barrel=B.latheGeo(B.ringLoop([[0.3,0.146],[0.62,0.146]],[[0.3,0.13],[0.62,0.13]]),48);
    const fin=B.latheGeo(B.ringLoop([[-0.0035,0.196],[0.0035,0.196]],[[-0.0035,0.146],[0.0035,0.146]]),48);
    CYL.forEach(c=>{ const par=c.d>0?cP:cM, ry=c.d>0?-Math.PI/2:Math.PI/2; B.mesh(barrel,'iron',{pos:[c.x,0,0],rot:[0,ry,0]},par);
      B.around(fin,'iron',12,(i,p,e)=>{ p.set(c.x,0,c.d*(0.335+i*0.024)); e.set(0,ry,0); },par); });
    /* heads: combustion chamber, fins, rocker box */
    const [hP,hM]=sidePart(B,'head',3,[0,0,0],0.85,[0.4,0.18,0.74]);
    const head=B.latheGeo([[0.64,0],[0.635,0.06],[0.62,0.11],[FACE,0.13],[0.6,0.13],[0.6,0.168],[0.83,0.168],[0.848,0.14],[0.852,0]],48);
    const hfin=B.latheGeo(B.ringLoop([[-0.004,0.215],[0.004,0.215]],[[-0.004,0.166],[0.004,0.166]]),48);
    CYL.forEach(c=>{ const par=c.d>0?hP:hM, ry=c.d>0?-Math.PI/2:Math.PI/2; B.mesh(head,'cast',{pos:[c.x,0,0],rot:[0,ry,0]},par);
      B.around(hfin,'cast',7,(i,p,e)=>{ p.set(c.x,0,c.d*(0.655+i*0.026)); e.set(0,ry,0); },par);
      B.box(0.22,0.17,0.05,'cast',{pos:[c.x,0,c.d*0.875]},par); });
    /* valves (intake forward, exhaust aft of the cylinder axis) */
    const vg=B.latheGeo([[0,0],[0,0.042],[0.006,0.042],[0.02,0.012],[0.27,0.008],[0.27,0]],32);
    const mkV=(id,st,dx,ex,at)=>{ const [vP,vM]=sidePart(B,id,st,ex,1.0,at,1); return CYL.map(c=>{ const g=new THREE.Group(); g.position.set(c.x+dx,0,0); g.rotation.y=c.d>0?-Math.PI/2:Math.PI/2; (c.d>0?vP:vM).add(g); const m=B.mesh(vg,id==='iv'?'steel':'hot',{},g); return m; }); };
    const IV=mkV('iv',1,-0.05,[0,0.12,0],[0.35,0.0,0.62]), EV=mkV('ev',4,0.05,[0,-0.12,0],[0.45,0.0,0.62]);
    /* spark plugs: two per cylinder, a spark at the bottom one */
    const [sP,sM]=sidePart(B,'plug',3,[0,-0.22,0],0.9,[0.4,-0.22,0.72]);
    const bd=new THREE.CylinderGeometry(0.016,0.016,0.06,14), ins=new THREE.CylinderGeometry(0.011,0.013,0.05,12);
    const SPK=CYL.map(c=>{ const par=c.d>0?sP:sM; [-1,1].forEach(s=>{ B.mesh(bd,'steel',{pos:[c.x,s*0.2,c.d*0.72]},par); B.mesh(ins,'white',{pos:[c.x,s*0.25,c.d*0.72]},par); });
      const sp=B.sprite(0xbfe0ff,0.12,par); sp.position.set(c.x,-0.05,c.d*0.6); return sp; });
    /* magnetos and leads */
    B.part('mag',3,[0.5,0.35,0],{at:[1.26,0.17,0.13],noclip:true});
    [1,-1].forEach(s=>{ B.cyl(0.055,0.055,0.15,'black',{pos:[1.25,0.11,s*0.13]}); B.cyl(0.035,0.035,0.04,'brass',{pos:[1.345,0.11,s*0.13]}); });
    { const L=new THREE.Group(); B.add(L); CYL.forEach(c=>[1,-1].forEach(m=>{ if(m!==c.d) return; B.tube([[1.33,0.08,m*0.13],[1.3,-0.2,m*0.2],[c.x+0.12,-0.3,c.d*0.42],[c.x,-0.27,c.d*0.72]],0.006,'steel',{seg:24,rs:6},L); }));
      B.tick.push((dt,run,st)=>{ L.visible=!(st.mode==='apart'&&st.e>0.03); }); }
    /* intake: air box and carburettor under the engine, plenum, four runners */
    B.part('carb',1,[0,-0.5,0],{at:[0.62,-0.5,0.12],noclip:true});
    B.box(0.2,0.1,0.24,'cast',{pos:[0.42,-0.56,0]}); B.box(0.12,0.14,0.13,'alu',{pos:[0.66,-0.52,0]}); B.box(0.1,0.07,0.11,'alu',{pos:[0.66,-0.62,0.04]});
    B.tube([[0.2,-0.56,0],[0.32,-0.56,0]],0.045,'case',{ds:true}); B.tube([[0.52,-0.57,0],[0.6,-0.6,0],[0.66,-0.52,0],[0.66,-0.39,0]],0.032,'alu',{ds:true});
    CYL.forEach(c=>B.tube([[0.66,-0.36,0],[c.x-0.06,-0.33,c.d*0.25],[c.x-0.06,-0.28,c.d*0.42],[c.x-0.06,-0.22,c.d*0.6],[c.x-0.05,-0.12,c.d*0.68],[c.x-0.05,-0.05,c.d*0.64]],0.022,'alu'));
    /* exhaust: one pipe per cylinder into a collector on each side */
    B.part('exh',4,[0.45,-0.45,0],{at:[1.25,-0.48,0.33],noclip:true});
    CYL.forEach(c=>B.tube([[c.x+0.05,-0.05,c.d*0.64],[c.x+0.05,-0.14,c.d*0.7],[c.x+0.06,-0.32,c.d*0.62],[c.x+0.12,-0.44,c.d*0.42]],0.022,'exh'));
    [1,-1].forEach(d=>B.tube([[0.45,-0.44,d*0.42],[1.05,-0.46,d*0.37],[1.42,-0.5,d*0.29]],0.034,'exh'));
    /* camshaft (half crank speed), lobes and pushrod tubes */
    B.part('cam',1,[0,-0.95,0],{at:[0.66,-0.15,0.1],noclip:true});
    const CM=new THREE.Group(); CM.position.y=-0.17; B.add(CM); B.cyl(0.022,0.022,0.78,'steel',{pos:[0.67,0,0]},CM);
    CYL.forEach(c=>[[-0.05,0],[0.05,1]].forEach(([dx,k])=>B.box(0.02,0.07,0.045,'steel',{pos:[c.x+dx,0.012,0],rot:[(c.off/2+(k?90:-90))*Math.PI/180,0,0]},CM)));
    CYL.forEach(c=>[-0.05,0.05].forEach(dx=>B.mesh(new THREE.CylinderGeometry(0.011,0.011,0.56,10).rotateX(Math.PI/2),'alu',{pos:[c.x+dx,-0.15,c.d*0.58]})));
    /* propeller hub, flange, starter ring gear, spinner and two blades (never cut) */
    B.part('hub',5,[-0.75,0,0],{at:[-0.05,0.25,0.2],noclip:true});
    const PR=new THREE.Group(); B.add(PR);
    B.lathe([[-0.42,0],[-0.36,0.07],[-0.24,0.14],[-0.1,0.18],[0.0,0.19],[0.02,0.19],[0.02,0]],'white',{},PR);
    B.lathe([[0.02,0.05],[0.02,0.13],[0.045,0.13],[0.045,0.05],[0.02,0.05]],'steel',{},PR);
    B.gear(0.25,90,0.022,'steel',{pos:[0.06,0,0]},PR);
    B.row({x:-0.06,n:2,r0:0.12,r1:1.05,c0:0.13,c1:0.09,s0:28,s1:70,t0:0.16,t1:0.06,m0:0.05,nc:12,ns:10,k:'black',col:0x2a2f34,tip:0xf2c230,tipAt:0.94},PR);
    /* animation: crank angle, pistons, rods, valves, glow, sparks, gates for the flow */
    const cPink=new THREE.Color(0x7fcbe8), cYel=new THREE.Color(0xe8d46a), cHot=new THREE.Color(0xffb040), cGrey=new THREE.Color(0x9a8676), tmp=new THREE.Color();
    function pose(th){ CYC.th=th; CK.rotation.x=-th*Math.PI/180; PR.rotation.x=CK.rotation.x; CM.rotation.x=-th*Math.PI/360;
      CYL.forEach((c,i)=>{ const cyc=th-c.off, rel=((cyc%360)+360)%360*Math.PI/180, s=RC*Math.cos(rel)+Math.sqrt(LR*LR-RC*RC*Math.sin(rel)*Math.sin(rel));
        CYC.c[i]=((cyc%720)+720)%720; const P=PIS[i]; P.m.position.x=s;
        const crown=s+CR, len=Math.max(0.005,FACE-crown); P.gl.scale.set(len,1,1); P.gl.position.x=crown+len/2; P.cap.position.x=crown+0.001;
        const al=(th*Math.PI/180)+c.a, py=RC*Math.sin(al), pz=RC*Math.cos(al), qz=c.d*s, R=RODS[i];
        R.position.set(c.x,py/2,(pz+qz)/2); R.rotation.x=Math.atan2(py,qz-pz); });
    }
    pose(0);
    const G={};
    B.tick.push((dt,run,st,t)=>{ const w=st.mode==='walk';
      if(dt>0) pose(CYC.th+dt*(run.a||0)*360);
      CYL.forEach((c,i)=>{ const cy=CYC.c[i], li=lift(cy,340,580), le=lift(cy,140,380); IV[i].position.x=FACE+0.008-0.045*li; EV[i].position.x=FACE+0.008-0.045*le;
        G['i'+c.n]=li; G['e'+c.n]=le;
        const P=PIS[i]; let col,op;
        if(cy<180){ const k=cy/180; col=tmp.copy(cHot).lerp(cGrey,k*0.8); op=w?0.62*(1-k*0.55)*(run.fire>0?1:0.2):0; }
        else if(cy<360){ col=tmp.copy(cGrey); op=w?0.28*(1-(cy-180)/180):0; }
        else if(cy<540){ col=tmp.copy(cPink); op=w?0.32*((cy-360)/180):0; }
        else { const k=(cy-540)/180; col=tmp.copy(cPink).lerp(cYel,k); op=w?0.32+0.2*k:0; }
        P.gl.material.color.copy(col); P.gl.material.opacity=op; P.cap.material.color.copy(col); P.cap.material.opacity=op*0.9;
        const sp=SPK[i], a=((cy-695)+720)%720; sp.material.opacity=w&&run.fire>0&&a<22?1-a/22:0; });
      run.gates=Object.assign(run.gates||{},G); void t; });
  },
  streams:[
    ...CYL.map(c=>({n:140,sp:0.55,gate:'i'+c.n,size:1.2,p:[[0.12,-0.56,0,'in',0.03],[0.42,-0.56,0,'in',0.04],[0.6,-0.6,0,'in',0.02],[0.66,-0.5,0,'in',0.012],[0.66,-0.37,0,'in',0.02],[c.x-0.06,-0.33,c.d*0.25,'in',0.016],[c.x-0.06,-0.28,c.d*0.42,'in',0.014],[c.x-0.06,-0.22,c.d*0.6,'in',0.012],[c.x-0.05,-0.12,c.d*0.68,'in',0.012],[c.x-0.05,-0.045,c.d*0.63,'in',0.01],[c.x-0.02,0,c.d*0.56,'comp',0.07]]})),
    ...CYL.map(c=>({n:110,sp:0.6,gate:'e'+c.n,size:1.2,p:[[c.x+0.02,0,c.d*0.56,'burn',0.05],[c.x+0.05,-0.045,c.d*0.63,'exh',0.01],[c.x+0.05,-0.14,c.d*0.7,'exh',0.012],[c.x+0.06,-0.32,c.d*0.62,'exh',0.014],[c.x+0.12,-0.44,c.d*0.42,'exh',0.014],[1.05,-0.46,c.d*0.37,'exh',0.02],[1.42,-0.5,c.d*0.29,'exh',0.02],[1.62,-0.53,c.d*0.29,'exh',0.05]]}))
  ],
  marks:[],
  live:CYL.map((c,i)=>[c.x,0.02,c.d*0.93,2,()=>{ const s=strokeOf(CYC.c[i]); return {en:c.n+' · '+s[1].en,no:c.n+' · '+s[1].no,c:s[2]}; }]),
  tour:[
    {st:1,p:['carb'],cam:[0.55,-0.5,0.1,52,6,1.7],trace:[0,0,5],slow:true,t:t2('Air in, fuel in: the carburettor','Luft inn, drivstoff inn: forgasseren'),
      d:t2('Air comes in through the filter under the engine and is sucked up through the carburettor. In its narrow venturi the air speeds up and its pressure falls, and that draws fuel from the jet: the carburettor meters fuel in proportion to the air. The throttle is a butterfly valve after it; it sets how much mixture the engine may suck (the manifold pressure, MAP).',
        'Luften kommer inn gjennom filteret under motoren og suges opp gjennom forgasseren. I den trange venturien øker farten og trykket faller, og det trekker drivstoff fra dysen: forgasseren doserer drivstoff i forhold til luften. Gassen er et spjeld etter den; det bestemmer hvor mye blanding motoren får suge (innsugstrykket, MAP).'),
      x:t2('The fuel evaporating and the pressure drop cool the air by up to about 30 °C, so ice can form in the venturi on a mild, humid day. Carburettor heat melts it.','Drivstoff som fordamper og trykkfallet kjøler luften med opptil rundt 30 °C, så is kan dannes i venturien en mild, fuktig dag. Forgasservarme smelter den.'),
      v:(M)=>[['MAP',nf(M.map,1)+' inHg'],[t2('Fuel flow','Drivstoffstrøm'),nf(M.ffl,0)+' L/h']]},
    {st:1,p:['iv','pist','carb'],cam:[0.4,0.0,0.45,62,62,1.25],trace:[0,5,10],slow:true,t:t2('1 Intake stroke','1 Innsugstakt'),
      d:t2('The intake valve opens and the piston moves inward, away from the head. The growing space sucks the fuel–air mixture in through the intake pipe. Watch the label on cylinder 1: <b>Intake</b>.','Innsugsventilen åpner, og stempelet beveger seg innover, bort fra toppen. Rommet som vokser, suger blandingen inn gjennom innsugsrøret. Se merket på sylinder 1: <b>Innsug</b>.'),
      v:(M)=>[['MAP',nf(M.map,1)+' inHg'],['RPM',nf(M.rpm,0)]]},
    {st:2,p:['pist','cyl','head'],cam:[0.4,0.0,0.45,62,62,1.25],slow:true,t:t2('2 Compression stroke','2 Kompresjonstakt'),
      d:t2('Both valves are shut and the piston moves back out towards the head, squeezing the charge to about an eighth of its volume (compression ratio about 8.5 : 1). The squeezed mixture gets hot and burns much more powerfully.','Begge ventilene er lukket, og stempelet går ut mot toppen igjen og klemmer ladningen til rundt en åttendedel av volumet (kompresjonsforhold rundt 8,5 : 1). Den sammenklemte blandingen blir varm og brenner mye kraftigere.'),
      v:(M)=>[[t2('Charge after compression','Ladning etter kompresjon'),C(M,'comp')]]},
    {st:3,p:['plug','mag'],cam:[0.55,-0.05,0.4,40,50,1.7],slow:true,t:t2('Ignition: two plugs, two magnetos','Tenning: to plugger, to magneter'),
      d:t2('About 25° before the piston reaches the top, both spark plugs fire. Each is fed by its own magneto: an engine-driven generator that makes the high voltage itself, so the ignition needs no battery and has a full backup. Two flames burn the charge faster and more completely.','Rundt 25° før stempelet når toppen, tenner begge tennpluggene. Hver forsynes av sin egen magnet: en motordrevet generator som lager høyspenningen selv, så tenningen trenger ikke batteri og har full reserve. To flammer brenner ladningen raskere og mer fullstendig.'),
      x:t2('That is what the magneto check before take-off tests: one magneto off, a small RPM drop. A large drop or rough running means a plug or magneto problem.','Det er det magnetsjekken før avgang tester: én magnet av, et lite RPM-fall. Stort fall eller ujevn gange betyr feil på plugg eller magnet.'),
      v:(M)=>[['RPM',nf(M.rpm,0)]]},
    {st:3,p:['pist','rod','crank'],cam:[0.45,0.0,0.3,62,64,1.35],slow:true,t:t2('3 Power stroke','3 Arbeidstakt'),
      d:t2('The burning gas reaches its highest pressure just after the top and drives the piston inward. The connecting rod turns that push into torque on the crankshaft. This is the only stroke that makes power; the other three are paid for by it (and by the other cylinders).','Den brennende gassen når høyeste trykk rett etter toppen og driver stempelet innover. Veivstangen gjør dyttet om til dreiemoment på veivakselen. Dette er det eneste taktet som lager kraft; de tre andre betales av det (og av de andre sylindrene).'),
      v:(M)=>[[t2('Power','Effekt'),nf(M.hp,0)+' hp'],[t2('Burning gas','Brennende gass'),C(M,'burn')]]},
    {st:4,p:['ev','exh'],cam:[0.5,-0.15,0.5,64,30,1.6],trace:[4,0,7],slow:true,t:t2('4 Exhaust stroke','4 Eksostakt'),
      d:t2('Near the bottom the exhaust valve opens and the piston moves out again, pushing the burnt gas through the exhaust pipe and out. Just before the top the intake valve starts to open while the exhaust valve is still closing (valve overlap): the outgoing gas helps pull the new charge in.','Nær bunnen åpner eksosventilen, og stempelet går ut igjen og presser den brente gassen gjennom eksosrøret og ut. Like før toppen begynner innsugsventilen å åpne mens eksosventilen fortsatt lukker (ventiloverlapp): gassen som går ut, hjelper med å trekke den nye ladningen inn.'),
      v:(M)=>[['EGT',nf(M.egt,0)+' °C'],['CHT',nf(M.cht,0)+' °C']]},
    {st:5,p:['crank','rod'],cam:[0.66,0.0,0.0,40,68,1.9],slow:false,t:t2('Crankshaft and firing order','Veivaksel og tennrekkefølge'),
      d:t2('The four cylinders fire in the order 1-3-2-4, one every half turn, so the crankshaft gets two power pulses per revolution. Opposed cylinders balance each other. Each cylinder needs two full turns of the crankshaft for its four strokes.','De fire sylindrene tenner i rekkefølgen 1-3-2-4, én hver halve omdreining, så veivakselen får to kraftpulser per omdreining. Motstående sylindre balanserer hverandre. Hver sylinder trenger to hele omdreininger av veivakselen for sine fire takter.'),
      v:(M)=>[['RPM',nf(M.rpm,0)],[t2('Power','Effekt'),nf(M.hp,0)+' hp']]},
    {st:1,p:['cam','iv','ev'],cam:[0.66,-0.1,0.25,50,40,1.7],slow:true,t:t2('Camshaft and valve timing','Kamaksel og ventiltiming'),
      d:t2('The camshaft turns at half crankshaft speed. Its lobes push the lifters and pushrods, and rockers in each head open the valves at exactly the right moment of the cycle; springs close them.','Kamakselen går med halvt veivakselturtall. Knastene skyver ventilløftere og støtstenger, og vippearmer i hver topp åpner ventilene på nøyaktig riktig tidspunkt i syklusen; fjærer lukker dem.'),
      v:(M)=>[['RPM',nf(M.rpm,0)]]},
    {st:5,p:['hub'],cam:[0.0,0.0,0.0,30,16,3.1],slow:false,t:t2('Propeller','Propell'),
      d:t2('The propeller is bolted straight to the crankshaft flange: no gearbox, so it turns at engine RPM. That is why light aircraft engines turn slowly (about 2 700 rpm at most): the blade tips must stay below the speed of sound.','Propellen er boltet rett på flensen til veivakselen: uten gir, så den går med motorens turtall. Derfor går små flymotorer sakte (rundt 2 700 o/min på det meste): bladtuppene må holde seg under lydhastigheten.'),
      v:(M)=>[['RPM',nf(M.rpm,0)],[t2('Power','Effekt'),nf(M.hp,0)+' hp']]}
  ]
};
})();
