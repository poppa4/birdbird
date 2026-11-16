"""ATR 72-500: views and named controls. Model: FlightGear ATR 72-500 (ATR 72-500/C project, GPL-3.0)."""
from PIL import Image, ImageDraw, ImageFont
NAME = 'atr72'; CONST = 'ATR72_T'; ID = 'atr72'; JSVAR = 'ATR72'; TITLE = 'ATR 72-500'; CREW = 2; EXTRA = "style: 'atr', "
CREDIT_LONG = 'Model: FlightGear ATR 72-500 (github.com/FGMEMBERS/ATR72, GPL-3.0, by Narendran Muraleedharan, Donald Belcham, Dwayne Gable, Oliver (ot-666) and camelon).'
IMG = {'v': 'ATR 72-500, classic instruments (not the -600 glass cockpit)', 'by': 'FlightGear ATR 72-500 project', 'lic': 'GPL-3.0', 'src': 'https://github.com/FGMEMBERS/ATR72', 'licUrl': 'https://www.gnu.org/licenses/gpl-3.0.html'}
VIEWS = {'ovh': ((-10.675, 1.425, 0), (-0.361, 0.932, 0), (0.932, 0.361, 0), 1.0, 0.96, 2600, 1, 3), 'front': ((-11.29, 0.66, 0), (-0.985, -0.173, 0), (0, 1, 0), 1.9, 0.74, 2600, 4, 1), 'ped': ((-10.72, 0.2, 0), (0, -1, 0), (-1, 0, 0), 0.56, 1.08, 2600, 1, 2)}
CROP = {'ovh': (300, 860, 2300, 2440)}
import numpy as np, re
OH = 'Models/FlightDeck/ohpanel.ac'
def at(sh, view, file, x, y, maxsize=260):
    """box of the object of this file nearest to a point given in the view's own pixels (for parts the model names only 'sphere' or 'cylinder')"""
    X = sh.pos[view][0] + x - sh.crop.get(view, (0, 0))[0]; Y = sh.pos[view][1] + y - sh.crop.get(view, (0, 0))[1]; best = None
    for o in sh.O:
        if file not in o['file']: continue
        q = sh.proj(view, o['v']); mn, mx = q.min(0), q.max(0)
        if (mx - mn).max() > maxsize: continue
        d = np.hypot(*((mn + mx) / 2 - (X, Y)))
        if best is None or d < best[0]: best = (d, mn, mx)
    if not best or best[0] > 60: print('  painted only, rectangle by hand:', view, x, y); return [X - 30, Y - 36, 60, 72]
    return [float(best[1][0]), float(best[1][1]), float(best[2][0] - best[1][0]), float(best[2][1] - best[1][1])]
