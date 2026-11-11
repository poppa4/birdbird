/* Birdbird – B200 data for the shared Procedures drawer (simshell.js): the speeds and limits table, the failure buttons and which
   of the page's exercises are failure scenarios (Failures tab) or start exercises (✈ Start picker). Typical values for learning,
   moved here from the page script unchanged; verify every figure in the approved documents. */
(function(G){
'use strict';
const tr2=(en,no)=>({en,no});
const SPEEDS=[[tr2('Torque, maximum','Moment, maks'),'2,230 ft-lb'],[tr2('ITT, take-off and maximum continuous','ITT, avgang og maks kontinuerlig'),'800 °C'],[tr2('ITT, starting (5 s)','ITT, start (5 s)'),'1,000 °C'],[tr2('N1, maximum','N1, maks'),'101.5 %'],[tr2('N1, low idle (minimum, varies by serial)','N1, low idle (minimum, varierer)'),'≈ 56–61 %'],[tr2('N1, high idle','N1, high idle'),'≈ 70 %'],[tr2('Propeller rpm, maximum','Propellturtall, maks'),'2,000'],[tr2('N1, maximum reverse','N1, maks revers'),'88 %'],[tr2('Oil pressure, normal (minimum at idle 60)','Oljetrykk, normalt (minst 60 på tomgang)'),'100–135 psi'],[tr2('Oil temperature, normal range (above 99 °C: up to 104 °C for 10 min)','Oljetemperatur, normalområde (over 99 °C: opptil 104 °C i 10 min)'),'0–99 °C'],[tr2('Autofeather: other side disarms / feather (varies by serial)','Autofeather: andre side desarmeres / fløying (varierer med serienummer)'),'≈ 400 / 200 ft-lb'],[tr2('Auto-ignition active below','Auto-tenning aktiv under'),'400 ft-lb'],
 ['VMCA','86 KIAS'],[tr2('VYSE (blue line)','VYSE (blå linje)'),'121 KIAS'],['VMO','259 KIAS'],[tr2('VFE approach / full flaps','VFE approach / fulle flaps'),'200 / 157 KIAS'],[tr2('VLO extend and VLE','VLO ut og VLE'),'181 KIAS'],[tr2('VLO retract','VLO inn'),'163 KIAS'],[tr2('Cabin differential, normal maximum (red line 6.6)','Kabintrykkforskjell, normal maks (rød strek 6,6)'),'6.5 psi'],[tr2('Cabin altitude warning (ALT WARN)','Kabinhøydevarsel (ALT WARN)'),'12,500 ft']];
const NOTE=tr2('Typical King Air B200 values for learning — verify in your AFM/POH; they vary with serial number.','Typiske King Air B200-verdier for læring — kontroller i AFM/POH; de varierer med serienummer.');
const DISC=tr2("AFM reference (typical King Air B200). Always follow your school's approved checklists and your operator's SOP.",'AFM-referanse (typisk King Air B200). Følg alltid skolens godkjente sjekklister og operatørens SOP.');
/* buttons in Procedures → Failures: they press the page's own failure buttons (section "Failures" further down the page) */
const FAILS=[{id:'failL',t:tr2('Engine failure left','Motorstans venstre')},{id:'failR',t:tr2('Engine failure right','Motorstans høyre')},{id:'fireLb',t:tr2('Engine fire left','Motorbrann venstre')},{id:'fireRb',t:tr2('Engine fire right','Motorbrann høyre')},{id:'decomp',t:tr2('Decompression','Trykkfall')},{id:'restore',t:tr2('Restore both engines','Gjenopprett begge motorene'),rs:1}];
/* exercises that are failure scenarios (Failures tab); the others go in the ✈ Start picker, grouped */
const SCENS=['efato','fire','press'];
const START={start:'gnd',runup:'gnd',seapp:'ex'};
G.B200PROCS={SPEEDS,NOTE,DISC,FAILS,SCENS,START};
})(window);
