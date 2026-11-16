"""Boeing 737-800: views and named controls. Model: FlightGear 737-800YV (GPL-2.0)."""
from PIL import Image, ImageDraw, ImageFont
NAME = 'b738'; CONST = 'B738_T'; ID = 'b738'; JSVAR = 'B738'; TITLE = 'Boeing 737-800'; CREW = 2; EXTRA = "style: 'boeing', "
CREDIT_LONG = 'Model: FlightGear Boeing 737-800YV (github.com/FGMEMBERS/737-800YV, GPL-2.0).'
IMG = {'v': '737-800', 'by': 'FlightGear 737-800YV', 'lic': 'GPL-2.0', 'src': 'https://github.com/FGMEMBERS/737-800YV', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'ovh': ((0.895, 1.53, 0.025), (-0.396, 0.918, 0), (0.918, 0.396, 0), 0.74, 0.76, 3000, 1, 2), 'front': ((0.44, 0.94, 0), (-0.96, -0.278, 0), (0, 1, 0), 1.56, 0.52, 3000, 3, 1),
         'cdu': ((0.585, 0.65, 0.02), (-0.49, -0.872, 0), (-0.872, 0.49, 0), 0.58, 0.30, 3000, 1, 1), 'ped': ((1.08, 0.6, 0.02), (0, -1, 0), (-1, 0, 0), 0.5, 0.86, 3000, 1, 2)}
