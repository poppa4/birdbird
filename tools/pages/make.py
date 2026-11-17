#!/usr/bin/env python3
"""Writes models.html and quality.html (English text in the page, Norwegian in the LAB dictionary).
Every text is a (en, no) pair, so the two languages cannot drift apart."""
import html, json, re, sys
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..') + '/'
D = {}                                   # en -> no
def T(en, no):
    D[en] = no; return html.escape(en, quote=False)
def ver(name):
    s = open(ROOT + 'sources.html', encoding='utf8').read()
    return re.search(re.escape(name) + r'\?v=(\d+)', s).group(1)

ST = {'beta': ('Beta', 'Beta'), 'illus': ('Illustrative model', 'Illustrativ modell'), 'fict': ('Fictional training data', 'Fiktive treningsdata'),
      'nonav': ('Not for navigation', 'Ikke for navigasjon'), 'src': ('Checked against source', 'Kontrollert mot kilde'), 'own': ('Your own data', 'Dine egne data'),
      'open': ('Open data, not the official AIP', 'Åpne data, ikke offisiell AIP'), 'ex': ('Examples, not your SOP', 'Eksempler, ikke din SOP')}
def pills(codes): return ''.join('<span class="stt %s">%s</span>' % (c, T(*ST[c])) for c in codes)

ROWS = [('Built on', 'Bygger på'), ('What works', 'Hva som virker'), ('Simplified or left out', 'Forenklet eller utelatt'), ('Do not use it for', 'Bruk det ikke til')]

