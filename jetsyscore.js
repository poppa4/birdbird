/* Birdbird – jetsyscore.js: the system logic behind the Aircraft systems lab (jetsystems.html).
   No DOM, no drawing. Loaded in the page as window.SYC and in Node (tests/jetsys.test.mjs) through vm.
   Three generic classes: 'pist' light piston twin, 'tp' turboprop twin, 'jet' jet transport. Five systems:
   'elec', 'hyd', 'fuel', 'fc' (flight controls), 'gear' (landing gear and brakes).
   Each system is a small network: nodes (sources, buses, pumps, valves, tanks, users) and edges (wires, pipes, cables).
   net() spreads power or pressure from the live sources along open edges; a node that has failed, or is switched off, stops it.
   Layout fields on the nodes (r = row, x = fraction of the width, wf = width fraction) are only used for drawing.
   F = failures, A = pilot actions/switches, Q = fuel quantities, G = gear state. Numbers are typical, not one type. */
(function(root){
'use strict';
const T=(en,no)=>[en,no];

/* ---------- the network solver ---------- */
/* nodes: {id, src, fail, off}; edges: {a, b, g (gate, default open), bi (two-way: flow from whichever side is live first), par (also shown when both ends are live)}.
   order: source ids in priority order (the first live source claims what it reaches). Returns {lv: id→true, edges with .on and .rev}. */
function net(nodes,edges,order){
  const N={}; nodes.forEach(n=>{ N[n.id]=n; });
  const blocked=id=>!N[id]||N[id].fail||N[id].off;
  const lv={}; edges.forEach(e=>{ e.on=false; e.rev=false; });
  const ids=(order&&order.length?order:nodes.filter(n=>n.src).map(n=>n.id));
  for(const s of ids){ const n=N[s]; if(!n||!n.src||blocked(s)||lv[s]) continue;
    lv[s]=true; const q=[s];
    while(q.length){ const c=q.shift();
      for(const e of edges){ if(e.g===false) continue;
        if(e.a===c&&!lv[e.b]&&!blocked(e.b)){ lv[e.b]=true; e.on=true; q.push(e.b); }
        else if(e.bi&&e.b===c&&!lv[e.a]&&!blocked(e.a)){ lv[e.a]=true; e.on=true; e.rev=true; q.push(e.a); } } } }
  edges.forEach(e=>{ if(e.par&&e.g!==false&&lv[e.a]&&!blocked(e.b)&&lv[e.b]) e.on=true; });
  return lv;
}
function mk(nodes,edges,order,info){ const lv=net(nodes,edges,order); nodes.forEach(n=>{ n.live=!!lv[n.id]; }); return {nodes,edges,lv,info:info||{}}; }
const E=(a,b,o)=>Object.assign({a,b},o||{});

/* ---------- default state ---------- */
function defaults(cls){
  return {F:{}, A:{apu:false,inv:1,ptu:true,xf:false,selL:'on',selR:'on',aux1:false,aux2:false,bL:true,bR:true,pL:true,pR:true,ctr:true,jett:false,trimOff:false,lever:'down',emer:false,hand:false,ab:true,fwL:true},
    Q:cls==='pist'?{L:190,R:190}:cls==='tp'?{L:1100,R:1100}:{L:5500,C:4000,R:5500}};
}
const CAP={pist:{L:200,R:200},tp:{L:1200,R:1200},jet:{L:6000,C:6500,R:6000}};
const BURN={pist:45,tp:230,jet:1250};        // per engine per hour: litres (piston, avgas) or kg (turbine), typical
const UNIT={pist:'l',tp:'kg',jet:'kg'};

/* ---------- electrics ---------- */
function elec(cls,F,A){
  if(cls==='pist'){
    const nodes=[
      {id:'alt1',r:0,x:.14,k:'src',l:T('ALT 1','ALT 1'),s:T('28 V DC','28 V DC'),src:!F.g1&&!F.e1,fail:!!F.g1},
      {id:'bat',r:0,x:.5,k:'src',l:T('BATTERY','BATTERI'),s:T('24 V','24 V'),src:true},
      {id:'alt2',r:0,x:.86,k:'src',l:T('ALT 2','ALT 2'),s:T('28 V DC','28 V DC'),src:!F.g2,fail:!!F.g2},
      {id:'bus',r:1,x:.5,wf:.76,k:'bus',l:T('MAIN BUS','HOVEDSKINNE'),w:T('Main bus','Hovedskinne')},
      {id:'avb',r:2,x:.845,k:'bus',l:T('AVIONICS BUS','AVIONIKKSKINNE'),fail:!!F.bus,w:T('Avionics bus','Avionikkskinne')},
      {id:'gear',r:3,x:.07,k:'use',l:T('GEAR\nMOTOR','UNDERSTELLS-\nMOTOR'),w:T('Landing gear motor','Understellsmotor')},
      {id:'flaps',r:3,x:.23,k:'use',l:T('FLAPS','FLAPS'),w:T('Electric flaps','Elektriske flaps')},
      {id:'pumps',r:3,x:.39,k:'use',l:T('AUX FUEL\nPUMPS','EKSTRA\nBR.PUMPER'),w:T('Auxiliary fuel pumps','Ekstra brennstoffpumper')},
      {id:'heat',r:3,x:.55,k:'use',l:T('PITOT HEAT\nLIGHTS','PITOTVARME\nLYS'),w:T('Pitot heat and lights','Pitotvarme og lys')},
      {id:'rad',r:3,x:.76,k:'use',l:T('RADIOS\nGPS','RADIO\nGPS'),w:T('Radios, GPS and transponder','Radio, GPS og transponder')},
      {id:'ap',r:3,x:.93,k:'use',l:T('AUTO-\nPILOT','AUTO-\nPILOT'),w:T('Autopilot','Autopilot')}];
    const edges=[E('alt1','bus',{bx:.14}),E('alt2','bus',{bx:.86}),E('bat','bus',{bi:true}),E('bus','avb',{ax:.845}),
      E('bus','gear',{ax:.07,par:true}),E('bus','flaps',{ax:.23,par:true}),E('bus','pumps',{ax:.39,par:true}),E('bus','heat',{ax:.55,par:true}),E('avb','rad',{ax:.76,par:true}),E('avb','ap',{ax:.93,par:true})];
    const R=mk(nodes,edges,['alt1','alt2','bat']); const nAlt=(R.lv.alt1?1:0)+(R.lv.alt2?1:0);
    R.info={nGen:nAlt,battOnly:nAlt===0,cfg:nAlt===2?'normal':nAlt===1?'one':'batt'};
    if(nAlt===0) R.nodes.find(n=>n.id==='bat').warn=true;
    return R; }
  if(cls==='tp'){
    const nodes=[
      {id:'gen1',r:0,x:.12,k:'src',l:T('GEN 1','GEN 1'),s:T('starter-gen','starter-gen'),src:!F.g1,fail:!!F.g1},
      {id:'bat',r:0,x:.5,k:'src',l:T('BATTERY','BATTERI'),s:T('24 V','24 V'),src:true},
      {id:'gen2',r:0,x:.88,k:'src',l:T('GEN 2','GEN 2'),s:T('starter-gen','starter-gen'),src:!F.g2,fail:!!F.g2},
      {id:'lbus',r:1,x:.12,k:'bus',l:T('L GEN BUS','V GEN-SKINNE'),s:T('28 V DC','28 V DC'),fail:!!F.bus,w:T('Left generator bus','Venstre generatorskinne')},
      {id:'cbus',r:1,x:.5,k:'bus',l:T('BATT BUS','BATT-SKINNE'),s:T('bus ties','skinnebrytere')},
      {id:'rbus',r:1,x:.88,k:'bus',l:T('R GEN BUS','H GEN-SKINNE'),s:T('28 V DC','28 V DC'),w:T('Right generator bus','Høyre generatorskinne')},
      {id:'inv1',r:2,x:.29,k:'bus',l:T('INV 1','INV 1'),s:T('DC→AC','DC→AC'),fail:!!F.inv,off:A.inv!==1&&!F.inv},
      {id:'ess',r:2,x:.5,k:'bus',l:T('ESS BUS','ESS-SKINNE'),s:T('triple-fed','trippelmatet'),w:T('Essential bus (fed from three sides)','Essensiell skinne (matet fra tre sider)')},
      {id:'inv2',r:2,x:.71,k:'bus',l:T('INV 2','INV 2'),s:T('DC→AC','DC→AC'),off:A.inv!==2},
      {id:'gear',r:3,x:.09,k:'use',l:T('GEAR PUMP\nFLAPS','UNDERSTELL\nFLAPS'),w:T('Gear hydraulic pump and flaps','Understellspumpe og flaps')},
      {id:'ac',r:3,x:.3,k:'use',l:T('AC BUS','AC-SKINNE'),s:T('115/26 V 400 Hz','115/26 V 400 Hz'),w:T('AC instruments (torque, fuel flow)','AC-instrumenter (dreiemoment, forbruk)')},
      {id:'avio',r:3,x:.52,k:'use',l:T('AVIONICS','AVIONIKK'),w:T('Avionics and flight instruments','Avionikk og flyinstrumenter')},
      {id:'heat',r:3,x:.88,k:'use',l:T('PROP &\nW/S HEAT','PROP- OG\nRUTEVARME'),w:T('Propeller and windshield heat','Propell- og frontrutevarme'),off:!!A.shed}];
    const edges=[E('gen1','lbus'),E('gen2','rbus'),E('bat','cbus',{bi:true}),E('lbus','cbus',{bi:true}),E('rbus','cbus',{bi:true}),
      E('lbus','ess',{par:true,ym:.38}),E('cbus','ess',{par:true}),E('rbus','ess',{par:true,ym:.38}),E('lbus','inv1',{ym:.66}),E('rbus','inv2',{ym:.66}),
      E('inv1','ac',{}),E('inv2','ac',{ym:.6}),E('lbus','gear',{par:true,ax:.09}),E('ess','avio',{par:true,bx:.52}),E('rbus','heat',{par:true})];
    const R=mk(nodes,edges,['gen1','gen2','bat']); const n=(R.lv.gen1?1:0)+(R.lv.gen2?1:0);
    R.info={nGen:n,battOnly:n===0,cfg:n===2?'normal':n===1?'one':'batt',acLost:!R.lv.ac};
    if(n===0) R.nodes.find(x=>x.id==='bat').warn=true;
    if(n===1&&!A.shed) R.nodes.find(x=>x.id==='heat').warn=true;
    return R; }
  /* jet transport: 115 V 400 Hz AC, generators never in parallel */
  const g1ok=!F.g1&&!F.dual, g2ok=!F.g2&&!F.dual, apu=!!A.apu, acGen=g1ok||g2ok||apu;
  const ratOut=!acGen, emer=ratOut&&!F.emer;
  const nodes=[
    {id:'gen1',r:0,x:.1,k:'src',l:T('GEN 1','GEN 1'),s:T('IDG 115 V AC','IDG 115 V AC'),src:g1ok,fail:!!F.g1||!!F.dual},
    {id:'apu',r:0,x:.34,k:'src',l:T('APU GEN','APU-GEN'),s:apu?T('on line','tilkoblet'):T('off','av'),src:apu,off:!apu},
    {id:'rat',r:0,x:.64,k:'src',l:T('EMER GEN','NØDGEN'),s:T('RAT','RAT'),src:emer,off:!ratOut,fail:ratOut&&!!F.emer},
    {id:'gen2',r:0,x:.9,k:'src',l:T('GEN 2','GEN 2'),s:T('IDG 115 V AC','IDG 115 V AC'),src:g2ok,fail:!!F.g2||!!F.dual},
    {id:'ac1',r:1,x:.16,k:'bus',l:T('AC BUS 1','AC-SKINNE 1'),fail:!!F.bus,w:T('AC bus 1 (galley, pumps, side 1)','AC-skinne 1 (bysse, pumper, side 1)')},
    {id:'acess',r:1,x:.5,k:'bus',l:T('AC ESS','AC ESS'),w:T('AC essential bus (one PFD set, one radio)','AC essensiell skinne (ett sett PFD, én radio)')},
    {id:'ac2',r:1,x:.84,k:'bus',l:T('AC BUS 2','AC-SKINNE 2'),w:T('AC bus 2 (galley, pumps, side 2)','AC-skinne 2 (bysse, pumper, side 2)')},
    {id:'tr1',r:2,x:.16,k:'bus',l:T('TR 1','TR 1'),s:T('AC→28 V DC','AC→28 V DC'),fail:!!F.tr},
    {id:'esstr',r:2,x:.5,k:'bus',l:T('ESS TR','ESS TR'),off:!(F.tr||!acGen)},
    {id:'inv',r:2,x:.68,k:'bus',l:T('STAT INV','STAT INV'),s:T('DC→AC','DC→AC'),off:acGen||emer},
    {id:'tr2',r:2,x:.86,k:'bus',l:T('TR 2','TR 2'),s:T('AC→28 V DC','AC→28 V DC')},
    {id:'dc1',r:3,x:.16,k:'bus',l:T('DC BUS 1','DC-SKINNE 1'),w:T('DC bus 1','DC-skinne 1')},
    {id:'dcess',r:3,x:.5,k:'bus',l:T('DC ESS','DC ESS'),w:T('DC essential bus','DC essensiell skinne')},
    {id:'bat',r:3,x:.68,k:'src',l:T('BAT 1+2','BAT 1+2'),s:T('28 V DC','28 V DC'),src:true},
    {id:'dc2',r:3,x:.86,k:'bus',l:T('DC BUS 2','DC-SKINNE 2'),w:T('DC bus 2','DC-skinne 2')}];
  const edges=[E('gen1','ac1'),E('gen2','ac2'),E('apu','ac1',{g:!g1ok,ym:.45}),E('apu','ac2',{g:!g2ok,ym:.3}),
    E('ac1','ac2',{bi:true,g:(!g1ok||!g2ok)&&!apu,oy:-.25,tie:true}),E('rat','acess',{}),
    E('ac1','acess',{oy:.25}),E('ac2','acess',{oy:.25}),
    E('ac1','tr1'),E('ac2','tr2'),E('acess','esstr',{g:!!(F.tr||!acGen)}),E('tr1','dc1'),E('tr2','dc2'),
    E('dc1','dc2',{bi:true,g:!!F.tr,oy:.35,tie:true}),E('dc1','dcess',{g:!F.tr&&acGen,oy:-.25}),E('esstr','dcess',{g:!!(F.tr||!acGen)}),
    E('bat','dcess',{bi:true}),E('bat','inv',{g:!acGen&&!emer}),E('inv','acess',{g:!acGen&&!emer,ob:.45})];
  const R=mk(nodes,edges,['gen1','gen2','apu','rat','bat']);
  const n=(g1ok?1:0)+(g2ok?1:0);
  R.info={nGen:n,apu,ratOut,emer,battOnly:!acGen&&!emer,cfg:acGen?(n===2?'normal':'one'):emer?'emer':'batt',acLive:!!(R.lv.ac1||R.lv.ac2)};
  if(R.info.battOnly) R.nodes.find(x=>x.id==='bat').warn=true;
  return R;
}

/* ---------- hydraulics ---------- */
const HC={1:'h1',2:'h2',3:'h3'};
function hyd(cls,F,A,EL){
  if(cls==='pist'){
    const bus=!!EL.lv.bus;
    const nodes=[
      {id:'bus',r:0,x:.16,k:'src',l:T('MAIN BUS','HOVEDSKINNE'),s:T('electric','elektrisk'),src:bus,c:'el'},
      {id:'pp',r:1,x:.16,k:'pump',l:T('POWER PACK','KRAFTPAKKE'),s:F.leak?T('NO FLUID','INGEN VÆSKE'):T('motor-pump','motorpumpe'),fail:!!F.pp||!!F.leak,w:T('Electro-hydraulic power pack','Elektrohydraulisk kraftpakke')},
      {id:'hand',r:1,x:.42,k:'ctl',l:T('HAND PUMP','HÅNDPUMPE'),s:T('emergency','nød'),src:!!A.hand&&!F.leak,off:!A.hand},
      {id:'gear',r:2,x:.29,k:'use',l:T('GEAR\nACTUATORS','UNDERSTELLS-\nAKTUATORER'),w:T('Gear retraction and extension','Inn- og utfelling av understellet')},
      {id:'pedL',r:0,x:.66,k:'ctl',l:T('L PEDAL','V PEDAL'),s:T('toe brake','tåbrems'),src:true},
      {id:'pedR',r:0,x:.9,k:'ctl',l:T('R PEDAL','H PEDAL'),s:T('toe brake','tåbrems'),src:true},
      {id:'mcL',r:1,x:.66,k:'pump',l:T('MASTER CYL','HOVEDSYL.'),s:F.bleak?T('LEAK','LEKKASJE'):T('own reservoir','eget reservoar'),fail:!!F.bleak},
      {id:'mcR',r:1,x:.9,k:'pump',l:T('MASTER CYL','HOVEDSYL.'),s:T('own reservoir','eget reservoar')},
      {id:'brL',r:2,x:.66,k:'use',l:T('L BRAKE','V BREMS'),w:T('Left wheel brake','Venstre hjulbrems')},
      {id:'brR',r:2,x:.9,k:'use',l:T('R BRAKE','H BREMS'),w:T('Right wheel brake','Høyre hjulbrems')}];
    const edges=[E('bus','pp',{c:'el'}),E('pp','gear',{bx:.25}),E('hand','gear',{bx:.35,dash:true}),E('pedL','mcL',{c:'mech'}),E('pedR','mcR',{c:'mech'}),E('mcL','brL'),E('mcR','brR')];
    const R=mk(nodes,edges,['bus','hand','pedL','pedR']); R.info={gear:!!R.lv.gear,brakes:(R.lv.brL?1:0)+(R.lv.brR?1:0),qty:F.leak?0:1};
    return R; }
  if(cls==='tp'){
    const p1=!F.p1&&!F.e1, p2=!F.p2;
    const nodes=[
      {id:'p1',r:0,x:.16,k:'pump',l:T('PUMP 1','PUMPE 1'),s:T('engine-driven','motordrevet'),src:p1,fail:!!F.p1},
      {id:'p2',r:0,x:.84,k:'pump',l:T('PUMP 2','PUMPE 2'),s:T('engine-driven','motordrevet'),src:p2,fail:!!F.p2},
      {id:'sys',r:1,x:.5,wf:.46,k:'sys',l:T('HYD SYSTEM','HYD-SYSTEM'),s:F.leak?T('LO QTY · 0 psi','LAV MENGDE · 0 psi'):T('3000 psi','3000 psi'),fail:!!F.leak,lvl:F.leak?0.05:0.8,c:'h1',w:T('Hydraulic system','Hydraulikksystem')},
      {id:'acc',r:1,x:.92,k:'acc',l:T('BRAKE ACC','BREMSEAKK.'),s:T('stored','lagret'),src:true},
      {id:'gear',r:2,x:.1,k:'use',l:T('GEAR','UNDERSTELL'),w:T('Gear retraction and normal extension','Inn- og normal utfelling av understell')},
      {id:'flaps',r:2,x:.32,k:'use',l:T('FLAPS','FLAPS'),w:T('Flaps','Flaps')},
      {id:'nws',r:2,x:.54,k:'use',l:T('NOSE\nSTEERING','NESEHJULS-\nSTYRING'),w:T('Nosewheel steering','Nesehjulsstyring')},
      {id:'brk',r:2,x:.76,k:'use',l:T('BRAKES','BREMSER'),w:T('Wheel brakes','Hjulbremser')}];
    const edges=[E('p1','sys',{bx:.33}),E('p2','sys',{bx:.67}),E('sys','acc',{bi:true}),E('sys','gear',{par:true,ax:.32}),E('sys','flaps',{par:true,ax:.36}),E('sys','nws',{par:true,ax:.54}),E('sys','brk',{par:true,ax:.68}),E('acc','brk',{g:false})];
    const R0=mk(nodes,edges,['p1','p2']); const sysOk=!!R0.lv.sys;
    edges[edges.length-1].g=!sysOk;
    const R=mk(nodes,edges,['p1','p2','acc']);
    if(!sysOk){ R.nodes.find(n=>n.id==='acc').warn=true; R.nodes.find(n=>n.id==='brk').warn=true; }
    R.info={sys:sysOk,pumps:(p1?1:0)+(p2?1:0),gear:!!R.lv.gear}; return R; }
  /* jet: three independent systems, PTU between 1 and 2, RAT on 3 */
  const e1=!F.dual&&!F.e1, e2=!F.dual, ac=!!EL.info.acLive, rat=!!EL.info.ratOut||!!F.dual;
  const l1=!!F.leak, l2=!!F.leak2;
  const ptuG=!!A.ptu&&!l1&&!l2;
  const nodes=[
    {id:'edp1',r:0,x:.12,k:'pump',l:T('EDP 1','EDP 1'),s:T('engine 1','motor 1'),src:e1&&!F.p1,fail:!!F.p1||!e1,c:'h1'},
    {id:'edp2',r:0,x:.5,k:'pump',l:T('EDP 2','EDP 2'),s:T('engine 2','motor 2'),src:e2&&!F.p2,fail:!!F.p2||!e2,c:'h2'},
    {id:'ep3',r:0,x:.72,k:'pump',l:T('E-PUMP 3','E-PUMPE 3'),s:T('electric','elektrisk'),src:ac&&!F.ep3,fail:!!F.ep3||!ac,c:'h3'},
    {id:'rat',r:0,x:.92,k:'pump',l:T('RAT','RAT'),s:rat?T('deployed','ute'):T('stowed','inne'),src:rat,off:!rat,c:'h3'},
    {id:'s1',r:1,x:.12,k:'sys',l:T('SYSTEM 1','SYSTEM 1'),s:l1?T('LO QTY','LAV MENGDE'):T('3000 psi','3000 psi'),fail:l1,lvl:l1?0.05:0.8,c:'h1',w:T('Hydraulic system 1','Hydraulikksystem 1')},
    {id:'ptu',r:1,x:.31,k:'valve',l:T('PTU','PTU'),s:T('power transfer','kraftoverføring'),off:!ptuG,c:'h1'},
    {id:'s2',r:1,x:.5,k:'sys',l:T('SYSTEM 2','SYSTEM 2'),s:l2?T('LO QTY','LAV MENGDE'):T('3000 psi','3000 psi'),fail:l2,lvl:l2?0.05:0.8,c:'h2',w:T('Hydraulic system 2','Hydraulikksystem 2')},
    {id:'s3',r:1,x:.82,k:'sys',l:T('SYSTEM 3','SYSTEM 3'),s:T('3000 psi','3000 psi'),lvl:0.8,c:'h3',w:T('Hydraulic system 3','Hydraulikksystem 3')},
    {id:'gear',r:2,x:.08,k:'use',l:T('GEAR','UNDERSTELL'),w:T('Gear (normal extension and retraction)','Understell (normal ut- og innfelling)'),hs:[1]},
    {id:'fc',r:2,x:.3,k:'use',l:T('FLIGHT\nCONTROLS','FLY-\nKONTROLLER'),w:T('Primary flight controls (each surface ≥ 2 systems)','Primære flykontroller (hver flate ≥ 2 systemer)'),hs:[1,2,3]},
    {id:'brk',r:2,x:.52,k:'use',l:T('BRAKES','BREMSER'),s:T('1 normal · 2 alt','1 normal · 2 alt'),w:T('Wheel brakes (normal 1, alternate 2)','Hjulbremser (normal 1, alternativ 2)'),hs:[1,2]},
    {id:'nws',r:2,x:.71,k:'use',l:T('NOSE\nSTEERING','NESEHJULS-\nSTYRING'),w:T('Nosewheel steering','Nesehjulsstyring'),hs:[2]},
    {id:'flaps',r:2,x:.9,k:'use',l:T('FLAPS\nSLATS','FLAPS\nSLATS'),w:T('Flaps and slats','Flaps og slats'),hs:[1,2]}];
  const edges=[E('edp1','s1',{c:'h1'}),E('edp2','s2',{c:'h2'}),E('ep3','s3',{c:'h3',bx:.78}),E('rat','s3',{c:'h3',bx:.87}),
    E('s1','ptu',{bi:true,c:'h1'}),E('ptu','s2',{bi:true,c:'h2'}),
    E('s1','gear',{par:true,c:'h1',ax:.07,ym:.3}),E('s1','fc',{par:true,c:'h1',ax:.15,bx:.27,ym:.3}),E('s1','brk',{par:true,c:'h1',ax:.17,bx:.5,ym:.3}),E('s1','flaps',{par:true,c:'h1',ax:.165,bx:.88,ym:.3}),
    E('s2','fc',{par:true,c:'h2',ax:.47,bx:.3,ym:.55}),E('s2','brk',{par:true,c:'h2',ax:.5,bx:.54,ym:.55}),E('s2','nws',{par:true,c:'h2',ax:.53,ym:.55}),E('s2','flaps',{par:true,c:'h2',ax:.535,bx:.92,ym:.55}),
    E('s3','fc',{par:true,c:'h3',bx:.33,ym:.8})];
  const R=mk(nodes,edges,['edp1','edp2','ep3','rat']);
  const live={1:!!R.lv.s1,2:!!R.lv.s2,3:!!R.lv.s3};
  R.nodes.forEach(n=>{ if(n.hs) n.dots=n.hs.map(h=>[HC[h],live[h]]); });
  const ptuRun=R.edges.some(e=>(e.a==='s1'&&e.b==='ptu'||e.a==='ptu'&&e.b==='s2')&&e.on)&&!!R.lv.ptu&&!(R.lv.edp1&&R.lv.edp2);
  R.info={sys:live,lost:[1,2,3].filter(h=>!live[h]).length,ptuRun,rat};
  if(ptuRun) R.nodes.find(n=>n.id==='ptu').warn=true;
  return R;
}

/* ---------- fuel ---------- */
/* which tanks feed which engine: {e1:{run, from:{tank:share}, suction}, e2:...} */
function feed(cls,F,A,Q,EL){
  const has=t=>Q[t]>0.5, out={e1:{run:false,from:{},suction:false},e2:{run:false,from:{},suction:false}};
  if(cls==='pist'){
    const bus=!!EL.lv.bus;
    [['e1','selL','aux1','edp1','L','R'],['e2','selR','aux2','edp2','R','L']].forEach(([e,sel,aux,edp,own,opp])=>{
      const s=A[sel], t=s==='on'?own:s==='x'?opp:null, pump=!F[edp]||(A[aux]&&bus), stop=e==='e1'?F.e1:F.e2;
      if(t&&has(t)&&pump&&!stop){ out[e].run=true; out[e].from[t]=1; } });
    return out; }
  if(cls==='tp'){
    const bp={L:A.bL&&!F.bp,R:A.bR}, side={e1:'L',e2:'R'};
    for(const e of ['e1','e2']){ const s=side[e], fw=e==='e1'?A.fwL!==false:true, stop=e==='e1'?F.e1:F.e2; if(stop||!fw) continue;
      if(A.xf){ const src=['L','R'].filter(t=>bp[t]&&has(t)); if(src.length){ out[e].run=true; src.forEach(t=>{ out[e].from[t]=1/src.length; }); continue; } }
      if(has(s)){ out[e].run=true; out[e].from[s]=1; if(!bp[s]) out[e].suction=true; } }
    return out; }
  const pw={L:A.pL&&!F.lp,R:A.pR}, ctr=A.ctr&&!F.cp&&has('C'), side={e1:'L',e2:'R'};
  for(const e of ['e1','e2']){ const s=side[e], stop=e==='e1'?(F.e1||F.dual):F.dual; if(stop) continue;
    if(ctr){ out[e].run=true; out[e].from.C=1; continue; }
    if(A.xf){ const src=['L','R'].filter(t=>pw[t]&&has(t)); if(src.length){ out[e].run=true; src.forEach(t=>{ out[e].from[t]=1/src.length; }); continue; } }
    if(has(s)){ out[e].run=true; out[e].from[s]=1; if(!pw[s]) out[e].suction=true; } }
  return out;
}
/* advance the fuel by dt hours: engines burn from their tanks, a leak drains the left tank, jettison drains all to a reserve */
function fuelStep(cls,F,A,Q,EL,dt){
  const fm=feed(cls,F,A,Q,EL), b=BURN[cls];
  for(const e of ['e1','e2']){ const f=fm[e]; if(!f.run) continue; for(const t in f.from) Q[t]=Math.max(0,Q[t]-b*f.from[t]*dt); }
  if(F.leak) Q.L=Math.max(0,Q.L-b*2.4*dt);
  if(cls==='jet'&&A.jett){ for(const t in Q){ const keep=t==='C'?0:2200; if(Q[t]>keep) Q[t]=Math.max(keep,Q[t]-b*30*dt*(t==='C'?1.2:1)); } }
  return fm;
}
function fuel(cls,F,A,Q,EL){
  const fm=feed(cls,F,A,Q,EL), cap=CAP[cls], L=t=>Math.max(0,Math.min(1,Q[t]/cap[t])), u=UNIT[cls];
  const qs=t=>Math.round(Q[t])+' '+u;
  const eng=(id,x,e,n,r)=>({id,r,x,k:'use',l:T(n[0],n[1]),s:fm[e].run?(fm[e].suction?T('suction feed','sugemating'):T('running','går')):((e==='e1'&&(F.e1||F.dual))||(e==='e2'&&F.dual)?T('SHUT DOWN','STANSET'):T('NO FUEL','IKKE BRENNSTOFF')),
    fail:!fm[e].run,warn:fm[e].suction,w:T(n[2],n[3])});
  if(cls==='pist'){
    const bus=!!EL.lv.bus;
    const nodes=[
      {id:'tL',r:0,x:.14,k:'tank',l:T('L TANK','V TANK'),s:T(qs('L'),qs('L')),lvl:L('L'),src:Q.L>0.5,fail:!!F.leak&&false,warn:!!F.leak},
      {id:'tR',r:0,x:.86,k:'tank',l:T('R TANK','H TANK'),s:T(qs('R'),qs('R')),lvl:L('R'),src:Q.R>0.5},
      {id:'selL',r:1,x:.14,k:'valve',l:T('SELECTOR L','VELGER V'),s:A.selL==='on'?T('ON','PÅ'):A.selL==='x'?T('X-FEED','KRYSS'):T('OFF','AV'),off:A.selL==='off'},
      {id:'xf',r:1,x:.5,k:'valve',l:T('X-FEED','KRYSSMATING'),s:A.selL==='x'||A.selR==='x'?T('in use','i bruk'):T('closed','stengt'),off:!(A.selL==='x'||A.selR==='x')},
      {id:'selR',r:1,x:.86,k:'valve',l:T('SELECTOR R','VELGER H'),s:A.selR==='on'?T('ON','PÅ'):A.selR==='x'?T('X-FEED','KRYSS'):T('OFF','AV'),off:A.selR==='off'},
      {id:'edp1',r:2,x:.06,k:'pump',l:T('ENG PUMP','MOT.PUMPE'),fail:!!F.edp1},
      {id:'aux1',r:2,x:.25,k:'pump',l:T('AUX PUMP','EKSTRAPUMPE'),s:T('electric','elektrisk'),off:!(A.aux1&&bus)},
      {id:'aux2',r:2,x:.75,k:'pump',l:T('AUX PUMP','EKSTRAPUMPE'),s:T('electric','elektrisk'),off:!(A.aux2&&bus)},
      {id:'edp2',r:2,x:.94,k:'pump',l:T('ENG PUMP','MOT.PUMPE')},
      eng('eL',.14,'e1',['ENGINE 1','MOTOR 1','Engine 1','Motor 1'],3), eng('eR',.86,'e2',['ENGINE 2','MOTOR 2','Engine 2','Motor 2'],3)];
    const x1=A.selR==='x', x2=A.selL==='x';
    const edges=[E('tL','selL',{g:A.selL==='on'}),E('tR','selR',{g:A.selR==='on'}),E('tL','xf',{g:x1,ym:.35,ax:.2}),E('tR','xf',{g:x2,ym:.35,ax:-.2}),E('xf','selL',{g:x2}),E('xf','selR',{g:x1}),
      E('selL','edp1',{bx:.06}),E('selL','aux1',{g:!!A.aux1}),E('selR','aux2',{g:!!A.aux2}),E('selR','edp2',{bx:.94}),
      E('edp1','eL',{par:true,bx:.11}),E('aux1','eL',{par:true,bx:.17}),E('aux2','eR',{par:true,bx:.83}),E('edp2','eR',{par:true,bx:.89})];
    const R=mk(nodes,edges,['tL','tR']); gateEngines(R,fm); R.info={fm,imb:Q.L-Q.R,unit:u}; return R; }
  if(cls==='tp'){
    const bpL=A.bL&&!F.bp, bpR=A.bR;
    const nodes=[
      {id:'tL',r:0,x:.14,k:'tank',l:T('L TANKS','V TANKER'),s:T(qs('L'),qs('L')),lvl:L('L'),src:Q.L>0.5,warn:!!F.leak},
      {id:'tR',r:0,x:.86,k:'tank',l:T('R TANKS','H TANKER'),s:T(qs('R'),qs('R')),lvl:L('R'),src:Q.R>0.5},
      {id:'bL',r:1,x:.14,k:'pump',l:T('BOOST PUMP','BOOSTPUMPE'),s:T('electric','elektrisk'),fail:!!F.bp,off:!A.bL&&!F.bp},
      {id:'xf',r:1,x:.5,k:'valve',l:T('X-FEED','KRYSSMATING'),s:A.xf?T('open','åpen'):T('closed','stengt'),off:!A.xf},
      {id:'bR',r:1,x:.86,k:'pump',l:T('BOOST PUMP','BOOSTPUMPE'),s:T('electric','elektrisk'),off:!A.bR},
      {id:'fwL',r:2,x:.14,k:'valve',l:T('FIREWALL\nVALVE','BRANNSKOTT-\nVENTIL'),off:A.fwL===false},
      {id:'fwR',r:2,x:.86,k:'valve',l:T('FIREWALL\nVALVE','BRANNSKOTT-\nVENTIL')},
      eng('eL',.14,'e1',['ENGINE 1','MOTOR 1','Engine 1','Motor 1'],3), eng('eR',.86,'e2',['ENGINE 2','MOTOR 2','Engine 2','Motor 2'],3)];
    const edges=[E('tL','bL'),E('tR','bR'),E('bL','fwL',{g:!A.xf}),E('bR','fwR',{g:!A.xf}),
      E('bL','xf',{g:!!A.xf}),E('bR','xf',{g:!!A.xf}),E('xf','fwL',{g:!!A.xf,par:true}),E('xf','fwR',{g:!!A.xf,par:true}),
      E('tL','fwL',{rt:'side',sx:.03,g:fm.e1.suction,dash:true}),E('tR','fwR',{rt:'side',sx:.97,g:fm.e2.suction,dash:true}),
      E('fwL','eL'),E('fwR','eR')];
    const R=mk(nodes,edges,['tL','tR']); gateEngines(R,fm); R.info={fm,imb:Q.L-Q.R,unit:u}; return R; }
  const ctr=A.ctr&&!F.cp&&Q.C>0.5, pL=A.pL&&!F.lp, pR=A.pR;
  const nodes=[
    {id:'tL',r:0,x:.12,k:'tank',l:T('L WING','V VINGE'),s:T(qs('L'),qs('L')),lvl:L('L'),src:Q.L>0.5,warn:!!F.leak},
    {id:'tC',r:0,x:.5,k:'tank',l:T('CENTRE','SENTER'),s:T(qs('C'),qs('C')),lvl:L('C'),src:Q.C>0.5,warn:!!F.cp&&Q.C>0.5},
    {id:'tR',r:0,x:.88,k:'tank',l:T('R WING','H VINGE'),s:T(qs('R'),qs('R')),lvl:L('R'),src:Q.R>0.5},
    {id:'pL',r:1,x:.12,k:'pump',l:T('L PUMPS','V PUMPER'),s:T('2 × boost','2 × boost'),fail:!!F.lp,off:!A.pL&&!F.lp},
    {id:'pC',r:1,x:.5,k:'pump',l:T('CTR PUMPS','SENT.PUMPER'),s:ctr?T('override','overstyrer'):T('2 × boost','2 × boost'),fail:!!F.cp,off:(!A.ctr||Q.C<=0.5)&&!F.cp},
    {id:'pR',r:1,x:.88,k:'pump',l:T('R PUMPS','H PUMPER'),s:T('2 × boost','2 × boost'),off:!A.pR},
    {id:'lpL',r:2,x:.12,k:'valve',l:T('LP VALVE','LP-VENTIL'),off:!!F.e1||!!F.dual},
    {id:'xf',r:2,x:.5,k:'valve',l:T('X-FEED','KRYSSMATING'),s:A.xf?T('open','åpen'):T('closed','stengt'),off:!A.xf},
    {id:'jett',r:3,x:.5,k:'use',dp:1,l:T('JETTISON','DUMPING'),s:T('where fitted','der det finnes'),off:!A.jett},
    {id:'lpR',r:2,x:.88,k:'valve',l:T('LP VALVE','LP-VENTIL'),off:!!F.dual},
    eng('eL',.12,'e1',['ENGINE 1','MOTOR 1','Engine 1','Motor 1'],3), eng('eR',.88,'e2',['ENGINE 2','MOTOR 2','Engine 2','Motor 2'],3)];
  const edges=[E('tL','pL'),E('tC','pC'),E('tR','pR'),
    E('pC','lpL',{g:ctr,ax:-.5,ym:.25}),E('pC','lpR',{g:ctr,ax:.5,ym:.25}),
    E('pL','lpL',{g:!ctr&&!A.xf}),E('pR','lpR',{g:!ctr&&!A.xf}),
    E('pL','xf',{g:!ctr&&!!A.xf,ym:.65}),E('pR','xf',{g:!ctr&&!!A.xf,ym:.65}),E('xf','lpL',{g:!ctr&&!!A.xf,par:true}),E('xf','lpR',{g:!ctr&&!!A.xf,par:true}),
    E('tL','lpL',{rt:'side',sx:.025,g:fm.e1.suction,dash:true}),E('tR','lpR',{rt:'side',sx:.975,g:fm.e2.suction,dash:true}),
    E('lpL','eL'),E('lpR','eR'),
    E('pL','jett',{g:!!A.jett,par:true,ax:.3,ym:.82,dp:1}),E('pR','jett',{g:!!A.jett,par:true,ax:-.3,ym:.82,dp:1}),E('pC','jett',{g:!!A.jett,par:true,rt:'side',sx:.62,dp:1})];
  const R=mk(nodes,edges,['tC','tL','tR']); gateEngines(R,fm); R.info={fm,imb:Q.L-Q.R,unit:u,ctr}; return R;
}
/* an engine is lit only when the feed logic says it runs (the network may reach it, but a shut-down engine burns nothing) */
function gateEngines(R,fm){ const m={eL:'e1',eR:'e2'}; R.nodes.forEach(n=>{ if(m[n.id]){ const r=fm[m[n.id]].run; n.live=r; R.lv[n.id]=r; } });
  R.edges.forEach(e=>{ if(m[e.b]&&!fm[m[e.b]].run) e.on=false; }); }

/* ---------- flight controls ---------- */
function law(F,HY){ if(F.allc) return 'mech'; if(F.comp) return 'direct'; if(F.adr||(HY&&HY.info.lost>=2)) return 'alt'; return 'normal'; }
function fc(cls,F,A,EL,HY){
  if(cls==='pist'){
    const bus=!!EL.lv.bus, run=!!F.trim&&!A.trimOff;
    const nodes=[
      {id:'yoke',r:0,x:.2,k:'ctl',l:T('YOKE','RATT'),src:true},
      {id:'ped',r:0,x:.5,k:'ctl',l:T('PEDALS','PEDALER'),src:true},
      {id:'trimw',r:0,x:.8,k:'ctl',l:T('TRIM WHEEL','TRIMHJUL'),s:T('manual','manuell'),src:true},
      {id:'cab',r:1,x:.32,wf:.5,k:'mech',l:T('CABLES · PUSHRODS','KABLER · STAGER'),s:T('no power needed','trenger ingen kraft')},
      {id:'tm',r:1,x:.8,k:'pump',l:T('ELEC TRIM','EL. TRIM'),s:run?T('RUNAWAY','LØPSK'):A.trimOff?T('disconnected','frakoblet'):T('motor','motor'),src:bus&&!A.trimOff,off:A.trimOff||!bus,warn:run,c:'el'},
      {id:'ail',r:2,x:.1,k:'use',l:T('AILERONS','BALANSERORER'),w:T('Ailerons (roll)','Balanseror (rull)')},
      {id:'elev',r:2,x:.32,k:'use',l:T('ELEVATOR','HØYDEROR'),fail:!!F.cable,s:F.cable?T('DISCONNECTED','FRAKOBLET'):null,w:T('Elevator (pitch)','Høyderor (stamp)')},
      {id:'rud',r:2,x:.54,k:'use',l:T('RUDDER','SIDEROR'),w:T('Rudder (yaw)','Sideror (gir)')},
      {id:'tab',r:2,x:.8,k:'use',l:T('TRIM TAB','TRIMROR'),s:T('elevator','høyderor'),warn:run,w:T('Elevator trim tab','Trimror på høyderoret')}];
    const M={c:'mech'};
    const edges=[E('yoke','cab',{...M,bx:.22,par:true}),E('ped','cab',{...M,bx:.5,par:true}),E('cab','ail',{...M,par:true,ax:.1}),E('cab','elev',{...M,par:true}),E('cab','rud',{...M,par:true,ax:.54}),
      E('trimw','tab',{...M,rt:'side',sx:.97,par:true}),E('tm','tab',{c:'el',par:true})];
    const R=mk(nodes,edges,['yoke','ped','trimw','tm']); R.info={law:'mech',runaway:run}; return R; }
  if(cls==='tp'){
    const hy=!!HY.info.sys, run=!!F.trim&&!A.trimOff;
    const nodes=[
      {id:'yoke',r:0,x:.14,k:'ctl',l:T('YOKE','RATT'),src:true},
      {id:'ped',r:0,x:.4,k:'ctl',l:T('PEDALS','PEDALER'),src:true},
      {id:'trim',r:0,x:.88,k:'ctl',l:T('TRIM','TRIM'),s:run?T('RUNAWAY','LØPSK'):A.trimOff?T('manual only','bare manuell'):T('elec + manual','el. + manuell'),src:true,warn:run},
      {id:'cab',r:1,x:.3,wf:.44,k:'mech',l:T('CABLES','KABLER'),s:T('servo & spring tabs','servo- og fjærror')},
      {id:'hyd',r:1,x:.68,k:'sys',l:T('HYD SYSTEM','HYD-SYSTEM'),src:hy,fail:!hy,c:'h1'},
      {id:'ail',r:2,x:.08,k:'use',l:T('AILERONS','BALANSERORER'),w:T('Ailerons (with servo or spring tabs)','Balanseror (med servo- eller fjærror)')},
      {id:'spl',r:2,x:.28,k:'use',l:T('ROLL\nSPOILERS','RULLE-\nSPOILERE'),s:T('where fitted','der de finnes'),w:T('Roll spoilers (hydraulic, where fitted)','Rullespoilere (hydraulisk, der de finnes)'),dots:[['h1',hy]]},
      {id:'elev',r:2,x:.48,k:'use',l:T('ELEVATOR','HØYDEROR'),w:T('Elevator','Høyderor')},
      {id:'rud',r:2,x:.68,k:'use',l:T('RUDDER','SIDEROR'),s:T('spring tab','fjærror'),w:T('Rudder','Sideror')},
      {id:'tabs',r:2,x:.88,k:'use',l:T('TRIM TABS','TRIMROR'),warn:run,w:T('Trim tabs (pitch, roll, yaw)','Trimror (stamp, rull, gir)')}];
    const M={c:'mech'};
    const edges=[E('yoke','cab',{...M,bx:.17,par:true}),E('ped','cab',{...M,bx:.4,par:true}),E('cab','ail',{...M,par:true,ax:.08}),E('cab','spl',{c:'sig',par:true,ax:.26,ob:-.3}),E('cab','elev',{...M,par:true,ax:.46}),E('cab','rud',{...M,par:true,ax:.5,bx:.66}),
      E('hyd','spl',{c:'h1',ob:.3,ym:.6}),E('trim','tabs',{...M})];
    const R=mk(nodes,edges,['yoke','ped','trim','hyd']);
    const s=R.nodes.find(n=>n.id==='spl'); if(!hy){ s.live=false; R.lv.spl=false; s.fail=true; s.s=T('NO HYD','IKKE HYD'); R.edges.forEach(e=>{ if(e.b==='spl') e.on=false; }); }
    R.info={law:'mech',runaway:run,hyd:hy}; return R; }
  /* jet: fly-by-wire */
  const lw=law(F,HY), hs=HY.info.sys;
  const dots=a=>a.map(h=>[HC[h],!!hs[h]]);
  const surf=(id,x,l,hsy,w)=>({id,r:2,x,k:'use',l,hs:hsy,dots:dots(hsy),w});
  const nodes=[
    {id:'stick',r:0,x:.12,k:'ctl',l:T('SIDESTICK','SIDESTIKKE'),s:T('or yoke','eller ratt'),src:true},
    {id:'ped',r:0,x:.36,k:'ctl',l:T('PEDALS','PEDALER'),src:true},
    {id:'adc',r:0,x:.62,k:'src',l:T('AIR DATA\nIRS','LUFTDATA\nIRS'),s:F.adr?T('DISAGREE','UENIGE'):null,src:true,warn:!!F.adr,c:'sig'},
    {id:'tw',r:0,x:.88,k:'ctl',l:T('TRIM WHEEL','TRIMHJUL'),s:T('mech backup','mek. reserve'),src:true},
    {id:'fcc',r:1,x:.36,wf:.46,k:'sys',c:'sig',l:T('FLIGHT CONTROL COMPUTERS','FLYKONTROLLDATAMASKINER'),s:lw==='normal'?T('NORMAL LAW','NORMAL LOV'):lw==='alt'?T('ALTERNATE LAW','ALTERNATIV LOV'):lw==='direct'?T('DIRECT LAW','DIREKTE LOV'):T('ALL LOST','ALLE TAPT'),fail:!!F.allc,warn:lw==='alt'||lw==='direct'},
    surf('ail',.08,T('AILERONS','BALANSE-\nRORER'),[1,2],T('Ailerons','Balanseror')),
    surf('spl',.27,T('SPOILERS','SPOILERE'),[1,2,3],T('Spoilers (each panel on one system)','Spoilere (hvert panel på ett system)')),
    surf('elev',.46,T('ELEVATORS','HØYDEROR'),[1,2],T('Elevators','Høyderor')),
    surf('ths',.67,T('STAB TRIM','STAB-TRIM'),[1,2],T('Trimmable stabiliser','Trimbar stabilisator')),
    surf('rud',.88,T('RUDDER','SIDEROR'),[1,2,3],T('Rudder','Sideror'))];
  const S={c:'sig',par:true};
  const edges=[E('stick','fcc',{c:'sig',bx:.2,par:true}),E('ped','fcc',{c:'sig',bx:.36,par:true}),E('adc','fcc',{c:'sig',bx:.53,par:true}),
    E('fcc','ail',{...S,ax:.08}),E('fcc','spl',{...S,ax:.27}),E('fcc','elev',{...S,ax:.46}),E('fcc','ths',{...S,ax:.57,bx:.64}),E('fcc','rud',{...S,ax:.59,bx:.85,ym:.35}),
    E('tw','ths',{c:'mech',par:true,rt:'side',sx:.76,g:lw==='mech'}),E('ped','rud',{c:'mech',par:true,rt:'side',sx:.985,g:lw==='mech',ax:.3})];
  const R=mk(nodes,edges,['stick','ped','adc','tw']);
  /* a surface moves only with a signal (computers, or the mechanical backup) AND hydraulic power */
  R.nodes.forEach(n=>{ if(!n.hs) return; const pw=n.hs.some(h=>hs[h]), sig=lw==='mech'?(n.id==='ths'||n.id==='rud'):!!R.lv.fcc;
    if(!pw){ n.fail=true; n.s=T('NO HYD','IKKE HYD'); } else if(!sig){ n.s=T('no signal','ikke signal'); }
    n.live=pw&&sig; R.lv[n.id]=n.live; if(n.live&&n.hs.some(h=>!hs[h])) n.warn=true; });
  R.edges.forEach(e=>{ if(R.nodes.find(n=>n.id===e.b&&n.hs&&!n.live)) e.on=false; });
  R.info={law:lw}; return R;
}

/* ---------- landing gear and brakes ---------- */
function gear(cls,F,A,G,EL,HY){
  const pw=cls==='pist'?!!EL.lv.bus:cls==='tp'?!!HY.info.sys:!!HY.info.sys[1];
  const normal=pw&&!F.gf;
  const nodes=[
    {id:'lever',r:0,x:.1,k:'ctl',l:T('GEAR LEVER','UNDERSTELLS-\nSPAK'),s:A.lever==='down'?T('DOWN','NED'):T('UP','OPP'),src:true},
    {id:'pwr',r:0,x:.31,k:cls==='pist'?'bus':'sys',c:cls==='pist'?'el':'h1',l:cls==='pist'?T('MAIN BUS','HOVEDSKINNE'):cls==='tp'?T('HYD SYSTEM','HYD-SYSTEM'):T('SYSTEM 1','SYSTEM 1'),src:pw,fail:!pw},
    {id:'act',r:1,x:.2,k:'pump',c:cls==='pist'?'el':'h1',l:cls==='pist'?T('GEAR MOTOR','UNDERSTELLS-\nMOTOR'):T('ACTUATORS','AKTUATORER'),s:F.gf?T('JAMMED','LÅST'):T('uplocks · downlocks','opplåser · nedlåser'),fail:!!F.gf,w:T('Normal extension and retraction','Normal ut- og innfelling')},
    {id:'emer',r:1,x:.42,k:'ctl',l:T('EMERGENCY\nEXTENSION','NØDUT-\nFELLING'),s:cls==='pist'?T('free fall · crank','fritt fall · sveiv'):cls==='tp'?T('free fall','fritt fall'):T('gravity · crank','tyngdekraft · sveiv'),src:!!A.emer,off:!A.emer,w:T('Emergency extension (down only)','Nødutfelling (bare ned)')},
    {id:'legs',r:2,x:.25,wf:.32,k:'gear',l:T('LANDING GEAR','UNDERSTELL')}];
  const edges=[E('lever','act',{c:'sig',bx:.16}),E('pwr','act',{bx:.24,c:cls==='pist'?'el':'h1'}),E('act','legs',{bx:.2,c:cls==='pist'?'el':'h1'}),E('emer','legs',{c:'mech',bx:.38,dash:true})];
  let order=['lever','pwr','emer'];
  if(cls==='pist'){
    nodes.push({id:'ped',r:0,x:.75,k:'ctl',l:T('TOE BRAKES','TÅBREMSER'),src:true},
      {id:'mc',r:1,x:.75,k:'pump',l:T('MASTER CYLS','HOVEDSYL.'),s:T('one per side','én per side')},
      {id:'brk',r:2,x:.75,k:'use',l:T('WHEEL BRAKES','HJULBREMSER'),s:T('no anti-skid','ingen antiskrens'),w:T('Wheel brakes (pilot modulates, no anti-skid)','Hjulbremser (pilot doserer, ingen antiskrens)')});
    edges.push(E('ped','mc',{c:'mech'}),E('mc','brk',{c:'h1'})); order.push('ped'); }
  else if(cls==='tp'){
    const hy=!!HY.info.sys;
    nodes.push({id:'hy',r:0,x:.66,k:'sys',c:'h1',l:T('HYD SYSTEM','HYD-SYSTEM'),src:hy,fail:!hy},
      {id:'acc',r:0,x:.9,k:'acc',l:T('EMER BRAKE','NØDBREMS'),s:T('accumulator','akkumulator'),src:true,warn:!hy},
      {id:'ask',r:1,x:.66,k:'pump',c:'sig',l:T('ANTI-SKID','ANTISKRENS'),fail:!!F.ask,s:F.ask?T('FAULT','FEIL'):null,w:T('Anti-skid','Antiskrens')},
      {id:'brk',r:2,x:.78,k:'use',l:T('WHEEL BRAKES','HJULBREMSER'),w:T('Wheel brakes','Hjulbremser')});
    edges.push(E('hy','ask',{c:'h1'}),E('ask','brk',{c:'h1',bx:.74}),E('hy','brk',{c:'h1',rt:'side',sx:.55,g:!!F.ask,dash:true}),E('acc','brk',{c:'h1',bx:.85,g:!hy}));
    order.push('hy','acc'); }
  else {
    const h1=!!HY.info.sys[1]&&!F.bn, h2=!!HY.info.sys[2];
    nodes.push({id:'h1',r:0,x:.6,k:'sys',c:'h1',l:T('SYSTEM 1','SYSTEM 1'),s:F.bn?T('NORMAL LOST','NORMAL TAPT'):T('normal','normal'),src:h1,fail:!h1},
      {id:'h2',r:0,x:.78,k:'sys',c:'h2',l:T('SYSTEM 2','SYSTEM 2'),s:T('alternate','alternativ'),src:h2&&!h1,off:h1,fail:!h2},
      {id:'acc',r:0,x:.94,k:'acc',l:T('ACCU','AKKU'),s:T('park · backup','park · reserve'),src:true,warn:!h1&&!h2},
      {id:'ab',r:1,x:.88,k:'ctl',c:'sig',l:T('AUTOBRAKE','AUTOBREMS'),s:h1?(A.ab?T('armed','armert'):T('off','av')):T('LOST','TAPT'),src:h1&&!!A.ab,off:!(h1&&A.ab),w:T('Autobrake','Autobrems')},
      {id:'ask',r:1,x:.66,k:'pump',c:'sig',l:T('ANTI-SKID','ANTISKRENS'),fail:!!F.ask,s:F.ask?T('FAULT','FEIL'):null,w:T('Anti-skid','Antiskrens')},
      {id:'brk',r:2,x:.74,k:'use',l:T('WHEEL BRAKES','HJULBREMSER'),s:T('carbon','karbon'),w:T('Wheel brakes','Hjulbremser')});
    edges.push(E('h1','ask',{c:'h1',bx:.62}),E('h2','ask',{c:'h2',bx:.7}),E('ask','brk',{c:'h1',bx:.7}),E('ab','brk',{c:'sig',bx:.8}),
      E('h1','brk',{c:'h1',rt:'side',sx:.53,g:!!F.ask,dash:true}),E('acc','brk',{c:'h1',rt:'side',sx:.985,g:!h1&&!h2}));
    order.push('h1','h2','acc','ab'); }
  const R=mk(nodes,edges,order);
  if(cls!=='pist'&&F.ask){ const b=R.nodes.find(n=>n.id==='brk'); if(b.live) b.warn=true; }
  /* the gear legs: the UI moves G.pos; here only whether the normal system can move them */
  R.info={pw,normal,canRetract:normal&&!A.emer};
  return R;
}

/* everything at once (electrics first: the others depend on it) */
function solve(cls,st){
  const {F,A,Q,G}=st; const EL=elec(cls,F,A), HY=hyd(cls,F,A,EL);
  return {elec:EL,hyd:HY,fuel:fuel(cls,F,A,Q,EL),fc:fc(cls,F,A,EL,HY),gear:gear(cls,F,A,G||{},EL,HY)};
}

root.SYC={T,net,defaults,CAP,BURN,UNIT,elec,hyd,feed,fuelStep,fuel,law,fc,gear,solve};
})(typeof window!=='undefined'?window:globalThis);
