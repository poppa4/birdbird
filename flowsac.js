/* Birdbird – cockpit schematics for the flow trainer (flows.html).
   Our own drawings, not photographs: the panels of each cockpit in their usual places, roughly to scale, with every control
   named so a tap lands on "BAT 1" and not just on a spot in a picture. Not a substitute for the aircraft's documents: layouts
   vary between variants and operators, which is why a user can also put their own cockpit photo or PDF behind a flow.
   Panel: [name, x, y, w, h, items[], kind]  kind: undefined panel | 's' screen | 'l' levers | 'g' area (no switches drawn).
   Coordinates are in a 1000-wide canvas; h is the canvas height per aircraft. Pure data + an SVG string builder (runs in Node). */
(function (G) {
'use strict';
/* Airbus A320: every panel and control placed from one square-on picture of the whole flight deck, so the drawing is 1:1 in
   layout: positions and sizes were measured on the flight deck overview in the FlyByWire A32NX documentation
   (docs.flybywiresim.com, A320neo), cross-checked against a photo of a real overhead panel (Olivier Cleynen, CC BY-SA 3.0).
   The drawing itself is Birdbird's own; no part of those pictures is used. Numbers below are in the reference frame
   (1426 wide); fbp() scales them to the drawing. Item: [name, x, y, w, h, kind, text]. Kinds: pb push-button, pbr red guard,
   pbk black guard, knob, tg toggle, tgg guarded toggle, rnd round button, key (its label on the key), disp, ind, keys, mw/mc
   master lights, and the levers. Deco: ['t', text, x, y, size], ['l', x1, y1, x2, y2, colour], ['b', text, x, y, w, h] a boxed
   label, ['d', text, x, y, w, h] a display window, ['c', cx, cy, r] a round light or speaker. */
const FB = 1000 / 1426, fx = v => +(v * FB).toFixed(1);
const fbp = (n, x0, y0, x1, y1, items, deco) => [n, fx(x0), fx(y0), fx(x1 - x0), fx(y1 - y0),
  (items || []).map(([nm, x, y, w, h, kd, tx]) => ({ n: nm, kd: kd || 'pb', tx, b: [fx(x), fx(y), fx(w), fx(h)] })), 'a',
  (deco || []).map(d => d[0] === 't' ? ['t', d[1], fx(d[2]), fx(d[3]), fx(d[4] || 7)] : d[0] === 'l' ? ['l', fx(d[1]), fx(d[2]), fx(d[3]), fx(d[4]), d[5] || '#7FD9A0'] : d[0] === 'c' ? ['c', fx(d[1]), fx(d[2]), fx(d[3])] : [d[0], d[1], fx(d[2]), fx(d[3]), fx(d[4]), fx(d[5])])];
const fbs = (n, x, y, w, h) => [n, fx(x), fx(y), fx(w), fx(h), [], 's'];
const T = (n, cx, cy, kd) => [n, cx - 8, cy - 8, 16, 16, kd || 'tg'], R = (n, cx, cy, d) => [n, cx - d / 2, cy - d / 2, d, d, 'rnd'], N = (n, cx, cy, d) => [n, cx - d / 2, cy - d / 2, d, d, 'knob'], K = (n, x, y, w, h) => [n, x, y, w, h, 'key'];
const row = (names, xs, y, w, h, kd) => names.map((n, i) => [n, xs[i] - w / 2, y, w, h, kd]);
const ACX = [432, 452, 472, 492, 513, 533, 554];
const rmp = (id, dx, sfx) => fbp('RMP ' + id, 406 + dx, 1990, 583 + dx, 2090, [[`RMP ${id} ACTIVE`, 427 + dx, 2002, 52, 16, 'disp', '122.800'], K('XFER' + sfx, 485 + dx, 2003, 16, 14), [`RMP ${id} STBY/CRS`, 510 + dx, 2002, 52, 16, 'disp', '121.950'],
  K('VHF 1' + sfx, 423 + dx, 2033, 16, 9), K('VHF 2' + sfx, 444 + dx, 2033, 16, 9), K('VHF 3' + sfx, 464 + dx, 2033, 16, 9), K('HF 1' + sfx, 423 + dx, 2052, 16, 9), K('HF 2' + sfx, 464 + dx, 2052, 16, 9), K('AM' + sfx, 485 + dx, 2052, 16, 9), N(`RMP ${id} FREQ`, 525 + dx, 2048, 28),
  K('NAV' + sfx, 423 + dx, 2077, 16, 9), K('VOR' + sfx, 444 + dx, 2077, 16, 9), K('ILS' + sfx, 465 + dx, 2077, 15, 9), K('MLS' + sfx, 485 + dx, 2077, 16, 9), K('ADF' + sfx, 506 + dx, 2077, 16, 9), K('BFO' + sfx, 527 + dx, 2077, 16, 9), T(`RMP ${id} ON/OFF`, 556 + dx, 2076)],
  [['t', 'ACTIVE', 453 + dx, 1997, 5], ['t', 'STBY/CRS', 536 + dx, 1997, 5]]);
const acpItems = (dx, sfx) => [
  ...row(['VHF 1 TX', 'VHF 2 TX', 'VHF 3 TX', 'HF 1 TX', 'HF 2 TX', 'INT TX', 'CAB TX'].map(n => n + sfx), ACX.map(v => v + dx), 2103, 16, 10, 'key'),
  ...row(['VHF 1 VOL', 'VHF 2 VOL', 'VHF 3 VOL', 'HF 1 VOL', 'HF 2 VOL', 'INT VOL', 'CAB VOL'].map(n => n + sfx), ACX.map(v => v + dx), 2127, 12, 12, 'knob'),
  T('INT/RAD' + sfx, 439 + dx, 2156), K('VOICE' + sfx, 464 + dx, 2151, 17, 10), K('RESET' + sfx, 484 + dx, 2151, 17, 10), N('PA VOL' + sfx, 519 + dx, 2156, 12), K('PA TX' + sfx, 544 + dx, 2148, 22, 15),
  ...row(['VOR 1 VOL', 'VOR 2 VOL', 'MKR VOL', 'ILS VOL', 'MLS VOL', 'ADF 1 VOL', 'ADF 2 VOL'].map(n => n + sfx), ACX.map(v => v + dx), 2183, 12, 12, 'knob')];
const acp = (id, dx, sfx) => fbp('ACP ' + id, 406 + dx, 2092, 583 + dx, 2197, acpItems(dx, sfx));
/* the third audio control panel, on the overhead: the same unit, smaller in the reference picture */
const acp3 = () => fbp('ACP 3', 930, 640, 1110, 722, acpItems(0, ' OVHD').map(([n, x, y, w, h, k]) => [n, 950 + (x - 424) * 0.97, 653 + (y - 2103) * 0.69 + (y < 2110 ? 3 : y > 2140 && y < 2170 ? 7 : 0), w * 0.97, h * 0.75, k]));
const efis = (s, m) => { const X = x => m ? 1426 - x : x, B = (x, w) => m ? 1426 - x - w : x; return fbp('EFIS ' + s, B(435, 153), 1290, B(435, 153) + 153, 1378, [N('QNH ' + s, X(470), 1336, 18),
  ...['CSTR', 'WPT', 'VOR.D', 'NDB', 'ARPT'].map((n, i) => K(n + (m ? ' F/O' : ''), B([497, 517, 536, 554, 572][i], 12), 1300, 12, 7)), K('FD ' + s, B(459, 14), 1353, 14, 7), K('LS ' + s, B(477, 14), 1353, 14, 7),
  N('ND MODE ' + s, X(517), 1330, 26), N('ND RANGE ' + s, X(566), 1329, 26), T('ADF/VOR 1 ' + s, X(m ? 566 : 517), 1357), T('ADF/VOR 2 ' + s, X(m ? 517 : 566), 1357)], [['d', '1013', B(458, 26), 1307, 26, 11]]); };
const A320_P = [
  /* aft overhead */
  fbp('ELT', 322, 62, 496, 110, [['ELT', 349, 80, 26, 29, 'pbr'], R('ELT TEST/RESET', 450, 101, 17)], [['t', 'ELT', 410, 72, 7]]),
  fbp('BLANK 1', 322, 2, 496, 60), fbp('CKPT DOOR CONT', 322, 112, 496, 168, [], [['c', 358, 133, 4], ['c', 358, 147, 4], ['c', 358, 160, 4], ['c', 457, 133, 4], ['c', 457, 147, 4], ['t', 'STRIKE', 358, 122, 4.5], ['t', 'CHAN', 457, 122, 4.5]]), fbp('BLANK 2', 322, 170, 496, 263),
  fbp('READING LT L', 322, 265, 496, 360, [N('READING LT L', 448, 313, 24)], [['c', 385, 310, 36]]),
  fbp('BLANK 3', 322, 362, 496, 632, [], [['c', 410, 400, 26], ['c', 410, 480, 26]]),
  ['CIRCUIT BREAKERS', fx(498), fx(2), fx(430), fx(490), [], 'g'],
  fbp('PEDESTAL LT / AUDIO SWITCHING', 498, 494, 928, 632, [['TOILET', 598, 527, 21, 23, 'ind', 'OCCPD'], N('AUDIO SWITCHING', 857, 563, 24)], [['c', 560, 537, 20], ['c', 716, 566, 42], ['t', 'AUDIO SWITCHING', 857, 536, 6]]),
  fbp('MAINTENANCE', 930, 2, 1110, 215, [R('CVR HEADSET', 964, 40, 16), ['OXY TMR RESET', 954, 77, 24, 23], ['SVCE INT OVRD', 995, 77, 23, 23], ['AVNCS COMPT LT', 1069, 77, 24, 23],
    ['BLUE PUMP OVRD', 954, 123, 25, 31, 'pbk'], ['LEAK MEAS G', 1002, 123, 24, 31, 'pbk'], ['LEAK MEAS B', 1036, 123, 25, 31, 'pbk'], ['LEAK MEAS Y', 1069, 123, 24, 31, 'pbk'],
    ['APU AUTO EXTING TEST', 954, 182, 24, 23], R('APU AUTO EXTING RESET', 1005, 194, 18), ['FADEC GND PWR 1', 1036, 174, 25, 31, 'pbk'], ['FADEC GND PWR 2', 1069, 174, 24, 31, 'pbk']],
    [['t', 'OXYGEN', 966, 62, 6], ['t', 'HYD LEAK MEASUREMENT VALVES', 1048, 112, 5], ['t', 'APU', 972, 166, 6], ['t', 'ENG FADEC GND PWR', 1064, 166, 5]]),
  fbp('BLANK 4', 930, 217, 1110, 430), fbp('READING LT R', 930, 432, 1110, 512, [N('READING LT R', 1068, 471, 24)], [['c', 1000, 470, 36]]),
  fbp('DATA LOADING SELECTOR', 930, 514, 1110, 575, [['DATA LOADER DISPLAY', 998, 534, 74, 21, 'disp', ' '], K('DATA LOADER NEXT', 961, 521, 18, 12), K('DATA LOADER PREV', 961, 536, 18, 12), K('DATA LOADER SEL', 961, 551, 18, 12), T('DATA LOADER ON/OFF', 1093, 545)], [['t', 'DATA LOADING SELECTOR', 1040, 524, 5.5]]),
  fbp('BLANK 5', 930, 577, 1110, 632),
  /* overhead, left column */
  fbp('PA / DOOR VIDEO', 322, 640, 496, 700, [['PA', 381, 675, 25, 23], ['COCKPIT DOOR VIDEO', 451, 675, 24, 23]]),
  fbp('ADIRS', 322, 702, 496, 826, [['ON BAT', 396, 713, 26, 12, 'ind', 'ON BAT'], ['IR 1', 348, 735, 23, 23], ['IR 3', 400, 735, 23, 23], ['IR 2', 452, 735, 23, 23], N('IR MODE 1', 357, 780, 28), N('IR MODE 3', 409, 780, 28), N('IR MODE 2', 460, 779, 28),
    ['ADR 1', 349, 800, 23, 22], ['ADR 3', 401, 800, 23, 22], ['ADR 2', 453, 800, 23, 22]], [['t', 'ADIRS', 409, 707, 7]]),
  fbp('BLANK 6', 322, 828, 496, 858),
  fbp('FLT CTL 1', 322, 860, 496, 905, [['ELAC 1', 385, 879, 24, 22], ['SEC 1', 419, 879, 24, 22], ['FAC 1', 453, 879, 23, 22]], [['t', 'FLT CTL', 415, 866, 7]]),
  fbp('EVAC', 322, 907, 496, 950, [['EVAC COMMAND', 378, 918, 26, 26], R('HORN SHUT OFF', 431, 933, 24), T('CAPT & PURS', 469, 933)], [['t', 'EVAC', 425, 911, 6.5]]),
  fbp('EMER ELEC PWR', 322, 952, 496, 1000, [['EMER GEN TEST', 341, 962, 26, 34, 'pbk'], ['GEN 1 LINE', 379, 968, 24, 23], ['RAT & EMER GEN', 417, 968, 24, 23], ['EMER GEN MAN ON', 442, 959, 25, 36, 'pbr']], [['t', 'EMER ELEC PWR', 398, 955, 6]]),
  fbp('GPWS', 322, 1002, 496, 1038, [['TERR', 338, 1013, 23, 22], ['GPWS SYS', 371, 1013, 23, 22], ['G/S MODE', 404, 1013, 23, 22], ['FLAP MODE', 432, 1013, 23, 22], ['LDG FLAP 3', 461, 1013, 23, 22]], [['t', 'GPWS', 352, 1005, 5.5]]),
  fbp('RCDR', 322, 1040, 496, 1073, [['RCDR GND CTL', 379, 1048, 24, 22], R('CVR ERASE', 430, 1059, 22), R('CVR TEST', 470, 1058, 22)], [['t', 'RCDR', 350, 1058, 6.5]]),
  fbp('OXYGEN', 322, 1075, 496, 1113, [['MASK MAN ON', 377, 1080, 25, 31, 'pbr'], ['PASSENGER', 419, 1088, 24, 22], ['CREW SUPPLY', 460, 1088, 24, 22]], [['t', 'OXYGEN', 350, 1096, 6]]),
  fbp('CALLS', 322, 1115, 496, 1152, [R('MECH', 349, 1139, 22), R('ALL', 381, 1139, 22), R('FWD', 411, 1138, 22), R('AFT', 443, 1138, 22), ['EMER', 460, 1121, 24, 29, 'pbk']], [['t', 'CALLS', 411, 1118, 5.5]]),
  fbp('WIPER CPT', 322, 1154, 496, 1236, [R('RAIN RPLNT CPT', 391, 1178, 22), N('WIPER CPT', 457, 1185, 30)]),
  /* overhead, centre */
  fbp('BLANK 7', 498, 640, 928, 706),
  fbp('FIRE', 498, 708, 928, 783, [['ENG 1 AGENT 1', 522, 726, 22, 22], R('ENG 1 FIRE TEST', 533, 762, 12), ['ENG 1 FIRE', 554, 731, 74, 38, 'pbr'], ['ENG 1 AGENT 2', 639, 726, 23, 22],
    ['APU FIRE', 679, 722, 69, 37, 'pbr'], ['APU AGENT', 673, 763, 23, 18], R('APU FIRE TEST', 746, 768, 12),
    ['ENG 2 AGENT 1', 768, 726, 23, 22], ['ENG 2 FIRE', 800, 731, 74, 38, 'pbr'], ['ENG 2 AGENT 2', 886, 726, 23, 22], R('ENG 2 FIRE TEST', 897, 762, 12)],
    [['t', 'ENG 1', 591, 723, 7.5], ['t', 'APU', 713, 714, 7.5], ['t', 'ENG 2', 837, 723, 7.5], ['t', 'FIRE', 508, 745, 6], ['t', 'FIRE', 918, 745, 6]]),
  fbp('HYD', 498, 785, 928, 845, [['ENG 1 PUMP', 578, 818, 24, 23], ['RAT MAN ON', 639, 812, 22, 33, 'pbr'], ['BLUE ELEC PUMP', 702, 813, 25, 29, 'pbk'], ['PTU', 767, 802, 23, 23], ['ENG 2 PUMP', 827, 818, 24, 23], ['YELLOW ELEC PUMP', 872, 816, 24, 23]],
    [['b', 'GREEN', 577, 788, 27, 8], ['b', 'BLUE', 701, 788, 27, 8], ['b', 'YELLOW', 825, 788, 27, 8], ['l', 590, 796, 590, 812], ['l', 714, 796, 714, 808, '#7FB6F0'], ['l', 838, 796, 838, 812, '#E8D36A'], ['l', 838, 806, 884, 806, '#E8D36A'], ['l', 884, 806, 884, 811, '#E8D36A'],
      ['l', 608, 792, 698, 792], ['l', 731, 792, 762, 792, '#7FB6F0'], ['l', 795, 792, 822, 792, '#E8D36A'], ['l', 664, 804, 700, 804, '#7FB6F0'], ['t', 'HYD', 508, 815, 6]]),
  fbp('FUEL', 498, 847, 928, 905, [['X FEED', 702, 851, 24, 22], ['L TK PUMP 1', 562, 877, 23, 23], ['L TK PUMP 2', 595, 877, 23, 23], ['CTR TK PUMP 1', 667, 877, 23, 23], ['MODE SEL', 702, 877, 24, 23], ['CTR TK PUMP 2', 740, 877, 23, 23], ['R TK PUMP 1', 810, 877, 24, 23], ['R TK PUMP 2', 846, 877, 23, 23]],
    [['b', 'ENG 1', 578, 849, 27, 8], ['b', 'APU', 663, 849, 24, 8], ['b', 'ENG 2', 824, 849, 27, 8], ['l', 591, 857, 591, 869], ['l', 591, 863, 702, 863], ['l', 726, 863, 838, 863], ['l', 675, 857, 675, 863], ['l', 838, 857, 838, 869],
      ['l', 562, 869, 618, 869], ['l', 810, 869, 869, 869], ['l', 678, 863, 678, 870], ['l', 751, 863, 751, 870], ['t', 'FUEL', 508, 876, 6]]),
  fbp('ELEC', 498, 907, 928, 1002, [['COMMERCIAL', 538, 915, 23, 20], ['GALY & CAB', 538, 942, 23, 21], ['BAT 1 VOLT', 626, 918, 45, 19, 'disp', '27.8V'], ['BAT 1', 682, 918, 22, 21], ['BAT 2', 705, 918, 22, 21], ['BAT 2 VOLT', 736, 918, 45, 19, 'disp', '27.9V'], ['AC ESS FEED', 788, 927, 23, 22],
    ['IDG 1', 538, 970, 23, 29, 'pbr'], ['GEN 1', 582, 976, 23, 22], ['APU GEN', 652, 976, 23, 22], ['BUS TIE', 703, 962, 23, 22], ['EXT PWR', 757, 976, 23, 22], ['GEN 2', 826, 976, 23, 22], ['IDG 2', 868, 970, 23, 29, 'pbr']],
    [['b', 'DC BUS 1', 573, 913, 33, 8], ['b', 'DC BUS 2', 825, 913, 33, 8], ['b', 'AC BUS 1', 573, 942, 33, 8], ['b', 'AC ESS BUS', 697, 942, 36, 8], ['b', 'AC BUS 2', 825, 942, 33, 8],
      ['l', 590, 921, 590, 942], ['l', 590, 950, 590, 970], ['l', 841, 921, 841, 942], ['l', 841, 950, 841, 970], ['l', 606, 946, 697, 946], ['l', 733, 946, 788, 946], ['l', 811, 946, 825, 946], ['l', 593, 966, 703, 966], ['l', 726, 966, 838, 966],
      ['l', 561, 987, 582, 987], ['l', 849, 987, 868, 987], ['l', 675, 987, 700, 987], ['l', 700, 987, 700, 984], ['l', 729, 984, 729, 987], ['l', 729, 987, 757, 987], ['t', 'ELEC', 508, 955, 6]]),
  fbp('AIR COND', 498, 1004, 928, 1108, [N('PACK FLOW', 556, 1038, 28), N('TEMP CKPT', 651, 1035, 30), N('TEMP FWD CAB', 715, 1035, 30), N('TEMP AFT CAB', 778, 1035, 30), ['HOT AIR', 859, 1022, 23, 23], ['PACK 1', 533, 1055, 24, 22], ['PACK 2', 874, 1055, 23, 22],
    ['ENG 1 BLEED', 582, 1080, 23, 22], ['RAM AIR', 644, 1076, 24, 29, 'pbk'], ['APU BLEED', 704, 1080, 23, 22], N('X BLEED', 777, 1092, 28), ['ENG 2 BLEED', 826, 1080, 23, 22]],
    [['l', 594, 1056, 838, 1056], ['l', 594, 1066, 762, 1066], ['l', 792, 1066, 838, 1066], ['l', 594, 1056, 594, 1074], ['l', 838, 1056, 838, 1074], ['l', 656, 1066, 656, 1072], ['l', 715, 1066, 715, 1074], ['l', 651, 1052, 651, 1056], ['l', 715, 1052, 715, 1056], ['l', 778, 1052, 778, 1056],
      ['t', 'AIR COND', 508, 1055, 5]]),
  fbp('ANTI ICE', 498, 1110, 670, 1155, [['WING A-ICE', 525, 1127, 23, 22], ['ENG 1 A-ICE', 609, 1127, 23, 22], ['ENG 2 A-ICE', 648, 1127, 23, 22]], [['t', 'ANTI ICE', 574, 1116, 6]]),
  fbp('PROBE/WINDOW HEAT', 672, 1110, 742, 1155, [['PROBE/WINDOW HEAT', 703, 1127, 23, 22]], [['t', 'PROBE/WINDOW', 707, 1114, 4.6], ['t', 'HEAT', 707, 1120, 4.6]]),
  fbp('CABIN PRESS', 744, 1110, 928, 1155, [T('MAN V/S CTL', 766, 1139), ['PRESS MODE SEL', 791, 1127, 23, 22], N('LDG ELEV', 848, 1139, 24), ['DITCHING', 881, 1121, 23, 29, 'pbk']], [['t', 'CABIN PRESS', 800, 1114, 5.5]]),
  fbp('EXT LT', 498, 1157, 688, 1238, [T('STROBE', 534, 1181), T('BEACON', 572, 1181), T('WING LT', 613, 1181), T('NAV & LOGO', 659, 1181), T('RWY TURN OFF', 535, 1218), T('LAND L', 578, 1219), T('LAND R', 620, 1219), T('NOSE LT', 660, 1218)], [['t', 'EXT LT', 594, 1161, 5]]),
  fbp('APU', 690, 1157, 740, 1238, [['APU MASTER SW', 703, 1175, 23, 22], ['APU START', 703, 1207, 23, 22]], [['t', 'APU', 715, 1162, 6]]),
  fbp('INT LT', 742, 1157, 928, 1196, [N('OVHD INTEG LT', 761, 1181, 22), T('ICE IND & STBY COMPASS', 802, 1181), T('DOME', 839, 1181), T('ANN LT', 882, 1181)], [['t', 'INT LT', 862, 1161, 5]]),
  fbp('SIGNS', 742, 1198, 928, 1238, [T('SEAT BELTS', 761, 1219), T('NO SMOKING', 797, 1219), ['EXIT LT OFF', 831, 1207, 19, 19, 'ind', 'OFF'], T('EMER EXIT LT', 876, 1219)], [['t', 'SIGNS', 845, 1201, 5]]),
  /* overhead, right column */
  acp3(), fbp('BLANK 8', 930, 724, 1110, 800), fbp('BLANK 9', 930, 802, 1110, 903),
  fbp('FLT CTL 2', 930, 905, 1110, 955, [['ELAC 2', 957, 927, 22, 22], ['SEC 2', 991, 927, 23, 22], ['SEC 3', 1024, 927, 23, 22], ['FAC 2', 1058, 927, 23, 22]], [['t', 'FLT CTL', 1023, 912, 7]]),
  fbp('CARGO VENT', 930, 957, 1110, 1015, [['AFT ISOL VALVE', 1064, 972, 24, 22]], [['t', 'CARGO VENT', 1010, 962, 5.5], ['l', 1016, 968, 1016, 1010, '#C9D2DA']]),
  fbp('CARGO SMOKE', 930, 1017, 1110, 1070, [['FWD DISCH', 946, 1030, 24, 36, 'pbr'], ['FWD SMOKE', 971, 1043, 20, 18, 'ind', 'SMOKE'], R('SMOKE TEST', 1014, 1054, 22), ['AFT SMOKE', 1042, 1043, 21, 18, 'ind', 'SMOKE'], ['AFT DISCH', 1064, 1032, 25, 35, 'pbr']], [['t', 'CARGO SMOKE', 1017, 1022, 5.5]]),
  fbp('VENTILATION', 930, 1072, 1110, 1110, [['BLOWER', 946, 1086, 23, 22], ['EXTRACT', 982, 1086, 23, 22], ['CAB FANS', 1064, 1086, 23, 22]], [['t', 'VENTILATION', 1020, 1076, 5]]),
  fbp('ENG MAN START', 930, 1112, 1110, 1155, [['ENG 1 MAN START', 945, 1126, 24, 27, 'pbk'], ['ENG 2 MAN START', 983, 1126, 24, 27, 'pbk'], ['ENG 1 N1 MODE', 1026, 1126, 24, 27, 'pbk'], ['ENG 2 N1 MODE', 1063, 1126, 24, 27, 'pbk']], [['t', 'ENG MAN START', 976, 1116, 4.6], ['t', 'ENG N1 MODE', 1057, 1116, 4.6]]),
  fbp('WIPER F/O', 930, 1157, 1110, 1236, [N('WIPER F/O', 979, 1186, 30), R('RAIN RPLNT F/O', 1034, 1178, 22)]),
  /* glareshield */
  fbp('ATC MSG CPT', 14, 1352, 54, 1386, [['ATC MSG CPT', 22, 1361, 22, 17, 'ind', 'ATC MSG']]), fbp('AUTO LAND CPT', 118, 1335, 290, 1378, [['AUTO LAND CPT', 132, 1352, 20, 18, 'ind', 'LAND']], [['c', 204, 1348, 7], ['c', 269, 1346, 7]]), fbp('MASTER CPT', 300, 1306, 346, 1366, [['MASTER WARN CPT', 313, 1316, 20, 16, 'mw'], ['MASTER CAUT CPT', 313, 1341, 20, 16, 'mc']]),
  fbp('CPT GLARESHIELD', 392, 1298, 432, 1360, [R('CHRONO CPT', 412, 1318, 12), ['SIDE STICK PRIORITY CPT', 405, 1342, 14, 11, 'ind', ' ']]),
  efis('CPT', false),
  fbp('FCU', 590, 1288, 836, 1378, [R('SPD/MACH', 601, 1320, 10), N('SPD', 626, 1332, 24), N('HDG', 664, 1332, 24), K('LOC', 662, 1353, 13, 7), R('HDG V/S - TRK FPA', 711, 1319, 10), K('AP 1', 695, 1329, 14, 9), K('AP 2', 717, 1329, 13, 9), K('A/THR', 705, 1349, 14, 9),
    N('ALT', 755, 1330, 24), R('METRIC ALT', 780, 1319, 10), N('V/S', 802, 1330, 24), K('EXPED', 748, 1353, 14, 7), K('APPR', 796, 1353, 14, 7)], [['d', 'SPD 100    HDG 000    ALT 00100    V/S -----', 612, 1291, 202, 15]]),
  efis('F/O', true),
  fbp('F/O GLARESHIELD', 994, 1298, 1034, 1360, [R('CHRONO F/O', 1014, 1318, 12), ['SIDE STICK PRIORITY F/O', 1007, 1342, 14, 11, 'ind', ' ']]),
  fbp('MASTER F/O', 1080, 1306, 1126, 1366, [['MASTER WARN F/O', 1093, 1316, 20, 16, 'mw'], ['MASTER CAUT F/O', 1093, 1341, 20, 16, 'mc']]), fbp('AUTO LAND F/O', 1136, 1335, 1308, 1378, [['AUTO LAND F/O', 1274, 1352, 20, 18, 'ind', 'LAND']], [['c', 1222, 1348, 7], ['c', 1157, 1346, 7]]), fbp('ATC MSG F/O', 1372, 1352, 1412, 1386, [['ATC MSG F/O', 1382, 1361, 22, 17, 'ind', 'ATC MSG']]),
  fbp('TABLE LT CPT', 91, 1391, 115, 1413, [N('TABLE LT CPT', 103, 1402, 14)]), fbp('GLARESHIELD LT', 630, 1380, 794, 1400, [N('GLARESHIELD INTEG LT', 644, 1390, 14), N('FCU DISPLAY BRT', 779, 1390, 14)]), fbp('TABLE LT F/O', 1311, 1391, 1335, 1413, [N('TABLE LT F/O', 1323, 1402, 14)]),
  /* main panel */
  fbp('GPWS G/S CPT', 168, 1414, 197, 1438, [['GPWS G/S CPT', 173, 1420, 19, 17]]), fbp('GPWS G/S F/O', 1229, 1414, 1258, 1438, [['GPWS G/S F/O', 1234, 1420, 19, 17]]),
  fbp('CPT LIGHTING', 108, 1439, 192, 1499, [N('PFD BRT CPT', 122, 1457, 18), R('PFD/ND XFR CPT', 152, 1458, 14), N('ND BRT CPT', 179, 1457, 18), N('LOUDSPEAKER CPT', 122, 1488, 18), T('CONSOLE/FLOOR LT CPT', 152, 1488)]),
  fbs('PFD CPT', 215, 1428, 124, 123), fbs('ND CPT', 370, 1428, 124, 123), fbp('TERR ON ND CPT', 518, 1520, 555, 1562, [['TERR ON ND CPT', 527, 1532, 19, 18]]),
  fbs('STANDBY (ISIS)', 565, 1472, 70, 66), fbs('E/WD (upper ECAM)', 654, 1419, 135, 126), fbs('SD (lower ECAM)', 654, 1565, 135, 124),
  fbp('LDG GEAR / BRAKES', 812, 1410, 908, 1475, [['LDG GEAR IND', 821, 1420, 52, 15, 'ind', 'UNLK  UNLK  UNLK'], ['BRK FAN', 881, 1420, 18, 15], ['AUTO BRK LO', 819, 1452, 17, 15], ['AUTO BRK MED', 837, 1452, 17, 15], ['AUTO BRK MAX', 857, 1452, 17, 15], T('A/SKID & N/W STRG', 891, 1458)], [['t', 'LDG GEAR', 847, 1415, 4.5], ['t', 'AUTO BRK', 846, 1443, 4.5]]),
  fbp('CLOCK', 808, 1477, 876, 1541, [['CLOCK', 824, 1483, 36, 52, 'disp', '08:27'], R('CLOCK RST', 816, 1487, 10), R('CLOCK CHR', 868, 1488, 10), R('CLOCK DATE/SET', 816, 1508, 9), ['CLOCK UTC SEL', 863, 1502, 10, 10, 'tg'], ['CLOCK ET SEL', 863, 1520, 10, 10, 'tg']]), fbp('TERR ON ND F/O', 876, 1484, 912, 1522, [['TERR ON ND F/O', 884, 1495, 18, 17]]),
  fbp('GEAR LEVER', 812, 1543, 862, 1626, [['GEAR LEVER', 817, 1546, 40, 76, 'gear']]), fbp('BRAKE PRESS', 866, 1576, 910, 1626, [['BRAKE PRESS', 870, 1585, 35, 35, 'gauge']]),
  fbs('ND F/O', 932, 1428, 124, 123), fbs('PFD F/O', 1087, 1428, 124, 123),
  fbp('F/O LIGHTING', 1234, 1439, 1318, 1499, [N('ND BRT F/O', 1247, 1457, 18), R('PFD/ND XFR F/O', 1274, 1458, 14), N('PFD BRT F/O', 1304, 1457, 18), T('CONSOLE/FLOOR LT F/O', 1274, 1488), N('LOUDSPEAKER F/O', 1304, 1488, 18)]),
  fbs('DCDU 1', 511, 1626, 116, 70), fbs('DCDU 2', 805, 1626, 116, 70),
  /* pedestal */
  fbs('MCDU 1', 407, 1719, 176, 270), fbs('MCDU 2', 843, 1719, 176, 270),
  fbp('SWITCHING', 585, 1719, 841, 1800, [N('ATT HDG', 633, 1783, 24), N('AIR DATA', 687, 1783, 24), N('EIS DMC', 741, 1783, 24), N('ECAM/ND XFR', 795, 1783, 24)], [['t', 'SWITCHING', 713, 1729, 7]]),
  fbp('ECAM CONTROL', 585, 1802, 841, 1890, [N('UPPER DISPLAY', 616, 1833, 22), N('LOWER DISPLAY', 616, 1874, 22), K('T.O CONFIG', 672, 1811, 20, 11), ['EMER CANC', 745, 1811, 18, 12, 'pbr'],
    ...row(['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL'], [656, 682, 708, 734, 760, 786], 1835, 18, 10, 'key'), ...row(['APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL', 'ALL'], [656, 682, 708, 734, 760, 786], 1852, 18, 10, 'key'),
    K('CLR L', 647, 1871, 18, 10), K('STS', 699, 1871, 18, 10), K('RCL', 725, 1871, 18, 10), K('CLR', 777, 1871, 18, 10)], [['t', 'ECAM', 602, 1809, 6.5]]),
  fbp('BLANK 10', 585, 1892, 841, 1923),
  fbp('THRUST LEVERS', 585, 1925, 841, 2243, [['PITCH TRIM WHEEL L', 592, 1975, 30, 262, 'trimw'], ['THR LVR 1', 651, 1985, 58, 225, 'thr'], ['THR LVR 2', 717, 1985, 58, 225, 'thr'], ['A/THR DISC 1', 639, 2150, 11, 11, 'disc'], ['A/THR DISC 2', 776, 2150, 11, 11, 'disc'], ['PITCH TRIM WHEEL R', 804, 1975, 30, 262, 'trimw']], [['l', 633, 2030, 633, 2215, '#35D07F'], ['l', 793, 2030, 793, 2215, '#35D07F'], ['t', 'A/THR', 713, 2052, 5], ...[45, 40, 35, 30, 25, 20, 15, 10, 5, 0].map(v => ['t', String(v), 713, 2065 + (45 - v) / 45 * 75, 4.5])]),
  fbp('BLANK 11', 585, 2245, 648, 2344), fbp('BLANK 12', 778, 2245, 841, 2344),
  fbp('ENGINE', 650, 2245, 776, 2344, [['ENG MASTER 1', 675, 2268, 18, 24, 'tgg'], N('ENG MODE SEL', 713, 2314, 26), ['ENG MASTER 2', 733, 2268, 18, 24, 'tgg'], ['ENG 1 FIRE/FAULT', 661, 2305, 20, 22, 'ind', 'FIRE'], ['ENG 2 FIRE/FAULT', 745, 2305, 20, 22, 'ind', 'FIRE']], [['t', 'ENG', 713, 2253, 7]]),
  rmp(1, 0, ''), acp(1, 0, ''), rmp(2, 439, ' F/O'), acp(2, 439, ' F/O'),
  fbp('FLOOD / INTEG LT', 406, 2199, 583, 2258, [N('FLOOD LT MAIN PNL', 447, 2236, 26), N('INTEG LT MAIN PNL & PED', 497, 2236, 26)]),
  fbp('WX RADAR', 406, 2260, 583, 2344, [N('GAIN', 445, 2292, 20), T('MULTISCAN', 474, 2276), T('GCS', 513, 2276), N('TILT', 541, 2296, 20), N('WX MODE', 495, 2314, 20), T('WX SYS', 459, 2327), T('PWS', 528, 2327)]),
  fbp('FLOOD LT PED / AIDS / DFDR', 843, 2199, 1020, 2258, [N('FLOOD LT PED', 882, 2236, 26), R('AIDS PRINT', 931, 2238, 16), R('DFDR EVENT', 977, 2238, 16)]),
  fbp('ATC / TCAS', 843, 2260, 1020, 2344, [N('XPDR MODE', 873, 2280, 14), N('ATC 1/2', 873, 2303, 14), N('ALT RPTG', 873, 2327, 14), ['XPDR KEYPAD', 886, 2274, 52, 58, 'keys'], ['XPDR CODE', 946, 2268, 50, 17, 'disp', '7000'], R('IDENT', 959, 2302, 12), N('TCAS TRAFFIC', 952, 2327, 14), N('TCAS MODE', 992, 2327, 14)]),
  fbp('SPEED BRAKE', 482, 2346, 658, 2446, [['SPEED BRAKE LEVER', 598, 2349, 34, 90, 'spd']], [['t', 'SPEED', 540, 2388, 7], ['t', 'BRAKE', 540, 2399, 7]]),
  fbp('COCKPIT DOOR', 482, 2448, 658, 2515, [['DOOR OPEN/FAULT', 494, 2481, 24, 24, 'ind', 'OPEN'], ['DOOR LOCK', 523, 2479, 28, 28, 'tg'], R('DOOR VIDEO', 594, 2493, 18)], [['t', 'COCKPIT DOOR', 540, 2457, 6.5]]),
  fbp('BLANK 13', 482, 2517, 658, 2582), fbp('BLANK 14', 482, 2584, 658, 2652),
  fbp('RUD TRIM', 660, 2346, 770, 2492, [['RUD TRIM IND', 670, 2410, 41, 17, 'disp', 'L 0.0'], R('RUD TRIM RESET', 690, 2456, 16), N('RUD TRIM', 737, 2442, 34)], [['t', 'RUD TRIM', 737, 2398, 6.5]]),
  fbp('PARKING BRK', 660, 2494, 770, 2577, [['PARKING BRAKE', 724, 2514, 42, 58, 'park']], [['t', 'PARKING BRK', 694, 2506, 6]]),
  fbp('GRAVITY GEAR EXTN', 660, 2579, 770, 2658, [['GRAVITY GEAR EXTN', 686, 2588, 60, 64, 'crank']]),
  fbp('FLAPS', 772, 2346, 948, 2446, [['FLAPS LEVER', 790, 2350, 52, 88, 'flaps']], [['t', 'FLAPS', 892, 2394, 7]]),
  fbp('PRINTER', 772, 2448, 948, 2512, [['PRINTER', 790, 2458, 140, 44, 'box']]), fbp('BLANK 15', 772, 2514, 948, 2655),
  fbp('CPT SIDE CONSOLE', 28, 1880, 368, 2175, [['TILLER CPT', 60, 2020, 110, 110, 'tiller'], ['SIDESTICK CPT', 215, 1900, 120, 240, 'stick']]),
  fbp('F/O SIDE CONSOLE', 1058, 1880, 1398, 2175, [['SIDESTICK F/O', 1091, 1900, 120, 240, 'stick'], ['TILLER F/O', 1256, 2020, 110, 110, 'tiller']])
];
const A320 = { id: 'a320', name: 'Airbus A320', style: 'airbus', crew: 2, h: 1902, zones: [], strip: true,
  short: { 'GPWS SYS': 'SYS', 'RCDR GND CTL': 'GND CTL', 'WING A-ICE': 'WING', 'ENG 1 A-ICE': 'ENG 1', 'ENG 2 A-ICE': 'ENG 2', 'PROBE/WINDOW HEAT': '', 'PRESS MODE SEL': 'MODE SEL', 'APU MASTER SW': 'MASTER SW', 'APU START': 'START',
    'L TK PUMP 1': 'L TK 1', 'L TK PUMP 2': 'L TK 2', 'R TK PUMP 1': 'R TK 1', 'R TK PUMP 2': 'R TK 2', 'CTR TK PUMP 1': 'CTR TK 1', 'CTR TK PUMP 2': 'CTR TK 2', 'TEMP CKPT': 'COCKPIT', 'TEMP FWD CAB': 'FWD CABIN', 'TEMP AFT CAB': 'AFT CABIN',
    'BLUE ELEC PUMP': 'ELEC PUMP', 'YELLOW ELEC PUMP': 'ELEC PUMP', 'GALY & CAB': 'GALY & CAB', 'EVAC COMMAND': 'COMMAND', 'ENG 1 MAN START': '1', 'ENG 2 MAN START': '2', 'ENG 1 N1 MODE': '1', 'ENG 2 N1 MODE': '2', 'WIPER CPT': 'WIPER', 'RAIN RPLNT CPT': 'RAIN RPLNT', 'WIPER F/O': 'WIPER', 'RAIN RPLNT F/O': 'RAIN RPLNT',
    'ENG 1 AGENT 1': 'AGENT 1', 'ENG 1 AGENT 2': 'AGENT 2', 'ENG 2 AGENT 1': 'AGENT 1', 'ENG 2 AGENT 2': 'AGENT 2', 'APU AGENT': '', 'ENG 1 FIRE TEST': 'TEST', 'ENG 2 FIRE TEST': 'TEST', 'APU FIRE TEST': 'TEST', 'ENG 1 FIRE': '', 'ENG 2 FIRE': '', 'APU FIRE': '',
    'BAT 1 VOLT': 'BAT 1', 'BAT 2 VOLT': 'BAT 2', 'BAT 1': '1', 'BAT 2': '2', 'FWD DISCH': 'DISCH', 'AFT DISCH': 'DISCH', 'FWD SMOKE': 'FWD', 'AFT SMOKE': 'AFT', 'SMOKE TEST': 'TEST', 'EMER GEN MAN ON': 'MAN ON', 'ICE IND & STBY COMPASS': 'STBY COMP', 'RAT & EMER GEN': 'EMER GEN',
    'IR MODE 1': 'OFF NAV ATT', 'IR MODE 3': 'OFF NAV ATT', 'IR MODE 2': 'OFF NAV ATT', 'EXIT LT OFF': '', 'ON BAT': '', 'CLOCK': '', 'CLOCK RST': 'RST', 'CLOCK CHR': 'CHR', 'CLOCK DATE/SET': 'DATE', 'CLOCK UTC SEL': 'GPS', 'CLOCK ET SEL': 'RUN', 'ATC MSG CPT': '', 'ATC MSG F/O': '', 'GPWS G/S CPT': '', 'GPWS G/S F/O': '', 'TABLE LT CPT': '', 'TABLE LT F/O': '', 'GLARESHIELD INTEG LT': '', 'FCU DISPLAY BRT': '', 'XPDR KEYPAD': '', 'XPDR CODE': '', 'PRINTER': 'PRINTER', 'AUTO BRK LO': 'LO', 'AUTO BRK MED': 'MED', 'AUTO BRK MAX': 'MAX', 'LDG GEAR IND': '', 'A/SKID & N/W STRG': 'A/SKID',
    'DATA LOADER NEXT': 'NEXT', 'DATA LOADER PREV': 'PREV', 'DATA LOADER SEL': 'SEL', 'DATA LOADER ON/OFF': '', 'DATA LOADER DISPLAY': '', 'CLR L': 'CLR', 'HDG V/S - TRK FPA': 'HDG-V/S', 'APU AUTO EXTING TEST': 'TEST', 'APU AUTO EXTING RESET': 'RESET', 'LEAK MEAS G': 'G', 'LEAK MEAS B': 'B', 'LEAK MEAS Y': 'Y', 'FADEC GND PWR 1': '1', 'FADEC GND PWR 2': '2',
    'ENG MASTER 1': 'MASTER 1', 'ENG MASTER 2': 'MASTER 2', 'ENG MODE SEL': 'MODE', 'ENG 1 FIRE/FAULT': '', 'ENG 2 FIRE/FAULT': '', 'RMP 1 ACTIVE': '', 'RMP 1 STBY/CRS': '', 'RMP 2 ACTIVE': '', 'RMP 2 STBY/CRS': '', 'RMP 1 FREQ': '', 'RMP 2 FREQ': '', 'RMP 1 ON/OFF': 'ON', 'RMP 2 ON/OFF': 'ON',
    'RUD TRIM IND': '', 'RUD TRIM RESET': 'RESET', 'RUD TRIM': '', 'DOOR OPEN/FAULT': '', 'DOOR LOCK': 'UNLOCK NORM LOCK', 'DOOR VIDEO': 'VIDEO', 'TOILET': 'TOILET', 'MASTER WARN CPT': '', 'MASTER CAUT CPT': '', 'MASTER WARN F/O': '', 'MASTER CAUT F/O': '',
    'SIDE STICK PRIORITY CPT': 'PRIORITY', 'SIDE STICK PRIORITY F/O': 'PRIORITY', 'AUTO LAND CPT': 'AUTO LAND', 'AUTO LAND F/O': 'AUTO LAND', 'FLOOD LT MAIN PNL': 'FLOOD LT MAIN PNL', 'INTEG LT MAIN PNL & PED': 'INTEG LT', 'COCKPIT DOOR VIDEO': 'DOOR VIDEO', 'CVR HEADSET': 'CVR HEADSET', 'ELT': 'ON', 'ELT TEST/RESET': 'TEST/RESET' },
  shapes: [[320, 0, 1110, 0, 1110, 634, 320, 634], [320, 638, 1110, 638, 1110, 1165, 1050, 1240, 380, 1240, 320, 1165], [0, 1345, 430, 1284, 996, 1284, 1426, 1345, 1426, 1400, 1000, 1382, 426, 1382, 0, 1400],
    [0, 1392, 1426, 1392, 1426, 1560, 1300, 1602, 932, 1602, 932, 1705, 494, 1705, 494, 1602, 126, 1602, 0, 1560], [402, 1714, 1024, 1714, 1024, 2346, 402, 2346], [478, 2346, 952, 2346, 952, 2660, 965, 2700, 461, 2700, 474, 2660],
    [28, 1880, 368, 1880, 368, 2175, 28, 2175], [1058, 1880, 1398, 1880, 1398, 2175, 1058, 2175]].map(s => s.map(fx)), p: A320_P };
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
    if (it[0] && it[0].b) { it.forEach(o => { const [bx, by, bw, bh] = o.b; out.push({ id: n + '|' + o.n, name: o.n, panel: n, x: bx - 2, y: by - 5, w: bw + 4, h: bh + 7, k: 'p', kd: o.kd, tx: o.tx, b: { x: bx, y: by, w: bw, h: bh } }); }); return; }
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
    const marks = kd === 'thr' ? [['TO GA', 0.2], ['FLX MCT', 0.27], ['CL', 0.36], ['0', 0.69], ['REV', 0.95]] : kd === 'flaps' ? [['0', 0.05], ['1', 0.27], ['2', 0.49], ['3', 0.71], ['FULL', 0.93]] : kd === 'spd' ? [['RET', 0.05], ['1/2', 0.5], ['FULL', 0.93]] : [['UP', 0.08], ['DOWN', 0.92]];
    const at = kd === 'thr' ? 0.69 : kd === 'gear' ? 0.92 : 0.05, hy = top + H * at, left = kd === 'thr' && /1$/.test(t.name), right = kd === 'thr' && /2$/.test(t.name);
    let o = `<rect x="${sx - 2.2}" y="${top}" width="4.4" height="${H}" rx="2" fill="#0B0D10" stroke="#3A434C" stroke-width=".6"/>`;
    marks.forEach(([l, f]) => { const y = top + H * f; o += `<line x1="${sx - 6}" y1="${y}" x2="${sx + 6}" y2="${y}" stroke="#E9EEF2" stroke-width=".7"/>`;
      o += kd === 'thr' ? `<text x="${left ? sx - 8 : sx + 8}" y="${y + 1.4}" text-anchor="${left ? 'end' : 'start'}" class="pbl" style="font-size:3.6px;fill:#E9EEF2">${l}</text>` : `<text x="${sx + 7}" y="${y + 2}" text-anchor="start" class="pbl" style="font-size:4.2px;fill:#E9EEF2">${l}</text>`; });
    if (kd === 'thr') { const w = Math.min(t.w - 6, 34); o += `<rect x="${sx - w * 0.28}" y="${hy - 34}" width="${w * 0.56}" height="34" rx="2" fill="#20252A" stroke="#0C0F12" stroke-width=".5"/><rect x="${sx - w / 2}" y="${hy}" width="${w}" height="30" rx="4" fill="#15191D" stroke="#59626B" stroke-width=".7"/><rect x="${sx - w / 2 + 2}" y="${hy + 3}" width="${w - 4}" height="5" rx="2" fill="#2E353B"/><text x="${sx}" y="${hy + 22}" text-anchor="middle" class="pbl" style="font-size:6px;fill:#E9EEF2">${left ? '1' : '2'}</text>`; }
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
  if (/^MCDU/.test(N)) return mcdu(x, y, w, h);
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
const lab = (ac, t) => ac.short && t.name in ac.short ? ac.short[t.name] : ac.strip ? t.name.replace(/ (CPT|F\/O|OVHD)$/, '').replace(/ (TX|VOL)$/, '') : t.name;
/* Airbus push-button captions: [upper, lower], unlit as on the ground with nothing selected. Upper is amber unless noted. */
const LEG = [[/^GPWS G\/S/, ['GPWS', 'G/S']], [/^(TERR ON ND|PA$|COCKPIT DOOR VIDEO|ENG \d N1 MODE|COMMERCIAL)/, ['', 'ON']], [/^(APU AUTO EXTING TEST|OXY TMR RESET)/, ['', 'TEST']], [/^(EMER GEN MAN ON|EVAC COMMAND)/, ['', '']], [/^IR \d/, ['FAULT', 'ALIGN']], [/^(FADEC GND PWR|BLUE PUMP OVRD|SVCE INT OVRD|AVNCS COMPT LT)/, ['', 'ON']], [/^LEAK MEAS/, ['', 'OFF']], [/^APU AUTO EXTING/, ['TEST', 'RESET']], [/^OXY TMR RESET/, ['FAULT', 'RESET']], [/^EXT PWR/, ['AVAIL', 'ON']], [/^APU MASTER/, ['FAULT', 'ON']], [/^APU START/, ['ON', 'AVAIL']], [/^X FEED/, ['OPEN', 'ON']], [/MODE SEL$/, ['FAULT', 'MAN']],
  [/^(RAM AIR|DITCHING|PROBE\/WINDOW HEAT|ENG [12] MAN START|N1 MODE)/, ['', 'ON']], [/A-ICE$/, ['FAULT', 'ON']], [/AGENT/, ['SQUIB', 'DISCH']], [/FIRE TEST|SMOKE TEST|CVR TEST/, ['', 'TEST']],
  [/^EVAC COMMAND/, ['EVAC', 'ON']], [/^GEN 1 LINE/, ['SMOKE', 'OFF']], [/^RAT & EMER GEN/, ['FAULT', '']], [/^PASSENGER/, ['SYS ON', '']], [/^(MECH|FWD|AFT)$/, ['CALL', '']], [/^EMER$/, ['CALL', 'ON']],
  [/DISCH$/, ['SMOKE', 'DISCH']], [/^RAIN RPLNT/, ['FAULT', '']], [/^AUTO BRK/, ['DECEL', 'ON']], [/^BRK FAN/, ['HOT', 'ON']], [/^AUTO LAND/, ['AUTO', 'LAND']], [/^RCDR GND CTL/, ['', 'ON']],
  [/^(HORN SHUT OFF|MASK MAN ON|EMER GEN TEST|RAT MAN ON|CVR ERASE|SIDE STICK PRIORITY|PFD\/ND XFR|PARKING)/, ['', '']], [/^(TERR|GPWS SYS|G\/S MODE|FLAP MODE|LDG FLAP 3)/, ['FAULT', 'OFF']],
  [/^(AP [12]|A\/THR|LOC|APPR|EXPED|FD |LS |CSTR|WPT|VOR\.D|NDB|ARPT|SPD\/MACH|HDG V\/S|METRIC ALT)/, ['', '•']], [/./, ['FAULT', 'OFF']]];
const legend = n => (LEG.find(([r]) => r.test(n)) || [0, ['', '']])[1];
const LEGC = { ON: '#5BB8F5', AVAIL: '#3CCB7F', OPEN: '#3CCB7F', DISCH: '#E9EEF2', TEST: '#E9EEF2', OFF: '#E9EEF2', MAN: '#E9EEF2', LAND: '#FF5A4D', '•': '#3CCB7F' };
/* a traced control: drawn to fill its measured rectangle, with the panel's own label above it */
function absCtl(ac, t) { const b = t.b, kd = t.kd, cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) / 2, L = lab(ac, t); let o = '';
  if (/^(thr|flaps|spd|trimw|gear|disc|stick|tiller|box|gauge|tgg)$/.test(kd)) { const o2 = ctl({ x: b.x, y: b.y, w: b.w, h: b.h + (/^(thr|flaps|spd|trimw|gear|disc)$/.test(kd) ? 0 : 13), name: t.name, k: 'l' }, kd, LOOK.airbus);
    return `<g class="ft" data-t="${esc(t.id)}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="#000" fill-opacity="0"/>` + o2 + (L && /^(stick|tiller|box|gauge|tgg)$/.test(kd) ? `<text x="${cx}" y="${kd === 'tgg' || kd === 'gauge' ? b.y - 1.3 : b.y + b.h - 2}" text-anchor="middle" class="ftn" style="fill:#F2F5F8;font-size:${Math.max(2.2, Math.min(5, (b.w + 6) / Math.max(3, L.length) * 1.5)).toFixed(1)}px">${esc(L)}</text>` : '') + '</g>'; }
  if (kd === 'key') return `<g class="ft" data-t="${esc(t.id)}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="#000" fill-opacity="0"/>` + keyCap({ x: b.x - 1, y: b.y - 1, w: b.w + 2, h: b.h + 2 }, L) + '</g>';
  if (kd === 'mw' || kd === 'mc') return `<g class="ft" data-t="${esc(t.id)}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="#000" fill-opacity="0"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1" fill="${kd === 'mw' ? '#7A1B1B' : '#6E5410'}" stroke="#0C0F12" stroke-width=".6"/><text x="${cx}" y="${cy - .4}" text-anchor="middle" class="pbl" style="font-size:${b.w * 0.2}px;fill:${kd === 'mw' ? '#FF6B5E' : '#FFC04D'}">MASTER</text><text x="${cx}" y="${cy + b.w * 0.22}" text-anchor="middle" class="pbl" style="font-size:${b.w * 0.2}px;fill:${kd === 'mw' ? '#FF6B5E' : '#FFC04D'}">${kd === 'mw' ? 'WARN' : 'CAUT'}</text></g>`;
  if (kd === 'park') o = `<path d="M${cx - r * 0.2} ${b.y + 2}A${r * 1.1} ${r * 1.1} 0 0 1 ${b.x + b.w - 1} ${cy + r * 0.5}" fill="none" stroke="#E9EEF2" stroke-width=".6"/><rect x="${b.x + b.w * 0.18}" y="${b.y}" width="${b.w * 0.3}" height="${b.h}" rx="1.5" fill="#0C0F12"/><text transform="translate(${b.x + b.w * 0.4} ${cy}) rotate(90)" text-anchor="middle" class="pbl" style="font-size:${b.w * 0.2}px;fill:#fff">PARK BRK</text><path d="M${b.x + b.w * 0.48} ${cy + 2}h${b.w * 0.4}l${b.w * 0.1} 4h${-b.w * 0.5}z" fill="#D9DEE2" stroke="#7D858D" stroke-width=".4"/>`;
  else if (kd === 'crank') o = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#101316" stroke="#2A3138"/><rect x="${cx - r * 0.42}" y="${cy - r * 0.55}" width="${r * 0.84}" height="${r * 1.7}" rx="1.5" fill="#D8392B" stroke="#8E1F16" stroke-width=".5"/><text x="${cx}" y="${cy - r * 0.2}" text-anchor="middle" class="pbl" style="font-size:${r * 0.2}px;fill:#fff">GRAVITY</text><text x="${cx}" y="${cy + r * 0.12}" text-anchor="middle" class="pbl" style="font-size:${r * 0.24}px;fill:#fff">GEAR</text><text x="${cx}" y="${cy + r * 0.42}" text-anchor="middle" class="pbl" style="font-size:${r * 0.24}px;fill:#fff">EXTN</text>`;
  else if (kd === 'knob') { const a = -14 * Math.PI / 180, gx = Math.sin(a), gy = -Math.cos(a);
    o = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#39434D" stroke="#1E252B" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.74}" fill="#B9C0C6"/><g transform="rotate(-14 ${cx} ${cy})"><rect x="${cx - r * 0.3}" y="${cy - r * 0.98}" width="${r * 0.6}" height="${r * 1.9}" rx="${r * 0.22}" fill="#E4E7EA" stroke="#8B949C" stroke-width=".4"/><line x1="${cx}" y1="${cy - r * 0.9}" x2="${cx}" y2="${cy - r * 0.1}" stroke="#15181B" stroke-width="${Math.max(.6, r * 0.12)}"/></g>`; }
  else if (kd === 'tg') o = `<circle cx="${cx}" cy="${cy}" r="${r * 0.72}" fill="#0F1214" stroke="#59626B" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="#2A3036"/><line x1="${cx}" y1="${cy}" x2="${cx + r * 0.1}" y2="${cy + r * 0.95}" stroke="#C9CED3" stroke-width="${r * 0.34}" stroke-linecap="round"/><circle cx="${cx + r * 0.1}" cy="${cy + r * 0.95}" r="${r * 0.24}" fill="#EEF0F2"/>`;
  else if (kd === 'rnd') o = `<circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="#0E1113" stroke="#4A535B" stroke-width=".5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="#1D2226" stroke="#30373D" stroke-width=".4"/>`;
  else if (kd === 'disp') o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#1A2026" stroke="#0C0F12" stroke-width=".6"/><rect x="${b.x + b.w * 0.12}" y="${b.y + b.h * 0.2}" width="${b.w * 0.76}" height="${b.h * 0.6}" fill="#050607"/><text x="${cx}" y="${cy + b.h * 0.17}" text-anchor="middle" class="pbl" style="font-size:${Math.min(b.h * 0.46, b.w * 0.2)}px;fill:${/XPDR|RUD|CLOCK/.test(t.name) ? '#F2A623' : '#F2A623'}">${esc(t.tx || '- - - -')}</text>`;
  else if (kd === 'ind') { const tx = t.tx || 'OFF'; o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx=".8" fill="#0D1013" stroke="#7F8B97" stroke-width=".5"/><text x="${cx}" y="${cy + 1}" text-anchor="middle" class="pbl" style="font-size:${Math.min(3.2, b.w / (tx.length * 0.72))}px;fill:${/SMOKE|FIRE|LAND/.test(tx) ? '#B24A41' : /UNLK/.test(tx) ? '#B24A41' : '#B98420'};white-space:pre">${esc(tx)}</text>`; }
  else if (kd === 'keys') { const big = b.w > 60; o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1" fill="#1A1F24" stroke="#0C0F12" stroke-width=".5"/>`; const C = big ? 7 : 3, Rw = big ? 3 : 4, lb = big ? null : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'CLR']; for (let i = 0; i < C * Rw; i++) { const kx = b.x + 1.5 + (i % C) * (b.w - 3) / C + .6, ky = b.y + 1.5 + Math.floor(i / C) * (b.h - 3) / Rw + .6, kw = (b.w - 3) / C - 1.2, kh = (b.h - 3) / Rw - 1.2; o += big ? `<circle cx="${kx + kw / 2}" cy="${ky + kh / 2}" r="${Math.min(kw, kh) * 0.3}" fill="#343C44" stroke="#59626B" stroke-width=".3"/>` : `<rect x="${kx}" y="${ky}" width="${kw}" height="${kh}" rx=".6" fill="#343C44"/><text x="${kx + kw / 2}" y="${ky + kh * 0.72}" text-anchor="middle" class="pbl" style="font-size:${kh * 0.6}px;fill:#E9EEF2">${lb[i]}</text>`; } }
  else if (kd === 'pbr' || kd === 'pbk') { const red = kd === 'pbr', fire = /FIRE$/.test(t.name);
    o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1.4" fill="${red ? '#D8392B' : '#14171A'}" stroke="${red ? '#8E1F16' : '#4A525A'}" stroke-width=".6"/><rect x="${b.x + b.w * 0.14}" y="${b.y + 1}" width="${b.w * 0.72}" height="${Math.max(1, b.h * 0.08)}" rx=".5" fill="${red ? '#F0695C' : '#2C3339'}"/>` +
      (fire ? `<text x="${cx}" y="${cy - 0.5}" text-anchor="middle" class="pbl" style="font-size:${b.w * 0.24}px;fill:#fff">FIRE</text><text x="${cx}" y="${cy + b.w * 0.26}" text-anchor="middle" class="pbl" style="font-size:${b.w * 0.2}px;fill:#fff">PUSH</text>` : red ? '' : `<line x1="${b.x + 2}" y1="${cy}" x2="${b.x + b.w - 2}" y2="${cy}" stroke="#2C3339" stroke-width=".6"/>`); }
  else { let [u, d] = legend(t.name); const f = Math.min(b.w / 5.6, b.h / 3.3);
    o = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1" fill="#252C33" stroke="#A9B4BE" stroke-width=".45"/><rect x="${b.x + b.w * 0.1}" y="${b.y + b.h * 0.1}" width="${b.w * 0.8}" height="${b.h * 0.8}" rx=".6" fill="#07090B"/>` +
      (u ? `<text x="${cx}" y="${b.y + b.h * 0.44}" text-anchor="middle" class="pbl" style="font-size:${f}px;fill:${u === 'ON' ? '#5BB8F5' : '#E5A33A'}">${u}</text>` : '') + (d ? `<text x="${cx}" y="${b.y + b.h * 0.8}" text-anchor="middle" class="pbl" style="font-size:${f}px;fill:${LEGC[d] || '#E9EEF2'}">${d}</text>` : ''); }
  const f = Math.max(2.1, Math.min(3.4, (b.w + 7) / Math.max(3, L.length) * 1.5));
  return `<g class="ft" data-t="${esc(t.id)}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="#000" fill-opacity="0"/>` + o + (L ? `<text x="${cx}" y="${b.y - 1.3}" text-anchor="middle" class="ftn" style="fill:#F2F5F8;font-size:${f.toFixed(1)}px">${esc(L)}</text>` : '') + '</g>'; }
function mcdu(x, y, w, h) { const X = f => x + w * f, Y = f => y + h * f; let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#56677A"/><rect x="${X(.18)}" y="${Y(.11)}" width="${w * .66}" height="${h * .36}" fill="#030405" stroke="#0C0F12"/>`;
  const txt = (s, fx2, fy, c, a) => `<text x="${X(fx2)}" y="${Y(fy)}" text-anchor="${a || 'start'}" class="pbl" style="font-size:${w * 0.036}px;fill:${c || '#E9EEF2'}">${s}</text>`;
  o += txt('MCDU MENU', .51, .15, '#E9EEF2', 'middle') + txt('&lt;FMGC (REQ)', .2, .2, '#3CCB7F') + txt('&lt;ATSU', .2, .25) + txt('&lt;AIDS', .2, .3) + txt('&lt;CFDS', .2, .35) + txt('RETURN&gt;', .82, .45, '#E9EEF2', 'end');
  [.16, .21, .26, .31, .36, .41].forEach(f => { o += `<rect x="${X(.03)}" y="${Y(f) - 1.4}" width="${w * .07}" height="2.8" rx=".8" fill="#262C32"/><rect x="${X(.9)}" y="${Y(f) - 1.4}" width="${w * .07}" height="2.8" rx=".8" fill="#262C32"/>`; });
  const key = (cx, cy, kw, kh, s, rnd) => rnd ? `<circle cx="${cx}" cy="${cy}" r="${kw / 2}" fill="#15191D" stroke="#59626B" stroke-width=".3"/><text x="${cx}" y="${cy + kw * 0.2}" text-anchor="middle" class="pbl" style="font-size:${kw * 0.6}px;fill:#E9EEF2">${s}</text>` :
    `<rect x="${cx - kw / 2}" y="${cy - kh / 2}" width="${kw}" height="${kh}" rx=".9" fill="#15191D" stroke="#59626B" stroke-width=".3"/><text x="${cx}" y="${cy + Math.min(kh * 0.26, kw * 0.14)}" text-anchor="middle" class="pbl" style="font-size:${Math.min(kh * 0.62, kw / (Math.max(1, s.length) * 0.66))}px;fill:#E9EEF2">${s}</text>`;
  [['DIR', 'PROG', 'PERF', 'INIT', 'DATA', ''], ['F-PLN', 'RAD NAV', 'FUEL', 'SEC', 'ATC', 'MENU'], ['AIRPORT', '']].forEach((r, i) => r.forEach((s, j) => { o += key(X(.135 + j * .105), Y(.512 + i * .052), w * .09, h * .036, s); }));
  o += key(X(.89), Y(.512), w * .07, h * .036, 'BRT') + key(X(.89), Y(.564), w * .07, h * .036, 'DIM');
  [['←', '↑'], ['→', '↓']].forEach((r, i) => r.forEach((s, j) => { o += key(X(.135 + j * .105), Y(.668 + i * .052), w * .09, h * .036, s); }));
  ['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST', 'UVWXY'].forEach((r, i) => [...r].forEach((s, j) => { o += key(X(.45 + j * .0985), Y(.648 + i * .0605), w * .075, h * .046, s); }));
  ['Z', '/', 'SP', 'OVFY', 'CLR'].forEach((s, j) => { o += key(X(.45 + j * .0985), Y(.951), w * .075, h * .046, s); });
  [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', '±']].forEach((r, i) => r.forEach((s, j) => { o += key(X(.157 + j * .0985), Y(.789 + i * .055), w * .07, 0, s, true); }));
  return o; }
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
    if (d) { out.push(`<g class="fp"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${LK.pan}" stroke="#2C343C" stroke-width="1"/>` + (it.length || /^BLANK/.test(n) ? '' : `<text x="${x + w / 2}" y="${y + h / 2 + 2}" text-anchor="middle" class="fpn" style="fill:#AEB9C4;font-size:4.5px">${esc(n)}</text>`) +
      d.map(e => e[0] === 't' ? `<text x="${e[2]}" y="${e[3] + e[4] * 0.36}" text-anchor="middle" class="fpn" style="fill:#F2F5F8;font-size:${e[4]}px">${esc(e[1])}</text>` : e[0] === 'c' ? `<circle cx="${e[1]}" cy="${e[2]}" r="${e[3]}" fill="#0C0F12" stroke="#2A3138" stroke-width="1.2"/><circle cx="${e[1]}" cy="${e[2]}" r="${e[3] * 0.62}" fill="#15191D"/>` : e[0] === 'd' ? `<rect x="${e[2]}" y="${e[3]}" width="${e[4]}" height="${e[5]}" rx="1" fill="#050607" stroke="#0C0F12"/><text x="${e[2] + e[4] / 2}" y="${e[3] + e[5] * 0.72}" text-anchor="middle" class="pbl" style="font-size:${Math.min(e[5] * 0.62, e[4] / (e[1].length * 0.62))}px;fill:#F2A623;white-space:pre">${esc(e[1])}</text>` : e[0] === 'l' ? `<line x1="${e[1]}" y1="${e[2]}" x2="${e[3]}" y2="${e[4]}" stroke="${e[5]}" stroke-width="${e[5] === '#C9D2DA' ? .6 : 1.1}" stroke-linecap="round"/>` :
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
