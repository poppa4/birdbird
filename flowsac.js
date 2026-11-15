/* Birdbird – cockpit schematics for the flow trainer (flows.html).
   Our own drawings, not photographs: the panels of each cockpit in their usual places, roughly to scale, with every control
   named so a tap lands on "BAT 1" and not just on a spot in a picture. Not a substitute for the aircraft's documents: layouts
   vary between variants and operators, which is why a user can also put their own cockpit photo or PDF behind a flow.
   Panel: [name, x, y, w, h, items[], kind]  kind: undefined panel | 's' screen | 'l' levers | 'g' area (no switches drawn).
   Coordinates are in a 1000-wide canvas; h is the canvas height per aircraft. Pure data + an SVG string builder (runs in Node). */
(function (G) {
'use strict';
const A320 = { id: 'a320', name: 'Airbus A320', h: 1500, crew: 2, zones: [['Overhead', 10, 0, 980, 445], ['Glareshield', 10, 462, 980, 100], ['Main panel', 10, 572, 980, 335], ['Pedestal', 245, 915, 510, 580]], p: [
  ['ADIRS', 25, 12, 225, 108, ['IR 1', 'IR 3', 'IR 2', 'ADR 1', 'ADR 3', 'ADR 2', 'IR MODE 1', 'IR MODE 3', 'IR MODE 2']],
  ['FLT CTL 1', 25, 125, 225, 50, ['ELAC 1', 'SEC 1', 'FAC 1']],
  ['EVAC', 25, 180, 225, 36, ['EVAC COMMAND', 'HORN SHUT OFF']],
  ['EMER ELEC PWR', 25, 221, 225, 58, ['GEN 1 LINE', 'RAT & EMER GEN', 'EMER GEN TEST']],
  ['GPWS', 25, 284, 225, 40, ['GPWS SYS', 'G/S MODE', 'FLAP MODE', 'TERR']],
  ['RCDR', 25, 329, 225, 32, ['RCDR GND CTL', 'CVR TEST']],
  ['OXYGEN', 25, 366, 225, 34, ['CREW SUPPLY', 'MASK MAN ON']],
  ['CALLS', 25, 405, 225, 32, ['MECH', 'FWD', 'AFT', 'ALL']],
  ['FIRE', 262, 12, 476, 62, ['ENG 1 FIRE', 'APU FIRE', 'ENG 2 FIRE', 'ENG 1 AGENT', 'APU AGENT', 'ENG 2 AGENT', 'FIRE TEST 1', 'APU FIRE TEST', 'FIRE TEST 2']],
  ['HYD', 262, 79, 476, 46, ['ENG 1 PUMP', 'BLUE ELEC PUMP', 'PTU', 'ENG 2 PUMP', 'YELLOW ELEC PUMP']],
  ['FUEL', 262, 130, 476, 60, ['L TK PUMP 1', 'L TK PUMP 2', 'CTR TK PUMP 1', 'X FEED', 'MODE SEL', 'CTR TK PUMP 2', 'R TK PUMP 1', 'R TK PUMP 2']],
  ['ELEC', 262, 195, 476, 66, ['BAT 1', 'BAT 2', 'EXT PWR', 'GEN 1', 'APU GEN', 'GEN 2', 'BUS TIE', 'AC ESS FEED', 'IDG 1', 'IDG 2', 'GALY & CAB', 'COMMERCIAL']],
  ['AIR COND', 262, 266, 476, 56, ['PACK FLOW', 'HOT AIR', 'PACK 1', 'ENG 1 BLEED', 'APU BLEED', 'X BLEED', 'ENG 2 BLEED', 'PACK 2', 'TEMP CKPT', 'TEMP FWD CAB', 'TEMP AFT CAB', 'RAM AIR']],
  ['ANTI ICE', 262, 327, 236, 36, ['WING A-ICE', 'ENG 1 A-ICE', 'ENG 2 A-ICE', 'PROBE/WINDOW HEAT']],
  ['CABIN PRESS', 502, 327, 236, 36, ['MAN V/S CTL', 'PRESS MODE SEL', 'LDG ELEV', 'DITCHING']],
  ['EXT LT', 262, 368, 476, 36, ['STROBE', 'BEACON', 'WING LT', 'NAV & LOGO', 'RWY TURN OFF', 'LAND L', 'LAND R', 'NOSE LT']],
  ['APU', 262, 409, 150, 30, ['APU MASTER SW', 'APU START']],
  ['INT LT', 416, 409, 160, 30, ['OVHD INTEG LT', 'DOME', 'ANN LT']],
  ['SIGNS', 580, 409, 158, 30, ['SEAT BELTS', 'NO SMOKING', 'EMER EXIT LT']],
  ['WIPER', 750, 12, 225, 44, ['WIPER CPT', 'RAIN RPLNT', 'WIPER F/O']],
  ['FLT CTL 2', 750, 61, 225, 50, ['ELAC 2', 'SEC 2', 'SEC 3', 'FAC 2']],
  ['CARGO SMOKE', 750, 116, 225, 40, ['FWD DISCH', 'AFT DISCH', 'SMOKE TEST']],
  ['VENTILATION', 750, 161, 225, 40, ['BLOWER', 'EXTRACT', 'CAB FANS']],
  ['ENG MAN START', 750, 206, 225, 38, ['ENG 1 MAN START', 'ENG 2 MAN START', 'N1 MODE']],
  ['CARGO HEAT', 750, 249, 225, 36, ['AFT ISOL VALVE', 'CARGO HOT AIR']],
  ['ADIRS / NAV OVERHEAD (F/O)', 750, 290, 225, 147, [], 'g'],
  ['EFIS CPT', 20, 472, 185, 82, ['QNH CPT', 'FD CPT', 'LS CPT', 'CSTR', 'WPT', 'VOR.D', 'NDB', 'ARPT', 'ND MODE CPT', 'ND RANGE CPT']],
  ['MASTER CPT', 209, 472, 46, 82, ['MASTER WARN CPT', 'MASTER CAUT CPT']],
  ['FCU', 260, 472, 480, 82, ['SPD/MACH', 'SPD', 'HDG V/S - TRK FPA', 'HDG', 'LOC', 'AP 1', 'AP 2', 'A/THR', 'ALT', 'EXPED', 'APPR', 'METRIC ALT', 'V/S']],
  ['MASTER F/O', 745, 472, 46, 82, ['MASTER WARN F/O', 'MASTER CAUT F/O']],
  ['EFIS F/O', 795, 472, 185, 82, ['QNH F/O', 'FD F/O', 'LS F/O', 'ND MODE F/O', 'ND RANGE F/O']],
  ['PFD CPT', 20, 582, 180, 175, [], 's'], ['ND CPT', 205, 582, 180, 175, [], 's'],
  ['E/WD (upper ECAM)', 400, 582, 200, 155, [], 's'],
  ['ND F/O', 615, 582, 180, 175, [], 's'], ['PFD F/O', 800, 582, 180, 175, [], 's'],
  ['CPT LOWER PANEL', 20, 765, 365, 135, ['LOUDSPEAKER CPT', 'PFD/ND XFR CPT', 'CONSOLE/FLOOR LT', 'CHRONO CPT']],
  ['STANDBY (ISIS)', 400, 742, 62, 78, [], 's'],
  ['LDG GEAR', 400, 825, 62, 75, ['GEAR LEVER'], 'l'],
  ['SD (lower ECAM)', 468, 742, 132, 158, [], 's'],
  ['BRAKES', 615, 765, 180, 135, ['A/SKID & N/W STRG', 'AUTO BRK LO', 'AUTO BRK MED', 'AUTO BRK MAX', 'BRAKE PRESS', 'CLOCK']],
  ['F/O LOWER PANEL', 800, 765, 180, 135, ['LOUDSPEAKER F/O', 'PFD/ND XFR F/O']],
  ['MCDU 1', 255, 925, 240, 138, [], 's'], ['MCDU 2', 505, 925, 240, 138, [], 's'],
  ['ECAM CONTROL', 255, 1068, 490, 56, ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL', 'STS', 'RCL', 'CLR', 'EMER CANC', 'T.O CONFIG']],
  ['SWITCHING', 255, 1128, 490, 26, ['ATT HDG', 'AIR DATA', 'EIS DMC', 'ECAM/ND XFR']],
  ['SPEED BRAKE', 255, 1160, 42, 140, ['SPEED BRAKE'], 'l'],
  ['THRUST LEVERS', 302, 1160, 170, 172, ['THR LVR 1', 'THR LVR 2', 'A/THR DISC'], 'l'],
  ['PITCH TRIM', 478, 1160, 72, 172, ['PITCH TRIM WHEEL'], 'l'],
  ['FLAPS', 556, 1160, 189, 130, ['FLAPS LEVER'], 'l'],
  ['PARKING BRK', 556, 1295, 189, 37, ['PARKING BRAKE']],
  ['ENGINE', 302, 1337, 443, 50, ['ENG MASTER 1', 'ENG MODE SEL', 'ENG MASTER 2']],
  ['RMP 1', 255, 1392, 240, 46, [], 's'], ['RMP 2', 505, 1392, 240, 46, [], 's'],
  ['ATC / TCAS', 255, 1443, 490, 45, ['XPDR', 'TCAS MODE', 'WX RADAR']]
]};
const DA42 = { id: 'da42', name: 'Diamond DA42 (G1000)', h: 1000, crew: 1, zones: [['Instrument panel', 10, 50, 980, 525], ['Centre console', 300, 590, 400, 400]], p: [
  ['CIRCUIT BREAKERS', 18, 62, 40, 500, [], 'g'],
  ['PFD', 66, 70, 370, 290, [], 's'],
  ['STANDBY', 444, 70, 112, 290, ['STBY ASI', 'STBY ATT', 'STBY ALT']],
  ['MFD', 564, 70, 370, 290, [], 's'],
  ['AUDIO PANEL', 444, 366, 112, 66, [], 's'],
  ['SWITCH PANEL', 66, 370, 370, 196, ['ELECTRIC MASTER', 'AVIONIC MASTER', 'ENGINE MASTER L', 'ENGINE MASTER R', 'ESS BUS', 'ECU TEST L', 'ECU TEST R', 'ECU SWAP L', 'ECU SWAP R', 'FUEL PUMP L', 'FUEL PUMP R', 'PITOT HEAT', 'STROBE', 'NAV LT', 'LANDING LT', 'TAXI LT', 'INSTR LT', 'FLOOD LT', 'START L', 'START R']],
  ['GEAR', 444, 438, 112, 128, ['GEAR LEVER', 'EMER GEAR'], 'l'],
  ['RIGHT PANEL', 564, 370, 370, 196, ['FLAPS', 'ALT AIR L', 'ALT AIR R', 'EMER BATTERY', 'ELT', 'DEFROST', 'CABIN HEAT', 'VENT', 'MIC/PTT']],
  ['POWER LEVERS', 330, 600, 340, 170, ['POWER LEVER L', 'POWER LEVER R'], 'l'],
  ['FUEL SELECTOR L', 330, 780, 165, 100, ['FUEL SEL L (ON/X-FEED/OFF)']],
  ['FUEL SELECTOR R', 505, 780, 165, 100, ['FUEL SEL R (ON/X-FEED/OFF)']],
  ['PARKING BRAKE', 330, 890, 165, 90, ['PARKING BRAKE']],
  ['TRIM', 505, 890, 165, 90, ['ELEVATOR TRIM', 'RUDDER TRIM']]
]};
const PA34 = { id: 'pa34', name: 'Piper PA-34 Seneca', h: 1000, crew: 1, zones: [['Overhead', 250, 0, 500, 46], ['Instrument panel', 10, 52, 980, 520], ['Quadrant and floor', 190, 585, 620, 405]], p: [
  ['OVERHEAD', 260, 6, 480, 34, ['ELEVATOR TRIM CRANK', 'OVERHEAD LIGHTS', 'VENT']],
  ['FLIGHT INSTRUMENTS', 30, 62, 370, 260, ['ASI', 'ATTITUDE', 'ALTIMETER', 'TURN COORD', 'HSI / DI', 'VSI']],
  ['ANNUNCIATOR PANEL', 30, 328, 370, 40, [], 's'],
  ['SWITCH PANEL', 30, 374, 370, 150, ['BATTERY MASTER', 'ALT L', 'ALT R', 'MAG L1', 'MAG L2', 'MAG R1', 'MAG R2', 'START L', 'START R', 'PRIMER L', 'PRIMER R', 'FUEL PUMP L', 'FUEL PUMP R', 'AVIONICS MASTER', 'PITOT HEAT', 'STROBE', 'NAV LT', 'LANDING LT', 'TAXI LT', 'DE-ICE']],
  ['PARKING BRAKE', 30, 530, 150, 36, ['PARKING BRAKE']],
  ['AVIONICS STACK', 410, 62, 200, 370, ['AUDIO PANEL', 'GPS / COM 1', 'NAV / COM 2', 'ADF', 'TRANSPONDER', 'AUTOPILOT'], 's'],
  ['GEAR', 410, 438, 90, 128, ['GEAR SELECTOR', 'EMER GEAR EXT'], 'l'],
  ['ENGINE INSTRUMENTS', 620, 62, 350, 260, ['MANIFOLD PRESS', 'RPM', 'FUEL FLOW', 'EGT', 'OIL T&P L', 'OIL T&P R', 'CHT', 'FUEL QTY', 'AMMETER', 'VACUUM / GYRO']],
  ['COWL FLAPS', 620, 328, 350, 46, ['COWL FLAP L', 'COWL FLAP R']],
  ['CIRCUIT BREAKERS', 620, 380, 350, 186, [], 'g'],
  ['THROTTLE QUADRANT', 400, 595, 200, 190, ['THROTTLES', 'PROPELLERS', 'MIXTURES', 'FRICTION'], 'l'],
  ['ALTERNATE AIR', 610, 595, 190, 60, ['ALT AIR L', 'ALT AIR R']],
  ['RUDDER TRIM', 200, 595, 190, 60, ['RUDDER TRIM']],
  ['FUEL SELECTOR L', 330, 800, 160, 100, ['FUEL SEL L (ON/OFF/X-FEED)']],
  ['FUEL SELECTOR R', 510, 800, 160, 100, ['FUEL SEL R (ON/OFF/X-FEED)']],
  ['FLAP LEVER', 690, 800, 110, 180, ['FLAP LEVER'], 'l']
]};
const B200 = { id: 'b200', name: 'Beechcraft King Air B200', h: 1300, crew: 2, zones: [['Overhead', 190, 0, 620, 120], ['Glareshield', 10, 132, 980, 106], ['Main panel', 10, 248, 980, 400], ['Subpanels', 10, 655, 980, 210], ['Pedestal', 320, 875, 360, 420]], p: [
  ['OVERHEAD LIGHTS', 200, 10, 600, 100, ['MASTER PANEL LT', 'PILOT FLIGHT LT', 'COPILOT FLIGHT LT', 'ENG INSTR LT', 'AVIONICS LT', 'OVERHEAD FLOOD', 'CABIN LT', 'NO SMOKE / FSB']],
  ['FIRE L / WARNING', 20, 142, 230, 88, ['FIRE PULL L', 'EXTINGUISHER L', 'MASTER WARNING', 'MASTER CAUTION']],
  ['AUTOPILOT', 270, 142, 460, 88, ['HDG', 'NAV', 'APR', 'BC', 'ALT', 'ALT SEL', 'VS', 'IAS', 'DSC', 'CLM', 'AP ENG', 'YD ENG']],
  ['FIRE R / WARNING', 750, 142, 230, 88, ['FIRE PULL R', 'EXTINGUISHER R', 'MASTER WARNING F/O', 'MASTER CAUTION F/O']],
  ['PILOT INSTRUMENTS', 20, 258, 310, 380, ['ADI', 'HSI', 'AIRSPEED', 'ALTIMETER', 'VSI', 'RMI', 'TURN & SLIP', 'CLOCK']],
  ['ENGINE INSTRUMENTS', 340, 258, 320, 290, ['TORQUE L', 'TORQUE R', 'ITT L', 'ITT R', 'PROP RPM L', 'PROP RPM R', 'N1 L', 'N1 R', 'FUEL FLOW L', 'FUEL FLOW R', 'OIL P/T L', 'OIL P/T R']],
  ['ANNUNCIATOR PANEL', 340, 556, 320, 82, [], 's'],
  ['COPILOT INSTRUMENTS', 670, 258, 310, 380, ['ADI F/O', 'HSI F/O', 'AIRSPEED F/O', 'ALTIMETER F/O', 'VSI F/O', 'WEATHER RADAR']],
  ['PILOT LEFT SUBPANEL', 20, 665, 310, 190, ['BATTERY', 'GEN L', 'GEN R', 'IGN & ENG START L', 'IGN & ENG START R', 'AUTO-IGNITION L', 'AUTO-IGNITION R', 'AVIONICS MASTER', 'STANDBY PUMP L', 'STANDBY PUMP R', 'CROSSFEED', 'LANDING LT', 'TAXI LT', 'RECOG LT', 'NAV LT', 'BEACON', 'STROBE', 'ICE LT']],
  ['PILOT RIGHT SUBPANEL', 340, 665, 155, 190, ['GEAR HANDLE', 'GEAR WARN SILENCE', 'ALTERNATE GEAR'], 'l'],
  ['COPILOT LEFT SUBPANEL', 505, 665, 155, 190, ['PROP SYNC', 'AUTOFEATHER', 'RUDDER BOOST', 'PROP GOV TEST']],
  ['COPILOT RIGHT SUBPANEL', 670, 665, 310, 190, ['ENG ANTI-ICE L', 'ENG ANTI-ICE R', 'PROP DEICE', 'SURFACE DEICE', 'PITOT HEAT L', 'PITOT HEAT R', 'STALL WARN HEAT', 'WINDSHIELD HEAT', 'FUEL VENT HEAT', 'BLEED AIR L', 'BLEED AIR R', 'CABIN TEMP', 'CABIN PRESS', 'CABIN ALT/RATE', 'PRESS DUMP/TEST']],
  ['FUEL PANEL (L SIDEWALL)', 20, 875, 150, 200, ['FUEL QTY', 'FIREWALL VALVE L', 'FIREWALL VALVE R', 'AUX TRANSFER']],
  ['PARKING BRAKE', 20, 1085, 150, 50, ['PARKING BRAKE']],
  ['POWER LEVERS', 330, 885, 110, 200, ['POWER LEVER L', 'POWER LEVER R'], 'l'],
  ['PROP LEVERS', 445, 885, 110, 200, ['PROP LEVER L', 'PROP LEVER R'], 'l'],
  ['CONDITION LEVERS', 560, 885, 110, 200, ['CONDITION LEVER L', 'CONDITION LEVER R'], 'l'],
  ['TRIM', 330, 1095, 110, 190, ['ELEVATOR TRIM', 'AILERON TRIM', 'RUDDER TRIM'], 'l'],
  ['RADIO PANELS', 445, 1095, 110, 190, [], 's'],
  ['FLAPS', 560, 1095, 110, 110, ['FLAP LEVER'], 'l'],
  ['FRICTION LOCKS', 560, 1215, 110, 70, ['FRICTION LOCKS']]
]};
const C172 = { id: 'c172', name: 'Cessna 172', h: 900, crew: 1, zones: [['Instrument panel', 10, 40, 980, 540], ['Floor', 380, 600, 280, 290]], p: [
  ['FLIGHT INSTRUMENTS', 30, 55, 370, 265, ['AIRSPEED', 'ATTITUDE', 'ALTIMETER', 'TURN COORD', 'HEADING / HSI', 'VSI']],
  ['ENGINE INSTRUMENTS', 30, 326, 370, 92, ['TACHOMETER', 'FUEL QTY', 'OIL TEMP/PRESS', 'EGT / FUEL FLOW', 'VAC / AMPS']],
  ['RADIO STACK', 410, 55, 210, 363, ['AUDIO PANEL', 'COM/NAV 1', 'COM/NAV 2 / GPS', 'TRANSPONDER', 'AUTOPILOT'], 's'],
  ['RIGHT PANEL', 630, 55, 340, 363, ['ELT', 'HOBBS', 'CLOCK', 'GLOVE BOX'], 'g'],
  ['SWITCHES', 30, 424, 370, 100, ['MAGNETOS / START', 'MASTER ALT', 'MASTER BAT', 'AVIONICS BUS 1', 'AVIONICS BUS 2', 'BEACON', 'LANDING LT', 'TAXI LT', 'NAV LT', 'STROBE', 'PITOT HEAT', 'FUEL PUMP']],
  ['ENGINE CONTROLS', 410, 424, 210, 100, ['CARB HEAT', 'THROTTLE', 'MIXTURE'], 'l'],
  ['FLAPS', 630, 424, 120, 100, ['WING FLAPS'], 'l'],
  ['CIRCUIT BREAKERS', 760, 424, 210, 100, [], 'g'],
  ['PRIMER', 30, 530, 100, 42, ['PRIMER']],
  ['CABIN', 140, 530, 140, 42, ['CABIN HEAT', 'CABIN AIR']],
  ['PARKING BRAKE', 290, 530, 110, 42, ['PARKING BRAKE']],
  ['TRIM WHEEL', 400, 610, 110, 160, ['ELEVATOR TRIM'], 'l'],
  ['FUEL SHUTOFF', 520, 610, 130, 160, ['FUEL SHUTOFF']],
  ['FUEL SELECTOR', 400, 780, 250, 100, ['FUEL SELECTOR (BOTH/L/R/OFF)']]
]};
const LIST = [A320, B200, PA34, DA42, C172];

/* layout: the targets (named controls) of an aircraft, with their rectangles; panels without items are one target */
function targets(ac) { if (ac._t) return ac._t; const out = [];
  ac.p.forEach(([n, x, y, w, h, it, k]) => {
    if (!it || !it.length) { out.push({ id: n, name: n, panel: n, x, y, w, h, k: k || 'g', whole: true }); return; }
    // a low panel keeps its name on the left and its controls in one row; otherwise the name on top and the controls in a grid
    const low = h < 46, tw = low ? Math.min(w * 0.42, n.length * 6.4 + 12) : 0, X0 = x + 4 + tw, W = w - 8 - tw, top = low ? y + 3 : y + 18, H = low ? h - 5 : h - 22;
    const cnt = it.length, ratio = W / Math.max(10, H);
    let cols = low || k === 'l' ? cnt : Math.max(1, Math.min(cnt, Math.round(Math.sqrt(cnt * ratio * 0.9)))); const rows = Math.ceil(cnt / cols);
    const cw = W / cols, rh = H / rows;
    it.forEach((name, i) => { const c = i % cols, r = Math.floor(i / cols); out.push({ id: n + '|' + name, name, panel: n, x: X0 + c * cw + 2, y: top + r * rh + 1, w: cw - 4, h: rh - 3, k: k || 'p' }); });
  });
  return (ac._t = out); }
function byId(ac, id) { return targets(ac).find(t => t.id === id) || null; }
function hit(ac, x, y, pad) { pad = pad || 0; let best = null, bd = 1e9;
  targets(ac).forEach(t => { if (x >= t.x - pad && x <= t.x + t.w + pad && y >= t.y - pad && y <= t.y + t.h + pad) { const d = t.w * t.h * (t.whole ? 4 : 1); if (d < bd) { bd = d; best = t; } } });
  return best; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* the drawing: zone backgrounds, panels, controls with their names */
function svg(ac, o) { o = o || {}; const T = targets(ac), out = [];
  out.push(`<rect x="0" y="0" width="1000" height="${ac.h}" fill="#1E2328"/>`);
  (ac.zones || []).forEach(([n, x, y, w, h]) => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#2A3036"/><text x="${x + w - 8}" y="${y + h - 6}" text-anchor="end" class="fz">${esc(n.toUpperCase())}</text>`));
  ac.p.forEach(([n, x, y, w, h, it, k]) => { const scr = k === 's', g = k === 'g';
    out.push(`<g class="fp"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${scr ? '#0E1114' : g ? '#323941' : '#3A424B'}" stroke="#56606B" stroke-width="1.2"${g ? ' stroke-dasharray="4 4"' : ''}/>` +
      `<text x="${x + 6}" y="${it && it.length && h < 46 ? y + h / 2 + 4 : y + 13}" class="fpn${scr ? ' scr' : ''}">${esc(n)}</text></g>`); });
  T.forEach(t => { if (t.whole) return; const lv = t.k === 'l';
    out.push(`<g class="ft" data-t="${esc(t.id)}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="3" fill="${lv ? '#4B5560' : '#454E58'}" stroke="#6B7682" stroke-width=".8"/>` +
      (t.h < 24 ? '' : lv ? `<rect x="${t.x + t.w / 2 - 5}" y="${t.y + 4}" width="10" height="${Math.max(6, t.h * 0.45)}" rx="3" fill="#C9CED3"/>` : `<rect x="${t.x + t.w / 2 - 6}" y="${t.y + 3}" width="12" height="${Math.min(9, t.h * 0.3)}" rx="2" fill="#9AA5B1"/>`) +
      `<text x="${t.x + t.w / 2}" y="${t.y + t.h - 4}" text-anchor="middle" class="ftn" style="font-size:${Math.max(6.5, Math.min(11, t.w / Math.max(4, t.name.length) * 1.75)).toFixed(1)}px">${esc(t.name)}</text></g>`); });
  return out.join(''); }
const API = { list: LIST, get: id => LIST.find(a => a.id === id) || null, targets, byId, hit, svg };
if (typeof module === 'object' && module.exports) module.exports = API; else G.BBFLOWAC = API;
})(typeof window !== 'undefined' ? window : globalThis);
