"""NORDAP's own drawing of the A350 overhead panel. The FlightGear model's overhead is unfinished, so this panel is drawn, not rendered.
It is simplified: the system panels sit in the order they have in the aircraft (centre row: fire, hydraulics, fuel, electrics, air, anti-ice and
cabin pressure, lights and APU; other systems in the two lateral rows); the place of each single control inside a panel is approximate.
Writes out/ovh_0_0.png and out/ovh.json (name -> rectangle in pixels)."""
import json, sys
from PIL import Image, ImageDraw, ImageFont
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; F = lambda s: ImageFont.truetype(FB, s)
PB = lambda l, a='FAULT', b='OFF': ('pb', l, a, b); KN = lambda l: ('kn', l); GD = lambda l: ('gd', l); SW = lambda l: ('sw', l)
C = [  # centre row, aft (top) to forward (bottom): (title, height, rows) or a list of such panels side by side
    ('MAINTENANCE', 230, None),
    ('FIRE', 300, [[GD('ENG 1 FIRE'), PB('ENG 1 AGENT 1', 'SQUIB', 'DISCH'), PB('ENG 1 AGENT 2', 'SQUIB', 'DISCH'), GD('APU FIRE'), PB('APU AGENT', 'SQUIB', 'DISCH'), GD('ENG 2 FIRE'), PB('ENG 2 AGENT 1', 'SQUIB', 'DISCH'), PB('ENG 2 AGENT 2', 'SQUIB', 'DISCH')], [PB('FIRE TEST', '', '')]]),
    ('HYD', 250, [[PB('GREEN ENG 1 PUMP'), PB('GREEN ENG 2 PUMP'), PB('GREEN ELEC PUMP', 'FAULT', 'ON'), PB('YELLOW ELEC PUMP', 'FAULT', 'ON'), PB('YELLOW ENG 1 PUMP'), PB('YELLOW ENG 2 PUMP')]]),
    ('FUEL', 330, [[PB('L MAIN'), PB('L STBY'), PB('CTR L'), PB('CTR R'), PB('R STBY'), PB('R MAIN')], [PB('X FEED', 'OPEN', 'ON')]]),
    ('ELEC', 660, [[PB('BAT 1'), PB('BAT EMER 1'), PB('BAT EMER 2'), PB('BAT 2')], [PB('GALLEY'), PB('BUS TIE'), PB('COMMERCIAL')], [PB('EXT 1', 'AVAIL', 'ON'), PB('APU GEN'), PB('EXT 2', 'AVAIL', 'ON')],
                   [PB('GEN 1A'), PB('GEN 1B'), PB('GEN 2A'), PB('GEN 2B')], [GD('DRIVE 1A'), GD('DRIVE 1B'), GD('DRIVE 2A'), GD('DRIVE 2B')]]),
    ('AIR', 400, [[KN('COCKPIT TEMP'), PB('HOT AIR 1'), KN('AIR FLOW'), PB('HOT AIR 2'), KN('CABIN TEMP')], [PB('PACK 1'), PB('ENG 1 BLEED'), GD('RAM AIR'), KN('X BLEED'), PB('APU BLEED', 'FAULT', 'ON'), PB('ENG 2 BLEED'), PB('PACK 2')]]),
    [('ANTI ICE', 230, [[PB('WING', 'FAULT', 'ON'), PB('ENG 1', 'FAULT', 'ON'), PB('ENG 2', 'FAULT', 'ON'), PB('PROBE & WINDOW HEAT', '', 'ON')]]), ('CABIN PRESS', 230, [[PB('CABIN ALT MODE', '', 'MAN'), PB('CABIN V/S MODE', '', 'MAN'), GD('DITCHING')]])],
    [('EXT LT', 240, [[SW('STROBE'), SW('BEACON'), SW('NAV'), SW('LOGO'), SW('WING'), SW('RWY TURN OFF'), SW('LAND'), SW('NOSE')]]), ('APU', 240, [[PB('MASTER SW', 'FAULT', 'ON'), PB('START', 'AVAIL', 'ON')]], 0.24)],
    [('INT LT', 230, [[SW('STORM'), SW('DOME'), SW('ANN LT')]]), ('SIGNS', 230, [[SW('SEAT BELTS'), SW('NO SMOKING'), SW('EMER EXIT LT')]])]]
