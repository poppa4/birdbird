/* Birdbird – Cessna 172 cockpit procedure trainer: page logic shared by c172.html (2D panel) and c172-3d.html (3D cockpit, beta).
   The 3D page sets data-d3 on <body> and loads cockpit3d.js + c172-3d.js; everything else is identical. */
(function(){
'use strict';
const {T,L,el,slider,visible,quiz,shuffle}=LAB;
const tr2=(en,no)=>({en,no});
LAB.add({},{
 '3D (beta)':'3D (beta)','Look around in a 3D cockpit (beta)':'Se deg rundt i en 3D-cockpit (beta)',
 'Birdbird Simulators':'Birdbird Simulatorer','Cessna 172 cockpit procedure trainer':'Cessna 172 prosedyretrener for cockpit',
 'A typical classic C172 with a carburetted 160 hp engine and an analog six-pack. Prime and start the engine, do the run-up and magneto check, fly a circuit, and practise carburettor ice, engine failure after take-off, vacuum and alternator failures and an ILS.':'En typisk klassisk C172 med 160 hk forgassermotor og analoge «six-pack»-instrumenter. Prim og start motoren, gjør run-up og magnetsjekk, fly en landingsrunde, og øv på forgasserising, motorstopp etter avgang, vakuum- og generatorsvikt og en ILS.',
 'Cockpit':'Cockpit','Flight controls':'Flykontroller','Failures':'Feil','How it works':'Slik virker det','Test yourself':'Test deg selv',
 'Procedures':'Prosedyrer','Limits':'Begrensninger','Lock view':'Lås visning','Locked':'Låst','Pause':'Pause','Resume':'Fortsett','Restart':'Start på nytt','More':'Mer','Sound on':'Lyd på','Sound off':'Lyd av','Touch stick':'Berøringsstikke','Full screen':'Fullskjerm','Outside view':'Utsikt','View out of the window':'Utsikt ut av vinduet','3D view is not available in this browser.':'3D-visning er ikke tilgjengelig i denne nettleseren.','← Whole panel':'← Hele panelet',
 'Rotate your device to landscape to use the cockpit.':'Snu enheten til liggende for å bruke cockpiten.',"For training only — follow the POH/AFM and your school's checklist.":'Kun for trening — følg POH/AFM og skolens sjekkliste.','Zoom to the next control':'Zoom til neste kontroll',
 'Fly it':'Fly','Drag either control wheel on the panel, use the keyboard, a gamepad, the touch stick or this pad.':'Dra i et av rattene på panelet, eller bruk tastaturet, en spillkontroll, berøringsstikka eller denne flaten.',
 'How to use the panel':'Slik bruker du panelet','Zoom':'Zoom','Click or tap an instrument to zoom to it; click outside it, press Esc or use ← Whole panel to go back. Pinch to zoom on a touch screen. Keys 0–9 jump between areas; Lock view and Panel area are in the … menu.':'Klikk eller trykk på et instrument for å zoome inn på det; klikk utenfor, trykk Esc eller bruk ← Hele panelet for å gå tilbake. Knip for å zoome på berøringsskjerm. Tastene 0–9 hopper mellom områdene; «Lås visning» og «Panelområde» finner du i …-menyen.',
 'Switches and knobs':'Brytere og knotter','Click a rocker or toggle to flip it. Push-pull knobs (carburettor heat, primer, cabin heat and air, parking brake) toggle in and out with a click. Drag the throttle and mixture down to pull them out, up to push them in.':'Klikk på en vippe- eller vippebryter for å slå den om. Trekk-skyv-knotter (forgasservarme, primer, kabinvarme og -luft, parkeringsbrems) går inn og ut med et klikk. Dra gass og blanding ned for å trekke dem ut, opp for å skyve dem inn.',
 'Ignition key':'Tenningsnøkkel','Click the key to step OFF → R → L → BOTH. Press and hold on START (or hold an arrow key at BOTH) to crank; it springs back to BOTH when you let go.':'Klikk på nøkkelen for å gå OFF → R → L → BOTH. Trykk og hold på START (eller hold en piltast på BOTH) for å starte; den fjærer tilbake til BOTH når du slipper.',
 'Radios and instrument knobs':'Radioer og instrumentknotter','Scroll on a knob or drag across it. On the double frequency knobs the outer ring changes MHz and the centre (or Shift) the decimals; ⇆ swaps standby and in-use. OBS knobs set the course, the altimeter knob the pressure setting.':'Rull på en knott eller dra over den. På de doble frekvensknottene endrer ytre ring MHz og midten (eller Shift) desimalene; ⇆ bytter standby og aktiv. OBS-knottene stiller kursen, høydemålerknotten trykkinnstillingen.',
 'Control wheel':'Ratt','Drag · releases to centre':'Dra · slipp for å sentrere','Assisted handling (attitude hold, auto-trim, rudder assist in the air)':'Assistert styring (attitydehold, auto-trim, sideror-hjelp i lufta)','Rudder and brakes':'Sideror og bremser','Hold for brakes':'Hold for bremser',
 'Make it harder':'Gjør det vanskeligere','Failures and weather':'Feil og vær','Engine':'Motor','Stop the engine, fail a magneto or foul a spark plug (watch the magneto check), or empty a tank.':'Stopp motoren, la en magnet svikte eller en tennplugg sote (se magnetsjekken), eller tøm en tank.',
 'Engine failure':'Motorstopp','Left magneto fails':'Venstre magnet svikter','Fouled plug (right mag)':'Sotet plugg (høyre magnet)','Left tank empty':'Venstre tank tom','Restore all':'Gjenopprett alt',
 'Systems':'Systemer','The vacuum pump drives the attitude and heading indicators; the alternator charges the battery.':'Vakuumpumpa driver horisonten og kursgyroen; generatoren lader batteriet.','Vacuum pump fails':'Vakuumpumpa svikter','Alternator fails':'Generatoren svikter','Weather':'Vær',
 'Understand':'Forstå','How the model works':'Slik virker modellen','Which Cessna 172?':'Hvilken Cessna 172?',
 'A typical classic C172: the carburetted 160 hp 172P-style aeroplane found at many clubs and schools, with a fixed-pitch propeller, flaps 0–30°, a split ALT/BAT master and a LOW VOLTAGE light. No autopilot (most trainers have none) and no rudder trim. On this model the fuel shutoff is the OFF position of the fuel selector; the separate red shutoff knob belongs to later fuel-injected 172s.':'En typisk klassisk C172: det forgasserdrevne 160 hk-flyet av 172P-typen som mange klubber og skoler har, med fast propell, flaps 0–30°, delt ALT/BAT-hovedbryter og LOW VOLTAGE-lys. Ingen autopilot (de fleste skolefly har ingen) og ingen sideror-trim. På denne modellen er drivstoffstengingen OFF-stillingen på drivstoffvelgeren; den egne røde stengeknotten hører til senere 172 med innsprøytning.',
 'Engine start':'Motorstart','A cold engine needs 2–3 primer strokes; a warm one little or none — over-priming floods it. Mixture rich, throttle open about ¼ inch, master on, clear the propeller, key to START. Release the key as soon as it fires and look for oil pressure within 30 seconds.':'En kald motor trenger 2–3 primerslag; en varm lite eller ingen — for mye priming drukner den. Blanding rik, gass åpen ca. ¼ tomme, hovedbryter på, klar propellen, nøkkel til START. Slipp nøkkelen så snart den tenner, og se etter oljetrykk innen 30 sekunder.',
 'Carburettor ice':'Forgasserising','Fuel evaporating in the venturi cools the air by up to about 20 °C, so ice can form in humid air even on a warm day — worst at reduced power. First sign: a slow RPM drop with a fixed-pitch propeller, then rough running. Carb heat: full hot. The engine runs rougher and loses more RPM while the ice melts, then recovers.':'Drivstoff som fordamper i venturien kjøler lufta med opptil ca. 20 °C, så is kan dannes i fuktig luft selv på en varm dag — verst på redusert effekt. Første tegn: et sakte turtallsfall med fast propell, så ujevn gange. Forgasservarme: helt på. Motoren går ujevnere og mister mer turtall mens isen smelter, og tar seg så opp igjen.',
 'Mixture and EGT':'Blanding og EGT','The carburettor runs richer as the air thins. Lean in cruise: pull the mixture slowly until the EGT peaks, then enrichen to about 50 °F rich of peak. Too lean: rough running and power loss. Full rich for take-off and landing at low-level aerodromes.':'Forgasseren går rikere når lufta blir tynnere. Len i marsj: trekk blandingen sakte til EGT topper seg, og gjør den så rikere til ca. 50 °F på rik side. For magert: ujevn gange og effekttap. Helt rik for avgang og landing på lavtliggende flyplasser.',
 'Magnetos':'Magneter','Two independent magnetos, each firing one plug per cylinder. At 1,700 RPM each magneto alone gives a small drop: max 125 RPM, max 50 RPM difference. No drop means a magneto that may not be grounding (a hot propeller); a big drop with rough running is a fouled plug or a faulty magneto.':'To uavhengige magneter som hver tenner én plugg per sylinder. Ved 1700 o/min gir hver magnet alene et lite fall: maks 125 o/min, maks 50 o/min forskjell. Ikke noe fall betyr en magnet som kanskje ikke jordes (en «varm» propell); stort fall med ujevn gange er en sotet plugg eller en feil magnet.',
 'Electrical':'Elektrisk','28 V alternator, 24 V battery. The ammeter shows battery current: charge after start, near zero in cruise, discharge if the alternator is off. LOW VOLTAGE comes on below about 24.5 V. Cycle the master (both halves) to reset the alternator control unit; if it comes on again, ALT off, shed load and land.':'28 V generator, 24 V batteri. Amperemeteret viser batteristrømmen: lading etter start, nær null i marsj, utlading hvis generatoren er ute. LOW VOLTAGE tennes under ca. 24,5 V. Slå hovedbryteren (begge halvdeler) av og på for å nullstille generatorregulatoren; tennes lyset igjen: ALT av, reduser forbruket og land.',
 'Vacuum and gyros':'Vakuum og gyroer','The engine-driven vacuum pump spins the attitude and heading gyros (suction 4.5–5.4 in Hg). After a pump failure they slow down over minutes: the attitude indicator slowly tilts and the heading indicator wanders while looking believable. The turn coordinator is electric. Cover the failed instruments and fly partial panel.':'Den motordrevne vakuumpumpa driver gyroene i horisonten og kursgyroen (sug 4,5–5,4 in Hg). Etter pumpesvikt bremser de ned over minutter: horisonten heller sakte og kursgyroen vandrer mens de ser troverdige ut. Svingkoordinatoren er elektrisk. Dekk til de svikta instrumentene og fly «partial panel».',
 'Magnetic compass':'Magnetkompass','Dip makes the compass lag when turning off north and lead when turning off south (northern hemisphere), and show a turn towards north when you accelerate on an east or west heading. Read it in steady, wings-level flight.':'Inklinasjonen gjør at kompasset henger etter når du svinger fra nord og går foran når du svinger fra sør (nordlige halvkule), og viser sving mot nord når du akselererer på østlig eller vestlig kurs. Les det av i rolig, vingene-vannrett flyging.',
 'What is simplified':'Hva som er forenklet','The flight model is a generic light single tuned to typical C172 numbers. No P-factor or torque on the ground, no weight and balance, one fixed weight (about 2,200 lb). Gauges and limits are typical values for learning, not certified data.':'Flymodellen er et generelt lett enmotorsfly justert til typiske C172-tall. Ingen P-faktor eller dreiemoment på bakken, ingen vekt og balanse, én fast vekt (ca. 2200 lb). Instrumenter og grenser er typiske verdier for læring, ikke sertifiserte data.',
 'Keyboard':'Tastatur','Pitch and roll. Up is nose down, like a control wheel. Hold':'Stigning og krengning. Opp er nese ned, som et ratt. Hold','for more.':'for mer.','or':'eller',
 'Rudder left and right · centre the rudder':'Sideror venstre og høyre · sentrer sideroret','Throttle in and out · mixture richer and leaner':'Gass inn og ut · blanding rikere og magrere','Carburettor heat on / off':'Forgasservarme på / av','Elevator trim nose down and up':'Trim nese ned og opp',
 'Flaps down and up · brakes while held':'Flaps ned og opp · bremser mens du holder','Zoom to a part of the panel · back to the whole panel':'Zoom til en del av panelet · tilbake til hele panelet','Move between panel controls; arrows, Space and Enter operate them':'Flytt mellom kontrollene på panelet; piltaster, mellomrom og Enter betjener dem',
 'Check':'Sjekk',
 "Teaching model, not a certified simulator or an approved checklist, and not affiliated with any aircraft, engine or avionics manufacturer or any operator. Procedures here are generic and for training only — follow the POH/AFM of your aeroplane and your school's checklist. Numbers are typical classic Cessna 172 (172P-style, 160 hp, carburetted) values that vary with model year and equipment; verify every figure in your approved documents.":'Pedagogisk modell, ikke en sertifisert simulator eller godkjent sjekkliste, og ikke tilknyttet noen fly-, motor- eller avionikkprodusent eller operatør. Prosedyrene er generelle og kun for trening — følg POH/AFM for flyet ditt og skolens sjekkliste. Tallene er typiske verdier for en klassisk Cessna 172 (172P-type, 160 hk, forgasser) som varierer med årsmodell og utstyr; kontroller alle tall i godkjente dokumenter.',
 'More cockpits: the':'Flere cockpiter:','DA42 glass cockpit':'DA42 glasscockpit','and the':'og','King Air B200 procedure trainer':'King Air B200 prosedyretrener',
 'Flying':'Flyr','Paused':'Pause','Crashed':'Havarert','On ground':'På bakken','Rudder':'Sideror','From':'Fra','Speed':'Fart','Turbulence':'Turbulens','Cockpit tools':'Cockpitverktøy','Procedure':'Prosedyre','Scenario':'Scenario',
 'Outside air temperature (sea level)':'Utetemperatur (havnivå)','Relative humidity':'Relativ fuktighet'
});

/* ---------- aircraft: typical classic C172 on the shared flight model ---------- */
const F=FDM, KT=F.KT, CC=C172C; F.useType('C172');
const S=F.create();
const UI={paused:false,sound:true};
const inp={keys:new Set(),stick:null,brakeHeld:false,rudUser:0};
const ENV={oat:15,rh:0.45,ice:1};

/* ---------- systems state ---------- */
const SYS={}; let ENG=CC.engInit(false,15), EL=CC.elInit(), VAC=CC.vacInit(false), CMP=CC.cmpInit(0); const FUEL={L:20,R:20};
const LIST=[Object.assign({type:'VOR'},F.WORLD.vor),Object.assign({type:'LOC'},F.WORLD.loc)];
const NDB={id:'AN',freq:375,N:-7600,E:0}, MKR=[{k:'O',N:-7600,E:0},{k:'M',N:-1100,E:0}];
const DMEST={'113.30':{N:F.WORLD.vor.N,E:F.WORLD.vor.E},'110.30':{N:F.WORLD.loc.N,E:F.WORLD.loc.E}};
function sysDefault(run){
  const w=run?1:0;
  Object.assign(SYS,{mag:run?3:0,altSw:w,batSw:w,avio:w,bcn:w,land:0,taxi:0,navL:0,strobe:0,pitot:0,primer:0,park:run?0:1,carb:0,thr:0,mix:1,cabHeat:0,cabAir:0,dimPanel:0.8,dimRadio:0.8,elt:0,fuelSel:1,
    covAI:0,covDG:0,mkrSw:0,auC1:1,auC2:0,auN1:0,auN2:0,auAdf:0,auDme:0,auMkr:1,micSel:0,pwr1:run?0.6:0,pwr2:run?0.6:0,adfPwr:run?0.6:0,adfMd:1,dmePwr:w,dmeMd:0,xpMd:run?3:0,xpc:[7,0,0,0],xpId:0,navId1:0,navId2:0,
    com1:{a:'118.100',s:'121.500'},com2:{a:'121.500',s:'122.800'},nav1:{a:'110.30',s:'113.30'},nav2:{a:'113.30',s:'110.30'},adf:{a:'375',s:'287'},crs1:360,crs2:360,adfCard:0,egtRef:1300,aiAdj:0,
    cb:{},keyHold:0,keyT:0,identT:0,strokes:0,hobbs:1234.5,tach:2876.2,eltWarn:0,heatMsg:0});
  ['aiK','baroK','dgK','obs1','obs2','adfCard','egtK','xp0','xp1','xp2','xp3'].forEach(k=>SYS['r_'+k]=0);
  ['comK1','comK2','navK1','navK2','adfK'].forEach(k=>{ SYS[k+'O']=0; SYS[k+'I']=0; });
  P.CBS.forEach(c=>SYS.cb[c.k]=1);
  ENG=CC.engInit(run,ENV.oat); EL=CC.elInit(); EL.soc=0.92; VAC=CC.vacInit(run); CMP=CC.cmpInit(S.psi*180/Math.PI);
  VAC.hdg=F.wrap360(S.psi*180/Math.PI+(run?0:(Math.random()<0.5?-1:1)*(18+Math.random()*20))); if(!run){ VAC.eR=12-Math.random()*24; VAC.eP=4; }
  FUEL.L=FUEL.R=20; S.ctl.flap=S.ctl.flapPos=0; S.eng[0].fail=false;
}
const cbIn=n=>SYS.cb[n]!==0;
const volts=()=>EL.volts; const bus=()=>SYS.batSw&&EL.volts>18;
const avOn=()=>bus()&&SYS.avio;
const radOn=k=>{ if(!avOn()) return false; if(k==='nc1') return SYS.pwr1>0.05&&(cbIn('COM 1')||cbIn('NAV 1')); if(k==='nc2') return SYS.pwr2>0.05&&(cbIn('COM 2')||cbIn('NAV 2')); if(k==='adf') return SYS.adfPwr>0.05&&cbIn('ADF'); if(k==='dme') return !!SYS.dmePwr&&cbIn('DME'); if(k==='xp') return SYS.xpMd>0&&cbIn('XPDR'); if(k==='aud') return cbIn('AUDIO'); return false; };
const navRad=n=>radOn('nc'+n)&&cbIn('NAV '+n), comRad=n=>radOn('nc'+n)&&cbIn('COM '+n);

/* ---------- panel ---------- */
const PST=el('stage');
const IO={get:k=>ioGet(k),set:(k,v)=>ioSet(k,v),intercept:()=>false};
const P=C172P.build(PST,IO);
/* 3D cockpit (beta page only: <body data-d3>): set up after the outside world, see d3Init() */
const D3=document.body.dataset.d3?window.C172_3D:null; let D3on=false;
const CBK={}; P.C.forEach(c=>{ if(c.t==='cb') CBK[c.id]=c.cb; });
const ENC=['aiK','baroK','dgK','obs1','obs2','adfCard','egtK','xp0','xp1','xp2','xp3'];
function ioGet(k){
  if(k==='flaps') return S.ctl.flap; if(k==='trim') return S.ctl.trim;
  if(k.startsWith('led:')) return ledOf(k.slice(4)); if(k.startsWith('txt:')) return txtOf(k.slice(4));
  if(CBK[k]) return SYS.cb[CBK[k]];
  if(/^xp[0-3]$/.test(k)) return SYS.xpc[+k[2]];
  if(ENC.includes(k)) return SYS['r_'+k];
  return SYS[k]??0;
}
function ledOf(id){ if(id==='covAI'||id==='covDG') return !!SYS[id]; if(id==='navId1'||id==='navId2') return navRad(id.slice(-1))&&!!SYS[id]; if(id==='adfMd') return radOn('adf')&&!!SYS.adfMd; return false; }
const VALS={mag:['OFF','R','L','BOTH','START'],fuelSel:CC.SEL};
function txtOf(id){
  if(id==='thr') return Math.round(SYS.thr*100)+' % open · '+Math.round(ENG.rpm)+' RPM'; if(id==='mix') return SYS.mix<0.04?'IDLE CUT-OFF':SYS.mix>0.97?'FULL RICH':Math.round(SYS.mix*100)+' %';
  if(id==='baroK') return Math.round(S.baro)+' hPa · '+(S.baro/33.8639).toFixed(2)+' inHg'; if(id==='dgK') return 'HDG '+String(Math.round(VAC.hdg)||360).padStart(3,'0');
  if(id==='obs1') return 'CRS '+String(SYS.crs1).padStart(3,'0'); if(id==='obs2') return 'CRS '+String(SYS.crs2).padStart(3,'0'); if(id==='adfCard') return 'card '+String(SYS.adfCard).padStart(3,'0');
  if(id==='egtK') return 'reference '+SYS.egtRef+' °F'; if(id==='aiK') return 'airplane '+(SYS.aiAdj>0?'+':'')+SYS.aiAdj.toFixed(1);
  if(/^xp[0-3]$/.test(id)) return 'code '+SYS.xpc.join('');
  if(/^comK[12]$/.test(id)) return 'COM standby '+SYS['com'+id.slice(-1)].s; if(/^navK[12]$/.test(id)) return 'NAV standby '+SYS['nav'+id.slice(-1)].s; if(id==='adfK') return 'ADF standby '+SYS.adf.s;
  if(id==='pwr1'||id==='pwr2'||id==='adfPwr') return SYS[id]<0.05?'OFF':'ON, volume '+Math.round(SYS[id]*100)+' %';
  if(id==='dimPanel'||id==='dimRadio') return Math.round(SYS[id]*100)+' %';
  return ''; }
function descr(k){ const o=P.byId[k]; if(!o) return null; const c=o.c, v=ioGet(k), n=c.lbl||c.l;
  const st=c.t==='rotsel'?c.vals[v]:c.t==='tog3'?(c.vals[v+1]||'CENTRE'):c.t==='flap'?c.vals[v]:c.t==='lev'?txtOf(k):c.t==='pull'?(v?'PULLED':'IN'):c.t==='cb'?(v?'IN':'PULLED'):(c.t==='key')?(c.alt?(v?'ON':'OFF'):''):(v?'ON':'OFF');
  return String(n.replace(/ \(.*\)$/,'')+' — '+st).replace(/\n/g,' '); }
function ioSet(k,v){
  ensureAudio();
  if(k==='stick'){ inp.stick=v; return; }
  if(k==='mag:hold'){ SYS.keyHold=v; return; }
  if(k.endsWith(':d')){ encTurn(k.slice(0,-2),v); return; }
  if(k.endsWith(':o')||k.endsWith(':i')){ enc2Turn(k.slice(0,-2),k.endsWith(':i'),v); return; }
  if(CBK[k]){ SYS.cb[CBK[k]]=v; click(); flash(P.byId[k].c.l.replace(' CIRCUIT BREAKER','')+' CB '+(v?'IN':'PULLED')); procTouch(k); return; }
  if(k==='flaps'){ setFlap(v); procTouch('flaps'); return; }
  if(k==='trim'){ S.ctl.trim=v; holdPitch=null; PR.m.trimMoved=1; procTouch('trim'); return; }
  if(/^(comX|navX)[12]$/.test(k)){ SYS[k]=v; if(v){ const n=k.slice(-1), r=(k.startsWith('com')?'com':'nav')+n; if(radOn('nc'+n)){ const f=SYS[r]; [f.a,f.s]=[f.s,f.a]; click(); flash(r.toUpperCase().replace(/(\d)/,' $1')+' '+f.a); } procTouch(k); } return; }
  if(k==='adfX'){ SYS[k]=v; if(v&&radOn('adf')){ [SYS.adf.a,SYS.adf.s]=[SYS.adf.s,SYS.adf.a]; click(); } procTouch(k); return; }
  if(k==='xpId'){ SYS[k]=v; if(v&&radOn('xp')&&SYS.xpMd>=2){ SYS.identT=18; click(); flash('IDENT'); } return; }
  if(k==='altSw'){ SYS.altSw=v; if(v&&!SYS.batSw) SYS.batSw=1; afterMaster(); return; }
  if(k==='batSw'){ SYS.batSw=v; if(!v) SYS.altSw=0; afterMaster(); return; }
  if(k==='primer'){ const was=SYS.primer; SYS.primer=v; click(); if(was&&!v){ CC.prime(ENG); SYS.strokes++; flash(L(tr2('Primer stroke ','Primerslag '))+SYS.strokes+(SYS.strokes>=4?L(tr2(' — careful, too much prime floods the engine',' — forsiktig, for mye priming drukner motoren')):'')); } procTouch('primer'); return; }
  if(k==='mag'){ const was=SYS.mag; SYS.mag=v; if(v===4){ SYS.keyT=1.2; } if(v!==was) beep(220,0.03,0.05); procTouch('mag'); setTimeout(()=>{ const d=descr(k); if(d) flash(d); },0); return; }
  if(k==='carb'){ SYS.carb=v; click(); procTouch('carb'); flash(L(v?tr2('Carburettor heat — HOT (filtered air bypassed)','Forgasservarme — VARM (filtrert luft forbikoblet)'):tr2('Carburettor heat — COLD','Forgasservarme — KALD'))); return; }
  if(k==='cabHeat'){ SYS.cabHeat=v; click(); if(v&&!SYS.heatMsg){ SYS.heatMsg=1; msg(tr2('Cabin heat comes from a muff around the exhaust: if you smell exhaust (CO), cabin heat OFF, cabin air and vents OPEN, land.','Kabinvarmen kommer fra en mansjett rundt eksosen: lukter du eksos (CO), kabinvarme AV, kabinluft og ventiler ÅPNE, land.')); } procTouch(k); return; }
  if(k==='elt'){ SYS.elt=v; click(); if(v===-1) msg(tr2('ELT ON: transmitting on 121.5 MHz — only in an emergency. Set ARM.','ELT ON: sender på 121,5 MHz — bare i en nødsituasjon. Sett ARM.')); if(v===1) flash(L(tr2('ELT TEST/RESET: a short test burst — only in the first 5 minutes after the hour','ELT TEST/RESET: en kort testsending — bare de første 5 minuttene etter hel time'))); procTouch(k); return; }
  if(k==='thr'||k==='mix'){ SYS[k]=F.clamp(v,0,1); if(k==='mix') PR.m.mixMoved=1; procTouch(k); return; }
  if(k==='mkrSw'){ SYS[k]=v; click(); return; }
  SYS[k]=v;
  const c=P.byId[k]&&P.byId[k].c;
  if(c&&(c.t==='tog'||c.t==='rotsel'||c.t==='pull'||c.t==='tog3'||(c.t==='key'&&c.alt))){ beep(c.t==='tog'?260:300,0.025,0.06); setTimeout(()=>{ const d=descr(k); if(d) flash(d); },0); }
  procTouch(k);
}
function afterMaster(){ beep(260,0.03,0.06); if(!SYS.batSw&&!SYS.altSw) PR.m.mOff=1; if(SYS.batSw&&SYS.altSw&&PR.m.mOff){ PR.m.mOff=0; if(CC.elReset(EL)){ PR.m.reset=1; } } setTimeout(()=>flash('MASTER — ALT '+(SYS.altSw?'ON':'OFF')+' · BAT '+(SYS.batSw?'ON':'OFF')),0); procTouch('batSw'); }
function encTurn(id,d){ click(); SYS['r_'+id]=(SYS['r_'+id]||0)+d;
  if(id==='baroK'){ S.baro=F.clamp(Math.round(S.baro)+d,940,1050); procTouch('baroK'); }
  else if(id==='dgK'){ VAC.hdg=F.wrap360(VAC.hdg+d); procTouch('dgK'); }
  else if(id==='obs1'||id==='obs2'){ const k='crs'+id.slice(-1); SYS[k]=(Math.round(F.wrap360(SYS[k]+d*2))||360); procTouch(id); }
  else if(id==='adfCard'){ SYS.adfCard=Math.round(F.wrap360(SYS.adfCard+d*5)); }
  else if(id==='egtK'){ SYS.egtRef=F.clamp(SYS.egtRef+25*d,1000,1600); }
  else if(id==='aiK'){ SYS.aiAdj=F.clamp(SYS.aiAdj+0.5*d,-5,5); }
  else if(/^xp[0-3]$/.test(id)){ const i=+id[2]; SYS.xpc[i]=((SYS.xpc[i]+d)%8+8)%8; SYS['r_'+id]=SYS.xpc[i]; procTouch('xpMd'); }
}
function enc2Turn(id,inner,d){ click(); SYS[id+(inner?'I':'O')]+=d; const n=id.slice(-1);
  if(id.startsWith('comK')){ const f=SYS['com'+n]; let mhz=Math.floor(+f.s+1e-6), khz=Math.round((+f.s-mhz)*1000); if(inner){ khz=((khz+25*d)%1000+1000)%1000; } else { mhz=118+(((mhz-118+d)%19)+19)%19; } f.s=(mhz+khz/1000).toFixed(3); }
  else if(id.startsWith('navK')){ const f=SYS['nav'+n]; let mhz=Math.floor(+f.s+1e-6), khz=Math.round((+f.s-mhz)*100); if(inner){ khz=((khz+5*d)%100+100)%100; } else { mhz=108+(((mhz-108+d)%10)+10)%10; } f.s=(mhz+khz/100).toFixed(2); }
  else if(id==='adfK'){ let v=+SYS.adf.s+(inner?d:d*100); if(v<190) v+=1610; if(v>1799) v-=1610; SYS.adf.s=String(v); }
  procTouch(id); }

/* ---------- zoom, area selector, lock (shared framework) ---------- */
const Z={s:1,tx:0,ty:0,reg:'overview',lock:false};
const ZN=[['overview',tr2('Panel','Panel')],['six',tr2('Six-pack · OAT','Six-pack · OAT')],['left',tr2('Engine and electrical gauges · tachometer','Motor- og elektriske instrumenter · turteller')],['low6',tr2('Tachometer · instrument covers','Turteller · instrumentdeksler')],['nav',tr2('NAV indicators · ADF','NAV-indikatorer · ADF')],['audio',tr2('Audio panel · NAV/COM 1 and 2','Lydpanel · NAV/COM 1 og 2')],['radios',tr2('ADF · DME · transponder','ADF · DME · transponder')],['flaps',tr2('Flap switch and position','Flapsbryter og -posisjon')],['switches',tr2('Master · ignition · lights · primer','Hovedbryter · tenning · lys · primer')],['cbs',tr2('Circuit breakers','Sikringer')],['quad',tr2('Carb heat · throttle · mixture','Forgasservarme · gass · blanding')],['rlower',tr2('Cabin heat and air · dimmers','Kabinvarme og -luft · dimmere')],['pedestal',tr2('Trim wheel · fuel selector','Trimhjul · drivstoffvelger')],['right',tr2('Right panel · EGT · ELT · hour meter','Høyre panel · EGT · ELT · timeteller')],['compass',tr2('Magnetic compass','Magnetkompass')]];
const OV_NEED=1085; // whole-panel view: everything down to the throttle quadrant and the yoke grips stays on screen (PANELZOOM.fit)
let PZ=null;
function zoomTo(reg,instant,force){
  if(Z.lock&&!force&&reg!==Z.reg){ flash(L(tr2('View is locked — unlock to zoom','Visningen er låst — lås opp for å zoome'))); return; }
  if(D3on){ if(force&&instant){ D3.resize(); return; } const ov=reg==='overview'||!P.REG[reg]; Z.reg=ov?'overview':reg; if(ov) D3.lookAhead(instant); else D3.lookAt(P.REG[reg],instant); PST.classList.toggle('zoomed',!ov); syncAreaUI(); areaHL(null); return; }
  let r=P.REG[reg]||P.REG.overview; const w=PST.clientWidth, h=PST.clientHeight; if(!w||!h) return;
  const ov=reg==='overview'; if(ov&&skyOn()){ const k=C172P.SKY*(h<520?0.5:1); r=[r[0],-k,r[2],r[3]+k]; } /* phones: half, to keep the panel usable */ let s=Math.min(w/r[2],h/r[3])*(ov?1:0.95);
  const r0=P.REG.overview, s0=Math.min(w/r0[2],h/r0[3]); if(!ov) s=Math.max(s0,Math.min(s,4.5));
  let tx=w/2-(r[0]+r[2]/2)*s, ty=h/2-(r[1]+r[3]/2)*s;
  const cl=(v,lo,hi)=>lo>hi?(lo+hi)/2:Math.max(lo,Math.min(hi,v));
  tx=cl(tx,w-P.W*s,0); ty=cl(ty,h-P.H*s,0);
  if(ov){ tx=w/2-(r[0]+r[2]/2)*s; ty=Math.max(h/2-(r[1]+r[3]/2)*s,h-P.H*s); }
  if(ov&&window.PANELZOOM){ const f=PANELZOOM.fit({w,h,x0:0,width:P.W,H:P.H,lip:C172P.LIP,need:OV_NEED,sky:C172P.SKY,otw:skyOn()}); if(f.s>s){ s=f.s; tx=f.tx; ty=f.ty; } } // larger panel; the lowest rows may run off the bottom
  Object.assign(Z,{s,tx,ty,reg});
  P.world.classList.toggle('nt',!!instant);
  P.world.style.transform=`translate(${tx}px,${ty}px) scale(${s})`;
  P.world.style.setProperty('--ls',ov?1:1.06);
  PST.classList.toggle('zoomed',!ov); syncAreaUI(); areaHL(null); otwFit(); if(PZ) PZ.sync();
}
function toWorld(e){ if(D3on) return D3.toWorld(e); const sv=P.svg, q=sv.createSVGPoint(); q.x=e.clientX; q.y=e.clientY; const p=q.matrixTransform(sv.getScreenCTM().inverse()); return {x:p.x,y:p.y}; }
function regionAt(p){ for(const k of P.REG_ORDER){ const r=P.REG[k]; if(p.x>=r[0]&&p.x<=r[0]+r[2]&&p.y>=r[1]&&p.y<=r[1]+r[3]) return k; } return null; }
const NS='http://www.w3.org/2000/svg';
const hlR=document.createElementNS(NS,'rect'); hlR.setAttribute('class','areahl'); hlR.setAttribute('rx',14); if(P.top) P.top.insertBefore(hlR,P.top.firstChild); else P.svg.insertBefore(hlR,P.svg.querySelector('g.ctls'));
const hlO=v=>{ if(hlR._o===v) return; hlR._o=v; if(P.svg.classList.contains('cpt')) hlR.style.setProperty('--bbo',v); else hlR.style.opacity=v; };
function areaHL(k){ if(!k||Z.reg!=='overview'){ hlO(0); return; } if(hlR._k!==k){ hlR._k=k; const r=P.REG[k]; hlR.setAttribute('x',r[0]); hlR.setAttribute('y',r[1]); hlR.setAttribute('width',r[2]); hlR.setAttribute('height',r[3]); } hlO(1); }
const emptyAt=e=>!e.target.closest('g.ctl,.hit,.zback,.tz,.pill,.mag,.tip');
PST.addEventListener('pointermove',e=>{ if(Z.reg!=='overview'||e.pointerType==='touch'||(D3on&&D3.dragging)) return; if(!emptyAt(e)){ areaHL(null); return; } areaHL(regionAt(toWorld(e))); });
PST.addEventListener('pointerleave',()=>areaHL(null));
/* single click / tap on an instrument area zooms to it, a click outside the zoomed area goes back; pinch (and Ctrl/⌘ + wheel,
   the trackpad pinch) zooms in and out (panelzoom.js, shared with the DA42 and the B200) */
if(window.PANELZOOM) PZ=PANELZOOM.attach({stage:PST,world:P.world,size:()=>[P.W,P.H],Z,zoomTo,regionAt,toWorld,emptyAt,regs:()=>P.REG,d3:()=>D3on?D3:null,
  off:'.zback,.more,.pill,.tip,.touch,.rot,.d3t,.d3v,.otwmsg,.afban,.afnow,button,select,a,input'});
el('zBack').onclick=()=>zoomTo('overview');
function drawZoomBar(){ el('zoomSel').innerHTML=ZN.map(([k,t])=>`<option value="${k}"${k===Z.reg?' selected':''}>${L(t)}</option>`).join(''); }
function syncAreaUI(){ const zs=el('zoomSel'); if(zs.value!==Z.reg) zs.value=Z.reg; const b=el('bLock'); if(b) b.setAttribute('aria-pressed',Z.lock); PST.classList.toggle('locked',Z.lock); }
drawZoomBar(); LAB.onLang(()=>{ drawZoomBar(); syncAreaUI(); });
el('zoomSel').onchange=e=>{ zoomTo(e.target.value); el('moreMenu').hidden=true; el('bMore').setAttribute('aria-expanded',false); };
el('bLock').onclick=()=>{ Z.lock=!Z.lock; try{ localStorage.setItem('bb-c172-lock',Z.lock?'1':'0'); localStorage.setItem('bb-c172-zone',Z.reg); }catch(e){} syncAreaUI(); };
try{ Z.lock=localStorage.getItem('bb-c172-lock')==='1'; const z=localStorage.getItem('bb-c172-zone'); if(Z.lock&&z&&P.REG[z]) Z.reg=z; }catch(e){}
/* the … menu, drawer tabs and the one notification area: simshell.js */
const SH=SIMSHELL;
function flash(t){ SH.say(t,'',1800); }
const tip=document.createElement('div'); tip.className='tip'; tip.hidden=true; PST.appendChild(tip);
function tipText(g){ const n=g.getAttribute('aria-label'); const v=g.getAttribute('aria-valuetext')||(g.getAttribute('aria-checked')==null?'':g.getAttribute('aria-checked')==='true'?'ON':'OFF'); return n+(v?' · '+v:''); }
let tipG=null;
PST.addEventListener('pointerover',e=>{ if(D3on&&D3.frozen) return; const g=C172P.ctlFrom(P,e.target); if(!g||e.pointerType==='touch'){ tip.hidden=true; tipG=null; return; } tipG=g; tip.textContent=tipText(g); tip.hidden=false; });
PST.addEventListener('pointermove',e=>{ if(!tipG) return; tip.textContent=tipText(tipG); const r=PST.getBoundingClientRect(); tip.style.left=Math.max(4,Math.min(r.width-260,e.clientX-r.left+14))+'px'; tip.style.top=Math.max(4,e.clientY-r.top-34)+'px'; });
PST.addEventListener('pointerout',e=>{ if(tipG&&!(e.relatedTarget&&tipG.contains(e.relatedTarget))){ tipG=null; tip.hidden=true; } });
new ResizeObserver(()=>zoomTo(Z.reg,true,true)).observe(PST);
C172P.ctrlWheel(PST);
// touch-action:none comes from CSS on touch screens; a pen (or touch the media query missed) turns it on at its first hover/contact
{ const tact=e=>{ if(e.pointerType&&e.pointerType!=='mouse'){ PST.classList.add('tact'); PST.removeEventListener('pointerover',tact,true); PST.removeEventListener('pointerdown',tact,true); } }; PST.addEventListener('pointerover',tact,true); PST.addEventListener('pointerdown',tact,true); }

/* ---------- outside view (shared three.js scene, otw.js) ---------- */
// The canvas sits behind the panel and shows through the windshield above the glareshield. With the outside view on, the
// overview shows extra windshield above the panel (C172P.SKY) so the outside fills about the upper third of the screen.
// Left seat of a C172: eye about 1.7 m above the ground (cabin floor ~0.7 m, seated eye ~1.0 m above it), and with the
// fuselage level the horizon sits about 8° above the glareshield (OTW.frame places it there whatever the screen size).
const OTW_BOTTOM_Y=640, OTW_NOSE=8, OTW_EYEX=480; // OTW_EYEX: panel x straight ahead of the pilot (the attitude indicator)
function skyOn(){ return !D3&&!PST.classList.contains('nootw')&&!PST.classList.contains('nogl'); }
function otwFit(){ const c=el('otw'); if(!c||Z.reg!=='overview'||D3) return; const h=PST.clientHeight; c.style.height=Math.max(0,Math.min(h,Math.round(Z.ty+OTW_BOTTOM_Y*Z.s)))+'px'; if(window.OTW&&OTW.frame) OTW.frame({lip:Z.ty+C172P.LIP*Z.s,nose:OTW_NOSE,cx:Z.tx+OTW_EYEX*Z.s}); }
const OTW_EYE={dh:0.15,left:0.3,look:0}, otwS={N:0,E:0,h:0,th:0,phi:0,psi:0};
function otwState(){ const c=Math.cos(S.psi), s=Math.sin(S.psi); otwS.N=S.N+OTW_EYE.left*s; otwS.E=S.E-OTW_EYE.left*c; otwS.h=S.h+OTW_EYE.dh; otwS.th=S.th-OTW_EYE.look; otwS.phi=S.phi; otwS.psi=S.psi; return otwS; }
let otwOn=true, otwReady=false, otwSkip=0, otwTried=false;
/* Frame-budget governor shared by the panel and the outside view. Level 0: panel at 30 Hz, outside view every frame at up to 1.5
   device pixels per CSS pixel. Level 1 (frames over 24 ms, as before): panel 20 Hz, outside view every 2nd frame at 1 pixel.
   Level 2 (frames over 45 ms): panel 15 Hz, outside view every 3rd frame at 0.75 pixel. Hysteresis and a 2 s dwell avoid hunting. */
const GOV={lvl:(()=>{ try{ const v=+localStorage.getItem('bb-simgov'); return v>=0&&v<=2?v:0; }catch(e){ return 0; } })(),ft:16,t:0,fails:[0,0,0],lastDn:-99,clock:0,tick(dt){ this.ft+=((dt*1000||16)-this.ft)*0.05; this.t+=dt; this.clock+=dt; if(this.t<2) return;
  /* step down in quality quickly; step back up only with clear headroom and after a dwell that doubles every time a level failed (no hunting) */
  const up=this.lvl<2&&this.ft>(this.lvl?45:24), target=this.lvl-1, wait=Math.min(120,8*2**(target>=0?this.fails[target]:0)), dn=this.lvl>0&&this.t>wait&&this.ft<(this.lvl>1?28:14);
  if(up){ if(this.clock-this.lastDn<12) this.fails[this.lvl]++; this.lvl++; this.t=0; try{ localStorage.setItem('bb-simgov',String(this.lvl)); }catch(e){} }
  else if(dn){ this.lvl--; this.t=0; this.lastDn=this.clock; try{ localStorage.setItem('bb-simgov',String(this.lvl)); }catch(e){} } },
  get panelDt(){ return [0.033,0.05,0.066][this.lvl]; }};
window.SIMGOV=GOV; // read by the ?perf=1 meter (otw.js)
function otwMsgSync(){ el('otwMsg').hidden=otwReady||!otwOn||!otwTried; }
function hasWebGL(){ try{ const c=document.createElement('canvas'), g=c.getContext('webgl2')||c.getContext('webgl'); if(!g) return false; const x=g.getExtension('WEBGL_lose_context'); if(x) x.loseContext(); return true; }catch(e){ return false; } }
if(!D3) (window.requestIdleCallback||setTimeout)(()=>{ try{ otwReady=!!(window.OTW&&window.THREE&&hasWebGL()&&OTW.init(el('otw'))); }catch(e){ otwReady=false; } otwTried=true; PST.classList.toggle('nogl',!otwReady); otwMsgSync(); if(!otwReady&&Z.reg==='overview') zoomTo('overview',true,true); },{timeout:400});
function setOtw(on){ otwOn=on; PST.classList.toggle('nootw',!on); el('bOtw').setAttribute('aria-pressed',on); otwMsgSync(); try{ localStorage.setItem('bb-c172-otw',on?'1':'0'); }catch(e){} if(Z.reg==='overview') zoomTo('overview',true,true); }
/* 3D cockpit (beta): the outside world is the 3D scene's background; the panel is placed in it and looked around in */
const otwS3={N:0,E:0,h:0,th:0,phi:0,psi:0};
function otwState3(){ const w=otwState(); Object.assign(otwS3,w); otwS3.th=S.th; return otwS3; }
function d3Toast(){ if(PST.querySelector('.d3t')) return; const t=document.createElement('div'); t.className='d3t'; t.setAttribute('role','status');
  t.innerHTML=`<span>${T('3D is running slowly on this device.')} <a href="${document.body.dataset.d3}">${T('Try the classic 2D panel')}</a></span><button aria-label="Close">×</button>`; t.querySelector('button').onclick=()=>t.remove(); PST.appendChild(t); setTimeout(()=>t.remove(),12000); }
function d3Init(){ PST.classList.add('d3wait');
  setTimeout(()=>{
    if(D3.supported&&D3.supported()&&hasWebGL()){ try{ otwReady=!!(window.OTW&&OTW.init(el('otw'))); }catch(e){ otwReady=false; } }
    otwTried=true;
    if(otwReady){ try{ D3on=D3.init({stage:PST,world:P.world,svg:P.svg,T,canLook:e=>emptyAt(e)&&!e.target.closest('.more,.d3t,.d3v')&&!SH.touchOwns(e),onStick:v=>{ inp.stick=v; },onSlow:d3Toast,onAhead:()=>{ Z.reg='overview'; PST.classList.remove('zoomed'); syncAreaUI(); }}); }catch(e){ console.warn('3D cockpit',e); D3on=false; } }
    if(D3on){ Z.lock=false; Z.reg='overview'; IO.toWorld=e=>D3.toWorld(e); otwOn=true; PST.classList.remove('nootw','nogl'); el('bOtw').hidden=true; el('bLock').hidden=true;
      if(el('bAhead')){ el('bAhead').hidden=false; el('bAhead').onclick=()=>zoomTo('overview'); } D3.lookAhead(true); syncAreaUI(); otwMsgSync(); LAB.onLang(()=>D3.relabel()); }
    else { PST.classList.toggle('nogl',!otwReady); el('otwMsg').textContent=T('3D needs WebGL, which this browser does not offer. Showing the classic panel.'); el('otwMsg').hidden=false; }
    PST.classList.remove('d3wait'); zoomTo(Z.reg,true,true);
  },0); }
if(D3) d3Init();
el('bOtw').onclick=()=>setOtw(!otwOn);
{ let pr=null; try{ pr=localStorage.getItem('bb-c172-otw'); }catch(e){} const phone=matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<=500; setOtw(pr?pr==='1':!phone); }
function otwTick(dt){
  if(!otwReady||!otwOn||!cockpitVis||document.hidden||Z.reg!=='overview') return;
  const lv=GOV.lvl; if(!lv||(++otwSkip%(lv+1)===0)) OTW.render(otwState(),''); if(lv!==(OTW.lvl||0)) OTW.quality(lv===2?2:lv>0);
}
el('bFull').onclick=()=>{ const c=el('cockpit'); try{ if(document.fullscreenElement) document.exitFullscreen(); else c.requestFullscreen&&c.requestFullscreen().catch(()=>msg(tr2('Full screen is blocked here. Open the page in its own tab.','Fullskjerm er blokkert her. Åpne siden i en egen fane.'))); }catch(e){} };

/* ---------- engine, electrics, vacuum, fuel ---------- */
const oatAt=altFt=>ENV.oat-1.98*altFt/1000;
let lastIas=0, accel=0, turnRate=0, lastHdg=null;
function loads(){ let a=2.2; if(SYS.navL&&cbIn('NAV LT')) a+=4; if(SYS.bcn&&cbIn('BCN')) a+=2.5; if(SYS.strobe&&cbIn('STROBE')) a+=3; if(SYS.land&&cbIn('LAND LT')) a+=9; if(SYS.taxi&&cbIn('TAXI LT')) a+=6; if(SYS.pitot&&cbIn('PITOT HT')) a+=7.5;
  if(SYS.avio){ if(SYS.pwr1>0.05) a+=2.4; if(SYS.pwr2>0.05) a+=2.4; if(SYS.adfPwr>0.05) a+=0.8; if(SYS.dmePwr) a+=1.4; if(SYS.xpMd>0) a+=1.4; a+=0.5; }
  if(Math.abs(S.ctl.flap-S.ctl.flapPos)>0.01&&cbIn('FLAP')) a+=12; a+=SYS.dimPanel*1.2+SYS.dimRadio*0.6; return a; }
function sysTick(dt,o){
  /* the ignition key springs back from START */
  if(SYS.mag===4&&!SYS.keyHold){ SYS.keyT-=dt; if(SYS.keyT<=0) SYS.mag=3; }
  const crank=SYS.mag===4&&SYS.batSw&&EL.volts>16;
  CC.elStep(EL,{bat:!!SYS.batSw,alt:!!SYS.altSw,rpm:ENG.rpm,load:SYS.batSw?loads():0,starter:SYS.mag===4&&SYS.batSw,cb:cbIn('ALT')},dt);
  const feeds=CC.fuelFeeds(FUEL,SYS.fuelSel);
  CC.engStep(ENG,{thr:SYS.thr,mix:SYS.mix,heat:SYS.carb,mags:SYS.mag,starter:crank,starterK:F.clamp((EL.volts-15)/7,0,1),fuel:feeds,ias:Math.max(0,o.ias),alt:o.altTrue,oat:oatAt(o.altTrue),rh:ENV.rh,icing:ENV.ice},dt);
  CC.fuelStep(FUEL,SYS.fuelSel,ENG.ff,dt);
  const pa=Math.min(1,F.isa(S.h,S.env.isa).sig/0.74);
  S.eng[0].thr=(ENG.run?CC.propThr(ENG,o.ias):0)/pa; S.eng[0].off=!ENG.run;
  if(!ENG.run&&ENG.dead&&ENG.dead!==SYS.lastDead&&o.ias>20){ SYS.lastDead=ENG.dead; msg(tr2('Engine stopped: '+ENG.dead,'Motoren stoppet: '+({'fuel starvation':'drivstoffmangel','mixture idle cut-off':'blanding i idle cut-off','carburettor ice':'forgasseris','ignition off':'tenning av','mixture too lean':'for mager blanding','mixture too rich':'for rik blanding','engine failure':'motorsvikt','rpm too low':'for lavt turtall'}[ENG.dead]||ENG.dead))); }
  if(ENG.run) SYS.lastDead='';
  if(SYS.mag===4) SYS.crankT=(SYS.crankT||0)+dt; else SYS.crankT=0;
  if(SYS.crankT>10&&!SYS.crankWarn){ SYS.crankWarn=1; msg(tr2('Starter engaged for 10 s — release, let it cool, check prime, mixture, throttle and fuel.','Starteren har gått i 10 s — slipp, la den kjøle seg, sjekk priming, blanding, gass og drivstoff.')); }
  if(SYS.mag!==4) SYS.crankWarn=0;
  if(ENG.run&&ENG.startedAt>0&&ENG.t-ENG.startedAt<4&&ENG.rpm>1700&&!SYS.surgeWarn){ SYS.surgeWarn=1; msg(tr2('High RPM after start — throttle back to about 1,000 RPM.','Høyt turtall etter start — gass tilbake til ca. 1000 o/min.')); }
  if(!ENG.run) SYS.surgeWarn=0;
  /* gyros */
  const rnd=Math.random();
  SYS.att=CC.vacStep(VAC,{rpm:ENG.rpm,roll:o.roll,pitch:o.pitch,turn:turnRate,rnd},dt);
  const tcOn=bus()&&cbIn('TURN'); SYS.tcSpin=F.clamp((SYS.tcSpin||0)+(tcOn?dt/8:-dt/60),0,1);
  SYS.cmp=CC.cmpStep(CMP,{hdg:o.hdg,bank:o.roll,accel},dt);
  /* hour meters */
  if(ENG.oilP>15) SYS.hobbs+=dt/3600; SYS.tach+=dt/3600*ENG.rpm/2400;
  if(SYS.identT>0) SYS.identT-=dt;
  /* ELT: ARM triggers on a crash */
  if(S.crash&&SYS.elt===0&&!SYS.eltAuto){ SYS.eltAuto=1; }
}

/* ---------- radios: NAV, ADF, DME, markers ---------- */
let curNav1=null, curNav2=null; const dmeHist={d:null,gs:0};
function navOf(n){ const r=SYS['nav'+n], crs=SYS['crs'+n]; if(!navRad(n)) return {valid:false,dev:0,toFrom:null,gs:null,off:true}; const st=LIST.find(x=>x.freq===r.a); if(!st) return {valid:false,dev:0,toFrom:null,gs:null}; return F.nav(S,st.type,crs,st); }
function adfNow(){ if(!radOn('adf')||!SYS.adfMd||+SYS.adf.a!==NDB.freq) return null; const dN=NDB.N-S.N, dE=NDB.E-S.E; if(Math.hypot(dN,dE)/F.NM>60) return null; return F.wrap360(Math.atan2(dE,dN)*180/Math.PI-S.psi*180/Math.PI); }
function dmeNow(dt){ if(!radOn('dme')) return null; const f=SYS.dmeMd===2?SYS.nav2.a:SYS.dmeMd===0?SYS.nav1.a:(SYS.dmeHold||SYS.nav1.a); if(SYS.dmeMd!==1) SYS.dmeHold=f; const st=DMEST[f]; if(!st) return {nm:null}; const d=Math.hypot(Math.hypot(st.N-S.N,st.E-S.E),S.h)/F.NM; if(dmeHist.d!==null&&dt>0){ dmeHist.gs+=(Math.abs(dmeHist.d-d)/dt*3600-dmeHist.gs)*Math.min(1,dt*0.5); } dmeHist.d=d; return {nm:d,kt:dmeHist.gs}; }
function mkrNow(){ if(!avOn()||!cbIn('AUDIO')) return null; const r=(SYS.mkrSw===-1?1.6:1)*Math.max(250,S.h*0.45); for(const m of MKR){ if(Math.hypot(m.N-S.N,m.E-S.E)<r&&!S.ground) return m.k; } return null; }

/* ---------- touch stick and yoke pad ---------- */
/* touch controls (… menu): the stick appears under a finger dragged on bare panel; nothing covers the panel (simshell.js) */
SH.touch({stage:PST,emptyAt,d3:()=>typeof D3on!=='undefined'&&D3on,stick:v=>{ inp.stick=v; if(v) ensureAudio(); }});
const stick=el('stick'), dot=stick.querySelector('.dot');
function stickAt(e){ const r=stick.getBoundingClientRect(); inp.stick={x:FK.shapePad((e.clientX-r.left)/r.width*2-1),y:FK.shapePad((e.clientY-r.top)/r.height*2-1)}; } // expo: gentle near centre
stick.addEventListener('pointerdown',e=>{ stick.setPointerCapture(e.pointerId); stickAt(e); ensureAudio(); });
stick.addEventListener('pointermove',e=>{ if(inp.stick) stickAt(e); });
['pointerup','pointercancel'].forEach(ev=>stick.addEventListener(ev,()=>{ inp.stick=null; }));
const rud=slider(el('rudBox'),{label:'Rudder',min:-100,max:100,step:1,v:0,f:v=>(v>0?'R ':v<0?'L ':'')+Math.abs(v)+' %',on:v=>{ inp.rudUser=v/100; }});
const brk=el('brk'); ['pointerdown'].forEach(ev=>brk.addEventListener(ev,()=>inp.brakeHeld=true)); ['pointerup','pointerleave','pointercancel'].forEach(ev=>brk.addEventListener(ev,()=>inp.brakeHeld=false));
const oatS=slider(el('wxBox'),{label:'Outside air temperature (sea level)',min:-20,max:35,step:1,v:15,f:v=>v+' °C',on:v=>{ ENV.oat=v; S.env.isa=v-15; riskText(); }});
const rhS=slider(el('wxBox'),{label:'Relative humidity',min:10,max:100,step:5,v:45,f:v=>v+' %',on:v=>{ ENV.rh=v/100; riskText(); }});
const windDir=slider(el('windBox'),{label:'From',min:0,max:360,step:10,v:0,f:v=>String(v||360).padStart(3,'0')+'°',on:v=>S.env.wdir=v});
const windSpd=slider(el('windBox'),{label:'Speed',min:0,max:30,step:1,v:0,f:v=>v+' kt',on:v=>S.env.wspd=v});
const turb=slider(el('windBox'),{label:'Turbulence',min:0,max:100,step:5,v:0,f:v=>v+' %',on:v=>S.env.turb=v/100});
function riskText(){ const o=S.o||{}; const oat=oatAt(o.altTrue||0); const r=CC.icingRisk(oat,ENV.rh,0.6), r2=CC.icingRisk(oat,ENV.rh,0.1);
  el('iceRisk').textContent=L(tr2('Carburettor icing risk here: ','Fare for forgasserising her: '))+(r2<0.08?L(tr2('low','lav')):r<0.35&&r2<0.5?L(tr2('moderate — mostly at descent power','moderat — mest på nedstigningseffekt')):L(tr2('serious at any power','alvorlig på all effekt')))+` (${oat.toFixed(0)} °C, ${Math.round(ENV.rh*100)} %)`; }
LAB.onLang(riskText);
el('fEng').onclick=()=>{ ENG.failed=true; msg(tr2('Engine failure.','Motorsvikt.')); ownFail(S.ground?['efrun','eng']:['efflt','eng'],'ENGINE FAILURE'); };
el('fMag').onclick=()=>{ ENG.magFault='L'; flash(L(tr2('Left magneto has failed — try the magneto check','Venstre magnet har sviktet — prøv magnetsjekken'))); };
el('fPlug').onclick=()=>{ ENG.plug=1; flash(L(tr2('A plug on the right magneto is fouled — see the magneto check','En plugg på høyre magnet er sotet — se magnetsjekken'))); };
el('fFuel').onclick=()=>{ FUEL.L=0; flash(L(tr2('Left tank empty','Venstre tank tom'))); };
el('fVac').onclick=()=>{ VAC.pump=false; ownFail('vac','VACUUM'); flash(L(tr2('Vacuum pump failed','Vakuumpumpa har sviktet'))); };
el('fAlt').onclick=()=>{ EL.fail=true; ownFail('alt','LOW VOLTAGE'); flash(L(tr2('Alternator failed','Generatoren har sviktet'))); };
el('fRestore').onclick=()=>{ ENG.failed=false; ENG.magFault=null; ENG.plug=0; VAC.pump=true; EL.fail=false; EL.trip=false; EL.retrip=0; if(FUEL.L<1) FUEL.L=20; flash(L(tr2('All failures cleared','Alle feil fjernet'))); };

/* ---------- keyboard ---------- */
const typing=FK.typing, KB=FK.create('C172');
let cockpitVis=true; visible(el('cockpit'),v=>cockpitVis=v);
window.addEventListener('keydown',e=>{
  if(typing()||e.metaKey||e.ctrlKey||e.altKey) return;
  if(D3on&&cockpitVis&&!e.repeat&&D3.key(e)) return; if(D3on&&e.repeat&&D3.isLookKey(e)){ e.preventDefault(); return; }
  if(e.key==='Escape'&&Z.reg!=='overview'&&!Z.lock){ zoomTo('overview'); e.preventDefault(); return; }
  if(/^[0-9]$/.test(e.key)&&cockpitVis&&!e.repeat){ const z=ZN[+e.key]; if(z){ zoomTo(z[0]); e.preventDefault(); return; } }
  if(e.target.closest&&e.target.closest('g.ctl:not(.t-yoke)')&&/^Arrow| |Enter/.test(e.key)) return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(!cockpitVis&&k!=='p') return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End',' ','+','-','=','[',']','f','v','p','x','q','e','b','w','a','s','d','m','n','h'].includes(k)) e.preventDefault();
  ensureAudio();
  if(e.repeat&&['f','v','p','x','h'].includes(k)) return;
  inp.keys.add(k);
  if(k==='f') setFlap(S.ctl.flap+1); if(k==='v') setFlap(S.ctl.flap-1);
  if(k==='h') ioSet('carb',SYS.carb?0:1);
  if(k==='x'){ rud.set(0); inp.rudUser=0; }
  if(k==='p') togglePause();
});
window.addEventListener('keyup',e=>{ const k=e.key.length===1?e.key.toLowerCase():e.key; inp.keys.delete(k); if(k==='shift') inp.keys.delete('Shift'); });
window.addEventListener('blur',()=>inp.keys.clear());
FK.hint(PST); // (queued in the shell's notification area)

/* ---------- sound: engine, stall horn, Morse idents, markers, ELT ---------- */
let AC=null, horn=null, eng=null;
function ensureAudio(){ if(AC||!UI.sound) return; try{ AC=new (window.AudioContext||window.webkitAudioContext)();
  const o=AC.createOscillator(), g=AC.createGain(); o.type='sawtooth'; o.frequency.value=1600; g.gain.value=0; const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1700; f.Q.value=8; o.connect(f).connect(g).connect(AC.destination); o.start(); horn={o,g};
  const eo=AC.createOscillator(), eg=AC.createGain(), lp=AC.createBiquadFilter(); eo.type='sawtooth'; eo.frequency.value=40; lp.type='lowpass'; lp.frequency.value=320; eg.gain.value=0; eo.connect(lp).connect(eg).connect(AC.destination); eo.start(); eng={o:eo,g:eg,f:lp};
 }catch(e){ AC=null; } }
function beep(f,d,v){ if(!AC||!UI.sound) return; try{ const o=AC.createOscillator(), g=AC.createGain(); o.frequency.value=f; g.gain.value=v||0.05; o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime+d); }catch(e){} }
function click(){ beep(1700,0.015,0.03); }
function soundTick(stall){ if(!AC) return; const t=AC.currentTime, on=UI.sound&&!UI.paused&&!S.crash;
  horn.g.gain.setTargetAtTime(on&&stall?0.04:0,t,0.03);
  const rough=ENG.rough*(Math.random()-0.5)*0.6; const r=ENG.rpm;
  eng.o.frequency.setTargetAtTime(Math.max(8,r/60*2*(1+rough*0.08)),t,0.05); eng.f.frequency.setTargetAtTime(180+r*0.12,t,0.1);
  eng.g.gain.setTargetAtTime(on&&r>60?Math.min(0.06,0.012+0.03*ENG.pwr+0.006*(SYS.mag===4?1:0))*(1+rough):0,t,0.05); }
const MORSE={A:'.-',N:'-.',S:'...',I:'..'};
let identT=0, mkrT=0, eltT=0;
function morse(t,f,v){ if(!AC) return; let at=AC.currentTime+0.05; const u=0.09; for(const ch of t){ for(const s of (MORSE[ch]||'')){ const d=s==='.'?u:3*u; try{ const o=AC.createOscillator(), g=AC.createGain(); o.frequency.value=f; g.gain.value=v; o.connect(g).connect(AC.destination); o.start(at); o.stop(at+d); }catch(e){} at+=d+u; } at+=2*u; } }
function audioTick(dt){ if(!AC||!UI.sound||UI.paused) return; identT-=dt; mkrT-=dt; eltT-=dt; if(!radOn('aud')) return;
  if(identT<=0){ identT=7; for(const n of ['1','2']){ if(SYS['navId'+n]&&SYS['auN'+n]&&navRad(n)){ const st=LIST.find(x=>x.freq===SYS['nav'+n].a); if(st&&(n==='1'?curNav1:curNav2)&&(n==='1'?curNav1:curNav2).dist<40){ morse(st.type==='LOC'?'IASN':'ASN',1020,0.025); break; } } }
    if(SYS.auAdf&&adfNow()!=null) setTimeout(()=>morse('AN',1020,0.022),2500); }
  const m=mkrNow(); if(m&&SYS.auMkr&&mkrT<=0){ if(m==='O'){ beep(400,0.35,0.03); mkrT=0.5; } else { beep(1300,0.12,0.025); mkrT=0.3; } }
  if((SYS.elt===-1||SYS.eltAuto)&&eltT<=0&&((comRad('1')&&SYS.com1.a==='121.500'&&SYS.auC1)||(comRad('2')&&SYS.com2.a==='121.500'&&SYS.auC2))){ eltT=0.5; try{ const o=AC.createOscillator(), g=AC.createGain(); o.frequency.setValueAtTime(1400,AC.currentTime); o.frequency.linearRampToValueAtTime(500,AC.currentTime+0.45); g.gain.value=0.02; o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime+0.45); }catch(e){} }
}
el('bSound').onclick=()=>{ UI.sound=!UI.sound; if(!UI.sound&&horn){ horn.g.gain.value=0; eng.g.gain.value=0; } el('bSound').textContent=T(UI.sound?'Sound on':'Sound off'); el('bSound').setAttribute('aria-pressed',UI.sound); if(UI.sound) ensureAudio(); };
document.addEventListener('pointerdown',ensureAudio,{once:true});
function togglePause(){ UI.paused=!UI.paused; el('bPause').textContent=T(UI.paused?'Resume':'Pause'); }
el('bPause').onclick=togglePause; el('bReset').onclick=()=>{ procStart(PR.k||'free'); if(UI.paused) togglePause(); };
LAB.onLang(()=>{ el('bPause').textContent=T(UI.paused?'Resume':'Pause'); el('bSound').textContent=T(UI.sound?'Sound on':'Sound off'); });

