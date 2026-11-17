"""Piper PA-34-200T Seneca II: views and named controls. Model: FlightGear SenecaII (GPL-2.0)."""
NAME = 'pa34'; CONST = 'PA34_T'; ID = 'pa34'; JSVAR = 'PA34'; TITLE = 'Piper PA-34 Seneca II'; CREW = 1
CREDIT_LONG = 'Model: FlightGear Piper PA-34-200T Seneca II (github.com/FGMEMBERS/SenecaII, GPL-2.0), with shared instruments from FlightGear FGData (GPL-2.0).'
IMG = {'v': 'PA-34-200T Seneca II', 'by': 'FlightGear Seneca II', 'lic': 'GPL-2.0', 'src': 'https://github.com/FGMEMBERS/SenecaII', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'main': ((-1.08, 1.40, 0), (-1, 0, 0), (0, 1, 0), 1.3, 0.5, 2800, 2, 1), 'side': ((-0.835, 1.28, 0.5), (0, 0, 1), (0, 1, 0), 0.32, 0.24, 2800, 1, 1),
         'floor': ((-0.74, 1.0, 0.02), (0, -1, 0), (-1, 0, 0), 0.3, 0.74, 2800, 1, 1), 'quad': ((-1.0, 1.3, 0.01), (0, -1, 0), (-1, 0, 0), 0.2, 0.2, 2800, 1, 1),
         'cowl': ((-1.04, 1.0, 0), (-0.62, -0.78, 0), (-1, 1, 0), 0.22, 0.22, 2800, 1, 1)}
CROP = {'main': (0, 70, 3640, 1400), 'floor': (0, 336, 840, 2072), 'quad': (80, 95, 500, 540), 'cowl': (166, 166, 458, 560)}
PLACE = [('main', 0, 0), ('side', 354, 1570), ('floor', 1400, 1370), ('quad', 2440, 1420), ('cowl', 2504, 1960)]
def VP(sh, view, x, y, w, h):
    p = sh.pos[view]; c = sh.crop.get(view, (0, 0)); return [p[0] + x - c[0], p[1] + y - c[1], w, h]
def post(k, im):          # the console base under the quadrant is a plain black box from above: leave it out
    if k == 'floor':
        import numpy as np; a = np.array(im); r = a[336:560]; r[(r[..., :3].max(-1) < 14)] = 0; from PIL import Image; im = Image.fromarray(a)
    return im
