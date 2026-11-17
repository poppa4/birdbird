"""Boeing 787-8: views and named controls. Model: FlightGear 787 family (GPL-2.0)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, re
NAME = 'b788'; CONST = 'B788_T'; ID = 'b788'; JSVAR = 'B788'; TITLE = 'Boeing 787-8'; CREW = 2
CREDIT_LONG = 'Model: FlightGear Boeing 787 family (github.com/IskenderWang/787-family, GPL-2.0).'
IMG = {'v': '787-8/-9/-10 flight deck', 'by': 'FlightGear 787 family', 'lic': 'GPL-2.0', 'src': 'https://github.com/IskenderWang/787-family', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'ovh': ((-23.141, 2.566, 0), (-0.349, 0.937, 0), (0.937, 0.349, 0), 0.86, 1.0, 2800, 1, 2), 'main': ((-23.7, 1.68, 0), (-1, 0, 0), (0, 1, 0), 2.0, 0.76, 2800, 3, 1), 'ped': ((-23.15, 1.6, 0), (0, -1, 0), (-1, 0, 0), 0.62, 1.3, 2800, 1, 2)}
CROP = {'main': (0, 0, 5601, 1560), 'ped': (0, 230, 1736, 3440)}
S_ = '/home/claude/rend/scr/'
def VP(sh, view, x, y, w, h):                                           # a rectangle measured in the view's own pixels
    p = sh.pos[view]; c = sh.crop.get(view, (0, 0)); return [p[0] + x - c[0], p[1] + y - c[1], w, h]
def near(sh, view, x, y, inst, maxsize=260, tol=60):                    # the model part nearest to a point of the view
    X, Y = VP(sh, view, x, y, 0, 0)[:2]; best = None
    for o in sh.O:
        if not o['key'].startswith(inst + ':'): continue
        if abs(((o['v'] - sh.V[view]['c']) @ sh.V[view]['n']).mean()) > 0.35: continue
        q = sh.proj(view, o['v']); mn, mx = q.min(0), q.max(0)
        if (mx - mn).max() > maxsize: continue
        d = np.hypot(*((mn + mx) / 2 - (X, Y)))
        if best is None or d < best[0]: best = (d, mn, mx)
    assert best and best[0] < tol, (view, x, y, best and best[0])
    return [float(best[1][0]), float(best[1][1]), float(best[2][0] - best[1][0]), float(best[2][1] - best[1][1])]
def paint(sh):
    d = ImageDraw.Draw(sh.S)
    def scr(view, x, y, w, h, files):
        x, y, w, h = (round(v) for v in VP(sh, view, x, y, w, h)); d.rectangle([x, y, x + w, y + h], fill=(4, 6, 8, 255)); n = len(files); ww = (w - 8) // n
        for i, f in enumerate(files):
            im = Image.open(S_ + f + '.png').convert('RGBA'); k = min(ww / im.width, (h - 8) / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS); sh.S.paste(im, (x + 4 + i * ww + (ww - im.width) // 2, y + (h - im.height) // 2))
    for x, f in ((DISP[0], ['b_pfd', 'b_nd']), (DISP[1], ['b_nd', 'b_eicas']), (DISP[2], ['b_lower', 'b_nd']), (DISP[3], ['b_nd', 'b_pfd'])): scr('main', x[0], DY[0], x[1] - x[0], DY[1] - DY[0], f)
    scr('ped', *LOWER, ['b_nd', 'b_lower'])
DISP = [(540, 1500), (1625, 2590), (3015, 3985), (4105, 5065)]; DY = (625, 1425); LOWER = (392, 278, 962, 698)
K = 1.605; KP = 1.3354; KM = 1.4286
def CTL(sh):
    R = []
    def O(n, pat, **o): R.append((n, 'ovh', r'OHpanel:' + pat + r'(\.\d+)?', dict({'min': 44}, **o)))
    def ON(n, x, y, **o): R.append((n, 'ovh', near(sh, 'ovh', x * K, y * K, 'OHpanel'), dict({'min': 44}, **o)))          # a-picture coordinates
    def OB(n, x, y, **o): R.append((n, 'ovh', near(sh, 'ovh', x * K, y * K + 1400, 'OHpanel'), dict({'min': 44}, **o)))   # b-picture coordinates
    def OP(n, x, y, w, h, b=0): R.append((n, 'ovh', VP(sh, 'ovh', (x - w / 2) * K, (y - h / 2) * K + b * 1400, w * K, h * K)))
    O('FLIGHT CONTROL SURFACES|TAIL LOCK', 'FCS_Tail'); O('FLIGHT CONTROL SURFACES|WINGS LOCK', 'FCS_Wings'); O('BATTERY|TOWING POWER', 'Towing_Power'); OP('BATTERY|BATTERY TEST', 438, 250, 34, 34)
    O('OVERHEAD|FD DOOR POWER', 'FD_Door_Power'); O('OVERHEAD|CCR RESET L', 'CCR_Reset_L'); O('OVERHEAD|CCR RESET R', 'CCR_Reset_R'); O('OVERHEAD|PASS OXYGEN', 'Pass_Oxygen'); OP('OVERHEAD|EMER LIGHTS', 481, 495, 44, 100); OP('OVERHEAD|SERV INTERPH', 565, 497, 46, 46)
    O('IRS|HEADING REF', 'Heading_REF'); ON('IRS|IRS LEFT', 195, 632); ON('IRS|IRS RIGHT', 316, 632); OP('PRIMARY FLIGHT COMPUTERS|PRIMARY FLIGHT COMPUTERS DISC', 193, 757, 44, 100)
    for n, p in (('BACKUP L FWD', 'Backup_L_FWD'), ('BACKUP R FWD', 'Backup_R_FWD'), ('PRIMARY L SIDE', 'Primary_L_Side'), ('PRIMARY L FWD', 'Primary_L_FWD'), ('PRIMARY R FWD', 'Primary_R_FWD'), ('PRIMARY R SIDE', 'Primary_R_Side')): O('WINDOW HEAT|' + n, p)
    ON('GND TEST|DATA LOAD / GND TEST', 845, 270); OP('CVR|CVR TEST', 983, 250, 34, 34); OP('CVR|CVR ERASE', 1047, 250, 34, 34)
    O('FIRE|APU BTL DISCH', 'APU_BLT_DISCH'); OP('FIRE|APU FIRE HANDLE', 835, 520, 50, 110); O('CARGO FIRE|ARM FWD', 'Cargofire_ARM_FWD'); O('CARGO FIRE|ARM AFT', 'Cargofire_ARM_AFT'); ON('CARGO FIRE|DISCH', 1028, 545); OP('CARGO FIRE|FIRE / OVHT TEST', 942, 541, 34, 34)
    O('ENGINE|EEC MODE L', 'Engine_EEC_Mode_L'); O('ENGINE|EEC MODE R', 'Engine_EEC_Mode_R'); ON('ENGINE|START L', 831, 785); ON('ENGINE|START R', 1024, 785)
    OP('OVERHEAD|ELT', 1304, 405, 44, 100); O('CARGO TEMP|HUMID', 'HUMID'); ON('CARGO TEMP|FWD CARGO FLOW', 1183, 568); ON('CARGO TEMP|FWD CARGO A/C', 1303, 568); O('CARGO TEMP|BULK', 'BULK')
    O('AIR CONDITIONING|EQUIP COOLING FWD', 'Equip_Cooling_FWD'); O('AIR CONDITIONING|EQUIP COOLING AFT', 'Equip_Cooling_AFT'); O('AIR CONDITIONING|RECIRC FANS UPPER', 'Recirc_Fans_Upper'); O('AIR CONDITIONING|RECIRC FANS LOWER', 'Recirc_Fans_Lower')
    ON('AIR CONDITIONING|FLT DECK TEMP', 1205, 855); ON('AIR CONDITIONING|CABIN TEMP', 1382, 855); OB('AIR CONDITIONING|AIR COND RESET', 1293, 20); O('AIR CONDITIONING|L PACK', 'L_PACK'); O('AIR CONDITIONING|R PACK', 'R_PACK'); O('AIR CONDITIONING|TRIM AIR L', 'Trim_Air_L'); O('AIR CONDITIONING|TRIM AIR R', 'Trim_Air_R'); O('AIR CONDITIONING|VENTILATION', 'Ventilation')
    O('ELECTRICAL|BATTERY', 'Battery'); O('ELECTRICAL|IFE / PASS SEATS', 'IFE_Pass_Seats'); O('ELECTRICAL|CABIN / UTILITY', 'Cabin_Utility'); OB('ELECTRICAL|APU', 297, 48); O('ELECTRICAL|APU GEN L', 'APU_GEN_L'); O('ELECTRICAL|APU GEN R', 'APU_GEN_R')
    O('ELECTRICAL|FWD EXT PWR L', 'FWD_EXT_PWR_L'); O('ELECTRICAL|FWD EXT PWR R', 'FWD_EXT_PWR_R'); O('ELECTRICAL|AFT EXT PWR', 'AFT_EXT_PWR')
    for a in ('L1', 'L2', 'R1', 'R2'): O(f'ELECTRICAL|GEN CTRL {a}', f'GEN_CTRL_{a}'); O(f'ELECTRICAL|DRIVE DISC {a}', f'Drive_DISC_{a}')
    O('HYDRAULIC|L ENG PRIMARY', 'L_ENG'); O('HYDRAULIC|R ENG PRIMARY', 'R_ENG'); O('HYDRAULIC|C1 ELEC', r'hyd\.c1\.knob'); O('HYDRAULIC|C2 ELEC', r'hyd\.c2\.knob'); O('HYDRAULIC|L ELEC DEMAND', r'l\.elec\.knob'); O('HYDRAULIC|R ELEC DEMAND', r'r\.elec\.knob'); O('HYDRAULIC|RAM AIR TURBINE', 'RAM_Air_Turbine')
    O('FUEL JETTISON|NOZZLE L', 'Nozzle_L'); O('FUEL JETTISON|NOZZLE R', 'Nozzle_R'); O('FUEL JETTISON|FUEL TO REMAIN', r'jettison\.knob'); OB('FUEL JETTISON|ARM', 1047, 48)
    for n, p in (('L PUMPS FWD', 'L_Pumps_FWD'), ('L PUMPS AFT', 'L_Pumps_AFT'), ('R PUMPS FWD', 'R_Pumps_FWD'), ('R PUMPS AFT', 'R_Pumps_AFT'), ('CROSSFEED', 'Crossfeed'), ('CENTER PUMPS L', 'Center_Pumps_L'), ('CENTER PUMPS R', 'Center_Pumps_R'), ('BALANCE', 'Balance')): O('FUEL|' + n, p)
    O('PRESSURIZATION|OUTFLOW VALVE FWD', 'Outflow_FWD_Valve'); O('PRESSURIZATION|OUTFLOW VALVE AFT', 'Outflow_AFT_Valve'); OB('PRESSURIZATION|LDG ALT', 1396, 375); OP('PRESSURIZATION|OUTFLOW MANUAL FWD', 1189, 430, 34, 40, 1); OP('PRESSURIZATION|OUTFLOW MANUAL AFT', 1297, 430, 34, 40, 1)
    O('WIPERS|L WIPER', r'l\.wiper'); O('WIPERS|R WIPER', r'r\.wiper'); OB('WIPERS|L WASHER', 266, 622); OB('WIPERS|R WASHER', 1192, 632)
    O('PASS SIGNS|CABIN CHIME', 'comm'); O('PASS SIGNS|SEAT SIGNS', 'SeatbeltSwtch')
    O('LIGHTING|OVHD PANEL', r'ovhd\.knob'); O('LIGHTING|DOME', r'dome\.knob'); O('LIGHTING|STORM', 'Storm'); OB('LIGHTING|MASTER BRIGHT', 670, 620); OB('LIGHTING|LOWER DISPL CONTRAST', 265, 728); OB('LIGHTING|GLARESHIELD PNL / FLOOD', 431, 728)
    O('EXTERIOR LIGHTS|LANDING LEFT', 'land1'); O('EXTERIOR LIGHTS|LANDING NOSE', 'landn'); O('EXTERIOR LIGHTS|LANDING RIGHT', 'land2'); O('EXTERIOR LIGHTS|BEACON', 'Beacon'); O('EXTERIOR LIGHTS|NAV', 'NAV'); O('EXTERIOR LIGHTS|LOGO', 'Logo'); O('EXTERIOR LIGHTS|WING', 'Wing')
    O('EXTERIOR LIGHTS|TAXI', 'taxi'); O('EXTERIOR LIGHTS|STROBE', 'strobe'); O('EXTERIOR LIGHTS|IND LTS TEST', 'IND_LTS_Test'); OP('EXTERIOR LIGHTS|RUNWAY TURNOFF L', 823, 757, 34, 34, 1); OP('EXTERIOR LIGHTS|RUNWAY TURNOFF R', 878, 757, 34, 34, 1)
    O('ANTI-ICE|WING', r'wing\.anti-ice'); O('ANTI-ICE|ENGINE L', r'eng1\.anti-ice'); O('ANTI-ICE|ENGINE R', r'eng2\.anti-ice')
    # glareshield: mode control panel and the two EFIS control panels
    def M(n, pat, **o): R.append((n, 'main', ':' + pat, dict({'min': 46}, **o)))
    def MP(n, x, y, w, h): R.append((n, 'main', VP(sh, 'main', x - w / 2, y - h / 2, w, h)))
    for n, p in (('IAS / MACH', 'IAS-MACH'), ('SPEED SEL', r'SPD\.knob'), ('CLB / CON', r'clb\.con'), ('A/T', r'AT\.toggle'), ('LNAV', r'LNAV\.toggle'), ('VNAV', r'VNAV\.toggle'), ('FLCH', r'FLCH\.toggle'), ('A/P DISENGAGE BAR', 'APdisengage'), ('HDG / TRK', 'HDG-TRK'), ('HDG SEL', r'HDG\.knob'),
                 ('HDG HOLD', r'HDG\.toggle'), ('V/S / FPA', 'VS-FPA'), ('V/S WHEEL', r'VS\.knob'), ('V/S', r'VS\.toggle'), ('ALT SEL', r'ALT\.knob'), ('ALT HOLD', r'ALT\.toggle'), ('LOC/FAC', r'LOC\.toggle'), ('APP', r'APP\.toggle')): M('MCP|' + n, p)
    MP('MCP|A/P ENGAGE L', 2198, 220, 60, 46); MP('MCP|A/P ENGAGE R', 3402, 220, 60, 46); MP('MCP|F/D L', 2205, 370, 50, 60); MP('MCP|F/D R', 3395, 365, 50, 60); MP('MCP|A/T ARM L', 2272, 215, 44, 90); MP('MCP|A/T ARM R', 2312, 215, 44, 90)
    for sfx, a, b, c, d2, e, f, g in (('CPT', r'Baro\.knob\.001', r'Baro\.knob', 'FPV', 'MTRS', 'navrange', '', 0), ('F/O', r'Baro\.knob\.006', r'Baro\.knob\.007', 'FPV1', 'MTRS1', 'navrange1', r'\.001', 1)):
        M(f'EFIS {sfx}|MINS {sfx}', a); M(f'EFIS {sfx}|BARO {sfx}', b); M(f'EFIS {sfx}|FPV {sfx}', c); M(f'EFIS {sfx}|MTRS {sfx}', d2); M(f'EFIS {sfx}|ND RANGE {sfx}', e); M(f'EFIS {sfx}|WXR {sfx}', r'WXR\.btn' + f); M(f'EFIS {sfx}|TFC {sfx}', r'TFC\.btn' + f); M(f'EFIS {sfx}|TERR {sfx}', r'TERR\.btn' + f)
        MP(f'EFIS {sfx}|ND MODE {sfx}', (3745 if g else 1742), 302, 60, 76); MP(f'DISPLAY SELECT {sfx}|MFD L / R {sfx}', (3560 if g else 2048), 197, 124, 62)
        for i, nm in enumerate(('SYS', 'CDU', 'INFO', 'CHKL', 'COMM', 'ND')): MP(f'DISPLAY SELECT {sfx}|{nm} {sfx}', (3505 if g else 1993) + (i % 3) * 56, 252 + (i // 3) * 40, 52, 36)
        MP(f'DISPLAY SELECT {sfx}|ENG {sfx}', (3512 if g else 1995), 393, 56, 40); MP(f'DISPLAY SELECT {sfx}|CANC / RCL {sfx}', (3610 if g else 2097), 398, 50, 50); MP(f'DISPLAY SELECT {sfx}|EICAS TRANSFER {sfx}', (3562 if g else 2046), 343, 50, 46)
        for i, nm in enumerate(('ACPT', 'CANC', 'RJCT')): MP(f'DATA LINK {sfx}|{nm} {sfx}', (4032 if g else 1432) + i * 69, 357, 64, 64)
    for (x0, x1), nm in zip(DISP, ('OUTBOARD DISPLAY CPT', 'INBOARD DISPLAY CPT', 'INBOARD DISPLAY F/O', 'OUTBOARD DISPLAY F/O')): R.append((nm, 'main', VP(sh, 'main', x0, DY[0], x1 - x0, DY[1] - DY[0]), {'whole': 1}))
    M('CENTER PANEL|ISFD', 'stby-ai', pad=10); M('CENTER PANEL|LANDING GEAR LEVER', 'gearlever'); M('CENTER PANEL|AUTOBRAKE', 'autobrake', pad=8); MP('CENTER PANEL|LOCK OVRD', 2819, 1021, 56, 56); MP('CENTER PANEL|ALTN GEAR', 2900, 1175, 60, 130)
    # control stand and aisle stand
    def D(n, pat, **o): R.append((n, 'ped', ':' + pat, dict({'min': 50}, **o)))
    def DP(n, x, y, w, h, b=0, **o): R.append((n, 'ped', VP(sh, 'ped', (x - w / 2) * KP, (y - h / 2) * KP + b * 1820, w * KP, h * KP), o))
    R.append(('LOWER DISPLAY', 'ped', VP(sh, 'ped', *LOWER), {'whole': 1}))
    for sfx, x in (('CPT', 150), ('F/O', 1165)): DP(f'LOWER MFD SELECT {sfx}', x, 262, 160, 70, whole=1); DP(f'CURSOR CONTROL AND KEYPAD {sfx}', x, 540, 185, 410, whole=1)
    D('CONTROL STAND|SPEED BRAKE', r'spdbrk\.lever'); D('CONTROL STAND|FLAP', r'flaps\.lever'); D('CONTROL STAND|THRUST LEVER L', r'throttle\.l'); D('CONTROL STAND|THRUST LEVER R', r'throttle\.r'); D('CONTROL STAND|FUEL CONTROL L', 'Lcutoff'); D('CONTROL STAND|FUEL CONTROL R', 'Rcutoff')
    DP('CONTROL STAND|PARKING BRAKE', 272, 1385, 100, 110); DP('CONTROL STAND|STAB CUTOUT', 427, 45, 95, 85, 1); DP('CONTROL STAND|ALTN FLAPS ARM', 1113, 1318, 80, 70); DP('CONTROL STAND|ALTN FLAPS SELECTOR', 1109, 45, 60, 60, 1)
    DP('TUNING AND CONTROL PANEL L', 322, 300, 320, 330, 1, whole=1); DP('TUNING AND CONTROL PANEL R', 993, 300, 320, 330, 1, whole=1); DP('TUNING AND CONTROL PANEL C', 658, 635, 320, 335, 1, whole=1)
    DP('AUDIO CONTROL PANEL CPT', 322, 580, 320, 222, 1, whole=1); DP('AUDIO CONTROL PANEL OBS', 322, 806, 320, 222, 1, whole=1); DP('AUDIO CONTROL PANEL F/O', 993, 580, 320, 222, 1, whole=1)
    DP('AISLE STAND|ENG FIRE HANDLE L', 600, 257, 50, 140, 1); DP('AISLE STAND|ENG FIRE HANDLE R', 738, 257, 50, 140, 1); DP('AISLE STAND|GS INHIBIT', 567, 420, 62, 62, 1); DP('AISLE STAND|TRANSPONDER MODE', 654, 440, 44, 44, 1); DP('AISLE STAND|AURAL CANCEL', 747, 420, 62, 62, 1)
    DP('AISLE STAND|EICAS EVENT RCD', 917, 768, 66, 66, 1); DP('AISLE STAND|FLOOR LIGHTS', 1075, 767, 56, 56, 1); DP('AISLE STAND|EVAC COMMAND', 920, 920, 66, 110, 1); DP('AISLE STAND|OBS AUDIO', 1080, 945, 60, 60, 1); DP('AISLE STAND|RUDDER TRIM', 726, 922, 116, 116, 1)
    DP('AISLE STAND|FD DOOR ACCESS', 267, 1066, 60, 60, 1); DP('AISLE STAND|AISLE STAND PNL / FLOOD', 1056, 1062, 50, 50, 1)
    return R