TOOLS = [
 ('c172', ('Cessna 172 cockpit trainer', 'Cessna 172 cockpit-trener'), ['illus', 'fict'], 'c172.html', [
   [('A general light single-engine flight model, tuned to typical Cessna 172 numbers.', 'En generell flymodell for lett enmotors fly, stilt inn etter typiske tall for Cessna 172.'),
    ('An analogue six-pack panel drawn by NORDAP, and a fictional training area around one aerodrome.', 'Et analogt six-pack-panel tegnet av NORDAP, og et fiktivt øvingsområde rundt én flyplass.')],
   [('The instrument scan, attitude flying, VOR, ADF and DME navigation, the circuit and basic instrument procedures.', 'Instrumentskann, attitydeflyging, navigasjon med VOR, ADF og DME, landingsrunden og grunnleggende instrumentprosedyrer.'),
    ('Mixture and EGT, the magneto check, the electrical system and a vacuum failure with gyros that slowly topple.', 'Blanding og EGT, magnetsjekk, det elektriske systemet og vakuumsvikt der gyroene sakte velter.'),
    ('Your own checklist from My workspace, and a debrief after each exercise.', 'Din egen sjekkliste fra Min arbeidsflate, og debrief etter hver øvelse.')],
   [('No P-factor or torque on the ground.', 'Ingen P-faktor eller dreiemoment på bakken.'),
    ('No mass and balance: one fixed weight of about 2,200 lb.', 'Ingen masse og balanse: én fast vekt på omtrent 2200 lb.'),
    ('Gauges and limits are typical values for learning, not certified data.', 'Instrumentverdier og grenser er typiske verdier for læring, ikke sertifiserte data.'),
    ('The 3D cockpit is in beta.', '3D-cockpiten er i beta.')],
   [('Performance planning, real limits or a checklist. Use the POH or AFM and your school\'s checklist.', 'Ytelsesberegning, virkelige grenser eller sjekkliste. Bruk POH eller AFM og skolens sjekkliste.')]]),
 ('da42', ('DA42 glass cockpit trainer', 'DA42 glass cockpit-trener'), ['illus', 'fict'], 'cockpit.html', [
   [('A DA42-like twin-engine flight model made for teaching. The numbers are approximate and do not come from a certified model.', 'En DA42-lignende tomotors flymodell laget for undervisning. Tallene er tilnærmede og kommer ikke fra en sertifisert modell.'),
    ('Glass displays that follow common glass-cockpit conventions, with NORDAP\'s own graphics. It is not a product of any avionics maker.', 'Glassskjermer som følger vanlige glass cockpit-konvensjoner, med NORDAPs egen grafikk. Det er ikke et produkt fra noen avionikkprodusent.'),
    ('A fictional region with its own navigation database.', 'En fiktiv region med egen navigasjonsdatabase.')],
   [('PFD and MFD, radios, the CDI, flight plan, direct-to and loading an approach.', 'PFD og MFD, radioer, CDI, flyplan, direkte-til og lasting av innflyging.'),
    ('The autopilot, ILS approaches and engine-failure scenarios, with wind and atmosphere you set yourself.', 'Autopilot, ILS-innflyginger og motorsviktscenarioer, med vind og atmosfære du stiller selv.'),
    ('Your own checklist from My workspace, and a debrief after each exercise.', 'Din egen sjekkliste fra Min arbeidsflate, og debrief etter hver øvelse.')],
   [('Performance is approximate. Speeds and limits are learning examples, not facts.', 'Ytelsen er tilnærmet. Hastigheter og grenser er læringseksempler, ikke fakta.'),
    ('The trainer gives no procedure text. Every school has its own checklists.', 'Treneren gir ingen prosedyretekst. Hver skole har sine egne sjekklister.'),
    ('Waypoints, frequencies and procedures in the database are invented.', 'Veipunkter, frekvenser og prosedyrer i databasen er oppdiktet.'),
    ('The 3D cockpit is in beta.', '3D-cockpiten er i beta.')],
   [('Learning a real avionics unit button for button, real procedures or real aircraft data. Use the AFM, the avionics pilot\'s guide and your school\'s material.', 'Å lære en virkelig avionikkenhet knapp for knapp, virkelige prosedyrer eller virkelige flydata. Bruk AFM, avionikkens pilotveiledning og skolens materiell.')]]),
 ('b200', ('King Air B200 cockpit trainer and type-rating example', 'King Air B200 cockpit-trener og typerating-eksempel'), ['illus', 'fict'], 'b200.html', [
   [('A typical twin-turboprop panel drawn by NORDAP, with teaching models of the system logic.', 'Et typisk tomotors turboprop-panel tegnet av NORDAP, med undervisningsmodeller av systemlogikken.'),
    ('Typical King Air B200 values, for learning only.', 'Typiske verdier for King Air B200, kun for læring.')],
   [('Engine start, the autofeather test, and engine-failure, fire and pressurisation drills.', 'Motorstart, autofeather-test, og øvelser på motorsvikt, brann og trykkabin.'),
    ('Power, propeller and condition levers with their detents, ground power and the annunciators.', 'Gass-, propell- og condition-spaker med sperrer, bakkestrøm og varsellys.'),
    ('The type-rating page shows how an instructor can be set up from your own POH, checklists and SOP.', 'Typerating-siden viser hvordan en instruktør kan settes opp fra din egen POH, sjekklister og SOP.')],
   [('Own drawings and simplified behaviour. The model does not show every system detail of the aircraft.', 'Egne tegninger og forenklet oppførsel. Modellen viser ikke alle systemdetaljer i flyet.'),
    ('Numbers are typical values and are not taken from an AFM.', 'Tallene er typiske verdier og er ikke hentet fra en AFM.'),
    ('The 3D cockpit is in beta.', '3D-cockpiten er i beta.')],
   [('Type-rating training, limits or procedures. Verify everything in your AFM or POH.', 'Typerating-trening, grenser eller prosedyrer. Kontroller alt i din AFM eller POH.')]]),
 ('flows', ('Flow trainer and its cockpits', 'Flow-treneren og cockpitene'), ['ex'], 'flows.html', [
   [('Fourteen cockpits: NORDAP cockpits with every control named, real flight-deck photos under free licences, or your own picture.', 'Fjorten cockpiter: NORDAP-cockpiter med alle kontroller navngitt, ekte cockpitbilder under frie lisenser, eller ditt eget bilde.'),
    ('Ready-made flows written from public handbooks and checklists. Each one names its source.', 'Ferdige flows skrevet ut fra offentlige håndbøker og sjekklister. Hver av dem oppgir kilden.')],
   [('Drawing your own flow, one layer per pilot, playback, practice from memory and a practice log.', 'Tegne din egen flow, ett lag per pilot, avspilling, øving fra hukommelsen og øvingslogg.'),
    ('A button to report a wrong or missing control name.', 'En knapp for å melde feil eller manglende kontrollnavn.')],
   [('A control is named after the label on the picture you see.', 'En kontroll har navn etter merkingen på bildet du ser.'),
    ('Names on the 737, 787 and A350 have not been checked against the aircraft handbooks.', 'Navn på 737, 787 og A350 er ikke kontrollert mot flyenes håndbøker.'),
    ('The A350 overhead panel is a drawing. The E190 lacks a few controls. The ATR 72-600 is shown with a photo, not a NORDAP cockpit.', 'Overheadpanelet på A350 er en tegning. E190 mangler noen få kontroller. ATR 72-600 vises med et bilde, ikke en NORDAP-cockpit.'),
    ('The Cessna 172 flows come from the handbook of an earlier model than the cockpit shown. The King Air flows come from a public simulator checklist, not the POH.', 'Flows for Cessna 172 kommer fra håndboken til en eldre modell enn cockpiten som vises. Flows for King Air kommer fra en offentlig simulatorsjekkliste, ikke POH.'),
    ('There are no ready-made flows for the A320, the Seneca, the E190, the ATR or the large jets.', 'Det finnes ingen ferdige flows for A320, Seneca, E190, ATR eller de store jetflyene.')],
   [('A standard. The examples show how a flow can look. Your operator\'s SOP decides the order and the words.', 'En standard. Eksemplene viser hvordan en flow kan se ut. Operatørens SOP bestemmer rekkefølge og ordlyd.')]]),
 ('ifr', ('IFR trainer', 'IFR-trener'), ['illus', 'fict', 'nonav'], 'ifr.html', [
   [('The same teaching flight model as the cockpit trainers, in a training world with invented aerodromes, navaids and procedures.', 'Den samme undervisningsmodellen som cockpit-trenerne, i en øvingsverden med oppdiktede flyplasser, navigasjonshjelpemidler og prosedyrer.')],
   [('One instrument procedure at a time, with the next step on screen and a replay of your first mistake.', 'Én instrumentprosedyre om gangen, med neste steg på skjermen og avspilling av din første feil.')],
   [('The procedures teach the method. They are not published procedures.', 'Prosedyrene lærer bort metoden. De er ikke publiserte prosedyrer.'),
    ('The score compares your flying with tolerance bands set by NORDAP.', 'Poengsummen sammenligner flygingen din med toleransebånd satt av NORDAP.')],
   [('Proof that you are ready for a skill test, or for flying a published procedure. Your instructor decides that.', 'Bevis på at du er klar for en ferdighetsprøve, eller for å fly en publisert prosedyre. Det avgjør instruktøren din.')]]),
 ('g2g', ('Gate to gate', 'Gate to gate'), ['fict', 'ex', 'nonav'], 'radio.html', [
   [('One whole DA42 trip in an invented setting: aerodromes, charts, frequencies and weather are made for the exercise.', 'Én hel DA42-tur i oppdiktede omgivelser: flyplasser, kart, frekvenser og vær er laget for øvelsen.')],
   [('Flows, checklists, briefings and every radio call in order, by voice or keyboard.', 'Flows, sjekklister, briefinger og hvert radioanrop i rekkefølge, med stemme eller tastatur.')],
   [('The order of flows, checklists and briefings is NORDAP\'s example. It is not the DA42 AFM and not any school\'s SOP.', 'Rekkefølgen på flows, sjekklister og briefinger er NORDAPs eksempel. Det er ikke DA42 AFM og ikke noen skoles SOP.'),
    ('No instructor outside NORDAP has reviewed the sequence yet.', 'Ingen instruktør utenfor NORDAP har gjennomgått sekvensen ennå.')],
   [('A checklist or a procedure in a real aircraft.', 'En sjekkliste eller prosedyre i et virkelig fly.')]]),
 ('radio', ('Radio drills', 'Radioøvelser'), ['src'], 'radio-drills.html', [
   [('Phraseology written from the published rules. The trainer shows the rule behind each call.', 'Fraseologi skrevet ut fra publisert regelverk. Treneren viser regelen bak hvert anrop.')],
   [('Calls checked element by element, with the correct readback, by voice or keyboard. No account and no AI.', 'Anrop kontrollert element for element, med riktig tilbakelesing, med stemme eller tastatur. Ingen konto og ingen AI.')],
   [('Call signs, aerodromes and frequencies in the drills are invented.', 'Kallesignaler, flyplasser og frekvenser i øvelsene er oppdiktet.'),
    ('Local practice differs between countries. The drill says which rule it follows.', 'Lokal praksis varierer mellom land. Øvelsen sier hvilken regel den følger.'),
    ('Speech recognition can mishear. The keyboard is a full alternative.', 'Talegjenkjenning kan høre feil. Tastaturet er et fullverdig alternativ.')],
   [('A radio licence test, or as the last word on phraseology. Use the regulation and your instructor.', 'En prøve for radiosertifikat, eller som siste ord om fraseologi. Bruk regelverket og instruktøren din.')]]),
 ('briefings', ('Briefings', 'Briefinger'), ['fict', 'nonav'], 'briefing.html', [
   [('A departure or an approach briefing on an invented chart, with weather and aircraft numbers given for the exercise.', 'En avgangs- eller innflygingsbrief på et oppdiktet kart, med vær og flytall gitt for øvelsen.')],
   [('Briefing out loud, scored on structure, the numbers and how you deal with the threats.', 'Briefing høyt, vurdert på struktur, tallene og hvordan du håndterer truslene.')],
   [('The chart is drawn for training and is not a published chart.', 'Kartet er tegnet for øving og er ikke et publisert kart.'),
    ('The score follows a fixed structure. An instructor may want another order.', 'Poengsummen følger en fast struktur. En instruktør kan ønske en annen rekkefølge.')],
   [('Briefing a real flight. Use current charts and your operator\'s briefing format.', 'Briefing av en virkelig flyging. Bruk gjeldende kart og operatørens briefingformat.')]]),
 ('route', ('Route Explorer', 'Route Explorer'), ['open', 'nonav'], 'route.html', [
   [('Open data: airspace, aerodromes and navaids from openAIP, terrain from public elevation models, weather from public services.', 'Åpne data: luftrom, flyplasser og navigasjonshjelpemidler fra openAIP, terreng fra offentlige høydemodeller, vær fra offentlige tjenester.'),
    ('Each map layer names its source and how old the data is.', 'Hvert kartlag oppgir kilden og hvor gamle dataene er.')],
   [('Seeing a route before you plan it: terrain, airspace, weather along the track and the vertical profile.', 'Å se en rute før du planlegger den: terreng, luftrom, vær langs sporet og vertikalprofil.'),
    ('A link to the official AIP of each country, checked every week.', 'Lenke til offisiell AIP for hvert land, kontrollert hver uke.')],
   [('It is not an official chart. Airspace, points and frequencies can be missing or out of date.', 'Det er ikke et offisielt kart. Luftrom, punkter og frekvenser kan mangle eller være utdaterte.'),
    ('Coverage differs between countries.', 'Dekningen varierer mellom land.'),
    ('The go / no-go view compares the data on the map with limits you set. It does not decide anything.', 'Go / no-go-visningen sammenligner dataene i kartet med grenser du setter. Den avgjør ingenting.')],
   [('Flight planning or navigation. Plan in an approved tool and check airspace, points and frequencies in the current AIP.', 'Flyplanlegging eller navigasjon. Planlegg i et godkjent verktøy og kontroller luftrom, punkter og frekvenser i gjeldende AIP.')]]),
 ('pack', ('Briefing pack', 'Briefingpakke'), ['own'], 'prep.html', [
   [('A fixed order of pages for one flight. What you type is the content.', 'En fast rekkefølge av sider for én flyging. Det du skriver inn er innholdet.')],
   [('Arithmetic on your own numbers: fuel, mass and balance, performance factors and times.', 'Regning på dine egne tall: drivstoff, masse og balanse, ytelsesfaktorer og tider.'),
    ('Weather fetched for an aerodrome is shown with its source and time.', 'Vær hentet for en flyplass vises med kilde og tidspunkt.'),
    ('It prints as a booklet and stays on your device.', 'Den skrives ut som et hefte og blir på enheten din.')],
   [('NORDAP does not check that what you typed is right, complete or current.', 'NORDAP kontrollerer ikke at det du har skrevet er riktig, komplett eller gjeldende.'),
    ('Aircraft figures offered as examples are learning values, not facts.', 'Flytall som tilbys som eksempler er læringsverdier, ikke fakta.'),
    ('The go / no-go page sums up your own entries against your own limits. It is not an operational assessment.', 'Go / no-go-siden oppsummerer dine egne tall mot dine egne grenser. Det er ikke en operativ vurdering.')],
   [('Replacing the AFM, NOTAM, minima or weather from official sources. Check each of them yourself.', 'Å erstatte AFM, NOTAM, minima eller vær fra offisielle kilder. Kontroller hver av dem selv.')]]),
 ('labs', ('Virtual Labs', 'Virtual Labs'), ['illus'], 'lab.html', [
   [('Simplified physics that shows how things relate. Each lab states its purpose and what it leaves out.', 'Forenklet fysikk som viser hvordan ting henger sammen. Hver lab oppgir formålet og hva den utelater.')],
   [('Changing one thing at a time and seeing what follows, in six subject areas.', 'Å endre én ting om gangen og se hva som følger, i seks fagområder.')],
   [('Aircraft figures, also where a lab says A320, are illustrative values.', 'Flytall, også der en lab sier A320, er illustrative verdier.'),
    ('The labs are a visual reference. They do not cover a whole ATPL subject and are not a question bank.', 'Labbene er et visuelt oppslagsverk. De dekker ikke et helt ATPL-fag og er ikke en spørsmålsbank.')],
   [('Operational decisions or exam preparation alone.', 'Operative beslutninger eller eksamensforberedelse alene.')]]),
]

