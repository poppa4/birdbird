/* Birdbird – briefingmodell: rubrikker (avgang, TSADMM-innflyging, VFR), fakta for AI-vurdering, lokal reservevurdering og modellbriefing.
   Brukes av briefing.html og gate-to-gate-treneren. */
(function(G){
'use strict';
const O=G.OPS;
const NUMW={zero:'0',one:'1',two:'2',three:'3',tree:'3',four:'4',five:'5',fife:'5',six:'6',seven:'7',eight:'8',nine:'9',niner:'9'};
function norm(t){ let s=' '+String(t||'').toLowerCase().replace(/[’']/g,'').replace(/[,;:!?()]/g,' ')+' ';
  s=s.replace(/\b(zero|one|two|three|tree|four|five|fife|six|seven|eight|nine|niner)\b/g,m=>NUMW[m]);
  s=s.replace(/\b(\d+)\s*thousand(?:\s*(\d)\s*hundred)?/g,(m,a,b)=>String(+a*1000+(b?+b*100:0)));
  s=s.replace(/\b(\d)\s*hundred/g,(m,a)=>String(+a*100));
  for(let k=0;k<6;k++) s=s.replace(/\b(\d)\s+(?=\d\b)/g,'$1');
  s=s.replace(/(\d)\s*(decimal|point)\s*(\d)/g,'$1.$3').replace(/\s+/g,' ');
  return s; }
const has=(s,re)=>re.test(s);
const num=n=>new RegExp('(^|[^0-9])'+String(n).replace('.','\\.')+'([^0-9]|$)');

/* ---------- rubrikker ---------- */
// hvert punkt: k (bokstav), t (tittel), d (hva som forventes), chk(V,n) -> antall treff og maks for lokal vurdering
function R(k,t,d,chk){ return {k,t,d,chk}; }
const RUB={
  dep:{name:{en:'Departure briefing (T-RIBETS)',no:'Avgangsbriefing (T-RIBETS)'},letters:'TRIBETS',items:[
    R('T',{en:'Threats',no:'Trusler'},{en:'The threats that matter for this departure today (terrain, weather, icing, traffic, birds, mass and temperature, OEI performance) and how you handle each one.',no:'Truslene som betyr noe for denne avgangen i dag (terreng, vær, ising, trafikk, fugl, masse og temperatur, OEI-ytelse) og hvordan du håndterer hver av dem.'},
      (V,n)=>[has(n,/threat|terrain|weather|cloud|icing|ice|traffic|bird|gradient|performance/), has(n,/(we|i) will|plan|if .* then|handle|so we|so i/)]),
    R('R',{en:'Runway',no:'Rullebane'},{en:'Runway and intersection, length available, wind and crosswind, surface and conditions.',no:'Rullebane og intersection, tilgjengelig lengde, vind og sidevind, underlag og forhold.'},
      (V,n)=>[has(n,/runway 36|rwy 36|36/), has(n,num(1500))||has(n,/full length|tora/), has(n,num(V.wd))||has(n,/wind/), has(n,/crosswind|cross wind|headwind/)]),
    R('I',{en:'Instruments and initial route',no:'Instrumenter og første rute'},{en:'Clearance and setup: SID or VFR route, first track and turn, initial altitude, climb gradient, squawk, frequencies, navigation set up and checked.',no:'Klarering og oppsett: SID eller VFR-rute, første kurs og sving, første høyde, stigegradient, squawk, frekvenser, navigasjon satt opp og sjekket.'},
      (V,n)=> V.ifr? [has(n,/osvik/), has(n,num(1500))&&has(n,/left/), has(n,num(3000)), has(n,/4.5|gradient/), has(n,num(V.sq))||has(n,/squawk/), has(n,/approach|119|frequenc/)]
                   : [has(n,/november|sierra/), has(n,num(1500))||has(n,/altitude/), has(n,/squawk|7000/), has(n,/frequency|tower|information|fis/)]),
    R('B',{en:'Bugs (speeds)',no:'Bugs (farter)'},{en:'Take-off configuration and the speeds for today’s mass: flaps, rotate, Vy and Vyse (blue line).',no:'Avgangskonfigurasjon og fartene for dagens masse: klaff, rotasjon, Vy og Vyse (blue line).'},
      (V,n)=>{ const s=O.speeds(V.mass); return [has(n,/flaps? (up|app)|flapless|clean/), has(n,num(s.vr)), has(n,num(s.vy)), has(n,num(85))&&has(n,/blue|vyse|v y s e|single engine/)]; }),
    R('E',{en:'Emergencies',no:'Nødsituasjoner'},{en:'Before rotation: what makes you stop and how (callout, power idle, directional control, brakes). After rotation: gear down and runway left, land ahead; otherwise power MAX, gear up, flaps up, 85 KIAS, identify – verify – secure, then the plan.',no:'Før rotasjon: hva får deg til å stoppe og hvordan (callout, gass tomgang, retningskontroll, bremser). Etter rotasjon: hjul nede og bane igjen, land rett frem; ellers gass MAX, hjul opp, klaff opp, 85 KIAS, identify – verify – secure, så planen.'},
      (V,n)=>[has(n,/abort|stop|reject/), has(n,/idle|power.*(back|off)/), has(n,/land (straight )?ahead|remaining runway|runway (remaining|left)/), has(n,/max|full power/), has(n,num(85))||has(n,/vyse|blue line/), has(n,/identify|verify|secure/), has(n,/return|come back|circuit|radar|vectors|land back|back to/)]),
    R('T',{en:'Transition altitude',no:'Overgangshøyde'},{en:'Transition altitude, and when you set standard (1013) on the climb.',no:'Overgangshøyden, og når du setter standard (1013) i stigningen.'},
      (V,n)=>[has(n,/transition/), has(n,num(7000))]),
    R('S',{en:'Safe altitude',no:'Sikker høyde'},{en:'MSA or minimum safe altitude for the departure sector, and the terrain it protects you from. Invite questions.',no:'MSA eller laveste sikre høyde for avgangssektoren, og terrenget den beskytter mot. Inviter til spørsmål.'},
      (V,n)=>[has(n,num(3200))||has(n,/msa|minimum sector|safe altitude/), has(n,/question/)])
  ]},
  app:{name:{en:'Approach briefing (TSADMM)',no:'Innflygingsbriefing (TSADMM)'},letters:'TSADMM',items:[
    R('T',{en:'Threats',no:'Trusler'},{en:'The threats that matter for this approach today (terrain, weather, icing, wind, traffic, fatigue) and how you will handle each one.',no:'Truslene som betyr noe for denne innflygingen i dag (terreng, vær, ising, vind, trafikk, tretthet) og hvordan du håndterer hver av dem.'},
      (V,n)=>[has(n,/threat|terrain|weather|icing|ice|wind|gust|traffic|bird|fatigue|tired/), has(n,/terrain|1100|obstacle|msa|3200/), has(n,/(we|i) will|plan|mitigat|if .* then|handle|brief/)]),
    R('S',{en:'Setup',no:'Oppsett'},{en:'Approach and chart (name, number, date), frequency and ident set and identified, final course set, avionics and autopilot mode, minima bug.',no:'Innflyging og kart (navn, nummer, dato), frekvens og ident satt og identifisert, sluttkurs satt, avionikk og autopilotmodus, minimabug.'},
      (V,n,P)=>[has(n,P.kind==='RNP'?/rnp|rnav|lpv|lnav/:P.kind==='LOC'?/loc|localizer/:/ils/), has(n,/11-1|12-1|chart|plate|date/), P.kind==='RNP'?has(n,/41736|channel|waas|sbas|database/):has(n,/110.3|iasn|identif/), has(n,num(360))||has(n,/course/)]),
    R('A',{en:'Arrival',no:'Ankomst'},{en:'Expected arrival or vectors, IAF and IF with altitudes, hold if expected, MSA and transition altitude.',no:'Forventet ankomst eller vektorer, IAF og IF med høyder, holding hvis forventet, MSA og overgangshøyde.'},
      (V,n)=>[has(n,/alpor|bikan|ronax|vectors|star|arrival/), has(n,num(3000)), has(n,num(3200))||has(n,/msa/), has(n,num(7000))||has(n,/transition/)]),
    R('D',{en:'Descent',no:'Nedstigning'},{en:'Final approach fix and altitude, glidepath angle, rate of descent for the groundspeed, distance and altitude checks, configuration and Vref, stable by 1000 ft.',no:'Final approach fix og høyde, glidebanevinkel, synkehastighet for groundspeed, distanse- og høydekontroller, konfigurasjon og Vref, stabil innen 1000 ft.'},
      (V,n)=>{ const s=O.speeds(V.mass); return [has(n,/fapso|faf|fap|final approach (fix|point)/)&&(has(n,num(1650))||has(n,num(1700))), has(n,/3 degree|3.0|three degree|glide ?path|glide ?slope/), has(n,/(4|5)\d0 (feet|ft)? ?(per|a|\/) ?min|fpm|feet per minute|rate/), has(n,/d4|d 4|4 miles|1330|1020|check/), has(n,num(s.vref))||has(n,/vref|flaps? (ldg|landing)|gear down/), has(n,/stable|1000 (feet|ft)/)]; }),
    R('M',{en:'Minimums',no:'Minima'},{en:'DA/DH or MDA, the visibility or RVR required and today’s weather against it, what is set on the bug, what you need to see to continue.',no:'DA/DH eller MDA, sikt eller RVR som kreves og dagens vær mot det, hva som er satt på buggen, hva du må se for å fortsette.'},
      (V,n,P)=>{ const m=P.kind==='LOC'?P.minima.locMda:P.minima.da; return [has(n,num(m)), has(n,/rvr|visibility|metres|meters|550|750|1200|1300/), has(n,/bug|baro|minimums? set|set (the )?minim/), has(n,/lights|runway|visual|see/)]; }),
    R('M',{en:'Missed approach',no:'Avbrutt innflyging'},{en:'The published procedure in your own words, the first actions (power, attitude, gear and flaps), one engine inoperative, and the plan after the missed (hold, second approach or alternate).',no:'Den publiserte prosedyren med egne ord, første handlinger (gass, attityde, hjul og klaff), én motor ute, og planen etter avbrutt innflyging (holding, ny innflyging eller alternativ).'},
      (V,n)=>[has(n,/straight ahead|track 360|runway heading/), has(n,num(3000)), has(n,/holan|hold/), has(n,/power|go.?around|pitch|gear|flaps/), has(n,/(one|1) engine|single engine|oei|engine failure|asymmetric/), has(n,/alternate|second approach|another approach|divert/)])
  ]},
  land:{name:{en:'Arrival and landing briefing (VFR)',no:'Ankomst- og landingsbriefing (VFR)'},letters:'RJCSGT',items:[
    R('R',{en:'Runway and wind',no:'Rullebane og vind'},{en:'Runway in use, wind and crosswind, length, surface.',no:'Rullebane i bruk, vind og sidevind, lengde, underlag.'},(V,n)=>[has(n,/36/), has(n,num(V.wd))||has(n,/wind/), has(n,/crosswind|headwind|1500|length/)]),
    R('J',{en:'Joining and circuit',no:'Innkomst og landingsrunde'},{en:'Entry point and altitude, the circuit direction and height, where you expect to join.',no:'Innpasseringspunkt og høyde, retning og høyde på runden, hvor du forventer å komme inn.'},(V,n)=>[has(n,/november|sierra/), has(n,num(1500))||has(n,num(1000)), has(n,/left|right|base|downwind|final|straight in/)]),
    R('C',{en:'Configuration and speeds',no:'Konfigurasjon og farter'},{en:'Gear and flaps plan, approach speed and Vref.',no:'Plan for hjul og klaff, innflygingsfart og Vref.'},(V,n)=>{ const s=O.speeds(V.mass); return [has(n,/gear/), has(n,/flaps?/), has(n,num(s.vref))||has(n,/vref/)]; }),
    R('S',{en:'Stable and touchdown',no:'Stabil og sette-ned'},{en:'Stable by 500 ft, aiming point, how you stop and where you vacate.',no:'Stabil innen 500 ft, siktepunkt, hvordan du stopper og hvor du forlater banen.'},(V,n)=>[has(n,/stable|500/), has(n,/aim|touch ?down|markers|threshold/), has(n,/vacate|exit|taxiway|a3/)]),
    R('G',{en:'Go-around',no:'Go-around'},{en:'When you go around and how: power, attitude, flaps and gear, where you fly.',no:'Når du går rundt og hvordan: gass, attityde, klaff og hjul, hvor du flyr.'},(V,n)=>[has(n,/go.?around|missed/), has(n,/power|full|max/), has(n,/flaps?|gear|climb|90/)]),
    R('T',{en:'Threats and questions',no:'Trusler og spørsmål'},{en:'Traffic, terrain, weather, birds, and how you deal with them. Questions.',no:'Trafikk, terreng, vær, fugl, og hvordan du håndterer det. Spørsmål.'},(V,n)=>[has(n,/threat|traffic|terrain|weather|bird|wind shear|gust/), has(n,/question/)])
  ]}
};

function proc(V){ return O.APPS[V.app]||O.ILS36; }
/* fakta-ark som sendes til AI-en og vises for eleven */
function facts(kind,V){
  const s=O.speeds(V.mass), A=O.AC, P=proc(V);
  const base=`AIRCRAFT: ${A.type} ${A.reg}, mass ${V.mass} kg (MTOM ${A.mtom}). Speeds KIAS: Vr ${s.vr}, V50 ${s.v50}, Vy ${s.vy}, Vyse ${A.vyse} (blue line), Vmca ${A.vmca.up}, VFE APP ${A.vfe.app} / LDG ${A.vfe.ldg}, VLO extend ${A.vlo.ext} retract ${A.vlo.ret}, Vref flaps LDG ${s.vref} (APP ${s.vrefApp}), min go-around speed ${A.vga}. Demonstrated crosswind ${A.xwind} kt. OEI: ${A.oei}
AERODROME: Birdbird (NAER, fictional), elevation ${O.APT.elev} ft, runway 36/18, 1500 x 30 m, asphalt. Taxiway A parallel east of the runway, holding point A1 for runway 36, exit A3 at the north end. Frequencies: ATIS ${O.APT.freq.atis}, Delivery ${O.APT.freq.del}, Ground ${O.APT.freq.gnd}, Tower ${O.APT.freq.twr}, Approach ${O.APT.freq.app}. Transition altitude ${O.APT.ta} ft. MSA ${O.APT.msa} ft (${O.APT.msaRef}).
WEATHER: ${V.metar}. ATIS information ${V.info}. Wind ${V.wind}: headwind ${V.hw} kt, crosswind ${V.xw} kt on runway 36. QNH ${V.qnh}.`;
  if(kind==='dep') return base+'\n'+(V.ifr?`CLEARANCE: cleared to Birdbird via ${O.SID.name} departure, flight planned route, climb ${V.clrAlt}, squawk ${V.sq}. SID ${O.SID.name}: ${O.SID.text} Minimum climb gradient ${O.SID.grad}. ${O.SID.gradNote} Departure frequency: Birdbird Approach ${O.APT.freq.app}.`
     : `VFR: leave the control zone via ${O.APT.vrp[V.vrp]}, at or below 1500 ft, squawk 7000. After leaving: Polaris Information ${O.APT.freq.fis}.`);
  if(kind==='app') return base+`\nAPPROACH CHART: ${P.name}, chart ${P.chart} dated ${P.date}. ${P.kind==='RNP'?'SBAS '+P.loc+', LPV and LNAV minima':'LOC '+P.loc}, final course ${P.crs}°. ${P.kind==='LOC'?'Glidepath OUT: fly as LOC only, step down / CDFA.':'Glidepath '+P.gp+'°, TCH '+P.tch+' ft.'}
IAF: ${P.iaf.map(x=>x.join(' ')).join(', ')}. IF: ${P.if_.join(' ')}. ${P.kind==='LOC'?'FAF':'FAP'}: ${P.faf.join(' ')}. Distance/altitude checks: ${P.checks.map(c=>c[0]+' '+c[1]+' ft').join(', ')}. Rate of descent on ${P.gp}°: ${Object.entries(P.rod).map(([k,v])=>k+' kt GS '+v+' fpm').join(', ')}.
MINIMA: ${P.kind==='LOC'?`LOC MDA ${P.minima.locMda} ft (MDH ${P.minima.locMdh}), VIS ${P.minima.locVis} m`:`${P.kind==='RNP'?'LPV ':''}DA ${P.minima.da} ft (DH ${P.minima.dh}), RVR ${P.minima.rvr} m. ${P.kind==='RNP'?'LNAV MDA '+P.minima.locMda+' ft':'LOC only MDA '+P.minima.locMda+' ft'}`}. Circling ${P.minima.circ}.
MISSED APPROACH: ${P.missed} HOLDS: ${P.hold} MSA ${P.msa} ft. TA ${P.ta} ft. ${P.notes}
EXPECTED: ${V.ifr?'Radar vectors or own navigation to ALPOR, then the ALPOR transition (ALPOR – RONAX – FAPSO).':''} Landing runway 36, exit A3.`;
  return base+`\nVFR ARRIVAL: enter the control zone via ${O.APT.vrp[V.vrp||'N']} at or below 1500 ft, expect to join ${V.vrp==='S'?'straight in for final runway 36':'right base for runway 36'}. Circuit height 1000 ft. Landing runway 36, exit A3.`;
}

/* lokal vurdering (uten AI) */
function local(kind,V,text){
  const n=norm(text), P=proc(V), rub=RUB[kind];
  const items=rub.items.map(it=>{ const c=it.chk(V,n,P); const hit=c.filter(Boolean).length, max=c.length; const r=hit/max;
    return {k:it.k,status: r>=0.99?'ok': r>0?'partial':'missing', frac:r}; });
  const score=Math.round(items.reduce((a,i)=>a+i.frac,0)/items.length*100);
  return {score, items, local:true};
}

function prompt(kind,V,text,lang){
  const rub=RUB[kind];
  return `You are a strict but encouraging EASA flight instructor and examiner (IR/ME and PPL/CPL). A pilot has just given a ${rub.name.en.toLowerCase()} for a DA42 flight, out loud or typed (speech recognition may have garbled some words: judge the content, not the spelling).

FACTS FOR TODAY (the briefing must be correct against these):
${V.packFacts? 'The pilot is briefing their OWN planned flight. Facts from their briefing pack (where something is missing from the pack, accept a reasonable value but say it was not in the pack, and never invent chart data):\n'+V.packFacts : facts(kind,V)}

THE BRIEFING MUST COVER THESE ELEMENTS, in roughly this order:
${rub.items.map(i=>`${i.k} — ${i.t.en}: ${i.d.en}`).join('\n')}

pilot's briefing:
"""${String(text).slice(0,6000)}"""

Assess it the way an examiner would: is each element present, correct against the facts, specific (numbers the pilot will actually use, not generic phrases) and safe? Wrong numbers are worse than missing ones: mark them "wrong" and say the correct value. A briefing that is complete but recited without thinking about today’s threats should not get top marks. Brevity is good: do not ask for more words than necessary.

Write all comments in ${lang}. Reply with only a JSON object:
{"score": integer 0-100,
 "items": [{"k": "letter exactly as listed above", "status": "ok" | "partial" | "missing" | "wrong", "comment": "one or two short sentences: what was good or what is missing/wrong, with the correct value"}],  (one entry per element, same order)
 "strengths": ["up to 2 short points"],
 "fix": ["up to 3 concrete things to change next time, most important first"],
 "model": "a model briefing for exactly today's facts, in English as said in the cockpit, 90-170 words"}`;
}

/* modellbriefing (uten AI) */
const xwTxt=V=> V.xw<2?'no real crosswind':`about ${V.xw} knots crosswind from the ${V.wd>180?'left':'right'}`;
function model(kind,V){
  const s=O.speeds(V.mass), P=proc(V);
  if(kind==='dep') return V.ifr?
`Departure briefing. Threats: ${V.cld[0]==='BKN'||V.cld[0]==='OVC'?'cloud base '+V.cld[1]+' feet so we enter IMC early, ':''}terrain north-west and the 4.5 per cent gradient on one engine, ${V.t<=3?'possible icing so pitot heat on, ':''}mass ${V.mass} kilos.
Runway 36 from A1, full length 1500 metres, wind ${V.wind}, ${xwTxt(V)}.
Initial: ${O.SID.name}, track 360, at 1500 feet left turn direct OSVIK, climb 3000 feet, squawk ${V.sq}, minimum gradient 4.5 per cent to 1500 feet. After departure Birdbird Approach ${O.APT.freq.app}. Flight plan and course checked on the PFD.
Bugs: normal take-off, flaps up, rotate ${s.vr}, climb ${s.vy}, blue line ${O.AC.vyse}.
Emergencies: any failure or warning before rotation, I call stopping, both power levers idle, keep it straight, brake as required. Engine failure after rotation with gear down and runway remaining: land ahead. Otherwise power max, gear up, flaps up, 85 knots, identify, verify, secure. The SID gradient may not be achievable on one engine today, so I fly runway track, climb to MSA and ask Approach for vectors back to the ILS 36.
Transition altitude 7000, standard set passing 7000 in the climb.
Safe altitude: MSA 3200 feet in this sector. Any questions?`
:`Departure briefing. Threats: traffic in the zone and at the reporting point, birds near the lake, so we keep a good lookout and call early. Mass ${V.mass} kilos.
Runway 36 from A1, full length 1500 metres, wind ${V.wind}, ${xwTxt(V)}.
Initial: leave the zone via ${V.vrp==='S'?'SIERRA':'NOVEMBER'} at 1500 feet or below, squawk 7000, then Polaris Information ${O.APT.freq.fis}.
Bugs: normal take-off, flaps up, rotate ${s.vr}, climb ${s.vy}, blue line ${O.AC.vyse}.
Emergencies: any problem before rotation, stopping, both power levers idle, keep it straight, brake. Engine failure after lift-off with runway remaining: land ahead. Otherwise power max, gear up, flaps up, 85 knots, identify, verify, secure, and fly a circuit back to runway 36.
Transition altitude 7000, we stay well below it.
Safe altitude: MSA 3200 feet, we stay VFR below cloud and above 1000 feet over the town. Any questions?`;
  if(kind==='app') return `Approach briefing. Threats: ${V.cld[0]} ${V.cld[1]} feet, wind ${V.wind}${V.t<=3?', icing in cloud':''}, terrain 1100 feet three miles west of the final, mass ${V.mass} kilos.
Setup: ${P.name}, chart ${P.chart} dated ${P.date}. ${P.kind==='RNP'?'Loaded from the database, channel '+P.loc.split(' ')[1]+', LPV':'LOC '+P.loc+', set and identified'}, final course 360. ${P.kind==='LOC'?'Glidepath is out, so this is a localizer approach.':''} Landing flaps LDG, Vref ${s.vref}, 1500 metres, vacate A3 at the end.
Arrival: via ALPOR at 3000, RONAX at 3000, hold at RONAX if needed. MSA 3200 feet, transition altitude 7000.
Descent: ${P.kind==='LOC'?'FAF':'FAP'} FAPSO at 1650 feet, 5 miles. ${P.kind==='LOC'?'Constant angle':'Glidepath'} 3 degrees, about 480 feet per minute at 90 knots. Checks: 4 miles 1330, 3 miles 1020, 2 miles 700. Gear down and flaps set before FAPSO, stable by 1000 feet or we go around.
Minimums: ${P.kind==='LOC'?'MDA '+P.minima.locMda:'DA '+P.minima.da} feet, set on the baro bug, ${P.kind==='LOC'?'visibility '+P.minima.locVis+' metres':'RVR '+P.minima.rvr+' metres'}. To continue I need the approach lights or the runway.
Missed: straight ahead track 360 to 3000 feet, then direct HOLAN and hold. Power max, pitch up, flaps APP, positive climb gear up, 90 knots, flaps up at a safe altitude. On one engine: max power, 85 knots, same route, tell Approach. After the missed: another approach or divert to the alternate, depending on fuel and weather. Questions?`;
  return `Arrival briefing. Runway 36, wind ${V.wind}, ${xwTxt(V)}, 1500 metres. We enter via ${V.vrp==='S'?'SIERRA':'NOVEMBER'} at 1500 feet or below and expect ${V.vrp==='S'?'a straight-in for final 36':'right base 36'}, circuit height 1000.
Gear down on base, flaps APP then LDG on final, Vref ${s.vref}. Stable by 500 feet, aim at the markers, vacate A3 at the end.
Go-around: power max, pitch up, flaps APP, positive climb gear up, 90 knots, climb straight ahead to 1000 and tell Tower.
Threats: traffic at the reporting point and in the circuit, birds by the lake, gusts. Questions?`;
}

/* ---------- felles visning og vurdering ---------- */
const L=o=>G.LAB.L(o), esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function briefOut(kind,V,r){
  const rub=BRIEF.RUB[kind]; const lbl={ok:{en:'Covered',no:'Dekket'},partial:{en:'Partly',no:'Delvis'},missing:{en:'Missing',no:'Mangler'},wrong:{en:'Wrong',no:'Feil'}};
  const items=rub.items.map((it,j)=>{ const x=(r.items&&r.items[j])||{}; const stt=['ok','partial','missing','wrong'].includes(x.status)?x.status:'missing';
    return `<div class="ri"><span class="k">${esc(it.k)}</span><div><b>${esc(L(it.t))}</b><p>${esc(x.comment||L(it.d))}</p></div><span class="st ${stt}">${L(lbl[stt])}</span></div>`; }).join('');
  return `<div style="display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap;margin-top:8px"><span class="bigscore">${Math.round(r.score)} %</span><span class="note">${r.local?L({en:'Built-in check: looks for the elements and today’s numbers. The AI instructor also judges whether they are right and safe.',no:'Innebygd sjekk: ser etter elementene og dagens tall. AI-instruktøren vurderer også om de er riktige og trygge.'}):L({en:'Scored by the AI instructor.',no:'Vurdert av AI-instruktøren.'})}</span></div>
    <div class="rubric">${items}</div>
    ${(r.fix&&r.fix.length)?`<div class="why"><b>${L({en:'Next time',no:'Neste gang'})}:</b><ul style="margin:6px 0 0;padding-left:20px">${r.fix.map(f=>`<li>${esc(f)}</li>`).join('')}</ul></div>`:''}
    <details><summary>${L({en:'Model briefing',no:'Modellbriefing'})}</summary><div class="why">${esc(r.model||BRIEF.model(kind,V)).replace(/\n/g,'<br>')}</div></details>`;
}
let bCtl=null;
async function score(kind,V,text,o){ const {out,note,btn,done}=o;
  text=String(text||'').trim(); if(text.length<25){ note.textContent=L({en:'Give the briefing first: a few sentences at least.',no:'Gi briefingen først: minst noen setninger.'}); return; }
  note.textContent=''; let r=null;
  const aiOn=!!(G.NAI&&NAI.mode);
  if(V.packFacts&&!aiOn){ note.textContent=L({en:'Scoring a briefing for your own flight needs the AI. Open the page in Claude, or switch to the practice airport.',no:'Vurdering av briefing for din egen tur krever AI. Åpne siden i Claude, eller bytt til øvingsflyplassen.'}); return; }
  if(aiOn){ btn.disabled=true; out.innerHTML=`<div class="thinking">${L({en:'The instructor is listening to your briefing…',no:'Instruktøren hører på briefingen din…'})}</div>`; bCtl=new AbortController();
    try{ r=await NAI.json(BRIEF.prompt(kind,V,text,NAI.langName()),{signal:bCtl.signal,tier:'default'}); if(!r||typeof r.score!=='number') throw {code:'invalid_json'}; }
    catch(e){ NAI.fatal(e); note.textContent=NAI.errText(e)+' '+L({en:'Showing the built-in check.',no:'Viser den innebygde sjekken.'}); r=null; }
    finally{ btn.disabled=false; } }
  if(!r) r=BRIEF.local(kind,V,text);
  out.innerHTML=briefOut(kind,V,r); bCtl=null;
  if(r.score>=80){ if(kind==='dep') NPROG.award('brief:dep',100); if(kind==='app') NPROG.award('brief:app',100); }
  try{ if(G.NSTORE&&Array.isArray(r.items)){ const rub=RUB[kind], nm=rub.name.en.split(' (')[0]; const gaps=[], grades=[];
      r.items.forEach((x,ix)=>{ const it=(rub.items[ix]&&rub.items[ix].k===x.k)?rub.items[ix]:rub.items.find(i=>i.k===x.k); if(!it) return; const topic=nm+': '+it.t.en;
        if(x.status==='ok') grades.push({topic,score:10}); else gaps.push(topic); });
      NSTORE.put('fises',{id:'b'+Date.now().toString(36),inst:'aircraft',mode:'brief',src:'briefing',kind,started:Date.now(),mins:0,acName:V.packFacts?L({en:'own pack',no:'egen pakke'}):'',grades,gaps:[...new Set(gaps)].slice(0,6),turns:[]}); } }catch(e){}
  done&&done(r);
}

G.BRIEF={RUB,facts,local,prompt,model,norm,proc,out:briefOut,score,stop:()=>bCtl&&bCtl.abort()};
})(window);
