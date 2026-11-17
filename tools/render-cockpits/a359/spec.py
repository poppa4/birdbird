"""Airbus A350-900: views and named controls. Main panel, glareshield and pedestal: FlightGear A350XWB (GPL-2.0). Overhead: NORDAP's own simplified drawing (ovh.py)."""
from PIL import Image, ImageDraw, ImageFont
import numpy as np, re, json
NAME = 'a359'; CONST = 'A359_T'; ID = 'a359'; JSVAR = 'A359'; TITLE = 'Airbus A350-900'; CREW = 2
CREDIT_LONG = 'Model: FlightGear Airbus A350 XWB (github.com/FGMEMBERS/A350XWB, GPL-2.0). Overhead panel: drawing by NORDAP.'
IMG = {'v': 'A350-900 flight deck. The overhead panel is a simplified drawing: the panels are in the right order, single buttons are approximate', 'by': 'FlightGear A350XWB', 'lic': 'GPL-2.0', 'src': 'https://github.com/FGMEMBERS/A350XWB', 'licUrl': 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html'}
VIEWS = {'ovh': ((0, 0, 0), (0, 0, 1), (0, 1, 0), 1800 / 2800, 2970 / 2800, 2800, 1, 1), 'main': ((2.45, 1.88, 0), (-1, 0, 0), (0, 1, 0), 2.2, 0.8, 2800, 3, 1), 'ped': ((2.67, 1.6, 0), (0, -1, 0), (-1, 0, 0), 0.62, 1.6, 2800, 1, 2)}
CROP = {'main': (0, 0, 6159, 1560), 'ped': (0, 1380, 1736, 4400)}
S_ = '/home/claude/rend/scr/'
def VP(sh, view, x, y, w, h):
    p = sh.pos[view]; c = sh.crop.get(view, (0, 0)); return [p[0] + x - c[0], p[1] + y - c[1], w, h]
DISP = {'OIS CPT': (337, 840, 949, 653), 'PFD AND ND CPT': (1348, 870, 1025, 623), 'ECAM DISPLAY': (2584, 900, 992, 582), 'PFD AND ND F/O': (3804, 870, 1043, 623), 'OIS F/O': (4873, 840, 960, 653)}
def paint(sh):
    from PIL import ImageEnhance
    x, y, w, h = sh.pos['ped']; reg = sh.S.crop((x, y, x + w, y + h)).convert('RGB'); reg = ImageEnhance.Brightness(reg).enhance(2.5); sh.S.paste(reg, (x, y))      # the model's pedestal textures are very dark
    d = ImageDraw.Draw(sh.S)
    def scr(view, r, files, pad=14):
        x, y, w, h = (round(v) for v in VP(sh, view, *r)); x += pad; y += pad; w -= 2 * pad; h -= 2 * pad; d.rectangle([x, y, x + w, y + h], fill=(4, 6, 8, 255)); n = len(files); ww = (w - 8) // n
        for i, f in enumerate(files):
            im = Image.open(S_ + f + '.png').convert('RGBA'); k = min(ww / im.width, (h - 8) / im.height); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS); sh.S.paste(im, (x + 4 + i * ww + (ww - im.width) // 2, y + (h - im.height) // 2))
    scr('main', DISP['PFD AND ND CPT'], ['pfd', 'nd']); scr('main', DISP['ECAM DISPLAY'], ['ewd', 'sd']); scr('main', DISP['PFD AND ND F/O'], ['nd', 'pfd']); scr('ped', (382, 1500, 1010, 570), ['mcdu', 'mcdu'], 20)
G = 1250 / 1700
def CTL(sh):
    R = []; T = json.load(open('/home/claude/rend/a359/out/ovh.json'))
    for n, r in T.items(): R.append((n, 'ovh', VP(sh, 'ovh', *r[:4]), {'whole': 1} if len(r) > 4 else {'min': 50}))
    def GL(n, x, y, w=66, h=None, **o): h = h or w; R.append((n, 'main', VP(sh, 'main', 1900 + (x - w / 2) * G, 150 + (y - h / 2) * G, w * G, h * G), o))        # left glareshield picture
    def GR(n, x, y, w=66, h=None, **o): h = h or w; R.append((n, 'main', VP(sh, 'main', 3000 + (x - w / 2) * G, 150 + (y - h / 2) * G, w * G, h * G), o))        # right glareshield picture
    GL('GLARESHIELD|CHRONO CPT', 65, 383, 90); GL('GLARESHIELD|SIDESTICK PRIORITY CPT', 212, 378, 90); GL('GLARESHIELD|MASTER WARN CPT', 365, 260, 96); GL('GLARESHIELD|MASTER CAUT CPT', 365, 378, 96)
    GL('EFIS CONTROL PANEL CPT', 798, 281, 674, 388, whole=1); GL('EFIS CPT|BARO CPT', 557, 330, 86, 96); GL('EFIS CPT|LS CPT', 518, 447, 64, 50); GL('EFIS CPT|VV CPT', 589, 447, 64, 50); GL('EFIS CPT|ND MODE CPT', 743, 418, 96); GL('EFIS CPT|ND RANGE CPT', 1002, 418, 96); GL('EFIS CPT|TAXI CPT', 522, 128, 64, 50)
    GL('AFS CONTROL PANEL|SPD / MACH', 1248, 128, 44); GL('AFS CONTROL PANEL|TRUE / MAG', 1437, 128, 44); GL('AFS CONTROL PANEL|HDG-V/S / TRK-FPA', 1604, 153, 44); GL('AFS CONTROL PANEL|SPD SEL', 1248, 348, 116); GL('AFS CONTROL PANEL|HDG SEL', 1437, 348, 124)
    GL('AFS CONTROL PANEL|FD', 1604, 262, 68); GL('AFS CONTROL PANEL|AP 1', 1565, 345, 68); GL('AFS CONTROL PANEL|AP 2', 1645, 345, 68); GL('AFS CONTROL PANEL|A/THR', 1604, 422, 68); GL('AFS CONTROL PANEL|LOC', 1437, 447, 68, 50)
    GR('AFS CONTROL PANEL|METER', 275, 128, 44); GR('AFS CONTROL PANEL|ALT SEL', 280, 345, 116); GR('AFS CONTROL PANEL|V/S SEL', 465, 347, 116); GR('AFS CONTROL PANEL|ALT', 280, 448, 68, 50); GR('AFS CONTROL PANEL|APPR', 465, 448, 68, 50)
    GR('EFIS CONTROL PANEL F/O', 913, 281, 674, 388, whole=1); GR('EFIS F/O|BARO F/O', 1153, 328, 86, 96); GR('EFIS F/O|LS F/O', 1195, 447, 64, 50); GR('EFIS F/O|VV F/O', 1122, 447, 64, 50); GR('EFIS F/O|ND MODE F/O', 965, 418, 96); GR('EFIS F/O|ND RANGE F/O', 708, 418, 96); GR('EFIS F/O|TAXI F/O', 1188, 128, 64, 50)
    GR('GLARESHIELD|MASTER WARN F/O', 1345, 258, 96); GR('GLARESHIELD|MASTER CAUT F/O', 1345, 377, 96); GR('GLARESHIELD|SIDESTICK PRIORITY F/O', 1498, 377, 90); GR('GLARESHIELD|CHRONO F/O', 1645, 383, 90)
    for n, r in DISP.items(): R.append((n, 'main', VP(sh, 'main', *r), {'whole': 1}))
    def MC(n, x, y, w, h=None): h = h or w; R.append((n, 'main', VP(sh, 'main', 2200 + (x - w / 2) * 1.2, 750 + (y - h / 2) * 1.2, w * 1.2, h * 1.2)))
    MC('MAIN PANEL|AIR DATA', 223, 430, 84); MC('MAIN PANEL|FMS', 223, 560, 84); MC('MAIN PANEL|RWY COND / BRAKING ACTION', 1247, 250, 64); MC('MAIN PANEL|A/BRK', 1240, 318, 40); MC('MAIN PANEL|LANDING GEAR LEVER', 1242, 470, 110, 220)
    def PA(n, x, y, w, h=None, **o): h = h or w; R.append((n, 'ped', VP(sh, 'ped', 150 + x - w / 2, 2150 + y - h / 2, w, h), o))
    def PB(n, x, y, w, h=None, **o): h = h or w; R.append((n, 'ped', VP(sh, 'ped', 150 + x - w / 2, 3250 + y - h / 2, w, h), o))
    R.append(('MFD (LOWER DISPLAY)', 'ped', VP(sh, 'ped', 382, 1500, 1010, 570), {'whole': 1}))
    PA('KCCU CPT', 290, 300, 430, 560, whole=1); PA('KCCU F/O', 1160, 300, 430, 560, whole=1); PA('THRUST LEVERS|THRUST LEVER 1', 665, 440, 110, 400); PA('THRUST LEVERS|THRUST LEVER 2', 775, 440, 110, 400)
    PA('ENG START|ENG 1 MASTER', 565, 725, 70, 76); PA('ENG START|ENG START SELECTOR', 717, 760, 96); PA('ENG START|ENG 2 MASTER', 865, 725, 70, 76)
    PA('RMP 1', 260, 825, 370, 470, whole=1); PA('RMP 2', 1175, 825, 370, 470, whole=1)
    for n, x, y in (('T.O CONFIG', 583, 855), ('RCL LAST', 583, 890), ('EMER CANC', 830, 855), ('RCL ALL', 830, 890), ('DEFRD', 683, 862), ('ABN', 733, 862), ('DISPCH', 661, 918), ('STS', 711, 916), ('MORE', 761, 918), ('ENG', 632, 962), ('DOOR', 684, 962), ('WHEEL', 735, 962), ('FUEL', 786, 962),
                    ('EL/AC', 632, 1017), ('EL/DC', 684, 1017), ('HYD', 735, 1017), ('F/CTL', 786, 1017), ('ALL', 568, 1052), ('APU', 632, 1052), ('BLEED', 684, 1052), ('COND', 735, 1052), ('PRESS', 786, 1052), ('CLEAR CPT', 506, 1010), ('CLEAR F/O', 903, 1010)): PA('ECAM CONTROL PANEL|' + n, x, y, 48, 34)
    PB('PEDESTAL|SPEED BRAKE', 448, 135, 90, 170); PB('SURV PANEL', 712, 130, 350, 235, whole=1); PB('PEDESTAL|FLAPS', 1040, 60, 110, 330); PB('PEDESTAL|PRK BRK', 285, 345, 170, 130); PB('PEDESTAL|RUDDER TRIM', 745, 462, 90, 96); PB('PEDESTAL|RUDDER TRIM RESET', 832, 460, 40)
    PB('PEDESTAL|CKPT LT INTEG', 523, 480, 64); PB('PEDESTAL|CKPT LT FLOOD', 625, 480, 64); PB('PEDESTAL|CKPT LT STORM', 523, 568, 64); PB('PEDESTAL|CKPT DOOR', 780, 557, 90, 60); PB('RMP 3', 1070, 668, 370, 470, whole=1)
    return R
