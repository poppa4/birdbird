"""Diamond DA42 Twin Star (G1000-style): views and named controls. Model: FlightGear Diamond DA42 (GPL-2.0)."""
from PIL import Image
NAME = 'da42'; CONST = 'DA42_T'; ID = 'da42'; JSVAR = 'DA42'; TITLE = 'Diamond DA42 (G1000)'; CREW = 1
CREDIT_LONG = 'Model: FlightGear Diamond DA42 (github.com/FGMEMBERS/Diamond-DA42, GPL-2.0, by Emmanuel Baranger, OO ZVY, Jeep and MrZac).'
IMG = {'v': 'DA42 Twin Star', 'by': 'FlightGear DA42 (E. Baranger and others)', 'lic': 'GPL-2.0', 'src': 'https://github.com/FGMEMBERS/Diamond-DA42', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'front': ((-1.96, 0.19, 0), (-1, 0, 0), (0, 1, 0), 1.10, 0.62, 2800, 2, 1), 'ped': ((-1.58, -0.05, 0), (0, -1, 0), (-1, 0, 0), 0.34, 0.80, 2800, 1, 1)}
GAP = 30; CROP = {'front': (0, 0, 3080, 1450), 'ped': (290, 0, 670, 1570)}
P = 'interior/panel'
def I(n): return rf'{P}/{n}:.*'
def S(i, n): return rf'{P}/{i}:{n}'
m = {'min': 50}; k = {'min': 40}
def gdu(u, nm):
    R = [(f'{nm}|{nm}', 'front', S(u, 'ai.background|radios.main|menu.main'), {'whole': 1})]
    for lab, pat in (('NAV VOL', None), ('NAV', r'knob\.NAV\..*'), ('HDG', r'knob\.HDG'), ('ALT', r'knob\.ALT\..*'), ('COM', r'knob\.COMM\..*'), ('CRS/BARO', r'knob\.(CRS|BARO)'), ('RANGE', r'knob\.RANGE\..*'), ('FMS', r'knob\.FMS\..*'),
                     ('NAV SWAP', r'softkey\.NAV\.swap'), ('COM SWAP', r'softkey\.COMM\.swap'), ('DIRECT-TO', r'softkey\.D'), ('MENU', r'softkey\.MENU'), ('FPL', r'softkey\.FPL'), ('PROC', r'softkey\.PROC'), ('CLR', r'softkey\.CLR'), ('ENT', r'softkey\.ENT')):
        if pat: R.append((f'{nm}|{nm} {lab}', 'front', S(u, pat), m if 'knob' in pat else k))
    R += [(f'{nm}|{nm} SOFTKEY {i}', 'front', S(u, rf'softkey\.{i:02d}'), k) for i in range(2, 13)]
    if u == 'mfd': R += [(f'AUTOPILOT|AP {lab}', 'front', S(u, rf'softkey\.{key}'), k) for lab, key in (('AP', 'AP'), ('FD', 'FD'), ('HDG', 'HDG'), ('ALT', 'ALT'), ('NAV', 'NAV'), ('VNV', 'VNV'), ('APR', 'APR'), ('VS', 'VS'), ('FLC', 'FLC'), ('NOSE UP', 'NOSEUP'), ('NOSE DN', 'NOSEDOWN'))]
    return R