/* ---------- flaps ---------- */
function setFlap(n){ n=F.clamp(n,0,3); if(n===S.ctl.flap) return; if(!bus()||!cbIn('FLAP')){ msg(tr2('The flaps are electric: master switch on and FLAP breaker in.','Flapsene er elektriske: hovedbryter på og FLAP-sikringen inne.')); return; }
  const o=S.o||{}; if(n>S.ctl.flap&&o.ias>(n<=1?110:85)+2) msg(tr2('Flap limit: 10° below 110 KIAS, more than 10° below 85 KIAS.','Flapsgrense: 10° under 110 KIAS, mer enn 10° under 85 KIAS.'));
  S.ctl.flap=n; beep(500,0.04,0.04); flash('FLAPS '+['UP','10°','20°','FULL'][n]); }

/* ---------- procedures and scenarios (generic training flows; follow the POH/AFM and your school's checklist) ---------- */
const st=(t,ctl,ok,o)=>Object.assign({t,ctl,ok},o||{});
const chk=(t,ctl,ok)=>st(t,ctl,ok,{chk:1});
const near=(a,b,d)=>Math.abs(F.wrap180(a-b))<d;
const hold=(s,key,cond,sec)=>{ if(cond){ PR.m[key]=(PR.m[key]||0)+(PR.dtc||1/60); return PR.m[key]>=sec; } PR.m[key]=0; return false; };
const allCB=()=>P.CBS.every(c=>SYS.cb[c.k]);
const PROCS=[
 {k:'air',t:tr2('In the air: approach, hold, SID or STAR (pick ✈)','I lufta: innflyging, venting, SID eller STAR (velg ✈)'),set:'air',brief:tr2('',''),steps:[]},
 {k:'start',gen:1,t:tr2('Engine start (cold engine)','Motorstart (kald motor)'),set:'cold',brief:tr2('Parked on the apron with a cold engine, master off. Prime, start and check the engine as on a typical C172 checklist. Watch the LOW VOLTAGE light, the ammeter and the oil pressure.','Parkert på oppstillingsplassen med kald motor, hovedbryter av. Prim, start og sjekk motoren som på en typisk C172-sjekkliste. Følg LOW VOLTAGE-lyset, amperemeteret og oljetrykket.'),
  steps:[chk(tr2('Parking brake — SET','Parkeringsbrems — SATT'),'park',()=>SYS.park),
   chk(tr2('Circuit breakers — CHECK IN','Sikringer — SJEKK INNE'),'cb0',allCB),
   st(tr2('Avionics power — OFF','Avionikkbryter — AV'),'avio',()=>!SYS.avio),
   st(tr2('Fuel selector — BOTH','Drivstoffvelger — BOTH'),'fuelSel',()=>SYS.fuelSel===1),
   st(tr2('Carburettor heat — COLD (in)','Forgasservarme — KALD (inne)'),'carb',()=>!SYS.carb),
   st(tr2('Mixture — RICH (fully in)','Blanding — RIK (helt inne)'),'mix',()=>SYS.mix>0.95),
   st(tr2('Primer — 2 to 3 strokes (cold engine)','Primer — 2 til 3 slag (kald motor)'),'primer',()=>SYS.strokes>=2),
   st(tr2('Primer — IN and LOCKED','Primer — INNE og LÅST'),'primer',()=>!SYS.primer&&SYS.strokes>=2),
   st(tr2('Throttle — OPEN about ¼ inch','Gass — ÅPEN ca. ¼ tomme'),'thr',()=>SYS.thr>=0.03&&SYS.thr<=0.2),
   st(tr2('Master switch — ON (BAT and ALT)','Hovedbryter — PÅ (BAT og ALT)'),'batSw',()=>SYS.batSw&&SYS.altSw),
   chk(tr2('LOW VOLTAGE light — ON (battery only) · ammeter — discharge','LOW VOLTAGE-lys — PÅ (bare batteri) · amperemeter — utlading'),'altSw',()=>EL.low&&bus()),
   st(tr2('Beacon — ON','Antikollisjonslys — PÅ'),'bcn',()=>SYS.bcn),
   st(tr2('Propeller area — CLEAR: call "Clear prop!"','Propellområdet — KLART: rop «Clear prop!»'),'mag',()=>{ if(PR.m.clear) return true; if(ENG.run||SYS.mag===4){ PR.bad=(PR.bad||0)+1; PR.m.clear=1; msg(tr2('Always call "Clear prop!" and look outside before you crank.','Rop alltid «Clear prop!» og se deg rundt før du starter.')); return true; } return false; },{call:'clear'}),
   st(tr2('Ignition — START; release to BOTH as soon as the engine fires','Tenning — START; slipp til BOTH så snart motoren tenner'),'mag',()=>ENG.run&&SYS.mag===3),
   st(tr2('Throttle — about 1,000 RPM','Gass — ca. 1000 o/min'),'thr',()=>hold(null,'rpm1k',Math.abs(ENG.rpm-1000)<150,1)),
   chk(tr2('Oil pressure — rising into the green within 30 seconds','Oljetrykk — stiger mot grønt innen 30 sekunder'),'thr',()=>ENG.oilP>=30),
   chk(tr2('Ammeter — charging · LOW VOLTAGE light — OUT','Amperemeter — lader · LOW VOLTAGE-lys — AV'),'altSw',()=>!EL.low&&EL.amps>0.5),
   st(tr2('Avionics power — ON','Avionikkbryter — PÅ'),'avio',()=>SYS.avio),
   st(tr2('NAV/COM 1 — ON','NAV/COM 1 — PÅ'),'pwr1',()=>SYS.pwr1>0.1),
   st(tr2('Transponder — STANDBY','Transponder — STANDBY'),'xpMd',()=>SYS.xpMd===1),
   chk(tr2('Flaps — UP','Flaps — OPPE'),'flaps',()=>S.ctl.flap===0)]},
 {k:'runup',gen:1,t:tr2('Run-up and before take-off','Run-up og før avgang'),set:'runup',brief:tr2('Engine running at the holding point. Run-up at 1,700 RPM: magnetos (max 125 RPM drop, max 50 RPM difference), carburettor heat, suction, engine instruments, idle; then set up for take-off.','Motoren går ved venteposisjonen. Run-up på 1700 o/min: magneter (maks 125 o/min fall, maks 50 o/min forskjell), forgasservarme, sug, motorinstrumenter, tomgang; gjør så klar for avgang.'),
  steps:[chk(tr2('Parking brake — SET','Parkeringsbrems — SATT'),'park',()=>SYS.park),
   st(tr2('Flight controls — FREE and CORRECT (full travel each way)','Flykontroller — FRIE og KORREKTE (fullt utslag hver vei)'),'yokeL',()=>PR.m.yx&&PR.m.yy),
   st(tr2('Elevator trim — TAKE-OFF','Høyderortrim — TAKE-OFF'),'trim',()=>Math.abs(S.ctl.trim)<0.07),
   st(tr2('Heading indicator — SET to the magnetic compass','Kursgyro — STILL etter magnetkompasset'),'dgK',()=>near(VAC.hdg,CMP.c,4)),
   st(tr2('Altimeter — SET QNH 1013 (field elevation 0 ft)','Høydemåler — STILL QNH 1013 (flyplasshøyde 0 ft)'),'baroK',()=>Math.abs(S.baro-S.env.qnh)<0.6),
   st(tr2('Throttle — 1,700 RPM','Gass — 1700 o/min'),'thr',()=>hold(null,'r17',Math.abs(ENG.rpm-1700)<60,1.5)),
   st(tr2('Magnetos — R: note the RPM drop','Magneter — R: merk turtallsfallet'),'mag',()=>PR.m.magR!=null),
   st(tr2('Magnetos — BOTH, then L: note the RPM drop','Magneter — BOTH, så L: merk turtallsfallet'),'mag',()=>PR.m.magL!=null),
   st(tr2('Magnetos — BOTH (max 125 RPM drop, 50 RPM difference)','Magneter — BOTH (maks 125 o/min fall, 50 o/min forskjell)'),'mag',()=>SYS.mag===3&&PR.m.magR!=null&&PR.m.magL!=null),
   st(tr2('Carburettor heat — HOT: note the RPM drop','Forgasservarme — VARM: merk turtallsfallet'),'carb',()=>PR.m.heatDrop!=null),
   st(tr2('Carburettor heat — COLD','Forgasservarme — KALD'),'carb',()=>!SYS.carb&&PR.m.heatDrop!=null),
   chk(tr2('Suction — in the green (4.5–5.4 in Hg)','Sug — i grønt (4,5–5,4 in Hg)'),'thr',()=>VAC.suction>=4.5&&VAC.suction<=5.4),
   chk(tr2('Engine instruments and ammeter — green, charging','Motorinstrumenter og amperemeter — grønt, lader'),'thr',()=>ENG.oilP>=50&&!EL.low),
   st(tr2('Throttle — IDLE (check smooth idle), then 1,000 RPM','Gass — TOMGANG (sjekk jevn tomgang), så 1000 o/min'),'thr',()=>PR.m.idle&&Math.abs(ENG.rpm-1000)<150),
   st(tr2('Flaps — 0° to 10° for take-off','Flaps — 0° til 10° for avgang'),'flaps',()=>S.ctl.flap<=1),
   chk(tr2('Fuel selector BOTH · mixture RICH · primer locked','Drivstoffvelger BOTH · blanding RIK · primer låst'),'fuelSel',()=>SYS.fuelSel===1&&SYS.mix>0.95&&!SYS.primer),
   st(tr2('Transponder — ALT','Transponder — ALT'),'xpMd',()=>SYS.xpMd===3),
   st(tr2('Landing light — ON','Landingslys — PÅ'),'land',()=>SYS.land),
   st(tr2('Strobes — ON','Strobelys — PÅ'),'strobe',()=>SYS.strobe),
   st(tr2('Parking brake — RELEASE','Parkeringsbrems — LØS'),'park',()=>!SYS.park)]},
 {k:'circuit',t:tr2('Normal take-off and circuit','Normal avgang og landingsrunde'),set:'runway',brief:tr2('Lined up on runway 36 with the engine running. Full power, rotate at 55 KIAS, climb at 70–80 KIAS, left-hand circuit at 1,000 ft, carb heat on the downwind, flaps in stages and land.','Oppstilt på bane 36 med motoren i gang. Full gass, rotasjon ved 55 KIAS, stigning i 70–80 KIAS, venstre landingsrunde i 1000 ft, forgasservarme på medvind, flaps trinnvis og land.'),
  steps:[st(tr2('Lined up: heading 360, flaps UP, carb heat COLD, mixture RICH','Oppstilt: kurs 360, flaps OPPE, forgasservarme KALD, blanding RIK'),'flaps',()=>S.ctl.flap<=1&&!SYS.carb&&SYS.mix>0.95,{chk:1,sop:1}),
   st(tr2('Throttle — FULL (smoothly)','Gass — FULL (jevnt)'),'thr',()=>SYS.thr>0.95),
   chk(tr2('Engine instruments green, airspeed alive','Motorinstrumenter grønt, fartsmåler lever'),'thr',()=>S.o.ias>30),
   st(tr2('Rotate at 55 KIAS — lift off','Roter ved 55 KIAS — løft av'),'yokeL',()=>!S.ground),
   st(tr2('Climb at 70–80 KIAS (Vy 76), positive rate','Stig i 70–80 KIAS (Vy 76), positiv stigning'),'yokeL',()=>S.o.vs>250&&S.o.ias>62&&S.o.ias<88&&S.o.agl>200),
   st(tr2('At 500 ft: climbing left turn onto crosswind (heading 270)','Ved 500 ft: stigende venstresving til crosswind (kurs 270)'),'yokeL',()=>near(S.o.hdg,270,15)&&S.o.agl>450),
   st(tr2('Level at 1,000 ft: throttle about 2,300 RPM','Plan i 1000 ft: gass ca. 2300 o/min'),'thr',()=>Math.abs(S.o.alt-1000)<120&&ENG.rpm>2100&&ENG.rpm<2450&&Math.abs(S.o.vs)<300),
   st(tr2('Downwind: heading 180','Medvind: kurs 180'),'yokeL',()=>near(S.o.hdg,180,15)),
   st(tr2('Abeam the threshold: carb heat HOT, throttle about 1,500 RPM','Tvers av terskelen: forgasservarme VARM, gass ca. 1500 o/min'),'carb',()=>SYS.carb&&ENG.rpm<1800),
   st(tr2('Below 110 KIAS: flaps 10°','Under 110 KIAS: flaps 10°'),'flaps',()=>S.ctl.flap>=1&&S.o.ias<112),
   st(tr2('Base: heading 090, flaps 20°, 70 KIAS','Base: kurs 090, flaps 20°, 70 KIAS'),'flaps',()=>near(S.o.hdg,90,25)&&S.ctl.flap>=2),
   st(tr2('Final: heading 360, flaps FULL, 65 KIAS','Finale: kurs 360, flaps FULL, 65 KIAS'),'flaps',()=>near(S.o.hdg,360,15)&&S.ctl.flap===3),
   st(tr2('Land on the runway: flare, main wheels first','Land på banen: flare, hovedhjulene først'),'yokeL',()=>S.ground&&S.landed&&!S.landed.field),
   st(tr2('After landing: flaps UP, carb heat COLD','Etter landing: flaps OPPE, forgasservarme KALD'),'flaps',()=>S.ctl.flap===0&&!SYS.carb,{sop:1})]},
 {k:'eftoa',own:['efato','eng'],t:tr2('Engine failure after take-off','Motorstopp etter avgang'),set:'eftoa',fail:'eng',brief:tr2('Climbing out through 350 ft above the runway end at 70 KIAS. The engine is about to stop. Lower the nose at once, land straight ahead in the fields, and secure the engine. Do not turn back.','Stiger ut gjennom 350 ft over baneenden i 70 KIAS. Motoren stopper snart. Senk nesa straks, land rett fram på jordene, og sikre motoren. Ikke snu tilbake.'),
  steps:[st(tr2('Engine failure! Lower the nose — airspeed 65 KIAS','Motorstopp! Senk nesa — fart 65 KIAS'),'yokeL',()=>PR.failed&&hold(null,'g65',S.o.ias>58&&S.o.ias<74,1.5)),
   chk(tr2('Land straight ahead — pick a field within 30° of the nose; no turn back','Land rett fram — velg et jorde innen 30° av nesa; ikke snu'),'yokeL',()=>near(S.o.hdg,360,30)),
   st(tr2('Mixture — IDLE CUT-OFF','Blanding — IDLE CUT-OFF'),'mix',()=>SYS.mix<0.04,{emer:1}),
   st(tr2('Fuel selector — OFF','Drivstoffvelger — OFF'),'fuelSel',()=>SYS.fuelSel===3,{emer:1}),
   st(tr2('Ignition — OFF','Tenning — OFF'),'mag',()=>SYS.mag===0,{emer:1}),
   st(tr2('Flaps — as required (FULL for the landing)','Flaps — etter behov (FULL for landingen)'),'flaps',()=>S.ctl.flap>=2,{emer:1}),
   st(tr2('Master switch — OFF (after the flaps)','Hovedbryter — AV (etter flapsene)'),'batSw',()=>!SYS.batSw,{emer:1}),
   st(tr2('Touch down at minimum speed, brake to a stop','Sett ned med minste fart, brems til stans'),'yokeL',()=>S.ground&&Math.abs(S.Vg)<2)]},
 {k:'carbice',own:'carb',t:tr2('Carburettor icing in cruise','Forgasserising i marsj'),set:'cruise',ice:3,brief:tr2('4,500 ft in humid air just above freezing, cruise RPM. Ice is building in the carburettor. Watch the tachometer: the first sign is a slow RPM drop.','4500 ft i fuktig luft like over null grader, marsjturtall. Is bygger seg opp i forgasseren. Følg turtelleren: første tegn er et sakte turtallsfall.'),
  steps:[chk(tr2('Cruise about 2,400 RPM — scan the tachometer and altimeter','Marsj ca. 2400 o/min — skann turteller og høydemåler'),'thr',()=>PR.t>5),
   chk(tr2('RPM dropping, then rough running — suspect carburettor ice','Turtallet faller, så ujevn gange — mistenk forgasseris'),'carb',()=>ENG.ice>0.35),
   st(tr2('Carburettor heat — FULL HOT','Forgasservarme — HELT VARM'),'carb',()=>SYS.carb,{emer:1}),
   chk(tr2('Expect rougher running and a further drop while the ice melts — hold attitude','Forvent ujevnere gange og mer turtallsfall mens isen smelter — hold attityden'),'carb',()=>ENG.water>0.15||ENG.ice<0.05),
   st(tr2('Throttle — FULL OPEN','Gass — HELT ÅPEN'),'thr',()=>SYS.thr>0.95,{emer:1}),
   chk(tr2('RPM recovers as the ice clears','Turtallet tar seg opp når isen er borte'),'thr',()=>ENG.ice<0.03&&ENG.water<0.05),
   st(tr2('Mixture — adjust for smooth running','Blanding — juster for jevn gange'),'mix',()=>PR.m.mixMoved,{emer:1}),
   st(tr2('Carburettor heat — COLD; set cruise power and keep watching','Forgasservarme — KALD; sett marsjeffekt og følg med videre'),'carb',()=>!SYS.carb&&ENG.rpm>2200&&ENG.rpm<2550,{emer:1})]},
 {k:'vac',own:'vac',t:tr2('Vacuum failure (partial panel)','Vakuumsvikt («partial panel»)'),set:'cruise',fail:'vac',brief:tr2('3,500 ft in cruise. The vacuum pump is about to fail; the attitude and heading indicators will slowly become unreliable while looking normal. Catch it on the suction gauge, cover the failed instruments and fly on the turn coordinator, altimeter, VSI, ASI and compass.','3500 ft i marsj. Vakuumpumpa svikter snart; horisonten og kursgyroen blir sakte upålitelige mens de ser normale ut. Oppdag det på suggauge, dekk til de svikta instrumentene og fly på svingkoordinator, høydemåler, variometer, fartsmåler og kompass.'),
  steps:[chk(tr2('Cruise — suction in the green','Marsj — sug i grønt'),'thr',()=>PR.t>4),
   chk(tr2('Suction gauge — LOW: vacuum pump failure','Suggauge — LAVT: vakuumpumpesvikt'),'thr',()=>VAC.suction<1),
   st(tr2('Cover the attitude indicator','Dekk til horisonten'),'covAI',()=>SYS.covAI),
   st(tr2('Cover the heading indicator','Dekk til kursgyroen'),'covDG',()=>SYS.covDG),
   st(tr2('Partial panel: wings level on the turn coordinator, hold altitude ±100 ft for 20 s','Partial panel: vingene vannrett på svingkoordinatoren, hold høyden ±100 ft i 20 s'),'yokeL',()=>hold(null,'pp',Math.abs(S.o.roll)<6&&Math.abs(S.o.alt-3500)<100,20)),
   st(tr2('Standard-rate turn to 090 on the compass (allow for the turning error), wings level','Standardsving til 090 på kompasset (husk svingfeilen), vingene vannrett'),'yokeL',()=>hold(null,'c90',near(CMP.c,90,10)&&Math.abs(S.o.roll)<5,3)),
   chk(tr2('Tell ATC and land as soon as practical','Si fra til ATC og land så snart det er praktisk'),'micSel',()=>PR.t>2)]},
 {k:'alt',own:'alt',t:tr2('Alternator failure','Generatorsvikt'),set:'cruise',fail:'alt',brief:tr2('3,500 ft in cruise. The alternator control unit is about to trip. Follow the LOW VOLTAGE flow: reset once by cycling the master, and when the light comes back, take the alternator off line and shed load.','3500 ft i marsj. Generatorregulatoren er i ferd med å slå ut. Følg LOW VOLTAGE-flyten: nullstill én gang ved å slå hovedbryteren av og på, og når lyset kommer tilbake, koble ut generatoren og reduser forbruket.'),
  steps:[chk(tr2('LOW VOLTAGE light — ON, ammeter — discharge','LOW VOLTAGE-lys — PÅ, amperemeter — utlading'),'altSw',()=>EL.low&&EL.amps<0),
   st(tr2('Avionics power — OFF','Avionikkbryter — AV'),'avio',()=>!SYS.avio,{emer:1}),
   st(tr2('Master switch — OFF (both halves)','Hovedbryter — AV (begge halvdeler)'),'batSw',()=>!SYS.batSw&&!SYS.altSw,{emer:1}),
   st(tr2('Master switch — ON (both halves)','Hovedbryter — PÅ (begge halvdeler)'),'batSw',()=>SYS.batSw&&SYS.altSw,{emer:1}),
   chk(tr2('LOW VOLTAGE light — OUT, ammeter charging','LOW VOLTAGE-lys — AV, amperemeter lader'),'altSw',()=>!EL.low&&EL.altOn),
   st(tr2('Avionics power — ON','Avionikkbryter — PÅ'),'avio',()=>SYS.avio,{emer:1}),
   chk(tr2('LOW VOLTAGE light comes on again — the alternator has failed','LOW VOLTAGE-lyset tennes igjen — generatoren har sviktet'),'altSw',()=>EL.trip&&EL.low),
   st(tr2('Master switch ALT half — OFF','Hovedbryterens ALT-halvdel — AV'),'altSw',()=>!SYS.altSw&&SYS.batSw,{emer:1}),
   st(tr2('Non-essential load OFF: landing and taxi lights, pitot heat, NAV/COM 2, ADF, DME','Unødvendig forbruk AV: landings- og takselys, pitotvarme, NAV/COM 2, ADF, DME'),'land',()=>!SYS.land&&!SYS.taxi&&!SYS.pitot&&SYS.pwr2<0.05&&SYS.adfPwr<0.05&&!SYS.dmePwr,{emer:1}),
   chk(tr2('Land as soon as practical — the battery lasts a limited time','Land så snart det er praktisk — batteriet varer en begrenset tid'),'batSw',()=>EL.amps>-12)]},
 {k:'ils',t:tr2('ILS approach (VOR, ADF and DME cross-check)','ILS-innflyging (krysskontroll med VOR, ADF og DME)'),set:'ils',brief:tr2('2,500 ft, 9 NM south of the field, heading 030 to intercept the runway 36 localizer. Tune and identify the ILS on NAV 1, set the course, intercept and fly the glideslope down to 200 ft, then land.','2500 ft, 9 NM sør for flyplassen, kurs 030 for å avskjære localizeren til bane 36. Still inn og identifiser ILS-en på NAV 1, sett kursen, avskjær og fly glidebanen ned til 200 ft, og land.'),
  steps:[st(tr2('NAV 1 — 110.30 ILS: transfer to in-use','NAV 1 — 110.30 ILS: overfør til aktiv'),'navX1',()=>SYS.nav1.a==='110.30'),
   st(tr2('NAV 1 audio and ident ON — identify I-ASN','NAV 1 lyd og ident PÅ — identifiser I-ASN'),'navId1',()=>SYS.navId1&&SYS.auN1),
   st(tr2('OBS 1 — set the inbound course 360','OBS 1 — sett innkommende kurs 360'),'obs1',()=>near(SYS.crs1,360,3)),
   st(tr2('DME — N1 (distance to the ILS)','DME — N1 (avstand til ILS-en)'),'dmeMd',()=>SYS.dmeMd===0&&SYS.dmePwr),
   st(tr2('Intercept the localizer: turn to 360 as the needle centres','Avskjær localizeren: sving til 360 når nåla sentreres'),'yokeL',()=>curNav1&&curNav1.valid&&Math.abs(curNav1.dev)<0.3&&near(S.o.hdg,360,15)),
   st(tr2('Before the glideslope: carb heat HOT, 90 KIAS, flaps 10°','Før glidebanen: forgasservarme VARM, 90 KIAS, flaps 10°'),'carb',()=>SYS.carb&&S.ctl.flap>=1,{sop:1}),
   st(tr2('Glideslope centred: reduce to about 1,700 RPM, descend ~450 ft/min','Glidebanen sentrert: reduser til ca. 1700 o/min, synk ~450 ft/min'),'thr',()=>curNav1&&curNav1.gs&&Math.abs(curNav1.gs.dev)<0.4&&S.o.vs<-250),
   st(tr2('Track the localizer and glideslope to 200 ft (decision altitude)','Følg localizer og glidebane ned til 200 ft (beslutningshøyde)'),'yokeL',()=>S.o.agl<300&&curNav1&&Math.abs(curNav1.dev)<0.6),
   st(tr2('Runway in sight: flaps FULL, 65 KIAS','Banen i sikte: flaps FULL, 65 KIAS'),'flaps',()=>S.ctl.flap===3),
   st(tr2('Land','Land'),'yokeL',()=>S.ground&&S.landed&&!S.landed.field)]},
 {k:'free',t:tr2('Free flight','Fri flyging'),set:'free',brief:tr2('3,000 ft, cruise power, heading 360 south of the field. Lean the mixture on the EGT, try stalls with the horn, steep turns, the compass errors, or a failure from the Failures section.','3000 ft, marsjeffekt, kurs 360 sør for flyplassen. Len blandingen etter EGT, prøv steiling med varselhornet, bratte svinger, kompassfeilene, eller en feil fra Feil-seksjonen.'),steps:[]}
];
const PR={k:null,i:0,done:[],t:0,failed:false,m:{}};
function cruiseEng(rpmT){ SYS.thr=0.62; for(let i=0;i<400;i++){ const o=F.readouts(S); CC.engStep(ENG,{thr:SYS.thr,mix:SYS.mix,heat:0,mags:3,starter:false,fuel:true,ias:o.ias,alt:o.altTrue,oat:oatAt(o.altTrue),rh:0.3,rnd:0.5},0.05); SYS.thr=F.clamp(SYS.thr+(rpmT-ENG.rpm)*0.00008,0.2,1); } ENG.ice=0; ENG.water=0; ENG.oilT=185; ENG.oilP=72; ENG.egt=1300; }
function procSet(p){ const kind=p.set;
  S.env.wdir=windDir.v; S.env.wspd=windSpd.v; S.env.turb=turb.v/100; S.baro=S.env.qnh=1013; ENV.ice=p.ice||1;
  if(p.ice){ ENV.oat=13; ENV.rh=0.95; } else { ENV.oat=oatS.v; ENV.rh=rhS.v/100; } S.env.isa=ENV.oat-15;
  if(kind==='cold'){ F.place(S,{ground:true,N:800,E:190,hdg:270,thr:0,flap:0}); sysDefault(false); }
  else if(kind==='runup'){ F.place(S,{ground:true,N:62,E:58,hdg:270,thr:0,flap:0}); sysDefault(true); SYS.thr=0.07; SYS.park=1; SYS.xpMd=1; SYS.land=0; S.ctl.trim=-0.45; S.baro=1003; VAC.hdg=F.wrap360(270+16); }
  else if(kind==='runway'){ F.place(S,{ground:true,N:20,E:0,hdg:360,thr:0,flap:0}); sysDefault(true); SYS.thr=0.07; SYS.land=SYS.strobe=SYS.navL=1; S.ctl.trim=0; }
  else if(kind==='eftoa'){ F.place(S,{N:1380,E:0,alt:350,ias:70,hdg:360,flap:0,gam:4}); sysDefault(true); SYS.thr=1; SYS.land=SYS.strobe=1; }
  else if(kind==='ils'){ F.place(S,{N:-16400,E:-1900,alt:2500,ias:95,hdg:30,flap:0}); sysDefault(true); cruiseEng(2250); SYS.nav1={a:'113.30',s:'110.30'}; SYS.nav2={a:'113.30',s:'110.30'}; SYS.crs1=30; SYS.crs2=360; SYS.adfMd=1; SYS.auMkr=1; SYS.navL=SYS.strobe=1; }
  else if(kind==='air'){ const D=AF.D, st=D.start, to=D.cfg==='to'; F.WORLD.gsOut=!!D.gsOut;
    F.place(S,{N:st.N,E:st.E,alt:st.alt,ias:st.ias,hdg:st.hdg,flap:0,gam:st.gam||0}); sysDefault(true);
    if(to){ SYS.thr=1; const o=F.readouts(S); for(let i=0;i<200;i++) CC.engStep(ENG,{thr:1,mix:1,heat:0,mags:3,starter:false,fuel:true,ias:st.ias,alt:o.altTrue,oat:15,rh:0.3,rnd:0.5},0.05); SYS.land=1; }
    else cruiseEng(st.ias>95?2400:2250);
    SYS.nav1={a:'110.30',s:'113.30'}; SYS.nav2={a:'113.30',s:'110.30'}; SYS.crs1=360; SYS.crs2=D.k==='sid'?324:D.k==='star'?199:360; SYS.adf={a:'375',s:'287'}; SYS.adfMd=1; SYS.auMkr=1; SYS.navL=SYS.strobe=1; SYS.dmeMd=0; }
  else { const alt=p.k==='carbice'?4500:kind==='free'?3000:3500; F.place(S,{N:-30000,E:2500,alt,ias:100,hdg:360,flap:0}); sysDefault(true); cruiseEng(2400); SYS.navL=SYS.strobe=1; if(p.k==='carbice') ENG.ice=0.08; }
  if(!S.ground&&kind!=='eftoa'){ /* keep the place() trim */ }
  if(kind!=='air') F.WORLD.gsOut=false;
  if(kind!=='cold'){ ENG.oilT=Math.max(ENG.oilT,160); EL.soc=0.95; VAC.ai=VAC.dg=1; VAC.eR=VAC.eP=0; if(kind!=='runup') VAC.hdg=F.wrap360(S.psi*180/Math.PI); CMP.c=F.wrap360(S.psi*180/Math.PI); }
  if(kind==='eftoa') { const o=F.readouts(S); for(let i=0;i<200;i++) CC.engStep(ENG,{thr:1,mix:1,heat:0,mags:3,starter:false,fuel:true,ias:70,alt:o.altTrue,oat:15,rh:0.3,rnd:0.5},0.05); }
  S.autotrim=el('autoTrim').checked; holdPitch=null; holdRoll=null; turnRate=0; lastHdg=null; accel=0; lastIas=F.readouts(S).ias; vsF=0; inp.rudI=0; rud.set(0); inp.rudUser=0; S.trail.length=0; riskText();
}
/* ---------- airborne procedures and the "instructor" auto-fly (airproc.js); the C172 has no autopilot ---------- */
const AIRCAPS={gps:null,adf:true}; let AIRK='ils';
const AF=AIRPROC.autofly({type:'C172',S,F,AP:null,power:{get:()=>SYS.thr,set:v=>{ SYS.thr=F.clamp(v,0,1); }},
  say:(m,c)=>{ pill(m,c==='bad'?'bad':'ok'); flash(m); },cfg:()=>({gear:1,flap:S.ctl.flap}),onOff:()=>{ holdRoll=null; holdPitch=null; airUI(); }});