L = [('C/B', 230, None), ('ADIRS', 430, [[KN('IR 1'), KN('IR 3'), KN('IR 2')], [PB('ADR 1'), PB('ADR 3'), PB('ADR 2')]]), ('F/CTL', 250, [[PB('PRIM 1'), PB('SEC 1')]]), ('EMER ELEC PWR', 250, [[GD('RAT MAN ON')]]),
     ('EVAC', 260, [[GD('COMMAND'), PB('HORN SHUT OFF', '', ''), SW('CAPT & PURS')]]), ('RCDR', 230, [[PB('GND CTL', '', 'ON'), PB('CVR ERASE', '', ''), PB('CVR TEST', '', '')]]),
     ('OXYGEN', 260, [[GD('MASK MAN ON'), PB('CREW SUPPLY', '', 'OFF'), PB('PASSENGER', 'SYS ON', '')]]), ('CALLS', 230, [[PB('MECH', '', ''), PB('ALL', '', ''), PB('EMER', 'CALL', 'ON')]]), ('WIPER', 250, [[KN('WIPER CAPT'), PB('RAIN RPLNT CAPT', '', '')]])]
R = [('C/B', 230, None), ('F/CTL', 250, [[PB('PRIM 2'), PB('PRIM 3'), PB('SEC 2')]]), ('CARGO AIR COND', 560, [[KN('FWD CARGO TEMP'), KN('BULK CARGO TEMP')], [PB('FWD ISOL VALVES'), PB('BULK ISOL VALVES'), PB('BULK HEATER')]]),
     ('CARGO SMOKE', 400, [[GD('FWD AGENT'), GD('AFT / BULK AGENT')], [PB('SMOKE TEST', '', '')]]), ('VENT', 380, [[PB('EXTRACT', 'FAULT', 'OVRD'), PB('AVNCS COOLG', 'FAULT', 'OVRD')]]), ('WIPER', 250, [[KN('WIPER F/O'), PB('RAIN RPLNT F/O', '', '')]])]
PLATE = (108, 119, 131); EDGE = (64, 72, 81); INK = (236, 240, 244); BG = (26, 29, 33)
def wrap(d, text, font, maxw):
    out, cur = [], ''
    for w in text.split(' '):
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= maxw or not cur: cur = t
        else: out.append(cur); cur = w
    return out + [cur]
