"""Embraer E190 (E-Jet family): views and named controls. Model: FlightGear E-jet-family-YV (GPL-2.0)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, re
NAME = 'e190'; CONST = 'E190_T'; ID = 'e190'; JSVAR = 'E190'; TITLE = 'Embraer E190'; CREW = 2
CREDIT_LONG = 'Model: FlightGear Embraer E-Jet family (github.com/YV3399/E-jet-family-YV, GPL-2.0).'
IMG = {'v': 'E170/175/190/195 flight deck (E-Jet, Primus Epic)', 'by': 'FlightGear E-jet-family-YV', 'lic': 'GPL-2.0', 'src': 'https://github.com/YV3399/E-jet-family-YV', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'ovh': ((-12.125, 1.74, 0), (-0.522, 0.852, 0), (0.852, 0.522, 0), 1.0, 0.58, 2800, 2, 1), 'main': ((-12.5, 1.03, 0), (-1, 0, 0), (0, 1, 0), 1.9, 0.52, 2800, 3, 1), 'ped': ((-11.95, 0.7, 0), (0, -1, 0), (-1, 0, 0), 0.5, 1.25, 2800, 1, 2)}
CROP = {'ped': (0, 110, 1400, 3400)}
def paint(sh):
    S = '/home/claude/rend/scr/'; d = ImageDraw.Draw(sh.S)
    def scr(view, pat, files):
        x, y, w, h = (round(v) for v in sh.box(view, pat)); d.rectangle([x, y, x + w, y + h], fill=(4, 6, 8, 255)); n = len(files); hh = (h - 8) // n
        for i, f in enumerate(files):
            im = Image.open(S + f + '.png').convert('RGBA'); k = min((w - 8) / im.width, hh / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS); sh.S.paste(im, (x + (w - im.width) // 2, y + 4 + i * hh + (hh - im.height) // 2))
    scr('main', r'Primary Flight Display Left:PFD0', ['b_pfd', 'b_nd']); scr('main', r'Primary Flight Display Right:PFD1', ['b_pfd', 'b_nd'])
    scr('main', r'Main Flight Display Left:MFD0', ['b_nd', 'b_lower']); scr('main', r'Main Flight Display Right:MFD1', ['b_nd', 'b_lower']); scr('main', r'EICAS Panel:EICAS', ['b_eicas'])
def CTL(sh):
    R = []; X = -12.43
    def W(view, z, y, hz=0.012, hy=0.012, x=X):                       # a rectangle given in aircraft metres (lateral z, height y) on the main view
        q = sh.proj(view, np.array([[x, y - hy, z - hz], [x, y + hy, z + hz]])); mn, mx = q.min(0), q.max(0); return [float(mn[0]), float(mn[1]), float(mx[0] - mn[0]), float(mx[1] - mn[1])]
    def P(xa, xb, za, zb, y=0.66):                                     # a rectangle on the pedestal (fore-aft x, lateral z)
        q = sh.proj('ped', np.array([[xa, y, za], [xb, y, zb]])); mn, mx = q.min(0), q.max(0); return [float(mn[0]), float(mn[1]), float(mx[0] - mn[0]), float(mx[1] - mn[1])]
    O = lambda n, pat, **o: R.append((n, 'ovh', pat, dict({'min': 46}, **o)))
    for n, p in (('DVDR|CVR ERASE', 'cvr-erase'), ('DVDR|DVDR TEST', 'dvdr-test'), ('DVDR|HEADPHONE', 'headphone'), ('DVDR|DVDR FWD / AFT', r'dvdr\.switch'),
                 ('ELECTRIC|IDG 1', r'generator\.1'), ('ELECTRIC|IDG 2', r'generator\.2'), ('ELECTRIC|GPU', 'master'), ('ELECTRIC|AC BUS TIES', 'acbusties'), ('ELECTRIC|APU GEN', r'APUGen\.switch'),
                 ('ELECTRIC|TRU 1', r'tru1.*'), ('ELECTRIC|TRU ESS', r'truess.*'), ('ELECTRIC|TRU 2', r'tru2.*'), ('ELECTRIC|DC BUS TIES', r'dcbusties.*'), ('ELECTRIC|BATT 1', 'BATT1'), ('ELECTRIC|BATT 2', 'BATT2'),
                 ('COCKPIT LIGHTS|MAIN PNL', r'Brightness\.MainPanel'), ('COCKPIT LIGHTS|OVHD PNL', r'Brightness\.OHP'), ('COCKPIT LIGHTS|PEDESTAL', r'Brightness\.Pedestal'), ('COCKPIT LIGHTS|DOME', r'domelt\.switch'),
                 ('ENGINE FIRE|ENG 1 FIRE HANDLE', r'extg\.left(\.001)?'), ('ENGINE FIRE|ENG 2 FIRE HANDLE', r'extg\.right(\.001)?'),
                 ('FUEL|XFEED', r'fuel\.crossfeed'), ('FUEL|DC PUMP', r'fuel\.pump\.dc'), ('FUEL|AC PUMP 1', r'fuel\.pump\.left'), ('FUEL|AC PUMP 2', r'fuel\.pump\.right'),
                 ('PASSENGER SIGNS|EMER LT', r'emerlt\.switch'), ('PASSENGER SIGNS|NO ELEC DEV', r'noelec\.switch'), ('PASSENGER SIGNS|SEAT BELT', r'seat\.belt'),
                 ('FIRE EXTINGUISHER|APU', r'ATBtn\.003'), ('FIRE EXTINGUISHER|FIRE TEST', 'fire-test'),
                 ('APU CONTROL|APU MASTER', r'APU\.knob'), ('APU CONTROL|EMER STOP', 'ATBtn'),
                 ('EXTERNAL LIGHTS|NAV', r'nav\.switch'), ('EXTERNAL LIGHTS|STROBE', r'strobe\.switch'), ('EXTERNAL LIGHTS|RED BCN', r'bcn\.switch'), ('EXTERNAL LIGHTS|LOGO', r'logo\.switch'), ('EXTERNAL LIGHTS|TAXI NOSE', r'nose\.switch'),
                 ('EXTERNAL LIGHTS|TAXI SIDE', r'sides\.switch'), ('EXTERNAL LIGHTS|INSP', r'insp\.switch'), ('EXTERNAL LIGHTS|LANDING LEFT', r'landing\.left'), ('EXTERNAL LIGHTS|LANDING NOSE', r'landing\.nose'), ('EXTERNAL LIGHTS|LANDING RIGHT', r'landing\.right'),
                 ('HYDRAULIC|SYS 1 ENG PUMP SHUTOFF', r'ATBtn\.001'), ('HYDRAULIC|SYS 2 ENG PUMP SHUTOFF', r'ATBtn\.002'), ('HYDRAULIC|PTU', r'hydraulic\.ptu'), ('HYDRAULIC|SYS 1 ELEC PUMP', r'hydraulic\.pump\.left'), ('HYDRAULIC|SYS 2 ELEC PUMP', r'hydraulic\.pump\.right'),
                 ('HYDRAULIC|SYS 3 ELEC PUMP A', r'electric\.pump\.left'), ('HYDRAULIC|SYS 3 ELEC PUMP B', r'electric\.pump\.right'),
                 ('PRESSURIZATION|CABIN ALT', r'cabin\.alt'), ('PRESSURIZATION|MODE', r'cabin\.mode'), ('PRESSURIZATION|LFE', 'lfe'),
                 ('ICE PROTECTION|WINDSHIELD HEATING 1', r'heat\.w1'), ('ICE PROTECTION|WINDSHIELD HEATING 2', r'heat\.w2'), ('ICE PROTECTION|ENGINE 1', r'heat\.e1'), ('ICE PROTECTION|WING', r'heat\.wing'), ('ICE PROTECTION|ENGINE 2', r'heat\.e2'),
                 ('PNEUMATIC|RECIRC', 'recirc'), ('PNEUMATIC|PACK 1', r'pack\.1'), ('PNEUMATIC|PACK 2', r'pack\.2'), ('PNEUMATIC|XBLEED', 'xbleed'), ('PNEUMATIC|BLEED 1', r'bleed\.1'), ('PNEUMATIC|BLEED APU', r'bleed\.apu'), ('PNEUMATIC|BLEED 2', r'bleed\.2')):
        O(n, 'Overhead Panel/OHPanelALS:' + p)
    # the two cargo smoke buttons are one object in the model: split it down the middle
    cb = sh.box('ovh', r'Overhead Panel/OHPanelALS:cargo\.exting'); R += [('FIRE EXTINGUISHER|CARGO SMOKE FWD', 'ovh', [cb[0], cb[1], cb[2] / 2 - 6, cb[3]]), ('FIRE EXTINGUISHER|CARGO SMOKE AFT', 'ovh', [cb[0] + cb[2] / 2 + 6, cb[1], cb[2] / 2 - 6, cb[3]])]
    G = lambda n, pat, **o: R.append(('GUIDANCE PANEL|' + n, 'main', pat, dict({'min': 50}, **o)))
    G('FD CPT', 'FD'); G('FD F/O', 'FD2'); G('NAV', 'NAV'); G('HDG', 'HDG'); G('APP', 'APP'); G('BANK', 'BANK'); G('AP', 'AP'); G('YD', 'YD'); G('SRC', r'SRC(\.btn)?'); G('VNAV', 'VNAV'); G('FLCH', 'FLCH'); G('ALT', 'ALT'); G('FPA', 'FPA'); G('VS', 'VS')
    G('HDG SEL', r'HDG\.knob.*', pad=6); G('SPEED SEL', r'SPD\.(knob.*|ring)', pad=6); G('ALT SEL', r'ALT\.knob.*', pad=6); G('FPA SEL', r'FPA\.knob.*', pad=6); G('VS WHEEL', r'VS\.knob.*', pad=6); G('CRS CPT', r'CRS\.knob.*', pad=6)
    R += [('GUIDANCE PANEL|A/T', 'main', W('main', 0.04, 1.24), {'min': 50}), ('GUIDANCE PANEL|CRS F/O', 'main', W('main', -0.225, 1.2, 0.016, 0.016), {'min': 50})]
    for sfx, s in (('CPT', 'left'), ('F/O', 'right')):
        for n, p in (('HSI', 'HSI'), ('WX', 'WX'), ('FMS', 'FMS'), ('PREV', 'PREV'), ('V/L', 'VL'), ('FPR', 'FPR'), ('BRG ○', r'BRG\.circle'), ('BRG ◇', r'BRG\.diamond')): R.append((f'DISPLAY CONTROLLER {sfx}|{n} {sfx}', 'main', rf'{p}\.{s}\.btn', {'min': 46}))
        R += [(f'DISPLAY CONTROLLER {sfx}|MINIMUMS {sfx}', 'main', rf'MINIMUMS\.{s}\..*', {'min': 50}), (f'DISPLAY CONTROLLER {sfx}|BARO SET {sfx}', 'main', rf'QNH\.{s}\..*', {'min': 50}),
              (f'GLARESHIELD|MASTER WARNING {sfx}', 'main', rf'MasterWarningBtn\.{s}', {'min': 60}), (f'GLARESHIELD|MASTER CAUTION {sfx}', 'main', rf'MasterCautionBtn\.{s}', {'min': 60})]
    for n, p in (('PFD BRIGHTNESS CPT', r'PFDKnob\.Left'), ('MFD BRIGHTNESS CPT', r'MFDKnob\.Left'), ('EICAS BRIGHTNESS', 'EICASKnob'), ('FLOOD LIGHT CPT', r'FloodlightKnob\.Left'), ('CHART LIGHT CPT', r'ChartLightKnob\.Left'),
                 ('PFD BRIGHTNESS F/O', r'PFDKnob\.Right'), ('MFD BRIGHTNESS F/O', r'MFDKnob\.Right'), ('STBY / CLOCK LIGHT', 'StandbyClockLightKnob'), ('FLOOD LIGHT F/O', r'FloodlightKnob\.Right'), ('CHART LIGHT F/O', r'ChartLightKnob\.Right')): R.append(('LIGHTING|' + n, 'main', p, {'pad': 4}))
    R += [('PFD CPT', 'main', r'Primary Flight Display Left:PFD0_frame', {'whole': 1}), ('MFD CPT', 'main', r'Main Flight Display Left:MFD0_frame', {'whole': 1}), ('EICAS', 'main', r'EICAS Panel:EICAS_frame', {'whole': 1}),
          ('MFD F/O', 'main', r'Main Flight Display Right:MFD1_frame', {'whole': 1}), ('PFD F/O', 'main', r'Primary Flight Display Right:PFD1_frame', {'whole': 1}),
          ('MAIN PANEL|IESS (STANDBY)', 'main', r'Standby AI:.*'), ('MAIN PANEL|CLOCK', 'main', r'Chronometer:.*'), ('MAIN PANEL|LANDING GEAR LEVER', 'main', r'Flightdeck(ALS)?/LandingGear:.*'), ('MAIN PANEL|AUTOBRAKE', 'main', r'Flightdeck(ALS)?/AutoBrake:.*'), ('MAIN PANEL|ELT', 'main', r'Flightdeck(ALS)?/ELT:.*')]
    D = lambda n, pat, **o: R.append((n, 'ped', pat, dict({'min': 50}, **o)))
    D('MCDU 1', r'mcdu-e-jets:.*', side=1, whole=1, min=0); D('MCDU 2', r'mcdu-e-jets:.*', side=-1, whole=1, min=0)
    D('FLIGHT CONTROL MODE|ELEVATORS', r'FCM\.elevator\..*'); D('FLIGHT CONTROL MODE|RUDDER', r'FCM\.rudder\..*'); D('FLIGHT CONTROL MODE|SPOILERS', r'FCM\.spoilers\..*')
    D('POWERPLANT|ENG 1 START / STOP', r'e1\.(case|start).*'); D('POWERPLANT|ENG 2 START / STOP', r'e2\.(case|start).*'); D('POWERPLANT|IGNITION 1', r'e1\.ign.*'); D('POWERPLANT|IGNITION 2', r'e2\.ign.*')
    D('CONTROL PEDESTAL|STEEP APPR', 'btn_SteepApp', pad=8); D('CONTROL PEDESTAL|T/O CONFIG', r'TOCheck\.button', pad=14); D('CONTROL PEDESTAL|EICAS FULL', r'box\.005', pad=8)
    D('THRUST LEVERS|THRUST LEVER 1', 'ThrottleLeft'); D('THRUST LEVERS|THRUST LEVER 2', 'ThrottleRight'); D('THRUST LEVERS|SPEED BRAKE', 'BrkLever'); D('THRUST LEVERS|SLAT / FLAP', 'FlapLever', pad=14); D('THRUST LEVERS|RAT MANUAL DEPLOY', 'rat-deploy', pad=10)
    D('CONTROL PEDESTAL|EMER / PRKG BRAKE', r'park\.brake'); D('TRIM|ROLL TRIM', r'trim\.aileron'); D('TRIM|PITCH TRIM', r'trim\.elevator'); D('TRIM|YAW TRIM', r'trim\.rudder')
    R += [('FLIGHT CONTROL MODE|SHAKER 1 CUTOUT', 'ped', P(-12.385, -12.357, 0.021, 0.049, 0.74)), ('FLIGHT CONTROL MODE|SHAKER 2 CUTOUT', 'ped', P(-12.385, -12.357, -0.043, -0.015, 0.74)),
          ('TRIM|PITCH TRIM SYS 1 CUTOFF', 'ped', P(-11.682, -11.657, 0.033, 0.057)), ('TRIM|PITCH TRIM SYS 2 CUTOFF', 'ped', P(-11.682, -11.657, 0.004, 0.028))]
    R += [('AUDIO CONTROL PANEL 1', 'ped', P(-11.857, -11.768, 0.003, 0.108), {'whole': 1}), ('AUDIO CONTROL PANEL 2', 'ped', P(-11.857, -11.768, -0.117, -0.012), {'whole': 1}), ('COCKPIT DOOR CONTROL', 'ped', P(-11.75, -11.69, -0.117, -0.008), {'whole': 1})]
    return R