OV = 'Models/Overhead/Overhead.ac'
OVH = {  # panel -> [(control, seed object, radius px for joining the lever, its base and guard)]
 'FLT CONTROL': [('FLT CONTROL A', 'M243', 0), ('FLT CONTROL B', 'M242', 0), ('ALTERNATE FLAPS MASTER', 'M462', 60), ('ALTERNATE FLAPS', 'M323', 36), ('SPOILER A', 'M245', 0), ('SPOILER B', 'M244', 0), ('YAW DAMPER', 'M318', 36)],
 'NAVIGATION / DISPLAYS': [('VHF NAV', 'M317', 36), ('IRS', 'M314', 36), ('FMC', 'M311', 36), ('DISPLAYS SOURCE', 'NavSourceKnob', 0), ('DISPLAYS CONTROL PANEL', 'M308', 36)],
 'FUEL': [('FUEL TEMP', 'M05', 0), ('CROSSFEED', 'CrossfeedKnob', 0), ('CTR PUMP L', 'FuelpumpL', 36), ('CTR PUMP R', 'FuelpumpR', 36), ('AFT PUMP 1', 'FuelPumpAFTL', 36), ('FWD PUMP 1', 'FuelPumpFWDL', 36), ('FWD PUMP 2', 'FuelPumpFWDR', 36), ('AFT PUMP 2', 'FuelPumpAFTR', 36)],
 'ELEC': [('DC METERS', 'DCVoltometerKnob', 0), ('AC METERS', 'ACVoltometerKnob', 0), ('MAINT', 'M251', 0), ('BAT', 'batt-cover', 0), ('CAB/UTIL', 'M326', 36), ('STANDBY POWER', 'M238', 0), ('DRIVE DISCONNECT 1', 'M237', 0), ('DRIVE DISCONNECT 2', 'M236', 0),
          ('GRD PWR', 'grdpwr-switch', 36), ('BUS TRANSFER', 'M417', 0), ('GEN 1', 'EngGen1', 36), ('APU GEN L', 'ApuGenL', 36), ('APU GEN R', 'ApuGenR', 36), ('GEN 2', 'EngGen2', 36)],
 'APU': [('APU EGT', 'M03', 0), ('APU SWITCH', 'APUswitch', 40)],
 'OVERHEAD LIGHTS': [('CIRCUIT BREAKER LT', 'CircitBreakerLightKnob', 0), ('PANEL LT', 'PanelLightKnob', 0)],
 'EQUIP COOLING': [('EQUIP COOLING SUPPLY', 'M329', 36), ('EQUIP COOLING EXHAUST', 'M332', 36)],
 'CABIN': [('EMER EXIT LIGHTS', 'M241', 0), ('NO SMOKING', 'nosmoking', 36), ('FASTEN BELTS', 'fastenseatbelts', 36), ('ATTEND', 'M250', 0), ('GRD CALL', 'M249', 0), ('EVAC', 'M413', 36), ('EVAC HORN CUTOUT', 'M252', 0)],
 'VOICE RECORDER': [('CVR ERASE', 'M253', 0), ('CVR TEST', 'M255', 20), ('CVR HEADPHONE', 'headphoneCVR', 0), ('VOICE RECORDER', 'M416', 36)],
 'WINDOW / PROBE HEAT': [('WINDOW HEAT L SIDE', 'windowlf', 36), ('WINDOW HEAT L FWD', 'windowlf1', 36), ('WINDOW HEAT TEST', 'windowctr', 36), ('WINDOW HEAT R FWD', 'windowrt1', 36), ('WINDOW HEAT R SIDE', 'windowrt', 36), ('PROBE HEAT A', 'M407', 36), ('PROBE HEAT B', 'M410', 36), ('TAT TEST', 'M188', 0)],
 'ANTI ICE': [('WING ANTI ICE', 'wingantiice', 36), ('ENG ANTI ICE 1', 'enganti1', 36), ('ENG ANTI ICE 2', 'enganti2', 36)],
 'HYDRAULICS': [('ENG 1 HYD', 'hydeng1', 36), ('ELEC 2 HYD', 'hydelectr2', 36), ('ELEC 1 HYD', 'hydeng2', 36), ('ENG 2 HYD', 'hydelectr1', 36)],
 'AIR TEMP': [('AIR TEMP SOURCE', 'TempSupplyDuctKnob', 0), ('AIR TEMP', 'M04', 0), ('TRIM AIR', 'M404', 36), ('CONT CAB TEMP', 'TempLKnob', 0), ('FWD CAB TEMP', 'TempCKnob', 0), ('AFT CAB TEMP', 'TempRKnob', 0)],
 'BLEED': [('L RECIRC FAN', 'M380', 36), ('R RECIRC FAN', 'M383', 36), ('DUCT PRESS', 'M20', 0), ('WING-BODY OVHT TEST', 'M144', 0), ('L PACK', 'M377', 36), ('ISOLATION VALVE', 'M389', 36), ('R PACK', 'M386', 36), ('TRIP RESET', 'M143', 0), ('ENG 1 BLEED', 'M398', 36), ('APU BLEED', 'M395', 36), ('ENG 2 BLEED', 'M392', 36)],
 'PRESSURIZATION': [('FLT ALT', 'FltAltDial', 0), ('FLT ALT DISPLAY', 'M246', 0), ('LAND ALT', 'LandAltDial', 0), ('LAND ALT DISPLAY', 'M247', 0), ('PRESS MODE SEL', 'PressureKnob', 0), ('OUTFLOW VALVE', 'M401', 36), ('OUTFLOW VALVE POSITION', 'M40', 0), ('ALT HORN CUTOUT', 'M248', 0), ('CABIN ALT / DIFF PRESS', 'M02', 0), ('CABIN CLIMB', 'M01', 0)],
 'EXT LIGHTS': [('LANDING RETRACT L', 'landinglight1', 0), ('LANDING RETRACT R', 'landinglight2', 0), ('LANDING FIXED L', 'landinglight3', 0), ('LANDING FIXED R', 'landinglight4', 0), ('RUNWAY TURNOFF L', 'RNYTurnL', 30), ('RUNWAY TURNOFF R', 'RNYTurnR', 30), ('TAXI', 'taxilight', 30),
                ('LOGO', 'logolight', 30), ('POSITION', 'strobelight', 30), ('ANTI COLLISION', 'anticollight', 30), ('WING', 'winglight', 30), ('WHEEL WELL', 'wheellight', 30)],
 'WIPERS': [('WIPER L', 'WiperLKnob', 0), ('WIPER R', 'WiperRKnob', 0)],
 'ENGINE START': [('ENG START L', 'EngStartLKnob', 0), ('IGNITION SELECT', 'M284', 36), ('ENG START R', 'EngStartRKnob', 0)]}