function airSteps(k){ const app=AIRPROC.isApp(k)||k==='star';
  if(k==='sid') return [st(tr2('Mixture — RICH for the climb','Blanding — RIK i stigningen'),'mix',()=>SYS.mix>0.9,{chk:1,sop:1}),
    st(tr2('Carburettor heat — OFF (cold) for the climb','Forgasservarme — AV (kald) i stigningen'),'carb',()=>!SYS.carb,{sop:1}),
    st(tr2('OBS 2 — 324 to cross-check OSVIK on ASN R-324 (FROM)','OBS 2 — 324 for å krysskontrollere OSVIK på ASN R-324 (FROM)'),'obs2',()=>near(SYS.crs2,324,3)),
    st(tr2('Landing light — OFF after the climb is established','Landingslys — AV når stigningen er etablert'),'land',()=>!SYS.land,{sop:1})];
  if(k==='hold') return [st(tr2('DME — N1: RONAX is D10.0 IASN','DME — N1: RONAX er D10,0 IASN'),'dmeMd',()=>SYS.dmeMd===0&&SYS.dmePwr),
    st(tr2('Carburettor heat — check (ON if in doubt at reduced power)','Forgasservarme — sjekk (PÅ ved tvil på redusert effekt)'),'carb',()=>PR.m.carbChk||SYS.carb,{sop:1}),
    chk(tr2('Holding speed — about 90 KIAS','Ventefart — ca. 90 KIAS'),'thr',()=>S.o.ias<100)];
  if(!app) return [];
  const L0=[chk(tr2('NAV 1 — 110.30 ILS in use, OBS 1 on 360','NAV 1 — 110.30 ILS aktiv, OBS 1 på 360'),'navX1',()=>SYS.nav1.a==='110.30'&&near(SYS.crs1,360,3)),
    st(tr2('NAV 1 ident — ON, identify I-ASN','NAV 1 ident — PÅ, identifiser I-ASN'),'navId1',()=>SYS.navId1&&SYS.auN1)];
  if(k==='ndb') L0.push(st(tr2('ADF — 375 (AN) in ADF mode, identify','ADF — 375 (AN) i ADF-modus, identifiser'),'adfMd',()=>SYS.adf.a==='375'&&SYS.adfMd&&SYS.auAdf));
  return L0.concat([st(tr2('Fuel selector — BOTH','Drivstoffvelger — BOTH'),'fuelSel',()=>SYS.fuelSel===1,{sop:1}),
    st(tr2('Mixture — RICH','Blanding — RIK'),'mix',()=>SYS.mix>0.9,{chk:1,sop:1}),
    st(tr2('Carburettor heat — ON before reducing power','Forgasservarme — PÅ før du reduserer effekten'),'carb',()=>SYS.carb,{sop:1}),
    st(tr2('Landing light — ON','Landingslys — PÅ'),'land',()=>SYS.land,{sop:1}),
    st(tr2('Flaps 10° before the glideslope / final descent','Flaps 10° før glidebanen / sluttinnflygingen'),'flaps',()=>S.ctl.flap>=1,{sop:1}),
    st(tr2('Minimums: runway in sight — flaps 30° and land; otherwise go around','Minima: banen i sikte — flaps 30° og land; ellers gå rundt'),'flaps',()=>S.ctl.flap>=3||!!AF.rec.decision)]); }
