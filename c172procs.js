/* Birdbird – C172 data for the shared Procedures drawer (simshell.js): key speeds, the failure buttons and which of the page's
   exercises are failure scenarios (Failures tab) or start exercises (✈ Start picker). Typical classic C172 values for learning. */
(function(G){
'use strict';
const tr2=(en,no)=>({en,no});
const SPEEDS=[[tr2('VR, rotation','VR, rotasjon'),'55'],[tr2('VX / VY','VX / VY'),'60 / 76'],[tr2('Best glide','Beste glidefart'),'65'],[tr2('Approach, flaps 30°','Innflyging, flaps 30°'),'60–70'],
 [tr2('VS0 / VS1','VS0 / VS1'),'33 / 44'],[tr2('VFE 10° / 10°–30°','VFE 10° / 10°–30°'),'110 / 85'],[tr2('VA, 2,400 lb','VA, 2400 lb'),'99'],[tr2('VNO','VNO'),'127'],[tr2('VNE','VNE'),'158'],
 [tr2('Engine, max RPM','Motor, maks o/min'),'2,700']];
const NOTE=tr2('Typical values. Check your POH.','Typiske verdier. Sjekk POH.');
/* buttons in Procedures → Failures: they press the page's own failure buttons (section "Failures" further down the page) */
const FAILS=[{id:'fEng',t:tr2('Engine failure','Motorstopp')},{id:'fMag',t:tr2('Left magneto fails','Venstre magnet svikter')},{id:'fPlug',t:tr2('Fouled plug (right mag)','Sotet plugg (høyre magnet)')},{id:'fFuel',t:tr2('Left tank empty','Venstre tank tom')},{id:'fVac',t:tr2('Vacuum pump fails','Vakuumpumpa svikter')},{id:'fAlt',t:tr2('Alternator fails','Generatoren svikter')},{id:'fRestore',t:tr2('Restore all','Gjenopprett alt'),rs:1}];
/* exercises that are failure scenarios (Failures tab); the others go in the ✈ Start picker */
const SCENS=['eftoa','carbice','vac','alt'];
const START={start:'gnd',runup:'gnd',circuit:'gnd'};
G.C172PROCS={SPEEDS,NOTE,FAILS,SCENS,START};
})(window);