def CTL(sh):
    R = []
    def I(n, inst, v='main', **o): R.append((n, v, inst + r':.*', dict({'min': 50}, **o)))
    def N(n, pat, v='main', **o): R.append((n, v, ':' + pat, dict({'min': 50}, **o)))
    F = 'FLIGHT INSTRUMENTS|'
    for n, i in (('CLOCK', 'Clock'), ('AIRSPEED INDICATOR', 'ASI'), ('ATTITUDE INDICATOR', 'AI'), ('RADAR ALTIMETER', 'KRA10'), ('ADF INDICATOR', 'ADF'), ('TURN COORDINATOR', 'TC'), ('HSI', 'HSI'), ('VERTICAL SPEED', 'VSI'), ('VOR 2 (CDI)', 'VOR2')): I(F + n, i)
    I(F + 'ALTIMETER', 'Altimeter', side=1); I('RIGHT SIDE|ALTIMETER', 'Altimeter', side=-1); I('RIGHT SIDE|ATTITUDE INDICATOR', 'AI2'); I('RIGHT SIDE|HOUR METER', 'hobbs'); I('ANNUNCIATOR|ANNUNCIATOR PANEL', 'Annunciator', whole=1)
    for s, k in (('LEFT', 'L'), ('RIGHT', 'R')):
        for j, n in enumerate(('ALTERNATOR AMPS', 'CYLINDER HEAD TEMP', 'OIL TEMP', 'OIL PRESSURE', 'FUEL QUANTITY')): R.append((f'ENGINE {s}|{n}', 'main', rf'FuelOilAmps\.{k}:.*', {'rel': (0.1 + 0.2 * j, 0.5, 108, 84)}))
        I(f'ENGINE {s}|EGT', 'EGT.' + k); I(f'ENGINE {s}|RPM', 'RPM-' + s.title())
        N(f'ENGINE CONTROLS|THROTTLE {s}', rf'ThrottleControl\.{k}', 'quad', min=0, rel=(0.5, 0.74, 56, 170)); N(f'ENGINE CONTROLS|PROPELLER {s}', rf'PropellerControl\.{k}', 'quad', min=0, rel=(0.5, 0.74, 56, 170)); N(f'ENGINE CONTROLS|MIXTURE {s}', rf'MixtureControl\.{k}', 'quad', min=0, rel=(0.5, 0.74, 56, 170)); N(f'ENGINE CONTROLS|ALTERNATE AIR {s}', rf'AlternateAirControl\.{k}')
        N(f'COWL FLAPS|COWL FLAP {s}', rf'CowlFlapsControl\.{k}', 'cowl', pad=12); N(f'FUEL|FUEL SELECTOR {s}', rf'FuelSelectorControl\.{k}', 'floor', pad=8, min=0)
    I('ENGINE|MANIFOLD PRESSURE', 'ManifoldPressure'); I('ENGINE|FUEL FLOW', 'FuelFlow'); I('ENGINE|GYRO PRESSURE', 'Vacuum'); N('ENGINE CONTROLS|FRICTION LOCK', 'FrictionLock')
    N('GEAR|GEAR LEVER', 'GearLever.*', pad=10); I('GEAR|GEAR LIGHTS', 'GearIndicator'); N('GEAR|EMERGENCY GEAR EXTENSION', 'GearEmergency.*'); R.append(('GEAR|PARKING BRAKE', 'main', VP(sh, 'main', 1400, 1225, 150, 175)))
    A = 'AVIONICS|'
    for n, i in (('AUDIO PANEL', 'gma340'), ('COM / NAV 1', 'kx165tso1'), ('COM / NAV 2', 'kx165tso2'), ('ADF RECEIVER', 'kr87'), ('GPS', 'gps155 gps'), ('TRANSPONDER', 'gtx330 transponder'), ('DME', 'dme.*'), ('HSI SLAVING', 'ka51b')): I(A + n, i, whole=1)
    I('AUTOPILOT|ALTIMATIC IIIC', 'AltimaticIIIc', whole=1); I('AUTOPILOT|RADIO COUPLER', 'AutopilotMode'); I('AUTOPILOT|NAV 1 / NAV 2', 'NAVSourceSwitch')
    D = r'DeiceControl:DeiceControl\.'
    for n, p in (('WINDSHIELD HEAT', 'WindshieldSwitch'), ('PROP DE-ICE', 'PropSwitch'), ('SURFACE DE-ICE', 'SurfaceSwitch'), ('WING ICE LIGHT', r'WingLightSwitch.*|WinglightSwitch.*'), ('PROP DE-ICE AMMETER', 'Ampmeter.*')): R.append(('DE-ICE|' + n, 'main', '|'.join(D + q for q in p.split('|')), {'min': 50}))
    N('LIGHTS|PANEL LIGHTS DIMMER', 'PanelLightsDimmer', pad=14); N('LIGHTS|RADIO LIGHTS DIMMER', 'RadioLightsDimmer', pad=14); R.append(('CIRCUIT BREAKERS', 'main', r'CBPanel:.*', {'whole': 1}))
    S = 'SwitchPanel:'
    for n, p in (('BATTERY MASTER', 'Master'), ('ALTERNATOR LEFT', r'Alternator\.L'), ('ALTERNATOR RIGHT', r'Alternator\.R'), ('SWITCH LIGHTS DIMMER', 'Dimmer'), ('LANDING LIGHT 1', 'LandingLight'), ('LANDING LIGHT 2', 'TaxiLight'), ('NAV LIGHTS', 'NavLight'), ('ANTI-COLLISION FIN', r'AntiCollLight\.Fin'), ('ANTI-COLLISION WING', r'AntiCollLight\.Wing'), ('PITOT HEAT', 'PitotHeat'),
                 ('FUEL BOOST PUMP LEFT', r'FuelPump\.L'), ('FUEL BOOST PUMP RIGHT', r'FuelPump\.R'), ('MAGNETO LEFT ENGINE L', r'Magneto\.L\.L'), ('MAGNETO LEFT ENGINE R', r'Magneto\.L\.R'), ('MAGNETO RIGHT ENGINE L', r'Magneto\.R\.L'), ('MAGNETO RIGHT ENGINE R', r'Magneto\.R\.R'),
                 ('STARTER LEFT', r'Starter\.L'), ('STARTER RIGHT', r'Starter\.R'), ('PRIMER LEFT', r'Primer\.L'), ('PRIMER RIGHT', r'Primer\.R')): R.append(('SWITCH PANEL|' + n, 'side', S + p, {'min': 44}))
    N('FLOOR|FLAP LEVER', 'FlapControl', 'floor'); N('FLOOR|ELEVATOR TRIM', 'ElevatorTrimControl', 'floor', pad=30); N('FLOOR|RUDDER TRIM', 'RudderTrimControl', 'floor')
    return R
