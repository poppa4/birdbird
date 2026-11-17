"""Piper PA-28-161 Warrior: views and named controls. Model: FlightGear PA28 Warrior (GPL-2.0)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, re
NAME = 'pa28'; CONST = 'PA28_T'; ID = 'pa28'; JSVAR = 'PA28'; TITLE = 'Piper PA-28 Warrior'; CREW = 1
CREDIT_LONG = 'Model: FlightGear Piper PA-28-161 Warrior (github.com/FGMEMBERS/PA28-Warrior, GPL-2.0).'
IMG = {'v': 'PA-28-161 Warrior II/III with a GNS 530', 'by': 'FlightGear PA28 Warrior', 'lic': 'GPL-2.0', 'src': 'https://github.com/FGMEMBERS/PA28-Warrior', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'main': ((-1.73, 0.16, 0), (-1, 0, 0), (0, 1, 0), 1.12, 0.66, 2800, 2, 1), 'floor': ((-1.52, -0.37, 0), (0, -1, 0), (-1, 0, 0), 0.3, 0.5, 2800, 1, 1), 'fuel': ((-1.72, -0.23, 0.53), (0, 0, 1), (0, 1, 0), 0.18, 0.18, 2800, 1, 1)}
CROP = {'main': (0, 60, 3136, 1640), 'floor': (150, 250, 690, 1380)}
def VP(sh, view, x, y, w, h):
    p = sh.pos[view]; c = sh.crop.get(view, (0, 0)); return [p[0] + x - c[0], p[1] + y - c[1], w, h]
K = 1600 / 1500
def CTL(sh):
    R = []
    def I(n, inst, **o): R.append((n, 'main', inst + r':.*', dict({'min': 40}, **o)))
    def N(n, pat, **o): R.append((n, 'main', ':' + pat, dict({'min': 46}, **o)))
    def L(n, x, y, w, h=None, **o): h = h or w; R.append((n, 'main', VP(sh, 'main', (x - w / 2) * K, (y - h / 2) * K, w * K, h * K), o))            # left picture
    def Rr(n, x, y, w, h=None, **o): h = h or w; R.append((n, 'main', VP(sh, 'main', 1536 + (x - w / 2) * K, (y - h / 2) * K, w * K, h * K), o))    # right picture
    for n, i in (('AIRSPEED INDICATOR', 'ASI'), ('ALTIMETER', 'ALT'), ('VOR 1 (CDI)', 'VOR1'), ('VOR 2 (CDI)', 'VOR2'), ('VERTICAL SPEED', 'VSI'), ('CLOCK', 'CLOCK'), ('TACHOMETER', 'rpm'), ('EGT', 'EGT'), ('HOUR METER', 'HOBBS'), ('AMMETER', 'AMPVOL')): I('FLIGHT INSTRUMENTS|' + n if n in ('AIRSPEED INDICATOR', 'ALTIMETER', 'VOR 1 (CDI)', 'VOR 2 (CDI)', 'VERTICAL SPEED', 'CLOCK') else 'ENGINE|' + n, i)
    L('FLIGHT INSTRUMENTS|ATTITUDE INDICATOR', 835, 635, 200); L('FLIGHT INSTRUMENTS|TURN COORDINATOR', 566, 862, 200); L('FLIGHT INSTRUMENTS|HEADING INDICATOR (HSI)', 835, 862, 205); I('FLIGHT INSTRUMENTS|COMPASS', 'COMP', pad=10)
    I('ENGINE|MAGNETOS / START', 'mags', pad=18); I('ENGINE|PRIMER', 'Primer'); I('ENGINE|ENGINE GAUGES', 'FUEL_OIL'); I('PANEL|ELT', 'ELT'); N('ANNUNCIATOR|ANNUNCIATOR PANEL', r'annun\.base'); L('ANNUNCIATOR|ANNUNCIATOR TEST', 1053, 507, 36)
    L('PANEL|AUTOPILOT AND TRIM SWITCHES', 460, 1054, 385, 70, whole=1); L('PANEL|LOW VACUUM LIGHT', 167, 790, 60, 40)
    N('ENGINE CONTROLS|THROTTLE', r'throttle\.lever'); N('ENGINE CONTROLS|MIXTURE', r'mixture\.lever'); N('ENGINE CONTROLS|CARB HEAT', r'carbheat\.lever'); N('ENGINE CONTROLS|FRICTION LOCK', 'FrictionLock'); L('PANEL|PARKING BRAKE', 1235, 1490, 70, 80)
    Rr('AVIONICS|AUDIO PANEL', 310, 525, 420, 80, whole=1); Rr('AVIONICS|GNS 530', 310, 722, 420, 300, whole=1); Rr('AVIONICS|AUTOPILOT (S-TEC 55X)', 310, 925, 420, 105, whole=1)
    Rr('AVIONICS|COM / NAV 1', 770, 667, 415, 132, whole=1); Rr('AVIONICS|COM / NAV 2', 770, 800, 415, 132, whole=1); Rr('AVIONICS|TRANSPONDER', 770, 922, 415, 105, whole=1); Rr('AVIONICS|NAV 1 / NAV 2 SELECT', 610, 560, 30)
    for n, x, w in (('BATTERY MASTER', 148, 26), ('ALTERNATOR', 175, 26), ('FUEL PUMP', 228, 58), ('LANDING LIGHT', 298, 58), ('FIN STROBE', 352, 28), ('WING STROBE', 380, 28), ('PITOT HEAT', 431, 58)): Rr('SWITCHES|' + n, x, 1100, w, 86)
    Rr('SWITCHES|NAV LIGHT / RADIO DIM', 102, 1100, 34, 104); Rr('SWITCHES|PANEL LIGHT DIM', 492, 1100, 34, 104)
    N('AVIONICS MASTER|PRIMARY', r'avionics\.primary\.switch'); N('AVIONICS MASTER|SECONDARY', r'avionics\.secondary\.switch'); Rr('CABIN|FAN', 858, 1085, 70, 70); N('CABIN|CABIN HEAT', r'cabinheat\.lever'); N('CABIN|DEFROSTER', r'defroster\.lever')
    R.append(('CIRCUIT BREAKERS', 'main', r'CircuitBreakers:.*', {'whole': 1}))
    R.append(('FLOOR|FLAPS', 'floor', VP(sh, 'floor', 415, 330, 110, 580))); R.append(('FLOOR|PITCH TRIM', 'floor', VP(sh, 'floor', 275, 860, 290, 445)))
    R.append(('FUEL SELECTOR', 'fuel', r'fuel selector:.*', {'pad': 20}))
    return R
