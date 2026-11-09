/* Birdbird – engparts.js: "Take it apart" for the Engines lab (engines.html).
   An exploded technical illustration of each generic engine type, drawn on the lab's 2D canvas.
   Every part carries the lab's numbered stage (1 intake, 2 compression, 3 combustion, 4 exhaust, 5 drive) and its colour.
   Geometry is in engine units (gas turbines: nacelle/casing radius ≈ 1; piston: bore ≈ 0.8), scaled to fit at draw time.
   API: ENGP.parts(type) → parts; ENGP.draw(g,W,H,o) draws and remembers the layout; ENGP.hit(x,y) → part id. */
(function(){
'use strict';
const t2=(en,no)=>({en,no});
const SC=['#9fb0bd','#7EC8F2','#6FD3C0','#F5B85C','#F2A08C','#C9B6F2'];
const SN=[t2('',''),t2('Intake','Innsug'),t2('Compression','Kompresjon'),t2('Combustion','Forbrenning'),t2('Exhaust','Eksos'),t2('Drive','Drivverk')];
const SANS='"Public Sans", system-ui, sans-serif', MONO='"IBM Plex Mono", ui-monospace, monospace';
const rgba=(h,a)=>{ const n=parseInt(h.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };
const at=(pts,x,i)=>{ i=i||1; for(let j=0;j<pts.length-1;j++){ const a=pts[j],b=pts[j+1]; if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])){ const f=(x-a[0])/((b[0]-a[0])||1); return a[i]+(b[i]-a[i])*f; } } return x<pts[0][0]?pts[0][i]:pts[pts.length-1][i]; };

/* ---------- materials ---------- */
const CAV='#0b1116', LINE='rgba(6,10,14,.6)';
function lin(g,x0,y0,x1,y1,st){ const gr=g.createLinearGradient(x0,y0,x1,y1); st.forEach(([o,c])=>gr.addColorStop(o,c)); return gr; }
const extG=(g,k,r)=>lin(g,0,0,0,r*k,[[0,'#6f7c88'],[0.3,'#5a6671'],[0.75,'#36404a'],[1,'#222a31']]);          // outside of a body, lower half
const fullG=(g,y0,y1)=>lin(g,0,y0,0,y1,[[0,'#232b33'],[0.28,'#8d99a4'],[0.42,'#a9b4bd'],[0.62,'#5f6b76'],[1,'#1e252c']]); // a round body seen side-on
const sideG=(g,x0,x1)=>lin(g,x0,0,x1,0,[[0,'#232b33'],[0.28,'#8d99a4'],[0.42,'#a9b4bd'],[0.62,'#5f6b76'],[1,'#1e252c']]);
const cutG=(g,k,r)=>lin(g,0,-r*k,0,0,[[0,'#8f9ca7'],[1,'#74818c']]);
function hatch(g,x0,y0,x1,y1){ g.save(); g.clip(); g.strokeStyle='rgba(18,24,30,.30)'; g.lineWidth=0.7; g.beginPath(); const h=y1-y0; for(let d=x0-h;d<x1;d+=4.5){ g.moveTo(d,y1); g.lineTo(d+h,y0); } g.stroke(); g.restore(); }
function ol(g,c){ g.strokeStyle=rgba(c,0.8); g.lineWidth=0.9; g.stroke(); }
function tint(g,c,a){ g.fillStyle=rgba(c,a); g.fill(); }
function halfPath(g,k,pts,s){ g.beginPath(); pts.forEach((p,i)=>{ const X=p[0]*k,Y=s*p[1]*k; i?g.lineTo(X,Y):g.moveTo(X,Y); }); for(let i=pts.length-1;i>=0;i--) g.lineTo(pts[i][0]*k,s*pts[i][2]*k); g.closePath(); }
function blade(g,k,x,ch,r0,r1,s,t){ const X=x*k,c=ch*k,a=r0*k*s,b=r1*k*s,sw=t==='s'?-c*0.04:c*0.12;
  g.beginPath(); g.moveTo(X-c/2,a); g.lineTo(X+c/2,a); g.lineTo(X+c*0.4+sw,b); g.lineTo(X-c*0.4+sw,b); g.closePath();
  g.fillStyle=t==='s'?lin(g,X-c/2,0,X+c/2,0,[[0,'#56636e'],[0.45,'#9aa7b1'],[1,'#5d6a75']]):lin(g,X-c/2,0,X+c/2,0,[[0,'#7f8c97'],[0.42,'#e2e9ee'],[1,'#8e9ba6']]);
  g.fill(); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke(); }
function rod(g,k,x0,x1,y,r,col){ const Y0=(y-r)*k,Y1=(y+r)*k; g.fillStyle=fullG(g,Y0,Y1); g.fillRect(x0*k,Y0,(x1-x0)*k,Y1-Y0); g.fillStyle=rgba(col||'#C9B6F2',0.12); g.fillRect(x0*k,Y0,(x1-x0)*k,Y1-Y0); g.strokeStyle=rgba(col||'#C9B6F2',0.8); g.lineWidth=0.9; g.strokeRect(x0*k,Y0,(x1-x0)*k,Y1-Y0);
  for(const xe of [x0,x1]) for(let i=1;i<4;i++){ const X=(xe+(xe===x0?1:-1)*i*0.025)*k; g.beginPath(); g.moveTo(X,Y0); g.lineTo(X,Y1); g.strokeStyle='rgba(10,14,18,.45)'; g.stroke(); } }
function breakLine(g,x,y,w,vert){ g.strokeStyle='rgba(214,226,236,.55)'; g.lineWidth=0.9; g.beginPath(); const n=4; for(let i=0;i<=n;i++){ const f=-w/2+w*i/n, o=(i%2?3:-3); vert?(i?g.lineTo(x+f,y+o):g.moveTo(x+f,y+o)):(i?g.lineTo(x+o,y+f):g.moveTo(x+o,y+f)); } g.stroke(); }

/* ---------- a gas-turbine module: casing (cut away in the upper half), drum, blade rows ---------- */
/* o.c [[x,rOut,rIn]…] casing; o.h [[x,r]…] hub; o.rows [[x,chord,'r'|'s']]; o.open = no dark gas path (rings); o.both = rotor visible both halves */
function mod(o){ const xs=o.c.map(p=>p[0]); o.rm=Math.max(...o.c.map(p=>p[1])); o.bb=o.bb||[Math.min(...xs),-o.rm,Math.max(...xs),o.rm]; o.draw=(g,k,c)=>drawMod(g,k,o,c); return o; }
function drawMod(g,k,o,col){ const C=o.c, H=o.h, x0=C[0][0], x1=C[C.length-1][0];
  if(o.pre) o.pre(g,k,col);
  /* lower half: the outside of the module */
  halfPath(g,k,C.map(p=>[p[0],p[1],0]),1); g.fillStyle=extG(g,k,o.rm); g.fill(); tint(g,col,0.10);
  for(const xe of [x0,x1]){ g.strokeStyle='rgba(225,233,240,.22)'; g.lineWidth=0.8; g.beginPath(); g.moveTo(xe*k+(xe===x0?1.5:-1.5),2); g.lineTo(xe*k+(xe===x0?1.5:-1.5),at(C,xe)*k-2); g.stroke(); }
  if(o.ext) o.ext(g,k,col);
  /* upper half: cut open */
  if(H&&!o.open){ g.beginPath(); C.forEach((p,i)=>i?g.lineTo(p[0]*k,-p[2]*k):g.moveTo(p[0]*k,-p[2]*k)); for(let i=H.length-1;i>=0;i--) g.lineTo(H[i][0]*k,-H[i][1]*k); g.closePath(); g.fillStyle=CAV; g.fill(); tint(g,col,0.07); }
  if(H){ /* drum with discs under each rotor row */
    (o.rows||[]).forEach(([x,ch,t])=>{ if(t!=='r') return; const r=at(H,x), X=x*k, w=ch*k*0.5; g.fillStyle=lin(g,X-w/2,0,X+w/2,0,[[0,'#3c4751'],[0.5,'#6b7783'],[1,'#3c4751']]); g.fillRect(X-w/2,-r*k,w,(r-(o.bore||0.13))*k); g.strokeStyle=LINE; g.lineWidth=0.6; g.strokeRect(X-w/2,-r*k,w,(r-(o.bore||0.13))*k); });
    g.beginPath(); H.forEach((p,i)=>i?g.lineTo(p[0]*k,-p[1]*k):g.moveTo(p[0]*k,-p[1]*k)); for(let i=H.length-1;i>=0;i--) g.lineTo(H[i][0]*k,-(H[i][1]-0.04)*k); g.closePath(); g.fillStyle='#5b6773'; g.fill(); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke(); }
  (o.rows||[]).forEach(([x,ch,t,ra,rb])=>{ const r0=ra??(H?at(H,x):0.05), r1=rb??at(C,x,2); blade(g,k,x,ch,r0,r1,-1,t); if(o.both) blade(g,k,x,ch,r0,r1,1,t); });
  if(o.fx) o.fx(g,k,col);
  /* the cut face of the casing wall */
  halfPath(g,k,C,-1); g.fillStyle=cutG(g,k,o.rm); g.fill(); hatch(g,x0*k-4,-o.rm*k-4,x1*k+4,0); halfPath(g,k,C,-1); tint(g,col,0.13); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke();
  if(o.post) o.post(g,k,col);
  /* outline */
  g.beginPath(); C.forEach((p,i)=>i?g.lineTo(p[0]*k,-p[1]*k):g.moveTo(p[0]*k,-p[1]*k)); for(let i=C.length-1;i>=0;i--) g.lineTo(C[i][0]*k,C[i][1]*k); g.closePath(); }

/* combustor liner in the upper half, with fuel nozzle(s) through the casing */
function liner(g,k,x0,x1,ra,rb,dome,noz){ const X0=x0*k,X1=x1*k,A=-rb*k,B=-ra*k, r=(rb-ra)*k/2;
  g.beginPath(); if(dome<0){ g.moveTo(X1,A); g.lineTo(X0+r,A); g.arc(X0+r,(A+B)/2,r,-Math.PI/2,Math.PI/2,true); g.lineTo(X1,B); }
  else { g.moveTo(X0,A); g.lineTo(X1-r,A); g.arc(X1-r,(A+B)/2,r,-Math.PI/2,Math.PI/2); g.lineTo(X0,B); }
  const fl=dome<0?lin(g,X0,0,X1,0,[[0,'rgba(255,236,190,.85)'],[0.35,'rgba(245,184,92,.65)'],[1,'rgba(242,160,140,.35)']]):lin(g,X1,0,X0,0,[[0,'rgba(255,236,190,.85)'],[0.35,'rgba(245,184,92,.65)'],[1,'rgba(242,160,140,.35)']]);
  g.fillStyle=fl; g.fill(); g.strokeStyle='#c3cdd5'; g.lineWidth=1.6; g.stroke();
  g.fillStyle=CAV; for(let i=1;i<5;i++){ const X=X0+(X1-X0)*(dome<0?0.25+i*0.15:0.75-i*0.15); for(const Y of [A,B]){ g.beginPath(); g.arc(X,Y,1.3,0,7); g.fill(); } }
  noz.forEach(([nx,ny,tx,ty])=>{ g.strokeStyle='#dfe6eb'; g.lineWidth=2.2; g.beginPath(); g.moveTo(nx*k,-ny*k); g.lineTo(tx*k,-ny*k); g.lineTo(tx*k,-ty*k); g.stroke(); g.fillStyle='#F5B85C'; g.beginPath(); g.arc(tx*k,-ty*k,2.4,0,7); g.fill(); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke(); }); }

