from PIL import Image
import json
def st(name, cols, rows):
    T = [[Image.open(f'out/{name}_{r}_{c}.png') for c in range(cols)] for r in range(rows)]
    S = Image.new('RGBA', (sum(t.width for t in T[0]), sum(r[0].height for r in T))); y = 0
    for r in T:
        x = 0
        for t in r: S.paste(t, (x, y)); x += t.width
        y += r[0].height
    return S
o = st('ovh', 1, 3); f = st('front', 3, 1); p = st('ped', 1, 2)
def lift(i): a = i.getchannel('A'); rgb = i.convert('RGB').point(lambda v: int(255 * (v / 255) ** 0.62)); rgb.putalpha(a); return rgb
l = lift(Image.open('out/sideL.png')); r = lift(Image.open('out/sideR.png')); G = 40; W = f.width; H = o.height + G + f.height + G + p.height
S = Image.new('RGBA', (W, H), (0, 0, 0, 0)); pos = {}
def put(n, im, x, y): S.alpha_composite(im, (x, y)); pos[n] = [x, y, im.width, im.height]
put('ovh', o, (W - o.width) // 2, 0); put('front', f, 0, o.height + G); py = o.height + G + f.height + G; put('ped', p, (W - p.width) // 2, py); put('sideL', l, 120, py + 520); put('sideR', r, W - r.width - 120, py + 520)
# our own display contents over the blank screens (positions computed from the model's screen objects, sheet pixels)
from PIL import ImageDraw, ImageFont
SCR = [('pfd', 530, 4435, 545, 524), ('nd', 1129, 4436, 545, 524), ('ewd', 2219, 4407, 558, 526), ('sd', 2219, 4975, 558, 526), ('nd', 3238, 4434, 558, 524), ('pfd', 3839, 4435, 558, 524),
       ('isis', 1956, 4677, 188, 176), ('mcdu', 1766, 5631, 293, 275), ('mcdu', 2861, 5631, 293, 275)]
for n, x, y, w, h in SCR:
    im = Image.open(f'scr/{n}.png').convert('RGBA').resize((w - 8, h - 8), Image.LANCZOS); d = ImageDraw.Draw(S); d.rectangle([x - 3, y - 3, x + w + 2, y + h + 2], fill=(9, 11, 14, 255)); S.paste(im, (x + 4, y + 4))
d = ImageDraw.Draw(S); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 23)
d.text((2133 + 452, 4025 + 26), '5000', font=f, fill=(248, 206, 40, 255))                      # FCU altitude window
for x in (1652, 3161): d.text((x + 54, 4061 + 27), '1013', font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 30), fill=(226, 232, 238, 255), anchor='mm')
S.save('out/a320_full.png'); json.dump({'W': W, 'H': H, 'pos': pos}, open('out/a320_pos.json', 'w')); print(W, H)

bg = Image.new('RGBA', S.size, (17, 20, 24, 255)); bg.alpha_composite(S); bg = bg.convert('RGB')
for w in (3000, 1500): bg.resize((w, round(H * w / W)), Image.LANCZOS).save(f'out/a320-deck-{w}.webp', quality=80 if w == 3000 else 78, method=6)
bg.crop((400, 3960, 4520, 5560)).resize((1648, 640)).save('/tmp/v_main.jpg', quality=88); bg.crop((1500, 3960, 3420, 4330)).save('/tmp/v_fcu.jpg', quality=88); bg.resize((738, round(H * 738 / W))).save('/tmp/v_all.jpg', quality=85)