function airUI(){ if(!AIRUI) return; AIRUI.draw(PR.k==='air'?AIRK:PR.k==='free'?'free':'',AF.on,PR.k&&PR.k!=='air'&&PR.k!=='free'?PR.k:null); }
function pickProc(k){ AIRK=k==='free'?AIRK:k; procStart(k==='free'?'free':'air'); }
function toggleAuto(){ if(AF.on) AF.off('toggle'); else { if(PR.k!=='air'&&PR.k!=='free'){ pickProc(AIRK); } AF.engage(); } airUI(); }
let AIRUI=null, DB=null;
/* predicates for the student's own checklist (ownck.js dictionary keys) and the panel control each one highlights */
const OWNP={masterOn:()=>SYS.batSw&&SYS.altSw,masterOff:()=>!SYS.batSw,altOn:()=>!!SYS.altSw,altOff:()=>!SYS.altSw,avioOn:()=>!!SYS.avio,avioOff:()=>!SYS.avio,
  fuelBoth:()=>SYS.fuelSel===1,fuelOff:()=>SYS.fuelSel===3,mixRich:()=>SYS.mix>0.95,mixLean:()=>SYS.mix<0.9&&SYS.mix>0.05,mixCut:()=>SYS.mix<0.04,
  carbOn:()=>!!SYS.carb,carbOff:()=>!SYS.carb,thrIdle:()=>SYS.thr<0.05,thrFull:()=>SYS.thr>0.95,thrCrack:()=>SYS.thr>=0.03&&SYS.thr<=0.2,primerIn:()=>!SYS.primer,
  bcnOn:()=>!!SYS.bcn,bcnOff:()=>!SYS.bcn,strobeOn:()=>!!SYS.strobe,strobeOff:()=>!SYS.strobe,landOn:()=>!!SYS.land,landOff:()=>!SYS.land,taxiOn:()=>!!SYS.taxi,taxiOff:()=>!SYS.taxi,
  navOn:()=>!!SYS.navL,navOff:()=>!SYS.navL,pitotOn:()=>!!SYS.pitot,pitotOff:()=>!SYS.pitot,flap0:()=>S.ctl.flap===0,flap1:()=>S.ctl.flap===1,flap2:()=>S.ctl.flap===2,flap3:()=>S.ctl.flap===3,flapTO:()=>S.ctl.flap<=1,
  parkOn:()=>!!SYS.park,parkOff:()=>!SYS.park,magBoth:()=>SYS.mag===3,magOff:()=>SYS.mag===0,magStart:()=>ENG.run&&SYS.mag===3,xpSby:()=>SYS.xpMd===1,xpAlt:()=>SYS.xpMd===3,
  baroSet:()=>Math.abs(S.baro-S.env.qnh)<0.6,dgSet:()=>near(VAC.hdg,CMP.c,4),cbIn:()=>allCB(),trimTO:()=>Math.abs(S.ctl.trim)<0.07};