/* ---------- parts text ---------- */
const P=(id,st,n,d,f,x,s)=>({id,st,n,d,f,x,s});
const TX={
 /* gas turbines (shared) */
 inlet:P('inlet',1,t2('Air inlet','Luftinntak'),t2('Brings the air smoothly to the face of the fan or compressor, slowing it a little so its pressure rises.','Fører luften jevnt inn til fanen eller kompressoren, og bremser den litt så trykket stiger.'),t2('The lip is thick and rounded so the air stays attached even when the aircraft is slow and the engine pulls hard.','Leppen er tykk og avrundet, så luften holder seg langs veggen selv når flyet går sakte og motoren drar hardt.'),t2('In cruise the inlet slows the air from about Mach 0.8 to about Mach 0.5 at the fan face. That ram pressure is free compression.','I marsj bremser innløpet luften fra rundt Mach 0,8 til rundt Mach 0,5 foran fanen. Det dynamiske trykket er gratis kompresjon.')),
 fan:P('fan',5,t2('Fan and spinner','Fan og spinner'),t2('A big ducted propeller driven by the LP turbine. Most of its air goes around the core and makes most of the thrust.','En stor propell i kanal, drevet av LP-turbinen. Det meste av luften går utenom kjernen og lager det meste av skyvet.'),t2('In a high-bypass engine the fan makes roughly 80 % of the take-off thrust.','I en motor med høyt omløpsforhold lager fanen rundt 80 % av startskyvet.'),t2('Bypass ratio: about 5 to 12 kg of air goes around the core for every kilogram through it. The fan tips run supersonic at take-off: the buzz-saw sound.','Omløpsforhold: rundt 5 til 12 kg luft går utenom kjernen for hver kilo gjennom den. Fantuppene går overlyd ved avgang: den sagende lyden.'),t2('Fan','Fan')),
 duct:P('duct',5,t2('Fan case and bypass duct','Fanhus og omløpskanal'),t2('Holds the fan and guides the cold bypass air past the core. Outlet guide vanes take out the swirl so the air leaves straight back.','Holder fanen og leder den kalde omløpsluften forbi kjernen. Utløpsledeskovler fjerner virvelen så luften går rett bakover.'),t2('The fan case must hold a released fan blade inside the engine: every new type proves it in a blade-off test.','Fanhuset må holde et løsrevet fanblad inne i motoren: hver ny type viser det i en bladavkastningstest.'),t2('The thrust reverser sits in this duct: blocker doors or a sliding sleeve turn the fan air forward.','Reversen sitter i denne kanalen: sperrepaneler eller en glidende hylse snur fanluften forover.'),t2('Fan case · bypass duct','Fanhus · omløpskanal')),
 lpc:P('lpc',2,t2('LP compressor (booster)','LP-kompressor (booster)'),t2('A few stages on the fan shaft that give the core air its first squeeze.','Noen få trinn på fanakselen som gir kjerneluften det første klemmet.'),t2('It turns with the fan at N1, which is slow, so each stage adds only a little pressure.','Den går med fanen på N1, som er sakte, så hvert trinn gir bare litt trykk.'),t2('Bleed valves behind it open at low power and in fast throttle changes to dump air and keep the core compressor away from stall and surge.','Avtappingsventiler bak den åpner ved lav kraft og raske gassendringer for å slippe ut luft og holde kjernekompressoren unna stall og surge.'),t2('LP compressor','LP-kompressor')),
 hpc:P('hpc',2,t2('HP compressor','HP-kompressor'),t2('Rows of spinning blades and fixed vanes on the fast N2 spool that squeeze the core air many times over.','Rader med roterende blad og faste skovler på den raske N2-spolen som klemmer kjerneluften mange ganger.'),t2('Each rotor row speeds the air up, each stator row turns that speed into pressure. Overall pressure ratio in a modern turbofan: about 30–50 : 1.','Hver rotorrad øker farten, hver statorrad gjør farten om til trykk. Totalt trykkforhold i en moderne turbofan: rundt 30–50 : 1.'),t2('Variable stator vanes at the front change angle with N2, so each blade meets the air at a good angle at every speed.','Variable statorskovler foran endrer vinkel med N2, så hvert blad møter luften med god vinkel ved alle turtall.')),
 comp:P('comp',2,t2('Axial compressor','Aksialkompressor'),t2('Rows of spinning blades and fixed vanes that squeeze the air step by step before it is burnt.','Rader med roterende blad og faste skovler som klemmer luften trinn for trinn før den brennes.'),t2('Each stage adds only a little (about 1.2–1.4 : 1), so a turbojet needs many stages: here eight.','Hvert trinn gir bare litt (rundt 1,2–1,4 : 1), så en turbojet trenger mange trinn: her åtte.'),t2('If the flow breaks down over the blades (compressor stall) the pressure can reverse: a bang, flame from the inlet and a rising EGT.','Bryter strømningen sammen over bladene (kompressorstall), kan trykket snu: et smell, flamme ut av innløpet og stigende EGT.'),t2('Compressor','Kompressor')),
 diff:P('diff',2,t2('Diffuser','Diffusor'),t2('A widening passage after the compressor. It slows the air down so its pressure rises, and so the flame is not blown out.','En kanal som utvider seg etter kompressoren. Den bremser luften så trykket stiger, og så flammen ikke blåses ut.'),t2('The air leaves the compressor far too fast to burn in; the diffuser trades that speed for pressure.','Luften forlater kompressoren altfor fort til å brenne i; diffusoren bytter farten mot trykk.'),t2('The pressure is highest here (P3). The engine control measures it, and bleed air for the cabin comes from the compressor stages just ahead.','Trykket er høyest her (P3). Motorstyringen måler det, og avtappingsluft til kabinen hentes fra kompressortrinnene like foran.')),
 comb:P('comb',3,t2('Combustion chamber with fuel nozzles','Brennkammer med drivstoffdyser'),t2('Fuel is sprayed in through the nozzles and burns continuously inside a liner. Only about a quarter of the air takes part; the rest cools the liner and mixes in.','Drivstoff sprøytes inn gjennom dysene og brenner hele tiden inne i et flammerør. Bare rundt en firedel av luften er med; resten kjøler røret og blandes inn.'),t2('The flame is around 2 000 °C, far hotter than the metal can stand: a film of cooling air through small holes protects the liner.','Flammen er rundt 2 000 °C, langt varmere enn metallet tåler: en film av kjøleluft gjennom små hull beskytter flammerøret.'),t2('The igniters are only needed to start it (and as continuous ignition in heavy rain, icing or turbulence). Once lit, the flame keeps itself going.','Tennpluggene trengs bare for å tenne den (og som kontinuerlig tenning i kraftig regn, ising eller turbulens). Når den først brenner, holder flammen seg selv.'),t2('Combustion chamber','Brennkammer')),
 hpt:P('hpt',4,t2('HP turbine (NGV + rotor)','HP-turbin (ledeskovler + rotor)'),t2('The nozzle guide vanes (NGV) speed up the hot gas and aim it at the rotor blades. The rotor takes out the work that drives the HP compressor.','Ledeskovlene (NGV) øker farten på den varme gassen og retter den mot rotorbladene. Rotoren henter ut arbeidet som driver HP-kompressoren.'),t2('It meets the hottest gas, hotter than the blade metal\'s melting point: the blades are single crystals cooled from the inside by compressor air.','Den møter den varmeste gassen, varmere enn smeltepunktet til bladmetallet: bladene er enkrystaller som kjøles innenfra med kompressorluft.'),t2('You watch EGT, measured further back, as a stand-in for this temperature. Every overtemperature eats blade life (creep).','Du følger EGT, målt lenger bak, som et mål på denne temperaturen. Hver overtemperatur spiser av bladlevetiden (kryp).'),t2('HP turbine','HP-turbin')),
 lpt:P('lpt',4,t2('LP turbine','LP-turbin'),t2('Several larger stages that take most of the energy left in the gas and drive the fan through the inner N1 shaft.','Flere større trinn som tar det meste av energien som er igjen i gassen og driver fanen gjennom den indre N1-akselen.'),t2('Driving the fan takes so much power that the LP turbine needs about three to seven stages.','Det krever så mye kraft å drive fanen at LP-turbinen trenger rundt tre til sju trinn.'),t2('A geared fan puts a reduction gearbox between this turbine and the fan, so the turbine can spin faster with fewer stages.','En giret fan har et reduksjonsgir mellom denne turbinen og fanen, så turbinen kan gå fortere med færre trinn.')),
 noz:P('noz',4,t2('Exhaust nozzle and tail cone','Eksosdyse og halekjegle'),t2('Speeds up the core gas as it leaves; the tail cone lets the flow close smoothly behind the turbine.','Øker farten på kjernegassen når den forlater motoren; halekjeglen lar strømmen lukke seg jevnt bak turbinen.'),t2('On a high-bypass engine the hot core jet gives only a small share of the thrust; the fan gives the rest.','På en motor med høyt omløpsforhold gir den varme kjernestrålen bare en liten del av skyvet; fanen gir resten.'),t2('Saw-tooth edges (chevrons) on some nozzles mix the hot and cold jets more gently, which cuts the noise.','Sagtakkete kanter (chevrons) på noen dyser blander den varme og kalde strålen mykere, og det gir mindre støy.'),t2('Exhaust nozzle','Eksosdyse')),
 sh2:P('sh2',5,t2('Shafts · N1 and N2','Aksler · N1 og N2'),t2('Two shafts, one inside the other. The inner N1 joins the fan, booster and LP turbine; the outer N2 joins the HP compressor and HP turbine.','To aksler, den ene inni den andre. Den indre N1 kobler fan, booster og LP-turbin; den ytre N2 kobler HP-kompressor og HP-turbin.'),t2('There is no gear between them: each spool finds its own speed, which is why you have both N1 and N2 gauges.','Det er ikke noe gir mellom dem: hver spole finner sitt eget turtall, og derfor har du både N1- og N2-måler.'),t2('The thrust lever really asks for an N1 (or EPR); the FADEC moves the fuel to get it.','Gasshendelen ber egentlig om en N1 (eller EPR); FADEC flytter drivstoffet for å få det.'),t2('Shafts · N1 / N2','Aksler · N1 / N2')),
 agb:P('agb',5,t2('Accessory gearbox','Tilbehørsgirkasse'),t2('Driven from the HP spool by a tower shaft. It turns the fuel pump, oil pumps, hydraulic pump and generator, and the starter drives the engine through it.','Drevet fra HP-spolen av en tårnaksel. Den driver drivstoffpumpen, oljepumpene, hydraulikkpumpen og generatoren, og starteren driver motoren gjennom den.'),t2('For a start, the starter turns this gearbox, which turns N2 up to light-off speed.','Ved start dreier starteren denne girkassen, som dreier N2 opp til tenningsturtall.'),t2('The hidden (dashed) tower shaft runs inside a strut from the core to the gearbox. On airliners the gearbox also drives an IDG for constant-frequency AC.','Den skjulte (stiplede) tårnakselen går inne i et stag fra kjernen til girkassen. På trafikkfly driver girkassen også en IDG for vekselstrøm med fast frekvens.'),t2('Accessory gearbox','Tilbehørsgirkasse')),
 /* turbojet specifics */
 jturb:P('jturb',4,t2('Turbine (NGV + rotor)','Turbin (ledeskovler + rotor)'),t2('The nozzle guide vanes aim the hot gas at the rotor blades; the rotor takes out just enough work to drive the compressor.','Ledeskovlene retter den varme gassen mot rotorbladene; rotoren henter ut akkurat nok arbeid til å drive kompressoren.'),t2('Everything the turbine does not take stays in the gas and leaves as the jet: that is the thrust.','Alt turbinen ikke tar, blir igjen i gassen og går ut som strålen: det er skyvet.'),t2('EGT is measured just behind it. On a turbojet the hot section is the life-limiting part: watch the start and take-off temperatures.','EGT måles like bak den. På en turbojet er den varme delen det som begrenser levetiden: følg temperaturen ved start og avgang.'),t2('Turbine','Turbin')),
 jpipe:P('jpipe',4,t2('Jet pipe','Jetrør'),t2('Carries the hot gas from the turbine to the nozzle and straightens it; the tail cone fills the hole behind the turbine disc.','Fører den varme gassen fra turbinen til dysen og retter den ut; halekjeglen fyller hullet bak turbinskiven.'),t2('On a military turbojet the afterburner sits here: extra fuel burnt in the jet pipe for more thrust.','På en militær turbojet sitter etterbrenneren her: ekstra drivstoff brennes i jetrøret for mer skyv.'),t2('The EGT thermocouples reach into the gas at the front of the jet pipe.','EGT-termoelementene stikker inn i gassen foran i jetrøret.')),
 jnoz:P('jnoz',4,t2('Propelling nozzle','Fremdriftsdyse'),t2('Narrows the exit so the gas leaves as a fast jet. The push of that jet is the thrust.','Snevrer inn utløpet så gassen går ut som en rask stråle. Skyvet fra strålen er skyvekraften.'),t2('Thrust ≈ mass flow × (jet speed − flight speed). A turbojet makes all of it in one fast, hot jet.','Skyv ≈ massestrøm × (strålefart − flyfart). En turbojet lager alt i én rask, varm stråle.'),t2('At high power the converging nozzle is choked: the gas leaves at the speed of sound, and the pressure still left adds pressure thrust.','Ved høy kraft er den konvergerende dysen struppet: gassen går ut med lydfart, og trykket som er igjen gir ekstra trykkskyv.'),t2('Nozzle','Dyse')),
 sh1:P('sh1',5,t2('Shaft','Aksel'),t2('Joins the turbine to the compressor, so the turbine drives the compressor at the same speed, N.','Kobler turbinen til kompressoren, så turbinen driver kompressoren med samme turtall, N.'),t2('One spool: one speed gauge, N in %.','Én spole: én turtallsmåler, N i %.'),t2('One spool must suit both compressor and turbine at all speeds, so it is slow to accelerate and prone to stall at low RPM. That is why two-spool engines came.','Én spole må passe både kompressor og turbin ved alle turtall, så den akselererer sakte og staller lett ved lavt turtall. Derfor kom tospolemotorene.')),
 /* turboprop */
 prop:P('prop',5,t2('Propeller','Propell'),t2('Accelerates a lot of air a little: this is the turboprop\'s thrust. The blade angle changes to hold the RPM you set (Np).','Akselererer mye luft litt: det er turbopropens skyv. Bladvinkelen endres for å holde turtallet du har satt (Np).'),t2('Feathered (edge-on, stopped) after an engine failure; beta and reverse only on the ground.','Fjæret (kanten mot vinden, stoppet) etter motorstans; beta og revers bare på bakken.'),t2('The propeller governor holds Np; an overspeed governor and an Np limiter back it up. Blades are drawn short here (break lines).','Propellgovernoren holder Np; en overturtallsgovernor og en Np-begrenser er backup. Bladene er tegnet korte her (bruddlinjer).')),
 rgb:P('rgb',5,t2('Reduction gearbox','Reduksjonsgir'),t2('Slows the power turbine\'s very high speed down to propeller speed: roughly 30 000 rpm in, 2 000 rpm out.','Senker kraftturbinens svært høye turtall ned til propellturtall: rundt 30 000 rpm inn, 2 000 rpm ut.'),t2('The torque gauge measures the twist in this gearbox. On a turboprop that is your power gauge, and its limit.','Momentmåleren måler vridningen i dette giret. På en turboprop er det effektmåleren din, og grensen.'),t2('Planet gears share the load in a small space; oil pressure on a torque-meter piston gives the torque reading.','Planetgir deler lasten på liten plass; oljetrykk på et momentmålerstempel gir momentavlesningen.')),
 texh:P('texh',4,t2('Exhaust duct and stacks','Eksoskanal og eksosrør'),t2('Collects the gas after the power turbine and turns it out sideways through two stacks just behind the propeller.','Samler gassen etter kraftturbinen og leder den ut til sidene gjennom to eksosrør like bak propellen.'),t2('Little energy is left: the power turbine has taken almost all of it for the propeller.','Lite energi er igjen: kraftturbinen har tatt nesten alt til propellen.'),t2('In a reverse-flow engine the gas travels forward, so the hot exhaust leaves near the front and the cool inlet sits at the back.','I en motor med motstrøm går gassen forover, så den varme eksosen kommer ut foran og det kalde innløpet sitter bak.'),t2('Exhaust','Eksos')),
 pt:P('pt',4,t2('Power turbine (Np)','Kraftturbin (Np)'),t2('A free turbine on its own shaft. It takes the energy from the gas and drives the propeller through the reduction gearbox.','En fri turbin på egen aksel. Den henter energien fra gassen og driver propellen gjennom reduksjonsgiret.'),t2('It has no mechanical link to the compressor, so the starter only has to turn the gas generator, not the propeller.','Den har ingen mekanisk kobling til kompressoren, så starteren trenger bare å dreie gassgeneratoren, ikke propellen.'),t2('The propeller lever sets Np through the governor; the power lever sets fuel and Ng, and with them the torque.','Propellhendelen setter Np gjennom governoren; krafthendelen setter drivstoff og Ng, og dermed momentet.'),t2('Power turbine','Kraftturbin')),
 ct:P('ct',4,t2('Compressor turbine (NGV + rotor, Ng)','Kompressorturbin (ledeskovler + rotor, Ng)'),t2('Guide vanes aim the hot gas at a single turbine rotor, which drives the compressor through the Ng shaft.','Ledeskovler retter den varme gassen mot én turbinrotor, som driver kompressoren gjennom Ng-akselen.'),t2('ITT is measured just behind it, between the two turbines: the turboprop\'s hot-section limit.','ITT måles like bak den, mellom de to turbinene: turbopropens temperaturgrense.'),t2('Compressor, combustor and this turbine together are the gas generator: a small jet engine whose only job is to make hot gas for the power turbine.','Kompressor, brennkammer og denne turbinen er sammen gassgeneratoren: en liten jetmotor som bare skal lage varm gass til kraftturbinen.'),t2('Compressor turbine','Kompressorturbin')),
 tcomb:P('tcomb',3,t2('Reverse-flow combustion chamber','Brennkammer med motstrøm'),t2('An annular liner wrapped around the turbines. Compressed air flows forward outside it and enters through rows of holes; the fuel burns while the gas flows rearward, and at the back the exit duct turns it 180° to flow forward into the turbines.','Et ringformet flammerør rundt turbinene. Komprimert luft strømmer forover utenfor det og går inn gjennom rader med hull; drivstoffet brenner mens gassen strømmer bakover, og bak snur utløpskanalen den 180° så den strømmer forover inn i turbinene.'),t2('Folding the flow back on itself makes the engine short, with the turbines inside the combustor\'s ring.','Når strømmen bretter seg tilbake, blir motoren kort, med turbinene inne i ringen av brennkammeret.'),t2('A partly blocked fuel nozzle gives a hot streak: one sector runs hot, which shows as uneven temperatures behind the turbine.','En delvis tett drivstoffdyse gir en varm stripe: én sektor går varm, og det viser seg som ujevn temperatur bak turbinen.'),t2('Combustion chamber','Brennkammer')),
 tdiff:P('tdiff',2,t2('Diffuser','Diffusor'),t2('Catches the air flung outward by the impeller, slows it so its pressure rises, and turns it forward around the combustor.','Fanger luften som slynges ut av impelleren, bremser den så trykket stiger, og snur den forover rundt brennkammeret.'),t2('The pressure is highest here (P3); the fuel control uses it.','Trykket er høyest her (P3); drivstoffstyringen bruker det.'),t2('Diffuser pipes or vanes must match the impeller: dirt and erosion here cost efficiency and show as a higher ITT for the same torque.','Diffusorrør eller skovler må passe impelleren: smuss og erosjon her koster virkningsgrad og viser seg som høyere ITT for samme moment.')),
 imp:P('imp',2,t2('Centrifugal compressor (impeller)','Sentrifugalkompressor (impeller)'),t2('A spinning wheel that flings the air outward at high speed. One stage gives as much squeeze as several axial stages.','Et roterende hjul som slynger luften utover med stor fart. Ett trinn klemmer like mye som flere aksialtrinn.'),t2('Sturdy and tolerant of dirt and small debris: ideal for small engines.','Robust og tåler smuss og små gjenstander: ideell for små motorer.'),t2('One centrifugal stage gives about 4–8 : 1; with the axial stages in front the whole compressor gives about 7–10 : 1.','Ett sentrifugaltrinn gir rundt 4–8 : 1; med aksialtrinnene foran gir hele kompressoren rundt 7–10 : 1.'),t2('Impeller','Impeller')),
 tax:P('tax',2,t2('Axial compressor stages','Aksialkompressortrinn'),t2('Three small axial stages in front of the impeller give the air its first squeeze.','Tre små aksialtrinn foran impelleren gir luften det første klemmet.'),t2('Same Ng shaft as the impeller: one gas-generator spool.','Samme Ng-aksel som impelleren: én gassgeneratorspole.'),t2('A bleed valve opens at low Ng so the compressor does not stall during the start and at low power.','En avtappingsventil åpner ved lav Ng så kompressoren ikke staller under start og ved lav kraft.'),t2('Axial stages','Aksialtrinn')),
 tinl:P('tinl',1,t2('Air inlet screen and plenum','Luftinntak med gitter og plenum'),t2('Air comes in at the back of the engine through a mesh screen, then turns to flow forward into the compressor.','Luften kommer inn bak på motoren gjennom et nettinggitter og snur så forover inn i kompressoren.'),t2('The screen stops larger debris; an inertial separator in the aircraft\'s intake throws out ice, water and sand.','Gitteret stopper større gjenstander; en treghetsseparator i flyets inntak kaster ut is, vann og sand.'),t2('Use the separator (bypass doors) in visible moisture near freezing: it costs a little torque but saves the engine from ice.','Bruk separatoren (bypass-lukene) i synlig fuktighet nær frysepunktet: den koster litt moment, men sparer motoren for is.'),t2('Inlet screen','Inntaksgitter')),
 tagb:P('tagb',5,t2('Accessory gearbox','Tilbehørsgirkasse'),t2('At the very back, driven by the Ng shaft. It turns the starter-generator, the fuel pump and fuel control unit, and the oil pump.','Helt bak, drevet av Ng-akselen. Den driver startgeneratoren, drivstoffpumpen og drivstoffstyringen, og oljepumpen.'),t2('The starter turns only the gas generator (Ng), not the propeller: a light load.','Starteren dreier bare gassgeneratoren (Ng), ikke propellen: en lett last.'),t2('The fuel control unit here meters fuel from the power lever, Ng and P3.','Drivstoffstyringen her doserer drivstoff ut fra krafthendelen, Ng og P3.')),
 tsh:P('tsh',5,t2('Shafts · Ng and Np','Aksler · Ng og Np'),t2('Two separate shafts end to end. Ng joins the compressor turbine to the compressor; Np joins the power turbine to the gearbox.','To separate aksler etter hverandre. Ng kobler kompressorturbinen til kompressoren; Np kobler kraftturbinen til giret.'),t2('The gap between them is the "free" in free turbine: only the gas connects them.','Mellomrommet mellom dem er det «frie» i fri turbin: bare gassen kobler dem.'),t2('So Ng and Np are two independent gauges: Ng tells you about the gas generator, Np about the propeller.','Derfor er Ng og Np to uavhengige målere: Ng forteller om gassgeneratoren, Np om propellen.'),t2('Shafts · Ng / Np','Aksler · Ng / Np')),
 /* turboprop, direct flow (the option) */
 dinl:P('dinl',1,t2('Air inlet (front)','Luftinntak (foran)'),t2('Air comes in at the front, just behind the propeller, and flows straight back into the compressor.','Luften kommer inn foran, like bak propellen, og strømmer rett bakover inn i kompressoren.'),t2('On many aircraft it is a scoop under the spinner; an inertial separator in the duct throws out ice, water and sand.','På mange fly er det et inntak under spinneren; en treghetsseparator i kanalen kaster ut is, vann og sand.'),t2('Use the separator in visible moisture near freezing: it costs a little torque but saves the engine from ice.','Bruk separatoren i synlig fuktighet nær frysepunktet: den koster litt moment, men sparer motoren for is.'),t2('Air inlet','Luftinntak')),
 ddiff:P('ddiff',2,t2('Diffuser','Diffusor'),t2('Catches the air flung outward by the impeller, slows it so its pressure rises, and feeds it straight back into the combustor.','Fanger luften som slynges ut av impelleren, bremser den så trykket stiger, og fører den rett bakover inn i brennkammeret.'),t2('The pressure is highest here (P3); the fuel control uses it.','Trykket er høyest her (P3); drivstoffstyringen bruker det.'),t2('Diffuser pipes or vanes must match the impeller: dirt and erosion here cost efficiency and show as a higher ITT for the same torque.','Diffusorrør eller skovler må passe impelleren: smuss og erosjon her koster virkningsgrad og viser seg som høyere ITT for samme moment.')),
 dcomb:P('dcomb',3,t2('Combustion chamber','Brennkammer'),t2('An annular liner where the air burns while it keeps flowing straight back. Fuel nozzles around its front end spray in the fuel.','Et ringformet flammerør der luften brenner mens den fortsetter rett bakover. Drivstoffdyser rundt den fremre enden sprøyter inn drivstoffet.'),t2('The gas never turns round: a simple path, but a longer engine than a reverse-flow one.','Gassen snur aldri: en enkel vei, men en lengre motor enn en med motstrøm.'),t2('A partly blocked fuel nozzle gives a hot streak: one sector runs hot, which shows as uneven temperatures behind the turbine.','En delvis tett drivstoffdyse gir en varm stripe: én sektor går varm, og det viser seg som ujevn temperatur bak turbinen.'),t2('Combustion chamber','Brennkammer')),
 dexh:P('dexh',4,t2('Exhaust duct (rear)','Eksoskanal (bak)'),t2('Collects the gas after the power turbine and lets it out at the back of the engine; on many installations it turns out of the side of the nacelle.','Samler gassen etter kraftturbinen og slipper den ut bak på motoren; på mange installasjoner går den ut av siden på motorgondolen.'),t2('Little energy is left: the power turbine has taken almost all of it for the propeller.','Lite energi er igjen: kraftturbinen har tatt nesten alt til propellen.'),t2('Intake at the front, exhaust at the back: in a reverse-flow engine it is the other way round.','Inntak foran, eksos bak: i en motor med motstrøm er det omvendt.'),t2('Exhaust','Eksos')),
 dagb:P('dagb',5,t2('Accessory gearbox','Tilbehørsgirkasse'),t2('Under the compressor, driven from the Ng shaft through a tower shaft. It turns the starter-generator, the fuel pump and fuel control unit, and the oil pump.','Under kompressoren, drevet fra Ng-akselen gjennom en tårnaksel. Den driver startgeneratoren, drivstoffpumpen og drivstoffstyringen, og oljepumpen.'),t2('The starter turns only the gas generator (Ng), not the propeller: a light load.','Starteren dreier bare gassgeneratoren (Ng), ikke propellen: en lett last.'),t2('The fuel control unit here meters fuel from the power lever, Ng and P3.','Drivstoffstyringen her doserer drivstoff ut fra krafthendelen, Ng og P3.')),
 dsh:P('dsh',5,t2('Shafts · Ng and Np (one inside the other)','Aksler · Ng og Np (den ene inni den andre)'),t2('Two separate shafts. Ng is a hollow tube joining the compressor turbine to the compressor; Np runs forward through it from the power turbine to the gearbox.','To separate aksler. Ng er et hult rør som kobler kompressorturbinen til kompressoren; Np går forover gjennom det fra kraftturbinen til giret.'),t2('The gap between the two turbines is the "free" in free turbine: only the gas connects them.','Mellomrommet mellom de to turbinene er det «frie» i fri turbin: bare gassen kobler dem.'),t2('So Ng and Np are two independent gauges: Ng tells you about the gas generator, Np about the propeller.','Derfor er Ng og Np to uavhengige målere: Ng forteller om gassgeneratoren, Np om propellen.'),t2('Shafts · Ng / Np','Aksler · Ng / Np')),
 /* piston */
 head:P('head',3,t2('Cylinder head','Sylindertopp'),t2('Closes the top of the cylinder and forms the combustion chamber. It holds the valves and the two spark plugs, and its fins shed the heat.','Lukker toppen av sylinderen og danner brennkammeret. Den holder ventilene og de to tennpluggene, og kjøleribbene leder bort varmen.'),t2('The hottest part of an air-cooled engine: the CHT gauge (cylinder head temperature) watches it.','Den varmeste delen av en luftkjølt motor: CHT-måleren (sylindertopptemperatur) følger med på den.'),t2('An aluminium head screwed and shrunk onto a steel barrel. Baffles force the cooling air over the fins; a faster climb speed and a richer mixture keep CHT down.','En topp av aluminium skrudd og krympet på et sylinderløp av stål. Ledeplater tvinger kjøleluften over ribbene; høyere stigefart og rikere blanding holder CHT nede.')),
 iv:P('iv',1,t2('Intake valve','Innsugsventil'),t2('Opens to let the fuel–air mixture into the cylinder in the intake stroke, then closes and seals.','Åpner for å slippe drivstoff–luft-blandingen inn i sylinderen i innsugstaktet, og lukker og tetter etterpå.'),t2('A spring closes it; the camshaft opens it through a pushrod and a rocker arm.','En fjær lukker den; kamakselen åpner den gjennom en støtstang og en vippearm.'),t2('Valve overlap: around top dead centre both valves are open for a moment, so the outgoing exhaust helps draw in the fresh charge.','Ventiloverlapp: rundt øvre dødpunkt er begge ventilene åpne et øyeblikk, så eksosen som går ut hjelper med å trekke inn ny ladning.')),
 ev:P('ev',4,t2('Exhaust valve','Eksosventil'),t2('Opens near the end of the power stroke to let the burnt gas out, and stays open through the exhaust stroke.','Åpner mot slutten av arbeidstaktet for å slippe ut den brente gassen, og står åpen gjennom eksostaktet.'),t2('It runs far hotter than the intake valve; many are hollow and part-filled with sodium to carry heat to the stem.','Den går mye varmere enn innsugsventilen; mange er hule og delvis fylt med natrium for å lede varmen til stammen.'),t2('A burnt or sticking exhaust valve gives a dead cylinder: low compression in a differential check and a cold EGT on that cylinder.','En brent eller fastkilt eksosventil gir en død sylinder: lav kompresjon i en differansetest og kald EGT på den sylinderen.')),
 plug:P('plug',3,t2('Spark plugs (two)','Tennplugger (to)'),t2('Make the spark that lights the squeezed mixture, just before the piston reaches the top.','Lager gnisten som tenner den sammenklemte blandingen, rett før stempelet når toppen.'),t2('Two plugs per cylinder, each fed by its own magneto: the mixture burns faster, and the engine keeps running if one system fails.','To plugger per sylinder, hver med sin egen magnet: blandingen brenner raskere, og motoren går videre hvis ett system svikter.'),t2('The mag check on the run-up tests this: on one magneto the RPM drops a little. No drop at all can mean a magneto that does not switch off (a broken P-lead).','Magnetsjekken under oppkjøringen tester dette: på én magnet faller RPM litt. Ingen fall i det hele tatt kan bety en magnet som ikke slås av (brudd i P-ledningen).'),t2('Spark plugs','Tennplugger')),
 cyl:P('cyl',2,t2('Cylinder','Sylinder'),t2('The steel tube the piston slides in. Here the mixture is squeezed, and the burning gas pushes the piston down.','Stålrøret stempelet glir i. Her klemmes blandingen, og den brennende gassen presser stempelet ned.'),t2('Aircraft engines have four to six, laid flat in opposed pairs: short, smooth and easy to cool.','Flymotorer har fire til seks, liggende flatt i motstående par: korte, jevne og lette å kjøle.'),t2('Compression ratio is typically 7–9 : 1. Higher gives more work from each drop of fuel but needs higher-octane fuel to avoid detonation.','Kompresjonsforholdet er typisk 7–9 : 1. Høyere gir mer arbeid per dråpe drivstoff, men krever høyere oktan for å unngå detonasjon.')),
 pist:P('pist',2,t2('Piston with rings','Stempel med stempelringer'),t2('Takes the push of the burning gas and passes it to the connecting rod. The rings seal the gap to the cylinder wall.','Tar imot trykket fra den brennende gassen og gir det videre til veivstangen. Ringene tetter mot sylinderveggen.'),t2('The top rings hold the compression; the bottom ring scrapes oil back down. Worn rings show as low compression and high oil use.','De øverste ringene holder kompresjonen; den nederste skraper oljen ned igjen. Slitte ringer gir lav kompresjon og høyt oljeforbruk.'),t2('Detonation and pre-ignition hit the crown first: a hammering pressure spike that can crack or hole the piston within minutes.','Detonasjon og selvtenning rammer toppen først: en hamrende trykktopp som kan sprekke eller brenne hull i stempelet på minutter.'),t2('Piston','Stempel')),
 rod:P('rod',5,t2('Connecting rod','Veivstang'),t2('Links the piston to the crankshaft and turns the piston\'s straight push into a turning force.','Kobler stempelet til veivakselen og gjør det rette trykket fra stempelet om til en dreiekraft.'),t2('Pushed and pulled thousands of times a minute, so it is forged steel with an I-section: strong but light.','Skyves og dras tusenvis av ganger i minuttet, så den er smidd stål med I-profil: sterk, men lett.'),t2('The big end turns on a plain bearing fed with oil under pressure: that is why low oil pressure is an emergency.','Storenden går på et glidelager som får olje under trykk: derfor er lavt oljetrykk en nødsituasjon.')),
 crank:P('crank',5,t2('Crankshaft','Veivaksel'),t2('Turns the up-and-down motion of all the pistons into rotation, and drives the propeller straight from its front flange.','Gjør opp-og-ned-bevegelsen til alle stemplene om til rotasjon, og driver propellen direkte fra flensen foran.'),t2('Two turns of the crankshaft make one full four-stroke cycle in every cylinder. Counterweights balance the throws.','To omdreininger av veivakselen gir én hel firetaktssyklus i hver sylinder. Motvekter balanserer veivene.'),t2('Direct drive: propeller RPM = engine RPM, so one tachometer reads both. The small gear at the back drives the camshaft.','Direkte drift: propellturtall = motorturtall, så én turteller viser begge. Det lille tannhjulet bak driver kamakselen.')),
 cam:P('cam',1,t2('Camshaft','Kamaksel'),t2('Opens and closes the valves at the right moment. The crankshaft drives it through gears at half its speed.','Åpner og lukker ventilene til rett tid. Veivakselen driver den gjennom tannhjul med halvt turtall.'),t2('Half speed because each valve opens once per cycle, and a cycle takes two turns: see the gear twice the size of the crank gear.','Halvt turtall fordi hver ventil åpner én gang per syklus, og en syklus tar to omdreininger: se tannhjulet som er dobbelt så stort som veivakselens.'),t2('Lobes lift the tappets; pushrods and rocker arms open the valves; the valve springs close them.','Kammene løfter ventilløfterne; støtstenger og vippearmer åpner ventilene; ventilfjærene lukker dem.')),
 mag:P('mag',3,t2('Magnetos (two)','Magneter (to)'),t2('Small engine-driven generators that make the high-voltage spark. They need no battery or alternator.','Små motordrevne generatorer som lager høyspenningsgnisten. De trenger verken batteri eller dynamo.'),t2('Two independent magnetos: the engine keeps running with the master switch off. The mag switch OFF grounds them.','To uavhengige magneter: motoren går videre med hovedbryteren av. Magnetbryteren på OFF jorder dem.'),t2('A live magneto (broken P-lead) can fire the engine if someone turns the propeller with the switch OFF: always treat a propeller as live.','En levende magnet (brudd i P-ledningen) kan tenne motoren hvis noen dreier propellen med bryteren på OFF: behandle alltid en propell som levende.'),t2('Magnetos','Magneter')),
 carb:P('carb',1,t2('Carburettor and intake pipe','Forgasser og innsugsrør'),t2('Meters fuel into the air in step with the throttle; the intake pipe carries the mixture to the cylinder.','Doserer drivstoff inn i luften i takt med gassen; innsugsrøret fører blandingen til sylinderen.'),t2('The venturi drops the pressure and temperature, so in humid air it can ice up even at +20 °C. Carburettor heat cures it.','Venturien senker trykket og temperaturen, så i fuktig luft kan den ise selv ved +20 °C. Forgasservarme løser det.'),t2('The mixture control trims the fuel for thinner air. A fuel-injected engine meters fuel at each intake port instead and suffers far less from induction icing.','Blandingskontrollen justerer drivstoffet for tynnere luft. En motor med innsprøytning doserer ved hver innsugsport i stedet og plages langt mindre av innsugsising.'),t2('Carburettor','Forgasser')),
 exh:P('exh',4,t2('Exhaust pipe','Eksosrør'),t2('Carries the hot burnt gas away from the cylinder and out of the cowling.','Fører den varme, brente gassen bort fra sylinderen og ut av motordekselet.'),t2('The EGT probe sits here, just downstream of the port: it is what you lean by.','EGT-sonden sitter her, like etter porten: den er det du lener etter.'),t2('A shroud round the muffler heats the cabin air, so a crack here can leak carbon monoxide into the cabin.','En kappe rundt lyddemperen varmer kabinluften, så en sprekk her kan lekke karbonmonoksid inn i kabinen.')),
 hub:P('hub',5,t2('Propeller hub','Propellnav'),t2('Bolts the propeller to the crankshaft flange. On a constant-speed propeller it also holds the mechanism that turns the blades.','Bolter propellen til veivakselflensen. På en konstantturtallspropell holder det også mekanismen som vrir bladene.'),t2('The governor sends oil to the hub to change the blade angle and hold the RPM you set.','Governoren sender olje til navet for å endre bladvinkelen og holde turtallet du har satt.'),t2('If oil pressure is lost, a single-engine propeller usually goes to fine pitch (high RPM); a twin\'s goes towards feather.','Mister den oljetrykket, går en enmotors propell vanligvis til liten stigning (høyt turtall); en tomotors går mot fjæring.'))
};

