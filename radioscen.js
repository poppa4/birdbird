/* Birdbird – radio trainer scenario library. TRAINING DATA: the aerodromes (Birdbird, Skarvik, Tjernmo), units, frequencies,
   procedures (OSVIK 1N, TUSKA 1A, RONAX hold, ILS/RNP 36) and traffic are fictional and not for navigation.
   Phraseology follows EASA SERA (Regulation (EU) No 923/2012, Section 14, and its AMC1 SERA.14001 phraseology appendix,
   EAR revision August 2025), ICAO Doc 4444 (16th ed., Amdt 13) and Doc 9432, and AIP Norway (transition altitude 7000 ft,
   AFIS per GEN 3.3). Each scenario carries `basis`: the paragraphs its calls and readbacks are checked against.
   Each segment returns steps: {unit, sit, atc, rb, task, els, model, reply, cat, ph}. Controller texts are templates with
   the session variables (callsign, runway, QNH, squawk, frequencies, wind, levels). */
(function(G){
'use strict';
const C=G.RADIOCORE, tr=C.tr, PHW=C.PHW;

/* ---------------- variables ---------------- */
function tl(qnh){ for(const f of [75,80,85,90,95]){ if(f*100+(qnh-1013)*27>=7500) return f; } return 95; }
function vars(seed,o){
  o=o||{}; const r=C.rng(seed||1); const pick=a=>a[Math.floor(r()*a.length)], int=(a,b)=>a+Math.floor(r()*(b-a+1));
  const cs=C.parseCallsign(o.callsign||'LN-NAE');
  const LET='ABCDEFGHIJKLMNOPQRSTUVWY'; const li=int(0,20);
  const qnh=int(988,1031), t=int(2,18);
  const oct=()=>int(0,7), sq=()=>String(int(1,6))+oct()+oct()+String(int(1,7));
  const TL=tl(qnh), wd=pick([320,330,340,350,360,10,20,30,40]);
  return {seed,cs,c:cs.full,a:cs.abbr||cs.full,type:'DA42',
    info:LET[li],info2:LET[li+1],qnh,qnh2:qnh+pick([-1,1]),tl:TL,fl:pick(TL<=80?[90,100]:[100,110]),
    wd:String(wd).padStart(3,'0'),ws:int(3,14),wd18:String(pick([150,160,170,180,190,200])),ws18:int(3,10),t,td:t-int(1,6),cloud:pick(['few 2500 feet','scattered 3000 feet','broken 4500 feet','no significant cloud']),time:String(int(0,23)).padStart(2,'0')+pick(['20','50']),
    sq:sq(),sq2:sq(),sqv:sq(),app:pick(['119.250','120.900','124.200']),fis:pick(['125.350','126.150']),
    hdgL:pick(['330','320','310','300']),hdgR:pick(['020','030','040','050']),hdgM:pick(['020','350','010']),eat:String(int(10,55)).padStart(2,'0'),spd:pick([120,130,140]),
    appT:pick(['ILS','RNP']),pob:int(1,3),tpos:String(int(10,40)).padStart(2,'0'),endur:pick([40,50,60]),
    dist:pick([8,10,12]),alt0:pick([1500,2000,2500])};
}
const UNIT=V=>({atis:{n:'Birdbird ATIS',f:'127.130'},del:{n:'Birdbird Delivery',f:'121.875'},gnd:{n:'Birdbird Ground',f:'121.700'},twr:{n:'Birdbird Tower',f:'118.300'},
  app:{n:'Birdbird Approach',f:V.app},ctl:{n:'Vestfjell Control',f:'128.905'},fis:{n:'Vestfjell Information',f:V.fis},afis:{n:'Skarvik Information',f:'123.455'},trf:{n:'Tjernmo Traffic',f:'123.505'}});
const W=l=>PHW[String(l).toLowerCase()];
function atisText(V,arr){ const L=arr?V.info2:V.info, Q=arr?V.qnh2:V.qnh;
  return `Birdbird information ${W(L)}, time ${V.time}. Runway 36 in use. Transition level ${V.tl}. Wind ${V.wd} degrees ${V.ws} knots. Visibility 10 kilometres or more. ${V.cloud[0].toUpperCase()+V.cloud.slice(1)}. Temperature ${V.t}, dew point ${V.td}. QNH ${Q} hectopascals. Acknowledge information ${W(L)} on first contact.`; }

/* ---------------- element shorthands ---------------- */
const cs=o=>Object.assign({k:'cs'},o), stn=(v,o)=>Object.assign({k:'stn',v},o), rwy=(v,o)=>Object.assign({k:'rwy',v:String(v)},o), qnh=(v,o)=>Object.assign({k:'qnh',v},o),
  alt=(v,o)=>Object.assign({k:'alt',v},o), fl=(v,o)=>Object.assign({k:'fl',v},o), hdg=(v,o)=>Object.assign({k:'hdg',v},o), turn=(v,o)=>Object.assign({k:'turn',v},o),
  sq=(v,o)=>Object.assign({k:'sq',v},o), freq=(v,unit,o)=>Object.assign({k:'freq',v,unit},o), info=(v,o)=>Object.assign({k:'info',v},o), hp=(v,o)=>Object.assign({k:'hp',v},o),
  hs=(v,o)=>Object.assign({k:'hs',v},o), fix=(v,o)=>Object.assign({k:'fix',v},o), spd=(v,o)=>Object.assign({k:'spd',v},o), trk=(v,o)=>Object.assign({k:'trk',v},o),
  num=(v,kw,en,no,o)=>Object.assign({k:'num',v,kw,l:tr(en,no)},o), P=(en,no,re,o)=>Object.assign({k:'phr',l:tr(en,no),re},o);
const OPT={opt:true};
const POS=(en,no,re)=>P('Position: '+en,'Posisjon: '+(no||en),re||/\b(miles?|south|north|east|west|over|overhead|abeam|apron|stand|holding|point|downwind|base|final|s|n)\b/,{ask:'say position'});
const INTENT=(en,no,re)=>P('Intention: '+en,'Hensikt: '+(no||en),re,{ask:'say intentions'});
const TYPE=P('Aircraft type (DA42)','Flytype (DA42)',/\b(da ?42|d a 42|diamond|twin star)\b/,OPT);
const WILCO=P('“Wilco” for the report','«Wilco» for meldingen',/\b(wilco|will report|will call|report(ing)?)\b/,OPT);
const CTO=P('“Cleared for take-off”','«Cleared for take-off»',/\bcleared (for )?(the )?takeoff\b/,{say:'cleared for take-off'});
const CLD=P('“Cleared to land”','«Cleared to land»',/\bcleared (to |for )?land(ing)?\b/,{say:'cleared to land'});
const READY=P('“Ready for departure”','«Ready for departure»',/\bready\b/,{ask:'say intentions'});
const fc=(V,u,f,o)=>Object.assign({cat:'rb',rb:1,atc:`${V.a}, contact ${u} ${f}.`,task:tr('Read back the frequency change.','Les tilbake frekvensskiftet.'),els:[freq(f,u),cs()],model:`${u} ${f}, ${V.a}.`},o);

/* ---------------- segments ---------------- */
const SEG={
/* --- ATIS --- */
atis:V=>{ const u=UNIT(V); return [
  {unit:u.atis,ph:'ground',cat:'copy',atis:1,noAtc:1,atc:atisText(V),sit:tr('Before you call Ground, listen to the ATIS and write down what you need.','Før du kaller Ground: lytt på ATIS og noter det du trenger.'),
   task:tr('Copy the ATIS: letter, runway, wind, QNH and transition level (any order, digits are fine).','Noter ATIS: bokstav, bane, vind, QNH og overgangsnivå (valgfri rekkefølge, sifre går fint).'),
   els:[{k:'letter',v:V.info},rwy(36),{k:'wind',v:[V.wd,V.ws]},qnh(V.qnh),num(V.tl,['transition','level','tl'],'Transition level '+V.tl,'Overgangsnivå '+V.tl)],
   model:`${W(V.info)}, runway 36, wind ${V.wd}/${V.ws}, QNH ${V.qnh}, transition level ${V.tl}.`,
   why:tr('Copy the letter and the QNH first; they are what you say and set. The transition level tells you where altitudes become flight levels.','Noter bokstaven og QNH først; det er dem du sier og stiller inn. Overgangsnivået forteller hvor høyder blir flygenivåer.')}]; },
/* --- VFR: taxi to the holding point --- */
vtaxi:V=>{ const u=UNIT(V); return [
  {unit:u.gnd,ph:'ground',cat:'call',sit:tr(`Engines running at the apron. VFR to the training area south of Birdbird via Sierra. ATIS is information ${W(V.info)}.`,`Motorene går på apron. VFR til øvingsområdet sør for Birdbird via Sierra. ATIS er information ${W(V.info)}.`),
   task:tr('First call to Ground: station, callsign, where you are, ATIS letter, what you want (taxi).','Første oppkall til Ground: stasjon, kallesignal, hvor du er, ATIS-bokstav, hva du vil (taksing).'),
   els:[stn('Birdbird Ground'),cs(),POS('at the apron','på apron',/\b(apron|stand|parking|ramp)\b/),info(V.info,{ask:`confirm information ${W(V.info)}`}),P('Request taxi','Be om taksing',/\btaxi\b/,{ask:'say intentions'}),P('VFR / destination','VFR / mål',/\b(vfr|training area|local|sierra|s)\b/,OPT)],
   model:`Birdbird Ground, ${V.c}, DA42 at the apron, information ${W(V.info)}, VFR to the training area via Sierra, request taxi.`},
  {rb:1,cat:'rb',ph:'ground',atc:`${V.a}, taxi to holding point A1 runway 36 via Alpha, QNH ${V.qnh}.`,task:tr('Read back the taxi clearance.','Les tilbake taksiklareringen.'),
   els:[hp('A1'),rwy(36),qnh(V.qnh),cs(),P('Via Alpha','Via Alpha',/\b(via )?a\b|\balpha\b/,OPT)],model:`Holding point A1 runway 36 via Alpha, QNH ${V.qnh}, ${V.a}.`},
  fc(V,'Tower','118.300',{ph:'ground',sit:tr('You taxi to A1 and do the run-up. Ground hands you over.','Du takserer til A1 og gjør run-up. Ground gir deg videre.')})]; },
/* --- VFR: line-up (conditional) and take-off --- */
vline:V=>{ const u=UNIT(V); return [
  {unit:u.twr,ph:'dep',cat:'call',sit:tr('Run-up done at holding point A1. A DA40 is on short final.','Run-up ferdig på holdepunkt A1. En DA40 er på kort finale.'),
   task:tr('Tell Tower you are ready.','Si fra til Tower at du er klar.'),els:[stn('Birdbird Tower'),cs(),hp('A1',{opt:true}),READY],
   model:`Birdbird Tower, ${V.c}, holding point A1, ready for departure.`},
  {rb:1,cat:'rb',ph:'dep',atc:`${V.a}, behind the landing DA40 on short final, line up runway 36, behind.`,
   task:tr('Read back the conditional clearance: condition, clearance, condition again.','Les tilbake den betingede klareringen: betingelse, klarering, betingelse igjen.'),
   els:[P('Condition first: “behind the landing DA40”','Betingelsen først: «behind the landing DA40»',/\bbehind\b.*\b(landing|da ?40|d a 40|traffic|aircraft)\b/,{say:'behind the landing DA40'}),P('“Lining up” (or “line up”)','«Lining up» (eller «line up»)',/\b(lineup|lining up)\b/,{say:'line up'}),rwy(36),{k:'count',re:/\bbehind\b/g,n:2,l:tr('“Behind” repeated at the end','«Behind» gjentatt til slutt'),say:'behind'},cs()],
   model:`Behind the landing DA40, lining up runway 36, behind, ${V.a}.`,why:C.RULE.cond},
  {rb:1,cat:'rb',ph:'dep',sit:tr('The DA40 has landed and vacated. You are lined up.','DA40-en har landet og forlatt banen. Du står oppstilt.'),atc:`${V.a}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared for take-off.`,
   task:tr('Read back the take-off clearance.','Les tilbake avgangsklareringen.'),els:[rwy(36),CTO,cs()],model:`Runway 36, cleared for take-off, ${V.a}.`}]; },
/* --- VFR: leaving the zone, to FIS --- */
vdep:V=>{ const u=UNIT(V); return [
  {unit:u.twr,abbr:1,ph:'dep',cat:'call',sit:tr('Airborne. You climb out to the south towards reporting point Sierra, 1500 ft.','I luften. Du stiger ut sørover mot meldepunkt Sierra, 1500 ft.'),
   task:tr('Report leaving the control zone via Sierra at 1500 ft.','Meld at du forlater kontrollsonen via Sierra i 1500 ft.'),
   els:[cs(),P('Leaving the control zone','Forlater kontrollsonen',/\b(leaving|left|exiting|vacating)\b/,{ask:'say position'}),fix('Sierra'),alt(1500,{ask:'say altitude'})],model:`${V.a}, leaving the control zone via Sierra, 1500 feet.`},
  fc(V,'Vestfjell Information',V.fis,{ph:'dep',atc:`${V.a}, contact Vestfjell Information ${V.fis}, goodbye.`,model:`Vestfjell Information ${V.fis}, ${V.a}, goodbye.`})]; },
/* --- VFR: flight information service --- */
vfis:V=>{ const u=UNIT(V); return [
  {unit:u.fis,ph:'enroute',cat:'call',sit:tr('South of Sierra at 2500 ft, heading for the training area. You want flight information service.','Sør for Sierra i 2500 ft, på vei mot øvingsområdet. Du vil ha flygeinformasjonstjeneste.'),
   task:tr('First call to Vestfjell Information: station, full callsign, type, position, altitude, request.','Første oppkall til Vestfjell Information: stasjon, fullt kallesignal, type, posisjon, høyde, ønske.'),
   els:[stn('Vestfjell Information'),cs(),TYPE,POS('south of Birdbird / Sierra','sør for Birdbird / Sierra'),alt(2500,{ask:'say altitude'}),INTENT('flight information / training area','flygeinformasjon / øvingsområdet',/\b(information|service|training|area|request)\b/)],
   model:`Vestfjell Information, ${V.c}, DA42, 5 miles south of Sierra, 2500 feet, VFR to the training area, request flight information service.`},
  {rb:1,cat:'rb',ph:'enroute',atc:`${V.c}, Vestfjell Information, squawk ${V.sqv}, QNH ${V.qnh2}, report entering the training area.`,task:tr('Read back.','Les tilbake.'),
   els:[sq(V.sqv),qnh(V.qnh2),cs(),WILCO],model:`Squawk ${V.sqv}, QNH ${V.qnh2}, wilco, ${V.c}.`},
  {rb:1,cat:'rb',ph:'enroute',atc:`${V.c}, traffic 2 o'clock, 4 miles, crossing left to right, DA40, 2500 feet.`,task:tr('Acknowledge the traffic: you are looking out.','Bekreft trafikken: du ser etter den.'),
   els:[P('“Looking out” or “traffic in sight”','«Looking out» eller «traffic in sight»',/\b(looking( out)?|in sight|traffic (in )?sight|negative contact|visual)\b/,{say:'report traffic in sight'}),cs()],model:`Looking out, ${V.c}.`,
   why:tr('Traffic information is acknowledged with “looking out”, “traffic in sight” or “negative contact”, plus your callsign. No readback of the numbers is needed.','Trafikkinformasjon bekreftes med «looking out», «traffic in sight» eller «negative contact», og kallesignalet. Tallene trenger ikke leses tilbake.')},
  {cat:'call',ph:'enroute',sit:tr(`You are over Skarvik at time ${V.tpos}, 2500 ft, and plan to be at Tjernmo at ${String((+V.tpos+12)%60).padStart(2,'0')}.`,`Du er over Skarvik klokken ${V.tpos}, 2500 ft, og regner med å være ved Tjernmo ${String((+V.tpos+12)%60).padStart(2,'0')}.`),
   task:tr('Give a position report: callsign, position, time, altitude, next point and estimate.','Gi en posisjonsmelding: kallesignal, posisjon, tid, høyde, neste punkt og estimat.'),
   els:[cs(),fix('Skarvik',{alt:['scarvik','skarvig']}),num(V.tpos,['at','time','skarvik'],'Time '+V.tpos,'Tid '+V.tpos,{ask:'say time over Skarvik'}),alt(2500,{ask:'say altitude'}),fix('Tjernmo',{opt:true,alt:['tiernmo','chernmo','tjernmoe']}),num(String((+V.tpos+12)%60).padStart(2,'0'),['estimate','estimating','tjernmo','at'],'Estimate','Estimat',OPT)],
   model:`${V.c}, Skarvik ${V.tpos}, 2500 feet, estimate Tjernmo ${String((+V.tpos+12)%60).padStart(2,'0')}.`}]; },
/* --- VFR: TMA crossing --- */
vtma:V=>{ const u=UNIT(V); return [
  {unit:u.app,ph:'enroute',cat:'call',sit:tr('VFR from Skarvik to Tjernmo. The direct line crosses Birdbird TMA. You are 5 miles south of Skarvik at 2500 ft and want to cross at 4500 ft.','VFR fra Skarvik til Tjernmo. Den rette linjen krysser Birdbird TMA. Du er 5 miles sør for Skarvik i 2500 ft og vil krysse i 4500 ft.'),
   task:tr('Call Approach and request the crossing.','Kall Approach og be om kryssing.'),
   els:[stn('Birdbird Approach'),cs(),TYPE,POS('5 miles south of Skarvik','5 miles sør for Skarvik'),alt(2500,{ask:'say altitude'}),P('Request crossing (at 4500 ft)','Be om kryssing (i 4500 ft)',/\b(cross|crossing|transit)\b/,{ask:'say intentions'}),fix('Tjernmo',{opt:true,alt:['tiernmo','chernmo']})],
   model:`Birdbird Approach, ${V.c}, DA42, 5 miles south of Skarvik, 2500 feet, VFR to Tjernmo, request crossing of Birdbird TMA at 4500 feet.`},
  {rb:1,cat:'rb',ph:'enroute',atc:`${V.c}, Birdbird Approach, squawk ${V.sq}.`,task:tr('Read back the squawk.','Les tilbake squawk-koden.'),els:[sq(V.sq),cs()],model:`Squawk ${V.sq}, ${V.c}.`},
  {rb:1,cat:'rb',ph:'enroute',atc:`${V.a}, identified, 6 miles south of Skarvik. Cleared to cross Birdbird TMA via Skarvik and Tjernmo, altitude 4500 feet, VFR, QNH ${V.qnh}.`,
   task:tr('Read back the crossing clearance.','Les tilbake kryssingsklareringen.'),
   els:[P('“Cleared to cross”','«Cleared to cross»',/\bcleared (to )?cross/,{say:'cleared to cross Birdbird TMA'}),fix('Skarvik',{opt:true,alt:['scarvik']}),fix('Tjernmo',{alt:['tiernmo','chernmo','tjernmoe']}),alt(4500),qnh(V.qnh),cs()],
   model:`Cleared to cross Birdbird TMA via Skarvik and Tjernmo, altitude 4500 feet, QNH ${V.qnh}, ${V.a}.`},
  {cat:'call',ph:'enroute',sit:tr('Twenty minutes later you leave the TMA to the north, still at 4500 ft.','Tjue minutter senere forlater du TMA-en mot nord, fortsatt i 4500 ft.'),task:tr('Report leaving the TMA.','Meld at du forlater TMA-en.'),
   els:[cs(),P('Leaving the TMA / controlled airspace','Forlater TMA / kontrollert luftrom',/\b(leaving|left|exiting|vacating)\b/,{ask:'say position'}),alt(4500,{opt:true})],model:`${V.a}, leaving Birdbird TMA, 4500 feet.`,
   reply:`${V.a}, squawk 7000, frequency change approved.`},
  {rb:1,cat:'rb',ph:'enroute',task:tr('Read back.','Les tilbake.'),els:[sq('7000'),cs()],model:`Squawk 7000, ${V.a}.`,ctxAtc:1}]; },
/* --- AFIS aerodrome (Norwegian style) --- */
vafis:V=>{ const u=UNIT(V); return [
  {unit:u.afis,ph:'arr',cat:'call',sit:tr('Inbound to Skarvik, an AFIS aerodrome inside a TIZ (radio mandatory). The AFIS officer gives information, not clearances. You are 10 miles north at 2000 ft.','På vei inn til Skarvik, en AFIS-flyplass i en TIZ (radiopliktig). AFIS-operatøren gir informasjon, ikke klareringer. Du er 10 miles nord i 2000 ft.'),
   task:tr('First call to Skarvik Information: station, callsign, type, position, altitude, intention.','Første oppkall til Skarvik Information: stasjon, kallesignal, type, posisjon, høyde, hensikt.'),
   els:[stn('Skarvik Information'),cs(),TYPE,POS('10 miles north','10 miles nord'),alt(2000,{ask:'say altitude'}),INTENT('landing at Skarvik','landing på Skarvik',/\b(land|landing|inbound|join|joining|full stop)\b/)],
   model:`Skarvik Information, ${V.c}, DA42, 10 miles north, 2000 feet, landing Skarvik.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.c}, Skarvik Information, runway 18 in use, wind ${V.wd18} degrees ${V.ws18} knots, QNH ${V.qnh}, traffic a PA28 in the circuit, report right downwind runway 18.`,
   task:tr('Read back runway and QNH, and acknowledge the report.','Les tilbake bane og QNH, og bekreft meldingen.'),els:[rwy(18),qnh(V.qnh),cs(),WILCO],model:`Runway 18, QNH ${V.qnh}, wilco, ${V.c}.`,
   why:tr('To an AFIS unit you always read back the runway in use, runway availability, QNH and transition level, any squawk and any relayed ATC clearance (AIP Norway GEN 3.3 4.1.5). There is no clearance: you decide, and you report. Tell AFIS if you will not use the runway in use.','Til en AFIS-enhet leser du alltid tilbake bane i bruk, informasjon om banen er tilgjengelig, QNH og overgangsnivå, squawk og videreformidlede ATC-klareringer (AIP Norge GEN 3.3 4.1.5). Det er ingen klarering: du bestemmer, og du melder. Si fra til AFIS hvis du ikke vil bruke bane i bruk.'),
   bad:[{re:/\bcleared\b/,en:'AFIS does not issue clearances. Do not say “cleared”.',no:'AFIS gir ikke klareringer. Ikke si «cleared».'}]},
  {cat:'call',ph:'arr',sit:tr('You join right downwind for runway 18.','Du kommer inn på høyre medvind for bane 18.'),task:tr('Report right downwind.','Meld høyre medvind.'),
   els:[cs(),P('Right downwind','Høyre medvind',/\b(right )?downwind\b/,{ask:'say position'}),rwy(18,{opt:true})],model:`${V.c}, right downwind runway 18.`,
   reply:`${V.c}, traffic, the PA28 on final runway 18.`},
  {rb:1,cat:'rb',ph:'arr',task:tr('Acknowledge the traffic.','Bekreft trafikken.'),els:[P('Traffic in sight / looking out','Trafikk i sikte / ser etter',/\b(in sight|looking|traffic|number 2|2)\b/,{say:'report traffic in sight'}),cs()],model:`Traffic in sight, ${V.c}.`,ctxAtc:1},
  {cat:'call',ph:'arr',sit:tr('The PA28 has vacated. You turn final.','PA28-en har forlatt banen. Du svinger inn på finale.'),task:tr('Report final.','Meld finale.'),els:[cs(),P('Final','Finale',/\bfinal\b/,{ask:'say position'}),rwy(18,{opt:true})],
   model:`${V.c}, final runway 18.`,reply:`${V.c}, no reported traffic runway 18, wind ${V.wd18} degrees ${V.ws18} knots.`},
  {rb:1,cat:'rb',ph:'arr',task:tr('Read back the runway information. There is no landing clearance at an AFIS aerodrome.','Les tilbake baneinformasjonen. Det finnes ingen landingsklarering på en AFIS-flyplass.'),
   els:[P('“No reported traffic”','«No reported traffic»',/\bno reported traffic\b/,{say:'no reported traffic runway 18'}),rwy(18),cs(),P('Your intention: landing','Hensikten din: landing',/\b(land|landing)\b/,OPT)],model:`No reported traffic runway 18, ${V.c}.`,ctxAtc:1,
   why:tr('“No reported traffic runway 18” means no other aircraft, vehicles or people are using the runway. “Runway occupied” means they are: then you stay off it. Both are read back (AIP Norway GEN 3.3 4.1.5). The decision to land is yours.','«No reported traffic runway 18» betyr at ingen andre luftfartøy, kjøretøy eller personer bruker banen. «Runway occupied» betyr at de gjør det: da holder du deg unna. Begge leses tilbake (AIP Norge GEN 3.3 4.1.5). Beslutningen om å lande er din.'),
   bad:[{re:/\bcleared\b/,en:'“No reported traffic” is information, not a landing clearance. Do not read back “cleared to land”.',no:'«No reported traffic» er informasjon, ikke landingsklarering. Ikke les tilbake «cleared to land».'}]}]; },
/* --- uncontrolled field: blind calls --- */
vblind:V=>{ const u=UNIT(V); const T='Tjernmo traffic'; return [
  {unit:u.trf,ph:'arr',cat:'call',noAtc:1,sit:tr('Tjernmo has no ground station. Pilots talk to each other on the common frequency. You are 5 miles south at 2000 ft, runway 27 in use.','Tjernmo har ingen bakkestasjon. Pilotene snakker med hverandre på felles frekvens. Du er 5 miles sør i 2000 ft, bane 27 i bruk.'),
   task:tr('Blind call: “Tjernmo Traffic”, callsign, type, position, altitude, intention (you may end with the field name).','Blindmelding: «Tjernmo Traffic», kallesignal, type, posisjon, høyde, hensikt (du kan avslutte med plassnavnet).'),
   els:[stn(T),cs(),TYPE,POS('5 miles south','5 miles sør'),alt(2000),INTENT('joining for runway 27','inn for bane 27',/\b(join|joining|overhead|downwind|landing|land)\b/),{k:'last',v:'Tjernmo',l:tr('End with “Tjernmo” (UK practice)','Avslutt med «Tjernmo» (britisk praksis)'),opt:true}],
   model:`Tjernmo traffic, ${V.c}, DA42, 5 miles south, 2000 feet, joining overhead for runway 27, Tjernmo.`,
   why:tr('On an uncontrolled field nobody answers: you transmit blind to “… Traffic” and let your intentions be known, then report downwind, base and final (as in AIP Norway AD 2 for such fields). Saying the field name again at the end is a UK habit (CAP 413), not a SERA or Norwegian requirement, but it helps pilots at other fields on the same frequency.','På en ukontrollert plass er det ingen som svarer: du sender blindt til «… Traffic» og sier hva du har tenkt, og melder så medvind, base og finale (som i AIP Norge AD 2 for slike plasser). Å si plassnavnet igjen til slutt er britisk praksis (CAP 413), ikke et krav i SERA eller i Norge, men det hjelper piloter ved andre plasser på samme frekvens.')},
  {cat:'call',ph:'arr',noAtc:1,sit:tr('You are now on the downwind leg for runway 27.','Du er nå på medvindsleggen for bane 27.'),task:tr('Blind call on downwind.','Blindmelding på medvind.'),
   els:[stn(T),cs(),P('Downwind','Medvind',/\bdownwind\b/),rwy(27),{k:'last',v:'Tjernmo',l:tr('End with “Tjernmo” (UK practice)','Avslutt med «Tjernmo» (britisk praksis)'),opt:true}],model:`Tjernmo traffic, ${V.c}, downwind runway 27, Tjernmo.`},
  {cat:'call',ph:'arr',noAtc:1,sit:tr('A Cessna reports lining up on runway 27 and departs. You turn final.','En Cessna melder at den stiller opp på bane 27 og tar av. Du svinger inn på finale.'),task:tr('Blind call on final.','Blindmelding på finale.'),
   els:[stn(T),cs(),P('Final','Finale',/\bfinal\b/),rwy(27),{k:'last',v:'Tjernmo',l:tr('End with “Tjernmo” (UK practice)','Avslutt med «Tjernmo» (britisk praksis)'),opt:true}],model:`Tjernmo traffic, ${V.c}, final runway 27, Tjernmo.`},
  {cat:'call',ph:'arr',noAtc:1,sit:tr('You have landed and are taxiing off the runway.','Du har landet og takserer av banen.'),task:tr('Blind call: runway vacated.','Blindmelding: banen er forlatt.'),
   els:[stn(T),cs(),P('Runway vacated','Banen forlatt',/\b(vacated|clear of|off the runway)\b/),rwy(27,{opt:true}),{k:'last',v:'Tjernmo',l:tr('End with “Tjernmo” (UK practice)','Avslutt med «Tjernmo» (britisk praksis)'),opt:true}],model:`Tjernmo traffic, ${V.c}, runway 27 vacated, Tjernmo.`}]; },
/* --- VFR: zone entry and landing --- */
varr:V=>{ const u=UNIT(V); return [
  {unit:u.twr,ph:'arr',cat:'call',sit:tr(`Back from the training area: 10 miles north of Birdbird, 2000 ft. You have ATIS information ${W(V.info2)}.`,`Tilbake fra øvingsområdet: 10 miles nord for Birdbird, 2000 ft. Du har ATIS information ${W(V.info2)}.`),
   task:tr('First call to Tower: station, callsign, type, position, altitude, ATIS, intention.','Første oppkall til Tower: stasjon, kallesignal, type, posisjon, høyde, ATIS, hensikt.'),
   els:[stn('Birdbird Tower'),cs(),TYPE,POS('10 miles north','10 miles nord'),alt(2000,{ask:'say altitude'}),info(V.info2,{ask:`confirm information ${W(V.info2)}`}),INTENT('landing','landing',/\b(land|landing|join|joining|full stop|inbound)\b/)],
   model:`Birdbird Tower, ${V.c}, DA42, 10 miles north, 2000 feet, information ${W(V.info2)}, request joining for landing.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, enter control zone via November, not above 1500 feet, QNH ${V.qnh2}, runway 36, report November.`,task:tr('Read back the zone entry clearance.','Les tilbake soneklareringen.'),
   els:[fix('November'),alt(1500),qnh(V.qnh2),rwy(36,{opt:true}),cs(),WILCO],model:`Enter control zone via November, not above 1500 feet, QNH ${V.qnh2}, runway 36, wilco, ${V.a}.`},
  {cat:'call',ph:'arr',sit:tr('A few minutes later you are over November at 1500 ft.','Noen minutter senere er du over November i 1500 ft.'),task:tr('Report over November.','Meld over November.'),
   els:[cs(),fix('November',{ask:'say position'}),alt(1500,{opt:true})],model:`${V.a}, November, 1500 feet.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, join right downwind runway 36, number 2, follow the DA40 on base, report final.`,task:tr('Read back: circuit entry, sequence, traffic.','Les tilbake: inngang til runden, rekkefølge, trafikk.'),
   els:[P('Right downwind','Høyre medvind',/\bright downwind\b/,{say:'join right downwind'}),rwy(36),num(2,['number'],'Number 2','Nummer 2'),P('Traffic in sight / looking out','Trafikk i sikte / ser etter',/\b(in sight|looking|follow|da ?40)\b/,OPT),cs()],
   model:`Join right downwind runway 36, number 2, traffic in sight, wilco, ${V.a}.`},
  {cat:'call',ph:'arr',sit:tr('You follow the DA40 and turn final.','Du følger DA40-en og svinger inn på finale.'),task:tr('Report final.','Meld finale.'),els:[cs(),P('Final','Finale',/\bfinal\b/,{ask:'say position'}),rwy(36,{opt:true})],model:`${V.a}, final runway 36.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared to land.`,task:tr('Read back the landing clearance.','Les tilbake landingsklareringen.'),els:[rwy(36),CLD,cs()],model:`Runway 36, cleared to land, ${V.a}.`},
  {rb:1,cat:'rb',ph:'arr',sit:tr('You have landed and are slowing down.','Du har landet og bremser ned.'),atc:`${V.a}, take first left, A3, and contact Ground 121.700.`,task:tr('Read back.','Les tilbake.'),
   els:[fix('A3'),freq('121.700','Ground'),cs(),P('First left','Første til venstre',/\bleft\b/,OPT)],model:`First left A3, Ground 121.700, ${V.a}.`}]; },
/* --- taxi in --- */
taxiin:V=>{ const u=UNIT(V); return [
  {unit:u.gnd,ph:'arr',cat:'call',sit:tr('Runway vacated at A3.','Banen er forlatt ved A3.'),task:tr('Call Ground and ask to taxi to the apron.','Kall Ground og be om taksing til apron.'),
   els:[stn('Birdbird Ground'),cs({full:1}),P('Position: vacated via A3','Posisjon: forlatt ved A3',/\b(vacated|a ?3|clear)\b/,{ask:'say position'}),P('Request taxi to the apron','Be om taksing til apron',/\btaxi\b/,{ask:'say intentions'})],
   model:`Birdbird Ground, ${V.c}, runway vacated via A3, request taxi to the apron.`,
   why:tr('A new unit is a new contact: use your full callsign until Ground abbreviates it (SERA.14055(b)(1)).','En ny enhet er en ny kontakt: bruk fullt kallesignal til Ground forkorter det (SERA.14055(b)(1)).')},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, taxi to the apron via Alpha.`,task:tr('Read back.','Les tilbake.'),els:[P('Apron','Apron',/\b(apron|stand|parking)\b/,{say:'taxi to the apron'}),P('Via Alpha','Via Alpha',/\b(alpha|a)\b/,OPT),cs()],model:`Taxi to the apron via Alpha, ${V.a}.`}]; },
/* --- circuits --- */
vcirc:V=>{ const u=UNIT(V); return [
  {unit:u.twr,abbr:1,ph:'arr',cat:'call',sit:tr('You are flying circuits on runway 36 and are on the downwind leg. Next one is a touch and go.','Du flyr landingsrunder på bane 36 og er på medvind. Neste er en touch and go.'),
   task:tr('Report downwind with your intention.','Meld medvind med hensikten din.'),els:[cs(),P('Downwind','Medvind',/\bdownwind\b/,{ask:'say position'}),P('Touch and go','Touch and go',/\btouch (and )?go\b/,{ask:'say intentions'}),rwy(36,{opt:true})],
   model:`${V.a}, downwind runway 36, touch and go.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, number 2, follow the DA40 on base.`,task:tr('Read back sequence and traffic.','Les tilbake rekkefølge og trafikk.'),
   els:[num(2,['number'],'Number 2','Nummer 2'),P('Traffic in sight / looking out','Trafikk i sikte / ser etter',/\b(in sight|looking|follow|traffic|da ?40)\b/,{say:'follow the DA40 on base'}),cs()],model:`Number 2, traffic in sight, ${V.a}.`},
  {cat:'call',ph:'arr',task:tr('Report final.','Meld finale.'),els:[cs(),P('Final','Finale',/\bfinal\b/,{ask:'say position'})],model:`${V.a}, final runway 36.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared touch and go.`,task:tr('Read back.','Les tilbake.'),
   els:[rwy(36),P('“Cleared touch and go”','«Cleared touch and go»',/\bcleared (for )?(a )?touch (and )?go\b/,{say:'cleared touch and go'}),cs()],model:`Runway 36, cleared touch and go, ${V.a}.`},
  {rb:1,cat:'rb',ph:'arr',sit:tr('Next circuit, short final. A vehicle has entered the runway.','Neste runde, kort finale. Et kjøretøy har kjørt inn på banen.'),atc:`${V.a}, go around, I say again, go around, vehicle on the runway.`,
   task:tr('Acknowledge the go-around.','Bekreft go-around.'),els:[P('“Going around”','«Going around»',/\bgoing around\b/,{say:'go around'}),cs()],model:`Going around, ${V.a}.`,
   why:tr('A go-around instruction is acknowledged with “going around” and your callsign. Fly first: power, attitude, climb.','En go-around-instruks bekreftes med «going around» og kallesignalet. Fly først: kraft, holdning, stig.')},
  {cat:'call',ph:'arr',sit:tr('Back on downwind. This one is a full stop.','Tilbake på medvind. Denne gangen full stop.'),task:tr('Report downwind, full stop.','Meld medvind, full stop.'),
   els:[cs(),P('Downwind','Medvind',/\bdownwind\b/,{ask:'say position'}),P('Full stop','Full stop',/\b(full stop|landing|to land)\b/,{ask:'say intentions'})],model:`${V.a}, downwind runway 36, full stop.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared to land.`,task:tr('Read back the landing clearance.','Les tilbake landingsklareringen.'),els:[rwy(36),CLD,cs()],model:`Runway 36, cleared to land, ${V.a}.`}]; },
/* --- radio check --- */
vcheck:V=>{ const u=UNIT(V); return [
  {unit:u.gnd,ph:'ground',cat:'call',sit:tr('You have just switched on the radio at the apron and want to check it.','Du har nettopp slått på radioen på apron og vil sjekke den.'),
   task:tr('Ask Ground for a radio check, with the frequency.','Be Ground om en radiosjekk, med frekvensen.'),els:[stn('Birdbird Ground'),cs(),P('“Radio check”','«Radio check»',/\bradio check\b/,{ask:'say request'}),freq('121.700',null,{ask:'say frequency'})],
   model:`Birdbird Ground, ${V.c}, radio check 121.700.`,reply:`${V.c}, Birdbird Ground, readability 5.`,
   why:tr('A radio check is: station called, your callsign, “radio check”, the frequency (SERA.14070(a)). Readability scale: 1 unreadable, 2 readable now and then, 3 readable but with difficulty, 4 readable, 5 perfectly readable (SERA.14070(c)).','En radiosjekk er: stasjonen du kaller, kallesignalet ditt, «radio check», frekvensen (SERA.14070(a)). Lesbarhetsskala: 1 uleselig, 2 leselig nå og da, 3 leselig men med vanskelighet, 4 leselig, 5 helt leselig (SERA.14070(c)).')},
  {rb:1,cat:'rb',ph:'ground',atc:`${V.c}, Birdbird Ground, radio check, how do you read?`,task:tr('Answer: you read them perfectly (readability 5).','Svar: du hører dem perfekt (readability 5).'),
   els:[P('Readability 5','Readability 5',/\b(readability 5|read(ing)? (you )?(5|loud and clear)|5 by 5|loud and clear)\b/,{say:'how do you read'}),cs()],model:`${V.c}, readability 5.`}]; },

/* =================== IFR =================== */
iclr:V=>{ const u=UNIT(V); return [
  {unit:u.del,ph:'ground',cat:'call',sit:tr(`IFR training flight from Birdbird and back to Birdbird, filed via OSVIK and TUSKA. ATIS is information ${W(V.info)}. Have a pen ready for CRAFT: Clearance limit, Route, Altitude, Frequency, Transponder.`,`IFR-treningstur fra Birdbird og tilbake til Birdbird, innsendt via OSVIK og TUSKA. ATIS er information ${W(V.info)}. Ha penn klar for CRAFT: Clearance limit, Route, Altitude, Frequency, Transponder.`),
   task:tr('Ask Delivery for your IFR clearance.','Be Delivery om IFR-klareringen.'),els:[stn('Birdbird Delivery'),cs(),info(V.info,{ask:`confirm information ${W(V.info)}`}),P('Request clearance','Be om klarering',/\bclearance\b/,{ask:'say request'}),P('IFR / destination','IFR / mål',/\b(ifr|birdbird)\b/,OPT)],
   model:`Birdbird Delivery, ${V.c}, DA42 at the apron, information ${W(V.info)}, IFR to Birdbird, request clearance.`},
  {rb:1,cat:'rb',ph:'ground',atc:`${V.c}, cleared to Birdbird via OSVIK 1N departure, flight planned route, climb to altitude 3000 feet, after departure contact Birdbird Approach ${V.app}, squawk ${V.sq}.`,
   task:tr('Read back the full clearance (CRAFT).','Les tilbake hele klareringen (CRAFT).'),
   els:[P('C: cleared to Birdbird','C: cleared to Birdbird',/\bcleared (to )?birdbird|\bbirdbird\b/,{say:'cleared to Birdbird'}),fix('OSVIK 1N'),alt(3000),freq(V.app,'Approach'),sq(V.sq),cs(),P('Flight planned route','Flight planned route',/\b(flight ?plan(ned)?|route)\b/,OPT)],
   model:`Cleared to Birdbird via OSVIK 1N departure, flight planned route, climb to altitude 3000 feet, after departure ${V.app}, squawk ${V.sq}, ${V.c}.`,
   why:tr('Read back route clearances in full: clearance limit, route (SID), altitude, departure frequency and squawk. Altitude 3000 ft is below the transition altitude: say “altitude”, not “flight level”.','Ruteklareringer leses tilbake i sin helhet: klareringsgrense, rute (SID), høyde, utflygingsfrekvens og squawk. 3000 ft er under overgangshøyden: si «altitude», ikke «flight level».')},
  {rb:1,cat:'rb',ph:'ground',atc:`${V.c}, that is correct, contact Ground 121.700 for start-up.`,task:tr('Read back the frequency.','Les tilbake frekvensen.'),els:[freq('121.700','Ground'),cs()],model:`Ground 121.700, ${V.c}.`}]; },
istart:V=>{ const u=UNIT(V); return [
  {unit:u.gnd,ph:'ground',cat:'call',task:tr('Ask Ground for start-up, with your position and the ATIS letter.','Be Ground om oppstart, med posisjon og ATIS-bokstav.'),
   els:[stn('Birdbird Ground'),cs(),POS('at the apron','på apron',/\b(apron|stand|parking)\b/),info(V.info,{ask:`confirm information ${W(V.info)}`}),P('Request start-up','Be om oppstart',/\b(start ?up|start)\b/,{ask:'say request'})],
   model:`Birdbird Ground, ${V.c}, at the apron, information ${W(V.info)}, request start-up.`},
  {rb:1,cat:'rb',ph:'ground',atc:`${V.a}, start-up approved, QNH ${V.qnh}.`,task:tr('Read back.','Les tilbake.'),els:[P('Start-up approved','Start-up approved',/\bstart ?up( approved)?|\bstarting\b/,{say:'start-up approved'}),qnh(V.qnh),cs()],model:`Start-up approved, QNH ${V.qnh}, ${V.a}.`}]; },
itaxi:V=>{ const u=UNIT(V); return [
  {unit:u.gnd,abbr:1,ph:'ground',cat:'call',sit:tr('Both engines running, after-start checks done.','Begge motorene går, etter-start-sjekkene er gjort.'),task:tr('Request taxi.','Be om taksing.'),
   els:[stn('Birdbird Ground',OPT),cs(),P('Request taxi','Be om taksing',/\btaxi\b/,{ask:'say request'})],model:`${V.a}, request taxi.`},
  {rb:1,cat:'rb',ph:'ground',atc:`${V.a}, taxi to holding point A1 runway 36 via Bravo and Alpha, hold short of runway 07.`,
   task:tr('Read back: holding point, runway, route and the hold short.','Les tilbake: holdepunkt, bane, rute og hold short.'),
   els:[hp('A1'),rwy(36),hs('07'),cs(),P('Via Bravo and Alpha','Via Bravo og Alpha',/\b(b|bravo)\b.*\b(a|alpha)\b/,OPT)],
   model:`Holding point A1 runway 36 via Bravo and Alpha, holding short of runway 07, ${V.a}.`,
   why:tr('Birdbird has a short crossing runway 07/25 on the taxi route. An instruction to hold short of a runway must be read back with the runway.','Birdbird har en kort kryssende bane 07/25 på taksiruten. En instruks om å holde kort av en bane må leses tilbake med banenummeret.')},
  {rb:1,cat:'rb',ph:'ground',sit:tr('You stop at Bravo, short of runway 07.','Du stopper ved Bravo, kort av bane 07.'),atc:`${V.a}, cross runway 07 at Bravo, report vacated.`,
   task:tr('Read back the crossing clearance.','Les tilbake kryssingsklareringen.'),els:[P('“Cross runway 07”','«Cross runway 07»',/\bcross(ing)?\b/,{say:'cross runway 07'}),rwy('07'),cs(),WILCO],model:`Cross runway 07 at Bravo, wilco, ${V.a}.`},
  {cat:'call',ph:'ground',sit:tr('You have crossed runway 07.','Du har krysset bane 07.'),task:tr('Report runway vacated.','Meld at banen er forlatt.'),els:[cs(),P('Runway 07 vacated','Bane 07 forlatt',/\b(vacated|clear of|crossed)\b/,{ask:'report vacated'}),rwy('07',{opt:true})],
   model:`${V.a}, runway 07 vacated.`,reply:`${V.a}, continue to holding point A1, contact Tower 118.300.`},
  {rb:1,cat:'rb',ph:'ground',task:tr('Read back.','Les tilbake.'),els:[hp('A1',{opt:true}),freq('118.300','Tower'),cs()],model:`Tower 118.300, ${V.a}.`,ctxAtc:1}]; },
ito:V=>{ const u=UNIT(V); return [
  {unit:u.twr,ph:'dep',cat:'call',sit:tr('Run-up and departure briefing done at A1.','Run-up og avgangsbriefing ferdig ved A1.'),task:tr('Tell Tower you are ready.','Si fra til Tower at du er klar.'),els:[stn('Birdbird Tower'),cs(),hp('A1',{opt:true}),READY],model:`Birdbird Tower, ${V.c}, holding point A1, ready for departure.`},
  {rb:1,cat:'rb',ph:'dep',atc:`${V.a}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared for take-off.`,task:tr('Read back the take-off clearance.','Les tilbake avgangsklareringen.'),els:[rwy(36),CTO,cs()],model:`Runway 36, cleared for take-off, ${V.a}.`},
  fc(V,'Birdbird Approach',V.app,{ph:'dep',sit:tr('Airborne, passing 800 ft on the OSVIK 1N departure.','I luften, passerer 800 ft på OSVIK 1N.'),atc:`${V.a}, contact Approach ${V.app}.`,els:[freq(V.app,'Approach'),cs()],model:`Approach ${V.app}, ${V.a}.`})]; },
iclimb:V=>{ const u=UNIT(V); return [
  {unit:u.app,ph:'dep',cat:'call',sit:tr('Passing 1500 ft, climbing to 3000 ft on the OSVIK 1N departure.','Passerer 1500 ft, stiger til 3000 ft på OSVIK 1N.'),
   task:tr('Check in with Approach: station, callsign, passing level, cleared level, SID.','Sjekk inn med Approach: stasjon, kallesignal, passerer, klarert høyde, SID.'),
   els:[stn('Birdbird Approach'),cs(),P('Passing level (1500 ft)','Høyden du passerer (1500 ft)',/\bpassing\b/,{ask:'say passing level'}),alt(3000,{ask:'say cleared altitude'}),fix('OSVIK 1N',{opt:true})],
   model:`Birdbird Approach, ${V.c}, passing 1500 feet, climbing to 3000 feet, OSVIK 1N departure.`,
   why:tr('After a frequency change the initial call gives the level, with the passing and the cleared level when you are not level (SERA.14065(a)).','Etter frekvensskifte gir første oppkall nivået, med høyden du passerer og klarert høyde når du ikke er planet ut (SERA.14065(a)).')},
  {rb:1,cat:'rb',ph:'dep',atc:`${V.c}, Birdbird Approach, identified, climb to flight level ${V.fl}.`,task:tr('Read back. Above the transition altitude, set 1013 when passing the transition altitude.','Les tilbake. Over overgangshøyden: still 1013 når du passerer overgangshøyden.'),
   els:[P('Climb','Climb',/\bclimb(ing)?\b/,OPT),fl(V.fl),cs()],model:`Climb to flight level ${V.fl}, ${V.c}.`},
  {rb:1,cat:'rb',ph:'dep',atc:`${V.a}, turn left heading ${V.hdgL}, vectors for traffic.`,task:tr('Read back the heading.','Les tilbake kursen.'),els:[turn('left'),hdg(V.hdgL),cs()],model:`Left heading ${V.hdgL}, ${V.a}.`},
  {rb:1,cat:'rb',ph:'dep',atc:`${V.a}, resume own navigation direct TUSKA.`,task:tr('Read back.','Les tilbake.'),els:[P('Direct','Direkte',/\b(direct|resume|resuming)\b/,{say:'resume own navigation direct'}),fix('TUSKA'),cs()],model:`Resume own navigation direct TUSKA, ${V.a}.`},
  fc(V,'Vestfjell Control','128.905',{ph:'dep',els:[freq('128.905','Vestfjell Control'),cs()],model:`Vestfjell Control 128.905, ${V.a}.`})]; },
ienr:V=>{ const u=UNIT(V); return [
  {unit:u.ctl,ph:'enroute',cat:'call',sit:tr(`Level at flight level ${V.fl}, direct TUSKA.`,`I flygenivå ${V.fl}, direkte TUSKA.`),task:tr('Check in with Vestfjell Control.','Sjekk inn med Vestfjell Control.'),
   els:[stn('Vestfjell Control'),cs(),fl(V.fl,{ask:'say level'})],model:`Vestfjell Control, ${V.c}, flight level ${V.fl}.`},
  {rb:1,cat:'rb',ph:'enroute',atc:`${V.c}, Vestfjell Control, identified, reduce speed to ${V.spd} knots.`,task:tr('Read back the speed.','Les tilbake farten.'),els:[spd(V.spd),cs()],model:`Speed ${V.spd} knots, ${V.c}.`},
  {rb:1,cat:'rb',ph:'enroute',atc:`${V.a}, descend to altitude 5000 feet, QNH ${V.qnh2}, cleared TUSKA 1A arrival.`,
   task:tr('Read back. You are cleared below the transition level: altitude on QNH.','Les tilbake. Du er klarert under overgangsnivået: høyde på QNH.'),
   els:[P('Descend','Descend',/\bdescend(ing)?\b/,OPT),alt(5000),qnh(V.qnh2),fix('TUSKA 1A'),cs()],model:`Descend to altitude 5000 feet, QNH ${V.qnh2}, cleared TUSKA 1A arrival, ${V.a}.`,
   why:tr('When cleared to an altitude below the transition level, the QNH comes with it. Read back both, and say “altitude”.','Når du klareres til en høyde under overgangsnivået, følger QNH med. Les tilbake begge, og si «altitude».')},
  fc(V,'Birdbird Approach',V.app,{ph:'enroute',els:[freq(V.app,'Birdbird Approach'),cs()],model:`Birdbird Approach ${V.app}, ${V.a}.`})]; },
ihold:V=>{ const u=UNIT(V); return [
  {unit:u.app,ph:'arr',cat:'call',sit:tr(`Passing 6000 ft, descending to 5000 ft on the TUSKA 1A arrival. Vestfjell Control gave you speed ${V.spd} knots. You have the arrival ATIS, information ${W(V.info2)}.`,`Passerer 6000 ft, synker til 5000 ft på TUSKA 1A. Vestfjell Control ga deg fart ${V.spd} knop. Du har ankomst-ATIS, information ${W(V.info2)}.`),
   task:tr('Check in with Approach: station, callsign, passing and cleared level, assigned speed, arrival, ATIS.','Sjekk inn med Approach: stasjon, kallesignal, høyden du passerer og klarert høyde, tildelt fart, ankomstrute, ATIS.'),
   els:[stn('Birdbird Approach'),cs(),P('Passing level (6000 ft)','Høyden du passerer (6000 ft)',/\bpassing\b/,{ask:'say passing level'}),alt(5000,{ask:'say cleared altitude'}),spd(V.spd,{ask:'say speed'}),fix('TUSKA 1A',{opt:true}),info(V.info2,{ask:`confirm information ${W(V.info2)}`})],
   model:`Birdbird Approach, ${V.c}, passing 6000 feet, descending to 5000 feet, speed ${V.spd} knots, TUSKA 1A arrival, information ${W(V.info2)}.`,
   why:tr('Initial call after a frequency change: level with passing and cleared level, and the speed if ATC assigned one (SERA.14065(a)).','Første oppkall etter frekvensskifte: nivå med høyden du passerer og klarert høyde, og farten hvis ATC har tildelt en (SERA.14065(a)).')},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.c}, Birdbird Approach, proceed to RONAX, descend to altitude 3000 feet, hold inbound track 360 degrees, right-hand pattern, expect approach clearance at ${V.eat}.`,
   task:tr('Read back the holding instruction.','Les tilbake ventemønsterinstruksen.'),
   els:[fix('RONAX'),trk('360'),P('Right-hand pattern','Høyre ventemønster (right-hand pattern)',/\bright( hand)?( pattern| turns?)?\b/,{say:'right-hand pattern'}),alt(3000),num(V.eat,['expect','at','approach','time'],'Expect approach clearance at '+V.eat,'Forvent innflygingsklarering '+V.eat),cs()],
   model:`Proceed to RONAX, descend to altitude 3000 feet, hold inbound track 360, right-hand pattern, expect approach clearance at ${V.eat}, ${V.c}.`,
   why:tr('A hold is read back in full: fix, inbound track, direction of turns, level, and the expected approach time (you need it if the radio fails).','Et ventemønster leses tilbake i sin helhet: punkt, innkommende kurs, svingretning, nivå og forventet innflygingstid (du trenger den hvis radioen svikter).')}]; },
ivec:V=>{ const u=UNIT(V); const A=V.appT; return [
  {rb:1,unit:u.app,ph:'arr',cat:'rb',sit:tr('After one turn in the hold, Approach starts to vector you.','Etter én runde i ventemønsteret begynner Approach å vektorere deg.'),atc:`${V.a}, leave RONAX heading ${V.hdgL}, descend to altitude 2500 feet.`,
   task:tr('Read back.','Les tilbake.'),els:[fix('RONAX',{opt:true}),hdg(V.hdgL),alt(2500),cs()],model:`Leave RONAX heading ${V.hdgL}, descend to altitude 2500 feet, ${V.a}.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, reduce speed to ${V.spd} knots.`,task:tr('Read back.','Les tilbake.'),els:[spd(V.spd),cs()],model:`Speed ${V.spd} knots, ${V.a}.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, turn right heading ${V.hdgR}, cleared ${A} approach runway 36, report established.`,task:tr('Read back the approach clearance.','Les tilbake innflygingsklareringen.'),
   els:[turn('right'),hdg(V.hdgR),P(`“Cleared ${A} approach”`,`«Cleared ${A} approach»`,A==='ILS'?/\bcleared (for )?(the )?(ils|i l s)\b/:/\bcleared (for )?(the )?(rnp|r n p|rnav)\b/,{say:`cleared ${A} approach`}),rwy(36),cs(),WILCO],
   model:`Right heading ${V.hdgR}, cleared ${A} approach runway 36, wilco, ${V.a}.`},
  {cat:'call',ph:'arr',sit:tr(A==='ILS'?'The localizer is alive and centred.':'You are on the final approach track.',A==='ILS'?'Localizeren er levende og sentrert.':'Du er på finale innflygingskurs.'),task:tr('Report established.','Meld etablert.'),
   els:[cs(),P('Established','Etablert',/\bestablished\b/,{ask:'report established'}),rwy(36,{opt:true})],model:`${V.a}, established ${A==='ILS'?'localizer':'final approach track'} runway 36.`,reply:`${V.a}, contact Tower 118.300.`},
  {rb:1,cat:'rb',ph:'arr',task:tr('Read back.','Les tilbake.'),els:[freq('118.300','Tower'),cs()],model:`Tower 118.300, ${V.a}.`,ctxAtc:1}]; },
iland:V=>{ const u=UNIT(V); const A=V.appT; return [
  {unit:u.twr,ph:'arr',cat:'call',sit:tr(`On the ${A} approach, 6 miles from touchdown.`,`På ${A}-innflygingen, 6 miles fra touchdown.`),task:tr('Call Tower.','Kall Tower.'),
   els:[stn('Birdbird Tower'),cs({full:1}),P(`${A} runway 36 / 6 miles`,`${A} bane 36 / 6 miles`,/\b(ils|rnp|established|final|miles|6)\b/,{ask:'say position'})],model:`Birdbird Tower, ${V.c}, ${A} runway 36, 6 miles.`,
   why:tr('Establishing contact with a new unit: full callsign (SERA.14055(b)(1)). Tower may abbreviate it in the reply.','Når du etablerer kontakt med en ny enhet: fullt kallesignal (SERA.14055(b)(1)). Tower kan forkorte det i svaret.')},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared to land.`,task:tr('Read back the landing clearance.','Les tilbake landingsklareringen.'),els:[rwy(36),CLD,cs()],model:`Runway 36, cleared to land, ${V.a}.`},
  {rb:1,cat:'rb',ph:'arr',sit:tr('You have landed.','Du har landet.'),atc:`${V.a}, take first left, A3, and contact Ground 121.700.`,task:tr('Read back.','Les tilbake.'),els:[fix('A3'),freq('121.700','Ground'),cs()],model:`First left A3, Ground 121.700, ${V.a}.`}]; },
iga:V=>{ const u=UNIT(V); return [
  {rb:1,unit:u.twr,ph:'arr',cat:'rb',sit:tr('ILS runway 36, 2 miles from touchdown. A vehicle enters the runway.','ILS bane 36, 2 miles fra touchdown. Et kjøretøy kjører inn på banen.'),atc:`${V.a}, go around, I say again, go around, vehicle on the runway.`,
   task:tr('Acknowledge the go-around.','Bekreft go-around.'),els:[P('“Going around”','«Going around»',/\bgoing around\b/,{say:'go around'}),cs()],model:`Going around, ${V.a}.`},
  {rb:1,cat:'rb',ph:'arr',atc:`${V.a}, follow the published missed approach, climb to altitude 3000 feet, contact Approach ${V.app}.`,task:tr('Read back.','Les tilbake.'),
   els:[P('Published missed approach','Publisert avbrutt innflyging',/\b(missed approach|published|missed)\b/,{say:'follow the published missed approach'}),alt(3000),freq(V.app,'Approach'),cs()],model:`Published missed approach, altitude 3000 feet, Approach ${V.app}, ${V.a}.`},
  {cat:'call',abbr:1,unit:u.app,ph:'arr',sit:tr('Second approach. At the decision altitude you do not see the runway.','Andre innflyging. Ved beslutningshøyden ser du ikke banen.'),task:tr('Tell ATC you are going around.','Si til ATC at du går rundt.'),
   els:[cs(),P('“Going around”','«Going around»',/\bgoing around\b/,{ask:'say intentions'})],model:`${V.a}, going around.`,reply:`${V.a}, roger, follow the published missed approach, climb to altitude 3000 feet, report your intentions.`},
  {rb:1,cat:'rb',ph:'arr',task:tr('Read back and give your intention: another approach.','Les tilbake og gi hensikten din: en ny innflyging.'),
   els:[P('Missed approach','Avbrutt innflyging',/\b(missed approach|published|missed)\b/,OPT),alt(3000),P('Intention: another approach','Hensikt: ny innflyging',/\b(another|again|second|approach|request)\b/),cs()],model:`Published missed approach, altitude 3000 feet, request another ILS approach, ${V.a}.`,ctxAtc:1}]; },

/* =================== Emergencies =================== */
emay:V=>{ const u=UNIT(V); return [
  {unit:u.app,ph:'emerg',cat:'emerg',sit:tr(`Your right engine has failed. You are 15 miles south of Birdbird at 3000 ft, heading 360, ${V.pob} on board, and you want to land at Birdbird.`,`Høyre motor har stoppet. Du er 15 miles sør for Birdbird i 3000 ft, kurs 360, ${V.pob} om bord, og vil lande på Birdbird.`),
   task:tr('Transmit a MAYDAY: MAYDAY ×3, station, callsign, type, nature, intention, position, level, heading, persons on board.','Send MAYDAY: MAYDAY ×3, stasjon, kallesignal, type, art, hensikt, posisjon, nivå, kurs, personer om bord.'),
   els:[{k:'count',re:/\bmayday\b/g,n:3,min:1,l:tr('MAYDAY (preferably three times)','MAYDAY (helst tre ganger)'),whyMin:tr('Allowed, but MAYDAY is preferably spoken three times (SERA.14095(b)(1)).','Tillatt, men MAYDAY sies helst tre ganger (SERA.14095(b)(1)).')},stn('Birdbird Approach',OPT),cs(),TYPE,P('Nature: engine failure','Art: motorstans',/\bengine\b/,{ask:'say nature of emergency'}),INTENT('land at Birdbird','lande på Birdbird',/\b(intend|request|land|return|divert|birdbird)\b/),POS('15 miles south','15 miles sør'),alt(3000),hdg('360'),num(V.pob,['persons','person','pob','souls','board'],'Persons on board: '+V.pob,'Personer om bord: '+V.pob,OPT)],
   model:`MAYDAY MAYDAY MAYDAY, Birdbird Approach, ${V.c}, DA42, right engine failure, intend to land at Birdbird, 15 miles south, 3000 feet, heading 360, ${V.pob} persons on board.`,
   why:tr('Distress message (SERA.14095(b)(1)): MAYDAY, preferably three times, then as many as possible of, in this order: station, callsign, nature of the distress, intention, present position, level and heading. Persons on board and endurance are useful extras. Fly the aircraft first.','Nødmelding (SERA.14095(b)(1)): MAYDAY, helst tre ganger, så så mange som mulig av, i denne rekkefølgen: stasjon, kallesignal, nødens art, hensikt, nåværende posisjon, nivå og kurs. Personer om bord og utholdenhet er nyttige tillegg. Fly flyet først.')},
  {rb:1,cat:'rb',ph:'emerg',atc:`${V.c}, roger MAYDAY, turn right heading ${V.hdgM}, runway 36 available, squawk 7700, report field in sight.`,task:tr('Read back.','Les tilbake.'),
   els:[turn('right'),hdg(V.hdgM),sq('7700'),rwy(36,{opt:true}),cs(),WILCO],model:`Right heading ${V.hdgM}, squawk 7700, wilco, ${V.c}.`},
  {cat:'call',ph:'emerg',sit:tr('You see the runway ahead.','Du ser banen foran deg.'),task:tr('Report the field in sight.','Meld plassen i sikte.'),els:[cs(),P('Field in sight','Plassen i sikte',/\b(field|runway|airfield|aerodrome) (is )?in sight\b|\bin sight\b/,{ask:'report field in sight'})],
   model:`${V.c}, field in sight.`,reply:`${V.c}, wind ${V.wd} degrees ${V.ws} knots, runway 36, cleared to land, emergency services are standing by.`},
  {rb:1,cat:'rb',ph:'emerg',task:tr('Read back the landing clearance.','Les tilbake landingsklareringen.'),els:[rwy(36),CLD,cs()],model:`Runway 36, cleared to land, ${V.c}.`,ctxAtc:1}]; },
epan:V=>{ const u=UNIT(V); return [
  {unit:u.app,ph:'emerg',cat:'emerg',sit:tr('The left engine runs rough and the oil pressure is low but steady. No immediate danger. You are 12 miles west of Birdbird at 4000 ft, heading 090, and want to land at Birdbird.','Venstre motor går ujevnt og oljetrykket er lavt men stabilt. Ingen umiddelbar fare. Du er 12 miles vest for Birdbird i 4000 ft, kurs 090, og vil lande på Birdbird.'),
   task:tr('Transmit an urgency call: PAN PAN ×3, station, callsign, type, problem, intention, position, level, heading.','Send en ilmelding: PAN PAN ×3, stasjon, kallesignal, type, problem, hensikt, posisjon, nivå, kurs.'),
   els:[{k:'count',re:/\bpan\b/g,n:6,min:2,l:tr('PAN PAN (preferably three times)','PAN PAN (helst tre ganger)'),whyMin:tr('Allowed, but PAN PAN is preferably spoken three times (SERA.14095(c)(1)).','Tillatt, men PAN PAN sies helst tre ganger (SERA.14095(c)(1)).')},stn('Birdbird Approach',OPT),cs(),TYPE,P('Nature: rough running / oil pressure','Art: ujevn gange / oljetrykk',/\b(rough|engine|oil)\b/,{ask:'say nature of the problem'}),INTENT('land at Birdbird','lande på Birdbird',/\b(intend|request|land|return|birdbird|priority)\b/),POS('12 miles west','12 miles vest'),alt(4000),hdg('090')],
   model:`PAN PAN, PAN PAN, PAN PAN, Birdbird Approach, ${V.c}, DA42, left engine rough running, low oil pressure, request priority landing at Birdbird, 12 miles west, 4000 feet, heading 090.`,
   why:tr('Urgency (PAN PAN, preferably three times) is for a condition that concerns safety but needs no immediate assistance. Same order as MAYDAY, plus any other useful information (SERA.14095(c)(1)). If it gets worse, upgrade to MAYDAY.','Il (PAN PAN, helst tre ganger) er for en situasjon som angår sikkerheten men ikke krever umiddelbar hjelp. Samme rekkefølge som MAYDAY, pluss annen nyttig informasjon (SERA.14095(c)(1)). Blir det verre: oppgrader til MAYDAY.')},
  {rb:1,cat:'rb',ph:'emerg',atc:`${V.c}, roger PAN, descend to altitude 2500 feet, QNH ${V.qnh}, turn right heading ${V.hdgR}, vectors ILS runway 36, you are number 1.`,task:tr('Read back.','Les tilbake.'),
   els:[alt(2500),qnh(V.qnh),turn('right'),hdg(V.hdgR),P('ILS runway 36 / number 1','ILS bane 36 / nummer 1',/\b(ils|number 1|vectors)\b/,OPT),cs()],model:`Descend to altitude 2500 feet, QNH ${V.qnh}, right heading ${V.hdgR}, ${V.c}.`}]; },
emed:V=>{ const u=UNIT(V); return [
  {unit:u.fis,ph:'emerg',cat:'emerg',sit:tr(`A passenger has become seriously ill. You are 8 miles south of Skarvik at 3500 ft, heading 360, ${V.pob+1} on board. You want to divert to Skarvik.`,`En passasjer har blitt alvorlig syk. Du er 8 miles sør for Skarvik i 3500 ft, kurs 360, ${V.pob+1} om bord. Du vil gå til Skarvik.`),
   task:tr('Urgency call for a medical case, with your intention to divert to Skarvik.','Ilmelding for et medisinsk tilfelle, med hensikt om å gå til Skarvik.'),
   els:[{k:'count',re:/\bpan\b/g,n:6,min:2,l:tr('PAN PAN (preferably three times)','PAN PAN (helst tre ganger)'),whyMin:tr('Allowed, but PAN PAN is preferably spoken three times (SERA.14095(c)(1)).','Tillatt, men PAN PAN sies helst tre ganger (SERA.14095(c)(1)).')},stn('Vestfjell Information',OPT),cs(),P('Nature: sick passenger (medical)','Art: syk passasjer (medisinsk)',/\b(medical|ill|sick|passenger)\b/,{ask:'say nature of the problem'}),INTENT('divert to Skarvik','gå til Skarvik',/\b(divert|diversion|skarvik|land)\b/),POS('8 miles south of Skarvik','8 miles sør for Skarvik'),alt(3500),hdg('360',OPT),P('Request ambulance','Be om ambulanse',/\b(ambulance|medical assistance|doctor)\b/,OPT)],
   model:`PAN PAN, PAN PAN, PAN PAN, Vestfjell Information, ${V.c}, DA42, seriously ill passenger, diverting to Skarvik, 8 miles south of Skarvik, 3500 feet, heading 360, request ambulance on arrival.`},
  {rb:1,cat:'rb',ph:'emerg',atc:`${V.c}, roger PAN, Skarvik is informed and an ambulance is requested. QNH ${V.qnh}, contact Skarvik Information 123.455.`,task:tr('Read back.','Les tilbake.'),
   els:[qnh(V.qnh),freq('123.455','Skarvik Information'),cs()],model:`QNH ${V.qnh}, Skarvik Information 123.455, ${V.c}.`}]; },
efuel:V=>{ const u=UNIT(V); return [
  {unit:u.app,abbr:1,ph:'emerg',cat:'emerg',sit:tr('You are holding at RONAX. With more delay you would land with very little fuel above your final reserve.','Du venter ved RONAX. Med mer forsinkelse ville du lande med svært lite drivstoff over den endelige reserven.'),
   task:tr('Tell ATC you are at minimum fuel: no more delay can be accepted.','Si til ATC at du er på minimum fuel: du kan ikke akseptere mer forsinkelse.'),
   els:[cs(),P('“Minimum fuel”','«Minimum fuel»',/\bminimum fuel\b/),num(V.endur,['endurance','minutes','fuel'],'Endurance '+V.endur+' minutes','Utholdenhet '+V.endur+' minutter',OPT)],
   model:`${V.a}, minimum fuel, endurance ${V.endur} minutes.`,reply:`${V.a}, roger, expect 5 minutes delay.`,
   why:tr('“MINIMUM FUEL” tells ATC that you are committed to one aerodrome and any change to your clearance may make you land with less than final reserve fuel. It is not an emergency; ATC answers with the expected delay (GM1 SERA.11012, SERA.11012(a)). If you will land below final reserve, declare “MAYDAY MAYDAY MAYDAY FUEL” (SERA.11012(b)).','«MINIMUM FUEL» forteller ATC at du er låst til én flyplass, og at enhver endring i klareringen kan gjøre at du lander med mindre enn endelig reserve. Det er ikke en nødsituasjon; ATC svarer med forventet forsinkelse (GM1 SERA.11012, SERA.11012(a)). Vil du lande under endelig reserve: erklær «MAYDAY MAYDAY MAYDAY FUEL» (SERA.11012(b)).')},
  {cat:'emerg',ph:'emerg',sit:tr(`After 5 minutes ATC tells you of a further 15 minute delay. You now calculate landing below final reserve. You are at RONAX, 3000 ft, ${V.pob} on board.`,`Etter 5 minutter melder ATC 15 minutter ekstra forsinkelse. Nå regner du med å lande under endelig reserve. Du er ved RONAX, 3000 ft, ${V.pob} om bord.`),
   task:tr('Declare a fuel emergency.','Erklær nødsituasjon for drivstoff.'),
   els:[{k:'count',re:/\bmayday\b/g,n:3,min:1,l:tr('MAYDAY (preferably three times)','MAYDAY (helst tre ganger)'),whyMin:tr('Allowed, but MAYDAY is preferably spoken three times (SERA.14095(b)(1)).','Tillatt, men MAYDAY sies helst tre ganger (SERA.14095(b)(1)).')},P('“Fuel”','«Fuel»',/\bfuel\b/),cs(),fix('RONAX',{ask:'say position'}),alt(3000,OPT),INTENT('immediate approach','umiddelbar innflyging',/\b(immediate|request|approach|land|priority)\b/)],
   model:`MAYDAY MAYDAY MAYDAY FUEL, Birdbird Approach, ${V.c}, RONAX, 3000 feet, request immediate approach, ${V.pob} persons on board.`},
  {rb:1,cat:'rb',ph:'emerg',atc:`${V.c}, roger MAYDAY, turn left heading ${V.hdgL}, descend to altitude 2500 feet, cleared ILS approach runway 36, you are number 1.`,task:tr('Read back.','Les tilbake.'),
   els:[turn('left'),hdg(V.hdgL),alt(2500),P('“Cleared ILS approach”','«Cleared ILS approach»',/\bcleared (for )?(the )?(ils|i l s)\b/,{say:'cleared ILS approach'}),rwy(36),cs()],model:`Left heading ${V.hdgL}, descend to altitude 2500 feet, cleared ILS approach runway 36, ${V.c}.`}]; },
ercf:V=>{ const u=UNIT(V); return [
  {unit:u.twr,ph:'emerg',cat:'emerg',noAtc:1,sit:tr('VFR, 10 miles south of Birdbird at 2000 ft. You hear nothing on any frequency, but the transmitter may still work. You have set squawk 7600.','VFR, 10 miles sør for Birdbird i 2000 ft. Du hører ingenting på noen frekvens, men senderen virker kanskje. Du har satt squawk 7600.'),
   task:tr('Transmit blind: “transmitting blind due to receiver failure”, callsign, position, altitude, intention, then the whole message once more.','Send blindt: «transmitting blind due to receiver failure», kallesignal, posisjon, høyde, hensikt, og så hele meldingen én gang til.'),
   els:[P('“Transmitting blind”','«Transmitting blind»',/\btransmitting blind\b|\bblind\b/),cs(),P('“Due to receiver failure”','«Due to receiver failure»',/\b(receiver|radio) failure\b|\bfailure\b/,OPT),POS('10 miles south','10 miles sør'),alt(2000),INTENT('join and land','komme inn og lande',/\b(join|joining|land|landing|inbound)\b/),P('Message repeated (“I say again …”)','Meldingen gjentatt («I say again …»)',/\bi say again\b/,OPT)],
   model:`Transmitting blind due to receiver failure, ${V.c}, 10 miles south of Birdbird, 2000 feet, joining for landing runway 36. I say again, transmitting blind due to receiver failure, ${V.c}, 10 miles south of Birdbird, 2000 feet, joining for landing runway 36.`,
   why:tr('Radio failure (SERA.14083(c)): squawk 7600, watch for light signals at a controlled aerodrome, and as VFR keep VMC, land at the nearest suitable aerodrome and report your arrival. With a receiver failure, transmit blind: “transmitting blind due to receiver failure”, the message, then a complete repetition, and the time of your next transmission (SERA.14085(b)). IFR follows SERA.14083(c)(4) and (5), or squawks 7601 if it continues in VMC and lands at the nearest suitable aerodrome (SERA.14083(c)(6)).','Radiosvikt (SERA.14083(c)): squawk 7600, se etter lyssignaler på en kontrollert flyplass, og som VFR: hold VMC, land på nærmeste egnede flyplass og meld ankomst. Ved mottakerfeil sender du blindt: «transmitting blind due to receiver failure», meldingen, så en fullstendig gjentakelse, og tiden for neste sending (SERA.14085(b)). IFR følger SERA.14083(c)(4) og (5), eller setter squawk 7601 hvis flyvningen fortsetter i VMC og lander på nærmeste egnede flyplass (SERA.14083(c)(6)).')},
  {cat:'emerg',ph:'emerg',noAtc:1,prompt:tr('You are on final. The tower shows you a steady green light. What does it mean?','Du er på finale. Tårnet viser deg et fast grønt lys. Hva betyr det?'),task:tr('Type (or say) what it means.','Skriv (eller si) hva det betyr.'),
   els:[P('Cleared to land','Klarert for landing',/\b(cleared|clear) (to )?land\b|\bland\b/)],model:'Cleared to land.'},
  {cat:'emerg',ph:'emerg',noAtc:1,prompt:tr('Earlier, on downwind, you saw a series of green flashes. What did that mean?','Tidligere, på medvind, så du grønne blink. Hva betydde det?'),task:tr('Type what it means.','Skriv hva det betyr.'),
   els:[P('Return for landing','Kom tilbake for landing',/\breturn\b/)],model:'Return for landing (clearance to land will be given in due course).'},
  {cat:'emerg',ph:'emerg',noAtc:1,prompt:tr('And a steady red light to an aircraft in flight?','Og et fast rødt lys til et luftfartøy i luften?'),task:tr('Type what it means.','Skriv hva det betyr.'),
   els:[P('Give way and continue circling','Vik for annen trafikk og fortsett å sirkle',/\b(give way|continue circling|circling|circle)\b/)],model:'Give way to other aircraft and continue circling.'}]; },
elost:V=>{ const u=UNIT(V); return [
  {unit:u.fis,ph:'emerg',cat:'emerg',sit:tr('VFR in hilly terrain at 3000 ft. You are uncertain of your position. Your last fix was Skarvik 20 minutes ago. Heading 270, fuel endurance 1 hour 30.','VFR i kupert terreng i 3000 ft. Du er usikker på posisjonen. Siste sikre posisjon var Skarvik for 20 minutter siden. Kurs 270, utholdenhet 1 time 30.'),
   task:tr('Ask Vestfjell Information for help: callsign, the problem, last known position, altitude, heading, request.','Be Vestfjell Information om hjelp: kallesignal, problemet, siste kjente posisjon, høyde, kurs, ønske.'),
   els:[stn('Vestfjell Information'),cs(),P('Uncertain of position','Usikker på posisjon',/\b(uncertain|unsure|not sure|lost)\b/,{ask:'say your problem'}),fix('Skarvik',{opt:true,alt:['scarvik']}),alt(3000,{ask:'say altitude'}),P('Request assistance / position','Be om hjelp / posisjon',/\b(request|assistance|position|help)\b/)],
   model:`Vestfjell Information, ${V.c}, DA42, uncertain of position, last known position Skarvik 20 minutes ago, 3000 feet, heading 270, endurance 1 hour 30, request assistance.`,
   why:tr('Ask for help early, while you still have fuel and daylight. If you are worried, use PAN PAN. Climb if you can, for radar and radio coverage.','Be om hjelp tidlig, mens du fortsatt har drivstoff og dagslys. Er du bekymret, bruk PAN PAN. Stig om du kan, for radar- og radiodekning.')},
  {rb:1,cat:'rb',ph:'emerg',atc:`${V.c}, squawk ${V.sq2} and ident.`,task:tr('Read back.','Les tilbake.'),els:[sq(V.sq2),P('Ident','Ident',/\bident\b/,OPT),cs()],model:`Squawk ${V.sq2}, ident, ${V.c}.`},
  {rb:1,cat:'rb',ph:'emerg',atc:`${V.c}, identified, 9 miles west of Skarvik. Turn right heading ${V.hdgR} for Skarvik, QNH ${V.qnh}.`,task:tr('Read back.','Les tilbake.'),els:[turn('right'),hdg(V.hdgR),qnh(V.qnh),cs()],model:`Right heading ${V.hdgR}, QNH ${V.qnh}, ${V.c}.`}]; },
ediv:V=>{ const u=UNIT(V); return [
  {unit:u.fis,ph:'emerg',cat:'emerg',sit:tr('VFR to Tjernmo. Ahead the cloud base comes down to the hilltops. You decide to divert to Skarvik, 15 miles east. You are at 2500 ft, 10 miles west of Tjernmo.','VFR til Tjernmo. Foran deg kommer skybasen ned på åstoppene. Du bestemmer deg for å gå til Skarvik, 15 miles øst. Du er i 2500 ft, 10 miles vest for Tjernmo.'),
   task:tr('Tell Vestfjell Information you are diverting: reason, new destination, position, altitude.','Si til Vestfjell Information at du endrer mål: årsak, nytt mål, posisjon, høyde.'),
   els:[stn('Vestfjell Information',OPT),cs(),P('Diverting','Endrer mål',/\b(divert|diverting|diversion)\b/,{ask:'say intentions'}),fix('Skarvik',{alt:['scarvik']}),P('Reason: weather','Årsak: vær',/\b(weather|cloud|visibility|wx)\b/,OPT),POS('10 miles west of Tjernmo','10 miles vest for Tjernmo'),alt(2500,{ask:'say altitude'})],
   model:`Vestfjell Information, ${V.c}, diverting to Skarvik due to weather, 10 miles west of Tjernmo, 2500 feet.`},
  {rb:1,cat:'rb',ph:'emerg',atc:`${V.c}, roger, Skarvik weather: visibility 8 kilometres, broken 2000 feet, runway 18, QNH ${V.qnh}. Report Skarvik in sight.`,task:tr('Read back runway and QNH.','Les tilbake bane og QNH.'),
   els:[rwy(18),qnh(V.qnh),cs(),WILCO],model:`Runway 18, QNH ${V.qnh}, wilco, ${V.c}.`}]; }
};

/* ---------------- scenarios ---------------- */
/* What each scenario is checked against (shown as "Based on" in the scenario intro). AMC1 SERA.14001 = the phraseology
   appendix (Appendix 1 to AMC1 SERA.14001, ED Decision 2025/012/R); paragraph numbers are those of that appendix. */
const BASIS={
  vfrfull:['SERA.8015(e)','SERA.8015(ec)','SERA.14055','SERA.14035','AMC1 SERA.14001 1.1.4, 1.1.7, 1.2.1, 1.4.7–1.4.20','ICAO Doc 4444 12.2.7, 12.3.4'],
  vcheck:['SERA.14070','SERA.14055(b)(1)'],
  vatis:['SERA.8015(e)(1)(iii)–(iv)','SERA.14055(b)(1)','AMC1 SERA.14001 1.4.7 a)'],
  vfrdep:['SERA.8015(e)(1)(ii)–(iii)','SERA.8015(e)(2)','SERA.8015(ec)','SERA.14045(c)','AMC1 SERA.14001 1.4.7, 1.4.10 i)–j), 1.4.11 a)','ICAO Doc 4444 12.2.7'],
  vleave:['SERA.8015(e)(1)(iii)','SERA.14055(b)(1)','AMC1 SERA.14001 1.1.4, 1.1.7 c)–e), 2.1.8 a)'],
  vtma:['SERA.8015(e)(1)(i), (iii)','SERA.14035(a)(1)(iii)','AMC1 SERA.14001 1.1.4 f), 2.3.3'],
  vafis:['AIP Norway GEN 3.3 4.1.3–4.1.5','AMC1 SERA.14001 1.4.13 c), 1.4.15 c), 1.4.19 i)–j)','Reg. (EU) 2017/373 ATS.TR.115'],
  vblind:['AIP Norway AD 2 (uncontrolled aerodromes: “… Traffic”)','AMC1 SERA.14001 1.4.14 a)','UK CAP 413 (secondary, ending with the field name)'],
  vfrarr:['SERA.8015(e)(1)(ii)–(iii)','SERA.14055(b)(1)','AMC1 SERA.14001 1.2.1 e), 1.4.13, 1.4.14, 1.4.16 a), 1.4.20 e)'],
  vcirc:['SERA.8015(e)(1)(ii)','AMC1 SERA.14001 1.4.14, 1.4.16 a), c), 1.4.18'],
  ifrfull:['SERA.8015(e)','SERA.14065(a)','SERA.14035','AMC1 SERA.14001 1.1.1–1.1.4, 1.2, 1.3, 1.4, 2.1–2.3','ICAO Doc 4444 12.3'],
  ifrclr:['SERA.8015(e)(1)(i), (iii)','SERA.14055(b)(1), (c)(2)','AMC1 SERA.14001 1.2.1, 1.2.2, 1.2.10 b), 1.3.1 f)'],
  itaxi:['SERA.8015(e)(1)(ii)','AMC1 SERA.14001 1.4.3, 1.4.7 e), 1.4.8 d)–f), 1.4.9 b), f)'],
  idep:['SERA.14065(a)','SERA.14035(a)(1)(i)','AMC1 SERA.14001 1.1.2, 1.4.11 a), 2.1.3 e), 2.1.4 b)'],
  ienr:['SERA.8015(e)(1)(iii)','AMC1 SERA.14001 1.1.2, 1.3.2 a), 2.1.6 f)','AIP Norway ENR 1.7'],
  ihold:['SERA.14065(a)','AMC1 SERA.14001 1.3.3 d), 1.3.4','SERA.14083(c)(4)(iv)'],
  ils:['SERA.14055(b)(1)','AMC1 SERA.14001 2.1.3, 2.1.6 f), 2.2.2 d)–e), 1.4.16 a), 1.4.20 e)'],
  iga:['SERA.8015(e)(1)(iii)','AMC1 SERA.14001 1.4.18','ICAO Doc 4444 12.3.4.18'],
  mayday:['SERA.14095(a)–(b)','SERA.8015(e)(1)(ii)–(iii)'],
  epan:['SERA.14095(c)(1)','SERA.8015(e)(1)(iii)'],
  emed:['SERA.14095(c)(1)','SERA.8015(e)(1)(iii)'],
  efuel:['SERA.11012','GM1 SERA.11012','AMC1 SERA.14001 1.1.3'],
  ercf:['SERA.14083(c)','SERA.14085(b)','SERA Appendix 1, 3.1.1'],
  elost:['SERA.8015(e)(1)(iii)','AMC1 SERA.14001 2.3.3','SERA.14095(c)'],
  ediv:['SERA.8015(e)(1)(iii)','AMC1 SERA.14001 1.1.8'],
  'b-alpha':['SERA.14020'],'b-num':['SERA.14035','SERA.14040'],'b-listen':['SERA.8015(e)(1)(iii)','SERA.14035'],
  'b-cs':['SERA.14050','SERA.14055(b)–(c)'],'b-words':['SERA.14045(b)','GM6–GM8 SERA.14045']
};
const G_=(k,group,lvl,t,d,segs,o)=>Object.assign({k,group,lvl,t,d,segs,basis:BASIS[k]||[],build:(V)=>build(segs,V)},o);
/* establishing contact with a station (a required "station" element) needs the full callsign (SERA.14055(b)(1)) */
function fix1(s){ if((s.els||[]).some(e=>e.k==='stn'&&!e.opt)) s.els.forEach(e=>{ if(e.k==='cs') e.full=1; }); return s; }
function build(segs,V){ const out=[]; segs.forEach(sk=>{ SEG[sk](V).forEach((s,i)=>{ s.id=sk+':'+i; out.push(fix1(s)); }); }); return out; }
const SCEN=[
  G_('vfrfull','vfr',2,tr('Full VFR flight, gate to gate','Hel VFR-tur, gate to gate'),tr('ATIS, taxi, conditional line-up, leave the zone, FIS, back in via November, land, taxi in. One continuous session.','ATIS, taksing, betinget oppstilling, ut av sonen, FIS, inn igjen via November, landing, taksing inn. Én sammenhengende økt.'),['atis','vtaxi','vline','vdep','vfis','varr','taxiin'],{full:1}),
  G_('vcheck','vfr',1,tr('Radio check','Radiosjekk'),tr('Readability scale, first words on the frequency','Lesbarhetsskala, de første ordene på frekvensen'),['vcheck']),
  G_('vatis','vfr',1,tr('ATIS and first call','ATIS og første oppkall'),tr('Copy the ATIS with static, then call Ground','Noter ATIS med støy, kall så Ground'),['atis','vtaxi']),
  G_('vfrdep','vfr',1,tr('Taxi, line-up and take-off','Taksing, oppstilling og avgang'),tr('Taxi clearance, conditional line-up, take-off','Taksiklarering, betinget oppstilling, avgang'),['vtaxi','vline'],{award:'radio:vfrdep'}),
  G_('vleave','vfr',1,tr('Leave the zone, flight information','Ut av sonen, flygeinformasjon'),tr('Reporting point, frequency change, FIS, squawk, traffic, position report','Meldepunkt, frekvensskifte, FIS, squawk, trafikk, posisjonsmelding'),['vdep','vfis']),
  G_('vtma','vfr',2,tr('TMA crossing','Kryssing av TMA'),tr('Request, squawk, crossing clearance, leaving','Forespørsel, squawk, kryssingsklarering, ut igjen'),['vtma']),
  G_('vafis','vfr',2,tr('AFIS aerodrome (Norway)','AFIS-flyplass (Norge)'),tr('Information, not clearances: what you read back and report','Informasjon, ikke klareringer: hva du leser tilbake og melder'),['vafis']),
  G_('vblind','vfr',1,tr('Uncontrolled field: blind calls','Ukontrollert plass: blindmeldinger'),tr('“Tjernmo traffic”: joining, downwind, final, vacated','«Tjernmo traffic»: inn, medvind, finale, forlatt'),['vblind']),
  G_('vfrarr','vfr',1,tr('Zone entry and landing','Inn i sonen og landing'),tr('Via November, circuit, landing clearance, taxi in','Via November, landingsrunde, landingsklarering, taksing inn'),['varr','taxiin'],{award:'radio:vfrarr'}),
  G_('vcirc','vfr',2,tr('Circuits and go-around','Landingsrunder og go-around'),tr('Touch and go, sequence, go-around, full stop','Touch and go, rekkefølge, go-around, full stop'),['vcirc']),
  G_('ifrfull','ifr',3,tr('Full IFR flight, gate to gate','Hel IFR-tur, gate to gate'),tr('Clearance, start, taxi with runway crossing, SID, climb to a flight level, control, STAR, hold, vectors, approach, landing. One continuous session.','Klarering, oppstart, taksing med banekryssing, SID, stigning til flygenivå, kontroll, STAR, venting, vektorer, innflyging, landing. Én sammenhengende økt.'),['iclr','istart','itaxi','ito','iclimb','ienr','ihold','ivec','iland','taxiin'],{full:1}),
  G_('ifrclr','ifr',1,tr('IFR clearance (CRAFT)','IFR-klarering (CRAFT)'),tr('Copy and read back the clearance','Noter og les tilbake klareringen'),['iclr'],{award:'radio:ifrclr'}),
  G_('itaxi','ifr',2,tr('Start-up and taxi with a runway crossing','Oppstart og taksing med banekryssing'),tr('Start-up, hold short, cross, report vacated','Oppstart, hold short, kryss, meld forlatt'),['istart','itaxi']),
  G_('idep','ifr',2,tr('Take-off, SID and climb','Avgang, SID og stigning'),tr('Take-off, check-in, flight level, heading, direct-to','Avgang, innsjekk, flygenivå, kurs, direkte'),['ito','iclimb']),
  G_('ienr','ifr',2,tr('En route and arrival','Underveis og ankomst'),tr('Speed, descent through the transition level, STAR','Fart, nedstigning gjennom overgangsnivået, STAR'),['ienr']),
  G_('ihold','ifr',3,tr('Holding','Venting'),tr('Hold at RONAX: fix, track, turns, level, expected approach time','Vent ved RONAX: punkt, kurs, svinger, nivå, forventet tid'),['ihold']),
  G_('ils','ifr',2,tr('Vectors and approach','Vektorer og innflyging'),tr('Headings, speed, cleared ILS or RNP, established, Tower, landing','Kurser, fart, klarert ILS eller RNP, etablert, Tower, landing'),['ivec','iland'],{award:'radio:ils'}),
  G_('iga','ifr',2,tr('Go-around','Go-around'),tr('ATC-initiated and pilot-initiated missed approach','Avbrutt innflyging fra ATC og fra piloten'),['iga']),
  G_('mayday','emerg',2,tr('Engine failure: MAYDAY','Motorstans: MAYDAY'),tr('Distress call, vectors, squawk 7700, landing','Nødmelding, vektorer, squawk 7700, landing'),['emay'],{award:'radio:mayday'}),
  G_('epan','emerg',2,tr('Rough engine: PAN PAN','Ujevn motor: PAN PAN'),tr('Urgency call and priority approach','Ilmelding og prioritert innflyging'),['epan']),
  G_('emed','emerg',2,tr('Medical diversion','Medisinsk mål-endring'),tr('PAN PAN for a sick passenger, diversion','PAN PAN for syk passasjer, mål-endring'),['emed']),
  G_('efuel','emerg',3,tr('Minimum fuel and fuel MAYDAY','Minimum fuel og MAYDAY FUEL'),tr('When to say which, and what follows','Når du sier hva, og hva som følger'),['efuel']),
  G_('ercf','emerg',2,tr('Radio failure (7600)','Radiosvikt (7600)'),tr('Blind transmission and light signals','Blindsending og lyssignaler'),['ercf']),
  G_('elost','emerg',2,tr('Uncertain of position','Usikker på posisjon'),tr('Ask early, squawk and ident, heading for the field','Spør tidlig, squawk og ident, kurs mot plassen'),['elost']),
  G_('ediv','emerg',2,tr('Weather diversion','Mål-endring for vær'),tr('Tell FIS, copy the new field','Si fra til FIS, noter det nye målet'),['ediv'])
];

/* ---------------- basics drills (generated) ---------------- */
const NAMES=['OSVIK','RONAX','TUSKA','FAPSO','ALPOR','HOLAN','BIKAN','SKARVIK','TJERNMO'];
const DRILL={
  alpha:(V,r)=>{ const pick=a=>a[Math.floor(r()*a.length)]; const L='ABCDEFGHIJKLMNOPQRSTUVWXYZ'; const out=[];
    for(let i=0;i<6;i++){ const w= i%2? pick(NAMES) : 'LN-'+L[Math.floor(r()*26)]+L[Math.floor(r()*26)]+L[Math.floor(r()*26)];
      out.push({id:'b-alpha',cat:'basic',ph:'basic',noAtc:1,prompt:tr('Spell <b>'+w+'</b> with the phonetic alphabet.','Stav <b>'+w+'</b> med det fonetiske alfabetet.'),task:tr('Say or type the words, e.g. “Oscar Sierra …”.','Si eller skriv ordene, f.eks. «Oscar Sierra …».'),els:[{k:'spell',v:w}],model:C.spellWords(w)}); }
    return out; },
  numbers:(V,r)=>{ const int=(a,b)=>a+Math.floor(r()*(b-a+1)), pick=a=>a[Math.floor(r()*a.length)]; const out=[];
    const f=pick(['118.300','121.700','119.250','124.200','128.905','123.455','132.035','126.150']);
    const items=[['freq',f,C.freqWords(f)],['qnh',String(int(988,1031)),null],['hdg',String(int(1,36)*10).padStart(3,'0'),null],['fl','FL'+String(pick([65,75,90,100,110,195,200,250])).padStart(3,'0'),null],['alt',String(pick([1500,2500,3500,4000,10000])),null],['sq',String(int(1,6))+int(0,7)+int(0,7)+int(1,7),null]];
    items.forEach(([k,v,w])=>{ let words=w; const d=s=>C.spellWords(s).replace(/tree/g,'three').replace(/fife/g,'five');
      // SERA.14035(a)(1): FL in whole hundreds = "flight level one hundred"; QNH 1000 = "one thousand"; squawk whole thousands = "seven thousand"
      if(!words) words= k==='fl'? 'flight level '+(+v.slice(2)%100===0? d(String(+v.slice(2)/100))+' hundred' : d(v.slice(2).replace(/^0/,''))) : k==='alt'? C.altWords(v)+' feet' : k==='qnh'&&v==='1000'? 'one thousand' : k==='sq'&&/^[1-7]000$/.test(v)? d(v[0])+' thousand' : d(v);
      words=words.replace(/\btree\b/g,'three').replace(/\bfife\b/g,'five');
      const lab={freq:tr('frequency','frekvens'),qnh:tr('QNH','QNH'),hdg:tr('heading','kurs'),fl:tr('flight level','flygenivå'),alt:tr('altitude','høyde'),sq:tr('squawk','squawk')}[k];
      out.push({id:'b-num-'+k,cat:'basic',ph:'basic',noAtc:1,prompt:tr(`Say the ${lab.en} <b>${v}</b> the radio way.`,`Si ${lab.no} <b>${v}</b> slik det sies på radio.`),task:tr('Say it, or type it in words.','Si det, eller skriv det med ord.'),els:[{k:'say',v,w:words}],model:words}); });
    return out; },
  listen:(V,r)=>{ const int=(a,b)=>a+Math.floor(r()*(b-a+1)), pick=a=>a[Math.floor(r()*a.length)]; const out=[];
    for(let i=0;i<5;i++){ const sqv=String(int(1,6))+int(0,7)+int(0,7)+int(1,7), q=int(988,1031), h=String(int(1,36)*10).padStart(3,'0'), f=pick(['119.250','124.200','128.905','126.150','132.035']), l=pick([70,80,90,100,110]);
      const T=[[`${V.a}, climb to flight level ${l}, squawk ${sqv}.`,[fl(l),sq(sqv)],`FL${l}, squawk ${sqv}`],[`${V.a}, turn left heading ${h}, descend to altitude 3000 feet, QNH ${q}.`,[turn('left'),hdg(h),alt(3000),qnh(q)],`left ${h}, 3000 ft, QNH ${q}`],
        [`${V.a}, contact Vestfjell Control ${f}.`,[freq(f)],f],[`${V.a}, QNH ${q}, squawk ${sqv}.`,[qnh(q),sq(sqv)],`QNH ${q}, squawk ${sqv}`],[`${V.a}, turn right heading ${h}, reduce speed to 120 knots.`,[turn('right'),hdg(h),spd(120)],`right ${h}, 120 kt`]][i];
      out.push({id:'b-listen',cat:'copy',ph:'basic',listen:1,noAtc:1,atc:T[0],task:tr('Listen, then type the values (no need to read back properly).','Lytt, og skriv så verdiene (ingen ordentlig tilbakelesing nødvendig).'),els:T[1],model:T[2]}); }
    return out; },
  cs:(V,r)=>{ const L='ABCDEFGHIJKLMNOPQRSTUVWXYZ', pick=a=>a[Math.floor(r()*a.length)]; const rl=()=>L[Math.floor(r()*26)]; const out=[];
    ['LN-','SE-','OY-','G-','D-E'].forEach((p,i)=>{ if(i>3) return; const full=p+rl()+rl()+(p.length===2?rl()+rl():rl()); const flat=full.replace('-',''); const ab=flat[0]+'-'+flat.slice(-2);
      out.push({id:'b-cs',cat:'basic',ph:'basic',noAtc:1,prompt:tr(`Your callsign is <b>${full}</b>. The controller has abbreviated it. What is the shortest abbreviated form?`,`Kallesignalet ditt er <b>${full}</b>. Flygelederen har forkortet det. Hva er den korteste forkortede formen?`),task:tr('Type it, e.g. G-CD (first character and at least the last two).','Skriv det, f.eks. G-CD (første tegn og minst de to siste).'),els:[{k:'abbr',v:ab,reg:full}],model:ab}); });
    out.push({id:'b-cs',cat:'basic',ph:'basic',noAtc:1,prompt:tr('Your callsign is <b>BIRDIE 421</b> (a flight number). What is the abbreviated form?','Kallesignalet ditt er <b>BIRDIE 421</b> (et flightnummer). Hva er den forkortede formen?'),task:tr('Type it, or “none”.','Skriv det, eller «none».'),els:[{k:'abbr',v:null,full:'BIRDIE 421'}],model:'None: BIRDIE 421 is not abbreviated.'});
    out.push({id:'b-cs2',cat:'basic',ph:'basic',noAtc:1,prompt:tr(`First call to a new unit. Which form of your callsign do you use: ${V.c} or ${V.a}?`,`Første oppkall til en ny enhet. Hvilken form av kallesignalet bruker du: ${V.c} eller ${V.a}?`),task:tr('Type the callsign you would use.','Skriv kallesignalet du ville brukt.'),els:[cs({full:1})],model:V.c});
    return out; },
  words:(V,r)=>{ const items=[
      [`${V.a}, do you have the DA40 in sight?`,tr('You do.','Det har du.'),P('“Affirm”','«Affirm»',/\baffirm\b/),`Affirm, ${V.a}.`],
      [`${V.a}, are you able to accept runway 18?`,tr('You are not.','Det kan du ikke.'),P('“Negative” or “unable”','«Negative» eller «unable»',/\b(negative|unable)\b/),`Negative, ${V.a}.`],
      [`${V.a}, report Sierra.`,tr('You will.','Det skal du.'),P('“Wilco”','«Wilco»',/\bwilco\b/),`Wilco, ${V.a}.`],
      [`${V.a}, traffic information: the DA40 has landed.`,tr('Acknowledge receipt only.','Bare bekreft at du har mottatt.'),P('“Roger”','«Roger»',/\broger\b/),`Roger, ${V.a}.`],
      [`${V.a}, ..... runway ..... cleared .....`,tr('The transmission was garbled.','Sendingen var uleselig.'),P('“Say again”','«Say again»',/\bsay again\b/),`${V.a}, say again.`],
      [`${V.a}, turn right heading 090.`,tr('You cannot: there is a cloud build-up ahead.','Du kan ikke: det er en byge foran deg.'),P('“Unable”','«Unable»',/\bunable\b/),`Unable, cumulonimbus ahead, ${V.a}.`],
      [`${V.a}, say your fuel endurance.`,tr('You need a moment to calculate.','Du trenger litt tid til å regne.'),P('“Standby”','«Standby»',/\bstandby\b/),`${V.a}, standby.`]];
    return items.map(([a,t,e,m])=>({id:'b-words',cat:'basic',ph:'basic',rb:1,atc:a,task:tr('Answer with the right standard word. '+t.en,'Svar med riktig standardord. '+t.no),els:[e,cs()],model:m})); }
};
const DRILLS=[
  {k:'b-alpha',group:'basic',lvl:1,t:tr('Phonetic alphabet','Det fonetiske alfabetet'),d:tr('Spell fixes and registrations','Stav punkter og registreringer'),drill:'alpha'},
  {k:'b-num',group:'basic',lvl:1,t:tr('Numbers the radio way','Tall slik de sies på radio'),d:tr('Frequencies, QNH, headings, levels, altitudes, squawks','Frekvenser, QNH, kurser, nivåer, høyder, squawk'),drill:'numbers'},
  {k:'b-listen',group:'basic',lvl:2,t:tr('Copy numbers at real speed','Noter tall i reell fart'),d:tr('Listen to clearances and write the values','Lytt til klareringer og skriv verdiene'),drill:'listen'},
  {k:'b-cs',group:'basic',lvl:1,t:tr('Callsign abbreviation','Forkorting av kallesignal'),d:tr('When and how a callsign is shortened','Når og hvordan et kallesignal forkortes'),drill:'cs'},
  {k:'b-words',group:'basic',lvl:1,t:tr('Standard words','Standardord'),d:tr('Affirm, negative, wilco, roger, say again, unable, standby','Affirm, negative, wilco, roger, say again, unable, standby'),drill:'words'}
];
DRILLS.forEach(d=>{ d.basis=BASIS[d.k]||[]; d.build=(V)=>DRILL[d.drill](V,C.rng((V.seed||1)+7)).map((s,i)=>Object.assign(s,{id:s.id+':'+i})); });

/* rebuild a single step by id (spaced repetition / quick drill) */
function stepById(id,V){ const [sk,ix]=id.split(':'); if(SEG[sk]){ const st=C.prep(SEG[sk](V).map((s,i)=>fix1(Object.assign(s,{id:sk+':'+i}))),V); const s=st[+ix]; if(!s) return null;
    // include the controller transmission that a context step answers
    if(s.ctxAtc&&!s.atc){ const p=st[+ix-1]; if(p&&p.reply) s.atc=p.reply; }
    if(!s.sit) s.sit=null; return s; }
  return null; }
const QUICK_POOL=()=>Object.keys(SEG).flatMap(sk=>{ const V=vars(1); return SEG[sk](V).map((s,i)=>({id:sk+':'+i,s})).filter(o=>o.s.rb&&o.s.atc&&!o.s.atis&&!o.s.noAtc).map(o=>o.id); });
function quick(V,r,ids){ const pool=QUICK_POOL(); const pick=[];
  (ids||[]).forEach(id=>{ if(pick.length<6&&pool.includes(id)&&!pick.includes(id)) pick.push(id); });
  while(pick.length<6){ const id=pool[Math.floor(r()*pool.length)]; if(!pick.includes(id)) pick.push(id); }
  return pick.map(id=>stepById(id,V)).filter(Boolean).map(s=>Object.assign(s,{abbrOK:true})); }

const ALL=SCEN.concat(DRILLS);
G.RADIOSCEN={vars,atisText,SEG,SCEN,DRILLS,ALL,BASIS,byKey:k=>ALL.find(s=>s.k===k),stepById,quick,QUICK_POOL,UNIT,tl};
})(typeof window!=='undefined'?window:globalThis);
