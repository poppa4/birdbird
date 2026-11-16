/* Birdbird – cockpit schematics for the flow trainer (flows.html).
   Our own drawings, not photographs: the panels of each cockpit in their usual places, roughly to scale, with every control
   named so a tap lands on "BAT 1" and not just on a spot in a picture. Not a substitute for the aircraft's documents: layouts
   vary between variants and operators, which is why a user can also put their own cockpit photo or PDF behind a flow.
   Panel: [name, x, y, w, h, items[], kind]  kind: undefined panel | 's' screen | 'l' levers | 'g' area (no switches drawn).
   Coordinates are in a 1000-wide canvas; h is the canvas height per aircraft. Pure data + an SVG string builder (runs in Node). */
(function (G) {
'use strict';
/* A320 overhead, traced control by control from a photo taken square on to the panel (Olivier Cleynen, CC BY-SA 3.0,
   commons.wikimedia.org/wiki/File:Overhead_panel_of_A320_aircraft_at_parking_stand.jpg). Numbers are in the photo's own frame
   (1000 units wide); ovp() maps them into the drawing, so every control sits where it does in the aircraft, at its real size.
   The FIRE panel and the top of ADIRS and HYD are above the photo's edge and are laid out from the panel's known arrangement.
   Item: [name, x, y, w, h, kind]; kinds: pb push-button, pbr red guard, pbk black guard, knob, tg toggle, rnd round button,
   disp display, ind light, keys keypad. Deco: ['t', text, x, y, size], ['l', x1, y1, x2, y2, colour], ['b', text, x, y, w, h]. */
const OVS = 0.588, OVX = x => +(228 + (x - 55) * OVS).toFixed(1), OVY = y => +(156 + (y + 100) * OVS).toFixed(1), OVN = v => +(v * OVS).toFixed(1);
const ovp = (n, x0, y0, x1, y1, items, deco) => [n, OVX(x0), OVY(y0), OVN(x1 - x0), OVN(y1 - y0),
  items.map(([nm, x, y, w, h, kd]) => ({ n: nm, kd: kd || 'pb', b: [OVX(x), OVY(y), OVN(w), OVN(h)] })), items.length ? 'a' : 'g',
  (deco || []).map(d => d[0] === 't' ? ['t', d[1], OVX(d[2]), OVY(d[3]), d[4] || 5] : d[0] === 'l' ? ['l', OVX(d[1]), OVY(d[2]), OVX(d[3]), OVY(d[4]), d[5] || '#7FD9A0'] : ['b', d[1], OVX(d[2]), OVY(d[3]), OVN(d[4]), OVN(d[5])])];
const T22 = (n, cx, cy) => [n, cx - 11, cy - 11, 22, 22, 'tg'];
const A320_OVHD = [
  ovp('ADIRS', 62, -98, 280, 104, [['ADIRS DISPLAY', 78, -84, 62, 18, 'disp'], ['ON BAT', 96, -58, 26, 10, 'ind'], ['DATA SEL', 152, -74, 22, 22, 'knob'], ['SYS SEL', 186, -74, 22, 22, 'knob'], ['ADIRS KEYPAD', 222, -90, 50, 44, 'keys'],
    ['IR 1', 80, -28, 28, 24], ['IR 3', 149, -29, 28, 24], ['IR 2', 216, -30, 28, 24], ['IR MODE 1', 77, 26, 34, 34, 'knob'], ['IR MODE 3', 146, 25, 34, 34, 'knob'], ['IR MODE 2', 213, 24, 34, 34, 'knob'],
    ['ADR 1', 85, 68, 32, 32], ['ADR 3', 153, 67, 32, 32], ['ADR 2', 220, 66, 32, 32]], [['t', 'ADIRS', 190, -40, 5], ['l', 72, 60, 270, 57, '#C9D2DA']]),
  ovp('FLT CTL 1', 68, 106, 286, 173, [['ELAC 1', 140, 131, 34, 32], ['SEC 1', 181, 131, 33, 32], ['FAC 1', 222, 130, 34, 31]], [['t', 'FLT CTL', 176, 118, 5.5]]),
  ovp('EVAC', 78, 175, 290, 236, [['EVAC COMMAND', 142, 192, 36, 36], ['HORN SHUT OFF', 193, 197, 26, 26, 'rnd'], ['CAPT & PURS', 243, 200, 22, 22, 'tg']], [['t', 'EVAC', 110, 208, 4.6]]),
  ovp('EMER ELEC PWR', 88, 238, 292, 304, [['EMER GEN TEST', 106, 253, 36, 49, 'pbk'], ['GEN 1 LINE', 156, 268, 29, 26], ['RAT & EMER GEN', 200, 266, 28, 27], ['EMER GEN MAN ON', 228, 251, 32, 51, 'pbr']], [['t', 'EMER ELEC PWR', 186, 243, 4.4], ['l', 148, 252, 150, 296, '#C9D2DA']]),
  ovp('GPWS', 100, 306, 296, 362, [['TERR', 119, 335, 27, 24], ['GPWS SYS', 156, 334, 29, 24], ['G/S MODE', 192, 332, 29, 26], ['FLAP MODE', 224, 331, 28, 26], ['LDG FLAP 3', 256, 331, 28, 26]], [['t', 'GPWS', 182, 316, 5.5], ['l', 150, 325, 153, 360, '#C9D2DA']]),
  ovp('RCDR', 108, 364, 298, 408, [['RCDR GND CTL', 170, 379, 29, 25], ['CVR ERASE', 215, 378, 24, 24, 'rnd'], ['CVR TEST', 259, 377, 24, 24, 'rnd']], [['t', 'RCDR', 140, 388, 4.4]]),
  ovp('OXYGEN', 115, 410, 300, 468, [['MASK MAN ON', 173, 422, 31, 43, 'pbr'], ['PASSENGER', 220, 435, 27, 24], ['CREW SUPPLY', 263, 433, 27, 24]], [['t', 'OXYGEN', 146, 440, 4.4], ['l', 254, 420, 257, 462, '#C9D2DA']]),
  ovp('CALLS', 122, 470, 304, 508, [['MECH', 143, 484, 24, 24, 'rnd'], ['FWD', 208, 482, 24, 24, 'rnd'], ['AFT', 239, 481, 24, 24, 'rnd'], ['EMER', 268, 476, 30, 29, 'pbk']], [['t', 'CALLS', 186, 476, 4]]),
  ovp('WIPER CPT', 130, 510, 320, 602, [['RAIN RPLNT CPT', 190, 522, 24, 24, 'rnd'], ['WIPER CPT', 245, 528, 34, 34, 'knob']], []),
  ovp('FIRE', 322, -98, 746, -24, [['ENG 1 FIRE TEST', 338, -66, 20, 20, 'rnd'], ['ENG 1 AGENT 1', 366, -72, 26, 26], ['ENG 1 FIRE', 398, -80, 32, 40, 'pbr'], ['ENG 1 AGENT 2', 436, -72, 26, 26],
    ['APU AGENT', 484, -72, 26, 26], ['APU FIRE', 516, -80, 32, 40, 'pbr'], ['APU FIRE TEST', 556, -66, 20, 20, 'rnd'],
    ['ENG 2 AGENT 1', 600, -72, 26, 26], ['ENG 2 FIRE', 632, -80, 32, 40, 'pbr'], ['ENG 2 AGENT 2', 670, -72, 26, 26], ['ENG 2 FIRE TEST', 708, -66, 20, 20, 'rnd']],
    [['t', 'ENG 1', 414, -89, 4.5], ['t', 'APU', 532, -89, 4.5], ['t', 'ENG 2', 648, -89, 4.5], ['t', 'FIRE', 332, -86, 4.5]]),
  ovp('HYD', 322, -22, 746, 71, [['ENG 1 PUMP', 363, 36, 31, 32], ['RAT MAN ON', 432, 14, 33, 53, 'pbr'], ['BLUE ELEC PUMP', 504, 31, 34, 36], ['PTU', 579, 2, 33, 32], ['ENG 2 PUMP', 650, 36, 31, 32], ['YELLOW ELEC PUMP', 699, 25, 32, 34]],
    [['l', 378, 26, 378, -14, '#7FD9A0'], ['b', 'GREEN', 362, -18, 32, 9], ['l', 521, 20, 521, -6, '#7FB6F0'], ['b', 'BLUE', 505, -18, 32, 9], ['l', 665, 26, 665, -14, '#E8D36A'], ['l', 715, 16, 715, 2, '#E8D36A'], ['l', 665, 2, 715, 2, '#E8D36A'], ['b', 'YELLOW', 649, -18, 34, 9],
      ['l', 465, 6, 521, 6, '#7FB6F0'], ['l', 378, -4, 579, -4, '#7FD9A0'], ['l', 612, 12, 665, 12, '#E8D36A'], ['t', 'HYD', 336, -8, 4.5]]),
  ovp('FUEL', 322, 73, 746, 166, [['X FEED', 505, 83, 32, 31], ['L TK PUMP 1', 348, 129, 30, 29], ['L TK PUMP 2', 387, 129, 30, 29], ['CTR TK PUMP 1', 466, 129, 30, 29], ['MODE SEL', 506, 129, 31, 30], ['CTR TK PUMP 2', 547, 129, 29, 29], ['R TK PUMP 1', 625, 129, 31, 29], ['R TK PUMP 2', 665, 129, 29, 29]],
    [['b', 'ENG 1', 364, 81, 32, 10], ['b', 'APU', 460, 81, 33, 10], ['b', 'ENG 2', 648, 81, 30, 10], ['l', 382, 102, 505, 102], ['l', 537, 102, 663, 102], ['l', 382, 91, 382, 112], ['l', 663, 91, 663, 112], ['l', 477, 91, 477, 102],
      ['l', 347, 113, 418, 113], ['l', 624, 113, 695, 113], ['l', 481, 102, 481, 117], ['l', 561, 102, 561, 117], ['l', 463, 117, 500, 117], ['l', 543, 117, 580, 117], ['t', 'L TK PUMPS', 382, 121, 3.6], ['t', 'R TK PUMPS', 660, 121, 3.6], ['t', 'FUEL', 336, 84, 4.5]]),
  ovp('ELEC', 322, 170, 748, 312, [['BAT 1 VOLT', 420, 190, 49, 27, 'disp'], ['BAT 1', 476, 189, 29, 27], ['BAT 2', 506, 189, 28, 27], ['BAT 2 VOLT', 541, 190, 49, 27, 'disp'], ['AC ESS FEED', 596, 203, 30, 29], ['GALY & CAB', 327, 220, 29, 28], ['BUS TIE', 506, 253, 28, 27],
    ['IDG 1', 328, 270, 32, 34, 'pbr'], ['GEN 1', 376, 275, 28, 26], ['APU GEN', 451, 275, 28, 26], ['EXT PWR', 561, 275, 29, 26], ['GEN 2', 636, 275, 29, 26], ['IDG 2', 680, 270, 32, 34, 'pbr']],
    [['b', 'DC BUS 1', 367, 183, 37, 9], ['b', 'DC BUS 2', 638, 183, 37, 9], ['b', 'AC BUS 1', 369, 221, 37, 9], ['b', 'AC ESS BUS', 500, 221, 44, 9], ['b', 'AC BUS 2', 636, 221, 37, 9],
      ['l', 387, 192, 387, 221], ['l', 387, 230, 387, 270], ['l', 655, 192, 655, 221], ['l', 655, 230, 655, 270], ['l', 406, 225, 500, 225], ['l', 544, 225, 596, 225], ['l', 626, 225, 636, 225],
      ['l', 390, 259, 506, 259], ['l', 534, 259, 652, 259], ['l', 360, 288, 376, 288], ['l', 665, 288, 680, 288], ['l', 479, 288, 512, 288], ['l', 512, 288, 512, 280], ['l', 529, 280, 529, 288], ['l', 529, 288, 561, 288], ['t', 'ELEC', 336, 180, 4.5]]),
  ovp('AIR COND', 322, 314, 748, 452, [['PACK FLOW', 334, 341, 34, 34, 'knob'], ['TEMP CKPT', 433, 336, 38, 38, 'knob'], ['TEMP FWD CAB', 501, 336, 38, 38, 'knob'], ['TEMP AFT CAB', 569, 336, 38, 38, 'knob'], ['HOT AIR', 665, 340, 29, 26],
    ['PACK 1', 332, 383, 28, 25], ['PACK 2', 680, 384, 28, 25], ['ENG 1 BLEED', 382, 419, 28, 26], ['RAM AIR', 446, 416, 30, 30, 'pbk'], ['APU BLEED', 505, 419, 28, 27], ['X BLEED', 565, 419, 34, 34, 'knob'], ['ENG 2 BLEED', 628, 420, 28, 26]],
    [['l', 393, 378, 646, 378], ['l', 393, 398, 565, 398], ['l', 599, 398, 646, 398], ['l', 393, 378, 393, 419], ['l', 646, 378, 646, 420], ['l', 460, 398, 460, 416], ['l', 519, 398, 519, 419], ['l', 452, 378, 452, 374], ['l', 520, 378, 520, 374], ['l', 588, 378, 588, 374],
      ['b', 'PACK 1', 379, 384, 30, 8], ['b', 'PACK 2', 630, 385, 30, 8], ['t', 'AIR COND', 340, 324, 4.5]]),
  ovp('ANTI ICE', 322, 456, 490, 512, [['WING A-ICE', 330, 479, 28, 23], ['ENG 1 A-ICE', 412, 479, 28, 23], ['ENG 2 A-ICE', 451, 479, 27, 23]], [['t', 'ANTI ICE', 384, 463, 4.6], ['l', 363, 472, 365, 508, '#C9D2DA'], ['l', 404, 472, 406, 508, '#C9D2DA']]),
  ovp('PROBE/WINDOW HEAT', 492, 456, 548, 512, [['PROBE/WINDOW HEAT', 505, 480, 27, 23]], [['t', 'PROBE/WINDOW', 520, 463, 3.6], ['t', 'HEAT', 520, 471, 3.6]]),
  ovp('CABIN PRESS', 550, 456, 748, 512, [['MAN V/S CTL', 556, 479, 22, 22, 'tg'], ['PRESS MODE SEL', 591, 480, 27, 23], ['LDG ELEV', 637, 481, 26, 26, 'knob'], ['DITCHING', 676, 475, 31, 30, 'pbk']], [['t', 'CABIN PRESS', 650, 462, 4.4]]),
  ovp('EXT LT', 322, 516, 492, 604, [T22('STROBE', 345, 540), T22('BEACON', 381, 540), T22('WING LT', 424, 540), T22('NAV & LOGO', 467, 540), T22('RWY TURN OFF', 351, 579), T22('LAND L', 388, 579), T22('LAND R', 430, 579), T22('NOSE LT', 468, 579)], [['t', 'EXT LT', 407, 519, 3.8]]),
  ovp('APU', 494, 516, 542, 604, [['APU MASTER SW', 505, 536, 26, 23], ['APU START', 505, 570, 26, 21]], [['t', 'APU', 518, 523, 5]]),
  ovp('INT LT', 544, 516, 714, 560, [['OVHD INTEG LT', 549, 527, 26, 26, 'knob'], T22('ICE IND & STBY COMPASS', 603, 537), T22('DOME', 638, 537), T22('ANN LT', 681, 535)], [['t', 'INT LT', 660, 519, 3.6]]),
  ovp('SIGNS', 544, 562, 714, 604, [T22('SEAT BELTS', 559, 580), T22('NO SMOKING', 594, 580), ['EXIT LT OFF', 623, 571, 25, 20, 'ind'], T22('EMER EXIT LT', 671, 578)], [['t', 'SIGNS', 628, 565, 3.8]]),
  ovp('BLANK PANELS (F/O)', 760, -98, 978, 115, [], []), ovp('TFTS', 758, 118, 975, 186, [], []),
  ovp('FLT CTL 2', 752, 190, 962, 250, [['ELAC 2', 780, 212, 32, 29], ['SEC 2', 820, 213, 31, 29], ['SEC 3', 860, 214, 31, 29], ['FAC 2', 900, 215, 33, 30]], [['t', 'FLT CTL', 858, 197, 5.5]]),
  ovp('CARGO VENT', 750, 254, 950, 355, [['AFT ISOL VALVE', 900, 280, 29, 26]], [['t', 'CARGO VENT', 850, 263, 5.5], ['l', 848, 272, 843, 350, '#C9D2DA']]),
  ovp('CARGO SMOKE', 745, 358, 932, 418, [['FWD DISCH', 755, 368, 30, 44, 'pbr'], ['FWD SMOKE', 785, 382, 28, 26, 'ind'], ['SMOKE TEST', 821, 383, 24, 24, 'rnd'], ['AFT SMOKE', 853, 385, 29, 25, 'ind'], ['AFT DISCH', 884, 373, 31, 44, 'pbr']], [['t', 'CARGO SMOKE', 836, 364, 5.5]]),
  ovp('VENTILATION', 742, 420, 926, 458, [['BLOWER', 752, 428, 27, 22], ['EXTRACT', 791, 430, 27, 21], ['CAB FANS', 874, 432, 28, 23]], [['t', 'VENTILATION', 846, 424, 3.6], ['l', 868, 428, 864, 456, '#C9D2DA']]),
  ovp('ENG MAN START', 738, 460, 920, 512, [['ENG 1 MAN START', 743, 478, 30, 29, 'pbk'], ['ENG 2 MAN START', 781, 480, 31, 29, 'pbk']], [['t', 'ENG', 850, 478, 4.4], ['t', 'MAN START', 850, 488, 3.6]]),
  ovp('WIPER F/O', 735, 514, 908, 602, [['WIPER F/O', 758, 527, 34, 34, 'knob'], ['RAIN RPLNT F/O', 823, 523, 24, 24, 'rnd']], [])
];
/* Airbus A320: laid out from photos of the real flight deck (overhead: Olivier Cleynen, CC BY-SA 3.0; flight deck: Steve
   Jurvetson, CC BY 2.0). Panels sit where they are in the aircraft, and their buttons in the rows they have there; a row
   is an array, and null leaves an empty place in it. Sizes are kept readable, so it is a faithful map, not a photo. */
const A320 = { id: 'a320', name: 'Airbus A320', style: 'airbus', lines: {}, short: { 'GPWS SYS': 'SYS', 'RCDR GND CTL': 'GND CTL', 'WING A-ICE': 'WING', 'ENG 1 A-ICE': 'ENG 1', 'ENG 2 A-ICE': 'ENG 2', 'PROBE/WINDOW HEAT': '', 'PRESS MODE SEL': 'MODE SEL', 'APU MASTER SW': 'MASTER SW', 'APU START': 'START', 'L TK PUMP 1': '1', 'L TK PUMP 2': '2', 'R TK PUMP 1': '1', 'R TK PUMP 2': '2', 'CTR TK PUMP 1': 'CTR TK 1', 'CTR TK PUMP 2': 'CTR TK 2', 'TEMP CKPT': 'COCKPIT', 'TEMP FWD CAB': 'FWD CABIN', 'TEMP AFT CAB': 'AFT CABIN', 'BLUE ELEC PUMP': 'ELEC PUMP', 'YELLOW ELEC PUMP': 'ELEC PUMP', 'GALY & CAB': 'GALLEY', 'EVAC COMMAND': 'COMMAND', 'ENG 1 MAN START': '1', 'ENG 2 MAN START': '2', 'WIPER CPT': 'WIPER', 'RAIN RPLNT CPT': 'RAIN RPLNT', 'WIPER F/O': 'WIPER', 'RAIN RPLNT F/O': 'RAIN RPLNT', 'ENG 1 AGENT 1': 'AGENT 1', 'ENG 1 AGENT 2': 'AGENT 2', 'ENG 2 AGENT 1': 'AGENT 1', 'ENG 2 AGENT 2': 'AGENT 2', 'APU AGENT': 'AGENT', 'ENG 1 FIRE TEST': 'TEST', 'ENG 2 FIRE TEST': 'TEST', 'APU FIRE TEST': 'TEST', 'ENG 1 FIRE': '', 'ENG 2 FIRE': '', 'APU FIRE': '', 'BAT 1 VOLT': 'BAT 1', 'BAT 2 VOLT': 'BAT 2', 'BAT 1': '1', 'BAT 2': '2', 'FWD DISCH': 'DISCH', 'AFT DISCH': 'DISCH', 'FWD SMOKE': 'FWD', 'AFT SMOKE': 'AFT', 'SMOKE TEST': 'TEST', 'EMER GEN MAN ON': 'MAN ON', 'ICE IND & STBY COMPASS': 'STBY COMP', 'RAT & EMER GEN': 'EMER GEN', 'IR MODE 1': 'OFF NAV ATT', 'IR MODE 3': 'OFF NAV ATT', 'IR MODE 2': 'OFF NAV ATT', 'ADIRS DISPLAY': '', 'ADIRS KEYPAD': '', 'EXIT LT OFF': '', 'ON BAT': '', 'AUTO BRK LO': 'LO', 'AUTO BRK MED': 'MED', 'AUTO BRK MAX': 'MAX', 'LDG GEAR IND': 'GEAR IND', 'A/SKID & N/W STRG': 'A/SKID', 'SIDE STICK PRIORITY CPT': 'PRIORITY', 'SIDE STICK PRIORITY F/O': 'PRIORITY', 'AUTO LAND CPT': 'AUTO LAND', 'AUTO LAND F/O': 'AUTO LAND', 'MASTER WARN CPT': 'MASTER WARN', 'MASTER CAUT CPT': 'MASTER CAUT', 'MASTER WARN F/O': 'MASTER WARN', 'MASTER CAUT F/O': 'MASTER CAUT', 'HDG V/S - TRK FPA': 'HDG-V/S TRK-FPA' },
  look: { knob: /^(AUDIO SWITCHING|DATA SEL|SYS SEL|AFT TEMP|UPPER DISPLAY|LOWER DISPLAY|WX MODE|GAIN|TILT|PARKING BRAKE|IR MODE|PACK FLOW|TEMP |WIPER|LDG ELEV|X BLEED|ENG MODE SEL|ND MODE|ND RANGE|QNH|SPD$|HDG$|ALT$|V\/S$|RUD TRIM|GAIN|TILT|WX MODE|PFD BRT|ND BRT|CONSOLE|LOUDSPEAKER|XPDR|TCAS MODE|VOL|FLOOD|RMP 3)/,
    toggle: /^(WX SYS|MULTISCAN|GCS|PWS|A\/SKID|MAN V\/S CTL|STROBE|BEACON|WING LT|NAV & LOGO|RWY TURN OFF|LAND [LR]|NOSE LT|SEAT BELTS|NO SMOKING|EMER EXIT LT|OVHD INTEG LT|DOME|ANN LT|STBY COMPASS|ENG MASTER|ADF\/VOR|DOOR LOCK|ATC SYS|WX SYS|CHRONO|ATT HDG|AIR DATA|EIS DMC|ECAM\/ND XFR|PFD\/ND XFR)/,
    guard: /^(EVAC COMMAND|RAT & EMER GEN|EMER GEN TEST|IDG|RAT MAN ON|DITCHING|FWD DISCH|AFT DISCH|MASK MAN ON|PASSENGER|ENG [12] AGENT|APU AGENT|GEN 1 LINE|ENG MASTER)/ }, h: 1606, crew: 2, zones: [],
  /* the classic flat cockpit layout: aft overhead and overhead on top, the glareshield as a bar, the main panel with its
     outer wings, the pedestal down the middle and a side console with the sidestick on each side */
  shapes: [[240, 0, 760, 0, 760, 146, 240, 146], [230, 156, 772, 156, 772, 362, 760, 403, 742, 474, 730, 544, 634, 572, 387, 572, 274, 549, 266, 491, 253, 391, 233, 285], [10, 598, 42, 578, 958, 578, 990, 598, 990, 694, 958, 712, 42, 712, 10, 694], [10, 734, 42, 718, 365, 718, 365, 938, 10, 938], [635, 718, 958, 718, 990, 734, 990, 938, 635, 938], [365, 718, 635, 718, 635, 1016, 365, 1016], [70, 944, 365, 944, 365, 1030, 70, 1030], [635, 944, 930, 944, 930, 1030, 635, 1030], [318, 1016, 682, 1016, 682, 1600, 318, 1600], [40, 1124, 300, 1104, 300, 1394, 20, 1414], [700, 1104, 960, 1124, 980, 1414, 700, 1394]], p: [
  ['CIRCUIT BREAKERS', 250, 10, 300, 128, [], 'g'],
  ['MAINTENANCE', 554, 10, 196, 128, [['FADEC GND PWR 1', 'FADEC GND PWR 2', 'BLUE PUMP OVRD'], ['LEAK MEAS B', 'LEAK MEAS G', 'LEAK MEAS Y'], ['APU AUTO EXTING', 'OXY TMR RESET', 'SVCE INT OVRD', 'AVNCS COMPT LT']]],
  ...A320_OVHD,
  ['MASTER CPT', 20, 586, 56, 110, [['MASTER WARN CPT'], ['MASTER CAUT CPT']]],
  ['CPT GLARESHIELD', 80, 586, 60, 110, [['AUTO LAND CPT'], ['SIDE STICK PRIORITY CPT'], ['CHRONO CPT']]],
  ['EFIS CPT', 144, 586, 190, 110, [['inHg/hPa CPT', 'QNH CPT', 'FD CPT', 'LS CPT'], ['CSTR', 'WPT', 'VOR.D', 'NDB', 'ARPT'], ['ND MODE CPT', 'ND RANGE CPT', 'ADF/VOR 1', 'ADF/VOR 2']]],
  ['FCU', 338, 586, 324, 110, [['SPD/MACH', 'SPD', 'HDG', 'HDG V/S - TRK FPA', 'AP 1', 'AP 2', 'ALT', '100/1000', 'METRIC ALT', 'V/S'], ['LOC', null, null, null, 'A/THR', null, null, 'EXPED', 'APPR', null]]],
  ['EFIS F/O', 666, 586, 190, 110, [['inHg/hPa F/O', 'QNH F/O', 'FD F/O', 'LS F/O'], ['CSTR F/O', 'WPT F/O', 'VOR.D F/O', 'NDB F/O', 'ARPT F/O'], ['ND MODE F/O', 'ND RANGE F/O', 'ADF/VOR 1 F/O', 'ADF/VOR 2 F/O']]],
  ['F/O GLARESHIELD', 860, 586, 60, 110, [['AUTO LAND F/O'], ['SIDE STICK PRIORITY F/O'], ['CHRONO F/O']]],
  ['MASTER F/O', 924, 586, 56, 110, [['MASTER WARN F/O'], ['MASTER CAUT F/O']]],
  ['CPT SIDE', 20, 720, 80, 140, [['CONSOLE/FLOOR LT'], ['LOUDSPEAKER CPT'], ['PFD BRT CPT'], ['ND BRT CPT']]],
  ['PFD CPT', 104, 720, 130, 140, [], 's'], ['ND CPT', 238, 720, 130, 140, [], 's'],
  ['CPT WARNINGS', 20, 864, 345, 46, [['GPWS G/S CPT', 'TERR ON ND CPT', 'PFD/ND XFR CPT']]],
  ['STANDBY (ISIS)', 374, 720, 66, 88, [], 's'],
  ['E/WD (upper ECAM)', 444, 720, 112, 136, [], 's'],
  ['LDG GEAR / BRAKES', 560, 720, 66, 136, [['LDG GEAR IND'], ['A/SKID & N/W STRG'], ['AUTO BRK LO', 'AUTO BRK MED', 'AUTO BRK MAX'], ['BRK FAN']]],
  ['ND F/O', 632, 720, 130, 140, [], 's'], ['PFD F/O', 766, 720, 130, 140, [], 's'],
  ['F/O SIDE', 900, 720, 80, 140, [['LOUDSPEAKER F/O'], ['PFD BRT F/O'], ['ND BRT F/O']]],
  ['F/O WARNINGS', 635, 864, 345, 46, [['PFD/ND XFR F/O', 'TERR ON ND F/O', 'GPWS G/S F/O']]],
  ['CPT KNEE PANEL', 80, 950, 276, 72, [['NAV CHART LT CPT', 'LOUDSPEAKER VOL CPT', 'OXY MASK TEST CPT']]],
  ['DDRMI', 374, 812, 66, 80, [], 's'],
  ['CLOCK', 374, 896, 66, 110, [['CLOCK'], ['CHRONO', 'ET']]],
  ['SD (lower ECAM)', 444, 860, 112, 146, [], 's'],
  ['GEAR LEVER', 560, 860, 66, 92, ['GEAR LEVER'], 'l'],
  ['BRAKE PRESS', 560, 956, 66, 50, [['BRAKE PRESS']]],
  ['F/O KNEE PANEL', 644, 950, 276, 72, [['OXY MASK TEST F/O', 'LOUDSPEAKER VOL F/O', 'NAV CHART LT F/O']]],
  ['MCDU 1', 324, 1028, 112, 178, [], 's'],
  ['SWITCHING', 440, 1028, 120, 50, [['ATT HDG', 'AIR DATA', 'EIS DMC', 'ECAM/ND XFR']]],
  ['ECAM CONTROL', 440, 1082, 120, 124, [['UPPER DISPLAY', 'LOWER DISPLAY'], ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL'], ['APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL', 'STS'], ['T.O CONFIG', 'EMER CANC', 'RCL', 'CLR', 'ALL']]],
  ['MCDU 2', 564, 1028, 112, 178, [], 's'],
  ['RMP 1', 324, 1212, 96, 92, [['RMP 1 ACTIVE DISPLAY', 'XFER', 'RMP 1 STBY DISPLAY'], ['VHF 1', 'VHF 2', 'VHF 3', 'HF 1', 'AM', 'HF 2'], ['NAV', 'VOR', 'ILS', 'ADF', 'BFO', 'SEL'], ['RMP 1 ON/OFF', 'STBY/CRS']]],
  ['ACP 1', 324, 1308, 96, 78, [['VHF 1 TX', 'VHF 2 TX', 'VHF 3 TX', 'INT TX', 'CAB TX', 'PA TX'], ['VOR 1', 'VOR 2', 'MKR', 'ILS VOL', 'ADF 1', 'ADF 2'], ['INT/RAD', 'VOICE', 'RESET']]],
  ['PITCH TRIM L', 424, 1212, 24, 248, ['PITCH TRIM WHEEL L'], 'l'],
  ['SPEED BRAKE', 450, 1212, 24, 248, ['SPEED BRAKE LEVER'], 'l'],
  ['THRUST LEVERS', 476, 1212, 76, 248, ['A/THR DISC 1', 'THR LVR 1', 'THR LVR 2', 'A/THR DISC 2'], 'l'],
  ['FLAPS', 554, 1212, 24, 248, ['FLAPS LEVER'], 'l'],
  ['PITCH TRIM R', 580, 1212, 24, 248, ['PITCH TRIM WHEEL R'], 'l'],
  ['RMP 2', 608, 1212, 68, 92, [['RMP 2 ACTIVE DISPLAY', 'XFER F/O', 'RMP 2 STBY DISPLAY'], ['VHF 1 F/O', 'VHF 2 F/O', 'VHF 3 F/O'], ['HF 1 F/O', 'AM F/O', 'HF 2 F/O'], ['RMP 2 ON/OFF', 'STBY/CRS F/O']]],
  ['ACP 2', 608, 1308, 68, 78, [['VHF 1 TX F/O', 'VHF 2 TX F/O', 'INT TX F/O'], ['VOR 1 F/O', 'ILS F/O', 'ADF F/O'], ['INT/RAD F/O', 'RESET F/O']]],
  ['WX RADAR', 324, 1390, 96, 70, [['WX SYS', 'WX MODE', 'MULTISCAN', 'GCS'], ['GAIN', 'TILT', 'PWS']]],
  ['PARKING BRK', 608, 1390, 68, 70, [['PARKING BRAKE']]],
  ['ENGINE', 424, 1464, 180, 74, [['ENG 1 FIRE IND', 'ENG 1 FAULT IND', null, 'ENG 2 FAULT IND', 'ENG 2 FIRE IND'], [null, 'ENG MASTER 1', 'ENG MODE SEL', 'ENG MASTER 2', null]]],
  ['ATC / TCAS', 324, 1464, 96, 74, [['XPDR MODE', 'ATC 1/2', 'ALT RPTG', 'IDENT'], ['XPDR CODE', 'TCAS MODE', 'TCAS TRAFFIC']]],
  ['RUDDER TRIM', 608, 1464, 68, 74, [['RUD TRIM IND'], ['RUD TRIM', 'RESET']]],
  ['CKPT DOOR', 324, 1542, 96, 52, [['DOOR LOCK', 'DOOR CTL', 'DOOR VIDEO']]],
  ['FLOOD / INTEG LT', 424, 1542, 180, 52, [['FLOOD LT MAIN PNL', 'FLOOD LT PED', 'INTEG LT MAIN PNL', 'INTEG LT PED', 'RMP 3', 'PRINTER']]],
  ['GRAVITY GEAR', 608, 1542, 68, 52, [['GRAVITY GEAR EXTN']]],
  ['CPT SIDE CONSOLE', 40, 1134, 250, 250, [['TILLER CPT', 'SIDESTICK CPT'], ['OXY MASK CPT', 'TABLE CPT']]],
  ['F/O SIDE CONSOLE', 710, 1134, 250, 250, [['SIDESTICK F/O', 'TILLER F/O'], ['TABLE F/O', 'OXY MASK F/O']]]
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
const B738 = { id: 'b738', name: 'Boeing 737-800', style: 'boeing', h: 1500, crew: 2, zones: [['Overhead', 10, 0, 980, 470], ['Glareshield', 10, 480, 980, 110], ['Main panel', 10, 596, 980, 338], ['Pedestal', 245, 942, 510, 555]], p: [
  ['FLT CONTROL', 25, 12, 225, 80, ['FLT CONTROL A', 'FLT CONTROL B', 'SPOILER A', 'SPOILER B', 'ALTERNATE FLAPS', 'ALT FLAPS CTRL', 'YAW DAMPER']],
  ['NAV / DISPLAYS', 25, 97, 225, 56, ['VHF NAV', 'IRS', 'FMC', 'DISPLAYS SOURCE', 'CONTROL PANEL']],
  ['FUEL', 25, 158, 225, 100, ['FUEL TEMP', 'CROSSFEED', 'CTR PUMP L', 'CTR PUMP R', 'AFT PUMP 1', 'FWD PUMP 1', 'FWD PUMP 2', 'AFT PUMP 2']],
  ['ELEC', 25, 263, 225, 130, ['DC METERS', 'AC METERS', 'BAT', 'CAB/UTIL', 'IFE/PASS SEAT', 'STANDBY POWER', 'DRIVE DISC 1', 'DRIVE DISC 2', 'GRD POWER', 'GEN 1', 'APU GEN L', 'APU GEN R', 'GEN 2', 'BUS TRANSFER']],
  ['APU', 25, 398, 110, 62, ['APU SWITCH', 'APU EGT']],
  ['EQUIP COOLING', 140, 398, 110, 62, ['SUPPLY', 'EXHAUST']],
  ['SIGNS / CALLS', 262, 12, 476, 40, ['EMER EXIT LIGHTS', 'NO SMOKING', 'FASTEN BELTS', 'ATTEND CALL', 'GRD CALL']],
  ['WINDOW / PROBE HEAT', 262, 57, 476, 56, ['WINDOW HEAT L SIDE', 'WINDOW HEAT L FWD', 'WINDOW HEAT R FWD', 'WINDOW HEAT R SIDE', 'WINDOW HEAT TEST', 'PROBE HEAT A', 'PROBE HEAT B', 'TAT TEST']],
  ['ANTI-ICE', 262, 118, 236, 46, ['WING ANTI-ICE', 'ENG ANTI-ICE 1', 'ENG ANTI-ICE 2']],
  ['HYDRAULICS', 502, 118, 236, 46, ['ENG 1 HYD', 'ELEC 2 HYD', 'ELEC 1 HYD', 'ENG 2 HYD']],
  ['AIR CONDITIONING', 262, 169, 476, 70, ['CONT CAB TEMP', 'FWD CAB TEMP', 'AFT CAB TEMP', 'TRIM AIR', 'L RECIRC FAN', 'R RECIRC FAN', 'OVHT TEST']],
  ['BLEED', 262, 244, 476, 56, ['L PACK', 'ISOLATION VALVE', 'R PACK', 'BLEED 1', 'APU BLEED', 'BLEED 2', 'TRIP RESET']],
  ['PRESSURIZATION', 262, 305, 476, 56, ['FLT ALT', 'LAND ALT', 'OUTFLOW VALVE', 'PRESS MODE SEL']],
  ['LANDING LIGHTS', 262, 366, 476, 46, ['RETRACT LDG L', 'RETRACT LDG R', 'FIXED LDG L', 'FIXED LDG R', 'RWY TURNOFF L', 'RWY TURNOFF R', 'TAXI']],
  ['ENGINE START', 262, 417, 236, 48, ['ENG START 1', 'IGNITION SEL', 'ENG START 2']],
  ['EXT LIGHTS', 502, 417, 236, 48, ['LOGO', 'POSITION', 'ANTI COLLISION', 'WING', 'WHEEL WELL']],
  ['WIPERS', 750, 12, 225, 40, ['WIPER L', 'WIPER R']],
  ['IRS (AFT OVHD)', 750, 57, 225, 70, ['IRS L', 'IRS R', 'IRS DSPL SEL', 'IRS KEYPAD']],
  ['CABIN ALTITUDE', 750, 132, 225, 56, ['CAB ALT', 'DIFF PRESS', 'ALT HORN CUTOUT']],
  ['DOORS', 750, 193, 225, 56, [], 's'],
  ['OXYGEN / GPWS', 750, 254, 225, 56, ['CREW OXYGEN', 'PASS OXYGEN', 'GPWS FLAP INHIB', 'GPWS GEAR INHIB', 'GPWS TERR INHIB']],
  ['ENGINE (AFT OVHD)', 750, 315, 225, 70, ['EEC 1', 'EEC 2', 'REVERSER 1', 'REVERSER 2', 'ENG VALVE CLOSED']],
  ['INT LIGHTS', 750, 390, 225, 70, ['DOME WHITE', 'PANEL LT', 'BACKGROUND LT']],
  ['MASTER CPT', 20, 488, 60, 94, ['FIRE WARN CPT', 'MASTER CAUTION CPT']],
  ['EFIS CPT', 85, 488, 150, 94, ['MINS CPT', 'BARO CPT', 'FPV', 'MTRS', 'WXR', 'STA', 'WPT', 'ARPT', 'DATA', 'POS', 'TERR', 'ND MODE CPT', 'ND RANGE CPT']],
  ['MCP', 245, 488, 510, 94, ['COURSE CPT', 'F/D CPT', 'A/T ARM', 'N1', 'SPEED', 'C/O', 'SPD INTV', 'VNAV', 'LVL CHG', 'HDG SEL', 'HDG', 'LNAV', 'VOR LOC', 'APP', 'ALT HOLD', 'V/S', 'ALT', 'CMD A', 'CMD B', 'CWS A', 'CWS B', 'A/P DISENGAGE', 'COURSE F/O', 'F/D F/O']],
  ['EFIS F/O', 765, 488, 150, 94, ['MINS F/O', 'BARO F/O', 'ND MODE F/O', 'ND RANGE F/O']],
  ['MASTER F/O', 920, 488, 60, 94, ['FIRE WARN F/O', 'MASTER CAUTION F/O']],
  ['PFD CPT', 20, 604, 170, 170, [], 's'], ['ND CPT', 195, 604, 170, 170, [], 's'], ['UPPER DU (ENGINES)', 400, 604, 200, 170, [], 's'], ['ND F/O', 635, 604, 170, 170, [], 's'], ['PFD F/O', 810, 604, 170, 170, [], 's'],
  ['CPT LOWER', 20, 782, 345, 66, ['STBY INSTRUMENTS', 'CLOCK CPT', 'NOSE WHEEL STEERING', 'MAIN PANEL DUs', 'LOWER DU SEL']],
  ['GEAR / AUTOBRAKE', 400, 782, 200, 66, ['LDG GEAR LEVER', 'AUTOBRAKE', 'N1 SET', 'SPD REF', 'FUEL FLOW']],
  ['LOWER DU', 400, 853, 200, 76, [], 's'],
  ['F/O LOWER', 635, 782, 345, 66, ['FLAP POSITION', 'BRAKE PRESSURE', 'CLOCK F/O', 'MFD ENG', 'MFD SYS']],
  ['CPT SIDE PANEL', 20, 853, 345, 76, ['OXY MASK CPT', 'LOUDSPEAKER CPT']],
  ['F/O SIDE PANEL', 635, 853, 345, 76, ['OXY MASK F/O', 'LOUDSPEAKER F/O']],
  ['CDU L', 255, 952, 240, 150, [], 's'], ['CDU R', 505, 952, 240, 150, [], 's'],
  ['SPEED BRAKE', 255, 1108, 42, 170, ['SPEED BRAKE LEVER'], 'l'],
  ['THRUST LEVERS', 302, 1108, 170, 170, ['THR LEVER 1', 'THR LEVER 2', 'TO/GA', 'A/T DISENGAGE'], 'l'],
  ['STAB TRIM', 478, 1108, 72, 170, ['STAB TRIM WHEEL'], 'l'],
  ['FLAP LEVER', 556, 1108, 189, 120, ['FLAP LEVER'], 'l'],
  ['PARKING BRAKE', 556, 1233, 189, 45, ['PARKING BRAKE']],
  ['START LEVERS', 302, 1283, 248, 40, ['START LEVER 1', 'START LEVER 2']],
  ['STAB TRIM CUTOUT', 556, 1283, 189, 40, ['MAIN ELEC', 'AUTOPILOT']],
  ['FIRE PROTECTION', 255, 1330, 490, 62, ['ENG 1 FIRE', 'APU FIRE', 'ENG 2 FIRE', 'OVHT/FIRE TEST', 'EXTINGUISHER TEST', 'FIRE BELL CUTOUT']],
  ['RADIO / AUDIO', 255, 1397, 490, 46, ['VHF 1', 'VHF 2', 'ADF', 'NAV 1', 'NAV 2', 'ACP CPT']],
  ['XPDR / WXR / TRIM', 255, 1448, 490, 46, ['XPDR MODE', 'TCAS', 'WX RADAR', 'RUDDER TRIM', 'AILERON TRIM']]
]};
const ATR72 = { id: 'atr72', name: 'ATR 72-600', style: 'atr', h: 1500, crew: 2, zones: [['Overhead', 10, 0, 980, 460], ['Glareshield', 10, 470, 980, 105], ['Main panel', 10, 582, 980, 315], ['Pedestal', 245, 905, 510, 592]], p: [
  ['CIRCUIT BREAKERS', 20, 10, 960, 50, [], 'g'],
  ['ENG 1 FIRE', 20, 65, 235, 52, ['ENG 1 FIRE HANDLE', 'AGENT 1 ENG 1', 'AGENT 2 ENG 1']],
  ['EMER LOC / CVR', 260, 65, 475, 52, ['EMER LOC XMTR', 'CVR TEST', 'CVR ERASE', 'HEADSET']],
  ['ENG 2 FIRE', 740, 65, 240, 52, ['ENG 2 FIRE HANDLE', 'AGENT 1 ENG 2', 'AGENT 2 ENG 2', 'SQUIB TEST']],
  ['FLT CTL', 20, 122, 235, 50, ['MFC 1', 'MFC 2', 'TLU', 'SPOILERS']],
  ['LDG GEAR / DOORS', 20, 177, 235, 50, ['LDG GEAR TEST', 'DOORS IND']],
  ['FUEL', 20, 232, 235, 70, ['LP VALVE 1', 'FUEL PUMP 1', 'X FEED', 'FUEL PUMP 2', 'LP VALVE 2']],
  ['CALLS / LIGHTS', 20, 307, 235, 50, ['STORM LT', 'DOME LT', 'CALLS', 'SELCAL']],
  ['CAPT WIPER', 20, 362, 235, 40, ['WIPER CPT']],
  ['MAIN ELEC PWR', 260, 122, 235, 180, ['DC BUS 1', 'STBY BUS', 'DC BUS 2', 'EMER BAT', 'BAT', 'DC EXT PWR', 'TRU', 'DC BTC', 'DC GEN 1', 'BAT SEL', 'DC GEN 2', 'INV 1', 'INV 2']],
  ['ENG START', 260, 307, 235, 50, ['START 1', 'START SEL', 'START 2']],
  ['PROP BRAKE', 260, 362, 235, 40, ['PROP BRAKE']],
  ['HYD PWR', 500, 122, 235, 56, ['BLUE MAIN PUMP', 'AUX PUMP', 'HYD X FEED', 'GREEN MAIN PUMP']],
  ['AC WILD ELEC PWR', 500, 183, 235, 50, ['ACW GEN 1', 'AC EXT PWR', 'ACW BTC', 'ACW GEN 2']],
  ['PROBES / WINDSHIELD HTG', 500, 238, 235, 50, ['PROBES HTG CPT', 'PROBES HTG STBY', 'PROBES HTG F/O', 'WINDSHIELD HTG L', 'WINDSHIELD HTG R']],
  ['ANTI / DE ICING', 500, 293, 235, 109, ['PROP 1', 'PROP 2', 'HORNS ANTI-ICE', 'SIDE WINDOWS', 'MODE SEL', 'ENG 1 DE-ICE', 'ENG 2 DE-ICE', 'AIRFRAME A', 'AIRFRAME B']],
  ['SMOKE / VENT', 740, 122, 240, 56, ['CNTR SMK TEST', 'COMPT SMK', 'CAB VENT', 'AVIONICS VENT']],
  ['OXYGEN', 740, 183, 240, 40, ['MAIN SUPPLY', 'PAX SUPPLY']],
  ['COMPT TEMP', 740, 228, 240, 60, ['FLT COMPT TEMP', 'CABIN TEMP', 'PACK VALVES']],
  ['AIR BLEED', 740, 293, 240, 70, ['BLEED 1', 'X VALVE', 'BLEED 2', 'PACK 1', 'HI FLOW', 'PACK 2', 'RECIRC FANS']],
  ['F/O WIPER / ANN LT', 740, 368, 240, 34, ['WIPER F/O', 'ANN LT']],
  ['EXT LT / SIGNS', 20, 407, 960, 45, ['BEACON', 'NAV', 'STROBE', 'WING', 'TAXI & TO', 'LAND L', 'LAND R', 'LOGO', 'SEAT BELTS', 'NO SMOKING', 'EMER EXIT LT']],
  ['MW/MC CPT', 20, 478, 60, 90, ['MASTER WARNING CPT', 'MASTER CAUTION CPT']],
  ['EFCP CPT', 85, 478, 160, 90, ['BARO CPT', 'MINIMUMS CPT', 'PFD DIM CPT', 'ND RANGE CPT', 'ND FORMAT CPT', 'NAV SOURCE CPT']],
  ['FGCP (AFCS)', 255, 478, 490, 90, ['CRS 1', 'HDG', 'NAV', 'APP', 'BC', 'AP', 'YD', 'IAS', 'VS', 'ALT', 'ALT SEL', 'STBY', 'HDG SEL', 'CRS 2', 'VS WHEEL', 'BANK']],
  ['EFCP F/O', 755, 478, 160, 90, ['BARO F/O', 'MINIMUMS F/O', 'ND RANGE F/O', 'ND FORMAT F/O']],
  ['MW/MC F/O', 920, 478, 60, 90, ['MASTER WARNING F/O', 'MASTER CAUTION F/O']],
  ['PFD CPT', 20, 590, 170, 170, [], 's'], ['ND CPT (MFD)', 195, 590, 170, 170, [], 's'], ['ENG CTL', 400, 590, 200, 26, ['EEC 1', 'ATPCS', 'EEC 2']], ['EWD (ENGINES)', 400, 620, 200, 140, [], 's'], ['ND F/O (MFD)', 635, 590, 170, 170, [], 's'], ['PFD F/O', 810, 590, 170, 170, [], 's'],
  ['CPT LOWER', 20, 768, 345, 62, ['ISI (STANDBY)', 'CLOCK CPT', 'MFD SEL CPT', 'CHRONO']],
  ['LDG GEAR', 400, 768, 90, 124, ['LDG GEAR LEVER', 'GEAR IND'], 'l'],
  ['CCAS', 495, 768, 105, 124, ['RCL', 'EMER CANC', 'CLR', 'TO CONFIG']],
  ['F/O LOWER', 635, 768, 345, 62, ['FLAPS IND', 'CLOCK F/O', 'MFD SEL F/O', 'TRIM IND']],
  ['CPT KNEE PANEL', 20, 835, 345, 57, ['NOSE WHEEL STEERING', 'EMER AUDIO CPT', 'LOUDSPEAKER CPT']],
  ['F/O KNEE PANEL', 635, 835, 345, 57, ['EMER AUDIO F/O', 'LOUDSPEAKER F/O']],
  ['MCDU 1', 255, 915, 240, 140, [], 's'], ['MCDU 2', 505, 915, 240, 140, [], 's'],
  ['PWR MGT', 255, 1062, 120, 46, ['PWR MGT SEL', 'PEC 1', 'PEC 2']],
  ['TRIM', 380, 1062, 365, 46, ['PITCH TRIM', 'AILERON TRIM', 'RUDDER TRIM', 'TRIM STBY']],
  ['POWER LEVERS', 255, 1113, 180, 180, ['PL 1', 'PL 2', 'GO AROUND'], 'l'],
  ['CONDITION LEVERS', 440, 1113, 150, 180, ['CL 1', 'CL 2'], 'l'],
  ['FLAPS', 595, 1113, 150, 130, ['FLAP LEVER'], 'l'],
  ['GUST LOCK', 595, 1248, 150, 45, ['GUST LOCK']],
  ['PARKING / EMER BRAKE', 255, 1298, 490, 40, ['PARKING BRAKE', 'EMER BRAKE']],
  ['RADIO / ATC', 255, 1343, 490, 46, ['VHF 1', 'VHF 2', 'XPDR', 'TCAS', 'WX RADAR']],
  ['AUDIO CPT', 255, 1394, 240, 46, ['ACP CPT']], ['AUDIO F/O', 505, 1394, 240, 46, ['ACP F/O']],
  ['CABIN PRESS / GPWS / ANTI-SKID', 255, 1445, 490, 46, ['PRESS MODE SEL', 'LDG ELEV', 'DUMP', 'DITCHING', 'GPWS SYS', 'TERR', 'ANTI-SKID TEST']]
]};
const LIST = [A320, B738, ATR72, B200, PA34, DA42, C172];

/* layout: the targets (named controls) of an aircraft, with their rectangles; panels without items are one target */
function targets(ac) { if (ac._t) return ac._t; const out = [];
  ac.p.forEach(([n, x, y, w, h, it, k]) => {
    if (!it || !it.length) { out.push({ id: n, name: n, panel: n, x, y, w, h, k: k || 'g', whole: true }); return; }
    // a low panel keeps its name on the left and its controls in one row; otherwise the name on top and the controls in a grid
    const low = h < 46, tw = low ? Math.min(w * 0.3, n.length * 6.4 + 12) : 0, X0 = x + 4 + tw, W = w - 8 - tw, top = low ? y + 3 : y + 18, H = low ? h - 5 : h - 22;
    if (it[0] && it[0].b) { it.forEach(o => { const [bx, by, bw, bh] = o.b; out.push({ id: n + '|' + o.n, name: o.n, panel: n, x: bx - 2, y: by - 5, w: bw + 4, h: bh + 7, k: 'p', kd: o.kd, b: { x: bx, y: by, w: bw, h: bh } }); }); return; }
    if (Array.isArray(it[0])) { const R = it.length, rh = H / R; it.forEach((row, r) => { const cw = W / row.length; row.forEach((name, c) => { if (name) out.push({ id: n + '|' + name, name, panel: n, x: X0 + c * cw + 2, y: top + r * rh + 1, w: cw - 4, h: rh - 3, k: k || 'p' }); }); }); return; }
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
/* the drawing. Each family gets its own look, so a picture reads like the real flight deck: Airbus and ATR panels are blue-grey
   with lit push-buttons (dark-cockpit legends), Boeing panels are grey with toggle switches, light aircraft are dark grey.
   A control's look comes from its name: knobs for selectors, red handles for fire, guards over the switches that are guarded,
   lever handles for levers; screens show a plain stylised picture of what they display (no data). */
const LOOK = { airbus: { bg: '#15191D', zone: '#3B4651', pan: '#56677A', edge: '#7D8FA3', scr: '#07090B', lab: '#F2F5F8', btn: 'pb', real: true },
  atr: { bg: '#16191C', zone: '#3C454E', pan: '#5A6773', edge: '#82909E', scr: '#07090B', lab: '#F2F5F8', btn: 'pb' },
  boeing: { bg: '#17191B', zone: '#45494D', pan: '#696E73', edge: '#8E9499', scr: '#07090B', lab: '#FFFFFF', btn: 'tg' },
  ga: { bg: '#1E2328', zone: '#2A3036', pan: '#3A424B', edge: '#56606B', scr: '#0E1114', lab: '#E9ECEF', btn: 'tg' } };
const KNOB = /\b(SEL|MODE|QNH|BARO|MINS|MINIMUMS|RANGE|TEMP|LDG ELEV|FLT ALT|LAND ALT|COURSE|CRS ?\d?|HDG|SPEED|SPD|ALT|V\/S|VS WHEEL|BANK|XPDR|TRIM AIR|CTL|IGNITION SEL|ENG START [12]|START SEL|DSPL SEL|BRIGHT|DIM|WIPER|ND FORMAT|NAV SOURCE|PACK FLOW|PWR MGT|IR MODE|IRS [LR]|AUTOBRAKE|AUTO BRK|N1 SET|SPD REF|CLOCK|CHRONO|FUEL SEL|MAGNETOS|N1 MODE|TCAS|WX RADAR|FMC|DISPLAYS SOURCE|CONTROL PANEL|VHF NAV|IRS)\b/;
const GUARD = /AGENT|DISCH|EVAC COMMAND|DITCHING|GEN 1 LINE|IDG|DRIVE DISC|RAT & EMER|ALTERNATE FLAPS|FLT CONTROL [AB]|STANDBY POWER|SPOILER [AB]|MAIN ELEC|^AUTOPILOT$|EMER LOC|MAN START|FLAPS OVRD|BUS TRANSFER|PROP BRAKE|IDLE GATE/;
const FIREH = /FIRE( HANDLE)?$|FIRE PULL|^ENG [12] FIRE|^APU FIRE$/;
function kindOf(name, k, look, own, panel) { if (/^SIDESTICK/.test(name)) return 'stick'; if (/^TILLER/.test(name)) return 'tiller';
  if (own) { if (/^THR LVR/.test(name)) return 'thr'; if (/^A\/THR DISC/.test(name)) return 'disc'; if (/^FLAPS LEVER/.test(name)) return 'flaps'; if (/^SPEED BRAKE/.test(name)) return 'spd'; if (/^PITCH TRIM WHEEL/.test(name)) return 'trimw';
    if (/^GEAR LEVER/.test(name)) return 'gear'; if (/^PARKING BRAKE/.test(name)) return 'park'; if (/^GRAVITY GEAR/.test(name)) return 'crank'; if (/(VOLT|DISPLAY|XPDR CODE|RUD TRIM IND)$/.test(name) && !/^(UPPER|LOWER) DISPLAY/.test(name)) return 'disp'; if (/KEYPAD$/.test(name)) return 'keys';
    if (/(FIRE IND|FAULT IND|^GPWS G\/S|^ON BAT|^LDG GEAR IND)/.test(name)) return 'ind'; if (/^(OXY MASK|TABLE) /.test(name)) return 'box'; }
  if (k === 'l') return 'lever';
  if (own && !/FIRE (TEST|IND)|AGENT/.test(name) && /^(ENG [12]|APU) FIRE$/.test(name)) return 'fire';
  if (own && !/MASTER (WARN|CAUT)/.test(name)) { const g = own.guard && own.guard.test(name); if (own.toggle && own.toggle.test(name)) return g ? 'tgg' : 'tg'; if (own.knob && own.knob.test(name)) return 'knob'; if (/IND$|^BRAKE PRESS$|^CLOCK$/.test(name)) return 'gauge'; if (/^(ECAM CONTROL|EFIS|RMP|ACP)/.test(panel || '')) return 'key'; if (!/MASTER (WARN|CAUT)/.test(name)) return g ? 'pbg' : 'pb'; } if (FIREH.test(name) && !/TEST/.test(name)) return 'fire'; if (/MASTER (WARN|CAUT)|FIRE WARN|MASTER WARNING|MASTER CAUTION/.test(name)) return 'master';
  if (/^(CDU|MCDU|RMP|ACP|SIX PACK)|ACP|KEYPAD/.test(name)) return 'keys'; if (KNOB.test(name)) return 'knob'; if (/METERS|EGT|IND$|PRESSURE|POSITION$|QTY|ASI|ATTITUDE|ALTIMETER|AIRSPEED|TURN|VSI|HSI|ADI|RMI|TACH|TORQUE|ITT|RPM|N1 [LR]|FLOW|OIL|CHT|AMMETER|VACUUM|MANIFOLD|ISI|STBY (ASI|ATT|ALT)|STBY INSTRUMENTS|CAB ALT|DIFF PRESS|GEAR IND|FLAPS IND|TRIM IND|FLAP POSITION|BRAKE PRESS|HOBBS/.test(name)) return 'gauge';
  if (/ENG MASTER|START LEVER/.test(name)) return 'tg';
  return look.btn === 'pb' ? (GUARD.test(name) ? 'pbg' : 'pb') : (GUARD.test(name) ? 'tgg' : 'tg'); }
function ctl(t, kd, look) { const gh = t.h - 13; if (gh < 8 && kd !== 'disp') return ''; const cx = t.x + t.w / 2, cy = t.y + 2 + gh / 2, m = Math.min(t.w - 6, gh);
  if (kd === 'lever') { const hw = Math.min(t.w * 0.5, 26), hh = Math.max(8, Math.min(14, gh * 0.18)), ty = t.y + 4 + gh * 0.18;
    return `<rect x="${cx - 2}" y="${ty}" width="4" height="${Math.max(4, gh - (ty - t.y) - 2)}" fill="#1A1D20"/><rect x="${cx - hw / 2}" y="${ty - hh / 2}" width="${hw}" height="${hh}" rx="${hh / 2.4}" fill="#D9DDE1" stroke="#7D858D"/>`; }
  if (kd === 'stick') { const r = Math.min(t.w, gh) * 0.3; return `<circle cx="${cx}" cy="${cy + r * 0.6}" r="${r}" fill="#1A1D20" stroke="#56606B"/><rect x="${cx - r * 0.28}" y="${cy - r * 1.3}" width="${r * 0.56}" height="${r * 1.9}" rx="${r * 0.25}" fill="#2A2E33"/><rect x="${cx - r * 0.42}" y="${cy - r * 1.75}" width="${r * 0.84}" height="${r * 0.9}" rx="${r * 0.3}" fill="#121417" stroke="#8E959C"/><circle cx="${cx}" cy="${cy - r * 1.55}" r="${r * 0.14}" fill="#C62828"/>`; }
  if (kd === 'tiller') { const r = Math.min(t.w, gh) * 0.26; return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#8E959C" stroke-width="${r * 0.22}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="#2A2E33"/><circle cx="${cx + r * 0.7}" cy="${cy - r * 0.7}" r="${r * 0.18}" fill="#D7DCE1"/>`; }
  if (kd === 'thr' || kd === 'flaps' || kd === 'spd' || kd === 'gear') { const top = t.y + 6, bot = t.y + t.h - 6, H = bot - top, sx = cx;
    const marks = kd === 'thr' ? [['TOGA', 0.04], ['FLX MCT', 0.2], ['CL', 0.36], ['0', 0.62], ['MAX REV', 0.96]] : kd === 'flaps' ? [['0', 0.05], ['1', 0.27], ['2', 0.49], ['3', 0.71], ['FULL', 0.93]] : kd === 'spd' ? [['RET', 0.05], ['1/2', 0.5], ['FULL', 0.93]] : [['UP', 0.08], ['DOWN', 0.92]];
    const at = kd === 'thr' ? 0.62 : kd === 'gear' ? 0.92 : 0.05, hy = top + H * at, left = kd === 'thr' && /1$/.test(t.name), right = kd === 'thr' && /2$/.test(t.name);
    let o = `<rect x="${sx - 2.2}" y="${top}" width="4.4" height="${H}" rx="2" fill="#0B0D10" stroke="#3A434C" stroke-width=".6"/>`;
    marks.forEach(([l, f]) => { const y = top + H * f; o += `<line x1="${sx - 6}" y1="${y}" x2="${sx + 6}" y2="${y}" stroke="#E9EEF2" stroke-width=".7"/>`;
      if (kd !== 'thr' || left) o += `<text x="${kd === 'thr' ? t.x - 1 : sx + 7}" y="${y + 2}" text-anchor="${kd === 'thr' ? 'end' : 'start'}" class="pbl" style="font-size:4.2px;fill:#E9EEF2">${l}</text>`; });
    if (kd === 'thr') { const w = Math.min(t.w + 6, 26); o += `<rect x="${sx - 2.5}" y="${hy}" width="5" height="${bot - hy}" fill="#262B30"/><rect x="${sx - w / 2}" y="${hy - 6}" width="${w}" height="12" rx="3" fill="#1A1E22" stroke="#7D858D" stroke-width=".8"/><rect x="${sx - w / 2 + 2}" y="${hy - 4}" width="${w - 4}" height="3" rx="1.2" fill="#3A424A"/><text x="${sx}" y="${hy + 4.6}" text-anchor="middle" class="pbl" style="font-size:4px;fill:#E9EEF2">${left ? '1' : '2'}</text>`; }
    else if (kd === 'gear') o += `<line x1="${sx}" y1="${hy}" x2="${sx}" y2="${top + H * 0.5}" stroke="#2A2F35" stroke-width="3"/><circle cx="${sx}" cy="${hy}" r="${Math.min(9, t.w * 0.32)}" fill="#1A1D20" stroke="#AEB6BE" stroke-width="1.4"/><circle cx="${sx}" cy="${hy}" r="${Math.min(4, t.w * 0.14)}" fill="#D9DEE2"/>`;
    else { const w = Math.min(t.w + 2, 20); o += `<rect x="${sx - w / 2}" y="${hy - 5}" width="${w}" height="10" rx="${kd === 'spd' ? 2 : 5}" fill="${kd === 'spd' ? '#1A1E22' : '#D9DEE2'}" stroke="#7D858D" stroke-width=".8"/>`; }
    return o; }
  if (kd === 'disc') { const r = Math.min(4.5, t.w * 0.32); return `<circle cx="${cx}" cy="${t.y + t.h * 0.62}" r="${r + 1.4}" fill="#2A2F35"/><circle cx="${cx}" cy="${t.y + t.h * 0.62}" r="${r}" fill="#C62828"/>`; }
  if (kd === 'trimw') { const top = t.y + 8, H = t.h - 16, w = Math.min(t.w - 2, 10); let o = `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${H}" rx="${w / 2}" fill="#1A1E22" stroke="#59636D" stroke-width=".8"/>`;
    for (let i = 1; i < 26; i++) o += `<line x1="${cx - w / 2 + 1}" y1="${top + H * i / 26}" x2="${cx + w / 2 - 1}" y2="${top + H * i / 26}" stroke="#454E57" stroke-width=".8"/>`;
    return o + `<rect x="${cx - w / 2 - 1}" y="${top + H * 0.42}" width="${w + 2}" height="4" fill="#E9EEF2" opacity=".8"/>`; }
  if (kd === 'park') { const r = Math.max(5, Math.min(m * 0.4, 12)); return `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#2A2F35"/><rect x="${cx - r * 1.3}" y="${cy - r * 0.32}" width="${r * 2.6}" height="${r * 0.64}" rx="${r * 0.3}" fill="#D9DEE2" stroke="#7D858D"/><text x="${cx - r * 1.4}" y="${cy - r - 1}" class="pbl" style="font-size:4px;fill:#E9EEF2">OFF</text><text x="${cx + r * 0.6}" y="${cy - r - 1}" class="pbl" style="font-size:4px;fill:#E9EEF2">ON</text>`; }
  if (kd === 'crank') { const w = Math.min(t.w - 8, 30), h = Math.min(gh - 2, 12); return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="3" fill="#D13B2E" stroke="#7E1414"/><rect x="${cx - w / 2 + 3}" y="${cy - 1}" width="${w - 6}" height="2" fill="#0B0F12" opacity=".5"/>`; }
  if (kd === 'disp') { const w = Math.min(t.w - 4, 40), h = Math.max(6, Math.min(gh - 1, 14)); return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="1.5" fill="#050607" stroke="#3A434C"/><text x="${cx}" y="${cy + h * 0.22}" text-anchor="middle" class="pbl" style="font-size:${Math.min(7, h * 0.6)}px;fill:${/VOLT/.test(t.name) ? '#F2A623' : '#3CCB7F'}">${/VOLT/.test(t.name) ? '28.5V' : /XPDR/.test(t.name) ? '2000' : /RUD/.test(t.name) ? 'R 0.0' : /ACTIVE/.test(t.name) ? '122.800' : /STBY/.test(t.name) ? '118.100' : '- - -'}</text>`; }
  if (kd === 'ind') { const w = Math.min(t.w - 6, 22), h = Math.min(gh - 1, 11); const red = /FIRE/.test(t.name); return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="1" fill="#0D1013" stroke="#555E66" stroke-width=".7"/><text x="${cx}" y="${cy + 1.6}" text-anchor="middle" class="pbl" style="font-size:${Math.min(4.6, w / 5)}px;fill:${red ? '#B83A32' : '#B98420'}">${red ? 'FIRE' : /FAULT/.test(t.name) ? 'FAULT' : /BAT/.test(t.name) ? 'ON BAT' : /GEAR/.test(t.name) ? 'UNLK' : 'G/S'}</text>`; }
  if (kd === 'box') { const w = Math.min(t.w - 10, 50), h = Math.min(gh - 2, 30); return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="4" fill="#2A3036" stroke="#56606B"/>`; }
  if (kd === 'fire') { const w = Math.min(t.w - 8, 46), h = Math.min(gh - 2, 16); return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="3" fill="#C62828" stroke="#7E1414"/><rect x="${cx - w / 2 + 3}" y="${cy - h / 2 + 3}" width="${w - 6}" height="${Math.max(2, h / 3)}" rx="1" fill="#E65A5A" opacity=".55"/>`; }
  if (kd === 'master') { const w = Math.min(t.w - 8, 34), h = Math.min(gh - 2, 18), c = /WARN/.test(t.name) ? '#7A1B1B' : '#6E5410', l = /WARN/.test(t.name) ? '#FF4D4D' : '#FFB733';
    return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="2" fill="${c}" stroke="#111"/><rect x="${cx - w / 2 + 3}" y="${cy - 1.5}" width="${w - 6}" height="3" fill="${l}" opacity=".7"/>`; }
  if (kd === 'knob') { const r = Math.max(3.5, Math.min(m * 0.42, 11)); return `<circle cx="${cx}" cy="${cy}" r="${r + 2.2}" fill="#2A2E33"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#121417" stroke="#9AA4AE" stroke-width=".9"/><line x1="${cx}" y1="${cy}" x2="${cx + r * 0.55}" y2="${cy - r * 0.85}" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>`; }
  if (kd === 'gauge') { const r = Math.max(4, Math.min(m * 0.46, 13)); return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#08090A" stroke="#8C959E" stroke-width=".9"/><path d="M${cx - r * 0.7} ${cy + r * 0.45}A${r * 0.82} ${r * 0.82} 0 1 1 ${cx + r * 0.7} ${cy + r * 0.45}" fill="none" stroke="#E9ECEF" stroke-width=".7" stroke-dasharray="1.2 2"/><line x1="${cx}" y1="${cy}" x2="${cx - r * 0.35}" y2="${cy - r * 0.6}" stroke="#FFFFFF" stroke-width="1.2"/>`; }
  if (kd === 'keys') { const w = Math.min(t.w - 6, 40), h = Math.min(gh - 2, 18), x = cx - w / 2, y = cy - h / 2; let k = ''; for (let i = 0; i < 4; i++) k += `<rect x="${x + 2 + i * (w - 4) / 4}" y="${y + h * 0.5}" width="${(w - 4) / 4 - 2}" height="${h * 0.38}" rx="1" fill="#2C3136"/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#1A1D20"/><rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h * 0.36}" fill="#0A1A10"/>` + k; }
  if (kd === 'key') { const w = Math.min(t.w - 6, 22), h = Math.min(gh - 1, 12); return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="2" fill="#22272C" stroke="#9AA5B1" stroke-width=".8"/><rect x="${cx - 3}" y="${cy - h / 2 + 2}" width="6" height="2" fill="#3CCB7F" opacity=".35"/>`; }
  if ((kd === 'pb' || kd === 'pbg') && look.real) { const w = Math.min(t.w - 6, 28), h = Math.min(gh - 1, 22, w * 0.95), x = cx - w / 2, y = cy - h / 2, two = h >= 12; let [u, d] = legend(t.name); if (!two) { d = d || u; u = ''; } const f = Math.max(2.6, Math.min(5.6, w / 5.4, two ? h / 3.1 : h / 1.9));
    const b = `<rect x="${x - 1.2}" y="${y - 1.2}" width="${w + 2.4}" height="${h + 2.4}" rx="2" fill="#2B3138"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="#0D1013"/><line x1="${x + 1.5}" y1="${cy}" x2="${x + w - 1.5}" y2="${cy}" stroke="#262B30" stroke-width=".7"/>` +
      (u ? `<text x="${cx}" y="${y + h * 0.4}" text-anchor="middle" class="pbl" style="font-size:${f}px;fill:${u === 'ON' ? '#5BB8F5' : u === 'AUTO' ? '#FF5A4D' : '#E5A33A'}">${u}</text>` : '') +
      (d ? `<text x="${cx}" y="${two ? y + h * 0.86 : cy + f * 0.36}" text-anchor="middle" class="pbl" style="font-size:${f}px;fill:${LEGC[d] || '#E9EEF2'}">${d}</text>` : '');
    return kd === 'pbg' ? b + `<path d="M${x - 2.5} ${y - 1}h${w + 5}v${h * 0.5}h${-(w + 5)}z" fill="#C8372B" fill-opacity=".45" stroke="#E0533F" stroke-width=".9"/>` : b; }
  if (kd === 'knob' && look.real) { const r = Math.max(3.5, Math.min(m * 0.44, 11.5)); return `<circle cx="${cx}" cy="${cy}" r="${r + 2.6}" fill="#3C4651" stroke="#2A3139" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#D9DEE2" stroke="#9AA4AE" stroke-width=".8"/><circle cx="${cx - r * 0.25}" cy="${cy - r * 0.3}" r="${r * 0.55}" fill="#F2F4F6" opacity=".5"/><path d="M${cx} ${cy}L${cx + r * 0.6} ${cy - r * 0.95}" stroke="#2A3036" stroke-width="${Math.max(1.4, r * 0.24)}" stroke-linecap="round"/>`; }
  if (kd === 'pb' || kd === 'pbg') { const w = Math.min(t.w - 8, 26), h = Math.min(gh - 1, 22), x = cx - w / 2, y = cy - h / 2;
    const b = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#101316" stroke="#A7B3BF" stroke-width=".8"/><rect x="${x + 3}" y="${y + h * 0.18}" width="${w - 6}" height="${Math.max(1.5, h * 0.18)}" fill="#C98A1A" opacity=".38"/><rect x="${x + 3}" y="${y + h * 0.6}" width="${w - 6}" height="${Math.max(1.5, h * 0.18)}" fill="#DCE3EA" opacity=".3"/>`;
    return kd === 'pbg' ? b + `<rect x="${x - 2.5}" y="${y - 2.5}" width="${w + 5}" height="${h + 5}" rx="2" fill="#D13B2E" fill-opacity=".22" stroke="#E0533F" stroke-width="1.2"/>` : b; }
  /* toggle switch, Boeing / light aircraft: a nut and a bat lever pointing up (guarded ones get a red cover outline) */
  const r = Math.max(2.5, Math.min(m * 0.2, 5)), L = Math.min(gh * 0.42, 12);
  const g = `<circle cx="${cx}" cy="${cy + L * 0.45}" r="${r + 1.6}" fill="#202326" stroke="#8E959C" stroke-width=".7"/><line x1="${cx}" y1="${cy + L * 0.45}" x2="${cx}" y2="${cy - L * 0.55}" stroke="#D5D9DD" stroke-width="${Math.max(1.8, r * 0.75)}" stroke-linecap="round"/><circle cx="${cx}" cy="${cy - L * 0.55}" r="${Math.max(1.6, r * 0.62)}" fill="#F2F4F6"/>`;
  return kd === 'tgg' ? g + `<rect x="${cx - r - 6}" y="${cy - L * 0.55 - 5}" width="${2 * r + 12}" height="${L + r + 9}" rx="3" fill="#D13B2E" fill-opacity=".2" stroke="#E0533F" stroke-width="1.1"/>` : g; }
/* stylised screen pictures: attitude for a PFD, compass arc for an ND, engine dials, systems page, FMS page, radio frequencies */
function screen(n, x, y, w, h) { const cx = x + w / 2, ix = x + 6, iy = y + 18, iw = w - 12, ih = h - 24; if (iw < 20 || ih < 16) return '';
  const N = n.toUpperCase();
  if (/PFD|ADI|STBY ATT|ISIS|STANDBY|ISI/.test(N) && !/LOWER|PANEL/.test(N)) { const mx = ix + iw * 0.2, mw = iw * 0.6, hy = iy + ih * 0.52;
    return `<rect x="${mx}" y="${iy}" width="${mw}" height="${hy - iy}" fill="#2D6DB4"/><rect x="${mx}" y="${hy}" width="${mw}" height="${iy + ih - hy}" fill="#8A5A2B"/><line x1="${mx}" y1="${hy}" x2="${mx + mw}" y2="${hy}" stroke="#fff" stroke-width="1.2"/>` +
      [-2, -1, 1, 2].map(i => `<line x1="${cx - mw * (i % 2 ? 0.08 : 0.16)}" y1="${hy + i * ih * 0.09}" x2="${cx + mw * (i % 2 ? 0.08 : 0.16)}" y2="${hy + i * ih * 0.09}" stroke="#fff" stroke-width=".7"/>`).join('') +
      `<path d="M${cx - mw * 0.3} ${hy}h${mw * 0.17}v4M${cx + mw * 0.3} ${hy}h${-mw * 0.17}v4" stroke="#F5D33A" stroke-width="2.2" fill="none"/><rect x="${cx - 2}" y="${hy - 2}" width="4" height="4" fill="#F5D33A"/>` +
      `<rect x="${ix}" y="${iy + 4}" width="${iw * 0.15}" height="${ih - 8}" fill="#3B4249"/><rect x="${ix + iw * 0.85}" y="${iy + 4}" width="${iw * 0.15}" height="${ih - 8}" fill="#3B4249"/><rect x="${ix}" y="${hy - 6}" width="${iw * 0.17}" height="12" fill="#000" stroke="#F5D33A" stroke-width=".8"/><rect x="${ix + iw * 0.83}" y="${hy - 6}" width="${iw * 0.17}" height="12" fill="#000" stroke="#F5D33A" stroke-width=".8"/>`; }
  if (/\bND\b|MFD|HSI/.test(N) && !/SEL/.test(N)) { const r = Math.min(iw * 0.48, ih * 0.82), oy = iy + ih - 6; let tk = '';
    for (let a = -60; a <= 60; a += 10) { const rad = (a - 90) * Math.PI / 180, l = a % 30 ? 4 : 8; tk += `<line x1="${cx + Math.cos(rad) * r}" y1="${oy + Math.sin(rad) * r}" x2="${cx + Math.cos(rad) * (r - l)}" y2="${oy + Math.sin(rad) * (r - l)}" stroke="#fff" stroke-width=".9"/>`; }
    return `<path d="M${cx - r * 0.866} ${oy - r * 0.5}A${r} ${r} 0 0 1 ${cx + r * 0.866} ${oy - r * 0.5}" fill="none" stroke="#fff" stroke-width="1"/>` + tk +
      `<path d="M${cx} ${oy - 4}L${cx + r * 0.25} ${oy - r * 0.55}L${cx + r * 0.05} ${oy - r * 0.95}" stroke="#E04BD8" stroke-width="1.6" fill="none"/><circle cx="${cx + r * 0.25}" cy="${oy - r * 0.55}" r="2.4" fill="none" stroke="#fff"/><path d="M${cx - 5} ${oy}L${cx} ${oy - 10}L${cx + 5} ${oy}Z" fill="#F5D33A"/>`; }
  if (/E\/WD|UPPER|ENGINE|EWD|E\/W|ENG/.test(N)) { const r = Math.min(iw * 0.18, ih * 0.2); let o = '';
    [0.28, 0.72].forEach(f => { const gx = ix + iw * f, gy = iy + r + 6; o += `<path d="M${gx - r} ${gy}A${r} ${r} 0 1 1 ${gx + r * 0.7} ${gy + r * 0.7}" fill="none" stroke="#fff" stroke-width="1.1"/><line x1="${gx}" y1="${gy}" x2="${gx + r * 0.3}" y2="${gy - r * 0.95}" stroke="#3CCB7F" stroke-width="1.8"/><rect x="${gx + 2}" y="${gy + 3}" width="${r * 0.9}" height="9" fill="#000" stroke="#777" stroke-width=".6"/>`;
      o += `<path d="M${gx - r * 0.8} ${gy + r * 1.9}A${r * 0.8} ${r * 0.8} 0 1 1 ${gx + r * 0.56} ${gy + r * 2.46}" fill="none" stroke="#fff" stroke-width=".9"/><line x1="${gx}" y1="${gy + r * 1.9}" x2="${gx - r * 0.2}" y2="${gy + r * 1.15}" stroke="#3CCB7F" stroke-width="1.5"/>`; });
    for (let i = 0; i < 3; i++) o += `<rect x="${ix + 4}" y="${iy + ih - 6 - i * 6}" width="${iw * (0.3 + 0.15 * i)}" height="2.5" fill="${i ? '#3CCB7F' : '#3FC4E8'}" opacity=".8"/>`;
    return o; }
  if (/CDU|MCDU|FMS/.test(N)) { const sh = Math.min(ih * 0.55, iw * 0.55), sx = cx - sh * 0.75, sw = sh * 1.5; let o = `<rect x="${sx}" y="${iy}" width="${sw}" height="${sh}" fill="#000" stroke="#4B535B"/>`;
    for (let i = 0; i < 6; i++) o += `<rect x="${sx + 5}" y="${iy + 5 + i * (sh - 8) / 6}" width="${sw * (i % 2 ? 0.35 : 0.55)}" height="2.4" fill="${i % 2 ? '#3FC4E8' : '#E9ECEF'}" opacity=".85"/><rect x="${sx + sw * 0.62}" y="${iy + 5 + i * (sh - 8) / 6}" width="${sw * 0.3}" height="2.4" fill="#3CCB7F" opacity=".8"/>`;
    const ky = iy + sh + 4, kh = iy + ih - ky; if (kh > 10) { const cols = 8, rows = Math.max(2, Math.floor(kh / 9)); for (let r2 = 0; r2 < rows; r2++) for (let c = 0; c < cols; c++) o += `<rect x="${ix + 4 + c * (iw - 8) / cols}" y="${ky + r2 * kh / rows}" width="${(iw - 8) / cols - 3}" height="${kh / rows - 2.5}" rx="1.2" fill="#2E3439"/>`; }
    for (let i = 0; i < 6; i++) { o += `<rect x="${sx - 9}" y="${iy + 4 + i * (sh - 8) / 6}" width="6" height="4" fill="#2E3439"/><rect x="${sx + sw + 3}" y="${iy + 4 + i * (sh - 8) / 6}" width="6" height="4" fill="#2E3439"/>`; }
    return o; }
  if (/RMP|RADIO|AUDIO|ACP/.test(N)) { const bw = iw * 0.32; return [0.08, 0.6].map(f => `<rect x="${ix + iw * f}" y="${iy + 1}" width="${bw}" height="${Math.min(ih - 2, 14)}" fill="#000"/><rect x="${ix + iw * f + 4}" y="${iy + 5}" width="${bw - 8}" height="${Math.min(ih - 10, 6)}" fill="${f < .5 ? '#F2A623' : '#3CCB7F'}" opacity=".75"/>`).join(''); }
  if (/ANNUNCIATOR|DOORS|CCAS|ALERT/.test(N)) { const cols = Math.max(3, Math.round(iw / 22)), rows = Math.max(1, Math.round(ih / 10)); let o = ''; for (let r2 = 0; r2 < rows; r2++) for (let c = 0; c < cols; c++) o += `<rect x="${ix + c * iw / cols + 1}" y="${iy + r2 * ih / rows + 1}" width="${iw / cols - 2}" height="${ih / rows - 2}" fill="${(r2 * 7 + c * 3) % 11 === 0 ? '#5A4410' : '#141719'}"/>`; return o; }
  if (/SD|LOWER|SYS/.test(N)) { const y2 = iy + ih * 0.35; return `<path d="M${ix + iw * 0.15} ${iy + ih * 0.15}v${ih * 0.6}M${ix + iw * 0.5} ${iy + ih * 0.15}v${ih * 0.6}M${ix + iw * 0.85} ${iy + ih * 0.15}v${ih * 0.6}M${ix + iw * 0.15} ${y2}h${iw * 0.7}" stroke="#3CCB7F" stroke-width="1.4" fill="none"/>` + [0.15, 0.5, 0.85].map(f => `<circle cx="${ix + iw * f}" cy="${iy + ih * 0.6}" r="4" fill="none" stroke="#3CCB7F" stroke-width="1.2"/>`).join(''); }
  if (/G1000|MFD|PFD/.test(N)) return '';
  return ''; }
const lab = (ac, t) => ac.short && t.name in ac.short ? ac.short[t.name] : t.name;
/* Airbus push-button captions: [upper, lower], unlit as on the ground with nothing selected. Upper is amber unless noted. */
const LEG = [[/^(EMER GEN MAN ON|EVAC COMMAND)/, ['', '']], [/^IR \d/, ['FAULT', 'ALIGN']], [/^(FADEC GND PWR|BLUE PUMP OVRD|SVCE INT OVRD|AVNCS COMPT LT)/, ['', 'ON']], [/^LEAK MEAS/, ['', 'OFF']], [/^APU AUTO EXTING/, ['TEST', 'RESET']], [/^OXY TMR RESET/, ['FAULT', 'RESET']], [/^EXT PWR/, ['AVAIL', 'ON']], [/^APU MASTER/, ['FAULT', 'ON']], [/^APU START/, ['ON', 'AVAIL']], [/^X FEED/, ['OPEN', 'ON']], [/MODE SEL$/, ['FAULT', 'MAN']],
  [/^(RAM AIR|DITCHING|PROBE\/WINDOW HEAT|ENG [12] MAN START|N1 MODE)/, ['', 'ON']], [/A-ICE$/, ['FAULT', 'ON']], [/AGENT/, ['SQUIB', 'DISCH']], [/FIRE TEST|SMOKE TEST|CVR TEST/, ['', 'TEST']],
  [/^EVAC COMMAND/, ['EVAC', 'ON']], [/^GEN 1 LINE/, ['SMOKE', 'OFF']], [/^RAT & EMER GEN/, ['FAULT', '']], [/^PASSENGER/, ['SYS ON', '']], [/^(MECH|FWD|AFT)$/, ['CALL', '']], [/^EMER$/, ['CALL', 'ON']],
  [/DISCH$/, ['SMOKE', 'DISCH']], [/^RAIN RPLNT/, ['FAULT', '']], [/^AUTO BRK/, ['DECEL', 'ON']], [/^BRK FAN/, ['HOT', 'ON']], [/^AUTO LAND/, ['AUTO', 'LAND']], [/^RCDR GND CTL/, ['', 'ON']],
  [/^(HORN SHUT OFF|MASK MAN ON|EMER GEN TEST|RAT MAN ON|CVR ERASE|SIDE STICK PRIORITY|PFD\/ND XFR|PARKING)/, ['', '']], [/^(TERR|GPWS SYS|G\/S MODE|FLAP MODE|LDG FLAP 3)/, ['FAULT', 'OFF']],
  [/^(AP [12]|A\/THR|LOC|APPR|EXPED|FD |LS |CSTR|WPT|VOR\.D|NDB|ARPT|SPD\/MACH|HDG V\/S|METRIC ALT)/, ['', '•']], [/./, ['FAULT', 'OFF']]];
const legend = n => (LEG.find(([r]) => r.test(n)) || [0, ['', '']])[1];
const LEGC = { ON: '#5BB8F5', AVAIL: '#3CCB7F', OPEN: '#3CCB7F', DISCH: '#E9EEF2', TEST: '#E9EEF2', OFF: '#E9EEF2', MAN: '#E9EEF2', LAND: '#FF5A4D', '•': '#3CCB7F' };
/* a traced control: drawn to fill its measured rectangle, with the panel's own label above it */
function absCtl(ac, t) { const b = t.b, kd = t.kd, cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) / 2, L = lab(ac, t); let o = '';
  if (kd === 'knob') { const a = -14 * Math.PI / 180, gx = Math.sin(a), gy = -Math.cos(a);
    o = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#39434D" stroke="#1E252B" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.74}" fill="#B9C0C6"/><g transform="rotate(-14 ${cx} ${cy})"><rect x="${cx - r * 0.3}" y="${cy - r * 0.98}" width="${r * 0.6}" height="${r * 1.9}" rx="${r * 0.22}" fill="#E4E7EA" stroke="#8B949C" stroke-width=".4"/><line x1="${cx}" y1="${cy - r * 0.9}" x2="${cx}" y2="${cy - r * 0.1}" stroke="#15181B" stroke-width="${Math.max(.6, r * 0.12)}"/></g>`; }
  else if (kd === 'tg') o = `<circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="#0F1214" stroke="#59626B" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="#2A3036"/><line x1="${cx}" y1="${cy}" x2="${cx + r * 0.1}" y2="${cy + r * 0.95}" stroke="#C9CED3" stroke-width="${r * 0.34}" stroke-linecap="round"/><circle cx="${cx + r * 0.1}" cy="${cy + r * 0.95}" r="${r * 0.24}" fill="#EEF0F2"/>`;
  else if (kd === 'rnd') o = `<circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="#0E1113" stroke="#4A535B" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="#1D2226" stroke="#30373D" stroke-width=".4"/>`;
  else if (kd === 'disp') o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#1A2026" stroke="#0C0F12" stroke-width=".6"/><rect x="${b.x + b.w * 0.12}" y="${b.y + b.h * 0.2}" width="${b.w * 0.76}" height="${b.h * 0.6}" fill="#050607"/><text x="${cx}" y="${cy + b.h * 0.17}" text-anchor="middle" class="pbl" style="font-size:${Math.min(b.h * 0.46, b.w * 0.2)}px;fill:#F2A623">${/VOLT/.test(t.name) ? '28.5V' : '- - - -'}</text>`;
  else if (kd === 'ind') { const tx = /SMOKE/.test(t.name) ? 'SMOKE' : /BAT/.test(t.name) ? 'ON BAT' : 'OFF'; o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx=".8" fill="#0D1013" stroke="#7F8B97" stroke-width=".5"/><text x="${cx}" y="${cy + 1}" text-anchor="middle" class="pbl" style="font-size:${Math.min(3.2, b.w / (tx.length * 0.72))}px;fill:${/SMOKE/.test(t.name) ? '#A8443C' : '#B98420'}">${tx}</text>`; }
  else if (kd === 'keys') { o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1" fill="#1A1F24" stroke="#0C0F12" stroke-width=".5"/>`; for (let i = 0; i < 12; i++) o += `<rect x="${b.x + 1.5 + (i % 3) * (b.w - 3) / 3 + .6}" y="${b.y + 1.5 + Math.floor(i / 3) * (b.h - 3) / 4 + .6}" width="${(b.w - 3) / 3 - 1.2}" height="${(b.h - 3) / 4 - 1.2}" rx=".6" fill="#343C44"/>`; }
  else if (kd === 'pbr' || kd === 'pbk') { const red = kd === 'pbr', fire = /FIRE$/.test(t.name);
    o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1.4" fill="${red ? '#D8392B' : '#14171A'}" stroke="${red ? '#8E1F16' : '#4A525A'}" stroke-width=".6"/><rect x="${b.x + b.w * 0.14}" y="${b.y + 1}" width="${b.w * 0.72}" height="${Math.max(1, b.h * 0.08)}" rx=".5" fill="${red ? '#F0695C' : '#2C3339'}"/>` +
      (fire ? `<text x="${cx}" y="${cy - 0.5}" text-anchor="middle" class="pbl" style="font-size:${b.w * 0.24}px;fill:#fff">FIRE</text><text x="${cx}" y="${cy + b.w * 0.26}" text-anchor="middle" class="pbl" style="font-size:${b.w * 0.2}px;fill:#fff">PUSH</text>` : red ? '' : `<line x1="${b.x + 2}" y1="${cy}" x2="${b.x + b.w - 2}" y2="${cy}" stroke="#2C3339" stroke-width=".6"/>`); }
  else { let [u, d] = legend(t.name); const f = Math.min(b.w / 5.6, b.h / 3.3);
    o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1" fill="#252C33" stroke="#A9B4BE" stroke-width=".45"/><rect x="${b.x + b.w * 0.1}" y="${b.y + b.h * 0.1}" width="${b.w * 0.8}" height="${b.h * 0.8}" rx=".6" fill="#07090B"/>` +
      (u ? `<text x="${cx}" y="${b.y + b.h * 0.44}" text-anchor="middle" class="pbl" style="font-size:${f}px;fill:${u === 'ON' ? '#5BB8F5' : '#E5A33A'}">${u}</text>` : '') + (d ? `<text x="${cx}" y="${b.y + b.h * 0.8}" text-anchor="middle" class="pbl" style="font-size:${f}px;fill:${LEGC[d] || '#E9EEF2'}">${d}</text>` : ''); }
  const f = Math.max(2.1, Math.min(3.4, (b.w + 7) / Math.max(3, L.length) * 1.5));
  return `<g class="ft" data-t="${esc(t.id)}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="#000" fill-opacity="0"/>` + o + (L ? `<text x="${cx}" y="${b.y - 1.3}" text-anchor="middle" class="ftn" style="fill:#F2F5F8;font-size:${f.toFixed(1)}px">${esc(L)}</text>` : '') + '</g>'; }
function cbs(x, y, w, h) { let o = ''; const cols = Math.floor((w - 16) / 9), rows = Math.floor((h - 26) / 11); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const cx = x + 10 + c * 9 + (Math.floor(c / 8) * 2), cy = y + 24 + r * 11; if (cx > x + w - 6) continue; o += `<circle cx="${cx}" cy="${cy}" r="2.6" fill="#1A1E22" stroke="#8A96A2" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="1" fill="#E9EEF2" opacity=".6"/>`; } return o; }
function keyCap(t, L) { const x = t.x + 1, y = t.y + 1, w = t.w - 2, h = Math.min(t.h - 2, 18), f = Math.max(2.8, Math.min(6.4, (w - 2) / Math.max(2, L.length) * 1.55, h * 0.42));
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.8" fill="#1C2126" stroke="#7F8B97" stroke-width=".7"/><rect x="${x + w * 0.3}" y="${y + 1.3}" width="${w * 0.4}" height="1.4" rx=".6" fill="#3CCB7F" opacity=".35"/><text x="${x + w / 2}" y="${y + h / 2 + f * 0.55}" text-anchor="middle" class="pbl" style="font-size:${f.toFixed(1)}px;fill:#E9EEF2">${esc(L)}</text>`; }
function synoptic(T, rows) { if (!T.length) return ''; const ys = [...new Set(T.map(t => Math.round(t.y)))].sort((a, b) => a - b); let o = '';
  rows.forEach(r => { const y0 = ys[r]; if (y0 == null) return; const R = T.filter(t => Math.round(t.y) === y0); if (R.length < 2) return; const cy = y0 + 9 + (R[0].h - 10) / 2;
    o += `<line x1="${R[0].x + R[0].w / 2}" y1="${cy}" x2="${R[R.length - 1].x + R[R.length - 1].w / 2}" y2="${cy}" stroke="#A8E0BB" stroke-width="1.6" opacity=".55"/>`; });
  return o; }
function svg(ac) { if (ac._svg) return ac._svg; const T = targets(ac), out = [], LK = LOOK[ac.style] || LOOK.ga;
  out.push(`<rect x="0" y="0" width="1000" height="${ac.h}" fill="${LK.bg}"/>`);
  (ac.shapes || []).forEach(pt => out.push(`<polygon points="${pt.join(' ')}" fill="${LK.zone}" stroke="${LK.edge}" stroke-opacity=".35" stroke-width="1.5"/>`));
  (ac.zones || []).forEach(([n, x, y, w, h]) => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${LK.zone}"/><text x="${x + w - 8}" y="${y + h - 6}" text-anchor="end" class="fz">${esc(n.toUpperCase())}</text>`));
  ac.p.forEach(([n, x, y, w, h, it, k, d]) => { const scr = k === 's', g = k === 'g';
    if (d) { out.push(`<g class="fp"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${LK.pan}" stroke="#2C343C" stroke-width="1"/>` + (it.length ? '' : `<text x="${x + w / 2}" y="${y + h / 2 + 2}" text-anchor="middle" class="fpn" style="fill:#AEB9C4;font-size:4.5px">${esc(n)}</text>`) +
      d.map(e => e[0] === 't' ? `<text x="${e[2]}" y="${e[3] + e[4] * 0.36}" text-anchor="middle" class="fpn" style="fill:#F2F5F8;font-size:${e[4]}px">${esc(e[1])}</text>` : e[0] === 'l' ? `<line x1="${e[1]}" y1="${e[2]}" x2="${e[3]}" y2="${e[4]}" stroke="${e[5]}" stroke-width="${e[5] === '#C9D2DA' ? .6 : 1.1}" stroke-linecap="round"/>` :
        `<rect x="${e[2]}" y="${e[3]}" width="${e[4]}" height="${e[5]}" fill="${LK.pan}" stroke="#DCE3EA" stroke-width=".5"/><text x="${e[2] + e[4] / 2}" y="${e[3] + e[5] / 2 + 1.1}" text-anchor="middle" class="ftn" style="fill:#F2F5F8;font-size:3px">${esc(e[1])}</text>`).join('') + '</g>'); return; }
    out.push(`<g class="fp"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${scr ? 3 : 5}" fill="${scr ? LK.scr : g ? LK.zone : LK.pan}" stroke="${scr ? '#2B3137' : LK.edge}" stroke-width="${scr ? 3 : 1.2}"${g ? ' stroke-dasharray="4 4"' : ''}/>` +
      (!g && !scr && LK !== LOOK.ga ? [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="1.3" fill="#2A3036"/>`).join('') : '') +
      (scr && (!it || !it.length) ? screen(n, x, y, w, h) : '') + (g && /CIRCUIT BREAKERS/.test(n) ? cbs(x, y, w, h) : '') +
      (LK.real && !scr && !g && ac.lines && ac.lines[n] ? synoptic(T.filter(t => t.panel === n), ac.lines[n]) : '') +
      `<text x="${LK.real && !scr && !(h < 46 && it && it.length) ? x + w / 2 : x + 6}"${LK.real && !scr && !(h < 46 && it && it.length) ? ' text-anchor="middle"' : ''} y="${it && it.length && h < 46 ? y + h / 2 + 4 : y + 13}" class="fpn${scr ? ' scr' : ''}" style="${scr ? '' : `fill:${LK.lab};`}font-size:${Math.min(11, (h < 46 && it && it.length ? Math.min(w * 0.3, n.length * 6.4 + 12) - 6 : w - 10) / (n.length * 0.64)).toFixed(1)}px">${esc(n)}</text></g>`); });
  T.forEach(t => { if (t.whole) return; if (t.b) { out.push(absCtl(ac, t)); return; } const kd = kindOf(t.name, t.k, LK, ac.look, t.panel);
    const onKey = LK.real && kd === 'key', noLab = LK.real && /^(thr|flaps|spd|trimw|disc|gear|park)$/.test(kd), up = LK.real && !onKey && t.k !== 'l' && !/^(stick|tiller|box)$/.test(kd), t2 = up ? Object.assign({}, t, { y: t.y + 7, h: t.h + 3 }) : t, L = lab(ac, t);
    out.push(`<g class="ft" data-t="${esc(t.id)}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="3" fill="#000" fill-opacity="${up || onKey || noLab ? 0 : t.k === 'l' ? .22 : .1}" stroke="#000" stroke-opacity="${up || onKey || noLab ? 0 : .18}" stroke-width=".8"/>` + (onKey ? keyCap(t, L) : ctl(t2, kd, LK)) + (onKey || noLab ? '</g>' :
      `<text x="${t.x + t.w / 2}" y="${up ? t.y + 7.5 : t.y + t.h - 3.5}" text-anchor="middle" class="ftn" style="fill:${LK.lab};font-size:${(up ? Math.max(3, Math.min(7.2, (t.w + 1) / Math.max(3, L.length) * 1.42)) : Math.max(5.2, Math.min(10.5, t.w / Math.max(4, L.length) * 1.6))).toFixed(1)}px">${esc(L)}</text></g>`)); });
  return (ac._svg = out.join('')); }
/* real cockpit photos under free licences (Wikimedia Commons). Shown with the credit on the picture and on sources.html.
   A flow on a photo is placed freely (no named controls), like on your own photo, but it can be shared, since everyone has the same picture. */
const C = 'https://commons.wikimedia.org/wiki/File:';
const PHOTOS = [
  { id: 'ph-a320', ac: 'a320', name: 'Airbus A320 flight deck (simulator)', file: 'img/cockpits/a320-sim.jpg', w: 2000, h: 1500, by: 'Steve Jurvetson', lic: 'CC BY 2.0', licUrl: 'https://creativecommons.org/licenses/by/2.0/', src: C + 'Airbus_A320_Glass_Cockpit.jpg' },
  { id: 'ph-a320af', ac: 'a320', name: 'Airbus A320 flight deck (Air France)', file: 'img/cockpits/a320-deck.jpg', w: 1024, h: 683, by: 'Louis from Paris', lic: 'CC BY-SA 2.0', licUrl: 'https://creativecommons.org/licenses/by-sa/2.0/', src: C + 'Cockpit_of_Airbus_A320-211_Air_France_(F-GFKH).jpg' },
  { id: 'ph-a320ovh', ac: 'a320', name: 'Airbus A320 overhead panel', file: 'img/cockpits/a320-ovhd.jpg', w: 2000, h: 1194, by: 'Olivier Cleynen', lic: 'CC BY-SA 3.0', licUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', src: C + 'Overhead_panel_of_an_Airbus_A320_during_cruise.jpg' },
  { id: 'ph-b738', ac: 'b738', name: 'Boeing 737-800 flight deck', file: 'img/cockpits/b738-deck.jpg', w: 1280, h: 960, by: 'Cory W. Watts', lic: 'CC BY-SA 2.0', licUrl: 'https://creativecommons.org/licenses/by-sa/2.0/', src: C + 'The_737-800_Flight_Deck_(3852492599).jpg' },
  { id: 'ph-b738b', ac: 'b738', name: 'Boeing 737-800 flight deck (second)', file: 'img/cockpits/b738-deck2.jpg', w: 1280, h: 960, by: 'Cory W. Watts', lic: 'CC BY-SA 2.0', licUrl: 'https://creativecommons.org/licenses/by-sa/2.0/', src: C + 'The_Flight_Deck_of_the_Boeing_737-800._(2956276002).jpg' },
  { id: 'ph-atr72ovh', ac: 'atr72', name: 'ATR 72 overhead panel', file: 'img/cockpits/atr72-ovhd.jpg', w: 2000, h: 1935, by: 'Olivier Cleynen', lic: 'CC BY-SA 3.0, cropped', licUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', src: C + 'Overhead_panel_of_an_ATR_72_cockpit.jpg' },
  { id: 'ph-atr72eng', ac: 'atr72', name: 'ATR 72 engine instrument panel', file: 'img/cockpits/atr72-eng.jpg', w: 1415, h: 2000, by: 'Olivier Cleynen', lic: 'CC BY-SA 3.0', licUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', src: C + 'Engine_instrument_panel_of_an_ATR_72_cockpit.jpg' }
];
const API = { list: LIST, photos: PHOTOS, photo: id => PHOTOS.find(p => p.id === id) || null, get: id => LIST.find(a => a.id === id) || null, targets, byId, hit, svg };
if (typeof module === 'object' && module.exports) module.exports = API; else G.BBFLOWAC = API;
})(typeof window !== 'undefined' ? window : globalThis);