/* ---------- geometry per engine type ---------- */
function G_fan(){ const R=[];
  R.push({id:'sh2',ex:[0,1.35],low:1,bb:[0.55,-0.13,3.3,0.13],draw:(g,k,col)=>{ rod(g,k,0.55,3.3,0,0.045,col); rod(g,k,1.05,2.72,0,0.1,col);
    g.font=`600 ${Math.max(8,k*0.075)}px ${MONO}`; g.fillStyle='#E6ECF0'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('N1',0.75*k,-0.1*k); g.fillText('N2',1.9*k,-0.16*k); g.textAlign='left'; g.textBaseline='alphabetic';
    g.beginPath(); }});
  R.push(Object.assign(mod({c:[[3.25,0.46,0.43],[3.75,0.34,0.31]],h:[[3.25,0.2],[3.75,0.12]],open:0,
    fx:(g,k)=>{ g.beginPath(); g.moveTo(3.25*k,-0.2*k); g.quadraticCurveTo(3.6*k,-0.18*k,3.85*k,0); g.lineTo(3.25*k,0); g.closePath(); g.fillStyle=lin(g,0,-0.2*k,0,0,[[0,'#8d99a4'],[1,'#56626d']]); g.fill(); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke(); }}),{id:'noz',ex:[1.92,0]}));
  R.push(Object.assign(mod({c:[[2.72,0.4,0.36],[3.25,0.46,0.43]],h:[[2.72,0.22],[3.25,0.2]],rows:[[2.77,0.05,'s'],[2.84,0.05,'r'],[2.91,0.05,'s'],[2.98,0.05,'r'],[3.05,0.05,'s'],[3.12,0.05,'r'],[3.19,0.045,'r']]}),{id:'lpt',ex:[1.7,0]}));
  R.push(Object.assign(mod({c:[[2.55,0.42,0.37],[2.72,0.4,0.36]],h:[[2.55,0.22],[2.72,0.22]],rows:[[2.6,0.05,'s'],[2.67,0.055,'r']]}),{id:'hpt',ex:[1.48,0]}));
  R.push(Object.assign(mod({c:[[2.1,0.42,0.39],[2.55,0.42,0.39]],h:[[2.1,0.2],[2.55,0.22]],fx:(g,k)=>liner(g,k,2.14,2.52,0.25,0.36,-1,[[2.18,0.42,2.18,0.305]])}),{id:'comb',ex:[1.26,0]}));
  R.push(Object.assign(mod({c:[[1.95,0.36,0.31],[2.1,0.42,0.39]],h:[[1.95,0.27],[2.1,0.2]],rows:[[2.0,0.045,'s'],[2.05,0.04,'s']]}),{id:'diff',ex:[1.04,0]}));
  const hr=[]; for(let i=0;i<8;i++){ hr.push([1.09+i*0.108,0.045,'r']); hr.push([1.14+i*0.108,0.04,'s']); }
  R.push(Object.assign(mod({c:[[1.05,0.45,0.4],[1.95,0.36,0.31]],h:[[1.05,0.24],[1.95,0.27]],rows:hr}),{id:'hpc',ex:[0.82,0]}));
  R.push(Object.assign(mod({c:[[0.72,0.47,0.43],[1.05,0.45,0.4]],h:[[0.72,0.25],[1.05,0.24]],rows:[[0.78,0.045,'r'],[0.84,0.04,'s'],[0.9,0.045,'r'],[0.96,0.04,'s'],[1.01,0.04,'r']],
    pre:(g,k)=>{ /* splitter lip */ void g; void k; }}),{id:'lpc',ex:[0.6,0]}));
  /* fan: spinner and wide-chord blades, seen whole */
  R.push({id:'fan',ex:[-1.15,0],bb:[0.3,-0.87,0.78,0.87],draw:(g,k,col)=>{
    for(const s of [-1,1]){ g.beginPath(); g.moveTo(0.48*k,s*0.24*k); g.bezierCurveTo(0.5*k,s*0.5*k,0.47*k,s*0.75*k,0.5*k,s*0.86*k); g.lineTo(0.66*k,s*0.86*k); g.bezierCurveTo(0.68*k,s*0.6*k,0.7*k,s*0.4*k,0.68*k,s*0.24*k); g.closePath();
      g.fillStyle=lin(g,0.48*k,0,0.7*k,0,[[0,'#7f8c97'],[0.35,'#e4ebf0'],[0.7,'#a3afb9'],[1,'#6f7c87']]); g.fill(); tint(g,col,0.08); ol(g,col);
      g.strokeStyle='rgba(20,26,32,.35)'; g.beginPath(); g.moveTo(0.57*k,s*0.25*k); g.bezierCurveTo(0.6*k,s*0.5*k,0.57*k,s*0.7*k,0.585*k,s*0.85*k); g.stroke(); }
    g.beginPath(); g.moveTo(0.3*k,0); g.quadraticCurveTo(0.36*k,-0.24*k,0.62*k,-0.25*k); g.lineTo(0.72*k,-0.25*k); g.lineTo(0.72*k,0.25*k); g.lineTo(0.62*k,0.25*k); g.quadraticCurveTo(0.36*k,0.24*k,0.3*k,0); g.closePath();
    g.fillStyle=fullG(g,-0.25*k,0.25*k); g.fill(); tint(g,col,0.1); ol(g,col);
    g.beginPath(); }});
  R.push(Object.assign(mod({c:[[0,0.93,0.93],[0.04,0.99,0.87],[0.15,1.02,0.86],[0.55,1.0,0.88]],open:1}),{id:'inlet',ex:[-1.75,0]}));
  R.push(Object.assign(mod({c:[[0.55,1.0,0.89],[1.0,0.99,0.88],[1.65,0.92,0.83]],open:1,rows:[[1.0,0.07,'s',0.48,0.88],[1.08,0.03,'s',0.48,0.87]],
    fx:(g,k)=>{ g.strokeStyle='rgba(126,200,242,.35)'; g.lineWidth=0.8; g.setLineDash([5,4]); g.beginPath(); g.moveTo(1.2*k,-0.66*k); g.lineTo(1.55*k,-0.62*k); g.stroke(); g.setLineDash([]); g.beginPath(); g.moveTo(1.55*k,-0.62*k); g.lineTo(1.5*k,-0.645*k); g.lineTo(1.5*k,-0.595*k); g.closePath(); g.fillStyle='rgba(126,200,242,.5)'; g.fill(); }}),{id:'duct',ex:[-0.55,0]}));
  R.push({id:'agb',ex:[0,1.0],low:1,bb:[1.12,0.47,1.78,1.3],draw:(g,k,col)=>{ const x0=1.15*k,x1=1.75*k,y0=1.02*k,y1=1.2*k;
    g.setLineDash([4,3]); g.strokeStyle='rgba(214,226,236,.55)'; g.lineWidth=1; g.strokeRect(1.42*k,0.47*k,0.05*k,0.55*k); g.setLineDash([]);
    for(const [x,w,d] of [[1.2,0.1,0.08],[1.33,0.08,0.06],[1.55,0.13,0.1]]){ g.fillStyle=sideG(g,x*k,(x+w)*k); g.fillRect(x*k,y1,w*k,d*k); g.strokeStyle=LINE; g.lineWidth=0.6; g.strokeRect(x*k,y1,w*k,d*k); }
    rrp(g,x0,y0,x1-x0,y1-y0,4); g.fillStyle=lin(g,0,y0,0,y1,[[0,'#8a97a2'],[0.4,'#5e6a75'],[1,'#2a333b']]); g.fill(); tint(g,col,0.12); ol(g,col);
    g.beginPath(); }});
  return {parts:R,order:['sh2','noz','lpt','hpt','comb','diff','hpc','lpc','fan','inlet','duct','agb'],len:[-0.1,3.9],title:t2('High-bypass turbofan · two spools','Turbofan med høyt omløpsforhold · to spoler'),air:[0,1]}; }

