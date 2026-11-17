"""Diamond DA40 NG (G1000): views and named controls. Model: FlightGear DA40 NG (GPL-2.0); G1000 bezels from FlightGear's shared instruments (FGData, GPL-2.0)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, re
NAME = 'da40'; CONST = 'DA40_T'; ID = 'da40'; JSVAR = 'DA40'; TITLE = 'Diamond DA40 NG'; CREW = 1
CREDIT_LONG = 'Model: FlightGear Diamond DA40 NG (github.com/sryu1/DA40, GPL-2.0).'
IMG = {'v': 'DA40 NG with Garmin G1000', 'by': 'FlightGear DA40 NG', 'lic': 'GPL-2.0', 'src': 'https://github.com/sryu1/DA40', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'main': ((-2.19, 0.38, 0), (-1, 0, 0), (0, 1, 0), 1.1, 0.46, 2800, 2, 1), 'ped': ((-1.88, 0.15, 0), (0, -1, 0), (-1, 0, 0), 0.2, 0.6, 2800, 1, 1)}
CROP = {'main': (60, 60, 3020, 1150), 'ped': (120, 0, 440, 1440)}
S_ = '/home/claude/rend/scr/'
def VP(sh, view, x, y, w, h):
    p = sh.pos[view]; c = sh.crop.get(view, (0, 0)); return [p[0] + x - c[0], p[1] + y - c[1], w, h]
PFD = r'panel-g1000/GDU-1040\.1:'; MFD = r'panel-g1000/GDU-1044\.2:'
def paint(sh):
    d = ImageDraw.Draw(sh.S)
    for pat, f in ((PFD + r'Screen.*', 'g_pfd'), (MFD + r'Screen.*', 'g_mfd')):
        x, y, w, h = (round(v) for v in sh.box('main', pat)); d.rectangle([x, y, x + w, y + h], fill=(4, 6, 8, 255)); im = Image.open(S_ + f + '.png').convert('RGBA'); k = min(w / im.width, h / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS); sh.S.paste(im, (x + (w - im.width) // 2, y + (h - im.height) // 2))
def CTL(sh):
    R = []
    def N(n, pat, **o): R.append((n, 'main', r'panel-g1000:' + pat, dict({'min': 44}, **o)))
    def I(n, inst, **o): R.append((n, 'main', r'panel-g1000/' + inst + r':.*', o))
    N('LIGHTS|INSTRUMENT', r'g1000_knob\.dim\.instrument'); N('LIGHTS|FLOOD', r'g1000_knob\.dim\.flood'); N('LIGHTS|LANDING', r'g1000_sw\.landing'); N('LIGHTS|TAXI', r'g1000_sw\.taxi'); N('LIGHTS|POSITION', r'g1000_sw\.position'); N('LIGHTS|STROBE', r'g1000_sw\.strobe')
    I('STANDBY INSTRUMENTS|AIRSPEED INDICATOR', 'asi'); I('STANDBY INSTRUMENTS|ATTITUDE INDICATOR', 'ai'); I('STANDBY INSTRUMENTS|ALTIMETER', 'alt'); I('STANDBY INSTRUMENTS|COMPASS', 'compass'); N('PANEL|ELT', r'g1000_sw\.elt', pad=14)
    N('ENGINE|ENGINE MASTER', r'g1000_sw\.engine_master.*'); N('ENGINE|ECU TEST', r'g1000_sw\.ecu_test'); N('ENGINE|VOTER (ECU A / AUTO / ECU B)', r'g1000_sw\.ecu_voter'); N('ENGINE|FUEL PUMPS', r'g1000_sw\.fuel_pumps')
    N('ELECTRICAL|ESS BUS', r'g1000_sw\.ess_bus'); N('ELECTRICAL|AVIONIC MASTER', r'g1000_sw\.avionic_master'); N('ELECTRICAL|ELECTRIC MASTER (KEY)', r'(master\.(outer|inner)|key)\.g.*'); N('ELECTRICAL|FUEL TRANSFER', r'g1000_sw\.fuel_trans'); N('ELECTRICAL|PITOT HEAT', r'g1000_sw\.pitot')
    N('PANEL|FLAPS', r'g1000_sw\.flaps', pad=8); N('PANEL|ACCESSORY POWER SOCKET', r'socket\.accessory_power'); R.append(('CIRCUIT BREAKERS', 'main', VP(sh, 'main', 2335, 432, 510, 520), {'whole': 1}))
    R.append(('PFD', 'main', PFD + r'(Panel|Cover|Screen.*)', {'whole': 1})); R.append(('MFD', 'main', MFD + r'(Panel|Cover|Screen.*)', {'whole': 1})); R.append(('AUDIO PANEL', 'main', r'panel-g1000/GMA1347:.*', {'whole': 1}))
    for sfx, k in (('PFD', PFD), ('MFD', MFD)):
        for n, p_ in (('NAV VOL', 'VolNAV'), ('NAV', r'Nav(Outer|Inner)'), ('HDG', 'HDG'), ('ALT', r'Alt(Outer|Inner)'), ('COM VOL', 'VolCom'), ('COM', r'Com(Outer|Inner)'), ('CRS / BARO', r'(CRS|BARO)'), ('RANGE', r'PAN.*'), ('DIRECT-TO', 'DidectTo'), ('MENU', 'MENU'), ('FPL', 'FPL'), ('PROC', 'PROC'), ('CLR', 'CLR'), ('ENT', 'ENT'), ('FMS', r'Fms(Outer|Inner)')):
            R.append((f'{sfx}|{n} ({sfx})', 'main', k + p_, {'min': 40}))
    for n, p_ in (('AP', 'L0'), ('FD', 'R0'), ('HDG', 'L1'), ('ALT', 'R1'), ('NAV', 'L2'), ('VNV', 'R2'), ('APR', 'L3'), ('BC', 'R3'), ('VS', 'L4'), ('NOSE UP', 'R4'), ('FLC', 'L5'), ('NOSE DN', 'R5')): R.append(('AUTOPILOT|' + n + ' KEY', 'main', MFD + r'AP\.' + p_, {'min': 40}))
    def D(n, pat, **o): R.append((n, 'ped', ':' + pat, dict({'min': 50}, **o)))
    D('CENTRE CONSOLE|PARKING BRAKE', 'parking_brake_lever'); D('CENTRE CONSOLE|DEFROST / FLOOR', 'heat_defrost_lever'); D('CENTRE CONSOLE|CABIN HEAT', 'heat_lever'); D('CENTRE CONSOLE|POWER LEVER', 'throttle_lever'); D('CENTRE CONSOLE|FUEL VALVE', 'fuel_valve_lever'); D('CENTRE CONSOLE|ELEVATOR TRIM', 'elevator_trim')
    R.append(('CENTRE CONSOLE|ALTERNATE AIR', 'ped', VP(sh, 'ped', 240, 0, 70, 66)))
    return R