OVH = {  # panel -> [(control, object name | (x, y) in overhead view pixels)]
 'ENG 1 FIRE': [('ENG 1 SQUIB TEST', (470, 970)), ('ENG 1 AGENT 1', 'lside_agent1'), ('ENG 1 LOOP A', 'lside_loopa'), ('ENG 1 FAULT TEST', (626, 1056)), ('ENG 1 LOOP B', 'lside_loopb'), ('ENG 1 AGENT 2', 'lside_agent2')],
 'ENG 2 FIRE': [('ENG 2 SQUIB TEST', (1820, 970)), ('ENG 2 AGENT 1', 'rside_agent1'), ('ENG 2 LOOP A', 'rside_loopa'), ('ENG 2 FAULT TEST', (1974, 1048)), ('ENG 2 LOOP B', 'rside_loopb'), ('ENG 2 AGENT 2', 'rside_agent2')],
 'FLT CTL': [('FLT CTL FAULT', 'fltctl_fault'), ('TLU', (468, 1380)), ('SPLR', 'fltctl_splr'), ('MFC 1A', 'mfc_1a'), ('MFC 1B', 'mfc_1b'), ('MFC 2A', 'mfc_2a'), ('MFC 2B', 'mfc_2b')],
 'LDG GEAR / DOORS': [('LDG GEAR LIGHTS', 'ldggear[lnr]'), ('DOORS CAB/SVCE OK', 'doors_cabsvcok'), ('DOORS FWD COMPT', 'doors_fwdcompt'), ('DOORS CABIN/CARGO', 'doors_cabincargo'), ('DOORS EMER/SVCE', 'doors_emersvce'), ('DOORS SW TEST', (455, 1630))],
 'FUEL': [('ENG 1 LP VALVE', 'eng1fuelLP'), ('ENG 2 LP VALVE', 'eng2fuelLP'), ('FUEL X FEED', 'fuelxfeed'), ('FUEL PUMP 1', 'eng1fuelpump'), ('FUEL PUMP 2', 'eng2fuelpump'), ('FUEL PRESS', 'fuelguage'), ('L TANK LOW LEVEL', 'lfuelind'), ('R TANK LOW LEVEL', 'rfuelind')],
 'FLT COMPT LT': [('STORM LT', (477, 2050)), ('DOME LT', (487, 2158)), ('STBY COMPASS LT', (555, 2200)), ('MIN CAB LT', (626, 2170))],
 'CALLS / SELCAL': [('ATTND CALL', 'call_attend'), ('MECH CALL', 'call_mech'), ('CALLS RESET', (596, 2075)), ('SELCAL EMER', 'selcal_emercall'), ('SELCAL', 'selcal_call'), ('SELCAL RESET', (738, 2080))],
 'WIPERS': [('CAPT WIPER', r'wiper0\.knob'), ('F/O WIPER', r'wiper1\.knob')],
 'MAIN ELEC PWR': [('BAT', r'bat\.sw'), ('EMER BAT CHG', 'emerbatchg'), ('TRU', 'tru'), ('EMER BUS / ESS BUS', 'emerbus_essbus'), ('STBY BUS', 'stbybus'), ('AC BUS 1', 'acbus1'), ('AC BUS 2', 'acbus2'), ('BAT AMP', 'batamp'), ('BAT SEL', r'bat\.mode'), ('DC BTC', r'dcbtc\.sw'),
                   ('DC BUS 1', 'dcbus1'), ('DC BUS 2 OFF', (1190, 1440)), ('DC BUS 2', (1197, 1528)), ('DC SVCE/UTLY BUS', r'util\.sw'), ('DC GEN 1', r'dcgen1\.sw'), ('DC EXT PWR', r'extpwr\.sw'), ('DC GEN 2', r'dcgen2\.sw')],
 'ENG START': [('START 1', 'eng1start'), ('START SEL', 'startmode'), ('START 2', 'eng2start'), ('MAN IGN', 'mainign')],
 'PROP BRAKE': [('PROP BRAKE', 'propbrake'), ('PROP BRAKE UNLOCK', 'propbrakeunlock'), ('PROP BRAKE FAIL', 'propbrakefail')],
 'EXT LT': [('BEACON', r'beacon\.sw'), ('NAV', r'nav\.sw'), ('STROBE', r'strobe\.sw'), ('LOGO', r'logo\.sw'), ('TAXI & TO', r'taxi\.sw'), ('LAND L', r'landl\.sw'), ('LAND R', r'landr\.sw'), ('WING', r'wing\.sw')],
 'HYD PWR': [('BLUE PUMP', r'bluepump\.sw'), ('AUX PUMP', r'aux\.pump'), ('HYD X FEED', 'hydxfeed'), ('GREEN PUMP', r'greenpump\.sw')],
 'AC WILD ELEC PWR': [('ACW BTC', r'ac\.btc'), ('ACW GEN 1', 'acgen1'), ('ACW EXT PWR', 'acextpwr'), ('ACW GEN 2', 'acgen2'), ('ACW BUS 1', 'acbus1ind'), ('ACW BUS 2', 'acbus2ind')],
 'PROBES / WINDSHIELD HTG': [('PROBES HTG CAPT', 'probeshtg_capt'), ('PROBES HTG STBY', 'probeshtg_stby'), ('PROBES HTG F/O', 'probeshtg_fo'), ('WINDSHIELD HTG L', 'lwindowheat'), ('WINDSHIELD HTG R', 'rwindowheat')],
 'ANTI ICING': [('PROP 1 ANTI ICING', 'prop1antiice'), ('PROP 2 ANTI ICING', 'prop2antiice'), ('L ELEV HORNS', 'lelevantiice'), ('R ELEV HORNS', 'relevantiice'), ('SIDE WINDOWS', 'windowsantiice'), ('ANTI ICING MODE SEL', 'antiicing_modesel'), ('MODE SEL AUTO', 'modeselauto')],
 'DE ICING': [('ENG 1 DE ICING', 'eng1deice'), ('ENG 2 DE ICING', 'eng2deice'), ('DE ICING MODE SEL', 'fastdeice'), ('AIRFRAME MODE', 'normdeice'), ('AIRFRAME DE ICING', 'airframedeice'), ('AFR AIR BLEED', 'afrairbleed')],
 'SIGNS': [('NO SMOKING', 'nosmoking'), ('SEAT BELTS', (1455, 2255)), ('EMER EXIT LT', (1560, 2250))],
 'OXYGEN': [('OXYGEN PRESSURE', 'oxyguage'), ('OXY MAIN SUPPLY', 'oxymain'), ('OXY PAX SUPPLY', 'oxypax')],
 'COMPT SMK': [('SMK TEST', (1978, 1198)), ('AFT COMPT / LAV DET FANS', 'aft_compt')],
 'AVIONICS VENT': [('EXHAUST MODE', 'exhaustmode'), ('OVBD VALVE', (2132, 1478))],
 'COMPT TEMP': [('RECIRC FAN 1', 'recingfan1'), ('RECIRC FAN 2', 'recingfan2'), ('COMPT TEMP', 'compttemp_guage'), ('FLT COMPT TEMP SEL', 'ltempselauto'), ('CABIN TEMP SEL', 'rtempselauto'), ('FLT COMPT TEMP', (1860, 1805)), ('CABIN TEMP', (2100, 1805)), ('COMPT SEL', (1962, 1765)), ('PACK FLOW', 'compt_flow')],
 'AIR BLEED': [('PACK 1', 'pack1'), ('PACK 2', 'pack2'), ('BLEED X VALVE', 'airbleedxfeed'), ('BLEED 1', 'e1bleed'), ('BLEED 2', 'e2bleed')],
 'ANN LT': [('ANN LT', (1995, 2195))]}