const OWNC={masterOn:'batSw',masterOff:'batSw',altOn:'altSw',altOff:'altSw',avioOn:'avio',avioOff:'avio',fuelBoth:'fuelSel',fuelOff:'fuelSel',mixRich:'mix',mixLean:'mix',mixCut:'mix',
  carbOn:'carb',carbOff:'carb',thrIdle:'thr',thrFull:'thr',thrCrack:'thr',primerIn:'primer',bcnOn:'bcn',bcnOff:'bcn',strobeOn:'strobe',strobeOff:'strobe',landOn:'land',landOff:'land',
  taxiOn:'taxi',taxiOff:'taxi',navOn:'navL',navOff:'navL',pitotOn:'pitot',pitotOff:'pitot',flap0:'flaps',flap1:'flaps',flap2:'flaps',flap3:'flaps',flapTO:'flaps',parkOn:'park',parkOff:'park',
  magBoth:'mag',magOff:'mag',magStart:'mag',xpSby:'xpMd',xpAlt:'xpMd',baroSet:'baroK',dgSet:'dgK',cbIn:'cb0',trimTO:'trim'};
/* safety-critical outcome after a failure (debrief "time to action"); latched: each part counts once it has held */
const latch=fs=>{ const got=fs.map(()=>0); return ()=>{ fs.forEach((f,i)=>{ if(!got[i]&&f()) got[i]=1; }); return got.every(Boolean); }; };
const OWNCRIT={eftoa:{f:[()=>PR.failed&&S.o.ias>55&&S.o.ias<75],t:tr2('nose lowered to the glide speed','nesa senket til glidefart'),lim:[6,12]},
  alt:{f:[()=>PR.failed&&(!SYS.altSw||!EL.low)],t:tr2('alternator reset or off line','generatoren nullstilt eller koblet ut'),lim:[60,120]},
  carbice:{f:[()=>PR.failed&&!!SYS.carb],t:tr2('carburettor heat on','forgasservarme på'),lim:[30,60]}};