CB = {'cbcom1': 'COM 1', 'cbgpsnav1': 'GPS/NAV 1', 'cbxpcom': 'XPDR', 'cbenginstr': 'ENG INST', 'cbpitot': 'PITOT', 'cbdeice': 'DE-ICE', 'cbtaxilight': 'TAXI/MAP LT', 'cboxy': 'OXY', 'cbpfd': 'PFD', 'cbadc': 'ADC', 'cbahrs': 'AHRS', 'cbgearwrn': 'GEAR WRN', 'cbgearctrl': 'GEAR', 'cbmfd': 'MFD', 'cbah': 'HORIZON',
      'cbstallwrn': 'STALL WRN', 'cbflap': 'FLAP', 'cblandinglight': 'LDG LT', 'cbinstlight': 'INST LT', 'cbfans': 'AV/CDU FAN', 'cbavionicbus': 'AV BUS', 'cbavionicctrl': 'AVIONIC CTRL', 'cbcom2': 'COM 2', 'cbgpsnav2': 'GPS/NAV 2', 'cbaudio': 'AUDIO', 'cbdatalink': 'DATA LINK', 'cbwx500': 'WX 500', 'cbadf': 'ADF', 'cbdme': 'DME',
      'cbwxrdr': 'WX RDR', 'cbleftecubus': 'L ECU BUS', 'cbleftecub': 'L ECU B', 'cbleftecua': 'L ECU A', 'cbleftalt': 'L ALT', 'cbleftbat': 'L BAT', 'cbrightbat': 'R BAT', 'cbrightalt': 'R ALT', 'cbrightecubus': 'R ECU BUS', 'cbrightecub': 'R ECU B', 'cbrightecua': 'R ECU A'}