def CTL(sh):
    R = []
    for panel, L in OVH.items():
        for name, sel in L:
            if isinstance(sel, tuple): R.append((f'{panel}|{name}', 'ovh', at(sh, 'ovh', OH, *sel), {'min': 60}))
            else: R.append((f'{panel}|{name}', 'ovh', rf'OHPanel:{sel}', {'min': 60}))
    return R + MORE(sh)
FDK = 'FlightDeck/flightdeck.ac'
def V(sh, view, x, y, w, h): return [sh.pos[view][0] + x - sh.crop.get(view, (0, 0))[0], sh.pos[view][1] + y - sh.crop.get(view, (0, 0))[1], w, h]
def side(sfx, fo, p):
    I = lambda n: re.escape(n + (' (FO)' if fo else '')) + ':.*'; P = f'{sfx} PANEL'
    return [(f'{P}|AIRSPEED {sfx}', 'front', I('Airspeed Indicator')), (f'{P}|EADI {sfx}', 'front', I('EADI'), {'pad': 30}), (f'{P}|ALTIMETER {sfx}', 'front', I('Altimeter')), (f'{P}|CLOCK {sfx}', 'front', I('Local Time Clock')), (f'{P}|RMI {sfx}', 'front', I('Horizontal Situation Indicator')),
            (f'{P}|EHSI {sfx}', 'front', I('EHSI'), {'pad': 30}), (f'{P}|VERTICAL SPEED {sfx}', 'front', I('Vertical Speed Indicator')), (f'{P}|MASTER WARNING {sfx}', 'front', f'masterWarning_{p}'), (f'{P}|MASTER CAUTION {sfx}', 'front', f'masterCaution_{p}'),
            (f'{P}|AP OFF {sfx}', 'front', f'{p.lower()}_apoff'), (f'{P}|FD BARS {sfx}', 'front', 'fd-bars-' + ('fo' if fo else 'capt'), {'min': 70}), (f'{P}|ADC SW {sfx}', 'front', f'adc_sw_{p.lower()}', {'min': 60}), (f'{P}|TAT/SAT/TAS {sfx}', 'front', f'(tat_tas|sat)_{p.lower()}')]