/* generic SOP steps (sop) only with the generic-flow toggle on; the AFM emergency steps (emer) give way to the student's own
   emergency section when their checklist has one for this exercise. Simulator instructions always stay. */
const ownSteps=p=>{ const g=OWNCK.gen('C172'), own=p.own&&OCK.has(p.own); if(p.gen&&!g) return []; return p.all.filter(s=>(!s.sop||g)&&(!s.emer||!own)); };
const OCK=OWNCK.mount({type:'C172',box:el('ownck'),L,pred:k=>{ const f=OWNP[k]; return f?!!f():false; },ctl:k=>OWNC[k]||null,
  hl:id=>{ if(!curStep()) hlCtl(id); },clock:()=>DB?DB.t:0,onChange:()=>{ if(PR.k&&PR.t<2) procStart(PR.k); }});
LAB.onLang(()=>OCK.render());
function ownFail(kinds,alert){ if(OCK.failure(kinds,alert)){ setDrawer(true); SH.tab('ck'); } }
function genToggle(){ const g=el('genT'); if(!g) return; g.innerHTML=OWNCK.genHTML('C172',L); g.querySelector('input').onchange=e=>{ OWNCK.setGen('C172',e.target.checked); procStart(PR.k||'free'); genToggle(); }; }
LAB.onLang(genToggle);
function procStart(k){
  const p=PROCS.find(x=>x.k===k)||PROCS[0];
  if(UI.paused) togglePause(); S.crash=null;
  AF.off('reset',true); AF.setProc(p.k==='air'?AIRK:'free',AIRCAPS); if(p.k==='air'){ p.all=airSteps(AIRK); p.brief=AIRPROC.brief(AIRK,'C172'); } else if(!p.all) p.all=p.steps;
  p.steps=ownSteps(p);
  Object.assign(PR,{k:p.k,i:0,done:p.steps.map(()=>0),t:0,failed:false,m:{},bad:0,crit:null}); p.steps.forEach(s=>{ s.okT=0; }); OCK.reset();
  procSet(p); renderProc(); procFocus(); airUI(); if(DB) DB.start();
}
const curStep=()=>{ const p=PROCS.find(x=>x.k===PR.k); return p&&p.steps[PR.i]; };
const ctlOf=s=>typeof s.ctl==='function'?s.ctl():s.ctl;
function hlCtl(id){ P.svg.querySelectorAll('g.ctl.hl').forEach(g=>g.classList.remove('hl')); if(!id) return; const o=P.byId[id]; if(o) o.g.classList.add('hl'); }
function procFocus(){ const s=curStep(); if(!s){ hlCtl(null); pill(null); return; } const id=ctlOf(s); hlCtl(id); pill(L(s.t));
  if(el('follow').checked&&!Z.lock){ const o=P.byId[id]; if(o){ const b=o.g.getBBox(); const k=regionAt({x:b.x+b.width/2,y:b.y+b.height/2}); if(k&&k!==Z.reg) zoomTo(k); } } }