CSS = """
.sc-list{margin:0;padding:0;list-style:none;border-top:1px solid var(--rule)}
.sc-list li{padding:10px 0;border-bottom:1px solid var(--rule-2);font-size:15px;line-height:1.5}
.mp{margin:14px 0 0;border-top:1px solid var(--ink)}
.mp>div{display:grid;grid-template-columns:minmax(150px,220px) minmax(0,1fr);gap:4px 28px;padding:13px 0;border-bottom:1px solid var(--rule-2)}
.mp dt{font-family:var(--f-mono);font-size:11.5px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);padding-top:3px}
.mp dd{margin:0;font-size:15px;line-height:1.55}
.mp dd ul{margin:0;padding:0;list-style:none}
.mp dd li{padding:0 0 6px}.mp dd li:last-child{padding:0}
.mp-st{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:10px 0 0}
.mp-st a{font-size:13.5px;margin-left:4px}
.lg{margin:0;padding:0;list-style:none;border-top:1px solid var(--rule)}
.lg li{display:grid;grid-template-columns:minmax(150px,230px) minmax(0,1fr);gap:6px 24px;align-items:start;padding:11px 0;border-bottom:1px solid var(--rule-2);font-size:15px;line-height:1.5}
.lg li>span:first-child{padding-top:1px}
.cl{margin:0;padding:0;list-style:none;border-top:1px solid var(--ink)}
.cl li{display:grid;grid-template-columns:110px minmax(0,1fr);gap:4px 24px;padding:11px 0;border-bottom:1px solid var(--rule-2);font-size:15px;line-height:1.5}
.cl time{font-family:var(--f-mono);font-size:12.5px;color:var(--ink-2);padding-top:2px}
@media (max-width:700px){.mp>div,.lg li,.cl li{grid-template-columns:minmax(0,1fr)}}
"""