function G_jet(){ const R=[];
  R.push({id:'sh1',ex:[0,1.0],low:1,bb:[0.5,-0.08,2.66,0.08],draw:(g,k,col)=>{ rod(g,k,0.5,2.66,0,0.065,col); g.font=`600 ${Math.max(8,k*0.075)}px ${MONO}`; g.fillStyle='#E6ECF0'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('N',1.55*k,-0.13*k); g.textAlign='left'; g.textBaseline='alphabetic'; g.beginPath(); }});
  R.push(Object.assign(mod({c:[[3.4,0.5,0.46],[3.75,0.42,0.38]],open:1}),{id:'jnoz',ex:[1.0,0]}));
  R.push(Object.assign(mod({c:[[2.7,0.54,0.5],[3.4,0.5,0.46]],h:[[2.7,0.22],[3.4,0.05]],fx:(g,k)=>{ g.beginPath(); g.moveTo(2.7*k,-0.22*k); g.quadraticCurveTo(2.9*k,-0.2*k,3.05*k,0); g.lineTo(2.7*k,0); g.closePath(); g.fillStyle=lin(g,0,-0.22*k,0,0,[[0,'#8d99a4'],[1,'#56626d']]); g.fill(); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke(); }}),{id:'jpipe',ex:[0.75,0]}));
  R.push(Object.assign(mod({c:[[2.45,0.56,0.52],[2.7,0.54,0.5]],h:[[2.45,0.22],[2.7,0.22]],rows:[[2.52,0.07,'s'],[2.62,0.075,'r']]}),{id:'jturb',ex:[0.5,0]}));
  R.push(Object.assign(mod({c:[[1.92,0.58,0.54],[2.45,0.58,0.54]],h:[[1.92,0.2],[2.45,0.22]],fx:(g,k)=>liner(g,k,1.96,2.42,0.26,0.48,-1,[[2.0,0.58,2.0,0.37]])}),{id:'comb',ex:[0.25,0]}));
  R.push(Object.assign(mod({c:[[1.75,0.5,0.44],[1.92,0.58,0.54]],h:[[1.75,0.3],[1.92,0.2]],rows:[[1.82,0.05,'s'],[1.87,0.04,'s']]}),{id:'diff',ex:[0,0]}));
  const r=[[0.5,0.04,'s']]; for(let i=0;i<8;i++){ r.push([0.57+i*0.145,0.06,'r']); r.push([0.64+i*0.145,0.05,'s']); }
  R.push(Object.assign(mod({c:[[0.45,0.62,0.56],[1.75,0.5,0.44]],h:[[0.45,0.16],[1.0,0.24],[1.75,0.3]],rows:r,
    pre:(g,k,col)=>{ g.beginPath(); g.moveTo(0.28*k,0); g.quadraticCurveTo(0.3*k,-0.15*k,0.46*k,-0.16*k); g.lineTo(0.46*k,0.16*k); g.quadraticCurveTo(0.3*k,0.15*k,0.28*k,0); g.closePath(); g.fillStyle=fullG(g,-0.16*k,0.16*k); g.fill(); tint(g,col,0.1); ol(g,col); }}),{id:'comp',ex:[-0.45,0],bb:[0.28,-0.62,1.75,0.62]}));
  R.push(Object.assign(mod({c:[[0,0.56,0.56],[0.04,0.61,0.53],[0.45,0.62,0.56]],open:1}),{id:'inlet',ex:[-0.95,0]}));
  R.push({id:'agb',ex:[0,0.55],low:1,bb:[0.8,0.5,1.32,0.92],draw:(g,k,col)=>{ const x0=0.82*k,x1=1.3*k,y0=0.66*k,y1=0.8*k;
    g.setLineDash([4,3]); g.strokeStyle='rgba(214,226,236,.55)'; g.lineWidth=1; g.strokeRect(1.02*k,0.3*k,0.04*k,0.36*k); g.setLineDash([]);
    for(const [x,w,d] of [[0.86,0.09,0.07],[0.99,0.07,0.05],[1.12,0.12,0.09]]){ g.fillStyle=sideG(g,x*k,(x+w)*k); g.fillRect(x*k,y1,w*k,d*k); g.strokeStyle=LINE; g.lineWidth=0.6; g.strokeRect(x*k,y1,w*k,d*k); }
    rrp(g,x0,y0,x1-x0,y1-y0,4); g.fillStyle=lin(g,0,y0,0,y1,[[0,'#8a97a2'],[0.4,'#5e6a75'],[1,'#2a333b']]); g.fill(); tint(g,col,0.12); ol(g,col);
    g.beginPath(); }});
  return {parts:R,order:['sh1','jnoz','jpipe','jturb','comb','diff','comp','inlet','agb'],len:[0,3.8],title:t2('Turbojet · one spool','Turbojet · én spole'),air:[0,1]}; }