let pillT=0;
function pill(t,cls){ if(!t){ SH.step(null); return; } if(cls){ SH.say(t,cls); pillT=1.8; } else SH.step(t); }
function procTouch(k){ const s=curStep(); if(!s) return; const id=ctlOf(s);
  if(k===id||/^(stick|trim|yoke|dim|r_|cb|com|nav|pwr|adf|xp|au|baro|obs|dg|ai|egt|mkr|cov)/.test(k)) return;
  const p=PROCS.find(x=>x.k===PR.k); const later=p.steps.slice(PR.i+1).some(x=>ctlOf(x)===k);
  if(later){ pill(L(tr2('Not yet — next: ','Ikke ennå — neste: '))+L(s.t),'bad'); beep(220,0.12,0.05); PR.bad=(PR.bad||0)+1; const o=P.byId[k]; if(o){ o.g.classList.add('bad'); setTimeout(()=>o.g.classList.remove('bad'),900); } }
}
/* magneto and carburettor-heat checks at the run-up: record the drops */
function runupWatch(dt){ const m=PR.m;
  if(SYS.mag===3&&!SYS.carb&&ENG.run&&Math.abs(ENG.rpm-1700)<90){ m.base=(m.base==null?ENG.rpm:m.base+(ENG.rpm-m.base)*Math.min(1,dt)); }
  ['R','L'].forEach((s,i)=>{ const pos=i?2:1; if(SYS.mag===pos&&m.base!=null){ m['t'+s]=(m['t'+s]||0)+dt; if(m['t'+s]>2.5&&m['mag'+s]==null){ m['mag'+s]=ENG.rpm; const d=Math.round(m.base-ENG.rpm); pill(`${s}: −${d} RPM`+(d>125?L(tr2(' — more than 125: do not take off',' — mer enn 125: ikke ta av')):d<5?L(tr2(' — no drop: suspect the magneto grounding (P-lead)',' — ikke noe fall: mistenk jordingen (P-lead)')):''),d>125||d<5?'bad':'ok'); } } else m['t'+s]=0; });
  if(m.magR!=null&&m.magL!=null&&!m.judged&&SYS.mag===3){ m.judged=1; const j=CC.magJudge(m.base,m.magR,m.magL); pill(`R −${j.dR} · L −${j.dL} · Δ ${j.diff} RPM — `+L(j.ok?tr2('within limits','innenfor grensene'):tr2('outside limits: do not take off','utenfor grensene: ikke ta av')),j.ok?'ok':'bad'); }
  if(SYS.carb&&m.base!=null){ m.tH=(m.tH||0)+dt; if(m.tH>3&&m.heatDrop==null){ m.heatDrop=Math.round(m.base-ENG.rpm); pill(L(tr2('Carb heat: ','Forgasservarme: '))+'−'+m.heatDrop+' RPM'+(ENG.water>0.05?L(tr2(' — rough, then rising: there was ice',' — ujevn og så stigende: det var is')):''),'ok'); } } else m.tH=0;
  if(SYS.thr<0.02&&ENG.run&&ENG.rpm<760&&ENG.rpm>500) m.idle=1; }
function procTick(dt){
  OCK.tick(dt);
  const p=PROCS.find(x=>x.k===PR.k); if(!p) return; PR.t+=dt; PR.dtc=dt;
  if(inp.stick){ if(Math.abs(inp.stick.x)>0.6) PR.m.yx=1; if(Math.abs(inp.stick.y)>0.6) PR.m.yy=1; }
  if(p.k==='runup') runupWatch(dt);
  if(p.fail&&!PR.failed){
    if(p.fail==='eng'&&PR.t>2.5){ ENG.failed=true; PR.failed=true; PR.failT=PR.t; ownFail(p.own,'ENGINE FAILURE'); }
    if(p.fail==='vac'&&PR.t>6){ VAC.pump=false; VAC.ai=Math.min(VAC.ai,0.75); VAC.dg=Math.min(VAC.dg,0.7); PR.failed=true; PR.failT=PR.t; }
    if(p.fail==='alt'&&PR.t>6){ EL.trip=true; PR.failed=true; PR.failT=PR.t; ownFail(p.own,'LOW VOLTAGE'); }
    if(p.fail==='vac'&&PR.failed) ownFail(p.own,'VACUUM');
  }
  if(p.k==='carbice'&&!PR.failed&&ENG.ice>0.35){ PR.failed=true; PR.failT=PR.t; ownFail(p.own,'CARB ICE'); }
  if(p.fail==='alt'&&PR.m.reset&&!PR.m.retripSet){ PR.m.retripSet=1; EL.retrip=25; }
  if(pillT>0){ pillT-=dt; if(pillT<=0) procFocus(); }
  const s=p.steps[PR.i]; if(!s) return;
  if(s.ok.call(s)){ s.okT=(s.okT||0)+dt; if(!s.chk||s.okT>0.6){ s.okT=0; PR.done[PR.i]=1; PR.i++; beep(880,0.07,0.05); renderProc(); if(PR.i>=p.steps.length){ hlCtl(null); pill(L(tr2('Checklist complete','Sjekkliste fullført')),'ok'); if(window.NPROG) try{ NPROG.award('c172:'+p.k,100); }catch(e){} } else { procFocus(); pill('✓ '+L(p.steps[PR.i-1].t),'ok'); } } }
  else s.okT=0;
}
function renderProc(){
  const p=PROCS.find(x=>x.k===PR.k); if(!p){ el('proc').innerHTML=''; return; }
  const cur=p.steps[PR.i];
  el('proc').innerHTML=`${cur?`<div class="next"><small>${L(tr2('Next step','Neste steg'))} ${PR.i+1}/${p.steps.length}</small><b>${L(cur.t)}</b>${cur.call?`<div class="row"><button id="pCall">📣 ${L(tr2('Call "Clear prop!"','Rop «Clear prop!»'))}</button></div>`:''}<div class="row"><button id="pBack"${PR.i?'':' disabled'}>← ${L(tr2('Back','Tilbake'))}</button><button id="pSkip">${L(tr2('Skip','Hopp over'))} →</button></div></div>`:''}<p class="brief">${L(p.brief)}</p>${p.steps.length?`<ul class="checks">${p.steps.map((s,i)=>`<li class="${PR.done[i]===1?'ok':PR.done[i]===2?'skip':i===PR.i?'now':''}"><i>${PR.done[i]===1?'✓':PR.done[i]===2?'–':i+1}</i><span>${L(s.t)}${s.chk?`<small>${L(tr2('check','sjekk'))}</small>`:''}</span></li>`).join('')}</ul>`:''}
   ${p.steps.length&&PR.i>=p.steps.length?`<div class="callout blue"><b>${L(tr2('Checklist complete.','Sjekklisten er fullført.'))}</b></div>`:''}
   <div class="row"><button id="procRe">${L(tr2('Restart scenario','Start scenarioet på nytt'))}</button></div>`;
  if(el('pSkip')){ el('pSkip').onclick=()=>{ PR.done[PR.i]=2; PR.i++; renderProc(); if(PR.i<p.steps.length) procFocus(); else { hlCtl(null); pill(null); } }; el('pBack').onclick=()=>{ if(!PR.i) return; PR.i--; PR.done[PR.i]=0; renderProc(); procFocus(); }; }
  if(el('pCall')) el('pCall').onclick=()=>{ PR.m[cur.call]=1; pill('“Clear prop!”','ok'); beep(700,0.12,0.04); };
  el('procRe').onclick=()=>procStart(PR.k);
  const now=el('proc').querySelector('li.now'); if(now) now.scrollIntoView({block:'nearest'});
}
LAB.onLang(()=>{ renderProc(); if(PR.k) procFocus(); });
function setDrawer(on){ el('drawer').classList.toggle('open',on); el('bDrawer').setAttribute('aria-pressed',on); setTimeout(()=>zoomTo(Z.reg,true,true),320); }
el('bDrawer').onclick=()=>setDrawer(!el('drawer').classList.contains('open'));
/* ---------- Procedures drawer: Speeds, Emergency and Failures tabs (the same component on every trainer, simshell.js) ---------- */
const PD=C172PROCS;
SH.pane('sp',box=>{ box.innerHTML=SH.speedsHTML({rows:PD.SPEEDS,note:PD.NOTE}); });
const scenProcs=()=>PD.SCENS.map(k=>PROCS.find(p=>p.k===k)).filter(Boolean);
SH.pane('em',box=>{ box.innerHTML=SH.emerHTML({own:OCK.emer(),disc:PD.DISC,refs:scenProcs().map(p=>({t:p.t,steps:(p.all||p.steps).map(x=>x.t)}))}); });
SH.pane('fl',box=>{ box.innerHTML=SH.failHTML({now:PD.FAILS,scen:scenProcs().map(p=>({k:p.k,t:p.t}))}); });
el('tabEm').addEventListener('click',e=>{ const b=e.target.closest('button[data-poem]'); if(b){ OCK.open(+b.dataset.poem); SH.tab('ck'); } });
el('tabFl').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; if(b.dataset.fx){ const t=el(b.dataset.fx); if(t) t.click(); } else if(b.dataset.sk){ procStart(b.dataset.sk); SH.tab('ck'); } });

/* ---------- messages ---------- */
function msg(m){ SH.say(L(m),'bad',5000); }

/* ---------- instruments ---------- */
let vsF=0, lastDraw=performance.now(), rbLast=null, engTxt='', st2Txt='';
const D={ai:{},tc:{},cdi1:{},cdi2:{},adf:{},clock:{},rad:{},lamps:{}};
function radStr(n,k,dec){ return navRad(n)||comRad(n)?SYS[k+n][dec]:''; }
function draw(o){
  const now=performance.now(), dt=Math.min(0.1,(now-lastDraw)/1000); lastDraw=now;
  const b=bus(), fl=S.ctl.flapPos;
  const posErr=Math.max(0,(o.aoa||0)-5)*(0.45+0.12*fl);
  D.ias=Math.max(0,o.ias-(S.ground?0:posErr));
  const att=SYS.att||{roll:o.roll,pitch:o.pitch,hdg:o.hdg}; D.ai.roll=att.roll; D.ai.pitch=att.pitch; D.ai.adj=SYS.aiAdj;
  D.alt=o.alt; D.baro=S.baro;
  const tcOn=b&&cbIn('TURN'), sp=SYS.tcSpin||0; D.tc.rate=(turnRate+(S.p||0)*57.3*0.15)*sp; D.tc.slip=o.slip; D.tc.on=tcOn;
  D.dg=att.hdg; vsF+=(o.vs-vsF)*Math.min(1,dt/1.6); D.vs=vsF;
  D.rpm=ENG.rpm; D.tachHrs=SYS.tach; D.suction=VAC.suction; D.amps=SYS.batSw?EL.amps:0;
  const gOn=b&&cbIn('INST'); D.fuelL=gOn?FUEL.L+0.4*Math.sin(now/700)*(S.ground?0:Math.min(1,Math.abs(o.roll)/20)):0; D.fuelR=gOn?FUEL.R:0;
  D.oilT=gOn?ENG.oilT:75; D.oilP=ENG.oilP; D.egt=ENG.egt; D.egtRef=SYS.egtRef;
  ['1','2'].forEach(n=>{ const nv=n==='1'?curNav1:curNav2, c=D['cdi'+n]; c.obs=SYS['crs'+n]; c.dev=nv&&nv.valid?nv.dev:0; c.tf=nv&&nv.valid?nv.toFrom:null; c.flag=!(nv&&nv.valid); c.gs=nv&&nv.valid&&nv.gs?nv.gs.dev:null; });
  const rb=adfNow(); D.adf.rb=rb; D.adf.card=SYS.adfCard;
  const t=new Date(); D.clock.h=t.getHours()%12; D.clock.m=t.getMinutes(); D.clock.s=t.getSeconds()+t.getMilliseconds()/1000;
  D.oat=oatAt(o.altTrue); D.compass=SYS.cmp!=null?SYS.cmp:o.hdg; D.flapPos=fl; D.hobbs=SYS.hobbs; D.covAI=SYS.covAI; D.covDG=SYS.covDG;
  const R=D.rad, n1=radOn('nc1'), n2=radOn('nc2');
  R.c1a=comRad('1')?SYS.com1.a:''; R.c1s=comRad('1')?SYS.com1.s:''; R.n1a=navRad('1')?SYS.nav1.a:''; R.n1s=navRad('1')?SYS.nav1.s:'';
  R.c2a=comRad('2')?SYS.com2.a:''; R.c2s=comRad('2')?SYS.com2.s:''; R.n2a=navRad('2')?SYS.nav2.a:''; R.n2s=navRad('2')?SYS.nav2.s:'';
  R.adfa=radOn('adf')?SYS.adf.a:''; R.adfs=radOn('adf')?SYS.adf.s:'';
  const dm=dmeNow(dt); R.dmed=dm?(dm.nm!=null?dm.nm.toFixed(1):'---.-'):''; R.dmek=dm?(dm.nm!=null?String(Math.round(dm.kt)):'---'):''; R.dmem=dm?(dm.nm!=null&&dm.kt>40?String(Math.min(99,Math.round(dm.nm/dm.kt*60))):'--'):'';
  const xpOn=radOn('xp'); R.xp=xpOn?(SYS.xpMd===4?'8888':SYS.xpc.join('')):''; R.xpm=xpOn?['','SBY','ON','ALT','TST'][SYS.xpMd]:'';
  const L_=D.lamps; L_.lowv=SYS.batSw&&EL.volts>6&&EL.low; const mk=mkrNow(), mt=SYS.mkrSw===1&&avOn()&&cbIn('AUDIO'); L_.mkO=mt||mk==='O'; L_.mkM=mt||mk==='M'; L_.mkA=mt; L_.xpR=xpOn&&(SYS.xpMd===4||SYS.identT>0||(SYS.xpMd>=2&&Math.random()<0.25));
  C172P.gauges(P,D);
  const dim=b?SYS.dimRadio:0.25, rbv=(0.35+0.65*dim).toFixed(2); if(rbv!==rbLast){ rbLast=rbv; P.world.style.setProperty('--rbrt',rbv); }
}

