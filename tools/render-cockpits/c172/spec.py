"""Cessna 172P: views and named controls. Model: FlightGear c172p (github.com/c172p-team/c172p, GPL-2.0)."""
NAME = 'c172'; CONST = 'C172_T'
VIEWS = {'front': ((-0.36, -0.16, 0), (-1, 0, 0), (0, 1, 0), 1.24, 0.92, 2800, 2, 2), 'fuel': ((-0.21, -0.64, 0), (0, -1, 0), (-1, 0, 0), 0.24, 0.24, 2800, 1, 1)}
P = 'c172p'
def I(n): return rf'{P}/{n}:.*'          # a whole instrument
def O(n): return rf'{P}:{n}'             # an object of the panel
def S(i, n): return rf'{P}/{i}:{n}'      # an object inside an instrument
m = {'min': 54}
CTL = [
  ('FLIGHT INSTRUMENTS|AIRSPEED', 'front', I('asi')), ('FLIGHT INSTRUMENTS|ATTITUDE', 'front', S('AI', '(Case|Bezel|Roll.*|Pitch)')), ('FLIGHT INSTRUMENTS|ATTITUDE ADJUST', 'front', S('AI', 'AdjustKnob'), m),
  ('FLIGHT INSTRUMENTS|ALTIMETER', 'front', S('Altimeter', '(Case|Face)')), ('FLIGHT INSTRUMENTS|ALTIMETER SETTING', 'front', S('Altimeter', 'Case'), {'rel': (0.10, 0.88, 64, 64)}),
  ('FLIGHT INSTRUMENTS|TURN COORD', 'front', I('Turn')), ('FLIGHT INSTRUMENTS|HEADING', 'front', S('hi', '(Case|Face)')), ('FLIGHT INSTRUMENTS|HEADING BUG', 'front', S('hi', 'Hdg-Knob'), m), ('FLIGHT INSTRUMENTS|HEADING SET', 'front', S('hi', 'OBS-Knob'), m),
  ('FLIGHT INSTRUMENTS|VSI', 'front', I('VSI')), ('NAV INSTRUMENTS|VOR 1', 'front', S('vor1', '(Case|Face|Ring)')), ('NAV INSTRUMENTS|VOR 1 OBS', 'front', S('vor1', 'Case'), {'rel': (0.13, 0.87, 64, 64)}),
  ('NAV INSTRUMENTS|VOR 2', 'front', S('vor2', '(Case|Face|Ring)')), ('NAV INSTRUMENTS|VOR 2 OBS', 'front', S('vor2', 'Case'), {'rel': (0.13, 0.87, 64, 64)}),
  ('NAV INSTRUMENTS|ADF', 'front', S('adf', '(Case|CompassRose)')), ('NAV INSTRUMENTS|ADF HDG', 'front', S('adf', 'HDGSelector'), m),
  ('ENGINE INSTRUMENTS|TACHOMETER', 'front', I('RPM')), ('ENGINE INSTRUMENTS|EGT', 'front', S('EGT', '(Case|Face)')), ('ENGINE INSTRUMENTS|EGT BUG', 'front', S('EGT', 'Knob'), m), ('ENGINE INSTRUMENTS|FUEL QTY', 'front', I('fuel')), ('ENGINE INSTRUMENTS|OIL TEMP/PRESS', 'front', I('oil')),
  ('ENGINE INSTRUMENTS|SUCTION', 'front', I('vac')), ('ENGINE INSTRUMENTS|AMMETER', 'front', I('BatteryGauge')), ('ENGINE INSTRUMENTS|CLOCK', 'front', I('clock')), ('ENGINE INSTRUMENTS|LOW VOLTAGE', 'front', O('LowVoltageLed.*'), m), ('RIGHT PANEL|HOBBS', 'front', I('hobbs')),
  ('COMPASS|MAGNETIC COMPASS', 'front', rf'{P}/MagCompass:.*'),
  ('AUDIO PANEL|AUDIO PANEL', 'front', S('kma20', 'Chassis'), {'whole': 1}), ('AUDIO PANEL|MIC SELECT', 'front', S('kma20', 'Knob'), m), ('AUDIO PANEL|MARKER SENS', 'front', S('kma20', 'SENS.*'), m),
  *[(f'AUDIO PANEL|{n}', 'front', S('kma20', f'{k}(Up|Down)?'), {'min': 46}) for n, k in (('COM 1 AUDIO', 'COM1'), ('COM 2 AUDIO', 'COM2'), ('NAV 1 AUDIO', 'NAV1'), ('NAV 2 AUDIO', 'NAV2'), ('ADF AUDIO', 'ADF'), ('DME AUDIO', 'DME'), ('MKR AUDIO', 'MKR'), ('AUTO', 'AUTO'))],
  *[x for i in (1, 2) for x in ((f'COM/NAV {i}|COM/NAV {i}', 'front', S(f'kx165-{i}', 'KX165'), {'whole': 1}), (f'COM/NAV {i}|COM {i} VOL', 'front', S(f'kx165-{i}', 'COMvol'), m), (f'COM/NAV {i}|COM {i} XFER', 'front', S(f'kx165-{i}', 'COMxfer'), m),
      (f'COM/NAV {i}|COM {i} FREQ', 'front', S(f'kx165-{i}', 'COMknob.HZ'), m), (f'COM/NAV {i}|COM {i} CHAN', 'front', S(f'kx165-{i}', 'COMchan'), m), (f'COM/NAV {i}|NAV {i} VOL', 'front', S(f'kx165-{i}', 'NAVvol'), m), (f'COM/NAV {i}|NAV {i} XFER', 'front', S(f'kx165-{i}', 'NAVxfer'), m),
      (f'COM/NAV {i}|NAV {i} FREQ', 'front', S(f'kx165-{i}', 'NAVknob.HZ'), m), (f'COM/NAV {i}|NAV {i} MODE', 'front', S(f'kx165-{i}', 'NAVmode'), m))],
  ('ADF RECEIVER|ADF RECEIVER', 'front', S('kr87', 'Chassis'), {'whole': 1}), ('ADF RECEIVER|ADF FREQ', 'front', S('kr87', 'FRQ(Inner|Outer)'), m), ('ADF RECEIVER|ADF VOL', 'front', S('kr87', 'Volume'), m),
  *[(f'ADF RECEIVER|ADF {k}', 'front', S('kr87', rf'knobs\.{k}'), {'min': 46}) for k in ('ADF', 'BFO', 'FRQ', 'FLT', 'SET')],
  ('DME|DME', 'front', S('dme', '(Frame|Background|base)'), {'whole': 1}), ('DME|DME MODE', 'front', S('dme', 'ModeSwitch'), m), ('DME|DME POWER', 'front', S('dme', r'PowerSwitch\..*'), m), ('DME|DME SOURCE', 'front', S('dme', 'SourceSelectorKnob'), m),
  ('TRANSPONDER|TRANSPONDER', 'front', S('transponder', '(Border|Front)'), {'whole': 1}), ('TRANSPONDER|XPDR MODE', 'front', S('transponder', 'KnobMode'), m), ('TRANSPONDER|XPDR IDENT', 'front', S('transponder', 'Ident'), m),
  *[(f'TRANSPONDER|XPDR CODE {d}', 'front', S('transponder', f'Knob{k}'), {'min': 46}) for d, k in ((1, 1000), (2, 100), (3, 10), (4, 1))],
  ('SWITCHES|MAGNETOS / START', 'front', I('mag_sw')), ('SWITCHES|MASTER ALT', 'front', O('GenSwitch')), ('SWITCHES|MASTER BAT', 'front', O('MasterSwitch')), ('SWITCHES|AVIONICS POWER', 'front', O('AvionicsSwitch(Base)?')),
  ('SWITCHES|PRIMER', 'front', O('PrimerLever(Mount)?')), ('SWITCHES|TAXI LT', 'front', O('TaxiLightSwitch')), ('SWITCHES|LANDING LT', 'front', O('LandingLightSwitch')), ('SWITCHES|PITOT HEAT', 'front', O('PitotHeatSwitch')), ('SWITCHES|NAV LT', 'front', O('NavLightSwitch')),
  ('SWITCHES|BEACON', 'front', O('BeaconSwitch')), ('SWITCHES|STROBE', 'front', O('StrobeSwitch')), ('SWITCHES|PANEL LT', 'front', O('panel-light-knob'), {'w': 86, 'h': 86}), ('SWITCHES|RADIO LT', 'front', O('radio-light-knob'), {'w': 44, 'h': 44}),
  *[(f'CIRCUIT BREAKERS|CB {n}', 'front', O(f'{k}_breaker'), {'min': 40}) for n, k in (('MASTER', 'master'), ('FLAP', 'flaps'), ('PITOT HEAT', 'pitot-heat'), ('INST', 'instr'), ('INT LT', 'intlt'), ('NAV LT', 'navlt'), ('LDG LT', 'landing'), ('BCN LT', 'bcnlt'), ('STROBE', 'strobe'), ('TURN COORD', 'turn-coordinator'),
      ('RADIO 1', 'radio1'), ('RADIO 2', 'radio2'), ('RADIO 3', 'radio3'), ('RADIO 4', 'radio4'), ('RADIO 5', 'radio5'), ('AUTOPILOT', 'autopilot'))],
  ('ENGINE CONTROLS|CARB HEAT', 'front', O('CarbHeat(Mount)?')), ('ENGINE CONTROLS|THROTTLE', 'front', O('Throttle(Mount)?')), ('ENGINE CONTROLS|MIXTURE', 'front', O('Mixture(Mount)?')), ('ENGINE CONTROLS|ALT STATIC AIR', 'front', O('AltStaticAir'), m),
  ('FLAPS|WING FLAPS', 'front', S('FlapSwitch', '(FlapSwitch|rect|FlapPos)')), ('CABIN|CABIN HEAT', 'front', O('CabinHeat')), ('CABIN|CABIN AIR', 'front', O('CabinAir')), ('CABIN|ACCESSORY PORT', 'front', O('accport'), m),
  ('PEDESTAL|PARKING BRAKE', 'front', O('ParkingBrake')), ('PEDESTAL|ELEVATOR TRIM', 'front', O('TrimWheel'), {'w': 150}), ('PEDESTAL|RUDDER TRIM', 'front', O('RudderTrim(Knob|Base)')),
  ('FUEL SELECTOR|FUEL SELECTOR', 'fuel', O('FuelSelector(Face|Both)')),
]
ID = 'c172'; JSVAR = 'C172'; TITLE = 'Cessna 172'; CREW = 1
CREDIT_LONG = 'Model: FlightGear Cessna 172P (github.com/c172p-team/c172p, GPL-2.0, by David Megginson, Gilberto Agostinho, Wayne Bragg, Juan Vera del Campo, onox, thevirtualfer, Daniel Dubreuil and others).'
IMG = {'v': 'Cessna 172P, classic instruments', 'by': 'FlightGear c172p team', 'lic': 'GPL-2.0', 'src': 'https://github.com/c172p-team/c172p', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}

def post(k, im):          # lift the shadows a little: the panel is black and the floor is in shade
    from PIL import Image
    a = im.getchannel('A'); rgb = im.convert('RGB').point(lambda v: int(255 * (v / 255) ** 0.82)); rgb.putalpha(a); return rgb