function G_tp(){ const R=[];
  R.push({id:'tsh',ex:[0,1.0],low:1,bb:[0.55,-0.08,3.3,0.08],draw:(g,k,col)=>{ rod(g,k,0.55,1.52,0,0.05,col); rod(g,k,1.66,3.3,0,0.065,col);
    g.font=`600 ${Math.max(8,k*0.075)}px ${MONO}`; g.fillStyle='#E6ECF0'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('Np',1.0*k,-0.12*k); g.fillText('Ng',2.5*k,-0.14*k); g.textAlign='left'; g.textBaseline='alphabetic';
    g.beginPath(); }});
  R.push({id:'tagb',ex:[1.6,0],bb:[3.78,-0.42,4.32,0.42],draw:(g,k,col)=>{ for(const [y,h,w] of [[-0.36,0.2,0.14],[-0.1,0.12,0.1],[0.1,0.24,0.12]]){ g.fillStyle=fullG(g,y*k,(y+h)*k); g.fillRect(4.14*k,y*k,w*k,h*k); g.strokeStyle=LINE; g.lineWidth=0.6; g.strokeRect(4.14*k,y*k,w*k,h*k); }
    rrp(g,3.78*k,-0.4*k,0.36*k,0.8*k,5); g.fillStyle=fullG(g,-0.4*k,0.4*k); g.fill(); tint(g,col,0.12); ol(g,col); g.beginPath(); }});
  R.push(Object.assign(mod({c:[[3.35,0.55,0.5],[3.78,0.55,0.5]],h:[[3.35,0.17],[3.78,0.17]],open:0,
    post:(g,k)=>{ /* mesh screen replaces part of the wall, both halves */ for(const s of [-1,1]){ const x0=3.43*k,x1=3.7*k,y0=s*0.5*k,y1=s*0.555*k; g.fillStyle=CAV; g.fillRect(x0,Math.min(y0,y1)-1,x1-x0,Math.abs(y1-y0)+2); g.strokeStyle='rgba(214,226,236,.6)'; g.lineWidth=0.6; g.beginPath(); for(let x=x0;x<=x1;x+=3){ g.moveTo(x,y0); g.lineTo(x,y1); } g.moveTo(x0,(y0+y1)/2); g.lineTo(x1,(y0+y1)/2); g.stroke(); }
      g.strokeStyle='rgba(126,200,242,.55)'; g.lineWidth=0.9; g.beginPath(); g.moveTo(3.56*k,-0.75*k); g.lineTo(3.56*k,-0.42*k); g.quadraticCurveTo(3.56*k,-0.3*k,3.4*k,-0.28*k); g.stroke(); g.beginPath(); g.moveTo(3.4*k,-0.28*k); g.lineTo(3.44*k,-0.305*k); g.lineTo(3.44*k,-0.255*k); g.closePath(); g.fillStyle='rgba(126,200,242,.7)'; g.fill(); }}),{id:'tinl',ex:[1.35,0]}));
  R.push(Object.assign(mod({c:[[2.88,0.33,0.29],[3.35,0.33,0.29]],h:[[2.88,0.15],[3.35,0.17]],bore:0.09,rows:[[3.28,0.04,'s'],[3.22,0.05,'r'],[3.14,0.04,'s'],[3.08,0.05,'r'],[3.0,0.04,'s'],[2.94,0.05,'r']]}),{id:'tax',ex:[1.1,0]}));
  R.push(Object.assign(mod({c:[[2.6,0.6,0.46],[2.68,0.52,0.42],[2.78,0.38,0.31],[2.88,0.33,0.29]],h:[[2.6,0.43],[2.66,0.3],[2.76,0.19],[2.88,0.15]],bore:0.09,
    fx:(g,k)=>{ g.beginPath(); g.moveTo(2.6*k,-0.43*k); g.quadraticCurveTo(2.64*k,-0.22*k,2.88*k,-0.15*k); g.lineTo(2.88*k,-0.29*k); g.quadraticCurveTo(2.66*k,-0.32*k,2.62*k,-0.455*k); g.closePath(); g.fillStyle=lin(g,2.6*k,0,2.88*k,0,[[0,'#cdd6dd'],[1,'#8592a0']]); g.fill(); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke();
      g.fillStyle=lin(g,0,-0.43*k,0,-0.1*k,[[0,'#6b7783'],[1,'#3c4751']]); g.beginPath(); g.moveTo(2.6*k,-0.43*k); g.quadraticCurveTo(2.64*k,-0.22*k,2.88*k,-0.15*k); g.lineTo(2.88*k,-0.09*k); g.lineTo(2.6*k,-0.09*k); g.closePath(); g.fill(); g.stroke(); }}),{id:'imp',ex:[0.9,0]}));
  R.push(Object.assign(mod({c:[[2.45,0.62,0.58],[2.6,0.62,0.6]],h:[[2.45,0.46],[2.6,0.46]],rows:[[2.525,0.07,'s',0.47,0.58]]}),{id:'tdiff',ex:[0.68,0]}));
  R.push(Object.assign(mod({c:[[1.78,0.62,0.58],[2.45,0.62,0.58]],h:[[1.78,0.24],[2.45,0.44]],fx:(g,k)=>liner(g,k,1.84,2.4,0.28,0.52,-1,[[1.9,0.62,1.9,0.42]])}),{id:'tcomb',ex:[0.44,0]}));
  R.push(Object.assign(mod({c:[[1.6,0.48,0.44],[1.78,0.5,0.46]],h:[[1.6,0.2],[1.78,0.22]],rows:[[1.73,0.05,'s'],[1.65,0.055,'r']]}),{id:'ct',ex:[0.2,0]}));
  R.push(Object.assign(mod({c:[[1.35,0.47,0.43],[1.6,0.48,0.44]],h:[[1.35,0.2],[1.6,0.2]],rows:[[1.56,0.045,'s'],[1.5,0.05,'r'],[1.44,0.045,'s'],[1.39,0.05,'r']]}),{id:'pt',ex:[0,0]}));
  R.push(Object.assign(mod({c:[[0.95,0.48,0.44],[1.35,0.5,0.46]],h:[[0.95,0.12],[1.35,0.2]],open:0,
    ext:(g,k,col)=>stacks(g,k,col,1), post:(g,k,col)=>stacks(g,k,col,-1)}),{id:'texh',ex:[-0.3,0],bb:[0.8,-0.8,1.35,0.8]}));
  R.push(Object.assign(mod({c:[[0.36,0.3,0.26],[0.55,0.42,0.38],[0.95,0.44,0.4]],h:[[0.36,0.06],[0.95,0.06]],
    fx:(g,k)=>{ /* planet gears and ring gear in section */ g.fillStyle=lin(g,0,-0.38*k,0,-0.06*k,[[0,'#9aa6b1'],[1,'#56626d']]);
      for(const [x,w] of [[0.5,0.1],[0.66,0.12]]){ g.fillRect(x*k,-0.34*k,w*k,0.26*k); g.strokeStyle=LINE; g.lineWidth=0.6; g.strokeRect(x*k,-0.34*k,w*k,0.26*k); g.strokeStyle='rgba(10,14,18,.5)'; g.beginPath(); for(let y=-0.33;y<-0.08;y+=0.025){ g.moveTo(x*k,y*k); g.lineTo((x+w)*k,y*k); } g.stroke(); }
      g.fillStyle='#46525d'; g.fillRect(0.45*k,-0.38*k,0.4*k,0.035*k); }}),{id:'rgb',ex:[-0.58,0]}));
  R.push({id:'prop',ex:[-0.95,0],bb:[-0.02,-1.18,0.36,1.18],draw:(g,k,col)=>{
    for(const s of [-1,1]){ g.beginPath(); g.moveTo(0.12*k,s*0.26*k); g.bezierCurveTo(0.08*k,s*0.5*k,0.1*k,s*0.9*k,0.13*k,s*1.12*k); g.lineTo(0.22*k,s*1.12*k); g.bezierCurveTo(0.26*k,s*0.8*k,0.25*k,s*0.45*k,0.22*k,s*0.26*k); g.closePath();
      g.fillStyle=lin(g,0.08*k,0,0.26*k,0,[[0,'#3b4651'],[0.4,'#9aa6b1'],[1,'#34404a']]); g.fill(); tint(g,col,0.12); ol(g,col); breakLine(g,0.175*k,s*1.12*k,0.16*k); }
    g.beginPath(); g.moveTo(-0.02*k,0); g.bezierCurveTo(0,-0.24*k,0.12*k,-0.29*k,0.36*k,-0.29*k); g.lineTo(0.36*k,0.29*k); g.bezierCurveTo(0.12*k,0.29*k,0,0.24*k,-0.02*k,0); g.closePath();
    g.fillStyle=fullG(g,-0.29*k,0.29*k); g.fill(); tint(g,col,0.1); ol(g,col); g.beginPath(); }});
  return {parts:R,order:['tsh','tagb','tinl','tax','imp','tdiff','tcomb','ct','pt','texh','rgb','prop'],len:[0,4.3],title:t2('Free-turbine turboprop · reverse flow','Turboprop med fri turbin · motstrøm'),air:[1,-1]}; }