def page(fname, key, title, eyebrow, intro, desc, nav, body):
    for x in (title, eyebrow, intro): T(*x)
    for i, t in nav: T(*t)
    dic = ',\n '.join('%s:%s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)) for k, v in D.items())
    out = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title[0])} · NORDAP</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="stylesheet" href="lab.css?v={ver('lab.css')}">
<link rel="stylesheet" href="site.css?v={ver('site.css')}">
<style>{CSS}</style>
</head>
<body data-title="{html.escape(title[0])}">
<script src="site.js?v={ver('site.js')}"></script>
<div class="page">
  <header class="lhead">
    <div class="brand">
      <div class="eyebrow">{T(*eyebrow)}</div>
      <h1>{T(*title)}</h1>
      <p>{T(*intro)}</p>
    </div>
  </header>
  <nav class="snav" aria-label="Sections">{''.join('<a href="#%s">%s</a>' % (i, T(*t)) for i, t in nav)}</nav>
{body}
</div>
<script src="lab.js?v={ver('lab.js')}"></script>
<script>
(function(){{
'use strict';
LAB.add({{'Sections':'Sections'}},{{
 'Sections':'Seksjoner',
 {dic}
}});
LAB.start('{key}');
}})();
</script>
</body>
</html>
"""
    # the dictionary is built while the body is rendered, so render twice is not needed: T() ran before this f-string for body/nav
    open(ROOT + fname, 'w', encoding='utf8').write(out)
    print(fname, len(out), 'bytes,', len(D), 'strings')

# ---------------------------------------------------------------- models.html
D.clear()
body = ''
for tid, name, codes, href, rows in TOOLS:
    body += '  <section class="card" id="%s">\n    <h2>%s</h2>\n    <p class="mp-st">%s<a href="%s">%s</a></p>\n    <dl class="mp">\n' % (tid, T(*name), pills(codes), href, T('Open', 'Åpne'))
    for (lab, items) in zip(ROWS, rows):
        body += '      <div><dt>%s</dt><dd><ul>%s</ul></dd></div>\n' % (T(*lab), ''.join('<li>%s</li>' % T(*i) for i in items))
    body += '    </dl>\n  </section>\n'
body += '  <section class="card" id="words">\n    <h2>%s</h2>\n    <ul class="lg">\n' % T('What the status words mean', 'Hva statusordene betyr')
LEG = [('beta', ('The feature works but is not finished. It can fail on some devices.', 'Funksjonen virker, men er ikke ferdig. Den kan svikte på noen enheter.')),
       ('illus', ('A simplified model that shows how things relate. The numbers are typical or example values.', 'En forenklet modell som viser hvordan ting henger sammen. Tallene er typiske verdier eller eksempler.')),
       ('fict', ('Aerodromes, charts, frequencies, weather or call signs are invented for the exercise.', 'Flyplasser, kart, frekvenser, vær eller kallesignaler er oppdiktet for øvelsen.')),
       ('ex', ('One way of doing it, shown as an example. Your operator or school decides.', 'Én måte å gjøre det på, vist som eksempel. Operatøren eller skolen din bestemmer.')),
       ('src', ('The content is written from a named source and has been compared with it by NORDAP.', 'Innholdet er skrevet ut fra en navngitt kilde og er sammenlignet med den av NORDAP.')),
       ('open', ('Real data from open sources. It can be incomplete or out of date and is not the official publication.', 'Virkelige data fra åpne kilder. De kan være ufullstendige eller utdaterte og er ikke den offisielle publikasjonen.')),
       ('own', ('What you typed. NORDAP calculates with it but does not check it.', 'Det du har skrevet inn. NORDAP regner med det, men kontrollerer det ikke.')),
       ('nonav', ('Must not be used to plan or fly a real flight.', 'Må ikke brukes til å planlegge eller fly en virkelig flyging.'))]
for c, txt in LEG: body += '      <li><span>%s</span><span>%s</span></li>\n' % (pills([c]), T(*txt))
body += '    </ul>\n    <p class="note">%s <a href="quality.html">%s</a></p>\n  </section>' % (T('No status word here means reviewed by an outside expert. None of the content has had that review yet.', 'Ingen statusord her betyr gjennomgått av en ekstern fagperson. Ikke noe av innholdet har fått en slik gjennomgang ennå.'), T('How content is checked', 'Slik kontrolleres innholdet'))
nav = [(t[0], t[1]) for t in TOOLS] + [('words', ('Status words', 'Statusord'))]
navs = {'c172': ('Cessna 172', 'Cessna 172'), 'da42': ('DA42', 'DA42'), 'b200': ('King Air B200', 'King Air B200'), 'flows': ('Flow trainer', 'Flow-trener')}
nav = [(i, navs.get(i, t)) for i, t in nav]
T('NORDAP · Model profiles', 'NORDAP · Modellprofiler')
page('models.html', 'models', ('Model profiles', 'Modellprofiler'), ('NORDAP · Model profiles', 'NORDAP · Modellprofiler'),
     ('What each simulator and tool is built on, what works, what is simplified or left out, and what it must not be used for. NORDAP is a training aid next to approved theory and flight training. It is not an approved training organisation, not a qualified simulator and not a planning tool.',
      'Hva hver simulator og hvert verktøy bygger på, hva som virker, hva som er forenklet eller utelatt, og hva det ikke må brukes til. NORDAP er et hjelpemiddel ved siden av godkjent teori- og flyopplæring. Det er ikke en godkjent opplæringsorganisasjon, ikke en kvalifisert simulator og ikke et planleggingsverktøy.'),
     'What each NORDAP simulator and tool is built on, what works, what is simplified or left out, and what it must not be used for.', nav, body)

# ---------------------------------------------------------------- quality.html
D.clear()
def card(i, h, inner): return '  <section class="card" id="%s">\n    <h2>%s</h2>\n%s  </section>\n' % (i, T(*h), inner)
def ps(*pairs): return ''.join('    <p>%s</p>\n' % T(*p) for p in pairs)
def ul(cls, pairs): return '    <ul class="%s">\n%s    </ul>\n' % (cls, ''.join('      <li>%s</li>\n' % T(*p) for p in pairs))
body = card('who', ('Who writes and checks', 'Hvem som skriver og kontrollerer'), ps(
    ('NORDAP is built and written by one commercial pilot, with AI tools for the programming. There is no editorial staff and no panel of instructors.', 'NORDAP er bygget og skrevet av én pilot med trafikkflygersertifikat (CPL), med AI-verktøy til programmeringen. Det finnes ingen redaksjon og ikke noe panel av instruktører.'),
    ('Nothing on the site has been reviewed by an instructor or a subject expert outside NORDAP yet. When that happens, the page concerned will say who reviewed it and when.', 'Ikke noe på siden er gjennomgått av en instruktør eller fagperson utenfor NORDAP ennå. Når det skjer, vil den aktuelle siden si hvem som gjennomgikk den og når.')))
body += card('how', ('What is checked, and how', 'Hva som kontrolleres, og hvordan'), ul('sc-list', [
    ('Rules and phraseology are written from the published regulation, and the page names the rule.', 'Regler og fraseologi skrives ut fra publisert regelverk, og siden oppgir regelen.'),
    ('Data from outside sources is shown with its source. The sources and their licences are listed on the data sources page.', 'Data fra eksterne kilder vises med kilde. Kildene og lisensene står på siden om datakilder.'),
    ('The link to each country\'s official AIP is tested automatically every week.', 'Lenken til hvert lands offisielle AIP testes automatisk hver uke.'),
    ('Weather sources and the live site are tested automatically.', 'Værkilder og den publiserte siden testes automatisk.'),
    ('Every change to the code runs the automated tests before it is published. They test that the pages work, not that the content is right.', 'Hver endring i koden kjører de automatiske testene før den publiseres. De tester at sidene virker, ikke at innholdet er riktig.'),
    ('Control names in the flow trainer follow the label on the picture. Some have also been compared with public references.', 'Kontrollnavn i flow-treneren følger merkingen på bildet. Noen er også sammenlignet med offentlige referanser.')]))
body += card('not', ('What has not been checked', 'Hva som ikke er kontrollert'), ul('sc-list', [
    ('The flight models have not been compared with flight-test data or a certified model.', 'Flymodellene er ikke sammenlignet med testflygingsdata eller en sertifisert modell.'),
    ('Gate to gate, the IFR trainer and the briefings have not been reviewed by an instructor.', 'Gate to gate, IFR-treneren og briefingene er ikke gjennomgått av en instruktør.'),
    ('The labs have not been mapped to the EASA learning objectives one by one.', 'Labbene er ikke koblet til EASAs læringsmål én for én.'),
    ('No study has measured whether the tools improve learning. NORDAP makes no such claim.', 'Ingen undersøkelse har målt om verktøyene gir bedre læring. NORDAP påstår ikke det.'),
    ('The 3D cockpits and the maps have not been tested on every device.', '3D-cockpitene og kartene er ikke testet på alle enheter.')]) + '    <p class="note">%s <a href="models.html">%s</a></p>\n' % (T('What each tool is built on and what it leaves out is listed in the model profiles.', 'Hva hvert verktøy bygger på og hva det utelater, står i modellprofilene.'), T('Model profiles', 'Modellprofiler')))
body += card('errors', ('Found an error?', 'Funnet en feil?'), ps(
    ('The flow trainer has a button for a wrong or missing control name. For everything else, use the contact address on the about page. A confirmed error is corrected and entered in the change log.', 'Flow-treneren har en knapp for feil eller manglende kontrollnavn. For alt annet, bruk kontaktadressen på Om-siden. En bekreftet feil rettes og føres i endringsloggen.')) + '    <p><a class="btn" href="about.html#contact">%s</a></p>\n' % T('Contact', 'Kontakt'))
LOG = [('2026-11-17', ('The platform is renamed NORDAP, Nordic Aviation Platform. Model profiles, status words and this page are added.', 'Plattformen får navnet NORDAP, Nordic Aviation Platform. Modellprofiler, statusord og denne siden legges til.')),
       ('2026-11-17', ('Flow trainer: 34 ready-made flows from public handbooks and checklists, each with its source. Control names corrected against public references on the 787, the A350 and the Seneca.', 'Flow-trener: 34 ferdige flows fra offentlige håndbøker og sjekklister, hver med kilde. Kontrollnavn rettet mot offentlige referanser på 787, A350 og Seneca.')),
       ('2026-11-17', ('AIP link check: a portal that fails to answer once is tried again before it counts as dead.', 'AIP-lenkesjekk: en portal som ikke svarer én gang, prøves på nytt før den regnes som død.')),
       ('2026-11-16', ('Official AIP link for every European country, always the edition in force, with a weekly check.', 'Offisiell AIP-lenke for hvert europeisk land, alltid gjeldende utgave, med ukentlig kontroll.')),
       ('2026-11-15', ('DA42 values are marked as learning examples, not facts, in the briefing pack and in Flight Intelligence.', 'DA42-verdier er merket som læringseksempler, ikke fakta, i briefingpakken og i Flight Intelligence.')),
       ('2026-11-14', ('Virtual Labs: one template on all labs, with purpose, learning goal and what the model leaves out.', 'Virtual Labs: én mal på alle labber, med formål, læringsmål og hva modellen utelater.')),
       ('2026-11-13', ('Weather: METAR and TAF from MET Norway for Norwegian aerodromes, radar from the European radar network and satellite cloud on the Route Explorer map, each with its source.', 'Vær: METAR og TAF fra MET Norway for norske flyplasser, radar fra det europeiske radarnettverket og satellittskyer i Route Explorer-kartet, hver med kilde.'))]
body += card('log', ('Change log', 'Endringslogg'), '    <p class="lead">%s</p>\n    <ul class="cl">\n%s    </ul>\n    <p class="note">%s <a href="https://github.com/poppa4/birdbird/commits/main" rel="noopener">%s</a></p>\n' % (
    T('Changes to content, data and models. Changes to layout and wording are not listed.', 'Endringer i innhold, data og modeller. Endringer i utseende og ordlyd er ikke med.'),
    ''.join('      <li><time datetime="%s">%s</time><span>%s</span></li>\n' % (d, d, T(*t)) for d, t in LOG),
    T('The code is public. Every change, with its reason, is in the history.', 'Koden er åpen. Hver endring, med begrunnelse, står i historikken.'), T('Full history', 'Full historikk')))
T('NORDAP · Quality', 'NORDAP · Kvalitet')
page('quality.html', 'quality', ('How content is checked', 'Slik kontrolleres innholdet'), ('NORDAP · Quality', 'NORDAP · Kvalitet'),
     ('Who writes the content, what it is checked against, what has not been checked by anyone else, and what has changed.', 'Hvem som skriver innholdet, hva det kontrolleres mot, hva som ikke er kontrollert av andre, og hva som er endret.'),
     'Who writes the content on NORDAP, what it is checked against, what has not been reviewed by an outside expert, and a change log.',
     [('who', ('Who', 'Hvem')), ('how', ('What is checked', 'Hva som kontrolleres')), ('not', ('Not checked', 'Ikke kontrollert')), ('errors', ('Report an error', 'Meld en feil')), ('log', ('Change log', 'Endringslogg'))], body)
