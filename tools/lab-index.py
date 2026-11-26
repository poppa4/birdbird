"""Builds data/labindex.json: every Virtual Lab, its sections, every Key concepts card and every deep-dive fold, in English and Norwegian,
so the search bar can find a lab by the ideas it teaches ("induced drag", "aoa", "angrepsvinkel") and open the card's
place in the model (lab.html#kc-<key>).

The cards are written in each lab's own script, in several formats, so they are read from the rendered pages.
Run after adding, renaming or removing a lab or a card:
    python3 tools/lab-index.py
(Playwright with Chromium; the pages are served from this folder, nothing goes to the network.)"""
import json, os, re, mimetypes
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'http://nordap.test/'
lab = open(os.path.join(ROOT, 'lab.js'), encoding='utf-8').read()
TOP = json.loads(re.search(r'/\*TOPICS\*/(\{[\s\S]*?\})/\*END\*/', lab).group(1))
LABS = re.findall(r"\['([a-z0-9-]+\.html)','([a-z0-9]+)','([^']+)','([^']+)','([a-z]*)'\]", lab)

def serve(route):
    u = route.request.url
    if not u.startswith(BASE):
        return route.abort()
    p = u[len(BASE):].split('?')[0].split('#')[0] or 'index.html'
    f = os.path.join(ROOT, p)
    if not os.path.isfile(f):
        return route.fulfill(status=404, body='')
    route.fulfill(status=200, body=open(f, 'rb').read(), headers={'content-type': mimetypes.guess_type(f)[0] or 'application/octet-stream'})

READ = """() => [...document.querySelectorAll('.kcgrid .kc')].map(c => {
  const b = c.querySelector('.kgo'), h = c.querySelector('h3'), p = c.querySelector(':scope > p'), mo = [...c.querySelectorAll('details.kmore p')].map(x => x.textContent).join(' ');
  const href = b && b.tagName === 'A' ? b.getAttribute('href') : '';
  return {k: b && b.dataset ? (b.dataset.k || '') : '', href, t: h ? h.textContent.trim() : '', d: p ? p.textContent.replace(/\\s+/g, ' ').trim() : '', m: mo.replace(/\\s+/g, ' ').trim(), deep: !!c.closest('.deep')};
}).filter(x => x.t)"""

FOLDS = """() => [...document.querySelectorAll('details.dfold')].map(d => {
  const sm = d.querySelector('summary'), sub = sm && sm.querySelector('small'), body = [...d.children].filter(x => x.tagName !== 'SUMMARY').map(x => x.textContent).join(' ');
  const t = sm ? (sub ? sm.textContent.replace(sub.textContent, '') : sm.textContent) : '';
  return {id: d.id || '', t: t.replace(/\\s+/g, ' ').trim(), s: sub ? sub.textContent.replace(/\\s+/g, ' ').trim() : '', b: body.replace(/\\s+/g, ' ').trim()};
}).filter(x => x.t)"""

def read(pg, f, lang):
    pg.goto(BASE + 'privacy.html', wait_until='load')
    pg.evaluate("l => { localStorage.setItem('vlab-lang', l); localStorage.setItem('vlab-depth', 'deep'); }", lang)
    pg.goto(BASE + f, wait_until='load')
    pg.wait_for_timeout(1200)
    return pg.evaluate(READ), pg.evaluate(FOLDS)

def first(s):
    s = re.sub(r'\s+', ' ', s).strip()
    m = re.match(r'(.{30,}?[.!?])\s', s + ' ')
    return (m.group(1) if m else s)[:220]

def rest(c):
    """the card's other sentences and its "More" text: searched, never shown"""
    s = re.sub(r'\s+', ' ', c['d']).strip(); f = first(s)
    return (s[len(f):].strip() + ' ' + c.get('m', '')).strip()[:700]

out = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.route('**/*', serve)
    for f, k, en, no, lv in LABS:
        (cen, fen), (cno, fno) = read(pg, f, 'en'), read(pg, f, 'no')
        cards = []
        for i, c in enumerate(cen):
            o = cno[i] if i < len(cno) else c
            cards.append({'k': c['k'], 'href': c['href'] or ('' if c['k'] else f + '#understand'), 't': {'en': c['t'], 'no': o['t']}, 'd': {'en': first(c['d']), 'no': first(o['d'])}, 'm': {'en': rest(c), 'no': rest(o)}})
        folds = []
        for i, x in enumerate(fen):
            y = fno[i] if i < len(fno) else x
            folds.append({'id': x['id'], 't': {'en': x['t'], 'no': y['t']}, 's': {'en': x['s'], 'no': y['s']}, 'b': {'en': x['b'][:1200], 'no': y['b'][:1200]}})
        secs = [[s[0], s[1], s[2]] for s in TOP.get(f, [])]
        out.append({'f': f, 't': {'en': en, 'no': no}, 's': secs, 'c': cards, 'x': folds})
        print(f'{f}: {len(cards)} cards, {len(folds)} deep-dive folds, {len(secs)} sections')
    b.close()

with open(os.path.join(ROOT, 'data', 'labindex.json'), 'w', encoding='utf-8') as fh:
    json.dump({'labs': out}, fh, ensure_ascii=False, separators=(',', ':'))
print('data/labindex.json:', sum(len(l['c']) for l in out), 'cards in', len(out), 'labs')