import re, numpy as np
def cluster(sh, view, file, seed, R):
    """the seed object plus the small objects of the same file whose centre is within R px (a toggle's lever, base, guard)"""
    seed = re.sub(r'^M(\d)', r'Mesh\1', seed); C = []
    for o in sh.O:
        if o['file'] != file or o['name'].endswith('.on'): continue
        q = sh.proj(view, o['v']); mn, mx = q.min(0), q.max(0); C.append((o['name'], mn, mx))
    S = [(mn, mx) for n, mn, mx in C if n == seed]
    if not S: return None
    mn = np.min([a for a, b in S], 0); mx = np.max([b for a, b in S], 0); c = (mn + mx) / 2
    for n, a, b in C:
        if R and np.hypot(*((a + b) / 2 - c)) < R and (b - a).max() < 110: mn = np.minimum(mn, a); mx = np.maximum(mx, b)
    return [float(mn[0]), float(mn[1]), float(mx[0] - mn[0]), float(mx[1] - mn[1])]
def CTL(sh):
    R = []
    for panel, L in OVH.items():
        for name, seed, rad in L:
            b = cluster(sh, 'ovh', OV, seed, rad)
            if b is None: print('  NO SEED', panel, name, seed); continue
            R.append((f'{panel}|{name}', 'ovh', b, {'min': 56}))
    return R + MORE(sh)
FD = 'flightdesk'; AP = 'flightdesk/AUTOPILOT'
def efis(side, inst):
    P = f'EFIS {side}'; K = lambda n: rf'{AP}/{inst}:{n}'
    return [(f'{P}|MINS {side}', 'front', K(r'(MINS\.knob.*|DH\.reset)')), (f'{P}|FPV {side}', 'front', K(r'FPV\.btn')), (f'{P}|MTRS {side}', 'front', K(r'MTRS\.btn')), (f'{P}|BARO {side}', 'front', K(r'(BARO\.knob.*|inhg\.reset)')),
            (f'{P}|VOR/ADF 1 {side}', 'front', K(r'Lvor\..*')), (f'{P}|ND MODE {side}', 'front', K(r'(MODE\.knob|ND\.center)')), (f'{P}|ND RANGE {side}', 'front', K(r'(Range\.knob|TFC)')), (f'{P}|VOR/ADF 2 {side}', 'front', K(r'Rvor\..*')),
            *[(f'{P}|{n} {side}', 'front', K(k), {'min': 50}) for n, k in (('WXR', r'(WXR\.btn|LH-WX)'), ('STA', r'STA\.btn'), ('WPT', r'WPT\.btn'), ('ARPT', r'ARPT\.btn'), ('DATA', r'DATA\.btn'), ('POS', r'POS\.btn'), ('TERR', r'TERR\.btn'))]]