def draw():
    WL, WC, G = 440, 880, 10; W = WL * 2 + WC + G * 4; cols = [(G, WL, L), (G * 2 + WL, WC, C), (G * 3 + WL + WC, WL, R)]
    hs = lambda col: sum((p[0][1] if isinstance(p, list) else p[1]) + G for p in col); H = max(hs(c[2]) for c in cols) + G
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im); T = {}
    def panel(x, y, w, h, title, rows, whole_only=False):
        d.rounded_rectangle([x, y, x + w, y + h], 10, fill=PLATE, outline=EDGE, width=3)
        for sx, sy in ((x + 14, y + 14), (x + w - 14, y + 14), (x + 14, y + h - 14), (x + w - 14, y + h - 14)): d.ellipse([sx - 6, sy - 6, sx + 6, sy + 6], fill=(150, 158, 166), outline=(60, 66, 72))
        d.text((x + 34, y + 12), title, font=F(26), fill=INK); tw = d.textlength(title, font=F(26)); d.line([x + 44 + tw, y + 28, x + w - 34, y + 28], fill=INK, width=3)
        T[title if title not in T else title + ' 2'] = [x, y, w, h, 1]
        if not rows: d.rounded_rectangle([x + 30, y + 56, x + w - 30, y + h - 24], 8, fill=(84, 94, 104), outline=EDGE, width=2); return
        rh = (h - 50) / len(rows)
        for r, row in enumerate(rows):
            cw = (w - 20) / len(row)
            for i, it in enumerate(row):
                cx = x + 10 + cw * (i + .5); top = y + 50 + rh * r; kind, lab = it[0], it[1]; lines = wrap(d, lab, F(17), cw - 8)
                for k, ln in enumerate(lines): d.text((cx - d.textlength(ln, font=F(17)) / 2, top + 4 + k * 20), ln, font=F(17), fill=INK)
                cy = top + 8 + len(lines) * 20 + (rh - 8 - len(lines) * 20) / 2
                if kind == 'pb':
                    s = 33; d.rounded_rectangle([cx - s, cy - s, cx + s, cy + s], 5, fill=(18, 20, 23), outline=(210, 214, 220), width=3)
                    for k, (cap, colr) in enumerate(((it[2], (150, 96, 30)), (it[3], (170, 176, 184)))):
                        if cap: f = F(13 if len(cap) < 6 else 11); d.text((cx - d.textlength(cap, font=f) / 2, cy - 22 + k * 26), cap, font=f, fill=colr)
                    box = [cx - s, cy - s, 2 * s, 2 * s]
                elif kind == 'kn':
                    r0 = 38; d.ellipse([cx - r0 - 6, cy - r0 - 6, cx + r0 + 6, cy + r0 + 6], outline=INK, width=2); d.ellipse([cx - r0, cy - r0, cx + r0, cy + r0], fill=(40, 43, 47), outline=(12, 13, 15), width=3); d.rounded_rectangle([cx - 7, cy - r0 + 2, cx + 7, cy + 8], 5, fill=(226, 228, 232)); box = [cx - r0 - 6, cy - r0 - 6, 2 * r0 + 12, 2 * r0 + 12]
                elif kind == 'gd':
                    s = 35; d.rounded_rectangle([cx - s, cy - s - 8, cx + s, cy + s + 8], 6, fill=(150, 26, 30), outline=(70, 10, 12), width=3); d.rounded_rectangle([cx - s + 9, cy - s + 6, cx + s - 9, cy + s - 6], 4, fill=(96, 14, 18)); d.line([cx - s + 4, cy - s - 2, cx + s - 4, cy - s - 2], fill=(214, 90, 90), width=3); box = [cx - s, cy - s - 8, 2 * s, 2 * s + 16]
                else:
                    d.rounded_rectangle([cx - 20, cy - 34, cx + 20, cy + 34], 8, fill=(30, 33, 37), outline=(12, 13, 15), width=2); d.rounded_rectangle([cx - 9, cy - 30, cx + 9, cy + 4], 8, fill=(206, 210, 216), outline=(90, 94, 100)); box = [cx - 20, cy - 34, 40, 68]
                T[title + '|' + lab] = [round(v, 1) for v in box]
    for x, w, col in cols:
        tot = hs(col); k = (H - G - len(col) * G) / (tot - len(col) * G); y = G
        for p in col:
            if isinstance(p, list):
                h = p[0][1] * k; fr = [q[3] if len(q) > 3 else None for q in p]; rest = (1 - sum(f for f in fr if f)) / max(1, sum(1 for f in fr if not f)); xx = x
                for q, f in zip(p, fr): ww = (w - G * (len(p) - 1)) * (f or rest); panel(xx, y, ww, h, q[0], q[2]); xx += ww + G
            else: h = p[1] * k; panel(x, y, w, h, p[0], p[2])
            y += h + G
    return im, T
if __name__ == '__main__':
    im, T = draw(); im.save('/home/claude/rend/a359/out/ovh_0_0.png'); json.dump(T, open('/home/claude/rend/a359/out/ovh.json', 'w')); print(im.size, len(T)); im.resize((im.width // 2, im.height // 2)).save('/tmp/a359_ovh_draw.jpg', quality=88)