def MORE(sh):
    m = {'min': 60}; E = lambda n: rf'Engine Instruments:{n}'
    R = [*side('CPT', 0, 'Pilot'), *side('F/O', 1, 'CoPilot'),
         *[(f'AFCS|{lab}', 'front', ':' + key, m) for lab, key in (('HDG', 'hdg'), ('NAV', 'nav'), ('APP', 'app'), ('BC', 'bc'), ('BANK', 'bank'), ('STBY', 'stby'), ('IAS', 'ias'), ('VS', 'vs'), ('ALT', 'alt'), ('AP', 'ap'), ('YD', 'yd'), ('CPL', 'cpl'))],
         ('AFCS|PITCH WHEEL', 'front', '(nose_dn|nose_up|vsknob)'), ('AFCS|CRS 1', 'front', 'crs1'), ('AFCS|HDG SEL', 'front', 'afcs_hdg'), ('AFCS|ALT SEL', 'front', 'altknob'), ('AFCS|CRS 2', 'front', 'crs2'),
         ('ADU|ADU DISPLAY', 'front', V(sh, 'front', 2329, 267, 330, 172)), ('ADU|ADU RESET', 'front', 'box0000071', m), ('ADU|ADU L SEL', 'front', 'box0000078', m), ('ADU|ADU R SEL', 'front', 'box0000072', m), ('ADU|ADU BRT', 'front', 'adu-brt', m),
         ('NAV 1|NAV 1 CONTROL', 'front', r'VOR1/NAV1 Frequency \(Collins CTL-96\):.*'), ('NAV 2|NAV 2 CONTROL', 'front', r'VOR2/NAV2 Frequency \(Collins CTL-96\):.*'),
         ('STANDBY|STANDBY HORIZON', 'front', 'stby-ai-horizon', {'pad': 40}), ('STANDBY|STANDBY AIRSPEED', 'front', 'Standby Airspeed Indicator:.*'), ('STANDBY|STANDBY ALTIMETER', 'front', 'Standby Altimeter:.*'),
         ('CAP|CREW ALERTING PANEL', 'front', 'ccas_(?!rcl|clr|to_inhi).*', {'whole': 1}), ('CAP|RCL', 'front', 'ccas_rcl', m), ('CAP|CLR', 'front', 'ccas_clr', m), ('CAP|TO INHI', 'front', 'ccas_to_inhi', m), ('ENGINE|PWR MGT', 'front', r'pwr\.setting'),
         *[(f'ENGINE|{lab} {i + 1}', 'front', E(f'{key}{i}'), {'pad': 62}) for lab, key in (('TORQUE', 'torque'), ('NP', 'np'), ('ITT', 'itt'), ('NH', 'nh'), ('FUEL FLOW', 'ff'))for i in (0, 1)],
         ('ENGINE|OIL 1', 'front', E('oil(press|temp)0'), {'pad': 40}), ('ENGINE|OIL 2', 'front', E('oil(press|temp)1'), {'pad': 40}), ('ENGINE|FUEL TEMP 1', 'front', r'fuel-temp\.l', {'pad': 40}), ('ENGINE|FUEL TEMP 2', 'front', r'fuel-temp\.r', {'pad': 40}),
         ('ENGINE|EEC 1', 'front', V(sh, 'front', 2316, 843, 56, 38), m), ('ENGINE|ATPCS', 'front', V(sh, 'front', 2376, 843, 56, 38), m), ('ENGINE|EEC 2', 'front', V(sh, 'front', 2436, 843, 56, 38), m), ('FUEL QTY|FUEL QTY TEST', 'front', 'fuel_test_btn', m),
         ('LDG GEAR|LDG GEAR LEVER', 'front', 'gearlever', {'pad': 20}), ('LDG GEAR|LDG GEAR LIGHTS', 'front', 'ldg[LNR]'), ('LDG GEAR|BRAKE ACCU PRESS', 'front', 'Brakes:.*'), ('LDG GEAR|ANTISKID', 'front', V(sh, 'front', 2640, 1051, 184, 102)),
         ('LDG GEAR|BRAKE TEMP', 'front', 'brake_temp', m), ('FLAPS / TRIM|FLAPS INDICATOR', 'front', 'Flaps Indicator:.*'), ('FLAPS / TRIM|TRIM INDICATORS', 'front', 'Trim Indicators:.*'), ('CAB PRESS|CAB PRESS', 'front', 'cabinpressure', {'whole': 1}),
         ('CAB PRESS|CAB PRESS MODE SEL', 'front', V(sh, 'front', 2960, 1790, 110, 60))]
    return R + PED(sh)
def PED(sh):
    A = lambda x, y, mx=260: at(sh, 'ped', FDK, x, y, mx); m = {'min': 60}
    return [('FMC|FMC', 'ped', 'Flight Management Computer:.*', {'whole': 1}), ('PARKING / EMER BRAKE|PARKING BRAKE', 'ped', 'parkbrk'), ('GUST LOCK|GUST LOCK', 'ped', A(552, 1440)), ('POWER LEVERS|PL 1', 'ped', A(478, 1670, 460)), ('POWER LEVERS|PL 2', 'ped', A(633, 1670, 460)),
            ('POWER LEVERS|REVERSE 1', 'ped', 'reverse1'), ('POWER LEVERS|REVERSE 2', 'ped', 'reverse2'), ('POWER LEVERS|IDLE GATE', 'ped', 'idlegate'), ('CONDITION LEVERS|CL 1', 'ped', A(852, 1525)), ('CONDITION LEVERS|CL 2', 'ped', A(946, 1525)), ('FLAPS|FLAPS LEVER', 'ped', 'flapsLever', {'pad': 20}),
            ('COM 1|COM 1', 'ped', 'COM1:.*'), ('COM 2|COM 2', 'ped', 'COM2:.*'), ('AUDIO CPT|AUDIO CPT', 'ped', V(sh, 'ped', 118, 2240, 470, 275), {'whole': 1}), ('AUDIO F/O|AUDIO F/O', 'ped', V(sh, 'ped', 895, 2240, 470, 275), {'whole': 1}),
            ('TRIM|ROLL TRIM', 'ped', A(740, 2350)), ('TRIM|YAW TRIM', 'ped', A(737, 2547)), ('TRIM|STBY PITCH TRIM', 'ped', A(737, 2710))]
CROP['front'] = (0, 0, 4940, 1900); CROP['ped'] = (0, 110, 1456, 2806)