/* free-turbine turboprop, direct flow: intake at the front behind the propeller, exhaust at the back; the Np shaft runs forward inside the hollow Ng shaft */
function G_tpd(){ const R=[], T=G_tp(); R.push(T.parts.find(p=>p.id==='prop'), T.parts.find(p=>p.id==='rgb'));
  R.push({id:'dsh',ex:[0,1.0],low:1,bb:[0.55,-0.1,3.22,0.1],draw:(g,k,col)=>{ rod(g,k,0.55,3.22,0,0.035,col); rod(g,k,1.3,2.9,0,0.085,'#7EC8F2');
    g.font=`600 ${Math.max(8,k*0.075)}px ${MONO}`; g.fillStyle='#E6ECF0'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('Np',0.95*k,-0.11*k); g.fillText('Ng',2.1*k,-0.16*k); g.fillText('Np',3.08*k,-0.11*k); g.textAlign='left'; g.textBaseline='alphabetic';
    g.beginPath(); }});
  R.push({id:'dagb',ex:[0,0.6],low:1,bb:[1.28,0.48,1.82,0.98],draw:(g,k,col)=>{ const x0=1.3*k,x1=1.8*k,y0=0.7*k,y1=0.84*k;
    g.setLineDash([4,3]); g.strokeStyle='rgba(214,226,236,.55)'; g.lineWidth=1; g.strokeRect(1.5*k,0.3*k,0.04*k,0.4*k); g.setLineDash([]);
    for(const [x,w,d] of [[1.34,0.09,0.07],[1.47,0.07,0.05],[1.6,0.12,0.09]]){ g.fillStyle=sideG(g,x*k,(x+w)*k); g.fillRect(x*k,y1,w*k,d*k); g.strokeStyle=LINE; g.lineWidth=0.6; g.strokeRect(x*k,y1,w*k,d*k); }
    rrp(g,x0,y0,x1-x0,y1-y0,4); g.fillStyle=lin(g,0,y0,0,y1,[[0,'#8a97a2'],[0.4,'#5e6a75'],[1,'#2a333b']]); g.fill(); tint(g,col,0.12); ol(g,col);
    g.beginPath(); }});
  R.push(Object.assign(mod({c:[[0.95,0.66,0.6],[1.05,0.64,0.56],[1.3,0.5,0.46]],h:[[0.95,0.44],[1.3,0.24]],open:0,
    post:(g,k)=>{ g.strokeStyle='rgba(126,200,242,.6)'; g.lineWidth=0.9; g.beginPath(); g.moveTo(0.82*k,-0.53*k); g.quadraticCurveTo(1.05*k,-0.53*k,1.24*k,-0.36*k); g.stroke();
      g.beginPath(); g.moveTo(1.26*k,-0.34*k); g.lineTo(1.2*k,-0.35*k); g.lineTo(1.23*k,-0.4*k); g.closePath(); g.fillStyle='rgba(126,200,242,.75)'; g.fill(); }}),{id:'dinl',ex:[-0.3,0],bb:[0.82,-0.66,1.3,0.66]}));
  R.push(Object.assign(mod({c:[[1.3,0.5,0.46],[1.72,0.44,0.4]],h:[[1.3,0.24],[1.72,0.27]],bore:0.1,rows:[[1.35,0.04,'s'],[1.41,0.05,'r'],[1.48,0.04,'s'],[1.54,0.05,'r'],[1.61,0.04,'s'],[1.67,0.05,'r']]}),{id:'tax',ex:[0,0]}));
  R.push(Object.assign(mod({c:[[1.72,0.44,0.4],[1.84,0.5,0.46],[1.94,0.62,0.58],[2.0,0.68,0.64]],h:[[1.72,0.27],[1.84,0.33],[1.94,0.45],[2.0,0.5]],bore:0.1,
    fx:(g,k)=>{ g.beginPath(); g.moveTo(2.0*k,-0.5*k); g.quadraticCurveTo(1.95*k,-0.3*k,1.72*k,-0.27*k); g.lineTo(1.72*k,-0.4*k); g.quadraticCurveTo(1.94*k,-0.42*k,1.98*k,-0.63*k); g.closePath(); g.fillStyle=lin(g,1.72*k,0,2.0*k,0,[[0,'#8592a0'],[1,'#cdd6dd']]); g.fill(); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke();
      g.fillStyle=lin(g,0,-0.5*k,0,-0.1*k,[[0,'#6b7783'],[1,'#3c4751']]); g.beginPath(); g.moveTo(2.0*k,-0.5*k); g.quadraticCurveTo(1.95*k,-0.3*k,1.72*k,-0.27*k); g.lineTo(1.72*k,-0.1*k); g.lineTo(2.0*k,-0.1*k); g.closePath(); g.fill(); g.stroke(); }}),{id:'imp',ex:[0.18,0]}));
  R.push(Object.assign(mod({c:[[2.0,0.7,0.66],[2.12,0.7,0.66]],h:[[2.0,0.5],[2.12,0.5]],rows:[[2.06,0.07,'s',0.51,0.66]]}),{id:'ddiff',ex:[0.36,0]}));
  R.push(Object.assign(mod({c:[[2.12,0.7,0.66],[2.75,0.56,0.52]],h:[[2.12,0.5],[2.4,0.28],[2.75,0.22]],fx:(g,k)=>liner(g,k,2.2,2.7,0.3,0.5,-1,[[2.24,0.68,2.24,0.4]])}),{id:'dcomb',ex:[0.6,0]}));
  R.push(Object.assign(mod({c:[[2.75,0.5,0.46],[2.93,0.5,0.46]],h:[[2.75,0.22],[2.93,0.22]],rows:[[2.79,0.05,'s'],[2.87,0.055,'r']]}),{id:'ct',ex:[0.85,0]}));
  R.push(Object.assign(mod({c:[[2.93,0.5,0.46],[3.25,0.52,0.48]],h:[[2.93,0.22],[3.25,0.22]],rows:[[3.0,0.045,'s'],[3.06,0.05,'r'],[3.13,0.045,'s'],[3.19,0.05,'r']]}),{id:'pt',ex:[1.1,0]}));
  R.push(Object.assign(mod({c:[[3.25,0.52,0.48],[3.85,0.46,0.42]],h:[[3.25,0.22],[3.85,0.0]],
    fx:(g,k)=>{ g.beginPath(); g.moveTo(3.25*k,-0.22*k); g.quadraticCurveTo(3.5*k,-0.2*k,3.68*k,0); g.lineTo(3.25*k,0); g.closePath(); g.fillStyle=lin(g,0,-0.22*k,0,0,[[0,'#8d99a4'],[1,'#56626d']]); g.fill(); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke(); }}),{id:'dexh',ex:[1.4,0]}));
  return {parts:R,order:['dsh','dagb','dexh','pt','ct','dcomb','ddiff','imp','tax','dinl','rgb','prop'],len:[-0.02,3.85],title:t2('Free-turbine turboprop · direct flow','Turboprop med fri turbin · direkte strøm')}; }
function stacks(g,k,col,s){ g.beginPath(); g.moveTo(1.02*k,s*0.46*k); g.lineTo(0.86*k,s*0.78*k); g.lineTo(1.06*k,s*0.8*k); g.lineTo(1.26*k,s*0.48*k); g.closePath();
  g.fillStyle=s>0?extG(g,k,0.8):lin(g,0,-0.8*k,0,-0.46*k,[[0,'#8f9ca7'],[1,'#74818c']]); g.fill(); tint(g,col,0.13); g.strokeStyle=LINE; g.lineWidth=0.6; g.stroke();
  if(s<0){ g.beginPath(); g.moveTo(1.06*k,-0.5*k); g.lineTo(0.94*k,-0.74*k); g.lineTo(1.04*k,-0.75*k); g.lineTo(1.16*k,-0.51*k); g.closePath(); g.fillStyle=CAV; g.fill(); } }
function rrp(g,x,y,w,h,r){ g.beginPath(); g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h); }