def V(sh, view, x, y, w, h): return [sh.pos[view][0] + x - sh.crop.get(view, (0, 0))[0], sh.pos[view][1] + y - sh.crop.get(view, (0, 0))[1], w, h]
def MORE(sh):
    M = lambda n: rf'{AP}:{n}'; F = lambda n: rf'{FD}:{n}'; W = lambda n: rf'{FD}/WARNINGS:{n}'; PD = lambda n: rf'pedestal:{n}'; m = {'min': 56}
    R = [('MCP|COURSE CPT', 'front', M(r'CPT-COURSE_\d')), ('MCP|COURSE CPT DISPLAY', 'front', M(r'CRS\.\d')), ('MCP|F/D CPT', 'front', M('cap-fd'), m), ('MCP|A/T ARM', 'front', M('at-arm'), m), ('MCP|N1', 'front', M('N1')), ('MCP|SPEED', 'front', M('SPEED')),
         ('MCP|C/O', 'front', M('mach-ias'), m), ('MCP|IAS/MACH', 'front', M('IASknb')), ('MCP|IAS/MACH DISPLAY', 'front', M(r'IAS\.\d')), ('MCP|LVL CHG', 'front', M(r'LVL-CHG\.')), ('MCP|VNAV', 'front', M('V-NAV')), ('MCP|HEADING', 'front', M(r'HDG-SEL_\d')),
         ('MCP|HEADING DISPLAY', 'front', M(r'HDG\.\d')), ('MCP|HDG SEL', 'front', M('HDG-HLD')), ('MCP|LNAV', 'front', M('L-NAV')), ('MCP|VOR LOC', 'front', M('VOR-LOC')), ('MCP|APP', 'front', M('APP')), ('MCP|ALTITUDE', 'front', M(r'ALT-SEL_\d')),
         ('MCP|ALTITUDE DISPLAY', 'front', M(r'ALT\.\d')), ('MCP|ALT HLD', 'front', M('ALT-HLD')), ('MCP|V/S', 'front', M('V/S')), ('MCP|VERT SPEED', 'front', M('(vswheel|cylinder)')), ('MCP|VERT SPEED DISPLAY', 'front', M(r'VS\.\d')),
         ('MCP|CMD A', 'front', M('CMD-A')), ('MCP|CMD B', 'front', M('CMD-B')), ('MCP|CWS A', 'front', M('CWS-A')), ('MCP|CWS B', 'front', M('CWS-B')), ('MCP|A/P DISENGAGE', 'front', M('DISENGAGE')), ('MCP|F/D F/O', 'front', M('fo-fd'), m),
         ('MCP|COURSE F/O', 'front', M(r'F/O-COURSE\.\d+')), ('MCP|COURSE F/O DISPLAY', 'front', M(r'FO-CRS\.\d')),
         *efis('CPT', 'efis-control-panel-left'), *efis('F/O', 'efis-control-panel-right'),
         ('GLARESHIELD CPT|FIRE WARN CPT', 'front', W('LeftFireWarn')), ('GLARESHIELD CPT|MASTER CAUTION CPT', 'front', W('LeftCtn')), ('GLARESHIELD CPT|SYSTEM ANNUNCIATOR CPT', 'front', W(r'(LeftRecall|IRS.*|FLTCONT.*|FUEL.*|ELEC.*|APU.*|OVHT.*)')),
         ('GLARESHIELD F/O|FIRE WARN F/O', 'front', W('RightFireWarn')), ('GLARESHIELD F/O|MASTER CAUTION F/O', 'front', W('RightCtn')), ('GLARESHIELD F/O|SYSTEM ANNUNCIATOR F/O', 'front', W(r'(RightRecall|ANTI-ICE.*|HYD.*|DOOR.*|ENG.*|OVHD.*|ACOND.*)')),
         ('CPT PANEL|CLOCK CPT', 'front', rf'{FD}/cap-CLOCK:.*'), ('CPT PANEL|MAIN PANEL DUs CPT', 'front', F('du-knob1-lh')), ('CPT PANEL|LOWER DU CPT', 'front', F('du-knob2-lh')), ('CPT PANEL|AFDS RESET CPT', 'front', F(r'Circle\.174')),
         ('F/O PANEL|CLOCK F/O', 'front', rf'{FD}/fo-CLOCK:.*'), ('F/O PANEL|MAIN PANEL DUs F/O', 'front', F(r'du-knob1-lh\.001')), ('F/O PANEL|LOWER DU F/O', 'front', F(r'du-knob2-lh\.001')), ('F/O PANEL|AFDS RESET F/O', 'front', F(r'Circle\.000')),
         ('STANDBY|STANDBY ATTITUDE', 'front', rf'{FD}/STANDBY-AH:.*'), ('STANDBY|STANDBY RMI', 'front', rf'{FD}/STANDBY-VOR:.*'),
         ('CENTER PANEL|N1 SET', 'front', F(r'Circle\.22[78]')), ('CENTER PANEL|SPD REF', 'front', F(r'Circle\.2(29|30)')), ('GEAR / AUTOBRAKE|AUTOBRAKE', 'front', F('autobrake')), ('GEAR / AUTOBRAKE|FLAP INDICATOR', 'front', F(r'Circle\.173')),
         ('GEAR / AUTOBRAKE|GEAR LIGHTS', 'front', F('[LNR]G[DN][ND]')), ('GEAR / AUTOBRAKE|GEAR LEVER', 'front', F('lghandle'), {'pad': 40, 'h': 420}), ('GEAR / AUTOBRAKE|BRAKE PRESSURE', 'front', F(r'Circle\.166')),
         ('PFD CPT', 'front', rf'{FD}/PFD1:pfdScreen', {'whole': 1}), ('ND CPT', 'front', rf'{FD}/ND1:ndScreenL', {'whole': 1}), ('UPPER DU', 'front', rf'{FD}/EICAS:upperEICASScreen', {'whole': 1}), ('ND F/O', 'front', rf'{FD}/ND2:ndScreenR', {'whole': 1}), ('PFD F/O', 'front', rf'{FD}/PFD2:pfdScreen', {'whole': 1}),
         ('LOWER DU', 'cdu', r'pedestal/EICAS2:lowerEICASScreen', {'whole': 1}), ('CDU L', 'cdu', r'pedestal/CDU1:CDU', {'whole': 1}), ('CDU R', 'cdu', r'pedestal/CDU2:CDU', {'whole': 1}),
         ('THRUST LEVERS|THR LEVER 1', 'ped', PD('quadone')), ('THRUST LEVERS|THR LEVER 2', 'ped', PD('quadtwo')), ('THRUST LEVERS|REVERSE 1', 'ped', PD('no1revarm')), ('THRUST LEVERS|REVERSE 2', 'ped', PD('no2revarm')), ('THRUST LEVERS|TOGA L', 'ped', PD('TOGAbtnL'), m), ('THRUST LEVERS|TOGA R', 'ped', PD('TOGAbtnR'), m),
         ('THRUST LEVERS|A/T DISENGAGE L', 'ped', PD('ATdiscL'), m), ('THRUST LEVERS|A/T DISENGAGE R', 'ped', PD('ATdiscR'), m), ('CONTROL STAND|SPEED BRAKE', 'ped', PD('sbarm')), ('CONTROL STAND|FLAP LEVER', 'ped', PD('flaparm')), ('CONTROL STAND|PARKING BRAKE', 'ped', PD(r'(parkbrake_\d|break)')),
         ('CONTROL STAND|ENG START LEVER 1', 'ped', PD(r'cutoffNo1_\d')), ('CONTROL STAND|ENG START LEVER 2', 'ped', PD(r'cutoffNo2_\d')), ('CONTROL STAND|STAB TRIM WHEEL L', 'ped', PD('trimwheellh')), ('CONTROL STAND|STAB TRIM WHEEL R', 'ped', PD('trimwheelrh')),
         ('FIRE PROTECTION|ENG 1 FIRE', 'ped', PD(r'Circle\.169')), ('FIRE PROTECTION|APU FIRE', 'ped', PD(r'Circle\.170')), ('FIRE PROTECTION|ENG 2 FIRE', 'ped', PD(r'Circle\.171')), ('FIRE PROTECTION|OVHT DET 1', 'ped', PD(r'(disk\.006|Button\.006)'), m), ('FIRE PROTECTION|OVHT DET 2', 'ped', PD(r'(disk\.004|Button\.004)'), m),
         ('FIRE PROTECTION|OVHT/FIRE TEST', 'ped', PD(r'(disk\.005|Button\.001)'), m), ('FIRE PROTECTION|EXT TEST', 'ped', PD(r'(disk\.007|Button\.003)'), m),
         ('VHF 1|VHF 1 FREQ L', 'ped', PD('comm(A)?')), ('VHF 1|VHF 1 FREQ R', 'ped', PD('commsby(A)?')), ('VHF 2|VHF 2 FREQ L', 'ped', PD('comm1(A)?')), ('VHF 2|VHF 2 FREQ R', 'ped', PD('commsby1(A)?')),
         ('NAV 1|NAV 1 FREQ', 'ped', PD(r'VOR1(A.*)?')), ('NAV 1|NAV 1 TRANSFER', 'ped', PD(r'TFRA.*'), m), ('NAV 2|NAV 2 FREQ', 'ped', PD(r'VOR2(A.*)?')), ('NAV 2|NAV 2 TRANSFER', 'ped', PD(r'TFRB.*'), m),
         ('ADF|ADF 1 FREQ', 'ped', PD(r'(ADF1\.001|Circle\.001)')), ('ADF|ADF 2 FREQ', 'ped', PD(r'(ADF1|Circle)')), ('LIGHTS|FLOOD LT', 'ped', PD(r'autobrake\.000')), ('LIGHTS|PANEL LT', 'ped', PD(r'autobrake\.007')),
         ('TRIM|RUDDER TRIM', 'ped', PD(r'Circle\.242')), ('TRIM|STAB TRIM OVERRIDE', 'ped', PD('StabTrimSwitchCover'), m)]
    # controls that are only painted on the model's texture: rectangles measured on this picture (pedestal view pixels)
    for id_, x, y, w, h in (('VHF 1|VHF 1 TRANSFER', 240, 1105, 70, 70), ('VHF 2|VHF 2 TRANSFER', 1160, 1105, 70, 70), ('CARGO FIRE|DET SELECT FWD', 645, 1095, 80, 80), ('CARGO FIRE|DET SELECT AFT', 735, 1095, 80, 80), ('CARGO FIRE|CARGO FIRE TEST', 560, 1200, 70, 70),
                            ('CARGO FIRE|ARM FWD', 648, 1188, 92, 70), ('CARGO FIRE|ARM AFT', 738, 1188, 92, 70), ('CARGO FIRE|DISCH', 832, 1175, 90, 90), ('WEATHER RADAR|WXR GAIN', 545, 1345, 90, 90), ('WEATHER RADAR|WXR TILT', 828, 1342, 90, 90),
                            ('WEATHER RADAR|WXR TEST', 578, 1298, 48, 34), ('WEATHER RADAR|WXR WX', 642, 1298, 48, 34), ('WEATHER RADAR|WXR WX+T', 772, 1298, 54, 34), ('WEATHER RADAR|WXR MAP', 838, 1298, 48, 34),
                            ('TRANSPONDER|XPDR MODE', 842, 1632, 84, 84), ('TRANSPONDER|XPDR CODE L', 608, 1722, 76, 76), ('TRANSPONDER|XPDR IDENT', 706, 1742, 50, 50), ('TRANSPONDER|XPDR CODE R', 780, 1722, 76, 76), ('TRANSPONDER|XPDR DISPLAY', 672, 1652, 118, 74),
                            ('AUDIO CPT|AUDIO CPT', 100, 1495, 395, 330), ('AUDIO F/O|AUDIO F/O', 962, 1495, 400, 330), ('TRIM|AILERON TRIM', 535, 2365, 115, 180), ('TRIM|RUDDER TRIM INDICATOR', 532, 2262, 395, 90)):
        R.append((id_, 'ped', V(sh, 'ped', x, y, w, h), {'whole': 1} if id_.startswith('AUDIO') else {}))
    return R
