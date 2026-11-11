/* Birdbird – C172 data for the shared Procedures drawer (simshell.js): the speeds and limits table, the failure buttons and which
   of the page's exercises are failure scenarios (Failures tab) or start exercises (✈ Start picker). Typical values for learning,
   moved here from the page script unchanged; verify every figure in the approved documents. */
(function(G){
'use strict';
const tr2=(en,no)=>({en,no});
const SPEEDS=[[tr2('Never exceed, VNE (red line)','Aldri overskrid, VNE (rød strek)'),'158 KIAS'],[tr2('Max structural cruising, VNO (yellow arc from)','Maks strukturell marsjfart, VNO (gul bue fra)'),'127 KIAS'],[tr2('Manoeuvring speed, VA (2,400 lb / 2,000 lb)','Manøvreringsfart, VA (2400 lb / 2000 lb)'),'99 / 92 KIAS'],[tr2('Max flap extended, VFE: 10° / 10°–30°','Maks fart med flaps, VFE: 10° / 10°–30°'),'110 / 85 KIAS'],[tr2('Stall, flaps up VS1 / landing VS0 (ASI arcs)','Steiling, flaps oppe VS1 / landing VS0 (buer)'),'44 / 33 KIAS'],
 [tr2('Rotation, VR','Rotasjon, VR'),'55 KIAS'],[tr2('Best angle VX / best rate VY (sea level)','Beste vinkel VX / beste rate VY (havnivå)'),'60 / 76 KIAS'],[tr2('Best glide (max weight)','Beste glidefart (maks vekt)'),'65 KIAS'],[tr2('Normal approach, flaps up / flaps 30°','Normal innflyging, flaps oppe / 30°'),'65–75 / 60–70 KIAS'],
 [tr2('Engine speed, maximum (red line)','Turtall, maks (rød strek)'),'2,700 RPM'],[tr2('Tachometer green arc','Turteller grønn bue'),'2,100–2,700 RPM'],[tr2('Oil temperature (green / max)','Oljetemperatur (grønt / maks)'),'100–245 °F / 245 °F'],[tr2('Oil pressure (min / green / max)','Oljetrykk (min / grønt / maks)'),'25 / 60–90 / 115 psi'],[tr2('Suction (green)','Sug (grønt)'),'4.5–5.4 in Hg'],
 [tr2('Run-up: magneto drop max / difference max','Run-up: magnetfall maks / forskjell maks'),'125 / 50 RPM @ 1,700'],[tr2('Fuel: total / usable (standard tanks)','Drivstoff: totalt / brukbart (standardtanker)'),'43 / 40 US gal'],[tr2('Typical cruise: 2,400 RPM at 4,000–6,000 ft','Typisk marsj: 2400 o/min i 4000–6000 ft'),'≈ 105–110 KTAS, 7–8 gal/h'],[tr2('Climb at sea level (max weight)','Stigning ved havnivå (maks vekt)'),'≈ 700 ft/min'],
 [tr2('Maximum weight (normal category)','Maks vekt (normalkategori)'),'2,400 lb'],[tr2('Engine','Motor'),'160 hp, 4-cyl, carburetted'],[tr2('Electrical system','Elektrisk system'),'28 V alternator, 24 V battery']];
const NOTE=tr2('Typical classic Cessna 172 (172P-style, 160 hp) values for learning — verify in your POH/AFM; they vary with model year and equipment.','Typiske verdier for en klassisk Cessna 172 (172P-type, 160 hk) for læring — kontroller i POH/AFM; de varierer med årsmodell og utstyr.');
const DISC=tr2("POH reference (typical classic C172). Always follow your school's approved checklists.",'POH-referanse (typisk klassisk C172). Følg alltid skolens godkjente sjekklister.');
/* buttons in Procedures → Failures: they press the page's own failure buttons (section "Failures" further down the page) */
const FAILS=[{id:'fEng',t:tr2('Engine failure','Motorstopp')},{id:'fMag',t:tr2('Left magneto fails','Venstre magnet svikter')},{id:'fPlug',t:tr2('Fouled plug (right mag)','Sotet plugg (høyre magnet)')},{id:'fFuel',t:tr2('Left tank empty','Venstre tank tom')},{id:'fVac',t:tr2('Vacuum pump fails','Vakuumpumpa svikter')},{id:'fAlt',t:tr2('Alternator fails','Generatoren svikter')},{id:'fRestore',t:tr2('Restore all','Gjenopprett alt'),rs:1}];
/* exercises that are failure scenarios (Failures tab); the others go in the ✈ Start picker, grouped */
const SCENS=['eftoa','carbice','vac','alt'];
const START={start:'gnd',runup:'gnd',circuit:'gnd',ils:'ex'};
G.C172PROCS={SPEEDS,NOTE,DISC,FAILS,SCENS,START};
})(window);