/* piston: one cylinder in section, crank axis at y = 0, cylinder axis at x = 0 (y down positive) */
function G_pist(){ const R=[];
  const fill=(g,f,col,a)=>{ g.fillStyle=f; g.fill(); if(col){ tint(g,col,a??0.12); ol(g,col); } else { g.strokeStyle=LINE; g.lineWidth=0.7; g.stroke(); } };
  R.push({id:'cam',ex:[0,1.25],bb:[-1.02,0.2,1.1,0.9],draw:(g,k,col)=>{ const y=0.55*k;
    g.beginPath(); g.arc(1.07*k,y,0.35*k,0,7); fill(g,lin(g,0,y-0.35*k,0,y+0.35*k,[[0,'#3a4550'],[0.35,'#9aa6b1'],[1,'#2a333b']]),col,0.1);
    g.strokeStyle='rgba(10,14,18,.5)'; g.lineWidth=0.6; g.beginPath(); for(let i=0;i<28;i++){ const a=i/28*Math.PI*2; g.moveTo(1.07*k+Math.cos(a)*0.3*k,y+Math.sin(a)*0.3*k); g.lineTo(1.07*k+Math.cos(a)*0.35*k,y+Math.sin(a)*0.35*k); } g.stroke();
    g.beginPath(); g.rect(-1.0*k,y-0.05*k,2.04*k,0.1*k); fill(g,fullG(g,y-0.05*k,y+0.05*k),col,0.08);
    for(const x of [-0.6,-0.2,0.2,0.6]){ g.beginPath(); g.ellipse(x*k,y-0.03*k,0.045*k,0.1*k,0,0,7); fill(g,sideG(g,(x-0.045)*k,(x+0.045)*k),col,0.1); }
    g.beginPath(); }});
  R.push({id:'crank',side:'R',ex:[0,1.1],bb:[-1.56,-0.42,1.36,0.38],draw:(g,k,col)=>{
    g.beginPath(); g.arc(1.29*k,0,0.2*k,0,7); fill(g,lin(g,0,-0.2*k,0,0.2*k,[[0,'#3a4550'],[0.35,'#9aa6b1'],[1,'#2a333b']]),col,0.1);
    for(const [a,b] of [[-1.45,-0.2],[0.2,1.25]]){ g.beginPath(); g.rect(a*k,-0.11*k,(b-a)*k,0.22*k); fill(g,fullG(g,-0.11*k,0.11*k),col,0.1); }
    g.beginPath(); g.rect(-1.56*k,-0.3*k,0.11*k,0.6*k); fill(g,fullG(g,-0.3*k,0.3*k),col,0.12);
    g.beginPath(); g.rect(-0.12*k,-0.39*k,0.24*k,0.18*k); fill(g,fullG(g,-0.39*k,-0.21*k),col,0.1);
    for(const x of [-0.2,0.12]){ g.beginPath(); g.moveTo(x*k,-0.42*k); g.lineTo((x+0.08)*k,-0.42*k); g.lineTo((x+0.08)*k,0.2*k); g.quadraticCurveTo((x+0.04+(x<0?-0.12:0.12))*k,0.42*k,(x+0.04)*k,0.38*k); g.quadraticCurveTo((x+0.04+(x<0?0.12:-0.12))*k,0.42*k,x*k,0.2*k); g.closePath(); fill(g,sideG(g,(x-0.08)*k,(x+0.16)*k),col,0.12); }
    g.beginPath(); }});
  R.push({id:'hub',ex:[-0.65,1.1],bb:[-2.25,-0.64,-1.56,0.64],draw:(g,k,col)=>{
    for(const s of [-1,1]){ g.beginPath(); g.moveTo(-1.88*k,s*0.2*k); g.lineTo(-1.86*k,s*0.62*k); g.lineTo(-1.7*k,s*0.62*k); g.lineTo(-1.72*k,s*0.2*k); g.closePath(); fill(g,lin(g,-1.88*k,0,-1.7*k,0,[[0,'#3b4651'],[0.45,'#a3afb9'],[1,'#34404a']]),col,0.12); breakLine(g,-1.79*k,s*0.62*k,0.17*k); }
    g.beginPath(); g.rect(-1.95*k,-0.22*k,0.33*k,0.44*k); fill(g,fullG(g,-0.22*k,0.22*k),col,0.1);
    g.beginPath(); g.rect(-1.62*k,-0.36*k,0.06*k,0.72*k); fill(g,fullG(g,-0.36*k,0.36*k),col,0.12);
    g.beginPath(); g.moveTo(-1.95*k,-0.22*k); g.bezierCurveTo(-2.12*k,-0.2*k,-2.25*k,-0.08*k,-2.25*k,0); g.bezierCurveTo(-2.25*k,0.08*k,-2.12*k,0.2*k,-1.95*k,0.22*k); g.closePath(); fill(g,fullG(g,-0.22*k,0.22*k),col,0.1);
    g.beginPath(); }});
  R.push({id:'rod',side:'R',ex:[0,0.7],bb:[-0.17,-1.39,0.17,-0.13],draw:(g,k,col)=>{
    g.beginPath(); g.moveTo(-0.05*k,-1.28*k); g.lineTo(0.05*k,-1.28*k); g.lineTo(0.085*k,-0.42*k); g.lineTo(-0.085*k,-0.42*k); g.closePath(); fill(g,sideG(g,-0.09*k,0.09*k),col,0.12);
    g.strokeStyle='rgba(10,14,18,.45)'; g.lineWidth=0.6; g.beginPath(); g.moveTo(-0.02*k,-1.2*k); g.lineTo(-0.035*k,-0.5*k); g.moveTo(0.02*k,-1.2*k); g.lineTo(0.035*k,-0.5*k); g.stroke();
    for(const [y,ro,ri] of [[-1.3,0.085,0.05],[-0.3,0.165,0.1]]){ g.beginPath(); g.arc(0,y*k,ro*k,0,7); g.arc(0,y*k,ri*k,0,7,true); fill(g,lin(g,-ro*k,0,ro*k,0,[[0,'#3a4550'],[0.4,'#b4bec7'],[1,'#2a333b']]),col,0.12); }
    g.strokeStyle='rgba(225,233,240,.5)'; g.beginPath(); g.moveTo(-0.165*k,-0.3*k); g.lineTo(-0.1*k,-0.3*k); g.moveTo(0.1*k,-0.3*k); g.lineTo(0.165*k,-0.3*k); g.stroke();
    g.beginPath(); }});
  R.push({id:'pist',side:'R',ex:[0,0.36],bb:[-0.38,-1.62,0.38,-1.12],draw:(g,k,col)=>{
    rrp(g,-0.38*k,-1.62*k,0.76*k,0.5*k,[4,4,1,1]); fill(g,sideG(g,-0.38*k,0.38*k),col,0.12);
    for(const y of [-1.57,-1.52,-1.46]){ g.fillStyle='#1b2229'; g.fillRect(-0.38*k,y*k,0.76*k,0.018*k); g.fillStyle='rgba(220,228,234,.55)'; g.fillRect(-0.38*k,(y+0.006)*k,0.76*k,0.006*k); }
    g.beginPath(); g.arc(0,-1.3*k,0.07*k,0,7); fill(g,'#2a333b',null); g.beginPath(); g.arc(0,-1.3*k,0.045*k,0,7); g.fillStyle='#b4bec7'; g.fill();
    g.beginPath(); }});
  R.push({id:'cyl',ex:[0,-0.45],bb:[-0.66,-1.7,0.66,-0.95],draw:(g,k,col)=>{
    g.fillStyle=CAV; g.fillRect(-0.39*k,-1.7*k,0.78*k,0.75*k);
    for(const s of [-1,1]){ for(let y=-1.66;y<-1.12;y+=0.065){ g.beginPath(); g.rect(Math.min(s*0.47,s*0.66)*k,y*k,0.19*k,0.026*k); fill(g,'#7b8893',col,0.14); }
      g.beginPath(); g.rect(Math.min(s*0.39,s*0.48)*k,-1.7*k,0.09*k,0.75*k); g.fillStyle=cutG(g,k,1.7); g.fill(); hatch(g,Math.min(s*0.39,s*0.48)*k,-1.7*k,Math.max(s*0.39,s*0.48)*k,-0.95*k); g.beginPath(); g.rect(Math.min(s*0.39,s*0.48)*k,-1.7*k,0.09*k,0.75*k); tint(g,col,0.14); g.strokeStyle=LINE; g.lineWidth=0.7; g.stroke();
      g.beginPath(); g.rect(Math.min(s*0.39,s*0.6)*k,-1.02*k,0.21*k,0.07*k); g.fillStyle=cutG(g,k,1.7); g.fill(); tint(g,col,0.14); g.stroke(); }
    g.beginPath(); }});
  R.push({id:'head',ex:[0,-0.8],bb:[-0.76,-2.27,0.76,-1.7],draw:(g,k,col)=>{
    for(let y=-2.22;y<-1.78;y+=0.07){ g.beginPath(); g.rect(-0.76*k,y*k,1.52*k,0.026*k); fill(g,'#7b8893',col,0.14); }
    g.beginPath(); g.rect(-0.6*k,-2.27*k,1.2*k,0.57*k); g.fillStyle=cutG(g,k,2.3); g.fill(); hatch(g,-0.6*k,-2.27*k,0.6*k,-1.7*k);
    g.beginPath(); g.rect(-0.6*k,-2.27*k,1.2*k,0.57*k); tint(g,col,0.14); g.strokeStyle=LINE; g.lineWidth=0.7; g.stroke();
    g.fillStyle=CAV; g.beginPath(); g.ellipse(0,-1.7*k,0.39*k,0.15*k,0,Math.PI,0); g.fill();
    for(const s of [-1,1]){ g.beginPath(); g.moveTo(s*0.6*k,-2.02*k); g.lineTo(s*0.6*k,-1.9*k); g.quadraticCurveTo(s*0.3*k,-1.9*k,s*0.25*k,-1.8*k); g.lineTo(s*0.11*k,-1.8*k); g.quadraticCurveTo(s*0.2*k,-2.02*k,s*0.6*k,-2.02*k); g.closePath(); g.fill();
      g.fillRect(s*0.18*k-0.025*k,-2.27*k,0.05*k,0.3*k); g.save(); g.translate(s*0.5*k,-1.86*k); g.rotate(s*-0.5); g.fillRect(-0.03*k,-0.03*k,0.18*k*-s,0.06*k); g.restore(); }
    g.beginPath(); }});
  for(const [id,s] of [['iv',-1],['ev',1]]) R.push({id,ex:[s*0.12,-1.5],bb:[s*0.18-0.13,-2.47,s*0.18+0.13,-1.71],draw:(g,k,col)=>{ const x=s*0.18*k;
    g.strokeStyle='#cfd8df'; g.lineWidth=1; g.beginPath(); for(let i=0;i<=8;i++){ const y=(-2.44+i*0.02)*k; g.lineTo(x+(i%2?-1:1)*0.06*k,y); } g.stroke();
    g.beginPath(); g.rect(x-0.018*k,-2.47*k,0.036*k,0.72*k); fill(g,sideG(g,x-0.02*k,x+0.02*k),col,0.15);
    g.beginPath(); g.moveTo(x-0.018*k,-1.78*k); g.quadraticCurveTo(x-0.03*k,-1.74*k,x-0.12*k,-1.73*k); g.lineTo(x-0.12*k,-1.71*k); g.lineTo(x+0.12*k,-1.71*k); g.lineTo(x+0.12*k,-1.73*k); g.quadraticCurveTo(x+0.03*k,-1.74*k,x+0.018*k,-1.78*k); g.closePath(); fill(g,sideG(g,x-0.12*k,x+0.12*k),col,0.2);
    g.beginPath(); }});
  R.push({id:'plug',ex:[0,-0.8],bb:[-1.45,-2.0,1.45,-1.72],hb:[[-1.45,-2.06,-0.42,-1.7],[0.42,-2.06,1.45,-1.7]],side:'b',draw:(g,k,col,e)=>{
    for(const s of [-1,1]){ g.save(); g.translate(s*(0.5+0.45*(e||0))*k,-1.86*k); g.rotate(s*-0.5); const d=-s; // along -s from the tip
      const seg=(a,b,w,f)=>{ g.beginPath(); g.rect(Math.min(a,b)*k*1,-w*k,Math.abs(b-a)*k,2*w*k); fill(g,f,col,0.14); };
      seg(0,d*0.12,0.028,lin(g,0,-0.03*k,0,0.03*k,[[0,'#5b6773'],[0.4,'#c3ccd4'],[1,'#4a5560']]));
      seg(d*0.12,d*0.2,0.05,lin(g,0,-0.05*k,0,0.05*k,[[0,'#3a4550'],[0.4,'#a9b4bd'],[1,'#2a333b']]));
      seg(d*0.2,d*0.4,0.034,lin(g,0,-0.035*k,0,0.035*k,[[0,'#b9c2c9'],[0.4,'#f4f7f9'],[1,'#a3adb5']]));
      seg(d*0.4,d*0.45,0.018,'#c9d2da'); g.restore(); }
    g.beginPath(); }});
  R.push({id:'exh',ex:[0.6,-0.8],bb:[0.6,-2.08,1.32,-1.44],draw:(g,k,col)=>{
    g.lineCap='butt'; g.lineJoin='round'; const p=()=>{ g.beginPath(); g.moveTo(0.6*k,-1.96*k); g.lineTo(0.98*k,-1.96*k); g.quadraticCurveTo(1.2*k,-1.96*k,1.2*k,-1.72*k); g.lineTo(1.2*k,-1.5*k); };
    p(); g.strokeStyle='rgba(6,10,14,.75)'; g.lineWidth=0.15*k+2; g.stroke(); p(); g.strokeStyle='#6f5a52'; g.lineWidth=0.15*k; g.stroke(); p(); g.strokeStyle=rgba(col,0.35); g.lineWidth=0.15*k; g.stroke(); p(); g.strokeStyle='rgba(255,226,210,.35)'; g.lineWidth=0.03*k; g.stroke();
    g.beginPath(); g.moveTo(1.1*k,-1.5*k); g.lineTo(1.3*k,-1.5*k); g.lineTo(1.32*k,-1.44*k); g.lineTo(1.08*k,-1.44*k); g.closePath(); fill(g,'#5d4c45',col,0.2);
    g.beginPath(); }});
  R.push({id:'carb',ex:[-0.6,0],bb:[-1.3,-2.08,-0.6,0.02],draw:(g,k,col)=>{
    g.lineJoin='round'; const p=()=>{ g.beginPath(); g.moveTo(-1.1*k,-0.42*k); g.lineTo(-1.1*k,-1.7*k); g.quadraticCurveTo(-1.1*k,-1.96*k,-0.84*k,-1.96*k); g.lineTo(-0.6*k,-1.96*k); };
    p(); g.strokeStyle='rgba(6,10,14,.75)'; g.lineWidth=0.14*k+2; g.stroke(); p(); g.strokeStyle='#7d8a95'; g.lineWidth=0.14*k; g.stroke(); p(); g.strokeStyle=rgba(col,0.3); g.lineWidth=0.14*k; g.stroke(); p(); g.strokeStyle='rgba(235,242,247,.35)'; g.lineWidth=0.03*k; g.stroke();
    rrp(g,-1.28*k,-0.45*k,0.36*k,0.45*k,3); fill(g,sideG(g,-1.28*k,-0.92*k),col,0.14);
    g.fillStyle=CAV; g.beginPath(); g.moveTo(-1.16*k,-0.45*k); g.quadraticCurveTo(-1.1*k,-0.22*k,-1.16*k,0); g.lineTo(-1.04*k,0); g.quadraticCurveTo(-1.1*k,-0.22*k,-1.04*k,-0.45*k); g.closePath(); g.fill();
    g.strokeStyle='#dfe6eb'; g.lineWidth=1.6; g.beginPath(); g.moveTo(-1.15*k,-0.36*k); g.lineTo(-1.05*k,-0.3*k); g.stroke();
    g.beginPath(); }});
  R.push({id:'mag',ex:[0.62,0],bb:[1.38,-0.66,1.92,-0.02],draw:(g,k,col)=>{
    for(const y of [-0.64,-0.3]){ rrp(g,1.4*k,y*k,0.4*k,0.26*k,3); fill(g,fullG(g,y*k,(y+0.26)*k),col,0.15);
      rrp(g,1.8*k,(y+0.03)*k,0.1*k,0.2*k,2); fill(g,'#2b333b',col,0.2); g.fillStyle='#F5B85C'; g.beginPath(); g.arc(1.85*k,(y+0.13)*k,1.8,0,7); g.fill(); }
    g.beginPath(); }});
  return {parts:R,order:['cam','crank','hub','rod','cyl','pist','head','iv','ev','plug','exh','carb','mag'],title:t2('Four-stroke piston engine · one cylinder in section','Firetakts stempelmotor · én sylinder i snitt'),pist:1}; }

const CACHE={}; let LAY='rev';
function build(type){ if(type==='tp'&&LAY==='dir') type='tpd'; if(CACHE[type]) return CACHE[type]; const G=type==='pist'?G_pist():type==='tpd'?G_tpd():type==='tp'?G_tp():type==='jet'?G_jet():G_fan();
  const by={}; G.parts.forEach(p=>{ Object.assign(p,TX[p.id]); by[p.id]=p; });
  /* list order: along the flow (or top to bottom for the piston); letters A, B, C… */
  const flow={fan:['inlet','fan','duct','lpc','hpc','diff','comb','hpt','lpt','noz','sh2','agb'],jet:['inlet','comp','diff','comb','jturb','jpipe','jnoz','sh1','agb'],
    tp:['tinl','tax','imp','tdiff','tcomb','ct','pt','texh','rgb','prop','tsh','tagb'],tpd:['dinl','tax','imp','ddiff','dcomb','ct','pt','dexh','rgb','prop','dsh','dagb'],pist:['carb','iv','head','plug','mag','cyl','pist','ev','exh','rod','crank','cam','hub']}[type];
  G.list=flow.map((id,i)=>{ by[id].letter=String.fromCharCode(65+i); return by[id]; }); G.by=by; CACHE[type]=G; return G; }

/* ---------- layout of labels: never overlapping ---------- */
function spread(items,lo,hi,gap,key,size){ items.sort((a,b)=>a[key]-b[key]); let p=lo; items.forEach(it=>{ it[key]=Math.max(it[key],p); p=it[key]+it[size]+gap; });
  let q=hi; for(let i=items.length-1;i>=0;i--){ const it=items[i]; it[key]=Math.min(it[key],q-it[size]); q=it[key]-gap; } }

