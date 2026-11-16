"""One aircraft's sheet: stitch the rendered views, project model points onto it, and compute the rectangle of every named
control from the model's own geometry. Used with a spec module per aircraft (VIEWS, PLACE, CTL, ...)."""
import os, re, json, pickle, numpy as np
from PIL import Image, ImageDraw, ImageFont
class Sheet:
    def __init__(self, d, views, place, gap=40, bg=(17, 20, 24), crop=None):
        """views: name -> (c, n, up, W, H, ppm, cols, rows); place: list of (name, x, y) in sheet px, or None to stack vertically, centred"""
        self.d = d; self.V = {}; self.bg = bg
        for k, (c, n, up, W, H, ppm, cols, rows) in views.items():
            c, n, up = (np.array(v, float) for v in (c, n, up)); n /= np.linalg.norm(n); up = up - up.dot(n) * n; up /= np.linalg.norm(up); self.V[k] = dict(c=c, n=n, up=up, x=np.cross(up, -n), W=W, H=H, ppm=ppm, cols=cols, rows=rows)
        self.O = pickle.load(open(next(os.path.join(d, f) for f in os.listdir(d) if f.endswith('.pkl')), 'rb'))
        for o in self.O: o['key'] = '/'.join(o['inst']) + ':' + o['name']
        self.place = place; self.gap = gap; self.pos = {}; self.crop = crop or {}; self.full = {}
    def tiles(self, k):
        v = self.V[k]; out = os.path.join(self.d, 'out')
        if v['cols'] * v['rows'] == 1 and os.path.exists(f'{out}/{k}.png'): return Image.open(f'{out}/{k}.png').convert('RGBA')
        T = [[Image.open(f'{out}/{k}_{r}_{c}.png').convert('RGBA') for c in range(v['cols'])] for r in range(v['rows'])]
        S = Image.new('RGBA', (sum(t.width for t in T[0]), sum(r[0].height for r in T))); y = 0
        for r in T:
            x = 0
            for t in r: S.paste(t, (x, y)); x += t.width
            y += r[0].height
        return S
    def compose(self, post=None):
        ims = {k: self.tiles(k) for k in self.V}
        if post: ims = {k: post(k, im) for k, im in ims.items()}
        for k, im in ims.items(): self.full[k] = im.width
        ims = {k: (im.crop(self.crop[k]) if k in self.crop else im) for k, im in ims.items()}       # crop = (x0, y0, x1, y1) in the view's own pixels
        if self.place is None:
            W = max(i.width for i in ims.values()); y = 0; P = []
            for k, im in ims.items(): P.append((k, (W - im.width) // 2, y)); y += im.height + self.gap
        else: P = self.place
        W = max(x + ims[k].width for k, x, y in P); H = max(y + ims[k].height for k, x, y in P); S = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for k, x, y in P: S.alpha_composite(ims[k], (x, y)); self.pos[k] = [x, y, ims[k].width, ims[k].height]
        self.S = S; self.Wpx, self.Hpx = W, H; return S
    def proj(self, k, p):
        v = self.V[k]; d = np.asarray(p) - v['c']; s = self.full[k] / v['W']; ox, oy = self.crop.get(k, (0, 0))[:2]; return np.array([self.pos[k][0] - ox + (d @ v['x'] + v['W'] / 2) * s, self.pos[k][1] - oy + (v['H'] / 2 - d @ v['up']) * s]).T
    def pts(self, pat, side=0):
        P = [o['v'] for o in self.O if re.fullmatch(pat, o['key']) or re.fullmatch(pat, o['name'])]
        if not P: raise KeyError(pat)
        P = np.concatenate(P); return P[P[:, 2] * side > 0] if side else P
    def box(self, k, pat, side=0):
        q = self.proj(k, self.pts(pat, side)); mn, mx = q.min(0), q.max(0); return [float(mn[0]), float(mn[1]), float(mx[0] - mn[0]), float(mx[1] - mn[1])]
    def targets(self, ctl):
        """ctl: (id, view, pattern | [x, y, w, h] in sheet px, opts). opts: side, pad (px), min (px), whole, dx, dy, w, h (override size, centred), clip"""
        out = {}; miss = []
        for id_, k, pat, *rest in ctl:
            o = rest[0] if rest else {}
            if isinstance(pat, (list, tuple)): b = [float(v) for v in pat]
            else:
                try: b = self.box(k, pat, o.get('side', 0))
                except KeyError: miss.append((id_, pat)); continue
            if 'rel' in o: fx, fy, rw, rh = o['rel']; b = [b[0] + b[2] * fx - rw / 2, b[1] + b[3] * fy - rh / 2, rw, rh]      # a spot inside the matched box
            cx, cy = b[0] + b[2] / 2 + o.get('dx', 0), b[1] + b[3] / 2 + o.get('dy', 0); w, h = o.get('w', b[2] + 2 * o.get('pad', 0)), o.get('h', b[3] + 2 * o.get('pad', 0)); m = o.get('min', 0); w, h = max(w, m), max(h, m)
            x0, y0 = max(0, cx - w / 2), max(0, cy - h / 2); x1, y1 = min(self.Wpx, cx + w / 2), min(self.Hpx, cy + h / 2)
            assert id_ not in out, 'duplicate ' + id_
            out[id_] = [round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)] + ([1] if o.get('whole') else [])
        return out, miss
    def flat(self):
        b = Image.new('RGBA', self.S.size, (*self.bg, 255)); b.alpha_composite(self.S); return b.convert('RGB')
    def overlay(self, T, path, labels=True, scale=1.0):
        im = self.flat(); d = ImageDraw.Draw(im); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
        for i, (k, b) in enumerate(T.items()):
            x, y, w, h = b[:4]; d.rectangle([x, y, x + w, y + h], outline=(255, 0, 255) if len(b) == 4 else (0, 255, 255), width=3)
            if labels: t = k.split('|')[-1][:22]; d.text((x + 2, y + h + 1 if i % 2 else y - 17), t, font=f, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
        if scale != 1: im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        im.save(path, quality=86); return im
    def save(self, name, widths=(3000, 1500)):
        im = self.flat(); out = []
        for w in widths:
            w2 = min(w, im.width); p = os.path.join(self.d, 'out', f'{name}-{w}.webp'); im.resize((w2, round(im.height * w2 / im.width)), Image.LANCZOS).save(p, quality=80, method=6); out.append(p)
        return out
    def emit(self, T, const):
        """JS rows [id, x, y, w, h, whole?] in the 1000-wide frame, sorted top to bottom"""
        K = self.Wpx / 1000; R = sorted(([k] + [round(v / K, 1) for v in b[:4]] + b[4:] for k, b in T.items()), key=lambda r: (round(r[2] / 12), r[1]))
        rows = [json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in R]
        return f'const {const} = [\n  ' + ',\n  '.join(', '.join(rows[i:i + 4]) for i in range(0, len(rows), 4)) + '];', round(self.Hpx / K)
    def near(self, k, x, y, n=6, maxsize=400):
        """names of the model objects nearest to a sheet point: to find what an unnamed spot is"""
        R = []
        for o in self.O:
            q = self.proj(k, o['v']); mn, mx = q.min(0), q.max(0)
            if (mx - mn).max() > maxsize: continue
            c = (mn + mx) / 2; R.append((float(np.hypot(c[0] - x, c[1] - y)), o['key'], [round(float(v)) for v in (*mn, *(mx - mn))]))
        return sorted(R)[:n]