CROP = {'cdu': (0, 0, 1740, 800), 'front': (0, 0, 4680, 1430), 'ped': (0, 95, 1500, 2580)}
def post(k, im):
    if k != 'cdu': return im
    a = im.getchannel('A'); rgb = im.convert('RGB').point(lambda v: int(255 * (v / 255) ** 0.62)); rgb.putalpha(a); return rgb
def paint(sh):
    for view, pat, f in (('front', rf'{FD}/PFD1:pfdScreen', 'b_pfd'), ('front', rf'{FD}/ND1:ndScreenL', 'b_nd'), ('front', rf'{FD}/EICAS:upperEICASScreen', 'b_eicas'), ('front', rf'{FD}/ND2:ndScreenR', 'b_nd'), ('front', rf'{FD}/PFD2:pfdScreen', 'b_pfd'),
                         ('cdu', r'pedestal/EICAS2:lowerEICASScreen', 'b_lower'), ('cdu', r'pedestal/CDU1:CDuscreen', 'b_cdu'), ('cdu', r'pedestal/CDU2:CDuscreen', 'b_cdu')):
        x, y, w, h = (round(v) for v in sh.box(view, pat)); im = Image.open(f'/home/claude/rend/scr/{f}.png').convert('RGBA').resize((w - 6, h - 6), Image.LANCZOS); ImageDraw.Draw(sh.S).rectangle([x, y, x + w, y + h], fill=(6, 8, 10, 255)); sh.S.paste(im, (x + 3, y + 3))
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 34); d = ImageDraw.Draw(sh.S)
    for pat, t in ((r'CRS\.\d', '251'), (r'IAS\.\d', '153'), (r'HDG\.\d', '264'), (r'ALT\.\d', ' 5000'), (r'FO-CRS\.\d', '251')):
        x, y, w, h = sh.box('front', rf'{AP}:{pat}'); d.text((x + w / 2, y + h / 2), t, font=f, fill=(244, 150, 40, 255), anchor='mm')
    # Captions the model leaves blank on unlit annunciators (their real wording), and the two hydraulic pump labels the model
    # prints in the wrong order (the aircraft has ENG 1, ELEC 2, ELEC 1, ENG 2 from left to right).
    CAP = {'CAPTPITOT': 'CAPT|PITOT', 'LELEVPITOT': 'L ELEV|PITOT', 'LALPHA': 'L ALPHA|VANE', 'LTEMP': 'TEMP|PROBE', 'FOPITOT': 'F/O|PITOT', 'RELEVPITOT': 'R ELEV|PITOT', 'RALPHA': 'R ALPHA|VANE', 'RTEMP': 'AUX|PITOT',
           'ZONETEMPL': 'ZONE|TEMP', 'ZONETEMPC': 'ZONE|TEMP', 'ZONETEMPR': 'ZONE|TEMP', 'DUALBLEED': 'DUAL|BLEED', 'RAMDOOROPENL': 'RAM DOOR|FULL OPEN', 'RAMDOOROPENR': 'RAM DOOR|FULL OPEN', 'PACKL': 'PACK', 'PACKR': 'PACK',
           'WBOVHTL': 'WING-BODY|OVERHEAT', 'WBOVHTR': 'WING-BODY|OVERHEAT', 'BLEEDTRIPL': 'BLEED|TRIP OFF', 'BLEEDTRIPR': 'BLEED|TRIP OFF', 'FWDENTRY': 'FWD|ENTRY', 'FWDSERVICE': 'FWD|SERVICE', 'L1overwing': 'LEFT FWD|OVERWING',
           'R1overwing': 'RIGHT FWD|OVERWING', 'FWDCARGO': 'FWD|CARGO', 'EQUIP': 'EQUIP', 'L2overwing': 'LEFT AFT|OVERWING', 'R2overwing': 'RIGHT AFT|OVERWING', 'AFTCARGO': 'AFT|CARGO', 'AFTENTRY': 'AFT|ENTRY', 'AFTSERVICE': 'AFT|SERVICE',
           'AUTOFAIL': 'AUTO|FAIL', 'OFFSCHEDDESC': 'OFF SCHED|DESCENT', 'ALTNpack': 'ALTN', 'MANUALpack': 'MANUAL', 'MAINTapu': 'MAINT', 'lowoilpressapu': 'LOW OIL|PRESSURE', 'fault': 'FAULT', 'overspeed': 'OVER|SPEED'}
    B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    for name, cap in CAP.items():
        x, y, w, h = sh.box('ovh', rf'overhead:{re.escape(name)}\.on'); L = cap.split('|'); col = (46, 96, 54, 255) if name in ('ALTNpack', 'MANUALpack') else (52, 70, 120, 255) if name == 'MAINTapu' else (116, 66, 20, 255)
        d.rectangle([x + 1, y + 1, x + w - 1, y + h - 1], fill=(16, 17, 19, 255)); sz = 18
        while sz > 8 and (max(d.textlength(t, font=ImageFont.truetype(B, sz)) for t in L) > w - 10 or sz * 1.15 * len(L) > h - 6): sz -= 1
        ff = ImageFont.truetype(B, sz)
        for i, t in enumerate(L): d.text((x + w / 2, y + h / 2 + (i - (len(L) - 1) / 2) * sz * 1.12), t, font=ff, fill=col, anchor='mm')
    ox, oy = sh.pos['ovh'][0], sh.pos['ovh'][1]; ff = ImageFont.truetype(B, 15)
    for x0, x1, t in ((1470, 1522, 'ELEC 1'), (1552, 1612, 'ENG 2')):
        c = sh.S.getpixel((ox + x0 - 6, oy + 1000)); d.rectangle([ox + x0, oy + 990, ox + x1, oy + 1010], fill=c); d.text((ox + (x0 + x1) / 2, oy + 1000), t, font=ff, fill=(214, 220, 226, 255), anchor='mm')
PLACE = None