/* ---------- draw ---------- */
let LAST=null;
function draw(g,W,H,o){ const G=build(o.type), L=o.L, ph=W<560, e=o.e, FS=o.FS||1, rot=ph&&!G.pist;
  const sel=o.sel, hov=o.hov;
  /* bounds in engine units at this explode amount */
  const bbOf=p=>{ const [dx,dy]=p.ex||[0,0]; return [p.bb[0]+dx*e,p.bb[1]+dy*e,p.bb[2]+dx*e,p.bb[3]+dy*e]; };
  let ux0=1e9,uy0=1e9,ux1=-1e9,uy1=-1e9; G.parts.forEach(p=>{ const b=bbOf(p); ux0=Math.min(ux0,b[0]); uy0=Math.min(uy0,b[1]); ux1=Math.max(ux1,b[2]); uy1=Math.max(uy1,b[3]); });
  /* full-explode bounds fix the scale so parts do not jump; the assembled engine is shown a little larger */
  let fx0=1e9,fy0=1e9,fx1=-1e9,fy1=-1e9; G.parts.forEach(p=>{ const [dx,dy]=p.ex||[0,0]; fx0=Math.min(fx0,p.bb[0]+dx,p.bb[0]); fy0=Math.min(fy0,p.bb[1]+dy,p.bb[1]); fx1=Math.max(fx1,p.bb[2]+dx,p.bb[2]); fy1=Math.max(fy1,p.bb[3]+dy,p.bb[3]); });
  const px0=ux0, px1=ux1; if(G.air){ if(G.air[0]){ ux1+=0.5; fx1+=0.5; } else { ux0-=0.5; fx0-=0.5; } }
  const cols=G.pist||rot, top=ph?30:38, lw=cols?(ph?30:150):0, padT=cols?top+6:top+56, padB=cols?14:58;
  const aw=W-2*lw-24, ah=H-padT-padB; const fw=rot?fy1-fy0:fx1-fx0, fh=rot?fx1-fx0:fy1-fy0, cw=rot?uy1-uy0:ux1-ux0, chh=rot?ux1-ux0:uy1-uy0;
  const kF=Math.min(aw/fw,ah/fh), kC=Math.min(aw/cw,ah/chh), k=Math.min(kC,kF*1.55);
  const cx=W/2, cy=padT+ah/2, mx=(ux0+ux1)/2, my=(uy0+uy1)/2;
  /* local (engine units) → screen */
  const S=(x,y)=>rot?[cx-(y-my)*k,cy+(x-mx)*k]:[cx+(x-mx)*k,cy+(y-my)*k];
  g.save();
  /* caption */
  g.font=`500 ${10*FS}px ${MONO}`; g.fillStyle='#7f8d99'; g.textAlign='left'; g.fillText(L(G.title).toUpperCase(),12,ph?18:22);
  if(!ph) g.textAlign='right'; if(!ph) g.fillText(L(e<0.04?t2('ASSEMBLED','SATT SAMMEN'):e>0.96?t2('EXPLODED VIEW','SPRENGSKISSE'):t2('TAKING IT APART…','TAR DEN FRA HVERANDRE …')),W-12,ph?18:22); g.textAlign='left';
  /* centre lines */
  g.save(); g.lineWidth=0.8; g.strokeStyle='rgba(200,215,225,.30)'; g.setLineDash([12,3,2,3]);
  const ln=(a,b)=>{ g.beginPath(); g.moveTo(...S(...a)); g.lineTo(...S(...b)); g.stroke(); };
  if(G.pist){ ln([0,uy0-0.05],[0,Math.min(uy1,1.7*e+0.5)]); ln([ux0-0.05,1.1*e],[1.45,1.1*e]); }
  else ln([ux0-0.15,0],[ux1+0.15,0]);
  g.restore();
  /* explode leader lines: from where each part sits to where it is now */
  if(e>0.03){ g.save(); g.strokeStyle='rgba(200,215,225,.22)'; g.lineWidth=0.8; g.setLineDash([3,3]);
    G.parts.forEach(p=>{ const [dx,dy]=p.ex||[0,0]; if(!G.pist&&!dy) return; if(!dx&&!dy) return; const bx=(p.bb[0]+p.bb[2])/2, by=(p.bb[1]+p.bb[3])/2; g.beginPath(); g.moveTo(...S(bx,by)); g.lineTo(...S(bx+dx*e,by+dy*e)); g.stroke(); });
    g.restore(); }
  /* the parts */
  const dim=sel?0.26:1;
  g.save();
  G.order.forEach(id=>{ const p=G.by[id]; drawPartAt(g,p,k,S,e,rot,sel&&sel!==id?dim:1,hov===id&&!sel); });
  if(sel&&G.by[sel]) drawPartAt(g,G.by[sel],k,S,e,rot,1,true);
  g.restore();
  /* magneto leads (piston): thin wires that stretch as the parts separate */
  if(G.pist){ const pm=G.by.mag.ex, pp=G.by.plug.ex; g.save(); g.globalAlpha=sel&&sel!=='mag'&&sel!=='plug'?0.15:0.5; g.strokeStyle=rgba(SC[3],0.7); g.lineWidth=0.8; g.setLineDash([4,3]);
    for(const [my2,px] of [[-0.51,-0.62],[-0.17,0.62]]){ const a=S(1.9+pm[0]*e,my2+pm[1]*e), b=S(px+Math.sign(px)*0.45*e+pp[0]*e,-1.86+pp[1]*e), c=S(1.55+pm[0]*e*0.5,-2.35+pp[1]*e*0.6);
      g.beginPath(); g.moveTo(...a); g.bezierCurveTo(a[0]+40,a[1]-20,c[0],c[1],b[0]+(px<0?-6:6),b[1]-14); g.stroke(); }
    g.restore(); }
  /* air-in marker */
  if(G.air){ const [u,dir]=G.air, xa=u?px1+0.05:px0-0.05; const p0=S(xa+(u?0.35:-0.35),G.pist?0:-0.12), p1=S(xa+(u?0.05:-0.05),G.pist?0:-0.12);
    g.save(); g.strokeStyle=SC[1]; g.fillStyle=SC[1]; g.lineWidth=1.4; g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke(); const an=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]); g.beginPath(); g.moveTo(...p1); g.lineTo(p1[0]-7*Math.cos(an-0.45),p1[1]-7*Math.sin(an-0.45)); g.lineTo(p1[0]-7*Math.cos(an+0.45),p1[1]-7*Math.sin(an+0.45)); g.closePath(); g.fill();
    g.font=`600 ${9.5*FS}px ${MONO}`; g.textAlign='center'; g.fillText(L(t2('AIR IN','LUFT INN')),(p0[0]+p1[0])/2+(rot?16:0),(p0[1]+p1[1])/2-(rot?0:8)); g.restore(); void dir; }
  /* screen boxes for hit-testing */
  const box=(id,b)=>{ const c1=S(b[0],b[1]), c2=S(b[2],b[3]); return {id,x0:Math.min(c1[0],c2[0]),y0:Math.min(c1[1],c2[1]),x1:Math.max(c1[0],c2[0]),y1:Math.max(c1[1],c2[1])}; };
  const boxes=G.parts.map(p=>box(p.id,bbOf(p)));
  const hboxes=[]; G.parts.forEach(p=>{ const [dx,dy]=p.ex||[0,0]; (p.hb||[p.bb]).forEach(b=>hboxes.push(box(p.id,[b[0]+dx*e,b[1]+dy*e,b[2]+dx*e,b[3]+dy*e]))); });
  /* labels */
  const labs=[]; const fs=(ph?10:11.5)*FS; g.font=`600 ${fs}px ${SANS}`;
  G.parts.forEach(p=>{ const b=boxes.find(x=>x.id===p.id), isSel=sel===p.id, short=ph&&!isSel; const text=short?p.letter:(L(p.s||p.n)); const w=short?fs+8:g.measureText(text).width+(ph?24:26), h=fs+(ph?7:9);
    labs.push({p,b,text,w,h,short,isSel}); });
  if(cols){ /* columns left and right */
    const midX=(boxes.reduce((s,b)=>s+(b.x0+b.x1)/2,0))/boxes.length; const ex0=Math.min(...boxes.map(b=>b.x0)), ex1=Math.max(...boxes.map(b=>b.x1));
    const L1=[],R1=[]; labs.forEach(l=>{ const b=l.b; let side;
      if(rot) side=l.p.low?'L':'R'; else if(!ph&&(l.p.side==='L'||l.p.side==='R')) side=l.p.side; else side=l.p.side==='b'?null:((b.x0+b.x1)/2<midX-0.02*W?'L':(b.x0+b.x1)/2>midX+0.02*W?'R':null);
      l.ay=(b.y0+b.y1)/2; l.y=l.ay-l.h/2;
      if(!side){ /* centre column: alternate by free space */ const nl=L1.filter(x=>Math.abs(x.ay-l.ay)<l.h+4).length, nr=R1.filter(x=>Math.abs(x.ay-l.ay)<l.h+4).length; side=nl<=nr?'L':'R'; }
      l.side=side; l.ax=side==='L'?b.x0:b.x1; if(l.p.id==='plug'){ l.ax=side==='L'?b.x0+4:b.x1-4; } (side==='L'?L1:R1).push(l); });
    const lx=Math.max(4,ex0-14), rx=Math.min(W-4,ex1+14);
    spread(L1,top,H-6,4,'y','h'); spread(R1,top,H-6,4,'y','h');
    L1.forEach(l=>{ l.x=Math.max(4,lx-l.w); }); R1.forEach(l=>{ l.x=Math.min(W-4-l.w,rx); }); }
  else { /* rows above and below */
    const ey0=Math.min(...boxes.map(b=>b.y0)), ey1=Math.max(...boxes.map(b=>b.y1));
    const tiers=[{y:ey0-20,s:-1,it:[]},{y:ey1+8,s:1,it:[]},{y:ey0-44,s:-1,it:[]},{y:ey1+32,s:1,it:[]}];
    labs.sort((a,b)=>(a.b.x0+a.b.x1)-(b.b.x0+b.b.x1)).forEach(l=>{ const b=l.b; l.ax=(b.x0+b.x1)/2; const want=Math.max(4,Math.min(W-4-l.w,l.ax-l.w/2));
      const ord=l.p.low?[1,3,0,2]:[0,1,2,3]; let best=null,bc=1e9;
      for(const ti of ord){ const T=tiers[ti]; let x=want; T.it.forEach(o=>{ if(x<o.x+o.w+6&&x+l.w+6>o.x) x=o.x+o.w+6; }); const cost=Math.abs(x-want)+(x+l.w>W-4?1e4:0)+ord.indexOf(ti)*8; if(cost<bc){ bc=cost; best=[T,x]; } }
      const [T,x]=best; l.x=x; l.T=T; T.it.push(l); });
    tiers.forEach(T=>{ T.it.forEach(l=>l.cx=l.x); spread(T.it,4,W-4,6,'x','w'); T.it.forEach(l=>{ l.y=T.s<0?T.y-l.h/2:T.y; l.ay=T.s<0?l.b.y0:l.b.y1; }); }); }
  /* draw leaders, then labels */
  labs.forEach(l=>{ const c=SC[l.p.st], a=sel&&!l.isSel?0.35:1; g.save(); g.globalAlpha=a; g.strokeStyle=rgba(c,0.7); g.lineWidth=0.8;
    let lx,ly; if(cols){ lx=l.side==='L'?l.x+l.w:l.x; ly=l.y+l.h/2; } else { lx=Math.max(l.x+6,Math.min(l.x+l.w-6,l.ax)); ly=l.T.s<0?l.y+l.h:l.y; }
    g.beginPath(); g.moveTo(l.ax,l.ay); if(cols){ const kx=l.side==='L'?Math.min(l.ax-6,lx+10):Math.max(l.ax+6,lx-10); g.lineTo(kx,ly); } g.lineTo(lx,ly); g.stroke();
    g.fillStyle=c; g.beginPath(); g.arc(l.ax,l.ay,2,0,7); g.fill(); g.restore(); });
  labs.forEach(l=>{ const c=SC[l.p.st], a=sel&&!l.isSel?0.45:1, hv=hov===l.p.id; g.save(); g.globalAlpha=a;
    rrp(g,l.x,l.y,l.w,l.h,l.short?l.h/2:4); g.fillStyle=l.isSel?rgba(c,0.95):'rgba(10,14,18,.86)'; g.fill(); g.strokeStyle=rgba(c,l.isSel||hv?1:0.55); g.lineWidth=l.isSel||hv?1.4:1; g.stroke();
    g.font=`600 ${fs}px ${SANS}`; g.textBaseline='middle';
    if(l.short){ g.textAlign='center'; g.fillStyle=l.isSel?'#0f151b':c; g.fillText(l.text,l.x+l.w/2,l.y+l.h/2+0.5); }
    else { const r=(l.h-8)/2+1; g.fillStyle=l.isSel?'#0f151b':c; g.beginPath(); g.arc(l.x+6+r,l.y+l.h/2,r,0,7); g.fill(); g.font=`700 ${fs*0.78}px ${MONO}`; g.textAlign='center'; g.fillStyle=l.isSel?c:'#0f151b'; g.fillText(String(l.p.st),l.x+6+r,l.y+l.h/2+0.5);
      g.font=`600 ${fs}px ${SANS}`; g.textAlign='left'; g.fillStyle=l.isSel?'#0f151b':'#E6ECF0'; g.fillText(l.text,l.x+6+2*r+5,l.y+l.h/2+0.5); }
    g.restore(); l.box=[l.x,l.y,l.x+l.w,l.y+l.h]; });
  g.restore();
  LAST={boxes:hboxes,labs}; }
function drawPartAt(g,p,k,S,e,rot,alpha,hl){ const [dx,dy]=p.ex||[0,0], [sx,sy]=S(dx*e,dy*e), col=SC[p.st];
  g.save(); g.translate(sx,sy); if(rot) g.rotate(Math.PI/2); g.globalAlpha=alpha;
  if(hl&&!p.c){ g.shadowColor=rgba(col,0.85); g.shadowBlur=14; }
  p.draw(g,k,col,e); g.shadowBlur=0;
  g.strokeStyle=rgba(col,hl?1:0.8); g.lineWidth=hl?2.2:1.1; g.setLineDash([]); if(hl&&p.c){ g.shadowColor=rgba(col,0.9); g.shadowBlur=12; }
  g.stroke(); g.restore(); }
function hit(x,y){ if(!LAST) return null; for(const l of LAST.labs) if(l.box&&x>=l.box[0]-2&&x<=l.box[2]+2&&y>=l.box[1]-2&&y<=l.box[3]+2) return l.p.id;
  let best=null,ba=1e12; LAST.boxes.forEach(b=>{ if(x>=b.x0-3&&x<=b.x1+3&&y>=b.y0-3&&y<=b.y1+3){ const a=(b.x1-b.x0)*(b.y1-b.y0); if(a<ba){ ba=a; best=b.id; } } }); return best; }
window.ENGP={layout:l=>{ LAY=l==='dir'?'dir':'rev'; },parts:t=>build(t).list,part:(t,id)=>build(t).by[id],draw,hit,SC,SN};
})();
