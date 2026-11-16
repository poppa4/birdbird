"""Beechcraft Super King Air: views and named controls. Model: FlightGear Super King Air by Emmanuel Baranger (GPL-2.0)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, re
NAME = 'b200'; CONST = 'B200_T'; ID = 'b200'; JSVAR = 'B200'; TITLE = 'Beechcraft King Air B200'; CREW = 2
CREDIT_LONG = 'Model: FlightGear Beechcraft Super King Air (github.com/FGMEMBERS/Beechcraft-King-Air, GPL-2.0, by Emmanuel Baranger).'
IMG = {'v': 'Super King Air 200 series, EFIS', 'by': 'FlightGear Super King Air (E. Baranger)', 'lic': 'GPL-2.0', 'src': 'https://github.com/FGMEMBERS/Beechcraft-King-Air', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'ovh': ((-4.16, 0.32, 0), (-0.423, 0.906, 0), (0.906, 0.423, 0), 0.56, 0.40, 2800, 1, 1), 'main': ((-4.585, -0.24, 0), (-1, 0, 0), (0, 1, 0), 1.42, 0.62, 2800, 3, 1), 'sub': ((-4.5, -0.44, 0.1), (-0.62, -0.78, 0), (-0.78, 0.62, 0), 1.4, 0.26, 2800, 2, 1),
         'ped': ((-4.25, -0.62, 0), (-0.3, -0.95, 0), (-0.95, 0.3, 0), 0.36, 1.1, 2800, 1, 2), 'left': ((-4.3, -0.5, 0.7), (0, 0, 1), (0, 1, 0), 0.42, 0.26, 2800, 1, 1), 'right': ((-4.23, -0.5, -0.7), (0, 0, -1), (0, 1, 0), 0.56, 0.34, 2800, 1, 1)}
CROP = {'main': (0, 0, 3975, 1236), 'sub': (345, 60, 3920, 728), 'ped': (0, 780, 1008, 2120), 'left': (0, 0, 1060, 728)}
SW = 'Instruments/Switch/'
def at(sh, view, file, x, y, maxsize=220):
    X = sh.pos[view][0] + x - sh.crop.get(view, (0, 0))[0]; Y = sh.pos[view][1] + y - sh.crop.get(view, (0, 0))[1]; best = None
    for o in sh.O:
        if file not in o['file']: continue
        if abs(((o['v'] - sh.V[view]['c']) @ sh.V[view]['n']).mean()) > 0.2: continue
        q = sh.proj(view, o['v']); mn, mx = q.min(0), q.max(0)
        if (mx - mn).max() > maxsize: continue
        d = np.hypot(*((mn + mx) / 2 - (X, Y)))
        if best is None or d < best[0]: best = (d, mn, mx)
    assert best and best[0] < 50, (view, x, y, best and best[0])
    return [float(best[1][0]), float(best[1][1]), float(best[2][0] - best[1][0]), float(best[2][1] - best[1][1])]
K = 4 / 3
SUB = {  # panel -> [(control, x, y)] on the labelled sub-panel picture (x, y read at 3/4 scale; right half starts at 1920)
 'ELECTRICAL': [('BAT', 383, 165, 0), ('GEN 1', 448, 165, 0), ('GEN 2', 508, 165, 0)],
 'ENGINE': [('AUTO IGNITION L', 610, 68, 0), ('AUTO IGNITION R', 693, 68, 0), ('ENGINE ANTI-ICE L', 594, 160, 0), ('ENGINE ANTI-ICE R', 673, 160, 0), ('ANTI-ICE ACTUATOR L', 594, 252, 0), ('ANTI-ICE ACTUATOR R', 673, 252, 0),
            ('ENGINE START L', 370, 345, 0), ('ENGINE START R', 435, 345, 0), ('AUTOFEATHER', 568, 347, 0), ('PROP GOV TEST', 648, 347, 0), ('PROP OVERSPEED TEST', 695, 347, 0)],
 'LIGHTS': [('LANDING L', 940, 160, 0), ('LANDING R', 985, 160, 0), ('TAXI', 1027, 160, 0), ('ICE', 1070, 160, 0), ('NAV', 1113, 160, 0), ('RECOG', 1156, 160, 0), ('BEACON', 1327, 160, 0), ('STROBE', 1377, 160, 0), ('TAIL FLOOD', 1377, 255, 0)],
 'ICE PROTECTION': [('WSHLD ANTI-ICE PILOT', 952, 255, 0), ('WSHLD ANTI-ICE COPILOT', 995, 255, 0), ('PROP DEICE AUTO', 1038, 255, 0), ('PROP DEICE MANUAL', 1082, 255, 0), ('FUEL VENT HEAT L', 1120, 255, 0), ('FUEL VENT HEAT R', 1163, 255, 0),
                    ('BRAKE DEICE', 945, 345, 0), ('SURFACE DEICE', 985, 345, 0), ('STALL WARN HEAT', 1030, 345, 0), ('PITOT HEAT L', 1072, 345, 0), ('PITOT HEAT R', 1113, 345, 0)],
 'ENVIRONMENTAL': [('MANUAL TEMP', 633, 165, 1), ('VENT BLOWER', 683, 165, 1), ('CABIN TEMP MODE', 820, 165, 1), ('CABIN TEMP', 938, 165, 1), ('BLEED AIR VALVE L', 663, 258, 1), ('BLEED AIR VALVE R', 740, 258, 1), ('STALL WARN TEST', 515, 348, 1),
                   ('AFT BLOWER', 638, 348, 1), ('ELEC HEAT', 752, 348, 1)]}
OVH = [('WINDSHIELD WIPER', 443, 225), ('PILOT OVHD FLOOD', 554, 220), ('INSTR INDIRECT', 652, 220), ('COPILOT OVHD FLOOD', 750, 220), ('MASTER PANEL LIGHTS', 270, 368), ('PILOT FLIGHT INSTR LT', 362, 368), ('ENGINE INSTR LT', 554, 368), ('AVIONICS PANEL LT', 652, 368),
       ('OVHD PED & SUBPANEL LT', 750, 368), ('SIDE PANEL LT', 845, 368), ('COPILOT GYRO INSTR LT', 942, 368), ('COPILOT FLIGHT INSTR LT', 1040, 368), ('VOLTMETER BUS SELECT', 714, 702), ('INSTRUMENT EMERG LIGHTS', 1158, 690)]
def CTL(sh):
    P = lambda n: rf'.*/panel/{n}:.*'; R = []
    for name, x, y in OVH: R.append((f'OVERHEAD|{name}', 'ovh', at(sh, 'ovh', SW, x * 1568 / 1300, y * 1568 / 1300), {'min': 60}))
    R += [('OVERHEAD|L DC % LOAD', 'ovh', r'.*/DC-Load1:.*'), ('OVERHEAD|R DC % LOAD', 'ovh', r'.*/DC-Load2:.*'), ('OVERHEAD|DC VOLTS / BAT AMPS', 'ovh', r'.*/volts:.*'), ('OVERHEAD|PROP AMPS', 'ovh', r'.*/amps:.*')]
    for sfx, sg in (('PILOT', 1), ('COPILOT', -1)):
        R += [(f'{sfx} PANEL|AIRSPEED {sfx}', 'main', P('asi'), {'side': sg}), (f'{sfx} PANEL|RMI {sfx}', 'main', P('rmi'), {'side': sg}), (f'{sfx} PANEL|TURN AND SLIP {sfx}', 'main', P('turn'), {'side': sg}), (f'{sfx} PANEL|VERTICAL SPEED {sfx}', 'main', P('vsi'), {'side': sg}),
              (f'{sfx} PANEL|DME {sfx}', 'main', P('ki266'), {'side': sg})]
    R += [('PILOT PANEL|EADI', 'main', P('eadi')), ('PILOT PANEL|EHSI', 'main', P('ehsi')), ('PILOT PANEL|ALTIMETER PILOT', 'main', P('alt')), ('COPILOT PANEL|ATTITUDE COPILOT', 'main', P('ai')), ('COPILOT PANEL|ALTIMETER COPILOT', 'main', P('alt2')),
          ('COPILOT PANEL|HSI COPILOT', 'main', P('hsi')), ('COPILOT PANEL|RADIO ALTIMETER', 'main', P('kra10a')), ('AVIONICS|MFD / WEATHER RADAR', 'main', r'.*/panel/radar:(fond|contour|face|texte|button.*|knob.*)'), ('AVIONICS|ALTITUDE ALERTER', 'main', P('cfg-alt')),
          ('AVIONICS|COM 1', 'main', P('ctl22-com1')), ('AVIONICS|COM 2', 'main', P('ctl22-com2')), ('AVIONICS|NAV 1', 'main', P('ctl32-nav1')), ('AVIONICS|NAV 2', 'main', P('ctl32-nav2')), ('AVIONICS|ADF', 'main', P('ctl62-adf')), ('AVIONICS|TRANSPONDER', 'main', P('ctl92-transponder')),
          ('AVIONICS|AUDIO PANEL', 'main', r'.*/all-switchs/(switch|dinner|dinner2):.*', {'whole': 1})]
    for lab, key in (('ITT', 'itt'), ('TORQUE', 'torq'), ('PROP RPM', 'rpm'), ('TURBINE N1', 'n2'), ('FUEL FLOW', 'fflow'), ('OIL', 'oilp')): R += [(f'ENGINE INSTRUMENTS|{lab} {i}', 'main', P(f'{key}{i}'), {'pad': 12}) for i in (1, 2)]
    for panel, L in SUB.items():
        for name, x, y, right in L: R.append((f'{panel}|{name}', 'sub', at(sh, 'sub', SW, (1920 if right else 0) + x * K, y * K), {'min': 60}))
    R += [('LANDING GEAR|GEAR HANDLE', 'sub', r'.*/panel/gear:(PalancaTren|base)'), ('LANDING GEAR|GEAR LIGHTS', 'sub', r'.*/panel/gear:(left|right|nose)(ON|OFF)', {'pad': 10}), ('ANNUNCIATORS|CAUTION / ADVISORY PANEL', 'sub', P('warning')),
          ('PRESSURIZATION|FLAPS INDICATOR', 'sub', P('flaps')), ('PRESSURIZATION|CABIN CLIMB', 'sub', P('vsi2')), ('PRESSURIZATION|CABIN ALT', 'sub', P('alt3')),
          ('POWER QUADRANT|POWER LEVER L', 'ped', r'.*:throttleL'), ('POWER QUADRANT|POWER LEVER R', 'ped', r'.*:throttleR'), ('POWER QUADRANT|PROP LEVER L', 'ped', r'.*:pitchL'), ('POWER QUADRANT|PROP LEVER R', 'ped', r'.*:pitchR'),
          ('POWER QUADRANT|CONDITION LEVER L', 'ped', r'.*:mixtureL'), ('POWER QUADRANT|CONDITION LEVER R', 'ped', r'.*:mixtureR'), ('POWER QUADRANT|FLAP LEVER', 'ped', r'.*:flapslev', {'pad': 20}),
          ('TRIM|ELEVATOR TRIM', 'ped', r'.*:trimpitch'), ('TRIM|AILERON TRIM', 'ped', r'.*:trimroll'), ('TRIM|RUDDER TRIM', 'ped', r'.*:trimrudder'),
          ('FUEL|FUEL PANEL', 'left', r'.*/left:(left|texte)', {'whole': 1}), *[(f'FUEL|{n}', 'left', at(sh, 'left', SW, x, y), {'min': 60}) for n, x, y in (('STANDBY PUMP L', 141, 177), ('AUX TRANSFER L', 138, 260), ('CROSSFEED', 582, 170), ('FUEL QTY TEST', 572, 346), ('STANDBY PUMP R', 1007, 174), ('AUX TRANSFER R', 1004, 260))],
          ('FUEL|FUEL QTY L', 'left', r'.*/fuel-qty1:.*'), ('FUEL|FUEL QTY R', 'left', r'.*/fuel-qty2:.*'), ('CIRCUIT BREAKERS|CIRCUIT BREAKERS', 'right', r'.*/right:(right|texte|fusibles)', {'whole': 1})]
    return R
