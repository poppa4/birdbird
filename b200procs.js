/* Birdbird – B200 data for the shared Procedures drawer (simshell.js): key speeds and limits, the failure buttons and which of
   the page's exercises are failure scenarios (Failures tab) or start exercises (✈ Start picker). Typical King Air B200 values. */
(function(G){
'use strict';
const tr2=(en,no)=>({en,no});
const SPEEDS=[['VMCA','86'],[tr2('VYSE (blue line)','VYSE (blå linje)'),'121'],[tr2('VFE approach / full','VFE approach / full'),'200 / 157'],[tr2('VLO extend, VLE','VLO ut, VLE'),'181'],[tr2('VLO retract','VLO inn'),'163'],['VMO','259'],
 [tr2('Torque, max','Moment, maks'),'2,230 ft-lb'],[tr2('ITT, max continuous / start','ITT, maks kontinuerlig / start'),'800 / 1,000 °C'],[tr2('N1, max','N1, maks'),'101.5 %'],[tr2('Propeller, max','Propell, maks'),'2,000 RPM'],
 [tr2('Cabin differential, max','Kabintrykkforskjell, maks'),'6.5 psi']];
const NOTE=tr2('Typical values. Check your AFM.','Typiske verdier. Sjekk AFM.');
/* buttons in Procedures → Failures: they press the page's own failure buttons (section "Failures" further down the page) */
const FAILS=[{id:'failL',t:tr2('Engine failure left','Motorstans venstre')},{id:'failR',t:tr2('Engine failure right','Motorstans høyre')},{id:'fireLb',t:tr2('Engine fire left','Motorbrann venstre')},{id:'fireRb',t:tr2('Engine fire right','Motorbrann høyre')},{id:'decomp',t:tr2('Decompression','Trykkfall')},{id:'restore',t:tr2('Restore both engines','Gjenopprett begge motorene'),rs:1}];
/* exercises that are failure scenarios (Failures tab); the others go in the ✈ Start picker */
const SCENS=['efato','fire','press'];
const START={start:'gnd',runup:'gnd',seapp:'ex'};
G.B200PROCS={SPEEDS,NOTE,FAILS,SCENS,START};
})(window);