CTL = [
  ('STANDBY INSTRUMENTS|AIRSPEED', 'front', I('asi')), ('STANDBY INSTRUMENTS|ATTITUDE', 'front', S('ai', '(fond|ring|cache)')), ('STANDBY INSTRUMENTS|ATTITUDE CAGE', 'front', S('ai', 'knob'), m), ('STANDBY INSTRUMENTS|ALTIMETER', 'front', S('alt', '(fond|face)')), ('STANDBY INSTRUMENTS|ALTIMETER SETTING', 'front', S('alt', 'InhgKnob'), m),
  ('STANDBY INSTRUMENTS|COMPASS', 'front', I('comp')), ('STANDBY INSTRUMENTS|EMERGENCY HORIZON', 'front', I('emergencyhorizon')), ('ELT|ELT', 'front', I('elt')),
  ('LIGHTS|LANDING LT', 'front', I('landinglight')), ('LIGHTS|TAXI LT', 'front', I('taxilight')), ('LIGHTS|POSITION LT', 'front', I('positionlight')), ('LIGHTS|STROBE', 'front', I('strobelight')), ('LIGHTS|INSTRUMENT LT', 'front', I('instrumentknob'), m), ('LIGHTS|FLOOD LT', 'front', I('floodknob'), m),
  *gdu('pfd', 'PFD'), *gdu('mfd', 'MFD'),
  ('AUDIO PANEL|AUDIO PANEL', 'front', S('mixer', r'body\.mixer'), {'whole': 1}), ('AUDIO PANEL|AUDIO VOL', 'front', S('mixer', r'knob\.Vol\..*'), m), ('AUDIO PANEL|DISPLAY BACKUP', 'front', S('mixer', r'knob\.RED'), m),
  *[(f'AUDIO PANEL|{lab}', 'front', S('mixer', rf'softkey\.{key}'), {'min': 34}) for lab, key in (('COM 1 MIC', 'COM1MIC'), ('COM 1', 'COM1'), ('COM 2 MIC', 'COM2MIC'), ('COM 2', 'COM2'), ('COM 3 MIC', 'COM3MIC'), ('COM 3', 'COM3'), ('COM 1/2', 'COM12'), ('TEL', 'TEL'), ('PA', 'PA'), ('SPKR', 'SPKR'), ('MKR/MUTE', 'MKRMUTE'), ('HI SENS', 'HISENS'),
      ('DME AUDIO', 'DME'), ('NAV 1 AUDIO', 'NAV1'), ('ADF AUDIO', 'ADF'), ('NAV 2 AUDIO', 'NAV2'), ('AUX', 'AUX'), ('MAN SQ', 'MANSQ'), ('PLAY', 'PLAY'), ('PILOT', 'PILOT'), ('COPLT', 'COPLT'))],
  ('ENGINE / ELECTRIC|L ECU SWAP', 'front', I('leftecuswitch'), m), ('ENGINE / ELECTRIC|R ECU SWAP', 'front', I('rightecuswitch'), m), ('ENGINE / ELECTRIC|L ECU TEST', 'front', I('lefttestecubutton'), m), ('ENGINE / ELECTRIC|R ECU TEST', 'front', I('righttestecubutton'), m),
  ('ENGINE / ELECTRIC|L ALTERNATOR', 'front', I('leftalternatorswitch'), m), ('ENGINE / ELECTRIC|R ALTERNATOR', 'front', I('rightalternatorswitch'), m), ('ENGINE / ELECTRIC|L ENGINE MASTER', 'front', I('leftmasterengineswitch')), ('ENGINE / ELECTRIC|R ENGINE MASTER', 'front', I('rightmasterengineswitch')),
  ('ENGINE / ELECTRIC|START KEY', 'front', I('starter')), ('ENGINE / ELECTRIC|ELECTRIC MASTER', 'front', I('master')), ('ENGINE / ELECTRIC|AVIONIC MASTER', 'front', I('masteravionic')), ('ENGINE / ELECTRIC|PITOT HEAT', 'front', I('pitotheat')),
  ('LANDING GEAR|GEAR LEVER', 'front', I('gearlever'), m), ('LANDING GEAR|GEAR LIGHTS', 'front', rf'{P}/(left|right|front|transit)wheellight:.*'), ('LANDING GEAR|GEAR TEST', 'front', I('testtransitbutton'), m),
  ('FLAPS|FLAPS', 'front', I('flaplever'), m), ('FLAPS|FLAP LIGHTS', 'front', rf'{P}/flap(up|mid|down)light:.*'),
  ('DE-ICE|DE-ICE PANEL', 'front', S('deice', 'support'), {'whole': 1}), ('DE-ICE|DE-ICE PUMP', 'front', S('deice', r'pump\..*'), m), ('DE-ICE|DE-ICE NORM/HIGH', 'front', S('deice', r'speed.*'), m), ('DE-ICE|DE-ICE MAX', 'front', S('deice', r'max\..*'), m), ('DE-ICE|WINDSHIELD', 'front', S('deice', r'windshield\..*'), m),
  ('DE-ICE|ICE LIGHT', 'front', S('deice', r'icelight.*'), m), ('DE-ICE|DE-ICE ALTERNATE', 'front', S('deice', r'alternate\..*'), m),
  ('VENTILATION|VENT L', 'front', I('leftventilationnozzle')), ('VENTILATION|VENT R', 'front', I('rightventilationnozzle')),
  *[(f'CIRCUIT BREAKERS|CB {lab}', 'front', I(key), {'min': 40}) for key, lab in CB.items()],
  ('EMERGENCY|EMERGENCY GEAR EXTENSION', 'front', I('emergencygear')), ('EMERGENCY|ALTERNATE AIR', 'front', I('alternateair')),
  ('PEDESTAL|RUDDER TRIM', 'ped', I('ruddertrim')), ('PEDESTAL|PARKING BRAKE', 'ped', S('misclever', 'parkinglever'), m), ('PEDESTAL|CABIN HEAT', 'ped', S('misclever', 'cabinheatlever'), m), ('PEDESTAL|DEFROST', 'ped', S('misclever', 'defrostlever'), m),
  ('POWER LEVERS|POWER LEVER L', 'ped', S('throttle', 'leftthrottle'), {'w': 112, 'h': 600, 'dy': 30}), ('POWER LEVERS|POWER LEVER R', 'ped', S('throttle', 'rightthrottle'), {'w': 112, 'h': 600, 'dy': 30}),
  ('FUEL SELECTORS|FUEL SELECTOR L', 'ped', S('fuellever', 'left.*'), m), ('FUEL SELECTORS|FUEL SELECTOR R', 'ped', S('fuellever', 'right.*'), m), ('PEDESTAL|ELEVATOR TRIM', 'ped', I('trimwheel')),
]
def paint(sh):          # our own G1000 pictures over the model's display parts
    for u, f in (('pfd', 'g_pfd'), ('mfd', 'g_mfd')):
        x, y, w, h = (round(v) for v in sh.box('front', rf'{P}/{u}:(ai\.background|radios\.main|menu\.main)')); im = Image.open(f'/home/claude/rend/scr/{f}.png').convert('RGBA').resize((w, h), Image.LANCZOS); sh.S.paste(im, (x, y))
