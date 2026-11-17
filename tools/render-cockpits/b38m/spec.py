"""Boeing 737 MAX 8: views and named controls. Model: FlightGear 737 MAX (GPL-2.0)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, re
NAME = 'b38m'; CONST = 'B38M_T'; ID = 'b38m'; JSVAR = 'B38M'; TITLE = 'Boeing 737 MAX 8'; CREW = 2
CREDIT_LONG = 'Model: FlightGear Boeing 737 MAX (github.com/REXO-77/737-MAX, GPL-2.0).'
IMG = {'v': '737 MAX 7/8/9/10 flight deck', 'by': 'FlightGear 737 MAX', 'lic': 'GPL-2.0', 'src': 'https://github.com/REXO-77/737-MAX', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'ovh': ((0.015, 0.7, 0), (-0.410, 0.912, 0), (0.912, 0.410, 0), 0.74, 1.12, 2800, 1, 2), 'main': ((-0.7, -0.08, 0), (-1, 0, 0), (0, 1, 0), 1.56, 0.68, 2800, 3, 1), 'ped': ((-0.2, -0.35, 0), (0, -1, 0), (-1, 0, 0), 0.6, 1.15, 2800, 1, 2)}
CROP = {'main': (0, 0, 4368, 1720), 'ped': (0, 735, 1680, 3160)}
S_ = '/home/claude/rend/scr/'
def VP(sh, view, x, y, w, h):
    p = sh.pos[view]; c = sh.crop.get(view, (0, 0)); return [p[0] + x - c[0], p[1] + y - c[1], w, h]
def near(sh, view, x, y, inst, maxsize=260, tol=60):
    X, Y = VP(sh, view, x, y, 0, 0)[:2]; best = None
    for o in sh.O:
        if not o['key'].startswith(inst + ':'): continue
        if abs(((o['v'] - sh.V[view]['c']) @ sh.V[view]['n']).mean()) > 0.4: continue
        q = sh.proj(view, o['v']); mn, mx = q.min(0), q.max(0)
        if (mx - mn).max() > maxsize: continue
        d = np.hypot(*((mn + mx) / 2 - (X, Y)))
        if best is None or d < best[0]: best = (d, mn, mx)
    assert best and best[0] < tol, (view, x, y, best and best[0])
    return [float(best[1][0]), float(best[1][1]), float(best[2][0] - best[1][0]), float(best[2][1] - best[1][1])]
def paint(sh):
    from PIL import ImageEnhance
    x, y, w, h = sh.pos['ovh']; reg = sh.S.crop((x, y, x + w, y + h)).convert('RGB'); reg = ImageEnhance.Brightness(reg).enhance(1.75); reg = ImageEnhance.Contrast(reg).enhance(1.08); sh.S.paste(reg, (x, y))   # the model's overhead texture is very dark
    d = ImageDraw.Draw(sh.S)
    def scr(pat, files):
        x, y, w, h = (round(v) for v in sh.box('main', pat)); d.rectangle([x, y, x + w, y + h], fill=(4, 6, 8, 255)); n = len(files); ww = (w - 8) // n
        for i, f in enumerate(files):
            im = Image.open(S_ + f + '.png').convert('RGBA'); k = min(ww / im.width, (h - 8) / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS); sh.S.paste(im, (x + 4 + i * ww + (ww - im.width) // 2, y + (h - im.height) // 2))
    scr(r':screen1\.full', ['b_pfd', 'b_nd']); scr(r':screen2\.full', ['b_eicas', 'b_lower']); scr(r':screen3\.full', ['b_lower', 'b_eicas']); scr(r':screen4\.full', ['b_nd', 'b_pfd']); scr(r':cdu\.screenL', ['b_cdu']); scr(r':cdu\.screenR', ['b_cdu'])
K = 2072 / 1500; T3 = 3136 / 3; KP = 1680 / 1300
def CTL(sh):
    R = []
    def O(n, pat, **o): R.append((n, 'ovh', r'OH-Panel:' + pat + r'(\.\d+)?', dict({'min': 44}, **o)))
    def ON(n, x, y, t, **o): R.append((n, 'ovh', near(sh, 'ovh', x * K, y * K + t * T3, 'OH-Panel'), dict({'min': 44}, **o)))
    def OP(n, x, y, t, w=36, h=36, **o): R.append((n, 'ovh', VP(sh, 'ovh', (x - w / 2) * K, (y - h / 2) * K + t * T3, w * K, h * K), o))
    # aft overhead
    OP('IRS|IRS DISPLAY SELECTOR', 420, 318, 0, 56, 56); OP('IRS|IRS SYS DSPL', 420, 395, 0, 46, 46); OP('IRS|IRS KEYPAD', 583, 345, 0, 124, 150, whole=1); O('IRS|IRS L', r'irs\.L'); O('IRS|IRS R', r'irs\.R')
    OP('AFT OVERHEAD|SERVICE INTERPHONE', 745, 470, 0, 44, 56); OP('AFT OVERHEAD|DOME WHITE', 745, 710, 0, 44, 56); OP('LE DEVICES', 187, 560, 0, 290, 150, whole=1); OP('AFT OVERHEAD|LE DEVICES TEST', 187, 617, 0, 30, 30)
    OP('ENGINE|EEC 1', 945, 445, 0, 56, 56); OP('ENGINE|EEC 2', 1018, 445, 0, 56, 56); OP('OXYGEN|CREW OXYGEN PRESSURE', 913, 565, 0, 118, 118); O('OXYGEN|PASS OXYGEN', r'oxygen\.passcover')
    OP('AFT OVERHEAD|ELT', 1382, 375, 0, 46, 110); OP('AFT OVERHEAD|FLIGHT RECORDER', 1245, 520, 0, 100, 50); OP('AFT OVERHEAD|MACH AIRSPEED WARNING TEST 1', 1362, 518, 0); OP('AFT OVERHEAD|MACH AIRSPEED WARNING TEST 2', 1415, 518, 0); OP('AFT OVERHEAD|STALL WARNING TEST 1', 1248, 620, 0); OP('AFT OVERHEAD|STALL WARNING TEST 2', 1360, 620, 0)
    # forward overhead, left to right
    OP('FLIGHT CONTROL|FLT CONTROL A', 98, 150, 1, 50, 150); OP('FLIGHT CONTROL|FLT CONTROL B', 160, 150, 1, 50, 150); OP('FLIGHT CONTROL|ALTERNATE FLAPS MASTER', 225, 225, 1, 44, 100); OP('FLIGHT CONTROL|ALTERNATE FLAPS UP / DOWN', 296, 230, 1, 34, 40)
    OP('FLIGHT CONTROL|SPOILER A', 100, 325, 1, 44, 110); OP('FLIGHT CONTROL|SPOILER B', 150, 325, 1, 44, 110); OP('FLIGHT CONTROL|YAW DAMPER', 125, 450, 1)
    OP('NAVIGATION|VHF NAV', 117, 545, 1, 40, 40); OP('NAVIGATION|IRS TRANSFER', 268, 545, 1, 40, 40); OP('NAVIGATION|FMC', 268, 648, 1, 40, 40); OP('DISPLAYS|SOURCE', 112, 757 - 745, 2, 50, 50); OP('DISPLAYS|CONTROL PANEL', 268, 752, 1, 40, 40)
    O('FUEL|CROSSFEED', r'fuel\.crossfeed'); O('FUEL|CTR L', r'fuel\.CL'); O('FUEL|CTR R', r'fuel\.CR'); O('FUEL|AFT 1', r'fuel\.AL'); O('FUEL|FWD 1', r'fuel\.FL'); O('FUEL|FWD 2', r'fuel\.FR'); O('FUEL|AFT 2', r'fuel\.AR')
    OP('ELECTRICAL|ELECTRICAL METERS', 518, 205, 1, 255, 120, whole=1); O('ELECTRICAL|DC METERS', r'elec\.auxbatt'); O('ELECTRICAL|AC METERS', r'elec\.apugenmode'); O('ELECTRICAL|BATTERY', r'elec\.battcover'); OP('ELECTRICAL|MAINT', 618, 318, 1, 32, 32)
    OP('ELECTRICAL|CAB / UTIL', 533, 490, 1); OP('ELECTRICAL|IFE / PASS SEAT', 613, 490, 1); OP('ELECTRICAL|STANDBY POWER', 513, 635, 1, 76, 50); O('ELECTRICAL|DRIVE DISCONNECT 1', r'elec\.gencoverN1'); O('ELECTRICAL|DRIVE DISCONNECT 2', r'elec\.gencoverN2')
    O('ELECTRICAL|GRD PWR', r'elec\.genground'); O('ELECTRICAL|BUS TRANSFER', r'elec\.transcover'); OP('ELECTRICAL|GEN 1', 408, 318, 2, 34, 50); OP('ELECTRICAL|APU GEN L', 468, 318, 2, 34, 50); OP('ELECTRICAL|APU GEN R', 560, 318, 2, 34, 50); OP('ELECTRICAL|GEN 2', 620, 318, 2, 34, 50)
    O('LIGHTING|CIRCUIT BREAKER', r'light\.breaker'); O('LIGHTING|PANEL', r'light\.panel'); OP('EQUIP COOLING|SUPPLY', 723, 635, 1); OP('EQUIP COOLING|EXHAUST', 785, 635, 1)
    O('PASS SIGNS|EMER EXIT LIGHTS', r'light\.exitcover'); O('PASS SIGNS|NO SMOKING', r'light\.nosmoking'); O('PASS SIGNS|FASTEN BELTS', r'light\.seatbelts'); OP('PASS SIGNS|ATTEND', 713, 295, 2); OP('PASS SIGNS|GRD CALL', 795, 295, 2)
    O('WIPERS|L WIPER', r'wiper\.L'); O('WIPERS|R WIPER', r'wiper\.R')
    O('WINDOW HEAT|L SIDE', r'heat\.windowL'); O('WINDOW HEAT|L FWD', r'heat\.windowCL'); O('WINDOW HEAT|R FWD', r'heat\.centerCR'); O('WINDOW HEAT|R SIDE', r'heat\.windowR'); OP('WINDOW HEAT|OVHT / PWR TEST', 985, 153, 1, 30, 40)
    O('ANTI-ICE|PROBE HEAT A', r'heat\.probeA'); O('ANTI-ICE|PROBE HEAT B', r'heat\.probeB'); O('ANTI-ICE|WING ANTI-ICE', r'heat\.wing'); O('ANTI-ICE|ENG ANTI-ICE 1', r'heat\.N1'); O('ANTI-ICE|ENG ANTI-ICE 2', r'heat\.N2')
    OP('HYD PUMPS|ENG 1', 882, 690, 1); OP('HYD PUMPS|ELEC 2', 943, 690, 1); OP('HYD PUMPS|ELEC 1', 1027, 690, 1); OP('HYD PUMPS|ENG 2', 1087, 690, 1)
    OP('VOICE RECORDER|VOICE RECORDER', 1305, 55, 1, 36, 64); OP('VOICE RECORDER|ERASE', 968, 165, 2, 30, 30); OP('VOICE RECORDER|TEST', 1015, 165, 2, 30, 30)
    OP('PRESSURIZATION|CABIN ALTITUDE', 942, 300, 2, 140, 150); OP('PRESSURIZATION|CABIN CLIMB', 943, 490, 2, 90, 90); OP('PRESSURIZATION|ALT HORN CUTOUT', 1085, 325, 2); OP('PRESSURIZATION|FLT ALT', 1250, 270, 2, 52, 52); OP('PRESSURIZATION|LAND ALT', 1250, 395, 2, 52, 52)
    OP('PRESSURIZATION|OUTFLOW VALVE', 1388, 308, 2); OP('PRESSURIZATION|MODE SELECTOR', 1370, 402, 2, 52, 52)
    OP('AIR CONDITIONING|AIR TEMP SOURCE', 1380, 190, 1, 52, 52); OP('AIR CONDITIONING|TRIM AIR', 1296, 270, 1); OP('AIR CONDITIONING|CONT CAB', 1212, 405, 1, 50, 50); OP('AIR CONDITIONING|FWD CAB', 1307, 405, 1, 50, 50); OP('AIR CONDITIONING|AFT CAB', 1400, 405, 1, 50, 50)
    OP('AIR CONDITIONING|L RECIRC FAN', 1215, 522, 1); OP('AIR CONDITIONING|R RECIRC FAN', 1397, 522, 1); OP('AIR CONDITIONING|L PACK', 1203, 678, 1, 40, 40); OP('AIR CONDITIONING|ISOLATION VALVE', 1307, 700, 1, 40, 40); OP('AIR CONDITIONING|R PACK', 1414, 678, 1, 40, 40); OP('AIR CONDITIONING|OVHT TEST', 1410, 628, 1, 30, 30)
    OP('AIR CONDITIONING|BLEED 1', 1243, 78, 2, 36, 44); OP('AIR CONDITIONING|BLEED 2', 1415, 78, 2, 36, 44)
    O('EXTERIOR LIGHTS|LANDING L', r'light\.landingL'); O('EXTERIOR LIGHTS|LANDING R', r'light\.landingR'); O('EXTERIOR LIGHTS|RUNWAY TURNOFF L', r'light\.rturnoffL'); O('EXTERIOR LIGHTS|RUNWAY TURNOFF R', r'light\.rturnoffR'); O('EXTERIOR LIGHTS|TAXI', r'light\.taxi')
    O('EXTERIOR LIGHTS|LOGO', r'light\.logo'); O('EXTERIOR LIGHTS|POSITION', r'light\.strobe'); O('EXTERIOR LIGHTS|ANTI COLLISION', r'light\.collision'); O('EXTERIOR LIGHTS|WING', r'light\.wing'); O('EXTERIOR LIGHTS|WHEEL WELL', r'light\.wheel')
    O('ENGINE START|APU', r'apu\.start'); O('ENGINE START|ENGINE START 1', r'n1\.start'); O('ENGINE START|ENGINE START 2', r'n2\.start'); O('ENGINE START|IGNITION', 'ignition')
    # glareshield
    def M(n, pat, **o): R.append((n, 'main', ':' + pat, dict({'min': 46}, **o)))
    for n, p in (('COURSE 1', r'ap\.crs1'), ('A/T ARM', r'ap\.at'), ('F/D CPT', r'ap\.fd1'), ('N1', r'ap\.n1'), ('SPEED', r'ap\.speed'), ('C/O', r'ap\.co'), ('IAS / MACH SEL', r'ap\.speed-knob'), ('SPD INTV', r'ap\.spd-intv'), ('VNAV', r'ap\.vnav'), ('LVL CHG', r'ap\.lvlchg'), ('HEADING SEL', r'ap\.hdg-knob'), ('HDG SEL', r'ap\.hdgsel'),
                 ('LNAV', r'ap\.lnav'), ('VOR LOC', r'ap\.vorloc'), ('APP', r'ap\.app'), ('ALTITUDE SEL', r'ap\.alt-knob'), ('ALT INTV', r'ap\.alt-intv'), ('ALT HLD', r'ap\.althld'), ('V/S', r'ap\.vs'), ('VERT SPEED WHEEL', r'ap\.vs-knob'), ('CMD A', r'ap\.cmda'), ('CMD B', r'ap\.cmdb'), ('CWS A', r'ap\.cwsa'), ('CWS B', r'ap\.cwsb'),
                 ('A/P DISENGAGE BAR', r'ap\.disc'), ('COURSE 2', r'ap\.crs2'), ('F/D F/O', r'ap\.fd2')): M('MCP|' + n, p)
    for sfx, s in (('CPT', 'L'), ('F/O', 'R')):
        for n, p in (('BARO', rf'ap\.barometer{s}'), ('FPV', rf'ap\.fpv{s}'), ('MTRS', rf'ap\.mtrs{s}'), ('VOR 1 / ADF 1', rf'ap\.voradf1{s}'), ('VOR 2 / ADF 2', rf'ap\.voradf2{s}'), ('ND MODE', rf'ap\.navmode{s}'), ('ND RANGE', rf'ap\.navrange{s}'), ('WXR', rf'ap\.nav-wxr{s}'), ('STA', rf'ap\.nav-sta{s}'), ('WPT', rf'ap\.nav-wpt{s}'),
                     ('ARPT', rf'ap\.nav-arpt{s}'), ('DATA', rf'ap\.nav-data{s}'), ('POS', rf'ap\.nav-pos{s}'), ('TERR', rf'ap\.nav-terr{s}')): M(f'EFIS {sfx}|{n} {sfx}', p)
    R.append(('EFIS CPT|MINS CPT', 'main', near(sh, 'main', 400 + 585 * 1.115, 60 + 178 * 1.115, ''), {'min': 46})); R.append(('EFIS F/O|MINS F/O', 'main', near(sh, 'main', 2184 + 810 * 1.115, 60 + 178 * 1.115, ''), {'min': 46}))
    M('GLARESHIELD|FIRE WARN CPT', r'ap\.warnL'); M('GLARESHIELD|MASTER CAUTION CPT', r'ap\.cautionL'); M('GLARESHIELD|MASTER CAUTION F/O', 'cautionR'); M('GLARESHIELD|FIRE WARN F/O', 'warnR')
    R.append(('GLARESHIELD|SYSTEM ANNUNCIATOR CPT', 'main', r':ap\.annunciator\.(L|irs|fuel|flt-cont|elec|apu|ovht-det)(\.\d+)?', {})); R.append(('GLARESHIELD|SYSTEM ANNUNCIATOR F/O', 'main', r':ap\.annunciator\.(R|anti-ice|hyd|doors|eng|overhead|air-cond)(\.\d+)?', {}))
    for n, p in (('OUTBOARD DISPLAY CPT', 'screen1'), ('INBOARD DISPLAY CPT', 'screen2'), ('INBOARD DISPLAY F/O', 'screen3'), ('OUTBOARD DISPLAY F/O', 'screen4')): R.append((n, 'main', rf':{p}\.full', {'whole': 1}))
    M('CENTER PANEL|ISFD', r'screen\.iesi', pad=10); R.append(('CENTER PANEL|LANDING GEAR LIGHTS', 'main', r':light\.(mlg[LR]|nlg)-(up|down)', {})); M('CENTER PANEL|AUTO BRAKE', 'autobrake', pad=8)
    R.append(('CDU CPT', 'main', r':cdu\.(L|handleL)', {'whole': 1})); R.append(('CDU F/O', 'main', r':cdu\.(R|handleR)', {'whole': 1}))
    M('GPWS|FLAP INHIBIT', r'pd\.flaps-inhibit-cover'); M('GPWS|GEAR INHIBIT', r'pd\.gear-inhibit-cover'); M('GPWS|TERR INHIBIT', r'pd\.terr-inhibit-cover')
    # control stand and aft electronic panel
    def D(n, pat, **o): R.append((n, 'ped', ':' + pat, dict({'min': 50}, **o)))
    def DP(n, x, y, b, w, h, **o): R.append((n, 'ped', VP(sh, 'ped', (x - w / 2) * KP, (y - h / 2) * KP + b * 1609, w * KP, h * KP), o))
    DP('CONTROL STAND|SPEED BRAKE', 427, 645, 0, 150, 140); D('CONTROL STAND|FLAP', r'pd\.flaps'); D('CONTROL STAND|THRUST LEVER 1', r'pd\.n1'); D('CONTROL STAND|THRUST LEVER 2', r'pd\.n2'); D('CONTROL STAND|PARKING BRAKE', r'pd\.parking-brake')
    D('CONTROL STAND|ENGINE START LEVER 1', r'n1\.start(lever|knob)'); D('CONTROL STAND|ENGINE START LEVER 2', r'n2\.start(lever|knob)'); DP('CONTROL STAND|STAB TRIM WHEEL', 440, 900, 0, 90, 380)
    DP('FIRE|ENG 1 FIRE HANDLE', 463, 40, 1, 52, 90); DP('FIRE|APU FIRE HANDLE', 633, 40, 1, 52, 90); DP('FIRE|ENG 2 FIRE HANDLE', 805, 40, 1, 52, 90); DP('FIRE|FIRE TEST', 378, 64, 1, 30, 30)
    DP('CARGO FIRE', 632, 190, 1, 335, 150, whole=1)
    for sfx, x in (('1', 293), ('2', 971)): DP(f'VHF COMM {sfx}', x, 190, 1, 335, 150, whole=1); DP(f'VHF NAV {sfx}', x, 345, 1, 335, 148, whole=1); DP(f'ADF {sfx}', x, 497, 1, 335, 148, whole=1); DP(f'AUDIO SELECTOR PANEL {"CPT" if sfx == "1" else "F/O"}', x, 705, 1, 335, 262, whole=1)
    DP('WX RADAR', 632, 345, 1, 335, 148, whole=1); DP('TRANSPONDER', 632, 485, 1, 335, 132, whole=1)
    D('TRIM|RUDDER TRIM', r'pd\.rudder-trim'); DP('TRIM|AILERON TRIM', 544, 1110, 1, 34, 100); DP('TRIM|RUDDER TRIM INDICATOR', 631, 997, 1, 180, 56)
    DP('AFT ELECTRONIC|FLOOD LIGHT', 236, 1140, 1, 64, 64); DP('AFT ELECTRONIC|PANEL LIGHT', 363, 1140, 1, 64, 64); D('AFT ELECTRONIC|STAB TRIM OVERRIDE', r'pd\.stab-trim-cover'); DP('AFT ELECTRONIC|FLT DK DOOR', 1064, 1140, 1, 64, 64)
    return R