/* ---------- loop ---------- */
let holdRoll=null, holdPitch=null, last=performance.now(), slow=0, panelT=1;
function pilotInput(dt){
  const K=inp.keys, kb=KB.tick(K,dt); // W/S/A/D + arrows, ramped (flightkeys.js)
  let x=kb.x, y=kb.y, r=null, gpThr=0;
  const sv=FK.spring(inp,dt); if(inp.stick){ x=sv.x; y=sv.y; } else if(sv){ x=F.clamp(x+sv.x,-1,1); y=F.clamp(y+sv.y,-1,1); }
  const pads=navigator.getGamepads?navigator.getGamepads():[]; const gp=pads&&[...pads].find(p=>p&&p.connected);
  if(gp){ const dzf=v=>Math.abs(v)<0.08?0:v; const gx=dzf(gp.axes[0]||0), gy=dzf(gp.axes[1]||0), gr=dzf(gp.axes[2]||0); if(gx||gy){ x=gx; y=gy; } if(gr) r=gr; gpThr=(gp.buttons[7]?gp.buttons[7].value:0)-(gp.buttons[6]?gp.buttons[6].value:0); }
  if(K.has('q')) inp.rudUser=F.clamp(inp.rudUser-dt*0.8,-1,1); if(K.has('e')) inp.rudUser=F.clamp(inp.rudUser+dt*0.8,-1,1); if(r!==null) inp.rudUser=r;
  let td=0; if(K.has('+')||K.has('=')) td+=1; if(K.has('-')) td-=1; td+=gpThr; if(td) SYS.thr=F.clamp(SYS.thr+td*dt*0.35,0,1);
  if(K.has('m')){ SYS.mix=F.clamp(SYS.mix+dt*0.25,0,1); PR.m.mixMoved=1; } if(K.has('n')){ SYS.mix=F.clamp(SYS.mix-dt*0.25,0,1); PR.m.mixMoved=1; }
  S.ctl.brake=(K.has('b')||inp.brakeHeld||SYS.park)?1:0;
  if(kb.trim) S.ctl.trim=F.clamp(S.ctl.trim+kb.trim*dt*0.25,-1,1);
  let rudA=0; if(S.autotrim&&!S.ground){ const bta=S.beta||0; inp.rudI=F.clamp((inp.rudI||0)+bta*dt*3,-0.9,0.9); rudA=F.clamp(3*bta+inp.rudI-0.5*S.r,-1,1); } else inp.rudI=0;
  S.ctl.rud=F.clamp(inp.rudUser+rudA,-1,1);
  if(AF.on){ if(Math.abs(x)>0.15||Math.abs(y)>0.15||kb.held){ AF.off('stick'); airUI(); } else if(AF.hands()) return; }
  if(S.autotrim&&!S.ground&&Math.abs(x)<0.03){ const o=S.o||{}; if(holdRoll===null) holdRoll=Math.abs(o.roll)<6?0:F.clamp(o.roll,-30,30); x=F.clamp((holdRoll-(o.roll||0))*0.03-(S.p||0)*0.8,-0.4,0.4); } else holdRoll=null;
  if(S.autotrim) x=F.clamp(x,-0.8,0.8);
  S.ctl.ail=x; S.ctl.ele=y;
  if(S.autotrim&&!S.ground){ if(Math.abs(y)>0.03) holdPitch=null; else { const o=S.o; if(holdPitch===null) holdPitch=o.pitch; S.ctl.trim=F.clamp(S.ctl.trim+F.clamp(0.06*(holdPitch-o.pitch)-1.2*S.q,-0.4,0.4)*dt*3,-1,1); } } else holdPitch=null;
}
function simTick(dt,o0){ o0=o0||F.readouts(S);
    pilotInput(dt);
    curNav1=navOf('1'); curNav2=navOf('2');
    if(dt>0){ accel+=((o0.ias-lastIas)/dt-accel)*Math.min(1,dt*2); } lastIas=o0.ias;
    sysTick(dt,o0); procTick(dt); AF.tick(dt);
    const N=Math.max(1,Math.round(dt*240)), h=dt/N;
    if(AF.on){ for(let i=0;i<N;i++){ AF.sub(F.readouts(S),h); F.step(S,h); } }
    else for(let i=0;i<N;i++) F.step(S,h);
    if(DB) DB.tick(dt); // debrief recorder (simdebrief.js): after the physics, so a crash is seen on the frame it happens
}
function loop(t){
  const dt=Math.max(0,Math.min(0.05,(t-last)/1000)); GOV.tick(Math.max(0,Math.min(0.25,(t-last)/1000))); last=t;
  const o0=F.readouts(S);
  if(!UI.paused&&!S.crash){ simTick(dt,o0); audioTick(dt); }
  const o=F.readouts(S);
  if(lastHdg!==null&&dt>0&&!UI.paused){ const dh=F.wrap180(o.hdg-lastHdg)/dt; turnRate+=(dh-turnRate)*Math.min(1,dt*3); } lastHdg=o.hdg;
  if(D3on){ if(cockpitVis) D3.frame(otwState3(),{active:!UI.paused&&!S.crash,stick:inp.stick||{x:S.ctl.ail,y:S.ctl.ele}}); } else otwTick(dt);
  if(cockpitVis){ panelT+=dt; if(panelT>(D3on?D3.panelDt(GOV.panelDt):GOV.panelDt)){ panelT=0; C172P.sync(P,{get:ioGet}); C172P.syncYokes(P,inp.stick?inp.stick.x:S.ctl.ail,inp.stick?inp.stick.y:S.ctl.ele); draw(o); } }
  const stall=!S.ground&&S.alpha!=null&&S.aS!=null&&S.alpha>S.aS-0.075;
  soundTick(stall);
  slow+=dt; if(slow>0.12&&!(D3on&&D3.frozen)){ slow=0; slowUI(o); } // status lines wait while the 3D view turns (any layout then re-lays out the whole panel)
  requestAnimationFrame(loop);
}
let wasCrash=null;
function slowUI(o){
  if(Math.abs(rud.v/100-inp.rudUser)>0.005) rud.set(Math.round(inp.rudUser*100));
  const sEl=el('stat'); const sKey=S.crash?'Crashed':UI.paused?'Paused':S.ground?'On ground':'Flying';
  { const tx=T(sKey), cn='status'+(S.crash||UI.paused?'':' ok'); if(sEl.textContent!==tx) sEl.textContent=tx; if(sEl.className!==cn) sEl.className=cn; }
  if(S.crash!==wasCrash){ wasCrash=S.crash; if(S.crash){ pill(L(tr2('Crashed: ','Havarert: '))+S.crash+' — '+L(tr2('press Restart','trykk Start på nytt')),'bad'); pillT=8; } }
  if(AIRUI){ AIRUI.banner(AF.on,L(tr2('INSTRUCTOR FLYING','INSTRUKTØREN FLYR')),AF.status); if((AIRUI.btn.getAttribute('aria-pressed')==='true')!==AF.on) airUI(); }
  if(S.landed&&S.landed.field&&!PR.m.fieldMsg){ PR.m.fieldMsg=1; pill(L(tr2('Landed in a field — well done. Secure the aircraft.','Landet på et jorde — godt jobbet. Sikre flyet.')),'ok'); }
  const x=inp.stick?inp.stick.x:S.ctl.ail, y=inp.stick?inp.stick.y:S.ctl.ele; { const dl=(50+x*42)+'%', dtp=(50+y*42)+'%'; if(dot._l!==dl){ dot._l=dl; dot.style.left=dl; } if(dot._t!==dtp){ dot._t=dtp; dot.style.top=dtp; } }
  const fe=(v,d)=>(+v).toFixed(d);
  if(el('drawer').classList.contains('open')){ const et=`RPM ${Math.round(ENG.rpm)} · ${Math.round(ENG.pwr*100)} % · ${fe(ENG.ff,1)} gal/h<br>EGT ${Math.round(ENG.egt)} °F · ${L(tr2('oil','olje'))} ${Math.round(ENG.oilT)} °F / ${Math.round(ENG.oilP)} psi<br>${L(tr2('Fuel','Drivstoff'))} L ${fe(FUEL.L,1)} · R ${fe(FUEL.R,1)} gal · ${CC.SEL[SYS.fuelSel]}<br>${fe(EL.volts,1)} V · ${EL.amps>=0?'+':''}${fe(EL.amps,1)} A · ${L(tr2('battery','batteri'))} ${Math.round(EL.soc*100)} %<br>${L(tr2('Suction','Sug'))} ${fe(VAC.suction,1)} in Hg · ${L(tr2('carb ice (hidden in the real aircraft)','forgasseris (skjult i virkeligheten)'))} ${Math.round(ENG.ice*100)} %`; if(et!==engTxt){ engTxt=et; el('engRead').innerHTML=et; } }
  if(slow===0&&Math.random()<0.05) riskText();
}

/* ---------- quiz ---------- */
const QZ=[
 {q:tr2('In cruise with a fixed-pitch propeller, what is usually the first sign of carburettor ice?','Hva er vanligvis første tegn på forgasseris i marsj med fast propell?'),a:[tr2('A gradual drop in RPM','Et gradvis turtallsfall'),tr2('A rise in oil pressure','Økt oljetrykk'),tr2('The LOW VOLTAGE light','LOW VOLTAGE-lyset'),tr2('A rising EGT','Stigende EGT')],c:0,e:tr2('Ice restricts the induction air; with a fixed-pitch propeller the RPM falls slowly, then the engine runs rough.','Isen struper innsugsluften; med fast propell faller turtallet sakte, så går motoren ujevnt.')},
 {q:tr2('You apply full carburettor heat and the engine runs rougher with a further RPM drop. What does that tell you?','Du gir full forgasservarme og motoren går ujevnere med mer turtallsfall. Hva forteller det?'),a:[tr2('There was ice, and it is melting — leave the heat on','Det var is, og den smelter — la varmen stå på'),tr2('Carb heat made it worse — push it in at once','Forgasservarmen gjorde det verre — skyv den inn straks'),tr2('The magnetos have failed','Magnetene har sviktet'),tr2('The mixture is too lean','Blandingen er for mager')],c:0,e:tr2('Melting ice passes through the engine as water; it runs rough briefly, then recovers. Leave the heat full on.','Smeltende is går gjennom motoren som vann; den går ujevnt en stund, og tar seg så opp. La varmen stå helt på.')},
 {q:tr2('Typical magneto check limits at the 1,700 RPM run-up?','Typiske grenser for magnetsjekken ved 1700 o/min?'),a:[tr2('Max 125 RPM drop, max 50 RPM difference','Maks 125 o/min fall, maks 50 o/min forskjell'),tr2('Max 50 RPM drop, max 125 RPM difference','Maks 50 o/min fall, maks 125 o/min forskjell'),tr2('Any drop up to 300 RPM','Fall opp til 300 o/min'),tr2('No drop is the ideal result','Ingen fall er det ideelle')],c:0,e:tr2('No drop at all suggests a magneto that may not be grounded — a "live" propeller hazard.','Ikke noe fall kan bety en magnet som ikke jordes — fare for «levende» propell.')},
 {q:tr2('What does the LOW VOLTAGE light indicate in the classic 172?','Hva betyr LOW VOLTAGE-lyset i den klassiske 172?'),a:[tr2('Bus voltage below normal — the alternator is not charging','Spenning under normalt — generatoren lader ikke'),tr2('The battery is overcharging','Batteriet overlades'),tr2('A vacuum pump failure','Vakuumpumpesvikt'),tr2('Low fuel','Lite drivstoff')],c:0,e:tr2('First reset the alternator control unit by cycling the master; if it comes on again, ALT off, shed load and land.','Nullstill først generatorregulatoren ved å slå hovedbryteren av og på; tennes den igjen: ALT av, reduser forbruket og land.')},
 {q:tr2('Which instrument in the six-pack is electrically driven?','Hvilket instrument i six-pack er elektrisk drevet?'),a:[tr2('The turn coordinator','Svingkoordinatoren'),tr2('The attitude indicator','Horisonten'),tr2('The heading indicator','Kursgyroen'),tr2('The vertical speed indicator','Variometeret')],c:0,e:tr2('AI and HI are vacuum-driven; the turn coordinator is electric so a single failure does not take all the gyros.','Horisont og kursgyro er vakuumdrevet; svingkoordinatoren er elektrisk slik at én feil ikke tar alle gyroene.')},
 {q:tr2('Engine failure shortly after take-off at low height. What should you do first?','Motorstopp kort etter avgang i lav høyde. Hva gjør du først?'),a:[tr2('Lower the nose to the glide speed and land ahead','Senk nesa til glidefart og land rett fram'),tr2('Turn back to the runway','Snu tilbake til banen'),tr2('Restart with the starter','Start på nytt med starteren'),tr2('Raise the flaps','Ta inn flapsene')],c:0,e:tr2('Airspeed first; a turn back at low height risks a stall-spin. Choose a field within about 30° of the nose.','Farten først; å snu i lav høyde gir fare for steiling og spinn. Velg et jorde innen ca. 30° av nesa.')},
 {q:tr2('Turning off a northerly heading in the northern hemisphere, the magnetic compass will…','Når du svinger fra nordlig kurs på nordlige halvkule vil magnetkompasset…'),a:[tr2('lag behind the turn','henge etter svingen'),tr2('lead the turn','gå foran svingen'),tr2('read correctly','vise riktig'),tr2('stop moving','stå stille')],c:0,e:tr2('Northerly turning error: lag on north, lead on south (UNOS: undershoot north, overshoot south).','Nordlig svingfeil: henger etter mot nord, går foran mot sør.')},
 {q:tr2('How do you find the best economy mixture in cruise with an EGT gauge?','Hvordan finner du beste økonomiblanding i marsj med EGT-måler?'),a:[tr2('Lean slowly to peak EGT, then enrichen slightly','Len sakte til topp EGT, gjør så litt rikere'),tr2('Pull to idle cut-off and back','Trekk til idle cut-off og tilbake'),tr2('Always full rich','Alltid helt rik'),tr2('Lean until the engine stops','Len til motoren stopper')],c:0,e:tr2('Peak EGT is about stoichiometric; most POHs recommend a little rich of peak in cruise.','Topp-EGT er omtrent støkiometrisk; de fleste POH anbefaler litt på rik side i marsj.')},
 {q:tr2('Typical suction gauge green range in the classic 172?','Typisk grønt område for suggauge i den klassiske 172?'),a:['4.5–5.4 in Hg','1.5–2.4 in Hg','8–10 in Hg','25–29 in Hg'],c:0,e:tr2('Too low and the gyros slow down; check it at the run-up and in cruise.','For lavt og gyroene bremser; sjekk det på run-up og i marsj.')},
 {q:tr2('Maximum speed with flaps 30°?','Maks fart med flaps 30°?'),a:['85 KIAS','110 KIAS','127 KIAS','65 KIAS'],c:0,e:tr2('Typical 172P: 10° up to 110 KIAS, 10°–30° up to 85 KIAS (top of the white arc).','Typisk 172P: 10° opp til 110 KIAS, 10°–30° opp til 85 KIAS (toppen av den hvite buen).')}
];
quiz(el('qbox'),'c172cockpit',()=>shuffle(QZ.slice()).slice(0,8));

window.__zoom={reg:()=>Z.reg,to:zoomTo,svg:P.svg,s:()=>Z.s}; LAB.start('sim'); window.__S=S; window.__SYS=SYS; window.__ENG=()=>ENG; window.__EL=()=>EL; window.__VAC=()=>VAC; window.__FUEL=FUEL; window.__PR=PR; window.__io={set:ioSet,get:ioGet}; window.__step=procStart; window.__own={OCK,procStart,procSet:typeof procSet!=='undefined'?procSet:null,setDrawer,PR,PROCS,procClose:typeof procClose!=='undefined'?procClose:null,DB:()=>DB};
if(!location.hash) requestAnimationFrame(()=>{ const c=el('cockpit'); window.scrollTo(0,c.getBoundingClientRect().top+scrollY); });
const q0=(location.search.match(/[?&]s=(\w+)/)||[])[1], qp=(location.search.match(/[?&]p=(\w+)/)||[])[1];
/* ✈ Start: airborne procedures, then the exercises (on the ground / exercises); failure scenarios are in Procedures → Failures */
AIRUI=AIRPROC.ui({stage:PST,list:AIRPROC.list('C172',AIRCAPS),L,type:'C172',onPick:pickProc,onAuto:toggleAuto,
  ex:()=>PROCS.filter(p=>PD.START[p.k]).map(p=>({k:p.k,t:p.t,g:PD.START[p.k]})),onEx:k=>{ procStart(k); setDrawer(true); SH.tab('ck'); },
  onFailures:()=>{ setDrawer(true); SH.tab('fl'); }}); LAB.onLang(airUI);
/* shared debrief and scoring (simdebrief.js): records at 5 Hz of sim time, opens the debrief when the scenario ends */
if(window.SIMDEBRIEF) DB=SIMDEBRIEF.attach({type:'C172',page:document.body.dataset.d3?'c172-3d':'c172',S,F,AF,after:AIRUI.btn,
  eng:()=>[(ENG.failed||(!ENG.run&&!S.ground))?1:0,0,NaN,NaN],
  scen:()=>{ const p=PROCS.find(x=>x.k===PR.k); if(!p) return null; const air=p.k==='air'; const c=OWNCRIT[p.k];
    return {k:air?AIRK:p.k,name:air?AIRPROC.NAMES[AIRK]:p.t,air,steps:p.steps,done:PR.done,bad:PR.bad||0,chk:!!p.gen,failed:p.fail||p.k==='carbice'?PR.failed:null,own:()=>OCK.report(),
      crit:c?(PR.crit||(PR.crit=latch(c.f))):null,critTxt:c&&c.t,critLim:c&&c.lim}; },
  again:()=>{ const a=DB.last&&DB.last.afUsed; procStart(PR.k||'air'); if(a&&PR.k==='air'&&!AF.on) toggleAuto(); },
  next:()=>{ if(PR.k==='air'){ const L=AIRPROC.list('C172',AIRCAPS).filter(x=>x.k!=='free'); const i=L.findIndex(x=>x.k===AIRK); pickProc(L[(i+1)%L.length].k); } else { const L=PROCS.filter(x=>x.k!=='free'&&x.k!=='air'); const i=L.findIndex(x=>x.k===PR.k); procStart(L[(i+1)%L.length].k); } }});
if(qp&&AIRPROC.list('C172',AIRCAPS).some(x=>x.k===qp)) AIRK=qp;
genToggle();
procStart(PROCS.some(p=>p.k===q0)?q0:qp==='free'?'free':'air');
if(/[?&]af=1/.test(location.search)) toggleAuto(); else if(PR.k==='air') AIRUI.showNow(AIRK); // first visit: what to do now
window.__air={AF,DB,sim:simTick,fast(sec){ for(let i=0;i<sec/0.05&&!S.crash;i++) simTick(0.05); return AF.rec; },pick:pickProc,auto:toggleAuto,list:()=>AIRPROC.list('C172',AIRCAPS),o:()=>F.readouts(S),cfg(g,f){ if(f!=null) S.ctl.flap=f; }};
riskText();
requestAnimationFrame(loop);
})();
